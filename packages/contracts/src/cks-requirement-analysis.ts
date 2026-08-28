import { createHash } from "node:crypto";
import { canonicalJson } from "./canonical-json.js";

export const FORWARD_REQUIREMENT_ANALYSIS_INPUT_SCHEMA_V1 =
  "pansphaira.cks/forward-requirement-analysis-input/v1" as const;
export const FORWARD_REQUIREMENT_ANALYSIS_SCHEMA_V1 =
  "pansphaira.cks/forward-requirement-analysis/v1" as const;
export const REQUIREMENT_ORACLE_SCHEMA_V1 = "pansphaira.cks/requirement-oracle/v1" as const;
export const REQUIREMENT_CANDIDATES_SCHEMA_V1 = "pansphaira.cks/requirement-candidates/v1" as const;
export const SEMANTIC_ADJUDICATION_SCHEMA_V1 = "pansphaira.cks/semantic-adjudication-receipt/v1" as const;
export const P11_SCHEMA_V1 = "pansphaira.cks/p11-requirement-measurement/v1" as const;

export const CKS_REQUIREMENT_CRITICALITIES_V1 = ["CRITICAL", "NON_CRITICAL"] as const;
export type CksRequirementCriticalityV1 = typeof CKS_REQUIREMENT_CRITICALITIES_V1[number];
export const CKS_CANDIDATE_CRITICALITIES_V1 = ["CRITICAL", "NON_CRITICAL", "UNKNOWN"] as const;
export type CksCandidateCriticalityV1 = typeof CKS_CANDIDATE_CRITICALITIES_V1[number];
export const CKS_APPLICABILITY_V1 = ["APPLICABLE", "NOT_APPLICABLE", "UNKNOWN"] as const;
export type CksApplicabilityV1 = typeof CKS_APPLICABILITY_V1[number];
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
export const CKS_CONFLICT_STATES_V1 = ["NONE", "CONFLICTING"] as const;
export type CksConflictStateV1 = typeof CKS_CONFLICT_STATES_V1[number];
export const CKS_SEMANTIC_OUTCOMES_V1 = [
  "MATCH",
  "NO_MATCH",
  "UNKNOWN_SEMANTIC",
  "CONFLICTING",
  "BAD_SOURCE",
  "APPLICABILITY",
] as const;
export type CksSemanticOutcomeV1 = typeof CKS_SEMANTIC_OUTCOMES_V1[number];
export const CKS_REQUIREMENT_STATES_V1 = [
  "SATISFIED",
  "NOT_APPLICABLE",
  "MISSING",
  "BAD_SOURCE",
  "APPLICABILITY",
  "CONFLICTING",
  "UNKNOWN_SEMANTIC",
  "CRITICALITY_MISMATCH",
] as const;
export type CksRequirementStateV1 = typeof CKS_REQUIREMENT_STATES_V1[number];
export const CKS_P11_STATUSES_V1 = ["PASS", "FAIL", "BLOCKED"] as const;
export type CksP11StatusV1 = typeof CKS_P11_STATUSES_V1[number];
export const CKS_BLOCKED_REASONS_V1 = [
  "DEPENDENCY_EVIDENCE_ABSENT",
  "DEPENDENCY_SCHEMA_INVALID",
  "DEPENDENCY_DIGEST_MISMATCH",
  "REQUIRED_SEMANTIC_RULE_ABSENT",
  "UNKNOWN_VOCABULARY_VALUE",
  "REQUIRED_APPLICABILITY_RULE_ABSENT",
  "DENOMINATOR_EVIDENCE_ABSENT",
] as const;
export type CksRequirementAnalysisBlockedReasonV1 = typeof CKS_BLOCKED_REASONS_V1[number];

export type RequirementOracleItemV1 = Readonly<{
  requirementId: string;
  statement: string;
  statementDigest: string;
  criticality: CksRequirementCriticalityV1;
  applicability: CksApplicabilityV1;
  applicabilityRuleId: string | null;
}>;

