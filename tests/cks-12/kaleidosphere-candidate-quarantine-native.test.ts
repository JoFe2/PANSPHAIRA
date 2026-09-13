import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createServer } from "node:http";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

import {
  ADJUDICATION_CHAIN_STAGES,
  buildAuthoritativeAdjudicationInputs,
  adjudicateNativeCandidateV1,
  createNativeAdjudicationContextV1,
  createNativePairedAdjudicationReceiptV1,
  fetchNativeProjectionV1,
  nativeCandidateDigestV1,
  nativeProjectionDigestV1,
  nativeTransportBytesV1,
  RECONCILED_RELEASED_HEADS_V1,
  KALEIDOSPHERE_RECONCILED_RELEASED_HEAD_V1,
  PANSPHAIRA_RECONCILED_RELEASED_HEAD_V1,
  verifyNativePairedAdjudicationReceiptV1,
} from "../../src/cks-12/kaleidosphere-candidate-quarantine.js";

const root = process.cwd();
const fixture = (name: string): string => path.join(root, "tests/fixtures/cks-analytics", name);

const capture = JSON.parse(readFileSync(fixture("xra-ps-02-native-service-capture-v1.json"), "utf8")) as Record<string, any>;
const substitutionCapture = JSON.parse(readFileSync(fixture("xra-ps-02-native-service-substitution-capture-v1.json"), "utf8")) as Record<string, any>;
const rawArtifactBytes = readFileSync(fixture("projection-v1.json"));
const transportBytes = nativeTransportBytesV1(rawArtifactBytes);
const digests = nativeProjectionDigestV1(rawArtifactBytes);
const realCandidate = capture.response.candidate;
const substitutionCandidate = substitutionCapture.response.candidate;
const emptyContext = () => createNativeAdjudicationContextV1({ contextId: "pansphaira:xra-ps-02-native-context-001" });
const nativeInput = (candidate: unknown, context: ReturnType<typeof emptyContext> = emptyContext()) => ({
  canonicalTransportBytes: transportBytes,
  candidate,
  context,
  rawArtifactBytes,
  releasedHeads: RECONCILED_RELEASED_HEADS_V1,
});

const CLEAN_ROOM_RUNNER = `
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
const root = process.cwd();
const mod = await import(path.join(root, "dist/src/cks-12/kaleidosphere-candidate-quarantine.js"));
const { canonicalJson } = await import(path.join(root, "packages/contracts/src/canonical-json.js"));
const sha = (bytes) => createHash("sha256").update(bytes).digest("hex");
const capture = JSON.parse(readFileSync(path.join(root, "tests/fixtures/cks-analytics/xra-ps-02-native-service-capture-v1.json"), "utf8"));
const substitutionCapture = JSON.parse(readFileSync(path.join(root, "tests/fixtures/cks-analytics/xra-ps-02-native-service-substitution-capture-v1.json"), "utf8"));
const rawArtifactBytes = readFileSync(path.join(root, "tests/fixtures/cks-analytics/projection-v1.json"));
const transportBytes = Buffer.from(canonicalJson(JSON.parse(rawArtifactBytes.toString("utf8"))), "utf8");
const caseName = process.argv[1];
const contextFor = (options) => mod.createNativeAdjudicationContextV1({ contextId: "pansphaira:xra-ps-02-native-context-001", ...options });
let candidate;
let context;
if (caseName === "positive") {
  candidate = capture.response.candidate;
  context = contextFor({});
} else if (caseName === "restricted-unknown") {
  candidate = capture.response.candidate;
  context = contextFor({ unknown: true });
} else if (caseName === "conflicting-counterevidence") {
  candidate = capture.response.candidate;
  context = contextFor({ counterevidence: [{ evidenceId: "pan-independent-external-conflict", evidenceSha256: "c".repeat(64), reason: "CONTRADICTS_OWNER_EVIDENCE" }] });
} else if (caseName === "forged-candidate") {
  const real = capture.response.candidate;
  const forged = JSON.parse(canonicalJson(real));
  forged.claims = JSON.parse(canonicalJson(real.claims));
  forged.claims.computed.edgeCount = 2;
  forged.resultSha256 = sha(Buffer.from(canonicalJson({ claims: forged.claims, coverage: forged.coverage, counterevidence: forged.counterevidence }), "utf8"));
  candidate = forged;
  context = contextFor({});
} else if (caseName === "stale-head") {
  candidate = substitutionCapture.response.candidate;
  context = contextFor({});
} else {
  console.error("UNKNOWN_CLEAN_ROOM_CASE");
  process.exit(2);
}
const result = mod.adjudicateNativeCandidateV1({ candidate, context, canonicalTransportBytes: transportBytes, rawArtifactBytes: rawArtifactBytes, releasedHeads: mod.RECONCILED_RELEASED_HEADS_V1 });
console.log(JSON.stringify({ case: caseName, outcome: result.outcome, reasonCodes: result.reasonCodes }));
`;

