import { createHash } from "node:crypto";
import { canonicalJson } from "./canonical-json.js";

/**
 * UD-M1 successor micro-slice (issue #53).
 *
 * Pure, local verification and canonical projection for a synthetic isolated
 * A/B update staging envelope. The closed input binds an operation digest,
 * exact source and target tuple digests, the active and inactive slots,
 * candidate content, staged-verification, postcondition, owner-state and
 * authority-profile evidence, an independent stager identity/version
 * envelope, issuedAtMs, and a recomputed envelope digest. It emits only
 * STAGE_CHECKED metadata. It performs no copy, filesystem, pointer switch,
 * package, service, network, activation, rollback, cleanup, or execution
 * behavior, and it grants no switch or execution authority.
 */

export const UPDATE_STAGING_ENVELOPE_SCHEMA_V1 = "chimpmaera.update/staging-envelope/v1" as const;
export const UPDATE_STAGING_CLAIM_BOUNDARY_V1 =
  "SYNTHETIC_ISOLATED_STAGE_CHECKED_METADATA_ONLY_NO_COPY_NO_FILESYSTEM_NO_POINTER_SWITCH_NO_PACKAGE_NO_SERVICE_NO_NETWORK_NO_ACTIVATION_NO_ROLLBACK_NO_CLEANUP_NO_EXECUTION_AUTHORITY" as const;

export const UPDATE_STAGING_SLOTS_V1 = Object.freeze(["A", "B"]);
export type UpdateStagingSlotV1 = (typeof UPDATE_STAGING_SLOTS_V1)[number];

export type UpdateStagingReasonCodeV1 =
  | "STAGE_CHECKED"
  | "INVALID_JSON_DENIED"
  | "SCHEMA_DENIED"
  | "UNSUPPORTED_CONTRACT_VERSION_DENIED"
  | "SLOT_MISMATCH_DENIED"
  | "TUPLE_MISMATCH_DENIED"
  | "DIGEST_MISMATCH_DENIED"
  | "INDEPENDENT_CONTEXT_DENIED"
  | "STAGER_BINDING_DENIED"
  | "MUTATION_CLAIM_DENIED"
  | "REPLAY_DENIED";

export const UPDATE_STAGING_EXIT_CODES_V1: Readonly<Record<UpdateStagingReasonCodeV1, number>> = Object.freeze({
  STAGE_CHECKED: 0,
  INVALID_JSON_DENIED: 70,
  SCHEMA_DENIED: 71,
  UNSUPPORTED_CONTRACT_VERSION_DENIED: 72,
  SLOT_MISMATCH_DENIED: 73,
  TUPLE_MISMATCH_DENIED: 74,
  DIGEST_MISMATCH_DENIED: 75,
  INDEPENDENT_CONTEXT_DENIED: 76,
  STAGER_BINDING_DENIED: 77,
  MUTATION_CLAIM_DENIED: 78,
  REPLAY_DENIED: 79,
});

const STAGING_DENIAL_ORDER: readonly UpdateStagingReasonCodeV1[] = Object.freeze([
  "SCHEMA_DENIED",
  "UNSUPPORTED_CONTRACT_VERSION_DENIED",
  "INDEPENDENT_CONTEXT_DENIED",
  "SLOT_MISMATCH_DENIED",
  "TUPLE_MISMATCH_DENIED",
  "DIGEST_MISMATCH_DENIED",
  "STAGER_BINDING_DENIED",
  "MUTATION_CLAIM_DENIED",
  "REPLAY_DENIED",
]);

export interface UpdateStagingStagerV1 {
  readonly stagerId: string;
  readonly stagerVersion: string;
}