export type RequirementCandidateV1 = Readonly<{
  candidateId: string;
  statement: string;
  statementDigest: string;
  criticality: CksCandidateCriticalityV1;
  sourceClass: CksSourceClassV1;
  applicability: CksApplicabilityV1;
  conflictState: CksConflictStateV1;
  citations: readonly string[];
}>;

export type SemanticAdjudicationV1 = Readonly<{
  candidateId: string;
  requirementId: string | null;
  outcome: CksSemanticOutcomeV1;
  ruleId: string;
}>;

export type ForwardRequirementAnalysisInputV1 = Readonly<{
  schemaVersion: typeof FORWARD_REQUIREMENT_ANALYSIS_INPUT_SCHEMA_V1;
  analysisId: string;
  caseId: string;
  fixtureDigest: string;
  semanticRuleSetDigest: string;
  requirements: readonly RequirementOracleItemV1[];
  candidates: readonly RequirementCandidateV1[];
  mappings: readonly SemanticAdjudicationV1[];
}>;

export type P11MeasuredV1 = Readonly<{
  schemaVersion: typeof P11_SCHEMA_V1;
  status: "PASS" | "FAIL";
  R: number;
  P: number;
  M: number;
  C: number;
  CM: number;
  CX: number;
  requirementRecall: number;
  requirementPrecision: number;
  criticalRequirementMissRate: number;
  criticalRequirementMisses: number;
  criticalityMismatches: number;
}>;

export type P11BlockedV1 = Readonly<{
  schemaVersion: typeof P11_SCHEMA_V1;
  status: "BLOCKED";
  blockedReasons: readonly CksRequirementAnalysisBlockedReasonV1[];
}>;

export type P11MeasurementV1 = P11MeasuredV1 | P11BlockedV1;

export type RequirementAnalysisResultItemV1 = Readonly<{
  requirementId: string;
  criticality: CksRequirementCriticalityV1;
  applicability: "APPLICABLE" | "NOT_APPLICABLE";
  state: CksRequirementStateV1;
  matchedCandidateId: string | null;
}>;

export type ForwardRequirementAnalysisV1 = Readonly<{
  schemaVersion: typeof FORWARD_REQUIREMENT_ANALYSIS_SCHEMA_V1;
  analysisId: string;
  caseId: string;
  fixtureDigest: string;
  semanticRuleSetDigest: string;
  requirementSetDigest: string;
  candidateSetDigest: string;
  requirements: readonly RequirementAnalysisResultItemV1[];
  p11: P11MeasurementV1;
  outcome: CksP11StatusV1;
  blockedReasons: readonly CksRequirementAnalysisBlockedReasonV1[];
  analysisDigest: string;
}>;

const ID_PATTERN = /^[a-z][a-z0-9-]{1,31}:[a-z0-9][a-z0-9._-]{2,95}$/;
const DIGEST_PATTERN = /^[a-f0-9]{64}$/;
const MAX_REQUIREMENTS = 1024;
const MAX_CANDIDATES = 4096;
const MAX_CITATIONS = 64;
const isRecord = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === "object" && !Array.isArray(value)
  && Object.getPrototypeOf(value) === Object.prototype;
const exactKeys = (value: unknown, keys: readonly string[]): value is Record<string, unknown> =>
  isRecord(value) && canonicalJson(Object.keys(value).sort()) === canonicalJson([...keys].sort());
const isId = (value: unknown): value is string => typeof value === "string" && ID_PATTERN.test(value);
const isDigest = (value: unknown): value is string => typeof value === "string" && DIGEST_PATTERN.test(value);
const isText = (value: unknown, max: number): value is string =>
  typeof value === "string" && value.length > 0 && value.length <= max && !/[\u0000-\u001f]/.test(value);
