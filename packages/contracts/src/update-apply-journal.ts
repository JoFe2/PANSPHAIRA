import { createHash } from "node:crypto";
import { canonicalJson } from "./canonical-json.js";

/**
 * UD-APPLY-01 authorized thin slice (issue #53, micro-slice 2).
 *
 * This module contains a pure, immutable synthetic apply-journal contract for
 * the governed update apply sequence. It models the fixed event ladder
 * (STAGE_COPY, VERIFY_STAGED, SWITCH_POINTER, VERIFY_POSTCONDITION,
 * ROLLBACK_LKG, CLEANUP) as a hash-chained, fail-closed verification target
 * bound to an independent operation context. It does not stage, copy, switch
 * pointers, roll back, clean up, execute packages, or perform filesystem,
 * process, worker, or network effects.
 */

export const UPDATE_APPLY_JOURNAL_SCHEMA_V1 = "chimpmaera.update/apply-journal/v1" as const;

export const APPLY_EVENT_NAMES_V1 = Object.freeze([
  "STAGE_COPY",
  "VERIFY_STAGED",
  "SWITCH_POINTER",
  "VERIFY_POSTCONDITION",
  "ROLLBACK_LKG",
  "CLEANUP",
]) as readonly ["STAGE_COPY", "VERIFY_STAGED", "SWITCH_POINTER", "VERIFY_POSTCONDITION", "ROLLBACK_LKG", "CLEANUP"];
export type ApplyEventNameV1 = (typeof APPLY_EVENT_NAMES_V1)[number];

export type ApplyEventOutcomeV1 =
  | "STAGE_COPIED"
  | "STAGE_VERIFIED"
  | "POINTER_SWITCHED"
  | "POSTCONDITION_VERIFIED"
  | "POSTCONDITION_FAILED"
  | "LKG_RESTORED"
  | "ZERO_RESIDUE";

export const APPLY_OUTCOMES_BY_EVENT_V1: Readonly<Record<ApplyEventNameV1, readonly ApplyEventOutcomeV1[]>> = Object.freeze({
  STAGE_COPY: ["STAGE_COPIED"],
  VERIFY_STAGED: ["STAGE_VERIFIED"],
  SWITCH_POINTER: ["POINTER_SWITCHED"],
  VERIFY_POSTCONDITION: ["POSTCONDITION_VERIFIED", "POSTCONDITION_FAILED"],
  ROLLBACK_LKG: ["LKG_RESTORED"],
  CLEANUP: ["ZERO_RESIDUE"],
});

export const APPLY_SUCCESS_EVENT_SEQUENCE_V1: readonly ApplyEventNameV1[] = Object.freeze([
  "STAGE_COPY",
  "VERIFY_STAGED",
  "SWITCH_POINTER",
  "VERIFY_POSTCONDITION",
]);

export const APPLY_ROLLBACK_EVENT_SEQUENCE_V1: readonly ApplyEventNameV1[] = Object.freeze([
  "STAGE_COPY",
  "VERIFY_STAGED",
  "SWITCH_POINTER",
  "VERIFY_POSTCONDITION",
  "ROLLBACK_LKG",
  "CLEANUP",
]);

export type ApplyTerminalStateV1 = "VERIFIED" | "ROLLED_BACK_ZERO_RESIDUE";

export const APPLY_JOURNAL_GENESIS_DIGEST_V1 = createHash("sha256")
  .update("chimpmaera.update/apply-journal/genesis/v1")
  .digest("hex");

export type UpdateApplyJournalReasonCodeV1 =
  | "APPLY_JOURNAL_ACCEPTED"
  | "INVALID_JSON_DENIED"
  | "SCHEMA_DENIED"
  | "UNSUPPORTED_CONTRACT_VERSION_DENIED"
  | "INDEPENDENT_CONTEXT_DENIED"
  | "OPERATION_BINDING_DENIED"
  | "SEQUENCE_GAP_DENIED"
  | "TIME_REVERSAL_DENIED"
  | "DIGEST_MISMATCH_DENIED"
  | "EVENT_SEQUENCE_DENIED"
  | "ROLLBACK_INCOMPLETE_DENIED"
  | "TERMINAL_STATE_DENIED"
  | "TERMINAL_APPEND_DENIED";

