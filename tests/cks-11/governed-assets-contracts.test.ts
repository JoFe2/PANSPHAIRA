import { readFileSync } from "node:fs";
import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import {
  F_MATURITY_LEVELS_V1,
  FAST_PATH_ROUTE_STATUSES_V1,
  GOVERNED_ASSETS_SCHEMA_V1,
  S_MATURITY_LEVELS_V1,
  W_MATURITY_LEVELS_V1,
  evaluateFastPathRouteV1,
  governedAssetsDigestV1,
  governedAssetsKnowledgeSetDigestV1,
  governedAssetsRefSetDigestV1,
  validateFunctionCandidateV1,
  validateGovernedAssetRecordV1,
  validateGovernedWorkflowV1,
  validateWorkflowCandidateV1,
  verifyGovernedAssetReceiptV1,
} from "../../src/cks/governed-assets-v1.js";

type Data = Record<string, any>;
const DIGEST = "0".repeat(64);
const VALID_FIXTURE = JSON.parse(
  readFileSync("tests/fixtures/cks-11/governed-assets-valid-v1.json", "utf8"),
) as Data;
const INVALID_FIXTURE = JSON.parse(
  readFileSync("tests/fixtures/cks-11/governed-assets-invalid-v1.json", "utf8"),
) as Data;

function ref(kind: string, id = `${kind.toLowerCase()}-1`): Data {
  return {
    kind,
    id,
    schemaVersion: GOVERNED_ASSETS_SCHEMA_V1,
    version: "1.0.0",
    digestAlgorithm: "SHA-256",
    digest: DIGEST,
  };
}

function maturity(axis: "W" | "F", index: number): Data {
  const levels = axis === "W" ? W_MATURITY_LEVELS_V1 : F_MATURITY_LEVELS_V1;
  return {
    axis,
    level: levels[index],
    transitionReceiptRefs: Array.from({ length: index }, (_, i) =>
      ref("RECEIPT", `transition-${axis.toLowerCase()}-${i + 1}`),
    ),
  };
}

function body(): Data {
  const step = {
    stepId: "step-1",
    knowledgeReads: [],
    decisionContractRef: ref("SCHEMA"),
    capabilityProposalRef: ref("CAPABILITY_BOUNDARY"),
    verificationCheckpointRef: ref("VERIFICATION_PLAN"),
    abortBehavior: { routeStatus: "FAST_PATH_ABORTED", reasonCode: "INVALID_INPUT" },
  };
  const graph = {
    steps: [step],
    edges: [],
    orderingRules: ["step-1 before terminal success"],
    graphDigest: DIGEST,
  };
  graph.graphDigest = governedAssetsDigestV1({
    steps: graph.steps,
    edges: graph.edges,
    orderingRules: graph.orderingRules,
  });
  const knowledge = {
    recordId: "knowledge-1",
    schemaVersion: "knowledge/v1",
    edition: "2026.08.28",
    contentDigest: DIGEST,
    applicabilityDigest: DIGEST,
    evidenceDigest: DIGEST,
    validFromMs: 0,
    validUntilMs: 4102444800000,
    supersessionLineage: [],
  };
  const bodyValue: Data = {
    stepGraph: graph,
    materialContextDimensions: ["provider", "configuration"],
    inputContractRef: ref("SCHEMA"),
    outputContractRef: ref("SCHEMA"),
    preconditionContractRef: ref("SCHEMA"),
    postconditionContractRef: ref("SCHEMA"),
    errorContract: { errorTypeRefs: [ref("SCHEMA")] },
    terminalSuccess: {
      successCriteriaRef: ref("SCHEMA"),
      readbackRequired: true,
      readbackRefs: [ref("READBACK")],
    },
    shadowPlan: {
      baselineRef: ref("BASELINE_RUN_SET"),
      qualityMetricRef: ref("METRIC"),
      reasoningCostMetricRef: ref("METRIC"),
      holdoutRefs: [ref("HOLDOUT_SET")],
      counterexampleRefs: [ref("COUNTEREXAMPLE_SET")],
    },
    originalPathRef: ref("FALLBACK_PATH"),
    fallbackPathRef: ref("FALLBACK_PATH"),
    knowledgeDependencies: [knowledge],
    knowledgeDependencySetDigest: DIGEST,
    workflowDependencies: [],
    workflowDependencySetDigest: DIGEST,
    functionDependencies: [],
    functionDependencySetDigest: DIGEST,
    transitiveClosureDigest: DIGEST,
    verificationPlanRef: ref("VERIFICATION_PLAN"),
    evidenceRefs: [ref("EVIDENCE")],
    capabilityBoundaryRef: ref("CAPABILITY_BOUNDARY"),
    capabilityCeilingDigest: DIGEST,
    authorityRequirementRef: ref("AUTHORITY_REQUIREMENT"),
    authorityRequirementDigest: DIGEST,
    rollbackContract: {
      kind: "CONTRACT",
      contractRef: ref("ROLLBACK_CONTRACT"),
      lastKnownGoodRef: ref("LAST_KNOWN_GOOD"),
    },
    knownFailureRefs: [],
    exclusionRefs: [],
    counterexampleSetRefs: [ref("COUNTEREXAMPLE_SET")],
  };
  bodyValue.knowledgeDependencySetDigest = governedAssetsKnowledgeSetDigestV1(
    bodyValue.knowledgeDependencies,
  );
  bodyValue.workflowDependencySetDigest = governedAssetsRefSetDigestV1(
    bodyValue.workflowDependencies,
  );
  bodyValue.functionDependencySetDigest = governedAssetsRefSetDigestV1(
    bodyValue.functionDependencies,
  );
  return bodyValue;
}

