import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  ASF_ANALYSIS_CLAIM_BOUNDARY_V1,
  ASF_ANALYSIS_EXIT_CODES_V1,
  ASF_ANALYSIS_IDENTITY_CLASS_V1,
  analyzeAsfGenerationV1,
  asfAnalysisEvidenceDigestV1,
  asfAnalysisEvidenceSetDigestV1,
  parseAsfAnalysisV1,
  renderPublicAsfAnalysisV1,
  validateAsfAnalysisReceiptV1,
  type AsfAnalysisContextV1,
  type AsfAnalysisInputV1,
  type AsfAnalysisReasonCodeV1,
} from "../packages/contracts/src/asf-analysis.js";
import { canonicalJson } from "../packages/contracts/src/canonical-json.js";

const fixtureRoot = "tests/fixtures/asf-analysis";
const acceptedRaw = readFileSync(`${fixtureRoot}/accepted.json`, "utf8");
const accepted = JSON.parse(acceptedRaw) as AsfAnalysisInputV1;
const context: AsfAnalysisContextV1 = {
  capabilityIds: ["capability:filesystem.read", "capability:network.fetch"],
  generationDigest: "1".repeat(64),
  lockDigest: "2".repeat(64),
  maxEvidenceAgeMs: 1000,
  nowMs: 1500,
  trustedVerifierId: "verifier:synthetic-independent",
  trustedVerifierVersion: "1.0.0",
};

function fixture(name: string): unknown {
  return JSON.parse(readFileSync(`${fixtureRoot}/${name}`, "utf8"));
}

function clone<T>(value: T): T {
  return structuredClone(value);
}

function resultReason(value: unknown, reason: AsfAnalysisReasonCodeV1, suppliedContext = context): void {
  const result = analyzeAsfGenerationV1(value, suppliedContext);
  assert.equal(result.outcome, "DENIED");
  if (result.outcome !== "DENIED") return;
  assert.deepEqual(result.reasonCodes, [reason]);
  assert.equal(result.exitCode, ASF_ANALYSIS_EXIT_CODES_V1[reason]);
}

function reorder(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(reorder).reverse();
  if (value !== null && typeof value === "object" && Object.getPrototypeOf(value) === Object.prototype) {
    return Object.fromEntries(Object.entries(value).reverse().map(([key, entry]) => [key, reorder(entry)]));
  }
  return value;
}

test("accepts verified synthetic evidence for one pinned generation exactly once", () => {
  const first = parseAsfAnalysisV1(acceptedRaw, context);
  const second = analyzeAsfGenerationV1(clone(accepted), context);
  assert.equal(first.outcome, "ACCEPTED");
  assert.deepEqual(second, first);
  if (first.outcome !== "ACCEPTED") return;

  assert.equal(first.exitCode, 0);
  assert.equal(first.receipt.verdict, "ACCEPTED");
  assert.equal(first.receipt.claimBoundary, ASF_ANALYSIS_CLAIM_BOUNDARY_V1);
  assert.equal(first.receipt.verifier.identityClass, ASF_ANALYSIS_IDENTITY_CLASS_V1);
  assert.equal(first.receipt.generationDigest, context.generationDigest);
  assert.equal(first.receipt.lockDigest, context.lockDigest);
  assert.equal(first.receipt.evidenceDigest, "42ef2a487207a6aa2db32d72aa171add6f92ef8f124f3e24bb8b22267a6b5e80");
  assert.equal(first.receiptJson, canonicalJson(first.receipt));
  assert.equal(validateAsfAnalysisReceiptV1(first.receipt), true);
  assert.equal(first.receipt.authority.installation, "NO_AUTHORITY");
  assert.equal(first.receipt.authority.activation, "NO_AUTHORITY");
  assert.equal(asfAnalysisEvidenceSetDigestV1(accepted.evidence), first.evidenceDigest);
});

