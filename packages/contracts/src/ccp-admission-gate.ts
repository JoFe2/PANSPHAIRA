import { canonicalJson } from "./canonical-json.js";

import {
  assertCcpDigestV1,
  assertCcpNullableDigestV1,
  assertCcpSafeUnsignedIntegerV1,
  assertCcpStringV1,
  ccpDigestDomainV1,
  ccpStrictDenyV1,
  readCcpClosedObjectV1,
  CONTRIBUTION_ID_PATTERN,
  DELIVERY_ID_PATTERN,
  LEDGER_ID_PATTERN,
  REPOSITORY_ID_PATTERN,
  TENANT_ID_PATTERN,
} from "./ccp-event-envelope.js";
import {
  CCP_COMPONENT_IDS_V1,
  CCP_RISK_CLASSES_V1,
  parseCcpRiskRouteV1,
  resolveCcpRiskRouteV1,
  type CcpRiskRouteV1,
} from "./ccp-risk-routing.js";

/**
 * CCP PSAI52 bounded intake boundary (M1 admission, gate side): a pure,
 * cheap, closed admission gate over synthetic intake candidates. It
 * evaluates a closed candidate against a bound trust context and returns an
 * immutable, digest-bound admission receipt. It has no network,
 * persistence, clock, randomness, queue, runner, merge or code execution
 * capability: neither an ADMITTED nor a QUARANTINED receipt allocates a
 * queue slot, schedules a runner, executes code or authorizes a merge.
 *
 * The logical clock is injected: the candidate and context carry
 * `logicalAtMs` values as data only and this module never reads Date,
 * Date.now, performance.now, process uptime or file-system timestamps.
 *
 * Malicious, stale, malformed, unknown and authority-changing candidates
 * quarantine fail-closed before any queue, runner or merge eligibility
 * exists. Unknown fields, unknown identities and unknown components or risk
 * classes deny; the finite reason vocabulary is closed.
 */

export const CCP_ADMISSION_CANDIDATE_SCHEMA_V1 = "cm.ccp-admission-candidate/v1" as const;
export const CCP_ADMISSION_CONTEXT_SCHEMA_V1 = "cm.ccp-admission-context/v1" as const;
export const CCP_ADMISSION_RECEIPT_SCHEMA_V1 = "cm.ccp-admission-receipt/v1" as const;

export type CcpAdmissionDispositionV1 = "ADMITTED" | "QUARANTINED";

export const CCP_ADMISSION_DISPOSITIONS_V1 = Object.freeze([
  "ADMITTED",
  "QUARANTINED",
]) as readonly CcpAdmissionDispositionV1[];

export type CcpAdmissionReasonCodeV1 =
  | "ADMITTED_ROUTE_ASSIGNED"
  | "AUTHORITY_CHANGE"
  | "IDENTITY_MISMATCH"
  | "MALICIOUS_RISK_CLASS"
  | "SCOPE_SUBSTITUTION"
  | "STALE_HEAD_REPLAY"
  | "STALE_LOGICAL_TIME"
  | "UNKNOWN_COMPONENT"
  | "UNKNOWN_RISK_CLASS";

export const CCP_ADMISSION_REASON_CODES_V1 = Object.freeze([
  "ADMITTED_ROUTE_ASSIGNED",
  "AUTHORITY_CHANGE",
  "IDENTITY_MISMATCH",
  "MALICIOUS_RISK_CLASS",
  "SCOPE_SUBSTITUTION",
  "STALE_HEAD_REPLAY",
  "STALE_LOGICAL_TIME",
  "UNKNOWN_COMPONENT",
  "UNKNOWN_RISK_CLASS",
]) as readonly CcpAdmissionReasonCodeV1[];

