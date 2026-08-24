import { canonicalJson } from "./canonical-json.js";
import {
  UPDATE_LKG_SCHEMA_V1,
  updateCheckPlanDigestV1,
  updateTupleDigestV1,
  type UpdateLkgV1,
  type UpdateTupleV1,
} from "./update-check-plan.js";

/**
 * UD-M1 successor micro-slice (issue #53) — registry-outage continuity
 * decision projection.
 *
 * This module contains a pure, deterministic, fail-closed projection that maps
 * a closed canonical continuity-decision input (an Accepted local tuple
 * snapshot, an exact LKG snapshot, a fixed AVAILABLE|UNAVAILABLE registry
 * observation, an independent observer identity/version envelope, and an
 * evaluation time — together with their recomputed digests) to exactly one of
 * three continuity decisions:
 *
 *   - PRESERVE_ACCEPTED     when the local Accepted snapshot is independently
 *                           valid and unrevoked;
 *   - ROLLBACK_REQUIRED     with the exact valid LKG digest when Accepted is
 *                           unusable but an independently valid unrevoked LKG
 *                           exists;
 *   - ENTER_SAFE_READ_ONLY  when neither Accepted nor LKG is usable.
 *
 * The projection grants and performs no mutation, rollback, package, pointer,
 * service, registry, or network behavior. It only reads its (independently
 * verified) input and emits a fixed, claim-free public projection.
 */

export const UPDATE_CONTINUITY_DECISION_SCHEMA_V1 = "chimpmaera.update/continuity-decision/v1" as const;
export const UPDATE_ACCEPTED_SNAPSHOT_SCHEMA_V1 = "chimpmaera.update/accepted-snapshot/v1" as const;
export const UPDATE_CONTINUITY_OBSERVATION_SCHEMA_V1 = "chimpmaera.update/continuity-observation/v1" as const;
export const UPDATE_CONTINUITY_OBSERVER_SCHEMA_V1 = "chimpmaera.update/continuity-observer/v1" as const;
export const UPDATE_CONTINUITY_DECISION_PROJECTION_SCHEMA_V1 = "chimpmaera.update/continuity-decision-projection/v1" as const;

/** Canonical all-zero digest used to mark a non-applicable bound digest. */
export const CONTINUITY_NONE_DIGEST_V1 = "0".repeat(64);

export const UPDATE_CONTINUITY_DECISIONS_V1 = [
  "PRESERVE_ACCEPTED",
  "ROLLBACK_REQUIRED",
  "ENTER_SAFE_READ_ONLY",
] as const;
export type UpdateContinuityDecisionV1 = (typeof UPDATE_CONTINUITY_DECISIONS_V1)[number];

export const UPDATE_CONTINUITY_OBSERVATION_AVAILABILITIES_V1 = ["AVAILABLE", "UNAVAILABLE"] as const;
export type UpdateContinuityObservationAvailabilityV1 = (typeof UPDATE_CONTINUITY_OBSERVATION_AVAILABILITIES_V1)[number];

export const UPDATE_CONTINUITY_OBSERVATION_STATUSES_V1 = ["REACHABLE", "UNREACHABLE"] as const;
export type UpdateContinuityObservationStatusV1 = (typeof UPDATE_CONTINUITY_OBSERVATION_STATUSES_V1)[number];

export type UpdateContinuityDecisionReasonCodeV1 =
  | "CONTINUITY_ACCEPTED"
  | "CONTINUITY_ROLLBACK_REQUIRED"
  | "CONTINUITY_SAFE_READ_ONLY"
  | "INVALID_JSON_DENIED"
  | "SCHEMA_DENIED"
  | "UNSUPPORTED_CONTRACT_VERSION_DENIED"
  | "INDEPENDENT_CONTEXT_DENIED"
  | "DIGEST_MISMATCH_DENIED"
  | "TUPLE_MISMATCH_DENIED"
  | "AUTHORITY_BINDING_DENIED"
  | "OBSERVATION_REPLAY_DENIED"
  | "OBSERVATION_STALE_DENIED"
  | "AVAILABILITY_CONTRADICTION_DENIED"
  | "OBSERVER_SUBSTITUTION_DENIED"
  | "OBSERVER_INDEPENDENCE_DENIED"
  | "REVOCATION_BINDING_DENIED";

