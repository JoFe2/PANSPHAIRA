import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  appendCcpIntakeDeliveryV1,
  canonicalCcpDeliveryReceiptJsonV1,
  canonicalCcpEventBytesV1,
  canonicalCcpIntakeLedgerJsonV1,
  ccpSemanticEffectKeyV1,
  createCcpIntakeLedgerV1,
  parseCcpDeliveryReceiptV1,
  parseCcpEventEnvelopeV1,
  readCcpIntakeProjectionV1,
  verifyCcpIntakeLedgerV1,
  CCP_INTAKE_LEDGER_SCHEMA_V1,
  type CcpEventEnvelopeV1,
  type CcpIntakeLedgerV1,
} from "../packages/contracts/src/ccp-intake-ledger.js";
import { ccpDigestDomainV1 } from "../packages/contracts/src/ccp-event-envelope.js";

const fixture = (name: string): unknown => JSON.parse(
  readFileSync(`tests/fixtures/ccp-intake/${name}.json`, "utf8"),
);

const identity = {
  ledgerId: "ledger:ccp-synthetic",
  tenantId: "tenant:synthetic",
  repositoryId: "repository:pansphaira",
  contributionId: "contribution:psai52",
} as const;

const VALID_RECEIPT_DIGEST = "ddd4dde25c9a3791b1e406c4da131da8f1e08331b64849218f0de759b10587ac";
const REPLAY_RECEIPT_DIGEST = "c5ae72a95cd68e0e6f83fb3517b75ce7b4aeafbfce8324622ce2f91def041628";

const digest = (character: string): string => character.repeat(64);

function event(overrides: Partial<CcpEventEnvelopeV1> = {}): CcpEventEnvelopeV1 {
  return {
    schemaVersion: "cm.ccp-event-envelope/v1",
    ...identity,
    deliveryId: "delivery:synthetic-0001",
    headDigest: digest("a"),
    payloadDigest: digest("b"),
    ancestorDigest: null,
    logicalAtMs: 10,
    ...overrides,
  };
}

function stateBytes(state: CcpIntakeLedgerV1): string {
  return canonicalCcpIntakeLedgerJsonV1(state);
}

function rehashReceipt(receipt: Record<string, any>): void {
  const { receiptDigest: _receiptDigest, ...unsigned } = receipt;
  receipt.receiptDigest = ccpDigestDomainV1("cm.ccp-intake-receipt/v1", unsigned);
}

function rehashEntry(entry: Record<string, any>): void {
  entry.entryDigest = ccpDigestDomainV1("cm.ccp-intake-entry/v1", {
    schemaVersion: entry.schemaVersion,
    causalSequence: entry.causalSequence,
    previousEntryDigest: entry.previousEntryDigest,
    receiptDigest: entry.receipt.receiptDigest,
    semanticEffectId: entry.semanticEffectId,
  });
}

function rehashLedger(ledger: Record<string, any>): void {
  ledger.ledgerDigest = ccpDigestDomainV1("cm.ccp-intake-ledger/v1", {
    schemaVersion: ledger.schemaVersion,
    ledgerId: ledger.ledgerId,
    tenantId: ledger.tenantId,
    repositoryId: ledger.repositoryId,
    contributionId: ledger.contributionId,
    entryDigests: ledger.entries.map((entry: Record<string, unknown>) => entry.entryDigest),
    semanticEffectIds: ledger.semanticEffects.map((effect: Record<string, unknown>) => effect.semanticEffectId),
    nextCausalSequence: ledger.nextCausalSequence,
  });
}

test("CCP-PSAI52-INT-001 canonical event bytes are deterministic and closed", () => {
  const valid = fixture("valid-delivery");
  const replay = fixture("replayed-delivery");
  const parsed = parseCcpEventEnvelopeV1(valid) as CcpEventEnvelopeV1;
  assert.equal(
    Buffer.from(canonicalCcpEventBytesV1(valid)).toString("utf8"),
    Buffer.from(canonicalCcpEventBytesV1(replay)).toString("utf8"),
  );
  assert.equal(Object.isFrozen(parsed), true);
  assert.equal(Object.isFrozen(canonicalCcpEventBytesV1(valid)), false);
  assert.equal(
    Buffer.from(canonicalCcpEventBytesV1(valid)).toString("utf8").endsWith("\n"),
    false,
  );
  assert.deepEqual(ccpSemanticEffectKeyV1(valid), {
    schemaVersion: "cm.ccp-semantic-effect/v1",
    tenantId: identity.tenantId,
    repositoryId: identity.repositoryId,
    contributionId: identity.contributionId,
    headDigest: digest("a"),
    effectKind: "HEAD_RECONCILED",
  });
});

