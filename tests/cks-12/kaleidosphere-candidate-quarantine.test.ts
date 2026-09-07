import assert from "node:assert/strict";
import test from "node:test";

import {
  ADJUDICATION_CHAIN_STAGES,
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
  pansphaira: "90512ba63587d10b4a833a7f31e1f91595531467",
  kaleidoSphere: "a".repeat(40),
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
    ["stale-head", withCandidateMutation((candidate) => { candidate.candidateHead = "d".repeat(40); }), "DENIED"],
  ];

  assert.deepEqual(
    cases.map(([name, candidate]) => [name, adjudicateCandidateV1({ candidate, releasedHeads: RELEASED_HEADS }).outcome]),
    cases.map(([name, , expected]) => [name, expected]),
  );
});

test("XRA-PS-02 AC03 receipt binds both released heads and every local chain stage", () => {
  const candidate = validCandidate();
  const adjudication = adjudicateCandidateV1({ candidate, releasedHeads: RELEASED_HEADS });
  assert.equal(adjudication.outcome, "ACCEPTED_BOUNDED");

  const receipt = createPairedAdjudicationReceiptV1({
    releasedHeads: RELEASED_HEADS,
    candidate,
    adjudication,
    stageDigests: Object.fromEntries(ADJUDICATION_CHAIN_STAGES.map((stage, index) => [stage, `${index + 1}`.repeat(64)])) as Record<typeof ADJUDICATION_CHAIN_STAGES[number], string>,
  });
  assert.deepEqual(verifyPairedAdjudicationReceiptV1(receipt), {
    outcome: "VERIFIED",
    receiptDigest: receipt.receiptDigest,
    releasedHeads: RELEASED_HEADS,
    chainStages: [...ADJUDICATION_CHAIN_STAGES],
    authority: "NONE",
    effect: "NONE",
  });

  const tampered = structuredClone(receipt) as Record<string, any>;
  tampered.releasedHeads.kaleidoSphere = "e".repeat(40);
  assert.equal(verifyPairedAdjudicationReceiptV1(tampered).outcome, "DENIED");

  const malformed = structuredClone(receipt) as Record<string, any>;
  malformed.candidate = null;
  assert.equal(verifyPairedAdjudicationReceiptV1(malformed).outcome, "DENIED");
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
});
