/**
 * CKS-12 empty-Knowledge Need/Gap detector and controlled acquisition gate.
 *
 * This is a deterministic, synthetic-only contract. It can record that an
 * empty Knowledge edition has a typed Need and a confirmed gap, and it can
 * record an immutable public-synthetic candidate after independent checks.
 * It never promotes Knowledge, grants Authority, activates a Capability, or
 * performs a production action.
 */

import { createHash } from "node:crypto";

export const SCHEMA_VERSION = "chimpmaera.cks/empty-kb-acquisition/v1";
export const RECEIPT_SCHEMA_VERSION = "chimpmaera.cks/empty-kb-acquisition-receipt/v1";
export const FIXTURE_ID = "CKS-12-EMPTY-KB-ACQUISITION-FIXTURE-V1";
export const FIXTURE_VERSION = "v1";
export const RECEIPT_ID = "CKS-12-EMPTY-KB-ACQUISITION-RECEIPT-V1";
export const RUN_ID = "CKS-12-EMPTY-KB-ACQUISITION-RUN-V1";
export const HASH_ALGORITHM = "SHA-256";
export const REPOSITORY = "JoFe2/PANSPHAIRA";
export const BASE_COMMIT = "353017c4f60e30463d0a78fd6fd2509a37d37f76";
export const BOUNDARY_RECEIPT_ID = "CKS-12-CLOSED-LOOP-BOUNDARY-V1";
export const BOUNDARY_RECEIPT_SHA256 = "d643f720a996c9ac2d167296c1edfd228760a3ca19196c09f9c0dfd6615d1328";
export const GENESIS_PREVIOUS_RECEIPT_SHA256 = "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855";

export const DENIAL_REASON_CODES = Object.freeze([
  "MISSING_INPUT",
  "INVALID_SCHEMA",
  "EMPTY_KB_REQUIRED",
  "NEED_INCOMPLETE",
  "RETRIEVAL_NOT_EXHAUSTED",
  "UNKNOWN_SEMANTICS",
  "SOURCE_NOT_SYNTHETIC",
  "SOURCE_NOT_UNTRUSTED",
  "CANDIDATE_VALIDATION_FAILED",
  "PROMOTION_DENIED",
  "AUTHORITY_DENIED",
  "FALSE_COMPLETENESS_DETECTED",
  "DIGEST_MISMATCH",
] as const);
export type DenialReasonCode = typeof DENIAL_REASON_CODES[number];

export type GapClass = "RETRIEVAL_FAILURE" | "MISSING_KNOWLEDGE" | "UNKNOWN_SEMANTICS";
export type Requirement = {
  requirementId: string;
  materialClaim: string;
  knowledgeClass: string;
  scope: string;
};
export type EmptyKnowledgeBaseline = {
  schemaVersion: "chimpmaera.cks/empty-knowledge-baseline/v1";
  editionId: string;
  editionVersion: string;
  entries: readonly unknown[];
};
export type NeedDeclaration = {
  decisionId: string;
  knowledgeClasses: readonly string[];
  scope: string;
  unresolvedClaims: readonly string[];
};
export type RetrievalAttempt = {
  attemptId: string;
  channel: "PRIMARY" | "ALTERNATE";
  status: "EXHAUSTED" | "HIT" | "UNAVAILABLE" | "UNKNOWN_SEMANTICS";
  returnedRequirementIds: readonly string[];
};
export type SolverAssessment = {
  completenessClaimed: boolean;
  claimedRequirementIds: readonly string[];
};
export type EmptyKbDetectionInput = {
  baseline: EmptyKnowledgeBaseline;
  need: NeedDeclaration;
  groundTruthRequirements: readonly Requirement[];
  enumerationEvidence: {
    method: "FORWARD_INDEPENDENT";
    evidenceId: string;
    solverOutputSha256: string;
  };
  enumeratedRequirements: readonly Requirement[];
  retrievalAttempts: readonly RetrievalAttempt[];
  solverAssessment: SolverAssessment;
};

