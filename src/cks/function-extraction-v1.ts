/**
 * CKS-11 Function extraction eligibility contract (v1).
 *
 * This is a decision-only validator for an inactive FunctionCandidate. It
 * proves that one exact, stable workflow substep has a closed typed contract,
 * deterministic implementation, exact dependency/evidence links, preserved
 * Verification and an exact source-step rollback. It never extracts,
 * executes, promotes, deploys, activates, or grants Capability or Authority.
 */
import {
  F_MATURITY_LEVELS_V1,
  GOVERNED_ASSETS_SCHEMA_V1,
  governedAssetsDigestV1,
  governedAssetsKnowledgeSetDigestV1,
  governedAssetsRefSetDigestV1,
  validateFunctionCandidateV1,
  type ExactRefV1,
  type FunctionCandidateV1,
  type KnowledgeDependencyV1,
  type CapabilityV1,
  type AuthorityRequirementV1,
} from "./governed-assets-v1.js";
export type { GovernedWorkflowV1, MaturityV1, WorkflowCandidateV1 } from "./governed-assets-v1.js";

export const FUNCTION_EXTRACTION_SCHEMA_V1 =
  "pansphaira.cks-11/function-extraction/v1" as const;
export const FUNCTION_EXTRACTION_DIGEST_ALGORITHM_V1 = "SHA-256" as const;

const DIGEST = /^[a-f0-9]{64}$/;
const DANGEROUS_KEYS = new Set(["__proto__", "prototype", "constructor"]);
const INPUT_TYPES = ["string", "integer", "number", "boolean", "object", "array", "null"] as const;
type InputTypeV1 = (typeof INPUT_TYPES)[number];
type Data = Record<string, unknown>;

export const FUNCTION_ELIGIBILITY_REASON_CODES_V1 = Object.freeze([
  "INVALID_INPUT",
  "CANDIDATE_REJECTED",
  "STABLE_SUBSTEP_REQUIRED",
  "SOURCE_WORKFLOW_INVALID",
  "SOURCE_STEP_MISMATCH",
  "SOURCE_MATURITY_INSUFFICIENT",
  "TYPED_INPUT_CONTRACT_INVALID",
  "TYPED_OUTPUT_CONTRACT_INVALID",
  "LOGIC_CONTRACT_INVALID",
  "ERROR_CONTRACT_INVALID",
  "EVIDENCE_LINK_MISMATCH",
  "DEPENDENCY_LINK_MISMATCH",
  "HISTORICAL_RECEIPT_MISMATCH",
  "VERIFICATION_BOUNDARY_INVALID",
  "ROLLBACK_BOUNDARY_INVALID",
  "CAPABILITY_WIDENING",
  "AUTHORITY_WIDENING",
  "PARITY_EVIDENCE_INCOMPLETE",
  "DETERMINISM_UNPROVEN",
  "ELIGIBILITY_RECEIPT_REQUIRED",
] as const);
export type FunctionEligibilityReasonCodeV1 =
  (typeof FUNCTION_ELIGIBILITY_REASON_CODES_V1)[number];

const REASON_ORDER = FUNCTION_ELIGIBILITY_REASON_CODES_V1;
const TYPED_FIELD_KEYS = ["name", "type", "required"] as const;
const TYPED_CONTRACT_KEYS = [
  "schemaVersion",
  "contractVersion",
  "fields",
  "additionalProperties",
  "contractDigest",
] as const;
const STABLE_SUBSTEP_KEYS = [
  "schemaVersion",
  "sourceWorkflowRef",
  "sourceWorkflowDigest",
  "stepIds",
  "subgraphDigest",
  "stabilityEvidenceRefs",
  "stabilityStatus",
  "stableSubstepDigest",
] as const;
const SOURCE_WORKFLOW_KEYS = [
  "workflowRef",
  "workflowDigest",
  "maturityLevel",
  "assuranceStatus",
  "stepIds",
  "stableSubstepIds",
  "dependencyClosureDigest",
] as const;
const LOGIC_KEYS = [
  "schemaVersion",
  "logicRef",
  "algorithmVersion",
  "implementationDigest",
  "logicKind",
  "deterministic",
  "forbiddenInputs",
  "logicDigest",
] as const;
const ERROR_KEYS = [
  "schemaVersion",
  "contractVersion",
  "errorTypeRefs",
  "errorCodes",
  "exhaustive",
  "errorDigest",
] as const;
const ERROR_CODE_KEYS = ["code", "outputType", "terminal"] as const;
const EVIDENCE_KEYS = [
  "sourceEvidenceRefs",
  "replayEvidenceRefs",
  "counterexampleEvidenceRefs",
  "parityEvidenceRefs",
  "verificationReceiptRefs",
  "rollbackEvidenceRefs",
] as const;
const DEPENDENCY_KEYS = [
  "knowledgeDependencies",
  "knowledgeDependencySetDigest",
  "workflowDependencies",
  "workflowDependencySetDigest",
  "functionDependencies",
  "functionDependencySetDigest",
  "transitiveClosureDigest",
] as const;
const VERIFICATION_KEYS = [
  "verificationPlanRef",
  "verifierRef",
  "verificationReceiptRefs",
  "sourceCheckpointRefs",
  "readbackRef",
] as const;
const ROLLBACK_KEYS = [
  "rollbackContractRef",
  "lastKnownGoodRef",
  "originalStepFallbackRef",
  "fallbackReadbackRef",
  "rollbackReceiptRef",
] as const;
const BOUNDARY_KEYS = [
  "sourceCapabilities",
  "candidateCapabilities",
  "sourceAuthorityRequirements",
  "candidateAuthorityRequirements",
  "capabilityCeilingDigest",
  "authorityRequirementDigest",
] as const;
const RECEIPT_KEYS = [
  "receiptRef",
  "receiptDigest",
  "previousReceiptDigest",
  "immutable",
] as const;
const P20_KEYS = [
  "schemaVersion",
  "originalResultDigest",
  "candidateResultDigest",
  "parityDigest",
  "deterministicReplayDigest",
  "resultKind",
  "mismatchCount",
  "parityVerifierRef",
  "evidenceRefs",
] as const;
const INPUT_KEYS = [
  "schemaVersion",
  "candidate",
  "sourceWorkflow",
  "stableSubstep",
  "inputContract",
  "outputContract",
  "logicContract",
  "errorContract",
  "evidenceLinks",
  "dependencyLinks",
  "historicalReceipts",
  "verification",
  "rollback",
  "boundary",
  "p20Parity",
] as const;

