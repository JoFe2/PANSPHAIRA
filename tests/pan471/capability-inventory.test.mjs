// PAN471 — read-only capability inventory: named positive + boundary-specific
// negative checks, driven through the ACTUAL released entry points
// (createPan471CapabilityInventory / rebindPan471Inventory, which themselves
// execute the released ks238 handoff entry point and the released catalogue /
// capability-cell projections). No mocks, no manufactured reader results.
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  createPan471CapabilityInventory,
  rebindPan471Inventory,
  CAPABILITY_CLASSES_V1,
  OWNERSHIP_V1,
  AVAILABILITY_V1,
  EVIDENCE_PLANES_V1,
  PAN471_DENIALS_V1,
  PAN471_SCHEMA_V1,
  PAN471_CONSUMER_CONTRACT_V1,
} from "../../src/pan471/capability-inventory.mjs";

const root = new URL("../..", import.meta.url).pathname;
// Released, independently retained fixtures (NOT derived from the inventory).
const contract = JSON.parse(readFileSync(`${root}tests/fixtures/erp-read/contract-v1.json`, "utf8"));
const sourceBytes = readFileSync(`${root}tests/fixtures/erp-read/supported-export-v1.json`);
const substitutedBytes = readFileSync(`${root}tests/fixtures/erp-read/matched-export-v1.json`);
const NOW = "2026-08-10T08:30:00Z";
const LABEL = "LOCAL_SYNTHETIC_ERP_ORDER_SOURCE_V1";
const sha = (b) => createHash("sha256").update(b).digest("hex");
const independentCanonical = (v) => Array.isArray(v)
  ? `[${v.map(independentCanonical).join(",")}]`
  : v !== null && typeof v === "object"
    ? `{${Object.keys(v).sort().map((k) => `${JSON.stringify(k)}:${independentCanonical(v[k])}`).join(",")}}`
    : JSON.stringify(v);


// Independently expected facts taken directly from the released fixture /
// released catalogue (NOT derived from the inventory under test).
const EXPECTED_TENANT = "tenant:synthetic-zoo";
const EXPECTED_SOURCE_DIGEST = "01b2e51e8953a24d37462db2b6205e41e03faf6522fbf017338bf495f5007044";
const EXPECTED_ORDER_IDS = ["order:synthetic-001", "order:synthetic-002", "order:synthetic-003"];
const EXPECTED_STATUS_COUNTS = { OPEN: 2, FULFILLED: 1 };
const EXPECTED_CATALOGUE_DIGEST_PREFIX = "beaffca5dcbb";

const positive = () => createPan471CapabilityInventory({ contract, sourceBytes, now: NOW });

test("PAN471 MIG-01-AC01 positive: normal read-only entry point with source/tenant/revision binding", () => {
  const r = positive();
  assert.equal(r.outcome, "INVENTORIED");
  assert.equal(r.code, "OK");
  // source / tenant / revision binding retained in the binding.
  assert.equal(r.binding.tenantId, EXPECTED_TENANT);
  assert.equal(r.binding.orderSource.sourceLabel, LABEL);
  assert.equal(r.binding.orderSource.sourceBytesSha256, sha(sourceBytes));
  assert.equal(r.binding.orderSource.sourceDigest, EXPECTED_SOURCE_DIGEST);
  assert.equal(r.binding.sourceIdentity.sourceBytesSha256, sha(sourceBytes));
  // catalogue binding (revision) bound.
  assert.equal(r.binding.catalogue.catalogueId, "chimpmaera.local/synthetic-actions");
  assert.equal(r.binding.catalogue.version, "1.0.0");
  assert.equal(r.binding.catalogue.catalogueDigest.slice(0, 12), EXPECTED_CATALOGUE_DIGEST_PREFIX);
  // self-consistent digest.
  assert.match(r.bindingDigest, /^[a-f0-9]{64}$/);
  assert.equal(r.binding.schemaVersion, PAN471_SCHEMA_V1);
  assert.equal(r.binding.consumerContract, PAN471_CONSUMER_CONTRACT_V1);
});

