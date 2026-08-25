import { createHash } from "node:crypto";
import { canonicalJson } from "./canonical-json.js";

export const VERIFICATION_FABRIC_BUNDLE_SCHEMA_V1 = "chimpmaera.verification/fabric-bundle/v1" as const;
export const VERIFICATION_PLAN_SCHEMA_V1 = "chimpmaera.verification/plan/v1" as const;
export const VERIFICATION_CHECK_RUN_SCHEMA_V1 = "chimpmaera.verification/check-run/v1" as const;
export const VERIFICATION_EVIDENCE_BUNDLE_SCHEMA_V1 = "chimpmaera.verification/evidence-bundle/v1" as const;
export const VERIFICATION_VERDICT_SCHEMA_V1 = "chimpmaera.verification/verdict/v1" as const;
export const VERIFICATION_SELF_TEST_IDENTITY_SCHEMA_V1 = "chimpmaera.verification/self-test-identity/v1" as const;
export const VERIFICATION_REVALIDATION_TRIGGER_SCHEMA_V1 = "chimpmaera.verification/revalidation-trigger/v1" as const;
export const VERIFICATION_LKG_POINTER_SCHEMA_V1 = "chimpmaera.verification/lkg-pointer/v1" as const;
export const VERIFICATION_LKG_READBACK_SCHEMA_V1 = "chimpmaera.verification/lkg-readback/v1" as const;

export type VerificationReasonCodeV1 =
  | "VERIFICATION_COMPLETE"
  | "SCHEMA_DENIED"
  | "EVIDENCE_MISSING_DENIED"
  | "EVIDENCE_STALE_DENIED"
  | "EVIDENCE_MISMATCH_DENIED"
  | "SELF_PRODUCED_EVIDENCE_DENIED"
  | "CHECK_FAILED_DENIED"
  | "LKG_CORRUPT_DENIED"
  | "VERDICT_MISMATCH_DENIED";

export interface VerificationPlanV1 {
  readonly schemaVersion: typeof VERIFICATION_PLAN_SCHEMA_V1;
  readonly planId: string;
  readonly subjectId: string;
  readonly subjectProducerId: string;
  readonly subjectDigest: string;
  readonly profileId: string;
  readonly issuedAtMs: number;
  readonly evidenceMaxAgeMs: number;
  readonly requiredCheckIds: readonly string[];
  readonly artifactRefs: readonly string[];
  readonly planDigest: string;
}

export interface VerificationCheckRunV1 {
  readonly schemaVersion: typeof VERIFICATION_CHECK_RUN_SCHEMA_V1;
  readonly checkRunId: string;
  readonly checkId: string;
  readonly planDigest: string;
  readonly subjectDigest: string;
  readonly verifierId: string;
  readonly startedAtMs: number;
  readonly completedAtMs: number;
  readonly outcome: "PASS" | "FAIL" | "ERROR";
  readonly runDigest: string;
}

export interface VerificationEvidenceBundleV1 {
  readonly schemaVersion: typeof VERIFICATION_EVIDENCE_BUNDLE_SCHEMA_V1;
  readonly bundleId: string;
  readonly planDigest: string;
  readonly subjectDigest: string;
  readonly producerId: string;
  readonly collectedAtMs: number;
  readonly expiresAtMs: number;
  readonly checkRunDigests: readonly string[];
  readonly artifactRefs: readonly string[];
  readonly bundleDigest: string;
}

export interface VerificationVerdictV1 {
  readonly schemaVersion: typeof VERIFICATION_VERDICT_SCHEMA_V1;
  readonly verdictId: string;
  readonly status: "VERIFIED" | "DENIED" | "INCONCLUSIVE";
  readonly reasonCodes: readonly VerificationReasonCodeV1[];
  readonly planDigest: string;
  readonly subjectDigest: string;
  readonly evidenceBundleDigest: string;
  readonly evaluatedAtMs: number;
  readonly verdictDigest: string;
}

export interface VerificationSelfTestIdentityV1 {
  readonly schemaVersion: typeof VERIFICATION_SELF_TEST_IDENTITY_SCHEMA_V1;
  readonly verifierId: string;
  readonly producerId: string;
  readonly subjectProducerId: string;
  readonly independence: "INDEPENDENT";
  readonly issuedAtMs: number;
  readonly identityDigest: string;
}

