import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  canonicalCcpAdmissionReceiptJsonV1,
  ccpAdmissionReceiptDigestV1,
  ccpCandidateDigestV1,
  ccpContextDigestV1,
  evaluateCcpAdmissionGateV1,
  parseCcpAdmissionCandidateV1,
  parseCcpAdmissionContextV1,
  parseCcpAdmissionReceiptV1,
  verifyCcpAdmissionReceiptV1,
  CCP_ADMISSION_DISPOSITIONS_V1,
  CCP_ADMISSION_RECEIPT_SCHEMA_V1,
  CCP_ADMISSION_REASON_CODES_V1,
} from "../packages/contracts/src/ccp-admission-gate.js";
import { ccpDigestDomainV1 } from "../packages/contracts/src/ccp-event-envelope.js";

const digest = (character: string): string => character.repeat(64);

const fixture = (name: string): { candidate: unknown; context: unknown } =>
  JSON.parse(readFileSync(`tests/fixtures/ccp-admission/${name}.json`, "utf8"));

const VALID_RECEIPT_DIGEST = "31977f44f9e23dedca9108576b4cbfda5a49e5f5a6b99b8073d1284c12c63291";
const ELEVATED_RECEIPT_DIGEST = "5650c78f35ff483db6534e5ab99c1bed7f69977315c013769f71e93e5d43458e";
const MALICIOUS_RECEIPT_DIGEST = "1ec31229e8927ed46099a4045f61f089c3cf9bcf8955245d4ab4cb50f3016489";
const STALE_RECEIPT_DIGEST = "8e083c3dcc158beb8c441287243371dcb88eaf5f5f7fa4d1a141973aca19ab24";
const AUTHORITY_CHANGE_RECEIPT_DIGEST = "b524a4f9ce9b50fd90115c197a351d921e6fa258b0c0b070def0fb8001096f37";
const CANDIDATE_VALID_DIGEST = "318600e87e388bb29107dcd4cfee43455cf7bcaba6d6ea2790321b1071f511c6";
const CONTEXT_DIGEST = "f153e230e71f05d01bc5a1ca942c1c849567d5ce81780e504aac3b6360e1c6f9";

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

function candidate(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
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
    ...overrides,
  };
}

/** Rehash a forged admission receipt with its own domain; used only to build rehashed forgeries. */
function rehashReceipt(receipt: Record<string, unknown>): void {
  const { receiptDigest: _receiptDigest, ...unsigned } = receipt;
  receipt.receiptDigest = ccpDigestDomainV1(CCP_ADMISSION_RECEIPT_SCHEMA_V1, unsigned);
}

test("CCP-PSAI52-ADM-001 gate evaluation is deterministic and pure", () => {
  const fixtureInput = fixture("malicious");
  const inputSnapshot = JSON.stringify(fixtureInput);
  const first = evaluateCcpAdmissionGateV1(fixtureInput.candidate, fixtureInput.context);
  const second = evaluateCcpAdmissionGateV1(fixture("malicious").candidate, fixture("malicious").context);

  assert.equal(JSON.stringify(fixtureInput), inputSnapshot);
  assert.equal(
    canonicalCcpAdmissionReceiptJsonV1(first),
    canonicalCcpAdmissionReceiptJsonV1(second),
  );
  assert.equal(ccpAdmissionReceiptDigestV1(first), ccpAdmissionReceiptDigestV1(second));

  assert.equal(Object.isFrozen(first), true);
  assert.equal(Object.isFrozen(first.candidate), true);
  assert.equal(Object.isFrozen(first.context), true);
  assert.equal(Object.isFrozen(first.eligibility), true);

  assert.deepEqual([...CCP_ADMISSION_DISPOSITIONS_V1], ["ADMITTED", "QUARANTINED"]);
  assert.equal(CCP_ADMISSION_REASON_CODES_V1.length, 9);
});

test("CCP-PSAI52-ADM-002 admitted candidates carry bounded eligibility and never merge", () => {
  const valid = evaluateCcpAdmissionGateV1(candidate(), context);
  assert.equal(valid.disposition, "ADMITTED");
  assert.equal(valid.reasonCode, "ADMITTED_ROUTE_ASSIGNED");
  assert.equal(valid.route?.routeId, "route:contracts-standard");
  assert.deepEqual(valid.eligibility, {
    queueEligible: true,
    runnerEligible: true,
    mergeEligible: false,
  });
  assert.equal(valid.receiptDigest, VALID_RECEIPT_DIGEST);
  assert.equal(valid.candidateDigest, CANDIDATE_VALID_DIGEST);
  assert.equal(valid.contextDigest, CONTEXT_DIGEST);
  assert.equal(Object.isFrozen(valid.route), true);

  const elevated = evaluateCcpAdmissionGateV1(
    candidate({ deliveryId: "delivery:admission-elevated", riskClass: "risk:elevated" }),
    context,
  );
  assert.equal(elevated.disposition, "ADMITTED");
  assert.equal(elevated.route?.routeId, "route:contracts-elevated");
  assert.deepEqual(elevated.eligibility, {
    queueEligible: true,
    runnerEligible: false,
    mergeEligible: false,
  });
  assert.equal(elevated.receiptDigest, ELEVATED_RECEIPT_DIGEST);
});

