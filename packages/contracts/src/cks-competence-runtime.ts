import { createHash } from "node:crypto";
import { canonicalJson } from "./canonical-json.js";
import { APPLICABILITY_DIMENSIONS_V1, type ApplicabilityScopeV1 } from "./knowledge-quality.js";

/**
 * CKS-04 (issue #284) no-fine-tune competence runtime protocol.
 *
 * Closed, typed, data-only. It represents the six competence-response states
 * and permits only bounded `pansphaira.cks/knowledge-query/v1` tool calls that
 * return `pansphaira.cks/evidence-pack/v1` data. The selected OSS model profile
 * (model, quantization, runtime, prompt, tool and Knowledge versions) is bound
 * verbatim from the authoritative decision receipt, which remains
 * `PROFILE_DECISION_RECORDED_NOT_QUALIFIED`. Nothing here executes a model or
 * claims qualification.
 */

export const COMPETENCE_RUNTIME_SCHEMA_V1 = "pansphaira.cks/competence-runtime/v1" as const;
export const CKS_COMPETENCE_RUNTIME_CONTRACT_ID_V1 = "cks-competence-runtime-contract:psai284-v1" as const;
export const KNOWLEDGE_QUERY_PROTOCOL_V1 = "pansphaira.cks/knowledge-query/v1" as const;
export const EVIDENCE_PACK_PROTOCOL_V1 = "pansphaira.cks/evidence-pack/v1" as const;
export const COMPETENCE_RESPONSE_PROTOCOL_V1 = "pansphaira.cks/competence-response/v1" as const;
export const MODEL_TOOL_CALL_SCHEMA_V1 = "pansphaira.cks/model-tool-call/v1" as const;
export const ACTION_AUTHORITY_CONSTANT = "NONE" as const;
export const EVIDENCE_PACK_INSTRUCTION_ELIGIBILITY =
  "DATA_ONLY_NEVER_INSTRUCTIONS_CAPABILITY_OR_AUTHORITY" as const;

/** The six closed competence-response states. */
export const COMPETENCE_STATES_V1 = [
  "ANSWER_SUPPORTED",
  "NEED_MORE_KNOWLEDGE",
  "KNOWLEDGE_CONFLICT",
  "INSUFFICIENT_EVIDENCE",
  "COMPETENCE_LIMIT",
  "GOVERNED_ACTION_PROPOSAL",
] as const;
export type CompetenceStateV1 = (typeof COMPETENCE_STATES_V1)[number];

/** The closed Knowledge Query reason codes. */
export const KNOWLEDGE_QUERY_REASON_CODES_V1 = [
  "MATERIAL_FACT_MISSING",
  "MATERIAL_RULE_MISSING",
  "MATERIAL_PROCEDURE_MISSING",
  "APPLICABILITY_UNRESOLVED",
  "PRECONDITION_UNRESOLVED",
  "EVIDENCE_COVERAGE_INCOMPLETE",
  "CONFLICT_DIFFERENTIATION_REQUIRED",
] as const;
export type KnowledgeQueryReasonCodeV1 = (typeof KNOWLEDGE_QUERY_REASON_CODES_V1)[number];

/** The closed Evidence Pack statuses. */
export const EVIDENCE_PACK_STATUSES_V1 = [
  "MATCH",
  "NEEDS_CONTEXT",
  "CONFLICT",
  "NO_MATCH",
  "DENIED",
] as const;
export type EvidencePackStatusV1 = (typeof EVIDENCE_PACK_STATUSES_V1)[number];

/** Bounded retrieval limits for a single task. */
export const QUERY_LIMITS_V1 = {
  maximumCallsPerTask: 3,
  maximumResultsPerCall: 6,
  maximumQueryBytes: 512,
  maximumEvidenceBytesPerCall: 12288,
  maximumAggregateEvidenceBytes: 24576,
  networkLocatorFieldsAllowed: false,
  effectFieldsAllowed: false,
} as const;

const sha256 = (value: unknown): string => createHash("sha256").update(canonicalJson(value)).digest("hex");

const record = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === "object" && !Array.isArray(value) && Object.getPrototypeOf(value) === Object.prototype;

const exact = (value: unknown, keys: readonly string[]): value is Record<string, unknown> =>
  record(value) && canonicalJson(Object.keys(value).sort()) === canonicalJson([...keys].sort());

const isDigest = (value: unknown): value is string => typeof value === "string" && /^[a-f0-9]{64}$/.test(value);
const isKindId = (value: unknown): value is string => typeof value === "string" && /^[A-Z][A-Z0-9_]{1,47}$/.test(value);
const isPreconditionId = (value: unknown): value is string => typeof value === "string" && /^[a-z][a-z0-9-]{1,63}$/.test(value);
const isRequestId = (value: unknown): value is string => typeof value === "string" && /^KQ-0[1-3]$/.test(value);
const isBoundedText = (value: unknown, maxBytes: number): value is string =>
  typeof value === "string" && value.length > 0 && Buffer.byteLength(value, "utf8") <= maxBytes && !/[\u0000-\u001f]/.test(value);
const isNullableBoundedText = (value: unknown, maxBytes: number): value is string | null =>
  value === null || isBoundedText(value, maxBytes);
const isUniqueStrings = (value: unknown, predicate: (item: unknown) => boolean, min: number, max: number): value is string[] =>
  Array.isArray(value) && value.length >= min && value.length <= max && value.every(predicate) && new Set(value).size === value.length;
const isInt = (value: unknown, min: number, max: number): value is number =>
  Number.isSafeInteger(value) && (value as number) >= min && (value as number) <= max;
const isCanonicalizable = (value: unknown): boolean => {
  try {
    canonicalJson(value);
    return true;
  } catch {
    return false;
  }
};
const deepEquals = (a: unknown, b: unknown): boolean => canonicalJson(a) === canonicalJson(b);

const validateApplicability = (value: unknown): value is ApplicabilityScopeV1 => {
  if (!exact(value, APPLICABILITY_DIMENSIONS_V1)) return false;
  return APPLICABILITY_DIMENSIONS_V1.every((dimension) => {
    const item = value[dimension];
    if (!exact(item, ["state", "values", "provenance"]) || !["VALUE", "UNKNOWN", "NOT_PROVIDED", "NOT_APPLICABLE", "EXPLICITLY_UNRESTRICTED"].includes(item.state as string)) return false;
    const values = item.values;
    if (!isUniqueStrings(values, (entry) => isBoundedText(entry, 160), 0, 16)) return false;
    if (item.state === "VALUE") return values.length > 0 && ["DECLARED", "EVIDENCE_DERIVED", "INFERRED"].includes(item.provenance as string);
    if (values.length !== 0) return false;
    if (["NOT_APPLICABLE", "EXPLICITLY_UNRESTRICTED"].includes(item.state as string)) return ["DECLARED", "EVIDENCE_DERIVED"].includes(item.provenance as string);
    return item.state === "UNKNOWN" ? item.provenance === null || item.provenance === "INFERRED" : item.provenance === null;
  });
};

