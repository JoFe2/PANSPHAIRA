import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

import {
  ADJUDICATION_CHAIN_STAGES,
  adjudicateNativeCandidateV1,
  createNativeAdjudicationContextV1,
  createNativePairedAdjudicationReceiptV1,
  createNativePairedAdjudicationReceiptV2,
  verifyNativePairedAdjudicationReceiptV2,
  KALEIDOSPHERE_RECONCILED_RELEASED_HEAD_V1,
  KALEIDOSPHERE_RECONCILED_RELEASED_TREE_V1,
  NATIVE_ADJUDICATION_RECEIPT_ID_V2,
  NATIVE_EXPECTED_OUTCOMES_V2,
  NATIVE_RECEIPT_SCHEMA_V2,
  nativeProjectionDigestV1,
  nativeTransportBytesV1,
  PANSPHAIRA_RECONCILED_HEAD_COMMIT_V1,
  PANSPHAIRA_RECONCILED_RELEASED_HEAD_V1,
  PANSPHAIRA_RECONCILED_RELEASE_RECEIPT_SHA256_V1,
  PANSPHAIRA_RECONCILED_RELEASE_TAG_V1,
  RECONCILED_RELEASED_HEADS_V1,
} from "../../src/cks-12/kaleidosphere-candidate-quarantine.js";
import { SOURCE_CONTRACT_SHA256, buildKaleidosphereAnalyticsProjectionV1, kaleidosphereAnalyticsProjectionDigestV1 } from "../../packages/contracts/src/kaleidosphere-analytics-projection.js";
import { canonicalJson } from "../../packages/contracts/src/canonical-json.js";

const root = process.cwd();
const fixture = (name: string): string => path.join(root, "tests/fixtures/cks-analytics", name);
const digest = (bytes: Buffer): string => createHash("sha256").update(bytes).digest("hex");

const rawArtifactBytes = readFileSync(fixture("projection-v1.json"));
const transportBytes = nativeTransportBytesV1(rawArtifactBytes);
const digests = nativeProjectionDigestV1(rawArtifactBytes);
const capture = JSON.parse(readFileSync(fixture("xra-ps-02-native-service-capture-v1.json"), "utf8")) as Record<string, any>;
const realCandidate: unknown = capture.response.candidate;
const emptyContext = () => createNativeAdjudicationContextV1({ contextId: "pansphaira:xra-ps-02-native-context-001" });
const nativeInput = (candidate: unknown, context: ReturnType<typeof emptyContext> = emptyContext()) => ({
  canonicalTransportBytes: transportBytes,
  candidate,
  context,
  rawArtifactBytes,
  releasedHeads: RECONCILED_RELEASED_HEADS_V1,
});

// The v2 successor paired receipt and the raw Root-QS results captured by the
// executable Root-QS replay runner (scripts/run-xra-ps-02-root-qs-replay.mjs)
// running the real pinned KaleidoSphere native-projection service inside the
// dedicated root test VM. These are the committed evidence of actual execution.
const v2Receipt = JSON.parse(readFileSync(fixture("xra-ps-02-native-paired-receipt-v2.json"), "utf8")) as Record<string, any>;
const rawResults = JSON.parse(readFileSync(fixture("xra-ps-02-native-root-qs-raw-v2.json"), "utf8")) as Record<string, any>;

// The v1 source-local base receipt, rebuilt here from the identical canonical
// transport and the reconciled released heads. It binds the two released heads
// and the seven-stage chain, but NOT the tested adjudicator source nor the live
// Root-QS execution. This is the "old source-local proof".
const baseReceipt = createNativePairedAdjudicationReceiptV1({
  adjudication: adjudicateNativeCandidateV1(nativeInput(realCandidate)),
  candidate: realCandidate,
  canonicalTransportBytes: transportBytes,
  context: emptyContext(),
  rawArtifactBytes,
  releasedHeads: RECONCILED_RELEASED_HEADS_V1,
});

const v2Material = { rawResults, testedSource: v2Receipt.testedSource };
const DENIED = { outcome: "DENIED", reasonCodes: ["NATIVE_V2_RECEIPT_DENIED"] };