export interface VerificationRevalidationTriggerV1 {
  readonly schemaVersion: typeof VERIFICATION_REVALIDATION_TRIGGER_SCHEMA_V1;
  readonly triggerId: string;
  readonly state: "ARMED";
  readonly causes: readonly ("SUBJECT_CHANGED" | "PLAN_CHANGED" | "EVIDENCE_EXPIRED" | "MANUAL")[];
  readonly observedSubjectDigest: string;
  readonly observedPlanDigest: string;
  readonly observedEvidenceBundleDigest: string;
  readonly armedAtMs: number;
  readonly triggerDigest: string;
}

export interface VerificationLkgPointerV1 {
  readonly schemaVersion: typeof VERIFICATION_LKG_POINTER_SCHEMA_V1;
  readonly pointerId: string;
  readonly targetVerdictDigest: string;
  readonly targetEvidenceBundleDigest: string;
  readonly generation: number;
  readonly pointerDigest: string;
}

export interface VerificationLkgReadbackV1 {
  readonly schemaVersion: typeof VERIFICATION_LKG_READBACK_SCHEMA_V1;
  readonly pointerId: string;
  readonly pointerDigest: string;
  readonly observedVerdictDigest: string;
  readonly observedEvidenceBundleDigest: string;
  readonly observedGeneration: number;
  readonly status: "MATCHED" | "MISMATCH" | "MISSING";
  readonly readAtMs: number;
  readonly readbackDigest: string;
}

export interface VerificationFabricBundleV1 {
  readonly schemaVersion: typeof VERIFICATION_FABRIC_BUNDLE_SCHEMA_V1;
  readonly plan: VerificationPlanV1;
  readonly selfTestIdentity: VerificationSelfTestIdentityV1;
  readonly checkRuns: readonly VerificationCheckRunV1[];
  readonly evidenceBundle: VerificationEvidenceBundleV1;
  readonly verdict: VerificationVerdictV1;
  readonly revalidationTrigger: VerificationRevalidationTriggerV1;
  readonly lkg: {
    readonly pointer: VerificationLkgPointerV1;
    readonly readback: VerificationLkgReadbackV1;
  };
}

export type VerificationFabricResultV1 =
  | { readonly outcome: "VERIFIED"; readonly reasonCodes: readonly ["VERIFICATION_COMPLETE"] }
  | { readonly outcome: "DENIED"; readonly reasonCodes: readonly VerificationReasonCodeV1[] };

const REASON_ORDER: readonly VerificationReasonCodeV1[] = [
  "SCHEMA_DENIED",
  "EVIDENCE_MISSING_DENIED",
  "EVIDENCE_STALE_DENIED",
  "EVIDENCE_MISMATCH_DENIED",
  "SELF_PRODUCED_EVIDENCE_DENIED",
  "CHECK_FAILED_DENIED",
  "LKG_CORRUPT_DENIED",
  "VERDICT_MISMATCH_DENIED",
];

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    && Object.getPrototypeOf(value) === Object.prototype;
}

function exactKeys(value: unknown, keys: readonly string[]): value is Record<string, unknown> {
  return isRecord(value) && canonicalJson(Object.keys(value).sort()) === canonicalJson([...keys].sort());
}

function isId(value: unknown): value is string {
  return typeof value === "string" && /^[a-z][a-z0-9-]{1,31}:[a-z0-9][a-z0-9._-]{2,95}$/.test(value);
}

function isDigest(value: unknown): value is string {
  return typeof value === "string" && /^[a-f0-9]{64}$/.test(value);
}

function isTimestamp(value: unknown): value is number {
  // -0 is a safe integer that satisfies >= 0; the canonical boundary is +0 or positive.
  return Number.isSafeInteger(value) && !Object.is(value, -0) && (value as number) >= 0;
}

function isArtifactRef(value: unknown): value is string {
  return typeof value === "string" && /^artifact:sha256:[a-f0-9]{64}$/.test(value);
}

