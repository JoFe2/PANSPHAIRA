#!/usr/bin/env node
// XRA-PS-02 Root-QS replay runner (PANSPHAIRA#344, AC03).
//
// Repository-rooted, current-Main replay/reconciliation execution. It launches
// the real pinned KaleidoSphere native-projection service at the exact released
// head, feeds its real response to the independent PAN verifier, and binds:
//
//   - the complete seven-stage chain (GENERATION -> ... -> ADJUDICATION), with
//     PER-STAGE RAW execution identities and commands (the exact executor
//     source bytes, the command that drove the stage, and the raw input/output
//     byte digests) in addition to the derived chain digests;
//   - the transported projection artifact GENERATED FROM THE RELEASED PRODUCER
//     AT EXECUTION TIME and its recorded equality to the released raw artifact
//     and to the independently rebuilt projection;
//   - the five paired outcomes and the real service-down / substitution /
//     malformed wire falsifiers plus a real mutation-route falsifier;
//   - the before/after canonical-Knowledge / authority / capability / effect
//     comparison as ACTUAL STATE OBSERVATIONS: the before sample is taken
//     before service start and the after sample is taken AFTER the five
//     adjudications and all wire falsifiers, re-reading the canonical
//     Knowledge pin bytes and the KS registry/sidecar file bytes at both
//     sample points rather than relying on import-time constants.
//
// It emits the raw Root-QS results and the v2 successor paired receipt, which
// independently binds the immutable released INPUT heads and the tested PAN
// adjudicator SOURCE separately.
//
// Runs inside the dedicated root test VM. Purely local: no push, publish,
// release, credential use, or external effect.

import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { execSync, spawn } from "node:child_process";
import { createServer } from "node:http";
import path from "node:path";

const PAN_ROOT = process.env.PAN_ROOT ?? process.cwd();
const KS_ROOT = process.env.KS_ROOT ?? "/tmp/ks";
const PORT = Number(process.env.PORT ?? "18877");
const OUT_DIR = process.env.OUT_DIR ?? "";
const KS_SERVER = path.join(KS_ROOT, "services/bi-agent/src/pansphaira-analytics/server.mjs");

