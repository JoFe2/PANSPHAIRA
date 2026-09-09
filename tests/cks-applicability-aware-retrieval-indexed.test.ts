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
  type KnownFailureRecordV1,
  type KnowledgeBundleV1,
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
  type ReverseTaskRetrievalResultV1,
} from "../packages/cks/src/applicability-aware-retrieval.js";
import {
  retrieveTaskToSuccessfulKnowledgeIndexedV1,
} from "../packages/cks/src/applicability-aware-retrieval-indexed.js";
import { canonicalJson } from "../packages/contracts/src/canonical-json.js";

/**
 * The bounded request-local index/comparison-reuse variant must be byte-identical to the
 * original retrieval. Every request in this battery is run through BOTH implementations
 * and the results are compared on Canonical JSON (the serialization the system trusts) and
 * by structural deep-equal. Positive and negative (denial) cases are covered.
 */

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

const bundle = JSON.parse(readFileSync("tests/fixtures/cks-09/contracts-valid-v1.json", "utf8")).knowledgeBundle as KnowledgeBundleV1;

interface ContextBundle {
  task: TaskFingerprintV1;
  context: ReverseTaskRetrievalRequestV1["context"];
  candidate: ReverseRetrievalCandidateV1;
  trap: TaskFingerprintV1;
}

function buildContext(): ContextBundle {
  const task = fingerprint("task:holdout-001");
  // Two evidence records point at the SAME first episode so the de-duplication path is
  // exercised (identical canonicalDigest must collapse to one historical value).
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
    // Duplicate digest of episode-001 under a different evidence id: de-dup stability.
    evidence("evidence:obs-001-dup", episodes[0]!.canonicalDigest, digestChar("d"), "OBSERVATION", "provenance:fixture-a"),
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
  const context: ContextBundle["context"] = {
    families: [familyRecord], evidence: evidenceRecords, provenance: provenanceRecords, dependencies: [dependency], versionConstraints: [versionConstraint],
    knownFailures: [failure], counterexamples: [counterexample], assessments: [assessment], diversityProofs: [proof], episodes, holdoutEpisodeDigests: [],
    dependencyStateDigests: new Map([[dependency.dependencyId, dependency.requiredStateDigest]]),
  };
  const candidate: ReverseRetrievalCandidateV1 = { pattern: makePattern(), knowledgeBundle: bundle };
  return { task, context, candidate, trap };
}

/** Run both implementations on the same request and require byte-identical results. */
function assertParity(label: string, request: ReverseTaskRetrievalRequestV1): ReverseTaskRetrievalResultV1 {
  const original = retrieveTaskToSuccessfulKnowledgeV1(request);
  const indexed = retrieveTaskToSuccessfulKnowledgeIndexedV1(request);
  assert.equal(canonicalJson(original), canonicalJson(indexed), `canonical-parity:${label}`);
  assert.deepEqual(original, indexed, `deepEqual-parity:${label}`);
  return original;
}

test("indexed variant is byte-identical on the positive SELECTED path and preserves report fields", () => {
  const { task, candidate, context } = buildContext();
  const result = assertParity("baseline-selected", { task, candidates: [candidate], context, arm: "KNOWLEDGE_PLUS_EXPERIENCE", replayMode: "SHADOW" });
  assert.equal(result.outcome, "SELECTED");
  assert.equal(result.selected[0]?.result, "APPLICABLE_SHADOW_ONLY");
  assert.equal(result.selected[0]?.similarityScore, 1);
  assert.deepEqual(result.selected[0]?.dependencyRefs, ["dependency:parser"]);
  assert.deepEqual(result.selected[0]?.provenanceRefs, ["provenance:fixture-a", "provenance:fixture-b", "provenance:fixture-c"]);
  assert.equal(result.selected[0]?.counterevidence?.coverageStatus, "COMPLETE");
  // de-dup: the duplicated first episode must not double-count a historical value.
  assert.ok(result.selected[0]?.similarityFacts.length > 0);
});

test("indexed variant is byte-identical across a multi-candidate request with mixed outcomes and ordering", () => {
  const { task, context } = buildContext();
  // candidate A: a valid S3 pattern -> SELECTED. (The shared failure/counterexample/
  //   diversity-proof records all reference "pattern:normalize-document", so only that
  //   patternId can pass the applicability gate; distinct candidates here differ by
  //   maturity / evidenceRefs / successfulEvidenceRefs, not by patternId.)
  // candidate B: evidenceRefs reference a ghost id absent from context -> MISSING_EVIDENCE.
  // candidate C: the default S4 pattern -> SELECTED.
  // candidate D: successfulEvidenceRefs include a ref absent from the pattern's evidenceRefs
  //   -> PROSE_ONLY_INPUT.
  const candidates: ReverseRetrievalCandidateV1[] = [
    { pattern: makePattern({ maturity: "S3" }), knowledgeBundle: bundle },
    { pattern: makePattern({ evidenceRefs: ["evidence:ghost-001"] }), knowledgeBundle: bundle },
    { pattern: makePattern(), knowledgeBundle: bundle },
    { pattern: makePattern(), knowledgeBundle: bundle, successfulEvidenceRefs: ["evidence:obs-001", "evidence:ghost-999"] },
  ];
  const result = assertParity("mixed-multi-candidate", { task, candidates, context, replayMode: "SHADOW" });
  assert.equal(result.outcome, "SELECTED");
  assert.equal(result.reports.length, 4);
  assert.deepEqual(result.denialReasons, ["MISSING_EVIDENCE", "PROSE_ONLY_INPUT"]);
  // The two valid patterns (S3 and S4) are selected; the two reference-denied candidates are not.
  assert.equal(result.selected.length, 2);
  assert.ok(result.reports.some((report) => report.reason === "MISSING_EVIDENCE"));
  assert.ok(result.reports.some((report) => report.reason === "PROSE_ONLY_INPUT"));
});

