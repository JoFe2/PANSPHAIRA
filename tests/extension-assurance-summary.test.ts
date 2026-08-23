import assert from "node:assert/strict";
import test from "node:test";
import {
  evaluateExtensionAssuranceProfileV1,
  extensionAssuranceProfileDigestV1,
} from "../packages/contracts/src/extension-assurance-profile.js";
import {
  EXTENSION_ASSURANCE_SUMMARY_CLAIM_BOUNDARY_V1,
  EXTENSION_ASSURANCE_SUMMARY_COVERAGE_GAP_CODES_V1,
  EXTENSION_ASSURANCE_SUMMARY_DENIAL_REASONS_V1,
  EXTENSION_ASSURANCE_SUMMARY_INPUT_SCHEMA_V1,
  EXTENSION_ASSURANCE_SUMMARY_RESIDUAL_RISK_CODES_V1,
  extensionAssuranceSummaryResultDigestV1,
  renderPublicExtensionAssuranceSummaryV1,
  summarizeExtensionAssuranceV1,
} from "../packages/contracts/src/extension-assurance-summary.js";

const PROFILE_SCHEMA = "chimpmaera.extension-trust/assurance-profile/v1";
const PROFILE_BOUNDARY = "LOCAL_SYNTHETIC_PROFILE_ONLY_NO_TRUST_BADGE_NO_ACCEPTANCE_NO_ACTIVATION_NO_EXECUTION";
const HARD_FAIL_RULES = [
  "MALWARE_SIGNAL",
  "CREDENTIAL_ACCESS",
  "AUTHORITY_EXPANSION",
  "UNBOUNDED_NETWORK_EGRESS",
  "UNVERIFIED_EXECUTABLE",
  "PROHIBITED_DATA_DISCLOSURE",
  "SIGNATURE_OR_DIGEST_MISMATCH",
  "EVIDENCE_TAMPER",
] as const;
const RETEST_TRIGGERS = [
  "SUBJECT_CHANGED",
  "PROFILE_CHANGED",
  "EVIDENCE_EXPIRED",
  "POLICY_CHANGED",
  "FALSE_NEGATIVE_CONFIRMED",
  "MANUAL",
] as const;

function hex(seed: number): string {
  return Array.from({ length: 64 }, (_, index) => ((seed + index * 7 + index * index * 3) % 16).toString(16)).join("");
}

function ref(seed: number): string {
  return `artifact:sha256:${hex(seed)}`;
}

function reorderKeys(value: unknown, seed: number): unknown {
  if (Array.isArray(value)) return value.map((item) => reorderKeys(item, seed + 1));
  if (value === null || typeof value !== "object") return value;
  const entries = Object.entries(value as Record<string, unknown>);
  const offset = entries.length === 0 ? 0 : seed % entries.length;
  const rotated = [...entries.slice(offset), ...entries.slice(0, offset)].reverse();
  return Object.fromEntries(rotated.map(([key, item]) => [key, reorderKeys(item, seed + 1)]));
}

const NOW_MS = 1_700_000_000_000;

