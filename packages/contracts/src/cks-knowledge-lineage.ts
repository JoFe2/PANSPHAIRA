import { createHash } from "node:crypto";
import { canonicalJson } from "./canonical-json.js";

export const CKS_KNOWLEDGE_USAGE_EVENT_SCHEMA_V1 = "chimpmaera.knowledge/usage-lineage-event/v1" as const;
export const CKS_DECISION_KNOWLEDGE_BINDING_SCHEMA_V1 = "chimpmaera.knowledge/usage-lineage-decision/v1" as const;
export const CKS_TASK_OUTCOME_EVIDENCE_SCHEMA_V1 = "chimpmaera.knowledge/usage-lineage-outcome/v1" as const;
export const CKS_FAILURE_ATTRIBUTION_SCHEMA_V1 = "chimpmaera.knowledge/failure-attribution/v1" as const;
export const CKS_KNOWLEDGE_EVIDENCE_PROFILE_SCHEMA_V1 = "chimpmaera.knowledge/evidence-profile/v1" as const;
export const CKS_KNOWLEDGE_LINEAGE_SEMANTIC_RULE_V1 = "chimpmaera.knowledge/usage-lineage-semantics/v1" as const;
export const CKS_LOCAL_SYNTHETIC_SCOPE_CLASS_V1 = "LOCAL_SYNTHETIC_FIXTURE" as const;
export const CKS_LATE_WINDOW_MS_V1 = 300000 as const;
export const CKS_MAX_EVENTS_PER_SCOPE_V1 = 4096 as const;
export const CKS_MAX_EVENTS_PER_TASK_V1 = 256 as const;
export const CKS_MAX_SEARCHES_PER_TASK_V1 = 16 as const;
export const CKS_MAX_KNOWLEDGE_REFS_V1 = 32 as const;
export const CKS_MAX_FAILURE_CAUSES_V1 = 3 as const;
export const CKS_MAX_CAUSE_EVENT_REFS_V1 = 3 as const;
export const CKS_MAX_REASON_CODES_PER_DENIAL_V1 = 8 as const;

export const KNOWLEDGE_USAGE_EVENT_SCHEMA_V1 = CKS_KNOWLEDGE_USAGE_EVENT_SCHEMA_V1;
export const DECISION_KNOWLEDGE_BINDING_SCHEMA_V1 = CKS_DECISION_KNOWLEDGE_BINDING_SCHEMA_V1;
export const TASK_OUTCOME_EVIDENCE_SCHEMA_V1 = CKS_TASK_OUTCOME_EVIDENCE_SCHEMA_V1;
export const FAILURE_ATTRIBUTION_SCHEMA_V1 = CKS_FAILURE_ATTRIBUTION_SCHEMA_V1;
export const KNOWLEDGE_EVIDENCE_PROFILE_SCHEMA_V1 = CKS_KNOWLEDGE_EVIDENCE_PROFILE_SCHEMA_V1;

export const CKS_EVENT_TYPES_V1 = [
  "TASK_OPENED", "SEARCH_RECORDED", "KNOWLEDGE_INSPECTED", "KNOWLEDGE_DISPOSITIONED",
  "DECISION_RECORDED", "OUTCOME_RECORDED",
] as const;
export type KnowledgeUsageEventTypeV1 = typeof CKS_EVENT_TYPES_V1[number];
export type TaskKindV1 = "RETRIEVE" | "DECIDE" | "ACT" | "VERIFY";
export type DecisionClassV1 = "SELECTED" | "REJECTED" | "DEFERRED" | "DENIED";
export type OutcomeClassV1 = "SUCCEEDED" | "FAILED" | "PARTIAL" | "DENIED" | "UNKNOWN";
export type KnowledgeDispositionV1 = "USED" | "REJECTED";
export type FailureClassV1 = "KNOWLEDGE" | "SEARCH" | "DECISION" | "EXECUTION" | "TASK_INPUT" | "EXTERNAL" | "GOVERNANCE" | "UNKNOWN";
export type FailureCertaintyV1 = "CONFIRMED" | "SUPPORTED" | "POSSIBLE" | "UNKNOWN";
export type CausalModeV1 = "NOT_APPLICABLE" | "SINGLE" | "MULTI_CONTRIBUTING" | "MULTI_JOINT" | "ALTERNATIVES_UNRESOLVED" | "UNKNOWN";
export type ApplicabilityMatchStateV1 = "MATCH" | "NO_MATCH" | "NEEDS_CONTEXT" | "CONFLICT";
export type FreshnessStateV1 = "FRESH" | "STALE" | "UNKNOWN";
export type ContradictionStateV1 = "NONE_DECLARED" | "DECLARED_UNRESOLVED" | "UNKNOWN";

export interface ScopeRefV1 { readonly scopeId: string; readonly scopeDigest: string }
export interface TaskRefV1 { readonly taskId: string; readonly taskDigest: string }
export interface SearchRefV1 { readonly searchId: string; readonly searchDigest: string }
export interface KnowledgeRefV1 { readonly knowledgeId: string; readonly knowledgeDigest: string }
export interface DecisionRefV1 { readonly decisionId: string; readonly decisionDigest: string }
export interface OutcomeRefV1 { readonly outcomeId: string; readonly outcomeDigest: string }
export interface EventRefV1 { readonly eventId: string; readonly eventDigest: string }

export interface UsageLineageTaskV1 {
  readonly schemaVersion: "chimpmaera.knowledge/usage-lineage-task/v1";
  readonly semanticRuleId: typeof CKS_KNOWLEDGE_LINEAGE_SEMANTIC_RULE_V1;
  readonly scopeRef: ScopeRefV1;
  readonly taskId: string;
  readonly taskKind: TaskKindV1;
  readonly objectiveDigest: string;
  readonly applicabilityContextDigest: string;
  readonly taskSemanticDigest: string;
  readonly contextFingerprintDigest: string;
  readonly taskDigest: string;
}
export interface UsageLineageSearchV1 {
  readonly schemaVersion: "chimpmaera.knowledge/usage-lineage-search/v1";
  readonly semanticRuleId: typeof CKS_KNOWLEDGE_LINEAGE_SEMANTIC_RULE_V1;
  readonly scopeRef: ScopeRefV1;
  readonly taskRef: TaskRefV1;
  readonly searchId: string;
  readonly searchIntentDigest: string;
  readonly resultKnowledgeRefs: readonly KnowledgeRefV1[];
  readonly searchDigest: string;
}

