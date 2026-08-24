import assert from "node:assert/strict";
import test from "node:test";
import {
  UPDATE_MIGRATION_CHECKPOINT_EXIT_CODES_V1,
  UPDATE_MIGRATION_CHECKPOINT_PHASE_V1,
  UPDATE_MIGRATION_CHECKPOINT_RECORDER_SCHEMA_V1,
  UPDATE_MIGRATION_CHECKPOINT_SCHEMA_V1,
  UPDATE_MIGRATION_CHECKPOINT_TRANSITION_V1,
  buildUpdateMigrationCheckpointV1,
  parseUpdateMigrationCheckpointV1,
  renderVerifiedUpdateMigrationCheckpointV1,
  updateMigrationCheckpointDigestV1,
  verifyUpdateMigrationCheckpointV1,
  type BuildUpdateMigrationCheckpointOptionsV1,
  type UpdateMigrationCheckpointContextV1,
  type UpdateMigrationCheckpointReasonCodeV1,
} from "../packages/contracts/src/update-migration-checkpoint.js";

const OPERATION_DIGEST = "a".repeat(64);
const EDGE_DIGEST = "b".repeat(64);
const TUPLE_DIGEST = "c".repeat(64);
const SNAPSHOT_DIGEST = "d".repeat(64);
const CONTENT_DIGEST = "e".repeat(64);
const OWNER_STATE_DIGEST = "f".repeat(64);
const AUTHORITY_DIGEST = "1".repeat(64);
const CAPTURED_AT_MS = 1_787_612_400_000;
const RECORDER = { recorderId: "recorder:checkpoint-writer", recorderVersion: "1.0.0" } as const;

const options = {
  operationDigest: OPERATION_DIGEST,
  migrationEdgeDigest: EDGE_DIGEST,
  currentTupleDigest: TUPLE_DIGEST,
  rollbackTargetTupleDigest: TUPLE_DIGEST,
  snapshotDigest: SNAPSHOT_DIGEST,
  snapshotContentDigest: CONTENT_DIGEST,
  ownerStateDigest: OWNER_STATE_DIGEST,
  checkpointOrdinal: 1,
  authorityProfileDigest: AUTHORITY_DIGEST,
  recorder: RECORDER,
  capturedAtMs: CAPTURED_AT_MS,
} as const;

const context: UpdateMigrationCheckpointContextV1 = {
  expectedOperationDigest: OPERATION_DIGEST,
  expectedMigrationEdgeDigest: EDGE_DIGEST,
  expectedCurrentTupleDigest: TUPLE_DIGEST,
  expectedSnapshotDigest: SNAPSHOT_DIGEST,
  expectedSnapshotContentDigest: CONTENT_DIGEST,
  expectedOwnerStateDigest: OWNER_STATE_DIGEST,
  expectedCheckpointOrdinal: 1,
  expectedAuthorityProfileDigest: AUTHORITY_DIGEST,
  expectedRecorder: RECORDER,
  expectedCapturedAtMs: CAPTURED_AT_MS,
};

test("canonical ordinal-1 PRE_MIGRATION checkpoint records immutable metadata deterministically", () => {
  const first = buildUpdateMigrationCheckpointV1(options);
  const second = buildUpdateMigrationCheckpointV1({
    capturedAtMs: CAPTURED_AT_MS,
    recorder: { recorderVersion: "1.0.0", recorderId: "recorder:checkpoint-writer" },
    authorityProfileDigest: AUTHORITY_DIGEST,
    checkpointOrdinal: 1,
    ownerStateDigest: OWNER_STATE_DIGEST,
    snapshotContentDigest: CONTENT_DIGEST,
    snapshotDigest: SNAPSHOT_DIGEST,
    rollbackTargetTupleDigest: TUPLE_DIGEST,
    currentTupleDigest: TUPLE_DIGEST,
    migrationEdgeDigest: EDGE_DIGEST,
    operationDigest: OPERATION_DIGEST,
  });

  assert.equal(first.transition, UPDATE_MIGRATION_CHECKPOINT_TRANSITION_V1);
  assert.equal(first.phase, UPDATE_MIGRATION_CHECKPOINT_PHASE_V1);
  assert.equal(first.currentTupleDigest, first.rollbackTargetTupleDigest);
  assert.equal(updateMigrationCheckpointDigestV1(first), first.checkpointDigest);
  assert.deepEqual(verifyUpdateMigrationCheckpointV1(first, context), {
    outcome: "RECORDED",
    reasonCodes: ["CHECKPOINT_RECORDED"],
    exitCode: 0,
  });
  assert.equal(renderVerifiedUpdateMigrationCheckpointV1(first, context), renderVerifiedUpdateMigrationCheckpointV1(second, context));
  assert.equal(first.checkpointDigest, second.checkpointDigest);
  assert.ok(Object.isFrozen(first));
  assert.ok(Object.isFrozen(first.recorder));
});

