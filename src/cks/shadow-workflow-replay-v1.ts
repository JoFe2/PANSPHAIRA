/**
 * CKS-11 deterministic shadow-only workflow replay (v1).
 *
 * This module compares supplied, already-recorded projections. It never invokes
 * a workflow, Function, provider, fallback, rollback, verifier, or model. The
 * applicability and Knowledge guards run only as decision checks over the
 * supplied immutable snapshots; neither path is executed.
 *
 * P19 requires every applicable holdout to preserve output, Verification,
 * rollback and exact dependency parity, to be equal-or-better on the declared
 * quality metric, and to use strictly less declared reasoning cost. Unknown,
 * drifted, boundary-unavailable and otherwise unsafe cases must be represented
 * as explicit safe aborts and cannot contribute a false positive.
 */
import {
  governedAssetsDigestV1,
  governedAssetsRefSetDigestV1,
  type AuthorityGrantV1,
  type AuthorityRequirementV1,
  type CapabilityV1,
  type ExactRefV1,
} from "./governed-assets-v1.js";
import {
  evaluateWorkflowApplicabilityV1,
  type WorkflowApplicabilityInputV1,
} from "./workflow-applicability-v1.js";
import {
  type HistoricalKnowledgeReceiptV1,
  type KnowledgeBindingV1,
} from "./knowledge-revalidation-v1.js";

export const SHADOW_WORKFLOW_REPLAY_SCHEMA_V1 =
  "pansphaira.cks-11/shadow-workflow-replay/v1" as const;
export const SHADOW_REPLAY_VERIFIER_VERSION_V1 = "cks-11-shadow-replay-verifier/v1" as const;

const DIGEST = /^[a-f0-9]{64}$/;
const DANGEROUS_KEYS = new Set(["__proto__", "prototype", "constructor"]);
const INPUT_KEYS = ["schemaVersion", "verifierVersion", "holdouts", "requiredAbortReasons"] as const;
const CASE_KEYS = [
  "holdoutId",
  "applicabilityInput",
  "expected",
  "expectedReasonCodes",
  "baseline",
  "governed",
] as const;
const PROJECTION_KEYS = [
  "output",
  "verificationOutcome",
  "rollbackPlan",
  "dependencies",
  "qualityMetric",
  "reasoningCostMetric",
] as const;
const METRIC_KEYS = ["metricId", "metricVersion", "direction", "value"] as const;
const VERIFICATION_KEYS = ["status", "decisionDigest", "evidenceDigest"] as const;
const ROLLBACK_KEYS = [
  "trigger",
  "scope",
  "lastKnownGoodRef",
  "restoreAction",
  "reconciliationRule",
  "readbackRequired",
  "verifierDigest",
  "planDigest",
] as const;
const DEPENDENCY_KEYS = [
  "knowledgeWorkflowInputs",
  "knowledgeFunctionInputs",
  "workflowDependencies",
  "functionDependencies",
  "historicalReceipts",
  "knowledgeDependencySetDigest",
  "workflowDependencySetDigest",
  "functionDependencySetDigest",
  "historicalReceiptSetDigest",
  "transitiveClosureDigest",
] as const;
const REASON_ORDER = [
  "NONE",
  "MISSING_INPUT",
  "INVALID_INPUT",
  "NOT_APPLICABLE",
  "AMBIGUOUS_MATCH",
  "KNOWLEDGE_MISSING",
  "STALE_KNOWLEDGE",
  "KNOWLEDGE_SUPERSEDED",
  "VERSION_DRIFT",
  "DIGEST_MISMATCH",
  "EVIDENCE_INCOMPLETE",
  "BOUNDARY_UNAVAILABLE",
  "CAPABILITY_WIDENING",
  "AUTHORITY_WIDENING",
  "INVALID_CONTRACT",
  "OUTPUT_MISMATCH",
  "VERIFICATION_MISMATCH",
  "ROLLBACK_MISMATCH",
  "DEPENDENCY_MISMATCH",
  "QUALITY_REGRESSION",
  "REASONING_COST_NOT_LOWER",
  "SAFE_ABORT_REQUIRED",
] as const;
const SAFE_ABORT_REASONS = new Set([
  "INVALID_INPUT",
  "MISSING_INPUT",
  "NOT_APPLICABLE",
  "AMBIGUOUS_MATCH",
  "KNOWLEDGE_MISSING",
  "STALE_KNOWLEDGE",
  "KNOWLEDGE_SUPERSEDED",
  "VERSION_DRIFT",
  "DIGEST_MISMATCH",
  "EVIDENCE_INCOMPLETE",
  "BOUNDARY_UNAVAILABLE",
  "CAPABILITY_WIDENING",
  "AUTHORITY_WIDENING",
]);

