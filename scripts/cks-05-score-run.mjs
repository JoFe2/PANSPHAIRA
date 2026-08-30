#!/usr/bin/env node
// CKS-05 L4: deterministic, fail-closed scoring and statistics.
//
// This scorer never infers a substitution claim from a partial fixture. It
// preserves every input run and failure, scores completed runs from explicit
// gold/response records, aggregates repeated seeds within taskId, and uses a
// deterministic percentile bootstrap for confidence intervals.
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import Ajv2020 from "ajv/dist/2020.js";
import addFormats from "ajv-formats";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, "..");
const RESULT_SCHEMA_PATH = resolve(ROOT, "schemas/cks-05-benchmark-result-v1.schema.json");
const TERMINAL_STATUSES = ["COMPLETED", "FAILED", "INVALIDATED"];
const MODEL_FAILURE_CODES = [
  "TIMEOUT", "OOM_WITHIN_ADMITTED_ENVELOPE", "NONZERO_RUNTIME_EXIT", "MALFORMED_STREAM",
  "OUTPUT_LIMIT_WITHOUT_VALID_FINAL", "INVALID_JSON", "REFUSAL_NO_VALID_ANSWER", "RUNTIME_ERROR",
];
const INFRA_INVALIDATION_CODES = [
  "HOST_DRIFT", "CLOCK_INVALID", "RESOURCE_SAMPLER_GAP", "THERMAL_INVALID",
  "UNRELATED_PROCESS_INTERFERENCE", "HARNESS_SIGTRAP_EXIT_133", "DOCKER_ENOENT",
];
const REQUIRED_ARMS = ["ARM-LRF-01", "ARM-SRF-02", "ARM-LSF-03", "ARM-SSF-04", "ARM-SSG-05"];
const REQUIRED_REPORTS = [
  "AB-MODEL-RAW", "AB-MODEL-STRUCTURED", "AB-STRUCTURED-VS-RAW-LARGE",
  "AB-STRUCTURED-VS-RAW-SMALL", "AB-FACTS-VS-GUIDANCE-SMALL", "AB-STATIC-VS-UPDATED",
  "AB-SINGLE-VS-MULTI-HOP",
];
const METRIC_IDS = [
  "task_success", "atomic_fact_f1", "evidence_coverage", "evidence_precision", "evidence_attribution_f1",
  "applicability_accuracy", "unsupported_material_claim_rate", "conflict_detection_f1", "abstention_accuracy",
  "update_compliance", "guidance_adherence", "multi_hop_path_accuracy", "critical_violation_rate", "model_failure_rate",
  "retrieval_latency_ms", "model_latency_ms", "time_to_first_token_ms", "time_to_final_ms", "prompt_tokens",
  "generated_tokens", "decode_tokens_per_second", "memory_bytes", "peak_resident_bytes", "throughput_tokens_per_second",
  "escalation_quality", "escalation_cost",
];
const sha256 = (value) => createHash("sha256").update(value).digest("hex");
export const canonical = (value) => {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonical(value[key])}`).join(",")}}`;
  }
  return JSON.stringify(value);
};
export const digest = (value) => sha256(typeof value === "string" || Buffer.isBuffer(value) ? value : canonical(value));
const sortedUnique = (values) => [...new Set(values)].sort();
const intersectionCount = (a, b) => new Set(a.filter((value) => b.includes(value))).size;
const f1 = (tp, fp, fn) => (tp === 0 && fp === 0 && fn === 0 ? 1 : (2 * tp) / (2 * tp + fp + fn));
const ratio = (a, b) => (b > 0 ? a / b : null);
const mean = (values) => values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null;
const median = (values) => {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
};
const percentile = (values, p) => {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const index = (sorted.length - 1) * p;
  const lower = Math.floor(index);
  const upper = Math.ceil(index);
  return sorted[lower] + (sorted[upper] - sorted[lower]) * (index - lower);
};
const integerSeed = (text) => Number.parseInt(sha256(text).slice(0, 8), 16) >>> 0;

