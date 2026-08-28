/**
 * P16 deterministic seeded-failure attribution evaluator.
 *
 * The evaluator consumes one complete CKS-08 usage lineage, an explicit
 * bounded witness for each declared cause, and the independently retained
 * Knowledge evidence profiles. It never derives a cause from outcome
 * contribution alone. Unknown and unresolved alternatives remain explicit.
 */
import {
  CKS_FAILURE_ATTRIBUTION_SCHEMA_V1,
  CKS_FAILURE_SUBTYPES_V1,
  CKS_KNOWLEDGE_LINEAGE_SEMANTIC_RULE_V1,
  cksDigestV1,
  failureAttributionDigestV1,
  validateFailureAttributionV1,
  validateKnowledgeEvidenceProfileV1,
  type CksReasonCodeV1,
  type FailureAttributionV1,
  type FailureCauseV1,
  type FailureClassV1,
  type KnowledgeEvidenceProfileV1,
  type KnowledgeRefV1,
  type OutcomeRefV1,
  type ScopeRefV1,
  type TaskRefV1,
} from "./cks-knowledge-lineage.js";
import {
  reconstructCksLineageUsageV1,
  type ReconstructedKnowledgeUsageV1,
} from "./cks-lineage-reconstructor.js";

export const CKS_FAILURE_ATTRIBUTION_EVALUATOR_SCHEMA_V1 = "chimpmaera.knowledge/failure-attribution-evaluator/v1" as const;
export const CKS_FAILURE_ATTRIBUTION_EVALUATOR_ACCEPTED_REASON_CODE_V1: CksReasonCodeV1 = "CONTRACT_VERIFIED";

export type CksKnowledgeEvidenceDimensionV1 = "SOURCE" | "APPLICABILITY" | "FRESHNESS" | "CONTRADICTION" | "GENERALIZATION" | "NONE";
export type CksFailureWitnessKindV1 =
  | "KNOWLEDGE_PROFILE"
  | "SEARCH_ORACLE"
  | "DECISION_CHECK"
  | "EXECUTION_RECEIPT"
  | "TASK_INPUT_RECEIPT"
  | "EXTERNAL_RECEIPT"
  | "GOVERNANCE_RECEIPT"
  | "UNKNOWN";

export type CksFailureCauseWitnessV1 =
  | { readonly kind: "KNOWLEDGE_PROFILE"; readonly dimension: Exclude<CksKnowledgeEvidenceDimensionV1, "NONE"> }
  | { readonly kind: "SEARCH_ORACLE"; readonly dimension: "NONE" }
  | { readonly kind: "DECISION_CHECK"; readonly dimension: "NONE"; readonly predicate: "UNSUPPORTED_SELECTION" | "SUPPORTED_OPTION_IGNORED" }
  | { readonly kind: "EXECUTION_RECEIPT"; readonly dimension: "NONE" }
  | { readonly kind: "TASK_INPUT_RECEIPT"; readonly dimension: "NONE" }
  | { readonly kind: "EXTERNAL_RECEIPT"; readonly dimension: "NONE" }
  | { readonly kind: "GOVERNANCE_RECEIPT"; readonly dimension: "NONE" }
  | { readonly kind: "UNKNOWN"; readonly dimension: "NONE" };

export interface CksFailureCauseEvidenceV1 {
  readonly cause: FailureCauseV1;
  readonly witness: CksFailureCauseWitnessV1;
}

export interface CksFailureAttributionEvaluatorInputV1 {
  readonly schemaVersion: typeof CKS_FAILURE_ATTRIBUTION_EVALUATOR_SCHEMA_V1;
  readonly semanticRuleId: typeof CKS_KNOWLEDGE_LINEAGE_SEMANTIC_RULE_V1;
  readonly scopeRef: ScopeRefV1;
  readonly taskRef: TaskRefV1;
  readonly events: readonly unknown[];
  readonly evidence: readonly CksFailureCauseEvidenceV1[];
  readonly profiles: readonly KnowledgeEvidenceProfileV1[];
}

