#!/usr/bin/env node
// CKS-05 L3: build deterministic, provenance-bound arm inputs for the PSAI285
// ablation comparison.
//
// Every arm input binds one (armId, taskId, editionId) triple to sealed
// digests only, so the retrieval-representation ablation (RAW vs STRUCTURED)
// and the Knowledge-condition ablation (FACTS_ONLY vs
// FACTS_AND_NON_ANSWER_GUIDANCE) are isolated while the task and edition
// identity stays byte-identical across each comparison. The 320 materialized
// inputs feed the 960-run L2 schedule (5 arms x 32 tasks x 2 editions x
// 3 seeds) without persisting anything.
//
// Binds: the approved decision receipt (protocol digest), the L1 benchmark
// manifest, the L2 hidden-run template (task partition, arms, contracts), and
// the raw-fabric parity fixture (per-edition rendering parity proof).
// No model is invoked, no input is persisted, and no benchmark is executed:
// execution authorization is NOT_GRANTED_DESIGN_RECEIPT_ONLY, so the only
// authorized mode is --dry-run, which validates the matrix, materializes the
// 320 arm inputs in memory, and prints a digest-only receipt.
//
// Usage:
//   node scripts/cks-05-build-arm-inputs.mjs --fixture <path> --dry-run
//
// Exit codes: 0 = dry-run OK; 1 = fail-closed rejection; 2 = usage error;
// 3 = execution requested but not authorized.
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { dirname, resolve, sep } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const EXPECTED_ARM_IDS = ["ARM-LRF-01", "ARM-SRF-02", "ARM-LSF-03", "ARM-SSF-04", "ARM-SSG-05"];
const EDITION_IDS = ["K0_STATIC", "K1_UPDATED"];
const GUIDANCE_ARM_ID = "ARM-SSG-05";
const GUIDANCE_PAYLOAD = "FACTS_AND_NON_ANSWER_GUIDANCE";
const EXPECTED_TASK_ID = "PSAI285-L3-ABLATION-ARM-BUILDER";
const EXPECTED_RECEIPT_VERDICT =
  "MANIFEST_DEFINED_EXECUTION_NOT_AUTHORIZED_NO_BENCHMARK_RESULT_NO_MODEL_SUBSTITUTION_CLAIM";
const PARITY_RULE =
  "SAME_CANONICAL_ATOMIC_FACT_INVENTORY_DIGEST_AND_EVIDENCE_IDS_FOR_RAW_AND_STRUCTURED_RENDERINGS_PER_EDITION";
const EVIDENCE_IDS_DERIVATION =
  "evidenceIdSetSha256 = sha256('CKS05-EVIDENCE-IDS-V1|<protocolDigestSha256>|<editionId>|<canonicalFactInventorySha256>')";
const EXPOSURE_RULE = "SEALED_DIGESTS_ONLY_RAW_TASK_AND_KNOWLEDGE_SEED_BYTES_REMAIN_HIDDEN";
const ALLOWED_CHANGED_PATHS = [
  "scripts/cks-05-build-arm-inputs.mjs",
  "tests/cks-05-ablation-arm-builder.test.mjs",
  "tests/fixtures/cks-05/ablation-matrix-v1.json",
  "tests/fixtures/cks-05/raw-fabric-parity-v1.json",
];
const EXPECTED_VERIFICATION_COMMANDS = [
  "node --test tests/cks-05-ablation-arm-builder.test.mjs",
  "node scripts/cks-05-build-arm-inputs.mjs --fixture tests/fixtures/cks-05/ablation-matrix-v1.json --dry-run",
  "git diff --check origin/main...HEAD",
];

export const sha256 = (data) => createHash("sha256").update(data).digest("hex");
// RFC 8785-style canonical form: sorted keys, compact separators.
export const canonical = (v) => {
  if (Array.isArray(v)) return `[${v.map(canonical).join(",")}]`;
  if (v && typeof v === "object") {
    return `{${Object.keys(v).sort().map((k) => `${JSON.stringify(k)}:${canonical(v[k])}`).join(",")}}`;
  }
  return JSON.stringify(v);
};

// Pinned derivation contracts.
// L2 (unchanged, echoed for provenance):
// runId   = run:<sha256(protocolDigestSha256|armId|taskId|editionId|generationSeed)>
// pairKey = pair:<sha256(protocolDigestSha256|taskId|editionId|generationSeed)>
// L3 (arm inputs):
// inputId   = input:<sha256(protocolDigestSha256|armId|taskId|editionId)>
// identityKey = identity:<sha256(protocolDigestSha256|taskId|editionId)>
// (identityKey is shared by all five arms for a task+edition; it is the
// cross-arm identity grouping key)
export function deriveRunId(protocolDigestSha256, armId, taskId, editionId, generationSeed) {
  return `run:${sha256(`${protocolDigestSha256}|${armId}|${taskId}|${editionId}|${generationSeed}`)}`;
}
export function derivePairKey(protocolDigestSha256, taskId, editionId, generationSeed) {
  return `pair:${sha256(`${protocolDigestSha256}|${taskId}|${editionId}|${generationSeed}`)}`;
}
export function deriveInputId(protocolDigestSha256, armId, taskId, editionId) {
  return `input:${sha256(`${protocolDigestSha256}|${armId}|${taskId}|${editionId}`)}`;
}
export function deriveIdentityKey(protocolDigestSha256, taskId, editionId) {
  return `identity:${sha256(`${protocolDigestSha256}|${taskId}|${editionId}`)}`;
}

