/**
 * CKS-11 deterministic Knowledge dependency resolution (v1).
 *
 * This module is a use-time guard. It resolves the exact Knowledge bindings
 * copied into workflow/function inputs against an immutable registry snapshot;
 * it does not mutate assets, receipts, indexes, or activation state.
 * Supersession, freshness failure, or any binding drift is fail-closed and
 * returns REVALIDATION_REQUIRED. Missing or ambiguous request/registry input
 * cannot enter the fast path.
 */
import {
  governedAssetsDigestV1,
  type FastPathRouteStatusV1,
  type RouteReasonCodeV1,
} from "./governed-assets-v1.js";

const DIGEST = /^[a-f0-9]{64}$/;
const DANGEROUS_KEYS = new Set(["__proto__", "prototype", "constructor"]);
const ROUTE_REASON_ORDER: readonly RouteReasonCodeV1[] = [
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
];

const REQUEST_KEYS = [
  "knowledgeId",
  "version",
  "digest",
  "freshness",
  "scope",
] as const;
const FRESHNESS_KEYS = ["validFromMs", "validUntilMs"] as const;
const RECORD_KEYS = [...REQUEST_KEYS, "state", "supersededBy"] as const;
const RECEIPT_KEYS = [
  "receiptId",
  "subjectKind",
  "subjectId",
  "subjectVersion",
  "subjectDigest",
  "knowledgeDependencySetDigest",
  "recordedTimeMs",
  "previousReceiptDigest",
  "receiptDigest",
] as const;
const INPUT_KEYS = [
  "asOfMs",
  "workflowInputs",
  "functionInputs",
  "knowledgeRecords",
  "historicalReceipts",
] as const;

const STATES = ["CURRENT", "SUPERSEDED", "REVOKED", "UNAVAILABLE"] as const;
const SUBJECT_KINDS = ["WORKFLOW", "FUNCTION"] as const;

type KnowledgeStateV1 = (typeof STATES)[number];
export type KnowledgeSubjectKindV1 = (typeof SUBJECT_KINDS)[number];

export interface KnowledgeFreshnessV1 {
  readonly validFromMs: number;
  readonly validUntilMs: number;
}

/** The complete exact Knowledge identity carried by a workflow/function input. */
export interface KnowledgeBindingV1 {
  readonly knowledgeId: string;
  readonly version: string;
  readonly digest: string;
  readonly freshness: KnowledgeFreshnessV1;
  readonly scope: string;
}

/** An immutable registry snapshot entry. */
export interface KnowledgeRecordV1 extends KnowledgeBindingV1 {
  readonly state: KnowledgeStateV1;
  readonly supersededBy: string | null;
}

/** A historical receipt binding; its bytes are never rewritten by resolution. */
export interface HistoricalKnowledgeReceiptV1 {
  readonly receiptId: string;
  readonly subjectKind: KnowledgeSubjectKindV1;
  readonly subjectId: string;
  readonly subjectVersion: string;
  readonly subjectDigest: string;
  readonly knowledgeDependencySetDigest: string;
  readonly recordedTimeMs: number;
  readonly previousReceiptDigest: string | null;
  readonly receiptDigest: string;
}

export interface KnowledgeRevalidationInputV1 {
  readonly asOfMs: number;
  readonly workflowInputs: readonly KnowledgeBindingV1[];
  readonly functionInputs: readonly KnowledgeBindingV1[];
  readonly knowledgeRecords: readonly KnowledgeRecordV1[];
  readonly historicalReceipts: readonly HistoricalKnowledgeReceiptV1[];
}

export interface ResolvedKnowledgeDependencyV1 extends KnowledgeBindingV1 {
  readonly subjectKind: KnowledgeSubjectKindV1;
  readonly registryState: KnowledgeStateV1;
}

export interface KnowledgeRevalidationResultV1 {
  /** Fast-path route status for the dependency gate. */
  readonly status: FastPathRouteStatusV1;
  /** CURRENT is the dependency-only success state; drift is never CURRENT. */
  readonly resolutionStatus: "CURRENT" | "REVALIDATION_REQUIRED" | "FAST_PATH_ABORTED";
  readonly routeStatus: FastPathRouteStatusV1;
  readonly reasonCodes: readonly RouteReasonCodeV1[];
  readonly asOfMs: number | null;
  readonly workflowInputs: readonly KnowledgeBindingV1[];
  readonly functionInputs: readonly KnowledgeBindingV1[];
  readonly resolvedDependencies: readonly ResolvedKnowledgeDependencyV1[];
  readonly historicalReceipts: readonly HistoricalKnowledgeReceiptV1[];
  readonly dependencySetDigest: string;
  readonly decisionDigest: string;
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) return false;
  for (const key of Reflect.ownKeys(value)) {
    if (typeof key !== "string" || DANGEROUS_KEYS.has(key)) return false;
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (descriptor === undefined || !("value" in descriptor) || descriptor.enumerable !== true) {
      return false;
    }
  }
  return true;
}

