import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  KS238_CONSUMER_CONTRACT_V1,
  KS238_MISSING_FIELDS_V1,
  KS238_ORDER_SOURCE_SCHEMA_V1,
  KS238_SEMANTICS_V1,
  KS238_SOURCE_LABEL_V1,
  KS238_SUPPORTED_FACTS_V1,
  KS238_UNSUPPORTED_FACTS_V1,
  adaptOrderSourceToSalesAnalysis,
  createKs238OrderSourceHandoff,
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
const sha256Hex = (value) => createHash("sha256").update(value).digest("hex");

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
function customerReadAdapterFor(c = contract, bytes = sourceBytes, now = NOW) {
  return index.createErpReadAdapterV1({
    contract: c,
    source: JSON.parse(typeof bytes === "string" ? bytes : bytes.toString("utf8")),
    enabled: true,
    now,
  });
}
function customerRequestFor(c = contract) {
  return {
    operation: "LIST_CUSTOMERS",
    tenantId: c.tenantId,
    principalId: c.identity.principalId,
    scopes: c.identity.scopes,
    credentialPresent: true,
    fields: c.fields.customers,
    pageSize: c.policy.maxPageSize,
  };
}
// Execute the actual customer reader and drain it across pages by cursor —
// the same bounded drain the handoff performs.
function customerPagesFor(c = contract, bytes = sourceBytes, now = NOW) {
  const read = customerReadAdapterFor(c, bytes, now);
  const request = customerRequestFor(c);
  const pages = [];
  let cursor = null;
  for (let page = 0; page < 128; page += 1) {
    const result = read(cursor === null ? { ...request } : { ...request, cursor });
    if (result.outcome !== "READ") throw new Error(`expected READ, got ${result.code}`);
    pages.push(result);
    cursor = result.metadata.nextCursor;
    if (cursor === null) break;
  }
  if (cursor !== null) throw new Error("customer drain did not terminate");
  return pages;
}
// Serialize exactly as the documented downstream consumer carries it: the
// binding + bindingDigest plus the independently retained identity — source
// label, source bytes, their sha256, the released contract and the decision
// time — OUTSIDE the substituted payload.
function rebindOf(result, c = contract, bytes = sourceBytes, now = NOW) {
  return rebindSerializedOrderSource({
    sourceLabel: KS238_SOURCE_LABEL_V1,
    sourceBytes: bytes,
    sourceBytesSha256: sha256Hex(bytes),
    contract: c,
    now,
    binding: JSON.parse(JSON.stringify(result.binding)),
    bindingDigest: result.bindingDigest,
  });
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
  // The supported fact set is closed and does NOT claim a quantity-unit fact:
  // the selected source and the released reader expose no quantity or unit.
  assert.deepEqual(result.binding.supportedFacts, KS238_SUPPORTED_FACTS_V1);
  assert.ok(!result.binding.supportedFacts.includes("quantityUnit"));

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
    // Quantity and unit are explicitly UNAVAILABLE for this reader; a unitless
    // reader result never becomes a per-order EACH fact.
    assert.deepEqual(fact.order.quantityUnit, { quantity: "UNAVAILABLE", unit: "UNAVAILABLE" });
  });

  // Evidence-only status counts; these are NOT revenue.
  assert.deepEqual(result.supported.statusCounts, { FULFILLED: 1, OPEN: 2 });
});