test("CCP-PSAI52-INT-002 append is pure, causal and idempotent", () => {
  const initial = createCcpIntakeLedgerV1(identity);
  const input = fixture("valid-delivery");
  const inputSnapshot = JSON.stringify(input);
  const initialBytes = stateBytes(initial);

  const first = appendCcpIntakeDeliveryV1(initial, input);
  assert.equal(first.appended, true);
  assert.equal(first.effectApplied, true);
  assert.equal(first.receipt.disposition, "ADMITTED");
  assert.equal(first.receipt.causalSequence, 1);
  assert.equal(first.receipt.causalParentSequence, null);
  assert.equal(first.receipt.effectSequence, 1);
  assert.equal(first.receipt.receiptDigest, VALID_RECEIPT_DIGEST);
  assert.equal(first.ledger.entries.length, 1);
  assert.equal(first.ledger.semanticEffects.length, 1);
  assert.equal(JSON.stringify(input), inputSnapshot);
  assert.equal(stateBytes(initial), initialBytes);
  assert.equal(Object.isFrozen(first.receipt), true);
  assert.equal(Object.isFrozen(first.ledger), true);
  const parsedReceipt = parseCcpDeliveryReceiptV1(first.receipt);
  assert.equal(Object.isFrozen(parsedReceipt), true);
  assert.equal(Object.isFrozen(parsedReceipt.event), true);
  assert.equal(Object.isFrozen(parsedReceipt.deliveryKey), true);
  assert.equal(Object.isFrozen(parsedReceipt.semanticEffectKey), true);

  const replay = appendCcpIntakeDeliveryV1(first.ledger, fixture("replayed-delivery"));
  assert.equal(replay.appended, false);
  assert.equal(replay.effectApplied, false);
  assert.equal(replay.receipt.disposition, "TRANSPORT_DUPLICATE");
  assert.equal(replay.receipt.causalSequence, 1);
  assert.equal(replay.receipt.receiptDigest, REPLAY_RECEIPT_DIGEST);
  assert.equal(replay.receipt.receiptDigest, appendCcpIntakeDeliveryV1(
    first.ledger,
    fixture("replayed-delivery"),
  ).receipt.receiptDigest);
  assert.equal(stateBytes(replay.ledger), stateBytes(first.ledger));
  assert.equal(canonicalCcpDeliveryReceiptJsonV1(replay.receipt), canonicalCcpDeliveryReceiptJsonV1(
    appendCcpIntakeDeliveryV1(first.ledger, fixture("replayed-delivery")).receipt,
  ));
});

test("CCP-PSAI52-INT-003 semantic key deduplicates effects while causal sequence remains lossless", () => {
  const first = appendCcpIntakeDeliveryV1(
    createCcpIntakeLedgerV1(identity),
    event(),
  );
  const second = appendCcpIntakeDeliveryV1(first.ledger, event({
    deliveryId: "delivery:synthetic-0002",
    logicalAtMs: 20,
    ancestorDigest: digest("a"),
  }));
  assert.equal(second.receipt.disposition, "SEMANTIC_DUPLICATE");
  assert.equal(second.receipt.reasonCode, "HEAD_ALREADY_CURRENT");
  assert.equal(second.receipt.causalSequence, 2);
  assert.equal(second.receipt.effectSequence, null);
  assert.equal(second.ledger.entries.length, 2);
  assert.equal(second.ledger.semanticEffects.length, 1);
  assert.equal(second.ledger.entries[1]?.previousEntryDigest, first.ledger.entries[0]?.entryDigest);

  const third = appendCcpIntakeDeliveryV1(second.ledger, event({
    deliveryId: "delivery:synthetic-0003",
    headDigest: digest("c"),
    payloadDigest: digest("d"),
    ancestorDigest: digest("a"),
    logicalAtMs: 30,
  }));
  assert.equal(third.receipt.disposition, "ADMITTED");
  assert.equal(third.receipt.causalSequence, 3);
  assert.equal(third.receipt.causalParentSequence, 1);
  assert.equal(third.receipt.effectSequence, 2);
  assert.equal(third.ledger.semanticEffects.length, 2);
  assert.equal(readCcpIntakeProjectionV1(third.ledger).currentHeadDigest, digest("c"));
  assert.deepEqual(readCcpIntakeProjectionV1(third.ledger).semanticEffectIds, third.ledger.semanticEffects.map(
    (effect) => effect.semanticEffectId,
  ));
  assert.ok(verifyCcpIntakeLedgerV1(third.ledger));
});

