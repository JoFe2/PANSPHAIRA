import { canonicalJson } from "./canonical-json.js";
import {
  assertCcpDigestV1,
  assertCcpSafePositiveIntegerV1,
  assertCcpSafeUnsignedIntegerV1,
  assertCcpStringV1,
  CCP_PSAI52_INTEGRATION_CLAIM_BOUNDARY_V1,
  CCP_PSAI52_INTEGRATION_CLAIM_IDS_V1,
  CCP_PSAI52_INTEGRATION_RECEIPT_SCHEMA_V1,
  CCP_PSAI52_PRESERVED_DECISION_IDS_V1,
  CCP_SEED_V1,
  ccpDigestDomainV1,
  ccpStrictDenyV1,
  deriveCcpFixtureDigestV1,
  parseCcpPsaI52IntegrationReceiptV1,
  parseCcpEventEnvelopeV1,
  readCcpClosedObjectV1,
  readCcpDenseArrayV1,
  type CcpEventEnvelopeV1,
  type CcpPsaI52IntegrationReceiptV1,
} from "./ccp-event-envelope.js";
import {
  appendCcpIntakeDeliveryV1,
  createCcpIntakeLedgerV1,
  readCcpIntakeProjectionV1,
  type CcpIntakeLedgerIdentityV1,
} from "./ccp-intake-ledger.js";
import {
  projectCcpHeadSupersessionV1,
  type CcpHeadSupersessionProjectionV1,
} from "./ccp-head-supersession.js";

/**
 * CCP PSAI52 deterministic synthetic profile inputs. These are local replay
 * fixtures, not capacity tests: the rate is an input cardinality label only.
 * No wall-clock, worker, queue, network, persistence, provider or randomness
 * capability is present in this module.
 */

export const CCP_SYNTHETIC_PROFILE_SCHEMA_V1 = "cm.ccp-synthetic-profile/v1" as const;
export const CCP_SYNTHETIC_PROFILE_TASK_ID_V1 = "QWEN-PSAI52-PROFILE-REPLAY-08" as const;
export const CCP_SYNTHETIC_EVENT_RATES_V1 = Object.freeze([10, 50, 100, 1_000, 10_000]) as readonly number[];
export const CCP_SYNTHETIC_PROFILE_SEED_V1 = CCP_SEED_V1;
/**
 * Final bounded decision/integration receipt for this task. It binds the
 * already-closed PSAI52 proof references; it neither re-executes their owners
 * nor turns their references into a verification, execution or merge result.
 */
export const CCP_PSAI52_SIMULATION_INTEGRATION_RECEIPT_INPUT_SCHEMA_V1 = "cm.ccp-psai52-simulation-integration-receipt-input/v1" as const;
export const CCP_PSAI52_SIMULATION_INTEGRATION_RECEIPT_SCHEMA_V1 = "cm.ccp-psai52-simulation-integration-receipt/v1" as const;
export const CCP_PSAI52_SIMULATION_INTEGRATION_TASK_ID_V1 = "TERRA-PSAI52-SIMULATION-INTEGRATE-02" as const;
export const CCP_PSAI52_SIMULATION_INTEGRATION_DECISION_V1 = "BOUNDED_EVIDENCE_INTEGRATION_RECEIPT_ISSUED" as const;

export interface CcpSyntheticCoverageV1 {
  readonly eventCount: number;
  readonly admittedCount: number;
  readonly semanticDuplicateCount: number;
  readonly transportDuplicateCount: number;
  readonly staleCount: number;
  readonly quarantinedCount: number;
  readonly appendedCount: number;
  readonly effectCount: number;
  readonly currentCount: number;
  readonly supersededCount: number;
  readonly invalidatedCount: number;
}

export interface CcpSyntheticCapacityBoundaryV1 {
  readonly eventsPerHourClaim: false;
  readonly timingObserved: false;
  readonly throughputMeasured: false;
  readonly capacityEvidence: false;
}

export interface CcpSyntheticProfileV1 {
  readonly schemaVersion: typeof CCP_SYNTHETIC_PROFILE_SCHEMA_V1;
  readonly taskId: typeof CCP_SYNTHETIC_PROFILE_TASK_ID_V1;
  readonly seed: string;
  readonly profileId: string;
  readonly eventsPerHour: number;
  readonly identity: CcpIntakeLedgerIdentityV1;
  readonly events: readonly CcpEventEnvelopeV1[];
  readonly expectedCoverage: CcpSyntheticCoverageV1;
  readonly capacityBoundary: CcpSyntheticCapacityBoundaryV1;
  readonly profileDigest: string;
}

