import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";
import { canonicalJson } from "../packages/contracts/src/canonical-json.js";
import { updateTupleDigestV1 } from "../packages/contracts/src/update-check-plan.js";
import {
  UPDATE_APPLY_TUPLE_LOCK_EXIT_CODES_V1,
  UPDATE_APPLY_TUPLE_LOCK_SCHEMA_V1,
  checkUpdateApplyTupleLockV1,
  updateApplyTupleLockDigestV1,
  type UpdateApplyTupleLockReasonCodeV1,
  type UpdateApplyTupleLockResultV1,
  type UpdateApplyTupleLockV1,
} from "../packages/contracts/src/update-apply-tuple-lock.js";

const AUTHORITY_PROFILE_DIGEST = "7".repeat(64);
const OPERATION_ID = "apply:ud-apply-001-lock";
const ISSUED_AT_MS = 1_785_819_600_500;

function component(componentId: string, version: string, hex: string) {
  return [{ componentId, version, digest: hex.repeat(64) }];
}

function v1Tuple() {
  return {
    core: component("core:control-plane", "1.0.0", "1"),
    packs: component("pack:company-data", "1.0.0", "2"),
    adapters: component("adapter:synthetic-read", "1.0.0", "3"),
    policies: component("policy:safe-guided", "1.0.0", "4"),
    schemas: component("schema:canonical-company", "1.0.0", "5"),
    generations: component("generation:fixture-001", "1.0.0", "6"),
  };
}

function v2Tuple() {
  return {
    core: component("core:control-plane", "1.1.0", "1"),
    packs: component("pack:company-data", "1.0.0", "2"),
    adapters: component("adapter:synthetic-read", "1.0.0", "3"),
    policies: component("policy:safe-guided", "2.0.0", "4"),
    schemas: component("schema:canonical-company", "1.0.0", "5"),
    generations: component("generation:fixture-001", "1.0.0", "6"),
  };
}

function reorderedV2Tuple() {
  const tuple = v2Tuple();
  return {
    generations: tuple.generations,
    schemas: tuple.schemas,
    policies: tuple.policies,
    adapters: tuple.adapters,
    packs: tuple.packs,
    core: tuple.core,
  };
}

function validInput() {
  const source = v1Tuple();
  const target = v2Tuple();
  return {
    source: { tuple: source, tupleDigest: updateTupleDigestV1(source), authorityProfileDigest: AUTHORITY_PROFILE_DIGEST },
    target: { tuple: target, tupleDigest: updateTupleDigestV1(target), authorityProfileDigest: AUTHORITY_PROFILE_DIGEST },
    operationId: OPERATION_ID,
    issuedAtMs: ISSUED_AT_MS,
  };
}

/** Canonical content digest exactly as the tuple digest is defined, with no structural gate. */
function rawTupleDigest(tuple: unknown): string {
  return createHash("sha256").update(canonicalJson(structuredClone(tuple))).digest("hex");
}

function checkLock(result: UpdateApplyTupleLockResultV1): UpdateApplyTupleLockV1 {
  assert.equal(result.outcome, "CHECKED");
  if (result.outcome !== "CHECKED") throw new Error("expected CHECKED outcome");
  return result.lock;
}

function assertDenied(result: UpdateApplyTupleLockResultV1, reason: UpdateApplyTupleLockReasonCodeV1): void {
  assert.equal(result.outcome, "DENIED");
  if (result.outcome !== "DENIED") throw new Error("expected DENIED outcome");
  assert.ok(result.reasonCodes.includes(reason), `expected ${reason} in [${result.reasonCodes.join(", ")}]`);
  assert.equal(result.exitCode, UPDATE_APPLY_TUPLE_LOCK_EXIT_CODES_V1[result.reasonCodes[0]!]);
}

