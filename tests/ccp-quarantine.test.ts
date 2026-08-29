import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  canonicalCcpQuarantineReceiptJsonV1,
  ccpQuarantineReceiptDigestV1,
  makeCcpQuarantineReceiptV1FromAdmissionV1,
  parseCcpQuarantineReceiptV1,
  verifyCcpQuarantineReceiptV1,
  CCP_QUARANTINE_RECEIPT_SCHEMA_V1,
} from "../packages/contracts/src/ccp-quarantine.js";
import {
  evaluateCcpAdmissionGateV1,
  CCP_ADMISSION_RECEIPT_SCHEMA_V1,
} from "../packages/contracts/src/ccp-admission-gate.js";
import { ccpDigestDomainV1 } from "../packages/contracts/src/ccp-event-envelope.js";

const digest = (character: string): string => character.repeat(64);

const fixture = (name: string): { candidate: unknown; context: unknown } =>
  JSON.parse(readFileSync(`tests/fixtures/ccp-admission/${name}.json`, "utf8"));

// Self-binding field digests (unsigned receipt content, excluding the digest field itself).
const MALICIOUS_QUARANTINE_DIGEST = "c0281b3865425fea33168069c20afe1035c98ad562c96e2bd5b04724e87984e0";
const STALE_QUARANTINE_DIGEST = "e2d87625b738bd0b2e4e475b8558f70797f5e3185c5b3d12fd7be7d6783c4b1a";
const AUTHORITY_CHANGE_QUARANTINE_DIGEST = "10082765b37d5f6a3ac7513139c7e8abe0f09e7d9e43df8e383e388ff78e9177";

// Closed-receipt content digests (entire receipt, including the self-binding digest field).
const MALICIOUS_QUARANTINE_RECEIPT_DIGEST = "87d5feac3a3c5c16883472a3286a2d0a1ad0d517589fd55c460e74a680e5bad4";
const AUTHORITY_CHANGE_QUARANTINE_RECEIPT_DIGEST = "2f0786d95e56583da6ab750f3b4331a9f63ff5df6319d11b2c9a90b75a881fc6";

const identity = {
  ledgerId: "ledger:ccp-admission",
  tenantId: "tenant:synthetic",
  repositoryId: "repository:pansphaira",
  contributionId: "contribution:psai52-admission",
};

const context = {
  schemaVersion: "cm.ccp-admission-context/v1",
  ...identity,
  componentId: "component:contracts",
  currentHeadDigest: digest("a"),
  currentAuthorityProfileDigest: digest("c"),
  lastAdmittedLogicalAtMs: 100,
} as const;

const admittedCandidate = {
  schemaVersion: "cm.ccp-admission-candidate/v1",
  ...identity,
  deliveryId: "delivery:admission-valid",
  headDigest: digest("e"),
  payloadDigest: digest("f"),
  ancestorDigest: digest("a"),
  logicalAtMs: 200,
  componentId: "component:contracts",
  riskClass: "risk:standard",
  authorityProfileDigest: digest("c"),
};

/** Rehash a forged admission receipt with its own domain; used only to build rehashed forgeries. */
function rehashAdmission(admission: Record<string, unknown>): void {
  const { receiptDigest: _receiptDigest, ...unsigned } = admission;
  admission.receiptDigest = ccpDigestDomainV1(CCP_ADMISSION_RECEIPT_SCHEMA_V1, unsigned);
}

/** Rehash a forged quarantine receipt with its own domain; used only to build rehashed forgeries. */
function rehashQuarantine(quarantine: Record<string, unknown>): void {
  const { quarantineDigest: _quarantineDigest, ...unsigned } = quarantine;
  quarantine.quarantineDigest = ccpDigestDomainV1(CCP_QUARANTINE_RECEIPT_SCHEMA_V1, unsigned);
}

test("CCP-PSAI52-QTN-001 sealing is pure, deterministic and digest-bound", () => {
  const receipt = evaluateCcpAdmissionGateV1(fixture("malicious").candidate, fixture("malicious").context);
  const inputSnapshot = JSON.stringify(receipt);

  const first = makeCcpQuarantineReceiptV1FromAdmissionV1(receipt);
  const second = makeCcpQuarantineReceiptV1FromAdmissionV1(
    evaluateCcpAdmissionGateV1(fixture("malicious").candidate, fixture("malicious").context),
  );

  assert.equal(JSON.stringify(receipt), inputSnapshot);
  assert.equal(
    canonicalCcpQuarantineReceiptJsonV1(first),
    canonicalCcpQuarantineReceiptJsonV1(second),
  );
  assert.equal(ccpQuarantineReceiptDigestV1(first), MALICIOUS_QUARANTINE_RECEIPT_DIGEST);

  assert.equal(Object.isFrozen(first), true);
  assert.equal(Object.isFrozen(first.admission), true);
  assert.equal(first.schemaVersion, CCP_QUARANTINE_RECEIPT_SCHEMA_V1);
  assert.equal(first.admission.disposition, "QUARANTINED");
  assert.equal(first.reasonCode, "MALICIOUS_RISK_CLASS");
  assert.equal(first.admission.eligibility.queueEligible, false);
  assert.equal(first.admission.eligibility.runnerEligible, false);
  assert.equal(first.admission.eligibility.mergeEligible, false);
});

