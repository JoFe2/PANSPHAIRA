import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import Ajv2020 from "ajv/dist/2020.js";
import addFormats from "ajv-formats";
import {
  canonical,
  derivePairKey,
  deriveRunId,
  materializePairedSchedule,
  orchestratePairedRuns,
  sha256,
  validateBasicFixture,
  validatePairedSchedule,
} from "../scripts/run-cks-05-benchmark.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const fixture = JSON.parse(readFileSync(join(root, "tests/fixtures/cks-05/executor-golden-v1.json"), "utf8"));
const resultSchema = JSON.parse(readFileSync(join(root, "schemas/cks-05-benchmark-result-v1.schema.json"), "utf8"));
const validateResult = new Ajv2020({ allErrors: true, strict: true });
addFormats(validateResult);
const resultIsValid = validateResult.compile(resultSchema);
const expectedArms = ["ARM-LRF-01", "ARM-SRF-02", "ARM-LSF-03", "ARM-SSF-04", "ARM-SSG-05"];
const expectedReports = [
  "AB-MODEL-RAW", "AB-MODEL-STRUCTURED", "AB-STRUCTURED-VS-RAW-LARGE",
  "AB-STRUCTURED-VS-RAW-SMALL", "AB-FACTS-VS-GUIDANCE-SMALL", "AB-STATIC-VS-UPDATED",
  "AB-SINGLE-VS-MULTI-HOP",
];

const runCli = (args) => {
  try {
    return { status: 0, stdout: execFileSync(process.execPath, [join(root, "scripts/run-cks-05-benchmark.mjs"), ...args], { cwd: root, encoding: "utf8" }), stderr: "" };
  } catch (error) {
    return { status: error.status ?? 1, stdout: error.stdout ?? "", stderr: error.stderr ?? "" };
  }
};

test("executor dry-run materializes paired five-arm fresh-domain schedule and invokes L4", () => {
  const result = orchestratePairedRuns(fixture);
  assert.equal(result.status, "CLAIM_DENIED");
  assert.equal(result.runCounts.scheduled, 120);
  assert.equal(result.runCounts.observed, 120);
  assert.equal(result.runCounts.completed, 111);
  assert.equal(result.runCounts.failed, 6);
  assert.equal(result.runCounts.invalidated, 3);
  assert.equal(result.runCounts.scored, 117);
  assert.equal(result.failures.length, 9);
  assert.deepEqual(result.failures.map((failure) => failure.failureCodeOrNull), ["TIMEOUT", "TIMEOUT", "TIMEOUT", "DOCKER_ENOENT", "DOCKER_ENOENT", "DOCKER_ENOENT", "TIMEOUT", "TIMEOUT", "TIMEOUT"]);
  assert.deepEqual(result.comparisons.map((comparison) => comparison.reportId), expectedReports);
  assert.ok(result.comparisons.every((comparison) => comparison.status === "MEASURED"));
  assert.ok(result.comparisons.every((comparison) => comparison.confidenceInterval.available));
  assert.equal(result.claimGate.modelSubstitutionClaim, false);
  assert.equal(result.claimGate.qualityGate, false);
  assert.equal(result.claimGate.efficiencyGate, false);
  assert.equal(result.claimGate.allQualityAndEfficiencyThresholdsPass, false);
  assert.deepEqual(result.stopConditions.ruleIds, ["STOP-06-RESOURCE-OR-TIME", "STOP-05-FAILURE-RATE", "FALSIFY-SUBSTITUTION"]);
  assert.equal(result.stopConditions.falsifiedArchitecture, false, "infrastructure evidence is not a product verdict");
  assert.deepEqual(result.stopConditions.simplifications, [
    "SIMPLIFY-STRUCTURE=BLOCKED_UNTIL_COMPLETE_VALID_EVIDENCE",
    "SIMPLIFY-GUIDANCE=BLOCKED_UNTIL_COMPLETE_VALID_EVIDENCE",
    "SIMPLIFY-UPDATES=BLOCKED_UNTIL_COMPLETE_VALID_EVIDENCE",
    "SIMPLIFY-MULTI-HOP=BLOCKED_UNTIL_COMPLETE_VALID_EVIDENCE",
  ]);
  assert.equal(result.receipt.requiredEvidencePresent, false);
  assert.equal(resultIsValid(result), true, JSON.stringify(validateResult.errors, null, 2));
});

