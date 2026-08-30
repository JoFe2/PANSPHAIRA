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
  deriveInputId,
  deriveIdentityKey,
  buildArmInputs,
  validateAblationMatrix,
} from "../scripts/cks-05-build-arm-inputs.mjs";

const root = resolve(import.meta.dirname, "..");
const load = (p) => JSON.parse(readFileSync(join(root, p), "utf8"));

// Same RFC 8785-style canonical form the fixtures and the builder use, so
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

const matrix = load("tests/fixtures/cks-05/ablation-matrix-v1.json");
const l1Manifest = load(matrix.l1Manifest.path);
const l2Template = load(matrix.l2Template.path);
const fabric = load(matrix.parityFabric.path);
const decisionBytes = readFileSync(join(root, matrix.protocol.decisionReceipt.path));

const sources = { l1Manifest, l2Template, fabric, decisionBytes };
const INPUTS = buildArmInputs(matrix, l2Template, fabric);
const EDITION_IDS = ["K0_STATIC", "K1_UPDATED"];
const EXPECTED_ARM_IDS = ["ARM-LRF-01", "ARM-SRF-02", "ARM-LSF-03", "ARM-SSF-04", "ARM-SSG-05"];
const EXPECTED_RECEIPT_VERDICT =
  "MANIFEST_DEFINED_EXECUTION_NOT_AUTHORIZED_NO_BENCHMARK_RESULT_NO_MODEL_SUBSTITUTION_CLAIM";
const EXPECTED_REPORT_IDS = l1Manifest.claimEligibility.mandatoryReportIds;
const SMALL_PROFILE_ID = l1Manifest.modelProfiles.find((p) => p.role === "SMALL").profileId;

const runCli = (args) => {
  const scriptPath = join(root, "scripts/cks-05-build-arm-inputs.mjs");
  try {
    const stdout = execFileSync(process.execPath, [scriptPath, ...args], { cwd: root, encoding: "utf8" });
    return { status: 0, stdout, stderr: "" };
  } catch (err) {
    return { status: err.status ?? 1, stdout: err.stdout ?? "", stderr: err.stderr ?? "" };
  }
};

// -- CLI: the three required verification behaviors of the builder -------------

test("dry-run materializes the 320 arm inputs in memory and exits 0", () => {
  const r = runCli(["--fixture", "tests/fixtures/cks-05/ablation-matrix-v1.json", "--dry-run"]);
  assert.equal(r.status, 0, `${r.stderr}\n${r.stdout}`);
  const receipt = JSON.parse(r.stdout);
  assert.equal(receipt.status, "DRY_RUN_OK");
  assert.equal(receipt.matrixId, "CKS05-ABLATION-MATRIX-V1");
  assert.equal(receipt.taskId, "PSAI285-L3-ABLATION-ARM-BUILDER");
  assert.equal(receipt.executionMode, "EPHEMERAL_IN_MEMORY");
  assert.equal(receipt.modelInvocations, 0);
  assert.equal(receipt.benchmarkRuns, 0);
  assert.equal(receipt.claimGate.gateId, "L6-MODEL-SUBSTITUTION");
  assert.equal(receipt.claimGate.preExecutionStatus, "DENY_NOT_EXECUTED");
  const ci = receipt.crossArmIdentity;
  assert.equal(ci.sameHiddenTaskPartition, true);
  assert.deepEqual(ci.knowledgeEditions, EDITION_IDS);
  assert.deepEqual(ci.arms, EXPECTED_ARM_IDS);
  assert.equal(ci.distinctIdentityKeys, 64);
  assert.equal(ci.inputsPerIdentityKey, 5);
  assert.equal(ci.rawAndStructuredRenderingParity, true);
  const a = receipt.arithmetic;
  assert.equal(a.arms, 5);
  assert.equal(a.tasks, 32);
  assert.equal(a.editions, 2);
  assert.equal(a.seeds, 3);
  assert.equal(a.totalInputRecords, 320);
  assert.equal(a.distinctIdentityKeys, 64);
  assert.equal(a.underlyingRunPlan.totalScheduledRunRecords, 960);
  assert.equal(a.underlyingRunPlan.distinctPairKeys, 192);
  assert.equal(a.underlyingRunPlan.runsPerPairKey, 5);
  assert.equal(receipt.abContrasts.length, 7);
  assert.deepEqual(receipt.abContrasts.map((c) => c.reportId), EXPECTED_REPORT_IDS);
  for (const c of receipt.abContrasts) {
    assert.equal(c.preExecutionStatus, "NOT_EXECUTED", c.reportId);
    assert.equal(c.resultStatus, "PARTIAL_NO_CLAIM", c.reportId);
  }
  assert.equal(receipt.digests.protocolDigestSha256, matrix.protocol.protocolDigestSha256);
  assert.equal(receipt.digests.matrixDigestSha256, matrix.matrixDigestSha256);
  assert.equal(receipt.digests.fabricDigestSha256, fabric.fabricDigestSha256);
  assert.match(receipt.digests.inputPlanDigestSha256, /^[0-9a-f]{64}$/);
  assert.equal(receipt.evidenceVerdict, EXPECTED_RECEIPT_VERDICT);
});