test("PAN471 MIG-01-AC01 positive: inventories the bounded capabilities with distinct ownership", () => {
  const r = positive();
  assert.equal(r.capabilities.length, 5);
  const byKind = Object.fromEntries(r.capabilities.map((c) => [c.kind, c]));
  assert.equal(byKind.ORDER_SOURCE_READ.ownership, "RELEASED_READER");
  assert.equal(byKind.CUSTOMER_SOURCE_READ.ownership, "RELEASED_READER");
  assert.equal(byKind.ERP_ORDER_CREATE.ownership, "CAPABILITY_CELL");
  assert.equal(byKind.CRM_CONTACT_CREATE.ownership, "CAPABILITY_CATALOGUE");
  assert.equal(byKind.EMPLOYEE_DIRECTORY_READ_OWN.ownership, "CAPABILITY_CATALOGUE");
  for (const c of r.capabilities) {
    assert.ok(CAPABILITY_CLASSES_V1.includes(c.kind));
    assert.ok(OWNERSHIP_V1.includes(c.ownership));
    assert.ok(AVAILABILITY_V1.includes(c.availability));
  }
});

test("PAN471 MIG-01-AC02 positive: missing quantity/unit/price/business rule stays UNAVAILABLE, never inferred", () => {
  const r = positive();
  const orderRead = r.capabilities.find((c) => c.kind === "ORDER_SOURCE_READ");
  const create = r.capabilities.find((c) => c.kind === "ERP_ORDER_CREATE");
  // Per-order quantity/unit is UNAVAILABLE in every observation (never inferred).
  for (const obs of orderRead.evidence.observations) {
    assert.equal(obs.quantityUnit.quantity, "UNAVAILABLE");
    assert.equal(obs.quantityUnit.unit, "UNAVAILABLE");
  }
  // No monetary/revenue value is asserted anywhere; the unsupported contract is carried.
  assert.ok(r.unsupportedFacts.includes("netRevenue"));
  assert.ok(r.unsupportedFacts.includes("orderedQuantity"));
  assert.ok(r.unsupportedFacts.includes("quantityUnit"));
  assert.ok(r.missingFields.includes("quantity.unit"));
  assert.ok(r.missingFields.includes("amount.netRevenue"));
  // The create capability is UNAVAILABLE (quantity/unit missing) and says so via a responsible open question.
  assert.equal(create.availability, "UNAVAILABLE");
  assert.ok(create.openQuestions.some((q) => q.kind === "MISSING_QUANTITY_UNIT"));
});

test("PAN471 MIG-01-AC02 positive: observations, inferred relations and confirmed decisions remain separate", () => {
  const r = positive();
  for (const c of r.capabilities) {
    assert.ok(Array.isArray(c.evidence.observations));
    assert.ok(Array.isArray(c.evidence.inferredRelations));
    assert.ok(Array.isArray(c.evidence.confirmedDecisions));
    // Every plane is labelled with its own plane tag (no cross-plane leakage).
    for (const o of c.evidence.observations) assert.equal(o.plane, "OBSERVATION");
    for (const i of c.evidence.inferredRelations) assert.equal(i.plane, "INFERRED_RELATION");
    for (const d of c.evidence.confirmedDecisions) assert.equal(d.plane, "CONFIRMED_DECISION");
  }
  // Status counts are an inferred relation (not an observation), evidence-only.
  const orderRead = r.capabilities.find((c) => c.kind === "ORDER_SOURCE_READ");
  const counts = orderRead.evidence.inferredRelations.find((i) => i.relation === "ORDER_STATUS_COUNTS");
  assert.ok(counts);
  assert.deepEqual(counts.value, EXPECTED_STATUS_COUNTS);
  // Read-only / tenant-bound / source-identity are confirmed decisions.
  const decisions = orderRead.evidence.confirmedDecisions.map((d) => d.decision);
  assert.ok(decisions.includes("READ_ONLY"));
  assert.ok(decisions.includes("TENANT_BOUND"));
  assert.ok(decisions.includes("SOURCE_IDENTITY_VERIFIED"));
});

test("PAN471 MIG-01-AC03 positive: shows dependencies and responsible open questions", () => {
  const r = positive();
  // Dependencies are surfaced per-capability and aggregated.
  assert.ok(r.dependencies.length >= 5);
  assert.ok(r.dependencies.includes("contract:erp-read/v1"));
  assert.ok(r.dependencies.includes("capability:erp-order-capability-cell-v1"));
  // Responsible open questions carry a kind and an owner.
  assert.ok(r.openQuestions.length >= 4);
  for (const q of r.openQuestions) {
    assert.match(q.questionId, /^oq:/);
    assert.ok(q.text.length > 0);
    assert.ok(q.owner.length > 0);
  }
});

