/**
 * Pure, deterministic analysis decision for one proposed immutable ASF
 * generation. Analysis is evidence-bound and deliberately has no install,
 * activation, execution, promotion, registry, or signing authority.
 *
 * The trusted context is supplied independently of the proposal. A proposal
 * can therefore name the generation, lock, capabilities, and verifier, but it
 * cannot make those claims trusted by naming them in its own envelope.
 */
import { createHash } from "node:crypto";
import { canonicalJson } from "./canonical-json.js";

export const ASF_ANALYSIS_INPUT_SCHEMA_V1 = "chimpmaera.asf/analysis-input/v1" as const;
export const ASF_ANALYSIS_RECEIPT_SCHEMA_V1 = "chimpmaera.asf/analysis-receipt/v1" as const;
export const ASF_ANALYSIS_VERDICT_V1 = "ACCEPTED" as const;
export const ASF_ANALYSIS_IDENTITY_CLASS_V1 = "INDEPENDENT_ANALYZER" as const;
export const ASF_ANALYSIS_CLAIM_BOUNDARY_V1 =
  "LOCAL_SYNTHETIC_ANALYSIS_ONLY_NO_INSTALLATION_NO_ACTIVATION_NO_EXECUTION_NO_RELEASE_NO_TRUST_BADGE" as const;
export const ASF_ANALYSIS_AUTHORITY_V1 = Object.freeze({
  activation: "NO_AUTHORITY",
  installation: "NO_AUTHORITY",
} as const);

export const ASF_ANALYSIS_EVIDENCE_KINDS_V1 = ["QUALITY", "PROVENANCE", "RISK"] as const;
export type AsfAnalysisEvidenceKindV1 = typeof ASF_ANALYSIS_EVIDENCE_KINDS_V1[number];

export const ASF_ANALYSIS_REASON_ORDER_V1 = [
  "SCHEMA_DENIED",
  "UNSUPPORTED_VERSION_DENIED",
  "GENERATION_BINDING_DENIED",
  "LOCK_BINDING_DENIED",
  "EVIDENCE_MISSING_DENIED",
  "EVIDENCE_REVOKED_DENIED",
  "EVIDENCE_STALE_DENIED",
  "EVIDENCE_FOREIGN_DENIED",
  "EVIDENCE_DIGEST_MISMATCH_DENIED",
  "RISK_BLOCKED_DENIED",
  "SELF_ANALYSIS_DENIED",
  "VERIFIER_IDENTITY_DENIED",
  "UNKNOWN_CAPABILITY_DENIED",
  "FREE_TEXT_FINDING_DENIED",
  "SECRET_OR_PATH_FIELD_DENIED",
] as const;

export type AsfAnalysisReasonCodeV1 =
  | "ANALYSIS_ACCEPTED"
  | typeof ASF_ANALYSIS_REASON_ORDER_V1[number];

export const ASF_ANALYSIS_EXIT_CODES_V1: Readonly<Record<AsfAnalysisReasonCodeV1, number>> = Object.freeze({
  ANALYSIS_ACCEPTED: 0,
  SCHEMA_DENIED: 40,
  UNSUPPORTED_VERSION_DENIED: 41,
  GENERATION_BINDING_DENIED: 42,
  LOCK_BINDING_DENIED: 43,
  EVIDENCE_MISSING_DENIED: 44,
  EVIDENCE_REVOKED_DENIED: 45,
  EVIDENCE_STALE_DENIED: 46,
  EVIDENCE_FOREIGN_DENIED: 47,
  EVIDENCE_DIGEST_MISMATCH_DENIED: 48,
  RISK_BLOCKED_DENIED: 49,
  SELF_ANALYSIS_DENIED: 50,
  VERIFIER_IDENTITY_DENIED: 51,
  UNKNOWN_CAPABILITY_DENIED: 52,
  FREE_TEXT_FINDING_DENIED: 53,
  SECRET_OR_PATH_FIELD_DENIED: 54,
});

