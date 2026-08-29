import { createHash } from "node:crypto";
import { canonicalJson } from "./canonical-json.js";

/**
 * CKS-06 (issue #286) — frozen advisory competence qualification profile v1.
 *
 * Implements the exact-qualification-profile identity frozen by
 * docs/evidence/conveyor/sol-psai286-router-semantics-decision-01.json:
 * the profile digest is SHA-256 over the canonical JSON of every required
 * exact binding. Equality means byte-equal normalized fields and equal
 * digests; aliases, family membership, ranges, defaults, omission, and
 * compatibility inference never establish equality. A change to any required
 * binding creates a different, initially UNQUALIFIED profile; evidence does
 * not inherit across profiles.
 *
 * This module is a pure contract surface: closed types, the canonical
 * profile digest, and fail-closed validation. It issues no qualification
 * verdict, performs no task classification, ranking, capacity measurement,
 * provider call, or route execution. The typed escalation receipt (closed
 * causes, frozen cause-to-disposition mapping, digest-bound) is the same
 * pure contract surface: recommendation evidence only, never a verdict.
 */

export const CKS_COMPETENCE_QUALIFICATION_PROFILE_SCHEMA_V1 =
  "chimpmaera.dev/cks-competence-qualification-profile/v1" as const;

export const CKS_QUALIFICATION_STATES_V1 = [
  "UNQUALIFIED",
  "QUALIFIED",
  "SUSPENDED_DRIFT",
  "REVOKED_EVIDENCE",
] as const;

/** Sentinel identity for an intentionally absent optional component. */
export const CKS_QUALIFICATION_NONE = "NONE" as const;

const sha256Hex = (value: string): string => createHash("sha256").update(value).digest("hex");

/**
 * Canonical digest of the NONE sentinel. A NONE component must bind this
 * digest in every paired digest field so that "absent" is itself an exact,
 * read-back-able value rather than an omission.
 */
export const CKS_QUALIFICATION_NONE_DIGEST_V1 = sha256Hex(canonicalJson(CKS_QUALIFICATION_NONE));

export const CKS_BINDING_NAMES_V1 = [
  "modelArtifact",
  "quantization",
  "runtime",
  "context",
  "prompt",
  "tools",
  "retriever",
  "reranker",
  "verifier",
  "knowledge",
  "qualificationSuite",
] as const;

export type CksBindingNameV1 = typeof CKS_BINDING_NAMES_V1[number];
export type CksQualificationStateV1 = typeof CKS_QUALIFICATION_STATES_V1[number];

/** Exact model artifact binding. A provider or marketing model name is not profile identity. */
export interface CksModelArtifactBindingV1 {
  readonly artifactDigest: string;
  readonly architectureId: string;
  readonly tokenizerDigest: string;
  readonly licenseProfileId: string;
}

export interface CksQuantizationBindingV1 {
  readonly formatId: string;
  readonly quantizerVersion: string;
  readonly weightsDigest: string;
  readonly parameterizationDigest: string;
}

export interface CksRuntimeBindingV1 {
  readonly runtimeId: string;
  readonly runtimeVersion: string;
  readonly buildDigest: string;
  readonly backendId: string;
  readonly kernelSetDigest: string;
  readonly hardwareClassId: string;
  readonly determinismConfigDigest: string;
}

export interface CksContextBindingV1 {
  readonly contextWindowTokens: number;
  readonly maximumInputTokens: number;
  readonly maximumOutputTokens: number;
  readonly chatTemplateDigest: string;
  readonly positionEncodingConfigDigest: string;
  readonly kvPrecisionId: string;
  readonly truncationPolicy: "DENY";
}

export interface CksPromptBindingV1 {
  readonly promptContractVersion: string;
  readonly systemPromptDigest: string;
  readonly instructionTemplateDigest: string;
  readonly stopSequenceDigest: string;
  readonly samplingConfigDigest: string;
}

export interface CksToolsBindingV1 {
  readonly closedToolSetDigest: string;
  readonly orderedToolIdsAndVersions: readonly string[];
  readonly toolSchemaBundleDigest: string;
  readonly toolPolicyDigest: string;
}

/** Absence is expressed with the NONE sentinel, never by omitting fields. */
export interface CksRetrieverBindingV1 {
  readonly componentIdOrNONE: string;
  readonly versionOrNONE: string;
  readonly configDigest: string;
  readonly indexContractDigest: string;
}

export interface CksRerankerBindingV1 {
  readonly componentIdOrNONE: string;
  readonly versionOrNONE: string;
  readonly configDigest: string;
}

export interface CksVerifierBindingV1 {
  readonly deterministicVerifierId: string;
  readonly deterministicVerifierDigest: string;
  readonly semanticVerifierIdOrNONE: string;
  readonly semanticVerifierDigest: string;
  readonly thresholdPolicyDigest: string;
}

export interface CksKnowledgeBindingV1 {
  readonly knowledgeContractVersion: string;
  readonly knowledgeEditionOrNONE: string;
  readonly knowledgeManifestDigest: string;
  readonly applicabilityPolicyDigest: string;
}

export interface CksQualificationSuiteBindingV1 {
  readonly suiteVersion: string;
  readonly suiteManifestDigest: string;
  readonly generatorDigest: string;
  readonly splitPolicyDigest: string;
  readonly scoringPolicyDigest: string;
  readonly freshCertificationReceiptDigest: string;
}

export interface CksExactQualificationBindingsV1 {
  readonly modelArtifact: CksModelArtifactBindingV1;
  readonly quantization: CksQuantizationBindingV1;
  readonly runtime: CksRuntimeBindingV1;
  readonly context: CksContextBindingV1;
  readonly prompt: CksPromptBindingV1;
  readonly tools: CksToolsBindingV1;
  readonly retriever: CksRetrieverBindingV1;
  readonly reranker: CksRerankerBindingV1;
  readonly verifier: CksVerifierBindingV1;
  readonly knowledge: CksKnowledgeBindingV1;
  readonly qualificationSuite: CksQualificationSuiteBindingV1;
}

/**
 * The frozen advisory qualification profile. profileDigest is the identity:
 * SHA-256 over canonical JSON of all required exact bindings. state is
 * profile evidence state, not identity: the same bindings in a different
 * state are the same profile, and Q tiers are derived, never declared here.
 */
export interface CksCompetenceQualificationProfileV1 {
  readonly schemaVersion: typeof CKS_COMPETENCE_QUALIFICATION_PROFILE_SCHEMA_V1;
  readonly bindings: CksExactQualificationBindingsV1;
  readonly state: CksQualificationStateV1;
  readonly profileDigest: string;
}

export type CksQualificationDenialV1 =
  | "UNKNOWN_FIELD"
  | "MISSING_FIELD"
  | "MALFORMED_VALUE"
  | "TRUNCATION_POLICY_NOT_DENY"
  | "CONTEXT_WINDOW_VIOLATION"
  | "NONE_PAIRING_MISMATCH"
  | "INVALID_STATE"
  | "DIGEST_MISMATCH";