test("CLI is fail-closed: non-dry-run execution is not authorized (exit 3)", () => {
  const r = runCli(["--fixture", "tests/fixtures/cks-05/ablation-matrix-v1.json"]);
  assert.equal(r.status, 3);
  assert.match(r.stderr, /EXECUTION_NOT_AUTHORIZED/);
});

test("CLI is fail-closed: missing fixture, unknown flag, and out-of-repo fixture are usage errors (exit 2)", () => {
  assert.equal(runCli([]).status, 2);
  assert.equal(runCli(["--bogus"]).status, 2);
  const r = runCli(["--fixture", "/etc/passwd", "--dry-run"]);
  assert.equal(r.status, 2);
  assert.match(r.stderr, /UNSAFE_FIXTURE_PATH/);
});

// -- Source binding: matrix and fabric recompute from the approved receipt -----

test("receipt byte digest and protocol canonical digest are source-bound", () => {
  assert.equal(sha256Local(decisionBytes), matrix.protocol.decisionReceipt.sha256);
  assert.equal(
    sha256Local(Buffer.from(canonicalLocal(JSON.parse(decisionBytes.toString("utf8"))), "utf8")),
    matrix.protocol.protocolDigestSha256,
  );
  // The matrix extends the L1 and L2 contracts, never diverges from them.
  assert.equal(matrix.l1Manifest.manifestId, l1Manifest.manifestId);
  assert.equal(matrix.protocol.protocolDigestSha256, l1Manifest.protocol.protocolDigestSha256);
  assert.equal(matrix.protocol.decisionReceipt.sha256, l1Manifest.protocol.decisionReceipt.sha256);
  assert.equal(matrix.l2Template.templateId, l2Template.templateId);
  assert.equal(
    matrix.l2Template.partitionDigestSha256,
    sha256Local(Buffer.from(canonicalLocal(l2Template.taskPartition), "utf8")),
  );
  assert.equal(matrix.parityFabric.fabricId, fabric.fabricId);
});

test("matrix and fabric self-digests recompute and bind the same protocol receipt", () => {
  assert.equal(
    sha256Local(Buffer.from(canonicalLocal({ ...matrix, matrixDigestSha256: null }), "utf8")),
    matrix.matrixDigestSha256,
  );
  assert.equal(
    sha256Local(Buffer.from(canonicalLocal({ ...fabric, fabricDigestSha256: null }), "utf8")),
    fabric.fabricDigestSha256,
  );
  assert.equal(fabric.protocol.protocolDigestSha256, matrix.protocol.protocolDigestSha256);
  assert.equal(fabric.protocol.decisionReceipt.sha256, matrix.protocol.decisionReceipt.sha256);
  assert.equal(fabric.l1Manifest.manifestId, l1Manifest.manifestId);
});

// -- Cross-arm identity: identical task and edition identity per identity key --

