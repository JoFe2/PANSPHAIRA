#!/usr/bin/env node
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createHash } from "node:crypto";
import Ajv2020 from "ajv/dist/2020.js";
import {
  analyzeForwardRequirementsV1,
  forwardRequirementFixtureDigestV1,
  validateForwardRequirementAnalysisInputV1,
} from "../dist/packages/contracts/src/cks-requirement-analysis.js";
import {
  GAP_FINDER_RESULT_SCHEMA_V1,
  KNOWLEDGE_SUFFICIENCY_PROOF_INPUT_SCHEMA_V1,
  P13_FALSE_COMPLETENESS_PROOF_INPUT_SCHEMA_V1,
  SUFFICIENCY_AUTHORITY_BOUNDARY_V1,
  backwardClaimDigestV1,
  backwardClaimProofDigestV1,
  boundaryProbeDigestV1,
  gapFinderItemDigestV1,
  gapFinderResultDigestV1,
  p13FixtureDigestV1,
  proveKnowledgeSufficiencyV1,
  proveP13FalseCompletenessV1,
  requirementBindingsDigestV1,
  sufficiencyProofFixtureDigestV1,
  validateP13FalseCompletenessProofInputV1,
} from "../dist/packages/contracts/src/cks-sufficiency-proof.js";

const ROOT = resolve(new URL("..", import.meta.url).pathname);
const GROUND_TRUTH_PATH = resolve(ROOT, "tests/fixtures/cks-07/empty-kb-ground-truth-v1.json");
const SCHEMA_PATH = resolve(ROOT, "schemas/contracts/cks-empty-kb-case-v1.schema.json");
const ACCEPTED_SOURCE_CLASSES = ["ACTIVE_CURATED_KNOWLEDGE"];
const PROBE_CLASSES = ["MISSING", "BAD_SOURCE", "APPLICABILITY", "CONFLICTING", "UNKNOWN_SEMANTIC"];

function canonicalJson(value) {
  if (value === null || typeof value === "boolean" || typeof value === "string") return JSON.stringify(value);
  if (typeof value === "number") {
    if (!Number.isFinite(value)) throw new TypeError("non-finite number");
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  if (value === null || typeof value !== "object" || Object.getPrototypeOf(value) !== Object.prototype) throw new TypeError("plain JSON object required");
  return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonicalJson(value[key])}`).join(",")}}`;
}

const hash = (value) => createHash("sha256").update(canonicalJson(value)).digest("hex");
const readJson = (path) => JSON.parse(readFileSync(path, "utf8"));
const equalJson = (left, right) => canonicalJson(left) === canonicalJson(right);
const fail = (message) => { throw new Error(`CKS-07_EMPTY_KB_${message}`); };

function parseArgs(args) {
  if (args.length !== 3 || args[0] !== "--fixture" || args[2] !== "--dry-run") {
    fail("USAGE: expected --fixture <path> --dry-run");
  }
  return resolve(args[1]);
}

function loadFixture(fixturePath) {
  const fixture = readJson(fixturePath);
  const groundTruth = readJson(GROUND_TRUTH_PATH);
  const schema = readJson(SCHEMA_PATH);
  const validate = new Ajv2020({ allErrors: true, strict: true }).compile(schema);
  if (!validate(fixture)) fail(`FIXTURE_SCHEMA_INVALID ${JSON.stringify(validate.errors)}`);
  if (!validate(groundTruth)) fail(`GROUND_TRUTH_SCHEMA_INVALID ${JSON.stringify(validate.errors)}`);
  if (fixture.groundTruthId !== groundTruth.groundTruthId || fixture.suiteId !== groundTruth.suiteId) fail("GROUND_TRUTH_BINDING_INVALID");
  if (fixture.denominatorDigest !== groundTruth.denominatorDigest) fail("DENOMINATOR_BINDING_INVALID");
  const applicableIds = groundTruth.requirements.filter((requirement) => requirement.applicability === "APPLICABLE").map((requirement) => requirement.requirementId);
  if (hash(applicableIds) !== groundTruth.denominatorDigest) fail("DENOMINATOR_DIGEST_INVALID");
  if (new Set(fixture.cases.map((item) => item.caseId)).size !== fixture.cases.length) fail("CASE_IDS_NOT_UNIQUE");
  for (const item of fixture.cases) {
    const expectedIds = groundTruth.requirements.map((requirement) => requirement.requirementId);
    if (!equalJson(item.expectedStates.map((entry) => entry.requirementId).sort(), expectedIds.sort())) fail(`${item.caseId}_GROUND_TRUTH_INCOMPLETE`);
    if (!equalJson(item.simpleSolver.requirementIds, applicableIds)) fail(`${item.caseId}_SOLVER_DENOMINATOR_INVALID`);
    if (item.simpleSolver.a0CoveredRequirementIds.some((id) => !applicableIds.includes(id))) fail(`${item.caseId}_SOLVER_COVERAGE_INVALID`);
  }
  return { fixture, groundTruth };
}