export interface CcpPsaI52SimulationIntegrationReceiptInputV1 {
  readonly schemaVersion: typeof CCP_PSAI52_SIMULATION_INTEGRATION_RECEIPT_INPUT_SCHEMA_V1;
  readonly taskId: typeof CCP_PSAI52_SIMULATION_INTEGRATION_TASK_ID_V1;
  /** The prior closed six-area evidence-binding receipt. */
  readonly integrationReceipt: unknown;
  /** Injected logical observation time; never read from an ambient clock. */
  readonly logicalAtMs: number;
}

export interface CcpPsaI52SimulationIntegrationReceiptV1 {
  readonly schemaVersion: typeof CCP_PSAI52_SIMULATION_INTEGRATION_RECEIPT_SCHEMA_V1;
  readonly taskId: typeof CCP_PSAI52_SIMULATION_INTEGRATION_TASK_ID_V1;
  readonly integrationReceiptSchemaVersion: typeof CCP_PSAI52_INTEGRATION_RECEIPT_SCHEMA_V1;
  readonly integrationReceipt: CcpPsaI52IntegrationReceiptV1;
  readonly integrationReceiptDigest: string;
  readonly preservedDecisionIds: readonly string[];
  readonly claimIds: readonly string[];
  readonly logicalAtMs: number;
  readonly evidenceBound: true;
  readonly decision: typeof CCP_PSAI52_SIMULATION_INTEGRATION_DECISION_V1;
  readonly claimBoundary: typeof CCP_PSAI52_INTEGRATION_CLAIM_BOUNDARY_V1;
  readonly verificationClaimed: false;
  readonly executionAuthorized: false;
  readonly mergeAuthorized: false;
  readonly externalEffectsObserved: false;
  readonly receiptDigest: string;
}

const PROFILE_KEYS = Object.freeze([
  "schemaVersion", "taskId", "seed", "profileId", "eventsPerHour", "identity", "events",
  "expectedCoverage", "capacityBoundary", "profileDigest",
]);
const IDENTITY_KEYS = Object.freeze(["ledgerId", "tenantId", "repositoryId", "contributionId"]);
const COVERAGE_KEYS = Object.freeze([
  "eventCount", "admittedCount", "semanticDuplicateCount", "transportDuplicateCount", "staleCount",
  "quarantinedCount", "appendedCount", "effectCount", "currentCount", "supersededCount", "invalidatedCount",
]);
const CAPACITY_KEYS = Object.freeze([
  "eventsPerHourClaim", "timingObserved", "throughputMeasured", "capacityEvidence",
]);
const SIMULATION_INTEGRATION_INPUT_KEYS = Object.freeze([
  "schemaVersion", "taskId", "integrationReceipt", "logicalAtMs",
]);
const SIMULATION_INTEGRATION_RECEIPT_KEYS = Object.freeze([
  "schemaVersion", "taskId", "integrationReceiptSchemaVersion", "integrationReceipt", "integrationReceiptDigest",
  "preservedDecisionIds", "claimIds", "logicalAtMs", "evidenceBound", "decision", "claimBoundary",
  "verificationClaimed", "executionAuthorized", "mergeAuthorized", "externalEffectsObserved", "receiptDigest",
]);
const SEED_PATTERN = /^SOL-[A-Z0-9]+(?:-[A-Z0-9]+)*$/;
const PROFILE_ID_PATTERN = /^profile:[a-z0-9][a-z0-9._-]{2,95}$/;
const RATE_SET = new Set(CCP_SYNTHETIC_EVENT_RATES_V1);
const CAPACITY_BOUNDARY: CcpSyntheticCapacityBoundaryV1 = Object.freeze({
  eventsPerHourClaim: false,
  timingObserved: false,
  throughputMeasured: false,
  capacityEvidence: false,
});

function profileIdFor(eventsPerHour: number): string {
  return `profile:synthetic-${eventsPerHour}-events-per-hour`;
}

function digestFor(
  seed: string,
  profileId: string,
  label: string,
  sourceOrdinal: number,
): string {
  return deriveCcpFixtureDigestV1({ seed, profileId, label, sourceOrdinal });
}