function checkFixture(fixture) {
  const errors = [];
  const fail = (code, detail) => errors.push(`${code}: ${detail}`);
  if (!fixture || typeof fixture !== "object" || Array.isArray(fixture)) return ["FIXTURE_NOT_OBJECT"];
  if (fixture.schemaVersion !== "chimpmaera.cks05/scoring-fixture/v1") fail("SCHEMA_VERSION", "unsupported scoring fixture");
  if (!fixture.protocol || fixture.protocol.protocolId !== "PSAI285-BENCHMARK-PROTOCOL-01") fail("PROTOCOL_BINDING", "fixture is not bound to PSAI285 protocol");
  if (!/^[a-f0-9]{64}$/.test(fixture.protocol?.protocolDigestSha256 ?? "")) fail("PROTOCOL_DIGEST", "protocol digest must be lowercase SHA-256");
  if (!Number.isSafeInteger(fixture.schedule?.expectedRunCount) || fixture.schedule.expectedRunCount < 1) fail("EXPECTED_RUN_COUNT", "positive expectedRunCount is required");
  if (!Array.isArray(fixture.runRecords)) fail("RUN_RECORDS", "runRecords must be an array");
  const seen = new Set();
  for (const [index, run] of (fixture.runRecords ?? []).entries()) {
    const label = `runRecords[${index}]`;
    if (!run || typeof run !== "object" || Array.isArray(run)) { fail("RUN_RECORD", `${label} is not an object`); continue; }
    for (const field of ["runId", "armId", "taskId", "scenarioPairId", "editionId", "hopClass", "updateSensitivity", "terminalStatus", "failureCodeOrNull"]) {
      if (!(field in run)) fail("RUN_FIELD", `${label}.${field} is required`);
    }
    if (seen.has(run.runId)) fail("DUPLICATE_RUN_ID", run.runId); else seen.add(run.runId);
    if (!TERMINAL_STATUSES.includes(run.terminalStatus)) fail("TERMINAL_STATUS", `${run.runId} is not terminal status`);
    const failureNull = run.failureCodeOrNull === null;
    if ((run.terminalStatus === "COMPLETED") !== failureNull) fail("FAILURE_CODE_RULE", `${run.runId}: failure code is null exactly when completed`);
    if (run.failureCodeOrNull !== null && ![...MODEL_FAILURE_CODES, ...INFRA_INVALIDATION_CODES].includes(run.failureCodeOrNull)) fail("FAILURE_CODE", `${run.runId}: unknown failure code`);
    if (run.terminalStatus === "COMPLETED") {
      const response = run.response;
      const gold = run.gold;
      if (!response || !gold) { fail("MISSING_EVIDENCE", `${run.runId}: completed run needs response and gold`); continue; }
      for (const field of ["answerClaims", "evidenceIds", "finalAnswer", "abstained", "metrics", "escalation"]) if (!(field in response)) fail("RESPONSE_FIELD", `${run.runId}: response.${field} is required`);
      for (const field of ["atomicFactIds", "evidenceIds", "applicabilityByFact", "expectedAbstain", "conflictIds", "staleFactIds", "updateRequiredFactIds", "guidanceConstraintIds", "escalationRequired"]) if (!(field in gold)) fail("GOLD_FIELD", `${run.runId}: gold.${field} is required`);
      if (!Array.isArray(response.answerClaims) || !Array.isArray(response.evidenceIds)) fail("RESPONSE_ARRAY", `${run.runId}: claims/evidence must be arrays`);
      if (!Array.isArray(gold.atomicFactIds) || !Array.isArray(gold.evidenceIds)) fail("GOLD_ARRAY", `${run.runId}: fact/evidence gold must be arrays`);
      const coverage = Number(response.metrics?.resourceSampleCoverage);
      if (!Number.isFinite(coverage) || coverage < 0.99) fail("RESOURCE_COVERAGE", `${run.runId}: coverage must be at least 0.99`);
      for (const field of ["retrievalLatencyMs", "modelLatencyMs", "timeToFirstTokenMs", "timeToFinalMs", "promptTokens", "generatedTokens", "decodeTokensPerSecond", "memoryBytes", "peakResidentBytes", "throughputTokensPerSecond"]) {
        if (!Number.isFinite(response.metrics?.[field]) || response.metrics[field] < 0) fail("METRIC_VALUE", `${run.runId}: metrics.${field} must be non-negative`);
      }
      if (digest(response) !== run.responseSha256) fail("RESPONSE_DIGEST", `${run.runId}: responseSha256 mismatch`);
    }
  }
  return errors;
}

