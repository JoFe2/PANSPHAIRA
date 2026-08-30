import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  CKS_SYNTHETIC_QUALIFICATION_FAMILIES_V1,
  CKS_SYNTHETIC_QUALIFICATION_LANES_V1,
  generateCksSyntheticQualificationSuiteV1,
  cksSyntheticQualificationSuiteDigestV1,
  scoreCksSyntheticQualificationSuiteV1,
  validateCksSyntheticQualificationSplitV1,
} from "../packages/contracts/src/cks-synthetic-qualification.js";

const seeds = {
  DEVELOPMENT: "dev-seed-local-283-a",
  VISIBLE_VALIDATION: "visible-seed-local-283-b",
  HIDDEN_QUALIFICATION: randomBytes(32).toString("hex"),
  FRESH_EPHEMERAL_CERTIFICATION: randomBytes(32).toString("hex"),
} as const;

test("CKS-03 separates all four seed lanes without exposing raw seeds", () => {
  assert.deepEqual(CKS_SYNTHETIC_QUALIFICATION_LANES_V1, Object.keys(seeds));
  const suites = CKS_SYNTHETIC_QUALIFICATION_LANES_V1.map((lane) =>
    generateCksSyntheticQualificationSuiteV1({ lane, seed: seeds[lane], generatedAtMs: 1_000 }),
  );
  const replay = CKS_SYNTHETIC_QUALIFICATION_LANES_V1.map((lane) =>
    generateCksSyntheticQualificationSuiteV1({ lane, seed: seeds[lane], generatedAtMs: 1_000 }),
  );
  assert.deepEqual(replay, suites);
  assert.equal(new Set(suites.map((suite) => suite.seedDigest)).size, suites.length);
  assert.equal(new Set(suites.map((suite) => suite.suiteDigest)).size, suites.length);
  const serialized = JSON.stringify(suites);
  for (const seed of Object.values(seeds)) assert.equal(serialized.includes(seed), false);
  assert.deepEqual(validateCksSyntheticQualificationSplitV1(suites), { outcome: "VALID" });
});

test("CKS-03 generates every required family with deterministic expected evidence and epistemic outcomes", () => {
  const suite = generateCksSyntheticQualificationSuiteV1({
    lane: "DEVELOPMENT", seed: seeds.DEVELOPMENT, generatedAtMs: 1_000,
  });
  assert.deepEqual(suite.tasks.map((task) => task.family), CKS_SYNTHETIC_QUALIFICATION_FAMILIES_V1);
  assert.equal(new Set(suite.tasks.map((task) => task.taskId)).size, suite.tasks.length);
  assert.equal(new Set(suite.tasks.map((task) => task.taskDigest)).size, suite.tasks.length);
  for (const task of suite.tasks) {
    assert.match(task.taskId, /^cks03:task:[a-f0-9]{24}$/);
    assert.match(task.domainId, /^domain:[a-f0-9]{16}$/);
    assert.ok(task.prompt.length > 0);
    assert.ok(task.expected.reasonCode.length > 0);
    assert.ok(task.expected.evidenceIds.every((id) => /^evidence:[a-f0-9]{16}$/.test(id)));
    assert.match(task.taskDigest, /^[a-f0-9]{64}$/);
  }
  const missing = suite.tasks.find((task) => task.family === "MISSING_KNOWLEDGE");
  assert.equal(missing?.expected.state, "NEED_MORE_KNOWLEDGE");
  assert.equal(missing?.expected.answer, null);
  assert.deepEqual(missing?.expected.evidenceIds, []);
  const conflict = suite.tasks.find((task) => task.family === "CONFLICTING_SOURCES");
  assert.equal(conflict?.expected.state, "KNOWLEDGE_CONFLICT");
  assert.equal(conflict?.expected.answer, null);
  assert.equal(conflict?.expected.evidenceIds.length, 2);
});

