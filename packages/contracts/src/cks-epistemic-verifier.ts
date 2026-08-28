import { createHash } from "node:crypto";
import { canonicalJson } from "./canonical-json.js";
import {
  APPLICABILITY_DIMENSIONS_V1,
  type ApplicabilityScopeV1,
} from "./knowledge-quality.js";
import {
  validateCompetenceResponseV1,
  validateEvidencePackResultV1,
  validateEvidencePackResultForRequestV1,
  validateKnowledgeQueryRequestV1,
  type CompetenceResponseV1,
  type EvidencePackResultV1,
  type KnowledgeQueryRequestV1,
} from "./cks-competence-runtime.js";

/**
 * Deterministic CKS-04 claim/evidence verification.  This module checks
 * closed-form bindings only; it does not infer meaning from text and it does
 * not call, implement, or trust a semantic verifier.
 */
export const CKS_EPISTEMIC_VERIFIER_SCHEMA_V1 = "pansphaira.cks/epistemic-verification/v1" as const;
export const CKS_DETERMINISTIC_VERIFIER_ID_V1 = "PSAI284-DETERMINISTIC-EPISTEMIC-VERIFIER" as const;
export const CKS_DETERMINISTIC_VERIFIER_PROTOCOL_V1 = "pansphaira.cks/deterministic-epistemic-verifier/v1" as const;
export const CKS_DETERMINISTIC_VERIFIER_VERSION_V1 = "1" as const;
export const CKS_SEMANTIC_VERIFIER_ID_V1 = "PSAI284-INDEPENDENT-BLINDED-HUMAN-SEMANTIC-VERIFIER" as const;
export const CKS_SEMANTIC_VERIFIER_RUBRIC_ID_V1 = "PSAI284-SEMANTIC-CLAIM-APPLICATION-RUBRIC-V1" as const;
export const CKS_SEMANTIC_VERIFIER_VERSION_V1 = "1" as const;

export const EPISTEMIC_VERIFICATION_OUTCOMES_V1 = ["PASS", "ABSTAIN", "ESCALATE", "DENIED"] as const;
export type EpistemicVerificationOutcomeV1 = (typeof EPISTEMIC_VERIFICATION_OUTCOMES_V1)[number];
export const EPISTEMIC_VERIFICATION_REASON_CODES_V1 = [
  "MALFORMED_INPUT",
  "BINDING_MISMATCH",
  "REQUEST_BINDING_MISMATCH",
  "SCOPE_MISMATCH",
  "APPLICABILITY_MISMATCH",
  "PRECONDITION_UNSATISFIED",
  "PRECONDITION_UNKNOWN",
  "EXCLUSION_MATCHED",
  "INVALID_KNOWLEDGE_STATE",
  "KNOWLEDGE_VERSION_DRIFT",
  "KNOWLEDGE_CONFLICT",
  "MISSING_KNOWLEDGE",
  "EVIDENCE_COVERAGE_INCOMPLETE",
  "UNRETURNED_EVIDENCE_ID",
  "CLAIM_VERSION_OR_DIGEST_MISMATCH",
  "PROCEDURE_COVERAGE_INCOMPLETE",
  "RESPONSE_STATE_MISMATCH",
  "SEMANTIC_VERIFIER_NOT_EVALUATED",
] as const;
export type EpistemicVerificationReasonCodeV1 = (typeof EPISTEMIC_VERIFICATION_REASON_CODES_V1)[number];

export interface VerificationBindingV1 {
  readonly model: { readonly id: string; readonly version: string; readonly digest: string };
  readonly quantization: { readonly id: string; readonly version: string; readonly digest: string };
  readonly runtime: { readonly id: string; readonly version: string; readonly digest: string };
  readonly prompt: { readonly id: string; readonly version: string; readonly digest: string };
  readonly tool: { readonly id: string; readonly version: string; readonly digest: string };
  readonly knowledge: { readonly editionId: string; readonly version: string; readonly digest: string; readonly contractVersion: string };
}

