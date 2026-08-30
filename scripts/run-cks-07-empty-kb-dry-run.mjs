#!/usr/bin/env node
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import Ajv2020 from "ajv/dist/2020.js";
import { scoreEmptyKbFixture } from "./cks-07-score-empty-kb.mjs";
import {
  CKS_AUTHORITY_BOUNDARY_V1,
  findGapAndRouteAcquisitionV1,
  validateGapAcquisitionReceiptV1,
} from "../dist/packages/contracts/src/cks-gap-acquisition.js";

const ROOT = resolve(new URL("..", import.meta.url).pathname);
const DEFAULT_OUTPUT = resolve(ROOT, "verification/cks-07-empty-kb-dry-run-evidence-v1.json");
const GAP_SCHEMA_PATH = resolve(ROOT, "schemas/contracts/cks-gap-acquisition-receipt-v1.schema.json");
const FINITE_P12_STATES = new Set([
  "RECOVERED", "NOT_APPLICABLE", "GAP_MISSING", "GAP_BAD_SOURCE", "GAP_APPLICABILITY",
  "GAP_CONFLICTING", "GAP_UNKNOWN_SEMANTIC", "BLOCKED",
]);
const FINITE_REQUIREMENT_STATES = new Set([
  "SATISFIED", "NOT_APPLICABLE", "MISSING", "BAD_SOURCE", "APPLICABILITY", "CONFLICTING",
  "UNKNOWN_SEMANTIC", "CRITICALITY_MISMATCH",
]);

const readJson = (path) => JSON.parse(readFileSync(path, "utf8"));
const fail = (message) => { throw new Error(`CKS_07_EMPTY_KB_DRY_RUN_${message}`); };
const assert = (condition, message) => { if (!condition) fail(message); };

function parseArgs(args) {
  assert(args.length === 3 && args[0] === "--fixture" && args[2] === "--dry-run", "USAGE_EXPECTED_--fixture_<path>_--dry-run");
  return resolve(args[1]);
}

function loadEvidenceFixture(path) {
  const fixture = readJson(path);
  assert(fixture.schemaVersion === "pansphaira.verification/cks-07-empty-kb-e2e-positive/v1", "POSITIVE_FIXTURE_SCHEMA_INVALID");
  assert(fixture.mode === "OFFLINE_DETERMINISTIC_EMPTY_KB", "MODE_NOT_OFFLINE_DETERMINISTIC_EMPTY_KB");
  assert(fixture.network === "OFFLINE_PROFILE_ONLY" && fixture.model === "DISABLED", "UNTRUSTED_RUNTIME_ENABLED");
  assert(fixture.authorityBoundary === CKS_AUTHORITY_BOUNDARY_V1, "AUTHORITY_BOUNDARY_INVALID");
  for (const key of ["emptyKbFixture", "p12PositiveFixture", "p12NegativeFixture", "rejectionsFixture"]) {
    assert(typeof fixture[key] === "string" && fixture[key].length > 0, `${key.toUpperCase()}_MISSING`);
  }
  return fixture;
}

function validateReceipt(receipt, schemaValidate, label) {
  assert(receipt !== null && validateGapAcquisitionReceiptV1(receipt), `${label}_RECEIPT_RUNTIME_INVALID`);
  assert(schemaValidate(receipt), `${label}_RECEIPT_SCHEMA_INVALID`);
  assert(receipt.authorityBoundary === CKS_AUTHORITY_BOUNDARY_V1, `${label}_AUTHORITY_BOUNDARY_INVALID`);
  assert(receipt.promotionStatus === "NOT_REQUESTED" && receipt.acceptedKnowledgeDigest === null, `${label}_PROMOTION_OR_ACCEPTANCE_LEAK`);
}

