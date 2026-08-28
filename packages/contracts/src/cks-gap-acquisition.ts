import { createHash } from "node:crypto";
import { canonicalJson } from "./canonical-json.js";

export const GAP_ACQUISITION_RECEIPT_SCHEMA_V1 = "pansphaira.cks/gap-acquisition-receipt/v1" as const;
export const CKS_AUTHORITY_BOUNDARY_V1 =
  "READ_ONLY_KNOWLEDGE_NO_CREDENTIAL_POLICY_CAPABILITY_TOOL_WRITE_OR_EXECUTION_AUTHORITY" as const;

export const GAP_ACQUISITION_STATES_V1 = [
  "RECOVERED",
  "NOT_APPLICABLE",
  "GAP_MISSING",
  "GAP_BAD_SOURCE",
  "GAP_APPLICABILITY",
  "GAP_CONFLICTING",
  "GAP_UNKNOWN_SEMANTIC",
  "BLOCKED",
] as const;
export type GapAcquisitionStateV1 = typeof GAP_ACQUISITION_STATES_V1[number];

export const GAP_ACQUISITION_OUTCOMES_V1 = [
  "QUALIFYING_MATCH",
  "NO_MATCH",
  "BAD_SOURCE",
  "APPLICABILITY",
  "CONFLICTING",
  "UNKNOWN_SEMANTIC",
  "BLOCKED",
] as const;
export type GapAcquisitionOutcomeV1 = typeof GAP_ACQUISITION_OUTCOMES_V1[number];

export const GAP_ACQUISITION_GAP_CLASSES_V1 = [
  "NONE",
  "MISSING",
  "BAD_SOURCE",
  "APPLICABILITY",
  "CONFLICTING",
  "UNKNOWN_SEMANTIC",
] as const;
export type GapAcquisitionGapClassV1 = typeof GAP_ACQUISITION_GAP_CLASSES_V1[number];

export const GAP_ACQUISITION_LEVELS_V1 = ["A0", "A1", "A2", "A3", "A4", "A5"] as const;
export type GapAcquisitionLevelV1 = typeof GAP_ACQUISITION_LEVELS_V1[number];
export type RetrievalLevelV1 = "A0" | "A1" | "A2";

export const GAP_ACQUISITION_SOURCE_CLASSES_V1 = [
  "ACTIVE_CURATED_KNOWLEDGE",
  "PINNED_OWNER_EVIDENCE",
  "PINNED_PRIMARY_EVIDENCE",
  "PINNED_SECONDARY_EVIDENCE",
  "INTERNET_RESULT",
  "MODEL_RESULT",
  "UNKNOWN_SOURCE",
] as const;
export type GapAcquisitionSourceClassV1 = typeof GAP_ACQUISITION_SOURCE_CLASSES_V1[number];

export type RetrievalCandidateInputV1 = Readonly<{
  candidateId: string;
  sourceClass: GapAcquisitionSourceClassV1;
  contentDigest: string;
  evidenceDigest: string;
  semanticStatus: "MATCH" | "NO_MATCH" | "UNKNOWN";
  applicability: "APPLICABLE" | "NOT_APPLICABLE" | "UNKNOWN";
  conflictState: "NONE" | "CONFLICTING";
}>;

export type RetrievalAttemptInputV1 = Readonly<{
  level: RetrievalLevelV1;
  strategyId: string;
  retrieverId: string;
  knowledgeBundleDigest: string;
  candidates: readonly RetrievalCandidateInputV1[];
}>;

export type AcquisitionCandidateInputV1 = Readonly<{
  level: "A3" | "A4" | "A5";
  candidateId: string;
  sourceClass: GapAcquisitionSourceClassV1;
  contentDigest: string;
  evidenceDigest: string;
  provenance: string;
  licence: "CC0-1.0" | "CC-BY-4.0" | "APACHE-2.0" | "MIT" | "OWNER_AUTHORIZED" | "UNKNOWN";
}>;

export type GapAcquisitionInputV1 = Readonly<{
  receiptId: string;
  needDigest: string;
  knowledgeBundleDigest: string;
  applicability: "APPLICABLE" | "NOT_APPLICABLE" | "UNKNOWN";
  attempts: readonly RetrievalAttemptInputV1[];
  acquisitionCandidates: readonly AcquisitionCandidateInputV1[];
}>;