export interface VerificationTaskV1 {
  readonly taskId: string;
  readonly taskDigest: string;
  readonly scopeDigest: string;
  readonly applicability: ApplicabilityScopeV1;
  readonly requiredPreconditions: readonly string[];
  readonly activeExclusions: readonly string[];
}

export interface VerificationClaimRequirementV1 {
  readonly claimId: string;
  readonly kind: "FACT" | "RULE" | "PROCEDURE" | "PARAMETER";
  readonly version: string;
  readonly digest: string;
}

export interface VerificationProcedureRequirementV1 {
  readonly stepId: string;
  readonly order: number;
  readonly claimId: string;
}

export interface CksEpistemicVerificationCaseV1 {
  readonly schemaVersion: typeof CKS_EPISTEMIC_VERIFIER_SCHEMA_V1;
  readonly caseId: string;
  readonly caseVersion: string;
  readonly caseDigest: string;
  readonly bindings: VerificationBindingV1;
  readonly task: VerificationTaskV1;
  readonly expected: {
    readonly state: CompetenceResponseV1["state"];
    readonly claims: readonly VerificationClaimRequirementV1[];
    readonly procedureSteps: readonly VerificationProcedureRequirementV1[];
  };
  readonly requests: readonly KnowledgeQueryRequestV1[];
  readonly evidencePacks: readonly EvidencePackResultV1[];
  readonly response: CompetenceResponseV1;
}

export interface ClaimCoverageReceiptV1 {
  readonly claimId: string;
  readonly kind: VerificationClaimRequirementV1["kind"];
  readonly version: string;
  readonly digest: string;
  readonly evidenceIds: readonly string[];
  readonly covered: boolean;
}

export interface ProcedureCoverageReceiptV1 {
  readonly stepId: string;
  readonly order: number;
  readonly claimId: string;
  readonly evidenceIds: readonly string[];
  readonly covered: boolean;
}

export interface DeterministicCheckReceiptV1 {
  readonly checkId: string;
  readonly passed: boolean;
  readonly reasonCode: EpistemicVerificationReasonCodeV1 | null;
}

export interface SemanticVerifierIdentityV1 {
  readonly verifierId: typeof CKS_SEMANTIC_VERIFIER_ID_V1;
  readonly rubricId: typeof CKS_SEMANTIC_VERIFIER_RUBRIC_ID_V1;
  readonly version: typeof CKS_SEMANTIC_VERIFIER_VERSION_V1;
  readonly implementationClass: "BLINDED_HUMAN_REVIEW_SEPARATE_FROM_MODEL_AND_DETERMINISTIC_VERIFIER";
  readonly status: "NOT_IMPLEMENTED_NOT_TRUSTED";
  readonly trusted: false;
  readonly mayOverrideDeterministicFailure: false;
}

export interface CksVerificationReceiptV1 {
  readonly schemaVersion: typeof CKS_EPISTEMIC_VERIFIER_SCHEMA_V1;
  readonly verifier: {
    readonly verifierId: typeof CKS_DETERMINISTIC_VERIFIER_ID_V1;
    readonly protocolId: typeof CKS_DETERMINISTIC_VERIFIER_PROTOCOL_V1;
    readonly version: typeof CKS_DETERMINISTIC_VERIFIER_VERSION_V1;
    readonly implementationClass: "TRUSTED_NON_MODEL_CLOSED_SCHEMA_AND_BINDING_CHECKER";
    readonly artifactDigestBinding: "RUN_MANIFEST_REQUIRED";
  };
  readonly semanticVerifier: SemanticVerifierIdentityV1;
  readonly caseId: string;
  readonly caseVersion: string;
  readonly caseDigest: string;
  readonly task: { readonly taskId: string; readonly taskDigest: string; readonly scopeDigest: string };
  readonly bindings: VerificationBindingV1;
  readonly outcome: EpistemicVerificationOutcomeV1;
  readonly reasonCodes: readonly EpistemicVerificationReasonCodeV1[];
  readonly checks: readonly DeterministicCheckReceiptV1[];
  readonly claimCoverage: readonly ClaimCoverageReceiptV1[];
  readonly procedureCoverage: readonly ProcedureCoverageReceiptV1[];
  readonly actionAuthority: "NONE";
  readonly receiptDigest: string;
}

