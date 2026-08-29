import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { evaluateCcpTrainGateV1 } from "../packages/contracts/src/ccp-component-train.js";
import { lockCcpVerificationTupleV1 } from "../packages/contracts/src/ccp-tuple-lock.js";
import {
  canonicalCcpLkgStateJsonV1,
  canonicalCcpLkgTransitionReceiptJsonV1,
  canonicalCcpPromotionDecisionJsonV1,
  ccpLkgStateDigestV1,
  ccpLkgTransitionReceiptDigestV1,
  ccpPromotionDecisionDigestV1,
  makeCcpLkgStateV1,
  makeCcpPromotionDecisionV1,
  parseCcpLkgStateV1,
  parseCcpLkgTransitionReceiptV1,
  parseCcpPromotionDecisionReceiptV1,
  promoteCcpLkgV1,
  restoreCcpLkgV1,
  verifyCcpLkgStateV1,
  verifyCcpLkgTransitionReceiptV1,
  verifyCcpPromotionDecisionReceiptV1,
  CCP_LKG_TRANSITION_KINDS_V1,
  CCP_LKG_TRANSITION_SCHEMA_V1,
  CCP_PROMOTION_DECISION_SCHEMA_V1,
  CCP_PROMOTION_DISPOSITIONS_V1,
  CCP_PROMOTION_REASON_CODES_V1,
  type CcpLkgStateInputV1,
  type CcpPromotionDecisionReceiptV1,
} from "../packages/contracts/src/ccp-lkg-restore.js";
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

// The fixture pointers: the pre-promotion LKG (the train head) and the
// candidate head the promotion advances to.
const LKG_BEFORE = digest("b");
const LKG_AFTER = digest("c");

// Byte-stability bindings: digests of the closed receipts produced from the
// merge fixtures. Any drift in the sealed bytes changes these values.
const GREEN_STATE_BEFORE_DIGEST = "2b57455f88f3e219bc06bfa7e45463a02c2ef6098d132a10699973578270d73e";
const GREEN_STATE_AFTER_DIGEST = "09b339312eadb786233e3c89bbaae7185cb86d0703648d8cc99de853e026d90c";
const GREEN_DECISION_DIGEST = "57b13e2e83ed6150e4ad4dcf45ae65d753fead03ae732fd7999c316cdabfb19d";
const FAILED_DECISION_DIGEST = "f3217622ce1c79066e9b4ac7cff4a74cbebe566b48e9db70d4fd7de75eaa3235";
const GREEN_PROMOTE_RECEIPT_DIGEST = "ae6c9d0996262a8c87d0777c2171579cd7a01f270870c44f6b90a347467be2c2";
const GREEN_RESTORE_RECEIPT_DIGEST = "e5340e5932389ebb61a2cc924b6034c48aed81643f100310c57fffe426c08c4b";

/** Rehash a forged promotion decision with its own domain; used only to build rehashed forgeries. */
function rehashPromotionDecision(record: Record<string, unknown>): void {
  const { decisionDigest: _decisionDigest, ...unsigned } = record;
  record.decisionDigest = ccpDigestDomainV1(CCP_PROMOTION_DECISION_SCHEMA_V1, unsigned);
}

/** Rehash a forged transition receipt with its own domain; used only to build rehashed forgeries. */
function rehashLkgTransition(record: Record<string, unknown>): void {
  const { transitionDigest: _transitionDigest, ...unsigned } = record;
  record.transitionDigest = ccpDigestDomainV1(CCP_LKG_TRANSITION_SCHEMA_V1, unsigned);
}

