import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  canonicalCcpRunnerCleanupReceiptJsonV1,
  evaluateCcpRunnerCleanupV1,
  issueCcpRunnerCleanupReceiptV1,
  parseCcpRunnerCleanupReceiptV1,
  verifyCcpRunnerCleanupReceiptV1,
} from "../packages/contracts/src/ccp-runner-cleanup.js";

interface CleanupFixture {
  cleanup: { request: unknown; observation: unknown };
}

const fixture = (name: "isolated-success" | "crash"): CleanupFixture => JSON.parse(
  readFileSync(`tests/fixtures/ccp-runner/${name}.json`, "utf8"),
);

test("CCP-PSAI52-RUNNER-007 cleanup receipts are mandatory and prove zero residue", () => {
  const input = fixture("isolated-success");
  const first = issueCcpRunnerCleanupReceiptV1(input.cleanup.request, input.cleanup.observation);
  const second = evaluateCcpRunnerCleanupV1(
    JSON.parse(JSON.stringify(input.cleanup.request)),
    JSON.parse(JSON.stringify(input.cleanup.observation)),
  );

  assert.equal(canonicalCcpRunnerCleanupReceiptJsonV1(first), canonicalCcpRunnerCleanupReceiptJsonV1(second));
  assert.equal(first.outcome, "ZERO_RESIDUE");
  assert.equal(first.transition, "CLEANUP_CONFIRMED");
  assert.equal(first.reasonCode, "ZERO_RESIDUE_AFTER_COMPLETION");
  assert.equal(first.remainingResourceCount, 0);
  assert.equal(first.zeroResidue, true);
  assert.equal(first.cleanupRequired, true);
  assert.equal(first.runnerReleased, true);
  assert.equal(first.executionAuthorized, false);
  assert.equal(first.mergeAuthorized, false);
  assert.equal(Object.isFrozen(first), true);
  assert.equal(Object.isFrozen(first.observation), true);
  assert.notEqual(verifyCcpRunnerCleanupReceiptV1(first), null);
});

test("CCP-PSAI52-RUNNER-008 crash cleanup still requires and can confirm release", () => {
  const input = fixture("crash");
  const receipt = issueCcpRunnerCleanupReceiptV1(input.cleanup.request, input.cleanup.observation);
  assert.equal(receipt.request.termination, "CRASHED");
  assert.equal(receipt.outcome, "ZERO_RESIDUE");
  assert.equal(receipt.reasonCode, "ZERO_RESIDUE_AFTER_CRASH");
  assert.equal(receipt.cleanupRequired, true);
  assert.equal(receipt.runnerReleased, true);
});

test("CCP-PSAI52-RUNNER-009 residue, omitted cleanup and forged release receipts fail closed", () => {
  const input = fixture("isolated-success");
  const observation = JSON.parse(JSON.stringify(input.cleanup.observation)) as Record<string, unknown>;
  observation.remainingResourceRefs = ["resource:runner-root"];
  const residue = issueCcpRunnerCleanupReceiptV1(input.cleanup.request, observation);
  assert.equal(residue.outcome, "RESIDUE_DETECTED");
  assert.equal(residue.transition, "CLEANUP_FAILED");
  assert.equal(residue.reasonCode, "RESIDUE_REMAINS");
  assert.equal(residue.zeroResidue, false);
  assert.equal(residue.runnerReleased, false);
  assert.equal(residue.mergeAuthorized, false);

  const omitted = issueCcpRunnerCleanupReceiptV1(input.cleanup.request, {
    ...(input.cleanup.observation as Record<string, unknown>),
    cleanupAttempted: false,
  });
  assert.equal(omitted.reasonCode, "CLEANUP_NOT_ATTEMPTED");
  assert.equal(omitted.cleanupRequired, true);
  assert.notEqual(verifyCcpRunnerCleanupReceiptV1(omitted), null);

  assert.throws(
    () => issueCcpRunnerCleanupReceiptV1(input.cleanup.request, {
      ...(input.cleanup.observation as Record<string, unknown>),
      leaseId: "lease:eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee",
    }),
    /CCP_RUNNER_CLEANUP_OBSERVATION_SCHEMA_DENIED/,
  );
  assert.throws(() => parseCcpRunnerCleanupReceiptV1({}), /CCP_RUNNER_CLEANUP_RECEIPT_SCHEMA_DENIED/);
});
