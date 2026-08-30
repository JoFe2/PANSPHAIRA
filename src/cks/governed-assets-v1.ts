/**
 * CKS-11 governed asset contracts (v1).
 *
 * Runtime-validatable contracts for WorkflowCandidate, GovernedWorkflow and
 * FunctionCandidate, binding the frozen CKS-11 governance decision
 * (docs/architecture/cks-11-governance-decision-v1.md, the contract source of
 * truth). This module validates and freezes records; it never promotes,
 * activates, deploys, or executes anything. Authority: NONE.
 *
 * Guarantees encoded here:
 * - independent S/W/F maturity axes with exact level names and adjacent-only
 *   transitions (each advance appends a MATURITY_TRANSITION receipt; a level
 *   cannot be skipped or changed in place);
 * - exact immutable dependency references (ExactRef) with closed record kinds,
 *   exact versions (no ranges, no "latest"), SHA-256 digests and duplicate
 *   rejection; set-like reference arrays are digested in normalized
 *   (kind, id, version, digest) order;
 * - applicability, Verification, rollback, Capability and Authority boundary
 *   fields that cannot be widened by any fast path (Capability set containment
 *   and exact Authority grant coverage are evaluated at use time);
 * - GovernedWorkflow body identity: the governed body must match the approved
 *   W6 candidate body digest-for-digest;
 * - immutable deterministic receipts (append-only, digest-chained, idempotent
 *   on identical digest; corrections are successor receipts, never rewrites);
 * - the exact fail-closed fast-path route table (closed statuses and reason
 *   codes; unknown values fail closed).
 */
import { createHash } from "node:crypto";

import { canonicalJson } from "../../packages/contracts/src/canonical-json.js";

/**
 * Schema identifier for every CKS-11 governed asset record and receipt in
 * v1. The frozen decision document predates this schema identifier; records
 * and receipts carry it so that a future v2 cannot be confused with v1 bytes.
 */
export const GOVERNED_ASSETS_SCHEMA_V1 = "pansphaira.cks-11/governed-assets/v1" as const;

export const DIGEST_ALGORITHM_V1 = "SHA-256" as const;

export const RECORD_KINDS_V1 = Object.freeze([
  "WorkflowCandidate",
  "GovernedWorkflow",
  "FunctionCandidate",
]) as readonly ["WorkflowCandidate", "GovernedWorkflow", "FunctionCandidate"];

// ---------------------------------------------------------------------------
// Independent S/W/F maturity axes (exact level names from the frozen
// decision). Only adjacent transitions are legal.
// ---------------------------------------------------------------------------

export const S_MATURITY_LEVELS_V1 = Object.freeze([
  "S0 OBSERVED",
  "S1 REPEATED",
  "S2 STRUCTURED_CANDIDATE",
  "S3 APPLICABILITY_BOUNDED",
  "S4 COUNTEREXAMPLE_TESTED",
  "S5 HOLDOUT_VALIDATED",
  "S6 VALIDATED_PATTERN",
]) as readonly [
  "S0 OBSERVED",
  "S1 REPEATED",
  "S2 STRUCTURED_CANDIDATE",
  "S3 APPLICABILITY_BOUNDED",
  "S4 COUNTEREXAMPLE_TESTED",
  "S5 HOLDOUT_VALIDATED",
  "S6 VALIDATED_PATTERN",
];

export const W_MATURITY_LEVELS_V1 = Object.freeze([
  "W0 COMPILED_CANDIDATE",
  "W1 CONTRACT_BOUND",
  "W2 REPLAY_VERIFIED",
  "W3 COUNTEREXAMPLE_SAFE",
  "W4 APPLICABLE_HOLDOUT_VERIFIED",
  "W5 SHADOW_PARITY_VERIFIED",
  "W6 PROMOTION_ELIGIBLE",
]) as readonly [
  "W0 COMPILED_CANDIDATE",
  "W1 CONTRACT_BOUND",
  "W2 REPLAY_VERIFIED",
  "W3 COUNTEREXAMPLE_SAFE",
  "W4 APPLICABLE_HOLDOUT_VERIFIED",
  "W5 SHADOW_PARITY_VERIFIED",
  "W6 PROMOTION_ELIGIBLE",
];

export const F_MATURITY_LEVELS_V1 = Object.freeze([
  "F0 SUBSTEP_IDENTIFIED",
  "F1 DEPENDENCY_BOUND",
  "F2 CONTRACT_CLOSED",
  "F3 DETERMINISTIC_REPLAY_VERIFIED",
  "F4 COUNTEREXAMPLE_SAFE",
  "F5 SHADOW_PARITY_VERIFIED",
  "F6 PROMOTION_ELIGIBLE",
]) as readonly [
  "F0 SUBSTEP_IDENTIFIED",
  "F1 DEPENDENCY_BOUND",
  "F2 CONTRACT_CLOSED",
  "F3 DETERMINISTIC_REPLAY_VERIFIED",
  "F4 COUNTEREXAMPLE_SAFE",
  "F5 SHADOW_PARITY_VERIFIED",
  "F6 PROMOTION_ELIGIBLE",
];

export type MaturityAxisV1 = "S" | "W" | "F";

// ---------------------------------------------------------------------------
// Assurance status (orthogonal to maturity; the last three are terminal for
// that exact revision; REVALIDATION_REQUIRED may only return to
// VALIDATION_CURRENT via fresh Evidence and an exact revalidation receipt).
// ---------------------------------------------------------------------------

export const ASSURANCE_STATUSES_V1 = Object.freeze([
  "VALIDATION_CURRENT",
  "REVALIDATION_REQUIRED",
  "REJECTED",
  "WITHDRAWN",
  "SUPERSEDED",
]) as readonly [
  "VALIDATION_CURRENT",
  "REVALIDATION_REQUIRED",
  "REJECTED",
  "WITHDRAWN",
  "SUPERSEDED",
];

export const TERMINAL_ASSURANCE_STATUSES_V1 = Object.freeze([
  "REJECTED",
  "WITHDRAWN",
  "SUPERSEDED",
]) as readonly ["REJECTED", "WITHDRAWN", "SUPERSEDED"];

// ---------------------------------------------------------------------------
// Exact reference kinds (closed v1 set).
// ---------------------------------------------------------------------------

export const REF_KINDS_V1 = Object.freeze([
  "APPLICABILITY_CONTRACT",
  "APPROVAL",
  "AUTHORITY_REQUIREMENT",
  "BASELINE_RUN_SET",
  "CAPABILITY_BOUNDARY",
  "COMPILER",
  "COUNTEREXAMPLE_SET",
  "EXCLUSION_SET",
  "EVIDENCE",
  "EXTRACTOR",
  "FALLBACK_PATH",
  "FUNCTION_CANDIDATE",
  "GOVERNED_WORKFLOW",
  "HOLDOUT_SET",
  "KNOWN_FAILURE",
  "KNOWLEDGE_EDITION",
  "LAST_KNOWN_GOOD",
  "LOGIC",
  "METRIC",
  "PARITY_VERIFIER",
  "READBACK",
  "RECEIPT",
  "ROLLBACK_CONTRACT",
  "RUNTIME_CONFIGURATION",
  "SCHEMA",
  "SOLUTION_PATTERN",
  "VERIFICATION_PLAN",
  "VERIFIER",
  "WORKFLOW_CANDIDATE",
]) as readonly [
  "APPLICABILITY_CONTRACT",
  "APPROVAL",
  "AUTHORITY_REQUIREMENT",
  "BASELINE_RUN_SET",
  "CAPABILITY_BOUNDARY",
  "COMPILER",
  "COUNTEREXAMPLE_SET",
  "EXCLUSION_SET",
  "EVIDENCE",
  "EXTRACTOR",
  "FALLBACK_PATH",
  "FUNCTION_CANDIDATE",
  "GOVERNED_WORKFLOW",
  "HOLDOUT_SET",
  "KNOWN_FAILURE",
  "KNOWLEDGE_EDITION",
  "LAST_KNOWN_GOOD",
  "LOGIC",
  "METRIC",
  "PARITY_VERIFIER",
  "READBACK",
  "RECEIPT",
  "ROLLBACK_CONTRACT",
  "RUNTIME_CONFIGURATION",
  "SCHEMA",
  "SOLUTION_PATTERN",
  "VERIFICATION_PLAN",
  "VERIFIER",
  "WORKFLOW_CANDIDATE",
];

const WF_SOURCE_KINDS_V1 = Object.freeze(["SOLUTION_PATTERN"]) as readonly ["SOLUTION_PATTERN"];
const WF_TRANSFORMER_KINDS_V1 = Object.freeze(["COMPILER"]) as readonly ["COMPILER"];
const GW_SOURCE_KINDS_V1 = Object.freeze(["WORKFLOW_CANDIDATE"]) as readonly ["WORKFLOW_CANDIDATE"];
const GW_TRANSFORMER_KINDS_V1 = Object.freeze(["COMPILER"]) as readonly ["COMPILER"];
const FUNC_SOURCE_KINDS_V1 = Object.freeze([
  "GOVERNED_WORKFLOW",
  "WORKFLOW_CANDIDATE",
]) as readonly ["GOVERNED_WORKFLOW", "WORKFLOW_CANDIDATE"];
const FUNC_TRANSFORMER_KINDS_V1 = Object.freeze(["EXTRACTOR"]) as readonly ["EXTRACTOR"];
const WORKFLOW_DEPENDENCY_KINDS_V1 = Object.freeze([
  "WORKFLOW_CANDIDATE",
  "GOVERNED_WORKFLOW",
]) as readonly ["WORKFLOW_CANDIDATE", "GOVERNED_WORKFLOW"];
const SUBJECT_REF_KINDS_V1 = Object.freeze([
  "SOLUTION_PATTERN",
  "KNOWLEDGE_EDITION",
  "WORKFLOW_CANDIDATE",
  "GOVERNED_WORKFLOW",
  "FUNCTION_CANDIDATE",
]) as readonly [
  "SOLUTION_PATTERN",
  "KNOWLEDGE_EDITION",
  "WORKFLOW_CANDIDATE",
  "GOVERNED_WORKFLOW",
  "FUNCTION_CANDIDATE",
];
const ENVIRONMENT_REF_KINDS_V1 = Object.freeze([
  "COMPILER",
  "EXTRACTOR",
  "METRIC",
  "RUNTIME_CONFIGURATION",
  "VERIFIER",
]) as readonly ["COMPILER", "EXTRACTOR", "METRIC", "RUNTIME_CONFIGURATION", "VERIFIER"];

// ---------------------------------------------------------------------------
// Receipt kinds (closed v1). ACTIVATION is future-evidence-only and is NOT
// authorized in this slice.
// ---------------------------------------------------------------------------

export const RECEIPT_KINDS_V1 = Object.freeze([
  "MATURITY_TRANSITION",
  "VERIFICATION",
  "FAST_PATH_DECISION",
  "INVALIDATION",
  "REVALIDATION",
  "PROMOTION",
  "ACTIVATION",
  "ROLLBACK",
]) as readonly [
  "MATURITY_TRANSITION",
  "VERIFICATION",
  "FAST_PATH_DECISION",
  "INVALIDATION",
  "REVALIDATION",
  "PROMOTION",
  "ACTIVATION",
  "ROLLBACK",
];

export type ReceiptKindV1 = (typeof RECEIPT_KINDS_V1)[number];

// ---------------------------------------------------------------------------
// Fail-closed fast-path route table (exact, closed). FAST_PATH_ALLOWED
// carries only the reason NONE.
// ---------------------------------------------------------------------------

export const FAST_PATH_ROUTE_STATUSES_V1 = Object.freeze([
  "FAST_PATH_ALLOWED",
  "FAST_PATH_ABORTED",
  "REVALIDATION_REQUIRED",
]) as readonly ["FAST_PATH_ALLOWED", "FAST_PATH_ABORTED", "REVALIDATION_REQUIRED"];

export type FastPathRouteStatusV1 = (typeof FAST_PATH_ROUTE_STATUSES_V1)[number];

export const FAST_PATH_ROUTE_REASON_CODES_V1 = Object.freeze([
  "NONE",
  "MISSING_INPUT",
  "INVALID_INPUT",
  "NOT_APPLICABLE",
  "AMBIGUOUS_MATCH",
  "KNOWLEDGE_MISSING",
  "STALE_KNOWLEDGE",
  "KNOWLEDGE_SUPERSEDED",
  "VERSION_DRIFT",
  "DIGEST_MISMATCH",
  "EVIDENCE_INCOMPLETE",
  "BOUNDARY_UNAVAILABLE",
  "CAPABILITY_WIDENING",
  "AUTHORITY_WIDENING",
  "INVALID_CONTRACT",
]) as readonly [
  "NONE",
  "MISSING_INPUT",
  "INVALID_INPUT",
  "NOT_APPLICABLE",
  "AMBIGUOUS_MATCH",
  "KNOWLEDGE_MISSING",
  "STALE_KNOWLEDGE",
  "KNOWLEDGE_SUPERSEDED",
  "VERSION_DRIFT",
  "DIGEST_MISMATCH",
  "EVIDENCE_INCOMPLETE",
  "BOUNDARY_UNAVAILABLE",
  "CAPABILITY_WIDENING",
  "AUTHORITY_WIDENING",
  "INVALID_CONTRACT",
];

export type RouteReasonCodeV1 = (typeof FAST_PATH_ROUTE_REASON_CODES_V1)[number];

