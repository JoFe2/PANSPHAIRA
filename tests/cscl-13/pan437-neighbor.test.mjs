import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync, mkdtempSync, rmSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import test from "node:test";
import Ajv2020 from "ajv/dist/2020.js";
import addFormats from "ajv-formats";

import { adaptDeliveryPositionToComplaintReferences, adaptErpReadToComplaintInput, createPan437ComplaintCli, PAN437_MISSING_DELIVERY_CODE, PAN437_ORDER_SOURCE_LABEL_V1 } from "../../src/cscl-13/pan437-neighbor.mjs";
import { canonicalJson } from "../../src/cscl-13/complaint.mjs";
import { createHash } from "node:crypto";

const root = resolve(import.meta.dirname, "../..");
const refsPath = resolve(root, "tests/fixtures/cscl-13/delivery-references-v1.json");
const orderSourcePath = resolve(root, "tests/fixtures/erp-read/supported-export-v1.json");
const orderContractPath = resolve(root, "tests/fixtures/erp-read/contract-v1.json");
const cli = resolve(root, "src/cscl-13/complaint-cli.mjs");

test("the proposed hand-off schema is syntactically valid and does not assert a current delivery", () => {
  const schema = JSON.parse(readFileSync(resolve(root, "contracts/cscl-13/pan437-neighbor-v1.schema.json"), "utf8"));
  const ajv = new Ajv2020({ strict: true });
  addFormats(ajv);
  assert.doesNotThrow(() => ajv.compile(schema));
  assert.equal(schema.description.includes("not a delivery confirmation"), true);
});
const call = (operation, value, state) => {
  const command = operation === "SELECT" ? ["select", value.positionId, value.customerId]
    : operation === "RAISE" ? ["raise", value.positionId, value.customerId, value.reason, String(value.quantity), value.traceId]
      : operation === "DECIDE" ? ["decide", value.complaintId, value.decision, value.actorId]
        : ["read", value.complaintId];
  return JSON.parse(execFileSync(process.execPath, [cli, "--references", refsPath, ...(state ? ["--store", state] : []), ...command], { cwd: root, encoding: "utf8" }));
};

test("existing ERP order read output is not widened into a delivery reference", () => {
  const result = adaptErpReadToComplaintInput({
    outcome: "READ", entity: "orders", records: [{ orderId: "order:synthetic-001", customerId: "customer:zoo-001", orderStatus: "FULFILLED", orderDate: "2026-08-01", totalMinor: 4200000, currency: "EUR" }],
  });
  assert.equal(result.outcome, "DENIED");
  assert.equal(result.code, PAN437_MISSING_DELIVERY_CODE);
  assert.deepEqual(result.missingFields, ["delivery.deliveryId", "delivery.deliveredAt", "position.positionId", "position.articleId", "position.articleName", "position.quantity", "position.unit"]);
  assert.equal(adaptErpReadToComplaintInput({ outcome: "READ", entity: "invoices" }).code, PAN437_MISSING_DELIVERY_CODE);
});

test("future hand-off requires the proposed contract and rejects an invented/partial payload", () => {
  assert.deepEqual(adaptDeliveryPositionToComplaintReferences({}), { outcome: "DENIED", code: "DELIVERY_POSITION_INPUT_MALFORMED" });
  assert.deepEqual(adaptDeliveryPositionToComplaintReferences({ schemaVersion: "pansphaira.cscl13/delivery-position-input/v1", status: "READ_DELIVERY_POSITION" }), { outcome: "DENIED", code: "DELIVERY_POSITION_INPUT_MALFORMED" });
});

