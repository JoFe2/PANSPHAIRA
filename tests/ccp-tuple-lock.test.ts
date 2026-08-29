import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  canonicalCcpTupleLockJsonV1,
  ccpTupleLockDigestV1,
  lockCcpVerificationTupleV1,
  parseCcpTupleClaimV1,
  parseCcpTupleLockV1,
  verifyCcpTupleLockV1,
  CCP_CLAIM_OUTCOMES_V1,
  CCP_TUPLE_CLAIM_IDS_V1,
  CCP_TUPLE_LOCK_SCHEMA_V1,
} from "../packages/contracts/src/ccp-tuple-lock.js";
import { ccpDigestDomainV1 } from "../packages/contracts/src/ccp-event-envelope.js";

const digest = (character: string): string => character.repeat(64);

interface MergeFixture {
  candidate: unknown;
  context: unknown;
  tuple: unknown;
  lkg: unknown;
  promoterId: string;
}

const fixture = (name: string): MergeFixture =>
  JSON.parse(readFileSync(`tests/fixtures/ccp-merge/${name}.json`, "utf8"));

// Byte-stability bindings: digests of the tuple locks produced by sealing the
// green and failed-promotion fixture tuples. Any drift in the sealed bytes
// changes these values.
const GREEN_LOCK_DIGEST = "0fbc6cf201b0bac7e92e08a45cd03eb9788f7b34d8507cd64e7935fc5b046dc3";
const FAILED_LOCK_DIGEST = "192390a22d426b9e063f1bb05ed43d8b79e867506724c55df235bc660ce4ed8c";

/** Rehash a forged sealed lock with its own domain; used only to build rehashed forgeries. */
function rehashTupleLock(record: Record<string, unknown>): void {
  const { lockDigest: _lockDigest, ...unsigned } = record;
  record.lockDigest = ccpDigestDomainV1(CCP_TUPLE_LOCK_SCHEMA_V1, unsigned);
}

test("CCP-PSAI52-TUP-001 locking seals the complete tuple; allClaimsPassed is derived, not asserted", () => {
  const green = fixture("green");
  const failed = fixture("failed-promotion");

  const greenLock = lockCcpVerificationTupleV1(green.tuple);
  const failedLock = lockCcpVerificationTupleV1(failed.tuple);

  // Deterministic and digest-bound over the sealed bytes.
  assert.equal(
    canonicalCcpTupleLockJsonV1(greenLock),
    canonicalCcpTupleLockJsonV1(lockCcpVerificationTupleV1(green.tuple)),
  );
  assert.equal(ccpTupleLockDigestV1(greenLock), GREEN_LOCK_DIGEST);
  assert.equal(ccpTupleLockDigestV1(failedLock), FAILED_LOCK_DIGEST);

  assert.equal(Object.isFrozen(greenLock), true);
  assert.equal(Object.isFrozen(greenLock.claims), true);

  // The closed claim vocabulary is sealed in canonical order.
  assert.deepEqual([...CCP_TUPLE_CLAIM_IDS_V1], ["claim:build", "claim:test", "claim:security"]);
  assert.deepEqual([...CCP_CLAIM_OUTCOMES_V1], ["PASSED", "FAILED"]);
  assert.deepEqual(
    greenLock.claims.map((claim) => claim.claimId),
    [...CCP_TUPLE_CLAIM_IDS_V1],
  );

  // allClaimsPassed is derived: true for the green tuple, false for the
  // failed tuple — the lock over a failed tuple is a legitimate closed
  // record (regression evidence), not an unlock.
  assert.equal(greenLock.allClaimsPassed, true);
  assert.equal(failedLock.allClaimsPassed, false);

  // A sealed lock verifies on read-back.
  assert.equal(verifyCcpTupleLockV1(greenLock)?.lockDigest, GREEN_LOCK_DIGEST);
  assert.equal(verifyCcpTupleLockV1(failedLock)?.lockDigest, FAILED_LOCK_DIGEST);
});