// Closed gate-value sets for the route evaluator input.
export const FAST_PATH_INPUT_COMPLETENESS_STATUSES_V1 = Object.freeze([
  "COMPLETE",
  "MISSING",
]) as readonly ["COMPLETE", "MISSING"];
export const FAST_PATH_KNOWLEDGE_STATUSES_V1 = Object.freeze([
  "CURRENT",
  "MISSING",
  "UNAVAILABLE",
  "EXPIRED",
  "SUPERSEDED",
  "REVOKED",
]) as readonly ["CURRENT", "MISSING", "UNAVAILABLE", "EXPIRED", "SUPERSEDED", "REVOKED"];
export const FAST_PATH_VERSION_STATUSES_V1 = Object.freeze(["EXACT", "DRIFTED"]) as readonly [
  "EXACT",
  "DRIFTED",
];
export const FAST_PATH_DIGEST_STATUSES_V1 = Object.freeze(["MATCH", "MISMATCH"]) as readonly [
  "MATCH",
  "MISMATCH",
];
export const FAST_PATH_EVIDENCE_STATUSES_V1 = Object.freeze([
  "COMPLETE",
  "INCOMPLETE",
]) as readonly ["COMPLETE", "INCOMPLETE"];
export const FAST_PATH_BOUNDARY_STATUSES_V1 = Object.freeze([
  "AVAILABLE",
  "UNAVAILABLE",
]) as readonly ["AVAILABLE", "UNAVAILABLE"];
export const FAST_PATH_STOP_STATES_V1 = Object.freeze(["NONE", "STOPPED"]) as readonly [
  "NONE",
  "STOPPED",
];

// Per-step abort behavior: a step can only abort to a fail-closed route.
export const ABORT_ROUTE_STATUSES_V1 = Object.freeze([
  "FAST_PATH_ABORTED",
  "REVALIDATION_REQUIRED",
]) as readonly ["FAST_PATH_ABORTED", "REVALIDATION_REQUIRED"];

export const LOGIC_KINDS_V1 = Object.freeze(["PURE", "PROPOSAL_ONLY"]) as readonly [
  "PURE",
  "PROPOSAL_ONLY",
];

// A receipt records a decision that was made; an undecided state is not a
// receipt. Exact decision status: approved (reason codes exactly ["NONE"])
// or denied (at least one real reason, never NONE).
export const DECISION_STATUSES_V1 = Object.freeze([
  "APPROVED",
  "DENIED",
]) as readonly ["APPROVED", "DENIED"];

// ---------------------------------------------------------------------------
// Canonicalization binding. The canonical JSON primitive is frozen in the
// repository; records bind its exact version and digest so a changed
// canonicalization invalidates every dependent record (fail closed).
// ---------------------------------------------------------------------------

export const CANONICALIZATION_REF_V1 = Object.freeze({
  name: "chimpmaera.canonical/json/v1",
  path: "packages/contracts/src/canonical-json.ts",
  version: "1",
  // sha256 of packages/contracts/src/canonical-json.ts (frozen).
  digest: "666513ba9a89c0eae0daa0e0159a262eb4e0aa105971a151a19bac1a9b6c4826",
}) as {
  readonly name: "chimpmaera.canonical/json/v1";
  readonly path: "packages/contracts/src/canonical-json.ts";
  readonly version: "1";
  readonly digest: "666513ba9a89c0eae0daa0e0159a262eb4e0aa105971a151a19bac1a9b6c4826";
};

// ---------------------------------------------------------------------------
// Closed record field sets.
// ---------------------------------------------------------------------------

const COMMON_RECORD_FIELDS_V1 = [
  "schemaVersion",
  "recordKind",
  "artifactId",
  "artifactVersion",
  "maturity",
  "assuranceStatus",
  "artifactDigest",
  "predecessorRef",
  "supersessionReason",
  "canonicalizationRef",
  "digestAlgorithm",
  "sourceRef",
  "transformerRef",
  "applicabilityContractRef",
  "applicabilityResultDigest",
  "invalidationReceiptRefs",
  "promotionReceiptRefs",
  "verificationReceiptRefs",
] as const;

const RECEIPT_REF_ARRAY_FIELDS_V1 = [
  "invalidationReceiptRefs",
  "promotionReceiptRefs",
  "verificationReceiptRefs",
] as const;

const WORKFLOW_CANDIDATE_KEYS_V1 = [
  ...COMMON_RECORD_FIELDS_V1,
  "sourcePatternValidationReceiptRef",
  "body",
  "bodyDigest",
  "eligibilityReceiptRef",
] as const;

const GOVERNED_WORKFLOW_KEYS_V1 = [
  ...COMMON_RECORD_FIELDS_V1,
  "sourceCandidateBodyDigest",
  "promotionApprovalRef",
  "promotionReceiptRef",
  "body",
  "bodyDigest",
] as const;

const FUNCTION_CANDIDATE_KEYS_V1 = [
  ...COMMON_RECORD_FIELDS_V1,
  "sourceStepIds",
  "sourceSubgraphDigest",
  "sourceSubstepClosureDigest",
  "inputSchemaRef",
  "outputSchemaRef",
  "logicRef",
  "logicAlgorithmVersion",
  "logicImplementationDigest",
  "logicKind",
  "capabilityRequestDigest",
  "errorContract",
  "knowledgeDependencies",
  "knowledgeDependencySetDigest",
  "workflowDependencies",
  "workflowDependencySetDigest",
  "functionDependencies",
  "functionDependencySetDigest",
  "transitiveClosureDigest",
  "verificationPlanRef",
  "evidenceRefs",
  "capabilityBoundaryRef",
  "capabilityCeilingDigest",
  "authorityRequirementRef",
  "authorityRequirementDigest",
  "rollbackContract",
  "knownFailureRefs",
  "exclusionRefs",
  "counterexampleSetRefs",
  "originalStepFallbackRef",
  "parityVerifierRef",
  "parityEvidenceRefs",
  "extractionRationale",
  "eligibilityReceiptRef",
  "fallbackReadbackRef",
] as const;

const WORKFLOW_BODY_KEYS_V1 = [
  "stepGraph",
  "materialContextDimensions",
  "inputContractRef",
  "outputContractRef",
  "preconditionContractRef",
  "postconditionContractRef",
  "errorContract",
  "terminalSuccess",
  "shadowPlan",
  "originalPathRef",
  "fallbackPathRef",
  "knowledgeDependencies",
  "knowledgeDependencySetDigest",
  "workflowDependencies",
  "workflowDependencySetDigest",
  "functionDependencies",
  "functionDependencySetDigest",
  "transitiveClosureDigest",
  "verificationPlanRef",
  "evidenceRefs",
  "capabilityBoundaryRef",
  "capabilityCeilingDigest",
  "authorityRequirementRef",
  "authorityRequirementDigest",
  "rollbackContract",
  "knownFailureRefs",
  "exclusionRefs",
  "counterexampleSetRefs",
] as const;

const STEP_GRAPH_KEYS_V1 = ["steps", "edges", "orderingRules", "graphDigest"] as const;
const WORKFLOW_STEP_KEYS_V1 = [
  "stepId",
  "knowledgeReads",
  "decisionContractRef",
  "capabilityProposalRef",
  "verificationCheckpointRef",
  "abortBehavior",
] as const;
const ABORT_BEHAVIOR_KEYS_V1 = ["routeStatus", "reasonCode"] as const;
const STEP_EDGE_KEYS_V1 = ["fromStepId", "toStepId"] as const;
const TERMINAL_SUCCESS_KEYS_V1 = [
  "successCriteriaRef",
  "readbackRequired",
  "readbackRefs",
] as const;
const SHADOW_PLAN_KEYS_V1 = [
  "baselineRef",
  "qualityMetricRef",
  "reasoningCostMetricRef",
  "holdoutRefs",
  "counterexampleRefs",
] as const;
const ERROR_CONTRACT_KEYS_V1 = ["errorTypeRefs"] as const;
const ROLLBACK_CONTRACT_KEYS_V1 = ["kind", "contractRef", "lastKnownGoodRef"] as const;
const ROLLBACK_NOT_APPLICABLE_KEYS_V1 = [
  "kind",
  "evidenceRef",
  "justification",
] as const;
const KNOWLEDGE_DEPENDENCY_KEYS_V1 = [
  "recordId",
  "schemaVersion",
  "edition",
  "contentDigest",
  "applicabilityDigest",
  "evidenceDigest",
  "validFromMs",
  "validUntilMs",
  "supersessionLineage",
] as const;
const CAPABILITY_FIELD_KEYS_V1 = [
  "action",
  "dataClass",
  "credentialUse",
  "effectClass",
  "field",
  "networkRoute",
  "purpose",
  "resource",
  "target",
  "tenant",
] as const;
const AUTHORITY_REQUIREMENT_KEYS_V1 = [
  "actor",
  "tenant",
  "action",
  "target",
  "scope",
] as const;
const AUTHORITY_GRANT_KEYS_V1 = [
  "actor",
  "tenant",
  "action",
  "target",
  "scope",
  "approvalDigest",
  "validFromMs",
  "validUntilMs",
  "budgetLimitCents",
] as const;
const EXACT_REF_KEYS_V1 = [
  "kind",
  "id",
  "schemaVersion",
  "version",
  "digestAlgorithm",
  "digest",
] as const;
const CANONICALIZATION_REF_KEYS_V1 = ["name", "path", "version", "digest"] as const;
const MATURITY_KEYS_V1 = ["axis", "level", "transitionReceiptRefs"] as const;
const MATURITY_STATE_KEYS_V1 = ["axis", "level"] as const;

const RECEIPT_KEYS_V1 = [
  "schemaVersion",
  "receiptKind",
  "receiptId",
  "subjectRef",
  "priorMaturity",
  "resultingMaturity",
  "priorAssuranceStatus",
  "resultingAssuranceStatus",
  "decisionStatus",
  "reasonCodes",
  "requestDigest",
  "contextDigest",
  "applicabilityResultDigest",
  "knowledgeDependencySetDigest",
  "workflowDependencySetDigest",
  "functionDependencySetDigest",
  "transitiveClosureDigest",
  "capabilityCeilingDigest",
  "capabilityUsedSetDigest",
  "authorityRequirementDigest",
  "effectiveAuthorityEnvelopeDigest",
  "verificationPlanRef",
  "evidenceRefs",
  "verifierRef",
  "rollbackContractRef",
  "lastKnownGoodRef",
  "approvalRef",
  "activationApprovalRef",
  "environmentRefs",
  "previousReceiptDigest",
  "recordedTimeMs",
  "decisionDigest",
  "receiptDigest",
] as const;

const FAST_PATH_INPUT_KEYS_V1 = [
  "useTimeMs",
  "contextDigest",
  "matchedGovernedWorkflowRefs",
  "inputCompletenessStatus",
  "knowledgeStatus",
  "versionStatus",
  "digestStatus",
  "evidenceStatus",
  "boundaryStatus",
  "capabilityCeiling",
  "policyEnabledCapabilities",
  "requestedCapabilities",
  "authorityRequirements",
  "envelopeGrants",
  "stopState",
] as const;

// ---------------------------------------------------------------------------
// Denial vocabulary for closed-schema validation. Deterministic ordering:
// the fixed declaration order below is the denial order.
// ---------------------------------------------------------------------------

export const VALIDATION_REASON_CODES_V1 = Object.freeze([
  "SCHEMA_VERSION_MISMATCH",
  "RECORD_KIND_MISMATCH",
  "BAD_CANONICALIZATION_REF",
  "BAD_SHAPE",
  "MISSING_FIELD",
  "UNKNOWN_FIELD",
  "BAD_STRING",
  "BAD_NUMBER",
  "BAD_DIGEST",
  "REF_KIND_MISMATCH",
  "DUPLICATE_REF",
  "MATURITY_AXIS_MISMATCH",
  "MATURITY_LEVEL_INVALID",
  "MATURITY_TRANSITION_EVIDENCE_MISMATCH",
  "ASSURANCE_STATUS_INVALID",
  "PREDECESSOR_BINDING_INVALID",
  "GRAPH_DIGEST_MISMATCH",
  "STEP_GRAPH_INVALID",
  "DEPENDENCY_SET_DIGEST_MISMATCH",
  "KNOWLEDGE_DEPENDENCY_INVALID",
  "TRANSITIVE_CLOSURE_DRIFT",
  "TERMINAL_SUCCESS_BINDING_INVALID",
  "SHADOW_PLAN_BINDING_INVALID",
  "ROLLBACK_BINDING_INVALID",
  "LOGIC_BINDING_INVALID",
  "PROMOTION_BINDING_INVALID",
  "RECEIPT_BINDING_INVALID",
  "BODY_DIGEST_MISMATCH",
  "DIGEST_MISMATCH",
  "INVALID_CONTRACT",
]) as readonly [
  "SCHEMA_VERSION_MISMATCH",
  "RECORD_KIND_MISMATCH",
  "BAD_CANONICALIZATION_REF",
  "BAD_SHAPE",
  "MISSING_FIELD",
  "UNKNOWN_FIELD",
  "BAD_STRING",
  "BAD_NUMBER",
  "BAD_DIGEST",
  "REF_KIND_MISMATCH",
  "DUPLICATE_REF",
  "MATURITY_AXIS_MISMATCH",
  "MATURITY_LEVEL_INVALID",
  "MATURITY_TRANSITION_EVIDENCE_MISMATCH",
  "ASSURANCE_STATUS_INVALID",
  "PREDECESSOR_BINDING_INVALID",
  "GRAPH_DIGEST_MISMATCH",
  "STEP_GRAPH_INVALID",
  "DEPENDENCY_SET_DIGEST_MISMATCH",
  "KNOWLEDGE_DEPENDENCY_INVALID",
  "TRANSITIVE_CLOSURE_DRIFT",
  "TERMINAL_SUCCESS_BINDING_INVALID",
  "SHADOW_PLAN_BINDING_INVALID",
  "ROLLBACK_BINDING_INVALID",
  "LOGIC_BINDING_INVALID",
  "PROMOTION_BINDING_INVALID",
  "RECEIPT_BINDING_INVALID",
  "BODY_DIGEST_MISMATCH",
  "DIGEST_MISMATCH",
  "INVALID_CONTRACT",
];

export type ValidationReasonCodeV1 = (typeof VALIDATION_REASON_CODES_V1)[number];

const REJECTION_EXIT_BASE = 200;
const NONE_REASON_CODES: readonly ["NONE"] = Object.freeze(["NONE"] as const);

// ---------------------------------------------------------------------------
// Result types (house style: deterministic ACCEPTED / REJECTED, ordered
// denial codes, stable exit code derived from the leading denial code).
// ---------------------------------------------------------------------------