test("separate CLI calls use the existing ledger for select, partial complaint, decision and persisted history", () => {
  const directory = mkdtempSync(resolve(tmpdir(), "pan437-neighbor-"));
  const state = resolve(directory, "state.json");
  try {
    assert.equal(call("SELECT", { positionId: "pos:dlv-001-1", customerId: "customer:zoo-001" }).outcome, "SELECTED");
    const raised = call("RAISE", { positionId: "pos:dlv-001-1", customerId: "customer:zoo-001", reason: "QUANTITY_SHORTAGE", quantity: 3, traceId: "trace-cli-001" }, state);
    assert.equal(raised.outcome, "RAISED");
    const decided = call("DECIDE", { complaintId: raised.complaintId, decision: "REPLACE", actorId: "actor:claims-01" }, state);
    assert.equal(decided.outcome, "DECIDED");
    const read = call("READBACK", { complaintId: raised.complaintId }, state);
    assert.equal(read.outcome, "READ");
    assert.equal(read.complaint.deliveredQuantity, 10);
    assert.equal(read.history.length, 2);
    assert.match(read.readbackDigest, /^[a-f0-9]{64}$/);
    assert.deepEqual(call("RAISE", { positionId: "pos:dlv-001-1", customerId: "customer:zoo-001", reason: "QUANTITY_SHORTAGE", quantity: 1, traceId: "trace-cli-002" }, state), { outcome: "DENIED", code: "DUPLICATE_COMPLAINT" });
  } finally { rmSync(directory, { recursive: true, force: true }); }
});

test("CLI negative paths stay on the actual entry point", () => {
  const directory = mkdtempSync(resolve(tmpdir(), "pan437-neighbor-negative-"));
  const state = resolve(directory, "state.json");
  try {
    assert.deepEqual(call("SELECT", { positionId: "pos:unknown", customerId: "customer:zoo-001" }), { outcome: "DENIED", code: "POSITION_NOT_FOUND" });
    assert.deepEqual(call("RAISE", { positionId: "pos:dlv-001-1", customerId: "customer:zoo-002", reason: "DAMAGED_GOODS", quantity: 1, traceId: "trace-cli-003" }, state), { outcome: "DENIED", code: "DELIVERY_REFERENCE_MISMATCH" });
    assert.deepEqual(call("RAISE", { positionId: "pos:dlv-001-1", customerId: "customer:zoo-001", reason: "DAMAGED_GOODS", quantity: 11, traceId: "trace-cli-004" }, state), { outcome: "DENIED", code: "QUANTITY_EXCEEDS_DELIVERED" });
  } finally { rmSync(directory, { recursive: true, force: true }); }
});


test("the actual ERP order reader consumes labelled source bytes and returns only order/customer evidence", async () => {
  const { readErpOrdersFromLabelledSourceBytesV1 } = await import("../../dist/packages/contracts/src/index.js");
  const read = readErpOrdersFromLabelledSourceBytesV1({
    contract: JSON.parse(readFileSync(orderContractPath, "utf8")),
    sourceBytes: readFileSync(orderSourcePath),
    sourceLabel: "LOCAL_SYNTHETIC_ERP_ORDER_SOURCE_V1",
    enabled: true,
    now: "2026-08-10T08:30:00Z",
  });
  assert.equal(read.outcome, "READ");
  if (read.outcome === "READ") {
    assert.equal(read.records.length, 3);
    assert.deepEqual(read.records[0], {
      orderId: "order:synthetic-001", customerId: "customer:zoo-001", orderStatus: "FULFILLED",
      orderDate: "2026-08-01", totalMinor: 4200000, currency: "EUR",
    });
    assert.equal(read.metadata.sourceDigest, "01b2e51e8953a24d37462db2b6205e41e03faf6522fbf017338bf495f5007044");
    assert.match(read.metadata.sourceBytesSha256, /^[a-f0-9]{64}$/);
  }
});

