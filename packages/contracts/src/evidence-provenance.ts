import { createHash } from "node:crypto";
import { types } from "node:util";

import { canonicalJson } from "./canonical-json.js";

/**
 * EVID-PROV-01 — closed v1 schema for inspectable evidence independence and
 * verifier provenance.
 *
 * A provenance record binds, in one closed content-digested document:
 * the claim, the exact commit/tree head, the inputs, the oracle, the
 * verifier implementation/tool/model identity class, the invocation digest,
 * the environment, the timestamp, the CI run/job URL/ID, and the result
 * digest, plus an explicit evidence class.
 *
 * The evidence classes are SELF_GENERATED, ISOLATED_INTERNAL_REVIEW,
 * THIRD_PARTY_EXECUTION_PLATFORM and EXTERNAL_INDEPENDENT_VALIDATION. Each
 * class carries its own support requirements and no class implies a
 * stronger one: claiming a class whose support is absent fails closed with
 * a structured denial.
 *
 * Verification never trusts caller-authored fields. It recomputes the
 * record content digest, then compares the recorded bindings against a
 * caller-supplied recomputation of the deterministic content and provider
 * state. Self-attested PASS/result fields, forged reviewer identities,
 * substituted oracle/input/head/run state, missing provider readback and
 * class promotion all return a structured DENIED (never an exception).
 *
 * The public review receipt projects only safe method/provenance fields and
 * the exact-head binding: no statement (hidden reasoning), no invocation
 * digest, no oracle/inputs detail, no reviewer handles, no environment
 * detail. Any secret-looking or private-path material in the projected
 * fields, and any non-public data class, fail closed.
 *
 * Legacy receipts migrate to the honest weakest class (SELF_GENERATED); the
 * only oracle that can be bound is the legacy receipt's own recomputed
 * bytes, and the legacy self-attested result field is ignored and never
 * re-represented. No retrospective external-independence claim is invented.
 */

const INVALID = Symbol("EVIDENCE_PROVENANCE_INVALID");

export const EVIDENCE_PROVENANCE_RECORD_SCHEMA_V1 = "chimpmaera.evidence/provenance-record/v1" as const;
export const EVIDENCE_PROVENANCE_PUBLIC_RECEIPT_SCHEMA_V1 = "chimpmaera.evidence/public-review-receipt/v1" as const;
export const EVIDENCE_PROVENANCE_VERSION_V1 = "1.0.0" as const;
export const EVIDENCE_PROVENANCE_NONE = "NONE" as const;

export type EvidenceProvenanceClassV1 =
  | "SELF_GENERATED"
  | "ISOLATED_INTERNAL_REVIEW"
  | "THIRD_PARTY_EXECUTION_PLATFORM"
  | "EXTERNAL_INDEPENDENT_VALIDATION";

export type EvidenceProvenanceMethodV1 =
  | "DETERMINISTIC_RECOMPUTATION"
  | "INDEPENDENT_REVIEW"
  | "PLATFORM_EXECUTION"
  | "EXTERNAL_VALIDATION";

export type EvidenceProvenanceVerifierIdentityClassV1 =
  | "DETERMINISTIC_TOOL"
  | "SELF_HOSTED_MODEL"
  | "EXTERNAL_HOSTED_MODEL"
  | "INDEPENDENT_REVIEWER";

export type EvidenceProvenanceDataClassV1 = "PUBLIC_SYNTHETIC" | "OWNER_PRIVATE_REFERENCE";

export type EvidenceProvenanceCiProviderV1 = "GITHUB_ACTIONS" | "NONE";

export type EvidenceProvenanceReasonCodeV1 =
  | "EVIDENCE_PROVENANCE_VERIFIED"
  | "EVIDENCE_PROVENANCE_SCHEMA_DENIED"
  | "EVIDENCE_PROVENANCE_CONTENT_DIGEST_DENIED"
  | "EVIDENCE_PROVENANCE_INPUT_SUBSTITUTION_DENIED"
  | "EVIDENCE_PROVENANCE_ORACLE_SUBSTITUTION_DENIED"
  | "EVIDENCE_PROVENANCE_HEAD_SUBSTITUTION_DENIED"
  | "EVIDENCE_PROVENANCE_RUN_SUBSTITUTION_DENIED"
  | "EVIDENCE_PROVENANCE_RESULT_DIGEST_DENIED"
  | "EVIDENCE_PROVENANCE_SELF_SIGNED_PASS_DENIED"
  | "EVIDENCE_PROVENANCE_FORGED_REVIEWER_IDENTITY_DENIED"
  | "EVIDENCE_PROVENANCE_MISSING_PROVIDER_READBACK_DENIED"
  | "EVIDENCE_PROVENANCE_CLASS_PROMOTION_DENIED"
  | "EVIDENCE_PROVENANCE_METHOD_CLASS_MISMATCH_DENIED"
  | "EVIDENCE_PROVENANCE_RECEIPT_UNVERIFIED_DENIED"
  | "EVIDENCE_PROVENANCE_DATA_CLASS_DENIED"
  | "EVIDENCE_PROVENANCE_REDACTION_DENIED";

type DefectCode = Exclude<EvidenceProvenanceReasonCodeV1, "EVIDENCE_PROVENANCE_VERIFIED">;

export const EVIDENCE_PROVENANCE_REASON_CODES_V1 = Object.freeze([
  "EVIDENCE_PROVENANCE_VERIFIED",
  "EVIDENCE_PROVENANCE_SCHEMA_DENIED",
  "EVIDENCE_PROVENANCE_CONTENT_DIGEST_DENIED",
  "EVIDENCE_PROVENANCE_INPUT_SUBSTITUTION_DENIED",
  "EVIDENCE_PROVENANCE_ORACLE_SUBSTITUTION_DENIED",
  "EVIDENCE_PROVENANCE_HEAD_SUBSTITUTION_DENIED",
  "EVIDENCE_PROVENANCE_RUN_SUBSTITUTION_DENIED",
  "EVIDENCE_PROVENANCE_RESULT_DIGEST_DENIED",
  "EVIDENCE_PROVENANCE_SELF_SIGNED_PASS_DENIED",
  "EVIDENCE_PROVENANCE_FORGED_REVIEWER_IDENTITY_DENIED",
  "EVIDENCE_PROVENANCE_MISSING_PROVIDER_READBACK_DENIED",
  "EVIDENCE_PROVENANCE_CLASS_PROMOTION_DENIED",
  "EVIDENCE_PROVENANCE_METHOD_CLASS_MISMATCH_DENIED",
  "EVIDENCE_PROVENANCE_RECEIPT_UNVERIFIED_DENIED",
  "EVIDENCE_PROVENANCE_DATA_CLASS_DENIED",
  "EVIDENCE_PROVENANCE_REDACTION_DENIED",
] as const) as readonly EvidenceProvenanceReasonCodeV1[];

