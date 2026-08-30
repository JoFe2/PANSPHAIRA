import {
  APPLICABILITY_RESULTS,
  CHARGED_COST_EVENTS,
  DENIAL_REASONS,
  RETRIEVAL_ARMS,
  REPLAY_MODES,
  TASK_FINGERPRINT_STRUCTURAL_DIMENSIONS,
  cks09Digest,
  evaluateSolutionPatternV1,
  type CounterexampleRecordV1,
  type DenialReasonV1,
  type DependencyRecordV1,
  type EvidenceRecordV1,
  type KnownFailureRecordV1,
  type ProvenanceRecordV1,
  type SolutionPatternEvaluationContextV1,
  type SolutionPatternV1,
  type StructuralDimensionV1,
  type TaskFingerprintV1,
  type KnowledgeBundleV1,
  validateKnowledgeBundleV1,
  validateProvenanceRecordV1,
  validateTaskFingerprintV1,
} from "../../contracts/src/cks-task-fingerprint.js";
import { canonicalJson } from "../../contracts/src/canonical-json.js";

/** The retrieval result is a comparison record, never executable procedure content. */
export const APPLICABILITY_AWARE_RETRIEVAL_SCHEMA_V1 = "pansphaira.cks/applicability-aware-retrieval/v1" as const;
export const P17_RETRIEVAL_COMPARISON_SCHEMA_V1 = "pansphaira.cks/p17-retrieval-comparison/v1" as const;

export type RetrievalOutcomeV1 = "SELECTED" | "NO_MATCH" | "DENIED";
export type DifferenceResolutionV1 = "RESOLVED_VARIANT" | "UNRESOLVED";

export interface ReverseRetrievalCandidateV1 {
  readonly pattern: SolutionPatternV1;
  readonly knowledgeBundle: KnowledgeBundleV1;
  /** Optional explicit success evidence. When omitted, it is derived from pattern.evidenceRefs. */
  readonly successfulEvidenceRefs?: readonly string[];
}

export interface StructuralDifferenceV1 {
  readonly dimension: StructuralDimensionV1;
  readonly requestedValue: unknown;
  readonly historicalValues: readonly unknown[];
  readonly resolution: DifferenceResolutionV1;
}

export interface CounterevidenceReportV1 {
  readonly assessmentId: string;
  readonly coverageStatus: "COMPLETE" | "INCOMPLETE";
  readonly searchEvidenceRefs: readonly string[];
  readonly negativeControlRefs: readonly string[];
  readonly knownFailures: readonly KnownFailureRecordV1[];
  readonly counterexamples: readonly CounterexampleRecordV1[];
}

export interface RetrievalCandidateReportV1 {
  readonly patternId: string;
  readonly result: "APPLICABLE_SHADOW_ONLY" | "DENIED";
  readonly reason?: DenialReasonV1;
  readonly similarityScore: number;
  readonly similarityFacts: readonly string[];
  readonly unresolvedDifferences: readonly StructuralDifferenceV1[];
  readonly counterevidence: CounterevidenceReportV1 | null;
  readonly dependencyRefs: readonly string[];
  readonly provenanceRefs: readonly string[];
  readonly knownFailureRefs: readonly string[];
  readonly counterexampleRefs: readonly string[];
  readonly knowledgeBundleId: string | null;
}

export interface ReverseTaskRetrievalRequestV1 {
  readonly task: TaskFingerprintV1;
  readonly candidates: readonly ReverseRetrievalCandidateV1[];
  readonly context: SolutionPatternEvaluationContextV1;
  readonly arm?: (typeof RETRIEVAL_ARMS)[number];
  readonly replayMode?: (typeof REPLAY_MODES)[number];
}

export interface ReverseTaskRetrievalResultV1 {
  readonly schemaVersion: typeof APPLICABILITY_AWARE_RETRIEVAL_SCHEMA_V1;
  readonly outcome: RetrievalOutcomeV1;
  readonly arm: (typeof RETRIEVAL_ARMS)[number];
  readonly replayMode: (typeof REPLAY_MODES)[number];
  readonly selected: readonly RetrievalCandidateReportV1[];
  readonly reports: readonly RetrievalCandidateReportV1[];
  readonly denialReasons: readonly DenialReasonV1[];
}

