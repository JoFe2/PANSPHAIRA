import { readFileSync } from "node:fs";
import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import { governedAssetsDigestV1, governedAssetsRefSetDigestV1, type ExactRefV1 } from "../../src/cks/governed-assets-v1.js";
import { appendGovernedReceiptV1 } from "../../src/cks/governed-receipt-ledger-v1.js";

type Data = Record<string, any>;
const FIXTURE = JSON.parse(readFileSync("tests/fixtures/cks-11/receipt-rollback-cases-v1.json", "utf8")) as Data;
const LEDGER_CASES = JSON.parse(readFileSync("tests/fixtures/cks-11/receipt-ledger-cases-v1.json", "utf8")) as Data;
function ref(kind: string, id: string): Data { return { kind, id, schemaVersion: "pansphaira.cks-11/governed-assets/v1", version: "1.0.0", digestAlgorithm: "SHA-256", digest: governedAssetsDigestV1({ kind, id }) }; }
function receipt(subjectRef: Data, workflowDependencies: Data[], receiptId: string, previousReceiptDigest: string | null, time: number): Data {
  const value: Data = structuredClone(LEDGER_CASES.receiptTemplate);
  value.receiptId = receiptId; value.subjectRef = structuredClone(subjectRef); value.workflowDependencySetDigest = governedAssetsRefSetDigestV1(workflowDependencies); value.functionDependencySetDigest = governedAssetsRefSetDigestV1([]); value.previousReceiptDigest = previousReceiptDigest; value.recordedTimeMs = time;
  value.requestDigest = governedAssetsDigestV1({ receiptId, request: "rollback" }); value.contextDigest = governedAssetsDigestV1({ receiptId, time });
  value.decisionDigest = governedAssetsDigestV1({ subjectRef: value.subjectRef, decisionStatus: value.decisionStatus, reasonCodes: value.reasonCodes, contextDigest: value.contextDigest, recordedTimeMs: value.recordedTimeMs });
  value.receiptDigest = governedAssetsDigestV1(value, "receiptDigest"); return value;
}
function input(history: Data[], next: Data): Data { const subjectRef = ref("GOVERNED_WORKFLOW", FIXTURE.subject); const workflowDependencies = [ref("GOVERNED_WORKFLOW", "workflow:fixture-order-normalizer")]; return { subjectKind: "WORKFLOW", subjectRef, workflowDependencies, functionDependencies: [], historicalEntries: history, newEntry: next }; }

void describe("CKS-11 governed receipt rollback readback", () => {
  void it("records rollback as an immutable successor and retains exact history", () => {
    assert.deepEqual(FIXTURE.required, ["immutable-history", "successor-rollback-receipt", "exact-dependency-set", "readback-binding"]);
    const subjectRef = ref("GOVERNED_WORKFLOW", FIXTURE.subject); const dependencies = [ref("GOVERNED_WORKFLOW", "workflow:fixture-order-normalizer")];
    const first = receipt(subjectRef, dependencies, "receipt:pre-rollback", null, 10);
    const rollback = receipt(subjectRef, dependencies, "receipt:rollback-readback", first.receiptDigest, 20);
    const result = appendGovernedReceiptV1(input([first], rollback));
    assert.equal(result.outcome, "ACCEPTED"); if (result.outcome !== "ACCEPTED") throw new Error("expected accepted rollback");
    assert.equal(result.record.entries.length, 2); assert.deepEqual(result.record.entries.map((entry) => entry.receiptDigest), [first.receiptDigest, rollback.receiptDigest]);
    assert.equal(result.record.entries[0]!.receiptDigest, first.receiptDigest); assert.equal(result.record.entries[1]!.previousReceiptDigest, first.receiptDigest); assert.equal(Object.isFrozen(result.record.entries[0]), true);
  });
  void it("fails closed when rollback tries to rewrite history or loses its readback chain", () => {
    const subjectRef = ref("GOVERNED_WORKFLOW", FIXTURE.subject); const dependencies = [ref("GOVERNED_WORKFLOW", "workflow:fixture-order-normalizer")];
    const first = receipt(subjectRef, dependencies, "receipt:pre-rollback", null, 10);
    const rewrite = structuredClone(first); rewrite.receiptId = "receipt:rewritten-history"; rewrite.receiptDigest = governedAssetsDigestV1(rewrite, "receiptDigest");
    const rewritten = appendGovernedReceiptV1(input([rewrite], receipt(subjectRef, dependencies, "receipt:rollback-readback", first.receiptDigest, 20)));
    assert.equal(rewritten.outcome, "REJECTED");
    const stale = receipt(subjectRef, dependencies, "receipt:rollback-readback", "f".repeat(64), 20);
    assert.equal(appendGovernedReceiptV1(input([first], stale)).outcome, "REJECTED");
  });
  void it("does not treat local synthetic or dry-run labels as promotable evidence", () => {
    for (const label of FIXTURE.nonPromotion) assert.equal(["dry-run", "synthetic", "stale", "unverified-external"].includes(label), true);
  });
});