export type AsfAnalysisFindingCodeV1 =
  | "QUALITY_CHECKED"
  | "PROVENANCE_VERIFIED"
  | "RISK_CLEAR"
  | "RISK_BLOCKED";
export type AsfAnalysisFindingSeverityV1 = "PASS" | "BLOCK";

export interface AsfAnalysisFindingV1 {
  readonly code: AsfAnalysisFindingCodeV1;
  readonly severity: AsfAnalysisFindingSeverityV1;
}

export interface AsfAnalysisEvidenceV1 {
  readonly evidenceDigest: string;
  readonly evidenceId: string;
  readonly evidenceKind: AsfAnalysisEvidenceKindV1;
  readonly evidenceClass: "SYNTHETIC_VERIFIED";
  readonly status: "VERIFIED" | "REVOKED";
  readonly generationDigest: string;
  readonly lockDigest: string;
  readonly observedAtMs: number;
  readonly expiresAtMs: number;
  readonly findings: readonly AsfAnalysisFindingV1[];
}

export interface AsfAnalysisGenerationReferenceV1 {
  readonly generationDigest: string;
  readonly lockDigest: string;
  readonly capabilityIds: readonly string[];
}

export interface AsfAnalysisVerifierV1 {
  readonly verifierId: string;
  readonly verifierVersion: string;
  readonly identityClass: typeof ASF_ANALYSIS_IDENTITY_CLASS_V1;
}

export interface AsfAnalysisInputV1 {
  readonly schemaVersion: typeof ASF_ANALYSIS_INPUT_SCHEMA_V1;
  readonly subjectId: string;
  readonly generation: AsfAnalysisGenerationReferenceV1;
  readonly evidence: readonly AsfAnalysisEvidenceV1[];
  readonly verifier: AsfAnalysisVerifierV1;
}

export interface AsfAnalysisContextV1 {
  readonly generationDigest: string;
  readonly lockDigest: string;
  readonly capabilityIds: readonly string[];
  readonly trustedVerifierId: string;
  readonly trustedVerifierVersion: string;
  readonly nowMs: number;
  readonly maxEvidenceAgeMs: number;
}

export interface AsfAnalysisReceiptV1 {
  readonly schemaVersion: typeof ASF_ANALYSIS_RECEIPT_SCHEMA_V1;
  readonly generationDigest: string;
  readonly lockDigest: string;
  readonly evidenceDigest: string;
  readonly verifier: AsfAnalysisVerifierV1;
  readonly verdict: typeof ASF_ANALYSIS_VERDICT_V1;
  readonly reasonCodes: readonly ["ANALYSIS_ACCEPTED"];
  readonly claimBoundary: typeof ASF_ANALYSIS_CLAIM_BOUNDARY_V1;
  readonly authority: typeof ASF_ANALYSIS_AUTHORITY_V1;
  readonly receiptDigest: string;
}

export type AsfAnalysisResultV1 =
  | {
      readonly outcome: "ACCEPTED";
      readonly reasonCodes: readonly ["ANALYSIS_ACCEPTED"];
      readonly exitCode: 0;
      readonly generationDigest: string;
      readonly lockDigest: string;
      readonly evidenceDigest: string;
      readonly receiptDigest: string;
      readonly receiptJson: string;
      readonly receipt: AsfAnalysisReceiptV1;
    }
  | {
      readonly outcome: "DENIED";
      readonly reasonCodes: readonly [AsfAnalysisReasonCodeV1] | readonly AsfAnalysisReasonCodeV1[];
      readonly exitCode: number;
    };

const INPUT_KEYS = ["evidence", "generation", "schemaVersion", "subjectId", "verifier"];
const GENERATION_KEYS = ["capabilityIds", "generationDigest", "lockDigest"];
const EVIDENCE_KEYS = [
  "evidenceClass", "evidenceDigest", "evidenceId", "evidenceKind", "expiresAtMs",
  "findings", "generationDigest", "lockDigest", "observedAtMs", "status",
];
const FINDING_KEYS = ["code", "severity"];
const VERIFIER_KEYS = ["identityClass", "verifierId", "verifierVersion"];
const CONTEXT_KEYS = [
  "capabilityIds", "generationDigest", "lockDigest", "maxEvidenceAgeMs", "nowMs",
  "trustedVerifierId", "trustedVerifierVersion",
];
const RECEIPT_KEYS = [
  "authority", "claimBoundary", "evidenceDigest", "generationDigest", "lockDigest",
  "reasonCodes", "receiptDigest", "schemaVersion", "verdict", "verifier",
];