function eventFor(
  seed: string,
  profileId: string,
  eventsPerHour: number,
  deliveryLabel: string,
  headLabel: string,
  ancestorDigest: string | null,
  logicalAtMs: number,
  sourceOrdinal: number,
): CcpEventEnvelopeV1 {
  return Object.freeze({
    schemaVersion: "cm.ccp-event-envelope/v1",
    ledgerId: `ledger:ccp-profile-${eventsPerHour}`,
    tenantId: "tenant:synthetic",
    repositoryId: "repository:pansphaira",
    contributionId: `contribution:profile-${eventsPerHour}`,
    deliveryId: `delivery:${eventsPerHour}-${deliveryLabel}`,
    headDigest: digestFor(seed, profileId, headLabel, sourceOrdinal),
    payloadDigest: digestFor(seed, profileId, `${headLabel}-payload`, sourceOrdinal),
    ancestorDigest,
    logicalAtMs,
  });
}

function coverageFromEvents(
  identity: CcpIntakeLedgerIdentityV1,
  events: readonly CcpEventEnvelopeV1[],
): { readonly coverage: CcpSyntheticCoverageV1; readonly supersession: CcpHeadSupersessionProjectionV1 } {
  let ledger = createCcpIntakeLedgerV1(identity);
  let admittedCount = 0;
  let semanticDuplicateCount = 0;
  let transportDuplicateCount = 0;
  let staleCount = 0;
  let quarantinedCount = 0;
  let appendedCount = 0;
  let effectCount = 0;
  for (const event of events) {
    const result = appendCcpIntakeDeliveryV1(ledger, event);
    ledger = result.ledger;
    if (result.appended) appendedCount += 1;
    if (result.effectApplied) effectCount += 1;
    switch (result.receipt.disposition) {
      case "ADMITTED": admittedCount += 1; break;
      case "SEMANTIC_DUPLICATE": semanticDuplicateCount += 1; break;
      case "TRANSPORT_DUPLICATE": transportDuplicateCount += 1; break;
      case "STALE": staleCount += 1; break;
      case "QUARANTINED": quarantinedCount += 1; break;
    }
  }
  const projection = readCcpIntakeProjectionV1(ledger);
  const supersession = projectCcpHeadSupersessionV1(ledger);
  return {
    coverage: Object.freeze({
      eventCount: events.length,
      admittedCount,
      semanticDuplicateCount,
      transportDuplicateCount,
      staleCount,
      quarantinedCount,
      appendedCount,
      effectCount,
      currentCount: supersession.currentCount,
      supersededCount: supersession.supersededCount,
      invalidatedCount: supersession.invalidatedCount,
    }),
    supersession,
  };
}

function baseEvents(seed: string, profileId: string, eventsPerHour: number): CcpEventEnvelopeV1[] {
  const genesis = eventFor(seed, profileId, eventsPerHour, "genesis", "head-a", null, 1, 1);
  const forcePush = eventFor(
    seed, profileId, eventsPerHour, "force-push", "head-c", genesis.headDigest, 2, 2,
  );
  const staleBranch = eventFor(
    seed, profileId, eventsPerHour, "stale-branch", "head-b", genesis.headDigest, 3, 3,
  );
  const semanticDuplicate = Object.freeze({
    ...forcePush,
    deliveryId: `delivery:${eventsPerHour}-semantic-duplicate`,
    logicalAtMs: 4,
  });
  const unknownAncestor = eventFor(
    seed, profileId, eventsPerHour, "unknown-ancestor", "head-d", digestFor(seed, profileId, "head-unknown", 99), 5, 5,
  );
  const reusedDelivery = eventFor(
    seed, profileId, eventsPerHour, "genesis", "head-e-reused", forcePush.headDigest, 6, 6,
  );
  const currentChild = eventFor(
    seed, profileId, eventsPerHour, "current-child", "head-e", forcePush.headDigest, 7, 7,
  );
  const staleForcePush = eventFor(
    seed, profileId, eventsPerHour, "stale-force-push", "head-f", genesis.headDigest, 8, 8,
  );
  const logicalRegression = eventFor(
    seed, profileId, eventsPerHour, "logical-regression", "head-g", currentChild.headDigest, 7, 9,
  );

  // The exact genesis object is intentionally repeated to exercise transport
  // deduplication; the new delivery for the force-push head exercises semantic
  // deduplication. The force-push and current-child are admitted transitions.
  return [
    genesis,
    forcePush,
    staleBranch,
    genesis,
    semanticDuplicate,
    unknownAncestor,
    reusedDelivery,
    currentChild,
    staleForcePush,
    logicalRegression,
  ];
}

