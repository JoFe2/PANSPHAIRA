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
  parseCcpCostBudgetV1,
  type CcpCostBudgetV1,
} from "./ccp-cost-budget.js";

/**
 * CCP PSAI52 bounded scheduler boundary (M2 fair queue): a deterministic,
 * finite selection over already-produced receipt data. Selection is ordered
 * by least-recent service, then queue age, then the closed fairness key and
 * candidate id. The injected logical time is data only; no clock or random
 * source is consulted.
 *
 * A candidate must explicitly be known, admitted, current and deep-CI-claim
 * eligible before it can be selected. Quarantined, superseded, invalidated,
 * unknown and otherwise ineligible candidates are excluded first and receive
 * a reason-coded exclusion. Selection only emits a bounded receipt: it does
 * not allocate a queue slot, start a runner, execute code or authorize merge.
 */

export const CCP_FAIR_QUEUE_CANDIDATE_SCHEMA_V1 = "cm.ccp-fair-queue-candidate/v1" as const;
export const CCP_FAIR_QUEUE_SELECTION_INPUT_SCHEMA_V1 = "cm.ccp-fair-queue-selection-input/v1" as const;
export const CCP_FAIR_QUEUE_SELECTION_SCHEMA_V1 = "cm.ccp-fair-queue-selection/v1" as const;

export type CcpFairQueueAdmissionStateV1 = "ADMITTED" | "QUARANTINED" | "UNKNOWN";
export type CcpFairQueueHeadStateV1 = "CURRENT" | "SUPERSEDED" | "INVALIDATED" | "UNKNOWN";

export type CcpFairQueueExclusionReasonV1 =
  | "UNKNOWN_CANDIDATE"
  | "QUARANTINED_CANDIDATE"
  | "SUPERSEDED_CANDIDATE"
  | "INVALIDATED_CANDIDATE"
  | "DEEP_CI_CLAIM_INELIGIBLE"
  | "MAX_ITEMS_REACHED"
  | "COST_BUDGET_EXCEEDED";

export const CCP_FAIR_QUEUE_EXCLUSION_REASONS_V1 = Object.freeze([
  "UNKNOWN_CANDIDATE",
  "QUARANTINED_CANDIDATE",
  "SUPERSEDED_CANDIDATE",
  "INVALIDATED_CANDIDATE",
  "DEEP_CI_CLAIM_INELIGIBLE",
  "MAX_ITEMS_REACHED",
  "COST_BUDGET_EXCEEDED",
]) as readonly CcpFairQueueExclusionReasonV1[];

export interface CcpFairQueueCandidateV1 {
  readonly schemaVersion: typeof CCP_FAIR_QUEUE_CANDIDATE_SCHEMA_V1;
  readonly candidateId: string;
  readonly ledgerId: string;
  readonly tenantId: string;
  readonly repositoryId: string;
  readonly contributionId: string;
  /** Digest of the preceding admission/quarantine receipt. */
  readonly receiptDigest: string;
  readonly headDigest: string;
  readonly admissionState: CcpFairQueueAdmissionStateV1;
  readonly headState: CcpFairQueueHeadStateV1;
  /** Must be true only for ADMITTED + CURRENT candidates. */
  readonly deepCiClaimEligible: boolean;
  /** Injected logical enqueue time, not a wall-clock observation. */
  readonly enqueuedAtMs: number;
  /** Explicit cost charged if this candidate is selected. */
  readonly costUnits: number;
  /** Closed fairness class used as a deterministic round-robin tie key. */
  readonly fairnessKey: string;
  /** Injected service sequence; lower values are older service. */
  readonly lastSelectedSequence: number;
}

export interface CcpFairQueueSelectionInputV1 {
  readonly schemaVersion: typeof CCP_FAIR_QUEUE_SELECTION_INPUT_SCHEMA_V1;
  readonly selectionId: string;
  /** Injected logical observation time; it is never read from the host. */
  readonly logicalAtMs: number;
  readonly maxItems: number;
  readonly budget: CcpCostBudgetV1;
  readonly candidates: readonly CcpFairQueueCandidateV1[];
}

export interface CcpFairQueueExclusionV1 {
  readonly candidateId: string;
  readonly reasonCode: CcpFairQueueExclusionReasonV1;
}

