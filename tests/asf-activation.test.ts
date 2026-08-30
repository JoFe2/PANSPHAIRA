import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  ASF_ACTIVATION_AUTHORITY_V1,
  ASF_ACTIVATION_EXIT_CODES_V1,
  ASF_ACTIVATION_RUNTIME_EFFECT_V1,
  ASF_LIFECYCLE_INTEGRATION_AUTHORITY_V1,
  ASF_LIFECYCLE_INTEGRATION_EXIT_CODES_V1,
  activateAsfGenerationExplicitV1,
  asfActivationReceiptDigestV1,
  asfLifecycleIntegrationReceiptDigestV1,
  decideAsfLifecycleIntegrationV1,
  parseAsfActivationV1,
  parseAsfLifecycleIntegrationV1,
  validateAsfActivationReceiptV1,
  validateAsfLifecycleIntegrationReceiptV1,
  type AsfActivationInputV1,
  type AsfActivationReasonCodeV1,
  type AsfLifecycleIntegrationInputV1,
  type AsfLifecycleIntegrationReasonCodeV1,
} from "../packages/contracts/src/asf-activation.js";
import { canonicalJson } from "../packages/contracts/src/canonical-json.js";
import { ASF_ASSIGNMENT_LKG_MODE_V1 } from "../packages/contracts/src/asf-assignment.js";
import type { AsfCompatibilityMatrixDocumentV1 } from "../packages/contracts/src/asf-compatibility-fence.js";

const acceptedInstall = JSON.parse(readFileSync("tests/fixtures/asf-inactive-install/accepted.json", "utf8")) as Record<string, any>;
const matrix = JSON.parse(readFileSync("tests/fixtures/asf-compatibility/matrix.json", "utf8")) as AsfCompatibilityMatrixDocumentV1;
const exactLkgFixture = JSON.parse(readFileSync("tests/fixtures/asf-rollback/exact-lkg.json", "utf8")) as Record<string, any>;
const targetRowCandidate = matrix.rows.find((row) => row.profileId === "profile:qwen.safe");
if (targetRowCandidate === undefined) throw new Error("activation fixture requires profile:qwen.safe");
const targetRow: AsfCompatibilityMatrixDocumentV1["rows"][number] = targetRowCandidate;

function fixture(name: string): Record<string, any> {
  return JSON.parse(readFileSync(`tests/fixtures/asf-activation/${name}.json`, "utf8")) as Record<string, any>;
}

function inputFor(name = "explicit-accept"): AsfActivationInputV1 {
  const envelope = fixture(name);
  const { verdict: _verdict, ...assignment } = targetRow;
  return {
    schemaVersion: "chimpmaera.asf/activation/v1",
    activationRequest: envelope.activationRequest,
    analysisReceipt: acceptedInstall.analysisReceipt,
    analysisStatus: "FRESH",
    approval: envelope.approval,
    assignment: { ...assignment, state: "ENABLED" },
    generation: {
      generationDigest: acceptedInstall.generation.generationDigest,
      lockDigest: acceptedInstall.generation.lockDigest,
      skillId: acceptedInstall.generation.skillId,
      version: acceptedInstall.generation.version,
    },
    installed: [
      ...acceptedInstall.installed,
      {
        generationDigest: acceptedInstall.generation.generationDigest,
        lockDigest: acceptedInstall.generation.lockDigest,
        skillId: acceptedInstall.generation.skillId,
        state: "installed_inactive",
        version: acceptedInstall.generation.version,
      },
    ],
    lock: {
      generationDigest: acceptedInstall.lock.lock.generationDigest,
      lkgLockIdentity: acceptedInstall.lock.lock.rollback.lkgLockIdentity,
      lockIdentity: acceptedInstall.lock.lock.lockIdentity,
    },
    matrix,
    negativeProbes: [
      { outcome: "DENIED", probeId: "NO_AUTOMATIC_ACTIVATION" },
      { outcome: "DENIED", probeId: "NO_SELF_APPROVAL" },
      { outcome: "DENIED", probeId: "NO_RUNTIME_EXECUTION" },
    ],
  } as AsfActivationInputV1;
}

function clone<T>(value: T): T { return structuredClone(value); }

function refreshApproval(input: AsfActivationInputV1): void {
  (input as any).approval.requestDigest = createHash("sha256")
    .update(canonicalJson(input.activationRequest)).digest("hex");
}

function denied(value: unknown, reason: AsfActivationReasonCodeV1): void {
  const result = activateAsfGenerationExplicitV1(value);
  assert.deepEqual(result, {
    outcome: "DENIED",
    reasonCodes: [reason],
    exitCode: ASF_ACTIVATION_EXIT_CODES_V1[reason],
    failClosed: { affectedScope: "DISABLE_OR_RETAIN_LKG", unrelatedAcceptedGenerations: "UNCHANGED" },
  });
}

