// PAN471 — read-only capability inventory (bounded first slice).
//
// Composes the EXISTING bounded order/customer handoff (src/ks238/order-source-
// handoff.mjs) and the capability/module contracts (capability-catalogue +
// erp-order-capability-cell, driven through the released reader surface) into
// a useful, read-only inventory of capabilities, ownership and missing
// semantics.
//
// It is READ-ONLY and SYNTHETIC: it drives the ACTUAL released entry points
// (createKs238OrderSourceHandoff + the released catalogue / capability-cell
// projections) and emits no writes, no capability activation/execution, no
// production/customer/host data, and no credentials. Missing quantity, unit,
// price and business rule stay UNAVAILABLE (never inferred). Observations,
// inferred relations and confirmed decisions remain separate. Denied
// visibility is recorded (not deleted) and is not complete coverage.
//
// Anti-substitution: the inventory is BOUND to a specific source identity
// (sourceLabel + sourceBytesSha256 + sourceDigest) and tenant. A substituted
// source or a wrong tenant is refused (SOURCE_SUBSTITUTION_DENIED /
// TENANT_MISMATCH), and a serialized inventory that no longer re-derives to
// the re-executed readers is refused (SERIALIZED_BINDING_MISMATCH).
import { createHash } from "node:crypto";
import {
  canonicalJson,
  verifyErpReadConnectorContractV1,
  listCapabilityCatalogueV1,
  syntheticCapabilityCatalogueV1,
  syntheticErpOrderProfilesV1,
  evaluateErpOrderProfileV1,
  ERP_ORDER_SEMANTICS_V1,
} from "../../dist/packages/contracts/src/index.js";
import {
  createKs238OrderSourceHandoff,
  KS238_SOURCE_LABEL_V1,
  KS238_ORDER_SOURCE_SCHEMA_V1,
  KS238_CONSUMER_CONTRACT_V1,
  KS238_SUPPORTED_FACTS_V1,
  KS238_UNSUPPORTED_FACTS_V1,
  KS238_MISSING_FIELDS_V1,
} from "../ks238/order-source-handoff.mjs";

export const PAN471_SCHEMA_V1 = "pansphaira.pan471/capability-inventory/v1";
export const PAN471_CONSUMER_CONTRACT_V1 = "pan471.capability-inventory/v1";

// Closed capability classes this slice inventories (read-only). Each is a
// distinct capability with its own ownership + semantics; none is activated
// or executed by this inventory.
export const CAPABILITY_CLASSES_V1 = Object.freeze([
  "ORDER_SOURCE_READ",
  "CUSTOMER_SOURCE_READ",
  "ERP_ORDER_CREATE",
  "CRM_CONTACT_CREATE",
  "EMPLOYEE_DIRECTORY_READ_OWN",
]);

// Where a capability's authority / evidence lives.
export const OWNERSHIP_V1 = Object.freeze([
  "RELEASED_CONTRACT",
  "RELEASED_READER",
  "CAPABILITY_CATALOGUE",
  "CAPABILITY_CELL",
  "HANDOFF",
]);

// A capability's availability in this bounded slice.
export const AVAILABILITY_V1 = Object.freeze([
  "AVAILABLE",
  "UNAVAILABLE",
  "DENIED",
  "NOT_COVERED",
]);

// The three evidence planes the inventory keeps SEPARATE (MIG-01-AC02).
export const EVIDENCE_PLANES_V1 = Object.freeze([
  "OBSERVATION",
  "INFERRED_RELATION",
  "CONFIRMED_DECISION",
]);

// Responsible open questions the slice surfaces (MIG-01-AC03).
export const OPEN_QUESTION_KINDS_V1 = Object.freeze([
  "MISSING_BUSINESS_RULE",
  "MISSING_QUANTITY_UNIT",
  "MISSING_AMOUNT_VALUE",
  "MISSING_DELIVERY_FACTS",
  "MISSING_CUSTOMER_EVIDENCE",
  "TENANT_BINDING",
  "SOURCE_IDENTITY",
]);

// Denial codes (boundary-specific).
export const PAN471_DENIALS_V1 = Object.freeze([
  "SOURCE_BYTES_MISMATCH",
  "CAPABILITY_INVENTORY_INPUT_REQUIRED",
  "ORDER_SOURCE_CONTRACT_MALFORMED",
  "ORDER_SOURCE_READ_DENIED",
  "TENANT_MISMATCH",
  "SOURCE_SUBSTITUTION_DENIED",
  "CAPABILITY_CATALOGUE_MALFORMED",
  "CAPABILITY_CELL_PROFILE_MALFORMED",
  "SERIALIZED_BINDING_MALFORMED",
  "SERIALIZED_BINDING_MISMATCH",
]);