export interface CksEpistemicVerificationResultV1 {
  readonly outcome: EpistemicVerificationOutcomeV1;
  readonly reasonCodes: readonly EpistemicVerificationReasonCodeV1[];
  readonly receipt: CksVerificationReceiptV1 | null;
}

const sha256 = (value: unknown): string => createHash("sha256").update(canonicalJson(value)).digest("hex");
const isRecord = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === "object" && !Array.isArray(value) && Object.getPrototypeOf(value) === Object.prototype;
const exact = (value: unknown, keys: readonly string[]): value is Record<string, unknown> =>
  isRecord(value) && canonicalJson(Object.keys(value).sort()) === canonicalJson([...keys].sort());
const digest = (value: unknown): value is string => typeof value === "string" && /^[a-f0-9]{64}$/.test(value);
const text = (value: unknown, max = 160): value is string =>
  typeof value === "string" && value.length > 0 && value.length <= max && !/[\u0000-\u001f]/.test(value);
const uniqueStrings = (value: unknown, predicate: (item: unknown) => boolean, max: number): value is string[] =>
  Array.isArray(value) && value.length <= max && value.every(predicate) && new Set(value).size === value.length;
const safeInteger = (value: unknown, min = 0, max = Number.MAX_SAFE_INTEGER): value is number =>
  Number.isSafeInteger(value) && (value as number) >= min && (value as number) <= max;
const deepEqual = (left: unknown, right: unknown): boolean => {
  try { return canonicalJson(left) === canonicalJson(right); } catch { return false; }
};

const validApplicability = (value: unknown): value is ApplicabilityScopeV1 => {
  if (!exact(value, APPLICABILITY_DIMENSIONS_V1)) return false;
  return APPLICABILITY_DIMENSIONS_V1.every((dimension) => {
    const item = value[dimension];
    if (!exact(item, ["state", "values", "provenance"]) || !["VALUE", "UNKNOWN", "NOT_PROVIDED", "NOT_APPLICABLE", "EXPLICITLY_UNRESTRICTED"].includes(item.state as string)) return false;
    const values = item.values;
    if (!uniqueStrings(values, (entry) => text(entry, 160), 16)) return false;
    if (item.state === "VALUE") return values.length > 0 && ["DECLARED", "EVIDENCE_DERIVED", "INFERRED"].includes(item.provenance as string);
    if (values.length !== 0) return false;
    if (["NOT_APPLICABLE", "EXPLICITLY_UNRESTRICTED"].includes(item.state as string)) return ["DECLARED", "EVIDENCE_DERIVED"].includes(item.provenance as string);
    return item.state === "UNKNOWN" ? item.provenance === null || item.provenance === "INFERRED" : item.provenance === null;
  });
};

const validBindingPart = (value: unknown): value is { readonly id: string; readonly version: string; readonly digest: string } =>
  exact(value, ["id", "version", "digest"]) && text(value.id, 192) && text(value.version, 64) && digest(value.digest);

const validBindings = (value: unknown): value is VerificationBindingV1 => {
  if (!exact(value, ["model", "quantization", "runtime", "prompt", "tool", "knowledge"])) return false;
  if (![value.model, value.quantization, value.runtime, value.prompt, value.tool].every((part) => validBindingPart(part))) return false;
  return exact(value.knowledge, ["editionId", "version", "digest", "contractVersion"])
    && text(value.knowledge.editionId, 192)
    && text(value.knowledge.version, 64)
    && digest(value.knowledge.digest)
    && text(value.knowledge.contractVersion, 192);
};