export interface UpdateStagingEnvelopeInputV1 {
  readonly schemaVersion: typeof UPDATE_STAGING_ENVELOPE_SCHEMA_V1;
  readonly envelopeId: string;
  readonly operationDigest: string;
  readonly sourceTupleDigest: string;
  readonly targetTupleDigest: string;
  readonly activeSlot: UpdateStagingSlotV1;
  readonly inactiveSlot: UpdateStagingSlotV1;
  readonly candidateContentDigest: string;
  readonly expectedStagedVerificationDigest: string;
  readonly expectedPostconditionDigest: string;
  readonly ownerStateDigest: string;
  readonly authorityProfileDigest: string;
  readonly stager: UpdateStagingStagerV1;
  readonly issuedAtMs: number;
  readonly envelopeDigest: string;
}

export interface UpdateStagingVerificationContextV1 {
  readonly expectedOperationDigest: string;
  readonly expectedSourceTupleDigest: string;
  readonly expectedTargetTupleDigest: string;
  readonly expectedCandidateContentDigest: string;
  readonly expectedStagedVerificationDigest: string;
  readonly expectedPostconditionDigest: string;
  readonly expectedOwnerStateDigest: string;
  readonly expectedAuthorityProfileDigest: string;
  readonly trustedStager: UpdateStagingStagerV1;
  readonly evaluationTimeMs: number;
  readonly maxEnvelopeAgeMs: number;
}

export interface UpdateStagingEnvelopeProjectionV1 {
  readonly schemaVersion: typeof UPDATE_STAGING_ENVELOPE_SCHEMA_V1;
  readonly outcome: "STAGE_CHECKED";
  readonly reasonCode: "STAGE_CHECKED";
  readonly claimBoundary: typeof UPDATE_STAGING_CLAIM_BOUNDARY_V1;
  readonly envelopeId: string;
  readonly operationDigest: string;
  readonly sourceTupleDigest: string;
  readonly targetTupleDigest: string;
  readonly activeSlot: UpdateStagingSlotV1;
  readonly inactiveSlot: UpdateStagingSlotV1;
  readonly candidateContentDigest: string;
  readonly expectedStagedVerificationDigest: string;
  readonly expectedPostconditionDigest: string;
  readonly ownerStateDigest: string;
  readonly authorityProfileDigest: string;
  readonly stager: UpdateStagingStagerV1;
  readonly issuedAtMs: number;
  readonly envelopeDigest: string;
  readonly authorityGranted: false;
  readonly executionAuthorized: false;
}

export type UpdateStagingEnvelopeVerificationResultV1 =
  | { readonly outcome: "STAGE_CHECKED"; readonly reasonCodes: readonly ["STAGE_CHECKED"]; readonly exitCode: 0 }
  | { readonly outcome: "DENIED"; readonly reasonCodes: readonly UpdateStagingReasonCodeV1[]; readonly exitCode: number };

const ENVELOPE_ID = /^staging:[a-z0-9][a-z0-9._-]{2,95}$/;
const STAGER_ID = /^stager:[a-z0-9][a-z0-9._-]{2,95}$/;
// Canonical SemVer 2.0.0 syntax: no leading zeros in numeric core parts or
// all-digit pre-release identifiers, and no empty, repeated, or trailing
// pre-release separators.
const SEMVER_NUMERIC = "(?:0|[1-9][0-9]*)";
const SEMVER_PRERELEASE_IDENTIFIER = "(?:0|[1-9][0-9]*|[0-9]*[A-Za-z][0-9A-Za-z-]*)";
const CANONICAL_STAGER_VERSION = new RegExp(
  `^${SEMVER_NUMERIC}(?:\\.${SEMVER_NUMERIC}){2}(?:-${SEMVER_PRERELEASE_IDENTIFIER}(?:\\.${SEMVER_PRERELEASE_IDENTIFIER})*)?$`,
);
const DIGEST = /^[a-f0-9]{64}$/;
const CLAIM_TOKENS = Object.freeze([
  "copy", "switch", "activate", "activation", "promote", "promotion",
  "execute", "execution", "rollback", "cleanup", "secret", "callback", "url", "path",
]);
const DANGEROUS_KEYS = new Set(["__proto__", "prototype", "constructor"]);

