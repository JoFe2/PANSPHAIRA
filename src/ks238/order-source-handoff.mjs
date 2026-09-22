#!/usr/bin/env node
// KS238 PAN-side bounded order/source handoff — read-only composition.
//
// This is the concrete PAN-side source handoff required by KaleidoSphere
// KS238 (SALES-ANALYSIS-01): it reuses the released order/source definitions
// and existing capability cells rather than building a second order module.
//
// It provides a small, executable, read-only adapter over the ACTUAL
// existing PAN order-reader results:
//   - readErpOrdersFromLabelledSourceBytesV1 (contract
//     chimpmaera.connector/erp-read/v1, LOCAL_SYNTHETIC trust)
//   - createErpReadAdapterV1 LIST_CUSTOMERS for customer status
//   - ERP_ORDER_SEMANTICS_V1 discrete-unit quantity semantics
//
// It exposes ONLY evidenced order/customer/status/quantity/unit/period facts
// and explicit unsupported/missing semantics to the downstream sales analysis:
//   - net revenue is NEVER inferred from order status or ordered quantity;
//   - absent currency/amount/history/delivery facts remain unavailable;
//   - source bindings and content digests survive serialization without
//     caller-resealed substitutions being treated as approval.
//
// This is a local synthetic source handoff, not production ERP qualification
// or a complete KS238 capability. It grants no order-management, write,
// approval, network, provider, runtime, publication or public-write authority.

import { createHash } from "node:crypto";
import {
  ERP_ORDER_SEMANTICS_V1,
  canonicalJson,
  createErpReadAdapterV1,
  readErpOrdersFromLabelledSourceBytesV1,
  verifyErpReadConnectorContractV1,
} from "../../dist/packages/contracts/src/index.js";

export const KS238_ORDER_SOURCE_SCHEMA_V1 = "pansphaira.ks238/order-source-handoff/v1";
export const KS238_CONSUMER_CONTRACT_V1 = "ks238.sales-analysis.order-source/v1";
export const KS238_SOURCE_LABEL_V1 = "LOCAL_SYNTHETIC_ERP_ORDER_SOURCE_V1";
export const KS238_SOURCE_MODULE_ID_V1 = "connector:synthetic-erp-bi-v1";
export const KS238_SOURCE_CONTRACT_V1 = "chimpmaera.connector/erp-read/v1";
export const KS238_PERIOD_GRANULARITY_V1 = "CALENDAR_MONTH";
export const KS238_SEMANTICS_V1 = ERP_ORDER_SEMANTICS_V1;
export const KS238_QUANTITY_MEANING_V1 = "DISCRETE_UNITS";
export const KS238_QUANTITY_UNIT_V1 = "EACH";

export const KS238_SUPPORTED_FACTS_V1 = [
  "orderIdentity",
  "customerIdentity",
  "orderStatus",
  "orderPeriod",
  "quantityUnit",
];
export const KS238_UNSUPPORTED_FACTS_V1 = [
  "netRevenue",
  "orderedQuantity",
  "amount",
  "currencyValue",
  "deliveryFacts",
  "historicalOrderBook",
  "orderIntake",
  "creditsCancellationsNetting",
];
export const KS238_MISSING_FIELDS_V1 = [
  "amount.currencyValue",
  "amount.netRevenue",
  "quantity.orderedQuantity",
  "delivery.deliveryId",
  "delivery.deliveredAt",
  "history.previousStates",
];

const isRecord = (value) =>
  value !== null && typeof value === "object" && !Array.isArray(value)
  && Object.getPrototypeOf(value) === Object.prototype;
const exactKeys = (value, keys) =>
  isRecord(value) && canonicalJson(Object.keys(value).sort()) === canonicalJson([...keys].sort());
const sha256Hex = (value) => typeof value === "string" && /^[a-f0-9]{64}$/.test(value);
const closedId = (value) =>
  typeof value === "string" && /^[a-z][a-z0-9-]{1,31}:[a-z0-9][a-z0-9._-]{2,95}$/.test(value);
const sha = (value) => createHash("sha256").update(canonicalJson(value), "utf8").digest("hex");
const bytesSha = (value) =>
  createHash("sha256").update(typeof value === "string" ? new TextEncoder().encode(value) : new Uint8Array(value)).digest("hex");

