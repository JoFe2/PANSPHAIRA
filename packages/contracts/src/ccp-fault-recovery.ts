import { canonicalJson } from "./canonical-json.js";
import {
  assertCcpDigestV1,
  assertCcpSafeUnsignedIntegerV1,
  assertCcpStringV1,
  ccpDigestDomainV1,
  ccpStrictDenyV1,
  readCcpClosedObjectV1,
} from "./ccp-event-envelope.js";
import {
  issueCcpRunnerCleanupReceiptV1,
  parseCcpRunnerCleanupReceiptV1,
  type CcpRunnerCleanupReceiptV1,
} from "./ccp-runner-cleanup.js";
import {
  parseCcpLkgStateV1,
  type CcpLkgStateV1,
} from "./ccp-lkg-restore.js";

/**
 * CCP PSAI52 bounded fault-recovery boundary. This contract composes only
 * injected receipts and observations. It never retries an external call,
 * executes a runner, verifies code, promotes a head, or grants merge
 * authority. A CONFIRMED result means that the recovery transition itself is
 * evidenced; it is never a verification or merge result.
 *
 * The four fault classes are deliberately finite. Runner faults require the
 * mandatory cleanup receipt, queue and API faults remain outside execution
 * authority, and a promotion fault can only recover by an exact LKG restore.
 * Every input is closed and every output is digest-bound for deterministic
 * read-back.
 */

export const CCP_FAULT_RECOVERY_INPUT_SCHEMA_V1 = "cm.ccp-fault-recovery-input/v1" as const;
export const CCP_FAULT_RECOVERY_RECEIPT_SCHEMA_V1 = "cm.ccp-fault-recovery-receipt/v1" as const;
export const CCP_RECOVERY_SLO_OBSERVATION_SCHEMA_V1 = "cm.ccp-recovery-slo-observation/v1" as const;
export const CCP_LKG_RECOVERY_READBACK_SCHEMA_V1 = "cm.ccp-lkg-recovery-readback/v1" as const;
export const CCP_FAULT_RECOVERY_TASK_ID_V1 = "QWEN-PSAI52-FAILURE-RECOVERY-09" as const;

export type CcpFaultClassV1 = "RUNNER" | "QUEUE" | "API" | "PROMOTION";
export type CcpFaultCodeV1 =
  | "RUNNER_FAILURE"
  | "QUEUE_FAILURE"
  | "API_FAILURE"
  | "PROMOTION_FAILURE";
export type CcpFaultRecoveryDispositionV1 = "RECOVERY_CONFIRMED" | "RECOVERY_BLOCKED";
export type CcpFaultRecoveryTransitionV1 =
  | "RUNNER_ABORTED_CLEANUP_CONFIRMED"
  | "QUEUE_REQUEUED_NO_EXECUTION_AUTHORITY"
  | "API_ABORTED_NO_EXTERNAL_RETRY"
  | "PROMOTION_FAILURE_EXACT_LKG_RESTORE"
  | "RECOVERY_BLOCKED_EVIDENCE_INCOMPLETE";
export type CcpFaultRecoveryLkgBehaviorV1 = "UNCHANGED" | "EXACT_PRE_PROMOTION_RESTORED";

export const CCP_FAULT_CLASSES_V1 = Object.freeze(["RUNNER", "QUEUE", "API", "PROMOTION"]);
export const CCP_FAULT_CODES_V1 = Object.freeze([
  "RUNNER_FAILURE", "QUEUE_FAILURE", "API_FAILURE", "PROMOTION_FAILURE",
]);
export const CCP_FAULT_RECOVERY_DISPOSITIONS_V1 = Object.freeze([
  "RECOVERY_CONFIRMED", "RECOVERY_BLOCKED",
]);
export const CCP_FAULT_RECOVERY_TRANSITIONS_V1 = Object.freeze([
  "RUNNER_ABORTED_CLEANUP_CONFIRMED",
  "QUEUE_REQUEUED_NO_EXECUTION_AUTHORITY",
  "API_ABORTED_NO_EXTERNAL_RETRY",
  "PROMOTION_FAILURE_EXACT_LKG_RESTORE",
  "RECOVERY_BLOCKED_EVIDENCE_INCOMPLETE",
]);

