import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  PRODUCER_ANALYTICS_GAP_STATES_V1,
  PRODUCER_ANALYTICS_PRODUCT_NONCLAIMS_V1,
  generateProducerAnalyticsManifestV1,
  verifyProducerAnalyticsManifestV1,
  type ProducerAnalyticsManifestInputV1,
} from "../src/analytics/producer-analytics-manifest.js";

const RAW = "tests/fixtures/cks-analytics/projection-v1.json";
const CAPTURE = "tests/fixtures/cks-analytics/xra-ps-02-native-service-capture-v1.json";
const RECEIPT = "verification/pansphaira-kaleidosphere-analytics-slice-v2.json";
const ADJUDICATOR = "src/cks-12/kaleidosphere-candidate-quarantine.ts";
const MANIFEST = "contracts/analytics/producer-manifest-v1.json";

function bytes(path: string): Uint8Array {
  return Uint8Array.from(readFileSync(path));
}
function input(): ProducerAnalyticsManifestInputV1 {
  return {
    rawArtifact: { path: RAW, bytes: bytes(RAW) },
    nativeServiceCapture: { path: CAPTURE, bytes: bytes(CAPTURE) },
    sliceReceipt: { path: RECEIPT, bytes: bytes(RECEIPT) },
    adjudicatorSource: { path: ADJUDICATOR, bytes: bytes(ADJUDICATOR) },
  };
}
function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

test("PAR-PS-01 AC03 regeneration is byte-identical and the checked-in manifest is the derivation, not prose", () => {
  const first = generateProducerAnalyticsManifestV1(input());
  const second = generateProducerAnalyticsManifestV1(input());
  const third = generateProducerAnalyticsManifestV1(input());
  assert.equal(first.serialized, second.serialized);
  assert.equal(first.serialized, third.serialized);
  assert.equal(first.manifest.manifestDigest, second.manifest.manifestDigest);
  assert.match(String(first.manifest.manifestDigest), /^[a-f0-9]{64}$/);
  // The checked-in bytes are exactly the deterministic derivation from the delivered slice.
  const checkedIn = readFileSync(MANIFEST, "utf8");
  assert.equal(checkedIn, first.serialized);
  assert.equal(first.manifest.schemaVersion, "pansphaira.par-ps-01/producer-analytics-manifest/v1");
  assert.equal(first.manifest.manifestId, "pansphaira:par-ps-01-producer-analytics-manifest-001");
  assert.equal(first.manifest.issue, "PANSPHAIRA#345");
});

test("PAR-PS-01 AC01 field surface equals the observed candidate and the re-derivation matches the runtime", () => {
  const manifest = generateProducerAnalyticsManifestV1(input()).manifest as any;
  const capture = JSON.parse(readFileSync(CAPTURE, "utf8")) as any;
  const candidate = capture.response.candidate;

  // Generated-vs-runtime projection comparison: independent PAN re-derivation matches the capture.
  assert.equal(manifest.runtimeProjection.adjudication.outcome, "ACCEPTED_BOUNDED");
  assert.deepEqual(manifest.runtimeProjection.adjudication.reasonCodes, ["NATIVE_EVIDENCE_ACCEPTED"]);
  assert.equal(manifest.runtimeProjection.adjudication.authority, "NONE");
  assert.equal(manifest.runtimeProjection.rawArtifactSha256, "22f34bf33874a42cde5a5a23a2242935e8b2b145aa8e2364a5aef26b8ec3e6e8");
  assert.equal(manifest.runtimeProjection.canonicalTransportSha256, "91c26eb69860767ec2898a48676caaeb52c808de284bb0fbfbe8a986d30ad19c");
  assert.equal(manifest.runtimeProjection.projectionBodyDigest, "cc5f6cc9591ccf4b6b3c4b9f954aa9da09695b784d7abaa585c082aea195ef1b");
  assert.equal(manifest.runtimeProjection.resultSha256, candidate.resultSha256);

  // The field surface is derived from the observed candidate, not authored prose.
  assert.equal(manifest.fieldSurface[0].path, "candidate");
  assert.equal(manifest.fieldSurface[0].kind, "object");
  const paths = new Set(manifest.fieldSurface.map((entry: { path: string }) => entry.path));
  for (const expected of [
    "candidate",
    "candidate.analysis",
    "candidate.bindings",
    "candidate.coverage",
    "candidate.counterevidence",
    "candidate.claims.observed",
    "candidate.claims.computed",
    "candidate.authority.capabilities",
    "candidate.nonclaims",
  ]) {
    assert.ok(paths.has(expected), expected);
  }

  // A documented but unobserved capability is NOT marked supported: the observed
  // capability and effect sets are empty, and the manifest records them as empty.
  assert.deepEqual(manifest.semantics.authority.capabilities, []);
  assert.deepEqual(manifest.semantics.authority.effects, []);
  assert.deepEqual(manifest.authorityState.capabilities, []);
  assert.deepEqual(manifest.authorityState.effects, []);
  assert.deepEqual(manifest.evidence.evidenceRoles, ["KNOWLEDGE_QUALIFICATION", "RELATION_ASSERTION"]);
  assert.equal(manifest.evidence.counterevidenceEntryCount, 6);
  assert.deepEqual(manifest.coverage, candidate.coverage);
});

