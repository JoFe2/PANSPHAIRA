import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  ASF_UPDATE_RING_AUTHORITY_V1,
  ASF_UPDATE_RING_EXIT_CODES_V1,
  ASF_UPDATE_RING_RUNTIME_EFFECT_V1,
  asfUpdateRingReceiptDigestV1,
  decideAsfUpdateRingV1,
  parseAsfUpdateRingV1,
  validateAsfUpdateRingReceiptV1,
  type AsfUpdateRingInputV1,
  type AsfUpdateRingReasonCodeV1,
} from "../packages/contracts/src/asf-update-rings.js";
import { canonicalJson } from "../packages/contracts/src/canonical-json.js";
import type { AsfCompatibilityMatrixDocumentV1 } from "../packages/contracts/src/asf-compatibility-fence.js";

const acceptedInstall = JSON.parse(readFileSync("tests/fixtures/asf-inactive-install/accepted.json", "utf8")) as Record<string, any>;
const matrix = JSON.parse(readFileSync("tests/fixtures/asf-compatibility/matrix.json", "utf8")) as AsfCompatibilityMatrixDocumentV1;
const targetRowCandidate = matrix.rows.find((row) => row.profileId === "profile:qwen.safe");
if (targetRowCandidate === undefined) throw new Error("ring fixture requires profile:qwen.safe");
const targetRow: AsfCompatibilityMatrixDocumentV1["rows"][number] = targetRowCandidate;

const PRIOR_RING = "ring:canary";
const NEXT_RING = "ring:beta";
const PRIOR_RING_RECEIPT_DIGEST = createHash("sha256")
  .update(canonicalJson({ generationDigest: acceptedInstall.generation.generationDigest, ringId: PRIOR_RING }))
  .digest("hex");

function fixture(name: string): Record<string, any> {
  return JSON.parse(readFileSync(`tests/fixtures/asf-update-rings/${name}.json`, "utf8")) as Record<string, any>;
}

function inputFor(name = "promote-one"): AsfUpdateRingInputV1 {
  const envelope = fixture(name);
  const { verdict: _verdict, ...assignment } = targetRow;
  return {
    schemaVersion: "chimpmaera.asf/update-ring/v1",
    promotionRequest: envelope.promotionRequest,
    approval: envelope.approval,
    ringPlan: envelope.ringPlan,
    analysisReceipt: acceptedInstall.analysisReceipt,
    analysisStatus: "FRESH",
    assignment: { ...assignment, state: "ENABLED" },
    generation: {
      generationDigest: acceptedInstall.generation.generationDigest,
      lockDigest: acceptedInstall.generation.lockDigest,
      skillId: acceptedInstall.generation.skillId,
      version: acceptedInstall.generation.version,
    },
    lock: {
      generationDigest: acceptedInstall.lock.lock.generationDigest,
      lkgLockIdentity: acceptedInstall.lock.lock.rollback.lkgLockIdentity,
      lockIdentity: acceptedInstall.lock.lock.lockIdentity,
    },
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
        ringId: NEXT_RING,
        receiptDigest: acceptedInstall.installed[0].lockDigest,
        skillId: acceptedInstall.installed[0].skillId,
      },
      {
        generationDigest: acceptedInstall.generation.generationDigest,
        ringId: PRIOR_RING,
        receiptDigest: PRIOR_RING_RECEIPT_DIGEST,
        skillId: acceptedInstall.generation.skillId,
      },
    ],
  } as AsfUpdateRingInputV1;
}

function clone<T>(value: T): T { return structuredClone(value); }

function refreshApproval(input: AsfUpdateRingInputV1): void {
  (input as any).approval.requestDigest = createHash("sha256")
    .update(canonicalJson(input.promotionRequest)).digest("hex");
}

function denied(value: unknown, reason: AsfUpdateRingReasonCodeV1): void {
  const result = decideAsfUpdateRingV1(value);
  assert.deepEqual(result, {
    outcome: "DENIED",
    reasonCodes: [reason],
    exitCode: ASF_UPDATE_RING_EXIT_CODES_V1[reason],
    failClosed: { affectedScope: "DISABLE_OR_RETAIN_LKG", unrelatedAcceptedGenerations: "UNCHANGED" },
  });
}

