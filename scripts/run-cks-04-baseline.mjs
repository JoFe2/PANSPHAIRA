#!/usr/bin/env node
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

import {
  competenceResponseDigestV1,
  evidencePackDigestV1,
  knowledgeQueryRequestDigestV1,
  validateKnowledgeQueryRequestV1,
} from "../dist/packages/contracts/src/cks-competence-runtime.js";
import {
  CKS_DETERMINISTIC_VERIFIER_ID_V1,
  CKS_DETERMINISTIC_VERIFIER_VERSION_V1,
  CKS_SEMANTIC_VERIFIER_ID_V1,
  validateCksEpistemicVerificationCaseV1,
  validateCksVerificationReceiptV1,
  verificationCaseDigestV1,
  verificationReceiptDigestV1,
  verifyCksEpistemicCaseV1,
} from "../dist/packages/contracts/src/cks-epistemic-verifier.js";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const DEFAULT_SCENARIO_FIXTURE = "tests/fixtures/cks-04/p2-p3-scenarios-v1.json";
const SOURCE_CASE_FIXTURE = "tests/fixtures/cks-04/verification-cases-v1.json";
const MANIFEST_TEMPLATE = "verification/cks-04-baseline-manifest-template-v1.json";
const BASELINE_SCHEMA = "pansphaira.cks/p2-p3-baseline/v1";
const GOLDEN_SCHEMA = "pansphaira.cks/p2-p3-baseline-golden/v1";

const readJson = (path) => JSON.parse(readFileSync(resolve(ROOT, path), "utf8"));
const sha256 = (value) => createHash("sha256").update(value, "utf8").digest("hex");
const hex = (character) => character.repeat(64);
const without = (value, key) => Object.fromEntries(Object.entries(value).filter(([name]) => name !== key));
const sorted = (values) => [...values].sort();
const sameArray = (left, right) => JSON.stringify(sorted(left)) === JSON.stringify(sorted(right));

function rehashCase(value) {
  for (const request of value.requests) request.requestDigest = knowledgeQueryRequestDigestV1(without(request, "requestDigest"));
  for (const pack of value.evidencePacks) {
    const request = value.requests.find((candidate) => candidate.requestId === pack.request.requestId);
    if (!request) throw new Error(`MISSING_REQUEST_FOR_PACK:${pack.packId}`);
    pack.request.requestDigest = request.requestDigest;
    pack.packDigest = evidencePackDigestV1(without(pack, "packDigest"));
  }
  value.response.responseDigest = competenceResponseDigestV1(without(value.response, "responseDigest"));
  value.caseDigest = verificationCaseDigestV1(without(value, "caseDigest"));
  return value;
}

function abstainingResponse(value, state, missingKnowledge = []) {
  value.response.state = state;
  value.response.answer = null;
  value.response.materialClaims = [];
  value.response.procedureSteps = [];
  value.response.missingKnowledge = missingKnowledge;
  value.response.escalation = null;
}

function applyMutation(base, mutation) {
  const value = structuredClone(base);
  const pack = value.evidencePacks[0];
  if (!pack) throw new Error("BASE_CASE_PACK_REQUIRED");

  switch (mutation) {
    case "BASE_MATCH":
      break;
    case "APPLICABILITY_MISMATCH":
      pack.applicability.applicability.domain = {
        state: "VALUE",
        values: ["different-synthetic-domain"],
        provenance: "DECLARED",
      };
      break;
    case "EXCLUSION_MATCHED":
      value.task.activeExclusions = ["excluded-temperature"];
      pack.applicability.exclusions = ["excluded-temperature"];
      value.expected.claims = [];
      value.expected.procedureSteps = [];
      value.response.state = "INSUFFICIENT_EVIDENCE";
      value.response.answer = null;
      value.response.materialClaims = [];
      value.response.procedureSteps = [];
      value.response.exclusionChecks = [{ exclusionId: "excluded-temperature", matched: true }];
      value.response.missingKnowledge = [{ needId: "need:excluded-temperature", reasonCode: "APPLICABILITY_UNRESOLVED" }];
      break;
    case "PARAMETRIC_CONFLICT":
      value.expected.claims = [];
      value.expected.procedureSteps = [];
      pack.status = "CONFLICT";
      pack.claims = [
        { claimId: "claim:parametric-temperature-a", knowledgeObjectId: "object:parametric-temperature-a", version: "1", digest: hex("e"), sourcePassageIds: ["passage:parametric-a"] },
        { claimId: "claim:parametric-temperature-b", knowledgeObjectId: "object:parametric-temperature-b", version: "1", digest: hex("f"), sourcePassageIds: ["passage:parametric-b"] },
      ];
      pack.evidence.positive = [
        { id: "evidence:parametric-a", digest: hex("a") },
        { id: "evidence:parametric-b", digest: hex("b") },
      ];
      pack.conflicts = [{ conflictId: "conflict:parametric-temperature", claimIds: ["claim:parametric-temperature-a", "claim:parametric-temperature-b"] }];
      abstainingResponse(value, "KNOWLEDGE_CONFLICT");
      value.response.conflicts = [{ conflictId: "conflict:parametric-temperature", claimIds: ["claim:parametric-temperature-a", "claim:parametric-temperature-b"] }];
      break;
    case "MISSING_KNOWLEDGE":
      value.expected.claims = [];
      value.expected.procedureSteps = [];
      pack.status = "NEEDS_CONTEXT";
      pack.claims = [];
      pack.evidence.positive = [];
      pack.missingKnowledge = [{ needId: "need:synthetic-temperature", reasonCode: "MATERIAL_FACT_MISSING" }];
      abstainingResponse(value, "NEED_MORE_KNOWLEDGE", [{ needId: "need:synthetic-temperature", reasonCode: "MATERIAL_FACT_MISSING" }]);
      break;
    case "CONFLICTING_KNOWLEDGE":
      value.expected.claims = [];
      value.expected.procedureSteps = [];
      pack.status = "CONFLICT";
      pack.claims = [];
      pack.evidence.positive = [];
      pack.conflicts = [{ conflictId: "conflict:applicable-temperature", claimIds: ["claim:synthetic-temperature", "claim:other-temperature"] }];
      abstainingResponse(value, "KNOWLEDGE_CONFLICT");
      value.response.conflicts = [{ conflictId: "conflict:applicable-temperature", claimIds: ["claim:synthetic-temperature", "claim:other-temperature"] }];
      break;
    default:
      throw new Error(`UNKNOWN_SCENARIO_MUTATION:${mutation}`);
  }
  return rehashCase(value);
}

