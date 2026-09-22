import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  adaptOrderSourceToSalesAnalysis,
  createKs238OrderSourceHandoff,
  KS238_CONSUMER_CONTRACT_V1,
  KS238_ORDER_SOURCE_SCHEMA_V1,
  KS238_QUANTITY_MEANING_V1,
  KS238_QUANTITY_UNIT_V1,
  KS238_SEMANTICS_V1,
  KS238_SOURCE_LABEL_V1,
  rebindSerializedOrderSource,
  verifyOrderSourceRead,
} from "../../src/ks238/order-source-handoff.mjs";

// Drive the ACTUAL released readers (no manufactured reader results).
const index = await import("../../dist/packages/contracts/src/index.js");

const root = new URL("../..", import.meta.url).pathname;
const contract = JSON.parse(readFileSync(`${root}tests/fixtures/erp-read/contract-v1.json`, "utf8"));
const sourceBytes = readFileSync(`${root}tests/fixtures/erp-read/supported-export-v1.json`);
const NOW = "2026-08-10T08:30:00Z";
const SOURCE_DIGEST = "01b2e51e8953a24d37462db2b6205e41e03faf6522fbf017338bf495f5007044";

// Independently expected facts, taken directly from the released fixture
// (tests/fixtures/erp-read/supported-export-v1.json), NOT derived from the
// adapter. These are the positive actual-reader composition assertions.
const EXPECTED_ORDERS = [
  { orderId: "order:synthetic-001", customerId: "customer:zoo-001", orderStatus: "FULFILLED", orderDate: "2026-08-01" },
  { orderId: "order:synthetic-002", customerId: "customer:zoo-002", orderStatus: "OPEN", orderDate: "2026-08-05" },
  { orderId: "order:synthetic-003", customerId: "customer:zoo-001", orderStatus: "OPEN", orderDate: "2026-08-08" },
];
const EXPECTED_CUSTOMER_STATUS = { "customer:zoo-001": "ACTIVE", "customer:zoo-002": "ON_HOLD" };

function orderReadFor(c = contract, bytes = sourceBytes, now = NOW) {
  const result = index.readErpOrdersFromLabelledSourceBytesV1({
    contract: c, sourceBytes: bytes, sourceLabel: KS238_SOURCE_LABEL_V1, enabled: true, now,
  });
  if (result.outcome !== "READ") throw new Error(`expected READ, got ${result.code}`);
  return result;
}
function customerReadFor(c = contract, bytes = sourceBytes, now = NOW) {
  const read = index.createErpReadAdapterV1({
    contract: c,
    source: JSON.parse(typeof bytes === "string" ? bytes : bytes.toString("utf8")),
    enabled: true,
    now,
  });
  const result = read({
    operation: "LIST_CUSTOMERS",
    tenantId: c.tenantId,
    principalId: c.identity.principalId,
    scopes: c.identity.scopes,
    credentialPresent: true,
    fields: c.fields.customers,
    pageSize: c.policy.maxPageSize,
  });
  if (result.outcome !== "READ") throw new Error(`expected READ, got ${result.code}`);
  return result;
}
// Re-seal a mutated source so it is a VALID source for the released reader
// (the caller "re-seals" the lineage digest over the substituted content).
// This is exactly the caller-resealed substitution the handoff must reject as
// approval: the reader accepts it, but its content binding differs.
function redigestSource(source) {
  const content = Object.fromEntries(Object.entries(source).filter(([key]) => key !== "lineage"));
  const lineage = Object.fromEntries(Object.entries(source.lineage).filter(([key]) => key !== "sourceDigest"));
  source.lineage.sourceDigest = createHash("sha256").update(index.canonicalJson({ ...content, lineage }), "utf8").digest("hex");
  return source;
}