function replayP12Case(item, schemaValidate) {
  const first = findGapAndRouteAcquisitionV1(item.input);
  const replay = findGapAndRouteAcquisitionV1(item.input);
  assert(JSON.stringify(first) === JSON.stringify(replay), `${item.caseId}_REPLAY_NOT_DETERMINISTIC`);
  assert(first.state === item.expectedState, `${item.caseId}_EXPECTED_${item.expectedState}_GOT_${first.state}`);
  assert(FINITE_P12_STATES.has(first.state), `${item.caseId}_NONFINITE_STATE`);
  if (first.receipt === null) {
    assert(first.state === "BLOCKED", `${item.caseId}_NULL_RECEIPT_NOT_BLOCKED`);
    return { caseId: item.caseId, state: first.state, reason: first.reason, receipt: null, replay: "IDENTICAL_BLOCKED_DECISION" };
  }
  validateReceipt(first.receipt, schemaValidate, item.caseId);
  assert(first.receipt.state === first.state, `${item.caseId}_RECEIPT_STATE_MISMATCH`);
  return {
    caseId: item.caseId,
    state: first.state,
    reason: first.reason,
    receipt: {
      receiptId: first.receipt.receiptId,
      receiptDigest: first.receipt.receiptDigest,
      attempts: first.receipt.attempts.map((attempt) => ({ level: attempt.level, outcome: attempt.outcome, attemptDigest: attempt.attemptDigest })),
      acquisitionCandidates: first.receipt.acquisitionCandidates.map((candidate) => ({
        candidateId: candidate.candidateId,
        level: candidate.level,
        sourceClass: candidate.sourceClass,
        acceptanceStatus: candidate.acceptanceStatus,
        promotionStatus: candidate.promotionStatus,
        disposition: candidate.disposition,
        candidateDigest: candidate.candidateDigest,
      })),
      promotionStatus: first.receipt.promotionStatus,
      acceptedKnowledgeDigest: first.receipt.acceptedKnowledgeDigest,
      authorityBoundary: first.receipt.authorityBoundary,
    },
    replay: "IDENTICAL_RECEIPT",
  };
}