export interface CcpAdmissionCandidateV1 {
  readonly schemaVersion: typeof CCP_ADMISSION_CANDIDATE_SCHEMA_V1;
  readonly ledgerId: string;
  readonly tenantId: string;
  readonly repositoryId: string;
  readonly contributionId: string;
  readonly deliveryId: string;
  readonly headDigest: string;
  readonly payloadDigest: string;
  readonly ancestorDigest: string | null;
  /** Injected logical clock value in logical milliseconds; data only. */
  readonly logicalAtMs: number;
  readonly componentId: string;
  readonly riskClass: string;
  readonly authorityProfileDigest: string;
}

/**
 * Bound trust context: the admitted identity, the admitted component scope,
 * the current head and authority profile digests, and the injected logical
 * watermark of the last admitted candidate. All values are data; none of
 * them is a live authority grant.
 */
export interface CcpAdmissionContextV1 {
  readonly schemaVersion: typeof CCP_ADMISSION_CONTEXT_SCHEMA_V1;
  readonly ledgerId: string;
  readonly tenantId: string;
  readonly repositoryId: string;
  readonly contributionId: string;
  readonly componentId: string;
  readonly currentHeadDigest: string;
  readonly currentAuthorityProfileDigest: string;
  /** Injected logical watermark of the last admitted candidate; data only. */
  readonly lastAdmittedLogicalAtMs: number;
}

/**
 * Bounded eligibility projection carried by an admission receipt. The
 * flags are eligibility data only: this contract never allocates a queue
 * slot, schedules a runner or authorizes a merge from them.
 */
export interface CcpAdmissionEligibilityV1 {
  readonly queueEligible: boolean;
  readonly runnerEligible: boolean;
  readonly mergeEligible: boolean;
}

export interface CcpAdmissionReceiptV1 {
  readonly schemaVersion: typeof CCP_ADMISSION_RECEIPT_SCHEMA_V1;
  readonly candidate: CcpAdmissionCandidateV1;
  readonly candidateDigest: string;
  readonly context: CcpAdmissionContextV1;
  readonly contextDigest: string;
  /** Finite routing outcome; present only for ADMITTED receipts. */
  readonly route: CcpRiskRouteV1 | null;
  readonly disposition: CcpAdmissionDispositionV1;
  readonly reasonCode: CcpAdmissionReasonCodeV1;
  readonly eligibility: CcpAdmissionEligibilityV1;
  readonly receiptDigest: string;
}

const ADMISSION_CANDIDATE_KEYS = Object.freeze([
  "schemaVersion", "ledgerId", "tenantId", "repositoryId", "contributionId",
  "deliveryId", "headDigest", "payloadDigest", "ancestorDigest", "logicalAtMs",
  "componentId", "riskClass", "authorityProfileDigest",
]);
const ADMISSION_CONTEXT_KEYS = Object.freeze([
  "schemaVersion", "ledgerId", "tenantId", "repositoryId", "contributionId",
  "componentId", "currentHeadDigest", "currentAuthorityProfileDigest",
  "lastAdmittedLogicalAtMs",
]);
const ADMISSION_RECEIPT_KEYS = Object.freeze([
  "schemaVersion", "candidate", "candidateDigest", "context", "contextDigest",
  "route", "disposition", "reasonCode", "eligibility", "receiptDigest",
]);
const ELIGIBILITY_KEYS = Object.freeze([
  "queueEligible", "runnerEligible", "mergeEligible",
]);

const NAMESPACED_ID_SUFFIX = "[a-z0-9][a-z0-9._-]{2,95}";
const COMPONENT_ID_PATTERN = new RegExp(`^component:${NAMESPACED_ID_SUFFIX}$`);
const RISK_CLASS_PATTERN = new RegExp(`^risk:${NAMESPACED_ID_SUFFIX}$`);

