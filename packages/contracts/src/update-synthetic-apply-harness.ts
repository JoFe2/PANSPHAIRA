import { createHash } from "node:crypto";
import { canonicalJson } from "./canonical-json.js";
import {
  UPDATE_CONTINUITY_DECISION_SCHEMA_V1,
  UPDATE_CONTINUITY_OBSERVATION_SCHEMA_V1,
  UPDATE_CONTINUITY_OBSERVER_SCHEMA_V1,
  verifyUpdateContinuityDecisionV1,
  type UpdateAcceptedSnapshotV1,
  type UpdateContinuityDecisionInputV1,
  type UpdateContinuityVerificationContextV1,
} from "./update-continuity-decision.js";
import {
  updateCheckPlanDigestV1,
  updateTupleDigestV1,
  type UpdateLkgV1,
  type UpdateTupleV1,
} from "./update-check-plan.js";
import {
  buildUpdateApplyJournalV1,
  verifyUpdateApplyJournalV1,
  type UpdateApplyJournalV1,
} from "./update-apply-journal.js";
import {
  UPDATE_APPLY_POSTCONDITION_SCHEMA_V1,
  updateApplyPostconditionDigestV1,
  verifyUpdateApplyPostconditionV1,
  type UpdateApplyPostconditionContextV1,
  type UpdateApplyPostconditionEnvelopeV1,
} from "./update-apply-postcondition.js";
import {
  buildUpdateCheckpointRollbackReadbackV1,
  updateCheckpointRollbackRetryDeterminismDigestV1,
  verifyUpdateCheckpointRollbackReadbackV1,
  type UpdateCheckpointRollbackReadbackContextV1,
} from "./update-checkpoint-rollback-readback.js";
import {
  buildUpdateMigrationCheckpointV1,
  verifyUpdateMigrationCheckpointV1,
  type UpdateMigrationCheckpointContextV1,
} from "./update-migration-checkpoint.js";
import {
  buildUpdateMigrationEdgeV1,
  verifyUpdateMigrationEdgeV1,
  type UpdateMigrationEdgeVerificationContextV1,
} from "./update-migration-edge.js";
import {
  buildUpdatePromotionGateV1,
  updatePromotionGateIdentityBoundaryDigestV1,
  verifyUpdatePromotionGateV1,
  type UpdatePromotionGateContextV1,
} from "./update-promotion-gate.js";

/**
 * PSAI #53 first isolated synthetic controller harness.
 *
 * The harness composes already verified pure contracts over an in-memory model
 * of owned snapshots and a compare-and-swap active pointer. Failure injection
 * is deliberately finite and deterministic. No filesystem, process, service,
 * registry, package, clock, or network state is observed or changed here.
 */
export const UPDATE_SYNTHETIC_APPLY_HARNESS_SCHEMA_V1 = "chimpmaera.update/synthetic-apply-harness/v1" as const;
export const UPDATE_SYNTHETIC_APPLY_HARNESS_RECEIPT_SCHEMA_V1 = "chimpmaera.update/synthetic-apply-receipt/v1" as const;
export const UPDATE_SYNTHETIC_APPLY_HARNESS_VERSION_V1 = "1.0.0" as const;
export const UPDATE_SYNTHETIC_APPLY_HARNESS_TIME_MS_V1 = 1_787_612_400_000 as const;
export const UPDATE_SYNTHETIC_APPLY_HARNESS_RETRY_ORDINAL_V1 = 2 as const;

export const UPDATE_SYNTHETIC_APPLY_HARNESS_FAILURES_V1 = [
  "SUCCESS",
  "PARTIAL_MIGRATION",
  "FAILED_POSTCONDITION",
  "REGISTRY_OUTAGE",
  "INVALID_LKG",
] as const;
export type UpdateSyntheticApplyHarnessFailureV1 = (typeof UPDATE_SYNTHETIC_APPLY_HARNESS_FAILURES_V1)[number];

export const UPDATE_SYNTHETIC_APPLY_HARNESS_TARGET_TUPLE_V1: UpdateTupleV1 = Object.freeze({
  core: Object.freeze([{ componentId: "core:safe-guided", version: "1.1.0", digest: "1".repeat(64) }]),
  packs: Object.freeze([{ componentId: "pack:general", version: "1.0.0", digest: "2".repeat(64) }]),
  adapters: Object.freeze([{ componentId: "adapter:dev", version: "1.0.0", digest: "3".repeat(64) }]),
  policies: Object.freeze([{ componentId: "policy:default", version: "2.0.0", digest: "4".repeat(64) }]),
  schemas: Object.freeze([{ componentId: "schema:catalog", version: "1.0.0", digest: "5".repeat(64) }]),
  generations: Object.freeze([{ componentId: "generation:safe-guided", version: "1.0.0", digest: "6".repeat(64) }]),
});

const SOURCE_TUPLE: UpdateTupleV1 = Object.freeze({
  core: Object.freeze([{ componentId: "core:safe-guided", version: "1.0.0", digest: "a".repeat(64) }]),
  packs: Object.freeze([{ componentId: "pack:general", version: "1.0.0", digest: "b".repeat(64) }]),
  adapters: Object.freeze([{ componentId: "adapter:dev", version: "1.0.0", digest: "c".repeat(64) }]),
  policies: Object.freeze([{ componentId: "policy:default", version: "1.0.0", digest: "d".repeat(64) }]),
  schemas: Object.freeze([{ componentId: "schema:catalog", version: "1.0.0", digest: "e".repeat(64) }]),
  generations: Object.freeze([{ componentId: "generation:safe-guided", version: "1.0.0", digest: "f".repeat(64) }]),
});

export const UPDATE_SYNTHETIC_APPLY_HARNESS_SOURCE_TUPLE_V1 = SOURCE_TUPLE;
export const UPDATE_SYNTHETIC_APPLY_HARNESS_TARGET_TUPLE_DIGEST_V1 = updateTupleDigestV1(UPDATE_SYNTHETIC_APPLY_HARNESS_TARGET_TUPLE_V1);
export const UPDATE_SYNTHETIC_APPLY_HARNESS_SOURCE_TUPLE_DIGEST_V1 = updateTupleDigestV1(SOURCE_TUPLE);

