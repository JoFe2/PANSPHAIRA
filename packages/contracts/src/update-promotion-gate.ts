import { createHash } from "node:crypto";
import { types as nodeUtilTypes } from "node:util";
import { canonicalJson } from "./canonical-json.js";
import {
  UPDATE_AXIS_NAMES_V1,
  updateTupleDigestV1,
  type UpdateAxisNameV1,
  type UpdateTupleV1,
} from "./update-check-plan.js";

/**
 * PSAI #53 update promotion gate proof.
 *
 * This is a closed, pure metadata contract. It binds a candidate's exact
 * Core/Pack/Adapter/Policy/Schema/Generation tuple and candidate artifact
 * evidence to an independently named verifier and a separate promoter
 * decision. A candidate or its updater cannot occupy a verification or
 * promotion role: self-attestation, self-promotion, and every role collision
 * fail closed. This operation does not attest, does not promote, issues no
 * promotion capability, and performs no filesystem, process, worker, network,
 * or clock effects.
 */
export const UPDATE_PROMOTION_GATE_SCHEMA_V1 = "chimpmaera.update/promotion-gate/v1" as const;
export const UPDATE_PROMOTION_GATE_VERIFIER_SCHEMA_V1 = "chimpmaera.update/promotion-gate-verifier/v1" as const;
export const UPDATE_PROMOTION_GATE_DECISION_SCHEMA_V1 = "chimpmaera.update/promotion-decision/v1" as const;
export const UPDATE_PROMOTION_GATE_PHASE_V1 = "PROMOTION_GATE" as const;
export const UPDATE_PROMOTION_GATE_TRANSITION_V1 = "PROMOTION_GATE_VERIFIED" as const;
export const UPDATE_PROMOTION_GATE_NO_CAPABILITY_V1 = false as const;

export const UPDATE_PROMOTION_GATE_KEYS_V1: readonly string[] = Object.freeze([
  "schemaVersion",
  "transition",
  "phase",
  "candidateId",
  "updaterId",
  "sourceTupleDigest",
  "candidateTuple",
  "candidateTupleDigest",
  "candidateArtifactDigest",
  "identityBoundaryDigest",
  "verifier",
  "promoterDecision",
  "capabilityIssued",
  "observedAtMs",
  "promotionGateDigest",
]);

const VERIFIER_KEYS = Object.freeze(["schemaVersion", "verifierId", "verifierVersion"]);
const DECISION_KEYS = Object.freeze(["schemaVersion", "decisionId", "promoterId", "decisionDigest"]);
const BUILD_KEYS = Object.freeze([
  "candidateId",
  "updaterId",
  "sourceTupleDigest",
  "candidateTuple",
  "candidateArtifactDigest",
  "identityBoundaryDigest",
  "verifier",
  "promoterDecision",
  "observedAtMs",
]);
const CONTEXT_KEYS = Object.freeze([
  "expectedCandidateId",
  "expectedUpdaterId",
  "expectedSourceTupleDigest",
  "expectedCandidateTuple",
  "expectedCandidateTupleDigest",
  "expectedCandidateArtifactDigest",
  "expectedIdentityBoundaryDigest",
  "expectedVerifier",
  "expectedPromoterDecision",
  "expectedObservedAtMs",
]);
const EXPECTED_VERIFIER_KEYS = Object.freeze(["verifierId", "verifierVersion"]);
const EXPECTED_DECISION_KEYS = Object.freeze(["decisionId", "promoterId", "decisionDigest"]);
const COMPONENT_KEYS = Object.freeze(["componentId", "version", "digest"]);
const IDENTITY_BOUNDARY_KEYS = Object.freeze(["candidateSubjectId", "updaterId", "attestorId", "verifierId", "promoterId"]);

export interface UpdatePromotionGateVerifierV1 {
  readonly schemaVersion: typeof UPDATE_PROMOTION_GATE_VERIFIER_SCHEMA_V1;
  readonly verifierId: string;
  readonly verifierVersion: string;
}