test("KS238 positive: the customer reader is drained across pages and a third customer on page two is joined", () => {
  // Independently expected: add a third ACTIVE customer (customer:zoo-003) to
  // the released fixture, point the third order at it, re-seal the lineage.
  // The fixture customer batch (2 records, page size 2) spans exactly two
  // pages, so this positive exercises the cursor drain end to end.
  const paged = JSON.parse(sourceBytes.toString("utf8"));
  paged.batches.find((b) => b.entity === "customers").records.push({
    recordMetadata: { sourceRecordId: "erp-record:customer-003", sourceUpdatedAt: "2026-08-10T07:42:00Z", lineageSequence: 3 },
    facts: { customerId: "customer:zoo-003", customerStatus: "ACTIVE" },
  });
  paged.batches.find((b) => b.entity === "orders").records[2].facts.customerId = "customer:zoo-003";
  const pagedBytes = JSON.stringify(redigestSource(paged));

  // Independent check of the raw reader: the cursor drain of the actual
  // customer reader returns the third customer on its second page.
  const read = customerReadAdapterFor(contract, pagedBytes);
  const first = read(customerRequestFor(contract));
  assert.equal(first.outcome, "READ");
  assert.notEqual(first.metadata.nextCursor, null, "fixture must actually span two customer pages");
  const second = read({ ...customerRequestFor(contract), cursor: first.metadata.nextCursor });
  assert.equal(second.outcome, "READ");
  assert.deepEqual(second.records, [{ customerId: "customer:zoo-003", customerStatus: "ACTIVE" }]);
  assert.equal(second.metadata.nextCursor, null);

  const result = createKs238OrderSourceHandoff({ contract, sourceBytes: pagedBytes, now: NOW });
  assert.equal(result.outcome, "ADAPTED", JSON.stringify(result));
  // All three orders are evidenced, including the one whose customer only
  // exists on the second customer page. No page is left unread and no unread
  // page is labelled a missing customer fact.
  assert.equal(result.supported.orderFacts.length, 3);
  assert.equal(result.supported.orderFacts[0].customerStatus, "ACTIVE");
  assert.equal(result.supported.orderFacts[1].customerStatus, "ON_HOLD");
  assert.equal(result.supported.orderFacts[2].customerStatus, "ACTIVE");
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
  // The explicit unsupported/missing semantics travel inside the binding.
  // A binding that smuggles a revenue fact into the supported section is rejected by the contract.
  const widened = JSON.parse(JSON.stringify(result.binding));
  widened.supported.orderFacts[0].order.netRevenue = 42;
  assert.equal(validate(widened), false, "schema must reject an added revenue fact");
  // A binding without the closed unsupported/missing contract is rejected.
  const withoutSemantics = JSON.parse(JSON.stringify(result.binding));
  delete withoutSemantics.unsupportedFacts;
  assert.equal(validate(withoutSemantics), false, "schema must require the unsupported/missing contract");
});

test("KS238 positive: the composition is a read-only projection and withholds amount/revenue/quantity", () => {
  const result = createKs238OrderSourceHandoff({ contract, sourceBytes, enabled: true, now: NOW });
  assert.equal(result.outcome, "ADAPTED");
  // No amount, currency value, revenue or per-order quantity fact is exposed
  // in the supported facts.
  const supportedText = JSON.stringify(result.supported);
  assert.doesNotMatch(supportedText, /netRevenue/);
  assert.doesNotMatch(supportedText, /totalMinor/);
  assert.doesNotMatch(supportedText, /"amount"/);
  assert.doesNotMatch(supportedText, /"orderedQuantity"/);
  assert.doesNotMatch(supportedText, /"EACH"/);
  // Every supported fact object has exactly the closed key set.
  for (const fact of result.supported.orderFacts) {
    assert.deepEqual(Object.keys(fact).sort(), ["customerStatus", "order"]);
    assert.deepEqual(Object.keys(fact.order).sort(), ["customerId", "orderId", "orderStatus", "period", "quantityUnit"]);
    assert.deepEqual(Object.keys(fact.order.period).sort(), ["granularity", "month", "orderDate"]);
    // Unitless reader results never become per-order EACH facts.
    assert.equal(fact.order.quantityUnit.quantity, "UNAVAILABLE");
    assert.equal(fact.order.quantityUnit.unit, "UNAVAILABLE");
  }
  // Explicit unsupported/missing semantics are present, closed, and identical
  // to the binding-embedded contract.
  assert.equal(result.unsupportedFacts.code, "REVENUE_AND_HISTORY_UNAVAILABLE");
  assert.deepEqual(result.unsupportedFacts.facts, KS238_UNSUPPORTED_FACTS_V1);
  assert.ok(result.unsupportedFacts.facts.includes("netRevenue"));
  assert.ok(result.unsupportedFacts.facts.includes("orderedQuantity"));
  assert.ok(result.unsupportedFacts.facts.includes("quantityUnit"));
  assert.ok(result.unsupportedFacts.facts.includes("deliveryFacts"));
  assert.deepEqual(result.unsupportedFacts.missingFields, KS238_MISSING_FIELDS_V1);
  assert.ok(result.unsupportedFacts.missingFields.includes("quantity.orderedQuantity"));
  assert.ok(result.unsupportedFacts.missingFields.includes("quantity.unit"));
  assert.ok(result.unsupportedFacts.missingFields.includes("history.previousStates"));
  assert.ok(result.unsupportedFacts.nonClaims.some((claim) => claim.includes("never inferred from orderStatus")));
  assert.deepEqual(result.unsupportedFacts, result.binding.unsupportedFacts);
});

