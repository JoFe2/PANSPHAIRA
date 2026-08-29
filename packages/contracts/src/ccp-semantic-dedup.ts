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
  readCcpDenseArrayV1,
  REPOSITORY_ID_PATTERN,
  TENANT_ID_PATTERN,
} from "./ccp-event-envelope.js";
import {
  parseCcpIntakeLedgerV1,
  type CcpIntakeLedgerIdentityV1,
  type CcpIntakeLedgerV1,
} from "./ccp-intake-ledger.js";

/**
 * CCP PSAI52 bounded intake boundary (M1 ledger, dedup side): a pure,
 * deterministic projection of a verified synthetic intake ledger into
 * delivery/semantic deduplication facts. It labels how many first-seen
 * deliveries each referenced head absorbed as admitted, semantic-duplicate,
 * stale and quarantined entries, and which heads earned a semantic effect.
 *
 * It is a read-only projection: it never allocates a queue slot, schedules a
 * runner, executes code or authorizes a merge. It has no network,
 * persistence, clock or randomness capability. Its digest is domain-bound, so
 * any rehashed drift in the projected facts denies on read-back.
 */

export const CCP_SEMANTIC_DEDUP_PROJECTION_SCHEMA_V1 = "cm.ccp-semantic-dedup/v1" as const;

/** One referenced head, in first-seen order across the ledger entries. */
export interface CcpSemanticDedupHeadV1 {
  readonly headDigest: string;
  /** Non-null iff the head was admitted and earned exactly one semantic effect. */
  readonly semanticEffectId: string | null;
  /** Non-null iff the head was admitted; unique across admitted heads. */
  readonly effectSequence: number | null;
  /** Causal sequence of the first ledger entry referencing the head. */
  readonly firstSeenCausalSequence: number;
  /** 0 or 1: a head can be admitted at most once. */
  readonly admittedDeliveryCount: number;
  /** Entries classified SEMANTIC_DUPLICATE (HEAD_ALREADY_CURRENT) for the head. */
  readonly duplicateDeliveryCount: number;
  /** Entries classified STALE (STALE_ANCESTOR or HEAD_ALREADY_SEEN) for the head. */
  readonly staleDeliveryCount: number;
  /** Entries classified QUARANTINED for the head. */
  readonly quarantinedDeliveryCount: number;
}

export interface CcpSemanticDedupProjectionV1 extends CcpIntakeLedgerIdentityV1 {
  readonly schemaVersion: typeof CCP_SEMANTIC_DEDUP_PROJECTION_SCHEMA_V1;
  readonly ledgerDigest: string;
  /** Number of ledger entries, i.e. first-seen deliveries. */
  readonly totalEntries: number;
  readonly admittedCount: number;
  readonly semanticDuplicateCount: number;
  readonly staleCount: number;
  readonly quarantinedCount: number;
  readonly uniqueHeadCount: number;
  readonly heads: readonly CcpSemanticDedupHeadV1[];
  readonly dedupDigest: string;
}

const DEDUP_PROJECTION_SCHEMA_DENIED = "CCP_SEMANTIC_DEDUP_PROJECTION_SCHEMA_DENIED";

const DEDUP_HEAD_KEYS = Object.freeze([
  "headDigest", "semanticEffectId", "effectSequence", "firstSeenCausalSequence",
  "admittedDeliveryCount", "duplicateDeliveryCount", "staleDeliveryCount",
  "quarantinedDeliveryCount",
]);
const DEDUP_PROJECTION_KEYS = Object.freeze([
  "schemaVersion", "ledgerId", "tenantId", "repositoryId", "contributionId", "ledgerDigest",
  "totalEntries", "admittedCount", "semanticDuplicateCount", "staleCount", "quarantinedCount",
  "uniqueHeadCount", "heads", "dedupDigest",
]);

interface HeadStats {
  admitted: number;
  duplicate: number;
  stale: number;
  quarantined: number;
  firstSeenCausalSequence: number;
}

