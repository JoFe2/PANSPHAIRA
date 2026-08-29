import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  UPDATE_PROMOTION_GATE_EXIT_CODES_V1,
  UPDATE_PROMOTION_GATE_NO_CAPABILITY_V1,
  UPDATE_PROMOTION_GATE_PHASE_V1,
  UPDATE_PROMOTION_GATE_SCHEMA_V1,
  UPDATE_PROMOTION_GATE_TRANSITION_V1,
  buildUpdatePromotionGateV1,
  parseUpdatePromotionGateV1,
  renderVerifiedUpdatePromotionGateV1,
  updatePromotionGateDigestV1,
  updatePromotionGateIdentityBoundaryDigestV1,
  verifyUpdatePromotionGateV1,
  type BuildUpdatePromotionGateOptionsV1,
  type UpdatePromotionGateContextV1,
  type UpdatePromotionGateV1,
} from "../packages/contracts/src/update-promotion-gate.js";
import {
  UPDATE_AXIS_NAMES_V1,
  updateTupleDigestV1,
} from "../packages/contracts/src/update-check-plan.js";

const SOURCE_TUPLE_DIGEST = "21dcfb4af804336ad0dfcd4804e3d617e3ba04291a69a26aba73bad756526ba4";
const CANDIDATE_TUPLE_DIGEST = "8f873e2a8c3dd819a2bcc68b4865c9e6f60f40fb1d20823054829e5758375088";
const IDENTITY_BOUNDARY_DIGEST = "de7599dddd73a8a2a2b64462366c2f90d7da04230c4a2b74bd845cc20f879f3e";
const CANDIDATE_ARTIFACT_DIGEST = "d11fd5d8a48ccf4646ddfbcba618dff6a04ca38f723cb794e6b728ce5728ce44";
const DECISION_DIGEST = "fa0590403a90a977e14c32e5596737428347ee11eca8904d4c0a4d39a3580370";
const OBSERVED_AT_MS = 1_787_612_400_205;
const CANDIDATE = "candidate:synthetic-001";
const UPDATER = "updater:fixture-only";
const ATTESTOR = "attestor:attestation-gate";
const VERIFIER_ID = "verifier:independent-readback";
const PROMOTER_ID = "promoter:promotion-gate";

const PINNED_CANDIDATE_TUPLE = {
  core: [{ componentId: "core:safe-guided", version: "1.1.0", digest: "1".repeat(64) }],
  packs: [{ componentId: "pack:general", version: "1.0.0", digest: "2".repeat(64) }],
  adapters: [{ componentId: "adapter:dev", version: "1.0.0", digest: "3".repeat(64) }],
  policies: [{ componentId: "policy:default", version: "2.0.0", digest: "4".repeat(64) }],
  schemas: [{ componentId: "schema:catalog", version: "1.0.0", digest: "5".repeat(64) }],
  generations: [{ componentId: "generation:safe-guided", version: "1.0.0", digest: "6".repeat(64) }],
} as const;

const verifiedFixture = JSON.parse(readFileSync("tests/fixtures/update-promotion-gate/verified-candidate.json", "utf8")) as UpdatePromotionGateV1;
const selfAttestedFixture = JSON.parse(readFileSync("tests/fixtures/update-promotion-gate/self-attested-candidate.json", "utf8")) as UpdatePromotionGateV1;

function context(value: UpdatePromotionGateV1 = verifiedFixture): UpdatePromotionGateContextV1 {
  return {
    expectedCandidateId: value.candidateId,
    expectedUpdaterId: value.updaterId,
    expectedSourceTupleDigest: value.sourceTupleDigest,
    expectedCandidateTuple: value.candidateTuple,
    expectedCandidateTupleDigest: value.candidateTupleDigest,
    expectedCandidateArtifactDigest: value.candidateArtifactDigest,
    expectedIdentityBoundaryDigest: value.identityBoundaryDigest,
    expectedVerifier: { verifierId: value.verifier.verifierId, verifierVersion: value.verifier.verifierVersion },
    expectedPromoterDecision: { decisionId: value.promoterDecision.decisionId, promoterId: value.promoterDecision.promoterId, decisionDigest: value.promoterDecision.decisionDigest },
    expectedObservedAtMs: value.observedAtMs,
  };
}