const validateValidity = (value: unknown): boolean =>
  exact(value, ["state", "validFromMs", "validUntilMs"])
  && ["VALID", "EXPIRED", "NOT_YET_VALID"].includes(value.state as string)
  && isInt(value.validFromMs, 0, Number.MAX_SAFE_INTEGER)
  && (value.validUntilMs === null || isInt(value.validUntilMs, 0, Number.MAX_SAFE_INTEGER))
  && (value.validUntilMs === null || (value.validUntilMs as number) >= (value.validFromMs as number));

const validateSupersession = (value: unknown): boolean =>
  exact(value, ["state", "supersededBy"])
  && ["CURRENT", "SUPERSEDED"].includes(value.state as string)
  && (value.supersededBy === null || isBoundedText(value.supersededBy, 96))
  && ((value.state === "CURRENT" && value.supersededBy === null) || (value.state === "SUPERSEDED" && value.supersededBy !== null));

// ---------------------------------------------------------------------------
// Typed protocol objects
// ---------------------------------------------------------------------------

/** A bounded, typed Knowledge Query tool call emitted by the model. */
export interface KnowledgeQueryRequestV1 {
  readonly schemaVersion: typeof KNOWLEDGE_QUERY_PROTOCOL_V1;
  readonly requestId: string;
  readonly taskId: string;
  readonly knowledgeEditionId: string;
  readonly knowledgeEditionVersion: string;
  readonly knowledgeEditionDigest: string;
  readonly needKinds: readonly string[];
  readonly queryText: string;
  readonly applicability: ApplicabilityScopeV1;
  readonly requiredPreconditions: readonly string[];
  readonly maxResults: number;
  readonly maxEvidenceBytes: number;
  readonly reasonCode: KnowledgeQueryReasonCodeV1;
  readonly requestDigest: string;
}

/** A data-only Evidence Pack result returned to the model. */
export interface EvidencePackResultV1 {
  readonly schemaVersion: typeof EVIDENCE_PACK_PROTOCOL_V1;
  readonly packId: string;
  readonly status: EvidencePackStatusV1;
  readonly request: { readonly requestId: string; readonly requestDigest: string };
  readonly task: { readonly taskId: string; readonly scopeDigest: string };
  readonly knowledgeEdition: { readonly editionId: string; readonly version: string; readonly digest: string };
  readonly retrievalConfiguration: { readonly configurationId: string; readonly version: string; readonly digest: string };
  readonly claims: readonly {
    readonly claimId: string;
    readonly knowledgeObjectId: string;
    readonly version: string;
    readonly digest: string;
    readonly sourcePassageIds: readonly string[];
  }[];
  readonly applicability: {
    readonly applicability: ApplicabilityScopeV1;
    readonly preconditions: readonly string[];
    readonly exclusions: readonly string[];
    readonly validity: { readonly state: "VALID" | "EXPIRED" | "NOT_YET_VALID"; readonly validFromMs: number; readonly validUntilMs: number | null };
    readonly supersession: { readonly state: "CURRENT" | "SUPERSEDED"; readonly supersededBy: string | null };
  };
  readonly evidence: {
    readonly positive: readonly { readonly id: string; readonly digest: string }[];
    readonly negative: readonly { readonly id: string; readonly digest: string }[];
  };
  readonly conflicts: readonly { readonly conflictId: string; readonly claimIds: readonly string[] }[];
  readonly missingKnowledge: readonly { readonly needId: string; readonly reasonCode: KnowledgeQueryReasonCodeV1 }[];
  readonly instructionEligibility: typeof EVIDENCE_PACK_INSTRUCTION_ELIGIBILITY;
  readonly evidenceBytes: number;
  readonly packDigest: string;
}

/** The only callable model tool: a bounded Knowledge Query request. */
export interface CksModelToolCallV1 {
  readonly schemaVersion: typeof MODEL_TOOL_CALL_SCHEMA_V1;
  readonly toolName: "cks_knowledge_query";
  readonly arguments: KnowledgeQueryRequestV1;
}

/** The typed final competence response emitted by the model. */
export interface CompetenceResponseV1 {
  readonly schemaVersion: typeof COMPETENCE_RESPONSE_PROTOCOL_V1;
  readonly state: CompetenceStateV1;
  readonly taskId: string;
  readonly answer: string | null;
  readonly materialClaims: readonly { readonly claimId: string; readonly text: string; readonly evidenceIds: readonly string[] }[];
  readonly procedureSteps: readonly { readonly stepId: string; readonly text: string; readonly order: number; readonly evidenceIds: readonly string[] }[];
  readonly preconditionChecks: readonly { readonly preconditionId: string; readonly result: "SATISFIED" | "NOT_SATISFIED" | "UNKNOWN" }[];
  readonly exclusionChecks: readonly { readonly exclusionId: string; readonly matched: boolean }[];
  readonly conflicts: readonly { readonly conflictId: string; readonly claimIds: readonly string[] }[];
  readonly missingKnowledge: readonly { readonly needId: string; readonly reasonCode: KnowledgeQueryReasonCodeV1 }[];
  readonly escalation: null | { readonly required: true; readonly target: string };
  readonly actionAuthority: typeof ACTION_AUTHORITY_CONSTANT;
  readonly responseDigest: string;
}

// ---------------------------------------------------------------------------
// Runtime contract bindings (bound verbatim from the decision receipt)
// ---------------------------------------------------------------------------

export interface CksModelBindingV1 {
  readonly publisher: string;
  readonly name: string;
  readonly baseModelId: string;
  readonly artifactRepository: string;
  readonly artifactRevision: string;
  readonly artifactFile: string;
  readonly artifactFormat: string;
  readonly artifactArchitecture: string;
  readonly artifactSha256: string;
  readonly artifactSizeBytes: number;
  readonly artifactSourceUrl: string;
  readonly mutableAliasesForbidden: readonly string[];
  readonly localArtifactVerificationRequired: boolean;
  readonly artifactAcquiredByThisDecision: boolean;
}

export interface CksQuantizationBindingV1 {
  readonly scheme: string;
  readonly source: string;
  readonly conversionOrRequantizationAllowed: false;
  readonly quantizationEquivalenceClaimed: false;
  readonly reproducibleConversionClaimed: false;
}

export interface CksRuntimeBindingV1 {
  readonly implementation: string;
  readonly releaseTag: string;
  readonly sourceCommit: string;
  readonly executable: string;
  readonly distributionAsset: string;
  readonly distributionAssetUrl: string;
  readonly distributionAssetSha256: string;
  readonly distributionAssetSizeBytes: number;
  readonly backend: string;
  readonly gpuLayers: number;
  readonly parallelSequences: number;
  readonly threads: number;
  readonly batchSize: number;
  readonly microBatchSize: number;
  readonly memoryMap: boolean;
  readonly memoryLock: boolean;
  readonly embeddedChatTemplateRequired: true;
  readonly chatTemplateOverrideAllowed: false;
  readonly runtimeArchiveAcquiredByThisDecision: false;
  readonly runManifestMustBindExtractedExecutableSha256: true;
  readonly runManifestMustCaptureVersionReadback: true;
}

export interface CksContextBindingV1 {
  readonly runtimeContextTokens: number;
  readonly modelMetadataContextTokensObserved: number;
  readonly maximumGeneratedTokens: number;
  readonly tokenBudget: {
    readonly systemPromptMaximum: number;
    readonly toolDefinitionsMaximum: number;
    readonly taskAndConversationMaximum: number;
    readonly aggregateEvidencePackMaximum: number;
    readonly generatedOutputMaximum: number;
    readonly safetyReserve: number;
    readonly sum: number;
  };
  readonly truncationPolicy: string;
  readonly onBudgetExceeded: string;
}

