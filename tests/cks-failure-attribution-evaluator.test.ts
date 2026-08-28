import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  CKS_FAILURE_ATTRIBUTION_EVALUATOR_SCHEMA_V1,
  evaluateCksSeededFailureAttributionV1,
  validateCksFailureAttributionEvaluationV1,
  verifyCksFailureAttributionEvaluationV1,
  type CksFailureAttributionEvaluatorInputV1,
  type CksFailureCauseEvidenceV1,
} from "../packages/contracts/src/cks-failure-attribution-evaluator.js";
import {
  CKS_DECISION_KNOWLEDGE_BINDING_SCHEMA_V1,
  CKS_FAILURE_ATTRIBUTION_SCHEMA_V1,
  CKS_KNOWLEDGE_EVIDENCE_PROFILE_SCHEMA_V1,
  CKS_KNOWLEDGE_LINEAGE_SEMANTIC_RULE_V1,
  CKS_KNOWLEDGE_USAGE_EVENT_SCHEMA_V1,
  CKS_TASK_OUTCOME_EVIDENCE_SCHEMA_V1,
  decisionKnowledgeBindingDigestV1,
  failureAttributionDigestV1,
  knowledgeEvidenceProfileDigestV1,
  knowledgeUsageEventDigestV1,
  knowledgeUsageFactDigestV1,
  taskOutcomeEvidenceDigestV1,
  usageLineageSearchDigestV1,
  usageLineageTaskDigestV1,
  type FailureClassV1,
} from "../packages/contracts/src/cks-knowledge-lineage.js";

type FixtureCase = {
  name: string;
  outcomeClass: "FAILED" | "PARTIAL" | "UNKNOWN";
  causalMode: "SINGLE" | "MULTI_CONTRIBUTING" | "ALTERNATIVES_UNRESOLVED" | "UNKNOWN";
  cause?: { class: FailureClassV1; subtype: string; certainty: "CONFIRMED" | "SUPPORTED" | "POSSIBLE" | "UNKNOWN"; witness: CksFailureCauseEvidenceV1["witness"] };
  causes?: Array<{ class: FailureClassV1; subtype: string; certainty: "CONFIRMED" | "SUPPORTED" | "POSSIBLE" | "UNKNOWN"; witness: CksFailureCauseEvidenceV1["witness"] }>;
};
const fixture = (): { cases: FixtureCase[] } => JSON.parse(readFileSync("tests/fixtures/cks-08/failure-attribution-cases-v1.json", "utf8"));
const hex = (value: string): string => value.repeat(64);
const scopeRef = { scopeId: `scope:v1:${hex("a")}`, scopeDigest: hex("a") } as const;
const knowledgeRef = { knowledgeId: "fixture:alpha", knowledgeDigest: hex("d") } as const;
const missingKnowledgeRef = { knowledgeId: "fixture:beta", knowledgeDigest: hex("b") } as const;

function makeProfile(stale = false): import("../packages/contracts/src/cks-knowledge-lineage.js").KnowledgeEvidenceProfileV1 {
  const profile = {
    schemaVersion: CKS_KNOWLEDGE_EVIDENCE_PROFILE_SCHEMA_V1,
    semanticRuleId: CKS_KNOWLEDGE_LINEAGE_SEMANTIC_RULE_V1,
    scopeRef,
    knowledgeRef,
    dimensions: {
      source: { knowledgeDigest: knowledgeRef.knowledgeDigest, attributionSetDigest: hex("1"), epistemicStatus: "VERIFIED", trust: "HIGH" },
      applicability: { applicabilityScopeDigest: hex("2"), contextFingerprintDigest: hex("4"), matchState: "MATCH" },
      freshness: { knowledgeDigest: knowledgeRef.knowledgeDigest, evaluatedAtMs: 1000, freshnessState: stale ? "STALE" : "FRESH" },
      contradiction: { knowledgeDigest: knowledgeRef.knowledgeDigest, conflictSetDigest: hex("3"), contradictionState: "NONE_DECLARED" },
      generalization: { validTaskOccurrenceCount: 1, distinctTaskSemanticCount: 1, distinctContextCount: 1, distinctJointUsageUnitCount: 1, identicalRepetitionCount: 0, marker: null },
      operational: { eligibleOutcomeOccurrenceCount: 1, distinctOperationalUnitCount: 1, distinctOutcomeUnitsByClass: { SUCCEEDED: 0, FAILED: 1, PARTIAL: 0, DENIED: 0 }, uncertainOutcomeOccurrenceCount: 0, failureCauseObservations: [], marker: "+O" },
    },
    profileDigest: "",
  } as Record<string, unknown>;
  profile.profileDigest = knowledgeEvidenceProfileDigestV1(profile);
  return profile as unknown as import("../packages/contracts/src/cks-knowledge-lineage.js").KnowledgeEvidenceProfileV1;
}