function optionsFrom(value: UpdatePromotionGateV1): BuildUpdatePromotionGateOptionsV1 {
  return {
    candidateId: value.candidateId,
    updaterId: value.updaterId,
    sourceTupleDigest: value.sourceTupleDigest,
    candidateTuple: value.candidateTuple,
    candidateArtifactDigest: value.candidateArtifactDigest,
    identityBoundaryDigest: value.identityBoundaryDigest,
    verifier: { schemaVersion: value.verifier.schemaVersion, verifierId: value.verifier.verifierId, verifierVersion: value.verifier.verifierVersion },
    promoterDecision: { schemaVersion: value.promoterDecision.schemaVersion, decisionId: value.promoterDecision.decisionId, promoterId: value.promoterDecision.promoterId, decisionDigest: value.promoterDecision.decisionDigest },
    observedAtMs: value.observedAtMs,
  };
}

function redigest(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  const value = { ...JSON.parse(JSON.stringify(verifiedFixture)), ...overrides } as Record<string, unknown>;
  value.promotionGateDigest = updatePromotionGateDigestV1(value);
  return value;
}

function assertDenied(value: unknown, reason: keyof typeof UPDATE_PROMOTION_GATE_EXIT_CODES_V1, ctx: UpdatePromotionGateContextV1 | undefined = context()): void {
  const result = verifyUpdatePromotionGateV1(value, ctx);
  assert.equal(result.outcome, "DENIED");
  assert.deepEqual(result.reasonCodes, [reason]);
  assert.equal(result.exitCode, UPDATE_PROMOTION_GATE_EXIT_CODES_V1[reason]);
  assert.ok(Object.isFrozen(result));
  assert.ok(Object.isFrozen(result.reasonCodes));
}

test("verified candidate proof binds the exact pinned six-axis tuple, artifact evidence, and independent verifier and promoter decision", () => {
  const value = verifiedFixture;
  assert.equal(value.schemaVersion, UPDATE_PROMOTION_GATE_SCHEMA_V1);
  assert.equal(value.transition, UPDATE_PROMOTION_GATE_TRANSITION_V1);
  assert.equal(value.phase, UPDATE_PROMOTION_GATE_PHASE_V1);
  assert.equal(value.candidateId, CANDIDATE);
  assert.equal(value.updaterId, UPDATER);
  assert.equal(value.sourceTupleDigest, SOURCE_TUPLE_DIGEST);
  assert.deepEqual(Object.keys(value.candidateTuple).sort(), [...UPDATE_AXIS_NAMES_V1].sort());
  assert.deepEqual(value.candidateTuple, PINNED_CANDIDATE_TUPLE);
  assert.equal(updateTupleDigestV1(value.candidateTuple), CANDIDATE_TUPLE_DIGEST);
  assert.equal(value.candidateTupleDigest, CANDIDATE_TUPLE_DIGEST);
  assert.equal(value.candidateArtifactDigest, CANDIDATE_ARTIFACT_DIGEST);
  assert.equal(value.identityBoundaryDigest, IDENTITY_BOUNDARY_DIGEST);
  assert.deepEqual(value.verifier, { schemaVersion: "chimpmaera.update/promotion-gate-verifier/v1", verifierId: VERIFIER_ID, verifierVersion: "1.0.0" });
  assert.deepEqual(value.promoterDecision, { schemaVersion: "chimpmaera.update/promotion-decision/v1", decisionId: "decision:promotion-gate", promoterId: PROMOTER_ID, decisionDigest: DECISION_DIGEST });
  assert.equal(value.capabilityIssued, UPDATE_PROMOTION_GATE_NO_CAPABILITY_V1);
  assert.equal(value.observedAtMs, OBSERVED_AT_MS);
  assert.equal(updatePromotionGateDigestV1(value), value.promotionGateDigest);
  assert.deepEqual(verifyUpdatePromotionGateV1(value, context(value)), { outcome: "VERIFIED", reasonCodes: ["PROMOTION_GATE_VERIFIED"], exitCode: 0 });
  assert.deepEqual(parseUpdatePromotionGateV1(readFileSync("tests/fixtures/update-promotion-gate/verified-candidate.json", "utf8"), context()), {
    outcome: "VERIFIED", reasonCodes: ["PROMOTION_GATE_VERIFIED"], exitCode: 0,
  });
});