export type CksQualificationValidationV1 =
  | { readonly outcome: "VALID"; readonly profileDigest: string }
  | { readonly outcome: "DENIED"; readonly reason: CksQualificationDenialV1; readonly detail: string };

const DIGEST_PATTERN = /^[a-f0-9]{64}$/;
const IDENTIFIER_PATTERN = /^[a-z0-9][a-z0-9._-]*$/;
const TOOL_ID_AND_VERSION_PATTERN = /^[a-z0-9][a-z0-9._-]*@[a-z0-9][a-z0-9._-]*$/;

/**
 * Frozen field inventory of every required exact binding, in the canonical
 * order of the frozen semantics. Unknown, missing, and malformed fields are
 * all denied; the digest recomputes over exactly these fields.
 */
const CKS_BINDING_FIELD_KINDS_V1: Readonly<Record<CksBindingNameV1, Readonly<Record<string, string>>>> = {
  modelArtifact: {
    artifactDigest: "digest",
    architectureId: "identifier",
    tokenizerDigest: "digest",
    licenseProfileId: "identifier",
  },
  quantization: {
    formatId: "identifier",
    quantizerVersion: "identifier",
    weightsDigest: "digest",
    parameterizationDigest: "digest",
  },
  runtime: {
    runtimeId: "identifier",
    runtimeVersion: "identifier",
    buildDigest: "digest",
    backendId: "identifier",
    kernelSetDigest: "digest",
    hardwareClassId: "identifier",
    determinismConfigDigest: "digest",
  },
  context: {
    contextWindowTokens: "positiveInt",
    maximumInputTokens: "positiveInt",
    maximumOutputTokens: "positiveInt",
    chatTemplateDigest: "digest",
    positionEncodingConfigDigest: "digest",
    kvPrecisionId: "identifier",
    truncationPolicy: "denyConst",
  },
  prompt: {
    promptContractVersion: "identifier",
    systemPromptDigest: "digest",
    instructionTemplateDigest: "digest",
    stopSequenceDigest: "digest",
    samplingConfigDigest: "digest",
  },
  tools: {
    closedToolSetDigest: "digest",
    orderedToolIdsAndVersions: "toolList",
    toolSchemaBundleDigest: "digest",
    toolPolicyDigest: "digest",
  },
  retriever: {
    componentIdOrNONE: "orNone",
    versionOrNONE: "orNone",
    configDigest: "digest",
    indexContractDigest: "digest",
  },
  reranker: {
    componentIdOrNONE: "orNone",
    versionOrNONE: "orNone",
    configDigest: "digest",
  },
  verifier: {
    deterministicVerifierId: "identifier",
    deterministicVerifierDigest: "digest",
    semanticVerifierIdOrNONE: "orNone",
    semanticVerifierDigest: "digest",
    thresholdPolicyDigest: "digest",
  },
  knowledge: {
    knowledgeContractVersion: "identifier",
    knowledgeEditionOrNONE: "orNone",
    knowledgeManifestDigest: "digest",
    applicabilityPolicyDigest: "digest",
  },
  qualificationSuite: {
    suiteVersion: "identifier",
    suiteManifestDigest: "digest",
    generatorDigest: "digest",
    splitPolicyDigest: "digest",
    scoringPolicyDigest: "digest",
    freshCertificationReceiptDigest: "digest",
  },
};

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && Object.getPrototypeOf(value) === Object.prototype;

const denied = (
  reason: CksQualificationDenialV1,
  detail: string,
): { outcome: "DENIED"; reason: CksQualificationDenialV1; detail: string } => ({
  outcome: "DENIED",
  reason,
  detail,
});

/**
 * SHA-256 over canonical JSON of the exact bindings. Canonical JSON sorts
 * object keys, so the digest is independent of key insertion order.
 * Throws a TypeError for non-canonical input.
 */
export function cksExactProfileDigestV1(bindings: unknown): string {
  return sha256Hex(canonicalJson(bindings));
}

function checkFieldValue(kind: string, path: string, value: unknown): CksQualificationValidationV1 | undefined {
  switch (kind) {
    case "digest":
      if (typeof value !== "string" || !DIGEST_PATTERN.test(value)) return denied("MALFORMED_VALUE", path);
      return undefined;
    case "identifier":
      if (typeof value !== "string" || !IDENTIFIER_PATTERN.test(value)) return denied("MALFORMED_VALUE", path);
      return undefined;
    case "orNone":
      if (value !== CKS_QUALIFICATION_NONE && (typeof value !== "string" || !IDENTIFIER_PATTERN.test(value))) {
        return denied("MALFORMED_VALUE", path);
      }
      return undefined;
    case "positiveInt":
      if (typeof value !== "number" || !Number.isInteger(value) || value < 1) return denied("MALFORMED_VALUE", path);
      return undefined;
    case "denyConst":
      if (value !== "DENY") return denied("TRUNCATION_POLICY_NOT_DENY", path);
      return undefined;
    case "toolList": {
      if (!Array.isArray(value)) return denied("MALFORMED_VALUE", path);
      for (let i = 0; i < value.length; i++) {
        const entry = value[i];
        if (typeof entry !== "string" || !TOOL_ID_AND_VERSION_PATTERN.test(entry)) {
          return denied("MALFORMED_VALUE", `${path}[${i}]`);
        }
      }
      return undefined;
    }
    default:
      return denied("MALFORMED_VALUE", path);
  }
}

/**
 * Closed fail-closed validation of the exact bindings: every frozen field
 * present with a well-formed value, no unknown fields, the DENY truncation
 * policy, bounded context window, and exact NONE pairing. On success the
 * returned profileDigest is the digest that binds the result.
 */
