import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  UPDATE_SYNTHETIC_APPLY_HARNESS_ACTOR_BINDINGS_V1,
  UPDATE_SYNTHETIC_APPLY_HARNESS_RECEIPT_SCHEMA_V1,
  UPDATE_SYNTHETIC_APPLY_HARNESS_RETRY_ORDINAL_V1,
  UPDATE_SYNTHETIC_APPLY_HARNESS_SOURCE_TUPLE_DIGEST_V1,
  UPDATE_SYNTHETIC_APPLY_HARNESS_TARGET_TUPLE_DIGEST_V1,
  UPDATE_SYNTHETIC_APPLY_HARNESS_TARGET_TUPLE_V1,
  compareAndSwapUpdateSyntheticApplyPointerV1,
  parseUpdateSyntheticApplyHarnessReceiptV1,
  renderVerifiedUpdateSyntheticApplyHarnessReceiptV1,
  runUpdateSyntheticApplyHarnessV1,
  updateSyntheticApplyHarnessReceiptDigestV1,
  verifyUpdateSyntheticApplyHarnessReceiptV1,
  type UpdateSyntheticApplyHarnessReceiptV1,
} from "../packages/contracts/src/update-synthetic-apply-harness.js";

function fixture(name: string): UpdateSyntheticApplyHarnessReceiptV1 {
  return JSON.parse(readFileSync(`tests/fixtures/update-synthetic-apply/${name}.json`, "utf8")) as UpdateSyntheticApplyHarnessReceiptV1;
}

function verifyFixture(name: string): UpdateSyntheticApplyHarnessReceiptV1 {
  const value = fixture(name);
  assert.deepEqual(verifyUpdateSyntheticApplyHarnessReceiptV1(value), {
    outcome: "VERIFIED",
    reasonCodes: ["SYNTHETIC_APPLY_RECEIPT_VERIFIED"],
    exitCode: 0,
  });
  assert.deepEqual(JSON.parse(renderVerifiedUpdateSyntheticApplyHarnessReceiptV1(value)), value);
  assert.equal(updateSyntheticApplyHarnessReceiptDigestV1(value), value.receiptDigest);
  return value;
}

test("pins and verifies the exact Core/Pack/Adapter/Policy/Schema/Generation tuple", () => {
  assert.deepEqual(Object.keys(UPDATE_SYNTHETIC_APPLY_HARNESS_TARGET_TUPLE_V1), [
    "core", "packs", "adapters", "policies", "schemas", "generations",
  ]);
  assert.equal(
    UPDATE_SYNTHETIC_APPLY_HARNESS_TARGET_TUPLE_DIGEST_V1,
    "8f873e2a8c3dd819a2bcc68b4865c9e6f60f40fb1d20823054829e5758375088",
  );
  assert.equal(UPDATE_SYNTHETIC_APPLY_HARNESS_SOURCE_TUPLE_DIGEST_V1.length, 64);
  assert.deepEqual(verifyFixture("success"), runUpdateSyntheticApplyHarnessV1());
});

test("success switches the owned pointer only after independent postcondition readback", () => {
  const receipt = verifyFixture("success");
  assert.equal(receipt.schemaVersion, UPDATE_SYNTHETIC_APPLY_HARNESS_RECEIPT_SCHEMA_V1);
  assert.equal(receipt.outcome, "APPLIED");
  assert.equal(receipt.readOnly, false);
  assert.equal(receipt.finalPointer.activeTupleDigest, UPDATE_SYNTHETIC_APPLY_HARNESS_TARGET_TUPLE_DIGEST_V1);
  assert.equal(receipt.finalPointer.revision, 2);
  assert.equal(receipt.residueCount, 0);
  assert.equal(receipt.contractChecks.promotionGate, "VERIFIED");
  assert.equal(receipt.contractChecks.postcondition, "ACCEPT_SWITCH");
  assert.equal(receipt.contractChecks.rollbackReadback, "NOT_APPLICABLE");
});

test("partial migration and failed postcondition restore the exact unrevoked LKG with zero residue", () => {
  const expected = verifyFixture("failed-postcondition");
  for (const actual of [
    expected,
    runUpdateSyntheticApplyHarnessV1({ failure: "PARTIAL_MIGRATION" }),
  ]) {
    assert.equal(actual.outcome, "ROLLED_BACK_ZERO_RESIDUE");
    assert.equal(actual.finalPointer.activeSnapshotId, "lkg:synthetic-001");
    assert.equal(actual.finalPointer.activeTupleDigest, UPDATE_SYNTHETIC_APPLY_HARNESS_SOURCE_TUPLE_DIGEST_V1);
    assert.equal(actual.finalPointer.revision, 3);
    assert.equal(actual.finalOwnerStateDigest, actual.initialOwnerStateDigest);
    assert.equal(actual.residueCount, 0);
    assert.equal(actual.lkgState, "COMPLETE");
    assert.equal(actual.lkgRevoked, false);
    assert.equal(actual.contractChecks.postcondition, "ROLLBACK_REQUIRED");
    assert.equal(actual.contractChecks.rollbackReadback, "VERIFIED");
    assert.ok(actual.stateTrace.includes("ZERO_RESIDUE"));
  }
});