test("PAN471 MIG-01-AC03 positive: denied visibility is retained (NOT_COVERED), not deleted and not complete coverage", () => {
  const r = positive();
  const contact = r.capabilities.find((c) => c.kind === "CRM_CONTACT_CREATE");
  const employee = r.capabilities.find((c) => c.kind === "EMPLOYEE_DIRECTORY_READ_OWN");
  // Retained in the inventory with availability NOT_COVERED (denied visibility), not removed.
  assert.equal(contact.availability, "NOT_COVERED");
  assert.equal(employee.availability, "NOT_COVERED");
  // The non-claims state explicitly that NOT_COVERED/DENIED is not deletion and not complete coverage.
  assert.ok(r.nonClaims.some((n) => /NOT_COVERED/.test(n) && /not deletion/.test(n)));
  // All five capability classes are still present (nothing deleted).
  assert.equal(r.capabilities.length, 5);
  assert.deepEqual(
    r.capabilities.map((c) => c.kind).sort(),
    [...CAPABILITY_CLASSES_V1].sort(),
  );
});

// ---------------- boundary-specific negatives (MIG-01-AC01) -----------------

test("PAN471 MIG-01-AC01 negative: wrong tenant source is refused (TENANT_MISMATCH) before any fact is emitted", () => {
  // Source bytes declare a different tenant than the bound contract.
  const intruderSource = Buffer.from(
    JSON.stringify({ ...JSON.parse(sourceBytes.toString("utf8")), tenantId: "tenant:intruder" }),
  );
  const r = createPan471CapabilityInventory({ contract, sourceBytes: intruderSource, now: NOW });
  assert.equal(r.outcome, "DENIED");
  assert.equal(r.code, "TENANT_MISMATCH");
  // No capabilities / facts are emitted on a refused tenant.
  assert.equal(r.capabilities, undefined);
});

test("PAN471 MIG-01-AC01 negative: substituted source is refused (SERIALIZED_BINDING_MISMATCH) on rebind", () => {
  const inv = positive();
  // A DISTINCT, valid source (different sourceDigest) is presented as the same
  // bound inventory. The re-executed readers no longer re-derive the binding.
  const r = rebindPan471Inventory({
    sourceLabel: LABEL,
    sourceBytes: substitutedBytes,
    sourceBytesSha256: sha(substitutedBytes),
    contract,
    now: NOW,
    inventoryBinding: inv.binding,
    bindingDigest: inv.bindingDigest,
  });
  assert.equal(r.outcome, "DENIED");
  assert.equal(r.code, "SERIALIZED_BINDING_MISMATCH");
});

test("PAN471 independently rederived source refuses a forged self-rehashed binding", () => {
  const inv = positive();
  const forged = structuredClone(inv.binding);
  forged.orderSource.sourceDigest = "0".repeat(64);
  const result = rebindPan471Inventory({
    sourceLabel: LABEL,
    sourceBytes,
    sourceBytesSha256: sha(sourceBytes),
    contract,
    now: NOW,
    inventoryBinding: forged,
    bindingDigest: sha(Buffer.from(independentCanonical(forged))),
  });
  assert.equal(result.outcome, "DENIED");
  assert.equal(result.code, "SERIALIZED_BINDING_MISMATCH");
});

test("PAN471 anti-substitution positive: the SAME bound source rebinds cleanly (REBOUND), digest retained", () => {
  const inv = positive();
  const r = rebindPan471Inventory({
    sourceLabel: LABEL,
    sourceBytes: sourceBytes,
    sourceBytesSha256: sha(sourceBytes),
    contract,
    now: NOW,
    inventoryBinding: inv.binding,
    bindingDigest: inv.bindingDigest,
  });
  assert.equal(r.outcome, "REBOUND");
  assert.equal(r.code, "OK");
  assert.equal(r.bindingDigest, inv.bindingDigest);
  assert.equal(r.capabilities.length, 5);
});

// ---------------- boundary-specific negatives (input / bytes / catalogue) ---

test("PAN471 negative: missing inputs fail closed (CAPABILITY_INVENTORY_INPUT_REQUIRED)", () => {
  const r = createPan471CapabilityInventory({});
  assert.equal(r.outcome, "DENIED");
  assert.equal(r.code, "CAPABILITY_INVENTORY_INPUT_REQUIRED");
});