function checkpoint(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  const value = JSON.parse(JSON.stringify(buildUpdateMigrationCheckpointV1(options))) as Record<string, unknown>;
  Object.assign(value, overrides);
  value.checkpointDigest = updateMigrationCheckpointDigestV1(value);
  return value;
}

function expected(overrides: Record<string, unknown> = {}): UpdateMigrationCheckpointContextV1 {
  return Object.assign({}, context, overrides) as UpdateMigrationCheckpointContextV1;
}

function assertDenied(
  value: unknown,
  reason: UpdateMigrationCheckpointReasonCodeV1,
  ctx: UpdateMigrationCheckpointContextV1 | undefined = context,
): void {
  const result = verifyUpdateMigrationCheckpointV1(value, ctx);
  assert.equal(result.outcome, "DENIED");
  assert.ok(result.reasonCodes.includes(reason), JSON.stringify(result.reasonCodes));
  assert.equal(result.exitCode, UPDATE_MIGRATION_CHECKPOINT_EXIT_CODES_V1[result.reasonCodes[0]!]);
  assert.ok(Object.isFrozen(result));
  assert.ok(Object.isFrozen(result.reasonCodes));
}

test("unchanged-digest substitutions expose digest and independent binding failures", () => {
  const substitutedRecorder = checkpoint();
  substitutedRecorder.recorder = {
    schemaVersion: UPDATE_MIGRATION_CHECKPOINT_RECORDER_SCHEMA_V1,
    recorderId: "recorder:metadata-writer",
    recorderVersion: "1.0.0",
  };
  const result = verifyUpdateMigrationCheckpointV1(substitutedRecorder, context);
  assert.equal(result.outcome, "DENIED");
  assert.deepEqual(result.reasonCodes, ["DIGEST_MISMATCH_DENIED", "RECORDER_MISMATCH_DENIED"]);

  const substitutedOperation = checkpoint();
  substitutedOperation.operationDigest = "2".repeat(64);
  const operationResult = verifyUpdateMigrationCheckpointV1(substitutedOperation, context);
  assert.equal(operationResult.outcome, "DENIED");
  assert.deepEqual(operationResult.reasonCodes, ["DIGEST_MISMATCH_DENIED", "OPERATION_BINDING_DENIED"]);
});

test("fully re-digested checkpoint and recorder forgeries fail beside unchanged authority", () => {
  assertDenied(checkpoint({ operationDigest: "2".repeat(64) }), "OPERATION_BINDING_DENIED");
  assertDenied(checkpoint({ migrationEdgeDigest: "3".repeat(64) }), "MIGRATION_EDGE_BINDING_DENIED");
  assertDenied(checkpoint({ snapshotDigest: "4".repeat(64) }), "SNAPSHOT_BINDING_DENIED");
  assertDenied(checkpoint({ snapshotContentDigest: "5".repeat(64) }), "SNAPSHOT_BINDING_DENIED");
  assertDenied(checkpoint({ ownerStateDigest: "6".repeat(64) }), "OWNER_STATE_BINDING_DENIED");
  assertDenied(checkpoint({ authorityProfileDigest: "7".repeat(64) }), "AUTHORITY_DRIFT_DENIED");
  assertDenied(checkpoint({
    recorder: {
      schemaVersion: UPDATE_MIGRATION_CHECKPOINT_RECORDER_SCHEMA_V1,
      recorderId: "recorder:metadata-writer",
      recorderVersion: "1.0.0",
    },
  }), "RECORDER_MISMATCH_DENIED");
});

test("ordinal and captured time are exact replay boundaries", () => {
  assertDenied(checkpoint({ checkpointOrdinal: 2 }), "ORDINAL_REPLAY_DENIED");
  assertDenied(checkpoint({ capturedAtMs: CAPTURED_AT_MS + 1 }), "TIME_REPLAY_DENIED");
  assertDenied(checkpoint(), "ORDINAL_REPLAY_DENIED", expected({ expectedCheckpointOrdinal: 2 }));
  assertDenied(checkpoint(), "TIME_REPLAY_DENIED", expected({ expectedCapturedAtMs: CAPTURED_AT_MS + 1 }));
});