export interface CcpRecoverySloObservationV1 {
  readonly schemaVersion: typeof CCP_RECOVERY_SLO_OBSERVATION_SCHEMA_V1;
  readonly observationId: string;
  /** Injected logical observation time; no ambient clock is read. */
  readonly logicalAtMs: number;
  readonly attempts: number;
  readonly recovered: number;
  readonly failed: number;
  readonly targetRecoveryRateBps: number;
}

export interface CcpLkgRecoveryReadbackV1 {
  readonly schemaVersion: typeof CCP_LKG_RECOVERY_READBACK_SCHEMA_V1;
  readonly beforeState: CcpLkgStateV1;
  readonly afterState: CcpLkgStateV1;
  readonly behavior: CcpFaultRecoveryLkgBehaviorV1;
  /** For a promotion fault, the exact pre-promotion LKG digest. */
  readonly expectedAfterLkgDigest: string;
  /** Digest of the injected atomic recovery transition; null when unchanged. */
  readonly transitionDigest: string | null;
}

export interface CcpFaultRecoveryInputV1 {
  readonly schemaVersion: typeof CCP_FAULT_RECOVERY_INPUT_SCHEMA_V1;
  readonly taskId: typeof CCP_FAULT_RECOVERY_TASK_ID_V1;
  readonly faultClass: CcpFaultClassV1;
  readonly faultCode: CcpFaultCodeV1;
  readonly faultInjected: true;
  readonly logicalAtMs: number;
  readonly cleanup: {
    readonly request: unknown;
    readonly observation: unknown;
  };
  readonly sloObservation: CcpRecoverySloObservationV1;
  readonly lkgReadback: CcpLkgRecoveryReadbackV1;
}

export interface CcpFaultRecoverySloMetricsV1 {
  readonly attempts: number;
  readonly recovered: number;
  readonly failed: number;
  readonly recoveryRateBps: number;
  readonly targetRecoveryRateBps: number;
  readonly met: boolean;
}

export interface CcpFaultRecoveryAuthorizationBoundaryV1 {
  readonly verificationClaimed: false;
  readonly verificationAuthorized: false;
  readonly executionAuthorized: false;
  readonly promotionAuthorized: false;
  readonly mergeAuthorized: false;
}

export interface CcpFaultRecoveryReceiptV1 {
  readonly schemaVersion: typeof CCP_FAULT_RECOVERY_RECEIPT_SCHEMA_V1;
  readonly taskId: typeof CCP_FAULT_RECOVERY_TASK_ID_V1;
  readonly faultClass: CcpFaultClassV1;
  readonly faultCode: CcpFaultCodeV1;
  readonly faultInjected: true;
  readonly logicalAtMs: number;
  readonly cleanupReceipt: CcpRunnerCleanupReceiptV1;
  readonly cleanupReceiptDigest: string;
  readonly sloObservation: CcpRecoverySloObservationV1;
  readonly sloMetrics: CcpFaultRecoverySloMetricsV1;
  readonly lkgReadback: CcpLkgRecoveryReadbackV1;
  readonly lkgBehavior: CcpFaultRecoveryLkgBehaviorV1;
  readonly disposition: CcpFaultRecoveryDispositionV1;
  readonly transition: CcpFaultRecoveryTransitionV1;
  readonly recoveryEvidenceComplete: boolean;
  readonly cleanupRequired: true;
  readonly zeroResidue: boolean;
  readonly runnerReleased: boolean;
  readonly authorization: CcpFaultRecoveryAuthorizationBoundaryV1;
  readonly receiptDigest: string;
}