export interface CksFailureAttributionEvaluationV1 {
  readonly schemaVersion: typeof CKS_FAILURE_ATTRIBUTION_EVALUATOR_SCHEMA_V1;
  readonly semanticRuleId: typeof CKS_KNOWLEDGE_LINEAGE_SEMANTIC_RULE_V1;
  readonly status: "EVALUATED";
  readonly scopeRef: ScopeRefV1;
  readonly taskRef: TaskRefV1;
  readonly outcomeRef: OutcomeRefV1;
  readonly outcomeClass: "SUCCEEDED" | "FAILED" | "PARTIAL" | "DENIED" | "UNKNOWN";
  readonly causalMode: FailureAttributionV1["causalMode"];
  readonly causes: readonly FailureCauseV1[];
  readonly evidence: readonly CksFailureCauseEvidenceV1[];
  /** All six dimensions remain nested and independently digest-bound. */
  readonly evidenceProfiles: readonly KnowledgeEvidenceProfileV1[];
  readonly evaluationDigest: string;
}

export interface DeniedCksFailureAttributionEvaluationV1 {
  readonly schemaVersion: typeof CKS_FAILURE_ATTRIBUTION_EVALUATOR_SCHEMA_V1;
  readonly status: "DENIED";
  readonly reasonCodes: readonly CksReasonCodeV1[];
}

export type CksFailureAttributionEvaluationResultV1 = CksFailureAttributionEvaluationV1 | DeniedCksFailureAttributionEvaluationV1;

const HEX = /^[a-f0-9]{64}$/;
const FAILURE_CLASSES: readonly FailureClassV1[] = ["KNOWLEDGE", "SEARCH", "DECISION", "EXECUTION", "TASK_INPUT", "EXTERNAL", "GOVERNANCE", "UNKNOWN"];
const WITNESS_KINDS: readonly CksFailureWitnessKindV1[] = ["KNOWLEDGE_PROFILE", "SEARCH_ORACLE", "DECISION_CHECK", "EXECUTION_RECEIPT", "TASK_INPUT_RECEIPT", "EXTERNAL_RECEIPT", "GOVERNANCE_RECEIPT", "UNKNOWN"];
const DIMENSIONS: readonly CksKnowledgeEvidenceDimensionV1[] = ["SOURCE", "APPLICABILITY", "FRESHNESS", "CONTRADICTION", "GENERALIZATION", "NONE"];
const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value) && Object.getPrototypeOf(value) === Object.prototype;
const exactKeys = (value: Record<string, unknown>, keys: readonly string[]): boolean => JSON.stringify(Object.keys(value).sort()) === JSON.stringify([...keys].sort());
const isScopeRef = (value: unknown): value is ScopeRefV1 => isRecord(value) && exactKeys(value, ["scopeId", "scopeDigest"]) && typeof value.scopeId === "string" && /^scope:v1:[a-f0-9]{64}$/.test(value.scopeId) && typeof value.scopeDigest === "string" && HEX.test(value.scopeDigest);
const isTaskRef = (value: unknown): value is TaskRefV1 => isRecord(value) && exactKeys(value, ["taskId", "taskDigest"]) && typeof value.taskId === "string" && /^task:v1:[a-f0-9]{64}$/.test(value.taskId) && typeof value.taskDigest === "string" && HEX.test(value.taskDigest);
const sameScope = (a: ScopeRefV1, b: ScopeRefV1): boolean => a.scopeId === b.scopeId && a.scopeDigest === b.scopeDigest;
const sameTask = (a: TaskRefV1, b: TaskRefV1): boolean => a.taskId === b.taskId && a.taskDigest === b.taskDigest;
const refKey = (value: KnowledgeRefV1): string => `${value.knowledgeId}|${value.knowledgeDigest}`;
const causeKey = (value: FailureCauseV1): string => `${value.class}|${value.subtype}`;
const sortedUnique = (values: readonly string[]): boolean => values.every((value, index) => index === 0 || values[index - 1]! < value) && new Set(values).size === values.length;
const sameKnowledge = (a: KnowledgeRefV1, b: KnowledgeRefV1): boolean => refKey(a) === refKey(b);
const containsKnowledge = (values: readonly KnowledgeRefV1[], wanted: KnowledgeRefV1): boolean => values.some((value) => sameKnowledge(value, wanted));
const denied = (reason: CksReasonCodeV1 = "FAILURE_ATTRIBUTION_DENIED"): DeniedCksFailureAttributionEvaluationV1 => ({
  schemaVersion: CKS_FAILURE_ATTRIBUTION_EVALUATOR_SCHEMA_V1,
  status: "DENIED",
  reasonCodes: [reason],
});

