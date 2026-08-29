import { canonicalJson } from "./canonical-json.js";
import {
  assertCcpDigestV1,
  assertCcpSafePositiveIntegerV1,
  assertCcpSafeUnsignedIntegerV1,
  assertCcpStringV1,
  ccpDigestDomainV1,
  ccpStrictDenyV1,
  CONTRIBUTION_ID_PATTERN,
  LEDGER_ID_PATTERN,
  readCcpClosedObjectV1,
  REPOSITORY_ID_PATTERN,
  TENANT_ID_PATTERN,
} from "./ccp-event-envelope.js";

/**
 * CCP PSAI52 runner-lease boundary. This contract models allocation labels
 * for a deterministic, ephemeral and isolated runner using only injected
 * request/context data. It does not start a runner, execute tests, mutate a
 * cache, authorize a merge, read a clock, inspect the network or read a
 * secret. The digest values are consistency bindings, not authentication.
 */

export const CCP_RUNNER_LEASE_REQUEST_SCHEMA_V1 = "cm.ccp-runner-lease-request/v1" as const;
export const CCP_RUNNER_LEASE_CONTEXT_SCHEMA_V1 = "cm.ccp-runner-lease-context/v1" as const;
export const CCP_RUNNER_LEASE_RECEIPT_SCHEMA_V1 = "cm.ccp-runner-lease-receipt/v1" as const;
export const CCP_RUNNER_LEASE_SCHEMA_V1 = "cm.ccp-runner-lease/v1" as const;

export type CcpRunnerLeaseDispositionV1 = "LEASED" | "DENIED";
export type CcpRunnerLeaseTransitionV1 = "LEASE_ISSUED" | "LEASE_DENIED";
export type CcpRunnerLeaseReasonCodeV1 =
  | "LEASE_ISSUED_EPHEMERAL_ISOLATED"
  | "IDENTITY_MISMATCH"
  | "ACTIVE_LEASE_PRESENT"
  | "LEASE_ORDINAL_REPLAY"
  | "STALE_LOGICAL_TIME"
  | "NON_ISOLATED_RUNNER"
  | "NETWORK_ACCESS_REQUESTED"
  | "SECRET_ACCESS_REQUESTED"
  | "MERGE_AUTHORITY_REQUESTED";

export const CCP_RUNNER_LEASE_DISPOSITIONS_V1 = Object.freeze([
  "LEASED",
  "DENIED",
]) as readonly CcpRunnerLeaseDispositionV1[];
export const CCP_RUNNER_LEASE_TRANSITIONS_V1 = Object.freeze([
  "LEASE_ISSUED",
  "LEASE_DENIED",
]) as readonly CcpRunnerLeaseTransitionV1[];
export const CCP_RUNNER_LEASE_REASON_CODES_V1 = Object.freeze([
  "LEASE_ISSUED_EPHEMERAL_ISOLATED",
  "IDENTITY_MISMATCH",
  "ACTIVE_LEASE_PRESENT",
  "LEASE_ORDINAL_REPLAY",
  "STALE_LOGICAL_TIME",
  "NON_ISOLATED_RUNNER",
  "NETWORK_ACCESS_REQUESTED",
  "SECRET_ACCESS_REQUESTED",
  "MERGE_AUTHORITY_REQUESTED",
]) as readonly CcpRunnerLeaseReasonCodeV1[];

export interface CcpRunnerLeaseRequestV1 {
  readonly schemaVersion: typeof CCP_RUNNER_LEASE_REQUEST_SCHEMA_V1;
  readonly ledgerId: string;
  readonly tenantId: string;
  readonly repositoryId: string;
  readonly contributionId: string;
  readonly candidateDigest: string;
  readonly admissionReceiptDigest: string;
  readonly runnerProfileDigest: string;
  /** Injected logical time; never read from a wall clock. */
  readonly logicalAtMs: number;
  readonly leaseOrdinal: number;
  readonly leaseDurationMs: number;
  readonly isolationMode: "EPHEMERAL_ISOLATED" | "SHARED";
  readonly networkPolicy: "DENY_ALL" | "REQUESTED";
  readonly secretPolicy: "DENY_ALL" | "REQUESTED";
  readonly mergeAuthority: "NONE" | "REQUESTED";
}