export const EVIDENCE_PROVENANCE_CLASSES_V1 = Object.freeze([
  "SELF_GENERATED",
  "ISOLATED_INTERNAL_REVIEW",
  "THIRD_PARTY_EXECUTION_PLATFORM",
  "EXTERNAL_INDEPENDENT_VALIDATION",
] as const) as readonly EvidenceProvenanceClassV1[];

export const EVIDENCE_PROVENANCE_METHODS_V1 = Object.freeze([
  "DETERMINISTIC_RECOMPUTATION",
  "INDEPENDENT_REVIEW",
  "PLATFORM_EXECUTION",
  "EXTERNAL_VALIDATION",
] as const) as readonly EvidenceProvenanceMethodV1[];

export const EVIDENCE_PROVENANCE_VERIFIER_IDENTITY_CLASSES_V1 = Object.freeze([
  "DETERMINISTIC_TOOL",
  "SELF_HOSTED_MODEL",
  "EXTERNAL_HOSTED_MODEL",
  "INDEPENDENT_REVIEWER",
] as const) as readonly EvidenceProvenanceVerifierIdentityClassV1[];

/**
 * Each class names exactly one method and no two classes share a method:
 * the mapping is a bijection, so no class implies a stronger one.
 */
export const EVIDENCE_PROVENANCE_CLASS_METHOD_V1 = Object.freeze({
  SELF_GENERATED: "DETERMINISTIC_RECOMPUTATION",
  ISOLATED_INTERNAL_REVIEW: "INDEPENDENT_REVIEW",
  THIRD_PARTY_EXECUTION_PLATFORM: "PLATFORM_EXECUTION",
  EXTERNAL_INDEPENDENT_VALIDATION: "EXTERNAL_VALIDATION",
} as const) satisfies Record<EvidenceProvenanceClassV1, EvidenceProvenanceMethodV1>;

export interface EvidenceProvenanceRecordV1 {
  readonly schemaVersion: typeof EVIDENCE_PROVENANCE_RECORD_SCHEMA_V1;
  readonly recordId: string;
  readonly dataClass: EvidenceProvenanceDataClassV1;
  readonly claim: { readonly claimId: string; readonly statement: string };
  readonly evidenceClass: EvidenceProvenanceClassV1;
  readonly head: { readonly commitSha: string; readonly treeSha: string };
  readonly inputs: { readonly inputsDigest: string };
  readonly oracle: { readonly oracleId: string; readonly oracleDigest: string };
  readonly verifier: {
    readonly implementation: string;
    readonly tool: string;
    readonly model: string;
    readonly identityClass: EvidenceProvenanceVerifierIdentityClassV1;
  };
  readonly invocationDigest: string;
  readonly environment: { readonly platform: string; readonly runtime: string };
  readonly timestamp: string;
  readonly ci: {
    readonly provider: EvidenceProvenanceCiProviderV1;
    readonly runId: string;
    readonly runUrl: string;
    readonly jobId: string;
  };
  readonly provider: {
    readonly organization: string;
    readonly readbackUrl: string;
    readonly readbackDigest: string;
    readonly readbackTimestamp: string;
  };
  readonly review: {
    readonly producerId: string;
    readonly producerOrganization: string;
    readonly reviewerId: string;
    readonly reviewerIdentityDigest: string;
  };
  readonly method: EvidenceProvenanceMethodV1;
  readonly resultDigest: string;
  readonly contentDigest: string;
}

export interface EvidenceProvenanceRecomputationV1 {
  readonly inputsDigest: string;
  readonly oracleDigest: string;
  readonly head: { readonly commitSha: string; readonly treeSha: string };
  readonly ciRunId: string;
  readonly providerReadbackDigest: string;
  readonly resultDigest: string;
}

export type EvidenceProvenanceVerificationV1 =
  | {
      readonly outcome: "VERIFIED";
      readonly reasonCodes: readonly ["EVIDENCE_PROVENANCE_VERIFIED"];
      readonly evidenceClass: EvidenceProvenanceClassV1;
      readonly contentDigest: string;
    }
  | { readonly outcome: "DENIED"; readonly reasonCodes: readonly EvidenceProvenanceReasonCodeV1[] };

export type EvidenceProvenanceBuildResultV1 =
  | { readonly outcome: "BUILT"; readonly record: EvidenceProvenanceRecordV1 }
  | { readonly outcome: "DENIED"; readonly reasonCodes: readonly EvidenceProvenanceReasonCodeV1[] };

export interface EvidenceProvenancePublicReceiptV1 {
  readonly schemaVersion: typeof EVIDENCE_PROVENANCE_PUBLIC_RECEIPT_SCHEMA_V1;
  readonly recordId: string;
  readonly claimId: string;
  readonly evidenceClass: EvidenceProvenanceClassV1;
  readonly method: EvidenceProvenanceMethodV1;
  readonly head: { readonly commitSha: string; readonly treeSha: string };
  readonly verifier: {
    readonly implementation: string;
    readonly tool: string;
    readonly model: string;
    readonly identityClass: EvidenceProvenanceVerifierIdentityClassV1;
  };
  readonly ci: {
    readonly provider: EvidenceProvenanceCiProviderV1;
    readonly runId: string;
    readonly runUrl: string;
    readonly jobId: string;
  };
  readonly provider: {
    readonly organization: string;
    readonly readbackUrl: string;
    readonly readbackDigest: string;
    readonly readbackTimestamp: string;
  };
  readonly dataClass: EvidenceProvenanceDataClassV1;
  readonly timestamp: string;
  readonly resultDigest: string;
  readonly contentDigest: string;
  readonly receiptDigest: string;
}

