/**
 * Tests for src/cks-12/prerequisite-receipt-binder.ts.
 *
 * Slice PSAI292-QWEN-01 acceptance criteria:
 *  AC-01 Closed field sets and canonical-JSON/SHA-256 binding rules
 *        (fixture identity tuple; receipt digest rule; canonical parity).
 *  AC-02 Validation and promotion evidence are distinct digests per receipt;
 *        the fixed non-authority triple {authority,capabilityDelta,effect}
 *        = {NONE,NONE,NONE} is enforced on every prerequisite receipt.
 *  AC-03 A single shared component version lock digest covers all five
 *        prerequisite receipts (mixed locks are denied).
 *  AC-04 The exact positive obligation: exactly five receipts #287 → #291 in
 *        order, each PASS_SYNTHETIC_ONLY; anything missing, invalid, stale,
 *        or mis-ordered is DENIED with finite reason codes — never a
 *        success receipt.
 *  AC-05 Deterministic, byte-reproducible output: the committed verification
 *        receipt is canonically identical to the binder output and the
 *        self-digest rule holds.
 *  AC-06 No overclaiming: the bind receipt records
 *        integratedProofState EVIDENCE_INCOMPLETE, successClaimed false, and
 *        the boundary nonClaims verbatim; it never claims CKS-12
 *        PASS_SYNTHETIC_ONLY.
 *
 * Fixture convention: tests/fixtures/cks-12/prerequisite-receipts-v1.json is
 * stored in canonical-compact form (exactly the canonicalJson of its parsed
 * content) because the fixture identity tuple binds its exact bytes.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";

import type { BindOutcome, BindSuccess, PrerequisiteBindReceiptV1 } from "../../src/cks-12/prerequisite-receipt-binder.js";

/*
 * Dual-context import: this test runs both raw under Node (native type
 * stripping, import.meta.url ends in .ts) and compiled under
 * dist/tests/cks-12/ (import.meta.url ends in .js). The type-only import is
 * erased at runtime; the dynamic import picks the existing module form.
 */
const binderSpecifier = import.meta.url.endsWith(".ts")
  ? "../../src/cks-12/prerequisite-receipt-binder.ts"
  : "../../src/cks-12/prerequisite-receipt-binder.js";
const binder: typeof import("../../src/cks-12/prerequisite-receipt-binder.js") = await import(binderSpecifier);

const repoCanonicalSpecifier = import.meta.url.endsWith(".ts")
  ? "../../packages/contracts/src/canonical-json.ts"
  : "../../packages/contracts/src/canonical-json.js";
const { canonicalJson: repoCanonicalJson } = await import(
  repoCanonicalSpecifier
) as typeof import("../../packages/contracts/src/canonical-json.js");

const sha256Hex = (value: string | Uint8Array): string =>
  createHash("sha256").update(value).digest("hex");

const fixtureBytes = readFileSync("tests/fixtures/cks-12/prerequisite-receipts-v1.json");

const bind = (bytes: Uint8Array): BindOutcome => binder.bindPrerequisiteReceipts(bytes);

const bindObject = (fixtureObj: unknown): BindOutcome =>
  bind(new TextEncoder().encode(binder.canonicalJson(fixtureObj)));

const requireSuccess = (outcome: BindOutcome, label: string): BindSuccess => {
  if (outcome.status !== "RECORDED") {
    throw new Error(`${label}: expected RECORDED, got ${JSON.stringify(outcome)}`);
  }
  return outcome;
};

// Indexed access that narrows under noUncheckedIndexedAccess.
const at = <T>(arr: readonly T[], index: number): T => {
  const value = arr[index];
  if (value === undefined) {
    throw new Error(`index ${index} out of range`);
  }
  return value;
};

const getReceipt = (outcome: BindOutcome, label: string): PrerequisiteBindReceiptV1 => {
  if (outcome.status !== "RECORDED") {
    assert.fail(`${label}: expected RECORDED, got ${JSON.stringify(outcome)}`);
  }
  return outcome.receipt;
};