test("CCP-PSAI52-LKG-001 the promotion decision is independent and bounded; green evidence promotes", () => {
  const green = fixture("green");
  const trainReceipt = evaluateCcpTrainGateV1(green.candidate, green.context);
  const tupleLock = lockCcpVerificationTupleV1(green.tuple);
  const stateBefore = makeCcpLkgStateV1(green.lkg as CcpLkgStateInputV1);

  const decision = makeCcpPromotionDecisionV1({
    trainReceipt,
    tupleLock,
    promoterId: green.promoterId,
    lkgBeforeDigest: stateBefore.lkgDigest,
    lkgGenerationBefore: stateBefore.generation,
  });
  const decisionAgain = makeCcpPromotionDecisionV1({
    trainReceipt,
    tupleLock,
    promoterId: green.promoterId,
    lkgBeforeDigest: stateBefore.lkgDigest,
    lkgGenerationBefore: stateBefore.generation,
  });

  // Deterministic and digest-bound over the full evidence.
  assert.equal(
    canonicalCcpPromotionDecisionJsonV1(decision),
    canonicalCcpPromotionDecisionJsonV1(decisionAgain),
  );
  assert.equal(ccpPromotionDecisionDigestV1(decision), ccpPromotionDecisionDigestV1(decisionAgain));
  assert.equal(ccpPromotionDecisionDigestV1(decision), GREEN_DECISION_DIGEST);

  assert.equal(Object.isFrozen(decision), true);
  assert.deepEqual([...CCP_PROMOTION_DISPOSITIONS_V1], ["PROMOTED", "HOLD"]);
  assert.deepEqual([...CCP_LKG_TRANSITION_KINDS_V1], ["PROMOTE", "RESTORE"]);
  assert.equal(CCP_PROMOTION_REASON_CODES_V1.includes("UNAUTHORIZED_PROMOTER"), true);

  // The green evidence is complete and the promoter is an independent
  // identity: the decision is PROMOTED, yet it is never a merge
  // authorization.
  assert.equal(decision.disposition, "PROMOTED");
  assert.equal(decision.reasonCode, "PROMOTED_EVIDENCE_COMPLETE");
  assert.equal(decision.lkgBeforeDigest, LKG_BEFORE);
  assert.equal(decision.lkgGenerationBefore, 1);
  assert.equal(decision.lkgAfterDigest, LKG_AFTER);
  assert.equal(decision.mergeAuthorized, false);

  // Only an atomic transition may move the pointer, and it does so
  // single-step from the exact state the decision covers.
  const transition = promoteCcpLkgV1(stateBefore, decision);
  assert.equal(transition.state.lkgDigest, LKG_AFTER);
  assert.equal(transition.state.generation, 2);
  assert.equal(ccpLkgStateDigestV1(stateBefore), GREEN_STATE_BEFORE_DIGEST);
  assert.equal(ccpLkgStateDigestV1(transition.state), GREEN_STATE_AFTER_DIGEST);
  assert.notEqual(verifyCcpLkgStateV1(transition.state), null);

  // The transition receipt carries explicit before/after bindings to real
  // LKG states.
  const receipt = transition.receipt;
  assert.equal(Object.isFrozen(receipt), true);
  assert.equal(receipt.transitionKind, "PROMOTE");
  assert.equal(receipt.beforeDigest, LKG_BEFORE);
  assert.equal(receipt.afterDigest, LKG_AFTER);
  assert.equal(receipt.stateDigestBefore, stateBefore.stateDigest);
  assert.equal(receipt.stateDigestAfter, transition.state.stateDigest);
  assert.equal(receipt.generationBefore, 1);
  assert.equal(receipt.generationAfter, 2);
  assert.equal(receipt.boundDecisionDigest, decision.decisionDigest);
  assert.equal(receipt.regressionLockDigest, null);
  assert.notEqual(verifyCcpLkgTransitionReceiptV1(receipt), null);
  assert.equal(ccpLkgTransitionReceiptDigestV1(receipt), GREEN_PROMOTE_RECEIPT_DIGEST);
});