const dimensions = [...TASK_FINGERPRINT_STRUCTURAL_DIMENSIONS] as readonly StructuralDimensionV1[];

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value) && Object.getPrototypeOf(value) === Object.prototype;
}

function sameValue(left: unknown, right: unknown): boolean {
  try {
    return canonicalJson(left) === canonicalJson(right);
  } catch {
    return false;
  }
}

function stableUnique<T>(values: readonly T[], key: (value: T) => string): T[] {
  const byKey = new Map<string, T>();
  for (const value of values) byKey.set(key(value), value);
  return [...byKey.entries()].sort(([left], [right]) => left.localeCompare(right)).map(([, value]) => value);
}

function fingerprintValue(task: TaskFingerprintV1, dimension: StructuralDimensionV1): unknown {
  return task[dimension];
}

function historicalEpisodes(
  pattern: SolutionPatternV1,
  context: SolutionPatternEvaluationContextV1,
): TaskFingerprintV1[] {
  const evidenceById = new Map(context.evidence.map((item) => [item.evidenceId, item]));
  const episodesByDigest = new Map(context.episodes.map((item) => [item.canonicalDigest, item]));
  const episodes: TaskFingerprintV1[] = [];
  for (const ref of pattern.evidenceRefs) {
    const evidence = evidenceById.get(ref);
    const episode = evidence === undefined ? undefined : episodesByDigest.get(evidence.taskFingerprintDigest);
    if (episode !== undefined && validateTaskFingerprintV1(episode).length === 0) episodes.push(episode);
  }
  return stableUnique(episodes, (item) => item.canonicalDigest);
}

function similarity(
  requested: TaskFingerprintV1,
  episodes: readonly TaskFingerprintV1[],
): { score: number; facts: string[]; differences: StructuralDifferenceV1[] } {
  const facts: string[] = [];
  const differences: StructuralDifferenceV1[] = [];
  for (const dimension of dimensions) {
    const requestedValue = fingerprintValue(requested, dimension);
    const historicalValues = stableUnique(
      episodes.map((episode) => fingerprintValue(episode, dimension)),
      (value) => canonicalJson(value),
    );
    if (historicalValues.some((value) => sameValue(value, requestedValue))) {
      facts.push(`${dimension}=${canonicalJson(requestedValue)}`);
    } else if (historicalValues.length > 0) {
      differences.push({
        dimension,
        requestedValue,
        historicalValues,
        resolution: "UNRESOLVED",
      });
    }
  }
  const total = dimensions.length;
  return { score: total === 0 ? 0 : facts.length / total, facts: facts.sort(), differences };
}

function markVariantDifferences(
  differences: readonly StructuralDifferenceV1[],
  context: SolutionPatternEvaluationContextV1,
  task: TaskFingerprintV1,
): StructuralDifferenceV1[] {
  const family = context.families.find((item) => item.familyId === task.taskFamilyId);
  const axes = new Set(family?.variantAxes ?? []);
  return differences.map((difference) => ({
    ...difference,
    resolution: axes.has(difference.dimension) ? "RESOLVED_VARIANT" : "UNRESOLVED",
  }));
}

function counterevidenceReport(
  pattern: SolutionPatternV1,
  context: SolutionPatternEvaluationContextV1,
): CounterevidenceReportV1 | null {
  const assessment = context.assessments.find((item) => item.assessmentId === pattern.counterevidenceAssessmentRef);
  if (assessment === undefined) return null;
  const knownFailures = context.knownFailures.filter((item) => pattern.knownFailureRefs.includes(item.failureId));
  const counterexamples = context.counterexamples.filter((item) => pattern.counterexampleRefs.includes(item.counterexampleId));
  return {
    assessmentId: assessment.assessmentId,
    coverageStatus: assessment.coverageStatus,
    searchEvidenceRefs: [...assessment.searchEvidenceRefs],
    negativeControlRefs: [...assessment.negativeControlRefs],
    knownFailures,
    counterexamples,
  };
}

