import { createHash } from "node:crypto";
import { types as nodeUtilTypes } from "node:util";
import { canonicalJson } from "./canonical-json.js";

/**
 * Closed, pure PRE_MIGRATION checkpoint metadata for PanSphaira #53.
 *
 * This contract records immutable digest bindings only. It performs no
 * migration, restore, activation, promotion, package, schema, filesystem,
 * service, credential, callback, or network action and grants no such
 * authority.
 */
export const UPDATE_MIGRATION_CHECKPOINT_SCHEMA_V1 = "chimpmaera.update/migration-checkpoint/v1" as const;
export const UPDATE_MIGRATION_CHECKPOINT_RECORDER_SCHEMA_V1 = "chimpmaera.update/migration-checkpoint-recorder/v1" as const;
export const UPDATE_MIGRATION_CHECKPOINT_TRANSITION_V1 = "CHECKPOINT_RECORDED" as const;
export const UPDATE_MIGRATION_CHECKPOINT_PHASE_V1 = "PRE_MIGRATION" as const;

export const UPDATE_MIGRATION_CHECKPOINT_KEYS_V1 = Object.freeze([
  "schemaVersion", "transition", "phase", "operationDigest", "migrationEdgeDigest",
  "currentTupleDigest", "rollbackTargetTupleDigest", "snapshotDigest",
  "snapshotContentDigest", "ownerStateDigest", "checkpointOrdinal",
  "authorityProfileDigest", "recorder", "capturedAtMs", "checkpointDigest",
]) as readonly string[];

const RECORDER_KEYS = Object.freeze(["schemaVersion", "recorderId", "recorderVersion"]);
const BUILD_KEYS = Object.freeze([
  "operationDigest", "migrationEdgeDigest", "currentTupleDigest", "rollbackTargetTupleDigest",
  "snapshotDigest", "snapshotContentDigest", "ownerStateDigest", "checkpointOrdinal",
  "authorityProfileDigest", "recorder", "capturedAtMs",
]);
const CONTEXT_KEYS = Object.freeze([
  "expectedOperationDigest", "expectedMigrationEdgeDigest", "expectedCurrentTupleDigest",
  "expectedSnapshotDigest", "expectedSnapshotContentDigest", "expectedOwnerStateDigest",
  "expectedCheckpointOrdinal", "expectedAuthorityProfileDigest", "expectedRecorder",
  "expectedCapturedAtMs",
]);
const EXPECTED_RECORDER_KEYS = Object.freeze(["recorderId", "recorderVersion"]);

export interface UpdateMigrationCheckpointRecorderV1 {
  readonly schemaVersion: typeof UPDATE_MIGRATION_CHECKPOINT_RECORDER_SCHEMA_V1;
  readonly recorderId: string;
  readonly recorderVersion: string;
}

export interface UpdateMigrationCheckpointV1 {
  readonly schemaVersion: typeof UPDATE_MIGRATION_CHECKPOINT_SCHEMA_V1;
  readonly transition: typeof UPDATE_MIGRATION_CHECKPOINT_TRANSITION_V1;
  readonly phase: typeof UPDATE_MIGRATION_CHECKPOINT_PHASE_V1;
  readonly operationDigest: string;
  readonly migrationEdgeDigest: string;
  readonly currentTupleDigest: string;
  readonly rollbackTargetTupleDigest: string;
  readonly snapshotDigest: string;
  readonly snapshotContentDigest: string;
  readonly ownerStateDigest: string;
  readonly checkpointOrdinal: number;
  readonly authorityProfileDigest: string;
  readonly recorder: UpdateMigrationCheckpointRecorderV1;
  readonly capturedAtMs: number;
  readonly checkpointDigest: string;
}