function validWitness(value: unknown): value is CksFailureCauseWitnessV1 {
  if (!isRecord(value) || !WITNESS_KINDS.includes(value.kind as CksFailureWitnessKindV1) || !DIMENSIONS.includes(value.dimension as CksKnowledgeEvidenceDimensionV1)) return false;
  if (value.kind === "DECISION_CHECK") return exactKeys(value, ["kind", "dimension", "predicate"]) && value.dimension === "NONE" && (value.predicate === "UNSUPPORTED_SELECTION" || value.predicate === "SUPPORTED_OPTION_IGNORED");
  if (!exactKeys(value, ["kind", "dimension"])) return false;
  if (value.kind === "KNOWLEDGE_PROFILE") return value.dimension !== "NONE";
  return value.dimension === "NONE";
}

function validCause(value: unknown): value is FailureCauseV1 {
  if (!isRecord(value) || !exactKeys(value, ["class", "subtype", "certainty", "causeEventRefs", "affectedKnowledgeRefs"])) return false;
  if (!FAILURE_CLASSES.includes(value.class as FailureClassV1) || !CKS_FAILURE_SUBTYPES_V1[value.class as FailureClassV1]?.includes(value.subtype as string) || !["CONFIRMED", "SUPPORTED", "POSSIBLE", "UNKNOWN"].includes(value.certainty as string)) return false;
  const eventRefs = value.causeEventRefs;
  const knowledgeRefs = value.affectedKnowledgeRefs;
  if (!Array.isArray(eventRefs) || eventRefs.length > 3 || !eventRefs.every((item) => isRecord(item) && exactKeys(item, ["eventId", "eventDigest"]) && typeof item.eventId === "string" && /^lineage-event:v1:[a-f0-9]{64}$/.test(item.eventId) && typeof item.eventDigest === "string" && HEX.test(item.eventDigest))) return false;
  if (!Array.isArray(knowledgeRefs) || knowledgeRefs.length > 32 || !knowledgeRefs.every((item) => isRecord(item) && exactKeys(item, ["knowledgeId", "knowledgeDigest"]) && typeof item.knowledgeId === "string" && /^[a-z][a-z0-9-]{1,31}:[a-z0-9][a-z0-9._-]{2,95}$/.test(item.knowledgeId) && typeof item.knowledgeDigest === "string" && HEX.test(item.knowledgeDigest))) return false;
  const eventKeys = eventRefs.map((item) => `${item.eventId}|${item.eventDigest}`);
  const knowledgeKeys = knowledgeRefs.map((item) => `${item.knowledgeId}|${item.knowledgeDigest}`);
  if (!sortedUnique(eventKeys) || !sortedUnique(knowledgeKeys)) return false;
  return value.class === "UNKNOWN"
    ? knowledgeRefs.length === 0 && value.certainty === "UNKNOWN" && eventRefs.length === 0
    : eventRefs.length > 0;
}

function validEvidence(value: unknown): value is CksFailureCauseEvidenceV1 {
  return isRecord(value) && exactKeys(value, ["cause", "witness"]) && validCause(value.cause) && validWitness(value.witness);
}

function validInputShape(value: unknown): value is CksFailureAttributionEvaluatorInputV1 {
  return isRecord(value)
    && exactKeys(value, ["schemaVersion", "semanticRuleId", "scopeRef", "taskRef", "events", "evidence", "profiles"])
    && value.schemaVersion === CKS_FAILURE_ATTRIBUTION_EVALUATOR_SCHEMA_V1
    && value.semanticRuleId === CKS_KNOWLEDGE_LINEAGE_SEMANTIC_RULE_V1
    && isScopeRef(value.scopeRef)
    && isTaskRef(value.taskRef)
    && Array.isArray(value.events)
    && Array.isArray(value.evidence)
    && value.evidence.length <= 3
    && value.evidence.every(validEvidence)
    && Array.isArray(value.profiles)
    && value.profiles.length <= 32
    && value.profiles.every(validateKnowledgeEvidenceProfileV1);
}

function outcomeFromEvents(events: readonly Record<string, unknown>[]): Record<string, unknown> | null {
  const outcomeEvent = events.find((event) => event.eventType === "OUTCOME_RECORDED");
  const fact = outcomeEvent?.fact;
  if (!isRecord(fact) || !isRecord(fact.outcome)) return null;
  return fact.outcome;
}