test("CCP-PSAI52-ADM-003 malicious, stale and authority-changing fixtures quarantine fail-closed", () => {
  const malicious = evaluateCcpAdmissionGateV1(fixture("malicious").candidate, fixture("malicious").context);
  assert.equal(malicious.disposition, "QUARANTINED");
  assert.equal(malicious.reasonCode, "MALICIOUS_RISK_CLASS");
  assert.equal(malicious.route, null);
  assert.deepEqual(malicious.eligibility, {
    queueEligible: false,
    runnerEligible: false,
    mergeEligible: false,
  });
  assert.equal(malicious.receiptDigest, MALICIOUS_RECEIPT_DIGEST);

  const stale = evaluateCcpAdmissionGateV1(fixture("stale").candidate, fixture("stale").context);
  assert.equal(stale.disposition, "QUARANTINED");
  assert.equal(stale.reasonCode, "STALE_LOGICAL_TIME");
  assert.equal(stale.route, null);
  assert.deepEqual(stale.eligibility, {
    queueEligible: false,
    runnerEligible: false,
    mergeEligible: false,
  });
  assert.equal(stale.receiptDigest, STALE_RECEIPT_DIGEST);

  const authorityChange = evaluateCcpAdmissionGateV1(
    fixture("authority-change").candidate,
    fixture("authority-change").context,
  );
  assert.equal(authorityChange.disposition, "QUARANTINED");
  assert.equal(authorityChange.reasonCode, "AUTHORITY_CHANGE");
  assert.equal(authorityChange.route, null);
  assert.deepEqual(authorityChange.eligibility, {
    queueEligible: false,
    runnerEligible: false,
    mergeEligible: false,
  });
  assert.equal(authorityChange.receiptDigest, AUTHORITY_CHANGE_RECEIPT_DIGEST);
});

test("CCP-PSAI52-ADM-004 unknown identity, component, risk, scope and replay deny", () => {
  const foreignIdentity = evaluateCcpAdmissionGateV1(candidate({ tenantId: "tenant:foreign" }), context);
  assert.equal(foreignIdentity.reasonCode, "IDENTITY_MISMATCH");

  const unknownComponent = evaluateCcpAdmissionGateV1(
    candidate({ componentId: "component:unknown-part" }),
    context,
  );
  assert.equal(unknownComponent.reasonCode, "UNKNOWN_COMPONENT");

  const unknownRisk = evaluateCcpAdmissionGateV1(
    candidate({ riskClass: "risk:unknown-class" }),
    context,
  );
  assert.equal(unknownRisk.reasonCode, "UNKNOWN_RISK_CLASS");

  const scopeSubstitution = evaluateCcpAdmissionGateV1(
    candidate({ componentId: "component:schemas" }),
    context,
  );
  assert.equal(scopeSubstitution.reasonCode, "SCOPE_SUBSTITUTION");

  const headReplay = evaluateCcpAdmissionGateV1(candidate({ headDigest: digest("a") }), context);
  assert.equal(headReplay.reasonCode, "STALE_HEAD_REPLAY");

  for (const receipt of [foreignIdentity, unknownComponent, unknownRisk, scopeSubstitution, headReplay]) {
    assert.equal(receipt.disposition, "QUARANTINED");
    assert.equal(receipt.route, null);
    assert.deepEqual(receipt.eligibility, {
      queueEligible: false,
      runnerEligible: false,
      mergeEligible: false,
    });
  }
});