function isDenseArray(value: unknown): value is unknown[] {
  if (!Array.isArray(value) || Object.getPrototypeOf(value) !== Array.prototype) return false;
  const keys = Reflect.ownKeys(value);
  if (keys.length !== value.length + 1) return false;
  for (let index = 0; index < value.length; index += 1) {
    const descriptor = Object.getOwnPropertyDescriptor(value, index);
    if (descriptor === undefined || !("value" in descriptor) || descriptor.enumerable !== true) {
      return false;
    }
  }
  return true;
}

function hasExactKeys(value: unknown, keys: readonly string[]): value is Record<string, unknown> {
  if (!isPlainRecord(value)) return false;
  const actual = Object.keys(value).sort();
  const expected = [...keys].sort();
  return actual.length === expected.length && actual.every((key, index) => key === expected[index]);
}

function isSafeInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0 && !Object.is(value, -0);
}

function isExactString(value: unknown, maximum: number): value is string {
  return (
    typeof value === "string" &&
    value.length > 0 &&
    value.length <= maximum &&
    value === value.trim() &&
    !/[\u0000-\u001f\u007f]/.test(value)
  );
}

function isExactVersion(value: unknown): value is string {
  return (
    isExactString(value, 128) &&
    !/[~^*<>=|&,\s]/.test(value) &&
    !/(?:^|[./_-])(?:latest|range|x)(?=$|[./_-])/i.test(value)
  );
}

function isDigest(value: unknown): value is string {
  return typeof value === "string" && DIGEST.test(value);
}

function isFreshness(value: unknown): value is KnowledgeFreshnessV1 {
  if (!hasExactKeys(value, FRESHNESS_KEYS)) return false;
  const record = value as Record<string, unknown>;
  return (
    isSafeInteger(record["validFromMs"]) &&
    isSafeInteger(record["validUntilMs"]) &&
    record["validFromMs"] < record["validUntilMs"]
  );
}

function isBinding(value: unknown): value is KnowledgeBindingV1 {
  if (!hasExactKeys(value, REQUEST_KEYS)) return false;
  return isBindingFields(value as Record<string, unknown>);
}

function isBindingFields(record: Record<string, unknown>): boolean {
  return (
    isExactString(record["knowledgeId"], 256) &&
    isExactVersion(record["version"]) &&
    isDigest(record["digest"]) &&
    isFreshness(record["freshness"]) &&
    isExactString(record["scope"], 256)
  );
}

function isRecord(value: unknown): value is KnowledgeRecordV1 {
  if (!hasExactKeys(value, RECORD_KEYS)) return false;
  const record = value as Record<string, unknown>;
  return (
    isBindingFields(record) &&
    typeof record["state"] === "string" &&
    STATES.includes(record["state"] as KnowledgeStateV1) &&
    (record["supersededBy"] === null || isExactVersion(record["supersededBy"]))
  );
}

function isReceipt(value: unknown): value is HistoricalKnowledgeReceiptV1 {
  if (!hasExactKeys(value, RECEIPT_KEYS)) return false;
  const record = value as Record<string, unknown>;
  if (
    !isExactString(record["receiptId"], 256) ||
    !SUBJECT_KINDS.includes(record["subjectKind"] as KnowledgeSubjectKindV1) ||
    !isExactString(record["subjectId"], 256) ||
    !isExactVersion(record["subjectVersion"]) ||
    !isDigest(record["subjectDigest"]) ||
    !isDigest(record["knowledgeDependencySetDigest"]) ||
    !isSafeInteger(record["recordedTimeMs"]) ||
    (record["previousReceiptDigest"] !== null && !isDigest(record["previousReceiptDigest"])) ||
    !isDigest(record["receiptDigest"])
  ) {
    return false;
  }
  return governedAssetsDigestV1(value, "receiptDigest") === record["receiptDigest"];
}

function clone<T>(value: T): T {
  if (value === null || typeof value !== "object") return value;
  if (Array.isArray(value)) return value.map((entry) => clone(entry)) as T;
  const result: Record<string, unknown> = {};
  for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
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
    for (const entry of Object.values(value as Record<string, unknown>)) freezeDeep(entry);
    Object.freeze(value);
  }
  return value;
}

