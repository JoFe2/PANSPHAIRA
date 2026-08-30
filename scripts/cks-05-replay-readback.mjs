#!/usr/bin/env node
// CKS-05 L6: deterministic evidence replay/readback.
//
// This layer joins the already-approved L1 manifest, L2 hidden-run template,
// L3 ablation matrix/parity fabric, and L4 executor fixture. It revalidates
// each binding, replays the executor through the existing deterministic scorer,
// and renders a public-safe report. It never invokes a model, starts a service,
// writes a run artifact, or turns partial evidence into a substitution claim.
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { dirname, resolve, sep } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import {
  canonical as canonicalL2,
  materializeRunPlan,
  validateHiddenRunFixture,
} from "./cks-05-materialize-hidden-run.mjs";
import {
  buildArmInputs,
  validateAblationMatrix,
} from "./cks-05-build-arm-inputs.mjs";
import { orchestratePairedRuns } from "./run-cks-05-benchmark.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const DEFAULT_ROOT = resolve(HERE, "..");
const HEX64 = /^[a-f0-9]{64}$/;
const ARM_IDS = ["ARM-LRF-01", "ARM-SRF-02", "ARM-LSF-03", "ARM-SSF-04", "ARM-SSG-05"];
const EDITION_IDS = ["K0_STATIC", "K1_UPDATED"];
const REQUIRED_COMPARISONS = [
  "AB-MODEL-RAW",
  "AB-MODEL-STRUCTURED",
  "AB-STRUCTURED-VS-RAW-LARGE",
  "AB-STRUCTURED-VS-RAW-SMALL",
  "AB-FACTS-VS-GUIDANCE-SMALL",
  "AB-STATIC-VS-UPDATED",
  "AB-SINGLE-VS-MULTI-HOP",
];
const COMPARISON_AXES = {
  "AB-MODEL-RAW": "model-large-vs-small-raw",
  "AB-MODEL-STRUCTURED": "model-large-vs-small-structured",
  "AB-STRUCTURED-VS-RAW-LARGE": "structured-vs-raw-large",
  "AB-STRUCTURED-VS-RAW-SMALL": "structured-vs-raw-small",
  "AB-FACTS-VS-GUIDANCE-SMALL": "facts-vs-non-answer-guidance",
  "AB-STATIC-VS-UPDATED": "static-vs-updated",
  "AB-SINGLE-VS-MULTI-HOP": "single-vs-multi-hop",
};
const PUBLIC_HEADINGS = [
  "## Evidence chain",
  "## A/B results",
  "## Per-arm results and score aggregates",
  "## Stop conditions and simplification",
  "## Substitution claim guard",
  "## Public-safety boundary",
];

export const sha256 = (value) => createHash("sha256").update(value).digest("hex");
export const canonical = canonicalL2;
export const digest = (value) => sha256(typeof value === "string" || Buffer.isBuffer(value) ? value : canonical(value));

function safePath(root, relativePath) {
  if (typeof relativePath !== "string" || relativePath.length === 0) throw new Error("UNSAFE_SOURCE_PATH: path is required");
  const file = resolve(root, relativePath);
  if (!file.startsWith(`${root}${sep}`)) throw new Error(`UNSAFE_SOURCE_PATH: ${relativePath}`);
  return file;
}

function readJson(root, relativePath) {
  return JSON.parse(readFileSync(safePath(root, relativePath), "utf8"));
}

export function loadReadbackFixture(relativePath, root = DEFAULT_ROOT) {
  return readJson(root, relativePath);
}

function requiredPath(errors, source, label) {
  if (!source || typeof source !== "object" || typeof source.path !== "string") errors.push(`${label}_PATH_MISSING`);
}

