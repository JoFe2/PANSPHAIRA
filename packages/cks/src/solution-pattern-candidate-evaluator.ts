import {
  APPLICABILITY_RESULTS,
  P18_FIXTURE_CLASSES,
  cks09Digest,
  evaluateSolutionPatternV1,
  type CounterexampleRecordV1,
  type DenialReasonV1,
  type DiversityProofV1,
  type KnownFailureRecordV1,
  type P18FixtureClassV1,
  type SolutionPatternEvaluationContextV1,
  type SolutionPatternV1,
  type TaskFingerprintV1,
  type KnowledgeBundleV1,
  validateCounterevidenceAssessmentV1,
  validateDiversityProofV1,
  validateKnowledgeBundleV1,
  validateProvenanceRecordV1,
  validateSolutionPatternV1,
  validateTaskFingerprintV1,
} from "../../contracts/src/cks-task-fingerprint.js";
import { canonicalJson } from "../../contracts/src/canonical-json.js";

/** P18 is a candidate evaluator. It grants no authority and returns no procedure content. */
export const P18_PATTERN_CANDIDATE_EVALUATOR_SCHEMA_V1 = "pansphaira.cks/p18-pattern-candidate-evaluator/v1" as const;
export const SOLUTION_PATTERN_CANDIDATE_EVALUATOR_SCHEMA_V1 = P18_PATTERN_CANDIDATE_EVALUATOR_SCHEMA_V1;

export type PatternCandidateVerdictV1 = "ACCEPTED" | "DENIED";
export type PatternReuseVerdictV1 = "APPLICABLE_SHADOW_ONLY" | "DENIED";

export interface PatternCandidateReferenceProjectionV1 {
  readonly dependencyRefs: readonly string[];
  readonly evidenceRefs: readonly string[];
  readonly provenanceRefs: readonly string[];
  readonly knownFailureRefs: readonly string[];
  readonly counterexampleRefs: readonly string[];
  readonly versionConstraintRefs: readonly string[];
}

export interface PatternCandidateProofProjectionV1 {
  readonly proofId: string | null;
  readonly independentEpisodeRefs: readonly string[];
  readonly independentEpisodeCount: number;
  readonly distinctEpisodeDigestCount: number;
  readonly distinctContextShapeCount: number;
  readonly coveredVariantAxes: readonly string[];
}

export interface PatternReuseEvaluationV1 {
  readonly taskFingerprintDigest: string;
  readonly result: PatternReuseVerdictV1;
  readonly reason?: DenialReasonV1;
}

export interface PatternCandidateEvaluationV1 {
  readonly schemaVersion: typeof P18_PATTERN_CANDIDATE_EVALUATOR_SCHEMA_V1;
  readonly patternId: string;
  readonly verdict: PatternCandidateVerdictV1;
  readonly reason?: DenialReasonV1;
  readonly candidateOnly: true;
  readonly references: PatternCandidateReferenceProjectionV1 | null;
  readonly proof: PatternCandidateProofProjectionV1;
  readonly reuse: PatternReuseEvaluationV1 | null;
}

export interface PatternCandidateRequestV1 {
  readonly pattern: SolutionPatternV1;
  readonly context: SolutionPatternEvaluationContextV1;
  readonly task?: TaskFingerprintV1;
  readonly knowledgeBundle?: KnowledgeBundleV1;
}

export interface P18PatternCandidateCaseV1 {
  readonly caseId: string;
  readonly fixtureClass: P18FixtureClassV1;
  readonly request: PatternCandidateRequestV1;
}

export interface P18EvaluationInputV1 {
  readonly cases: readonly P18PatternCandidateCaseV1[];
}

export interface P18CaseResultV1 {
  readonly caseId: string;
  readonly fixtureClass: P18FixtureClassV1;
  readonly evaluation: PatternCandidateEvaluationV1;
}

export interface P18EvaluationResultV1 {
  readonly schemaVersion: typeof P18_PATTERN_CANDIDATE_EVALUATOR_SCHEMA_V1;
  readonly verdict: "PASS" | "DENIED" | "INCONCLUSIVE";
  readonly caseResults: readonly P18CaseResultV1[];
  readonly acceptedPatternIds: readonly string[];
  readonly deniedCaseIds: readonly string[];
  readonly reasons: readonly DenialReasonV1[];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value) && Object.getPrototypeOf(value) === Object.prototype;
}

function stableStrings(values: readonly string[]): string[] {
  return [...new Set(values)].sort((left, right) => left.localeCompare(right));
}

function stableUnique<T>(values: readonly T[], key: (value: T) => string): T[] {
  const result = new Map<string, T>();
  for (const value of values) result.set(key(value), value);
  return [...result.entries()].sort(([left], [right]) => left.localeCompare(right)).map(([, value]) => value);
}