const isOneOf = <T extends readonly string[]>(value: unknown, values: T): value is T[number] =>
  typeof value === "string" && values.includes(value);
const isFiniteNonNegativeNumber = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value) && value >= 0;
const isUniqueStrings = (value: unknown, max: number, predicate: (item: unknown) => boolean): value is string[] =>
  Array.isArray(value) && value.length <= max && value.every(predicate) && new Set(value).size === value.length;
const digest = (value: unknown): string => createHash("sha256").update(canonicalJson(value)).digest("hex");
const safeDigest = (value: unknown): string => {
  try {
    return digest(value);
  } catch {
    return digest(null);
  }
};
const without = (value: Record<string, unknown>, key: string): Record<string, unknown> =>
  Object.fromEntries(Object.entries(value).filter(([name]) => name !== key));

export const requirementStatementDigestV1 = (statement: string): string => digest(statement);
export const requirementSetDigestV1 = (requirements: readonly RequirementOracleItemV1[]): string => digest(requirements);
export const candidateSetDigestV1 = (candidates: readonly RequirementCandidateV1[]): string => digest(candidates);
export const semanticAdjudicationDigestV1 = (value: readonly SemanticAdjudicationV1[]): string =>
  digest(value);
export const forwardRequirementFixtureDigestV1 = (value: Omit<ForwardRequirementAnalysisInputV1, "fixtureDigest" | "analysisId"> | Record<string, unknown>): string => {
  const input = value as Record<string, unknown>;
  return digest(without(without(input, "fixtureDigest"), "analysisId"));
};
export const p11MeasurementDigestV1 = (value: P11MeasurementV1): string => digest(value);
export const forwardRequirementAnalysisDigestV1 = (
  value: Omit<ForwardRequirementAnalysisV1, "analysisDigest"> | Record<string, unknown>,
): string => digest(without(value as Record<string, unknown>, "analysisDigest"));

function validateOracleItem(value: unknown): value is RequirementOracleItemV1 {
  if (!exactKeys(value, ["requirementId", "statement", "statementDigest", "criticality", "applicability", "applicabilityRuleId"])) return false;
  return isId(value.requirementId) && isText(value.statement, 2048) && isDigest(value.statementDigest)
    && value.statementDigest === requirementStatementDigestV1(value.statement)
    && isOneOf(value.criticality, CKS_REQUIREMENT_CRITICALITIES_V1)
    && isOneOf(value.applicability, CKS_APPLICABILITY_V1)
    && (value.applicabilityRuleId === null || isId(value.applicabilityRuleId))
    && (value.applicability === "UNKNOWN" ? value.applicabilityRuleId === null : value.applicabilityRuleId !== null);
}

function validateCandidate(value: unknown): value is RequirementCandidateV1 {
  if (!exactKeys(value, ["candidateId", "statement", "statementDigest", "criticality", "sourceClass", "applicability", "conflictState", "citations"])) return false;
  return isId(value.candidateId) && isText(value.statement, 2048) && isDigest(value.statementDigest)
    && value.statementDigest === requirementStatementDigestV1(value.statement)
    && isOneOf(value.criticality, CKS_CANDIDATE_CRITICALITIES_V1)
    && isOneOf(value.sourceClass, CKS_SOURCE_CLASSES_V1)
    && isOneOf(value.applicability, CKS_APPLICABILITY_V1)
    && isOneOf(value.conflictState, CKS_CONFLICT_STATES_V1)
    && isUniqueStrings(value.citations, MAX_CITATIONS, isDigest);
}

function validateMapping(value: unknown): value is SemanticAdjudicationV1 {
  if (!exactKeys(value, ["candidateId", "requirementId", "outcome", "ruleId"])) return false;
  const outcome = value.outcome;
  return isId(value.candidateId) && (value.requirementId === null || isId(value.requirementId))
    && isOneOf(outcome, CKS_SEMANTIC_OUTCOMES_V1) && isId(value.ruleId)
    && (outcome === "MATCH" ? value.requirementId !== null : value.requirementId === null);
}