function scoreRun(run) {
  if (run.terminalStatus !== "COMPLETED") {
    const metrics = run.terminalStatus === "FAILED"
      ? Object.fromEntries([
        "task_success", "atomic_fact_f1", "evidence_coverage", "evidence_precision", "evidence_attribution_f1",
        "applicability_accuracy", "unsupported_material_claim_rate", "conflict_detection_f1", "abstention_accuracy",
        "update_compliance", "guidance_adherence", "multi_hop_path_accuracy", "critical_violation_rate",
      ].map((metricId) => [metricId, 0]).concat([["model_failure_rate", 1]]))
      : null;
    return { runId: run.runId, armId: run.armId, taskId: run.taskId, scenarioPairId: run.scenarioPairId, editionId: run.editionId, hopClass: run.hopClass, updateSensitivity: run.updateSensitivity, terminalStatus: run.terminalStatus, failureCodeOrNull: run.failureCodeOrNull, scored: run.terminalStatus === "FAILED", metrics, counts: null };
  }
  const { response: r, gold: g } = run;
  const predictedFacts = sortedUnique(r.answerClaims.filter((claim) => claim.material !== false).map((claim) => claim.factId));
  const goldFacts = sortedUnique(g.atomicFactIds);
  const predictedEvidence = sortedUnique(r.evidenceIds);
  const goldEvidence = sortedUnique(g.evidenceIds);
  const tp = intersectionCount(predictedFacts, goldFacts);
  const fp = predictedFacts.filter((fact) => !goldFacts.includes(fact)).length;
  const fn = goldFacts.filter((fact) => !predictedFacts.includes(fact)).length;
  const eTp = intersectionCount(predictedEvidence, goldEvidence);
  const eFp = predictedEvidence.filter((id) => !goldEvidence.includes(id)).length;
  const eFn = goldEvidence.filter((id) => !predictedEvidence.includes(id)).length;
  const unsupported = r.answerClaims.filter((claim) => claim.material !== false && (!claim.evidenceIds?.length || !goldFacts.includes(claim.factId))).length;
  const applicableFacts = sortedUnique(Object.keys(g.applicabilityByFact));
  const applicabilityCorrect = applicableFacts.filter((fact) => {
    const claim = r.answerClaims.find((item) => item.factId === fact);
    return Boolean(claim) && Boolean(claim.applicable) === Boolean(g.applicabilityByFact[fact]);
  }).length;
  const predictedConflicts = sortedUnique(r.conflictIds ?? []);
  const goldConflicts = sortedUnique(g.conflictIds ?? []);
  const conflictTp = intersectionCount(predictedConflicts, goldConflicts);
  const unsupportedDenominator = predictedFacts.length;
  const expectedAbstain = Boolean(g.expectedAbstain);
  const abstentionAccuracy = Number(Boolean(r.abstained) === expectedAbstain);
  const stale = sortedUnique(g.staleFactIds ?? []);
  const staleCorrect = stale.length === 0 ? 1 : Number(stale.every((fact) => !predictedFacts.includes(fact)));
  const updateSensitive = run.updateSensitivity === "UPDATE_SENSITIVE" && run.editionId === "K1_UPDATED";
  const updateCompliance = updateSensitive ? staleCorrect : 1;
  const guidanceTotal = g.guidanceConstraintIds?.length ?? 0;
  const guidancePassed = (r.guidanceConstraintsPassed ?? []).filter((id) => g.guidanceConstraintIds.includes(id)).length;
  const escalationRequired = Boolean(g.escalationRequired);
  const escalation = r.escalation ?? { escalated: false, quality: 0, cost: 0 };
  const taskSuccess = Number(
    (r.abstained === expectedAbstain) &&
    tp === goldFacts.length && fp === 0 &&
    unsupported === 0 &&
    eFn === 0 &&
    applicableFacts.every((fact) => r.answerClaims.some((claim) => claim.factId === fact)) &&
    (!escalationRequired || escalation.escalated === true),
  );
  const criticalViolations = sortedUnique(r.criticalViolationCodes ?? []);
  const m = r.metrics;
  return {
    runId: run.runId, armId: run.armId, taskId: run.taskId, scenarioPairId: run.scenarioPairId, editionId: run.editionId, hopClass: run.hopClass, updateSensitivity: run.updateSensitivity, terminalStatus: run.terminalStatus, failureCodeOrNull: null, scored: true,
    metrics: {
      task_success: taskSuccess, atomic_fact_f1: f1(tp, fp, fn), evidence_coverage: ratio(eTp, goldEvidence.length), evidence_precision: ratio(eTp, predictedEvidence.length), evidence_attribution_f1: f1(eTp, eFp, eFn),
      applicability_accuracy: ratio(applicabilityCorrect, applicableFacts.length), unsupported_material_claim_rate: ratio(unsupported, unsupportedDenominator), conflict_detection_f1: f1(conflictTp, predictedConflicts.filter((id) => !goldConflicts.includes(id)).length, goldConflicts.filter((id) => !predictedConflicts.includes(id)).length), abstention_accuracy: abstentionAccuracy, update_compliance: updateCompliance,
      guidance_adherence: guidanceTotal ? ratio(guidancePassed, guidanceTotal) : 1, multi_hop_path_accuracy: r.multiHopPathCorrect === null || r.multiHopPathCorrect === undefined ? (run.hopClass === "MULTI_HOP" ? taskSuccess : null) : Number(Boolean(r.multiHopPathCorrect)), critical_violation_rate: Number(criticalViolations.length > 0), model_failure_rate: 0,
      retrieval_latency_ms: m.retrievalLatencyMs, model_latency_ms: m.modelLatencyMs, time_to_first_token_ms: m.timeToFirstTokenMs, time_to_final_ms: m.timeToFinalMs, prompt_tokens: m.promptTokens, generated_tokens: m.generatedTokens, decode_tokens_per_second: m.decodeTokensPerSecond, memory_bytes: m.memoryBytes, peak_resident_bytes: m.peakResidentBytes, throughput_tokens_per_second: m.throughputTokensPerSecond,
      escalation_quality: escalationRequired ? Number(escalation.escalated) * Number(escalation.quality) : (escalation.escalated ? Number(escalation.quality) : 1), escalation_cost: Number(escalation.cost),
    },
    counts: { atomicFactTruePositiveCount: tp, atomicFactFalsePositiveCount: fp, atomicFactFalseNegativeCount: fn, evidenceTruePositiveCount: eTp, evidenceFalsePositiveCount: eFp, evidenceFalseNegativeCount: eFn, unsupportedMaterialClaimCount: unsupported, staleClaimCount: predictedFacts.filter((fact) => stale.includes(fact)).length, predictedClaimCount: predictedFacts.length, guidanceConstraintsPassed: guidancePassed, guidanceConstraintsTotal: guidanceTotal, conflictTruePositiveCount: conflictTp, conflictFalsePositiveCount: predictedConflicts.filter((id) => !goldConflicts.includes(id)).length, conflictFalseNegativeCount: goldConflicts.filter((id) => !predictedConflicts.includes(id)).length, criticalViolationCount: criticalViolations.length },
  };
}