export interface AcceptedResultV1<T> {
  readonly outcome: "ACCEPTED";
  readonly reasonCodes: readonly ["NONE"];
  readonly exitCode: 0;
  /** Frozen (deep-immutable) validated record. */
  readonly record: T;
}

export interface RejectedResultV1 {
  readonly outcome: "REJECTED";
  /** Denial codes in deterministic VALIDATION_REASON_CODES_V1 order. */
  readonly reasonCodes: readonly ValidationReasonCodeV1[];
  /** 201..230, derived from the leading denial code. */
  readonly exitCode: number;
}

export type GovernedAssetVerificationResultV1<T> = AcceptedResultV1<T> | RejectedResultV1;

// ---------------------------------------------------------------------------
// Types for the validated record shapes.
// ---------------------------------------------------------------------------

export interface ExactRefV1 {
  readonly kind: string;
  readonly id: string;
  readonly schemaVersion: string;
  readonly version: string;
  readonly digestAlgorithm: string;
  readonly digest: string;
}

export interface CanonicalizationRefV1 {
  readonly name: string;
  readonly path: string;
  readonly version: string;
  readonly digest: string;
}

export interface MaturityStateV1 {
  readonly axis: MaturityAxisV1;
  readonly level: string;
}

export interface MaturityV1 extends MaturityStateV1 {
  /** One MATURITY_TRANSITION receipt per advance from level 0 (length === level index). */
  readonly transitionReceiptRefs: readonly ExactRefV1[];
}

export interface KnowledgeDependencyV1 {
  readonly recordId: string;
  readonly schemaVersion: string;
  readonly edition: string;
  readonly contentDigest: string;
  readonly applicabilityDigest: string;
  readonly evidenceDigest: string;
  readonly validFromMs: number;
  readonly validUntilMs: number;
  readonly supersessionLineage: readonly string[];
}

export interface WorkflowStepAbortBehaviorV1 {
  readonly routeStatus: (typeof ABORT_ROUTE_STATUSES_V1)[number];
  readonly reasonCode: RouteReasonCodeV1;
}

export interface WorkflowStepV1 {
  readonly stepId: string;
  readonly knowledgeReads: readonly ExactRefV1[];
  readonly decisionContractRef: ExactRefV1;
  readonly capabilityProposalRef: ExactRefV1 | null;
  readonly verificationCheckpointRef: ExactRefV1;
  readonly abortBehavior: WorkflowStepAbortBehaviorV1;
}

export interface WorkflowStepEdgeV1 {
  readonly fromStepId: string;
  readonly toStepId: string;
}

export interface WorkflowStepGraphV1 {
  readonly steps: readonly WorkflowStepV1[];
  readonly edges: readonly WorkflowStepEdgeV1[];
  readonly orderingRules: readonly string[];
  readonly graphDigest: string;
}

export interface TerminalSuccessV1 {
  readonly successCriteriaRef: ExactRefV1;
  readonly readbackRequired: boolean;
  readonly readbackRefs: readonly ExactRefV1[];
}

export interface ShadowPlanV1 {
  readonly baselineRef: ExactRefV1;
  readonly qualityMetricRef: ExactRefV1;
  readonly reasoningCostMetricRef: ExactRefV1;
  readonly holdoutRefs: readonly ExactRefV1[];
  readonly counterexampleRefs: readonly ExactRefV1[];
}

export interface WorkflowBodyV1 {
  readonly stepGraph: WorkflowStepGraphV1;
  readonly materialContextDimensions: readonly string[];
  readonly inputContractRef: ExactRefV1;
  readonly outputContractRef: ExactRefV1;
  readonly preconditionContractRef: ExactRefV1;
  readonly postconditionContractRef: ExactRefV1;
  readonly errorContract: { readonly errorTypeRefs: readonly ExactRefV1[] };
  readonly terminalSuccess: TerminalSuccessV1;
  readonly shadowPlan: ShadowPlanV1;
  readonly originalPathRef: ExactRefV1;
  readonly fallbackPathRef: ExactRefV1;
  readonly knowledgeDependencies: readonly KnowledgeDependencyV1[];
  readonly knowledgeDependencySetDigest: string;
  readonly workflowDependencies: readonly ExactRefV1[];
  readonly workflowDependencySetDigest: string;
  readonly functionDependencies: readonly ExactRefV1[];
  readonly functionDependencySetDigest: string;
  readonly transitiveClosureDigest: string;
  readonly verificationPlanRef: ExactRefV1;
  readonly evidenceRefs: readonly ExactRefV1[];
  readonly capabilityBoundaryRef: ExactRefV1;
  readonly capabilityCeilingDigest: string;
  readonly authorityRequirementRef: ExactRefV1;
  readonly authorityRequirementDigest: string;
  readonly rollbackContract:
    | {
        readonly kind: "CONTRACT";
        readonly contractRef: ExactRefV1;
        readonly lastKnownGoodRef: ExactRefV1;
      }
    | {
        readonly kind: "NOT_APPLICABLE";
        readonly evidenceRef: ExactRefV1;
        readonly justification: string;
      };
  readonly knownFailureRefs: readonly ExactRefV1[];
  readonly exclusionRefs: readonly ExactRefV1[];
  readonly counterexampleSetRefs: readonly ExactRefV1[];
}

export interface WorkflowCandidateV1 {
  readonly schemaVersion: string;
  readonly recordKind: "WorkflowCandidate";
  readonly artifactId: string;
  readonly artifactVersion: string;
  readonly maturity: MaturityV1;
  readonly assuranceStatus: (typeof ASSURANCE_STATUSES_V1)[number];
  readonly artifactDigest: string;
  readonly predecessorRef: ExactRefV1 | null;
  readonly supersessionReason: string | null;
  readonly canonicalizationRef: CanonicalizationRefV1;
  readonly digestAlgorithm: string;
  readonly sourceRef: ExactRefV1;
  readonly transformerRef: ExactRefV1;
  readonly applicabilityContractRef: ExactRefV1;
  readonly applicabilityResultDigest: string;
  readonly invalidationReceiptRefs: readonly ExactRefV1[];
  readonly promotionReceiptRefs: readonly ExactRefV1[];
  readonly verificationReceiptRefs: readonly ExactRefV1[];
  readonly sourcePatternValidationReceiptRef: ExactRefV1;
  readonly body: WorkflowBodyV1;
  readonly bodyDigest: string;
  readonly eligibilityReceiptRef: ExactRefV1 | null;
}

export interface GovernedWorkflowV1 {
  readonly schemaVersion: string;
  readonly recordKind: "GovernedWorkflow";
  readonly artifactId: string;
  readonly artifactVersion: string;
  readonly maturity: MaturityV1;
  readonly assuranceStatus: (typeof ASSURANCE_STATUSES_V1)[number];
  readonly artifactDigest: string;
  readonly predecessorRef: ExactRefV1 | null;
  readonly supersessionReason: string | null;
  readonly canonicalizationRef: CanonicalizationRefV1;
  readonly digestAlgorithm: string;
  readonly sourceRef: ExactRefV1;
  readonly transformerRef: ExactRefV1;
  readonly applicabilityContractRef: ExactRefV1;
  readonly applicabilityResultDigest: string;
  readonly invalidationReceiptRefs: readonly ExactRefV1[];
  readonly promotionReceiptRefs: readonly ExactRefV1[];
  readonly verificationReceiptRefs: readonly ExactRefV1[];
  readonly sourceCandidateBodyDigest: string;
  readonly promotionApprovalRef: ExactRefV1;
  readonly promotionReceiptRef: ExactRefV1;
  readonly body: WorkflowBodyV1;
  readonly bodyDigest: string;
}

export interface FunctionCandidateV1 {
  readonly schemaVersion: string;
  readonly recordKind: "FunctionCandidate";
  readonly artifactId: string;
  readonly artifactVersion: string;
  readonly maturity: MaturityV1;
  readonly assuranceStatus: (typeof ASSURANCE_STATUSES_V1)[number];
  readonly artifactDigest: string;
  readonly predecessorRef: ExactRefV1 | null;
  readonly supersessionReason: string | null;
  readonly canonicalizationRef: CanonicalizationRefV1;
  readonly digestAlgorithm: string;
  readonly sourceRef: ExactRefV1;
  readonly transformerRef: ExactRefV1;
  readonly applicabilityContractRef: ExactRefV1;
  readonly applicabilityResultDigest: string;
  readonly invalidationReceiptRefs: readonly ExactRefV1[];
  readonly promotionReceiptRefs: readonly ExactRefV1[];
  readonly verificationReceiptRefs: readonly ExactRefV1[];
  readonly sourceStepIds: readonly string[];
  readonly sourceSubgraphDigest: string;
  readonly sourceSubstepClosureDigest: string;
  readonly inputSchemaRef: ExactRefV1;
  readonly outputSchemaRef: ExactRefV1;
  readonly logicRef: ExactRefV1;
  readonly logicAlgorithmVersion: string;
  readonly logicImplementationDigest: string;
  readonly logicKind: (typeof LOGIC_KINDS_V1)[number];
  readonly capabilityRequestDigest: string | null;
  readonly errorContract: { readonly errorTypeRefs: readonly ExactRefV1[] };
  readonly knowledgeDependencies: readonly KnowledgeDependencyV1[];
  readonly knowledgeDependencySetDigest: string;
  readonly workflowDependencies: readonly ExactRefV1[];
  readonly workflowDependencySetDigest: string;
  readonly functionDependencies: readonly ExactRefV1[];
  readonly functionDependencySetDigest: string;
  readonly transitiveClosureDigest: string;
  readonly verificationPlanRef: ExactRefV1;
  readonly evidenceRefs: readonly ExactRefV1[];
  readonly capabilityBoundaryRef: ExactRefV1;
  readonly capabilityCeilingDigest: string;
  readonly authorityRequirementRef: ExactRefV1;
  readonly authorityRequirementDigest: string;
  readonly rollbackContract: WorkflowBodyV1["rollbackContract"];
  readonly knownFailureRefs: readonly ExactRefV1[];
  readonly exclusionRefs: readonly ExactRefV1[];
  readonly counterexampleSetRefs: readonly ExactRefV1[];
  readonly originalStepFallbackRef: ExactRefV1;
  readonly parityVerifierRef: ExactRefV1;
  readonly parityEvidenceRefs: readonly ExactRefV1[];
  readonly extractionRationale: string;
  readonly eligibilityReceiptRef: ExactRefV1 | null;
  readonly fallbackReadbackRef: ExactRefV1 | null;
}

export interface CapabilityV1 {
  readonly action: string | null;
  readonly dataClass: string | null;
  readonly credentialUse: string | null;
  readonly effectClass: string | null;
  readonly field: string | null;
  readonly networkRoute: string | null;
  readonly purpose: string | null;
  readonly resource: string | null;
  readonly target: string | null;
  readonly tenant: string | null;
}

export interface AuthorityRequirementV1 {
  readonly actor: string;
  readonly tenant: string;
  readonly action: string;
  readonly target: string;
  readonly scope: string | null;
}

export interface AuthorityGrantV1 {
  readonly actor: string;
  readonly tenant: string;
  readonly action: string;
  readonly target: string;
  readonly scope: string | null;
  readonly approvalDigest: string;
  readonly validFromMs: number;
  readonly validUntilMs: number;
  readonly budgetLimitCents: number | null;
}

export interface FastPathRouteInputV1 {
  readonly useTimeMs: number;
  readonly contextDigest: string;
  readonly matchedGovernedWorkflowRefs: readonly ExactRefV1[];
  readonly inputCompletenessStatus: (typeof FAST_PATH_INPUT_COMPLETENESS_STATUSES_V1)[number];
  readonly knowledgeStatus: (typeof FAST_PATH_KNOWLEDGE_STATUSES_V1)[number];
  readonly versionStatus: (typeof FAST_PATH_VERSION_STATUSES_V1)[number];
  readonly digestStatus: (typeof FAST_PATH_DIGEST_STATUSES_V1)[number];
  readonly evidenceStatus: (typeof FAST_PATH_EVIDENCE_STATUSES_V1)[number];
  readonly boundaryStatus: (typeof FAST_PATH_BOUNDARY_STATUSES_V1)[number];
  readonly capabilityCeiling: readonly CapabilityV1[];
  readonly policyEnabledCapabilities: readonly CapabilityV1[];
  readonly requestedCapabilities: readonly CapabilityV1[];
  readonly authorityRequirements: readonly AuthorityRequirementV1[];
  readonly envelopeGrants: readonly AuthorityGrantV1[];
  readonly stopState: (typeof FAST_PATH_STOP_STATES_V1)[number];
}

export interface FastPathRouteDecisionV1 {
  readonly status: FastPathRouteStatusV1;
  readonly reasonCodes: readonly RouteReasonCodeV1[];
  readonly decisionDigest: string;
}

export interface GovernedAssetReceiptV1 {
  readonly schemaVersion: string;
  readonly receiptKind: ReceiptKindV1;
  readonly receiptId: string;
  readonly subjectRef: ExactRefV1;
  readonly priorMaturity: MaturityStateV1 | null;
  readonly resultingMaturity: MaturityStateV1 | null;
  readonly priorAssuranceStatus: string | null;
  readonly resultingAssuranceStatus: string | null;
  readonly decisionStatus: (typeof DECISION_STATUSES_V1)[number];
  readonly reasonCodes: readonly RouteReasonCodeV1[];
  readonly requestDigest: string;
  readonly contextDigest: string;
  readonly applicabilityResultDigest: string | null;
  readonly knowledgeDependencySetDigest: string;
  readonly workflowDependencySetDigest: string;
  readonly functionDependencySetDigest: string;
  readonly transitiveClosureDigest: string;
  readonly capabilityCeilingDigest: string;
  readonly capabilityUsedSetDigest: string | null;
  readonly authorityRequirementDigest: string;
  readonly effectiveAuthorityEnvelopeDigest: string | null;
  readonly verificationPlanRef: ExactRefV1 | null;
  readonly evidenceRefs: readonly ExactRefV1[];
  readonly verifierRef: ExactRefV1 | null;
  readonly rollbackContractRef: ExactRefV1 | null;
  readonly lastKnownGoodRef: ExactRefV1 | null;
  readonly approvalRef: ExactRefV1 | null;
  readonly activationApprovalRef: ExactRefV1 | null;
  readonly environmentRefs: readonly ExactRefV1[];
  readonly previousReceiptDigest: string | null;
  readonly recordedTimeMs: number;
  readonly decisionDigest: string;
  readonly receiptDigest: string;
}