const AUTHORITY_PROFILE_DIGEST = "7".repeat(64);
const OPERATION_DIGEST = createHash("sha256").update("chimpmaera.update/synthetic-apply/operation/v1").digest("hex");
const ARTIFACT_DIGEST = createHash("sha256").update(canonicalJson(UPDATE_SYNTHETIC_APPLY_HARNESS_TARGET_TUPLE_V1)).digest("hex");
const CANDIDATE_ID = "candidate:synthetic-001";
const UPDATER_ID = "updater:fixture-only";
const VERIFIER_ID = "verifier:independent-readback";
const PROMOTER_ID = "promoter:promotion-gate";
const OBSERVER_ID = "observer:continuity-verifier";
const PLANNER_ID = "planner:independent-planner";
const RECORDER_ID = "recorder:checkpoint-recorder";
const READBACK_VERIFIER_ID = "verifier:independent-readback-verifier";
const OBSERVED_AT_MS = UPDATE_SYNTHETIC_APPLY_HARNESS_TIME_MS_V1;
const EVALUATION_TIME_MS = OBSERVED_AT_MS + 1_000;
const DIGEST = /^[a-f0-9]{64}$/;

export const UPDATE_SYNTHETIC_APPLY_HARNESS_ACTOR_BINDINGS_V1 = Object.freeze({
  candidateId: CANDIDATE_ID,
  updaterId: UPDATER_ID,
  verifierId: VERIFIER_ID,
  promoterId: PROMOTER_ID,
  observerId: OBSERVER_ID,
});

export interface UpdateSyntheticApplyOwnedStateSnapshotV1 {
  readonly snapshotId: string;
  readonly tuple: UpdateTupleV1;
  readonly tupleDigest: string;
  readonly residueCount: number;
  readonly revoked: boolean;
  readonly ownerStateDigest: string;
}

export interface UpdateSyntheticApplyPointerV1 {
  readonly activeSnapshotId: string;
  readonly activeTupleDigest: string;
  readonly revision: number;
  readonly pointerDigest: string;
}

export interface UpdateSyntheticApplyCompareAndSwapResultV1 {
  readonly swapped: boolean;
  readonly pointer: UpdateSyntheticApplyPointerV1;
}

export interface UpdateSyntheticApplyHarnessOptionsV1 {
  readonly failure?: UpdateSyntheticApplyHarnessFailureV1;
  readonly retryOrdinal?: number;
}

export interface UpdateSyntheticApplyHarnessReadbackV1 {
  readonly activeSnapshotId: string;
  readonly activeTupleDigest: string;
  readonly ownerStateDigest: string;
  readonly pointerRevision: number;
  readonly residueCount: number;
}

export interface UpdateSyntheticApplyHarnessContractChecksV1 {
  readonly promotionGate: "VERIFIED";
  readonly migrationEdge: "CHECKED";
  readonly checkpoint: "RECORDED";
  readonly applyJournal: "ACCEPTED";
  readonly postcondition: "ACCEPT_SWITCH" | "ROLLBACK_REQUIRED";
  readonly continuity: "PRESERVE_ACCEPTED" | "ENTER_SAFE_READ_ONLY";
  readonly rollbackReadback: "VERIFIED" | "NOT_APPLICABLE";
}

export interface UpdateSyntheticApplyHarnessReceiptV1 {
  readonly schemaVersion: typeof UPDATE_SYNTHETIC_APPLY_HARNESS_RECEIPT_SCHEMA_V1;
  readonly harnessVersion: typeof UPDATE_SYNTHETIC_APPLY_HARNESS_VERSION_V1;
  readonly scenario: UpdateSyntheticApplyHarnessFailureV1;
  readonly outcome: "APPLIED" | "ROLLED_BACK_ZERO_RESIDUE" | "PRESERVE_ACCEPTED" | "SAFE_READ_ONLY";
  readonly readOnly: boolean;
  readonly tuple: UpdateTupleV1;
  readonly tupleDigest: string;
  readonly sourceTupleDigest: string;
  readonly lkgDigest: string;
  readonly lkgState: "COMPLETE" | "INCOMPLETE";
  readonly lkgRevoked: false;
  readonly initialPointer: UpdateSyntheticApplyPointerV1;
  readonly finalPointer: UpdateSyntheticApplyPointerV1;
  readonly initialOwnerStateDigest: string;
  readonly finalOwnerStateDigest: string;
  readonly residueCount: number;
  readonly stateTrace: readonly string[];
  readonly contractChecks: UpdateSyntheticApplyHarnessContractChecksV1;
  readonly retryOrdinal: number;
  readonly retryReceiptDigest: string;
  readonly readback: UpdateSyntheticApplyHarnessReadbackV1;
  readonly receiptDigest: string;
}

export type UpdateSyntheticApplyHarnessVerificationResultV1 =
  | { readonly outcome: "VERIFIED"; readonly reasonCodes: readonly ["SYNTHETIC_APPLY_RECEIPT_VERIFIED"]; readonly exitCode: 0 }
  | { readonly outcome: "DENIED"; readonly reasonCodes: readonly ["SCHEMA_DENIED" | "DIGEST_MISMATCH_DENIED" | "TUPLE_MISMATCH_DENIED" | "READBACK_MISMATCH_DENIED"]; readonly exitCode: number };

function deepFreeze<T>(value: T): T {
  if (value !== null && typeof value === "object" && !Object.isFrozen(value)) {
    for (const key of Reflect.ownKeys(value)) {
      if (key !== "length") deepFreeze((value as Record<PropertyKey, unknown>)[key]);
    }
    Object.freeze(value);
  }
  return value;
}

function immutable<T>(value: T): T {
  return deepFreeze(value);
}