export const UPDATE_CONTINUITY_DECISION_EXIT_CODES_V1: Readonly<Record<UpdateContinuityDecisionReasonCodeV1, number>> = Object.freeze({
  CONTINUITY_ACCEPTED: 0,
  CONTINUITY_ROLLBACK_REQUIRED: 91,
  CONTINUITY_SAFE_READ_ONLY: 92,
  INVALID_JSON_DENIED: 70,
  SCHEMA_DENIED: 71,
  UNSUPPORTED_CONTRACT_VERSION_DENIED: 72,
  INDEPENDENT_CONTEXT_DENIED: 73,
  DIGEST_MISMATCH_DENIED: 74,
  TUPLE_MISMATCH_DENIED: 75,
  AUTHORITY_BINDING_DENIED: 76,
  OBSERVATION_REPLAY_DENIED: 77,
  OBSERVATION_STALE_DENIED: 78,
  AVAILABILITY_CONTRADICTION_DENIED: 79,
  OBSERVER_SUBSTITUTION_DENIED: 80,
  OBSERVER_INDEPENDENCE_DENIED: 81,
  REVOCATION_BINDING_DENIED: 82,
});

const DENIAL_ORDER: readonly UpdateContinuityDecisionReasonCodeV1[] = Object.freeze([
  "INVALID_JSON_DENIED",
  "SCHEMA_DENIED",
  "UNSUPPORTED_CONTRACT_VERSION_DENIED",
  "INDEPENDENT_CONTEXT_DENIED",
  "DIGEST_MISMATCH_DENIED",
  "TUPLE_MISMATCH_DENIED",
  "AUTHORITY_BINDING_DENIED",
  "OBSERVATION_REPLAY_DENIED",
  "OBSERVATION_STALE_DENIED",
  "AVAILABILITY_CONTRADICTION_DENIED",
  "OBSERVER_SUBSTITUTION_DENIED",
  "OBSERVER_INDEPENDENCE_DENIED",
  "REVOCATION_BINDING_DENIED",
]);

export interface UpdateAcceptedSnapshotV1 {
  readonly schemaVersion: typeof UPDATE_ACCEPTED_SNAPSHOT_SCHEMA_V1;
  readonly snapshotId: string;
  readonly releaseId: string;
  readonly tuple: UpdateTupleV1;
  readonly tupleDigest: string;
  readonly authorityProfileDigest: string;
  readonly revoked: boolean;
  readonly observedAtMs: number;
  readonly snapshotDigest: string;
}

export interface UpdateContinuityObservationV1 {
  readonly schemaVersion: typeof UPDATE_CONTINUITY_OBSERVATION_SCHEMA_V1;
  readonly registryId: string;
  readonly availability: UpdateContinuityObservationAvailabilityV1;
  readonly status: UpdateContinuityObservationStatusV1;
  readonly observedAtMs: number;
  readonly observationDigest: string;
}

export interface UpdateContinuityObserverV1 {
  readonly schemaVersion: typeof UPDATE_CONTINUITY_OBSERVER_SCHEMA_V1;
  readonly observerId: string;
  readonly observerVersion: string;
  readonly observerDigest: string;
}

export interface UpdateContinuityDecisionInputV1 {
  readonly schemaVersion: typeof UPDATE_CONTINUITY_DECISION_SCHEMA_V1;
  readonly accepted: UpdateAcceptedSnapshotV1;
  readonly lkg: UpdateLkgV1 | null;
  readonly observation: UpdateContinuityObservationV1;
  readonly observer: UpdateContinuityObserverV1;
  readonly evaluationTimeMs: number;
  readonly inputDigest: string;
}

export interface UpdateContinuityExpectedLkgV1 {
  readonly lkgId: string;
  readonly releaseId: string;
  readonly lkgDigest: string;
  readonly tuple: UpdateTupleV1;
  readonly authorityProfileDigest: string;
  readonly observedAtMs: number;
  readonly revoked: boolean;
  readonly evaluatedAtMs: number;
}

export interface UpdateContinuityVerificationContextV1 {
  readonly expectedAccepted: {
    readonly snapshotId: string;
    readonly releaseId: string;
    readonly snapshotDigest: string;
    readonly tuple: UpdateTupleV1;
    readonly authorityProfileDigest: string;
    readonly observedAtMs: number;
    readonly revoked: boolean;
    readonly evaluatedAtMs: number;
  };
  readonly expectedLkg: UpdateContinuityExpectedLkgV1 | null;
  readonly expectedObservation: {
    readonly registryId: string;
    readonly availability: UpdateContinuityObservationAvailabilityV1;
    readonly observedAtMs: number;
  };
  readonly trustedObserver: {
    readonly observerId: string;
    readonly observerVersion: string;
  };
  readonly evaluationTimeMs: number;
  readonly maxObservationAgeMs: number;
  readonly maxSnapshotAgeMs: number;
}

