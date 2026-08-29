#!/usr/bin/env node
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { resolve, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";

import { ccpDigestDomainV1 } from "../dist/packages/contracts/src/ccp-event-envelope.js";
import { canonicalJson } from "../dist/packages/contracts/src/canonical-json.js";
import { replayCcpSyntheticProfileV1 } from "../dist/packages/contracts/src/ccp-deterministic-replay.js";
import { verifyCcpSyntheticProfileV1 } from "../dist/packages/contracts/src/ccp-profile-generator.js";
import {
  composeCcpFaultRecoveryV1,
  verifyCcpFaultRecoveryReceiptV1,
} from "../dist/packages/contracts/src/ccp-fault-recovery.js";
import {
  issueCcpRecoveryReadbackReceiptV1,
  verifyCcpRecoveryReadbackReceiptV1,
} from "../dist/packages/contracts/src/ccp-recovery-readback.js";
import {
  evaluateCcpTrainGateV1,
} from "../dist/packages/contracts/src/ccp-component-train.js";
import {
  lockCcpVerificationTupleV1,
} from "../dist/packages/contracts/src/ccp-tuple-lock.js";
import {
  makeCcpLkgStateV1,
  makeCcpPromotionDecisionV1,
  promoteCcpLkgV1,
} from "../dist/packages/contracts/src/ccp-lkg-restore.js";
import {
  projectCcpContributorStatusV1,
  parseCcpContributorStatusInputV1,
} from "../dist/packages/contracts/src/ccp-contributor-status.js";

const ROOT = resolve(fileURLToPath(new URL("..", import.meta.url)));
const DEFAULT_INPUT = resolve(ROOT, "tests/fixtures/ccp-evidence/complete.json");
const DOCS_PATH = resolve(ROOT, "docs/ccp-m1-local-proof.md");
const PACKET_SCHEMA = "cm.ccp-m1-local-proof-packet/v1";
const HARNESS_SCHEMA = "cm.ccp-m1-local-proof-readback-input/v1";
const TASK_ID = "TERRA-PSAI52-ROOT-QS-01";
const PROFILE_RATES = [10, 50, 100, 1_000, 10_000];

const REQUIRED_KEYS = [
  "artifacts", "binding", "criterionMatrix", "evidenceClass", "externalRequestMade", "faultRecovery",
  "governingReceipt", "infrastructure", "newProcessVariantIntroduced", "nonClaims", "operatingModel",
  "preparedExternalActions", "preservedDecisions", "profiles", "schemaVersion", "statusReasons", "taskId",
  "tupleAndLkg",
];

function fail(code, detail = "") {
  throw new Error(`${code}${detail ? `: ${detail}` : ""}`);
}

function readJson(path) {
  try {
    return JSON.parse(readFileSync(path, "utf8"));
  } catch (error) {
    fail("CCP_M1_EVIDENCE_INPUT_UNREADABLE", `${path}: ${error.message}`);
  }
}

function digestFile(path) {
  return createHash("sha256").update(readFileSync(path)).digest("hex");
}

function assertExactKeys(value, keys, code) {
  if (value === null || typeof value !== "object" || Array.isArray(value)) fail(code);
  const actual = Object.keys(value).sort();
  const expected = [...keys].sort();
  if (canonicalJson(actual) !== canonicalJson(expected)) fail(code);
}

function assertEqual(actual, expected, code) {
  if (canonicalJson(actual) !== canonicalJson(expected)) {
    fail(code, `expected ${canonicalJson(expected)}, got ${canonicalJson(actual)}`);
  }
}

function repoPath(value, code = "CCP_M1_EVIDENCE_PATH_DENIED") {
  if (typeof value !== "string" || value.startsWith("/") || value.includes("\\") || value.split("/").includes("..")) fail(code);
  const absolute = resolve(ROOT, value);
  if (relative(ROOT, absolute).startsWith(`..${sep}`) || relative(ROOT, absolute) === "..") fail(code);
  return absolute;
}

function publicDigest(value) {
  return ccpDigestDomainV1(PACKET_SCHEMA, value);
}

function requireFalse(value, code) {
  if (value !== false) fail(code);
}

function gitSucceeds(args) {
  const result = spawnSync("git", args, { cwd: ROOT, encoding: "utf8" });
  return result.error === undefined && result.status === 0;
}

function gitOutput(args) {
  const result = spawnSync("git", args, { cwd: ROOT, encoding: "utf8" });
  return result.error === undefined && result.status === 0 ? result.stdout.trim() : null;
}

function projectInfrastructure(infrastructure) {
  const keys = [
    "actualWorkspacePath", "declaredWorkspacePath", "declaredWorkspacePathPresent", "dockerEnoentObserved",
    "nodeVersion", "pathMappingNote", "rendererExitCode", "sigtrapObserved",
  ];
  assertExactKeys(infrastructure, keys, "CCP_M1_EVIDENCE_INFRASTRUCTURE_DENIED");
  if (typeof infrastructure.actualWorkspacePath !== "string" || infrastructure.actualWorkspacePath.length === 0
    || typeof infrastructure.declaredWorkspacePath !== "string" || infrastructure.declaredWorkspacePath.length === 0
    || infrastructure.declaredWorkspacePathPresent !== true
    || infrastructure.dockerEnoentObserved !== false
    || infrastructure.nodeVersion !== "v24.19.0"
    || typeof infrastructure.pathMappingNote !== "string"
    || !infrastructure.pathMappingNote.includes("infrastructure evidence, not a product verdict")
    || infrastructure.rendererExitCode !== 133
    || infrastructure.sigtrapObserved !== true) {
    fail("CCP_M1_EVIDENCE_INFRASTRUCTURE_DENIED");
  }
  return {
    nodeVersion: infrastructure.nodeVersion,
    rendererExitCode: infrastructure.rendererExitCode,
    sigtrapObserved: infrastructure.sigtrapObserved,
    dockerEnoentObserved: infrastructure.dockerEnoentObserved,
  };
}

function validateInput(input) {
  assertExactKeys(input, REQUIRED_KEYS, "CCP_M1_EVIDENCE_INPUT_SCHEMA_DENIED");
  if (input.schemaVersion !== "cm.ccp-m1-evidence-input/v1" || input.taskId !== TASK_ID) fail("CCP_M1_EVIDENCE_INPUT_SCHEMA_DENIED");
  if (input.evidenceClass !== "LOCAL_SYNTHETIC" || input.operatingModel !== "Operating Model v1.1") fail("CCP_M1_EVIDENCE_BOUNDARY_DENIED");
  if (input.externalRequestMade !== false || input.newProcessVariantIntroduced !== false) fail("CCP_M1_EVIDENCE_AUTHORITY_DENIED");
  if (canonicalJson(input.preservedDecisions) !== canonicalJson(["D-001", "D-002", "D-003", "D-004", "D-005", "D-006", "D-007"])) fail("CCP_M1_EVIDENCE_DECISIONS_DENIED");
  if (input.binding.baseRef !== "origin/main" || input.binding.diffCheck !== "PASS"
    || !/^[a-f0-9]{40}$/.test(input.binding.baseCommit)
    || input.binding.mergeBaseCommit !== input.binding.baseCommit
    || !/^[a-f0-9]{40}$/.test(input.binding.headCommit)
    || input.binding.repository !== "JoFe2/PANSPHAIRA") fail("CCP_M1_EVIDENCE_BINDING_DENIED");
  const currentHead = gitOutput(["rev-parse", "HEAD"]);
  if (currentHead === null
    || !gitSucceeds(["merge-base", "--is-ancestor", input.binding.headCommit, currentHead])
    || !gitSucceeds(["merge-base", "--is-ancestor", input.binding.baseCommit, input.binding.headCommit])
    || !gitSucceeds(["rev-parse", `${input.binding.headCommit}^{tree}`])) {
    fail("CCP_M1_EVIDENCE_BINDING_DENIED");
  }
  if (!Array.isArray(input.criterionMatrix) || input.criterionMatrix.length !== 6) fail("CCP_M1_EVIDENCE_CRITERIA_DENIED");
  if (!Array.isArray(input.profiles) || input.profiles.length !== PROFILE_RATES.length) fail("CCP_M1_EVIDENCE_PROFILES_DENIED");
  if (!Array.isArray(input.faultRecovery) || input.faultRecovery.length !== 4) fail("CCP_M1_EVIDENCE_RECOVERY_DENIED");
  if (!Array.isArray(input.statusReasons) || input.statusReasons.length !== 4) fail("CCP_M1_EVIDENCE_STATUS_DENIED");
  if (!Array.isArray(input.preparedExternalActions) || input.preparedExternalActions.length === 0) fail("CCP_M1_EVIDENCE_READBACK_FIELDS_DENIED");
  for (const action of input.preparedExternalActions) {
    if (action.externalRequestMade !== false || action.status !== "PREPARED_LOCAL_ONLY"
      || !Array.isArray(action.readbackFields) || action.readbackFields.length === 0
      || !Array.isArray(action.localEvidenceFields) || action.localEvidenceFields.length === 0) {
      fail("CCP_M1_EVIDENCE_READBACK_FIELDS_DENIED");
    }
  }
  for (const claim of input.criterionMatrix) {
    if (claim.receiptStatus !== "BOUND_NOT_PROVEN" || claim.localSyntheticState.length === 0
      || !Array.isArray(claim.localEvidenceRefs) || claim.localEvidenceRefs.length === 0) fail("CCP_M1_EVIDENCE_CRITERIA_DENIED");
    for (const ref of claim.localEvidenceRefs) repoPath(ref);
  }
}

function verifyArtifacts(input) {
  if (!Array.isArray(input.artifacts) || input.artifacts.length === 0) fail("CCP_M1_EVIDENCE_ARTIFACTS_DENIED");
  for (const artifact of input.artifacts) {
    if (typeof artifact.path !== "string" || !/^[a-f0-9]{64}$/.test(artifact.sha256)) fail("CCP_M1_EVIDENCE_ARTIFACTS_DENIED");
    const path = repoPath(artifact.path);
    if (digestFile(path) !== artifact.sha256) fail("CCP_M1_EVIDENCE_ARTIFACT_DIGEST_MISMATCH", artifact.path);
  }
  const governingPath = repoPath(input.governingReceipt.path);
  const governing = readJson(governingPath);
  if (governing.receiptType !== "ADR_DECISION_INTEGRATION_RECEIPT"
    || governing.receiptId !== "SOL-PSAI52-STATE-RECONCILE-01"
    || governing.decision?.status !== "ACCEPTED"
    || governing.decision?.authorityGranted !== false
    || governing.decision?.acceptanceProofStatus !== "NOT_CLAIMED_BY_THIS_RECEIPT"
    || governing.decision?.deliveryStatus !== "LOCAL_RECEIPT_ONLY") fail("CCP_M1_GOVERNING_RECEIPT_DENIED");
  if (digestFile(governingPath) !== input.governingReceipt.sha256) fail("CCP_M1_GOVERNING_RECEIPT_DIGEST_MISMATCH");
  return {
    receiptType: governing.receiptType,
    decisionStatus: governing.decision.status,
    acceptanceProofStatus: governing.decision.acceptanceProofStatus,
    deliveryStatus: governing.decision.deliveryStatus,
    authorityGranted: governing.decision.authorityGranted,
  };
}

function projectProfile(inputProfile) {
  const path = repoPath(inputProfile.path);
  const source = readJson(path);
  const verifiedProfile = verifyCcpSyntheticProfileV1(source);
  if (verifiedProfile === null) fail("CCP_M1_PROFILE_RECEIPT_UNVERIFIED", inputProfile.path);
  const replay = replayCcpSyntheticProfileV1(source);
  if (replay.eventsPerHour !== inputProfile.eventsPerHour || replay.profileId !== inputProfile.profileId
    || replay.seed !== inputProfile.seed || replay.decision !== "REPLAY_MATCH"
    || replay.evidenceComplete !== true || replay.canonicalBytesMatch !== true || replay.coverageCountsMatch !== true) {
    fail("CCP_M1_PROFILE_RECEIPT_MISMATCH", inputProfile.path);
  }
  assertEqual(replay, inputProfile.replayReceipt, "CCP_M1_PROFILE_RECEIPT_MISMATCH");
  return {
    profileId: replay.profileId,
    eventsPerHour: replay.eventsPerHour,
    seed: replay.seed,
    inputEventCount: replay.inputEventCount,
    inputCanonicalBytesDigest: replay.inputCanonicalBytesDigest,
    replayCanonicalBytesDigest: replay.replayCanonicalBytesDigest,
    canonicalBytesMatch: replay.canonicalBytesMatch,
    coverageCountsMatch: replay.coverageCountsMatch,
    expectedCoverage: replay.expectedCoverage,
    replayCoverage: replay.replayCoverage,
    decision: replay.decision,
    evidenceComplete: replay.evidenceComplete,
    receiptDigest: replay.receiptDigest,
    ledgerDigest: replay.ledgerDigest,
    supersessionDigest: replay.supersessionDigest,
    timingObserved: replay.timingObserved,
    throughputMeasured: replay.throughputMeasured,
    capacityEvidence: replay.capacityEvidence,
  };
}

function projectRecovery(inputRecovery) {
  const path = repoPath(inputRecovery.path);
  const source = readJson(path);
  const recovery = composeCcpFaultRecoveryV1(source);
  if (verifyCcpFaultRecoveryReceiptV1(recovery) === null
    || recovery.disposition !== "RECOVERY_CONFIRMED"
    || recovery.recoveryEvidenceComplete !== true
    || recovery.zeroResidue !== true
    || recovery.runnerReleased !== true) fail("CCP_M1_RECOVERY_RECEIPT_UNVERIFIED", inputRecovery.path);
  assertEqual({
    cleanupComplete: recovery.zeroResidue && recovery.runnerReleased,
    faultClass: recovery.faultClass,
    faultCode: recovery.faultCode,
    lkgReadbackBehavior: recovery.lkgBehavior,
    logicalAtMs: recovery.logicalAtMs,
    path: inputRecovery.path,
    remainingOwnedResourceRefs: recovery.cleanupReceipt.observation.remainingResourceRefs.length,
    sloObservation: {
      attempts: recovery.sloObservation.attempts,
      failed: recovery.sloObservation.failed,
      recovered: recovery.sloObservation.recovered,
      targetRecoveryRateBps: recovery.sloObservation.targetRecoveryRateBps,
    },
  }, inputRecovery, "CCP_M1_RECOVERY_RECEIPT_MISMATCH");
  const readback = issueCcpRecoveryReadbackReceiptV1({
    schemaVersion: "cm.ccp-recovery-readback-input/v1",
    taskId: "QWEN-PSAI52-FAILURE-RECOVERY-09",
    recoveryReceipt: recovery,
    logicalAtMs: recovery.logicalAtMs + 1,
  });
  if (verifyCcpRecoveryReadbackReceiptV1(readback) === null || readback.readbackDisposition !== "READBACK_CONFIRMED") {
    fail("CCP_M1_RECOVERY_READBACK_UNVERIFIED", inputRecovery.path);
  }
  return {
    path: inputRecovery.path,
    faultClass: recovery.faultClass,
    faultCode: recovery.faultCode,
    logicalAtMs: recovery.logicalAtMs,
    disposition: recovery.disposition,
    transition: recovery.transition,
    recoveryEvidenceComplete: recovery.recoveryEvidenceComplete,
    cleanup: {
      cleanupRequired: recovery.cleanupRequired,
      zeroResidue: recovery.zeroResidue,
      runnerReleased: recovery.runnerReleased,
      remainingOwnedResourceRefs: recovery.cleanupReceipt.observation.remainingResourceRefs.length,
    },
    slo: recovery.sloMetrics,
    lkg: {
      behavior: recovery.lkgBehavior,
      beforeLkgDigest: recovery.lkgReadback.beforeState.lkgDigest,
      afterLkgDigest: recovery.lkgReadback.afterState.lkgDigest,
      beforeGeneration: recovery.lkgReadback.beforeState.generation,
      afterGeneration: recovery.lkgReadback.afterState.generation,
      exact: readback.lkg.exact,
      transitionDigest: recovery.lkgReadback.transitionDigest,
    },
    recoveryReceiptDigest: recovery.receiptDigest,
    readbackReceiptDigest: readback.readbackDigest,
    verificationClaimed: readback.verificationClaimed,
    executionAuthorized: readback.executionAuthorized,
    promotionAuthorized: readback.promotionAuthorized,
    mergeAuthorized: readback.mergeAuthorized,
  };
}

function projectTupleAndLkg(input) {
  const greenPath = repoPath(input.tupleAndLkg.green.path);
  const failedPath = repoPath(input.tupleAndLkg.failedPromotion.path);
  const green = readJson(greenPath);
  const failed = readJson(failedPath);
  const greenLock = lockCcpVerificationTupleV1(green.tuple);
  const failedLock = lockCcpVerificationTupleV1(failed.tuple);
  const greenTrain = evaluateCcpTrainGateV1(green.candidate, green.context);
  const stateBefore = makeCcpLkgStateV1(green.lkg);
  const greenDecision = makeCcpPromotionDecisionV1({
    trainReceipt: greenTrain,
    tupleLock: greenLock,
    promoterId: green.promoterId,
    lkgBeforeDigest: stateBefore.lkgDigest,
    lkgGenerationBefore: stateBefore.generation,
  });
  const promoted = promoteCcpLkgV1(stateBefore, greenDecision);
  const failedDecision = makeCcpPromotionDecisionV1({
    trainReceipt: greenTrain,
    tupleLock: failedLock,
    promoterId: green.promoterId,
    lkgBeforeDigest: stateBefore.lkgDigest,
    lkgGenerationBefore: stateBefore.generation,
  });
  if (greenDecision.disposition !== "PROMOTED" || greenDecision.mergeAuthorized !== false
    || failedDecision.disposition !== "HOLD" || failedDecision.mergeAuthorized !== false
    || promoted.state.lkgDigest !== greenDecision.lkgAfterDigest) fail("CCP_M1_TUPLE_LKG_RECEIPT_UNVERIFIED");
  assertEqual({
    tupleSchema: input.tupleAndLkg.tupleSchema,
    green: {
      claimOutcomes: greenLock.claims.map((claim) => [claim.claimId, claim.outcome]),
      lkgDigest: stateBefore.lkgDigest,
      lkgGeneration: stateBefore.generation,
      path: input.tupleAndLkg.green.path,
    },
    failedPromotion: {
      claimOutcomes: failedLock.claims.map((claim) => [claim.claimId, claim.outcome]),
      failedClaim: failedLock.claims.find((claim) => claim.outcome === "FAILED")?.claimId,
      lkgDigest: failed.lkg.lkgDigest,
      lkgGeneration: failed.lkg.generation,
      path: input.tupleAndLkg.failedPromotion.path,
    },
  }, input.tupleAndLkg, "CCP_M1_TUPLE_LKG_RECEIPT_MISMATCH");
  return {
    tupleSchema: input.tupleAndLkg.tupleSchema,
    green: {
      path: input.tupleAndLkg.green.path,
      lockDigest: greenLock.lockDigest,
      claimOutcomes: greenLock.claims.map((claim) => [claim.claimId, claim.outcome]),
      allClaimsPassed: greenLock.allClaimsPassed,
      lkgBefore: {
        lkgDigest: stateBefore.lkgDigest,
        generation: stateBefore.generation,
        stateDigest: stateBefore.stateDigest,
      },
      promotion: {
        disposition: greenDecision.disposition,
        reasonCode: greenDecision.reasonCode,
        decisionDigest: greenDecision.decisionDigest,
        mergeAuthorized: greenDecision.mergeAuthorized,
      },
      lkgAfter: {
        lkgDigest: promoted.state.lkgDigest,
        generation: promoted.state.generation,
        stateDigest: promoted.state.stateDigest,
      },
      transitionDigest: promoted.receipt.transitionDigest,
    },
    failedPromotion: {
      path: input.tupleAndLkg.failedPromotion.path,
      lockDigest: failedLock.lockDigest,
      claimOutcomes: failedLock.claims.map((claim) => [claim.claimId, claim.outcome]),
      failedClaim: failedLock.claims.find((claim) => claim.outcome === "FAILED")?.claimId,
      allClaimsPassed: failedLock.allClaimsPassed,
      disposition: failedDecision.disposition,
      reasonCode: failedDecision.reasonCode,
      decisionDigest: failedDecision.decisionDigest,
      lkgDigest: failed.lkg.lkgDigest,
      lkgGeneration: failed.lkg.generation,
      mergeAuthorized: failedDecision.mergeAuthorized,
    },
  };
}

function statusInputEntries() {
  return [
    ["quarantined", "tests/fixtures/ccp-status/quarantined.json", "quarantined"],
    ["restored", "tests/fixtures/ccp-status/quarantined.json", "restored"],
    ["missing-evidence", "tests/fixtures/ccp-status/missing-evidence.json", null],
    ["rebase-required", "tests/fixtures/ccp-status/rebase-required.json", null],
  ];
}

function projectStatuses(input) {
  return input.statusReasons.map((expected) => {
    const [fallbackId, path, nested] = statusInputEntries().find(([id]) => id === expected.observationId) ?? [];
    if (fallbackId === undefined) fail("CCP_M1_STATUS_SOURCE_DENIED", expected.observationId);
    const source = readJson(repoPath(path));
    const statusInput = nested === null ? source : source[nested];
    const status = projectCcpContributorStatusV1(statusInput);
    parseCcpContributorStatusInputV1(statusInput);
    const publicState = {
      admissionState: statusInput.admissionState,
      headState: statusInput.headState,
      lkgState: statusInput.lkgState,
      migrationState: statusInput.migrationState,
      queued: statusInput.queued,
    };
    assertEqual({
      missingEvidenceRefs: status.status === "MISSING_EVIDENCE"
        ? statusInput.requiredEvidenceRefs.filter((ref) => !statusInput.presentEvidenceRefs.includes(ref)) : [],
      observationId: expected.observationId,
      publicState,
      reason: expected.reason,
      sourcePath: path,
    }, expected, "CCP_M1_STATUS_REASON_MISMATCH");
    return {
      observationId: expected.observationId,
      status: status.status,
      reasonCode: status.reasonCode,
      nextAction: status.nextAction,
      publicState,
      evidence: status.evidence,
      missingEvidenceRefs: expected.missingEvidenceRefs,
      reason: expected.reason,
      sourcePath: path,
      statusDigest: status.statusDigest,
      mergeAuthorized: status.mergeAuthorized,
      queueStateChanged: status.queueStateChanged,
      readOnly: status.readOnly,
    };
  });
}

function projectPreparedActions(actions) {
  return actions.map((action) => ({
    actionId: action.actionId,
    status: action.status,
    externalRequestMade: false,
    readbackFields: [...action.readbackFields],
    localEvidenceFields: [...action.localEvidenceFields],
  }));
}

function renderPacket(input) {
  validateInput(input);
  const governingDecision = verifyArtifacts(input);
  const infrastructure = projectInfrastructure(input.infrastructure);
  const profiles = input.profiles.map(projectProfile);
  if (canonicalJson(profiles.map((profile) => profile.eventsPerHour)) !== canonicalJson(PROFILE_RATES)) fail("CCP_M1_PROFILE_ORDER_DENIED");
  const faultRecovery = input.faultRecovery.map(projectRecovery);
  const tupleAndLkg = projectTupleAndLkg(input);
  const statuses = projectStatuses(input);
  for (const item of statuses) {
    if (item.mergeAuthorized !== false || item.queueStateChanged !== false || item.readOnly !== true) fail("CCP_M1_STATUS_AUTHORITY_DENIED");
  }
  const packet = {
    schemaVersion: PACKET_SCHEMA,
    taskId: TASK_ID,
    evidenceClass: "LOCAL_SYNTHETIC",
    boundary: {
      scope: "LOCAL_DETERMINISTIC_SYNTHETIC_RECEIPTS_ONLY",
      production: false,
      externalRequestMade: false,
      verificationClaimed: false,
      executionAuthorized: false,
      promotionAuthorized: false,
      mergeAuthorized: false,
      newProcessVariantIntroduced: false,
      operatingModel: input.operatingModel,
      preservedDecisions: input.preservedDecisions,
    },
    binding: {
      repository: input.binding.repository,
      branch: input.binding.branch,
      baseRef: input.binding.baseRef,
      baseCommit: input.binding.baseCommit,
      mergeBaseCommit: input.binding.mergeBaseCommit,
      headCommit: input.binding.headCommit,
      diffCheck: input.binding.diffCheck,
    },
    infrastructure,
    governingReceipt: {
      receiptId: "SOL-PSAI52-STATE-RECONCILE-01",
      path: input.governingReceipt.path,
      receiptDigest: input.governingReceipt.receiptDigest,
      sha256: input.governingReceipt.sha256,
      ...governingDecision,
    },
    criteria: input.criterionMatrix.map((criterion) => ({
      criterionId: criterion.criterionId,
      criterion: criterion.criterion,
      localSyntheticState: criterion.localSyntheticState,
      receiptStatus: criterion.receiptStatus,
      localEvidenceRefs: criterion.localEvidenceRefs,
      successorProof: criterion.successorProof,
    })),
    profiles,
    faultRecovery,
    tupleAndLkg,
    statusReasons: statuses,
    preparedExternalActions: projectPreparedActions(input.preparedExternalActions),
    artifactCount: input.artifacts.length,
    nonClaims: [...input.nonClaims],
  };
  const packetDigest = publicDigest(packet);
  const readbackHarnessInput = {
    schemaVersion: HARNESS_SCHEMA,
    taskId: TASK_ID,
    packetSchemaVersion: PACKET_SCHEMA,
    packetDigest,
    externalRequestMade: false,
    sourceBoundary: "LOCAL_SYNTHETIC_NON_PRODUCTION",
    expectedReadback: {
      exactBaseCommit: input.binding.baseCommit,
      exactMergeBaseCommit: input.binding.mergeBaseCommit,
      exactHeadCommit: input.binding.headCommit,
      diffCheck: input.binding.diffCheck,
      profileReceiptDigests: profiles.map((profile) => [profile.profileId, profile.receiptDigest]),
      recoveryReceiptDigests: faultRecovery.map((recovery) => [recovery.faultCode, recovery.recoveryReceiptDigest]),
      recoveryReadbackReceiptDigests: faultRecovery.map((recovery) => [recovery.faultCode, recovery.readbackReceiptDigest]),
      greenTupleLockDigest: tupleAndLkg.green.lockDigest,
      greenPromotionDecisionDigest: tupleAndLkg.green.promotion.decisionDigest,
      failedTupleLockDigest: tupleAndLkg.failedPromotion.lockDigest,
      failedPromotionDecisionDigest: tupleAndLkg.failedPromotion.decisionDigest,
      statusDigests: statuses.map((status) => [status.observationId, status.statusDigest]),
    },
    preparedExternalActions: packet.preparedExternalActions.map((action) => ({
      actionId: action.actionId,
      externalRequestMade: false,
      localEvidenceFields: action.localEvidenceFields,
      readbackFields: action.readbackFields,
    })),
  };
  return { packet, packetDigest, readbackHarnessInput };
}

function markdown({ packet, packetDigest, readbackHarnessInput }) {
  const lines = [
    "# CCP-M1 local proof packet",
    "",
    "> Bounded local synthetic evidence only. This packet is redacted, canonical and non-production; it is not a verification, merge, release or deployment result.",
    "",
    `- Task: \`${packet.taskId}\``,
    `- Packet schema: \`${packet.schemaVersion}\``,
    `- Packet digest: \`${packetDigest}\``,
    `- Evidence class: \`${packet.evidenceClass}\``,
    `- External requests made: \`${packet.boundary.externalRequestMade}\``,
    "",
    "## Decision/integration boundary",
    "",
    "| Field | Value |",
    "| --- | --- |",
    `| Governing receipt | \`${packet.governingReceipt.receiptId}\` |`,
    `| Receipt type | \`${packet.governingReceipt.receiptType}\` |`,
    `| Decision status | \`${packet.governingReceipt.decisionStatus}\` |`,
    `| Acceptance proof | \`${packet.governingReceipt.acceptanceProofStatus}\` |`,
    `| Delivery status | \`${packet.governingReceipt.deliveryStatus}\` |`,
    `| Authority granted | \`${packet.governingReceipt.authorityGranted}\` |`,
    "",
    "The accepted decision boundary is preserved verbatim. This local receipt records no acceptance proof and grants no execution, promotion, merge, release or publication authority.",
    "",
    "## Exact base/head binding",
    "",
    "| Field | Value |",
    "| --- | --- |",
    `| Repository | \`${packet.binding.repository}\` |`,
    `| Branch | \`${packet.binding.branch}\` |`,
    `| Base ref | \`${packet.binding.baseRef}\` |`,
    `| Base commit | \`${packet.binding.baseCommit}\` |`,
    `| Merge-base commit | \`${packet.binding.mergeBaseCommit}\` |`,
    `| Head commit | \`${packet.binding.headCommit}\` |`,
    `| \`git diff --check origin/main...HEAD\` | \`${packet.binding.diffCheck}\` |`,
    "",
    "No workspace, credential, provider, customer or private diagnostic values are published here.",
    "",
    "## Local infrastructure observation",
    "",
    `- Default local Node runtime: \`${packet.infrastructure.nodeVersion}\`; renderer exit code: \`${packet.infrastructure.rendererExitCode}\`; SIGTRAP observed: \`${packet.infrastructure.sigtrapObserved}\`; Docker ENOENT observed: \`${packet.infrastructure.dockerEnoentObserved}\`.`,
    "- The default local Node SIGTRAP is infrastructure evidence only, not a product verdict. The authoritative pinned-Node and host-Docker gates remain prepared local-only readbacks.",
    "",
    "## Criterion matrix",
    "",
    "| ID | Local synthetic state | Receipt status | Evidence refs |",
    "| --- | --- | --- | --- |",
    ...packet.criteria.map((criterion) => `| \`${criterion.criterionId}\` | ${criterion.localSyntheticState} | ${criterion.receiptStatus} | ${criterion.localEvidenceRefs.map((ref) => `\`${ref}\``).join(", ")} |`),
    "",
    "Every criterion remains `BOUND_NOT_PROVEN`; successor proof is listed in the canonical packet JSON below and is not claimed by this local packet.",
    "",
    "## Five profile replay comparison",
    "",
    "| Profile | Events/hour label | Input events | Canonical bytes | Coverage | Decision | Receipt digest |",
    "| --- | ---: | ---: | --- | --- | --- | --- |",
    ...packet.profiles.map((profile) => `| \`${profile.profileId}\` | ${profile.eventsPerHour} | ${profile.inputEventCount} | ${profile.canonicalBytesMatch} | ${profile.coverageCountsMatch} | ${profile.decision} | \`${profile.receiptDigest}\` |`),
    "",
    "The labels are fixture cardinalities only. Timing, throughput and capacity evidence are explicitly false.",
    "",
    "## Fault recovery and readback",
    "",
    "| Fault | Transition | Recovery | Cleanup | LKG behavior | Exact readback |",
    "| --- | --- | --- | --- | --- | --- |",
    ...packet.faultRecovery.map((recovery) => `| ${recovery.faultCode} | ${recovery.transition} | ${recovery.disposition} | zero residue=${recovery.cleanup.zeroResidue}, released=${recovery.cleanup.runnerReleased} | ${recovery.lkg.behavior} | ${recovery.lkg.exact} |`),
    "",
    "Recovery receipts describe injected local transitions only; they do not retry external work or authorize execution, promotion or merge.",
    "",
    "## Tuple and LKG",
    "",
    `- Green tuple lock: \`${packet.tupleAndLkg.green.lockDigest}\`; all claims passed: \`${packet.tupleAndLkg.green.allClaimsPassed}\`; promotion decision: \`${packet.tupleAndLkg.green.promotion.disposition}\`; merge authorized: \`${packet.tupleAndLkg.green.promotion.mergeAuthorized}\`.`,
    `- Failed-promotion tuple lock: \`${packet.tupleAndLkg.failedPromotion.lockDigest}\`; failed claim: \`${packet.tupleAndLkg.failedPromotion.failedClaim}\`; decision: \`${packet.tupleAndLkg.failedPromotion.disposition}\`; merge authorized: \`${packet.tupleAndLkg.failedPromotion.mergeAuthorized}\`.`,
    `- Green LKG transition: \`${packet.tupleAndLkg.green.lkgBefore.lkgDigest}\` → \`${packet.tupleAndLkg.green.lkgAfter.lkgDigest}\`; transition digest \`${packet.tupleAndLkg.green.transitionDigest}\`.`,
    "",
    "The tuple lock and LKG transition are evidence records, not merge authority or production LKG state.",
    "",
    "## Status reasons",
    "",
    "| Observation | Status | Reason code | Missing refs | Public state |",
    "| --- | --- | --- | --- | --- |",
    ...packet.statusReasons.map((status) => `| ${status.observationId} | ${status.status} | ${status.reasonCode} | ${status.missingEvidenceRefs.length ? status.missingEvidenceRefs.map((ref) => `\`${ref}\``).join(", ") : "none"} | ${status.publicState.admissionState}/${status.publicState.headState}/${status.publicState.lkgState}/${status.publicState.migrationState}, queued=${status.publicState.queued} |`),
    "",
    "Private status details are omitted; only the public state, reason code and missing public references are rendered.",
    "",
    "## Prepared external actions and readback fields",
    "",
    "No external request is made by this renderer. Each future action remains prepared locally with an explicit readback field list:",
    "",
    ...packet.preparedExternalActions.map((action) => `- \`${action.actionId}\` — ${action.status}; read back: ${action.readbackFields.map((field) => `\`${field}\``).join(", ")}`),
    "",
    "## Explicit nonclaims",
    "",
    ...packet.nonClaims.map((claim) => `- ${claim}`),
    "",
    "## Canonical packet JSON",
    "",
    "```json",
    canonicalJson(packet),
    "```",
    "",
    "## Readback-harness input",
    "",
    "The following input is local preparation only. It records expected fields for a future external readback; it is not an external request or a result from one.",
    "",
    "```json",
    canonicalJson(readbackHarnessInput),
    "```",
  ];
  return `${lines.join("\n")}\n`;
}

function parseArgs(argv) {
  let inputPath = DEFAULT_INPUT;
  let check = false;
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === "--check") check = true;
    else if (argument === "--input") {
      const next = argv[index + 1];
      if (!next) fail("CCP_M1_EVIDENCE_ARGUMENTS_DENIED");
      inputPath = resolve(process.cwd(), next);
      index += 1;
    } else if (argument !== undefined) fail("CCP_M1_EVIDENCE_ARGUMENTS_DENIED", argument);
  }
  return { inputPath, check };
}

const { inputPath, check } = parseArgs(process.argv.slice(2));
const result = renderPacket(readJson(inputPath));
const output = markdown(result);
if (output.includes("/mnt/") || output.includes("/workspace/") || /[\w.+-]+@[\w.-]+/.test(output)) {
  fail("CCP_M1_EVIDENCE_REDACTION_DENIED");
}
if (check) {
  if (readFileSync(DOCS_PATH, "utf8") !== output) fail("CCP_M1_EVIDENCE_DOC_STALE");
} else {
  writeFileSync(DOCS_PATH, output);
}
process.stdout.write(`${JSON.stringify({
  status: "PASS",
  packetDigest: result.packetDigest,
  readbackHarnessInput: result.readbackHarnessInput,
})}\n`);