export type EvidenceProvenancePublicReceiptResultV1 =
  | { readonly outcome: "ISSUED"; readonly receipt: EvidenceProvenancePublicReceiptV1 }
  | { readonly outcome: "DENIED"; readonly reasonCodes: readonly EvidenceProvenanceReasonCodeV1[] };

export interface EvidenceProvenanceLegacyReceiptInputV1 {
  readonly receiptId: string;
  readonly receiptDigest: string;
  readonly legacyResult: string;
  readonly statement: string;
  readonly head: { readonly commitSha: string; readonly treeSha: string };
  readonly verifier: {
    readonly implementation: string;
    readonly tool: string;
    readonly model: string;
    readonly identityClass: "DETERMINISTIC_TOOL" | "SELF_HOSTED_MODEL";
  };
  readonly environment: { readonly platform: string; readonly runtime: string };
  readonly timestamp: string;
  readonly dataClass: EvidenceProvenanceDataClassV1;
}

export type EvidenceProvenanceMigrationResultV1 =
  | {
      readonly outcome: "MIGRATED";
      readonly record: EvidenceProvenanceRecordV1;
      readonly nonclaims: readonly ["WEAKEST_CLASS_ASSIGNED", "LEGACY_SELF_SIGNED_RESULT_IGNORED"];
    }
  | { readonly outcome: "DENIED"; readonly reasonCodes: readonly EvidenceProvenanceReasonCodeV1[] };

const CODE = {
  SCHEMA: "EVIDENCE_PROVENANCE_SCHEMA_DENIED",
  CONTENT_DIGEST: "EVIDENCE_PROVENANCE_CONTENT_DIGEST_DENIED",
  INPUT_SUBSTITUTION: "EVIDENCE_PROVENANCE_INPUT_SUBSTITUTION_DENIED",
  ORACLE_SUBSTITUTION: "EVIDENCE_PROVENANCE_ORACLE_SUBSTITUTION_DENIED",
  HEAD_SUBSTITUTION: "EVIDENCE_PROVENANCE_HEAD_SUBSTITUTION_DENIED",
  RUN_SUBSTITUTION: "EVIDENCE_PROVENANCE_RUN_SUBSTITUTION_DENIED",
  RESULT_DIGEST: "EVIDENCE_PROVENANCE_RESULT_DIGEST_DENIED",
  SELF_SIGNED: "EVIDENCE_PROVENANCE_SELF_SIGNED_PASS_DENIED",
  FORGED_REVIEWER: "EVIDENCE_PROVENANCE_FORGED_REVIEWER_IDENTITY_DENIED",
  MISSING_READBACK: "EVIDENCE_PROVENANCE_MISSING_PROVIDER_READBACK_DENIED",
  PROMOTION: "EVIDENCE_PROVENANCE_CLASS_PROMOTION_DENIED",
  METHOD_MISMATCH: "EVIDENCE_PROVENANCE_METHOD_CLASS_MISMATCH_DENIED",
  RECEIPT_UNVERIFIED: "EVIDENCE_PROVENANCE_RECEIPT_UNVERIFIED_DENIED",
  DATA_CLASS: "EVIDENCE_PROVENANCE_DATA_CLASS_DENIED",
  REDACTION: "EVIDENCE_PROVENANCE_REDACTION_DENIED",
} as const satisfies Record<string, DefectCode>;

const TOP_KEYS = [
  "schemaVersion", "recordId", "dataClass", "claim", "evidenceClass", "head",
  "inputs", "oracle", "verifier", "invocationDigest", "environment",
  "timestamp", "ci", "provider", "review", "method", "resultDigest", "contentDigest",
] as const;
const INPUT_KEYS = [
  "recordId", "dataClass", "claim", "evidenceClass", "head",
  "inputs", "oracle", "verifier", "invocationDigest", "environment",
  "timestamp", "ci", "provider", "review", "method", "resultDigest",
] as const;
const CLAIM_KEYS = ["claimId", "statement"] as const;
const HEAD_KEYS = ["commitSha", "treeSha"] as const;
const INPUTS_KEYS = ["inputsDigest"] as const;
const ORACLE_KEYS = ["oracleId", "oracleDigest"] as const;
const VERIFIER_KEYS = ["implementation", "tool", "model", "identityClass"] as const;
const ENVIRONMENT_KEYS = ["platform", "runtime"] as const;
const CI_KEYS = ["provider", "runId", "runUrl", "jobId"] as const;
const PROVIDER_KEYS = ["organization", "readbackUrl", "readbackDigest", "readbackTimestamp"] as const;
const REVIEW_KEYS = ["producerId", "producerOrganization", "reviewerId", "reviewerIdentityDigest"] as const;
const NESTED_OBJECT_KEYS = ["claim", "head", "inputs", "oracle", "verifier", "environment", "ci", "provider", "review"] as const;
const RECOMPUTATION_KEYS = ["inputsDigest", "oracleDigest", "head", "ciRunId", "providerReadbackDigest", "resultDigest"] as const;
const VERIFICATION_KEYS = ["outcome", "reasonCodes", "evidenceClass", "contentDigest"] as const;
const MIGRATION_KEYS = [
  "receiptId", "receiptDigest", "legacyResult", "statement", "head",
  "verifier", "environment", "timestamp", "dataClass",
] as const;

/**
 * Field names whose presence anywhere in the record is self-attestation.
 * A closure test recomputes truth; it does not read a PASS the caller wrote.
 */
const SELF_SIGNED_KEYS: ReadonlySet<string> = new Set([
  "pass", "PASS", "result", "verified", "selfAttested", "ok", "outcome", "status",
]);