export interface DecisionKnowledgeBindingV1 {
  readonly schemaVersion: typeof CKS_DECISION_KNOWLEDGE_BINDING_SCHEMA_V1;
  readonly semanticRuleId: typeof CKS_KNOWLEDGE_LINEAGE_SEMANTIC_RULE_V1;
  readonly scopeRef: ScopeRefV1;
  readonly taskRef: TaskRefV1;
  readonly decisionId: string;
  readonly decisionClass: DecisionClassV1;
  readonly supportingKnowledgeRefs: readonly KnowledgeRefV1[];
  readonly decisionDigest: string;
}
export interface FailureCauseV1 {
  readonly class: FailureClassV1;
  readonly subtype: string;
  readonly certainty: FailureCertaintyV1;
  readonly causeEventRefs: readonly EventRefV1[];
  readonly affectedKnowledgeRefs: readonly KnowledgeRefV1[];
}
export interface FailureAttributionV1 {
  readonly schemaVersion: typeof CKS_FAILURE_ATTRIBUTION_SCHEMA_V1;
  readonly semanticRuleId: typeof CKS_KNOWLEDGE_LINEAGE_SEMANTIC_RULE_V1;
  readonly causalMode: CausalModeV1;
  readonly causes: readonly FailureCauseV1[];
  readonly failureAttributionDigest: string;
}
export interface TaskOutcomeEvidenceV1 {
  readonly schemaVersion: typeof CKS_TASK_OUTCOME_EVIDENCE_SCHEMA_V1;
  readonly semanticRuleId: typeof CKS_KNOWLEDGE_LINEAGE_SEMANTIC_RULE_V1;
  readonly scopeRef: ScopeRefV1;
  readonly taskRef: TaskRefV1;
  readonly decisionRef: DecisionRefV1;
  readonly outcomeId: string;
  readonly outcomeClass: OutcomeClassV1;
  readonly contributingKnowledgeRefs: readonly KnowledgeRefV1[];
  readonly failureAttribution: FailureAttributionV1;
  readonly outcomeDigest: string;
}

export type KnowledgeUsageFactV1 =
  | { readonly task: UsageLineageTaskV1 }
  | { readonly search: UsageLineageSearchV1 }
  | { readonly scopeRef: ScopeRefV1; readonly taskRef: TaskRefV1; readonly searchRef: SearchRefV1; readonly knowledgeRef: KnowledgeRefV1 }
  | { readonly scopeRef: ScopeRefV1; readonly taskRef: TaskRefV1; readonly knowledgeRef: KnowledgeRefV1; readonly disposition: KnowledgeDispositionV1; readonly reasonCode: "SELECTED_FOR_TASK" | "NOT_APPLICABLE" | "STALE" | "CONTRADICTED" | "INSUFFICIENT_SOURCE_SUPPORT" | "NOT_NEEDED" | "POLICY_DENIED" }
  | { readonly decision: DecisionKnowledgeBindingV1 }
  | { readonly outcome: TaskOutcomeEvidenceV1 };
export interface KnowledgeUsageEventV1 {
  readonly schemaVersion: typeof CKS_KNOWLEDGE_USAGE_EVENT_SCHEMA_V1;
  readonly semanticRuleId: typeof CKS_KNOWLEDGE_LINEAGE_SEMANTIC_RULE_V1;
  readonly eventId: string;
  readonly eventType: KnowledgeUsageEventTypeV1;
  readonly scopeRef: ScopeRefV1;
  readonly taskRef: TaskRefV1;
  readonly occurredAtMs: number;
  readonly receivedAtMs: number;
  readonly scopeSequence: number;
  readonly previousEventDigest: string | null;
  readonly fact: KnowledgeUsageFactV1;
  readonly factDigest: string;
  readonly eventDigest: string;
}

export interface KnowledgeEvidenceProfileV1 {
  readonly schemaVersion: typeof CKS_KNOWLEDGE_EVIDENCE_PROFILE_SCHEMA_V1;
  readonly semanticRuleId: typeof CKS_KNOWLEDGE_LINEAGE_SEMANTIC_RULE_V1;
  readonly scopeRef: ScopeRefV1;
  readonly knowledgeRef: KnowledgeRefV1;
  readonly dimensions: {
    readonly source: { readonly knowledgeDigest: string; readonly attributionSetDigest: string; readonly epistemicStatus: "VERIFIED" | "SUPPORTED" | "UNVERIFIED" | "DISPUTED" | "UNRESOLVED"; readonly trust: "LOW" | "MEDIUM" | "HIGH" };
    readonly applicability: { readonly applicabilityScopeDigest: string; readonly contextFingerprintDigest: string; readonly matchState: ApplicabilityMatchStateV1 };
    readonly freshness: { readonly knowledgeDigest: string; readonly evaluatedAtMs: number; readonly freshnessState: FreshnessStateV1 };
    readonly contradiction: { readonly knowledgeDigest: string; readonly conflictSetDigest: string; readonly contradictionState: ContradictionStateV1 };
    readonly generalization: { readonly validTaskOccurrenceCount: number; readonly distinctTaskSemanticCount: number; readonly distinctContextCount: number; readonly distinctJointUsageUnitCount: number; readonly identicalRepetitionCount: number; readonly marker: "+G" | null };
    readonly operational: { readonly eligibleOutcomeOccurrenceCount: number; readonly distinctOperationalUnitCount: number; readonly distinctOutcomeUnitsByClass: { readonly SUCCEEDED: number; readonly FAILED: number; readonly PARTIAL: number; readonly DENIED: number }; readonly uncertainOutcomeOccurrenceCount: number; readonly failureCauseObservations: readonly { readonly class: FailureClassV1; readonly subtype: string; readonly certainty: FailureCertaintyV1 }[]; readonly marker: "+O" | null };
  };
  readonly profileDigest: string;
}

export type CksReasonCodeV1 =
  | "CONTRACT_VERIFIED" | "SCHEMA_DENIED" | "PROHIBITED_FIELD_DENIED" | "IDENTIFIER_MISSING_DENIED" | "IDENTIFIER_FORMAT_DENIED"
  | "DIGEST_MISSING_DENIED" | "DIGEST_MISMATCH_DENIED" | "SEMANTIC_RULE_MISSING_DENIED" | "SEMANTIC_RULE_VERSION_DENIED"
  | "UPSTREAM_BINDING_DENIED" | "SCOPE_MISMATCH_DENIED" | "SEQUENCE_GAP_DENIED" | "PREVIOUS_DIGEST_MISMATCH_DENIED"
  | "PARENT_MISSING_DENIED" | "CAUSAL_ORDER_DENIED" | "LATE_EVENT_DENIED" | "TASK_FROZEN_DENIED" | "TASK_SEALED_DENIED"
  | "REPLAY_DENIED" | "TAMPERED_LINEAGE_DENIED" | "TRANSITION_DENIED" | "FAILURE_ATTRIBUTION_DENIED" | "CAPACITY_DENIED" | "INCOMPLETE_LINEAGE_DENIED";
export interface CksVerificationV1 { readonly outcome: "ACCEPTED" | "DENIED"; readonly reasonCodes: readonly CksReasonCodeV1[] }