export interface UpdatePromotionGatePromoterDecisionV1 {
  readonly schemaVersion: typeof UPDATE_PROMOTION_GATE_DECISION_SCHEMA_V1;
  readonly decisionId: string;
  readonly promoterId: string;
  readonly decisionDigest: string;
}

export interface UpdatePromotionGateV1 {
  readonly schemaVersion: typeof UPDATE_PROMOTION_GATE_SCHEMA_V1;
  readonly transition: typeof UPDATE_PROMOTION_GATE_TRANSITION_V1;
  readonly phase: typeof UPDATE_PROMOTION_GATE_PHASE_V1;
  readonly candidateId: string;
  readonly updaterId: string;
  readonly sourceTupleDigest: string;
  readonly candidateTuple: UpdateTupleV1;
  readonly candidateTupleDigest: string;
  readonly candidateArtifactDigest: string;
  readonly identityBoundaryDigest: string;
  readonly verifier: UpdatePromotionGateVerifierV1;
  readonly promoterDecision: UpdatePromotionGatePromoterDecisionV1;
  readonly capabilityIssued: boolean;
  readonly observedAtMs: number;
  readonly promotionGateDigest: string;
}

export interface UpdatePromotionGateIdentityBoundaryV1 {
  readonly candidateSubjectId: string;
  readonly updaterId: string;
  readonly attestorId: string;
  readonly verifierId: string;
  readonly promoterId: string;
}

export interface UpdatePromotionGateContextV1 {
  readonly expectedCandidateId: string;
  readonly expectedUpdaterId: string;
  readonly expectedSourceTupleDigest: string;
  readonly expectedCandidateTuple: UpdateTupleV1;
  readonly expectedCandidateTupleDigest: string;
  readonly expectedCandidateArtifactDigest: string;
  readonly expectedIdentityBoundaryDigest: string;
  readonly expectedVerifier: { readonly verifierId: string; readonly verifierVersion: string };
  readonly expectedPromoterDecision: { readonly decisionId: string; readonly promoterId: string; readonly decisionDigest: string };
  readonly expectedObservedAtMs: number;
}

export interface BuildUpdatePromotionGateOptionsV1 {
  readonly candidateId: string;
  readonly updaterId: string;
  readonly sourceTupleDigest: string;
  readonly candidateTuple: UpdateTupleV1;
  readonly candidateArtifactDigest: string;
  readonly identityBoundaryDigest: string;
  readonly verifier: UpdatePromotionGateVerifierV1;
  readonly promoterDecision: UpdatePromotionGatePromoterDecisionV1;
  readonly observedAtMs: number;
}

export type UpdatePromotionGateReasonCodeV1 =
  | "TUPLE_MISMATCH_DENIED"
  | "SOURCE_TUPLE_MISMATCH_DENIED"
  | "ARTIFACT_EVIDENCE_DENIED"
  | "CANDIDATE_BINDING_DENIED"
  | "IDENTITY_BOUNDARY_DENIED"
  | "VERIFIER_MISMATCH_DENIED"
  | "PROMOTER_DECISION_MISMATCH_DENIED"
  | "SELF_ATTESTATION_DENIED"
  | "SELF_PROMOTION_DENIED"
  | "ROLE_COLLISION_DENIED"
  | "CAPABILITY_CLAIM_DENIED"
  | "OBSERVED_TIME_MISMATCH_DENIED"
  | "SCHEMA_DENIED"
  | "UNSUPPORTED_CONTRACT_VERSION_DENIED"
  | "INVALID_JSON_DENIED"
  | "INDEPENDENT_CONTEXT_DENIED"
  | "DIGEST_MISMATCH_DENIED";

