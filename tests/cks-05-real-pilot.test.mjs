import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import {
  buildPrompt,
  definePilotArms,
  extractGeneratedOutput,
  extractFinalAnswer,
  runBoundedPilot,
  validatePilotConfig,
} from "../scripts/run-cks-05-real-pilot.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const config = JSON.parse(readFileSync(join(root, "tests/fixtures/cks-05/real-pilot-v3.json"), "utf8"));

const expected = [
  ["ARM-SCB-01", "SMALL", "CLOSED_BOOK"],
  ["ARM-SNR-02", "SMALL", "NAIVE_RAG"],
  ["ARM-SKF-03", "SMALL", "STRUCTURED_FABRIC"],
  ["ARM-LCB-04", "LARGE", "CLOSED_BOOK"],
  ["ARM-LKF-05", "LARGE", "STRUCTURED_FABRIC"],
];

test("pilot matrix contains both required closed-book controls and all issue outcome arms", () => {
  assert.deepEqual(definePilotArms(config).map((arm) => [arm.armId, arm.modelRole, arm.knowledgeMode]), expected);
  assert.deepEqual(validatePilotConfig(config), []);
});

test("closed-book prompts cannot receive Knowledge bytes while paired task bytes stay identical", () => {
  const prompts = Object.fromEntries(definePilotArms(config).map((arm) => [arm.armId, buildPrompt(config, arm)]));
  assert.ok(!prompts["ARM-SCB-01"].includes(config.task.goldAnswer));
  assert.ok(!prompts["ARM-LCB-04"].includes(config.task.goldAnswer));
  assert.ok(prompts["ARM-SNR-02"].includes(config.task.goldAnswer));
  assert.ok(prompts["ARM-SKF-03"].includes(config.task.goldAnswer));
  assert.ok(prompts["ARM-LKF-05"].includes(config.task.goldAnswer));
  for (const prompt of Object.values(prompts)) assert.ok(prompt.includes(config.task.question));
});

test("bounded pilot invokes every pinned arm once and preserves terminal receipts", () => {
  const calls = [];
  const fakeInvoke = ({ arm, prompt }) => {
    calls.push({ armId: arm.armId, prompt });
    return {
      terminalStatus: "COMPLETED",
      exitCode: 0,
      elapsedMs: arm.knowledgeMode === "CLOSED_BOOK" ? 10 : 20,
      stdout: arm.knowledgeMode === "CLOSED_BOOK" ? "ABSTAIN" : config.task.goldAnswer,
      stderr: "pinned-runtime",
    };
  };
  const receipt = runBoundedPilot(config, { invoke: fakeInvoke });
  assert.equal(calls.length, 5);
  assert.equal(receipt.runCounts.scheduled, 5);
  assert.equal(receipt.runCounts.completed, 5);
  assert.equal(receipt.runCounts.failed, 0);
  assert.equal(receipt.results.filter((result) => result.closedBook).length, 2);
  assert.equal(receipt.results.filter((result) => result.taskSuccess).length, 3);
  assert.equal(receipt.results.filter((result) => result.abstained).length, 2);
  assert.equal(receipt.claimGate.modelSubstitutionClaim, false);
  assert.equal(receipt.claimGate.status, "DENY_PILOT_INSUFFICIENT_FOR_DOD");
  assert.ok(receipt.stopConditions.includes("STOP-07-NO-EARLY-SUCCESS"));
  assert.ok(receipt.receiptSha256.match(/^[a-f0-9]{64}$/));
  for (const result of receipt.results) {
    assert.ok(result.promptSha256.match(/^[a-f0-9]{64}$/));
    assert.ok(result.stdoutSha256.match(/^[a-f0-9]{64}$/));
    assert.equal("stdout" in result, false);
    assert.equal("stderr" in result, false);
  }
});

test("scoring excludes echoed prompt bytes from generated output", () => {
  const arm = definePilotArms(config).find((candidate) => candidate.armId === "ARM-SNR-02");
  const prompt = buildPrompt(config, arm);
  const transcript = `runtime banner\n> ${prompt}\nMODEL-ANSWER\n[ Prompt: 100 t/s | Generation: 10 t/s ]`;
  assert.equal(extractGeneratedOutput(transcript, prompt), "MODEL-ANSWER");
  const receipt = runBoundedPilot(config, { armIds: [arm.armId], invoke: () => ({
    terminalStatus: "COMPLETED", exitCode: 0, elapsedMs: 1, stdout: transcript, stderr: "",
  }) });
  assert.equal(receipt.results[0].taskSuccess, false, "gold bytes present only in the echoed prompt must not score");
  assert.equal(receipt.results[0].abstained, false, "abstention instruction present only in the echoed prompt must not score");
});

test("scoring requires an exact final answer and rejects unfinished reasoning", () => {
  assert.equal(extractFinalAnswer("<think>consider EMBER-4 and ABSTAIN"), null);
  assert.equal(extractFinalAnswer("<think>reasoning</think>\nCINDER-6"), "CINDER-6");
  assert.equal(extractFinalAnswer("ABSTAIN"), "ABSTAIN");
});

test("pilot rejects model/runtime digest drift and an incomplete arm matrix", () => {
  const drift = structuredClone(config);
  drift.runtime.archiveSha256 = "0".repeat(64);
  assert.ok(validatePilotConfig(drift).some((error) => error.startsWith("RUNTIME_DIGEST")));
  const missing = structuredClone(config);
  missing.arms.pop();
  assert.ok(validatePilotConfig(missing).some((error) => error.startsWith("ARM_SET")));
});
