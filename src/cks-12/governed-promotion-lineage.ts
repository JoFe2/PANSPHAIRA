import { createHash } from "node:crypto";

export const SCHEMA_VERSION = "chimpmaera.cks/governed-promotion-lineage/v1";
export const RECEIPT_SCHEMA_VERSION = "chimpmaera.cks/governed-promotion-lineage-receipt/v1";
export const VALIDATION_RECEIPT_SCHEMA_VERSION = "chimpmaera.cks/governed-validation-receipt/v1";
export const LINEAGE_RECEIPT_SCHEMA_VERSION = "chimpmaera.cks/usage-outcome-lineage-receipt/v1";
export const COMPONENT_VERSIONS = Object.freeze({
  boundaryContract: "v1",
  promoter: "cks-12-governed-promoter@v1",
  validator: "cks-12-independent-validator@v1",
  knowledgeContract: "v1",
});
export const DENIAL_CODES = Object.freeze([
  "MISSING_INPUT",
  "VERSION_LOCK_MISMATCH",
  "PROMOTION_PATH_DENIED",
  "SYNTHETIC_SCOPE_REQUIRED",
  "VALIDATION_EVIDENCE_MISSING",
  "STALE_EVIDENCE",
  "LINEAGE_REFERENCE_MISMATCH",
  "UNSUPPORTED_CLAIM",
  "UNKNOWN_VARIANT",
] as const);

type DenialCode = typeof DENIAL_CODES[number];
type RecordValue = Record<string, unknown>;
type Digest = string;

export type Denied = {
  status: "DENIED";
  reasonCodes: readonly DenialCode[];
  details: readonly string[];
};

export type KnowledgeReference = {
  knowledgeId: string;
  knowledgeVersion: string;
  knowledgeSha256: Digest;
  applicabilitySha256: Digest;
  state: "CANDIDATE" | "VALIDATED" | "PROMOTED_SYNTHETIC_ONLY";
};

export type ValidationOutcome = {
  status: "VALIDATED";
  validationReceiptId: string;
  validationReceiptSha256: Digest;
  sourceReceiptId: string;
  sourceSha256: Digest;
  knowledge: KnowledgeReference & { state: "VALIDATED" };
  evidenceIds: readonly string[];
  authority: "NONE";
  capabilityDelta: "NONE";
  effect: "NONE";
} | Denied;

export type PromotedKnowledge = {
  promotionReceiptId: string;
  validationReceiptId: string;
  validationReceiptSha256: Digest;
  sourceReceiptId: string;
  knowledgeId: string;
  knowledgeVersion: string;
  knowledgeSha256: Digest;
  applicabilitySha256: Digest;
  state: "PROMOTED_SYNTHETIC_ONLY";
  sourceKind: "PUBLIC_SYNTHETIC";
  authority: "NONE";
  capabilityDelta: "NONE";
  effect: "NONE";
  executionClaimed: false;
  productionClaimed: false;
};

export type PromotionOutcome = PromotedKnowledge | Denied;

export type GroundedSolution = {
  status: "GROUNDED_SOLUTION_RECORDED";
  solutionId: string;
  knowledge: KnowledgeReference & { state: "PROMOTED_SYNTHETIC_ONLY" };
  validationReceiptId: string;
  validationReceiptSha256: Digest;
  lineageReceiptId: string;
  materialClaimIds: readonly string[];
  evidenceIds: readonly string[];
  unsupportedMaterialClaims: readonly string[];
  authority: "NONE";
  capabilityDelta: "NONE";
  effect: "NONE";
  executionClaimed: false;
  productionClaimed: false;
};

export type SolutionOutcome = GroundedSolution | Denied;

