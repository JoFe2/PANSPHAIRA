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
import { SOURCE_CONTRACT_SHA256 } from "../../packages/contracts/src/kaleidosphere-analytics-projection.js";

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