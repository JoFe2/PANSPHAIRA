import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";
import Ajv2020 from "ajv/dist/2020.js";

const root = resolve(import.meta.dirname, "..");
const fixturePath = resolve(root, "tests/fixtures/cks-07/empty-kb-cases-v1.json");
const truthPath = resolve(root, "tests/fixtures/cks-07/empty-kb-ground-truth-v1.json");
const schemaPath = resolve(root, "schemas/contracts/cks-empty-kb-case-v1.schema.json");
const scriptPath = resolve(root, "scripts/cks-07-score-empty-kb.mjs");
const fixture = JSON.parse(readFileSync(fixturePath, "utf8"));
const truth = JSON.parse(readFileSync(truthPath, "utf8"));
const schema = JSON.parse(readFileSync(schemaPath, "utf8"));

function score() {
  return JSON.parse(execFileSync(process.execPath, [scriptPath, "--fixture", fixturePath, "--dry-run"], { cwd: root, encoding: "utf8" }));
}

test("empty/minimal-KB fixtures are schema-valid and bind complete ground truth", () => {
  const validate = new Ajv2020({ allErrors: true, strict: true }).compile(schema);
  assert.equal(validate(truth), true, JSON.stringify(validate.errors));
  assert.equal(validate(fixture), true, JSON.stringify(validate.errors));
  const ids = truth.requirements.map((requirement) => requirement.requirementId);
  assert.equal(fixture.cases.length, 9);
  for (const item of fixture.cases) {
    assert.deepEqual(item.expectedStates.map((entry) => entry.requirementId).sort(), ids.sort(), item.caseId);
    assert.deepEqual(item.simpleSolver.requirementIds, ["req:access", "req:audit", "req:retention"], item.caseId);
    assert.equal(item.authorityBoundary, "READ_ONLY_KNOWLEDGE_NO_CREDENTIAL_POLICY_CAPABILITY_TOOL_WRITE_OR_EXECUTION_AUTHORITY");
  }
});

test("P11 reports recall, precision, and critical requirement misses for every case", () => {
  const report = score();
  assert.equal(report.caseCount, 9);
  assert.deepEqual(report.p11, {
    caseCount: 9,
    passCases: 1,
    failCases: 8,
    blockedCases: 0,
    requirementRecallMean: 0.14814814814814814,
    requirementPrecisionMean: 0.2222222222222222,
    totalCriticalRequirementMisses: 15,
    criticalRequirementMissCases: 8,
  });
  const byId = new Map(report.cases.map((item) => [item.caseId, item]));
  assert.equal(byId.get("case:empty-kb").p11.requirementRecall, 0);
  assert.equal(byId.get("case:minimal-kb").p11.requirementPrecision, 1);
  assert.equal(byId.get("case:minimal-kb").p11.criticalRequirementMisses, 1);
  assert.equal(byId.get("case:sufficient-minimal-kb").p11.status, "PASS");
  for (const [caseId, state] of [
    ["case:missing-gap", "MISSING"],
    ["case:bad-source-internet", "BAD_SOURCE"],
    ["case:bad-source-model", "BAD_SOURCE"],
    ["case:applicability-gap", "APPLICABILITY"],
    ["case:conflicting-gap", "CONFLICTING"],
    ["case:unknown-semantic-gap", "UNKNOWN_SEMANTIC"],
  ]) {
    const item = byId.get(caseId);
    assert.equal(item.combinedOutcome, "INSUFFICIENT", caseId);
    assert.equal(item.states.find((entry) => entry.requirementId === "req:access").state, state, caseId);
    assert.equal(item.materialCompleteness, "NOT_MATERIAL_COMPLETE", caseId);
  }
});

test("P13 proves combined Sufficiency reduces false completeness against the explicit simple solver", () => {
  const report = score();
  assert.equal(report.p13.proofOutcome, "PASS");
  assert.equal(report.p13.caseCount, 9);
  assert.deepEqual(report.p13.metrics, {
    insufficientOracleCases: 8,
    sufficientOracleCases: 1,
    combinedFalseCompletenessCount: 0,
    simpleSolverFalseCompletenessCount: 6,
    combinedTrueCompletenessCount: 1,
    combinedFalseCompletenessRate: 0,
    simpleSolverFalseCompletenessRate: 0.75,
    falseCompletenessAbsoluteReduction: 0.75,
    combinedTrueCompletenessRate: 1,
  });
  for (const item of report.cases) {
    const expectedSimpleOutcome = ["case:empty-kb", "case:missing-gap"].includes(item.caseId) ? "INCOMPLETE" : "COMPLETE";
    assert.equal(item.simpleSolverOutcome, expectedSimpleOutcome, item.caseId);
    assert.deepEqual(item.acceptedKnowledgeSourceClasses, ["ACTIVE_CURATED_KNOWLEDGE"]);
  }
});

test("Internet and model results never become accepted Knowledge or Authority", () => {
  const report = score();
  for (const caseId of ["case:bad-source-internet", "case:bad-source-model"]) {
    const item = report.cases.find((candidate) => candidate.caseId === caseId);
    assert.equal(item.combinedOutcome, "INSUFFICIENT", caseId);
    assert.deepEqual(item.acceptedCandidateIds, [], caseId);
    assert.deepEqual(item.acceptedKnowledgeSourceClasses, ["ACTIVE_CURATED_KNOWLEDGE"], caseId);
    assert.equal(item.authorityBoundary, "READ_ONLY_KNOWLEDGE_NO_CREDENTIAL_POLICY_CAPABILITY_TOOL_WRITE_OR_EXECUTION_AUTHORITY", caseId);
  }
});

test("scoring is deterministic byte-for-byte", () => {
  assert.equal(JSON.stringify(score()), JSON.stringify(score()));
});