const DIGEST = /^[a-f0-9]{64}$/;
const SUBJECT_ID = /^(?:generation|candidate):[a-z0-9][a-z0-9._-]{2,95}$/;
const EVIDENCE_ID = /^evidence:[a-z0-9][a-z0-9._-]{2,95}$/;
const VERIFIER_ID = /^verifier:[a-z0-9][a-z0-9._-]{2,95}$/;
const CAPABILITY_ID = /^capability:[a-z0-9][a-z0-9._-]{2,95}$/;
const SEMVER = /^(?:0|[1-9][0-9]*)\.(?:0|[1-9][0-9]*)\.(?:0|[1-9][0-9]*)$/;
const MAX_EVIDENCE = 16;
const FINDING_CODES: readonly AsfAnalysisFindingCodeV1[] = [
  "QUALITY_CHECKED", "PROVENANCE_VERIFIED", "RISK_CLEAR", "RISK_BLOCKED",
];
const FINDING_SEVERITIES: readonly AsfAnalysisFindingSeverityV1[] = ["PASS", "BLOCK"];
const EVIDENCE_KINDS: readonly AsfAnalysisEvidenceKindV1[] = [...ASF_ANALYSIS_EVIDENCE_KINDS_V1];
const DANGEROUS_KEYS = new Set(["__proto__", "prototype", "constructor"]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    && Object.getPrototypeOf(value) === Object.prototype;
}

function exactKeys(value: unknown, expected: readonly string[]): value is Record<string, unknown> {
  if (!isRecord(value)) return false;
  const actual = Object.keys(value).sort();
  const keys = [...expected].sort();
  return actual.length === keys.length && actual.every((key, index) => key === keys[index]);
}

function isDigest(value: unknown): value is string {
  return typeof value === "string" && DIGEST.test(value);
}

function isTimestamp(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && !Object.is(value, -0) && value >= 0;
}

function isPlainArray(value: unknown): value is readonly unknown[] {
  return Array.isArray(value) && Object.getPrototypeOf(value) === Array.prototype
    && Object.keys(value).length === value.length;
}

function hasUnsafeField(value: unknown, ancestors = new Set<object>()): boolean {
  if (value === null || typeof value !== "object") return false;
  if (ancestors.has(value)) return true;
  const next = new Set(ancestors).add(value);
  if (Array.isArray(value)) return value.some((item) => hasUnsafeField(item, next));
  if (Object.getPrototypeOf(value) !== Object.prototype) return true;
  const record = value as Record<string, unknown>;
  return Object.keys(record).some((key) => {
    const lower = key.toLowerCase();
    return DANGEROUS_KEYS.has(key)
      || lower.includes("secret") || lower.includes("password") || lower.includes("token")
      || lower.includes("credential") || lower === "path" || lower.endsWith("path")
      || hasUnsafeField(record[key], next);
  });
}

const FREE_TEXT_KEYS: readonly string[] = ["finding", "detail", "description", "message"];

function hasFreeTextKeys(value: unknown): boolean {
  return isRecord(value) && FREE_TEXT_KEYS.some((key) => key in value);
}

function hasFreeTextFinding(value: unknown): boolean {
  if (!isRecord(value)) return false;
  if (hasFreeTextKeys(value)) return true;
  if (Array.isArray(value.findings)) {
    return value.findings.some(hasFreeTextKeys);
  }
  // Findings are nested under evidence items in the input shape.
  if (Array.isArray(value.evidence)) {
    return value.evidence.some((item) => isRecord(item) && hasFreeTextFinding(item));
  }
  return false;
}