test("RED: the v1 source-local proof is structurally insufficient (it binds no tested source and no live execution)", () => {
  // The v1 receipt carries no separate tested-source binding...
  assert.equal("testedSource" in baseReceipt, false, "v1 receipt must not bind a tested source");
  assert.equal("testedSourceDigest" in baseReceipt, false, "v1 receipt must not bind a tested-source digest");
  // ...and no Root-QS execution binding (released input heads / outcomes /
  // falsifiers / raw-results digest / before-after).
  assert.equal("rootQsExecution" in baseReceipt, false, "v1 receipt must not bind a Root-QS execution");
  assert.equal("inputHeads" in baseReceipt, false, "v1 receipt must not bind separate released input heads");
  assert.equal("inputHeadsDigest" in baseReceipt, false, "v1 receipt must not bind an input-heads digest");
  // ...and it is a different schema/identity from the v2 successor receipt.
  assert.notEqual(baseReceipt.schemaVersion, NATIVE_RECEIPT_SCHEMA_V2, "v1 schema must differ from v2");
  assert.notEqual(baseReceipt.receiptId, NATIVE_ADJUDICATION_RECEIPT_ID_V2, "v1 id must differ from v2");
  // A v1 source-local receipt cannot be verified as a v2 successor receipt.
  assert.deepEqual(
    verifyNativePairedAdjudicationReceiptV2(baseReceipt, v2Material),
    DENIED,
    "a v1 source-local receipt is fail-closed DENIED as a v2 successor receipt",
  );
});

test("GREEN: the v2 successor receipt from actual execution verifies with exact material", () => {
  const verified = verifyNativePairedAdjudicationReceiptV2(v2Receipt, v2Material);
  assert.equal(verified.outcome, "VERIFIED", "the committed v2 receipt from actual execution must verify");
  if (verified.outcome !== "VERIFIED") throw new Error("unreachable");
  assert.equal(verified.receiptDigest, v2Receipt.receiptDigest);
  assert.deepEqual(verified.chainStages, [...ADJUDICATION_CHAIN_STAGES]);
  assert.deepEqual(verified.chainStages, [
    "GENERATION", "PROJECTION", "INGESTION", "SEMANTICS", "ANALYSIS", "CANDIDATE", "ADJUDICATION",
  ]);
  assert.equal(verified.authority, "NONE");
  assert.equal(verified.effect, "NONE");
  assert.deepEqual(verified.testedSource, v2Receipt.testedSource);
  assert.deepEqual(verified.inputHeads, v2Receipt.inputHeads);
});

test("GREEN: the v2 receipt independently binds the tested PAN adjudicator source, separately from the released input heads", () => {
  // Tested-source binding (group 2): the exact adjudicator source and focused
  // native test that were executed, plus the exact pinned KS service identity.
  const adjudicatorSha = digest(readFileSync(path.join(root, "src/cks-12/kaleidosphere-candidate-quarantine.ts")));
  const focusedTestSha = digest(readFileSync(path.join(root, "tests/cks-12/kaleidosphere-candidate-quarantine-native.test.ts")));
  assert.deepEqual(v2Receipt.testedSource, {
    adjudicatorSha256: adjudicatorSha,
    focusedNativeTestSha256: focusedTestSha,
    kaleidoSphereHeadCommit: KALEIDOSPHERE_RECONCILED_RELEASED_HEAD_V1,
    kaleidoSphereHeadTree: KALEIDOSPHERE_RECONCILED_RELEASED_TREE_V1,
    kaleidoSphereServerSha256: rawResults.service.serverSha256,
  }, "tested source binds the executed adjudicator source + focused test + pinned KS service");
  // The tested source is the NEW additive v2 source, deliberately distinct from
  // the pre-v2 released implementation the v1 slice bound (d39fbfc9...).
  assert.notEqual(
    v2Receipt.testedSource.adjudicatorSha256,
    "d39fbfc9f982c9bbe33567134f3b5a9d0eecaa1935f49e66815c8b5a1ef815a9",
    "tested source must be the additive v2 source, not the pre-v2 released source",
  );
  // Released input-heads binding (group 1): the immutable released pair.
  assert.deepEqual(v2Receipt.inputHeads, {
    canonicalTransportSha256: digests.canonicalTransportSha256,
    kaleidoSphereHeadCommit: KALEIDOSPHERE_RECONCILED_RELEASED_HEAD_V1,
    kaleidoSphereHeadTree: KALEIDOSPHERE_RECONCILED_RELEASED_TREE_V1,
    pansphairaHeadCommit: PANSPHAIRA_RECONCILED_HEAD_COMMIT_V1,
    pansphairaReleaseCommit: PANSPHAIRA_RECONCILED_RELEASED_HEAD_V1,
    pansphairaReleaseReceiptSha256: PANSPHAIRA_RECONCILED_RELEASE_RECEIPT_SHA256_V1,
    pansphairaReleaseTag: PANSPHAIRA_RECONCILED_RELEASE_TAG_V1,
    projectionDigest: digests.projectionBodyDigest,
    rawArtifactSha256: digests.rawArtifactSha256,
    sourceContractSha256: SOURCE_CONTRACT_SHA256,
  }, "input heads bind the immutable released pair and canonical transport");
  // The two binding groups are separate objects with distinct digests.
  assert.notEqual(v2Receipt.testedSourceDigest, v2Receipt.inputHeadsDigest);
  assert.deepEqual(v2Receipt.testedSource, rawResults.testedSource);
  assert.deepEqual(v2Receipt.inputHeads, rawResults.inputHeads);
});