export type UpdateContinuityDecisionResultV1 =
  | { readonly outcome: "PRESERVE_ACCEPTED"; readonly reasonCodes: readonly ["CONTINUITY_ACCEPTED"]; readonly exitCode: 0; readonly preservedTupleDigest: string; readonly preservedSnapshotDigest: string }
  | { readonly outcome: "ROLLBACK_REQUIRED"; readonly reasonCodes: readonly ["CONTINUITY_ROLLBACK_REQUIRED"]; readonly exitCode: 91; readonly rollbackLkgDigest: string }
  | { readonly outcome: "ENTER_SAFE_READ_ONLY"; readonly reasonCodes: readonly ["CONTINUITY_SAFE_READ_ONLY"]; readonly exitCode: 92; readonly readOnly: true }
  | { readonly outcome: "DENIED"; readonly reasonCodes: readonly UpdateContinuityDecisionReasonCodeV1[]; readonly exitCode: number };

export interface UpdateContinuityDecisionProjectionV1 {
  readonly schemaVersion: typeof UPDATE_CONTINUITY_DECISION_PROJECTION_SCHEMA_V1;
  readonly decision: UpdateContinuityDecisionV1;
  readonly readOnly: true;
  readonly registryAvailability: UpdateContinuityObservationAvailabilityV1;
  readonly evaluationTimeMs: number;
  readonly preservedTupleDigest: string;
  readonly preservedSnapshotDigest: string;
  readonly rollbackLkgDigest: string;
  readonly projectionDigest: string;
}

// Canonical SemVer 2.0.0 version grammar (official regular expression from
// https://semver.org): no leading zeros in core or numeric pre-release
// numbers, non-empty dot-separated pre-release and build identifiers, no
// mutable dist-tag/range aliases.
const EXACT_VERSION = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-((?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*)(?:\.(?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*))*))?(?:\+([0-9a-zA-Z-]+(?:\.[0-9a-zA-Z-]+)*))?$/;
const DIGEST = /^[a-f0-9]{64}$/;
const ACCEPTED_ID = /^accepted:[a-z0-9][a-z0-9._-]{2,95}$/;
const REGISTRY_ID = /^registry:[a-z0-9][a-z0-9._-]{2,95}$/;
const OBSERVER_ID = /^observer:[a-z0-9][a-z0-9._-]{2,95}$/;
const LKG_ID = /^(?:lkg|maintenance):[a-z0-9][a-z0-9._-]{2,95}$/;
const DANGEROUS_KEYS = new Set(["__proto__", "prototype", "constructor"]);

const INPUT_KEYS = Object.freeze([
  "schemaVersion", "accepted", "lkg", "observation", "observer", "evaluationTimeMs", "inputDigest",
]);
const ACCEPTED_KEYS = Object.freeze([
  "schemaVersion", "snapshotId", "releaseId", "tuple", "tupleDigest", "authorityProfileDigest",
  "revoked", "observedAtMs", "snapshotDigest",
]);
const LKG_KEYS = Object.freeze([
  "schemaVersion", "lkgId", "releaseId", "state", "revoked", "stale", "tuple",
  "authorityProfileDigest", "observedAtMs", "tupleDigest", "lkgDigest",
]);
const OBSERVATION_KEYS = Object.freeze([
  "schemaVersion", "registryId", "availability", "status", "observedAtMs", "observationDigest",
]);
const OBSERVER_KEYS = Object.freeze(["schemaVersion", "observerId", "observerVersion", "observerDigest"]);
const EXPECTED_ACCEPTED_KEYS = Object.freeze([
  "snapshotId", "releaseId", "snapshotDigest", "tuple", "authorityProfileDigest",
  "observedAtMs", "revoked", "evaluatedAtMs",
]);
const EXPECTED_LKG_KEYS = Object.freeze([
  "lkgId", "releaseId", "lkgDigest", "tuple", "authorityProfileDigest", "observedAtMs", "revoked", "evaluatedAtMs",
]);

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
    if (Object.is(value, -0) || !Number.isFinite(value) || (Number.isInteger(value) && !Number.isSafeInteger(value))) {
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
  return Number.isSafeInteger(value) && !Object.is(value, -0) && (value as number) >= 0;
}

function tupleIsDigestible(tuple: unknown): boolean {
  try {
    updateTupleDigestV1(tuple as UpdateTupleV1);
    return true;
  } catch {
    return false;
  }
}

function actorAlias(identity: string): string {
  const separator = identity.indexOf(":");
  return identity.slice(separator + 1).toLowerCase().replace(/[._-]+/g, "-");
}

function sameTuple(left: UpdateTupleV1, right: UpdateTupleV1): boolean {
  return canonicalJson(safeJsonClone(left)) === canonicalJson(safeJsonClone(right));
}