function hasUnknownVocabulary(value: unknown): boolean {
  if (!isRecord(value)) return false;
  const requirements = Array.isArray(value.requirements) ? value.requirements : [];
  const candidates = Array.isArray(value.candidates) ? value.candidates : [];
  const mappings = Array.isArray(value.mappings) ? value.mappings : [];
  return requirements.some((item) => isRecord(item)
    && ((typeof item.criticality === "string" && !isOneOf(item.criticality, CKS_REQUIREMENT_CRITICALITIES_V1))
      || (typeof item.applicability === "string" && !isOneOf(item.applicability, CKS_APPLICABILITY_V1))))
    || candidates.some((item) => isRecord(item)
      && ((typeof item.criticality === "string" && !isOneOf(item.criticality, CKS_CANDIDATE_CRITICALITIES_V1))
        || (typeof item.sourceClass === "string" && !isOneOf(item.sourceClass, CKS_SOURCE_CLASSES_V1))
        || (typeof item.applicability === "string" && !isOneOf(item.applicability, CKS_APPLICABILITY_V1))
        || (typeof item.conflictState === "string" && !isOneOf(item.conflictState, CKS_CONFLICT_STATES_V1))))
    || mappings.some((item) => isRecord(item)
      && typeof item.outcome === "string" && !isOneOf(item.outcome, CKS_SEMANTIC_OUTCOMES_V1));
}

function validationReasons(input: unknown): CksRequirementAnalysisBlockedReasonV1[] {
  if (!isRecord(input)) return ["DEPENDENCY_EVIDENCE_ABSENT"];
  const reasons: CksRequirementAnalysisBlockedReasonV1[] = [];
  if (!exactKeys(input, ["schemaVersion", "analysisId", "caseId", "fixtureDigest", "semanticRuleSetDigest", "requirements", "candidates", "mappings"])) {
    reasons.push("DEPENDENCY_SCHEMA_INVALID");
  }
  if (input.schemaVersion !== FORWARD_REQUIREMENT_ANALYSIS_INPUT_SCHEMA_V1) reasons.push("DEPENDENCY_SCHEMA_INVALID");
  if (!isId(input.analysisId) || !isId(input.caseId) || !isDigest(input.fixtureDigest) || !isDigest(input.semanticRuleSetDigest)) {
    reasons.push("DEPENDENCY_SCHEMA_INVALID");
  }
  if (hasUnknownVocabulary(input)) reasons.push("UNKNOWN_VOCABULARY_VALUE");
  if (!Array.isArray(input.requirements) || input.requirements.length < 1 || input.requirements.length > MAX_REQUIREMENTS
    || !input.requirements.every(validateOracleItem)
    || (Array.isArray(input.requirements) && new Set(input.requirements.map((item) => isRecord(item) ? item.requirementId : undefined)).size !== input.requirements.length)) {
    reasons.push("DEPENDENCY_SCHEMA_INVALID");
  }
  if (!Array.isArray(input.candidates) || input.candidates.length > MAX_CANDIDATES
    || !input.candidates.every(validateCandidate)
    || (Array.isArray(input.candidates) && new Set(input.candidates.map((item) => isRecord(item) ? item.candidateId : undefined)).size !== input.candidates.length)) {
    reasons.push("DEPENDENCY_SCHEMA_INVALID");
  }
  if (!Array.isArray(input.mappings) || !input.mappings.every(validateMapping)
    || (Array.isArray(input.mappings) && new Set(input.mappings.map((item) => isRecord(item) ? item.candidateId : undefined)).size !== input.mappings.length)) {
    reasons.push("REQUIRED_SEMANTIC_RULE_ABSENT");
  }
  if (reasons.length === 0) {
    const typed = input as ForwardRequirementAnalysisInputV1;
    if (typed.requirements.some((item) => item.applicability === "UNKNOWN")) reasons.push("REQUIRED_APPLICABILITY_RULE_ABSENT");
    const expectedFixture = forwardRequirementFixtureDigestV1({
      schemaVersion: typed.schemaVersion,
      caseId: typed.caseId,
      semanticRuleSetDigest: typed.semanticRuleSetDigest,
      requirements: typed.requirements,
      candidates: typed.candidates,
      mappings: typed.mappings,
    });
    if (typed.fixtureDigest !== expectedFixture) reasons.push("DEPENDENCY_DIGEST_MISMATCH");
    const candidateIds = new Set(typed.candidates.map((candidate) => candidate.candidateId));
    if (typed.mappings.some((mapping) => !candidateIds.has(mapping.candidateId))
      || typed.mappings.length !== typed.candidates.length) reasons.push("REQUIRED_SEMANTIC_RULE_ABSENT");
    const applicable = typed.requirements.filter((requirement) => requirement.applicability === "APPLICABLE");
    if (applicable.length === 0 || !applicable.some((requirement) => requirement.criticality === "CRITICAL")) {
      reasons.push("DENOMINATOR_EVIDENCE_ABSENT");
    }
  }
  return [...new Set(reasons)];
}

