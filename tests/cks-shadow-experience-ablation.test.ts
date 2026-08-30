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

  type CounterevidenceAssessmentV1,
  type EvidenceRecordV1,
  type KnowledgeBundleV1,
  type ProvenanceRecordV1,
  type SolutionPatternV1,
  type SolutionPatternEvaluationContextV1,
  type TaskFamilyV1,
  type TaskFingerprintV1,
  type VersionConstraintV1,
} from "../packages/contracts/src/cks-task-fingerprint.js";
import {
  evaluateShadowExperienceAblationV1,
  type ShadowExperienceAblationInputV1,
} from "../packages/cks/src/shadow-experience-ablation.js";
import type { ReverseRetrievalCandidateV1 } from "../packages/cks/src/applicability-aware-retrieval.js";

const casesFixture = JSON.parse(readFileSync("tests/fixtures/cks-09/shadow-replay-cases-v1.json", "utf8")) as {
  readonly cases: readonly {
    readonly caseId: string;
    readonly holdoutVariantId: string;
    readonly knowledgeBundleDigest: string;
    readonly pairedRun: ShadowExperienceAblationInputV1["cases"][number]["pairedRun"];
  }[];
};
const denialsFixture = JSON.parse(readFileSync("tests/fixtures/cks-09/shadow-replay-denials-v1.json", "utf8")) as {
  readonly cases: readonly { readonly caseId: string; readonly expectedReason: string }[];
};
const groundTruthFixture = JSON.parse(readFileSync("tests/fixtures/cks-09/holdout-ground-truth-v1.json", "utf8")).p17;
const groundTruth = {
  ...groundTruthFixture,
  cases: casesFixture.cases.map((item) => ({
    ...groundTruthFixture.cases.find((truth: any) => truth.holdoutVariantId === item.holdoutVariantId),
    caseId: item.caseId,
  })),
};

function digestChar(char: string): string { return `sha256:${char.repeat(64)}`; }