export const UPDATE_PROMOTION_GATE_EXIT_CODES_V1: Readonly<Record<UpdatePromotionGateReasonCodeV1, number>> = Object.freeze({
  TUPLE_MISMATCH_DENIED: 100,
  SOURCE_TUPLE_MISMATCH_DENIED: 116,
  ARTIFACT_EVIDENCE_DENIED: 101,
  CANDIDATE_BINDING_DENIED: 102,
  IDENTITY_BOUNDARY_DENIED: 103,
  VERIFIER_MISMATCH_DENIED: 104,
  PROMOTER_DECISION_MISMATCH_DENIED: 105,
  SELF_ATTESTATION_DENIED: 106,
  SELF_PROMOTION_DENIED: 107,
  ROLE_COLLISION_DENIED: 108,
  CAPABILITY_CLAIM_DENIED: 109,
  OBSERVED_TIME_MISMATCH_DENIED: 110,
  SCHEMA_DENIED: 111,
  UNSUPPORTED_CONTRACT_VERSION_DENIED: 112,
  INVALID_JSON_DENIED: 113,
  INDEPENDENT_CONTEXT_DENIED: 114,
  DIGEST_MISMATCH_DENIED: 115,
});

export type UpdatePromotionGateResultV1 =
  | { readonly outcome: "VERIFIED"; readonly reasonCodes: readonly ["PROMOTION_GATE_VERIFIED"]; readonly exitCode: 0 }
  | { readonly outcome: "DENIED"; readonly reasonCodes: readonly [UpdatePromotionGateReasonCodeV1]; readonly exitCode: number };

const DIGEST = /^[a-f0-9]{64}$/;
const CANDIDATE_ID = /^candidate:[a-z0-9][a-z0-9._-]{2,95}$/;
const UPDATER_ID = /^updater:[a-z0-9][a-z0-9._-]{2,95}$/;
const ATTESTOR_ID = /^attestor:[a-z0-9][a-z0-9._-]{2,95}$/;
// The verifier must be named independently of the candidate and updater at the
// shape level; the verification path additionally fails closed on any actor
// alias collision with the candidate or updater.
const VERIFIER_ID = /^verifier:independent-[a-z0-9][a-z0-9._-]{2,95}$/;
const PROMOTER_ID = /^promoter:[a-z0-9][a-z0-9._-]{2,95}$/;
const DECISION_ID = /^decision:[a-z0-9][a-z0-9._-]{2,95}$/;
const CANONICAL_SEMVER = /^(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)(?:-((?:0|[1-9][0-9]*|[0-9]*[a-zA-Z-][0-9a-zA-Z-]*)(?:\.(?:0|[1-9][0-9]*|[0-9]*[a-zA-Z-][0-9a-zA-Z-]*))*))?(?:\+([0-9a-zA-Z-]+(?:\.[0-9a-zA-Z-]+)*))?$/;
const DANGEROUS_KEYS = new Set(["__proto__", "prototype", "constructor"]);
const COMPONENT_ID_PATTERNS: Readonly<Record<UpdateAxisNameV1, RegExp>> = Object.freeze({
  core: /^core:[a-z0-9][a-z0-9._-]{2,95}$/,
  packs: /^pack:[a-z0-9][a-z0-9._-]{2,95}$/,
  adapters: /^adapter:[a-z0-9][a-z0-9._-]{2,95}$/,
  policies: /^policy:[a-z0-9][a-z0-9._-]{2,95}$/,
  schemas: /^schema:[a-z0-9][a-z0-9._-]{2,95}$/,
  generations: /^generation:[a-z0-9][a-z0-9._-]{2,95}$/,
});

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  if (value === null || typeof value !== "object" || Array.isArray(value) || Object.getPrototypeOf(value) !== Object.prototype) return false;
  for (const key of Reflect.ownKeys(value)) {
    if (typeof key !== "string" || DANGEROUS_KEYS.has(key)) return false;
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (descriptor === undefined || !("value" in descriptor) || descriptor.enumerable !== true) return false;
  }
  return true;
}

function exactKeys(value: unknown, expected: readonly string[]): value is Record<string, unknown> {
  if (!isPlainRecord(value)) return false;
  const actual = Object.keys(value).sort();
  const wanted = [...expected].sort();
  return actual.length === wanted.length && actual.every((key, index) => key === wanted[index]);
}

