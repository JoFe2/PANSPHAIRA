import { readFileSync } from "node:fs";
import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import { governedAssetsDigestV1 } from "../../src/cks/governed-assets-v1.js";
import {
  evaluateShadowFastPathApplicabilityV1,
  evaluateWorkflowApplicabilityV1,
  WORKFLOW_APPLICABILITY_SCHEMA_V1,
  type WorkflowApplicabilityDecisionV1,
} from "../../src/cks/workflow-applicability-v1.js";

type Data = Record<string, any>;
const FIXTURE = JSON.parse(
  readFileSync("tests/fixtures/cks-11/applicability-boundary-cases-v1.json", "utf8"),
) as Data;

function input(overrides: Partial<Data> = {}): Data {
  return {
    ...structuredClone(FIXTURE),
    schemaVersion: WORKFLOW_APPLICABILITY_SCHEMA_V1,
    ...overrides,
  };
}

function evaluate(overrides: Partial<Data> = {}): WorkflowApplicabilityDecisionV1 {
  return evaluateWorkflowApplicabilityV1(input(overrides));
}

function assertRoute(
  result: WorkflowApplicabilityDecisionV1,
  status: WorkflowApplicabilityDecisionV1["status"],
  reason: WorkflowApplicabilityDecisionV1["reasonCodes"][number],
): void {
  assert.equal(result.status, status);
  assert.deepEqual(result.reasonCodes, [reason]);
  assert.equal(result.shadowReplay, status === "FAST_PATH_ALLOWED" ? "ALLOWED" : "ABORTED");
}

