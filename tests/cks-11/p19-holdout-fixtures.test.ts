import { readFileSync } from "node:fs";
import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import {
  SHADOW_REPLAY_VERIFIER_VERSION_V1,
  SHADOW_WORKFLOW_REPLAY_SCHEMA_V1,
  replayShadowWorkflowV1,
  type ShadowWorkflowReplayInputV1,
} from "../../src/cks/shadow-workflow-replay-v1.js";

type Data = Record<string, any>;

const REQUIRED_ABORT_REASONS = [
  "INVALID_INPUT",
  "VERSION_DRIFT",
  "BOUNDARY_UNAVAILABLE",
  "AUTHORITY_WIDENING",
];

const HOLDOUTS = JSON.parse(
  readFileSync("tests/fixtures/cks-11/p19-workflow-holdouts-v1.json", "utf8"),
) as Data;
const REJECTIONS = JSON.parse(
  readFileSync("tests/fixtures/cks-11/p19-workflow-rejections-v1.json", "utf8"),
) as Data;

function assertFixtureEnvelope(source: Data): void {
  assert.equal(source.schemaVersion, SHADOW_WORKFLOW_REPLAY_SCHEMA_V1);
  assert.equal(source.verifierVersion, SHADOW_REPLAY_VERIFIER_VERSION_V1);
  assert.deepEqual(source.requiredAbortReasons, REQUIRED_ABORT_REASONS);
}

function buildInput(holdouts: readonly unknown[]): ShadowWorkflowReplayInputV1 {
  return {
    schemaVersion: SHADOW_WORKFLOW_REPLAY_SCHEMA_V1,
    verifierVersion: SHADOW_REPLAY_VERIFIER_VERSION_V1,
    holdouts: structuredClone(holdouts),
    requiredAbortReasons: [...REQUIRED_ABORT_REASONS],
  } as ShadowWorkflowReplayInputV1;
}

function mergedInput(): ShadowWorkflowReplayInputV1 {
  return buildInput([
    ...structuredClone(HOLDOUTS.holdouts),
    ...structuredClone(REJECTIONS.holdouts),
  ]);
}