function makeLineage(item: FixtureCase): { events: unknown[]; input: CksFailureAttributionEvaluatorInputV1 } {
  const task = {
    schemaVersion: "chimpmaera.knowledge/usage-lineage-task/v1",
    semanticRuleId: CKS_KNOWLEDGE_LINEAGE_SEMANTIC_RULE_V1,
    scopeRef,
    taskId: `task:v1:${hex("c")}`,
    taskKind: "ACT",
    objectiveDigest: hex("1"),
    applicabilityContextDigest: hex("4"),
    taskSemanticDigest: hex("c"),
    contextFingerprintDigest: hex("4"),
  } as Record<string, unknown>;
  task.taskDigest = usageLineageTaskDigestV1(task);
  const taskRef = { taskId: task.taskId as string, taskDigest: task.taskDigest as string };
  const search = {
    schemaVersion: "chimpmaera.knowledge/usage-lineage-search/v1",
    semanticRuleId: CKS_KNOWLEDGE_LINEAGE_SEMANTIC_RULE_V1,
    scopeRef,
    taskRef,
    searchId: `search:v1:${hex("9")}`,
    searchIntentDigest: hex("5"),
    resultKnowledgeRefs: item.name === "search-relevant-not-returned" ? [knowledgeRef] : [knowledgeRef, missingKnowledgeRef],
  } as Record<string, unknown>;
  search.searchDigest = usageLineageSearchDigestV1(search);
  const searchRef = { searchId: search.searchId, searchDigest: search.searchDigest as string };
  const decision = {
    schemaVersion: CKS_DECISION_KNOWLEDGE_BINDING_SCHEMA_V1,
    semanticRuleId: CKS_KNOWLEDGE_LINEAGE_SEMANTIC_RULE_V1,
    scopeRef,
    taskRef,
    decisionId: `decision:v1:${hex("e")}`,
    decisionClass: "SELECTED",
    supportingKnowledgeRefs: [knowledgeRef],
  } as Record<string, unknown>;
  decision.decisionDigest = decisionKnowledgeBindingDigestV1(decision);
  const selectedCauseSpecs = item.causes ?? (item.cause ? [item.cause] : []);
  const events: Array<Record<string, unknown>> = [];
  let previousEventDigest: string | null = null;
  const event = (sequence: number, eventType: string, fact: unknown): Record<string, unknown> => {
    const value = {
      schemaVersion: CKS_KNOWLEDGE_USAGE_EVENT_SCHEMA_V1,
      semanticRuleId: CKS_KNOWLEDGE_LINEAGE_SEMANTIC_RULE_V1,
      eventId: `lineage-event:v1:${(sequence + 1).toString(16).padStart(64, "0")}`,
      eventType,
      scopeRef,
      taskRef,
      occurredAtMs: 1000 + sequence,
      receivedAtMs: 1000 + sequence,
      scopeSequence: sequence,
      previousEventDigest,
      fact,
    } as Record<string, unknown>;
    value.factDigest = knowledgeUsageFactDigestV1(fact);
    value.eventDigest = knowledgeUsageEventDigestV1(value);
    previousEventDigest = value.eventDigest as string;
    events.push(value);
    return value;
  };
  const opened = event(0, "TASK_OPENED", { task });
  const searched = event(1, "SEARCH_RECORDED", { search });
  const inspected = event(2, "KNOWLEDGE_INSPECTED", { scopeRef, taskRef, searchRef, knowledgeRef });
  const dispositioned = event(3, "KNOWLEDGE_DISPOSITIONED", { scopeRef, taskRef, knowledgeRef, disposition: "USED", reasonCode: "SELECTED_FOR_TASK" });
  const decisionEvent = event(4, "DECISION_RECORDED", { decision });
  const eventRef = (value: Record<string, unknown>) => ({ eventId: value.eventId as string, eventDigest: value.eventDigest as string });
  const causes = selectedCauseSpecs.map((spec) => ({
    class: spec.class,
    subtype: spec.subtype,
    certainty: spec.certainty,
    causeEventRefs: [eventRef(spec.class === "DECISION" ? decisionEvent : spec.class === "SEARCH" ? searched : spec.class === "UNKNOWN" ? opened : dispositioned)],
    affectedKnowledgeRefs: spec.class === "KNOWLEDGE" ? [knowledgeRef] : spec.class === "SEARCH" ? [missingKnowledgeRef] : [],
  })).sort((a, b) => `${a.class}|${a.subtype}`.localeCompare(`${b.class}|${b.subtype}`));
  if (item.name === "unknown-outcome") causes[0]!.causeEventRefs = [];
  const failureAttribution = {
    schemaVersion: CKS_FAILURE_ATTRIBUTION_SCHEMA_V1,
    semanticRuleId: CKS_KNOWLEDGE_LINEAGE_SEMANTIC_RULE_V1,
    causalMode: item.causalMode,
    causes,
    failureAttributionDigest: "",
  } as Record<string, unknown>;
  failureAttribution.failureAttributionDigest = failureAttributionDigestV1(failureAttribution);
  const outcome = {
    schemaVersion: CKS_TASK_OUTCOME_EVIDENCE_SCHEMA_V1,
    semanticRuleId: CKS_KNOWLEDGE_LINEAGE_SEMANTIC_RULE_V1,
    scopeRef,
    taskRef,
    decisionRef: { decisionId: decision.decisionId, decisionDigest: decision.decisionDigest },
    outcomeId: `outcome:v1:${hex("f")}`,
    outcomeClass: item.outcomeClass,
    contributingKnowledgeRefs: [knowledgeRef],
    failureAttribution,
  } as Record<string, unknown>;
  outcome.outcomeDigest = taskOutcomeEvidenceDigestV1(outcome);
  event(5, "OUTCOME_RECORDED", { outcome });
  const profiles = item.name === "knowledge-stale" ? [makeProfile(true)] : [makeProfile(false)];
  const evidence: CksFailureCauseEvidenceV1[] = selectedCauseSpecs.map((spec, index) => ({ cause: causes[index]!, witness: spec.witness }));
  if (item.name === "unknown-outcome") evidence[0] = { cause: causes[0]!, witness: { kind: "UNKNOWN", dimension: "NONE" } };
  return {
    events,
    input: {
      schemaVersion: CKS_FAILURE_ATTRIBUTION_EVALUATOR_SCHEMA_V1,
      semanticRuleId: CKS_KNOWLEDGE_LINEAGE_SEMANTIC_RULE_V1,
      scopeRef,
      taskRef,
      events,
      evidence,
      profiles,
    },
  };
}