test("every arm input shares identical task and edition identity per identity key", () => {
  assert.equal(INPUTS.length, 320);
  assert.equal(new Set(INPUTS.map((r) => r.inputId)).size, 320, "inputId collisions");
  const byIdentity = new Map();
  for (const r of INPUTS) {
    const group = byIdentity.get(r.identityKey);
    if (group) group.push(r);
    else byIdentity.set(r.identityKey, [r]);
  }
  assert.equal(byIdentity.size, 64, "identity keys = 32 tasks x 2 editions");
  for (const [identityKey, group] of byIdentity) {
    assert.match(identityKey, /^identity:[0-9a-f]{64}$/);
    assert.equal(group.length, 5, `${identityKey} must span the five arms`);
    assert.deepEqual([...new Set(group.map((r) => r.armId))].sort(), [...EXPECTED_ARM_IDS].sort());
    const head = group[0];
    for (const r of group) {
      // Task + edition identity is byte-identical across arms; only the
      // knowledge rendering representation and guidance presence may differ.
      assert.equal(r.taskId, head.taskId);
      assert.equal(r.scenarioPairId, head.scenarioPairId);
      assert.equal(r.domainId, head.domainId);
      assert.equal(r.hopClass, head.hopClass);
      assert.equal(r.updateSensitivity, head.updateSensitivity);
      assert.equal(r.editionId, head.editionId);
      assert.equal(r.editionSha256, head.editionSha256);
      assert.equal(r.canonicalFactInventorySha256, head.canonicalFactInventorySha256);
      assert.equal(r.taskPromptCoreSha256, head.taskPromptCoreSha256);
      assert.equal(r.goldRecordSha256, head.goldRecordSha256);
      assert.equal(r.evidenceGraphSha256, head.evidenceGraphSha256);
      assert.equal(r.knowledgeRenderingSha256, matrix.renderingBindings[r.knowledgeRepresentation][r.editionId]);
    }
    // Structured-vs-raw contrast: the same task+edition identity carries
    // distinct raw and structured rendering digests.
    const raws = group.filter((r) => r.knowledgeRepresentation === "RAW").map((r) => r.knowledgeRenderingSha256);
    const structs = group.filter((r) => r.knowledgeRepresentation === "STRUCTURED").map((r) => r.knowledgeRenderingSha256);
    assert.equal(new Set(raws).size, 1, `${identityKey} raw rendering must be uniform per edition`);
    assert.equal(new Set(structs).size, 1, `${identityKey} structured rendering must be uniform per edition`);
    assert.notEqual(raws[0], structs[0], `${identityKey} raw vs structured rendering must differ`);
  }
});

test("inputId/identityKey/inputDigest derivations are deterministic and pinned to the protocol digest", () => {
  const proto = matrix.protocol.protocolDigestSha256;
  for (const r of INPUTS) {
    assert.equal(r.inputId, deriveInputId(proto, r.armId, r.taskId, r.editionId));
    assert.equal(r.identityKey, deriveIdentityKey(proto, r.taskId, r.editionId));
    assert.match(r.inputId, /^input:[0-9a-f]{64}$/);
    assert.match(r.identityKey, /^identity:[0-9a-f]{64}$/);
    // Self-digest over the record with inputDigestSha256 nulled (key present, null).
    assert.equal(r.inputDigestSha256, sha256Local(Buffer.from(canonicalLocal({ ...r, inputDigestSha256: null }), "utf8")));
  }
  // The L2 derivation contracts stay pinned and are echoed for provenance.
  assert.equal(l2Template.runPlan.derivation.runId, "run:<sha256(protocolDigestSha256|armId|taskId|editionId|generationSeed)>");
  assert.equal(l2Template.runPlan.derivation.pairKey, "pair:<sha256(protocolDigestSha256|taskId|editionId|generationSeed)>");
  assert.match(deriveRunId(proto, "ARM-LRF-01", "T", "K0_STATIC", 1), /^run:[0-9a-f]{64}$/);
  assert.match(derivePairKey(proto, "T", "K0_STATIC", 1), /^pair:[0-9a-f]{64}$/);
  // Double materialization on a clone must be byte-identical: no side effects.
  assert.equal(
    sha256(canonical(INPUTS)),
    sha256(canonical(buildArmInputs(structuredClone(matrix), structuredClone(l2Template), structuredClone(fabric)))),
  );
});

// -- A/B contrast plan: one ablation axis per report, pre-execution denied -----

