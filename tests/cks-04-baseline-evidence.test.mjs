import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { verifyBaselineEvidence } from "../scripts/verify-cks-04-baseline-evidence.mjs";

const root = fileURLToPath(new URL("..", import.meta.url));
const evidencePath = "verification/cks-04-no-finetune-baseline-evidence-v1.json";
const evidence = JSON.parse(readFileSync(`${root}/${evidencePath}`, "utf8"));

function run(script, args) {
  return spawnSync(process.execPath, [script, ...args], { cwd: root, encoding: "utf8" });
}

test("baseline evidence replays only with the explicit local template gate", () => {
  const result = run("scripts/verify-cks-04-baseline-evidence.mjs", ["--input", evidencePath, "--allow-template"]);
  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.equal(result.signal, null);
  const summary = JSON.parse(result.stdout);
  assert.deepEqual(summary, {
    status: "VERIFIED_NOT_QUALIFIED",
    baselineDigest: "1cb92d7fefda004fdde25a48f2a7f5ec818c166efb043dfa94c7662728125fd1",
    totalCases: 6,
    p2Cases: 1,
    p3Cases: 5,
    failures: 0,
    abstentions: 5,
    deterministicVerifier: "PSAI284-DETERMINISTIC-EPISTEMIC-VERIFIER",
    semanticVerifier: "PSAI284-INDEPENDENT-BLINDED-HUMAN-SEMANTIC-VERIFIER",
    semanticVerifierTrusted: false,
  });
});

test("readback is local, deterministic, and exposes the review fields", () => {
  const result = run("scripts/render-cks-04-public-readback.mjs", ["--input", evidencePath, "--dry-run"]);
  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.equal(result.signal, null);
  for (const text of [
    "CKS-04 LOCAL PUBLIC READBACK",
    "qualification: NOT_QUALIFIED",
    "publication: LOCAL_READBACK_ONLY; external=false",
    "model: model:qwen2.5-1.5b-instruct @ artifact-revision-91cad511",
    "semanticVerifier: PSAI284-INDEPENDENT-BLINDED-HUMAN-SEMANTIC-VERIFIER @ 1 rubric=PSAI284-SEMANTIC-CLAIM-APPLICATION-RUBRIC-V1 trusted=false",
    "P2: 1 cases; pass=1; abstain=0; failures=0",
    "P3: 5 cases; pass=0; abstain=5; failures=0",
    "FAILURES\n  (none)",
    "scenario:parametric-conflict [PARAMETRIC_CONFLICT] -> KNOWLEDGE_CONFLICT",
    "semantic: PSAI284-INDEPENDENT-BLINDED-HUMAN-SEMANTIC-VERIFIER",
    "NONCLAIMS REVIEW",
  ]) assert.match(result.stdout, new RegExp(text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
});

test("verifier fails closed on missing gate and exact binding drift", () => {
  assert.throws(() => verifyBaselineEvidence(evidence), /RUN_MANIFEST_REQUIRED/);
  const altered = structuredClone(evidence);
  altered.bindings.model.digest = "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
  assert.throws(() => verifyBaselineEvidence(altered, { allowTemplate: true }), /EXACT_BINDINGS_MISMATCH/);
});

test("replay records typed information need, coverage, preconditions, and verifier separation", () => {
  const result = verifyBaselineEvidence(evidence, { allowTemplate: true });
  assert.equal(result.report.score.receiptVerifiedCases, 6);
  assert.equal(result.report.score.verifiedPasses, 1);
  assert.equal(result.report.score.failClosedAbstentions, 5);
  assert.ok(result.report.results.every((item) => item.typedBoundedRequests && item.informationNeedDetected));
  assert.ok(result.report.results.every((item) => item.claimCoverageVerified && item.procedureCoverageVerified));
  assert.ok(result.report.results.every((item) => item.semanticVerifierTrusted === false));
});
