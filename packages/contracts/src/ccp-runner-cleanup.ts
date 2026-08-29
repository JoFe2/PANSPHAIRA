import { canonicalJson } from "./canonical-json.js";
import {
  assertCcpDigestV1,
  assertCcpSafeUnsignedIntegerV1,
  assertCcpStringV1,
  ccpDigestDomainV1,
  ccpStrictDenyV1,
  CONTRIBUTION_ID_PATTERN,
  LEDGER_ID_PATTERN,
  readCcpClosedObjectV1,
  readCcpDenseArrayV1,
  REPOSITORY_ID_PATTERN,
  TENANT_ID_PATTERN,
} from "./ccp-event-envelope.js";

/**
 * CCP PSAI52 mandatory cleanup boundary. A cleanup receipt is produced from
 * an injected ownership list and injected post-cleanup observation, including
 * crash paths. It is a receipt of a cleanup transition, not an implementation
 * of deletion: this module performs no filesystem/process/network operation,
 * reads no clock or secret, and cannot authorize execution or merge.
 */

export const CCP_RUNNER_CLEANUP_REQUEST_SCHEMA_V1 = "cm.ccp-runner-cleanup-request/v1" as const;
export const CCP_RUNNER_CLEANUP_OBSERVATION_SCHEMA_V1 = "cm.ccp-runner-cleanup-observation/v1" as const;
export const CCP_RUNNER_CLEANUP_RECEIPT_SCHEMA_V1 = "cm.ccp-runner-cleanup-receipt/v1" as const;

export type CcpRunnerTerminationV1 = "COMPLETED" | "CRASHED";
export type CcpRunnerCleanupOutcomeV1 = "ZERO_RESIDUE" | "RESIDUE_DETECTED";
export type CcpRunnerCleanupTransitionV1 = "CLEANUP_CONFIRMED" | "CLEANUP_FAILED";
export type CcpRunnerCleanupReasonCodeV1 =
  | "ZERO_RESIDUE_AFTER_COMPLETION"
  | "ZERO_RESIDUE_AFTER_CRASH"
  | "RESIDUE_REMAINS"
  | "CLEANUP_NOT_ATTEMPTED";

export const CCP_RUNNER_CLEANUP_OUTCOMES_V1 = Object.freeze([
  "ZERO_RESIDUE",
  "RESIDUE_DETECTED",
]) as readonly CcpRunnerCleanupOutcomeV1[];
export const CCP_RUNNER_CLEANUP_REASON_CODES_V1 = Object.freeze([
  "ZERO_RESIDUE_AFTER_COMPLETION",
  "ZERO_RESIDUE_AFTER_CRASH",
  "RESIDUE_REMAINS",
  "CLEANUP_NOT_ATTEMPTED",
]) as readonly CcpRunnerCleanupReasonCodeV1[];

export interface CcpRunnerCleanupRequestV1 {
  readonly schemaVersion: typeof CCP_RUNNER_CLEANUP_REQUEST_SCHEMA_V1;
  readonly ledgerId: string;
  readonly tenantId: string;
  readonly repositoryId: string;
  readonly contributionId: string;
  readonly leaseId: string;
  readonly leaseReceiptDigest: string;
  readonly termination: CcpRunnerTerminationV1;
  /** Closed, path-free identifiers of resources owned by the ephemeral lease. */
  readonly ownedResourceRefs: readonly string[];
  /** Injected logical time at which cleanup was requested. */
  readonly logicalAtMs: number;
}

export interface CcpRunnerCleanupObservationV1 {
  readonly schemaVersion: typeof CCP_RUNNER_CLEANUP_OBSERVATION_SCHEMA_V1;
  readonly leaseId: string;
  readonly cleanupAttempted: boolean;
  /** Closed, path-free identifiers observed after cleanup. */
  readonly remainingResourceRefs: readonly string[];
  /** Injected observation time; never read from a wall clock. */
  readonly logicalAtMs: number;
}