const isRecord = (value) =>
  value !== null && typeof value === "object" && !Array.isArray(value)
  && Object.getPrototypeOf(value) === Object.prototype;
const isString = (value) => typeof value === "string";
const closedString = (value) => isString(value) && value.length > 0 && value.length <= 256;
const sha256Hex = (value) => isString(value) && /^[a-f0-9]{64}$/.test(value);
const inSet = (set, value) => set.includes(value);
const sha = (value) => createHash("sha256").update(canonicalJson(value), "utf8").digest("hex");
const bytesSha = (value) =>
  createHash("sha256").update(typeof value === "string" ? new TextEncoder().encode(value) : new Uint8Array(value)).digest("hex");

// Decode labelled source bytes into a record with a `batches` array, or null.
// Read-only; never mutates the caller's bytes. Used solely to surface a
// source-level tenant mismatch as a semantic TENANT_MISMATCH refusal.
function decodeSourceBytes(sourceBytes) {
  try {
    const bytes = typeof sourceBytes === "string"
      ? new TextEncoder().encode(sourceBytes)
      : new Uint8Array(sourceBytes);
    const parsed = JSON.parse(new TextDecoder("utf8", { fatal: true }).decode(bytes));
    return isRecord(parsed) && Array.isArray(parsed.batches) ? parsed : null;
  } catch {
    return null;
  }
}

// --- validation -------------------------------------------------------------

function validSourceIdentity(value) {
  return isRecord(value)
    && canonicalJson(Object.keys(value).sort()) === canonicalJson(["sourceBytesSha256", "sourceLabel"])
    && closedString(value.sourceLabel)
    && sha256Hex(value.sourceBytesSha256);
}

function validBinding(value) {
  const bindingKeys = ["catalogue", "consumerContract", "orderSource",
    "schemaVersion", "sourceIdentity", "tenantId", "trust"];
  return isRecord(value)
    && canonicalJson(Object.keys(value).sort()) === canonicalJson(bindingKeys)
    && value.schemaVersion === PAN471_SCHEMA_V1
    && value.consumerContract === PAN471_CONSUMER_CONTRACT_V1
    && value.trust === "LOCAL_SYNTHETIC"
    && closedString(value.tenantId)
    && isRecord(value.catalogue)
    && closedString(value.catalogue.catalogueId)
    && closedString(value.catalogue.version)
    && sha256Hex(value.catalogue.catalogueDigest)
    && isRecord(value.orderSource)
    && closedString(value.orderSource.sourceLabel)
    && sha256Hex(value.orderSource.sourceBytesSha256)
    && closedString(value.orderSource.sourceDigest)
    && closedString(value.orderSource.schemaVersion)
    && closedString(value.orderSource.consumerContract)
    && validSourceIdentity(value.sourceIdentity);
}

// A single capability entry. Observations, inferred relations and confirmed
// decisions stay separate; availability is never inferred from absence.
function makeCapabilityEntry({ id, kind, name, availability, ownership, semantics,
  observations, inferredRelations, confirmedDecisions, dependencies, openQuestions, nonClaims }) {
  return {
    id, kind, name,
    availability,
    ownership: inSet(OWNERSHIP_V1, ownership) ? ownership : "RELEASED_CONTRACT",
    semantics,
    evidence: {
      observations: observations,
      inferredRelations: inferredRelations,
      confirmedDecisions: confirmedDecisions,
    },
    dependencies: dependencies,
    openQuestions: openQuestions,
    nonClaims: nonClaims,
  };
}

// --- inventory construction -------------------------------------------------