function isDenseArray(value: unknown): value is unknown[] {
  if (!Array.isArray(value) || Object.getPrototypeOf(value) !== Array.prototype) return false;
  const keys = Reflect.ownKeys(value);
  const expected = [...Array.from({ length: value.length }, (_, index) => String(index)), "length"];
  return keys.every((key) => typeof key === "string")
    && keys.length === expected.length
    && expected.every((key) => keys.includes(key))
    && Array.from({ length: value.length }, (_, index) => String(index)).every((key) => {
      const descriptor = Object.getOwnPropertyDescriptor(value, key);
      return descriptor !== undefined && "value" in descriptor && descriptor.enumerable === true;
    });
}

function safeClone<T>(value: T, ancestors = new Set<object>()): T {
  if (nodeUtilTypes.isProxy(value)) throw new TypeError("UNSAFE_JSON_PROXY");
  if (value === null || typeof value === "string" || typeof value === "boolean") return value;
  if (typeof value === "number") {
    if (!Number.isFinite(value) || Object.is(value, -0) || (Number.isInteger(value) && !Number.isSafeInteger(value))) throw new TypeError("UNSAFE_JSON_NUMBER");
    return value;
  }
  if (Array.isArray(value)) {
    if (!isDenseArray(value) || ancestors.has(value)) throw new TypeError("UNSAFE_JSON_ARRAY");
    return value.map((item) => safeClone(item, new Set(ancestors).add(value))) as T;
  }
  if (!isPlainRecord(value) || ancestors.has(value as object)) throw new TypeError("UNSAFE_JSON_OBJECT");
  const output: Record<string, unknown> = {};
  for (const key of Object.keys(value)) {
    output[key] = safeClone((value as Record<string, unknown>)[key], new Set(ancestors).add(value as object));
  }
  return output as T;
}

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
  return deepFreeze(safeClone(value));
}

function isDigest(value: unknown): value is string {
  return typeof value === "string" && DIGEST.test(value);
}

function isTime(value: unknown): value is number {
  return Number.isSafeInteger(value) && !Object.is(value, -0) && (value as number) >= 0;
}

function isComponent(value: unknown, axis: UpdateAxisNameV1): boolean {
  return exactKeys(value, COMPONENT_KEYS)
    && typeof value.componentId === "string" && COMPONENT_ID_PATTERNS[axis].test(value.componentId)
    && typeof value.version === "string" && CANONICAL_SEMVER.test(value.version)
    && isDigest(value.digest);
}

function validTuple(value: unknown): value is UpdateTupleV1 {
  if (!exactKeys(value, UPDATE_AXIS_NAMES_V1)) return false;
  const tuple = value as Record<UpdateAxisNameV1, unknown>;
  return UPDATE_AXIS_NAMES_V1.every((axis) => {
    const components = tuple[axis];
    return isDenseArray(components)
      && components.every((component) => isComponent(component, axis))
      && components.length === new Set(components.map((component) => (component as { readonly componentId: unknown }).componentId)).size;
  });
}

function validCompleteTuple(value: unknown): value is UpdateTupleV1 {
  if (!validTuple(value)) return false;
  const tuple = value;
  return UPDATE_AXIS_NAMES_V1.every((axis) => (tuple[axis] as readonly unknown[]).length > 0);
}

function isVerifier(value: unknown): value is UpdatePromotionGateVerifierV1 {
  return exactKeys(value, VERIFIER_KEYS)
    && value.schemaVersion === UPDATE_PROMOTION_GATE_VERIFIER_SCHEMA_V1
    && typeof value.verifierId === "string" && VERIFIER_ID.test(value.verifierId)
    && typeof value.verifierVersion === "string" && CANONICAL_SEMVER.test(value.verifierVersion);
}

