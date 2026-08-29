import assert from "node:assert/strict";
import test from "node:test";
import {
  UPDATE_CHECKPOINT_ROLLBACK_READBACK_EXIT_CODES_V1,
  UPDATE_CHECKPOINT_ROLLBACK_READBACK_FAILURE_V1,
  UPDATE_CHECKPOINT_ROLLBACK_READBACK_PHASE_V1,
  UPDATE_CHECKPOINT_ROLLBACK_READBACK_SCHEMA_V1,
  UPDATE_CHECKPOINT_ROLLBACK_READBACK_TRANSITION_V1,
  UPDATE_CHECKPOINT_ROLLBACK_READBACK_ZERO_RESIDUE_V1,
  buildUpdateCheckpointRollbackReadbackV1,
  parseUpdateCheckpointRollbackReadbackV1,
  renderVerifiedUpdateCheckpointRollbackReadbackV1,
  updateCheckpointRollbackReadbackDigestV1,
  updateCheckpointRollbackRetryDeterminismDigestV1,
  verifyUpdateCheckpointRollbackReadbackV1,
  type UpdateCheckpointRollbackReadbackContextV1,
} from "../packages/contracts/src/update-checkpoint-rollback-readback.js";

const OPERATION = "a".repeat(64);
const EDGE = "b".repeat(64);
const CHECKPOINT = "c".repeat(64);
const LKG = "d".repeat(64);
const EVIDENCE = "e".repeat(64);
const OWNER = "f".repeat(64);
const AUTHORITY = "1".repeat(64);
const RETRY_RECEIPT = "2".repeat(64);
const OBSERVED_AT = 1_787_612_400_001;
const VERIFIER = { verifierId: "verifier:independent-readback-verifier", verifierVersion: "1.0.0" } as const;

const options = {
  operationDigest: OPERATION,
  migrationEdgeDigest: EDGE,
  checkpointDigest: CHECKPOINT,
  rollbackTargetTupleDigest: LKG,
  independentEvidenceDigest: EVIDENCE,
  ownerStateDigest: OWNER,
  retryOrdinal: 2,
  retryReceiptDigest: RETRY_RECEIPT,
  authorityProfileDigest: AUTHORITY,
  verifier: VERIFIER,
  observedAtMs: OBSERVED_AT,
} as const;

function proof() { return buildUpdateCheckpointRollbackReadbackV1(options); }

function context(value = proof()): UpdateCheckpointRollbackReadbackContextV1 {
  return {
    expectedOperationDigest: value.operationDigest,
    expectedMigrationEdgeDigest: value.migrationEdgeDigest,
    expectedCheckpointDigest: value.checkpointDigest,
    expectedRollbackTargetTupleDigest: value.rollbackTargetTupleDigest,
    expectedIndependentEvidenceDigest: value.independentEvidenceDigest,
    expectedOwnerStateDigest: value.expectedOwnerStateDigest,
    expectedRetryOrdinal: value.retryOrdinal,
    expectedRetryReceiptDigest: value.retryReceiptDigest,
    expectedRetryDeterminismDigest: value.retryDeterminismDigest,
    expectedAuthorityProfileDigest: value.authorityProfileDigest,
    expectedVerifier: VERIFIER,
    expectedObservedAtMs: value.observedAtMs,
  };
}

function redigest(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  const value = { ...JSON.parse(JSON.stringify(proof())), ...overrides } as Record<string, unknown>;
  value.readbackDigest = updateCheckpointRollbackReadbackDigestV1(value);
  return value;
}

function assertDenied(value: unknown, reason: keyof typeof UPDATE_CHECKPOINT_ROLLBACK_READBACK_EXIT_CODES_V1, ctx: UpdateCheckpointRollbackReadbackContextV1 | undefined = context()): void {
  const result = verifyUpdateCheckpointRollbackReadbackV1(value, ctx);
  assert.equal(result.outcome, "DENIED");
  assert.deepEqual(result.reasonCodes, [reason]);
  assert.equal(result.exitCode, UPDATE_CHECKPOINT_ROLLBACK_READBACK_EXIT_CODES_V1[reason]);
  assert.ok(Object.isFrozen(result));
  assert.ok(Object.isFrozen(result.reasonCodes));
}