export type RequirementRecall = {
  matchedRequirementCount: number;
  groundTruthRequirementCount: number;
  rate: number;
  missedRequirementIds: readonly string[];
};
export type FalseCompletenessMeasurement = {
  falseCompleteCount: number;
  completenessClaimCount: number;
  rate: number;
  unresolvedRequirementCountAtClaim: number;
};
export type DetectionSuccess = {
  status: "NEED_GAP_CONFIRMED";
  detectorVersion: "v1";
  gapClass: GapClass;
  need: NeedDeclaration;
  unresolvedRequirementIds: readonly string[];
  retrievalExhausted: boolean;
  requirementRecall: RequirementRecall;
  falseCompleteness: FalseCompletenessMeasurement;
  completenessClaimed: boolean;
  authority: "NONE";
  capabilityDelta: "NONE";
  effect: "NONE";
  successClaimed: false;
};
export type DeniedOutcome = {
  status: "DENIED";
  reasonCodes: readonly DenialReasonCode[];
  details: readonly string[];
};
export type DetectionOutcome = DetectionSuccess | DeniedOutcome;

export type AcquisitionPlan = {
  mode: "OFFLINE_SYNTHETIC_ONLY";
  allowedSourceKind: "PUBLIC_SYNTHETIC";
  sourceFixtureId: string;
  sourceFixtureVersion: string;
};
export type SourceEvidence = {
  sourceId: string;
  sourceKind: "PUBLIC_SYNTHETIC" | "LIVE_EXTERNAL" | "PRIVATE_EXTERNAL";
  fixtureId: string;
  fixtureVersion: string;
  contentSha256: string;
  acquisitionState: "ACQUIRED_UNTRUSTED" | "VALIDATED" | "PROMOTED";
  immutable: boolean;
};
export type KnowledgeCandidate = {
  candidateId: string;
  candidateVersion: string;
  status: "CANDIDATE" | "PROMOTED_SYNTHETIC_ONLY";
  sourceId: string;
  sourceContentSha256: string;
  requirementIds: readonly string[];
};
export type CandidateValidation = {
  sourceBound: boolean;
  contradictionChecked: boolean;
  applicabilityChecked: boolean;
  freshnessChecked: boolean;
  sufficiencyChecked: boolean;
  evidenceIds: readonly string[];
};
export type AcquisitionGateInput = {
  detection: DetectionSuccess;
  acquisitionPlan: AcquisitionPlan;
  sourceEvidence: SourceEvidence;
  candidate: KnowledgeCandidate;
  validation: CandidateValidation;
  promotionRequested?: boolean;
};
export type CandidateGateSuccess = {
  status: "CANDIDATE_RECORDED";
  candidate: KnowledgeCandidate;
  sourceEvidence: SourceEvidence;
  validation: CandidateValidation;
  promotionStatus: "NOT_PROMOTED";
  requirementRecall: RequirementRecall;
  falseCompleteness: FalseCompletenessMeasurement;
  authority: "NONE";
  capabilityDelta: "NONE";
  effect: "NONE";
  executionClaimed: false;
  productionClaimed: false;
  successClaimed: false;
};
export type CandidateGateOutcome = CandidateGateSuccess | DeniedOutcome;

export type EmptyKbAcquisitionFixture = EmptyKbAcquisitionInput & {
  schemaVersion: typeof SCHEMA_VERSION;
  fixtureId: typeof FIXTURE_ID;
  fixtureVersion: typeof FIXTURE_VERSION;
  repository: typeof REPOSITORY;
  baseCommit: typeof BASE_COMMIT;
  boundaryReceiptId: typeof BOUNDARY_RECEIPT_ID;
  boundaryReceiptSha256: typeof BOUNDARY_RECEIPT_SHA256;
};
export type EmptyKbAcquisitionInput = {
  detection: EmptyKbDetectionInput;
  acquisitionPlan: AcquisitionPlan;
  sourceEvidence: SourceEvidence;
  candidate: KnowledgeCandidate;
  validation: CandidateValidation;
  promotionRequested?: boolean;
};
export type EmptyKbAcquisitionReceipt = {
  schemaVersion: typeof RECEIPT_SCHEMA_VERSION;
  receiptId: typeof RECEIPT_ID;
  runId: typeof RUN_ID;
  repository: typeof REPOSITORY;
  baseCommit: typeof BASE_COMMIT;
  boundaryReceiptId: typeof BOUNDARY_RECEIPT_ID;
  boundaryReceiptSha256: typeof BOUNDARY_RECEIPT_SHA256;
  fixtureId: typeof FIXTURE_ID;
  fixtureVersion: typeof FIXTURE_VERSION;
  fixtureSha256: string;
  detection: DetectionSuccess;
  candidateGate: CandidateGateSuccess;
  status: "RECORDED";
  reasonCode: "EMPTY_KB_GAP_AND_CANDIDATE_RECORDED";
  authority: "NONE";
  capabilityDelta: "NONE";
  effect: "NONE";
  executionClaimed: false;
  productionClaimed: false;
  promotionClaimed: false;
  successClaimed: false;
  integratedProofState: "EVIDENCE_INCOMPLETE";
  previousReceiptSha256: typeof GENESIS_PREVIOUS_RECEIPT_SHA256;
  receiptSha256: string;
};