type DataRecord = Record<string, unknown>;
type JsonValue = null | boolean | number | string | JsonValue[] | { readonly [key: string]: JsonValue };
type ReasonCodeV1 = (typeof REASON_ORDER)[number];

export interface ShadowMetricV1 {
  readonly metricId: string;
  readonly metricVersion: string;
  readonly direction: "HIGHER_IS_BETTER" | "LOWER_IS_BETTER";
  readonly value: number;
}

export interface ShadowVerificationOutcomeV1 {
  readonly status: "VERIFIED" | "REJECTED" | "UNKNOWN";
  readonly decisionDigest: string;
  readonly evidenceDigest: string;
}

export interface ShadowRollbackPlanV1 {
  readonly trigger: string;
  readonly scope: string;
  readonly lastKnownGoodRef: ExactRefV1;
  readonly restoreAction: string;
  readonly reconciliationRule: string;
  readonly readbackRequired: boolean;
  readonly verifierDigest: string;
  readonly planDigest: string;
}

/** Exact dependency projection copied by both paths; no nearest-version lookup is allowed. */
export interface ShadowDependencySnapshotV1 {
  readonly knowledgeWorkflowInputs: readonly KnowledgeBindingV1[];
  readonly knowledgeFunctionInputs: readonly KnowledgeBindingV1[];
  readonly workflowDependencies: readonly ExactRefV1[];
  readonly functionDependencies: readonly ExactRefV1[];
  readonly historicalReceipts: readonly HistoricalKnowledgeReceiptV1[];
  readonly knowledgeDependencySetDigest: string;
  readonly workflowDependencySetDigest: string;
  readonly functionDependencySetDigest: string;
  readonly historicalReceiptSetDigest: string;
  readonly transitiveClosureDigest: string;
}

export interface ShadowRunProjectionV1 {
  readonly output: JsonValue;
  readonly verificationOutcome: ShadowVerificationOutcomeV1;
  readonly rollbackPlan: ShadowRollbackPlanV1;
  readonly dependencies: ShadowDependencySnapshotV1;
  readonly qualityMetric: ShadowMetricV1;
  readonly reasoningCostMetric: ShadowMetricV1;
}

export interface ShadowReplayHoldoutV1 {
  readonly holdoutId: string;
  readonly applicabilityInput: WorkflowApplicabilityInputV1;
  readonly expected: "APPLICABLE" | "SAFE_ABORT";
  readonly expectedReasonCodes: readonly ReasonCodeV1[];
  readonly baseline: ShadowRunProjectionV1 | null;
  readonly governed: ShadowRunProjectionV1 | null;
}

export interface ShadowWorkflowReplayInputV1 {
  readonly schemaVersion: typeof SHADOW_WORKFLOW_REPLAY_SCHEMA_V1;
  readonly verifierVersion: typeof SHADOW_REPLAY_VERIFIER_VERSION_V1;
  readonly holdouts: readonly ShadowReplayHoldoutV1[];
  readonly requiredAbortReasons: readonly ReasonCodeV1[];
}

export interface ShadowReplayHoldoutResultV1 {
  readonly holdoutId: string;
  readonly applicabilityStatus: string;
  readonly applicabilityReasonCodes: readonly string[];
  readonly outcome: "PARITY_VERIFIED" | "SAFE_ABORT" | "REJECTED";
  readonly outputParity: boolean | null;
  readonly verificationParity: boolean | null;
  readonly rollbackParity: boolean | null;
  readonly dependencyParity: boolean | null;
  readonly qualityEqualOrBetter: boolean | null;
  readonly reasoningCostLower: boolean | null;
  readonly decisionDigest: string;
}