export interface CcpRunnerCleanupReceiptV1 {
  readonly schemaVersion: typeof CCP_RUNNER_CLEANUP_RECEIPT_SCHEMA_V1;
  readonly request: CcpRunnerCleanupRequestV1;
  readonly requestDigest: string;
  readonly observation: CcpRunnerCleanupObservationV1;
  readonly observationDigest: string;
  readonly outcome: CcpRunnerCleanupOutcomeV1;
  readonly transition: CcpRunnerCleanupTransitionV1;
  readonly reasonCode: CcpRunnerCleanupReasonCodeV1;
  readonly remainingResourceCount: number;
  readonly zeroResidue: boolean;
  /** Cleanup is mandatory for both COMPLETED and CRASHED terminations. */
  readonly cleanupRequired: true;
  readonly runnerReleased: boolean;
  readonly executionAuthorized: false;
  readonly mergeAuthorized: false;
  readonly receiptDigest: string;
}

const REQUEST_KEYS = Object.freeze([
  "schemaVersion", "ledgerId", "tenantId", "repositoryId", "contributionId", "leaseId",
  "leaseReceiptDigest", "termination", "ownedResourceRefs", "logicalAtMs",
]);
const OBSERVATION_KEYS = Object.freeze([
  "schemaVersion", "leaseId", "cleanupAttempted", "remainingResourceRefs", "logicalAtMs",
]);
const RECEIPT_KEYS = Object.freeze([
  "schemaVersion", "request", "requestDigest", "observation", "observationDigest", "outcome",
  "transition", "reasonCode", "remainingResourceCount", "zeroResidue", "cleanupRequired",
  "runnerReleased", "executionAuthorized", "mergeAuthorized", "receiptDigest",
]);
const RESOURCE_REF_PATTERN = /^resource:[a-z0-9][a-z0-9._-]{2,95}$/;
const LEASE_ID_PATTERN = /^lease:[a-f0-9]{64}$/;
const REQUEST_DENIED = "CCP_RUNNER_CLEANUP_REQUEST_SCHEMA_DENIED";
const OBSERVATION_DENIED = "CCP_RUNNER_CLEANUP_OBSERVATION_SCHEMA_DENIED";
const RECEIPT_DENIED = "CCP_RUNNER_CLEANUP_RECEIPT_SCHEMA_DENIED";
const TERMINATIONS = Object.freeze(["COMPLETED", "CRASHED"]);
const OUTCOMES = Object.freeze(["ZERO_RESIDUE", "RESIDUE_DETECTED"]);
const TRANSITIONS = Object.freeze(["CLEANUP_CONFIRMED", "CLEANUP_FAILED"]);
const REASONS = Object.freeze([
  "ZERO_RESIDUE_AFTER_COMPLETION", "ZERO_RESIDUE_AFTER_CRASH", "RESIDUE_REMAINS", "CLEANUP_NOT_ATTEMPTED",
]);

type DataRecord = Readonly<Record<string, unknown>>;

function enumValue<T extends string>(value: unknown, values: readonly string[], code: string): T {
  if (typeof value !== "string" || !values.includes(value)) ccpStrictDenyV1(code);
  return value as T;
}

function refs(value: unknown, code: string, seen: WeakSet<object>, mustNotBeEmpty: boolean): readonly string[] {
  const raw = readCcpDenseArrayV1(value, seen, code);
  const result = raw.map((item) => assertCcpStringV1(item, RESOURCE_REF_PATTERN, code));
  if (mustNotBeEmpty && result.length === 0) ccpStrictDenyV1(code);
  if (new Set(result).size !== result.length) ccpStrictDenyV1(code);
  return Object.freeze([...result].sort());
}

function identity(record: DataRecord, code: string) {
  return {
    ledgerId: assertCcpStringV1(record.ledgerId, LEDGER_ID_PATTERN, code),
    tenantId: assertCcpStringV1(record.tenantId, TENANT_ID_PATTERN, code),
    repositoryId: assertCcpStringV1(record.repositoryId, REPOSITORY_ID_PATTERN, code),
    contributionId: assertCcpStringV1(record.contributionId, CONTRIBUTION_ID_PATTERN, code),
  };
}