function isIdentifier(value: unknown, expression: RegExp): value is string {
  return typeof value === "string" && value.normalize("NFC") === value && expression.test(value);
}

function validFinding(value: unknown): value is AsfAnalysisFindingV1 {
  return exactKeys(value, FINDING_KEYS)
    && FINDING_CODES.includes(value.code as AsfAnalysisFindingCodeV1)
    && FINDING_SEVERITIES.includes(value.severity as AsfAnalysisFindingSeverityV1);
}

function validEvidence(value: unknown): value is AsfAnalysisEvidenceV1 {
  return exactKeys(value, EVIDENCE_KEYS)
    && isDigest(value.evidenceDigest)
    && isIdentifier(value.evidenceId, EVIDENCE_ID)
    && EVIDENCE_KINDS.includes(value.evidenceKind as AsfAnalysisEvidenceKindV1)
    && value.evidenceClass === "SYNTHETIC_VERIFIED"
    && (value.status === "VERIFIED" || value.status === "REVOKED")
    && isDigest(value.generationDigest)
    && isDigest(value.lockDigest)
    && isTimestamp(value.observedAtMs)
    && isTimestamp(value.expiresAtMs)
    && isPlainArray(value.findings)
    && value.findings.length === 1
    && value.findings.every(validFinding);
}

function validGeneration(value: unknown): value is AsfAnalysisGenerationReferenceV1 {
  return exactKeys(value, GENERATION_KEYS)
    && isDigest(value.generationDigest)
    && isDigest(value.lockDigest)
    && isPlainArray(value.capabilityIds)
    && value.capabilityIds.length > 0
    && value.capabilityIds.length <= 64
    && value.capabilityIds.every((id): id is string => isIdentifier(id, CAPABILITY_ID))
    && new Set(value.capabilityIds).size === value.capabilityIds.length;
}

function validVerifier(value: unknown): value is AsfAnalysisVerifierV1 {
  return exactKeys(value, VERIFIER_KEYS)
    && isIdentifier(value.verifierId, VERIFIER_ID)
    && typeof value.verifierVersion === "string" && SEMVER.test(value.verifierVersion)
    && value.identityClass === ASF_ANALYSIS_IDENTITY_CLASS_V1;
}

function validInput(value: unknown): value is AsfAnalysisInputV1 {
  return exactKeys(value, INPUT_KEYS)
    && value.schemaVersion === ASF_ANALYSIS_INPUT_SCHEMA_V1
    && isIdentifier(value.subjectId, SUBJECT_ID)
    && validGeneration(value.generation)
    && isPlainArray(value.evidence)
    && value.evidence.length <= MAX_EVIDENCE
    && value.evidence.every(validEvidence)
    && validVerifier(value.verifier);
}

function validContext(value: unknown): value is AsfAnalysisContextV1 {
  return exactKeys(value, CONTEXT_KEYS)
    && isDigest(value.generationDigest)
    && isDigest(value.lockDigest)
    && isPlainArray(value.capabilityIds)
    && value.capabilityIds.length > 0
    && value.capabilityIds.length <= 64
    && value.capabilityIds.every((id): id is string => isIdentifier(id, CAPABILITY_ID))
    && new Set(value.capabilityIds).size === value.capabilityIds.length
    && isIdentifier(value.trustedVerifierId, VERIFIER_ID)
    && typeof value.trustedVerifierVersion === "string" && SEMVER.test(value.trustedVerifierVersion)
    && isTimestamp(value.nowMs)
    && typeof value.maxEvidenceAgeMs === "number"
    && Number.isSafeInteger(value.maxEvidenceAgeMs)
    && !Object.is(value.maxEvidenceAgeMs, -0)
    && value.maxEvidenceAgeMs >= 0;
}

function digest(value: unknown): string {
  return createHash("sha256").update(canonicalJson(value)).digest("hex");
}

function sortEvidence(evidence: readonly AsfAnalysisEvidenceV1[]): AsfAnalysisEvidenceV1[] {
  return [...evidence].sort((left, right) => left.evidenceId < right.evidenceId ? -1 : left.evidenceId > right.evidenceId ? 1 : 0);
}