function buildInventory({ handoff, catalogue, profiles, sourceLabel, sourceBytesSha256, now }) {
  let listing;
  try {
    listing = listCapabilityCatalogueV1(catalogue);
  } catch {
    return { outcome: "DENIED", code: "CAPABILITY_CATALOGUE_MALFORMED" };
  }
  if (!listing || listing.catalogueDigest === null) {
    return { outcome: "DENIED", code: "CAPABILITY_CATALOGUE_MALFORMED" };
  }
  const conformantProfiles = [];
  for (const profile of profiles) {
    let verdict;
    try {
      verdict = evaluateErpOrderProfileV1(profile, catalogue);
    } catch {
      return { outcome: "DENIED", code: "CAPABILITY_CELL_PROFILE_MALFORMED" };
    }
    if (!verdict || verdict.outcome !== "CONFORMANT") {
      return { outcome: "DENIED", code: "CAPABILITY_CELL_PROFILE_MALFORMED" };
    }
    conformantProfiles.push(profile);
  }

  const cb = handoff.contentBinding;
  const orderFacts = handoff.supported.orderFacts;
  const statusCounts = handoff.supported.statusCounts;

  // Observations (raw, read-only) — never inferred from absence.
  const orderSourceObservations = orderFacts.map((f) => ({
    plane: "OBSERVATION",
    orderId: f.order.orderId,
    customerId: f.order.customerId,
    orderStatus: f.order.orderStatus,
    period: f.order.period,
    quantityUnit: f.order.quantityUnit,
  }));
  const customerObservations = orderFacts.map((f) => ({
    plane: "OBSERVATION",
    customerId: f.order.customerId,
    customerStatus: f.customerStatus,
  }));

  const entryOrderRead = makeCapabilityEntry({
    id: "cap:order-source-read-v1",
    kind: "ORDER_SOURCE_READ",
    name: "Read synthetic ERP order source facts (bounded)",
    availability: "AVAILABLE",
    ownership: "RELEASED_READER",
    semantics: "ERP_ORDER_READ_DISCRETE_UNITS_V1",
    observations: orderSourceObservations,
    inferredRelations: [
      { plane: "INFERRED_RELATION", relation: "ORDER_STATUS_COUNTS", value: statusCounts,
        note: "Evidence-only status counts from the released reader; NOT revenue." },
    ],
    confirmedDecisions: [
      { plane: "CONFIRMED_DECISION", decision: "READ_ONLY", note: "No mutation, write or execution is performed." },
      { plane: "CONFIRMED_DECISION", decision: "TENANT_BOUND", tenantId: cb.tenantId,
        note: "The released reader enforces the tenant binding; a wrong tenant is refused before any fact is emitted." },
      { plane: "CONFIRMED_DECISION", decision: "SOURCE_IDENTITY_VERIFIED",
        sourceLabel, sourceDigest: cb.sourceDigest, sourceBytesSha256,
        note: "Bound to the labelled source bytes by digest; substitution is refused on rebind." },
    ],
    dependencies: ["contract:erp-read/v1", "connector:synthetic-erp-bi-v1"],
    openQuestions: [
      { questionId: "oq:order-quantity-unit-v1", kind: "MISSING_QUANTITY_UNIT",
        text: "Per-order quantity and unit are UNAVAILABLE for this reader (never inferred).",
        owner: "capability-owner:erp-order-read" },
    ],
    nonClaims: [
      "No revenue, amount or monetary value is derived or asserted.",
      "No delivery, history or order-intake facts are asserted.",
    ],
  });

  const entryCustomerRead = makeCapabilityEntry({
    id: "cap:customer-source-read-v1",
    kind: "CUSTOMER_SOURCE_READ",
    name: "Read synthetic ERP customer source facts (bounded)",
    availability: "AVAILABLE",
    ownership: "RELEASED_READER",
    semantics: "CUSTOMER_STATUS_READ_V1",
    observations: customerObservations,
    inferredRelations: [
      { plane: "INFERRED_RELATION", relation: "ORDER_CUSTOMER_JOIN",
        value: orderFacts.map((f) => ({ orderId: f.order.orderId, customerId: f.order.customerId })),
        note: "Order→customer join evidenced by the drained customer reader; an unevidenced customer is UNAVAILABLE, never a dropped page." },
    ],
    confirmedDecisions: [
      { plane: "CONFIRMED_DECISION", decision: "TENANT_BOUND", tenantId: cb.tenantId,
        note: "Customer source is bound to the same tenant and source digest as the order source." },
    ],
    dependencies: ["contract:erp-read/v1", "connector:synthetic-erp-bi-v1"],
    openQuestions: [
      { questionId: "oq:customer-tenant-binding-v1", kind: "TENANT_BINDING",
        text: "Customer facts are only evidenced within the bound tenant; cross-tenant visibility is denied, not absent.",
        owner: "capability-owner:erp-customer-read" },
    ],
    nonClaims: ["No customer contact detail or PII is asserted beyond the closed status vocabulary."],
  });

  // The create capability is DEFINED (the capability cell conforms to the
  // catalogue binding) but is NOT AVAILABLE in this bounded read-only slice:
  // the order source exposes no quantity/unit, so a create request cannot be
  // evidenced. This is recorded as UNAVAILABLE with the responsible open
  // question — not deleted, not invented, and not a complete-coverage claim.
  const ledgerProfile = conformantProfiles.find((p) => p.provider.kind === "SYNTHETIC_LEDGER_A");
  const entryOrderCreate = makeCapabilityEntry({
    id: "cap:erp-order-create-v1",
    kind: "ERP_ORDER_CREATE",
    name: "Create a synthetic ERP order (capability cell, bounded)",
    availability: "UNAVAILABLE",
    ownership: "CAPABILITY_CELL",
    semantics: ERP_ORDER_SEMANTICS_V1,
    observations: [],
    inferredRelations: [
      { plane: "INFERRED_RELATION", relation: "PROVIDER_RIGHTS",
        value: ledgerProfile ? ledgerProfile.provider.effectiveRights : [],
        note: "Defined provider rights from the conformant capability-cell profile (retained vocabulary, non-evidentiary here)." },
    ],
    confirmedDecisions: [
      { plane: "CONFIRMED_DECISION", decision: "NO_EXECUTION",
        note: "This inventory performs no capability activation or execution; the cell profile is evaluated read-only." },
    ],
    dependencies: ["capability:erp-order-capability-cell-v1", "catalogue:erp.order.create@1.0.0"],
    openQuestions: [
      { questionId: "oq:create-quantity-unit-v1", kind: "MISSING_QUANTITY_UNIT",
        text: "An order-create request requires quantity and unit, which the bounded order source leaves UNAVAILABLE; the create capability therefore stays UNAVAILABLE here rather than being fabricated.",
        owner: "capability-owner:erp-order-cell" },
    ],
    nonClaims: ["No order is created, mutated or rolled back by this inventory."],
  });

  // Catalogue-defined capabilities with no evidence source in this slice:
  // recorded as NOT_COVERED (denied visibility is not deletion / not coverage).
  const entryContactCreate = makeCapabilityEntry({
    id: "cap:crm-contact-create-v1",
    kind: "CRM_CONTACT_CREATE",
    name: "Create a synthetic CRM contact (catalogue-defined)",
    availability: "NOT_COVERED",
    ownership: "CAPABILITY_CATALOGUE",
    semantics: "CRM_CONTACT_CREATE_V1",
    observations: [],
    inferredRelations: [],
    confirmedDecisions: [
      { plane: "CONFIRMED_DECISION", decision: "LISTED_INACTIVE",
        note: "Listed by the released catalogue as INACTIVE with no activation or execution authority." },
    ],
    dependencies: ["catalogue:crm.contact.create@1.0.0"],
    openQuestions: [
      { questionId: "oq:contact-no-source-v1", kind: "MISSING_BUSINESS_RULE",
        text: "No CRM contact source is bound in this slice; the capability is NOT_COVERED (denied visibility), which is neither deletion nor complete coverage.",
        owner: "capability-owner:capability-catalogue" },
    ],
    nonClaims: ["No contact is created and no CRM source is read."],
  });

  const entryEmployeeRead = makeCapabilityEntry({
    id: "cap:employee-directory-read-own-v1",
    kind: "EMPLOYEE_DIRECTORY_READ_OWN",
    name: "Read own synthetic employee directory entry (catalogue-defined)",
    availability: "NOT_COVERED",
    ownership: "CAPABILITY_CATALOGUE",
    semantics: "EMPLOYEE_DIRECTORY_READ_OWN_V1",
    observations: [],
    inferredRelations: [],
    confirmedDecisions: [
      { plane: "CONFIRMED_DECISION", decision: "LISTED_INACTIVE",
        note: "Listed by the released catalogue as INACTIVE with no activation or execution authority." },
    ],
    dependencies: ["catalogue:employee.directory.read_own@1.0.0"],
    openQuestions: [
      { questionId: "oq:employee-no-source-v1", kind: "MISSING_BUSINESS_RULE",
        text: "No employee directory source is bound in this slice; the capability is NOT_COVERED (denied visibility), which is neither deletion nor complete coverage.",
        owner: "capability-owner:capability-catalogue" },
    ],
    nonClaims: ["No employee record is read."],
  });

  const capabilities = [
    entryOrderRead, entryCustomerRead, entryOrderCreate,
    entryContactCreate, entryEmployeeRead,
  ];

  const binding = {
    schemaVersion: PAN471_SCHEMA_V1,
    consumerContract: PAN471_CONSUMER_CONTRACT_V1,
    trust: "LOCAL_SYNTHETIC",
    tenantId: cb.tenantId,
    catalogue: {
      catalogueId: isString(catalogue.catalogueId) ? catalogue.catalogueId : "UNAVAILABLE",
      version: listing.catalogueVersion,
      catalogueDigest: listing.catalogueDigest,
      entries: listing.entries,
    },
    orderSource: {
      sourceLabel,
      sourceBytesSha256,
      sourceDigest: cb.sourceDigest,
      schemaVersion: handoff.binding.schemaVersion,
      consumerContract: handoff.binding.consumerContract,
      supportedFacts: handoff.binding.supportedFacts,
    },
    sourceIdentity: { sourceLabel, sourceBytesSha256 },
  };

  return {
    outcome: "INVENTORIED",
    code: "OK",
    binding,
    bindingDigest: sha(binding),
    capabilities,
    openQuestions: capabilities.flatMap((c) => c.openQuestions),
    dependencies: capabilities.flatMap((c) => c.dependencies),
    unsupportedFacts: [...KS238_UNSUPPORTED_FACTS_V1],
    missingFields: [...KS238_MISSING_FIELDS_V1],
    evidencePlanes: [...EVIDENCE_PLANES_V1],
    nonClaims: [
      "Read-only inventory: no capability activation, execution, write, mutation or rollback.",
      "Missing quantity, unit, amount and business rule remain UNAVAILABLE (never inferred).",
      "Observations, inferred relations and confirmed decisions are kept separate.",
      "NOT_COVERED / DENIED capabilities are retained (denied visibility is not deletion) and do not imply complete coverage.",
      "Synthetic local evidence only: no production/customer/host data, no credentials, no real external effects.",
    ],
  };
}