export function validateCksExactQualificationBindingsV1(input: unknown): CksQualificationValidationV1 {
  if (!isPlainObject(input)) return denied("MALFORMED_VALUE", "bindings");
  for (const key of Object.keys(input)) {
    if (!(CKS_BINDING_NAMES_V1 as readonly string[]).includes(key)) return denied("UNKNOWN_FIELD", `bindings.${key}`);
  }
  for (const bindingName of CKS_BINDING_NAMES_V1) {
    const path = `bindings.${bindingName}`;
    const binding = input[bindingName];
    if (!isPlainObject(binding)) return denied("MISSING_FIELD", path);
    const kinds = CKS_BINDING_FIELD_KINDS_V1[bindingName];
    for (const key of Object.keys(binding)) {
      if (!(key in kinds)) return denied("UNKNOWN_FIELD", `${path}.${key}`);
    }
    for (const [field, kind] of Object.entries(kinds)) {
      const fieldPath = `${path}.${field}`;
      if (!(field in binding)) return denied("MISSING_FIELD", fieldPath);
      const malformed = checkFieldValue(kind, fieldPath, binding[field]);
      if (malformed !== undefined) return malformed;
    }
  }
  const context = input.context as Record<string, unknown>;
  const window = context.contextWindowTokens as number;
  const maxInput = context.maximumInputTokens as number;
  const maxOutput = context.maximumOutputTokens as number;
  if (maxInput + maxOutput > window) return denied("CONTEXT_WINDOW_VIOLATION", "bindings.context");
  const nonePairing = (
    root: string,
    id: unknown,
    version: unknown,
    digests: readonly { readonly field: string; readonly value: unknown }[],
  ): CksQualificationValidationV1 | undefined => {
    const idIsNone = id === CKS_QUALIFICATION_NONE;
    if (version !== undefined && idIsNone !== (version === CKS_QUALIFICATION_NONE)) {
      return denied("NONE_PAIRING_MISMATCH", `bindings.${root}.versionOrNONE`);
    }
    for (const { field, value } of digests) {
      if (idIsNone !== (value === CKS_QUALIFICATION_NONE_DIGEST_V1)) {
        return denied("NONE_PAIRING_MISMATCH", `bindings.${root}.${field}`);
      }
    }
    return undefined;
  };
  const retriever = input.retriever as Record<string, unknown>;
  const reranker = input.reranker as Record<string, unknown>;
  const verifier = input.verifier as Record<string, unknown>;
  const knowledge = input.knowledge as Record<string, unknown>;
  const noneMismatch =
    nonePairing("retriever", retriever.componentIdOrNONE, retriever.versionOrNONE, [
      { field: "configDigest", value: retriever.configDigest },
      { field: "indexContractDigest", value: retriever.indexContractDigest },
    ]) ??
    nonePairing("reranker", reranker.componentIdOrNONE, reranker.versionOrNONE, [
      { field: "configDigest", value: reranker.configDigest },
    ]) ??
    nonePairing("verifier", verifier.semanticVerifierIdOrNONE, undefined, [
      { field: "semanticVerifierDigest", value: verifier.semanticVerifierDigest },
    ]) ??
    nonePairing("knowledge", knowledge.knowledgeEditionOrNONE, undefined, [
      { field: "knowledgeManifestDigest", value: knowledge.knowledgeManifestDigest },
    ]);
  if (noneMismatch !== undefined) return noneMismatch;
  return { outcome: "VALID", profileDigest: cksExactProfileDigestV1(input) };
}

/**
 * Closed fail-closed validation of the frozen advisory qualification
 * profile. Denies unknown or missing fields, malformed values, non-DENY
 * truncation, unbounded context windows, broken NONE pairing, states
 * outside the closed enum, and any profileDigest that does not bind the
 * exact bindings.
 */
export function validateCksCompetenceQualificationProfileV1(
  input: unknown,
): CksQualificationValidationV1 {
  if (!isPlainObject(input)) return denied("MALFORMED_VALUE", "profile");
  const topLevelFields = new Set(["schemaVersion", "bindings", "state", "profileDigest"]);
  for (const key of Object.keys(input)) {
    if (!topLevelFields.has(key)) return denied("UNKNOWN_FIELD", key);
  }
  for (const key of topLevelFields) {
    if (!(key in input)) return denied("MISSING_FIELD", key);
  }
  if (input.schemaVersion !== CKS_COMPETENCE_QUALIFICATION_PROFILE_SCHEMA_V1) {
    return denied("MALFORMED_VALUE", "schemaVersion");
  }
  if (typeof input.state !== "string" || !(CKS_QUALIFICATION_STATES_V1 as readonly string[]).includes(input.state)) {
    return denied("INVALID_STATE", "state");
  }
  if (typeof input.profileDigest !== "string" || !DIGEST_PATTERN.test(input.profileDigest)) {
    return denied("MALFORMED_VALUE", "profileDigest");
  }
  const bindingsResult = validateCksExactQualificationBindingsV1(input.bindings);
  if (bindingsResult.outcome !== "VALID") return bindingsResult;
  if (bindingsResult.profileDigest !== input.profileDigest) {
    return denied("DIGEST_MISMATCH", "profileDigest");
  }
  return bindingsResult;
}

/** Schema identity for the finite AC-03 escalation-cause evidence contract. */
export const CKS_ESCALATION_SCHEMA_V1 = "chimpmaera.dev/cks-escalation/v1" as const;

/** This contract recommends data only; it never grants authority or executes a route. */
export const CKS_ESCALATION_CLAIM_BOUNDARY_V1 =
  "TYPED_ESCALATION_EVIDENCE_ONLY_NO_ROUTE_EXECUTION_NO_AUTHORITY_GRANT" as const;

export const CKS_ESCALATION_CAUSES_V1 = [
  "KNOWLEDGE_GAP",
  "KNOWLEDGE_CONFLICT",
  "VERIFIER_REJECTION",
  "DECOMPOSITION_GROWTH",
  "LOW_EVIDENCE_COVERAGE",
  "COMPETENCE_LIMIT",
] as const;

export type CksEscalationCauseV1 = typeof CKS_ESCALATION_CAUSES_V1[number];
export type CksEscalationCauseCodeV1 = CksEscalationCauseV1;
export const CKS_ESCALATION_CAUSE_CODES_V1 = CKS_ESCALATION_CAUSES_V1;

export const CKS_ESCALATION_DISPOSITIONS_V1 = [
  "ABSTAIN_AND_REQUEST_BOUND_KNOWLEDGE_EVIDENCE",
  "ABSTAIN_OR_RESELECT_CONFLICT_QUALIFIED_PROFILE",
  "REJECT_CANDIDATE_AND_RESELECT_IF_BUDGETED",
  "RECLASSIFY_AND_RESELECT",
  "REJECT_OUTPUT_AND_ABSTAIN_OR_RESELECT",
  "EXCLUDE_PROFILE_AND_RESELECT",
] as const;

export type CksEscalationDispositionV1 = typeof CKS_ESCALATION_DISPOSITIONS_V1[number];

/** The disposition is frozen by the decision receipt and is not caller-selected. */
export const CKS_ESCALATION_CAUSE_TO_DISPOSITION_V1 = {
  KNOWLEDGE_GAP: "ABSTAIN_AND_REQUEST_BOUND_KNOWLEDGE_EVIDENCE",
  KNOWLEDGE_CONFLICT: "ABSTAIN_OR_RESELECT_CONFLICT_QUALIFIED_PROFILE",
  VERIFIER_REJECTION: "REJECT_CANDIDATE_AND_RESELECT_IF_BUDGETED",
  DECOMPOSITION_GROWTH: "RECLASSIFY_AND_RESELECT",
  LOW_EVIDENCE_COVERAGE: "REJECT_OUTPUT_AND_ABSTAIN_OR_RESELECT",
  COMPETENCE_LIMIT: "EXCLUDE_PROFILE_AND_RESELECT",
} as const satisfies Readonly<Record<CksEscalationCauseV1, CksEscalationDispositionV1>>;

export type CksRkpuVectorV1 = readonly [number, number, number, number];

export interface CksKnowledgeGapTriggerV1 {
  readonly kind: "KNOWLEDGE_GAP";
  readonly sourceReceiptDigest: string;
  readonly trigger: "NEED_MORE_KNOWLEDGE" | "MATERIAL_KNOWLEDGE_OBJECT_ABSENT";
  readonly materialKnowledgeObjectDigest: string;
}