export function validateReadbackFixture(fixture) {
  const errors = [];
  const fail = (code, detail) => errors.push(`${code}: ${detail}`);
  if (!fixture || typeof fixture !== "object" || Array.isArray(fixture)) return ["FIXTURE_NOT_OBJECT"];
  if (fixture.schemaVersion !== "chimpmaera.cks05/public-readback-fixture/v1") fail("SCHEMA_VERSION", "unsupported public readback fixture");
  if (fixture.fixtureId !== "CKS05-PUBLIC-READBACK-V1") fail("FIXTURE_ID", "unexpected public readback fixture");
  if (!fixture.evidenceChain || typeof fixture.evidenceChain !== "object") return ["EVIDENCE_CHAIN_MISSING"];
  for (const [key, label] of [
    ["l1Manifest", "L1_MANIFEST"],
    ["l2HiddenRunTemplate", "L2_TEMPLATE"],
    ["l3AblationMatrix", "L3_MATRIX"],
    ["l3ParityFabric", "L3_FABRIC"],
    ["l4ExecutorFixture", "L4_EXECUTOR"],
    ["l2PublicCatalog", "L2_CATALOG"],
    ["decisionReceipt", "DECISION_RECEIPT"],
  ]) requiredPath(errors, fixture.evidenceChain[key], label);
  if (fixture.evidenceChain.l1Manifest?.manifestId !== "CKS-05-BENCHMARK-MANIFEST-V1-PSAI285-L1-20260828") fail("L1_BINDING", "unexpected L1 manifest id");
  if (fixture.evidenceChain.l2HiddenRunTemplate?.templateId !== "CKS-05-HIDDEN-RUN-MANIFEST-TEMPLATE-V1") fail("L2_BINDING", "unexpected L2 template id");
  if (fixture.evidenceChain.l3AblationMatrix?.matrixId !== "CKS05-ABLATION-MATRIX-V1") fail("L3_BINDING", "unexpected L3 matrix id");
  if (fixture.evidenceChain.l3ParityFabric?.fabricId !== "CKS05-RAW-FABRIC-PARITY-V1") fail("L3_BINDING", "unexpected L3 parity fabric id");
  if (fixture.evidenceChain.l4ExecutorFixture?.fixtureId !== "CKS05-EXECUTOR-GOLDEN-V1") fail("L4_BINDING", "unexpected L4 executor fixture id");
  if (fixture.evidenceChain.l2PublicCatalog?.catalogId !== "CKS05-PUBLIC-TASK-CATALOG-V1") fail("CATALOG_BINDING", "unexpected public catalog id");
  if (fixture.reportTemplatePath !== "docs/benchmarks/cks-05-falsification-report-template-v1.md") fail("REPORT_TEMPLATE_BINDING", "unexpected report template path");
  const safe = fixture.publicSafeContract;
  if (safe?.rawTaskBytesPublished !== false || safe?.rawKnowledgeSeedBytesPublished !== false || safe?.rawRenderingBytesPublished !== false || safe?.sealedDigestsOnly !== true) {
    fail("PUBLIC_SAFETY_DRIFT", "raw task, Knowledge, and rendering bytes must remain unpublished");
  }
  if (safe?.preserveRunIdsAndFailureCodes !== true) fail("FAILURE_PRESERVATION_DRIFT", "run ids and failure codes must be preserved");
  if (safe?.substitutionClaimRequiresQualityAndEfficiency !== true) fail("CLAIM_GUARD_DRIFT", "quality and efficiency are jointly required");
  if (fixture.reportId !== "CKS05-PUBLIC-FALSIFICATION-READBACK-V1") fail("REPORT_ID", "unexpected report id");
  if (JSON.stringify(fixture.requiredComparisons) !== JSON.stringify(REQUIRED_COMPARISONS)) fail("COMPARISON_SET_DRIFT", "required A/B comparison set is incomplete or reordered");
  return errors;
}

function sourceDescriptor(root, entry, label) {
  const path = safePath(root, entry.path);
  const bytes = readFileSync(path);
  return { label, path: entry.path, sha256: sha256(bytes) };
}

function validateL1(manifest, fixture) {
  const errors = [];
  const fail = (detail) => errors.push(`L1 manifest binding mismatch: ${detail}`);
  if (manifest.manifestId !== fixture.evidenceChain.l1Manifest.manifestId) fail("manifest id");
  if (manifest.protocol?.protocolId !== "PSAI285-BENCHMARK-PROTOCOL-01") fail("protocol id");
  if (manifest.protocol?.operatingModelVersion !== "Operating Model v1.1") fail("operating model version");
  if (JSON.stringify(manifest.protocol?.preservedDecisionIds) !== JSON.stringify(["D-001", "D-002", "D-003", "D-004", "D-005", "D-006", "D-007"])) fail("preserved decisions");
  if (manifest.protocol?.processVariantIntroduced !== false) fail("process variant");
  if (manifest.admission?.timingClockId !== "CLOCK_MONOTONIC_RAW") fail("timing clock");
  if (manifest.runPlan?.scheduledCounts?.totalScheduledRunRecords !== 960) fail("scheduled count");
  if (manifest.arms?.length !== ARM_IDS.length || JSON.stringify(manifest.arms.map((arm) => arm.armId)) !== JSON.stringify(ARM_IDS)) fail("arm order/set");
  return errors;
}