function digestWithout(value: Record<string, unknown>, excluded: string): string {
  const unsigned = Object.fromEntries(Object.entries(value).filter(([key]) => key !== excluded));
  return createHash("sha256").update(canonicalJson(unsigned)).digest("hex");
}

function ownerStateDigest(snapshotId: string, tupleDigest: string, residueCount: number, revoked: boolean): string {
  return digestWithout({ snapshotId, tupleDigest, residueCount, revoked }, "ownerStateDigest");
}

function pointerDigest(pointer: Omit<UpdateSyntheticApplyPointerV1, "pointerDigest">): string {
  return digestWithout(pointer, "pointerDigest");
}

function snapshot(
  snapshotId: string,
  tuple: UpdateTupleV1,
  residueCount: number,
  revoked = false,
): UpdateSyntheticApplyOwnedStateSnapshotV1 {
  const tupleDigest = updateTupleDigestV1(tuple);
  return immutable({ snapshotId, tuple, tupleDigest, residueCount, revoked, ownerStateDigest: ownerStateDigest(snapshotId, tupleDigest, residueCount, revoked) });
}

function pointer(activeSnapshotId: string, activeTupleDigest: string, revision: number): UpdateSyntheticApplyPointerV1 {
  const base = { activeSnapshotId, activeTupleDigest, revision };
  return immutable({ ...base, pointerDigest: pointerDigest(base) });
}

/** Pure compare-and-swap over an owned in-memory pointer. */
export function compareAndSwapUpdateSyntheticApplyPointerV1(
  current: UpdateSyntheticApplyPointerV1,
  expected: Pick<UpdateSyntheticApplyPointerV1, "activeTupleDigest" | "revision">,
  next: Pick<UpdateSyntheticApplyPointerV1, "activeSnapshotId" | "activeTupleDigest">,
): UpdateSyntheticApplyCompareAndSwapResultV1 {
  const matches = current.revision === expected.revision
    && current.activeTupleDigest === expected.activeTupleDigest
    && current.pointerDigest === pointerDigest({
      activeSnapshotId: current.activeSnapshotId,
      activeTupleDigest: current.activeTupleDigest,
      revision: current.revision,
    });
  if (!matches) return immutable({ swapped: false, pointer: current });
  return immutable({ swapped: true, pointer: pointer(next.activeSnapshotId, next.activeTupleDigest, current.revision + 1) });
}

function acceptedSnapshot(target: UpdateSyntheticApplyOwnedStateSnapshotV1, revoked: boolean): UpdateAcceptedSnapshotV1 {
  const base = {
    schemaVersion: "chimpmaera.update/accepted-snapshot/v1" as const,
    snapshotId: "accepted:synthetic-001",
    releaseId: "1.1.0",
    tuple: target.tuple,
    tupleDigest: target.tupleDigest,
    authorityProfileDigest: AUTHORITY_PROFILE_DIGEST,
    revoked,
    observedAtMs: OBSERVED_AT_MS,
  };
  return immutable({ ...base, snapshotDigest: updateCheckPlanDigestV1(base, "snapshotDigest") });
}

function lkgSnapshot(source: UpdateSyntheticApplyOwnedStateSnapshotV1, state: "COMPLETE" | "INCOMPLETE"): UpdateLkgV1 {
  const base = {
    schemaVersion: "chimpmaera.update/lkg/v1" as const,
    lkgId: "maintenance:synthetic-lkg-001",
    releaseId: "1.0.0",
    state,
    revoked: false,
    stale: false,
    tuple: source.tuple,
    authorityProfileDigest: AUTHORITY_PROFILE_DIGEST,
    observedAtMs: OBSERVED_AT_MS,
    tupleDigest: source.tupleDigest,
  };
  return immutable({ ...base, lkgDigest: updateCheckPlanDigestV1(base, "lkgDigest") });
}

function continuityInput(accepted: UpdateAcceptedSnapshotV1, lkg: UpdateLkgV1, unavailable: boolean): {
  readonly input: UpdateContinuityDecisionInputV1;
  readonly context: UpdateContinuityVerificationContextV1;
} {
  const observationBase = {
    schemaVersion: UPDATE_CONTINUITY_OBSERVATION_SCHEMA_V1,
    registryId: "registry:psai-central",
    availability: unavailable ? "UNAVAILABLE" as const : "AVAILABLE" as const,
    status: unavailable ? "UNREACHABLE" as const : "REACHABLE" as const,
    observedAtMs: OBSERVED_AT_MS,
  };
  const observation = immutable({
    ...observationBase,
    observationDigest: updateCheckPlanDigestV1(observationBase, "observationDigest"),
  });
  const observerBase = {
    schemaVersion: UPDATE_CONTINUITY_OBSERVER_SCHEMA_V1,
    observerId: OBSERVER_ID,
    observerVersion: UPDATE_SYNTHETIC_APPLY_HARNESS_VERSION_V1,
  };
  const observer = immutable({ ...observerBase, observerDigest: updateCheckPlanDigestV1(observerBase, "observerDigest") });
  const inputBase = {
    schemaVersion: UPDATE_CONTINUITY_DECISION_SCHEMA_V1,
    accepted,
    lkg,
    observation,
    observer,
    evaluationTimeMs: EVALUATION_TIME_MS,
  };
  const input = immutable({ ...inputBase, inputDigest: updateCheckPlanDigestV1(inputBase, "inputDigest") });
  const context = immutable({
    expectedAccepted: {
      snapshotId: accepted.snapshotId,
      releaseId: accepted.releaseId,
      snapshotDigest: accepted.snapshotDigest,
      tuple: accepted.tuple,
      authorityProfileDigest: accepted.authorityProfileDigest,
      observedAtMs: accepted.observedAtMs,
      revoked: accepted.revoked,
      evaluatedAtMs: EVALUATION_TIME_MS,
    },
    expectedLkg: {
      lkgId: lkg.lkgId,
      releaseId: lkg.releaseId,
      lkgDigest: lkg.lkgDigest,
      tuple: lkg.tuple,
      authorityProfileDigest: lkg.authorityProfileDigest,
      observedAtMs: lkg.observedAtMs,
      revoked: lkg.revoked,
      evaluatedAtMs: EVALUATION_TIME_MS,
    },
    expectedObservation: { registryId: observation.registryId, availability: observation.availability, observedAtMs: observation.observedAtMs },
    trustedObserver: { observerId: observer.observerId, observerVersion: observer.observerVersion },
    evaluationTimeMs: EVALUATION_TIME_MS,
    maxObservationAgeMs: 60_000,
    maxSnapshotAgeMs: 300_000,
  });
  return { input, context };
}