export const UPDATE_APPLY_JOURNAL_EXIT_CODES_V1: Readonly<Record<UpdateApplyJournalReasonCodeV1, number>> = Object.freeze({
  APPLY_JOURNAL_ACCEPTED: 0,
  INVALID_JSON_DENIED: 71,
  SCHEMA_DENIED: 72,
  UNSUPPORTED_CONTRACT_VERSION_DENIED: 73,
  INDEPENDENT_CONTEXT_DENIED: 74,
  OPERATION_BINDING_DENIED: 75,
  SEQUENCE_GAP_DENIED: 76,
  TIME_REVERSAL_DENIED: 77,
  DIGEST_MISMATCH_DENIED: 78,
  EVENT_SEQUENCE_DENIED: 79,
  ROLLBACK_INCOMPLETE_DENIED: 80,
  TERMINAL_STATE_DENIED: 81,
  TERMINAL_APPEND_DENIED: 82,
});

const APPLY_DENIAL_ORDER: readonly UpdateApplyJournalReasonCodeV1[] = Object.freeze([
  "SCHEMA_DENIED",
  "UNSUPPORTED_CONTRACT_VERSION_DENIED",
  "INDEPENDENT_CONTEXT_DENIED",
  "OPERATION_BINDING_DENIED",
  "SEQUENCE_GAP_DENIED",
  "TIME_REVERSAL_DENIED",
  "DIGEST_MISMATCH_DENIED",
  "EVENT_SEQUENCE_DENIED",
  "ROLLBACK_INCOMPLETE_DENIED",
  "TERMINAL_STATE_DENIED",
  "TERMINAL_APPEND_DENIED",
]);

const JOURNAL_KEYS = Object.freeze([
  "schemaVersion",
  "mode",
  "operationDigest",
  "sourceLockDigest",
  "targetLockDigest",
  "revision",
  "entries",
  "terminalState",
  "journalDigest",
]);

const ENTRY_KEYS = Object.freeze([
  "eventType",
  "operationDigest",
  "sourceLockDigest",
  "targetLockDigest",
  "sequence",
  "timestampMs",
  "previousDigest",
  "outcome",
  "entryDigest",
]);

const CONTEXT_KEYS = Object.freeze([
  "expectedOperationDigest",
  "expectedSourceLockDigest",
  "expectedTargetLockDigest",
  "expectedRevision",
]);

export interface UpdateApplyJournalEntryV1 {
  readonly eventType: ApplyEventNameV1;
  readonly operationDigest: string;
  readonly sourceLockDigest: string;
  readonly targetLockDigest: string;
  readonly sequence: number;
  readonly timestampMs: number;
  readonly previousDigest: string;
  readonly outcome: ApplyEventOutcomeV1;
  readonly entryDigest: string;
}

export interface UpdateApplyJournalV1 {
  readonly schemaVersion: typeof UPDATE_APPLY_JOURNAL_SCHEMA_V1;
  readonly mode: "SYNTHETIC_LOCAL_ONLY";
  readonly operationDigest: string;
  readonly sourceLockDigest: string;
  readonly targetLockDigest: string;
  readonly revision: number;
  readonly entries: readonly UpdateApplyJournalEntryV1[];
  readonly terminalState: ApplyTerminalStateV1;
  readonly journalDigest: string;
}

export interface UpdateApplyJournalVerificationContextV1 {
  readonly expectedOperationDigest: string;
  readonly expectedSourceLockDigest: string;
  readonly expectedTargetLockDigest: string;
  readonly expectedRevision: number;
}

export type UpdateApplyJournalVerificationResultV1 =
  | { readonly outcome: "ACCEPTED"; readonly reasonCodes: readonly ["APPLY_JOURNAL_ACCEPTED"]; readonly exitCode: 0 }
  | { readonly outcome: "DENIED"; readonly reasonCodes: readonly UpdateApplyJournalReasonCodeV1[]; readonly exitCode: number };

export interface UpdateApplyJournalEventSpecV1 {
  readonly outcome: ApplyEventOutcomeV1;
  readonly timestampMs: number;
}

export interface UpdateApplyJournalOptionsV1 {
  readonly operationDigest: string;
  readonly sourceLockDigest: string;
  readonly targetLockDigest: string;
  readonly revision: number;
  readonly events: readonly UpdateApplyJournalEventSpecV1[];
}

const DIGEST = /^[a-f0-9]{64}$/;
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

function isPositiveRevision(value: unknown): value is number {
  return Number.isSafeInteger(value) && (value as number) > 0;
}

function isApplyEventName(value: unknown): value is ApplyEventNameV1 {
  return typeof value === "string" && (APPLY_EVENT_NAMES_V1 as readonly string[]).includes(value);
}

function isAllowedOutcome(eventName: ApplyEventNameV1, outcome: unknown): outcome is ApplyEventOutcomeV1 {
  return (APPLY_OUTCOMES_BY_EVENT_V1[eventName] as readonly string[]).includes(outcome as string);
}

