import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

import {
  GOVERNANCE_SCHEMA_PATHS,
  canonicalJson,
  sealGovernanceBundle,
  sha256Bytes,
  validateGovernanceSchemas,
  verifyGovernanceBundle,
} from "../../src/rks-01/source-governance.mjs";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const fixturePath = resolve(repoRoot, "tests/fixtures/rks-01/source-governance-cases-v1.json");
const fixture = JSON.parse(await readFile(fixturePath, "utf8"));
const sourceBytes = Buffer.from(fixture.sourceBytesHex, "hex");
const candidateBytes = Buffer.from(fixture.candidateBytesHex, "hex");

function baseline() {
  return sealGovernanceBundle({
    profile: structuredClone(fixture.profile),
    snapshot: structuredClone(fixture.snapshot),
    admission: structuredClone(fixture.admission),
    candidate: structuredClone(fixture.candidate),
    promotion: structuredClone(fixture.promotion),
    drift: structuredClone(fixture.drift),
  }, { sourceBytes, candidateBytes });
}

function trustedOptions(bundle, overrides = {}) {
  return {
    sourceBytes,
    candidateBytes,
    trustedNow: fixture.trustedNow,
    trustedProfiles: new Map([[bundle.profile.profileId, bundle.profile.profileDigest]]),
    trustedAdmissions: new Map([[bundle.admission.decisionId, bundle.admission.admissionDigest]]),
    trustedPreviousDriftDigest: null,
    ...overrides,
  };
}

function expectDenied(bundle, options, reason) {
  const result = verifyGovernanceBundle(bundle, options);
  assert.equal(result.outcome, "DENIED", JSON.stringify(result));
  assert.ok(result.reasonCodes.includes(reason), JSON.stringify(result));
  return result;
}

test("six closed schemas compile and accept the deterministically sealed positive replay", async () => {
  assert.equal(GOVERNANCE_SCHEMA_PATHS.length, 6);
  const bundle = baseline();
  const schemaResult = await validateGovernanceSchemas(bundle, { repoRoot });
  assert.deepEqual(schemaResult, { valid: true, errors: [] });

  const first = verifyGovernanceBundle(bundle, trustedOptions(bundle));
  const replay = verifyGovernanceBundle(structuredClone(bundle), trustedOptions(bundle));
  assert.deepEqual(first, replay);
  assert.equal(first.outcome, "VERIFIED");
  assert.deepEqual(first.reasonCodes, ["SOURCE_GOVERNANCE_CHAIN_VERIFIED"]);
  assert.equal(first.replayDigest, sha256Bytes(Buffer.from(canonicalJson(bundle))));
});

test("profile and snapshot bind official immutable identity, exact bytes, media type, tools, and obligations", () => {
  const bundle = baseline();
  assert.equal(bundle.snapshot.sourceBytesSha256, sha256Bytes(sourceBytes));
  assert.equal(bundle.snapshot.byteLength, sourceBytes.byteLength);
  assert.equal(bundle.snapshot.profileDigest, bundle.profile.profileDigest);
  assert.equal(bundle.admission.snapshotDigest, bundle.snapshot.snapshotDigest);
  assert.equal(bundle.candidate.admissionDigest, bundle.admission.admissionDigest);
  assert.equal(bundle.promotion.candidateDigest, bundle.candidate.candidateDigest);
  assert.equal(bundle.drift.observedSourceBytesSha256, bundle.snapshot.sourceBytesSha256);
  assert.deepEqual(bundle.candidate.obligations, bundle.profile.legal.obligations);
});

test("acquisition, validation, candidate, and governed promotion remain separate non-authoritative states", () => {
  const bundle = baseline();
  assert.equal(bundle.candidate.status, "UNTRUSTED_CANDIDATE");
  assert.equal(bundle.promotion.decision, "GOVERNED_PROMOTION");
  for (const record of Object.values(bundle)) {
    if (!record?.boundary) continue;
    assert.equal(record.boundary.truthGrant, "NONE");
    assert.equal(record.boundary.capabilityGrant, "NONE");
    assert.equal(record.boundary.authorityGrant, "NONE");
  }
});

test("unknown or missing license and moving-only identity deny", () => {
  for (const [mutate, reason] of [
    [(b) => { b.profile.legal.licenseDecision = "UNKNOWN"; }, "SCHEMA_INVALID"],
    [(b) => { delete b.profile.legal.licenseId; }, "SCHEMA_INVALID"],
    [(b) => { b.profile.immutableIdentity = { kind: "MOVING_ALIAS", version: "latest", revision: "main" }; }, "SCHEMA_INVALID"],
  ]) {
    const bundle = baseline(); mutate(bundle);
    expectDenied(bundle, trustedOptions(baseline()), reason);
  }
});

test("digest drift, exact source-byte mismatch, and caller-authored expected digests deny", () => {
  const changedDigest = baseline();
  changedDigest.snapshot.sourceBytesSha256 = "f".repeat(64);
  expectDenied(changedDigest, trustedOptions(baseline()), "SNAPSHOT_DIGEST_INVALID");

  const bundle = baseline();
  expectDenied(bundle, trustedOptions(bundle, { sourceBytes: Buffer.from("ff", "hex") }), "SOURCE_BYTES_MISMATCH");
  expectDenied(bundle, trustedOptions(bundle, { expectedDigests: { profile: bundle.profile.profileDigest } }), "CALLER_EXPECTED_DIGEST_FORBIDDEN");
});

