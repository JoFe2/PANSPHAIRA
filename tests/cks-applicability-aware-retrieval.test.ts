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
  type TaskFamilyV1,
  type TaskFingerprintV1,
  type VersionConstraintV1,
} from "../packages/contracts/src/cks-task-fingerprint.js";
import {
  retrieveTaskToSuccessfulKnowledgeV1,
  type ReverseRetrievalCandidateV1,
  type ReverseTaskRetrievalRequestV1,
} from "../packages/cks/src/applicability-aware-retrieval.js";
import { canonicalJson } from "../packages/contracts/src/canonical-json.js";

const denials = JSON.parse(readFileSync("tests/fixtures/cks-09/retrieval-denials-v1.json", "utf8"));

function digestChar(char: string): string { return `sha256:${char.repeat(64)}`; }

function fingerprint(id: string, inputShapeId = "shape:document", contextShapeId = "context:batch", version = "node-24.14.1", effectClass: TaskFingerprintV1["effectClass"] = "READ_ONLY"): TaskFingerprintV1 {
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

function evidence(id: string, taskFingerprintDigest: string, outcomeDigest: string, kind: EvidenceRecordV1["kind"] = "OBSERVATION", provenanceRef = "provenance:fixture-a"): EvidenceRecordV1 {
  return { evidenceId: id, kind, sourceDigest: digestChar("a"), taskFingerprintDigest, outcomeDigest, provenanceRef };
}

function provenance(id: string, rootChar: string): ProvenanceRecordV1 {
  return { provenanceId: id, sourceKind: "synthetic-fixture", sourceLocator: `fixture/${id}`, rootDigest: digestChar(rootChar), parentDigests: [], producerId: "producer:cks09", toolchainVersionVector: [], sealed: true };
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

function buildContext(): { task: TaskFingerprintV1; candidate: ReverseRetrievalCandidateV1; context: ReverseTaskRetrievalRequestV1["context"]; trap: TaskFingerprintV1 } {
  const task = fingerprint("task:holdout-001");
  const episodes = [
    fingerprint("task:episode-001", "shape:document", "context:batch"),
    fingerprint("task:episode-002", "shape:document-alt", "context:interactive"),
    fingerprint("task:episode-003", "shape:document-other", "context:batch"),
  ];
  const trap = fingerprint("task:counterexample-001", "shape:other");
  const familyRecord = family();
  const evidenceRecords = [
    evidence("evidence:obs-001", episodes[0]!.canonicalDigest, digestChar("d"), "OBSERVATION", "provenance:fixture-a"),
    evidence("evidence:obs-002", episodes[1]!.canonicalDigest, digestChar("d"), "OBSERVATION", "provenance:fixture-b"),
    evidence("evidence:obs-003", episodes[2]!.canonicalDigest, digestChar("d"), "OBSERVATION", "provenance:fixture-c"),
    evidence("evidence:contrast-001", episodes[0]!.canonicalDigest, digestChar("d"), "CONTRAST_PAIR", "provenance:fixture-a"),
    evidence("evidence:failure-001", fingerprint("task:failure-001", "shape:document-failure").canonicalDigest, digestChar("f"), "KNOWN_FAILURE", "provenance:fixture-a"),
    evidence("evidence:counterexample-001", trap.canonicalDigest, digestChar("f"), "COUNTEREXAMPLE", "provenance:fixture-b"),
  ];
  const provenanceRecords = [provenance("provenance:fixture-a", "1"), provenance("provenance:fixture-b", "2"), provenance("provenance:fixture-c", "3")];
  const constraintUnsigned = { constraintId: "constraint:node-exact", componentId: "runtime:node", versionScheme: "OPAQUE_EXACT" as const, allowedExactValues: ["node-24.14.1"], evidenceRefs: ["evidence:obs-001"] };
  const versionConstraint: VersionConstraintV1 = { ...constraintUnsigned, canonicalDigest: cks09Digest(constraintUnsigned) };
  const dependency = { dependencyId: "dependency:parser", kind: "TOOL" as const, requiredStateDigest: digestChar("e"), versionConstraintRef: versionConstraint.constraintId, verificationEvidenceRef: "evidence:obs-001" };
  const assessmentUnsigned = { assessmentId: "assessment:search-001", searchEvidenceRefs: ["evidence:obs-002"], knownFailureRefs: ["failure:known-001"], counterexampleRefs: ["counterexample:similar-001"], negativeControlRefs: ["evidence:contrast-001"], coverageStatus: "COMPLETE" as const };
  const assessment: CounterevidenceAssessmentV1 = { ...assessmentUnsigned, canonicalDigest: counterevidenceAssessmentDigestV1(assessmentUnsigned) };
  const failure: KnownFailureRecordV1 = {
    failureId: "failure:known-001", patternId: "pattern:normalize-document", taskFingerprintDigest: fingerprint("task:failure-001", "shape:document-failure").canonicalDigest,
    expectedOutcomeDigest: digestChar("d"), observedOutcomeDigest: digestChar("f"), evidenceRef: "evidence:failure-001", provenanceRef: "provenance:fixture-a", resolution: "BOUNDED_BY_PRECONDITION",
  };
  const counterexample: CounterexampleRecordV1 = {
    counterexampleId: "counterexample:similar-001", patternId: "pattern:normalize-document", taskFingerprintDigest: trap.canonicalDigest,
    matchedSimilarityFacts: ["objectiveShapeId=shape:normalize"], blockingStructuralDimension: "inputShapeId", expectedDenialReason: "MATCHED_COUNTEREXAMPLE", evidenceRef: "evidence:counterexample-001", provenanceRef: "provenance:fixture-b",
  };
  const proofUnsigned = {
    proofId: "proof:stable-001", patternId: "pattern:normalize-document", independentEpisodeRefs: ["evidence:obs-001", "evidence:obs-002", "evidence:obs-003"],
    taskVariantIds: episodes.map((item) => item.fingerprintId).sort(), contextShapeIds: ["context:batch", "context:interactive"], coveredVariantAxes: ["contextShapeId", "inputShapeId"] as const,
    contrastPairRefs: ["evidence:contrast-001"], provenanceRefs: ["provenance:fixture-a", "provenance:fixture-b", "provenance:fixture-c"],
  };
  const proof: DiversityProofV1 = { ...proofUnsigned, canonicalDigest: diversityProofDigestV1(proofUnsigned) };
  const context = {
    families: [familyRecord], evidence: evidenceRecords, provenance: provenanceRecords, dependencies: [dependency], versionConstraints: [versionConstraint],
    knownFailures: [failure], counterexamples: [counterexample], assessments: [assessment], diversityProofs: [proof], episodes, holdoutEpisodeDigests: [],
    dependencyStateDigests: new Map([[dependency.dependencyId, dependency.requiredStateDigest]]),
  };
  const bundle = JSON.parse(readFileSync("tests/fixtures/cks-09/contracts-valid-v1.json", "utf8")).knowledgeBundle as KnowledgeBundleV1;
  const candidate = { pattern: makePattern(), knowledgeBundle: bundle };
  return { task, candidate, context, trap };
}


test("reverse retrieval gates similarity with applicability and preserves evidence reports", () => {
  const { task, candidate, context } = buildContext();
  const request = { task, candidates: [candidate], context, arm: "KNOWLEDGE_PLUS_EXPERIENCE" as const, replayMode: "SHADOW" as const };
  const first = retrieveTaskToSuccessfulKnowledgeV1(request);
  const second = retrieveTaskToSuccessfulKnowledgeV1(structuredClone(request));
  assert.equal(first.outcome, "SELECTED");
  assert.deepEqual(first, second);
  assert.equal(first.selected[0]?.result, "APPLICABLE_SHADOW_ONLY");
  assert.deepEqual(first.selected[0]?.dependencyRefs, ["dependency:parser"]);
  assert.deepEqual(first.selected[0]?.knownFailureRefs, ["failure:known-001"]);
  assert.deepEqual(first.selected[0]?.counterexampleRefs, ["counterexample:similar-001"]);
  assert.deepEqual(first.selected[0]?.provenanceRefs, ["provenance:fixture-a", "provenance:fixture-b", "provenance:fixture-c"]);
  assert.equal(first.selected[0]?.counterevidence?.coverageStatus, "COMPLETE");
});

test("similar-looking, counterexample, and version-drift tasks are denied for typed reasons", () => {
  const { task, candidate, context, trap } = buildContext();
  const cases = [
    ["case:similar-precondition", fingerprint("task:precondition-001", "shape:document", "context:batch", "node-24.14.1", "REVERSIBLE_LOCAL"), "PRECONDITION_FALSE"],
    ["case:version-drift", fingerprint("task:drift-001", "shape:document", "context:batch", "node-24.15.0"), "VERSION_INCOMPATIBLE"],
    ["case:counterexample", trap, "MATCHED_COUNTEREXAMPLE"],
    ["case:missing-context", { ...task, fingerprintId: "task:missing-context-001", canonicalDigest: taskFingerprintDigestV1({ ...task, fingerprintId: "task:missing-context-001" }) }, "AMBIGUOUS_APPLICABILITY"],
  ] as const;
  for (const [caseId, taskCase, expectedReason] of cases) {
    const pattern = caseId === "case:missing-context" ? makePattern({ applicabilityClauses: [{ factPath: "/missingFact", operator: "EQ", operand: "value" }] }) : candidate.pattern;
    const result = retrieveTaskToSuccessfulKnowledgeV1({ task: taskCase, candidates: [{ ...candidate, pattern }], context, replayMode: "SHADOW" });
    assert.equal(result.outcome, "DENIED", caseId);
    assert.equal(result.reports[0]?.reason, expectedReason, caseId);
  }
  for (const denial of denials.cases) assert.ok(["PRECONDITION_FALSE", "VERSION_INCOMPATIBLE", "MATCHED_COUNTEREXAMPLE", "AMBIGUOUS_APPLICABILITY", "MISSING_EVIDENCE"].includes(denial.expectedReason));
});

test("missing success evidence cannot be repaired by similarity", () => {
  const { task, candidate, context } = buildContext();
  const result = retrieveTaskToSuccessfulKnowledgeV1({ task, candidates: [{ ...candidate, successfulEvidenceRefs: [] }], context });
  assert.equal(result.outcome, "DENIED");
  assert.equal(result.reports[0]?.reason, "MISSING_EVIDENCE");
});

test("knowledge-only ablation never exposes a SolutionPattern candidate", () => {
  const { task, candidate, context } = buildContext();
  const result = retrieveTaskToSuccessfulKnowledgeV1({ task, candidates: [candidate], context, arm: "KNOWLEDGE_ONLY", replayMode: "SIMULATION" });
  assert.equal(result.outcome, "NO_MATCH");
  assert.deepEqual(result.selected, []);
  assert.deepEqual(result.reports, []);
  assert.equal(canonicalJson(result), canonicalJson(retrieveTaskToSuccessfulKnowledgeV1({ task, candidates: [candidate], context, arm: "KNOWLEDGE_ONLY", replayMode: "SIMULATION" })));
});