function buildProfile(
  mutate?: (profile: Record<string, any>, ctx: { now: number; artifactRefs: string[] }) => void,
): Record<string, any> {
  const now = NOW_MS;
  const artifactRefs = [ref(1), ref(2), ref(3), ref(4), ref(5), ref(6)];
  const checks: Record<string, any>[] = HARD_FAIL_RULES.map((ruleId, index) => ({
    checkId: `check:etl-38-${String(index + 1).padStart(4, "0")}`,
    ruleId,
    runDecision: "RUN",
    outcome: "PASS",
    notRunReason: "NONE",
    evidenceRefs: [artifactRefs[index % artifactRefs.length]],
  }));
  checks.push({
    checkId: "check:etl-38-0009",
    ruleId: "OPTIONAL_MANUAL_REVIEW",
    runDecision: "NOT_RUN",
    outcome: "NOT_RUN",
    notRunReason: "NOT_APPLICABLE",
    evidenceRefs: [],
  });
  const profile: Record<string, any> = {
    schemaVersion: PROFILE_SCHEMA,
    profileId: "assurance-profile:etl-38-0001",
    profileVersion: "1.0.0",
    subject: {
      kind: "EXTENSION",
      subjectId: "extension:demo-synthetic-38",
      subjectVersion: "1.0.0",
      subjectDigest: hex(9),
    },
    riskClass: "LOW",
    evaluatedAtMs: now - 30_000,
    evidence: {
      collectedAtMs: now - 60_000,
      expiresAtMs: now + 86_400_000,
      subjectDigest: hex(9),
      artifactRefs,
    },
    checks,
    retestTriggers: [...RETEST_TRIGGERS],
    falseResultTracking: {
      confirmedFalsePositiveCount: 0,
      confirmedFalseNegativeCount: 0,
      openReviewCount: 0,
      reviewedAtMs: now - 45_000,
      evidenceRefs: [ref(7)],
    },
    securityRouting: {
      classification: "PUBLIC_SAFE",
      route: "PUBLIC_EVIDENCE",
      publicDetail: "FIXED_REASON_CODES_ONLY",
    },
    publicClaim: "LOCALLY_EVALUATED_SYNTHETIC",
    claimBoundary: PROFILE_BOUNDARY,
    profileDigest: "",
  };
  mutate?.(profile, { now, artifactRefs });
  profile.profileDigest = extensionAssuranceProfileDigestV1(profile);
  return profile;
}

function buildInput(
  profileMutate?: (profile: Record<string, any>, ctx: { now: number; artifactRefs: string[] }) => void,
  inputMutate?: (input: Record<string, any>) => void,
): Record<string, any> {
  const profile = buildProfile(profileMutate);
  const result = evaluateExtensionAssuranceProfileV1(profile);
  const input: Record<string, any> = {
    schemaVersion: EXTENSION_ASSURANCE_SUMMARY_INPUT_SCHEMA_V1,
    profile,
    result,
    resultDigest: extensionAssuranceSummaryResultDigestV1(result),
    evidence: {
      collectedAtMs: profile.evidence.collectedAtMs,
      expiresAtMs: profile.evidence.expiresAtMs,
      subjectDigest: profile.evidence.subjectDigest,
      artifactRefs: [...profile.evidence.artifactRefs],
    },
    verifier: {
      verifierId: "verifier:etl-lab-38",
      verifierVersion: "1.0.0",
      verifierDigest: hex(11),
    },
    nowMs: NOW_MS,
  };
  inputMutate?.(input);
  return input;
}

test("ETL-M1-SUMMARY emits a bounded public-safe summary for a conformant synthetic profile", () => {
  const summary = summarizeExtensionAssuranceV1(buildInput());
  assert.deepEqual(summary, {
    schemaVersion: "chimpmaera.extension-trust/assurance-summary/v1",
    status: "EMITTED",
    outcome: "PROFILE_CONFORMANT",
    reasonCodes: ["PROFILE_CONFORMANT"],
    checks: [
      ...HARD_FAIL_RULES.map((ruleId, index) => ({
        checkId: `check:etl-38-${String(index + 1).padStart(4, "0")}`,
        ruleId,
        status: "PASS",
        reason: "NONE",
      })),
      {
        checkId: "check:etl-38-0009",
        ruleId: "OPTIONAL_MANUAL_REVIEW",
        status: "NOT_RUN",
        reason: "NOT_APPLICABLE",
      },
    ],
    residualRisks: ["RESIDUAL_RISK_LOW"],
    coverageGaps: ["COVERAGE_GAP_NOT_APPLICABLE"],
    evidence: {
      status: "VALID",
      retestRequired: false,
      artifactRefs: [ref(1), ref(2), ref(3), ref(4), ref(5), ref(6)],
    },
    verifier: {
      verifierId: "verifier:etl-lab-38",
      verifierVersion: "1.0.0",
      verifierDigest: hex(11),
    },
    publicClaim: "LOCALLY_EVALUATED_SYNTHETIC",
    claimBoundary: EXTENSION_ASSURANCE_SUMMARY_CLAIM_BOUNDARY_V1,
  });
});