void describe("CKS-11 workflow applicability and shadow fast-path guard v1", () => {
  void it("allows one exact applicable match only with complete current inputs and unchanged envelopes", () => {
    const original = input();
    const result = evaluateShadowFastPathApplicabilityV1(original);
    assertRoute(result, "FAST_PATH_ALLOWED", "NONE");
    assert.equal(result.matchedWorkflowRef?.id, "workflow-orders-1");
    assert.equal(result.applicabilityDigest, original.applicabilityContract.contractDigest);
    assert.equal(result.knowledgeDecisionDigest !== null, true);
    assert.equal(result.capabilityEnvelopeDigest !== null, true);
    assert.equal(result.authorityEnvelopeDigest !== null, true);
    assert.equal(result.decisionDigest, evaluateShadowFastPathApplicabilityV1(original).decisionDigest);
    assert.equal(Object.isFrozen(result), true);
    assert.notEqual(result.matchedWorkflowRef, original.workflowMatches[0].workflowRef);
    assert.equal(Object.isFrozen(original.workflowMatches[0].workflowRef), false);
  });

  void it("requires a unique compatible match and rejects boundary mismatches", () => {
    assertRoute(evaluate({ workflowMatches: [] }), "FAST_PATH_ABORTED", "NOT_APPLICABLE");
    assertRoute(
      evaluate({ workflowMatches: [FIXTURE.workflowMatches[0], structuredClone(FIXTURE.workflowMatches[0])] }),
      "FAST_PATH_ABORTED",
      "AMBIGUOUS_MATCH",
    );
    assertRoute(
      evaluate({
        workflowMatches: [
          {
            ...structuredClone(FIXTURE.workflowMatches[0]),
            contextDigest: "e".repeat(64),
          },
        ],
      }),
      "FAST_PATH_ABORTED",
      "NOT_APPLICABLE",
    );
    assertRoute(
      evaluate({
        applicabilityContract: {
          ...structuredClone(FIXTURE.applicabilityContract),
          contractVersion: "1.0.1",
          contractDigest: "0".repeat(64),
        },
      }),
      "FAST_PATH_ABORTED",
      "INVALID_INPUT",
    );
  });

  void it("fails closed for missing, extra and incorrectly typed inputs", () => {
    const missing = structuredClone(FIXTURE.providedInputs);
    missing.pop();
    assertRoute(evaluate({ providedInputs: missing }), "FAST_PATH_ABORTED", "MISSING_INPUT");

    const wrongType = structuredClone(FIXTURE.providedInputs);
    wrongType[1] = { ...wrongType[1], type: "number", value: 0 };
    assertRoute(evaluate({ providedInputs: wrongType }), "FAST_PATH_ABORTED", "INVALID_INPUT");

    const extra = [...structuredClone(FIXTURE.providedInputs), { name: "unbound", type: "string", value: "x" }];
    assertRoute(evaluate({ providedInputs: extra }), "FAST_PATH_ABORTED", "INVALID_INPUT");
    assertRoute(evaluate({ inputSchema: undefined }), "FAST_PATH_ABORTED", "INVALID_INPUT");
  });

  void it("requires current Knowledge and use-time agreement", () => {
    const staleKnowledge = input();
    staleKnowledge.knowledgeInput.asOfMs = 1000;
    assertRoute(evaluateWorkflowApplicabilityV1(staleKnowledge), "REVALIDATION_REQUIRED", "STALE_KNOWLEDGE");

    const missingKnowledge = input();
    missingKnowledge.knowledgeInput.knowledgeRecords = [];
    assertRoute(evaluateWorkflowApplicabilityV1(missingKnowledge), "REVALIDATION_REQUIRED", "KNOWLEDGE_MISSING");

    const driftedKnowledge = input();
    driftedKnowledge.knowledgeInput.knowledgeRecords[0].version = "2026.08.29";
    assertRoute(evaluateWorkflowApplicabilityV1(driftedKnowledge), "REVALIDATION_REQUIRED", "VERSION_DRIFT");

    const mismatchedUseTime = input();
    mismatchedUseTime.knowledgeInput.asOfMs = 99;
    assertRoute(evaluateWorkflowApplicabilityV1(mismatchedUseTime), "REVALIDATION_REQUIRED", "VERSION_DRIFT");

    const malformedKnowledge = input();
    malformedKnowledge.knowledgeInput.workflowInputs[0].digest = "not-a-digest";
    assertRoute(evaluateWorkflowApplicabilityV1(malformedKnowledge), "FAST_PATH_ABORTED", "INVALID_INPUT");
  });

  void it("rejects Capability and Authority envelope changes or widening", () => {
    const capabilityDrift = input();
    capabilityDrift.capabilityEnvelope.currentEnabledCapabilities[0].action = "write";
    assertRoute(evaluateWorkflowApplicabilityV1(capabilityDrift), "FAST_PATH_ABORTED", "CAPABILITY_WIDENING");

    const capabilityWidening = input();
    capabilityWidening.capabilityEnvelope.requestedCapabilities[0].action = "write";
    assertRoute(evaluateWorkflowApplicabilityV1(capabilityWidening), "FAST_PATH_ABORTED", "CAPABILITY_WIDENING");

    const authorityDrift = input();
    authorityDrift.authorityEnvelope.currentGrants[0].tenant = "tenant-2";
    assertRoute(evaluateWorkflowApplicabilityV1(authorityDrift), "FAST_PATH_ABORTED", "AUTHORITY_WIDENING");

    const stopped = input();
    stopped.authorityEnvelope.stopState = "STOPPED";
    assertRoute(evaluateWorkflowApplicabilityV1(stopped), "FAST_PATH_ABORTED", "AUTHORITY_WIDENING");
  });

  void it("aborts unknown evidence and unavailable boundaries before replay", () => {
    assertRoute(evaluate({ evidenceStatus: "INCOMPLETE" }), "REVALIDATION_REQUIRED", "EVIDENCE_INCOMPLETE");
    assertRoute(evaluate({ boundaryStatus: "UNAVAILABLE" }), "REVALIDATION_REQUIRED", "BOUNDARY_UNAVAILABLE");
    assertRoute(evaluate({ unknownField: true }), "FAST_PATH_ABORTED", "INVALID_INPUT");
    assertRoute(evaluateWorkflowApplicabilityV1(null), "FAST_PATH_ABORTED", "INVALID_INPUT");
    assert.equal(governedAssetsDigestV1(FIXTURE.applicabilityContract, "contractDigest"), FIXTURE.applicabilityContract.contractDigest);
  });
});