export interface CksDecodingBindingV1 {
  readonly mode: string;
  readonly temperature: number;
  readonly topK: number;
  readonly topP: number;
  readonly minP: number;
  readonly typicalP: number;
  readonly repeatPenalty: number;
  readonly repeatLastN: number;
  readonly presencePenalty: number;
  readonly frequencyPenalty: number;
  readonly mirostat: number;
  readonly seed: number;
  readonly maximumGeneratedTokens: number;
  readonly stopSequences: readonly string[];
  readonly grammarConstraint: string;
  readonly sameHardwareByteRepeatCount: number;
  readonly byteIdenticalRepeatRequired: true;
}

export interface CksPromptBindingV1 {
  readonly promptId: string;
  readonly promptVersion: string;
  readonly encoding: "UTF-8";
  readonly normalization: "NONE";
  readonly trailingLineFeed: false;
  readonly assemblyVersion: string;
  readonly chatTemplateSource: string;
  readonly sha256: string;
}

export interface CksQueryToolProtocolV1 {
  readonly toolName: string;
  readonly protocolId: typeof KNOWLEDGE_QUERY_PROTOCOL_V1;
  readonly protocolVersion: "1";
  readonly contractStatus: string;
  readonly requiredArguments: Record<string, string>;
  readonly reasonCodes: readonly KnowledgeQueryReasonCodeV1[];
  readonly limits: {
    readonly maximumCallsPerTask: number;
    readonly maximumResultsPerCall: number;
    readonly maximumQueryBytes: number;
    readonly maximumEvidenceBytesPerCall: number;
    readonly maximumAggregateEvidenceBytes: number;
    readonly networkLocatorFieldsAllowed: false;
    readonly effectFieldsAllowed: false;
  };
}

export interface CksEvidencePackProtocolV1 {
  readonly protocolId: typeof EVIDENCE_PACK_PROTOCOL_V1;
  readonly protocolVersion: "1";
  readonly contractStatus: string;
  readonly requiredBindings: readonly string[];
  readonly statuses: readonly EvidencePackStatusV1[];
  readonly instructionEligibility: typeof EVIDENCE_PACK_INSTRUCTION_ELIGIBILITY;
}

export interface CksFinalResponseProtocolV1 {
  readonly protocolId: typeof COMPETENCE_RESPONSE_PROTOCOL_V1;
  readonly protocolVersion: "1";
  readonly contractStatus: string;
  readonly requiredFields: readonly string[];
  readonly states: readonly CompetenceStateV1[];
  readonly actionAuthorityConstant: typeof ACTION_AUTHORITY_CONSTANT;
  readonly unknownFields: "DENY";
}

export interface CksToolProtocolsV1 {
  readonly catalogueMode: "CLOSED_EXACTLY_ONE_MODEL_CALLABLE_TOOL";
  readonly unknownToolsOrFields: "DENY";
  readonly wireFormat: string;
  readonly queryTool: CksQueryToolProtocolV1;
  readonly evidencePackResult: CksEvidencePackProtocolV1;
  readonly finalResponse: CksFinalResponseProtocolV1;
}

export interface CksKnowledgeBindingsV1 {
  readonly contractVersions: Record<string, string>;
  readonly contractArtifactPolicy: string;
  readonly editionPolicy: string;
  readonly requiredPerCaseBindings: readonly string[];
  readonly allowedVisibilityClasses: readonly string[];
  readonly onlineFallback: "FORBIDDEN";
  readonly mixedGeneration: "FORBIDDEN";
  readonly missingOrConflictingMaterialKnowledge: string;
  readonly knowledgeGrantsCapabilityOrAuthority: false;
}

export interface CksInteractionPolicyV1 {
  readonly informationNeedDetectionRequired: true;
  readonly applicabilityBeforeRanking: true;
  readonly preconditionsMustBeExplicitlyChecked: true;
  readonly exclusionsMustBeExplicitlyChecked: true;
  readonly parametricKnowledgePrecedence: string;
  readonly conflictResolution: string;
  readonly claimCoverageRule: string;
  readonly procedureCoverageRule: string;
  readonly missingKnowledgeRule: string;
  readonly conflictRule: string;
  readonly competenceRule: string;
  readonly toolOutputsInstructionEligible: false;
  readonly modelOutputAuthority: string;
}

export interface CksResourceLimitsV1 {
  readonly maximumWallSecondsPerModelTurn: number;
  readonly maximumWallSecondsPerCase: number;
  readonly maximumWallSecondsPerQualificationRun: number;
  readonly maximumRetrievalCallsPerTask: number;
  readonly maximumAggregateEvidenceBytesPerTask: number;
  readonly maximumGeneratedTokensPerTurn: number;
  readonly maximumMaterialClaimsPerResponse: number;
  readonly maximumProcedureStepsPerResponse: number;
  readonly maximumResidentBytes: number;
  readonly performanceClaim: string;
}

export interface CksCompetenceRuntimeContractV1 {
  readonly schemaVersion: typeof COMPETENCE_RUNTIME_SCHEMA_V1;
  readonly contractId: typeof CKS_COMPETENCE_RUNTIME_CONTRACT_ID_V1;
  readonly receiptSource: { readonly receiptPath: string; readonly receiptDigest: string; readonly profileCoreDigest: string; readonly decisionId: string };
  readonly profile: {
    readonly profileSchemaVersion: string;
    readonly profileId: string;
    readonly profileRevision: number;
    readonly intendedUse: string;
    readonly selectionStatus: "SELECTED_NOT_QUALIFIED";
  };
  readonly model: CksModelBindingV1;
  readonly quantization: CksQuantizationBindingV1;
  readonly runtime: CksRuntimeBindingV1;
  readonly context: CksContextBindingV1;
  readonly decoding: CksDecodingBindingV1;
  readonly prompt: CksPromptBindingV1;
  readonly toolProtocols: CksToolProtocolsV1;
  readonly knowledgeBindings: CksKnowledgeBindingsV1;
  readonly interactionPolicy: CksInteractionPolicyV1;
  readonly resourceLimits: CksResourceLimitsV1;
  readonly states: readonly CompetenceStateV1[];
  readonly contractDigest: string;
}

// ---------------------------------------------------------------------------
// Digest functions
// ---------------------------------------------------------------------------

export function knowledgeQueryRequestDigestV1(value: Omit<KnowledgeQueryRequestV1, "requestDigest"> | Record<string, unknown>): string {
  return sha256(Object.fromEntries(Object.entries(value).filter(([key]) => key !== "requestDigest")));
}

export function evidencePackDigestV1(value: Omit<EvidencePackResultV1, "packDigest"> | Record<string, unknown>): string {
  return sha256(Object.fromEntries(Object.entries(value).filter(([key]) => key !== "packDigest")));
}

export function competenceResponseDigestV1(value: Omit<CompetenceResponseV1, "responseDigest"> | Record<string, unknown>): string {
  return sha256(Object.fromEntries(Object.entries(value).filter(([key]) => key !== "responseDigest")));
}