const HEX64 = /^[a-f0-9]{64}$/;
const SHA40 = /^[a-f0-9]{40}$/;
const RFC3339 = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,9})?(?:Z|[+-]\d{2}:\d{2})$/;
const ASCII_VISIBLE = /^[\x21-\x7E]+$/;
const GITHUB_RUN_URL = /^https:\/\/github\.com\/[\w.-]+\/[\w.-]+\/actions\/(?:runs|workflows)\/\d+/;
const HTTPS_URL = /^https:\/\/\S+$/;

/**
 * Secret and private-path detectors for the public receipt projection. Any
 * hit fails closed with a structured denial; the receipt is never issued.
 */
const SECRET_PATTERNS: ReadonlyArray<readonly [RegExp, string]> = [
  [/gh[pousr]_[A-Za-z0-9]{16,}/, "github_token"],
  [/github_pat_[A-Za-z0-9_]{16,}/, "github_pat"],
  [/\bAKIA[A-Z0-9]{16}\b/, "aws_access_key"],
  [/\bsk-[A-Za-z0-9_-]{16,}\b/, "openai_key"],
  [/\bxox[baprs]-[A-Za-z0-9-]{8,}\b/, "slack_token"],
  [/-----BEGIN [A-Z0-9 ]*PRIVATE KEY-----/, "private_key"],
  [/\bBearer [A-Za-z0-9._~+/-]{16,}/, "bearer_token"],
  [/^[~\\/]/, "private_path"],
  [/^[A-Za-z]:[\\/]/, "private_path"],
  [/[/\\](?:Users|home|Documents|Downloads|secrets|\.ssh|\.aws)(?:[/\\]|$)/i, "private_path"],
  [/\b(?:api[_-]?key|password|passwd|secret|token|access[_-]?key)\b\s*[:=]/i, "credential_assignment"],
];

// --- plain-JSON guards (fail-closed; never invoke a trap) -------------------

function deepPlain(value: unknown, seen: Set<unknown>): unknown {
  if (value === null) return null;
  if (typeof value === "string" || typeof value === "boolean") return value;
  if (typeof value === "number") return Number.isFinite(value) ? value : INVALID;
  if (typeof value !== "object") return INVALID;
  try {
    if (types.isProxy(value)) return INVALID;
    if (seen.has(value)) return INVALID;
    seen.add(value);
    if (Array.isArray(value)) {
      const entries: unknown[] = [];
      for (const item of value) {
        const child = deepPlain(item, seen);
        if (child === INVALID) return INVALID;
        entries.push(child);
      }
      return entries;
    }
    if (Object.getPrototypeOf(value) !== Object.prototype) return INVALID;
    const record = value as Record<string, unknown>;
    const out: Record<string, unknown> = {};
    for (const key of Object.keys(record)) {
      const property = Object.getOwnPropertyDescriptor(record, key);
      if (property === undefined || property.get !== undefined || property.set !== undefined) return INVALID;
      const child = deepPlain(record[key], seen);
      if (child === INVALID) return INVALID;
      out[key] = child;
    }
    return out;
  } catch {
    return INVALID;
  }
}

function plainObject(value: unknown): Record<string, unknown> | null {
  const plain = deepPlain(value, new Set());
  return plain !== null && typeof plain === "object" && !Array.isArray(plain)
    ? (plain as Record<string, unknown>)
    : null;
}

function digestHex(value: unknown): string {
  return createHash("sha256").update(canonicalJson(value), "utf8").digest("hex");
}

function freeze<T>(value: T): T {
  if (Array.isArray(value)) {
    for (const entry of value) freeze(entry);
    Object.freeze(value);
    return value;
  }
  if (value !== null && typeof value === "object") {
    for (const entry of Object.values(value as Record<string, unknown>)) freeze(entry);
    Object.freeze(value);
    return value;
  }
  return value;
}

function asExactRecord(value: unknown, keys: readonly string[]): Record<string, unknown> | null {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;
  if (canonicalJson(Object.keys(record).sort()) !== canonicalJson([...keys].sort())) return null;
  return record;
}

function deny(defects: ReadonlySet<DefectCode>): {
  outcome: "DENIED";
  reasonCodes: readonly EvidenceProvenanceReasonCodeV1[];
} {
  return freeze({ outcome: "DENIED" as const, reasonCodes: [...defects].sort() });
}

// --- field validators --------------------------------------------------------

const isString = (value: unknown): value is string => typeof value === "string";
const isNone = (value: unknown): boolean => value === EVIDENCE_PROVENANCE_NONE;

function isIdentifier(value: unknown, max: number): boolean {
  return isString(value) && value.length >= 1 && value.length <= max && ASCII_VISIBLE.test(value);
}
function isDigest(value: unknown): boolean {
  return isString(value) && (value === EVIDENCE_PROVENANCE_NONE || HEX64.test(value));
}
function isHex64(value: unknown): boolean {
  return isString(value) && HEX64.test(value);
}
function isSha40(value: unknown): boolean {
  return isString(value) && SHA40.test(value);
}
function isTimestamp(value: unknown): boolean {
  return isString(value) && RFC3339.test(value);
}
function isHttpsUrl(value: unknown): boolean {
  return isString(value) && HTTPS_URL.test(value);
}
function isGithubRunUrl(value: unknown): boolean {
  return isString(value) && GITHUB_RUN_URL.test(value);
}
function isStatement(value: unknown): boolean {
  return isString(value) && value.length >= 1 && value.length <= 8192;
}
function isEvidenceClass(value: unknown): value is EvidenceProvenanceClassV1 {
  return isString(value) && (EVIDENCE_PROVENANCE_CLASSES_V1 as readonly string[]).includes(value);
}
function isMethod(value: unknown): value is EvidenceProvenanceMethodV1 {
  return isString(value) && (EVIDENCE_PROVENANCE_METHODS_V1 as readonly string[]).includes(value);
}
function isVerifierIdentityClass(value: unknown): value is EvidenceProvenanceVerifierIdentityClassV1 {
  return isString(value) && (EVIDENCE_PROVENANCE_VERIFIER_IDENTITY_CLASSES_V1 as readonly string[]).includes(value);
}
function isDataClass(value: unknown): value is EvidenceProvenanceDataClassV1 {
  return isString(value) && (value === "PUBLIC_SYNTHETIC" || value === "OWNER_PRIVATE_REFERENCE");
}