const RECOVERY_DENIED = "CCP_FAULT_RECOVERY_SCHEMA_DENIED";
const SLO_DENIED = "CCP_RECOVERY_SLO_OBSERVATION_SCHEMA_DENIED";
const LKG_DENIED = "CCP_LKG_RECOVERY_READBACK_SCHEMA_DENIED";
const RECEIPT_DENIED = "CCP_FAULT_RECOVERY_RECEIPT_SCHEMA_DENIED";
const OBSERVATION_ID_PATTERN = /^observation:[a-z0-9][a-z0-9._-]{2,95}$/;
const LKG_TRANSITION_DOMAIN = "cm.ccp-lkg-recovery-transition/v1";
const INPUT_KEYS = Object.freeze([
  "schemaVersion", "taskId", "faultClass", "faultCode", "faultInjected", "logicalAtMs",
  "cleanup", "sloObservation", "lkgReadback",
]);
const CLEANUP_INPUT_KEYS = Object.freeze(["request", "observation"]);
const SLO_KEYS = Object.freeze([
  "schemaVersion", "observationId", "logicalAtMs", "attempts", "recovered", "failed", "targetRecoveryRateBps",
]);
const LKG_KEYS = Object.freeze([
  "schemaVersion", "beforeState", "afterState", "behavior", "expectedAfterLkgDigest", "transitionDigest",
]);
const RECEIPT_KEYS = Object.freeze([
  "schemaVersion", "taskId", "faultClass", "faultCode", "faultInjected", "logicalAtMs",
  "cleanupReceipt", "cleanupReceiptDigest", "sloObservation", "sloMetrics", "lkgReadback", "lkgBehavior",
  "disposition", "transition", "recoveryEvidenceComplete", "cleanupRequired", "zeroResidue", "runnerReleased",
  "authorization", "receiptDigest",
]);
const METRIC_KEYS = Object.freeze([
  "attempts", "recovered", "failed", "recoveryRateBps", "targetRecoveryRateBps", "met",
]);
const AUTHORIZATION_KEYS = Object.freeze([
  "verificationClaimed", "verificationAuthorized", "executionAuthorized", "promotionAuthorized", "mergeAuthorized",
]);
const FAULT_TO_CLASS: Readonly<Record<CcpFaultCodeV1, CcpFaultClassV1>> = Object.freeze({
  RUNNER_FAILURE: "RUNNER",
  QUEUE_FAILURE: "QUEUE",
  API_FAILURE: "API",
  PROMOTION_FAILURE: "PROMOTION",
});

function enumValue<T extends string>(value: unknown, values: readonly string[], code: string): T {
  if (typeof value !== "string" || !values.includes(value)) ccpStrictDenyV1(code);
  return value as T;
}

function parseSloObservation(value: unknown): CcpRecoverySloObservationV1 {
  const record = readCcpClosedObjectV1(value, SLO_KEYS, new WeakSet(), SLO_DENIED);
  if (record.schemaVersion !== CCP_RECOVERY_SLO_OBSERVATION_SCHEMA_V1) ccpStrictDenyV1(SLO_DENIED);
  const attempts = assertCcpSafeUnsignedIntegerV1(record.attempts, SLO_DENIED);
  const recovered = assertCcpSafeUnsignedIntegerV1(record.recovered, SLO_DENIED);
  const failed = assertCcpSafeUnsignedIntegerV1(record.failed, SLO_DENIED);
  const targetRecoveryRateBps = assertCcpSafeUnsignedIntegerV1(record.targetRecoveryRateBps, SLO_DENIED);
  if (recovered > attempts || failed > attempts || recovered + failed > attempts || targetRecoveryRateBps > 10000) {
    ccpStrictDenyV1(SLO_DENIED);
  }
  return Object.freeze({
    schemaVersion: CCP_RECOVERY_SLO_OBSERVATION_SCHEMA_V1,
    observationId: assertCcpStringV1(record.observationId, OBSERVATION_ID_PATTERN, SLO_DENIED),
    logicalAtMs: assertCcpSafeUnsignedIntegerV1(record.logicalAtMs, SLO_DENIED),
    attempts,
    recovered,
    failed,
    targetRecoveryRateBps,
  });
}

