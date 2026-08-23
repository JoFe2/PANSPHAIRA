import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";
import { canonicalJson } from "../packages/contracts/src/canonical-json.js";
import {
  UPDATE_STAGING_CLAIM_BOUNDARY_V1,
  UPDATE_STAGING_EXIT_CODES_V1,
  UPDATE_STAGING_ENVELOPE_SCHEMA_V1,
  evaluateUpdateStagingEnvelopeV1,
  oppositeSlotV1,
  parseUpdateStagingEnvelopeV1,
  renderUpdateStagingEnvelopeV1,
  updateStagingEnvelopeDigestV1,
  updateStagingEnvelopeProjectionV1,
  updateStagingProjectionDigestV1,
  type UpdateStagingEnvelopeVerificationResultV1,
  type UpdateStagingReasonCodeV1,
  type UpdateStagingVerificationContextV1,
} from "../packages/contracts/src/update-staging-envelope.js";

const DIGESTS = {
  operation: "e".repeat(64),
  sourceTuple: "1".repeat(64),
  targetTuple: "2".repeat(64),
  candidate: "3".repeat(64),
  stagedVerification: "4".repeat(64),
  postcondition: "5".repeat(64),
  ownerState: "6".repeat(64),
  authorityProfile: "7".repeat(64),
  drift: "8".repeat(64),
} as const;

const ISSUED_AT_MS = 1_785_819_600_500;
const EVALUATION_TIME_MS = ISSUED_AT_MS + 1_000;
const MAX_ENVELOPE_AGE_MS = 60_000;
const STAGER = Object.freeze({ stagerId: "stager:isolated-stager-1", stagerVersion: "1.0.0" });

function flipHex(value: string): string {
  const last = value[value.length - 1] ?? "0";
  return `${value.slice(0, -1)}${last === "0" ? "1" : "0"}`;
}

interface FixtureOptions {
  readonly activeSlot?: "A" | "B";
  readonly inactiveSlot?: "A" | "B";
  readonly envelopeId?: string;
  readonly operationDigest?: string;
  readonly sourceTupleDigest?: string;
  readonly targetTupleDigest?: string;
  readonly candidateContentDigest?: string;
  readonly expectedStagedVerificationDigest?: string;
  readonly expectedPostconditionDigest?: string;
  readonly ownerStateDigest?: string;
  readonly authorityProfileDigest?: string;
  readonly stager?: { readonly stagerId: string; readonly stagerVersion: string };
  readonly issuedAtMs?: number;
}

function fixture(options: FixtureOptions = {}): Record<string, unknown> {
  const activeSlot = options.activeSlot ?? "A";
  const draft: Record<string, unknown> = {
    schemaVersion: UPDATE_STAGING_ENVELOPE_SCHEMA_V1,
    envelopeId: options.envelopeId ?? "staging:synthetic-ab-001",
    operationDigest: options.operationDigest ?? DIGESTS.operation,
    sourceTupleDigest: options.sourceTupleDigest ?? DIGESTS.sourceTuple,
    targetTupleDigest: options.targetTupleDigest ?? DIGESTS.targetTuple,
    activeSlot,
    inactiveSlot: options.inactiveSlot ?? oppositeSlotV1(activeSlot),
    candidateContentDigest: options.candidateContentDigest ?? DIGESTS.candidate,
    expectedStagedVerificationDigest: options.expectedStagedVerificationDigest ?? DIGESTS.stagedVerification,
    expectedPostconditionDigest: options.expectedPostconditionDigest ?? DIGESTS.postcondition,
    ownerStateDigest: options.ownerStateDigest ?? DIGESTS.ownerState,
    authorityProfileDigest: options.authorityProfileDigest ?? DIGESTS.authorityProfile,
    stager: options.stager ?? { ...STAGER },
    issuedAtMs: options.issuedAtMs ?? ISSUED_AT_MS,
  };
  draft.envelopeDigest = updateStagingEnvelopeDigestV1(draft);
  return draft;
}