// ---------------------------------------------------------------------------
// Safe JSON plumbing (house style).
// ---------------------------------------------------------------------------

const DIGEST = /^[a-f0-9]{64}$/;
const DANGEROUS_KEYS = new Set(["__proto__", "prototype", "constructor"]);

function isPlainDataRecord(value: unknown): value is Record<string, unknown> {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) return false;
  for (const key of Reflect.ownKeys(value)) {
    if (typeof key !== "string" || DANGEROUS_KEYS.has(key)) return false;
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (descriptor === undefined || !("value" in descriptor) || descriptor.enumerable !== true) {
      return false;
    }
  }
  return true;
}

function isDenseStandardArray(value: unknown): value is unknown[] {
  if (!Array.isArray(value)) return false;
  if (Object.getPrototypeOf(value) !== Array.prototype) return false;
  const keys = Reflect.ownKeys(value);
  if (keys.length !== value.length + 1) return false;
  for (let index = 0; index < value.length; index += 1) {
    const descriptor = Object.getOwnPropertyDescriptor(value, index);
    if (descriptor === undefined || !("value" in descriptor) || descriptor.enumerable !== true) {
      return false;
    }
  }
  const lengthDescriptor = Object.getOwnPropertyDescriptor(value, "length");
  if (
    lengthDescriptor === undefined ||
    !("value" in lengthDescriptor) ||
    lengthDescriptor.enumerable !== false
  ) {
    return false;
  }
  return true;
}

function keyMismatch(
  value: unknown,
  keys: readonly string[],
): { readonly missing: string[]; readonly extra: string[] } | null {
  if (!isPlainDataRecord(value)) return null;
  const actual = Object.keys(value);
  const missing = keys.filter((key) => !actual.includes(key)).sort();
  const extra = actual.filter((key) => !keys.includes(key)).sort();
  return { missing, extra };
}

function safeObject(
  entries: readonly (readonly [string, unknown])[],
  nullPrototypeObjects = false,
): Record<string, unknown> {
  const object = nullPrototypeObjects ? Object.create(null) : {};
  for (const [key, value] of entries) {
    if (DANGEROUS_KEYS.has(key)) throw new TypeError("UNSAFE_JSON_OBJECT_KEY");
    if (Object.prototype.hasOwnProperty.call(object, key)) {
      throw new TypeError("UNSAFE_JSON_OBJECT_KEY");
    }
    Object.defineProperty(object, key, {
      value,
      writable: true,
      enumerable: true,
      configurable: true,
    });
  }
  return object;
}

function safeJsonClone<T>(
  value: T,
  nullPrototypeObjects = false,
  ancestors = new Set<object>(),
): T {
  if (value === null || typeof value === "string" || typeof value === "boolean") return value;
  if (typeof value === "number") {
    if (
      Object.is(value, -0) ||
      !Number.isFinite(value) ||
      (Number.isInteger(value) && !Number.isSafeInteger(value))
    ) {
      throw new TypeError("UNSAFE_JSON_NUMBER");
    }
    return value;
  }
  if (Array.isArray(value)) {
    if (!isDenseStandardArray(value) || ancestors.has(value)) {
      throw new TypeError("UNSAFE_JSON_ARRAY");
    }
    ancestors.add(value);
    const clone = value.map((entry) => safeJsonClone(entry, nullPrototypeObjects, ancestors));
    ancestors.delete(value);
    return clone as T;
  }
  if (!isPlainDataRecord(value) || ancestors.has(value)) {
    throw new TypeError("UNSAFE_JSON_OBJECT");
  }
  ancestors.add(value);
  const clone = safeObject(
    Object.entries(value).map(([key, entry]) => [key, safeJsonClone(entry, nullPrototypeObjects, ancestors)] as const),
    nullPrototypeObjects,
  );
  ancestors.delete(value);
  return clone as T;
}

function deepFreeze<T>(value: T): T {
  if (value === null || typeof value !== "object") return value;
  for (const key of Reflect.ownKeys(value)) {
    const inner = (value as Record<PropertyKey, unknown>)[key];
    if (typeof inner === "object" && inner !== null) deepFreeze(inner);
  }
  return Object.freeze(value);
}

function immutable<T>(value: T): T {
  return deepFreeze(safeJsonClone(value));
}

function isDigest(value: unknown): value is string {
  return typeof value === "string" && DIGEST.test(value);
}

function isTimestamp(value: unknown): value is number {
  return (
    typeof value === "number" &&
    Number.isSafeInteger(value) &&
    !Object.is(value, -0) &&
    value >= 0
  );
}

function isNonNegativeSafeInteger(value: unknown): value is number {
  return isTimestamp(value);
}

function isExactString(value: unknown, maxLength: number): value is string {
  if (typeof value !== "string" || value.length === 0 || value.length > maxLength) return false;
  if (value !== value.trim()) return false;
  if (/[\u0000-\u001f\u007f]/.test(value)) return false;
  return true;
}

/** Exact immutable version token: no ranges, wildcards, or "latest". */
function isExactVersion(value: unknown): value is string {
  return (
    isExactString(value, 64) &&
    !/[~^*<>=|&,\s]/.test(value) &&
    !/(?:^|[./_-])(?:latest|range|x)(?=$|[./_-])/i.test(value)
  );
}

function inClosedSet(value: unknown, set: readonly string[]): boolean {
  return typeof value === "string" && set.includes(value);
}

function sha256Hex(content: string): string {
  return createHash("sha256").update(content).digest("hex");
}

/**
 * Canonical SHA-256 digest of a closed record (or JSON value) under the bound
 * canonicalization, optionally omitting exactly one key (the digest key
 * itself). Throws on unsafe input; callers that need fail-soft behavior use
 * safeDigestOf().
 */
export function governedAssetsDigestV1(value: unknown, omitKey?: string): string {
  if (omitKey !== undefined && DANGEROUS_KEYS.has(omitKey)) {
    throw new TypeError("UNSAFE_DIGEST_KEY");
  }
  const cloned = safeJsonClone(value);
  if (isPlainDataRecord(cloned)) {
    const content = safeObject(
      Object.keys(cloned)
        .filter((key) => key !== omitKey)
        .map((key) => [key, cloned[key]] as const),
    );
    return sha256Hex(canonicalJson(content));
  }
  return sha256Hex(canonicalJson(cloned));
}

/** Fail-soft variant: null when the content is not safe to canonicalize. */
function safeDigestOf(value: unknown, omitKey?: string): string | null {
  try {
    return governedAssetsDigestV1(value, omitKey);
  } catch {
    return null;
  }
}

/**
 * Digest of a set-like reference array, normalized by
 * (kind, id, version, digest) and sorted canonically. Order in the array is
 * therefore irrelevant to the digest; duplicates are rejected separately by
 * the validators.
 */
export function governedAssetsRefSetDigestV1(refs: readonly unknown[]): string {
  const tuples: unknown[][] = [];
  for (const ref of refs) {
    if (!isPlainDataRecord(ref)) throw new TypeError("UNSAFE_REF_SET");
    tuples.push([ref["kind"], ref["id"], ref["version"], ref["digest"]]);
  }
  tuples.sort((a, b) => {
    const left = canonicalJson(a);
    const right = canonicalJson(b);
    return left < right ? -1 : left > right ? 1 : 0;
  });
  return sha256Hex(canonicalJson(tuples));
}

/** Digest of a Knowledge dependency set, normalized by every immutable binding. */
export function governedAssetsKnowledgeSetDigestV1(dependencies: readonly unknown[]): string {
  const tuples: unknown[][] = [];
  for (const dependency of dependencies) {
    if (!isPlainDataRecord(dependency)) throw new TypeError("UNSAFE_KNOWLEDGE_SET");
    tuples.push([
      dependency["recordId"],
      dependency["schemaVersion"],
      dependency["edition"],
      dependency["contentDigest"],
      dependency["applicabilityDigest"],
      dependency["evidenceDigest"],
      dependency["validFromMs"],
      dependency["validUntilMs"],
      dependency["supersessionLineage"],
    ]);
  }
  tuples.sort((a, b) => {
    const left = canonicalJson(a);
    const right = canonicalJson(b);
    return left < right ? -1 : left > right ? 1 : 0;
  });
  return sha256Hex(canonicalJson(tuples));
}

// ---------------------------------------------------------------------------
// Maturity helpers.
// ---------------------------------------------------------------------------

function levelsFor(axis: MaturityAxisV1): readonly string[] {
  return axis === "S" ? S_MATURITY_LEVELS_V1 : axis === "W" ? W_MATURITY_LEVELS_V1 : F_MATURITY_LEVELS_V1;
}

function isKnownLevel(axis: unknown, level: unknown): level is string {
  if (axis !== "S" && axis !== "W" && axis !== "F") return false;
  if (typeof level !== "string") return false;
  return (levelsFor(axis) as readonly string[]).includes(level);
}

/** 0-based index of an exact level, or -1 when the (axis, level) pair is unknown. */
export function maturityLevelIndexV1(axis: MaturityAxisV1, level: string): number {
  return (levelsFor(axis) as readonly string[]).indexOf(level);
}

// ---------------------------------------------------------------------------
// Field validators (accumulate denial codes; never throw on malformed input).
// ---------------------------------------------------------------------------

type CodeSet = Set<ValidationReasonCodeV1>;

function checkRecordKeys(
  value: unknown,
  keys: readonly string[],
  codes: CodeSet,
): Record<string, unknown> | null {
  const mismatch = keyMismatch(value, keys);
  if (mismatch === null) {
    codes.add("BAD_SHAPE");
    return null;
  }
  if (mismatch.missing.length > 0) codes.add("MISSING_FIELD");
  if (mismatch.extra.length > 0) codes.add("UNKNOWN_FIELD");
  return value as Record<string, unknown>;
}

function checkStringField(
  record: Record<string, unknown>,
  field: string,
  maxLength: number,
  codes: CodeSet,
): string | null {
  const value = record[field];
  if (isExactString(value, maxLength)) return value;
  codes.add("BAD_STRING");
  return null;
}

function checkDigestField(
  record: Record<string, unknown>,
  field: string,
  codes: CodeSet,
): string | null {
  const value = record[field];
  if (isDigest(value)) return value;
  codes.add("BAD_DIGEST");
  return null;
}

function checkBoolField(record: Record<string, unknown>, field: string, codes: CodeSet): boolean {
  const value = record[field];
  if (value === true || value === false) return value;
  codes.add("BAD_SHAPE");
  return false;
}

function checkIntField(
  record: Record<string, unknown>,
  field: string,
  codes: CodeSet,
): number | null {
  const value = record[field];
  if (isNonNegativeSafeInteger(value)) return value;
  codes.add("BAD_NUMBER");
  return null;
}

function validateExactRef(
  value: unknown,
  allowedKinds: readonly string[],
  codes: CodeSet,
): boolean {
  const mismatch = keyMismatch(value, EXACT_REF_KEYS_V1);
  if (mismatch === null) {
    codes.add("BAD_SHAPE");
    return false;
  }
  let ok = true;
  if (mismatch.missing.length > 0) codes.add("MISSING_FIELD");
  if (mismatch.extra.length > 0) codes.add("UNKNOWN_FIELD");
  const record = value as Record<string, unknown>;
  const kind = record["kind"];
  if (typeof kind !== "string" || !isExactString(kind, 64) || !allowedKinds.includes(kind)) {
    codes.add("REF_KIND_MISMATCH");
    ok = false;
  }
  if (!isExactString(record["id"], 128)) {
    codes.add("BAD_STRING");
    ok = false;
  }
  if (!isExactString(record["schemaVersion"], 64)) {
    codes.add("BAD_STRING");
    ok = false;
  }
  if (!isExactVersion(record["version"])) {
    codes.add("BAD_STRING");
    ok = false;
  }
  if (record["digestAlgorithm"] !== DIGEST_ALGORITHM_V1) {
    codes.add("BAD_DIGEST");
    ok = false;
  }
  if (!isDigest(record["digest"])) {
    codes.add("BAD_DIGEST");
    ok = false;
  }
  return ok;
}

/** ExactRef or explicit null (null rejected when nullable is false). */
function checkRefField(
  record: Record<string, unknown>,
  field: string,
  allowedKinds: readonly string[],
  codes: CodeSet,
  nullable: boolean,
): boolean {
  const value = record[field];
  if (value === null) {
    if (!nullable) codes.add("MISSING_FIELD");
    return false;
  }
  return validateExactRef(value, allowedKinds, codes);
}

function validateRefArray(
  value: unknown,
  allowedKinds: readonly string[],
  codes: CodeSet,
): boolean {
  if (!isDenseStandardArray(value)) {
    codes.add("BAD_SHAPE");
    return false;
  }
  let ok = true;
  const seen = new Set<string>();
  for (const ref of value) {
    if (!validateExactRef(ref, allowedKinds, codes)) {
      ok = false;
      continue;
    }
    const record = ref as Record<string, unknown>;
    let key: string;
    try {
      key = canonicalJson([record["kind"], record["id"], record["version"], record["digest"]]);
    } catch {
      ok = false;
      continue;
    }
    if (seen.has(key)) {
      codes.add("DUPLICATE_REF");
      ok = false;
    }
    seen.add(key);
  }
  return ok;
}

function validateCanonicalizationRef(value: unknown, codes: CodeSet): boolean {
  const mismatch = keyMismatch(value, CANONICALIZATION_REF_KEYS_V1);
  if (mismatch === null || mismatch.missing.length > 0 || mismatch.extra.length > 0) {
    codes.add("BAD_CANONICALIZATION_REF");
    return false;
  }
  const record = value as Record<string, unknown>;
  let ok = true;
  for (const field of CANONICALIZATION_REF_KEYS_V1) {
    if (record[field] !== CANONICALIZATION_REF_V1[field]) {
      codes.add("BAD_CANONICALIZATION_REF");
      ok = false;
    }
  }
  return ok;
}