export interface ShadowWorkflowReplayDecisionV1 {
  readonly status: "SHADOW_PARITY_VERIFIED" | "SHADOW_REPLAY_ABORTED";
  readonly outcome: "PASS" | "ABORTED";
  readonly reasonCodes: readonly ReasonCodeV1[];
  readonly decisionDigest: string;
  readonly applicableHoldoutCount: number;
  readonly safeAbortCount: number;
  readonly holdoutResults: readonly ShadowReplayHoldoutResultV1[];
}

function isPlainRecord(value: unknown): value is DataRecord {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) return false;
  for (const key of Reflect.ownKeys(value)) {
    if (typeof key !== "string" || DANGEROUS_KEYS.has(key)) return false;
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (descriptor === undefined || !("value" in descriptor) || descriptor.enumerable !== true) return false;
  }
  return true;
}

function isDenseArray(value: unknown): value is unknown[] {
  if (!Array.isArray(value) || Object.getPrototypeOf(value) !== Array.prototype) return false;
  const keys = Reflect.ownKeys(value);
  if (keys.length !== value.length + 1) return false;
  for (let index = 0; index < value.length; index += 1) {
    const descriptor = Object.getOwnPropertyDescriptor(value, index);
    if (descriptor === undefined || !("value" in descriptor) || descriptor.enumerable !== true) return false;
  }
  return true;
}

function hasExactKeys(value: unknown, keys: readonly string[]): value is DataRecord {
  if (!isPlainRecord(value)) return false;
  const actual = Object.keys(value).sort();
  const expected = [...keys].sort();
  return actual.length === expected.length && actual.every((key, index) => key === expected[index]);
}

function isExactString(value: unknown, maximum = 256): value is string {
  return (
    typeof value === "string" &&
    value.length > 0 &&
    value.length <= maximum &&
    value === value.trim() &&
    !/[\u0000-\u001f\u007f]/.test(value)
  );
}

function isDigest(value: unknown): value is string {
  return typeof value === "string" && DIGEST.test(value);
}

function isTimestamp(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0 && !Object.is(value, -0);
}

function isJsonValue(value: unknown, depth = 0): value is JsonValue {
  if (depth > 32) return false;
  if (value === null || typeof value === "boolean" || typeof value === "string") return true;
  if (typeof value === "number") return Number.isFinite(value);
  if (Array.isArray(value)) return isDenseArray(value) && value.every((entry) => isJsonValue(entry, depth + 1));
  if (!isPlainRecord(value)) return false;
  return Object.values(value).every((entry) => isJsonValue(entry, depth + 1));
}

function clone<T>(value: T): T {
  if (value === null || typeof value !== "object") return value;
  if (Array.isArray(value)) return value.map((entry) => clone(entry)) as T;
  const result: DataRecord = {};
  for (const [key, entry] of Object.entries(value as DataRecord)) {
    Object.defineProperty(result, key, {
      value: clone(entry),
      writable: true,
      enumerable: true,
      configurable: true,
    });
  }
  return result as T;
}

function freezeDeep<T>(value: T): T {
  if (value !== null && typeof value === "object") {
    for (const entry of Object.values(value as DataRecord)) freezeDeep(entry);
    Object.freeze(value);
  }
  return value;
}

function immutable<T>(value: T): T {
  return freezeDeep(clone(value));
}

function orderedReasons(reasons: readonly ReasonCodeV1[]): readonly ReasonCodeV1[] {
  const set = new Set(reasons);
  return REASON_ORDER.filter((reason) => set.has(reason));
}

function isExactRef(value: unknown): value is ExactRefV1 {
  return (
    hasExactKeys(value, ["kind", "id", "schemaVersion", "version", "digestAlgorithm", "digest"]) &&
    isExactString(value["kind"]) &&
    isExactString(value["id"]) &&
    isExactString(value["schemaVersion"]) &&
    isExactString(value["version"]) &&
    isExactString(value["digestAlgorithm"]) &&
    isDigest(value["digest"]) &&
    !/[~^*<>=|&,\s]/.test(value["version"])
  );
}

function isFreshness(value: unknown): boolean {
  return (
    hasExactKeys(value, ["validFromMs", "validUntilMs"]) &&
    isTimestamp(value["validFromMs"]) &&
    isTimestamp(value["validUntilMs"]) &&
    value["validFromMs"] < value["validUntilMs"]
  );
}