test("CCP-PSAI52-TUP-002 partial or reordered tuples and hand-carried seal fields deny", () => {
  const green = fixture("green");
  const tuple = structuredClone(green.tuple) as Record<string, unknown>;

  // Malformed tuple denies.
  assert.throws(() => lockCcpVerificationTupleV1("no-tuple"), /CCP_TUPLE_LOCK_SCHEMA_DENIED/);

  // Completeness: a partial tuple (two of three claims) cannot be locked.
  const partial = structuredClone(tuple);
  (partial.claims as unknown[]).pop();
  assert.throws(() => lockCcpVerificationTupleV1(partial), /CCP_TUPLE_LOCK_SCHEMA_DENIED/);

  // Canonical order: a reordered tuple cannot be locked.
  const reordered = structuredClone(tuple);
  reordered.claims = [
    (reordered.claims as unknown[])[1],
    (reordered.claims as unknown[])[0],
    (reordered.claims as unknown[])[2],
  ];
  assert.throws(() => lockCcpVerificationTupleV1(reordered), /CCP_TUPLE_LOCK_SCHEMA_DENIED/);

  // Unknown claim id.
  const unknownClaim = structuredClone(tuple);
  ((unknownClaim.claims as Record<string, unknown>[]) as unknown as Record<string, unknown>[])
    .forEach((claim, index) => { if (index === 0) claim.claimId = "claim:lint"; });
  assert.throws(() => lockCcpVerificationTupleV1(unknownClaim), /CCP_TUPLE_LOCK_SCHEMA_DENIED/);

  // Unknown outcome.
  const unknownOutcome = structuredClone(tuple);
  ((unknownOutcome.claims as Record<string, unknown>[]) as unknown as Record<string, unknown>[])
    .forEach((claim, index) => { if (index === 2) claim.outcome = "SKIPPED"; });
  assert.throws(() => lockCcpVerificationTupleV1(unknownOutcome), /CCP_TUPLE_LOCK_SCHEMA_DENIED/);

  // A hand-carried allClaimsPassed or lockDigest is not part of the
  // unsigned tuple shape; the closed-object read denies before any lock
  // exists, so a forged seal field can never enter.
  const handCarriedLabel = structuredClone(tuple);
  handCarriedLabel.allClaimsPassed = false;
  assert.throws(() => lockCcpVerificationTupleV1(handCarriedLabel), /CCP_TUPLE_LOCK_SCHEMA_DENIED/);

  const handCarriedDigest = structuredClone(tuple);
  handCarriedDigest.lockDigest = digest("z");
  assert.throws(() => lockCcpVerificationTupleV1(handCarriedDigest), /CCP_TUPLE_LOCK_SCHEMA_DENIED/);

  // Unknown component, bad verifier, non-positive logical clock, extra field.
  const unknownComponent = structuredClone(tuple);
  unknownComponent.componentId = "component:unknown";
  assert.throws(() => lockCcpVerificationTupleV1(unknownComponent), /CCP_TUPLE_LOCK_SCHEMA_DENIED/);

  const badVerifier = structuredClone(tuple);
  badVerifier.verifierId = "verifier:ab";
  assert.throws(() => lockCcpVerificationTupleV1(badVerifier), /CCP_TUPLE_LOCK_SCHEMA_DENIED/);

  const zeroClock = structuredClone(tuple);
  zeroClock.logicalAtMs = 0;
  assert.throws(() => lockCcpVerificationTupleV1(zeroClock), /CCP_TUPLE_LOCK_SCHEMA_DENIED/);

  const extraField = structuredClone(tuple);
  extraField.unexpectedField = true;
  assert.throws(() => lockCcpVerificationTupleV1(extraField), /CCP_TUPLE_LOCK_SCHEMA_DENIED/);

  // Sealed-lock read-back is equally closed.
  const sealed = lockCcpVerificationTupleV1(tuple);
  const sealedExtra = structuredClone(sealed) as unknown as Record<string, unknown>;
  sealedExtra.unexpectedField = true;
  assert.throws(() => parseCcpTupleLockV1(sealedExtra), /CCP_TUPLE_LOCK_SCHEMA_DENIED/);

  assert.throws(() => parseCcpTupleClaimV1({ claimId: "claim:build" }), /CCP_TUPLE_LOCK_SCHEMA_DENIED/);
  assert.throws(() => ccpTupleLockDigestV1(42), /CCP_TUPLE_LOCK_SCHEMA_DENIED/);
  assert.throws(() => canonicalCcpTupleLockJsonV1("no-lock"), /CCP_TUPLE_LOCK_SCHEMA_DENIED/);
});

test("CCP-PSAI52-TUP-003 rehashed forged locks deny on read-back", () => {
  const green = fixture("green");
  const legitimate = lockCcpVerificationTupleV1(green.tuple);

  const denyForged = (mutate: (record: Record<string, unknown>) => void): void => {
    const record = structuredClone(legitimate) as unknown as Record<string, unknown>;
    mutate(record);
    rehashTupleLock(record);
    assert.throws(
      () => parseCcpTupleLockV1(record),
      /CCP_TUPLE_LOCK_SCHEMA_DENIED/,
    );
    assert.equal(verifyCcpTupleLockV1(record), null);
  };

  // Flip a claim outcome without re-deriving the label: the re-derived
  // allClaimsPassed drifts from the carried one.
  denyForged((record) => {
    (record.claims as Record<string, unknown>[])[1]!.outcome = "FAILED";
  });

  // Flip the derived label without changing the outcomes: the re-derived
  // allClaimsPassed drifts the other way.
  denyForged((record) => {
    record.allClaimsPassed = false;
  });

  // Reorder the sealed claims: the canonical-order check denies.
  denyForged((record) => {
    const claims = record.claims as unknown[];
    record.claims = [claims[1], claims[0], claims[2]];
  });

  // Tamper with a claim evidence digest without rehashing: the sealed
  // digest no longer binds the carried bytes.
  const untamperedDigest = legitimate.lockDigest;
  const record = structuredClone(legitimate) as unknown as Record<string, unknown>;
  (record.claims as Record<string, unknown>[])[0]!.evidenceDigest = digest("0");
  assert.throws(() => parseCcpTupleLockV1(record), /CCP_TUPLE_LOCK_SCHEMA_DENIED/);
  assert.equal(verifyCcpTupleLockV1(record), null);
  assert.equal(untamperedDigest, GREEN_LOCK_DIGEST);
});

test("CCP-PSAI52-TUP-004 legitimate locks verify and canonical bytes are key-order independent", () => {
  const green = fixture("green");
  const lock = lockCcpVerificationTupleV1(green.tuple);
  assert.equal(verifyCcpTupleLockV1(lock)?.lockDigest, GREEN_LOCK_DIGEST);

  const reshuffled = Object.fromEntries(Object.entries(lock).reverse());
  assert.equal(canonicalCcpTupleLockJsonV1(reshuffled), canonicalCcpTupleLockJsonV1(lock));
  assert.equal(ccpTupleLockDigestV1(reshuffled), ccpTupleLockDigestV1(lock));
  const reshuffledClaims = Object.fromEntries(Object.entries(lock.claims[0]!).reverse());
  assert.equal(
    canonicalCcpTupleLockJsonV1({ ...reshuffled, claims: [...lock.claims].map((claim, index) => index === 0 ? reshuffledClaims : claim) }),
    canonicalCcpTupleLockJsonV1(lock),
  );
});