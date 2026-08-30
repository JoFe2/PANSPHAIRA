import { createHash } from "node:crypto";
import { canonicalJson } from "./canonical-json.js";

export const KNOWLEDGE_NEED_SCHEMA_V1 = "pansphaira.cks/knowledge-need/v1" as const;
export const KNOWLEDGE_GAP_SCHEMA_V1 = "pansphaira.cks/knowledge-gap/v1" as const;
export const ACQUISITION_PLAN_SCHEMA_V1 = "pansphaira.cks/acquisition-plan/v1" as const;
export const SOURCE_EVIDENCE_SCHEMA_V1 = "pansphaira.cks/source-evidence/v1" as const;
export const KNOWLEDGE_SUFFICIENCY_SCHEMA_V1 = "pansphaira.cks/knowledge-sufficiency/v1" as const;
export const KNOWLEDGE_AUTHORITY_BOUNDARY_V1 =
  "READ_ONLY_KNOWLEDGE_NO_CREDENTIAL_POLICY_CAPABILITY_TOOL_WRITE_OR_EXECUTION_AUTHORITY" as const;

export const CKS_SOURCE_CLASSES_V1 = [
  "ACTIVE_CURATED_KNOWLEDGE",
  "PINNED_OWNER_EVIDENCE",
  "PINNED_PRIMARY_EVIDENCE",
  "PINNED_SECONDARY_EVIDENCE",
  "INTERNET_RESULT",
  "MODEL_RESULT",
  "UNKNOWN_SOURCE",
] as const;
export type CksSourceClassV1 = typeof CKS_SOURCE_CLASSES_V1[number];

export const CKS_GAP_CLASSES_V1 = [
  "NONE",
  "MISSING",
  "BAD_SOURCE",
  "APPLICABILITY",
  "CONFLICTING",
  "UNKNOWN_SEMANTIC",
] as const;
export type CksGapClassV1 = typeof CKS_GAP_CLASSES_V1[number];

export const CKS_REQUIREMENT_OUTCOMES_V1 = [
  "SATISFIED",
  "NOT_APPLICABLE",
  "GAP_MISSING",
  "GAP_BAD_SOURCE",
  "GAP_APPLICABILITY",
  "GAP_CONFLICTING",
  "GAP_UNKNOWN_SEMANTIC",
] as const;
export type CksRequirementOutcomeV1 = typeof CKS_REQUIREMENT_OUTCOMES_V1[number];

export const CKS_ACQUISITION_LEVELS_V1 = ["A0", "A1", "A2", "A3", "A4", "A5"] as const;
export type CksAcquisitionLevelV1 = typeof CKS_ACQUISITION_LEVELS_V1[number];

export const CKS_RETRIEVAL_OUTCOMES_V1 = [
  "QUALIFYING_MATCH",
  "NO_MATCH",
  "BAD_SOURCE",
  "APPLICABILITY",
  "CONFLICTING",
  "UNKNOWN_SEMANTIC",
  "BLOCKED",
] as const;
export type CksRetrievalOutcomeV1 = typeof CKS_RETRIEVAL_OUTCOMES_V1[number];

export const CKS_BLOCKED_REASONS_V1 = [
  "DEPENDENCY_EVIDENCE_ABSENT",
  "DEPENDENCY_SCHEMA_INVALID",
  "DEPENDENCY_DIGEST_MISMATCH",
  "REQUIRED_SEMANTIC_RULE_ABSENT",
  "REQUIRED_APPLICABILITY_RULE_ABSENT",
  "REQUIRED_SOURCE_RULE_ABSENT",
  "RETRIEVAL_RECEIPT_ABSENT",
  "DENOMINATOR_EVIDENCE_ABSENT",
  "COMPARATOR_INPUT_ABSENT",
  "UNKNOWN_VOCABULARY_VALUE",
] as const;
export type CksBlockedReasonV1 = typeof CKS_BLOCKED_REASONS_V1[number];

export type KnowledgeNeedV1 = Readonly<{
  schemaVersion: typeof KNOWLEDGE_NEED_SCHEMA_V1;
  needId: string;
  caseId: string;
  requirementId: string;
  statement: string;
  statementDigest: string;
  criticality: "CRITICAL" | "NON_CRITICAL" | "UNKNOWN";
  applicability: "APPLICABLE" | "NOT_APPLICABLE" | "UNKNOWN";
  applicabilityRuleId: string | null;
  requirementSetDigest: string;
  needDigest: string;
}>;

