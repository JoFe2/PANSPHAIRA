import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { execFileSync, spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import {
  UPDATE_SYNTHETIC_APPLY_HARNESS_RECEIPT_SCHEMA_V1,
  UPDATE_SYNTHETIC_APPLY_HARNESS_SOURCE_TUPLE_DIGEST_V1,
  UPDATE_SYNTHETIC_APPLY_HARNESS_TARGET_TUPLE_DIGEST_V1,
  UPDATE_SYNTHETIC_APPLY_HARNESS_TARGET_TUPLE_V1,
  runUpdateSyntheticApplyHarnessV1,
  updateSyntheticApplyHarnessReceiptDigestV1,
  verifyUpdateSyntheticApplyHarnessReceiptV1,
} from "../dist/packages/contracts/src/update-synthetic-apply-harness.js";
import { canonicalJson } from "../dist/packages/contracts/src/canonical-json.js";
import {
  UPDATE_CONTROLLER_SYNTHETIC_EVIDENCE_CLAIMS_V1,
  UPDATE_CONTROLLER_SYNTHETIC_EVIDENCE_NON_CLAIMS_V1,
  UPDATE_CONTROLLER_SYNTHETIC_EVIDENCE_SCENARIOS_V1,
  UPDATE_CONTROLLER_SYNTHETIC_EVIDENCE_SCHEMA_V1,
  buildUpdateControllerSyntheticEvidenceV1,
  renderUpdateControllerSyntheticEvidenceV1,
} from "../scripts/render-update-controller-synthetic-evidence.mjs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const SCRIPT = resolve(ROOT, "scripts/render-update-controller-synthetic-evidence.mjs");
const EXPECTED_TUPLE = {
  core: [{ componentId: "core:safe-guided", version: "1.1.0", digest: "1".repeat(64) }],
  packs: [{ componentId: "pack:general", version: "1.0.0", digest: "2".repeat(64) }],
  adapters: [{ componentId: "adapter:dev", version: "1.0.0", digest: "3".repeat(64) }],
  policies: [{ componentId: "policy:default", version: "2.0.0", digest: "4".repeat(64) }],
  schemas: [{ componentId: "schema:catalog", version: "1.0.0", digest: "5".repeat(64) }],
  generations: [{ componentId: "generation:safe-guided", version: "1.0.0", digest: "6".repeat(64) }],
};
const VERIFIED = { outcome: "VERIFIED", reasonCodes: ["SYNTHETIC_APPLY_RECEIPT_VERIFIED"], exitCode: 0 };

function packetDigest(packet) {
  const { packetDigest: ignored, ...unsigned } = packet;
  void ignored;
  return createHash("sha256").update(canonicalJson(unsigned)).digest("hex");
}

function recomputeReceipt(receipt, changes) {
  const changed = { ...receipt, ...changes };
  return { ...changed, receiptDigest: updateSyntheticApplyHarnessReceiptDigestV1(changed) };
}

function cli(args = []) {
  return spawnSync(process.execPath, [SCRIPT, ...args], {
    cwd: ROOT,
    encoding: "utf8",
    env: { ...process.env },
    maxBuffer: 2 * 1024 * 1024,
  });
}

test("delivery packet pins the exact six-axis tuple and binds only verified receipts", () => {
  const packet = buildUpdateControllerSyntheticEvidenceV1();
  assert.equal(packet.schemaVersion, UPDATE_CONTROLLER_SYNTHETIC_EVIDENCE_SCHEMA_V1);
  assert.equal(packet.evidenceClass, "LOCAL_SYNTHETIC_REDACTED");
  assert.equal(packet.mode, "DRY_RUN_READBACK");
  assert.deepEqual(packet.tuple, EXPECTED_TUPLE);
  assert.equal(packet.tupleDigest, UPDATE_SYNTHETIC_APPLY_HARNESS_TARGET_TUPLE_DIGEST_V1);
  assert.equal(packet.sourceTupleDigest, UPDATE_SYNTHETIC_APPLY_HARNESS_SOURCE_TUPLE_DIGEST_V1);
  assert.equal(packet.packetDigest, packetDigest(packet));
  assert.deepEqual(packet.claims, UPDATE_CONTROLLER_SYNTHETIC_EVIDENCE_CLAIMS_V1);
  assert.deepEqual(packet.nonClaims, UPDATE_CONTROLLER_SYNTHETIC_EVIDENCE_NON_CLAIMS_V1);
  assert.deepEqual(packet.receipts.map(({ scenario }) => scenario), UPDATE_CONTROLLER_SYNTHETIC_EVIDENCE_SCENARIOS_V1);
  assert.equal(packet.receipts.length, 5);
  for (const projection of packet.receipts) {
    const receipt = runUpdateSyntheticApplyHarnessV1({ failure: projection.scenario });
    assert.deepEqual(verifyUpdateSyntheticApplyHarnessReceiptV1(receipt), VERIFIED);
    assert.equal(projection.receiptDigest, receipt.receiptDigest);
    assert.equal(projection.tupleDigest, UPDATE_SYNTHETIC_APPLY_HARNESS_TARGET_TUPLE_DIGEST_V1);
    assert.equal(projection.sourceTupleDigest, UPDATE_SYNTHETIC_APPLY_HARNESS_SOURCE_TUPLE_DIGEST_V1);
    assert.equal(projection.lkgRevoked, false);
    assert.equal(projection.residueCount, projection.readback.residueCount);
  }
});

test("doctor readback is zero-write and its public projection contains no private observation data", () => {
  const before = execFileSync("git", ["status", "--porcelain"], { cwd: ROOT, encoding: "utf8" });
  const packet = buildUpdateControllerSyntheticEvidenceV1();
  const after = execFileSync("git", ["status", "--porcelain"], { cwd: ROOT, encoding: "utf8" });
  assert.equal(after, before);
  assert.equal(packet.doctor.readOnly, true);
  assert.equal(packet.doctor.mutationCount, 0);
  assert.equal(packet.doctor.projection.profile, "QUICK");
  assert.equal(packet.doctor.projection.checks.length, 5);
  assert.ok(packet.doctor.projection.checks.every(({ status, reasonCode }) => status === "PASS" && reasonCode === "OBSERVATION_MATCHED"));
  assert.equal("privateObservation" in packet.doctor.projection, false);
  assert.doesNotMatch(JSON.stringify(packet.doctor), /redaction-canary|privateObservation|\/home\/|secret|token|credential|(?:\d{1,3}\.){3}\d{1,3}/i);
});

test("all required positive and fail-closed negative scenario outcomes are present", () => {
  const packet = buildUpdateControllerSyntheticEvidenceV1();
  const byScenario = new Map(packet.receipts.map((receipt) => [receipt.scenario, receipt]));
  assert.equal(byScenario.get("SUCCESS")?.outcome, "APPLIED");
  assert.equal(byScenario.get("SUCCESS")?.contractChecks.postcondition, "ACCEPT_SWITCH");
  for (const scenario of ["PARTIAL_MIGRATION", "FAILED_POSTCONDITION"]) {
    const receipt = byScenario.get(scenario);
    assert.equal(receipt?.outcome, "ROLLED_BACK_ZERO_RESIDUE");
    assert.equal(receipt?.finalPointer.activeTupleDigest, UPDATE_SYNTHETIC_APPLY_HARNESS_SOURCE_TUPLE_DIGEST_V1);
    assert.equal(receipt?.finalOwnerStateDigest, receipt?.initialOwnerStateDigest);
    assert.equal(receipt?.lkgState, "COMPLETE");
    assert.equal(receipt?.lkgRevoked, false);
    assert.equal(receipt?.residueCount, 0);
    assert.equal(receipt?.contractChecks.rollbackReadback, "VERIFIED");
  }
  const outage = byScenario.get("REGISTRY_OUTAGE");
  assert.equal(outage?.outcome, "PRESERVE_ACCEPTED");
  assert.deepEqual(outage?.initialPointer, outage?.finalPointer);
  assert.equal(outage?.contractChecks.continuity, "PRESERVE_ACCEPTED");
  assert.deepEqual(outage?.contractChecks, {
    promotionGate: "NOT_PERFORMED",
    migrationEdge: "NOT_PERFORMED",
    checkpoint: "NOT_PERFORMED",
    applyJournal: "NOT_PERFORMED",
    postcondition: "NOT_PERFORMED",
    continuity: "PRESERVE_ACCEPTED",
    rollbackReadback: "NOT_APPLICABLE",
  });
  const invalid = byScenario.get("INVALID_LKG");
  assert.equal(invalid?.outcome, "SAFE_READ_ONLY");
  assert.equal(invalid?.readOnly, true);
  assert.equal(invalid?.lkgState, "INCOMPLETE");
  assert.equal(invalid?.contractChecks.continuity, "ENTER_SAFE_READ_ONLY");
  assert.deepEqual(invalid?.initialPointer, invalid?.finalPointer);
  assert.deepEqual(invalid?.stateTrace, ["CHECK_CONTINUITY", "INVALID_LKG", "ENTER_SAFE_READ_ONLY", "READBACK"]);
  assert.deepEqual(invalid?.contractChecks, {
    promotionGate: "NOT_PERFORMED",
    migrationEdge: "NOT_PERFORMED",
    checkpoint: "NOT_PERFORMED",
    applyJournal: "NOT_PERFORMED",
    postcondition: "NOT_PERFORMED",
    continuity: "ENTER_SAFE_READ_ONLY",
    rollbackReadback: "NOT_APPLICABLE",
  });
});

test("retry is deterministic, promotion is independently bound, and tampering cannot become a claim", () => {
  const first = runUpdateSyntheticApplyHarnessV1({ failure: "FAILED_POSTCONDITION" });
  const second = runUpdateSyntheticApplyHarnessV1({ failure: "FAILED_POSTCONDITION" });
  assert.deepEqual(first, second);
  assert.equal(first.retryOrdinal, 2);
  assert.equal(first.contractChecks.promotionGate, "VERIFIED");
  assert.notEqual(first.initialPointer.activeSnapshotId, "candidate:synthetic-001");
  assert.deepEqual(verifyUpdateSyntheticApplyHarnessReceiptV1({ ...first, residueCount: 1 }), {
    outcome: "DENIED",
    reasonCodes: ["DIGEST_MISMATCH_DENIED"],
    exitCode: 71,
  });
  assert.equal(first.schemaVersion, UPDATE_SYNTHETIC_APPLY_HARNESS_RECEIPT_SCHEMA_V1);
});

test("renderer receipt verification rejects recomputed-digest semantic substitutions", () => {
  const receipt = runUpdateSyntheticApplyHarnessV1({ failure: "FAILED_POSTCONDITION" });
  for (const forged of [
    recomputeReceipt(receipt, { outcome: "APPLIED" }),
    recomputeReceipt(receipt, { scenario: "SUCCESS" }),
    recomputeReceipt(receipt, { readOnly: true }),
    recomputeReceipt(receipt, { stateTrace: ["CHECK_CONTINUITY", "CONTINUITY_ACCEPTED", "READBACK"] }),
    recomputeReceipt(receipt, {
      contractChecks: { ...receipt.contractChecks, postcondition: "ACCEPT_SWITCH", rollbackReadback: "NOT_APPLICABLE" },
    }),
  ]) {
    assert.deepEqual(verifyUpdateSyntheticApplyHarnessReceiptV1(forged), {
      outcome: "DENIED",
      reasonCodes: ["SEMANTIC_MISMATCH_DENIED"],
      exitCode: 74,
    });
  }
});

test("CLI dry-run/readback emits the same redacted packet and writes nothing", () => {
  const before = execFileSync("git", ["status", "--porcelain"], { cwd: ROOT, encoding: "utf8" });
  const run = cli(["--dry-run"]);
  const readback = cli(["--readback"]);
  const after = execFileSync("git", ["status", "--porcelain"], { cwd: ROOT, encoding: "utf8" });
  assert.equal(run.status, 0, run.stderr);
  assert.equal(run.stderr, "");
  assert.equal(readback.status, 0, readback.stderr);
  assert.equal(readback.stderr, "");
  assert.equal(after, before);
  assert.equal(run.stdout, renderUpdateControllerSyntheticEvidenceV1());
  assert.equal(readback.stdout, run.stdout);
  const packet = JSON.parse(run.stdout);
  assert.equal(packet.mode, "DRY_RUN_READBACK");
  assert.doesNotMatch(run.stdout, /redaction-canary|privateObservation|\/home\/|secret|token|credential|(?:\d{1,3}\.){3}\d{1,3}/i);
});

test("CLI rejects unsupported modes without producing a success packet", () => {
  const run = cli(["--write", "outside-allowlist"]);
  assert.notEqual(run.status, 0);
  assert.equal(run.stdout, "");
  assert.match(run.stderr, /USAGE/);
});

test("renderer source has no filesystem, process, network, or credential export path", () => {
  const source = readFileSync(SCRIPT, "utf8");
  assert.doesNotMatch(source, /writeFile|mkdir|rename|unlink|rmSync|fetch\(|spawnSync|execFileSync|process\.env/);
  assert.doesNotMatch(source, /-----BEGIN|gh[pousr]-|\/home\//i);
});

test("checkpoint rollback, promotion, synthetic apply, and packet tests are canonically registered", () => {
  const packageJson = JSON.parse(readFileSync(resolve(ROOT, "package.json"), "utf8"));
  const canonicalLifecycle = `${packageJson.scripts.test} ${packageJson.scripts.posttest}`;
  const focusedCommand = packageJson.scripts["update-controller-synthetic:test"];
  for (const target of [
    "dist/tests/update-migration-checkpoint.test.js",
    "dist/tests/update-checkpoint-rollback-readback.test.js",
    "dist/tests/update-promotion-gate.test.js",
    "dist/tests/update-synthetic-apply-harness.test.js",
    "tests/update-controller-synthetic-evidence.test.mjs",
  ]) {
    assert.match(canonicalLifecycle, new RegExp(target.replaceAll(".", "\\.")));
    assert.match(focusedCommand, new RegExp(target.replaceAll(".", "\\.")));
  }

  const dag = JSON.parse(readFileSync(resolve(ROOT, "verification/verification-dag-v2.json"), "utf8"));
  const nodes = dag.nodes.filter(({ id }) => id === "ud-psai53-update-controller-synthetic-v1");
  assert.equal(nodes.length, 1);
  assert.deepEqual(nodes[0].ownedTests, ["npm run update-controller-synthetic:test"]);
});