test("the seven mandatory A/B contrasts isolate exactly one ablation axis each", () => {
  const reports = matrix.abContrastPlan.reports;
  assert.deepEqual(reports.map((r) => r.reportId), EXPECTED_REPORT_IDS);
  assert.deepEqual(
    matrix.ablationAxes.map((a) => a.axisId),
    ["MODEL_SIZE", "KNOWLEDGE_REPRESENTATION", "KNOWLEDGE_CONDITION", "EDITION_FRESHNESS", "HOP_CLASS"],
  );
  const armInfo = (armId) => {
    const arm = l1Manifest.arms.find((a) => a.armId === armId);
    const profile = l1Manifest.modelProfiles.find((p) => p.profileId === arm.modelProfileId);
    return { role: profile.role, rep: arm.knowledgeRepresentation, payload: arm.knowledgePayload };
  };
  for (const r of reports) {
    assert.equal(r.preExecutionStatus, "NOT_EXECUTED", r.reportId);
    assert.equal(r.resultStatus, "PARTIAL_NO_CLAIM", r.reportId);
    assert.deepEqual(r.measured, { deltaPointEstimate: null, confidenceInterval: null, significanceVerdict: null }, r.reportId);
    if (!r.treatmentArmId) continue;
    const t = armInfo(r.treatmentArmId);
    const c = armInfo(r.controlArmId);
    if (r.ablationAxis === "MODEL_SIZE") {
      assert.notEqual(t.role, c.role, `${r.reportId}: model size must differ`);
      assert.equal(t.rep, c.rep, `${r.reportId}: representation must be fixed`);
      assert.equal(t.payload, c.payload, `${r.reportId}: knowledge condition must be fixed`);
    } else if (r.ablationAxis === "KNOWLEDGE_REPRESENTATION") {
      assert.notEqual(t.rep, c.rep, `${r.reportId}: representation must differ`);
      assert.equal(t.role, c.role, `${r.reportId}: model role must be fixed`);
      assert.equal(t.payload, c.payload, `${r.reportId}: knowledge condition must be fixed`);
    } else if (r.ablationAxis === "KNOWLEDGE_CONDITION") {
      assert.notEqual(t.payload, c.payload, `${r.reportId}: knowledge condition must differ`);
      assert.equal(t.role, c.role, `${r.reportId}: model role must be fixed`);
      assert.equal(t.rep, c.rep, `${r.reportId}: representation must be fixed`);
    }
  }
  // Static-vs-updated spans all five arms; single-vs-multi-hop spans all 10 arm-editions.
  const edition = reports.find((r) => r.ablationAxis === "EDITION_FRESHNESS");
  assert.equal(edition.treatmentEditionId, "K1_UPDATED");
  assert.equal(edition.controlEditionId, "K0_STATIC");
  assert.equal(edition.scopes.length, 5);
  assert.deepEqual(edition.scopes.map((s) => s.armId).sort(), [...EXPECTED_ARM_IDS].sort());
  const hop = reports.find((r) => r.ablationAxis === "HOP_CLASS");
  assert.equal(hop.treatmentHopClass, "MULTI_HOP");
  assert.equal(hop.controlHopClass, "SINGLE_HOP");
  assert.equal(hop.scopes.length, 10);
});

test("A/B contrast arithmetic: seeds are repeated observations, never independent units", () => {
  const reports = matrix.abContrastPlan.reports;
  assert.equal(matrix.generation.seeds.length, 3);
  assert.deepEqual(matrix.generation.seeds, l1Manifest.generation.seeds);
  for (const r of reports) {
    if (r.pairedExecutionsPerEdition !== undefined) {
      assert.equal(r.pairedExecutionsPerEdition, 32 * 3, r.reportId);
      assert.equal(r.independentTaskUnitsPerEdition, 32, r.reportId);
      assert.equal(r.resamplingUnit, "taskId", r.reportId);
    }
    if (r.pairedExecutionsPerArm !== undefined) {
      assert.equal(r.pairedExecutionsPerArm, 32 * 3, r.reportId);
      assert.equal(r.independentTaskUnitsPerArm, 32, r.reportId);
      assert.equal(r.resamplingUnit, "taskId", r.reportId);
    }
    if (r.pairedExecutionsPerArmEdition !== undefined) {
      assert.equal(r.pairedExecutionsPerArmEdition, 16 * 3, r.reportId);
      assert.equal(r.independentScenarioPairUnitsPerArmEdition, 16, r.reportId);
      assert.equal(r.resamplingUnit, "scenarioPairId", r.reportId);
    }
    assert.equal(
      r.resamplingUnit,
      l2Template.inferenceContract.resamplingUnits[
        r.resamplingUnit === "scenarioPairId" ? "singleMultiHopContrasts" : "armAndEditionContrasts"
      ],
      r.reportId,
    );
  }
  // Exactly one arm carries the non-answer guidance; the condition contrast isolates it.
  assert.deepEqual(
    matrix.arms.filter((a) => a.knowledgePayload === "FACTS_AND_NON_ANSWER_GUIDANCE").map((a) => a.armId),
    ["ARM-SSG-05"],
  );
});