function lifecycleHash(value: unknown): string {
  return createHash("sha256").update(canonicalJson(value)).digest("hex");
}

function lifecycleInputFor(): AsfLifecycleIntegrationInputV1 {
  const activation = inputFor();
  const { verdict: _verdict, ...assignment } = targetRow;
  const updateEnvelope = JSON.parse(readFileSync("tests/fixtures/asf-update-rings/promote-one.json", "utf8")) as Record<string, any>;
  const priorRingReceiptDigest = lifecycleHash({
    generationDigest: acceptedInstall.generation.generationDigest,
    ringId: "ring:canary",
  });
  const beforeRecords = [
    {
      generationDigest: acceptedInstall.generation.generationDigest,
      lockIdentity: acceptedInstall.generation.lockDigest,
      skillId: acceptedInstall.generation.skillId,
      state: "ACTIVE",
      version: acceptedInstall.generation.version,
    },
    {
      generationDigest: acceptedInstall.installed[0].generationDigest,
      lockIdentity: acceptedInstall.installed[0].lockDigest,
      skillId: acceptedInstall.installed[0].skillId,
      state: acceptedInstall.installed[0].state,
      version: acceptedInstall.installed[0].version,
    },
  ];
  const lkg = exactLkgFixture.lkg;
  const restoredRecords = beforeRecords.map((record) => record.skillId === lkg.skillId
    ? {
      generationDigest: lkg.generationDigest,
      lockIdentity: lkg.lockIdentity,
      skillId: lkg.skillId,
      state: "ACTIVE",
      version: lkg.version,
    }
    : record);
  return {
    schemaVersion: "chimpmaera.asf/lifecycle-integration/v1",
    compatibility: matrix,
    assignment: {
      assignments: [{ ...assignment, state: "ENABLED" }],
      generation: {
        capabilityIds: acceptedInstall.lock.capabilityPack.references.map((reference: Record<string, string>) => reference.capabilityId),
        generationDigest: acceptedInstall.generation.generationDigest,
        lockDigest: acceptedInstall.generation.lockDigest,
        skillId: acceptedInstall.generation.skillId,
        version: acceptedInstall.generation.version,
      },
      lkg: {
        lkgLockIdentity: acceptedInstall.lock.lock.rollback.lkgLockIdentity,
        mode: ASF_ASSIGNMENT_LKG_MODE_V1,
      },
      lock: acceptedInstall.lock,
      matrix,
      schemaVersion: "chimpmaera.asf/assignment/v1",
    },
    activation,
    updateRing: {
      schemaVersion: "chimpmaera.asf/update-ring/v1",
      promotionRequest: updateEnvelope.promotionRequest,
      approval: updateEnvelope.approval,
      ringPlan: updateEnvelope.ringPlan,
      analysisReceipt: acceptedInstall.analysisReceipt,
      analysisStatus: "FRESH",
      assignment: { ...assignment, state: "ENABLED" },
      generation: activation.generation,
      lock: activation.lock,
      matrix,
      negativeProbes: [
        { outcome: "DENIED", probeId: "NO_AUTOMATIC_PROMOTION" },
        { outcome: "DENIED", probeId: "NO_SELF_PROMOTION" },
        { outcome: "DENIED", probeId: "NO_SKIP_PROMOTION" },
        { outcome: "DENIED", probeId: "NO_RUNTIME_EXECUTION" },
      ],
      ringState: [
        {
          generationDigest: acceptedInstall.installed[0].generationDigest,
          ringId: "ring:beta",
          receiptDigest: acceptedInstall.installed[0].lockDigest,
          skillId: acceptedInstall.installed[0].skillId,
        },
        {
          generationDigest: acceptedInstall.generation.generationDigest,
          ringId: "ring:canary",
          receiptDigest: priorRingReceiptDigest,
          skillId: acceptedInstall.generation.skillId,
        },
      ],
    },
    rollback: {
      schemaVersion: "chimpmaera.asf/rollback/v1",
      analysisReceipt: acceptedInstall.analysisReceipt,
      analysisStatus: "FRESH",
      approval: exactLkgFixture.approval,
      beforeSnapshot: { digest: lifecycleHash({ records: beforeRecords }), records: beforeRecords },
      candidate: {
        generationDigest: acceptedInstall.generation.generationDigest,
        lockDigest: acceptedInstall.generation.lockDigest,
        skillId: acceptedInstall.generation.skillId,
        version: acceptedInstall.generation.version,
      },
      lkg: [lkg],
      negativeProbes: [
        { outcome: "DENIED", probeId: "NO_AUTOMATIC_ROLLBACK" },
        { outcome: "DENIED", probeId: "NO_CROSS_SCOPE_MODIFICATION" },
        { outcome: "DENIED", probeId: "NO_PARTIAL_RESTORE" },
        { outcome: "DENIED", probeId: "NO_RUNTIME_EXECUTION" },
      ],
      readback: { digest: lifecycleHash({ records: restoredRecords }), records: restoredRecords },
      rollbackRequest: exactLkgFixture.rollbackRequest,
    },
  } as unknown as AsfLifecycleIntegrationInputV1;
}