test("equivalent evidence order has the identical verdict, receipt, and public-safe reason codes", () => {
  const original = analyzeAsfGenerationV1(accepted, context);
  const reordered = analyzeAsfGenerationV1(reorder(accepted), context);
  assert.equal(original.outcome, "ACCEPTED");
  assert.deepEqual(reordered, original);
  if (original.outcome !== "ACCEPTED" || reordered.outcome !== "ACCEPTED") return;
  assert.deepEqual(reordered.reasonCodes, ["ANALYSIS_ACCEPTED"]);
  assert.equal(reordered.receiptJson, original.receiptJson);
  assert.equal(reordered.receiptDigest, original.receiptDigest);
});

test("blocked risk and missing provenance fail closed without exposing evidence", () => {
  resultReason(fixture("blocked-risk.json"), "RISK_BLOCKED_DENIED");
  resultReason(fixture("missing-provenance.json"), "EVIDENCE_MISSING_DENIED");
  const publicResult = renderPublicAsfAnalysisV1(fixture("blocked-risk.json"), context);
  assert.equal(publicResult.includes("RISK_BLOCKED"), true);
  assert.equal(publicResult.includes("secret"), false);
  assert.equal(publicResult.includes("/"), false);
  assert.equal(publicResult.includes("SYNTHETIC_VERIFIED"), false);
});

test("missing, revoked, stale, foreign, and digest-mismatched evidence deny", () => {
  const revoked = clone(accepted) as any;
  revoked.evidence[0].status = "REVOKED";
  resultReason(revoked, "EVIDENCE_REVOKED_DENIED");

  resultReason(accepted, "EVIDENCE_STALE_DENIED", { ...context, nowMs: 2000 });

  const foreign = clone(accepted) as any;
  foreign.evidence[0].generationDigest = "3".repeat(64);
  foreign.evidence[0].evidenceDigest = asfAnalysisEvidenceDigestV1(foreign.evidence[0]);
  resultReason(foreign, "EVIDENCE_FOREIGN_DENIED");

  const mismatch = clone(accepted) as any;
  mismatch.evidence[0].observedAtMs = 1001;
  resultReason(mismatch, "EVIDENCE_DIGEST_MISMATCH_DENIED");

  const missing = clone(accepted) as any;
  missing.evidence = [];
  resultReason(missing, "EVIDENCE_MISSING_DENIED");
});

test("generation, lock, verifier, capability, finding, and secret/path bindings deny", () => {
  const generation = clone(accepted) as any;
  generation.generation.generationDigest = "3".repeat(64);
  resultReason(generation, "GENERATION_BINDING_DENIED");

  const lock = clone(accepted) as any;
  lock.generation.lockDigest = "3".repeat(64);
  resultReason(lock, "LOCK_BINDING_DENIED");

  const self = clone(accepted) as any;
  self.subjectId = "generation:synthetic-independent";
  resultReason(self, "SELF_ANALYSIS_DENIED", { ...context,
    trustedVerifierId: "verifier:synthetic-independent",
  });

  const capability = clone(accepted) as any;
  capability.generation.capabilityIds[0] = "capability:unknown";
  resultReason(capability, "UNKNOWN_CAPABILITY_DENIED");

  const freeText = clone(accepted) as any;
  freeText.evidence[0].findings[0].detail = "unbounded narrative";
  resultReason(freeText, "FREE_TEXT_FINDING_DENIED");

  const secret = clone(accepted) as any;
  secret.secret = "must-not-be-returned";
  resultReason(secret, "SECRET_OR_PATH_FIELD_DENIED");

  const path = clone(accepted) as any;
  path.evidence[0].path = "/private/input";
  resultReason(path, "SECRET_OR_PATH_FIELD_DENIED");
});

test("denial is non-mutating and public output has no unsupported authority claim", () => {
  const candidate = clone(accepted) as any;
  candidate.evidence[2].findings[0] = { code: "RISK_BLOCKED", severity: "BLOCK" };
  const before = clone(candidate);
  const result = analyzeAsfGenerationV1(candidate, context);
  assert.deepEqual(candidate, before);
  assert.equal(result.outcome, "DENIED");
  if (result.outcome !== "DENIED") return;
  assert.equal("receipt" in result, false);
  assert.equal("evidence" in result, false);
  assert.equal(JSON.stringify(result).includes("must-not-be-returned"), false);
});
