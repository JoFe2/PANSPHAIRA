import assert from "node:assert/strict";
import test from "node:test";
import {
  UPDATE_APPLY_POSTCONDITION_EXIT_CODES_V1,
  UPDATE_APPLY_POSTCONDITION_REASON_ORDER_V1,
  UPDATE_APPLY_POSTCONDITION_SCHEMA_V1,
  renderUpdateApplyPostconditionDecisionV1,
  updateApplyPostconditionDigestV1,
  verifyUpdateApplyPostconditionV1,
  type UpdateApplyPostconditionContextV1,
  type UpdateApplyPostconditionEnvelopeV1,
} from "../packages/contracts/src/update-apply-postcondition.js";

const OBSERVED_AT_MS = 1_785_819_600_000;
const EVALUATION_TIME_MS = OBSERVED_AT_MS + 2_000;
const MAX_OBSERVATION_AGE_MS = 60_000;

const OPERATION_DIGEST = "1".repeat(64);
const TARGET_DIGEST = "2".repeat(64);
const LKG_DIGEST = "3".repeat(64);
const EXPECTED_TARGET_TUPLE_DIGEST = "4".repeat(64);
const EXPECTED_OWNER_STATE_DIGEST = "5".repeat(64);
const FORGED_TUPLE_DIGEST = "6".repeat(64);
const DIVERGENT_EXPECTED_DIGEST = "7".repeat(64);
const DIVERGENT_OPERATION_DIGEST = "8".repeat(64);
const TRUSTED_VERIFIER_ID = "verifier:independent-readback";
const TRUSTED_VERIFIER_VERSION = "1.0.0";
const OPERATION_SUBJECT_ID = "candidate:synthetic-001";

interface EnvelopeOverrides extends Partial<Omit<UpdateApplyPostconditionEnvelopeV1, "envelopeDigest">> {}

function baseEnvelope(overrides: EnvelopeOverrides = {}): Omit<UpdateApplyPostconditionEnvelopeV1, "envelopeDigest"> {
  return {
    schemaVersion: UPDATE_APPLY_POSTCONDITION_SCHEMA_V1,
    observationId: "postcondition:observation-001",
    operationDigest: OPERATION_DIGEST,
    targetDigest: TARGET_DIGEST,
    lkgDigest: LKG_DIGEST,
    expectedTargetTupleDigest: EXPECTED_TARGET_TUPLE_DIGEST,
    observedTargetTupleDigest: EXPECTED_TARGET_TUPLE_DIGEST,
    expectedOwnerStateDigest: EXPECTED_OWNER_STATE_DIGEST,
    observedOwnerStateDigest: EXPECTED_OWNER_STATE_DIGEST,
    residueCount: 0,
    verifierId: TRUSTED_VERIFIER_ID,
    verifierVersion: TRUSTED_VERIFIER_VERSION,
    observedAtMs: OBSERVED_AT_MS,
    ...overrides,
  };
}

function digestedEnvelope(overrides: EnvelopeOverrides = {}): UpdateApplyPostconditionEnvelopeV1 {
  const base = baseEnvelope(overrides);
  return {
    ...base,
    envelopeDigest: updateApplyPostconditionDigestV1(base as unknown as Record<string, unknown>, "envelopeDigest"),
  };
}

function fixture(overrides: EnvelopeOverrides = {}, contextOverrides: Partial<UpdateApplyPostconditionContextV1> = {}) {
  const envelope = digestedEnvelope(overrides);
  const context: UpdateApplyPostconditionContextV1 = {
    operationDigest: OPERATION_DIGEST,
    targetDigest: TARGET_DIGEST,
    lkgDigest: LKG_DIGEST,
    expectedTargetTupleDigest: EXPECTED_TARGET_TUPLE_DIGEST,
    expectedOwnerStateDigest: EXPECTED_OWNER_STATE_DIGEST,
    operationSubjectId: OPERATION_SUBJECT_ID,
    trustedVerifierId: TRUSTED_VERIFIER_ID,
    trustedVerifierVersion: TRUSTED_VERIFIER_VERSION,
    trustedEnvelopeDigest: envelope.envelopeDigest,
    evaluationTimeMs: EVALUATION_TIME_MS,
    maxObservationAgeMs: MAX_OBSERVATION_AGE_MS,
    ...contextOverrides,
  };
  return { envelope, context };
}