type RetrievalCandidateV1 = Readonly<RetrievalCandidateInputV1 & {
  disposition: "RETRIEVAL_RESULT";
}>;

type RetrievalAttemptV1 = Readonly<{
  level: RetrievalLevelV1;
  strategyId: string;
  retrieverId: string;
  outcome: GapAcquisitionOutcomeV1;
  knowledgeBundleDigest: string;
  candidates: readonly RetrievalCandidateV1[];
  attemptDigest: string;
}>;

export type NonAuthoritativeCandidateV1 = Readonly<{
  level: "A3" | "A4" | "A5";
  candidateId: string;
  sourceClass: "PINNED_OWNER_EVIDENCE" | "PINNED_PRIMARY_EVIDENCE" | "PINNED_SECONDARY_EVIDENCE" | "INTERNET_RESULT" | "MODEL_RESULT";
  contentDigest: string;
  evidenceDigest: string;
  provenance: string;
  licence: AcquisitionCandidateInputV1["licence"];
  acceptanceStatus: "NOT_ACCEPTED";
  promotionStatus: "NOT_REQUESTED";
  disposition: "NON_AUTHORITATIVE_CANDIDATE";
  authorityBoundary: typeof CKS_AUTHORITY_BOUNDARY_V1;
  candidateDigest: string;
}>;

export type GapAcquisitionReceiptV1 = Readonly<{
  schemaVersion: typeof GAP_ACQUISITION_RECEIPT_SCHEMA_V1;
  receiptId: string;
  needDigest: string;
  knowledgeBundleDigest: string;
  state: GapAcquisitionStateV1;
  gapClass: GapAcquisitionGapClassV1;
  requirementOutcome: "SATISFIED" | "NOT_APPLICABLE" | "GAP_MISSING" | "GAP_BAD_SOURCE" | "GAP_APPLICABILITY" | "GAP_CONFLICTING" | "GAP_UNKNOWN_SEMANTIC";
  attempts: readonly RetrievalAttemptV1[];
  acquisitionCandidates: readonly NonAuthoritativeCandidateV1[];
  promotionStatus: "NOT_REQUESTED";
  acceptedKnowledgeDigest: null;
  authorityBoundary: typeof CKS_AUTHORITY_BOUNDARY_V1;
  blockedReason: string | null;
  receiptDigest: string;
}>;

export type GapAcquisitionDecisionV1 = Readonly<{
  state: GapAcquisitionStateV1;
  reason: string | null;
  receipt: GapAcquisitionReceiptV1 | null;
}>;

const sha256 = (value: unknown): string => createHash("sha256").update(canonicalJson(value)).digest("hex");
const without = (value: Record<string, unknown>, key: string): Record<string, unknown> =>
  Object.fromEntries(Object.entries(value).filter(([name]) => name !== key));
const isRecord = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === "object" && !Array.isArray(value) && Object.getPrototypeOf(value) === Object.prototype;
const exactKeys = (value: unknown, keys: readonly string[]): value is Record<string, unknown> =>
  isRecord(value) && canonicalJson(Object.keys(value).sort()) === canonicalJson([...keys].sort());
const isDigest = (value: unknown): value is string => typeof value === "string" && /^[a-f0-9]{64}$/.test(value);
const isId = (value: unknown): value is string => typeof value === "string" && /^[a-z][a-z0-9-]{1,31}:[a-z0-9][a-z0-9._-]{2,95}$/.test(value);
const isText = (value: unknown, max: number): value is string =>
  typeof value === "string" && value.length > 0 && value.length <= max && !/[\u0000-\u001f]/.test(value);
const oneOf = <T extends readonly string[]>(value: unknown, values: T): value is T[number] =>
  typeof value === "string" && values.includes(value);

export const gapAcquisitionReceiptDigestV1 = (value: Omit<GapAcquisitionReceiptV1, "receiptDigest"> | Record<string, unknown>): string =>
  sha256(without(value as Record<string, unknown>, "receiptDigest"));
export const gapAcquisitionAttemptDigestV1 = (value: Omit<RetrievalAttemptV1, "attemptDigest"> | Record<string, unknown>): string =>
  sha256(without(value as Record<string, unknown>, "attemptDigest"));
export const nonAuthoritativeCandidateDigestV1 = (value: Omit<NonAuthoritativeCandidateV1, "candidateDigest"> | Record<string, unknown>): string =>
  sha256(without(value as Record<string, unknown>, "candidateDigest"));