function rawInput(mutate: (draft: Record<string, unknown>) => void, reseal = true): Record<string, unknown> {
  const draft = JSON.parse(JSON.stringify(fixture())) as Record<string, unknown>;
  mutate(draft);
  if (reseal) draft.envelopeDigest = updateStagingEnvelopeDigestV1(draft);
  return draft;
}

interface ContextOptions {
  readonly expectedOperationDigest?: string;
  readonly expectedSourceTupleDigest?: string;
  readonly expectedTargetTupleDigest?: string;
  readonly expectedCandidateContentDigest?: string;
  readonly expectedStagedVerificationDigest?: string;
  readonly expectedPostconditionDigest?: string;
  readonly expectedOwnerStateDigest?: string;
  readonly expectedAuthorityProfileDigest?: string;
  readonly trustedStager?: { readonly stagerId: string; readonly stagerVersion: string };
  readonly evaluationTimeMs?: number;
  readonly maxEnvelopeAgeMs?: number;
}

function context(options: ContextOptions = {}): UpdateStagingVerificationContextV1 {
  return {
    expectedOperationDigest: options.expectedOperationDigest ?? DIGESTS.operation,
    expectedSourceTupleDigest: options.expectedSourceTupleDigest ?? DIGESTS.sourceTuple,
    expectedTargetTupleDigest: options.expectedTargetTupleDigest ?? DIGESTS.targetTuple,
    expectedCandidateContentDigest: options.expectedCandidateContentDigest ?? DIGESTS.candidate,
    expectedStagedVerificationDigest: options.expectedStagedVerificationDigest ?? DIGESTS.stagedVerification,
    expectedPostconditionDigest: options.expectedPostconditionDigest ?? DIGESTS.postcondition,
    expectedOwnerStateDigest: options.expectedOwnerStateDigest ?? DIGESTS.ownerState,
    expectedAuthorityProfileDigest: options.expectedAuthorityProfileDigest ?? DIGESTS.authorityProfile,
    trustedStager: options.trustedStager ?? { ...STAGER },
    evaluationTimeMs: options.evaluationTimeMs ?? EVALUATION_TIME_MS,
    maxEnvelopeAgeMs: options.maxEnvelopeAgeMs ?? MAX_ENVELOPE_AGE_MS,
  };
}

function assertDeeplyFrozen(value: unknown): void {
  assert.ok(Object.isFrozen(value), "expected value to be deeply frozen");
  if (value !== null && typeof value === "object") {
    for (const child of Object.values(value as object)) assertDeeplyFrozen(child);
  }
}

function assertDenied(result: UpdateStagingEnvelopeVerificationResultV1, reason: UpdateStagingReasonCodeV1): void {
  assert.equal(result.outcome, "DENIED");
  const denied = result as Extract<UpdateStagingEnvelopeVerificationResultV1, { outcome: "DENIED" }>;
  assert.ok(denied.reasonCodes.includes(reason), `expected ${reason} in ${JSON.stringify(denied.reasonCodes)}`);
}

test("active A / inactive B yields deterministic deeply frozen STAGE_CHECKED bytes and digest", () => {
  const input = fixture();
  const result = evaluateUpdateStagingEnvelopeV1(input, context());
  assert.deepEqual(result, { outcome: "STAGE_CHECKED", reasonCodes: ["STAGE_CHECKED"], exitCode: 0 });

  const projection = updateStagingEnvelopeProjectionV1(input, context());
  assertDeeplyFrozen(projection);
  assert.equal(projection.outcome, "STAGE_CHECKED");
  assert.equal(projection.reasonCode, "STAGE_CHECKED");
  assert.equal(projection.schemaVersion, UPDATE_STAGING_ENVELOPE_SCHEMA_V1);
  assert.equal(projection.claimBoundary, UPDATE_STAGING_CLAIM_BOUNDARY_V1);
  assert.equal(projection.activeSlot, "A");
  assert.equal(projection.inactiveSlot, "B");
  assert.equal(projection.operationDigest, DIGESTS.operation);
  assert.equal(projection.sourceTupleDigest, DIGESTS.sourceTuple);
  assert.equal(projection.targetTupleDigest, DIGESTS.targetTuple);
  assert.equal(projection.candidateContentDigest, DIGESTS.candidate);
  assert.equal(projection.expectedStagedVerificationDigest, DIGESTS.stagedVerification);
  assert.equal(projection.expectedPostconditionDigest, DIGESTS.postcondition);
  assert.equal(projection.ownerStateDigest, DIGESTS.ownerState);
  assert.equal(projection.authorityProfileDigest, DIGESTS.authorityProfile);
  assert.deepEqual(projection.stager, { ...STAGER });
  assert.equal(projection.issuedAtMs, ISSUED_AT_MS);
  assert.equal(projection.envelopeDigest, updateStagingEnvelopeDigestV1(input));
  assert.equal(projection.authorityGranted, false);
  assert.equal(projection.executionAuthorized, false);

  const bytes = renderUpdateStagingEnvelopeV1(input, context());
  assert.equal(bytes, renderUpdateStagingEnvelopeV1(input, context()));
  assert.equal(bytes, canonicalJson(projection));
  assert.ok(bytes.includes("STAGE_CHECKED"));
  const digest = updateStagingProjectionDigestV1(projection);
  assert.equal(digest, createHash("sha256").update(bytes).digest("hex"));
  assert.equal(updateStagingProjectionDigestV1(updateStagingEnvelopeProjectionV1(input, context())), digest);
});

