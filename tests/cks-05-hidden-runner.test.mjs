import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { join, resolve } from "node:path";
import test from "node:test";
import {
  sha256,
  canonical,
  deriveRunId,
  derivePairKey,
  materializeRunPlan,
  validateHiddenRunFixture,
} from "../scripts/cks-05-materialize-hidden-run.mjs";

const root = resolve(import.meta.dirname, "..");
const load = (p) => JSON.parse(readFileSync(join(root, p), "utf8"));

// Same RFC 8785-style canonical form the fixtures and the materializer use, so
// independent recomputation below is exact and reproducible.
const sha256Local = (b) => createHash("sha256").update(b).digest("hex");
const canonicalLocal = (v) => {
  if (Array.isArray(v)) return `[${v.map(canonicalLocal).join(",")}]`;
  if (v && typeof v === "object") {
    return `{${Object.keys(v).sort().map((k) => `${JSON.stringify(k)}:${canonicalLocal(v[k])}`).join(",")}}`;
  }
  return JSON.stringify(v);
};
const deepEqual = (a, b) => canonicalLocal(a) === canonicalLocal(b);
const flipHex = (hex) => `${hex[0] === "e" ? "f" : "e"}${hex.slice(1)}`;

const template = load("verification/cks-05-hidden-run-manifest-template-v1.json");
const catalog = load(template.publicSafeEvidence.catalogPath);
const l1Manifest = load(template.l1Manifest.path);
const decisionBytes = readFileSync(join(root, template.protocol.decisionReceipt.path));

const sources = { l1Manifest, catalog, decisionBytes };
const PLAN = materializeRunPlan(template);
const EDITION_IDS = ["K0_STATIC", "K1_UPDATED"];
const EXPECTED_ARM_IDS = ["ARM-LRF-01", "ARM-SRF-02", "ARM-LSF-03", "ARM-SSF-04", "ARM-SSG-05"];
const EXPECTED_RECEIPT_VERDICT =
  "MANIFEST_DEFINED_EXECUTION_NOT_AUTHORIZED_NO_BENCHMARK_RESULT_NO_MODEL_SUBSTITUTION_CLAIM";
const TASK_FIELDS = [
  "taskId",
  "scenarioPairId",
  "domainId",
  "hopClass",
  "updateSensitivity",
  "taskPromptCoreSha256",
  "goldRecordSha256",
  "evidenceGraphSha256",
];

const runCli = (args) => {
  const scriptPath = join(root, "scripts/cks-05-materialize-hidden-run.mjs");
  try {
    const stdout = execFileSync(process.execPath, [scriptPath, ...args], { cwd: root, encoding: "utf8" });
    return { status: 0, stdout, stderr: "" };
  } catch (err) {
    return { status: err.status ?? 1, stdout: err.stdout ?? "", stderr: err.stderr ?? "" };
  }
};

// -- CLI: the three required verification behaviors of the runner -------------

test("dry-run materializes the 960-run plan in memory and exits 0", () => {
  const r = runCli(["--fixture", "verification/cks-05-hidden-run-manifest-template-v1.json", "--dry-run"]);
  assert.equal(r.status, 0, `${r.stderr}\n${r.stdout}`);
  const receipt = JSON.parse(r.stdout);
  assert.equal(receipt.status, "DRY_RUN_OK");
  assert.equal(receipt.executionMode, "EPHEMERAL_IN_MEMORY");
  assert.equal(receipt.modelInvocations, 0);
  assert.equal(receipt.benchmarkRuns, 0);
  assert.equal(receipt.arithmetic.totalScheduledRunRecords, 960);
  assert.equal(receipt.arithmetic.distinctPairKeys, 192);
  assert.equal(receipt.arithmetic.runsPerPairKey, 5);
  assert.equal(receipt.crossArmIdentity.sameHiddenTaskPartition, true);
  assert.deepEqual(receipt.crossArmIdentity.knowledgeEditions, EDITION_IDS);
  assert.equal(receipt.claimGate.preExecutionStatus, "DENY_NOT_EXECUTED");
  assert.equal(receipt.evidenceVerdict, EXPECTED_RECEIPT_VERDICT);
});

test("CLI is fail-closed: non-dry-run execution is not authorized (exit 3)", () => {
  const r = runCli(["--fixture", "verification/cks-05-hidden-run-manifest-template-v1.json"]);
  assert.equal(r.status, 3);
  assert.match(r.stderr, /EXECUTION_NOT_AUTHORIZED/);
});