function hasUnsupportedVersion(value: Record<string, unknown>): boolean {
  const sub = (key: string): Record<string, unknown> | null =>
    (isPlainDataRecord(value[key]) ? (value[key] as Record<string, unknown>) : null);
  const accepted = sub("accepted");
  const lkg = value.lkg === null ? null : sub("lkg");
  const observation = sub("observation");
  const observer = sub("observer");
  return (value.schemaVersion !== undefined && value.schemaVersion !== UPDATE_CONTINUITY_DECISION_SCHEMA_V1)
    || (accepted !== null && accepted.schemaVersion !== undefined && accepted.schemaVersion !== UPDATE_ACCEPTED_SNAPSHOT_SCHEMA_V1)
    || (lkg !== null && lkg.schemaVersion !== undefined && lkg.schemaVersion !== UPDATE_LKG_SCHEMA_V1)
    || (observation !== null && observation.schemaVersion !== undefined && observation.schemaVersion !== UPDATE_CONTINUITY_OBSERVATION_SCHEMA_V1)
    || (observer !== null && observer.schemaVersion !== undefined && observer.schemaVersion !== UPDATE_CONTINUITY_OBSERVER_SCHEMA_V1);
}

function validAccepted(value: unknown): value is UpdateAcceptedSnapshotV1 {
  if (!exactKeys(value, ACCEPTED_KEYS)) return false;
  const snapshot = value as unknown as UpdateAcceptedSnapshotV1;
  return typeof snapshot.snapshotId === "string" && ACCEPTED_ID.test(snapshot.snapshotId)
    && typeof snapshot.releaseId === "string" && EXACT_VERSION.test(snapshot.releaseId)
    && tupleIsDigestible(snapshot.tuple)
    && isDigest(snapshot.tupleDigest) && isDigest(snapshot.authorityProfileDigest) && isDigest(snapshot.snapshotDigest)
    && typeof snapshot.revoked === "boolean"
    && isTimestamp(snapshot.observedAtMs);
}

function validLkg(value: unknown): value is UpdateLkgV1 {
  if (!exactKeys(value, LKG_KEYS)) return false;
  const lkg = value as unknown as UpdateLkgV1;
  return typeof lkg.lkgId === "string" && LKG_ID.test(lkg.lkgId)
    && typeof lkg.releaseId === "string" && EXACT_VERSION.test(lkg.releaseId)
    && (lkg.state === "COMPLETE" || lkg.state === "INCOMPLETE")
    && typeof lkg.revoked === "boolean" && typeof lkg.stale === "boolean"
    && tupleIsDigestible(lkg.tuple)
    && isDigest(lkg.authorityProfileDigest) && isDigest(lkg.tupleDigest) && isDigest(lkg.lkgDigest)
    && isTimestamp(lkg.observedAtMs);
}

function validObservation(value: unknown): value is UpdateContinuityObservationV1 {
  if (!exactKeys(value, OBSERVATION_KEYS)) return false;
  const observation = value as unknown as UpdateContinuityObservationV1;
  return typeof observation.registryId === "string" && REGISTRY_ID.test(observation.registryId)
    && (observation.availability === "AVAILABLE" || observation.availability === "UNAVAILABLE")
    && (observation.status === "REACHABLE" || observation.status === "UNREACHABLE")
    && isTimestamp(observation.observedAtMs)
    && isDigest(observation.observationDigest);
}

function validObserver(value: unknown): value is UpdateContinuityObserverV1 {
  if (!exactKeys(value, OBSERVER_KEYS)) return false;
  const observer = value as unknown as UpdateContinuityObserverV1;
  return typeof observer.observerId === "string" && OBSERVER_ID.test(observer.observerId)
    && typeof observer.observerVersion === "string" && EXACT_VERSION.test(observer.observerVersion)
    && isDigest(observer.observerDigest);
}

function validExpectedAccepted(value: unknown): boolean {
  if (!exactKeys(value, EXPECTED_ACCEPTED_KEYS)) return false;
  const expected = value as Record<string, unknown>;
  const tuple = expected.tuple as UpdateTupleV1;
  return typeof expected.snapshotId === "string" && ACCEPTED_ID.test(expected.snapshotId)
    && typeof expected.releaseId === "string" && EXACT_VERSION.test(expected.releaseId)
    && isDigest(expected.snapshotDigest) && isDigest(expected.authorityProfileDigest)
    && tupleIsDigestible(tuple)
    && isTimestamp(expected.observedAtMs) && isTimestamp(expected.evaluatedAtMs)
    && typeof expected.revoked === "boolean";
}