function isKnowledgeBinding(value: unknown): value is KnowledgeBindingV1 {
  return (
    hasExactKeys(value, ["knowledgeId", "version", "digest", "freshness", "scope"]) &&
    isExactString(value["knowledgeId"]) &&
    isExactString(value["version"]) &&
    !/[~^*<>=|&,\s]/.test(value["version"]) &&
    isDigest(value["digest"]) &&
    isFreshness(value["freshness"]) &&
    isExactString(value["scope"])
  );
}

function isHistoricalReceipt(value: unknown): value is HistoricalKnowledgeReceiptV1 {
  if (
    !hasExactKeys(value, [
      "receiptId",
      "subjectKind",
      "subjectId",
      "subjectVersion",
      "subjectDigest",
      "knowledgeDependencySetDigest",
      "recordedTimeMs",
      "previousReceiptDigest",
      "receiptDigest",
    ])
  ) return false;
  return (
    isExactString(value["receiptId"]) &&
    (value["subjectKind"] === "WORKFLOW" || value["subjectKind"] === "FUNCTION") &&
    isExactString(value["subjectId"]) &&
    isExactString(value["subjectVersion"]) &&
    !/[~^*<>=|&,\s]/.test(value["subjectVersion"]) &&
    isDigest(value["subjectDigest"]) &&
    isDigest(value["knowledgeDependencySetDigest"]) &&
    isTimestamp(value["recordedTimeMs"]) &&
    (value["previousReceiptDigest"] === null || isDigest(value["previousReceiptDigest"])) &&
    isDigest(value["receiptDigest"]) &&
    governedAssetsDigestV1(value, "receiptDigest") === value["receiptDigest"]
  );
}

function isMetric(value: unknown, requiredDirection: ShadowMetricV1["direction"]): value is ShadowMetricV1 {
  return (
    hasExactKeys(value, METRIC_KEYS) &&
    isExactString(value["metricId"]) &&
    isExactString(value["metricVersion"]) &&
    value["direction"] === requiredDirection &&
    typeof value["value"] === "number" &&
    Number.isFinite(value["value"]) &&
    value["value"] >= 0
  );
}

function isVerificationOutcome(value: unknown): value is ShadowVerificationOutcomeV1 {
  return (
    hasExactKeys(value, VERIFICATION_KEYS) &&
    (value["status"] === "VERIFIED" || value["status"] === "REJECTED" || value["status"] === "UNKNOWN") &&
    isDigest(value["decisionDigest"]) &&
    isDigest(value["evidenceDigest"])
  );
}

function isRollbackPlan(value: unknown): value is ShadowRollbackPlanV1 {
  if (!hasExactKeys(value, ROLLBACK_KEYS)) return false;
  return (
    isExactString(value["trigger"]) &&
    isExactString(value["scope"]) &&
    isExactRef(value["lastKnownGoodRef"]) &&
    isExactString(value["restoreAction"]) &&
    isExactString(value["reconciliationRule"]) &&
    typeof value["readbackRequired"] === "boolean" &&
    isDigest(value["verifierDigest"]) &&
    isDigest(value["planDigest"]) &&
    governedAssetsDigestV1(value, "planDigest") === value["planDigest"]
  );
}

function sortedDigest(values: readonly unknown[]): string {
  return governedAssetsDigestV1(values.map((value) => governedAssetsDigestV1(value)).sort());
}

