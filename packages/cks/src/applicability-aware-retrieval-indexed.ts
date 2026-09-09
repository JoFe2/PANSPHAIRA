import {
  APPLICABILITY_RESULTS,
  RETRIEVAL_ARMS,
  REPLAY_MODES,
  TASK_FINGERPRINT_STRUCTURAL_DIMENSIONS,
  evaluateSolutionPatternV1,
  type DenialReasonV1,
  type EvidenceRecordV1,
  type ProvenanceRecordV1,
  type SolutionPatternEvaluationContextV1,
  type SolutionPatternV1,
  type StructuralDimensionV1,
  type TaskFingerprintV1,
  validateKnowledgeBundleV1,
  validateProvenanceRecordV1,
  validateTaskFingerprintV1,
} from "../../contracts/src/cks-task-fingerprint.js";
import { canonicalJson } from "../../contracts/src/canonical-json.js";
import {
  APPLICABILITY_AWARE_RETRIEVAL_SCHEMA_V1,
  type CounterevidenceReportV1,
  type ReverseRetrievalCandidateV1,
  type ReverseTaskRetrievalRequestV1,
  type ReverseTaskRetrievalResultV1,
  type RetrievalCandidateReportV1,
  type StructuralDifferenceV1,
} from "./applicability-aware-retrieval.js";

/**
 * Bounded request-local optimization of applicability-aware reverse retrieval.
 *
 * This variant is a MEASUREMENT / comparison candidate, not the production path.
 * It reuses request-local indices and comparison values where semantics permit:
 *
 *   - The context index maps (evidence-by-id, episode-by-digest, provenance-by-id)
 *     are built ONCE per request instead of once per candidate.
 *   - Each historical fingerprint value's Canonical JSON is computed ONCE per
 *     (candidate, dimension, value) and reused for both the de-duplication key and
 *     the requested-value comparison.
 *   - Each requested value's Canonical JSON is computed ONCE per dimension instead of
 *     once per compared historical value.
 *
 * The observable result is required to be byte-identical to
 * {@link retrieveTaskToSuccessfulKnowledgeV1}: same schema, outcome, ordering,
 * error precedence, duplicate handling, Canonical JSON, Unicode and numeric
 * semantics. The parity test enforces this over a positive/negative battery.
 */

const dimensions = [...TASK_FINGERPRINT_STRUCTURAL_DIMENSIONS] as readonly StructuralDimensionV1[];

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value) && Object.getPrototypeOf(value) === Object.prototype;
}

function stableUnique<T>(values: readonly T[], key: (value: T) => string): T[] {
  const byKey = new Map<string, T>();
  for (const value of values) byKey.set(key(value), value);
  return [...byKey.entries()].sort(([left], [right]) => left.localeCompare(right)).map(([, value]) => value);
}

function fingerprintValue(task: TaskFingerprintV1, dimension: StructuralDimensionV1): unknown {
  return task[dimension];
}

/** Request-scoped index maps shared by every candidate in one retrieval request. */
interface RequestIndices {
  readonly evidenceById: ReadonlyMap<string, EvidenceRecordV1>;
  readonly episodesByDigest: ReadonlyMap<string, TaskFingerprintV1>;
  readonly provenanceById: ReadonlyMap<string, ProvenanceRecordV1>;
}

function buildRequestIndices(context: SolutionPatternEvaluationContextV1): RequestIndices {
  return {
    evidenceById: new Map(context.evidence.map((item) => [item.evidenceId, item])),
    episodesByDigest: new Map(context.episodes.map((item) => [item.canonicalDigest, item])),
    provenanceById: new Map(context.provenance.map((item) => [item.provenanceId, item])),
  };
}

function historicalEpisodes(pattern: SolutionPatternV1, indices: RequestIndices): TaskFingerprintV1[] {
  const episodes: TaskFingerprintV1[] = [];
  for (const ref of pattern.evidenceRefs) {
    const evidence = indices.evidenceById.get(ref);
    const episode = evidence === undefined ? undefined : indices.episodesByDigest.get(evidence.taskFingerprintDigest);
    if (episode !== undefined && validateTaskFingerprintV1(episode).length === 0) episodes.push(episode);
  }
  return stableUnique(episodes, (item) => item.canonicalDigest);
}