function isUniqueStringArray(value: unknown, predicate: (item: unknown) => boolean): value is string[] {
  return Array.isArray(value) && value.length > 0 && value.every(predicate)
    && new Set(value).size === value.length;
}

function contractDigest(value: Record<string, unknown>, digestKey: string): string {
  const content = Object.fromEntries(Object.entries(value).filter(([key]) => key !== digestKey));
  return createHash("sha256").update(canonicalJson(content)).digest("hex");
}

function validPlan(value: unknown): value is VerificationPlanV1 {
  if (!exactKeys(value, [
    "schemaVersion", "planId", "subjectId", "subjectProducerId", "subjectDigest", "profileId",
    "issuedAtMs", "evidenceMaxAgeMs", "requiredCheckIds", "artifactRefs", "planDigest",
  ])) return false;
  return value.schemaVersion === VERIFICATION_PLAN_SCHEMA_V1
    && isId(value.planId) && isId(value.subjectId) && isId(value.subjectProducerId)
    && isDigest(value.subjectDigest) && isId(value.profileId) && isTimestamp(value.issuedAtMs)
    && Number.isSafeInteger(value.evidenceMaxAgeMs) && (value.evidenceMaxAgeMs as number) > 0
    && isUniqueStringArray(value.requiredCheckIds, isId)
    && isUniqueStringArray(value.artifactRefs, isArtifactRef) && isDigest(value.planDigest);
}

function validIdentity(value: unknown): value is VerificationSelfTestIdentityV1 {
  if (!exactKeys(value, [
    "schemaVersion", "verifierId", "producerId", "subjectProducerId", "independence", "issuedAtMs", "identityDigest",
  ])) return false;
  return value.schemaVersion === VERIFICATION_SELF_TEST_IDENTITY_SCHEMA_V1
    && isId(value.verifierId) && isId(value.producerId) && isId(value.subjectProducerId)
    && value.independence === "INDEPENDENT" && isTimestamp(value.issuedAtMs) && isDigest(value.identityDigest);
}

function validCheckRun(value: unknown): value is VerificationCheckRunV1 {
  if (!exactKeys(value, [
    "schemaVersion", "checkRunId", "checkId", "planDigest", "subjectDigest", "verifierId",
    "startedAtMs", "completedAtMs", "outcome", "runDigest",
  ])) return false;
  return value.schemaVersion === VERIFICATION_CHECK_RUN_SCHEMA_V1 && isId(value.checkRunId)
    && isId(value.checkId) && isDigest(value.planDigest) && isDigest(value.subjectDigest)
    && isId(value.verifierId) && isTimestamp(value.startedAtMs) && isTimestamp(value.completedAtMs)
    && ["PASS", "FAIL", "ERROR"].includes(value.outcome as string) && isDigest(value.runDigest);
}

function validEvidence(value: unknown): value is VerificationEvidenceBundleV1 {
  if (!exactKeys(value, [
    "schemaVersion", "bundleId", "planDigest", "subjectDigest", "producerId", "collectedAtMs",
    "expiresAtMs", "checkRunDigests", "artifactRefs", "bundleDigest",
  ])) return false;
  return value.schemaVersion === VERIFICATION_EVIDENCE_BUNDLE_SCHEMA_V1 && isId(value.bundleId)
    && isDigest(value.planDigest) && isDigest(value.subjectDigest) && isId(value.producerId)
    && isTimestamp(value.collectedAtMs) && isTimestamp(value.expiresAtMs)
    && isUniqueStringArray(value.checkRunDigests, isDigest)
    && isUniqueStringArray(value.artifactRefs, isArtifactRef) && isDigest(value.bundleDigest);
}

function validVerdict(value: unknown): value is VerificationVerdictV1 {
  if (!exactKeys(value, [
    "schemaVersion", "verdictId", "status", "reasonCodes", "planDigest", "subjectDigest",
    "evidenceBundleDigest", "evaluatedAtMs", "verdictDigest",
  ])) return false;
  return value.schemaVersion === VERIFICATION_VERDICT_SCHEMA_V1 && isId(value.verdictId)
    && ["VERIFIED", "DENIED", "INCONCLUSIVE"].includes(value.status as string)
    && isUniqueStringArray(value.reasonCodes, (item) => typeof item === "string"
      && [...REASON_ORDER, "VERIFICATION_COMPLETE"].includes(item as VerificationReasonCodeV1))
    && isDigest(value.planDigest) && isDigest(value.subjectDigest) && isDigest(value.evidenceBundleDigest)
    && isTimestamp(value.evaluatedAtMs) && isDigest(value.verdictDigest);
}