function validExpectedLkg(value: unknown): boolean {
  if (value === null) return true;
  if (!exactKeys(value, EXPECTED_LKG_KEYS)) return false;
  const expected = value as Record<string, unknown>;
  const tuple = expected.tuple as UpdateTupleV1;
  return typeof expected.lkgId === "string" && LKG_ID.test(expected.lkgId)
    && typeof expected.releaseId === "string" && EXACT_VERSION.test(expected.releaseId)
    && isDigest(expected.lkgDigest) && isDigest(expected.authorityProfileDigest)
    && tupleIsDigestible(tuple)
    && isTimestamp(expected.observedAtMs) && isTimestamp(expected.evaluatedAtMs)
    && typeof expected.revoked === "boolean";
}

function validContext(value: unknown): value is UpdateContinuityVerificationContextV1 {
  if (!exactKeys(value, ["expectedAccepted", "expectedLkg", "expectedObservation", "trustedObserver",
    "evaluationTimeMs", "maxObservationAgeMs", "maxSnapshotAgeMs"])) return false;
  const context = value as unknown as UpdateContinuityVerificationContextV1;
  const expectedObservation = context.expectedObservation;
  const trustedObserver = context.trustedObserver;
  return validExpectedAccepted(context.expectedAccepted)
    && validExpectedLkg(context.expectedLkg)
    && exactKeys(expectedObservation, ["registryId", "availability", "observedAtMs"])
    && typeof expectedObservation.registryId === "string" && REGISTRY_ID.test(expectedObservation.registryId)
    && (expectedObservation.availability === "AVAILABLE" || expectedObservation.availability === "UNAVAILABLE")
    && isTimestamp(expectedObservation.observedAtMs)
    && exactKeys(trustedObserver, ["observerId", "observerVersion"])
    && typeof trustedObserver.observerId === "string" && OBSERVER_ID.test(trustedObserver.observerId)
    && typeof trustedObserver.observerVersion === "string" && EXACT_VERSION.test(trustedObserver.observerVersion)
    && isTimestamp(context.evaluationTimeMs)
    && isTimestamp(context.maxObservationAgeMs)
    && isTimestamp(context.maxSnapshotAgeMs);
}

type EvaluatedContinuityDecisionV1 =
  | { readonly status: "DENIED"; readonly reasonCodes: readonly UpdateContinuityDecisionReasonCodeV1[]; readonly exitCode: number }
  | {
      readonly status: "DECIDED";
      readonly decision: UpdateContinuityDecisionV1;
      readonly registryAvailability: UpdateContinuityObservationAvailabilityV1;
      readonly evaluationTimeMs: number;
      readonly preservedTupleDigest: string;
      readonly preservedSnapshotDigest: string;
      readonly rollbackLkgDigest: string;
    };

type DecidedContinuityDecisionV1 = Extract<EvaluatedContinuityDecisionV1, { status: "DECIDED" }>;

function denied(reasons: ReadonlySet<UpdateContinuityDecisionReasonCodeV1> | readonly UpdateContinuityDecisionReasonCodeV1[]): EvaluatedContinuityDecisionV1 {
  const normalized = Array.isArray(reasons) ? reasons : [...reasons];
  const reasonCodes = DENIAL_ORDER.filter((reason) => normalized.includes(reason));
  const first = reasonCodes[0] ?? "SCHEMA_DENIED";
  return { status: "DENIED", reasonCodes, exitCode: UPDATE_CONTINUITY_DECISION_EXIT_CODES_V1[first] };
}

function checkFreshness(observedAtMs: number, evaluationTimeMs: number, maxAgeMs: number, reasons: Set<UpdateContinuityDecisionReasonCodeV1>): void {
  if (observedAtMs > evaluationTimeMs) {
    reasons.add("OBSERVATION_REPLAY_DENIED");
    return;
  }
  if (evaluationTimeMs - observedAtMs > maxAgeMs) reasons.add("OBSERVATION_STALE_DENIED");
}