export type RecoveryAttemptV1 = Readonly<{
  level: "A0" | "A1" | "A2";
  outcome: CksRetrievalOutcomeV1;
  knowledgeBundleDigest: string;
  receiptDigest: string;
}>;

export type KnowledgeGapV1 = Readonly<{
  schemaVersion: typeof KNOWLEDGE_GAP_SCHEMA_V1;
  gapId: string;
  needDigest: string;
  gapClass: CksGapClassV1;
  requirementOutcome: CksRequirementOutcomeV1;
  sourceClasses: readonly CksSourceClassV1[];
  evidenceDigests: readonly string[];
  recoveryAttempts: readonly RecoveryAttemptV1[];
  gapDigest: string;
}>;

export type AcquisitionPlanV1 = Readonly<{
  schemaVersion: typeof ACQUISITION_PLAN_SCHEMA_V1;
  planId: string;
  needDigest: string;
  orderedLevels: readonly CksAcquisitionLevelV1[];
  maximumTotalAttempts: 3;
  maximumAlternateAttempts: 2;
  allowedSourceClasses: readonly CksSourceClassV1[];
  promotionStatus: "NOT_REQUESTED";
  acceptedKnowledgeDigest: null;
  authorityBoundary: typeof KNOWLEDGE_AUTHORITY_BOUNDARY_V1;
  planDigest: string;
}>;

export type SourceEvidenceV1 = Readonly<{
  schemaVersion: typeof SOURCE_EVIDENCE_SCHEMA_V1;
  evidenceId: string;
  sourceClass: CksSourceClassV1;
  locator: string;
  contentDigest: string;
  observedAtMs: number;
  expiresAtMs: number | null;
  licence: "CC0-1.0" | "CC-BY-4.0" | "APACHE-2.0" | "MIT" | "OWNER_AUTHORIZED" | "UNKNOWN";
  acceptanceStatus: "NOT_ACCEPTED";
  authorityBoundary: typeof KNOWLEDGE_AUTHORITY_BOUNDARY_V1;
  evidenceDigest: string;
}>;

export type KnowledgeSufficiencyRequirementV1 = Readonly<{
  needDigest: string;
  gapClass: CksGapClassV1;
  requirementOutcome: CksRequirementOutcomeV1;
  sourceClasses: readonly CksSourceClassV1[];
  evidenceDigests: readonly string[];
}>;

export type KnowledgeSufficiencyV1 = Readonly<{
  schemaVersion: typeof KNOWLEDGE_SUFFICIENCY_SCHEMA_V1;
  sufficiencyId: string;
  caseId: string;
  requirementSetDigest: string;
  knowledgeBundleDigest: string;
  requirements: readonly KnowledgeSufficiencyRequirementV1[];
  blockedReasons: readonly CksBlockedReasonV1[];
  overallOutcome: "SUFFICIENT" | "INSUFFICIENT" | "BLOCKED";
  authorityBoundary: typeof KNOWLEDGE_AUTHORITY_BOUNDARY_V1;
  sufficiencyDigest: string;
}>;

const sha256 = (value: unknown): string =>
  createHash("sha256").update(canonicalJson(value)).digest("hex");
const without = (value: Record<string, unknown>, digestKey: string): Record<string, unknown> =>
  Object.fromEntries(Object.entries(value).filter(([key]) => key !== digestKey));
const isRecord = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === "object" && !Array.isArray(value)
  && Object.getPrototypeOf(value) === Object.prototype;
const exactKeys = (value: unknown, keys: readonly string[]): value is Record<string, unknown> =>
  isRecord(value) && canonicalJson(Object.keys(value).sort()) === canonicalJson([...keys].sort());
const isDigest = (value: unknown): value is string =>
  typeof value === "string" && /^[a-f0-9]{64}$/.test(value);
const isId = (value: unknown): value is string =>
  typeof value === "string" && /^[a-z][a-z0-9-]{1,31}:[a-z0-9][a-z0-9._-]{2,95}$/.test(value);
const isText = (value: unknown, max: number): value is string =>
  typeof value === "string" && value.length > 0 && value.length <= max && !/[\u0000-\u001f]/.test(value);