// -- Public-safe, ephemeral, and pre-execution fail-closed contracts -----------

test("public-safe and ephemeral: sealed digests only, no model, no authorization", () => {
  assert.equal(matrix.publicSafeEvidence.rawTaskBytesPublished, false);
  assert.equal(matrix.publicSafeEvidence.rawKnowledgeSeedBytesPublished, false);
  assert.equal(matrix.publicSafeEvidence.rawRenderingBytesPublished, false);
  assert.equal(matrix.publicSafeEvidence.sealedDigestsOnly, true);
  assert.equal(fabric.publicSafe.rawKnowledgeBytesPublished, false);
  assert.equal(fabric.publicSafe.rawRenderingBytesPublished, false);
  assert.equal(fabric.publicSafe.sealedDigestsOnly, true);
  // No raw task or Knowledge bytes anywhere in the materialized inputs.
  for (const r of INPUTS) {
    assert.match(r.taskPromptCoreSha256, /^[0-9a-f]{64}$/);
    assert.match(r.goldRecordSha256, /^[0-9a-f]{64}$/);
    assert.match(r.evidenceGraphSha256, /^[0-9a-f]{64}$/);
    assert.match(r.knowledgeRenderingSha256, /^[0-9a-f]{64}$/);
    if (r.guidanceArtifactSha256 !== null) assert.match(r.guidanceArtifactSha256, /^[0-9a-f]{64}$/);
  }
  assert.deepEqual(matrix.executionMode, {
    mode: "EPHEMERAL_IN_MEMORY",
    persistedArmInputs: false,
    modelInvocation: false,
    executionAuthorized: false,
    writeRunArtifacts: false,
  });
  assert.equal(matrix.claimGate.gateId, "L6-MODEL-SUBSTITUTION");
  assert.equal(matrix.claimGate.preExecutionStatus, "DENY_NOT_EXECUTED");
  assert.equal(matrix.claimGate.modelSubstitutionClaimBeforeExecution, false);
  assert.ok(deepEqual(matrix.inferenceContract, l2Template.inferenceContract), "inference contract preserved from L2");
  assert.ok(deepEqual(matrix.failureContract, l2Template.failureContract), "failure contract preserved from L2");
  assert.equal(matrix.receipt.currentEvidenceVerdict, EXPECTED_RECEIPT_VERDICT);
  assert.deepEqual([...matrix.receipt.changedPaths].sort(), [
    "scripts/cks-05-build-arm-inputs.mjs",
    "tests/cks-05-ablation-arm-builder.test.mjs",
    "tests/fixtures/cks-05/ablation-matrix-v1.json",
    "tests/fixtures/cks-05/raw-fabric-parity-v1.json",
  ]);
  const actions = matrix.receipt.actionsNotPerformed;
  assert.equal(actions.modelInvocations, 0);
  assert.equal(actions.benchmarkRuns, 0);
  assert.equal(actions.push, false);
  assert.equal(actions.merge, false);
  assert.equal(actions.release, false);
  // Operating model is preserved, no new process variant.
  assert.equal(matrix.operatingModel.version, l1Manifest.protocol.operatingModelVersion);
  assert.deepEqual(matrix.operatingModel.preservedDecisionIds, l1Manifest.protocol.preservedDecisionIds);
  assert.equal(matrix.operatingModel.processVariantIntroduced, false);
});

// -- Fail-closed probes: every drift or escape must be rejected ---------------