function runP12(evidenceFixture) {
  const positive = readJson(resolve(ROOT, evidenceFixture.p12PositiveFixture));
  const negative = readJson(resolve(ROOT, evidenceFixture.p12NegativeFixture));
  const rejectionFixture = readJson(resolve(ROOT, evidenceFixture.rejectionsFixture));
  const schemaValidate = new Ajv2020({ allErrors: true, strict: true }).compile(readJson(GAP_SCHEMA_PATH));
  const positiveCases = positive.cases.map((item) => replayP12Case(item, schemaValidate));
  const negativeCases = negative.cases.map((item) => replayP12Case(item, schemaValidate));
  assert(rejectionFixture.schemaVersion === "pansphaira.verification/cks-07-empty-kb-e2e-rejections/v1", "REJECTION_FIXTURE_SCHEMA_INVALID");
  assert(rejectionFixture.cases.length === negativeCases.length, "REJECTION_CASE_COUNT_MISMATCH");
  for (const expected of rejectionFixture.cases) {
    const actual = negativeCases.find((item) => item.caseId === expected.caseId);
    assert(actual !== undefined && actual.state === expected.expectedState, `${expected.caseId}_REJECTION_EXPECTATION_MISMATCH`);
    if (expected.expectedReason !== undefined) assert(actual.reason === expected.expectedReason, `${expected.caseId}_REJECTION_REASON_MISMATCH`);
    if (expected.assertions !== undefined && actual.receipt !== null) {
      const serialized = JSON.stringify(actual.receipt);
      for (const assertion of expected.assertions) assert(serialized.includes(assertion), `${expected.caseId}_${assertion}_MISSING`);
    }
  }
  const a1 = positiveCases.find((item) => item.caseId === "case:recover-a1");
  const a2 = positiveCases.find((item) => item.caseId === "case:recover-a2");
  const missing = positiveCases.find((item) => item.caseId === "case:missing-with-candidates");
  assert(a1?.state === "RECOVERED" && a2?.state === "RECOVERED", "ALTERNATE_RECOVERY_NOT_PROVEN");
  assert(a1.receipt.attempts.at(-1)?.level === evidenceFixture.expected.p12.alternateRecoveryLevels[a1.caseId], "A1_RECOVERY_LEVEL_INVALID");
  assert(a2.receipt.attempts.at(-1)?.level === evidenceFixture.expected.p12.alternateRecoveryLevels[a2.caseId], "A2_RECOVERY_LEVEL_INVALID");
  assert(missing?.caseId === evidenceFixture.expected.p12.missingCaseId && missing.state === "GAP_MISSING", "MISSING_DECLARATION_INVALID");
  assert(missing.receipt.attempts.map((attempt) => attempt.level).join(",") === "A0,A1,A2", "MISSING_DECLARED_BEFORE_A0_A2_COMPLETE");
  assert(missing.receipt.acquisitionCandidates.length === evidenceFixture.expected.p12.acquisitionCandidateCount, "ACQUISITION_CANDIDATES_NOT_ROUTED");
  assert(missing.receipt.acquisitionCandidates.every((candidate) => candidate.acceptanceStatus === "NOT_ACCEPTED"
    && candidate.promotionStatus === "NOT_REQUESTED" && candidate.disposition === "NON_AUTHORITATIVE_CANDIDATE"), "ACQUISITION_PROMOTION_SEPARATION_FAILED");
  const internet = negativeCases.find((item) => item.caseId === "case:internet-not-authority");
  assert(internet?.state === "GAP_MISSING" && internet.receipt.acquisitionCandidates.every((candidate) => candidate.sourceClass !== "ACTIVE_CURATED_KNOWLEDGE"), "INTERNET_CANDIDATE_AUTHORITY_LEAK");
  return {
    status: "PASS",
    alternateRecovery: [
      { caseId: a1.caseId, terminalState: a1.state, terminalLevel: a1.receipt.attempts.at(-1).level, attemptOutcomes: a1.receipt.attempts.map((attempt) => attempt.outcome) },
      { caseId: a2.caseId, terminalState: a2.state, terminalLevel: a2.receipt.attempts.at(-1).level, attemptOutcomes: a2.receipt.attempts.map((attempt) => attempt.outcome) },
    ],
    missingAfterCompleteRecovery: {
      caseId: missing.caseId,
      state: missing.state,
      retrievalLevels: missing.receipt.attempts.map((attempt) => attempt.level),
      acquisitionCandidateCount: missing.receipt.acquisitionCandidates.length,
      allCandidatesNotAccepted: missing.receipt.acquisitionCandidates.every((candidate) => candidate.acceptanceStatus === "NOT_ACCEPTED"),
      promotionStatus: missing.receipt.promotionStatus,
      acceptedKnowledgeDigest: missing.receipt.acceptedKnowledgeDigest,
    },
    negativeCases: negativeCases.map(({ caseId, state, reason, replay }) => ({ caseId, state, reason, replay })),
    replayedReceiptCount: positiveCases.filter((item) => item.receipt !== null).length + negativeCases.filter((item) => item.receipt !== null).length,
  };
}