function isPromoterDecision(value: unknown): value is UpdatePromotionGatePromoterDecisionV1 {
  return exactKeys(value, DECISION_KEYS)
    && value.schemaVersion === UPDATE_PROMOTION_GATE_DECISION_SCHEMA_V1
    && typeof value.decisionId === "string" && DECISION_ID.test(value.decisionId)
    && typeof value.promoterId === "string" && PROMOTER_ID.test(value.promoterId)
    && isDigest(value.decisionDigest);
}

function isProof(value: unknown): value is UpdatePromotionGateV1 {
  return exactKeys(value, UPDATE_PROMOTION_GATE_KEYS_V1)
    && typeof value.schemaVersion === "string"
    && value.transition === UPDATE_PROMOTION_GATE_TRANSITION_V1
    && value.phase === UPDATE_PROMOTION_GATE_PHASE_V1
    && typeof value.candidateId === "string" && CANDIDATE_ID.test(value.candidateId)
    && typeof value.updaterId === "string" && UPDATER_ID.test(value.updaterId)
    && validCompleteTuple(value.candidateTuple)
    && isDigest(value.sourceTupleDigest)
    && isDigest(value.candidateTupleDigest)
    && isDigest(value.candidateArtifactDigest)
    && isDigest(value.identityBoundaryDigest)
    && isVerifier(value.verifier)
    && isPromoterDecision(value.promoterDecision)
    && typeof value.capabilityIssued === "boolean"
    && isTime(value.observedAtMs)
    && isDigest(value.promotionGateDigest);
}

function isExpectedVerifier(value: unknown): value is { readonly verifierId: string; readonly verifierVersion: string } {
  return exactKeys(value, EXPECTED_VERIFIER_KEYS)
    && typeof value.verifierId === "string" && VERIFIER_ID.test(value.verifierId)
    && typeof value.verifierVersion === "string" && CANONICAL_SEMVER.test(value.verifierVersion);
}

function isExpectedDecision(value: unknown): value is { readonly decisionId: string; readonly promoterId: string; readonly decisionDigest: string } {
  return exactKeys(value, EXPECTED_DECISION_KEYS)
    && typeof value.decisionId === "string" && DECISION_ID.test(value.decisionId)
    && typeof value.promoterId === "string" && PROMOTER_ID.test(value.promoterId)
    && isDigest(value.decisionDigest);
}

function isContext(value: unknown): value is UpdatePromotionGateContextV1 {
  return exactKeys(value, CONTEXT_KEYS)
    && typeof value.expectedCandidateId === "string" && CANDIDATE_ID.test(value.expectedCandidateId)
    && typeof value.expectedUpdaterId === "string" && UPDATER_ID.test(value.expectedUpdaterId)
    && validCompleteTuple(value.expectedCandidateTuple)
    && isDigest(value.expectedSourceTupleDigest)
    && isDigest(value.expectedCandidateTupleDigest)
    && isDigest(value.expectedCandidateArtifactDigest)
    && isDigest(value.expectedIdentityBoundaryDigest)
    && isExpectedVerifier(value.expectedVerifier)
    && isExpectedDecision(value.expectedPromoterDecision)
    && isTime(value.expectedObservedAtMs);
}

export function updatePromotionGateDigestV1(value: object): string {
  const cloned = safeClone(value);
  if (!isPlainRecord(cloned)) throw new TypeError("UNSAFE_PROMOTION_GATE_DIGEST_INPUT");
  const unsigned: Record<string, unknown> = {};
  for (const key of Object.keys(cloned)) {
    if (key !== "promotionGateDigest") unsigned[key] = cloned[key];
  }
  return createHash("sha256").update(canonicalJson(unsigned)).digest("hex");
}

export function updatePromotionGateIdentityBoundaryDigestV1(boundary: UpdatePromotionGateIdentityBoundaryV1): string {
  const cloned = safeClone(boundary);
  if (!exactKeys(cloned, IDENTITY_BOUNDARY_KEYS)) throw new TypeError("INVALID_IDENTITY_BOUNDARY");
  if (!CANDIDATE_ID.test(cloned.candidateSubjectId)
    || !UPDATER_ID.test(cloned.updaterId)
    || !ATTESTOR_ID.test(cloned.attestorId)
    || !VERIFIER_ID.test(cloned.verifierId)
    || !PROMOTER_ID.test(cloned.promoterId)) throw new TypeError("INVALID_IDENTITY_BOUNDARY");
  return createHash("sha256").update(canonicalJson(cloned)).digest("hex");
}

