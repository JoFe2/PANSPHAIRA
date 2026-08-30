#!/usr/bin/env node
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve, dirname, relative, isAbsolute } from "node:path";
import { fileURLToPath } from "node:url";

import { runCks04Baseline } from "./run-cks-04-baseline.mjs";
import {
  CKS_DETERMINISTIC_VERIFIER_ID_V1,
  CKS_DETERMINISTIC_VERIFIER_PROTOCOL_V1,
  CKS_DETERMINISTIC_VERIFIER_VERSION_V1,
  CKS_SEMANTIC_VERIFIER_ID_V1,
  CKS_SEMANTIC_VERIFIER_RUBRIC_ID_V1,
  CKS_SEMANTIC_VERIFIER_VERSION_V1,
} from "../dist/packages/contracts/src/cks-epistemic-verifier.js";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const EVIDENCE_SCHEMA = "pansphaira.cks/baseline-evidence/v1";
const SCENARIO_FIXTURE = "tests/fixtures/cks-04/p2-p3-scenarios-v1.json";
const SOURCE_CASE_FIXTURE = "tests/fixtures/cks-04/verification-cases-v1.json";
const MANIFEST_TEMPLATE = "verification/cks-04-baseline-manifest-template-v1.json";
const P2_CATEGORIES = new Set(["UNKNOWN_FACT_AND_PROCEDURE"]);
const P3_CATEGORIES = new Set(["APPLICABILITY", "EXCLUSION", "PARAMETRIC_CONFLICT", "MISSING_KNOWLEDGE", "CONFLICTING_KNOWLEDGE"]);

const readJson = (path) => JSON.parse(readFileSync(path, "utf8"));
const readRootJson = (path) => readJson(resolveWithinRoot(path));
const resolveWithinRoot = (path) => {
  if (typeof path !== "string" || isAbsolute(path)) throw new Error("PATH_MUST_BE_REPOSITORY_RELATIVE");
  const resolved = resolve(ROOT, path);
  const fromRoot = relative(ROOT, resolved);
  if (fromRoot.startsWith("..") || isAbsolute(fromRoot)) throw new Error("PATH_OUTSIDE_REPOSITORY");
  return resolved;
};
const isRecord = (value) => value !== null && typeof value === "object" && !Array.isArray(value);
const same = (left, right) => JSON.stringify(left) === JSON.stringify(right);
const sha256 = (value) => createHash("sha256").update(value, "utf8").digest("hex");
const without = (value, key) => Object.fromEntries(Object.entries(value).filter(([name]) => name !== key));
const digest = (value) => typeof value === "string" && /^[a-f0-9]{64}$/.test(value);
const fail = (reason) => { throw new Error(`EVIDENCE_DENIED:${reason}`); };

function requireRecord(value, name) {
  if (!isRecord(value)) fail(`${name}_MUST_BE_OBJECT`);
  return value;
}

function requireEqual(actual, expected, name) {
  if (!same(actual, expected)) fail(`${name}_MISMATCH`);
}

function requireResultShape(result, index) {
  requireRecord(result, `RESULT_${index}`);
  for (const field of ["scenarioId", "category", "mutation", "expectedOutcome", "actualOutcome", "expectedReasonCodes", "actualReasonCodes", "typedBoundedRequests", "informationNeedDetected", "claimCoverageVerified", "procedureCoverageVerified", "receiptVerified", "verifiedForScoring", "expectedMatch", "receiptDigest", "deterministicVerifier", "semanticVerifier", "semanticVerifierTrusted"]) {
    if (!(field in result)) fail(`RESULT_${index}_MISSING_${field}`);
  }
  if (!digest(result.receiptDigest)) fail(`RESULT_${index}_RECEIPT_DIGEST_INVALID`);
  if (result.deterministicVerifier !== CKS_DETERMINISTIC_VERIFIER_ID_V1) fail(`RESULT_${index}_DETERMINISTIC_VERIFIER_MISMATCH`);
  if (result.semanticVerifier !== CKS_SEMANTIC_VERIFIER_ID_V1 || result.semanticVerifierTrusted !== false) fail(`RESULT_${index}_SEMANTIC_VERIFIER_MISMATCH`);
  for (const field of ["typedBoundedRequests", "informationNeedDetected", "claimCoverageVerified", "procedureCoverageVerified", "receiptVerified", "verifiedForScoring", "expectedMatch"]) {
    if (result[field] !== true) fail(`RESULT_${index}_${field.toUpperCase()}_REQUIRED`);
  }
}