test("the labelled reader boundary rejects unlabelled bytes and binds only matching source identity", async () => {
  const { readErpOrdersFromLabelledSourceBytesV1 } = await import("../../dist/packages/contracts/src/index.js");
  const contract = JSON.parse(readFileSync(orderContractPath, "utf8"));
  const sourceBytes = readFileSync(orderSourcePath);
  assert.deepEqual(readErpOrdersFromLabelledSourceBytesV1({
    contract, sourceBytes, sourceLabel: "PROVIDER_ATTESTED", enabled: true, now: "2026-08-10T08:30:00Z",
  }), { outcome: "DENIED", code: "SOURCE_LABEL_DENIED" });
  const read = readErpOrdersFromLabelledSourceBytesV1({
    contract, sourceBytes, sourceLabel: "LOCAL_SYNTHETIC_ERP_ORDER_SOURCE_V1", enabled: true, now: "2026-08-10T08:30:00Z",
  });
  const references = JSON.parse(readFileSync(refsPath, "utf8"));
  assert.equal(read.outcome, "READ");
  const composition = createPan437ComplaintCli({
    references, contract, sourceBytes, sourceLabel: PAN437_ORDER_SOURCE_LABEL_V1, enabled: true, now: "2026-08-10T08:30:00Z",
  });
  assert.equal(composition.verdict.outcome, "BOUND");
  references.lineage.sourceDigest = "f".repeat(64);
  assert.deepEqual(createPan437ComplaintCli({
    references, contract, sourceBytes, sourceLabel: PAN437_ORDER_SOURCE_LABEL_V1, enabled: true, now: "2026-08-10T08:30:00Z",
  }).verdict, { outcome: "DENIED", code: "ORDER_SOURCE_MISMATCH" });
});

test("order/customer identity is required and never inferred from order status", () => {
  const directory = mkdtempSync(resolve(tmpdir(), "pan437-order-identity-"));
  const references = JSON.parse(readFileSync(refsPath, "utf8"));
  references.deliveries[0].customerId = "customer:zoo-002";
  const alteredReferences = resolve(directory, "references.json");
  writeFileSync(alteredReferences, JSON.stringify(references));
  try {
    assert.deepEqual(JSON.parse(execFileSync(process.execPath, [cli, "--references", alteredReferences, "select", "pos:dlv-001-1", "customer:zoo-002"], { cwd: root, encoding: "utf8" })), { outcome: "DENIED", code: "ORDER_CUSTOMER_MISMATCH" });
  } finally { rmSync(directory, { recursive: true, force: true }); }
});

test("changed order source or delivery content denies before mutating the persisted complaint", () => {
  const directory = mkdtempSync(resolve(tmpdir(), "pan437-binding-drift-"));
  const state = resolve(directory, "state.json");
  const changedSource = resolve(directory, "changed-source.json");
  const changedReferences = resolve(directory, "changed-references.json");
  try {
    const raised = JSON.parse(execFileSync(process.execPath, [cli, "--store", state, "raise", "pos:dlv-001-1", "customer:zoo-001", "QUANTITY_SHORTAGE", "3", "trace-binding"], { cwd: root, encoding: "utf8" }));
    assert.equal(raised.outcome, "RAISED");
    const before = readFileSync(state, "utf8");

    const source = JSON.parse(readFileSync(orderSourcePath, "utf8"));
    source.batches[1].records[0].facts.totalMinor += 1;
    writeFileSync(changedSource, JSON.stringify(source));
    assert.deepEqual(JSON.parse(execFileSync(process.execPath, [cli, "--order-source", changedSource, "--store", state, "decide", raised.complaintId, "REPLACE", "actor:claims-01"], { cwd: root, encoding: "utf8" })), { outcome: "DENIED", code: "SOURCE_MALFORMED" });
    assert.equal(readFileSync(state, "utf8"), before);

    const refs = JSON.parse(readFileSync(refsPath, "utf8"));
    refs.deliveries[0].positions[0].quantity = 9;
    writeFileSync(changedReferences, JSON.stringify(refs));
    assert.deepEqual(JSON.parse(execFileSync(process.execPath, [cli, "--references", changedReferences, "--store", state, "decide", raised.complaintId, "REPLACE", "actor:claims-01"], { cwd: root, encoding: "utf8" })), { outcome: "DENIED", code: "SNAPSHOT_REFERENCE_DRIFT" });
    assert.equal(readFileSync(state, "utf8"), before);
  } finally { rmSync(directory, { recursive: true, force: true }); }
});


