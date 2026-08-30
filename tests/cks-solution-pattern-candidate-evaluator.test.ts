import { readFileSync } from "node:fs";
import test from "node:test";
import assert from "node:assert/strict";
import {
  cks09Digest,
  counterevidenceAssessmentDigestV1,
  diversityProofDigestV1,
  solutionPatternDigestV1,
  taskFamilyDigestV1,
  taskFingerprintDigestV1,
  type CounterexampleRecordV1,
  type CounterevidenceAssessmentV1,
  type DiversityProofV1,
  type EvidenceRecordV1,
  type KnowledgeBundleV1,
  type KnownFailureRecordV1,
  type ProvenanceRecordV1,
  type SolutionPatternV1,
  type SolutionPatternEvaluationContextV1,
  type TaskFamilyV1,
  type TaskFingerprintV1,
  type VersionConstraintV1,
} from "../packages/contracts/src/cks-task-fingerprint.js";
import {
  evaluateP18V1,
  evaluateSolutionPatternCandidateV1,
  type PatternCandidateRequestV1,
} from "../packages/cks/src/solution-pattern-candidate-evaluator.js";

const caseFixture = JSON.parse(readFileSync("tests/fixtures/cks-09/pattern-candidate-cases-v1.json", "utf8")) as {
  readonly cases: readonly { readonly caseId: string; readonly fixtureClass: "PLANTED_STABLE" | "FREQUENCY_ONLY_TRAP" | "NARROW_CONTEXT_TRAP" | "CORRELATION_TRAP" }[];
};
const denialFixture = JSON.parse(readFileSync("tests/fixtures/cks-09/pattern-candidate-denials-v1.json", "utf8")) as {
  readonly cases: readonly { readonly caseId: string; readonly expectedReason: string }[];
};

function digestChar(char: string): string { return `sha256:${char.repeat(64)}`; }

function fingerprint(
  id: string,
  inputShapeId = "shape:document",
  contextShapeId = "context:batch",
  version = "node-24.14.1",
  effectClass: TaskFingerprintV1["effectClass"] = "READ_ONLY",
): TaskFingerprintV1 {
  const unsigned = {
    fingerprintId: id,
    taskFamilyId: "family:document-transform",
    objectiveShapeId: "shape:normalize",
    inputShapeId,
    outputShapeId: "shape:normalized",
    contextShapeId,
    constraintIds: ["constraint:safety"],
    effectClass,
    dependencyIds: ["dependency:parser"],
    versionVector: [{ componentId: "runtime:node", versionScheme: "OPAQUE_EXACT" as const, exactValue: version }],
  };
  return { ...unsigned, canonicalDigest: taskFingerprintDigestV1(unsigned) };
}

function family(): TaskFamilyV1 {
  const unsigned = {
    familyId: "family:document-transform",
    membershipClauses: [{ factPath: "/objectiveShapeId", operator: "EQ" as const, operand: "shape:normalize" }],
    invariantIds: ["invariant:normalized-output"],
    variantAxes: ["contextShapeId", "inputShapeId"] as const,
    exclusionClauses: [{ factPath: "/effectClass", operator: "EQ" as const, operand: "EXTERNAL_OR_IRREVERSIBLE" }],
    evidenceRefs: ["evidence:family-001"],
    provenanceRefs: ["provenance:fixture-a"],
  };
  return { ...unsigned, canonicalDigest: taskFamilyDigestV1(unsigned) };
}

function evidence(
  id: string,
  taskFingerprintDigest: string,
  outcomeDigest: string,
  kind: EvidenceRecordV1["kind"] = "OBSERVATION",
  provenanceRef = "provenance:fixture-a",
): EvidenceRecordV1 {
  return { evidenceId: id, kind, sourceDigest: digestChar("a"), taskFingerprintDigest, outcomeDigest, provenanceRef };
}

function provenance(id: string, rootChar: string): ProvenanceRecordV1 {
  return {
    provenanceId: id,
    sourceKind: "synthetic-fixture",
    sourceLocator: `fixture/${id}`,
    rootDigest: digestChar(rootChar),
    parentDigests: [],
    producerId: "producer:cks09",
    toolchainVersionVector: [],
    sealed: true,
  };
}