const expectDenied = (fixtureObj: unknown, expectedReason: string): void => {
  const outcome = bindObject(fixtureObj);
  if (outcome.status !== "DENIED") {
    assert.fail(`expected DENIED (${expectedReason}), got RECORDED`);
  }
  assert.ok(
    outcome.reasonCodes.includes(expectedReason),
    `expected reason ${expectedReason}, got ${JSON.stringify(outcome.reasonCodes)}`
  );
  const known = new Set<string>(binder.DENIAL_REASON_CODES);
  for (const reason of outcome.reasonCodes) {
    assert.ok(known.has(reason), `reason code outside the finite vocabulary: ${reason}`);
  }
  assert.ok(outcome.details.length > 0, "denial must carry at least one detail");
  assert.ok(!("receipt" in outcome), "denied outcome must not carry a receipt");
};

interface FixtureObject {
  schemaVersion: string;
  fixtureId: string;
  prerequisiteReceipts: Record<string, unknown>[];
}

const baseFixture: FixtureObject = JSON.parse(fixtureBytes.toString("utf8"));

const clone = (): FixtureObject => structuredClone(baseFixture);

/* ------------------------------------------------------------------ */
/* AC-01 — canonical JSON, closed field sets, digest rules.            */
/* ------------------------------------------------------------------ */

test("AC-01: binder canonicalJson has runtime parity with the repository canonicalizer", () => {
  const battery: unknown[] = [
    null,
    true,
    false,
    "",
    "abc",
    "üñí©ødé \n\t\"quoted\"",
    0,
    1,
    -3,
    1.5,
    1e21,
    [],
    [1, 2, 3],
    [[]],
    {},
    { a: 1 },
    { b: 1, a: 2 },
    { a: { c: 1, b: 2 }, arr: [{ z: 1, y: 2 }] },
    { "empty object": {} },
  ];
  for (const value of battery) {
    assert.equal(binder.canonicalJson(value), repoCanonicalJson(value), `parity failed for ${JSON.stringify(value)}`);
  }
  for (const bad of [Infinity, -Infinity, NaN]) {
    assert.throws(() => binder.canonicalJson(bad), TypeError);
    assert.throws(() => repoCanonicalJson(bad), TypeError);
  }
  assert.throws(() => binder.canonicalJson({ a: undefined }), TypeError);
  assert.throws(() => repoCanonicalJson({ a: undefined }), TypeError);
  assert.throws(() => binder.canonicalJson(new Date()), TypeError);
  assert.throws(() => repoCanonicalJson(new Date()), TypeError);
});

test("AC-01: fixture is canonical-compact JSON and its identity is bound to the exact bytes", () => {
  const parsed: unknown = JSON.parse(fixtureBytes.toString("utf8"));
  assert.equal(new TextDecoder("utf-8").decode(fixtureBytes), binder.canonicalJson(parsed));
  assert.equal(baseFixture.schemaVersion, binder.FIXTURE_SCHEMA_VERSION);
  assert.equal(baseFixture.fixtureId, binder.FIXTURE_ID);
  assert.equal(baseFixture.prerequisiteReceipts.length, 5);

  const receipt = getReceipt(bind(fixtureBytes), "fixture bind");
  assert.equal(receipt.fixtureId, binder.FIXTURE_ID);
  assert.equal(receipt.fixtureVersion, "v1");
  assert.equal(receipt.fixtureSha256, sha256Hex(fixtureBytes));
  assert.equal(receipt.fixtureSha256, binder.FIXTURE_SHA256);
});

test("AC-01: a changed v1 fixture cannot be accepted by merely rehashing its receipt", () => {
  const changed = clone();
  const source = at(changed.prerequisiteReceipts, 0);
  source.fixtureVersion = "v2";
  const { receiptSha256: _oldReceiptSha256, ...body } = source;
  source.receiptSha256 = sha256Hex(binder.canonicalJson(body));
  expectDenied(changed, "PROOF_OBLIGATION_MISMATCH");
  const outcome = bindObject(changed);
  if (outcome.status !== "DENIED") assert.fail("changed v1 fixture must be denied");
  assert.ok(outcome.reasonCodes.includes("FIXTURE_INTEGRITY_FAILED"));
});