function hasSelfSignedKey(value: unknown): boolean {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return false;
  return Object.keys(value as Record<string, unknown>).some((key) => SELF_SIGNED_KEYS.has(key));
}

/**
 * Class support rules. A class may only be claimed when the record carries
 * the support that class requires; claiming a stronger class over weaker
 * support fails closed. Requiring digests for review and above is what keeps
 * the classes from implying one another.
 */
function addClassSupportDefects(
  defects: Set<DefectCode>,
  cls: EvidenceProvenanceClassV1,
  support: {
    inputsDigest: unknown;
    oracleDigest: unknown;
    resultDigest: unknown;
    reviewerId: unknown;
    ciProvider: unknown;
    organization: unknown;
    readbackDigest: unknown;
    identityClass: unknown;
    producerOrganization: unknown;
  },
): void {
  const requireDigests = (): void => {
    if (support.inputsDigest === EVIDENCE_PROVENANCE_NONE) defects.add(CODE.PROMOTION);
    if (support.oracleDigest === EVIDENCE_PROVENANCE_NONE) defects.add(CODE.PROMOTION);
    if (support.resultDigest === EVIDENCE_PROVENANCE_NONE) defects.add(CODE.PROMOTION);
  };
  if (cls === "ISOLATED_INTERNAL_REVIEW") {
    if (support.reviewerId === EVIDENCE_PROVENANCE_NONE) defects.add(CODE.PROMOTION);
    requireDigests();
  } else if (cls === "THIRD_PARTY_EXECUTION_PLATFORM") {
    if (support.ciProvider === EVIDENCE_PROVENANCE_NONE) defects.add(CODE.PROMOTION);
    if (support.organization === EVIDENCE_PROVENANCE_NONE) defects.add(CODE.PROMOTION);
    if (support.readbackDigest === EVIDENCE_PROVENANCE_NONE) defects.add(CODE.MISSING_READBACK);
    requireDigests();
  } else if (cls === "EXTERNAL_INDEPENDENT_VALIDATION") {
    if (support.ciProvider === EVIDENCE_PROVENANCE_NONE) defects.add(CODE.PROMOTION);
    if (support.organization === EVIDENCE_PROVENANCE_NONE) defects.add(CODE.PROMOTION);
    if (support.readbackDigest === EVIDENCE_PROVENANCE_NONE) defects.add(CODE.MISSING_READBACK);
    if (support.identityClass === "DETERMINISTIC_TOOL" || support.identityClass === "SELF_HOSTED_MODEL") {
      defects.add(CODE.PROMOTION);
    }
    if (support.producerOrganization === EVIDENCE_PROVENANCE_NONE) defects.add(CODE.PROMOTION);
    else if (support.producerOrganization === support.organization) defects.add(CODE.PROMOTION);
    requireDigests();
  }
}

/**
 * Shared structural checks for a provenance record (builder input or full
 * record). Returns the defect set; an empty set means the record is structurally
 * sound, class-supported and free of self-attestation.
 */