const validCase = (value: unknown): value is CksEpistemicVerificationCaseV1 => {
  if (!exact(value, ["schemaVersion", "caseId", "caseVersion", "caseDigest", "bindings", "task", "expected", "requests", "evidencePacks", "response"])) return false;
  if (value.schemaVersion !== CKS_EPISTEMIC_VERIFIER_SCHEMA_V1 || !text(value.caseId, 192) || !text(value.caseVersion, 64) || !digest(value.caseDigest) || !validBindings(value.bindings)) return false;
  if (!exact(value.task, ["taskId", "taskDigest", "scopeDigest", "applicability", "requiredPreconditions", "activeExclusions"])
    || !text(value.task.taskId, 192) || !digest(value.task.taskDigest) || !digest(value.task.scopeDigest)
    || !validApplicability(value.task.applicability)
    || !uniqueStrings(value.task.requiredPreconditions, (item) => text(item, 96), 16)
    || !uniqueStrings(value.task.activeExclusions, (item) => text(item, 96), 16)) return false;
  if (!exact(value.expected, ["state", "claims", "procedureSteps"]) || !["ANSWER_SUPPORTED", "NEED_MORE_KNOWLEDGE", "KNOWLEDGE_CONFLICT", "INSUFFICIENT_EVIDENCE", "COMPETENCE_LIMIT", "GOVERNED_ACTION_PROPOSAL"].includes(value.expected.state as string)) return false;
  if (!Array.isArray(value.expected.claims) || value.expected.claims.length > 32 || !value.expected.claims.every((claim) =>
    exact(claim, ["claimId", "kind", "version", "digest"]) && text(claim.claimId, 192) && ["FACT", "RULE", "PROCEDURE", "PARAMETER"].includes(claim.kind as string) && text(claim.version, 64) && digest(claim.digest))) return false;
  if (!Array.isArray(value.expected.procedureSteps) || value.expected.procedureSteps.length > 32 || !value.expected.procedureSteps.every((step) =>
    exact(step, ["stepId", "order", "claimId"]) && text(step.stepId, 192) && safeInteger(step.order, 0, 1024) && text(step.claimId, 192))) return false;
  if (!Array.isArray(value.requests) || value.requests.length > 3 || !value.requests.every((request) => validateKnowledgeQueryRequestV1(request))) return false;
  if (!Array.isArray(value.evidencePacks) || value.evidencePacks.length > 3 || !value.evidencePacks.every((pack) => validateEvidencePackResultV1(pack))) return false;
  if (!validateCompetenceResponseV1(value.response)) return false;
  return verificationCaseDigestV1(value) === value.caseDigest;
};

export function verificationCaseDigestV1(value: Omit<CksEpistemicVerificationCaseV1, "caseDigest"> | Record<string, unknown>): string {
  return sha256(Object.fromEntries(Object.entries(value).filter(([key]) => key !== "caseDigest")));
}

export function verificationReceiptDigestV1(value: Omit<CksVerificationReceiptV1, "receiptDigest"> | Record<string, unknown>): string {
  return sha256(Object.fromEntries(Object.entries(value).filter(([key]) => key !== "receiptDigest")));
}

const addReason = (reasons: EpistemicVerificationReasonCodeV1[], reason: EpistemicVerificationReasonCodeV1): void => {
  if (!reasons.includes(reason)) reasons.push(reason);
};

const makeCheck = (checkId: string, passed: boolean, reasonCode: EpistemicVerificationReasonCodeV1 | null): DeterministicCheckReceiptV1 => ({ checkId, passed, reasonCode });