test("valid six-axis v1 source to v2 target with unchanged authority is CHECKED with exact digests", () => {
  const input = validInput();
  const lock = checkLock(checkUpdateApplyTupleLockV1(input));
  assert.equal(lock.schemaVersion, UPDATE_APPLY_TUPLE_LOCK_SCHEMA_V1);
  assert.equal(lock.state, "CHECKED");
  assert.equal(lock.operationId, OPERATION_ID);
  assert.equal(lock.issuedAtMs, ISSUED_AT_MS);
  assert.equal(lock.sourceTupleDigest, updateTupleDigestV1(v1Tuple()));
  assert.equal(lock.targetTupleDigest, updateTupleDigestV1(v2Tuple()));
  assert.equal(lock.authorityProfileDigest, AUTHORITY_PROFILE_DIGEST);
  const expectedDigest = updateApplyTupleLockDigestV1({
    schemaVersion: UPDATE_APPLY_TUPLE_LOCK_SCHEMA_V1,
    state: "CHECKED",
    operationId: OPERATION_ID,
    issuedAtMs: ISSUED_AT_MS,
    sourceTupleDigest: lock.sourceTupleDigest,
    targetTupleDigest: lock.targetTupleDigest,
    authorityProfileDigest: AUTHORITY_PROFILE_DIGEST,
    lockDigest: "",
  }, "lockDigest");
  assert.equal(lock.lockDigest, expectedDigest);
  assert.match(lock.lockDigest, /^[a-f0-9]{64}$/);
  assert.notEqual(lock.lockDigest, lock.sourceTupleDigest);
  assert.notEqual(lock.lockDigest, lock.targetTupleDigest);
  assert.ok(Object.isFrozen(lock));
});

test("deterministic lock digest is stable across repeated calls", () => {
  const first = checkLock(checkUpdateApplyTupleLockV1(validInput()));
  const second = checkLock(checkUpdateApplyTupleLockV1(validInput()));
  assert.equal(first.lockDigest, second.lockDigest);
  assert.equal(canonicalJson(first), canonicalJson(second));
});

test("equivalent key ordering yields identical lock bytes and digest", () => {
  const first = checkLock(checkUpdateApplyTupleLockV1(validInput()));
  const target = reorderedV2Tuple();
  const reordered = checkLock(checkUpdateApplyTupleLockV1({
    issuedAtMs: ISSUED_AT_MS,
    operationId: OPERATION_ID,
    target: {
      authorityProfileDigest: AUTHORITY_PROFILE_DIGEST,
      tuple: target,
      tupleDigest: updateTupleDigestV1(target),
    },
    source: {
      authorityProfileDigest: AUTHORITY_PROFILE_DIGEST,
      tuple: v1Tuple(),
      tupleDigest: updateTupleDigestV1(v1Tuple()),
    },
  }));
  assert.equal(canonicalJson(first), canonicalJson(reordered));
  assert.equal(first.lockDigest, reordered.lockDigest);
  assert.equal(first.sourceTupleDigest, reordered.sourceTupleDigest);
  assert.equal(first.targetTupleDigest, reordered.targetTupleDigest);
});

test("the CHECKED lock grants no execution or promotion authority and carries no tuples or secrets", () => {
  const result = checkUpdateApplyTupleLockV1(validInput());
  const lock = checkLock(result);
  assert.deepEqual(Object.keys(lock).sort(), [
    "authorityProfileDigest",
    "issuedAtMs",
    "lockDigest",
    "operationId",
    "schemaVersion",
    "sourceTupleDigest",
    "state",
    "targetTupleDigest",
  ]);
  assert.equal(lock.state, "CHECKED");
  const rendered = canonicalJson(lock);
  for (const forbidden of ["execution", "promot", "credential", "secret", "token", "password", "http://", "https://", "componentId", "/tmp"]) {
    assert.ok(!rendered.includes(forbidden), `lock must not contain ${forbidden}`);
  }
  assert.ok(!rendered.includes("core:control-plane"), "lock must not embed tuple components");
});