export function cksCompetenceRuntimeContractDigestV1(value: Omit<CksCompetenceRuntimeContractV1, "contractDigest"> | Record<string, unknown>): string {
  return sha256(Object.fromEntries(Object.entries(value).filter(([key]) => key !== "contractDigest")));
}

// ---------------------------------------------------------------------------
// Validators
// ---------------------------------------------------------------------------

export function validateKnowledgeQueryRequestV1(value: unknown): value is KnowledgeQueryRequestV1 {
  if (!exact(value, ["schemaVersion", "requestId", "taskId", "knowledgeEditionId", "knowledgeEditionVersion", "knowledgeEditionDigest", "needKinds", "queryText", "applicability", "requiredPreconditions", "maxResults", "maxEvidenceBytes", "reasonCode", "requestDigest"])) return false;
  if (value.schemaVersion !== KNOWLEDGE_QUERY_PROTOCOL_V1) return false;
  if (!isRequestId(value.requestId)) return false;
  if (!isBoundedText(value.taskId, 96)) return false;
  if (!isBoundedText(value.knowledgeEditionId, 96)) return false;
  if (!isBoundedText(value.knowledgeEditionVersion, 32)) return false;
  if (!isDigest(value.knowledgeEditionDigest)) return false;
  if (!isUniqueStrings(value.needKinds, isKindId, 1, 4)) return false;
  if (!isBoundedText(value.queryText, QUERY_LIMITS_V1.maximumQueryBytes)) return false;
  if (!validateApplicability(value.applicability)) return false;
  if (!isUniqueStrings(value.requiredPreconditions, isPreconditionId, 0, 16)) return false;
  if (!isInt(value.maxResults, 1, QUERY_LIMITS_V1.maximumResultsPerCall)) return false;
  if (!isInt(value.maxEvidenceBytes, 1, QUERY_LIMITS_V1.maximumEvidenceBytesPerCall)) return false;
  if (!KNOWLEDGE_QUERY_REASON_CODES_V1.includes(value.reasonCode as KnowledgeQueryReasonCodeV1)) return false;
  if (!isDigest(value.requestDigest)) return false;
  return knowledgeQueryRequestDigestV1(value) === value.requestDigest;
}

export function validateCksModelToolCallV1(value: unknown): value is CksModelToolCallV1 {
  return exact(value, ["schemaVersion", "toolName", "arguments"])
    && value.schemaVersion === MODEL_TOOL_CALL_SCHEMA_V1
    && value.toolName === "cks_knowledge_query"
    && validateKnowledgeQueryRequestV1(value.arguments);
}

export function validateEvidencePackResultV1(value: unknown): value is EvidencePackResultV1 {
  if (!exact(value, ["schemaVersion", "packId", "status", "request", "task", "knowledgeEdition", "retrievalConfiguration", "claims", "applicability", "evidence", "conflicts", "missingKnowledge", "instructionEligibility", "evidenceBytes", "packDigest"])) return false;
  if (value.schemaVersion !== EVIDENCE_PACK_PROTOCOL_V1) return false;
  if (!isBoundedText(value.packId, 96)) return false;
  if (!EVIDENCE_PACK_STATUSES_V1.includes(value.status as EvidencePackStatusV1)) return false;
  if (!exact(value.request, ["requestId", "requestDigest"]) || !isRequestId(value.request.requestId) || !isDigest(value.request.requestDigest)) return false;
  if (!exact(value.task, ["taskId", "scopeDigest"]) || !isBoundedText(value.task.taskId, 96) || !isDigest(value.task.scopeDigest)) return false;
  if (!exact(value.knowledgeEdition, ["editionId", "version", "digest"]) || !isBoundedText(value.knowledgeEdition.editionId, 96) || !isBoundedText(value.knowledgeEdition.version, 32) || !isDigest(value.knowledgeEdition.digest)) return false;
  if (!exact(value.retrievalConfiguration, ["configurationId", "version", "digest"]) || !isBoundedText(value.retrievalConfiguration.configurationId, 96) || !isBoundedText(value.retrievalConfiguration.version, 32) || !isDigest(value.retrievalConfiguration.digest)) return false;
  if (!Array.isArray(value.claims) || !value.claims.every((claim) => exact(claim, ["claimId", "knowledgeObjectId", "version", "digest", "sourcePassageIds"]) && isBoundedText(claim.claimId, 96) && isBoundedText(claim.knowledgeObjectId, 96) && isBoundedText(claim.version, 32) && isDigest(claim.digest) && isUniqueStrings(claim.sourcePassageIds, (item) => isBoundedText(item, 96), 1, 32))) return false;
  if (!exact(value.applicability, ["applicability", "preconditions", "exclusions", "validity", "supersession"]) || !validateApplicability(value.applicability.applicability) || !isUniqueStrings(value.applicability.preconditions, isPreconditionId, 0, 16) || !isUniqueStrings(value.applicability.exclusions, isPreconditionId, 0, 16) || !validateValidity(value.applicability.validity) || !validateSupersession(value.applicability.supersession)) return false;
  if (!exact(value.evidence, ["positive", "negative"])) return false;
  const evidenceItems = (items: unknown): boolean => Array.isArray(items) && items.every((item) => exact(item, ["id", "digest"]) && isBoundedText(item.id, 96) && isDigest(item.digest));
  if (!evidenceItems(value.evidence.positive) || !evidenceItems(value.evidence.negative)) return false;
  if (!Array.isArray(value.conflicts) || !value.conflicts.every((conflict) => exact(conflict, ["conflictId", "claimIds"]) && isBoundedText(conflict.conflictId, 96) && isUniqueStrings(conflict.claimIds, (item) => isBoundedText(item, 96), 1, 32))) return false;
  if (!Array.isArray(value.missingKnowledge) || !value.missingKnowledge.every((item) => exact(item, ["needId", "reasonCode"]) && isBoundedText(item.needId, 96) && KNOWLEDGE_QUERY_REASON_CODES_V1.includes(item.reasonCode as KnowledgeQueryReasonCodeV1))) return false;
  if (value.instructionEligibility !== EVIDENCE_PACK_INSTRUCTION_ELIGIBILITY) return false;
  if (!isInt(value.evidenceBytes, 0, QUERY_LIMITS_V1.maximumEvidenceBytesPerCall)) return false;
  if (!isDigest(value.packDigest)) return false;
  return evidencePackDigestV1(value) === value.packDigest;
}