function referencesBoundBeforeOutcome(
  cause: FailureCauseV1,
  eventsById: ReadonlyMap<string, Record<string, unknown>>,
  outcomeSequence: number,
  scopeRef: ScopeRefV1,
  taskRef: TaskRefV1,
): boolean {
  return cause.causeEventRefs.every((reference) => {
    const event = eventsById.get(reference.eventId);
    if (!event || event.eventDigest !== reference.eventDigest || !isScopeRef(event.scopeRef) || !isTaskRef(event.taskRef)) return false;
    return sameScope(event.scopeRef, scopeRef) && sameTask(event.taskRef, taskRef) && typeof event.scopeSequence === "number" && event.scopeSequence < outcomeSequence;
  });
}

function profileMap(profiles: readonly KnowledgeEvidenceProfileV1[]): Map<string, KnowledgeEvidenceProfileV1> {
  return new Map(profiles.map((profile) => [refKey(profile.knowledgeRef), profile]));
}

function knowledgeWitnessIsDirect(
  cause: FailureCauseV1,
  dimension: Exclude<CksKnowledgeEvidenceDimensionV1, "NONE">,
  profiles: ReadonlyMap<string, KnowledgeEvidenceProfileV1>,
): boolean {
  if (cause.subtype === "MISSING") return cause.affectedKnowledgeRefs.length > 0 && dimension === "GENERALIZATION";
  if (cause.affectedKnowledgeRefs.length === 0) return false;
  return cause.affectedKnowledgeRefs.every((ref) => {
    const profile = profiles.get(refKey(ref));
    if (!profile) return false;
    const dimensions = profile.dimensions;
    if (cause.subtype === "SOURCE_DEFECT") return dimension === "SOURCE" && (dimensions.source.epistemicStatus === "DISPUTED" || dimensions.source.epistemicStatus === "UNRESOLVED" || dimensions.source.trust === "LOW");
    if (cause.subtype === "APPLICABILITY_MISMATCH") return dimension === "APPLICABILITY" && (dimensions.applicability.matchState === "NO_MATCH" || dimensions.applicability.matchState === "CONFLICT");
    if (cause.subtype === "STALE") return dimension === "FRESHNESS" && dimensions.freshness.freshnessState === "STALE";
    if (cause.subtype === "CONTRADICTED") return dimension === "CONTRADICTION" && dimensions.contradiction.contradictionState === "DECLARED_UNRESOLVED";
    if (cause.subtype === "UNSUPPORTED_GENERALIZATION") return dimension === "GENERALIZATION" && dimensions.generalization.validTaskOccurrenceCount > 0 && (dimensions.generalization.distinctTaskSemanticCount < 2 || dimensions.generalization.distinctContextCount < 2);
    return false;
  });
}

function witnessSupportsCause(
  cause: FailureCauseV1,
  witness: CksFailureCauseWitnessV1,
  usage: ReconstructedKnowledgeUsageV1,
  decisionClass: string,
  decisionRef: { decisionId: string; decisionDigest: string },
  eventsById: ReadonlyMap<string, Record<string, unknown>>,
  outcomeSequence: number,
  scopeRef: ScopeRefV1,
  taskRef: TaskRefV1,
  profiles: ReadonlyMap<string, KnowledgeEvidenceProfileV1>,
): boolean {
  if (!referencesBoundBeforeOutcome(cause, eventsById, outcomeSequence, scopeRef, taskRef)) return false;
  const eventTypes = cause.causeEventRefs.map((reference) => eventsById.get(reference.eventId)?.eventType);
  if (cause.class === "UNKNOWN") return witness.kind === "UNKNOWN" && cause.causeEventRefs.length === 0 && cause.affectedKnowledgeRefs.length === 0 && cause.certainty === "UNKNOWN";
  if (cause.class === "KNOWLEDGE") {
    if (witness.kind !== "KNOWLEDGE_PROFILE" || !knowledgeWitnessIsDirect(cause, witness.dimension, profiles)) return false;
    if (cause.subtype !== "MISSING" && !cause.affectedKnowledgeRefs.every((ref) => containsKnowledge(usage.outcomeContributing, ref))) return false;
    return eventTypes.every((type) => type === "KNOWLEDGE_DISPOSITIONED");
  }
  if (cause.class === "SEARCH") {
    if (witness.kind !== "SEARCH_ORACLE" || cause.affectedKnowledgeRefs.length === 0) return false;
    if (cause.subtype === "RELEVANT_NOT_RETURNED") return cause.affectedKnowledgeRefs.every((ref) => !containsKnowledge(usage.searched, ref));
    if (cause.subtype === "RELEVANT_NOT_INSPECTED") return cause.affectedKnowledgeRefs.every((ref) => containsKnowledge(usage.searched, ref) && !containsKnowledge(usage.inspected, ref));
    return cause.subtype === "RELEVANT_REJECTED" && cause.affectedKnowledgeRefs.every((ref) => usage.rejected.some((item) => sameKnowledge(item.knowledgeRef, ref)));
  }
  if (cause.class === "DECISION") {
    return witness.kind === "DECISION_CHECK"
      && witness.predicate === cause.subtype
      && cause.causeEventRefs.some((reference) => eventsById.get(reference.eventId)?.eventType === "DECISION_RECORDED")
      && cause.affectedKnowledgeRefs.length === 0
      && decisionRef.decisionId.length > 0
      && decisionClass.length > 0;
  }
  const expectedWitness: Record<Exclude<FailureClassV1, "KNOWLEDGE" | "SEARCH" | "DECISION" | "UNKNOWN">, CksFailureWitnessKindV1> = {
    EXECUTION: "EXECUTION_RECEIPT",
    TASK_INPUT: "TASK_INPUT_RECEIPT",
    EXTERNAL: "EXTERNAL_RECEIPT",
    GOVERNANCE: "GOVERNANCE_RECEIPT",
  };
  return witness.kind === expectedWitness[cause.class as Exclude<FailureClassV1, "KNOWLEDGE" | "SEARCH" | "DECISION" | "UNKNOWN">]
    && cause.affectedKnowledgeRefs.length === 0
    && decisionClass === "SELECTED"
    && decisionRef.decisionId.length > 0
    && cause.causeEventRefs.length > 0;
}