export interface BuildUpdateMigrationCheckpointOptionsV1 {
  readonly operationDigest: string;
  readonly migrationEdgeDigest: string;
  readonly currentTupleDigest: string;
  readonly rollbackTargetTupleDigest: string;
  readonly snapshotDigest: string;
  readonly snapshotContentDigest: string;
  readonly ownerStateDigest: string;
  readonly checkpointOrdinal: number;
  readonly authorityProfileDigest: string;
  readonly recorder: { readonly recorderId: string; readonly recorderVersion: string };
  readonly capturedAtMs: number;
}

export interface UpdateMigrationCheckpointContextV1 {
  readonly expectedOperationDigest: string;
  readonly expectedMigrationEdgeDigest: string;
  readonly expectedCurrentTupleDigest: string;
  readonly expectedSnapshotDigest: string;
  readonly expectedSnapshotContentDigest: string;
  readonly expectedOwnerStateDigest: string;
  readonly expectedCheckpointOrdinal: number;
  readonly expectedAuthorityProfileDigest: string;
  readonly expectedRecorder: { readonly recorderId: string; readonly recorderVersion: string };
  readonly expectedCapturedAtMs: number;
}

export type UpdateMigrationCheckpointReasonCodeV1 =
  | "CHECKPOINT_RECORDED"
  | "INVALID_JSON_DENIED"
  | "SCHEMA_DENIED"
  | "UNSUPPORTED_CONTRACT_VERSION_DENIED"
  | "INDEPENDENT_CONTEXT_DENIED"
  | "DIGEST_MISMATCH_DENIED"
  | "PHASE_TRANSITION_DENIED"
  | "OPERATION_BINDING_DENIED"
  | "MIGRATION_EDGE_BINDING_DENIED"
  | "CURRENT_TUPLE_BINDING_DENIED"
  | "ROLLBACK_TARGET_MISMATCH_DENIED"
  | "SNAPSHOT_BINDING_DENIED"
  | "OWNER_STATE_BINDING_DENIED"
  | "ORDINAL_REPLAY_DENIED"
  | "AUTHORITY_DRIFT_DENIED"
  | "RECORDER_MISMATCH_DENIED"
  | "TIME_REPLAY_DENIED"
  | "AUTHORITY_CLAIM_DENIED";

export const UPDATE_MIGRATION_CHECKPOINT_EXIT_CODES_V1: Readonly<Record<UpdateMigrationCheckpointReasonCodeV1, number>> = Object.freeze({
  CHECKPOINT_RECORDED: 0,
  INVALID_JSON_DENIED: 71,
  SCHEMA_DENIED: 72,
  UNSUPPORTED_CONTRACT_VERSION_DENIED: 73,
  INDEPENDENT_CONTEXT_DENIED: 74,
  DIGEST_MISMATCH_DENIED: 75,
  PHASE_TRANSITION_DENIED: 76,
  OPERATION_BINDING_DENIED: 77,
  MIGRATION_EDGE_BINDING_DENIED: 78,
  CURRENT_TUPLE_BINDING_DENIED: 79,
  ROLLBACK_TARGET_MISMATCH_DENIED: 80,
  SNAPSHOT_BINDING_DENIED: 81,
  OWNER_STATE_BINDING_DENIED: 82,
  ORDINAL_REPLAY_DENIED: 83,
  AUTHORITY_DRIFT_DENIED: 84,
  RECORDER_MISMATCH_DENIED: 85,
  TIME_REPLAY_DENIED: 86,
  AUTHORITY_CLAIM_DENIED: 87,
});

const DENIAL_ORDER: readonly UpdateMigrationCheckpointReasonCodeV1[] = Object.freeze([
  "SCHEMA_DENIED", "UNSUPPORTED_CONTRACT_VERSION_DENIED", "INDEPENDENT_CONTEXT_DENIED",
  "DIGEST_MISMATCH_DENIED", "PHASE_TRANSITION_DENIED", "OPERATION_BINDING_DENIED",
  "MIGRATION_EDGE_BINDING_DENIED", "CURRENT_TUPLE_BINDING_DENIED",
  "ROLLBACK_TARGET_MISMATCH_DENIED", "SNAPSHOT_BINDING_DENIED",
  "OWNER_STATE_BINDING_DENIED", "ORDINAL_REPLAY_DENIED", "AUTHORITY_DRIFT_DENIED",
  "RECORDER_MISMATCH_DENIED", "TIME_REPLAY_DENIED", "AUTHORITY_CLAIM_DENIED",
]);