test("CCP-PSAI52-LKG-002 every held decision projects zero unauthorized merge", () => {
  const green = fixture("green");
  const failed = fixture("failed-promotion");
  const stateBefore = makeCcpLkgStateV1(green.lkg as CcpLkgStateInputV1);
  const baseDecision = {
    trainReceipt: evaluateCcpTrainGateV1(green.candidate, green.context),
    promoterId: green.promoterId,
    lkgBeforeDigest: LKG_BEFORE,
    lkgGenerationBefore: 1,
  };

  // The failed regression tuple holds the decision: the lock is incomplete.
  const failedDecision = makeCcpPromotionDecisionV1({
    ...baseDecision,
    tupleLock: lockCcpVerificationTupleV1(failed.tuple),
  });
  assert.equal(failedDecision.disposition, "HOLD");
  assert.equal(failedDecision.reasonCode, "LOCK_NOT_COMPLETE");
  assert.equal(failedDecision.lkgAfterDigest, failedDecision.lkgBeforeDigest);
  assert.equal(failedDecision.mergeAuthorized, false);
  assert.equal(ccpPromotionDecisionDigestV1(failedDecision), FAILED_DECISION_DIGEST);
  assert.notEqual(verifyCcpPromotionDecisionReceiptV1(failedDecision), null);

  // A held decision cannot move the pointer at all.
  assert.throws(
    () => promoteCcpLkgV1(stateBefore, failedDecision),
    /CCP_LKG_TRANSITION_SCHEMA_DENIED/,
  );

  // First failure wins across the remaining hold reasons; every held
  // decision still projects no pointer change and never authorizes a merge.
  const ineligbileReceipt = evaluateCcpTrainGateV1({
    ...(structuredClone(green.candidate) as Record<string, unknown>),
    riskClass: "risk:malicious",
  }, green.context);
  const holds: { reasonCode: string; decision: CcpPromotionDecisionReceiptV1 }[] = [
    {
      reasonCode: "EVIDENCE_IDENTITY_MISMATCH",
      decision: makeCcpPromotionDecisionV1({
        ...baseDecision,
        tupleLock: lockCcpVerificationTupleV1({
          ...(structuredClone(green.tuple) as Record<string, unknown>),
          ledgerId: "ledger:other",
        }),
      }),
    },
    {
      reasonCode: "INELIGIBLE_TRAIN_RECEIPT",
      decision: makeCcpPromotionDecisionV1({
        ...baseDecision,
        trainReceipt: ineligbileReceipt,
        tupleLock: lockCcpVerificationTupleV1(green.tuple),
      }),
    },
    {
      reasonCode: "HEAD_ALREADY_LKG",
      decision: makeCcpPromotionDecisionV1({
        ...baseDecision,
        tupleLock: lockCcpVerificationTupleV1(green.tuple),
        lkgBeforeDigest: LKG_AFTER,
      }),
    },
    {
      reasonCode: "VERIFICATION_PRECEDES_CANDIDATE",
      decision: makeCcpPromotionDecisionV1({
        ...baseDecision,
        tupleLock: lockCcpVerificationTupleV1({
          ...(structuredClone(green.tuple) as Record<string, unknown>),
          logicalAtMs: 100,
        }),
      }),
    },
  ];
  for (const hold of holds) {
    assert.equal(hold.decision.disposition, "HOLD");
    assert.equal(hold.decision.reasonCode, hold.reasonCode);
    assert.equal(hold.decision.lkgAfterDigest, hold.decision.lkgBeforeDigest);
    assert.equal(hold.decision.mergeAuthorized, false);
    assert.notEqual(verifyCcpPromotionDecisionReceiptV1(hold.decision), null);
  }
});