function evaluateUpdateContinuityDecisionV1(
  value: unknown,
  context: UpdateContinuityVerificationContextV1 | undefined,
): EvaluatedContinuityDecisionV1 {
  let clonedValue: unknown;
  let clonedContext: unknown;
  try {
    clonedValue = safeJsonClone(value);
    clonedContext = context === undefined ? undefined : safeJsonClone(context);
  } catch {
    return denied(["SCHEMA_DENIED"]);
  }
  if (!exactKeys(clonedValue, INPUT_KEYS)) {
    if (isPlainDataRecord(clonedValue) && hasUnsupportedVersion(clonedValue)) {
      return denied(["UNSUPPORTED_CONTRACT_VERSION_DENIED"]);
    }
    return denied(["SCHEMA_DENIED"]);
  }
  if (hasUnsupportedVersion(clonedValue)) return denied(["UNSUPPORTED_CONTRACT_VERSION_DENIED"]);
  const input = clonedValue as unknown as UpdateContinuityDecisionInputV1;
  if (!validAccepted(input.accepted)
    || (input.lkg !== null && !validLkg(input.lkg))
    || !validObservation(input.observation)
    || !validObserver(input.observer)
    || !isTimestamp(input.evaluationTimeMs)
    || !isDigest(input.inputDigest)) {
    return denied(["SCHEMA_DENIED"]);
  }
  if (!validContext(clonedContext)) return denied(["INDEPENDENT_CONTEXT_DENIED"]);
  const ctx = clonedContext as unknown as UpdateContinuityVerificationContextV1;

  const reasons = new Set<UpdateContinuityDecisionReasonCodeV1>();
  if (ctx.evaluationTimeMs !== input.evaluationTimeMs) reasons.add("INDEPENDENT_CONTEXT_DENIED");

  // Top-level closed-input digest must recompute exactly.
  if (updateCheckPlanDigestV1(input as unknown as Record<string, unknown>, "inputDigest") !== input.inputDigest) {
    reasons.add("DIGEST_MISMATCH_DENIED");
  }

  // Accepted snapshot: tuple digest, envelope digest, independent bindings.
  let acceptedTupleDigest: string | undefined;
  try {
    acceptedTupleDigest = updateTupleDigestV1(input.accepted.tuple);
  } catch {
    reasons.add("SCHEMA_DENIED");
  }
  if (acceptedTupleDigest !== undefined && input.accepted.tupleDigest !== acceptedTupleDigest) {
    reasons.add("TUPLE_MISMATCH_DENIED");
  }
  if (updateCheckPlanDigestV1(input.accepted as unknown as Record<string, unknown>, "snapshotDigest") !== input.accepted.snapshotDigest) {
    reasons.add("DIGEST_MISMATCH_DENIED");
  }
  if (input.accepted.snapshotDigest !== ctx.expectedAccepted.snapshotDigest) reasons.add("DIGEST_MISMATCH_DENIED");
  if (!sameTuple(input.accepted.tuple, ctx.expectedAccepted.tuple)) reasons.add("TUPLE_MISMATCH_DENIED");
  if (input.accepted.authorityProfileDigest !== ctx.expectedAccepted.authorityProfileDigest) {
    reasons.add("AUTHORITY_BINDING_DENIED");
  }
  if (input.accepted.snapshotId !== ctx.expectedAccepted.snapshotId
    || input.accepted.releaseId !== ctx.expectedAccepted.releaseId
    || input.accepted.observedAtMs !== ctx.expectedAccepted.observedAtMs) {
    reasons.add("INDEPENDENT_CONTEXT_DENIED");
  }
  if (input.accepted.revoked !== ctx.expectedAccepted.revoked
    || ctx.expectedAccepted.evaluatedAtMs !== input.evaluationTimeMs) {
    reasons.add("REVOCATION_BINDING_DENIED");
  }
  checkFreshness(input.accepted.observedAtMs, input.evaluationTimeMs, ctx.maxSnapshotAgeMs, reasons);

  // LKG snapshot: must be present exactly when the independent context binds one.
  const lkgPresent = input.lkg !== null;
  const expectedLkgPresent = ctx.expectedLkg !== null;
  if (lkgPresent !== expectedLkgPresent) {
    reasons.add("INDEPENDENT_CONTEXT_DENIED");
  } else if (lkgPresent && expectedLkgPresent && input.lkg !== null && ctx.expectedLkg !== null) {
    const lkg = input.lkg;
    const expectedLkg = ctx.expectedLkg;
    let lkgTupleDigest: string | undefined;
    try {
      lkgTupleDigest = updateTupleDigestV1(lkg.tuple);
    } catch {
      reasons.add("SCHEMA_DENIED");
    }
    if (lkgTupleDigest !== undefined && lkg.tupleDigest !== lkgTupleDigest) reasons.add("TUPLE_MISMATCH_DENIED");
    if (updateCheckPlanDigestV1(lkg as unknown as Record<string, unknown>, "lkgDigest") !== lkg.lkgDigest) {
      reasons.add("DIGEST_MISMATCH_DENIED");
    }
    if (lkg.lkgDigest !== expectedLkg.lkgDigest) reasons.add("DIGEST_MISMATCH_DENIED");
    if (!sameTuple(lkg.tuple, expectedLkg.tuple)) reasons.add("TUPLE_MISMATCH_DENIED");
    if (lkg.authorityProfileDigest !== expectedLkg.authorityProfileDigest
      || lkg.authorityProfileDigest !== input.accepted.authorityProfileDigest) {
      reasons.add("AUTHORITY_BINDING_DENIED");
    }
    if (lkg.lkgId !== expectedLkg.lkgId
      || lkg.releaseId !== expectedLkg.releaseId
      || lkg.observedAtMs !== expectedLkg.observedAtMs) {
      reasons.add("INDEPENDENT_CONTEXT_DENIED");
    }
    if (lkg.revoked !== expectedLkg.revoked || expectedLkg.evaluatedAtMs !== input.evaluationTimeMs) {
      reasons.add("REVOCATION_BINDING_DENIED");
    }
    checkFreshness(lkg.observedAtMs, input.evaluationTimeMs, ctx.maxSnapshotAgeMs, reasons);
  }

  // Registry observation: digest, identity binding, freshness, availability.
  if (updateCheckPlanDigestV1(input.observation as unknown as Record<string, unknown>, "observationDigest")
    !== input.observation.observationDigest) {
    reasons.add("DIGEST_MISMATCH_DENIED");
  }
  if (input.observation.registryId !== ctx.expectedObservation.registryId
    || input.observation.observedAtMs !== ctx.expectedObservation.observedAtMs) {
    reasons.add("INDEPENDENT_CONTEXT_DENIED");
  }
  checkFreshness(input.observation.observedAtMs, input.evaluationTimeMs, ctx.maxObservationAgeMs, reasons);
  const availability = input.observation.availability;
  const status = input.observation.status;
  const internallyConsistent = (availability === "AVAILABLE" && status === "REACHABLE")
    || (availability === "UNAVAILABLE" && status === "UNREACHABLE");
  if (!internallyConsistent || availability !== ctx.expectedObservation.availability) {
    reasons.add("AVAILABILITY_CONTRADICTION_DENIED");
  }

  // Independent observer: digest, trusted binding, and non-aliasing identity.
  if (updateCheckPlanDigestV1(input.observer as unknown as Record<string, unknown>, "observerDigest")
    !== input.observer.observerDigest) {
    reasons.add("DIGEST_MISMATCH_DENIED");
  }
  if (input.observer.observerId !== ctx.trustedObserver.observerId
    || input.observer.observerVersion !== ctx.trustedObserver.observerVersion) {
    reasons.add("OBSERVER_SUBSTITUTION_DENIED");
  }
  const observerAlias = actorAlias(input.observer.observerId);
  const aliasesSubject = observerAlias === actorAlias(input.observation.registryId)
    || observerAlias === actorAlias(input.accepted.snapshotId)
    || (input.lkg !== null && observerAlias === actorAlias(input.lkg.lkgId));
  if (aliasesSubject) reasons.add("OBSERVER_INDEPENDENCE_DENIED");

  if (reasons.size > 0) return denied(reasons);

  const acceptedUsable = !ctx.expectedAccepted.revoked;
  const lkgUsable = input.lkg !== null
    && ctx.expectedLkg !== null
    && !ctx.expectedLkg.revoked
    && input.lkg.stale === false;

  if (acceptedUsable) {
    return {
      status: "DECIDED",
      decision: "PRESERVE_ACCEPTED",
      registryAvailability: availability,
      evaluationTimeMs: input.evaluationTimeMs,
      preservedTupleDigest: acceptedTupleDigest ?? CONTINUITY_NONE_DIGEST_V1,
      preservedSnapshotDigest: input.accepted.snapshotDigest,
      rollbackLkgDigest: CONTINUITY_NONE_DIGEST_V1,
    };
  }
  if (lkgUsable) {
    return {
      status: "DECIDED",
      decision: "ROLLBACK_REQUIRED",
      registryAvailability: availability,
      evaluationTimeMs: input.evaluationTimeMs,
      preservedTupleDigest: CONTINUITY_NONE_DIGEST_V1,
      preservedSnapshotDigest: CONTINUITY_NONE_DIGEST_V1,
      rollbackLkgDigest: input.lkg.lkgDigest,
    };
  }
  return {
    status: "DECIDED",
    decision: "ENTER_SAFE_READ_ONLY",
    registryAvailability: availability,
    evaluationTimeMs: input.evaluationTimeMs,
    preservedTupleDigest: CONTINUITY_NONE_DIGEST_V1,
    preservedSnapshotDigest: CONTINUITY_NONE_DIGEST_V1,
    rollbackLkgDigest: CONTINUITY_NONE_DIGEST_V1,
  };
}