test("KS238 positive: the explicit unsupported/missing semantics survive the serialization round-trip unchanged", () => {
  const result = createKs238OrderSourceHandoff({ contract, sourceBytes, enabled: true, now: NOW });
  assert.equal(result.outcome, "ADAPTED");
  // Serialize exactly as a downstream sales analysis would carry it: the
  // binding (which now embeds the semantics) plus its digest, with the
  // independently retained source identity outside the payload.
  const rebound = rebindOf(result);
  assert.equal(rebound.outcome, "REBOUND", JSON.stringify(rebound));
  assert.equal(rebound.bindingDigest, result.bindingDigest);
  assert.deepEqual(rebound.supported.statusCounts, { FULFILLED: 1, OPEN: 2 });
  // The explicit missing-history/missing-quantity contract is preserved across
  // the round-trip: equality of the facts, not just status counts.
  assert.ok(rebound.unsupportedFacts !== undefined, "rebind must return the unsupported/missing contract");
  assert.deepEqual(rebound.unsupportedFacts, result.unsupportedFacts);
  assert.deepEqual(rebound.unsupportedFacts, JSON.parse(JSON.stringify(result.binding)).unsupportedFacts);
  assert.ok(rebound.unsupportedFacts.missingFields.includes("history.previousStates"));
  assert.ok(rebound.unsupportedFacts.nonClaims.some((claim) => claim.includes("quantityUnit is UNAVAILABLE")));
});

test("KS238 negative: a caller-rehashed forged reader result is never authority", () => {
  // Finding counterexample A: take the ACTUAL reader results, forge the first
  // order's customerId (zoo-001 -> zoo-002) and status (FULFILLED ->
  // CANCELLED), and rehash the caller-owned readback digest to make the
  // forged records self-consistent. Raw caller-rehashed facts must not be
  // accepted as rebind authority.
  const forged = customerPagesFor();
  const orderRead = orderReadFor();
  orderRead.records[0].customerId = "customer:zoo-002";
  orderRead.records[0].orderStatus = "CANCELLED";
  orderRead.readbackDigest = createHash("sha256")
    .update(index.canonicalJson({ entity: "orders", records: orderRead.records, metadata: orderRead.metadata }), "utf8")
    .digest("hex");
  // The raw forged projection may still verify internally (shape + self hash)
  // — that is precisely why it is non-authoritative and must never be fed to
  // the rebind boundary.
  const internal = adaptOrderSourceToSalesAnalysis({ orderRead, customerRead: forged });
  assert.equal(internal.outcome, "ADAPTED");
  // The rebind boundary re-executes the released readers against the
  // independently retained source bytes/contract/time. The forged projection
  // cannot re-establish the source identity, so the genuine binding is
  // REBOUND and still reports the true first order — the forged CANCELLED /
  // zoo-002 facts never surface.
  const positive = createKs238OrderSourceHandoff({ contract, sourceBytes, now: NOW });
  const rebound = rebindOf(positive);
  assert.equal(rebound.outcome, "REBOUND");
  assert.equal(rebound.supported.orderFacts[0].order.orderStatus, "FULFILLED");
  assert.equal(rebound.supported.orderFacts[0].order.customerId, "customer:zoo-001");
  // And the raw forged projection, carried as a caller binding against the
  // genuine source identity, fails closed with the exact code.
  const forgedAsCarried = rebindSerializedOrderSource({
    sourceLabel: KS238_SOURCE_LABEL_V1,
    sourceBytes,
    sourceBytesSha256: sha256Hex(sourceBytes),
    contract,
    now: NOW,
    binding: internal.binding,
    bindingDigest: internal.bindingDigest,
  });
  assert.deepEqual(forgedAsCarried, { outcome: "DENIED", code: "SERIALIZED_BINDING_MISMATCH" });
});