export interface CcpRunnerLeaseContextV1 {
  readonly schemaVersion: typeof CCP_RUNNER_LEASE_CONTEXT_SCHEMA_V1;
  readonly ledgerId: string;
  readonly tenantId: string;
  readonly repositoryId: string;
  readonly contributionId: string;
  readonly nextLeaseOrdinal: number;
  readonly lastIssuedLogicalAtMs: number;
  readonly activeLeaseId: string | null;
}

export interface CcpRunnerLeaseV1 {
  readonly schemaVersion: typeof CCP_RUNNER_LEASE_SCHEMA_V1;
  readonly leaseId: string;
  readonly leaseOrdinal: number;
  readonly candidateDigest: string;
  readonly admissionReceiptDigest: string;
  readonly runnerProfileDigest: string;
  readonly issuedAtMs: number;
  readonly expiresAtMs: number;
  readonly ephemeral: true;
  readonly isolated: true;
}

export interface CcpRunnerLeaseEligibilityV1 {
  /** Allocation eligibility only; it is not execution authority. */
  readonly runnerEligible: boolean;
  readonly executionAuthorized: false;
  readonly mergeAuthorized: false;
  readonly networkExposed: false;
  readonly secretsExposed: false;
}

export interface CcpRunnerLeaseReceiptV1 {
  readonly schemaVersion: typeof CCP_RUNNER_LEASE_RECEIPT_SCHEMA_V1;
  readonly request: CcpRunnerLeaseRequestV1;
  readonly requestDigest: string;
  readonly context: CcpRunnerLeaseContextV1;
  readonly contextDigest: string;
  readonly lease: CcpRunnerLeaseV1 | null;
  readonly disposition: CcpRunnerLeaseDispositionV1;
  readonly transition: CcpRunnerLeaseTransitionV1;
  readonly reasonCode: CcpRunnerLeaseReasonCodeV1;
  readonly eligibility: CcpRunnerLeaseEligibilityV1;
  readonly receiptDigest: string;
}

const REQUEST_KEYS = Object.freeze([
  "schemaVersion", "ledgerId", "tenantId", "repositoryId", "contributionId",
  "candidateDigest", "admissionReceiptDigest", "runnerProfileDigest", "logicalAtMs",
  "leaseOrdinal", "leaseDurationMs", "isolationMode", "networkPolicy", "secretPolicy",
  "mergeAuthority",
]);
const CONTEXT_KEYS = Object.freeze([
  "schemaVersion", "ledgerId", "tenantId", "repositoryId", "contributionId",
  "nextLeaseOrdinal", "lastIssuedLogicalAtMs", "activeLeaseId",
]);
const LEASE_KEYS = Object.freeze([
  "schemaVersion", "leaseId", "leaseOrdinal", "candidateDigest", "admissionReceiptDigest",
  "runnerProfileDigest", "issuedAtMs", "expiresAtMs", "ephemeral", "isolated",
]);
const ELIGIBILITY_KEYS = Object.freeze([
  "runnerEligible", "executionAuthorized", "mergeAuthorized", "networkExposed", "secretsExposed",
]);
const RECEIPT_KEYS = Object.freeze([
  "schemaVersion", "request", "requestDigest", "context", "contextDigest", "lease",
  "disposition", "transition", "reasonCode", "eligibility", "receiptDigest",
]);
const LEASE_ID_PATTERN = /^lease:[a-f0-9]{64}$/;
const REQUEST_DENIED = "CCP_RUNNER_LEASE_REQUEST_SCHEMA_DENIED";
const CONTEXT_DENIED = "CCP_RUNNER_LEASE_CONTEXT_SCHEMA_DENIED";
const RECEIPT_DENIED = "CCP_RUNNER_LEASE_RECEIPT_SCHEMA_DENIED";
const ISOLATION_MODES = Object.freeze(["EPHEMERAL_ISOLATED", "SHARED"]);
const NETWORK_POLICIES = Object.freeze(["DENY_ALL", "REQUESTED"]);
const SECRET_POLICIES = Object.freeze(["DENY_ALL", "REQUESTED"]);
const MERGE_AUTHORITIES = Object.freeze(["NONE", "REQUESTED"]);

