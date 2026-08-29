import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  CCP_PSAI52_INTEGRATION_CLAIM_IDS_V1,
  CCP_PSAI52_INTEGRATION_TASK_ID_V1,
  CCP_PSAI52_PRESERVED_DECISION_IDS_V1,
  CCP_SEED_V1,
  ccpDigestDomainV1,
  deriveCcpFixtureDigestV1,
  issueCcpPsaI52IntegrationReceiptV1,
} from "../packages/contracts/src/ccp-event-envelope.js";
import {
  canonicalCcpPsaI52SimulationIntegrationReceiptJsonV1,
  ccpPsaI52SimulationIntegrationReceiptDigestV1,
  canonicalCcpSyntheticProfileJsonV1,
  ccpSyntheticProfileDigestV1,
  generateCcpSyntheticProfileV1,
  issueCcpPsaI52SimulationIntegrationReceiptV1,
  parseCcpPsaI52SimulationIntegrationReceiptV1,
  CCP_SYNTHETIC_EVENT_RATES_V1,
  parseCcpSyntheticProfileV1,
  verifyCcpPsaI52SimulationIntegrationReceiptV1,
  verifyCcpSyntheticProfileV1,
} from "../packages/contracts/src/ccp-profile-generator.js";
import {
  canonicalCcpDeterministicReplayReceiptJsonV1,
  replayCcpSyntheticProfileV1,
  verifyCcpDeterministicReplayReceiptV1,
} from "../packages/contracts/src/ccp-deterministic-replay.js";

const fixture = (rate: number): unknown => JSON.parse(
  readFileSync(`tests/fixtures/ccp-profiles/${rate}-event-hour.json`, "utf8"),
);

for (const rate of CCP_SYNTHETIC_EVENT_RATES_V1) {
  test(`CCP-PSAI52-PROFILE-${rate}-001 is a seeded exact-cardinality local input`, () => {
    const profile = parseCcpSyntheticProfileV1(fixture(rate));
    const regenerated = generateCcpSyntheticProfileV1(rate);
    assert.equal(profile.eventsPerHour, rate);
    assert.equal(profile.events.length, rate);
    assert.equal(profile.seed, "SOL-PSAI52-M0-M2-SEED-V1");
    assert.equal(profile.capacityBoundary.eventsPerHourClaim, false);
    assert.equal(profile.capacityBoundary.timingObserved, false);
    assert.equal(profile.capacityBoundary.throughputMeasured, false);
    assert.equal(profile.capacityBoundary.capacityEvidence, false);
    assert.equal(canonicalCcpSyntheticProfileJsonV1(profile), canonicalCcpSyntheticProfileJsonV1(regenerated));
    assert.equal(ccpSyntheticProfileDigestV1(profile), regenerated.profileDigest);
    assert.equal(Object.isFrozen(profile), true);
    assert.equal(Object.isFrozen(profile.events), true);
  });

  test(`CCP-PSAI52-PROFILE-${rate}-002 replay matches canonical bytes and coverage`, () => {
    const receipt = replayCcpSyntheticProfileV1(fixture(rate));
    const coverage = receipt.replayCoverage;
    assert.equal(receipt.inputEventCount, rate);
    assert.equal(receipt.canonicalBytesMatch, true);
    assert.equal(receipt.coverageCountsMatch, true);
    assert.equal(receipt.evidenceComplete, true);
    assert.equal(receipt.decision, "REPLAY_MATCH");
    assert.equal(receipt.timingObserved, false);
    assert.equal(receipt.throughputMeasured, false);
    assert.equal(receipt.capacityEvidence, false);
    assert.equal(receipt.verificationClaimed, false);
    assert.equal(receipt.executionAuthorized, false);
    assert.equal(receipt.mergeAuthorized, false);
    assert.ok(coverage.admittedCount > 0);
    assert.ok(coverage.semanticDuplicateCount > 0);
    assert.ok(coverage.transportDuplicateCount > 0);
    assert.ok(coverage.staleCount > 0);
    assert.ok(coverage.quarantinedCount > 0);
    assert.equal(coverage.eventCount, rate);
    assert.equal(verifyCcpDeterministicReplayReceiptV1(receipt)?.receiptDigest, receipt.receiptDigest);
  });
}

test("CCP-PSAI52-PROFILE-REPLAY-003 key order is irrelevant and generation is seed-bound", () => {
  const profile = generateCcpSyntheticProfileV1(10);
  const reordered = Object.fromEntries(Object.entries(profile).reverse());
  assert.equal(canonicalCcpSyntheticProfileJsonV1(reordered), canonicalCcpSyntheticProfileJsonV1(profile));
  assert.equal(ccpSyntheticProfileDigestV1(reordered), profile.profileDigest);
  assert.notEqual(
    generateCcpSyntheticProfileV1(10, "SOL-PSAI52-OTHER-SEED-V1").profileDigest,
    profile.profileDigest,
  );
  const first = replayCcpSyntheticProfileV1(profile);
  const second = replayCcpSyntheticProfileV1(structuredClone(profile));
  assert.equal(canonicalCcpDeterministicReplayReceiptJsonV1(first), canonicalCcpDeterministicReplayReceiptJsonV1(second));
});