function fingerprint(id: string, inputShapeId = "shape:document", contextShapeId = "context:batch"): TaskFingerprintV1 {
  const unsigned = {
    fingerprintId: id,
    taskFamilyId: "family:document-transform",
    objectiveShapeId: "shape:normalize",
    inputShapeId,
    outputShapeId: "shape:normalized",
    contextShapeId,
    constraintIds: ["constraint:safety"],
    effectClass: "READ_ONLY" as const,
    dependencyIds: [],
    versionVector: [{ componentId: "runtime:node", versionScheme: "OPAQUE_EXACT" as const, exactValue: "node-24.14.1" }],
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

function provenance(id: string, char: string): ProvenanceRecordV1 {
  return {
    provenanceId: id,
    sourceKind: "synthetic-fixture",
    sourceLocator: `fixture/${id}`,
    rootDigest: digestChar(char),
    parentDigests: [],
    producerId: "producer:cks09",
    toolchainVersionVector: [],
    sealed: true,
  };
}

function evidence(id: string, taskFingerprintDigest: string, kind: EvidenceRecordV1["kind"] = "OBSERVATION", provenanceRef = "provenance:fixture-a"): EvidenceRecordV1 {
  return { evidenceId: id, kind, sourceDigest: digestChar("e"), taskFingerprintDigest, outcomeDigest: digestChar("d"), provenanceRef };
}

function buildRetrieval(): { task: TaskFingerprintV1; candidate: ReverseRetrievalCandidateV1; context: SolutionPatternEvaluationContextV1 } {
  const task = fingerprint("task:holdout-001");
  const episodes = [
    fingerprint("task:episode-001", "shape:document", "context:batch"),
    fingerprint("task:episode-002", "shape:document-alt", "context:interactive"),
    fingerprint("task:episode-003", "shape:document-other", "context:batch"),
  ];
  const observations = [
    evidence("evidence:obs-001", episodes[0]!.canonicalDigest, "OBSERVATION", "provenance:fixture-a"),
    evidence("evidence:obs-002", episodes[1]!.canonicalDigest, "OBSERVATION", "provenance:fixture-b"),
    evidence("evidence:obs-003", episodes[2]!.canonicalDigest, "OBSERVATION", "provenance:fixture-c"),
  ];
  const contrast = evidence("evidence:contrast-001", episodes[0]!.canonicalDigest, "CONTRAST_PAIR", "provenance:fixture-a");
  const constraintUnsigned = {
    constraintId: "constraint:node-exact",
    componentId: "runtime:node",
    versionScheme: "OPAQUE_EXACT" as const,
    allowedExactValues: ["node-24.14.1"],
    evidenceRefs: ["evidence:obs-001"],
  };
  const versionConstraint: VersionConstraintV1 = { ...constraintUnsigned, canonicalDigest: cks09Digest(constraintUnsigned) };
  const assessmentUnsigned = {
    assessmentId: "assessment:search-001",
    searchEvidenceRefs: ["evidence:obs-002"],
    knownFailureRefs: [],
    counterexampleRefs: [],
    negativeControlRefs: ["evidence:contrast-001"],
    coverageStatus: "COMPLETE" as const,
  };
  const assessment: CounterevidenceAssessmentV1 = { ...assessmentUnsigned, canonicalDigest: counterevidenceAssessmentDigestV1(assessmentUnsigned) };
  const proofUnsigned = {
    proofId: "proof:stable-001",
    patternId: "pattern:normalize-document",
    independentEpisodeRefs: observations.map((item) => item.evidenceId),
    taskVariantIds: episodes.map((item) => item.fingerprintId).sort(),
    contextShapeIds: ["context:batch", "context:interactive"],
    coveredVariantAxes: ["contextShapeId", "inputShapeId"] as const,
    contrastPairRefs: [contrast.evidenceId],
    provenanceRefs: ["provenance:fixture-a", "provenance:fixture-b", "provenance:fixture-c"],
  };
  const proof = { ...proofUnsigned, canonicalDigest: diversityProofDigestV1(proofUnsigned) };
  const unsignedPattern = {
    patternId: "pattern:normalize-document",
    maturity: "S4" as const,
    taskFamilyIds: ["family:document-transform"],
    applicabilityClauses: [{ factPath: "/objectiveShapeId", operator: "EQ" as const, operand: "shape:normalize" }],
    preconditions: [{ factPath: "/effectClass", operator: "EQ" as const, operand: "READ_ONLY" }],
    procedureDigest: digestChar("c"),
    expectedOutcomeDigest: digestChar("d"),
    dependencyRefs: [],
    evidenceRefs: observations.map((item) => item.evidenceId),
    provenanceRefs: ["provenance:fixture-a", "provenance:fixture-b", "provenance:fixture-c"],
    knownFailureRefs: [],
    counterexampleRefs: [],
    counterevidenceAssessmentRef: assessment.assessmentId,
    versionConstraintRefs: [versionConstraint.constraintId],
  };
  const pattern: SolutionPatternV1 = { ...unsignedPattern, canonicalDigest: solutionPatternDigestV1(unsignedPattern) };
  const context: SolutionPatternEvaluationContextV1 = {
    families: [family()],
    evidence: [...observations, contrast],
    provenance: [provenance("provenance:fixture-a", "a"), provenance("provenance:fixture-b", "b"), provenance("provenance:fixture-c", "c")],
    dependencies: [],
    versionConstraints: [versionConstraint],
    knownFailures: [],
    counterexamples: [],
    assessments: [assessment],
    diversityProofs: [proof],
    episodes,
    holdoutEpisodeDigests: [],
    dependencyStateDigests: new Map(),
  };
  const bundle = JSON.parse(readFileSync("tests/fixtures/cks-09/contracts-valid-v1.json", "utf8")).knowledgeBundle as KnowledgeBundleV1;
  return { task, candidate: { pattern, knowledgeBundle: bundle }, context };
}

function input(): ShadowExperienceAblationInputV1 {
  const retrieval = buildRetrieval();
  return {
    evidenceAdmission: "ADMITTED",
    requiredEvidencePresent: true,
    holdoutSealed: true,
    replayMode: "SHADOW",
    externalStateChanged: false,
    modelsOrServicesCalled: false,
    procedureContentReturned: false,
    groundTruth,
    cases: casesFixture.cases.map((fixtureCase) => ({
      ...fixtureCase,
      task: retrieval.task,
      candidates: [retrieval.candidate],
      context: retrieval.context,
    })),
  };
}

test("shadow ablation replays paired arms and shows historical experience improves P17", () => {
  const first = evaluateShadowExperienceAblationV1(input());
  const second = evaluateShadowExperienceAblationV1(structuredClone(input()));
  assert.deepEqual(first, second);
  assert.deepEqual(first.reasons, [], JSON.stringify(first));
  assert.equal(first.verdict, "PASS");
  assert.equal(first.mode, "SIMULATION_OR_SHADOW_ONLY");
  assert.equal(first.externalStateChanged, false);
  assert.equal(first.modelsOrServicesCalled, false);
  assert.equal(first.procedureContentReturned, false);
  assert.ok(first.aggregate);
  assert.ok((first.aggregate?.qualityDelta ?? 0) > 0);
  assert.ok((first.aggregate?.costReduction ?? 0) > 0);
  assert.ok((first.aggregate?.efficiencyDelta ?? 0) > 0);
  for (const item of first.caseResults) {
    assert.equal(item.comparison.knowledgeOnly.outcome, "NO_MATCH");
    assert.equal(item.comparison.knowledgePlusExperience.outcome, "SELECTED");
    assert.equal(item.experienceSelected, true);
  }
});

test("P17 metrics come from retrieval execution and authoritative ground truth, not caller run labels or event counts", () => {
  const base = input();
  const expected = evaluateShadowExperienceAblationV1(base);
  const substituted = structuredClone(base) as any;
  for (const item of substituted.cases) {
    item.pairedRun.knowledgeOnly.checks = item.pairedRun.knowledgeOnly.checks.map((check: any) => ({ ...check, passed: true }));
    item.pairedRun.knowledgePlusExperience.checks = item.pairedRun.knowledgePlusExperience.checks.map((check: any) => ({ ...check, passed: false }));
    item.pairedRun.knowledgeOnly.costEvents = [{ eventId: "caller-cheap", kind: "CHECK_RUN" }];
    item.pairedRun.knowledgePlusExperience.costEvents = Array.from({ length: 20 }, (_, index) => ({ eventId: `caller-expensive-${index}`, kind: "TOOL_CALL" }));
  }
  const actual = evaluateShadowExperienceAblationV1(substituted);
  assert.equal(actual.verdict, "PASS");
  assert.deepEqual(actual.aggregate, expected.aggregate);
  assert.deepEqual(actual.caseResults.map((item) => item.metric), expected.caseResults.map((item) => item.metric));
});

test("paired-run substitution and caller re-digestion cannot manufacture a P17 PASS", () => {
  const substituted = structuredClone(input()) as any;
  substituted.cases[0].candidates = [];
  substituted.cases[0].pairedRun = structuredClone(substituted.cases[1].pairedRun);
  substituted.cases[0].pairedRun.holdoutVariantId = substituted.cases[0].holdoutVariantId;
  for (const arm of [substituted.cases[0].pairedRun.knowledgeOnly, substituted.cases[0].pairedRun.knowledgePlusExperience]) {
    arm.holdoutVariantId = substituted.cases[0].holdoutVariantId;
    arm.pairedRunKey[0] = substituted.cases[0].holdoutVariantId;
    arm.checks = arm.expectedCheckIds.map((checkId: string) => ({ checkId, passed: true }));
    arm.costEvents = [{ eventId: `redigested-${arm.holdoutVariantId}`, kind: "CHECK_RUN" }];
  }
  const result = evaluateShadowExperienceAblationV1(substituted);
  assert.notEqual(result.verdict, "PASS");
  assert.ok(result.reasons.includes("MISSING_EVIDENCE"));
});

test("the identical knowledge bundle is bound to both arms and output has no procedure content", () => {
  const result = evaluateShadowExperienceAblationV1(input());
  const reports = result.caseResults.flatMap((item) => item.comparison.knowledgePlusExperience.selected);
  assert.equal(new Set(reports.map((item) => item.knowledgeBundleId)).size, 1);
  assert.equal("procedureDigest" in reports[0]!, false);
});

test("shadow ablation fails closed for every denial fixture", () => {
  const base = input();
  for (const denial of denialsFixture.cases) {
    let mutated: unknown = base;
    if (denial.caseId === "case:missing-evidence") mutated = { ...base, requiredEvidencePresent: false };
    if (denial.caseId === "case:unsealed-holdout") mutated = { ...base, holdoutSealed: false };
    if (denial.caseId === "case:live-replay") mutated = { ...base, replayMode: "LIVE" };
    if (denial.caseId === "case:external-write") mutated = { ...base, externalStateChanged: true };
    if (denial.caseId === "case:bundle-mismatch") mutated = { ...base, cases: base.cases.map((item) => ({ ...item, knowledgeBundleDigest: digestChar("f") })) };
    if (denial.caseId === "case:holdout-leakage") mutated = {
      ...base,
      groundTruth: { ...base.groundTruth, cases: base.groundTruth.cases.map((item, index) => index === 0 ? { ...item, holdoutVariantId: "holdout:other" } : item) },
    };
    const result = evaluateShadowExperienceAblationV1(mutated);
    assert.ok(result.reasons.includes(denial.expectedReason as never), `${denial.caseId}: ${JSON.stringify(result)}`);
    assert.notEqual(result.verdict, "PASS", denial.caseId);
  }
});

test("simulation-only input remains deterministic and cannot request live replay", () => {
  const result = evaluateShadowExperienceAblationV1({ ...input(), replayMode: "LIVE" });
  assert.equal(result.verdict, "INCONCLUSIVE");
  assert.deepEqual(result.reasons, ["LIVE_REPLAY_FORBIDDEN"]);
});