test("CCP-PSAI52-LKG-003 a failed re-verification restores the exact pre-promotion head", () => {
  const green = fixture("green");
  const failed = fixture("failed-promotion");
  const trainReceipt = evaluateCcpTrainGateV1(green.candidate, green.context);
  const greenLock = lockCcpVerificationTupleV1(green.tuple);
  const failedLock = lockCcpVerificationTupleV1(failed.tuple);
  const stateBefore = makeCcpLkgStateV1(green.lkg as CcpLkgStateInputV1);
  const decision = makeCcpPromotionDecisionV1({
    trainReceipt,
    tupleLock: greenLock,
    promoterId: green.promoterId,
    lkgBeforeDigest: stateBefore.lkgDigest,
    lkgGenerationBefore: stateBefore.generation,
  });
  const promoted = promoteCcpLkgV1(stateBefore, decision);

  // The post-promotion state is exactly the promoted head; the failed tuple
  // is a complete re-verification of that head.
  const postPromotion = makeCcpLkgStateV1(failed.lkg as CcpLkgStateInputV1);
  assert.equal(ccpLkgStateDigestV1(postPromotion), ccpLkgStateDigestV1(promoted.state));
  assert.equal(postPromotion.lkgDigest, LKG_AFTER);
  assert.equal(postPromotion.generation, 2);
  assert.equal(failedLock.allClaimsPassed, false);
  assert.equal(failedLock.headDigest, postPromotion.lkgDigest);

  const restored = restoreCcpLkgV1(postPromotion, decision, failedLock);

  // Exact, not best-effort: the pointer returns to the decision's exact
  // before digest and advances one generation.
  assert.equal(restored.state.lkgDigest, LKG_BEFORE);
  assert.equal(restored.state.generation, 3);
  assert.notEqual(verifyCcpLkgStateV1(restored.state), null);

  // The RESTORE receipt binds the exact before/after states and the
  // regression lock that justified the restoration.
  const receipt = restored.receipt;
  assert.equal(receipt.transitionKind, "RESTORE");
  assert.equal(receipt.beforeDigest, LKG_AFTER);
  assert.equal(receipt.afterDigest, LKG_BEFORE);
  assert.equal(receipt.stateDigestBefore, postPromotion.stateDigest);
  assert.equal(receipt.stateDigestAfter, restored.state.stateDigest);
  assert.equal(receipt.generationBefore, 2);
  assert.equal(receipt.generationAfter, 3);
  assert.equal(receipt.boundDecisionDigest, decision.decisionDigest);
  assert.equal(receipt.regressionLockDigest, failedLock.lockDigest);
  assert.notEqual(verifyCcpLkgTransitionReceiptV1(receipt), null);
  assert.equal(ccpLkgTransitionReceiptDigestV1(receipt), GREEN_RESTORE_RECEIPT_DIGEST);

  // The restore is fail-closed over its inputs.
  const heldDecision = makeCcpPromotionDecisionV1({
    trainReceipt,
    tupleLock: failedLock,
    promoterId: green.promoterId,
    lkgBeforeDigest: stateBefore.lkgDigest,
    lkgGenerationBefore: stateBefore.generation,
  });
  // A regression lock with no failed claim cannot justify a restoration.
  assert.throws(
    () => restoreCcpLkgV1(postPromotion, decision, greenLock),
    /CCP_LKG_TRANSITION_SCHEMA_DENIED/,
  );
  // A held decision is not a restoration authority.
  assert.throws(
    () => restoreCcpLkgV1(postPromotion, heldDecision, failedLock),
    /CCP_LKG_TRANSITION_SCHEMA_DENIED/,
  );
  // A restore at the wrong state denies.
  assert.throws(
    () => restoreCcpLkgV1(stateBefore, decision, failedLock),
    /CCP_LKG_TRANSITION_SCHEMA_DENIED/,
  );
  // A regression lock about a different head denies.
  const wrongHeadLock = lockCcpVerificationTupleV1({
    ...(structuredClone(failed.tuple) as Record<string, unknown>),
    headDigest: digest("d"),
  });
  assert.throws(
    () => restoreCcpLkgV1(postPromotion, decision, wrongHeadLock),
    /CCP_LKG_TRANSITION_SCHEMA_DENIED/,
  );
  // A regression lock with different candidate payload or delivery identity
  // is not evidence for the promoted candidate.
  const wrongPayloadLock = lockCcpVerificationTupleV1({
    ...(structuredClone(failed.tuple) as Record<string, unknown>),
    payloadDigest: digest("4"),
  });
  assert.throws(
    () => restoreCcpLkgV1(postPromotion, decision, wrongPayloadLock),
    /CCP_LKG_TRANSITION_SCHEMA_DENIED/,
  );
  // A regression lock from a different ledger denies.
  const wrongLedgerLock = lockCcpVerificationTupleV1({
    ...(structuredClone(failed.tuple) as Record<string, unknown>),
    ledgerId: "ledger:other",
  });
  assert.throws(
    () => restoreCcpLkgV1(postPromotion, decision, wrongLedgerLock),
    /CCP_LKG_TRANSITION_SCHEMA_DENIED/,
  );
});

