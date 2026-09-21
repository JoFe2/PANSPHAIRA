import { createHash } from "node:crypto";
import { readErpOrdersFromLabelledSourceBytesV1 } from "../../dist/packages/contracts/src/index.js";
import { createComplaintLedger, validateDeliveryReferences, canonicalJson } from "./complaint.mjs";

export const PAN437_NEIGHBOR_SCHEMA_V1 = "pansphaira.cscl13/pan437-neighbor/v1";
export const PAN437_DELIVERY_POSITION_INPUT_SCHEMA_V1 = "pansphaira.cscl13/delivery-position-input/v1";
export const PAN437_MISSING_DELIVERY_CODE = "DELIVERY_POSITION_OUTPUT_REQUIRED";
export const PAN437_ORDER_SOURCE_LABEL_V1 = "LOCAL_SYNTHETIC_ERP_ORDER_SOURCE_V1";

const isRecord = (value) => value !== null && typeof value === "object"
  && !Array.isArray(value) && Object.getPrototypeOf(value) === Object.prototype;
const exactKeys = (value, keys) => isRecord(value)
  && JSON.stringify(Object.keys(value).sort()) === JSON.stringify([...keys].sort());
const digest = (value) => typeof value === "string" && /^[a-f0-9]{64}$/.test(value);
const id = (value) => typeof value === "string"
  && /^[a-z][a-z0-9-]{1,31}:[a-z0-9][a-z0-9._-]{2,95}$/.test(value);
const sha = (value) => createHash("sha256").update(canonicalJson(value), "utf8").digest("hex");
const referencesDigest = (references) => sha({
  schemaVersion: references.schemaVersion, referenceSetId: references.referenceSetId,
  tenantId: references.tenantId, lineage: references.lineage,
  articles: references.articles, deliveries: references.deliveries,
});

// This retained candidate is a contract for a future delivery module, not a
// delivery fact. It is deliberately not an authority path.
export const PAN437_DELIVERY_POSITION_INPUT_CONTRACT_V1 = Object.freeze({
  schemaVersion: PAN437_DELIVERY_POSITION_INPUT_SCHEMA_V1,
  status: "REQUIRED_BEFORE_POSITIVE_COMPOSITION",
  source: { moduleId: "erp-delivery-read", moduleVersion: "UNAVAILABLE", outcome: "READ", trust: "LOCAL_SYNTHETIC_OR_PROVIDER_ATTESTED", sourceDigest: "REQUIRED", readbackDigest: "REQUIRED" },
  delivery: { deliveryId: "REQUIRED", orderId: "REQUIRED", customerId: "REQUIRED", deliveredAt: "REQUIRED" },
  position: { positionId: "REQUIRED", articleId: "REQUIRED", articleName: "REQUIRED", quantity: "REQUIRED_POSITIVE_SAFE_INTEGER", unit: "EACH_OR_KG" },
  nonClaims: ["does not assert that a delivery exists", "does not convert an order or invoice into a delivery", "does not grant ERP write or approval authority"],
});

const missingContractResult = (availableEntity = "orders") => ({
  outcome: "DENIED", code: PAN437_MISSING_DELIVERY_CODE,
  available: { moduleId: "connector:synthetic-erp-bi-v1", entity: availableEntity },
  missingFields: ["delivery.deliveryId", "delivery.deliveredAt", "position.positionId", "position.articleId", "position.articleName", "position.quantity", "position.unit"],
  requiredContract: structuredClone(PAN437_DELIVERY_POSITION_INPUT_CONTRACT_V1),
});

// An order read is evidence about an order only. Status, invoice state and
// caller labels are never widened into a delivery or delivered quantity.
export function adaptErpReadToComplaintInput(readResult) {
  return missingContractResult(isRecord(readResult) && readResult.entity ? readResult.entity : "orders");
}

const validDeliveryPositionInput = (value) => exactKeys(value, ["schemaVersion", "status", "source", "delivery", "position", "nonClaims"])
  && value.schemaVersion === PAN437_DELIVERY_POSITION_INPUT_SCHEMA_V1 && value.status === "READ_DELIVERY_POSITION"
  && exactKeys(value.source, ["moduleId", "moduleVersion", "outcome", "trust", "sourceDigest", "readbackDigest"])
  && typeof value.source.moduleId === "string" && typeof value.source.moduleVersion === "string"
  && value.source.outcome === "READ" && ["LOCAL_SYNTHETIC", "PROVIDER_ATTESTED"].includes(value.source.trust)
  && digest(value.source.sourceDigest) && digest(value.source.readbackDigest)
  && exactKeys(value.delivery, ["deliveryId", "orderId", "customerId", "deliveredAt"])
  && id(value.delivery.deliveryId) && id(value.delivery.orderId) && id(value.delivery.customerId)
  && typeof value.delivery.deliveredAt === "string" && !Number.isNaN(Date.parse(value.delivery.deliveredAt))
  && exactKeys(value.position, ["positionId", "articleId", "articleName", "quantity", "unit"])
  && id(value.position.positionId) && id(value.position.articleId) && typeof value.position.articleName === "string"
  && value.position.articleName.length > 0 && Number.isSafeInteger(value.position.quantity) && value.position.quantity > 0
  && ["EACH", "KG"].includes(value.position.unit) && Array.isArray(value.nonClaims) && value.nonClaims.length === 3
  && value.nonClaims.every((claim) => typeof claim === "string");

// Do not promote the retained speculative positive path. A delivery-shaped
// object is not authoritative unless the actual order reader result is bound
// through bindOrderReadToComplaintReferences below.
export function adaptDeliveryPositionToComplaintReferences(input) {
  if (!validDeliveryPositionInput(input)) return { outcome: "DENIED", code: "DELIVERY_POSITION_INPUT_MALFORMED" };
  return { outcome: "DENIED", code: "ORDER_READ_BINDING_REQUIRED" };
}