test("CCP-PSAI52-PROFILE-REPLAY-004 invalid rates and forged inputs deny fail-closed", () => {
  assert.throws(() => generateCcpSyntheticProfileV1(11), /CCP_SYNTHETIC_PROFILE_RATE_DENIED/);
  const forgedProfile = structuredClone(fixture(10)) as unknown as Record<string, unknown>;
  (forgedProfile.expectedCoverage as unknown as Record<string, unknown>).quarantinedCount = 0;
  assert.throws(() => parseCcpSyntheticProfileV1(forgedProfile), /CCP_SYNTHETIC_PROFILE_SCHEMA_DENIED/);
  assert.equal(verifyCcpSyntheticProfileV1(forgedProfile), null);

  const forgedReceipt = structuredClone(replayCcpSyntheticProfileV1(fixture(10))) as unknown as Record<string, unknown>;
  forgedReceipt.capacityEvidence = true;
  assert.equal(verifyCcpDeterministicReplayReceiptV1(forgedReceipt), null);
});

function integrationReceipt() {
  return issueCcpPsaI52IntegrationReceiptV1({
    schemaVersion: "cm.ccp-psai52-integration-receipt-input/v1",
    taskId: CCP_PSAI52_INTEGRATION_TASK_ID_V1,
    preservedDecisionIds: [...CCP_PSAI52_PRESERVED_DECISION_IDS_V1],
    evidence: CCP_PSAI52_INTEGRATION_CLAIM_IDS_V1.map((claimId, index) => ({
      claimId,
      evidenceDigest: deriveCcpFixtureDigestV1({
        seed: CCP_SEED_V1,
        profileId: "profile:synthetic-10-events-per-hour",
        label: "simulation-integration-evidence",
        sourceOrdinal: index + 1,
      }),
    })),
    logicalAtMs: 3_600_000,
  });
}

test("TERRA-PSAI52-SIMULATION-INTEGRATE-02 binds the six proof areas without a success or authority claim", () => {
  const source = integrationReceipt();
  const receipt = issueCcpPsaI52SimulationIntegrationReceiptV1({
    schemaVersion: "cm.ccp-psai52-simulation-integration-receipt-input/v1",
    taskId: "TERRA-PSAI52-SIMULATION-INTEGRATE-02",
    integrationReceipt: source,
    logicalAtMs: source.logicalAtMs,
  });
  const reordered = Object.fromEntries(Object.entries(receipt).reverse());
  assert.equal(receipt.evidenceBound, true);
  assert.deepEqual(receipt.preservedDecisionIds, CCP_PSAI52_PRESERVED_DECISION_IDS_V1);
  assert.deepEqual(receipt.claimIds, CCP_PSAI52_INTEGRATION_CLAIM_IDS_V1);
  assert.equal(receipt.integrationReceiptDigest, source.receiptDigest);
  assert.equal(receipt.verificationClaimed, false);
  assert.equal(receipt.executionAuthorized, false);
  assert.equal(receipt.mergeAuthorized, false);
  assert.equal(receipt.externalEffectsObserved, false);
  assert.equal(canonicalCcpPsaI52SimulationIntegrationReceiptJsonV1(reordered), canonicalCcpPsaI52SimulationIntegrationReceiptJsonV1(receipt));
  assert.equal(ccpPsaI52SimulationIntegrationReceiptDigestV1(receipt), receipt.receiptDigest);
  assert.equal(parseCcpPsaI52SimulationIntegrationReceiptV1(receipt).receiptDigest, receipt.receiptDigest);
  assert.equal(verifyCcpPsaI52SimulationIntegrationReceiptV1(receipt)?.receiptDigest, receipt.receiptDigest);
});

test("TERRA-PSAI52-SIMULATION-INTEGRATE-02 denies incomplete upstream evidence and rehashed authority", () => {
  const source = integrationReceipt();
  const input = {
    schemaVersion: "cm.ccp-psai52-simulation-integration-receipt-input/v1",
    taskId: "TERRA-PSAI52-SIMULATION-INTEGRATE-02",
    integrationReceipt: source,
    logicalAtMs: source.logicalAtMs,
  };
  assert.throws(
    () => issueCcpPsaI52SimulationIntegrationReceiptV1({
      ...input,
      integrationReceipt: { ...source, evidence: source.evidence.slice(0, -1) },
    }),
    /CCP_PSAI52_INTEGRATION_RECEIPT_SCHEMA_DENIED/,
  );
  assert.throws(
    () => issueCcpPsaI52SimulationIntegrationReceiptV1({ ...input, logicalAtMs: source.logicalAtMs - 1 }),
    /CCP_PSAI52_SIMULATION_INTEGRATION_RECEIPT_SCHEMA_DENIED/,
  );
  const forged = structuredClone(issueCcpPsaI52SimulationIntegrationReceiptV1(input)) as unknown as Record<string, unknown>;
  forged.mergeAuthorized = true;
  const { receiptDigest: _receiptDigest, ...unsigned } = forged;
  forged.receiptDigest = ccpDigestDomainV1("cm.ccp-psai52-simulation-integration-receipt/v1", unsigned);
  assert.throws(
    () => parseCcpPsaI52SimulationIntegrationReceiptV1(forged),
    /CCP_PSAI52_SIMULATION_INTEGRATION_RECEIPT_SCHEMA_DENIED/,
  );
  assert.equal(verifyCcpPsaI52SimulationIntegrationReceiptV1(forged), null);
});
