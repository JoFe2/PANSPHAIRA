import { readFileSync, writeFileSync } from "node:fs";
import { execFileSync, spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import assert from "node:assert/strict";
import { cks09Digest } from "../dist/packages/contracts/src/cks-task-fingerprint.js";
import { criterionVerdict, renderReceipt, verifyEnvelope, RECEIPT_PATH, RECEIPT_SCHEMA_VERSION } from "../scripts/run-cks-09-proof-dry-run.mjs";

const root = new URL("../", import.meta.url).pathname;
const read = (relativePath) => JSON.parse(readFileSync(`${root}${relativePath}`, "utf8"));
const envelope = read("tests/fixtures/cks-09/e2e-positive-evidence-v1.json");
const rejections = read("tests/fixtures/cks-09/e2e-rejections-v1.json");
const committed = read("verification/cks-09-offline-proof-receipt-v1.json");
const groundTruth = read("tests/fixtures/cks-09/holdout-ground-truth-v1.json");
const envelopePath = join(root, "tests/fixtures/cks-09/e2e-positive-evidence-v1.json");

function assertNoProcedureContent(value) {
  const serialized = JSON.stringify(value);
  assert.equal(serialized.includes('"procedure"'), false);
  assert.equal(serialized.includes('"procedureContent"'), false);
}

function assertSelfDigest(receipt) {
  const { canonicalDigest, ...body } = receipt;
  assert.match(canonicalDigest, /^sha256:[a-f0-9]{64}$/);
  assert.equal(cks09Digest(body), canonicalDigest);
}

function applyMutation(doc, mutation) {
  const target = structuredClone(doc);
  const keys = mutation.path.replace(/\[(\d+)\]/g, ".$1").split(".");
  let node = target;
  for (let index = 0; index < keys.length - 1; index++) node = node[keys[index]];
  node[keys.at(-1)] = mutation.value;
  return target;
}

test("the evidence envelope binds all three admitted fixtures by id, path, and sha256 pin", () => {
  assert.equal(envelope.schemaVersion, "pansphaira.cks/e2e-proof-evidence/v1");
  assert.equal(envelope.fixtureKind, "E2E_PROOF_EVIDENCE");
  assert.equal(envelope.evidenceAdmission, "ADMITTED");
  assert.equal(envelope.requiredEvidencePresent, true);
  assert.equal(envelope.holdoutSealed, true);
  assert.equal(envelope.externalStateChanged, false);
  assert.equal(envelope.modelsOrServicesCalled, false);
  assert.equal(envelope.procedureContentReturned, false);
  assert.deepEqual(envelope.evidenceRefs.map((item) => item.fixtureId), [
    "cks-09-holdout",
    "cks-09-pattern-traps",
    "cks-09-holdout-ground-truth",
  ]);
  for (const ref of envelope.evidenceRefs) {
    assert.match(ref.sha256, /^sha256:[a-f0-9]{64}$/);
    assert.ok(ref.fixturePath.startsWith("tests/fixtures/cks-09/"));
  }
  for (const criterion of envelope.criteria) {
    for (const evidenceId of criterion.evidenceRefs) {
      assert.ok(envelope.evidenceRefs.some((item) => item.evidenceId === evidenceId), `${criterion.criterionId} cites unknown evidence ${evidenceId}`);
    }
  }
  assertNoProcedureContent(envelope);
});

test("the deterministic dry-run renders a PASS receipt with every criterion evidence-bound", () => {
  const { receipt, exitCode } = renderReceipt(envelope, envelopePath);
  assert.equal(exitCode, 0);
  assert.equal(receipt.schemaVersion, RECEIPT_SCHEMA_VERSION);
  assert.equal(receipt.verdict, "PASS");
  assert.deepEqual(receipt.reasons, []);
  assert.equal(receipt.mode, "SIMULATION_OR_SHADOW_ONLY");
  assert.equal(receipt.scope, "ADMITTED_SYNTHETIC_SEALED_HOLDOUT_ONLY");
  assert.equal(receipt.externalStateChanged, false);
  assert.equal(receipt.modelsOrServicesCalled, false);
  assert.equal(receipt.procedureContentReturned, false);
  assert.deepEqual(receipt.admission, { evidenceAdmission: "ADMITTED", holdoutSealed: true, replayMode: "SHADOW" });
  assert.equal(receipt.envelope.fixtureId, "cks-09-e2e-positive-evidence");
  assert.match(receipt.envelope.sha256, /^sha256:[a-f0-9]{64}$/);
  assert.deepEqual(receipt.evidence, envelope.evidenceRefs);
  assert.deepEqual(receipt.criteria.map((item) => [item.criterionId, item.verdict]), [
    ["P17_EXPERIENCE_IMPROVES_QUALITY_COST", "PASS"],
    ["P18_PLANTED_STABLE_IDENTIFIED_TRAPS_DENIED", "PASS"],
    ["INAPPLICABLE_VERSION_DRIFT_REUSE_DENIED", "PASS"],
    ["SHADOW_ONLY_SIMULATION_BOUNDARY", "PASS"],
    ["CANDIDATE_PRESERVATION", "PASS"],
  ]);
  assert.equal(receipt.proof.verdict, "PASS");
  assert.equal(receipt.proof.p17.verdict, "PASS");
  assert.ok(receipt.proof.p17.aggregate.qualityDelta > 0);
  assert.ok(receipt.proof.p17.aggregate.costReduction > 0);
  assert.ok(receipt.proof.p17.aggregate.efficiencyDelta > 0);
  assert.equal(receipt.proof.p18.verdict, "PASS");
  assert.deepEqual(receipt.proof.p18.acceptedPatternIds, ["pattern:normalize-document"]);
  assert.deepEqual(receipt.proof.reuseBoundaries.map((item) => item.outcome), ["DENIED", "DENIED", "DENIED", "DENIED"]);
  assert.equal(receipt.proof.failureClosedChecks.length, 5);
  assertNoProcedureContent(receipt);
  assertSelfDigest(receipt);
});

test("identical inputs render byte-identical receipts", () =>
  {
    const first = renderReceipt(envelope, envelopePath).receipt;
    const second = renderReceipt(envelope, envelopePath).receipt;
    assert.equal(JSON.stringify(first), JSON.stringify(second));
    assert.equal(first.canonicalDigest, second.canonicalDigest);
  });

test("final criteria require exact case identities, reasons, verdicts, and preserved references", () => {
  const proof = renderReceipt(envelope, envelopePath).receipt.proof;
  const mutations = [
    ["P18_PLANTED_STABLE_IDENTIFIED_TRAPS_DENIED", (value) => { value.p18.caseResults[1].caseId = "substituted-trap"; }],
    ["INAPPLICABLE_VERSION_DRIFT_REUSE_DENIED", (value) => { value.reuseBoundaries[0].reason = "VERSION_INCOMPATIBLE"; }],
    ["SHADOW_ONLY_SIMULATION_BOUNDARY", (value) => { value.failureClosedChecks[0].verdict = "DENIED"; }],
    ["SHADOW_ONLY_SIMULATION_BOUNDARY", (value) => { value.failureClosedChecks[4].caseId = "substituted-boundary"; }],
    ["CANDIDATE_PRESERVATION", (value) => { value.preservation.dependencyRefs = ["dependency:substituted"]; }],
    ["CANDIDATE_PRESERVATION", (value) => { value.preservation.provenanceRefs = ["provenance:fixture-a"]; }],
  ];
  for (const [criterionId, mutate] of mutations) {
    const altered = structuredClone(proof);
    mutate(altered);
    assert.equal(criterionVerdict(criterionId, altered, groundTruth), "DENIED", criterionId);
  }
});

test("every envelope-boundary mutation fails closed with its expected verdict and reason", () => {
  for (const item of rejections.cases) {
    const mutated = applyMutation(envelope, item.mutation);
    const result = verifyEnvelope(mutated, envelopePath);
    assert.equal(result.ok, false, `${item.caseId}: mutated envelope must not verify`);
    assert.equal(result.verdict, item.expectedVerdict, item.caseId);
    assert.equal(result.reason, item.expectedReason, item.caseId);
  }
  const failClosed = renderReceipt(applyMutation(envelope, rejections.cases[6].mutation), envelopePath);
  assert.equal(failClosed.exitCode, 1);
  assert.equal(failClosed.receipt.verdict, "INCONCLUSIVE");
  assert.deepEqual(failClosed.receipt.reasons, ["MISSING_288_DIGEST"]);
  assertNoProcedureContent(failClosed.receipt);
  assertSelfDigest(failClosed.receipt);
});

test("the envelope cannot claim a partial criterion set or substitute an evidence path", () => {
  const missingCriterion = structuredClone(envelope);
  missingCriterion.criteria = missingCriterion.criteria.slice(0, -1);
  const missingResult = verifyEnvelope(missingCriterion, envelopePath);
  assert.equal(missingResult.ok, false);
  assert.equal(missingResult.verdict, "INCONCLUSIVE");
  assert.equal(missingResult.reason, "MISSING_EVIDENCE");

  const substitutedEvidence = structuredClone(envelope);
  substitutedEvidence.evidenceRefs[0].fixturePath = "tests/fixtures/cks-09/pattern-trap-cases-v1.json";
  const substitutedResult = verifyEnvelope(substitutedEvidence, envelopePath);
  assert.equal(substitutedResult.ok, false);
  assert.equal(substitutedResult.verdict, "INCONCLUSIVE");
  assert.equal(substitutedResult.reason, "MISSING_EVIDENCE");
});

test("the required CLI dry-run emits a deterministic receipt identical to the committed file", () => {
  const output = execFileSync(process.execPath, [
    "scripts/run-cks-09-proof-dry-run.mjs",
    "--fixture",
    "tests/fixtures/cks-09/e2e-positive-evidence-v1.json",
    "--dry-run",
  ], { cwd: root, encoding: "utf8" });
  const receipt = JSON.parse(output);
  assert.equal(receipt.verdict, "PASS");
  assertNoProcedureContent(receipt);
  assert.equal(output, readFileSync(RECEIPT_PATH, "utf8"), "dry-run output must be byte-identical to the committed receipt");
});

test("the committed offline proof receipt is self-consistent and evidence-bound", () => {
  assert.equal(committed.schemaVersion, RECEIPT_SCHEMA_VERSION);
  assert.equal(committed.taskId, "PSAI289-QWEN-06-OFFLINE-PROOF-READBACK");
  assert.equal(committed.verdict, "PASS");
  assert.deepEqual(committed.evidence, envelope.evidenceRefs);
  assertSelfDigest(committed);
  assertNoProcedureContent(committed);
});

test("the CLI fails closed with exit 1 and an evidence-bound receipt on a tampered envelope file", () => {
  const tampered = applyMutation(envelope, rejections.cases[6].mutation);
  const tamperedPath = join(tmpdir(), `cks-09-tampered-${tampered.fixtureId}.json`);
  writeFileSync(tamperedPath, JSON.stringify(tampered, null, 2));
  const result = spawnSync(process.execPath, [
    "scripts/run-cks-09-proof-dry-run.mjs",
    "--fixture",
    tamperedPath,
    "--dry-run",
  ], { cwd: root, encoding: "utf8" });
  assert.equal(result.status, 1);
  const receipt = JSON.parse(result.stdout);
  assert.equal(receipt.schemaVersion, RECEIPT_SCHEMA_VERSION);
  assert.equal(receipt.verdict, "INCONCLUSIVE");
  assert.deepEqual(receipt.reasons, ["MISSING_288_DIGEST"]);
  assert.equal(receipt.proof, null);
  assertNoProcedureContent(receipt);
});