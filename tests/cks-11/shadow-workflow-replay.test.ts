import { readFileSync } from "node:fs";
import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import { governedAssetsDigestV1, type ExactRefV1 } from "../../src/cks/governed-assets-v1.js";
import {
  SHADOW_REPLAY_VERIFIER_VERSION_V1,
  SHADOW_WORKFLOW_REPLAY_SCHEMA_V1,
  replayShadowWorkflowV1,
  shadowDependencyDigestsV1,
  shadowRollbackPlanDigestV1,
  type ShadowDependencySnapshotV1,
  type ShadowRollbackPlanV1,
  type ShadowWorkflowReplayInputV1,
} from "../../src/cks/shadow-workflow-replay-v1.js";

type Data = Record<string, any>;
const FIXTURE = JSON.parse(
  readFileSync("tests/fixtures/cks-11/shadow-replay-cases-v1.json", "utf8"),
) as Data;

const WORKFLOW_REF: ExactRefV1 = {
  kind: "GOVERNED_WORKFLOW",
  id: "workflow-orders-1",
  schemaVersion: "pansphaira.cks-11/governed-assets/v1",
  version: "1.0.0",
  digestAlgorithm: "SHA-256",
  digest: "cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc",
};

function prepareFixture(): ShadowWorkflowReplayInputV1 {
  const value = structuredClone(FIXTURE) as Data;
  value.schemaVersion = SHADOW_WORKFLOW_REPLAY_SCHEMA_V1;
  value.verifierVersion = SHADOW_REPLAY_VERIFIER_VERSION_V1;
  const applicable = value.holdouts[0];
  const baseApplicability = structuredClone(applicable.applicabilityInput) as Data;

  const dependencyBase = {
    knowledgeWorkflowInputs: structuredClone(baseApplicability.knowledgeInput.workflowInputs),
    knowledgeFunctionInputs: structuredClone(baseApplicability.knowledgeInput.functionInputs),
    workflowDependencies: [structuredClone(WORKFLOW_REF)],
    functionDependencies: [],
    historicalReceipts: [],
  } as const;
  const dependencyDigests = shadowDependencyDigestsV1(dependencyBase);
  const dependencies: ShadowDependencySnapshotV1 = {
    ...dependencyBase,
    ...dependencyDigests,
  };
  const rollbackBase: Omit<ShadowRollbackPlanV1, "planDigest"> = {
    trigger: "verification-failure",
    scope: "order-1",
    lastKnownGoodRef: {
      kind: "LAST_KNOWN_GOOD",
      id: "orders-lkg",
      schemaVersion: "pansphaira.cks-11/governed-assets/v1",
      version: "1.0.0",
      digestAlgorithm: "SHA-256",
      digest: "9999999999999999999999999999999999999999999999999999999999999999",
    },
    restoreAction: "restore-source-step",
    reconciliationRule: "authoritative-readback",
    readbackRequired: true,
    verifierDigest: "8888888888888888888888888888888888888888888888888888888888888888",
  };
  const rollbackPlan: ShadowRollbackPlanV1 = {
    ...rollbackBase,
    planDigest: shadowRollbackPlanDigestV1(rollbackBase),
  };
  const projection = {
    output: { status: "ok", orderId: "order-1" },
    verificationOutcome: {
      status: "VERIFIED",
      decisionDigest: "eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee",
      evidenceDigest: "ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff",
    },
    rollbackPlan,
    dependencies,
    qualityMetric: { metricId: "holdout-quality", metricVersion: "1.0.0", direction: "HIGHER_IS_BETTER", value: 0.9 },
    reasoningCostMetric: {
      metricId: "generative-reasoning-tokens",
      metricVersion: "1.0.0",
      direction: "LOWER_IS_BETTER",
      value: 100,
    },
  };
  applicable.baseline = structuredClone(projection);
  applicable.governed = {
    ...structuredClone(projection),
    reasoningCostMetric: { ...projection.reasoningCostMetric, value: 80 },
  };

  const unknown = structuredClone(baseApplicability);
  unknown.unknownField = true;
  value.holdouts[1].applicabilityInput = unknown;
  value.holdouts[1].expectedReasonCodes = ["INVALID_INPUT"];

  const drift = structuredClone(baseApplicability);
  drift.knowledgeInput.knowledgeRecords[0].version = "2026.08.29";
  value.holdouts[2].applicabilityInput = drift;
  value.holdouts[2].expectedReasonCodes = ["VERSION_DRIFT"];

  const boundary = structuredClone(baseApplicability);
  boundary.boundaryStatus = "UNAVAILABLE";
  value.holdouts[3].applicabilityInput = boundary;
  value.holdouts[3].expectedReasonCodes = ["BOUNDARY_UNAVAILABLE"];
  value.requiredAbortReasons = ["INVALID_INPUT", "VERSION_DRIFT", "BOUNDARY_UNAVAILABLE"];
  return value as ShadowWorkflowReplayInputV1;
}