test("pre-migration checkpoint/readback proof verifies exact unrevoked LKG, independent evidence, and zero residue", () => {
  const value = proof();
  assert.equal(value.schemaVersion, UPDATE_CHECKPOINT_ROLLBACK_READBACK_SCHEMA_V1);
  assert.equal(value.transition, UPDATE_CHECKPOINT_ROLLBACK_READBACK_TRANSITION_V1);
  assert.equal(value.phase, UPDATE_CHECKPOINT_ROLLBACK_READBACK_PHASE_V1);
  assert.equal(value.failureScenario, UPDATE_CHECKPOINT_ROLLBACK_READBACK_FAILURE_V1);
  assert.equal(value.rollbackTargetRevoked, false);
  assert.equal(value.rollbackTargetTupleDigest, LKG);
  assert.equal(value.expectedRollbackTargetTupleDigest, LKG);
  assert.equal(value.observedRollbackTargetTupleDigest, LKG);
  assert.equal(value.residueCount, UPDATE_CHECKPOINT_ROLLBACK_READBACK_ZERO_RESIDUE_V1);
  assert.equal(value.independentEvidenceDigest, EVIDENCE);
  assert.equal(value.expectedIndependentEvidenceDigest, EVIDENCE);
  assert.deepEqual(verifyUpdateCheckpointRollbackReadbackV1(value, context()), {
    outcome: "VERIFIED", reasonCodes: ["READBACK_VERIFIED"], exitCode: 0,
  });
  assert.equal(updateCheckpointRollbackReadbackDigestV1(value), value.readbackDigest);
  assert.ok(Object.isFrozen(value));
  assert.ok(Object.isFrozen(value.verifier));
});

test("retry after synthetic failure is deterministic and fully receipted", () => {
  const first = proof();
  const second = buildUpdateCheckpointRollbackReadbackV1(options);
  assert.equal(first.retryOrdinal, 2);
  assert.equal(first.retryReceiptDigest, RETRY_RECEIPT);
  assert.equal(first.retryDeterminismDigest, updateCheckpointRollbackRetryDeterminismDigestV1({
    operationDigest: OPERATION,
    migrationEdgeDigest: EDGE,
    rollbackTargetTupleDigest: LKG,
    retryOrdinal: 2,
    retryReceiptDigest: RETRY_RECEIPT,
  }));
  assert.equal(first.readbackDigest, second.readbackDigest);
  assert.equal(renderVerifiedUpdateCheckpointRollbackReadbackV1(first, context()), renderVerifiedUpdateCheckpointRollbackReadbackV1(second, context()));
  const bytes = renderVerifiedUpdateCheckpointRollbackReadbackV1(first, context());
  assert.equal(bytes.includes("restore"), false);
  assert.equal(bytes.includes("execute"), false);
  assert.equal(bytes.includes("authorization"), false);
});

test("missing independent context, stale checkpoint, revoked target, residue, evidence, and retry forgeries deny", () => {
  const value = proof();
  const missingContext = verifyUpdateCheckpointRollbackReadbackV1(value, undefined);
  assert.equal(missingContext.outcome, "DENIED");
  assert.deepEqual(missingContext.reasonCodes, ["INDEPENDENT_CONTEXT_DENIED"]);
  assertDenied(redigest({ checkpointDigest: "3".repeat(64) }), "CHECKPOINT_BINDING_DENIED");
  assertDenied(redigest({ rollbackTargetRevoked: true }), "ROLLBACK_TARGET_REVOKED_DENIED");
  assertDenied(redigest({ observedRollbackTargetTupleDigest: "4".repeat(64) }), "ROLLBACK_TARGET_MISMATCH_DENIED");
  assertDenied(redigest({ residueCount: 1 }), "RESIDUE_PRESENT_DENIED");
  assertDenied(redigest({ independentEvidenceDigest: "5".repeat(64) }), "INDEPENDENT_EVIDENCE_DENIED");
  assertDenied(redigest({ retryReceiptDigest: "6".repeat(64) }), "RETRY_RECEIPT_MISMATCH_DENIED");
  assertDenied(redigest({ retryDeterminismDigest: "7".repeat(64) }), "RETRY_NONDETERMINISTIC_DENIED");
});

test("unknown authority fields, unsupported versions, invalid JSON, and malformed shapes deny fail-closed", () => {
  assertDenied({ ...redigest(), restore: true }, "SCHEMA_DENIED");
  assertDenied({ ...redigest(), schemaVersion: "chimpmaera.update/checkpoint-rollback-readback/v2" }, "UNSUPPORTED_CONTRACT_VERSION_DENIED");
  assert.deepEqual(parseUpdateCheckpointRollbackReadbackV1("{not-json", context()).reasonCodes, ["INVALID_JSON_DENIED"]);
  assert.throws(() => buildUpdateCheckpointRollbackReadbackV1({ ...options, retryOrdinal: 0 }), /INVALID_CHECKPOINT_ROLLBACK_READBACK_FIXTURE/);
  assert.throws(() => buildUpdateCheckpointRollbackReadbackV1({ ...options, verifier: { verifierId: "verifier:independent-executor", verifierVersion: "1.0.0" } }), /INVALID_CHECKPOINT_ROLLBACK_READBACK_FIXTURE/);
});

test("proxy-backed inputs are rejected without evaluating attacker traps", () => {
  let traps = 0;
  const value = new Proxy(proof(), { get: () => { traps += 1; throw new Error("GET_TRAP"); }, ownKeys: () => { traps += 1; throw new Error("KEY_TRAP"); } });
  assertDenied(value, "SCHEMA_DENIED");
  assert.equal(traps, 0);
});