function common(recordKind: string, axis: "W" | "F", index: number): Data {
  return {
    schemaVersion: GOVERNED_ASSETS_SCHEMA_V1,
    recordKind,
    artifactId: `${recordKind.toLowerCase()}-1`,
    artifactVersion: "1.0.0",
    maturity: maturity(axis, index),
    assuranceStatus: "VALIDATION_CURRENT",
    artifactDigest: DIGEST,
    predecessorRef: null,
    supersessionReason: null,
    canonicalizationRef: {
      name: "chimpmaera.canonical/json/v1",
      path: "packages/contracts/src/canonical-json.ts",
      version: "1",
      digest: "666513ba9a89c0eae0daa0e0159a262eb4e0aa105971a151a19bac1a9b6c4826",
    },
    digestAlgorithm: "SHA-256",
    applicabilityContractRef: ref("APPLICABILITY_CONTRACT"),
    applicabilityResultDigest: DIGEST,
    invalidationReceiptRefs: [],
    promotionReceiptRefs: [],
    verificationReceiptRefs: [],
  };
}

function validWorkflowCandidate(): Data {
  const record: Data = {
    ...common("WorkflowCandidate", "W", 0),
    sourceRef: ref("SOLUTION_PATTERN"),
    transformerRef: ref("COMPILER"),
    sourcePatternValidationReceiptRef: ref("RECEIPT"),
    body: body(),
    bodyDigest: DIGEST,
    eligibilityReceiptRef: null,
  };
  record.bodyDigest = governedAssetsDigestV1(record.body);
  record.artifactDigest = governedAssetsDigestV1(record, "artifactDigest");
  return record;
}

function validGovernedWorkflow(): Data {
  const candidate = validWorkflowCandidate();
  const record: Data = {
    ...common("GovernedWorkflow", "W", 6),
    sourceRef: ref("WORKFLOW_CANDIDATE"),
    transformerRef: ref("COMPILER"),
    sourceCandidateBodyDigest: candidate.bodyDigest,
    promotionApprovalRef: ref("APPROVAL"),
    promotionReceiptRef: ref("RECEIPT", "promotion-1"),
    promotionReceiptRefs: [ref("RECEIPT", "promotion-1")],
    body: candidate.body,
    bodyDigest: candidate.bodyDigest,
  };
  record.artifactDigest = governedAssetsDigestV1(record, "artifactDigest");
  return record;
}

