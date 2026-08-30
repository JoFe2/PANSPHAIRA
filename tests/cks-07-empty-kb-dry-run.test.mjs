import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

const root = resolve(import.meta.dirname, "..");
const script = resolve(root, "scripts/run-cks-07-empty-kb-dry-run.mjs");
const fixture = resolve(root, "tests/fixtures/cks-07/e2e-positive-evidence-v1.json");
const evidence = resolve(root, "verification/cks-07-empty-kb-dry-run-evidence-v1.json");
const authority = "READ_ONLY_KNOWLEDGE_NO_CREDENTIAL_POLICY_CAPABILITY_TOOL_WRITE_OR_EXECUTION_AUTHORITY";
const p12States = new Set(["RECOVERED", "NOT_APPLICABLE", "GAP_MISSING", "GAP_BAD_SOURCE", "GAP_APPLICABILITY", "GAP_CONFLICTING", "GAP_UNKNOWN_SEMANTIC", "BLOCKED"]);
const requirementStates = new Set(["SATISFIED", "NOT_APPLICABLE", "MISSING", "BAD_SOURCE", "APPLICABILITY", "CONFLICTING", "UNKNOWN_SEMANTIC", "CRITICALITY_MISMATCH"]);

function run() {
  const nodeOptions = `${process.env.NODE_OPTIONS ?? ""} --jitless`.trim();
  return JSON.parse(execFileSync(process.execPath, [script, "--fixture", fixture, "--dry-run"], {
    cwd: root,
    encoding: "utf8",
    env: { ...process.env, NODE_OPTIONS: nodeOptions },
  }));
}

test("offline harness renders a public-safe evidence draft and reads it back", () => {
  const report = run();
  assert.equal(report.schemaVersion, "pansphaira.verification/cks-07-empty-kb-dry-run-evidence/v1");
  assert.equal(report.evidenceClass, "PUBLIC_SAFE_LOCAL_SYNTHETIC");
  assert.equal(report.mode, "DRY_RUN");
  assert.equal(report.network, "OFFLINE_PROFILE_ONLY");
  assert.equal(report.model, "DISABLED");
  assert.equal(report.authorityBoundary, authority);
  assert.deepEqual(JSON.parse(readFileSync(evidence, "utf8")), report);
});

test("P11 evidence measures recall, precision, and critical misses", () => {
  const p11 = run().acceptanceCriteria.P11;
  assert.equal(p11.status, "PASS");
  assert.equal(p11.caseCount, 9);
  assert.equal(p11.requirementRecallMean, 0.14814814814814814);
  assert.equal(p11.requirementPrecisionMean, 0.2222222222222222);
  assert.equal(p11.totalCriticalRequirementMisses, 15);
  assert.equal(p11.criticalRequirementMissCases, 8);
  assert.deepEqual(new Set(p11.finiteRequirementStates), requirementStates);
});

test("P12 evidence replays alternate retrieval before missing and separates acquisition", () => {
  const p12 = run().acceptanceCriteria.P12;
  assert.equal(p12.status, "PASS");
  assert.deepEqual(p12.alternateRecovery.map((item) => item.terminalLevel), ["A1", "A2"]);
  assert.deepEqual(p12.alternateRecovery.map((item) => item.attemptOutcomes), [["NO_MATCH", "QUALIFYING_MATCH"], ["NO_MATCH", "NO_MATCH", "QUALIFYING_MATCH"]]);
  assert.equal(p12.missingAfterCompleteRecovery.state, "GAP_MISSING");
  assert.deepEqual(p12.missingAfterCompleteRecovery.retrievalLevels, ["A0", "A1", "A2"]);
  assert.equal(p12.missingAfterCompleteRecovery.acquisitionCandidateCount, 3);
  assert.equal(p12.missingAfterCompleteRecovery.allCandidatesNotAccepted, true);
  assert.equal(p12.missingAfterCompleteRecovery.promotionStatus, "NOT_REQUESTED");
  assert.equal(p12.missingAfterCompleteRecovery.acceptedKnowledgeDigest, null);
  assert.ok(p12.replayedReceiptCount >= 3);
  for (const item of p12.negativeCases) assert.equal(p12States.has(item.state), true, item.caseId);
});

test("P13 evidence proves false-completeness reduction against the simple solver", () => {
  const p13 = run().acceptanceCriteria.P13;
  assert.equal(p13.status, "PASS");
  assert.equal(p13.metrics.combinedFalseCompletenessCount, 0);
  assert.equal(p13.metrics.simpleSolverFalseCompletenessCount, 6);
  assert.equal(p13.metrics.combinedTrueCompletenessCount, 1);
  assert.equal(p13.falseCompletenessReduced, true);
});

test("missing, conflicting, unknown-semantic, bad-source, and applicability cases fail closed", () => {
  const report = run();
  const rejections = new Map(report.acceptanceCriteria.P12.negativeCases.map((item) => [item.caseId, item]));
  for (const [caseId, state] of [
    ["case:missing-too-early", "BLOCKED"],
    ["case:bad-source", "GAP_BAD_SOURCE"],
    ["case:applicability-fail-closed", "GAP_APPLICABILITY"],
    ["case:conflict-fail-closed", "GAP_CONFLICTING"],
    ["case:unknown-semantic-fail-closed", "GAP_UNKNOWN_SEMANTIC"],
  ]) assert.equal(rejections.get(caseId)?.state, state, caseId);
  assert.equal(report.acceptanceCriteria.failClosed.status, "PASS");
  assert.equal(report.acceptanceCriteria.failClosed.internetAndModelAcceptedAsKnowledge, false);
  assert.equal(report.acceptanceCriteria.failClosed.internetAndModelGrantedAuthority, false);
});

test("receipt replay and evidence rendering are byte deterministic", () => {
  const first = run();
  const second = run();
  assert.equal(JSON.stringify(first), JSON.stringify(second));
  assert.deepEqual(first, JSON.parse(readFileSync(evidence, "utf8")));
});