test("CLI is fail-closed: missing fixture and out-of-repo fixture are usage errors (exit 2)", () => {
  assert.equal(runCli([]).status, 2);
  const r = runCli(["--fixture", "/etc/passwd", "--dry-run"]);
  assert.equal(r.status, 2);
  assert.match(r.stderr, /UNSAFE_FIXTURE_PATH/);
});

// -- Source binding: template and catalog recompute from the approved receipt -

test("receipt byte digest and protocol canonical digest are source-bound", () => {
  assert.equal(sha256Local(decisionBytes), template.protocol.decisionReceipt.sha256);
  assert.equal(
    sha256Local(Buffer.from(canonicalLocal(JSON.parse(decisionBytes.toString("utf8"))), "utf8")),
    template.protocol.protocolDigestSha256,
  );
  // The template extends the L1 contract, never diverges from it.
  assert.equal(template.l1Manifest.manifestId, l1Manifest.manifestId);
  assert.equal(template.protocol.protocolDigestSha256, l1Manifest.protocol.protocolDigestSha256);
  assert.equal(template.protocol.decisionReceipt.sha256, l1Manifest.protocol.decisionReceipt.sha256);
});

test("catalog self-digest recomputes and binds to the same protocol receipt", () => {
  const withoutDigest = { ...catalog, catalogDigestSha256: null };
  assert.equal(sha256Local(Buffer.from(canonicalLocal(withoutDigest), "utf8")), catalog.catalogDigestSha256);
  assert.equal(catalog.boundProtocol.protocolDigestSha256, template.protocol.protocolDigestSha256);
  assert.equal(catalog.boundProtocol.decisionReceiptSha256, template.protocol.decisionReceipt.sha256);
});

// -- Cross-arm identity: same fresh hidden partition, same frozen editions ----

test("every arm runs the identical fresh hidden partition and both frozen editions", () => {
  // The public catalog and the run template bind the same partition bytes.
  assert.ok(deepEqual(catalog.taskPartition, template.taskPartition), "catalog/template partition drift");
  for (const arm of template.arms) {
    assert.deepEqual(arm.editions, EDITION_IDS, `${arm.armId} edition set`);
  }
  const partition = template.taskPartition;
  assert.equal(partition.freshnessStatus, "FRESH_SYNTHETIC_HIDDEN");
  assert.equal(partition.sealedDigestsOnly, true);
  assert.equal(partition.taskCount, partition.tasks.length);
  assert.equal(partition.tasks.length, 32);
  assert.equal(new Set(partition.tasks.map((t) => t.taskId)).size, 32);
  assert.equal(new Set(partition.tasks.map((t) => t.scenarioPairId)).size, 16);
  assert.equal(partition.tasks.filter((t) => t.hopClass === "SINGLE_HOP").length, 16);
  assert.equal(partition.tasks.filter((t) => t.updateSensitivity === "UPDATE_SENSITIVE").length, 16);
  // Editions are the identical frozen editions admitted at L1.
  const k0 = partition.knowledgeEditions.find((e) => e.editionId === "K0_STATIC");
  const k1 = partition.knowledgeEditions.find((e) => e.editionId === "K1_UPDATED");
  assert.equal(k0.role, "FROZEN_PRE_UPDATE");
  assert.equal(k0.editionSha256, l1Manifest.admission.knowledgeK0EditionSha256);
  assert.equal(k0.canonicalFactInventorySha256, l1Manifest.admission.knowledgeK0CanonicalFactInventorySha256);
  assert.equal(k1.role, "FROZEN_POST_UPDATE");
  assert.equal(k1.editionSha256, l1Manifest.admission.knowledgeK1EditionSha256);
  assert.equal(k1.canonicalFactInventorySha256, l1Manifest.admission.knowledgeK1CanonicalFactInventorySha256);
});