function contextShape(value: unknown): value is SolutionPatternEvaluationContextV1 {
  if (!isRecord(value)) return false;
  const requiredArrays = [
    "families", "evidence", "provenance", "dependencies", "versionConstraints", "knownFailures",
    "counterexamples", "assessments", "diversityProofs", "episodes", "holdoutEpisodeDigests",
  ];
  return requiredArrays.every((field) => Array.isArray(value[field]));
}

function references(pattern: SolutionPatternV1): PatternCandidateReferenceProjectionV1 {
  return {
    dependencyRefs: [...pattern.dependencyRefs],
    evidenceRefs: [...pattern.evidenceRefs],
    provenanceRefs: [...pattern.provenanceRefs],
    knownFailureRefs: [...pattern.knownFailureRefs],
    counterexampleRefs: [...pattern.counterexampleRefs],
    versionConstraintRefs: [...pattern.versionConstraintRefs],
  };
}

function emptyProof(): PatternCandidateProofProjectionV1 {
  return {
    proofId: null,
    independentEpisodeRefs: [],
    independentEpisodeCount: 0,
    distinctEpisodeDigestCount: 0,
    distinctContextShapeCount: 0,
    coveredVariantAxes: [],
  };
}

function proofProjection(
  pattern: SolutionPatternV1,
  context: SolutionPatternEvaluationContextV1,
): { projection: PatternCandidateProofProjectionV1; proof: DiversityProofV1 | null; reason?: DenialReasonV1 } {
  const matchingProofs = context.diversityProofs.filter((item) => item.patternId === pattern.patternId);
  if (matchingProofs.length !== 1) return { projection: emptyProof(), proof: null, reason: "INVALID_DIVERSITY_PROOF" };
  const proof = matchingProofs[0] as DiversityProofV1;
  const proofReasons = validateDiversityProofV1(proof, {
    evidence: context.evidence,
    provenance: context.provenance,
    families: context.families,
    episodes: context.episodes,
    holdoutEpisodeDigests: context.holdoutEpisodeDigests,
  });
  const episodeByEvidence = new Map(context.evidence.map((item) => [item.evidenceId, item.taskFingerprintDigest]));
  const episodeByDigest = new Map(context.episodes.map((item) => [item.canonicalDigest, item]));
  const episodes = proof.independentEpisodeRefs.map((ref) => episodeByDigest.get(episodeByEvidence.get(ref) ?? ""));
  const projection: PatternCandidateProofProjectionV1 = {
    proofId: proof.proofId,
    independentEpisodeRefs: [...proof.independentEpisodeRefs],
    independentEpisodeCount: proof.independentEpisodeRefs.length,
    distinctEpisodeDigestCount: new Set(episodes.filter((item): item is TaskFingerprintV1 => item !== undefined).map((item) => item.canonicalDigest)).size,
    distinctContextShapeCount: new Set(episodes.filter((item): item is TaskFingerprintV1 => item !== undefined).map((item) => item.contextShapeId)).size,
    coveredVariantAxes: [...proof.coveredVariantAxes],
  };
  if (proofReasons.length > 0) return { projection, proof, reason: proofReasons[0] ?? "INVALID_DIVERSITY_PROOF" };
  if (proof.independentEpisodeRefs.some((ref) => !pattern.evidenceRefs.includes(ref))) {
    return { projection, proof, reason: "MISSING_EVIDENCE" };
  }
  return { projection, proof };
}

function referencesAreAdmitted(
  pattern: SolutionPatternV1,
  context: SolutionPatternEvaluationContextV1,
): DenialReasonV1 | undefined {
  const evidenceById = new Map(context.evidence.map((item) => [item.evidenceId, item]));
  const provenanceById = new Map(context.provenance.map((item) => [item.provenanceId, item]));
  for (const ref of pattern.provenanceRefs) {
    const provenance = provenanceById.get(ref);
    if (provenance === undefined || validateProvenanceRecordV1(provenance).length > 0) return "INVALID_PROVENANCE";
    if (!provenance.sealed) return "UNSEALED_HOLDOUT";
  }
  for (const ref of pattern.evidenceRefs) {
    const evidence = evidenceById.get(ref);
    if (evidence === undefined) return "MISSING_EVIDENCE";
    const provenance = provenanceById.get(evidence.provenanceRef);
    if (provenance === undefined || !pattern.provenanceRefs.includes(evidence.provenanceRef)
      || validateProvenanceRecordV1(provenance).length > 0 || !provenance.sealed) return "INVALID_PROVENANCE";
    if (evidence.outcomeDigest !== pattern.expectedOutcomeDigest) return "UNRESOLVED_FAILURE";
  }
  return undefined;
}

