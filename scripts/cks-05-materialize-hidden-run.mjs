#!/usr/bin/env node
// CKS-05 L2: materialize an explicitly ephemeral, in-memory hidden-run plan.
//
// Binds every arm of the approved PSAI285 benchmark comparison to the SAME
// fresh hidden task partition and the SAME versioned Knowledge editions
// (K0_STATIC / K1_UPDATED), while exposing only public-safe sealed digests.
// No model is invoked, no run artifact is written, and no benchmark is
// executed: execution authorization is NOT_GRANTED_DESIGN_RECEIPT_ONLY, so
// the only authorized mode is --dry-run, which validates the fixture,
// materializes the 960-run plan in memory, and prints a digest-only receipt.
//
// Usage:
//   node scripts/cks-05-materialize-hidden-run.mjs --fixture <path> --dry-run
//
// Exit codes: 0 = dry-run OK; 1 = fail-closed rejection; 2 = usage error;
// 3 = execution requested but not authorized.
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { dirname, join, resolve, sep } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const EXPECTED_ARM_IDS = ["ARM-LRF-01", "ARM-SRF-02", "ARM-LSF-03", "ARM-SSF-04", "ARM-SSG-05"];
const EDITION_IDS = ["K0_STATIC", "K1_UPDATED"];
const TERMINAL_STATUSES = ["COMPLETED", "FAILED", "INVALIDATED"];
const MODEL_FAILURE_CODES = [
  "TIMEOUT",
  "OOM_WITHIN_ADMITTED_ENVELOPE",
  "NONZERO_RUNTIME_EXIT",
  "MALFORMED_STREAM",
  "OUTPUT_LIMIT_WITHOUT_VALID_FINAL",
  "INVALID_JSON",
  "REFUSAL_NO_VALID_ANSWER",
  "RUNTIME_ERROR",
];
const INFRA_INVALIDATION_CODES = [
  "HOST_DRIFT",
  "CLOCK_INVALID",
  "RESOURCE_SAMPLER_GAP",
  "THERMAL_INVALID",
  "UNRELATED_PROCESS_INTERFERENCE",
  "HARNESS_SIGTRAP_EXIT_133",
  "DOCKER_ENOENT",
];
const EXPECTED_RECEIPT_VERDICT =
  "MANIFEST_DEFINED_EXECUTION_NOT_AUTHORIZED_NO_BENCHMARK_RESULT_NO_MODEL_SUBSTITUTION_CLAIM";
const HEX64 = /^[0-9a-f]{64}$/;

export const sha256 = (data) => createHash("sha256").update(data).digest("hex");
// RFC 8785-style canonical form: sorted keys, compact separators.
export const canonical = (v) => {
  if (Array.isArray(v)) return `[${v.map(canonical).join(",")}]`;
  if (v && typeof v === "object") {
    return `{${Object.keys(v).sort().map((k) => `${JSON.stringify(k)}:${canonical(v[k])}`).join(",")}}`;
  }
  return JSON.stringify(v);
};

// Pinned derivation contract (immutableManifestContract L2):
// runId  = run:<sha256(protocolDigestSha256|armId|taskId|editionId|generationSeed)>
// pairKey = pair:<sha256(protocolDigestSha256|taskId|editionId|generationSeed)>
export function deriveRunId(protocolDigestSha256, armId, taskId, editionId, generationSeed) {
  return `run:${sha256(`${protocolDigestSha256}|${armId}|${taskId}|${editionId}|${generationSeed}`)}`;
}
export function derivePairKey(protocolDigestSha256, taskId, editionId, generationSeed) {
  return `pair:${sha256(`${protocolDigestSha256}|${taskId}|${editionId}|${generationSeed}`)}`;
}