function causesMatch(actual: readonly FailureCauseV1[], evidence: readonly CksFailureCauseEvidenceV1[]): boolean {
  if (actual.length !== evidence.length) return false;
  const actualKeys = actual.map(causeKey);
  const evidenceKeys = evidence.map((item) => causeKey(item.cause));
  return sortedUnique(actualKeys) && sortedUnique(evidenceKeys) && JSON.stringify(actualKeys) === JSON.stringify(evidenceKeys)
    && actual.every((cause, index) => JSON.stringify(cause) === JSON.stringify(evidence[index]!.cause));
}

/** Evaluate one seeded failure; every accepted cause must carry a matching bounded witness. */
export function evaluateCksSeededFailureAttributionV1(input: unknown): CksFailureAttributionEvaluationResultV1 {
  if (!validInputShape(input)) return denied("SCHEMA_DENIED");
  const reconstruction = reconstructCksLineageUsageV1(input.events);
  if (reconstruction.status !== "RECONSTRUCTED") return { ...reconstruction, schemaVersion: CKS_FAILURE_ATTRIBUTION_EVALUATOR_SCHEMA_V1 } as DeniedCksFailureAttributionEvaluationV1;
  if (!sameScope(reconstruction.scopeRef, input.scopeRef) || !sameTask(reconstruction.taskRef, input.taskRef)) return denied("SCOPE_MISMATCH_DENIED");
  const events = input.events.filter(isRecord);
  const outcome = outcomeFromEvents(events);
  if (!outcome || typeof outcome.outcomeClass !== "string" || !validateFailureAttributionV1(outcome.failureAttribution)) return denied("FAILURE_ATTRIBUTION_DENIED");
  const outcomeSequence = events.find((event) => event.eventType === "OUTCOME_RECORDED")?.scopeSequence;
  if (typeof outcomeSequence !== "number" || !isRecord(outcome.decisionRef) || typeof outcome.decisionRef.decisionId !== "string" || typeof outcome.decisionRef.decisionDigest !== "string") return denied("INCOMPLETE_LINEAGE_DENIED");
  const decisionEvent = events.find((event) => event.eventType === "DECISION_RECORDED");
  const decisionFact = decisionEvent?.fact;
  const decision = isRecord(decisionFact) && isRecord(decisionFact.decision) ? decisionFact.decision : null;
  if (!decision || typeof decision.decisionClass !== "string") return denied("INCOMPLETE_LINEAGE_DENIED");
  const profiles = profileMap(input.profiles);
  if (input.profiles.some((profile) => !sameScope(profile.scopeRef, input.scopeRef))) return denied("SCOPE_MISMATCH_DENIED");
  const eventsById = new Map(events.filter((event) => typeof event.eventId === "string").map((event) => [event.eventId as string, event]));
  const attribution = outcome.failureAttribution;
  if (!causesMatch(attribution.causes, input.evidence)) return denied("FAILURE_ATTRIBUTION_DENIED");
  for (const item of input.evidence) {
    if (!witnessSupportsCause(item.cause, item.witness, reconstruction, decision.decisionClass, outcome.decisionRef as { decisionId: string; decisionDigest: string }, eventsById, outcomeSequence, input.scopeRef, input.taskRef, profiles)) return denied("FAILURE_ATTRIBUTION_DENIED");
  }
  const evidenceProfiles = [...input.profiles].sort((a, b) => refKey(a.knowledgeRef).localeCompare(refKey(b.knowledgeRef)));
  const unsigned = {
    schemaVersion: CKS_FAILURE_ATTRIBUTION_EVALUATOR_SCHEMA_V1,
    semanticRuleId: CKS_KNOWLEDGE_LINEAGE_SEMANTIC_RULE_V1,
    status: "EVALUATED" as const,
    scopeRef: input.scopeRef,
    taskRef: input.taskRef,
    outcomeRef: reconstruction.outcomeRef,
    outcomeClass: outcome.outcomeClass as CksFailureAttributionEvaluationV1["outcomeClass"],
    causalMode: attribution.causalMode,
    causes: attribution.causes,
    evidence: input.evidence,
    evidenceProfiles,
  } satisfies Omit<CksFailureAttributionEvaluationV1, "evaluationDigest">;
  const evaluationDigest = cksDigestV1(unsigned, "evaluationDigest");
  return { ...unsigned, evaluationDigest };
}