test("negative-zero, zero and unsafe ordinal/time values deny before canonicalization", () => {
  for (const [field, value] of [
    ["checkpointOrdinal", 0],
    ["checkpointOrdinal", -0],
    ["checkpointOrdinal", Number.MAX_SAFE_INTEGER + 1],
    ["capturedAtMs", -0],
    ["capturedAtMs", -1],
    ["capturedAtMs", Number.MAX_SAFE_INTEGER + 1],
  ] as const) {
    const forged = checkpoint();
    forged[field] = value;
    forged.checkpointDigest = "0".repeat(64);
    assertDenied(forged, "SCHEMA_DENIED");
  }
  for (const malformed of [
    { ...options, checkpointOrdinal: -0 },
    { ...options, capturedAtMs: -0 },
    { ...options, checkpointOrdinal: Number.MAX_SAFE_INTEGER + 1 },
  ]) {
    assert.throws(
      () => buildUpdateMigrationCheckpointV1(malformed as BuildUpdateMigrationCheckpointOptionsV1),
      /INVALID_MIGRATION_CHECKPOINT_FIXTURE/,
    );
  }
});

test("phase, transition, rollback equality and authority-profile drift fail closed", () => {
  assertDenied(checkpoint({ phase: "POST_MIGRATION" }), "PHASE_TRANSITION_DENIED");
  assertDenied(checkpoint({ transition: "MIGRATION_APPLIED" }), "PHASE_TRANSITION_DENIED");
  assertDenied(checkpoint({ rollbackTargetTupleDigest: "8".repeat(64) }), "ROLLBACK_TARGET_MISMATCH_DENIED");
  assertDenied(checkpoint({ currentTupleDigest: "9".repeat(64), rollbackTargetTupleDigest: "9".repeat(64) }), "CURRENT_TUPLE_BINDING_DENIED");
});

test("claim-bearing recorder identities and authority-bearing fields are denied", () => {
  const claimRecorder = {
    schemaVersion: UPDATE_MIGRATION_CHECKPOINT_RECORDER_SCHEMA_V1,
    recorderId: "recorder:restore-authority",
    recorderVersion: "1.0.0",
  };
  assertDenied(
    checkpoint({ recorder: claimRecorder }),
    "AUTHORITY_CLAIM_DENIED",
    expected({ expectedRecorder: { recorderId: claimRecorder.recorderId, recorderVersion: claimRecorder.recorderVersion } }),
  );
  for (const [key, value] of [
    ["secret", "token"], ["path", "/srv/state"], ["url", "https://example.invalid"],
    ["callback", "run"], ["freeText", "migrate now"], ["migrate", true],
    ["restore", true], ["activate", true], ["promote", true], ["executeCheckpoint", true],
  ] as const) {
    const forged = checkpoint();
    forged[key] = value;
    assertDenied(forged, "SCHEMA_DENIED");
  }
});

test("authority-shaped bypass recorder identities are denied by the closed neutral allowlist", () => {
  for (const recorderId of [
    "recorder:executor",
    "recorder:deployer",
    "recorder:rollback-admin",
    "recorder:root",
    "recorder:commit-writer",
    "recorder:switch-pointer",
  ]) {
    const bypassRecorder = {
      schemaVersion: UPDATE_MIGRATION_CHECKPOINT_RECORDER_SCHEMA_V1,
      recorderId,
      recorderVersion: "1.0.0",
    };
    assertDenied(
      checkpoint({ recorder: bypassRecorder }),
      "AUTHORITY_CLAIM_DENIED",
      expected({ expectedRecorder: { recorderId, recorderVersion: bypassRecorder.recorderVersion } }),
    );
    assert.throws(
      () => buildUpdateMigrationCheckpointV1({
        ...options,
        recorder: { recorderId, recorderVersion: bypassRecorder.recorderVersion },
      }),
      /INVALID_MIGRATION_CHECKPOINT_FIXTURE/,
    );
  }
});

test("unsafe object shapes, accessors, symbols and unknown recorder fields deny without evaluation", () => {
  let getterCalled = false;
  const accessor = checkpoint();
  Object.defineProperty(accessor, "secret", {
    enumerable: true,
    get: () => { getterCalled = true; return "token"; },
  });
  assertDenied(accessor, "SCHEMA_DENIED");
  assert.equal(getterCalled, false);

  const symbol = checkpoint();
  Object.defineProperty(symbol, Symbol("secret"), { enumerable: true, value: "token" });
  assertDenied(symbol, "SCHEMA_DENIED");

  const nullPrototype = Object.assign(Object.create(null), checkpoint()) as Record<string, unknown>;
  assertDenied(nullPrototype, "SCHEMA_DENIED");

  const recorderExtra = checkpoint({
    recorder: {
      schemaVersion: UPDATE_MIGRATION_CHECKPOINT_RECORDER_SCHEMA_V1,
      recorderId: RECORDER.recorderId,
      recorderVersion: RECORDER.recorderVersion,
      restore: true,
    },
  });
  assertDenied(recorderExtra, "SCHEMA_DENIED");
});