function reasons(decision: ReturnType<typeof verifyUpdateApplyPostconditionV1>): readonly string[] {
  return decision.reasonCodes;
}

test("exports the fixed ordered reason codes and exit codes", () => {
  assert.deepEqual(UPDATE_APPLY_POSTCONDITION_REASON_ORDER_V1, [
    "SCHEMA_DENIED",
    "UNSUPPORTED_CONTRACT_VERSION_DENIED",
    "INDEPENDENT_CONTEXT_DENIED",
    "DIGEST_MISMATCH_DENIED",
    "TUPLE_MISMATCH_DENIED",
    "OWNER_STATE_MISMATCH_DENIED",
    "RESIDUE_PRESENT_DENIED",
    "VERIFIER_BINDING_DENIED",
    "SELF_VERIFIER_DENIED",
    "OBSERVATION_TIME_DENIED",
  ]);
  assert.equal(UPDATE_APPLY_POSTCONDITION_EXIT_CODES_V1.POSTCONDITION_ACCEPTED, 0);
  assert.equal(UPDATE_APPLY_POSTCONDITION_EXIT_CODES_V1.SCHEMA_DENIED, 70);
  assert.equal(UPDATE_APPLY_POSTCONDITION_EXIT_CODES_V1.UNSUPPORTED_CONTRACT_VERSION_DENIED, 71);
  assert.equal(UPDATE_APPLY_POSTCONDITION_EXIT_CODES_V1.INDEPENDENT_CONTEXT_DENIED, 72);
  assert.equal(UPDATE_APPLY_POSTCONDITION_EXIT_CODES_V1.DIGEST_MISMATCH_DENIED, 73);
  assert.equal(UPDATE_APPLY_POSTCONDITION_EXIT_CODES_V1.TUPLE_MISMATCH_DENIED, 74);
  assert.equal(UPDATE_APPLY_POSTCONDITION_EXIT_CODES_V1.OWNER_STATE_MISMATCH_DENIED, 75);
  assert.equal(UPDATE_APPLY_POSTCONDITION_EXIT_CODES_V1.RESIDUE_PRESENT_DENIED, 76);
  assert.equal(UPDATE_APPLY_POSTCONDITION_EXIT_CODES_V1.VERIFIER_BINDING_DENIED, 77);
  assert.equal(UPDATE_APPLY_POSTCONDITION_EXIT_CODES_V1.SELF_VERIFIER_DENIED, 78);
  assert.equal(UPDATE_APPLY_POSTCONDITION_EXIT_CODES_V1.OBSERVATION_TIME_DENIED, 79);
});

test("canonical envelope digest is stable across key order and content bound", () => {
  const { envelope } = fixture();
  assert.equal(
    updateApplyPostconditionDigestV1(envelope as unknown as Record<string, unknown>, "envelopeDigest"),
    envelope.envelopeDigest,
  );
  const reordered: Record<string, unknown> = {
    observedAtMs: envelope.observedAtMs,
    verifierVersion: envelope.verifierVersion,
    envelopeDigest: envelope.envelopeDigest,
    verifierId: envelope.verifierId,
    residueCount: envelope.residueCount,
    observedOwnerStateDigest: envelope.observedOwnerStateDigest,
    expectedOwnerStateDigest: envelope.expectedOwnerStateDigest,
    observedTargetTupleDigest: envelope.observedTargetTupleDigest,
    expectedTargetTupleDigest: envelope.expectedTargetTupleDigest,
    lkgDigest: envelope.lkgDigest,
    targetDigest: envelope.targetDigest,
    operationDigest: envelope.operationDigest,
    observationId: envelope.observationId,
    schemaVersion: envelope.schemaVersion,
  };
  assert.equal(updateApplyPostconditionDigestV1(reordered, "envelopeDigest"), envelope.envelopeDigest);
  const altered = { ...envelope, residueCount: 1 };
  assert.notEqual(
    updateApplyPostconditionDigestV1(altered as unknown as Record<string, unknown>, "envelopeDigest"),
    envelope.envelopeDigest,
  );
});

test("exact independent target and owner readback with zero residue accepts the switch", () => {
  const { envelope, context } = fixture();
  const decision = verifyUpdateApplyPostconditionV1(envelope, context);
  assert.deepEqual(decision, {
    outcome: "ACCEPT_SWITCH",
    reasonCodes: ["POSTCONDITION_ACCEPTED"],
    exitCode: 0,
    rollbackTargetDigest: null,
    rollbackExecuted: false,
  });
  assert.ok(Object.isFrozen(decision));
});