function candidateReferenceDenial(
  candidate: ReverseRetrievalCandidateV1,
  context: SolutionPatternEvaluationContextV1,
): DenialReasonV1 | undefined {
  const bundleReasons = validateKnowledgeBundleV1(candidate.knowledgeBundle);
  if (bundleReasons.length > 0) return "INVALID_KNOWLEDGE_BUNDLE";
  const provenanceById = new Map(context.provenance.map((item) => [item.provenanceId, item]));
  for (const reference of candidate.knowledgeBundle.provenanceRefs) {
    const provenance = provenanceById.get(reference);
    if (provenance === undefined || !provenance.sealed || validateProvenanceRecordV1(provenance).length > 0) return "INVALID_PROVENANCE";
  }
  const evidenceById = new Map(context.evidence.map((item) => [item.evidenceId, item]));
  const successRefs = candidate.successfulEvidenceRefs ?? candidate.pattern.evidenceRefs;
  if (successRefs.length === 0) return "MISSING_EVIDENCE";
  if (successRefs.some((reference) => !candidate.pattern.evidenceRefs.includes(reference))) return "PROSE_ONLY_INPUT";
  for (const reference of successRefs) {
    const evidence = evidenceById.get(reference);
    if (evidence === undefined) return "MISSING_EVIDENCE";
    if (evidence.outcomeDigest !== candidate.pattern.expectedOutcomeDigest) return "UNRESOLVED_FAILURE";
  }
  return undefined;
}

function makeReport(
  candidate: ReverseRetrievalCandidateV1,
  task: TaskFingerprintV1,
  context: SolutionPatternEvaluationContextV1,
): RetrievalCandidateReportV1 {
  const patternId = isRecord(candidate.pattern) && typeof candidate.pattern.patternId === "string" ? candidate.pattern.patternId : "invalid";
  const pattern = candidate.pattern;
  const episodes = isRecord(pattern) ? historicalEpisodes(pattern, context) : [];
  const match = validateTaskFingerprintV1(task).length === 0 && isRecord(pattern)
    ? similarity(task, episodes)
    : { score: 0, facts: [], differences: [] };
  const unresolvedDifferences = markVariantDifferences(match.differences, context, task).filter((item) => item.resolution === "UNRESOLVED");
  const counterevidence = isRecord(pattern) ? counterevidenceReport(pattern, context) : null;
  const base = {
    patternId,
    similarityScore: match.score,
    similarityFacts: match.facts,
    unresolvedDifferences,
    counterevidence,
    dependencyRefs: isRecord(pattern) && Array.isArray(pattern.dependencyRefs) ? pattern.dependencyRefs.filter((item): item is string => typeof item === "string") : [],
    provenanceRefs: isRecord(pattern) && Array.isArray(pattern.provenanceRefs) ? pattern.provenanceRefs.filter((item): item is string => typeof item === "string") : [],
    knownFailureRefs: isRecord(pattern) && Array.isArray(pattern.knownFailureRefs) ? pattern.knownFailureRefs.filter((item): item is string => typeof item === "string") : [],
    counterexampleRefs: isRecord(pattern) && Array.isArray(pattern.counterexampleRefs) ? pattern.counterexampleRefs.filter((item): item is string => typeof item === "string") : [],
    knowledgeBundleId: isRecord(candidate.knowledgeBundle) && typeof candidate.knowledgeBundle.bundleId === "string" ? candidate.knowledgeBundle.bundleId : null,
  };
  if (!isRecord(pattern)) return { ...base, result: "DENIED", reason: "PROSE_ONLY_INPUT" };
  const referenceReason = candidateReferenceDenial(candidate, context);
  if (referenceReason !== undefined) return { ...base, result: "DENIED", reason: referenceReason };
  const evaluation = evaluateSolutionPatternV1(pattern, task, context);
  return evaluation.result === APPLICABILITY_RESULTS[0]
    ? { ...base, result: "APPLICABLE_SHADOW_ONLY" }
    : { ...base, result: "DENIED", reason: evaluation.reason ?? "PROSE_ONLY_INPUT" };
}