function promotionGateContext(candidateTupleDigest: string, identityBoundaryDigest: string, decisionDigest: string): UpdatePromotionGateContextV1 {
  return {
    expectedCandidateId: CANDIDATE_ID,
    expectedUpdaterId: UPDATER_ID,
    expectedSourceTupleDigest: UPDATE_SYNTHETIC_APPLY_HARNESS_SOURCE_TUPLE_DIGEST_V1,
    expectedCandidateTuple: UPDATE_SYNTHETIC_APPLY_HARNESS_TARGET_TUPLE_V1,
    expectedCandidateTupleDigest: candidateTupleDigest,
    expectedCandidateArtifactDigest: ARTIFACT_DIGEST,
    expectedIdentityBoundaryDigest: identityBoundaryDigest,
    expectedVerifier: { verifierId: VERIFIER_ID, verifierVersion: UPDATE_SYNTHETIC_APPLY_HARNESS_VERSION_V1 },
    expectedPromoterDecision: { decisionId: "decision:promotion-gate", promoterId: PROMOTER_ID, decisionDigest },
    expectedObservedAtMs: OBSERVED_AT_MS,
  };
}

function buildPromotionGate() {
  const identityBoundaryDigest = updatePromotionGateIdentityBoundaryDigestV1({
    candidateSubjectId: CANDIDATE_ID,
    updaterId: UPDATER_ID,
    attestorId: "attestor:attestation-gate",
    verifierId: VERIFIER_ID,
    promoterId: PROMOTER_ID,
  });
  const decisionDigest = createHash("sha256").update("chimpmaera.update/synthetic-apply/promotion-decision/v1").digest("hex");
  const gate = buildUpdatePromotionGateV1({
    candidateId: CANDIDATE_ID,
    updaterId: UPDATER_ID,
    sourceTupleDigest: UPDATE_SYNTHETIC_APPLY_HARNESS_SOURCE_TUPLE_DIGEST_V1,
    candidateTuple: UPDATE_SYNTHETIC_APPLY_HARNESS_TARGET_TUPLE_V1,
    candidateArtifactDigest: ARTIFACT_DIGEST,
    identityBoundaryDigest,
    verifier: { schemaVersion: "chimpmaera.update/promotion-gate-verifier/v1", verifierId: VERIFIER_ID, verifierVersion: UPDATE_SYNTHETIC_APPLY_HARNESS_VERSION_V1 },
    promoterDecision: { schemaVersion: "chimpmaera.update/promotion-decision/v1", decisionId: "decision:promotion-gate", promoterId: PROMOTER_ID, decisionDigest },
    observedAtMs: OBSERVED_AT_MS,
  });
  return { gate, result: verifyUpdatePromotionGateV1(gate, promotionGateContext(UPDATE_SYNTHETIC_APPLY_HARNESS_TARGET_TUPLE_DIGEST_V1, identityBoundaryDigest, decisionDigest)) };
}

function buildPostcondition(
  scenario: UpdateSyntheticApplyHarnessFailureV1,
  source: UpdateSyntheticApplyOwnedStateSnapshotV1,
  target: UpdateSyntheticApplyOwnedStateSnapshotV1,
): { readonly result: ReturnType<typeof verifyUpdateApplyPostconditionV1>; readonly envelope: UpdateApplyPostconditionEnvelopeV1 } {
  const failed = scenario === "PARTIAL_MIGRATION" || scenario === "FAILED_POSTCONDITION";
  const observed = failed ? snapshot(target.snapshotId, target.tuple, 1) : target;
  const envelopeBase = {
    schemaVersion: UPDATE_APPLY_POSTCONDITION_SCHEMA_V1,
    observationId: "postcondition:synthetic-001",
    operationDigest: OPERATION_DIGEST,
    targetDigest: ARTIFACT_DIGEST,
    lkgDigest: source.tupleDigest,
    expectedTargetTupleDigest: target.tupleDigest,
    observedTargetTupleDigest: observed.tupleDigest,
    expectedOwnerStateDigest: target.ownerStateDigest,
    observedOwnerStateDigest: observed.ownerStateDigest,
    residueCount: observed.residueCount,
    verifierId: "verifier:independent-postcondition",
    verifierVersion: UPDATE_SYNTHETIC_APPLY_HARNESS_VERSION_V1,
    observedAtMs: OBSERVED_AT_MS,
  };
  const envelope = immutable({ ...envelopeBase, envelopeDigest: updateApplyPostconditionDigestV1(envelopeBase, "envelopeDigest") }) as UpdateApplyPostconditionEnvelopeV1;
  const context: UpdateApplyPostconditionContextV1 = {
    operationDigest: OPERATION_DIGEST,
    targetDigest: ARTIFACT_DIGEST,
    lkgDigest: source.tupleDigest,
    expectedTargetTupleDigest: target.tupleDigest,
    expectedOwnerStateDigest: target.ownerStateDigest,
    operationSubjectId: CANDIDATE_ID,
    trustedVerifierId: envelope.verifierId,
    trustedVerifierVersion: envelope.verifierVersion,
    trustedEnvelopeDigest: envelope.envelopeDigest,
    evaluationTimeMs: EVALUATION_TIME_MS,
    maxObservationAgeMs: 60_000,
  };
  return { envelope, result: verifyUpdateApplyPostconditionV1(envelope, context) };
}

