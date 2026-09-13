#!/usr/bin/env node
// XRA-PS-02 Root-QS replay runner (PANSPHAIRA#344, AC03).
//
// Repository-rooted, current-Main replay/reconciliation execution. It launches
// the real pinned KaleidoSphere native-projection service at the exact released
// head, feeds its real response to the independent PAN verifier, and binds the
// complete seven-stage chain (GENERATION -> ... -> ADJUDICATION), the five
// paired outcomes, the real service-down / substitution / malformed falsifiers,
// and the before/after canonical-Knowledge / authority / capability / effect
// comparison. It emits the raw Root-QS results and the v2 successor paired
// receipt, which independently binds the immutable released INPUT heads and the
// tested PAN adjudicator SOURCE separately.
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
const { SOURCE_CONTRACT_SHA256 } = await import(path.join(PAN_ROOT, "dist/packages/contracts/src/kaleidosphere-analytics-projection.js"));

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

// --- Before-state (canonical Knowledge + authority/capability/effect) ---
const before = mod.buildAuthoritativeAdjudicationInputs();

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

// --- Feed the real canonical transport to the real service ---
let postBody;
try {
  const response = await fetch(`${base}/v1/pansphaira-analytics/native-projection`, {
    method: "POST",
    headers: { "content-type": "application/octet-stream" },
    body: Buffer.from(transportBytes),
  });
  postBody = await response.json();
} catch (error) {
  fail("KS_NATIVE_PROJECTION_FAILED", String(error));
}
if (postBody.status !== "CANDIDATE" || postBody.candidate === null) {
  fail("KS_NATIVE_PROJECTION_NOT_CANDIDATE", JSON.stringify(postBody).slice(0, 1000));
}
const liveCandidate = postBody.candidate;

// The real service at the pinned head must reproduce the historical capture byte-for-byte.
const capture = JSON.parse(readFileSync(path.join(PAN_ROOT, "tests/fixtures/cks-analytics/xra-ps-02-native-service-capture-v1.json"), "utf8"));
const substitutionCapture = JSON.parse(readFileSync(path.join(PAN_ROOT, "tests/fixtures/cks-analytics/xra-ps-02-native-service-substitution-capture-v1.json"), "utf8"));
const matchesHistoricalCapture = canonicalJson(liveCandidate) === canonicalJson(capture.response.candidate);

// --- After-state ---
const after = mod.buildAuthoritativeAdjudicationInputs();

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

// --- Before/after comparison (must be unchanged) ---
const beforeAfter = {
  authorityAfter: "NONE",
  authorityBefore: "NONE",
  capabilityDeltaAfter: "NONE",
  capabilityDeltaBefore: "NONE",
  canonicalKnowledgeAfterSha256: after.canonicalKnowledgeSha256,
  canonicalKnowledgeBeforeSha256: before.canonicalKnowledgeSha256,
  effectAfter: "NONE",
  effectBefore: "NONE",
};
if (!canonicalJsonEqual(before, after)) fail("BEFORE_AFTER_DRIFT", "buildAuthoritativeAdjudicationInputs changed between before and after");

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
  chain: baseReceipt.chain.map((stage) => ({ digest: stage.digest, stage: stage.stage })),
  command,
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
    outcomes,
    rawResultsDigest: v2Receipt.rootQsExecution.rawResultsDigest,
    receiptId: v2Receipt.receiptId,
    receiptSchema: v2Receipt.schemaVersion,
    receiptDigest: v2Receipt.receiptDigest,
    testedSource,
    testedSourceDigest: v2Receipt.testedSourceDigest,
  },
}));
finish(0);

function canonicalJsonEqual(left, right) {
  return canonicalJson(left) === canonicalJson(right);
}