export interface CcpFairQueueSelectionV1 {
  readonly schemaVersion: typeof CCP_FAIR_QUEUE_SELECTION_SCHEMA_V1;
  readonly selectionId: string;
  readonly logicalAtMs: number;
  readonly maxItems: number;
  readonly budget: CcpCostBudgetV1;
  readonly selected: readonly CcpFairQueueCandidateV1[];
  readonly exclusions: readonly CcpFairQueueExclusionV1[];
  readonly eligibleCount: number;
  readonly selectedCount: number;
  readonly excludedCount: number;
  readonly selectedCostUnits: number;
  readonly remainingBudgetUnits: number;
  readonly selectionDigest: string;
}

const FAIR_QUEUE_DENIED = "CCP_FAIR_QUEUE_SCHEMA_DENIED";
const CANDIDATE_KEYS = Object.freeze([
  "schemaVersion", "candidateId", "ledgerId", "tenantId", "repositoryId", "contributionId",
  "receiptDigest", "headDigest", "admissionState", "headState", "deepCiClaimEligible",
  "enqueuedAtMs", "costUnits", "fairnessKey", "lastSelectedSequence",
]);
const INPUT_KEYS = Object.freeze(["schemaVersion", "selectionId", "logicalAtMs", "maxItems", "budget", "candidates"]);
const EXCLUSION_KEYS = Object.freeze(["candidateId", "reasonCode"]);
const SELECTION_KEYS = Object.freeze([
  "schemaVersion", "selectionId", "logicalAtMs", "maxItems", "budget", "selected", "exclusions",
  "eligibleCount", "selectedCount", "excludedCount", "selectedCostUnits", "remainingBudgetUnits",
  "selectionDigest",
]);
const NAMESPACED_ID_SUFFIX = "[a-z0-9][a-z0-9._-]{2,95}";
const CANDIDATE_ID_PATTERN = new RegExp(`^queue:${NAMESPACED_ID_SUFFIX}$`);
const SELECTION_ID_PATTERN = new RegExp(`^selection:${NAMESPACED_ID_SUFFIX}$`);
const FAIRNESS_KEY_PATTERN = new RegExp(`^fair:${NAMESPACED_ID_SUFFIX}$`);
const ADMISSION_STATES = Object.freeze(["ADMITTED", "QUARANTINED", "UNKNOWN"]);
const HEAD_STATES = Object.freeze(["CURRENT", "SUPERSEDED", "INVALIDATED", "UNKNOWN"]);

function enumValue<T extends string>(value: unknown, values: readonly string[], code: string): T {
  if (typeof value !== "string" || !values.includes(value)) ccpStrictDenyV1(code);
  return value as T;
}

function normalizeCandidate(value: unknown): CcpFairQueueCandidateV1 {
  const record = readCcpClosedObjectV1(value, CANDIDATE_KEYS, new WeakSet(), FAIR_QUEUE_DENIED);
  if (record.schemaVersion !== CCP_FAIR_QUEUE_CANDIDATE_SCHEMA_V1) ccpStrictDenyV1(FAIR_QUEUE_DENIED);
  const deepCiClaimEligible = record.deepCiClaimEligible;
  if (typeof deepCiClaimEligible !== "boolean") ccpStrictDenyV1(FAIR_QUEUE_DENIED);
  const candidate = Object.freeze({
    schemaVersion: CCP_FAIR_QUEUE_CANDIDATE_SCHEMA_V1,
    candidateId: assertCcpStringV1(record.candidateId, CANDIDATE_ID_PATTERN, FAIR_QUEUE_DENIED),
    ledgerId: assertCcpStringV1(record.ledgerId, LEDGER_ID_PATTERN, FAIR_QUEUE_DENIED),
    tenantId: assertCcpStringV1(record.tenantId, TENANT_ID_PATTERN, FAIR_QUEUE_DENIED),
    repositoryId: assertCcpStringV1(record.repositoryId, REPOSITORY_ID_PATTERN, FAIR_QUEUE_DENIED),
    contributionId: assertCcpStringV1(record.contributionId, CONTRIBUTION_ID_PATTERN, FAIR_QUEUE_DENIED),
    receiptDigest: assertCcpDigestV1(record.receiptDigest, FAIR_QUEUE_DENIED),
    headDigest: assertCcpDigestV1(record.headDigest, FAIR_QUEUE_DENIED),
    admissionState: enumValue<CcpFairQueueAdmissionStateV1>(record.admissionState, ADMISSION_STATES, FAIR_QUEUE_DENIED),
    headState: enumValue<CcpFairQueueHeadStateV1>(record.headState, HEAD_STATES, FAIR_QUEUE_DENIED),
    deepCiClaimEligible,
    enqueuedAtMs: assertCcpSafeUnsignedIntegerV1(record.enqueuedAtMs, FAIR_QUEUE_DENIED),
    costUnits: assertCcpSafePositiveIntegerV1(record.costUnits, FAIR_QUEUE_DENIED),
    fairnessKey: assertCcpStringV1(record.fairnessKey, FAIRNESS_KEY_PATTERN, FAIR_QUEUE_DENIED),
    lastSelectedSequence: assertCcpSafeUnsignedIntegerV1(record.lastSelectedSequence, FAIR_QUEUE_DENIED),
  });
  if (candidate.deepCiClaimEligible !== (candidate.admissionState === "ADMITTED" && candidate.headState === "CURRENT")) {
    ccpStrictDenyV1(FAIR_QUEUE_DENIED);
  }
  return candidate;
}