test("observed target tuple mismatch requires exact LKG rollback without claiming execution", () => {
  const { envelope, context } = fixture({ observedTargetTupleDigest: FORGED_TUPLE_DIGEST });
  const decision = verifyUpdateApplyPostconditionV1(envelope, context);
  assert.equal(decision.outcome, "ROLLBACK_REQUIRED");
  assert.deepEqual(reasons(decision), ["TUPLE_MISMATCH_DENIED"]);
  assert.equal(decision.exitCode, 74);
  assert.equal(decision.rollbackTargetDigest, LKG_DIGEST);
  assert.equal(decision.rollbackExecuted, false);
});

test("observed owner-state mismatch requires exact LKG rollback", () => {
  const { envelope, context } = fixture({ observedOwnerStateDigest: FORGED_TUPLE_DIGEST });
  const decision = verifyUpdateApplyPostconditionV1(envelope, context);
  assert.equal(decision.outcome, "ROLLBACK_REQUIRED");
  assert.deepEqual(reasons(decision), ["OWNER_STATE_MISMATCH_DENIED"]);
  assert.equal(decision.exitCode, 75);
  assert.equal(decision.rollbackTargetDigest, LKG_DIGEST);
});

test("nonzero residue requires exact LKG rollback", () => {
  const { envelope, context } = fixture({ residueCount: 3 });
  const decision = verifyUpdateApplyPostconditionV1(envelope, context);
  assert.equal(decision.outcome, "ROLLBACK_REQUIRED");
  assert.deepEqual(reasons(decision), ["RESIDUE_PRESENT_DENIED"]);
  assert.equal(decision.exitCode, 76);
  assert.equal(decision.rollbackTargetDigest, LKG_DIGEST);
  assert.equal(decision.rollbackExecuted, false);
});

test("multiple mismatches emit the fixed ordered reasons and the first exit code", () => {
  const { envelope, context } = fixture({
    observedTargetTupleDigest: FORGED_TUPLE_DIGEST,
    observedOwnerStateDigest: DIVERGENT_EXPECTED_DIGEST,
    residueCount: 1,
  });
  const decision = verifyUpdateApplyPostconditionV1(envelope, context);
  assert.equal(decision.outcome, "ROLLBACK_REQUIRED");
  assert.deepEqual(reasons(decision), ["TUPLE_MISMATCH_DENIED", "OWNER_STATE_MISMATCH_DENIED", "RESIDUE_PRESENT_DENIED"]);
  assert.equal(decision.exitCode, 74);
  assert.equal(decision.rollbackTargetDigest, LKG_DIGEST);
});

test("expected digests diverging from the independent context deny without trusting the input", () => {
  const divergentExpected = fixture({ expectedTargetTupleDigest: DIVERGENT_EXPECTED_DIGEST });
  const decision = verifyUpdateApplyPostconditionV1(divergentExpected.envelope, divergentExpected.context);
  assert.equal(decision.outcome, "ROLLBACK_REQUIRED");
  assert.deepEqual(reasons(decision), ["INDEPENDENT_CONTEXT_DENIED"]);
  assert.equal(decision.exitCode, 72);
  assert.equal(decision.rollbackTargetDigest, LKG_DIGEST);

  const divergentOperation = fixture({ operationDigest: DIVERGENT_OPERATION_DIGEST });
  const operationDecision = verifyUpdateApplyPostconditionV1(divergentOperation.envelope, divergentOperation.context);
  assert.deepEqual(reasons(operationDecision), ["INDEPENDENT_CONTEXT_DENIED"]);
});

test("verifier substitution with unchanged envelope digest denies", () => {
  const { envelope, context } = fixture();
  const substituted = { ...envelope, verifierId: "verifier:impostor-001" };
  const decision = verifyUpdateApplyPostconditionV1(substituted, context);
  assert.equal(decision.outcome, "ROLLBACK_REQUIRED");
  assert.deepEqual(reasons(decision), ["DIGEST_MISMATCH_DENIED", "VERIFIER_BINDING_DENIED"]);
  assert.equal(decision.exitCode, 73);
  assert.equal(decision.rollbackTargetDigest, LKG_DIGEST);
});