function generateEvents(seed: string, profileId: string, eventsPerHour: number): readonly CcpEventEnvelopeV1[] {
  const events = baseEvents(seed, profileId, eventsPerHour);
  const current = events[7]!;
  for (let ordinal = 11; ordinal <= eventsPerHour; ordinal += 1) {
    // The first ten events contain every required semantic mix. Higher-rate
    // profiles repeat a known current delivery as transport input so cardinality
    // grows without turning local fixtures into an accidental capacity test.
    events.push(current);
  }
  return Object.freeze(events);
}

function unsignedProfile(
  seed: string,
  profileId: string,
  eventsPerHour: number,
  identity: CcpIntakeLedgerIdentityV1,
  events: readonly CcpEventEnvelopeV1[],
): Omit<CcpSyntheticProfileV1, "profileDigest"> {
  return Object.freeze({
    schemaVersion: CCP_SYNTHETIC_PROFILE_SCHEMA_V1,
    taskId: CCP_SYNTHETIC_PROFILE_TASK_ID_V1,
    seed,
    profileId,
    eventsPerHour,
    identity,
    events,
    expectedCoverage: coverageFromEvents(identity, events).coverage,
    capacityBoundary: CAPACITY_BOUNDARY,
  });
}

/** Build one deterministic profile for one of the five exact fixture rates. */
export function generateCcpSyntheticProfileV1(
  eventsPerHour: number,
  seed: string = CCP_SYNTHETIC_PROFILE_SEED_V1,
): CcpSyntheticProfileV1 {
  if (!RATE_SET.has(eventsPerHour)) ccpStrictDenyV1("CCP_SYNTHETIC_PROFILE_RATE_DENIED");
  if (typeof seed !== "string" || !SEED_PATTERN.test(seed)) ccpStrictDenyV1("CCP_SYNTHETIC_PROFILE_SEED_DENIED");
  const profileId = profileIdFor(eventsPerHour);
  const identity: CcpIntakeLedgerIdentityV1 = Object.freeze({
    ledgerId: `ledger:ccp-profile-${eventsPerHour}`,
    tenantId: "tenant:synthetic",
    repositoryId: "repository:pansphaira",
    contributionId: `contribution:profile-${eventsPerHour}`,
  });
  const unsigned = unsignedProfile(seed, profileId, eventsPerHour, identity, generateEvents(seed, profileId, eventsPerHour));
  return Object.freeze({
    ...unsigned,
    profileDigest: ccpDigestDomainV1(CCP_SYNTHETIC_PROFILE_SCHEMA_V1, unsigned),
  });
}

/** Build all five local deterministic inputs in ascending rate order. */
export function generateCcpSyntheticProfilesV1(
  seed: string = CCP_SYNTHETIC_PROFILE_SEED_V1,
): readonly CcpSyntheticProfileV1[] {
  return Object.freeze(CCP_SYNTHETIC_EVENT_RATES_V1.map((rate) => generateCcpSyntheticProfileV1(rate, seed)));
}

function normalizeCoverage(value: unknown): CcpSyntheticCoverageV1 {
  const record = readCcpClosedObjectV1(value, COVERAGE_KEYS, new WeakSet(), "CCP_SYNTHETIC_PROFILE_SCHEMA_DENIED");
  const values = COVERAGE_KEYS.map((key) => assertCcpSafeUnsignedIntegerV1(record[key], "CCP_SYNTHETIC_PROFILE_SCHEMA_DENIED"));
  const coverage = Object.freeze({
    eventCount: values[0]!, admittedCount: values[1]!, semanticDuplicateCount: values[2]!,
    transportDuplicateCount: values[3]!, staleCount: values[4]!, quarantinedCount: values[5]!,
    appendedCount: values[6]!, effectCount: values[7]!, currentCount: values[8]!,
    supersededCount: values[9]!, invalidatedCount: values[10]!,
  });
  if (coverage.admittedCount + coverage.semanticDuplicateCount + coverage.transportDuplicateCount
    + coverage.staleCount + coverage.quarantinedCount !== coverage.eventCount
    || coverage.appendedCount !== coverage.eventCount - coverage.transportDuplicateCount
    || coverage.effectCount !== coverage.admittedCount || coverage.currentCount > 1) {
    ccpStrictDenyV1("CCP_SYNTHETIC_PROFILE_SCHEMA_DENIED");
  }
  return coverage;
}