test("rebuilding the proof is deterministic and the verified render claims no promotion authority", () => {
  const first = buildUpdatePromotionGateV1(optionsFrom(verifiedFixture));
  const second = buildUpdatePromotionGateV1(optionsFrom(verifiedFixture));
  assert.equal(first.promotionGateDigest, second.promotionGateDigest);
  assert.equal(first.promotionGateDigest, verifiedFixture.promotionGateDigest);
  assert.equal(first.candidateTupleDigest, CANDIDATE_TUPLE_DIGEST);
  assert.ok(Object.isFrozen(first));
  assert.ok(Object.isFrozen(first.candidateTuple));
  assert.ok(Object.isFrozen(first.verifier));
  assert.ok(Object.isFrozen(first.promoterDecision));
  const bytes = renderVerifiedUpdatePromotionGateV1(first, context(first));
  assert.equal(bytes, renderVerifiedUpdatePromotionGateV1(second, context(first)));
  for (const word of ["authorize", "credential", "token", "secret", "execute", "grant"]) {
    assert.equal(bytes.includes(word), false);
  }
});

test("missing independent context and tampered tuple, source, artifact, binding, boundary, verifier, and decision evidence deny", () => {
  const missingContext = verifyUpdatePromotionGateV1(verifiedFixture, undefined);
  assert.equal(missingContext.outcome, "DENIED");
  assert.deepEqual(missingContext.reasonCodes, ["INDEPENDENT_CONTEXT_DENIED"]);
  assertDenied(redigest({ candidateTuple: { ...PINNED_CANDIDATE_TUPLE, core: [{ componentId: "core:safe-guided", version: "1.2.0", digest: "1".repeat(64) }] } }), "TUPLE_MISMATCH_DENIED");
  assertDenied(redigest({ sourceTupleDigest: "0".repeat(64) }), "SOURCE_TUPLE_MISMATCH_DENIED");
  assertDenied(redigest({ candidateArtifactDigest: "0".repeat(64) }), "ARTIFACT_EVIDENCE_DENIED");
  assertDenied(redigest({ candidateId: "candidate:other-002" }), "CANDIDATE_BINDING_DENIED");
  assertDenied(redigest({ updaterId: "updater:other-002" }), "CANDIDATE_BINDING_DENIED");
  assertDenied(redigest({ identityBoundaryDigest: "0".repeat(64) }), "IDENTITY_BOUNDARY_DENIED");
  assertDenied(redigest({ verifier: { ...verifiedFixture.verifier, verifierVersion: "2.0.0" } }), "VERIFIER_MISMATCH_DENIED");
  assertDenied(redigest({ promoterDecision: { ...verifiedFixture.promoterDecision, decisionDigest: "0".repeat(64) } }), "PROMOTER_DECISION_MISMATCH_DENIED");
  assertDenied({ ...JSON.parse(JSON.stringify(verifiedFixture)), candidateArtifactDigest: "0".repeat(64) }, "DIGEST_MISMATCH_DENIED");
});