function validateMaturityState(value: unknown, codes: CodeSet): MaturityStateV1 | null {
  const mismatch = keyMismatch(value, MATURITY_STATE_KEYS_V1);
  if (mismatch === null) {
    codes.add("BAD_SHAPE");
    return null;
  }
  if (mismatch.missing.length > 0) codes.add("MISSING_FIELD");
  if (mismatch.extra.length > 0) codes.add("UNKNOWN_FIELD");
  const record = value as Record<string, unknown>;
  const axis = record["axis"];
  const level = record["level"];
  if (axis !== "S" && axis !== "W" && axis !== "F") {
    codes.add("MATURITY_AXIS_MISMATCH");
    return null;
  }
  if (!isKnownLevel(axis, level)) {
    codes.add("MATURITY_LEVEL_INVALID");
    return null;
  }
  return { axis, level };
}

function validateMaturityStateNullable(value: unknown, codes: CodeSet): MaturityStateV1 | null {
  if (value === null) return null;
  return validateMaturityState(value, codes);
}

function checkAssuranceStatusNullable(value: unknown, codes: CodeSet): void {
  if (value === null) return;
  if (!inClosedSet(value, ASSURANCE_STATUSES_V1)) codes.add("ASSURANCE_STATUS_INVALID");
}

/**
 * Record maturity state: { axis, level, transitionReceiptRefs }. The axis
 * must match the record kind's axis, the level must be exact, and exactly one
 * MATURITY_TRANSITION receipt ref per advance must be present (length ===
 * level index).
 */
function checkMaturity(
  record: Record<string, unknown>,
  expectedAxis: MaturityAxisV1,
  codes: CodeSet,
): MaturityV1 | null {
  const value = record["maturity"];
  const mismatch = keyMismatch(value, MATURITY_KEYS_V1);
  if (mismatch === null) {
    codes.add("BAD_SHAPE");
    return null;
  }
  if (mismatch.missing.length > 0) codes.add("MISSING_FIELD");
  if (mismatch.extra.length > 0) codes.add("UNKNOWN_FIELD");
  const maturity = value as Record<string, unknown>;
  const axis = maturity["axis"];
  const level = maturity["level"];
  const axisOk = axis === expectedAxis;
  if (!axisOk) codes.add("MATURITY_AXIS_MISMATCH");
  const levelOk = isKnownLevel(axis, level);
  if (!levelOk) codes.add("MATURITY_LEVEL_INVALID");
  const refs = maturity["transitionReceiptRefs"];
  const refsOk = validateRefArray(refs, ["RECEIPT"], codes);
  if (axisOk && levelOk && refsOk && isDenseStandardArray(refs)) {
    const index = maturityLevelIndexV1(expectedAxis, level as string);
    if (refs.length !== index) codes.add("MATURITY_TRANSITION_EVIDENCE_MISMATCH");
  }
  if (!axisOk || !levelOk || !refsOk || !isDenseStandardArray(refs)) return null;
  return {
    axis: expectedAxis,
    level: level as string,
    transitionReceiptRefs: refs as readonly ExactRefV1[],
  };
}

function checkMaturityIndex(record: Record<string, unknown>, axis: MaturityAxisV1): number {
  const maturity = record["maturity"];
  if (!isPlainDataRecord(maturity) || maturity["axis"] !== axis || typeof maturity["level"] !== "string") {
    return -1;
  }
  return maturityLevelIndexV1(axis, maturity["level"]);
}

function denseArrayLength(value: unknown): number {
  return isDenseStandardArray(value) ? value.length : 0;
}

function validateKnowledgeDependency(value: unknown, codes: CodeSet): boolean {
  const mismatch = keyMismatch(value, KNOWLEDGE_DEPENDENCY_KEYS_V1);
  if (mismatch === null) {
    codes.add("KNOWLEDGE_DEPENDENCY_INVALID");
    return false;
  }
  let ok = true;
  if (mismatch.missing.length > 0) codes.add("MISSING_FIELD");
  if (mismatch.extra.length > 0) codes.add("UNKNOWN_FIELD");
  const record = value as Record<string, unknown>;
  if (!isExactString(record["recordId"], 128)) {
    codes.add("BAD_STRING");
    ok = false;
  }
  if (!isExactVersion(record["schemaVersion"])) {
    codes.add("BAD_STRING");
    ok = false;
  }
  if (!isExactVersion(record["edition"])) {
    codes.add("BAD_STRING");
    ok = false;
  }
  for (const field of ["contentDigest", "applicabilityDigest", "evidenceDigest"]) {
    if (!isDigest(record[field])) {
      codes.add("BAD_DIGEST");
      ok = false;
    }
  }
  const from = record["validFromMs"];
  const until = record["validUntilMs"];
  if (!isNonNegativeSafeInteger(from) || !isNonNegativeSafeInteger(until) || from >= until) {
    codes.add("KNOWLEDGE_DEPENDENCY_INVALID");
    ok = false;
  }
  const lineage = record["supersessionLineage"];
  if (!isDenseStandardArray(lineage)) {
    codes.add("BAD_SHAPE");
    ok = false;
  } else {
    for (const entry of lineage) {
      if (!isExactVersion(entry)) {
        codes.add("BAD_STRING");
        ok = false;
      }
    }
  }
  return ok;
}

/**
 * Capability: a closed record of ten exact string-or-null fields with at
 * least one non-null field. Capabilities compare by exact canonical bytes;
 * a fast path may only use capabilities present in BOTH the approved ceiling
 * and the currently enabled policy set (narrowing only).
 */
function validateCapability(value: unknown, codes: CodeSet): boolean {
  const mismatch = keyMismatch(value, CAPABILITY_FIELD_KEYS_V1);
  if (mismatch === null) {
    codes.add("BAD_SHAPE");
    return false;
  }
  let ok = true;
  if (mismatch.missing.length > 0) codes.add("MISSING_FIELD");
  if (mismatch.extra.length > 0) codes.add("UNKNOWN_FIELD");
  const record = value as Record<string, unknown>;
  let anyNonNull = false;
  for (const field of CAPABILITY_FIELD_KEYS_V1) {
    const entry = record[field];
    if (entry === null) continue;
    if (!isExactString(entry, 256)) {
      codes.add("BAD_STRING");
      ok = false;
      continue;
    }
    anyNonNull = true;
  }
  if (!anyNonNull) {
    codes.add("BAD_SHAPE");
    ok = false;
  }
  return ok;
}

function validateCapabilitySet(value: unknown, codes: CodeSet): boolean {
  if (!isDenseStandardArray(value)) {
    codes.add("BAD_SHAPE");
    return false;
  }
  let ok = true;
  const seen = new Set<string>();
  for (const capability of value) {
    if (!validateCapability(capability, codes)) {
      ok = false;
      continue;
    }
    const key = capabilityKey(capability);
    if (seen.has(key)) {
      codes.add("DUPLICATE_REF");
      ok = false;
    }
    seen.add(key);
  }
  return ok;
}

function capabilityKey(capability: unknown): string {
  try {
    return canonicalJson(safeJsonClone(capability));
  } catch {
    return "invalid-capability";
  }
}

function validateAuthorityRequirement(value: unknown, codes: CodeSet): boolean {
  const mismatch = keyMismatch(value, AUTHORITY_REQUIREMENT_KEYS_V1);
  if (mismatch === null) {
    codes.add("BAD_SHAPE");
    return false;
  }
  let ok = true;
  if (mismatch.missing.length > 0) codes.add("MISSING_FIELD");
  if (mismatch.extra.length > 0) codes.add("UNKNOWN_FIELD");
  const record = value as Record<string, unknown>;
  for (const field of ["actor", "tenant", "action", "target"]) {
    if (!isExactString(record[field], 128)) {
      codes.add("BAD_STRING");
      ok = false;
    }
  }
  const scope = record["scope"];
  if (scope !== null && !isExactString(scope, 128)) {
    codes.add("BAD_STRING");
    ok = false;
  }
  return ok;
}

function validateAuthorityGrant(value: unknown, codes: CodeSet): boolean {
  const mismatch = keyMismatch(value, AUTHORITY_GRANT_KEYS_V1);
  if (mismatch === null) {
    codes.add("BAD_SHAPE");
    return false;
  }
  let ok = true;
  if (mismatch.missing.length > 0) codes.add("MISSING_FIELD");
  if (mismatch.extra.length > 0) codes.add("UNKNOWN_FIELD");
  const record = value as Record<string, unknown>;
  for (const field of ["actor", "tenant", "action", "target"]) {
    if (!isExactString(record[field], 128)) {
      codes.add("BAD_STRING");
      ok = false;
    }
  }
  const scope = record["scope"];
  if (scope !== null && !isExactString(scope, 128)) {
    codes.add("BAD_STRING");
    ok = false;
  }
  if (!isDigest(record["approvalDigest"])) {
    codes.add("BAD_DIGEST");
    ok = false;
  }
  const from = record["validFromMs"];
  const until = record["validUntilMs"];
  if (!isNonNegativeSafeInteger(from) || !isNonNegativeSafeInteger(until) || from >= until) {
    codes.add("INVALID_CONTRACT");
    ok = false;
  }
  const budget = record["budgetLimitCents"];
  if (budget !== null && !isNonNegativeSafeInteger(budget)) {
    codes.add("BAD_NUMBER");
    ok = false;
  }
  return ok;
}

function validateRollbackContract(value: unknown, codes: CodeSet): boolean {
  if (!isPlainDataRecord(value)) {
    codes.add("BAD_SHAPE");
    return false;
  }
  const record = value as Record<string, unknown>;
  const kind = record["kind"];
  if (kind === "CONTRACT") {
    const mismatch = keyMismatch(record, ROLLBACK_CONTRACT_KEYS_V1);
    if (mismatch === null) {
      codes.add("ROLLBACK_BINDING_INVALID");
      return false;
    }
    let ok = true;
    if (mismatch.missing.length > 0) codes.add("MISSING_FIELD");
    if (mismatch.extra.length > 0) codes.add("UNKNOWN_FIELD");
    if (!checkRefField(record, "contractRef", ["ROLLBACK_CONTRACT"], codes, false)) ok = false;
    if (!checkRefField(record, "lastKnownGoodRef", ["LAST_KNOWN_GOOD"], codes, false)) ok = false;
    return ok;
  }
  if (kind === "NOT_APPLICABLE") {
    const mismatch = keyMismatch(record, ROLLBACK_NOT_APPLICABLE_KEYS_V1);
    if (mismatch === null) {
      codes.add("ROLLBACK_BINDING_INVALID");
      return false;
    }
    let ok = true;
    if (mismatch.missing.length > 0) codes.add("MISSING_FIELD");
    if (mismatch.extra.length > 0) codes.add("UNKNOWN_FIELD");
    if (!checkRefField(record, "evidenceRef", ["EVIDENCE"], codes, false)) ok = false;
    if (!isExactString(record["justification"], 4096)) {
      codes.add("BAD_STRING");
      ok = false;
    }
    return ok;
  }
  codes.add("INVALID_CONTRACT");
  return false;
}

function validateErrorContract(value: unknown, codes: CodeSet): boolean {
  const record = checkRecordKeys(value, ERROR_CONTRACT_KEYS_V1, codes);
  if (record === null) return false;
  return validateRefArray(record["errorTypeRefs"], ["SCHEMA"], codes);
}

/**
 * Workflow body (shared by WorkflowCandidate and GovernedWorkflow). All
 * boundary fields are exact and closed; the step graph digest is
 * recomputed; dependency set digests are recomputed in normalized order.
 */
