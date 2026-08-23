import { createHash } from "node:crypto";
import { canonicalJson } from "./canonical-json.js";

/**
 * PSAI #53 UD-M1 successor micro-slice (canonical migration edge).
 *
 * Pure, local contract verification and fixture helpers for one canonical,
 * reversible source-to-target edge of a synthetic versioned DAG. This module
 * emits CHECKED metadata only: it composes no DAG, and it neither executes,
 * checkpoints, promotes, migrates, rolls back, nor otherwise mutates
 * packages, schemas, files, services, or networks, and it grants no
 * migration or promotion authority.
 */

export const UPDATE_MIGRATION_EDGE_SCHEMA_V1 = "chimpmaera.update/migration-edge/v1" as const;
export const UPDATE_MIGRATION_EDGE_PLANNER_SCHEMA_V1 = "chimpmaera.update/migration-edge-planner/v1" as const;

export const MIGRATION_EDGE_PRECONDITION_CODE_V1 = "SOURCE_TUPLE_VERIFIED" as const;
export const MIGRATION_EDGE_POSTCONDITION_CODE_V1 = "TARGET_TUPLE_VERIFIED" as const;

export type UpdateMigrationEdgeReasonCodeV1 =
  | "MIGRATION_EDGE_CHECKED"
  | "INVALID_JSON_DENIED"
  | "SCHEMA_DENIED"
  | "UNSUPPORTED_CONTRACT_VERSION_DENIED"
  | "INDEPENDENT_CONTEXT_DENIED"
  | "DIGEST_MISMATCH_DENIED"
  | "SELF_LOOP_DENIED"
  | "ORDINAL_RANGE_DENIED"
  | "ORDINAL_GAP_DENIED"
  | "MUTABLE_VERSION_DENIED"
  | "TUPLE_MISMATCH_DENIED"
  | "ROLLBACK_MISMATCH_DENIED"
  | "CONDITION_MISMATCH_DENIED"
  | "AUTHORITY_DRIFT_DENIED"
  | "PLANNER_MISMATCH_DENIED"
  | "PLANNER_INDEPENDENCE_DENIED"
  | "REVERSIBILITY_DENIED"
  | "MUTATION_CLAIM_DENIED";

export const UPDATE_MIGRATION_EDGE_EXIT_CODES_V1: Readonly<Record<UpdateMigrationEdgeReasonCodeV1, number>> = Object.freeze({
  MIGRATION_EDGE_CHECKED: 0,
  INVALID_JSON_DENIED: 71,
  SCHEMA_DENIED: 72,
  UNSUPPORTED_CONTRACT_VERSION_DENIED: 73,
  DIGEST_MISMATCH_DENIED: 74,
  SELF_LOOP_DENIED: 75,
  ORDINAL_RANGE_DENIED: 76,
  ORDINAL_GAP_DENIED: 77,
  MUTABLE_VERSION_DENIED: 78,
  TUPLE_MISMATCH_DENIED: 79,
  ROLLBACK_MISMATCH_DENIED: 80,
  CONDITION_MISMATCH_DENIED: 81,
  AUTHORITY_DRIFT_DENIED: 82,
  PLANNER_MISMATCH_DENIED: 83,
  PLANNER_INDEPENDENCE_DENIED: 84,
  REVERSIBILITY_DENIED: 85,
  MUTATION_CLAIM_DENIED: 86,
  INDEPENDENT_CONTEXT_DENIED: 87,
});

const EDGE_DENIAL_ORDER: readonly UpdateMigrationEdgeReasonCodeV1[] = Object.freeze([
  "SCHEMA_DENIED",
  "UNSUPPORTED_CONTRACT_VERSION_DENIED",
  "INDEPENDENT_CONTEXT_DENIED",
  "DIGEST_MISMATCH_DENIED",
  "SELF_LOOP_DENIED",
  "ORDINAL_RANGE_DENIED",
  "ORDINAL_GAP_DENIED",
  "MUTABLE_VERSION_DENIED",
  "TUPLE_MISMATCH_DENIED",
  "ROLLBACK_MISMATCH_DENIED",
  "CONDITION_MISMATCH_DENIED",
  "AUTHORITY_DRIFT_DENIED",
  "PLANNER_MISMATCH_DENIED",
  "PLANNER_INDEPENDENCE_DENIED",
  "REVERSIBILITY_DENIED",
  "MUTATION_CLAIM_DENIED",
]);