function validRetrievalCandidate(value: unknown): value is RetrievalCandidateV1 {
  return exactKeys(value, ["candidateId", "sourceClass", "contentDigest", "evidenceDigest", "semanticStatus", "applicability", "conflictState", "disposition"])
    && isId(value.candidateId) && oneOf(value.sourceClass, GAP_ACQUISITION_SOURCE_CLASSES_V1)
    && isDigest(value.contentDigest) && isDigest(value.evidenceDigest)
    && oneOf(value.semanticStatus, ["MATCH", "NO_MATCH", "UNKNOWN"] as const)
    && oneOf(value.applicability, ["APPLICABLE", "NOT_APPLICABLE", "UNKNOWN"] as const)
    && oneOf(value.conflictState, ["NONE", "CONFLICTING"] as const) && value.disposition === "RETRIEVAL_RESULT";
}

function validAttempt(value: unknown): value is RetrievalAttemptV1 {
  return exactKeys(value, ["level", "strategyId", "retrieverId", "outcome", "knowledgeBundleDigest", "candidates", "attemptDigest"])
    && oneOf(value.level, ["A0", "A1", "A2"] as const) && isText(value.strategyId, 128) && isText(value.retrieverId, 128)
    && oneOf(value.outcome, GAP_ACQUISITION_OUTCOMES_V1) && isDigest(value.knowledgeBundleDigest)
    && Array.isArray(value.candidates) && value.candidates.length <= 20 && value.candidates.every(validRetrievalCandidate)
    && new Set(value.candidates.map((candidate) => candidate.candidateId)).size === value.candidates.length
    && isDigest(value.attemptDigest) && gapAcquisitionAttemptDigestV1(value) === value.attemptDigest;
}

function validAcquisitionCandidate(value: unknown): value is NonAuthoritativeCandidateV1 {
  return exactKeys(value, ["level", "candidateId", "sourceClass", "contentDigest", "evidenceDigest", "provenance", "licence", "acceptanceStatus", "promotionStatus", "disposition", "authorityBoundary", "candidateDigest"])
    && oneOf(value.level, ["A3", "A4", "A5"] as const) && isId(value.candidateId)
    && oneOf(value.sourceClass, ["PINNED_OWNER_EVIDENCE", "PINNED_PRIMARY_EVIDENCE", "PINNED_SECONDARY_EVIDENCE", "INTERNET_RESULT", "MODEL_RESULT"] as const)
    && isDigest(value.contentDigest) && isDigest(value.evidenceDigest) && isText(value.provenance, 2048)
    && oneOf(value.licence, ["CC0-1.0", "CC-BY-4.0", "APACHE-2.0", "MIT", "OWNER_AUTHORIZED", "UNKNOWN"] as const)
    && value.acceptanceStatus === "NOT_ACCEPTED" && value.promotionStatus === "NOT_REQUESTED"
    && value.disposition === "NON_AUTHORITATIVE_CANDIDATE" && value.authorityBoundary === CKS_AUTHORITY_BOUNDARY_V1
    && isDigest(value.candidateDigest) && nonAuthoritativeCandidateDigestV1(value) === value.candidateDigest;
}

function validStateCombination(value: GapAcquisitionReceiptV1): boolean {
  if (value.state === "RECOVERED") return value.gapClass === "NONE" && value.requirementOutcome === "SATISFIED";
  if (value.state === "NOT_APPLICABLE") return value.gapClass === "NONE" && value.requirementOutcome === "NOT_APPLICABLE";
  if (value.state === "GAP_MISSING") return value.gapClass === "MISSING" && value.requirementOutcome === "GAP_MISSING"
    && value.attempts.length === 3 && value.attempts.every((attempt, index) => attempt.level === (["A0", "A1", "A2"] as const)[index] && attempt.outcome === "NO_MATCH")
    && new Set(value.attempts.map((attempt) => attempt.knowledgeBundleDigest)).size === 1;
  if (value.state === "BLOCKED") return value.blockedReason !== null;
  return value.gapClass === value.state.slice(4) && value.requirementOutcome === `GAP_${value.gapClass}`;
}