function invalidRequestReason(request: ReverseTaskRetrievalRequestV1): DenialReasonV1 | undefined {
  if (!RETRIEVAL_ARMS.includes(request.arm ?? "KNOWLEDGE_PLUS_EXPERIENCE")) return "PROSE_ONLY_INPUT";
  if (!REPLAY_MODES.includes(request.replayMode ?? "SHADOW")) return "LIVE_REPLAY_FORBIDDEN";
  if (validateTaskFingerprintV1(request.task).length > 0) return "PROSE_ONLY_INPUT";
  return undefined;
}

/**
 * Reverse retrieval is deliberately applicability-first: similarity is calculated for explanation,
 * but only candidates that pass the complete typed applicability gate can be selected.
 */
export function retrieveTaskToSuccessfulKnowledgeV1(request: ReverseTaskRetrievalRequestV1): ReverseTaskRetrievalResultV1 {
  const rawRequest = request as unknown;
  const arm = isRecord(rawRequest) && RETRIEVAL_ARMS.includes(request.arm ?? "KNOWLEDGE_PLUS_EXPERIENCE")
    ? request.arm ?? "KNOWLEDGE_PLUS_EXPERIENCE"
    : "KNOWLEDGE_PLUS_EXPERIENCE";
  const replayMode = isRecord(rawRequest) && REPLAY_MODES.includes(request.replayMode ?? "SHADOW")
    ? request.replayMode ?? "SHADOW"
    : "SHADOW";
  if (!isRecord(rawRequest)) {
    return { schemaVersion: APPLICABILITY_AWARE_RETRIEVAL_SCHEMA_V1, outcome: "DENIED", arm, replayMode, selected: [], reports: [], denialReasons: ["PROSE_ONLY_INPUT"] };
  }
  const invalidReason = invalidRequestReason(request);
  if (invalidReason !== undefined) {
    return {
      schemaVersion: APPLICABILITY_AWARE_RETRIEVAL_SCHEMA_V1,
      outcome: "DENIED",
      arm,
      replayMode,
      selected: [],
      reports: [],
      denialReasons: [invalidReason],
    };
  }
  if (arm === "KNOWLEDGE_ONLY") {
    return {
      schemaVersion: APPLICABILITY_AWARE_RETRIEVAL_SCHEMA_V1,
      outcome: "NO_MATCH",
      arm,
      replayMode,
      selected: [],
      reports: [],
      denialReasons: [],
    };
  }
  if (!Array.isArray(request.candidates)) {
    return { schemaVersion: APPLICABILITY_AWARE_RETRIEVAL_SCHEMA_V1, outcome: "DENIED", arm, replayMode, selected: [], reports: [], denialReasons: ["PROSE_ONLY_INPUT"] };
  }
  const candidates = [...request.candidates].sort((left, right) => {
    const leftId = typeof left?.pattern?.patternId === "string" ? left.pattern.patternId : "invalid";
    const rightId = typeof right?.pattern?.patternId === "string" ? right.pattern.patternId : "invalid";
    return leftId.localeCompare(rightId);
  });
  const reports = candidates.map((candidate) => makeReport(candidate, request.task, request.context));
  const selected = reports
    .filter((report) => report.result === "APPLICABLE_SHADOW_ONLY")
    .sort((left, right) => {
      const leftCandidate = candidates.find((candidate) => candidate.pattern.patternId === left.patternId);
      const rightCandidate = candidates.find((candidate) => candidate.pattern.patternId === right.patternId);
      const maturityDelta = (rightCandidate?.pattern.maturity ?? "S0").localeCompare(leftCandidate?.pattern.maturity ?? "S0");
      return maturityDelta !== 0 ? maturityDelta : left.patternId.localeCompare(right.patternId);
    });
  const denialReasons = stableUnique(
    reports.flatMap((report) => report.reason === undefined ? [] : [report.reason]),
    (reason) => reason,
  );
  return {
    schemaVersion: APPLICABILITY_AWARE_RETRIEVAL_SCHEMA_V1,
    outcome: selected.length > 0 ? "SELECTED" : reports.length > 0 ? "DENIED" : "NO_MATCH",
    arm,
    replayMode,
    selected,
    reports,
    denialReasons,
  };
}