const runCleanRoomCase = (name: string): { case: string; outcome: string; reasonCodes: string[] } => {
  const output = execFileSync(process.execPath, ["--input-type=module", "-e", CLEAN_ROOM_RUNNER, name], { encoding: "utf8", cwd: root });
  return JSON.parse(output.trim());
};

test("XRA-PS-02 native AC01 independently adjudicates the real captured service candidate and keeps the service verdict non-authoritative", () => {
  const result = adjudicateNativeCandidateV1(nativeInput(realCandidate));
  assert.equal(result.outcome, "ACCEPTED_BOUNDED");
  assert.deepEqual(result.reasonCodes, ["NATIVE_EVIDENCE_ACCEPTED"]);
  assert.equal(result.authority, "NONE");
  assert.equal(result.capabilityDelta, "NONE");
  assert.equal(result.effect, "NONE");
  assert.equal(result.canonicalKnowledgeMutation, "NONE");
  assert.equal(result.kaleidoSphereServiceVerdictAuthoritative, false);
  assert.equal(result.rawArtifactSha256, "22f34bf33874a42cde5a5a23a2242935e8b2b145aa8e2364a5aef26b8ec3e6e8");
  assert.equal(result.canonicalTransportSha256, "91c26eb69860767ec2898a48676caaeb52c808de284bb0fbfbe8a986d30ad19c");
  assert.equal(result.projectionBodyDigest, "cc5f6cc9591ccf4b6b3c4b9f954aa9da09695b784d7abaa585c082aea195ef1b");
  assert.deepEqual(result.releasedHeads, RECONCILED_RELEASED_HEADS_V1);
  assert.equal(result.candidateDigest, nativeCandidateDigestV1(realCandidate));

  // The service candidate is state CANDIDATE with a frozen authority-free block; the
  // independent PAN adjudication rebuilds the deterministic result from the canonical
  // transport bytes and never treats the service envelope as authority.
  assert.equal(realCandidate.state, "CANDIDATE");
  assert.equal(result.canonicalKnowledgeBeforeSha256, buildAuthoritativeAdjudicationInputs().canonicalKnowledgeSha256);
});

test("XRA-PS-02 native AC02 returns the exact five paired clean-room outcomes", () => {
  const expected: Array<[string, string, string[]]> = [
    ["positive", "ACCEPTED_BOUNDED", ["NATIVE_EVIDENCE_ACCEPTED"]],
    ["restricted-unknown", "RESTRICTED", ["NATIVE_EVIDENCE_RESTRICTED_UNKNOWN"]],
    ["conflicting-counterevidence", "DENIED", ["NATIVE_CONFLICTING_COUNTEREVIDENCE_DENIED"]],
    ["forged-candidate", "DENIED", ["NATIVE_FORGED_CANDIDATE_DENIED"]],
    ["stale-head", "DENIED", ["NATIVE_STALE_HEAD_DENIED"]],
  ];
  const actual = expected.map(([name]) => {
    const rendered = runCleanRoomCase(name);
    return [name, rendered.outcome, rendered.reasonCodes] as [string, string, string[]];
  });
  assert.deepEqual(actual, expected);

  // The restriction and conflict cases come from the independently sourced PAN
  // adjudication context, never from normal native v1 service output (which freezes
  // unknown=false and empty counterevidence).
  const result = adjudicateNativeCandidateV1(nativeInput(realCandidate));
  assert.equal(result.outcome, "ACCEPTED_BOUNDED");
  assert.equal(result.adjudicationContextId, "pansphaira:xra-ps-02-native-context-001");

  // A context sourced from anything but independent PAN adjudication is denied.
  const foreignContext = JSON.parse(JSON.stringify(emptyContext()));
  foreignContext.provenance.source = "KALEIDOSPHERE_SERVICE_OUTPUT";
  assert.equal(adjudicateNativeCandidateV1(nativeInput(realCandidate, foreignContext)).reasonCodes[0], "NATIVE_CANDIDATE_SCHEMA_DENIED");

  // A context bound to a stale canonical knowledge digest is denied.
  const staleKnowledgeContext = JSON.parse(JSON.stringify(emptyContext()));
  staleKnowledgeContext.provenance.canonicalKnowledgeSha256 = "0".repeat(64);
  assert.equal(adjudicateNativeCandidateV1(nativeInput(realCandidate, staleKnowledgeContext)).reasonCodes[0], "NATIVE_CANDIDATE_SCHEMA_DENIED");
});

