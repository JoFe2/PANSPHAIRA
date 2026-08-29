import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import test from "node:test";

const script = "scripts/render-ccp-m1-evidence.mjs";
const input = "tests/fixtures/ccp-evidence/complete.json";
const negativeInput = "tests/fixtures/ccp-evidence/redaction-failure.json";
const staleHeadInput = "tests/fixtures/ccp-evidence/stale-head.json";
const docs = "docs/ccp-m1-local-proof.md";
const runtimeArgs = process.execArgv.includes("--jitless") ? ["--jitless"] : [];

function run(args) {
  return spawnSync(process.execPath, [...runtimeArgs, script, ...args], {
    encoding: "utf8",
    env: { ...process.env, NODE_TEST_CONTEXT: undefined },
  });
}

function runGit(args) {
  return spawnSync("git", args, { encoding: "utf8" }).stdout.trim();
}

test("CCP-M1 evidence renderer emits deterministic packet and readback input", () => {
  const first = run(["--check"]);
  assert.equal(first.status, 0, first.stderr);
  const result = JSON.parse(first.stdout);
  assert.equal(result.status, "PASS");
  assert.equal(result.readbackHarnessInput.taskId, "TERRA-PSAI52-ROOT-QS-01");
  assert.match(result.packetDigest, /^[a-f0-9]{64}$/);
  assert.equal(result.readbackHarnessInput.schemaVersion, "cm.ccp-m1-local-proof-readback-input/v1");
  assert.equal(result.readbackHarnessInput.externalRequestMade, false);
  assert.equal(result.readbackHarnessInput.sourceBoundary, "LOCAL_SYNTHETIC_NON_PRODUCTION");
  assert.equal(result.readbackHarnessInput.expectedReadback.exactBaseCommit, "9aa9fec7d0320949c987f0a7a6dc8f1e3e3f4809");
  const currentHead = runGit(["rev-parse", "HEAD"]);
  const parentHead = runGit(["rev-parse", "HEAD^"]);
  assert.ok([currentHead, parentHead].includes(result.readbackHarnessInput.expectedReadback.exactHeadCommit));
  assert.equal(result.readbackHarnessInput.expectedReadback.profileReceiptDigests.length, 5);
  assert.equal(result.readbackHarnessInput.expectedReadback.recoveryReceiptDigests.length, 4);
  assert.equal(result.readbackHarnessInput.expectedReadback.statusDigests.length, 4);
  assert.equal(result.readbackHarnessInput.preparedExternalActions.length, 5);
  for (const action of result.readbackHarnessInput.preparedExternalActions) {
    assert.equal(action.externalRequestMade, false);
    assert.ok(action.localEvidenceFields.length > 0);
    assert.ok(action.readbackFields.length > 0);
  }

  const rendered = readFileSync(docs, "utf8");
  const packetMatch = rendered.match(/## Canonical packet JSON\n\n```json\n([^\n]+)\n```/);
  assert.ok(packetMatch);
  const packet = JSON.parse(packetMatch[1]);
  assert.equal(packet.governingReceipt.receiptType, "ADR_DECISION_INTEGRATION_RECEIPT");
  assert.equal(packet.governingReceipt.acceptanceProofStatus, "NOT_CLAIMED_BY_THIS_RECEIPT");
  assert.equal(packet.governingReceipt.authorityGranted, false);
  assert.equal(packet.boundary.verificationClaimed, false);
  assert.equal(packet.criteria.every((criterion) => criterion.receiptStatus === "BOUND_NOT_PROVEN"), true);
  assert.equal(rendered.includes("LOCAL_SYNTHETIC"), true);
  assert.equal(rendered.includes("BOUND_NOT_PROVEN"), true);
  assert.equal(rendered.includes("profile:synthetic-10000-events-per-hour"), true);
  assert.equal(rendered.includes("PROMOTION_FAILURE"), true);
  assert.equal(rendered.includes("EXACT_PRE_PROMOTION_RESTORED"), true);
  assert.equal(rendered.includes("Decision/integration boundary"), true);
  assert.equal(rendered.includes("ADR_DECISION_INTEGRATION_RECEIPT"), true);
  assert.equal(rendered.includes("NOT_CLAIMED_BY_THIS_RECEIPT"), true);
  assert.equal(rendered.includes("Authority granted | `false`"), true);
  assert.equal(rendered.includes("Local infrastructure observation"), true);
  assert.equal(rendered.includes("SIGTRAP observed: `true`"), true);
  assert.equal(rendered.includes("quarantined"), true);
  assert.equal(rendered.includes("No external request is made"), true);
  assert.equal(rendered.includes("/mnt/data2/"), false);
  assert.equal(rendered.includes("customer@example.invalid"), false);

  const check = run(["--check"]);
  assert.equal(check.status, 0, check.stderr);
  assert.equal(JSON.parse(check.stdout).packetDigest, result.packetDigest);
});

test("CCP-M1 evidence renderer fails closed before rendering a redaction failure", () => {
  const result = run(["--input", negativeInput]);
  assert.notEqual(result.status, 0);
  assert.match(`${result.stdout}\n${result.stderr}`, /CCP_M1_EVIDENCE_INPUT_SCHEMA_DENIED/);
  assert.equal(readFileSync(docs, "utf8").includes("customer@example.invalid"), false);
});

test("CCP-M1 evidence renderer fails closed for a stale integration head", () => {
  const result = run(["--input", staleHeadInput]);
  assert.notEqual(result.status, 0);
  assert.match(`${result.stdout}\n${result.stderr}`, /CCP_M1_EVIDENCE_BINDING_DENIED/);
  assert.equal(readFileSync(docs, "utf8").includes("4db140bcd056434fa278603e39461d429907c160"), false);
});