function normalizeCandidate(value: unknown): CcpAdmissionCandidateV1 {
  const record = readCcpClosedObjectV1(
    value,
    ADMISSION_CANDIDATE_KEYS,
    new WeakSet(),
    "CCP_ADMISSION_CANDIDATE_SCHEMA_DENIED",
  );
  if (record.schemaVersion !== CCP_ADMISSION_CANDIDATE_SCHEMA_V1) ccpStrictDenyV1("CCP_ADMISSION_CANDIDATE_SCHEMA_DENIED");
  return Object.freeze({
    schemaVersion: CCP_ADMISSION_CANDIDATE_SCHEMA_V1,
    ledgerId: assertCcpStringV1(record.ledgerId, LEDGER_ID_PATTERN, "CCP_ADMISSION_CANDIDATE_SCHEMA_DENIED"),
    tenantId: assertCcpStringV1(record.tenantId, TENANT_ID_PATTERN, "CCP_ADMISSION_CANDIDATE_SCHEMA_DENIED"),
    repositoryId: assertCcpStringV1(
      record.repositoryId,
      REPOSITORY_ID_PATTERN,
      "CCP_ADMISSION_CANDIDATE_SCHEMA_DENIED",
    ),
    contributionId: assertCcpStringV1(
      record.contributionId,
      CONTRIBUTION_ID_PATTERN,
      "CCP_ADMISSION_CANDIDATE_SCHEMA_DENIED",
    ),
    deliveryId: assertCcpStringV1(record.deliveryId, DELIVERY_ID_PATTERN, "CCP_ADMISSION_CANDIDATE_SCHEMA_DENIED"),
    headDigest: assertCcpDigestV1(record.headDigest, "CCP_ADMISSION_CANDIDATE_SCHEMA_DENIED"),
    payloadDigest: assertCcpDigestV1(record.payloadDigest, "CCP_ADMISSION_CANDIDATE_SCHEMA_DENIED"),
    ancestorDigest: assertCcpNullableDigestV1(record.ancestorDigest, "CCP_ADMISSION_CANDIDATE_SCHEMA_DENIED"),
    logicalAtMs: assertCcpSafeUnsignedIntegerV1(record.logicalAtMs, "CCP_ADMISSION_CANDIDATE_SCHEMA_DENIED"),
    componentId: assertCcpStringV1(record.componentId, COMPONENT_ID_PATTERN, "CCP_ADMISSION_CANDIDATE_SCHEMA_DENIED"),
    riskClass: assertCcpStringV1(record.riskClass, RISK_CLASS_PATTERN, "CCP_ADMISSION_CANDIDATE_SCHEMA_DENIED"),
    authorityProfileDigest: assertCcpDigestV1(record.authorityProfileDigest, "CCP_ADMISSION_CANDIDATE_SCHEMA_DENIED"),
  });
}

function normalizeContext(value: unknown): CcpAdmissionContextV1 {
  const record = readCcpClosedObjectV1(
    value,
    ADMISSION_CONTEXT_KEYS,
    new WeakSet(),
    "CCP_ADMISSION_CONTEXT_SCHEMA_DENIED",
  );
  if (record.schemaVersion !== CCP_ADMISSION_CONTEXT_SCHEMA_V1) ccpStrictDenyV1("CCP_ADMISSION_CONTEXT_SCHEMA_DENIED");
  return Object.freeze({
    schemaVersion: CCP_ADMISSION_CONTEXT_SCHEMA_V1,
    ledgerId: assertCcpStringV1(record.ledgerId, LEDGER_ID_PATTERN, "CCP_ADMISSION_CONTEXT_SCHEMA_DENIED"),
    tenantId: assertCcpStringV1(record.tenantId, TENANT_ID_PATTERN, "CCP_ADMISSION_CONTEXT_SCHEMA_DENIED"),
    repositoryId: assertCcpStringV1(
      record.repositoryId,
      REPOSITORY_ID_PATTERN,
      "CCP_ADMISSION_CONTEXT_SCHEMA_DENIED",
    ),
    contributionId: assertCcpStringV1(
      record.contributionId,
      CONTRIBUTION_ID_PATTERN,
      "CCP_ADMISSION_CONTEXT_SCHEMA_DENIED",
    ),
    componentId: assertCcpStringV1(record.componentId, COMPONENT_ID_PATTERN, "CCP_ADMISSION_CONTEXT_SCHEMA_DENIED"),
    currentHeadDigest: assertCcpDigestV1(record.currentHeadDigest, "CCP_ADMISSION_CONTEXT_SCHEMA_DENIED"),
    currentAuthorityProfileDigest: assertCcpDigestV1(
      record.currentAuthorityProfileDigest,
      "CCP_ADMISSION_CONTEXT_SCHEMA_DENIED",
    ),
    lastAdmittedLogicalAtMs: assertCcpSafeUnsignedIntegerV1(
      record.lastAdmittedLogicalAtMs,
      "CCP_ADMISSION_CONTEXT_SCHEMA_DENIED",
    ),
  });
}