function buildCheckpoint(source: UpdateSyntheticApplyOwnedStateSnapshotV1, edgeDigest: string, journal: UpdateApplyJournalV1) {
  const checkpoint = buildUpdateMigrationCheckpointV1({
    operationDigest: OPERATION_DIGEST,
    migrationEdgeDigest: edgeDigest,
    currentTupleDigest: source.tupleDigest,
    rollbackTargetTupleDigest: source.tupleDigest,
    snapshotDigest: source.ownerStateDigest,
    snapshotContentDigest: source.ownerStateDigest,
    ownerStateDigest: source.ownerStateDigest,
    checkpointOrdinal: 1,
    authorityProfileDigest: AUTHORITY_PROFILE_DIGEST,
    recorder: { recorderId: RECORDER_ID, recorderVersion: UPDATE_SYNTHETIC_APPLY_HARNESS_VERSION_V1 },
    capturedAtMs: OBSERVED_AT_MS,
  });
  const context: UpdateMigrationCheckpointContextV1 = {
    expectedOperationDigest: OPERATION_DIGEST,
    expectedMigrationEdgeDigest: edgeDigest,
    expectedCurrentTupleDigest: source.tupleDigest,
    expectedSnapshotDigest: source.ownerStateDigest,
    expectedSnapshotContentDigest: source.ownerStateDigest,
    expectedOwnerStateDigest: source.ownerStateDigest,
    expectedCheckpointOrdinal: 1,
    expectedAuthorityProfileDigest: AUTHORITY_PROFILE_DIGEST,
    expectedRecorder: { recorderId: RECORDER_ID, recorderVersion: UPDATE_SYNTHETIC_APPLY_HARNESS_VERSION_V1 },
    expectedCapturedAtMs: OBSERVED_AT_MS,
  };
  // The journal argument is intentionally consumed only to keep composition explicit in the harness.
  void journal;
  return { checkpoint, result: verifyUpdateMigrationCheckpointV1(checkpoint, context) };
}

function buildRollbackReadback(
  source: UpdateSyntheticApplyOwnedStateSnapshotV1,
  edgeDigest: string,
  checkpointDigest: string,
  retryOrdinal: number,
  retryReceiptDigest: string,
) {
  const evidenceDigest = createHash("sha256").update("chimpmaera.update/synthetic-apply/rollback-evidence/v1").digest("hex");
  const options = {
    operationDigest: OPERATION_DIGEST,
    migrationEdgeDigest: edgeDigest,
    checkpointDigest,
    rollbackTargetTupleDigest: source.tupleDigest,
    independentEvidenceDigest: evidenceDigest,
    ownerStateDigest: source.ownerStateDigest,
    retryOrdinal,
    retryReceiptDigest,
    authorityProfileDigest: AUTHORITY_PROFILE_DIGEST,
    verifier: { verifierId: READBACK_VERIFIER_ID, verifierVersion: UPDATE_SYNTHETIC_APPLY_HARNESS_VERSION_V1 },
    observedAtMs: EVALUATION_TIME_MS,
  } as const;
  const readback = buildUpdateCheckpointRollbackReadbackV1(options);
  const context: UpdateCheckpointRollbackReadbackContextV1 = {
    expectedOperationDigest: OPERATION_DIGEST,
    expectedMigrationEdgeDigest: edgeDigest,
    expectedCheckpointDigest: checkpointDigest,
    expectedRollbackTargetTupleDigest: source.tupleDigest,
    expectedIndependentEvidenceDigest: evidenceDigest,
    expectedOwnerStateDigest: source.ownerStateDigest,
    expectedRetryOrdinal: retryOrdinal,
    expectedRetryReceiptDigest: retryReceiptDigest,
    expectedRetryDeterminismDigest: updateCheckpointRollbackRetryDeterminismDigestV1({
      operationDigest: OPERATION_DIGEST,
      migrationEdgeDigest: edgeDigest,
      rollbackTargetTupleDigest: source.tupleDigest,
      retryOrdinal,
      retryReceiptDigest,
    }),
    expectedAuthorityProfileDigest: AUTHORITY_PROFILE_DIGEST,
    expectedVerifier: { verifierId: READBACK_VERIFIER_ID, verifierVersion: UPDATE_SYNTHETIC_APPLY_HARNESS_VERSION_V1 },
    expectedObservedAtMs: EVALUATION_TIME_MS,
  };
  return { readback, result: verifyUpdateCheckpointRollbackReadbackV1(readback, context) };
}

function buildMigrationEdge() {
  const edge = buildUpdateMigrationEdgeV1({
    migrationId: "migration:synthetic-001",
    migrationVersion: UPDATE_SYNTHETIC_APPLY_HARNESS_VERSION_V1,
    ordinal: 1,
    sourceTupleDigest: UPDATE_SYNTHETIC_APPLY_HARNESS_SOURCE_TUPLE_DIGEST_V1,
    targetTupleDigest: UPDATE_SYNTHETIC_APPLY_HARNESS_TARGET_TUPLE_DIGEST_V1,
    authorityProfileDigest: AUTHORITY_PROFILE_DIGEST,
    planner: { plannerId: PLANNER_ID, plannerVersion: UPDATE_SYNTHETIC_APPLY_HARNESS_VERSION_V1 },
    issuedAtMs: OBSERVED_AT_MS,
  });
  const context: UpdateMigrationEdgeVerificationContextV1 = {
    expectedMigrationId: "migration:synthetic-001",
    expectedMigrationVersion: UPDATE_SYNTHETIC_APPLY_HARNESS_VERSION_V1,
    expectedSourceTupleDigest: UPDATE_SYNTHETIC_APPLY_HARNESS_SOURCE_TUPLE_DIGEST_V1,
    expectedTargetTupleDigest: UPDATE_SYNTHETIC_APPLY_HARNESS_TARGET_TUPLE_DIGEST_V1,
    expectedRollbackTargetDigest: UPDATE_SYNTHETIC_APPLY_HARNESS_SOURCE_TUPLE_DIGEST_V1,
    expectedAuthorityProfileDigest: AUTHORITY_PROFILE_DIGEST,
    expectedPreconditionCode: "SOURCE_TUPLE_VERIFIED",
    expectedPostconditionCode: "TARGET_TUPLE_VERIFIED",
    expectedPlanner: { plannerId: PLANNER_ID, plannerVersion: UPDATE_SYNTHETIC_APPLY_HARNESS_VERSION_V1 },
    expectedOrdinal: 1,
  };
  return { edge, result: verifyUpdateMigrationEdgeV1(edge, context) };
}