function lifecycleDenied(value: unknown, reason: AsfLifecycleIntegrationReasonCodeV1): void {
  assert.deepEqual(decideAsfLifecycleIntegrationV1(value), {
    outcome: "DENIED",
    reasonCodes: [reason],
    exitCode: ASF_LIFECYCLE_INTEGRATION_EXIT_CODES_V1[reason],
    failClosed: { affectedScope: "DISABLE_OR_RETAIN_LKG", unrelatedAcceptedGenerations: "UNCHANGED" },
  });
}

test("one explicit authorized synthetic request emits an exact installed-generation receipt", () => {
  const input = inputFor();
  const before = clone(input);
  const result = activateAsfGenerationExplicitV1(input);
  assert.equal(result.outcome, "ACCEPTED");
  if (result.outcome !== "ACCEPTED") return;

  assert.deepEqual(input, before);
  assert.deepEqual(result.reasonCodes, ["ASF_ACTIVATION_ACCEPTED"]);
  assert.equal(result.stateTransition.from, "installed_inactive");
  assert.equal(result.stateTransition.to, "ACTIVE");
  assert.equal(result.receipt.requestId, input.activationRequest.requestId);
  assert.equal(result.receipt.approverClass, "ASF_ASSIGNMENT_ACTIVATOR_V1");
  assert.deepEqual(result.receipt.targetScope, input.activationRequest.targetScope);
  assert.equal(result.receipt.generationDigest, input.generation.generationDigest);
  assert.equal(result.receipt.lockIdentity, input.lock.lockIdentity);
  assert.equal(result.receipt.decisionReason, "EXPLICIT_AUTHORIZATION_FOR_EXACT_INSTALLED_GENERATION_AND_SCOPE");
  assert.equal(result.receipt.runtimeEffect, ASF_ACTIVATION_RUNTIME_EFFECT_V1);
  assert.deepEqual(result.receipt.authority, ASF_ACTIVATION_AUTHORITY_V1);
  assert.equal(validateAsfActivationReceiptV1(result.receipt), true);
  assert.equal(result.receiptDigest, asfActivationReceiptDigestV1(result.receipt));
  assert.equal(result.receiptJson, canonicalJson(result.receipt));

  const unrelated = result.projection.installed.find((entry) => entry.skillId === "skill:unrelated");
  assert.deepEqual(unrelated, input.installed.find((entry) => entry.skillId === "skill:unrelated"));
  assert.equal(result.projection.installed.find((entry) => entry.skillId === input.generation.skillId)?.state, "ACTIVE");
});

test("repeated identical requests are deterministic and do not alter unrelated accepted generations", () => {
  const input = inputFor();
  const first = activateAsfGenerationExplicitV1(input);
  const second = activateAsfGenerationExplicitV1(clone(input));
  assert.deepEqual(second, first);
  assert.equal(first.outcome, "ACCEPTED");
  if (first.outcome !== "ACCEPTED") return;
  assert.deepEqual(first.projection.installed.filter((entry) => entry.skillId === "skill:unrelated"), [input.installed[0]]);
});

test("canonical parsing produces the same receipt and never invokes a runtime", () => {
  const input = inputFor();
  const result = parseAsfActivationV1(canonicalJson(input));
  assert.equal(result.outcome, "ACCEPTED");
  if (result.outcome !== "ACCEPTED") return;
  assert.equal(result.receipt.runtimeEffect, "NOT_RUN");
  assert.equal(result.receipt.authority.execution, "NO_AUTHORITY");
  assert.equal("runtime" in result, false);
  assert.equal("callback" in result, false);
});