function recordDefects(plain: Record<string, unknown>, expectContentDigest: boolean): Set<DefectCode> {
  const defects = new Set<DefectCode>();
  // Self-attestation is denied before any key-set short-circuit so a hostile
  // extra PASS key cannot hide behind a generic schema denial.
  if (hasSelfSignedKey(plain)) defects.add(CODE.SELF_SIGNED);
  for (const key of NESTED_OBJECT_KEYS) {
    if (hasSelfSignedKey(plain[key])) defects.add(CODE.SELF_SIGNED);
  }
  const rec = asExactRecord(plain, expectContentDigest ? TOP_KEYS : INPUT_KEYS);
  if (rec === null) {
    defects.add(CODE.SCHEMA);
    return defects;
  }
  // The builder stamps the schema version itself; a caller-supplied one must
  // match exactly, an absent one is not a defect.
  if (rec.schemaVersion !== undefined && rec.schemaVersion !== EVIDENCE_PROVENANCE_RECORD_SCHEMA_V1) {
    defects.add(CODE.SCHEMA);
  }
  if (!isIdentifier(rec.recordId, 512)) defects.add(CODE.SCHEMA);
  if (!isDataClass(rec.dataClass)) defects.add(CODE.SCHEMA);
  if (!isEvidenceClass(rec.evidenceClass)) defects.add(CODE.SCHEMA);
  if (!isMethod(rec.method)) defects.add(CODE.SCHEMA);
  if (!isTimestamp(rec.timestamp)) defects.add(CODE.SCHEMA);
  if (!isDigest(rec.invocationDigest)) defects.add(CODE.SCHEMA);
  if (!isDigest(rec.resultDigest)) defects.add(CODE.SCHEMA);
  if (expectContentDigest && !isHex64(rec.contentDigest)) defects.add(CODE.SCHEMA);

  const claim = asExactRecord(rec.claim, CLAIM_KEYS);
  if (claim === null || !isIdentifier(claim.claimId, 512) || !isStatement(claim.statement)) {
    defects.add(CODE.SCHEMA);
  }
  const head = asExactRecord(rec.head, HEAD_KEYS);
  if (head === null || !isSha40(head.commitSha) || !isSha40(head.treeSha)) defects.add(CODE.SCHEMA);
  const inputs = asExactRecord(rec.inputs, INPUTS_KEYS);
  if (inputs === null || !isDigest(inputs.inputsDigest)) defects.add(CODE.SCHEMA);
  const oracle = asExactRecord(rec.oracle, ORACLE_KEYS);
  if (oracle === null || !isIdentifier(oracle.oracleId, 512) || !isDigest(oracle.oracleDigest)) {
    defects.add(CODE.SCHEMA);
  }
  const verifier = asExactRecord(rec.verifier, VERIFIER_KEYS);
  if (
    verifier === null ||
    !isIdentifier(verifier.implementation, 512) ||
    !isIdentifier(verifier.tool, 128) ||
    (!isIdentifier(verifier.model, 128) && !isNone(verifier.model)) ||
    !isVerifierIdentityClass(verifier.identityClass)
  ) {
    defects.add(CODE.SCHEMA);
  }
  const environment = asExactRecord(rec.environment, ENVIRONMENT_KEYS);
  if (
    environment === null ||
    !isIdentifier(environment.platform, 128) ||
    !isIdentifier(environment.runtime, 128)
  ) {
    defects.add(CODE.SCHEMA);
  }
  const ci = asExactRecord(rec.ci, CI_KEYS);
  if (ci === null) {
    defects.add(CODE.SCHEMA);
  } else if (ci.provider === "NONE") {
    if (!isNone(ci.runId) || !isNone(ci.runUrl) || !isNone(ci.jobId)) defects.add(CODE.SCHEMA);
  } else if (ci.provider === "GITHUB_ACTIONS") {
    if (!isIdentifier(ci.runId, 256) || !isIdentifier(ci.jobId, 256) || !isGithubRunUrl(ci.runUrl)) {
      defects.add(CODE.SCHEMA);
    }
  } else {
    defects.add(CODE.SCHEMA);
  }
  const provider = asExactRecord(rec.provider, PROVIDER_KEYS);
  if (provider === null) {
    defects.add(CODE.SCHEMA);
  } else if (isNone(provider.organization)) {
    if (!isNone(provider.readbackUrl) || !isNone(provider.readbackDigest) || !isNone(provider.readbackTimestamp)) {
      defects.add(CODE.SCHEMA);
    }
  } else if (
    !isIdentifier(provider.organization, 256) ||
    !isHttpsUrl(provider.readbackUrl) ||
    !isHex64(provider.readbackDigest) ||
    !isTimestamp(provider.readbackTimestamp)
  ) {
    defects.add(CODE.SCHEMA);
  }
  const review = asExactRecord(rec.review, REVIEW_KEYS);
  if (
    review === null ||
    !(isNone(review.producerId) || isIdentifier(review.producerId, 256)) ||
    !(isNone(review.producerOrganization) || isIdentifier(review.producerOrganization, 256)) ||
    !(isNone(review.reviewerId) || isIdentifier(review.reviewerId, 256)) ||
    !(isNone(review.reviewerIdentityDigest) || isHex64(review.reviewerIdentityDigest))
  ) {
    defects.add(CODE.SCHEMA);
  } else {
    // A reviewer binding is always attested against a distinct producer.
    if (
      !isNone(review.reviewerId) &&
      (isNone(review.producerId) ||
        review.reviewerId === review.producerId ||
        isNone(review.reviewerIdentityDigest))
    ) {
      defects.add(CODE.FORGED_REVIEWER);
    }
  }

  const cls = rec.evidenceClass;
  if (isEvidenceClass(cls) && rec.method !== EVIDENCE_PROVENANCE_CLASS_METHOD_V1[cls]) {
    defects.add(CODE.METHOD_MISMATCH);
  }
  if (
    isEvidenceClass(cls) &&
    claim !== null &&
    inputs !== null &&
    oracle !== null &&
    verifier !== null &&
    ci !== null &&
    provider !== null &&
    review !== null
  ) {
    addClassSupportDefects(defects, cls, {
      inputsDigest: inputs.inputsDigest,
      oracleDigest: oracle.oracleDigest,
      resultDigest: rec.resultDigest,
      reviewerId: review.reviewerId,
      ciProvider: ci.provider,
      organization: provider.organization,
      readbackDigest: provider.readbackDigest,
      identityClass: verifier.identityClass,
      producerOrganization: review.producerOrganization,
    });
  }
  return defects;
}

/**
 * Recomputation-bound checks: the record's bindings must equal the
 * caller-supplied recomputation of deterministic content and provider state.
 * Only bindings the record actually declared (not NONE) are compared.
 */
function recomputationDefects(
  rec: Record<string, unknown>,
  recomputation: Record<string, unknown>,
  defects: Set<DefectCode>,
): void {
  const rc = asExactRecord(recomputation, RECOMPUTATION_KEYS);
  if (rc === null) {
    defects.add(CODE.SCHEMA);
    return;
  }
  const rhead = asExactRecord(rc.head, HEAD_KEYS);
  if (
    !isDigest(rc.inputsDigest) ||
    !isDigest(rc.oracleDigest) ||
    !isDigest(rc.resultDigest) ||
    !isDigest(rc.providerReadbackDigest) ||
    !isNone(rc.ciRunId) && !isIdentifier(rc.ciRunId, 256) ||
    rhead === null ||
    !isSha40(rhead.commitSha) ||
    !isSha40(rhead.treeSha)
  ) {
    defects.add(CODE.SCHEMA);
    return;
  }
  const head = asExactRecord(rec.head, HEAD_KEYS);
  const inputs = asExactRecord(rec.inputs, INPUTS_KEYS);
  const oracle = asExactRecord(rec.oracle, ORACLE_KEYS);
  const ci = asExactRecord(rec.ci, CI_KEYS);
  const provider = asExactRecord(rec.provider, PROVIDER_KEYS);
  if (head !== null && (head.commitSha !== rhead.commitSha || head.treeSha !== rhead.treeSha)) {
    defects.add(CODE.HEAD_SUBSTITUTION);
  }
  if (inputs !== null && inputs.inputsDigest !== EVIDENCE_PROVENANCE_NONE && rc.inputsDigest !== inputs.inputsDigest) {
    defects.add(CODE.INPUT_SUBSTITUTION);
  }
  if (oracle !== null && oracle.oracleDigest !== EVIDENCE_PROVENANCE_NONE && rc.oracleDigest !== oracle.oracleDigest) {
    defects.add(CODE.ORACLE_SUBSTITUTION);
  }
  if (
    isDigest(rec.resultDigest) &&
    rec.resultDigest !== EVIDENCE_PROVENANCE_NONE &&
    rc.resultDigest !== rec.resultDigest
  ) {
    defects.add(CODE.RESULT_DIGEST);
  }
  if (ci !== null && ci.provider === "GITHUB_ACTIONS" && rc.ciRunId !== ci.runId) {
    defects.add(CODE.RUN_SUBSTITUTION);
  }
  if (provider !== null && provider.readbackDigest !== EVIDENCE_PROVENANCE_NONE) {
    if (rc.providerReadbackDigest === EVIDENCE_PROVENANCE_NONE) defects.add(CODE.MISSING_READBACK);
    else if (rc.providerReadbackDigest !== provider.readbackDigest) defects.add(CODE.RUN_SUBSTITUTION);
  }
}

