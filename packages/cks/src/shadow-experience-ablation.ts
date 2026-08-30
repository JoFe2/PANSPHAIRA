import {
  cks09Digest,
  REPLAY_MODES,
  validateTaskFingerprintV1,
  type DenialReasonV1,
  type KnowledgeBundleV1,
  type ReplayModeV1,
  type SolutionPatternEvaluationContextV1,
  type TaskFingerprintV1,
} from "../../contracts/src/cks-task-fingerprint.js";
import {
  type P17AggregateMetricV1,
  type P17ReplayResultV1,
  type P17VariantMetricV1,
  retrieveTaskToSuccessfulKnowledgeV1,
  type ReverseRetrievalCandidateV1,
  type ReverseTaskRetrievalResultV1,
} from "./applicability-aware-retrieval.js";

/** A comparison receipt only; this module cannot grant execution or production authority. */
export const SHADOW_EXPERIENCE_ABLATION_SCHEMA_V1 = "pansphaira.cks/shadow-experience-ablation/v1" as const;
export const SHADOW_REPLAY_SCHEMA_V1 = "pansphaira.cks/shadow-replay/v1" as const;
export const SHADOW_EXPERIENCE_ABLATION_MODE_V1 = "SIMULATION_OR_SHADOW_ONLY" as const;

export interface ShadowExperienceAblationCaseV1 {
  readonly caseId: string;
  readonly holdoutVariantId: string;
  /** The immutable baseline digest that must be identical for both arms. */
  readonly knowledgeBundleDigest: string;
  readonly task: TaskFingerprintV1;
  readonly candidates: readonly ReverseRetrievalCandidateV1[];
  readonly context: SolutionPatternEvaluationContextV1;
  /** Legacy caller summary. It is accepted for compatibility but never scored. */
  readonly pairedRun?: unknown;
}

export interface P17GroundTruthCaseV1 {
  readonly caseId: string;
  readonly holdoutVariantId: string;
  readonly expectedSelectedPatternIds: readonly string[];
}

export interface P17ExecutionCostModelV1 {
  readonly retrievalInvocation: number;
  readonly candidateReport: number;
  readonly selectedCandidate: number;
  readonly incorrectOutcome: number;
}

export interface P17AuthoritativeGroundTruthV1 {
  readonly expectedVerdict: "PASS";
  readonly costModel: P17ExecutionCostModelV1;
  readonly cases: readonly P17GroundTruthCaseV1[];
}

export interface ShadowExperienceAblationInputV1 {
  readonly schemaVersion?: typeof SHADOW_REPLAY_SCHEMA_V1;
  readonly evidenceAdmission: "ADMITTED" | "DENIED";
  readonly requiredEvidencePresent: boolean;
  readonly holdoutSealed: boolean;
  readonly replayMode?: ReplayModeV1;
  readonly externalStateChanged?: false;
  readonly modelsOrServicesCalled?: false;
  readonly procedureContentReturned?: false;
  readonly groundTruth: P17AuthoritativeGroundTruthV1;
  readonly cases: readonly ShadowExperienceAblationCaseV1[];
}

export interface ShadowArmComparisonV1 {
  readonly knowledgeOnly: ReverseTaskRetrievalResultV1;
  readonly knowledgePlusExperience: ReverseTaskRetrievalResultV1;
}

export interface ShadowExperienceAblationCaseResultV1 {
  readonly caseId: string;
  readonly holdoutVariantId: string;
  readonly comparison: ShadowArmComparisonV1;
  readonly metric: P17VariantMetricV1 | null;
  readonly experienceSelected: boolean;
}

export interface ShadowExperienceAblationResultV1 {
  readonly schemaVersion: typeof SHADOW_EXPERIENCE_ABLATION_SCHEMA_V1;
  readonly mode: typeof SHADOW_EXPERIENCE_ABLATION_MODE_V1;
  readonly externalStateChanged: false;
  readonly modelsOrServicesCalled: false;
  readonly procedureContentReturned: false;
  readonly verdict: "PASS" | "DENIED" | "INCONCLUSIVE";
  readonly reasons: readonly DenialReasonV1[];
  readonly caseResults: readonly ShadowExperienceAblationCaseResultV1[];
  readonly p17: P17ReplayResultV1;
  readonly aggregate: P17AggregateMetricV1 | null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value) && Object.getPrototypeOf(value) === Object.prototype;
}

function isDigest(value: unknown): value is string {
  return typeof value === "string" && /^sha256:[a-f0-9]{64}$/.test(value);
}

function sortedUniqueReasons(values: readonly DenialReasonV1[]): DenialReasonV1[] {
  return [...new Set(values)].sort((left, right) => left.localeCompare(right));
}