function lkgTransitionDigest(readback: {
  beforeState: CcpLkgStateV1;
  afterState: CcpLkgStateV1;
  behavior: CcpFaultRecoveryLkgBehaviorV1;
  expectedAfterLkgDigest: string;
}): string {
  return ccpDigestDomainV1(LKG_TRANSITION_DOMAIN, {
    beforeStateDigest: readback.beforeState.stateDigest,
    afterStateDigest: readback.afterState.stateDigest,
    behavior: readback.behavior,
    expectedAfterLkgDigest: readback.expectedAfterLkgDigest,
  });
}

function parseLkgReadback(value: unknown): CcpLkgRecoveryReadbackV1 {
  const record = readCcpClosedObjectV1(value, LKG_KEYS, new WeakSet(), LKG_DENIED);
  if (record.schemaVersion !== CCP_LKG_RECOVERY_READBACK_SCHEMA_V1) ccpStrictDenyV1(LKG_DENIED);
  const beforeState = parseCcpLkgStateV1(record.beforeState);
  const afterState = parseCcpLkgStateV1(record.afterState);
  if (beforeState.ledgerId !== afterState.ledgerId || beforeState.tenantId !== afterState.tenantId
    || beforeState.repositoryId !== afterState.repositoryId || beforeState.contributionId !== afterState.contributionId
    || beforeState.componentId !== afterState.componentId) ccpStrictDenyV1(LKG_DENIED);
  const behavior = enumValue<CcpFaultRecoveryLkgBehaviorV1>(
    record.behavior,
    ["UNCHANGED", "EXACT_PRE_PROMOTION_RESTORED"],
    LKG_DENIED,
  );
  const expectedAfterLkgDigest = assertCcpDigestV1(record.expectedAfterLkgDigest, LKG_DENIED);
  const transitionDigest = record.transitionDigest === null
    ? null
    : assertCcpDigestV1(record.transitionDigest, LKG_DENIED);
  if (behavior === "UNCHANGED") {
    if (transitionDigest !== null || expectedAfterLkgDigest !== beforeState.lkgDigest
      || canonicalJson(beforeState) !== canonicalJson(afterState)) ccpStrictDenyV1(LKG_DENIED);
  } else {
    if (transitionDigest === null || beforeState.lkgDigest === afterState.lkgDigest
      || afterState.lkgDigest !== expectedAfterLkgDigest || afterState.generation !== beforeState.generation + 1
      || transitionDigest !== lkgTransitionDigest({ beforeState, afterState, behavior, expectedAfterLkgDigest })) {
      ccpStrictDenyV1(LKG_DENIED);
    }
  }
  return Object.freeze({
    schemaVersion: CCP_LKG_RECOVERY_READBACK_SCHEMA_V1,
    beforeState,
    afterState,
    behavior,
    expectedAfterLkgDigest,
    transitionDigest,
  });
}