function validFunctionCandidate(): Data {
  const record: Data = {
    ...common("FunctionCandidate", "F", 0),
    sourceRef: ref("WORKFLOW_CANDIDATE"),
    transformerRef: ref("EXTRACTOR"),
    sourceStepIds: ["step-1"],
    sourceSubgraphDigest: DIGEST,
    sourceSubstepClosureDigest: DIGEST,
    inputSchemaRef: ref("SCHEMA"),
    outputSchemaRef: ref("SCHEMA"),
    logicRef: ref("LOGIC"),
    logicAlgorithmVersion: "logic-1",
    logicImplementationDigest: DIGEST,
    logicKind: "PURE",
    capabilityRequestDigest: null,
    errorContract: { errorTypeRefs: [ref("SCHEMA")] },
    knowledgeDependencies: [],
    knowledgeDependencySetDigest: governedAssetsKnowledgeSetDigestV1([]),
    workflowDependencies: [],
    workflowDependencySetDigest: governedAssetsRefSetDigestV1([]),
    functionDependencies: [],
    functionDependencySetDigest: governedAssetsRefSetDigestV1([]),
    transitiveClosureDigest: DIGEST,
    verificationPlanRef: ref("VERIFICATION_PLAN"),
    evidenceRefs: [],
    capabilityBoundaryRef: ref("CAPABILITY_BOUNDARY"),
    capabilityCeilingDigest: DIGEST,
    authorityRequirementRef: ref("AUTHORITY_REQUIREMENT"),
    authorityRequirementDigest: DIGEST,
    rollbackContract: {
      kind: "CONTRACT",
      contractRef: ref("ROLLBACK_CONTRACT"),
      lastKnownGoodRef: ref("LAST_KNOWN_GOOD"),
    },
    knownFailureRefs: [],
    exclusionRefs: [],
    counterexampleSetRefs: [],
    originalStepFallbackRef: ref("FALLBACK_PATH"),
    parityVerifierRef: ref("PARITY_VERIFIER"),
    parityEvidenceRefs: [],
    extractionRationale: "Stable pure substep with exact source-step fallback.",
    eligibilityReceiptRef: null,
    fallbackReadbackRef: null,
  };
  record.artifactDigest = governedAssetsDigestV1(record, "artifactDigest");
  return record;
}

function fastPathInput(capability: Data): Data {
  return {
    useTimeMs: 1,
    contextDigest: DIGEST,
    matchedGovernedWorkflowRefs: [ref("GOVERNED_WORKFLOW")],
    inputCompletenessStatus: "COMPLETE",
    knowledgeStatus: "CURRENT",
    versionStatus: "EXACT",
    digestStatus: "MATCH",
    evidenceStatus: "COMPLETE",
    boundaryStatus: "AVAILABLE",
    capabilityCeiling: [capability],
    policyEnabledCapabilities: [capability],
    requestedCapabilities: [capability],
    authorityRequirements: [
      { actor: "worker-1", tenant: "tenant-1", action: "read", target: "fixture", scope: null },
    ],
    envelopeGrants: [
      {
        actor: "worker-1",
        tenant: "tenant-1",
        action: "read",
        target: "fixture",
        scope: null,
        approvalDigest: DIGEST,
        validFromMs: 0,
        validUntilMs: 2,
        budgetLimitCents: null,
      },
    ],
    stopState: "NONE",
  };
}