const PROBE_NAMES = [
  "protocol-digest-drift",
  "receipt-digest-drift",
  "matrix-id-drift",
  "l1-manifest-mismatch",
  "l2-partition-digest-drift",
  "fabric-self-digest-drift",
  "fabric-evidence-ids-drift",
  "fabric-parity-flag-drift",
  "matrix-self-digest-drift",
  "task-binding-drift",
  "missing-arm",
  "arm-editions-drift",
  "arm-bound-to-wrong-profile",
  "representation-binding-drift",
  "guidance-binding-drift",
  "seed-drift",
  "seed-list-digest-drift",
  "input-derivation-contract-drift",
  "operating-model-variant",
  "execution-mode-not-ephemeral",
  "pre-execution-claim-status-pass",
  "contrast-report-missing",
  "contrast-status-pass",
  "contrast-isolation-drift",
  "contrast-arithmetic-drift",
  "public-safety-violation",
  "receipt-verdict-drift",
  "input-count-drift",
];

test("fail-closed: the intact matrix validates clean and every probe is rejected", () => {
  assert.deepEqual(validateAblationMatrix(matrix, sources), [], "intact matrix must validate clean");

  const probes = new Map();
  let t;
  let s;

  t = structuredClone(matrix);
  t.protocol.protocolDigestSha256 = flipHex(t.protocol.protocolDigestSha256);
  probes.set("protocol-digest-drift", [t, { ...sources }]);

  t = structuredClone(matrix);
  s = { ...sources, decisionBytes: Buffer.concat([Buffer.from([decisionBytes[0] ^ 0xff]), decisionBytes.subarray(1)]) };
  probes.set("receipt-digest-drift", [t, s]);

  t = structuredClone(matrix);
  t.matrixId = "CKS05-DRIFTED";
  probes.set("matrix-id-drift", [t, { ...sources }]);

  t = structuredClone(matrix);
  s = { ...sources, l1Manifest: { ...structuredClone(l1Manifest), manifestId: "CKS-05-DRIFTED" } };
  probes.set("l1-manifest-mismatch", [t, s]);

  t = structuredClone(matrix);
  t.l2Template.partitionDigestSha256 = flipHex(t.l2Template.partitionDigestSha256);
  probes.set("l2-partition-digest-drift", [t, { ...sources }]);

  t = structuredClone(matrix);
  s = { ...sources, fabric: { ...structuredClone(fabric), fabricDigestSha256: flipHex(fabric.fabricDigestSha256) } };
  probes.set("fabric-self-digest-drift", [t, s]);

  t = structuredClone(matrix);
  s = { ...sources, fabric: { ...structuredClone(fabric), editions: fabric.editions.map((e, i) => (i === 0 ? { ...e, evidenceIdSetSha256: flipHex(e.evidenceIdSetSha256) } : e)) } };
  probes.set("fabric-evidence-ids-drift", [t, s]);

  t = structuredClone(matrix);
  s = { ...sources, fabric: { ...structuredClone(fabric), editions: fabric.editions.map((e, i) => (i === 0 ? { ...e, sameAtomicFactInventoryDigest: false } : e)) } };
  probes.set("fabric-parity-flag-drift", [t, s]);

  t = structuredClone(matrix);
  t.matrixDigestSha256 = flipHex(t.matrixDigestSha256);
  probes.set("matrix-self-digest-drift", [t, { ...sources }]);

  t = structuredClone(matrix);
  t.taskBinding.taskCount = 31;
  probes.set("task-binding-drift", [t, { ...sources }]);

  t = structuredClone(matrix);
  t.arms.pop();
  probes.set("missing-arm", [t, { ...sources }]);

  t = structuredClone(matrix);
  t.arms[0].editions = ["K0_STATIC"];
  probes.set("arm-editions-drift", [t, { ...sources }]);

  t = structuredClone(matrix);
  t.arms[0].modelProfileId = SMALL_PROFILE_ID;
  probes.set("arm-bound-to-wrong-profile", [t, { ...sources }]);

  t = structuredClone(matrix);
  t.renderingBindings.RAW.K0_STATIC = flipHex(t.renderingBindings.RAW.K0_STATIC);
  probes.set("representation-binding-drift", [t, { ...sources }]);

  t = structuredClone(matrix);
  t.guidanceBinding.armId = "ARM-SSF-04";
  probes.set("guidance-binding-drift", [t, { ...sources }]);

  t = structuredClone(matrix);
  t.generation.seeds = [1, 2, 3];
  probes.set("seed-drift", [t, { ...sources }]);

  t = structuredClone(matrix);
  t.generation.seedListSha256 = flipHex(t.generation.seedListSha256);
  probes.set("seed-list-digest-drift", [t, { ...sources }]);

  t = structuredClone(matrix);
  t.inputDerivation.identityKey = "identity:<sha256(taskId|editionId)>";
  probes.set("input-derivation-contract-drift", [t, { ...sources }]);

  t = structuredClone(matrix);
  t.operatingModel.processVariantIntroduced = true;
  probes.set("operating-model-variant", [t, { ...sources }]);

  t = structuredClone(matrix);
  t.executionMode.modelInvocation = true;
  probes.set("execution-mode-not-ephemeral", [t, { ...sources }]);

  t = structuredClone(matrix);
  t.claimGate.preExecutionStatus = "PASS";
  probes.set("pre-execution-claim-status-pass", [t, { ...sources }]);

  t = structuredClone(matrix);
  t.abContrastPlan.reports.pop();
  probes.set("contrast-report-missing", [t, { ...sources }]);

  t = structuredClone(matrix);
  t.abContrastPlan.reports[0].preExecutionStatus = "EXECUTED";
  probes.set("contrast-status-pass", [t, { ...sources }]);

  t = structuredClone(matrix);
  t.abContrastPlan.reports.find((r) => r.reportId === "AB-STRUCTURED-VS-RAW-LARGE").treatmentArmId = "ARM-SRF-02";
  probes.set("contrast-isolation-drift", [t, { ...sources }]);

  t = structuredClone(matrix);
  t.abContrastPlan.reports[0].pairedExecutionsPerEdition = 95;
  probes.set("contrast-arithmetic-drift", [t, { ...sources }]);

  t = structuredClone(matrix);
  t.publicSafeEvidence.rawTaskBytesPublished = true;
  probes.set("public-safety-violation", [t, { ...sources }]);

  t = structuredClone(matrix);
  t.receipt.currentEvidenceVerdict = "EARLY_SUCCESS";
  probes.set("receipt-verdict-drift", [t, { ...sources }]);

  t = structuredClone(matrix);
  s = {
    ...sources,
    l2Template: {
      ...structuredClone(l2Template),
      taskPartition: { ...l2Template.taskPartition, tasks: l2Template.taskPartition.tasks.slice(0, 31) },
    },
  };
  probes.set("input-count-drift", [t, s]);

  const failures = [];
  for (const [name, [probe, probeSources]] of probes) {
    const errors = validateAblationMatrix(probe, probeSources);
    if (errors.length === 0) failures.push(`${name}: probe unexpectedly VALIDATED`);
  }
  for (const name of PROBE_NAMES) {
    if (!probes.has(name)) failures.push(`${name}: probe not constructed`);
  }
  assert.deepEqual(failures, [], failures.join("\n"));
});

