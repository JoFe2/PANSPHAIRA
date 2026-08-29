import { createHash } from "node:crypto";
import { canonicalJson } from "./canonical-json.js";

/**
 * UD-M1 authorized thin slice (issue #53).
 *
 * This module contains pure, local contract verification and fixture helpers
 * for a read-only Doctor report and a CHECK_ONLY update plan. It does not
 * install, migrate, activate, promote, roll back, execute packages, inspect a
 * live system, or perform filesystem, process, worker, or network effects.
 */

export const UPDATE_AXIS_NAMES_V1 = [
  "core", "packs", "adapters", "policies", "schemas", "generations",
] as const;
export type UpdateAxisNameV1 = (typeof UPDATE_AXIS_NAMES_V1)[number];

export const UPDATE_CANDIDATE_SCHEMA_V1 = "chimpmaera.update/candidate/v1" as const;
export const UPDATE_LKG_SCHEMA_V1 = "chimpmaera.update/lkg/v1" as const;
export const UPDATE_COMPATIBILITY_SCHEMA_V1 = "chimpmaera.update/compatibility-decision/v1" as const;
export const UPDATE_SAFE_MODE_SCHEMA_V1 = "chimpmaera.update/safe-mode/v1" as const;
export const UPDATE_CHECK_PLAN_SCHEMA_V1 = "chimpmaera.update/check-plan/v1" as const;
export const UPDATE_HEALTH_REPORT_SCHEMA_V1 = "chimpmaera.update/health-report/v1" as const;

export type UpdateSafeModeReasonV1 =
  | "LKG_INCOMPLETE"
  | "HEALTH_CHECK_FAILED"
  | "HEALTH_CHECK_UNOBSERVED";

export const SAFE_MODE_REASON_ORDER_V1: readonly UpdateSafeModeReasonV1[] = Object.freeze([
  "LKG_INCOMPLETE",
  "HEALTH_CHECK_FAILED",
  "HEALTH_CHECK_UNOBSERVED",
]);

export const UPDATE_SAFE_MODE_EXIT_CODE_V1 = 90;

export type UpdateCheckPlanReasonCodeV1 =
  | "UPDATE_CHECK_ACCEPTED"
  | "INVALID_JSON_DENIED"
  | "SCHEMA_DENIED"
  | "UNSUPPORTED_CONTRACT_VERSION_DENIED"
  | "DIGEST_MISMATCH_DENIED"
  | "TUPLE_MISMATCH_DENIED"
  | "COMPATIBILITY_DENIED"
  | "SELF_ATTESTATION_DENIED"
  | "SELF_PROMOTION_DENIED"
  | "AUTHORITY_WIDENING_DENIED"
  | "SAFE_MODE_INCONSISTENT_DENIED"
  | "MUTATION_CLAIM_DENIED"
  | "INDEPENDENT_CONTEXT_DENIED"
  | "AUTHORITY_BINDING_DENIED"
  | "LKG_FRESHNESS_DENIED"
  | "LKG_REVOCATION_DENIED"
  | "HEALTH_CHECK_COVERAGE_DENIED"
  | "HEALTH_CHECK_CONTRADICTION_DENIED";

export const UPDATE_CHECK_PLAN_EXIT_CODES_V1: Readonly<Record<UpdateCheckPlanReasonCodeV1, number>> = Object.freeze({
  UPDATE_CHECK_ACCEPTED: 0,
  INVALID_JSON_DENIED: 49,
  SCHEMA_DENIED: 50,
  UNSUPPORTED_CONTRACT_VERSION_DENIED: 51,
  DIGEST_MISMATCH_DENIED: 52,
  TUPLE_MISMATCH_DENIED: 53,
  COMPATIBILITY_DENIED: 54,
  SELF_ATTESTATION_DENIED: 55,
  SELF_PROMOTION_DENIED: 56,
  AUTHORITY_WIDENING_DENIED: 57,
  SAFE_MODE_INCONSISTENT_DENIED: 58,
  MUTATION_CLAIM_DENIED: 59,
  INDEPENDENT_CONTEXT_DENIED: 60,
  AUTHORITY_BINDING_DENIED: 61,
  LKG_FRESHNESS_DENIED: 62,
  LKG_REVOCATION_DENIED: 63,
  HEALTH_CHECK_COVERAGE_DENIED: 64,
  HEALTH_CHECK_CONTRADICTION_DENIED: 65,
});

const PLAN_DENIAL_ORDER: readonly UpdateCheckPlanReasonCodeV1[] = Object.freeze([
  "SCHEMA_DENIED",
  "UNSUPPORTED_CONTRACT_VERSION_DENIED",
  "INDEPENDENT_CONTEXT_DENIED",
  "DIGEST_MISMATCH_DENIED",
  "TUPLE_MISMATCH_DENIED",
  "AUTHORITY_BINDING_DENIED",
  "LKG_FRESHNESS_DENIED",
  "LKG_REVOCATION_DENIED",
  "COMPATIBILITY_DENIED",
  "SELF_ATTESTATION_DENIED",
  "SELF_PROMOTION_DENIED",
  "AUTHORITY_WIDENING_DENIED",
  "SAFE_MODE_INCONSISTENT_DENIED",
  "MUTATION_CLAIM_DENIED",
]);

export interface UpdateAxisComponentV1 {
  readonly componentId: string;
  readonly version: string;
  readonly digest: string;
}

export type UpdateTupleV1 = { readonly [Axis in UpdateAxisNameV1]: readonly UpdateAxisComponentV1[] };

export interface UpdateLkgV1 {
  readonly schemaVersion: typeof UPDATE_LKG_SCHEMA_V1;
  readonly lkgId: string;
  readonly releaseId: string;
  readonly state: "COMPLETE" | "INCOMPLETE";
  readonly revoked: boolean;
  readonly stale: boolean;
  readonly tuple: UpdateTupleV1;
  readonly authorityProfileDigest: string;
  readonly observedAtMs: number;
  readonly tupleDigest: string;
  readonly lkgDigest: string;
}

export interface UpdateCandidateV1 {
  readonly schemaVersion: typeof UPDATE_CANDIDATE_SCHEMA_V1;
  readonly candidateId: string;
  readonly releaseId: string;
  readonly synthetic: boolean;
  readonly immutable: boolean;
  readonly source: "SYNTHETIC_ISOLATED";
  readonly targetTuple: UpdateTupleV1;
  readonly targetTupleDigest: string;
  readonly authorityProfileDigest: string;
  readonly attestedBy: string;
  readonly promotedBy: string;
  readonly digest: string;
}