function makeSemanticDedupProjectionV1(
  ledger: CcpIntakeLedgerV1,
): CcpSemanticDedupProjectionV1 {
  const stats = new Map<string, HeadStats>();
  const seenOrder: string[] = [];
  for (const entry of ledger.entries) {
    const headDigest = entry.receipt.event.headDigest;
    let stat = stats.get(headDigest);
    if (stat === undefined) {
      stat = {
        admitted: 0,
        duplicate: 0,
        stale: 0,
        quarantined: 0,
        firstSeenCausalSequence: entry.causalSequence,
      };
      stats.set(headDigest, stat);
      seenOrder.push(headDigest);
    }
    switch (entry.receipt.disposition) {
      case "ADMITTED":
        stat.admitted += 1;
        break;
      case "SEMANTIC_DUPLICATE":
        stat.duplicate += 1;
        break;
      case "STALE":
        stat.stale += 1;
        break;
      case "QUARANTINED":
        stat.quarantined += 1;
        break;
      case "TRANSPORT_DUPLICATE":
        // A parsed ledger never contains a TRANSPORT_DUPLICATE entry: exact
        // redelivery is rejected before an entry is appended.
        ccpStrictDenyV1("CCP_SEMANTIC_DEDUP_INTERNAL_DENIED");
        break;
    }
  }
  const heads: CcpSemanticDedupHeadV1[] = seenOrder.map((headDigest) => {
    const stat = stats.get(headDigest);
    if (stat === undefined) ccpStrictDenyV1("CCP_SEMANTIC_DEDUP_INTERNAL_DENIED");
    const effect = ledger.semanticEffects.find(
      (candidate) => candidate.semanticEffectKey.headDigest === headDigest,
    ) ?? null;
    return Object.freeze({
      headDigest,
      semanticEffectId: effect === null ? null : effect.semanticEffectId,
      effectSequence: effect === null ? null : effect.effectSequence,
      firstSeenCausalSequence: stat.firstSeenCausalSequence,
      admittedDeliveryCount: stat.admitted,
      duplicateDeliveryCount: stat.duplicate,
      staleDeliveryCount: stat.stale,
      quarantinedDeliveryCount: stat.quarantined,
    });
  });
  const unsigned = Object.freeze({
    schemaVersion: CCP_SEMANTIC_DEDUP_PROJECTION_SCHEMA_V1,
    ledgerId: ledger.ledgerId,
    tenantId: ledger.tenantId,
    repositoryId: ledger.repositoryId,
    contributionId: ledger.contributionId,
    ledgerDigest: ledger.ledgerDigest,
    totalEntries: ledger.entries.length,
    admittedCount: ledger.entries.filter((entry) => entry.receipt.disposition === "ADMITTED").length,
    semanticDuplicateCount: ledger.entries.filter(
      (entry) => entry.receipt.disposition === "SEMANTIC_DUPLICATE",
    ).length,
    staleCount: ledger.entries.filter((entry) => entry.receipt.disposition === "STALE").length,
    quarantinedCount: ledger.entries.filter(
      (entry) => entry.receipt.disposition === "QUARANTINED",
    ).length,
    uniqueHeadCount: seenOrder.length,
    heads: Object.freeze([...heads]),
  });
  return Object.freeze({
    ...unsigned,
    dedupDigest: ccpDigestDomainV1(CCP_SEMANTIC_DEDUP_PROJECTION_SCHEMA_V1, unsigned),
  });
}

/**
 * Project a canonical intake ledger into deterministic delivery/semantic
 * deduplication facts. The ledger is re-parsed and replay-verified first;
 * malformed ledgers deny before any projection exists. Projecting never
 * allocates a queue slot, schedules a runner or authorizes a merge.
 */
export function projectCcpSemanticDedupV1(
  candidateLedger: unknown,
): CcpSemanticDedupProjectionV1 {
  return makeSemanticDedupProjectionV1(parseCcpIntakeLedgerV1(candidateLedger));
}