test("KS238 negative: a resealed source plus its matching binding substitution is denied against the retained source", () => {
  // Finding counterexample B: change the actual synthetic source's first order
  // to CANCELLED, recompute its real lineage digest, execute both actual
  // readers and the public creator on those bytes, and substitute BOTH the
  // serialized binding and its digest. The retained identity is the ORIGINAL
  // source identity carried outside the payload.
  const positive = createKs238OrderSourceHandoff({ contract, sourceBytes, now: NOW });
  const substituted = redigestSource(JSON.parse(sourceBytes.toString("utf8")));
  substituted.batches.find((b) => b.entity === "orders").records[0].facts.orderStatus = "CANCELLED";
  const substitutedBytes = JSON.stringify(redigestSource(substituted));
  const substitutedPositive = createKs238OrderSourceHandoff({ contract, sourceBytes: substitutedBytes, now: NOW });
  assert.equal(substitutedPositive.outcome, "ADAPTED");

  // Substituting the new binding AND its new digest against the original
  // retained source bytes is a source-plus-binding substitution, not approval.
  const substitutedRebind = rebindSerializedOrderSource({
    sourceLabel: KS238_SOURCE_LABEL_V1,
    sourceBytes,
    sourceBytesSha256: sha256Hex(sourceBytes),
    contract,
    now: NOW,
    binding: substitutedPositive.binding,
    bindingDigest: substitutedPositive.bindingDigest,
  });
  assert.deepEqual(substitutedRebind, { outcome: "DENIED", code: "SERIALIZED_BINDING_MISMATCH" });
  // Carrying the original binding against the substituted bytes is denied too.
  const swappedBytes = rebindSerializedOrderSource({
    sourceLabel: KS238_SOURCE_LABEL_V1,
    sourceBytes: substitutedBytes,
    sourceBytesSha256: sha256Hex(substitutedBytes),
    contract,
    now: NOW,
    binding: positive.binding,
    bindingDigest: positive.bindingDigest,
  });
  assert.deepEqual(swappedBytes, { outcome: "DENIED", code: "SERIALIZED_BINDING_MISMATCH" });
  // The genuine rebind against the original retained source stays a positive.
  const genuine = rebindOf(positive);
  assert.equal(genuine.outcome, "REBOUND");
  assert.equal(genuine.supported.orderFacts[0].order.orderStatus, "FULFILLED");
});