test("CCP-PSAI52-INT-004 delivery-id reuse and causal faults fail closed without effects", () => {
  const first = appendCcpIntakeDeliveryV1(createCcpIntakeLedgerV1(identity), event());
  const reused = appendCcpIntakeDeliveryV1(first.ledger, event({
    payloadDigest: digest("e"),
    logicalAtMs: 20,
  }));
  assert.equal(reused.receipt.disposition, "QUARANTINED");
  assert.equal(reused.receipt.reasonCode, "DELIVERY_ID_REUSE");
  assert.equal(reused.effectApplied, false);
  assert.equal(reused.ledger.semanticEffects.length, 1);

  const unknownAncestor = appendCcpIntakeDeliveryV1(reused.ledger, event({
    deliveryId: "delivery:synthetic-0004",
    headDigest: digest("f"),
    payloadDigest: digest("c"),
    ancestorDigest: digest("9"),
    logicalAtMs: 30,
  }));
  assert.equal(unknownAncestor.receipt.reasonCode, "UNKNOWN_ANCESTOR");
  assert.equal(unknownAncestor.receipt.disposition, "QUARANTINED");
  assert.equal(unknownAncestor.effectApplied, false);

  const foreign = appendCcpIntakeDeliveryV1(unknownAncestor.ledger, event({
    deliveryId: "delivery:synthetic-0005",
    tenantId: "tenant:foreign",
    headDigest: digest("1"),
    payloadDigest: digest("2"),
    logicalAtMs: 40,
  }));
  assert.equal(foreign.receipt.reasonCode, "IDENTITY_MISMATCH");
  assert.equal(foreign.receipt.disposition, "QUARANTINED");
  assert.equal(foreign.ledger.semanticEffects.length, 1);
  assert.deepEqual(readCcpIntakeProjectionV1(foreign.ledger).quarantinedDeliveryIds, [
    "delivery:synthetic-0001",
    "delivery:synthetic-0004",
    "delivery:synthetic-0005",
  ]);
});

test("CCP-PSAI52-INT-005 malformed delivery is denied before any ledger append", () => {
  const ledger = createCcpIntakeLedgerV1(identity);
  assert.throws(
    () => appendCcpIntakeDeliveryV1(ledger, fixture("malformed-delivery")),
    /CCP_EVENT_ENVELOPE_SCHEMA_DENIED/,
  );
  assert.equal(ledger.schemaVersion, CCP_INTAKE_LEDGER_SCHEMA_V1);
  assert.equal(ledger.entries.length, 0);
  assert.equal(readCcpIntakeProjectionV1(ledger).causalSequence, 0);
});

test("CCP-PSAI52-INT-006 rehashed impossible semantic history is denied on read-back", () => {
  const result = appendCcpIntakeDeliveryV1(createCcpIntakeLedgerV1(identity), event());
  const forged = structuredClone(result.ledger) as unknown as Record<string, any>;
  forged.entries[0].receipt.disposition = "SEMANTIC_DUPLICATE";
  forged.entries[0].receipt.reasonCode = "HEAD_ALREADY_CURRENT";
  forged.entries[0].receipt.effectSequence = null;
  forged.entries[0].semanticEffectId = null;
  forged.semanticEffects = [];
  rehashReceipt(forged.entries[0].receipt);
  rehashEntry(forged.entries[0]);
  rehashLedger(forged);
  assert.doesNotThrow(() => canonicalCcpDeliveryReceiptJsonV1(forged.entries[0].receipt));
  assert.equal(verifyCcpIntakeLedgerV1(forged), null);
});

test("CCP-PSAI52-INT-007 receipt semantic identity cannot diverge from canonical event bytes", () => {
  const result = appendCcpIntakeDeliveryV1(createCcpIntakeLedgerV1(identity), event());
  const forged = structuredClone(result.receipt) as unknown as Record<string, any>;
  forged.semanticEffectKey.tenantId = "tenant:foreign";
  forged.semanticEffectId = ccpDigestDomainV1("cm.ccp-semantic-effect/v1", forged.semanticEffectKey);
  rehashReceipt(forged);
  assert.throws(() => canonicalCcpDeliveryReceiptJsonV1(forged), /CCP_INTAKE_RECEIPT_DENIED/);
});