function caseInput(name: string): CksFailureAttributionEvaluatorInputV1 {
  const item = fixture().cases.find((candidate) => candidate.name === name);
  assert.ok(item, `fixture case ${name}`);
  return makeLineage(item).input;
}

test("P16 attributes each seeded failure to its declared causal class", () => {
  for (const item of fixture().cases) {
    const input = makeLineage(item).input;
    const first = evaluateCksSeededFailureAttributionV1(input);
    const second = evaluateCksSeededFailureAttributionV1(structuredClone(input));
    assert.equal(first.status, "EVALUATED", item.name);
    assert.deepEqual(second, first, `${item.name}: deterministic receipt`);
    if (first.status !== "EVALUATED") continue;
    assert.equal(first.outcomeClass, item.outcomeClass, item.name);
    assert.equal(first.causalMode, item.causalMode, item.name);
    assert.deepEqual(first.causes.map((cause) => `${cause.class}|${cause.subtype}`), (item.causes ?? (item.cause ? [item.cause] : [])).map((cause) => `${cause.class}|${cause.subtype}`).sort(), item.name);
    assert.equal(validateCksFailureAttributionEvaluationV1(first), true, `${item.name}: receipt digest and shape`);
    assert.deepEqual(verifyCksFailureAttributionEvaluationV1(first), { outcome: "ACCEPTED", reasonCodes: ["CONTRACT_VERIFIED"] }, item.name);
  }
});