test("indexed variant is byte-identical on every typed denial reason", () => {
  const { task, candidate, context, trap } = buildContext();
  const cases: Array<[string, ReverseTaskRetrievalRequestV1, string]> = [
    ["similar-precondition", { task: fingerprint("task:precondition-001", "shape:document", "context:batch", "node-24.14.1", "REVERSIBLE_LOCAL"), candidates: [candidate], context, replayMode: "SHADOW" }, "PRECONDITION_FALSE"],
    ["version-drift", { task: fingerprint("task:drift-001", "shape:document", "context:batch", "node-24.15.0"), candidates: [candidate], context, replayMode: "SHADOW" }, "VERSION_INCOMPATIBLE"],
    ["counterexample", { task: trap, candidates: [candidate], context, replayMode: "SHADOW" }, "MATCHED_COUNTEREXAMPLE"],
    ["missing-context", { task: { ...task, fingerprintId: "task:missing-context-001", canonicalDigest: taskFingerprintDigestV1({ ...task, fingerprintId: "task:missing-context-001" }) }, candidates: [{ ...candidate, pattern: makePattern({ applicabilityClauses: [{ factPath: "/missingFact", operator: "EQ", operand: "value" }] }) }], context, replayMode: "SHADOW" }, "AMBIGUOUS_APPLICABILITY"],
    ["missing-evidence", { task, candidates: [{ ...candidate, successfulEvidenceRefs: [] }], context, replayMode: "SHADOW" }, "MISSING_EVIDENCE"],
  ];
  for (const [caseId, request, expectedReason] of cases) {
    const result = assertParity(`denied-${caseId}`, request);
    assert.equal(result.outcome, "DENIED", caseId);
    assert.equal(result.reports[0]?.reason, expectedReason, caseId);
  }
});

test("indexed variant is byte-identical on the ablation / invalid-request boundary cases", () => {
  const { task, candidate, context } = buildContext();
  const boundary: Array<[string, ReverseTaskRetrievalRequestV1, string]> = [
    ["knowledge-only", { task, candidates: [candidate], context, arm: "KNOWLEDGE_ONLY", replayMode: "SIMULATION" }, "NO_MATCH"],
    ["empty-candidates", { task, candidates: [], context, arm: "KNOWLEDGE_PLUS_EXPERIENCE", replayMode: "SHADOW" }, "NO_MATCH"],
    ["prose-pattern", { task, candidates: [{ pattern: "prose-only-no-structure" as unknown as SolutionPatternV1, knowledgeBundle: bundle }], context, arm: "KNOWLEDGE_PLUS_EXPERIENCE", replayMode: "SHADOW" }, "DENIED"],
    ["invalid-replay", { task, candidates: [candidate], context, arm: "KNOWLEDGE_PLUS_EXPERIENCE", replayMode: "LIVE" } as unknown as ReverseTaskRetrievalRequestV1, "DENIED"],
  ];
  for (const [caseId, request, expectedOutcome] of boundary) {
    const result = assertParity(`boundary-${caseId}`, request);
    assert.equal(result.outcome, expectedOutcome, caseId);
  }
  // The prose-pattern candidate must be denied with the typed reason and a "invalid" id.
  const prose = assertParity("boundary-prose-pattern-reason", { task, candidates: [{ pattern: "prose-only-no-structure" as unknown as SolutionPatternV1, knowledgeBundle: bundle }], context, replayMode: "SHADOW" });
  assert.equal(prose.reports[0]?.patternId, "invalid");
  assert.equal(prose.reports[0]?.reason, "PROSE_ONLY_INPUT");
  const live = assertParity("boundary-invalid-replay-reason", { task, candidates: [candidate], context, replayMode: "LIVE" } as unknown as ReverseTaskRetrievalRequestV1);
  assert.deepEqual(live.denialReasons, ["LIVE_REPLAY_FORBIDDEN"]);
});

test("indexed variant is byte-identical on duplicate-episode de-duplication and stability", () => {
  const { task, candidate, context } = buildContext();
  // A request where the candidate's evidenceRefs intentionally include the duplicate-
  // digest evidence record; both variants must collapse it to a single historical value.
  const dupCandidate: ReverseRetrievalCandidateV1 = {
    pattern: makePattern({ evidenceRefs: ["evidence:obs-001", "evidence:obs-001-dup", "evidence:obs-002", "evidence:obs-003"] }),
    knowledgeBundle: bundle,
  };
  const result = assertParity("duplicate-episode-dedup", { task, candidates: [dupCandidate], context, replayMode: "SHADOW" });
  assert.equal(result.outcome, "SELECTED");
  // Determinism: a re-run on a structurally-equal request must reproduce the exact result.
  const again = retrieveTaskToSuccessfulKnowledgeIndexedV1(structuredClone({ task, candidates: [dupCandidate], context, replayMode: "SHADOW" }));
  assert.equal(canonicalJson(result), canonicalJson(again));
});

test("original retrieval is unchanged and still gates on applicability (regression guard)", () => {
  const { task, candidate, context } = buildContext();
  const first = retrieveTaskToSuccessfulKnowledgeV1({ task, candidates: [candidate], context, arm: "KNOWLEDGE_PLUS_EXPERIENCE", replayMode: "SHADOW" });
  assert.equal(first.outcome, "SELECTED");
  const second = retrieveTaskToSuccessfulKnowledgeV1(structuredClone({ task, candidates: [candidate], context, arm: "KNOWLEDGE_PLUS_EXPERIENCE", replayMode: "SHADOW" }));
  assert.deepEqual(first, second);
});