test("fully re-digested forged binding denies against the trusted verifier binding", () => {
  const trueEnvelope = digestedEnvelope({ observedTargetTupleDigest: FORGED_TUPLE_DIGEST });
  const context: UpdateApplyPostconditionContextV1 = {
    operationDigest: OPERATION_DIGEST,
    targetDigest: TARGET_DIGEST,
    lkgDigest: LKG_DIGEST,
    expectedTargetTupleDigest: EXPECTED_TARGET_TUPLE_DIGEST,
    expectedOwnerStateDigest: EXPECTED_OWNER_STATE_DIGEST,
    operationSubjectId: OPERATION_SUBJECT_ID,
    trustedVerifierId: TRUSTED_VERIFIER_ID,
    trustedVerifierVersion: TRUSTED_VERIFIER_VERSION,
    trustedEnvelopeDigest: trueEnvelope.envelopeDigest,
    evaluationTimeMs: EVALUATION_TIME_MS,
    maxObservationAgeMs: MAX_OBSERVATION_AGE_MS,
  };
  // The forger rewrites the observation to the expected value and recomputes the
  // canonical envelope digest, so the binding is internally consistent but
  // differs from the trusted verifier's published binding.
  const forgedEnvelope = digestedEnvelope({ observedTargetTupleDigest: EXPECTED_TARGET_TUPLE_DIGEST });
  assert.notEqual(forgedEnvelope.envelopeDigest, trueEnvelope.envelopeDigest);
  const decision = verifyUpdateApplyPostconditionV1(forgedEnvelope, context);
  assert.equal(decision.outcome, "ROLLBACK_REQUIRED");
  assert.deepEqual(reasons(decision), ["DIGEST_MISMATCH_DENIED"]);
  assert.equal(decision.exitCode, 73);
  assert.equal(decision.rollbackTargetDigest, LKG_DIGEST);
});

test("self-verifier identity denies even when the binding digest is trusted", () => {
  const selfEnvelope = digestedEnvelope({ verifierId: "verifier:synthetic-001" });
  const context: UpdateApplyPostconditionContextV1 = {
    operationDigest: OPERATION_DIGEST,
    targetDigest: TARGET_DIGEST,
    lkgDigest: LKG_DIGEST,
    expectedTargetTupleDigest: EXPECTED_TARGET_TUPLE_DIGEST,
    expectedOwnerStateDigest: EXPECTED_OWNER_STATE_DIGEST,
    operationSubjectId: OPERATION_SUBJECT_ID,
    trustedVerifierId: "verifier:synthetic-001",
    trustedVerifierVersion: TRUSTED_VERIFIER_VERSION,
    trustedEnvelopeDigest: selfEnvelope.envelopeDigest,
    evaluationTimeMs: EVALUATION_TIME_MS,
    maxObservationAgeMs: MAX_OBSERVATION_AGE_MS,
  };
  const decision = verifyUpdateApplyPostconditionV1(selfEnvelope, context);
  assert.equal(decision.outcome, "ROLLBACK_REQUIRED");
  assert.deepEqual(reasons(decision), ["SELF_VERIFIER_DENIED"]);
  assert.equal(decision.exitCode, 78);
  assert.equal(decision.rollbackTargetDigest, LKG_DIGEST);
});

test("unknown fields deny fail-closed, including execution and promotion fields", () => {
  for (const extra of [
    { note: "rollback now" },
    { executionCommand: "rm -rf /" },
    { promoteOnSuccess: true },
    { rollbackPath: "/etc/passwd" },
    { evidenceUrl: "https://evil.example/artifact" },
    { secret: "top-secret" },
  ]) {
    const { envelope, context } = fixture();
    const decision = verifyUpdateApplyPostconditionV1({ ...envelope, ...extra }, context);
    assert.equal(decision.outcome, "ROLLBACK_REQUIRED");
    assert.deepEqual(reasons(decision), ["SCHEMA_DENIED"], JSON.stringify(extra));
    assert.equal(decision.exitCode, 70);
  }
});