/** Validate a completed deterministic receipt without consulting a semantic verdict. */
export function validateCksVerificationReceiptV1(value: unknown): value is CksVerificationReceiptV1 {
  if (!exact(value, ["schemaVersion", "verifier", "semanticVerifier", "caseId", "caseVersion", "caseDigest", "task", "bindings", "outcome", "reasonCodes", "checks", "claimCoverage", "procedureCoverage", "actionAuthority", "receiptDigest"])) return false;
  if (!exact(value.verifier, ["verifierId", "protocolId", "version", "implementationClass", "artifactDigestBinding"]) || value.verifier.verifierId !== CKS_DETERMINISTIC_VERIFIER_ID_V1 || value.verifier.protocolId !== CKS_DETERMINISTIC_VERIFIER_PROTOCOL_V1 || value.verifier.version !== CKS_DETERMINISTIC_VERIFIER_VERSION_V1 || value.verifier.implementationClass !== "TRUSTED_NON_MODEL_CLOSED_SCHEMA_AND_BINDING_CHECKER" || value.verifier.artifactDigestBinding !== "RUN_MANIFEST_REQUIRED") return false;
  if (!exact(value.semanticVerifier, ["verifierId", "rubricId", "version", "implementationClass", "status", "trusted", "mayOverrideDeterministicFailure"]) || value.semanticVerifier.verifierId !== CKS_SEMANTIC_VERIFIER_ID_V1 || value.semanticVerifier.rubricId !== CKS_SEMANTIC_VERIFIER_RUBRIC_ID_V1 || value.semanticVerifier.version !== CKS_SEMANTIC_VERIFIER_VERSION_V1 || value.semanticVerifier.implementationClass !== "BLINDED_HUMAN_REVIEW_SEPARATE_FROM_MODEL_AND_DETERMINISTIC_VERIFIER" || value.semanticVerifier.status !== "NOT_IMPLEMENTED_NOT_TRUSTED" || value.semanticVerifier.trusted !== false || value.semanticVerifier.mayOverrideDeterministicFailure !== false) return false;
  if (!text(value.caseId, 192) || !text(value.caseVersion, 64) || !digest(value.caseDigest) || ![...EPISTEMIC_VERIFICATION_OUTCOMES_V1].includes(value.outcome as EpistemicVerificationOutcomeV1) || !digest(value.receiptDigest) || value.actionAuthority !== "NONE") return false;
  if (!exact(value.task, ["taskId", "taskDigest", "scopeDigest"]) || !text(value.task.taskId, 192) || !digest(value.task.taskDigest) || !digest(value.task.scopeDigest) || !validBindings(value.bindings)) return false;
  if (!Array.isArray(value.reasonCodes) || !uniqueStrings(value.reasonCodes, (item) => EPISTEMIC_VERIFICATION_REASON_CODES_V1.includes(item as EpistemicVerificationReasonCodeV1), 16)) return false;
  if (!Array.isArray(value.checks) || value.checks.length === 0 || value.checks.length > 32 || !value.checks.every((check) => exact(check, ["checkId", "passed", "reasonCode"]) && text(check.checkId, 96) && typeof check.passed === "boolean" && (check.reasonCode === null || EPISTEMIC_VERIFICATION_REASON_CODES_V1.includes(check.reasonCode)))) return false;
  if (!Array.isArray(value.claimCoverage) || value.claimCoverage.length > 32 || !value.claimCoverage.every((claim) => exact(claim, ["claimId", "kind", "version", "digest", "evidenceIds", "covered"]) && text(claim.claimId, 192) && ["FACT", "RULE", "PROCEDURE", "PARAMETER"].includes(claim.kind) && text(claim.version, 64) && digest(claim.digest) && uniqueStrings(claim.evidenceIds, (item) => text(item, 192), 32) && typeof claim.covered === "boolean"))) return false;
  if (!Array.isArray(value.procedureCoverage) || value.procedureCoverage.length > 32 || !value.procedureCoverage.every((step) => exact(step, ["stepId", "order", "claimId", "evidenceIds", "covered"]) && text(step.stepId, 192) && safeInteger(step.order, 0, 1024) && text(step.claimId, 192) && uniqueStrings(step.evidenceIds, (item) => text(item, 192), 32) && typeof step.covered === "boolean")) return false;
  return verificationReceiptDigestV1(value) === value.receiptDigest;
}

const structuralFailure = (input: unknown): CksEpistemicVerificationResultV1 => ({ outcome: "DENIED", reasonCodes: ["MALFORMED_INPUT"], receipt: null });

/**
 * Run the trusted deterministic verifier.  A malformed or binding-invalid
 * input cannot produce PASS.  Missing Knowledge and conflicts produce an
 * abstention/escalation posture; neither can be upgraded by semantic review.
 */