test("KS238 positive: the actual released order reader composes into bounded supported facts", () => {
  const result = createKs238OrderSourceHandoff({ contract, sourceBytes, sourceLabel: KS238_SOURCE_LABEL_V1, enabled: true, now: NOW });
  assert.equal(result.outcome, "ADAPTED", JSON.stringify(result));
  assert.equal(result.binding.schemaVersion, KS238_ORDER_SOURCE_SCHEMA_V1);
  assert.equal(result.binding.consumerContract, KS238_CONSUMER_CONTRACT_V1);
  assert.equal(result.binding.trust, "LOCAL_SYNTHETIC");
  assert.equal(result.binding.contentBinding.sourceDigest, SOURCE_DIGEST);
  assert.match(result.binding.contentBinding.sourceBytesSha256, /^[a-f0-9]{64}$/);

  // Positive supported order facts, checked against independent expected values.
  assert.equal(result.supported.orderFacts.length, EXPECTED_ORDERS.length);
  result.supported.orderFacts.forEach((fact, indexPosition) => {
    const expected = EXPECTED_ORDERS[indexPosition];
    assert.equal(fact.order.orderId, expected.orderId);
    assert.equal(fact.order.customerId, expected.customerId);
    assert.equal(fact.order.orderStatus, expected.orderStatus);
    assert.equal(fact.order.period.month, expected.orderDate.slice(0, 7));
    assert.equal(fact.order.period.orderDate, expected.orderDate);
    // Customer status is evidenced by the actual customer reader.
    assert.equal(fact.customerStatus, EXPECTED_CUSTOMER_STATUS[expected.customerId]);
    // Quantity is the bounded capability-cell discrete-unit semantic, not an
    // inferred per-order quantity.
    assert.equal(fact.order.quantityUnit.semantics, KS238_SEMANTICS_V1);
    assert.equal(fact.order.quantityUnit.quantityMeaning, KS238_QUANTITY_MEANING_V1);
    assert.equal(fact.order.quantityUnit.unit, KS238_QUANTITY_UNIT_V1);
  });

  // Evidence-only status counts; these are NOT revenue.
  assert.deepEqual(result.supported.statusCounts, { FULFILLED: 1, OPEN: 2 });
});

test("KS238 positive: the handoff binding conforms to the consumer contract schema", async () => {
  const Ajv2020 = (await import("ajv/dist/2020.js")).default;
  const addFormats = (await import("ajv-formats")).default;
  const ajv = new Ajv2020({ strict: true, allErrors: true });
  addFormats(ajv);
  const schema = JSON.parse(readFileSync(`${root}schemas/contracts/ks238-order-source-handoff-v1.schema.json`, "utf8"));
  const validate = ajv.compile(schema);
  const result = createKs238OrderSourceHandoff({ contract, sourceBytes, enabled: true, now: NOW });
  assert.equal(result.outcome, "ADAPTED");
  assert.equal(validate(result.binding), true, JSON.stringify(validate.errors));
  // A binding that smuggles a revenue fact into the supported section is rejected by the contract.
  const widened = JSON.parse(JSON.stringify(result.binding));
  widened.supported.orderFacts[0].order.netRevenue = 42;
  assert.equal(validate(widened), false, "schema must reject an added revenue fact");
});

test("KS238 positive: the composition is a read-only projection and withholds amount/revenue", () => {
  const result = createKs238OrderSourceHandoff({ contract, sourceBytes, enabled: true, now: NOW });
  assert.equal(result.outcome, "ADAPTED");
  // No amount, currency value, or revenue fact is exposed in the supported facts.
  const supportedText = JSON.stringify(result.supported);
  assert.doesNotMatch(supportedText, /netRevenue/);
  assert.doesNotMatch(supportedText, /totalMinor/);
  assert.doesNotMatch(supportedText, /"amount"/);
  // Every supported fact object has exactly the closed key set.
  for (const fact of result.supported.orderFacts) {
    assert.deepEqual(Object.keys(fact).sort(), ["customerStatus", "order"]);
    assert.deepEqual(Object.keys(fact.order).sort(), ["customerId", "orderId", "orderStatus", "period", "quantityUnit"]);
    assert.deepEqual(Object.keys(fact.order.period).sort(), ["granularity", "month", "orderDate"]);
  }
  // Explicit unsupported/missing semantics are present.
  assert.equal(result.unsupportedFacts.code, "REVENUE_AND_HISTORY_UNAVAILABLE");
  assert.ok(result.unsupportedFacts.facts.includes("netRevenue"));
  assert.ok(result.unsupportedFacts.facts.includes("orderedQuantity"));
  assert.ok(result.unsupportedFacts.facts.includes("deliveryFacts"));
  assert.ok(result.unsupportedFacts.missingFields.includes("quantity.orderedQuantity"));
  assert.ok(result.unsupportedFacts.missingFields.includes("history.previousStates"));
  assert.ok(result.unsupportedFacts.nonClaims.some((claim) => claim.includes("never inferred from orderStatus")));
});