export function validateGapAcquisitionReceiptV1(value: unknown): value is GapAcquisitionReceiptV1 {
  if (!exactKeys(value, ["schemaVersion", "receiptId", "needDigest", "knowledgeBundleDigest", "state", "gapClass", "requirementOutcome", "attempts", "acquisitionCandidates", "promotionStatus", "acceptedKnowledgeDigest", "authorityBoundary", "blockedReason", "receiptDigest"])) return false;
  if (value.schemaVersion !== GAP_ACQUISITION_RECEIPT_SCHEMA_V1 || !isId(value.receiptId) || !isDigest(value.needDigest)
    || !isDigest(value.knowledgeBundleDigest) || !oneOf(value.state, GAP_ACQUISITION_STATES_V1)
    || !oneOf(value.gapClass, GAP_ACQUISITION_GAP_CLASSES_V1)
    || !oneOf(value.requirementOutcome, ["SATISFIED", "NOT_APPLICABLE", "GAP_MISSING", "GAP_BAD_SOURCE", "GAP_APPLICABILITY", "GAP_CONFLICTING", "GAP_UNKNOWN_SEMANTIC"] as const)
    || !Array.isArray(value.attempts) || value.attempts.length > 3 || !value.attempts.every(validAttempt)
    || !Array.isArray(value.acquisitionCandidates) || value.acquisitionCandidates.length > 20 || !value.acquisitionCandidates.every(validAcquisitionCandidate)
    || new Set(value.acquisitionCandidates.map((candidate) => candidate.candidateId)).size !== value.acquisitionCandidates.length
    || value.promotionStatus !== "NOT_REQUESTED" || value.acceptedKnowledgeDigest !== null
    || value.authorityBoundary !== CKS_AUTHORITY_BOUNDARY_V1 || (value.blockedReason !== null && !isText(value.blockedReason, 256))
    || !isDigest(value.receiptDigest) || gapAcquisitionReceiptDigestV1(value) !== value.receiptDigest) return false;
  const attempts = value.attempts as readonly RetrievalAttemptV1[];
  if (attempts.some((attempt, index) => attempt.level !== (["A0", "A1", "A2"] as const)[index])) return false;
  if (attempts.some((attempt) => attempt.knowledgeBundleDigest !== value.knowledgeBundleDigest)) return false;
  if (value.state !== "BLOCKED" && value.blockedReason !== null) return false;
  if (!validStateCombination(value as GapAcquisitionReceiptV1)) return false;
  if (value.state === "GAP_MISSING" && value.acquisitionCandidates.some((candidate) => candidate.level < "A3")) return false;
  return true;
}

function inputCandidateValid(value: unknown): value is RetrievalCandidateInputV1 {
  return exactKeys(value, ["candidateId", "sourceClass", "contentDigest", "evidenceDigest", "semanticStatus", "applicability", "conflictState"])
    && isId(value.candidateId) && oneOf(value.sourceClass, GAP_ACQUISITION_SOURCE_CLASSES_V1) && isDigest(value.contentDigest) && isDigest(value.evidenceDigest)
    && oneOf(value.semanticStatus, ["MATCH", "NO_MATCH", "UNKNOWN"] as const)
    && oneOf(value.applicability, ["APPLICABLE", "NOT_APPLICABLE", "UNKNOWN"] as const)
    && oneOf(value.conflictState, ["NONE", "CONFLICTING"] as const);
}

function inputAttemptValid(value: unknown): value is RetrievalAttemptInputV1 {
  return exactKeys(value, ["level", "strategyId", "retrieverId", "knowledgeBundleDigest", "candidates"])
    && oneOf(value.level, ["A0", "A1", "A2"] as const) && isText(value.strategyId, 128) && isText(value.retrieverId, 128)
    && isDigest(value.knowledgeBundleDigest)
    && Array.isArray(value.candidates) && value.candidates.length <= 20 && value.candidates.every(inputCandidateValid)
    && new Set(value.candidates.map((candidate) => candidate.candidateId)).size === value.candidates.length;
}

function inputAcquisitionValid(value: unknown): value is AcquisitionCandidateInputV1 {
  return exactKeys(value, ["level", "candidateId", "sourceClass", "contentDigest", "evidenceDigest", "provenance", "licence"])
    && oneOf(value.level, ["A3", "A4", "A5"] as const) && isId(value.candidateId) && oneOf(value.sourceClass, GAP_ACQUISITION_SOURCE_CLASSES_V1)
    && isDigest(value.contentDigest) && isDigest(value.evidenceDigest) && isText(value.provenance, 2048)
    && oneOf(value.licence, ["CC0-1.0", "CC-BY-4.0", "APACHE-2.0", "MIT", "OWNER_AUTHORIZED", "UNKNOWN"] as const);
}