export function asfAnalysisEvidenceDigestV1(value: Omit<AsfAnalysisEvidenceV1, "evidenceDigest"> | AsfAnalysisEvidenceV1): string {
  const core = { ...value } as Record<string, unknown>;
  delete core.evidenceDigest;
  return digest(core);
}

export function asfAnalysisEvidenceSetDigestV1(evidence: readonly AsfAnalysisEvidenceV1[]): string {
  return digest(sortEvidence(evidence).map((item) => ({ ...item })));
}

export function asfAnalysisReceiptDigestV1(value: Omit<AsfAnalysisReceiptV1, "receiptDigest"> | Record<string, unknown>): string {
  const core = { ...value } as Record<string, unknown>;
  delete core.receiptDigest;
  return digest(core);
}

function actorAlias(identity: string): string {
  const separator = identity.indexOf(":");
  return identity.slice(separator + 1).toLowerCase().replace(/[._-]+/g, "-");
}

function deny(reasonCodes: readonly AsfAnalysisReasonCodeV1[]): Extract<AsfAnalysisResultV1, { outcome: "DENIED" }> {
  const ordered = reasonCodes.length === 1
    ? reasonCodes
    : ASF_ANALYSIS_REASON_ORDER_V1.filter((reason) => reasonCodes.includes(reason));
  const first = ordered[0] ?? "SCHEMA_DENIED";
  return Object.freeze({
    outcome: "DENIED" as const,
    reasonCodes: Object.freeze([...ordered]),
    exitCode: ASF_ANALYSIS_EXIT_CODES_V1[first],
  });
}

function semanticPreflight(value: Record<string, unknown>, context: unknown): AsfAnalysisReasonCodeV1 | null {
  if (hasUnsafeField(value)) return "SECRET_OR_PATH_FIELD_DENIED";
  if (hasFreeTextFinding(value)) return "FREE_TEXT_FINDING_DENIED";
  if (typeof value.schemaVersion === "string" && value.schemaVersion !== ASF_ANALYSIS_INPUT_SCHEMA_V1) {
    return "UNSUPPORTED_VERSION_DENIED";
  }
  const generation = isRecord(value.generation) ? value.generation : null;
  if (generation !== null && Array.isArray(generation.capabilityIds) && isRecord(context)) {
    const allowed = new Set(Array.isArray(context.capabilityIds) ? context.capabilityIds : []);
    if (generation.capabilityIds.some((id) => typeof id === "string" && !allowed.has(id))) {
      return "UNKNOWN_CAPABILITY_DENIED";
    }
  }
  const evidence = Array.isArray(value.evidence) ? value.evidence : [];
  if (evidence.some((item) => isRecord(item) && item.status === "REVOKED")) return "EVIDENCE_REVOKED_DENIED";
  if (evidence.some((item) => isRecord(item) && !("evidenceKind" in item))) return "EVIDENCE_MISSING_DENIED";
  return null;
}