type DataRecord = Readonly<Record<string, unknown>>;

function enumValue<T extends string>(value: unknown, values: readonly string[], code: string): T {
  if (typeof value !== "string" || !values.includes(value)) ccpStrictDenyV1(code);
  return value as T;
}

function identity(record: DataRecord, code: string): {
  ledgerId: string;
  tenantId: string;
  repositoryId: string;
  contributionId: string;
} {
  return {
    ledgerId: assertCcpStringV1(record.ledgerId, LEDGER_ID_PATTERN, code),
    tenantId: assertCcpStringV1(record.tenantId, TENANT_ID_PATTERN, code),
    repositoryId: assertCcpStringV1(record.repositoryId, REPOSITORY_ID_PATTERN, code),
    contributionId: assertCcpStringV1(record.contributionId, CONTRIBUTION_ID_PATTERN, code),
  };
}

export function parseCcpRunnerLeaseRequestV1(value: unknown): CcpRunnerLeaseRequestV1 {
  const record = readCcpClosedObjectV1(value, REQUEST_KEYS, new WeakSet(), REQUEST_DENIED);
  if (record.schemaVersion !== CCP_RUNNER_LEASE_REQUEST_SCHEMA_V1) ccpStrictDenyV1(REQUEST_DENIED);
  return Object.freeze({
    schemaVersion: CCP_RUNNER_LEASE_REQUEST_SCHEMA_V1,
    ...identity(record, REQUEST_DENIED),
    candidateDigest: assertCcpDigestV1(record.candidateDigest, REQUEST_DENIED),
    admissionReceiptDigest: assertCcpDigestV1(record.admissionReceiptDigest, REQUEST_DENIED),
    runnerProfileDigest: assertCcpDigestV1(record.runnerProfileDigest, REQUEST_DENIED),
    logicalAtMs: assertCcpSafeUnsignedIntegerV1(record.logicalAtMs, REQUEST_DENIED),
    leaseOrdinal: assertCcpSafePositiveIntegerV1(record.leaseOrdinal, REQUEST_DENIED),
    leaseDurationMs: assertCcpSafePositiveIntegerV1(record.leaseDurationMs, REQUEST_DENIED),
    isolationMode: enumValue(record.isolationMode, ISOLATION_MODES, REQUEST_DENIED) as "EPHEMERAL_ISOLATED" | "SHARED",
    networkPolicy: enumValue(record.networkPolicy, NETWORK_POLICIES, REQUEST_DENIED) as "DENY_ALL" | "REQUESTED",
    secretPolicy: enumValue(record.secretPolicy, SECRET_POLICIES, REQUEST_DENIED) as "DENY_ALL" | "REQUESTED",
    mergeAuthority: enumValue(record.mergeAuthority, MERGE_AUTHORITIES, REQUEST_DENIED) as "NONE" | "REQUESTED",
  });
}

export function parseCcpRunnerLeaseContextV1(value: unknown): CcpRunnerLeaseContextV1 {
  const record = readCcpClosedObjectV1(value, CONTEXT_KEYS, new WeakSet(), CONTEXT_DENIED);
  if (record.schemaVersion !== CCP_RUNNER_LEASE_CONTEXT_SCHEMA_V1) ccpStrictDenyV1(CONTEXT_DENIED);
  return Object.freeze({
    schemaVersion: CCP_RUNNER_LEASE_CONTEXT_SCHEMA_V1,
    ...identity(record, CONTEXT_DENIED),
    nextLeaseOrdinal: assertCcpSafePositiveIntegerV1(record.nextLeaseOrdinal, CONTEXT_DENIED),
    lastIssuedLogicalAtMs: assertCcpSafeUnsignedIntegerV1(record.lastIssuedLogicalAtMs, CONTEXT_DENIED),
    activeLeaseId: record.activeLeaseId === null
      ? null
      : assertCcpStringV1(record.activeLeaseId, LEASE_ID_PATTERN, CONTEXT_DENIED),
  });
}