function verificationReceipt(): Data {
  const receipt: Data = {
    schemaVersion: GOVERNED_ASSETS_SCHEMA_V1,
    receiptKind: "VERIFICATION",
    receiptId: "verification-1",
    subjectRef: ref("WORKFLOW_CANDIDATE"),
    priorMaturity: null,
    resultingMaturity: null,
    priorAssuranceStatus: null,
    resultingAssuranceStatus: null,
    decisionStatus: "APPROVED",
    reasonCodes: ["NONE"],
    requestDigest: DIGEST,
    contextDigest: DIGEST,
    applicabilityResultDigest: DIGEST,
    knowledgeDependencySetDigest: DIGEST,
    workflowDependencySetDigest: DIGEST,
    functionDependencySetDigest: DIGEST,
    transitiveClosureDigest: DIGEST,
    capabilityCeilingDigest: DIGEST,
    capabilityUsedSetDigest: null,
    authorityRequirementDigest: DIGEST,
    effectiveAuthorityEnvelopeDigest: null,
    verificationPlanRef: ref("VERIFICATION_PLAN"),
    evidenceRefs: [],
    verifierRef: ref("VERIFIER"),
    rollbackContractRef: null,
    lastKnownGoodRef: null,
    approvalRef: null,
    activationApprovalRef: null,
    environmentRefs: [],
    previousReceiptDigest: null,
    recordedTimeMs: 1,
    decisionDigest: DIGEST,
    receiptDigest: DIGEST,
  };
  receipt.decisionDigest = governedAssetsDigestV1({
    subjectRef: receipt.subjectRef,
    decisionStatus: receipt.decisionStatus,
    reasonCodes: receipt.reasonCodes,
    contextDigest: receipt.contextDigest,
    recordedTimeMs: receipt.recordedTimeMs,
  });
  receipt.receiptDigest = governedAssetsDigestV1(receipt, "receiptDigest");
  return receipt;
}

function accepted(result: Data): void {
  assert.equal(result.outcome, "ACCEPTED");
  assert.equal(result.exitCode, 0);
  assert.deepEqual(result.reasonCodes, ["NONE"]);
}

