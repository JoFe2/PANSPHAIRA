#!/usr/bin/env node
// CKS-05 benchmark executor: paired five-arm orchestration with L4 handoff.
//
// The executor owns schedule binding, pair identity, append-only result/failure
// preservation, and decision audit. L4 remains the only scorer. This file does
// not acquire models, start services, or silently retry a run; --dry-run
// replays the explicitly supplied run outcomes and invokes the deterministic
// L4 scorer over the resulting records.
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { dirname, resolve, sep } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { scoreFixture } from "./cks-05-score-run.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, "..");
const EXPECTED_ARM_IDS = ["ARM-LRF-01", "ARM-SRF-02", "ARM-LSF-03", "ARM-SSF-04", "ARM-SSG-05"];
const EDITION_IDS = ["K0_STATIC", "K1_UPDATED"];
const TERMINAL_STATUSES = ["COMPLETED", "FAILED", "INVALIDATED"];
const MODEL_FAILURE_CODES = [
  "TIMEOUT", "OOM_WITHIN_ADMITTED_ENVELOPE", "NONZERO_RUNTIME_EXIT", "MALFORMED_STREAM",
  "OUTPUT_LIMIT_WITHOUT_VALID_FINAL", "INVALID_JSON", "REFUSAL_NO_VALID_ANSWER", "RUNTIME_ERROR",
];
const INFRA_INVALIDATION_CODES = [
  "HOST_DRIFT", "CLOCK_INVALID", "RESOURCE_SAMPLER_GAP", "THERMAL_INVALID",
  "UNRELATED_PROCESS_INTERFERENCE", "HARNESS_SIGTRAP_EXIT_133", "DOCKER_ENOENT",
];
const REQUIRED_REPORTS = [
  "AB-MODEL-RAW", "AB-MODEL-STRUCTURED", "AB-STRUCTURED-VS-RAW-LARGE",
  "AB-STRUCTURED-VS-RAW-SMALL", "AB-FACTS-VS-GUIDANCE-SMALL", "AB-STATIC-VS-UPDATED",
  "AB-SINGLE-VS-MULTI-HOP",
];
const IDENTITY_FIELDS = [
  "taskId", "scenarioPairId", "domainId", "hopClass", "updateSensitivity", "editionId",
  "generationSeed", "taskPromptCoreSha256", "goldRecordSha256", "evidenceGraphSha256",
  "canonicalFactInventorySha256",
];

export const sha256 = (value) => createHash("sha256").update(value).digest("hex");
export const canonical = (value) => {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonical(value[key])}`).join(",")}}`;
  }
  return JSON.stringify(value);
};
export const digest = (value) => sha256(typeof value === "string" || Buffer.isBuffer(value) ? value : canonical(value));

export function deriveRunId(protocolDigestSha256, armId, taskId, editionId, generationSeed) {
  return `run:${sha256(`${protocolDigestSha256}|${armId}|${taskId}|${editionId}|${generationSeed}`)}`;
}
export function derivePairKey(protocolDigestSha256, taskId, editionId, generationSeed) {
  return `pair:${sha256(`${protocolDigestSha256}|${taskId}|${editionId}|${generationSeed}`)}`;
}

const equal = (a, b) => canonical(a) === canonical(b);
const outcomeKey = (armId, taskId, editionId, generationSeed) => `${armId}|${taskId}|${editionId}|${generationSeed}`;
const scheduleKey = (taskId, editionId, generationSeed) => `${taskId}|${editionId}|${generationSeed}`;