// The order-status vocabulary the released reader proves (exact, closed).
const ORDER_STATUS = new Set(["OPEN", "FULFILLED", "CANCELLED"]);
const CUSTOMER_STATUS = new Set(["ACTIVE", "ON_HOLD"]);

/**
 * Verify an actual `orders` reader result (readErpOrdersFromLabelledSourceBytesV1
 * READ shape) and return its content binding. The content binding is derived
 * from the records + reader metadata, NOT from any caller-supplied digest, so a
 * caller cannot re-seal a substitution and have it treated as approval.
 */
export function verifyOrderSourceRead(result) {
  if (!isRecord(result) || result.outcome !== "READ" || result.entity !== "orders"
    || !Array.isArray(result.records) || !isRecord(result.metadata)
    || !exactKeys(result.metadata, [
      "tenantId", "trust", "principalId", "scope", "exportId", "generatedAt",
      "expiresAt", "sourceDatasetId", "sourceDigest", "sourceBytesSha256",
      "batchIds", "recordMetadata", "recordCount", "pageSize", "nextCursor",
    ])
    || result.metadata.trust !== "LOCAL_SYNTHETIC"
    || result.metadata.nextCursor !== null
    || !closedId(result.metadata.tenantId)
    || !sha256Hex(result.metadata.sourceDigest)
    || !sha256Hex(result.metadata.sourceBytesSha256)
    || !sha256Hex(result.readbackDigest)
    || result.metadata.recordCount !== result.records.length) {
    return { ok: false, code: "ORDER_SOURCE_READ_UNVERIFIED" };
  }
  const orders = new Map();
  for (const record of result.records) {
    if (!exactKeys(record, ["orderId", "customerId", "orderStatus", "orderDate", "totalMinor", "currency"])
      || !closedId(record.orderId) || !closedId(record.customerId)
      || !ORDER_STATUS.has(record.orderStatus)
      || typeof record.orderDate !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(record.orderDate)
      || !Number.isSafeInteger(record.totalMinor) || record.totalMinor < 0
      || record.currency !== "EUR") {
      return { ok: false, code: "ORDER_SOURCE_FACT_MALFORMED" };
    }
    if (orders.has(record.orderId)) return { ok: false, code: "ORDER_ID_AMBIGUOUS" };
    orders.set(record.orderId, record);
  }
  const readerReadback = sha({
    entity: "orders",
    records: result.records,
    metadata: result.metadata,
  });
  if (readerReadback !== result.readbackDigest) {
    return { ok: false, code: "ORDER_SOURCE_READBACK_MISMATCH" };
  }
  return {
    ok: true,
    code: "OK",
    contentBinding: {
      tenantId: result.metadata.tenantId,
      sourceDigest: result.metadata.sourceDigest,
      sourceBytesSha256: result.metadata.sourceBytesSha256,
      readbackDigest: result.readbackDigest,
    },
  };
}

/** Verify an actual `customers` reader result (LIST_CUSTOMERS READ shape). */
function verifyCustomerRead(result) {
  if (!isRecord(result) || result.outcome !== "READ" || result.entity !== "customers"
    || !Array.isArray(result.records) || !isRecord(result.metadata)
    || result.metadata.trust !== "LOCAL_SYNTHETIC"
    || !closedId(result.metadata.tenantId)
    || !sha256Hex(result.metadata.sourceDigest)
    || !sha256Hex(result.readbackDigest)) {
    return { ok: false, code: "CUSTOMER_SOURCE_READ_UNVERIFIED" };
  }
  const customers = new Map();
  for (const record of result.records) {
    if (!exactKeys(record, ["customerId", "customerStatus"])
      || !closedId(record.customerId)
      || !CUSTOMER_STATUS.has(record.customerStatus)) {
      return { ok: false, code: "CUSTOMER_SOURCE_FACT_MALFORMED" };
    }
    if (customers.has(record.customerId)) return { ok: false, code: "CUSTOMER_ID_AMBIGUOUS" };
    customers.set(record.customerId, record);
  }
  const readerReadback = sha({
    entity: "customers",
    records: result.records,
    metadata: result.metadata,
  });
  if (readerReadback !== result.readbackDigest) {
    return { ok: false, code: "CUSTOMER_SOURCE_READBACK_MISMATCH" };
  }
  return { ok: true, code: "OK", customers, sourceDigest: result.metadata.sourceDigest };
}