function normalizeCapacity(value: unknown): CcpSyntheticCapacityBoundaryV1 {
  const record = readCcpClosedObjectV1(value, CAPACITY_KEYS, new WeakSet(), "CCP_SYNTHETIC_PROFILE_SCHEMA_DENIED");
  if (record.eventsPerHourClaim !== false || record.timingObserved !== false
    || record.throughputMeasured !== false || record.capacityEvidence !== false) {
    ccpStrictDenyV1("CCP_SYNTHETIC_PROFILE_SCHEMA_DENIED");
  }
  return CAPACITY_BOUNDARY;
}

/** Parse and re-derive a profile; forged expected coverage or profile digest denies. */
export function parseCcpSyntheticProfileV1(value: unknown): CcpSyntheticProfileV1 {
  const seen = new WeakSet<object>();
  const record = readCcpClosedObjectV1(value, PROFILE_KEYS, seen, "CCP_SYNTHETIC_PROFILE_SCHEMA_DENIED");
  if (record.schemaVersion !== CCP_SYNTHETIC_PROFILE_SCHEMA_V1 || record.taskId !== CCP_SYNTHETIC_PROFILE_TASK_ID_V1) {
    ccpStrictDenyV1("CCP_SYNTHETIC_PROFILE_SCHEMA_DENIED");
  }
  const identityRecord = readCcpClosedObjectV1(record.identity, IDENTITY_KEYS, seen, "CCP_SYNTHETIC_PROFILE_SCHEMA_DENIED");
  const identity = Object.freeze({
    ledgerId: assertCcpStringV1(identityRecord.ledgerId, /^ledger:[a-z0-9][a-z0-9._-]{2,95}$/, "CCP_SYNTHETIC_PROFILE_SCHEMA_DENIED"),
    tenantId: assertCcpStringV1(identityRecord.tenantId, /^tenant:[a-z0-9][a-z0-9._-]{2,95}$/, "CCP_SYNTHETIC_PROFILE_SCHEMA_DENIED"),
    repositoryId: assertCcpStringV1(identityRecord.repositoryId, /^repository:[a-z0-9][a-z0-9._-]{2,95}$/, "CCP_SYNTHETIC_PROFILE_SCHEMA_DENIED"),
    contributionId: assertCcpStringV1(identityRecord.contributionId, /^contribution:[a-z0-9][a-z0-9._-]{2,95}$/, "CCP_SYNTHETIC_PROFILE_SCHEMA_DENIED"),
  });
  const eventsRaw = readCcpDenseArrayV1(record.events, seen, "CCP_SYNTHETIC_PROFILE_SCHEMA_DENIED");
  const events = Object.freeze(eventsRaw.map((event) => parseCcpEventEnvelopeV1(event)));
  const eventsPerHour = assertCcpSafePositiveIntegerV1(record.eventsPerHour, "CCP_SYNTHETIC_PROFILE_SCHEMA_DENIED");
  if (!RATE_SET.has(eventsPerHour) || events.length !== eventsPerHour
    || typeof record.seed !== "string" || !SEED_PATTERN.test(record.seed)
    || typeof record.profileId !== "string" || !PROFILE_ID_PATTERN.test(record.profileId)
    || record.profileId !== profileIdFor(eventsPerHour)) {
    ccpStrictDenyV1("CCP_SYNTHETIC_PROFILE_SCHEMA_DENIED");
  }
  if (events.some((event) => event.ledgerId !== identity.ledgerId || event.tenantId !== identity.tenantId
    || event.repositoryId !== identity.repositoryId || event.contributionId !== identity.contributionId)) {
    ccpStrictDenyV1("CCP_SYNTHETIC_PROFILE_SCHEMA_DENIED");
  }
  const expectedCoverage = normalizeCoverage(record.expectedCoverage);
  const derived = coverageFromEvents(identity, events).coverage;
  if (canonicalJson(expectedCoverage) !== canonicalJson(derived)) ccpStrictDenyV1("CCP_SYNTHETIC_PROFILE_SCHEMA_DENIED");
  const capacityBoundary = normalizeCapacity(record.capacityBoundary);
  const unsigned = unsignedProfile(record.seed, record.profileId, eventsPerHour, identity, events);
  if (canonicalJson(unsigned) !== canonicalJson({
    ...unsigned,
    expectedCoverage,
    capacityBoundary,
  }) || typeof record.profileDigest !== "string"
    || record.profileDigest !== ccpDigestDomainV1(CCP_SYNTHETIC_PROFILE_SCHEMA_V1, unsigned)) {
    ccpStrictDenyV1("CCP_SYNTHETIC_PROFILE_SCHEMA_DENIED");
  }
  return Object.freeze({ ...unsigned, profileDigest: record.profileDigest as string });
}

