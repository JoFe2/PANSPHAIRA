import { canonicalJson } from "./canonical-json.js";

import {
  assertCcpDigestV1,
  assertCcpSafePositiveIntegerV1,
  assertCcpStringV1,
  ccpDigestDomainV1,
  ccpStrictDenyV1,
  CONTRIBUTION_ID_PATTERN,
  DELIVERY_ID_PATTERN,
  LEDGER_ID_PATTERN,
  readCcpClosedObjectV1,
  readCcpDenseArrayV1,
  REPOSITORY_ID_PATTERN,
  TENANT_ID_PATTERN,
} from "./ccp-event-envelope.js";
import { CCP_COMPONENT_IDS_V1 } from "./ccp-risk-routing.js";

/**
 * CCP PSAI52 bounded intake boundary (M1 merge-train side): a pure,
 * deterministic lock over a complete, immutable verification tuple. A
 * verification tuple is the closed set of verification claims
 * (build, test, security) about one candidate head, each with a closed
 * outcome and an evidence digest. Locking a tuple seals it: the lock
 * receipt is digest-bound over the full tuple, so the tuple cannot be
 * edited, dropped or reordered after the lock without the lock denying on
 * read-back.
 *
 * Completeness is enforced: a tuple lock requires exactly the full claim
 * set in the closed canonical order; a partial tuple cannot be locked.
 * `allClaimsPassed` is derived, not asserted: it is true only when every
 * claim in the sealed tuple is PASSED. A lock over a failed tuple is a
 * legitimate closed record — it is the regression evidence that the
 * exact-LKG restore path consumes — but it never unlocks anything.
 *
 * The lock is a receipt, not an authorization. It never promotes a
 * candidate, authorizes a merge or grants eligibility: promotion is a
 * separate protected decision that must independently consume this lock
 * (see `ccp-lkg-restore`). There is no network, persistence, clock,
 * randomness, queue, runner, merge or code-execution capability;
 * `logicalAtMs` is injected data only.
 */

export const CCP_TUPLE_LOCK_SCHEMA_V1 = "cm.ccp-tuple-lock/v1" as const;

export type CcpClaimOutcomeV1 = "PASSED" | "FAILED";

export const CCP_CLAIM_OUTCOMES_V1 = Object.freeze(["PASSED", "FAILED"]);

/** Closed claim vocabulary in canonical order; a complete tuple carries all of it. */
export const CCP_TUPLE_CLAIM_IDS_V1 = Object.freeze([
  "claim:build",
  "claim:test",
  "claim:security",
]);

const TUPLE_LOCK_SCHEMA_DENIED = "CCP_TUPLE_LOCK_SCHEMA_DENIED";

const CLAIM_ID_PATTERN = /^claim:[a-z0-9][a-z0-9._-]{2,95}$/;
const CLAIM_OUTCOME_VOCABULARY: readonly string[] = CCP_CLAIM_OUTCOMES_V1;
const VERIFIER_ID_PATTERN = /^verifier:[a-z0-9][a-z0-9._-]{2,95}$/;

/** One sealed verification claim: a closed id, a closed outcome, an evidence digest. */
export interface CcpTupleClaimV1 {
  readonly claimId: string;
  readonly outcome: CcpClaimOutcomeV1;
  readonly evidenceDigest: string;
}

/**
 * A locked complete verification tuple. The claims are sealed in the
 * closed canonical order; the digest binds every byte of the tuple.
 */
export interface CcpTupleLockV1 {
  readonly schemaVersion: typeof CCP_TUPLE_LOCK_SCHEMA_V1;
  readonly ledgerId: string;
  readonly tenantId: string;
  readonly repositoryId: string;
  readonly contributionId: string;
  readonly componentId: string;
  /** Candidate head the verification tuple is about. */
  readonly headDigest: string;
  readonly payloadDigest: string;
  /** Identity of the delivering candidate; a distinct closed namespace from promoter identities. */
  readonly deliveryId: string;
  /** Identity of the verifier; a distinct closed namespace from promoter identities. */
  readonly verifierId: string;
  /** Injected logical clock value of the verification; data only. */
  readonly logicalAtMs: number;
  readonly claims: readonly CcpTupleClaimV1[];
  /** Derived: true only when every sealed claim is PASSED. */
  readonly allClaimsPassed: boolean;
  readonly lockDigest: string;
}

const TUPLE_CLAIM_KEYS = Object.freeze(["claimId", "outcome", "evidenceDigest"]);
/**
 * The unsigned tuple: everything a lock seals, minus the derived
 * `allClaimsPassed` and the `lockDigest` the lock itself adds. This is the
 * only shape `lockCcpVerificationTupleV1` accepts.
 */