function dependencyDigests(snapshot: Omit<ShadowDependencySnapshotV1, "knowledgeDependencySetDigest" | "workflowDependencySetDigest" | "functionDependencySetDigest" | "historicalReceiptSetDigest" | "transitiveClosureDigest">): {
  readonly knowledgeDependencySetDigest: string;
  readonly workflowDependencySetDigest: string;
  readonly functionDependencySetDigest: string;
  readonly historicalReceiptSetDigest: string;
  readonly transitiveClosureDigest: string;
} {
  const knowledgeDependencySetDigest = governedAssetsDigestV1(
    [...snapshot.knowledgeWorkflowInputs.map((entry) => ["WORKFLOW", entry]), ...snapshot.knowledgeFunctionInputs.map((entry) => ["FUNCTION", entry])]
      .map((entry) => governedAssetsDigestV1(entry))
      .sort(),
  );
  const workflowDependencySetDigest = governedAssetsRefSetDigestV1(snapshot.workflowDependencies);
  const functionDependencySetDigest = governedAssetsRefSetDigestV1(snapshot.functionDependencies);
  const historicalReceiptSetDigest = sortedDigest(snapshot.historicalReceipts);
  const transitiveClosureDigest = governedAssetsDigestV1({
    knowledgeDependencySetDigest,
    workflowDependencySetDigest,
    functionDependencySetDigest,
    historicalReceiptSetDigest,
  });
  return {
    knowledgeDependencySetDigest,
    workflowDependencySetDigest,
    functionDependencySetDigest,
    historicalReceiptSetDigest,
    transitiveClosureDigest,
  };
}

function isDependencySnapshot(value: unknown): value is ShadowDependencySnapshotV1 {
  if (!hasExactKeys(value, DEPENDENCY_KEYS)) return false;
  const record = value;
  if (
    !isDenseArray(record["knowledgeWorkflowInputs"]) ||
    !record["knowledgeWorkflowInputs"].every(isKnowledgeBinding) ||
    !isDenseArray(record["knowledgeFunctionInputs"]) ||
    !record["knowledgeFunctionInputs"].every(isKnowledgeBinding) ||
    !isDenseArray(record["workflowDependencies"]) ||
    !record["workflowDependencies"].every(isExactRef) ||
    !isDenseArray(record["functionDependencies"]) ||
    !record["functionDependencies"].every(isExactRef) ||
    !isDenseArray(record["historicalReceipts"]) ||
    !record["historicalReceipts"].every(isHistoricalReceipt) ||
    !isDigest(record["knowledgeDependencySetDigest"]) ||
    !isDigest(record["workflowDependencySetDigest"]) ||
    !isDigest(record["functionDependencySetDigest"]) ||
    !isDigest(record["historicalReceiptSetDigest"]) ||
    !isDigest(record["transitiveClosureDigest"])
  ) return false;
  const calculated = dependencyDigests({
    knowledgeWorkflowInputs: record["knowledgeWorkflowInputs"],
    knowledgeFunctionInputs: record["knowledgeFunctionInputs"],
    workflowDependencies: record["workflowDependencies"],
    functionDependencies: record["functionDependencies"],
    historicalReceipts: record["historicalReceipts"],
  });
  return Object.keys(calculated).every((key) => calculated[key as keyof typeof calculated] === record[key]);
}

function isProjection(value: unknown): value is ShadowRunProjectionV1 {
  return (
    hasExactKeys(value, PROJECTION_KEYS) &&
    isJsonValue(value["output"]) &&
    isVerificationOutcome(value["verificationOutcome"]) &&
    isRollbackPlan(value["rollbackPlan"]) &&
    isDependencySnapshot(value["dependencies"]) &&
    isMetric(value["qualityMetric"], "HIGHER_IS_BETTER") &&
    isMetric(value["reasoningCostMetric"], "LOWER_IS_BETTER")
  );
}

function isReasonCode(value: unknown): value is ReasonCodeV1 {
  return typeof value === "string" && (REASON_ORDER as readonly string[]).includes(value);
}

function isHoldout(value: unknown): value is ShadowReplayHoldoutV1 {
  if (!hasExactKeys(value, CASE_KEYS)) return false;
  if (
    !isExactString(value["holdoutId"], 128) ||
    !isPlainRecord(value["applicabilityInput"]) ||
    (value["expected"] !== "APPLICABLE" && value["expected"] !== "SAFE_ABORT") ||
    !isDenseArray(value["expectedReasonCodes"]) ||
    !value["expectedReasonCodes"].every(isReasonCode) ||
    (value["baseline"] !== null && !isProjection(value["baseline"])) ||
    (value["governed"] !== null && !isProjection(value["governed"]))
  ) return false;
  const reasons = value["expectedReasonCodes"] as unknown[];
  if (new Set(reasons).size !== reasons.length || reasons.length === 0) return false;
  if (value["expected"] === "APPLICABLE") {
    return reasons.length === 1 && reasons[0] === "NONE" && value["baseline"] !== null && value["governed"] !== null;
  }
  return value["baseline"] === null && value["governed"] === null && reasons.every((reason) => SAFE_ABORT_REASONS.has(reason as ReasonCodeV1));
}