function makePattern(overrides: Partial<SolutionPatternV1> = {}): SolutionPatternV1 {
  const unsigned = {
    patternId: "pattern:normalize-document",
    maturity: "S4" as const,
    taskFamilyIds: ["family:document-transform"],
    applicabilityClauses: [{ factPath: "/objectiveShapeId", operator: "EQ" as const, operand: "shape:normalize" }],
    preconditions: [{ factPath: "/effectClass", operator: "EQ" as const, operand: "READ_ONLY" }],
    procedureDigest: digestChar("c"),
    expectedOutcomeDigest: digestChar("d"),
    dependencyRefs: ["dependency:parser"],
    evidenceRefs: ["evidence:obs-001", "evidence:obs-002", "evidence:obs-003"],
    provenanceRefs: ["provenance:fixture-a", "provenance:fixture-b", "provenance:fixture-c"],
    knownFailureRefs: ["failure:known-001"],
    counterexampleRefs: ["counterexample:similar-001"],
    counterevidenceAssessmentRef: "assessment:search-001",
    versionConstraintRefs: ["constraint:node-exact"],
    ...overrides,
  };
  return { ...unsigned, canonicalDigest: solutionPatternDigestV1(unsigned) };
}

interface BuiltContext {
  readonly task: TaskFingerprintV1;
  readonly context: SolutionPatternEvaluationContextV1;
  readonly pattern: SolutionPatternV1;
  readonly knowledgeBundle: KnowledgeBundleV1;
}