test("CCP-PSAI52-LKG-004 no candidate or verification result can self-promote", () => {
  const green = fixture("green");
  const trainReceipt = evaluateCcpTrainGateV1(green.candidate, green.context);
  const tupleLock = lockCcpVerificationTupleV1(green.tuple);
  const base = {
    trainReceipt,
    tupleLock,
    lkgBeforeDigest: LKG_BEFORE,
    lkgGenerationBefore: 1,
  };

  // The promoter must live in its own closed namespace: the candidate's
  // delivery identity and the verifier identity cannot name themselves as
  // promoter (they deny at the pattern, before any decision exists).
  assert.throws(
    () => makeCcpPromotionDecisionV1({ ...base, promoterId: trainReceipt.candidate.deliveryId }),
    /CCP_PROMOTION_DECISION_SCHEMA_DENIED/,
  );
  assert.throws(
    () => makeCcpPromotionDecisionV1({ ...base, promoterId: tupleLock.verifierId }),
    /CCP_PROMOTION_DECISION_SCHEMA_DENIED/,
  );
  assert.throws(
    () => makeCcpPromotionDecisionV1({ ...base, promoterId: "promoter:ab" }),
    /CCP_PROMOTION_DECISION_SCHEMA_DENIED/,
  );

  const legitimate = makeCcpPromotionDecisionV1({ ...base, promoterId: green.promoterId });

  const denyForged = (mutate: (record: Record<string, unknown>) => void): void => {
    const record = structuredClone(legitimate) as unknown as Record<string, unknown>;
    mutate(record);
    rehashPromotionDecision(record);
    assert.throws(
      () => parseCcpPromotionDecisionReceiptV1(record),
      /CCP_PROMOTION_DECISION_SCHEMA_DENIED/,
    );
    assert.equal(verifyCcpPromotionDecisionReceiptV1(record), null);
  };

  // Forge a merge authorization on the decision: the closed field is
  // always false and never carries true.
  denyForged((record) => {
    record.mergeAuthorized = true;
  });

  // Forge a HOLD disposition over promoting evidence: the re-derived
  // decision drifts.
  denyForged((record) => {
    record.disposition = "HOLD";
  });

  // Forge the after pointer of a PROMOTED decision: the re-derived after
  // digest drifts.
  denyForged((record) => {
    record.lkgAfterDigest = digest("x");
  });

  // Tamper with the sealed embedded tuple lock: the embedded lock digest
  // no longer binds the carried bytes.
  denyForged((record) => {
    const lock = record.tupleLock as Record<string, unknown>;
    (lock.claims as Record<string, unknown>[])[1]!.outcome = "FAILED";
  });

  // Tamper with the sealed embedded train receipt: the embedded receipt
  // digest no longer binds the carried bytes.
  denyForged((record) => {
    const receipt = record.trainReceipt as Record<string, unknown>;
    receipt.disposition = "INELIGIBLE";
    receipt.reasonCode = "MALICIOUS_RISK_CLASS";
    (receipt.eligibility as Record<string, unknown>).mergeTrainEligible = false;
  });

  // Tamper with the decision seal without rehashing: the carried digest no
  // longer binds the bytes.
  const untamperedDigest = legitimate.decisionDigest;
  const tampered = structuredClone(legitimate) as unknown as Record<string, unknown>;
  tampered.disposition = "HOLD";
  assert.throws(() => parseCcpPromotionDecisionReceiptV1(tampered), /CCP_PROMOTION_DECISION_SCHEMA_DENIED/);
  assert.equal(verifyCcpPromotionDecisionReceiptV1(tampered), null);
  assert.equal(untamperedDigest, GREEN_DECISION_DIGEST);
});

