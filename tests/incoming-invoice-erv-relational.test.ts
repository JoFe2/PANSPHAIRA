import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import test from "node:test";
import Ajv2020 from "ajv/dist/2020.js";
import {
  AP04_ERV_CASE_PACK_SHA256_V1,
  AP04_ERV_RELATIONAL_CASE_PACK_SHA256_V2,
  INCOMING_INVOICE_ERV_RELATIONAL_CASE_PACK_V2,
  INCOMING_INVOICE_ERV_RELATIONAL_CORE_V2,
  compileErvCapabilityCoreV1,
  compileErvRelationalCoreV2,
  evaluateErvRelationalCaseV2,
  referenceContentSha256V2,
} from "../packages/contracts/src/index.js";

const AP04_ERV_RELATIONAL_CASE_PACK_CANONICAL_SHA256_V2 = "3f80e39ffcfa7f437f1995be33c0af931ba696c7dd408e0a9b0352298b88e565";
// Decision digest of the historical v1 pack on fresh Main (captured at RED time):
// the frozen AP-04 history must remain replayable and byte-for-byte unchanged.
const AP04_ERV_V1_DECISION_DIGEST_MAIN = "b9fde591a23ff0d67987aac87bbf756101ab17cb5b0d2ef8f329b33b23833ed3";

const packPath = "tests/fixtures/incoming-invoice/ap-04-erv-relational-cases-v2.json";
const packBytes = readFileSync(packPath);
const pack = JSON.parse(packBytes.toString("utf8"));

function decided(): any {
  const result = compileErvRelationalCoreV2(pack, AP04_ERV_RELATIONAL_CASE_PACK_SHA256_V2);
  assert.equal(result.outcome, "DECIDED");
  if (result.outcome !== "DECIDED") throw new Error("expected decided ERV relational core");
  return result.package;
}
function byCaseId(pkg: any, caseId: string): any {
  const decision = pkg.decisions.find((item: any) => item.caseId === caseId);
  assert.ok(decision, `expected case ${caseId}`);
  return decision;
}

test("R-01 frozen relational pack is digest-bound and replays deterministically without readback terminology", () => {
  assert.equal(createHash("sha256").update(packBytes).digest("hex"), AP04_ERV_RELATIONAL_CASE_PACK_SHA256_V2);
  assert.equal(AP04_ERV_RELATIONAL_CASE_PACK_SHA256_V2, "a6888ec06f92d4236061b393c2ed3e0d7fd54ca9875558b9a3b7295d25fe6ae5");
  assert.equal(pack.schemaVersion, INCOMING_INVOICE_ERV_RELATIONAL_CASE_PACK_V2);

  const resultA = compileErvRelationalCoreV2(pack, AP04_ERV_RELATIONAL_CASE_PACK_SHA256_V2);
  const resultB = compileErvRelationalCoreV2(pack, AP04_ERV_RELATIONAL_CASE_PACK_SHA256_V2);
  assert.equal(resultA.outcome, "DECIDED");
  assert.equal(resultB.outcome, "DECIDED");
  if (resultA.outcome !== "DECIDED" || resultB.outcome !== "DECIDED") throw new Error("expected decided ERV relational core");
  assert.deepEqual(resultA.package.decisions, resultB.package.decisions);
  assert.equal(resultA.package.schemaVersion, INCOMING_INVOICE_ERV_RELATIONAL_CORE_V2);
  // repeating the same local compiler is DETERMINISTIC REPLAY, not readback:
  // the v2 core package records a deterministicReplay block and carries no "readback" key.
  assert.equal("readback" in resultA.package, false);
  assert.deepEqual(resultA.package.deterministicReplay.policy, "LOCAL_COMPILER_DETERMINISTIC_REPLAY");
  assert.equal(resultA.package.deterministicReplay.packSha256, AP04_ERV_RELATIONAL_CASE_PACK_CANONICAL_SHA256_V2);
  assert.match(resultA.package.deterministicReplay.decisionDigest, /^[a-f0-9]{64}$/);
  assert.equal(Object.isFrozen(resultA), true);

  const schema = JSON.parse(readFileSync("schemas/contracts/incoming-invoice-erv-relational-v2.schema.json", "utf8"));
  const validate = new Ajv2020({ allErrors: true, strict: true }).compile(schema);
  assert.equal(validate(resultA), true, JSON.stringify(validate.errors));
});