test("GREEN: the five paired outcomes and three real falsifiers are bound exactly", () => {
  assert.deepEqual(v2Receipt.rootQsExecution.outcomes, NATIVE_EXPECTED_OUTCOMES_V2, "five paired outcomes bound exactly");
  assert.deepEqual(rawResults.outcomes, NATIVE_EXPECTED_OUTCOMES_V2, "raw results carry the same five paired outcomes");
  assert.deepEqual(v2Receipt.rootQsExecution.falsifiers, [
    { label: "service-down", code: "XRA_PS_02_NATIVE_SERVICE_UNAVAILABLE" },
    { label: "substitution", code: "NATIVE_STALE_HEAD_DENIED" },
    { label: "malformed", code: "XRA_PS_02_NATIVE_WIRE_SHAPE_DENIED" },
  ], "service-down / substitution / malformed falsifiers bound exactly");
  assert.equal(v2Receipt.rootQsExecution.scope, "LOCAL_VM_REAL_HTTP");
  assert.equal(v2Receipt.rootQsExecution.transport, "loopback HTTP (127.0.0.1)");
});

test("GREEN: canonical Knowledge, authority, capability, and effect are unchanged (before === after)", () => {
  const beforeAfter = v2Receipt.rootQsExecution.beforeAfter;
  assert.equal(beforeAfter.canonicalKnowledgeBeforeSha256, "d756437db8c991ee78ea7a9fcc7a9d4749daf8eebda51d5ba31fcc53e1b1242a");
  assert.equal(beforeAfter.canonicalKnowledgeAfterSha256, beforeAfter.canonicalKnowledgeBeforeSha256, "canonical Knowledge digest is unchanged");
  assert.equal(beforeAfter.authorityBefore, "NONE");
  assert.equal(beforeAfter.authorityAfter, "NONE");
  assert.equal(beforeAfter.capabilityDeltaBefore, "NONE");
  assert.equal(beforeAfter.capabilityDeltaAfter, "NONE");
  assert.equal(beforeAfter.effectBefore, "NONE");
  assert.equal(beforeAfter.effectAfter, "NONE");
});

test("GREEN: the real pinned KS service reproduces the historical capture (full runtime compatibility)", () => {
  assert.equal(rawResults.liveCandidate.matchesHistoricalCapture, true, "live service reproduces the historical capture byte-for-byte");
  assert.equal(rawResults.service.healthz, "UP");
  assert.equal(rawResults.service.kaleidoSphereHeadCommit, KALEIDOSPHERE_RECONCILED_RELEASED_HEAD_V1);
  assert.equal(rawResults.service.kaleidoSphereHeadTree, KALEIDOSPHERE_RECONCILED_RELEASED_TREE_V1);
  assert.equal(rawResults.service.serverSha256, v2Receipt.testedSource.kaleidoSphereServerSha256);
  assert.deepEqual(rawResults.service.headsEndpoint.nativeReleaseRegistry, {
    status: "RELEASED",
    entryCount: 1,
    releasedEntryCount: 1,
  }, "the pinned KS service reports the reconciled released native registry");
});