/**
 * Computes a canonical SHA-256 content digest after rejecting unsafe JSON
 * shapes. This digest is not a signature and provides no trust by itself.
 */
export function updateApplyJournalDigestV1(value: Record<string, unknown>, digestKey: string): string {
  if (DANGEROUS_KEYS.has(digestKey)) throw new TypeError("UNSAFE_DIGEST_KEY");
  const cloned = safeJsonClone(value);
  if (!isPlainDataRecord(cloned)) throw new TypeError("UNSAFE_DIGEST_INPUT");
  const content = safeObject(Object.keys(cloned)
    .filter((key) => key !== digestKey)
    .map((key) => [key, cloned[key]] as const));
  return createHash("sha256").update(canonicalJson(content)).digest("hex");
}

// ---------------------------------------------------------------------------
// Deterministic fixture-only journal construction
// ---------------------------------------------------------------------------

function validEventSpec(value: unknown): value is UpdateApplyJournalEventSpecV1 {
  return exactKeys(value, ["outcome", "timestampMs"])
    && typeof value.outcome === "string"
    && isTimestamp(value.timestampMs);
}

/**
 * Builds a frozen synthetic apply journal for exactly one canonical path:
 * the success ladder (terminal VERIFIED) or the rollback ladder
 * (terminal ROLLED_BACK_ZERO_RESIDUE). Any other shape is rejected.
 */
export function buildUpdateApplyJournalV1(options: UpdateApplyJournalOptionsV1): UpdateApplyJournalV1 {
  let cloned: UpdateApplyJournalOptionsV1;
  try {
    cloned = safeJsonClone(options);
  } catch {
    throw new Error("INVALID_APPLY_JOURNAL_FIXTURE");
  }
  if (!exactKeys(cloned, ["operationDigest", "sourceLockDigest", "targetLockDigest", "revision", "events"])
    || !isDigest(cloned.operationDigest)
    || !isDigest(cloned.sourceLockDigest)
    || !isDigest(cloned.targetLockDigest)
    || !isPositiveRevision(cloned.revision)
    || !isDenseStandardArray(cloned.events)
    || (cloned.events.length !== 4 && cloned.events.length !== 6)
    || !cloned.events.every(validEventSpec)) {
    throw new Error("INVALID_APPLY_JOURNAL_FIXTURE");
  }
  const sequence = cloned.events.length === 4
    ? APPLY_SUCCESS_EVENT_SEQUENCE_V1
    : APPLY_ROLLBACK_EVENT_SEQUENCE_V1;
  const outcomesOk = cloned.events.every((spec, index) => isAllowedOutcome(sequence[index]!, spec.outcome))
    && (cloned.events.length === 4
      ? cloned.events[3]!.outcome === "POSTCONDITION_VERIFIED"
      : cloned.events[3]!.outcome === "POSTCONDITION_FAILED");
  const timestampsOk = cloned.events.every((spec, index) => index === 0
    || (spec.timestampMs as number) >= (cloned.events[index - 1]!.timestampMs as number));
  if (!outcomesOk || !timestampsOk) throw new Error("INVALID_APPLY_JOURNAL_FIXTURE");

  let previousDigest = APPLY_JOURNAL_GENESIS_DIGEST_V1;
  const entries = cloned.events.map((spec, index) => {
    const unsigned = safeObject([
      ["eventType", sequence[index]!],
      ["operationDigest", cloned.operationDigest],
      ["sourceLockDigest", cloned.sourceLockDigest],
      ["targetLockDigest", cloned.targetLockDigest],
      ["sequence", index + 1],
      ["timestampMs", spec.timestampMs],
      ["previousDigest", previousDigest],
      ["outcome", spec.outcome],
    ]);
    const entryDigest = updateApplyJournalDigestV1(unsigned, "entryDigest");
    previousDigest = entryDigest;
    return safeObject([...Object.entries(unsigned), ["entryDigest", entryDigest]]);
  });
  const terminalState: ApplyTerminalStateV1 = cloned.events.length === 4
    ? "VERIFIED"
    : "ROLLED_BACK_ZERO_RESIDUE";
  const unsignedJournal = safeObject([
    ["schemaVersion", UPDATE_APPLY_JOURNAL_SCHEMA_V1],
    ["mode", "SYNTHETIC_LOCAL_ONLY"],
    ["operationDigest", cloned.operationDigest],
    ["sourceLockDigest", cloned.sourceLockDigest],
    ["targetLockDigest", cloned.targetLockDigest],
    ["revision", cloned.revision],
    ["entries", entries],
    ["terminalState", terminalState],
  ]);
  const journalDigest = updateApplyJournalDigestV1(unsignedJournal, "journalDigest");
  const complete = safeObject([...Object.entries(unsignedJournal), ["journalDigest", journalDigest]]);
  return deepFreeze(complete) as unknown as UpdateApplyJournalV1;
}