function validateWorkflowBody(value: unknown, codes: CodeSet): Record<string, unknown> | null {
  const body = checkRecordKeys(value, WORKFLOW_BODY_KEYS_V1, codes);
  if (body === null) return null;

  // Step graph: stable step IDs, typed edges, ordering rules, graph digest.
  const graph = checkRecordKeys(body["stepGraph"], STEP_GRAPH_KEYS_V1, codes);
  if (graph !== null) {
    const steps = graph["steps"];
    const declaredStepIds = new Set<string>();
    const stepsValid = isDenseStandardArray(steps) && steps.length >= 1;
    if (!stepsValid) {
      codes.add("STEP_GRAPH_INVALID");
    } else {
      for (const step of steps) {
        const stepRecord = checkRecordKeys(step, WORKFLOW_STEP_KEYS_V1, codes);
        if (stepRecord === null) continue;
        const stepId = stepRecord["stepId"];
        if (!isExactString(stepId, 128)) {
          codes.add("BAD_STRING");
        } else if (declaredStepIds.has(stepId)) {
          codes.add("STEP_GRAPH_INVALID");
        } else {
          declaredStepIds.add(stepId);
        }
        validateRefArray(stepRecord["knowledgeReads"], ["KNOWLEDGE_EDITION"], codes);
        checkRefField(stepRecord, "decisionContractRef", ["SCHEMA"], codes, false);
        checkRefField(stepRecord, "capabilityProposalRef", ["CAPABILITY_BOUNDARY"], codes, true);
        checkRefField(stepRecord, "verificationCheckpointRef", ["VERIFICATION_PLAN"], codes, false);
        const abort = checkRecordKeys(stepRecord["abortBehavior"], ABORT_BEHAVIOR_KEYS_V1, codes);
        if (abort !== null) {
          if (!inClosedSet(abort["routeStatus"], ABORT_ROUTE_STATUSES_V1)) {
            codes.add("INVALID_CONTRACT");
          }
          const reasonCode = abort["reasonCode"];
          if (
            !inClosedSet(reasonCode, FAST_PATH_ROUTE_REASON_CODES_V1) ||
            reasonCode === "NONE"
          ) {
            codes.add("INVALID_CONTRACT");
          }
        }
      }
    }
    const edges = graph["edges"];
    if (!isDenseStandardArray(edges)) {
      codes.add("STEP_GRAPH_INVALID");
    } else {
      for (const edge of edges) {
        const edgeRecord = checkRecordKeys(edge, STEP_EDGE_KEYS_V1, codes);
        if (edgeRecord === null) continue;
        const from = edgeRecord["fromStepId"];
        const to = edgeRecord["toStepId"];
        if (
          !isExactString(from, 128) ||
          !isExactString(to, 128) ||
          !declaredStepIds.has(from) ||
          !declaredStepIds.has(to)
        ) {
          codes.add("STEP_GRAPH_INVALID");
        }
      }
    }
    const orderingRules = graph["orderingRules"];
    if (!isDenseStandardArray(orderingRules) || orderingRules.length === 0) {
      codes.add("STEP_GRAPH_INVALID");
    } else {
      const seen = new Set<string>();
      for (const rule of orderingRules) {
        if (!isExactString(rule, 256)) {
          codes.add("BAD_STRING");
          continue;
        }
        if (seen.has(rule)) codes.add("STEP_GRAPH_INVALID");
        seen.add(rule);
      }
    }
    const expectedGraphDigest = safeDigestOf({
      steps: graph["steps"],
      edges: graph["edges"],
      orderingRules: graph["orderingRules"],
    });
    if (expectedGraphDigest !== null && graph["graphDigest"] !== expectedGraphDigest) {
      codes.add("GRAPH_DIGEST_MISMATCH");
    }
    if (!isDigest(graph["graphDigest"])) codes.add("BAD_DIGEST");
  }

  // Material context dimensions: exact, non-empty, unique.
  const dimensions = body["materialContextDimensions"];
  if (!isDenseStandardArray(dimensions) || dimensions.length === 0) {
    codes.add("BAD_SHAPE");
  } else {
    const seen = new Set<string>();
    for (const dimension of dimensions) {
      if (!isExactString(dimension, 128)) {
        codes.add("BAD_STRING");
        continue;
      }
      if (seen.has(dimension)) codes.add("STEP_GRAPH_INVALID");
      seen.add(dimension);
    }
  }

  // Typed contracts.
  checkRefField(body, "inputContractRef", ["SCHEMA"], codes, false);
  checkRefField(body, "outputContractRef", ["SCHEMA"], codes, false);
  checkRefField(body, "preconditionContractRef", ["SCHEMA"], codes, false);
  checkRefField(body, "postconditionContractRef", ["SCHEMA"], codes, false);
  validateErrorContract(body["errorContract"], codes);

  // Terminal success criteria and authoritative Readback requirements.
  const terminal = checkRecordKeys(body["terminalSuccess"], TERMINAL_SUCCESS_KEYS_V1, codes);
  if (terminal !== null) {
    checkRefField(terminal, "successCriteriaRef", ["SCHEMA"], codes, false);
    const readbackRequired = checkBoolField(terminal, "readbackRequired", codes);
    const readbackRefs = terminal["readbackRefs"];
    const refsValid = validateRefArray(readbackRefs, ["READBACK"], codes);
    if (readbackRequired && refsValid && denseArrayLength(readbackRefs) < 1) {
      codes.add("TERMINAL_SUCCESS_BINDING_INVALID");
    }
    if (!readbackRequired && refsValid && denseArrayLength(readbackRefs) > 0) {
      codes.add("TERMINAL_SUCCESS_BINDING_INVALID");
    }
  }

  // Shadow plan: baseline, quality metric, reasoning-cost metric, holdouts,
  // counterexamples.
  const shadow = checkRecordKeys(body["shadowPlan"], SHADOW_PLAN_KEYS_V1, codes);
  if (shadow !== null) {
    checkRefField(shadow, "baselineRef", ["BASELINE_RUN_SET"], codes, false);
    checkRefField(shadow, "qualityMetricRef", ["METRIC"], codes, false);
    checkRefField(shadow, "reasoningCostMetricRef", ["METRIC"], codes, false);
    validateRefArray(shadow["holdoutRefs"], ["HOLDOUT_SET"], codes);
    validateRefArray(shadow["counterexampleRefs"], ["COUNTEREXAMPLE_SET"], codes);
  }

  checkRefField(body, "originalPathRef", ["FALLBACK_PATH"], codes, false);
  checkRefField(body, "fallbackPathRef", ["FALLBACK_PATH"], codes, false);

  validateDependencySets(body, codes);
  if (!isDigest(body["transitiveClosureDigest"])) codes.add("BAD_DIGEST");

  checkRefField(body, "verificationPlanRef", ["VERIFICATION_PLAN"], codes, false);
  validateRefArray(body["evidenceRefs"], ["EVIDENCE"], codes);
  checkRefField(body, "capabilityBoundaryRef", ["CAPABILITY_BOUNDARY"], codes, false);
  checkDigestField(body, "capabilityCeilingDigest", codes);
  checkRefField(body, "authorityRequirementRef", ["AUTHORITY_REQUIREMENT"], codes, false);
  checkDigestField(body, "authorityRequirementDigest", codes);
  validateRollbackContract(body["rollbackContract"], codes);
  validateRefArray(body["knownFailureRefs"], ["KNOWN_FAILURE"], codes);
  validateRefArray(body["exclusionRefs"], ["EXCLUSION_SET"], codes);
  validateRefArray(body["counterexampleSetRefs"], ["COUNTEREXAMPLE_SET"], codes);

  return body;
}

/** Dependency sets and their normalized set digests (shared body fields). */
function validateDependencySets(record: Record<string, unknown>, codes: CodeSet): void {
  const knowledge = record["knowledgeDependencies"];
  if (!isDenseStandardArray(knowledge)) {
    codes.add("BAD_SHAPE");
  } else {
    const seen = new Set<string>();
    for (const dependency of knowledge) {
      if (validateKnowledgeDependency(dependency, codes)) {
        const key = safeDigestOf(dependency);
        if (key !== null && seen.has(key)) codes.add("DUPLICATE_REF");
        if (key !== null) seen.add(key);
      }
    }
    const expected = safeSetDigest(() => governedAssetsKnowledgeSetDigestV1(knowledge));
    if (expected !== null && record["knowledgeDependencySetDigest"] !== expected) {
      codes.add("DEPENDENCY_SET_DIGEST_MISMATCH");
    }
  }
  if (!isDigest(record["knowledgeDependencySetDigest"])) codes.add("BAD_DIGEST");

  const workflows = record["workflowDependencies"];
  validateRefArray(workflows, WORKFLOW_DEPENDENCY_KINDS_V1, codes);
  if (isDenseStandardArray(workflows)) {
    const expected = safeSetDigest(() => governedAssetsRefSetDigestV1(workflows));
    if (expected !== null && record["workflowDependencySetDigest"] !== expected) {
      codes.add("DEPENDENCY_SET_DIGEST_MISMATCH");
    }
  }
  if (!isDigest(record["workflowDependencySetDigest"])) codes.add("BAD_DIGEST");

  const functions = record["functionDependencies"];
  validateRefArray(functions, ["FUNCTION_CANDIDATE"], codes);
  if (isDenseStandardArray(functions)) {
    const expected = safeSetDigest(() => governedAssetsRefSetDigestV1(functions));
    if (expected !== null && record["functionDependencySetDigest"] !== expected) {
      codes.add("DEPENDENCY_SET_DIGEST_MISMATCH");
    }
  }
  if (!isDigest(record["functionDependencySetDigest"])) codes.add("BAD_DIGEST");
}

