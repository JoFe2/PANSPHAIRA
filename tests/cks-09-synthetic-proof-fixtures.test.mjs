import { readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import test from "node:test";
import assert from "node:assert/strict";
import Ajv2020 from "ajv/dist/2020.js";
import { runP18, score } from "../scripts/cks-09-score-synthetic-proof.mjs";

const root = new URL("../", import.meta.url).pathname;
const read = (relativePath) => JSON.parse(readFileSync(`${root}${relativePath}`, "utf8"));
const holdout = read("tests/fixtures/cks-09/holdout-cases-v1.json");
const traps = read("tests/fixtures/cks-09/pattern-trap-cases-v1.json");
const groundTruth = read("tests/fixtures/cks-09/holdout-ground-truth-v1.json");
const schema = read("schemas/contracts/cks-09-synthetic-case-v1.schema.json");

function assertNoProcedureContent(value) {
  const serialized = JSON.stringify(value);
  assert.equal(serialized.includes('"procedure"'), false);
  assert.equal(serialized.includes('"procedureContent"'), false);
}

test("CKS-09 fixture JSON conforms to the closed synthetic-case schema", () => {
  const ajv = new Ajv2020({ allErrors: true, strict: false });
  const validate = ajv.compile(schema);
  assert.equal(validate(holdout), true, JSON.stringify(validate.errors));
  assert.equal(validate(traps), true, JSON.stringify(validate.errors));
  assert.equal(holdout.externalStateChanged, false);
  assert.equal(holdout.modelsOrServicesCalled, false);
  assert.equal(holdout.procedureContentReturned, false);
});

test("P17 synthetic sealed holdout proves paired experience quality/cost improvement", () => {
  const receipt = score(`${root}tests/fixtures/cks-09/holdout-cases-v1.json`);
  assert.equal(receipt.verdict, "PASS");
  assert.equal(receipt.p17.verdict, "PASS");
  assert.ok(receipt.p17.aggregate.qualityDelta > 0);
  assert.ok(receipt.p17.aggregate.costReduction > 0);
  assert.ok(receipt.p17.aggregate.efficiencyDelta > 0);
  assert.deepEqual(receipt.p17.reasons, []);
  assert.equal(receipt.p17.externalStateChanged, false);
  assert.equal(receipt.p17.modelsOrServicesCalled, false);
  assert.equal(receipt.p17.procedureContentReturned, false);
  assertNoProcedureContent(receipt);
});

test("P18 accepts only the planted stable pattern and rejects all trap classes", () => {
  const result = runP18(traps);
  assert.equal(result.verdict, groundTruth.p18.expectedVerdict);
  assert.deepEqual(result.acceptedPatternIds, ["pattern:normalize-document"]);
  assert.deepEqual(result.deniedCaseIds, groundTruth.p18.deniedCaseIds);
  for (const item of result.caseResults) {
    if (item.fixtureClass === "PLANTED_STABLE") assert.equal(item.evaluation.verdict, "ACCEPTED");
    else assert.equal(item.evaluation.reason, "INVALID_DIVERSITY_PROOF");
  }
  assertNoProcedureContent(result);
});

test("similarity cannot override inapplicability, version drift, missing context, or missing evidence", () => {
  const receipt = score(`${root}tests/fixtures/cks-09/holdout-cases-v1.json`);
  assert.deepEqual(receipt.reuseBoundaries, [
    { caseId: "similar-looking-inapplicable", outcome: "DENIED", reason: "PRECONDITION_FALSE" },
    { caseId: "exact-shape-version-drift", outcome: "DENIED", reason: "VERSION_INCOMPATIBLE" },
    { caseId: "unknown-applicability-context", outcome: "DENIED", reason: "AMBIGUOUS_APPLICABILITY" },
    { caseId: "absent-success-evidence", outcome: "DENIED", reason: "MISSING_EVIDENCE" },
  ]);
});

test("all explicit failure-closed boundaries are exercised and evidence-bound references are preserved", () => {
  const receipt = score(`${root}tests/fixtures/cks-09/holdout-cases-v1.json`);
  assert.deepEqual(receipt.failureClosedChecks.map((item) => item.reason), [
    "MISSING_288_DIGEST",
    "UNSEALED_HOLDOUT",
    "LIVE_REPLAY_FORBIDDEN",
    "HOLDOUT_LEAKAGE",
    "PROSE_ONLY_INPUT",
  ]);
  assert.deepEqual(receipt.preservation, {
    dependencyRefs: ["dependency:parser"],
    knownFailureRefs: ["failure:known-001"],
    counterexampleRefs: ["counterexample:similar-001"],
    provenanceRefs: ["provenance:fixture-a", "provenance:fixture-b", "provenance:fixture-c"],
    counterevidenceCoverage: "COMPLETE",
  });
});

test("the required CLI emits a deterministic JSON receipt", () => {
  const output = execFileSync(process.execPath, [
    "scripts/cks-09-score-synthetic-proof.mjs",
    "--fixture",
    "tests/fixtures/cks-09/holdout-cases-v1.json",
    "--dry-run",
  ], { cwd: root, encoding: "utf8" });
  const receipt = JSON.parse(output);
  assert.equal(receipt.verdict, "PASS");
  assert.equal(receipt.p17.verdict, "PASS");
  assert.equal(receipt.p18.verdict, "PASS");
  assertNoProcedureContent(receipt);
});