test("arm-to-profile bindings match the approved L1 design with pinned model bytes", () => {
  assert.equal(template.arms.length, 5);
  assert.deepEqual(template.arms.map((a) => a.armId).sort(), [...EXPECTED_ARM_IDS].sort());
  const l1Binding = Object.fromEntries(l1Manifest.arms.map((a) => [a.armId, a.modelProfileId]));
  for (const arm of template.arms) {
    assert.equal(arm.modelProfileId, l1Binding[arm.armId], `${arm.armId} profile binding`);
    const profile = l1Manifest.modelProfiles.find((p) => p.profileId === arm.modelProfileId);
    assert.ok(profile, `${arm.armId} unknown profile`);
    const expectedSha = profile.role === "SMALL" ? l1Manifest.admission.smallModelSha256 : l1Manifest.admission.largeModelSha256;
    assert.equal(profile.sha256, expectedSha, `${arm.armId} model byte identity`);
  }
  // Approved bindings: LRF/LSF large, SRF/SSF/SSG small.
  const byId = Object.fromEntries(template.arms.map((a) => [a.armId, a]));
  const large = l1Manifest.modelProfiles.find((p) => p.role === "LARGE").profileId;
  const small = l1Manifest.modelProfiles.find((p) => p.role === "SMALL").profileId;
  assert.equal(byId["ARM-LRF-01"].modelProfileId, large);
  assert.equal(byId["ARM-SRF-02"].modelProfileId, small);
  assert.equal(byId["ARM-LSF-03"].modelProfileId, large);
  assert.equal(byId["ARM-SSF-04"].modelProfileId, small);
  assert.equal(byId["ARM-SSG-05"].modelProfileId, small);
});

// -- Run-plan arithmetic and pairing from the materialized plan ---------------

test("materialized plan: 960 runs, 192 distinct pair keys, 5 runs per pair key", () => {
  assert.equal(PLAN.length, 960);
  assert.equal(PLAN.length, 5 * 32 * 2 * 3);
  assert.equal(new Set(PLAN.map((r) => r.runId)).size, PLAN.length, "runId collisions");
  const byPair = new Map();
  for (const r of PLAN) {
    const group = byPair.get(r.pairKey);
    if (group) group.push(r);
    else byPair.set(r.pairKey, [r]);
  }
  assert.equal(byPair.size, 192);
  assert.equal(byPair.size, 32 * 2 * 3);
  for (const [pairKey, group] of byPair) {
    assert.equal(group.length, 5, `${pairKey} must span the five arms`);
    assert.equal(new Set(group.map((r) => r.armId)).size, 5, `${pairKey} must span distinct arms`);
    const head = group[0];
    for (const r of group) {
      assert.equal(r.taskId, head.taskId);
      assert.equal(r.editionId, head.editionId);
      assert.equal(r.generationSeed, head.generationSeed);
      assert.equal(r.taskPromptCoreSha256, head.taskPromptCoreSha256);
      assert.equal(r.goldRecordSha256, head.goldRecordSha256);
      assert.equal(r.evidenceGraphSha256, head.evidenceGraphSha256);
      assert.equal(r.canonicalFactInventorySha256, head.canonicalFactInventorySha256);
    }
  }
  // Declared scheduled counts agree with the recomputed product and contrasts.
  const c = template.runPlan.scheduledCounts;
  assert.equal(c.totalScheduledRunRecords, c.arms * c.taskIdsPerEdition * c.knowledgeEditions * c.generationSeeds);
  assert.equal(c.pairedExecutionsPerArmContrastPerEdition, 96);
  assert.equal(c.independentTaskUnitsPerArmContrastPerEdition, 32);
  assert.equal(c.pairedExecutionsPerSingleMultiContrastPerArmEdition, 48);
  assert.equal(c.independentScenarioPairUnitsPerSingleMultiContrastPerArmEdition, 16);
  assert.equal(template.runPlan.distinctPairKeys, 192);
  assert.equal(template.runPlan.runsPerPairKey, 5);
});

test("runId/pairKey derivations are deterministic and pinned to the protocol digest", () => {
  const proto = template.protocol.protocolDigestSha256;
  for (const r of PLAN) {
    assert.equal(r.runId, deriveRunId(proto, r.armId, r.taskId, r.editionId, r.generationSeed));
    assert.equal(r.pairKey, derivePairKey(proto, r.taskId, r.editionId, r.generationSeed));
    assert.match(r.runId, /^run:[0-9a-f]{64}$/);
    assert.match(r.pairKey, /^pair:[0-9a-f]{64}$/);
  }
  // Double materialization on a clone must be byte-identical: no side effects.
  assert.equal(sha256(canonical(PLAN)), sha256(canonical(materializeRunPlan(structuredClone(template)))));
});

test("generation seeds are identical to L1 and the list digest recomputes", () => {
  assert.deepEqual(template.generation.seeds, l1Manifest.generation.seeds);
  assert.equal(sha256(canonical(template.generation.seeds)), template.generation.seedListSha256);
  assert.equal(template.generation.seedListSha256, l1Manifest.generation.generationSeedListSha256);
});