const isTimestamp = (value: unknown): value is number =>
  Number.isSafeInteger(value) && (value as number) >= 0 && !Object.is(value, -0);
const isUnique = <T>(value: unknown, predicate: (item: unknown) => item is T, max: number): value is T[] =>
  Array.isArray(value) && value.length <= max && value.every(predicate) && new Set(value).size === value.length;
const isOneOf = <T extends readonly string[]>(value: unknown, values: T): value is T[number] =>
  typeof value === "string" && values.includes(value);
const isSourceClass = (value: unknown): value is CksSourceClassV1 =>
  isOneOf(value, CKS_SOURCE_CLASSES_V1);
const isLevel = (value: unknown): value is CksAcquisitionLevelV1 =>
  isOneOf(value, CKS_ACQUISITION_LEVELS_V1);
const isOutcome = (value: unknown): value is CksRequirementOutcomeV1 =>
  isOneOf(value, CKS_REQUIREMENT_OUTCOMES_V1);
const isGapClass = (value: unknown): value is CksGapClassV1 =>
  isOneOf(value, CKS_GAP_CLASSES_V1);
const isRetrievalOutcome = (value: unknown): value is CksRetrievalOutcomeV1 =>
  isOneOf(value, CKS_RETRIEVAL_OUTCOMES_V1);

export const knowledgeNeedDigestV1 = (value: Omit<KnowledgeNeedV1, "needDigest"> | Record<string, unknown>): string =>
  sha256(without(value as Record<string, unknown>, "needDigest"));
export const knowledgeGapDigestV1 = (value: Omit<KnowledgeGapV1, "gapDigest"> | Record<string, unknown>): string =>
  sha256(without(value as Record<string, unknown>, "gapDigest"));
export const acquisitionPlanDigestV1 = (value: Omit<AcquisitionPlanV1, "planDigest"> | Record<string, unknown>): string =>
  sha256(without(value as Record<string, unknown>, "planDigest"));
export const sourceEvidenceDigestV1 = (value: Omit<SourceEvidenceV1, "evidenceDigest"> | Record<string, unknown>): string =>
  sha256(without(value as Record<string, unknown>, "evidenceDigest"));
export const knowledgeSufficiencyDigestV1 = (value: Omit<KnowledgeSufficiencyV1, "sufficiencyDigest"> | Record<string, unknown>): string =>
  sha256(without(value as Record<string, unknown>, "sufficiencyDigest"));

export function validateKnowledgeNeedV1(value: unknown): value is KnowledgeNeedV1 {
  if (!exactKeys(value, [
    "schemaVersion", "needId", "caseId", "requirementId", "statement", "statementDigest",
    "criticality", "applicability", "applicabilityRuleId", "requirementSetDigest", "needDigest",
  ])) return false;
  return value.schemaVersion === KNOWLEDGE_NEED_SCHEMA_V1 && isId(value.needId) && isId(value.caseId)
    && isId(value.requirementId) && isText(value.statement, 2048) && isDigest(value.statementDigest)
    && value.statementDigest === sha256(value.statement)
    && ["CRITICAL", "NON_CRITICAL", "UNKNOWN"].includes(value.criticality as string)
    && ["APPLICABLE", "NOT_APPLICABLE", "UNKNOWN"].includes(value.applicability as string)
    && (value.applicabilityRuleId === null || isId(value.applicabilityRuleId))
    && (value.applicability === "UNKNOWN" || value.applicabilityRuleId !== null)
    && isDigest(value.requirementSetDigest) && isDigest(value.needDigest)
    && knowledgeNeedDigestV1(value) === value.needDigest;
}

function validateRecoveryAttempt(value: unknown): value is RecoveryAttemptV1 {
  return exactKeys(value, ["level", "outcome", "knowledgeBundleDigest", "receiptDigest"])
    && ["A0", "A1", "A2"].includes(value.level as string)
    && isRetrievalOutcome(value.outcome) && isDigest(value.knowledgeBundleDigest) && isDigest(value.receiptDigest);
}

function validGapOutcome(gapClass: CksGapClassV1, outcome: CksRequirementOutcomeV1): boolean {
  return gapClass === "NONE"
    ? outcome === "SATISFIED" || outcome === "NOT_APPLICABLE"
    : outcome === `GAP_${gapClass}`;
}