function validateExecutorBinding(executor, manifest) {
  const errors = [];
  const fail = (detail) => errors.push(`L4 executor binding mismatch: ${detail}`);
  if (executor.protocol?.protocolDigestSha256 !== manifest.protocol?.protocolDigestSha256) fail("protocol digest");
  if (JSON.stringify(executor.generation?.seeds) !== JSON.stringify(manifest.generation?.seeds)) fail("generation seeds");
  if (JSON.stringify(executor.arms?.map((arm) => arm.armId)) !== JSON.stringify(ARM_IDS)) fail("arm order/set");
  const manifestProfiles = new Map(manifest.arms.map((arm) => [arm.armId, arm.modelProfileId]));
  for (const arm of executor.arms ?? []) if (manifestProfiles.get(arm.armId) !== arm.modelProfileId) fail(`${arm.armId} model profile`);
  for (const edition of executor.freshDomain?.knowledgeEditions ?? []) {
    const admitted = manifest.admission?.[edition.editionId === "K0_STATIC" ? "knowledgeK0EditionSha256" : "knowledgeK1EditionSha256"];
    if (edition.editionSha256 !== admitted) fail(`${edition.editionId} edition digest`);
  }
  if (executor.schedule?.expectedRunCount !== 120) fail("replay schedule count");
  return errors;
}

function aggregatePerArm(result) {
  return Object.fromEntries(ARM_IDS.map((armId) => {
    const records = result.runScores.filter((record) => record.armId === armId && record.scored);
    const metricIds = [...new Set(records.flatMap((record) => Object.keys(record.metrics ?? {})))].sort();
    const metrics = Object.fromEntries(metricIds.map((metricId) => {
      const values = records.map((record) => record.metrics?.[metricId]).filter((value) => Number.isFinite(value));
      return [metricId, { pointEstimate: values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null, denominator: values.length, missingValueCount: records.length - values.length }];
    }));
    return [armId, { ...result.runCounts.byArm[armId], scoreAggregates: metrics }];
  }));
}

function publicComparisons(result) {
  return result.comparisons.map((comparison) => ({
    reportId: comparison.reportId,
    axis: COMPARISON_AXES[comparison.reportId] ?? "unspecified",
    treatmentArmId: comparison.treatmentArmId,
    controlArmId: comparison.controlArmId,
    metricId: comparison.metricId,
    pointEstimate: comparison.pointEstimate,
    confidenceInterval: comparison.confidenceInterval,
    pairedUnitCount: comparison.pairedUnitCount,
    status: comparison.status,
  }));
}

function publicFailures(result) {
  return result.failures.map((failure) => ({
    runId: failure.runId,
    armId: failure.armId,
    taskId: failure.taskId,
    terminalStatus: failure.terminalStatus,
    failureCodeOrNull: failure.failureCodeOrNull,
    preserved: failure.preserved,
    productVerdict: failure.productVerdict,
  }));
}

function publicStopConditions(result) {
  const ruleIds = [...result.stopConditions.ruleIds];
  return {
    triggered: result.stopConditions.triggered,
    ruleIds,
    reasonCodes: [...result.stopConditions.reasonCodes],
    falsification: {
      ruleId: "FALSIFY-SUBSTITUTION",
      triggered: ruleIds.includes("FALSIFY-SUBSTITUTION"),
      effect: "FALSIFY_SUBSTITUTION_CLAIM",
      architectureQualityVerdict: result.stopConditions.falsifiedArchitecture ? "FALSIFIED" : "NOT_FALSIFIED_BY_INFRASTRUCTURE_FAILURE",
    },
    simplifications: [...result.stopConditions.simplifications],
    simplificationRuleEffects: [
      "SIMPLIFY-STRUCTURE",
      "SIMPLIFY-GUIDANCE",
      "SIMPLIFY-UPDATES",
      "SIMPLIFY-MULTI-HOP",
    ].map((ruleId) => ({ ruleId, effect: "SIMPLIFY_ARCHITECTURE_ONLY_AFTER_COMPLETE_VALID_EVIDENCE" })),
  };
}

