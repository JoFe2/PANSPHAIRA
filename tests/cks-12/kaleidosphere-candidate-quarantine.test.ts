import assert from "node:assert/strict";
import test from "node:test";

import {
  ADJUDICATION_CHAIN_STAGES,
  KALEIDOSPHERE_EXACT_RELEASED_HEAD_V1,
  PANSPHAIRA_EXACT_RELEASED_HEAD_V1,
  buildAuthoritativeAdjudicationInputs,
  candidateDigestV1,
  createCandidateV1,
  createPairedAdjudicationReceiptV1,
  adjudicateCandidateV1,
  verifyPairedAdjudicationReceiptV1,
  type CandidateV1,
  type ReleasedHeadsV1,
} from "../../src/cks-12/kaleidosphere-candidate-quarantine.js";

const RELEASED_HEADS: ReleasedHeadsV1 = Object.freeze({
  pansphaira: PANSPHAIRA_EXACT_RELEASED_HEAD_V1,
  kaleidoSphere: KALEIDOSPHERE_EXACT_RELEASED_HEAD_V1,
});

const validCandidate = (): CandidateV1 => createCandidateV1({
  releasedHeads: RELEASED_HEADS,
  kaleidoSphereVerdict: "ACCEPTED_BOUNDED",
});

const withCandidateMutation = (mutate: (candidate: Record<string, any>) => void): CandidateV1 => {
  const candidate = structuredClone(validCandidate()) as Record<string, any>;
  mutate(candidate);
  candidate.candidateDigest = candidateDigestV1(candidate as CandidateV1);
  return candidate as CandidateV1;
};

test("XRA-PS-02 AC01 independently reconstructs owner evidence and keeps the consumer verdict non-authoritative", () => {
  const candidate = validCandidate();
  const result = adjudicateCandidateV1({ candidate, releasedHeads: RELEASED_HEADS });

  assert.equal(result.outcome, "ACCEPTED_BOUNDED");
  assert.equal(result.authority, "NONE");
  assert.equal(result.capabilityDelta, "NONE");
  assert.equal(result.effect, "NONE");
  assert.equal(result.canonicalKnowledgeMutation, "NONE");
  assert.equal(result.kaleidoSphereVerdictAuthoritative, false);

  const consumerDenied = createCandidateV1({ releasedHeads: RELEASED_HEADS, kaleidoSphereVerdict: "DENIED" });
  assert.equal(adjudicateCandidateV1({ candidate: consumerDenied, releasedHeads: RELEASED_HEADS }).outcome, "ACCEPTED_BOUNDED");

  const authoritative = buildAuthoritativeAdjudicationInputs();
  assert.equal(result.authoritativeProjectionDigest, authoritative.projectionDigest);
  assert.equal(result.authoritativeSourceContractSha256, authoritative.sourceContractSha256);
});

test("XRA-PS-02 AC02 returns exact outcomes for positive, restricted-unknown, conflicting, forged, and stale cases", () => {
  const cases: Array<[string, CandidateV1, string]> = [
    ["positive", validCandidate(), "ACCEPTED_BOUNDED"],
    ["restricted-unknown", withCandidateMutation((candidate) => { candidate.unknown = true; candidate.kaleidoSphereVerdict = "UNKNOWN"; }), "RESTRICTED"],
    ["conflicting-counterevidence", withCandidateMutation((candidate) => {
      candidate.counterevidence = [{ evidenceId: "external-conflict", evidenceSha256: "b".repeat(64), reason: "CONTRADICTS_OWNER_EVIDENCE" }];
      candidate.kaleidoSphereVerdict = "RESTRICTED";
    }), "DENIED"],
    ["forged-candidate", withCandidateMutation((candidate) => { candidate.projectionDigest = "c".repeat(64); }), "DENIED"],
    ["stale-head", withCandidateMutation((candidate) => {
      candidate.releasedHeads = { pansphaira: RELEASED_HEADS.pansphaira, kaleidoSphere: "d".repeat(40) };
      candidate.kaleidoSphereHead = "d".repeat(40);
      candidate.candidateHead = "d".repeat(40);
    }), "DENIED"],
  ];

  assert.deepEqual(
    cases.map(([name, candidate]) => [name, adjudicateCandidateV1({ candidate, releasedHeads: RELEASED_HEADS }).outcome]),
    cases.map(([name, , expected]) => [name, expected]),
  );

  const staleEnvelope = { pansphaira: RELEASED_HEADS.pansphaira, kaleidoSphere: "e".repeat(40) };
  assert.equal(adjudicateCandidateV1({ candidate: validCandidate(), releasedHeads: staleEnvelope }).outcome, "DENIED");

  const arbitraryHeads: ReleasedHeadsV1 = { pansphaira: "1".repeat(40), kaleidoSphere: "2".repeat(40) };
  const arbitraryCandidate = createCandidateV1({ releasedHeads: arbitraryHeads, kaleidoSphereVerdict: "ACCEPTED_BOUNDED" });
  assert.equal(adjudicateCandidateV1({ candidate: arbitraryCandidate, releasedHeads: arbitraryHeads }).outcome, "DENIED");
});