function leaseId(request: CcpRunnerLeaseRequestV1, context: CcpRunnerLeaseContextV1): string {
  return `lease:${ccpDigestDomainV1(CCP_RUNNER_LEASE_SCHEMA_V1, {
    ledgerId: request.ledgerId,
    tenantId: request.tenantId,
    repositoryId: request.repositoryId,
    contributionId: request.contributionId,
    candidateDigest: request.candidateDigest,
    runnerProfileDigest: request.runnerProfileDigest,
    leaseOrdinal: request.leaseOrdinal,
    contextNextLeaseOrdinal: context.nextLeaseOrdinal,
  })}`;
}

function decision(request: CcpRunnerLeaseRequestV1, context: CcpRunnerLeaseContextV1): {
  disposition: CcpRunnerLeaseDispositionV1;
  transition: CcpRunnerLeaseTransitionV1;
  reasonCode: CcpRunnerLeaseReasonCodeV1;
} {
  if (request.ledgerId !== context.ledgerId || request.tenantId !== context.tenantId
    || request.repositoryId !== context.repositoryId || request.contributionId !== context.contributionId) {
    // The closed identity namespaces make this a deterministic denial rather
    // than an implicit cross-tenant or cross-repository lease.
    return { disposition: "DENIED", transition: "LEASE_DENIED", reasonCode: "IDENTITY_MISMATCH" };
  }
  if (request.isolationMode !== "EPHEMERAL_ISOLATED") {
    return { disposition: "DENIED", transition: "LEASE_DENIED", reasonCode: "NON_ISOLATED_RUNNER" };
  }
  if (request.networkPolicy !== "DENY_ALL") {
    return { disposition: "DENIED", transition: "LEASE_DENIED", reasonCode: "NETWORK_ACCESS_REQUESTED" };
  }
  if (request.secretPolicy !== "DENY_ALL") {
    return { disposition: "DENIED", transition: "LEASE_DENIED", reasonCode: "SECRET_ACCESS_REQUESTED" };
  }
  if (request.mergeAuthority !== "NONE") {
    return { disposition: "DENIED", transition: "LEASE_DENIED", reasonCode: "MERGE_AUTHORITY_REQUESTED" };
  }
  if (context.activeLeaseId !== null) {
    return { disposition: "DENIED", transition: "LEASE_DENIED", reasonCode: "ACTIVE_LEASE_PRESENT" };
  }
  if (request.leaseOrdinal !== context.nextLeaseOrdinal) {
    return { disposition: "DENIED", transition: "LEASE_DENIED", reasonCode: "LEASE_ORDINAL_REPLAY" };
  }
  if (request.logicalAtMs <= context.lastIssuedLogicalAtMs) {
    return { disposition: "DENIED", transition: "LEASE_DENIED", reasonCode: "STALE_LOGICAL_TIME" };
  }
  return {
    disposition: "LEASED",
    transition: "LEASE_ISSUED",
    reasonCode: "LEASE_ISSUED_EPHEMERAL_ISOLATED",
  };
}

