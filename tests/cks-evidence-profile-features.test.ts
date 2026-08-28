import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import Ajv2020 from "ajv/dist/2020.js";
import {
  CKS_LINEAGE_FEATURE_REPORT_SCHEMA_V1,
  computeCksLineageFeatureReportV1,
  validateCksLineageFeatureReportV1,
  type CksStaticEvidenceProfileDimensionsV1,
} from "../packages/contracts/src/cks-evidence-profile-features.js";
import {
  CKS_DECISION_KNOWLEDGE_BINDING_SCHEMA_V1,
  CKS_FAILURE_ATTRIBUTION_SCHEMA_V1,
  CKS_KNOWLEDGE_LINEAGE_SEMANTIC_RULE_V1,
  CKS_KNOWLEDGE_USAGE_EVENT_SCHEMA_V1,
  CKS_TASK_OUTCOME_EVIDENCE_SCHEMA_V1,
  decisionKnowledgeBindingDigestV1,
  failureAttributionDigestV1,
  knowledgeUsageEventDigestV1,
  knowledgeUsageFactDigestV1,
  taskOutcomeEvidenceDigestV1,
  usageLineageSearchDigestV1,
  usageLineageTaskDigestV1,
} from "../packages/contracts/src/cks-knowledge-lineage.js";

interface DiversityFixture {
  schemaVersion: string;
  thresholds: Record<string, number>;
  scopeRef: { scopeId: string; scopeDigest: string };
  knowledgeRef: { knowledgeId: string; knowledgeDigest: string };
  dimensions: CksStaticEvidenceProfileDimensionsV1;
  cases: Array<{ name: string; repetitions: number; taskSemanticDigests: string[]; contextFingerprintDigests: string[]; expected: Record<string, number | string | null> }>;
}
const fixture = (): DiversityFixture => JSON.parse(readFileSync("tests/fixtures/cks-08/profile-diversity-cases-v1.json", "utf8"));
const hex = (character: string): string => character.repeat(64);
const base = fixture();