interface CcpAdmissionDecisionV1 {
  readonly disposition: CcpAdmissionDispositionV1;
  readonly reasonCode: CcpAdmissionReasonCodeV1;
  readonly route: CcpRiskRouteV1 | null;
}

/**
 * Finite closed gate decision. Checks are ordered and deterministic; the
 * first failing check wins and quarantines fail-closed with its closed
 * reason code. Unknown identities, components and risk classes deny before
 * any routing outcome exists.
 */
function deriveDecision(
  candidate: CcpAdmissionCandidateV1,
  context: CcpAdmissionContextV1,
): CcpAdmissionDecisionV1 {
  if (candidate.ledgerId !== context.ledgerId
    || candidate.tenantId !== context.tenantId
    || candidate.repositoryId !== context.repositoryId
    || candidate.contributionId !== context.contributionId) {
    return { disposition: "QUARANTINED", reasonCode: "IDENTITY_MISMATCH", route: null };
  }
  if (!(CCP_COMPONENT_IDS_V1 as readonly string[]).includes(candidate.componentId)) {
    return { disposition: "QUARANTINED", reasonCode: "UNKNOWN_COMPONENT", route: null };
  }
  if (!(CCP_RISK_CLASSES_V1 as readonly string[]).includes(candidate.riskClass)) {
    return { disposition: "QUARANTINED", reasonCode: "UNKNOWN_RISK_CLASS", route: null };
  }
  if (candidate.componentId !== context.componentId) {
    return { disposition: "QUARANTINED", reasonCode: "SCOPE_SUBSTITUTION", route: null };
  }
  if (candidate.logicalAtMs < context.lastAdmittedLogicalAtMs) {
    return { disposition: "QUARANTINED", reasonCode: "STALE_LOGICAL_TIME", route: null };
  }
  if (candidate.headDigest === context.currentHeadDigest) {
    return { disposition: "QUARANTINED", reasonCode: "STALE_HEAD_REPLAY", route: null };
  }
  if (candidate.riskClass === "risk:malicious") {
    return { disposition: "QUARANTINED", reasonCode: "MALICIOUS_RISK_CLASS", route: null };
  }
  if (candidate.authorityProfileDigest !== context.currentAuthorityProfileDigest) {
    return { disposition: "QUARANTINED", reasonCode: "AUTHORITY_CHANGE", route: null };
  }
  return {
    disposition: "ADMITTED",
    reasonCode: "ADMITTED_ROUTE_ASSIGNED",
    route: resolveCcpRiskRouteV1(candidate.componentId, candidate.riskClass),
  };
}

/**
 * Eligibility projection: a QUARANTINED receipt grants nothing; an ADMITTED
 * receipt inherits the bounded flags of its finite route. Merge eligibility
 * is never granted by the gate: it is always false.
 */
function deriveEligibility(decision: CcpAdmissionDecisionV1): CcpAdmissionEligibilityV1 {
  if (decision.disposition !== "ADMITTED" || decision.route === null) {
    return Object.freeze({ queueEligible: false, runnerEligible: false, mergeEligible: false });
  }
  return Object.freeze({
    queueEligible: decision.route.queueEligible,
    runnerEligible: decision.route.runnerEligible,
    mergeEligible: decision.route.mergeEligible,
  });
}