// --- public API ----------------------------------------------------------------

/**
 * Build a frozen, content-digested provenance record from caller input. The
 * input is validated fail-closed (closed schema, class support, no
 * self-attested fields) and never mutated; the content digest is computed
 * over the stamped record and must be recomputed, not trusted.
 */
export function createEvidenceProvenanceRecordV1(input: unknown): EvidenceProvenanceBuildResultV1 {
  const plain = plainObject(input);
  if (plain === null) return deny(new Set<DefectCode>([CODE.SCHEMA]));
  const defects = recordDefects(plain, false);
  if (defects.size > 0) return deny(defects);
  const stamped: Record<string, unknown> = { ...plain, schemaVersion: EVIDENCE_PROVENANCE_RECORD_SCHEMA_V1 };
  const record: Record<string, unknown> = { ...stamped, contentDigest: digestHex(stamped) };
  return freeze({ outcome: "BUILT" as const, record: record as EvidenceProvenanceRecordV1 });
}

/**
 * Verify a provenance record against a recomputation of its deterministic
 * content and provider state. The stored content digest is recomputed and
 * the recorded bindings are compared against the recomputation; caller-
 * authored PASS fields never confer verification.
 */
export function verifyEvidenceProvenanceV1(
  record: unknown,
  recomputation: unknown,
): EvidenceProvenanceVerificationV1 {
  const rplain = plainObject(record);
  const cplain = plainObject(recomputation);
  if (rplain === null || cplain === null) return deny(new Set<DefectCode>([CODE.SCHEMA]));
  const defects = recordDefects(rplain, true);
  const { contentDigest: _stored, ...rest } = rplain;
  if (rplain.contentDigest !== digestHex(rest)) defects.add(CODE.CONTENT_DIGEST);
  const rec = asExactRecord(rplain, TOP_KEYS);
  if (rec !== null) recomputationDefects(rec, cplain, defects);
  if (defects.size > 0) return deny(defects);
  return freeze({
    outcome: "VERIFIED" as const,
    reasonCodes: ["EVIDENCE_PROVENANCE_VERIFIED"] as const,
    evidenceClass: rplain.evidenceClass as EvidenceProvenanceClassV1,
    contentDigest: rplain.contentDigest as string,
  });
}

/**
 * Issue the public review receipt for a verified record. The receipt is
 * bound to the verified record's recomputed content digest, projects only
 * safe method/provenance fields and the exact-head binding, and fails
 * closed on non-public data classes and on any secret or private-path
 * material inside the projected fields.
 */
export function publicReviewReceiptV1(
  record: unknown,
  verification: unknown,
): EvidenceProvenancePublicReceiptResultV1 {
  const rplain = plainObject(record);
  const vplain = plainObject(verification);
  if (rplain === null || vplain === null) return deny(new Set<DefectCode>([CODE.RECEIPT_UNVERIFIED]));
  const v = asExactRecord(vplain, VERIFICATION_KEYS);
  const rc = v === null ? null : v.reasonCodes;
  if (
    v === null ||
    v.outcome !== "VERIFIED" ||
    !Array.isArray(rc) ||
    rc.length !== 1 ||
    rc[0] !== "EVIDENCE_PROVENANCE_VERIFIED" ||
    !isEvidenceClass(v.evidenceClass) ||
    !isHex64(v.contentDigest)
  ) {
    return deny(new Set<DefectCode>([CODE.RECEIPT_UNVERIFIED]));
  }
  const rec = asExactRecord(rplain, TOP_KEYS);
  if (rec === null) return deny(new Set<DefectCode>([CODE.RECEIPT_UNVERIFIED]));
  const { contentDigest: _stored, ...rest } = rplain;
  const recomputedDigest = digestHex(rest);
  if (rplain.contentDigest !== recomputedDigest) return deny(new Set<DefectCode>([CODE.RECEIPT_UNVERIFIED]));
  if (v.contentDigest !== recomputedDigest) return deny(new Set<DefectCode>([CODE.RECEIPT_UNVERIFIED]));
  if (v.evidenceClass !== rplain.evidenceClass) return deny(new Set<DefectCode>([CODE.RECEIPT_UNVERIFIED]));
  if (rplain.dataClass !== "PUBLIC_SYNTHETIC") return deny(new Set<DefectCode>([CODE.DATA_CLASS]));

  const claim = rplain.claim as Record<string, unknown>;
  const head = rplain.head as Record<string, unknown>;
  const verifier = rplain.verifier as Record<string, unknown>;
  const ci = rplain.ci as Record<string, unknown>;
  const provider = rplain.provider as Record<string, unknown>;
  const receiptBody: Record<string, unknown> = {
    schemaVersion: EVIDENCE_PROVENANCE_PUBLIC_RECEIPT_SCHEMA_V1,
    recordId: rplain.recordId,
    claimId: claim.claimId,
    evidenceClass: rplain.evidenceClass,
    method: rplain.method,
    head: { commitSha: head.commitSha, treeSha: head.treeSha },
    verifier: {
      implementation: verifier.implementation,
      tool: verifier.tool,
      model: verifier.model,
      identityClass: verifier.identityClass,
    },
    ci: { provider: ci.provider, runId: ci.runId, runUrl: ci.runUrl, jobId: ci.jobId },
    provider: {
      organization: provider.organization,
      readbackUrl: provider.readbackUrl,
      readbackDigest: provider.readbackDigest,
      readbackTimestamp: provider.readbackTimestamp,
    },
    dataClass: rplain.dataClass,
    timestamp: rplain.timestamp,
    resultDigest: rplain.resultDigest,
    contentDigest: recomputedDigest,
  };
  const hits = new Set<string>();
  scanForSecrets(receiptBody, hits);
  if (hits.size > 0) return deny(new Set<DefectCode>([CODE.REDACTION]));
  const receipt: Record<string, unknown> = {
    ...receiptBody,
    receiptDigest: digestHex(receiptBody),
  };
  return freeze({ outcome: "ISSUED" as const, receipt: receipt as EvidenceProvenancePublicReceiptV1 });
}