function makeLineage(index: number, taskSemanticDigest: string, contextFingerprintDigest: string, outcomeClass: "SUCCEEDED" | "FAILED" | "UNKNOWN" = "SUCCEEDED"): unknown[] {
  const task = {
    schemaVersion: "chimpmaera.knowledge/usage-lineage-task/v1",
    semanticRuleId: CKS_KNOWLEDGE_LINEAGE_SEMANTIC_RULE_V1,
    scopeRef: base.scopeRef,
    taskId: `task:v1:${index.toString(16).padStart(64, "0")}`,
    taskKind: "ACT",
    objectiveDigest: hex("1"),
    applicabilityContextDigest: contextFingerprintDigest,
    taskSemanticDigest,
    contextFingerprintDigest,
  } as Record<string, unknown>;
  task.taskDigest = usageLineageTaskDigestV1(task);
  const taskRef = { taskId: task.taskId, taskDigest: task.taskDigest };
  const knowledgeRef = base.knowledgeRef;
  const search = {
    schemaVersion: "chimpmaera.knowledge/usage-lineage-search/v1",
    semanticRuleId: CKS_KNOWLEDGE_LINEAGE_SEMANTIC_RULE_V1,
    scopeRef: base.scopeRef,
    taskRef,
    searchId: `search:v1:${(index + 100).toString(16).padStart(64, "0")}`,
    searchIntentDigest: hex("2"),
    resultKnowledgeRefs: [knowledgeRef],
  } as Record<string, unknown>;
  search.searchDigest = usageLineageSearchDigestV1(search);
  const searchRef = { searchId: search.searchId, searchDigest: search.searchDigest };
  const decision = {
    schemaVersion: CKS_DECISION_KNOWLEDGE_BINDING_SCHEMA_V1,
    semanticRuleId: CKS_KNOWLEDGE_LINEAGE_SEMANTIC_RULE_V1,
    scopeRef: base.scopeRef,
    taskRef,
    decisionId: `decision:v1:${(index + 200).toString(16).padStart(64, "0")}`,
    decisionClass: "SELECTED",
    supportingKnowledgeRefs: [knowledgeRef],
  } as Record<string, unknown>;
  decision.decisionDigest = decisionKnowledgeBindingDigestV1(decision);
  const failure = outcomeClass === "UNKNOWN"
    ? { schemaVersion: CKS_FAILURE_ATTRIBUTION_SCHEMA_V1, semanticRuleId: CKS_KNOWLEDGE_LINEAGE_SEMANTIC_RULE_V1, causalMode: "UNKNOWN", causes: [{ class: "UNKNOWN", subtype: "INSUFFICIENT_CAUSAL_EVIDENCE", causeEventRefs: [], affectedKnowledgeRefs: [] }] }
    : outcomeClass === "FAILED"
      ? { schemaVersion: CKS_FAILURE_ATTRIBUTION_SCHEMA_V1, semanticRuleId: CKS_KNOWLEDGE_LINEAGE_SEMANTIC_RULE_V1, causalMode: "SINGLE", causes: [{ class: "EXECUTION", subtype: "ACTION_FAILED", certainty: "SUPPORTED", causeEventRefs: [], affectedKnowledgeRefs: [] }] }
      : { schemaVersion: CKS_FAILURE_ATTRIBUTION_SCHEMA_V1, semanticRuleId: CKS_KNOWLEDGE_LINEAGE_SEMANTIC_RULE_V1, causalMode: "NOT_APPLICABLE", causes: [] };
  (failure as Record<string, unknown>).failureAttributionDigest = failureAttributionDigestV1(failure);
  const outcome = {
    schemaVersion: CKS_TASK_OUTCOME_EVIDENCE_SCHEMA_V1,
    semanticRuleId: CKS_KNOWLEDGE_LINEAGE_SEMANTIC_RULE_V1,
    scopeRef: base.scopeRef,
    taskRef,
    decisionRef: { decisionId: decision.decisionId, decisionDigest: decision.decisionDigest },
    outcomeId: `outcome:v1:${(index + 300).toString(16).padStart(64, "0")}`,
    outcomeClass,
    contributingKnowledgeRefs: [knowledgeRef],
    failureAttribution: failure,
  } as Record<string, unknown>;
  outcome.outcomeDigest = taskOutcomeEvidenceDigestV1(outcome);
  let previousEventDigest: string | null = null;
  const event = (sequence: number, eventType: string, fact: unknown): Record<string, unknown> => {
    const value = {
      schemaVersion: CKS_KNOWLEDGE_USAGE_EVENT_SCHEMA_V1,
      semanticRuleId: CKS_KNOWLEDGE_LINEAGE_SEMANTIC_RULE_V1,
      eventId: `lineage-event:v1:${(index * 10 + sequence).toString(16).padStart(64, "0")}`,
      eventType,
      scopeRef: base.scopeRef,
      taskRef,
      occurredAtMs: 1000 + index * 100 + sequence,
      receivedAtMs: 1000 + index * 100 + sequence,
      scopeSequence: sequence,
      previousEventDigest,
      fact,
    } as Record<string, unknown>;
    value.factDigest = knowledgeUsageFactDigestV1(fact);
    value.eventDigest = knowledgeUsageEventDigestV1(value);
    previousEventDigest = value.eventDigest as string;
    return value;
  };
  const events = [
    event(0, "TASK_OPENED", { task }),
    event(1, "SEARCH_RECORDED", { search }),
    event(2, "KNOWLEDGE_INSPECTED", { scopeRef: base.scopeRef, taskRef, searchRef, knowledgeRef }),
    event(3, "KNOWLEDGE_DISPOSITIONED", { scopeRef: base.scopeRef, taskRef, knowledgeRef, disposition: "USED", reasonCode: "SELECTED_FOR_TASK" }),
    event(4, "DECISION_RECORDED", { decision }),
  ];
  if (outcomeClass !== "SUCCEEDED") {
    const cause = (failure as Record<string, any>).causes[0];
    cause.causeEventRefs = [{ eventId: events[3]!.eventId, eventDigest: events[3]!.eventDigest }];
    (failure as Record<string, unknown>).failureAttributionDigest = failureAttributionDigestV1(failure);
    outcome.failureAttribution = failure;
    outcome.outcomeDigest = taskOutcomeEvidenceDigestV1(outcome);
  }
  events.push(event(5, "OUTCOME_RECORDED", { outcome }));
  return events;
}

function inputFor(lineages: readonly unknown[][]): Record<string, unknown> {
  return { scopeRef: base.scopeRef, knowledgeRef: base.knowledgeRef, lineages, dimensions: base.dimensions, thresholds: base.thresholds };
}

test("P15 collapses identical repetitions and keeps raw novelty/context features", () => {
  for (const item of base.cases) {
    const combinations = item.taskSemanticDigests.flatMap((taskSemanticDigest) => item.contextFingerprintDigests.map((contextFingerprintDigest) => ({ taskSemanticDigest, contextFingerprintDigest })));
    const lineages = Array.from({ length: item.repetitions }, (_, index) => makeLineage(index + 1, combinations[index % combinations.length]!.taskSemanticDigest, combinations[index % combinations.length]!.contextFingerprintDigest));
    const first = computeCksLineageFeatureReportV1(inputFor(lineages));
    const second = computeCksLineageFeatureReportV1(inputFor([...lineages].reverse()));
    assert.equal(first.status, "REPORTED", item.name);
    assert.deepEqual(second, first, `${item.name}: report is order-independent`);
    if (first.status !== "REPORTED") continue;
    assert.equal(first.dimensions.generalization.validTaskOccurrenceCount, item.expected.validTaskOccurrenceCount);
    assert.equal(first.dimensions.generalization.distinctTaskSemanticCount, item.expected.distinctTaskSemanticCount);
    assert.equal(first.dimensions.generalization.distinctContextCount, item.expected.distinctContextCount);
    assert.equal(first.dimensions.generalization.distinctJointUsageUnitCount, item.expected.distinctJointUsageUnitCount);
    assert.equal(first.dimensions.generalization.identicalRepetitionCount, item.expected.identicalRepetitionCount);
    assert.equal(first.dimensions.generalization.marker, item.expected.generalizationMarker);
    assert.equal(first.dimensions.operational.marker, item.expected.operationalMarker);
    assert.deepEqual(first.rawFeatures.generalization.taskSemanticDigests, [...item.taskSemanticDigests].sort());
    assert.deepEqual(first.rawFeatures.generalization.contextFingerprintDigests, [...item.contextFingerprintDigests].sort());
    assert.equal(first.rawFeatures.generalization.generalizationUsageUnitDigests.length, item.expected.distinctJointUsageUnitCount);
    assert.equal(validateCksLineageFeatureReportV1(first), true);
  }
});