function buildContinuity(scenario: UpdateSyntheticApplyHarnessFailureV1, target: UpdateSyntheticApplyOwnedStateSnapshotV1, lkg: UpdateLkgV1) {
  const input = continuityInput(acceptedSnapshot(target, scenario === "INVALID_LKG"), lkg, scenario === "REGISTRY_OUTAGE");
  return { result: verifyUpdateContinuityDecisionV1(input.input, input.context) };
}

function assertOutcome<T extends { readonly outcome: string }>(value: T, expected: string, contract: string): void {
  if (value.outcome !== expected) throw new Error(`SYNTHETIC_HARNESS_${contract}_DENIED`);
}

/** Runs one deterministic isolated controller scenario entirely in memory. */
export function runUpdateSyntheticApplyHarnessV1(
  options: UpdateSyntheticApplyHarnessOptionsV1 = {},
): UpdateSyntheticApplyHarnessReceiptV1 {
  const scenario = options.failure ?? "SUCCESS";
  if (!(UPDATE_SYNTHETIC_APPLY_HARNESS_FAILURES_V1 as readonly string[]).includes(scenario)) throw new Error("INVALID_SYNTHETIC_APPLY_HARNESS_SCENARIO");
  const retryOrdinal = options.retryOrdinal ?? UPDATE_SYNTHETIC_APPLY_HARNESS_RETRY_ORDINAL_V1;
  if (!Number.isSafeInteger(retryOrdinal) || retryOrdinal < 1) throw new Error("INVALID_SYNTHETIC_APPLY_HARNESS_RETRY");

  const source = snapshot("lkg:synthetic-001", SOURCE_TUPLE, 0);
  const target = snapshot("candidate:synthetic-001", UPDATE_SYNTHETIC_APPLY_HARNESS_TARGET_TUPLE_V1, 0);
  const invalidLkg = lkgSnapshot(source, "INCOMPLETE");
  const lkg = scenario === "INVALID_LKG" ? invalidLkg : lkgSnapshot(source, "COMPLETE");
  const initialSnapshot = scenario === "REGISTRY_OUTAGE" ? target : source;
  const initialPointer = pointer(initialSnapshot.snapshotId, initialSnapshot.tupleDigest, 1);
  let finalPointer = initialPointer;
  let finalSnapshot = initialSnapshot;
  const trace: string[] = ["CHECK_CONTRACTS", "CHECKPOINT_RECORDED"];

  const promotion = buildPromotionGate();
  assertOutcome(promotion.result, "VERIFIED", "PROMOTION_GATE");
  const edge = buildMigrationEdge();
  assertOutcome(edge.result, "CHECKED", "MIGRATION_EDGE");
  const journalEvents = scenario === "SUCCESS" || scenario === "REGISTRY_OUTAGE" || scenario === "INVALID_LKG"
    ? [
        { outcome: "STAGE_COPIED" as const, timestampMs: OBSERVED_AT_MS },
        { outcome: "STAGE_VERIFIED" as const, timestampMs: OBSERVED_AT_MS + 1 },
        { outcome: "POINTER_SWITCHED" as const, timestampMs: OBSERVED_AT_MS + 2 },
        { outcome: "POSTCONDITION_VERIFIED" as const, timestampMs: OBSERVED_AT_MS + 3 },
      ]
    : [
        { outcome: "STAGE_COPIED" as const, timestampMs: OBSERVED_AT_MS },
        { outcome: "STAGE_VERIFIED" as const, timestampMs: OBSERVED_AT_MS + 1 },
        { outcome: "POINTER_SWITCHED" as const, timestampMs: OBSERVED_AT_MS + 2 },
        { outcome: "POSTCONDITION_FAILED" as const, timestampMs: OBSERVED_AT_MS + 3 },
        { outcome: "LKG_RESTORED" as const, timestampMs: OBSERVED_AT_MS + 4 },
        { outcome: "ZERO_RESIDUE" as const, timestampMs: OBSERVED_AT_MS + 5 },
      ];
  const journal = buildUpdateApplyJournalV1({
    operationDigest: OPERATION_DIGEST,
    sourceLockDigest: source.tupleDigest,
    targetLockDigest: target.tupleDigest,
    revision: 1,
    events: journalEvents,
  });
  const journalResult = verifyUpdateApplyJournalV1(journal, {
    expectedOperationDigest: OPERATION_DIGEST,
    expectedSourceLockDigest: source.tupleDigest,
    expectedTargetLockDigest: target.tupleDigest,
    expectedRevision: 1,
  });
  assertOutcome(journalResult, "ACCEPTED", "APPLY_JOURNAL");
  const checkpoint = buildCheckpoint(source, edge.edge.edgeDigest, journal);
  assertOutcome(checkpoint.result, "RECORDED", "CHECKPOINT");

  const continuity = buildContinuity(scenario, target, lkg);
  if (scenario === "REGISTRY_OUTAGE") assertOutcome(continuity.result, "PRESERVE_ACCEPTED", "CONTINUITY");
  if (scenario === "INVALID_LKG") assertOutcome(continuity.result, "ENTER_SAFE_READ_ONLY", "CONTINUITY");

  let postconditionStatus: "ACCEPT_SWITCH" | "ROLLBACK_REQUIRED" = "ACCEPT_SWITCH";
  let rollbackStatus: "VERIFIED" | "NOT_APPLICABLE" = "NOT_APPLICABLE";
  let retryReceiptDigest = createHash("sha256").update("chimpmaera.update/synthetic-apply/retry/not-applicable/v1").digest("hex");
  let outcome: UpdateSyntheticApplyHarnessReceiptV1["outcome"] = "APPLIED";
  let readOnly = false;

  if (scenario === "REGISTRY_OUTAGE") {
    trace.push("REGISTRY_UNAVAILABLE", "PRESERVE_ACCEPTED", "READBACK");
    outcome = "PRESERVE_ACCEPTED";
  } else if (scenario === "INVALID_LKG") {
    trace.push("INVALID_LKG", "ENTER_SAFE_READ_ONLY", "READBACK");
    finalSnapshot = source;
    finalPointer = initialPointer;
    outcome = "SAFE_READ_ONLY";
    readOnly = true;
  } else {
    trace.push("STAGE_COPY", "VERIFY_STAGED");
    const switched = compareAndSwapUpdateSyntheticApplyPointerV1(initialPointer, initialPointer, { activeSnapshotId: target.snapshotId, activeTupleDigest: target.tupleDigest });
    if (!switched.swapped) throw new Error("SYNTHETIC_HARNESS_SWITCH_CAS_DENIED");
    finalPointer = switched.pointer;
    finalSnapshot = target;
    trace.push("SWITCH_POINTER", "VERIFY_POSTCONDITION");
    const postcondition = buildPostcondition(scenario, source, target);
    const isFailure = scenario === "PARTIAL_MIGRATION" || scenario === "FAILED_POSTCONDITION";
    assertOutcome(postcondition.result, isFailure ? "ROLLBACK_REQUIRED" : "ACCEPT_SWITCH", "POSTCONDITION");
    postconditionStatus = postcondition.result.outcome;
    if (isFailure) {
      trace.push("POSTCONDITION_FAILED", "ROLLBACK_LKG", "CLEANUP", "ZERO_RESIDUE");
      const restored = compareAndSwapUpdateSyntheticApplyPointerV1(finalPointer, finalPointer, { activeSnapshotId: source.snapshotId, activeTupleDigest: source.tupleDigest });
      if (!restored.swapped) throw new Error("SYNTHETIC_HARNESS_ROLLBACK_CAS_DENIED");
      finalPointer = restored.pointer;
      finalSnapshot = source;
      outcome = "ROLLED_BACK_ZERO_RESIDUE";
      retryReceiptDigest = createHash("sha256").update(`chimpmaera.update/synthetic-apply/retry/${scenario}/v1`).digest("hex");
      const rollback = buildRollbackReadback(source, edge.edge.edgeDigest, checkpoint.checkpoint.checkpointDigest, retryOrdinal, retryReceiptDigest);
      assertOutcome(rollback.result, "VERIFIED", "ROLLBACK_READBACK");
      rollbackStatus = "VERIFIED";
      trace.push("RETRY_READBACK");
    } else {
      trace.push("POSTCONDITION_VERIFIED", "READBACK");
    }
  }

  const contractChecks: UpdateSyntheticApplyHarnessContractChecksV1 = {
    promotionGate: "VERIFIED",
    migrationEdge: "CHECKED",
    checkpoint: "RECORDED",
    applyJournal: "ACCEPTED",
    postcondition: postconditionStatus,
    continuity: scenario === "INVALID_LKG" ? "ENTER_SAFE_READ_ONLY" : "PRESERVE_ACCEPTED",
    rollbackReadback: rollbackStatus,
  };
  const readback = {
    activeSnapshotId: finalPointer.activeSnapshotId,
    activeTupleDigest: finalPointer.activeTupleDigest,
    ownerStateDigest: finalSnapshot.ownerStateDigest,
    pointerRevision: finalPointer.revision,
    residueCount: finalSnapshot.residueCount,
  } as const;
  const base = {
    schemaVersion: UPDATE_SYNTHETIC_APPLY_HARNESS_RECEIPT_SCHEMA_V1,
    harnessVersion: UPDATE_SYNTHETIC_APPLY_HARNESS_VERSION_V1,
    scenario,
    outcome,
    readOnly,
    tuple: UPDATE_SYNTHETIC_APPLY_HARNESS_TARGET_TUPLE_V1,
    tupleDigest: UPDATE_SYNTHETIC_APPLY_HARNESS_TARGET_TUPLE_DIGEST_V1,
    sourceTupleDigest: source.tupleDigest,
    lkgDigest: lkg.lkgDigest,
    lkgState: lkg.state,
    lkgRevoked: false as const,
    initialPointer,
    finalPointer,
    initialOwnerStateDigest: initialSnapshot.ownerStateDigest,
    finalOwnerStateDigest: finalSnapshot.ownerStateDigest,
    residueCount: finalSnapshot.residueCount,
    stateTrace: trace,
    contractChecks,
    retryOrdinal,
    retryReceiptDigest,
    readback,
  };
  return immutable({ ...base, receiptDigest: updateSyntheticApplyHarnessReceiptDigestV1(base) });
}