function validateAndReplay(evidence, { allowTemplate = false } = {}) {
  requireRecord(evidence, "EVIDENCE");
  if (evidence.schemaVersion !== EVIDENCE_SCHEMA) fail("SCHEMA_VERSION");
  if (!allowTemplate) fail("RUN_MANIFEST_REQUIRED_USE_ALLOW_TEMPLATE_FOR_LOCAL_TEMPLATE");

  const template = readRootJson(MANIFEST_TEMPLATE);
  const sourceScenarios = readRootJson(SCENARIO_FIXTURE);
  if (sourceScenarios.schemaVersion !== "pansphaira.cks/p2-p3-scenarios/v1") fail("SCENARIO_FIXTURE_SCHEMA");
  requireEqual(evidence.source?.scenarioFixture, SCENARIO_FIXTURE, "SCENARIO_FIXTURE_PATH");
  requireEqual(evidence.source?.sourceCaseFixture, SOURCE_CASE_FIXTURE, "SOURCE_CASE_FIXTURE_PATH");
  requireEqual(evidence.source?.manifestTemplate, MANIFEST_TEMPLATE, "MANIFEST_TEMPLATE_PATH");
  requireEqual(evidence.bindings, template.bindings, "EXACT_BINDINGS");
  requireEqual(evidence.execution?.mode, template.execution.mode, "EXECUTION_MODE");
  requireEqual(evidence.execution?.networkPolicy, template.execution.networkPolicy, "NETWORK_POLICY");
  requireEqual(evidence.execution?.weightModification, template.execution.weightModification, "WEIGHT_MODIFICATION_POLICY");
  requireEqual(evidence.execution?.actionAuthority, template.execution.actionAuthority, "ACTION_AUTHORITY");
  requireEqual(evidence.execution?.scoringRule, "VERIFIED_RECEIPT_ONLY", "SCORING_RULE");
  requireEqual(evidence.execution?.bindingTemplateId, template.templateId, "BINDING_TEMPLATE_ID");
  requireEqual(evidence.execution?.bindingTemplateVersion, template.templateVersion, "BINDING_TEMPLATE_VERSION");
  requireEqual(evidence.qualificationStatus, "NOT_QUALIFIED", "QUALIFICATION_STATUS");

  const separation = requireRecord(evidence.verifierSeparation, "VERIFIER_SEPARATION");
  requireEqual(separation.deterministic, {
    verifierId: CKS_DETERMINISTIC_VERIFIER_ID_V1,
    protocolId: CKS_DETERMINISTIC_VERIFIER_PROTOCOL_V1,
    version: CKS_DETERMINISTIC_VERIFIER_VERSION_V1,
    trusted: true,
    semanticInterpretation: false,
  }, "DETERMINISTIC_VERIFIER_SEPARATION");
  requireEqual(separation.semantic, {
    verifierId: CKS_SEMANTIC_VERIFIER_ID_V1,
    rubricId: CKS_SEMANTIC_VERIFIER_RUBRIC_ID_V1,
    version: CKS_SEMANTIC_VERIFIER_VERSION_V1,
    status: "NOT_IMPLEMENTED_NOT_TRUSTED",
    trusted: false,
    mayOverrideDeterministicFailure: false,
  }, "SEMANTIC_VERIFIER_SEPARATION");

  const replay = requireRecord(evidence.replay, "REPLAY");
  requireEqual(replay.mode, "DETERMINISTIC_REPLAY", "REPLAY_MODE");
  const report = runCks04Baseline(sourceScenarios);
  requireEqual(replay.results, report.results, "REPLAY_RESULTS");
  requireEqual(evidence.baselineDigest, report.baselineDigest, "BASELINE_DIGEST");
  if (!digest(evidence.baselineDigest)) fail("BASELINE_DIGEST_INVALID");
  if (evidence.source?.sourceScenarioFixtureDigest !== sha256(JSON.stringify(sourceScenarios))) fail("SCENARIO_FIXTURE_DIGEST");

  if (!Array.isArray(replay.results) || replay.results.length !== sourceScenarios.scenarios.length) fail("REPLAY_CASE_COUNT");
  replay.results.forEach(requireResultShape);
  const byId = new Map(replay.results.map((result) => [result.scenarioId, result]));
  const expectedIds = sourceScenarios.scenarios.map((scenario) => scenario.scenarioId);
  requireEqual([...byId.keys()], expectedIds, "SCENARIO_ID_ORDER");

  const p2 = replay.results.filter((result) => P2_CATEGORIES.has(result.category));
  const p3 = replay.results.filter((result) => P3_CATEGORIES.has(result.category));
  if (p2.length + p3.length !== replay.results.length) fail("P2_P3_CATEGORY_COVERAGE");
  const count = (results, outcome) => results.filter((result) => result.actualOutcome === outcome).length;
  const failed = replay.results.filter((result) => !result.receiptVerified || result.actualOutcome === "DENIED" || !result.expectedMatch);
  const abstained = replay.results.filter((result) => result.actualOutcome === "ABSTAIN");
  requireEqual(evidence.counts, {
    totalCases: replay.results.length,
    p2: { totalCases: p2.length, passes: count(p2, "PASS"), abstentions: count(p2, "ABSTAIN"), failures: p2.filter((result) => failed.includes(result)).length },
    p3: { totalCases: p3.length, passes: count(p3, "PASS"), abstentions: count(p3, "ABSTAIN"), failures: p3.filter((result) => failed.includes(result)).length },
    receiptVerifiedCases: report.score.receiptVerifiedCases,
    expectedMatches: report.score.expectedMatches,
    verifiedExpectedMatches: report.score.verifiedExpectedMatches,
    verifiedPasses: report.score.verifiedPasses,
    failClosedAbstentions: report.score.failClosedAbstentions,
  }, "COUNTS");
  requireEqual(evidence.failureSummary, {
    count: failed.length,
    cases: failed.map((result) => ({ scenarioId: result.scenarioId, reasonCodes: result.actualReasonCodes })),
  }, "FAILURE_SUMMARY");
  requireEqual(evidence.abstentionSummary, {
    count: abstained.length,
    cases: abstained.map((result) => ({ scenarioId: result.scenarioId, category: result.category, reasonCodes: result.actualReasonCodes })),
  }, "ABSTENTION_SUMMARY");

  requireEqual(evidence.preconditions, {
    required: true,
    explicitChecksRequired: true,
    unknownOrUnsatisfiedCannotPass: true,
  }, "PRECONDITION_POLICY");
  if (!Array.isArray(evidence.nonclaims) || evidence.nonclaims.length === 0) fail("NONCLAIMS_REVIEW_REQUIRED");
  requireEqual(evidence.publication, { scope: "LOCAL_READBACK_ONLY", externalPublicationAuthorized: false }, "PUBLICATION_SCOPE");
  return { report, p2, p3, failed, abstained };
}