test("CKS-03 split validation rejects seed reuse and re-digested task forgery", () => {
  const suites = CKS_SYNTHETIC_QUALIFICATION_LANES_V1.map((lane) =>
    generateCksSyntheticQualificationSuiteV1({ lane, seed: seeds[lane], generatedAtMs: 1_000 }),
  );
  const reused = CKS_SYNTHETIC_QUALIFICATION_LANES_V1.map((lane) =>
    generateCksSyntheticQualificationSuiteV1({ lane, seed: seeds.DEVELOPMENT, generatedAtMs: 1_000 }),
  );
  assert.deepEqual(validateCksSyntheticQualificationSplitV1(reused), {
    outcome: "DENIED", reason: "SEED_REUSE_DENIED",
  });

  const forged = structuredClone(suites) as unknown as Array<Record<string, unknown>>;
  const forgedTasks = forged[0]!.tasks as Array<Record<string, unknown>>;
  const forgedExpected = forgedTasks[0]!.expected as Record<string, unknown>;
  forgedExpected.answer = "caller-forged-answer";
  forged[0]!.suiteDigest = cksSyntheticQualificationSuiteDigestV1(forged[0]!);
  assert.deepEqual(validateCksSyntheticQualificationSplitV1(forged), {
    outcome: "DENIED", reason: "TASK_DIGEST_TAMPERED_DENIED",
  });

  const unknown = structuredClone(suites) as unknown as Array<Record<string, unknown>>;
  unknown[0]!.callerDeclaredQualified = true;
  unknown[0]!.suiteDigest = cksSyntheticQualificationSuiteDigestV1(unknown[0]!);
  assert.deepEqual(validateCksSyntheticQualificationSplitV1(unknown), {
    outcome: "DENIED", reason: "SCHEMA_DENIED",
  });
});

test("CKS-03 scoring treats closed-book success as potential leakage and checks epistemic outcomes", () => {
  const suite = generateCksSyntheticQualificationSuiteV1({
    lane: "FRESH_EPHEMERAL_CERTIFICATION", seed: seeds.FRESH_EPHEMERAL_CERTIFICATION, generatedAtMs: 1_000,
  });
  const results = suite.tasks.map((task, index) => ({
    taskId: task.taskId,
    state: task.expected.state,
    answer: task.expected.answer,
    evidenceIds: task.expected.evidenceIds,
    reasonCode: task.expected.reasonCode,
    closedBookCorrect: index === 0,
  }));
  const score = scoreCksSyntheticQualificationSuiteV1(suite, results);
  assert.equal(score.outcome, "SCORED");
  if (score.outcome !== "SCORED") return;
  assert.equal(score.evaluatedTasks, 8);
  assert.equal(score.supportedCorrect, 6);
  assert.equal(score.epistemicCorrect, 8);
  assert.equal(score.closedBookCorrectCount, 1);
  assert.equal(score.potentialLeakagePpm, 125_000);
  assert.match(score.scoreDigest, /^[a-f0-9]{64}$/);
  assert.deepEqual(scoreCksSyntheticQualificationSuiteV1(suite, results), score);

  const wrong = structuredClone(results);
  const missingIndex = suite.tasks.findIndex((task) => task.family === "MISSING_KNOWLEDGE");
  wrong[missingIndex] = { ...wrong[missingIndex]!, state: "ANSWER_SUPPORTED", answer: "guess" };
  const degraded = scoreCksSyntheticQualificationSuiteV1(suite, wrong);
  assert.equal(degraded.outcome, "SCORED");
  if (degraded.outcome === "SCORED") assert.equal(degraded.epistemicCorrect, 7);
});

test("CKS-03 committed manifests replay only public lanes while hidden and fresh seeds stay runtime-only", () => {
  const evidence = JSON.parse(readFileSync("verification/cks-03-public-manifests-v1.json", "utf8")) as {
    committedLanes: string[];
    runtimeOnlyLanes: string[];
    rawSeedsPresent: boolean;
    suites: ReturnType<typeof generateCksSyntheticQualificationSuiteV1>[];
  };
  assert.deepEqual(evidence.committedLanes, ["DEVELOPMENT", "VISIBLE_VALIDATION"]);
  assert.deepEqual(evidence.runtimeOnlyLanes, ["HIDDEN_QUALIFICATION", "FRESH_EPHEMERAL_CERTIFICATION"]);
  assert.equal(evidence.rawSeedsPresent, false);
  assert.deepEqual(evidence.suites, [
    generateCksSyntheticQualificationSuiteV1({ lane: "DEVELOPMENT", seed: seeds.DEVELOPMENT, generatedAtMs: 1_000 }),
    generateCksSyntheticQualificationSuiteV1({ lane: "VISIBLE_VALIDATION", seed: seeds.VISIBLE_VALIDATION, generatedAtMs: 1_000 }),
  ]);
  const serialized = JSON.stringify(evidence);
  assert.equal(serialized.includes(seeds.DEVELOPMENT), false);
  assert.equal(serialized.includes(seeds.VISIBLE_VALIDATION), false);
});