function buildContext(kind: "stable" | "frequency" | "narrow" | "correlation" = "stable"): BuiltContext {
  const task = fingerprint("task:holdout-001");
  const stableEpisodes = [
    fingerprint("task:episode-001", "shape:document", "context:batch"),
    fingerprint("task:episode-002", "shape:document-alt", "context:interactive"),
    fingerprint("task:episode-003", "shape:document-other", "context:batch"),
  ];
  const episodes = kind === "frequency"
    ? [stableEpisodes[0]!, { ...stableEpisodes[0]!, fingerprintId: "task:episode-002" }, stableEpisodes[1]!]
    : kind === "narrow"
      ? [
        fingerprint("task:episode-001", "shape:document", "context:batch"),
        fingerprint("task:episode-002", "shape:document-alt", "context:batch"),
        fingerprint("task:episode-003", "shape:document-other", "context:batch"),
      ]
      : stableEpisodes;
  const outcome = digestChar("d");
  const familyRecord = family();
  const evidenceRecords = [
    evidence("evidence:obs-001", episodes[0]!.canonicalDigest, outcome, "OBSERVATION", "provenance:fixture-a"),
    evidence("evidence:obs-002", episodes[1]!.canonicalDigest, outcome, "OBSERVATION", "provenance:fixture-b"),
    evidence("evidence:obs-003", episodes[2]!.canonicalDigest, outcome, "OBSERVATION", "provenance:fixture-c"),
    evidence("evidence:contrast-001", episodes[0]!.canonicalDigest, outcome, "CONTRAST_PAIR", "provenance:fixture-a"),
    evidence("evidence:failure-001", fingerprint("task:failure-001", "shape:document-failure").canonicalDigest, digestChar("f"), "KNOWN_FAILURE", "provenance:fixture-a"),
    evidence("evidence:counterexample-001", fingerprint("task:counterexample-001", "shape:other").canonicalDigest, digestChar("f"), "COUNTEREXAMPLE", "provenance:fixture-b"),
  ];
  const provenanceRecords = [provenance("provenance:fixture-a", "1"), provenance("provenance:fixture-b", "2"), provenance("provenance:fixture-c", "3")];
  const constraintUnsigned = {
    constraintId: "constraint:node-exact",
    componentId: "runtime:node",
    versionScheme: "OPAQUE_EXACT" as const,
    allowedExactValues: ["node-24.14.1"],
    evidenceRefs: ["evidence:obs-001"],
  };
  const versionConstraint: VersionConstraintV1 = { ...constraintUnsigned, canonicalDigest: cks09Digest(constraintUnsigned) };
  const dependency = {
    dependencyId: "dependency:parser",
    kind: "TOOL" as const,
    requiredStateDigest: digestChar("e"),
    versionConstraintRef: versionConstraint.constraintId,
    verificationEvidenceRef: "evidence:obs-001",
  };
  const failure: KnownFailureRecordV1 = {
    failureId: "failure:known-001",
    patternId: "pattern:normalize-document",
    taskFingerprintDigest: fingerprint("task:failure-001", "shape:document-failure").canonicalDigest,
    expectedOutcomeDigest: outcome,
    observedOutcomeDigest: digestChar("f"),
    evidenceRef: "evidence:failure-001",
    provenanceRef: "provenance:fixture-a",
    resolution: "BOUNDED_BY_PRECONDITION",
  };
  const counterexample: CounterexampleRecordV1 = {
    counterexampleId: "counterexample:similar-001",
    patternId: "pattern:normalize-document",
    taskFingerprintDigest: fingerprint("task:counterexample-001", "shape:other").canonicalDigest,
    matchedSimilarityFacts: ["objectiveShapeId=shape:normalize"],
    blockingStructuralDimension: "inputShapeId",
    expectedDenialReason: "MATCHED_COUNTEREXAMPLE",
    evidenceRef: "evidence:counterexample-001",
    provenanceRef: "provenance:fixture-b",
  };
  const assessmentUnsigned = {
    assessmentId: "assessment:search-001",
    searchEvidenceRefs: ["evidence:obs-002"],
    knownFailureRefs: [failure.failureId],
    counterexampleRefs: [counterexample.counterexampleId],
    negativeControlRefs: ["evidence:contrast-001"],
    coverageStatus: "COMPLETE" as const,
  };
  const assessment: CounterevidenceAssessmentV1 = { ...assessmentUnsigned, canonicalDigest: counterevidenceAssessmentDigestV1(assessmentUnsigned) };
  const proofUnsigned = {
    proofId: "proof:stable-001",
    patternId: "pattern:normalize-document",
    independentEpisodeRefs: ["evidence:obs-001", "evidence:obs-002", "evidence:obs-003"],
    taskVariantIds: episodes.map((item) => item.fingerprintId).sort(),
    contextShapeIds: [...new Set(episodes.map((item) => item.contextShapeId))].sort(),
    coveredVariantAxes: ["contextShapeId", "inputShapeId"] as const,
    contrastPairRefs: kind === "correlation" ? [] : ["evidence:contrast-001"],
    provenanceRefs: ["provenance:fixture-a", "provenance:fixture-b", "provenance:fixture-c"],
  };
  const proof: DiversityProofV1 = { ...proofUnsigned, canonicalDigest: diversityProofDigestV1(proofUnsigned) };
  const context: SolutionPatternEvaluationContextV1 = {
    families: [familyRecord],
    evidence: evidenceRecords,
    provenance: provenanceRecords,
    dependencies: [dependency],
    versionConstraints: [versionConstraint],
    knownFailures: [failure],
    counterexamples: [counterexample],
    assessments: [assessment],
    diversityProofs: [proof],
    episodes,
    holdoutEpisodeDigests: [],
    dependencyStateDigests: new Map([[dependency.dependencyId, dependency.requiredStateDigest]]),
  };
  const knowledgeBundle = JSON.parse(readFileSync("tests/fixtures/cks-09/contracts-valid-v1.json", "utf8")).knowledgeBundle as KnowledgeBundleV1;
  return { task, context, pattern: makePattern(), knowledgeBundle };
}

function request(built: BuiltContext, pattern = built.pattern, task?: TaskFingerprintV1): PatternCandidateRequestV1 {
  return {
    pattern,
    context: built.context,
    knowledgeBundle: built.knowledgeBundle,
    ...(task === undefined ? {} : { task }),
  };
}

test("P18 accepts the planted stable candidate and is deterministic", () => {
  const built = buildContext();
  const first = evaluateSolutionPatternCandidateV1(request(built, built.pattern, built.task));
  const second = evaluateSolutionPatternCandidateV1(structuredClone(request(built, built.pattern, built.task)));
  assert.equal(first.verdict, "ACCEPTED");
  assert.deepEqual(first, second);
  assert.equal(first.candidateOnly, true);
  assert.equal(first.reuse?.result, "APPLICABLE_SHADOW_ONLY");
  assert.deepEqual(first.references?.dependencyRefs, ["dependency:parser"]);
  assert.deepEqual(first.references?.knownFailureRefs, ["failure:known-001"]);
  assert.deepEqual(first.references?.counterexampleRefs, ["counterexample:similar-001"]);
  assert.deepEqual(first.references?.provenanceRefs, ["provenance:fixture-a", "provenance:fixture-b", "provenance:fixture-c"]);
  assert.equal(first.proof.independentEpisodeCount, 3);
  assert.equal(first.proof.distinctEpisodeDigestCount, 3);
  assert.equal(first.proof.distinctContextShapeCount, 2);
});

