import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  evaluateExtensionAssuranceProfileV1,
  extensionAssuranceProfileDigestV1,
  renderPublicExtensionAssuranceResultV1,
  type ExtensionAssuranceProfileV1,
} from "../packages/contracts/src/index.js";

function fixture(): ExtensionAssuranceProfileV1 {
  return JSON.parse(readFileSync(
    "tests/fixtures/extension-assurance/positive-profile-v1.json",
    "utf8",
  )) as ExtensionAssuranceProfileV1;
}

function setPath(source: ExtensionAssuranceProfileV1, path: string, value: unknown): Record<string, any> {
  const result = structuredClone(source) as unknown as Record<string, any>;
  const parts = path.split("/").slice(1);
  const leaf = parts.pop();
  assert.ok(leaf !== undefined);
  let parent: any = result;
  for (const part of parts) parent = parent[part];
  parent[leaf] = value;
  result.profileDigest = extensionAssuranceProfileDigestV1(result);
  return result;
}

const NEGATIVE_ZERO_PATHS = [
  "/evaluatedAtMs",
  "/evidence/collectedAtMs",
  "/evidence/expiresAtMs",
  "/falseResultTracking/reviewedAtMs",
  "/falseResultTracking/confirmedFalsePositiveCount",
  "/falseResultTracking/confirmedFalseNegativeCount",
  "/falseResultTracking/openReviewCount",
];

test("PSAI-52 raw numeric negative zero fails closed before digest-based conformance", () => {
  const probe = setPath(fixture(), "/evaluatedAtMs", -0);
  const result = evaluateExtensionAssuranceProfileV1(probe);
  assert.deepEqual(result, {
    schemaVersion: "chimpmaera.extension-trust/assurance-result/v1",
    outcome: "DENIED",
    reasonCodes: ["SCHEMA_DENIED"],
    publicClaim: "INCONCLUSIVE",
    claimBoundary: "LOCAL_SYNTHETIC_PROFILE_ONLY_NO_TRUST_BADGE_NO_ACCEPTANCE_NO_ACTIVATION_NO_EXECUTION",
  });
});

test("PSAI-52 negative zero in every accepted timestamp and count field fails closed when fully re-digested", () => {
  for (const path of NEGATIVE_ZERO_PATHS) {
    const probe = setPath(fixture(), path, -0);
    const result = evaluateExtensionAssuranceProfileV1(probe);
    assert.equal(result.outcome, "DENIED", path);
    assert.deepEqual(result.reasonCodes, ["SCHEMA_DENIED"], path);
  }
});

test("PSAI-52 canonical zero and ordinary safe values retain deterministic digests and conformant outcomes", () => {
  const base = fixture();
  assert.equal(extensionAssuranceProfileDigestV1(base as unknown as Record<string, unknown>), base.profileDigest);
  const zeroed = setPath(fixture(), "/evaluatedAtMs", 0);
  zeroed.falseResultTracking.reviewedAtMs = 0;
  zeroed.evidence.collectedAtMs = 0;
  zeroed.profileDigest = extensionAssuranceProfileDigestV1(zeroed);
  assert.equal(zeroed.profileDigest, extensionAssuranceProfileDigestV1(zeroed), "digest must be deterministic");
  const result = evaluateExtensionAssuranceProfileV1(zeroed);
  assert.equal(result.outcome, "PROFILE_CONFORMANT");
  assert.deepEqual(result.reasonCodes, ["PROFILE_CONFORMANT"]);
  assert.equal(result.publicClaim, "LOCALLY_EVALUATED_SYNTHETIC");
});

test("PSAI-52 re-digestion cannot hide negative zero from the canonical number boundary", () => {
  const negativeZero = setPath(fixture(), "/evaluatedAtMs", -0);
  const canonicalZero = setPath(fixture(), "/evaluatedAtMs", 0);
  assert.equal(negativeZero.profileDigest, canonicalZero.profileDigest,
    "digests must be indistinguishable, so the boundary must reject -0 as a raw number");
  assert.equal(evaluateExtensionAssuranceProfileV1(negativeZero).outcome, "DENIED");
});

test("PSAI-52 retains unsafe, fractional, negative, reversed, expired and inconsistent evidence denials", () => {
  const schemaDenied = [
    ["fractional-evaluatedAtMs", 0.5],
    ["negative-evaluatedAtMs", -1],
    ["non-safe-evaluatedAtMs", 9007199254740994],
  ] as const;
  for (const [caseId, raw] of schemaDenied) {
    const result = evaluateExtensionAssuranceProfileV1(setPath(fixture(), "/evaluatedAtMs", raw));
    assert.ok(result.reasonCodes.includes("SCHEMA_DENIED"), caseId);
    assert.equal(result.outcome, "DENIED", caseId);
  }

  const reversed = setPath(fixture(), "/evidence/expiresAtMs", 500);
  assert.ok(evaluateExtensionAssuranceProfileV1(reversed).reasonCodes.includes("EVIDENCE_STALE_RETEST_REQUIRED"));
  assert.equal(evaluateExtensionAssuranceProfileV1(reversed).outcome, "RETEST_REQUIRED");

  const expired = setPath(fixture(), "/evaluatedAtMs", 6000);
  assert.ok(evaluateExtensionAssuranceProfileV1(expired).reasonCodes.includes("EVIDENCE_STALE_RETEST_REQUIRED"));

  const mismatched = setPath(fixture(), "/evidence/subjectDigest",
    "f0f0f0f0f0f0f0f0f0f0f0f0f0f0f0f0f0f0f0f0f0f0f0f0f0f0f0f0f0f0f0f0");
  const mismatchedResult = evaluateExtensionAssuranceProfileV1(mismatched);
  assert.ok(mismatchedResult.reasonCodes.includes("EVIDENCE_MISMATCH_RETEST_REQUIRED"));
  assert.equal(mismatchedResult.outcome, "RETEST_REQUIRED");
});

test("PSAI-52 retains re-digested substitution, digest drift and public-safe projection denials", () => {
  const substituted = setPath(fixture(), "/subject/subjectDigest",
    "e0e0e0e0e0e0e0e0e0e0e0e0e0e0e0e0e0e0e0e0e0e0e0e0e0e0e0e0e0e0e0e0");
  const substitutedResult = evaluateExtensionAssuranceProfileV1(substituted);
  assert.ok(substitutedResult.reasonCodes.includes("EVIDENCE_MISMATCH_RETEST_REQUIRED"),
    "subject substitution beside unchanged evidence must still require retest");

  const drifted = structuredClone(fixture()) as unknown as Record<string, any>;
  drifted.riskClass = "CRITICAL";
  assert.ok(evaluateExtensionAssuranceProfileV1(drifted).reasonCodes.includes("DIGEST_MISMATCH_DENIED"));

  const negativeZero = setPath(fixture(), "/evaluatedAtMs", -0);
  const publicBytes = renderPublicExtensionAssuranceResultV1(negativeZero);
  assert.deepEqual(Object.keys(JSON.parse(publicBytes)).sort(), [
    "claimBoundary", "outcome", "publicClaim", "reasonCodes", "schemaVersion",
  ]);
});