function deny(reason: UpdatePromotionGateReasonCodeV1): UpdatePromotionGateResultV1 {
  return immutable({
    outcome: "DENIED" as const,
    reasonCodes: [reason] as const,
    exitCode: UPDATE_PROMOTION_GATE_EXIT_CODES_V1[reason],
  });
}

function actorAlias(identity: string): string {
  const separator = identity.indexOf(":");
  return identity.slice(separator + 1).toLowerCase().replace(/[._-]+/g, "-");
}

export function buildUpdatePromotionGateV1(options: BuildUpdatePromotionGateOptionsV1): UpdatePromotionGateV1 {
  let cloned: unknown;
  try {
    cloned = safeClone(options);
  } catch {
    throw new Error("INVALID_PROMOTION_GATE_FIXTURE");
  }
  if (!exactKeys(cloned, BUILD_KEYS)
    || typeof cloned.candidateId !== "string" || !CANDIDATE_ID.test(cloned.candidateId)
    || typeof cloned.updaterId !== "string" || !UPDATER_ID.test(cloned.updaterId)
    || !isDigest(cloned.sourceTupleDigest)
    || !validCompleteTuple(cloned.candidateTuple)
    || !isDigest(cloned.candidateArtifactDigest)
    || !isDigest(cloned.identityBoundaryDigest)
    || !isVerifier(cloned.verifier)
    || !isPromoterDecision(cloned.promoterDecision)
    || !isTime(cloned.observedAtMs)) {
    throw new Error("INVALID_PROMOTION_GATE_FIXTURE");
  }
  const candidateTupleDigest = updateTupleDigestV1(cloned.candidateTuple);
  const unsigned = {
    schemaVersion: UPDATE_PROMOTION_GATE_SCHEMA_V1,
    transition: UPDATE_PROMOTION_GATE_TRANSITION_V1,
    phase: UPDATE_PROMOTION_GATE_PHASE_V1,
    candidateId: cloned.candidateId,
    updaterId: cloned.updaterId,
    sourceTupleDigest: cloned.sourceTupleDigest,
    candidateTuple: cloned.candidateTuple,
    candidateTupleDigest,
    candidateArtifactDigest: cloned.candidateArtifactDigest,
    identityBoundaryDigest: cloned.identityBoundaryDigest,
    verifier: cloned.verifier,
    promoterDecision: cloned.promoterDecision,
    capabilityIssued: UPDATE_PROMOTION_GATE_NO_CAPABILITY_V1,
    observedAtMs: cloned.observedAtMs,
  };
  return immutable({ ...unsigned, promotionGateDigest: updatePromotionGateDigestV1(unsigned) });
}