function safeSetDigest(compute: () => string): string | null {
  try {
    return compute();
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Common record fields (shared by all three record kinds).
// ---------------------------------------------------------------------------

interface AssetSpec {
  readonly keys: readonly string[];
  readonly recordKind: (typeof RECORD_KINDS_V1)[number];
  readonly axis: MaturityAxisV1;
  readonly sourceKinds: readonly string[];
  readonly transformerKinds: readonly string[];
}

function cloneOrDeny(value: unknown, codes: CodeSet): Record<string, unknown> | null {
  let cloned: unknown;
  try {
    cloned = safeJsonClone(value);
  } catch (error) {
    codes.add(
      error instanceof TypeError && error.message === "UNSAFE_JSON_NUMBER"
        ? "BAD_NUMBER"
        : "BAD_SHAPE",
    );
    return null;
  }
  if (!isPlainDataRecord(cloned)) {
    codes.add("BAD_SHAPE");
    return null;
  }
  return cloned;
}

function validateCommonFields(
  record: Record<string, unknown>,
  spec: AssetSpec,
  codes: CodeSet,
): void {
  if (record["schemaVersion"] !== GOVERNED_ASSETS_SCHEMA_V1) {
    codes.add("SCHEMA_VERSION_MISMATCH");
  }
  if (record["recordKind"] !== spec.recordKind) {
    codes.add("RECORD_KIND_MISMATCH");
  }
  checkStringField(record, "artifactId", 128, codes);
  if (!isExactVersion(record["artifactVersion"])) codes.add("BAD_STRING");
  checkMaturity(record, spec.axis, codes);
  if (!inClosedSet(record["assuranceStatus"], ASSURANCE_STATUSES_V1)) {
    codes.add("ASSURANCE_STATUS_INVALID");
  }
  checkDigestField(record, "artifactDigest", codes);

  // Predecessor binding: both null (genesis) or both present with an exact
  // same-kind predecessor ref and an exact supersession reason.
  const predecessor = record["predecessorRef"];
  const reason = record["supersessionReason"];
  if (predecessor === null && reason === null) {
    // genesis version
  } else if (predecessor === null || reason === null) {
    codes.add("PREDECESSOR_BINDING_INVALID");
  } else {
    if (!validateExactRef(predecessor, [spec.recordKind], codes)) {
      codes.add("PREDECESSOR_BINDING_INVALID");
    }
    if (!isExactString(reason, 4096)) codes.add("BAD_STRING");
  }

  validateCanonicalizationRef(record["canonicalizationRef"], codes);
  if (record["digestAlgorithm"] !== DIGEST_ALGORITHM_V1) codes.add("BAD_DIGEST");
  checkRefField(record, "sourceRef", spec.sourceKinds, codes, false);
  checkRefField(record, "transformerRef", spec.transformerKinds, codes, false);
  checkRefField(record, "applicabilityContractRef", ["APPLICABILITY_CONTRACT"], codes, false);
  checkDigestField(record, "applicabilityResultDigest", codes);
  for (const field of RECEIPT_REF_ARRAY_FIELDS_V1) {
    validateRefArray(record[field], ["RECEIPT"], codes);
  }
}

function checkArtifactDigest(record: Record<string, unknown>, codes: CodeSet): void {
  const expected = safeDigestOf(record, "artifactDigest");
  if (expected !== null && record["artifactDigest"] !== expected) {
    codes.add("DIGEST_MISMATCH");
  }
}

function finalizeRecord<T>(
  codes: CodeSet,
  record: Record<string, unknown> | null,
): GovernedAssetVerificationResultV1<T> {
  if (codes.size === 0 && record !== null) {
    return immutable({
      outcome: "ACCEPTED" as const,
      reasonCodes: NONE_REASON_CODES,
      exitCode: 0,
      record: record as T,
    });
  }
  const ordered = VALIDATION_REASON_CODES_V1.filter((code) => codes.has(code));
  const lead = ordered[0];
  const exitCode = lead === undefined ? REJECTION_EXIT_BASE : REJECTION_EXIT_BASE + ordered.indexOf(lead) + 1;
  return immutable({
    outcome: "REJECTED" as const,
    reasonCodes: ordered,
    exitCode,
  });
}

const WORKFLOW_CANDIDATE_SPEC: AssetSpec = {
  keys: WORKFLOW_CANDIDATE_KEYS_V1,
  recordKind: "WorkflowCandidate",
  axis: "W",
  sourceKinds: WF_SOURCE_KINDS_V1,
  transformerKinds: WF_TRANSFORMER_KINDS_V1,
};

const GOVERNED_WORKFLOW_SPEC: AssetSpec = {
  keys: GOVERNED_WORKFLOW_KEYS_V1,
  recordKind: "GovernedWorkflow",
  axis: "W",
  sourceKinds: GW_SOURCE_KINDS_V1,
  transformerKinds: GW_TRANSFORMER_KINDS_V1,
};

const FUNCTION_CANDIDATE_SPEC: AssetSpec = {
  keys: FUNCTION_CANDIDATE_KEYS_V1,
  recordKind: "FunctionCandidate",
  axis: "F",
  sourceKinds: FUNC_SOURCE_KINDS_V1,
  transformerKinds: FUNC_TRANSFORMER_KINDS_V1,
};

// ---------------------------------------------------------------------------
// WorkflowCandidate.
// ---------------------------------------------------------------------------

/**
 * Maturity evidence gating for workflow bodies:
 * - W2+ requires Evidence; W3+ requires counterexamples; W4+ requires
 *   holdouts in the shadow plan;
 * - W6 requires the eligibility receipt, and no level below W6 may carry one.
 */
function gateWorkflowEvidence(
  record: Record<string, unknown>,
  body: Record<string, unknown> | null,
  codes: CodeSet,
): void {
  const index = checkMaturityIndex(record, "W");
  if (index < 0) return;
  const eligibility = record["eligibilityReceiptRef"];
  if (index === 6 && eligibility === null) codes.add("MATURITY_TRANSITION_EVIDENCE_MISMATCH");
  if (index < 6 && eligibility !== null) codes.add("MATURITY_TRANSITION_EVIDENCE_MISMATCH");
  if (body === null) return;
  if (index >= 2 && denseArrayLength(body["evidenceRefs"]) < 1) {
    codes.add("MATURITY_TRANSITION_EVIDENCE_MISMATCH");
  }
  if (index >= 3 && denseArrayLength(body["counterexampleSetRefs"]) < 1) {
    codes.add("MATURITY_TRANSITION_EVIDENCE_MISMATCH");
  }
  if (index >= 4) {
    const shadow = body["shadowPlan"];
    if (!isPlainDataRecord(shadow) || denseArrayLength(shadow["holdoutRefs"]) < 1) {
      codes.add("MATURITY_TRANSITION_EVIDENCE_MISMATCH");
    }
  }
}

/**
 * A GovernedWorkflow is always a W6 snapshot. Its promotion metadata does not
 * replace the W6 evidence gates carried by the approved candidate body.
 */
function gateGovernedWorkflowEvidence(
  record: Record<string, unknown>,
  body: Record<string, unknown> | null,
  codes: CodeSet,
): void {
  if (checkMaturityIndex(record, "W") !== 6 || body === null) return;
  if (denseArrayLength(body["evidenceRefs"]) < 1) {
    codes.add("MATURITY_TRANSITION_EVIDENCE_MISMATCH");
  }
  if (denseArrayLength(body["counterexampleSetRefs"]) < 1) {
    codes.add("MATURITY_TRANSITION_EVIDENCE_MISMATCH");
  }
  const shadow = body["shadowPlan"];
  if (!isPlainDataRecord(shadow) || denseArrayLength(shadow["holdoutRefs"]) < 1) {
    codes.add("MATURITY_TRANSITION_EVIDENCE_MISMATCH");
  }
}

/**
 * Validates a WorkflowCandidate record (an immutable, non-authoritative
 * compiled proposal at W0-W6). Returns an ACCEPTED result with the
 * deep-frozen record, or a REJECTED result with ordered denial codes.
 */
export function validateWorkflowCandidateV1(
  value: unknown,
): GovernedAssetVerificationResultV1<WorkflowCandidateV1> {
  const codes: CodeSet = new Set();
  const record = cloneOrDeny(value, codes);
  if (record !== null) {
    checkRecordKeys(record, WORKFLOW_CANDIDATE_SPEC.keys, codes);
    validateCommonFields(record, WORKFLOW_CANDIDATE_SPEC, codes);
    checkRefField(record, "sourcePatternValidationReceiptRef", ["RECEIPT"], codes, false);
    const body = validateWorkflowBody(record["body"], codes);
    const expectedBodyDigest = safeDigestOf(record["body"]);
    if (expectedBodyDigest !== null && record["bodyDigest"] !== expectedBodyDigest) {
      codes.add("BODY_DIGEST_MISMATCH");
    }
    if (!isDigest(record["bodyDigest"])) codes.add("BAD_DIGEST");
    checkRefField(record, "eligibilityReceiptRef", ["RECEIPT"], codes, true);
    gateWorkflowEvidence(record, body, codes);
    // A candidate is never promoted: promotion receipts are for the governed
    // record only.
    if (denseArrayLength(record["promotionReceiptRefs"]) > 0) {
      codes.add("PROMOTION_BINDING_INVALID");
    }
    checkArtifactDigest(record, codes);
  }
  return finalizeRecord(codes, record);
}

// ---------------------------------------------------------------------------
// GovernedWorkflow.
// ---------------------------------------------------------------------------

/**
 * Validates a GovernedWorkflow record (an immutable snapshot of one exact W6
 * candidate, admitted by a separate digest-bound promotion Approval). The
 * governed body must match the approved candidate body digest-for-digest;
 * promotion metadata may be added but no boundary may be omitted or widened.
 */
export function validateGovernedWorkflowV1(
  value: unknown,
): GovernedAssetVerificationResultV1<GovernedWorkflowV1> {
  const codes: CodeSet = new Set();
  const record = cloneOrDeny(value, codes);
  if (record !== null) {
    checkRecordKeys(record, GOVERNED_WORKFLOW_SPEC.keys, codes);
    validateCommonFields(record, GOVERNED_WORKFLOW_SPEC, codes);
    // Promotion is only legal at W6.
    const maturity = record["maturity"];
    if (isPlainDataRecord(maturity) && maturity["level"] !== "W6 PROMOTION_ELIGIBLE") {
      codes.add("MATURITY_LEVEL_INVALID");
    }
    checkDigestField(record, "sourceCandidateBodyDigest", codes);
    checkRefField(record, "promotionApprovalRef", ["APPROVAL"], codes, false);
    checkRefField(record, "promotionReceiptRef", ["RECEIPT"], codes, false);

    // Exactly one promotion receipt, byte-for-byte identical to
    // promotionReceiptRef.
    const promotionReceiptRefs = record["promotionReceiptRefs"];
    if (isDenseStandardArray(promotionReceiptRefs)) {
      if (promotionReceiptRefs.length !== 1) {
        codes.add("PROMOTION_BINDING_INVALID");
      } else {
        const single = promotionReceiptRefs[0];
        let identical = false;
        try {
          identical =
            canonicalJson(safeJsonClone(single)) ===
            canonicalJson(safeJsonClone(record["promotionReceiptRef"]));
        } catch {
          identical = false;
        }
        if (!identical) codes.add("PROMOTION_BINDING_INVALID");
      }
    }

    const body = validateWorkflowBody(record["body"], codes);
    const bodyDigest = safeDigestOf(record["body"]);
    if (bodyDigest !== null && record["bodyDigest"] !== bodyDigest) {
      codes.add("BODY_DIGEST_MISMATCH");
    }
    if (!isDigest(record["bodyDigest"])) codes.add("BAD_DIGEST");
    // Body identity with the approved candidate: the governed body is a
    // digest-for-digest copy of the W6 candidate body, never a rewrite.
    if (bodyDigest !== null && isDigest(record["sourceCandidateBodyDigest"])) {
      if (bodyDigest !== record["sourceCandidateBodyDigest"]) {
        codes.add("BODY_DIGEST_MISMATCH");
      }
    }
    gateGovernedWorkflowEvidence(record, body, codes);
    checkArtifactDigest(record, codes);
  }
  return finalizeRecord(codes, record);
}

// ---------------------------------------------------------------------------
// FunctionCandidate.
// ---------------------------------------------------------------------------

/**
 * Maturity evidence gating for function bodies:
 * - F3+ requires Evidence; F4+ requires counterexamples; F5+ requires
 *   shadow-parity Evidence;
 * - F6 requires the eligibility receipt and the fallback readback receipt,
 *   and no level below F6 may carry either. F6 has no promotion target in v1.
 */
function gateFunctionEvidence(
  record: Record<string, unknown>,
  codes: CodeSet,
): void {
  const index = checkMaturityIndex(record, "F");
  if (index < 0) return;
  const eligibility = record["eligibilityReceiptRef"];
  const fallback = record["fallbackReadbackRef"];
  if (index === 6 && (eligibility === null || fallback === null)) {
    codes.add("MATURITY_TRANSITION_EVIDENCE_MISMATCH");
  }
  if (index < 6 && (eligibility !== null || fallback !== null)) {
    codes.add("MATURITY_TRANSITION_EVIDENCE_MISMATCH");
  }
  if (index >= 3 && denseArrayLength(record["evidenceRefs"]) < 1) {
    codes.add("MATURITY_TRANSITION_EVIDENCE_MISMATCH");
  }
  if (index >= 4 && denseArrayLength(record["counterexampleSetRefs"]) < 1) {
    codes.add("MATURITY_TRANSITION_EVIDENCE_MISMATCH");
  }
  if (index >= 5 && denseArrayLength(record["parityEvidenceRefs"]) < 1) {
    codes.add("MATURITY_TRANSITION_EVIDENCE_MISMATCH");
  }
}

/**
 * Validates a FunctionCandidate record (an immutable, non-authoritative
 * extraction proposal at F0-F6; never a deployed Function). v1 defines no
 * GovernedFunction, deployment, runtime scheduler, or activation route.
 */
export function validateFunctionCandidateV1(
  value: unknown,
): GovernedAssetVerificationResultV1<FunctionCandidateV1> {
  const codes: CodeSet = new Set();
  const record = cloneOrDeny(value, codes);
  if (record !== null) {
    checkRecordKeys(record, FUNCTION_CANDIDATE_SPEC.keys, codes);
    validateCommonFields(record, FUNCTION_CANDIDATE_SPEC, codes);

    // Stable source step IDs (exact, non-empty, unique).
    const stepIds = record["sourceStepIds"];
    if (!isDenseStandardArray(stepIds) || stepIds.length === 0) {
      codes.add("STEP_GRAPH_INVALID");
    } else {
      const seen = new Set<string>();
      for (const stepId of stepIds) {
        if (!isExactString(stepId, 128)) {
          codes.add("BAD_STRING");
          continue;
        }
        if (seen.has(stepId)) codes.add("STEP_GRAPH_INVALID");
        seen.add(stepId);
      }
    }
    checkDigestField(record, "sourceSubgraphDigest", codes);
    checkDigestField(record, "sourceSubstepClosureDigest", codes);

    // Closed schemas and versioned logic.
    checkRefField(record, "inputSchemaRef", ["SCHEMA"], codes, false);
    checkRefField(record, "outputSchemaRef", ["SCHEMA"], codes, false);
    checkRefField(record, "logicRef", ["LOGIC"], codes, false);
    if (!isExactVersion(record["logicAlgorithmVersion"])) codes.add("BAD_STRING");
    checkDigestField(record, "logicImplementationDigest", codes);
    if (!inClosedSet(record["logicKind"], LOGIC_KINDS_V1)) codes.add("LOGIC_BINDING_INVALID");
    const capabilityRequestDigest = record["capabilityRequestDigest"];
    if (capabilityRequestDigest !== null && !isDigest(capabilityRequestDigest)) {
      codes.add("BAD_DIGEST");
    }
    validateErrorContract(record["errorContract"], codes);

    // Complete transitive dependency closure copied from the source substep.
    validateDependencySets(record, codes);
    if (!isDigest(record["transitiveClosureDigest"])) codes.add("BAD_DIGEST");
    const maturityIndex = checkMaturityIndex(record, "F");
    if (
      maturityIndex >= 1 &&
      isDigest(record["transitiveClosureDigest"]) &&
      isDigest(record["sourceSubstepClosureDigest"]) &&
      record["transitiveClosureDigest"] !== record["sourceSubstepClosureDigest"]
    ) {
      codes.add("TRANSITIVE_CLOSURE_DRIFT");
    }

    // Verification, Capability and Authority boundaries (exact, never wider
    // than the approved ceiling).
    checkRefField(record, "verificationPlanRef", ["VERIFICATION_PLAN"], codes, false);
    validateRefArray(record["evidenceRefs"], ["EVIDENCE"], codes);
    checkRefField(record, "capabilityBoundaryRef", ["CAPABILITY_BOUNDARY"], codes, false);
    checkDigestField(record, "capabilityCeilingDigest", codes);
    checkRefField(record, "authorityRequirementRef", ["AUTHORITY_REQUIREMENT"], codes, false);
    checkDigestField(record, "authorityRequirementDigest", codes);

    // Rollback: disable candidate selection and restore the exact source
    // step, or a typed NOT_APPLICABLE result with Evidence.
    validateRollbackContract(record["rollbackContract"], codes);
    validateRefArray(record["knownFailureRefs"], ["KNOWN_FAILURE"], codes);
    validateRefArray(record["exclusionRefs"], ["EXCLUSION_SET"], codes);
    validateRefArray(record["counterexampleSetRefs"], ["COUNTEREXAMPLE_SET"], codes);

    // Original-step fallback and parity verification.
    checkRefField(record, "originalStepFallbackRef", ["FALLBACK_PATH"], codes, false);
    checkRefField(record, "parityVerifierRef", ["PARITY_VERIFIER"], codes, false);
    validateRefArray(record["parityEvidenceRefs"], ["EVIDENCE"], codes);
    if (!isExactString(record["extractionRationale"], 4096)) codes.add("BAD_STRING");
    checkRefField(record, "eligibilityReceiptRef", ["RECEIPT"], codes, true);
    checkRefField(record, "fallbackReadbackRef", ["READBACK"], codes, true);

    gateFunctionEvidence(record, codes);
    // F6 has no promotion target in v1: promotion receipts are never present.
    if (denseArrayLength(record["promotionReceiptRefs"]) > 0) {
      codes.add("PROMOTION_BINDING_INVALID");
    }
    checkArtifactDigest(record, codes);
  }
  return finalizeRecord(codes, record);
}

// ---------------------------------------------------------------------------
// Record dispatcher.
// ---------------------------------------------------------------------------

/**
 * Validates any CKS-11 governed asset record, dispatching on the exact
 * recordKind. Unknown kinds fail closed with RECORD_KIND_MISMATCH.
 */
export function validateGovernedAssetRecordV1(
  value: unknown,
):
  | GovernedAssetVerificationResultV1<WorkflowCandidateV1>
  | GovernedAssetVerificationResultV1<GovernedWorkflowV1>
  | GovernedAssetVerificationResultV1<FunctionCandidateV1> {
  if (isPlainDataRecord(value)) {
    const kind = value["recordKind"];
    if (kind === "WorkflowCandidate") return validateWorkflowCandidateV1(value);
    if (kind === "GovernedWorkflow") return validateGovernedWorkflowV1(value);
    if (kind === "FunctionCandidate") return validateFunctionCandidateV1(value);
  }
  const codes: CodeSet = new Set();
  if (!isPlainDataRecord(value)) codes.add("BAD_SHAPE");
  codes.add("RECORD_KIND_MISMATCH");
  return finalizeRecord<WorkflowCandidateV1>(codes, null);
}

// ---------------------------------------------------------------------------
// Immutable deterministic receipts.
// ---------------------------------------------------------------------------

/**
 * Validates a CKS-11 receipt (closed v1 kinds). Receipts are append-only and
 * idempotent on identical digest: two identical receipts are the same
 * receipt (same receiptDigest); corrections are successor receipts (via
 * previousReceiptDigest), never history rewrites. The receiptDigest is
 * recomputed over the complete canonical receipt with only receiptDigest
 * omitted; the decisionDigest is recomputed over the decision payload.
 */
export function verifyGovernedAssetReceiptV1(
  value: unknown,
): GovernedAssetVerificationResultV1<GovernedAssetReceiptV1> {
  const codes: CodeSet = new Set();
  const record = cloneOrDeny(value, codes);
  if (record !== null) {
    checkRecordKeys(record, RECEIPT_KEYS_V1, codes);
    if (record["schemaVersion"] !== GOVERNED_ASSETS_SCHEMA_V1) {
      codes.add("SCHEMA_VERSION_MISMATCH");
    }
    if (!inClosedSet(record["receiptKind"], RECEIPT_KINDS_V1)) codes.add("INVALID_CONTRACT");
    checkStringField(record, "receiptId", 128, codes);
    checkRefField(record, "subjectRef", SUBJECT_REF_KINDS_V1, codes, false);

    const priorState = validateMaturityStateNullable(record["priorMaturity"], codes);
    const resultingState = validateMaturityStateNullable(record["resultingMaturity"], codes);
    checkAssuranceStatusNullable(record["priorAssuranceStatus"], codes);
    checkAssuranceStatusNullable(record["resultingAssuranceStatus"], codes);

    if (!inClosedSet(record["decisionStatus"], DECISION_STATUSES_V1)) {
      codes.add("INVALID_CONTRACT");
    }

    // Ordered finite reason codes: closed set, non-empty, unique.
    const reasons = record["reasonCodes"];
    if (!isDenseStandardArray(reasons) || reasons.length === 0) {
      codes.add("INVALID_CONTRACT");
    } else {
      const seen = new Set<string>();
      const noneOnly = reasons.length === 1 && reasons[0] === "NONE";
      for (const reason of reasons) {
        if (typeof reason !== "string" || !inClosedSet(reason, FAST_PATH_ROUTE_REASON_CODES_V1)) {
          codes.add("INVALID_CONTRACT");
          continue;
        }
        if (seen.has(reason)) {
          codes.add("INVALID_CONTRACT");
          continue;
        }
        seen.add(reason);
      }
      const decision = record["decisionStatus"];
      if (decision === "APPROVED" && !noneOnly) codes.add("INVALID_CONTRACT");
      if (decision !== "APPROVED" && seen.has("NONE")) codes.add("INVALID_CONTRACT");
    }

    checkDigestField(record, "requestDigest", codes);
    checkDigestField(record, "contextDigest", codes);
    const applicabilityDigest = record["applicabilityResultDigest"];
    if (applicabilityDigest !== null && !isDigest(applicabilityDigest)) codes.add("BAD_DIGEST");
    for (const field of [
      "knowledgeDependencySetDigest",
      "workflowDependencySetDigest",
      "functionDependencySetDigest",
      "transitiveClosureDigest",
      "capabilityCeilingDigest",
      "authorityRequirementDigest",
    ]) {
      checkDigestField(record, field, codes);
    }
    const usedSetDigest = record["capabilityUsedSetDigest"];
    if (usedSetDigest !== null && !isDigest(usedSetDigest)) codes.add("BAD_DIGEST");
    const envelopeDigest = record["effectiveAuthorityEnvelopeDigest"];
    if (envelopeDigest !== null && !isDigest(envelopeDigest)) codes.add("BAD_DIGEST");

    checkRefField(record, "verificationPlanRef", ["VERIFICATION_PLAN"], codes, true);
    validateRefArray(record["evidenceRefs"], ["EVIDENCE"], codes);
    checkRefField(record, "verifierRef", ["VERIFIER"], codes, true);
    checkRefField(record, "rollbackContractRef", ["ROLLBACK_CONTRACT"], codes, true);
    checkRefField(record, "lastKnownGoodRef", ["LAST_KNOWN_GOOD"], codes, true);
    checkRefField(record, "approvalRef", ["APPROVAL"], codes, true);
    checkRefField(record, "activationApprovalRef", ["APPROVAL"], codes, true);
    validateRefArray(record["environmentRefs"], ENVIRONMENT_REF_KINDS_V1, codes);
    const previous = record["previousReceiptDigest"];
    if (previous !== null && !isDigest(previous)) codes.add("BAD_DIGEST");
    if (!isTimestamp(record["recordedTimeMs"])) codes.add("BAD_NUMBER");

    // Kind-specific binding gates (fail closed).
    const kind = record["receiptKind"];
    if (kind === "MATURITY_TRANSITION") {
      if (priorState === null || resultingState === null) {
        codes.add("RECEIPT_BINDING_INVALID");
      } else if (
        priorState.axis !== resultingState.axis ||
        maturityLevelIndexV1(resultingState.axis, resultingState.level) !==
          maturityLevelIndexV1(priorState.axis, priorState.level) + 1
      ) {
        codes.add("RECEIPT_BINDING_INVALID");
      }
      if (record["priorAssuranceStatus"] === null || record["resultingAssuranceStatus"] === null) {
        codes.add("RECEIPT_BINDING_INVALID");
      }
      if (record["verifierRef"] === null) codes.add("RECEIPT_BINDING_INVALID");
    }
    if (kind === "PROMOTION" && record["approvalRef"] === null) {
      codes.add("RECEIPT_BINDING_INVALID");
    }
    if (kind === "ROLLBACK" && record["rollbackContractRef"] === null) {
      codes.add("RECEIPT_BINDING_INVALID");
    }
    if (kind === "ACTIVATION") {
      // Activation is future-evidence-only in CKS-11 v1; this module grants no
      // activation authority even when a structurally valid Approval is given.
      codes.add("INVALID_CONTRACT");
      if (record["activationApprovalRef"] === null) codes.add("RECEIPT_BINDING_INVALID");
    }

    // decisionDigest over the exact decision payload.
    const expectedDecisionDigest = safeDigestOf({
      subjectRef: record["subjectRef"],
      decisionStatus: record["decisionStatus"],
      reasonCodes: record["reasonCodes"],
      contextDigest: record["contextDigest"],
      recordedTimeMs: record["recordedTimeMs"],
    });
    if (
      expectedDecisionDigest !== null &&
      record["decisionDigest"] !== expectedDecisionDigest
    ) {
      codes.add("DIGEST_MISMATCH");
    }
    if (!isDigest(record["decisionDigest"])) codes.add("BAD_DIGEST");

    // receiptDigest over the complete canonical receipt minus receiptDigest.
    const expectedReceiptDigest = safeDigestOf(record, "receiptDigest");
    if (expectedReceiptDigest !== null && record["receiptDigest"] !== expectedReceiptDigest) {
      codes.add("DIGEST_MISMATCH");
    }
    if (!isDigest(record["receiptDigest"])) codes.add("BAD_DIGEST");
  }
  return finalizeRecord(codes, record);
}

// ---------------------------------------------------------------------------
// Fail-closed fast-path route decision.
// ---------------------------------------------------------------------------

function routeDecision(
  status: FastPathRouteStatusV1,
  reasonCodes: readonly RouteReasonCodeV1[],
  contextDigest: unknown,
  useTimeMs: unknown,
): FastPathRouteDecisionV1 {
  return immutable({
    status,
    reasonCodes: [...reasonCodes],
    decisionDigest: sha256Hex(
      canonicalJson({
        status,
        reasonCodes: [...reasonCodes],
        contextDigest: isDigest(contextDigest) ? contextDigest : null,
        useTimeMs: isTimestamp(useTimeMs) ? useTimeMs : null,
      }),
    ),
  });
}

/**
 * Applies the exact fail-closed fast-path route table (decision section 5).
 * FAST_PATH_ALLOWED requires exactly one current GovernedWorkflow match, an
 * authorized use, and no widening: the requested Capability set must be a
 * subset of (approved ceiling ∩ currently enabled policy set), and every
 * Authority requirement must be covered by an exact, currently valid
 * envelope grant. V1 authorizes no activation, so a production fast path
 * never results; this evaluator is the contract that any future activation
 * gate must satisfy first.
 */
export function evaluateFastPathRouteV1(input: unknown): FastPathRouteDecisionV1 {
  let cloned: unknown;
  try {
    cloned = safeJsonClone(input);
  } catch {
    return routeDecision("FAST_PATH_ABORTED", ["INVALID_INPUT"], null, null);
  }
  if (!isPlainDataRecord(cloned)) {
    return routeDecision("FAST_PATH_ABORTED", ["INVALID_INPUT"], null, null);
  }
  const record = cloned;
  const mismatch = keyMismatch(record, FAST_PATH_INPUT_KEYS_V1);
  const contextDigest = record["contextDigest"];
  const useTimeMs = record["useTimeMs"];
  const invalidInput = (): FastPathRouteDecisionV1 =>
    routeDecision("FAST_PATH_ABORTED", ["INVALID_INPUT"], contextDigest, useTimeMs);
  if (
    mismatch === null ||
    mismatch.missing.length > 0 ||
    mismatch.extra.length > 0 ||
    !isTimestamp(useTimeMs) ||
    !isDigest(contextDigest) ||
    !validateRefArray(record["matchedGovernedWorkflowRefs"], ["GOVERNED_WORKFLOW"], new Set()) ||
    !inClosedSet(record["inputCompletenessStatus"], FAST_PATH_INPUT_COMPLETENESS_STATUSES_V1) ||
    !inClosedSet(record["knowledgeStatus"], FAST_PATH_KNOWLEDGE_STATUSES_V1) ||
    !inClosedSet(record["versionStatus"], FAST_PATH_VERSION_STATUSES_V1) ||
    !inClosedSet(record["digestStatus"], FAST_PATH_DIGEST_STATUSES_V1) ||
    !inClosedSet(record["evidenceStatus"], FAST_PATH_EVIDENCE_STATUSES_V1) ||
    !inClosedSet(record["boundaryStatus"], FAST_PATH_BOUNDARY_STATUSES_V1) ||
    !inClosedSet(record["stopState"], FAST_PATH_STOP_STATES_V1) ||
    !validateCapabilitySet(record["capabilityCeiling"], new Set()) ||
    !validateCapabilitySet(record["policyEnabledCapabilities"], new Set()) ||
    !validateCapabilitySet(record["requestedCapabilities"], new Set()) ||
    !validateAuthorityList(record["authorityRequirements"], validateAuthorityRequirement) ||
    !validateAuthorityList(record["envelopeGrants"], validateAuthorityGrant)
  ) {
    return invalidInput();
  }

  const matched = record["matchedGovernedWorkflowRefs"] as unknown[];
  if (matched.length === 0) {
    return routeDecision("FAST_PATH_ABORTED", ["NOT_APPLICABLE"], contextDigest, useTimeMs);
  }
  if (matched.length > 1) {
    return routeDecision("FAST_PATH_ABORTED", ["AMBIGUOUS_MATCH"], contextDigest, useTimeMs);
  }
  if (record["inputCompletenessStatus"] === "MISSING") {
    return routeDecision("FAST_PATH_ABORTED", ["MISSING_INPUT"], contextDigest, useTimeMs);
  }
  const knowledgeStatus = record["knowledgeStatus"];
  if (knowledgeStatus === "MISSING" || knowledgeStatus === "UNAVAILABLE") {
    return routeDecision("REVALIDATION_REQUIRED", ["KNOWLEDGE_MISSING"], contextDigest, useTimeMs);
  }
  if (knowledgeStatus === "EXPIRED") {
    return routeDecision("REVALIDATION_REQUIRED", ["STALE_KNOWLEDGE"], contextDigest, useTimeMs);
  }
  if (knowledgeStatus === "SUPERSEDED" || knowledgeStatus === "REVOKED") {
    return routeDecision(
      "REVALIDATION_REQUIRED",
      ["KNOWLEDGE_SUPERSEDED"],
      contextDigest,
      useTimeMs,
    );
  }
  if (record["versionStatus"] === "DRIFTED") {
    return routeDecision("REVALIDATION_REQUIRED", ["VERSION_DRIFT"], contextDigest, useTimeMs);
  }
  if (record["digestStatus"] === "MISMATCH") {
    return routeDecision("REVALIDATION_REQUIRED", ["DIGEST_MISMATCH"], contextDigest, useTimeMs);
  }
  if (record["evidenceStatus"] === "INCOMPLETE") {
    return routeDecision(
      "REVALIDATION_REQUIRED",
      ["EVIDENCE_INCOMPLETE"],
      contextDigest,
      useTimeMs,
    );
  }
  if (record["boundaryStatus"] === "UNAVAILABLE") {
    return routeDecision("REVALIDATION_REQUIRED", ["BOUNDARY_UNAVAILABLE"], contextDigest, useTimeMs);
  }

  // Capability: narrowing only. Every requested capability must be present,
  // by exact canonical bytes, in BOTH the approved ceiling and the currently
  // enabled policy set.
  const ceiling = new Set(
    (record["capabilityCeiling"] as unknown[]).map((capability) => capabilityKey(capability)),
  );
  const policy = new Set(
    (record["policyEnabledCapabilities"] as unknown[]).map((capability) => capabilityKey(capability)),
  );
  for (const capability of record["requestedCapabilities"] as unknown[]) {
    const key = capabilityKey(capability);
    if (!ceiling.has(key) || !policy.has(key)) {
      return routeDecision("FAST_PATH_ABORTED", ["CAPABILITY_WIDENING"], contextDigest, useTimeMs);
    }
  }

  // Authority: exact grant coverage evaluated at use time (no cached
  // Approval, no self-administered Evidence, no broker bypass), within the
  // grant time window, and only when no active stop state is set.
  if (record["stopState"] === "STOPPED") {
    return routeDecision("FAST_PATH_ABORTED", ["AUTHORITY_WIDENING"], contextDigest, useTimeMs);
  }
  const grants = record["envelopeGrants"] as AuthorityGrantV1[];
  for (const requirement of record["authorityRequirements"] as AuthorityRequirementV1[]) {
    const covered = grants.some(
      (grant) =>
        grant.actor === requirement.actor &&
        grant.tenant === requirement.tenant &&
        grant.action === requirement.action &&
        grant.target === requirement.target &&
        grant.scope === requirement.scope &&
        grant.validFromMs <= useTimeMs &&
        useTimeMs <= grant.validUntilMs,
    );
    if (!covered) {
      return routeDecision("FAST_PATH_ABORTED", ["AUTHORITY_WIDENING"], contextDigest, useTimeMs);
    }
  }

  return routeDecision("FAST_PATH_ALLOWED", ["NONE"], contextDigest, useTimeMs);
}

function validateAuthorityList(
  value: unknown,
  validateEntry: (entry: unknown, codes: CodeSet) => boolean,
): boolean {
  if (!isDenseStandardArray(value)) return false;
  const codes: CodeSet = new Set();
  return value.every((entry) => validateEntry(entry, codes));
}