export interface UpdateMigrationEdgePlannerV1 {
  readonly schemaVersion: typeof UPDATE_MIGRATION_EDGE_PLANNER_SCHEMA_V1;
  readonly plannerId: string;
  readonly plannerVersion: string;
}

export interface UpdateMigrationEdgeV1 {
  readonly schemaVersion: typeof UPDATE_MIGRATION_EDGE_SCHEMA_V1;
  readonly migrationId: string;
  readonly migrationVersion: string;
  readonly ordinal: number;
  readonly sourceTupleDigest: string;
  readonly targetTupleDigest: string;
  readonly rollbackTargetDigest: string;
  readonly preconditionCode: typeof MIGRATION_EDGE_PRECONDITION_CODE_V1;
  readonly postconditionCode: typeof MIGRATION_EDGE_POSTCONDITION_CODE_V1;
  readonly reversible: true;
  readonly authorityProfileDigest: string;
  readonly planner: UpdateMigrationEdgePlannerV1;
  readonly issuedAtMs: number;
  readonly edgeDigest: string;
}

export interface UpdateMigrationEdgeVerificationContextV1 {
  readonly expectedMigrationId: string;
  readonly expectedMigrationVersion: string;
  readonly expectedSourceTupleDigest: string;
  readonly expectedTargetTupleDigest: string;
  readonly expectedRollbackTargetDigest: string;
  readonly expectedAuthorityProfileDigest: string;
  readonly expectedPreconditionCode: string;
  readonly expectedPostconditionCode: string;
  readonly expectedPlanner: { readonly plannerId: string; readonly plannerVersion: string };
  readonly expectedOrdinal: number;
}

export type UpdateMigrationEdgeCheckResultV1 =
  | { readonly outcome: "CHECKED"; readonly reasonCodes: readonly ["MIGRATION_EDGE_CHECKED"]; readonly exitCode: 0 }
  | { readonly outcome: "DENIED"; readonly reasonCodes: readonly UpdateMigrationEdgeReasonCodeV1[]; readonly exitCode: number };

export interface BuildUpdateMigrationEdgeOptionsV1 {
  readonly migrationId: string;
  readonly migrationVersion: string;
  readonly ordinal: number;
  readonly sourceTupleDigest: string;
  readonly targetTupleDigest: string;
  readonly authorityProfileDigest: string;
  readonly planner: { readonly plannerId: string; readonly plannerVersion: string };
  readonly issuedAtMs: number;
}

export const UPDATE_MIGRATION_EDGE_KEYS_V1: readonly string[] = Object.freeze([
  "schemaVersion", "migrationId", "migrationVersion", "ordinal", "sourceTupleDigest",
  "targetTupleDigest", "rollbackTargetDigest", "preconditionCode", "postconditionCode",
  "reversible", "authorityProfileDigest", "planner", "issuedAtMs", "edgeDigest",
]);

const CONTEXT_KEYS: readonly string[] = Object.freeze([
  "expectedMigrationId", "expectedMigrationVersion", "expectedSourceTupleDigest",
  "expectedTargetTupleDigest", "expectedRollbackTargetDigest", "expectedAuthorityProfileDigest",
  "expectedPreconditionCode", "expectedPostconditionCode", "expectedPlanner", "expectedOrdinal",
]);

const EXACT_VERSION = /^[0-9]+\.[0-9]+\.[0-9]+(?:-[0-9A-Za-z.-]+)?$/;
const DIGEST = /^[a-f0-9]{64}$/;
const MIGRATION_ID = /^migration:[a-z0-9][a-z0-9._-]{2,95}$/;
const PLANNER_ID = /^planner:[a-z0-9][a-z0-9._-]{2,95}$/;
const MUTATION_CLAIM_TOKENS: readonly string[] = Object.freeze([
  "exec", "apply", "promote", "checkpoint", "deploy", "commit", "activate",
]);
const DANGEROUS_KEYS = new Set(["__proto__", "prototype", "constructor"]);

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

function hasMutableVersion(version: string): boolean {
  const lowered = version.toLowerCase();
  return lowered.includes("latest") || lowered.includes("mutable");
}

function hasClaimToken(identity: string): boolean {
  const lowered = identity.toLowerCase();
  return MUTATION_CLAIM_TOKENS.some((token) => lowered.includes(token));
}

function actorAlias(identity: string): string {
  const separator = identity.indexOf(":");
  return identity.slice(separator + 1).toLowerCase().replace(/[._-]+/g, "-");
}