function normalizeExclusion(value: unknown): CcpFairQueueExclusionV1 {
  const record = readCcpClosedObjectV1(value, EXCLUSION_KEYS, new WeakSet(), FAIR_QUEUE_DENIED);
  return Object.freeze({
    candidateId: assertCcpStringV1(record.candidateId, CANDIDATE_ID_PATTERN, FAIR_QUEUE_DENIED),
    reasonCode: enumValue<CcpFairQueueExclusionReasonV1>(
      record.reasonCode,
      CCP_FAIR_QUEUE_EXCLUSION_REASONS_V1,
      FAIR_QUEUE_DENIED,
    ),
  });
}

function normalizeInput(value: unknown): CcpFairQueueSelectionInputV1 {
  const seen = new WeakSet<object>();
  const record = readCcpClosedObjectV1(value, INPUT_KEYS, seen, FAIR_QUEUE_DENIED);
  if (record.schemaVersion !== CCP_FAIR_QUEUE_SELECTION_INPUT_SCHEMA_V1) ccpStrictDenyV1(FAIR_QUEUE_DENIED);
  const budget = parseCcpCostBudgetV1(record.budget);
  const candidatesRaw = readCcpDenseArrayV1(record.candidates, seen, FAIR_QUEUE_DENIED);
  const ids = new Set<string>();
  const candidates = candidatesRaw.map((candidate) => {
    const normalized = normalizeCandidate(candidate);
    if (normalized.ledgerId !== budget.ledgerId
      || normalized.tenantId !== budget.tenantId
      || normalized.repositoryId !== budget.repositoryId
      || normalized.contributionId !== budget.contributionId) {
      ccpStrictDenyV1(FAIR_QUEUE_DENIED);
    }
    if (ids.has(normalized.candidateId)) ccpStrictDenyV1(FAIR_QUEUE_DENIED);
    ids.add(normalized.candidateId);
    return normalized;
  });
  const logicalAtMs = assertCcpSafeUnsignedIntegerV1(record.logicalAtMs, FAIR_QUEUE_DENIED);
  if (logicalAtMs < budget.logicalAtMs) ccpStrictDenyV1(FAIR_QUEUE_DENIED);
  return Object.freeze({
    schemaVersion: CCP_FAIR_QUEUE_SELECTION_INPUT_SCHEMA_V1,
    selectionId: assertCcpStringV1(record.selectionId, SELECTION_ID_PATTERN, FAIR_QUEUE_DENIED),
    logicalAtMs,
    maxItems: assertCcpSafePositiveIntegerV1(record.maxItems, FAIR_QUEUE_DENIED),
    budget,
    candidates: Object.freeze(candidates),
  });
}

function exclusionReason(candidate: CcpFairQueueCandidateV1): CcpFairQueueExclusionReasonV1 | null {
  if (candidate.admissionState === "UNKNOWN") return "UNKNOWN_CANDIDATE";
  if (candidate.admissionState === "QUARANTINED") return "QUARANTINED_CANDIDATE";
  if (candidate.headState === "UNKNOWN") return "UNKNOWN_CANDIDATE";
  if (candidate.headState === "SUPERSEDED") return "SUPERSEDED_CANDIDATE";
  if (candidate.headState === "INVALIDATED") return "INVALIDATED_CANDIDATE";
  if (!candidate.deepCiClaimEligible) return "DEEP_CI_CLAIM_INELIGIBLE";
  return null;
}