export function canonicalCcpSyntheticProfileJsonV1(value: unknown): string {
  return canonicalJson(parseCcpSyntheticProfileV1(value));
}

export function ccpSyntheticProfileDigestV1(value: unknown): string {
  return parseCcpSyntheticProfileV1(value).profileDigest;
}

export function verifyCcpSyntheticProfileV1(value: unknown): CcpSyntheticProfileV1 | null {
  try {
    return parseCcpSyntheticProfileV1(value);
  } catch {
    return null;
  }
}

export function ccpSyntheticCoverageV1(value: unknown): CcpSyntheticCoverageV1 {
  return parseCcpSyntheticProfileV1(value).expectedCoverage;
}

function normalizeSimulationIntegrationInput(
  value: unknown,
): { readonly integrationReceipt: CcpPsaI52IntegrationReceiptV1; readonly logicalAtMs: number } {
  const record = readCcpClosedObjectV1(
    value,
    SIMULATION_INTEGRATION_INPUT_KEYS,
    new WeakSet(),
    "CCP_PSAI52_SIMULATION_INTEGRATION_RECEIPT_SCHEMA_DENIED",
  );
  if (record.schemaVersion !== CCP_PSAI52_SIMULATION_INTEGRATION_RECEIPT_INPUT_SCHEMA_V1
    || record.taskId !== CCP_PSAI52_SIMULATION_INTEGRATION_TASK_ID_V1) {
    ccpStrictDenyV1("CCP_PSAI52_SIMULATION_INTEGRATION_RECEIPT_SCHEMA_DENIED");
  }
  const integrationReceipt = parseCcpPsaI52IntegrationReceiptV1(record.integrationReceipt);
  const logicalAtMs = assertCcpSafeUnsignedIntegerV1(
    record.logicalAtMs,
    "CCP_PSAI52_SIMULATION_INTEGRATION_RECEIPT_SCHEMA_DENIED",
  );
  if (logicalAtMs < integrationReceipt.logicalAtMs) {
    ccpStrictDenyV1("CCP_PSAI52_SIMULATION_INTEGRATION_RECEIPT_SCHEMA_DENIED");
  }
  return Object.freeze({ integrationReceipt, logicalAtMs });
}

function makeSimulationIntegrationReceipt(
  input: { readonly integrationReceipt: CcpPsaI52IntegrationReceiptV1; readonly logicalAtMs: number },
): CcpPsaI52SimulationIntegrationReceiptV1 {
  const unsigned = Object.freeze({
    schemaVersion: CCP_PSAI52_SIMULATION_INTEGRATION_RECEIPT_SCHEMA_V1,
    taskId: CCP_PSAI52_SIMULATION_INTEGRATION_TASK_ID_V1,
    integrationReceiptSchemaVersion: CCP_PSAI52_INTEGRATION_RECEIPT_SCHEMA_V1,
    integrationReceipt: input.integrationReceipt,
    integrationReceiptDigest: input.integrationReceipt.receiptDigest,
    preservedDecisionIds: CCP_PSAI52_PRESERVED_DECISION_IDS_V1,
    claimIds: CCP_PSAI52_INTEGRATION_CLAIM_IDS_V1,
    logicalAtMs: input.logicalAtMs,
    evidenceBound: true as const,
    decision: CCP_PSAI52_SIMULATION_INTEGRATION_DECISION_V1,
    claimBoundary: CCP_PSAI52_INTEGRATION_CLAIM_BOUNDARY_V1,
    verificationClaimed: false as const,
    executionAuthorized: false as const,
    mergeAuthorized: false as const,
    externalEffectsObserved: false as const,
  });
  return Object.freeze({
    ...unsigned,
    receiptDigest: ccpDigestDomainV1(CCP_PSAI52_SIMULATION_INTEGRATION_RECEIPT_SCHEMA_V1, unsigned),
  });
}