function bootstrap(values, seedText, resamples = 20000) {
  const units = values.filter((value) => Number.isFinite(value));
  if (!units.length) return { available: false, lower: null, upper: null, resamplingUnitCount: 0 };
  if (units.length === 1) return { available: true, lower: units[0], upper: units[0], resamplingUnitCount: 1 };
  let state = integerSeed(seedText);
  const estimates = new Array(resamples);
  for (let b = 0; b < resamples; b += 1) {
    let total = 0;
    for (let i = 0; i < units.length; i += 1) {
      state = (Math.imul(1664525, state) + 1013904223) >>> 0;
      total += units[state % units.length];
    }
    estimates[b] = total / units.length;
  }
  return { available: true, lower: percentile(estimates, 0.025), upper: percentile(estimates, 0.975), resamplingUnitCount: units.length };
}
function unitMeans(scored, metricId, unitKey = "taskId") {
  const groups = new Map();
  for (const record of scored) {
    const value = record.metrics?.[metricId];
    if (!Number.isFinite(value)) continue;
    const key = record[unitKey];
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(value);
  }
  return [...groups.values()].map(mean).filter((value) => Number.isFinite(value));
}
function metricStat(scored, metricId, seed, unitKey = "taskId") {
  const values = scored.map((record) => record.metrics?.[metricId]).filter((value) => Number.isFinite(value));
  const units = unitMeans(scored, metricId, unitKey);
  const pointEstimate = mean(values);
  const ci = bootstrap(units, seed);
  return { metricId, pointEstimate, confidenceInterval: { level: 0.95, method: "DETERMINISTIC_STRATIFIED_PAIRED_PERCENTILE_BOOTSTRAP", lower: ci.lower, upper: ci.upper, available: ci.available, resamplingUnit: unitKey, resamplingUnitCount: ci.resamplingUnitCount, bootstrapResamples: 20000 }, denominator: values.length, missingValueCount: scored.length - values.length };
}
function aggregateCounts(scored, fixture) {
  const byArm = Object.fromEntries(REQUIRED_ARMS.map((armId) => [armId, { scheduled: 0, observed: 0, completed: 0, failed: 0, invalidated: 0, scored: 0 }]));
  for (const run of fixture.runRecords) {
    const row = byArm[run.armId] ??= { scheduled: 0, observed: 0, completed: 0, failed: 0, invalidated: 0, scored: 0 };
    row.scheduled += 1;
    row.observed += 1;
    if (run.terminalStatus === "COMPLETED") row.completed += 1;
    if (run.terminalStatus === "FAILED") row.failed += 1;
    if (run.terminalStatus === "INVALIDATED") row.invalidated += 1;
  }
  for (const record of scored) if (record.scored) byArm[record.armId].scored += 1;
  const observed = fixture.runRecords.length;
  const completed = fixture.runRecords.filter((run) => run.terminalStatus === "COMPLETED").length;
  const failed = fixture.runRecords.filter((run) => run.terminalStatus === "FAILED").length;
  const invalidated = fixture.runRecords.filter((run) => run.terminalStatus === "INVALIDATED").length;
  return { scheduled: fixture.schedule.expectedRunCount, observed, completed, failed, invalidated, scored: scored.filter((record) => record.scored).length, missing: Math.max(0, fixture.schedule.expectedRunCount - observed), byArm };
}