function makeForwardInput(item, groundTruth) {
  const draft = {
    schemaVersion: "pansphaira.cks/forward-requirement-analysis-input/v1",
    analysisId: `analysis:${item.caseId.slice("case:".length)}`,
    caseId: item.caseId,
    semanticRuleSetDigest: groundTruth.semanticRuleSetDigest,
    requirements: groundTruth.requirements,
    candidates: item.candidates,
    mappings: item.mappings,
  };
  return { ...draft, fixtureDigest: forwardRequirementFixtureDigestV1(draft) };
}

function makeProofInput(item, forward, denominatorDigest) {
  const bindings = forward.requirements.map((requirement) => ({
    requirementId: requirement.requirementId,
    needDigest: hash({ caseId: item.caseId, requirementId: requirement.requirementId }),
  }));
  const gapResults = bindings.map((binding) => {
    const requirement = forward.requirements.find((candidate) => candidate.requirementId === binding.requirementId);
    if (requirement === undefined) fail(`${item.caseId}_REQUIREMENT_RESULT_MISSING`);
    const satisfied = requirement.state === "SATISFIED";
    const notApplicable = requirement.state === "NOT_APPLICABLE";
    const gapClass = satisfied || notApplicable ? "NONE" : requirement.state;
    const requirementOutcome = satisfied ? "SATISFIED" : notApplicable ? "NOT_APPLICABLE" : `GAP_${gapClass}`;
    const draft = {
      needDigest: binding.needDigest,
      gapClass,
      requirementOutcome,
      sourceClasses: satisfied ? ["ACTIVE_CURATED_KNOWLEDGE"] : [],
      evidenceDigests: [hash({ caseId: item.caseId, evidence: binding.requirementId })],
    };
    return { ...draft, resultDigest: gapFinderItemDigestV1(draft) };
  });
  const knowledgeBundleDigest = hash({ knowledgeBundle: "cks-07-empty-kb", caseId: item.caseId });
  const gapDraft = {
    schemaVersion: GAP_FINDER_RESULT_SCHEMA_V1,
    caseId: item.caseId,
    requirementSetDigest: forward.requirementSetDigest,
    knowledgeBundleDigest,
    results: gapResults,
  };
  const gapFinderResult = { ...gapDraft, finderDigest: gapFinderResultDigestV1(gapDraft) };
  const boundaryProbes = PROBE_CLASSES.map((probeClass, index) => {
    const draft = {
      probeId: `probe:${item.caseId.slice("case:".length)}-${index}`,
      probeClass,
      needDigest: bindings[0]?.needDigest ?? hash(null),
      expectedOutcome: item.boundaryProbeOutcome,
      observedOutcome: item.boundaryProbeOutcome,
      sourceClasses: [],
      evidenceDigests: [hash({ caseId: item.caseId, probeClass })],
    };
    return { ...draft, probeDigest: boundaryProbeDigestV1(draft) };
  });
  const claims = bindings.map((binding) => {
    const requirement = forward.requirements.find((candidate) => candidate.requirementId === binding.requirementId);
    if (requirement === undefined) fail(`${item.caseId}_CLAIM_REQUIREMENT_MISSING`);
    const proven = item.backwardProofStatus === "PASS";
    const notApplicable = requirement.state === "NOT_APPLICABLE";
    const draft = {
      needDigest: binding.needDigest,
      claimOutcome: notApplicable ? "NOT_APPLICABLE" : "SATISFIED",
      proofState: proven ? "PROVEN" : "UNPROVEN",
      sourceClasses: proven && !notApplicable ? ["ACTIVE_CURATED_KNOWLEDGE"] : [],
      evidenceDigests: [hash({ caseId: item.caseId, claim: binding.requirementId })],
    };
    return { ...draft, claimDigest: backwardClaimDigestV1(draft) };
  });
  const backwardDraft = { claims, proofStatus: item.backwardProofStatus };
  const backwardClaimProof = { ...backwardDraft, proofDigest: backwardClaimProofDigestV1(backwardDraft) };
  const draft = {
    schemaVersion: KNOWLEDGE_SUFFICIENCY_PROOF_INPUT_SCHEMA_V1,
    proofId: `proof:${item.caseId.slice("case:".length)}`,
    caseId: item.caseId,
    fixtureDigest: hash(null),
    requirementSetDigest: forward.requirementSetDigest,
    knowledgeBundleDigest,
    forwardRequirementAnalysis: forward,
    requirementBindings: bindings,
    requirementBindingsDigest: requirementBindingsDigestV1(bindings),
    gapFinderResult,
    boundaryProbes,
    backwardClaimProof,
    authorityBoundary: SUFFICIENCY_AUTHORITY_BOUNDARY_V1,
  };
  return { ...draft, fixtureDigest: sufficiencyProofFixtureDigestV1(draft) };
}