const TUPLE_LOCK_UNSIGNED_KEYS = Object.freeze([
  "schemaVersion", "ledgerId", "tenantId", "repositoryId", "contributionId", "componentId",
  "headDigest", "payloadDigest", "deliveryId", "verifierId", "logicalAtMs",
  "claims",
]);
const TUPLE_LOCK_KEYS = Object.freeze([...TUPLE_LOCK_UNSIGNED_KEYS, "allClaimsPassed", "lockDigest"]);

function assertKnownComponent(componentId: unknown, code: string): string {
  if (typeof componentId !== "string"
    || !(CCP_COMPONENT_IDS_V1 as readonly string[]).includes(componentId)) {
    ccpStrictDenyV1(code);
  }
  return componentId;
}

function readTupleIdentity(record: Record<string, unknown>, code: string): {
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

interface TupleLockCoreV1 {
  identity: {
    ledgerId: string;
    tenantId: string;
    repositoryId: string;
    contributionId: string;
  };
  componentId: string;
  headDigest: string;
  payloadDigest: string;
  deliveryId: string;
  verifierId: string;
  logicalAtMs: number;
  claims: CcpTupleClaimV1[];
  /** Derived: true only when every sealed claim is PASSED. */
  allClaimsPassed: boolean;
}

/**
 * Validate the shared fields of a verification tuple, whether it arrives
 * unsigned (for locking) or sealed (for read-back). The claims must be
 * the full closed claim set in the canonical order — completeness is
 * enforced, not assumed — and `allClaimsPassed` is derived, never read.
 */
function readTupleLockCore(record: Record<string, unknown>, seen: WeakSet<object>): TupleLockCoreV1 {
  const identity = readTupleIdentity(record, TUPLE_LOCK_SCHEMA_DENIED);
  const componentId = assertKnownComponent(record.componentId, TUPLE_LOCK_SCHEMA_DENIED);
  const headDigest = assertCcpDigestV1(record.headDigest, TUPLE_LOCK_SCHEMA_DENIED);
  const payloadDigest = assertCcpDigestV1(record.payloadDigest, TUPLE_LOCK_SCHEMA_DENIED);
  const deliveryId = assertCcpStringV1(record.deliveryId, DELIVERY_ID_PATTERN, TUPLE_LOCK_SCHEMA_DENIED);
  const verifierId = assertCcpStringV1(record.verifierId, VERIFIER_ID_PATTERN, TUPLE_LOCK_SCHEMA_DENIED);
  const logicalAtMs = assertCcpSafePositiveIntegerV1(record.logicalAtMs, TUPLE_LOCK_SCHEMA_DENIED);
  const claimsRaw = readCcpDenseArrayV1(record.claims, seen, TUPLE_LOCK_SCHEMA_DENIED);
  if (claimsRaw.length !== (CCP_TUPLE_CLAIM_IDS_V1 as readonly string[]).length) {
    ccpStrictDenyV1(TUPLE_LOCK_SCHEMA_DENIED);
  }
  const claims: CcpTupleClaimV1[] = claimsRaw.map(
    (claim, index) => {
      const expectedClaimId = (CCP_TUPLE_CLAIM_IDS_V1 as readonly string[])[index];
      if (expectedClaimId === undefined) ccpStrictDenyV1(TUPLE_LOCK_SCHEMA_DENIED);
      const claimV1 = parseCcpTupleClaimV1(claim);
      if (claimV1.claimId !== expectedClaimId) {
        ccpStrictDenyV1(TUPLE_LOCK_SCHEMA_DENIED);
      }
      return claimV1;
    },
  );
  const allClaimsPassed = claims.every((claim) => claim.outcome === "PASSED");
  return { identity, componentId, headDigest, payloadDigest, deliveryId, verifierId, logicalAtMs, claims, allClaimsPassed };
}

function buildTupleLockV1(core: TupleLockCoreV1): CcpTupleLockV1 {
  const unsigned = Object.freeze({
    schemaVersion: CCP_TUPLE_LOCK_SCHEMA_V1,
    ...core.identity,
    componentId: core.componentId,
    headDigest: core.headDigest,
    payloadDigest: core.payloadDigest,
    deliveryId: core.deliveryId,
    verifierId: core.verifierId,
    logicalAtMs: core.logicalAtMs,
    claims: Object.freeze([...core.claims]),
    allClaimsPassed: core.allClaimsPassed,
  });
  return Object.freeze({
    ...unsigned,
    lockDigest: ccpDigestDomainV1(CCP_TUPLE_LOCK_SCHEMA_V1, unsigned),
  });
}

/**
 * Parse and close a complete verification-tuple lock. The claims must be
 * the full closed claim set in the canonical order; `allClaimsPassed` is
 * re-derived from the sealed outcomes and the digest is re-checked. Any
 * drift, partial tuple, reordered tuple or flipped outcome denies with a
 * TypeError carrying the closed denial code.
 */
export function parseCcpTupleLockV1(value: unknown): CcpTupleLockV1 {
  const seen = new WeakSet<object>();
  const record = readCcpClosedObjectV1(
    value,
    TUPLE_LOCK_KEYS,
    seen,
    TUPLE_LOCK_SCHEMA_DENIED,
  );
  if (record.schemaVersion !== CCP_TUPLE_LOCK_SCHEMA_V1) {
    ccpStrictDenyV1(TUPLE_LOCK_SCHEMA_DENIED);
  }
  const core = readTupleLockCore(record, seen);
  if (typeof record.allClaimsPassed !== "boolean" || record.allClaimsPassed !== core.allClaimsPassed) {
    ccpStrictDenyV1(TUPLE_LOCK_SCHEMA_DENIED);
  }
  const lock = buildTupleLockV1(core);
  if (record.lockDigest !== lock.lockDigest) {
    ccpStrictDenyV1(TUPLE_LOCK_SCHEMA_DENIED);
  }
  return lock;
}

/** Parse and close one sealed claim; any drift denies fail-closed. */
export function parseCcpTupleClaimV1(value: unknown): CcpTupleClaimV1 {
  const record = readCcpClosedObjectV1(
    value,
    TUPLE_CLAIM_KEYS,
    new WeakSet<object>(),
    TUPLE_LOCK_SCHEMA_DENIED,
  );
  if (typeof record.claimId !== "string"
    || !CLAIM_ID_PATTERN.test(record.claimId)
    || !(CCP_TUPLE_CLAIM_IDS_V1 as readonly string[]).includes(record.claimId)) {
    ccpStrictDenyV1(TUPLE_LOCK_SCHEMA_DENIED);
  }
  if (typeof record.outcome !== "string"
    || !CLAIM_OUTCOME_VOCABULARY.includes(record.outcome)) {
    ccpStrictDenyV1(TUPLE_LOCK_SCHEMA_DENIED);
  }
  return Object.freeze({
    claimId: record.claimId,
    outcome: record.outcome as CcpClaimOutcomeV1,
    evidenceDigest: assertCcpDigestV1(record.evidenceDigest, TUPLE_LOCK_SCHEMA_DENIED),
  });
}

/**
 * Lock a complete verification tuple. The input is the unsigned tuple —
 * the closed field set without `allClaimsPassed` and `lockDigest`; both
 * are derived and sealed by the lock, so a hand-carried or forged
 * `allClaimsPassed` can never enter the lock. The returned lock receipt is
 * digest-bound over the full sealed tuple. Locking never promotes,
 * authorizes or grants anything — the lock is evidence, and only the
 * independent promotion decision may consume it.
 */
export function lockCcpVerificationTupleV1(tuple: unknown): CcpTupleLockV1 {
  const seen = new WeakSet<object>();
  const record = readCcpClosedObjectV1(
    tuple,
    TUPLE_LOCK_UNSIGNED_KEYS,
    seen,
    TUPLE_LOCK_SCHEMA_DENIED,
  );
  if (record.schemaVersion !== CCP_TUPLE_LOCK_SCHEMA_V1) {
    ccpStrictDenyV1(TUPLE_LOCK_SCHEMA_DENIED);
  }
  return buildTupleLockV1(readTupleLockCore(record, seen));
}

/** Canonical JSON of the closed tuple lock; byte order independent of input key order. */
export function canonicalCcpTupleLockJsonV1(value: unknown): string {
  return canonicalJson(parseCcpTupleLockV1(value));
}

/** Domain-bound content digest of the closed tuple lock. */
export function ccpTupleLockDigestV1(value: unknown): string {
  return parseCcpTupleLockV1(value).lockDigest;
}

/**
 * Verify a verification-tuple lock on read-back. Returns the closed lock
 * on success; returns null when the lock is malformed or forged (partial
 * or reordered claim sets, flipped outcomes, drift in the head, identity
 * or the lock digest).
 */
export function verifyCcpTupleLockV1(value: unknown): CcpTupleLockV1 | null {
  try {
    return parseCcpTupleLockV1(value);
  } catch {
    return null;
  }
}