test("one explicit authorized request advances exactly one declared ring with an exact receipt", () => {
  const input = inputFor();
  const before = clone(input);
  const result = decideAsfUpdateRingV1(input);
  assert.equal(result.outcome, "ACCEPTED");
  if (result.outcome !== "ACCEPTED") return;

  assert.deepEqual(input, before);
  assert.deepEqual(result.reasonCodes, ["ASF_UPDATE_RING_ACCEPTED"]);
  assert.equal(result.exitCode, 0);
  assert.equal(result.stateTransition.activated, false);
  assert.equal(result.stateTransition.fromRing, PRIOR_RING);
  assert.equal(result.stateTransition.toRing, NEXT_RING);
  assert.equal(result.receipt.requestId, input.promotionRequest.requestId);
  assert.equal(result.receipt.approverClass, "ASF_RING_APPROVER_V1");
  assert.equal(result.receipt.priorRingId, PRIOR_RING);
  assert.equal(result.receipt.currentRingId, NEXT_RING);
  assert.equal(result.receipt.priorRingReceiptDigest, PRIOR_RING_RECEIPT_DIGEST);
  assert.equal(result.receipt.planDigest, input.ringPlan.planDigest);
  assert.equal(result.receipt.promotionRequestDigest, createHash("sha256")
    .update(canonicalJson(input.promotionRequest)).digest("hex"));
  assert.equal(result.receipt.analysisReceiptDigest, input.analysisReceipt.receiptDigest);
  assert.equal(result.receipt.matrixDigest, matrix.matrixDigest);
  assert.equal(result.receipt.generationDigest, input.generation.generationDigest);
  assert.equal(result.receipt.lockIdentity, input.lock.lockIdentity);
  assert.deepEqual(result.receipt.targetScope, input.promotionRequest.targetScope);
  assert.equal(result.receipt.decisionReason, "EXPLICIT_EVIDENCE_BOUND_ADVANCE_OF_EXACTLY_ONE_DECLARED_RING");
  assert.equal(result.receipt.runtimeEffect, ASF_UPDATE_RING_RUNTIME_EFFECT_V1);
  assert.deepEqual(result.receipt.authority, ASF_UPDATE_RING_AUTHORITY_V1);
  assert.equal(validateAsfUpdateRingReceiptV1(result.receipt), true);
  assert.equal(result.receiptDigest, asfUpdateRingReceiptDigestV1(result.receipt));
  assert.equal(result.receiptJson, canonicalJson(result.receipt));

  const unrelated = result.projection.ringState.find((entry) => entry.skillId === "skill:unrelated");
  assert.deepEqual(unrelated, input.ringState.find((entry) => entry.skillId === "skill:unrelated"));
  const promoted = result.projection.ringState.find((entry) => entry.skillId === input.generation.skillId);
  assert.equal(promoted?.ringId, NEXT_RING);
  assert.equal(promoted?.receiptDigest, result.receiptDigest);
});

test("repeated identical evaluations are deterministic and never activate the candidate", () => {
  const input = inputFor();
  const first = decideAsfUpdateRingV1(input);
  const second = decideAsfUpdateRingV1(clone(input));
  assert.deepEqual(second, first);
  assert.equal(first.outcome, "ACCEPTED");
  if (first.outcome !== "ACCEPTED") return;
  assert.equal(first.stateTransition.activated, false);
  assert.deepEqual(first.projection.ringState.filter((entry) => entry.skillId === "skill:unrelated"), [input.ringState[0]]);
});

test("canonical parsing produces the same receipt and never invokes a runtime", () => {
  const input = inputFor();
  const result = parseAsfUpdateRingV1(canonicalJson(input));
  assert.equal(result.outcome, "ACCEPTED");
  if (result.outcome !== "ACCEPTED") return;
  assert.equal(result.receipt.runtimeEffect, "NOT_RUN");
  assert.equal(result.receipt.authority.execution, "NO_AUTHORITY");
  assert.equal(result.receipt.authority.activation, "NO_AUTHORITY");
  assert.equal(result.receipt.authority.installation, "NO_AUTHORITY");
  assert.equal("runtime" in result, false);
  assert.equal("callback" in result, false);
});