function validateBasicFixture(fixture) {
  const errors = [];
  const fail = (code, detail) => errors.push(`${code}: ${detail}`);
  if (!fixture || typeof fixture !== "object" || Array.isArray(fixture)) return ["FIXTURE_NOT_OBJECT"];
  if (fixture.schemaVersion !== "chimpmaera.cks05/executor-fixture/v1") fail("SCHEMA_VERSION", "unsupported executor fixture");
  if (!fixture.protocol || fixture.protocol.protocolId !== "PSAI285-BENCHMARK-PROTOCOL-01") fail("PROTOCOL_BINDING", "fixture is not bound to PSAI285 protocol");
  if (!/^[a-f0-9]{64}$/.test(fixture.protocol?.protocolDigestSha256 ?? "")) fail("PROTOCOL_DIGEST", "protocol digest must be lowercase SHA-256");
  if (fixture.freshDomain?.freshnessStatus !== "FRESH_SYNTHETIC_HIDDEN") fail("FRESHNESS", "runs must bind a fresh synthetic hidden domain partition");
  if (fixture.freshDomain?.sameTaskPartitionAcrossArms !== true) fail("PAIRING_CONTRACT", "all arms must use the same task partition");
  if (fixture.freshDomain?.sameKnowledgeEditionsAcrossArms !== true) fail("KNOWLEDGE_CONTRACT", "all arms must use the same Knowledge editions");
  for (const editionId of EDITION_IDS) {
    const edition = fixture.freshDomain?.knowledgeEditions?.find((candidate) => candidate.editionId === editionId);
    if (!edition || !/^[a-f0-9]{64}$/.test(edition.editionSha256 ?? "") || !/^[a-f0-9]{64}$/.test(edition.canonicalFactInventorySha256 ?? "")) {
      fail("KNOWLEDGE_DIGEST", `${editionId}: immutable Knowledge edition and fact inventory digests are required`);
    }
  }
  if (!Array.isArray(fixture.arms) || !equal(fixture.arms.map((arm) => arm.armId).sort(), [...EXPECTED_ARM_IDS].sort())) {
    fail("ARM_SET", "exactly the approved five arms are required");
  }
  for (const arm of fixture.arms ?? []) {
    if (!Array.isArray(arm.editions) || !equal(arm.editions, EDITION_IDS)) fail("ARM_EDITIONS", `${arm.armId}: both frozen Knowledge editions are required`);
  }
  if (!Array.isArray(fixture.generation?.seeds) || fixture.generation.seeds.length < 1) fail("SEEDS", "at least one pinned generation seed is required");
  if (!Array.isArray(fixture.tasks) || fixture.tasks.length < 2) fail("TASKS", "at least two fresh tasks are required for A/B cells");
  const taskIds = new Set();
  const pairIds = new Set();
  let sawSingle = false;
  let sawMulti = false;
  for (const task of fixture.tasks ?? []) {
    if (!task || typeof task !== "object") { fail("TASK_RECORD", "task is not an object"); continue; }
    for (const field of ["taskId", "scenarioPairId", "domainId", "hopClass", "updateSensitivity", "taskPromptCoreSha256", "editions"]) {
      if (!(field in task)) fail("TASK_FIELD", `${task.taskId ?? "unknown"}.${field} is required`);
    }
    if (taskIds.has(task.taskId)) fail("DUPLICATE_TASK", task.taskId); else taskIds.add(task.taskId);
    pairIds.add(task.scenarioPairId);
    sawSingle ||= task.hopClass === "SINGLE_HOP";
    sawMulti ||= task.hopClass === "MULTI_HOP";
    if (!task.domainId || !task.domainId.startsWith("SYN-")) fail("DOMAIN", `${task.taskId}: domain must be synthetic`);
    if (!task.editions || !equal(Object.keys(task.editions).sort(), [...EDITION_IDS].sort())) fail("TASK_EDITIONS", `${task.taskId}: K0_STATIC and K1_UPDATED are required`);
    for (const editionId of EDITION_IDS) {
      const edition = task.editions?.[editionId];
      if (!edition || !/^[a-f0-9]{64}$/.test(edition.goldRecordSha256 ?? "") || !/^[a-f0-9]{64}$/.test(edition.evidenceGraphSha256 ?? "")) {
        fail("TASK_DIGEST", `${task.taskId}/${editionId}: gold and evidence digests must be sealed SHA-256 values`);
      }
      if (!edition?.gold) fail("GOLD_EVIDENCE", `${task.taskId}/${editionId}: explicit gold record is required for L4`);
    }
  }
  if (!sawSingle || !sawMulti) fail("HOP_CELLS", "both SINGLE_HOP and MULTI_HOP tasks are required");
  if (pairIds.size < 1) fail("SCENARIO_PAIRS", "at least one scenario pair is required");
  const expected = EXPECTED_ARM_IDS.length * (fixture.tasks?.length ?? 0) * EDITION_IDS.length * (fixture.generation?.seeds?.length ?? 0);
  if (fixture.schedule?.expectedRunCount !== expected) fail("RUN_COUNT", `expectedRunCount must equal 5 x tasks x 2 editions x seeds (${expected})`);
  if (!Array.isArray(fixture.outcomes)) fail("OUTCOMES", "outcomes must be an append-only array");
  const seen = new Set();
  const armIds = new Set((fixture.arms ?? []).map((arm) => arm.armId));
  const taskIdSet = new Set((fixture.tasks ?? []).map((task) => task.taskId));
  const seedSet = new Set(fixture.generation?.seeds ?? []);
  for (const outcome of fixture.outcomes ?? []) {
    const key = outcomeKey(outcome.armId, outcome.taskId, outcome.editionId, outcome.generationSeed);
    if (seen.has(key)) fail("DUPLICATE_OUTCOME", key); else seen.add(key);
    if (!armIds.has(outcome.armId) || !taskIdSet.has(outcome.taskId) || !EDITION_IDS.includes(outcome.editionId) || !seedSet.has(outcome.generationSeed)) fail("OUTCOME_NOT_SCHEDULED", key);
    if (!TERMINAL_STATUSES.includes(outcome.terminalStatus)) fail("OUTCOME_STATUS", `${key}: terminal status is not allowed`);
    const failureNull = outcome.failureCodeOrNull === null;
    if ((outcome.terminalStatus === "COMPLETED") !== failureNull) fail("OUTCOME_FAILURE_RULE", `${key}: failure code is null exactly when COMPLETED`);
    if (outcome.failureCodeOrNull !== null && ![...MODEL_FAILURE_CODES, ...INFRA_INVALIDATION_CODES].includes(outcome.failureCodeOrNull)) fail("OUTCOME_FAILURE_CODE", `${key}: unknown failure code`);
  }
  if (!fixture.response) fail("RESPONSE_TEMPLATE", "completed runs need an explicit response template");
  return errors;
}