function invalidP17(reason: DenialReasonV1): P17ReplayResultV1 {
  return {
    schemaVersion: "pansphaira.cks/p17-retrieval-comparison/v1",
    verdict: "INCONCLUSIVE",
    reasons: [reason],
    variantMetrics: [],
    aggregate: null,
  };
}

function validCase(value: unknown): value is ShadowExperienceAblationCaseV1 {
  if (!isRecord(value)) return false;
  const context = isRecord(value.context) ? value.context : null;
  if (typeof value.caseId !== "string" || value.caseId.length === 0
    || typeof value.holdoutVariantId !== "string" || value.holdoutVariantId.length === 0
    || !isDigest(value.knowledgeBundleDigest)
    || validateTaskFingerprintV1(value.task).length > 0
    || !Array.isArray(value.candidates) || context === null || !Array.isArray(context.families)
    || !Array.isArray(context.evidence) || !Array.isArray(context.provenance)
    || !Array.isArray(context.dependencies) || !Array.isArray(context.versionConstraints)
    || !Array.isArray(context.knownFailures) || !Array.isArray(context.counterexamples)
    || !Array.isArray(context.assessments) || !Array.isArray(context.diversityProofs)
    || !Array.isArray(context.episodes) || !Array.isArray(context.holdoutEpisodeDigests)) return false;
  const contextArrays = ["families", "evidence", "provenance", "dependencies", "versionConstraints", "knownFailures", "counterexamples", "assessments", "diversityProofs", "episodes"] as const;
  if (contextArrays.some((field) => !(context[field] as unknown[]).every(isRecord))) return false;
  if (context.dependencyStateDigests !== undefined
    && (context.dependencyStateDigests === null || typeof context.dependencyStateDigests !== "object"
      || typeof (context.dependencyStateDigests as { readonly get?: unknown }).get !== "function")) return false;
  return value.candidates.every((candidate) => isRecord(candidate) && isRecord(candidate.pattern) && isRecord(candidate.knowledgeBundle));
}

function positiveInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value > 0;
}

function validGroundTruth(value: unknown): value is P17AuthoritativeGroundTruthV1 {
  if (!isRecord(value) || value.expectedVerdict !== "PASS" || !isRecord(value.costModel) || !Array.isArray(value.cases)) return false;
  const costModel = value.costModel;
  if (![costModel.retrievalInvocation, costModel.candidateReport, costModel.selectedCandidate, costModel.incorrectOutcome].every(positiveInteger)) return false;
  return value.cases.length > 0 && value.cases.every((item) => isRecord(item)
    && typeof item.caseId === "string" && item.caseId.length > 0
    && typeof item.holdoutVariantId === "string" && item.holdoutVariantId.length > 0
    && Array.isArray(item.expectedSelectedPatternIds) && item.expectedSelectedPatternIds.length > 0
    && item.expectedSelectedPatternIds.every((id) => typeof id === "string" && id.length > 0)
    && new Set(item.expectedSelectedPatternIds).size === item.expectedSelectedPatternIds.length);
}

function candidateBundleReason(item: ShadowExperienceAblationCaseV1): DenialReasonV1 | undefined {
  for (const candidate of item.candidates) {
    const bundle = candidate.knowledgeBundle as KnowledgeBundleV1;
    if (!isRecord(bundle) || !isDigest(bundle.canonicalDigest) || bundle.canonicalDigest !== item.knowledgeBundleDigest) {
      return "INVALID_KNOWLEDGE_BUNDLE";
    }
  }
  return undefined;
}

function compareCase(item: ShadowExperienceAblationCaseV1, replayMode: ReplayModeV1): ShadowArmComparisonV1 {
  const base = { task: item.task, candidates: item.candidates, context: item.context, replayMode };
  return {
    knowledgeOnly: retrieveTaskToSuccessfulKnowledgeV1({ ...base, arm: "KNOWLEDGE_ONLY" }),
    knowledgePlusExperience: retrieveTaskToSuccessfulKnowledgeV1({ ...base, arm: "KNOWLEDGE_PLUS_EXPERIENCE" }),
  };
}

function caseResult(
  item: ShadowExperienceAblationCaseV1,
  comparison: ShadowArmComparisonV1,
  metrics: readonly P17VariantMetricV1[],
): ShadowExperienceAblationCaseResultV1 {
  return {
    caseId: item.caseId,
    holdoutVariantId: item.holdoutVariantId,
    comparison,
    metric: metrics.find((metric) => metric.holdoutVariantId === item.holdoutVariantId) ?? null,
    experienceSelected: comparison.knowledgePlusExperience.outcome === "SELECTED"
      && comparison.knowledgePlusExperience.selected.length > 0,
  };
}

