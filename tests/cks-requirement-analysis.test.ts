import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import Ajv2020 from "ajv/dist/2020.js";
import {
  analyzeForwardRequirementsV1,
  candidateSetDigestV1,
  forwardRequirementAnalysisDigestV1,
  forwardRequirementFixtureDigestV1,
  measureP11V1,
  requirementStatementDigestV1,
  validateForwardRequirementAnalysisInputV1,
  validateForwardRequirementAnalysisV1,
  validateP11MeasurementV1,
  type ForwardRequirementAnalysisInputV1,
  type RequirementCandidateV1,
} from "../packages/contracts/src/cks-requirement-analysis.js";

const golden = JSON.parse(readFileSync("tests/fixtures/cks-07/requirement-analysis-golden-v1.json", "utf8")) as {
  input: ForwardRequirementAnalysisInputV1;
  expected: { outcome: string; p11: Record<string, number | string>; states: Record<string, string> };
};
const negative = JSON.parse(readFileSync("tests/fixtures/cks-07/requirement-analysis-negative-v1.json", "utf8")) as {
  cases: Array<Record<string, unknown> & { caseId: string; operation: string; expectedOutcome: string; expectedState?: [string, string]; expectedP11?: Record<string, number>; blockedReason?: string }>;
};
const schema = JSON.parse(readFileSync("schemas/contracts/cks-requirement-analysis-v1.schema.json", "utf8")) as object;
const schemaValidator = new Ajv2020({ allErrors: true, strict: true }).compile(schema);

function refreshFixture(input: ForwardRequirementAnalysisInputV1): ForwardRequirementAnalysisInputV1 {
  return { ...input, fixtureDigest: forwardRequirementFixtureDigestV1(input) };
}

function candidateFrom(input: ForwardRequirementAnalysisInputV1, candidateId: string): RequirementCandidateV1 {
  const source = input.candidates[0];
  assert.ok(source);
  return { ...source, candidateId, statement: `Spurious statement for ${candidateId}.`, statementDigest: requirementStatementDigestV1(`Spurious statement for ${candidateId}.`), citations: [] };
}

function mutateCase(base: ForwardRequirementAnalysisInputV1, item: Record<string, unknown>): ForwardRequirementAnalysisInputV1 {
  const input = structuredClone(base) as any;
  const operation = item.operation;
  const candidateId = item.candidateId;
  if (operation === "removeCandidateAndMapping") {
    input.candidates = input.candidates.filter((candidate) => candidate.candidateId !== candidateId);
    input.mappings = input.mappings.filter((mapping) => mapping.candidateId !== candidateId);
  } else if (operation === "addSpuriousCandidate") {
    input.candidates = [...input.candidates, candidateFrom(input, "cand:spurious")];
    input.mappings = [...input.mappings, { candidateId: "cand:spurious", requirementId: "req:unknown", outcome: "MATCH", ruleId: "rule:semantic-exact-v1" }];
  } else if (operation === "addDuplicateCandidate") {
    const requirementId = item.requirementId;
    input.candidates = [...input.candidates, candidateFrom(input, "cand:duplicate")];
    input.mappings = [...input.mappings, { candidateId: "cand:duplicate", requirementId, outcome: "MATCH", ruleId: "rule:semantic-exact-v1" }];
  } else if (operation === "setCandidateCriticality") {
    input.candidates = input.candidates.map((candidate) => candidate.candidateId === candidateId ? { ...candidate, criticality: "UNKNOWN" } : candidate);
  } else if (operation === "setMappingOutcome") {
    input.mappings = input.mappings.map((mapping) => mapping.candidateId === candidateId ? { ...mapping, requirementId: null, outcome: item.outcome } : mapping);
  } else if (operation === "setCandidateSource") {
    input.candidates = input.candidates.map((candidate) => candidate.candidateId === candidateId ? { ...candidate, sourceClass: item.sourceClass } : candidate);
  } else if (operation === "setCandidateApplicability") {
    input.candidates = input.candidates.map((candidate) => candidate.candidateId === candidateId ? { ...candidate, applicability: item.applicability } : candidate);
  } else if (operation === "setCandidateConflict") {
    input.candidates = input.candidates.map((candidate) => candidate.candidateId === candidateId ? { ...candidate, conflictState: item.conflictState } : candidate);
  } else if (operation === "removeAllMappings") {
    input.mappings = [];
  } else if (operation === "setOracleApplicabilityUnknown") {
    input.requirements = input.requirements.map((requirement) => requirement.requirementId === item.requirementId
      ? { ...requirement, applicability: "UNKNOWN", applicabilityRuleId: null } : requirement);
  } else if (operation === "changeCandidateCriticalityWithoutFixtureRefresh") {
    input.candidates = input.candidates.map((candidate) => candidate.candidateId === candidateId ? { ...candidate, criticality: "UNKNOWN" } : candidate);
    return input;
  } else assert.fail(`unhandled fixture operation ${operation}`);
  return refreshFixture(input);
}