void describe("CKS-11 shadow-only workflow replay v1", () => {
  void it("proves P19 from supplied projections without executing either path", () => {
    const input = prepareFixture();
    const first = replayShadowWorkflowV1(input);
    const second = replayShadowWorkflowV1(input);
    assert.equal(first.status, "SHADOW_PARITY_VERIFIED");
    assert.equal(first.outcome, "PASS");
    assert.equal(first.applicableHoldoutCount, 1);
    assert.equal(first.safeAbortCount, 3);
    assert.deepEqual(first.reasonCodes, ["NONE"]);
    assert.equal(first.decisionDigest, second.decisionDigest);
    assert.deepEqual(first.holdoutResults.map((result) => result.outcome), [
      "PARITY_VERIFIED",
      "SAFE_ABORT",
      "SAFE_ABORT",
      "SAFE_ABORT",
    ]);
    const firstResult = first.holdoutResults[0];
    assert.ok(firstResult);
    assert.equal(firstResult.outputParity, true);
    assert.equal(firstResult.verificationParity, true);
    assert.equal(firstResult.rollbackParity, true);
    assert.equal(firstResult.dependencyParity, true);
    assert.equal(firstResult.qualityEqualOrBetter, true);
    assert.equal(firstResult.reasoningCostLower, true);
    assert.equal(Object.isFrozen(first), true);
    assert.equal(Object.isFrozen(first.holdoutResults), true);
    const preparedHoldout = input.holdouts[0]!;
    assert.ok(preparedHoldout.baseline);
    assert.ok(preparedHoldout.governed);
    assert.deepEqual(preparedHoldout.baseline.dependencies, preparedHoldout.governed.dependencies);
  });

  void it("rejects output, Verification, rollback, dependency and metric mismatches", () => {
    const mutations: Array<(input: Data) => void> = [
      (input) => { input.holdouts[0].governed.output.status = "different"; },
      (input) => { input.holdouts[0].governed.verificationOutcome.status = "REJECTED"; },
      (input) => {
        input.holdouts[0].governed.rollbackPlan.scope = "other-order";
        const { planDigest: _oldPlanDigest, ...rollbackWithoutDigest } = input.holdouts[0].governed.rollbackPlan;
        input.holdouts[0].governed.rollbackPlan.planDigest = shadowRollbackPlanDigestV1(rollbackWithoutDigest);
      },
      (input) => { input.holdouts[0].governed.reasoningCostMetric.value = 100; },
    ];
    for (const mutate of mutations) {
      const input = prepareFixture() as Data;
      mutate(input);
      const result = replayShadowWorkflowV1(input);
      assert.equal(result.status, "SHADOW_REPLAY_ABORTED");
      assert.equal(result.outcome, "ABORTED");
      assert.equal(result.holdoutResults[0]!.outcome, "REJECTED");
      assert.notEqual(result.reasonCodes[0], "NONE");
    }

    const dependencyMutation = prepareFixture() as Data;
    dependencyMutation.holdouts[0].governed.dependencies.workflowDependencies[0].version = "1.0.1";
    assert.equal(replayShadowWorkflowV1(dependencyMutation).reasonCodes.includes("INVALID_INPUT"), true);
  });

  void it("fails closed on missing inputs, ambiguous matches, Knowledge drift and boundary changes", () => {
    const cases: Array<[string, (input: Data) => void, string]> = [
      ["missing input", (input) => { input.holdouts[0].applicabilityInput.providedInputs.pop(); }, "MISSING_INPUT"],
      ["ambiguous match", (input) => {
        input.holdouts[0].applicabilityInput.workflowMatches.push(
          structuredClone(input.holdouts[0].applicabilityInput.workflowMatches[0]),
        );
      }, "AMBIGUOUS_MATCH"],
      ["stale Knowledge", (input) => { input.holdouts[0].applicabilityInput.knowledgeInput.asOfMs = 1000; }, "STALE_KNOWLEDGE"],
      ["boundary unavailable", (input) => { input.holdouts[0].applicabilityInput.boundaryStatus = "UNAVAILABLE"; }, "BOUNDARY_UNAVAILABLE"],
      ["capability widening", (input) => { input.holdouts[0].applicabilityInput.capabilityEnvelope.currentCeiling[0].action = "write"; }, "CAPABILITY_WIDENING"],
      ["authority widening", (input) => { input.holdouts[0].applicabilityInput.authorityEnvelope.currentRequirements[0].action = "write"; }, "AUTHORITY_WIDENING"],
    ];
    for (const [, mutate, reason] of cases) {
      const input = prepareFixture() as Data;
      mutate(input);
      input.holdouts[0].expected = "SAFE_ABORT";
      input.holdouts[0].expectedReasonCodes = [reason];
      input.holdouts[0].baseline = null;
      input.holdouts[0].governed = null;
      input.requiredAbortReasons = [reason];
      const result = replayShadowWorkflowV1(input);
      assert.equal(result.status, "SHADOW_REPLAY_ABORTED");
      assert.equal(result.holdoutResults[0]!.outcome, "SAFE_ABORT");
    }

    const unknown = prepareFixture() as Data;
    unknown.holdouts[0].applicabilityInput.extra = true;
    unknown.holdouts[0].expected = "SAFE_ABORT";
    unknown.holdouts[0].expectedReasonCodes = ["INVALID_INPUT"];
    unknown.holdouts[0].baseline = null;
    unknown.holdouts[0].governed = null;
    unknown.requiredAbortReasons = ["INVALID_INPUT"];
    assert.equal(replayShadowWorkflowV1(unknown).holdoutResults[0]!.outcome, "SAFE_ABORT");
  });

  void it("does not accept a forged dependency digest or historical receipt", () => {
    const input = prepareFixture() as Data;
    input.holdouts[0].governed.dependencies.transitiveClosureDigest = "0".repeat(64);
    const result = replayShadowWorkflowV1(input);
    assert.equal(result.status, "SHADOW_REPLAY_ABORTED");
    assert.deepEqual(result.reasonCodes, ["INVALID_INPUT"]);

    const historical = {
      receiptId: "receipt:workflow-orders-1",
      subjectKind: "WORKFLOW",
      subjectId: "workflow/orders",
      subjectVersion: "1.0.0",
      subjectDigest: "2".repeat(64),
      knowledgeDependencySetDigest: "3".repeat(64),
      recordedTimeMs: 50,
      previousReceiptDigest: null,
      receiptDigest: "0".repeat(64),
    };
    historical.receiptDigest = governedAssetsDigestV1(historical, "receiptDigest");
    input.holdouts[0].governed.dependencies.historicalReceipts = [historical];
    assert.equal(replayShadowWorkflowV1(input).status, "SHADOW_REPLAY_ABORTED");
  });
});