test("CCP-PSAI52-LKG-005 malformed receipts and forged transitions deny on read-back", () => {
  const green = fixture("green");
  const failed = fixture("failed-promotion");
  const trainReceipt = evaluateCcpTrainGateV1(green.candidate, green.context);
  const greenLock = lockCcpVerificationTupleV1(green.tuple);
  const failedLock = lockCcpVerificationTupleV1(failed.tuple);
  const stateBefore = makeCcpLkgStateV1(green.lkg as CcpLkgStateInputV1);
  const decision = makeCcpPromotionDecisionV1({
    trainReceipt,
    tupleLock: greenLock,
    promoterId: green.promoterId,
    lkgBeforeDigest: stateBefore.lkgDigest,
    lkgGenerationBefore: stateBefore.generation,
  });
  const promoted = promoteCcpLkgV1(stateBefore, decision);
  const postPromotion = makeCcpLkgStateV1(failed.lkg as CcpLkgStateInputV1);
  const restored = restoreCcpLkgV1(postPromotion, decision, failedLock);

  // Malformed inputs deny before any receipt exists.
  assert.throws(
    () => makeCcpPromotionDecisionV1({
      trainReceipt,
      tupleLock: greenLock,
      promoterId: green.promoterId,
      lkgBeforeDigest: "no-digest",
      lkgGenerationBefore: 1,
    }),
    /CCP_PROMOTION_DECISION_SCHEMA_DENIED/,
  );
  assert.throws(
    () => makeCcpPromotionDecisionV1({
      trainReceipt,
      tupleLock: greenLock,
      promoterId: green.promoterId,
      lkgBeforeDigest: LKG_BEFORE,
      lkgGenerationBefore: 0,
    }),
    /CCP_PROMOTION_DECISION_SCHEMA_DENIED/,
  );
  const stateInput = green.lkg as CcpLkgStateInputV1;
  assert.throws(
    () => makeCcpLkgStateV1({ ...stateInput, generation: 0 }),
    /CCP_LKG_STATE_SCHEMA_DENIED/,
  );
  assert.throws(
    () => makeCcpLkgStateV1({ ...stateInput, componentId: "component:unknown" }),
    /CCP_LKG_STATE_SCHEMA_DENIED/,
  );
  assert.throws(() => ccpLkgStateDigestV1(42), /CCP_LKG_STATE_SCHEMA_DENIED/);
  assert.throws(() => canonicalCcpLkgTransitionReceiptJsonV1("no-receipt"), /CCP_LKG_TRANSITION_SCHEMA_DENIED/);

  // Sealed states are closed: extra fields and a drifted digest deny.
  const sealedExtra = structuredClone(promoted.state) as unknown as Record<string, unknown>;
  sealedExtra.unexpectedField = true;
  assert.throws(() => parseCcpLkgStateV1(sealedExtra), /CCP_LKG_STATE_SCHEMA_DENIED/);
  const driftedState = structuredClone(promoted.state) as unknown as Record<string, unknown>;
  driftedState.stateDigest = digest("z");
  assert.throws(() => parseCcpLkgStateV1(driftedState), /CCP_LKG_STATE_SCHEMA_DENIED/);
  assert.equal(verifyCcpLkgStateV1(driftedState), null);

  // Sealed decisions are closed too.
  const decisionExtra = structuredClone(decision) as unknown as Record<string, unknown>;
  decisionExtra.unexpectedField = true;
  assert.throws(
    () => parseCcpPromotionDecisionReceiptV1(decisionExtra),
    /CCP_PROMOTION_DECISION_SCHEMA_DENIED/,
  );

  // Forged transitions deny: rehashed drift in the before/after bindings.
  const denyForgedTransition = (
    receipt: unknown,
    mutate: (record: Record<string, unknown>) => void,
  ): void => {
    const record = structuredClone(receipt) as Record<string, unknown>;
    mutate(record);
    rehashLkgTransition(record);
    assert.throws(
      () => parseCcpLkgTransitionReceiptV1(record),
      /CCP_LKG_TRANSITION_SCHEMA_DENIED/,
    );
    assert.equal(verifyCcpLkgTransitionReceiptV1(record), null);
  };

  // Swapped before/after pointer digests.
  denyForgedTransition(promoted.receipt, (record) => {
    const before = record.beforeDigest;
    record.beforeDigest = record.afterDigest;
    record.afterDigest = before;
  });
  // A non-atomic generation step.
  denyForgedTransition(promoted.receipt, (record) => {
    record.generationAfter = 3;
  });
  // A regression lock on a promotion.
  denyForgedTransition(promoted.receipt, (record) => {
    record.regressionLockDigest = failedLock.lockDigest;
  });
  // A trivial transition that moves nowhere.
  denyForgedTransition(promoted.receipt, (record) => {
    record.afterDigest = record.beforeDigest;
  });
  // A rehashed state digest that no real state carries.
  denyForgedTransition(promoted.receipt, (record) => {
    record.stateDigestAfter = digest("x");
  });
  // A restore without its regression lock.
  denyForgedTransition(restored.receipt, (record) => {
    record.regressionLockDigest = null;
  });
  // Swapped before/after on the restore receipt.
  denyForgedTransition(restored.receipt, (record) => {
    const before = record.beforeDigest;
    record.beforeDigest = record.afterDigest;
    record.afterDigest = before;
  });

  // Tamper with the sealed transition without rehashing: the carried
  // digest no longer binds the bytes.
  const untamperedDigest = promoted.receipt.transitionDigest;
  const tampered = structuredClone(promoted.receipt) as unknown as Record<string, unknown>;
  tampered.afterDigest = digest("0");
  assert.throws(() => parseCcpLkgTransitionReceiptV1(tampered), /CCP_LKG_TRANSITION_SCHEMA_DENIED/);
  assert.equal(verifyCcpLkgTransitionReceiptV1(tampered), null);
  assert.equal(untamperedDigest, GREEN_PROMOTE_RECEIPT_DIGEST);
});