function publicClaimGuard(result) {
  return {
    gateId: "L6-MODEL-SUBSTITUTION",
    status: "DENY",
    modelSubstitutionClaim: false,
    completeSchedule: result.runCounts.missing === 0 && result.runCounts.failed === 0 && result.runCounts.invalidated === 0,
    allRequiredComparisonsMeasured: REQUIRED_COMPARISONS.every((id) => result.comparisons.find((comparison) => comparison.reportId === id)?.status === "MEASURED"),
    qualityThresholdsPass: false,
    efficiencyThresholdsPass: false,
    requiredEvidence: [
      "complete schedule",
      "all required A/B cells",
      "available 95% confidence intervals",
      "all quality thresholds pass",
      "all efficiency thresholds pass",
    ],
    reasonCodes: [...result.claimGate.reasonCodes, "QUALITY_AND_EFFICIENCY_THRESHOLDS_NOT_BOTH_PROVEN"],
    passingWording: null,
  };
}

function reportNumber(value) {
  return value === null || value === undefined ? "not available" : String(value);
}

export function renderPublicReport(readback) {
  const lines = [
    "# CKS-05 public-safe falsification report",
    "",
    `Report id: \`${readback.reportId}\``,
    "",
    "This is a deterministic evidence replay/readback. It is not a model-substitution claim.",
    "",
    "## Evidence chain",
    "",
    `Chain status: **${readback.status}**. All source bindings and recomputed stage digests validated.`,
    `Operating model: **Operating Model v1.1**; preserved decisions: **D-001 through D-007**; process variant introduced: **false**.`,
    ...readback.chain.stages.map((stage) => `- ${stage.id}: ${stage.status}; records=${stage.recordCount}; digest=\`${stage.digestSha256}\`.`),
    "",
    "## A/B results",
    "",
    "Point estimates are accompanied by the declared 95% confidence interval metadata. Generation seeds are repeated observations, not independent task units.",
    "The required A/B axes are structured versus raw, facts versus non-answer guidance, static versus updated, and single-hop versus multi-hop.",
    ...readback.comparisons.map((comparison) => {
      const ci = comparison.confidenceInterval;
      return `- **${comparison.axis}** (${comparison.reportId}): treatment \`${comparison.treatmentArmId}\` vs control \`${comparison.controlArmId}\`; estimate=${reportNumber(comparison.pointEstimate)}; 95% CI=${ci.available ? `[${reportNumber(ci.lower)}, ${reportNumber(ci.upper)}]` : "not available"}; resampling=${ci.resamplingUnit} (${ci.resamplingUnitCount} independent units); paired runs=${comparison.pairedUnitCount}; status=${comparison.status}.`;
    }),
    "",
    "## Per-arm results and score aggregates",
    "",
    ...Object.entries(readback.perArm).map(([armId, counts]) => `- **${armId}**: scheduled=${counts.scheduled}, observed=${counts.observed}, completed=${counts.completed}, failed=${counts.failed}, invalidated=${counts.invalidated}, scored=${counts.scored}.`),
    `- Overall scored task-success estimate=${reportNumber(readback.scoreAggregates.task_success?.pointEstimate)}; denominator=${readback.scoreAggregates.task_success?.denominator}; 95% CI=${readback.scoreAggregates.task_success?.confidenceInterval?.available ? `[${readback.scoreAggregates.task_success.confidenceInterval.lower}, ${readback.scoreAggregates.task_success.confidenceInterval.upper}]` : "not available"}.`,
    "- Score aggregates are public-safe summaries; individual prompts, gold records, responses, and final answers are not published.",
    "",
    "## Preserved failures",
    "",
    ...readback.failures.map((failure) => `- \`${failure.runId}\` ${failure.armId}/${failure.taskId}: ${failure.terminalStatus} (${failure.failureCodeOrNull}); preserved=${failure.preserved}; ${failure.productVerdict}.`),
    "",
    "## Stop conditions and simplification",
    "",
    `Triggered rules: ${readback.stopConditions.ruleIds.length ? readback.stopConditions.ruleIds.join(", ") : "none"}.`,
    `Substitution falsification guard: ${readback.stopConditions.falsification.triggered ? "triggered; the substitution claim is denied" : "not triggered"}.`,
    `Architecture-quality interpretation: ${readback.stopConditions.falsification.architectureQualityVerdict}.`,
    ...readback.stopConditions.simplifications.map((entry) => `- ${entry}.`),
    "Stop conditions may falsify a claim or authorize a declared simplification; this replay does not convert infrastructure invalidation into a product-quality verdict.",
    "",
    "## Substitution claim guard",
    "",
    `Claim status: **${readback.claimGuard.status}**; modelSubstitutionClaim=${readback.claimGuard.modelSubstitutionClaim}.`,
    "No claim is allowed unless quality and efficiency threshold families both pass, with complete valid evidence and all required A/B cells.",
    `Blocking reasons: ${readback.claimGuard.reasonCodes.join(", ")}.`,
    "",
    "## Public-safety boundary",
    "",
    "Sealed digests, identifiers, aggregate statistics, uncertainty metadata, failure metadata, and decision-state text only. Raw task bytes, raw Knowledge seed bytes, and RAW/STRUCTURED rendering bytes remain hidden.",
    "",
  ];
  return lines.join("\n");
}

