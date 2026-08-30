import { readFileSync } from "node:fs";
import { strict as assert } from "node:assert";
const root = new URL("../", import.meta.url);
const load = () => JSON.parse(readFileSync(new URL("verification/cks-11-receipt-rollback-readback-v1.json", root), "utf8"));
export function validateCks11DeliveryReadbackV1(receipt = load()) {
  assert.deepEqual(Object.keys(receipt).sort(), ["closureState", "deliveredEvidence", "externalReadback", "localEvidence", "promotionState", "releaseDisposition", "releasePerformed", "schemaVersion", "taskId"]);
  assert.equal(receipt.schemaVersion, "pansphaira.cks-11/delivery-readback-receipt/v1"); assert.equal(receipt.taskId, "RECOVERY-PSAI291-BLOCKED-FRONTIER-01");
  assert.deepEqual(receipt.deliveredEvidence, { reference: "JoFe2/PANSPHAIRA#289", scope: "DELIVERED_EVIDENCE_REFERENCE_ONLY", bound: true });
  assert.deepEqual(receipt.localEvidence, ["P19_EQUAL_OR_BETTER_QUALITY_AT_LOWER_REASONING_COST_WITH_SAFE_ABORT_BOUND", "P20_DETERMINISTIC_TYPED_PARITY_WITH_EXACT_ROLLBACK_BOUND", "IMMUTABLE_RECEIPT_READBACK_BOUND"]);
  assert.deepEqual(receipt.externalReadback, { state: "UNVERIFIED", required: ["PR", "CI", "MERGE", "NO_PRODUCTION_ACTIVATION", "PUBLIC_MAIN", "RELEASE"] });
  assert.equal(receipt.closureState, "EXTERNAL_READBACK_REQUIRED"); assert.equal(receipt.releaseDisposition, "RELEASE_REQUIRED_PENDING_DELIVERY"); assert.equal(receipt.releasePerformed, false); assert.equal(receipt.promotionState, "DENIED");
  return { outcome: "LOCAL_PACKAGE_VALID_EXTERNAL_CLOSURE_BLOCKED", closureState: receipt.closureState, releaseDisposition: receipt.releaseDisposition, releasePerformed: receipt.releasePerformed, promotionState: receipt.promotionState };
}
function selfTest() { const valid = load(); validateCks11DeliveryReadbackV1(valid); const forged = structuredClone(valid); forged.externalReadback.state = "VERIFIED"; assert.throws(() => validateCks11DeliveryReadbackV1(forged)); const promoted = structuredClone(valid); promoted.promotionState = "ALLOWED"; assert.throws(() => validateCks11DeliveryReadbackV1(promoted)); const released = structuredClone(valid); released.releasePerformed = true; assert.throws(() => validateCks11DeliveryReadbackV1(released)); const disposition = structuredClone(valid); disposition.releaseDisposition = "RELEASED"; assert.throws(() => validateCks11DeliveryReadbackV1(disposition)); }
try { if (process.argv.includes("--self-test")) selfTest(); const result = validateCks11DeliveryReadbackV1(); if (process.argv.includes("--require-closure")) throw new Error("EXTERNAL_READBACK_REQUIRED"); console.log(JSON.stringify(result)); } catch (error) { console.error(error instanceof Error ? error.message : "DELIVERY_READBACK_DENIED"); process.exitCode = 171; }