export const CKS_FAILURE_SUBTYPES_V1: Readonly<Record<FailureClassV1, readonly string[]>> = {
  KNOWLEDGE: ["SOURCE_DEFECT", "APPLICABILITY_MISMATCH", "STALE", "CONTRADICTED", "MISSING", "UNSUPPORTED_GENERALIZATION"],
  SEARCH: ["RELEVANT_NOT_RETURNED", "RELEVANT_NOT_INSPECTED", "RELEVANT_REJECTED"],
  DECISION: ["UNSUPPORTED_SELECTION", "SUPPORTED_OPTION_IGNORED"],
  EXECUTION: ["ACTION_FAILED", "READBACK_FAILED"],
  TASK_INPUT: ["MISSING_CONTEXT", "INVALID_INPUT"],
  EXTERNAL: ["DEPENDENCY_UNAVAILABLE", "ENVIRONMENT_DRIFT"],
  GOVERNANCE: ["POLICY_DENIED", "AUTHORITY_DENIED"],
  UNKNOWN: ["INSUFFICIENT_CAUSAL_EVIDENCE"],
};
const FAILURE_CLASSES = Object.keys(CKS_FAILURE_SUBTYPES_V1) as FailureClassV1[];
const FAILURE_CERTAINTIES: readonly FailureCertaintyV1[] = ["CONFIRMED", "SUPPORTED", "POSSIBLE", "UNKNOWN"];
const CAUSAL_MODES: readonly CausalModeV1[] = ["NOT_APPLICABLE", "SINGLE", "MULTI_CONTRIBUTING", "MULTI_JOINT", "ALTERNATIVES_UNRESOLVED", "UNKNOWN"];
const PROHIBITED_KEYS = new Set(["actoridentity", "chainofthought", "command", "content", "credential", "customer", "email", "filename", "filepath", "hostname", "identity", "ipaddress", "message", "path", "person", "phone", "prompt", "rawevent", "rawpayload", "rawreasoning", "rawtext", "reasoning", "response", "secret", "sessionid", "tenantid", "token", "userid", "username"]);
const id = (v: unknown, pattern: RegExp): v is string => typeof v === "string" && pattern.test(v);
const digest = (v: unknown): v is string => typeof v === "string" && /^[a-f0-9]{64}$/.test(v);
const timestamp = (v: unknown): v is number => Number.isSafeInteger(v) && (v as number) >= 0;
const scopeId = (v: unknown): v is string => id(v, /^scope:v1:[a-f0-9]{64}$/);
const taskId = (v: unknown): v is string => id(v, /^task:v1:[a-f0-9]{64}$/);
const searchId = (v: unknown): v is string => id(v, /^search:v1:[a-f0-9]{64}$/);
const knowledgeId = (v: unknown): v is string => id(v, /^[a-z][a-z0-9-]{1,31}:[a-z0-9][a-z0-9._-]{2,95}$/);
const decisionId = (v: unknown): v is string => id(v, /^decision:v1:[a-f0-9]{64}$/);
const outcomeId = (v: unknown): v is string => id(v, /^outcome:v1:[a-f0-9]{64}$/);
const eventId = (v: unknown): v is string => id(v, /^lineage-event:v1:[a-f0-9]{64}$/);
const normalized = (v: string): string => v.replace(/[^a-zA-Z0-9]/g, "").toLowerCase();
const key = (v: { readonly [name: string]: unknown }): string => Object.keys(v).sort().join("\u0000");
const exact = (v: unknown, keys: readonly string[]): v is Record<string, unknown> => isRecord(v) && key(v) === [...keys].sort().join("\u0000");
function isRecord(v: unknown): v is Record<string, unknown> { return v !== null && typeof v === "object" && !Array.isArray(v) && Object.getPrototypeOf(v) === Object.prototype; }
function safeStructure(v: unknown, seen = new Set<object>()): boolean {
  if (v === null || typeof v === "string" || typeof v === "boolean") return true;
  if (typeof v === "number") return Number.isFinite(v);
  if (typeof v !== "object") return false;
  if (seen.has(v)) return false;
  seen.add(v);
  if (Array.isArray(v)) {
    if (!Object.keys(v).every((k) => /^\d+$/.test(k)) || Object.keys(v).length !== v.length) return false;
    const valid = v.every((item) => safeStructure(item, seen));
    seen.delete(v);
    return valid;
  }
  if (Object.getPrototypeOf(v) !== Object.prototype) return false;
  for (const symbol of Object.getOwnPropertySymbols(v)) if (symbol) return false;
  for (const name of Object.keys(v)) {
    const descriptor = Object.getOwnPropertyDescriptor(v, name);
    if (!descriptor || !("value" in descriptor) || descriptor.enumerable !== true || PROHIBITED_KEYS.has(normalized(name))) return false;
    if (!safeStructure(descriptor.value, seen)) return false;
  }
  seen.delete(v);
  return true;
}
function refs<T extends Record<string, unknown>>(v: unknown, names: readonly [string, string], identifier: (v: unknown) => boolean): v is T {
  return exact(v, names) && identifier(v[names[0]]) && digest(v[names[1]]);
}
const scopeRef = (v: unknown): v is ScopeRefV1 => refs(v, ["scopeId", "scopeDigest"], scopeId);
const taskRef = (v: unknown): v is TaskRefV1 => refs(v, ["taskId", "taskDigest"], taskId);
const searchRef = (v: unknown): v is SearchRefV1 => refs(v, ["searchId", "searchDigest"], searchId);
const knowledgeRef = (v: unknown): v is KnowledgeRefV1 => refs(v, ["knowledgeId", "knowledgeDigest"], knowledgeId);
const decisionRef = (v: unknown): v is DecisionRefV1 => refs(v, ["decisionId", "decisionDigest"], decisionId);
const outcomeRef = (v: unknown): v is OutcomeRefV1 => refs(v, ["outcomeId", "outcomeDigest"], outcomeId);
const eventRef = (v: unknown): v is EventRefV1 => refs(v, ["eventId", "eventDigest"], eventId);
type RefLike = { readonly knowledgeId?: string; readonly eventId?: string; readonly searchId?: string; readonly decisionId?: string; readonly outcomeId?: string; readonly taskId?: string; readonly scopeId?: string; readonly knowledgeDigest?: string; readonly eventDigest?: string; readonly searchDigest?: string; readonly decisionDigest?: string; readonly outcomeDigest?: string; readonly taskDigest?: string; readonly scopeDigest?: string };
const refSort = (a: RefLike, b: RefLike): number => {
  const identifier = (ref: RefLike): string => ref.knowledgeId ?? ref.eventId ?? ref.searchId ?? ref.decisionId ?? ref.outcomeId ?? ref.taskId ?? ref.scopeId ?? "";
  const digestValue = (ref: RefLike): string => ref.knowledgeDigest ?? ref.eventDigest ?? ref.searchDigest ?? ref.decisionDigest ?? ref.outcomeDigest ?? ref.taskDigest ?? ref.scopeDigest ?? "";
  return `${identifier(a)}|${digestValue(a)}`.localeCompare(`${identifier(b)}|${digestValue(b)}`);
};
function sortedUnique<T extends RefLike>(v: unknown, valid: (x: unknown) => x is T): v is T[] {
  if (!Array.isArray(v) || v.length > 32 || !v.every(valid) || new Set(v.map((x) => JSON.stringify(x))).size !== v.length) return false;
  return v.every((item, index) => index === 0 || refSort(v[index - 1]!, item) < 0);
}
function sha(value: unknown): string { if (!safeStructure(value)) throw new TypeError("CKS_DIGEST_INPUT_DENIED"); return createHash("sha256").update(canonicalJson(value), "utf8").digest("hex"); }
function unsigned(value: Record<string, unknown>, field: string): Record<string, unknown> { return Object.fromEntries(Object.entries(value).filter(([name]) => name !== field)); }
export const cksDigestV1 = (value: unknown, field: string): string => {
  if (!isRecord(value) || !safeStructure(value)) throw new TypeError("CKS_DIGEST_INPUT_DENIED");
  return sha(unsigned(value, field));
};
export const knowledgeUsageFactDigestV1 = (value: unknown): string => sha(value);
export const knowledgeUsageEventDigestV1 = (value: Record<string, unknown>): string => cksDigestV1(value, "eventDigest");
export const usageLineageTaskDigestV1 = (value: Record<string, unknown>): string => cksDigestV1(value, "taskDigest");
export const usageLineageSearchDigestV1 = (value: Record<string, unknown>): string => cksDigestV1(value, "searchDigest");
export const decisionKnowledgeBindingDigestV1 = (value: Record<string, unknown>): string => cksDigestV1(value, "decisionDigest");
export const taskOutcomeEvidenceDigestV1 = (value: Record<string, unknown>): string => cksDigestV1(value, "outcomeDigest");
export const failureAttributionDigestV1 = (value: Record<string, unknown>): string => cksDigestV1(value, "failureAttributionDigest");
export const knowledgeEvidenceProfileDigestV1 = (value: Record<string, unknown>): string => cksDigestV1(value, "profileDigest");