test("active B / inactive A yields an exact deterministic STAGE_CHECKED projection distinct from A/B", () => {
  const input = fixture({ activeSlot: "B" });
  assert.equal(input.inactiveSlot, "A");
  const result = evaluateUpdateStagingEnvelopeV1(input, context());
  assert.deepEqual(result, { outcome: "STAGE_CHECKED", reasonCodes: ["STAGE_CHECKED"], exitCode: 0 });

  const projection = updateStagingEnvelopeProjectionV1(input, context());
  assertDeeplyFrozen(projection);
  assert.equal(projection.activeSlot, "B");
  assert.equal(projection.inactiveSlot, "A");
  const bytes = renderUpdateStagingEnvelopeV1(input, context());
  assert.equal(bytes, canonicalJson(projection));
  assert.notEqual(bytes, renderUpdateStagingEnvelopeV1(fixture(), context()));
});

test("equivalent key ordering yields identical canonical staging bytes and digest", () => {
  const base = fixture();
  const entries = Object.entries(base);
  const reversed = Object.fromEntries([...entries].reverse());
  const rotated = Object.fromEntries([...entries.slice(3), ...entries.slice(0, 3)]);
  const bytesA = renderUpdateStagingEnvelopeV1(base, context());
  const bytesB = renderUpdateStagingEnvelopeV1(reversed, context());
  const bytesC = renderUpdateStagingEnvelopeV1(rotated, context());
  assert.equal(bytesA, bytesB);
  assert.equal(bytesA, bytesC);
  assert.equal(
    updateStagingProjectionDigestV1(updateStagingEnvelopeProjectionV1(base, context())),
    updateStagingProjectionDigestV1(updateStagingEnvelopeProjectionV1(reversed, context())),
  );
  assert.equal(
    updateStagingProjectionDigestV1(updateStagingEnvelopeProjectionV1(base, context())),
    updateStagingProjectionDigestV1(updateStagingEnvelopeProjectionV1(rotated, context())),
  );
});

test("STAGE_CHECKED projection grants no switch or execution authority and omits forbidden material", () => {
  const bytes = renderUpdateStagingEnvelopeV1(fixture(), context());
  for (const forbidden of [
    "secretKey",
    "callbackUrl",
    "http://",
    "freeText",
    "activationAuthorized",
    "promoteActive",
    "copyToActive",
    "switchPointer",
    "executePackage",
    "rollback",
  ]) {
    assert.ok(!bytes.includes(forbidden), `projection must not contain ${forbidden}`);
  }
});