function normalizeDedupHead(
  value: unknown,
  seen: WeakSet<object>,
  digests: Set<string>,
  effectSequences: Set<number>,
): CcpSemanticDedupHeadV1 {
  const record = readCcpClosedObjectV1(value, DEDUP_HEAD_KEYS, seen, DEDUP_PROJECTION_SCHEMA_DENIED);
  const headDigest = assertCcpDigestV1(record.headDigest, DEDUP_PROJECTION_SCHEMA_DENIED);
  if (digests.has(headDigest)) ccpStrictDenyV1(DEDUP_PROJECTION_SCHEMA_DENIED);
  digests.add(headDigest);
  const semanticEffectId = record.semanticEffectId === null
    ? null
    : assertCcpDigestV1(record.semanticEffectId, DEDUP_PROJECTION_SCHEMA_DENIED);
  const effectSequence = record.effectSequence === null
    ? null
    : assertCcpSafePositiveIntegerV1(record.effectSequence, DEDUP_PROJECTION_SCHEMA_DENIED);
  if ((semanticEffectId === null) !== (effectSequence === null)) {
    ccpStrictDenyV1(DEDUP_PROJECTION_SCHEMA_DENIED);
  }
  if (effectSequence !== null) {
    if (effectSequences.has(effectSequence)) ccpStrictDenyV1(DEDUP_PROJECTION_SCHEMA_DENIED);
    effectSequences.add(effectSequence);
  }
  const firstSeenCausalSequence = assertCcpSafePositiveIntegerV1(
    record.firstSeenCausalSequence,
    DEDUP_PROJECTION_SCHEMA_DENIED,
  );
  const admittedDeliveryCount = assertCcpSafeUnsignedIntegerV1(
    record.admittedDeliveryCount,
    DEDUP_PROJECTION_SCHEMA_DENIED,
  );
  if (admittedDeliveryCount > 1) ccpStrictDenyV1(DEDUP_PROJECTION_SCHEMA_DENIED);
  if ((admittedDeliveryCount === 0) !== (semanticEffectId === null)) {
    ccpStrictDenyV1(DEDUP_PROJECTION_SCHEMA_DENIED);
  }
  const duplicateDeliveryCount = assertCcpSafeUnsignedIntegerV1(
    record.duplicateDeliveryCount,
    DEDUP_PROJECTION_SCHEMA_DENIED,
  );
  const staleDeliveryCount = assertCcpSafeUnsignedIntegerV1(
    record.staleDeliveryCount,
    DEDUP_PROJECTION_SCHEMA_DENIED,
  );
  const quarantinedDeliveryCount = assertCcpSafeUnsignedIntegerV1(
    record.quarantinedDeliveryCount,
    DEDUP_PROJECTION_SCHEMA_DENIED,
  );
  if (admittedDeliveryCount + duplicateDeliveryCount + staleDeliveryCount + quarantinedDeliveryCount < 1) {
    ccpStrictDenyV1(DEDUP_PROJECTION_SCHEMA_DENIED);
  }
  return Object.freeze({
    headDigest,
    semanticEffectId,
    effectSequence,
    firstSeenCausalSequence,
    admittedDeliveryCount,
    duplicateDeliveryCount,
    staleDeliveryCount,
    quarantinedDeliveryCount,
  });
}

/**
 * Parse and close a semantic dedup projection. Counts, per-head tallies,
 * effect bindings and the digest are cross-validated; any drift denies with a
 * TypeError carrying the closed denial code. The returned projection is the
 * expected frozen projection.
 */