void describe("CKS-11 P19 workflow holdout fixtures v1", () => {
  void it("verifies P19 shadow parity across the applicable and safe-abort holdouts", () => {
    assertFixtureEnvelope(HOLDOUTS);
    assertFixtureEnvelope(REJECTIONS);
    const first = replayShadowWorkflowV1(mergedInput());
    const second = replayShadowWorkflowV1(mergedInput());
    assert.equal(first.status, "SHADOW_PARITY_VERIFIED");
    assert.equal(first.outcome, "PASS");
    assert.equal(first.applicableHoldoutCount, 2);
    assert.equal(first.safeAbortCount, 4);
    assert.deepEqual(first.reasonCodes, ["NONE"]);
    assert.equal(first.decisionDigest, second.decisionDigest);
    assert.deepEqual(first.holdoutResults.map((result) => result.outcome), [
      "PARITY_VERIFIED",
      "PARITY_VERIFIED",
      "SAFE_ABORT",
      "SAFE_ABORT",
      "SAFE_ABORT",
      "SAFE_ABORT",
    ]);
    assert.deepEqual(first.holdoutResults.map((result) => result.applicabilityStatus), [
      "FAST_PATH_ALLOWED",
      "FAST_PATH_ALLOWED",
      "FAST_PATH_ABORTED",
      "REVALIDATION_REQUIRED",
      "REVALIDATION_REQUIRED",
      "FAST_PATH_ABORTED",
    ]);
    assert.deepEqual(first.holdoutResults.map((result) => result.applicabilityReasonCodes), [
      ["NONE"],
      ["NONE"],
      ["INVALID_INPUT"],
      ["VERSION_DRIFT"],
      ["BOUNDARY_UNAVAILABLE"],
      ["AUTHORITY_WIDENING"],
    ]);
    for (const index of [0, 1]) {
      const result = first.holdoutResults[index]!;
      assert.equal(result.outputParity, true);
      assert.equal(result.verificationParity, true);
      assert.equal(result.rollbackParity, true);
      assert.equal(result.dependencyParity, true);
      assert.equal(result.qualityEqualOrBetter, true);
      assert.equal(result.reasoningCostLower, true);
    }
    const safeAbort = first.holdoutResults[2]!;
    assert.equal(safeAbort.outputParity, null);
    assert.equal(safeAbort.verificationParity, null);
    assert.equal(safeAbort.rollbackParity, null);
    assert.equal(safeAbort.dependencyParity, null);
    assert.equal(safeAbort.qualityEqualOrBetter, null);
    assert.equal(safeAbort.reasoningCostLower, null);
    assert.equal(Object.isFrozen(first), true);
    assert.equal(Object.isFrozen(first.holdoutResults), true);
  });

  void it("denies the applicable-only fixture fail-closed without safe-abort coverage", () => {
    const result = replayShadowWorkflowV1(buildInput(structuredClone(HOLDOUTS.holdouts)));
    assert.equal(result.status, "SHADOW_REPLAY_ABORTED");
    assert.equal(result.outcome, "ABORTED");
    assert.deepEqual(result.reasonCodes, ["SAFE_ABORT_REQUIRED"]);
    assert.equal(result.applicableHoldoutCount, 2);
    assert.equal(result.safeAbortCount, 0);
    assert.deepEqual(result.holdoutResults.map((holdout) => holdout.outcome), [
      "PARITY_VERIFIED",
      "PARITY_VERIFIED",
    ]);
  });

  void it("denies the rejection-only fixture fail-closed without an applicable holdout", () => {
    const result = replayShadowWorkflowV1(buildInput(structuredClone(REJECTIONS.holdouts)));
    assert.equal(result.status, "SHADOW_REPLAY_ABORTED");
    assert.equal(result.outcome, "ABORTED");
    assert.deepEqual(result.reasonCodes, ["NOT_APPLICABLE"]);
    assert.equal(result.applicableHoldoutCount, 0);
    assert.equal(result.safeAbortCount, 4);
    assert.deepEqual(result.holdoutResults.map((holdout) => holdout.outcome), [
      "SAFE_ABORT",
      "SAFE_ABORT",
      "SAFE_ABORT",
      "SAFE_ABORT",
    ]);
    assert.deepEqual(result.holdoutResults.map((holdout) => holdout.applicabilityReasonCodes), [
      ["INVALID_INPUT"],
      ["VERSION_DRIFT"],
      ["BOUNDARY_UNAVAILABLE"],
      ["AUTHORITY_WIDENING"],
    ]);
  });

  void it("denies fail-closed when governed evidence, digests, or authority inputs are mutated", () => {
    const cases: Array<(input: Data) => void> = [
      (input) => { input.holdouts[0].governed.reasoningCostMetric.value = 100; },
      (input) => { input.holdouts[0].governed.qualityMetric.value = 0.8; },
      (input) => { input.holdouts[0].governed.output.status = "different"; },
      (input) => { input.holdouts[0].governed.verificationOutcome.status = "REJECTED"; },
    ];
    const expectedReasons = [
      "REASONING_COST_NOT_LOWER",
      "QUALITY_REGRESSION",
      "OUTPUT_MISMATCH",
      "VERIFICATION_MISMATCH",
    ];
    cases.forEach((mutate, index) => {
      const input = mergedInput() as Data;
      mutate(input);
      const result = replayShadowWorkflowV1(input);
      assert.equal(result.status, "SHADOW_REPLAY_ABORTED");
      assert.equal(result.outcome, "ABORTED");
      assert.equal(result.holdoutResults[0]!.outcome, "REJECTED");
      assert.deepEqual(result.reasonCodes, [expectedReasons[index]!]);
    });

    const forged = mergedInput() as Data;
    forged.holdouts[0].governed.dependencies.transitiveClosureDigest = "0".repeat(64);
    const forgedResult = replayShadowWorkflowV1(forged);
    assert.equal(forgedResult.status, "SHADOW_REPLAY_ABORTED");
    assert.deepEqual(forgedResult.reasonCodes, ["INVALID_INPUT"]);
    assert.equal(forgedResult.holdoutResults.length, 0);
    assert.equal(forgedResult.applicableHoldoutCount, 0);
    assert.equal(forgedResult.safeAbortCount, 0);

    const capability = mergedInput() as Data;
    capability.holdouts[0].applicabilityInput.capabilityEnvelope.currentCeiling[0].action = "write";
    const capabilityResult = replayShadowWorkflowV1(capability);
    assert.equal(capabilityResult.status, "SHADOW_REPLAY_ABORTED");
    assert.equal(capabilityResult.holdoutResults[0]!.outcome, "REJECTED");
    assert.equal(capabilityResult.holdoutResults[0]!.applicabilityStatus, "FAST_PATH_ABORTED");
    assert.deepEqual(capabilityResult.holdoutResults[0]!.applicabilityReasonCodes, ["CAPABILITY_WIDENING"]);
    assert.deepEqual(capabilityResult.reasonCodes, ["CAPABILITY_WIDENING"]);

    const authority = mergedInput() as Data;
    authority.holdouts[1].applicabilityInput.authorityEnvelope.currentRequirements[0].action = "write";
    const authorityResult = replayShadowWorkflowV1(authority);
    assert.equal(authorityResult.status, "SHADOW_REPLAY_ABORTED");
    assert.equal(authorityResult.holdoutResults[1]!.outcome, "REJECTED");
    assert.equal(authorityResult.holdoutResults[1]!.applicabilityStatus, "FAST_PATH_ABORTED");
    assert.deepEqual(authorityResult.holdoutResults[1]!.applicabilityReasonCodes, ["AUTHORITY_WIDENING"]);
    assert.deepEqual(authorityResult.reasonCodes, ["AUTHORITY_WIDENING"]);
  });
});