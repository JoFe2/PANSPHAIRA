import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  canonicalCcpTrainCandidateJsonV1,
  canonicalCcpTrainContextJsonV1,
  canonicalCcpTrainReceiptJsonV1,
  ccpTrainCandidateDigestV1,
  ccpTrainContextDigestV1,
  ccpTrainReceiptDigestV1,
  evaluateCcpTrainGateV1,
  parseCcpTrainCandidateV1,
  parseCcpTrainContextV1,
  parseCcpTrainReceiptV1,
  verifyCcpTrainReceiptV1,
  CCP_TRAIN_CANDIDATE_SCHEMA_V1,
  CCP_TRAIN_DISPOSITIONS_V1,
  CCP_TRAIN_RECEIPT_SCHEMA_V1,
  CCP_TRAIN_REASON_CODES_V1,
} from "../packages/contracts/src/ccp-component-train.js";
import { ccpDigestDomainV1 } from "../packages/contracts/src/ccp-event-envelope.js";

const digest = (character: string): string => character.repeat(64);

const fixture = (name: string): { candidate: unknown; context: unknown } =>
  JSON.parse(readFileSync(`tests/fixtures/ccp-merge/${name}.json`, "utf8"));

// Byte-stability bindings: digests of the gate receipts produced from the
// green fixture. Any drift in the receipt bytes changes these values.
const GREEN_RECEIPT_DIGEST = "3e67dc0c27d5c79652b495684df1e35628e05c5bb2d4df51520961b30f69eece";
const GREEN_CANDIDATE_DIGEST = "84b268bee1b4b44c65ae9d75e75a814a36c384c516bbc3f12845e3ee452fd0d1";
const GREEN_CONTEXT_DIGEST = "3d5c078c1d72a944fc8f79e87804c7a4c4db613dccc9bc2f6b5880e5b1edc127";

/** Rehash a forged train receipt with its own domain; used only to build rehashed forgeries. */
function rehashTrainReceipt(record: Record<string, unknown>): void {
  const { receiptDigest: _receiptDigest, ...unsigned } = record;
  record.receiptDigest = ccpDigestDomainV1(CCP_TRAIN_RECEIPT_SCHEMA_V1, unsigned);
}

test("CCP-PSAI52-TRN-001 the gate is deterministic, pure and closed; first failure wins", () => {
  const green = fixture("green");
  const first = evaluateCcpTrainGateV1(green.candidate, green.context);
  const second = evaluateCcpTrainGateV1(green.candidate, green.context);

  assert.equal(
    canonicalCcpTrainReceiptJsonV1(first),
    canonicalCcpTrainReceiptJsonV1(second),
  );
  assert.equal(ccpTrainReceiptDigestV1(first), ccpTrainReceiptDigestV1(second));
  assert.equal(ccpTrainReceiptDigestV1(first), GREEN_RECEIPT_DIGEST);
  assert.equal(ccpTrainCandidateDigestV1(first.candidate), GREEN_CANDIDATE_DIGEST);
  assert.equal(ccpTrainContextDigestV1(first.context), GREEN_CONTEXT_DIGEST);

  assert.equal(Object.isFrozen(first), true);
  assert.equal(Object.isFrozen(first.candidate), true);
  assert.equal(Object.isFrozen(first.context), true);
  assert.equal(Object.isFrozen(first.eligibility), true);

  assert.deepEqual([...CCP_TRAIN_DISPOSITIONS_V1], ["ELIGIBLE", "INELIGIBLE"]);
  assert.equal(
    CCP_TRAIN_REASON_CODES_V1.includes("ELIGIBLE_TRAIN_ASSIGNED"),
    true,
  );

  // The green candidate is labeled ELIGIBLE with the bounded label true.
  assert.equal(first.disposition, "ELIGIBLE");
  assert.equal(first.reasonCode, "ELIGIBLE_TRAIN_ASSIGNED");
  assert.equal(first.eligibility.mergeTrainEligible, true);

  // Every fail-closed gate outcome: first failure wins, the label stays false,
  // and each legitimate receipt still verifies on read-back.
  const base = structuredClone(green.candidate) as Record<string, unknown>;
  const variants: {
    reasonCode: string;
    mutate: (candidate: Record<string, unknown>) => void;
  }[] = [
    { reasonCode: "IDENTITY_MISMATCH", mutate: (candidate) => { candidate.ledgerId = "ledger:other"; } },
    { reasonCode: "SCOPE_SUBSTITUTION", mutate: (candidate) => { candidate.componentId = "component:tests"; } },
    { reasonCode: "STALE_LOGICAL_TIME", mutate: (candidate) => { candidate.logicalAtMs = 100; } },
    { reasonCode: "STALE_HEAD_REPLAY", mutate: (candidate) => { candidate.headDigest = (green.context as { trainHeadDigest: string }).trainHeadDigest; } },
    { reasonCode: "MALICIOUS_RISK_CLASS", mutate: (candidate) => { candidate.riskClass = "risk:malicious"; } },
    { reasonCode: "ELEVATED_RISK_CLASS", mutate: (candidate) => { candidate.riskClass = "risk:elevated"; } },
  ];
  for (const variant of variants) {
    const candidate = structuredClone(base);
    variant.mutate(candidate);
    const receipt = evaluateCcpTrainGateV1(candidate, green.context);
    assert.equal(receipt.disposition, "INELIGIBLE");
    assert.equal(receipt.reasonCode, variant.reasonCode);
    assert.equal(receipt.eligibility.mergeTrainEligible, false);
    assert.notEqual(verifyCcpTrainReceiptV1(receipt), null);
  }
});