export function replayReadback(fixture, root = DEFAULT_ROOT) {
  const fixtureErrors = validateReadbackFixture(fixture);
  if (fixtureErrors.length) throw new Error(`FAIL_CLOSED_READBACK_REJECTED: ${fixtureErrors.join("; ")}`);
  let sources;
  try {
    const chain = fixture.evidenceChain;
    sources = {
      manifest: readJson(root, chain.l1Manifest.path),
      hiddenTemplate: readJson(root, chain.l2HiddenRunTemplate.path),
      matrix: readJson(root, chain.l3AblationMatrix.path),
      fabric: readJson(root, chain.l3ParityFabric.path),
      executor: readJson(root, chain.l4ExecutorFixture.path),
      catalog: readJson(root, chain.l2PublicCatalog.path),
      decisionBytes: readFileSync(safePath(root, chain.decisionReceipt.path)),
      reportTemplate: readFileSync(safePath(root, fixture.reportTemplatePath), "utf8"),
    };
  } catch (error) {
    throw new Error(`FAIL_CLOSED_READBACK_REJECTED: source read failed: ${error.message}`);
  }

  const validationErrors = [
    ...validateL1(sources.manifest, fixture),
    ...validateHiddenRunFixture(sources.hiddenTemplate, { l1Manifest: sources.manifest, catalog: sources.catalog, decisionBytes: sources.decisionBytes }),
    ...validateAblationMatrix(sources.matrix, { l1Manifest: sources.manifest, l2Template: sources.hiddenTemplate, fabric: sources.fabric, decisionBytes: sources.decisionBytes }),
    ...validateExecutorBinding(sources.executor, sources.manifest),
  ];
  for (const heading of PUBLIC_HEADINGS) if (!sources.reportTemplate.includes(heading)) validationErrors.push(`REPORT_TEMPLATE_INCOMPLETE: missing ${heading}`);
  if (validationErrors.length) throw new Error(`FAIL_CLOSED_READBACK_REJECTED: ${validationErrors.join("; ")}`);

  let l2Plan;
  let l3Inputs;
  try {
    l2Plan = materializeRunPlan(sources.hiddenTemplate);
    const l2PlanAgain = materializeRunPlan(structuredClone(sources.hiddenTemplate));
    if (digest(l2Plan) !== digest(l2PlanAgain)) throw new Error("L2 plan is not deterministic");
    l3Inputs = buildArmInputs(sources.matrix, sources.hiddenTemplate, sources.fabric);
    const l3InputsAgain = buildArmInputs(sources.matrix, structuredClone(sources.hiddenTemplate), sources.fabric);
    if (digest(l3Inputs) !== digest(l3InputsAgain)) throw new Error("L3 arm inputs are not deterministic");
  } catch (error) {
    throw new Error(`FAIL_CLOSED_READBACK_REJECTED: evidence materialization failed: ${error.message}`);
  }

  let result;
  try {
    result = orchestratePairedRuns(sources.executor);
  } catch (error) {
    throw new Error(`FAIL_CLOSED_READBACK_REJECTED: executor replay failed: ${error.message}`);
  }
  const comparisons = publicComparisons(result);
  const missingComparisons = REQUIRED_COMPARISONS.filter((id) => !comparisons.some((comparison) => comparison.reportId === id));
  if (missingComparisons.length) throw new Error(`FAIL_CLOSED_READBACK_REJECTED: missing score aggregates ${missingComparisons.join(",")}`);

  const sourceDigests = [
    sourceDescriptor(root, fixture.evidenceChain.l1Manifest, "L1_MANIFEST"),
    sourceDescriptor(root, fixture.evidenceChain.l2HiddenRunTemplate, "L2_HIDDEN_RUN_TEMPLATE"),
    sourceDescriptor(root, fixture.evidenceChain.l3AblationMatrix, "L3_ABLATION_MATRIX"),
    sourceDescriptor(root, fixture.evidenceChain.l3ParityFabric, "L3_PARITY_FABRIC"),
    sourceDescriptor(root, fixture.evidenceChain.l4ExecutorFixture, "L4_EXECUTOR_FIXTURE"),
    sourceDescriptor(root, fixture.evidenceChain.l2PublicCatalog, "L2_PUBLIC_CATALOG"),
    sourceDescriptor(root, fixture.evidenceChain.decisionReceipt, "DECISION_RECEIPT"),
  ];
  const readback = {
    status: "READBACK_VALID",
    reportId: fixture.reportId,
    chain: {
      validationErrors: [],
      sourceDigests,
      stages: [
        { id: "L1_MANIFEST", status: "VALIDATED", recordCount: sources.manifest.arms.length, digestSha256: sourceDigests[0].sha256 },
        { id: "L2_HIDDEN_RUN_PLAN", status: "VALIDATED_AND_RECOMPUTED", recordCount: l2Plan.length, digestSha256: digest(l2Plan) },
        { id: "L3_ABLATION_INPUTS", status: "VALIDATED_AND_RECOMPUTED", recordCount: l3Inputs.length, digestSha256: digest(l3Inputs) },
        { id: "L4_PER_ARM_RESULTS", status: "REPLAYED_AND_VALIDATED", recordCount: result.runCounts.observed, digestSha256: digest(result.runScores.map(({ response, gold, ...record }) => record)) },
        { id: "L5_SCORE_AGGREGATES", status: "RECOMPUTED", recordCount: result.runCounts.scored, digestSha256: digest({ metrics: result.metrics, comparisons }) },
      ],
    },
    runCounts: result.runCounts,
    perArm: aggregatePerArm(result),
    scoreAggregates: result.metrics,
    comparisons,
    failures: publicFailures(result),
    stopConditions: publicStopConditions(result),
    claimGuard: publicClaimGuard(result),
    publicSafe: {
      rawTaskBytesPublished: false,
      rawKnowledgeSeedBytesPublished: false,
      rawRenderingBytesPublished: false,
      sealedDigestsOnly: true,
      exposureRule: "SEALED_DIGESTS_ONLY_RAW_TASK_AND_KNOWLEDGE_SEED_BYTES_REMAIN_HIDDEN",
    },
  };
  readback.reportDraft = renderPublicReport(readback);
  return readback;
}