export function verifyCksEpistemicCaseV1(input: unknown): CksEpistemicVerificationResultV1 {
  if (!validCase(input)) return structuralFailure(input);
  const value = input as CksEpistemicVerificationCaseV1;
  const reasons: EpistemicVerificationReasonCodeV1[] = [];
  const checks: DeterministicCheckReceiptV1[] = [];
  const add = (id: string, passed: boolean, reason: EpistemicVerificationReasonCodeV1): void => {
    checks.push(makeCheck(id, passed, passed ? null : reason));
    if (!passed) addReason(reasons, reason);
  };

  const packByRequest = new Map<string, EvidencePackResultV1>();
  let packsValid = true;
  const requestsBound = value.requests.every((request) => request.taskId === value.task.taskId
    && request.knowledgeEditionId === value.bindings.knowledge.editionId
    && request.knowledgeEditionVersion === value.bindings.knowledge.version
    && request.knowledgeEditionDigest === value.bindings.knowledge.digest
    && deepEqual(request.applicability, value.task.applicability)
    && deepEqual(request.requiredPreconditions, value.task.requiredPreconditions));
  if (!requestsBound) addReason(reasons, "REQUEST_BINDING_MISMATCH");
  packsValid = requestsBound;
  for (const pack of value.evidencePacks) {
    const request = value.requests.find((candidate) => candidate.requestId === pack.request.requestId);
    const valid = request !== undefined && validateEvidencePackResultForRequestV1(pack, request)
      && pack.task.taskId === value.task.taskId
      && pack.task.scopeDigest === value.task.scopeDigest
      && pack.knowledgeEdition.editionId === value.bindings.knowledge.editionId
      && pack.knowledgeEdition.version === value.bindings.knowledge.version
      && pack.knowledgeEdition.digest === value.bindings.knowledge.digest
      && pack.applicability.preconditions.every((precondition) => value.task.requiredPreconditions.includes(precondition))
      && pack.applicability.validity.state === "VALID"
      && pack.applicability.supersession.state === "CURRENT";
    if (!valid) packsValid = false;
    if (request !== undefined && !packByRequest.has(request.requestId)) packByRequest.set(request.requestId, pack);
  }
  add("REQUEST_PACK_BINDING", packsValid, "REQUEST_BINDING_MISMATCH");
  add("EVERY_REQUEST_HAS_A_PACK", packByRequest.size === value.requests.length, "MISSING_KNOWLEDGE");
  add("TASK_SCOPE_BINDING", value.evidencePacks.every((pack) => pack.task.taskId === value.task.taskId && pack.task.scopeDigest === value.task.scopeDigest), "SCOPE_MISMATCH");
  add("APPLICABILITY_BINDING", value.evidencePacks.every((pack) => deepEqual(pack.applicability.applicability, value.task.applicability)), "APPLICABILITY_MISMATCH");
  add("RESPONSE_TASK_BINDING", value.response.taskId === value.task.taskId, "REQUEST_BINDING_MISMATCH");

  const positiveEvidence = new Set<string>();
  const allEvidence = new Set<string>();
  const evidenceIdsAreUnique = new Set<string>();
  const claimIdsAreUnique = new Set<string>();
  for (const pack of value.evidencePacks) {
    for (const claim of pack.claims) {
      if (claimIdsAreUnique.has(claim.claimId)) packsValid = false;
      claimIdsAreUnique.add(claim.claimId);
    }
    for (const item of [...pack.evidence.positive, ...pack.evidence.negative]) {
      allEvidence.add(item.id);
      if (evidenceIdsAreUnique.has(item.id)) packsValid = false;
      evidenceIdsAreUnique.add(item.id);
    }
    for (const item of pack.evidence.positive) positiveEvidence.add(item.id);
  }
  add("EVIDENCE_ID_INTEGRITY", packsValid, "BINDING_MISMATCH");

  const requiredPreconditions = new Set(value.task.requiredPreconditions);
  const responsePreconditions = new Map(value.response.preconditionChecks.map((check) => [check.preconditionId, check.result]));
  const preconditionsSatisfied = [...requiredPreconditions].every((id) => responsePreconditions.get(id) === "SATISFIED")
    && [...responsePreconditions.keys()].every((id) => requiredPreconditions.has(id));
  const unknownPrecondition = [...requiredPreconditions].some((id) => responsePreconditions.get(id) === "UNKNOWN" || !responsePreconditions.has(id))
    || [...responsePreconditions.keys()].some((id) => !requiredPreconditions.has(id));
  add("PRECONDITIONS_EXPLICIT_AND_SATISFIED", preconditionsSatisfied, unknownPrecondition ? "PRECONDITION_UNKNOWN" : "PRECONDITION_UNSATISFIED");
  if (unknownPrecondition) addReason(reasons, "PRECONDITION_UNKNOWN");

  const activeExclusions = new Set(value.task.activeExclusions);
  const packExclusions = value.evidencePacks.flatMap((pack) => pack.applicability.exclusions);
  const responseExclusions = new Map(value.response.exclusionChecks.map((check) => [check.exclusionId, check.matched]));
  const exclusionsClear = [...activeExclusions, ...packExclusions].every((id) => responseExclusions.get(id) === false || !activeExclusions.has(id));
  const matchedExclusion = [...activeExclusions].some((id) => responseExclusions.get(id) === true) || packExclusions.some((id) => activeExclusions.has(id));
  add("EXCLUSIONS_EXPLICIT_AND_CLEAR", exclusionsClear && !matchedExclusion, "EXCLUSION_MATCHED");

  const returnedClaims = new Map<string, { readonly version: string; readonly digest: string }>();
  for (const pack of value.evidencePacks) for (const claim of pack.claims) {
    const prior = returnedClaims.get(claim.claimId);
    if (prior !== undefined && (prior.version !== claim.version || prior.digest !== claim.digest)) addReason(reasons, "CLAIM_VERSION_OR_DIGEST_MISMATCH");
    returnedClaims.set(claim.claimId, { version: claim.version, digest: claim.digest });
  }
  const expectedClaimIds = new Set(value.expected.claims.map((claim) => claim.claimId));
  const procedureClaimIds = new Set(value.expected.claims.filter((claim) => claim.kind === "PROCEDURE").map((claim) => claim.claimId));
  const responseClaims = new Map(value.response.materialClaims.map((claim) => [claim.claimId, claim]));
  const claimCoverage = value.expected.claims.map((claim): ClaimCoverageReceiptV1 => {
    const responseClaim = responseClaims.get(claim.claimId);
    const binding = returnedClaims.get(claim.claimId);
    const evidenceIds = responseClaim?.evidenceIds ?? [];
    const covered = responseClaim !== undefined && evidenceIds.length > 0 && evidenceIds.every((id) => positiveEvidence.has(id))
      && binding?.version === claim.version && binding.digest === claim.digest;
    return { claimId: claim.claimId, kind: claim.kind, version: claim.version, digest: claim.digest, evidenceIds: [...evidenceIds], covered };
  });
  const allClaimsCovered = claimCoverage.every((claim) => claim.covered)
    && responseClaims.size === expectedClaimIds.size
    && [...responseClaims.keys()].every((id) => expectedClaimIds.has(id));
  add("MATERIAL_CLAIM_COVERAGE", allClaimsCovered, "EVIDENCE_COVERAGE_INCOMPLETE");
  if (claimCoverage.some((claim) => claim.evidenceIds.some((id) => !allEvidence.has(id)))) addReason(reasons, "UNRETURNED_EVIDENCE_ID");
  if (claimCoverage.some((claim) => !claim.covered && returnedClaims.has(claim.claimId))) addReason(reasons, "CLAIM_VERSION_OR_DIGEST_MISMATCH");

  const responseSteps = new Map(value.response.procedureSteps.map((step) => [step.stepId, step]));
  const procedureCoverage = value.expected.procedureSteps.map((step): ProcedureCoverageReceiptV1 => {
    const responseStep = responseSteps.get(step.stepId);
    const claim = responseStep === undefined ? undefined : returnedClaims.get(step.claimId);
    const evidenceIds = responseStep?.evidenceIds ?? [];
    const covered = responseStep !== undefined && responseStep.order === step.order && responseStep.evidenceIds.length > 0
      && evidenceIds.every((id) => positiveEvidence.has(id)) && expectedClaimIds.has(step.claimId) && claim !== undefined;
    return { stepId: step.stepId, order: step.order, claimId: step.claimId, evidenceIds: [...evidenceIds], covered };
  });
  const allProceduresCovered = procedureCoverage.every((step) => step.covered)
    && value.expected.procedureSteps.every((step) => procedureClaimIds.has(step.claimId))
    && responseSteps.size === value.expected.procedureSteps.length
    && [...responseSteps.keys()].every((id) => value.expected.procedureSteps.some((step) => step.stepId === id));
  add("MATERIAL_PROCEDURE_COVERAGE", allProceduresCovered, "PROCEDURE_COVERAGE_INCOMPLETE");

  const conflicts = value.evidencePacks.some((pack) => pack.status === "CONFLICT" || pack.conflicts.length > 0 || pack.missingKnowledge.length > 0);
  const missingKnowledge = value.evidencePacks.some((pack) => pack.status === "NEEDS_CONTEXT" || pack.status === "NO_MATCH" || pack.status === "DENIED" || pack.missingKnowledge.length > 0);
  if (conflicts) addReason(reasons, "KNOWLEDGE_CONFLICT");
  else if (missingKnowledge) addReason(reasons, "MISSING_KNOWLEDGE");
  add("KNOWLEDGE_STATE", !conflicts && !missingKnowledge, conflicts ? "KNOWLEDGE_CONFLICT" : "MISSING_KNOWLEDGE");

  let outcome: EpistemicVerificationOutcomeV1;
  if (!packsValid) outcome = "DENIED";
  else if (conflicts) outcome = "ABSTAIN";
  else if (missingKnowledge || !allClaimsCovered || !allProceduresCovered || !preconditionsSatisfied || matchedExclusion) outcome = value.expected.state === "COMPETENCE_LIMIT" ? "ESCALATE" : "ABSTAIN";
  else if (value.response.state !== value.expected.state) { addReason(reasons, "RESPONSE_STATE_MISMATCH"); outcome = "DENIED"; }
  else outcome = "PASS";

  const receiptUnsigned: Omit<CksVerificationReceiptV1, "receiptDigest"> = {
    schemaVersion: CKS_EPISTEMIC_VERIFIER_SCHEMA_V1,
    verifier: { verifierId: CKS_DETERMINISTIC_VERIFIER_ID_V1, protocolId: CKS_DETERMINISTIC_VERIFIER_PROTOCOL_V1, version: CKS_DETERMINISTIC_VERIFIER_VERSION_V1, implementationClass: "TRUSTED_NON_MODEL_CLOSED_SCHEMA_AND_BINDING_CHECKER", artifactDigestBinding: "RUN_MANIFEST_REQUIRED" },
    semanticVerifier: { verifierId: CKS_SEMANTIC_VERIFIER_ID_V1, rubricId: CKS_SEMANTIC_VERIFIER_RUBRIC_ID_V1, version: CKS_SEMANTIC_VERIFIER_VERSION_V1, implementationClass: "BLINDED_HUMAN_REVIEW_SEPARATE_FROM_MODEL_AND_DETERMINISTIC_VERIFIER", status: "NOT_IMPLEMENTED_NOT_TRUSTED", trusted: false, mayOverrideDeterministicFailure: false },
    caseId: value.caseId,
    caseVersion: value.caseVersion,
    caseDigest: value.caseDigest,
    task: { taskId: value.task.taskId, taskDigest: value.task.taskDigest, scopeDigest: value.task.scopeDigest },
    bindings: value.bindings,
    outcome,
    reasonCodes: reasons,
    checks,
    claimCoverage,
    procedureCoverage,
    actionAuthority: "NONE",
  };
  const receipt = { ...receiptUnsigned, receiptDigest: verificationReceiptDigestV1(receiptUnsigned) };
  return { outcome, reasonCodes: reasons, receipt };
}

/** Short alias for callers that use the verifier name rather than its case API. */
export const verifyCksEpistemicV1 = verifyCksEpistemicCaseV1;

export function validateCksEpistemicVerificationCaseV1(value: unknown): value is CksEpistemicVerificationCaseV1 {
  return validCase(value);
}