test("P16 retains all six profile dimensions and does not turn contribution into Knowledge causality", () => {
  const result = evaluateCksSeededFailureAttributionV1(caseInput("execution-action-failed"));
  assert.equal(result.status, "EVALUATED");
  if (result.status !== "EVALUATED") return;
  assert.deepEqual(Object.keys(result.evidenceProfiles[0]!.dimensions).sort(), ["applicability", "contradiction", "freshness", "generalization", "operational", "source"]);
  assert.equal(result.evidenceProfiles[0]!.dimensions.source.trust, "HIGH");
  const stale = structuredClone(caseInput("knowledge-stale")) as CksFailureAttributionEvaluatorInputV1 & { evidence: CksFailureCauseEvidenceV1[] };
  stale.evidence = [{ ...stale.evidence[0]!, cause: { ...stale.evidence[0]!.cause, subtype: "SOURCE_DEFECT", affectedKnowledgeRefs: [knowledgeRef] }, witness: { kind: "KNOWLEDGE_PROFILE", dimension: "SOURCE" } }] as CksFailureCauseEvidenceV1[];
  assert.equal(evaluateCksSeededFailureAttributionV1(stale).status, "DENIED", "a failed outcome and contribution do not prove source defect");
});

test("P16 denies missing, late, replayed, cross-scope and tampered lineage", () => {
  const valid = caseInput("execution-action-failed");
  const missing = { ...valid, events: valid.events.slice(0, -1) };
  assert.equal(evaluateCksSeededFailureAttributionV1(missing).status, "DENIED", "missing outcome");
  const late = structuredClone(valid) as CksFailureAttributionEvaluatorInputV1 & { events: Array<Record<string, unknown>> };
  late.events[1]!.receivedAtMs = (late.events[1]!.occurredAtMs as number) + 300001;
  assert.equal(evaluateCksSeededFailureAttributionV1(late).status, "DENIED", "late event");
  const replayed = { ...valid, events: [...valid.events, valid.events[0]] };
  assert.equal(evaluateCksSeededFailureAttributionV1(replayed).status, "DENIED", "replayed event");
  const crossScope = structuredClone(valid) as CksFailureAttributionEvaluatorInputV1 & { events: Array<Record<string, unknown>> };
  crossScope.events[2]!.scopeRef = { scopeId: `scope:v1:${hex("b")}`, scopeDigest: hex("b") };
  assert.equal(evaluateCksSeededFailureAttributionV1(crossScope).status, "DENIED", "cross-scope event");
  const tampered = structuredClone(valid) as CksFailureAttributionEvaluatorInputV1 & { events: Array<Record<string, any>> };
  tampered.events[3]!.fact.knowledgeRef.knowledgeDigest = hex("e");
  assert.equal(evaluateCksSeededFailureAttributionV1(tampered).status, "DENIED", "tampered event");
});

test("P16 rejects missing causal evidence and uncertainty/multi-cause rule violations", () => {
  const missingWitness = { ...caseInput("execution-action-failed"), evidence: [] };
  assert.equal(evaluateCksSeededFailureAttributionV1(missingWitness).status, "DENIED");
  const possibleSingle = structuredClone(caseInput("execution-action-failed")) as CksFailureAttributionEvaluatorInputV1 & { evidence: CksFailureCauseEvidenceV1[] };
  const possibleCause = { ...possibleSingle.evidence[0]!, cause: { ...possibleSingle.evidence[0]!.cause, certainty: "POSSIBLE" } } as CksFailureCauseEvidenceV1;
  possibleSingle.evidence = [possibleCause];
  assert.equal(evaluateCksSeededFailureAttributionV1(possibleSingle).status, "DENIED", "POSSIBLE cannot masquerade as SINGLE");
  const tooMany = { ...caseInput("multi-contributing-execution-external"), evidence: [...caseInput("multi-contributing-execution-external").evidence, ...caseInput("multi-contributing-execution-external").evidence, { ...caseInput("multi-contributing-execution-external").evidence[0]! }] };
  assert.equal(evaluateCksSeededFailureAttributionV1(tooMany).status, "DENIED", "cause evidence is capped");
});