export interface TypedFieldV1 {
  readonly name: string;
  readonly type: InputTypeV1;
  readonly required: boolean;
}
export interface TypedContractV1 {
  readonly schemaVersion: typeof FUNCTION_EXTRACTION_SCHEMA_V1;
  readonly contractVersion: string;
  readonly fields: readonly TypedFieldV1[];
  readonly additionalProperties: false;
  readonly contractDigest: string;
}
export interface StableSubstepV1 {
  readonly schemaVersion: typeof FUNCTION_EXTRACTION_SCHEMA_V1;
  readonly sourceWorkflowRef: ExactRefV1;
  readonly sourceWorkflowDigest: string;
  readonly stepIds: readonly string[];
  readonly subgraphDigest: string;
  readonly stabilityEvidenceRefs: readonly ExactRefV1[];
  readonly stabilityStatus: "STABLE";
  readonly stableSubstepDigest: string;
}
export interface SourceWorkflowSnapshotV1 {
  readonly workflowRef: ExactRefV1;
  readonly workflowDigest: string;
  readonly maturityLevel: "W5 SHADOW_PARITY_VERIFIED" | "W6 PROMOTION_ELIGIBLE";
  readonly assuranceStatus: "VALIDATION_CURRENT";
  readonly stepIds: readonly string[];
  readonly stableSubstepIds: readonly string[];
  readonly dependencyClosureDigest: string;
}
export interface DeterministicLogicContractV1 {
  readonly schemaVersion: typeof FUNCTION_EXTRACTION_SCHEMA_V1;
  readonly logicRef: ExactRefV1;
  readonly algorithmVersion: string;
  readonly implementationDigest: string;
  readonly logicKind: "PURE" | "PROPOSAL_ONLY";
  readonly deterministic: true;
  readonly forbiddenInputs: readonly string[];
  readonly logicDigest: string;
}
export interface TypedErrorCaseV1 {
  readonly code: string;
  readonly outputType: InputTypeV1;
  readonly terminal: true;
}
export interface TypedErrorContractV1 {
  readonly schemaVersion: typeof FUNCTION_EXTRACTION_SCHEMA_V1;
  readonly contractVersion: string;
  readonly errorTypeRefs: readonly ExactRefV1[];
  readonly errorCodes: readonly TypedErrorCaseV1[];
  readonly exhaustive: true;
  readonly errorDigest: string;
}
export interface FunctionExtractionEvidenceLinksV1 {
  readonly sourceEvidenceRefs: readonly ExactRefV1[];
  readonly replayEvidenceRefs: readonly ExactRefV1[];
  readonly counterexampleEvidenceRefs: readonly ExactRefV1[];
  readonly parityEvidenceRefs: readonly ExactRefV1[];
  readonly verificationReceiptRefs: readonly ExactRefV1[];
  readonly rollbackEvidenceRefs: readonly ExactRefV1[];
}
export interface FunctionExtractionDependencyLinksV1 {
  readonly knowledgeDependencies: readonly KnowledgeDependencyV1[];
  readonly knowledgeDependencySetDigest: string;
  readonly workflowDependencies: readonly ExactRefV1[];
  readonly workflowDependencySetDigest: string;
  readonly functionDependencies: readonly ExactRefV1[];
  readonly functionDependencySetDigest: string;
  readonly transitiveClosureDigest: string;
}
export interface FunctionExtractionVerificationV1 {
  readonly verificationPlanRef: ExactRefV1;
  readonly verifierRef: ExactRefV1;
  readonly verificationReceiptRefs: readonly ExactRefV1[];
  readonly sourceCheckpointRefs: readonly ExactRefV1[];
  readonly readbackRef: ExactRefV1;
}
export interface FunctionExtractionRollbackV1 {
  readonly rollbackContractRef: ExactRefV1;
  readonly lastKnownGoodRef: ExactRefV1;
  readonly originalStepFallbackRef: ExactRefV1;
  readonly fallbackReadbackRef: ExactRefV1;
  readonly rollbackReceiptRef: ExactRefV1;
}
export interface FunctionBoundaryEnvelopeV1 {
  readonly sourceCapabilities: readonly CapabilityV1[];
  readonly candidateCapabilities: readonly CapabilityV1[];
  readonly sourceAuthorityRequirements: readonly AuthorityRequirementV1[];
  readonly candidateAuthorityRequirements: readonly AuthorityRequirementV1[];
  readonly capabilityCeilingDigest: string;
  readonly authorityRequirementDigest: string;
}
export interface HistoricalReceiptLinkV1 {
  readonly receiptRef: ExactRefV1;
  readonly receiptDigest: string;
  readonly previousReceiptDigest: string | null;
  readonly immutable: true;
}
export interface P20FunctionParityV1 {
  readonly schemaVersion: typeof FUNCTION_EXTRACTION_SCHEMA_V1;
  readonly originalResultDigest: string;
  readonly candidateResultDigest: string;
  readonly parityDigest: string;
  readonly deterministicReplayDigest: string;
  readonly resultKind: "TYPED_OUTPUT_OR_DECLARED_ERROR";
  readonly mismatchCount: 0;
  readonly parityVerifierRef: ExactRefV1;
  readonly evidenceRefs: readonly ExactRefV1[];
}
export interface FunctionCandidateEligibilityInputV1 {
  readonly schemaVersion: typeof FUNCTION_EXTRACTION_SCHEMA_V1;
  readonly candidate: unknown;
  readonly sourceWorkflow: SourceWorkflowSnapshotV1;
  readonly stableSubstep: StableSubstepV1;
  readonly inputContract: TypedContractV1;
  readonly outputContract: TypedContractV1;
  readonly logicContract: DeterministicLogicContractV1;
  readonly errorContract: TypedErrorContractV1;
  readonly evidenceLinks: FunctionExtractionEvidenceLinksV1;
  readonly dependencyLinks: FunctionExtractionDependencyLinksV1;
  readonly historicalReceipts: readonly HistoricalReceiptLinkV1[];
  readonly verification: FunctionExtractionVerificationV1;
  readonly rollback: FunctionExtractionRollbackV1;
  readonly boundary: FunctionBoundaryEnvelopeV1;
  readonly p20Parity: P20FunctionParityV1;
}
export interface FunctionCandidateEligibilityResultV1 {
  readonly outcome: "ELIGIBLE" | "REJECTED";
  readonly status: "ELIGIBLE" | "REJECTED";
  readonly reasonCodes: readonly FunctionEligibilityReasonCodeV1[];
  readonly exitCode: number;
  readonly decisionDigest: string;
  readonly candidate?: FunctionCandidateV1;
}

