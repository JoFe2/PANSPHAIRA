import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import test from "node:test";

const root = new URL("..", import.meta.url).pathname;
const script = "scripts/run-cks-04-baseline.mjs";
const goldenPath = "tests/fixtures/cks-04/baseline-golden-v1.json";
const scenariosPath = "tests/fixtures/cks-04/p2-p3-scenarios-v1.json";
const templatePath = "verification/cks-04-baseline-manifest-template-v1.json";

function json(path) {
  return JSON.parse(readFileSync(new URL(path, `file://${root}/`), "utf8"));
}

function run(fixture) {
  const result = spawnSync(process.execPath, [script, "--fixture", fixture, "--dry-run"], {
    cwd: root,
    encoding: "utf8",
  });
  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.equal(result.signal, null);
  return JSON.parse(result.stdout);
}

test("CKS-04 P2/P3 harness is offline, reproducible, and golden-bound", () => {
  const first = run(goldenPath);
  const second = run(goldenPath);
  assert.equal(first.baselineDigest, second.baselineDigest);
  assert.equal(first.schemaVersion, "pansphaira.cks/p2-p3-baseline/v1");
  assert.equal(first.execution.mode, "LOCAL_NO_FINE_TUNE");
  assert.equal(first.execution.networkPolicy, "DENY_ALL");
  assert.equal(first.execution.scoringRule, "VERIFIED_RECEIPT_ONLY");
  assert.equal(first.execution.bindingTemplateValid, true);
  assert.equal(first.score.qualificationStatus, "NOT_QUALIFIED");
});

test("every mandatory scenario emits a typed retrieval need and only verified receipts are scored", () => {
  const report = run(scenariosPath);
  const fixture = json(scenariosPath);
  assert.deepEqual(report.results.map((result) => result.scenarioId), fixture.scenarios.map((scenario) => scenario.scenarioId));
  assert.equal(report.results.length, 6);
  assert.ok(report.results.every((result) => result.typedBoundedRequests));
  assert.ok(report.results.every((result) => result.informationNeedDetected));
  assert.ok(report.results.every((result) => result.receiptVerified));
  assert.ok(report.results.every((result) => result.verifiedForScoring));
  assert.deepEqual(report.results.map((result) => result.actualOutcome), ["PASS", "ABSTAIN", "ABSTAIN", "ABSTAIN", "ABSTAIN", "ABSTAIN"]);
  assert.equal(report.score.receiptVerifiedCases, 6);
  assert.equal(report.score.verifiedExpectedMatches, 6);
  assert.equal(report.score.verifiedPasses, 1);
  assert.equal(report.score.failClosedAbstentions, 5);
});

test("positive synthetic fact/procedure coverage is complete and fail-closed scenarios stay abstained", () => {
  const report = run(goldenPath);
  const positive = report.results[0];
  assert.equal(positive.category, "UNKNOWN_FACT_AND_PROCEDURE");
  assert.equal(positive.actualOutcome, "PASS");
  assert.equal(positive.claimCoverageVerified, true);
  assert.equal(positive.procedureCoverageVerified, true);

  const byCategory = new Map(report.results.map((result) => [result.category, result]));
  for (const category of ["APPLICABILITY", "EXCLUSION", "PARAMETRIC_CONFLICT", "MISSING_KNOWLEDGE", "CONFLICTING_KNOWLEDGE"]) {
    const result = byCategory.get(category);
    assert.ok(result);
    assert.equal(result.actualOutcome, "ABSTAIN", category);
    assert.equal(result.verifiedForScoring, true, category);
  }
  assert.deepEqual(byCategory.get("APPLICABILITY").actualReasonCodes, ["APPLICABILITY_MISMATCH"]);
  assert.deepEqual(byCategory.get("EXCLUSION").actualReasonCodes, ["EXCLUSION_MATCHED"]);
  assert.deepEqual(byCategory.get("PARAMETRIC_CONFLICT").actualReasonCodes, ["KNOWLEDGE_CONFLICT"]);
  assert.deepEqual(byCategory.get("MISSING_KNOWLEDGE").actualReasonCodes, ["MISSING_KNOWLEDGE"]);
  assert.deepEqual(byCategory.get("CONFLICTING_KNOWLEDGE").actualReasonCodes, ["KNOWLEDGE_CONFLICT"]);
});

test("manifest template binds exact execution versions and separates deterministic and semantic verification", () => {
  const report = run(goldenPath);
  const template = json(templatePath);
  for (const name of ["model", "quantization", "runtime", "prompt", "tool", "knowledge"]) {
    assert.deepEqual(report.execution[name], template.bindings[name], name);
  }
  assert.equal(report.execution.deterministicVerifier, template.bindings.deterministicVerifier.id);
  assert.equal(report.execution.deterministicVerifierVersion, template.bindings.deterministicVerifier.version);
  assert.equal(report.execution.semanticVerifier, template.bindings.semanticVerifier.id);
  assert.equal(report.execution.semanticVerifierTrusted, false);
  assert.ok(report.results.every((result) => result.deterministicVerifier === template.bindings.deterministicVerifier.id));
  assert.ok(report.results.every((result) => result.semanticVerifier === template.bindings.semanticVerifier.id));
  assert.ok(report.results.every((result) => result.semanticVerifierTrusted === false));
});