export type UpdateMigrationCheckpointResultV1 =
  | { readonly outcome: "RECORDED"; readonly reasonCodes: readonly ["CHECKPOINT_RECORDED"]; readonly exitCode: 0 }
  | { readonly outcome: "DENIED"; readonly reasonCodes: readonly UpdateMigrationCheckpointReasonCodeV1[]; readonly exitCode: number };

const DIGEST = /^[a-f0-9]{64}$/;
const RECORDER_ID = /^recorder:[a-z0-9][a-z0-9._-]{2,95}$/;
const NEUTRAL_RECORDER_ID = /^recorder:(?:checkpoint|metadata)-(?:recorder|writer)$/;
const CANONICAL_SEMVER = /^(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)(?:-((?:0|[1-9][0-9]*|[0-9]*[a-zA-Z-][0-9a-zA-Z-]*)(?:\.(?:0|[1-9][0-9]*|[0-9]*[a-zA-Z-][0-9a-zA-Z-]*))*))?(?:\+([0-9a-zA-Z-]+(?:\.[0-9a-zA-Z-]+)*))?$/;
const DANGEROUS_KEYS = new Set(["__proto__", "prototype", "constructor"]);

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  if (value === null || typeof value !== "object" || Array.isArray(value) || Object.getPrototypeOf(value) !== Object.prototype) return false;
  for (const key of Reflect.ownKeys(value)) {
    if (typeof key !== "string" || DANGEROUS_KEYS.has(key)) return false;
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (descriptor === undefined || !("value" in descriptor) || descriptor.enumerable !== true) return false;
  }
  return true;
}

