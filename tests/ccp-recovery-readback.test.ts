import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { composeCcpFaultRecoveryV1 } from "../packages/contracts/src/ccp-fault-recovery.js";
import {
  canonicalCcpRecoveryReadbackJsonV1,
  issueCcpRecoveryReadbackReceiptV1,
  parseCcpRecoveryReadbackReceiptV1,
  verifyCcpRecoveryReadbackReceiptV1,
} from "../packages/contracts/src/ccp-recovery-readback.js";

const names = ["runner-failure", "queue-failure", "api-failure", "promotion-failure"] as const;
const fixture = (name: (typeof names)[number]): unknown => JSON.parse(
  readFileSync(`tests/fixtures/ccp-recovery/${name}.json`, "utf8"),
);

test("CCP-PSAI52-READBACK-001 readback exposes canonical cleanup, metrics and LKG evidence", () => {
  for (const name of names) {
    const recoveryReceipt = composeCcpFaultRecoveryV1(fixture(name));
    const input = {
      schemaVersion: "cm.ccp-recovery-readback-input/v1",
      taskId: "QWEN-PSAI52-FAILURE-RECOVERY-09",
      recoveryReceipt,
      logicalAtMs: recoveryReceipt.logicalAtMs + 1,
    };
    const first = issueCcpRecoveryReadbackReceiptV1(input);
    const second = issueCcpRecoveryReadbackReceiptV1(structuredClone(input));

    assert.equal(canonicalCcpRecoveryReadbackJsonV1(first), canonicalCcpRecoveryReadbackJsonV1(second));
    assert.equal(first.recoveryReceiptDigest, recoveryReceipt.receiptDigest);
    assert.equal(first.recoveryDisposition, "RECOVERY_CONFIRMED");
    assert.equal(first.readbackDisposition, "READBACK_CONFIRMED");
    assert.equal(first.cleanup.cleanupRequired, true);
    assert.equal(first.cleanup.zeroResidue, true);
    assert.equal(first.cleanup.runnerReleased, true);
    assert.equal(first.slo.attempts, 1);
    assert.equal(first.slo.recovered, 1);
    assert.equal(first.slo.failed, 0);
    assert.equal(first.slo.recoveryRateBps, 10000);
    assert.equal(first.slo.met, true);
    assert.equal(first.lkg.exact, true);
    assert.equal(first.verificationClaimed, false);
    assert.equal(first.executionAuthorized, false);
    assert.equal(first.promotionAuthorized, false);
    assert.equal(first.mergeAuthorized, false);
    assert.equal(Object.isFrozen(first), true);
    assert.notEqual(verifyCcpRecoveryReadbackReceiptV1(first), null);
    assert.equal(parseCcpRecoveryReadbackReceiptV1(first).readbackDigest, first.readbackDigest);
  }
});

test("CCP-PSAI52-READBACK-002 blocked recovery remains blocked on readback", () => {
  const input = structuredClone(fixture("runner-failure")) as Record<string, unknown>;
  const cleanup = input.cleanup as Record<string, unknown>;
  const observation = cleanup.observation as Record<string, unknown>;
  observation.cleanupAttempted = false;
  const recoveryReceipt = composeCcpFaultRecoveryV1(input);
  assert.equal(recoveryReceipt.disposition, "RECOVERY_BLOCKED");

  const readback = issueCcpRecoveryReadbackReceiptV1({
    schemaVersion: "cm.ccp-recovery-readback-input/v1",
    taskId: "QWEN-PSAI52-FAILURE-RECOVERY-09",
    recoveryReceipt,
    logicalAtMs: 2301,
  });
  assert.equal(readback.recoveryDisposition, "RECOVERY_BLOCKED");
  assert.equal(readback.readbackDisposition, "READBACK_BLOCKED");
  assert.equal(readback.cleanup.zeroResidue, false);
  assert.equal(readback.cleanup.runnerReleased, false);
  assert.equal(readback.verificationClaimed, false);
  assert.equal(readback.mergeAuthorized, false);
});

test("CCP-PSAI52-READBACK-003 tampered readback evidence and authority claims deny", () => {
  const recoveryReceipt = composeCcpFaultRecoveryV1(fixture("promotion-failure"));
  const readback = issueCcpRecoveryReadbackReceiptV1({
    schemaVersion: "cm.ccp-recovery-readback-input/v1",
    taskId: "QWEN-PSAI52-FAILURE-RECOVERY-09",
    recoveryReceipt,
    logicalAtMs: 5401,
  });

  const forged = structuredClone(readback) as unknown as Record<string, unknown>;
  const lkg = forged.lkg as Record<string, unknown>;
  lkg.afterLkgDigest = "e".repeat(64);
  assert.equal(verifyCcpRecoveryReadbackReceiptV1(forged), null);
  assert.throws(
    () => parseCcpRecoveryReadbackReceiptV1(forged),
    /CCP_RECOVERY_READBACK_SCHEMA_DENIED/,
  );

  const authorityForge = structuredClone(readback) as unknown as Record<string, unknown>;
  authorityForge.mergeAuthorized = true;
  assert.equal(verifyCcpRecoveryReadbackReceiptV1(authorityForge), null);
});