export function parseCcpSemanticDedupProjectionV1(
  value: unknown,
): CcpSemanticDedupProjectionV1 {
  const seen = new WeakSet<object>();
  const record = readCcpClosedObjectV1(
    value,
    DEDUP_PROJECTION_KEYS,
    seen,
    DEDUP_PROJECTION_SCHEMA_DENIED,
  );
  if (record.schemaVersion !== CCP_SEMANTIC_DEDUP_PROJECTION_SCHEMA_V1) {
    ccpStrictDenyV1(DEDUP_PROJECTION_SCHEMA_DENIED);
  }
  const identity: CcpIntakeLedgerIdentityV1 = Object.freeze({
    ledgerId: assertCcpStringV1(record.ledgerId, LEDGER_ID_PATTERN, DEDUP_PROJECTION_SCHEMA_DENIED),
    tenantId: assertCcpStringV1(record.tenantId, TENANT_ID_PATTERN, DEDUP_PROJECTION_SCHEMA_DENIED),
    repositoryId: assertCcpStringV1(
      record.repositoryId,
      REPOSITORY_ID_PATTERN,
      DEDUP_PROJECTION_SCHEMA_DENIED,
    ),
    contributionId: assertCcpStringV1(
      record.contributionId,
      CONTRIBUTION_ID_PATTERN,
      DEDUP_PROJECTION_SCHEMA_DENIED,
    ),
  });
  const ledgerDigest = assertCcpDigestV1(record.ledgerDigest, DEDUP_PROJECTION_SCHEMA_DENIED);
  const totalEntries = assertCcpSafeUnsignedIntegerV1(record.totalEntries, DEDUP_PROJECTION_SCHEMA_DENIED);
  const admittedCount = assertCcpSafeUnsignedIntegerV1(record.admittedCount, DEDUP_PROJECTION_SCHEMA_DENIED);
  const semanticDuplicateCount = assertCcpSafeUnsignedIntegerV1(
    record.semanticDuplicateCount,
    DEDUP_PROJECTION_SCHEMA_DENIED,
  );
  const staleCount = assertCcpSafeUnsignedIntegerV1(record.staleCount, DEDUP_PROJECTION_SCHEMA_DENIED);
  const quarantinedCount = assertCcpSafeUnsignedIntegerV1(
    record.quarantinedCount,
    DEDUP_PROJECTION_SCHEMA_DENIED,
  );
  const uniqueHeadCount = assertCcpSafeUnsignedIntegerV1(
    record.uniqueHeadCount,
    DEDUP_PROJECTION_SCHEMA_DENIED,
  );
  if (totalEntries !== admittedCount + semanticDuplicateCount + staleCount + quarantinedCount) {
    ccpStrictDenyV1(DEDUP_PROJECTION_SCHEMA_DENIED);
  }
  const headsRaw = readCcpDenseArrayV1(record.heads, seen, DEDUP_PROJECTION_SCHEMA_DENIED);
  if (headsRaw.length !== uniqueHeadCount) ccpStrictDenyV1(DEDUP_PROJECTION_SCHEMA_DENIED);
  const digests = new Set<string>();
  const effectSequences = new Set<number>();
  let sumAdmitted = 0;
  let sumDuplicate = 0;
  let sumStale = 0;
  let sumQuarantined = 0;
  const heads: CcpSemanticDedupHeadV1[] = headsRaw.map((head) => {
    const normalized = normalizeDedupHead(head, seen, digests, effectSequences);
    sumAdmitted += normalized.admittedDeliveryCount;
    sumDuplicate += normalized.duplicateDeliveryCount;
    sumStale += normalized.staleDeliveryCount;
    sumQuarantined += normalized.quarantinedDeliveryCount;
    return normalized;
  });
  if (sumAdmitted !== admittedCount || sumDuplicate !== semanticDuplicateCount
    || sumStale !== staleCount || sumQuarantined !== quarantinedCount) {
    ccpStrictDenyV1(DEDUP_PROJECTION_SCHEMA_DENIED);
  }
  const unsigned = Object.freeze({
    schemaVersion: CCP_SEMANTIC_DEDUP_PROJECTION_SCHEMA_V1,
    ...identity,
    ledgerDigest,
    totalEntries,
    admittedCount,
    semanticDuplicateCount,
    staleCount,
    quarantinedCount,
    uniqueHeadCount,
    heads: Object.freeze([...heads]),
  });
  const dedupDigest = ccpDigestDomainV1(CCP_SEMANTIC_DEDUP_PROJECTION_SCHEMA_V1, unsigned);
  if (typeof record.dedupDigest !== "string" || record.dedupDigest !== dedupDigest) {
    ccpStrictDenyV1(DEDUP_PROJECTION_SCHEMA_DENIED);
  }
  return Object.freeze({ ...unsigned, dedupDigest });
}

/** Canonical JSON of the closed projection; byte order independent of input key order. */
export function canonicalCcpSemanticDedupProjectionJsonV1(value: unknown): string {
  return canonicalJson(parseCcpSemanticDedupProjectionV1(value));
}

/** Domain-bound content digest of the closed projection. */
export function ccpSemanticDedupProjectionDigestV1(value: unknown): string {
  return parseCcpSemanticDedupProjectionV1(value).dedupDigest;
}

/**
 * Verify a semantic dedup projection on read-back. Returns the closed
 * projection on success; returns null when the projection is malformed or
 * forged (any rehashed drift in the counts, per-head tallies, effect
 * bindings or the dedup digest).
 */
export function verifyCcpSemanticDedupProjectionV1(
  value: unknown,
): CcpSemanticDedupProjectionV1 | null {
  try {
    return parseCcpSemanticDedupProjectionV1(value);
  } catch {
    return null;
  }
}