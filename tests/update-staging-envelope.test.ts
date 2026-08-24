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
// PSAI #53 bounded regression: the local stager-version grammar is hardened to
// canonical SemVer 2.0.0 syntax in both the envelope input and the trusted
// context, before projection or rendering.

const CANONICAL_STAGER_VERSIONS = ["0.0.0", "1.2.3", "1.2.3-rc.1"] as const;

const NON_CANONICAL_STAGER_VERSIONS = [
  "01.0.0",
  "1.02.0",
  "0.0.01",
  "1.2.3-",
  "1.2.3-1.",
  "1.2.3--1",
  "1.2.3-1..2",
  "1.2.3-01",
  "1.2.3-1.02",
  "latest",
  "mutable",
] as const;

const EXPECTED_STAGER_PROJECTION_BYTES: Readonly<Record<string, string>> = {
  "A:0.0.0": `{"activeSlot":"A","authorityGranted":false,"authorityProfileDigest":"7777777777777777777777777777777777777777777777777777777777777777","candidateContentDigest":"3333333333333333333333333333333333333333333333333333333333333333","claimBoundary":"SYNTHETIC_ISOLATED_STAGE_CHECKED_METADATA_ONLY_NO_COPY_NO_FILESYSTEM_NO_POINTER_SWITCH_NO_PACKAGE_NO_SERVICE_NO_NETWORK_NO_ACTIVATION_NO_ROLLBACK_NO_CLEANUP_NO_EXECUTION_AUTHORITY","envelopeDigest":"af73e760354fced99c2c277a02db294fe6b48ae79e96b14e64f3753125c3e217","envelopeId":"staging:synthetic-ab-001","executionAuthorized":false,"expectedPostconditionDigest":"5555555555555555555555555555555555555555555555555555555555555555","expectedStagedVerificationDigest":"4444444444444444444444444444444444444444444444444444444444444444","inactiveSlot":"B","issuedAtMs":1785819600500,"operationDigest":"eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee","outcome":"STAGE_CHECKED","ownerStateDigest":"6666666666666666666666666666666666666666666666666666666666666666","reasonCode":"STAGE_CHECKED","schemaVersion":"chimpmaera.update/staging-envelope/v1","sourceTupleDigest":"1111111111111111111111111111111111111111111111111111111111111111","stager":{"stagerId":"stager:isolated-stager-1","stagerVersion":"0.0.0"},"targetTupleDigest":"2222222222222222222222222222222222222222222222222222222222222222"}`,
  "A:1.2.3": `{"activeSlot":"A","authorityGranted":false,"authorityProfileDigest":"7777777777777777777777777777777777777777777777777777777777777777","candidateContentDigest":"3333333333333333333333333333333333333333333333333333333333333333","claimBoundary":"SYNTHETIC_ISOLATED_STAGE_CHECKED_METADATA_ONLY_NO_COPY_NO_FILESYSTEM_NO_POINTER_SWITCH_NO_PACKAGE_NO_SERVICE_NO_NETWORK_NO_ACTIVATION_NO_ROLLBACK_NO_CLEANUP_NO_EXECUTION_AUTHORITY","envelopeDigest":"43cd1655f86019510eeadb999b2a951220f1c7859ebb3749244277fac9bfd876","envelopeId":"staging:synthetic-ab-001","executionAuthorized":false,"expectedPostconditionDigest":"5555555555555555555555555555555555555555555555555555555555555555","expectedStagedVerificationDigest":"4444444444444444444444444444444444444444444444444444444444444444","inactiveSlot":"B","issuedAtMs":1785819600500,"operationDigest":"eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee","outcome":"STAGE_CHECKED","ownerStateDigest":"6666666666666666666666666666666666666666666666666666666666666666","reasonCode":"STAGE_CHECKED","schemaVersion":"chimpmaera.update/staging-envelope/v1","sourceTupleDigest":"1111111111111111111111111111111111111111111111111111111111111111","stager":{"stagerId":"stager:isolated-stager-1","stagerVersion":"1.2.3"},"targetTupleDigest":"2222222222222222222222222222222222222222222222222222222222222222"}`,
  "A:1.2.3-rc.1": `{"activeSlot":"A","authorityGranted":false,"authorityProfileDigest":"7777777777777777777777777777777777777777777777777777777777777777","candidateContentDigest":"3333333333333333333333333333333333333333333333333333333333333333","claimBoundary":"SYNTHETIC_ISOLATED_STAGE_CHECKED_METADATA_ONLY_NO_COPY_NO_FILESYSTEM_NO_POINTER_SWITCH_NO_PACKAGE_NO_SERVICE_NO_NETWORK_NO_ACTIVATION_NO_ROLLBACK_NO_CLEANUP_NO_EXECUTION_AUTHORITY","envelopeDigest":"23c6feed222b1b9d84733175d636ceb855211f3d07720b1af525d5dc4a868b1c","envelopeId":"staging:synthetic-ab-001","executionAuthorized":false,"expectedPostconditionDigest":"5555555555555555555555555555555555555555555555555555555555555555","expectedStagedVerificationDigest":"4444444444444444444444444444444444444444444444444444444444444444","inactiveSlot":"B","issuedAtMs":1785819600500,"operationDigest":"eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee","outcome":"STAGE_CHECKED","ownerStateDigest":"6666666666666666666666666666666666666666666666666666666666666666","reasonCode":"STAGE_CHECKED","schemaVersion":"chimpmaera.update/staging-envelope/v1","sourceTupleDigest":"1111111111111111111111111111111111111111111111111111111111111111","stager":{"stagerId":"stager:isolated-stager-1","stagerVersion":"1.2.3-rc.1"},"targetTupleDigest":"2222222222222222222222222222222222222222222222222222222222222222"}`,
  "B:0.0.0": `{"activeSlot":"B","authorityGranted":false,"authorityProfileDigest":"7777777777777777777777777777777777777777777777777777777777777777","candidateContentDigest":"3333333333333333333333333333333333333333333333333333333333333333","claimBoundary":"SYNTHETIC_ISOLATED_STAGE_CHECKED_METADATA_ONLY_NO_COPY_NO_FILESYSTEM_NO_POINTER_SWITCH_NO_PACKAGE_NO_SERVICE_NO_NETWORK_NO_ACTIVATION_NO_ROLLBACK_NO_CLEANUP_NO_EXECUTION_AUTHORITY","envelopeDigest":"ab64c91ec0a124203180d6658ef595ca879f3f02929e7d4d46a078f72428b88f","envelopeId":"staging:synthetic-ab-001","executionAuthorized":false,"expectedPostconditionDigest":"5555555555555555555555555555555555555555555555555555555555555555","expectedStagedVerificationDigest":"4444444444444444444444444444444444444444444444444444444444444444","inactiveSlot":"A","issuedAtMs":1785819600500,"operationDigest":"eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee","outcome":"STAGE_CHECKED","ownerStateDigest":"6666666666666666666666666666666666666666666666666666666666666666","reasonCode":"STAGE_CHECKED","schemaVersion":"chimpmaera.update/staging-envelope/v1","sourceTupleDigest":"1111111111111111111111111111111111111111111111111111111111111111","stager":{"stagerId":"stager:isolated-stager-1","stagerVersion":"0.0.0"},"targetTupleDigest":"2222222222222222222222222222222222222222222222222222222222222222"}`,
  "B:1.2.3": `{"activeSlot":"B","authorityGranted":false,"authorityProfileDigest":"7777777777777777777777777777777777777777777777777777777777777777","candidateContentDigest":"3333333333333333333333333333333333333333333333333333333333333333","claimBoundary":"SYNTHETIC_ISOLATED_STAGE_CHECKED_METADATA_ONLY_NO_COPY_NO_FILESYSTEM_NO_POINTER_SWITCH_NO_PACKAGE_NO_SERVICE_NO_NETWORK_NO_ACTIVATION_NO_ROLLBACK_NO_CLEANUP_NO_EXECUTION_AUTHORITY","envelopeDigest":"c384e35763a4893d7015cd484ae6c9ffe384abce7bbf2af57e58fdeab549d152","envelopeId":"staging:synthetic-ab-001","executionAuthorized":false,"expectedPostconditionDigest":"5555555555555555555555555555555555555555555555555555555555555555","expectedStagedVerificationDigest":"4444444444444444444444444444444444444444444444444444444444444444","inactiveSlot":"A","issuedAtMs":1785819600500,"operationDigest":"eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee","outcome":"STAGE_CHECKED","ownerStateDigest":"6666666666666666666666666666666666666666666666666666666666666666","reasonCode":"STAGE_CHECKED","schemaVersion":"chimpmaera.update/staging-envelope/v1","sourceTupleDigest":"1111111111111111111111111111111111111111111111111111111111111111","stager":{"stagerId":"stager:isolated-stager-1","stagerVersion":"1.2.3"},"targetTupleDigest":"2222222222222222222222222222222222222222222222222222222222222222"}`,
  "B:1.2.3-rc.1": `{"activeSlot":"B","authorityGranted":false,"authorityProfileDigest":"7777777777777777777777777777777777777777777777777777777777777777","candidateContentDigest":"3333333333333333333333333333333333333333333333333333333333333333","claimBoundary":"SYNTHETIC_ISOLATED_STAGE_CHECKED_METADATA_ONLY_NO_COPY_NO_FILESYSTEM_NO_POINTER_SWITCH_NO_PACKAGE_NO_SERVICE_NO_NETWORK_NO_ACTIVATION_NO_ROLLBACK_NO_CLEANUP_NO_EXECUTION_AUTHORITY","envelopeDigest":"0b0d7da43db103b28ef1e8491a0b154b4a8c81df8c6d397bdf6858a9dae79e2d","envelopeId":"staging:synthetic-ab-001","executionAuthorized":false,"expectedPostconditionDigest":"5555555555555555555555555555555555555555555555555555555555555555","expectedStagedVerificationDigest":"4444444444444444444444444444444444444444444444444444444444444444","inactiveSlot":"A","issuedAtMs":1785819600500,"operationDigest":"eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee","outcome":"STAGE_CHECKED","ownerStateDigest":"6666666666666666666666666666666666666666666666666666666666666666","reasonCode":"STAGE_CHECKED","schemaVersion":"chimpmaera.update/staging-envelope/v1","sourceTupleDigest":"1111111111111111111111111111111111111111111111111111111111111111","stager":{"stagerId":"stager:isolated-stager-1","stagerVersion":"1.2.3-rc.1"},"targetTupleDigest":"2222222222222222222222222222222222222222222222222222222222222222"}`,
};