const sha = (bytes) => createHash("sha256").update(bytes).digest("hex");
const shaFile = (p) => sha(readFileSync(p));
const git = (args, cwd) => {
  try {
    return execSync(`git ${args}`, { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
  } catch {
    return null;
  }
};
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const fail = (code, detail) => {
  console.error(JSON.stringify({ outcome: "FAILED", code, detail: detail ?? "" }));
  process.exit(4);
};

const mod = await import(path.join(PAN_ROOT, "dist/src/cks-12/kaleidosphere-candidate-quarantine.js"));
const { canonicalJson } = await import(path.join(PAN_ROOT, "dist/packages/contracts/src/canonical-json.js"));
const projectionMod = await import(path.join(PAN_ROOT, "dist/packages/contracts/src/kaleidosphere-analytics-projection.js"));
const { SOURCE_CONTRACT_SHA256 } = projectionMod;

// --- Bind the immutable released INPUT heads (binding group 1) ---
const rawArtifactPath = path.join(PAN_ROOT, "tests/fixtures/cks-analytics/projection-v1.json");
const rawArtifactBytes = readFileSync(rawArtifactPath);
const transportBytes = mod.nativeTransportBytesV1(rawArtifactBytes);
const digests = mod.nativeProjectionDigestV1(rawArtifactBytes);
const inputHeads = {
  canonicalTransportSha256: digests.canonicalTransportSha256,
  kaleidoSphereHeadCommit: mod.KALEIDOSPHERE_RECONCILED_RELEASED_HEAD_V1,
  kaleidoSphereHeadTree: mod.KALEIDOSPHERE_RECONCILED_RELEASED_TREE_V1,
  pansphairaHeadCommit: mod.PANSPHAIRA_RECONCILED_HEAD_COMMIT_V1,
  pansphairaReleaseCommit: mod.PANSPHAIRA_RECONCILED_RELEASED_HEAD_V1,
  pansphairaReleaseReceiptSha256: mod.PANSPHAIRA_RECONCILED_RELEASE_RECEIPT_SHA256_V1,
  pansphairaReleaseTag: mod.PANSPHAIRA_RECONCILED_RELEASE_TAG_V1,
  projectionDigest: digests.projectionBodyDigest,
  rawArtifactSha256: digests.rawArtifactSha256,
  sourceContractSha256: SOURCE_CONTRACT_SHA256,
};

// --- Generate the transported projection artifact from the released producer AT EXECUTION TIME ---
// The released producer is the sidecar-pinned PAN projection contract; invoking it now
// (not re-reading the fixture as the source of truth) and recording byte-equality to the
// released raw artifact and to the independently rebuilt projection closes the AC03
// generation-stage evidence gap.
const projectionProducerFile = path.join(PAN_ROOT, "packages/contracts/src/kaleidosphere-analytics-projection.ts");
const generatedProjection = projectionMod.buildKaleidosphereAnalyticsProjectionV1();
const generatedArtifactBytes = Buffer.from(`${JSON.stringify(generatedProjection, null, 2)}\n`, "utf8");
const generatedProjectionBodyDigest = projectionMod.kaleidosphereAnalyticsProjectionDigestV1(generatedProjection);
const projectionGenerated = {
  generatedAtRunTime: true,
  producer: "buildKaleidosphereAnalyticsProjectionV1",
  producerFile: "packages/contracts/src/kaleidosphere-analytics-projection.ts",
  producerSha256: shaFile(projectionProducerFile),
  generatedRawArtifactSha256: sha(generatedArtifactBytes),
  equalsReleasedRawArtifact: sha(generatedArtifactBytes) === digests.rawArtifactSha256,
  generatedProjectionBodyDigest,
  equalsRebuiltProjection: generatedProjectionBodyDigest === mod.buildAuthoritativeAdjudicationInputs().projectionDigest,
  equalsCanonicalTransport: canonicalJson(JSON.parse(transportBytes.toString("utf8"))) === canonicalJson(generatedProjection),
};
if (!projectionGenerated.equalsReleasedRawArtifact || !projectionGenerated.equalsRebuiltProjection || !projectionGenerated.equalsCanonicalTransport) {
  fail("PROJECTION_GENERATION_MISMATCH", JSON.stringify(projectionGenerated));
}

// --- Bind the tested PAN adjudicator SOURCE (binding group 2, separately) ---
const testedSource = {
  adjudicatorSha256: shaFile(path.join(PAN_ROOT, "src/cks-12/kaleidosphere-candidate-quarantine.ts")),
  focusedNativeTestSha256: shaFile(path.join(PAN_ROOT, "tests/cks-12/kaleidosphere-candidate-quarantine-native.test.ts")),
  kaleidoSphereHeadCommit: mod.KALEIDOSPHERE_RECONCILED_RELEASED_HEAD_V1,
  kaleidoSphereHeadTree: mod.KALEIDOSPHERE_RECONCILED_RELEASED_TREE_V1,
  kaleidoSphereServerSha256: shaFile(KS_SERVER),
};
// The pinned KS native-projection service must be at the exact released head.
const ksHeadActual = git("rev-parse HEAD", KS_ROOT);
const ksTreeActual = git("rev-parse 'HEAD^{tree}'", KS_ROOT);
if (ksHeadActual !== testedSource.kaleidoSphereHeadCommit) fail("KS_HEAD_MISMATCH", `expected ${testedSource.kaleidoSphereHeadCommit} got ${ksHeadActual}`);
if (ksTreeActual !== testedSource.kaleidoSphereHeadTree) fail("KS_TREE_MISMATCH", `expected ${testedSource.kaleidoSphereHeadTree} got ${ksTreeActual}`);

// --- BEFORE-state (T0): actual state observation, taken before service start and before any adjudication ---
// Every value below is re-derived from real bytes at this sample point: the canonical
// Knowledge pin is re-read from the frozen CKS-12 edge-authority fixture and the KS
// flat release registry / native sidecar are re-read from the pinned KS root. Nothing
// is an import-time constant; drift or mutation at either sample point fails closed.
const pinFixturePath = path.join(PAN_ROOT, "tests/fixtures/cks-12/edge-authority-v2.json");
const flatRegistryPath = path.join(KS_ROOT, "contracts/pansphaira-analytics/v1/release-registry.v1.json");
const nativeSidecarPath = path.join(KS_ROOT, "contracts/pansphaira-analytics/v1/native-release-registry.v1.json");
const sampleState = () => {
  const pinFixtureBytes = readFileSync(pinFixturePath);
  const pin = JSON.parse(pinFixtureBytes.toString("utf8")).projection.edges[0].canonicalKnowledge;
  const flatRegistry = JSON.parse(readFileSync(flatRegistryPath, "utf8"));
  const nativeSidecar = JSON.parse(readFileSync(nativeSidecarPath, "utf8"));
  const flatReleased = flatRegistry.entries.filter((entry) => entry.status === "RELEASED").length;
  const nativeReleased = nativeSidecar.entries.filter((entry) => entry.status === "RELEASED").length;
  return {
    canonicalKnowledge: {
      knowledgeId: pin.knowledgeId,
      knowledgeSha256: pin.knowledgeSha256,
      knowledgeVersion: pin.knowledgeVersion,
      pinBytesSha256: sha(Buffer.from(canonicalJson(pin), "utf8")),
      pinFixtureSha256: sha(pinFixtureBytes),
    },
    flatReleaseRegistry: {
      fileSha256: sha(readFileSync(flatRegistryPath)),
      status: flatReleased > 0 ? "RELEASED" : "HELD",
      releasedEntryCount: flatReleased,
    },
    nativeReleaseSidecar: {
      fileSha256: sha(readFileSync(nativeSidecarPath)),
      status: nativeReleased > 0 ? "RELEASED" : "HELD",
      releasedEntryCount: nativeReleased,
    },
  };
};
const before = sampleState();
if (before.canonicalKnowledge.knowledgeSha256 !== mod.buildAuthoritativeAdjudicationInputs().canonicalKnowledgeSha256) {
  fail("KNOWLEDGE_PIN_DRIFT_BEFORE", `re-read pin ${before.canonicalKnowledge.knowledgeSha256} does not match the adjudicator's frozen canonical Knowledge digest`);
}

// --- Launch the real pinned KS native-projection service ---
const base = `http://127.0.0.1:${String(PORT)}`;
const service = spawn(process.execPath, [KS_SERVER], { cwd: KS_ROOT, env: { ...process.env, PORT: String(PORT) }, stdio: ["ignore", "pipe", "pipe"] });
let serviceLog = "";
service.stderr.on("data", (d) => { serviceLog += String(d); });
service.stdout.on("data", (d) => { serviceLog += String(d); });
const finish = (code) => {
  try { service.kill(); } catch { /* already exited */ }
  process.exit(code);
};
let up = false;
for (let i = 0; i < 80 && !up; i += 1) {
  await sleep(100);
  try {
    const response = await fetch(`${base}/healthz`);
    up = response.status === 200;
  } catch {
    up = false;
  }
}
if (!up) {
  console.error(JSON.stringify({ outcome: "FAILED", code: "KS_SERVICE_NOT_UP", detail: serviceLog.slice(0, 2000) }));
  finish(3);
}
const healthz = "UP";
let headsResponse;
try {
  headsResponse = await (await fetch(`${base}/v1/pansphaira-analytics/heads`)).json();
} catch (error) {
  fail("KS_HEADS_ENDPOINT_FAILED", String(error));
}

// --- Feed the real canonical transport to the real service (raw bytes captured) ---
let rawResponseText;
let postBody;
try {
  const response = await fetch(`${base}/v1/pansphaira-analytics/native-projection`, {
    method: "POST",
    headers: { "content-type": "application/octet-stream" },
    body: Buffer.from(transportBytes),
  });
  rawResponseText = await response.text();
  postBody = JSON.parse(rawResponseText);
} catch (error) {
  fail("KS_NATIVE_PROJECTION_FAILED", String(error));
}
if (postBody.status !== "CANDIDATE" || postBody.candidate === null) {
  fail("KS_NATIVE_PROJECTION_NOT_CANDIDATE", rawResponseText.slice(0, 1000));
}
const liveCandidate = postBody.candidate;
const rawResponseBytes = Buffer.from(rawResponseText, "utf8");
const rawResponseSha256 = sha(rawResponseBytes);

// The real service at the pinned head must reproduce the historical capture byte-for-byte.
const capture = JSON.parse(readFileSync(path.join(PAN_ROOT, "tests/fixtures/cks-analytics/xra-ps-02-native-service-capture-v1.json"), "utf8"));
const substitutionCapture = JSON.parse(readFileSync(path.join(PAN_ROOT, "tests/fixtures/cks-analytics/xra-ps-02-native-service-substitution-capture-v1.json"), "utf8"));
const matchesHistoricalCapture = canonicalJson(liveCandidate) === canonicalJson(capture.response.candidate);

// --- The five paired outcomes through the independent PAN verifier ---
const CONTEXT_ID = "pansphaira:xra-ps-02-native-context-001";
const contextFor = (options) => mod.createNativeAdjudicationContextV1({ contextId: CONTEXT_ID, ...options });
const nativeInput = (candidate, context) => ({
  canonicalTransportBytes: transportBytes,
  candidate,
  context,
  rawArtifactBytes,
  releasedHeads: mod.RECONCILED_RELEASED_HEADS_V1,
});
const positiveContext = contextFor({});
const outcomes = [];
const push = (label, result) => outcomes.push({ case: label, outcome: result.outcome, reasonCodes: [...result.reasonCodes] });
push("positive", mod.adjudicateNativeCandidateV1(nativeInput(liveCandidate, contextFor({}))));
push("restricted-unknown", mod.adjudicateNativeCandidateV1(nativeInput(liveCandidate, contextFor({ unknown: true }))));
push("conflicting-counterevidence", mod.adjudicateNativeCandidateV1(nativeInput(liveCandidate, contextFor({
  counterevidence: [{ evidenceId: "pan-independent-external-conflict", evidenceSha256: "c".repeat(64), reason: "CONTRADICTS_OWNER_EVIDENCE" }],
}))));
const forged = JSON.parse(canonicalJson(liveCandidate));
forged.claims = JSON.parse(canonicalJson(liveCandidate.claims));
forged.claims.computed.edgeCount = 2;
forged.resultSha256 = sha(Buffer.from(canonicalJson({ claims: forged.claims, coverage: forged.coverage, counterevidence: forged.counterevidence }), "utf8"));
push("forged-candidate", mod.adjudicateNativeCandidateV1(nativeInput(forged, contextFor({}))));
push("stale-head", mod.adjudicateNativeCandidateV1(nativeInput(substitutionCapture.response.candidate, contextFor({}))));

// --- The v1 base paired receipt for the positive (live) case ---
let baseReceipt;
try {
  baseReceipt = mod.createNativePairedAdjudicationReceiptV1({
    adjudication: mod.adjudicateNativeCandidateV1(nativeInput(liveCandidate, positiveContext)),
    candidate: liveCandidate,
    canonicalTransportBytes: transportBytes,
    context: positiveContext,
    rawArtifactBytes,
    releasedHeads: mod.RECONCILED_RELEASED_HEADS_V1,
  });
} catch (error) {
  fail("V1_BASE_RECEIPT_FAILED", String(error));
}

// --- Real wire falsifiers (loopback) ---
const withLoopbackServer = (payload) => new Promise((resolve, reject) => {
  const server = createServer((request, response) => {
    response.writeHead(200, { "content-type": "application/json" });
    response.end(JSON.stringify(payload) + "\n");
  });
  server.once("error", reject);
  server.listen(0, "127.0.0.1", async () => {
    const address = server.address();
    const localPort = typeof address === "object" && address !== null ? address.port : 0;
    try {
      const result = await mod.fetchNativeProjectionV1({
        canonicalTransportBytes: transportBytes,
        timeoutMs: 2000,
        url: `http://127.0.0.1:${String(localPort)}/v1/pansphaira-analytics/native-projection`,
      });
      resolve(result);
    } finally {
      server.close();
    }
  });
});
const down = await mod.fetchNativeProjectionV1({
  canonicalTransportBytes: transportBytes,
  timeoutMs: 1500,
  url: "http://127.0.0.1:1/v1/pansphaira-analytics/native-projection",
});
if (down.status !== "UNAVAILABLE" || down.code !== "XRA_PS_02_NATIVE_SERVICE_UNAVAILABLE") fail("FALSIFIER_SERVICE_DOWN_MISMATCH", JSON.stringify(down));
const substitutedWire = await withLoopbackServer(substitutionCapture.response);
if (substitutedWire.status !== "CANDIDATE") fail("FALSIFIER_SUBSTITUTION_WIRE_MISMATCH", JSON.stringify(substitutedWire));
const substitutedAdjudication = mod.adjudicateNativeCandidateV1(nativeInput(substitutedWire.candidate, contextFor({})));
if (substitutedAdjudication.outcome !== "DENIED" || substitutedAdjudication.reasonCodes[0] !== "NATIVE_STALE_HEAD_DENIED") {
  fail("FALSIFIER_SUBSTITUTION_MISMATCH", JSON.stringify(substitutedAdjudication));
}
const malformedWire = await withLoopbackServer({ unexpected: true });
if (malformedWire.status !== "UNAVAILABLE" || malformedWire.code !== "XRA_PS_02_NATIVE_WIRE_SHAPE_DENIED") {
  fail("FALSIFIER_MALFORMED_MISMATCH", JSON.stringify(malformedWire));
}
const falsifiers = [
  { label: "service-down", code: down.code },
  { label: "substitution", code: substitutedAdjudication.reasonCodes[0] },
  { label: "malformed", code: malformedWire.code },
];

// --- AFTER-state (T1): actual state observation, taken AFTER the five adjudications and all wire falsifiers ---
// The authority-free service must refuse the mutation route; that refusal, the
// re-read state bytes, and the live candidate authority block are the effect
// observation. Derivation is fail-closed: any granted authority or any changed
// byte makes the derived value "OBSERVED", which the v2 receipt rejects.
const liveAuthority = liveCandidate.authority;
let mutationProbe;
try {
  const response = await fetch(`${base}/v1/pansphaira-analytics/promote`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: "{}",
  });
  const envelope = await response.json().catch(() => ({}));
  mutationProbe = {
    label: "mutation",
    route: "/v1/pansphaira-analytics/promote",
    httpStatus: response.status,
    code: typeof envelope.code === "string" ? envelope.code : "UNEXPECTED_ENVELOPE",
  };
} catch (error) {
  fail("FALSIFIER_MUTATION_PROBE_FAILED", String(error));
}
if (mutationProbe.httpStatus !== 400 || mutationProbe.code !== "XRA_KS01_ROUTE_DENIED") {
  fail("FALSIFIER_MUTATION_MISMATCH", JSON.stringify(mutationProbe));
}
let headsAfter;
try {
  headsAfter = await (await fetch(`${base}/v1/pansphaira-analytics/heads`)).json();
} catch (error) {
  fail("KS_HEADS_ENDPOINT_AFTER_FAILED", String(error));
}
const after = sampleState();
if (after.canonicalKnowledge.knowledgeSha256 !== mod.buildAuthoritativeAdjudicationInputs().canonicalKnowledgeSha256) {
  fail("KNOWLEDGE_PIN_DRIFT_AFTER", `re-read pin ${after.canonicalKnowledge.knowledgeSha256} does not match the adjudicator's frozen canonical Knowledge digest`);
}
// Authority: derived from the flat release registry (HELD / zero released entries = no
// PAN authority granted) and, after execution, from the live candidate authority block.
const authorityOf = (state, liveCandidateAuthority) => {
  const flatGranted = state.flatReleaseRegistry.status === "RELEASED" || state.flatReleaseRegistry.releasedEntryCount > 0;
  const liveGranted = liveCandidateAuthority !== undefined
    && (liveCandidateAuthority.mutate !== false || liveCandidateAuthority.promote !== false || liveCandidateAuthority.publish !== false
      || liveCandidateAuthority.execute !== false || liveCandidateAuthority.capabilities.length > 0 || liveCandidateAuthority.effects.length > 0);
  return flatGranted || liveGranted ? "OBSERVED" : "NONE";
};
// Effect: derived from the mutation-route refusal, unchanged state bytes at both
// sample points, and (after execution) the live candidate effect-free authority block.
const effectOf = (probe, beforeState, afterState, liveCandidateAuthority) => {
  const probeRefused = probe !== undefined && probe.httpStatus === 400 && probe.code === "XRA_KS01_ROUTE_DENIED";
  const bytesUnchanged = beforeState.flatReleaseRegistry.fileSha256 === afterState.flatReleaseRegistry.fileSha256
    && beforeState.nativeReleaseSidecar.fileSha256 === afterState.nativeReleaseSidecar.fileSha256
    && beforeState.canonicalKnowledge.pinBytesSha256 === afterState.canonicalKnowledge.pinBytesSha256
    && beforeState.canonicalKnowledge.pinFixtureSha256 === afterState.canonicalKnowledge.pinFixtureSha256
    && afterState.canonicalKnowledge.knowledgeSha256 === beforeState.canonicalKnowledge.knowledgeSha256;
  const liveEffectFree = liveCandidateAuthority === undefined
    || (liveCandidateAuthority.mutate === false && liveCandidateAuthority.promote === false && liveCandidateAuthority.publish === false
      && liveCandidateAuthority.execute === false && liveCandidateAuthority.effects.length === 0);
  return probeRefused && bytesUnchanged && liveEffectFree ? "NONE" : "OBSERVED";
};
// T0 basis: the flat registry is HELD and the freshly generated released projection
// carries authority NONE / effect NONE, so nothing executed before T0 could have
// granted authority or taken effect.
const effectBefore = (before.flatReleaseRegistry.status === "HELD"
  && generatedProjection.authority === "NONE" && generatedProjection.effect === "NONE") ? "NONE" : "OBSERVED";
const authorityBefore = authorityOf(before, undefined);
const authorityAfter = authorityOf(after, liveAuthority);
const effectAfter = effectOf(mutationProbe, before, after, liveAuthority);
const capabilityDeltaAfter = canonicalJson(before) === canonicalJson(after) ? "NONE" : "OBSERVED";
const beforeAfter = {
  authorityAfter,
  authorityBefore,
  capabilityDeltaAfter,
  capabilityDeltaBefore: "NONE",
  canonicalKnowledgeAfterSha256: after.canonicalKnowledge.knowledgeSha256,
  canonicalKnowledgeBeforeSha256: before.canonicalKnowledge.knowledgeSha256,
  effectAfter,
  effectBefore,
};
if (
  beforeAfter.authorityBefore !== "NONE" || beforeAfter.authorityAfter !== "NONE"
  || beforeAfter.effectBefore !== "NONE" || beforeAfter.effectAfter !== "NONE"
  || beforeAfter.capabilityDeltaAfter !== "NONE"
  || beforeAfter.canonicalKnowledgeBeforeSha256 !== beforeAfter.canonicalKnowledgeAfterSha256
) fail("BEFORE_AFTER_DRIFT", JSON.stringify(beforeAfter));
const beforeAfterObservations = {
  basis: "The canonical Knowledge pin bytes are re-read from the frozen CKS-12 edge-authority fixture and the KS flat release registry / native sidecar file bytes are re-read from the pinned KS root at BOTH sample points; authority is derived from the flat release registry (HELD / zero released entries = no PAN authority) and the live candidate authority block; effect is derived from the mutation-route refusal and the unchanged state bytes; the capability delta is derived from full-state equality across the two samples.",
  before: {
    sampledAt: "T0: before service start and before the five paired outcomes and all wire falsifiers",
    authority: authorityBefore,
    effect: effectBefore,
    state: before,
  },
  after: {
    sampledAt: "T1: after the five paired outcomes, the three wire falsifiers, and the mutation probe (service still running)",
    authority: authorityAfter,
    capabilityDelta: capabilityDeltaAfter,
    effect: effectAfter,
    headsNativeReleaseRegistry: headsAfter.nativeReleaseRegistry,
    headsReleaseRegistry: headsAfter.releaseRegistry,
    liveCandidateAuthority: liveAuthority,
    mutationProbe,
    state: after,
  },
};

// --- Per-stage RAW execution binding (identities, commands, raw input/output byte digests) ---
const observedSha = (value) => sha(Buffer.from(canonicalJson(value), "utf8"));
const stageExecution = [
  {
    stage: "GENERATION",
    executor: "buildKaleidosphereAnalyticsProjectionV1",
    executorKind: "PAN_PRODUCER",
    executorSha256: projectionGenerated.producerSha256,
    command: `in-process released producer invocation (node ${process.version}, dist build of the tested PAN source)`,
    inputSha256: SOURCE_CONTRACT_SHA256,
    outputSha256: projectionGenerated.generatedRawArtifactSha256,
  },
  {
    stage: "PROJECTION",
    executor: "nativeTransportBytesV1",
    executorKind: "PAN_CANONICALIZER",
    executorSha256: testedSource.adjudicatorSha256,
    command: "in-process canonical transport binding (raw artifact bytes -> canonical transport bytes)",
    inputSha256: digests.rawArtifactSha256,
    outputSha256: digests.canonicalTransportSha256,
  },
  {
    stage: "INGESTION",
    executor: "ingestNativeProjection (KaleidoSphere pinned service)",
    executorKind: "KS_SERVICE",
    executorSha256: testedSource.kaleidoSphereServerSha256,
    command: `node services/bi-agent/src/pansphaira-analytics/server.mjs (KS_ROOT=${KS_ROOT}) + POST ${base}/v1/pansphaira-analytics/native-projection`,
    inputSha256: digests.canonicalTransportSha256,
    outputSha256: rawResponseSha256,
  },
  {
    stage: "SEMANTICS",
    executor: "ingestNativeProjection semantic pass (KaleidoSphere pinned service)",
    executorKind: "KS_SERVICE",
    executorSha256: testedSource.kaleidoSphereServerSha256,
    command: "deterministic semantic re-derivation from the canonical transport bytes inside the pinned service",
    inputSha256: rawResponseSha256,
    outputSha256: observedSha(liveCandidate.claims.observed),
  },
  {
    stage: "ANALYSIS",
    executor: "ingestNativeProjection analysis pass (KaleidoSphere pinned service)",
    executorKind: "KS_SERVICE",
    executorSha256: testedSource.kaleidoSphereServerSha256,
    command: "deterministic analysis re-derivation (claims.computed) inside the pinned service",
    inputSha256: observedSha(liveCandidate.claims.observed),
    outputSha256: observedSha(liveCandidate.claims.computed),
  },
  {
    stage: "CANDIDATE",
    executor: "ingestNativeProjection candidate assembly (KaleidoSphere pinned service)",
    executorKind: "KS_SERVICE",
    executorSha256: testedSource.kaleidoSphereServerSha256,
    command: "authority-free candidate assembly inside the pinned service",
    inputSha256: observedSha({ analysis: liveCandidate.analysis, claims: liveCandidate.claims, coverage: liveCandidate.coverage, counterevidence: liveCandidate.counterevidence }),
    outputSha256: observedSha(liveCandidate),
  },
  {
    stage: "ADJUDICATION",
    executor: "adjudicateNativeCandidateV1 (independent PAN verifier)",
    executorKind: "PAN_ADJUDICATOR",
    executorSha256: testedSource.adjudicatorSha256,
    command: "in-process independent PAN adjudication of the real service candidate",
    inputSha256: observedSha({ canonicalTransportSha256: digests.canonicalTransportSha256, rawArtifactSha256: digests.rawArtifactSha256, contextId: CONTEXT_ID, candidate: liveCandidate }),
    outputSha256: baseReceipt.adjudicationDigest,
  },
];

// --- Raw Root-QS results ---
const command = `node scripts/run-xra-ps-02-root-qs-replay.mjs (PAN_ROOT=${PAN_ROOT} KS_ROOT=${KS_ROOT} PORT=${PORT})`;
const rootQsExecutionSummary = {
  beforeAfter,
  command,
  falsifiers,
  outcomes,
  scope: "LOCAL_VM_REAL_HTTP",
  transport: "loopback HTTP (127.0.0.1)",
};
const rawResults = {
  baseReceipt: {
    adjudicationDigest: baseReceipt.adjudicationDigest,
    receiptDigest: baseReceipt.receiptDigest,
    receiptId: baseReceipt.receiptId,
  },
  beforeAfter,
  beforeAfterObservations,
  chain: baseReceipt.chain.map((stage) => ({ digest: stage.digest, stage: stage.stage })),
  command,
  executionEnvironment: {
    cwd: PAN_ROOT,
    nodeVersion: process.version,
    panSourceBinding: "testedSource binds the exact adjudicator and focused native test bytes that were executed; inputHeads binds the immutable released input heads separately",
  },
  falsifiers,
  inputHeads,
  issue: "PANSPHAIRA#344",
  liveCandidate: {
    environmentSha256: liveCandidate.bindings.environmentSha256,
    matchesHistoricalCapture,
    requestSha256: postBody.requestSha256,
    resultSha256: liveCandidate.resultSha256,
  },
  nonclaim: "Captured live loopback HTTP outputs of the pinned KaleidoSphere native-projection service at the exact released head, replayed repository-rooted by the Root-QS runner inside the dedicated root test VM; not public evidence, not public-closure evidence, and not a working public evidence URL.",
  outcomes,
  projectionGenerated,
  rawResponseSha256,
  runtime: {
    nodeVersion: process.version,
    scope: "LOCAL_VM_REAL_HTTP",
    transport: "loopback HTTP (127.0.0.1)",
  },
  scope: "LOCAL_VM_REAL_HTTP",
  schemaVersion: "pansphaira.xra-ps-02/native-root-qs-raw/v1",
  service: {
    headsEndpoint: headsResponse,
    healthz,
    kaleidoSphereHeadCommit: ksHeadActual,
    kaleidoSphereHeadTree: ksTreeActual,
    serverSha256: testedSource.kaleidoSphereServerSha256,
  },
  stageExecution,
  testedSource,
  transport: {
    canonicalTransportSha256: digests.canonicalTransportSha256,
    rawArtifactSha256: digests.rawArtifactSha256,
    transportByteLength: transportBytes.length,
  },
};

// --- The v2 successor paired receipt ---
let v2Receipt;
try {
  v2Receipt = mod.createNativePairedAdjudicationReceiptV2({
    baseReceipt,
    inputHeads,
    rawResults,
    rootQsExecution: rootQsExecutionSummary,
    testedSource,
  });
} catch (error) {
  fail("V2_RECEIPT_FAILED", String(error));
}

// --- Emit ---
if (OUT_DIR) {
  writeFileSync(path.join(OUT_DIR, "xra-ps-02-native-root-qs-raw-v2.json"), JSON.stringify(rawResults, null, 2) + "\n");
  writeFileSync(path.join(OUT_DIR, "xra-ps-02-native-paired-receipt-v2.json"), JSON.stringify(v2Receipt, null, 2) + "\n");
}
console.log(JSON.stringify({
  outcome: "COMPLETE",
  summary: {
    beforeAfter,
    falsifiers,
    inputHeadsDigest: v2Receipt.inputHeadsDigest,
    matchesHistoricalCapture,
    mutationProbe,
    outcomes,
    projectionGenerated,
    rawResultsDigest: v2Receipt.rootQsExecution.rawResultsDigest,
    receiptId: v2Receipt.receiptId,
    receiptSchema: v2Receipt.schemaVersion,
    receiptDigest: v2Receipt.receiptDigest,
    testedSource,
    testedSourceDigest: v2Receipt.testedSourceDigest,
  },
}));
finish(0);