function scoreCase(item, groundTruth, denominatorDigest) {
  const forwardInput = makeForwardInput(item, groundTruth);
  if (!validateForwardRequirementAnalysisInputV1(forwardInput)) fail(`${item.caseId}_FORWARD_INPUT_INVALID`);
  const forward = analyzeForwardRequirementsV1(forwardInput);
  const expectedP11 = { ...item.expectedP11, schemaVersion: "pansphaira.cks/p11-requirement-measurement/v1" };
  if (!equalJson(forward.p11, expectedP11)) fail(`${item.caseId}_P11_GROUND_TRUTH_MISMATCH`);
  const actualStates = forward.requirements.map(({ requirementId, state }) => ({ requirementId, state }));
  if (!equalJson(actualStates, item.expectedStates)) fail(`${item.caseId}_STATE_GROUND_TRUTH_MISMATCH`);
  const proofInput = makeProofInput(item, forward, denominatorDigest);
  const combined = proveKnowledgeSufficiencyV1(proofInput);
  const solverRequirementIds = item.simpleSolver.requirementIds;
  const simpleOutcome = solverRequirementIds.length > 0 && solverRequirementIds.every((id) => item.simpleSolver.a0CoveredRequirementIds.includes(id)) ? "COMPLETE" : "INCOMPLETE";
  return {
    caseId: item.caseId,
    kbClass: item.kbClass,
    oracleOutcome: item.oracleOutcome,
    p11: forward.p11,
    states: actualStates,
    combinedOutcome: combined.outcome,
    materialCompleteness: combined.materialCompleteness,
    components: {
      forward: combined.forwardOutcome,
      gapFinder: combined.gapFinderOutcome,
      boundary: combined.boundaryOutcome,
      backward: combined.backwardOutcome,
    },
    simpleSolverOutcome: simpleOutcome,
    acceptedCandidateIds: forward.requirements.filter((requirement) => requirement.matchedCandidateId !== null).map((requirement) => requirement.matchedCandidateId),
    acceptedKnowledgeSourceClasses: ACCEPTED_SOURCE_CLASSES,
    authorityBoundary: SUFFICIENCY_AUTHORITY_BOUNDARY_V1,
    proofInput,
  };
}