test("missing or empty axes and duplicate components are denied", () => {
  const missingAxis = structuredClone(validInput());
  delete (missingAxis.source.tuple as Record<string, unknown>).schemas;
  assertDenied(checkUpdateApplyTupleLockV1(missingAxis), "SCHEMA_DENIED");

  const emptyAxis = structuredClone(validInput());
  emptyAxis.source.tuple.generations = [];
  assertDenied(checkUpdateApplyTupleLockV1(emptyAxis), "SCHEMA_DENIED");

  const duplicateComponent = structuredClone(validInput());
  duplicateComponent.target.tuple.packs = [...duplicateComponent.target.tuple.packs, ...duplicateComponent.target.tuple.packs];
  assertDenied(checkUpdateApplyTupleLockV1(duplicateComponent), "SCHEMA_DENIED");

  const unknownAxis = structuredClone(validInput());
  (unknownAxis.source.tuple as Record<string, unknown>).extras = component("core:extra", "1.0.0", "a");
  assertDenied(checkUpdateApplyTupleLockV1(unknownAxis), "SCHEMA_DENIED");
});

test("version drift and declared digest drift are denied", () => {
  const versionDrift = structuredClone(validInput());
  versionDrift.target.tuple.core[0]!.version = "2.0.0";
  assertDenied(checkUpdateApplyTupleLockV1(versionDrift), "DIGEST_MISMATCH_DENIED");

  const digestDrift = structuredClone(validInput());
  digestDrift.target.tupleDigest = "f".repeat(64);
  assertDenied(checkUpdateApplyTupleLockV1(digestDrift), "DIGEST_MISMATCH_DENIED");

  const sourceDigestDrift = structuredClone(validInput());
  sourceDigestDrift.source.tupleDigest = "0".repeat(63) + "e";
  assertDenied(checkUpdateApplyTupleLockV1(sourceDigestDrift), "DIGEST_MISMATCH_DENIED");
});

test("authority profile change between source and target is denied", () => {
  const input = structuredClone(validInput());
  input.target.authorityProfileDigest = "8".repeat(64);
  assertDenied(checkUpdateApplyTupleLockV1(input), "AUTHORITY_PROFILE_CHANGED_DENIED");
});

test("source equal to target is denied, including canonical key-order equality", () => {
  const identical = structuredClone(validInput());
  identical.source.tuple = v2Tuple();
  identical.source.tupleDigest = updateTupleDigestV1(v2Tuple());
  assertDenied(checkUpdateApplyTupleLockV1(identical), "IDENTICAL_TUPLE_DENIED");

  const reorderedIdentical = structuredClone(validInput());
  reorderedIdentical.source.tuple = reorderedV2Tuple();
  reorderedIdentical.source.tupleDigest = updateTupleDigestV1(reorderedV2Tuple());
  assertDenied(checkUpdateApplyTupleLockV1(reorderedIdentical), "IDENTICAL_TUPLE_DENIED");
});

test("unknown, credential, path, free-text, URL, execution and promotion fields are denied", () => {
  const freeText = structuredClone(validInput());
  (freeText as Record<string, unknown>).note = "please apply soon";
  assertDenied(checkUpdateApplyTupleLockV1(freeText), "SCHEMA_DENIED");

  const executionClaim = structuredClone(validInput());
  (executionClaim as Record<string, unknown>).executionAuthorized = true;
  assertDenied(checkUpdateApplyTupleLockV1(executionClaim), "SCHEMA_DENIED");

  const promotionClaim = structuredClone(validInput());
  (promotionClaim as Record<string, unknown>).promotedBy = "promoter:wave-53";
  assertDenied(checkUpdateApplyTupleLockV1(promotionClaim), "SCHEMA_DENIED");

  const credential = structuredClone(validInput());
  (credential.source as Record<string, unknown>).credential = "token:secret-value";
  assertDenied(checkUpdateApplyTupleLockV1(credential), "SCHEMA_DENIED");

  const urlField = structuredClone(validInput());
  (urlField.target as Record<string, unknown>).url = "https://example.com/package";
  assertDenied(checkUpdateApplyTupleLockV1(urlField), "SCHEMA_DENIED");

  const pathField = structuredClone(validInput());
  (pathField.source as Record<string, unknown>).path = "/tmp/package.tar";
  assertDenied(checkUpdateApplyTupleLockV1(pathField), "SCHEMA_DENIED");
});