test("claim-bearing identifiers, secrets, paths, free text and URLs deny", () => {
  const idCases: EnvelopeOverrides[] = [
    { observationId: "postcondition:rollback now to /etc/passwd https://evil.example" },
    { observationId: "postcondition:" },
    { verifierId: "verifier:independent readback v2" },
    { verifierId: "verifier:https://evil.example/verifier" },
    { verifierId: "verifier:" },
  ];
  for (const override of idCases) {
    const { envelope, context } = fixture(override);
    const decision = verifyUpdateApplyPostconditionV1(envelope, context);
    assert.deepEqual(reasons(decision), ["SCHEMA_DENIED"], JSON.stringify(override));
    assert.equal(decision.exitCode, 70);
  }
  // A malformed subject identifier inside the context fails closed as an
  // untrusted independent context rather than a schema denial of the envelope.
  const { envelope, context } = fixture();
  const badContext = { ...context, operationSubjectId: "not-a-candidate-id" };
  const badContextDecision = verifyUpdateApplyPostconditionV1(envelope, badContext);
  assert.deepEqual(reasons(badContextDecision), ["INDEPENDENT_CONTEXT_DENIED"]);
  assert.equal(badContextDecision.rollbackTargetDigest, null);
});

test("negative, fractional and non-finite or unsafe residue counts deny without throwing", () => {
  const { envelope, context } = fixture();
  for (const residueCount of [
    -1,
    0.5,
    Number.NaN,
    Number.NEGATIVE_INFINITY,
    Number.POSITIVE_INFINITY,
    Number.MIN_SAFE_INTEGER - 1,
    Number.MAX_SAFE_INTEGER + 1,
  ]) {
    const malformed = { ...envelope, residueCount };
    let decision: ReturnType<typeof verifyUpdateApplyPostconditionV1> | undefined;
    assert.doesNotThrow(() => { decision = verifyUpdateApplyPostconditionV1(malformed, context); }, String(residueCount));
    assert.ok(decision);
    assert.equal(decision.outcome, "ROLLBACK_REQUIRED");
    assert.deepEqual(reasons(decision), ["SCHEMA_DENIED"], String(residueCount));
    assert.equal(decision.exitCode, 70);
  }
});

test("negative zero residue is rejected at the closed input boundary", () => {
  const { envelope, context } = fixture();
  const malformed = { ...envelope, residueCount: -0 };
  assert.equal(Object.is(malformed.residueCount, -0), true);
  assert.deepEqual(reasons(verifyUpdateApplyPostconditionV1(malformed, context)), ["SCHEMA_DENIED"]);
});

test("negative zero is rejected for every envelope and independent-context time field", () => {
  const observedAtFixture = fixture();
  const observedAt = { ...observedAtFixture.envelope, observedAtMs: -0 };
  assert.deepEqual(reasons(verifyUpdateApplyPostconditionV1(observedAt, observedAtFixture.context)), ["SCHEMA_DENIED"]);

  const evaluationTimeFixture = fixture();
  const evaluationTime = { ...evaluationTimeFixture.context, evaluationTimeMs: -0 };
  assert.deepEqual(reasons(verifyUpdateApplyPostconditionV1(evaluationTimeFixture.envelope, evaluationTime)), ["INDEPENDENT_CONTEXT_DENIED"]);

  const maxAgeFixture = fixture();
  const maxAge = { ...maxAgeFixture.context, maxObservationAgeMs: -0 };
  assert.deepEqual(reasons(verifyUpdateApplyPostconditionV1(maxAgeFixture.envelope, maxAge)), ["INDEPENDENT_CONTEXT_DENIED"]);
});

test("invalid observation time denies fail-closed", () => {
  const future = fixture({ observedAtMs: EVALUATION_TIME_MS + 1_000 });
  const futureDecision = verifyUpdateApplyPostconditionV1(future.envelope, future.context);
  assert.deepEqual(reasons(futureDecision), ["OBSERVATION_TIME_DENIED"]);
  assert.equal(futureDecision.exitCode, 79);

  const stale = fixture({ observedAtMs: EVALUATION_TIME_MS - MAX_OBSERVATION_AGE_MS - 1 });
  const staleDecision = verifyUpdateApplyPostconditionV1(stale.envelope, stale.context);
  assert.deepEqual(reasons(staleDecision), ["OBSERVATION_TIME_DENIED"]);

  const boundary = fixture({ observedAtMs: EVALUATION_TIME_MS - MAX_OBSERVATION_AGE_MS });
  const boundaryDecision = verifyUpdateApplyPostconditionV1(boundary.envelope, boundary.context);
  assert.equal(boundaryDecision.outcome, "ACCEPT_SWITCH");

  const exact = fixture({ observedAtMs: EVALUATION_TIME_MS });
  assert.equal(verifyUpdateApplyPostconditionV1(exact.envelope, exact.context).outcome, "ACCEPT_SWITCH");
});