export function materializePairedSchedule(fixture) {
  const records = [];
  const protocol = fixture.protocol.protocolDigestSha256;
  const outcomes = new Map((fixture.outcomes ?? []).map((outcome) => [outcomeKey(outcome.armId, outcome.taskId, outcome.editionId, outcome.generationSeed), outcome]));
  for (const task of fixture.tasks) {
    for (const editionId of EDITION_IDS) {
      const edition = task.editions[editionId];
      for (const generationSeed of fixture.generation.seeds) {
        for (const arm of fixture.arms) {
          const key = outcomeKey(arm.armId, task.taskId, editionId, generationSeed);
          const outcome = outcomes.get(key) ?? { terminalStatus: "COMPLETED", failureCodeOrNull: null };
          const base = {
            runId: deriveRunId(protocol, arm.armId, task.taskId, editionId, generationSeed),
            pairKey: derivePairKey(protocol, task.taskId, editionId, generationSeed),
            armId: arm.armId,
            modelProfileId: arm.modelProfileId,
            taskId: task.taskId,
            scenarioPairId: task.scenarioPairId,
            domainId: task.domainId,
            hopClass: task.hopClass,
            updateSensitivity: task.updateSensitivity,
            editionId,
            editionSha256: fixture.freshDomain.knowledgeEditions.find((editionRecord) => editionRecord.editionId === editionId)?.editionSha256 ?? null,
            taskPromptCoreSha256: task.taskPromptCoreSha256,
            goldRecordSha256: edition.goldRecordSha256,
            evidenceGraphSha256: edition.evidenceGraphSha256,
            canonicalFactInventorySha256: fixture.freshDomain.knowledgeEditions.find((editionRecord) => editionRecord.editionId === editionId)?.canonicalFactInventorySha256 ?? null,
            generationSeed,
            terminalStatus: outcome.terminalStatus,
            failureCodeOrNull: outcome.failureCodeOrNull,
          };
          if (outcome.terminalStatus === "COMPLETED") {
            const response = structuredClone(outcome.response ?? fixture.response);
            const gold = structuredClone(outcome.gold ?? edition.gold);
            base.response = response;
            base.gold = gold;
            base.responseSha256 = digest(response);
          }
          records.push(base);
        }
      }
    }
  }
  return records;
}

