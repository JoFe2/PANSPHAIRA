import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { createComplaintLedger, validateDeliveryReferences } from "../../src/cscl-13/complaint.mjs";

const refs = () => JSON.parse(readFileSync("tests/fixtures/cscl-13/delivery-references-v1.json", "utf8"));

test("reference set validates and rejects malformed shapes deterministically", () => {
  assert.deepEqual(validateDeliveryReferences(refs()), { outcome: "VALID" });
  // falscher Lieferbezug auf Strukturebene: unbekannter Artikel in Position
  const badArticle = refs(); badArticle.deliveries[0].positions[0].articleId = "article:unknown";
  assert.equal(validateDeliveryReferences(badArticle).outcome, "MALFORMED");
  // überhöhte Menge auf Referenzebene: nicht-ganzzahlige Menge
  const badQty = refs(); badQty.deliveries[0].positions[0].quantity = 3.5;
  assert.equal(validateDeliveryReferences(badQty).outcome, "MALFORMED");
  // fehlende Pflichtinformation: Position ohne unit
  const missing = refs(); delete missing.deliveries[0].positions[0].unit;
  assert.equal(validateDeliveryReferences(missing).outcome, "MALFORMED");
});

test("select resolves delivery/order position with article and quantity", () => {
  const ledger = createComplaintLedger(refs());
  const result = ledger.select({ positionId: "pos:dlv-001-1", customerId: "customer:zoo-001" });
  assert.equal(result.outcome, "SELECTED");
  assert.equal(result.articleId, "article:zoo-101");
  assert.equal(result.deliveredQuantity, 10);
  assert.equal(result.orderId, "order:synthetic-001");
});

test("select denies unknown position and mismatched customer (wrong delivery reference)", () => {
  const ledger = createComplaintLedger(refs());
  assert.deepEqual(ledger.select({ positionId: "pos:unknown", customerId: "customer:zoo-001" }), { outcome: "DENIED", code: "POSITION_NOT_FOUND" });
  assert.deepEqual(ledger.select({ positionId: "pos:dlv-001-1", customerId: "customer:zoo-002" }), { outcome: "DENIED", code: "DELIVERY_REFERENCE_MISMATCH" });
});

test("raise a partial-quantity complaint and read back with decision and history", () => {
  const ledger = createComplaintLedger(refs());
  const raised = ledger.raise({ positionId: "pos:dlv-001-1", customerId: "customer:zoo-001", reason: "QUANTITY_SHORTAGE", quantity: 3, traceId: "trace-001" });
  assert.equal(raised.outcome, "RAISED");
  const decided = ledger.decide({ complaintId: raised.complaintId, decision: "REPLACE", actorId: "actor:claims-01" });
  assert.equal(decided.outcome, "DECIDED");
  const read = ledger.readback({ complaintId: raised.complaintId });
  assert.equal(read.outcome, "READ");
  assert.equal(read.complaint.claimedQuantity, 3);
  assert.equal(read.complaint.deliveredQuantity, 10);
  assert.equal(read.decision.decision, "REPLACE");
  assert.equal(read.history.length, 2);
  assert.deepEqual(read.history.map((h) => h.kind), ["RAISED", "DECIDED"]);
  assert.match(read.readbackDigest, /^[a-f0-9]{64}$/);
});

test("raise denies quantity exceeding delivered (over-claimed quantity)", () => {
  const ledger = createComplaintLedger(refs());
  assert.deepEqual(ledger.raise({ positionId: "pos:dlv-001-1", customerId: "customer:zoo-001", reason: "QUANTITY_SHORTAGE", quantity: 11, traceId: "trace-002" }), { outcome: "DENIED", code: "QUANTITY_EXCEEDS_DELIVERED" });
});

test("raise denies invalid quantity and missing required information", () => {
  const ledger = createComplaintLedger(refs());
  assert.deepEqual(ledger.raise({ positionId: "pos:dlv-001-1", customerId: "customer:zoo-001", reason: "QUANTITY_SHORTAGE", quantity: 0, traceId: "trace-003" }), { outcome: "DENIED", code: "REQUEST_MALFORMED" });
  assert.deepEqual(ledger.raise({ positionId: "pos:dlv-001-1", customerId: "customer:zoo-001", reason: "QUANTITY_SHORTAGE", quantity: 2, traceId: "" }), { outcome: "DENIED", code: "REQUEST_MALFORMED" });
  assert.deepEqual(ledger.raise({ positionId: "pos:dlv-001-1", customerId: "customer:zoo-001", reason: "NOT_A_REASON", quantity: 2, traceId: "trace-004" }), { outcome: "DENIED", code: "REQUEST_MALFORMED" });
});