export interface CksKnowledgeConflictTriggerV1 {
  readonly kind: "KNOWLEDGE_CONFLICT";
  readonly sourceReceiptDigest: string;
  readonly trigger: "UNRESOLVED_MATERIAL_CONFLICT" | "SUPERSESSION_AMBIGUITY";
  readonly conflictingEvidenceDigests: readonly [string, string, ...string[]];
  readonly applicabilityEvidenceDigest: string;
}

export interface CksVerifierRejectionTriggerV1 {
  readonly kind: "VERIFIER_REJECTION";
  readonly sourceReceiptDigest: string;
  readonly verifierReceiptDigest: string;
  readonly verifier: "DETERMINISTIC" | "SEMANTIC";
  readonly rejectedCheck:
    | "ID"
    | "VERSION"
    | "DIGEST"
    | "SCOPE"
    | "PRECONDITION"
    | "CLAIM_COVERAGE"
    | "EXPECTED_STATE";
}

export interface CksDecompositionGrowthTriggerV1 {
  readonly kind: "DECOMPOSITION_GROWTH";
  readonly sourceReceiptDigest: string;
  readonly previousDecompositionDigest: string;
  readonly currentDecompositionDigest: string;
  readonly previousNodeCount: number;
  readonly currentNodeCount: number;
  readonly previousEdgeCount: number;
  readonly currentEdgeCount: number;
  readonly previousLongestPath: number;
  readonly currentLongestPath: number;
  readonly previousContextTokens: number;
  readonly currentContextTokens: number;
  readonly previousToolSteps: number;
  readonly currentToolSteps: number;
  readonly previousDependencyCount: number;
  readonly currentDependencyCount: number;
  readonly previousPathLeaseCount: number;
  readonly currentPathLeaseCount: number;
}

export interface CksLowEvidenceCoverageTriggerV1 {
  readonly kind: "LOW_EVIDENCE_COVERAGE";
  readonly sourceReceiptDigest: string;
  readonly coverageReceiptDigest: string;
  readonly coveredPpm: number;
  readonly applicabilityLinkPresent: boolean;
  readonly applicabilityEvidenceDigest: string;
}

export interface CksCompetenceLimitTriggerV1 {
  readonly kind: "COMPETENCE_LIMIT";
  readonly sourceReceiptDigest: string;
  readonly trigger: "RUNTIME_COMPETENCE_LIMIT" | "OUTSIDE_VERIFIED_COVERAGE_BOX";
  readonly coverageBoxDigest: string;
  readonly taskVectorDigest: string;
}

export interface CksEscalationTriggerByCauseV1 {
  readonly KNOWLEDGE_GAP: CksKnowledgeGapTriggerV1;
  readonly KNOWLEDGE_CONFLICT: CksKnowledgeConflictTriggerV1;
  readonly VERIFIER_REJECTION: CksVerifierRejectionTriggerV1;
  readonly DECOMPOSITION_GROWTH: CksDecompositionGrowthTriggerV1;
  readonly LOW_EVIDENCE_COVERAGE: CksLowEvidenceCoverageTriggerV1;
  readonly COMPETENCE_LIMIT: CksCompetenceLimitTriggerV1;
}

export type CksEscalationTriggerEvidenceV1 = CksEscalationTriggerByCauseV1[CksEscalationCauseV1];
export type CksEscalationCauseEvidenceV1 = CksEscalationTriggerEvidenceV1;

interface CksEscalationEvidenceEnvelopeV1 {
  readonly schemaVersion: typeof CKS_ESCALATION_SCHEMA_V1;
  readonly episodeDigest: string;
  readonly exactProfileDigest: string;
  /** R/K/P/U remain a four-coordinate tuple; no scalar strength is accepted. */
  readonly taskVector: CksRkpuVectorV1;
  readonly taskVectorDigest: string;
  readonly evidenceDigest: string;
  readonly claimBoundary: typeof CKS_ESCALATION_CLAIM_BOUNDARY_V1;
  readonly receiptDigest: string;
}

/** The cause discriminant fixes both its typed evidence payload and disposition. */
export type CksEscalationEvidenceV1 = {
  readonly [Cause in CksEscalationCauseV1]: CksEscalationEvidenceEnvelopeV1 & {
    readonly causeCode: Cause;
    readonly disposition: typeof CKS_ESCALATION_CAUSE_TO_DISPOSITION_V1[Cause];
    readonly triggerEvidence: CksEscalationTriggerByCauseV1[Cause];
  };
}[CksEscalationCauseV1];
export type CksEscalationReceiptV1 = CksEscalationEvidenceV1;

export type CksEscalationDenialV1 =
  | "UNKNOWN_FIELD"
  | "MISSING_FIELD"
  | "MALFORMED_VALUE"
  | "INVALID_CAUSE"
  | "DISPOSITION_MISMATCH"
  | "TRIGGER_MISMATCH"
  | "TRIGGER_NOT_PROVEN"
  | "DIGEST_MISMATCH";

export type CksEscalationValidationV1 =
  | {
      readonly outcome: "VALID";
      readonly causeCode: CksEscalationCauseV1;
      readonly disposition: CksEscalationDispositionV1;
      readonly evidenceDigest: string;
      readonly receiptDigest: string;
    }
  | { readonly outcome: "DENIED"; readonly reason: CksEscalationDenialV1; readonly detail: string };

const ESCALATION_DIGEST_PATTERN = /^[a-f0-9]{64}$/;
const ESCALATION_CAUSE_SET = new Set<string>(CKS_ESCALATION_CAUSES_V1);
const ESCALATION_TRIGGER_KEYS: Readonly<Record<CksEscalationCauseV1, readonly string[]>> = {
  KNOWLEDGE_GAP: ["kind", "sourceReceiptDigest", "trigger", "materialKnowledgeObjectDigest"],
  KNOWLEDGE_CONFLICT: ["kind", "sourceReceiptDigest", "trigger", "conflictingEvidenceDigests", "applicabilityEvidenceDigest"],
  VERIFIER_REJECTION: ["kind", "sourceReceiptDigest", "verifierReceiptDigest", "verifier", "rejectedCheck"],
  DECOMPOSITION_GROWTH: [
    "kind", "sourceReceiptDigest", "previousDecompositionDigest", "currentDecompositionDigest",
    "previousNodeCount", "currentNodeCount", "previousEdgeCount", "currentEdgeCount",
    "previousLongestPath", "currentLongestPath", "previousContextTokens", "currentContextTokens",
    "previousToolSteps", "currentToolSteps", "previousDependencyCount", "currentDependencyCount",
    "previousPathLeaseCount", "currentPathLeaseCount",
  ],
  LOW_EVIDENCE_COVERAGE: ["kind", "sourceReceiptDigest", "coverageReceiptDigest", "coveredPpm", "applicabilityLinkPresent", "applicabilityEvidenceDigest"],
  COMPETENCE_LIMIT: ["kind", "sourceReceiptDigest", "trigger", "coverageBoxDigest", "taskVectorDigest"],
};

const escalationDenied = (
  reason: CksEscalationDenialV1,
  detail: string,
): CksEscalationValidationV1 => ({ outcome: "DENIED", reason, detail });

const escalationPlainObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && Object.getPrototypeOf(value) === Object.prototype;