const INPUT_KEYS = [
  "schemaVersion", "envelopeId", "operationDigest", "sourceTupleDigest", "targetTupleDigest",
  "activeSlot", "inactiveSlot", "candidateContentDigest", "expectedStagedVerificationDigest",
  "expectedPostconditionDigest", "ownerStateDigest", "authorityProfileDigest", "stager",
  "issuedAtMs", "envelopeDigest",
] as const;

const CONTEXT_KEYS = [
  "expectedOperationDigest", "expectedSourceTupleDigest", "expectedTargetTupleDigest",
  "expectedCandidateContentDigest", "expectedStagedVerificationDigest",
  "expectedPostconditionDigest", "expectedOwnerStateDigest", "expectedAuthorityProfileDigest",
  "trustedStager", "evaluationTimeMs", "maxEnvelopeAgeMs",
] as const;

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

function actorAlias(identity: string): string {
  const separator = identity.indexOf(":");
  return identity.slice(separator + 1).toLowerCase().replace(/[._-]+/g, "-");
}

function hasClaimToken(identity: string): boolean {
  return CLAIM_TOKENS.some((token) => identity.includes(token));
}

export function oppositeSlotV1(slot: UpdateStagingSlotV1): UpdateStagingSlotV1 {
  return slot === "A" ? "B" : "A";
}

/**
 * Computes a canonical SHA-256 content digest after rejecting unsafe JSON
 * shapes. This digest is not a signature and provides no trust by itself.
 */
export function updateStagingEnvelopeDigestV1(value: Record<string, unknown>, digestKey = "envelopeDigest"): string {
  if (DANGEROUS_KEYS.has(digestKey)) throw new TypeError("UNSAFE_DIGEST_KEY");
  const cloned = safeJsonClone(value);
  if (!isPlainDataRecord(cloned)) throw new TypeError("UNSAFE_DIGEST_INPUT");
  const content = safeObject(Object.keys(cloned)
    .filter((key) => key !== digestKey)
    .map((key) => [key, cloned[key]] as const));
  return createHash("sha256").update(canonicalJson(content)).digest("hex");
}

function validStager(value: unknown): value is UpdateStagingStagerV1 {
  return exactKeys(value, ["stagerId", "stagerVersion"])
    && typeof value.stagerId === "string" && STAGER_ID.test(value.stagerId)
    && typeof value.stagerVersion === "string" && CANONICAL_STAGER_VERSION.test(value.stagerVersion);
}

function validStagingInput(value: unknown): value is UpdateStagingEnvelopeInputV1 {
  return exactKeys(value, INPUT_KEYS)
    && value.schemaVersion === UPDATE_STAGING_ENVELOPE_SCHEMA_V1
    && typeof value.envelopeId === "string" && ENVELOPE_ID.test(value.envelopeId)
    && isDigest(value.operationDigest)
    && isDigest(value.sourceTupleDigest)
    && isDigest(value.targetTupleDigest)
    && typeof value.activeSlot === "string" && value.activeSlot.length > 0
    && typeof value.inactiveSlot === "string" && value.inactiveSlot.length > 0
    && isDigest(value.candidateContentDigest)
    && isDigest(value.expectedStagedVerificationDigest)
    && isDigest(value.expectedPostconditionDigest)
    && isDigest(value.ownerStateDigest)
    && isDigest(value.authorityProfileDigest)
    && validStager(value.stager)
    && isTimestamp(value.issuedAtMs)
    && isDigest(value.envelopeDigest);
}

function validStagingContext(value: unknown): value is UpdateStagingVerificationContextV1 {
  return exactKeys(value, CONTEXT_KEYS)
    && isDigest(value.expectedOperationDigest)
    && isDigest(value.expectedSourceTupleDigest)
    && isDigest(value.expectedTargetTupleDigest)
    && isDigest(value.expectedCandidateContentDigest)
    && isDigest(value.expectedStagedVerificationDigest)
    && isDigest(value.expectedPostconditionDigest)
    && isDigest(value.expectedOwnerStateDigest)
    && isDigest(value.expectedAuthorityProfileDigest)
    && validStager(value.trustedStager)
    && isTimestamp(value.evaluationTimeMs)
    && isTimestamp(value.maxEnvelopeAgeMs);
}