function invalidDecision(): ShadowWorkflowReplayDecisionV1 {
  return makeDecision("SHADOW_REPLAY_ABORTED", ["INVALID_INPUT"], 0, 0, []);
}

function makeDecision(
  status: ShadowWorkflowReplayDecisionV1["status"],
  reasons: readonly ReasonCodeV1[],
  applicableHoldoutCount: number,
  safeAbortCount: number,
  holdoutResults: readonly ShadowReplayHoldoutResultV1[],
): ShadowWorkflowReplayDecisionV1 {
  const finalReasons = orderedReasons(reasons.length === 0 ? ["NONE"] : reasons);
  const payload: {
    readonly status: ShadowWorkflowReplayDecisionV1["status"];
    readonly outcome: ShadowWorkflowReplayDecisionV1["outcome"];
    readonly reasonCodes: readonly ReasonCodeV1[];
    readonly applicableHoldoutCount: number;
    readonly safeAbortCount: number;
    readonly holdoutResults: readonly ShadowReplayHoldoutResultV1[];
  } = {
    status,
    outcome: status === "SHADOW_PARITY_VERIFIED" ? "PASS" : "ABORTED",
    reasonCodes: finalReasons,
    applicableHoldoutCount,
    safeAbortCount,
    holdoutResults,
  };
  return immutable({
    status,
    outcome: payload.outcome,
    reasonCodes: finalReasons,
    decisionDigest: governedAssetsDigestV1(payload),
    applicableHoldoutCount,
    safeAbortCount,
    holdoutResults,
  });
}

function projectionDigest(value: unknown): string {
  return governedAssetsDigestV1(value);
}

function sameMetricIdentity(left: ShadowMetricV1, right: ShadowMetricV1): boolean {
  return left.metricId === right.metricId && left.metricVersion === right.metricVersion && left.direction === right.direction;
}

function sameKnowledgeInputs(
  applicability: WorkflowApplicabilityInputV1,
  dependencies: ShadowDependencySnapshotV1,
): boolean {
  return (
    governedAssetsDigestV1(applicability.knowledgeInput.workflowInputs) === governedAssetsDigestV1(dependencies.knowledgeWorkflowInputs) &&
    governedAssetsDigestV1(applicability.knowledgeInput.functionInputs) === governedAssetsDigestV1(dependencies.knowledgeFunctionInputs) &&
    governedAssetsDigestV1(applicability.knowledgeInput.historicalReceipts) === governedAssetsDigestV1(dependencies.historicalReceipts)
  );
}

function compareApplicable(
  holdout: ShadowReplayHoldoutV1,
  applicabilityReasonCodes: readonly string[],
): ShadowReplayHoldoutResultV1 {
  const baseline = holdout.baseline as ShadowRunProjectionV1;
  const governed = holdout.governed as ShadowRunProjectionV1;
  const outputParity = projectionDigest(governed.output) === projectionDigest(baseline.output);
  const verificationParity = projectionDigest(governed.verificationOutcome) === projectionDigest(baseline.verificationOutcome);
  const rollbackParity = projectionDigest(governed.rollbackPlan) === projectionDigest(baseline.rollbackPlan);
  const dependencyParity = projectionDigest(governed.dependencies) === projectionDigest(baseline.dependencies);
  const qualityEqualOrBetter =
    sameMetricIdentity(governed.qualityMetric, baseline.qualityMetric) &&
    governed.qualityMetric.value >= baseline.qualityMetric.value;
  const reasoningCostLower =
    sameMetricIdentity(governed.reasoningCostMetric, baseline.reasoningCostMetric) &&
    governed.reasoningCostMetric.value < baseline.reasoningCostMetric.value;
  const failedReasons: ReasonCodeV1[] = [];
  if (!outputParity) failedReasons.push("OUTPUT_MISMATCH");
  if (!verificationParity) failedReasons.push("VERIFICATION_MISMATCH");
  if (!rollbackParity) failedReasons.push("ROLLBACK_MISMATCH");
  if (!dependencyParity) failedReasons.push("DEPENDENCY_MISMATCH");
  if (!qualityEqualOrBetter) failedReasons.push("QUALITY_REGRESSION");
  if (!reasoningCostLower) failedReasons.push("REASONING_COST_NOT_LOWER");
  return immutable({
    holdoutId: holdout.holdoutId,
    applicabilityStatus: "FAST_PATH_ALLOWED",
    applicabilityReasonCodes,
    outcome: failedReasons.length === 0 ? "PARITY_VERIFIED" : "REJECTED",
    outputParity,
    verificationParity,
    rollbackParity,
    dependencyParity,
    qualityEqualOrBetter,
    reasoningCostLower,
    decisionDigest: governedAssetsDigestV1({
      holdoutId: holdout.holdoutId,
      applicabilityReasonCodes,
      baseline: projectionDigest(baseline),
      governed: projectionDigest(governed),
      failedReasons: orderedReasons(failedReasons),
    }),
  });
}