/**
 * Similarity with comparison-value reuse. Semantics are identical to the original
 * `similarity`: for each dimension the historical values are de-duplicated by
 * Canonical JSON (last wins) and sorted, then compared to the requested value. A
 * value whose Canonical JSON throws still throws here (matching the original, which
 * de-duplicated via an unguarded key), and an un-serializable requested value yields
 * "no match" (matching the original's guarded `sameValue`).
 */
function similarity(
  requested: TaskFingerprintV1,
  episodes: readonly TaskFingerprintV1[],
): { score: number; facts: string[]; differences: StructuralDifferenceV1[] } {
  const facts: string[] = [];
  const differences: StructuralDifferenceV1[] = [];
  for (const dimension of dimensions) {
    const requestedValue = fingerprintValue(requested, dimension);
    const byKey = new Map<string, unknown>();
    for (const episode of episodes) {
      const value = fingerprintValue(episode, dimension);
      byKey.set(canonicalJson(value), value);
    }
    const entries = [...byKey.entries()].sort(([left], [right]) => left.localeCompare(right));
    const historicalValues: unknown[] = entries.map(([, value]) => value);
    let requestedCanonical: string | undefined;
    let requestedCanonicalAvailable = true;
    try {
      requestedCanonical = canonicalJson(requestedValue);
    } catch {
      requestedCanonicalAvailable = false;
    }
    const matched = requestedCanonicalAvailable && entries.some(([key]) => key === requestedCanonical);
    if (matched) {
      facts.push(`${dimension}=${requestedCanonical}`);
    } else if (historicalValues.length > 0) {
      differences.push({ dimension, requestedValue, historicalValues, resolution: "UNRESOLVED" });
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
  indices: RequestIndices,
): DenialReasonV1 | undefined {
  const bundleReasons = validateKnowledgeBundleV1(candidate.knowledgeBundle);
  if (bundleReasons.length > 0) return "INVALID_KNOWLEDGE_BUNDLE";
  for (const reference of candidate.knowledgeBundle.provenanceRefs) {
    const provenance = indices.provenanceById.get(reference);
    if (provenance === undefined || !provenance.sealed || validateProvenanceRecordV1(provenance).length > 0) return "INVALID_PROVENANCE";
  }
  const successRefs = candidate.successfulEvidenceRefs ?? candidate.pattern.evidenceRefs;
  if (successRefs.length === 0) return "MISSING_EVIDENCE";
  if (successRefs.some((reference) => !candidate.pattern.evidenceRefs.includes(reference))) return "PROSE_ONLY_INPUT";
  for (const reference of successRefs) {
    const evidence = indices.evidenceById.get(reference);
    if (evidence === undefined) return "MISSING_EVIDENCE";
    if (evidence.outcomeDigest !== candidate.pattern.expectedOutcomeDigest) return "UNRESOLVED_FAILURE";
  }
  return undefined;
}

function makeReport(
  candidate: ReverseRetrievalCandidateV1,
  task: TaskFingerprintV1,
  context: SolutionPatternEvaluationContextV1,
  indices: RequestIndices,
): RetrievalCandidateReportV1 {
  const patternId = isRecord(candidate.pattern) && typeof candidate.pattern.patternId === "string" ? candidate.pattern.patternId : "invalid";
  const pattern = candidate.pattern;
  const episodes = isRecord(pattern) ? historicalEpisodes(pattern, indices) : [];
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
  const referenceReason = candidateReferenceDenial(candidate, indices);
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
 * Reverse retrieval with bounded request-local index/comparison reuse. The result is
 * byte-identical to {@link retrieveTaskToSuccessfulKnowledgeV1}; only the internal
 * allocation of index construction and Canonical-JSON comparison work differs.
 */
export function retrieveTaskToSuccessfulKnowledgeIndexedV1(request: ReverseTaskRetrievalRequestV1): ReverseTaskRetrievalResultV1 {
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
  const indices = buildRequestIndices(request.context);
  const candidates = [...request.candidates].sort((left, right) => {
    const leftId = typeof left?.pattern?.patternId === "string" ? left.pattern.patternId : "invalid";
    const rightId = typeof right?.pattern?.patternId === "string" ? right.pattern.patternId : "invalid";
    return leftId.localeCompare(rightId);
  });
  const reports = candidates.map((candidate) => makeReport(candidate, request.task, request.context, indices));
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

/** Convenience alias mirroring the original's exported surface. */
export const retrieveTaskToSuccessfulKnowledgeIndexed = retrieveTaskToSuccessfulKnowledgeIndexedV1;