function hasUnsupportedVersion(value: Record<string, unknown>): boolean {
  return value.schemaVersion !== undefined && value.schemaVersion !== UPDATE_STAGING_ENVELOPE_SCHEMA_V1;
}

function denyStaging(reason: UpdateStagingReasonCodeV1): UpdateStagingEnvelopeVerificationResultV1 {
  return immutable({ outcome: "DENIED" as const, reasonCodes: [reason], exitCode: UPDATE_STAGING_EXIT_CODES_V1[reason] });
}

export function evaluateUpdateStagingEnvelopeV1(
  value: unknown,
  context: UpdateStagingVerificationContextV1 | undefined,
): UpdateStagingEnvelopeVerificationResultV1 {
  let clonedValue: unknown;
  let clonedContext: unknown;
  try {
    clonedValue = safeJsonClone(value);
    clonedContext = context === undefined ? undefined : safeJsonClone(context);
  } catch {
    return denyStaging("SCHEMA_DENIED");
  }
  if (!exactKeys(clonedValue, INPUT_KEYS)) {
    if (isPlainDataRecord(clonedValue) && hasUnsupportedVersion(clonedValue)) {
      return denyStaging("UNSUPPORTED_CONTRACT_VERSION_DENIED");
    }
    return denyStaging("SCHEMA_DENIED");
  }
  if (hasUnsupportedVersion(clonedValue)) return denyStaging("UNSUPPORTED_CONTRACT_VERSION_DENIED");
  if (!validStagingInput(clonedValue)) return denyStaging("SCHEMA_DENIED");
  if (!validStagingContext(clonedContext)) return denyStaging("INDEPENDENT_CONTEXT_DENIED");

  const input = clonedValue;
  const verification = clonedContext;
  const reasons = new Set<UpdateStagingReasonCodeV1>();

  if (input.activeSlot === input.inactiveSlot
    || input.inactiveSlot !== oppositeSlotV1(input.activeSlot)) {
    reasons.add("SLOT_MISMATCH_DENIED");
  }
  if (input.sourceTupleDigest === input.targetTupleDigest
    || input.sourceTupleDigest !== verification.expectedSourceTupleDigest
    || input.targetTupleDigest !== verification.expectedTargetTupleDigest) {
    reasons.add("TUPLE_MISMATCH_DENIED");
  }
  if (updateStagingEnvelopeDigestV1(input as unknown as Record<string, unknown>) !== input.envelopeDigest
    || input.operationDigest !== verification.expectedOperationDigest
    || input.candidateContentDigest !== verification.expectedCandidateContentDigest
    || input.expectedStagedVerificationDigest !== verification.expectedStagedVerificationDigest
    || input.expectedPostconditionDigest !== verification.expectedPostconditionDigest
    || input.ownerStateDigest !== verification.expectedOwnerStateDigest
    || input.authorityProfileDigest !== verification.expectedAuthorityProfileDigest) {
    reasons.add("DIGEST_MISMATCH_DENIED");
  }
  if (input.stager.stagerId !== verification.trustedStager.stagerId
    || input.stager.stagerVersion !== verification.trustedStager.stagerVersion
    || actorAlias(input.envelopeId) === actorAlias(input.stager.stagerId)) {
    reasons.add("STAGER_BINDING_DENIED");
  }
  if (hasClaimToken(input.envelopeId) || hasClaimToken(input.stager.stagerId)) {
    reasons.add("MUTATION_CLAIM_DENIED");
  }
  if (input.issuedAtMs > verification.evaluationTimeMs
    || verification.evaluationTimeMs - input.issuedAtMs > verification.maxEnvelopeAgeMs) {
    reasons.add("REPLAY_DENIED");
  }

  if (reasons.size > 0) {
    const reasonCodes = STAGING_DENIAL_ORDER.filter((reason) => reasons.has(reason));
    return immutable({
      outcome: "DENIED" as const,
      reasonCodes,
      exitCode: UPDATE_STAGING_EXIT_CODES_V1[reasonCodes[0]!],
    });
  }
  return immutable({ outcome: "STAGE_CHECKED" as const, reasonCodes: ["STAGE_CHECKED"] as const, exitCode: 0 as const });
}