function immutable<T>(value: T): T {
  return freezeDeep(clone(value));
}

function bindingKey(kind: KnowledgeSubjectKindV1, binding: KnowledgeBindingV1): string {
  return governedAssetsDigestV1({
    kind,
    knowledgeId: binding.knowledgeId,
    version: binding.version,
    digest: binding.digest,
    freshness: binding.freshness,
    scope: binding.scope,
  });
}

function freshnessEqual(left: KnowledgeFreshnessV1, right: KnowledgeFreshnessV1): boolean {
  return left.validFromMs === right.validFromMs && left.validUntilMs === right.validUntilMs;
}

function sameIdentity(left: KnowledgeBindingV1, right: KnowledgeBindingV1): boolean {
  return (
    left.knowledgeId === right.knowledgeId &&
    left.version === right.version &&
    left.digest === right.digest &&
    left.scope === right.scope
  );
}

function sortedReasons(reasons: ReadonlySet<RouteReasonCodeV1>): readonly RouteReasonCodeV1[] {
  return ROUTE_REASON_ORDER.filter((reason) => reasons.has(reason));
}

function result(
  status: FastPathRouteStatusV1,
  reasons: readonly RouteReasonCodeV1[],
  input: KnowledgeRevalidationInputV1 | null,
  resolvedDependencies: readonly ResolvedKnowledgeDependencyV1[],
  dependencySetDigest: string,
): KnowledgeRevalidationResultV1 {
  const asOfMs = input?.asOfMs ?? null;
  const workflowInputs = input?.workflowInputs ?? [];
  const functionInputs = input?.functionInputs ?? [];
  const historicalReceipts = input?.historicalReceipts ?? [];
  const resolutionStatus =
    status === "FAST_PATH_ALLOWED"
      ? "CURRENT"
      : status === "REVALIDATION_REQUIRED"
        ? "REVALIDATION_REQUIRED"
        : "FAST_PATH_ABORTED";
  const payload = {
    status,
    resolutionStatus,
    reasonCodes: [...reasons],
    asOfMs,
    workflowInputs,
    functionInputs,
    resolvedDependencies,
    historicalReceipts,
    dependencySetDigest,
  };
  return immutable({
    status,
    resolutionStatus,
    routeStatus: status,
    reasonCodes: [...reasons],
    asOfMs,
    workflowInputs,
    functionInputs,
    resolvedDependencies,
    historicalReceipts,
    dependencySetDigest,
    decisionDigest: governedAssetsDigestV1(payload),
  });
}

function invalidResult(input: unknown): KnowledgeRevalidationResultV1 {
  const safeAsOfMs = isPlainRecord(input) && isSafeInteger(input["asOfMs"]) ? input["asOfMs"] : null;
  return result(
    "FAST_PATH_ABORTED",
    ["INVALID_INPUT"],
    {
      asOfMs: safeAsOfMs ?? 0,
      workflowInputs: [],
      functionInputs: [],
      knowledgeRecords: [],
      historicalReceipts: [],
    },
    [],
    governedAssetsDigestV1([]),
  );
}

/**
 * Resolve all exact Knowledge dependencies for workflow and function inputs.
 *
 * The registry is matched by Knowledge ID first and then compared field by
 * field. A matching ID with a different version, digest, freshness window or
 * scope is drift; it is never treated as a nearest/current match. Freshness is
 * half-open: validFromMs <= asOfMs < validUntilMs.
 */