test("KS238 serialization: the binding survives a round-trip without a caller re-seal", () => {
  const result = createKs238OrderSourceHandoff({ contract, sourceBytes, enabled: true, now: NOW });
  assert.equal(result.outcome, "ADAPTED");
  // Serialize exactly as a downstream sales analysis would carry it.
  const serialized = {
    binding: JSON.parse(JSON.stringify(result.binding)),
    bindingDigest: result.bindingDigest,
  };
  const rebound = rebindSerializedOrderSource({
    orderRead: orderReadFor(),
    customerRead: customerReadFor(),
    ...serialized,
  });
  assert.equal(rebound.outcome, "REBOUND", JSON.stringify(rebound));
  assert.equal(rebound.bindingDigest, result.bindingDigest);
  assert.deepEqual(rebound.supported.statusCounts, { FULFILLED: 1, OPEN: 2 });
});

test("KS238 negative: a caller-resealed source substitution is not treated as approval", () => {
  const result = createKs238OrderSourceHandoff({ contract, sourceBytes, enabled: true, now: NOW });
  assert.equal(result.outcome, "ADAPTED");
  // The caller carries the original binding digest but reseals a DIFFERENT
  // (substituted) order source. The fresh reader-derived binding differs, so
  // the rebind must fail closed rather than accept the re-sealed substitution.
  const substituted = redigestSource(JSON.parse(sourceBytes.toString("utf8")));
  substituted.batches.find((b) => b.entity === "orders").records[0].facts.orderStatus = "CANCELLED";
  redigestSource(substituted);
  const substitutedBytes = JSON.stringify(substituted);
  // Both readers consume the SAME re-sealed (substituted) source, so tenant
  // and source-digest still agree; the order content differs, so the fresh
  // reader-derived binding no longer matches the carried binding digest.
  const rebound = rebindSerializedOrderSource({
    orderRead: orderReadFor(contract, substitutedBytes),
    customerRead: customerReadFor(contract, substitutedBytes),
    binding: result.binding,
    bindingDigest: result.bindingDigest,
  });
  assert.equal(rebound.outcome, "DENIED");
  assert.equal(rebound.code, "SERIALIZED_BINDING_MISMATCH");
});

test("KS238 negative: a tampered serialized binding digest fails closed", () => {
  const result = createKs238OrderSourceHandoff({ contract, sourceBytes, enabled: true, now: NOW });
  assert.equal(result.outcome, "ADAPTED");
  const rebound = rebindSerializedOrderSource({
    orderRead: orderReadFor(),
    customerRead: customerReadFor(),
    binding: result.binding,
    bindingDigest: "0".repeat(64),
  });
  assert.deepEqual(rebound, { outcome: "DENIED", code: "SERIALIZED_BINDING_MISMATCH" });
});

test("KS238 negative: wrong source label and disabled connector are denied before composition", () => {
  assert.deepEqual(createKs238OrderSourceHandoff({ contract, sourceBytes, sourceLabel: "PROVIDER_ATTESTED", enabled: true, now: NOW }), { outcome: "DENIED", code: "SOURCE_LABEL_DENIED" });
  assert.deepEqual(createKs238OrderSourceHandoff({ contract, sourceBytes, enabled: false, now: NOW }), { outcome: "DENIED", code: "CONNECTOR_DISABLED" });
});

test("KS238 negative: stale decision time and malformed contract/bytes fail closed", () => {
  assert.deepEqual(createKs238OrderSourceHandoff({ contract, sourceBytes, enabled: true, now: "2026-08-10T09:00:01Z" }), { outcome: "DENIED", code: "SOURCE_STALE" });
  assert.deepEqual(createKs238OrderSourceHandoff({ contract: { ...contract, contractDigest: "f".repeat(64) }, sourceBytes, enabled: true, now: NOW }), { outcome: "DENIED", code: "ORDER_SOURCE_CONTRACT_MALFORMED" });
  assert.deepEqual(createKs238OrderSourceHandoff({ contract, sourceBytes: "{not-json", enabled: true, now: NOW }), { outcome: "DENIED", code: "SOURCE_BYTES_MALFORMED" });
});