export function parseUpdateStagingEnvelopeV1(
  json: string,
  context: UpdateStagingVerificationContextV1 | undefined,
): UpdateStagingEnvelopeVerificationResultV1 {
  try {
    return evaluateUpdateStagingEnvelopeV1(JSON.parse(json) as unknown, context);
  } catch {
    return denyStaging("INVALID_JSON_DENIED");
  }
}

function projectStagingChecked(input: UpdateStagingEnvelopeInputV1): UpdateStagingEnvelopeProjectionV1 {
  return deepFreeze(safeObject([
    ["schemaVersion", UPDATE_STAGING_ENVELOPE_SCHEMA_V1],
    ["outcome", "STAGE_CHECKED"],
    ["reasonCode", "STAGE_CHECKED"],
    ["claimBoundary", UPDATE_STAGING_CLAIM_BOUNDARY_V1],
    ["envelopeId", input.envelopeId],
    ["operationDigest", input.operationDigest],
    ["sourceTupleDigest", input.sourceTupleDigest],
    ["targetTupleDigest", input.targetTupleDigest],
    ["activeSlot", input.activeSlot],
    ["inactiveSlot", input.inactiveSlot],
    ["candidateContentDigest", input.candidateContentDigest],
    ["expectedStagedVerificationDigest", input.expectedStagedVerificationDigest],
    ["expectedPostconditionDigest", input.expectedPostconditionDigest],
    ["ownerStateDigest", input.ownerStateDigest],
    ["authorityProfileDigest", input.authorityProfileDigest],
    ["stager", safeObject([
      ["stagerId", input.stager.stagerId],
      ["stagerVersion", input.stager.stagerVersion],
    ])],
    ["issuedAtMs", input.issuedAtMs],
    ["envelopeDigest", input.envelopeDigest],
    ["authorityGranted", false],
    ["executionAuthorized", false],
  ])) as unknown as UpdateStagingEnvelopeProjectionV1;
}

function requireStagingChecked(
  value: unknown,
  context: UpdateStagingVerificationContextV1 | undefined,
): UpdateStagingEnvelopeInputV1 {
  let snapshot: UpdateStagingEnvelopeInputV1;
  try {
    snapshot = safeJsonClone(value) as UpdateStagingEnvelopeInputV1;
  } catch {
    throw new Error("UNSAFE_OR_INVALID_UPDATE_STAGING");
  }
  if (evaluateUpdateStagingEnvelopeV1(snapshot, context).outcome !== "STAGE_CHECKED") {
    throw new Error("UNSAFE_OR_INVALID_UPDATE_STAGING");
  }
  return snapshot;
}

/** Emits a deeply frozen STAGE_CHECKED projection only after fail-closed verification. */
export function updateStagingEnvelopeProjectionV1(
  value: unknown,
  context: UpdateStagingVerificationContextV1 | undefined,
): UpdateStagingEnvelopeProjectionV1 {
  return projectStagingChecked(requireStagingChecked(value, context));
}

/** Emits canonical STAGE_CHECKED bytes only after fail-closed verification succeeds. */
export function renderUpdateStagingEnvelopeV1(
  value: unknown,
  context: UpdateStagingVerificationContextV1 | undefined,
): string {
  return canonicalJson(safeJsonClone(updateStagingEnvelopeProjectionV1(value, context)));
}

/** Deterministic SHA-256 digest of canonical STAGE_CHECKED projection bytes. */
export function updateStagingProjectionDigestV1(projection: UpdateStagingEnvelopeProjectionV1): string {
  return createHash("sha256").update(canonicalJson(safeJsonClone(projection))).digest("hex");
}