function compareFairQueue(a: CcpFairQueueCandidateV1, b: CcpFairQueueCandidateV1): number {
  if (a.lastSelectedSequence !== b.lastSelectedSequence) return a.lastSelectedSequence < b.lastSelectedSequence ? -1 : 1;
  if (a.enqueuedAtMs !== b.enqueuedAtMs) return a.enqueuedAtMs < b.enqueuedAtMs ? -1 : 1;
  if (a.fairnessKey !== b.fairnessKey) return a.fairnessKey < b.fairnessKey ? -1 : 1;
  if (a.candidateId !== b.candidateId) return a.candidateId < b.candidateId ? -1 : 1;
  return 0;
}

function makeSelection(input: CcpFairQueueSelectionInputV1): CcpFairQueueSelectionV1 {
  const exclusions: CcpFairQueueExclusionV1[] = [];
  const eligible: CcpFairQueueCandidateV1[] = [];
  for (const candidate of input.candidates) {
    const reason = exclusionReason(candidate);
    if (reason === null) eligible.push(candidate);
    else exclusions.push(Object.freeze({ candidateId: candidate.candidateId, reasonCode: reason }));
  }
  eligible.sort(compareFairQueue);
  const selected: CcpFairQueueCandidateV1[] = [];
  let selectedCostUnits = 0;
  for (const candidate of eligible) {
    if (selected.length >= input.maxItems) {
      exclusions.push(Object.freeze({ candidateId: candidate.candidateId, reasonCode: "MAX_ITEMS_REACHED" }));
      continue;
    }
    if (candidate.costUnits > input.budget.remainingUnits - selectedCostUnits) {
      exclusions.push(Object.freeze({ candidateId: candidate.candidateId, reasonCode: "COST_BUDGET_EXCEEDED" }));
      continue;
    }
    selected.push(candidate);
    selectedCostUnits += candidate.costUnits;
  }
  const unsigned = Object.freeze({
    schemaVersion: CCP_FAIR_QUEUE_SELECTION_SCHEMA_V1,
    selectionId: input.selectionId,
    logicalAtMs: input.logicalAtMs,
    maxItems: input.maxItems,
    budget: input.budget,
    selected: Object.freeze([...selected]),
    exclusions: Object.freeze([...exclusions]),
    eligibleCount: eligible.length,
    selectedCount: selected.length,
    excludedCount: exclusions.length,
    selectedCostUnits,
    remainingBudgetUnits: input.budget.remainingUnits - selectedCostUnits,
  });
  return Object.freeze({
    ...unsigned,
    selectionDigest: ccpDigestDomainV1(CCP_FAIR_QUEUE_SELECTION_SCHEMA_V1, unsigned),
  });
}

/** Deterministically select a finite batch from closed receipt data. */
export function selectCcpFairQueueV1(value: unknown): CcpFairQueueSelectionV1 {
  return makeSelection(normalizeInput(value));
}

export function parseCcpFairQueueSelectionInputV1(value: unknown): CcpFairQueueSelectionInputV1 {
  return normalizeInput(value);
}

/** Parse and close one canonical queue candidate receipt. */
export function parseCcpFairQueueCandidateV1(value: unknown): CcpFairQueueCandidateV1 {
  return normalizeCandidate(value);
}