export function validateKnowledgeGapV1(value: unknown): value is KnowledgeGapV1 {
  if (!exactKeys(value, [
    "schemaVersion", "gapId", "needDigest", "gapClass", "requirementOutcome", "sourceClasses",
    "evidenceDigests", "recoveryAttempts", "gapDigest",
  ])) return false;
  if (value.schemaVersion !== KNOWLEDGE_GAP_SCHEMA_V1 || !isId(value.gapId) || !isDigest(value.needDigest)
    || !isGapClass(value.gapClass) || !isOutcome(value.requirementOutcome)
    || !validGapOutcome(value.gapClass, value.requirementOutcome)
    || !isUnique(value.sourceClasses, isSourceClass, CKS_SOURCE_CLASSES_V1.length)
    || !isUnique(value.evidenceDigests, isDigest, 64)
    || !Array.isArray(value.recoveryAttempts) || value.recoveryAttempts.length > 3
    || !value.recoveryAttempts.every(validateRecoveryAttempt) || !isDigest(value.gapDigest)
    || knowledgeGapDigestV1(value) !== value.gapDigest) return false;
  const attempts = value.recoveryAttempts as RecoveryAttemptV1[];
  if (value.gapClass === "MISSING") {
    if (attempts.length !== 3 || attempts.some((attempt, index) => attempt.level !== (["A0", "A1", "A2"] as const)[index] || attempt.outcome !== "NO_MATCH")) return false;
    if (new Set(attempts.map((attempt) => attempt.knowledgeBundleDigest)).size !== 1) return false;
  } else if (attempts.some((attempt, index) => attempt.level !== (["A0", "A1", "A2"] as const)[index])) return false;
  if (value.gapClass === "NONE") {
    const sources = value.sourceClasses as readonly CksSourceClassV1[];
    return value.requirementOutcome === "SATISFIED"
      ? sources.length > 0 && sources.every((source) => source === "ACTIVE_CURATED_KNOWLEDGE")
      : sources.length === 0;
  }
  return value.requirementOutcome !== "SATISFIED" && value.requirementOutcome !== "NOT_APPLICABLE";
}

export function validateAcquisitionPlanV1(value: unknown): value is AcquisitionPlanV1 {
  if (!exactKeys(value, [
    "schemaVersion", "planId", "needDigest", "orderedLevels", "maximumTotalAttempts", "maximumAlternateAttempts",
    "allowedSourceClasses", "promotionStatus", "acceptedKnowledgeDigest", "authorityBoundary", "planDigest",
  ])) return false;
  if (value.schemaVersion !== ACQUISITION_PLAN_SCHEMA_V1 || !isId(value.planId) || !isDigest(value.needDigest)
    || !Array.isArray(value.orderedLevels) || value.orderedLevels.length < 1 || value.orderedLevels.length > 6
    || !value.orderedLevels.every(isLevel) || new Set(value.orderedLevels).size !== value.orderedLevels.length
    || value.maximumTotalAttempts !== 3 || value.maximumAlternateAttempts !== 2
    || !isUnique(value.allowedSourceClasses, isSourceClass, CKS_SOURCE_CLASSES_V1.length)
    || value.allowedSourceClasses.length < 1 || value.promotionStatus !== "NOT_REQUESTED"
    || value.acceptedKnowledgeDigest !== null || value.authorityBoundary !== KNOWLEDGE_AUTHORITY_BOUNDARY_V1
    || !isDigest(value.planDigest) || acquisitionPlanDigestV1(value) !== value.planDigest) return false;
  return value.orderedLevels.every((level, index) => CKS_ACQUISITION_LEVELS_V1[index] === level);
}

export function validateSourceEvidenceV1(value: unknown): value is SourceEvidenceV1 {
  if (!exactKeys(value, [
    "schemaVersion", "evidenceId", "sourceClass", "locator", "contentDigest", "observedAtMs", "expiresAtMs",
    "licence", "acceptanceStatus", "authorityBoundary", "evidenceDigest",
  ])) return false;
  return value.schemaVersion === SOURCE_EVIDENCE_SCHEMA_V1 && isId(value.evidenceId) && isSourceClass(value.sourceClass)
    && isText(value.locator, 2048) && isDigest(value.contentDigest) && isTimestamp(value.observedAtMs)
    && (value.expiresAtMs === null || (isTimestamp(value.expiresAtMs) && value.expiresAtMs >= value.observedAtMs))
    && ["CC0-1.0", "CC-BY-4.0", "APACHE-2.0", "MIT", "OWNER_AUTHORIZED", "UNKNOWN"].includes(value.licence as string)
    && value.acceptanceStatus === "NOT_ACCEPTED" && value.authorityBoundary === KNOWLEDGE_AUTHORITY_BOUNDARY_V1
    && isDigest(value.evidenceDigest) && sourceEvidenceDigestV1(value) === value.evidenceDigest;
}