export const executeUpdateSyntheticApplyHarnessV1 = runUpdateSyntheticApplyHarnessV1;
export const runSyntheticApplyHarnessV1 = runUpdateSyntheticApplyHarnessV1;

export function updateSyntheticApplyHarnessReceiptDigestV1(value: object): string {
  const record = value as Record<string, unknown>;
  return digestWithout(record, "receiptDigest");
}

function validReceiptShape(value: unknown): value is UpdateSyntheticApplyHarnessReceiptV1 {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return false;
  const record = value as Record<string, unknown>;
  const expectedKeys = [
    "schemaVersion", "harnessVersion", "scenario", "outcome", "readOnly", "tuple", "tupleDigest", "sourceTupleDigest", "lkgDigest", "lkgState", "lkgRevoked",
    "initialPointer", "finalPointer", "initialOwnerStateDigest", "finalOwnerStateDigest", "residueCount", "stateTrace", "contractChecks",
    "retryOrdinal", "retryReceiptDigest", "readback", "receiptDigest",
  ];
  const actualKeys = Object.keys(record).sort();
  if (actualKeys.length !== expectedKeys.length || actualKeys.some((key, index) => key !== [...expectedKeys].sort()[index])) return false;
  return record.schemaVersion === UPDATE_SYNTHETIC_APPLY_HARNESS_RECEIPT_SCHEMA_V1
    && record.harnessVersion === UPDATE_SYNTHETIC_APPLY_HARNESS_VERSION_V1
    && typeof record.scenario === "string"
    && (UPDATE_SYNTHETIC_APPLY_HARNESS_FAILURES_V1 as readonly string[]).includes(record.scenario)
    && typeof record.outcome === "string"
    && typeof record.readOnly === "boolean"
    && DIGEST.test(record.tupleDigest as string)
    && DIGEST.test(record.sourceTupleDigest as string)
    && DIGEST.test(record.lkgDigest as string)
    && (record.lkgState === "COMPLETE" || record.lkgState === "INCOMPLETE")
    && record.lkgRevoked === false
    && DIGEST.test(record.initialOwnerStateDigest as string)
    && DIGEST.test(record.finalOwnerStateDigest as string)
    && Number.isSafeInteger(record.residueCount) && (record.residueCount as number) >= 0
    && Array.isArray(record.stateTrace) && record.stateTrace.every((entry) => typeof entry === "string")
    && Number.isSafeInteger(record.retryOrdinal) && (record.retryOrdinal as number) >= 1
    && DIGEST.test(record.retryReceiptDigest as string)
    && validPointer(record.initialPointer)
    && validPointer(record.finalPointer)
    && validReadback(record.readback)
    && record.contractChecks !== null && typeof record.contractChecks === "object"
    && DIGEST.test(record.receiptDigest as string);
}