test("PAN471 negative: malformed read contract fails closed (ORDER_SOURCE_CONTRACT_MALFORMED)", () => {
  const r = createPan471CapabilityInventory({ contract: {}, sourceBytes, now: NOW });
  assert.equal(r.outcome, "DENIED");
  assert.equal(r.code, "ORDER_SOURCE_CONTRACT_MALFORMED");
});

test("PAN471 negative: tampered source bytes fail closed (SOURCE_MALFORMED) via the released reader", () => {
  const tampered = Buffer.from(sourceBytes.toString("utf8").replace("FULFILLED", "OPEN"));
  const r = createPan471CapabilityInventory({ contract, sourceBytes: tampered, now: NOW });
  assert.equal(r.outcome, "DENIED");
  assert.equal(r.code, "SOURCE_MALFORMED");
});

test("PAN471 negative: wrong source label fails closed (SOURCE_LABEL_DENIED) via the released reader", () => {
  const r = createPan471CapabilityInventory({ contract, sourceBytes, sourceLabel: "WRONG_LABEL_V1", now: NOW });
  assert.equal(r.outcome, "DENIED");
  assert.equal(r.code, "SOURCE_LABEL_DENIED");
});

test("PAN471 negative: rebind with wrong source-bytes digest fails closed (SOURCE_BYTES_MISMATCH)", () => {
  const inv = positive();
  const r = rebindPan471Inventory({
    sourceLabel: LABEL,
    sourceBytes: sourceBytes,
    sourceBytesSha256: "0".repeat(64),
    contract,
    now: NOW,
    inventoryBinding: inv.binding,
    bindingDigest: inv.bindingDigest,
  });
  assert.equal(r.outcome, "DENIED");
  assert.equal(r.code, "SOURCE_BYTES_MISMATCH");
});

test("PAN471 negative: malformed serialized binding fails closed (SERIALIZED_BINDING_MALFORMED)", () => {
  const inv = positive();
  const r = rebindPan471Inventory({
    sourceLabel: LABEL,
    sourceBytes: sourceBytes,
    sourceBytesSha256: sha(sourceBytes),
    contract,
    now: NOW,
    inventoryBinding: { bogus: true },
    bindingDigest: inv.bindingDigest,
  });
  assert.equal(r.outcome, "DENIED");
  assert.equal(r.code, "SERIALIZED_BINDING_MALFORMED");
});

test("PAN471 negative: a malformed capability catalogue fails closed (CAPABILITY_CELL_PROFILE_MALFORMED)", () => {
  const r = createPan471CapabilityInventory({ contract, sourceBytes, now: NOW, catalogue: { bogus: true } });
  assert.equal(r.outcome, "DENIED");
  assert.equal(r.code, "CAPABILITY_CELL_PROFILE_MALFORMED");
});

// ---------------- recorded independent expected facts (fixture) -------------

test("PAN471 positive: matches the recorded independent expected capability facts (expected-capabilities-v1.json)", () => {
  const expected = JSON.parse(
    readFileSync(`${root}tests/fixtures/pan471/expected-capabilities-v1.json`, "utf8"),
  );
  const r = positive();
  assert.equal(r.capabilities.length, expected.capabilityCount);
  for (const exp of expected.capabilities) {
    const actual = r.capabilities.find((c) => c.id === exp.id);
    assert.ok(actual, `capability ${exp.id} present`);
    assert.equal(actual.kind, exp.kind);
    assert.equal(actual.availability, exp.availability);
    assert.equal(actual.ownership, exp.ownership);
    assert.equal(actual.evidence.observations.length, exp.observationCount);
    assert.equal(actual.evidence.inferredRelations.length, exp.inferredRelationCount);
    assert.equal(actual.evidence.confirmedDecisions.length, exp.confirmedDecisionCount);
    assert.equal(actual.openQuestions.length, exp.openQuestionCount);
  }
  const orderRead = r.capabilities.find((c) => c.kind === "ORDER_SOURCE_READ");
  assert.deepEqual(
    orderRead.evidence.inferredRelations.find((i) => i.relation === "ORDER_STATUS_COUNTS").value,
    expected.statusCounts,
  );
  assert.deepEqual([...r.unsupportedFacts].sort(), [...expected.unsupportedFacts].sort());
  assert.deepEqual([...r.missingFields].sort(), [...expected.missingFields].sort());
});