function periodOf(orderDate) {
  // Calendar month from the evidenced order date (YYYY-MM). No other period
  // semantics are inferred.
  return { granularity: KS238_PERIOD_GRANULARITY_V1, month: orderDate.slice(0, 7), orderDate };
}

/**
 * Compose the read-only order/source handoff from ACTUAL reader results.
 * `orderRead` is the result of readErpOrdersFromLabelledSourceBytesV1 and
 * `customerRead` the result of the existing LIST_CUSTOMERS adapter. Neither is
 * accepted on a caller label or digest: both are re-verified and re-digested
 * here, so serialization and re-binding survive without treating a
 * caller-resealed substitution as approval.
 */
export function adaptOrderSourceToSalesAnalysis({ orderRead, customerRead }) {
  const orderCheck = verifyOrderSourceRead(orderRead);
  if (!orderCheck.ok) return { outcome: "DENIED", code: orderCheck.code };
  const customerCheck = verifyCustomerRead(customerRead);
  if (!customerCheck.ok) return { outcome: "DENIED", code: customerCheck.code };
  if (orderCheck.contentBinding.tenantId !== customerRead.metadata.tenantId) {
    return { outcome: "DENIED", code: "ORDER_CUSTOMER_TENANT_MISMATCH" };
  }
  if (customerCheck.sourceDigest !== orderCheck.contentBinding.sourceDigest) {
    return { outcome: "DENIED", code: "ORDER_CUSTOMER_SOURCE_MISMATCH" };
  }
  const customers = customerCheck.customers;
  const orders = [];
  for (const record of orderRead.records) {
    const customer = customers.get(record.customerId);
    if (customer === undefined) {
      // The customer referenced by an order is not evidenced by the customer
      // reader. This is an explicit missing fact, never inferred.
      orders.push({
        order: {
          orderId: record.orderId,
          customerId: record.customerId,
          orderStatus: record.orderStatus,
          period: periodOf(record.orderDate),
          quantityUnit: { semantics: KS238_SEMANTICS_V1, quantityMeaning: KS238_QUANTITY_MEANING_V1, unit: KS238_QUANTITY_UNIT_V1 },
        },
        customerStatus: "UNAVAILABLE",
      });
      continue;
    }
    orders.push({
      order: {
        orderId: record.orderId,
        customerId: record.customerId,
        orderStatus: record.orderStatus,
        period: periodOf(record.orderDate),
        quantityUnit: { semantics: KS238_SEMANTICS_V1, quantityMeaning: KS238_QUANTITY_MEANING_V1, unit: KS238_QUANTITY_UNIT_V1 },
      },
      customerStatus: customer.customerStatus,
    });
  }
  const contentBinding = {
    ...orderCheck.contentBinding,
    customerSourceDigest: customerCheck.sourceDigest,
  };
  const supported = {
    orderFacts: orders,
    // Evidence-only aggregates over status. These are NOT revenue: the
    // released order reader proves status counts, not any amount.
    statusCounts: countBy(orders, (entry) => entry.order.orderStatus),
  };
  const binding = {
    schemaVersion: KS238_ORDER_SOURCE_SCHEMA_V1,
    consumerContract: KS238_CONSUMER_CONTRACT_V1,
    trust: "LOCAL_SYNTHETIC",
    supportedFacts: [...KS238_SUPPORTED_FACTS_V1],
    contentBinding,
    supported,
  };
  return {
    outcome: "ADAPTED",
    code: "OK",
    contentBinding,
    supported,
    binding,
    bindingDigest: sha(binding),
    unsupportedFacts: {
      code: "REVENUE_AND_HISTORY_UNAVAILABLE",
      facts: [...KS238_UNSUPPORTED_FACTS_V1],
      missingFields: [...KS238_MISSING_FIELDS_V1],
      nonClaims: [
        "netRevenue is never inferred from orderStatus, ordered quantity, or totalMinor",
        "orderedQuantity is never inferred; the order reader exposes no position quantity",
        "currency/amount value is never inferred from the totalMinor field; no monetary conversion is performed",
        "delivery, historical order-book and order-intake facts remain unavailable",
      ],
    },
  };
}