const escalationExactKeys = (value: Record<string, unknown>, expected: readonly string[]): boolean => {
  const actual = Object.keys(value).sort();
  return actual.length === expected.length && actual.every((key, index) => key === [...expected].sort()[index]);
};

const escalationDigest = (value: unknown): boolean =>
  typeof value === "string" && ESCALATION_DIGEST_PATTERN.test(value);

const escalationSafeInteger = (value: unknown): value is number =>
  typeof value === "number" && Number.isSafeInteger(value) && value >= 0;

export function cksEscalationTaskVectorDigestV1(vector: CksRkpuVectorV1 | unknown): string {
  return sha256Hex(canonicalJson(vector));
}

/** Digest only the typed trigger payload, so changing a fact invalidates the receipt. */
export function cksEscalationEvidenceDigestV1(triggerEvidence: CksEscalationTriggerEvidenceV1 | unknown): string {
  return sha256Hex(canonicalJson(triggerEvidence));
}

type CksUnsignedEscalationEvidenceV1<Receipt> = Receipt extends unknown
  ? Omit<Receipt, "receiptDigest">
  : never;

export function cksEscalationReceiptDigestV1(
  receipt: CksUnsignedEscalationEvidenceV1<CksEscalationEvidenceV1> | Record<string, unknown>,
): string {
  const unsigned = Object.fromEntries(
    Object.entries(receipt as Record<string, unknown>).filter(([key]) => key !== "receiptDigest"),
  );
  return sha256Hex(canonicalJson(unsigned));
}

function validateEscalationTrigger(
  cause: CksEscalationCauseV1,
  value: unknown,
  taskVectorDigest: string,
): CksEscalationValidationV1 | undefined {
  if (!escalationPlainObject(value)) return escalationDenied("MALFORMED_VALUE", "triggerEvidence");
  const expectedKeys = ESCALATION_TRIGGER_KEYS[cause];
  if (!escalationExactKeys(value, expectedKeys)) return escalationDenied("UNKNOWN_FIELD", "triggerEvidence");
  if (value.kind !== cause) return escalationDenied("TRIGGER_MISMATCH", "triggerEvidence.kind");

  const digestFields = Object.entries(value).filter(([key]) => key.endsWith("Digest"));
  if (!digestFields.every(([, digest]) => escalationDigest(digest))) {
    return escalationDenied("MALFORMED_VALUE", "triggerEvidence.digest");
  }

  if (cause === "KNOWLEDGE_GAP") {
    if (value.trigger !== "NEED_MORE_KNOWLEDGE" && value.trigger !== "MATERIAL_KNOWLEDGE_OBJECT_ABSENT") {
      return escalationDenied("TRIGGER_NOT_PROVEN", "triggerEvidence.trigger");
    }
  } else if (cause === "KNOWLEDGE_CONFLICT") {
    if (value.trigger !== "UNRESOLVED_MATERIAL_CONFLICT" && value.trigger !== "SUPERSESSION_AMBIGUITY") {
      return escalationDenied("TRIGGER_NOT_PROVEN", "triggerEvidence.trigger");
    }
    if (!Array.isArray(value.conflictingEvidenceDigests) || value.conflictingEvidenceDigests.length < 2
      || new Set(value.conflictingEvidenceDigests).size !== value.conflictingEvidenceDigests.length
      || !value.conflictingEvidenceDigests.every(escalationDigest)) {
      return escalationDenied("TRIGGER_NOT_PROVEN", "triggerEvidence.conflictingEvidenceDigests");
    }
  } else if (cause === "VERIFIER_REJECTION") {
    if (value.verifier !== "DETERMINISTIC" && value.verifier !== "SEMANTIC") {
      return escalationDenied("TRIGGER_NOT_PROVEN", "triggerEvidence.verifier");
    }
    if (!["ID", "VERSION", "DIGEST", "SCOPE", "PRECONDITION", "CLAIM_COVERAGE", "EXPECTED_STATE"].includes(value.rejectedCheck as string)) {
      return escalationDenied("TRIGGER_NOT_PROVEN", "triggerEvidence.rejectedCheck");
    }
  } else if (cause === "DECOMPOSITION_GROWTH") {
    const metricNames = ["NodeCount", "EdgeCount", "LongestPath", "ContextTokens", "ToolSteps", "DependencyCount", "PathLeaseCount"];
    for (const metric of metricNames) {
      const previous = value[`previous${metric}`];
      const current = value[`current${metric}`];
      if (!escalationSafeInteger(previous) || !escalationSafeInteger(current) || current < previous) {
        return escalationDenied("TRIGGER_NOT_PROVEN", `triggerEvidence.${metric}`);
      }
    }
    const grew = metricNames.some((metric) => {
      const previous = value[`previous${metric}`];
      const current = value[`current${metric}`];
      return escalationSafeInteger(previous) && escalationSafeInteger(current) && current > previous;
    });
    if (!grew || value.previousDecompositionDigest === value.currentDecompositionDigest) {
      return escalationDenied("TRIGGER_NOT_PROVEN", "triggerEvidence.growth");
    }
  } else if (cause === "LOW_EVIDENCE_COVERAGE") {
    if (!escalationSafeInteger(value.coveredPpm) || value.coveredPpm > 1_000_000
      || (value.coveredPpm >= 1_000_000 && value.applicabilityLinkPresent)
      || typeof value.applicabilityLinkPresent !== "boolean"
    ) {
      return escalationDenied("TRIGGER_NOT_PROVEN", "triggerEvidence.coverage");
    }
  } else if (cause === "COMPETENCE_LIMIT") {
    if (value.trigger !== "RUNTIME_COMPETENCE_LIMIT" && value.trigger !== "OUTSIDE_VERIFIED_COVERAGE_BOX") {
      return escalationDenied("TRIGGER_NOT_PROVEN", "triggerEvidence.trigger");
    }
    if (value.taskVectorDigest !== taskVectorDigest) {
      return escalationDenied("DIGEST_MISMATCH", "triggerEvidence.taskVectorDigest");
    }
  }
  return undefined;
}

/**
 * Validate one closed, digest-bound AC-03 escalation evidence record. The
 * validator does not classify, rank, infer risk/impact, or grant Authority.
 */
