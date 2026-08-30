import { strict as assert } from "node:assert";
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

const manifest = JSON.parse(readFileSync("tests/fixtures/cks-11/offline-proof-manifest-v1.json", "utf8"));
const receipt = JSON.parse(readFileSync("verification/cks-11-offline-proof-receipt-v1.json", "utf8"));
void describe("CKS-11 offline proof readback", () => {
  void it("binds local terminal evidence while denying promotion", () => {
    assert.equal(manifest.evidenceScope, "LOCAL_SYNTHETIC_DRY_RUN_ONLY"); assert.equal(manifest.promotionState, "DENIED");
    assert.equal(receipt.outcome, "PASS_WITH_PROMOTION_DENIED"); assert.equal(receipt.promotionState, "DENIED");
    assert.deepEqual(receipt.terminalEvidence, ["P19_EQUAL_OR_BETTER_QUALITY_AT_LOWER_REASONING_COST_WITH_SAFE_ABORT_BOUND", "P20_DETERMINISTIC_TYPED_PARITY_WITH_EXACT_ROLLBACK_BOUND", "IMMUTABLE_RECEIPT_READBACK_BOUND"]);
    assert.deepEqual(receipt.childEvidence, {
      P19: { path: "verification/cks-11-shadow-replay-receipt-v1.json", criterion: "EQUAL_OR_BETTER_QUALITY_AT_LOWER_REASONING_COST_WITH_SAFE_ABORT" },
      P20: { path: "verification/cks-11-p20-parity-receipt-v1.json", criterion: "DETERMINISTIC_TYPED_FUNCTION_PARITY_WITH_EXACT_ORIGINAL_STEP_ROLLBACK" },
    });
    assert.equal(receipt.releaseDisposition, "RELEASE_REQUIRED_PENDING_DELIVERY");
    assert.equal(receipt.releasePerformed, false);
  });
  void it("runs the verifier and refuses a promotion claim", () => {
    const pass = spawnSync(process.execPath, ["scripts/run-cks-11-proof-dry-run.mjs"], { encoding: "utf8" }); assert.equal(pass.status, 0, pass.stderr);
    const promotion = spawnSync(process.execPath, ["scripts/run-cks-11-proof-dry-run.mjs", "--promote"], { encoding: "utf8" }); assert.notEqual(promotion.status, 0);
  });
});