test("NEGATIVE: tampering the receipt, the raw results, or the tested source fails closed", () => {
  // Tamper a released input head.
  const tamperedHeads = JSON.parse(JSON.stringify(v2Receipt));
  tamperedHeads.inputHeads.pansphairaHeadCommit = "0".repeat(40);
  assert.deepEqual(verifyNativePairedAdjudicationReceiptV2(tamperedHeads, v2Material), DENIED, "input-head tamper is DENIED");
  // Tamper the raw Root-QS results (flip an outcome).
  const tamperedRaw = JSON.parse(JSON.stringify(rawResults));
  tamperedRaw.outcomes[0].outcome = "DENIED";
  assert.deepEqual(
    verifyNativePairedAdjudicationReceiptV2(v2Receipt, { rawResults: tamperedRaw, testedSource: v2Receipt.testedSource }),
    DENIED,
    "raw-results tamper is DENIED",
  );
  // Provide a mismatched tested source.
  const wrongSource = { ...v2Receipt.testedSource, adjudicatorSha256: "1".repeat(64) };
  assert.deepEqual(
    verifyNativePairedAdjudicationReceiptV2(v2Receipt, { rawResults, testedSource: wrongSource }),
    DENIED,
    "tested-source mismatch is DENIED",
  );
  // Missing raw-results material.
  assert.deepEqual(
    verifyNativePairedAdjudicationReceiptV2(v2Receipt, { rawResults: undefined, testedSource: v2Receipt.testedSource }),
    DENIED,
    "missing raw-results material is DENIED",
  );
  // A forged v2 receipt — internally consistent over a TAMPERED tested source
  // (recomputed testedSourceDigest + receiptDigest) — must be DENIED when checked
  // against the committed, independently-provided tested source, while remaining
  // self-consistent against its own forged source.
  const committedAdjudicator = v2Receipt.testedSource.adjudicatorSha256;
  const forgedAdjudicator = (committedAdjudicator[0] === "a" ? "b" : "a") + committedAdjudicator.slice(1);
  const forgedSource = { ...v2Receipt.testedSource, adjudicatorSha256: forgedAdjudicator };
  const forgedReceipt = createNativePairedAdjudicationReceiptV2({
    baseReceipt,
    inputHeads: v2Receipt.inputHeads,
    rawResults,
    rootQsExecution: {
      beforeAfter: v2Receipt.rootQsExecution.beforeAfter,
      command: v2Receipt.rootQsExecution.command,
      falsifiers: v2Receipt.rootQsExecution.falsifiers,
      outcomes: v2Receipt.rootQsExecution.outcomes,
      scope: v2Receipt.rootQsExecution.scope,
      transport: v2Receipt.rootQsExecution.transport,
    },
    testedSource: forgedSource,
  });
  assert.equal(
    verifyNativePairedAdjudicationReceiptV2(forgedReceipt, { rawResults, testedSource: forgedReceipt.testedSource }).outcome,
    "VERIFIED",
    "a forged receipt is internally consistent against its own forged source",
  );
  assert.equal(verifyNativePairedAdjudicationReceiptV2(forgedReceipt, v2Material).outcome, "DENIED", "a forged tested source is DENIED as the committed proof");
});

// --- AC03 generation-stage evidence: the transported projection artifact is generated
// from the released producer AT EXECUTION TIME and its equality to the released raw
// artifact and to the independently rebuilt projection is recorded. ---
test("GREEN: the transported projection is generated from the released producer at execution time with recorded equality", () => {
  const generated = rawResults.projectionGenerated;
  assert.notEqual(generated, undefined, "raw results must record the execution-time projection generation");
  assert.equal(generated.generatedAtRunTime, true, "the artifact must be generated at execution time, not re-read as the source of truth");
  assert.equal(generated.producer, "buildKaleidosphereAnalyticsProjectionV1");
  assert.equal(generated.producerFile, "packages/contracts/src/kaleidosphere-analytics-projection.ts");
  const producerSha = digest(readFileSync(path.join(root, "packages/contracts/src/kaleidosphere-analytics-projection.ts")));
  assert.equal(generated.producerSha256, producerSha, "the producer source bytes are bound");
  assert.equal(generated.generatedRawArtifactSha256, digest(rawArtifactBytes), "the generated artifact equals the released raw artifact");
  assert.equal(generated.equalsReleasedRawArtifact, true, "byte-equality to the released raw artifact is recorded");
  // Re-derive the producer output locally from the same source and require the
  // execution-time body digest to match the independently rebuilt projection.
  const localBodyDigest = kaleidosphereAnalyticsProjectionDigestV1(buildKaleidosphereAnalyticsProjectionV1());
  assert.equal(generated.generatedProjectionBodyDigest, localBodyDigest, "execution-time body digest matches the local producer re-derivation");
  assert.equal(generated.equalsRebuiltProjection, true, "equality to the independently rebuilt projection is recorded");
  assert.equal(generated.equalsCanonicalTransport, true, "equality to the canonical transport is recorded");
  // The generation stage of the per-stage raw execution binding ties back to it.
  const stage = rawResults.stageExecution.find((entry: Record<string, any>) => entry.stage === "GENERATION");
  assert.equal(stage.executorSha256, generated.producerSha256, "GENERATION stage executor is the released producer");
  assert.equal(stage.inputSha256, SOURCE_CONTRACT_SHA256, "GENERATION stage input is the frozen CKS proof-input contract");
  assert.equal(stage.outputSha256, generated.generatedRawArtifactSha256, "GENERATION stage output is the generated artifact");
});