test("source, applicability, freshness, contradiction, generalization and operational stay independent", () => {
  const lineages = [makeLineage(1, hex("3"), hex("4")), makeLineage(2, hex("5"), hex("6")), makeLineage(3, hex("7"), hex("4"), "FAILED")];
  const result = computeCksLineageFeatureReportV1(inputFor(lineages));
  assert.equal(result.status, "REPORTED", JSON.stringify(result));
  if (result.status !== "REPORTED") return;
  assert.deepEqual(Object.keys(result.dimensions).sort(), ["applicability", "contradiction", "freshness", "generalization", "operational", "source"]);
  assert.equal(result.dimensions.generalization.marker, "+G");
  assert.equal(result.dimensions.operational.eligibleOutcomeOccurrenceCount, 3);
  assert.equal(result.dimensions.operational.uncertainOutcomeOccurrenceCount, 0);
  assert.deepEqual(result.dimensions.operational.distinctOutcomeUnitsByClass, { SUCCEEDED: 2, FAILED: 1, PARTIAL: 0, DENIED: 0 });
  assert.equal(result.dimensions.source.trust, "MEDIUM");
  assert.equal(result.dimensions.applicability.matchState, "MATCH");
  assert.equal(result.dimensions.freshness.freshnessState, "FRESH");
  assert.equal(result.dimensions.contradiction.contradictionState, "NONE_DECLARED");
  assert.equal(result.dimensions.operational.failureCauseObservations.length, 1);
  assert.equal(result.dimensions.operational.failureCauseObservations[0]!.class, "EXECUTION");
  assert.equal(result.rawFeatures.operational.operationalUnitDigests.length, 3);
});

test("feature computation is fail-closed for incomplete and cross-scope evidence", () => {
  const missing = computeCksLineageFeatureReportV1(inputFor([[]]));
  assert.deepEqual(missing, { schemaVersion: CKS_LINEAGE_FEATURE_REPORT_SCHEMA_V1, status: "DENIED", reasonCodes: ["SCHEMA_DENIED"] });
  const crossScope = JSON.parse(readFileSync("tests/fixtures/cks-08/lineage-positive-v1.json", "utf8")).tasks[1].events;
  const denied = computeCksLineageFeatureReportV1(inputFor([crossScope]));
  assert.deepEqual(denied, { schemaVersion: CKS_LINEAGE_FEATURE_REPORT_SCHEMA_V1, status: "DENIED", reasonCodes: ["SCOPE_MISMATCH_DENIED"] });
  const nonFrozenThresholds = computeCksLineageFeatureReportV1({ ...inputFor([makeLineage(1, hex("3"), hex("4"))]), thresholds: { ...base.thresholds, generalizationMinimumDistinctContexts: 1 } });
  assert.deepEqual(nonFrozenThresholds, { schemaVersion: CKS_LINEAGE_FEATURE_REPORT_SCHEMA_V1, status: "DENIED", reasonCodes: ["SCHEMA_DENIED"] });
});

test("feature-report JSON Schema is closed and accepts the computed report", () => {
  const report = computeCksLineageFeatureReportV1(inputFor([makeLineage(1, hex("3"), hex("4")), makeLineage(2, hex("5"), hex("6"))]));
  if (report.status !== "REPORTED") throw new Error("expected report");
  const ajv = new Ajv2020({ allErrors: true, strict: true });
  const validate = ajv.compile(JSON.parse(readFileSync("schemas/contracts/cks-lineage-feature-report-v1.schema.json", "utf8")));
  assert.equal(validate(report), true, JSON.stringify(validate.errors));
  assert.equal(validate({ ...report, rawFeatures: { ...report.rawFeatures, extra: true } }), false);
  const tampered = JSON.parse(JSON.stringify(report)) as Record<string, any>;
  tampered.rawFeatures.generalization.taskSemanticDigests = [hex("f")];
  assert.equal(validateCksLineageFeatureReportV1(tampered), false);
});