test("KS238 negative: a tampered serialized binding or source identity fails closed with the exact code", () => {
  const result = createKs238OrderSourceHandoff({ contract, sourceBytes, enabled: true, now: NOW });
  assert.equal(result.outcome, "ADAPTED");
  // Tampered binding digest.
  assert.deepEqual(rebindSerializedOrderSource({
    sourceLabel: KS238_SOURCE_LABEL_V1,
    sourceBytes,
    sourceBytesSha256: sha256Hex(sourceBytes),
    contract,
    now: NOW,
    binding: result.binding,
    bindingDigest: "0".repeat(64),
  }), { outcome: "DENIED", code: "SERIALIZED_BINDING_MISMATCH" });
  // Binding whose digest no longer matches its own content.
  const tamperedBinding = JSON.parse(JSON.stringify(result.binding));
  tamperedBinding.contentBinding.sourceDigest = "f".repeat(64);
  assert.deepEqual(rebindSerializedOrderSource({
    sourceLabel: KS238_SOURCE_LABEL_V1,
    sourceBytes,
    sourceBytesSha256: sha256Hex(sourceBytes),
    contract,
    now: NOW,
    binding: tamperedBinding,
    bindingDigest: result.bindingDigest,
  }), { outcome: "DENIED", code: "SERIALIZED_BINDING_MISMATCH" });
  // Retained source sha256 that does not match the carried source bytes.
  assert.deepEqual(rebindSerializedOrderSource({
    sourceLabel: KS238_SOURCE_LABEL_V1,
    sourceBytes,
    sourceBytesSha256: "0".repeat(64),
    contract,
    now: NOW,
    binding: result.binding,
    bindingDigest: result.bindingDigest,
  }), { outcome: "DENIED", code: "SOURCE_BYTES_MISMATCH" });
  // Missing rebind identity is denied before any reader execution.
  assert.deepEqual(rebindSerializedOrderSource({
    sourceLabel: KS238_SOURCE_LABEL_V1,
    sourceBytes,
    contract,
    now: NOW,
    binding: result.binding,
    bindingDigest: result.bindingDigest,
  }), { outcome: "DENIED", code: "REBIND_INPUT_REQUIRED" });
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
  const customerRead = customerPagesFor();
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
  assert.equal(adaptOrderSourceToSalesAnalysis({ orderRead: missingCustomer, customerRead }).code, "ORDER_SOURCE_READBACK_MISMATCH");
});

test("KS238 negative: a wrong quantity/unit semantic is not manufactured from the unitless reader", () => {
  // The released reader exposes exactly these order facts: no quantity, no
  // unit. A unitless reader result never becomes a per-order EACH fact.
  const orderRead = orderReadFor();
  assert.deepEqual(Object.keys(orderRead.records[0]).sort(), ["currency", "customerId", "orderDate", "orderId", "orderStatus", "totalMinor"]);
  const result = createKs238OrderSourceHandoff({ contract, sourceBytes, enabled: true, now: NOW });
  assert.equal(result.outcome, "ADAPTED");
  for (const fact of result.supported.orderFacts) {
    assert.equal(fact.order.quantityUnit.unit, "UNAVAILABLE");
    assert.notEqual(fact.order.quantityUnit.unit, "EACH");
  }
  // A source that invents a quantity field is denied by the released reader
  // (unknownFieldsAllowed: false), never projected.
  const withQuantitySource = redigestSource(JSON.parse(sourceBytes.toString("utf8")));
  withQuantitySource.batches.find((b) => b.entity === "orders").records[0].facts.quantity = 5;
  assert.deepEqual(createKs238OrderSourceHandoff({ contract, sourceBytes: JSON.stringify(withQuantitySource), now: NOW }), { outcome: "DENIED", code: "SOURCE_MALFORMED" });
  // A source that adds a unit (KG) is likewise denied by the released reader.
  const withWrongUnitSource = redigestSource(JSON.parse(sourceBytes.toString("utf8")));
  withWrongUnitSource.batches.find((b) => b.entity === "orders").records[0].facts.unit = "KG";
  assert.deepEqual(createKs238OrderSourceHandoff({ contract, sourceBytes: JSON.stringify(withWrongUnitSource), now: NOW }), { outcome: "DENIED", code: "SOURCE_MALFORMED" });
  // A caller-manufactured quantity field on a reader record is malformed.
  const withReaderQuantity = JSON.parse(JSON.stringify(orderRead));
  withReaderQuantity.records[0].quantity = 5;
  assert.equal(verifyOrderSourceRead(withReaderQuantity).code, "ORDER_SOURCE_FACT_MALFORMED");
  // Changing totalMinor without resealing breaks the reader readback digest:
  // amount value cannot be re-asserted either.
  const withChangedAmount = JSON.parse(JSON.stringify(orderRead));
  withChangedAmount.records[0].totalMinor = 1;
  assert.equal(verifyOrderSourceRead(withChangedAmount).code, "ORDER_SOURCE_READBACK_MISMATCH");
  // The unchanged unitless source still adapts.
  const customerRead = customerPagesFor();
  assert.equal(adaptOrderSourceToSalesAnalysis({ orderRead, customerRead }).outcome, "ADAPTED");
});