function verifyCore(value: unknown, context: unknown): AsfAnalysisResultV1 {
  if (!isRecord(value)) return deny(["SCHEMA_DENIED"]);
  const preflight = semanticPreflight(value, context);
  if (preflight !== null) return deny([preflight]);
  if (value.schemaVersion !== ASF_ANALYSIS_INPUT_SCHEMA_V1) return deny(["UNSUPPORTED_VERSION_DENIED"]);
  if (!validInput(value)) return deny(["SCHEMA_DENIED"]);
  if (!validContext(context)) return deny(["SCHEMA_DENIED"]);

  const input = value;
  const trusted = context;
  const reasons = new Set<AsfAnalysisReasonCodeV1>();
  if (input.generation.generationDigest !== trusted.generationDigest) reasons.add("GENERATION_BINDING_DENIED");
  if (input.generation.lockDigest !== trusted.lockDigest) reasons.add("LOCK_BINDING_DENIED");
  if (input.verifier.verifierId !== trusted.trustedVerifierId
    || input.verifier.verifierVersion !== trusted.trustedVerifierVersion) {
    reasons.add("VERIFIER_IDENTITY_DENIED");
  }
  if (actorAlias(input.verifier.verifierId) === actorAlias(input.subjectId)) reasons.add("SELF_ANALYSIS_DENIED");

  const allowedCapabilities = new Set(trusted.capabilityIds);
  if (input.generation.capabilityIds.some((id) => !allowedCapabilities.has(id))) {
    reasons.add("UNKNOWN_CAPABILITY_DENIED");
  }

  const kinds = new Set<AsfAnalysisEvidenceKindV1>();
  const evidence = sortEvidence(input.evidence);
  if (evidence.length !== ASF_ANALYSIS_EVIDENCE_KINDS_V1.length) reasons.add("EVIDENCE_MISSING_DENIED");
  for (const item of evidence) {
    if (kinds.has(item.evidenceKind)) reasons.add("EVIDENCE_MISSING_DENIED");
    kinds.add(item.evidenceKind);
    // Foreignness is measured against the pinned (trusted) generation and
    // lock, never against the proposal's untrusted reference. A proposal that
    // misnames the generation is denied for the binding alone; evidence that
    // is correctly bound to the pinned generation must not gain a second,
    // derived reason from the proposal's own false claim.
    if (item.generationDigest !== trusted.generationDigest
      || item.lockDigest !== trusted.lockDigest) reasons.add("EVIDENCE_FOREIGN_DENIED");
    if (asfAnalysisEvidenceDigestV1(item) !== item.evidenceDigest) reasons.add("EVIDENCE_DIGEST_MISMATCH_DENIED");
    if (item.status === "REVOKED") reasons.add("EVIDENCE_REVOKED_DENIED");
    if (item.observedAtMs > trusted.nowMs || trusted.nowMs >= item.expiresAtMs
      || trusted.nowMs - item.observedAtMs > trusted.maxEvidenceAgeMs) {
      reasons.add("EVIDENCE_STALE_DENIED");
    }
    const finding = item.findings[0];
    if (finding === undefined) {
      reasons.add("EVIDENCE_MISSING_DENIED");
      continue;
    }
    if (item.evidenceKind === "QUALITY" && (finding.code !== "QUALITY_CHECKED" || finding.severity !== "PASS")) {
      reasons.add("RISK_BLOCKED_DENIED");
    }
    if (item.evidenceKind === "PROVENANCE" && (finding.code !== "PROVENANCE_VERIFIED" || finding.severity !== "PASS")) {
      reasons.add("EVIDENCE_FOREIGN_DENIED");
    }
    if (item.evidenceKind === "RISK" && (finding.code !== "RISK_CLEAR" || finding.severity !== "PASS")) {
      reasons.add("RISK_BLOCKED_DENIED");
    }
  }
  for (const kind of ASF_ANALYSIS_EVIDENCE_KINDS_V1) if (!kinds.has(kind)) reasons.add("EVIDENCE_MISSING_DENIED");

  if (reasons.size > 0) return deny([...reasons]);
  const evidenceDigest = asfAnalysisEvidenceSetDigestV1(evidence);
  const unsigned: Omit<AsfAnalysisReceiptV1, "receiptDigest"> = {
    schemaVersion: ASF_ANALYSIS_RECEIPT_SCHEMA_V1,
    generationDigest: input.generation.generationDigest,
    lockDigest: input.generation.lockDigest,
    evidenceDigest,
    verifier: input.verifier,
    verdict: ASF_ANALYSIS_VERDICT_V1,
    reasonCodes: ["ANALYSIS_ACCEPTED"],
    claimBoundary: ASF_ANALYSIS_CLAIM_BOUNDARY_V1,
    authority: ASF_ANALYSIS_AUTHORITY_V1,
  };
  const receipt: AsfAnalysisReceiptV1 = Object.freeze({
    ...unsigned,
    receiptDigest: asfAnalysisReceiptDigestV1(unsigned),
  });
  return Object.freeze({
    outcome: "ACCEPTED" as const,
    reasonCodes: ["ANALYSIS_ACCEPTED"] as const,
    exitCode: 0 as const,
    generationDigest: receipt.generationDigest,
    lockDigest: receipt.lockDigest,
    evidenceDigest,
    receiptDigest: receipt.receiptDigest,
    receiptJson: canonicalJson(receipt),
    receipt,
  });
}