function validatePairedSchedule(records, fixture) {
  const errors = [];
  const fail = (code, detail) => errors.push(`${code}: ${detail}`);
  if (records.length !== fixture.schedule.expectedRunCount) fail("SCHEDULE_COUNT", `${records.length} records materialized, expected ${fixture.schedule.expectedRunCount}`);
  const seen = new Set();
  const byPair = new Map();
  for (const record of records) {
    if (seen.has(record.runId)) fail("DUPLICATE_RUN_ID", record.runId); else seen.add(record.runId);
    if (!record.pairKey) fail("PAIR_KEY_MISSING", record.runId);
    const group = byPair.get(record.pairKey) ?? [];
    group.push(record);
    byPair.set(record.pairKey, group);
  }
  for (const [pairKey, group] of byPair) {
    if (group.length !== EXPECTED_ARM_IDS.length) fail("PAIR_ARM_COUNT", `${pairKey}: expected five arm records`);
    if (!equal(group.map((record) => record.armId).sort(), [...EXPECTED_ARM_IDS].sort())) fail("PAIR_ARM_SET", `${pairKey}: pair does not contain exactly the five approved arms`);
    const head = group[0];
    for (const record of group) {
      for (const field of IDENTITY_FIELDS) if (!equal(record[field], head[field])) fail("PAIR_IDENTITY_DRIFT", `${pairKey}: ${field} differs across arms`);
    }
  }
  return errors;
}

function decisionAudit(result, fixture) {
  const reasons = [...result.claimGate.reasonCodes];
  const ruleIds = [];
  const simplifications = [];
  const addReason = (reason) => { if (!reasons.includes(reason)) reasons.push(reason); };
  const addRule = (rule) => { if (!ruleIds.includes(rule)) ruleIds.push(rule); };
  const armFailureRates = Object.values(result.runCounts.byArm).map((counts) => counts.scheduled ? counts.failed / counts.scheduled : 0);
  if (result.runCounts.missing > 0) addRule("STOP-07-NO-EARLY-SUCCESS");
  if (result.runCounts.invalidated > 0) { addRule("STOP-06-RESOURCE-OR-TIME"); addReason("INFRASTRUCTURE_INVALIDATION_PRESENT"); }
  if (result.runCounts.failed > 0 && armFailureRates.some((rate) => rate > 0.125)) { addRule("STOP-05-FAILURE-RATE"); addReason("FAILURE_RATE_STOP"); }
  if (result.runScores.some((record) => record.metrics?.critical_violation_rate > 0)) { addRule("STOP-04-CRITICAL-VIOLATION"); addReason("CRITICAL_VIOLATION"); }
  if (result.claimGate.status !== "PASS" || !result.claimGate.allQualityAndEfficiencyThresholdsPass) {
    addRule("FALSIFY-SUBSTITUTION");
    addReason("QUALITY_OR_EFFICIENCY_THRESHOLD_NOT_PASSED");
  }
  const complete = result.runCounts.missing === 0 && result.runCounts.invalidated === 0 && result.runCounts.failed === 0;
  const decisionState = complete ? "THRESHOLDS_EVALUATED_BY_L6" : "BLOCKED_UNTIL_COMPLETE_VALID_EVIDENCE";
  for (const ruleId of fixture.decisionRules ?? ["SIMPLIFY-STRUCTURE", "SIMPLIFY-GUIDANCE", "SIMPLIFY-UPDATES", "SIMPLIFY-MULTI-HOP"]) {
    simplifications.push(`${ruleId}=${decisionState}`);
  }
  return {
    triggered: ruleIds.length > 0,
    ruleIds,
    reasonCodes: reasons,
    simplifications,
    // A denied substitution is a falsification of the substitution claim, not
    // evidence that an infrastructure failure is a product-quality verdict.
    falsifiedArchitecture: ruleIds.includes("FALSIFY-SUBSTITUTION") && result.runCounts.invalidated === 0,
  };
}