// In-memory materialization of the scheduled run records. Every record carries
// only identity fields and sealed digests (the L2 PAIRING_AND_INPUT_BINDING
// layer, minus the execution-time requestSha256 which does not exist pre-run).
export function materializeRunPlan(template) {
  const protocolDigestSha256 = template.protocol.protocolDigestSha256;
  const editionsById = Object.fromEntries(template.taskPartition.knowledgeEditions.map((e) => [e.editionId, e]));
  const runs = [];
  for (const arm of template.arms) {
    for (const task of template.taskPartition.tasks) {
      for (const editionId of arm.editions) {
        const edition = editionsById[editionId];
        if (!edition) throw new Error(`UNKNOWN_EDITION_ID: ${editionId}`);
        for (const generationSeed of template.generation.seeds) {
          runs.push({
            runId: deriveRunId(protocolDigestSha256, arm.armId, task.taskId, editionId, generationSeed),
            pairKey: derivePairKey(protocolDigestSha256, task.taskId, editionId, generationSeed),
            armId: arm.armId,
            modelProfileId: arm.modelProfileId,
            taskId: task.taskId,
            scenarioPairId: task.scenarioPairId,
            domainId: task.domainId,
            hopClass: task.hopClass,
            updateSensitivity: task.updateSensitivity,
            editionId,
            editionSha256: edition.editionSha256,
            taskPromptCoreSha256: task.taskPromptCoreSha256,
            goldRecordSha256: task.goldRecordSha256[editionId],
            evidenceGraphSha256: task.evidenceGraphSha256[editionId],
            canonicalFactInventorySha256: edition.canonicalFactInventorySha256,
            generationSeed,
          });
        }
      }
    }
  }
  return runs;
}

const deepEqual = (a, b) => canonical(a) === canonical(b);