test("KS238 negative: an unverified reader result is denied at the boundary", () => {
  // A caller-supplied object that is not a real reader result is rejected.
  assert.equal(verifyOrderSourceRead({ outcome: "READ", entity: "orders", records: [], metadata: {} }).code, "ORDER_SOURCE_READ_UNVERIFIED");
  // A non-READ reader result is rejected.
  assert.equal(verifyOrderSourceRead({ outcome: "DENIED", code: "SOURCE_STALE" }).code, "ORDER_SOURCE_READ_UNVERIFIED");
  // Changing status without changing the digest -> readback mismatch.
  const orderRead = orderReadFor();
  const customerRead = customerPagesFor();
  const tampered = JSON.parse(JSON.stringify(orderRead));
  tampered.records[1].orderStatus = "CANCELLED";
  assert.equal(verifyOrderSourceRead(tampered).code, "ORDER_SOURCE_READBACK_MISMATCH");
  // The untouched reader results still verify and adapt.
  assert.equal(verifyOrderSourceRead(orderRead).ok, true);
  assert.equal(adaptOrderSourceToSalesAnalysis({ orderRead, customerRead }).outcome, "ADAPTED");
});

test("KS238 negative: a wrong-tenant customer reader is denied, never composed", () => {
  const orderRead = orderReadFor();
  const customerRead = customerPagesFor();
  const wrongTenant = JSON.parse(JSON.stringify(customerRead));
  wrongTenant[0].metadata.tenantId = "tenant:other";
  // Changing the customer reader's tenant breaks its own readback digest.
  assert.equal(adaptOrderSourceToSalesAnalysis({ orderRead, customerRead: wrongTenant }).outcome, "DENIED");
  assert.equal(adaptOrderSourceToSalesAnalysis({ orderRead, customerRead: wrongTenant }).code, "CUSTOMER_SOURCE_READBACK_MISMATCH");
});

test("KS238 negative: a wrong-tenant source and an unsupported/invented status are denied by the released reader", () => {
  // Wrong tenant end to end (public entry point): the released reader denies
  // before any composition (the tenant must change before the source is
  // re-sealed so the lineage digest still validates the resealed content).
  const wrongTenantSource = JSON.parse(sourceBytes.toString("utf8"));
  wrongTenantSource.tenantId = "tenant:other";
  assert.deepEqual(createKs238OrderSourceHandoff({ contract, sourceBytes: JSON.stringify(redigestSource(wrongTenantSource)), now: NOW }), { outcome: "DENIED", code: "TENANT_MISMATCH" });
  // Unsupported order status: the released reader denies the malformed source.
  const unknownStatusSource = JSON.parse(sourceBytes.toString("utf8"));
  unknownStatusSource.batches.find((b) => b.entity === "orders").records[0].facts.orderStatus = "UNKNOWN";
  assert.deepEqual(createKs238OrderSourceHandoff({ contract, sourceBytes: JSON.stringify(unknownStatusSource), now: NOW }), { outcome: "DENIED", code: "SOURCE_MALFORMED" });
});