test("XRA-PS-02 AC03 receipt binds both released heads and every local chain stage", () => {
  const candidate = validCandidate();
  const adjudication = adjudicateCandidateV1({ candidate, releasedHeads: RELEASED_HEADS });
  assert.equal(adjudication.outcome, "ACCEPTED_BOUNDED");

  const receipt = createPairedAdjudicationReceiptV1({
    releasedHeads: RELEASED_HEADS,
    candidate,
    adjudication,
  });
  assert.deepEqual(verifyPairedAdjudicationReceiptV1(receipt), {
    outcome: "VERIFIED",
    receiptDigest: receipt.receiptDigest,
    releasedHeads: RELEASED_HEADS,
    chainStages: [...ADJUDICATION_CHAIN_STAGES],
    authority: "NONE",
    effect: "NONE",
  });

  const creatorIncompleteCandidate = structuredClone(candidate) as Record<string, any>;
  delete creatorIncompleteCandidate.evidence;
  creatorIncompleteCandidate.candidateDigest = candidateDigestV1(creatorIncompleteCandidate as CandidateV1);
  const creatorIncompleteAdjudication = adjudicateCandidateV1({ candidate: creatorIncompleteCandidate, releasedHeads: RELEASED_HEADS });
  assert.equal(creatorIncompleteAdjudication.outcome, "DENIED");
  assert.throws(() => createPairedAdjudicationReceiptV1({
    releasedHeads: RELEASED_HEADS,
    candidate: creatorIncompleteCandidate as CandidateV1,
    adjudication: creatorIncompleteAdjudication,
  }), /XRA_PS_02_RECEIPT_INPUT_DENIED/);

  const tampered = structuredClone(receipt) as Record<string, any>;
  tampered.releasedHeads.kaleidoSphere = "e".repeat(40);
  assert.equal(verifyPairedAdjudicationReceiptV1(tampered).outcome, "DENIED");

  const malformed = structuredClone(receipt) as Record<string, any>;
  malformed.candidate = null;
  assert.equal(verifyPairedAdjudicationReceiptV1(malformed).outcome, "DENIED");

  const incompleteCandidate = structuredClone(receipt) as Record<string, any>;
  delete incompleteCandidate.candidate.evidence;
  assert.deepEqual(verifyPairedAdjudicationReceiptV1(incompleteCandidate), { outcome: "DENIED", reasonCodes: ["RECEIPT_DENIED"] });

  const incompleteAdjudication = structuredClone(receipt) as Record<string, any>;
  delete incompleteAdjudication.adjudication.reasonCodes;
  assert.deepEqual(verifyPairedAdjudicationReceiptV1(incompleteAdjudication), { outcome: "DENIED", reasonCodes: ["RECEIPT_DENIED"] });

  const forgedChain = structuredClone(receipt) as Record<string, any>;
  forgedChain.chain[0].digest = "f".repeat(64);
  assert.equal(verifyPairedAdjudicationReceiptV1(forgedChain).outcome, "DENIED");
});

test("XRA-PS-02 AC04 leaves canonical evidence, authority, capability, and effect unchanged", () => {
  const authoritativeBefore = buildAuthoritativeAdjudicationInputs();
  const candidate = validCandidate();
  const result = adjudicateCandidateV1({ candidate, releasedHeads: RELEASED_HEADS });
  const authoritativeAfter = buildAuthoritativeAdjudicationInputs();

  assert.equal(result.canonicalKnowledgeBeforeSha256, authoritativeBefore.canonicalKnowledgeSha256);
  assert.equal(result.canonicalKnowledgeAfterSha256, authoritativeAfter.canonicalKnowledgeSha256);
  assert.deepEqual(authoritativeAfter, authoritativeBefore);
  assert.equal(result.canonicalKnowledgeBeforeSha256, result.canonicalKnowledgeAfterSha256);
  assert.equal(result.authority, "NONE");
  assert.equal(result.capabilityDelta, "NONE");
  assert.equal(result.effect, "NONE");
});

test("XRA-PS-02 adjudication is fail-closed and does not invoke exotic candidate inputs", () => {
  let invocations = 0;
  const candidate = new Proxy(validCandidate(), {
    ownKeys: () => { invocations += 1; throw new Error("candidate trap"); },
    getPrototypeOf: () => { invocations += 1; throw new Error("candidate trap"); },
    getOwnPropertyDescriptor: () => { invocations += 1; throw new Error("candidate trap"); },
    get: () => { invocations += 1; throw new Error("candidate trap"); },
  });
  const result = adjudicateCandidateV1({ candidate, releasedHeads: RELEASED_HEADS });
  assert.equal(result.outcome, "DENIED");
  assert.equal(invocations, 0);

  const nestedProxyCandidate = structuredClone(validCandidate()) as Record<string, any>;
  nestedProxyCandidate.evidence[0] = new Proxy(nestedProxyCandidate.evidence[0], {
    ownKeys: () => { invocations += 1; throw new Error("nested proxy trap"); },
  });
  assert.equal(adjudicateCandidateV1({ candidate: nestedProxyCandidate, releasedHeads: RELEASED_HEADS }).outcome, "DENIED");
  assert.equal(invocations, 0);

  const accessorCandidate = structuredClone(validCandidate()) as Record<string, any>;
  Object.defineProperty(accessorCandidate.evidence[0], "evidenceId", {
    enumerable: true,
    get: () => { invocations += 1; throw new Error("accessor trap"); },
  });
  assert.equal(adjudicateCandidateV1({ candidate: accessorCandidate, releasedHeads: RELEASED_HEADS }).outcome, "DENIED");
  assert.equal(invocations, 0);

  const sharedReferenceCandidate = structuredClone(validCandidate()) as Record<string, any>;
  sharedReferenceCandidate.evidence.push(sharedReferenceCandidate.evidence[0]);
  assert.equal(adjudicateCandidateV1({ candidate: sharedReferenceCandidate, releasedHeads: RELEASED_HEADS }).outcome, "DENIED");
});