export function verifyBaselineEvidence(evidence, options = {}) {
  return validateAndReplay(evidence, options);
}

function parseArgs(argv) {
  const args = new Map();
  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];
    if (value === "--input") args.set("input", argv[++index]);
    else if (value === "--allow-template") args.set("allowTemplate", true);
    else throw new Error(`UNKNOWN_ARGUMENT:${value}`);
  }
  if (typeof args.get("input") !== "string") throw new Error("USAGE: --input <evidence.json> [--allow-template]");
  return args;
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const evidence = readRootJson(args.get("input"));
  const result = validateAndReplay(evidence, { allowTemplate: args.get("allowTemplate") === true });
  process.stdout.write(`${JSON.stringify({
    status: "VERIFIED_NOT_QUALIFIED",
    baselineDigest: result.report.baselineDigest,
    totalCases: result.report.score.totalCases,
    p2Cases: result.p2.length,
    p3Cases: result.p3.length,
    failures: result.failed.length,
    abstentions: result.abstained.length,
    deterministicVerifier: CKS_DETERMINISTIC_VERIFIER_ID_V1,
    semanticVerifier: CKS_SEMANTIC_VERIFIER_ID_V1,
    semanticVerifierTrusted: false,
  }, null, 2)}\n`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    main();
  } catch (error) {
    process.stderr.write(`CKS-04 evidence denied: ${error instanceof Error ? error.message : "EVIDENCE_FAILED"}\n`);
    process.exitCode = 1;
  }
}
