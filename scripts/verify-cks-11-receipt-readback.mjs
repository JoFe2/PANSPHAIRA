import { readFileSync } from "node:fs";
import { strict as assert } from "node:assert";
const root = new URL("../", import.meta.url);
const load = (path) => JSON.parse(readFileSync(new URL(path, root), "utf8"));
export function verifyCks11ReceiptReadbackV1() {
  const cases = load("tests/fixtures/cks-11/receipt-rollback-cases-v1.json"); const receipt = load("verification/cks-11-receipt-rollback-readback-v1.json");
  assert.equal(cases.schemaVersion, "pansphaira.cks-11/receipt-rollback-cases/v1"); assert.equal(cases.scope, "LOCAL_SYNTHETIC_ROLLBACK_READBACK_ONLY"); assert.deepEqual(cases.required, ["immutable-history", "successor-rollback-receipt", "exact-dependency-set", "readback-binding"]);
  assert.equal(receipt.schemaVersion, "pansphaira.cks-11/delivery-readback-receipt/v1"); assert.equal(receipt.localEvidence.includes("IMMUTABLE_RECEIPT_READBACK_BOUND"), true); assert.equal(receipt.releaseDisposition, "RELEASE_REQUIRED_PENDING_DELIVERY"); assert.equal(receipt.releasePerformed, false); assert.equal(receipt.promotionState, "DENIED");
  return { outcome: "PASS_WITH_PROMOTION_DENIED", closureState: receipt.closureState, releaseDisposition: receipt.releaseDisposition };
}
try { console.log(JSON.stringify(verifyCks11ReceiptReadbackV1())); } catch (error) { console.error(error instanceof Error ? error.message : "RECEIPT_READBACK_DENIED"); process.exitCode = 171; }
