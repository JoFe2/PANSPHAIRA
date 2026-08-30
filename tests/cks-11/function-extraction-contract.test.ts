import { readFileSync } from "node:fs";
import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import {
  GOVERNED_ASSETS_SCHEMA_V1,
  governedAssetsDigestV1,
  governedAssetsKnowledgeSetDigestV1,
  governedAssetsRefSetDigestV1,
} from "../../src/cks/governed-assets-v1.js";
import {
  FUNCTION_EXTRACTION_SCHEMA_V1,
  validateFunctionCandidateEligibilityV1,
} from "../../src/cks/function-extraction-v1.js";

type Data = Record<string, any>;
const DIGEST = "0".repeat(64);
const CASES = JSON.parse(
  readFileSync("tests/fixtures/cks-11/function-candidate-cases-v1.json", "utf8"),
) as Data;

function ref(kind: string, id: string, digest = DIGEST): Data {
  return {
    kind,
    id,
    schemaVersion: GOVERNED_ASSETS_SCHEMA_V1,
    version: "1.0.0",
    digestAlgorithm: "SHA-256",
    digest,
  };
}

function capability(action: string): Data {
  return {
    action,
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
}

function authority(): Data {
  return { actor: "worker-1", tenant: "tenant-1", action: "read", target: "fixture", scope: null };
}

function typedContract(fieldName: string): Data {
  const contract: Data = {
    schemaVersion: FUNCTION_EXTRACTION_SCHEMA_V1,
    contractVersion: "1.0.0",
    fields: [{ name: fieldName, type: "string", required: true }],
    additionalProperties: false,
    contractDigest: DIGEST,
  };
  contract.contractDigest = governedAssetsDigestV1(contract, "contractDigest");
  return contract;
}

function makeInput(): Data {
  const workflowDigest = governedAssetsDigestV1({ workflow: "workflow-1", revision: "1.0.0" });
  const workflowRef = ref("WORKFLOW_CANDIDATE", "workflow-1", workflowDigest);
  const closureDigest = governedAssetsRefSetDigestV1([]);
  const stepSubgraphDigest = governedAssetsDigestV1({ stepIds: ["step-1"], graph: "stable" });
  const stableSubstep: Data = {
    schemaVersion: FUNCTION_EXTRACTION_SCHEMA_V1,
    sourceWorkflowRef: workflowRef,
    sourceWorkflowDigest: workflowDigest,
    stepIds: ["step-1"],
    subgraphDigest: stepSubgraphDigest,
    stabilityEvidenceRefs: [ref("EVIDENCE", "stability-evidence")],
    stabilityStatus: "STABLE",
    stableSubstepDigest: DIGEST,
  };
  stableSubstep.stableSubstepDigest = governedAssetsDigestV1(stableSubstep, "stableSubstepDigest");

  const sourceWorkflow = {
    workflowRef,
    workflowDigest,
    maturityLevel: "W6 PROMOTION_ELIGIBLE",
    assuranceStatus: "VALIDATION_CURRENT",
    stepIds: ["step-1"],
    stableSubstepIds: ["step-1"],
    dependencyClosureDigest: closureDigest,
  };
  const inputContract = typedContract("request");
  const outputContract = typedContract("result");
  const logicRef = ref("LOGIC", "logic-1");
  const logicContract: Data = {
    schemaVersion: FUNCTION_EXTRACTION_SCHEMA_V1,
    logicRef,
    algorithmVersion: "logic-1.0.0",
    implementationDigest: DIGEST,
    logicKind: "PURE",
    deterministic: true,
    forbiddenInputs: [],
    logicDigest: DIGEST,
  };
  logicContract.logicDigest = governedAssetsDigestV1(logicContract, "logicDigest");
  const errorTypeRef = ref("SCHEMA", "error-types-1");
  const errorContract: Data = {
    schemaVersion: FUNCTION_EXTRACTION_SCHEMA_V1,
    contractVersion: "1.0.0",
    errorTypeRefs: [errorTypeRef],
    errorCodes: [{ code: "INVALID_REQUEST", outputType: "object", terminal: true }],
    exhaustive: true,
    errorDigest: DIGEST,
  };
  errorContract.errorDigest = governedAssetsDigestV1(errorContract, "errorDigest");

  const receiptRef = ref("RECEIPT", "verification-1");
  const parityVerifierRef = ref("PARITY_VERIFIER", "parity-verifier-1");
  const parityEvidenceRef = ref("EVIDENCE", "parity-evidence-1");
  const candidate: Data = {
    schemaVersion: GOVERNED_ASSETS_SCHEMA_V1,
    recordKind: "FunctionCandidate",
    artifactId: "function-1",
    artifactVersion: "1.0.0",
    maturity: {
      axis: "F",
      level: "F6 PROMOTION_ELIGIBLE",
      transitionReceiptRefs: Array.from({ length: 6 }, (_, index) => ref("RECEIPT", `transition-f-${index + 1}`)),
    },
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
    sourceRef: workflowRef,
    transformerRef: ref("EXTRACTOR", "extractor-1"),
    applicabilityContractRef: ref("APPLICABILITY_CONTRACT", "applicability-1"),
    applicabilityResultDigest: DIGEST,
    invalidationReceiptRefs: [],
    promotionReceiptRefs: [],
    verificationReceiptRefs: [receiptRef],
    sourceStepIds: ["step-1"],
    sourceSubgraphDigest: stepSubgraphDigest,
    sourceSubstepClosureDigest: closureDigest,
    inputSchemaRef: ref("SCHEMA", "input-schema-1", inputContract.contractDigest),
    outputSchemaRef: ref("SCHEMA", "output-schema-1", outputContract.contractDigest),
    logicRef,
    logicAlgorithmVersion: logicContract.algorithmVersion,
    logicImplementationDigest: logicContract.implementationDigest,
    logicKind: logicContract.logicKind,
    capabilityRequestDigest: null,
    errorContract: { errorTypeRefs: [errorTypeRef] },
    knowledgeDependencies: [],
    knowledgeDependencySetDigest: governedAssetsKnowledgeSetDigestV1([]),
    workflowDependencies: [],
    workflowDependencySetDigest: closureDigest,
    functionDependencies: [],
    functionDependencySetDigest: governedAssetsRefSetDigestV1([]),
    transitiveClosureDigest: closureDigest,
    verificationPlanRef: ref("VERIFICATION_PLAN", "verification-plan-1"),
    evidenceRefs: [ref("EVIDENCE", "replay-evidence-1")],
    capabilityBoundaryRef: ref("CAPABILITY_BOUNDARY", "capability-boundary-1"),
    capabilityCeilingDigest: DIGEST,
    authorityRequirementRef: ref("AUTHORITY_REQUIREMENT", "authority-1"),
    authorityRequirementDigest: DIGEST,
    rollbackContract: {
      kind: "CONTRACT",
      contractRef: ref("ROLLBACK_CONTRACT", "rollback-1"),
      lastKnownGoodRef: ref("LAST_KNOWN_GOOD", "lkg-1"),
    },
    knownFailureRefs: [],
    exclusionRefs: [],
    counterexampleSetRefs: [ref("COUNTEREXAMPLE_SET", "counterexamples-1")],
    originalStepFallbackRef: ref("FALLBACK_PATH", "fallback-step-1"),
    parityVerifierRef,
    parityEvidenceRefs: [parityEvidenceRef],
    extractionRationale: "Stable pure substep with exact source-step fallback.",
    eligibilityReceiptRef: ref("RECEIPT", "eligibility-1"),
    fallbackReadbackRef: ref("READBACK", "fallback-readback-1"),
  };
  candidate.artifactDigest = governedAssetsDigestV1(candidate, "artifactDigest");

  const evidenceLinks = {
    sourceEvidenceRefs: [ref("EVIDENCE", "stability-evidence")],
    replayEvidenceRefs: [ref("EVIDENCE", "replay-evidence-1")],
    counterexampleEvidenceRefs: [ref("EVIDENCE", "counterexample-evidence-1")],
    parityEvidenceRefs: [parityEvidenceRef],
    verificationReceiptRefs: [receiptRef],
    rollbackEvidenceRefs: [ref("EVIDENCE", "rollback-evidence-1")],
  };
  const dependencyLinks = {
    knowledgeDependencies: [],
    knowledgeDependencySetDigest: governedAssetsKnowledgeSetDigestV1([]),
    workflowDependencies: [],
    workflowDependencySetDigest: closureDigest,
    functionDependencies: [],
    functionDependencySetDigest: governedAssetsRefSetDigestV1([]),
    transitiveClosureDigest: closureDigest,
  };
  const boundary = {
    sourceCapabilities: [capability("read")],
    candidateCapabilities: [capability("read")],
    sourceAuthorityRequirements: [authority()],
    candidateAuthorityRequirements: [authority()],
    capabilityCeilingDigest: DIGEST,
    authorityRequirementDigest: DIGEST,
  };
  const p20Parity = {
    schemaVersion: FUNCTION_EXTRACTION_SCHEMA_V1,
    originalResultDigest: DIGEST,
    candidateResultDigest: DIGEST,
    parityDigest: governedAssetsDigestV1({ originalResultDigest: DIGEST, candidateResultDigest: DIGEST, mismatchCount: 0 }),
    deterministicReplayDigest: governedAssetsDigestV1({ replay: "request-1", output: "result-1" }),
    resultKind: "TYPED_OUTPUT_OR_DECLARED_ERROR",
    mismatchCount: 0,
    parityVerifierRef,
    evidenceRefs: [parityEvidenceRef],
  };
  return {
    schemaVersion: FUNCTION_EXTRACTION_SCHEMA_V1,
    candidate,
    sourceWorkflow,
    stableSubstep,
    inputContract,
    outputContract,
    logicContract,
    errorContract,
    evidenceLinks,
    dependencyLinks,
    historicalReceipts: [{ receiptRef, receiptDigest: receiptRef.digest, previousReceiptDigest: null, immutable: true }],
    verification: {
      verificationPlanRef: candidate.verificationPlanRef,
      verifierRef: ref("VERIFIER", "verifier-1"),
      verificationReceiptRefs: [receiptRef],
      sourceCheckpointRefs: [candidate.verificationPlanRef],
      readbackRef: ref("READBACK", "terminal-readback-1"),
    },
    rollback: {
      rollbackContractRef: candidate.rollbackContract.contractRef,
      lastKnownGoodRef: candidate.rollbackContract.lastKnownGoodRef,
      originalStepFallbackRef: candidate.originalStepFallbackRef,
      fallbackReadbackRef: candidate.fallbackReadbackRef,
      rollbackReceiptRef: ref("RECEIPT", "rollback-1"),
    },
    boundary,
    p20Parity,
  };
}

void describe("CKS-11 Function extraction eligibility contract v1", () => {
  void it("accepts only a complete deterministic P20 Function candidate", () => {
    assert.equal(CASES.positive.expected, "ELIGIBLE");
    const input = makeInput();
    const result = validateFunctionCandidateEligibilityV1(input);
    assert.equal(result.outcome, "ELIGIBLE");
    assert.equal(result.status, "ELIGIBLE");
    assert.deepEqual(result.reasonCodes, []);
    assert.equal(result.exitCode, 0);
    assert.equal(Object.isFrozen(result), true);
    assert.equal(Object.isFrozen(result.candidate), true);
    assert.notEqual(result.candidate, input.candidate);
  });

  void it("fails closed when any required evidence or closed contract is absent", () => {
    const cases = CASES.negative as Array<{ name: string; reason: string }>;
    for (const testCase of cases) {
      const input = makeInput() as Data;
      switch (testCase.name) {
        case "missing-stability-evidence":
          input.stableSubstep.stabilityEvidenceRefs = [];
          break;
        case "unknown-input-contract-field":
          input.inputContract.unexpected = true;
          break;
        case "logic-uses-clock":
          input.logicContract.forbiddenInputs = ["clock"];
          input.logicContract.logicDigest = governedAssetsDigestV1(input.logicContract, "logicDigest");
          break;
        case "dependency-closure-drift":
          input.dependencyLinks.transitiveClosureDigest = "f".repeat(64);
          break;
        case "missing-p20-parity-evidence":
          input.p20Parity.evidenceRefs = [];
          break;
        case "capability-widening":
          input.boundary.candidateCapabilities = [capability("write")];
          break;
        case "authority-widening":
          input.boundary.candidateAuthorityRequirements = [{ ...authority(), tenant: "tenant-2" }];
          break;
        case "missing-rollback-readback":
          input.rollback.fallbackReadbackRef = null;
          break;
        case "tampered-historical-receipt":
          input.historicalReceipts[0].receiptDigest = "e".repeat(64);
          break;
        default:
          throw new Error(`unhandled fixture case: ${testCase.name}`);
      }
      const result = validateFunctionCandidateEligibilityV1(input);
      assert.equal(result.outcome, "REJECTED", testCase.name);
      assert.equal(result.reasonCodes.some((reason) => reason === testCase.reason), true, testCase.name);
      assert.notEqual(result.exitCode, 0, testCase.name);
      assert.equal("candidate" in result, false, testCase.name);
    }
  });

  void it("keeps exact dependency and receipt links detached and immutable", () => {
    const input = makeInput();
    const result = validateFunctionCandidateEligibilityV1(input);
    assert.equal(result.outcome, "ELIGIBLE");
    if (result.outcome !== "ELIGIBLE") throw new Error("expected eligibility");
    input.dependencyLinks.workflowDependencies.push(ref("WORKFLOW_CANDIDATE", "forged"));
    input.historicalReceipts[0].previousReceiptDigest = "a".repeat(64);
    assert.deepEqual(result.candidate?.workflowDependencies, []);
    assert.equal(Object.isFrozen(result.candidate?.verificationReceiptRefs), true);
  });
});