test("candidate and updater cannot self-attest, self-promote, or collide with the verifier or promoter", () => {
  assertDenied(selfAttestedFixture, "SELF_ATTESTATION_DENIED", context(selfAttestedFixture));
  assert.deepEqual(parseUpdatePromotionGateV1(readFileSync("tests/fixtures/update-promotion-gate/self-attested-candidate.json", "utf8"), context(selfAttestedFixture)), {
    outcome: "DENIED", reasonCodes: ["SELF_ATTESTATION_DENIED"], exitCode: 106,
  });
  const selfPromotingBoundary = updatePromotionGateIdentityBoundaryDigestV1({
    candidateSubjectId: CANDIDATE,
    updaterId: UPDATER,
    attestorId: ATTESTOR,
    verifierId: VERIFIER_ID,
    promoterId: "promoter:synthetic-001",
  });
  const selfPromoting = { ...JSON.parse(JSON.stringify(verifiedFixture)), promoterDecision: { ...verifiedFixture.promoterDecision, promoterId: "promoter:synthetic-001" }, identityBoundaryDigest: selfPromotingBoundary } as Record<string, unknown>;
  selfPromoting.promotionGateDigest = updatePromotionGateDigestV1(selfPromoting);
  assertDenied(selfPromoting, "SELF_PROMOTION_DENIED", context({ ...verifiedFixture, promoterDecision: { ...verifiedFixture.promoterDecision, promoterId: "promoter:synthetic-001" }, identityBoundaryDigest: selfPromotingBoundary } as UpdatePromotionGateV1));
  const collidingBoundary = updatePromotionGateIdentityBoundaryDigestV1({
    candidateSubjectId: CANDIDATE,
    updaterId: "updater:synthetic-001",
    attestorId: ATTESTOR,
    verifierId: VERIFIER_ID,
    promoterId: PROMOTER_ID,
  });
  const colliding = { ...JSON.parse(JSON.stringify(verifiedFixture)), updaterId: "updater:synthetic-001", identityBoundaryDigest: collidingBoundary } as Record<string, unknown>;
  colliding.promotionGateDigest = updatePromotionGateDigestV1(colliding);
  assertDenied(colliding, "ROLE_COLLISION_DENIED", context({ ...verifiedFixture, updaterId: "updater:synthetic-001", identityBoundaryDigest: collidingBoundary } as UpdatePromotionGateV1));
});

test("capability claims and observed-time drift deny", () => {
  assertDenied(redigest({ capabilityIssued: true }), "CAPABILITY_CLAIM_DENIED");
  assertDenied(redigest({ observedAtMs: OBSERVED_AT_MS + 1 }), "OBSERVED_TIME_MISMATCH_DENIED");
});

test("unknown fields, unsupported versions, invalid JSON, and malformed build fixtures deny fail-closed", () => {
  assertDenied({ ...redigest(), promote: true }, "SCHEMA_DENIED");
  assertDenied({ ...redigest(), schemaVersion: "chimpmaera.update/promotion-gate/v2" }, "UNSUPPORTED_CONTRACT_VERSION_DENIED");
  assert.deepEqual(parseUpdatePromotionGateV1("{not-json", context()).reasonCodes, ["INVALID_JSON_DENIED"]);
  assert.throws(() => buildUpdatePromotionGateV1({
    ...optionsFrom(verifiedFixture),
    verifier: { schemaVersion: "chimpmaera.update/promotion-gate-verifier/v1", verifierId: "verifier:attested", verifierVersion: "1.0.0" },
  }), /INVALID_PROMOTION_GATE_FIXTURE/);
  assert.throws(() => buildUpdatePromotionGateV1({ ...optionsFrom(verifiedFixture), candidateTuple: { ...PINNED_CANDIDATE_TUPLE, core: [] } }), /INVALID_PROMOTION_GATE_FIXTURE/);
});

test("proxy-backed inputs are rejected without evaluating attacker traps", () => {
  let traps = 0;
  const value = new Proxy(verifiedFixture, { get: () => { traps += 1; throw new Error("GET_TRAP"); }, ownKeys: () => { traps += 1; throw new Error("KEY_TRAP"); } });
  assertDenied(value, "SCHEMA_DENIED");
  assert.equal(traps, 0);
});