function countBy(entries, keyOf) {
  const counts = {};
  for (const entry of entries) {
    const key = keyOf(entry);
    counts[key] = (counts[key] ?? 0) + 1;
  }
  return counts;
}

/**
 * Mandatory content-bound re-binding after serialization. A consumer may carry
 * the `binding` + `bindingDigest` in a serialized form; on the receiving side
 * this re-verifies the actual order/customer reader results, re-derives the
 * content binding, and requires an exact match. A caller that reseals or
 * substitutes the digests (or the reader results) fails closed — the re-bound
 * result is only the approval when the reader-derived binding matches.
 */
export function rebindSerializedOrderSource({ orderRead, customerRead, binding, bindingDigest }) {
  const fresh = adaptOrderSourceToSalesAnalysis({ orderRead, customerRead });
  if (fresh.outcome !== "ADAPTED") return { outcome: "DENIED", code: fresh.code };
  if (!isRecord(binding) || !sha256Hex(bindingDigest)) {
    return { outcome: "DENIED", code: "SERIALIZED_BINDING_MALFORMED" };
  }
  if (fresh.bindingDigest !== bindingDigest) {
    return { outcome: "DENIED", code: "SERIALIZED_BINDING_MISMATCH" };
  }
  if (fresh.bindingDigest !== sha(binding)) {
    return { outcome: "DENIED", code: "SERIALIZED_BINDING_MISMATCH" };
  }
  return { outcome: "REBOUND", code: "OK", binding, bindingDigest: fresh.bindingDigest, supported: fresh.supported };
}

/**
 * Public read-only entry point. It owns the actual reader execution: callers
 * provide only the labelled source bytes, the released read contract, and the
 * decision time; a caller-supplied read-result object is never accepted as
 * handoff authority.
 */
export function createKs238OrderSourceHandoff({
  contract,
  sourceBytes,
  sourceLabel = KS238_SOURCE_LABEL_V1,
  enabled = true,
  now,
} = {}) {
  if (contract === undefined || sourceBytes === undefined || typeof now !== "string") {
    return { outcome: "DENIED", code: "ORDER_SOURCE_INPUT_REQUIRED" };
  }
  if (!verifyErpReadConnectorContractV1(contract)) {
    return { outcome: "DENIED", code: "ORDER_SOURCE_CONTRACT_MALFORMED" };
  }
  const orderRead = readErpOrdersFromLabelledSourceBytesV1({
    contract, sourceBytes, sourceLabel, enabled, now,
  });
  if (orderRead.outcome !== "READ") return { outcome: "DENIED", code: orderRead.code };
  // The released reader already validated and decoded the labelled source
  // bytes (malformed bytes fail SOURCE_BYTES_MALFORMED above). Decode again
  // here solely to feed the existing customer adapter the same source.
  const source = decodeSourceBytes(sourceBytes);
  if (source === null) return { outcome: "DENIED", code: "SOURCE_BYTES_MALFORMED" };
  const read = createErpReadAdapterV1({ contract, source, enabled, now });
  const customerRead = read({
    operation: "LIST_CUSTOMERS",
    tenantId: contract.tenantId,
    principalId: contract.identity.principalId,
    scopes: contract.identity.scopes,
    credentialPresent: true,
    fields: contract.fields.customers,
    pageSize: contract.policy.maxPageSize,
  });
  if (customerRead.outcome !== "READ") return { outcome: "DENIED", code: customerRead.code };
  return adaptOrderSourceToSalesAnalysis({ orderRead, customerRead });
}

function decodeSourceBytes(sourceBytes) {
  try {
    const bytes = typeof sourceBytes === "string" ? new TextEncoder().encode(sourceBytes) : new Uint8Array(sourceBytes);
    const text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
    const parsed = JSON.parse(text);
    return isRecord(parsed) && Array.isArray(parsed.batches) ? parsed : null;
  } catch {
    return null;
  }
}