test("raise denies duplicate registration for same position/customer/reason", () => {
  const ledger = createComplaintLedger(refs());
  const first = ledger.raise({ positionId: "pos:dlv-001-1", customerId: "customer:zoo-001", reason: "DAMAGED_GOODS", quantity: 1, traceId: "trace-005" });
  assert.equal(first.outcome, "RAISED");
  const dup = ledger.raise({ positionId: "pos:dlv-001-1", customerId: "customer:zoo-001", reason: "DAMAGED_GOODS", quantity: 2, traceId: "trace-006" });
  assert.deepEqual(dup, { outcome: "DENIED", code: "DUPLICATE_COMPLAINT" });
});

test("decide denies unknown complaint and double decision", () => {
  const ledger = createComplaintLedger(refs());
  const raised = ledger.raise({ positionId: "pos:dlv-001-1", customerId: "customer:zoo-001", reason: "WRONG_ARTICLE", quantity: 1, traceId: "trace-007" });
  assert.deepEqual(ledger.decide({ complaintId: "complaint:missing", decision: "REPLACE", actorId: "a" }), { outcome: "DENIED", code: "COMPLAINT_NOT_FOUND" });
  assert.equal(ledger.decide({ complaintId: raised.complaintId, decision: "REPLACE", actorId: "a" }).outcome, "DECIDED");
  assert.deepEqual(ledger.decide({ complaintId: raised.complaintId, decision: "REJECTED", actorId: "b" }), { outcome: "DENIED", code: "ALREADY_DECIDED" });
});

test("snapshot/hydrate round-trips the full history deterministically", () => {
  const ledger = createComplaintLedger(refs());
  const raised = ledger.raise({ positionId: "pos:dlv-001-1", customerId: "customer:zoo-001", reason: "QUANTITY_SHORTAGE", quantity: 4, traceId: "trace-008", raisedAt: "2026-09-21T07:00:00.000Z" });
  ledger.decide({ complaintId: raised.complaintId, decision: "CREDIT_NOTE_REQUEST", actorId: "actor:claims-02", at: "2026-09-21T07:01:00.000Z" });
  const snap = ledger.snapshot();

  const revived = createComplaintLedger(refs());
  revived.hydrate(snap);
  assert.deepEqual(revived.evidence(), ledger.evidence());
  assert.deepEqual(revived.readback({ complaintId: raised.complaintId }), ledger.readback({ complaintId: raised.complaintId }));
});

test("complaint decision contract validates a real readback projection", async () => {
  const Ajv2020 = (await import("ajv/dist/2020.js")).default;
  const schema = JSON.parse(readFileSync("contracts/cscl-13/complaint-decision-v1.schema.json", "utf8"));
  const ledger = createComplaintLedger(refs());
  const raised = ledger.raise({ positionId: "pos:dlv-001-2", customerId: "customer:zoo-001", reason: "QUALITY_DEFECT", quantity: 10, traceId: "trace-009", raisedAt: "2026-09-21T07:00:00.000Z" });
  ledger.decide({ complaintId: raised.complaintId, decision: "REJECTED", actorId: "actor:claims-03", at: "2026-09-21T07:02:00.000Z" });
  const read = ledger.readback({ complaintId: raised.complaintId });
  const projection = {
    schemaVersion: "pansphaira.cscl13/complaint-decision/v1",
    complaintId: read.complaint.complaintId,
    reason: read.complaint.reason,
    claimedQuantity: read.complaint.claimedQuantity,
    deliveredQuantity: read.complaint.deliveredQuantity,
    unit: read.complaint.unit,
    decision: read.decision.decision,
    actorId: read.decision.actorId,
    history: read.history,
  };
  const validate = new Ajv2020({ strict: true }).compile(schema);
  assert.equal(validate(projection), true, JSON.stringify(validate.errors));
});

test("missing production/charge data is optional and quality-defect complaints still resolve", () => {
  // Produktion/Charge ist optional: Referenz kann ohne Fertigungsdaten existieren, QUALITY_DEFECT bleibt zulässig.
  const ledger = createComplaintLedger(refs());
  assert.equal(validateDeliveryReferences(refs()).outcome, "VALID");
  const raised = ledger.raise({ positionId: "pos:dlv-001-2", customerId: "customer:zoo-001", reason: "QUALITY_DEFECT", quantity: 5, traceId: "trace-010" });
  assert.equal(raised.outcome, "RAISED");
});
test("B1 regression: cumulative claimed quantity across reasons cannot exceed delivered", () => {
  const ledger = createComplaintLedger(refs());
  const a = ledger.raise({ positionId: "pos:dlv-001-1", customerId: "customer:zoo-001", reason: "DAMAGED_GOODS", quantity: 7, traceId: "trace-b1a" });
  assert.equal(a.outcome, "RAISED");
  assert.equal(ledger.decide({ complaintId: a.complaintId, decision: "REPLACE", actorId: "actor:claims-01" }).outcome, "DECIDED");
  // zweite überbuchende Erfassung (7+6 > 10) wird verweigert
  assert.deepEqual(ledger.raise({ positionId: "pos:dlv-001-1", customerId: "customer:zoo-001", reason: "QUALITY_DEFECT", quantity: 6, traceId: "trace-b1b" }), { outcome: "DENIED", code: "QUANTITY_EXCEEDS_DELIVERED" });
  assert.deepEqual(ledger.raise({ positionId: "pos:dlv-001-1", customerId: "customer:zoo-001", reason: "QUALITY_DEFECT", quantity: 4, traceId: "trace-b1c" }), { outcome: "DENIED", code: "QUANTITY_EXCEEDS_DELIVERED" });
  // passende Restmenge (7+3 <= 10) bleibt zulässig
  const fit = ledger.raise({ positionId: "pos:dlv-001-1", customerId: "customer:zoo-001", reason: "QUALITY_DEFECT", quantity: 3, traceId: "trace-b1d" });
  assert.equal(fit.outcome, "RAISED");
  assert.equal(ledger.evidence().complaints, 2);
});