export function parseCcpRunnerCleanupRequestV1(value: unknown): CcpRunnerCleanupRequestV1 {
  const seen = new WeakSet<object>();
  const record = readCcpClosedObjectV1(value, REQUEST_KEYS, seen, REQUEST_DENIED);
  if (record.schemaVersion !== CCP_RUNNER_CLEANUP_REQUEST_SCHEMA_V1) ccpStrictDenyV1(REQUEST_DENIED);
  return Object.freeze({
    schemaVersion: CCP_RUNNER_CLEANUP_REQUEST_SCHEMA_V1,
    ...identity(record, REQUEST_DENIED),
    leaseId: assertCcpStringV1(record.leaseId, LEASE_ID_PATTERN, REQUEST_DENIED),
    leaseReceiptDigest: assertCcpDigestV1(record.leaseReceiptDigest, REQUEST_DENIED),
    termination: enumValue(record.termination, TERMINATIONS, REQUEST_DENIED) as CcpRunnerTerminationV1,
    ownedResourceRefs: refs(record.ownedResourceRefs, REQUEST_DENIED, seen, true),
    logicalAtMs: assertCcpSafeUnsignedIntegerV1(record.logicalAtMs, REQUEST_DENIED),
  });
}

export function parseCcpRunnerCleanupObservationV1(value: unknown): CcpRunnerCleanupObservationV1 {
  const seen = new WeakSet<object>();
  const record = readCcpClosedObjectV1(value, OBSERVATION_KEYS, seen, OBSERVATION_DENIED);
  if (record.schemaVersion !== CCP_RUNNER_CLEANUP_OBSERVATION_SCHEMA_V1) ccpStrictDenyV1(OBSERVATION_DENIED);
  if (typeof record.cleanupAttempted !== "boolean") ccpStrictDenyV1(OBSERVATION_DENIED);
  return Object.freeze({
    schemaVersion: CCP_RUNNER_CLEANUP_OBSERVATION_SCHEMA_V1,
    leaseId: assertCcpStringV1(record.leaseId, LEASE_ID_PATTERN, OBSERVATION_DENIED),
    cleanupAttempted: record.cleanupAttempted,
    remainingResourceRefs: refs(record.remainingResourceRefs, OBSERVATION_DENIED, seen, false),
    logicalAtMs: assertCcpSafeUnsignedIntegerV1(record.logicalAtMs, OBSERVATION_DENIED),
  });
}

function makeReceipt(request: CcpRunnerCleanupRequestV1, observation: CcpRunnerCleanupObservationV1): CcpRunnerCleanupReceiptV1 {
  if (request.leaseId !== observation.leaseId || observation.logicalAtMs < request.logicalAtMs) ccpStrictDenyV1(OBSERVATION_DENIED);
  const owned = new Set(request.ownedResourceRefs);
  if (observation.remainingResourceRefs.some((ref) => !owned.has(ref))) ccpStrictDenyV1(OBSERVATION_DENIED);
  const zeroResidue = observation.cleanupAttempted && observation.remainingResourceRefs.length === 0;
  const outcome: CcpRunnerCleanupOutcomeV1 = zeroResidue ? "ZERO_RESIDUE" : "RESIDUE_DETECTED";
  const transition: CcpRunnerCleanupTransitionV1 = zeroResidue ? "CLEANUP_CONFIRMED" : "CLEANUP_FAILED";
  const reasonCode: CcpRunnerCleanupReasonCodeV1 = zeroResidue
    ? (request.termination === "CRASHED" ? "ZERO_RESIDUE_AFTER_CRASH" : "ZERO_RESIDUE_AFTER_COMPLETION")
    : (observation.cleanupAttempted ? "RESIDUE_REMAINS" : "CLEANUP_NOT_ATTEMPTED");
  const unsigned = Object.freeze({
    schemaVersion: CCP_RUNNER_CLEANUP_RECEIPT_SCHEMA_V1,
    request,
    requestDigest: ccpDigestDomainV1(CCP_RUNNER_CLEANUP_REQUEST_SCHEMA_V1, request),
    observation,
    observationDigest: ccpDigestDomainV1(CCP_RUNNER_CLEANUP_OBSERVATION_SCHEMA_V1, observation),
    outcome,
    transition,
    reasonCode,
    remainingResourceCount: observation.remainingResourceRefs.length,
    zeroResidue,
    cleanupRequired: true as const,
    runnerReleased: zeroResidue,
    executionAuthorized: false as const,
    mergeAuthorized: false as const,
  });
  return Object.freeze({
    ...unsigned,
    receiptDigest: ccpDigestDomainV1(CCP_RUNNER_CLEANUP_RECEIPT_SCHEMA_V1, unsigned),
  });
}