// -- Public-safe evidence and pre-execution contracts --------------------------

test("public-safe: sealed digests only, no raw task or Knowledge seed bytes", () => {
  assert.equal(catalog.publicSafe.rawTaskBytesPublished, false);
  assert.equal(catalog.publicSafe.rawKnowledgeSeedBytesPublished, false);
  assert.equal(catalog.publicSafe.sealedDigestsOnly, true);
  assert.equal(template.publicSafeEvidence.rawTaskBytesPublished, false);
  assert.equal(template.publicSafeEvidence.rawKnowledgeSeedBytesPublished, false);
  assert.equal(template.publicSafeEvidence.sealedDigestsOnly, true);
  // Every task entry carries identity + sealed digests and nothing else.
  for (const t of template.taskPartition.tasks) {
    assert.deepEqual(Object.keys(t).sort(), [...TASK_FIELDS].sort(), `${t.taskId} fields`);
    for (const ed of EDITION_IDS) {
      assert.match(t.goldRecordSha256[ed], /^[0-9a-f]{64}$/);
      assert.match(t.evidenceGraphSha256[ed], /^[0-9a-f]{64}$/);
    }
  }
  // Cross-edition invariants per task.
  for (const t of template.taskPartition.tasks) {
    const sensitive = t.updateSensitivity === "UPDATE_SENSITIVE";
    const goldDiffers = t.goldRecordSha256.K0_STATIC !== t.goldRecordSha256.K1_UPDATED;
    const evidenceDiffers = t.evidenceGraphSha256.K0_STATIC !== t.evidenceGraphSha256.K1_UPDATED;
    assert.equal(goldDiffers, sensitive, `${t.taskId} gold cross-edition`);
    assert.equal(evidenceDiffers, sensitive, `${t.taskId} evidence cross-edition`);
  }
});

test("execution is ephemeral and unauthorized: no model, no artifacts, no run plan on disk", () => {
  assert.deepEqual(template.executionMode, {
    mode: "EPHEMERAL_IN_MEMORY",
    persistedRunPlan: false,
    modelInvocation: false,
    executionAuthorized: false,
    writeRunArtifacts: false,
  });
});

test("claim gate, failure contract, and receipt stay fail-closed pre-execution", () => {
  assert.deepEqual(template.claimGate, {
    gateId: "L6-MODEL-SUBSTITUTION",
    preExecutionStatus: "DENY_NOT_EXECUTED",
    modelSubstitutionClaimBeforeExecution: false,
    noEarlySuccess: true,
  });
  const fc = template.failureContract;
  assert.equal(fc.preExecutionPlannedStatus, "NOT_RUN");
  assert.deepEqual(fc.terminalStatuses, ["COMPLETED", "FAILED", "INVALIDATED"]);
  assert.equal(fc.failureCodeNullOnlyWhenCompleted, true);
  assert.equal(fc.preservationRule, "APPEND_ONLY_NO_REPLACEMENT_RUNS");
  assert.equal(new Set(fc.modelFailureCodes).size, 8);
  assert.equal(new Set(fc.infrastructureInvalidationCodes).size, 7);
  assert.ok(fc.modelFailureCodes.includes("TIMEOUT"));
  assert.ok(fc.infrastructureInvalidationCodes.includes("DOCKER_ENOENT"));
  // Confidence intervals / run counts / failures are preserved by the inference
  // contract: paired bootstrap on the true resampling units, no pseudo-replication.
  const ic = template.inferenceContract;
  assert.equal(ic.confidenceLevel, 0.95);
  assert.equal(ic.bootstrapResamples, 20000);
  assert.equal(ic.resamplingUnits.armAndEditionContrasts, "taskId");
  assert.equal(ic.resamplingUnits.singleMultiHopContrasts, "scenarioPairId");
  assert.equal(ic.seedsAreRepeatedObservations, true);
  assert.equal(ic.noPseudoReplication, true);
  assert.equal(ic.ciUnavailabilityRule, "CI_UNAVAILABLE_DENIES_ASSOCIATED_CLAIM");
  assert.equal(template.receipt.currentEvidenceVerdict, EXPECTED_RECEIPT_VERDICT);
  assert.equal(template.receipt.taskId, "PSAI285-L2-FRESH-HIDDEN-TASK-RUNNER");
  const actions = template.receipt.actionsNotPerformed;
  assert.equal(actions.modelInvocations, 0);
  assert.equal(actions.benchmarkRuns, 0);
  assert.equal(actions.push, false);
  assert.equal(actions.merge, false);
  assert.equal(actions.release, false);
  // Operating model is preserved, no new process variant.
  assert.equal(template.operatingModel.version, l1Manifest.protocol.operatingModelVersion);
  assert.deepEqual(template.operatingModel.preservedDecisionIds, l1Manifest.protocol.preservedDecisionIds);
  assert.equal(template.operatingModel.processVariantIntroduced, false);
});