test("same active/inactive slot, unknown slot, and source=target tuple deny fail closed", () => {
  assertDenied(evaluateUpdateStagingEnvelopeV1(fixture({ activeSlot: "A", inactiveSlot: "A" }), context()), "SLOT_MISMATCH_DENIED");
  assertDenied(evaluateUpdateStagingEnvelopeV1(rawInput((draft) => { draft.activeSlot = "C"; }), context()), "SLOT_MISMATCH_DENIED");
  assertDenied(evaluateUpdateStagingEnvelopeV1(rawInput((draft) => { draft.inactiveSlot = draft.sourceTupleDigest; }), context()), "SLOT_MISMATCH_DENIED");
  assertDenied(evaluateUpdateStagingEnvelopeV1(rawInput((draft) => { draft.targetTupleDigest = draft.sourceTupleDigest; }), context()), "TUPLE_MISMATCH_DENIED");
});

test("candidate, verification, postcondition, owner and authority digest drift deny fail closed", () => {
  assertDenied(evaluateUpdateStagingEnvelopeV1(fixture(), context({ expectedCandidateContentDigest: DIGESTS.drift })), "DIGEST_MISMATCH_DENIED");
  assertDenied(evaluateUpdateStagingEnvelopeV1(fixture(), context({ expectedStagedVerificationDigest: DIGESTS.drift })), "DIGEST_MISMATCH_DENIED");
  assertDenied(evaluateUpdateStagingEnvelopeV1(fixture(), context({ expectedPostconditionDigest: DIGESTS.drift })), "DIGEST_MISMATCH_DENIED");
  assertDenied(evaluateUpdateStagingEnvelopeV1(fixture(), context({ expectedOwnerStateDigest: DIGESTS.drift })), "DIGEST_MISMATCH_DENIED");
  assertDenied(evaluateUpdateStagingEnvelopeV1(fixture(), context({ expectedAuthorityProfileDigest: DIGESTS.drift })), "DIGEST_MISMATCH_DENIED");
  assertDenied(evaluateUpdateStagingEnvelopeV1(fixture(), context({ expectedOperationDigest: DIGESTS.drift })), "DIGEST_MISMATCH_DENIED");
});

test("source and target tuple drift from independent context deny fail closed", () => {
  assertDenied(evaluateUpdateStagingEnvelopeV1(fixture(), context({ expectedSourceTupleDigest: DIGESTS.drift })), "TUPLE_MISMATCH_DENIED");
  assertDenied(evaluateUpdateStagingEnvelopeV1(fixture(), context({ expectedTargetTupleDigest: DIGESTS.drift })), "TUPLE_MISMATCH_DENIED");
});

test("replay and time invalidity deny fail closed", () => {
  assertDenied(evaluateUpdateStagingEnvelopeV1({ ...fixture(), issuedAtMs: -0 }, context()), "SCHEMA_DENIED");
  assertDenied(evaluateUpdateStagingEnvelopeV1(fixture(), context({ evaluationTimeMs: -0 })), "SCHEMA_DENIED");
  assertDenied(evaluateUpdateStagingEnvelopeV1(fixture(), context({ maxEnvelopeAgeMs: -0 })), "SCHEMA_DENIED");
  assertDenied(evaluateUpdateStagingEnvelopeV1(fixture({ issuedAtMs: EVALUATION_TIME_MS + 1 }), context()), "REPLAY_DENIED");
  assertDenied(
    evaluateUpdateStagingEnvelopeV1(fixture({ issuedAtMs: ISSUED_AT_MS - (MAX_ENVELOPE_AGE_MS + 1) }), context()),
    "REPLAY_DENIED",
  );
});

test("tampered or re-digested envelope digests deny fail closed", () => {
  assertDenied(evaluateUpdateStagingEnvelopeV1(rawInput((draft) => { draft.envelopeDigest = flipHex(draft.envelopeDigest as string); }, false), context()), "DIGEST_MISMATCH_DENIED");
  assertDenied(evaluateUpdateStagingEnvelopeV1(rawInput((draft) => { draft.candidateContentDigest = DIGESTS.drift; }), context()), "DIGEST_MISMATCH_DENIED");
});