/**
 * Computes a canonical SHA-256 content digest of the edge after excluding the
 * `edgeDigest` field itself and rejecting unsafe JSON shapes. This digest is
 * not a signature and provides no trust by itself.
 */
export function updateMigrationEdgeDigestV1(value: object): string {
  const cloned = safeJsonClone(value);
  if (!isPlainDataRecord(cloned)) throw new TypeError("UNSAFE_DIGEST_INPUT");
  const content = safeObject(Object.keys(cloned)
    .filter((key) => key !== "edgeDigest")
    .map((key) => [key, cloned[key]] as const));
  return createHash("sha256").update(canonicalJson(content)).digest("hex");
}

// ---------------------------------------------------------------------------
// Shape validation
// ---------------------------------------------------------------------------

function validPlanner(value: unknown): value is UpdateMigrationEdgePlannerV1 {
  return exactKeys(value, ["schemaVersion", "plannerId", "plannerVersion"])
    && value.schemaVersion === UPDATE_MIGRATION_EDGE_PLANNER_SCHEMA_V1
    && typeof value.plannerId === "string" && PLANNER_ID.test(value.plannerId)
    && typeof value.plannerVersion === "string" && EXACT_VERSION.test(value.plannerVersion);
}

function validEdgeShape(value: unknown): value is UpdateMigrationEdgeV1 {
  return exactKeys(value, UPDATE_MIGRATION_EDGE_KEYS_V1)
    && value.schemaVersion === UPDATE_MIGRATION_EDGE_SCHEMA_V1
    && typeof value.migrationId === "string" && MIGRATION_ID.test(value.migrationId)
    && typeof value.migrationVersion === "string" && EXACT_VERSION.test(value.migrationVersion)
    && Number.isSafeInteger(value.ordinal) && (value.ordinal as number) >= 0
    && isDigest(value.sourceTupleDigest) && isDigest(value.targetTupleDigest)
    && isDigest(value.rollbackTargetDigest)
    && value.preconditionCode === MIGRATION_EDGE_PRECONDITION_CODE_V1
    && value.postconditionCode === MIGRATION_EDGE_POSTCONDITION_CODE_V1
    && typeof value.reversible === "boolean"
    && isDigest(value.authorityProfileDigest)
    && validPlanner(value.planner)
    && isTimestamp(value.issuedAtMs)
    && isDigest(value.edgeDigest);
}

function validPlannerContext(value: unknown): value is { readonly plannerId: string; readonly plannerVersion: string } {
  return exactKeys(value, ["plannerId", "plannerVersion"])
    && typeof value.plannerId === "string" && PLANNER_ID.test(value.plannerId)
    && typeof value.plannerVersion === "string" && EXACT_VERSION.test(value.plannerVersion);
}

function validContext(value: unknown): value is UpdateMigrationEdgeVerificationContextV1 {
  return exactKeys(value, CONTEXT_KEYS)
    && typeof value.expectedMigrationId === "string" && MIGRATION_ID.test(value.expectedMigrationId)
    && typeof value.expectedMigrationVersion === "string" && EXACT_VERSION.test(value.expectedMigrationVersion)
    && isDigest(value.expectedSourceTupleDigest) && isDigest(value.expectedTargetTupleDigest)
    && isDigest(value.expectedRollbackTargetDigest) && isDigest(value.expectedAuthorityProfileDigest)
    && typeof value.expectedPreconditionCode === "string" && value.expectedPreconditionCode.length > 0
    && typeof value.expectedPostconditionCode === "string" && value.expectedPostconditionCode.length > 0
    && validPlannerContext(value.expectedPlanner)
    && Number.isSafeInteger(value.expectedOrdinal) && (value.expectedOrdinal as number) >= 1;
}

function hasUnsupportedVersion(value: Record<string, unknown>): boolean {
  const planner = isPlainDataRecord(value.planner) ? value.planner : null;
  return (value.schemaVersion !== undefined && value.schemaVersion !== UPDATE_MIGRATION_EDGE_SCHEMA_V1)
    || (planner?.schemaVersion !== undefined && planner.schemaVersion !== UPDATE_MIGRATION_EDGE_PLANNER_SCHEMA_V1);
}

// ---------------------------------------------------------------------------
// Fail-closed edge verification
// ---------------------------------------------------------------------------