export function validateCompetenceResponseV1(value: unknown): value is CompetenceResponseV1 {
  if (!exact(value, ["schemaVersion", "state", "taskId", "answer", "materialClaims", "procedureSteps", "preconditionChecks", "exclusionChecks", "conflicts", "missingKnowledge", "escalation", "actionAuthority", "responseDigest"])) return false;
  if (value.schemaVersion !== COMPETENCE_RESPONSE_PROTOCOL_V1) return false;
  if (!COMPETENCE_STATES_V1.includes(value.state as CompetenceStateV1)) return false;
  if (!isBoundedText(value.taskId, 96)) return false;
  if (!isNullableBoundedText(value.answer, 8192)) return false;
  if (!Array.isArray(value.materialClaims) || !value.materialClaims.every((claim) => exact(claim, ["claimId", "text", "evidenceIds"]) && isBoundedText(claim.claimId, 96) && isBoundedText(claim.text, 2048) && isUniqueStrings(claim.evidenceIds, (item) => isBoundedText(item, 96), 0, 32))) return false;
  if (!Array.isArray(value.procedureSteps) || !value.procedureSteps.every((step) => exact(step, ["stepId", "text", "order", "evidenceIds"]) && isBoundedText(step.stepId, 96) && isBoundedText(step.text, 2048) && isInt(step.order, 0, 1024) && isUniqueStrings(step.evidenceIds, (item) => isBoundedText(item, 96), 0, 32))) return false;
  if (!Array.isArray(value.preconditionChecks) || !value.preconditionChecks.every((check) => exact(check, ["preconditionId", "result"]) && isPreconditionId(check.preconditionId) && ["SATISFIED", "NOT_SATISFIED", "UNKNOWN"].includes(check.result as string))) return false;
  if (!Array.isArray(value.exclusionChecks) || !value.exclusionChecks.every((check) => exact(check, ["exclusionId", "matched"]) && isPreconditionId(check.exclusionId) && typeof check.matched === "boolean")) return false;
  if (!Array.isArray(value.conflicts) || !value.conflicts.every((conflict) => exact(conflict, ["conflictId", "claimIds"]) && isBoundedText(conflict.conflictId, 96) && isUniqueStrings(conflict.claimIds, (item) => isBoundedText(item, 96), 1, 32))) return false;
  if (!Array.isArray(value.missingKnowledge) || !value.missingKnowledge.every((item) => exact(item, ["needId", "reasonCode"]) && isBoundedText(item.needId, 96) && KNOWLEDGE_QUERY_REASON_CODES_V1.includes(item.reasonCode as KnowledgeQueryReasonCodeV1))) return false;
  if (!(value.escalation === null || (exact(value.escalation, ["required", "target"]) && value.escalation.required === true && isBoundedText(value.escalation.target, 96)))) return false;
  if (value.actionAuthority !== ACTION_AUTHORITY_CONSTANT) return false;
  if (!isDigest(value.responseDigest)) return false;
  // State-specific closed invariants.
  if (value.state === "ANSWER_SUPPORTED" && (value.answer === null || value.conflicts.length > 0 || value.missingKnowledge.length > 0 || value.escalation !== null || value.preconditionChecks.some((check) => check.result !== "SATISFIED") || value.exclusionChecks.some((check) => check.matched) || value.materialClaims.some((claim) => claim.evidenceIds.length === 0) || value.procedureSteps.some((step) => step.evidenceIds.length === 0))) return false;
  if ((value.state === "NEED_MORE_KNOWLEDGE" || value.state === "INSUFFICIENT_EVIDENCE") && (value.answer !== null || value.missingKnowledge.length === 0)) return false;
  if (value.state === "KNOWLEDGE_CONFLICT" && (value.answer !== null || value.conflicts.length === 0)) return false;
  if (value.state === "COMPETENCE_LIMIT" && (value.answer !== null || (value.escalation === null || value.escalation.required !== true))) return false;
  if (value.state === "GOVERNED_ACTION_PROPOSAL" && value.answer === null) return false;
  return competenceResponseDigestV1(value) === value.responseDigest;
}

// --- Runtime contract section validators ---

function validateModelBinding(value: unknown): value is CksModelBindingV1 {
  if (!exact(value, ["publisher", "name", "baseModelId", "artifactRepository", "artifactRevision", "artifactFile", "artifactFormat", "artifactArchitecture", "artifactSha256", "artifactSizeBytes", "artifactSourceUrl", "mutableAliasesForbidden", "localArtifactVerificationRequired", "artifactAcquiredByThisDecision"])) return false;
  if (!isBoundedText(value.publisher, 64) || !isBoundedText(value.name, 64) || !isBoundedText(value.baseModelId, 96) || !isBoundedText(value.artifactRepository, 96) || !isBoundedText(value.artifactRevision, 64) || !isBoundedText(value.artifactFile, 96) || !isBoundedText(value.artifactFormat, 16) || !isBoundedText(value.artifactArchitecture, 32) || !isBoundedText(value.artifactSourceUrl, 512)) return false;
  if (!isDigest(value.artifactSha256) || !isInt(value.artifactSizeBytes, 1, Number.MAX_SAFE_INTEGER)) return false;
  if (!isUniqueStrings(value.mutableAliasesForbidden, (item) => isBoundedText(item, 32), 0, 8)) return false;
  if (typeof value.localArtifactVerificationRequired !== "boolean" || typeof value.artifactAcquiredByThisDecision !== "boolean") return false;
  return true;
}

function validateQuantizationBinding(value: unknown): value is CksQuantizationBindingV1 {
  if (!exact(value, ["scheme", "source", "conversionOrRequantizationAllowed", "quantizationEquivalenceClaimed", "reproducibleConversionClaimed"])) return false;
  if (!isBoundedText(value.scheme, 32) || !isBoundedText(value.source, 64)) return false;
  return value.conversionOrRequantizationAllowed === false && value.quantizationEquivalenceClaimed === false && value.reproducibleConversionClaimed === false;
}

function validateRuntimeBinding(value: unknown): value is CksRuntimeBindingV1 {
  if (!exact(value, ["implementation", "releaseTag", "sourceCommit", "executable", "distributionAsset", "distributionAssetUrl", "distributionAssetSha256", "distributionAssetSizeBytes", "backend", "gpuLayers", "parallelSequences", "threads", "batchSize", "microBatchSize", "memoryMap", "memoryLock", "embeddedChatTemplateRequired", "chatTemplateOverrideAllowed", "runtimeArchiveAcquiredByThisDecision", "runManifestMustBindExtractedExecutableSha256", "runManifestMustCaptureVersionReadback"])) return false;
  if (!isBoundedText(value.implementation, 32) || !isBoundedText(value.releaseTag, 32) || !isBoundedText(value.sourceCommit, 64) || !isBoundedText(value.executable, 32) || !isBoundedText(value.distributionAsset, 96) || !isBoundedText(value.distributionAssetUrl, 512) || !isBoundedText(value.backend, 16)) return false;
  if (!isDigest(value.distributionAssetSha256) || !isInt(value.distributionAssetSizeBytes, 1, Number.MAX_SAFE_INTEGER)) return false;
  if (!isInt(value.gpuLayers, 0, 0) || !isInt(value.parallelSequences, 1, 1) || !isInt(value.threads, 1, 64) || !isInt(value.batchSize, 1, 1048576) || !isInt(value.microBatchSize, 1, 1048576)) return false;
  if (typeof value.memoryMap !== "boolean" || typeof value.memoryLock !== "boolean") return false;
  return value.embeddedChatTemplateRequired === true && value.chatTemplateOverrideAllowed === false && value.runtimeArchiveAcquiredByThisDecision === false && value.runManifestMustBindExtractedExecutableSha256 === true && value.runManifestMustCaptureVersionReadback === true;
}