function makeReceipt(
  request: CcpRunnerLeaseRequestV1,
  context: CcpRunnerLeaseContextV1,
): CcpRunnerLeaseReceiptV1 {
  const result = decision(request, context);
  const requestDigest = ccpDigestDomainV1(CCP_RUNNER_LEASE_REQUEST_SCHEMA_V1, request);
  const contextDigest = ccpDigestDomainV1(CCP_RUNNER_LEASE_CONTEXT_SCHEMA_V1, context);
  const id = leaseId(request, context);
  const expiresAtMs = request.logicalAtMs + request.leaseDurationMs;
  if (!Number.isSafeInteger(expiresAtMs)) ccpStrictDenyV1(REQUEST_DENIED);
  const lease = result.disposition === "LEASED" ? Object.freeze({
    schemaVersion: CCP_RUNNER_LEASE_SCHEMA_V1,
    leaseId: id,
    leaseOrdinal: request.leaseOrdinal,
    candidateDigest: request.candidateDigest,
    admissionReceiptDigest: request.admissionReceiptDigest,
    runnerProfileDigest: request.runnerProfileDigest,
    issuedAtMs: request.logicalAtMs,
    expiresAtMs,
    ephemeral: true as const,
    isolated: true as const,
  }) : null;
  const eligibility = Object.freeze({
    runnerEligible: result.disposition === "LEASED",
    executionAuthorized: false as const,
    mergeAuthorized: false as const,
    networkExposed: false as const,
    secretsExposed: false as const,
  });
  const unsigned = Object.freeze({
    schemaVersion: CCP_RUNNER_LEASE_RECEIPT_SCHEMA_V1,
    request,
    requestDigest,
    context,
    contextDigest,
    lease,
    disposition: result.disposition,
    transition: result.transition,
    reasonCode: result.reasonCode,
    eligibility,
  });
  return Object.freeze({
    ...unsigned,
    receiptDigest: ccpDigestDomainV1(CCP_RUNNER_LEASE_RECEIPT_SCHEMA_V1, unsigned),
  });
}

/** Evaluate an injected lease request against injected lease state. */
export function evaluateCcpRunnerLeaseV1(request: unknown, context: unknown): CcpRunnerLeaseReceiptV1 {
  return makeReceipt(parseCcpRunnerLeaseRequestV1(request), parseCcpRunnerLeaseContextV1(context));
}

function normalizeLease(value: unknown): CcpRunnerLeaseV1 {
  const record = readCcpClosedObjectV1(value, LEASE_KEYS, new WeakSet(), RECEIPT_DENIED);
  if (record.schemaVersion !== CCP_RUNNER_LEASE_SCHEMA_V1 || record.ephemeral !== true || record.isolated !== true) ccpStrictDenyV1(RECEIPT_DENIED);
  const issuedAtMs = assertCcpSafeUnsignedIntegerV1(record.issuedAtMs, RECEIPT_DENIED);
  const expiresAtMs = assertCcpSafePositiveIntegerV1(record.expiresAtMs, RECEIPT_DENIED);
  if (expiresAtMs <= issuedAtMs) ccpStrictDenyV1(RECEIPT_DENIED);
  return Object.freeze({
    schemaVersion: CCP_RUNNER_LEASE_SCHEMA_V1,
    leaseId: assertCcpStringV1(record.leaseId, LEASE_ID_PATTERN, RECEIPT_DENIED),
    leaseOrdinal: assertCcpSafePositiveIntegerV1(record.leaseOrdinal, RECEIPT_DENIED),
    candidateDigest: assertCcpDigestV1(record.candidateDigest, RECEIPT_DENIED),
    admissionReceiptDigest: assertCcpDigestV1(record.admissionReceiptDigest, RECEIPT_DENIED),
    runnerProfileDigest: assertCcpDigestV1(record.runnerProfileDigest, RECEIPT_DENIED),
    issuedAtMs,
    expiresAtMs,
    ephemeral: true,
    isolated: true,
  });
}

function normalizeEligibility(value: unknown): CcpRunnerLeaseEligibilityV1 {
  const record = readCcpClosedObjectV1(value, ELIGIBILITY_KEYS, new WeakSet(), RECEIPT_DENIED);
  if (typeof record.runnerEligible !== "boolean" || record.executionAuthorized !== false
    || record.mergeAuthorized !== false || record.networkExposed !== false || record.secretsExposed !== false) {
    ccpStrictDenyV1(RECEIPT_DENIED);
  }
  return Object.freeze({
    runnerEligible: record.runnerEligible,
    executionAuthorized: false,
    mergeAuthorized: false,
    networkExposed: false,
    secretsExposed: false,
  });
}