function validTrigger(value: unknown): value is VerificationRevalidationTriggerV1 {
  if (!exactKeys(value, [
    "schemaVersion", "triggerId", "state", "causes", "observedSubjectDigest", "observedPlanDigest",
    "observedEvidenceBundleDigest", "armedAtMs", "triggerDigest",
  ])) return false;
  const causes = ["SUBJECT_CHANGED", "PLAN_CHANGED", "EVIDENCE_EXPIRED", "MANUAL"];
  return value.schemaVersion === VERIFICATION_REVALIDATION_TRIGGER_SCHEMA_V1 && isId(value.triggerId)
    && value.state === "ARMED" && isUniqueStringArray(value.causes, (item) => causes.includes(item as string))
    && isDigest(value.observedSubjectDigest) && isDigest(value.observedPlanDigest)
    && isDigest(value.observedEvidenceBundleDigest) && isTimestamp(value.armedAtMs)
    && isDigest(value.triggerDigest);
}

function validPointer(value: unknown): value is VerificationLkgPointerV1 {
  if (!exactKeys(value, [
    "schemaVersion", "pointerId", "targetVerdictDigest", "targetEvidenceBundleDigest", "generation", "pointerDigest",
  ])) return false;
  return value.schemaVersion === VERIFICATION_LKG_POINTER_SCHEMA_V1 && isId(value.pointerId)
    && isDigest(value.targetVerdictDigest) && isDigest(value.targetEvidenceBundleDigest)
    && Number.isSafeInteger(value.generation) && (value.generation as number) > 0 && isDigest(value.pointerDigest);
}

function validReadback(value: unknown): value is VerificationLkgReadbackV1 {
  if (!exactKeys(value, [
    "schemaVersion", "pointerId", "pointerDigest", "observedVerdictDigest", "observedEvidenceBundleDigest",
    "observedGeneration", "status", "readAtMs", "readbackDigest",
  ])) return false;
  return value.schemaVersion === VERIFICATION_LKG_READBACK_SCHEMA_V1 && isId(value.pointerId)
    && isDigest(value.pointerDigest) && isDigest(value.observedVerdictDigest)
    && isDigest(value.observedEvidenceBundleDigest) && Number.isSafeInteger(value.observedGeneration)
    && (value.observedGeneration as number) > 0 && ["MATCHED", "MISMATCH", "MISSING"].includes(value.status as string)
    && isTimestamp(value.readAtMs) && isDigest(value.readbackDigest);
}

function validBundle(value: unknown): value is VerificationFabricBundleV1 {
  if (!exactKeys(value, [
    "schemaVersion", "plan", "selfTestIdentity", "checkRuns", "evidenceBundle", "verdict", "revalidationTrigger", "lkg",
  ]) || value.schemaVersion !== VERIFICATION_FABRIC_BUNDLE_SCHEMA_V1 || !Array.isArray(value.checkRuns)
    || value.checkRuns.length === 0 || !value.checkRuns.every(validCheckRun)
    || !exactKeys(value.lkg, ["pointer", "readback"])) return false;
  return validPlan(value.plan) && validIdentity(value.selfTestIdentity) && validEvidence(value.evidenceBundle)
    && validVerdict(value.verdict) && validTrigger(value.revalidationTrigger)
    && validPointer(value.lkg.pointer) && validReadback(value.lkg.readback);
}

function sameMembers(left: readonly string[], right: readonly string[]): boolean {
  return left.length === right.length && left.every((value) => right.includes(value));
}