function verifyBindingTemplate(baseCase, template) {
  const expected = baseCase.bindings;
  const actual = template.bindings;
  const names = ["model", "quantization", "runtime", "prompt", "tool", "knowledge"];
  const exact = names.every((name) => JSON.stringify(expected[name]) === JSON.stringify(actual[name]));
  return exact
    && template.execution.mode === "LOCAL_NO_FINE_TUNE"
    && template.execution.networkPolicy === "DENY_ALL"
    && template.execution.actionAuthority === "NONE"
    && template.receipt.deterministicVerifierReceiptRequired === true
    && template.receipt.semanticVerifierIndependentlyIdentified === true
    && template.receipt.semanticVerifierCanOverrideDeterministicFailure === false;
}

export function runCks04Baseline(scenarioFixture = readJson(DEFAULT_SCENARIO_FIXTURE)) {
  if (scenarioFixture.schemaVersion !== "pansphaira.cks/p2-p3-scenarios/v1" || !Array.isArray(scenarioFixture.scenarios)) {
    throw new Error("SCENARIO_FIXTURE_DENIED");
  }
  const source = readJson(SOURCE_CASE_FIXTURE);
  const baseCase = source.cases.find((candidate) => candidate.caseId === "case:unknown-fact-and-procedure");
  if (!baseCase) throw new Error("BASE_CASE_NOT_FOUND");
  const template = readJson(MANIFEST_TEMPLATE);
  const bindingTemplateValid = verifyBindingTemplate(baseCase, template);

  const results = scenarioFixture.scenarios.map((scenario) => {
    const candidate = applyMutation(baseCase, scenario.mutation);
    const caseValid = validateCksEpistemicVerificationCaseV1(candidate);
    const verification = caseValid ? verifyCksEpistemicCaseV1(candidate) : { outcome: "DENIED", reasonCodes: ["MALFORMED_INPUT"], receipt: null };
    const receiptValid = verification.receipt !== null
      && validateCksVerificationReceiptV1(verification.receipt)
      && verificationReceiptDigestV1(verification.receipt) === verification.receipt.receiptDigest
      && verification.receipt.outcome === verification.outcome;
    const requestValid = candidate.requests.length > 0 && candidate.requests.every((request) => validateKnowledgeQueryRequestV1(request));
    const coverage = verification.receipt === null ? { claims: false, procedures: false } : {
      claims: verification.receipt.claimCoverage.every((claim) => claim.covered),
      procedures: verification.receipt.procedureCoverage.every((step) => step.covered),
    };
    const expectedMatch = verification.outcome === scenario.expectedOutcome
      && sameArray(verification.reasonCodes, scenario.expectedReasonCodes);
    return {
      scenarioId: scenario.scenarioId,
      category: scenario.category,
      mutation: scenario.mutation,
      expectedOutcome: scenario.expectedOutcome,
      actualOutcome: verification.outcome,
      expectedReasonCodes: scenario.expectedReasonCodes,
      actualReasonCodes: verification.reasonCodes,
      typedBoundedRequests: requestValid,
      informationNeedDetected: requestValid && candidate.requests.some((request) => request.needKinds.length > 0 && request.reasonCode.length > 0),
      claimCoverageVerified: coverage.claims,
      procedureCoverageVerified: coverage.procedures,
      receiptVerified: receiptValid,
      verifiedForScoring: receiptValid && expectedMatch,
      expectedMatch,
      receiptDigest: verification.receipt?.receiptDigest ?? null,
      deterministicVerifier: verification.receipt?.verifier.verifierId ?? null,
      semanticVerifier: verification.receipt?.semanticVerifier.verifierId ?? null,
      semanticVerifierTrusted: verification.receipt?.semanticVerifier.trusted ?? false,
    };
  });

  const verifiedResults = results.filter((result) => result.receiptVerified);
  const reportUnsigned = {
    schemaVersion: BASELINE_SCHEMA,
    fixtureId: scenarioFixture.fixtureId,
    fixtureVersion: scenarioFixture.fixtureVersion,
    sourceCaseFixture: SOURCE_CASE_FIXTURE,
    manifestTemplate: MANIFEST_TEMPLATE,
    execution: {
      mode: scenarioFixture.qualification.mode,
      networkPolicy: scenarioFixture.qualification.networkPolicy,
      scoringRule: scenarioFixture.qualification.scoringRule,
      model: baseCase.bindings.model,
      quantization: baseCase.bindings.quantization,
      runtime: baseCase.bindings.runtime,
      prompt: baseCase.bindings.prompt,
      tool: baseCase.bindings.tool,
      knowledge: baseCase.bindings.knowledge,
      bindingTemplateValid,
      deterministicVerifier: CKS_DETERMINISTIC_VERIFIER_ID_V1,
      deterministicVerifierVersion: CKS_DETERMINISTIC_VERIFIER_VERSION_V1,
      semanticVerifier: CKS_SEMANTIC_VERIFIER_ID_V1,
      semanticVerifierTrusted: false,
    },
    preconditions: {
      required: true,
      explicitChecksRequired: true,
      unknownOrUnsatisfiedCannotPass: true,
    },
    results,
    score: {
      totalCases: results.length,
      receiptVerifiedCases: verifiedResults.length,
      expectedMatches: results.filter((result) => result.expectedMatch).length,
      verifiedExpectedMatches: results.filter((result) => result.verifiedForScoring).length,
      verifiedPasses: verifiedResults.filter((result) => result.actualOutcome === "PASS" && result.expectedMatch).length,
      failClosedAbstentions: verifiedResults.filter((result) => result.actualOutcome === "ABSTAIN" && result.expectedOutcome === "ABSTAIN").length,
      qualificationStatus: "NOT_QUALIFIED",
    },
  };
  return { ...reportUnsigned, baselineDigest: sha256(JSON.stringify(reportUnsigned)) };
}