test("CCP-PSAI52-ADM-005 malformed candidates and contexts deny before any receipt", () => {
  const foreignField = candidate();
  foreignField.foreignField = true;
  assert.throws(
    () => evaluateCcpAdmissionGateV1(foreignField, context),
    /CCP_ADMISSION_CANDIDATE_SCHEMA_DENIED/,
  );
  assert.throws(
    () => evaluateCcpAdmissionGateV1(candidate({ logicalAtMs: -5 }), context),
    /CCP_ADMISSION_CANDIDATE_SCHEMA_DENIED/,
  );
  assert.throws(
    () => evaluateCcpAdmissionGateV1(candidate({ headDigest: digest("z") }), context),
    /CCP_ADMISSION_CANDIDATE_SCHEMA_DENIED/,
  );
  assert.throws(
    () => evaluateCcpAdmissionGateV1(candidate(), { ...context, extraField: true }),
    /CCP_ADMISSION_CONTEXT_SCHEMA_DENIED/,
  );
  assert.throws(
    () => evaluateCcpAdmissionGateV1(candidate(), { ...context, lastAdmittedLogicalAtMs: "soon" }),
    /CCP_ADMISSION_CONTEXT_SCHEMA_DENIED/,
  );
  assert.throws(() => parseCcpAdmissionCandidateV1("no-candidate"), /CCP_ADMISSION_CANDIDATE_SCHEMA_DENIED/);
  assert.throws(() => parseCcpAdmissionContextV1(42), /CCP_ADMISSION_CONTEXT_SCHEMA_DENIED/);
  assert.throws(
    () => ccpCandidateDigestV1({ ...candidate(), deliveryId: 7 }),
    /CCP_ADMISSION_CANDIDATE_SCHEMA_DENIED/,
  );
  assert.throws(
    () => ccpContextDigestV1({ ...context, currentHeadDigest: digest("z") }),
    /CCP_ADMISSION_CONTEXT_SCHEMA_DENIED/,
  );
});

test("CCP-PSAI52-ADM-006 rehashed forged receipts deny on read-back", () => {
  const legitimate = evaluateCcpAdmissionGateV1(fixture("malicious").candidate, fixture("malicious").context);

  const forgedDisposition = structuredClone(legitimate) as unknown as Record<string, unknown>;
  forgedDisposition.disposition = "ADMITTED";
  forgedDisposition.reasonCode = "ADMITTED_ROUTE_ASSIGNED";
  forgedDisposition.route = {
    schemaVersion: "cm.ccp-risk-routing/v1",
    routeId: "route:contracts-malicious",
    routeKind: "QUARANTINE_ONLY",
    componentId: "component:contracts",
    riskClass: "risk:malicious",
    queueEligible: false,
    runnerEligible: false,
    mergeEligible: false,
  };
  rehashReceipt(forgedDisposition);
  assert.throws(
    () => parseCcpAdmissionReceiptV1(forgedDisposition),
    /CCP_ADMISSION_RECEIPT_SCHEMA_DENIED/,
  );
  assert.equal(verifyCcpAdmissionReceiptV1(forgedDisposition), null);

  const legitimateStale = evaluateCcpAdmissionGateV1(fixture("stale").candidate, fixture("stale").context);
  const widened = structuredClone(legitimateStale) as unknown as Record<string, unknown>;
  (widened.eligibility as Record<string, unknown>).queueEligible = true;
  rehashReceipt(widened);
  assert.throws(
    () => parseCcpAdmissionReceiptV1(widened),
    /CCP_ADMISSION_RECEIPT_SCHEMA_DENIED/,
  );
  assert.equal(verifyCcpAdmissionReceiptV1(widened), null);

  const driftedCandidate = structuredClone(legitimate) as unknown as Record<string, unknown>;
  (driftedCandidate.candidate as Record<string, unknown>).deliveryId = "delivery:admission-forged";
  rehashReceipt(driftedCandidate);
  assert.throws(
    () => parseCcpAdmissionReceiptV1(driftedCandidate),
    /CCP_ADMISSION_RECEIPT_SCHEMA_DENIED/,
  );
  assert.equal(verifyCcpAdmissionReceiptV1(driftedCandidate), null);
});

test("CCP-PSAI52-ADM-007 legitimate receipts verify and canonical bytes are key-order independent", () => {
  const receipt = evaluateCcpAdmissionGateV1(
    fixture("authority-change").candidate,
    fixture("authority-change").context,
  );
  assert.equal(
    verifyCcpAdmissionReceiptV1(receipt)?.receiptDigest,
    AUTHORITY_CHANGE_RECEIPT_DIGEST,
  );

  const reshuffled = Object.fromEntries(Object.entries(receipt).reverse());
  assert.equal(
    canonicalCcpAdmissionReceiptJsonV1(receipt),
    canonicalCcpAdmissionReceiptJsonV1(reshuffled),
  );
  assert.equal(
    ccpAdmissionReceiptDigestV1(reshuffled),
    ccpAdmissionReceiptDigestV1(receipt),
  );

  assert.throws(() => parseCcpAdmissionReceiptV1("sealed"), /CCP_ADMISSION_RECEIPT_SCHEMA_DENIED/);
  assert.throws(
    () => parseCcpAdmissionReceiptV1({ ...receipt, extraField: true }),
    /CCP_ADMISSION_RECEIPT_SCHEMA_DENIED/,
  );
});