test("CCP-PSAI52-QTN-002 every fixture failure mode seals as an immutable quarantine receipt", () => {
  const cases = [
    ["malicious", "MALICIOUS_RISK_CLASS", MALICIOUS_QUARANTINE_DIGEST],
    ["stale", "STALE_LOGICAL_TIME", STALE_QUARANTINE_DIGEST],
    ["authority-change", "AUTHORITY_CHANGE", AUTHORITY_CHANGE_QUARANTINE_DIGEST],
  ] as const;
  for (const [name, reasonCode, pinned] of cases) {
    const receipt = evaluateCcpAdmissionGateV1(fixture(name).candidate, fixture(name).context);
    const quarantine = makeCcpQuarantineReceiptV1FromAdmissionV1(receipt);
    assert.equal(quarantine.schemaVersion, CCP_QUARANTINE_RECEIPT_SCHEMA_V1);
    assert.equal(quarantine.admission.disposition, "QUARANTINED");
    assert.equal(quarantine.reasonCode, reasonCode);
    assert.equal(quarantine.quarantineDigest, pinned);
    assert.equal(quarantine.admission.route, null);
    assert.equal(quarantine.admission.eligibility.queueEligible, false);
    assert.equal(quarantine.admission.eligibility.runnerEligible, false);
    assert.equal(quarantine.admission.eligibility.mergeEligible, false);
    assert.ok(verifyCcpQuarantineReceiptV1(quarantine));
  }
});

test("CCP-PSAI52-QTN-003 sealing or parsing an admitted receipt denies fail-closed", () => {
  const admitted = evaluateCcpAdmissionGateV1(admittedCandidate, context);
  assert.equal(admitted.disposition, "ADMITTED");
  assert.throws(
    () => makeCcpQuarantineReceiptV1FromAdmissionV1(admitted),
    /CCP_QUARANTINE_NOT_QUARANTINED/,
  );
  assert.throws(
    () =>
      parseCcpQuarantineReceiptV1({
        schemaVersion: CCP_QUARANTINE_RECEIPT_SCHEMA_V1,
        admission: admitted,
        reasonCode: "ADMITTED_ROUTE_ASSIGNED",
        quarantineDigest: digest("0"),
      }),
    /CCP_QUARANTINE_NOT_QUARANTINED/,
  );
});

test("CCP-PSAI52-QTN-004 rehashed forged quarantine receipts deny on read-back", () => {
  const receipt = evaluateCcpAdmissionGateV1(fixture("stale").candidate, fixture("stale").context);
  const legitimate = makeCcpQuarantineReceiptV1FromAdmissionV1(receipt);

  const forgedInner = structuredClone(legitimate) as unknown as Record<string, unknown>;
  const inner = forgedInner.admission as Record<string, unknown>;
  inner.reasonCode = "MALICIOUS_RISK_CLASS";
  (inner.eligibility as Record<string, unknown>).queueEligible = true;
  rehashAdmission(inner);
  assert.throws(
    () => parseCcpQuarantineReceiptV1(forgedInner),
    /CCP_ADMISSION_RECEIPT_SCHEMA_DENIED/,
  );
  assert.equal(verifyCcpQuarantineReceiptV1(forgedInner), null);

  const driftedReason = structuredClone(legitimate) as unknown as Record<string, unknown>;
  driftedReason.reasonCode = "MALICIOUS_RISK_CLASS";
  rehashQuarantine(driftedReason);
  assert.throws(
    () => parseCcpQuarantineReceiptV1(driftedReason),
    /CCP_QUARANTINE_RECEIPT_SCHEMA_DENIED/,
  );
  assert.equal(verifyCcpQuarantineReceiptV1(driftedReason), null);

  const widened = structuredClone(legitimate) as unknown as Record<string, unknown>;
  (widened.admission as Record<string, unknown>).eligibility = {
    queueEligible: true,
    runnerEligible: true,
    mergeEligible: true,
  };
  rehashQuarantine(widened);
  assert.throws(
    () => parseCcpQuarantineReceiptV1(widened),
    /CCP_ADMISSION_RECEIPT_SCHEMA_DENIED/,
  );
  assert.equal(verifyCcpQuarantineReceiptV1(widened), null);
});

test("CCP-PSAI52-QTN-005 canonical quarantine bytes are key-order independent and malformed shapes deny", () => {
  const receipt = evaluateCcpAdmissionGateV1(
    fixture("authority-change").candidate,
    fixture("authority-change").context,
  );
  const quarantine = makeCcpQuarantineReceiptV1FromAdmissionV1(receipt);
  const reshuffled = Object.fromEntries(Object.entries(quarantine).reverse());
  assert.equal(
    canonicalCcpQuarantineReceiptJsonV1(quarantine),
    canonicalCcpQuarantineReceiptJsonV1(reshuffled),
  );
  assert.equal(ccpQuarantineReceiptDigestV1(reshuffled), AUTHORITY_CHANGE_QUARANTINE_RECEIPT_DIGEST);

  assert.throws(
    () =>
      parseCcpQuarantineReceiptV1({
        schemaVersion: CCP_QUARANTINE_RECEIPT_SCHEMA_V1,
        admission: receipt,
        reasonCode: "AUTHORITY_CHANGE",
      }),
    /CCP_QUARANTINE_RECEIPT_SCHEMA_DENIED/,
  );
  assert.throws(() => parseCcpQuarantineReceiptV1("sealed"), /CCP_QUARANTINE_RECEIPT_SCHEMA_DENIED/);
  assert.throws(
    () =>
      parseCcpQuarantineReceiptV1({
        schemaVersion: CCP_QUARANTINE_RECEIPT_SCHEMA_V1,
        admission: receipt,
        reasonCode: "AUTHORITY_CHANGE",
        quarantineDigest: digest("0"),
        foreignField: true,
      }),
    /CCP_QUARANTINE_RECEIPT_SCHEMA_DENIED/,
  );
});