function parseArgs(argv) {
  const args = new Map();
  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];
    if (value === "--dry-run") args.set("dryRun", true);
    else if (value === "--fixture") args.set("fixture", argv[++index]);
    else throw new Error(`UNKNOWN_ARGUMENT:${value}`);
  }
  return args;
}

function goldenProjection(report) {
  return {
    scenarioCount: report.results.length,
    results: report.results.map((result) => ({
      scenarioId: result.scenarioId,
      category: result.category,
      expectedOutcome: result.expectedOutcome,
      actualOutcome: result.actualOutcome,
      expectedReasonCodes: result.expectedReasonCodes,
      actualReasonCodes: result.actualReasonCodes,
      typedBoundedRequests: result.typedBoundedRequests,
      informationNeedDetected: result.informationNeedDetected,
      claimCoverageVerified: result.claimCoverageVerified,
      procedureCoverageVerified: result.procedureCoverageVerified,
      receiptVerified: result.receiptVerified,
      verifiedForScoring: result.verifiedForScoring,
      expectedMatch: result.expectedMatch,
      deterministicVerifier: result.deterministicVerifier,
      semanticVerifier: result.semanticVerifier,
      semanticVerifierTrusted: result.semanticVerifierTrusted,
    })),
    score: report.score,
  };
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!args.get("dryRun") || typeof args.get("fixture") !== "string") throw new Error("USAGE: --fixture <baseline-golden-or-scenario-fixture.json> --dry-run");
  const fixturePath = args.get("fixture");
  const input = JSON.parse(readFileSync(resolve(process.cwd(), fixturePath), "utf8"));
  const scenarioFixture = input.schemaVersion === GOLDEN_SCHEMA
    ? readJson(input.sourceScenarioFixture)
    : input;
  const report = runCks04Baseline(scenarioFixture);
  if (input.schemaVersion === GOLDEN_SCHEMA) {
    if (input.sourceScenarioFixture !== DEFAULT_SCENARIO_FIXTURE
      || report.baselineDigest !== input.expectedBaselineDigest
      || JSON.stringify(goldenProjection(report)) !== JSON.stringify(input.expected)) {
      throw new Error("GOLDEN_EXPECTATION_MISMATCH");
    }
  }
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    main();
  } catch (error) {
    process.stderr.write(`CKS-04 baseline denied: ${error instanceof Error ? error.message : "BASELINE_FAILED"}\n`);
    process.exitCode = 1;
  }
}