test("notice or attribution loss, direct promotion, hidden fields, and authority widening deny", async () => {
  const cases = [
    [(b) => { b.candidate.attribution = []; }, "SCHEMA_INVALID"],
    [(b) => { b.candidate.notice = "lost"; }, "CANDIDATE_OBLIGATION_LOSS"],
    [(b) => { b.candidate.status = "PROMOTED"; }, "SCHEMA_INVALID"],
    [(b) => { b.candidate.hidden = true; }, "SCHEMA_INVALID"],
    [(b) => { b.promotion.boundary.authorityGrant = "NETWORK"; }, "SCHEMA_INVALID"],
  ];
  for (const [mutate, reason] of cases) {
    const bundle = baseline(); mutate(bundle);
    const schema = await validateGovernanceSchemas(bundle, { repoRoot });
    if (reason === "SCHEMA_INVALID") assert.equal(schema.valid, false);
    expectDenied(bundle, trustedOptions(baseline()), reason);
  }
});

test("paired substitution plus full re-digestion cannot replace trusted profile or admitted source bytes", () => {
  const original = baseline();
  const substitutedCore = {
    profile: structuredClone(fixture.profile), snapshot: structuredClone(fixture.snapshot),
    admission: structuredClone(fixture.admission), candidate: structuredClone(fixture.candidate),
    promotion: structuredClone(fixture.promotion), drift: structuredClone(fixture.drift),
  };
  substitutedCore.profile.canonicalUrl = "https://attacker.invalid/replacement";
  substitutedCore.snapshot.canonicalUrl = substitutedCore.profile.canonicalUrl;
  const substituted = sealGovernanceBundle(substitutedCore, { sourceBytes, candidateBytes });
  expectDenied(substituted, trustedOptions(original), "TRUSTED_PROFILE_DIGEST_MISMATCH");

  const replacementBytes = Buffer.from("aabbccdd", "hex");
  const bytesSubstitution = sealGovernanceBundle({
    profile: structuredClone(fixture.profile), snapshot: structuredClone(fixture.snapshot),
    admission: structuredClone(fixture.admission), candidate: structuredClone(fixture.candidate),
    promotion: structuredClone(fixture.promotion), drift: structuredClone(fixture.drift),
  }, { sourceBytes: replacementBytes, candidateBytes });
  expectDenied(bytesSubstitution, trustedOptions(original, { sourceBytes: replacementBytes }), "TRUSTED_ADMISSION_DIGEST_MISMATCH");
});

test("downgrade and unmodified-only RFC transformation widening deny without legal-advice claims", () => {
  const downgraded = baseline();
  downgraded.candidate.transformationClass = "UNMODIFIED_ONLY";
  expectDenied(downgraded, trustedOptions(baseline()), "TRANSFORMATION_CLASS_MISMATCH");

  const profile = structuredClone(fixture.rfcNarrowProfile);
  const core = {
    profile,
    snapshot: { ...structuredClone(fixture.snapshot), profileId: profile.profileId, canonicalUrl: profile.canonicalUrl, immutableIdentity: profile.immutableIdentity, mediaType: profile.mediaType, parser: profile.parser, canonicalizer: profile.canonicalizer },
    admission: { ...structuredClone(fixture.admission), decision: "NARROW_ADMIT_UNMODIFIED_ONLY", licenseId: profile.legal.licenseId, transformationClass: "UNMODIFIED_ONLY", notice: profile.legal.notice, attribution: profile.legal.attribution, obligations: profile.legal.obligations },
    candidate: { ...structuredClone(fixture.candidate), transformationClass: "TRANSFORM_ALLOWED", notice: profile.legal.notice, attribution: profile.legal.attribution, obligations: profile.legal.obligations },
    promotion: structuredClone(fixture.promotion), drift: structuredClone(fixture.drift),
  };
  const widened = sealGovernanceBundle(core, { sourceBytes, candidateBytes });
  expectDenied(widened, trustedOptions(widened), "TRANSFORMATION_CLASS_WIDENING");
  assert.equal(profile.boundary.legalAdvice, false);
});

test("history rewrite, stale revalidation, and drift requiring revalidation deny promotion validity", () => {
  const history = baseline();
  history.drift.previousEventDigest = "a".repeat(64);
  history.drift.eventDigest = "b".repeat(64);
  expectDenied(history, trustedOptions(baseline()), "DRIFT_HISTORY_REWRITE");

  const stale = baseline();
  expectDenied(stale, trustedOptions(stale, { trustedNow: "2026-10-01T00:00:00Z" }), "REVALIDATION_STALE");

  const core = {
    profile: structuredClone(fixture.profile), snapshot: structuredClone(fixture.snapshot), admission: structuredClone(fixture.admission),
    candidate: structuredClone(fixture.candidate), promotion: structuredClone(fixture.promotion), drift: structuredClone(fixture.drift),
  };
  core.drift.classification = "DRIFT_DETECTED";
  core.drift.action = "REVALIDATION_REQUIRED";
  core.drift.observedSourceBytesSha256 = "f".repeat(64);
  const drifted = sealGovernanceBundle(core, { sourceBytes, candidateBytes, preserveObservedDigest: true });
  expectDenied(drifted, trustedOptions(drifted), "REVALIDATION_REQUIRED");
});