test("required negative probes fail closed", () => {
  denied({}, "SCHEMA_DENIED");

  const automatic = inputFor();
  (automatic as any).promotionRequest.automatic = true;
  denied(automatic, "AUTO_PROMOTION_DENIED");

  denied(inputFor("self-promote"), "SELF_PROMOTION_DENIED");

  const stale = inputFor();
  (stale as any).analysisStatus = "STALE";
  denied(stale, "ANALYSIS_STALE_DENIED");

  const revoked = inputFor();
  (revoked as any).analysisStatus = "REVOKED";
  denied(revoked, "ANALYSIS_REVOKED_DENIED");

  const badEvidence = inputFor();
  (badEvidence as any).analysisReceipt = { ...badEvidence.analysisReceipt, evidenceDigest: "1".repeat(64) };
  denied(badEvidence, "EVIDENCE_MISSING_DENIED");

  const unknownRing = inputFor();
  (unknownRing as any).promotionRequest.toRing = "ring:unknown";
  refreshApproval(unknownRing);
  denied(unknownRing, "UNKNOWN_RING_DENIED");

  denied(inputFor("skipped-ring"), "SKIPPED_RING_DENIED");

  const advanced = inputFor();
  (advanced as any).ringState[1].ringId = NEXT_RING;
  denied(advanced, "RING_STATE_DENIED");

  const incompatible = inputFor();
  const blocked = matrix.rows.find((row) => row.verdict === "INCOMPATIBLE");
  assert.ok(blocked);
  const { verdict: _blockedVerdict, ...blockedAssignment } = blocked;
  (incompatible as any).assignment = { ...blockedAssignment, state: "ENABLED" };
  (incompatible as any).promotionRequest.targetScope = {
    ...incompatible.promotionRequest.targetScope,
    profileId: blocked.profileId,
    routeId: blocked.routeId,
  };
  refreshApproval(incompatible);
  denied(incompatible, "INCOMPATIBLE_ASSIGNMENT_DENIED");

  const unassigned = inputFor();
  (unassigned as any).assignment = { ...unassigned.assignment, profileId: "profile:qwen.unassigned" };
  (unassigned as any).promotionRequest.targetScope = { ...unassigned.promotionRequest.targetScope, profileId: "profile:qwen.unassigned" };
  refreshApproval(unassigned);
  denied(unassigned, "INCOMPATIBLE_ASSIGNMENT_DENIED");

  const mutable = inputFor();
  (mutable as any).ringPlan.rings = ["ring:latest", "ring:beta", "ring:general"];
  denied(mutable, "MUTABLE_ALIAS_OR_RANGE_DENIED");

  const noApproval = inputFor();
  (noApproval as any).approval.decision = "REJECT";
  denied(noApproval, "MISSING_APPROVAL_DENIED");

  const drift = inputFor();
  (drift as any).approval.requestDigest = "0".repeat(64);
  denied(drift, "DIGEST_MISMATCH_DENIED");

  const lockDrift = inputFor();
  (lockDrift as any).lock.generationDigest = "0".repeat(64);
  denied(lockDrift, "DIGEST_MISMATCH_DENIED");

  const badProbes = inputFor();
  (badProbes as any).negativeProbes = badProbes.negativeProbes.slice(0, 3);
  denied(badProbes, "NEGATIVE_PROBE_DENIED");
});

test("non-canonical encodings and negative parse probes are rejected without authority", () => {
  const input = inputFor();
  const nonCanonical = parseAsfUpdateRingV1(JSON.stringify(input));
  assert.equal(nonCanonical.outcome, "DENIED");
  if (nonCanonical.outcome !== "DENIED") return;
  assert.deepEqual(nonCanonical.reasonCodes, ["NONCANONICAL_ENCODING_DENIED"]);

  const empty = parseAsfUpdateRingV1(JSON.stringify({}));
  assert.equal(empty.outcome, "DENIED");
  if (empty.outcome !== "DENIED") return;
  assert.equal("receipt" in empty, false);
  assert.equal("projection" in empty, false);
  assert.equal(JSON.stringify(empty).includes("NO_AUTHORITY"), false);
});