export function resolveKnowledgeDependenciesV1(input: unknown): KnowledgeRevalidationResultV1 {
  if (!hasExactKeys(input, INPUT_KEYS)) return invalidResult(input);
  const record = input as Record<string, unknown>;
  const asOfMs = record["asOfMs"];
  const workflowInputs = record["workflowInputs"];
  const functionInputs = record["functionInputs"];
  const knowledgeRecords = record["knowledgeRecords"];
  const historicalReceipts = record["historicalReceipts"];
  if (
    !isSafeInteger(asOfMs) ||
    !isDenseArray(workflowInputs) ||
    !isDenseArray(functionInputs) ||
    !isDenseArray(knowledgeRecords) ||
    !isDenseArray(historicalReceipts) ||
    !workflowInputs.every(isBinding) ||
    !functionInputs.every(isBinding) ||
    !knowledgeRecords.every(isRecord) ||
    !historicalReceipts.every(isReceipt)
  ) {
    return invalidResult(input);
  }

  const typedInput: KnowledgeRevalidationInputV1 = {
    asOfMs,
    workflowInputs: workflowInputs as KnowledgeBindingV1[],
    functionInputs: functionInputs as KnowledgeBindingV1[],
    knowledgeRecords: knowledgeRecords as KnowledgeRecordV1[],
    historicalReceipts: historicalReceipts as HistoricalKnowledgeReceiptV1[],
  };
  const reasons = new Set<RouteReasonCodeV1>();
  const resolved: ResolvedKnowledgeDependencyV1[] = [];
  const seenInputs = new Set<string>();
  const allInputs: readonly [KnowledgeSubjectKindV1, readonly KnowledgeBindingV1[]][] = [
    ["WORKFLOW", typedInput.workflowInputs],
    ["FUNCTION", typedInput.functionInputs],
  ];

  for (const [subjectKind, bindings] of allInputs) {
    for (const binding of bindings) {
      const key = bindingKey(subjectKind, binding);
      if (seenInputs.has(key)) {
        reasons.add("INVALID_INPUT");
        continue;
      }
      seenInputs.add(key);

      const sameId = typedInput.knowledgeRecords.filter(
        (candidate) => candidate.knowledgeId === binding.knowledgeId,
      );
      const exactIdentity = sameId.filter((candidate) => sameIdentity(candidate, binding));
      if (exactIdentity.length > 1) {
        reasons.add("AMBIGUOUS_MATCH");
        continue;
      }
      const matched = exactIdentity[0];
      if (matched === undefined) {
        const sameVersionScope = sameId.filter(
          (candidate) => candidate.version === binding.version && candidate.scope === binding.scope,
        );
        const sameVersion = sameId.filter((candidate) => candidate.version === binding.version);
        const sameScope = sameId.filter((candidate) => candidate.scope === binding.scope);
        if (sameVersionScope.some((candidate) => candidate.digest !== binding.digest)) {
          reasons.add("DIGEST_MISMATCH");
        } else if (sameVersion.length > 0 || sameScope.length > 0 || sameId.length > 0) {
          reasons.add("VERSION_DRIFT");
        } else {
          reasons.add("KNOWLEDGE_MISSING");
        }
        continue;
      }
      if (!freshnessEqual(matched.freshness, binding.freshness)) {
        reasons.add("VERSION_DRIFT");
        continue;
      }
      if (matched.state === "SUPERSEDED" || matched.state === "REVOKED") {
        reasons.add("KNOWLEDGE_SUPERSEDED");
        continue;
      }
      if (matched.state === "UNAVAILABLE") {
        reasons.add("KNOWLEDGE_MISSING");
        continue;
      }
      if (!(matched.freshness.validFromMs <= asOfMs && asOfMs < matched.freshness.validUntilMs)) {
        reasons.add("STALE_KNOWLEDGE");
        continue;
      }
      resolved.push({ ...binding, subjectKind, registryState: matched.state });
    }
  }

  const dependencyTuples = resolved
    .map((dependency) => [dependency.subjectKind, dependency.knowledgeId, dependency.version, dependency.digest, dependency.freshness, dependency.scope] as const)
    .sort((left, right) => {
      const leftJson = JSON.stringify(left);
      const rightJson = JSON.stringify(right);
      return leftJson < rightJson ? -1 : leftJson > rightJson ? 1 : 0;
    });
  const dependencySetDigest = governedAssetsDigestV1(dependencyTuples);
  const orderedReasons = sortedReasons(reasons);
  const status: FastPathRouteStatusV1 =
    orderedReasons.length === 0
      ? "FAST_PATH_ALLOWED"
      : orderedReasons.some((reason) =>
            [
              "KNOWLEDGE_MISSING",
              "STALE_KNOWLEDGE",
              "KNOWLEDGE_SUPERSEDED",
              "VERSION_DRIFT",
              "DIGEST_MISMATCH",
            ].includes(reason),
          )
        ? "REVALIDATION_REQUIRED"
        : "FAST_PATH_ABORTED";
  return result(status, orderedReasons.length === 0 ? ["NONE"] : orderedReasons, typedInput, resolved, dependencySetDigest);
}

/** Descriptive alias for callers that name the operation as a gate evaluation. */
export const evaluateKnowledgeRevalidationV1 = resolveKnowledgeDependenciesV1;
/** Descriptive alias for dependency-focused integrations. */
export const resolveGovernedDependenciesV1 = resolveKnowledgeDependenciesV1;

/** Canonical digest helper for one exact Knowledge binding. */
export function knowledgeBindingDigestV1(binding: KnowledgeBindingV1): string {
  if (!isBinding(binding)) throw new TypeError("INVALID_KNOWLEDGE_BINDING");
  return governedAssetsDigestV1(binding);
}