/** Produce the mandatory cleanup receipt from injected state only. */
export function issueCcpRunnerCleanupReceiptV1(request: unknown, observation: unknown): CcpRunnerCleanupReceiptV1 {
  return makeReceipt(parseCcpRunnerCleanupRequestV1(request), parseCcpRunnerCleanupObservationV1(observation));
}

/** Alias for callers that model cleanup as a transition projection. */
export const evaluateCcpRunnerCleanupV1 = issueCcpRunnerCleanupReceiptV1;

function normalizeReceipt(value: unknown): CcpRunnerCleanupReceiptV1 {
  const seen = new WeakSet<object>();
  const record = readCcpClosedObjectV1(value, RECEIPT_KEYS, seen, RECEIPT_DENIED);
  if (record.schemaVersion !== CCP_RUNNER_CLEANUP_RECEIPT_SCHEMA_V1 || record.cleanupRequired !== true
    || record.executionAuthorized !== false || record.mergeAuthorized !== false) ccpStrictDenyV1(RECEIPT_DENIED);
  const request = parseCcpRunnerCleanupRequestV1(record.request);
  const observation = parseCcpRunnerCleanupObservationV1(record.observation);
  const requestDigest = assertCcpDigestV1(record.requestDigest, RECEIPT_DENIED);
  const observationDigest = assertCcpDigestV1(record.observationDigest, RECEIPT_DENIED);
  if (requestDigest !== ccpDigestDomainV1(CCP_RUNNER_CLEANUP_REQUEST_SCHEMA_V1, request)
    || observationDigest !== ccpDigestDomainV1(CCP_RUNNER_CLEANUP_OBSERVATION_SCHEMA_V1, observation)) ccpStrictDenyV1(RECEIPT_DENIED);
  const expected = makeReceipt(request, observation);
  if (record.outcome !== expected.outcome || record.transition !== expected.transition || record.reasonCode !== expected.reasonCode
    || record.remainingResourceCount !== expected.remainingResourceCount || record.zeroResidue !== expected.zeroResidue
    || record.runnerReleased !== expected.runnerReleased
    || !OUTCOMES.includes(record.outcome as CcpRunnerCleanupOutcomeV1)
    || !TRANSITIONS.includes(record.transition as CcpRunnerCleanupTransitionV1)
    || !REASONS.includes(record.reasonCode as CcpRunnerCleanupReasonCodeV1)) ccpStrictDenyV1(RECEIPT_DENIED);
  const receiptDigest = assertCcpDigestV1(record.receiptDigest, RECEIPT_DENIED);
  if (receiptDigest !== expected.receiptDigest) ccpStrictDenyV1(RECEIPT_DENIED);
  return expected;
}

export function parseCcpRunnerCleanupReceiptV1(value: unknown): CcpRunnerCleanupReceiptV1 {
  return normalizeReceipt(value);
}

export function canonicalCcpRunnerCleanupReceiptJsonV1(value: unknown): string {
  return canonicalJson(parseCcpRunnerCleanupReceiptV1(value));
}

export function ccpRunnerCleanupReceiptDigestV1(value: unknown): string {
  return parseCcpRunnerCleanupReceiptV1(value).receiptDigest;
}

export function verifyCcpRunnerCleanupReceiptV1(value: unknown): CcpRunnerCleanupReceiptV1 | null {
  try {
    return parseCcpRunnerCleanupReceiptV1(value);
  } catch {
    return null;
  }
}