function contrast(scored, treatmentArmId, controlArmId, metricId, reportId, unitKey = "taskId", filter = () => true, controlFilter = null) {
  const t = new Map(), c = new Map();
  for (const record of scored) {
    const target = treatmentArmId === controlArmId
      ? (filter(record) ? t : controlFilter?.(record) ? c : null)
      : (record.armId === treatmentArmId && filter(record) ? t : record.armId === controlArmId && filter(record) ? c : null);
    if (!target || !Number.isFinite(record.metrics?.[metricId])) continue;
    if (!target.has(record[unitKey])) target.set(record[unitKey], []);
    target.get(record[unitKey]).push(record.metrics[metricId]);
  }
  const differences = [];
  for (const key of [...t.keys()].sort()) if (c.has(key)) differences.push(mean(t.get(key)) - mean(c.get(key)));
  const ci = bootstrap(differences, reportId);
  const tPoint = mean([...t.values()].map(mean));
  const cPoint = mean([...c.values()].map(mean));
  return { reportId, treatmentArmId, controlArmId, metricId, pointEstimate: tPoint === null || cPoint === null ? null : tPoint - cPoint, confidenceInterval: { level: 0.95, method: "DETERMINISTIC_STRATIFIED_PAIRED_PERCENTILE_BOOTSTRAP", lower: ci.lower, upper: ci.upper, available: ci.available, resamplingUnit: unitKey, resamplingUnitCount: ci.resamplingUnitCount, bootstrapResamples: 20000 }, pairedUnitCount: differences.length, status: differences.length ? "MEASURED" : "CI_UNAVAILABLE" };
}
function runGate(fixture, scored, counts, intervals, comparisons) {
  const reasons = [];
  if (counts.observed !== counts.scheduled) reasons.push("INCOMPLETE_SCHEDULE");
  if (counts.invalidated > 0) reasons.push("INVALIDATED_RUNS_PRESENT");
  if (counts.failed > 0) reasons.push("MODEL_FAILURES_PRESENT");
  if (new Set(fixture.runRecords.map((run) => run.armId)).size !== REQUIRED_ARMS.length) reasons.push("MISSING_ARM");
  if (REQUIRED_REPORTS.some((id) => !comparisons.some((item) => item.reportId === id && item.status === "MEASURED"))) reasons.push("REQUIRED_COMPARISON_MISSING");
  if (Object.values(intervals).some((stat) => !stat.confidenceInterval.available)) reasons.push("CI_UNAVAILABLE");
  if (scored.some((record) => record.metrics.critical_violation_rate > 0)) reasons.push("CRITICAL_VIOLATION");
  const candidate = intervals.task_success?.pointEstimate;
  if (candidate === null || candidate === undefined) reasons.push("QUALITY_EVIDENCE_MISSING");
  // The result must never turn a quality-only result into a substitution claim.
  const qualityPass = reasons.length === 0;
  const efficiencyPass = reasons.length === 0 && comparisons.some((item) => item.metricId === "time_to_final_ms" && item.pointEstimate !== null);
  return { status: qualityPass && efficiencyPass ? "PASS" : "DENY", modelSubstitutionClaim: false, qualityGate: qualityPass, efficiencyGate: efficiencyPass, allQualityAndEfficiencyThresholdsPass: false, reasonCodes: reasons.length ? reasons : ["THRESHOLD_EVALUATION_REQUIRES_PROTOCOL_960_AND_PINNED_GATES"] };
}