test("undefined or structurally invalid context denies without a trusted rollback target", () => {
  const { envelope } = fixture();
  const undefinedDecision = verifyUpdateApplyPostconditionV1(envelope, undefined);
  assert.equal(undefinedDecision.outcome, "ROLLBACK_REQUIRED");
  assert.deepEqual(reasons(undefinedDecision), ["INDEPENDENT_CONTEXT_DENIED"]);
  assert.equal(undefinedDecision.exitCode, 72);
  assert.equal(undefinedDecision.rollbackTargetDigest, null);
  assert.equal(undefinedDecision.rollbackExecuted, false);

  const badContext = { ...fixture().context, lkgDigest: "not-a-digest" };
  const invalidDecision = verifyUpdateApplyPostconditionV1(envelope, badContext);
  assert.deepEqual(reasons(invalidDecision), ["INDEPENDENT_CONTEXT_DENIED"]);
  assert.equal(invalidDecision.rollbackTargetDigest, null);

  const badAge = { ...fixture().context, maxObservationAgeMs: -1 };
  assert.deepEqual(reasons(verifyUpdateApplyPostconditionV1(envelope, badAge)), ["INDEPENDENT_CONTEXT_DENIED"]);
});

test("malformed shapes and unsafe JSON deny before semantic checks", () => {
  const { context } = fixture();
  for (const value of [null, undefined, "postcondition", 42, true, [], { }]) {
    const decision = verifyUpdateApplyPostconditionV1(value, context);
    assert.equal(decision.outcome, "ROLLBACK_REQUIRED");
    assert.deepEqual(reasons(decision), ["SCHEMA_DENIED"], JSON.stringify(value));
    assert.equal(decision.exitCode, 70);
    assert.equal(decision.rollbackTargetDigest, LKG_DIGEST);
  }

  const { envelope } = fixture();
  const missingKey = { ...envelope };
  delete (missingKey as Record<string, unknown>).envelopeDigest;
  assert.deepEqual(reasons(verifyUpdateApplyPostconditionV1(missingKey, context)), ["SCHEMA_DENIED"]);

  const unsupported = { ...envelope, schemaVersion: "chimpmaera.update/apply-postcondition/v2" };
  const unsupportedDecision = verifyUpdateApplyPostconditionV1(unsupported, context);
  assert.deepEqual(reasons(unsupportedDecision), ["UNSUPPORTED_CONTRACT_VERSION_DENIED"]);
  assert.equal(unsupportedDecision.exitCode, 71);

  const wrongShapeVersion = { ...envelope, schemaVersion: 7 };
  const wrongShapeDecision = verifyUpdateApplyPostconditionV1(wrongShapeVersion, context);
  assert.deepEqual(reasons(wrongShapeDecision), ["UNSUPPORTED_CONTRACT_VERSION_DENIED"]);
  assert.equal(wrongShapeDecision.exitCode, 71);

  const circular: Record<string, unknown> = {};
  circular.self = circular;
  assert.deepEqual(reasons(verifyUpdateApplyPostconditionV1(circular, context)), ["SCHEMA_DENIED"]);

  const dangerousKey = JSON.parse('{"__proto__":{"polluted":true},"schemaVersion":"x"}');
  assert.deepEqual(reasons(verifyUpdateApplyPostconditionV1(dangerousKey, context)), ["SCHEMA_DENIED"]);
  assert.equal(({} as Record<string, unknown>).polluted, undefined);

  const uppercaseDigest = { ...envelope, lkgDigest: "A".repeat(64) };
  assert.deepEqual(reasons(verifyUpdateApplyPostconditionV1(uppercaseDigest, context)), ["SCHEMA_DENIED"]);

  const looseVersion = { ...envelope, verifierVersion: "latest" };
  assert.deepEqual(reasons(verifyUpdateApplyPostconditionV1(looseVersion, context)), ["SCHEMA_DENIED"]);
});