test("AC-01: embedded boundary constants match the frozen boundary receipt file", () => {
  const boundaryBytes = readFileSync("verification/cks-12-closed-loop-boundary-v1.json");
  const boundary: Record<string, unknown> = JSON.parse(boundaryBytes.toString("utf8"));
  assert.equal(boundary.receiptId, binder.BOUNDARY_RECEIPT_ID);
  const { receiptSha256, ...body } = boundary;
  assert.equal(sha256Hex(binder.canonicalJson(body)), receiptSha256);
  assert.equal(receiptSha256, binder.BOUNDARY_RECEIPT_SHA256);

  const ids = (boundary.storySteps as Array<Record<string, unknown>>).map((step) => String(step.id));
  assert.deepEqual(ids, [...binder.ORDERED_STORY_STEP_IDS]);
  assert.equal(sha256Hex(binder.canonicalJson(ids)), binder.STORY_STEP_VOCABULARY_SHA256);

  assert.deepEqual(boundary.nonClaims, [...binder.NON_CLAIMS]);
  assert.deepEqual(boundary.sourceIssues, ["#280", "#287", "#288", "#289", "#290", "#291", "#292"]);
});

/* ------------------------------------------------------------------ */
/* AC-04 — exact positive obligation and deterministic binding.        */
/* ------------------------------------------------------------------ */

test("AC-04: the five positive prerequisite receipts bind in order", () => {
  const receipt = getReceipt(bind(fixtureBytes), "positive bind");

  const expected = [
    { cksId: "CKS-07", issue: "#287" },
    { cksId: "CKS-08", issue: "#288" },
    { cksId: "CKS-09", issue: "#289" },
    { cksId: "CKS-10", issue: "#290" },
    { cksId: "CKS-11", issue: "#291" },
  ];
  assert.equal(receipt.prerequisiteReceipts.length, expected.length);
  for (let i = 0; i < expected.length; i++) {
    const embedded = at(receipt.prerequisiteReceipts, i);
    const source = at(baseFixture.prerequisiteReceipts, i);
    const { cksId, issue } = at(expected, i);
    assert.equal(embedded.cksId, cksId);
    assert.equal(embedded.issue, issue);
    assert.equal(embedded.receiptId, `${cksId}-PREREQUISITE-RECEIPT-V1`);
    assert.equal(embedded.runId, `${cksId}-SYNTHETIC-PROOF-RUN-V1`);
    assert.equal(embedded.proofState, "PASS_SYNTHETIC_ONLY");
    assert.equal(embedded.receiptSha256, source.receiptSha256);
    assert.equal(embedded.lastReceiptSha256, source.lastReceiptSha256);
    assert.equal(embedded.receiptChainSha256, source.receiptChainSha256);
  }
  assert.equal(
    receipt.prerequisiteReceiptsSha256,
    sha256Hex(binder.canonicalJson(receipt.prerequisiteReceipts))
  );

  // Every embedded digest must be a real SHA-256 of the source receipt body
  // (independent re-derivation of the fixture integrity rule).
  for (const source of baseFixture.prerequisiteReceipts) {
    const { receiptSha256, ...body } = source;
    assert.equal(sha256Hex(binder.canonicalJson(body)), receiptSha256);
  }
});

/* ------------------------------------------------------------------ */
/* AC-02 — distinct validation/promotion evidence; fixed non-authority. */
/* ------------------------------------------------------------------ */

test("AC-02: validation and promotion evidence are distinct per receipt", () => {
  for (const source of baseFixture.prerequisiteReceipts) {
    assert.notEqual(source.validationReceiptSha256, source.promotionReceiptSha256);
    assert.equal(source.validationReceiptSha256 !== undefined, true);
  }
  const c = clone();
  const cks07 = at(c.prerequisiteReceipts, 0);
  cks07.promotionReceiptSha256 = cks07.validationReceiptSha256;
  expectDenied(c, "PROOF_OBLIGATION_MISMATCH");
});

test("AC-02: the fixed non-authority triple is enforced on every receipt", () => {
  for (const source of baseFixture.prerequisiteReceipts) {
    assert.equal(source.authority, "NONE");
    assert.equal(source.capabilityDelta, "NONE");
    assert.equal(source.effect, "NONE");
  }
  const c = clone();
  at(c.prerequisiteReceipts, 4).authority = "GRANT";
  expectDenied(c, "UNKNOWN_VARIANT");
  const d = clone();
  at(d.prerequisiteReceipts, 2).effect = "MUTATE_KNOWLEDGE_BASE";
  expectDenied(d, "UNKNOWN_VARIANT");
});