test("registry outage preserves the local Accepted operation without changing its pointer", () => {
  const receipt = verifyFixture("registry-outage");
  assert.equal(receipt.outcome, "PRESERVE_ACCEPTED");
  assert.equal(receipt.readOnly, false);
  assert.equal(receipt.finalPointer.activeSnapshotId, "candidate:synthetic-001");
  assert.equal(receipt.finalPointer.activeTupleDigest, UPDATE_SYNTHETIC_APPLY_HARNESS_TARGET_TUPLE_DIGEST_V1);
  assert.equal(receipt.finalPointer.revision, 1);
  assert.deepEqual(receipt.finalPointer, receipt.initialPointer);
  assert.equal(receipt.finalOwnerStateDigest, receipt.initialOwnerStateDigest);
  assert.equal(receipt.contractChecks.continuity, "PRESERVE_ACCEPTED");
});

test("invalid LKG fails closed into safe read-only mode", () => {
  const receipt = verifyFixture("invalid-lkg");
  assert.equal(receipt.outcome, "SAFE_READ_ONLY");
  assert.equal(receipt.readOnly, true);
  assert.equal(receipt.finalPointer.activeSnapshotId, "lkg:synthetic-001");
  assert.equal(receipt.finalPointer.revision, 1);
  assert.equal(receipt.contractChecks.continuity, "ENTER_SAFE_READ_ONLY");
  assert.equal(receipt.residueCount, 0);
  assert.equal(receipt.lkgState, "INCOMPLETE");
  assert.equal(receipt.lkgRevoked, false);
});

test("CAS rejects a stale or forged pointer and never self-promotes a candidate", () => {
  const receipt = runUpdateSyntheticApplyHarnessV1();
  const stale = compareAndSwapUpdateSyntheticApplyPointerV1(
    receipt.initialPointer,
    { activeTupleDigest: receipt.initialPointer.activeTupleDigest, revision: receipt.initialPointer.revision + 1 },
    { activeSnapshotId: "candidate:forged", activeTupleDigest: receipt.tupleDigest },
  );
  assert.equal(stale.swapped, false);
  assert.deepEqual(stale.pointer, receipt.initialPointer);
  assert.notEqual(receipt.initialPointer.activeSnapshotId, "candidate:synthetic-001");
  assert.equal(receipt.contractChecks.promotionGate, "VERIFIED");
  assert.notEqual(UPDATE_SYNTHETIC_APPLY_HARNESS_ACTOR_BINDINGS_V1.candidateId, UPDATE_SYNTHETIC_APPLY_HARNESS_ACTOR_BINDINGS_V1.verifierId);
  assert.notEqual(UPDATE_SYNTHETIC_APPLY_HARNESS_ACTOR_BINDINGS_V1.candidateId, UPDATE_SYNTHETIC_APPLY_HARNESS_ACTOR_BINDINGS_V1.promoterId);
});

test("rollback retry is deterministic and fully receipted", () => {
  const first = runUpdateSyntheticApplyHarnessV1({ failure: "FAILED_POSTCONDITION" });
  const second = runUpdateSyntheticApplyHarnessV1({ failure: "FAILED_POSTCONDITION" });
  assert.equal(first.retryOrdinal, UPDATE_SYNTHETIC_APPLY_HARNESS_RETRY_ORDINAL_V1);
  assert.equal(first.retryReceiptDigest.length, 64);
  assert.deepEqual(first, second);
  assert.deepEqual(parseUpdateSyntheticApplyHarnessReceiptV1(JSON.stringify(first)), {
    outcome: "VERIFIED",
    reasonCodes: ["SYNTHETIC_APPLY_RECEIPT_VERIFIED"],
    exitCode: 0,
  });
  const altered = { ...first, residueCount: 1 };
  assert.deepEqual(verifyUpdateSyntheticApplyHarnessReceiptV1(altered), {
    outcome: "DENIED",
    reasonCodes: ["DIGEST_MISMATCH_DENIED"],
    exitCode: 71,
  });
});