export const evaluateCksFailureAttributionV1 = evaluateCksSeededFailureAttributionV1;
export const evaluateSeededFailureAttributionV1 = evaluateCksSeededFailureAttributionV1;

/** Validate an evaluator receipt without recomputing any causal conclusion. */
export function validateCksFailureAttributionEvaluationV1(value: unknown): value is CksFailureAttributionEvaluationV1 {
  if (!isRecord(value) || !exactKeys(value, ["schemaVersion", "semanticRuleId", "status", "scopeRef", "taskRef", "outcomeRef", "outcomeClass", "causalMode", "causes", "evidence", "evidenceProfiles", "evaluationDigest"]) || value.schemaVersion !== CKS_FAILURE_ATTRIBUTION_EVALUATOR_SCHEMA_V1 || value.semanticRuleId !== CKS_KNOWLEDGE_LINEAGE_SEMANTIC_RULE_V1 || value.status !== "EVALUATED" || !isScopeRef(value.scopeRef) || !isTaskRef(value.taskRef) || !HEX.test(value.evaluationDigest as string) || !Array.isArray(value.causes) || !Array.isArray(value.evidence) || !Array.isArray(value.evidenceProfiles) || !value.evidence.every(validEvidence) || !value.evidenceProfiles.every(validateKnowledgeEvidenceProfileV1)) return false;
  const causes = value.causes as readonly FailureCauseV1[];
  const evidence = value.evidence as readonly CksFailureCauseEvidenceV1[];
  const causalMode = value.causalMode as FailureAttributionV1["causalMode"];
  const attribution = { schemaVersion: CKS_FAILURE_ATTRIBUTION_SCHEMA_V1, semanticRuleId: CKS_KNOWLEDGE_LINEAGE_SEMANTIC_RULE_V1, causalMode, causes, failureAttributionDigest: failureAttributionDigestV1({ schemaVersion: CKS_FAILURE_ATTRIBUTION_SCHEMA_V1, semanticRuleId: CKS_KNOWLEDGE_LINEAGE_SEMANTIC_RULE_V1, causalMode, causes }) };
  if (!validateFailureAttributionV1(attribution) || !causesMatch(causes, evidence)) return false;
  const { evaluationDigest, ...withoutEvaluationDigest } = value;
  return cksDigestV1(withoutEvaluationDigest, "evaluationDigest") === evaluationDigest;
}

export function verifyCksFailureAttributionEvaluationV1(value: unknown): { readonly outcome: "ACCEPTED" | "DENIED"; readonly reasonCodes: readonly CksReasonCodeV1[] } {
  return validateCksFailureAttributionEvaluationV1(value)
    ? { outcome: "ACCEPTED", reasonCodes: [CKS_FAILURE_ATTRIBUTION_EVALUATOR_ACCEPTED_REASON_CODE_V1] }
    : { outcome: "DENIED", reasonCodes: ["FAILURE_ATTRIBUTION_DENIED"] };
}

export const verifyCksSeededFailureAttributionV1 = verifyCksFailureAttributionEvaluationV1;