function run() {
  const fixturePath = parseArgs(process.argv.slice(2));
  const evidenceFixture = loadEvidenceFixture(fixturePath);
  const emptyKbFixturePath = resolve(ROOT, evidenceFixture.emptyKbFixture);
  const scored = scoreEmptyKbFixture(emptyKbFixturePath);
  assert(scored.caseCount === evidenceFixture.expected.emptyKbCaseCount, "EMPTY_KB_CASE_COUNT_MISMATCH");
  assert(scored.p11.requirementRecallMean === evidenceFixture.expected.p11.requirementRecallMean, "P11_RECALL_MISMATCH");
  assert(scored.p11.requirementPrecisionMean === evidenceFixture.expected.p11.requirementPrecisionMean, "P11_PRECISION_MISMATCH");
  assert(scored.p11.totalCriticalRequirementMisses === evidenceFixture.expected.p11.totalCriticalRequirementMisses, "P11_CRITICAL_MISS_MISMATCH");
  assert(scored.p11.criticalRequirementMissCases === evidenceFixture.expected.p11.criticalRequirementMissCases, "P11_CRITICAL_MISS_CASE_COUNT_MISMATCH");
  assert(scored.p13.proofOutcome === "PASS", "P13_PROOF_FAILED");
  assert(scored.p13.metrics.combinedFalseCompletenessCount === evidenceFixture.expected.p13.combinedFalseCompletenessCount, "P13_COMBINED_FALSE_COMPLETENESS");
  assert(scored.p13.metrics.simpleSolverFalseCompletenessCount === evidenceFixture.expected.p13.simpleSolverFalseCompletenessCount, "P13_SIMPLE_SOLVER_COUNT_MISMATCH");
  assert(scored.p13.metrics.combinedTrueCompletenessCount === evidenceFixture.expected.p13.combinedTrueCompletenessCount, "P13_COMBINED_TRUE_COMPLETENESS_MISMATCH");
  assert(scored.cases.every((item) => item.states.every((state) => FINITE_REQUIREMENT_STATES.has(state.state))), "NONFINITE_REQUIREMENT_STATE");
  assert(scored.cases.every((item) => item.authorityBoundary === CKS_AUTHORITY_BOUNDARY_V1), "CASE_AUTHORITY_BOUNDARY_INVALID");
  const badSources = scored.cases.filter((item) => item.caseId === "case:bad-source-internet" || item.caseId === "case:bad-source-model");
  assert(badSources.every((item) => item.combinedOutcome !== "SUFFICIENT" && item.acceptedCandidateIds.length === 0), "INTERNET_OR_MODEL_ACCEPTED");
  const p12 = runP12(evidenceFixture);
  const report = {
    schemaVersion: "pansphaira.verification/cks-07-empty-kb-dry-run-evidence/v1",
    evidenceId: evidenceFixture.evidenceId,
    evidenceClass: "PUBLIC_SAFE_LOCAL_SYNTHETIC",
    mode: "DRY_RUN",
    network: evidenceFixture.network,
    model: evidenceFixture.model,
    suiteId: scored.suiteId,
    sourceFixtures: {
      positiveEvidenceFixture: fixturePath.slice(ROOT.length + 1),
      emptyKbFixture: evidenceFixture.emptyKbFixture,
      p12PositiveFixture: evidenceFixture.p12PositiveFixture,
      p12NegativeFixture: evidenceFixture.p12NegativeFixture,
      rejectionsFixture: evidenceFixture.rejectionsFixture,
    },
    acceptanceCriteria: {
      P11: {
        status: "PASS",
        caseCount: scored.p11.caseCount,
        requirementRecallMean: scored.p11.requirementRecallMean,
        requirementPrecisionMean: scored.p11.requirementPrecisionMean,
        totalCriticalRequirementMisses: scored.p11.totalCriticalRequirementMisses,
        criticalRequirementMissCases: scored.p11.criticalRequirementMissCases,
        finiteRequirementStates: [...FINITE_REQUIREMENT_STATES],
      },
      P12: p12,
      P13: {
        status: scored.p13.proofOutcome,
        caseCount: scored.p13.caseCount,
        metrics: scored.p13.metrics,
        falseCompletenessReduced: scored.p13.metrics.combinedFalseCompletenessCount === 0
          && scored.p13.metrics.simpleSolverFalseCompletenessCount > 0,
      },
      failClosed: {
        status: "PASS",
        finiteP12States: [...FINITE_P12_STATES],
        rejectedCaseClasses: ["MISSING", "BAD_SOURCE", "APPLICABILITY", "CONFLICTING", "UNKNOWN_SEMANTIC"],
        internetAndModelAcceptedAsKnowledge: false,
        internetAndModelGrantedAuthority: false,
      },
    },
    authorityBoundary: CKS_AUTHORITY_BOUNDARY_V1,
    receiptReplay: "DETERMINISTIC_BYTE_IDENTICAL",
    nonClaims: ["CI", "merge", "release", "deployment", "production activation", "global domain quality", "parent epic completion"],
  };
  writeFileSync(DEFAULT_OUTPUT, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  return report;
}

try {
  process.stdout.write(`${JSON.stringify(run(), null, 2)}\n`);
} catch (error) {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 2;
}