function fail(exitCode, code, detail) {
  process.stderr.write(`${code}${detail ? `: ${detail}` : ""}\n`);
  process.exit(exitCode);
}

function main() {
  const argv = process.argv.slice(2);
  const fixtureIndex = argv.indexOf("--fixture");
  if (argv.includes("--help") || argv.includes("-h")) {
    process.stdout.write("usage: cks-05-replay-readback.mjs --fixture <path> --dry-run\n");
    return;
  }
  if (fixtureIndex < 0 || !argv[fixtureIndex + 1]) fail(2, "MISSING_FIXTURE", "--fixture requires a repository-relative path");
  if (!argv.includes("--dry-run")) fail(3, "EXECUTION_NOT_AUTHORIZED", "only --dry-run deterministic replay is authorized");
  if (argv.some((arg, index) => !["--fixture", "--dry-run"].includes(arg) && !(index === fixtureIndex + 1))) fail(2, "UNKNOWN_FLAG", "unsupported argument");
  const fixturePath = argv[fixtureIndex + 1];
  let fixture;
  try {
    fixture = loadReadbackFixture(fixturePath, DEFAULT_ROOT);
  } catch (error) {
    fail(2, "FIXTURE_READ_FAILED", error.message);
  }
  try {
    process.stdout.write(`${JSON.stringify(replayReadback(fixture, DEFAULT_ROOT), null, 2)}\n`);
  } catch (error) {
    fail(1, "READBACK_REJECTED", error.message);
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main();