function makeCcpAdmissionReceiptV1(
  candidate: CcpAdmissionCandidateV1,
  context: CcpAdmissionContextV1,
): CcpAdmissionReceiptV1 {
  const decision = deriveDecision(candidate, context);
  const unsigned = Object.freeze({
    schemaVersion: CCP_ADMISSION_RECEIPT_SCHEMA_V1,
    candidate,
    candidateDigest: ccpDigestDomainV1(CCP_ADMISSION_CANDIDATE_SCHEMA_V1, candidate),
    context,
    contextDigest: ccpDigestDomainV1(CCP_ADMISSION_CONTEXT_SCHEMA_V1, context),
    route: decision.route,
    disposition: decision.disposition,
    reasonCode: decision.reasonCode,
    eligibility: deriveEligibility(decision),
  });
  return Object.freeze({
    ...unsigned,
    receiptDigest: ccpDigestDomainV1(CCP_ADMISSION_RECEIPT_SCHEMA_V1, unsigned),
  });
}

function assertAdmissionDispositionV1(value: unknown): CcpAdmissionDispositionV1 {
  if (typeof value !== "string"
    || !(CCP_ADMISSION_DISPOSITIONS_V1 as readonly string[]).includes(value)) {
    ccpStrictDenyV1("CCP_ADMISSION_RECEIPT_SCHEMA_DENIED");
  }
  return value as CcpAdmissionDispositionV1;
}

function assertAdmissionReasonCodeV1(value: unknown): CcpAdmissionReasonCodeV1 {
  if (typeof value !== "string"
    || !(CCP_ADMISSION_REASON_CODES_V1 as readonly string[]).includes(value)) {
    ccpStrictDenyV1("CCP_ADMISSION_RECEIPT_SCHEMA_DENIED");
  }
  return value as CcpAdmissionReasonCodeV1;
}

function normalizeEligibility(value: unknown): CcpAdmissionEligibilityV1 {
  const record = readCcpClosedObjectV1(
    value,
    ELIGIBILITY_KEYS,
    new WeakSet(),
    "CCP_ADMISSION_RECEIPT_SCHEMA_DENIED",
  );
  if (typeof record.queueEligible !== "boolean"
    || typeof record.runnerEligible !== "boolean"
    || typeof record.mergeEligible !== "boolean") {
    ccpStrictDenyV1("CCP_ADMISSION_RECEIPT_SCHEMA_DENIED");
  }
  return Object.freeze({
    queueEligible: record.queueEligible,
    runnerEligible: record.runnerEligible,
    mergeEligible: record.mergeEligible,
  });
}

/**
 * Parse and close an admission candidate. The returned candidate is frozen
 * and independent of its input; malformed input denies with a TypeError
 * carrying a closed denial code before any gate decision or receipt exists.
 */
export function parseCcpAdmissionCandidateV1(value: unknown): CcpAdmissionCandidateV1 {
  return normalizeCandidate(value);
}

/**
 * Parse and close a bound trust context. Malformed input denies with a
 * TypeError carrying a closed denial code before any gate decision exists.
 */
export function parseCcpAdmissionContextV1(value: unknown): CcpAdmissionContextV1 {
  return normalizeContext(value);
}

/** Domain-bound content digest of the closed candidate. */
export function ccpCandidateDigestV1(value: unknown): string {
  return ccpDigestDomainV1(CCP_ADMISSION_CANDIDATE_SCHEMA_V1, normalizeCandidate(value));
}

/** Domain-bound content digest of the closed trust context. */
export function ccpContextDigestV1(value: unknown): string {
  return ccpDigestDomainV1(CCP_ADMISSION_CONTEXT_SCHEMA_V1, normalizeContext(value));
}

/** Canonical JSON of the closed candidate; byte order independent of input key order. */
export function canonicalCcpAdmissionCandidateJsonV1(value: unknown): string {
  return canonicalJson(normalizeCandidate(value));
}

/** Canonical JSON of the closed trust context; byte order independent of input key order. */
export function canonicalCcpAdmissionContextJsonV1(value: unknown): string {
  return canonicalJson(normalizeContext(value));
}