export const retrieveSuccessfulPatternsForTaskV1 = retrieveTaskToSuccessfulKnowledgeV1;
export const retrieveApplicableExperienceV1 = retrieveTaskToSuccessfulKnowledgeV1;
export const retrieveTaskToPatternV1 = retrieveTaskToSuccessfulKnowledgeV1;

export interface P17CheckResultV1 {
  readonly checkId: string;
  readonly passed: boolean;
}

export interface P17CostEventV1 {
  readonly eventId: string;
  readonly kind: (typeof CHARGED_COST_EVENTS)[number];
}

export interface P17DenialOutcomeV1 {
  readonly caseId: string;
  readonly reason: DenialReasonV1;
}

export interface P17ArmRunV1 {
  readonly holdoutVariantId: string;
  readonly pairedRunKey: readonly string[];
  readonly expectedCheckIds: readonly string[];
  readonly checks: readonly P17CheckResultV1[];
  readonly costEvents: readonly P17CostEventV1[];
  readonly denialOutcomes: readonly P17DenialOutcomeV1[];
  readonly safetyPassed: boolean;
}

export interface P17HoldoutVariantV1 {
  readonly holdoutVariantId: string;
  readonly knowledgeOnly: P17ArmRunV1;
  readonly knowledgePlusExperience: P17ArmRunV1;
}

export interface P17ReplayInputV1 {
  readonly evidenceAdmission: "ADMITTED" | "DENIED";
  readonly requiredEvidencePresent: boolean;
  readonly holdoutSealed: boolean;
  readonly variants: readonly P17HoldoutVariantV1[];
}

export interface P17VariantMetricV1 {
  readonly holdoutVariantId: string;
  readonly qualityKnowledgeOnly: number;
  readonly qualityKnowledgePlusExperience: number;
  readonly costKnowledgeOnly: number;
  readonly costKnowledgePlusExperience: number;
  readonly efficiencyKnowledgeOnly: number;
  readonly efficiencyKnowledgePlusExperience: number;
  readonly qualityDelta: number;
  readonly costReduction: number;
  readonly efficiencyDelta: number;
}

export interface P17AggregateMetricV1 {
  readonly qualityKnowledgeOnly: number;
  readonly qualityKnowledgePlusExperience: number;
  readonly costKnowledgeOnly: number;
  readonly costKnowledgePlusExperience: number;
  readonly efficiencyKnowledgeOnly: number;
  readonly efficiencyKnowledgePlusExperience: number;
  readonly qualityDelta: number;
  readonly costReduction: number;
  readonly efficiencyDelta: number;
}

export interface P17ReplayResultV1 {
  readonly schemaVersion: typeof P17_RETRIEVAL_COMPARISON_SCHEMA_V1;
  readonly verdict: "PASS" | "DENIED" | "INCONCLUSIVE";
  readonly reasons: readonly DenialReasonV1[];
  readonly variantMetrics: readonly P17VariantMetricV1[];
  readonly aggregate: P17AggregateMetricV1 | null;
}

/**
 * @deprecated Caller-authored checks and event counts are not P17 evidence. Use the bound
 * shadow ablation evaluator, which derives metrics from retrieval results and ground truth.
 */
export function evaluateP17V1(_input: P17ReplayInputV1): P17ReplayResultV1 {
  return {
    schemaVersion: P17_RETRIEVAL_COMPARISON_SCHEMA_V1,
    verdict: "INCONCLUSIVE",
    reasons: ["MISSING_EVIDENCE"],
    variantMetrics: [],
    aggregate: null,
  };
}

export const compareRetrievalArmsV1 = evaluateP17V1;
export const evaluateP17HoldoutV1 = evaluateP17V1;

export function retrievalReceiptDigestV1(value: Record<string, unknown>): string {
  return cks09Digest(value);
}

// Keep these imports type-visible to make the preservation contract explicit to consumers.
export type { DependencyRecordV1, EvidenceRecordV1, ProvenanceRecordV1 };
