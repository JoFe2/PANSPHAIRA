/**
 * CKS-11 append-only governed receipt ledger (v1).
 *
 * This module appends canonical governed receipts to the append-only history
 * of one governed subject (a workflow or a function). Every entry —
 * historical or new — is a complete CKS-11 receipt verified and frozen by
 * verifyGovernedAssetReceiptV1; historical entries are immutable and
 * corrections are successor receipts linked via previousReceiptDigest, never
 * rewrites of history. Appends are bound exactly to the subject's workflow
 * and function dependency-set digests and to the receipt-digest chain of the
 * ledger. Mutation, replacement, foreign digest, duplicate identity and
 * noncanonical receipt attempts are fail-closed with deterministic denial
 * codes.
 *
 * This module validates and freezes records; it never promotes, activates,
 * deploys, or executes anything. Authority: NONE.
 */
import {
  governedAssetsDigestV1,
  governedAssetsRefSetDigestV1,
  verifyGovernedAssetReceiptV1,
  VALIDATION_REASON_CODES_V1,
  type AcceptedResultV1,
  type ExactRefV1,
  type GovernedAssetReceiptV1,
  type RejectedResultV1,
  type ValidationReasonCodeV1,
} from "./governed-assets-v1.js";

const DIGEST = /^[a-f0-9]{64}$/;
const DANGEROUS_KEYS = new Set(["__proto__", "prototype", "constructor"]);

const INPUT_KEYS = [
  "subjectKind",
  "subjectRef",
  "workflowDependencies",
  "functionDependencies",
  "historicalEntries",
  "newEntry",
] as const;

const SUBJECT_KINDS = ["WORKFLOW", "FUNCTION"] as const;
const WORKFLOW_SUBJECT_REF_KINDS = ["WORKFLOW_CANDIDATE", "GOVERNED_WORKFLOW"] as const;
const FUNCTION_SUBJECT_REF_KINDS = ["FUNCTION_CANDIDATE"] as const;
const WORKFLOW_DEPENDENCY_KINDS = ["WORKFLOW_CANDIDATE", "GOVERNED_WORKFLOW"] as const;
const FUNCTION_DEPENDENCY_KINDS = ["FUNCTION_CANDIDATE"] as const;

/** Field order and limits mirror the governed-asset exact ref contract. */
const EXACT_REF_KEYS = [
  "kind",
  "id",
  "schemaVersion",
  "version",
  "digestAlgorithm",
  "digest",
] as const;

type CodeSet = Set<ValidationReasonCodeV1>;
type SubjectKindV1 = (typeof SUBJECT_KINDS)[number];

export type GovernedReceiptSubjectKindV1 = SubjectKindV1;

/** One governed receipt-append request for a workflow or function subject. */
export interface GovernedReceiptLedgerInputV1 {
  readonly subjectKind: GovernedReceiptSubjectKindV1;
  readonly subjectRef: ExactRefV1;
  readonly workflowDependencies: readonly ExactRefV1[];
  readonly functionDependencies: readonly ExactRefV1[];
  /** Immutable historical receipt history, oldest first. */
  readonly historicalEntries: readonly GovernedAssetReceiptV1[];
  /** The canonical receipt being appended next. */
  readonly newEntry: GovernedAssetReceiptV1;
}

/** The frozen ledger state produced by an accepted append. */
export interface GovernedReceiptLedgerRecordV1 {
  readonly subjectKind: GovernedReceiptSubjectKindV1;
  readonly subjectRef: ExactRefV1;
  /** Exact immutable dependency bindings carried by every ledger revision. */
  readonly workflowDependencies: readonly ExactRefV1[];
  readonly functionDependencies: readonly ExactRefV1[];
  /** Complete immutable history including the appended entry, oldest first. */
  readonly entries: readonly GovernedAssetReceiptV1[];
  /** receiptDigest of the newest (appended) entry. */
  readonly headReceiptDigest: string;
  readonly entryCount: number;
  /** Canonical digest over subject identity and the ordered receipt-digest chain. */
  readonly ledgerDigest: string;
}

export type GovernedReceiptLedgerResultV1 =
  | AcceptedResultV1<GovernedReceiptLedgerRecordV1>
  | RejectedResultV1;