test("fail-closed: each probe is rejected with a stable rejection code", () => {
  const expectCode = (name, code) => {
    const t = structuredClone(matrix);
    const s = { ...sources };
    switch (name) {
      case "protocol-digest-drift":
        t.protocol.protocolDigestSha256 = flipHex(t.protocol.protocolDigestSha256);
        break;
      case "receipt-digest-drift":
        s.decisionBytes = Buffer.concat([Buffer.from([decisionBytes[0] ^ 0xff]), decisionBytes.subarray(1)]);
        break;
      case "l1-manifest-mismatch":
        s.l1Manifest = { ...l1Manifest, manifestId: "CKS-05-DRIFTED" };
        break;
      case "fabric-evidence-ids-drift":
        s.fabric = { ...fabric, editions: fabric.editions.map((e, i) => (i === 0 ? { ...e, evidenceIdSetSha256: flipHex(e.evidenceIdSetSha256) } : e)) };
        break;
      case "fabric-parity-flag-drift":
        s.fabric = { ...fabric, editions: fabric.editions.map((e, i) => (i === 0 ? { ...e, sameAtomicFactInventoryDigest: false } : e)) };
        break;
      case "matrix-self-digest-drift":
        t.matrixDigestSha256 = flipHex(t.matrixDigestSha256);
        break;
      case "task-binding-drift":
        t.taskBinding.taskCount = 31;
        break;
      case "missing-arm":
        t.arms.pop();
        break;
      case "arm-editions-drift":
        t.arms[0].editions = ["K0_STATIC"];
        break;
      case "arm-bound-to-wrong-profile":
        t.arms[0].modelProfileId = SMALL_PROFILE_ID;
        break;
      case "representation-binding-drift":
        t.renderingBindings.RAW.K0_STATIC = flipHex(t.renderingBindings.RAW.K0_STATIC);
        break;
      case "guidance-binding-drift":
        t.guidanceBinding.armId = "ARM-SSF-04";
        break;
      case "seed-drift":
        t.generation.seeds = [1, 2, 3];
        break;
      case "input-derivation-contract-drift":
        t.inputDerivation.identityKey = "identity:<sha256(taskId|editionId)>";
        break;
      case "operating-model-variant":
        t.operatingModel.processVariantIntroduced = true;
        break;
      case "execution-mode-not-ephemeral":
        t.executionMode.modelInvocation = true;
        break;
      case "pre-execution-claim-status-pass":
        t.claimGate.preExecutionStatus = "PASS";
        break;
      case "contrast-report-missing":
        t.abContrastPlan.reports.pop();
        break;
      case "contrast-isolation-drift":
        t.abContrastPlan.reports.find((r) => r.reportId === "AB-STRUCTURED-VS-RAW-LARGE").treatmentArmId = "ARM-SRF-02";
        break;
      case "public-safety-violation":
        t.publicSafeEvidence.rawTaskBytesPublished = true;
        break;
      case "receipt-verdict-drift":
        t.receipt.currentEvidenceVerdict = "EARLY_SUCCESS";
        break;
      case "input-count-drift":
        s.l2Template = { ...l2Template, taskPartition: { ...l2Template.taskPartition, tasks: l2Template.taskPartition.tasks.slice(0, 31) } };
        break;
      default:
        throw new Error(`unexpected probe name ${name}`);
    }
    const errors = validateAblationMatrix(t, s);
    assert.ok(errors.length > 0, `${name} must be rejected`);
    assert.ok(
      errors.some((e) => e.startsWith(`${code}:`)),
      `${name}: expected code ${code}, got ${errors.join(" | ")}`,
    );
  };
  expectCode("protocol-digest-drift", "PROTOCOL_DIGEST_DRIFT");
  expectCode("receipt-digest-drift", "RECEIPT_DIGEST_DRIFT");
  expectCode("l1-manifest-mismatch", "L1_MANIFEST_MISMATCH");
  expectCode("fabric-evidence-ids-drift", "FABRIC_EVIDENCE_IDS_DRIFT");
  expectCode("fabric-parity-flag-drift", "FABRIC_PARITY_FLAG_DRIFT");
  expectCode("matrix-self-digest-drift", "MATRIX_SELF_DIGEST_DRIFT");
  expectCode("task-binding-drift", "TASK_BINDING_DRIFT");
  expectCode("missing-arm", "ARM_SET_DRIFT");
  expectCode("arm-editions-drift", "EDITION_SET_DRIFT");
  expectCode("arm-bound-to-wrong-profile", "ARM_PROFILE_MISMATCH");
  expectCode("representation-binding-drift", "REPRESENTATION_BINDING_DRIFT");
  expectCode("guidance-binding-drift", "GUIDANCE_BINDING_DRIFT");
  expectCode("seed-drift", "SEED_DRIFT");
  expectCode("input-derivation-contract-drift", "INPUT_DERIVATION_CONTRACT_DRIFT");
  expectCode("operating-model-variant", "OPERATING_MODEL_DRIFT");
  expectCode("execution-mode-not-ephemeral", "EXECUTION_MODE_NOT_EPHEMERAL");
  expectCode("pre-execution-claim-status-pass", "CLAIM_GATE_NOT_DENY");
  expectCode("contrast-report-missing", "CONTRAST_SET_DRIFT");
  expectCode("contrast-isolation-drift", "CONTRAST_ARM_BINDING_DRIFT");
  expectCode("public-safety-violation", "PUBLIC_SAFETY_VIOLATION");
  expectCode("receipt-verdict-drift", "RECEIPT_VERDICT_DRIFT");
  expectCode("input-count-drift", "INPUT_COUNT_DRIFT");
});