test("KS238 negative: a wrong-identity reader result is never widened into a supported fact", () => {
  const orderRead = orderReadFor();
  const customerRead = customerReadFor();
  // Swap an order's customer to a wrong identity: the reader's own content
  // digest no longer matches the records, so the composition is denied.
  const wrongIdentity = JSON.parse(JSON.stringify(orderRead));
  wrongIdentity.records[0].customerId = "customer:zoo-002";
  assert.equal(adaptOrderSourceToSalesAnalysis({ orderRead: wrongIdentity, customerRead }).code, "ORDER_SOURCE_READBACK_MISMATCH");
  // An order referencing a customer absent from the customer reader: the
  // reader content digest no longer matches, denied at the boundary. The
  // missing customer is never inferred into a supported fact.
  const missingCustomer = JSON.parse(JSON.stringify(orderRead));
  missingCustomer.records[0].customerId = "customer:zoo-999";
  assert.equal(adaptOrderSourceToSalesAnalysis({ orderRead: missingCustomer, customerRead }).outcome, "DENIED");
});

test("KS238 negative: a wrong quantity/unit semantic is not manufactured from the reader", () => {
  const orderRead = orderReadFor();
  const customerRead = customerReadFor();
  // The reader result has no per-order quantity; a caller cannot manufacture
  // one. A record with an invented quantity field is malformed.
  const withQuantity = JSON.parse(JSON.stringify(orderRead));
  withQuantity.records[0].quantity = 5;
  assert.equal(verifyOrderSourceRead(withQuantity).code, "ORDER_SOURCE_FACT_MALFORMED");
  const withWrongUnit = JSON.parse(JSON.stringify(orderRead));
  // totalMinor is a released reader field; changing its value breaks the
  // reader readback digest -> denied, so amount value cannot be re-asserted.
  withWrongUnit.records[0].totalMinor = 1;
  assert.equal(verifyOrderSourceRead(withWrongUnit).code, "ORDER_SOURCE_READBACK_MISMATCH");
  assert.equal(adaptOrderSourceToSalesAnalysis({ orderRead, customerRead }).outcome, "ADAPTED");
});

test("KS238 negative: an unverified reader result is denied at the boundary", () => {
  // A caller-supplied object that is not a real reader result is rejected.
  assert.equal(verifyOrderSourceRead({ outcome: "READ", entity: "orders", records: [], metadata: {} }).code, "ORDER_SOURCE_READ_UNVERIFIED");
  // A non-READ reader result is rejected.
  assert.equal(verifyOrderSourceRead({ outcome: "DENIED", code: "SOURCE_STALE" }).code, "ORDER_SOURCE_READ_UNVERIFIED");
  // Changing status without changing the digest -> readback mismatch.
  const orderRead = orderReadFor();
  const customerRead = customerReadFor();
  const tampered = JSON.parse(JSON.stringify(orderRead));
  tampered.records[1].orderStatus = "CANCELLED";
  assert.equal(verifyOrderSourceRead(tampered).code, "ORDER_SOURCE_READBACK_MISMATCH");
  // The untouched reader results still verify and adapt.
  assert.equal(verifyOrderSourceRead(orderRead).ok, true);
  assert.equal(adaptOrderSourceToSalesAnalysis({ orderRead, customerRead }).outcome, "ADAPTED");
});

test("KS238 negative: a wrong-tenant customer reader is denied, never composed", () => {
  const orderRead = orderReadFor();
  const customerRead = customerReadFor();
  const wrongTenant = JSON.parse(JSON.stringify(customerRead));
  wrongTenant.metadata.tenantId = "tenant:other";
  // Changing the customer reader's tenant breaks its own readback digest.
  assert.equal(adaptOrderSourceToSalesAnalysis({ orderRead, customerRead: wrongTenant }).outcome, "DENIED");
});