test("Proxy-backed inputs are rejected without evaluating attacker-controlled traps", () => {
  let trapCalls = 0;
  const trapped = new Proxy(checkpoint(), {
    get: () => { trapCalls += 1; throw new Error("GET_TRAP_EVALUATED"); },
    getOwnPropertyDescriptor: () => { trapCalls += 1; throw new Error("DESCRIPTOR_TRAP_EVALUATED"); },
    getPrototypeOf: () => { trapCalls += 1; throw new Error("PROTOTYPE_TRAP_EVALUATED"); },
    ownKeys: () => { trapCalls += 1; throw new Error("OWN_KEYS_TRAP_EVALUATED"); },
  });

  assertDenied(trapped, "SCHEMA_DENIED");
  assert.equal(trapCalls, 0);
});

test("unsupported versions, invalid JSON, missing context and digest drift deny fail closed", () => {
  assertDenied(checkpoint({ schemaVersion: "chimpmaera.update/migration-checkpoint/v2" }), "UNSUPPORTED_CONTRACT_VERSION_DENIED");
  assertDenied(checkpoint({ recorder: {
    schemaVersion: "chimpmaera.update/migration-checkpoint-recorder/v2",
    recorderId: RECORDER.recorderId,
    recorderVersion: RECORDER.recorderVersion,
  } }), "UNSUPPORTED_CONTRACT_VERSION_DENIED");
  const missingContext = verifyUpdateMigrationCheckpointV1(checkpoint(), undefined);
  assert.equal(missingContext.outcome, "DENIED");
  assert.deepEqual(missingContext.reasonCodes, ["INDEPENDENT_CONTEXT_DENIED"]);
  assertDenied({ ...checkpoint(), checkpointDigest: "0".repeat(64) }, "DIGEST_MISMATCH_DENIED");
  assert.deepEqual(parseUpdateMigrationCheckpointV1("{not-json", context).reasonCodes, ["INVALID_JSON_DENIED"]);
});

test("builder rejects malformed or widened fixtures", () => {
  assert.throws(
    () => buildUpdateMigrationCheckpointV1({ ...options, rollbackTargetTupleDigest: "8".repeat(64) }),
    /INVALID_MIGRATION_CHECKPOINT_FIXTURE/,
  );
  assert.throws(
    () => buildUpdateMigrationCheckpointV1({ ...options, restore: true } as BuildUpdateMigrationCheckpointOptionsV1),
    /INVALID_MIGRATION_CHECKPOINT_FIXTURE/,
  );
  assert.throws(
    () => buildUpdateMigrationCheckpointV1({ ...options, recorder: { ...RECORDER, promote: true } } as BuildUpdateMigrationCheckpointOptionsV1),
    /INVALID_MIGRATION_CHECKPOINT_FIXTURE/,
  );
});

test("RECORDED projection is a closed metadata envelope with no execution authority", () => {
  const rendered = renderVerifiedUpdateMigrationCheckpointV1(checkpoint(), context);
  const parsed = JSON.parse(rendered) as Record<string, unknown>;
  assert.deepEqual(Object.keys(parsed).sort(), [
    "authorityProfileDigest", "capturedAtMs", "checkpointDigest", "checkpointOrdinal",
    "currentTupleDigest", "migrationEdgeDigest", "operationDigest", "ownerStateDigest",
    "phase", "recorder", "rollbackTargetTupleDigest", "schemaVersion", "snapshotContentDigest",
    "snapshotDigest", "transition",
  ].sort());
  assert.deepEqual(Object.keys(parsed.recorder as object).sort(), ["recorderId", "recorderVersion", "schemaVersion"]);
  assert.equal(parsed.schemaVersion, UPDATE_MIGRATION_CHECKPOINT_SCHEMA_V1);
  for (const forbidden of ["secret", "https://", "/srv/", "callback", "freeText", "migrate", "restore", "activate", "promote", "executeCheckpoint"]) {
    assert.ok(!rendered.includes(forbidden), forbidden);
  }
});