/**
 * Public read-only entry point. It owns the actual reader execution through
 * the released ks238 handoff entry point (createKs238OrderSourceHandoff)
 * against independently selected source bytes/contract/time, then composes the
 * released catalogue and capability-cell projections into a bound, read-only
 * capability inventory.
 */
export function createPan471CapabilityInventory({
  contract,
  sourceBytes,
  sourceLabel = KS238_SOURCE_LABEL_V1,
  catalogue = syntheticCapabilityCatalogueV1(),
  profiles,
  now,
} = {}) {
  if (contract === undefined || sourceBytes === undefined || typeof now !== "string") {
    return { outcome: "DENIED", code: "CAPABILITY_INVENTORY_INPUT_REQUIRED" };
  }
  if (!verifyErpReadConnectorContractV1(contract)) {
    return { outcome: "DENIED", code: "ORDER_SOURCE_CONTRACT_MALFORMED" };
  }
  const expectedTenant = contract.tenantId;
  if (typeof sourceLabel !== "string" || sourceLabel.length === 0) {
    return { outcome: "DENIED", code: "ORDER_SOURCE_CONTRACT_MALFORMED" };
  }
  // Wrong tenant is refused as a semantic TENANT_MISMATCH. The released reader
  // lumps a source/contract tenant mismatch under SOURCE_MALFORMED, so we
  // surface the semantic refusal here by comparing the source bytes' declared
  // tenant to the contract's tenant before any fact is emitted.
  const decodedSource = decodeSourceBytes(sourceBytes);
  if (decodedSource !== null && isString(decodedSource.tenantId)
      && decodedSource.tenantId !== expectedTenant) {
    return { outcome: "DENIED", code: "TENANT_MISMATCH" };
  }
  // Drive the ACTUAL released handoff entry point (it executes the released
  // readers against these independently selected bytes/contract/time).
  const handoff = createKs238OrderSourceHandoff({ contract, sourceBytes, sourceLabel, now });
  if (!handoff || handoff.outcome !== "ADAPTED") {
    return { outcome: "DENIED", code: handoff ? handoff.code : "ORDER_SOURCE_READ_DENIED" };
  }
  // Wrong tenant: the bound handoff must carry the contract's tenant.
  if (handoff.contentBinding.tenantId !== expectedTenant) {
    return { outcome: "DENIED", code: "TENANT_MISMATCH" };
  }
  let cellProfiles;
  if (Array.isArray(profiles) && profiles.length > 0) {
    cellProfiles = profiles;
  } else {
    try {
      cellProfiles = syntheticErpOrderProfilesV1(catalogue);
    } catch {
      return { outcome: "DENIED", code: "CAPABILITY_CELL_PROFILE_MALFORMED" };
    }
  }
  return buildInventory({
    handoff,
    catalogue,
    profiles: cellProfiles,
    sourceLabel,
    sourceBytesSha256: bytesSha(sourceBytes),
    now,
  });
}