function validInput(value: unknown): value is GapAcquisitionInputV1 {
  return exactKeys(value, ["receiptId", "needDigest", "knowledgeBundleDigest", "applicability", "attempts", "acquisitionCandidates"])
    && isId(value.receiptId) && isDigest(value.needDigest) && isDigest(value.knowledgeBundleDigest)
    && oneOf(value.applicability, ["APPLICABLE", "NOT_APPLICABLE", "UNKNOWN"] as const)
    && Array.isArray(value.attempts) && value.attempts.length <= 3 && value.attempts.every(inputAttemptValid)
    && Array.isArray(value.acquisitionCandidates) && value.acquisitionCandidates.length <= 20 && value.acquisitionCandidates.every(inputAcquisitionValid)
    && new Set(value.acquisitionCandidates.map((candidate) => candidate.candidateId)).size === value.acquisitionCandidates.length;
}

function classifyCandidates(candidates: readonly RetrievalCandidateInputV1[]): GapAcquisitionOutcomeV1 {
  if (candidates.length === 0) return "NO_MATCH";
  if (candidates.some((candidate) => candidate.sourceClass !== "ACTIVE_CURATED_KNOWLEDGE")) return "BAD_SOURCE";
  if (candidates.some((candidate) => candidate.applicability !== "APPLICABLE")) return "APPLICABILITY";
  if (candidates.some((candidate) => candidate.conflictState !== "NONE")) return "CONFLICTING";
  if (candidates.some((candidate) => candidate.semanticStatus === "UNKNOWN")) return "UNKNOWN_SEMANTIC";
  const matches = candidates.filter((candidate) => candidate.semanticStatus === "MATCH");
  return matches.length === 1 ? "QUALIFYING_MATCH" : matches.length > 1 ? "CONFLICTING" : "NO_MATCH";
}

function outputAttempt(input: RetrievalAttemptInputV1, bundleDigest: string, outcome: GapAcquisitionOutcomeV1): RetrievalAttemptV1 {
  const candidates = input.candidates.map((candidate) => ({ ...candidate, disposition: "RETRIEVAL_RESULT" as const }));
  const draft = { level: input.level, strategyId: input.strategyId, retrieverId: input.retrieverId, outcome, knowledgeBundleDigest: bundleDigest, candidates };
  return { ...draft, attemptDigest: gapAcquisitionAttemptDigestV1(draft) };
}

function outputAcquisitionCandidate(input: AcquisitionCandidateInputV1): NonAuthoritativeCandidateV1 | null {
  const sourceAllowed = input.level === "A3"
    ? ["PINNED_OWNER_EVIDENCE", "PINNED_PRIMARY_EVIDENCE", "PINNED_SECONDARY_EVIDENCE"].includes(input.sourceClass)
    : input.level === "A4" ? input.sourceClass === "INTERNET_RESULT" : input.sourceClass === "MODEL_RESULT";
  if (!sourceAllowed) return null;
  const draft = {
    level: input.level, candidateId: input.candidateId, sourceClass: input.sourceClass as NonAuthoritativeCandidateV1["sourceClass"],
    contentDigest: input.contentDigest, evidenceDigest: input.evidenceDigest, provenance: input.provenance, licence: input.licence,
    acceptanceStatus: "NOT_ACCEPTED" as const, promotionStatus: "NOT_REQUESTED" as const,
    disposition: "NON_AUTHORITATIVE_CANDIDATE" as const, authorityBoundary: CKS_AUTHORITY_BOUNDARY_V1,
  };
  return { ...draft, candidateDigest: nonAuthoritativeCandidateDigestV1(draft) };
}