export function canonicalJson(value: unknown): string {
  if (value === null || typeof value === "boolean" || typeof value === "string") return JSON.stringify(value);
  if (typeof value === "number") {
    if (!Number.isFinite(value)) throw new TypeError("Canonical JSON rejects non-finite numbers");
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  if (typeof value !== "object" || Object.getPrototypeOf(value) !== Object.prototype) throw new TypeError("Canonical JSON accepts plain JSON objects only");
  const record = value as Record<string, unknown>;
  return `{${Object.keys(record).sort().map((key) => {
    if (record[key] === undefined) throw new TypeError("Canonical JSON rejects undefined object values");
    return `${JSON.stringify(key)}:${canonicalJson(record[key])}`;
  }).join(",")}}`;
}

export function sha256(value: string | Uint8Array): string {
  return createHash("sha256").update(value).digest("hex");
}
export function digest(value: unknown): string {
  return sha256(new TextEncoder().encode(canonicalJson(value)));
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === "object" && !Array.isArray(value) && Object.getPrototypeOf(value) === Object.prototype;
const nonEmptyString = (value: unknown): value is string => typeof value === "string" && value.length > 0;
const hasDigest = (value: unknown): value is string => typeof value === "string" && /^[0-9a-f]{64}$/.test(value);
const unique = (values: readonly string[]): boolean => new Set(values).size === values.length;

function denied(codes: readonly DenialReasonCode[], details: readonly string[]): DeniedOutcome {
  return { status: "DENIED", reasonCodes: [...new Set(codes)].sort(), details };
}
function collectValidation(input: unknown): { codes: DenialReasonCode[]; details: string[] } {
  const codes: DenialReasonCode[] = [];
  const details: string[] = [];
  const add = (code: DenialReasonCode, detail: string) => { codes.push(code); details.push(detail); };
  if (!isRecord(input)) {
    add("MISSING_INPUT", "input must be a plain JSON object");
    return { codes, details };
  }
  return { codes, details };
}
function readRequirementIds(value: unknown, label: string, add: (code: DenialReasonCode, detail: string) => void): string[] {
  if (!Array.isArray(value) || value.some((entry) => !isRecord(entry) || !nonEmptyString(entry.requirementId))) {
    add("INVALID_SCHEMA", `${label} must contain requirement objects with non-empty requirementId`);
    return [];
  }
  const ids = value.map((entry) => entry.requirementId as string);
  if (!unique(ids)) add("INVALID_SCHEMA", `${label} contains duplicate requirementId values`);
  return ids;
}
function numberRate(numerator: number, denominator: number): number {
  return denominator === 0 ? 0 : Number((numerator / denominator).toFixed(6));
}

export function detectNeedGap(input: unknown): DetectionOutcome {
  const errors = collectValidation(input);
  const add = (code: DenialReasonCode, detail: string) => { errors.codes.push(code); errors.details.push(detail); };
  if (!isRecord(input)) return denied(errors.codes, errors.details);
  const baseline = input.baseline;
  const need = input.need;
  const groundTruth = input.groundTruthRequirements;
  const enumerationEvidence = input.enumerationEvidence;
  const enumerated = input.enumeratedRequirements;
  const attempts = input.retrievalAttempts;
  const solver = input.solverAssessment;
  if (!isRecord(baseline) || baseline.schemaVersion !== "chimpmaera.cks/empty-knowledge-baseline/v1" || !nonEmptyString(baseline.editionId) || !nonEmptyString(baseline.editionVersion) || !Array.isArray(baseline.entries)) {
    add("INVALID_SCHEMA", "baseline must identify the empty-Knowledge edition and contain entries");
  } else if (baseline.entries.length !== 0) {
    add("EMPTY_KB_REQUIRED", "baseline contains Knowledge entries; this detector is scoped to an empty KB");
  }
  if (!isRecord(need) || !nonEmptyString(need.decisionId) || !nonEmptyString(need.scope) || !Array.isArray(need.knowledgeClasses) || need.knowledgeClasses.length === 0 || need.knowledgeClasses.some((value) => !nonEmptyString(value)) || !Array.isArray(need.unresolvedClaims) || need.unresolvedClaims.length === 0 || need.unresolvedClaims.some((value) => !nonEmptyString(value))) {
    add("NEED_INCOMPLETE", "Need must bind decision, at least one Knowledge class, scope, and unresolved claims");
  }
  const groundTruthIds = readRequirementIds(groundTruth, "groundTruthRequirements", add);
  if (!isRecord(enumerationEvidence) || enumerationEvidence.method !== "FORWARD_INDEPENDENT" || !nonEmptyString(enumerationEvidence.evidenceId) || !hasDigest(enumerationEvidence.solverOutputSha256)) {
    add("NEED_INCOMPLETE", "forward requirements must carry independent enumeration evidence before solver output");
  }
  const enumeratedIds = readRequirementIds(enumerated, "enumeratedRequirements", add);
  if (groundTruthIds.length === 0) add("NEED_INCOMPLETE", "at least one ground-truth requirement is required");
  for (const id of enumeratedIds) if (!groundTruthIds.includes(id)) add("INVALID_SCHEMA", `enumerated requirement ${id} is not in ground truth`);
  if (!Array.isArray(attempts) || attempts.length < 2 || attempts.some((entry) => !isRecord(entry) || !nonEmptyString(entry.attemptId) || (entry.channel !== "PRIMARY" && entry.channel !== "ALTERNATE") || !["EXHAUSTED", "HIT", "UNAVAILABLE", "UNKNOWN_SEMANTICS"].includes(entry.status as string) || !Array.isArray(entry.returnedRequirementIds))) {
    add("INVALID_SCHEMA", "retrievalAttempts must include typed primary and alternate attempts");
  }
  if (!isRecord(solver) || typeof solver.completenessClaimed !== "boolean" || !Array.isArray(solver.claimedRequirementIds)) add("INVALID_SCHEMA", "solverAssessment must explicitly record completenessClaimed and claimedRequirementIds");
  if (errors.codes.length > 0) return denied(errors.codes, errors.details);

  const attemptsTyped = attempts as RetrievalAttempt[];
  const unknownSemantics = attemptsTyped.some((attempt) => attempt.status === "UNKNOWN_SEMANTICS");
  const allExhausted = attemptsTyped.some((attempt) => attempt.channel === "PRIMARY" && attempt.status === "EXHAUSTED") && attemptsTyped.some((attempt) => attempt.channel === "ALTERNATE" && attempt.status === "EXHAUSTED");
  const retrievalExhausted = allExhausted && !unknownSemantics && attemptsTyped.every((attempt) => attempt.status === "EXHAUSTED");
  const gapClass: GapClass = unknownSemantics ? "UNKNOWN_SEMANTICS" : retrievalExhausted ? "MISSING_KNOWLEDGE" : "RETRIEVAL_FAILURE";
  const truthSet = new Set(groundTruthIds);
  const matchedIds = enumeratedIds.filter((id) => truthSet.has(id));
  const missedRequirementIds = groundTruthIds.filter((id) => !matchedIds.includes(id));
  const retrievedIds = [...new Set(attemptsTyped.flatMap((attempt) => attempt.returnedRequirementIds))];
  for (const id of retrievedIds) if (!truthSet.has(id)) add("INVALID_SCHEMA", `retrieval result ${id} is not in ground truth`);
  if (errors.codes.length > 0) return denied(errors.codes, errors.details);
  const unresolvedRequirementIds = groundTruthIds.filter((id) => !retrievedIds.includes(id));
  const solverTyped = solver as SolverAssessment;
  const falseCompleteCount = solverTyped.completenessClaimed && unresolvedRequirementIds.length > 0 ? 1 : 0;
  const falseCompleteness: FalseCompletenessMeasurement = {
    falseCompleteCount,
    completenessClaimCount: solverTyped.completenessClaimed ? 1 : 0,
    rate: numberRate(falseCompleteCount, solverTyped.completenessClaimed ? 1 : 0),
    unresolvedRequirementCountAtClaim: solverTyped.completenessClaimed ? unresolvedRequirementIds.length : 0,
  };
  return {
    status: "NEED_GAP_CONFIRMED",
    detectorVersion: "v1",
    gapClass,
    need: structuredClone(need) as NeedDeclaration,
    unresolvedRequirementIds,
    retrievalExhausted,
    requirementRecall: {
      matchedRequirementCount: matchedIds.length,
      groundTruthRequirementCount: groundTruthIds.length,
      rate: numberRate(matchedIds.length, groundTruthIds.length),
      missedRequirementIds,
    },
    falseCompleteness,
    completenessClaimed: solverTyped.completenessClaimed,
    authority: "NONE",
    capabilityDelta: "NONE",
    effect: "NONE",
    successClaimed: false,
  };
}

export function gateSyntheticAcquisitionCandidate(input: unknown): CandidateGateOutcome {
  const errors = collectValidation(input);
  const add = (code: DenialReasonCode, detail: string) => { errors.codes.push(code); errors.details.push(detail); };
  if (!isRecord(input)) return denied(errors.codes, errors.details);
  const detection = input.detection;
  const plan = input.acquisitionPlan;
  const source = input.sourceEvidence;
  const candidate = input.candidate;
  const validation = input.validation;
  if (!isRecord(detection) || detection.status !== "NEED_GAP_CONFIRMED" || detection.successClaimed !== false) add("NEED_INCOMPLETE", "candidate gate requires an unclaimed confirmed Need/Gap result");
  if (isRecord(detection) && (detection.gapClass !== "MISSING_KNOWLEDGE" || detection.retrievalExhausted !== true)) add("RETRIEVAL_NOT_EXHAUSTED", "synthetic acquisition requires an exhausted primary and alternate retrieval result");
  if (isRecord(detection) && (!isRecord(detection.requirementRecall) || detection.requirementRecall.rate !== 1)) add("NEED_INCOMPLETE", "synthetic acquisition requires complete independent requirement recall");
  if (isRecord(detection) && detection.completenessClaimed === true) add("FALSE_COMPLETENESS_DETECTED", "a completeness claim cannot authorize acquisition while requirements remain unresolved");
  if (!isRecord(plan) || plan.mode !== "OFFLINE_SYNTHETIC_ONLY" || plan.allowedSourceKind !== "PUBLIC_SYNTHETIC" || !nonEmptyString(plan.sourceFixtureId) || !nonEmptyString(plan.sourceFixtureVersion)) add("SOURCE_NOT_SYNTHETIC", "acquisition plan must select one bounded public-synthetic fixture");
  if (!isRecord(source) || source.sourceKind !== "PUBLIC_SYNTHETIC") add("SOURCE_NOT_SYNTHETIC", "live or private external sources are outside the controlled gate");
  if (!isRecord(source) || source.acquisitionState !== "ACQUIRED_UNTRUSTED" || source.immutable !== true) add("SOURCE_NOT_UNTRUSTED", "source evidence must be immutable ACQUIRED_UNTRUSTED evidence");
  if (!isRecord(source) || !nonEmptyString(source.sourceId) || !nonEmptyString(source.fixtureId) || !nonEmptyString(source.fixtureVersion) || !hasDigest(source.contentSha256)) add("INVALID_SCHEMA", "source evidence must bind a fixture identity and SHA-256 digest");
  if (isRecord(plan) && isRecord(source) && (source.fixtureId !== plan.sourceFixtureId || source.fixtureVersion !== plan.sourceFixtureVersion)) add("DIGEST_MISMATCH", "source evidence does not match the bounded acquisition plan");
  if (!isRecord(candidate) || candidate.status !== "CANDIDATE" || !nonEmptyString(candidate.candidateId) || !nonEmptyString(candidate.candidateVersion) || !nonEmptyString(candidate.sourceId) || !hasDigest(candidate.sourceContentSha256) || !Array.isArray(candidate.requirementIds)) add("INVALID_SCHEMA", "candidate must be a versioned CANDIDATE bound to source evidence");
  if (isRecord(candidate) && isRecord(source) && (candidate.sourceId !== source.sourceId || candidate.sourceContentSha256 !== source.contentSha256)) add("DIGEST_MISMATCH", "candidate is not bound to the exact acquired source");
  if (isRecord(validation) && (!Array.isArray(validation.evidenceIds) || validation.evidenceIds.length === 0 || ["sourceBound", "contradictionChecked", "applicabilityChecked", "freshnessChecked", "sufficiencyChecked"].some((field) => validation[field] !== true))) add("CANDIDATE_VALIDATION_FAILED", "independent source, contradiction, applicability, freshness, and sufficiency checks are required");
  if (!isRecord(validation)) add("CANDIDATE_VALIDATION_FAILED", "candidate validation evidence is required");
  if (input.promotionRequested === true) add("PROMOTION_DENIED", "this slice records a candidate only; governed promotion is a separate proof step");
  if (isRecord(source) && source.sourceKind !== "PUBLIC_SYNTHETIC") add("AUTHORITY_DENIED", "non-synthetic source cannot receive a candidate record");
  if (errors.codes.length > 0) return denied(errors.codes, errors.details);
  const detectionTyped = detection as DetectionSuccess;
  const sourceTyped = source as SourceEvidence;
  const candidateTyped = candidate as KnowledgeCandidate;
  const validationTyped = validation as CandidateValidation;
  const requiredIds = new Set(detectionTyped.unresolvedRequirementIds);
  if (candidateTyped.requirementIds.length !== requiredIds.size || !candidateTyped.requirementIds.every((id) => requiredIds.has(id))) return denied(["CANDIDATE_VALIDATION_FAILED"], ["candidate must bind every requirement in the confirmed gap exactly once"]);
  return {
    status: "CANDIDATE_RECORDED",
    candidate: structuredClone(candidateTyped),
    sourceEvidence: structuredClone(sourceTyped),
    validation: structuredClone(validationTyped),
    promotionStatus: "NOT_PROMOTED",
    requirementRecall: structuredClone(detectionTyped.requirementRecall),
    falseCompleteness: structuredClone(detectionTyped.falseCompleteness),
    authority: "NONE",
    capabilityDelta: "NONE",
    effect: "NONE",
    executionClaimed: false,
    productionClaimed: false,
    successClaimed: false,
  };
}

export function runEmptyKbAcquisitionGate(input: unknown): CandidateGateOutcome {
  if (!isRecord(input)) return denied(["MISSING_INPUT"], ["fixture input must be a plain JSON object"]);
  const detection = detectNeedGap(input.detection);
  if (detection.status !== "NEED_GAP_CONFIRMED") return detection;
  return gateSyntheticAcquisitionCandidate({ ...input, detection });
}

export function createEmptyKbAcquisitionReceipt(fixtureSha256: string, detection: DetectionSuccess, candidateGate: CandidateGateSuccess): EmptyKbAcquisitionReceipt {
  if (!hasDigest(fixtureSha256)) throw new TypeError("fixtureSha256 must be a lowercase SHA-256 digest");
  const body: Omit<EmptyKbAcquisitionReceipt, "receiptSha256"> = {
    schemaVersion: RECEIPT_SCHEMA_VERSION,
    receiptId: RECEIPT_ID,
    runId: RUN_ID,
    repository: REPOSITORY,
    baseCommit: BASE_COMMIT,
    boundaryReceiptId: BOUNDARY_RECEIPT_ID,
    boundaryReceiptSha256: BOUNDARY_RECEIPT_SHA256,
    fixtureId: FIXTURE_ID,
    fixtureVersion: FIXTURE_VERSION,
    fixtureSha256,
    detection,
    candidateGate,
    status: "RECORDED",
    reasonCode: "EMPTY_KB_GAP_AND_CANDIDATE_RECORDED",
    authority: "NONE",
    capabilityDelta: "NONE",
    effect: "NONE",
    executionClaimed: false,
    productionClaimed: false,
    promotionClaimed: false,
    successClaimed: false,
    integratedProofState: "EVIDENCE_INCOMPLETE",
    previousReceiptSha256: GENESIS_PREVIOUS_RECEIPT_SHA256,
  };
  return Object.freeze({ ...body, receiptSha256: digest(body) });
}

export const EMPTY_KB_ACQUISITION_FIXTURE: EmptyKbAcquisitionFixture = Object.freeze({
  schemaVersion: SCHEMA_VERSION,
  fixtureId: FIXTURE_ID,
  fixtureVersion: FIXTURE_VERSION,
  repository: REPOSITORY,
  baseCommit: BASE_COMMIT,
  boundaryReceiptId: BOUNDARY_RECEIPT_ID,
  boundaryReceiptSha256: BOUNDARY_RECEIPT_SHA256,
  detection: {
    baseline: { schemaVersion: "chimpmaera.cks/empty-knowledge-baseline/v1", editionId: "CKS-12-EMPTY-KNOWLEDGE-EDITION", editionVersion: "v1", entries: [] },
    need: { decisionId: "synthetic-order-approval", knowledgeClasses: ["POLICY", "PRICING", "APPLICABILITY"], scope: "synthetic-order-approval-v1", unresolvedClaims: ["approval-policy", "discount-threshold", "applicability-boundary", "escalation-route"] },
    groundTruthRequirements: [
      { requirementId: "REQ-01", materialClaim: "approval-policy", knowledgeClass: "POLICY", scope: "synthetic-order-approval-v1" },
      { requirementId: "REQ-02", materialClaim: "discount-threshold", knowledgeClass: "PRICING", scope: "synthetic-order-approval-v1" },
      { requirementId: "REQ-03", materialClaim: "applicability-boundary", knowledgeClass: "APPLICABILITY", scope: "synthetic-order-approval-v1" },
      { requirementId: "REQ-04", materialClaim: "escalation-route", knowledgeClass: "POLICY", scope: "synthetic-order-approval-v1" },
    ],
    enumerationEvidence: { method: "FORWARD_INDEPENDENT", evidenceId: "CKS-12-FORWARD-REQUIREMENTS-001", solverOutputSha256: "eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee" },
    enumeratedRequirements: [
      { requirementId: "REQ-01", materialClaim: "approval-policy", knowledgeClass: "POLICY", scope: "synthetic-order-approval-v1" },
      { requirementId: "REQ-02", materialClaim: "discount-threshold", knowledgeClass: "PRICING", scope: "synthetic-order-approval-v1" },
      { requirementId: "REQ-03", materialClaim: "applicability-boundary", knowledgeClass: "APPLICABILITY", scope: "synthetic-order-approval-v1" },
      { requirementId: "REQ-04", materialClaim: "escalation-route", knowledgeClass: "POLICY", scope: "synthetic-order-approval-v1" },
    ],
    retrievalAttempts: [
      { attemptId: "PRIMARY-01", channel: "PRIMARY", status: "EXHAUSTED", returnedRequirementIds: [] },
      { attemptId: "ALTERNATE-01", channel: "ALTERNATE", status: "EXHAUSTED", returnedRequirementIds: [] },
    ],
    solverAssessment: { completenessClaimed: false, claimedRequirementIds: [] },
  },
  acquisitionPlan: { mode: "OFFLINE_SYNTHETIC_ONLY", allowedSourceKind: "PUBLIC_SYNTHETIC", sourceFixtureId: "CKS-12-EMPTY-KB-SOURCE-FIXTURE-V1", sourceFixtureVersion: "v1" },
  sourceEvidence: { sourceId: "CKS-12-SYNTHETIC-SOURCE-001", sourceKind: "PUBLIC_SYNTHETIC", fixtureId: "CKS-12-EMPTY-KB-SOURCE-FIXTURE-V1", fixtureVersion: "v1", contentSha256: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa", acquisitionState: "ACQUIRED_UNTRUSTED", immutable: true },
  candidate: { candidateId: "CKS-12-KNOWLEDGE-CANDIDATE-001", candidateVersion: "v1", status: "CANDIDATE", sourceId: "CKS-12-SYNTHETIC-SOURCE-001", sourceContentSha256: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa", requirementIds: ["REQ-01", "REQ-02", "REQ-03", "REQ-04"] },
  validation: { sourceBound: true, contradictionChecked: true, applicabilityChecked: true, freshnessChecked: true, sufficiencyChecked: true, evidenceIds: ["CKS-12-VALIDATION-EVIDENCE-001"] },
  promotionRequested: false,
} as EmptyKbAcquisitionFixture);

export function createEmptyKbAcquisitionFixture(): EmptyKbAcquisitionFixture {
  return structuredClone(EMPTY_KB_ACQUISITION_FIXTURE);
}