const EXPECTED_STAGER_PROJECTION_DIGESTS: Readonly<Record<string, string>> = {
  "A:0.0.0": "a4bc34a756ef0400571451b98945970f2dd1af3466b49ff8ad72baaae95a438d",
  "A:1.2.3": "15f522391cb9ed29d0a4979d00317257eef5d21b6bc0d2edd0e92e6e293d744a",
  "A:1.2.3-rc.1": "22bb5405b661a26808628f31def6da55e6237f98f0b5002d6d08b3c0eab987c1",
  "B:0.0.0": "0fcf5e325183347c53866348b230a1ecbc195c1f9bb8db15a15f58d09a39d3f7",
  "B:1.2.3": "f05d24c4b31e97ad851ce4e95da7ce28cdcdbba1d19cd5ffee9e12eee14d9da4",
  "B:1.2.3-rc.1": "1a78b989001d276ceaf8089e1fd93d630a36bcb111a988338af226ec6ab39715",
};

test("fully digested stagerVersion 01.0.0 with matching trusted context denies fail closed", () => {
  const stager = { stagerId: "stager:isolated-stager-1", stagerVersion: "01.0.0" };
  const input = fixture({ stager });
  const matching = context({ trustedStager: { ...stager } });
  assert.equal(input.envelopeDigest, updateStagingEnvelopeDigestV1(input), "envelope must be fully digested");
  assertDenied(evaluateUpdateStagingEnvelopeV1(input, matching), "SCHEMA_DENIED");
  assert.throws(() => renderUpdateStagingEnvelopeV1(input, matching), /UNSAFE_OR_INVALID_UPDATE_STAGING/);
});