export function verifyUpdatePromotionGateV1(
  value: unknown,
  context: UpdatePromotionGateContextV1 | undefined,
): UpdatePromotionGateResultV1 {
  let proof: unknown;
  try {
    proof = safeClone(value);
  } catch {
    return deny("SCHEMA_DENIED");
  }
  if (!isProof(proof)) return deny("SCHEMA_DENIED");
  if (proof.schemaVersion !== UPDATE_PROMOTION_GATE_SCHEMA_V1) return deny("UNSUPPORTED_CONTRACT_VERSION_DENIED");
  if (context === undefined) return deny("INDEPENDENT_CONTEXT_DENIED");
  let expected: UpdatePromotionGateContextV1;
  try {
    expected = safeClone(context);
  } catch {
    return deny("INDEPENDENT_CONTEXT_DENIED");
  }
  if (!isContext(expected)) return deny("INDEPENDENT_CONTEXT_DENIED");
  if (updatePromotionGateDigestV1(proof) !== proof.promotionGateDigest) return deny("DIGEST_MISMATCH_DENIED");
  let tupleDigest: string;
  try {
    tupleDigest = updateTupleDigestV1(proof.candidateTuple);
  } catch {
    return deny("TUPLE_MISMATCH_DENIED");
  }
  if (tupleDigest !== proof.candidateTupleDigest
    || tupleDigest !== expected.expectedCandidateTupleDigest
    || canonicalJson(safeClone(proof.candidateTuple)) !== canonicalJson(safeClone(expected.expectedCandidateTuple))) {
    return deny("TUPLE_MISMATCH_DENIED");
  }
  if (proof.sourceTupleDigest !== expected.expectedSourceTupleDigest) return deny("SOURCE_TUPLE_MISMATCH_DENIED");
  if (proof.candidateArtifactDigest !== expected.expectedCandidateArtifactDigest) return deny("ARTIFACT_EVIDENCE_DENIED");
  if (proof.candidateId !== expected.expectedCandidateId || proof.updaterId !== expected.expectedUpdaterId) return deny("CANDIDATE_BINDING_DENIED");
  if (proof.identityBoundaryDigest !== expected.expectedIdentityBoundaryDigest) return deny("IDENTITY_BOUNDARY_DENIED");
  if (proof.verifier.verifierId !== expected.expectedVerifier.verifierId
    || proof.verifier.verifierVersion !== expected.expectedVerifier.verifierVersion) return deny("VERIFIER_MISMATCH_DENIED");
  if (proof.promoterDecision.decisionId !== expected.expectedPromoterDecision.decisionId
    || proof.promoterDecision.promoterId !== expected.expectedPromoterDecision.promoterId
    || proof.promoterDecision.decisionDigest !== expected.expectedPromoterDecision.decisionDigest) {
    return deny("PROMOTER_DECISION_MISMATCH_DENIED");
  }
  const candidateAlias = actorAlias(proof.candidateId);
  const updaterAlias = actorAlias(proof.updaterId);
  const verifierAlias = actorAlias(proof.verifier.verifierId);
  const promoterAlias = actorAlias(proof.promoterDecision.promoterId);
  if (verifierAlias === candidateAlias || verifierAlias === updaterAlias) return deny("SELF_ATTESTATION_DENIED");
  if (promoterAlias === candidateAlias || promoterAlias === updaterAlias) return deny("SELF_PROMOTION_DENIED");
  if (candidateAlias === updaterAlias || verifierAlias === promoterAlias) return deny("ROLE_COLLISION_DENIED");
  if (proof.capabilityIssued !== UPDATE_PROMOTION_GATE_NO_CAPABILITY_V1) return deny("CAPABILITY_CLAIM_DENIED");
  if (proof.observedAtMs !== expected.expectedObservedAtMs) return deny("OBSERVED_TIME_MISMATCH_DENIED");
  return immutable({
    outcome: "VERIFIED" as const,
    reasonCodes: ["PROMOTION_GATE_VERIFIED"] as const,
    exitCode: 0,
  });
}

export function parseUpdatePromotionGateV1(
  json: string,
  context: UpdatePromotionGateContextV1 | undefined,
): UpdatePromotionGateResultV1 {
  try {
    return verifyUpdatePromotionGateV1(JSON.parse(json), context);
  } catch {
    return deny("INVALID_JSON_DENIED");
  }
}

export function renderVerifiedUpdatePromotionGateV1(
  value: UpdatePromotionGateV1,
  context: UpdatePromotionGateContextV1,
): string {
  let snapshot: UpdatePromotionGateV1;
  try {
    snapshot = immutable(value);
  } catch {
    throw new Error("UNSAFE_OR_INVALID_PROMOTION_GATE");
  }
  if (verifyUpdatePromotionGateV1(snapshot, context).outcome !== "VERIFIED") throw new Error("UNSAFE_OR_INVALID_PROMOTION_GATE");
  return canonicalJson(snapshot);
}