function validScopeAndTask(value: unknown): value is UsageLineageTaskV1 {
  return exact(value, ["schemaVersion", "semanticRuleId", "scopeRef", "taskId", "taskKind", "objectiveDigest", "applicabilityContextDigest", "taskSemanticDigest", "contextFingerprintDigest", "taskDigest"])
    && value.schemaVersion === "chimpmaera.knowledge/usage-lineage-task/v1" && value.semanticRuleId === CKS_KNOWLEDGE_LINEAGE_SEMANTIC_RULE_V1 && scopeRef(value.scopeRef) && taskId(value.taskId)
    && ["RETRIEVE", "DECIDE", "ACT", "VERIFY"].includes(value.taskKind as string) && digest(value.objectiveDigest) && digest(value.applicabilityContextDigest) && digest(value.taskSemanticDigest) && digest(value.contextFingerprintDigest) && digest(value.taskDigest)
    && usageLineageTaskDigestV1(value) === value.taskDigest;
}
function validSearch(value: unknown): value is UsageLineageSearchV1 {
  return exact(value, ["schemaVersion", "semanticRuleId", "scopeRef", "taskRef", "searchId", "searchIntentDigest", "resultKnowledgeRefs", "searchDigest"])
    && value.schemaVersion === "chimpmaera.knowledge/usage-lineage-search/v1" && value.semanticRuleId === CKS_KNOWLEDGE_LINEAGE_SEMANTIC_RULE_V1 && scopeRef(value.scopeRef) && taskRef(value.taskRef) && searchId(value.searchId) && digest(value.searchIntentDigest) && sortedUnique(value.resultKnowledgeRefs, knowledgeRef) && digest(value.searchDigest)
    && usageLineageSearchDigestV1(value) === value.searchDigest;
}
function validFailureCause(value: unknown): value is FailureCauseV1 {
  return exact(value, ["class", "subtype", "certainty", "causeEventRefs", "affectedKnowledgeRefs"])
    && FAILURE_CLASSES.includes(value.class as FailureClassV1) && CKS_FAILURE_SUBTYPES_V1[value.class as FailureClassV1].includes(value.subtype as string)
    && FAILURE_CERTAINTIES.includes(value.certainty as FailureCertaintyV1) && sortedUnique(value.causeEventRefs, eventRef) && sortedUnique(value.affectedKnowledgeRefs, knowledgeRef)
    && (value.class === "UNKNOWN" ? value.affectedKnowledgeRefs.length === 0 && value.certainty === "UNKNOWN" : value.causeEventRefs.length > 0);
}
export function validateFailureAttributionV1(value: unknown): value is FailureAttributionV1 {
  if (!safeStructure(value) || !exact(value, ["schemaVersion", "semanticRuleId", "causalMode", "causes", "failureAttributionDigest"]) || value.schemaVersion !== CKS_FAILURE_ATTRIBUTION_SCHEMA_V1 || value.semanticRuleId !== CKS_KNOWLEDGE_LINEAGE_SEMANTIC_RULE_V1 || !CAUSAL_MODES.includes(value.causalMode as CausalModeV1) || !Array.isArray(value.causes) || value.causes.length > 3 || !value.causes.every(validFailureCause) || !digest(value.failureAttributionDigest)) return false;
  const causes = value.causes as FailureCauseV1[];
  const signatures = causes.map((cause) => `${cause.class}|${cause.subtype}`);
  if (new Set(signatures).size !== signatures.length || signatures.some((item, i) => i > 0 && signatures[i - 1]! >= item)) return false;
  const mode = value.causalMode as CausalModeV1;
  if (mode === "NOT_APPLICABLE" && causes.length !== 0) return false;
  if (mode === "UNKNOWN" && (causes.length !== 1 || causes[0]!.class !== "UNKNOWN")) return false;
  if (mode === "SINGLE" && (causes.length !== 1 || !["CONFIRMED", "SUPPORTED"].includes(causes[0]!.certainty))) return false;
  if (["MULTI_CONTRIBUTING", "MULTI_JOINT"].includes(mode) && (causes.length < 2 || !causes.every((cause) => ["CONFIRMED", "SUPPORTED"].includes(cause.certainty)))) return false;
  if (mode === "ALTERNATIVES_UNRESOLVED" && (causes.length < 2 || !causes.every((cause) => cause.certainty === "POSSIBLE"))) return false;
  return failureAttributionDigestV1(value) === value.failureAttributionDigest;
}
export function validateDecisionKnowledgeBindingV1(value: unknown): value is DecisionKnowledgeBindingV1 {
  return safeStructure(value) && exact(value, ["schemaVersion", "semanticRuleId", "scopeRef", "taskRef", "decisionId", "decisionClass", "supportingKnowledgeRefs", "decisionDigest"])
    && value.schemaVersion === CKS_DECISION_KNOWLEDGE_BINDING_SCHEMA_V1 && value.semanticRuleId === CKS_KNOWLEDGE_LINEAGE_SEMANTIC_RULE_V1 && scopeRef(value.scopeRef) && taskRef(value.taskRef) && decisionId(value.decisionId)
    && ["SELECTED", "REJECTED", "DEFERRED", "DENIED"].includes(value.decisionClass as string) && sortedUnique(value.supportingKnowledgeRefs, knowledgeRef) && digest(value.decisionDigest)
    && decisionKnowledgeBindingDigestV1(value) === value.decisionDigest;
}
export function validateTaskOutcomeEvidenceV1(value: unknown): value is TaskOutcomeEvidenceV1 {
  return safeStructure(value) && exact(value, ["schemaVersion", "semanticRuleId", "scopeRef", "taskRef", "decisionRef", "outcomeId", "outcomeClass", "contributingKnowledgeRefs", "failureAttribution", "outcomeDigest"])
    && value.schemaVersion === CKS_TASK_OUTCOME_EVIDENCE_SCHEMA_V1 && value.semanticRuleId === CKS_KNOWLEDGE_LINEAGE_SEMANTIC_RULE_V1 && scopeRef(value.scopeRef) && taskRef(value.taskRef) && decisionRef(value.decisionRef) && outcomeId(value.outcomeId)
    && ["SUCCEEDED", "FAILED", "PARTIAL", "DENIED", "UNKNOWN"].includes(value.outcomeClass as string) && sortedUnique(value.contributingKnowledgeRefs, knowledgeRef) && validateFailureAttributionV1(value.failureAttribution) && digest(value.outcomeDigest)
    && (value.outcomeClass === "SUCCEEDED" ? value.failureAttribution.causalMode === "NOT_APPLICABLE" && value.failureAttribution.causes.length === 0 : value.outcomeClass === "UNKNOWN" ? value.failureAttribution.causalMode === "UNKNOWN" : value.failureAttribution.causes.length > 0)
    && taskOutcomeEvidenceDigestV1(value) === value.outcomeDigest;
}
function validFact(type: KnowledgeUsageEventTypeV1, fact: unknown, event: Record<string, unknown>): boolean {
  if (!isRecord(fact)) return false;
  const eventScope = event.scopeRef as ScopeRefV1, eventTask = event.taskRef as TaskRefV1;
  if (type === "TASK_OPENED") {
    const task = fact.task as UsageLineageTaskV1;
    return exact(fact, ["task"]) && validScopeAndTask(task) && task.scopeRef.scopeId === eventScope.scopeId && task.taskId === eventTask.taskId && task.scopeRef.scopeDigest === eventScope.scopeDigest && task.taskDigest === eventTask.taskDigest;
  }
  if (type === "SEARCH_RECORDED") {
    const search = fact.search as UsageLineageSearchV1;
    return exact(fact, ["search"]) && validSearch(search) && search.scopeRef.scopeId === eventScope.scopeId && search.scopeRef.scopeDigest === eventScope.scopeDigest && search.taskRef.taskId === eventTask.taskId && search.taskRef.taskDigest === eventTask.taskDigest;
  }
  if (type === "KNOWLEDGE_INSPECTED") return exact(fact, ["scopeRef", "taskRef", "searchRef", "knowledgeRef"]) && scopeRef(fact.scopeRef) && taskRef(fact.taskRef) && searchRef(fact.searchRef) && knowledgeRef(fact.knowledgeRef) && sameScopeTask(fact, event);
  if (type === "KNOWLEDGE_DISPOSITIONED") return exact(fact, ["scopeRef", "taskRef", "knowledgeRef", "disposition", "reasonCode"]) && scopeRef(fact.scopeRef) && taskRef(fact.taskRef) && knowledgeRef(fact.knowledgeRef) && ["USED", "REJECTED"].includes(fact.disposition as string) && (["USED", "REJECTED"].includes(fact.disposition as string) ? (fact.disposition === "USED" ? fact.reasonCode === "SELECTED_FOR_TASK" : ["NOT_APPLICABLE", "STALE", "CONTRADICTED", "INSUFFICIENT_SOURCE_SUPPORT", "NOT_NEEDED", "POLICY_DENIED"].includes(fact.reasonCode as string)) : false) && sameScopeTask(fact, event);
  if (type === "DECISION_RECORDED") {
    const decision = fact.decision as DecisionKnowledgeBindingV1;
    return exact(fact, ["decision"]) && validateDecisionKnowledgeBindingV1(decision) && decision.scopeRef.scopeId === eventScope.scopeId && decision.scopeRef.scopeDigest === eventScope.scopeDigest && decision.taskRef.taskId === eventTask.taskId && decision.taskRef.taskDigest === eventTask.taskDigest;
  }
  const outcome = fact.outcome as TaskOutcomeEvidenceV1;
  return exact(fact, ["outcome"]) && validateTaskOutcomeEvidenceV1(outcome) && outcome.scopeRef.scopeId === eventScope.scopeId && outcome.scopeRef.scopeDigest === eventScope.scopeDigest && outcome.taskRef.taskId === eventTask.taskId && outcome.taskRef.taskDigest === eventTask.taskDigest;
}
function sameScopeTask(fact: Record<string, unknown>, event: Record<string, unknown>): boolean {
  const s = fact.scopeRef as ScopeRefV1, t = fact.taskRef as TaskRefV1, es = event.scopeRef as ScopeRefV1, et = event.taskRef as TaskRefV1;
  return s.scopeId === es.scopeId && s.scopeDigest === es.scopeDigest && t.taskId === et.taskId && t.taskDigest === et.taskDigest;
}
function validEventShape(value: unknown): value is KnowledgeUsageEventV1 {
  if (!safeStructure(value) || !exact(value, ["schemaVersion", "semanticRuleId", "eventId", "eventType", "scopeRef", "taskRef", "occurredAtMs", "receivedAtMs", "scopeSequence", "previousEventDigest", "fact", "factDigest", "eventDigest"])) return false;
  const event = value as Record<string, unknown>;
  return event.schemaVersion === CKS_KNOWLEDGE_USAGE_EVENT_SCHEMA_V1 && event.semanticRuleId === CKS_KNOWLEDGE_LINEAGE_SEMANTIC_RULE_V1 && eventId(event.eventId) && CKS_EVENT_TYPES_V1.includes(event.eventType as KnowledgeUsageEventTypeV1) && scopeRef(event.scopeRef) && taskRef(event.taskRef)
    && timestamp(event.occurredAtMs) && timestamp(event.receivedAtMs) && (event.receivedAtMs as number) >= (event.occurredAtMs as number) && Number.isSafeInteger(event.scopeSequence) && (event.scopeSequence as number) >= 0 && (event.previousEventDigest === null || digest(event.previousEventDigest)) && digest(event.factDigest) && digest(event.eventDigest)
    && knowledgeUsageFactDigestV1(event.fact) === event.factDigest && validFact(event.eventType as KnowledgeUsageEventTypeV1, event.fact, event) && knowledgeUsageEventDigestV1(event) === event.eventDigest;
}
export function validateKnowledgeUsageEventV1(value: unknown): value is KnowledgeUsageEventV1 { return validEventShape(value); }
export function verifyKnowledgeUsageEventV1(value: unknown): CksVerificationV1 { if (!safeStructure(value)) return { outcome: "DENIED", reasonCodes: ["PROHIBITED_FIELD_DENIED"] }; return validEventShape(value) ? { outcome: "ACCEPTED", reasonCodes: ["CONTRACT_VERIFIED"] } : { outcome: "DENIED", reasonCodes: ["DIGEST_MISMATCH_DENIED"] }; }