const REJECTION_EXIT_BASE = 200;
const NONE_REASON_CODES: readonly ["NONE"] = Object.freeze(["NONE"] as const);

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
    isExactString(value, 64) &&
    !/[~^*<>=|&,\s]/.test(value) &&
    !/(?:^|[./_-])(?:latest|range|x)(?=$|[./_-])/i.test(value)
  );
}

function isDigest(value: unknown): value is string {
  return typeof value === "string" && DIGEST.test(value);
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

/**
 * Closed-shape exact ref validation. Denial codes mirror the governed-asset
 * ref contract: closed kind set, bounded strings, pinned digest algorithm.
 */
function checkExactRef(
  record: Record<string, unknown>,
  kinds: readonly string[],
  codes: CodeSet,
): boolean {
  const actual = new Set(Object.keys(record));
  let shapeOk = true;
  for (const key of EXACT_REF_KEYS) {
    if (!actual.has(key)) {
      codes.add("MISSING_FIELD");
      shapeOk = false;
    }
  }
  for (const key of [...actual].sort()) {
    if (!(EXACT_REF_KEYS as readonly string[]).includes(key)) {
      codes.add("UNKNOWN_FIELD");
      shapeOk = false;
    }
  }
  if (!shapeOk) return false;
  if (!isExactString(record["kind"], 64) || !kinds.includes(record["kind"] as string)) {
    codes.add("REF_KIND_MISMATCH");
    return false;
  }
  if (!isExactString(record["id"], 128) || !isExactString(record["schemaVersion"], 64)) {
    codes.add("BAD_STRING");
    return false;
  }
  if (!isExactVersion(record["version"])) {
    codes.add("BAD_STRING");
    return false;
  }
  if (record["digestAlgorithm"] !== "SHA-256") {
    codes.add("BAD_DIGEST");
    return false;
  }
  if (!isDigest(record["digest"])) {
    codes.add("BAD_DIGEST");
    return false;
  }
  return true;
}

/**
 * Validate a dense dependency array of exact refs (closed kind set, no
 * duplicate (kind, id, version, digest) tuples) and return its canonical
 * set digest, or null when the array is not safe to digest.
 */
function validateDependencySet(value: unknown, kinds: readonly string[], codes: CodeSet): string | null {
  if (!isDenseArray(value)) {
    codes.add("BAD_SHAPE");
    return null;
  }
  const seen = new Set<string>();
  for (const ref of value) {
    if (!isPlainRecord(ref)) {
      codes.add("BAD_SHAPE");
      continue;
    }
    if (!checkExactRef(ref, kinds, codes)) continue;
    const key = [ref["kind"], ref["id"], ref["version"], ref["digest"]].join(" ");
    if (seen.has(key)) codes.add("DUPLICATE_REF");
    seen.add(key);
  }
  try {
    return governedAssetsRefSetDigestV1(value);
  } catch {
    codes.add("BAD_SHAPE");
    return null;
  }
}

/**
 * House finalization: ordered denial codes in VALIDATION_REASON_CODES_V1
 * order and a stable exit code derived from the leading denial code.
 */
function finalize(
  codes: CodeSet,
  record: GovernedReceiptLedgerRecordV1 | null,
): GovernedReceiptLedgerResultV1 {
  if (codes.size === 0 && record !== null) {
    return {
      outcome: "ACCEPTED" as const,
      reasonCodes: NONE_REASON_CODES,
      exitCode: 0,
      record: immutable(record),
    };
  }
  const ordered = VALIDATION_REASON_CODES_V1.filter((code) => codes.has(code));
  const lead = ordered[0];
  const exitCode = lead === undefined ? REJECTION_EXIT_BASE : REJECTION_EXIT_BASE + ordered.indexOf(lead) + 1;
  return { outcome: "REJECTED" as const, reasonCodes: ordered, exitCode };
}

function ledgerDigestPayload(
  subjectKind: SubjectKindV1,
  subjectRef: ExactRefV1,
  workflowDependencies: readonly ExactRefV1[],
  functionDependencies: readonly ExactRefV1[],
  receiptDigests: readonly string[],
): Record<string, unknown> {
  return {
    subjectKind,
    subjectRef,
    workflowDependencies,
    functionDependencies,
    receiptDigests,
  };
}

/**
 * Append one canonical governed receipt to the subject's append-only
 * receipt ledger.
 *
 * Every entry (historical and new) must be a fully canonical receipt per
 * verifyGovernedAssetReceiptV1, bound to the same subject ref and to the
 * exact workflow/function dependency-set digests given in the input. The
 * genesis entry has previousReceiptDigest null; every later entry's
 * previousReceiptDigest equals the prior entry's receiptDigest. Receipt
 * identities are unique across the ledger: replacement, duplicate identity,
 * foreign digest, mutation, and noncanonical receipts are denied. The
 * returned record is deep-frozen; inputs are never mutated.
 */
export function appendGovernedReceiptV1(input: unknown): GovernedReceiptLedgerResultV1 {
  const codes: CodeSet = new Set();
  if (!isPlainRecord(input)) {
    codes.add("BAD_SHAPE");
    return finalize(codes, null);
  }
  let shapeOk = true;
  for (const key of INPUT_KEYS) {
    if (!Object.hasOwn(input, key)) {
      codes.add("MISSING_FIELD");
      shapeOk = false;
    }
  }
  for (const key of Object.keys(input).sort()) {
    if (!(INPUT_KEYS as readonly string[]).includes(key)) {
      codes.add("UNKNOWN_FIELD");
      shapeOk = false;
    }
  }
  if (!shapeOk) return finalize(codes, null);

  const subjectKind = input["subjectKind"];
  const subjectKindValid =
    isExactString(subjectKind, 64) && SUBJECT_KINDS.includes(subjectKind as SubjectKindV1);
  if (!subjectKindValid) codes.add("INVALID_CONTRACT");

  const subjectRef = input["subjectRef"];
  const workflowDependencies = input["workflowDependencies"];
  const functionDependencies = input["functionDependencies"];
  const historicalEntries = input["historicalEntries"];
  const newEntry = input["newEntry"];

  let subjectRefDigest: string | null = null;
  if (!isPlainRecord(subjectRef)) {
    codes.add("BAD_SHAPE");
  } else {
    const subjectRefKinds =
      subjectKindValid && subjectKind === "FUNCTION"
        ? FUNCTION_SUBJECT_REF_KINDS
        : WORKFLOW_SUBJECT_REF_KINDS;
    if (checkExactRef(subjectRef, subjectRefKinds, codes) && subjectKindValid) {
      subjectRefDigest = governedAssetsDigestV1(subjectRef);
    }
  }

  const wfDigest = validateDependencySet(workflowDependencies, WORKFLOW_DEPENDENCY_KINDS, codes);
  const fnDigest = validateDependencySet(functionDependencies, FUNCTION_DEPENDENCY_KINDS, codes);

  const rawEntries: unknown[] = [];
  if (!isDenseArray(historicalEntries)) {
    codes.add("BAD_SHAPE");
  } else {
    rawEntries.push(...historicalEntries);
  }
  rawEntries.push(newEntry);

  const typedEntries: GovernedAssetReceiptV1[] = [];
  const receiptIds = new Set<string>();
  const receiptDigests = new Set<string>();
  for (const raw of rawEntries) {
    if (isPlainRecord(raw)) {
      const rawId = raw["receiptId"];
      if (typeof rawId === "string") {
        if (receiptIds.has(rawId)) codes.add("DUPLICATE_REF");
        receiptIds.add(rawId);
      }
    }
    const verified = verifyGovernedAssetReceiptV1(raw);
    if (verified.outcome === "REJECTED") {
      for (const code of verified.reasonCodes) codes.add(code);
      continue;
    }
    const entry = verified.record;
    if (receiptDigests.has(entry.receiptDigest)) codes.add("DUPLICATE_REF");
    receiptDigests.add(entry.receiptDigest);
    typedEntries.push(entry);
    if (subjectRefDigest !== null && governedAssetsDigestV1(entry.subjectRef) !== subjectRefDigest) {
      codes.add("RECEIPT_BINDING_INVALID");
    }
    if (wfDigest !== null && entry.workflowDependencySetDigest !== wfDigest) {
      codes.add("DEPENDENCY_SET_DIGEST_MISMATCH");
    }
    if (fnDigest !== null && entry.functionDependencySetDigest !== fnDigest) {
      codes.add("DEPENDENCY_SET_DIGEST_MISMATCH");
    }
  }

  // Genesis and chain-link checks apply to a fully canonical ledger only;
  // any entry-level denial already accumulates on top.
  if (typedEntries.length === rawEntries.length && typedEntries.length > 0) {
    const genesis = typedEntries[0];
    if (genesis === undefined || genesis.previousReceiptDigest !== null) {
      codes.add("RECEIPT_BINDING_INVALID");
    }
    for (let index = 1; index < typedEntries.length; index += 1) {
      const previous = typedEntries[index - 1];
      const current = typedEntries[index];
      if (
        previous === undefined ||
        current === undefined ||
        current.previousReceiptDigest !== previous.receiptDigest
      ) {
        codes.add("RECEIPT_BINDING_INVALID");
      }
    }
  }

  if (codes.size === 0) {
    const head = typedEntries[typedEntries.length - 1];
    if (head !== undefined) {
      const ledgerDigest = governedAssetsDigestV1({
        ...ledgerDigestPayload(
          subjectKind as SubjectKindV1,
          subjectRef as unknown as ExactRefV1,
          workflowDependencies as ExactRefV1[],
          functionDependencies as ExactRefV1[],
          typedEntries.map((entry) => entry.receiptDigest),
        ),
      });
      return finalize(codes, {
        subjectKind: subjectKind as SubjectKindV1,
        subjectRef: subjectRef as ExactRefV1,
        workflowDependencies: workflowDependencies as ExactRefV1[],
        functionDependencies: functionDependencies as ExactRefV1[],
        entries: typedEntries,
        headReceiptDigest: head.receiptDigest,
        entryCount: typedEntries.length,
        ledgerDigest,
      });
    }
  }
  return finalize(codes, null);
}

/** Descriptive alias for callers that name the operation as an append. */
export const recordGovernedReceiptAppendV1 = appendGovernedReceiptV1;

/**
 * Canonical digest of a frozen ledger record's identity (subject + ordered
 * receipt-digest chain). The record must already be an accepted ledger
 * record; malformed digests throw TypeError.
 */
export function governedReceiptLedgerDigestV1(record: unknown): string {
  const ledger = record as Partial<Record<string, unknown>> | null | undefined;
  if (
    ledger === null ||
    typeof ledger !== "object" ||
    Array.isArray(ledger) ||
    !isExactString(ledger["subjectKind"] as unknown, 64) ||
    !isSafeInteger(ledger["entryCount"] as unknown) ||
    !isDigest(ledger["headReceiptDigest"]) ||
    !isDigest(ledger["ledgerDigest"])
  ) {
    throw new TypeError("INVALID_LEDGER_RECORD");
  }
  const entries = ledger["entries"];
  const workflowDependencies = ledger["workflowDependencies"];
  const functionDependencies = ledger["functionDependencies"];
  if (
    !isDenseArray(entries) ||
    entries.length !== (ledger["entryCount"] as number) ||
    !isDenseArray(workflowDependencies) ||
    !isDenseArray(functionDependencies) ||
    !isPlainRecord(ledger["subjectRef"])
  ) {
    throw new TypeError("INVALID_LEDGER_RECORD");
  }
  const receiptDigests = entries.map((entry) => {
    if (!isPlainRecord(entry) || !isDigest(entry["receiptDigest"])) {
      throw new TypeError("INVALID_LEDGER_RECORD");
    }
    return entry["receiptDigest"];
  });
  if (receiptDigests.length === 0 || receiptDigests[receiptDigests.length - 1] !== ledger["headReceiptDigest"]) {
    throw new TypeError("INVALID_LEDGER_RECORD");
  }
  return governedAssetsDigestV1(
    ledgerDigestPayload(
      ledger["subjectKind"] as SubjectKindV1,
      ledger["subjectRef"] as unknown as ExactRefV1,
      workflowDependencies as ExactRefV1[],
      functionDependencies as ExactRefV1[],
      receiptDigests,
    ),
  );
}