function toResult(evaluated: EvaluatedContinuityDecisionV1): UpdateContinuityDecisionResultV1 {
  if (evaluated.status === "DENIED") {
    return immutable({
      outcome: "DENIED" as const,
      reasonCodes: [...evaluated.reasonCodes] as UpdateContinuityDecisionReasonCodeV1[],
      exitCode: evaluated.exitCode,
    });
  }
  switch (evaluated.decision) {
    case "PRESERVE_ACCEPTED":
      return immutable({
        outcome: "PRESERVE_ACCEPTED" as const,
        reasonCodes: ["CONTINUITY_ACCEPTED"] as const,
        exitCode: 0 as const,
        preservedTupleDigest: evaluated.preservedTupleDigest,
        preservedSnapshotDigest: evaluated.preservedSnapshotDigest,
      });
    case "ROLLBACK_REQUIRED":
      return immutable({
        outcome: "ROLLBACK_REQUIRED" as const,
        reasonCodes: ["CONTINUITY_ROLLBACK_REQUIRED"] as const,
        exitCode: 91 as const,
        rollbackLkgDigest: evaluated.rollbackLkgDigest,
      });
    case "ENTER_SAFE_READ_ONLY":
      return immutable({
        outcome: "ENTER_SAFE_READ_ONLY" as const,
        reasonCodes: ["CONTINUITY_SAFE_READ_ONLY"] as const,
        exitCode: 92 as const,
        readOnly: true as const,
      });
  }
}