test("CCP-PSAI52-TRN-002 malformed candidates, contexts and receipts deny before any receipt exists", () => {
  const green = fixture("green");
  const candidate = structuredClone(green.candidate) as Record<string, unknown>;
  const context = structuredClone(green.context) as Record<string, unknown>;

  assert.throws(() => evaluateCcpTrainGateV1("no-candidate", context), /CCP_TRAIN_CANDIDATE_SCHEMA_DENIED/);
  assert.throws(() => evaluateCcpTrainGateV1(candidate, "no-context"), /CCP_TRAIN_CONTEXT_SCHEMA_DENIED/);

  const missingKey = structuredClone(candidate);
  delete missingKey.headDigest;
  assert.throws(() => parseCcpTrainCandidateV1(missingKey), /CCP_TRAIN_CANDIDATE_SCHEMA_DENIED/);

  const extraKey = structuredClone(candidate);
  extraKey.unexpectedField = true;
  assert.throws(() => parseCcpTrainCandidateV1(extraKey), /CCP_TRAIN_CANDIDATE_SCHEMA_DENIED/);

  const unknownComponent = structuredClone(candidate);
  unknownComponent.componentId = "component:unknown";
  assert.throws(() => parseCcpTrainCandidateV1(unknownComponent), /CCP_TRAIN_CANDIDATE_SCHEMA_DENIED/);

  const unknownRiskClass = structuredClone(candidate);
  unknownRiskClass.riskClass = "risk:weird";
  assert.throws(() => parseCcpTrainCandidateV1(unknownRiskClass), /CCP_TRAIN_CANDIDATE_SCHEMA_DENIED/);

  const wrongVersion = structuredClone(candidate);
  wrongVersion.schemaVersion = "cm.ccp-train-candidate/v2";
  assert.throws(() => parseCcpTrainCandidateV1(wrongVersion), /CCP_TRAIN_CANDIDATE_SCHEMA_DENIED/);

  const staleTime = structuredClone(context);
  staleTime.lastTrainedLogicalAtMs = 0;
  assert.throws(() => parseCcpTrainContextV1(staleTime), /CCP_TRAIN_CONTEXT_SCHEMA_DENIED/);

  const legitimate = evaluateCcpTrainGateV1(candidate, context);
  const extraField = structuredClone(legitimate) as unknown as Record<string, unknown>;
  extraField.unexpectedField = true;
  assert.throws(() => parseCcpTrainReceiptV1(extraField), /CCP_TRAIN_RECEIPT_SCHEMA_DENIED/);

  assert.throws(() => ccpTrainCandidateDigestV1(42), /CCP_TRAIN_CANDIDATE_SCHEMA_DENIED/);
  assert.throws(() => canonicalCcpTrainContextJsonV1("no-context"), /CCP_TRAIN_CONTEXT_SCHEMA_DENIED/);
});

test("CCP-PSAI52-TRN-003 rehashed forged receipts deny on read-back", () => {
  const green = fixture("green");
  const legitimate = evaluateCcpTrainGateV1(green.candidate, green.context);

  const denyForged = (mutate: (record: Record<string, unknown>) => void): void => {
    const record = structuredClone(legitimate) as unknown as Record<string, unknown>;
    mutate(record);
    rehashTrainReceipt(record);
    assert.throws(
      () => parseCcpTrainReceiptV1(record),
      /CCP_TRAIN_RECEIPT_SCHEMA_DENIED/,
    );
    assert.equal(verifyCcpTrainReceiptV1(record), null);
  };

  // Forge an INELIGIBLE disposition over green evidence.
  denyForged((record) => {
    record.disposition = "INELIGIBLE";
    record.reasonCode = "ELEVATED_RISK_CLASS";
    (record.eligibility as Record<string, unknown>).mergeTrainEligible = false;
  });

  // Keep the ELIGIBLE disposition but flip the bounded label.
  denyForged((record) => {
    (record.eligibility as Record<string, unknown>).mergeTrainEligible = false;
  });

  // Keep the disposition but claim a different reason code.
  denyForged((record) => {
    record.reasonCode = "MALICIOUS_RISK_CLASS";
  });

  // Tamper with the sealed candidate head.
  denyForged((record) => {
    (record.candidate as Record<string, unknown>).headDigest = digest("9");
  });

  // Tamper with the sealed train context.
  denyForged((record) => {
    (record.context as Record<string, unknown>).trainHeadDigest = digest("8");
  });
});

test("CCP-PSAI52-TRN-004 legitimate receipts verify and canonical bytes are key-order independent", () => {
  const green = fixture("green");
  const receipt = evaluateCcpTrainGateV1(green.candidate, green.context);
  assert.equal(verifyCcpTrainReceiptV1(receipt)?.receiptDigest, GREEN_RECEIPT_DIGEST);

  const reshuffled = Object.fromEntries(Object.entries(receipt).reverse());
  assert.equal(canonicalCcpTrainReceiptJsonV1(reshuffled), canonicalCcpTrainReceiptJsonV1(receipt));
  assert.equal(ccpTrainReceiptDigestV1(reshuffled), ccpTrainReceiptDigestV1(receipt));
  assert.equal(
    canonicalCcpTrainCandidateJsonV1(Object.fromEntries(Object.entries(receipt.candidate).reverse())),
    canonicalCcpTrainCandidateJsonV1(receipt.candidate),
  );
  assert.equal(
    canonicalCcpTrainContextJsonV1(Object.fromEntries(Object.entries(receipt.context).reverse())),
    canonicalCcpTrainContextJsonV1(receipt.context),
  );
});