function deny(reason: UpdateMigrationEdgeReasonCodeV1): UpdateMigrationEdgeCheckResultV1 {
  return immutable({ outcome: "DENIED" as const, reasonCodes: [reason], exitCode: UPDATE_MIGRATION_EDGE_EXIT_CODES_V1[reason] });
}

export function verifyUpdateMigrationEdgeV1(
  value: unknown,
  context: UpdateMigrationEdgeVerificationContextV1 | undefined,
): UpdateMigrationEdgeCheckResultV1 {
  let clonedValue: unknown;
  try {
    clonedValue = safeJsonClone(value);
  } catch {
    return deny("SCHEMA_DENIED");
  }
  if (context === undefined) return deny("INDEPENDENT_CONTEXT_DENIED");
  let clonedContext: unknown;
  try {
    clonedContext = safeJsonClone(context);
  } catch {
    return deny("INDEPENDENT_CONTEXT_DENIED");
  }
  if (!exactKeys(clonedValue, UPDATE_MIGRATION_EDGE_KEYS_V1)) {
    if (isPlainDataRecord(clonedValue) && hasUnsupportedVersion(clonedValue)) {
      return deny("UNSUPPORTED_CONTRACT_VERSION_DENIED");
    }
    return deny("SCHEMA_DENIED");
  }
  if (hasUnsupportedVersion(clonedValue)) return deny("UNSUPPORTED_CONTRACT_VERSION_DENIED");
  if (!validEdgeShape(clonedValue)) return deny("SCHEMA_DENIED");
  if (!validContext(clonedContext)) return deny("INDEPENDENT_CONTEXT_DENIED");

  const edge = clonedValue;
  const verificationContext = clonedContext;
  const reasons = new Set<UpdateMigrationEdgeReasonCodeV1>();

  if (updateMigrationEdgeDigestV1(edge) !== edge.edgeDigest) {
    reasons.add("DIGEST_MISMATCH_DENIED");
  }
  if (edge.sourceTupleDigest === edge.targetTupleDigest) {
    reasons.add("SELF_LOOP_DENIED");
  }
  if (edge.ordinal < 1) {
    reasons.add("ORDINAL_RANGE_DENIED");
  } else if (edge.ordinal !== verificationContext.expectedOrdinal) {
    reasons.add("ORDINAL_GAP_DENIED");
  }
  if (hasMutableVersion(edge.migrationVersion) || hasMutableVersion(edge.planner.plannerVersion)) {
    reasons.add("MUTABLE_VERSION_DENIED");
  }
  if (edge.migrationId !== verificationContext.expectedMigrationId
    || edge.migrationVersion !== verificationContext.expectedMigrationVersion
    || edge.sourceTupleDigest !== verificationContext.expectedSourceTupleDigest
    || edge.targetTupleDigest !== verificationContext.expectedTargetTupleDigest) {
    reasons.add("TUPLE_MISMATCH_DENIED");
  }
  if (edge.rollbackTargetDigest !== edge.sourceTupleDigest
    || edge.rollbackTargetDigest !== verificationContext.expectedRollbackTargetDigest) {
    reasons.add("ROLLBACK_MISMATCH_DENIED");
  }
  if (edge.preconditionCode !== verificationContext.expectedPreconditionCode
    || edge.postconditionCode !== verificationContext.expectedPostconditionCode) {
    reasons.add("CONDITION_MISMATCH_DENIED");
  }
  if (edge.authorityProfileDigest !== verificationContext.expectedAuthorityProfileDigest) {
    reasons.add("AUTHORITY_DRIFT_DENIED");
  }
  if (edge.planner.plannerId !== verificationContext.expectedPlanner.plannerId
    || edge.planner.plannerVersion !== verificationContext.expectedPlanner.plannerVersion) {
    reasons.add("PLANNER_MISMATCH_DENIED");
  }
  if (actorAlias(edge.planner.plannerId) === actorAlias(edge.migrationId)) {
    reasons.add("PLANNER_INDEPENDENCE_DENIED");
  }
  if (edge.reversible !== true) {
    reasons.add("REVERSIBILITY_DENIED");
  }
  if (hasClaimToken(edge.migrationId) || hasClaimToken(edge.planner.plannerId)) {
    reasons.add("MUTATION_CLAIM_DENIED");
  }

  if (reasons.size > 0) {
    const reasonCodes = EDGE_DENIAL_ORDER.filter((reason) => reasons.has(reason));
    return immutable({
      outcome: "DENIED" as const,
      reasonCodes,
      exitCode: UPDATE_MIGRATION_EDGE_EXIT_CODES_V1[reasonCodes[0]!],
    });
  }
  return immutable({ outcome: "CHECKED" as const, reasonCodes: ["MIGRATION_EDGE_CHECKED"] as const, exitCode: 0 as const });
}