function validProfileDimension(value: unknown): boolean {
  if (!isRecord(value)) return false;
  return exact(value, ["source", "applicability", "freshness", "contradiction", "generalization", "operational"])
    && exact(value.source, ["knowledgeDigest", "attributionSetDigest", "epistemicStatus", "trust"]) && digest(value.source.knowledgeDigest) && digest(value.source.attributionSetDigest) && ["VERIFIED", "SUPPORTED", "UNVERIFIED", "DISPUTED", "UNRESOLVED"].includes(value.source.epistemicStatus as string) && ["LOW", "MEDIUM", "HIGH"].includes(value.source.trust as string)
    && exact(value.applicability, ["applicabilityScopeDigest", "contextFingerprintDigest", "matchState"]) && digest(value.applicability.applicabilityScopeDigest) && digest(value.applicability.contextFingerprintDigest) && ["MATCH", "NO_MATCH", "NEEDS_CONTEXT", "CONFLICT"].includes(value.applicability.matchState as string)
    && exact(value.freshness, ["knowledgeDigest", "evaluatedAtMs", "freshnessState"]) && digest(value.freshness.knowledgeDigest) && timestamp(value.freshness.evaluatedAtMs) && ["FRESH", "STALE", "UNKNOWN"].includes(value.freshness.freshnessState as string)
    && exact(value.contradiction, ["knowledgeDigest", "conflictSetDigest", "contradictionState"]) && digest(value.contradiction.knowledgeDigest) && digest(value.contradiction.conflictSetDigest) && ["NONE_DECLARED", "DECLARED_UNRESOLVED", "UNKNOWN"].includes(value.contradiction.contradictionState as string)
    && validGeneralization(value.generalization) && validOperational(value.operational);
}
function validGeneralization(value: unknown): boolean {
  return isRecord(value) && exact(value, ["validTaskOccurrenceCount", "distinctTaskSemanticCount", "distinctContextCount", "distinctJointUsageUnitCount", "identicalRepetitionCount", "marker"]) && ["validTaskOccurrenceCount", "distinctTaskSemanticCount", "distinctContextCount", "distinctJointUsageUnitCount", "identicalRepetitionCount"].every((name) => Number.isSafeInteger(value[name]) && (value[name] as number) >= 0) && (value.distinctTaskSemanticCount as number) <= (value.validTaskOccurrenceCount as number) && (value.distinctContextCount as number) <= (value.validTaskOccurrenceCount as number) && (value.distinctJointUsageUnitCount as number) <= (value.validTaskOccurrenceCount as number) && (value.identicalRepetitionCount as number) === (value.validTaskOccurrenceCount as number) - (value.distinctJointUsageUnitCount as number) && (value.marker === null || value.marker === "+G") && ((value.marker === "+G") === (value.distinctTaskSemanticCount as number >= 2 && value.distinctContextCount as number >= 2));
}
function validOperational(value: unknown): boolean {
  if (!isRecord(value) || !exact(value, ["eligibleOutcomeOccurrenceCount", "distinctOperationalUnitCount", "distinctOutcomeUnitsByClass", "uncertainOutcomeOccurrenceCount", "failureCauseObservations", "marker"])) return false;
  const byClass = value.distinctOutcomeUnitsByClass as Record<string, unknown>;
  return ["eligibleOutcomeOccurrenceCount", "distinctOperationalUnitCount", "uncertainOutcomeOccurrenceCount"].every((name) => Number.isSafeInteger(value[name]) && (value[name] as number) >= 0) && exact(byClass, ["SUCCEEDED", "FAILED", "PARTIAL", "DENIED"]) && ["SUCCEEDED", "FAILED", "PARTIAL", "DENIED"].every((name) => Number.isSafeInteger(byClass[name]) && (byClass[name] as number) >= 0) && Array.isArray(value.failureCauseObservations) && value.failureCauseObservations.length <= 96 && value.failureCauseObservations.every((item) => exact(item, ["class", "subtype", "certainty"]) && FAILURE_CLASSES.includes(item.class as FailureClassV1) && CKS_FAILURE_SUBTYPES_V1[item.class as FailureClassV1].includes(item.subtype as string) && FAILURE_CERTAINTIES.includes(item.certainty as FailureCertaintyV1)) && (value.marker === null || value.marker === "+O") && ((value.marker === "+O") === ((value.distinctOperationalUnitCount as number) >= 1));
}
export function validateKnowledgeEvidenceProfileV1(value: unknown): value is KnowledgeEvidenceProfileV1 {
  if (!safeStructure(value) || !exact(value, ["schemaVersion", "semanticRuleId", "scopeRef", "knowledgeRef", "dimensions", "profileDigest"])) return false;
  const profile = value as Record<string, unknown>;
  if (profile.schemaVersion !== CKS_KNOWLEDGE_EVIDENCE_PROFILE_SCHEMA_V1 || profile.semanticRuleId !== CKS_KNOWLEDGE_LINEAGE_SEMANTIC_RULE_V1 || !scopeRef(profile.scopeRef) || !knowledgeRef(profile.knowledgeRef) || !validProfileDimension(profile.dimensions) || !digest(profile.profileDigest)) return false;
  const dimensions = profile.dimensions as Record<string, any>, reference = profile.knowledgeRef as KnowledgeRefV1;
  return dimensions.source.knowledgeDigest === reference.knowledgeDigest && dimensions.freshness.knowledgeDigest === reference.knowledgeDigest && dimensions.contradiction.knowledgeDigest === reference.knowledgeDigest && knowledgeEvidenceProfileDigestV1(profile) === profile.profileDigest;
}