function parseInput(value: unknown): CcpFaultRecoveryInputV1 {
  const seen = new WeakSet<object>();
  const record = readCcpClosedObjectV1(value, INPUT_KEYS, seen, RECOVERY_DENIED);
  if (record.schemaVersion !== CCP_FAULT_RECOVERY_INPUT_SCHEMA_V1
    || record.taskId !== CCP_FAULT_RECOVERY_TASK_ID_V1 || record.faultInjected !== true) ccpStrictDenyV1(RECOVERY_DENIED);
  const faultClass = enumValue<CcpFaultClassV1>(record.faultClass, CCP_FAULT_CLASSES_V1, RECOVERY_DENIED);
  const faultCode = enumValue<CcpFaultCodeV1>(record.faultCode, CCP_FAULT_CODES_V1, RECOVERY_DENIED);
  if (FAULT_TO_CLASS[faultCode] !== faultClass) ccpStrictDenyV1(RECOVERY_DENIED);
  const logicalAtMs = assertCcpSafeUnsignedIntegerV1(record.logicalAtMs, RECOVERY_DENIED);
  const cleanup = readCcpClosedObjectV1(record.cleanup, CLEANUP_INPUT_KEYS, seen, RECOVERY_DENIED);
  const sloObservation = parseSloObservation(record.sloObservation);
  const lkgReadback = parseLkgReadback(record.lkgReadback);
  if (sloObservation.logicalAtMs > logicalAtMs) ccpStrictDenyV1(RECOVERY_DENIED);
  return Object.freeze({
    schemaVersion: CCP_FAULT_RECOVERY_INPUT_SCHEMA_V1,
    taskId: CCP_FAULT_RECOVERY_TASK_ID_V1,
    faultClass,
    faultCode,
    faultInjected: true,
    logicalAtMs,
    cleanup: Object.freeze({ request: cleanup.request, observation: cleanup.observation }),
    sloObservation,
    lkgReadback,
  });
}

function metrics(observation: CcpRecoverySloObservationV1): CcpFaultRecoverySloMetricsV1 {
  const recoveryRateBps = observation.attempts === 0
    ? 10000
    : Math.floor(observation.recovered * 10000 / observation.attempts);
  return Object.freeze({
    attempts: observation.attempts,
    recovered: observation.recovered,
    failed: observation.failed,
    recoveryRateBps,
    targetRecoveryRateBps: observation.targetRecoveryRateBps,
    met: recoveryRateBps >= observation.targetRecoveryRateBps,
  });
}

function transitionFor(input: CcpFaultRecoveryInputV1, evidenceComplete: boolean): CcpFaultRecoveryTransitionV1 {
  if (!evidenceComplete) return "RECOVERY_BLOCKED_EVIDENCE_INCOMPLETE";
  switch (input.faultClass) {
    case "RUNNER": return "RUNNER_ABORTED_CLEANUP_CONFIRMED";
    case "QUEUE": return "QUEUE_REQUEUED_NO_EXECUTION_AUTHORITY";
    case "API": return "API_ABORTED_NO_EXTERNAL_RETRY";
    case "PROMOTION": return "PROMOTION_FAILURE_EXACT_LKG_RESTORE";
  }
}

function makeReceipt(input: CcpFaultRecoveryInputV1): CcpFaultRecoveryReceiptV1 {
  const cleanupReceipt = issueCcpRunnerCleanupReceiptV1(input.cleanup.request, input.cleanup.observation);
  const sloMetrics = metrics(input.sloObservation);
  const lkgIdentity = input.lkgReadback.beforeState;
  const cleanupIdentity = cleanupReceipt.request;
  if (cleanupIdentity.ledgerId !== lkgIdentity.ledgerId
    || cleanupIdentity.tenantId !== lkgIdentity.tenantId
    || cleanupIdentity.repositoryId !== lkgIdentity.repositoryId
    || cleanupIdentity.contributionId !== lkgIdentity.contributionId) ccpStrictDenyV1(RECOVERY_DENIED);
  const lkgMatchesFault = input.faultClass === "PROMOTION"
    ? input.lkgReadback.behavior === "EXACT_PRE_PROMOTION_RESTORED"
    : input.lkgReadback.behavior === "UNCHANGED";
  const evidenceComplete = cleanupReceipt.zeroResidue && cleanupReceipt.runnerReleased
    && sloMetrics.met && lkgMatchesFault;
  const disposition: CcpFaultRecoveryDispositionV1 = evidenceComplete ? "RECOVERY_CONFIRMED" : "RECOVERY_BLOCKED";
  const unsigned = Object.freeze({
    schemaVersion: CCP_FAULT_RECOVERY_RECEIPT_SCHEMA_V1,
    taskId: CCP_FAULT_RECOVERY_TASK_ID_V1,
    faultClass: input.faultClass,
    faultCode: input.faultCode,
    faultInjected: true as const,
    logicalAtMs: input.logicalAtMs,
    cleanupReceipt,
    cleanupReceiptDigest: cleanupReceipt.receiptDigest,
    sloObservation: input.sloObservation,
    sloMetrics,
    lkgReadback: input.lkgReadback,
    lkgBehavior: input.lkgReadback.behavior,
    disposition,
    transition: transitionFor(input, evidenceComplete),
    recoveryEvidenceComplete: evidenceComplete,
    cleanupRequired: true as const,
    zeroResidue: cleanupReceipt.zeroResidue,
    runnerReleased: cleanupReceipt.runnerReleased,
    authorization: Object.freeze({
      verificationClaimed: false as const,
      verificationAuthorized: false as const,
      executionAuthorized: false as const,
      promotionAuthorized: false as const,
      mergeAuthorized: false as const,
    }),
  });
  return Object.freeze({
    ...unsigned,
    receiptDigest: ccpDigestDomainV1(CCP_FAULT_RECOVERY_RECEIPT_SCHEMA_V1, unsigned),
  });
}