function buildP13Input(scoredCases, fixture) {
  const cases = scoredCases.map((scored, index) => {
    const source = fixture.cases[index];
    const simpleSolver = {
      solverId: "CKS-07-SIMPLE-SOLVER-V1",
      inputDigest: scored.proofInput.fixtureDigest,
      denominatorDigest: fixture.denominatorDigest,
      requirementIds: source.simpleSolver.requirementIds,
      a0CoveredRequirementIds: source.simpleSolver.a0CoveredRequirementIds,
    };
    return {
      caseId: scored.caseId,
      oracleOutcome: scored.oracleOutcome,
      denominatorDigest: fixture.denominatorDigest,
      caseInputDigest: scored.proofInput.fixtureDigest,
      proofInput: scored.proofInput,
      simpleSolver,
    };
  });
  const draft = {
    schemaVersion: P13_FALSE_COMPLETENESS_PROOF_INPUT_SCHEMA_V1,
    suiteId: "suite:cks-07-empty-kb-p13",
    fixtureDigest: hash(null),
    denominatorDigest: fixture.denominatorDigest,
    cases,
  };
  return { ...draft, fixtureDigest: p13FixtureDigestV1(draft) };
}

export function scoreEmptyKbFixture(fixturePath) {
  const { fixture, groundTruth } = loadFixture(fixturePath);
  const scoredCases = fixture.cases.map((item) => scoreCase(item, groundTruth, fixture.denominatorDigest));
  const p13Input = buildP13Input(scoredCases, fixture);
  if (!validateP13FalseCompletenessProofInputV1(p13Input)) fail(`P13_INPUT_INVALID`);
  const p13Proof = proveP13FalseCompletenessV1(p13Input);
  const p11Failures = scoredCases.filter((item) => item.p11.status === "FAIL");
  const p11Blocked = scoredCases.filter((item) => item.p11.status === "BLOCKED");
  const criticalMissCases = scoredCases.filter((item) => item.p11.criticalRequirementMisses > 0);
  const report = {
    schemaVersion: "pansphaira.cks/empty-kb-metrics/v1",
    suiteId: fixture.suiteId,
    fixtureDigest: hash(fixture),
    denominatorDigest: fixture.denominatorDigest,
    caseCount: scoredCases.length,
    p11: {
      caseCount: scoredCases.length,
      passCases: scoredCases.length - p11Failures.length - p11Blocked.length,
      failCases: p11Failures.length,
      blockedCases: p11Blocked.length,
      requirementRecallMean: scoredCases.reduce((sum, item) => sum + item.p11.requirementRecall, 0) / scoredCases.length,
      requirementPrecisionMean: scoredCases.reduce((sum, item) => sum + item.p11.requirementPrecision, 0) / scoredCases.length,
      totalCriticalRequirementMisses: scoredCases.reduce((sum, item) => sum + item.p11.criticalRequirementMisses, 0),
      criticalRequirementMissCases: criticalMissCases.length,
    },
    p13: p13Proof,
    acceptedKnowledgeSourceClasses: ACCEPTED_SOURCE_CLASSES,
    authorityBoundary: SUFFICIENCY_AUTHORITY_BOUNDARY_V1,
    cases: scoredCases.map(({ proofInput, ...item }) => item),
  };
  if (p13Proof.proofOutcome !== "PASS") fail(`P13_PROOF_${p13Proof.proofOutcome}`);
  if (scoredCases.some((item) => item.oracleOutcome === "SUFFICIENT" && item.combinedOutcome !== "SUFFICIENT")) fail("SUFFICIENT_CASE_REJECTED");
  if (scoredCases.some((item) => item.oracleOutcome === "INSUFFICIENT" && item.combinedOutcome === "SUFFICIENT")) fail("FALSE_COMPLETENESS_ACCEPTED");
  if (scoredCases.some((item) => (["INTERNET_RESULT", "MODEL_RESULT"].includes(fixture.cases.find((source) => source.caseId === item.caseId)?.candidates[0]?.sourceClass) && item.combinedOutcome === "SUFFICIENT"))) fail("UNTRUSTED_SOURCE_ACCEPTED");
  return report;
}

if (process.argv[1] && resolve(process.argv[1]) === resolve(new URL(import.meta.url).pathname)) {
  try {
    const fixturePath = parseArgs(process.argv.slice(2));
    process.stdout.write(`${JSON.stringify(scoreEmptyKbFixture(fixturePath), null, 2)}\n`);
  } catch (error) {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 2;
  }
}