// Total validator: returns [] when the fixture is fully bound, otherwise the
// list of fail-closed rejection reasons (codes are prefixed, stable strings).
export function validateHiddenRunFixture(template, sources) {
  const errors = [];
  const check = (cond, code, detail) => {
    if (!cond) errors.push(`${code}: ${detail}`);
  };
  const l1 = sources.l1Manifest;
  const catalog = sources.catalog;

  // Protocol source binding: recompute from the approved design decision.
  const receiptSha = sha256(sources.decisionBytes);
  check(
    receiptSha === template.protocol.decisionReceipt.sha256,
    "RECEIPT_DIGEST_DRIFT",
    `decision receipt byte digest is ${receiptSha}, fixture pins ${template.protocol.decisionReceipt.sha256}`,
  );
  let protocolDigest = null;
  try {
    protocolDigest = sha256(canonical(JSON.parse(sources.decisionBytes.toString("utf8"))));
  } catch {
    errors.push("RECEIPT_MALFORMED: decision receipt bytes are not parseable JSON");
  }
  if (protocolDigest !== null) {
    check(
      protocolDigest === template.protocol.protocolDigestSha256,
      "PROTOCOL_DIGEST_DRIFT",
      `protocol canonical digest is ${protocolDigest}, fixture pins ${template.protocol.protocolDigestSha256}`,
    );
  }

  // L1 manifest binding: the template extends the L1 contract, never diverges.
  check(
    l1.manifestId === template.l1Manifest.manifestId,
    "L1_MANIFEST_MISMATCH",
    `l1Manifest.manifestId ${template.l1Manifest.manifestId} does not match ${l1.manifestId}`,
  );
  check(
    l1.protocol.protocolDigestSha256 === template.protocol.protocolDigestSha256,
    "L1_PROTOCOL_DIGEST_MISMATCH",
    "L1 and template protocol digests differ",
  );
  check(
    l1.protocol.decisionReceipt.sha256 === template.protocol.decisionReceipt.sha256,
    "L1_RECEIPT_DIGEST_MISMATCH",
    "L1 and template decision receipt digests differ",
  );

  // Public-safe catalog binding: sealed digests only, same partition.
  const catalogForDigest = { ...catalog, catalogDigestSha256: null };
  check(
    sha256(canonical(catalogForDigest)) === catalog.catalogDigestSha256,
    "CATALOG_DIGEST_DRIFT",
    "catalogDigestSha256 does not match the canonical digest over the catalog (with that field nulled)",
  );
  check(
    catalog.boundProtocol.protocolDigestSha256 === template.protocol.protocolDigestSha256,
    "CATALOG_PROTOCOL_MISMATCH",
    "catalog is bound to a different protocol digest",
  );
  check(
    catalog.boundProtocol.decisionReceiptSha256 === template.protocol.decisionReceipt.sha256,
    "CATALOG_RECEIPT_MISMATCH",
    "catalog is bound to a different decision receipt digest",
  );
  check(
    catalog.publicSafe.rawTaskBytesPublished === false &&
      catalog.publicSafe.rawKnowledgeSeedBytesPublished === false &&
      catalog.publicSafe.sealedDigestsOnly === true,
    "PUBLIC_SAFETY_VIOLATION",
    "catalog must publish sealed digests only; raw task or Knowledge seed bytes must remain hidden",
  );
  check(
    deepEqual(catalog.taskPartition, template.taskPartition),
    "PARTITION_MISMATCH",
    "catalog task partition differs from the template task partition",
  );

  // Partition structure: the fresh hidden 32-task partition.
  const partition = template.taskPartition;
  const tasks = partition.tasks;
  check(tasks.length === 32, "PARTITION_TASK_COUNT_DRIFT", `task count is ${tasks.length}, expected 32`);
  check(new Set(tasks.map((t) => t.taskId)).size === tasks.length, "PARTITION_TASK_ID_DUPLICATE", "duplicate taskId in partition");
  check(
    new Set(tasks.map((t) => t.scenarioPairId)).size === 16,
    "PARTITION_SCENARIO_PAIR_COUNT_DRIFT",
    "partition must span exactly 16 scenario pairs",
  );
  check(
    tasks.filter((t) => t.hopClass === "SINGLE_HOP").length === 16,
    "PARTITION_HOP_STRATA_DRIFT",
    "hop strata must be 16 SINGLE_HOP / 16 MULTI_HOP",
  );
  check(
    tasks.filter((t) => t.updateSensitivity === "UPDATE_SENSITIVE").length === 16,
    "PARTITION_UPDATE_SENSITIVITY_DRIFT",
    "update sensitivity must be 16 UPDATE_SENSITIVE / 16 EDITION_INVARIANT_CONTROL",
  );
  for (const t of tasks) {
    const digests = [
      t.taskPromptCoreSha256,
      t.goldRecordSha256.K0_STATIC,
      t.goldRecordSha256.K1_UPDATED,
      t.evidenceGraphSha256.K0_STATIC,
      t.evidenceGraphSha256.K1_UPDATED,
    ];
    check(
      digests.every((d) => typeof d === "string" && HEX64.test(d)),
      "PARTITION_DIGEST_SHAPE",
      `${t.taskId}: sealed digests must be lowercase sha256 hex`,
    );
    const sensitive = t.updateSensitivity === "UPDATE_SENSITIVE";
    const goldDiffers = t.goldRecordSha256.K0_STATIC !== t.goldRecordSha256.K1_UPDATED;
    const evidenceDiffers = t.evidenceGraphSha256.K0_STATIC !== t.evidenceGraphSha256.K1_UPDATED;
    check(
      goldDiffers === sensitive && evidenceDiffers === sensitive,
      "CROSS_EDITION_INVARIANT_DRIFT",
      `${t.taskId}: ${sensitive ? "update-sensitive task gold/evidence must differ across editions" : "edition-invariant control task gold/evidence must be identical across editions"}`,
    );
  }
  // Knowledge editions are the identical frozen editions admitted at L1.
  const k0 = partition.knowledgeEditions.find((e) => e.editionId === "K0_STATIC");
  const k1 = partition.knowledgeEditions.find((e) => e.editionId === "K1_UPDATED");
  check(
    k0 && k0.role === "FROZEN_PRE_UPDATE" &&
      k0.editionSha256 === l1.admission.knowledgeK0EditionSha256 &&
      k0.canonicalFactInventorySha256 === l1.admission.knowledgeK0CanonicalFactInventorySha256,
    "EDITION_BINDING_DRIFT",
    "K0_STATIC must be the L1-admitted frozen pre-update edition",
  );
  check(
    k1 && k1.role === "FROZEN_POST_UPDATE" &&
      k1.editionSha256 === l1.admission.knowledgeK1EditionSha256 &&
      k1.canonicalFactInventorySha256 === l1.admission.knowledgeK1CanonicalFactInventorySha256,
    "EDITION_BINDING_DRIFT",
    "K1_UPDATED must be the L1-admitted frozen post-update edition",
  );

  // Arms: the exact five approved arms, each bound to its L1-pinned profile,
  // and each running both Knowledge editions over the same partition.
  check(template.arms.length === EXPECTED_ARM_IDS.length, "ARM_SET_DRIFT", `arm count is ${template.arms.length}, expected 5`);
  check(
    deepEqual(template.arms.map((a) => a.armId).sort(), [...EXPECTED_ARM_IDS].sort()),
    "ARM_SET_DRIFT",
    `arm ids ${JSON.stringify(template.arms.map((a) => a.armId))} do not match the approved set`,
  );
  const l1Binding = new Map(l1.arms.map((a) => [a.armId, a.modelProfileId]));
  const l1Profiles = new Map(l1.modelProfiles.map((p) => [p.profileId, p]));
  for (const arm of template.arms) {
    check(
      l1Binding.get(arm.armId) === arm.modelProfileId,
      "ARM_PROFILE_MISMATCH",
      `${arm.armId} is bound to ${arm.modelProfileId}, L1 pins ${l1Binding.get(arm.armId)}`,
    );
    check(
      deepEqual(arm.editions, EDITION_IDS),
      "EDITION_SET_DRIFT",
      `${arm.armId} must run exactly the editions ${JSON.stringify(EDITION_IDS)}`,
    );
    const profile = l1Profiles.get(arm.modelProfileId);
    check(profile !== undefined, "ARM_PROFILE_MISMATCH", `${arm.armId} references unknown profile ${arm.modelProfileId}`);
    if (profile) {
      const expectedSha = profile.role === "SMALL" ? l1.admission.smallModelSha256 : l1.admission.largeModelSha256;
      check(
        profile.sha256 === expectedSha,
        "MODEL_BYTE_IDENTITY_DRIFT",
        `${arm.armId}: profile ${arm.modelProfileId} model bytes drifted from L1 admission`,
      );
    }
  }

  // Generation seeds: identical to L1, list digest recomputed.
  check(
    deepEqual(template.generation.seeds, l1.generation.seeds),
    "SEED_DRIFT",
    "generation seeds differ from the L1-admitted list",
  );
  check(
    sha256(canonical(template.generation.seeds)) === template.generation.seedListSha256,
    "SEED_LIST_DIGEST_DRIFT",
    "seedListSha256 does not match the canonical digest of the seed list",
  );
  check(
    template.generation.seedListSha256 === l1.generation.generationSeedListSha256,
    "SEED_LIST_DIGEST_MISMATCH",
    "seed list digest differs from L1 admission",
  );

  // Operating model: preserved decisions, no new process variant.
  check(
    template.operatingModel.version === l1.protocol.operatingModelVersion &&
      deepEqual(template.operatingModel.preservedDecisionIds, l1.protocol.preservedDecisionIds) &&
      template.operatingModel.processVariantIntroduced === false,
    "OPERATING_MODEL_DRIFT",
    "operating model must preserve D-001..D-007 without introducing a process variant",
  );

  // Execution mode: ephemeral, in-memory, no model, no artifacts.
  const em = template.executionMode;
  check(
    em.mode === "EPHEMERAL_IN_MEMORY" &&
      em.persistedRunPlan === false &&
      em.modelInvocation === false &&
      em.executionAuthorized === false &&
      em.writeRunArtifacts === false,
    "EXECUTION_MODE_NOT_EPHEMERAL",
    "execution mode must be EPHEMERAL_IN_MEMORY with no model invocation, no authorization, no artifacts",
  );

  // Claim gate: fail-closed before execution.
  const cg = template.claimGate;
  check(
    cg.gateId === "L6-MODEL-SUBSTITUTION" &&
      cg.preExecutionStatus === "DENY_NOT_EXECUTED" &&
      cg.modelSubstitutionClaimBeforeExecution === false &&
      cg.noEarlySuccess === true,
    "CLAIM_GATE_NOT_DENY",
    "claim gate must be L6-MODEL-SUBSTITUTION with pre-execution status DENY_NOT_EXECUTED",
  );

  // Failure contract: preserved taxonomy and append-only preservation rule.
  const fc = template.failureContract;
  check(fc.preExecutionPlannedStatus === "NOT_RUN", "FAILURE_STATUS_DRIFT", "pre-execution planned status must be NOT_RUN");
  check(
    deepEqual(fc.terminalStatuses, TERMINAL_STATUSES),
    "TERMINAL_STATUS_DRIFT",
    "terminal statuses must be exactly COMPLETED/FAILED/INVALIDATED",
  );
  check(
    fc.failureCodeNullOnlyWhenCompleted === true,
    "FAILURE_PRESERVATION_DRIFT",
    "failureCode must be null only when COMPLETED",
  );
  check(
    deepEqual([...fc.modelFailureCodes].sort(), [...MODEL_FAILURE_CODES].sort()),
    "FAILURE_TAXONOMY_DRIFT",
    "model failure codes drifted from the approved taxonomy",
  );
  check(
    deepEqual([...fc.infrastructureInvalidationCodes].sort(), [...INFRA_INVALIDATION_CODES].sort()),
    "FAILURE_TAXONOMY_DRIFT",
    "infrastructure invalidation codes drifted from the approved taxonomy",
  );
  check(
    fc.preservationRule === "APPEND_ONLY_NO_REPLACEMENT_RUNS",
    "FAILURE_PRESERVATION_DRIFT",
    "run preservation must be append-only with no replacement runs",
  );

  // Run-plan arithmetic: declared counts must equal the recomputed product.
  const c = template.runPlan.scheduledCounts;
  const armCount = template.arms.length;
  const taskCount = tasks.length;
  const editionCount = partition.knowledgeEditions.length;
  const seedCount = template.generation.seeds.length;
  check(
    c.arms === armCount &&
      c.taskIdsPerEdition === taskCount &&
      c.knowledgeEditions === editionCount &&
      c.generationSeeds === seedCount,
    "RUN_COUNT_DRIFT",
    "declared scheduledCounts disagree with the fixture's actual arms/tasks/editions/seeds",
  );
  check(
    c.totalScheduledRunRecords === armCount * taskCount * editionCount * seedCount,
    "RUN_COUNT_DRIFT",
    `totalScheduledRunRecords ${c.totalScheduledRunRecords} != ${armCount}x${taskCount}x${editionCount}x${seedCount}`,
  );
  check(c.totalScheduledRunRecords === 960, "RUN_COUNT_DRIFT", `totalScheduledRunRecords must be 960, is ${c.totalScheduledRunRecords}`);
  check(
    c.pairedExecutionsPerArmContrastPerEdition === taskCount * seedCount &&
      c.independentTaskUnitsPerArmContrastPerEdition === taskCount,
    "RUN_COUNT_DRIFT",
    "arm-contrast paired executions / independent task units drifted",
  );
  check(
    c.pairedExecutionsPerSingleMultiContrastPerArmEdition === 16 * seedCount &&
      c.independentScenarioPairUnitsPerSingleMultiContrastPerArmEdition === 16,
    "RUN_COUNT_DRIFT",
    "single/multi-hop paired executions / independent scenario-pair units drifted",
  );
  check(
    template.runPlan.distinctPairKeys === taskCount * editionCount * seedCount &&
      template.runPlan.runsPerPairKey === armCount,
    "PAIR_KEY_COUNT_DRIFT",
    "pair key arithmetic drifted: distinctPairKeys = tasks x editions x seeds, runsPerPairKey = arms",
  );
  check(
    template.runPlan.derivation.runId === "run:<sha256(protocolDigestSha256|armId|taskId|editionId|generationSeed)>" &&
      template.runPlan.derivation.pairKey === "pair:<sha256(protocolDigestSha256|taskId|editionId|generationSeed)>",
    "DERIVATION_CONTRACT_DRIFT",
    "runId/pairKey derivation contract strings drifted from the approved design",
  );

  // Materialized plan invariants.
  try {
    const plan = materializeRunPlan(template);
    check(plan.length === 960, "PLAN_COUNT_DRIFT", `materialized plan has ${plan.length} runs, expected 960`);
    check(new Set(plan.map((r) => r.runId)).size === plan.length, "PLAN_RUN_ID_DUPLICATE", "runId collision in materialized plan");
    const byPair = new Map();
    for (const r of plan) {
      const group = byPair.get(r.pairKey);
      if (group) group.push(r);
      else byPair.set(r.pairKey, [r]);
    }
    check(byPair.size === taskCount * editionCount * seedCount, "PLAN_PAIR_KEY_COUNT_DRIFT", `plan has ${byPair.size} distinct pair keys, expected ${taskCount * editionCount * seedCount}`);
    let pairDrift = false;
    for (const [pairKey, group] of byPair) {
      const armIds = new Set(group.map((r) => r.armId));
      const shared = group[0];
      const consistent =
        group.length === armCount &&
        armIds.size === armCount &&
        group.every(
          (r) =>
            r.taskId === shared.taskId &&
            r.editionId === shared.editionId &&
            r.generationSeed === shared.generationSeed &&
            r.taskPromptCoreSha256 === shared.taskPromptCoreSha256 &&
            r.goldRecordSha256 === shared.goldRecordSha256 &&
            r.evidenceGraphSha256 === shared.evidenceGraphSha256 &&
            r.canonicalFactInventorySha256 === shared.canonicalFactInventorySha256,
        );
      if (!consistent) pairDrift = true;
      if (pairDrift) break;
    }
    check(!pairDrift, "PLAN_PAIR_BINDING_DRIFT", "a pair key does not span exactly the five arms with identical task/edition inputs");
    check(
      new Set(plan.map((r) => `${r.armId}|${r.taskId}|${r.editionId}|${r.generationSeed}`)).size === plan.length,
      "PLAN_BLOCKING_UNIT_DRIFT",
      "blocking unit (armId x taskId x editionId x generationSeed) is not unique per run",
    );
  } catch (err) {
    errors.push(`PLAN_MATERIALIZATION_FAILED: ${err.message}`);
  }

  // Receipt: pre-execution verdict and zero actions.
  check(
    template.receipt.currentEvidenceVerdict === EXPECTED_RECEIPT_VERDICT,
    "RECEIPT_VERDICT_DRIFT",
    "receipt verdict must be the pre-execution no-claim verdict",
  );
  check(
    template.receipt.taskId === "PSAI285-L2-FRESH-HIDDEN-TASK-RUNNER",
    "RECEIPT_TASK_DRIFT",
    "receipt taskId must be PSAI285-L2-FRESH-HIDDEN-TASK-RUNNER",
  );
  check(
    template.receipt.actionsNotPerformed.modelInvocations === 0 &&
      template.receipt.actionsNotPerformed.benchmarkRuns === 0,
    "RECEIPT_ACTIONS_DRIFT",
    "receipt must record zero model invocations and zero benchmark runs",
  );

  return errors;
}