test("R-02 validated full relational match verifies supplier, quantity, unit and currency explicitly", () => {
  const pkg = decided();
  const matched = byCaseId(pkg, "two-way-relational-matched-strict");
  assert.equal(matched.outcome, "MATCHED");
  assert.equal(matched.matchedAmountMinor, 2400);
  assert.deepEqual(matched.relations, { supplierId: "SYN-SUP-001", quantity: 2, unit: "PC", currency: "EUR" });
  for (const citation of matched.evidenceCitations) {
    assert.equal(citation.integrityVerified, true);
    assert.equal(citation.originVerified, true);
    assert.equal(citation.recomputedContentSha256, citation.contentSha256);
  }
  assert.deepEqual(matched.evidenceDimensions, { integrityVerified: true, originVerified: true, semanticsVerified: true, runtimeObserved: true });

  // the versioned tolerance variant replays through the same relational core
  const rateMatched = byCaseId(pkg, "three-way-relational-matched-rate");
  assert.equal(rateMatched.outcome, "MATCHED");
  assert.equal(rateMatched.matchedAmountMinor, 2400);
  assert.equal(rateMatched.variant.tolerancePolicyId, "RATE_BPS_V1");
  assert.deepEqual(rateMatched.relations, { supplierId: "SYN-SUP-001", quantity: 2, unit: "PC", currency: "EUR" });

  // each reference's bound contentSha256 recomputes from its own body
  const po = pack.cases[0].references.find((item: any) => item.body.referenceKind === "PURCHASE_ORDER");
  assert.equal(referenceContentSha256V2(po.body), po.evidence.contentSha256);
});

test("R-03 amount-level modes never produce a validated full match (UNKNOWN, never MATCHED)", () => {
  const pkg = decided();
  const unknown = byCaseId(pkg, "two-way-amount-only-unknown");
  assert.equal(unknown.outcome, "UNKNOWN");
  assert.equal(unknown.unknown.unknownKind, "SUPPLIER_RELATION_NOT_VERIFIED");
  assert.equal(unknown.unknown.matchedAmountMinor, 2400);
  assert.match(unknown.unknown.detail, /not enforced by this versioned mode/);
  assert.match(unknown.unknown.detail, /never a validated full match/);
  assert.equal("relations" in unknown, false);

  // wrong supplier at equal amount in the amount-level mode: the substituted
  // body carries a recomputed bound hash (integrity holds) yet the outcome is
  // still UNKNOWN and never MATCHED.
  const wrongSupplierAmountLevel = byCaseId(pkg, "two-way-amount-only-wrong-supplier");
  assert.equal(wrongSupplierAmountLevel.outcome, "UNKNOWN");
  assert.equal(wrongSupplierAmountLevel.unknown.unknownKind, "SUPPLIER_RELATION_NOT_VERIFIED");
  assert.equal(wrongSupplierAmountLevel.evidenceDimensions.integrityVerified, true);
  assert.equal(wrongSupplierAmountLevel.evidenceDimensions.semanticsVerified, true);
});

test("R-04 wrong supplier reference at equal amount is CONFLICT, with distinct evidence dimensions", () => {
  const pkg = decided();
  const conflict = byCaseId(pkg, "two-way-relational-wrong-supplier-equal-amount");
  assert.equal(conflict.outcome, "CONFLICT");
  assert.equal(conflict.conflict.conflictKind, "SUPPLIER_RELATION");
  assert.deepEqual(conflict.conflict.observed, [
    { value: "SYN-SUP-001", referenceIds: ["PO-2026-0001", "SUP-SYN-SUP-001"] },
    { value: "SYN-SUP-002", referenceIds: ["INV-2026-0001"] },
  ]);
  // the substituted invoice body plus recomputed caller hash keeps integrity
  // and origin verified while semantics fails: the four evidence dimensions
  // are distinct, not aliases of each other.
  assert.deepEqual(conflict.evidenceDimensions, { integrityVerified: true, originVerified: true, semanticsVerified: false, runtimeObserved: true });
});

test("R-05 quantity, unit and currency relations fail at equal amounts", () => {
  const pkg = decided();
  const quantity = byCaseId(pkg, "three-way-quantity-mismatch");
  assert.equal(quantity.outcome, "CONFLICT");
  assert.equal(quantity.conflict.conflictKind, "QUANTITY_RELATION");
  assert.deepEqual(quantity.conflict.observed, [
    { value: 2, referenceIds: ["INV-2026-0001", "PO-2026-0001"] },
    { value: 3, referenceIds: ["RCV-2026-0001"] },
  ]);

  const unit = byCaseId(pkg, "two-way-relational-unit-mismatch");
  assert.equal(unit.outcome, "CONFLICT");
  assert.equal(unit.conflict.conflictKind, "UNIT_RELATION");
  assert.deepEqual(unit.conflict.observed, [
    { value: "KG", referenceIds: ["PO-2026-0001"] },
    { value: "PC", referenceIds: ["INV-2026-0001", "SUP-SYN-SUP-001"] },
  ]);

  const currency = byCaseId(pkg, "three-way-currency-mismatch");
  assert.equal(currency.outcome, "CONFLICT");
  assert.equal(currency.conflict.conflictKind, "CURRENCY_RELATION");
  assert.deepEqual(currency.conflict.observed, [
    { value: "EUR", referenceIds: ["INV-2026-0001", "RCV-2026-0001", "SUP-SYN-SUP-001"] },
    { value: "USD", referenceIds: ["PO-2026-0001"] },
  ]);
  for (const decision of [quantity, unit, currency]) assert.equal(decision.evidenceDimensions.semanticsVerified, false);
});