export function validateCksEscalationEvidenceV1(input: unknown): CksEscalationValidationV1 {
  if (!escalationPlainObject(input)) return escalationDenied("MALFORMED_VALUE", "escalation");
  const topLevelKeys = [
    "schemaVersion", "episodeDigest", "exactProfileDigest", "taskVector", "taskVectorDigest",
    "causeCode", "disposition", "triggerEvidence", "evidenceDigest", "claimBoundary", "receiptDigest",
  ] as const;
  if (!escalationExactKeys(input, topLevelKeys)) {
    const expected = new Set<string>(topLevelKeys);
    return escalationDenied(
      Object.keys(input).some((key) => !expected.has(key)) ? "UNKNOWN_FIELD" : "MISSING_FIELD",
      "escalation",
    );
  }
  if (input.schemaVersion !== CKS_ESCALATION_SCHEMA_V1 || input.claimBoundary !== CKS_ESCALATION_CLAIM_BOUNDARY_V1) {
    return escalationDenied("MALFORMED_VALUE", "schemaVersion or claimBoundary");
  }
  if (!escalationDigest(input.episodeDigest) || !escalationDigest(input.exactProfileDigest)) {
    return escalationDenied("MALFORMED_VALUE", "profile or episode digest");
  }
  if (!Array.isArray(input.taskVector) || input.taskVector.length !== 4
    || !input.taskVector.every((coordinate) => escalationSafeInteger(coordinate) && coordinate <= 6)) {
    return escalationDenied("MALFORMED_VALUE", "taskVector");
  }
  if (!escalationDigest(input.taskVectorDigest)
    || cksEscalationTaskVectorDigestV1(input.taskVector) !== input.taskVectorDigest) {
    return escalationDenied("DIGEST_MISMATCH", "taskVectorDigest");
  }
  if (typeof input.causeCode !== "string" || !ESCALATION_CAUSE_SET.has(input.causeCode)) {
    return escalationDenied("INVALID_CAUSE", "causeCode");
  }
  const cause = input.causeCode as CksEscalationCauseV1;
  if (input.disposition !== CKS_ESCALATION_CAUSE_TO_DISPOSITION_V1[cause]) {
    return escalationDenied("DISPOSITION_MISMATCH", "disposition");
  }
  const triggerResult = validateEscalationTrigger(cause, input.triggerEvidence, input.taskVectorDigest);
  if (triggerResult !== undefined) return triggerResult;
  if (!escalationDigest(input.evidenceDigest)
    || cksEscalationEvidenceDigestV1(input.triggerEvidence) !== input.evidenceDigest) {
    return escalationDenied("DIGEST_MISMATCH", "evidenceDigest");
  }
  if (!escalationDigest(input.receiptDigest)
    || cksEscalationReceiptDigestV1(input) !== input.receiptDigest) {
    return escalationDenied("DIGEST_MISMATCH", "receiptDigest");
  }
  return {
    outcome: "VALID",
    causeCode: cause,
    disposition: input.disposition as CksEscalationDispositionV1,
    evidenceDigest: input.evidenceDigest,
    receiptDigest: input.receiptDigest,
  };
}

/** Short name for callers that treat an escalation record as a receipt. */
export const validateCksEscalationReceiptV1 = validateCksEscalationEvidenceV1;

/** Schema identity for the pure, advisory-only smallest-qualified selector. */
export const CKS_ADVISORY_SELECTOR_SCHEMA_V1 =
  "chimpmaera.dev/cks-advisory-selector/v1" as const;

/** Selection is data only; it cannot invoke, authorize, or reserve anything. */
export const CKS_ADVISORY_SELECTOR_CLAIM_BOUNDARY_V1 =
  "ADVISORY_RECOMMENDATION_ONLY_NO_ROUTE_EXECUTION_NO_AUTHORITY_GRANT_NO_RESOURCE_RESERVATION" as const;

export const CKS_REQUIRED_SCENARIO_TAGS_V1 = [
  "APPLICABILITY",
  "CLAIM_EVIDENCE_COVERAGE",
  "COMPETENCE_LIMIT",
  "CONFLICT",
  "DECOMPOSITION",
  "FRESH_UNKNOWN_DOMAIN",
  "MISSING_KNOWLEDGE",
  "PROCEDURE",
  "SUPERSESSION",
  "UPDATE_COMPLIANCE",
  "VERIFIER_REJECTION",
] as const;

export type CksRequiredScenarioTagV1 = typeof CKS_REQUIRED_SCENARIO_TAGS_V1[number];
export type CksSelectorPolicyDecisionV1 = "ALLOW" | "DENY";
export type CksSelectorEvidenceStatusV1 = "POSITIVE" | "UNKNOWN" | "NOT_RUN" | "FAILED";

export interface CksSelectorEvidenceReceiptV1 {
  readonly status: CksSelectorEvidenceStatusV1;
  readonly receiptDigest: string;
}

/**
 * The selector never treats a status/digest pair as qualification evidence.
 * A positive bundle must bind the exact profile and its fresh certification
 * receipt, and state the interval in which the bundle may be consumed.
 */
export interface CksSelectorQualificationEvidenceV1 {
  readonly exactProfileDigest: string;
  readonly qualificationSuiteReceiptDigest: string;
  readonly issuedAtMs: number;
  readonly expiresAtMs: number;
  readonly cks03: CksSelectorEvidenceReceiptV1;
  readonly cks04: CksSelectorEvidenceReceiptV1;
  readonly cks05: CksSelectorEvidenceReceiptV1;
  readonly lineageDigest: string;
}

export interface CksSelectorCatalogAvailabilityV1 {
  readonly status: "AVAILABLE" | "UNAVAILABLE";
  readonly exactProfileDigest: string;
  readonly catalogReceiptDigest: string;
}

export interface CksSelectorResourceAdmissionV1 {
  readonly status: "POSITIVE" | "DENIED";
  readonly exactProfileDigest: string;
  readonly admissionReceiptDigest: string;
}

/** All values used by the ordering key are explicit, bound, safe integers. */
export interface CksAdvisorySelectorCandidateV1 {
  readonly profile: CksCompetenceQualificationProfileV1;
  readonly coverageBox: CksRkpuVectorV1;
  readonly scenarioTags: readonly CksRequiredScenarioTagV1[];
  readonly qualificationEvidence: CksSelectorQualificationEvidenceV1;
  /** Independent risk/impact policy result; never an ordering input. */
  readonly riskImpactPolicy: CksSelectorPolicyDecisionV1;
  /** Independent Authority policy result; never an ordering input. */
  readonly authorityPolicy: CksSelectorPolicyDecisionV1;
  readonly catalogAvailability: CksSelectorCatalogAvailabilityV1;
  readonly resourceAdmission: CksSelectorResourceAdmissionV1;
  readonly qualificationTierOrdinal: number;
  readonly certifiedCoverageBoxCardinality: number;
  readonly reservedCostMicros: number;
  readonly qualifiedP95ElapsedMs: number;
  readonly peakResidentBytes: number;
}

export interface CksAdvisorySelectorInputV1 {
  readonly schemaVersion: typeof CKS_ADVISORY_SELECTOR_SCHEMA_V1;
  /** Explicit evaluation instant; freshness is never inferred from wall-clock time. */
  readonly evidenceAsOfMs: number;
  readonly taskVector: CksRkpuVectorV1;
  readonly candidates: readonly CksAdvisorySelectorCandidateV1[];
}

export type CksAdvisorySelectorReasonV1 =
  | "MALFORMED_INPUT"
  | "DUPLICATE_PROFILE"
  | "NO_ELIGIBLE_CANDIDATE";