export function validateForwardRequirementAnalysisInputV1(value: unknown): value is ForwardRequirementAnalysisInputV1 {
  if (!exactKeys(value, ["schemaVersion", "analysisId", "caseId", "fixtureDigest", "semanticRuleSetDigest", "requirements", "candidates", "mappings"])) return false;
  return validationReasons(value).length === 0;
}

function blockedP11(reasons: readonly CksRequirementAnalysisBlockedReasonV1[]): P11BlockedV1 {
  return { schemaVersion: P11_SCHEMA_V1, status: "BLOCKED", blockedReasons: [...new Set(reasons)] };
}

function analyzeValidInput(input: ForwardRequirementAnalysisInputV1): ForwardRequirementAnalysisV1 {
  const candidateById = new Map(input.candidates.map((candidate) => [candidate.candidateId, candidate]));
  const usedCandidates = new Set<string>();
  let M = 0;
  let C = 0;
  let CM = 0;
  let CX = 0;
  const results: RequirementAnalysisResultItemV1[] = [];

  for (const requirement of input.requirements) {
    if (requirement.applicability === "NOT_APPLICABLE") {
      results.push({ requirementId: requirement.requirementId, criticality: requirement.criticality, applicability: requirement.applicability, state: "NOT_APPLICABLE", matchedCandidateId: null });
      continue;
    }
    C += requirement.criticality === "CRITICAL" ? 1 : 0;
    const matches = input.mappings.filter((mapping) => mapping.outcome === "MATCH" && mapping.requirementId === requirement.requirementId);
    const usable = matches.find((mapping) => {
      const candidate = candidateById.get(mapping.candidateId);
      return candidate !== undefined && !usedCandidates.has(candidate.candidateId)
        && candidate.sourceClass === "ACTIVE_CURATED_KNOWLEDGE"
        && candidate.applicability === "APPLICABLE"
        && candidate.conflictState === "NONE";
    });
    if (usable !== undefined) {
      const candidate = candidateById.get(usable.candidateId);
      if (candidate === undefined) throw new Error("INTERNAL_CANDIDATE_INDEX_FAILURE");
      usedCandidates.add(candidate.candidateId);
      M += 1;
      const criticalityMismatch = candidate.criticality !== requirement.criticality;
      CX += criticalityMismatch ? 1 : 0;
      const state: CksRequirementStateV1 = criticalityMismatch ? "CRITICALITY_MISMATCH" : "SATISFIED";
      if (requirement.criticality === "CRITICAL" && state !== "SATISFIED" && !criticalityMismatch) CM += 1;
      results.push({ requirementId: requirement.requirementId, criticality: requirement.criticality, applicability: requirement.applicability, state, matchedCandidateId: candidate.candidateId });
      continue;
    }
    const mapped = matches[0] ?? input.mappings.find((mapping) => {
      const candidate = candidateById.get(mapping.candidateId);
      return mapping.requirementId === null && candidate?.statementDigest === requirement.statementDigest;
    });
    let state: CksRequirementStateV1 = "MISSING";
    if (mapped !== undefined) {
      const candidate = candidateById.get(mapped.candidateId);
      if (mapped.outcome === "UNKNOWN_SEMANTIC") state = "UNKNOWN_SEMANTIC";
      else if (mapped.outcome === "CONFLICTING") state = "CONFLICTING";
      else if (mapped.outcome === "BAD_SOURCE") state = "BAD_SOURCE";
      else if (mapped.outcome === "APPLICABILITY") state = "APPLICABILITY";
      else if (mapped.outcome === "NO_MATCH") state = "MISSING";
      else if (candidate === undefined || candidate.sourceClass !== "ACTIVE_CURATED_KNOWLEDGE") state = "BAD_SOURCE";
      else if (candidate.conflictState !== "NONE") state = "CONFLICTING";
      else if (candidate.applicability !== "APPLICABLE") state = "APPLICABILITY";
      else state = "MISSING";
    } else {
      const explicit = input.mappings.find((mapping) => mapping.outcome !== "MATCH" && mapping.requirementId === null);
      if (explicit?.outcome === "UNKNOWN_SEMANTIC") state = "UNKNOWN_SEMANTIC";
      else if (explicit?.outcome === "CONFLICTING") state = "CONFLICTING";
      else if (explicit?.outcome === "BAD_SOURCE") state = "BAD_SOURCE";
      else if (explicit?.outcome === "APPLICABILITY") state = "APPLICABILITY";
    }
    if (requirement.criticality === "CRITICAL") CM += 1;
    results.push({ requirementId: requirement.requirementId, criticality: requirement.criticality, applicability: requirement.applicability, state, matchedCandidateId: null });
  }

  const R = input.requirements.filter((requirement) => requirement.applicability === "APPLICABLE").length;
  const P = input.candidates.length;
  const criticalRequirementMissRate = C === 0 ? 0 : CM / C;
  const requirementRecall = M / R;
  const requirementPrecision = P === 0 ? 0 : M / P;
  const status: "PASS" | "FAIL" = M === R && M === P && CM === 0 && CX === 0 ? "PASS" : "FAIL";
  const p11: P11MeasuredV1 = {
    schemaVersion: P11_SCHEMA_V1,
    status,
    R,
    P,
    M,
    C,
    CM,
    CX,
    requirementRecall,
    requirementPrecision,
    criticalRequirementMissRate,
    criticalRequirementMisses: CM,
    criticalityMismatches: CX,
  };
  const result: Omit<ForwardRequirementAnalysisV1, "analysisDigest"> = {
    schemaVersion: FORWARD_REQUIREMENT_ANALYSIS_SCHEMA_V1,
    analysisId: input.analysisId,
    caseId: input.caseId,
    fixtureDigest: input.fixtureDigest,
    semanticRuleSetDigest: input.semanticRuleSetDigest,
    requirementSetDigest: requirementSetDigestV1(input.requirements),
    candidateSetDigest: candidateSetDigestV1(input.candidates),
    requirements: results,
    p11,
    outcome: status,
    blockedReasons: [],
  };
  return { ...result, analysisDigest: forwardRequirementAnalysisDigestV1(result) };
}