function validateContextBinding(value: unknown): value is CksContextBindingV1 {
  if (!exact(value, ["runtimeContextTokens", "modelMetadataContextTokensObserved", "maximumGeneratedTokens", "tokenBudget", "truncationPolicy", "onBudgetExceeded"])) return false;
  if (!isInt(value.runtimeContextTokens, 1, 1048576) || !isInt(value.modelMetadataContextTokensObserved, 1, 1048576) || !isInt(value.maximumGeneratedTokens, 1, 1048576)) return false;
  if (!exact(value.tokenBudget, ["systemPromptMaximum", "toolDefinitionsMaximum", "taskAndConversationMaximum", "aggregateEvidencePackMaximum", "generatedOutputMaximum", "safetyReserve", "sum"])) return false;
  const budget = value.tokenBudget;
  if (!["systemPromptMaximum", "toolDefinitionsMaximum", "taskAndConversationMaximum", "aggregateEvidencePackMaximum", "generatedOutputMaximum", "safetyReserve"].every((key) => isInt(budget[key as "sum"], 1, 1048576))) return false;
  const parts = (["systemPromptMaximum", "toolDefinitionsMaximum", "taskAndConversationMaximum", "aggregateEvidencePackMaximum", "generatedOutputMaximum", "safetyReserve"] as const).reduce((total, key) => total + (budget[key] as number), 0);
  if (!isInt(budget.sum, 1, 1048576) || parts !== (budget.sum as number)) return false;
  if (!isBoundedText(value.truncationPolicy, 512) || !isBoundedText(value.onBudgetExceeded, 128)) return false;
  return true;
}

function validateDecodingBinding(value: unknown): value is CksDecodingBindingV1 {
  if (!exact(value, ["mode", "temperature", "topK", "topP", "minP", "typicalP", "repeatPenalty", "repeatLastN", "presencePenalty", "frequencyPenalty", "mirostat", "seed", "maximumGeneratedTokens", "stopSequences", "grammarConstraint", "sameHardwareByteRepeatCount", "byteIdenticalRepeatRequired"])) return false;
  if (!isBoundedText(value.mode, 32) || !isBoundedText(value.grammarConstraint, 256)) return false;
  for (const key of ["temperature", "topP", "minP", "typicalP", "repeatPenalty", "presencePenalty", "frequencyPenalty"] as const) {
    const num = value[key];
    if (typeof num !== "number" || !Number.isFinite(num) || num < 0 || num > 2) return false;
  }
  if (!isInt(value.topK, 0, 1024) || !isInt(value.repeatLastN, 0, 1024) || !isInt(value.mirostat, 0, 2) || !isInt(value.seed, 0, Number.MAX_SAFE_INTEGER) || !isInt(value.maximumGeneratedTokens, 1, 1048576)) return false;
  if (!isUniqueStrings(value.stopSequences, (item) => isBoundedText(item, 64), 0, 8)) return false;
  if (!isInt(value.sameHardwareByteRepeatCount, 1, 8)) return false;
  return value.byteIdenticalRepeatRequired === true;
}

function validatePromptBinding(value: unknown): value is CksPromptBindingV1 {
  if (!exact(value, ["promptId", "promptVersion", "encoding", "normalization", "trailingLineFeed", "assemblyVersion", "chatTemplateSource", "sha256"])) return false;
  if (!isBoundedText(value.promptId, 96) || !isBoundedText(value.promptVersion, 16) || !isBoundedText(value.assemblyVersion, 128) || !isBoundedText(value.chatTemplateSource, 128)) return false;
  if (!isDigest(value.sha256)) return false;
  return value.encoding === "UTF-8" && value.normalization === "NONE" && value.trailingLineFeed === false;
}

function validateQueryToolProtocol(value: unknown): value is CksQueryToolProtocolV1 {
  if (!exact(value, ["toolName", "protocolId", "protocolVersion", "contractStatus", "requiredArguments", "reasonCodes", "limits"])) return false;
  if (!isBoundedText(value.toolName, 64) || value.protocolId !== KNOWLEDGE_QUERY_PROTOCOL_V1 || value.protocolVersion !== "1" || !isBoundedText(value.contractStatus, 256)) return false;
  if (!record(value.requiredArguments) || !Object.values(value.requiredArguments).every((item) => isBoundedText(item, 256))) return false;
  if (!deepEquals([...value.reasonCodes].sort(), [...KNOWLEDGE_QUERY_REASON_CODES_V1].sort()) || value.reasonCodes.length !== KNOWLEDGE_QUERY_REASON_CODES_V1.length) return false;
  if (!exact(value.limits, ["maximumCallsPerTask", "maximumResultsPerCall", "maximumQueryBytes", "maximumEvidenceBytesPerCall", "maximumAggregateEvidenceBytes", "networkLocatorFieldsAllowed", "effectFieldsAllowed"])) return false;
  const limits = value.limits;
  return limits.networkLocatorFieldsAllowed === false && limits.effectFieldsAllowed === false
    && isInt(limits.maximumCallsPerTask, 1, 8) && isInt(limits.maximumResultsPerCall, 1, 32) && isInt(limits.maximumQueryBytes, 1, 8192) && isInt(limits.maximumEvidenceBytesPerCall, 1, 131072) && isInt(limits.maximumAggregateEvidenceBytes, 1, 262144);
}

function validateEvidencePackProtocol(value: unknown): value is CksEvidencePackProtocolV1 {
  if (!exact(value, ["protocolId", "protocolVersion", "contractStatus", "requiredBindings", "statuses", "instructionEligibility"])) return false;
  if (value.protocolId !== EVIDENCE_PACK_PROTOCOL_V1 || value.protocolVersion !== "1" || !isBoundedText(value.contractStatus, 256)) return false;
  if (!isUniqueStrings(value.requiredBindings, (item) => isBoundedText(item, 256), 1, 32)) return false;
  if (!deepEquals([...value.statuses].sort(), [...EVIDENCE_PACK_STATUSES_V1].sort()) || value.statuses.length !== EVIDENCE_PACK_STATUSES_V1.length) return false;
  return value.instructionEligibility === EVIDENCE_PACK_INSTRUCTION_ELIGIBILITY;
}

function validateFinalResponseProtocol(value: unknown): value is CksFinalResponseProtocolV1 {
  if (!exact(value, ["protocolId", "protocolVersion", "contractStatus", "requiredFields", "states", "actionAuthorityConstant", "unknownFields"])) return false;
  if (value.protocolId !== COMPETENCE_RESPONSE_PROTOCOL_V1 || value.protocolVersion !== "1" || !isBoundedText(value.contractStatus, 256)) return false;
  if (!isUniqueStrings(value.requiredFields, (item) => isBoundedText(item, 64), 1, 32)) return false;
  if (!deepEquals([...value.states].sort(), [...COMPETENCE_STATES_V1].sort()) || value.states.length !== COMPETENCE_STATES_V1.length) return false;
  return value.actionAuthorityConstant === ACTION_AUTHORITY_CONSTANT && value.unknownFields === "DENY";
}

function validateToolProtocols(value: unknown): value is CksToolProtocolsV1 {
  if (!exact(value, ["catalogueMode", "unknownToolsOrFields", "wireFormat", "queryTool", "evidencePackResult", "finalResponse"])) return false;
  if (value.catalogueMode !== "CLOSED_EXACTLY_ONE_MODEL_CALLABLE_TOOL" || value.unknownToolsOrFields !== "DENY" || !isBoundedText(value.wireFormat, 128)) return false;
  return validateQueryToolProtocol(value.queryTool) && validateEvidencePackProtocol(value.evidencePackResult) && validateFinalResponseProtocol(value.finalResponse);
}