export type CksAdvisorySelectorDecisionV1 =
  | {
      readonly schemaVersion: typeof CKS_ADVISORY_SELECTOR_SCHEMA_V1;
      readonly outcome: "ADVISORY_RECOMMENDATION";
      readonly taskVector: CksRkpuVectorV1;
      readonly selectedProfileDigest: string;
      readonly orderingKey: readonly [number, number, number, number, number, string];
      readonly claimBoundary: typeof CKS_ADVISORY_SELECTOR_CLAIM_BOUNDARY_V1;
      readonly decisionDigest: string;
    }
  | {
      readonly schemaVersion: typeof CKS_ADVISORY_SELECTOR_SCHEMA_V1;
      readonly outcome: "NO_QUALIFIED_PROFILE" | "ABSTAIN";
      readonly taskVector?: CksRkpuVectorV1;
      readonly reason: CksAdvisorySelectorReasonV1;
      readonly claimBoundary: typeof CKS_ADVISORY_SELECTOR_CLAIM_BOUNDARY_V1;
      readonly decisionDigest: string;
    };

export type CksAdvisorySelectionResultV1 = CksAdvisorySelectorDecisionV1;
export type CksAdvisoryRouterCandidateV1 = CksAdvisorySelectorCandidateV1;
export type CksAdvisoryRouterInputV1 = CksAdvisorySelectorInputV1;
export type CksAdvisoryRouterDecisionV1 = CksAdvisorySelectorDecisionV1;

const selectorDigest = (value: unknown): string => sha256Hex(canonicalJson(value));
/** Digest qualification evidence without its self-referential lineageDigest field. */
export function cksSelectorQualificationEvidenceLineageDigestV1(
  evidence: Omit<CksSelectorQualificationEvidenceV1, "lineageDigest"> | Record<string, unknown>,
): string {
  return selectorDigest(Object.fromEntries(
    Object.entries(evidence as Record<string, unknown>).filter(([key]) => key !== "lineageDigest"),
  ));
}
const selectorDigestValid = (value: unknown): value is string =>
  typeof value === "string" && ESCALATION_DIGEST_PATTERN.test(value);
const selectorSafeInteger = (value: unknown): value is number =>
  typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
const selectorVector = (value: unknown): value is CksRkpuVectorV1 =>
  Array.isArray(value) && value.length === 4
  && value.every((coordinate) => selectorSafeInteger(coordinate) && coordinate <= 6);
const selectorPlainObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && Object.getPrototypeOf(value) === Object.prototype;
const selectorExactKeys = (value: Record<string, unknown>, expected: readonly string[]): boolean => {
  const actual = Object.keys(value).sort();
  const required = [...expected].sort();
  return actual.length === required.length && actual.every((key, index) => key === required[index]);
};
const selectorBoxCardinality = (box: CksRkpuVectorV1): number =>
  (box[0] + 1) * (box[1] + 1) * (box[2] + 1) * (box[3] + 1);

function selectorCandidateIsEligible(
  candidate: CksAdvisorySelectorCandidateV1,
  taskVector: CksRkpuVectorV1,
  evidenceAsOfMs: number,
): boolean {
  const profileValidation = validateCksCompetenceQualificationProfileV1(candidate.profile);
  if (profileValidation.outcome !== "VALID" || candidate.profile.state !== "QUALIFIED") return false;
  if (!selectorVector(candidate.coverageBox)
    || !candidate.coverageBox.every((coordinate, index) => coordinate >= taskVector[index]!)) return false;
  if (candidate.qualificationTierOrdinal !== Math.max(...candidate.coverageBox)
    || candidate.certifiedCoverageBoxCardinality !== selectorBoxCardinality(candidate.coverageBox)) return false;
  if (candidate.scenarioTags.length !== CKS_REQUIRED_SCENARIO_TAGS_V1.length
    || new Set(candidate.scenarioTags).size !== CKS_REQUIRED_SCENARIO_TAGS_V1.length
    || !CKS_REQUIRED_SCENARIO_TAGS_V1.every((tag) => candidate.scenarioTags.includes(tag))) return false;
  if (candidate.qualificationEvidence.exactProfileDigest !== candidate.profile.profileDigest
    || candidate.qualificationEvidence.qualificationSuiteReceiptDigest
      !== candidate.profile.bindings.qualificationSuite.freshCertificationReceiptDigest
    || candidate.qualificationEvidence.issuedAtMs > evidenceAsOfMs
    || candidate.qualificationEvidence.expiresAtMs <= evidenceAsOfMs
    || candidate.qualificationEvidence.cks03.status !== "POSITIVE"
    || candidate.qualificationEvidence.cks04.status !== "POSITIVE"
    || candidate.qualificationEvidence.cks05.status !== "POSITIVE") return false;
  if (candidate.riskImpactPolicy !== "ALLOW" || candidate.authorityPolicy !== "ALLOW") return false;
  if (candidate.catalogAvailability.status !== "AVAILABLE"
    || candidate.catalogAvailability.exactProfileDigest !== candidate.profile.profileDigest
    || candidate.resourceAdmission.status !== "POSITIVE"
    || candidate.resourceAdmission.exactProfileDigest !== candidate.profile.profileDigest) return false;
  return true;
}