test("canonical 0.0.0, 1.2.3 and 1.2.3-rc.1 stager versions preserve exact stable projection bytes and digest for A/B and B/A", () => {
  for (const activeSlot of ["A", "B"] as const) {
    for (const stagerVersion of CANONICAL_STAGER_VERSIONS) {
      const stager = { stagerId: "stager:isolated-stager-1", stagerVersion };
      const input = fixture({ activeSlot, stager });
      const trusted = context({ trustedStager: stager });
      assert.deepEqual(evaluateUpdateStagingEnvelopeV1(input, trusted), { outcome: "STAGE_CHECKED", reasonCodes: ["STAGE_CHECKED"], exitCode: 0 });
      const projection = updateStagingEnvelopeProjectionV1(input, trusted);
      assertDeeplyFrozen(projection);
      assert.equal(projection.activeSlot, activeSlot);
      assert.equal(projection.inactiveSlot, oppositeSlotV1(activeSlot));
      assert.deepEqual(projection.stager, stager);
      const key = `${activeSlot}:${stagerVersion}`;
      const bytes = renderUpdateStagingEnvelopeV1(input, trusted);
      assert.equal(bytes, EXPECTED_STAGER_PROJECTION_BYTES[key]);
      assert.equal(bytes, canonicalJson(projection));
      const digest = updateStagingProjectionDigestV1(projection);
      assert.equal(digest, EXPECTED_STAGER_PROJECTION_DIGESTS[key]);
      assert.equal(digest, createHash("sha256").update(bytes).digest("hex"));
    }
  }
});

test("non-canonical stager versions in envelope and trusted context deny fail closed before projection or rendering", () => {
  for (const stagerVersion of NON_CANONICAL_STAGER_VERSIONS) {
    const stager = { stagerId: "stager:isolated-stager-1", stagerVersion };
    const input = fixture({ stager });
    const matching = context({ trustedStager: { ...stager } });
    assert.equal(input.envelopeDigest, updateStagingEnvelopeDigestV1(input), "envelope must be fully digested");
    assertDenied(evaluateUpdateStagingEnvelopeV1(input, matching), "SCHEMA_DENIED");
    assert.throws(() => renderUpdateStagingEnvelopeV1(input, matching), /UNSAFE_OR_INVALID_UPDATE_STAGING/);
    const canonicalEnvelope = fixture();
    assertDenied(evaluateUpdateStagingEnvelopeV1(canonicalEnvelope, context({ trustedStager: stager })), "INDEPENDENT_CONTEXT_DENIED");
    assert.throws(() => renderUpdateStagingEnvelopeV1(canonicalEnvelope, context({ trustedStager: stager })), /UNSAFE_OR_INVALID_UPDATE_STAGING/);
  }
});