void describe("CKS-11 governed asset contracts v1", () => {
  void it("keeps the S/W/F maturity axes and fixture boundary commitments closed", () => {
    assert.equal(VALID_FIXTURE.schemaVersion, GOVERNED_ASSETS_SCHEMA_V1);
    assert.deepEqual(VALID_FIXTURE.records, ["WorkflowCandidate", "GovernedWorkflow", "FunctionCandidate"]);
    assert.equal(S_MATURITY_LEVELS_V1.length, 7);
    assert.equal(W_MATURITY_LEVELS_V1.length, 7);
    assert.equal(F_MATURITY_LEVELS_V1.length, 7);
    assert.equal(INVALID_FIXTURE.capabilityWidening.ceilingAction, "read");
  });

  void it("accepts WorkflowCandidate, GovernedWorkflow and FunctionCandidate records", () => {
    const workflowCandidate = validWorkflowCandidate();
    const governedWorkflow = validGovernedWorkflow();
    const functionCandidate = validFunctionCandidate();
    accepted(validateWorkflowCandidateV1(workflowCandidate));
    accepted(validateGovernedWorkflowV1(governedWorkflow));
    accepted(validateFunctionCandidateV1(functionCandidate));
    accepted(validateGovernedAssetRecordV1(workflowCandidate));
    accepted(validateGovernedAssetRecordV1(governedWorkflow));
    accepted(validateGovernedAssetRecordV1(functionCandidate));
  });

  void it("requires W6 evidence to survive GovernedWorkflow promotion", () => {
    const governedWorkflow = validGovernedWorkflow();
    governedWorkflow.body.evidenceRefs = [];
    governedWorkflow.body.counterexampleSetRefs = [];
    governedWorkflow.body.shadowPlan.holdoutRefs = [];
    governedWorkflow.bodyDigest = governedAssetsDigestV1(governedWorkflow.body);
    governedWorkflow.sourceCandidateBodyDigest = governedWorkflow.bodyDigest;
    governedWorkflow.artifactDigest = governedAssetsDigestV1(governedWorkflow, "artifactDigest");

    const result = validateGovernedWorkflowV1(governedWorkflow);
    assert.equal(result.outcome, "REJECTED");
    assert.equal(result.reasonCodes.includes("MATURITY_TRANSITION_EVIDENCE_MISMATCH"), true);
  });

  void it("returns a detached, deeply immutable receipt of the accepted record", () => {
    const input = validWorkflowCandidate();
    const result = validateWorkflowCandidateV1(input);
    accepted(result);
    if (result.outcome !== "ACCEPTED") throw new Error("expected accepted result");
    assert.notEqual(result.record, input);
    assert.equal(Object.isFrozen(result.record), true);
    assert.equal(Object.isFrozen(result.record.body), true);
    input.body.materialContextDimensions.push("untrusted-runtime-context");
    assert.deepEqual(result.record.body.materialContextDimensions, ["provider", "configuration"]);
  });

  void it("fails closed on unknown fields, maturity skips, and dependency closure drift", () => {
    const unknown = validFunctionCandidate();
    unknown["unexpected"] = INVALID_FIXTURE.unknownField.field;
    assert.equal(validateFunctionCandidateV1(unknown).outcome, "REJECTED");

    const skipped = validWorkflowCandidate();
    skipped.maturity = maturity("W", 6);
    skipped.maturity.transitionReceiptRefs = [];
    assert.equal(validateWorkflowCandidateV1(skipped).outcome, "REJECTED");

    const drifted = validFunctionCandidate();
    drifted.maturity = maturity("F", 1);
    drifted.sourceSubstepClosureDigest = "e".repeat(64);
    drifted.transitiveClosureDigest = DIGEST;
    drifted.artifactDigest = governedAssetsDigestV1(drifted, "artifactDigest");
    const result = validateFunctionCandidateV1(drifted);
    assert.equal(result.outcome, "REJECTED");
    assert.equal(result.reasonCodes.includes("TRANSITIVE_CLOSURE_DRIFT"), true);
  });

  void it("binds exact Knowledge dependencies and rejects aliases or duplicates", () => {
    const knowledgeDrift = validWorkflowCandidate();
    knowledgeDrift.body.knowledgeDependencies[0].applicabilityDigest = "a".repeat(64);
    knowledgeDrift.bodyDigest = governedAssetsDigestV1(knowledgeDrift.body);
    knowledgeDrift.artifactDigest = governedAssetsDigestV1(
      knowledgeDrift,
      "artifactDigest",
    );
    const driftResult = validateWorkflowCandidateV1(knowledgeDrift);
    assert.equal(driftResult.outcome, "REJECTED");
    assert.equal(driftResult.reasonCodes.includes("DEPENDENCY_SET_DIGEST_MISMATCH"), true);

    const versionRange = validFunctionCandidate();
    versionRange.sourceRef.version = ">=1.0.0";
    versionRange.artifactDigest = governedAssetsDigestV1(versionRange, "artifactDigest");
    const versionResult = validateFunctionCandidateV1(versionRange);
    assert.equal(versionResult.outcome, "REJECTED");
    assert.equal(versionResult.reasonCodes.includes("BAD_STRING"), true);

    const editionAlias = validWorkflowCandidate();
    editionAlias.body.knowledgeDependencies[0].edition = "latest";
    editionAlias.body.knowledgeDependencySetDigest = governedAssetsKnowledgeSetDigestV1(
      editionAlias.body.knowledgeDependencies,
    );
    editionAlias.bodyDigest = governedAssetsDigestV1(editionAlias.body);
    editionAlias.artifactDigest = governedAssetsDigestV1(editionAlias, "artifactDigest");
    const editionResult = validateWorkflowCandidateV1(editionAlias);
    assert.equal(editionResult.outcome, "REJECTED");
    assert.equal(editionResult.reasonCodes.includes("BAD_STRING"), true);

    const duplicate = validWorkflowCandidate();
    duplicate.body.knowledgeDependencies.push(
      structuredClone(duplicate.body.knowledgeDependencies[0]),
    );
    duplicate.body.knowledgeDependencySetDigest = governedAssetsKnowledgeSetDigestV1(
      duplicate.body.knowledgeDependencies,
    );
    duplicate.bodyDigest = governedAssetsDigestV1(duplicate.body);
    duplicate.artifactDigest = governedAssetsDigestV1(duplicate, "artifactDigest");
    const duplicateResult = validateWorkflowCandidateV1(duplicate);
    assert.equal(duplicateResult.outcome, "REJECTED");
    assert.equal(duplicateResult.reasonCodes.includes("DUPLICATE_REF"), true);
  });

  void it("requires exact typed maturity evidence references", () => {
    const workflow = validWorkflowCandidate();
    workflow.eligibilityReceiptRef = ref("EVIDENCE", "workflow-eligibility");
    workflow.artifactDigest = governedAssetsDigestV1(workflow, "artifactDigest");
    const workflowResult = validateWorkflowCandidateV1(workflow);
    assert.equal(workflowResult.outcome, "REJECTED");
    assert.equal(workflowResult.reasonCodes.includes("REF_KIND_MISMATCH"), true);

    const functionEligibility = validFunctionCandidate();
    functionEligibility.eligibilityReceiptRef = ref("EVIDENCE", "function-eligibility");
    functionEligibility.artifactDigest = governedAssetsDigestV1(
      functionEligibility,
      "artifactDigest",
    );
    const eligibilityResult = validateFunctionCandidateV1(functionEligibility);
    assert.equal(eligibilityResult.outcome, "REJECTED");
    assert.equal(eligibilityResult.reasonCodes.includes("REF_KIND_MISMATCH"), true);

    const functionFallback = validFunctionCandidate();
    functionFallback.fallbackReadbackRef = ref("RECEIPT", "function-fallback-readback");
    functionFallback.artifactDigest = governedAssetsDigestV1(functionFallback, "artifactDigest");
    const fallbackResult = validateFunctionCandidateV1(functionFallback);
    assert.equal(fallbackResult.outcome, "REJECTED");
    assert.equal(fallbackResult.reasonCodes.includes("REF_KIND_MISMATCH"), true);
  });

  void it("preserves immutable, digest-bound historical receipts", () => {
    const result = verifyGovernedAssetReceiptV1(verificationReceipt());
    accepted(result);
    if (result.outcome !== "ACCEPTED") throw new Error("expected accepted result");
    assert.equal(Object.isFrozen(result.record), true);
    assert.equal(Object.isFrozen(result.record.subjectRef), true);

    const tampered = structuredClone(result.record) as Data;
    tampered.requestDigest = "f".repeat(64);
    assert.equal(verifyGovernedAssetReceiptV1(tampered).outcome, "REJECTED");
  });

  void it("rejects activation receipts because activation is outside the v1 authority boundary", () => {
    const activation = verificationReceipt();
    activation.receiptKind = "ACTIVATION";
    activation.activationApprovalRef = ref("APPROVAL", "activation-approval");
    activation.receiptDigest = governedAssetsDigestV1(activation, "receiptDigest");

    const result = verifyGovernedAssetReceiptV1(activation);
    assert.equal(result.outcome, "REJECTED");
    assert.equal(result.reasonCodes.includes("INVALID_CONTRACT"), true);
  });

  void it("allows only bounded fast paths and rejects capability or authority widening", () => {
    const capability = {
      action: "read",
      dataClass: "business",
      credentialUse: null,
      effectClass: "read-only",
      field: null,
      networkRoute: null,
      purpose: "verification",
      resource: "fixture",
      target: "fixture",
      tenant: "tenant-1",
    };
    const allowed = evaluateFastPathRouteV1(fastPathInput(capability));
    assert.equal(allowed.status, "FAST_PATH_ALLOWED");
    assert.deepEqual(allowed.reasonCodes, ["NONE"]);

    const capabilityWidening = evaluateFastPathRouteV1({
      ...fastPathInput(capability),
      requestedCapabilities: [{ ...capability, action: "write" }],
    });
    assert.equal(capabilityWidening.status, "FAST_PATH_ABORTED");
    assert.deepEqual(capabilityWidening.reasonCodes, ["CAPABILITY_WIDENING"]);
    assert.equal(FAST_PATH_ROUTE_STATUSES_V1.includes(capabilityWidening.status), true);

    const authorityWidening = evaluateFastPathRouteV1({
      ...fastPathInput(capability),
      authorityRequirements: [
        { actor: "worker-1", tenant: "tenant-2", action: "read", target: "fixture", scope: null },
      ],
    });
    assert.equal(authorityWidening.status, "FAST_PATH_ABORTED");
    assert.deepEqual(authorityWidening.reasonCodes, ["AUTHORITY_WIDENING"]);
  });
});