export function parseUpdateMigrationEdgeV1(
  json: string,
  context: UpdateMigrationEdgeVerificationContextV1 | undefined,
): UpdateMigrationEdgeCheckResultV1 {
  try {
    return verifyUpdateMigrationEdgeV1(JSON.parse(json) as unknown, context);
  } catch {
    return deny("INVALID_JSON_DENIED");
  }
}

// ---------------------------------------------------------------------------
// Deterministic fixture-only edge construction
// ---------------------------------------------------------------------------

export function buildUpdateMigrationEdgeV1(options: BuildUpdateMigrationEdgeOptionsV1): UpdateMigrationEdgeV1 {
  let cloned: BuildUpdateMigrationEdgeOptionsV1;
  try {
    cloned = safeJsonClone(options);
  } catch {
    throw new Error("INVALID_MIGRATION_EDGE_FIXTURE");
  }
  if (!exactKeys(cloned, ["migrationId", "migrationVersion", "ordinal", "sourceTupleDigest", "targetTupleDigest",
    "authorityProfileDigest", "planner", "issuedAtMs"])
    || typeof cloned.migrationId !== "string" || cloned.migrationId.length === 0
    || typeof cloned.migrationVersion !== "string" || cloned.migrationVersion.length === 0
    || !Number.isSafeInteger(cloned.ordinal) || cloned.ordinal < 1
    || !isDigest(cloned.sourceTupleDigest) || !isDigest(cloned.targetTupleDigest)
    || cloned.sourceTupleDigest === cloned.targetTupleDigest
    || !isDigest(cloned.authorityProfileDigest)
    || !exactKeys(cloned.planner, ["plannerId", "plannerVersion"])
    || typeof cloned.planner.plannerId !== "string" || cloned.planner.plannerId.length === 0
    || typeof cloned.planner.plannerVersion !== "string" || cloned.planner.plannerVersion.length === 0
    || !isTimestamp(cloned.issuedAtMs)) {
    throw new Error("INVALID_MIGRATION_EDGE_FIXTURE");
  }
  const edge = safeObject([
    ["schemaVersion", UPDATE_MIGRATION_EDGE_SCHEMA_V1],
    ["migrationId", cloned.migrationId],
    ["migrationVersion", cloned.migrationVersion],
    ["ordinal", cloned.ordinal],
    ["sourceTupleDigest", cloned.sourceTupleDigest],
    ["targetTupleDigest", cloned.targetTupleDigest],
    ["rollbackTargetDigest", cloned.sourceTupleDigest],
    ["preconditionCode", MIGRATION_EDGE_PRECONDITION_CODE_V1],
    ["postconditionCode", MIGRATION_EDGE_POSTCONDITION_CODE_V1],
    ["reversible", true],
    ["authorityProfileDigest", cloned.authorityProfileDigest],
    ["planner", safeObject([
      ["schemaVersion", UPDATE_MIGRATION_EDGE_PLANNER_SCHEMA_V1],
      ["plannerId", cloned.planner.plannerId],
      ["plannerVersion", cloned.planner.plannerVersion],
    ])],
    ["issuedAtMs", cloned.issuedAtMs],
  ]);
  const complete = safeObject([
    ...Object.entries(edge),
    ["edgeDigest", updateMigrationEdgeDigestV1(edge)],
  ]);
  return deepFreeze(complete) as unknown as UpdateMigrationEdgeV1;
}

// ---------------------------------------------------------------------------
// Verified CHECKED metadata emission
// ---------------------------------------------------------------------------

/** Emits canonical CHECKED metadata bytes only after verification succeeds. */
export function renderVerifiedUpdateMigrationEdgeV1(
  value: unknown,
  context: UpdateMigrationEdgeVerificationContextV1 | undefined,
): string {
  let snapshot: unknown;
  try {
    snapshot = immutable(value);
  } catch {
    throw new Error("UNSAFE_OR_INVALID_MIGRATION_EDGE");
  }
  if (verifyUpdateMigrationEdgeV1(snapshot, context).outcome === "DENIED") {
    throw new Error("UNSAFE_OR_INVALID_MIGRATION_EDGE");
  }
  return canonicalJson(snapshot);
}