test("B1 regression: REJECTED complaints do not consume replace quantity", () => {
  const ledger = createComplaintLedger(refs());
  const a = ledger.raise({ positionId: "pos:dlv-001-1", customerId: "customer:zoo-001", reason: "DAMAGED_GOODS", quantity: 7, traceId: "trace-b1e" });
  const b = ledger.raise({ positionId: "pos:dlv-001-1", customerId: "customer:zoo-001", reason: "QUALITY_DEFECT", quantity: 3, traceId: "trace-b1f" });
  ledger.decide({ complaintId: a.complaintId, decision: "REJECTED", actorId: "actor:claims-01" });
  ledger.decide({ complaintId: b.complaintId, decision: "REPLACE", actorId: "actor:claims-01" });
  // REJECTED (7) zählt nicht; nach REJECTED ist wieder Raum bis 10
  const c = ledger.raise({ positionId: "pos:dlv-001-1", customerId: "customer:zoo-001", reason: "WRONG_ARTICLE", quantity: 7, traceId: "trace-b1g" });
  assert.equal(c.outcome, "RAISED");
});

test("B2 regression: hydrated store rejects drifted reference content", () => {
  const original = refs();
  const ledger = createComplaintLedger(original);
  const raised = ledger.raise({ positionId: "pos:dlv-001-1", customerId: "customer:zoo-001", reason: "DAMAGED_GOODS", quantity: 1, traceId: "trace-b2" });
  ledger.decide({ complaintId: raised.complaintId, decision: "REPLACE", actorId: "actor:claims-01" });
  const snap = ledger.snapshot();

  // gleiche referenceSetId/position/customer, aber andere tenant/order/delivery/article/qty
  const drifted = JSON.parse(JSON.stringify(original));
  drifted.referenceSetId = original.referenceSetId;
  drifted.tenantId = "tenant:other";
  drifted.deliveries[0].orderId = "order:other-order";
  drifted.deliveries[0].deliveryId = "delivery:other-delivery";
  drifted.deliveries[0].positions[0].articleId = "article:zoo-102";
  drifted.deliveries[0].positions[0].quantity = 99;

  const revived = createComplaintLedger(drifted);
  assert.throws(() => revived.hydrate(snap), /SNAPSHOT_REFERENCE_DRIFT|SNAPSHOT_MALFORMED/);
});

test("B3 regression: contradictory snapshot (decision null, history decided) is rejected", () => {
  const ledger = createComplaintLedger(refs());
  const raised = ledger.raise({ positionId: "pos:dlv-001-1", customerId: "customer:zoo-001", reason: "DAMAGED_GOODS", quantity: 1, traceId: "trace-b3" });
  ledger.decide({ complaintId: raised.complaintId, decision: "REPLACE", actorId: "actor:claims-01" });
  const snap = ledger.snapshot();
  // decision auf null setzen, DECIDED-Verlauf bleibt -> Widerspruch
  snap.entries[0].decision = null;
  const revived = createComplaintLedger(refs());
  assert.throws(() => revived.hydrate(snap), /SNAPSHOT_HISTORY_MISMATCH/);
});

test("B3 regression: empty history and rewritten complaintId are rejected", () => {
  const ledger = createComplaintLedger(refs());
  const raised = ledger.raise({ positionId: "pos:dlv-001-1", customerId: "customer:zoo-001", reason: "DAMAGED_GOODS", quantity: 1, traceId: "trace-b3b" });
  ledger.decide({ complaintId: raised.complaintId, decision: "REPLACE", actorId: "actor:claims-01" });
  const snap = ledger.snapshot();

  const emptyHist = JSON.parse(JSON.stringify(snap));
  emptyHist.entries[0].history = [];
  assert.throws(() => createComplaintLedger(refs()).hydrate(emptyHist), /SNAPSHOT_HISTORY_MISMATCH/);

  const wrongId = JSON.parse(JSON.stringify(snap));
  wrongId.entries[0].complaint.complaintId = "complaint:00000000000000000000000000000000";
  assert.throws(() => createComplaintLedger(refs()).hydrate(wrongId), /SNAPSHOT_COMPLAINT_ID_MISMATCH/);
});