// -- Fail-closed probes: every drift or escape must be rejected ---------------

const PROBE_NAMES = [
  "arm-editions-drift",
  "arm-bound-to-wrong-profile",
  "protocol-digest-drift",
  "receipt-digest-drift",
  "seed-drift",
  "seed-list-digest-drift",
  "pre-execution-claim-status-pass",
  "model-substitution-claim-before-execution",
  "missing-arm",
  "total-scheduled-run-records-drift",
  "raw-task-bytes-exposed",
  "unknown-terminal-status",
  "partition-drift-catalog-vs-template",
  "catalog-self-digest-drift",
  "cross-edition-invariant-drift",
  "operating-model-variant",
  "execution-mode-not-ephemeral",
  "l1-manifest-mismatch",
  "partition-task-count-drift",
];

test("fail-closed: the intact fixture validates clean and every probe is rejected", () => {
  assert.deepEqual(validateHiddenRunFixture(template, sources), [], "intact fixture must validate clean");

  const probes = new Map();
  let t;
  let s;

  t = structuredClone(template);
  t.arms[0].editions = ["K0_STATIC"];
  probes.set("arm-editions-drift", [t, { ...sources }]);

  t = structuredClone(template);
  t.arms[0].modelProfileId = "MODEL-SMALL-VIBETHINKER-3B-Q8_0-ED81A97A";
  probes.set("arm-bound-to-wrong-profile", [t, { ...sources }]);

  t = structuredClone(template);
  t.protocol.protocolDigestSha256 = flipHex(t.protocol.protocolDigestSha256);
  probes.set("protocol-digest-drift", [t, { ...sources }]);

  t = structuredClone(template);
  s = { ...sources, decisionBytes: Buffer.concat([Buffer.from([decisionBytes[0] ^ 0xff]), decisionBytes.subarray(1)]) };
  probes.set("receipt-digest-drift", [t, s]);

  t = structuredClone(template);
  t.generation.seeds = [1, 2, 3];
  probes.set("seed-drift", [t, { ...sources }]);

  t = structuredClone(template);
  t.generation.seedListSha256 = flipHex(t.generation.seedListSha256);
  probes.set("seed-list-digest-drift", [t, { ...sources }]);

  t = structuredClone(template);
  t.claimGate.preExecutionStatus = "PASS";
  probes.set("pre-execution-claim-status-pass", [t, { ...sources }]);

  t = structuredClone(template);
  t.claimGate.modelSubstitutionClaimBeforeExecution = true;
  probes.set("model-substitution-claim-before-execution", [t, { ...sources }]);

  t = structuredClone(template);
  t.arms.pop();
  probes.set("missing-arm", [t, { ...sources }]);

  t = structuredClone(template);
  t.runPlan.scheduledCounts.totalScheduledRunRecords = 959;
  probes.set("total-scheduled-run-records-drift", [t, { ...sources }]);

  t = structuredClone(template);
  s = { ...sources, catalog: { ...structuredClone(catalog), publicSafe: { ...catalog.publicSafe, rawTaskBytesPublished: true } } };
  probes.set("raw-task-bytes-exposed", [t, s]);

  t = structuredClone(template);
  t.failureContract.terminalStatuses = ["COMPLETED", "FAILED", "INVALIDATED", "SKIPPED"];
  probes.set("unknown-terminal-status", [t, { ...sources }]);

  t = structuredClone(template);
  s = { ...sources, catalog: { ...structuredClone(catalog), taskPartition: { ...structuredClone(catalog.taskPartition), tasks: catalog.taskPartition.tasks.map((task, i) => (i === 0 ? { ...task, taskId: "TASK-DRIFTED" } : task)) } } };
  probes.set("partition-drift-catalog-vs-template", [t, s]);

  t = structuredClone(template);
  s = { ...sources, catalog: { ...structuredClone(catalog), catalogDigestSha256: flipHex(catalog.catalogDigestSha256) } };
  probes.set("catalog-self-digest-drift", [t, s]);

  t = structuredClone(template);
  const sensitive = t.taskPartition.tasks.find((task) => task.updateSensitivity === "UPDATE_SENSITIVE");
  sensitive.goldRecordSha256.K1_UPDATED = sensitive.goldRecordSha256.K0_STATIC;
  const control = t.taskPartition.tasks.find((task) => task.updateSensitivity === "EDITION_INVARIANT_CONTROL");
  control.evidenceGraphSha256.K1_UPDATED = flipHex(control.evidenceGraphSha256.K1_UPDATED);
  probes.set("cross-edition-invariant-drift", [t, { ...sources }]);

  t = structuredClone(template);
  t.operatingModel.processVariantIntroduced = true;
  probes.set("operating-model-variant", [t, { ...sources }]);

  t = structuredClone(template);
  t.executionMode.modelInvocation = true;
  probes.set("execution-mode-not-ephemeral", [t, { ...sources }]);

  t = structuredClone(template);
  s = { ...sources, l1Manifest: { ...structuredClone(l1Manifest), manifestId: "CKS-05-DRIFTED" } };
  probes.set("l1-manifest-mismatch", [t, s]);

  t = structuredClone(template);
  t.taskPartition.tasks.pop();
  probes.set("partition-task-count-drift", [t, { ...sources }]);

  const failures = [];
  for (const [name, [probe, probeSources]] of probes) {
    const errors = validateHiddenRunFixture(probe, probeSources);
    if (errors.length === 0) failures.push(`${name}: probe unexpectedly VALIDATED`);
  }
  for (const name of PROBE_NAMES) {
    if (!probes.has(name)) failures.push(`${name}: probe not constructed`);
  }
  assert.deepEqual(failures, [], failures.join("\n"));
});