// ---------------------------------------------------------------------------
// Fail-closed verification
// ---------------------------------------------------------------------------

function validEntry(value: unknown): value is UpdateApplyJournalEntryV1 {
  return exactKeys(value, ENTRY_KEYS)
    && isApplyEventName(value.eventType)
    && isAllowedOutcome(value.eventType as ApplyEventNameV1, value.outcome)
    && isDigest(value.operationDigest)
    && isDigest(value.sourceLockDigest)
    && isDigest(value.targetLockDigest)
    && isPositiveRevision(value.sequence)
    && isTimestamp(value.timestampMs)
    && isDigest(value.previousDigest)
    && isDigest(value.entryDigest);
}

function validJournal(value: unknown): value is UpdateApplyJournalV1 {
  return exactKeys(value, JOURNAL_KEYS)
    && value.schemaVersion === UPDATE_APPLY_JOURNAL_SCHEMA_V1
    && value.mode === "SYNTHETIC_LOCAL_ONLY"
    && isDigest(value.operationDigest)
    && isDigest(value.sourceLockDigest)
    && isDigest(value.targetLockDigest)
    && isPositiveRevision(value.revision)
    && isDenseStandardArray(value.entries)
    && value.entries.length > 0
    && value.entries.every(validEntry)
    && (value.terminalState === "VERIFIED" || value.terminalState === "ROLLED_BACK_ZERO_RESIDUE")
    && isDigest(value.journalDigest);
}

function validContext(value: unknown): value is UpdateApplyJournalVerificationContextV1 {
  return exactKeys(value, CONTEXT_KEYS)
    && isDigest(value.expectedOperationDigest)
    && isDigest(value.expectedSourceLockDigest)
    && isDigest(value.expectedTargetLockDigest)
    && isPositiveRevision(value.expectedRevision);
}

type ApplyChainShapeV1 = "SUCCESS" | "ROLLBACK" | "ROLLBACK_INCOMPLETE" | "TERMINAL_APPEND" | "INVALID";

function classifyApplyChain(
  names: readonly ApplyEventNameV1[],
  outcomes: readonly ApplyEventOutcomeV1[],
): ApplyChainShapeV1 {
  const hasSuccessHead = names.length >= 4
    && names[0] === "STAGE_COPY"
    && names[1] === "VERIFY_STAGED"
    && names[2] === "SWITCH_POINTER"
    && names[3] === "VERIFY_POSTCONDITION";
  const successTerminal = hasSuccessHead && names.length === 4 && outcomes[3] === "POSTCONDITION_VERIFIED";
  if (successTerminal) return "SUCCESS";
  const rollbackComplete = hasSuccessHead
    && outcomes[3] === "POSTCONDITION_FAILED"
    && names[4] === "ROLLBACK_LKG"
    && names[5] === "CLEANUP";
  if (rollbackComplete && names.length === 6) return "ROLLBACK";
  if (hasSuccessHead && outcomes[3] === "POSTCONDITION_VERIFIED" && names.length > 4) return "TERMINAL_APPEND";
  if (rollbackComplete && names.length > 6) return "TERMINAL_APPEND";
  if (names.length === 5 && hasSuccessHead && outcomes[3] === "POSTCONDITION_FAILED" && names[4] === "ROLLBACK_LKG") {
    return "ROLLBACK_INCOMPLETE";
  }
  return "INVALID";
}

function denyApply(reason: UpdateApplyJournalReasonCodeV1): UpdateApplyJournalVerificationResultV1 {
  return immutable({ outcome: "DENIED" as const, reasonCodes: [reason], exitCode: UPDATE_APPLY_JOURNAL_EXIT_CODES_V1[reason] });
}