export function scoreFixture(fixture) {
  const fixtureErrors = checkFixture(fixture);
  if (fixtureErrors.length) throw new Error(`FAIL_CLOSED_FIXTURE_REJECTED: ${fixtureErrors.join("; ")}`);
  const scored = fixture.runRecords.map(scoreRun);
  const scoredRuns = scored.filter((record) => record.scored);
  const counts = aggregateCounts(scored, fixture);
  const metrics = Object.fromEntries(METRIC_IDS.map((metricId) => [metricId, metricStat(
    ["task_success", "atomic_fact_f1", "evidence_coverage", "evidence_precision", "evidence_attribution_f1", "applicability_accuracy", "unsupported_material_claim_rate", "conflict_detection_f1", "abstention_accuracy", "update_compliance", "guidance_adherence", "multi_hop_path_accuracy", "critical_violation_rate", "model_failure_rate"].includes(metricId) ? scoredRuns : scoredRuns.filter((record) => record.terminalStatus === "COMPLETED"),
    metricId,
    `${fixture.protocol.protocolDigestSha256}|${metricId}`,
  )]));
  const comparisons = [
    contrast(scoredRuns, "ARM-LRF-01", "ARM-SRF-02", "task_success", "AB-MODEL-RAW"),
    contrast(scoredRuns, "ARM-LSF-03", "ARM-SSF-04", "task_success", "AB-MODEL-STRUCTURED"),
    contrast(scoredRuns, "ARM-LSF-03", "ARM-LRF-01", "task_success", "AB-STRUCTURED-VS-RAW-LARGE", "taskId", (r) => r.editionId === "K1_UPDATED"),
    contrast(scoredRuns, "ARM-SSF-04", "ARM-SRF-02", "task_success", "AB-STRUCTURED-VS-RAW-SMALL", "taskId", (r) => r.editionId === "K1_UPDATED"),
    contrast(scoredRuns, "ARM-SSG-05", "ARM-SSF-04", "task_success", "AB-FACTS-VS-GUIDANCE-SMALL", "taskId", (r) => r.editionId === "K1_UPDATED"),
    contrast(scoredRuns, "ARM-SSG-05", "ARM-SSG-05", "task_success", "AB-STATIC-VS-UPDATED", "taskId", (r) => r.editionId === "K1_UPDATED", (r) => r.editionId === "K0_STATIC"),
    contrast(scoredRuns, "ARM-SSG-05", "ARM-SSG-05", "task_success", "AB-SINGLE-VS-MULTI-HOP", "scenarioPairId", (r) => r.editionId === "K1_UPDATED" && r.hopClass === "MULTI_HOP", (r) => r.editionId === "K1_UPDATED" && r.hopClass === "SINGLE_HOP"),
  ];
  const gate = runGate(fixture, scoredRuns, counts, metrics, comparisons);
  const failures = fixture.runRecords.filter((run) => run.terminalStatus !== "COMPLETED").map((run) => ({ runId: run.runId, armId: run.armId, taskId: run.taskId, terminalStatus: run.terminalStatus, failureCodeOrNull: run.failureCodeOrNull, preserved: true, productVerdict: run.terminalStatus === "FAILED" ? "MODEL_FAILURE_SCORED_ZERO" : "INFRASTRUCTURE_INVALIDATION_NOT_PRODUCT_VERDICT" }));
  const result = {
    schemaVersion: "chimpmaera.cks05/benchmark-result/v1", resultId: `result:${sha256(`${fixture.protocol.protocolDigestSha256}|${fixture.fixtureId}|${fixture.runRecords.length}`)}`,
    protocol: { protocolId: fixture.protocol.protocolId, protocolDigestSha256: fixture.protocol.protocolDigestSha256, operatingModelVersion: "Operating Model v1.1", preservedDecisionIds: ["D-001", "D-002", "D-003", "D-004", "D-005", "D-006", "D-007"], processVariantIntroduced: false },
    source: { fixtureId: fixture.fixtureId, fixtureSha256: digest(fixture), scorerArtifactSha256: sha256(readFileSync(resolve(HERE, "cks-05-score-run.mjs"))), resultSchemaSha256: sha256(readFileSync(RESULT_SCHEMA_PATH)) },
    status: counts.observed === counts.scheduled ? "CLAIM_DENIED" : "PARTIAL_NO_CLAIM", runCounts: counts, failures, runScores: scored,
    metrics, comparisons, stopConditions: { triggered: gate.reasonCodes.length > 0, ruleIds: counts.observed !== counts.scheduled ? ["STOP-07-NO-EARLY-SUCCESS"] : [], reasonCodes: gate.reasonCodes, simplifications: [], falsifiedArchitecture: gate.status === "DENY" },
    claimGate: { gateId: "L6-MODEL-SUBSTITUTION", status: gate.status, modelSubstitutionClaim: gate.modelSubstitutionClaim, qualityGate: gate.qualityGate, efficiencyGate: gate.efficiencyGate, allQualityAndEfficiencyThresholdsPass: gate.allQualityAndEfficiencyThresholdsPass, reasonCodes: gate.reasonCodes, scope: "Any conclusion is limited to the exact frozen fresh synthetic domains, tasks, Knowledge editions, arms, model bytes, runtime bytes, host manifest, and run records admitted by PSAI285-BENCHMARK-PROTOCOL-01.", passingWording: null },
    receipt: { preservation: "APPEND_ONLY_NO_REPLACEMENT_RUNS", confidenceLevel: 0.95, bootstrapResamples: 20000, seedsAreRepeatedObservations: true, noPseudoReplication: true, requiredEvidencePresent: counts.observed === counts.scheduled && failures.length === 0, generatedAt: "DETERMINISTIC_FROM_FIXTURE_NO_WALL_CLOCK" },
  };
  const schema = JSON.parse(readFileSync(RESULT_SCHEMA_PATH, "utf8"));
  const ajv = new Ajv2020({ allErrors: true, strict: true }); addFormats(ajv);
  const valid = ajv.validate(schema, result);
  if (!valid) throw new Error(`INTERNAL_RESULT_SCHEMA_REJECTED: ${JSON.stringify(ajv.errors)}`);
  return result;
}

function usage() { console.error("Usage: node scripts/cks-05-score-run.mjs --fixture <path> --dry-run"); }
if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  const fixtureFlag = process.argv.indexOf("--fixture");
  const fixturePath = fixtureFlag >= 0 ? process.argv[fixtureFlag + 1] : null;
  if (!fixturePath || !process.argv.includes("--dry-run")) { usage(); process.exitCode = 2; }
  else {
    try { const result = scoreFixture(JSON.parse(readFileSync(resolve(process.cwd(), fixturePath), "utf8"))); process.stdout.write(`${JSON.stringify(result, null, 2)}\n`); }
    catch (error) { console.error(error.message); process.exitCode = 1; }
  }
}

export { checkFixture, scoreRun, bootstrap, metricStat };
