import assert from "node:assert/strict";
import test from "node:test";

import {
  CCP_EVENT_ENVELOPE_SCHEMA_V1,
  CCP_PSAI52_INTEGRATION_CLAIM_IDS_V1,
  CCP_PSAI52_INTEGRATION_RECEIPT_SCHEMA_V1,
  CCP_PSAI52_INTEGRATION_TASK_ID_V1,
  CCP_PSAI52_PRESERVED_DECISION_IDS_V1,
  canonicalCcpEventEnvelopeBytesV1,
  canonicalCcpEventEnvelopeJsonV1,
  canonicalCcpPsaI52IntegrationReceiptJsonV1,
  ccpDigestDomainV1,
  ccpEventEnvelopeDigestV1,
  ccpPsaI52IntegrationReceiptDigestV1,
  deriveCcpFixtureDigestV1,
  issueCcpPsaI52IntegrationReceiptV1,
  parseCcpPsaI52IntegrationReceiptV1,
  parseCcpEventEnvelopeV1,
  verifyCcpPsaI52IntegrationReceiptV1,
} from "../packages/contracts/src/ccp-event-envelope.js";

const base = {
  schemaVersion: CCP_EVENT_ENVELOPE_SCHEMA_V1,
  ledgerId: "ledger:ccp-synthetic",
  tenantId: "tenant:synthetic",
  repositoryId: "repository:pansphaira",
  contributionId: "contribution:psai52",
  deliveryId: "delivery:envelope-0001",
  headDigest: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
  payloadDigest: "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
  ancestorDigest: null,
  logicalAtMs: 10,
} as const;

test("CCP-PSAI52-ENV-001 key order does not change canonical event bytes or digest", () => {
  const reordered = {
    logicalAtMs: 10,
    ancestorDigest: null,
    payloadDigest: base.payloadDigest,
    headDigest: base.headDigest,
    deliveryId: base.deliveryId,
    contributionId: base.contributionId,
    repositoryId: base.repositoryId,
    tenantId: base.tenantId,
    ledgerId: base.ledgerId,
    schemaVersion: base.schemaVersion,
  };
  assert.equal(canonicalCcpEventEnvelopeJsonV1(base), canonicalCcpEventEnvelopeJsonV1(reordered));
  assert.equal(ccpEventEnvelopeDigestV1(base), ccpEventEnvelopeDigestV1(reordered));
  assert.equal(Buffer.from(canonicalCcpEventEnvelopeBytesV1(base)).toString("utf8"), canonicalCcpEventEnvelopeJsonV1(base));
  assert.equal(Object.isFrozen(parseCcpEventEnvelopeV1(base)), true);
});

test("CCP-PSAI52-ENV-002 malformed or unsafe envelope data is denied", () => {
  for (const candidate of [
    { ...base, headDigest: "A".repeat(64) },
    { ...base, logicalAtMs: -0 },
    { ...base, logicalAtMs: 1.5 },
    { ...base, extra: true },
  ]) {
    assert.throws(() => parseCcpEventEnvelopeV1(candidate), /CCP_EVENT_ENVELOPE_SCHEMA_DENIED/);
  }
});

test("CCP-PSAI52-ENV-003 fixture derivation is seed-bound and deterministic", () => {
  const input = {
    seed: "SOL-PSAI52-M0-M2-SEED-V1",
    profileId: "profile:synthetic-10-events-per-logical-hour",
    label: "delivery",
    sourceOrdinal: 1,
  } as const;
  assert.match(deriveCcpFixtureDigestV1(input), /^[a-f0-9]{64}$/);
  assert.equal(deriveCcpFixtureDigestV1(input), deriveCcpFixtureDigestV1({ ...input }));
  assert.notEqual(deriveCcpFixtureDigestV1(input), deriveCcpFixtureDigestV1({ ...input, sourceOrdinal: 2 }));
});

function integrationInput() {
  return {
    schemaVersion: "cm.ccp-psai52-integration-receipt-input/v1",
    taskId: CCP_PSAI52_INTEGRATION_TASK_ID_V1,
    preservedDecisionIds: [...CCP_PSAI52_PRESERVED_DECISION_IDS_V1],
    evidence: CCP_PSAI52_INTEGRATION_CLAIM_IDS_V1.map((claimId, index) => ({
      claimId,
      evidenceDigest: deriveCcpFixtureDigestV1({
        seed: "SOL-PSAI52-M0-M2-SEED-V1",
        profileId: "profile:synthetic-10-events-per-logical-hour",
        label: "integration-evidence",
        sourceOrdinal: index + 1,
      }),
    })),
    logicalAtMs: 3_600_000,
  };
}

test("CCP-PSAI52-ENV-004 integration receipt binds all proof references without claiming verification or authority", () => {
  const receipt = issueCcpPsaI52IntegrationReceiptV1(integrationInput());
  const reordered = Object.fromEntries(Object.entries(receipt).reverse());
  assert.equal(receipt.schemaVersion, CCP_PSAI52_INTEGRATION_RECEIPT_SCHEMA_V1);
  assert.equal(receipt.evidenceComplete, true);
  assert.equal(receipt.decision, "EVIDENCE_BOUND_RECEIPT_ISSUED");
  assert.equal(receipt.verificationClaimed, false);
  assert.equal(receipt.executionAuthorized, false);
  assert.equal(receipt.mergeAuthorized, false);
  assert.equal(receipt.externalEffectsObserved, false);
  assert.equal(Object.isFrozen(receipt), true);
  assert.equal(Object.isFrozen(receipt.evidence), true);
  assert.equal(canonicalCcpPsaI52IntegrationReceiptJsonV1(receipt), canonicalCcpPsaI52IntegrationReceiptJsonV1(reordered));
  assert.equal(ccpPsaI52IntegrationReceiptDigestV1(reordered), receipt.receiptDigest);
  assert.equal(verifyCcpPsaI52IntegrationReceiptV1(receipt)?.receiptDigest, receipt.receiptDigest);
});

test("CCP-PSAI52-ENV-005 integration receipt rejects incomplete evidence and rehashed authority claims", () => {
  const input = integrationInput();
  assert.throws(
    () => issueCcpPsaI52IntegrationReceiptV1({ ...input, evidence: input.evidence.slice(0, -1) }),
    /CCP_PSAI52_INTEGRATION_RECEIPT_SCHEMA_DENIED/,
  );
  const forged = structuredClone(issueCcpPsaI52IntegrationReceiptV1(input)) as unknown as Record<string, unknown>;
  forged.mergeAuthorized = true;
  const { receiptDigest: _receiptDigest, ...unsigned } = forged;
  forged.receiptDigest = ccpDigestDomainV1(CCP_PSAI52_INTEGRATION_RECEIPT_SCHEMA_V1, unsigned);
  assert.throws(() => parseCcpPsaI52IntegrationReceiptV1(forged), /CCP_PSAI52_INTEGRATION_RECEIPT_SCHEMA_DENIED/);
  assert.equal(verifyCcpPsaI52IntegrationReceiptV1(forged), null);
});