// In-memory materialization of the 320 arm inputs (5 arms x 32 tasks x 2
// editions). Each record carries only identity fields and sealed digests:
// task identity from the L2-bound partition, edition identity from the
// parity fabric, the knowledge rendering selected by the arm's representation,
// and the guidance artifact for ARM-SSG-05 only.
export function buildArmInputs(template, l2Template, fabric) {
  const protocolDigestSha256 = template.protocol.protocolDigestSha256;
  const editionsById = Object.fromEntries(fabric.editions.map((e) => [e.editionId, e]));
  const inputs = [];
  for (const arm of template.arms) {
    for (const task of l2Template.taskPartition.tasks) {
      for (const editionId of arm.editions) {
        const edition = editionsById[editionId];
        if (!edition) throw new Error(`UNKNOWN_EDITION_ID: ${editionId}`);
        const withoutDigest = {
          inputId: deriveInputId(protocolDigestSha256, arm.armId, task.taskId, editionId),
          identityKey: deriveIdentityKey(protocolDigestSha256, task.taskId, editionId),
          armId: arm.armId,
          modelProfileId: arm.modelProfileId,
          knowledgeRepresentation: arm.knowledgeRepresentation,
          knowledgePayload: arm.knowledgePayload,
          taskId: task.taskId,
          scenarioPairId: task.scenarioPairId,
          domainId: task.domainId,
          hopClass: task.hopClass,
          updateSensitivity: task.updateSensitivity,
          editionId,
          editionSha256: edition.editionSha256,
          canonicalFactInventorySha256: edition.canonicalFactInventorySha256,
          taskPromptCoreSha256: task.taskPromptCoreSha256,
          goldRecordSha256: task.goldRecordSha256[editionId],
          evidenceGraphSha256: task.evidenceGraphSha256[editionId],
          knowledgeRenderingSha256: template.renderingBindings[arm.knowledgeRepresentation][editionId],
          guidanceArtifactSha256: arm.knowledgePayload === GUIDANCE_PAYLOAD ? template.guidanceBinding.guidanceArtifactSha256 : null,
        };
        const record = { ...withoutDigest, inputDigestSha256: null };
        // Self-digest over the record with inputDigestSha256 nulled (key present, null).
        record.inputDigestSha256 = sha256(canonical(record));
        inputs.push(record);
      }
    }
  }
  return inputs;
}

const deepEqual = (a, b) => canonical(a) === canonical(b);