function validateKnowledgeBindings(value: unknown): value is CksKnowledgeBindingsV1 {
  if (!exact(value, ["contractVersions", "contractArtifactPolicy", "editionPolicy", "requiredPerCaseBindings", "allowedVisibilityClasses", "onlineFallback", "mixedGeneration", "missingOrConflictingMaterialKnowledge", "knowledgeGrantsCapabilityOrAuthority"])) return false;
  if (!record(value.contractVersions) || Object.keys(value.contractVersions).length === 0 || !Object.values(value.contractVersions).every((item) => isBoundedText(item, 128))) return false;
  if (!isBoundedText(value.contractArtifactPolicy, 512) || !isBoundedText(value.editionPolicy, 512)) return false;
  if (!isUniqueStrings(value.requiredPerCaseBindings, (item) => isBoundedText(item, 256), 1, 32)) return false;
  if (!isUniqueStrings(value.allowedVisibilityClasses, (item) => isBoundedText(item, 64), 1, 16)) return false;
  if (!isBoundedText(value.missingOrConflictingMaterialKnowledge, 256)) return false;
  return value.onlineFallback === "FORBIDDEN" && value.mixedGeneration === "FORBIDDEN" && value.knowledgeGrantsCapabilityOrAuthority === false;
}

function validateInteractionPolicy(value: unknown): value is CksInteractionPolicyV1 {
  if (!exact(value, ["informationNeedDetectionRequired", "applicabilityBeforeRanking", "preconditionsMustBeExplicitlyChecked", "exclusionsMustBeExplicitlyChecked", "parametricKnowledgePrecedence", "conflictResolution", "claimCoverageRule", "procedureCoverageRule", "missingKnowledgeRule", "conflictRule", "competenceRule", "toolOutputsInstructionEligible", "modelOutputAuthority"])) return false;
  const bools = ["informationNeedDetectionRequired", "applicabilityBeforeRanking", "preconditionsMustBeExplicitlyChecked", "exclusionsMustBeExplicitlyChecked"] as const;
  if (!bools.every((key) => value[key] === true) || value.toolOutputsInstructionEligible !== false) return false;
  for (const key of ["parametricKnowledgePrecedence", "conflictResolution", "claimCoverageRule", "procedureCoverageRule", "missingKnowledgeRule", "conflictRule", "competenceRule", "modelOutputAuthority"] as const) {
    if (!isBoundedText(value[key], 512)) return false;
  }
  return true;
}

function validateResourceLimits(value: unknown): value is CksResourceLimitsV1 {
  if (!exact(value, ["maximumWallSecondsPerModelTurn", "maximumWallSecondsPerCase", "maximumWallSecondsPerQualificationRun", "maximumRetrievalCallsPerTask", "maximumAggregateEvidenceBytesPerTask", "maximumGeneratedTokensPerTurn", "maximumMaterialClaimsPerResponse", "maximumProcedureStepsPerResponse", "maximumResidentBytes", "performanceClaim"])) return false;
  for (const key of ["maximumWallSecondsPerModelTurn", "maximumWallSecondsPerCase", "maximumWallSecondsPerQualificationRun", "maximumRetrievalCallsPerTask", "maximumAggregateEvidenceBytesPerTask", "maximumGeneratedTokensPerTurn", "maximumMaterialClaimsPerResponse", "maximumProcedureStepsPerResponse", "maximumResidentBytes"] as const) {
    if (!isInt(value[key], 1, Number.MAX_SAFE_INTEGER)) return false;
  }
  return isBoundedText(value.performanceClaim, 512);
}

export function validateCksCompetenceRuntimeContractV1(value: unknown): value is CksCompetenceRuntimeContractV1 {
  if (!exact(value, ["schemaVersion", "contractId", "receiptSource", "profile", "model", "quantization", "runtime", "context", "decoding", "prompt", "toolProtocols", "knowledgeBindings", "interactionPolicy", "resourceLimits", "states", "contractDigest"])) return false;
  if (value.schemaVersion !== COMPETENCE_RUNTIME_SCHEMA_V1 || value.contractId !== CKS_COMPETENCE_RUNTIME_CONTRACT_ID_V1) return false;
  if (!exact(value.receiptSource, ["receiptPath", "receiptDigest", "profileCoreDigest", "decisionId"]) || !isBoundedText(value.receiptSource.receiptPath, 256) || !isDigest(value.receiptSource.receiptDigest) || !isDigest(value.receiptSource.profileCoreDigest) || !isBoundedText(value.receiptSource.decisionId, 96)) return false;
  if (!exact(value.profile, ["profileSchemaVersion", "profileId", "profileRevision", "intendedUse", "selectionStatus"]) || !isBoundedText(value.profile.profileSchemaVersion, 128) || !isBoundedText(value.profile.profileId, 128) || !isInt(value.profile.profileRevision, 1, 1024) || !isBoundedText(value.profile.intendedUse, 128) || value.profile.selectionStatus !== "SELECTED_NOT_QUALIFIED") return false;
  if (!deepEquals(value.states, [...COMPETENCE_STATES_V1])) return false;
  if (!validateModelBinding(value.model) || !validateQuantizationBinding(value.quantization) || !validateRuntimeBinding(value.runtime) || !validateContextBinding(value.context) || !validateDecodingBinding(value.decoding) || !validatePromptBinding(value.prompt) || !validateToolProtocols(value.toolProtocols) || !validateKnowledgeBindings(value.knowledgeBindings) || !validateInteractionPolicy(value.interactionPolicy) || !validateResourceLimits(value.resourceLimits)) return false;
  if (!isDigest(value.contractDigest)) return false;
  return cksCompetenceRuntimeContractDigestV1(value) === value.contractDigest;
}

// ---------------------------------------------------------------------------
// Contract construction (binds the selected profile verbatim from a receipt)
// ---------------------------------------------------------------------------

export interface CompetenceRuntimeContractInputV1 {
  readonly receiptPath: string;
  readonly receiptDigest: string;
  readonly profileCoreDigest: string;
  readonly decisionId: string;
  readonly selectedProfile: Record<string, unknown>;
}

/**
 * Build a data-only runtime contract from an authoritative decision receipt's
 * `selectedProfile`. The prompt is bound by header fields plus `sha256` only;
 * the system-prompt body is deliberately not embedded.
 */