function blockedAnalysis(input: unknown, reasons: readonly CksRequirementAnalysisBlockedReasonV1[]): ForwardRequirementAnalysisV1 {
  const record = isRecord(input) ? input : {};
  const analysisId = isId(record.analysisId) ? record.analysisId : "analysis:blocked";
  const caseId = isId(record.caseId) ? record.caseId : "case:blocked";
  const fixtureDigest = isDigest(record.fixtureDigest) ? record.fixtureDigest : digest(null);
  const semanticRuleSetDigest = isDigest(record.semanticRuleSetDigest) ? record.semanticRuleSetDigest : digest(null);
  const requirementSetDigest = Array.isArray(record.requirements) ? safeDigest(record.requirements) : digest([]);
  const candidateSetDigest = Array.isArray(record.candidates) ? safeDigest(record.candidates) : digest([]);
  const result: Omit<ForwardRequirementAnalysisV1, "analysisDigest"> = {
    schemaVersion: FORWARD_REQUIREMENT_ANALYSIS_SCHEMA_V1,
    analysisId,
    caseId,
    fixtureDigest,
    semanticRuleSetDigest,
    requirementSetDigest,
    candidateSetDigest,
    requirements: [],
    p11: blockedP11(reasons.length > 0 ? reasons : ["DEPENDENCY_EVIDENCE_ABSENT"]),
    outcome: "BLOCKED",
    blockedReasons: [...new Set(reasons.length > 0 ? reasons : ["DEPENDENCY_EVIDENCE_ABSENT"])],
  };
  return { ...result, analysisDigest: forwardRequirementAnalysisDigestV1(result) };
}