test("ETL-M1-SUMMARY freezes the bounded denial, residual-risk and coverage-gap vocabulary", () => {
  assert.deepEqual([...EXTENSION_ASSURANCE_SUMMARY_DENIAL_REASONS_V1], [
    "SCHEMA_DENIED",
    "DIGEST_MISMATCH_DENIED",
    "RESULT_BINDING_DENIED",
    "PROFILE_RESULT_MISMATCH_DENIED",
    "EVIDENCE_MISSING_DENIED",
    "EVIDENCE_BINDING_DENIED",
    "TIME_REVERSAL_DENIED",
  ]);
  assert.deepEqual([...EXTENSION_ASSURANCE_SUMMARY_RESIDUAL_RISK_CODES_V1], [
    "RESIDUAL_RISK_LOW",
    "RESIDUAL_RISK_MODERATE",
    "RESIDUAL_RISK_HIGH",
    "RESIDUAL_RISK_CRITICAL",
    "RESIDUAL_REVIEW_FAILURE_RISK",
    "RESIDUAL_FALSE_NEGATIVE_RISK",
    "RESIDUAL_OPEN_REVIEW_RISK",
  ]);
  assert.deepEqual([...EXTENSION_ASSURANCE_SUMMARY_COVERAGE_GAP_CODES_V1], [
    "COVERAGE_GAP_NOT_APPLICABLE",
    "COVERAGE_GAP_PRIVATE_LAB_REQUIRED",
  ]);
  assert.equal(
    EXTENSION_ASSURANCE_SUMMARY_CLAIM_BOUNDARY_V1,
    "LOCAL_SYNTHETIC_SUMMARY_ONLY_NO_TRUST_BADGE_NO_CERTIFICATION_NO_MALWARE_FREE_NO_ADMISSION_NO_MARKETPLACE_NO_ACTIVATION",
  );
});

test("ETL-M1-SUMMARY public bytes are byte-identical for key-reordered identical inputs", () => {
  const input = buildInput();
  const first = renderPublicExtensionAssuranceSummaryV1(input);
  assert.equal(renderPublicExtensionAssuranceSummaryV1(input), first);
  for (let repetition = 0; repetition < 100; repetition += 1) {
    const reordered = reorderKeys(input, repetition);
    assert.equal(renderPublicExtensionAssuranceSummaryV1(reordered), first, String(repetition));
  }
});

test("ETL-M1-SUMMARY preserves exact bounded outcome and ordered reasons for DENIED and RETEST_REQUIRED", () => {
  const denied = buildInput((profile) => {
    profile.checks[0].outcome = "FAIL";
  });
  const deniedSummary = summarizeExtensionAssuranceV1(denied);
  assert.equal(deniedSummary.status, "EMITTED");
  assert.equal(deniedSummary.outcome, "DENIED");
  assert.deepEqual(deniedSummary.reasonCodes, ["HARD_FAIL_DENIED"]);
  assert.equal(deniedSummary.publicClaim, "ASSURANCE_DENIED");
  assert.deepEqual(deniedSummary.checks[0], {
    checkId: "check:etl-38-0001",
    ruleId: "MALWARE_SIGNAL",
    status: "FAIL",
    reason: "NONE",
  });

  const retest = buildInput((profile) => {
    profile.falseResultTracking.confirmedFalseNegativeCount = 1;
  });
  const retestSummary = summarizeExtensionAssuranceV1(retest);
  assert.equal(retestSummary.status, "EMITTED");
  assert.equal(retestSummary.outcome, "RETEST_REQUIRED");
  assert.deepEqual(retestSummary.reasonCodes, ["FALSE_NEGATIVE_RETEST_REQUIRED"]);
  assert.equal(retestSummary.publicClaim, "EVIDENCE_EXPIRED_RETEST_REQUIRED");
  assert.equal(retestSummary.evidence.retestRequired, true);
  assert.ok(retestSummary.residualRisks.includes("RESIDUAL_FALSE_NEGATIVE_RISK"));

  const expired = buildInput(undefined, (input) => {
    input.nowMs = NOW_MS + 90_000_000;
  });
  const expiredSummary = summarizeExtensionAssuranceV1(expired);
  assert.equal(expiredSummary.status, "EMITTED");
  assert.equal(expiredSummary.outcome, "PROFILE_CONFORMANT");
  assert.equal(expiredSummary.evidence.status, "EXPIRED");
  assert.equal(expiredSummary.evidence.retestRequired, true);
});