/** Parse a recovery SLO observation independently for callers that persist it. */
export function parseCcpRecoverySloObservationV1(value: unknown): CcpRecoverySloObservationV1 {
  return parseSloObservation(value);
}

/** Parse and close an exact-LKG recovery readback. */
export function parseCcpLkgRecoveryReadbackV1(value: unknown): CcpLkgRecoveryReadbackV1 {
  return parseLkgReadback(value);
}

/** Compose an injected fault with cleanup, recovery SLO and LKG readback evidence. */
export function composeCcpFaultRecoveryV1(value: unknown): CcpFaultRecoveryReceiptV1 {
  return makeReceipt(parseInput(value));
}

export const evaluateCcpFaultRecoveryV1 = composeCcpFaultRecoveryV1;
export const issueCcpFaultRecoveryReceiptV1 = composeCcpFaultRecoveryV1;

function parseMetrics(value: unknown): CcpFaultRecoverySloMetricsV1 {
  const record = readCcpClosedObjectV1(value, METRIC_KEYS, new WeakSet(), RECEIPT_DENIED);
  const attempts = assertCcpSafeUnsignedIntegerV1(record.attempts, RECEIPT_DENIED);
  const recovered = assertCcpSafeUnsignedIntegerV1(record.recovered, RECEIPT_DENIED);
  const failed = assertCcpSafeUnsignedIntegerV1(record.failed, RECEIPT_DENIED);
  const recoveryRateBps = assertCcpSafeUnsignedIntegerV1(record.recoveryRateBps, RECEIPT_DENIED);
  const targetRecoveryRateBps = assertCcpSafeUnsignedIntegerV1(record.targetRecoveryRateBps, RECEIPT_DENIED);
  if (typeof record.met !== "boolean" || recovered > attempts || failed > attempts
    || recovered + failed > attempts || recoveryRateBps > 10000 || targetRecoveryRateBps > 10000) ccpStrictDenyV1(RECEIPT_DENIED);
  return Object.freeze({ attempts, recovered, failed, recoveryRateBps, targetRecoveryRateBps, met: record.met });
}

function parseAuthorization(value: unknown): CcpFaultRecoveryAuthorizationBoundaryV1 {
  const record = readCcpClosedObjectV1(value, AUTHORIZATION_KEYS, new WeakSet(), RECEIPT_DENIED);
  if (record.verificationClaimed !== false || record.verificationAuthorized !== false
    || record.executionAuthorized !== false || record.promotionAuthorized !== false || record.mergeAuthorized !== false) {
    ccpStrictDenyV1(RECEIPT_DENIED);
  }
  return Object.freeze({
    verificationClaimed: false,
    verificationAuthorized: false,
    executionAuthorized: false,
    promotionAuthorized: false,
    mergeAuthorized: false,
  });
}