function referenceIntegrity(
  pattern: SolutionPatternV1,
  context: SolutionPatternEvaluationContextV1,
): DenialReasonV1 | undefined {
  const assessment = context.assessments.find((item) => item.assessmentId === pattern.counterevidenceAssessmentRef);
  if (assessment === undefined || validateCounterevidenceAssessmentV1(assessment).length > 0) return "ABSENT_COUNTEREVIDENCE";
  const referencedFailures = new Set(pattern.knownFailureRefs);
  const referencedCounterexamples = new Set(pattern.counterexampleRefs);
  const failures = context.knownFailures.filter((item) => referencedFailures.has(item.failureId));
  const counterexamples = context.counterexamples.filter((item) => referencedCounterexamples.has(item.counterexampleId));
  if (failures.length !== referencedFailures.size || counterexamples.length !== referencedCounterexamples.size) return "MISSING_EVIDENCE";
  if (canonicalJson(assessment.knownFailureRefs) !== canonicalJson(pattern.knownFailureRefs)
    || canonicalJson(assessment.counterexampleRefs) !== canonicalJson(pattern.counterexampleRefs)) return "ABSENT_COUNTEREVIDENCE";
  return undefined;
}

function candidateDenial(
  pattern: SolutionPatternV1,
  context: SolutionPatternEvaluationContextV1,
  proof: DiversityProofV1,
): DenialReasonV1 | undefined {
  const referenceReason = referencesAreAdmitted(pattern, context);
  if (referenceReason !== undefined) return referenceReason;
  const integrityReason = referenceIntegrity(pattern, context);
  if (integrityReason !== undefined) return integrityReason;
  const episodesByDigest = new Map(context.episodes.map((item) => [item.canonicalDigest, item]));
  const evidenceById = new Map(context.evidence.map((item) => [item.evidenceId, item]));
  for (const evidenceRef of proof.independentEpisodeRefs) {
    const evidence = evidenceById.get(evidenceRef);
    const episode = evidence === undefined ? undefined : episodesByDigest.get(evidence.taskFingerprintDigest);
    if (episode === undefined) return "MISSING_EVIDENCE";
    const evaluation = evaluateSolutionPatternV1(pattern, episode, context);
    if (evaluation.result !== APPLICABILITY_RESULTS[0]) return evaluation.reason ?? "AMBIGUOUS_APPLICABILITY";
  }
  return undefined;
}

function reuseEvaluation(
  pattern: SolutionPatternV1,
  task: unknown,
  context: SolutionPatternEvaluationContextV1,
): PatternReuseEvaluationV1 | null {
  if (task === undefined) return null;
  if (validateTaskFingerprintV1(task).length > 0) {
    return { taskFingerprintDigest: "invalid", result: "DENIED", reason: "PROSE_ONLY_INPUT" };
  }
  const fingerprint = task as TaskFingerprintV1;
  const evaluation = evaluateSolutionPatternV1(pattern, fingerprint, context);
  return evaluation.result === APPLICABILITY_RESULTS[0]
    ? { taskFingerprintDigest: fingerprint.canonicalDigest, result: "APPLICABLE_SHADOW_ONLY" }
    : { taskFingerprintDigest: fingerprint.canonicalDigest, result: "DENIED", reason: evaluation.reason ?? "AMBIGUOUS_APPLICABILITY" };
}

function denied(
  patternId: string,
  reason: DenialReasonV1,
  refs: PatternCandidateReferenceProjectionV1 | null,
  proof: PatternCandidateProofProjectionV1,
  reuse: PatternReuseEvaluationV1 | null,
): PatternCandidateEvaluationV1 {
  return {
    schemaVersion: P18_PATTERN_CANDIDATE_EVALUATOR_SCHEMA_V1,
    patternId,
    verdict: "DENIED",
    reason,
    candidateOnly: true,
    references: refs,
    proof,
    reuse,
  };
}

/**
 * Evaluate one planted SolutionPattern as a typed, candidate-only artifact.
 * Reuse is independently evaluated and remains shadow-only; similarity cannot repair a denial.
 */