test("XRA-PS-02 native AC03 receipt binds both reconciled released heads and the complete seven-stage chain", () => {
  const context = emptyContext();
  const adjudication = adjudicateNativeCandidateV1(nativeInput(realCandidate, context));
  assert.equal(adjudication.outcome, "ACCEPTED_BOUNDED");
  const receipt = createNativePairedAdjudicationReceiptV1({
    adjudication,
    candidate: realCandidate,
    canonicalTransportBytes: transportBytes,
    context,
    rawArtifactBytes,
    releasedHeads: RECONCILED_RELEASED_HEADS_V1,
  });
  assert.equal(receipt.receiptId, "pansphaira:xra-ps-02-native-paired-receipt-001");
  assert.equal(receipt.releasedHeads.pansphaira, PANSPHAIRA_RECONCILED_RELEASED_HEAD_V1);
  assert.equal(receipt.releasedHeads.kaleidoSphere, KALEIDOSPHERE_RECONCILED_RELEASED_HEAD_V1);
  assert.deepEqual(
    verifyNativePairedAdjudicationReceiptV1(receipt, { canonicalTransportBytes: transportBytes, rawArtifactBytes }),
    {
      authority: "NONE",
      chainStages: [...ADJUDICATION_CHAIN_STAGES],
      effect: "NONE",
      outcome: "VERIFIED",
      receiptDigest: receipt.receiptDigest,
      releasedHeads: RECONCILED_RELEASED_HEADS_V1,
    },
  );

  const material = { canonicalTransportBytes: transportBytes, rawArtifactBytes };
  const tampered = (mutate: (value: Record<string, any>) => void) => {
    const value = JSON.parse(JSON.stringify(receipt));
    mutate(value);
    return value;
  };
  assert.equal(verifyNativePairedAdjudicationReceiptV1(tampered((value) => { value.releasedHeads.kaleidoSphere = "e".repeat(40); }), material).outcome, "DENIED");
  assert.equal(verifyNativePairedAdjudicationReceiptV1(tampered((value) => { value.candidate.claims.computed.edgeCount = 2; }), material).outcome, "DENIED");
  assert.equal(verifyNativePairedAdjudicationReceiptV1(tampered((value) => { value.candidate = null; }), material).outcome, "DENIED");
  assert.equal(verifyNativePairedAdjudicationReceiptV1(tampered((value) => { value.chain[0].digest = "f".repeat(64); }), material).outcome, "DENIED");
  assert.equal(verifyNativePairedAdjudicationReceiptV1(tampered((value) => { value.context.provenance.source = "KALEIDOSPHERE_SERVICE_OUTPUT"; }), material).outcome, "DENIED");
  assert.equal(verifyNativePairedAdjudicationReceiptV1(receipt).outcome, "DENIED", "verification without material is fail-closed");

  // A receipt may not bind a gate-failing candidate.
  assert.throws(() => createNativePairedAdjudicationReceiptV1({
    adjudication: adjudicateNativeCandidateV1(nativeInput(substitutionCandidate, context)),
    candidate: substitutionCandidate,
    canonicalTransportBytes: transportBytes,
    context,
    rawArtifactBytes,
    releasedHeads: RECONCILED_RELEASED_HEADS_V1,
  }), /XRA_PS_02_NATIVE_RECEIPT_INPUT_DENIED/);
});

test("XRA-PS-02 native AC04 leaves canonical knowledge, authority, capability, and effect unchanged", () => {
  const before = buildAuthoritativeAdjudicationInputs();
  const result = adjudicateNativeCandidateV1(nativeInput(realCandidate));
  const after = buildAuthoritativeAdjudicationInputs();
  assert.deepEqual(after, before);
  assert.equal(result.canonicalKnowledgeBeforeSha256, before.canonicalKnowledgeSha256);
  assert.equal(result.canonicalKnowledgeAfterSha256, after.canonicalKnowledgeSha256);
  assert.equal(result.authority, "NONE");
  assert.equal(result.capabilityDelta, "NONE");
  assert.equal(result.effect, "NONE");
});