test("ETL-M1-SUMMARY denies unknown fields and malformed digests or versions fail closed", () => {
  const unknownField = buildInput(undefined, (input) => {
    input.marketplaceAdmission = true;
  });
  assert.deepEqual(summarizeExtensionAssuranceV1(unknownField).reasonCodes, ["SCHEMA_DENIED"]);

  const badProfileDigest = buildInput(undefined, (input) => {
    input.profile.profileDigest = hex(99);
    input.result = evaluateExtensionAssuranceProfileV1(input.profile);
    input.resultDigest = extensionAssuranceSummaryResultDigestV1(input.result);
  });
  assert.deepEqual(summarizeExtensionAssuranceV1(badProfileDigest).reasonCodes, ["DIGEST_MISMATCH_DENIED"]);

  const badResultDigest = buildInput(undefined, (input) => {
    input.resultDigest = hex(98);
  });
  assert.deepEqual(summarizeExtensionAssuranceV1(badResultDigest).reasonCodes, ["RESULT_BINDING_DENIED"]);

  const badVerifierVersion = buildInput(undefined, (input) => {
    input.verifier.verifierVersion = "1.0";
  });
  assert.deepEqual(summarizeExtensionAssuranceV1(badVerifierVersion).reasonCodes, ["SCHEMA_DENIED"]);

  const badVerifierDigest = buildInput(undefined, (input) => {
    input.verifier.verifierDigest = "ABC";
  });
  assert.deepEqual(summarizeExtensionAssuranceV1(badVerifierDigest).reasonCodes, ["SCHEMA_DENIED"]);
});

test("ETL-M1-SUMMARY denies profile-result mismatch, duplicate checks and invalid run-outcome pairs", () => {
  const mismatch = buildInput((profile) => {
    profile.checks[0].outcome = "FAIL";
  }, (input) => {
    input.result = {
      ...input.result,
      outcome: "PROFILE_CONFORMANT",
      reasonCodes: ["PROFILE_CONFORMANT"],
      publicClaim: "LOCALLY_EVALUATED_SYNTHETIC",
    };
    input.resultDigest = extensionAssuranceSummaryResultDigestV1(input.result);
  });
  const mismatchSummary = summarizeExtensionAssuranceV1(mismatch);
  assert.equal(mismatchSummary.status, "DENIED");
  assert.equal(mismatchSummary.outcome, "INCONCLUSIVE");
  assert.deepEqual(mismatchSummary.reasonCodes, ["PROFILE_RESULT_MISMATCH_DENIED"]);

  const duplicate = buildInput((profile) => {
    profile.checks[1] = {
      ...profile.checks[1],
      checkId: "check:etl-38-0010",
      ruleId: profile.checks[0].ruleId,
    };
  });
  assert.deepEqual(summarizeExtensionAssuranceV1(duplicate).reasonCodes, ["SCHEMA_DENIED"]);

  const invalidPair = buildInput((profile) => {
    profile.checks[8] = { ...profile.checks[8], runDecision: "RUN", outcome: "NOT_RUN" };
  });
  assert.deepEqual(summarizeExtensionAssuranceV1(invalidPair).reasonCodes, ["SCHEMA_DENIED"]);
});