function exactKeys(value: unknown, expected: readonly string[]): value is Record<string, unknown> {
  if (!isPlainRecord(value)) return false;
  const actual = Object.keys(value).sort();
  const sortedExpected = [...expected].sort();
  return actual.length === sortedExpected.length && actual.every((key, index) => key === sortedExpected[index]);
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

function safeClone<T>(value: T, ancestors = new Set<object>()): T {
  if (nodeUtilTypes.isProxy(value)) throw new TypeError("UNSAFE_JSON_PROXY");
  if (value === null || typeof value === "string" || typeof value === "boolean") return value;
  if (typeof value === "number") {
    if (!Number.isFinite(value) || Object.is(value, -0) || (Number.isInteger(value) && !Number.isSafeInteger(value))) {
      throw new TypeError("UNSAFE_JSON_NUMBER");
    }
    return value;
  }
  if (Array.isArray(value)) {
    if (!isDenseStandardArray(value) || ancestors.has(value)) throw new TypeError("UNSAFE_JSON_ARRAY");
    const next = new Set(ancestors).add(value);
    return value.map((item) => safeClone(item, next)) as T;
  }
  if (!isPlainRecord(value) || ancestors.has(value as object)) throw new TypeError("UNSAFE_JSON_OBJECT");
  const next = new Set(ancestors).add(value as object);
  const output: Record<string, unknown> = {};
  for (const key of Object.keys(value)) output[key] = safeClone((value as Record<string, unknown>)[key], next);
  return output as T;
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
  return deepFreeze(safeClone(value));
}

function isDigest(value: unknown): value is string {
  return typeof value === "string" && DIGEST.test(value);
}

function isPositiveSafeInteger(value: unknown): value is number {
  return Number.isSafeInteger(value) && !Object.is(value, -0) && (value as number) > 0;
}

function isSafeTimestamp(value: unknown): value is number {
  return Number.isSafeInteger(value) && !Object.is(value, -0) && (value as number) >= 0;
}

function isRecorderIdentity(value: unknown): value is { readonly recorderId: string; readonly recorderVersion: string } {
  return exactKeys(value, EXPECTED_RECORDER_KEYS)
    && typeof value.recorderId === "string" && RECORDER_ID.test(value.recorderId)
    && typeof value.recorderVersion === "string" && CANONICAL_SEMVER.test(value.recorderVersion);
}

function isRecorder(value: unknown): value is UpdateMigrationCheckpointRecorderV1 {
  return exactKeys(value, RECORDER_KEYS)
    && value.schemaVersion === UPDATE_MIGRATION_CHECKPOINT_RECORDER_SCHEMA_V1
    && typeof value.recorderId === "string" && RECORDER_ID.test(value.recorderId)
    && typeof value.recorderVersion === "string" && CANONICAL_SEMVER.test(value.recorderVersion);
}

function isCheckpointShape(value: unknown): value is UpdateMigrationCheckpointV1 {
  return exactKeys(value, UPDATE_MIGRATION_CHECKPOINT_KEYS_V1)
    && typeof value.schemaVersion === "string"
    && typeof value.transition === "string"
    && typeof value.phase === "string"
    && isDigest(value.operationDigest) && isDigest(value.migrationEdgeDigest)
    && isDigest(value.currentTupleDigest) && isDigest(value.rollbackTargetTupleDigest)
    && isDigest(value.snapshotDigest) && isDigest(value.snapshotContentDigest)
    && isDigest(value.ownerStateDigest) && isPositiveSafeInteger(value.checkpointOrdinal)
    && isDigest(value.authorityProfileDigest) && isRecorder(value.recorder)
    && isSafeTimestamp(value.capturedAtMs) && isDigest(value.checkpointDigest);
}

function isContext(value: unknown): value is UpdateMigrationCheckpointContextV1 {
  return exactKeys(value, CONTEXT_KEYS)
    && isDigest(value.expectedOperationDigest) && isDigest(value.expectedMigrationEdgeDigest)
    && isDigest(value.expectedCurrentTupleDigest) && isDigest(value.expectedSnapshotDigest)
    && isDigest(value.expectedSnapshotContentDigest) && isDigest(value.expectedOwnerStateDigest)
    && isPositiveSafeInteger(value.expectedCheckpointOrdinal)
    && isDigest(value.expectedAuthorityProfileDigest) && isRecorderIdentity(value.expectedRecorder)
    && isSafeTimestamp(value.expectedCapturedAtMs);
}

function isNeutralRecorderId(recorderId: string): boolean {
  return NEUTRAL_RECORDER_ID.test(recorderId);
}

/** Canonical SHA-256 over the closed envelope excluding checkpointDigest. */
export function updateMigrationCheckpointDigestV1(value: object): string {
  const cloned = safeClone(value);
  if (!isPlainRecord(cloned)) throw new TypeError("UNSAFE_DIGEST_INPUT");
  const unsigned = Object.fromEntries(Object.keys(cloned)
    .filter((key) => key !== "checkpointDigest")
    .map((key) => [key, cloned[key]]));
  return createHash("sha256").update(canonicalJson(unsigned)).digest("hex");
}

export function buildUpdateMigrationCheckpointV1(options: BuildUpdateMigrationCheckpointOptionsV1): UpdateMigrationCheckpointV1 {
  let cloned: BuildUpdateMigrationCheckpointOptionsV1;
  try {
    cloned = safeClone(options);
  } catch {
    throw new Error("INVALID_MIGRATION_CHECKPOINT_FIXTURE");
  }
  if (!exactKeys(cloned, BUILD_KEYS)
    || !isDigest(cloned.operationDigest) || !isDigest(cloned.migrationEdgeDigest)
    || !isDigest(cloned.currentTupleDigest) || !isDigest(cloned.rollbackTargetTupleDigest)
    || cloned.rollbackTargetTupleDigest !== cloned.currentTupleDigest
    || !isDigest(cloned.snapshotDigest) || !isDigest(cloned.snapshotContentDigest)
    || !isDigest(cloned.ownerStateDigest) || !isPositiveSafeInteger(cloned.checkpointOrdinal)
    || !isDigest(cloned.authorityProfileDigest) || !isRecorderIdentity(cloned.recorder)
    || !isNeutralRecorderId(cloned.recorder.recorderId) || !isSafeTimestamp(cloned.capturedAtMs)) {
    throw new Error("INVALID_MIGRATION_CHECKPOINT_FIXTURE");
  }
  const unsigned = {
    schemaVersion: UPDATE_MIGRATION_CHECKPOINT_SCHEMA_V1,
    transition: UPDATE_MIGRATION_CHECKPOINT_TRANSITION_V1,
    phase: UPDATE_MIGRATION_CHECKPOINT_PHASE_V1,
    operationDigest: cloned.operationDigest,
    migrationEdgeDigest: cloned.migrationEdgeDigest,
    currentTupleDigest: cloned.currentTupleDigest,
    rollbackTargetTupleDigest: cloned.rollbackTargetTupleDigest,
    snapshotDigest: cloned.snapshotDigest,
    snapshotContentDigest: cloned.snapshotContentDigest,
    ownerStateDigest: cloned.ownerStateDigest,
    checkpointOrdinal: cloned.checkpointOrdinal,
    authorityProfileDigest: cloned.authorityProfileDigest,
    recorder: {
      schemaVersion: UPDATE_MIGRATION_CHECKPOINT_RECORDER_SCHEMA_V1,
      recorderId: cloned.recorder.recorderId,
      recorderVersion: cloned.recorder.recorderVersion,
    },
    capturedAtMs: cloned.capturedAtMs,
  };
  return immutable({ ...unsigned, checkpointDigest: updateMigrationCheckpointDigestV1(unsigned) });
}

function deny(reason: UpdateMigrationCheckpointReasonCodeV1): UpdateMigrationCheckpointResultV1 {
  return immutable({ outcome: "DENIED" as const, reasonCodes: [reason], exitCode: UPDATE_MIGRATION_CHECKPOINT_EXIT_CODES_V1[reason] });
}

export function verifyUpdateMigrationCheckpointV1(
  value: unknown,
  context: UpdateMigrationCheckpointContextV1 | undefined,
): UpdateMigrationCheckpointResultV1 {
  let checkpointInput: unknown;
  try {
    checkpointInput = safeClone(value);
  } catch {
    return deny("SCHEMA_DENIED");
  }
  if (!exactKeys(checkpointInput, UPDATE_MIGRATION_CHECKPOINT_KEYS_V1)) return deny("SCHEMA_DENIED");
  const rawRecorder = isPlainRecord(checkpointInput.recorder) ? checkpointInput.recorder : undefined;
  if (checkpointInput.schemaVersion !== UPDATE_MIGRATION_CHECKPOINT_SCHEMA_V1
    || (rawRecorder?.schemaVersion !== undefined
      && rawRecorder.schemaVersion !== UPDATE_MIGRATION_CHECKPOINT_RECORDER_SCHEMA_V1)) {
    return deny("UNSUPPORTED_CONTRACT_VERSION_DENIED");
  }
  if (!isCheckpointShape(checkpointInput)) return deny("SCHEMA_DENIED");

  if (context === undefined) return deny("INDEPENDENT_CONTEXT_DENIED");
  let contextInput: unknown;
  try {
    contextInput = safeClone(context);
  } catch {
    return deny("INDEPENDENT_CONTEXT_DENIED");
  }
  if (!isContext(contextInput)) return deny("INDEPENDENT_CONTEXT_DENIED");

  const checkpoint = checkpointInput;
  const expected = contextInput;
  const reasons = new Set<UpdateMigrationCheckpointReasonCodeV1>();
  if (updateMigrationCheckpointDigestV1(checkpoint) !== checkpoint.checkpointDigest) reasons.add("DIGEST_MISMATCH_DENIED");
  if (checkpoint.transition !== UPDATE_MIGRATION_CHECKPOINT_TRANSITION_V1
    || checkpoint.phase !== UPDATE_MIGRATION_CHECKPOINT_PHASE_V1) reasons.add("PHASE_TRANSITION_DENIED");
  if (checkpoint.operationDigest !== expected.expectedOperationDigest) reasons.add("OPERATION_BINDING_DENIED");
  if (checkpoint.migrationEdgeDigest !== expected.expectedMigrationEdgeDigest) reasons.add("MIGRATION_EDGE_BINDING_DENIED");
  if (checkpoint.currentTupleDigest !== expected.expectedCurrentTupleDigest) reasons.add("CURRENT_TUPLE_BINDING_DENIED");
  if (checkpoint.rollbackTargetTupleDigest !== checkpoint.currentTupleDigest) reasons.add("ROLLBACK_TARGET_MISMATCH_DENIED");
  if (checkpoint.snapshotDigest !== expected.expectedSnapshotDigest
    || checkpoint.snapshotContentDigest !== expected.expectedSnapshotContentDigest) reasons.add("SNAPSHOT_BINDING_DENIED");
  if (checkpoint.ownerStateDigest !== expected.expectedOwnerStateDigest) reasons.add("OWNER_STATE_BINDING_DENIED");
  if (checkpoint.checkpointOrdinal !== expected.expectedCheckpointOrdinal) reasons.add("ORDINAL_REPLAY_DENIED");
  if (checkpoint.authorityProfileDigest !== expected.expectedAuthorityProfileDigest) reasons.add("AUTHORITY_DRIFT_DENIED");
  if (checkpoint.recorder.recorderId !== expected.expectedRecorder.recorderId
    || checkpoint.recorder.recorderVersion !== expected.expectedRecorder.recorderVersion) reasons.add("RECORDER_MISMATCH_DENIED");
  if (checkpoint.capturedAtMs !== expected.expectedCapturedAtMs) reasons.add("TIME_REPLAY_DENIED");
  if (!isNeutralRecorderId(checkpoint.recorder.recorderId)) reasons.add("AUTHORITY_CLAIM_DENIED");

  if (reasons.size > 0) {
    const reasonCodes = DENIAL_ORDER.filter((reason) => reasons.has(reason));
    return immutable({
      outcome: "DENIED" as const,
      reasonCodes,
      exitCode: UPDATE_MIGRATION_CHECKPOINT_EXIT_CODES_V1[reasonCodes[0]!],
    });
  }
  return immutable({ outcome: "RECORDED" as const, reasonCodes: ["CHECKPOINT_RECORDED"] as const, exitCode: 0 as const });
}

export function parseUpdateMigrationCheckpointV1(
  json: string,
  context: UpdateMigrationCheckpointContextV1 | undefined,
): UpdateMigrationCheckpointResultV1 {
  try {
    return verifyUpdateMigrationCheckpointV1(JSON.parse(json) as unknown, context);
  } catch {
    return deny("INVALID_JSON_DENIED");
  }
}

/** Emits canonical CHECKPOINT_RECORDED metadata only after verification. */
export function renderVerifiedUpdateMigrationCheckpointV1(
  value: unknown,
  context: UpdateMigrationCheckpointContextV1 | undefined,
): string {
  let snapshot: unknown;
  try {
    snapshot = immutable(value);
  } catch {
    throw new Error("UNSAFE_OR_INVALID_MIGRATION_CHECKPOINT");
  }
  if (verifyUpdateMigrationCheckpointV1(snapshot, context).outcome !== "RECORDED") {
    throw new Error("UNSAFE_OR_INVALID_MIGRATION_CHECKPOINT");
  }
  return canonicalJson(snapshot);
}