function validateSufficiencyRequirement(value: unknown): value is KnowledgeSufficiencyRequirementV1 {
  if (!exactKeys(value, ["needDigest", "gapClass", "requirementOutcome", "sourceClasses", "evidenceDigests"])) return false;
  if (!isDigest(value.needDigest) || !isGapClass(value.gapClass) || !isOutcome(value.requirementOutcome)
    || !validGapOutcome(value.gapClass, value.requirementOutcome)
    || !isUnique(value.sourceClasses, isSourceClass, CKS_SOURCE_CLASSES_V1.length)
    || !isUnique(value.evidenceDigests, isDigest, 64)) return false;
  if (value.requirementOutcome === "SATISFIED") {
    return value.gapClass === "NONE" && value.sourceClasses.length > 0
      && value.sourceClasses.every((source) => source === "ACTIVE_CURATED_KNOWLEDGE");
  }
  if (value.requirementOutcome === "NOT_APPLICABLE") return value.gapClass === "NONE";
  return value.gapClass !== "NONE";
}

export function validateKnowledgeSufficiencyV1(value: unknown): value is KnowledgeSufficiencyV1 {
  if (!exactKeys(value, [
    "schemaVersion", "sufficiencyId", "caseId", "requirementSetDigest", "knowledgeBundleDigest", "requirements",
    "blockedReasons", "overallOutcome", "authorityBoundary", "sufficiencyDigest",
  ])) return false;
  if (value.schemaVersion !== KNOWLEDGE_SUFFICIENCY_SCHEMA_V1 || !isId(value.sufficiencyId) || !isId(value.caseId)
    || !isDigest(value.requirementSetDigest) || !isDigest(value.knowledgeBundleDigest)
    || !Array.isArray(value.requirements) || value.requirements.length < 1 || value.requirements.length > 1024
    || !value.requirements.every(validateSufficiencyRequirement)
    || new Set(value.requirements.map((item) => item.needDigest)).size !== value.requirements.length
    || !isUnique(value.blockedReasons, (item): item is CksBlockedReasonV1 => isOneOf(item, CKS_BLOCKED_REASONS_V1), CKS_BLOCKED_REASONS_V1.length)
    || !["SUFFICIENT", "INSUFFICIENT", "BLOCKED"].includes(value.overallOutcome as string)
    || !isDigest(value.sufficiencyDigest) || value.authorityBoundary !== KNOWLEDGE_AUTHORITY_BOUNDARY_V1
    || knowledgeSufficiencyDigestV1(value) !== value.sufficiencyDigest) return false;
  const requirements = value.requirements as KnowledgeSufficiencyRequirementV1[];
  if (value.overallOutcome === "BLOCKED") return value.blockedReasons.length > 0;
  if (value.blockedReasons.length > 0) return false;
  if (value.overallOutcome === "SUFFICIENT") {
    return requirements.every((item) => item.requirementOutcome === "SATISFIED" || item.requirementOutcome === "NOT_APPLICABLE");
  }
  return requirements.some((item) => item.requirementOutcome !== "SATISFIED" && item.requirementOutcome !== "NOT_APPLICABLE");
}

export function validateCksContractV1(value: unknown): boolean {
  if (!isRecord(value) || typeof value.schemaVersion !== "string") return false;
  switch (value.schemaVersion) {
    case KNOWLEDGE_NEED_SCHEMA_V1: return validateKnowledgeNeedV1(value);
    case KNOWLEDGE_GAP_SCHEMA_V1: return validateKnowledgeGapV1(value);
    case ACQUISITION_PLAN_SCHEMA_V1: return validateAcquisitionPlanV1(value);
    case SOURCE_EVIDENCE_SCHEMA_V1: return validateSourceEvidenceV1(value);
    case KNOWLEDGE_SUFFICIENCY_SCHEMA_V1: return validateKnowledgeSufficiencyV1(value);
    default: return false;
  }
}