function sameStrings(left: readonly string[], right: readonly string[]): boolean {
  return cks09Digest([...left].sort()) === cks09Digest([...right].sort());
}

function executionMetric(
  item: ShadowExperienceAblationCaseV1,
  comparison: ShadowArmComparisonV1,
  truth: P17GroundTruthCaseV1,
  costModel: P17ExecutionCostModelV1,
): P17VariantMetricV1 {
  const armMetric = (run: ReverseTaskRetrievalResultV1) => {
    const selectedIds = run.selected.map((report) => report.patternId);
    const quality = sameStrings(selectedIds, truth.expectedSelectedPatternIds) ? 1 : 0;
    const cost = costModel.retrievalInvocation
      + run.reports.length * costModel.candidateReport
      + run.selected.length * costModel.selectedCandidate
      + (quality === 1 ? 0 : costModel.incorrectOutcome);
    return { quality, cost, efficiency: quality / cost };
  };
  const baseline = armMetric(comparison.knowledgeOnly);
  const experience = armMetric(comparison.knowledgePlusExperience);
  return {
    holdoutVariantId: item.holdoutVariantId,
    qualityKnowledgeOnly: baseline.quality,
    qualityKnowledgePlusExperience: experience.quality,
    costKnowledgeOnly: baseline.cost,
    costKnowledgePlusExperience: experience.cost,
    efficiencyKnowledgeOnly: baseline.efficiency,
    efficiencyKnowledgePlusExperience: experience.efficiency,
    qualityDelta: experience.quality - baseline.quality,
    costReduction: baseline.cost - experience.cost,
    efficiencyDelta: experience.efficiency - baseline.efficiency,
  };
}

function executionP17(
  cases: readonly ShadowExperienceAblationCaseV1[],
  comparisons: readonly ShadowArmComparisonV1[],
  groundTruth: P17AuthoritativeGroundTruthV1,
): P17ReplayResultV1 {
  const truthByCase = new Map(groundTruth.cases.map((item) => [item.caseId, item]));
  if (!sameStrings(cases.map((item) => item.caseId), groundTruth.cases.map((item) => item.caseId))) return invalidP17("MISSING_EVIDENCE");
  const metrics: P17VariantMetricV1[] = [];
  for (let index = 0; index < cases.length; index += 1) {
    const item = cases[index] as ShadowExperienceAblationCaseV1;
    const truth = truthByCase.get(item.caseId);
    if (truth === undefined || truth.holdoutVariantId !== item.holdoutVariantId) return invalidP17("HOLDOUT_LEAKAGE");
    metrics.push(executionMetric(item, comparisons[index] as ShadowArmComparisonV1, truth, groundTruth.costModel));
  }
  const average = (selector: (metric: P17VariantMetricV1) => number) => metrics.reduce((sum, metric) => sum + selector(metric), 0) / metrics.length;
  const total = (selector: (metric: P17VariantMetricV1) => number) => metrics.reduce((sum, metric) => sum + selector(metric), 0);
  const aggregate: P17AggregateMetricV1 = {
    qualityKnowledgeOnly: average((metric) => metric.qualityKnowledgeOnly),
    qualityKnowledgePlusExperience: average((metric) => metric.qualityKnowledgePlusExperience),
    costKnowledgeOnly: total((metric) => metric.costKnowledgeOnly),
    costKnowledgePlusExperience: total((metric) => metric.costKnowledgePlusExperience),
    efficiencyKnowledgeOnly: average((metric) => metric.efficiencyKnowledgeOnly),
    efficiencyKnowledgePlusExperience: average((metric) => metric.efficiencyKnowledgePlusExperience),
    qualityDelta: average((metric) => metric.qualityDelta),
    costReduction: total((metric) => metric.costReduction),
    efficiencyDelta: average((metric) => metric.efficiencyDelta),
  };
  const pass = metrics.every((metric) => metric.qualityDelta >= 0 && metric.costReduction >= 0)
    && aggregate.qualityDelta > 0 && aggregate.costReduction > 0 && aggregate.efficiencyDelta > 0;
  return {
    schemaVersion: "pansphaira.cks/p17-retrieval-comparison/v1",
    verdict: pass ? "PASS" : "DENIED",
    reasons: pass ? [] : ["UNRESOLVED_FAILURE"],
    variantMetrics: metrics,
    aggregate,
  };
}

function result(
  verdict: ShadowExperienceAblationResultV1["verdict"],
  reasons: readonly DenialReasonV1[],
  caseResults: readonly ShadowExperienceAblationCaseResultV1[],
  p17: P17ReplayResultV1,
): ShadowExperienceAblationResultV1 {
  return {
    schemaVersion: SHADOW_EXPERIENCE_ABLATION_SCHEMA_V1,
    mode: SHADOW_EXPERIENCE_ABLATION_MODE_V1,
    externalStateChanged: false,
    modelsOrServicesCalled: false,
    procedureContentReturned: false,
    verdict,
    reasons: sortedUniqueReasons(reasons),
    caseResults,
    p17,
    aggregate: p17.aggregate,
  };
}