function normalizeSelection(value: unknown): CcpFairQueueSelectionV1 {
  const seen = new WeakSet<object>();
  const record = readCcpClosedObjectV1(value, SELECTION_KEYS, seen, FAIR_QUEUE_DENIED);
  if (record.schemaVersion !== CCP_FAIR_QUEUE_SELECTION_SCHEMA_V1) ccpStrictDenyV1(FAIR_QUEUE_DENIED);
  const selectedRaw = readCcpDenseArrayV1(record.selected, seen, FAIR_QUEUE_DENIED);
  const exclusionsRaw = readCcpDenseArrayV1(record.exclusions, seen, FAIR_QUEUE_DENIED);
  const selected = selectedRaw.map((candidate) => normalizeCandidate(candidate));
  const exclusions = exclusionsRaw.map((exclusion) => normalizeExclusion(exclusion));
  const ids = new Set<string>();
  for (const candidate of selected) {
    if (ids.has(candidate.candidateId) || exclusionFor(candidate.candidateId, exclusions) !== undefined) ccpStrictDenyV1(FAIR_QUEUE_DENIED);
    ids.add(candidate.candidateId);
    if (exclusionReason(candidate) !== null) ccpStrictDenyV1(FAIR_QUEUE_DENIED);
  }
  for (const exclusion of exclusions) {
    if (ids.has(exclusion.candidateId)) ccpStrictDenyV1(FAIR_QUEUE_DENIED);
    ids.add(exclusion.candidateId);
  }
  const logicalAtMs = assertCcpSafeUnsignedIntegerV1(record.logicalAtMs, FAIR_QUEUE_DENIED);
  const maxItems = assertCcpSafePositiveIntegerV1(record.maxItems, FAIR_QUEUE_DENIED);
  const budget = parseCcpCostBudgetV1(record.budget);
  if (logicalAtMs < budget.logicalAtMs || selected.length > maxItems) ccpStrictDenyV1(FAIR_QUEUE_DENIED);
  for (const candidate of selected) {
    if (candidate.ledgerId !== budget.ledgerId
      || candidate.tenantId !== budget.tenantId
      || candidate.repositoryId !== budget.repositoryId
      || candidate.contributionId !== budget.contributionId) {
      ccpStrictDenyV1(FAIR_QUEUE_DENIED);
    }
  }
  const selectedCostUnits = assertCcpSafeUnsignedIntegerV1(record.selectedCostUnits, FAIR_QUEUE_DENIED);
  const expectedCost = selected.reduce((total, candidate) => total + candidate.costUnits, 0);
  if (selectedCostUnits !== expectedCost || selectedCostUnits > budget.remainingUnits) ccpStrictDenyV1(FAIR_QUEUE_DENIED);
  const eligibleCount = assertCcpSafeUnsignedIntegerV1(record.eligibleCount, FAIR_QUEUE_DENIED);
  const selectedCount = assertCcpSafeUnsignedIntegerV1(record.selectedCount, FAIR_QUEUE_DENIED);
  const excludedCount = assertCcpSafeUnsignedIntegerV1(record.excludedCount, FAIR_QUEUE_DENIED);
  if (selectedCount !== selected.length || excludedCount !== exclusions.length || eligibleCount < selectedCount) ccpStrictDenyV1(FAIR_QUEUE_DENIED);
  const remainingBudgetUnits = assertCcpSafeUnsignedIntegerV1(record.remainingBudgetUnits, FAIR_QUEUE_DENIED);
  if (remainingBudgetUnits !== budget.remainingUnits - selectedCostUnits) ccpStrictDenyV1(FAIR_QUEUE_DENIED);
  const unsigned = Object.freeze({
    schemaVersion: CCP_FAIR_QUEUE_SELECTION_SCHEMA_V1,
    selectionId: assertCcpStringV1(record.selectionId, SELECTION_ID_PATTERN, FAIR_QUEUE_DENIED),
    logicalAtMs,
    maxItems,
    budget,
    selected: Object.freeze(selected),
    exclusions: Object.freeze(exclusions),
    eligibleCount,
    selectedCount,
    excludedCount,
    selectedCostUnits,
    remainingBudgetUnits,
  });
  const selectionDigest = ccpDigestDomainV1(CCP_FAIR_QUEUE_SELECTION_SCHEMA_V1, unsigned);
  if (record.selectionDigest !== selectionDigest) ccpStrictDenyV1(FAIR_QUEUE_DENIED);
  return Object.freeze({ ...unsigned, selectionDigest });
}

function exclusionFor(candidateId: string, exclusions: readonly CcpFairQueueExclusionV1[]): CcpFairQueueExclusionV1 | undefined {
  return exclusions.find((exclusion) => exclusion.candidateId === candidateId);
}

export function parseCcpFairQueueSelectionV1(value: unknown): CcpFairQueueSelectionV1 {
  return normalizeSelection(value);
}

export function canonicalCcpFairQueueSelectionJsonV1(value: unknown): string {
  return canonicalJson(parseCcpFairQueueSelectionV1(value));
}

export function ccpFairQueueSelectionDigestV1(value: unknown): string {
  return parseCcpFairQueueSelectionV1(value).selectionDigest;
}

export function verifyCcpFairQueueSelectionV1(value: unknown): CcpFairQueueSelectionV1 | null {
  try {
    return parseCcpFairQueueSelectionV1(value);
  } catch {
    return null;
  }
}