function makeReceipt(input: GapAcquisitionInputV1, state: GapAcquisitionStateV1, gapClass: GapAcquisitionGapClassV1,
  requirementOutcome: GapAcquisitionReceiptV1["requirementOutcome"], attempts: readonly RetrievalAttemptV1[],
  acquisitionCandidates: readonly NonAuthoritativeCandidateV1[], blockedReason: string | null): GapAcquisitionReceiptV1 {
  const draft = {
    schemaVersion: GAP_ACQUISITION_RECEIPT_SCHEMA_V1, receiptId: input.receiptId, needDigest: input.needDigest,
    knowledgeBundleDigest: input.knowledgeBundleDigest, state, gapClass, requirementOutcome, attempts, acquisitionCandidates,
    promotionStatus: "NOT_REQUESTED" as const, acceptedKnowledgeDigest: null,
    authorityBoundary: CKS_AUTHORITY_BOUNDARY_V1, blockedReason,
  };
  return { ...draft, receiptDigest: gapAcquisitionReceiptDigestV1(draft) };
}

function blocked(reason: string): GapAcquisitionDecisionV1 {
  return { state: "BLOCKED", reason, receipt: null };
}

/** Runs A0, then A1, then A2. A1/A2 are never attempted unless the predecessor is NO_MATCH. */
export function findGapAndRouteAcquisitionV1(input: unknown): GapAcquisitionDecisionV1 {
  if (!validInput(input)) return blocked("INVALID_INPUT");
  if (input.applicability === "UNKNOWN") return blocked("UNKNOWN_APPLICABILITY");
  if (input.applicability === "NOT_APPLICABLE") {
    if (input.attempts.length !== 0 || input.acquisitionCandidates.length !== 0) return blocked("NOT_APPLICABLE_INPUT_HAS_ATTEMPTS_OR_ACQUISITION");
    const receipt = makeReceipt(input, "NOT_APPLICABLE", "NONE", "NOT_APPLICABLE", [], [], null);
    return { state: receipt.state, reason: null, receipt };
  }
  const attempts: RetrievalAttemptV1[] = [];
  let terminal: GapAcquisitionOutcomeV1 | null = null;
  for (const [index, level] of (["A0", "A1", "A2"] as const).entries()) {
    const attempt = input.attempts[index];
    if (attempt === undefined) break;
    if (attempt.level !== level || attempt.knowledgeBundleDigest !== input.knowledgeBundleDigest) return blocked("KNOWLEDGE_BUNDLE_CHANGED");
    if (attempts.some((previous) => previous.strategyId === attempt.strategyId || previous.retrieverId === attempt.retrieverId)) return blocked("NON_DETERMINISTIC_RETRIEVAL_STRATEGY");
    const outcome = classifyCandidates(attempt.candidates);
    attempts.push(outputAttempt(attempt, attempt.knowledgeBundleDigest, outcome));
    terminal = outcome;
    if (outcome !== "NO_MATCH") break;
  }
  if (attempts.length === 0 || terminal === null) return blocked("A0_RECEIPT_ABSENT");
  if (terminal === "QUALIFYING_MATCH") {
    if (input.acquisitionCandidates.length !== 0) return blocked("ACQUISITION_BEFORE_GAP");
    const receipt = makeReceipt(input, "RECOVERED", "NONE", "SATISFIED", attempts, [], null);
    return { state: receipt.state, reason: null, receipt };
  }
  if (terminal !== "NO_MATCH") {
    if (input.acquisitionCandidates.length !== 0) return blocked("ACQUISITION_ON_TERMINAL_RETRIEVAL_STATE");
    const gapClass = terminal as Exclude<GapAcquisitionGapClassV1, "NONE" | "MISSING">;
    const receipt = makeReceipt(input, `GAP_${gapClass}` as GapAcquisitionStateV1, gapClass, `GAP_${gapClass}` as GapAcquisitionReceiptV1["requirementOutcome"], attempts, [], null);
    return { state: receipt.state, reason: null, receipt };
  }
  if (attempts.length !== 3) return blocked("INCOMPLETE_A0_A2_RECOVERY");
  const routed = input.acquisitionCandidates.map(outputAcquisitionCandidate);
  if (routed.some((candidate) => candidate === null)) return blocked("INVALID_ACQUISITION_SOURCE_CLASS");
  const candidates = routed as NonAuthoritativeCandidateV1[];
  const receipt = makeReceipt(input, "GAP_MISSING", "MISSING", "GAP_MISSING", attempts, candidates, null);
  return { state: receipt.state, reason: null, receipt };
}

export const findGapV1 = findGapAndRouteAcquisitionV1;
export const routeGapAcquisitionV1 = findGapAndRouteAcquisitionV1;
export const validateGapAcquisitionV1 = validateGapAcquisitionReceiptV1;