// Total validator: returns [] when the matrix is fully bound, otherwise the
// list of fail-closed rejection reasons (codes are prefixed, stable strings).
export function validateAblationMatrix(template, sources) {
  const errors = [];
  const check = (cond, code, detail) => {
    if (!cond) errors.push(`${code}: ${detail}`);
  };
  const l1 = sources.l1Manifest;
  const l2 = sources.l2Template;
  const fabric = sources.fabric;

  // Protocol source binding: recompute from the approved design decision.
  const receiptSha = sha256(sources.decisionBytes);
  check(
    receiptSha === template.protocol.decisionReceipt.sha256,
    "RECEIPT_DIGEST_DRIFT",
    `decision receipt byte digest is ${receiptSha}, matrix pins ${template.protocol.decisionReceipt.sha256}`,
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
      `protocol canonical digest is ${protocolDigest}, matrix pins ${template.protocol.protocolDigestSha256}`,
    );
  }

  // Matrix identity.
  check(
    template.matrixId === "CKS05-ABLATION-MATRIX-V1" && template.taskId === EXPECTED_TASK_ID,
    "MATRIX_ID_DRIFT",
    "matrix must be CKS05-ABLATION-MATRIX-V1 for PSAI285-L3-ABLATION-ARM-BUILDER",
  );

  // L1 manifest binding: the matrix extends the L1 contract, never diverges.
  check(
    l1.manifestId === template.l1Manifest.manifestId,
    "L1_MANIFEST_MISMATCH",
    `l1Manifest.manifestId ${template.l1Manifest.manifestId} does not match ${l1.manifestId}`,
  );
  check(
    l1.protocol.protocolDigestSha256 === template.protocol.protocolDigestSha256,
    "L1_PROTOCOL_DIGEST_MISMATCH",
    "L1 and matrix protocol digests differ",
  );
  check(
    l1.protocol.decisionReceipt.sha256 === template.protocol.decisionReceipt.sha256,
    "L1_RECEIPT_DIGEST_MISMATCH",
    "L1 and matrix decision receipt digests differ",
  );

  // L2 template binding: the matrix binds the L2 partition by digest.
  check(
    l2.templateId === template.l2Template.templateId,
    "L2_TEMPLATE_MISMATCH",
    `bound L2 templateId ${template.l2Template.templateId} does not match ${l2.templateId}`,
  );
  check(
    l2.protocol.protocolDigestSha256 === template.protocol.protocolDigestSha256 &&
      l2.protocol.decisionReceipt.sha256 === template.protocol.decisionReceipt.sha256,
    "L2_PROTOCOL_MISMATCH",
    "bound L2 template is pinned to a different protocol/receipt",
  );
  check(
    sha256(canonical(l2.taskPartition)) === template.l2Template.partitionDigestSha256,
    "L2_PARTITION_DIGEST_DRIFT",
    "l2Template.partitionDigestSha256 does not match the canonical digest of the L2 task partition",
  );
  check(
    l2.runPlan.scheduledCounts.totalScheduledRunRecords === 960 &&
      l2.runPlan.distinctPairKeys === 192 &&
      l2.runPlan.runsPerPairKey === 5 &&
      l2.runPlan.derivation.runId === "run:<sha256(protocolDigestSha256|armId|taskId|editionId|generationSeed)>" &&
      l2.runPlan.derivation.pairKey === "pair:<sha256(protocolDigestSha256|taskId|editionId|generationSeed)>",
    "L2_RUN_PLAN_DRIFT",
    "the bound L2 run plan drifted from the approved 960-run / 192-pair-key schedule",
  );

  // Raw-fabric parity binding: sealed per-edition parity proof.
  const fabricForDigest = { ...fabric, fabricDigestSha256: null };
  check(
    sha256(canonical(fabricForDigest)) === fabric.fabricDigestSha256,
    "FABRIC_SELF_DIGEST_DRIFT",
    "fabricDigestSha256 does not match the canonical digest over the fabric (with that field nulled)",
  );
  check(
    fabric.fabricId === "CKS05-RAW-FABRIC-PARITY-V1" && fabric.fabricId === template.parityFabric.fabricId,
    "FABRIC_ID_MISMATCH",
    "fabric must be CKS05-RAW-FABRIC-PARITY-V1 and match the matrix parityFabric binding",
  );
  check(
    fabric.protocol.protocolDigestSha256 === template.protocol.protocolDigestSha256 &&
      fabric.protocol.decisionReceipt.sha256 === template.protocol.decisionReceipt.sha256,
    "FABRIC_PROTOCOL_MISMATCH",
    "fabric is bound to a different protocol digest / decision receipt",
  );
  check(
    fabric.l1Manifest.manifestId === l1.manifestId,
    "FABRIC_L1_MISMATCH",
    "fabric is bound to a different L1 manifest",
  );
  for (const editionId of EDITION_IDS) {
    const fe = fabric.editions.find((e) => e.editionId === editionId);
    const k0 = editionId === "K0_STATIC";
    check(
      fe &&
        fe.role === (k0 ? "FROZEN_PRE_UPDATE" : "FROZEN_POST_UPDATE") &&
        fe.editionSha256 === (k0 ? l1.admission.knowledgeK0EditionSha256 : l1.admission.knowledgeK1EditionSha256) &&
        fe.canonicalFactInventorySha256 === (k0 ? l1.admission.knowledgeK0CanonicalFactInventorySha256 : l1.admission.knowledgeK1CanonicalFactInventorySha256) &&
        fe.factParityReceiptSha256 === (k0 ? l1.admission.factParityReceiptK0Sha256 : l1.admission.factParityReceiptK1Sha256),
      "FABRIC_EDITION_DRIFT",
      `${editionId}: fabric edition identity must match the L1-admitted frozen edition`,
    );
    if (!fe) continue;
    const expectedRaw = k0 ? l1.admission.rawK0RenderingSha256 : l1.admission.rawK1RenderingSha256;
    const expectedStructured = k0 ? l1.admission.structuredK0RenderingSha256 : l1.admission.structuredK1RenderingSha256;
    check(
      fe.rawRenderingSha256 === expectedRaw && fe.structuredRenderingSha256 === expectedStructured,
      "FABRIC_RENDERING_DRIFT",
      `${editionId}: fabric rendering digests must match the L1-admitted rendering digests`,
    );
    check(
      fe.rawRenderingSha256 === template.renderingBindings.RAW[editionId] &&
        fe.structuredRenderingSha256 === template.renderingBindings.STRUCTURED[editionId],
      "FABRIC_RENDERING_DRIFT",
      `${editionId}: fabric rendering digests must match the matrix rendering bindings`,
    );
    check(
      fe.sameAtomicFactInventoryDigest === true &&
        fe.sameEvidenceIds === true &&
        fe.rawAndStructuredDifferOnlyInRepresentation === true &&
        fe.rawRenderingSha256 !== fe.structuredRenderingSha256,
      "FABRIC_PARITY_FLAG_DRIFT",
      `${editionId}: raw and structured renderings must be parity-bound (same inventory and evidence ids, different representation only)`,
    );
    check(
      fe.evidenceIdSetSha256 === sha256(
        `CKS05-EVIDENCE-IDS-V1|${template.protocol.protocolDigestSha256}|${editionId}|${fe.canonicalFactInventorySha256}`,
      ),
      "FABRIC_EVIDENCE_IDS_DRIFT",
      `${editionId}: evidenceIdSetSha256 does not match the pinned derivation`,
    );
  }
  check(
    fabric.parityRule === PARITY_RULE && fabric.evidenceIdSetDerivation === EVIDENCE_IDS_DERIVATION,
    "FABRIC_PARITY_FLAG_DRIFT",
    "fabric parity rule / evidence-id derivation strings drifted from the approved design",
  );
  check(
    fabric.guidance.artifactSha256 === l1.admission.guidanceArtifactSha256 &&
      fabric.guidance.leakageAuditSha256 === l1.admission.guidanceLeakageAuditSha256 &&
      fabric.guidance.nonAnswerOnly === true &&
      fabric.guidance.answerContentLeakage === false &&
      deepEqual(fabric.guidance.appliedToArms, [GUIDANCE_ARM_ID]),
    "FABRIC_GUIDANCE_DRIFT",
    "fabric guidance must be non-answer-only, leakage-free, and applied to ARM-SSG-05 only",
  );
  check(
    fabric.publicSafe.rawKnowledgeBytesPublished === false &&
      fabric.publicSafe.rawRenderingBytesPublished === false &&
      fabric.publicSafe.sealedDigestsOnly === true,
    "FABRIC_PUBLIC_SAFETY_VIOLATION",
    "fabric must publish sealed digests only; raw Knowledge seed or rendering bytes must remain hidden",
  );

  // Matrix self-digest.
  const matrixForDigest = { ...template, matrixDigestSha256: null };
  check(
    sha256(canonical(matrixForDigest)) === template.matrixDigestSha256,
    "MATRIX_SELF_DIGEST_DRIFT",
    "matrixDigestSha256 does not match the canonical digest over the matrix (with that field nulled)",
  );

  // Task binding: the matrix summarizes the L2 partition by digest.
  const tb = template.taskBinding;
  const l2Tasks = l2.taskPartition.tasks;
  check(
    tb.partitionId === l2.taskPartition.partitionId &&
      tb.freshnessStatus === l2.taskPartition.freshnessStatus &&
      tb.sealedDigestsOnly === true,
    "TASK_BINDING_DRIFT",
    "task binding must reference the sealed L2 partition identity",
  );
  check(tb.taskCount === l2Tasks.length && tb.taskCount === 32, "TASK_BINDING_DRIFT", `taskCount must be 32, is ${tb.taskCount}`);
  check(
    tb.taskIdsSha256 === sha256(canonical(l2Tasks.map((t) => t.taskId))),
    "TASK_BINDING_DRIFT",
    "taskIdsSha256 does not match the canonical digest of the L2 partition task ids",
  );
  check(
    tb.scenarioPairCount === new Set(l2Tasks.map((t) => t.scenarioPairId)).size,
    "TASK_BINDING_DRIFT",
    "scenarioPairCount does not match the L2 partition",
  );
  const hopCounts = {};
  for (const t of l2Tasks) hopCounts[t.hopClass] = (hopCounts[t.hopClass] ?? 0) + 1;
  check(deepEqual(tb.hopStrata, hopCounts), "TASK_BINDING_DRIFT", "hopStrata does not match the L2 partition");
  const updateCounts = {};
  for (const t of l2Tasks) updateCounts[t.updateSensitivity] = (updateCounts[t.updateSensitivity] ?? 0) + 1;
  check(deepEqual(tb.updateSensitivity, updateCounts), "TASK_BINDING_DRIFT", "updateSensitivity does not match the L2 partition");

  // Arms: exactly the L2 arms, each bound to its L1-pinned profile.
  check(template.arms.length === EXPECTED_ARM_IDS.length, "ARM_SET_DRIFT", `arm count is ${template.arms.length}, expected 5`);
  check(
    deepEqual(template.arms.map((a) => a.armId).sort(), [...EXPECTED_ARM_IDS].sort()),
    "ARM_SET_DRIFT",
    `arm ids ${JSON.stringify(template.arms.map((a) => a.armId))} do not match the approved set`,
  );
  check(deepEqual(template.arms, l2.arms), "ARM_SET_DRIFT", "matrix arms must equal the L2 template arms exactly");
  const l1ArmsById = new Map(l1.arms.map((a) => [a.armId, a]));
  const l1ProfilesById = new Map(l1.modelProfiles.map((p) => [p.profileId, p]));
  for (const arm of template.arms) {
    const l1Arm = l1ArmsById.get(arm.armId);
    check(
      l1Arm !== undefined && l1Arm.modelProfileId === arm.modelProfileId,
      "ARM_PROFILE_MISMATCH",
      `${arm.armId} is bound to ${arm.modelProfileId}, L1 pins ${l1Arm ? l1Arm.modelProfileId : "nothing"}`,
    );
    check(
      l1Arm !== undefined &&
        l1Arm.knowledgeRepresentation === arm.knowledgeRepresentation &&
        l1Arm.knowledgePayload === arm.knowledgePayload,
      "ARM_RENDERING_DRIFT",
      `${arm.armId} representation/payload drifted from the L1-admitted arm definition`,
    );
    check(
      deepEqual(arm.editions, EDITION_IDS),
      "EDITION_SET_DRIFT",
      `${arm.armId} must run exactly the editions ${JSON.stringify(EDITION_IDS)}`,
    );
    const profile = l1ProfilesById.get(arm.modelProfileId);
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

  // Rendering bindings: per-representation, per-edition sealed digests.
  check(
    template.renderingBindings.RAW.K0_STATIC === l1.admission.rawK0RenderingSha256 &&
      template.renderingBindings.RAW.K1_UPDATED === l1.admission.rawK1RenderingSha256 &&
      template.renderingBindings.STRUCTURED.K0_STATIC === l1.admission.structuredK0RenderingSha256 &&
      template.renderingBindings.STRUCTURED.K1_UPDATED === l1.admission.structuredK1RenderingSha256,
    "REPRESENTATION_BINDING_DRIFT",
    "rendering bindings must equal the L1-admitted rendering digests per representation and edition",
  );
  check(
    template.renderingBindings.RAW.K0_STATIC !== template.renderingBindings.STRUCTURED.K0_STATIC &&
      template.renderingBindings.RAW.K1_UPDATED !== template.renderingBindings.STRUCTURED.K1_UPDATED,
    "REPRESENTATION_BINDING_DRIFT",
    "raw and structured renderings must be distinct representations per edition",
  );

  // Guidance binding: ARM-SSG-05 only, non-answer-only, no leakage.
  const gb = template.guidanceBinding;
  check(
    gb.armId === GUIDANCE_ARM_ID &&
      gb.guidanceArtifactSha256 === l1.admission.guidanceArtifactSha256 &&
      gb.guidanceLeakageAuditSha256 === l1.admission.guidanceLeakageAuditSha256 &&
      gb.nonAnswerOnly === true &&
      gb.answerContentLeakage === false &&
      gb.allOtherArms === null,
    "GUIDANCE_BINDING_DRIFT",
    "guidance must be bound to ARM-SSG-05 only, non-answer-only, with no answer-content leakage",
  );
  check(
    deepEqual(template.arms.filter((a) => a.knowledgePayload === GUIDANCE_PAYLOAD).map((a) => a.armId), [GUIDANCE_ARM_ID]),
    "GUIDANCE_BINDING_DRIFT",
    "exactly ARM-SSG-05 may carry FACTS_AND_NON_ANSWER_GUIDANCE",
  );

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

  // Input derivation contract strings.
  const idc = template.inputDerivation;
  check(
    idc.inputId === "input:<sha256(protocolDigestSha256|armId|taskId|editionId)>" &&
      idc.identityKey === "identity:<sha256(protocolDigestSha256|taskId|editionId)>" &&
      idc.inputDigestSha256 === "sha256(canonical(inputRecord with inputDigestSha256 nulled))",
    "INPUT_DERIVATION_CONTRACT_DRIFT",
    "inputDerivation contract strings drifted from the approved design",
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
      em.persistedArmInputs === false &&
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

  // Contracts preserved verbatim from the L2 template.
  check(deepEqual(template.inferenceContract, l2.inferenceContract), "INFERENCE_CONTRACT_DRIFT", "inference contract must equal the L2 contract exactly");
  check(deepEqual(template.failureContract, l2.failureContract), "FAILURE_CONTRACT_DRIFT", "failure contract must equal the L2 contract exactly");

  // A/B contrast plan: the seven mandatory reports, pre-execution denied.
  const reports = template.abContrastPlan.reports;
  check(Array.isArray(reports) && reports.length === 7, "CONTRAST_SET_DRIFT", `report count is ${reports ? reports.length : "missing"}, expected 7`);
  check(
    Array.isArray(reports) && deepEqual(reports.map((r) => r.reportId), l1.claimEligibility.mandatoryReportIds),
    "CONTRAST_SET_DRIFT",
    "report ids must equal the L1 mandatoryReportIds in the exact declared order",
  );
  for (const r of reports) {
    check(
      r.preExecutionStatus === "NOT_EXECUTED" &&
        r.resultStatus === "PARTIAL_NO_CLAIM" &&
        deepEqual(r.measured, { deltaPointEstimate: null, confidenceInterval: null, significanceVerdict: null }),
      "CONTRAST_STATUS_DRIFT",
      `${r.reportId}: pre-execution reports must be NOT_EXECUTED with PARTIAL_NO_CLAIM and null measured values`,
    );
  }
  check(
    template.abContrastPlan.missingResultStatus === "PARTIAL_NO_CLAIM" &&
      template.abContrastPlan.missingResultStatus === l1.claimEligibility.missingResultStatus &&
      template.abContrastPlan.preExecutionClaimStatus === "DENY_NOT_EXECUTED" &&
      template.abContrastPlan.measuredValuesBeforeExecution === null,
    "CONTRAST_STATUS_DRIFT",
    "contrast plan must deny pre-execution claims and carry no measured values",
  );

  // Contrast arm/scope binding: each contrast isolates exactly one axis.
  const armInfo = (armId) => {
    const arm = l1ArmsById.get(armId);
    const profile = arm ? l1ProfilesById.get(arm.modelProfileId) : undefined;
    return arm && profile
      ? { armId, role: profile.role, rep: arm.knowledgeRepresentation, payload: arm.knowledgePayload }
      : null;
  };
  for (const r of reports) {
    if (!r.treatmentArmId) continue;
    const t = armInfo(r.treatmentArmId);
    const c = armInfo(r.controlArmId);
    check(
      t !== null && c !== null && t.armId !== c.armId,
      "CONTRAST_ARM_BINDING_DRIFT",
      `${r.reportId}: treatment/control arms must be distinct valid arms`,
    );
    if (!t || !c || t.armId === c.armId) continue;
    const fd = r.fixedDimensions || {};
    if (fd.knowledgeRepresentation) {
      check(
        t.rep === fd.knowledgeRepresentation && c.rep === fd.knowledgeRepresentation,
        "CONTRAST_ARM_BINDING_DRIFT",
        `${r.reportId}: both arms must use the ${fd.knowledgeRepresentation} representation`,
      );
    }
    if (fd.knowledgePayload) {
      check(
        t.payload === fd.knowledgePayload && c.payload === fd.knowledgePayload,
        "CONTRAST_ARM_BINDING_DRIFT",
        `${r.reportId}: both arms must use the ${fd.knowledgePayload} knowledge condition`,
      );
    }
    if (fd.modelProfileRole) {
      check(
        t.role === fd.modelProfileRole && c.role === fd.modelProfileRole,
        "CONTRAST_ARM_BINDING_DRIFT",
        `${r.reportId}: both arms must use the ${fd.modelProfileRole} profile role`,
      );
    }
    if (r.ablationAxis === "MODEL_SIZE") {
      check(
        t.role !== c.role && t.rep === c.rep && t.payload === c.payload,
        "CONTRAST_ARM_BINDING_DRIFT",
        `${r.reportId}: MODEL_SIZE contrast must differ only in profile role`,
      );
    }
    if (r.ablationAxis === "KNOWLEDGE_REPRESENTATION") {
      check(
        t.rep !== c.rep && t.role === c.role && t.payload === c.payload,
        "CONTRAST_ARM_BINDING_DRIFT",
        `${r.reportId}: representation contrast must differ only in knowledge rendering`,
      );
    }
    if (r.ablationAxis === "KNOWLEDGE_CONDITION") {
      check(
        t.payload !== c.payload && t.role === c.role && t.rep === c.rep,
        "CONTRAST_ARM_BINDING_DRIFT",
        `${r.reportId}: knowledge-condition contrast must differ only in guidance presence`,
      );
    }
    if (r.ablationAxis === "EDITION_FRESHNESS") {
      check(
        r.treatmentEditionId === "K1_UPDATED" &&
          r.controlEditionId === "K0_STATIC" &&
          Array.isArray(r.scopes) &&
          r.scopes.length === EXPECTED_ARM_IDS.length &&
          deepEqual(r.scopes.map((s) => s.armId).sort(), [...EXPECTED_ARM_IDS].sort()),
        "CONTRAST_SCOPE_DRIFT",
        `${r.reportId}: edition contrast must span exactly the five approved arms with K1_UPDATED vs K0_STATIC`,
      );
    }
    if (r.ablationAxis === "HOP_CLASS") {
      const expectedScopes = [...EXPECTED_ARM_IDS]
        .flatMap((armId) => EDITION_IDS.map((editionId) => `${armId}|${editionId}`))
        .sort();
      check(
        r.treatmentHopClass === "MULTI_HOP" &&
          r.controlHopClass === "SINGLE_HOP" &&
          Array.isArray(r.scopes) &&
          deepEqual(r.scopes.map((s) => `${s.armId}|${s.editionId}`).sort(), expectedScopes),
        "CONTRAST_SCOPE_DRIFT",
        `${r.reportId}: hop contrast must span every arm x edition with MULTI_HOP vs SINGLE_HOP`,
      );
    }
  }

  // Contrast arithmetic: seeds are repeated observations, never units.
  const l2c = l2.runPlan.scheduledCounts;
  const seedCount = template.generation.seeds.length;
  const taskCount = l2Tasks.length;
  const scenarioPairCount = new Set(l2Tasks.map((t) => t.scenarioPairId)).size;
  for (const r of reports) {
    if (r.resamplingUnit === "taskId" && r.pairedExecutionsPerEdition !== undefined) {
      check(
        r.pairedExecutionsPerEdition === taskCount * seedCount &&
          r.pairedExecutionsPerEdition === l2c.pairedExecutionsPerArmContrastPerEdition &&
          r.independentTaskUnitsPerEdition === taskCount &&
          r.independentTaskUnitsPerEdition === l2c.independentTaskUnitsPerArmContrastPerEdition,
        "CONTRAST_ARITHMETIC_DRIFT",
        `${r.reportId}: paired executions / independent task units must be ${taskCount * seedCount} / ${taskCount}`,
      );
    }
    if (r.resamplingUnit === "taskId" && r.pairedExecutionsPerArm !== undefined) {
      check(
        r.pairedExecutionsPerArm === l2c.pairedExecutionsPerStaticUpdatedContrastPerArm &&
          r.independentTaskUnitsPerArm === l2c.independentTaskUnitsPerStaticUpdatedContrastPerArm &&
          r.pairedExecutionsPerArm === taskCount * seedCount &&
          r.independentTaskUnitsPerArm === taskCount,
        "CONTRAST_ARITHMETIC_DRIFT",
        `${r.reportId}: static-vs-updated arithmetic must match the L2 per-arm counts`,
      );
    }
    if (r.resamplingUnit === "scenarioPairId") {
      check(
        r.pairedExecutionsPerArmEdition === l2c.pairedExecutionsPerSingleMultiContrastPerArmEdition &&
          r.independentScenarioPairUnitsPerArmEdition === l2c.independentScenarioPairUnitsPerSingleMultiContrastPerArmEdition &&
          r.pairedExecutionsPerArmEdition === scenarioPairCount * seedCount &&
          r.independentScenarioPairUnitsPerArmEdition === scenarioPairCount,
        "CONTRAST_ARITHMETIC_DRIFT",
        `${r.reportId}: single-vs-multi-hop arithmetic must match the L2 per-arm-edition counts`,
      );
    }
    if (r.resamplingUnit) {
      const expectedUnit =
        r.resamplingUnit === "scenarioPairId"
          ? l2.inferenceContract.resamplingUnits.singleMultiHopContrasts
          : l2.inferenceContract.resamplingUnits.armAndEditionContrasts;
      check(
        r.resamplingUnit === expectedUnit,
        "CONTRAST_ARITHMETIC_DRIFT",
        `${r.reportId}: resampling unit ${r.resamplingUnit} does not match the L2 inference contract`,
      );
    }
  }

  // Public safety: sealed digests only.
  const pse = template.publicSafeEvidence;
  check(
    pse.rawTaskBytesPublished === false &&
      pse.rawKnowledgeSeedBytesPublished === false &&
      pse.rawRenderingBytesPublished === false &&
      pse.sealedDigestsOnly === true &&
      pse.exposureRule === EXPOSURE_RULE,
    "PUBLIC_SAFETY_VIOLATION",
    "matrix must publish sealed digests only; raw task, Knowledge seed or rendering bytes must remain hidden",
  );

  // Materialized arm-input invariants.
  let inputs = null;
  try {
    inputs = buildArmInputs(template, l2, fabric);
  } catch (err) {
    errors.push(`INPUT_MATERIALIZATION_FAILED: ${err.message}`);
  }
  if (inputs) {
    check(
      inputs.length === 320 && inputs.length === template.arms.length * taskCount * EDITION_IDS.length,
      "INPUT_COUNT_DRIFT",
      `materialized inputs: ${inputs.length}, expected 320 (5 arms x 32 tasks x 2 editions)`,
    );
    check(new Set(inputs.map((r) => r.inputId)).size === inputs.length, "INPUT_ID_DUPLICATE", "inputId collision in materialized inputs");
    check(
      new Set(inputs.map((r) => `${r.armId}|${r.taskId}|${r.editionId}`)).size === inputs.length,
      "INPUT_BLOCKING_UNIT_DRIFT",
      "blocking unit (armId x taskId x editionId) is not unique per input",
    );
    let derivationOk = true;
    let digestOk = true;
    for (const r of inputs) {
      if (r.inputId !== deriveInputId(template.protocol.protocolDigestSha256, r.armId, r.taskId, r.editionId)) derivationOk = false;
      if (r.identityKey !== deriveIdentityKey(template.protocol.protocolDigestSha256, r.taskId, r.editionId)) derivationOk = false;
      if (r.inputDigestSha256 !== sha256(canonical({ ...r, inputDigestSha256: null }))) digestOk = false;
    }
    check(derivationOk, "INPUT_DERIVATION_DRIFT", "an inputId/identityKey does not match the pinned derivation contract");
    check(digestOk, "INPUT_DIGEST_DRIFT", "an inputDigestSha256 does not match the canonical self-digest of its record");
    const byIdentity = new Map();
    for (const r of inputs) {
      const group = byIdentity.get(r.identityKey);
      if (group) group.push(r);
      else byIdentity.set(r.identityKey, [r]);
    }
    check(
      byIdentity.size === taskCount * EDITION_IDS.length && byIdentity.size === 64,
      "INPUT_IDENTITY_BINDING_DRIFT",
      `expected 64 identity keys (32 tasks x 2 editions), got ${byIdentity.size}`,
    );
    let identityDrift = false;
    for (const [, group] of byIdentity) {
      const armIds = new Set(group.map((r) => r.armId));
      const shared = group[0];
      const consistent =
        group.length === EXPECTED_ARM_IDS.length &&
        deepEqual([...armIds].sort(), [...EXPECTED_ARM_IDS].sort()) &&
        group.every(
          (r) =>
            r.taskId === shared.taskId &&
            r.editionId === shared.editionId &&
            r.scenarioPairId === shared.scenarioPairId &&
            r.domainId === shared.domainId &&
            r.hopClass === shared.hopClass &&
            r.updateSensitivity === shared.updateSensitivity &&
            r.taskPromptCoreSha256 === shared.taskPromptCoreSha256 &&
            r.goldRecordSha256 === shared.goldRecordSha256 &&
            r.evidenceGraphSha256 === shared.evidenceGraphSha256 &&
            r.editionSha256 === shared.editionSha256 &&
            r.canonicalFactInventorySha256 === shared.canonicalFactInventorySha256,
        );
      if (!consistent) {
        identityDrift = true;
        break;
      }
    }
    check(!identityDrift, "INPUT_IDENTITY_BINDING_DRIFT", "an identity key does not span exactly the five arms with identical task/edition inputs");
    let renderingDrift = false;
    for (const r of inputs) {
      if (r.knowledgeRenderingSha256 !== template.renderingBindings[r.knowledgeRepresentation][r.editionId]) renderingDrift = true;
      const expectedGuidance = r.armId === GUIDANCE_ARM_ID ? template.guidanceBinding.guidanceArtifactSha256 : null;
      if (r.guidanceArtifactSha256 !== expectedGuidance) renderingDrift = true;
    }
    check(!renderingDrift, "INPUT_RENDERING_BINDING_DRIFT", "an input's rendering or guidance digest does not match its arm/edition binding");
  }

  // Receipt: pre-execution verdict, allowlisted paths, zero actions.
  check(
    template.receipt.currentEvidenceVerdict === EXPECTED_RECEIPT_VERDICT,
    "RECEIPT_VERDICT_DRIFT",
    "receipt verdict must be the pre-execution no-claim verdict",
  );
  check(
    template.receipt.taskId === EXPECTED_TASK_ID && template.receipt.baseCommit.length === 40,
    "RECEIPT_TASK_DRIFT",
    "receipt taskId must be PSAI285-L3-ABLATION-ARM-BUILDER with a pinned base commit",
  );
  check(
    template.receipt.actionsNotPerformed.modelInvocations === 0 &&
      template.receipt.actionsNotPerformed.benchmarkRuns === 0 &&
      template.receipt.actionsNotPerformed.servicesStartedOrCalled === 0 &&
      template.receipt.actionsNotPerformed.credentialsUsed === false &&
      template.receipt.actionsNotPerformed.harnessSourceModified === false &&
      template.receipt.actionsNotPerformed.push === false &&
      template.receipt.actionsNotPerformed.merge === false &&
      template.receipt.actionsNotPerformed.release === false,
    "RECEIPT_ACTIONS_DRIFT",
    "receipt must record zero actions: no models, no services, no credentials, no runs, no harness edits, no push/merge/release",
  );
  check(
    deepEqual([...template.receipt.changedPaths].sort(), [...ALLOWED_CHANGED_PATHS].sort()) &&
      template.receipt.allowlistCompliant === true,
    "RECEIPT_PATH_DRIFT",
    "receipt changedPaths must equal the four allowlisted paths exactly",
  );
  check(
    deepEqual(template.receipt.requiredVerificationCommands, EXPECTED_VERIFICATION_COMMANDS),
    "RECEIPT_VERIFICATION_DRIFT",
    "required verification commands drifted from the repository profile",
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
        "usage: cks-05-build-arm-inputs.mjs --fixture <path> --dry-run\n",
      );
      process.exit(0);
      return;
    } else {
      fail(2, "UNKNOWN_FLAG", a);
    }
  }
  if (!fixturePath) fail(2, "MISSING_FIXTURE", "usage: cks-05-build-arm-inputs.mjs --fixture <path> --dry-run");
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
  let l1Manifest, l2Template, fabric, decisionBytes;
  try {
    l1Manifest = JSON.parse(readFileSync(safeRepoPath(template.l1Manifest.path), "utf8"));
    l2Template = JSON.parse(readFileSync(safeRepoPath(template.l2Template.path), "utf8"));
    fabric = JSON.parse(readFileSync(safeRepoPath(template.parityFabric.path), "utf8"));
    decisionBytes = readFileSync(safeRepoPath(template.protocol.decisionReceipt.path));
  } catch (err) {
    fail(2, "FIXTURE_SOURCE_READ_FAILED", err.message);
  }

  const errors = validateAblationMatrix(template, { l1Manifest, l2Template, fabric, decisionBytes });
  if (errors.length > 0) {
    process.stderr.write("ABLATION_ARM_INPUTS_REJECTED\n");
    for (const e of errors) process.stderr.write(`${e}\n`);
    process.exit(1);
  }

  // Deterministic double materialization: the inputs must be exactly
  // reproducible in memory with no side effects.
  const inputs = buildArmInputs(template, l2Template, fabric);
  const inputPlanDigest = sha256(canonical(inputs));
  const inputPlanDigestAgain = sha256(
    canonical(buildArmInputs(structuredClone(template), structuredClone(l2Template), structuredClone(fabric))),
  );
  if (inputPlanDigest !== inputPlanDigestAgain) {
    fail(1, "INPUTS_NOT_DETERMINISTIC", "two in-memory materializations produced different arm inputs");
  }

  const byIdentity = new Map();
  for (const r of inputs) {
    const group = byIdentity.get(r.identityKey);
    if (group) group.push(r);
    else byIdentity.set(r.identityKey, [r]);
  }

  const receipt = {
    status: "DRY_RUN_OK",
    matrixId: template.matrixId,
    taskId: template.taskId,
    executionMode: template.executionMode.mode,
    modelInvocations: 0,
    benchmarkRuns: 0,
    claimGate: { gateId: template.claimGate.gateId, preExecutionStatus: template.claimGate.preExecutionStatus },
    crossArmIdentity: {
      sameHiddenTaskPartition: true,
      taskIdsSha256: template.taskBinding.taskIdsSha256,
      knowledgeEditions: EDITION_IDS,
      arms: template.arms.map((a) => a.armId),
      distinctIdentityKeys: byIdentity.size,
      inputsPerIdentityKey: template.arms.length,
      rawAndStructuredRenderingParity: true,
    },
    arithmetic: {
      arms: template.arms.length,
      tasks: l2Template.taskPartition.tasks.length,
      editions: EDITION_IDS.length,
      seeds: template.generation.seeds.length,
      totalInputRecords: inputs.length,
      distinctIdentityKeys: byIdentity.size,
      underlyingRunPlan: {
        totalScheduledRunRecords: l2Template.runPlan.scheduledCounts.totalScheduledRunRecords,
        distinctPairKeys: l2Template.runPlan.distinctPairKeys,
        runsPerPairKey: l2Template.runPlan.runsPerPairKey,
      },
    },
    abContrasts: template.abContrastPlan.reports.map((r) => ({
      reportId: r.reportId,
      ablationAxis: r.ablationAxis,
      preExecutionStatus: r.preExecutionStatus,
      resultStatus: r.resultStatus,
    })),
    digests: {
      protocolDigestSha256: template.protocol.protocolDigestSha256,
      decisionReceiptSha256: template.protocol.decisionReceipt.sha256,
      matrixDigestSha256: template.matrixDigestSha256,
      fabricDigestSha256: fabric.fabricDigestSha256,
      partitionDigestSha256: template.l2Template.partitionDigestSha256,
      inputPlanDigestSha256: inputPlanDigest,
    },
    evidenceVerdict: template.receipt.currentEvidenceVerdict,
  };
  process.stdout.write(`${JSON.stringify(receipt, null, 2)}\n`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}