export function verifyVerificationFabricBundleV1(value: unknown): VerificationFabricResultV1 {
  if (!validBundle(value)) return { outcome: "DENIED", reasonCodes: ["SCHEMA_DENIED"] };

  const reasons = new Set<VerificationReasonCodeV1>();
  const { plan, selfTestIdentity: identity, checkRuns, evidenceBundle: evidence, verdict, revalidationTrigger: trigger } = value;
  const { pointer, readback } = value.lkg;

  const requiredCheckIds = plan.requiredCheckIds;
  const actualCheckIds = checkRuns.map(({ checkId }) => checkId);
  if (!sameMembers(requiredCheckIds, actualCheckIds)
    || !sameMembers(evidence.checkRunDigests, checkRuns.map(({ runDigest }) => runDigest))) {
    reasons.add("EVIDENCE_MISSING_DENIED");
  }
  if (verdict.evaluatedAtMs > evidence.expiresAtMs || evidence.collectedAtMs < plan.issuedAtMs
    || evidence.expiresAtMs - evidence.collectedAtMs > plan.evidenceMaxAgeMs) {
    reasons.add("EVIDENCE_STALE_DENIED");
  }
  if (evidence.planDigest !== plan.planDigest || evidence.subjectDigest !== plan.subjectDigest
    || verdict.planDigest !== plan.planDigest || verdict.subjectDigest !== plan.subjectDigest
    || verdict.evidenceBundleDigest !== evidence.bundleDigest
    || trigger.observedPlanDigest !== plan.planDigest || trigger.observedSubjectDigest !== plan.subjectDigest
    || trigger.observedEvidenceBundleDigest !== evidence.bundleDigest
    || checkRuns.some((run) => run.planDigest !== plan.planDigest || run.subjectDigest !== plan.subjectDigest
      || run.verifierId !== identity.verifierId || run.completedAtMs < run.startedAtMs)
    || identity.subjectProducerId !== plan.subjectProducerId || identity.producerId !== evidence.producerId
    || contractDigest(plan as unknown as Record<string, unknown>, "planDigest") !== plan.planDigest
    || contractDigest(identity as unknown as Record<string, unknown>, "identityDigest") !== identity.identityDigest
    || checkRuns.some((run) => contractDigest(run as unknown as Record<string, unknown>, "runDigest") !== run.runDigest)
    || contractDigest(evidence as unknown as Record<string, unknown>, "bundleDigest") !== evidence.bundleDigest
    || contractDigest(verdict as unknown as Record<string, unknown>, "verdictDigest") !== verdict.verdictDigest
    || contractDigest(trigger as unknown as Record<string, unknown>, "triggerDigest") !== trigger.triggerDigest) {
    reasons.add("EVIDENCE_MISMATCH_DENIED");
  }
  if (evidence.producerId === plan.subjectProducerId || identity.producerId === identity.subjectProducerId) {
    reasons.add("SELF_PRODUCED_EVIDENCE_DENIED");
  }
  if (checkRuns.some(({ outcome }) => outcome !== "PASS")) reasons.add("CHECK_FAILED_DENIED");
  if (verdict.status !== "VERIFIED" || !sameMembers(verdict.reasonCodes, ["VERIFICATION_COMPLETE"])) {
    reasons.add("VERDICT_MISMATCH_DENIED");
  }
  if (pointer.targetVerdictDigest !== verdict.verdictDigest
    || pointer.targetEvidenceBundleDigest !== evidence.bundleDigest
    || readback.pointerId !== pointer.pointerId || readback.pointerDigest !== pointer.pointerDigest
    || readback.observedVerdictDigest !== pointer.targetVerdictDigest
    || readback.observedEvidenceBundleDigest !== pointer.targetEvidenceBundleDigest
    || readback.observedGeneration !== pointer.generation || readback.status !== "MATCHED"
    || contractDigest(pointer as unknown as Record<string, unknown>, "pointerDigest") !== pointer.pointerDigest
    || contractDigest(readback as unknown as Record<string, unknown>, "readbackDigest") !== readback.readbackDigest) {
    reasons.add("LKG_CORRUPT_DENIED");
  }

  if (reasons.size === 0) return { outcome: "VERIFIED", reasonCodes: ["VERIFICATION_COMPLETE"] };
  return {
    outcome: "DENIED",
    reasonCodes: REASON_ORDER.filter((reason) => reasons.has(reason)),
  };
}