test("required negative probes fail closed", () => {
  denied(fixture("no-request"), "SCHEMA_DENIED");

  const automatic = inputFor();
  (automatic as any).activationRequest.automaticActivation = true;
  denied(automatic, "AUTO_ACTIVATION_DENIED");

  denied(inputFor("self-approved"), "SELF_APPROVAL_DENIED");

  const stale = inputFor();
  (stale as any).analysisStatus = "STALE";
  denied(stale, "ANALYSIS_STALE_DENIED");

  const revoked = inputFor();
  (revoked as any).analysisStatus = "REVOKED";
  denied(revoked, "ANALYSIS_REVOKED_DENIED");

  const activeBeforeInstall = inputFor();
  (activeBeforeInstall as any).installed[1].state = "ACTIVE";
  denied(activeBeforeInstall, "ACTIVE_STATE_DENIED");

  const incompatible = inputFor();
  const blocked = matrix.rows.find((row) => row.verdict === "INCOMPATIBLE");
  assert.ok(blocked);
  const { verdict: _blockedVerdict, ...blockedAssignment } = blocked;
  (incompatible as any).assignment = { ...blockedAssignment, state: "ENABLED" };
  (incompatible as any).activationRequest.targetScope = {
    ...incompatible.activationRequest.targetScope,
    profileId: blocked.profileId,
    routeId: blocked.routeId,
  };
  refreshApproval(incompatible);
  denied(incompatible, "INCOMPATIBLE_TARGET_DENIED");

  const unassigned = inputFor();
  (unassigned as any).assignment = { ...unassigned.assignment, profileId: "profile:qwen.unassigned" };
  (unassigned as any).activationRequest.targetScope = { ...unassigned.activationRequest.targetScope, profileId: "profile:qwen.unassigned" };
  refreshApproval(unassigned);
  denied(unassigned, "UNASSIGNED_TARGET_DENIED");

  const drift = inputFor();
  (drift as any).lock.generationDigest = "0".repeat(64);
  denied(drift, "DIGEST_MISMATCH_DENIED");
});

test("negative parse probes expose no authority or projected state", () => {
  const result = parseAsfActivationV1(JSON.stringify(fixture("no-request")));
  assert.equal(result.outcome, "DENIED");
  if (result.outcome !== "DENIED") return;
  assert.equal("receipt" in result, false);
  assert.equal("projection" in result, false);
  assert.equal(JSON.stringify(result).includes("NO_AUTHORITY"), false);
});

test("a deterministic lifecycle receipt binds compatibility, assignment, explicit activation, ring, and exact rollback readback", () => {
  const input = lifecycleInputFor();
  const before = clone(input);
  const result = decideAsfLifecycleIntegrationV1(input);
  assert.equal(result.outcome, "ACCEPTED");
  if (result.outcome !== "ACCEPTED") return;

  assert.deepEqual(input, before);
  assert.deepEqual(result.reasonCodes, ["ASF_LIFECYCLE_INTEGRATION_ACCEPTED"]);
  assert.equal(result.receipt.runtimeEffect, "NOT_RUN");
  assert.deepEqual(result.receipt.authority, ASF_LIFECYCLE_INTEGRATION_AUTHORITY_V1);
  assert.equal(validateAsfLifecycleIntegrationReceiptV1(result.receipt), true);
  assert.equal(result.receiptDigest, asfLifecycleIntegrationReceiptDigestV1(result.receipt));
  assert.equal(result.receiptJson, canonicalJson(result.receipt));
  assert.equal(parseAsfLifecycleIntegrationV1(canonicalJson(input)).outcome, "ACCEPTED");
  assert.equal("projection" in result, false);
  assert.equal("stateTransition" in result, false);
});

test("lifecycle integration fails closed when required evidence or exact scope binding is absent", () => {
  const missingActivationProbe = clone(lifecycleInputFor()) as Record<string, any>;
  missingActivationProbe.activation.negativeProbes = [];
  lifecycleDenied(missingActivationProbe, "ACTIVATION_EVIDENCE_DENIED");

  const missingReadback = clone(lifecycleInputFor()) as Record<string, any>;
  missingReadback.rollback.readback = { digest: "0".repeat(64), records: [] };
  lifecycleDenied(missingReadback, "ROLLBACK_READBACK_DENIED");

  const nonExactActivationScope = clone(lifecycleInputFor()) as Record<string, any>;
  const capabilityId = nonExactActivationScope.activation.activationRequest.targetScope.capabilityIds[0];
  nonExactActivationScope.activation.activationRequest.targetScope.capabilityIds = [
    ...nonExactActivationScope.activation.activationRequest.targetScope.capabilityIds,
    capabilityId,
  ];
  refreshApproval(nonExactActivationScope.activation);
  denied(nonExactActivationScope.activation, "SCHEMA_DENIED");
  lifecycleDenied(nonExactActivationScope, "ACTIVATION_EVIDENCE_DENIED");
});
