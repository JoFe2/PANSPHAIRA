import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  canonicalCcpFaultRecoveryReceiptJsonV1,
  composeCcpFaultRecoveryV1,
  parseCcpFaultRecoveryReceiptV1,
  verifyCcpFaultRecoveryReceiptV1,
  type CcpFaultRecoveryInputV1,
} from "../packages/contracts/src/ccp-fault-recovery.js";

const names = ["runner-failure", "queue-failure", "api-failure", "promotion-failure"] as const;
type FixtureName = (typeof names)[number];

const fixture = (name: FixtureName): CcpFaultRecoveryInputV1 => JSON.parse(
  readFileSync(`tests/fixtures/ccp-recovery/${name}.json`, "utf8"),
) as CcpFaultRecoveryInputV1;

const expectedTransitions = {
  "runner-failure": "RUNNER_ABORTED_CLEANUP_CONFIRMED",
  "queue-failure": "QUEUE_REQUEUED_NO_EXECUTION_AUTHORITY",
  "api-failure": "API_ABORTED_NO_EXTERNAL_RETRY",
  "promotion-failure": "PROMOTION_FAILURE_EXACT_LKG_RESTORE",
} as const;

test("CCP-PSAI52-RECOVERY-001 all four injected faults compose into deterministic receipts", () => {
  for (const name of names) {
    const input = fixture(name);
    const first = composeCcpFaultRecoveryV1(input);
    const second = composeCcpFaultRecoveryV1(structuredClone(input));

    assert.equal(canonicalCcpFaultRecoveryReceiptJsonV1(first), canonicalCcpFaultRecoveryReceiptJsonV1(second));
    assert.equal(first.faultInjected, true);
    assert.equal(first.disposition, "RECOVERY_CONFIRMED");
    assert.equal(first.transition, expectedTransitions[name]);
    assert.equal(first.recoveryEvidenceComplete, true);
    assert.equal(first.cleanupRequired, true);
    assert.equal(first.zeroResidue, true);
    assert.equal(first.runnerReleased, true);
    assert.equal(first.sloMetrics.attempts, 1);
    assert.equal(first.sloMetrics.recovered, 1);
    assert.equal(first.sloMetrics.failed, 0);
    assert.equal(first.sloMetrics.recoveryRateBps, 10000);
    assert.equal(first.sloMetrics.met, true);
    assert.equal(Object.isFrozen(first), true);
    assert.equal(Object.isFrozen(first.cleanupReceipt), true);
    assert.notEqual(verifyCcpFaultRecoveryReceiptV1(first), null);
    assert.equal(parseCcpFaultRecoveryReceiptV1(first).receiptDigest, first.receiptDigest);
  }
});

test("CCP-PSAI52-RECOVERY-002 recovery keeps every authorization boundary closed", () => {
  for (const name of names) {
    const receipt = composeCcpFaultRecoveryV1(fixture(name));
    assert.deepEqual(receipt.authorization, {
      verificationClaimed: false,
      verificationAuthorized: false,
      executionAuthorized: false,
      promotionAuthorized: false,
      mergeAuthorized: false,
    });
    assert.equal(receipt.cleanupReceipt.executionAuthorized, false);
    assert.equal(receipt.cleanupReceipt.mergeAuthorized, false);
  }
});

test("CCP-PSAI52-RECOVERY-003 promotion recovery restores the exact pre-promotion LKG", () => {
  const receipt = composeCcpFaultRecoveryV1(fixture("promotion-failure"));
  assert.equal(receipt.lkgBehavior, "EXACT_PRE_PROMOTION_RESTORED");
  assert.equal(receipt.lkgReadback.beforeState.lkgDigest, "c".repeat(64));
  assert.equal(receipt.lkgReadback.afterState.lkgDigest, "b".repeat(64));
  assert.equal(receipt.lkgReadback.expectedAfterLkgDigest, "b".repeat(64));
  assert.equal(receipt.lkgReadback.afterState.generation, 3);
  assert.equal(receipt.lkgReadback.transitionDigest, "1e0724441db89f852c9a9adb8c36ba281f505437a7cc76c255b738c302a8a9f4");
});

test("CCP-PSAI52-RECOVERY-004 incomplete cleanup or SLO evidence blocks recovery", () => {
  const base = fixture("runner-failure");
  const residue = structuredClone(base) as unknown as Record<string, unknown>;
  const cleanup = residue.cleanup as Record<string, unknown>;
  const observation = cleanup.observation as Record<string, unknown>;
  observation.remainingResourceRefs = ["resource:runner-temp"];
  const blockedCleanup = composeCcpFaultRecoveryV1(residue);
  assert.equal(blockedCleanup.disposition, "RECOVERY_BLOCKED");
  assert.equal(blockedCleanup.transition, "RECOVERY_BLOCKED_EVIDENCE_INCOMPLETE");
  assert.equal(blockedCleanup.recoveryEvidenceComplete, false);
  assert.equal(blockedCleanup.zeroResidue, false);
  assert.equal(blockedCleanup.runnerReleased, false);
  assert.equal(blockedCleanup.authorization.mergeAuthorized, false);

  const missedSlo = structuredClone(base) as unknown as Record<string, unknown>;
  const slo = missedSlo.sloObservation as Record<string, unknown>;
  slo.recovered = 0;
  slo.failed = 1;
  const blockedSlo = composeCcpFaultRecoveryV1(missedSlo);
  assert.equal(blockedSlo.disposition, "RECOVERY_BLOCKED");
  assert.equal(blockedSlo.sloMetrics.met, false);
  assert.equal(blockedSlo.authorization.verificationClaimed, false);
});

test("CCP-PSAI52-RECOVERY-005 forged success and forged LKG readback deny fail-closed", () => {
  const receipt = composeCcpFaultRecoveryV1(fixture("api-failure"));
  const forged = structuredClone(receipt) as unknown as Record<string, unknown>;
  const authorization = forged.authorization as Record<string, unknown>;
  authorization.mergeAuthorized = true;
  assert.equal(verifyCcpFaultRecoveryReceiptV1(forged), null);
  assert.throws(() => parseCcpFaultRecoveryReceiptV1(forged), /CCP_FAULT_RECOVERY_RECEIPT_SCHEMA_DENIED/);

  const badLkg = structuredClone(fixture("promotion-failure")) as unknown as Record<string, unknown>;
  const lkg = badLkg.lkgReadback as Record<string, unknown>;
  lkg.expectedAfterLkgDigest = "e".repeat(64);
  assert.throws(() => composeCcpFaultRecoveryV1(badLkg), /CCP_LKG_RECOVERY_READBACK_SCHEMA_DENIED/);
});