export function orchestratePairedRuns(fixture, options = {}) {
  const fixtureErrors = validateBasicFixture(fixture);
  if (fixtureErrors.length) throw new Error(`FAIL_CLOSED_EXECUTOR_REJECTED: ${fixtureErrors.join("; ")}`);
  const planned = materializePairedSchedule(fixture);
  const scheduleErrors = validatePairedSchedule(planned, fixture);
  if (scheduleErrors.length) throw new Error(`FAIL_CLOSED_PAIRING_REJECTED: ${scheduleErrors.join("; ")}`);
  const replayFixture = !options.runner;
  const runner = options.runner ?? ((plannedRun) => plannedRun);
  const observed = [];
  for (const plannedRun of planned) {
    let observedRun;
    try {
      observedRun = runner(structuredClone(plannedRun));
    } catch (error) {
      observedRun = { terminalStatus: "FAILED", failureCodeOrNull: "RUNTIME_ERROR", executorError: String(error?.message ?? error) };
    }
    if (!observedRun || typeof observedRun !== "object") observedRun = { terminalStatus: "FAILED", failureCodeOrNull: "RUNTIME_ERROR" };
    // Identity and outcome fields are immutable: a runner cannot replace a
    // scheduled record or move a result to another pair.
    const preserved = { ...plannedRun, ...observedRun };
    for (const field of ["runId", "pairKey", ...IDENTITY_FIELDS]) preserved[field] = plannedRun[field];
    if (preserved.terminalStatus === "COMPLETED" && !replayFixture && (!observedRun.response || !observedRun.gold)) {
      preserved.terminalStatus = "FAILED";
      preserved.failureCodeOrNull = "RUNTIME_ERROR";
    }
    if (preserved.terminalStatus === "COMPLETED") {
      preserved.response = observedRun.response ?? plannedRun.response;
      preserved.gold = observedRun.gold ?? plannedRun.gold;
      preserved.responseSha256 = digest(preserved.response);
      preserved.failureCodeOrNull = null;
    } else {
      preserved.response = undefined;
      preserved.gold = undefined;
      preserved.responseSha256 = undefined;
      preserved.failureCodeOrNull = preserved.failureCodeOrNull ?? "RUNTIME_ERROR";
    }
    observed.push(preserved);
  }
  const observedErrors = validatePairedSchedule(observed, fixture);
  if (observedErrors.length) throw new Error(`FAIL_CLOSED_OBSERVATION_REJECTED: ${observedErrors.join("; ")}`);
  const scoringFixture = {
    schemaVersion: "chimpmaera.cks05/scoring-fixture/v1",
    fixtureId: fixture.fixtureId,
    protocol: fixture.protocol,
    schedule: { expectedRunCount: fixture.schedule.expectedRunCount },
    runRecords: observed,
  };
  const result = scoreFixture(scoringFixture);
  const requiredReportSet = new Set(result.comparisons.map((comparison) => comparison.reportId));
  const missingReports = REQUIRED_REPORTS.filter((reportId) => !requiredReportSet.has(reportId));
  if (missingReports.length) throw new Error(`FAIL_CLOSED_REPORT_REJECTED: missing mandatory reports ${missingReports.join(",")}`);
  result.stopConditions = decisionAudit(result, fixture);
  result.claimGate.reasonCodes = result.stopConditions.reasonCodes;
  result.claimGate.modelSubstitutionClaim = false;
  result.claimGate.allQualityAndEfficiencyThresholdsPass = false;
  result.claimGate.status = "DENY";
  result.claimGate.passingWording = null;
  result.receipt.requiredEvidencePresent = result.runCounts.missing === 0 && result.failures.length === 0 && result.comparisons.every((comparison) => comparison.status === "MEASURED");
  return result;
}

function fail(exitCode, code, detail) {
  process.stderr.write(`${code}${detail ? `: ${detail}` : ""}\n`);
  process.exit(exitCode);
}

function main() {
  const argv = process.argv.slice(2);
  const fixtureFlag = argv.indexOf("--fixture");
  const fixturePath = fixtureFlag >= 0 ? argv[fixtureFlag + 1] : null;
  if (argv.includes("--help") || argv.includes("-h")) {
    process.stdout.write("usage: run-cks-05-benchmark.mjs --fixture <path> --dry-run\n");
    return;
  }
  if (!fixturePath) fail(2, "MISSING_FIXTURE", "--fixture requires a repository-relative path");
  if (!argv.includes("--dry-run")) fail(3, "EXECUTION_NOT_AUTHORIZED", "only --dry-run fixture orchestration is authorized");
  const file = resolve(process.cwd(), fixturePath);
  if (!file.startsWith(`${ROOT}${sep}`)) fail(2, "UNSAFE_FIXTURE_PATH", fixturePath);
  let fixture;
  try { fixture = JSON.parse(readFileSync(file, "utf8")); } catch (error) { fail(2, "FIXTURE_READ_FAILED", error.message); }
  try {
    process.stdout.write(`${JSON.stringify(orchestratePairedRuns(fixture), null, 2)}\n`);
  } catch (error) {
    fail(1, "BENCHMARK_REJECTED", error.message);
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main();

export { validateBasicFixture, validatePairedSchedule, decisionAudit };