function exactSimulationIntegrationStringArray(
  value: unknown,
  expected: readonly string[],
): readonly string[] {
  const values = readCcpDenseArrayV1(
    value,
    new WeakSet(),
    "CCP_PSAI52_SIMULATION_INTEGRATION_RECEIPT_SCHEMA_DENIED",
  );
  if (values.length !== expected.length || values.some((item, index) => item !== expected[index])) {
    ccpStrictDenyV1("CCP_PSAI52_SIMULATION_INTEGRATION_RECEIPT_SCHEMA_DENIED");
  }
  return expected;
}

/**
 * Bind the complete closed PSAI52 evidence receipt to this task's deterministic
 * decision receipt. This emits no product success or external-effect claim.
 */
export function issueCcpPsaI52SimulationIntegrationReceiptV1(
  value: unknown,
): CcpPsaI52SimulationIntegrationReceiptV1 {
  return makeSimulationIntegrationReceipt(normalizeSimulationIntegrationInput(value));
}

/** Parse and re-derive the bounded receipt; altered evidence or authority denies. */
export function parseCcpPsaI52SimulationIntegrationReceiptV1(
  value: unknown,
): CcpPsaI52SimulationIntegrationReceiptV1 {
  const record = readCcpClosedObjectV1(
    value,
    SIMULATION_INTEGRATION_RECEIPT_KEYS,
    new WeakSet(),
    "CCP_PSAI52_SIMULATION_INTEGRATION_RECEIPT_SCHEMA_DENIED",
  );
  if (record.schemaVersion !== CCP_PSAI52_SIMULATION_INTEGRATION_RECEIPT_SCHEMA_V1
    || record.taskId !== CCP_PSAI52_SIMULATION_INTEGRATION_TASK_ID_V1
    || record.integrationReceiptSchemaVersion !== CCP_PSAI52_INTEGRATION_RECEIPT_SCHEMA_V1
    || record.evidenceBound !== true
    || record.decision !== CCP_PSAI52_SIMULATION_INTEGRATION_DECISION_V1
    || record.claimBoundary !== CCP_PSAI52_INTEGRATION_CLAIM_BOUNDARY_V1
    || record.verificationClaimed !== false
    || record.executionAuthorized !== false
    || record.mergeAuthorized !== false
    || record.externalEffectsObserved !== false) {
    ccpStrictDenyV1("CCP_PSAI52_SIMULATION_INTEGRATION_RECEIPT_SCHEMA_DENIED");
  }
  const expected = makeSimulationIntegrationReceipt(normalizeSimulationIntegrationInput({
    schemaVersion: CCP_PSAI52_SIMULATION_INTEGRATION_RECEIPT_INPUT_SCHEMA_V1,
    taskId: CCP_PSAI52_SIMULATION_INTEGRATION_TASK_ID_V1,
    integrationReceipt: record.integrationReceipt,
    logicalAtMs: record.logicalAtMs,
  }));
  const preservedDecisionIds = exactSimulationIntegrationStringArray(
    record.preservedDecisionIds,
    expected.preservedDecisionIds,
  );
  const claimIds = exactSimulationIntegrationStringArray(record.claimIds, expected.claimIds);
  if (canonicalJson(preservedDecisionIds) !== canonicalJson(expected.preservedDecisionIds)
    || canonicalJson(claimIds) !== canonicalJson(expected.claimIds)
    || record.integrationReceiptDigest !== expected.integrationReceiptDigest
    || record.receiptDigest !== expected.receiptDigest) {
    ccpStrictDenyV1("CCP_PSAI52_SIMULATION_INTEGRATION_RECEIPT_SCHEMA_DENIED");
  }
  return expected;
}

export function canonicalCcpPsaI52SimulationIntegrationReceiptJsonV1(value: unknown): string {
  return canonicalJson(parseCcpPsaI52SimulationIntegrationReceiptV1(value));
}

export function ccpPsaI52SimulationIntegrationReceiptDigestV1(value: unknown): string {
  return parseCcpPsaI52SimulationIntegrationReceiptV1(value).receiptDigest;
}

export function verifyCcpPsaI52SimulationIntegrationReceiptV1(
  value: unknown,
): CcpPsaI52SimulationIntegrationReceiptV1 | null {
  try {
    return parseCcpPsaI52SimulationIntegrationReceiptV1(value);
  } catch {
    return null;
  }
}