/**
 * Pure, fail-closed continuity decision evaluation. Emits one of the three
 * continuity decisions when the closed canonical input is independently
 * valid, or a DENIED result with ordered reason codes otherwise.
 */
export function verifyUpdateContinuityDecisionV1(
  value: unknown,
  context: UpdateContinuityVerificationContextV1 | undefined,
): UpdateContinuityDecisionResultV1 {
  return toResult(evaluateUpdateContinuityDecisionV1(value, context));
}

/** Parses a canonical JSON continuity-decision input, failing closed on invalid JSON. */
export function parseUpdateContinuityDecisionV1(
  json: string,
  context: UpdateContinuityVerificationContextV1 | undefined,
): UpdateContinuityDecisionResultV1 {
  try {
    return verifyUpdateContinuityDecisionV1(JSON.parse(json) as unknown, context);
  } catch {
    return toResult(denied(["INVALID_JSON_DENIED"]));
  }
}

function projectPublicProjection(evaluated: DecidedContinuityDecisionV1): UpdateContinuityDecisionProjectionV1 {
  const base = {
    schemaVersion: UPDATE_CONTINUITY_DECISION_PROJECTION_SCHEMA_V1,
    decision: evaluated.decision,
    readOnly: true,
    registryAvailability: evaluated.registryAvailability,
    evaluationTimeMs: evaluated.evaluationTimeMs,
    preservedTupleDigest: evaluated.preservedTupleDigest,
    preservedSnapshotDigest: evaluated.preservedSnapshotDigest,
    rollbackLkgDigest: evaluated.rollbackLkgDigest,
  };
  const complete = safeObject(Object.entries(base).map(([key, item]) => [key, item] as const));
  const withDigest = safeObject([
    ...Object.entries(complete),
    ["projectionDigest", updateCheckPlanDigestV1(complete, "projectionDigest")],
  ]);
  return deepFreeze(withDigest) as unknown as UpdateContinuityDecisionProjectionV1;
}

/**
 * Emits the fixed, claim-free public projection for a continuity decision.
 * Fails closed (throws) when the input is denied or the context is missing.
 */
export function projectUpdateContinuityDecisionV1(
  value: unknown,
  context: UpdateContinuityVerificationContextV1 | undefined,
): UpdateContinuityDecisionProjectionV1 {
  const evaluated = evaluateUpdateContinuityDecisionV1(value, context);
  if (evaluated.status === "DENIED") throw new Error("UNSAFE_OR_INVALID_CONTINUITY_DECISION");
  return projectPublicProjection(evaluated);
}

/** Emits canonical public projection bytes only after independent verification succeeds. */
export function renderVerifiedUpdateContinuityDecisionV1(
  value: unknown,
  context: UpdateContinuityVerificationContextV1 | undefined,
): string {
  return canonicalJson(projectUpdateContinuityDecisionV1(value, context));
}

/** Canonicalizes the (untrusted) input bytes only. The output is explicitly untrusted. */
export function renderUntrustedUpdateContinuityDecisionV1(value: unknown): string {
  return canonicalJson(safeJsonClone(value));
}