export type UsageOutcomeLineage = {
  status: "USAGE_OUTCOME_LINEAGE_RECORDED";
  lineageReceiptId: string;
  taskId: string;
  searchId: string;
  decisionId: string;
  outcomeId: string;
  solutionId: string;
  validationReceiptId: string;
  promotionReceiptId: string;
  knowledge: KnowledgeReference & { state: "PROMOTED_SYNTHETIC_ONLY" };
  retrievedKnowledgeIds: readonly string[];
  usedKnowledgeIds: readonly string[];
  rejectedKnowledgeIds: readonly string[];
  authority: "NONE";
  capabilityDelta: "NONE";
  effect: "NONE";
};

export type LineageOutcome = UsageOutcomeLineage | Denied;

export function canonicalJson(value: unknown): string {
  if (value === null || typeof value === "boolean" || typeof value === "string") return JSON.stringify(value);
  if (typeof value === "number") {
    if (!Number.isFinite(value)) throw new TypeError("non-finite number");
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  if (typeof value !== "object" || Object.getPrototypeOf(value) !== Object.prototype) throw new TypeError("plain JSON value required");
  const object = value as RecordValue;
  return `{${Object.keys(object).sort().map((key) => {
    if (object[key] === undefined) throw new TypeError("undefined object value");
    return `${JSON.stringify(key)}:${canonicalJson(object[key])}`;
  }).join(",")}}`;
}

export const digest = (value: unknown): Digest => createHash("sha256").update(canonicalJson(value)).digest("hex");
const isRecord = (value: unknown): value is RecordValue => value !== null && typeof value === "object" && !Array.isArray(value) && Object.getPrototypeOf(value) === Object.prototype;
const isDigest = (value: unknown): value is Digest => typeof value === "string" && /^[0-9a-f]{64}$/.test(value);
const isNonEmptyString = (value: unknown): value is string => typeof value === "string" && value.length > 0;
const isStringArray = (value: unknown): value is string[] => Array.isArray(value) && value.every(isNonEmptyString);
const deny = (reasonCodes: DenialCode[], details: string[]): Denied => ({ status: "DENIED", reasonCodes: [...new Set(reasonCodes)].sort(), details });
const exactLock = (value: unknown): boolean => {
  if (!isRecord(value)) return false;
  try {
    return canonicalJson(value) === canonicalJson(COMPONENT_VERSIONS);
  } catch {
    return false;
  }
};
const withoutDigest = (value: RecordValue): RecordValue => Object.fromEntries(Object.entries(value).filter(([key]) => key !== "receiptSha256"));
const sameCanonical = (left: unknown, right: unknown): boolean => {
  try {
    return canonicalJson(left) === canonicalJson(right);
  } catch {
    return false;
  }
};

const knowledgeFrom = <T extends KnowledgeReference["state"]>(value: RecordValue, state: T): (Omit<KnowledgeReference, "state"> & { state: T }) | undefined => {
  if (typeof value.knowledgeId !== "string" || typeof value.knowledgeVersion !== "string" || !isDigest(value.knowledgeSha256) || !isDigest(value.applicabilitySha256)) return undefined;
  return { knowledgeId: value.knowledgeId, knowledgeVersion: value.knowledgeVersion, knowledgeSha256: value.knowledgeSha256, applicabilitySha256: value.applicabilitySha256, state };
};

/** Independently records CANDIDATE -> VALIDATED; this result is required by promotion. */
export function validateGovernedSyntheticKnowledge(input: unknown): ValidationOutcome {
  if (!isRecord(input)) return deny(["MISSING_INPUT"], ["validation input must be a plain JSON object"]);
  const candidate = input.candidate;
  const validation = input.validation;
  const reasons: DenialCode[] = [];
  const details: string[] = [];
  const add = (code: DenialCode, detail: string) => { reasons.push(code); details.push(detail); };
  if (input.schemaVersion !== SCHEMA_VERSION) add("VERSION_LOCK_MISMATCH", "input schema version must match the frozen governed-promotion contract");
  if (!exactLock(input.componentVersions)) add("VERSION_LOCK_MISMATCH", "component versions must exactly match the frozen promotion lock");
  if (!isRecord(candidate) || candidate.state !== "CANDIDATE" || candidate.sourceKind !== "PUBLIC_SYNTHETIC" || !isNonEmptyString(candidate.sourceReceiptId) || !isDigest(candidate.sourceSha256) || knowledgeFrom(candidate, "CANDIDATE") === undefined) add("SYNTHETIC_SCOPE_REQUIRED", "only a versioned public-synthetic CANDIDATE with exact Knowledge and source digests is validatable");
  if (!isRecord(validation) || validation.schemaVersion !== VALIDATION_RECEIPT_SCHEMA_VERSION || validation.actorClass !== "VALIDATOR" || validation.status !== "VALIDATED" || validation.scope !== "SYNTHETIC_ONLY" || validation.independent !== true || validation.stale !== false || !isNonEmptyString(validation.receiptId) || !isNonEmptyString(validation.sourceReceiptId) || !isDigest(validation.sourceSha256) || !isNonEmptyString(validation.knowledgeId) || !isNonEmptyString(validation.knowledgeVersion) || !isDigest(validation.candidateSha256) || !isDigest(validation.applicabilitySha256) || !isStringArray(validation.evidenceIds) || validation.evidenceIds.length < 5 || new Set(validation.evidenceIds).size !== validation.evidenceIds.length || !isDigest(validation.receiptSha256)) add("VALIDATION_EVIDENCE_MISSING", "independent validation must bind source, contradiction, Applicability, freshness, and sufficiency evidence");
  if (isRecord(validation) && validation.stale === true) add("STALE_EVIDENCE", "stale validation cannot be used");
  if (reasons.length) return deny(reasons, details);
  const candidateRecord = candidate as RecordValue;
  const validationRecord = validation as RecordValue;
  const knowledge = knowledgeFrom(candidateRecord, "VALIDATED");
  if (knowledge === undefined) return deny(["SYNTHETIC_SCOPE_REQUIRED"], ["candidate Knowledge reference is incomplete"]);
  if (validationRecord.sourceReceiptId !== candidateRecord.sourceReceiptId || validationRecord.sourceSha256 !== candidateRecord.sourceSha256 || validationRecord.knowledgeId !== knowledge.knowledgeId || validationRecord.knowledgeVersion !== knowledge.knowledgeVersion || validationRecord.candidateSha256 !== knowledge.knowledgeSha256 || validationRecord.applicabilitySha256 !== knowledge.applicabilitySha256) return deny(["VALIDATION_EVIDENCE_MISSING"], ["validation must bind the exact candidate source, Knowledge version, and Applicability"]);
  try {
    if (digest(withoutDigest(validationRecord)) !== validationRecord.receiptSha256) return deny(["VALIDATION_EVIDENCE_MISSING"], ["validation receipt digest does not match its immutable body"]);
  } catch {
    return deny(["VALIDATION_EVIDENCE_MISSING"], ["validation receipt contains non-canonical evidence"]);
  }
  return Object.freeze({ status: "VALIDATED", validationReceiptId: validationRecord.receiptId as string, validationReceiptSha256: validationRecord.receiptSha256 as Digest, sourceReceiptId: candidateRecord.sourceReceiptId as string, sourceSha256: candidateRecord.sourceSha256 as Digest, knowledge, evidenceIds: [...validationRecord.evidenceIds as string[]], authority: "NONE", capabilityDelta: "NONE", effect: "NONE" });
}

/** Consumes the separate validator record; it never validates or promotes a CANDIDATE directly. */
export function promoteGovernedSyntheticKnowledge(input: unknown): PromotionOutcome {
  if (!isRecord(input)) return deny(["MISSING_INPUT"], ["promotion input must be a plain JSON object"]);
  const validation = validateGovernedSyntheticKnowledge(input);
  if (validation.status !== "VALIDATED") return validation;
  if (input.promotionRequested !== true) return deny(["PROMOTION_PATH_DENIED"], ["explicit governed promotion request is required"]);
  const candidate = input.candidate as RecordValue;
  return Object.freeze({ promotionReceiptId: "CKS-12-GOVERNED-PROMOTION-RECEIPT-V1", validationReceiptId: validation.validationReceiptId, validationReceiptSha256: validation.validationReceiptSha256, sourceReceiptId: validation.sourceReceiptId, knowledgeId: validation.knowledge.knowledgeId, knowledgeVersion: validation.knowledge.knowledgeVersion, knowledgeSha256: validation.knowledge.knowledgeSha256, applicabilitySha256: validation.knowledge.applicabilitySha256, state: "PROMOTED_SYNTHETIC_ONLY", sourceKind: candidate.sourceKind as "PUBLIC_SYNTHETIC", authority: "NONE", capabilityDelta: "NONE", effect: "NONE", executionClaimed: false, productionClaimed: false });
}

/** Records SS-12 only when every material claim names exact promoted Knowledge and evidence. */
export function recordGroundedSolution(input: unknown): SolutionOutcome {
  if (!isRecord(input) || !isRecord(input.promotedKnowledge) || !isRecord(input.validation) || !isRecord(input.solution)) return deny(["MISSING_INPUT"], ["promoted Knowledge, validation, and solution are required"]);
  const promoted = input.promotedKnowledge as RecordValue;
  const validation = input.validation as RecordValue;
  const solution = input.solution as RecordValue;
  const unsupportedMaterialClaims = solution.unsupportedMaterialClaims;
  const knowledge = knowledgeFrom(promoted, "PROMOTED_SYNTHETIC_ONLY");
  const validatedKnowledge = isRecord(validation.knowledge) ? knowledgeFrom(validation.knowledge, "VALIDATED") : undefined;
  const reasons: DenialCode[] = [];
  const details: string[] = [];
  if (knowledge === undefined || promoted.state !== "PROMOTED_SYNTHETIC_ONLY" || promoted.sourceKind !== "PUBLIC_SYNTHETIC" || !isNonEmptyString(promoted.sourceReceiptId) || !isNonEmptyString(promoted.validationReceiptId) || !isDigest(promoted.validationReceiptSha256)) { reasons.push("PROMOTION_PATH_DENIED"); details.push("solution must use an exact governed synthetic-only Knowledge reference"); }
  if (validation.status !== "VALIDATED" || validation.validationReceiptId !== promoted.validationReceiptId || validation.validationReceiptSha256 !== promoted.validationReceiptSha256) { reasons.push("VALIDATION_EVIDENCE_MISSING"); details.push("solution must bind the separate validation receipt"); }
  if (validatedKnowledge === undefined || knowledge === undefined || !sameCanonical(validatedKnowledge, { ...knowledge, state: "VALIDATED" }) || validation.sourceReceiptId !== promoted.sourceReceiptId) { reasons.push("VALIDATION_EVIDENCE_MISSING"); details.push("promotion must bind the exact Knowledge and source from the separate validation receipt"); }
  if (!isNonEmptyString(solution.solutionId) || !isNonEmptyString(solution.lineageReceiptId) || !Array.isArray(solution.materialClaims) || !isStringArray(solution.evidenceIds) || solution.materialClaims.length === 0 || solution.evidenceIds.length === 0 || !isStringArray(unsupportedMaterialClaims)) { reasons.push("MISSING_INPUT"); details.push("solution must contain material claims, evidence, and a lineage reference"); }
  if (Array.isArray(unsupportedMaterialClaims) && unsupportedMaterialClaims.length !== 0) { reasons.push("UNSUPPORTED_CLAIM"); details.push("unsupported material claims must abstain rather than appear in a grounded solution"); }
  if (reasons.length) return deny(reasons, details);
  if (knowledge === undefined || !Array.isArray(unsupportedMaterialClaims)) return deny(["LINEAGE_REFERENCE_MISMATCH"], ["solution Knowledge reference is incomplete"]);
  const claims = solution.materialClaims as unknown[];
  const solutionEvidenceIds = solution.evidenceIds as string[];
  if (claims.some((claim) => !isRecord(claim) || !isNonEmptyString(claim.claimId) || !isStringArray(claim.evidenceIds) || claim.evidenceIds.length === 0 || claim.evidenceIds.some((id) => !solutionEvidenceIds.includes(id)) || !isRecord(claim.knowledge) || !sameCanonical(claim.knowledge, knowledge))) return deny(["LINEAGE_REFERENCE_MISMATCH", "UNSUPPORTED_CLAIM"], ["every material claim must bind the exact promoted Knowledge and non-empty evidence"]);
  return Object.freeze({ status: "GROUNDED_SOLUTION_RECORDED", solutionId: solution.solutionId as string, knowledge, validationReceiptId: promoted.validationReceiptId as string, validationReceiptSha256: promoted.validationReceiptSha256 as Digest, lineageReceiptId: solution.lineageReceiptId as string, materialClaimIds: claims.map((claim) => (claim as RecordValue).claimId).filter((id): id is string => typeof id === "string"), evidenceIds: [...solution.evidenceIds as string[]], unsupportedMaterialClaims: [], authority: "NONE", capabilityDelta: "NONE", effect: "NONE", executionClaimed: false, productionClaimed: false });
}

/** Records the complete minimized Task -> Search -> Knowledge -> Decision -> Outcome chain. */
export function recordUsageOutcomeLineage(input: unknown): LineageOutcome {
  if (!isRecord(input) || !isRecord(input.promotedKnowledge) || !isRecord(input.validation) || !isRecord(input.solution) || !isRecord(input.lineage)) return deny(["MISSING_INPUT"], ["promoted Knowledge, validation, solution, and lineage are required"]);
  const promoted = input.promotedKnowledge as RecordValue;
  const solutionResult = recordGroundedSolution(input);
  if (solutionResult.status !== "GROUNDED_SOLUTION_RECORDED") return solutionResult;
  const lineage = input.lineage as RecordValue;
  if (lineage.schemaVersion !== LINEAGE_RECEIPT_SCHEMA_VERSION || !isNonEmptyString(lineage.receiptId) || !isNonEmptyString(lineage.taskId) || !isNonEmptyString(lineage.searchId) || !isNonEmptyString(lineage.decisionId) || !isNonEmptyString(lineage.outcomeId) || lineage.solutionId !== solutionResult.solutionId || lineage.validationReceiptId !== solutionResult.validationReceiptId || !isNonEmptyString(promoted.promotionReceiptId) || lineage.promotionReceiptId !== promoted.promotionReceiptId || !isStringArray(lineage.retrievedKnowledgeIds) || !isStringArray(lineage.usedKnowledgeIds) || !isStringArray(lineage.rejectedKnowledgeIds) || lineage.usedKnowledgeIds.length === 0 || !isDigest(lineage.receiptSha256)) return deny(["LINEAGE_REFERENCE_MISMATCH"], ["lineage must contain exact Task, Search, Decision, Outcome, solution, validation, and promotion references"]);
  try {
    if (digest(withoutDigest(lineage)) !== lineage.receiptSha256 || !lineage.usedKnowledgeIds.includes(solutionResult.knowledge.knowledgeId)) return deny(["LINEAGE_REFERENCE_MISMATCH"], ["lineage receipt integrity or used Knowledge binding failed"]);
  } catch {
    return deny(["LINEAGE_REFERENCE_MISMATCH"], ["lineage receipt contains non-canonical evidence"]);
  }
  return Object.freeze({ status: "USAGE_OUTCOME_LINEAGE_RECORDED", lineageReceiptId: lineage.receiptId as string, taskId: lineage.taskId as string, searchId: lineage.searchId as string, decisionId: lineage.decisionId as string, outcomeId: lineage.outcomeId as string, solutionId: solutionResult.solutionId, validationReceiptId: solutionResult.validationReceiptId, promotionReceiptId: promoted.promotionReceiptId as string, knowledge: solutionResult.knowledge, retrievedKnowledgeIds: [...lineage.retrievedKnowledgeIds as string[]], usedKnowledgeIds: [...lineage.usedKnowledgeIds as string[]], rejectedKnowledgeIds: [...lineage.rejectedKnowledgeIds as string[]], authority: "NONE", capabilityDelta: "NONE", effect: "NONE" });
}

export type RequalificationOutcome = { status: "REVALIDATION_REQUIRED"; invalidatedDependencyIds: readonly string[]; knowledgeId: string; knowledgeVersion: string; authority: "NONE"; capabilityDelta: "NONE"; effect: "NONE" } | Denied;
export function invalidateKnowledgeDependencies(input: unknown): RequalificationOutcome {
  if (!isRecord(input) || !isRecord(input.promotedKnowledge) || !Array.isArray(input.dependencies)) return deny(["MISSING_INPUT"], ["promoted Knowledge and dependencies are required"]);
  const knowledge = input.promotedKnowledge;
  if (knowledge.state !== "PROMOTED_SYNTHETIC_ONLY" || typeof knowledge.knowledgeId !== "string" || typeof knowledge.knowledgeVersion !== "string") return deny(["PROMOTION_PATH_DENIED"], ["only governed synthetic-only Knowledge can enter requalification"]);
  if (typeof input.supersedingVersion !== "string" || input.supersedingVersion === knowledge.knowledgeVersion) return deny(["VERSION_LOCK_MISMATCH"], ["a distinct superseding version is required"]);
  const ids: string[] = [];
  for (const dependency of input.dependencies) {
    if (!isRecord(dependency) || typeof dependency.dependencyId !== "string" || dependency.knowledgeId !== knowledge.knowledgeId || dependency.knowledgeVersion !== knowledge.knowledgeVersion) return deny(["MISSING_INPUT"], ["each dependency must bind the promoted exact Knowledge version"]);
    ids.push(dependency.dependencyId);
  }
  if (new Set(ids).size !== ids.length) return deny(["MISSING_INPUT"], ["dependency identifiers must be unique"]);
  return { status: "REVALIDATION_REQUIRED", invalidatedDependencyIds: ids, knowledgeId: knowledge.knowledgeId, knowledgeVersion: input.supersedingVersion as string, authority: "NONE", capabilityDelta: "NONE", effect: "NONE" };
}

export type FastPathOutcome = { status: "COMPLETED_SYNTHETIC_ONLY"; effect: "NONE"; authority: "NONE"; capabilityDelta: "NONE" } | { status: "FAST_PATH_DENIED"; abortStatus: "ABORTED_UNKNOWN_VARIANT"; reasonCodes: readonly ["UNKNOWN_VARIANT"]; effect: "NONE"; authority: "NONE"; capabilityDelta: "NONE" };
export function evaluateKnownVariantFastPath(input: unknown): FastPathOutcome {
  if (!isRecord(input) || input.variant !== "KNOWN" || input.validationState !== "VALIDATED" || input.revalidationRequired === true) return { status: "FAST_PATH_DENIED", abortStatus: "ABORTED_UNKNOWN_VARIANT", reasonCodes: ["UNKNOWN_VARIANT"], authority: "NONE", capabilityDelta: "NONE", effect: "NONE" };
  return { status: "COMPLETED_SYNTHETIC_ONLY", authority: "NONE", capabilityDelta: "NONE", effect: "NONE" };
}

export function createReceipt(fixtureSha256: string, outcomes: RecordValue): RecordValue {
  if (!isDigest(fixtureSha256)) throw new TypeError("fixture digest must be a lowercase SHA-256 value");
  const body = { schemaVersion: RECEIPT_SCHEMA_VERSION, receiptId: "CKS-12-GOVERNED-PROMOTION-LINEAGE-RECEIPT-V1", fixtureSha256, componentVersions: COMPONENT_VERSIONS, outcomes, status: "RECORDED", authority: "NONE", capabilityDelta: "NONE", effect: "NONE", executionClaimed: false, productionClaimed: false };
  return { ...body, receiptSha256: digest(body) };
}