/**
 * Compare supplied shadow projections only. No callback, runner, provider or
 * execution capability is accepted by this API.
 */
export function replayShadowWorkflowV1(input: unknown): ShadowWorkflowReplayDecisionV1 {
  if (!hasExactKeys(input, INPUT_KEYS)) return invalidDecision();
  const record = input;
  if (
    record["schemaVersion"] !== SHADOW_WORKFLOW_REPLAY_SCHEMA_V1 ||
    record["verifierVersion"] !== SHADOW_REPLAY_VERIFIER_VERSION_V1 ||
    !isDenseArray(record["holdouts"]) ||
    !record["holdouts"].every(isHoldout) ||
    !isDenseArray(record["requiredAbortReasons"]) ||
    !record["requiredAbortReasons"].every(isReasonCode)
  ) return invalidDecision();

  const holdouts = record["holdouts"] as ShadowReplayHoldoutV1[];
  const requiredAbortReasons = record["requiredAbortReasons"] as ReasonCodeV1[];
  if (
    holdouts.length === 0 ||
    new Set(holdouts.map((holdout) => holdout.holdoutId)).size !== holdouts.length ||
    new Set(requiredAbortReasons).size !== requiredAbortReasons.length ||
    requiredAbortReasons.length === 0
  ) return invalidDecision();

  const results: ShadowReplayHoldoutResultV1[] = [];
  const reasons = new Set<ReasonCodeV1>();
  let applicableHoldoutCount = 0;
  let safeAbortCount = 0;
  let invalid = false;
  for (const holdout of holdouts) {
    const applicability = evaluateWorkflowApplicabilityV1(holdout.applicabilityInput);
    const actualReasons = applicability.reasonCodes;
    const expectedReasons = orderedReasons(holdout.expectedReasonCodes);
    const exactReasonParity = governedAssetsDigestV1(actualReasons) === governedAssetsDigestV1(expectedReasons);

    if (holdout.expected === "APPLICABLE") {
      applicableHoldoutCount += 1;
      if (applicability.status !== "FAST_PATH_ALLOWED" || !exactReasonParity) {
        invalid = true;
        actualReasons.forEach((reason) => reasons.add(reason as ReasonCodeV1));
        results.push(immutable({
          holdoutId: holdout.holdoutId,
          applicabilityStatus: applicability.status,
          applicabilityReasonCodes: actualReasons,
          outcome: "REJECTED",
          outputParity: null,
          verificationParity: null,
          rollbackParity: null,
          dependencyParity: null,
          qualityEqualOrBetter: null,
          reasoningCostLower: null,
          decisionDigest: governedAssetsDigestV1({ holdoutId: holdout.holdoutId, applicability }),
        }));
        continue;
      }
      if (
        !sameKnowledgeInputs(holdout.applicabilityInput, holdout.baseline?.dependencies as ShadowDependencySnapshotV1) ||
        !sameKnowledgeInputs(holdout.applicabilityInput, holdout.governed?.dependencies as ShadowDependencySnapshotV1)
      ) {
        invalid = true;
        reasons.add("DEPENDENCY_MISMATCH");
        results.push(immutable({
          holdoutId: holdout.holdoutId,
          applicabilityStatus: applicability.status,
          applicabilityReasonCodes: actualReasons,
          outcome: "REJECTED",
          outputParity: null,
          verificationParity: null,
          rollbackParity: null,
          dependencyParity: false,
          qualityEqualOrBetter: null,
          reasoningCostLower: null,
          decisionDigest: governedAssetsDigestV1({ holdoutId: holdout.holdoutId, reason: "DEPENDENCY_MISMATCH" }),
        }));
        continue;
      }
      const result = compareApplicable(holdout, actualReasons);
      if (result.outcome !== "PARITY_VERIFIED") {
        invalid = true;
        if (!result.outputParity) reasons.add("OUTPUT_MISMATCH");
        if (!result.verificationParity) reasons.add("VERIFICATION_MISMATCH");
        if (!result.rollbackParity) reasons.add("ROLLBACK_MISMATCH");
        if (!result.dependencyParity) reasons.add("DEPENDENCY_MISMATCH");
        if (!result.qualityEqualOrBetter) reasons.add("QUALITY_REGRESSION");
        if (!result.reasoningCostLower) reasons.add("REASONING_COST_NOT_LOWER");
      }
      results.push(result);
      continue;
    }

    if (applicability.status === "FAST_PATH_ALLOWED" || !exactReasonParity) {
      invalid = true;
      reasons.add("SAFE_ABORT_REQUIRED");
      results.push(immutable({
        holdoutId: holdout.holdoutId,
        applicabilityStatus: applicability.status,
        applicabilityReasonCodes: actualReasons,
        outcome: "REJECTED",
        outputParity: null,
        verificationParity: null,
        rollbackParity: null,
        dependencyParity: null,
        qualityEqualOrBetter: null,
        reasoningCostLower: null,
        decisionDigest: governedAssetsDigestV1({ holdoutId: holdout.holdoutId, applicability }),
      }));
    } else {
      safeAbortCount += 1;
      results.push(immutable({
        holdoutId: holdout.holdoutId,
        applicabilityStatus: applicability.status,
        applicabilityReasonCodes: actualReasons,
        outcome: "SAFE_ABORT",
        outputParity: null,
        verificationParity: null,
        rollbackParity: null,
        dependencyParity: null,
        qualityEqualOrBetter: null,
        reasoningCostLower: null,
        decisionDigest: governedAssetsDigestV1({ holdoutId: holdout.holdoutId, applicability }),
      }));
    }
  }

  for (const requiredReason of requiredAbortReasons) {
    if (!holdouts.some((holdout) => holdout.expected === "SAFE_ABORT" && holdout.expectedReasonCodes.includes(requiredReason))) {
      invalid = true;
      reasons.add("SAFE_ABORT_REQUIRED");
    }
  }
  if (applicableHoldoutCount === 0) {
    invalid = true;
    reasons.add("NOT_APPLICABLE");
  }
  if (safeAbortCount === 0) {
    invalid = true;
    reasons.add("SAFE_ABORT_REQUIRED");
  }

  return makeDecision(
    invalid ? "SHADOW_REPLAY_ABORTED" : "SHADOW_PARITY_VERIFIED",
    [...reasons],
    applicableHoldoutCount,
    safeAbortCount,
    results,
  );
}

/** Explicit aliases for integrations that use evaluate/compare naming. */
export const evaluateShadowWorkflowReplayV1 = replayShadowWorkflowV1;
export const compareShadowWorkflowReplayV1 = replayShadowWorkflowV1;

/** Build the digest fields for a dependency snapshot without executing a path. */
export function shadowDependencyDigestsV1(
  snapshot: Omit<ShadowDependencySnapshotV1, "knowledgeDependencySetDigest" | "workflowDependencySetDigest" | "functionDependencySetDigest" | "historicalReceiptSetDigest" | "transitiveClosureDigest">,
): ShadowDependencySnapshotV1["transitiveClosureDigest"] extends string ? ReturnType<typeof dependencyDigests> : never {
  return dependencyDigests(snapshot) as ReturnType<typeof dependencyDigests>;
}

/** Digest helper for the immutable rollback plan payload. */
export function shadowRollbackPlanDigestV1(plan: Omit<ShadowRollbackPlanV1, "planDigest">): string {
  return governedAssetsDigestV1(plan);
}