test("public projection renders only verified safe fields and omits forbidden content", () => {
  const { envelope, context } = fixture();
  const rendered = renderUpdateApplyPostconditionDecisionV1(envelope, context);
  const projection = JSON.parse(rendered) as Record<string, unknown>;
  assert.equal(projection.schemaVersion, UPDATE_APPLY_POSTCONDITION_SCHEMA_V1);
  assert.equal(projection.outcome, "ACCEPT_SWITCH");
  assert.deepEqual(projection.reasonCodes, ["POSTCONDITION_ACCEPTED"]);
  assert.equal(projection.exitCode, 0);
  assert.equal(projection.rollbackTargetDigest, null);
  assert.equal(projection.rollbackExecuted, false);
  assert.equal(projection.observationId, "postcondition:observation-001");
  assert.equal(projection.operationDigest, OPERATION_DIGEST);
  assert.equal(projection.targetDigest, TARGET_DIGEST);
  assert.equal(projection.lkgDigest, LKG_DIGEST);
  assert.equal(projection.expectedTargetTupleDigest, EXPECTED_TARGET_TUPLE_DIGEST);
  assert.equal(projection.observedTargetTupleDigest, EXPECTED_TARGET_TUPLE_DIGEST);
  assert.equal(projection.expectedOwnerStateDigest, EXPECTED_OWNER_STATE_DIGEST);
  assert.equal(projection.observedOwnerStateDigest, EXPECTED_OWNER_STATE_DIGEST);
  assert.equal(projection.residueCount, 0);
  assert.equal(projection.verifierId, TRUSTED_VERIFIER_ID);
  assert.equal(projection.verifierVersion, TRUSTED_VERIFIER_VERSION);
  assert.equal(projection.observedAtMs, OBSERVED_AT_MS);
  assert.equal(projection.envelopeDigest, envelope.envelopeDigest);
  assert.equal(typeof projection.note, "undefined");
  assert.equal(typeof projection.executionCommand, "undefined");
  assert.equal(typeof projection.promoteOnSuccess, "undefined");
  assert.equal(typeof projection.rollbackPath, "undefined");
  assert.equal(typeof projection.evidenceUrl, "undefined");
  assert.equal(typeof projection.secret, "undefined");
  assert.equal(rendered, renderUpdateApplyPostconditionDecisionV1(envelope, context));

  const rollback = fixture({ observedTargetTupleDigest: FORGED_TUPLE_DIGEST, residueCount: 1 });
  const rollbackProjection = JSON.parse(
    renderUpdateApplyPostconditionDecisionV1(rollback.envelope, rollback.context),
  ) as Record<string, unknown>;
  assert.equal(rollbackProjection.outcome, "ROLLBACK_REQUIRED");
  assert.deepEqual(rollbackProjection.reasonCodes, ["TUPLE_MISMATCH_DENIED", "RESIDUE_PRESENT_DENIED"]);
  assert.equal(rollbackProjection.rollbackTargetDigest, LKG_DIGEST);
  assert.equal(rollbackProjection.rollbackExecuted, false);
});

test("public projection refuses to materialize untrusted or malformed envelopes", () => {
  const { envelope, context } = fixture();
  assert.throws(
    () => renderUpdateApplyPostconditionDecisionV1({ ...envelope, note: "rollback /etc/passwd" }, context),
    /UNSAFE_OR_INVALID_UPDATE_POSTCONDITION/,
  );
  assert.throws(
    () => renderUpdateApplyPostconditionDecisionV1({ ...envelope, schemaVersion: "chimpmaera.update/apply-postcondition/v2" }, context),
    /UNSAFE_OR_INVALID_UPDATE_POSTCONDITION/,
  );
  const circular: Record<string, unknown> = {};
  circular.self = circular;
  assert.throws(() => renderUpdateApplyPostconditionDecisionV1(circular, context), /UNSAFE_OR_INVALID_UPDATE_POSTCONDITION/);
  assert.throws(() => renderUpdateApplyPostconditionDecisionV1(undefined, context), /UNSAFE_OR_INVALID_UPDATE_POSTCONDITION/);
});

test("verification never mutates the caller-provided envelope or context", () => {
  const { envelope, context } = fixture();
  const frozenEnvelope = JSON.parse(JSON.stringify(envelope)) as UpdateApplyPostconditionEnvelopeV1;
  Object.freeze(frozenEnvelope);
  const frozenContext = { ...context };
  Object.freeze(frozenContext);
  assert.doesNotThrow(() => verifyUpdateApplyPostconditionV1(frozenEnvelope, frozenContext));
  const mutated = { ...envelope, residueCount: 2 };
  verifyUpdateApplyPostconditionV1(mutated, context);
  assert.deepEqual(mutated, { ...envelope, residueCount: 2 });
  assert.equal(envelope.residueCount, 0);
});