export function measureP11V1(input: unknown): P11MeasurementV1 {
  const reasons = validationReasons(input);
  if (reasons.length > 0) return blockedP11(reasons);
  return analyzeValidInput(input as ForwardRequirementAnalysisInputV1).p11;
}

export function analyzeForwardRequirementsV1(input: unknown): ForwardRequirementAnalysisV1 {
  const reasons = validationReasons(input);
  return reasons.length > 0 ? blockedAnalysis(input, reasons) : analyzeValidInput(input as ForwardRequirementAnalysisInputV1);
}

export const forwardRequirementAnalysisV1 = analyzeForwardRequirementsV1;
export const measureP11RequirementCoverageV1 = measureP11V1;

export function validateP11MeasurementV1(value: unknown): value is P11MeasurementV1 {
  if (!isRecord(value) || !exactKeys(value, value.status === "BLOCKED"
    ? ["schemaVersion", "status", "blockedReasons"]
    : ["schemaVersion", "status", "R", "P", "M", "C", "CM", "CX", "requirementRecall", "requirementPrecision", "criticalRequirementMissRate", "criticalRequirementMisses", "criticalityMismatches"])) return false;
  if (value.schemaVersion !== P11_SCHEMA_V1 || !isOneOf(value.status, CKS_P11_STATUSES_V1)) return false;
  if (value.status === "BLOCKED") {
    const blockedReasons = value.blockedReasons;
    return isUniqueStrings(blockedReasons, CKS_BLOCKED_REASONS_V1.length, (item) => isOneOf(item, CKS_BLOCKED_REASONS_V1))
      && Array.isArray(blockedReasons) && blockedReasons.length > 0;
  }
  const measured = value as Record<string, number | string>;
  const numbersOnly = value as unknown as Record<string, number>;
  const numbers = ["R", "P", "M", "C", "CM", "CX", "requirementRecall", "requirementPrecision", "criticalRequirementMissRate", "criticalRequirementMisses", "criticalityMismatches"];
  if (!numbers.every((key) => isFiniteNonNegativeNumber(measured[key]))) return false;
  return Number.isInteger(numbersOnly.R) && Number.isInteger(numbersOnly.P) && Number.isInteger(numbersOnly.M) && Number.isInteger(numbersOnly.C)
    && Number.isInteger(numbersOnly.CM) && Number.isInteger(numbersOnly.CX) && numbersOnly.R >= 1 && numbersOnly.C >= 1
    && numbersOnly.M <= numbersOnly.R && numbersOnly.M <= numbersOnly.P && numbersOnly.CM <= numbersOnly.C && numbersOnly.CX <= numbersOnly.M
    && numbersOnly.requirementRecall === numbersOnly.M / numbersOnly.R
    && numbersOnly.requirementPrecision === (numbersOnly.P === 0 ? 0 : numbersOnly.M / numbersOnly.P)
    && numbersOnly.criticalRequirementMissRate === numbersOnly.CM / numbersOnly.C
    && numbersOnly.criticalRequirementMisses === numbersOnly.CM && numbersOnly.criticalityMismatches === numbersOnly.CX
    && (measured.status === "PASS" ? numbersOnly.M === numbersOnly.R && numbersOnly.M === numbersOnly.P && numbersOnly.CM === 0 && numbersOnly.CX === 0 : true);
}