// --- AC03 per-stage RAW execution binding: every chain stage records raw execution
// identities, commands, and input/output byte digests (not just derived digests). ---
test("GREEN: all seven chain stages carry per-stage raw execution identities and commands", () => {
  const stages = rawResults.stageExecution;
  assert.deepEqual(stages.map((entry: Record<string, any>) => entry.stage), [...ADJUDICATION_CHAIN_STAGES], "stage order matches the seven-stage chain");
  const HEX64 = /^[a-f0-9]{64}$/;
  for (const entry of stages) {
    assert.deepEqual(
      Object.keys(entry).sort(),
      ["command", "executor", "executorKind", "executorSha256", "inputSha256", "outputSha256", "stage"].sort(),
      `stage ${entry.stage} carries the exact per-stage raw execution keys`,
    );
    assert.match(entry.executorSha256, HEX64, `stage ${entry.stage} executor bytes are bound`);
    assert.match(entry.inputSha256, HEX64, `stage ${entry.stage} raw input bytes are bound`);
    assert.match(entry.outputSha256, HEX64, `stage ${entry.stage} raw output bytes are bound`);
    assert.equal(typeof entry.command, "string");
    assert.ok(entry.command.length > 0, `stage ${entry.stage} command is recorded`);
  }
  const byStage = new Map<string, Record<string, any>>(stages.map((entry: Record<string, any>) => [entry.stage, entry] as [string, Record<string, any>]));
  const stageEntry = (name: string): Record<string, any> => {
    const entry = byStage.get(name);
    if (entry === undefined) throw new Error(`stage ${name} missing from the per-stage raw execution binding`);
    return entry;
  };
  // The KS service stages all execute inside the pinned service, bound by its bytes.
  for (const stageName of ["INGESTION", "SEMANTICS", "ANALYSIS", "CANDIDATE"]) {
    assert.equal(stageEntry(stageName).executorSha256, rawResults.service.serverSha256, `${stageName} executes in the pinned KS service`);
  }
  // PROJECTION binds the canonical transport produced from the raw artifact.
  assert.equal(stageEntry("PROJECTION").inputSha256, rawResults.inputHeads.rawArtifactSha256);
  assert.equal(stageEntry("PROJECTION").outputSha256, rawResults.inputHeads.canonicalTransportSha256);
  // INGESTION is the real loopback POST of the canonical transport to the pinned service.
  assert.equal(stageEntry("INGESTION").inputSha256, rawResults.inputHeads.canonicalTransportSha256);
  assert.equal(stageEntry("INGESTION").outputSha256, rawResults.rawResponseSha256, "INGESTION output is the raw response bytes");
  assert.ok(stageEntry("INGESTION").command.includes("native-projection"), "INGESTION command names the real endpoint");
  assert.ok(stageEntry("INGESTION").command.includes("KS_ROOT="), "INGESTION command records the KS root");
  // ADJUDICATION is the independent PAN verifier, bound by its source bytes.
  assert.equal(stageEntry("ADJUDICATION").executorKind, "PAN_ADJUDICATOR");
  assert.equal(stageEntry("ADJUDICATION").executorSha256, v2Receipt.testedSource.adjudicatorSha256, "ADJUDICATION executor is the tested PAN adjudicator");
  assert.equal(stageEntry("ADJUDICATION").outputSha256, v2Receipt.baseAdjudicationDigest, "ADJUDICATION output is the base adjudication digest");
  // The input to the ADJUDICATION stage re-derives from the bound material (canonical form).
  const expectedAdjudicationInput = digest(Buffer.from(canonicalJson({
    canonicalTransportSha256: rawResults.inputHeads.canonicalTransportSha256,
    contextId: "pansphaira:xra-ps-02-native-context-001",
    candidate: realCandidate,
    rawArtifactSha256: rawResults.inputHeads.rawArtifactSha256,
  }), "utf8"));
  assert.equal(stageEntry("ADJUDICATION").inputSha256, expectedAdjudicationInput, "ADJUDICATION input re-derives from the bound transport + candidate");
});