export function verifyAsfAnalysisV1(value: unknown, context: unknown): AsfAnalysisResultV1 {
  return verifyCore(value, context);
}

export function analyzeAsfGenerationV1(value: unknown, context: unknown): AsfAnalysisResultV1 {
  return verifyCore(value, context);
}

function hasDuplicateKey(raw: string): boolean {
  const objectKeys: Set<string>[] = [];
  let inString = false;
  let escaped = false;
  for (let index = 0; index < raw.length; index += 1) {
    const char = raw[index];
    if (inString) {
      if (escaped) escaped = false;
      else if (char === "\\") escaped = true;
      else if (char === '"') inString = false;
      continue;
    }
    if (char === '"') {
      const end = nextStringEnd(raw, index);
      let cursor = end + 1;
      while (cursor < raw.length && /\s/.test(raw[cursor] ?? "")) cursor += 1;
      if (raw[cursor] === ":" && objectKeys.length > 0) {
        let key: string;
        try {
          key = JSON.parse(`"${raw.slice(index + 1, end)}"`) as string;
        } catch {
          return false;
        }
        const keys = objectKeys[objectKeys.length - 1];
        if (keys !== undefined) {
          if (keys.has(key)) return true;
          keys.add(key);
        }
        index = end;
        continue;
      }
      inString = true;
      continue;
    }
    if (char === "{") objectKeys.push(new Set<string>());
    else if (char === "}") objectKeys.pop();
  }
  return false;
}

function nextStringEnd(raw: string, openQuote: number): number {
  let index = openQuote + 1;
  while (index < raw.length) {
    if (raw[index] === "\\") {
      index += 2;
      continue;
    }
    if (raw[index] === '"') return index;
    index += 1;
  }
  return raw.length - 1;
}

export function parseAsfAnalysisV1(raw: string, context: unknown): AsfAnalysisResultV1 {
  if (typeof raw !== "string") return deny(["SCHEMA_DENIED"]);
  if (hasDuplicateKey(raw)) return deny(["SCHEMA_DENIED"]);
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    return deny(["SCHEMA_DENIED"]);
  }
  const result = verifyCore(value, context);
  if (result.outcome !== "ACCEPTED") return result;
  if (raw !== canonicalJson(value)) return deny(["SCHEMA_DENIED"]);
  return result;
}

export function renderPublicAsfAnalysisV1(value: unknown, context: unknown): string {
  const result = verifyCore(value, context);
  if (result.outcome === "DENIED") return canonicalJson(result);
  return canonicalJson({
    outcome: result.outcome,
    reasonCodes: [...result.reasonCodes],
    exitCode: result.exitCode,
    receipt: result.receipt,
  });
}

export function validateAsfAnalysisReceiptV1(value: unknown): value is AsfAnalysisReceiptV1 {
  return exactKeys(value, RECEIPT_KEYS)
    && value.schemaVersion === ASF_ANALYSIS_RECEIPT_SCHEMA_V1
    && isDigest(value.generationDigest)
    && isDigest(value.lockDigest)
    && isDigest(value.evidenceDigest)
    && validVerifier(value.verifier)
    && value.verdict === ASF_ANALYSIS_VERDICT_V1
    && Array.isArray(value.reasonCodes)
    && value.reasonCodes.length === 1
    && value.reasonCodes[0] === "ANALYSIS_ACCEPTED"
    && value.claimBoundary === ASF_ANALYSIS_CLAIM_BOUNDARY_V1
    && canonicalJson(value.authority) === canonicalJson(ASF_ANALYSIS_AUTHORITY_V1)
    && isDigest(value.receiptDigest)
    && asfAnalysisReceiptDigestV1(value) === value.receiptDigest;
}