test("R-06 duplicate reference kinds are denied deterministically, never last-write-wins", () => {
  const pkg = decided();
  const first = byCaseId(pkg, "two-way-relational-duplicate-purchase-order");
  const permuted = byCaseId(pkg, "two-way-relational-duplicate-purchase-order-permuted");
  for (const decision of [first, permuted]) {
    assert.equal(decision.outcome, "EXCEPTION");
    assert.equal(decision.exceptionCode, "DUPLICATE_REFERENCE_KIND");
    assert.match(decision.detail, /PURCHASE_ORDER \(2 occurrence\(s\)\)/);
    assert.match(decision.detail, /no last-write-wins/);
    assert.equal(decision.evidenceDimensions.semanticsVerified, false);
  }
  // the denial detail is order-independent: permuting the references changes
  // nothing about the deterministic denial.
  assert.equal(first.detail, permuted.detail);

  // direct evaluation on the permuted case reproduces the same denial
  const permutedCase = pack.cases.find((item: any) => item.caseId === "two-way-relational-duplicate-purchase-order-permuted");
  const direct = evaluateErvRelationalCaseV2(permutedCase, pack);
  assert.equal(direct.outcome, "EXCEPTION");
  if (direct.outcome === "EXCEPTION") assert.equal(direct.exceptionCode, "DUPLICATE_REFERENCE_KIND");
  assert.equal((direct as any).detail, permuted.detail);
});

test("R-07 origin and integrity are independently falsifiable evidence dimensions", () => {
  const pkg = decided();
  const foreign = byCaseId(pkg, "two-way-relational-foreign-origin");
  assert.equal(foreign.outcome, "EXCEPTION");
  assert.equal(foreign.exceptionCode, "ORIGIN_NOT_VERIFIED");
  assert.equal(foreign.evidenceDimensions.integrityVerified, true);
  assert.equal(foreign.evidenceDimensions.originVerified, false);
  const foreignCitation = foreign.evidenceCitations.find((item: any) => item.referenceKind === "INVOICE");
  assert.equal(foreignCitation.integrityVerified, true);
  assert.equal(foreignCitation.originVerified, false);

  const unverified = byCaseId(pkg, "two-way-relational-unverified-evidence");
  assert.equal(unverified.outcome, "EXCEPTION");
  assert.equal(unverified.exceptionCode, "UNVERIFIED_REFERENCE_EVIDENCE");
  assert.equal(unverified.evidenceDimensions.integrityVerified, false);
  assert.equal(unverified.evidenceDimensions.originVerified, true);
  const tampered = unverified.evidenceCitations.find((item: any) => item.referenceKind === "PURCHASE_ORDER");
  assert.equal(tampered.integrityVerified, false);
  for (const citation of unverified.evidenceCitations.filter((item: any) => item.referenceKind !== "PURCHASE_ORDER")) {
    assert.equal(citation.integrityVerified, true);
    assert.equal(citation.originVerified, true);
  }
});

test("R-08 amount conflict stays explicit and structured at the amount level", () => {
  const pkg = decided();
  const conflict = byCaseId(pkg, "three-way-relational-amount-conflict-strict");
  assert.equal(conflict.outcome, "CONFLICT");
  assert.deepEqual(conflict.conflict, {
    conflictKind: "AMOUNT",
    minReferenceId: "RCV-2026-0001", minAmountMinor: 2350,
    maxReferenceId: "INV-2026-0001", maxAmountMinor: 2400,
    deltaMinor: 50, toleranceMinor: 0,
    tolerancePolicyId: "STRICT_ZERO_V1", tolerancePolicyVersion: "1.0.0",
  });
});

test("R-09 productive denial, unknown variant and missing context remain explicit", () => {
  const pkg = decided();
  const denied = byCaseId(pkg, "two-way-relational-productive-posting-denied");
  assert.equal(denied.outcome, "DENIED");
  assert.equal(denied.reasonCode, "RISK_D_AUTHORIZATION_REQUIRED");
  assert.match(denied.detail, /Risk-D/);

  const unknownVariant = byCaseId(pkg, "two-way-relational-unknown-variant");
  assert.equal(unknownVariant.outcome, "EXCEPTION");
  assert.equal(unknownVariant.exceptionCode, "UNKNOWN_VARIANT");

  const missing = byCaseId(pkg, "three-way-relational-missing-receipt");
  assert.equal(missing.outcome, "EXCEPTION");
  assert.equal(missing.exceptionCode, "MISSING_CONTEXT");
  assert.match(missing.detail, /RECEIPT/);
});