/* ------------------------------------------------------------------ */
/* AC-03 — single shared component version lock.                       */
/* ------------------------------------------------------------------ */

test("AC-03: one shared component version lock digest covers all five receipts", () => {
  const locks = new Set(baseFixture.prerequisiteReceipts.map((r) => r.componentVersionLockSha256));
  assert.equal(locks.size, 1);

  const receipt = getReceipt(bind(fixtureBytes), "lock bind");
  assert.equal(receipt.componentVersionLockSha256, [...locks][0]);

  const c = clone();
  at(c.prerequisiteReceipts, 3).componentVersionLockSha256 = "b".repeat(64);
  expectDenied(c, "VERSION_LOCK_MISMATCH");
});

/* ------------------------------------------------------------------ */
/* AC-04 (negative) — fail-closed denial matrix.                       */
/* ------------------------------------------------------------------ */

test("AC-04: missing a prerequisite receipt is denied", () => {
  const c = clone();
  c.prerequisiteReceipts.pop();
  expectDenied(c, "DEPENDENCY_EVIDENCE_MISSING");

  const zero = clone();
  at(zero.prerequisiteReceipts, 0).receiptCount = 0;
  expectDenied(zero, "DEPENDENCY_EVIDENCE_MISSING");
});

test("AC-04: mis-ordered, duplicated, or extra receipts are denied", () => {
  const swapped = clone();
  const head = at(swapped.prerequisiteReceipts, 0);
  const tail = at(swapped.prerequisiteReceipts, 4);
  swapped.prerequisiteReceipts[0] = tail;
  swapped.prerequisiteReceipts[4] = head;
  expectDenied(swapped, "PROOF_OBLIGATION_MISMATCH");

  const dup = clone();
  dup.prerequisiteReceipts.push(structuredClone(at(dup.prerequisiteReceipts, 0)));
  expectDenied(dup, "PROOF_OBLIGATION_MISMATCH");
});

test("AC-04: stale boundary constants are denied", () => {
  const c = clone();
  at(c.prerequisiteReceipts, 0).baseCommit = "0".repeat(40);
  expectDenied(c, "STALE_KNOWLEDGE");
  const d = clone();
  at(d.prerequisiteReceipts, 1).repository = "someone-else/PANSPHAIRA";
  expectDenied(d, "STALE_KNOWLEDGE");
});

test("AC-04: a non-positive proof state is denied", () => {
  const c = clone();
  at(c.prerequisiteReceipts, 2).proofState = "FALSIFIED";
  expectDenied(c, "PROOF_OBLIGATION_MISMATCH");
});

test("AC-04: any byte mutation of a receipt breaks its self-digest and is denied", () => {
  const c = clone();
  at(c.prerequisiteReceipts, 1).fixtureSha256 = "c".repeat(64);
  expectDenied(c, "RECEIPT_INTEGRITY_FAILED");

  const d = clone();
  at(d.prerequisiteReceipts, 1).runId = "CKS-08-SYNTHETIC-PROOF-RUN-V2";
  expectDenied(d, "RECEIPT_INTEGRITY_FAILED");
});

test("AC-04: closed field sets and input shapes are enforced", () => {
  const extra = clone();
  at(extra.prerequisiteReceipts, 1).extra = "x";
  expectDenied(extra, "FIXTURE_INTEGRITY_FAILED");

  const missing = clone();
  delete at(missing.prerequisiteReceipts, 1).runId;
  expectDenied(missing, "FIXTURE_INTEGRITY_FAILED");

  const shortDigest = clone();
  at(shortDigest.prerequisiteReceipts, 4).receiptSha256 = "a".repeat(63);
  expectDenied(shortDigest, "MISSING_INPUT");

  const nonObject = clone();
  (nonObject.prerequisiteReceipts as unknown[])[2] = "not-an-object";
  expectDenied(nonObject, "MISSING_INPUT");

  const invalidBytes = bind(new TextEncoder().encode("{not json"));
  if (invalidBytes.status !== "DENIED") assert.fail("expected DENIED for invalid JSON bytes");
  assert.ok(invalidBytes.reasonCodes.includes("FIXTURE_INTEGRITY_FAILED"));

  const invalidUtf8 = bind(new Uint8Array([0x7b, 0x22, 0xc3, 0x28, 0x22, 0x3a, 0x31, 0x7d]));
  if (invalidUtf8.status !== "DENIED") assert.fail("expected DENIED for invalid UTF-8 bytes");
  assert.ok(invalidUtf8.reasonCodes.includes("FIXTURE_INTEGRITY_FAILED"));

  const invalidType = bind(null as unknown as Uint8Array);
  if (invalidType.status !== "DENIED") assert.fail("expected DENIED for non-Uint8Array input");
  assert.ok(invalidType.reasonCodes.includes("MISSING_INPUT"));
});