export interface ReconstructedKnowledgeUsageV1 {
  readonly schemaVersion: "chimpmaera.knowledge/usage-lineage-reconstruction/v1";
  readonly status: "RECONSTRUCTED";
  readonly scopeRef: ScopeRefV1;
  readonly taskRef: TaskRefV1;
  readonly searched: readonly KnowledgeRefV1[];
  readonly inspected: readonly KnowledgeRefV1[];
  readonly used: readonly KnowledgeRefV1[];
  readonly rejected: readonly { readonly knowledgeRef: KnowledgeRefV1; readonly reasonCode: string }[];
  readonly decisionSupporting: readonly KnowledgeRefV1[];
  readonly outcomeContributing: readonly KnowledgeRefV1[];
  readonly decisionRef: DecisionRefV1;
  readonly outcomeRef: OutcomeRefV1;
  readonly reconstructionDigest: string;
}
export interface DeniedKnowledgeUsageV1 { readonly schemaVersion: "chimpmaera.knowledge/usage-lineage-reconstruction/v1"; readonly status: "DENIED"; readonly reasonCodes: readonly CksReasonCodeV1[] }
export type KnowledgeUsageReconstructionResultV1 = ReconstructedKnowledgeUsageV1 | DeniedKnowledgeUsageV1;
const refSignature = (v: KnowledgeRefV1): string => `${v.knowledgeId}|${v.knowledgeDigest}`;
function sameRef(a: KnowledgeRefV1, b: KnowledgeRefV1): boolean { return a.knowledgeId === b.knowledgeId && a.knowledgeDigest === b.knowledgeDigest; }
function includesRef(list: readonly KnowledgeRefV1[], wanted: KnowledgeRefV1): boolean { return list.some((item) => sameRef(item, wanted)); }
function denied(reasonCodes: CksReasonCodeV1[]): DeniedKnowledgeUsageV1 { return { schemaVersion: "chimpmaera.knowledge/usage-lineage-reconstruction/v1", status: "DENIED", reasonCodes: [...new Set(reasonCodes)].sort() as CksReasonCodeV1[] }; }
export function reconstructKnowledgeUsageV1(input: readonly unknown[]): KnowledgeUsageReconstructionResultV1 {
  if (!Array.isArray(input) || input.length === 0 || input.length > CKS_MAX_EVENTS_PER_SCOPE_V1 || !input.every(validEventShape)) return denied(["SCHEMA_DENIED"]);
  const events = [...input].sort((a, b) => a.scopeSequence - b.scopeSequence);
  const first = events[0]!;
  const seenIds = new Map<string, string>(), seenDigests = new Set<string>(), seenFacts = new Set<string>();
  let watermark = 0, previous: KnowledgeUsageEventV1 | null = null;
  for (let index = 0; index < events.length; index += 1) {
    const event = events[index]!;
    if (event.scopeSequence !== index || (index === 0 ? event.previousEventDigest !== null : event.previousEventDigest !== previous!.eventDigest)) return denied([index === 0 ? "SEQUENCE_GAP_DENIED" : "PREVIOUS_DIGEST_MISMATCH_DENIED"]);
    if (event.scopeRef.scopeId !== first.scopeRef.scopeId || event.scopeRef.scopeDigest !== first.scopeRef.scopeDigest || event.taskRef.taskId !== first.taskRef.taskId || event.taskRef.taskDigest !== first.taskRef.taskDigest) return denied(["SCOPE_MISMATCH_DENIED"]);
    if ((seenIds.has(event.eventId) && seenIds.get(event.eventId) !== event.eventDigest)) return denied(["TAMPERED_LINEAGE_DENIED"]);
    if (seenIds.has(event.eventId) || seenDigests.has(event.eventDigest) || seenFacts.has(event.factDigest)) return denied(["REPLAY_DENIED"]);
    if (event.receivedAtMs < (previous?.receivedAtMs ?? 0) || event.receivedAtMs - event.occurredAtMs > CKS_LATE_WINDOW_MS_V1 || watermark - event.occurredAtMs > CKS_LATE_WINDOW_MS_V1) return denied(["LATE_EVENT_DENIED"]);
    seenIds.set(event.eventId, event.eventDigest); seenDigests.add(event.eventDigest); seenFacts.add(event.factDigest); watermark = Math.max(watermark, event.occurredAtMs); previous = event;
  }
  const opened = events.filter((event) => event.eventType === "TASK_OPENED");
  if (opened.length !== 1 || events[0]!.eventType !== "TASK_OPENED") return denied(["INCOMPLETE_LINEAGE_DENIED"]);
  if (events.length > CKS_MAX_EVENTS_PER_TASK_V1) return denied(["CAPACITY_DENIED"]);
  const searches = new Map<string, UsageLineageSearchV1>(), inspected: KnowledgeRefV1[] = [], dispositions = new Map<string, { ref: KnowledgeRefV1; disposition: KnowledgeDispositionV1; reasonCode: string }>();
  let decision: DecisionKnowledgeBindingV1 | null = null, outcome: TaskOutcomeEvidenceV1 | null = null, decisionSequence = Infinity, outcomeSequence = Infinity;
  const task = (opened[0]!.fact as { task: UsageLineageTaskV1 }).task;
  for (const [index, event] of events.entries()) {
    if (event.eventType === "SEARCH_RECORDED") {
      if (decision || outcome) return denied(["TASK_FROZEN_DENIED"]);
      const search = (event.fact as { search: UsageLineageSearchV1 }).search;
      if (searches.size >= CKS_MAX_SEARCHES_PER_TASK_V1) return denied(["CAPACITY_DENIED"]);
      if (searches.has(search.searchId)) return denied(["REPLAY_DENIED"]);
      searches.set(search.searchId, search);
    } else if (event.eventType === "KNOWLEDGE_INSPECTED") {
      if (decision || outcome) return denied(["TASK_FROZEN_DENIED"]);
      const fact = event.fact as { scopeRef: ScopeRefV1; taskRef: TaskRefV1; searchRef: SearchRefV1; knowledgeRef: KnowledgeRefV1 };
      const search = searches.get(fact.searchRef.searchId);
      if (!search || search.searchDigest !== fact.searchRef.searchDigest || !includesRef(search.resultKnowledgeRefs, fact.knowledgeRef) || includesRef(inspected, fact.knowledgeRef)) return denied([search ? "TRANSITION_DENIED" : "PARENT_MISSING_DENIED"]);
      inspected.push(fact.knowledgeRef);
    } else if (event.eventType === "KNOWLEDGE_DISPOSITIONED") {
      if (decision || outcome) return denied(["TASK_FROZEN_DENIED"]);
      const fact = event.fact as { scopeRef: ScopeRefV1; taskRef: TaskRefV1; knowledgeRef: KnowledgeRefV1; disposition: KnowledgeDispositionV1; reasonCode: string };
      if (!includesRef(inspected, fact.knowledgeRef) || dispositions.has(refSignature(fact.knowledgeRef))) return denied([dispositions.has(refSignature(fact.knowledgeRef)) ? "TRANSITION_DENIED" : "PARENT_MISSING_DENIED"]);
      dispositions.set(refSignature(fact.knowledgeRef), { ref: fact.knowledgeRef, disposition: fact.disposition, reasonCode: fact.reasonCode });
    } else if (event.eventType === "DECISION_RECORDED") {
      if (decision || outcome) return denied(["TRANSITION_DENIED"]);
      decision = (event.fact as { decision: DecisionKnowledgeBindingV1 }).decision; decisionSequence = index;
      if (!decision.supportingKnowledgeRefs.every((ref) => dispositions.get(refSignature(ref))?.disposition === "USED")) return denied(["TRANSITION_DENIED"]);
    } else if (event.eventType === "OUTCOME_RECORDED") {
      if (!decision || outcome) return denied([decision ? "TRANSITION_DENIED" : "PARENT_MISSING_DENIED"]);
      outcome = (event.fact as { outcome: TaskOutcomeEvidenceV1 }).outcome; outcomeSequence = index;
      if (outcome.decisionRef.decisionId !== decision.decisionId || outcome.decisionRef.decisionDigest !== decision.decisionDigest || !outcome.contributingKnowledgeRefs.every((ref) => decision!.supportingKnowledgeRefs.some((candidate) => sameRef(candidate, ref)))) return denied(["TRANSITION_DENIED"]);
      if (!validateFailureEvidence(outcome, outcome.contributingKnowledgeRefs)) return denied(["FAILURE_ATTRIBUTION_DENIED"]);
    }
    if (event.eventType === "TASK_OPENED" && index !== 0) return denied(["TRANSITION_DENIED"]);
  }
  if (!decision || !outcome || decisionSequence >= outcomeSequence) return denied(["INCOMPLETE_LINEAGE_DENIED"]);
  const eventByRef = new Map(events.map((event) => [event.eventId, event]));
  for (const cause of outcome.failureAttribution.causes) {
    if (cause.class === "KNOWLEDGE" && cause.subtype !== "MISSING" && cause.affectedKnowledgeRefs.length === 0) return denied(["FAILURE_ATTRIBUTION_DENIED"]);
    for (const causeRef of cause.causeEventRefs) {
      const causeEvent = eventByRef.get(causeRef.eventId);
      if (!causeEvent || causeEvent.eventDigest !== causeRef.eventDigest || causeEvent.scopeRef.scopeId !== first.scopeRef.scopeId || causeEvent.taskRef.taskId !== first.taskRef.taskId || causeEvent.scopeSequence >= outcomeSequence) return denied(["FAILURE_ATTRIBUTION_DENIED"]);
      if (cause.class === "DECISION" && causeEvent.eventType !== "DECISION_RECORDED") return denied(["FAILURE_ATTRIBUTION_DENIED"]);
      if (cause.class === "SEARCH" && !["SEARCH_RECORDED", "KNOWLEDGE_INSPECTED", "KNOWLEDGE_DISPOSITIONED"].includes(causeEvent.eventType)) return denied(["FAILURE_ATTRIBUTION_DENIED"]);
      if (cause.class === "KNOWLEDGE" && cause.subtype !== "MISSING" && causeEvent.eventType !== "KNOWLEDGE_DISPOSITIONED") return denied(["FAILURE_ATTRIBUTION_DENIED"]);
    }
  }
  const searched = [...new Map([...searches.values()].flatMap((search) => search.resultKnowledgeRefs.map((ref) => [refSignature(ref), ref] as const))).values()].sort(refSort);
  const sortedInspected = [...inspected].sort(refSort), used = [...dispositions.values()].filter((item) => item.disposition === "USED").map((item) => item.ref).sort(refSort);
  const rejected = [...dispositions.values()].filter((item) => item.disposition === "REJECTED").map((item) => ({ knowledgeRef: item.ref, reasonCode: item.reasonCode })).sort((a, b) => refSort(a.knowledgeRef, b.knowledgeRef));
  const unsigned = { schemaVersion: "chimpmaera.knowledge/usage-lineage-reconstruction/v1", status: "RECONSTRUCTED", scopeRef: first.scopeRef, taskRef: first.taskRef, searched, inspected: sortedInspected, used, rejected, decisionSupporting: decision.supportingKnowledgeRefs, outcomeContributing: outcome.contributingKnowledgeRefs, decisionRef: { decisionId: decision.decisionId, decisionDigest: decision.decisionDigest }, outcomeRef: { outcomeId: outcome.outcomeId, outcomeDigest: outcome.outcomeDigest } } as const;
  return { ...unsigned, reconstructionDigest: sha(unsigned) };
}
function validateFailureEvidence(outcome: TaskOutcomeEvidenceV1, contributors: readonly KnowledgeRefV1[]): boolean {
  for (const cause of outcome.failureAttribution.causes) {
    if (cause.class === "KNOWLEDGE" && cause.subtype !== "MISSING" && !cause.affectedKnowledgeRefs.every((ref) => contributors.some((candidate) => sameRef(candidate, ref)))) return false;
    if (cause.class === "UNKNOWN" && cause.affectedKnowledgeRefs.length !== 0) return false;
  }
  return true;
}