/**
 * Mandatory content-bound re-binding after serialization (anti-substitution).
 * The consumer carries exactly: the serialized inventory binding + bindingDigest,
 * the source label, the source bytes, the source bytes sha256, the released read
 * contract, the catalogue/profiles selection, and the decision time. The released
 * handoff reader is re-executed against THOSE independently selected bytes/contract/
 * time, and the freshly derived binding must match the carried one exactly. A
 * substituted source (different sourceDigest/bytes) no longer re-derives and is
 * refused with SERIALIZED_BINDING_MISMATCH.
 */
export function rebindPan471Inventory({
  sourceLabel = KS238_SOURCE_LABEL_V1,
  sourceBytes,
  sourceBytesSha256,
  contract,
  catalogue = syntheticCapabilityCatalogueV1(),
  profiles,
  now,
  inventoryBinding,
  bindingDigest,
} = {}) {
  if (typeof sourceLabel !== "string" || sourceBytes === undefined || contract === undefined
    || typeof now !== "string" || typeof sourceBytesSha256 !== "string"
    || !isString(bindingDigest) || !isRecord(inventoryBinding)) {
    return { outcome: "DENIED", code: "CAPABILITY_INVENTORY_INPUT_REQUIRED" };
  }
  if (!sha256Hex(sourceBytesSha256) || bytesSha(sourceBytes) !== sourceBytesSha256) {
    return { outcome: "DENIED", code: "SOURCE_BYTES_MISMATCH" };
  }
  if (!verifyErpReadConnectorContractV1(contract)) {
    return { outcome: "DENIED", code: "ORDER_SOURCE_CONTRACT_MALFORMED" };
  }
  if (!sha256Hex(bindingDigest)) {
    return { outcome: "DENIED", code: "SERIALIZED_BINDING_MALFORMED" };
  }
  if (!validBinding(inventoryBinding)) {
    return { outcome: "DENIED", code: "SERIALIZED_BINDING_MALFORMED" };
  }
  const decodedSource = decodeSourceBytes(sourceBytes);
  if (decodedSource !== null && isString(decodedSource.tenantId)
      && decodedSource.tenantId !== contract.tenantId) {
    return { outcome: "DENIED", code: "TENANT_MISMATCH" };
  }
  const handoff = createKs238OrderSourceHandoff({ contract, sourceBytes, sourceLabel, now });
  if (!handoff || handoff.outcome !== "ADAPTED") {
    return { outcome: "DENIED", code: handoff ? handoff.code : "ORDER_SOURCE_READ_DENIED" };
  }
  let cellProfiles;
  if (Array.isArray(profiles) && profiles.length > 0) {
    cellProfiles = profiles;
  } else {
    try {
      cellProfiles = syntheticErpOrderProfilesV1(catalogue);
    } catch {
      return { outcome: "DENIED", code: "CAPABILITY_CELL_PROFILE_MALFORMED" };
    }
  }
  const fresh = buildInventory({
    handoff,
    catalogue,
    profiles: cellProfiles,
    sourceLabel,
    sourceBytesSha256,
    now,
  });
  if (!fresh || fresh.outcome !== "INVENTORIED") {
    return { outcome: "DENIED", code: fresh ? fresh.code : "ORDER_SOURCE_READ_DENIED" };
  }
  if (fresh.bindingDigest !== bindingDigest) {
    return { outcome: "DENIED", code: "SERIALIZED_BINDING_MISMATCH" };
  }
  if (fresh.bindingDigest !== sha(inventoryBinding)) {
    return { outcome: "DENIED", code: "SERIALIZED_BINDING_MISMATCH" };
  }
  return {
    outcome: "REBOUND",
    code: "OK",
    binding: inventoryBinding,
    bindingDigest: fresh.bindingDigest,
    capabilities: fresh.capabilities,
  };
}