function isRecord(value: unknown): value is Data {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) return false;
  for (const key of Reflect.ownKeys(value)) {
    if (typeof key !== "string" || DANGEROUS_KEYS.has(key)) return false;
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (descriptor === undefined || !("value" in descriptor) || descriptor.enumerable !== true) return false;
  }
  return true;
}
function isArray(value: unknown): value is unknown[] {
  if (!Array.isArray(value) || Object.getPrototypeOf(value) !== Array.prototype) return false;
  const keys = Reflect.ownKeys(value);
  if (keys.length !== value.length + 1) return false;
  for (let i = 0; i < value.length; i += 1) {
    const descriptor = Object.getOwnPropertyDescriptor(value, i);
    if (descriptor === undefined || !("value" in descriptor) || descriptor.enumerable !== true) return false;
  }
  return true;
}
function exactKeys(value: unknown, keys: readonly string[]): value is Data {
  if (!isRecord(value)) return false;
  const actual = Object.keys(value).sort();
  const expected = [...keys].sort();
  return actual.length === expected.length && actual.every((key, i) => key === expected[i]);
}
function string(value: unknown, max = 256): value is string {
  return typeof value === "string" && value.length > 0 && value.length <= max && value === value.trim() && !/[\u0000-\u001f\u007f]/.test(value);
}
function digest(value: unknown): value is string { return typeof value === "string" && DIGEST.test(value); }
function version(value: unknown): value is string { return string(value, 128) && !/[~^*<>=|&,\s]/.test(value) && !/(?:^|[./_-])(?:latest|range|x)(?=$|[./_-])/i.test(value); }
function denseStrings(value: unknown, nonEmpty = false): value is string[] { return isArray(value) && (!nonEmpty || value.length > 0) && value.every((entry) => string(entry)); }
function finiteNumber(value: unknown): value is number { return typeof value === "number" && Number.isFinite(value); }
function noDuplicates(values: readonly string[]): boolean { return new Set(values).size === values.length; }
function clone<T>(value: T): T {
  if (value === null || typeof value !== "object") return value;
  if (Array.isArray(value)) return value.map((entry) => clone(entry)) as T;
  const output: Data = {};
  for (const [key, entry] of Object.entries(value as Data)) {
    Object.defineProperty(output, key, { value: clone(entry), enumerable: true, writable: true, configurable: true });
  }
  return output as T;
}
function freeze<T>(value: T): T {
  if (value !== null && typeof value === "object") {
    for (const entry of Object.values(value as Data)) freeze(entry);
    Object.freeze(value);
  }
  return value;
}
function equal(left: unknown, right: unknown): boolean {
  try { return governedAssetsDigestV1(left) === governedAssetsDigestV1(right); } catch { return false; }
}
function refs(value: unknown, kinds?: readonly string[]): value is ExactRefV1[] {
  if (!isArray(value) || !value.every((entry): entry is ExactRefV1 => exactRef(entry, kinds))) return false;
  return noDuplicates(value.map((entry) => `${entry.kind}|${entry.id}|${entry.version}|${entry.digest}`));
}
function exactRef(value: unknown, kinds?: readonly string[]): value is ExactRefV1 {
  if (!exactKeys(value, ["kind", "id", "schemaVersion", "version", "digestAlgorithm", "digest"])) return false;
  return string(value.kind) && (!kinds || kinds.includes(value.kind)) && string(value.id) && value.schemaVersion === GOVERNED_ASSETS_SCHEMA_V1 && version(value.version) && value.digestAlgorithm === FUNCTION_EXTRACTION_DIGEST_ALGORITHM_V1 && digest(value.digest);
}
function contract(value: unknown, candidate: Data, refKey: "inputSchemaRef" | "outputSchemaRef", codes: Set<FunctionEligibilityReasonCodeV1>, reason: FunctionEligibilityReasonCodeV1): value is TypedContractV1 {
  if (!exactKeys(value, TYPED_CONTRACT_KEYS)) { codes.add(reason); return false; }
  if (value.schemaVersion !== FUNCTION_EXTRACTION_SCHEMA_V1 || !version(value.contractVersion) || value.additionalProperties !== false || !digest(value.contractDigest) || !isArray(value.fields)) { codes.add(reason); return false; }
  const names: string[] = [];
  for (const field of value.fields) {
    if (!exactKeys(field, TYPED_FIELD_KEYS) || !string(field.name, 128) || !INPUT_TYPES.includes(field.type as InputTypeV1) || typeof field.required !== "boolean") { codes.add(reason); return false; }
    names.push(field.name);
  }
  const schemaRef = candidate[refKey];
  if (names.length === 0 || !noDuplicates(names) || governedAssetsDigestV1(value, "contractDigest") !== value.contractDigest || !isRecord(schemaRef) || schemaRef["digest"] !== value.contractDigest) codes.add(reason);
  return true;
}
function stable(value: unknown, source: SourceWorkflowSnapshotV1, codes: Set<FunctionEligibilityReasonCodeV1>): value is StableSubstepV1 {
  if (!exactKeys(value, STABLE_SUBSTEP_KEYS) || value.schemaVersion !== FUNCTION_EXTRACTION_SCHEMA_V1 || value.stabilityStatus !== "STABLE" || !exactRef(value.sourceWorkflowRef, ["WORKFLOW_CANDIDATE", "GOVERNED_WORKFLOW"]) || !digest(value.sourceWorkflowDigest) || !denseStrings(value.stepIds, true) || !noDuplicates(value.stepIds) || !digest(value.subgraphDigest) || !refs(value.stabilityEvidenceRefs, ["EVIDENCE"]) || value.stabilityEvidenceRefs.length === 0 || !digest(value.stableSubstepDigest)) { codes.add("STABLE_SUBSTEP_REQUIRED"); return false; }
  if (value.sourceWorkflowDigest !== source.workflowDigest || !equal(value.sourceWorkflowRef, source.workflowRef) || !equal(value.stepIds, source.stableSubstepIds) || value.stableSubstepDigest !== governedAssetsDigestV1(value, "stableSubstepDigest")) codes.add("SOURCE_STEP_MISMATCH");
  return true;
}
function sourceWorkflow(value: unknown, codes: Set<FunctionEligibilityReasonCodeV1>): SourceWorkflowSnapshotV1 | null {
  if (!exactKeys(value, SOURCE_WORKFLOW_KEYS) || !exactRef(value.workflowRef, ["WORKFLOW_CANDIDATE", "GOVERNED_WORKFLOW"]) || !digest(value.workflowDigest) || !["W5 SHADOW_PARITY_VERIFIED", "W6 PROMOTION_ELIGIBLE"].includes(value.maturityLevel as string) || value.assuranceStatus !== "VALIDATION_CURRENT" || !denseStrings(value.stepIds, true) || !denseStrings(value.stableSubstepIds, true) || !digest(value.dependencyClosureDigest)) { codes.add("SOURCE_WORKFLOW_INVALID"); return null; }
  const stepIds = value.stepIds;
  const stableSubstepIds = value.stableSubstepIds;
  if (!stableSubstepIds.every((id) => stepIds.includes(id)) || !noDuplicates(stepIds) || !noDuplicates(stableSubstepIds)) { codes.add("SOURCE_WORKFLOW_INVALID"); return null; }
  if (value.workflowDigest !== value.workflowRef.digest) codes.add("SOURCE_WORKFLOW_INVALID");
  if (stableSubstepIds.length === 0) codes.add("STABLE_SUBSTEP_REQUIRED");
  return value as unknown as SourceWorkflowSnapshotV1;
}
function logic(value: unknown, candidate: Data, codes: Set<FunctionEligibilityReasonCodeV1>): value is DeterministicLogicContractV1 {
  if (!exactKeys(value, LOGIC_KEYS) || value.schemaVersion !== FUNCTION_EXTRACTION_SCHEMA_V1 || !exactRef(value.logicRef, ["LOGIC"]) || !version(value.algorithmVersion) || !digest(value.implementationDigest) || !["PURE", "PROPOSAL_ONLY"].includes(value.logicKind as string) || value.deterministic !== true || !denseStrings(value.forbiddenInputs) || value.forbiddenInputs.length !== 0 || !digest(value.logicDigest) || value.logicDigest !== governedAssetsDigestV1(value, "logicDigest")) { codes.add("LOGIC_CONTRACT_INVALID"); return false; }
  if (!equal(value.logicRef, candidate["logicRef"]) || value.algorithmVersion !== candidate["logicAlgorithmVersion"] || value.implementationDigest !== candidate["logicImplementationDigest"] || value.logicKind !== candidate["logicKind"]) codes.add("LOGIC_CONTRACT_INVALID");
  return true;
}
function errors(value: unknown, candidate: Data, codes: Set<FunctionEligibilityReasonCodeV1>): value is TypedErrorContractV1 {
  if (!exactKeys(value, ERROR_KEYS) || value.schemaVersion !== FUNCTION_EXTRACTION_SCHEMA_V1 || !version(value.contractVersion) || value.exhaustive !== true || !refs(value.errorTypeRefs, ["SCHEMA"]) || value.errorTypeRefs.length === 0 || !isArray(value.errorCodes) || value.errorCodes.length === 0 || !digest(value.errorDigest) || value.errorDigest !== governedAssetsDigestV1(value, "errorDigest")) { codes.add("ERROR_CONTRACT_INVALID"); return false; }
  const seen = new Set<string>();
  for (const item of value.errorCodes) {
    if (!exactKeys(item, ERROR_CODE_KEYS) || !string(item.code, 128) || seen.has(item.code) || !INPUT_TYPES.includes(item.outputType as InputTypeV1) || item.terminal !== true) { codes.add("ERROR_CONTRACT_INVALID"); return false; }
    seen.add(item.code);
  }
  const candidateContract = candidate["errorContract"];
  if (!isRecord(candidateContract) || !equal(value.errorTypeRefs, candidateContract["errorTypeRefs"])) codes.add("ERROR_CONTRACT_INVALID");
  return true;
}
function dependencyLinks(value: unknown, candidate: Data, source: SourceWorkflowSnapshotV1, codes: Set<FunctionEligibilityReasonCodeV1>): value is FunctionExtractionDependencyLinksV1 {
  if (!exactKeys(value, DEPENDENCY_KEYS) || !isArray(value.knowledgeDependencies) || !value.knowledgeDependencies.every((entry) => isKnowledgeDependency(entry)) || !refs(value.workflowDependencies, ["WORKFLOW_CANDIDATE", "GOVERNED_WORKFLOW"]) || !refs(value.functionDependencies, ["FUNCTION_CANDIDATE"]) || !digest(value.knowledgeDependencySetDigest) || !digest(value.workflowDependencySetDigest) || !digest(value.functionDependencySetDigest) || !digest(value.transitiveClosureDigest)) { codes.add("DEPENDENCY_LINK_MISMATCH"); return false; }
  if (!equal(value.knowledgeDependencies, candidate["knowledgeDependencies"]) || !equal(value.workflowDependencies, candidate["workflowDependencies"]) || !equal(value.functionDependencies, candidate["functionDependencies"]) || value.knowledgeDependencySetDigest !== candidate["knowledgeDependencySetDigest"] || value.workflowDependencySetDigest !== candidate["workflowDependencySetDigest"] || value.functionDependencySetDigest !== candidate["functionDependencySetDigest"] || value.transitiveClosureDigest !== candidate["transitiveClosureDigest"] || value.transitiveClosureDigest !== source.dependencyClosureDigest || value.knowledgeDependencySetDigest !== governedAssetsKnowledgeSetDigestV1(value.knowledgeDependencies) || value.workflowDependencySetDigest !== governedAssetsRefSetDigestV1(value.workflowDependencies) || value.functionDependencySetDigest !== governedAssetsRefSetDigestV1(value.functionDependencies)) codes.add("DEPENDENCY_LINK_MISMATCH");
  return true;
}
function isKnowledgeDependency(value: unknown): value is KnowledgeDependencyV1 {
  return exactKeys(value, ["recordId", "schemaVersion", "edition", "contentDigest", "applicabilityDigest", "evidenceDigest", "validFromMs", "validUntilMs", "supersessionLineage"]) && string(value.recordId) && string(value.schemaVersion) && string(value.edition) && digest(value.contentDigest) && digest(value.applicabilityDigest) && digest(value.evidenceDigest) && finiteNumber(value.validFromMs) && finiteNumber(value.validUntilMs) && value.validFromMs < value.validUntilMs && denseStrings(value.supersessionLineage) && noDuplicates(value.supersessionLineage);
}
function evidence(value: unknown, candidate: Data, stableSubstep: Data, codes: Set<FunctionEligibilityReasonCodeV1>): value is FunctionExtractionEvidenceLinksV1 {
  if (!exactKeys(value, EVIDENCE_KEYS) || !refs(value.sourceEvidenceRefs, ["EVIDENCE"]) || !refs(value.replayEvidenceRefs, ["EVIDENCE"]) || !refs(value.counterexampleEvidenceRefs, ["EVIDENCE"]) || !refs(value.parityEvidenceRefs, ["EVIDENCE"]) || !refs(value.verificationReceiptRefs, ["RECEIPT"]) || !refs(value.rollbackEvidenceRefs, ["EVIDENCE"]) || value.sourceEvidenceRefs.length === 0 || value.replayEvidenceRefs.length === 0 || value.counterexampleEvidenceRefs.length === 0 || value.parityEvidenceRefs.length === 0 || value.rollbackEvidenceRefs.length === 0) { codes.add("EVIDENCE_LINK_MISMATCH"); return false; }
  if (!equal(value.sourceEvidenceRefs, stableSubstep["stabilityEvidenceRefs"]) || !equal(value.replayEvidenceRefs, candidate["evidenceRefs"]) || !equal(value.parityEvidenceRefs, candidate["parityEvidenceRefs"]) || !equal(value.verificationReceiptRefs, candidate["verificationReceiptRefs"]) || value.parityEvidenceRefs.length < 1 || value.verificationReceiptRefs.length < 1) codes.add("EVIDENCE_LINK_MISMATCH");
  return true;
}
function verification(value: unknown, candidate: Data, codes: Set<FunctionEligibilityReasonCodeV1>): value is FunctionExtractionVerificationV1 {
  if (!exactKeys(value, VERIFICATION_KEYS) || !exactRef(value.verificationPlanRef, ["VERIFICATION_PLAN"]) || !exactRef(value.verifierRef, ["VERIFIER"]) || !refs(value.verificationReceiptRefs, ["RECEIPT"]) || !refs(value.sourceCheckpointRefs, ["VERIFICATION_PLAN"]) || value.sourceCheckpointRefs.length === 0 || !exactRef(value.readbackRef, ["READBACK"])) { codes.add("VERIFICATION_BOUNDARY_INVALID"); return false; }
  if (!equal(value.verificationPlanRef, candidate["verificationPlanRef"]) || !equal(value.verificationReceiptRefs, candidate["verificationReceiptRefs"]) || !equal(value.sourceCheckpointRefs, [candidate["verificationPlanRef"]])) codes.add("VERIFICATION_BOUNDARY_INVALID");
  return true;
}
function rollback(value: unknown, candidate: Data, codes: Set<FunctionEligibilityReasonCodeV1>): value is FunctionExtractionRollbackV1 {
  if (!exactKeys(value, ROLLBACK_KEYS) || !exactRef(value.rollbackContractRef, ["ROLLBACK_CONTRACT"]) || !exactRef(value.lastKnownGoodRef, ["LAST_KNOWN_GOOD"]) || !exactRef(value.originalStepFallbackRef, ["FALLBACK_PATH"]) || !exactRef(value.fallbackReadbackRef, ["READBACK"]) || !exactRef(value.rollbackReceiptRef, ["RECEIPT"])) { codes.add("ROLLBACK_BOUNDARY_INVALID"); return false; }
  const candidateRollback = candidate["rollbackContract"];
  if (!isRecord(candidateRollback) || !equal(value.rollbackContractRef, candidateRollback["contractRef"]) || !equal(value.lastKnownGoodRef, candidateRollback["lastKnownGoodRef"]) || !equal(value.originalStepFallbackRef, candidate["originalStepFallbackRef"]) || !equal(value.fallbackReadbackRef, candidate["fallbackReadbackRef"]) || candidate["fallbackReadbackRef"] === null) codes.add("ROLLBACK_BOUNDARY_INVALID");
  return true;
}
function capabilityEqual(left: CapabilityV1, right: CapabilityV1): boolean { return equal(left, right); }
function capabilitySubset(candidate: readonly CapabilityV1[], source: readonly CapabilityV1[]): boolean { return candidate.every((item) => source.some((base) => capabilityEqual(item, base))); }
function authorityEqual(left: AuthorityRequirementV1, right: AuthorityRequirementV1): boolean { return equal(left, right); }
function boundary(value: unknown, candidate: Data, codes: Set<FunctionEligibilityReasonCodeV1>): value is FunctionBoundaryEnvelopeV1 {
  if (!exactKeys(value, BOUNDARY_KEYS) || !isArray(value.sourceCapabilities) || !isArray(value.candidateCapabilities) || !value.sourceCapabilities.every((item) => isCapability(item)) || !value.candidateCapabilities.every((item) => isCapability(item)) || !isArray(value.sourceAuthorityRequirements) || !isArray(value.candidateAuthorityRequirements) || !value.sourceAuthorityRequirements.every((item) => isAuthority(item)) || !value.candidateAuthorityRequirements.every((item) => isAuthority(item)) || !digest(value.capabilityCeilingDigest) || !digest(value.authorityRequirementDigest)) { codes.add("VERIFICATION_BOUNDARY_INVALID"); return false; }
  if (!capabilitySubset(value.candidateCapabilities, value.sourceCapabilities)) codes.add("CAPABILITY_WIDENING");
  const sourceAuthorityRequirements = value.sourceAuthorityRequirements as AuthorityRequirementV1[];
  const candidateAuthorityRequirements = value.candidateAuthorityRequirements as AuthorityRequirementV1[];
  if (!candidateAuthorityRequirements.every((item) => sourceAuthorityRequirements.some((base) => authorityEqual(item, base))) || candidateAuthorityRequirements.length !== sourceAuthorityRequirements.length) codes.add("AUTHORITY_WIDENING");
  if (candidate["capabilityCeilingDigest"] !== value.capabilityCeilingDigest || candidate["authorityRequirementDigest"] !== value.authorityRequirementDigest) codes.add("VERIFICATION_BOUNDARY_INVALID");
  return true;
}
function isCapability(value: unknown): value is CapabilityV1 { return exactKeys(value, ["action", "dataClass", "credentialUse", "effectClass", "field", "networkRoute", "purpose", "resource", "target", "tenant"]) && ["action", "dataClass", "credentialUse", "effectClass", "field", "networkRoute", "purpose", "resource", "target", "tenant"].every((key) => value[key] === null || string(value[key])); }
function isAuthority(value: unknown): value is AuthorityRequirementV1 { return exactKeys(value, ["actor", "tenant", "action", "target", "scope"]) && string(value.actor) && string(value.tenant) && string(value.action) && string(value.target) && (value.scope === null || string(value.scope)); }
function receipts(value: unknown, candidate: Data, codes: Set<FunctionEligibilityReasonCodeV1>): boolean {
  if (!isArray(value) || !value.every((entry) => exactKeys(entry, RECEIPT_KEYS) && exactRef(entry.receiptRef, ["RECEIPT"]) && digest(entry.receiptDigest) && entry.receiptDigest === entry.receiptRef.digest && (entry.previousReceiptDigest === null || digest(entry.previousReceiptDigest)) && entry.immutable === true)) { codes.add("HISTORICAL_RECEIPT_MISMATCH"); return false; }
  const receiptLinks = value as Data[];
  const refsInCandidate = candidate["verificationReceiptRefs"] as unknown[];
  if (!equal(receiptLinks.map((entry) => entry.receiptRef), refsInCandidate) || value.length === 0) codes.add("HISTORICAL_RECEIPT_MISMATCH");
  return true;
}
function p20(value: unknown, candidate: Data, codes: Set<FunctionEligibilityReasonCodeV1>): value is P20FunctionParityV1 {
  if (!exactKeys(value, P20_KEYS) || value.schemaVersion !== FUNCTION_EXTRACTION_SCHEMA_V1 || !digest(value.originalResultDigest) || !digest(value.candidateResultDigest) || !digest(value.parityDigest) || !digest(value.deterministicReplayDigest) || value.resultKind !== "TYPED_OUTPUT_OR_DECLARED_ERROR" || value.mismatchCount !== 0 || !exactRef(value.parityVerifierRef, ["PARITY_VERIFIER"]) || !refs(value.evidenceRefs, ["EVIDENCE"]) || value.evidenceRefs.length === 0 || !equal(value.evidenceRefs, candidate["parityEvidenceRefs"])) { codes.add("PARITY_EVIDENCE_INCOMPLETE"); return false; }
  if (value.originalResultDigest !== value.candidateResultDigest) codes.add("PARITY_EVIDENCE_INCOMPLETE");
  if (value.parityDigest !== governedAssetsDigestV1({ originalResultDigest: value.originalResultDigest, candidateResultDigest: value.candidateResultDigest, mismatchCount: value.mismatchCount })) codes.add("PARITY_EVIDENCE_INCOMPLETE");
  if (value.deterministicReplayDigest === governedAssetsDigestV1([])) codes.add("DETERMINISM_UNPROVEN");
  return true;
}
function ordered(codes: Set<FunctionEligibilityReasonCodeV1>): readonly FunctionEligibilityReasonCodeV1[] { return REASON_ORDER.filter((code) => codes.has(code)); }
function result(codes: Set<FunctionEligibilityReasonCodeV1>, candidate?: FunctionCandidateV1): FunctionCandidateEligibilityResultV1 {
  const reasonCodes = ordered(codes);
  const outcome = reasonCodes.length === 0 ? "ELIGIBLE" : "REJECTED";
  const payload = { outcome, reasonCodes, candidateDigest: candidate?.artifactDigest ?? null };
  const output: FunctionCandidateEligibilityResultV1 = { outcome, status: outcome, reasonCodes, exitCode: outcome === "ELIGIBLE" ? 0 : 171, decisionDigest: governedAssetsDigestV1(payload), ...(candidate === undefined || outcome !== "ELIGIBLE" ? {} : { candidate }) };
  return freeze(clone(output));
}

