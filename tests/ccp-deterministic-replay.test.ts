import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  canonicalCcpDeterministicReplayReceiptJsonV1,
  ccpDeterministicReplayReceiptDigestV1,
  parseCcpDeterministicReplayReceiptV1,
  replayCcpSyntheticProfileV1,
  verifyCcpDeterministicReplayReceiptV1,
} from "../packages/contracts/src/ccp-deterministic-replay.js";
import { CCP_SYNTHETIC_EVENT_RATES_V1 } from "../packages/contracts/src/ccp-profile-generator.js";

const fixture = (rate: number): unknown => JSON.parse(
  readFileSync(`tests/fixtures/ccp-profiles/${rate}-event-hour.json`, "utf8"),
);

test("CCP-PSAI52-REPLAY-001 receipt is bounded, digest-bound and timing-free", () => {
  const receipts = CCP_SYNTHETIC_EVENT_RATES_V1.map((rate) => replayCcpSyntheticProfileV1(fixture(rate)));
  assert.deepEqual(receipts.map((receipt) => receipt.eventsPerHour), [10, 50, 100, 1_000, 10_000]);
  for (const receipt of receipts) {
    assert.equal(receipt.schemaVersion, "cm.ccp-deterministic-replay/v1");
    assert.equal(receipt.taskId, "QWEN-PSAI52-PROFILE-REPLAY-08");
    assert.equal(receipt.inputCanonicalBytesDigest.length, 64);
    assert.equal(receipt.replayCanonicalBytesDigest.length, 64);
    assert.equal(receipt.ledgerDigest.length, 64);
    assert.equal(receipt.supersessionDigest.length, 64);
    assert.equal(receipt.receiptDigest, ccpDeterministicReplayReceiptDigestV1(receipt));
    assert.equal(parseCcpDeterministicReplayReceiptV1(receipt).receiptDigest, receipt.receiptDigest);
    assert.equal(Object.isFrozen(receipt), true);
    assert.equal(Object.isFrozen(receipt.expectedCoverage), true);
    assert.equal(Object.isFrozen(receipt.replayCoverage), true);
  }
});

test("CCP-PSAI52-REPLAY-002 canonical receipt bytes are key-order independent", () => {
  const receipt = replayCcpSyntheticProfileV1(fixture(100));
  const reordered = Object.fromEntries(Object.entries(receipt).reverse());
  assert.equal(
    canonicalCcpDeterministicReplayReceiptJsonV1(reordered),
    canonicalCcpDeterministicReplayReceiptJsonV1(receipt),
  );
  assert.equal(verifyCcpDeterministicReplayReceiptV1(reordered)?.receiptDigest, receipt.receiptDigest);
});

test("CCP-PSAI52-REPLAY-003 rehashed drift cannot manufacture a successful oracle receipt", () => {
  const receipt = replayCcpSyntheticProfileV1(fixture(50));
  const forged = structuredClone(receipt) as unknown as Record<string, unknown>;
  (forged.replayCoverage as unknown as Record<string, unknown>).quarantinedCount = 0;
  assert.equal(verifyCcpDeterministicReplayReceiptV1(forged), null);
  assert.throws(
    () => parseCcpDeterministicReplayReceiptV1(forged),
    /CCP_DETERMINISTIC_REPLAY_SCHEMA_DENIED/,
  );

  const authorityForge = structuredClone(receipt) as unknown as Record<string, unknown>;
  authorityForge.mergeAuthorized = true;
  assert.equal(verifyCcpDeterministicReplayReceiptV1(authorityForge), null);
});