test("unknown fields and claim-bearing or claim-carrying identifiers deny fail closed", () => {
  for (const unknownField of ["activationAuthorized", "callbackUrl", "copyToActive", "freeText", "secretKey"]) {
    assertDenied(evaluateUpdateStagingEnvelopeV1(rawInput((draft) => { draft[unknownField] = true; }), context()), "SCHEMA_DENIED");
  }
  assertDenied(evaluateUpdateStagingEnvelopeV1(rawInput((draft) => { draft.stager = { stagerId: "stager:promote-slot-a", stagerVersion: "1.0.0" }; }), context()), "MUTATION_CLAIM_DENIED");
  assertDenied(evaluateUpdateStagingEnvelopeV1(rawInput((draft) => { draft.envelopeId = "staging:copy-now-1"; }), context()), "MUTATION_CLAIM_DENIED");
  assertDenied(evaluateUpdateStagingEnvelopeV1(rawInput((draft) => { draft.stager = { stagerId: "stager:callback-1", stagerVersion: "1.0.0" }; }), context()), "MUTATION_CLAIM_DENIED");
});

test("stager substitution with unchanged digest denies fail closed", () => {
  const result = evaluateUpdateStagingEnvelopeV1(
    rawInput((draft) => { draft.stager = { stagerId: "stager:isolated-stager-2", stagerVersion: "1.0.0" }; }, false),
    context(),
  );
  assertDenied(result, "DIGEST_MISMATCH_DENIED");
  assertDenied(result, "STAGER_BINDING_DENIED");
  const denied = result as Extract<UpdateStagingEnvelopeVerificationResultV1, { outcome: "DENIED" }>;
  assert.equal(denied.exitCode, UPDATE_STAGING_EXIT_CODES_V1.DIGEST_MISMATCH_DENIED);
});

test("fully re-digested forged staging and stager envelopes deny fail closed", () => {
  assertDenied(
    evaluateUpdateStagingEnvelopeV1(rawInput((draft) => { draft.candidateContentDigest = DIGESTS.drift; draft.operationDigest = DIGESTS.drift; }), context()),
    "DIGEST_MISMATCH_DENIED",
  );
  assertDenied(
    evaluateUpdateStagingEnvelopeV1(rawInput((draft) => { draft.stager = { stagerId: "stager:rogue-stager-9", stagerVersion: "9.9.9" }; }), context()),
    "STAGER_BINDING_DENIED",
  );
  assertDenied(
    evaluateUpdateStagingEnvelopeV1(rawInput((draft) => { draft.stager = { stagerId: "stager:synthetic_ab_001", stagerVersion: "1.0.0" }; }), context()),
    "STAGER_BINDING_DENIED",
  );
});

test("unsupported contract version, invalid json, and missing context deny fail closed", () => {
  assertDenied(evaluateUpdateStagingEnvelopeV1(rawInput((draft) => { draft.schemaVersion = "chimpmaera.update/staging-envelope/v9"; }), context()), "UNSUPPORTED_CONTRACT_VERSION_DENIED");
  const badJson = parseUpdateStagingEnvelopeV1("{ not json", context());
  assertDenied(badJson, "INVALID_JSON_DENIED");
  const missingContext = evaluateUpdateStagingEnvelopeV1(fixture(), undefined);
  assertDenied(missingContext, "INDEPENDENT_CONTEXT_DENIED");
  const malformedContext = evaluateUpdateStagingEnvelopeV1(fixture(), { ...context(), expectedOperationDigest: "nothex" });
  assertDenied(malformedContext, "INDEPENDENT_CONTEXT_DENIED");
  const nonObject = evaluateUpdateStagingEnvelopeV1("junk", context());
  assertDenied(nonObject, "SCHEMA_DENIED");
});

test("valid sealed envelope round-trips through parse with exact result and exit codes", () => {
  const parsed = parseUpdateStagingEnvelopeV1(canonicalJson(fixture()), context());
  assert.deepEqual(parsed, { outcome: "STAGE_CHECKED", reasonCodes: ["STAGE_CHECKED"], exitCode: 0 });
  const denied = evaluateUpdateStagingEnvelopeV1(fixture({ activeSlot: "A", inactiveSlot: "A" }), context());
  const deniedResult = denied as Extract<UpdateStagingEnvelopeVerificationResultV1, { outcome: "DENIED" }>;
  assert.equal(deniedResult.exitCode, UPDATE_STAGING_EXIT_CODES_V1.SLOT_MISMATCH_DENIED);
});