function scanForSecrets(value: unknown, hits: Set<string>): void {
  if (typeof value === "string") {
    for (const [pattern, label] of SECRET_PATTERNS) {
      if (pattern.test(value)) hits.add(label);
    }
  } else if (Array.isArray(value)) {
    for (const entry of value) scanForSecrets(entry, hits);
  } else if (value !== null && typeof value === "object") {
    for (const entry of Object.values(value as Record<string, unknown>)) scanForSecrets(entry, hits);
  }
}

/**
 * Migrate a legacy checked-in receipt with the honest weakest class only.
 * The legacy self-attested result field is ignored and never re-represented;
 * the only oracle that can be bound is the legacy receipt's own recomputed
 * bytes. Verifier identity classes that would imply independence are
 * refused. No retrospective external-independence claim is invented.
 */
export function migrateLegacyEvidenceReceiptV1(input: unknown): EvidenceProvenanceMigrationResultV1 {
  const plain = plainObject(input);
  if (plain === null) return deny(new Set<DefectCode>([CODE.SCHEMA]));
  const mig = asExactRecord(plain, MIGRATION_KEYS);
  if (mig === null) return deny(new Set<DefectCode>([CODE.SCHEMA]));
  const defects = new Set<DefectCode>();
  if (!isIdentifier(mig.receiptId, 256)) defects.add(CODE.SCHEMA);
  if (!isHex64(mig.receiptDigest)) defects.add(CODE.SCHEMA);
  if (!isIdentifier(mig.legacyResult, 128)) defects.add(CODE.SCHEMA);
  if (!isStatement(mig.statement)) defects.add(CODE.SCHEMA);
  const head = asExactRecord(mig.head, HEAD_KEYS);
  if (head === null || !isSha40(head.commitSha) || !isSha40(head.treeSha)) defects.add(CODE.SCHEMA);
  const verifier = asExactRecord(mig.verifier, VERIFIER_KEYS);
  if (
    verifier === null ||
    !isIdentifier(verifier.implementation, 512) ||
    !isIdentifier(verifier.tool, 128) ||
    (!isIdentifier(verifier.model, 128) && !isNone(verifier.model))
  ) {
    defects.add(CODE.SCHEMA);
  }
  if (
    verifier !== null &&
    verifier.identityClass !== "DETERMINISTIC_TOOL" &&
    verifier.identityClass !== "SELF_HOSTED_MODEL"
  ) {
    defects.add(CODE.PROMOTION);
  }
  const environment = asExactRecord(mig.environment, ENVIRONMENT_KEYS);
  if (
    environment === null ||
    !isIdentifier(environment.platform, 128) ||
    !isIdentifier(environment.runtime, 128)
  ) {
    defects.add(CODE.SCHEMA);
  }
  if (!isTimestamp(mig.timestamp)) defects.add(CODE.SCHEMA);
  if (!isDataClass(mig.dataClass)) defects.add(CODE.SCHEMA);
  if (defects.size > 0) return deny(defects);
  // Unreachable (any null here already recorded a schema defect), but keeps
  // the strict-mode narrowing honest for the object construction below.
  if (head === null || verifier === null || environment === null) {
    return deny(new Set<DefectCode>([CODE.SCHEMA]));
  }

  const receiptId = mig.receiptId as string;
  const built = createEvidenceProvenanceRecordV1({
    recordId: `migrated:${receiptId}`,
    dataClass: mig.dataClass,
    claim: { claimId: `legacy-receipt:${receiptId}`, statement: mig.statement },
    evidenceClass: "SELF_GENERATED",
    head: { commitSha: head.commitSha, treeSha: head.treeSha },
    inputs: { inputsDigest: EVIDENCE_PROVENANCE_NONE },
    oracle: { oracleId: `legacy-receipt:${receiptId}`, oracleDigest: mig.receiptDigest },
    verifier: {
      implementation: verifier.implementation,
      tool: verifier.tool,
      model: verifier.model,
      identityClass: verifier.identityClass,
    },
    invocationDigest: EVIDENCE_PROVENANCE_NONE,
    environment: { platform: environment.platform, runtime: environment.runtime },
    timestamp: mig.timestamp,
    ci: {
      provider: EVIDENCE_PROVENANCE_NONE,
      runId: EVIDENCE_PROVENANCE_NONE,
      runUrl: EVIDENCE_PROVENANCE_NONE,
      jobId: EVIDENCE_PROVENANCE_NONE,
    },
    provider: {
      organization: EVIDENCE_PROVENANCE_NONE,
      readbackUrl: EVIDENCE_PROVENANCE_NONE,
      readbackDigest: EVIDENCE_PROVENANCE_NONE,
      readbackTimestamp: EVIDENCE_PROVENANCE_NONE,
    },
    review: {
      producerId: EVIDENCE_PROVENANCE_NONE,
      producerOrganization: EVIDENCE_PROVENANCE_NONE,
      reviewerId: EVIDENCE_PROVENANCE_NONE,
      reviewerIdentityDigest: EVIDENCE_PROVENANCE_NONE,
    },
    method: "DETERMINISTIC_RECOMPUTATION",
    resultDigest: EVIDENCE_PROVENANCE_NONE,
  });
  if (built.outcome !== "BUILT") return deny(new Set(built.reasonCodes));
  return freeze({
    outcome: "MIGRATED" as const,
    record: built.record,
    nonclaims: ["WEAKEST_CLASS_ASSIGNED", "LEGACY_SELF_SIGNED_RESULT_IGNORED"] as const,
  });
}