test("fail-closed: each probe is rejected with a stable rejection code", () => {
  const expectCode = (name, code) => {
    const t = structuredClone(template);
    const s = { ...sources };
    switch (name) {
      case "arm-editions-drift":
        t.arms[0].editions = ["K0_STATIC"];
        break;
      case "arm-bound-to-wrong-profile":
        t.arms[0].modelProfileId = "MODEL-SMALL-VIBETHINKER-3B-Q8_0-ED81A97A";
        break;
      case "seed-drift":
        t.generation.seeds = [1, 2, 3];
        break;
      case "missing-arm":
        t.arms.pop();
        break;
      case "total-scheduled-run-records-drift":
        t.runPlan.scheduledCounts.totalScheduledRunRecords = 959;
        break;
      case "raw-task-bytes-exposed":
        s.catalog = { ...catalog, publicSafe: { ...catalog.publicSafe, rawTaskBytesPublished: true } };
        break;
      case "unknown-terminal-status":
        t.failureContract.terminalStatuses = ["COMPLETED", "FAILED", "SKIPPED"];
        break;
      case "partition-drift-catalog-vs-template":
        s.catalog = { ...catalog, taskPartition: { ...catalog.taskPartition, taskCount: 31 } };
        break;
      case "operating-model-variant":
        t.operatingModel.processVariantIntroduced = true;
        break;
      case "pre-execution-claim-status-pass":
        t.claimGate.preExecutionStatus = "PASS";
        break;
      default:
        throw new Error(`unexpected probe name ${name}`);
    }
    const errors = validateHiddenRunFixture(t, s);
    assert.ok(errors.length > 0, `${name} must be rejected`);
    assert.ok(
      errors.some((e) => e.startsWith(`${code}:`)),
      `${name}: expected code ${code}, got ${errors.join(" | ")}`,
    );
  };
  expectCode("arm-editions-drift", "EDITION_SET_DRIFT");
  expectCode("arm-bound-to-wrong-profile", "ARM_PROFILE_MISMATCH");
  expectCode("seed-drift", "SEED_DRIFT");
  expectCode("missing-arm", "ARM_SET_DRIFT");
  expectCode("total-scheduled-run-records-drift", "RUN_COUNT_DRIFT");
  expectCode("raw-task-bytes-exposed", "PUBLIC_SAFETY_VIOLATION");
  expectCode("unknown-terminal-status", "TERMINAL_STATUS_DRIFT");
  expectCode("partition-drift-catalog-vs-template", "PARTITION_MISMATCH");
  expectCode("operating-model-variant", "OPERATING_MODEL_DRIFT");
  expectCode("pre-execution-claim-status-pass", "CLAIM_GATE_NOT_DENY");
});