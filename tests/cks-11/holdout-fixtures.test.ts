import { readFileSync } from "node:fs";
import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import { replayShadowWorkflowV1 } from "../../src/cks/shadow-workflow-replay-v1.js";

type Data = Record<string, any>;
const p19 = JSON.parse(readFileSync("tests/fixtures/cks-11/p19-workflow-holdouts-v1.json", "utf8")) as Data;
const rejections = JSON.parse(readFileSync("tests/fixtures/cks-11/p19-workflow-rejections-v1.json", "utf8")) as Data;
const combined = JSON.parse(readFileSync("tests/fixtures/cks-11/p19-p20-holdouts-v1.json", "utf8")) as Data;
const negative = JSON.parse(readFileSync("tests/fixtures/cks-11/p19-p20-rejections-v1.json", "utf8")) as Data;
void describe("CKS-11 P19/P20 holdout fixture binding", () => {
  void it("binds P19 quality/cost parity and every declared safe abort to P20 typed parity", () => {
    const decision = replayShadowWorkflowV1({ schemaVersion: p19.schemaVersion, verifierVersion: p19.verifierVersion, holdouts: [...p19.holdouts, ...rejections.holdouts], requiredAbortReasons: p19.requiredAbortReasons });
    assert.equal(decision.status, "SHADOW_PARITY_VERIFIED"); assert.equal(decision.applicableHoldoutCount, combined.p19.applicableHoldouts); assert.equal(decision.safeAbortCount, 4);
    assert.deepEqual(combined.p19.safeAbortCases, ["INVALID_INPUT", "VERSION_DRIFT", "BOUNDARY_UNAVAILABLE", "AUTHORITY_WIDENING"]);
    assert.deepEqual(combined.p20.typedResultKinds, ["OUTPUT", "DECLARED_ERROR"]); assert.equal(combined.promotionState, "DENIED");
  });
  void it("keeps unknown, drift, boundary, authority, mismatch, rollback, and dry-run promotion fail-closed", () => {
    assert.deepEqual(negative.rejections, ["UNKNOWN_INPUT", "VERSION_DRIFT", "BOUNDARY_UNAVAILABLE", "AUTHORITY_WIDENING", "RESULT_MISMATCH", "UNBOUND_ROLLBACK", "DRY_RUN_PROMOTION"]); assert.equal(negative.promotionState, "DENIED");
  });
});