test("PAR-PS-01 AC02 binds producer head/profile digests and carries explicit typed gaps", () => {
  const manifest = generateProducerAnalyticsManifestV1(input()).manifest as any;
  assert.equal(manifest.producer.serviceHead.commitOid, "545a3b44ea88c96eded060c11c7c3a2afe0edff6");
  assert.equal(manifest.producer.serviceHead.treeOid, "c0699e1b4cfdfaf3076928e644ba5da3e9b7798c");
  assert.deepEqual(manifest.producer.reconciledReleasedHeads, {
    pansphaira: "7f662672bfc45087342f23e5c589d43598f5c20d",
    kaleidoSphere: "545a3b44ea88c96eded060c11c7c3a2afe0edff6",
  });
  assert.equal(manifest.producer.consumerReleasedHead.status, "RELEASED");
  assert.equal(manifest.producer.consumerReleasedHead.releaseCommit, "7f662672bfc45087342f23e5c589d43598f5c20d");
  assert.match(manifest.producer.profile.canonicalKnowledgeSha256, /^[a-f0-9]{64}$/);
  assert.equal(manifest.producer.profile.canonicalKnowledgeSha256, "d756437db8c991ee78ea7a9fcc7a9d4749daf8eebda51d5ba31fcc53e1b1242a");
  assert.equal(manifest.producer.profile.sourceContractSha256, "d2995f7e8ed46031902d09a5138202a489834d4a018646c50920a482bbf7da44");

  const gaps = manifest.gaps;
  assert.equal(gaps.length, 1);
  const byId = new Map<string, any>(gaps.map((gap: { id: string }) => [gap.id, gap]));
  const held = byId.get("RELEASE_REGISTRY_HELD");
  assert.equal(held.state, "HELD");
  assert.deepEqual(held.observed, { status: "HELD", entryCount: 1, releasedEntryCount: 0, nativeReleaseRegistryStatus: "RELEASED" });
  for (const gap of gaps) {
    // Every gap is explicitly typed within the closed vocabulary; missing is never
    // collapsed to an absent or zero value.
    assert.ok((PRODUCER_ANALYTICS_GAP_STATES_V1 as readonly string[]).includes(gap.state));
    assert.notEqual(gap.state, "ABSENT");
    assert.notEqual(gap.state, "ZERO");
    assert.equal(typeof gap.note, "string");
    assert.ok(gap.note.length > 0);
    assert.equal(typeof gap.observed, "object");
  }
});

test("PAR-PS-01 verifier rejects unknown fields, unobserved capabilities, and gap collapse", () => {
  const base = generateProducerAnalyticsManifestV1(input()).manifest as any;

  // An unknown top-level field is not silently accepted.
  const unknownField = clone(base);
  unknownField.futureRoadmapCapability = "consumer-support-v2";
  assert.equal(verifyProducerAnalyticsManifestV1(unknownField, input()).valid, false);

  // A documented but unobserved optional capability marked supported is denied.
  const inventedCapability = clone(base);
  inventedCapability.semantics.authority.capabilities = ["CONSUMER_SUPPORT"];
  assert.equal(verifyProducerAnalyticsManifestV1(inventedCapability, input()).valid, false);

  // A field surface claiming an unobserved field is denied with the specific code.
  const inventedSurface = clone(base);
  inventedSurface.fieldSurface = [...inventedSurface.fieldSurface, { path: "candidate.future", kind: "string", digest: "a".repeat(64) }];
  const surfaceResult = verifyProducerAnalyticsManifestV1(inventedSurface, input());
  assert.equal(surfaceResult.valid, false);
  assert.ok(surfaceResult.reasonCodes.includes("UNOBSERVED_OR_MISSING_FIELD"));

  // Missing collapsed to absent: dropping the explicit gap inventory is denied.
  const collapsedGap = clone(base);
  collapsedGap.gaps = [];
  const gapResult = verifyProducerAnalyticsManifestV1(collapsedGap, input());
  assert.equal(gapResult.valid, false);
  assert.ok(gapResult.reasonCodes.includes("GAP_INVENTORY_MISMATCH"));

  // A gap state outside the closed vocabulary (e.g. collapsed to ZERO) is denied.
  const badGapState = clone(base);
  badGapState.gaps[0].state = "ZERO";
  assert.equal(verifyProducerAnalyticsManifestV1(badGapState, input()).valid, false);

  // A substituted producer head digest is denied.
  const substitutedHead = clone(base);
  substitutedHead.producer.serviceHead.commitOid = "e".repeat(40);
  assert.equal(verifyProducerAnalyticsManifestV1(substitutedHead, input()).valid, false);
});