export function verifyDecisionKnowledgeBindingV1(value: unknown): CksVerificationV1 { return validateDecisionKnowledgeBindingV1(value) ? { outcome: "ACCEPTED", reasonCodes: ["CONTRACT_VERIFIED"] } : { outcome: "DENIED", reasonCodes: ["DIGEST_MISMATCH_DENIED"] }; }
export function verifyTaskOutcomeEvidenceV1(value: unknown): CksVerificationV1 { return validateTaskOutcomeEvidenceV1(value) ? { outcome: "ACCEPTED", reasonCodes: ["CONTRACT_VERIFIED"] } : { outcome: "DENIED", reasonCodes: ["DIGEST_MISMATCH_DENIED"] }; }
export function verifyFailureAttributionV1(value: unknown): CksVerificationV1 { return validateFailureAttributionV1(value) ? { outcome: "ACCEPTED", reasonCodes: ["CONTRACT_VERIFIED"] } : { outcome: "DENIED", reasonCodes: ["FAILURE_ATTRIBUTION_DENIED"] }; }
export function verifyKnowledgeEvidenceProfileV1(value: unknown): CksVerificationV1 { return validateKnowledgeEvidenceProfileV1(value) ? { outcome: "ACCEPTED", reasonCodes: ["CONTRACT_VERIFIED"] } : { outcome: "DENIED", reasonCodes: ["DIGEST_MISMATCH_DENIED"] }; }