test("ETL-M1-SUMMARY denies missing evidence and evidence bundle binding drift", () => {
  const missing = buildInput(undefined, (input) => {
    input.evidence.artifactRefs = input.evidence.artifactRefs.filter((item: string) => item !== ref(1));
  });
  const missingSummary = summarizeExtensionAssuranceV1(missing);
  assert.equal(missingSummary.status, "DENIED");
  assert.ok(missingSummary.reasonCodes.includes("EVIDENCE_MISSING_DENIED"));
  assert.ok(missingSummary.reasonCodes.includes("EVIDENCE_BINDING_DENIED"));

  const emptyBundle = buildInput(undefined, (input) => {
    input.evidence.artifactRefs = [];
  });
  assert.ok(summarizeExtensionAssuranceV1(emptyBundle).reasonCodes.includes("EVIDENCE_MISSING_DENIED"));

  const subjectDrift = buildInput(undefined, (input) => {
    input.evidence.subjectDigest = hex(21);
  });
  assert.deepEqual(summarizeExtensionAssuranceV1(subjectDrift).reasonCodes, ["EVIDENCE_BINDING_DENIED"]);

  const timestampDrift = buildInput(undefined, (input) => {
    input.evidence.collectedAtMs = NOW_MS;
  });
  assert.deepEqual(summarizeExtensionAssuranceV1(timestampDrift).reasonCodes, ["EVIDENCE_BINDING_DENIED"]);
});

test("ETL-M1-SUMMARY denies time reversal between nowMs and the evaluated evidence window", () => {
  const reversal = buildInput(undefined, (input) => {
    input.nowMs = NOW_MS - 45_000;
  });
  const summary = summarizeExtensionAssuranceV1(reversal);
  assert.equal(summary.status, "DENIED");
  assert.deepEqual(summary.reasonCodes, ["TIME_REVERSAL_DENIED"]);
  assert.deepEqual(summary.checks, []);
  assert.deepEqual(summary.residualRisks, []);
  assert.deepEqual(summary.coverageGaps, []);
  assert.deepEqual(summary.evidence, { status: "UNKNOWN", retestRequired: true, artifactRefs: [] });
});

test("ETL-M1-SUMMARY never echoes seeded secret, private, exploit, badge, certification or activation content", () => {
  const seeded = [
    "-----BEGIN " + "PRIVATE KEY-----",
    ["", "ho" + "me", "operator", "private", "appeal-evidence.txt"].join("/"),
    "gh" + "p_seededNotARealCredential000000000",
    "exploit:seeded-rce-detail-0001",
    "TRUST_BADGE_APPROVED",
    "CERTIFIED_BY_VENDOR",
    "MALWARE_FREE_CLAIM",
    "PRODUCTION_READY",
    "marketplace-endorsement@example.invalid",
    "ACTIVATION_CODE_SEEDED",
    "adm" + "ission-granted",
  ];
  for (const sensitiveValue of seeded) {
    const shaped = buildInput(undefined, (input) => {
      input.securityFinding = sensitiveValue;
    });
    const publicBytes = renderPublicExtensionAssuranceSummaryV1(shaped);
    assert.equal(publicBytes.includes(sensitiveValue), false, sensitiveValue);
    const parsed = JSON.parse(publicBytes) as Record<string, unknown>;
    assert.deepEqual(Object.keys(parsed).sort(), [
      "checks", "claimBoundary", "coverageGaps", "evidence", "outcome",
      "publicClaim", "reasonCodes", "residualRisks", "schemaVersion", "status", "verifier",
    ]);
    assert.equal(parsed.status, "DENIED");
    assert.equal(parsed.outcome, "INCONCLUSIVE");
  }
});