test("ambiguous duplicate business order IDs deny before CLI store creation or mutation", () => {
  const directory = mkdtempSync(resolve(tmpdir(), "pan437-duplicate-order-"));
  const sourcePath = resolve(directory, "source.json");
  const referencesPath = resolve(directory, "references.json");
  const state = resolve(directory, "state.json");
  try {
    const source = JSON.parse(readFileSync(orderSourcePath, "utf8"));
    const duplicate = structuredClone(source.batches[1].records[0]);
    duplicate.recordMetadata.sourceRecordId = "erp-record:order-004";
    duplicate.recordMetadata.sourceUpdatedAt = "2026-08-10T07:48:00Z";
    duplicate.recordMetadata.lineageSequence = 4;
    duplicate.facts.customerId = "customer:zoo-002";
    source.batches[1].records.push(duplicate);
    const content = { ...source, lineage: { ...source.lineage } };
    delete content.lineage.sourceDigest;
    source.lineage.sourceDigest = createHash("sha256").update(canonicalJson({
      ...content, lineage: { ...content.lineage },
    }), "utf8").digest("hex");
    const references = JSON.parse(readFileSync(refsPath, "utf8"));
    references.lineage.sourceDigest = source.lineage.sourceDigest;
    writeFileSync(sourcePath, JSON.stringify(source));
    writeFileSync(referencesPath, JSON.stringify(references));
    assert.deepEqual(JSON.parse(execFileSync(process.execPath, [cli, "--order-source", sourcePath, "--references", referencesPath, "--store", state, "select", "pos:dlv-001-1", "customer:zoo-001"], { cwd: root, encoding: "utf8" })), { outcome: "DENIED", code: "ORDER_ID_AMBIGUOUS" });
    assert.equal(existsSync(state), false);
  } finally { rmSync(directory, { recursive: true, force: true }); }
});

test("public composition rejects a caller-rehashed order result and returns no usable ledger", () => {
  const references = JSON.parse(readFileSync(refsPath, "utf8"));
  const fakeOrderRead = {
    outcome: "READ", entity: "orders", records: [],
    metadata: { tenantId: references.tenantId, trust: "LOCAL_SYNTHETIC", sourceDigest: "f".repeat(64), sourceBytesSha256: "f".repeat(64), nextCursor: null, recordCount: 0 },
    readbackDigest: "f".repeat(64),
  };
  const composition = createPan437ComplaintCli({ references, orderRead: fakeOrderRead });
  assert.deepEqual(composition.verdict, { outcome: "DENIED", code: "ORDER_SOURCE_INPUT_REQUIRED" });
  assert.deepEqual(composition.ledger.raise({ positionId: "pos:dlv-001-1", customerId: "customer:zoo-001", reason: "QUANTITY_SHORTAGE", quantity: 1, traceId: "caller-minted" }), { outcome: "DENIED", code: "ORDER_SOURCE_INPUT_REQUIRED" });
  assert.throws(() => composition.ledger.snapshot(), /ORDER_SOURCE_INPUT_REQUIRED/);
});

test("denied composition never exposes a usable ledger", () => {
  const references = JSON.parse(readFileSync(refsPath, "utf8"));
  const contract = JSON.parse(readFileSync(orderContractPath, "utf8"));
  const denied = createPan437ComplaintCli({
    references, contract, sourceBytes: Buffer.from("{}"), sourceLabel: PAN437_ORDER_SOURCE_LABEL_V1, enabled: true, now: "2026-08-10T08:30:00Z",
  });
  assert.deepEqual(denied.verdict, { outcome: "DENIED", code: "SOURCE_MALFORMED" });
  for (const method of ["select", "raise", "decide", "readback"]) {
    assert.equal(denied.ledger[method]({}).outcome, "DENIED");
  }
  assert.throws(() => denied.ledger.snapshot(), /SOURCE_MALFORMED/);
});