test("R-10 the standalone core is authority-free, evidence-citing and runtime-observed locally", () => {
  const pkg = decided();
  assert.equal(pkg.authority.mode, "LOCAL_SYNTHETIC_PROOF");
  assert.equal(pkg.authority.customerDataAuthorized, false);
  assert.equal(pkg.authority.externalProviderCalls, false);
  assert.equal(pkg.authority.productivePostingAuthorized, false);
  assert.equal(pkg.authority.bookingAuthorityGranted, false);
  assert.equal(pkg.authority.riskDCapability, "SEPARATELY_AUTHORIZED");
  assert.deepEqual(pkg.nonclaims, [
    "NO_CUSTOMER_DATA_EVALUATED",
    "NO_EXTERNAL_PROVIDER_EVALUATED",
    "NO_PRODUCTIVE_ALLOCATION_OR_POSTING_AUTHORIZED",
    "NO_BOOKING_AUTHORITY_GRANTED",
    "NO_LIVE_ERP_SYSTEM_CLAIM",
    "NO_SYSTEM_OF_RECORD_READBACK_PERFORMED",
  ]);
  for (const decision of pkg.decisions) {
    assert.equal(decision.authority.productivePostingAuthorized, false);
    assert.equal(decision.authority.bookingAuthorityGranted, false);
    assert.equal(decision.authority.riskDCapability, "SEPARATELY_AUTHORIZED");
    assert.equal(decision.advisor.advisorAuthority, "EVIDENCE_CITING_ONLY");
    assert.equal(decision.advisor.bookingAuthorityGranted, false);
    assert.ok(decision.advisor.questions.length >= 1);
    for (const question of decision.advisor.questions) {
      assert.ok(question.citations.length >= 1, "every advisor question cites evidence");
      for (const citation of question.citations) {
        assert.match(citation.evidenceSha256, /^[a-f0-9]{64}$/);
      }
    }
    // every decision is the product of this local deterministic compile;
    // runtime observation is recorded, external/system-of-record readback is not.
    assert.equal(decision.evidenceDimensions.runtimeObserved, true);
  }
});

test("R-11 rejects mutated or malformed relational packs instead of inventing decisions", () => {
  assert.deepEqual(compileErvRelationalCoreV2({ ...pack, unexpected: true }, AP04_ERV_RELATIONAL_CASE_PACK_SHA256_V2), {
    outcome: "DENIED", reasonCode: "PACK_SHAPE_DENIED",
  });
  assert.deepEqual(compileErvRelationalCoreV2(pack, "0".repeat(64)), {
    outcome: "DENIED", reasonCode: "PACK_DIGEST_DENIED",
  });
  const repack = JSON.parse(JSON.stringify(pack));
  repack.packId = "tampered-pack";
  assert.deepEqual(compileErvRelationalCoreV2(repack, AP04_ERV_RELATIONAL_CASE_PACK_SHA256_V2), {
    outcome: "DENIED", reasonCode: "PACK_DIGEST_DENIED",
  });
});

test("R-12 the historical AP-04 v1 pack and its narrow amount-level behavior remain unchanged", () => {
  const v1Bytes = readFileSync("tests/fixtures/incoming-invoice/ap-04-erv-cases-v1.json");
  assert.equal(createHash("sha256").update(v1Bytes).digest("hex"), AP04_ERV_CASE_PACK_SHA256_V1);
  const v1Result = compileErvCapabilityCoreV1(JSON.parse(v1Bytes.toString("utf8")), AP04_ERV_CASE_PACK_SHA256_V1);
  assert.equal(v1Result.outcome, "DECIDED");
  if (v1Result.outcome !== "DECIDED") throw new Error("expected decided v1 ERV core");
  // exact replay pin of the historical decisions on fresh Main
  assert.equal(v1Result.package.readback.decisionDigest, AP04_ERV_V1_DECISION_DIGEST_MAIN);
  assert.equal(v1Result.package.readback.deterministicReplay, true);
});

test("R-13 focused relational suite is registered exactly once in canonical pretest", () => {
  const packageJson = JSON.parse(readFileSync("package.json", "utf8")) as { scripts: Record<string, string> };
  assert.equal(packageJson.scripts["incoming-invoice-erv-relational:test"],
    "npm run build --silent && node --test dist/tests/incoming-invoice-erv-relational.test.js");
  assert.equal(((packageJson.scripts.pretest ?? "").match(/npm run incoming-invoice-erv-relational:test:compiled/g) ?? []).length, 1);
});