export function buildCksCompetenceRuntimeContractV1(input: CompetenceRuntimeContractInputV1): CksCompetenceRuntimeContractV1 {
  const profile = input.selectedProfile;
  const prompt = profile["prompt"];
  if (!isDigest(input.receiptDigest) || !isDigest(input.profileCoreDigest) || !isBoundedText(input.receiptPath, 256) || !isBoundedText(input.decisionId, 96)) throw new Error("CKS_COMPETENCE_RUNTIME_INPUT_DENIED");
  if (!record(prompt)) throw new Error("CKS_COMPETENCE_RUNTIME_INPUT_DENIED");
  const promptBinding: CksPromptBindingV1 = {
    promptId: prompt["promptId"] as string,
    promptVersion: prompt["promptVersion"] as string,
    encoding: prompt["encoding"] as "UTF-8",
    normalization: prompt["normalization"] as "NONE",
    trailingLineFeed: prompt["trailingLineFeed"] as false,
    assemblyVersion: prompt["assemblyVersion"] as string,
    chatTemplateSource: prompt["chatTemplateSource"] as string,
    sha256: prompt["sha256"] as string,
  };
  const unsigned = {
    schemaVersion: COMPETENCE_RUNTIME_SCHEMA_V1,
    contractId: CKS_COMPETENCE_RUNTIME_CONTRACT_ID_V1,
    receiptSource: { receiptPath: input.receiptPath, receiptDigest: input.receiptDigest, profileCoreDigest: input.profileCoreDigest, decisionId: input.decisionId },
    profile: {
      profileSchemaVersion: profile["profileSchemaVersion"],
      profileId: profile["profileId"],
      profileRevision: profile["profileRevision"],
      intendedUse: profile["intendedUse"],
      selectionStatus: profile["selectionStatus"],
    },
    model: profile["model"],
    quantization: profile["quantization"],
    runtime: profile["runtime"],
    context: profile["context"],
    decoding: profile["decoding"],
    prompt: promptBinding,
    toolProtocols: profile["toolProtocols"],
    knowledgeBindings: profile["knowledgeBindings"],
    interactionPolicy: profile["interactionPolicy"],
    resourceLimits: profile["resourceLimits"],
    states: [...COMPETENCE_STATES_V1],
  };
  if (!validateCksCompetenceRuntimeContractV1({ ...unsigned, contractDigest: cksCompetenceRuntimeContractDigestV1(unsigned) })) throw new Error("CKS_COMPETENCE_RUNTIME_INPUT_DENIED");
  return { ...unsigned, contractDigest: cksCompetenceRuntimeContractDigestV1(unsigned) };
}

// ---------------------------------------------------------------------------
// Bounded Knowledge Query admission
// ---------------------------------------------------------------------------

export type QueryDenialReasonV1 =
  | "CALL_BUDGET_EXHAUSTED"
  | "REQUEST_ID_INVALID"
  | "REQUEST_ID_NOT_MONOTONIC"
  | "REQUEST_ID_DUPLICATE"
  | "QUERY_MALFORMED"
  | "QUERY_TEXT_BYTES_EXCEEDED"
  | "RESULT_LIMIT_EXCEEDED"
  | "EVIDENCE_BYTE_LIMIT_EXCEEDED"
  | "AGGREGATE_EVIDENCE_BYTES_EXCEEDED"
  | "EFFECT_OR_LOCATOR_FIELD_FORBIDDEN";

export interface RetrievalTaskStateV1 {
  readonly taskId: string;
  readonly admittedCallCount: number;
  readonly aggregateEvidenceBytes: number;
}

export type KnowledgeQueryAdmissionV1 =
  | { readonly outcome: "ADMITTED"; readonly callNumber: number; readonly newAggregateEvidenceBytes: number }
  | { readonly outcome: "DENIED"; readonly reason: QueryDenialReasonV1 };

/**
 * Admit a bounded Knowledge Query call for a task. Enforces the closed schema,
 * the per-task call budget, monotonic `KQ-0[1-3]` request ordering and the
 * per-call and aggregate Evidence byte ceilings. The returned `maxEvidenceBytes`
 * request bound is what the retrieval layer must honour when it assembles the
 * Evidence Pack.
 */
export function admitKnowledgeQueryV1(state: RetrievalTaskStateV1, request: KnowledgeQueryRequestV1): KnowledgeQueryAdmissionV1 {
  if (state.admittedCallCount >= QUERY_LIMITS_V1.maximumCallsPerTask) return { outcome: "DENIED", reason: "CALL_BUDGET_EXHAUSTED" };
  if (!validateKnowledgeQueryRequestV1(request)) return { outcome: "DENIED", reason: "QUERY_MALFORMED" };
  if (request.taskId !== state.taskId) return { outcome: "DENIED", reason: "QUERY_MALFORMED" };
  const expectedNumber = state.admittedCallCount + 1;
  const prefix = `KQ-0${expectedNumber}`;
  if (!isRequestId(request.requestId)) return { outcome: "DENIED", reason: "REQUEST_ID_INVALID" };
  if (request.requestId !== prefix) {
    const requested = Number(request.requestId.slice(4));
    if (requested <= state.admittedCallCount) return { outcome: "DENIED", reason: "REQUEST_ID_DUPLICATE" };
    return { outcome: "DENIED", reason: "REQUEST_ID_NOT_MONOTONIC" };
  }
  if (Buffer.byteLength(request.queryText, "utf8") > QUERY_LIMITS_V1.maximumQueryBytes) return { outcome: "DENIED", reason: "QUERY_TEXT_BYTES_EXCEEDED" };
  if (request.maxResults > QUERY_LIMITS_V1.maximumResultsPerCall) return { outcome: "DENIED", reason: "RESULT_LIMIT_EXCEEDED" };
  if (request.maxEvidenceBytes > QUERY_LIMITS_V1.maximumEvidenceBytesPerCall) return { outcome: "DENIED", reason: "EVIDENCE_BYTE_LIMIT_EXCEEDED" };
  if (state.aggregateEvidenceBytes + request.maxEvidenceBytes > QUERY_LIMITS_V1.maximumAggregateEvidenceBytes) return { outcome: "DENIED", reason: "AGGREGATE_EVIDENCE_BYTES_EXCEEDED" };
  // The closed schema carries no network-locator or effect fields, so a valid
  // request cannot name one; this is the explicit closed-catalogue guarantee.
  return { outcome: "ADMITTED", callNumber: expectedNumber, newAggregateEvidenceBytes: state.aggregateEvidenceBytes + request.maxEvidenceBytes };
}

// ---------------------------------------------------------------------------
// Closed competence-state resolution
// ---------------------------------------------------------------------------

export interface CompetenceStateInputV1 {
  readonly allMaterialClaimsCovered: boolean;
  readonly allProcedureStepsCovered: boolean;
  readonly preconditionsChecked: boolean;
  readonly exclusionsChecked: boolean;
  readonly conflictsPresent: boolean;
  readonly materialKnowledgeMissing: boolean;
  readonly differentiatingRetrievalAvailable: boolean;
  readonly retrievalCallsExhausted: boolean;
  readonly taskWithinProfile: boolean;
}

/**
 * Resolve one of the six closed competence states from a task's evidence
 * posture. Deterministic and fail-closed: a conflict or a material knowledge
 * gap always beats a supported answer, and exhausted bounded retrieval that
 * still exceeds the profile escalates via COMPETENCE_LIMIT.
 */
export function resolveCompetenceStateV1(input: CompetenceStateInputV1): CompetenceStateV1 {
  if (input.conflictsPresent) return "KNOWLEDGE_CONFLICT";
  if (input.materialKnowledgeMissing) {
    if (input.differentiatingRetrievalAvailable && !input.retrievalCallsExhausted) return "NEED_MORE_KNOWLEDGE";
    return "INSUFFICIENT_EVIDENCE";
  }
  if (input.retrievalCallsExhausted && !input.taskWithinProfile) return "COMPETENCE_LIMIT";
  if (input.allMaterialClaimsCovered && input.allProcedureStepsCovered && input.preconditionsChecked && input.exclusionsChecked) return "ANSWER_SUPPORTED";
  return "INSUFFICIENT_EVIDENCE";
}