function validPointer(value: unknown): value is UpdateSyntheticApplyPointerV1 {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return false;
  const record = value as Record<string, unknown>;
  if (Object.keys(record).sort().join(",") !== ["activeSnapshotId", "activeTupleDigest", "pointerDigest", "revision"].sort().join(",")) return false;
  if (typeof record.activeSnapshotId !== "string" || !DIGEST.test(record.activeTupleDigest as string)
    || !Number.isSafeInteger(record.revision) || (record.revision as number) < 1 || !DIGEST.test(record.pointerDigest as string)) return false;
  return record.pointerDigest === pointerDigest({
    activeSnapshotId: record.activeSnapshotId,
    activeTupleDigest: record.activeTupleDigest as string,
    revision: record.revision as number,
  });
}

function validReadback(value: unknown): value is UpdateSyntheticApplyHarnessReadbackV1 {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return false;
  const record = value as Record<string, unknown>;
  if (Object.keys(record).sort().join(",") !== ["activeSnapshotId", "activeTupleDigest", "ownerStateDigest", "pointerRevision", "residueCount"].sort().join(",")) return false;
  return typeof record.activeSnapshotId === "string"
    && DIGEST.test(record.activeTupleDigest as string)
    && DIGEST.test(record.ownerStateDigest as string)
    && Number.isSafeInteger(record.pointerRevision) && (record.pointerRevision as number) >= 1
    && Number.isSafeInteger(record.residueCount) && (record.residueCount as number) >= 0;
}

export function verifyUpdateSyntheticApplyHarnessReceiptV1(value: unknown): UpdateSyntheticApplyHarnessVerificationResultV1 {
  if (!validReceiptShape(value)) return immutable({ outcome: "DENIED", reasonCodes: ["SCHEMA_DENIED"], exitCode: 70 });
  try {
    const receipt = value;
    if (updateSyntheticApplyHarnessReceiptDigestV1(receipt) !== receipt.receiptDigest) return immutable({ outcome: "DENIED", reasonCodes: ["DIGEST_MISMATCH_DENIED"], exitCode: 71 });
    if (receipt.tupleDigest !== UPDATE_SYNTHETIC_APPLY_HARNESS_TARGET_TUPLE_DIGEST_V1
      || canonicalJson(receipt.tuple) !== canonicalJson(UPDATE_SYNTHETIC_APPLY_HARNESS_TARGET_TUPLE_V1)) return immutable({ outcome: "DENIED", reasonCodes: ["TUPLE_MISMATCH_DENIED"], exitCode: 72 });
    if (receipt.readback.activeSnapshotId !== receipt.finalPointer.activeSnapshotId
      || receipt.readback.activeTupleDigest !== receipt.finalPointer.activeTupleDigest
      || receipt.readback.ownerStateDigest !== receipt.finalOwnerStateDigest
      || receipt.readback.pointerRevision !== receipt.finalPointer.revision
      || receipt.readback.residueCount !== receipt.residueCount) return immutable({ outcome: "DENIED", reasonCodes: ["READBACK_MISMATCH_DENIED"], exitCode: 73 });
    return immutable({ outcome: "VERIFIED", reasonCodes: ["SYNTHETIC_APPLY_RECEIPT_VERIFIED"], exitCode: 0 });
  } catch {
    return immutable({ outcome: "DENIED", reasonCodes: ["SCHEMA_DENIED"], exitCode: 70 });
  }
}

export function parseUpdateSyntheticApplyHarnessReceiptV1(json: string): UpdateSyntheticApplyHarnessVerificationResultV1 {
  try {
    return verifyUpdateSyntheticApplyHarnessReceiptV1(JSON.parse(json) as unknown);
  } catch {
    return immutable({ outcome: "DENIED", reasonCodes: ["SCHEMA_DENIED"], exitCode: 70 });
  }
}

export function renderVerifiedUpdateSyntheticApplyHarnessReceiptV1(value: unknown): string {
  if (verifyUpdateSyntheticApplyHarnessReceiptV1(value).outcome !== "VERIFIED") throw new Error("UNSAFE_OR_INVALID_SYNTHETIC_APPLY_RECEIPT");
  return canonicalJson(value);
}