test("P18 rejects frequency-only, narrow-context and correlation traps", () => {
  const cases = [
    ["FREQUENCY_ONLY_TRAP", "INVALID_DIVERSITY_PROOF"],
    ["NARROW_CONTEXT_TRAP", "INVALID_DIVERSITY_PROOF"],
    ["CORRELATION_TRAP", "INVALID_DIVERSITY_PROOF"],
  ] as const;
  for (const [kind, reason] of cases) {
    const built = buildContext(kind === "FREQUENCY_ONLY_TRAP" ? "frequency" : kind === "NARROW_CONTEXT_TRAP" ? "narrow" : "correlation");
    const result = evaluateSolutionPatternCandidateV1(request(built));
    assert.equal(result.verdict, "DENIED", kind);
    assert.equal(result.reason, reason, kind);
  }
});

test("P18 denies similar-looking and exact-version drift reuse", () => {
  const built = buildContext();
  const similar = evaluateSolutionPatternCandidateV1(request(built, built.pattern, fingerprint("task:similar-001", "shape:document", "context:batch", "node-24.14.1", "REVERSIBLE_LOCAL")));
  const drift = evaluateSolutionPatternCandidateV1(request(built, built.pattern, fingerprint("task:drift-001", "shape:document", "context:batch", "node-24.15.0")));
  assert.equal(similar.verdict, "ACCEPTED");
  assert.equal(similar.reuse?.result, "DENIED");
  assert.equal(similar.reuse?.reason, "PRECONDITION_FALSE");
  assert.equal(drift.verdict, "ACCEPTED");
  assert.equal(drift.reuse?.result, "DENIED");
  assert.equal(drift.reuse?.reason, "VERSION_INCOMPATIBLE");
});

test("P18 fails closed for absent success evidence and prose input", () => {
  const built = buildContext();
  const missing = makePattern({ evidenceRefs: ["evidence:missing-001"] });
  const missingResult = evaluateSolutionPatternCandidateV1(request(built, missing));
  assert.equal(missingResult.verdict, "DENIED");
  assert.equal(missingResult.reason, "MISSING_EVIDENCE");
  const proseResult = evaluateSolutionPatternCandidateV1({ pattern: { patternId: "pattern:prose", procedure: "run this" }, context: built.context });
  assert.equal(proseResult.verdict, "DENIED");
  assert.equal(proseResult.reason, "PROSE_ONLY_INPUT");
  assert.equal(proseResult.candidateOnly, true);
});

test("P18 fixture batch reports stable identification and every trap denial", () => {
  const built = buildContext();
  const requests = new Map<string, PatternCandidateRequestV1>([
    ["case:planted-stable", request(built)],
    ["case:frequency-only", request(buildContext("frequency"))],
    ["case:narrow-context", request(buildContext("narrow"))],
    ["case:correlation", request(buildContext("correlation"))],
  ]);
  const result = evaluateP18V1({
    cases: caseFixture.cases.map((item) => ({ ...item, request: requests.get(item.caseId)! })),
  });
  assert.equal(result.verdict, "PASS");
  assert.deepEqual(result.acceptedPatternIds, ["pattern:normalize-document"]);
  assert.deepEqual(result.deniedCaseIds, ["case:correlation", "case:frequency-only", "case:narrow-context"]);
});

test("P18 denial fixture remains explicit and candidate output contains no procedure content", () => {
  const built = buildContext();
  const missingPattern = makePattern({ evidenceRefs: ["evidence:missing-001"] });
  const missing = evaluateSolutionPatternCandidateV1(request(built, missingPattern));
  const expectedMissing = denialFixture.cases.find((item) => item.caseId === "case:missing-evidence")?.expectedReason;
  assert.equal(missing.reason, expectedMissing);
  assert.equal("procedure" in missing, false);
  assert.equal("procedureContent" in missing, false);
});