/* ------------------------------------------------------------------ */
/* AC-05 — deterministic, byte-reproducible, committed verification.   */
/* ------------------------------------------------------------------ */

test("AC-05: output is deterministic and matches the committed verification receipt", () => {
  const first = requireSuccess(bind(fixtureBytes), "determinism run 1");
  const second = requireSuccess(bind(fixtureBytes), "determinism run 2");
  const receipt = first.receipt;
  assert.deepEqual(second.receipt, receipt);
  assert.deepEqual(second.receiptCanonicalBytes, first.receiptCanonicalBytes);

  const { receiptSha256: _omit, ...body } = receipt;
  assert.equal(receipt.receiptSha256, sha256Hex(binder.canonicalJson(body)));
  assert.deepEqual(
    first.receiptCanonicalBytes,
    new TextEncoder().encode(binder.canonicalJson(receipt))
  );

  const committed: unknown = JSON.parse(
    readFileSync("verification/cks-12/prerequisite-bind-receipt-v1.json", "utf8")
  );
  assert.equal(binder.canonicalJson(committed), binder.canonicalJson(receipt));
});

/* ------------------------------------------------------------------ */
/* AC-06 — no overclaiming.                                            */
/* ------------------------------------------------------------------ */

test("AC-06: the bind receipt claims nothing beyond the binding", () => {
  const receipt = getReceipt(bind(fixtureBytes), "non-claim bind");
  assert.equal(receipt.schemaVersion, binder.BIND_RECEIPT_SCHEMA_VERSION);
  assert.equal(receipt.receiptId, binder.BIND_RECEIPT_ID);
  assert.equal(receipt.runId, binder.BIND_RUN_ID);
  assert.equal(receipt.status, "RECORDED");
  assert.equal(receipt.reasonCode, "PREREQUISITE_BIND_RECORDED");
  assert.equal(receipt.integratedProofState, "EVIDENCE_INCOMPLETE");
  assert.equal(receipt.successClaimed, false);
  assert.equal(receipt.previousReceiptSha256, binder.GENESIS_PREVIOUS_RECEIPT_SHA256);
  assert.equal(receipt.boundaryReceiptId, binder.BOUNDARY_RECEIPT_ID);
  assert.equal(receipt.boundaryReceiptSha256, binder.BOUNDARY_RECEIPT_SHA256);
  assert.deepEqual(receipt.orderedStoryStepIds, [...binder.ORDERED_STORY_STEP_IDS]);
  assert.equal(receipt.storyStepVocabularySha256, binder.STORY_STEP_VOCABULARY_SHA256);
  assert.equal(receipt.storyStepVocabularySha256, sha256Hex(binder.canonicalJson(receipt.orderedStoryStepIds)));
  assert.equal(receipt.authority, "NONE");
  assert.equal(receipt.capabilityDelta, "NONE");
  assert.equal(receipt.effect, "NONE");
  assert.deepEqual(receipt.nonClaims, [...binder.NON_CLAIMS]);
  assert.ok(receipt.nonClaims.includes("CKS_12_SYNTHETIC_LOOP_PASSED"));
  assert.ok(receipt.nonClaims.includes("CKS_07_THROUGH_CKS_11_DEPENDENCY_PROOFS_PASSED"));
  assert.ok(receipt.nonClaims.includes("MERGED_OR_RELEASED"));
});