export interface UpdateCompatibilityDecisionV1 {
  readonly schemaVersion: typeof UPDATE_COMPATIBILITY_SCHEMA_V1;
  readonly decisionId: string;
  readonly subjectCandidateDigest: string;
  readonly subjectLkgDigest: string;
  readonly verdict: "COMPATIBLE" | "INCOMPATIBLE";
  readonly authorityDelta: { readonly added: readonly string[]; readonly removed: readonly string[] };
  readonly resolvedBy: string;
  readonly decisionDigest: string;
}

export interface UpdateSafeModeV1 {
  readonly schemaVersion: typeof UPDATE_SAFE_MODE_SCHEMA_V1;
  readonly active: boolean;
  readonly readOnly: true;
  readonly reasonCodes: readonly UpdateSafeModeReasonV1[];
}

export interface UpdateCheckPlanV1 {
  readonly schemaVersion: typeof UPDATE_CHECK_PLAN_SCHEMA_V1;
  readonly planId: string;
  readonly mode: "CHECK_ONLY";
  readonly executionAuthorized: boolean;
  readonly candidate: UpdateCandidateV1;
  readonly compatibility: UpdateCompatibilityDecisionV1;
  readonly lkg: UpdateLkgV1;
  readonly safeMode: UpdateSafeModeV1;
  readonly selfAttestation: boolean;
  readonly selfPromotion: boolean;
  readonly authorityWidened: boolean;
  readonly issuedAtMs: number;
  readonly planDigest: string;
}

export interface UpdatePlanVerificationContextV1 {
  readonly expectedUpdaterId: string;
  readonly expectedCandidate: {
    readonly candidateId: string;
    readonly releaseId: string;
    readonly candidateDigest: string;
  };
  readonly expectedCompatibility: {
    readonly decisionId: string;
    readonly decisionDigest: string;
  };
  readonly expectedTarget: {
    readonly tuple: UpdateTupleV1;
    readonly authorityProfileDigest: string;
  };
  readonly expectedLkg: {
    readonly lkgId: string;
    readonly releaseId: string;
    readonly lkgDigest: string;
    readonly tuple: UpdateTupleV1;
    readonly authorityProfileDigest: string;
    readonly observedAtMs: number;
  };
  readonly trustedAuthorities: {
    readonly attestedBy: string;
    readonly promotedBy: string;
    readonly resolvedBy: string;
  };
  readonly evaluationTimeMs: number;
  readonly maxLkgAgeMs: number;
  readonly revocationState: {
    readonly lkgId: string;
    readonly lkgDigest: string;
    readonly revoked: boolean;
    readonly evaluatedAtMs: number;
  };
}

export type UpdateHealthProfileV1 = "HEALTH" | "READINESS";

export interface UpdateHealthCheckV1 {
  readonly checkId: string;
  readonly status: "PASS" | "FAIL" | "NOT_OBSERVED";
  readonly reasonCode: "OBSERVATION_MATCHED" | "OBSERVATION_MISMATCH" | "OBSERVATION_UNAVAILABLE";
}

export interface UpdateHealthReportV1 {
  readonly schemaVersion: typeof UPDATE_HEALTH_REPORT_SCHEMA_V1;
  readonly reportId: string;
  readonly profile: UpdateHealthProfileV1;
  readonly readOnly: true;
  readonly lockedTupleDigest: string;
  readonly tupleStatus: "COMPLETE" | "INCOMPLETE";
  readonly checks: readonly UpdateHealthCheckV1[];
  readonly safeMode: UpdateSafeModeV1;
  readonly generatedAtMs: number;
  readonly reportDigest: string;
}

export interface UpdateHealthVerificationContextV1 {
  readonly expectedTuple: UpdateTupleV1;
  readonly expectedProfile: UpdateHealthProfileV1;
}

export type UpdateCheckPlanVerificationResultV1 =
  | { readonly outcome: "ACCEPTED"; readonly reasonCodes: readonly ["UPDATE_CHECK_ACCEPTED"]; readonly exitCode: 0 }
  | { readonly outcome: "SAFE_MODE"; readonly reasonCodes: readonly UpdateSafeModeReasonV1[]; readonly exitCode: number }
  | { readonly outcome: "DENIED"; readonly reasonCodes: readonly UpdateCheckPlanReasonCodeV1[]; readonly exitCode: number };

export type UpdateHealthReportVerificationResultV1 =
  | { readonly outcome: "ACCEPTED"; readonly reasonCodes: readonly ["UPDATE_HEALTH_ACCEPTED"]; readonly exitCode: 0 }
  | { readonly outcome: "SAFE_MODE"; readonly reasonCodes: readonly UpdateSafeModeReasonV1[]; readonly exitCode: number }
  | { readonly outcome: "DENIED"; readonly reasonCodes: readonly UpdateCheckPlanReasonCodeV1[]; readonly exitCode: number };

// Canonical SemVer 2.0.0. Exact versions are required; ranges and mutable
// selectors (including dist-tags such as `latest`) are deliberately invalid.
const SEMVER_NUMERIC = "(?:0|[1-9][0-9]*)";
const SEMVER_PRERELEASE_IDENTIFIER = "(?:0|[1-9][0-9]*|[0-9]*[A-Za-z-][0-9A-Za-z-]*)";
const EXACT_VERSION = new RegExp(
  `^${SEMVER_NUMERIC}(?:\\.${SEMVER_NUMERIC}){2}(?:-${SEMVER_PRERELEASE_IDENTIFIER}(?:\\.${SEMVER_PRERELEASE_IDENTIFIER})*)?(?:\\+[0-9A-Za-z-]+(?:\\.[0-9A-Za-z-]+)*)?$`,
);
const DIGEST = /^[a-f0-9]{64}$/;
const PLAN_ID = /^update:[a-z0-9][a-z0-9._-]{2,95}$/;
const CANDIDATE_ID = /^candidate:[a-z0-9][a-z0-9._-]{2,95}$/;
const UPDATER_ID = /^updater:[a-z0-9][a-z0-9._-]{2,95}$/;
const LKG_ID = /^(?:lkg|maintenance):[a-z0-9][a-z0-9._-]{2,95}$/;
const DECISION_ID = /^compatibility:[a-z0-9][a-z0-9._-]{2,95}$/;
const REPORT_ID = /^update:[a-z0-9][a-z0-9._-]{2,95}$/;
const ATTESTOR_ID = /^attestor:[a-z0-9][a-z0-9._-]{2,95}$/;
const PROMOTER_ID = /^promoter:[a-z0-9][a-z0-9._-]{2,95}$/;
const RESOLVER_ID = /^resolver:[a-z0-9][a-z0-9._-]{2,95}$/;
const DANGEROUS_KEYS = new Set(["__proto__", "prototype", "constructor"]);

