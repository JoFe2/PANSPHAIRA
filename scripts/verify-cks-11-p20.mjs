import { readFileSync } from "node:fs";
import { strict as assert } from "node:assert";
const root = new URL("../", import.meta.url);
const load = (path) => JSON.parse(readFileSync(new URL(path, root), "utf8"));
export function verifyCks11P20V1() {
  const holdouts = load("tests/fixtures/cks-11/p19-p20-holdouts-v1.json"); const rejections = load("tests/fixtures/cks-11/p19-p20-rejections-v1.json"); const receipt = load("verification/cks-11-p20-parity-receipt-v1.json");
  assert.equal(holdouts.schemaVersion, "pansphaira.cks-11/p19-p20-holdouts/v1"); assert.equal(holdouts.p19.applicableHoldouts, 2); assert.deepEqual(holdouts.p19.safeAbortCases, ["INVALID_INPUT", "VERSION_DRIFT", "BOUNDARY_UNAVAILABLE", "AUTHORITY_WIDENING"]); assert.deepEqual(holdouts.p20.typedResultKinds, ["OUTPUT", "DECLARED_ERROR"]);
  assert.equal(rejections.schemaVersion, "pansphaira.cks-11/p19-p20-rejections/v1"); assert.equal(rejections.rejections.includes("DRY_RUN_PROMOTION"), true);
  assert.equal(receipt.schemaVersion, "pansphaira.cks-11/p20-parity-receipt/v1"); assert.deepEqual(receipt.terminalEvidence, ["P20_STABLE_SUBSTEP_TYPED_OUTPUT_OR_DECLARED_ERROR_PARITY", "P20_EXACT_ORIGINAL_STEP_ROLLBACK_READBACK_BOUND", "PAIRED_SUBSTITUTION_AND_REDIGESTION_DENIED"]); assert.equal(receipt.releaseDisposition, "RELEASE_REQUIRED_PENDING_DELIVERY"); assert.equal(receipt.releasePerformed, false); assert.equal(receipt.promotionState, "DENIED");
  return { outcome: "PASS_WITH_PROMOTION_DENIED", evidenceScope: receipt.evidenceScope, releaseDisposition: receipt.releaseDisposition };
}
try { console.log(JSON.stringify(verifyCks11P20V1())); } catch (error) { console.error(error instanceof Error ? error.message : "P20_RECEIPT_DENIED"); process.exitCode = 171; }