test("golden complete ground truth produces deterministic P11 PASS", () => {
  assert.equal(validateForwardRequirementAnalysisInputV1(golden.input), true);
  const first = analyzeForwardRequirementsV1(golden.input);
  const second = analyzeForwardRequirementsV1(structuredClone(golden.input));
  assert.equal(first.outcome, golden.expected.outcome);
  assert.deepEqual(first.p11, { schemaVersion: "pansphaira.cks/p11-requirement-measurement/v1", ...golden.expected.p11 });
  assert.deepEqual(second, first);
  assert.equal(validateForwardRequirementAnalysisV1(first), true);
  assert.equal(schemaValidator(first), true);
  assert.equal(validateP11MeasurementV1(first.p11), true);
  assert.equal(candidateSetDigestV1(golden.input.candidates), first.candidateSetDigest);
  for (const item of first.requirements) assert.equal(item.state, golden.expected.states[item.requirementId]);
});

test("P11 digest and key order are deterministic", () => {
  const result = analyzeForwardRequirementsV1(golden.input);
  const reordered = Object.fromEntries(Object.entries(result).reverse());
  assert.equal(forwardRequirementAnalysisDigestV1(result), result.analysisDigest);
  assert.equal(forwardRequirementAnalysisDigestV1(reordered), result.analysisDigest);
  assert.equal(measureP11V1(golden.input).status, "PASS");
});

test("negative requirement-analysis fixtures remain finite and fail closed", () => {
  for (const item of negative.cases) {
    const input = mutateCase(golden.input, item);
    const result = analyzeForwardRequirementsV1(input);
    assert.equal(result.outcome, item.expectedOutcome, item.caseId);
    assert.equal(validateForwardRequirementAnalysisV1(result), true, `${item.caseId}: runtime result`);
    assert.equal(schemaValidator(result), true, `${item.caseId}: JSON Schema`);
    if (item.expectedState !== undefined) {
      const [requirementId, state] = item.expectedState;
      const requirement = result.requirements.find((candidate) => candidate.requirementId === requirementId);
      assert.ok(requirement, item.caseId);
      assert.equal(requirement.state, state, item.caseId);
    }
    if (item.expectedP11 !== undefined) {
      assert.equal(result.p11.status, "FAIL", item.caseId);
      for (const [key, expected] of Object.entries(item.expectedP11)) assert.equal(result.p11[key as keyof typeof result.p11], expected, `${item.caseId}: ${key}`);
    }
    if (item.blockedReason !== undefined) {
      assert.equal(result.p11.status, "BLOCKED", item.caseId);
      assert.ok(result.blockedReasons.includes(item.blockedReason as never), item.caseId);
    }
  }
});

test("missing input and unknown vocabulary never receive imputed metrics", () => {
  const missing = analyzeForwardRequirementsV1(undefined);
  assert.equal(missing.outcome, "BLOCKED");
  assert.equal("requirementRecall" in missing.p11, false);
  assert.equal(validateForwardRequirementAnalysisV1(missing), true);
  const unknown = structuredClone(golden.input) as Record<string, unknown>;
  unknown.mappings = [{ candidateId: "cand:access", requirementId: null, outcome: "NOT_A_REAL_OUTCOME", ruleId: "rule:semantic-exact-v1" }];
  const blocked = analyzeForwardRequirementsV1(unknown);
  assert.equal(blocked.outcome, "BLOCKED");
  assert.equal(blocked.p11.status, "BLOCKED");
  assert.ok(blocked.blockedReasons.includes("UNKNOWN_VOCABULARY_VALUE"));
});

test("runtime validation rejects a forged successful analysis", () => {
  const forged = structuredClone(analyzeForwardRequirementsV1(golden.input)) as any;
  forged.requirements[0].state = "MISSING";
  forged.analysisDigest = forwardRequirementAnalysisDigestV1(forged);
  assert.equal(forged.outcome, "PASS");
  assert.equal(validateForwardRequirementAnalysisV1(forged), false);
});