/**
 * Evaluate the pure admission gate. Malformed candidates or contexts deny
 * before any receipt exists; otherwise the receipt is deterministic,
 * frozen and digest-bound. Evaluating never allocates a queue slot,
 * schedules a runner, executes code or authorizes a merge.
 */
export function evaluateCcpAdmissionGateV1(
  candidate: unknown,
  context: unknown,
): CcpAdmissionReceiptV1 {
  return makeCcpAdmissionReceiptV1(normalizeCandidate(candidate), normalizeContext(context));
}

/**
 * Parse and close an admission receipt. The receipt is re-derived from its
 * closed candidate and context: any drift in disposition, reason code,
 * route, eligibility, digests or the receipt digest denies with a closed
 * denial code. The invariant disposition ADMITTED iff route present holds.
 */
export function parseCcpAdmissionReceiptV1(value: unknown): CcpAdmissionReceiptV1 {
  const record = readCcpClosedObjectV1(
    value,
    ADMISSION_RECEIPT_KEYS,
    new WeakSet(),
    "CCP_ADMISSION_RECEIPT_SCHEMA_DENIED",
  );
  if (record.schemaVersion !== CCP_ADMISSION_RECEIPT_SCHEMA_V1) ccpStrictDenyV1("CCP_ADMISSION_RECEIPT_SCHEMA_DENIED");
  const candidate = normalizeCandidate(record.candidate);
  const context = normalizeContext(record.context);
  const route = record.route === null ? null : parseCcpRiskRouteV1(record.route);
  const disposition = assertAdmissionDispositionV1(record.disposition);
  const reasonCode = assertAdmissionReasonCodeV1(record.reasonCode);
  const eligibility = normalizeEligibility(record.eligibility);
  if ((disposition === "ADMITTED") !== (route !== null)) ccpStrictDenyV1("CCP_ADMISSION_RECEIPT_SCHEMA_DENIED");
  if (disposition === "QUARANTINED"
    && (eligibility.queueEligible || eligibility.runnerEligible || eligibility.mergeEligible)) {
    ccpStrictDenyV1("CCP_ADMISSION_RECEIPT_SCHEMA_DENIED");
  }
  const expected = makeCcpAdmissionReceiptV1(candidate, context);
  const unsignedRecord: Record<string, unknown> = {
    schemaVersion: record.schemaVersion,
    candidate,
    candidateDigest: record.candidateDigest,
    context,
    contextDigest: record.contextDigest,
    route,
    disposition,
    reasonCode,
    eligibility,
  };
  const expectedUnsigned: Record<string, unknown> = { ...expected };
  delete expectedUnsigned.receiptDigest;
  if (canonicalJson(unsignedRecord) !== canonicalJson(expectedUnsigned)) ccpStrictDenyV1("CCP_ADMISSION_RECEIPT_SCHEMA_DENIED");
  if (typeof record.receiptDigest !== "string" || record.receiptDigest !== expected.receiptDigest) {
    ccpStrictDenyV1("CCP_ADMISSION_RECEIPT_SCHEMA_DENIED");
  }
  return expected;
}

/** Canonical JSON of the closed receipt; byte order independent of input key order. */
export function canonicalCcpAdmissionReceiptJsonV1(value: unknown): string {
  return canonicalJson(parseCcpAdmissionReceiptV1(value));
}

/** Domain-bound content digest of the closed receipt. */
export function ccpAdmissionReceiptDigestV1(value: unknown): string {
  return ccpDigestDomainV1(CCP_ADMISSION_RECEIPT_SCHEMA_V1, parseCcpAdmissionReceiptV1(value));
}

/**
 * Verify an admission receipt on read-back. Returns the closed receipt on
 * success; returns null when the receipt is malformed or forged (any
 * rehashed drift in disposition, reason, route, eligibility, digests or
 * the receipt digest).
 */
export function verifyCcpAdmissionReceiptV1(value: unknown): CcpAdmissionReceiptV1 | null {
  try {
    return parseCcpAdmissionReceiptV1(value);
  } catch {
    return null;
  }
}