/** Parse and verify the complete receipt, re-deriving every transition. */
export function parseCcpRunnerLeaseReceiptV1(value: unknown): CcpRunnerLeaseReceiptV1 {
  const record = readCcpClosedObjectV1(value, RECEIPT_KEYS, new WeakSet(), RECEIPT_DENIED);
  if (record.schemaVersion !== CCP_RUNNER_LEASE_RECEIPT_SCHEMA_V1) ccpStrictDenyV1(RECEIPT_DENIED);
  const request = parseCcpRunnerLeaseRequestV1(record.request);
  const context = parseCcpRunnerLeaseContextV1(record.context);
  const requestDigest = assertCcpDigestV1(record.requestDigest, RECEIPT_DENIED);
  const contextDigest = assertCcpDigestV1(record.contextDigest, RECEIPT_DENIED);
  if (requestDigest !== ccpDigestDomainV1(CCP_RUNNER_LEASE_REQUEST_SCHEMA_V1, request)
    || contextDigest !== ccpDigestDomainV1(CCP_RUNNER_LEASE_CONTEXT_SCHEMA_V1, context)) ccpStrictDenyV1(RECEIPT_DENIED);
  const expected = decision(request, context);
  if (record.disposition !== expected.disposition || record.transition !== expected.transition
    || record.reasonCode !== expected.reasonCode) ccpStrictDenyV1(RECEIPT_DENIED);
  if (!(CCP_RUNNER_LEASE_DISPOSITIONS_V1 as readonly string[]).includes(record.disposition as string)
    || !(CCP_RUNNER_LEASE_TRANSITIONS_V1 as readonly string[]).includes(record.transition as string)
    || !(CCP_RUNNER_LEASE_REASON_CODES_V1 as readonly string[]).includes(record.reasonCode as string)) ccpStrictDenyV1(RECEIPT_DENIED);
  const lease = record.lease === null ? null : normalizeLease(record.lease);
  const expectedLease = expected.disposition === "LEASED" ? makeReceipt(request, context).lease : null;
  if ((lease === null) !== (expectedLease === null)) ccpStrictDenyV1(RECEIPT_DENIED);
  if (lease !== null && canonicalJson(lease) !== canonicalJson(expectedLease)) ccpStrictDenyV1(RECEIPT_DENIED);
  const eligibility = normalizeEligibility(record.eligibility);
  if (eligibility.runnerEligible !== (expected.disposition === "LEASED")) ccpStrictDenyV1(RECEIPT_DENIED);
  const unsigned = Object.freeze({
    schemaVersion: CCP_RUNNER_LEASE_RECEIPT_SCHEMA_V1,
    request,
    requestDigest,
    context,
    contextDigest,
    lease,
    disposition: expected.disposition,
    transition: expected.transition,
    reasonCode: expected.reasonCode,
    eligibility,
  });
  const receiptDigest = assertCcpDigestV1(record.receiptDigest, RECEIPT_DENIED);
  if (receiptDigest !== ccpDigestDomainV1(CCP_RUNNER_LEASE_RECEIPT_SCHEMA_V1, unsigned)) ccpStrictDenyV1(RECEIPT_DENIED);
  return Object.freeze({ ...unsigned, receiptDigest });
}

export function canonicalCcpRunnerLeaseReceiptJsonV1(value: unknown): string {
  return canonicalJson(parseCcpRunnerLeaseReceiptV1(value));
}

export function ccpRunnerLeaseReceiptDigestV1(value: unknown): string {
  return parseCcpRunnerLeaseReceiptV1(value).receiptDigest;
}

export function verifyCcpRunnerLeaseReceiptV1(value: unknown): CcpRunnerLeaseReceiptV1 | null {
  try {
    return parseCcpRunnerLeaseReceiptV1(value);
  } catch {
    return null;
  }
}