test("PAR-PS-01 generator fails closed on substituted, invalid, or unattested source bytes", () => {
  // Substituted capture bytes (valid JSON, different sha) -> identity mismatch.
  const subCapture = input();
  const subCaptureJson = JSON.parse(readFileSync(CAPTURE, "utf8"));
  subCaptureJson.httpStatus = 201;
  (subCapture.nativeServiceCapture as any).bytes = Uint8Array.from(Buffer.from(JSON.stringify(subCaptureJson)));
  assert.throws(() => generateProducerAnalyticsManifestV1(subCapture), /SOURCE_IDENTITY_MISMATCH/);

  // Corrupted capture bytes (invalid JSON) -> fail closed as a missing source.
  const corruptCapture = input();
  (corruptCapture.nativeServiceCapture as any).bytes = Uint8Array.from([...corruptCapture.nativeServiceCapture.bytes, 0]);
  assert.throws(() => generateProducerAnalyticsManifestV1(corruptCapture), /SOURCE_MISSING/);

  // Substituted raw artifact bytes (valid JSON, different sha) -> identity mismatch.
  const subRaw = input();
  const subRawJson = JSON.parse(readFileSync(RAW, "utf8"));
  subRawJson.schemaVersion = "chimpmaera.cks/kaleidosphere-analytics-projection/v1-mutated";
  (subRaw.rawArtifact as any).bytes = Uint8Array.from(Buffer.from(JSON.stringify(subRawJson)));
  assert.throws(() => generateProducerAnalyticsManifestV1(subRaw), /SOURCE_IDENTITY_MISMATCH/);

  // Substituted adjudicator source bytes -> identity mismatch.
  const subAdjudicator = input();
  (subAdjudicator.adjudicatorSource as any).bytes = Uint8Array.from([...subAdjudicator.adjudicatorSource.bytes, 0]);
  assert.throws(() => generateProducerAnalyticsManifestV1(subAdjudicator), /SOURCE_IDENTITY_MISMATCH/);

  // Empty capture bytes -> fail closed as a missing source.
  const emptyCapture = input();
  (emptyCapture.nativeServiceCapture as any).bytes = new Uint8Array(0);
  assert.throws(() => generateProducerAnalyticsManifestV1(emptyCapture), /SOURCE_MISSING/);

  // A capture path the slice receipt does not attest -> identity mismatch.
  const unattested = input();
  (unattested.nativeServiceCapture as any).path = "tests/fixtures/cks-analytics/does-not-exist.json";
  assert.throws(() => generateProducerAnalyticsManifestV1(unattested), /SOURCE_IDENTITY_MISMATCH/);
});

test("PAR-PS-01 manifest carries the required product nonclaims and grants no authority", () => {
  const manifest = generateProducerAnalyticsManifestV1(input()).manifest as any;
  assert.deepEqual(manifest.productNonclaims, [...PRODUCER_ANALYTICS_PRODUCT_NONCLAIMS_V1]);
  assert.deepEqual(manifest.authorityState, {
    authority: "NONE",
    capabilityDelta: "NONE",
    effect: "NONE",
    capabilities: [],
    effects: [],
  });
  const body = JSON.stringify(manifest);
  for (const forbidden of ["\"CONSUMER_SUPPORT\"", "\"FUTURE_ROADMAP\"", "\"HISTORICAL_RETENTION\""]) {
    assert.equal(body.includes(forbidden), false, forbidden);
  }
});