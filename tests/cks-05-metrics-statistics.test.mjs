import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";
import Ajv2020 from "ajv/dist/2020.js";
import addFormats from "ajv-formats";
import { bootstrap, canonical, checkFixture, scoreFixture } from "../scripts/cks-05-score-run.mjs";

const root = resolve(import.meta.dirname, "..");
const fixture = JSON.parse(readFileSync(resolve(root, "tests/fixtures/cks-05/scoring-golden-v1.json"), "utf8"));
const schema = JSON.parse(readFileSync(resolve(root, "schemas/cks-05-benchmark-result-v1.schema.json"), "utf8"));
const validateResult = new Ajv2020({ allErrors: true, strict: true });
addFormats(validateResult);
const validResult = validateResult.compile(schema);

const metricIds = [
  "task_success", "atomic_fact_f1", "evidence_coverage", "evidence_precision", "evidence_attribution_f1",
  "applicability_accuracy", "unsupported_material_claim_rate", "conflict_detection_f1", "abstention_accuracy",
  "update_compliance", "guidance_adherence", "multi_hop_path_accuracy", "critical_violation_rate", "model_failure_rate",
  "retrieval_latency_ms", "model_latency_ms", "time_to_first_token_ms", "time_to_final_ms", "prompt_tokens",
  "generated_tokens", "decode_tokens_per_second", "memory_bytes", "peak_resident_bytes", "throughput_tokens_per_second",
  "escalation_quality", "escalation_cost",
];

test("golden fixture scores deterministically and validates the closed result schema", () => {
  const first = scoreFixture(fixture);
  const second = scoreFixture(structuredClone(fixture));
  assert.deepEqual(first, second);
  assert.equal(validResult(first), true, JSON.stringify(validResult.errors, null, 2));
  assert.equal(first.status, "CLAIM_DENIED");
  assert.equal(first.claimGate.modelSubstitutionClaim, false);
  assert.equal(first.runCounts.scheduled, 12);
  assert.equal(first.runCounts.observed, 12);
  assert.equal(first.runCounts.completed, 10);
  assert.equal(first.runCounts.failed, 1);
  assert.equal(first.runCounts.invalidated, 1);
  assert.equal(first.runCounts.scored, 11);
  assert.deepEqual(first.failures.map((failure) => failure.failureCodeOrNull), ["TIMEOUT", "DOCKER_ENOENT"]);
  assert.deepEqual(Object.keys(first.metrics).sort(), [...metricIds].sort());
  for (const metricId of metricIds) {
    const stat = first.metrics[metricId];
    assert.equal(stat.confidenceInterval.level, 0.95, metricId);
    assert.equal(stat.confidenceInterval.method, "DETERMINISTIC_STRATIFIED_PAIRED_PERCENTILE_BOOTSTRAP", metricId);
    assert.equal(stat.confidenceInterval.bootstrapResamples, 20000, metricId);
  }
});

test("quality, evidence, applicability, conflicts, abstention, updates, latency, resources and escalation are scored", () => {
  const result = scoreFixture(fixture);
  assert.equal(result.metrics.task_success.pointEstimate, 10 / 11);
  assert.equal(result.metrics.atomic_fact_f1.pointEstimate, 10 / 11);
  assert.equal(result.metrics.evidence_coverage.pointEstimate, 10 / 11);
  assert.equal(result.metrics.evidence_precision.pointEstimate, 10 / 11);
  assert.equal(result.metrics.applicability_accuracy.pointEstimate, 10 / 11);
  assert.equal(result.metrics.unsupported_material_claim_rate.pointEstimate, 0);
  assert.equal(result.metrics.conflict_detection_f1.pointEstimate, 10 / 11);
  assert.equal(result.metrics.abstention_accuracy.pointEstimate, 10 / 11);
  assert.equal(result.metrics.update_compliance.pointEstimate, 10 / 11);
  assert.equal(result.metrics.retrieval_latency_ms.pointEstimate, 3);
  assert.equal(result.metrics.model_latency_ms.pointEstimate, 81);
  assert.equal(result.metrics.prompt_tokens.pointEstimate, 100.2);
  assert.equal(result.metrics.generated_tokens.pointEstimate, 20);
  assert.ok(result.metrics.peak_resident_bytes.pointEstimate > 0);
  assert.equal(result.metrics.escalation_cost.pointEstimate, 0);
  assert.equal(result.metrics.model_failure_rate.pointEstimate, 1 / 11);
  assert.ok(result.comparisons.every((comparison) => comparison.confidenceInterval));
});

test("failed and invalidated runs are preserved, and missing schedule evidence denies claims", () => {
  const partial = structuredClone(fixture);
  partial.runRecords.pop();
  const result = scoreFixture(partial);
  assert.equal(result.status, "PARTIAL_NO_CLAIM");
  assert.equal(result.runCounts.missing, 1);
  assert.equal(result.claimGate.modelSubstitutionClaim, false);
  assert.ok(result.claimGate.reasonCodes.includes("INCOMPLETE_SCHEDULE"));
  assert.equal(result.receipt.requiredEvidencePresent, false);
  assert.equal(result.failures.length, 2);
});

test("unsupported material claims fail closed before any result is emitted", () => {
  const invalid = structuredClone(fixture);
  invalid.runRecords[0].response.answerClaims.push({ factId: "UNSUPPORTED", material: true, evidenceIds: [], applicable: true });
  assert.throws(() => scoreFixture(invalid), /RESPONSE_DIGEST/);
  invalid.runRecords[0].responseSha256 = "not-a-digest";
  assert.match(checkFixture(invalid).join("\n"), /RESPONSE_DIGEST/);
});

test("bootstrap is deterministic and returns unavailable rather than inventing a CI", () => {
  assert.deepEqual(bootstrap([], "seed"), { available: false, lower: null, upper: null, resamplingUnitCount: 0 });
  assert.deepEqual(bootstrap([1, 2, 3], "seed"), bootstrap([1, 2, 3], "seed"));
  assert.notDeepEqual(bootstrap([1, 2, 3], "seed"), bootstrap([1, 2, 4], "seed"));
  assert.equal(canonical({ b: 2, a: 1 }), '{"a":1,"b":2}');
});

test("result schema rejects unknown fields and cannot authorize a substitution claim without all gates", () => {
  const result = scoreFixture(fixture);
  const unknown = structuredClone(result);
  unknown.unexpected = true;
  assert.equal(validResult(unknown), false);
  const forged = structuredClone(result);
  forged.claimGate.modelSubstitutionClaim = true;
  forged.claimGate.allQualityAndEfficiencyThresholdsPass = false;
  assert.equal(validResult(forged), false);
});