function validOrderRead(readResult) {
  if (!isRecord(readResult) || readResult.outcome !== "READ" || readResult.entity !== "orders"
    || !Array.isArray(readResult.records) || !isRecord(readResult.metadata)
    || !exactKeys(readResult.metadata, ["tenantId", "trust", "principalId", "scope", "exportId", "generatedAt", "expiresAt", "sourceDatasetId", "sourceDigest", "sourceBytesSha256", "batchIds", "recordMetadata", "recordCount", "pageSize", "nextCursor"])
    || readResult.metadata.trust !== "LOCAL_SYNTHETIC" || readResult.metadata.nextCursor !== null
    || !id(readResult.metadata.tenantId) || !digest(readResult.metadata.sourceDigest) || !digest(readResult.metadata.sourceBytesSha256)
    || !digest(readResult.readbackDigest) || readResult.metadata.recordCount !== readResult.records.length) return false;
  const expected = sha({ entity: "orders", records: readResult.records, metadata: readResult.metadata });
  if (expected !== readResult.readbackDigest) return false;
  return readResult.records.every((order) => exactKeys(order, ["orderId", "customerId", "orderStatus", "orderDate", "totalMinor", "currency"])
    && id(order.orderId) && id(order.customerId));
}

/**
 * Mandatory cross-module boundary. The order module proves only actual order
 * and customer identity plus the content-bound source. Delivery references
 * remain independently supplied synthetic facts and must carry the same
 * source digest; their delivery IDs, timestamps, positions and quantities are
 * never manufactured from order status or trust labels.
 */
function bindOrderReadToComplaintReferences(orderRead, references) {
  const referenceVerdict = validateDeliveryReferences(references);
  if (referenceVerdict.outcome !== "VALID") return { outcome: "DENIED", code: referenceVerdict.code };
  if (!validOrderRead(orderRead)) return { outcome: "DENIED", code: "ORDER_READ_UNVERIFIED" };
  if (orderRead.metadata.tenantId !== references.tenantId) return { outcome: "DENIED", code: "ORDER_TENANT_MISMATCH" };
  if (references.lineage.sourceDigest !== orderRead.metadata.sourceDigest) return { outcome: "DENIED", code: "ORDER_SOURCE_MISMATCH" };

  const orderCustomers = new Map();
  for (const order of orderRead.records) {
    const previousCustomer = orderCustomers.get(order.orderId);
    if (previousCustomer !== undefined) return { outcome: "DENIED", code: "ORDER_ID_AMBIGUOUS" };
    orderCustomers.set(order.orderId, order.customerId);
  }
  const orders = new Map(orderRead.records.map((order) => [order.orderId, order]));
  for (const delivery of references.deliveries) {
    const order = orders.get(delivery.orderId);
    if (!order) return { outcome: "DENIED", code: "ORDER_NOT_FOUND" };
    if (order.customerId !== delivery.customerId) return { outcome: "DENIED", code: "ORDER_CUSTOMER_MISMATCH" };
  }
  const core = {
    schemaVersion: PAN437_NEIGHBOR_SCHEMA_V1,
    orderSource: {
      moduleId: "connector:synthetic-erp-bi-v1", entity: "orders", trust: orderRead.metadata.trust,
      tenantId: orderRead.metadata.tenantId, sourceDatasetId: orderRead.metadata.sourceDatasetId,
      sourceDigest: orderRead.metadata.sourceDigest, sourceBytesSha256: orderRead.metadata.sourceBytesSha256,
      readbackDigest: orderRead.readbackDigest, recordCount: orderRead.records.length,
    },
    deliveryReferences: {
      referenceSetId: references.referenceSetId, tenantId: references.tenantId,
      sourceDigest: references.lineage.sourceDigest, referencesDigest: referencesDigest(references),
    },
  };
  return { outcome: "BOUND", references, orderRead, binding: { ...core, bindingDigest: sha(core) } };
}

const createDeniedLedger = (code) => {
  const denied = () => ({ outcome: "DENIED", code });
  return {
    select: denied, raise: denied, decide: denied, readback: denied, history: () => [],
    evidence: () => ({ outcome: "DENIED", code, complaints: 0, decisions: 0, complaintIds: [] }),
    hydrate: () => { throw new Error(code); },
    snapshot: () => { throw new Error(code); },
  };
};

/**
 * Public composition owns the order read. Callers provide only labelled source
 * bytes and the existing read contract; a caller-supplied read-result object is
 * never accepted as composition authority.
 */
export function createPan437ComplaintCli({
  references, contract, sourceBytes, sourceLabel, enabled = true, now,
} = {}) {
  if (references === undefined || contract === undefined || sourceBytes === undefined || typeof now !== "string") {
    const verdict = { outcome: "DENIED", code: "ORDER_SOURCE_INPUT_REQUIRED" };
    return { ledger: createDeniedLedger(verdict.code), verdict };
  }
  const orderRead = readErpOrdersFromLabelledSourceBytesV1({
    contract, sourceBytes, sourceLabel, enabled, now,
  });
  if (orderRead.outcome === "DENIED") return { ledger: createDeniedLedger(orderRead.code), verdict: orderRead };
  const bound = bindOrderReadToComplaintReferences(orderRead, references);
  if (bound.outcome !== "BOUND") return { ledger: createDeniedLedger(bound.code), verdict: bound };
  return { ledger: createComplaintLedger(references, { orderBinding: bound.binding }), verdict: bound };
}