export function evaluateSolutionPatternCandidateV1(input: unknown): PatternCandidateEvaluationV1 {
  const raw = isRecord(input) ? input : {};
  const rawPattern = raw.pattern;
  const patternId = isRecord(rawPattern) && typeof rawPattern.patternId === "string" ? rawPattern.patternId : "invalid";
  const validPattern = validateSolutionPatternV1(rawPattern);
  if (validPattern.length > 0 || !isRecord(rawPattern)) return denied(patternId, "PROSE_ONLY_INPUT", null, emptyProof(), null);
  const pattern = rawPattern as unknown as SolutionPatternV1;
  const refs = references(pattern);
  const rawContext = raw.context;
  if (!contextShape(rawContext)) return denied(patternId, "PROSE_ONLY_INPUT", refs, emptyProof(), null);
  const context = rawContext as SolutionPatternEvaluationContextV1;
  const reuse = reuseEvaluation(pattern, raw.task, context);
  if (raw.knowledgeBundle !== undefined && validateKnowledgeBundleV1(raw.knowledgeBundle).length > 0) {
    return denied(patternId, "INVALID_KNOWLEDGE_BUNDLE", refs, emptyProof(), reuse);
  }
  const proofResult = proofProjection(pattern, context);
  if (proofResult.reason !== undefined || proofResult.proof === null) {
    return denied(patternId, proofResult.reason ?? "INVALID_DIVERSITY_PROOF", refs, proofResult.projection, reuse);
  }
  const reason = candidateDenial(pattern, context, proofResult.proof);
  if (reason !== undefined) return denied(patternId, reason, refs, proofResult.projection, reuse);
  return {
    schemaVersion: P18_PATTERN_CANDIDATE_EVALUATOR_SCHEMA_V1,
    patternId,
    verdict: "ACCEPTED",
    candidateOnly: true,
    references: refs,
    proof: proofResult.projection,
    reuse,
  };
}

export const evaluatePatternCandidateV1 = evaluateSolutionPatternCandidateV1;

/** Evaluate a deterministic P18 fixture batch. Fixture labels are reporting metadata, never admission evidence. */
export function evaluateP18V1(input: unknown): P18EvaluationResultV1 {
  if (!isRecord(input) || !Array.isArray(input.cases) || input.cases.length === 0) {
    return {
      schemaVersion: P18_PATTERN_CANDIDATE_EVALUATOR_SCHEMA_V1,
      verdict: "INCONCLUSIVE",
      caseResults: [],
      acceptedPatternIds: [],
      deniedCaseIds: [],
      reasons: ["MISSING_EVIDENCE"],
    };
  }
  const cases = [...input.cases].sort((left, right) => {
    const leftId = isRecord(left) && typeof left.caseId === "string" ? left.caseId : "invalid";
    const rightId = isRecord(right) && typeof right.caseId === "string" ? right.caseId : "invalid";
    return leftId.localeCompare(rightId);
  });
  const caseResults: P18CaseResultV1[] = [];
  for (const rawCase of cases) {
    if (!isRecord(rawCase) || typeof rawCase.caseId !== "string" || !P18_FIXTURE_CLASSES.includes(rawCase.fixtureClass as P18FixtureClassV1)
      || !isRecord(rawCase.request)) {
      const evaluation = denied("invalid", "PROSE_ONLY_INPUT", null, emptyProof(), null);
      caseResults.push({ caseId: isRecord(rawCase) && typeof rawCase.caseId === "string" ? rawCase.caseId : "invalid", fixtureClass: "CORRELATION_TRAP", evaluation });
      continue;
    }
    const evaluation = evaluateSolutionPatternCandidateV1(rawCase.request);
    caseResults.push({ caseId: rawCase.caseId, fixtureClass: rawCase.fixtureClass as P18FixtureClassV1, evaluation });
  }
  const acceptedPatternIds = stableStrings(caseResults.filter((item) => item.evaluation.verdict === "ACCEPTED").map((item) => item.evaluation.patternId));
  const deniedCaseIds = stableStrings(caseResults.filter((item) => item.evaluation.verdict === "DENIED").map((item) => item.caseId));
  const reasons = stableUnique(
    caseResults.flatMap((item) => item.evaluation.reason === undefined ? [] : [item.evaluation.reason]),
    (reason) => reason,
  );
  const stableCases = caseResults.filter((item) => item.fixtureClass === "PLANTED_STABLE");
  const trapCases = caseResults.filter((item) => item.fixtureClass !== "PLANTED_STABLE");
  const labelsAreSatisfied = stableCases.length > 0 && stableCases.every((item) => item.evaluation.verdict === "ACCEPTED")
    && trapCases.length > 0 && trapCases.every((item) => item.evaluation.verdict === "DENIED");
  return {
    schemaVersion: P18_PATTERN_CANDIDATE_EVALUATOR_SCHEMA_V1,
    verdict: labelsAreSatisfied ? "PASS" : "DENIED",
    caseResults,
    acceptedPatternIds,
    deniedCaseIds,
    reasons,
  };
}

export const evaluatePatternCandidateBatchV1 = evaluateP18V1;
export const solutionPatternCandidateEvaluatorDigestV1 = (value: Record<string, unknown>): string => cks09Digest(value);

export type { CounterexampleRecordV1, KnownFailureRecordV1 };