test("identifier substitution with an unchanged lock digest fails envelope verification", () => {
  const base = checkLock(checkUpdateApplyTupleLockV1(validInput()));
  const swapped = checkLock(checkUpdateApplyTupleLockV1({
    ...structuredClone(validInput()),
    operationId: "apply:ud-apply-002-lock",
  }));
  assert.equal(swapped.operationId, "apply:ud-apply-002-lock");
  assert.notEqual(swapped.lockDigest, base.lockDigest);

  const forged = { ...base, operationId: swapped.operationId };
  assert.notEqual(updateApplyTupleLockDigestV1(forged, "lockDigest"), forged.lockDigest);
});

test("a fully re-digested forged tuple is denied", () => {
  const input = structuredClone(validInput());
  input.target.tuple.packs = [{ componentId: "core:attacker-core", version: "1.0.0", digest: "9".repeat(64) }];
  input.target.tupleDigest = rawTupleDigest(input.target.tuple);
  assertDenied(checkUpdateApplyTupleLockV1(input), "SCHEMA_DENIED");
});

test("unsafe, non-record or malformed closed inputs are denied", () => {
  for (const value of [null, "apply:ud-apply-001-lock", 42, [validInput()], true]) {
    assertDenied(checkUpdateApplyTupleLockV1(value), "SCHEMA_DENIED");
  }

  const dangerousKey = Object.create(null) as Record<string, unknown>;
  Object.defineProperty(dangerousKey, "__proto__", { value: { forged: true }, enumerable: true, writable: true, configurable: true });
  assertDenied(checkUpdateApplyTupleLockV1(dangerousKey), "SCHEMA_DENIED");

  const badOperationId = structuredClone(validInput());
  badOperationId.operationId = "update:ud-apply-001";
  assertDenied(checkUpdateApplyTupleLockV1(badOperationId), "SCHEMA_DENIED");

  const shortOperationId = structuredClone(validInput());
  shortOperationId.operationId = "apply:ab";
  assertDenied(checkUpdateApplyTupleLockV1(shortOperationId), "SCHEMA_DENIED");

  const badIssuedAt = structuredClone(validInput());
  badIssuedAt.issuedAtMs = -1;
  assertDenied(checkUpdateApplyTupleLockV1(badIssuedAt), "SCHEMA_DENIED");

  const fractionalIssuedAt = structuredClone(validInput());
  fractionalIssuedAt.issuedAtMs = 1.5;
  assertDenied(checkUpdateApplyTupleLockV1(fractionalIssuedAt), "SCHEMA_DENIED");

  const negativeZeroIssuedAt = structuredClone(validInput());
  negativeZeroIssuedAt.issuedAtMs = -0;
  assert.equal(Object.is(negativeZeroIssuedAt.issuedAtMs, -0), true);
  assertDenied(checkUpdateApplyTupleLockV1(negativeZeroIssuedAt), "SCHEMA_DENIED");

  const malformedAuthority = structuredClone(validInput());
  malformedAuthority.source.authorityProfileDigest = "not-a-digest";
  assertDenied(checkUpdateApplyTupleLockV1(malformedAuthority), "SCHEMA_DENIED");

  const badVersionShape = structuredClone(validInput());
  badVersionShape.source.tuple.core[0]!.version = "latest";
  badVersionShape.source.tupleDigest = rawTupleDigest(badVersionShape.source.tuple);
  assertDenied(checkUpdateApplyTupleLockV1(badVersionShape), "SCHEMA_DENIED");
});