export function validateForwardRequirementAnalysisV1(value: unknown): value is ForwardRequirementAnalysisV1 {
  if (!isRecord(value) || !exactKeys(value, ["schemaVersion", "analysisId", "caseId", "fixtureDigest", "semanticRuleSetDigest", "requirementSetDigest", "candidateSetDigest", "requirements", "p11", "outcome", "blockedReasons", "analysisDigest"])) return false;
  if (value.schemaVersion !== FORWARD_REQUIREMENT_ANALYSIS_SCHEMA_V1 || !isId(value.analysisId) || !isId(value.caseId)
    || !isDigest(value.fixtureDigest) || !isDigest(value.semanticRuleSetDigest) || !isDigest(value.requirementSetDigest)
    || !isDigest(value.candidateSetDigest) || !Array.isArray(value.requirements) || !Array.isArray(value.blockedReasons)
    || !isOneOf(value.outcome, CKS_P11_STATUSES_V1) || !isDigest(value.analysisDigest)
    || !validateP11MeasurementV1(value.p11)) return false;
  if (!isUniqueStrings(value.blockedReasons, CKS_BLOCKED_REASONS_V1.length, (item) => isOneOf(item, CKS_BLOCKED_REASONS_V1))) return false;
  for (const item of value.requirements) {
    if (!exactKeys(item, ["requirementId", "criticality", "applicability", "state", "matchedCandidateId"]) || !isId(item.requirementId)
      || !isOneOf(item.criticality, CKS_REQUIREMENT_CRITICALITIES_V1) || !isOneOf(item.applicability, ["APPLICABLE", "NOT_APPLICABLE"])
      || !isOneOf(item.state, CKS_REQUIREMENT_STATES_V1) || (item.matchedCandidateId !== null && !isId(item.matchedCandidateId))) return false;
    if (item.applicability === "NOT_APPLICABLE" && item.state !== "NOT_APPLICABLE") return false;
  }
  if (value.outcome === "BLOCKED") return value.blockedReasons.length > 0 && value.p11.status === "BLOCKED" && value.requirements.length === 0
    && forwardRequirementAnalysisDigestV1(value) === value.analysisDigest;
  return value.blockedReasons.length === 0 && value.p11.status === value.outcome && value.requirements.length > 0
    && (value.outcome !== "PASS" || value.requirements.every((item) => item.state === "SATISFIED" || item.state === "NOT_APPLICABLE"))
    && forwardRequirementAnalysisDigestV1(value) === value.analysisDigest;
}

export function validateCksRequirementAnalysisV1(value: unknown): boolean {
  if (!isRecord(value) || typeof value.schemaVersion !== "string") return false;
  if (value.schemaVersion === FORWARD_REQUIREMENT_ANALYSIS_INPUT_SCHEMA_V1) return validateForwardRequirementAnalysisInputV1(value);
  if (value.schemaVersion === FORWARD_REQUIREMENT_ANALYSIS_SCHEMA_V1) return validateForwardRequirementAnalysisV1(value);
  if (value.schemaVersion === P11_SCHEMA_V1) return validateP11MeasurementV1(value);
  return false;
}