// --- AC04 actual state comparison: before/after are real observations of the canonical
// Knowledge pin bytes and the KS registry/sidecar file bytes, sampled BEFORE service
// start (T0) and AFTER the five adjudications + wire falsifiers + mutation probe (T1),
// with a real mutation-route falsifier recorded. ---
test("GREEN: the before/after comparison is an actual state observation with a recorded mutation-route falsifier", () => {
  const observations = rawResults.beforeAfterObservations;
  assert.notEqual(observations, undefined, "raw results must record the before/after state observations");
  const before = observations.before;
  const after = observations.after;
  assert.ok(String(before.sampledAt).includes("T0"), "before is sampled at T0 (before service start and before any adjudication)");
  assert.ok(String(after.sampledAt).includes("T1"), "after is sampled at T1 (after the five outcomes, wire falsifiers, and mutation probe)");
  // Canonical Knowledge pin re-read from the frozen fixture at BOTH sample points.
  const pin = "d756437db8c991ee78ea7a9fcc7a9d4749daf8eebda51d5ba31fcc53e1b1242a";
  assert.equal(before.state.canonicalKnowledge.knowledgeId, "CKS-12-KNOWLEDGE-001");
  assert.equal(before.state.canonicalKnowledge.knowledgeSha256, pin, "T0 re-reads the canonical Knowledge pin bytes");
  assert.equal(after.state.canonicalKnowledge.knowledgeSha256, pin, "T1 re-reads the canonical Knowledge pin bytes");
  assert.equal(after.state.canonicalKnowledge.pinBytesSha256, before.state.canonicalKnowledge.pinBytesSha256, "pin bytes are unchanged between samples");
  assert.equal(after.state.canonicalKnowledge.pinFixtureSha256, before.state.canonicalKnowledge.pinFixtureSha256, "pin fixture bytes are unchanged between samples");
  // The flat release registry is HELD (no PAN authority granted) and the native sidecar is RELEASED.
  assert.equal(before.state.flatReleaseRegistry.status, "HELD");
  assert.equal(before.state.flatReleaseRegistry.releasedEntryCount, 0);
  assert.equal(before.state.nativeReleaseSidecar.status, "RELEASED");
  assert.equal(before.state.nativeReleaseSidecar.releasedEntryCount, 1);
  // The registry/sidecar file bytes are re-read at both sample points and are unchanged.
  assert.equal(after.state.flatReleaseRegistry.fileSha256, before.state.flatReleaseRegistry.fileSha256, "flat registry file bytes unchanged (no persistence)");
  assert.equal(after.state.nativeReleaseSidecar.fileSha256, before.state.nativeReleaseSidecar.fileSha256, "native sidecar file bytes unchanged (no persistence)");
  // The real mutation-route falsifier: the authority-free service refuses promotion.
  assert.deepEqual(after.mutationProbe, {
    label: "mutation",
    route: "/v1/pansphaira-analytics/promote",
    httpStatus: 400,
    code: "XRA_KS01_ROUTE_DENIED",
  }, "the mutation route is refused by the pinned service");
  // The live candidate authority block observed at T1 is authority-free.
  assert.equal(after.liveCandidateAuthority.mutate, false);
  assert.equal(after.liveCandidateAuthority.promote, false);
  assert.equal(after.liveCandidateAuthority.publish, false);
  assert.equal(after.liveCandidateAuthority.execute, false);
  assert.deepEqual(after.liveCandidateAuthority.capabilities, []);
  assert.deepEqual(after.liveCandidateAuthority.effects, []);
  // The derived before/after values remain the receipt-gated invariants.
  assert.equal(before.authority, "NONE");
  assert.equal(after.authority, "NONE");
  assert.equal(before.effect, "NONE");
  assert.equal(after.effect, "NONE");
  assert.equal(after.capabilityDelta, "NONE");
  // The service still reports the released native registry at T1 (still running at after-sample),
  // while the flat registry remains HELD.
  assert.deepEqual(after.headsNativeReleaseRegistry, rawResults.service.headsEndpoint.nativeReleaseRegistry);
  assert.equal(after.headsReleaseRegistry.status, "HELD");
  // Consistency: the receipt-gated before/after matches the observed pin.
  assert.equal(v2Receipt.rootQsExecution.beforeAfter.canonicalKnowledgeBeforeSha256, before.state.canonicalKnowledge.knowledgeSha256);
  assert.equal(v2Receipt.rootQsExecution.beforeAfter.canonicalKnowledgeAfterSha256, after.state.canonicalKnowledge.knowledgeSha256);
});