/**
 * Replay a paired ablation against an identical knowledge baseline. Historical experience is
 * visible only through the applicability-aware shadow arm; neither arm returns procedure content.
 */
export function evaluateShadowExperienceAblationV1(input: unknown): ShadowExperienceAblationResultV1 {
  if (!isRecord(input)) return result("INCONCLUSIVE", ["PROSE_ONLY_INPUT"], [], invalidP17("PROSE_ONLY_INPUT"));
  if (input.schemaVersion !== undefined && input.schemaVersion !== SHADOW_REPLAY_SCHEMA_V1) {
    return result("INCONCLUSIVE", ["PROSE_ONLY_INPUT"], [], invalidP17("PROSE_ONLY_INPUT"));
  }
  if (input.evidenceAdmission !== "ADMITTED" || input.requiredEvidencePresent !== true) {
    return result("INCONCLUSIVE", ["MISSING_288_DIGEST"], [], invalidP17("MISSING_288_DIGEST"));
  }
  if (input.holdoutSealed !== true) return result("INCONCLUSIVE", ["UNSEALED_HOLDOUT"], [], invalidP17("UNSEALED_HOLDOUT"));
  if (input.replayMode !== undefined && !REPLAY_MODES.includes(input.replayMode as ReplayModeV1)) return result("INCONCLUSIVE", ["LIVE_REPLAY_FORBIDDEN"], [], invalidP17("LIVE_REPLAY_FORBIDDEN"));
  if ((input.externalStateChanged !== undefined && input.externalStateChanged !== false)
    || (input.modelsOrServicesCalled !== undefined && input.modelsOrServicesCalled !== false)
    || (input.procedureContentReturned !== undefined && input.procedureContentReturned !== false)) {
    return result("DENIED", ["LIVE_REPLAY_FORBIDDEN"], [], invalidP17("LIVE_REPLAY_FORBIDDEN"));
  }
  if (!Array.isArray(input.cases) || input.cases.length === 0) return result("INCONCLUSIVE", ["MISSING_EVIDENCE"], [], invalidP17("MISSING_EVIDENCE"));
  if (!input.cases.every(validCase)) return result("INCONCLUSIVE", ["PROSE_ONLY_INPUT"], [], invalidP17("PROSE_ONLY_INPUT"));
  if (!validGroundTruth(input.groundTruth)) return result("INCONCLUSIVE", ["MISSING_EVIDENCE"], [], invalidP17("MISSING_EVIDENCE"));

  const cases = [...input.cases].sort((left, right) => left.caseId.localeCompare(right.caseId));
  const replayMode = (input.replayMode ?? "SHADOW") as ReplayModeV1;
  const structuralReasons: DenialReasonV1[] = [];
  const comparisons: ShadowArmComparisonV1[] = [];
  for (const item of cases) {
    const bundleReason = candidateBundleReason(item);
    if (bundleReason !== undefined) structuralReasons.push(bundleReason);
    const comparison = compareCase(item, replayMode);
    comparisons.push(comparison);
    if (comparison.knowledgeOnly.outcome !== "NO_MATCH" || comparison.knowledgeOnly.selected.length !== 0) structuralReasons.push("HOLDOUT_LEAKAGE");
    if (comparison.knowledgePlusExperience.outcome !== "SELECTED" || comparison.knowledgePlusExperience.selected.length === 0) structuralReasons.push("MISSING_EVIDENCE");
  }

  const p17 = executionP17(cases, comparisons, input.groundTruth);
  const caseResults = cases.map((item, index) => caseResult(item, comparisons[index] as ShadowArmComparisonV1, p17.variantMetrics));
  const reasons = [...structuralReasons, ...p17.reasons];
  if (reasons.length > 0) {
    const verdict = p17.verdict === "DENIED" ? "DENIED" : "INCONCLUSIVE";
    return result(verdict, reasons, caseResults, p17);
  }
  return result(p17.verdict, [], caseResults, p17);
}

export const replayShadowExperienceAblationV1 = evaluateShadowExperienceAblationV1;
export const compareKnowledgeOnlyWithApplicabilityAwareExperienceV1 = evaluateShadowExperienceAblationV1;
export const runShadowExperienceAblationV1 = evaluateShadowExperienceAblationV1;
export const shadowExperienceAblationDigestV1 = (value: Record<string, unknown>): string => cks09Digest(value);