export function verifyUpdateApplyJournalV1(
  value: unknown,
  context: UpdateApplyJournalVerificationContextV1 | undefined,
): UpdateApplyJournalVerificationResultV1 {
  let clonedValue: unknown;
  let clonedContext: unknown;
  try {
    clonedValue = safeJsonClone(value);
    clonedContext = context === undefined ? undefined : safeJsonClone(context);
  } catch {
    return denyApply("SCHEMA_DENIED");
  }
  if (!exactKeys(clonedValue, JOURNAL_KEYS)) {
    if (isPlainDataRecord(clonedValue)
      && clonedValue.schemaVersion !== undefined
      && clonedValue.schemaVersion !== UPDATE_APPLY_JOURNAL_SCHEMA_V1) {
      return denyApply("UNSUPPORTED_CONTRACT_VERSION_DENIED");
    }
    return denyApply("SCHEMA_DENIED");
  }
  if ((clonedValue as Record<string, unknown>).schemaVersion !== UPDATE_APPLY_JOURNAL_SCHEMA_V1) {
    return denyApply("UNSUPPORTED_CONTRACT_VERSION_DENIED");
  }
  if (!validJournal(clonedValue)) return denyApply("SCHEMA_DENIED");
  if (!validContext(clonedContext)) return denyApply("INDEPENDENT_CONTEXT_DENIED");

  const journal = clonedValue;
  const expected = clonedContext;
  const entries = journal.entries;
  const reasons = new Set<UpdateApplyJournalReasonCodeV1>();

  // Independent operation binding: fully re-digested forgeries cannot rename the operation.
  if (journal.operationDigest !== expected.expectedOperationDigest
    || journal.sourceLockDigest !== expected.expectedSourceLockDigest
    || journal.targetLockDigest !== expected.expectedTargetLockDigest) {
    reasons.add("OPERATION_BINDING_DENIED");
  }
  if (entries.some((entry) => entry.operationDigest !== journal.operationDigest
    || entry.sourceLockDigest !== journal.sourceLockDigest
    || entry.targetLockDigest !== journal.targetLockDigest)) {
    reasons.add("DIGEST_MISMATCH_DENIED");
  }

  // Sequence integrity: strictly 1..n and journal revision matching the independent expectation.
  if (entries.some((entry, index) => entry.sequence !== index + 1)) reasons.add("SEQUENCE_GAP_DENIED");
  if (journal.revision !== expected.expectedRevision) reasons.add("SEQUENCE_GAP_DENIED");

  if (entries.some((entry, index) => index > 0 && entry.timestampMs < entries[index - 1]!.timestampMs)) {
    reasons.add("TIME_REVERSAL_DENIED");
  }

  // Hash-chain integrity: genesis anchor, previous/entry/journal digests.
  if (entries[0]!.previousDigest !== APPLY_JOURNAL_GENESIS_DIGEST_V1
    || entries.some((entry, index) => index > 0 && entry.previousDigest !== entries[index - 1]!.entryDigest)
    || entries.some((entry) => updateApplyJournalDigestV1(entry as unknown as Record<string, unknown>, "entryDigest") !== entry.entryDigest)
    || updateApplyJournalDigestV1(journal as unknown as Record<string, unknown>, "journalDigest") !== journal.journalDigest) {
    reasons.add("DIGEST_MISMATCH_DENIED");
  }

  // Canonical event ladder: success stops after VERIFY_POSTCONDITION;
  // failure requires ROLLBACK_LKG then CLEANUP with zero-residue evidence.
  const shape = classifyApplyChain(
    entries.map((entry) => entry.eventType),
    entries.map((entry) => entry.outcome),
  );
  if (shape === "ROLLBACK_INCOMPLETE") reasons.add("ROLLBACK_INCOMPLETE_DENIED");
  else if (shape === "TERMINAL_APPEND") reasons.add("TERMINAL_APPEND_DENIED");
  else if (shape !== "SUCCESS" && shape !== "ROLLBACK") reasons.add("EVENT_SEQUENCE_DENIED");

  const expectedTerminal: ApplyTerminalStateV1 | null = shape === "SUCCESS"
    ? "VERIFIED"
    : shape === "ROLLBACK" ? "ROLLED_BACK_ZERO_RESIDUE" : null;
  if (journal.terminalState !== expectedTerminal) reasons.add("TERMINAL_STATE_DENIED");

  if (reasons.size > 0) {
    const reasonCodes = APPLY_DENIAL_ORDER.filter((reason) => reasons.has(reason));
    return immutable({
      outcome: "DENIED" as const,
      reasonCodes,
      exitCode: UPDATE_APPLY_JOURNAL_EXIT_CODES_V1[reasonCodes[0]!],
    });
  }
  return immutable({ outcome: "ACCEPTED" as const, reasonCodes: ["APPLY_JOURNAL_ACCEPTED"] as const, exitCode: 0 as const });
}

export function parseUpdateApplyJournalV1(
  json: string,
  context: UpdateApplyJournalVerificationContextV1 | undefined,
): UpdateApplyJournalVerificationResultV1 {
  try {
    return verifyUpdateApplyJournalV1(JSON.parse(json) as unknown, context);
  } catch {
    return denyApply("INVALID_JSON_DENIED");
  }
}