test("paired schedule uses identical task/edition/seed identity in every five-arm cell", () => {
  const records = materializePairedSchedule(fixture);
  assert.equal(records.length, 120);
  assert.equal(new Set(records.map((record) => record.runId)).size, 120);
  assert.equal(new Set(records.map((record) => record.pairKey)).size, 24);
  const byPair = new Map();
  for (const record of records) byPair.set(record.pairKey, [...(byPair.get(record.pairKey) ?? []), record]);
  for (const [pairKey, group] of byPair) {
    assert.equal(group.length, 5, pairKey);
    assert.deepEqual(group.map((record) => record.armId).sort(), expectedArms);
    for (const field of ["taskId", "scenarioPairId", "domainId", "hopClass", "updateSensitivity", "editionId", "generationSeed", "goldRecordSha256", "evidenceGraphSha256", "canonicalFactInventorySha256"]) {
      assert.equal(new Set(group.map((record) => canonical(record[field]))).size, 1, `${pairKey} ${field}`);
    }
  }
  const sample = records[0];
  assert.equal(sample.runId, deriveRunId(fixture.protocol.protocolDigestSha256, sample.armId, sample.taskId, sample.editionId, sample.generationSeed));
  assert.equal(sample.pairKey, derivePairKey(fixture.protocol.protocolDigestSha256, sample.taskId, sample.editionId, sample.generationSeed));
  assert.deepEqual(validatePairedSchedule(records, fixture), []);
});

test("executor preserves model and infrastructure failures without replacement or claim", () => {
  const result = orchestratePairedRuns(fixture);
  for (const failure of result.failures) {
    assert.equal(failure.preserved, true);
    assert.ok(failure.runId.startsWith("run:"));
    assert.ok(["MODEL_FAILURE_SCORED_ZERO", "INFRASTRUCTURE_INVALIDATION_NOT_PRODUCT_VERDICT"].includes(failure.productVerdict));
  }
  assert.ok(result.claimGate.reasonCodes.includes("MODEL_FAILURES_PRESENT"));
  assert.ok(result.claimGate.reasonCodes.includes("INFRASTRUCTURE_INVALIDATION_PRESENT"));
  assert.ok(result.claimGate.reasonCodes.includes("QUALITY_OR_EFFICIENCY_THRESHOLD_NOT_PASSED"));
});

test("fail closed before scoring when freshness, pairing, or complete evidence is absent", () => {
  const wrongFreshness = structuredClone(fixture);
  wrongFreshness.freshDomain.freshnessStatus = "REUSED_PUBLIC";
  assert.throws(() => orchestratePairedRuns(wrongFreshness), /FRESHNESS/);

  const wrongCount = structuredClone(fixture);
  wrongCount.schedule.expectedRunCount -= 1;
  assert.throws(() => orchestratePairedRuns(wrongCount), /RUN_COUNT/);

  const missingResponse = structuredClone(fixture);
  delete missingResponse.response;
  assert.throws(() => orchestratePairedRuns(missingResponse), /RESPONSE_TEMPLATE/);
});

test("CLI reports the closed L4 result and refuses non-dry-run execution", () => {
  const dryRun = runCli(["--fixture", "tests/fixtures/cks-05/executor-golden-v1.json", "--dry-run"]);
  assert.equal(dryRun.status, 0, `${dryRun.stderr}\n${dryRun.stdout}`);
  const result = JSON.parse(dryRun.stdout);
  assert.equal(result.runCounts.observed, 120);
  assert.deepEqual(result.comparisons.map((comparison) => comparison.reportId), expectedReports);
  assert.equal(result.claimGate.modelSubstitutionClaim, false);

  const unauthorized = runCli(["--fixture", "tests/fixtures/cks-05/executor-golden-v1.json"]);
  assert.equal(unauthorized.status, 3);
  assert.match(unauthorized.stderr, /EXECUTION_NOT_AUTHORIZED/);
});

// Keep the fixture's response digest rule independently exercised: L4 must not
// receive a hand-edited digest or silently score altered evidence.
test("completed evidence is digest-bound before L4 scoring", () => {
  const records = materializePairedSchedule(fixture).filter((record) => record.terminalStatus === "COMPLETED");
  assert.equal(records[0].responseSha256, sha256(canonical(records[0].response)));
  const altered = structuredClone(fixture);
  altered.response.finalAnswer = "altered";
  assert.notEqual(orchestratePairedRuns(altered).source.fixtureSha256, orchestratePairedRuns(fixture).source.fixtureSha256);
});