/** Parse and re-derive the complete recovery receipt; forged success denies. */
export function parseCcpFaultRecoveryReceiptV1(value: unknown): CcpFaultRecoveryReceiptV1 {
  const record = readCcpClosedObjectV1(value, RECEIPT_KEYS, new WeakSet(), RECEIPT_DENIED);
  if (record.schemaVersion !== CCP_FAULT_RECOVERY_RECEIPT_SCHEMA_V1
    || record.taskId !== CCP_FAULT_RECOVERY_TASK_ID_V1 || record.faultInjected !== true
    || record.cleanupRequired !== true) ccpStrictDenyV1(RECEIPT_DENIED);
  const cleanupReceipt = parseCcpRunnerCleanupReceiptV1(record.cleanupReceipt);
  const cleanupReceiptDigest = assertCcpDigestV1(record.cleanupReceiptDigest, RECEIPT_DENIED);
  if (cleanupReceiptDigest !== cleanupReceipt.receiptDigest) ccpStrictDenyV1(RECEIPT_DENIED);
  const sloObservation = parseSloObservation(record.sloObservation);
  const lkgReadback = parseLkgReadback(record.lkgReadback);
  const faultClass = enumValue<CcpFaultClassV1>(record.faultClass, CCP_FAULT_CLASSES_V1, RECEIPT_DENIED);
  const faultCode = enumValue<CcpFaultCodeV1>(record.faultCode, CCP_FAULT_CODES_V1, RECEIPT_DENIED);
  if (FAULT_TO_CLASS[faultCode] !== faultClass) ccpStrictDenyV1(RECEIPT_DENIED);
  const logicalAtMs = assertCcpSafeUnsignedIntegerV1(record.logicalAtMs, RECEIPT_DENIED);
  if (sloObservation.logicalAtMs > logicalAtMs) ccpStrictDenyV1(RECEIPT_DENIED);
  const input: CcpFaultRecoveryInputV1 = Object.freeze({
    schemaVersion: CCP_FAULT_RECOVERY_INPUT_SCHEMA_V1,
    taskId: CCP_FAULT_RECOVERY_TASK_ID_V1,
    faultClass,
    faultCode,
    faultInjected: true,
    logicalAtMs,
    cleanup: Object.freeze({ request: cleanupReceipt.request, observation: cleanupReceipt.observation }),
    sloObservation,
    lkgReadback,
  });
  const expected = makeReceipt(input);
  const sloMetrics = parseMetrics(record.sloMetrics);
  const authorization = parseAuthorization(record.authorization);
  if (canonicalJson(sloMetrics) !== canonicalJson(expected.sloMetrics)
    || record.lkgBehavior !== expected.lkgBehavior
    || record.disposition !== expected.disposition
    || record.transition !== expected.transition
    || record.recoveryEvidenceComplete !== expected.recoveryEvidenceComplete
    || record.zeroResidue !== expected.zeroResidue
    || record.runnerReleased !== expected.runnerReleased
    || canonicalJson(authorization) !== canonicalJson(expected.authorization)) ccpStrictDenyV1(RECEIPT_DENIED);
  const receiptDigest = assertCcpDigestV1(record.receiptDigest, RECEIPT_DENIED);
  if (receiptDigest !== expected.receiptDigest) ccpStrictDenyV1(RECEIPT_DENIED);
  return expected;
}

export function canonicalCcpFaultRecoveryReceiptJsonV1(value: unknown): string {
  return canonicalJson(parseCcpFaultRecoveryReceiptV1(value));
}

export function ccpFaultRecoveryReceiptDigestV1(value: unknown): string {
  return parseCcpFaultRecoveryReceiptV1(value).receiptDigest;
}

export function verifyCcpFaultRecoveryReceiptV1(value: unknown): CcpFaultRecoveryReceiptV1 | null {
  try {
    return parseCcpFaultRecoveryReceiptV1(value);
  } catch {
    return null;
  }
}