test("CCP-PSAI52-LKG-006 legitimate receipts verify and canonical bytes are key-order independent", () => {
  const green = fixture("green");
  const failed = fixture("failed-promotion");
  const trainReceipt = evaluateCcpTrainGateV1(green.candidate, green.context);
  const greenLock = lockCcpVerificationTupleV1(green.tuple);
  const failedLock = lockCcpVerificationTupleV1(failed.tuple);
  const stateBefore = makeCcpLkgStateV1(green.lkg as CcpLkgStateInputV1);
  const decision = makeCcpPromotionDecisionV1({
    trainReceipt,
    tupleLock: greenLock,
    promoterId: green.promoterId,
    lkgBeforeDigest: stateBefore.lkgDigest,
    lkgGenerationBefore: stateBefore.generation,
  });
  const promoted = promoteCcpLkgV1(stateBefore, decision);
  const postPromotion = makeCcpLkgStateV1(failed.lkg as CcpLkgStateInputV1);
  const restored = restoreCcpLkgV1(postPromotion, decision, failedLock);

  assert.equal(verifyCcpPromotionDecisionReceiptV1(decision)?.decisionDigest, GREEN_DECISION_DIGEST);
  assert.equal(verifyCcpLkgStateV1(promoted.state)?.stateDigest, GREEN_STATE_AFTER_DIGEST);
  assert.equal(
    verifyCcpLkgTransitionReceiptV1(promoted.receipt)?.transitionDigest,
    GREEN_PROMOTE_RECEIPT_DIGEST,
  );
  assert.equal(
    verifyCcpLkgTransitionReceiptV1(restored.receipt)?.transitionDigest,
    GREEN_RESTORE_RECEIPT_DIGEST,
  );

  assert.equal(
    canonicalCcpPromotionDecisionJsonV1(Object.fromEntries(Object.entries(decision).reverse())),
    canonicalCcpPromotionDecisionJsonV1(decision),
  );
  assert.equal(
    ccpPromotionDecisionDigestV1(Object.fromEntries(Object.entries(decision).reverse())),
    ccpPromotionDecisionDigestV1(decision),
  );
  assert.equal(
    canonicalCcpLkgStateJsonV1(Object.fromEntries(Object.entries(promoted.state).reverse())),
    canonicalCcpLkgStateJsonV1(promoted.state),
  );
  assert.equal(
    ccpLkgStateDigestV1(Object.fromEntries(Object.entries(promoted.state).reverse())),
    ccpLkgStateDigestV1(promoted.state),
  );
  assert.equal(
    canonicalCcpLkgTransitionReceiptJsonV1(Object.fromEntries(Object.entries(promoted.receipt).reverse())),
    canonicalCcpLkgTransitionReceiptJsonV1(promoted.receipt),
  );
  assert.equal(
    ccpLkgTransitionReceiptDigestV1(Object.fromEntries(Object.entries(promoted.receipt).reverse())),
    ccpLkgTransitionReceiptDigestV1(promoted.receipt),
  );
  // Key order of the embedded evidence objects is irrelevant to the
  // canonical bytes.
  assert.equal(
    canonicalCcpPromotionDecisionJsonV1({
      ...decision,
      trainReceipt: Object.fromEntries(Object.entries(decision.trainReceipt).reverse()),
      tupleLock: Object.fromEntries(Object.entries(decision.tupleLock).reverse()),
    }),
    canonicalCcpPromotionDecisionJsonV1(decision),
  );
});