function fail(exitCode, code, detail) {
  process.stderr.write(`${code}${detail ? `: ${detail}` : ""}\n`);
  process.exit(exitCode);
}

function main() {
  const argv = process.argv.slice(2);
  let fixturePath = null;
  let dryRun = false;
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--dry-run") {
      dryRun = true;
    } else if (a === "--fixture") {
      if (i + 1 >= argv.length) fail(2, "MISSING_FIXTURE_PATH", "--fixture requires a path");
      fixturePath = argv[++i];
    } else if (a === "--help" || a === "-h") {
      process.stdout.write(
        "usage: cks-05-materialize-hidden-run.mjs --fixture <path> --dry-run\n",
      );
      process.exit(0);
      return;
    } else {
      fail(2, "UNKNOWN_FLAG", a);
    }
  }
  if (!fixturePath) fail(2, "MISSING_FIXTURE", "usage: cks-05-materialize-hidden-run.mjs --fixture <path> --dry-run");
  if (!dryRun) {
    fail(3, "EXECUTION_NOT_AUTHORIZED", "only --dry-run in-memory materialization is authorized (NOT_GRANTED_DESIGN_RECEIPT_ONLY)");
  }

  const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
  const safeRepoPath = (p) => {
    const file = resolve(root, p);
    if (!file.startsWith(`${root}${sep}`)) fail(2, "UNSAFE_FIXTURE_PATH", p);
    return file;
  };

  let template;
  try {
    template = JSON.parse(readFileSync(safeRepoPath(fixturePath), "utf8"));
  } catch (err) {
    fail(2, "FIXTURE_READ_FAILED", err.message);
  }
  let l1Manifest, catalog, decisionBytes;
  try {
    l1Manifest = JSON.parse(readFileSync(safeRepoPath(template.l1Manifest.path), "utf8"));
    catalog = JSON.parse(readFileSync(safeRepoPath(template.publicSafeEvidence.catalogPath), "utf8"));
    decisionBytes = readFileSync(safeRepoPath(template.protocol.decisionReceipt.path));
  } catch (err) {
    fail(2, "FIXTURE_SOURCE_READ_FAILED", err.message);
  }

  const errors = validateHiddenRunFixture(template, { l1Manifest, catalog, decisionBytes });
  if (errors.length > 0) {
    process.stderr.write("HIDDEN_RUN_PLAN_REJECTED\n");
    for (const e of errors) process.stderr.write(`${e}\n`);
    process.exit(1);
  }

  // Deterministic double materialization: the plan must be exactly reproducible
  // in memory with no side effects.
  const plan = materializeRunPlan(template);
  const planDigest = sha256(canonical(plan));
  const planDigestAgain = sha256(canonical(materializeRunPlan(structuredClone(template))));
  if (planDigest !== planDigestAgain) {
    fail(1, "PLAN_NOT_DETERMINISTIC", "two in-memory materializations produced different plans");
  }

  const byPair = new Map();
  for (const r of plan) {
    const group = byPair.get(r.pairKey);
    if (group) group.push(r);
    else byPair.set(r.pairKey, [r]);
  }

  const receipt = {
    status: "DRY_RUN_OK",
    templateId: template.templateId,
    taskId: template.taskId,
    executionMode: template.executionMode.mode,
    modelInvocations: 0,
    benchmarkRuns: 0,
    claimGate: { gateId: template.claimGate.gateId, preExecutionStatus: template.claimGate.preExecutionStatus },
    crossArmIdentity: {
      sameHiddenTaskPartition: true,
      knowledgeEditions: EDITION_IDS,
      arms: template.arms.map((a) => a.armId),
    },
    arithmetic: {
      arms: template.arms.length,
      tasks: template.taskPartition.tasks.length,
      editions: template.taskPartition.knowledgeEditions.length,
      seeds: template.generation.seeds.length,
      totalScheduledRunRecords: plan.length,
      distinctPairKeys: byPair.size,
      runsPerPairKey: template.arms.length,
    },
    digests: {
      protocolDigestSha256: template.protocol.protocolDigestSha256,
      decisionReceiptSha256: template.protocol.decisionReceipt.sha256,
      catalogDigestSha256: catalog.catalogDigestSha256,
      planDigestSha256: planDigest,
    },
    evidenceVerdict: template.receipt.currentEvidenceVerdict,
  };
  process.stdout.write(`${JSON.stringify(receipt, null, 2)}\n`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}