const COMPONENT_ID_PATTERNS: Readonly<Record<UpdateAxisNameV1, RegExp>> = Object.freeze({
  core: /^core:[a-z0-9][a-z0-9._-]{2,95}$/,
  packs: /^pack:[a-z0-9][a-z0-9._-]{2,95}$/,
  adapters: /^adapter:[a-z0-9][a-z0-9._-]{2,95}$/,
  policies: /^policy:[a-z0-9][a-z0-9._-]{2,95}$/,
  schemas: /^schema:[a-z0-9][a-z0-9._-]{2,95}$/,
  generations: /^generation:[a-z0-9][a-z0-9._-]{2,95}$/,
});

export const UPDATE_HEALTH_PROFILE_CHECK_IDS_V1: Readonly<Record<UpdateHealthProfileV1, readonly string[]>> = deepFreeze({
  HEALTH: ["check:tuple-lock"],
  READINESS: ["check:tuple-lock", "check:safe-mode"],
});

function isPlainDataRecord(value: unknown): value is Record<string, unknown> {
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

function isDenseStandardArray(value: unknown): value is unknown[] {
  if (!Array.isArray(value) || Object.getPrototypeOf(value) !== Array.prototype) return false;
  const keys = Reflect.ownKeys(value);
  if (keys.some((key) => typeof key !== "string")) return false;
  const expected = [...Array.from({ length: value.length }, (_, index) => String(index)), "length"];
  if (keys.length !== expected.length || expected.some((key) => !keys.includes(key))) return false;
  return Array.from({ length: value.length }, (_, index) => String(index)).every((key) => {
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    return descriptor !== undefined && "value" in descriptor && descriptor.enumerable === true;
  });
}

function exactKeys(value: unknown, keys: readonly string[]): value is Record<string, unknown> {
  if (!isPlainDataRecord(value)) return false;
  const actual = Object.keys(value).sort();
  const expected = [...keys].sort();
  return actual.length === expected.length && actual.every((key, index) => key === expected[index]);
}

function safeObject(entries: readonly (readonly [string, unknown])[], nullPrototype = false): Record<string, unknown> {
  const output = Object.create(nullPrototype ? null : Object.prototype) as Record<string, unknown>;
  for (const [key, value] of entries) {
    if (DANGEROUS_KEYS.has(key) || Object.prototype.hasOwnProperty.call(output, key)) {
      throw new TypeError("UNSAFE_JSON_OBJECT_KEY");
    }
    Object.defineProperty(output, key, { value, enumerable: true, writable: true, configurable: true });
  }
  return output;
}

function safeJsonClone<T>(value: T, nullPrototypeObjects = false, ancestors = new Set<object>()): T {
  if (value === null || typeof value === "string" || typeof value === "boolean") return value;
  if (typeof value === "number") {
    if (!Number.isFinite(value) || (Number.isInteger(value) && !Number.isSafeInteger(value))) {
      throw new TypeError("UNSAFE_JSON_NUMBER");
    }
    return value;
  }
  if (Array.isArray(value)) {
    if (!isDenseStandardArray(value) || ancestors.has(value)) throw new TypeError("UNSAFE_JSON_ARRAY");
    const next = new Set(ancestors).add(value);
    return value.map((item) => safeJsonClone(item, nullPrototypeObjects, next)) as T;
  }
  if (!isPlainDataRecord(value) || ancestors.has(value as object)) throw new TypeError("UNSAFE_JSON_OBJECT");
  const next = new Set(ancestors).add(value as object);
  return safeObject(Object.keys(value).map((key) => [
    key,
    safeJsonClone((value as Record<string, unknown>)[key], nullPrototypeObjects, next),
  ] as const), nullPrototypeObjects) as T;
}

function deepFreeze<T>(value: T): T {
  if (value !== null && typeof value === "object" && !Object.isFrozen(value)) {
    for (const key of Reflect.ownKeys(value)) {
      if (key !== "length") deepFreeze((value as Record<PropertyKey, unknown>)[key]);
    }
    Object.freeze(value);
  }
  return value;
}

function immutable<T>(value: T): T {
  return deepFreeze(safeJsonClone(value));
}

function isDigest(value: unknown): value is string {
  return typeof value === "string" && DIGEST.test(value);
}

function isTimestamp(value: unknown): value is number {
  return Number.isSafeInteger(value) && (value as number) >= 0;
}

function isStringArray(value: unknown): value is string[] {
  return isDenseStandardArray(value) && value.every((item) => typeof item === "string")
    && value.length === new Set(value).size;
}

function isSafeModeReason(value: unknown): value is UpdateSafeModeReasonV1 {
  return typeof value === "string" && (SAFE_MODE_REASON_ORDER_V1 as readonly string[]).includes(value);
}

/**
 * Computes a canonical SHA-256 content digest after rejecting unsafe JSON
 * shapes. This digest is not a signature and provides no trust by itself.
 */
export function updateCheckPlanDigestV1(value: Record<string, unknown>, digestKey: string): string {
  if (DANGEROUS_KEYS.has(digestKey)) throw new TypeError("UNSAFE_DIGEST_KEY");
  const cloned = safeJsonClone(value);
  if (!isPlainDataRecord(cloned)) throw new TypeError("UNSAFE_DIGEST_INPUT");
  const content = safeObject(Object.keys(cloned)
    .filter((key) => key !== digestKey)
    .map((key) => [key, cloned[key]] as const));
  return createHash("sha256").update(canonicalJson(content)).digest("hex");
}

export function updateTupleDigestV1(tuple: UpdateTupleV1): string {
  const cloned = safeJsonClone(tuple);
  if (!validTuple(cloned)) throw new TypeError("INVALID_UPDATE_TUPLE");
  return createHash("sha256").update(canonicalJson(cloned)).digest("hex");
}

// ---------------------------------------------------------------------------
// Verified deterministic exports
// ---------------------------------------------------------------------------

function projectPublicHealthReport(report: UpdateHealthReportV1): unknown {
  const checks = report.checks.map((check) => safeObject([
    ["checkId", check.checkId],
    ["status", check.status],
    ["reasonCode", check.reasonCode],
  ], true));
  return deepFreeze(safeObject([
    ["schemaVersion", report.schemaVersion],
    ["reportId", report.reportId],
    ["profile", report.profile],
    ["readOnly", report.readOnly],
    ["lockedTupleDigest", report.lockedTupleDigest],
    ["tupleStatus", report.tupleStatus],
    ["checks", checks],
    ["safeMode", safeObject([
      ["schemaVersion", report.safeMode.schemaVersion],
      ["active", report.safeMode.active],
      ["readOnly", report.safeMode.readOnly],
      ["reasonCodes", [...report.safeMode.reasonCodes]],
    ], true)],
    ["generatedAtMs", report.generatedAtMs],
    ["reportDigest", report.reportDigest],
  ], true));
}

/** Validates against independent context before emitting a fixed public projection. */
export function renderRedactedUpdateHealthReportV1(
  report: UpdateHealthReportV1,
  context: UpdateHealthVerificationContextV1 | undefined,
): string {
  let snapshot: UpdateHealthReportV1;
  try {
    snapshot = immutable(report);
  } catch {
    throw new Error("UNSAFE_OR_INVALID_UPDATE_EXPORT");
  }
  const result = verifyUpdateHealthReportV1(snapshot, context);
  if (result.outcome === "DENIED") throw new Error("UNSAFE_OR_INVALID_UPDATE_EXPORT");
  return canonicalJson(safeJsonClone(projectPublicHealthReport(snapshot)));
}

// ---------------------------------------------------------------------------
// Health/readiness report verification
// ---------------------------------------------------------------------------

function validHealthCheckShape(value: unknown): value is UpdateHealthCheckV1 {
  return exactKeys(value, ["checkId", "status", "reasonCode"])
    && typeof value.checkId === "string"
    && ["PASS", "FAIL", "NOT_OBSERVED"].includes(value.status as string)
    && ["OBSERVATION_MATCHED", "OBSERVATION_MISMATCH", "OBSERVATION_UNAVAILABLE"].includes(value.reasonCode as string);
}

function healthStatusReasonMatches(check: UpdateHealthCheckV1): boolean {
  return (check.status === "PASS" && check.reasonCode === "OBSERVATION_MATCHED")
    || (check.status === "FAIL" && check.reasonCode === "OBSERVATION_MISMATCH")
    || (check.status === "NOT_OBSERVED" && check.reasonCode === "OBSERVATION_UNAVAILABLE");
}

function validSafeMode(value: unknown): value is UpdateSafeModeV1 {
  return exactKeys(value, ["schemaVersion", "active", "readOnly", "reasonCodes"])
    && value.schemaVersion === UPDATE_SAFE_MODE_SCHEMA_V1
    && typeof value.active === "boolean" && value.readOnly === true
    && isDenseStandardArray(value.reasonCodes)
    && value.reasonCodes.length === new Set(value.reasonCodes).size
    && value.reasonCodes.every(isSafeModeReason);
}

function validHealthReportShape(value: unknown): value is UpdateHealthReportV1 {
  return exactKeys(value, ["schemaVersion", "reportId", "profile", "readOnly", "lockedTupleDigest",
    "tupleStatus", "checks", "safeMode", "generatedAtMs", "reportDigest"])
    && value.schemaVersion === UPDATE_HEALTH_REPORT_SCHEMA_V1
    && typeof value.reportId === "string" && REPORT_ID.test(value.reportId)
    && (value.profile === "HEALTH" || value.profile === "READINESS")
    && value.readOnly === true && isDigest(value.lockedTupleDigest)
    && (value.tupleStatus === "COMPLETE" || value.tupleStatus === "INCOMPLETE")
    && isDenseStandardArray(value.checks) && value.checks.length > 0 && value.checks.every(validHealthCheckShape)
    && validSafeMode(value.safeMode)
    && isTimestamp(value.generatedAtMs) && isDigest(value.reportDigest);
}

function validHealthContext(value: unknown): value is UpdateHealthVerificationContextV1 {
  return exactKeys(value, ["expectedTuple", "expectedProfile"])
    && validTuple(value.expectedTuple)
    && (value.expectedProfile === "HEALTH" || value.expectedProfile === "READINESS");
}

function hasUnsupportedHealthVersion(value: Record<string, unknown>): boolean {
  const safeMode = isPlainDataRecord(value.safeMode) ? value.safeMode : null;
  return (value.schemaVersion !== undefined && value.schemaVersion !== UPDATE_HEALTH_REPORT_SCHEMA_V1)
    || (safeMode?.schemaVersion !== undefined && safeMode.schemaVersion !== UPDATE_SAFE_MODE_SCHEMA_V1);
}

function denyHealth(reason: UpdateCheckPlanReasonCodeV1): UpdateHealthReportVerificationResultV1 {
  return immutable({ outcome: "DENIED" as const, reasonCodes: [reason], exitCode: UPDATE_CHECK_PLAN_EXIT_CODES_V1[reason] });
}

function healthSafeMode(reasonCodes: readonly UpdateSafeModeReasonV1[]): UpdateHealthReportVerificationResultV1 {
  return immutable({ outcome: "SAFE_MODE" as const, reasonCodes: [...reasonCodes], exitCode: UPDATE_SAFE_MODE_EXIT_CODE_V1 });
}

function tupleIsComplete(tuple: UpdateTupleV1): boolean {
  return UPDATE_AXIS_NAMES_V1.every((axis) => tuple[axis].length > 0);
}

function arraysEqual(left: readonly string[], right: readonly string[]): boolean {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

export function verifyUpdateHealthReportV1(
  value: unknown,
  context: UpdateHealthVerificationContextV1 | undefined,
): UpdateHealthReportVerificationResultV1 {
  let clonedValue: unknown;
  let clonedContext: unknown;
  try {
    clonedValue = safeJsonClone(value);
    clonedContext = context === undefined ? undefined : safeJsonClone(context);
  } catch {
    return denyHealth("SCHEMA_DENIED");
  }
  if (!exactKeys(clonedValue, ["schemaVersion", "reportId", "profile", "readOnly", "lockedTupleDigest",
    "tupleStatus", "checks", "safeMode", "generatedAtMs", "reportDigest"])) {
    if (isPlainDataRecord(clonedValue) && hasUnsupportedHealthVersion(clonedValue)) {
      return denyHealth("UNSUPPORTED_CONTRACT_VERSION_DENIED");
    }
    return denyHealth("SCHEMA_DENIED");
  }
  if (hasUnsupportedHealthVersion(clonedValue)) return denyHealth("UNSUPPORTED_CONTRACT_VERSION_DENIED");
  if (!validHealthReportShape(clonedValue)) return denyHealth("SCHEMA_DENIED");
  if (!validHealthContext(clonedContext)) return denyHealth("INDEPENDENT_CONTEXT_DENIED");

  const report = clonedValue;
  if (updateCheckPlanDigestV1(report as unknown as Record<string, unknown>, "reportDigest") !== report.reportDigest) {
    return denyHealth("DIGEST_MISMATCH_DENIED");
  }
  const expectedDigest = updateTupleDigestV1(clonedContext.expectedTuple);
  const expectedStatus = tupleIsComplete(clonedContext.expectedTuple) ? "COMPLETE" : "INCOMPLETE";
  if (report.lockedTupleDigest !== expectedDigest || report.tupleStatus !== expectedStatus) {
    return denyHealth("TUPLE_MISMATCH_DENIED");
  }
  if (report.profile !== clonedContext.expectedProfile) return denyHealth("HEALTH_CHECK_COVERAGE_DENIED");
  if (report.checks.some((check) => !healthStatusReasonMatches(check))) {
    return denyHealth("HEALTH_CHECK_CONTRADICTION_DENIED");
  }

  const expectedCheckIds = UPDATE_HEALTH_PROFILE_CHECK_IDS_V1[report.profile];
  const actualCheckIds = report.checks.map((check) => check.checkId);
  const coverageMatches = arraysEqual(actualCheckIds, expectedCheckIds);
  if (!coverageMatches) return denyHealth("HEALTH_CHECK_COVERAGE_DENIED");

  const issues: UpdateSafeModeReasonV1[] = [];
  if (expectedStatus === "INCOMPLETE") issues.push("LKG_INCOMPLETE");
  if (report.checks.some((check) => check.status === "FAIL")) issues.push("HEALTH_CHECK_FAILED");
  if (report.checks.some((check) => check.status === "NOT_OBSERVED")) issues.push("HEALTH_CHECK_UNOBSERVED");
  const orderedIssues = SAFE_MODE_REASON_ORDER_V1.filter((reason) => issues.includes(reason));
  const declared = [...report.safeMode.reasonCodes];
  const safeModeConsistent = report.safeMode.active === (orderedIssues.length > 0)
    && arraysEqual(declared, orderedIssues);
  if (!safeModeConsistent) return denyHealth("SAFE_MODE_INCONSISTENT_DENIED");
  if (orderedIssues.length > 0) return healthSafeMode(orderedIssues);
  return immutable({ outcome: "ACCEPTED" as const, reasonCodes: ["UPDATE_HEALTH_ACCEPTED"] as const, exitCode: 0 as const });
}

export function parseUpdateHealthReportV1(
  json: string,
  context: UpdateHealthVerificationContextV1 | undefined,
): UpdateHealthReportVerificationResultV1 {
  try {
    return verifyUpdateHealthReportV1(JSON.parse(json) as unknown, context);
  } catch {
    return denyHealth("INVALID_JSON_DENIED");
  }
}

// ---------------------------------------------------------------------------
// Deterministic fixture-only report construction
// ---------------------------------------------------------------------------

export interface RunFixtureHealthReportOptionsV1 {
  readonly reportId: string;
  readonly profile: UpdateHealthProfileV1;
  readonly lockedTuple: UpdateTupleV1;
  readonly checks: readonly UpdateHealthCheckV1[];
  readonly safeModeReasonCodes: readonly UpdateSafeModeReasonV1[];
  readonly generatedAtMs: number;
}

export function runFixtureHealthReportV1(options: RunFixtureHealthReportOptionsV1): UpdateHealthReportV1 {
  let cloned: RunFixtureHealthReportOptionsV1;
  try {
    cloned = safeJsonClone(options);
  } catch {
    throw new Error("INVALID_READ_ONLY_HEALTH_REPORT_FIXTURE");
  }
  if (!exactKeys(cloned, ["reportId", "profile", "lockedTuple", "checks", "safeModeReasonCodes", "generatedAtMs"])
    || !REPORT_ID.test(cloned.reportId)
    || (cloned.profile !== "HEALTH" && cloned.profile !== "READINESS")
    || !validTuple(cloned.lockedTuple)
    || !isDenseStandardArray(cloned.checks) || cloned.checks.length === 0
    || !cloned.checks.every(validHealthCheckShape)
    || !arraysEqual(cloned.checks.map((check) => check.checkId), UPDATE_HEALTH_PROFILE_CHECK_IDS_V1[cloned.profile])
    || !isDenseStandardArray(cloned.safeModeReasonCodes)
    || cloned.safeModeReasonCodes.length !== new Set(cloned.safeModeReasonCodes).size
    || !cloned.safeModeReasonCodes.every(isSafeModeReason)
    || !arraysEqual(
      cloned.safeModeReasonCodes,
      SAFE_MODE_REASON_ORDER_V1.filter((reason) => cloned.safeModeReasonCodes.includes(reason)),
    )
    || !isTimestamp(cloned.generatedAtMs)) {
    throw new Error("INVALID_READ_ONLY_HEALTH_REPORT_FIXTURE");
  }
  const report = safeObject([
    ["schemaVersion", UPDATE_HEALTH_REPORT_SCHEMA_V1],
    ["reportId", cloned.reportId],
    ["profile", cloned.profile],
    ["readOnly", true],
    ["lockedTupleDigest", updateTupleDigestV1(cloned.lockedTuple)],
    ["tupleStatus", tupleIsComplete(cloned.lockedTuple) ? "COMPLETE" : "INCOMPLETE"],
    ["checks", cloned.checks],
    ["safeMode", safeObject([
      ["schemaVersion", UPDATE_SAFE_MODE_SCHEMA_V1],
      ["active", cloned.safeModeReasonCodes.length > 0],
      ["readOnly", true],
      ["reasonCodes", cloned.safeModeReasonCodes],
    ])],
    ["generatedAtMs", cloned.generatedAtMs],
  ]);
  const complete = safeObject([
    ...Object.entries(report),
    ["reportDigest", updateCheckPlanDigestV1(report, "reportDigest")],
  ]);
  return deepFreeze(complete) as unknown as UpdateHealthReportV1;
}

// ---------------------------------------------------------------------------
// Fail-closed check/plan verification
// ---------------------------------------------------------------------------

function validComponent(value: unknown, axis: UpdateAxisNameV1): value is UpdateAxisComponentV1 {
  return exactKeys(value, ["componentId", "version", "digest"])
    && typeof value.componentId === "string" && COMPONENT_ID_PATTERNS[axis].test(value.componentId)
    && typeof value.version === "string" && EXACT_VERSION.test(value.version)
    && isDigest(value.digest);
}

function validTuple(value: unknown): value is UpdateTupleV1 {
  if (!exactKeys(value, UPDATE_AXIS_NAMES_V1)) return false;
  const tuple = value as unknown as UpdateTupleV1;
  return UPDATE_AXIS_NAMES_V1.every((axis) => {
    const components = tuple[axis];
    return isDenseStandardArray(components)
      && components.every((component) => validComponent(component, axis))
      && components.length === new Set(components.map((component) => component.componentId)).size;
  });
}

function validCompleteTuple(value: unknown): value is UpdateTupleV1 {
  return validTuple(value) && tupleIsComplete(value);
}

function validLkg(value: unknown): value is UpdateLkgV1 {
  return exactKeys(value, ["schemaVersion", "lkgId", "releaseId", "state", "revoked", "stale",
    "tuple", "authorityProfileDigest", "observedAtMs", "tupleDigest", "lkgDigest"])
    && value.schemaVersion === UPDATE_LKG_SCHEMA_V1
    && typeof value.lkgId === "string" && LKG_ID.test(value.lkgId)
    && typeof value.releaseId === "string" && EXACT_VERSION.test(value.releaseId)
    && (value.state === "COMPLETE" || value.state === "INCOMPLETE")
    && typeof value.revoked === "boolean" && typeof value.stale === "boolean"
    && validTuple(value.tuple) && isDigest(value.authorityProfileDigest)
    && isTimestamp(value.observedAtMs) && isDigest(value.tupleDigest) && isDigest(value.lkgDigest);
}

function validCandidate(value: unknown): value is UpdateCandidateV1 {
  return exactKeys(value, ["schemaVersion", "candidateId", "releaseId", "synthetic", "immutable", "source",
    "targetTuple", "targetTupleDigest", "authorityProfileDigest", "attestedBy", "promotedBy", "digest"])
    && value.schemaVersion === UPDATE_CANDIDATE_SCHEMA_V1
    && typeof value.candidateId === "string" && CANDIDATE_ID.test(value.candidateId)
    && typeof value.releaseId === "string" && EXACT_VERSION.test(value.releaseId)
    && typeof value.synthetic === "boolean" && typeof value.immutable === "boolean"
    && value.source === "SYNTHETIC_ISOLATED"
    && validCompleteTuple(value.targetTuple) && isDigest(value.targetTupleDigest)
    && isDigest(value.authorityProfileDigest)
    && typeof value.attestedBy === "string" && ATTESTOR_ID.test(value.attestedBy)
    && typeof value.promotedBy === "string" && PROMOTER_ID.test(value.promotedBy)
    && isDigest(value.digest);
}

function validCompatibility(value: unknown): value is UpdateCompatibilityDecisionV1 {
  return exactKeys(value, ["schemaVersion", "decisionId", "subjectCandidateDigest", "subjectLkgDigest",
    "verdict", "authorityDelta", "resolvedBy", "decisionDigest"])
    && value.schemaVersion === UPDATE_COMPATIBILITY_SCHEMA_V1
    && typeof value.decisionId === "string" && DECISION_ID.test(value.decisionId)
    && isDigest(value.subjectCandidateDigest) && isDigest(value.subjectLkgDigest)
    && (value.verdict === "COMPATIBLE" || value.verdict === "INCOMPATIBLE")
    && exactKeys(value.authorityDelta, ["added", "removed"])
    && isStringArray(value.authorityDelta.added) && isStringArray(value.authorityDelta.removed)
    && typeof value.resolvedBy === "string" && RESOLVER_ID.test(value.resolvedBy)
    && isDigest(value.decisionDigest);
}

function validPlan(value: unknown): value is UpdateCheckPlanV1 {
  return exactKeys(value, ["schemaVersion", "planId", "mode", "executionAuthorized", "candidate",
    "compatibility", "lkg", "safeMode", "selfAttestation", "selfPromotion", "authorityWidened",
    "issuedAtMs", "planDigest"])
    && value.schemaVersion === UPDATE_CHECK_PLAN_SCHEMA_V1
    && typeof value.planId === "string" && PLAN_ID.test(value.planId)
    && value.mode === "CHECK_ONLY" && typeof value.executionAuthorized === "boolean"
    && validCandidate(value.candidate) && validCompatibility(value.compatibility)
    && validLkg(value.lkg) && validSafeMode(value.safeMode)
    && typeof value.selfAttestation === "boolean" && typeof value.selfPromotion === "boolean"
    && typeof value.authorityWidened === "boolean"
    && isTimestamp(value.issuedAtMs) && isDigest(value.planDigest);
}

function validPlanContext(value: unknown): value is UpdatePlanVerificationContextV1 {
  if (!exactKeys(value, ["expectedUpdaterId", "expectedCandidate", "expectedCompatibility", "expectedTarget", "expectedLkg", "trustedAuthorities",
    "evaluationTimeMs", "maxLkgAgeMs", "revocationState"])) return false;
  if (typeof value.expectedUpdaterId !== "string" || !UPDATER_ID.test(value.expectedUpdaterId)) return false;
  if (!exactKeys(value.expectedCandidate, ["candidateId", "releaseId", "candidateDigest"])
    || typeof value.expectedCandidate.candidateId !== "string" || !CANDIDATE_ID.test(value.expectedCandidate.candidateId)
    || typeof value.expectedCandidate.releaseId !== "string" || !EXACT_VERSION.test(value.expectedCandidate.releaseId)
    || !isDigest(value.expectedCandidate.candidateDigest)) return false;
  if (!exactKeys(value.expectedCompatibility, ["decisionId", "decisionDigest"])
    || typeof value.expectedCompatibility.decisionId !== "string" || !DECISION_ID.test(value.expectedCompatibility.decisionId)
    || !isDigest(value.expectedCompatibility.decisionDigest)) return false;
  if (!exactKeys(value.expectedTarget, ["tuple", "authorityProfileDigest"])
    || !validCompleteTuple(value.expectedTarget.tuple) || !isDigest(value.expectedTarget.authorityProfileDigest)) return false;
  if (!exactKeys(value.expectedLkg, ["lkgId", "releaseId", "lkgDigest", "tuple", "authorityProfileDigest", "observedAtMs"])
    || typeof value.expectedLkg.lkgId !== "string" || !LKG_ID.test(value.expectedLkg.lkgId)
    || typeof value.expectedLkg.releaseId !== "string" || !EXACT_VERSION.test(value.expectedLkg.releaseId)
    || !isDigest(value.expectedLkg.lkgDigest) || !validTuple(value.expectedLkg.tuple)
    || !isDigest(value.expectedLkg.authorityProfileDigest) || !isTimestamp(value.expectedLkg.observedAtMs)) return false;
  if (!exactKeys(value.trustedAuthorities, ["attestedBy", "promotedBy", "resolvedBy"])
    || typeof value.trustedAuthorities.attestedBy !== "string" || !ATTESTOR_ID.test(value.trustedAuthorities.attestedBy)
    || typeof value.trustedAuthorities.promotedBy !== "string" || !PROMOTER_ID.test(value.trustedAuthorities.promotedBy)
    || typeof value.trustedAuthorities.resolvedBy !== "string" || !RESOLVER_ID.test(value.trustedAuthorities.resolvedBy)) return false;
  if (!isTimestamp(value.evaluationTimeMs) || !isTimestamp(value.maxLkgAgeMs)) return false;
  return exactKeys(value.revocationState, ["lkgId", "lkgDigest", "revoked", "evaluatedAtMs"])
    && typeof value.revocationState.lkgId === "string" && LKG_ID.test(value.revocationState.lkgId)
    && isDigest(value.revocationState.lkgDigest) && typeof value.revocationState.revoked === "boolean"
    && isTimestamp(value.revocationState.evaluatedAtMs);
}

function hasUnsupportedPlanVersion(value: Record<string, unknown>): boolean {
  const expected = [UPDATE_CHECK_PLAN_SCHEMA_V1, UPDATE_CANDIDATE_SCHEMA_V1,
    UPDATE_COMPATIBILITY_SCHEMA_V1, UPDATE_LKG_SCHEMA_V1, UPDATE_SAFE_MODE_SCHEMA_V1];
  const versions = [
    value.schemaVersion,
    isPlainDataRecord(value.candidate) ? value.candidate.schemaVersion : undefined,
    isPlainDataRecord(value.compatibility) ? value.compatibility.schemaVersion : undefined,
    isPlainDataRecord(value.lkg) ? value.lkg.schemaVersion : undefined,
    isPlainDataRecord(value.safeMode) ? value.safeMode.schemaVersion : undefined,
  ];
  return versions.some((version, index) => version !== undefined && version !== expected[index]);
}

function denyPlan(reason: UpdateCheckPlanReasonCodeV1): UpdateCheckPlanVerificationResultV1 {
  return immutable({ outcome: "DENIED" as const, reasonCodes: [reason], exitCode: UPDATE_CHECK_PLAN_EXIT_CODES_V1[reason] });
}

function planSafeMode(reasonCodes: readonly UpdateSafeModeReasonV1[]): UpdateCheckPlanVerificationResultV1 {
  return immutable({ outcome: "SAFE_MODE" as const, reasonCodes: [...reasonCodes], exitCode: UPDATE_SAFE_MODE_EXIT_CODE_V1 });
}

function actorAlias(identity: string): string {
  const separator = identity.indexOf(":");
  return identity.slice(separator + 1).toLowerCase().replace(/[._-]+/g, "-");
}

function authoritiesAreIndependent(context: UpdatePlanVerificationContextV1): boolean {
  const identities = [
    context.trustedAuthorities.attestedBy,
    context.trustedAuthorities.promotedBy,
    context.trustedAuthorities.resolvedBy,
  ];
  const aliases = identities.map(actorAlias);
  const subjectAliases = [
    actorAlias(context.expectedCandidate.candidateId),
    actorAlias(context.expectedUpdaterId),
  ];
  return new Set(aliases).size === aliases.length
    && new Set(subjectAliases).size === subjectAliases.length
    && aliases.every((alias) => !subjectAliases.includes(alias));
}

function sameTuple(left: UpdateTupleV1, right: UpdateTupleV1): boolean {
  return canonicalJson(safeJsonClone(left)) === canonicalJson(safeJsonClone(right));
}

/**
 * Snapshots an independently verified CHECK_ONLY plan as deeply immutable,
 * inspectable data. The plan digest binds its candidate and compatibility
 * decision, while independent context pins the exact tuple, content,
 * compatibility, and authority digests.
 *
 * This operation does not attest, promote, or authorize execution. A candidate
 * or its updater cannot occupy an attestation, compatibility, or promotion gate
 * role. Any mismatch, role collision, or malformed content fails before an
 * immutable inspection snapshot is emitted.
 */
export function freezeUpdateCheckPlanCandidateV1(
  plan: UpdateCheckPlanV1,
  context: UpdatePlanVerificationContextV1 | undefined,
): UpdateCheckPlanV1 {
  let snapshot: UpdateCheckPlanV1;
  try {
    snapshot = immutable(plan);
  } catch {
    throw new Error("UNSAFE_OR_INVALID_UPDATE_CANDIDATE");
  }
  if (verifyUpdateCheckPlanV1(snapshot, context).outcome === "DENIED") {
    throw new Error("UNSAFE_OR_INVALID_UPDATE_CANDIDATE");
  }
  return snapshot;
}

export function verifyUpdateCheckPlanV1(
  value: unknown,
  context: UpdatePlanVerificationContextV1 | undefined,
): UpdateCheckPlanVerificationResultV1 {
  let clonedValue: unknown;
  let clonedContext: unknown;
  try {
    clonedValue = safeJsonClone(value);
    clonedContext = context === undefined ? undefined : safeJsonClone(context);
  } catch {
    return denyPlan("SCHEMA_DENIED");
  }
  if (!exactKeys(clonedValue, ["schemaVersion", "planId", "mode", "executionAuthorized", "candidate",
    "compatibility", "lkg", "safeMode", "selfAttestation", "selfPromotion", "authorityWidened",
    "issuedAtMs", "planDigest"])) {
    if (isPlainDataRecord(clonedValue) && hasUnsupportedPlanVersion(clonedValue)) {
      return denyPlan("UNSUPPORTED_CONTRACT_VERSION_DENIED");
    }
    return denyPlan("SCHEMA_DENIED");
  }
  if (hasUnsupportedPlanVersion(clonedValue)) return denyPlan("UNSUPPORTED_CONTRACT_VERSION_DENIED");
  if (!validPlan(clonedValue)) return denyPlan("SCHEMA_DENIED");
  if (!validPlanContext(clonedContext)) return denyPlan("INDEPENDENT_CONTEXT_DENIED");

  const plan = clonedValue;
  const verificationContext = clonedContext;
  const { candidate, compatibility, lkg, safeMode } = plan;
  const reasons = new Set<UpdateCheckPlanReasonCodeV1>();

  if (updateCheckPlanDigestV1(plan as unknown as Record<string, unknown>, "planDigest") !== plan.planDigest
    || updateCheckPlanDigestV1(candidate as unknown as Record<string, unknown>, "digest") !== candidate.digest
    || updateCheckPlanDigestV1(compatibility as unknown as Record<string, unknown>, "decisionDigest") !== compatibility.decisionDigest
    || updateCheckPlanDigestV1(lkg as unknown as Record<string, unknown>, "lkgDigest") !== lkg.lkgDigest
    || candidate.digest !== verificationContext.expectedCandidate.candidateDigest
    || compatibility.decisionDigest !== verificationContext.expectedCompatibility.decisionDigest
    || lkg.lkgDigest !== verificationContext.expectedLkg.lkgDigest) {
    reasons.add("DIGEST_MISMATCH_DENIED");
  }
  const targetTupleDigest = updateTupleDigestV1(candidate.targetTuple);
  const expectedTargetDigest = updateTupleDigestV1(verificationContext.expectedTarget.tuple);
  const expectedLkgTupleDigest = updateTupleDigestV1(verificationContext.expectedLkg.tuple);
  if (candidate.targetTupleDigest !== targetTupleDigest
    || targetTupleDigest !== expectedTargetDigest
    || !sameTuple(candidate.targetTuple, verificationContext.expectedTarget.tuple)
    || lkg.tupleDigest !== updateTupleDigestV1(lkg.tuple)
    || lkg.tupleDigest !== expectedLkgTupleDigest
    || !sameTuple(lkg.tuple, verificationContext.expectedLkg.tuple)
    || lkg.state !== (tupleIsComplete(verificationContext.expectedLkg.tuple) ? "COMPLETE" : "INCOMPLETE")) {
    reasons.add("TUPLE_MISMATCH_DENIED");
  }
  if (candidate.candidateId !== verificationContext.expectedCandidate.candidateId
    || candidate.releaseId !== verificationContext.expectedCandidate.releaseId
    || compatibility.decisionId !== verificationContext.expectedCompatibility.decisionId
    || lkg.lkgId !== verificationContext.expectedLkg.lkgId
    || lkg.releaseId !== verificationContext.expectedLkg.releaseId
    || lkg.observedAtMs !== verificationContext.expectedLkg.observedAtMs) {
    reasons.add("INDEPENDENT_CONTEXT_DENIED");
  }
  const authoritiesBound = candidate.authorityProfileDigest === verificationContext.expectedTarget.authorityProfileDigest
    && lkg.authorityProfileDigest === verificationContext.expectedLkg.authorityProfileDigest
    && candidate.authorityProfileDigest === lkg.authorityProfileDigest
    && candidate.attestedBy === verificationContext.trustedAuthorities.attestedBy
    && candidate.promotedBy === verificationContext.trustedAuthorities.promotedBy
    && compatibility.resolvedBy === verificationContext.trustedAuthorities.resolvedBy
    && authoritiesAreIndependent(verificationContext);
  if (!authoritiesBound) reasons.add("AUTHORITY_BINDING_DENIED");

  const independentlyStale = verificationContext.evaluationTimeMs < lkg.observedAtMs
    || verificationContext.evaluationTimeMs - lkg.observedAtMs > verificationContext.maxLkgAgeMs;
  if (plan.issuedAtMs < lkg.observedAtMs
    || plan.issuedAtMs > verificationContext.evaluationTimeMs
    || lkg.stale !== independentlyStale
    || independentlyStale) reasons.add("LKG_FRESHNESS_DENIED");
  const revocationBound = verificationContext.revocationState.lkgId === lkg.lkgId
    && verificationContext.revocationState.lkgDigest === lkg.lkgDigest
    && verificationContext.revocationState.evaluatedAtMs === verificationContext.evaluationTimeMs
    && lkg.revoked === verificationContext.revocationState.revoked;
  if (!revocationBound || verificationContext.revocationState.revoked) reasons.add("LKG_REVOCATION_DENIED");

  if (compatibility.subjectLkgDigest !== lkg.lkgDigest
    || compatibility.subjectCandidateDigest !== candidate.digest
    || compatibility.verdict !== "COMPATIBLE"
    || actorAlias(compatibility.resolvedBy) === actorAlias(candidate.candidateId)) {
    reasons.add("COMPATIBILITY_DENIED");
  }
  if (actorAlias(candidate.attestedBy) === actorAlias(candidate.candidateId)
    || actorAlias(candidate.attestedBy) === actorAlias(verificationContext.expectedUpdaterId)
    || plan.selfAttestation !== false) reasons.add("SELF_ATTESTATION_DENIED");
  if (actorAlias(candidate.promotedBy) === actorAlias(candidate.candidateId)
    || actorAlias(candidate.promotedBy) === actorAlias(verificationContext.expectedUpdaterId)
    || plan.selfPromotion !== false) reasons.add("SELF_PROMOTION_DENIED");
  if (compatibility.authorityDelta.added.length > 0 || compatibility.authorityDelta.removed.length > 0
    || plan.authorityWidened !== false) reasons.add("AUTHORITY_WIDENING_DENIED");
  if (plan.executionAuthorized !== false || candidate.synthetic !== true || candidate.immutable !== true
    || safeMode.readOnly !== true) reasons.add("MUTATION_CLAIM_DENIED");

  if (reasons.size > 0) {
    const reasonCodes = PLAN_DENIAL_ORDER.filter((reason) => reasons.has(reason));
    return immutable({
      outcome: "DENIED" as const,
      reasonCodes,
      exitCode: UPDATE_CHECK_PLAN_EXIT_CODES_V1[reasonCodes[0]!],
    });
  }

  const issues: UpdateSafeModeReasonV1[] = tupleIsComplete(verificationContext.expectedLkg.tuple)
    ? []
    : ["LKG_INCOMPLETE"];
  const consistent = safeMode.active === (issues.length > 0)
    && arraysEqual([...safeMode.reasonCodes], issues);
  if (!consistent) return denyPlan("SAFE_MODE_INCONSISTENT_DENIED");
  if (issues.length > 0) return planSafeMode(issues);
  return immutable({ outcome: "ACCEPTED" as const, reasonCodes: ["UPDATE_CHECK_ACCEPTED"] as const, exitCode: 0 as const });
}

export function parseUpdateCheckPlanV1(
  json: string,
  context: UpdatePlanVerificationContextV1 | undefined,
): UpdateCheckPlanVerificationResultV1 {
  try {
    return verifyUpdateCheckPlanV1(JSON.parse(json) as unknown, context);
  } catch {
    return denyPlan("INVALID_JSON_DENIED");
  }
}

/** Canonicalizes safe JSON bytes only. The output is explicitly untrusted. */
export function renderUntrustedUpdateCheckPlanV1(plan: UpdateCheckPlanV1): string {
  return canonicalJson(safeJsonClone(plan));
}

/** Emits canonical bytes only after independent-context verification succeeds. */
export function renderVerifiedUpdateCheckPlanV1(
  plan: UpdateCheckPlanV1,
  context: UpdatePlanVerificationContextV1 | undefined,
): string {
  let snapshot: UpdateCheckPlanV1;
  try {
    snapshot = immutable(plan);
  } catch {
    throw new Error("UNSAFE_OR_INVALID_UPDATE_PLAN");
  }
  if (verifyUpdateCheckPlanV1(snapshot, context).outcome === "DENIED") {
    throw new Error("UNSAFE_OR_INVALID_UPDATE_PLAN");
  }
  return canonicalJson(snapshot);
}