function validateSelectorInput(input: unknown): input is CksAdvisorySelectorInputV1 {
  if (!selectorPlainObject(input)
    || !selectorExactKeys(input, ["schemaVersion", "evidenceAsOfMs", "taskVector", "candidates"])
    || input.schemaVersion !== CKS_ADVISORY_SELECTOR_SCHEMA_V1
    || !selectorSafeInteger(input.evidenceAsOfMs)
    || !selectorVector(input.taskVector)
    || !Array.isArray(input.candidates)
    || input.candidates.length > 64) return false;
  const candidateKeys = [
    "profile", "coverageBox", "scenarioTags", "qualificationEvidence", "riskImpactPolicy", "authorityPolicy",
    "catalogAvailability", "resourceAdmission", "qualificationTierOrdinal", "certifiedCoverageBoxCardinality",
    "reservedCostMicros", "qualifiedP95ElapsedMs", "peakResidentBytes",
  ] as const;
  const evidenceKeys = [
    "exactProfileDigest", "qualificationSuiteReceiptDigest", "issuedAtMs", "expiresAtMs",
    "cks03", "cks04", "cks05", "lineageDigest",
  ] as const;
  const receiptEvidenceKeys = ["cks03", "cks04", "cks05"] as const;
  const receiptKeys = ["status", "receiptDigest"] as const;
  const availabilityKeys = ["status", "exactProfileDigest", "catalogReceiptDigest"] as const;
  const admissionKeys = ["status", "exactProfileDigest", "admissionReceiptDigest"] as const;
  for (const rawCandidate of input.candidates) {
    if (!selectorPlainObject(rawCandidate) || !selectorExactKeys(rawCandidate, candidateKeys)
      || !selectorPlainObject(rawCandidate.qualificationEvidence)
      || !selectorExactKeys(rawCandidate.qualificationEvidence, evidenceKeys)
      || !selectorPlainObject(rawCandidate.catalogAvailability)
      || !selectorExactKeys(rawCandidate.catalogAvailability, availabilityKeys)
      || !selectorPlainObject(rawCandidate.resourceAdmission)
      || !selectorExactKeys(rawCandidate.resourceAdmission, admissionKeys)
      || !selectorVector(rawCandidate.coverageBox)
      || !Array.isArray(rawCandidate.scenarioTags)
      || !rawCandidate.scenarioTags.every((tag) => typeof tag === "string")
      || !selectorSafeInteger(rawCandidate.qualificationTierOrdinal)
      || rawCandidate.qualificationTierOrdinal > 6
      || !selectorSafeInteger(rawCandidate.certifiedCoverageBoxCardinality)
      || !selectorSafeInteger(rawCandidate.reservedCostMicros)
      || !selectorSafeInteger(rawCandidate.qualifiedP95ElapsedMs)
      || !selectorSafeInteger(rawCandidate.peakResidentBytes)
      || !selectorDigestValid(rawCandidate.qualificationEvidence.exactProfileDigest)
      || !selectorDigestValid(rawCandidate.qualificationEvidence.qualificationSuiteReceiptDigest)
      || !selectorSafeInteger(rawCandidate.qualificationEvidence.issuedAtMs)
      || !selectorSafeInteger(rawCandidate.qualificationEvidence.expiresAtMs)
      || rawCandidate.qualificationEvidence.expiresAtMs <= rawCandidate.qualificationEvidence.issuedAtMs
      || !selectorDigestValid(rawCandidate.qualificationEvidence.lineageDigest)
      || cksSelectorQualificationEvidenceLineageDigestV1(rawCandidate.qualificationEvidence)
        !== rawCandidate.qualificationEvidence.lineageDigest
      || (rawCandidate.riskImpactPolicy !== "ALLOW" && rawCandidate.riskImpactPolicy !== "DENY")
      || (rawCandidate.authorityPolicy !== "ALLOW" && rawCandidate.authorityPolicy !== "DENY")
      || (rawCandidate.catalogAvailability.status !== "AVAILABLE" && rawCandidate.catalogAvailability.status !== "UNAVAILABLE")
      || (rawCandidate.resourceAdmission.status !== "POSITIVE" && rawCandidate.resourceAdmission.status !== "DENIED")
      || !selectorDigestValid(rawCandidate.catalogAvailability.exactProfileDigest)
      || !selectorDigestValid(rawCandidate.catalogAvailability.catalogReceiptDigest)
      || !selectorDigestValid(rawCandidate.resourceAdmission.exactProfileDigest)
      || !selectorDigestValid(rawCandidate.resourceAdmission.admissionReceiptDigest)) return false;
    for (const key of receiptEvidenceKeys) {
      const evidence = rawCandidate.qualificationEvidence[key];
      if (!selectorPlainObject(evidence) || !selectorExactKeys(evidence, receiptKeys)
        || !["POSITIVE", "UNKNOWN", "NOT_RUN", "FAILED"].includes(evidence.status as string)
        || !selectorDigestValid(evidence.receiptDigest)) return false;
    }
    const profileValidation = validateCksCompetenceQualificationProfileV1(rawCandidate.profile);
    if (profileValidation.outcome !== "VALID") return false;
  }
  return true;
}

/** Digest a selector decision without its self-referential decisionDigest field. */
export function cksAdvisoryDecisionDigestV1(
  decision: Omit<CksAdvisorySelectorDecisionV1, "decisionDigest"> | Record<string, unknown>,
): string {
  return selectorDigest(Object.fromEntries(
    Object.entries(decision as Record<string, unknown>).filter(([key]) => key !== "decisionDigest"),
  ));
}

/**
 * Select the smallest fully qualified and currently admitted profile. Every
 * eligibility gate is conjunctive; risk/impact and Authority are independent
 * policy filters and never participate in the ordering key.
 */
export function selectSmallestQualifiedProfileV1(input: unknown): CksAdvisorySelectorDecisionV1 {
  if (!validateSelectorInput(input)) {
    const decision = {
      schemaVersion: CKS_ADVISORY_SELECTOR_SCHEMA_V1,
      outcome: "ABSTAIN",
      reason: "MALFORMED_INPUT",
      claimBoundary: CKS_ADVISORY_SELECTOR_CLAIM_BOUNDARY_V1,
    } as const;
    return { ...decision, decisionDigest: cksAdvisoryDecisionDigestV1(decision) };
  }
  const profileDigests = input.candidates.map((candidate) => candidate.profile.profileDigest);
  if (new Set(profileDigests).size !== profileDigests.length) {
    const decision = {
      schemaVersion: CKS_ADVISORY_SELECTOR_SCHEMA_V1,
      outcome: "ABSTAIN",
      taskVector: input.taskVector,
      reason: "DUPLICATE_PROFILE",
      claimBoundary: CKS_ADVISORY_SELECTOR_CLAIM_BOUNDARY_V1,
    } as const;
    return { ...decision, decisionDigest: cksAdvisoryDecisionDigestV1(decision) };
  }
  const eligible = input.candidates.filter((candidate) =>
    selectorCandidateIsEligible(candidate, input.taskVector, input.evidenceAsOfMs));
  const ordered = [...eligible].sort((left, right) => {
    const leftKey = [
      left.qualificationTierOrdinal,
      left.certifiedCoverageBoxCardinality,
      left.reservedCostMicros,
      left.qualifiedP95ElapsedMs,
      left.peakResidentBytes,
      left.profile.profileDigest,
    ] as const;
    const rightKey = [
      right.qualificationTierOrdinal,
      right.certifiedCoverageBoxCardinality,
      right.reservedCostMicros,
      right.qualifiedP95ElapsedMs,
      right.peakResidentBytes,
      right.profile.profileDigest,
    ] as const;
    for (let index = 0; index < leftKey.length; index += 1) {
      if (leftKey[index] === rightKey[index]) continue;
      return leftKey[index]! < rightKey[index]! ? -1 : 1;
    }
    return 0;
  });
  if (ordered.length === 0) {
    const decision = {
      schemaVersion: CKS_ADVISORY_SELECTOR_SCHEMA_V1,
      outcome: "NO_QUALIFIED_PROFILE" as const,
      taskVector: input.taskVector,
      reason: "NO_ELIGIBLE_CANDIDATE" as const,
      claimBoundary: CKS_ADVISORY_SELECTOR_CLAIM_BOUNDARY_V1,
    };
    return { ...decision, decisionDigest: cksAdvisoryDecisionDigestV1(decision) };
  }
  const selected = ordered[0]!;
  const decision = {
    schemaVersion: CKS_ADVISORY_SELECTOR_SCHEMA_V1,
    outcome: "ADVISORY_RECOMMENDATION" as const,
    taskVector: input.taskVector,
    selectedProfileDigest: selected.profile.profileDigest,
    orderingKey: [
      selected.qualificationTierOrdinal,
      selected.certifiedCoverageBoxCardinality,
      selected.reservedCostMicros,
      selected.qualifiedP95ElapsedMs,
      selected.peakResidentBytes,
      selected.profile.profileDigest,
    ] as const,
    claimBoundary: CKS_ADVISORY_SELECTOR_CLAIM_BOUNDARY_V1,
  };
  return { ...decision, decisionDigest: cksAdvisoryDecisionDigestV1(decision) };
}

export const selectCksSmallestQualifiedProfileV1 = selectSmallestQualifiedProfileV1;