test("XRA-PS-02 native wire is fail-closed on service-down, substitution, and malformed envelopes", async () => {
  // Service-down: a loopback port with no listener is a typed, fail-closed denial.
  const down = await fetchNativeProjectionV1({ canonicalTransportBytes: transportBytes, timeoutMs: 1500, url: "http://127.0.0.1:1/v1/pansphaira-analytics/native-projection" });
  assert.deepEqual(down, {
    candidate: null,
    code: "XRA_PS_02_NATIVE_SERVICE_UNAVAILABLE",
    issue: "XRA-KS-01",
    requestSha256: null,
    status: "UNAVAILABLE",
  });

  const withServer = (payload: unknown): Promise<Record<string, any>> => new Promise((resolve, reject) => {
    const server = createServer((request, response) => {
      response.writeHead(200, { "content-type": "application/json" });
      response.end(JSON.stringify(payload) + "\n");
    });
    server.once("error", reject);
    server.listen(0, "127.0.0.1", async () => {
      const address = server.address();
      const port = typeof address === "object" && address !== null ? address.port : 0;
      const result = await fetchNativeProjectionV1({ canonicalTransportBytes: transportBytes, timeoutMs: 2000, url: "http://127.0.0.1:" + String(port) + "/v1/pansphaira-analytics/native-projection" });
      server.close();
      resolve(result as Record<string, any>);
    });
  });

  // Real captured 200 envelope over the wire: the ingested candidate adjudicates
  // ACCEPTED_BOUNDED through the independent PAN path.
  const ingested = await withServer(capture.response);
  assert.equal(ingested.status, "CANDIDATE");
  assert.equal(ingested.requestSha256, "91c26eb69860767ec2898a48676caaeb52c808de284bb0fbfbe8a986d30ad19c");
  assert.deepEqual(ingested.candidate, realCandidate);
  assert.equal(adjudicateNativeCandidateV1(nativeInput(ingested.candidate)).outcome, "ACCEPTED_BOUNDED");

  // Substitution envelope (real output of the service bound to a different head):
  // the wire ingests it faithfully, and the adjudicator denies it as stale.
  const substituted = await withServer(substitutionCapture.response);
  assert.equal(substituted.status, "CANDIDATE");
  const substitutedResult = adjudicateNativeCandidateV1(nativeInput(substituted.candidate));
  assert.equal(substitutedResult.outcome, "DENIED");
  assert.deepEqual(substitutedResult.reasonCodes, ["NATIVE_STALE_HEAD_DENIED"]);

  // A malformed wire envelope is a typed denial, never coerced.
  const malformed = await withServer({ unexpected: true });
  assert.deepEqual(malformed, {
    candidate: null,
    code: "XRA_PS_02_NATIVE_WIRE_SHAPE_DENIED",
    issue: "XRA-KS-01",
    requestSha256: null,
    status: "UNAVAILABLE",
  });

  // The captured service denial envelopes are faithfully relayed by the wire.
  assert.deepEqual(
    capture.denials.map((entry: { code: string }) => entry.code),
    [
      "XRA_KS01_NATIVE_CANONICALITY_DENIED",
      "XRA_KS01_NATIVE_PROVENANCE_FORGERY_DENIED",
      "XRA_KS01_NATIVE_DIGEST_MISMATCH_DENIED",
      "XRA_KS01_NATIVE_CONTRACT_DENIED",
      "XRA_KS01_REQUEST_SIZE_DENIED",
      "XRA_KS01_ROUTE_DENIED",
    ],
  );
});

test("XRA-PS-02 native adjudication is fail-closed and does not invoke exotic candidate inputs", () => {
  let invocations = 0;
  const candidateProxy = new Proxy(realCandidate, {
    ownKeys: () => { invocations += 1; throw new Error("candidate trap"); },
    getPrototypeOf: () => { invocations += 1; throw new Error("candidate trap"); },
    getOwnPropertyDescriptor: () => { invocations += 1; throw new Error("candidate trap"); },
    get: () => { invocations += 1; throw new Error("candidate trap"); },
  });
  const result = adjudicateNativeCandidateV1(nativeInput(candidateProxy));
  assert.equal(result.outcome, "DENIED");
  assert.equal(invocations, 0);

  const nested = JSON.parse(JSON.stringify(realCandidate));
  nested.claims = new Proxy(nested.claims, {
    ownKeys: () => { invocations += 1; throw new Error("nested proxy trap"); },
  });
  assert.equal(adjudicateNativeCandidateV1(nativeInput(nested)).outcome, "DENIED");
  assert.equal(invocations, 0);

  const accessor = JSON.parse(JSON.stringify(realCandidate));
  Object.defineProperty(accessor.bindings, "canonicalTransportSha256", {
    enumerable: true,
    get: () => { invocations += 1; throw new Error("accessor trap"); },
  });
  assert.equal(adjudicateNativeCandidateV1(nativeInput(accessor)).outcome, "DENIED");
  assert.equal(invocations, 0);

  // A non-conformant envelope (missing keys, wrong head type) is denied typed.
  assert.equal(adjudicateNativeCandidateV1({ candidate: realCandidate }).reasonCodes[0], "NATIVE_CANDIDATE_SCHEMA_DENIED");
  const staleEnvelope = {
    ...nativeInput(realCandidate),
    releasedHeads: { pansphaira: PANSPHAIRA_RECONCILED_RELEASED_HEAD_V1, kaleidoSphere: "1".repeat(40) },
  };
  assert.equal(adjudicateNativeCandidateV1(staleEnvelope).reasonCodes[0], "NATIVE_STALE_HEAD_DENIED");
});