/** Validate the complete, closed FunctionCandidate eligibility envelope. */
export function validateFunctionCandidateEligibilityV1(value: unknown): FunctionCandidateEligibilityResultV1 {
  const codes = new Set<FunctionEligibilityReasonCodeV1>();
  if (!exactKeys(value, INPUT_KEYS)) return result(new Set(["INVALID_INPUT"]));
  const input = value as Data;
  if (input.schemaVersion !== FUNCTION_EXTRACTION_SCHEMA_V1 || !isRecord(input.candidate)) return result(new Set(["INVALID_INPUT"]));
  const candidateResult = validateFunctionCandidateV1(input.candidate);
  if (candidateResult.outcome !== "ACCEPTED") codes.add("CANDIDATE_REJECTED");
  const candidate = candidateResult.outcome === "ACCEPTED" ? candidateResult.record : undefined;
  const candidateData = input.candidate;
  const stableData = input.stableSubstep as Data;
  const source = sourceWorkflow(input.sourceWorkflow, codes);
  if (source) {
    if (candidateData.sourceRef && !equal(candidateData.sourceRef, source.workflowRef)) codes.add("SOURCE_STEP_MISMATCH");
    if (candidateData.sourceSubgraphDigest !== stableData.subgraphDigest) codes.add("SOURCE_STEP_MISMATCH");
  }
  stable(input.stableSubstep, source ?? ({} as SourceWorkflowSnapshotV1), codes);
  if (source && !equal(candidateData.sourceStepIds, stableData.stepIds)) codes.add("SOURCE_STEP_MISMATCH");
  contract(input.inputContract, candidateData, "inputSchemaRef", codes, "TYPED_INPUT_CONTRACT_INVALID");
  contract(input.outputContract, candidateData, "outputSchemaRef", codes, "TYPED_OUTPUT_CONTRACT_INVALID");
  logic(input.logicContract, candidateData, codes);
  errors(input.errorContract, candidateData, codes);
  evidence(input.evidenceLinks, candidateData, stableData, codes);
  if (source) dependencyLinks(input.dependencyLinks, candidateData, source, codes); else codes.add("DEPENDENCY_LINK_MISMATCH");
  receipts(input.historicalReceipts, candidateData, codes);
  verification(input.verification, candidateData, codes);
  rollback(input.rollback, candidateData, codes);
  boundary(input.boundary, candidateData, codes);
  p20(input.p20Parity, candidateData, codes);
  const maturity = isRecord(candidateData["maturity"]) ? candidateData["maturity"] : null;
  const promotionRefs = candidateData["promotionReceiptRefs"];
  if (maturity?.["level"] !== F_MATURITY_LEVELS_V1[6] || candidateData["eligibilityReceiptRef"] === null) codes.add("ELIGIBILITY_RECEIPT_REQUIRED");
  if (!isArray(promotionRefs) || promotionRefs.length !== 0) codes.add("CANDIDATE_REJECTED");
  if (codes.size > 0 || candidate === undefined) return result(codes);
  return result(codes, candidate);
}

/** Descriptive aliases used by extraction and eligibility integrations. */
export const validateFunctionExtractionEligibilityV1 = validateFunctionCandidateEligibilityV1;
export const evaluateFunctionCandidateEligibilityV1 = validateFunctionCandidateEligibilityV1;
