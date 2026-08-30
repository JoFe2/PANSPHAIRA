import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import {
  ASF_SYNTHETIC_LIFECYCLE_CRITERION_RECEIPT_MATRIX_V1,
  ASF_SYNTHETIC_LIFECYCLE_FIXTURES_V1,
  asfSyntheticDigestV1,
  createAsfSyntheticBundleLockV1,
  renderPublicAsfSyntheticLifecycleV1,
  runAsfSyntheticLifecycleV1,
  validateAsfSyntheticBundleLockV1,
} from "../packages/contracts/src/asf-synthetic-lifecycle-harness.js";

test("pinned lifecycle is deterministic and content addressed", () => {
  const first = runAsfSyntheticLifecycleV1();
  const second = runAsfSyntheticLifecycleV1();
  assert.equal(first.receiptJson, second.receiptJson);
  assert.equal(first.receiptDigest, second.receiptDigest);
  assert.equal(first.outcome, "ACCEPTED");
  assert.equal(first.effects.installationApplied, true);
  assert.equal(first.effects.activationApplied, true);
  assert.equal(first.after.installed[0]?.state, "installed_inactive");
  assert.equal(first.after.active[0]?.state, "ACTIVE");
  assert.match(String(first.receipts.generation?.generationDigest ?? ""), /^[a-f0-9]{64}$/);
  assert.notEqual(first.receipts.generation?.receiptDigest, first.receipts.bundleLock?.receiptDigest);
  for (const item of Object.values(first.receipts)) {
    const { receiptDigest, ...unsigned } = item;
    assert.equal(asfSyntheticDigestV1(unsigned), receiptDigest);
  }
  assert.equal(first.receipts.public?.lifecycleReceiptDigest, first.receiptDigest);
});

test("rollback restores the exact LKG and preserves unrelated state", () => {
  const result = runAsfSyntheticLifecycleV1({ scenario: "rollback" });
  assert.equal(result.outcome, "ACCEPTED");
  assert.equal(result.effects.rollbackApplied, true);
  assert.equal(result.after.active[0]?.generationDigest, result.before.active[0]?.generationDigest);
  assert.equal(result.after.active[1]?.generationDigest, result.before.active[1]?.generationDigest);
  assert.deepEqual(result.after.active[1], result.before.active[1]);
  assert.equal(result.receipts.rollback?.exactLkg, true);
});

test("all mandatory negative probes fail closed without state mutation", () => {
  const faults = [
    "tampered-lock",
    "blocked-analysis",
    "missing-explicit-activation",
    "skipped-ring",
    "incompatible-tuple",
    "self-authority",
    "missing-lkg",
    "residue",
  ] as const;
  for (const fault of faults) {
    const result = runAsfSyntheticLifecycleV1({ fault });
    assert.equal(result.outcome, "DENIED", fault);
    assert.deepEqual(result.after, result.before, fault);
    assert.equal(result.effects.installationApplied, false, fault);
    assert.equal(result.effects.activationApplied, false, fault);
    assert.equal(result.receipts.negativeProbe?.noSideEffect, true, fault);
  }
});

test("authority, identity, evidence, reconciliation, and public-readback faults deny without reuse", () => {
  const faults = [
    "missing-authority",
    "self-authority",
    "authority-widening",
    "stale-identity",
    "replayed-identity",
    "mismatched-identity",
    "stale-digest",
    "replayed-receipt",
    "mismatched-receipt",
    "stale-evidence",
    "mismatched-evidence",
    "stale-state",
    "invalid-rollback",
    "invalid-lkg",
    "budget-drift",
    "residue",
    "unbound-receipt",
    "unsafe-public-readback",
  ] as const;
  for (const fault of faults) {
    const result = runAsfSyntheticLifecycleV1({ fault });
    assert.equal(result.outcome, "DENIED", fault);
    assert.deepEqual(result.after, result.before, fault);
    assert.equal(result.effects.activationApplied, false, fault);
    assert.equal(result.effects.installationApplied, false, fault);
    assert.equal(result.effects.rollbackApplied, false, fault);
  }

  const redacted = runAsfSyntheticLifecycleV1({ fault: "unbound-receipt" });
  assert.equal(redacted.receipts.negativeProbe?.redacted, true);
  assert.equal("generation" in redacted.receipts, false);
  assert.equal("analysis" in redacted.receipts, false);
  const publicReceipt = renderPublicAsfSyntheticLifecycleV1(redacted);
  assert.deepEqual(Object.keys(publicReceipt.receipts), ["gate", "negativeProbe", "public"]);
});

test("canonical immutable capability-pack bundle locks are deterministic and reject tampering", () => {
  const first = createAsfSyntheticBundleLockV1();
  const second = createAsfSyntheticBundleLockV1();
  assert.deepEqual(second, first);
  assert.equal(validateAsfSyntheticBundleLockV1(first), true);
  assert.match(first.bundle.bundleDigest, /^[a-f0-9]{64}$/);
  assert.match(first.lock.lockIdentity, /^[a-f0-9]{64}$/);
  assert.match(first.bundle.capabilityPack.packDigest, /^[a-f0-9]{64}$/);

  const tampered = structuredClone(first);
  (tampered as { lock: { lockIdentity: string } }).lock.lockIdentity = "0".repeat(64);
  assert.equal(validateAsfSyntheticBundleLockV1(tampered), false);
});

test("public reproduction contains only stable receipt references", () => {
  const result = runAsfSyntheticLifecycleV1();
  const publicReceipt = renderPublicAsfSyntheticLifecycleV1(result);
  assert.equal(publicReceipt.outcome, "ACCEPTED");
  assert.equal(Object.values(publicReceipt.receipts).every((value) => /^[a-f0-9]{64}$/.test(value)), true);
  assert.equal(JSON.stringify(publicReceipt).includes("/mnt/"), false);
  assert.deepEqual(ASF_SYNTHETIC_LIFECYCLE_FIXTURES_V1.success, result);
});

test("checked-in receipts reproduce the pinned scenarios", () => {
  const fixture = (name: string) => JSON.parse(readFileSync(join(process.cwd(), "tests", "fixtures", "asf-synthetic-lifecycle", name), "utf8")) as unknown;
  assert.deepEqual(fixture("success.json"), runAsfSyntheticLifecycleV1());
  assert.deepEqual(fixture("denied-activation.json"), runAsfSyntheticLifecycleV1({ fault: "missing-explicit-activation" }));
  assert.deepEqual(fixture("rollback.json"), runAsfSyntheticLifecycleV1({ scenario: "rollback" }));
  assert.deepEqual(fixture("incompatible.json"), runAsfSyntheticLifecycleV1({ fault: "incompatible-tuple" }));
});

test("criterion matrix names evidence-bearing receipts", () => {
  const matrix = ASF_SYNTHETIC_LIFECYCLE_CRITERION_RECEIPT_MATRIX_V1;
  assert.equal(matrix.deterministicGeneration.includes("generation"), true);
  assert.equal(matrix.provenanceQualityRisk.includes("analysis"), true);
  assert.equal(matrix.rollbackReadback.includes("rollback"), true);
  assert.equal(matrix.negativeFailClosed.includes("negativeProbe"), true);
  assert.equal(matrix.exactGenerationLockEvidence.includes("bundleLock"), true);
  assert.equal(matrix.plannedVersusImplementedReadback.includes("public"), true);
  assert.equal(matrix.noUnsupportedPublicClaims.includes("public"), true);
});