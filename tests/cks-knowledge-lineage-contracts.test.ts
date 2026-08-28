import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import Ajv2020 from "ajv/dist/2020.js";
import {
  CKS_KNOWLEDGE_EVIDENCE_PROFILE_SCHEMA_V1,
  CKS_KNOWLEDGE_LINEAGE_SEMANTIC_RULE_V1,
  CKS_KNOWLEDGE_USAGE_EVENT_SCHEMA_V1,
  CKS_DECISION_KNOWLEDGE_BINDING_SCHEMA_V1,
  CKS_FAILURE_ATTRIBUTION_SCHEMA_V1,
  CKS_TASK_OUTCOME_EVIDENCE_SCHEMA_V1,
  decisionKnowledgeBindingDigestV1,
  failureAttributionDigestV1,
  knowledgeEvidenceProfileDigestV1,
  knowledgeUsageEventDigestV1,
  knowledgeUsageFactDigestV1,
  reconstructKnowledgeUsageV1,
  taskOutcomeEvidenceDigestV1,
  usageLineageSearchDigestV1,
  usageLineageTaskDigestV1,
  validateDecisionKnowledgeBindingV1,
  validateFailureAttributionV1,
  validateKnowledgeEvidenceProfileV1,
  validateKnowledgeUsageEventV1,
  validateTaskOutcomeEvidenceV1,
  type FailureAttributionV1,
} from "../packages/contracts/src/cks-knowledge-lineage.js";

const hex = (character: string): string => character.repeat(64);
const scope = { scopeId: `scope:v1:${hex("a")}`, scopeDigest: hex("a") };
const knowledge = (name: string, character: string) => ({ knowledgeId: `fixture:${name}`, knowledgeDigest: hex(character) });
const alpha = knowledge("alpha", "d");
const beta = knowledge("beta", "b");
const gamma = knowledge("gamma", "c");

function makeLineage(): unknown[] {
  const task = {
    schemaVersion: "chimpmaera.knowledge/usage-lineage-task/v1",
    semanticRuleId: CKS_KNOWLEDGE_LINEAGE_SEMANTIC_RULE_V1,
    scopeRef: scope,
    taskId: `task:v1:${hex("c")}`,
    taskKind: "ACT",
    objectiveDigest: hex("1"),
    applicabilityContextDigest: hex("2"),
    taskSemanticDigest: hex("3"),
    contextFingerprintDigest: hex("4"),
  } as Record<string, unknown>;
  task.taskDigest = usageLineageTaskDigestV1(task);
  const taskRef = { taskId: task.taskId, taskDigest: task.taskDigest };
  const search = {
    schemaVersion: "chimpmaera.knowledge/usage-lineage-search/v1",
    semanticRuleId: CKS_KNOWLEDGE_LINEAGE_SEMANTIC_RULE_V1,
    scopeRef: scope,
    taskRef,
    searchId: `search:v1:${hex("9")}`,
    searchIntentDigest: hex("5"),
    resultKnowledgeRefs: [alpha, beta, gamma],
  } as Record<string, unknown>;
  search.searchDigest = usageLineageSearchDigestV1(search);
  const searchRef = { searchId: search.searchId, searchDigest: search.searchDigest };
  const decision = {
    schemaVersion: CKS_DECISION_KNOWLEDGE_BINDING_SCHEMA_V1,
    semanticRuleId: CKS_KNOWLEDGE_LINEAGE_SEMANTIC_RULE_V1,
    scopeRef: scope,
    taskRef,
    decisionId: `decision:v1:${hex("e")}`,
    decisionClass: "SELECTED",
    supportingKnowledgeRefs: [alpha],
  } as Record<string, unknown>;
  decision.decisionDigest = decisionKnowledgeBindingDigestV1(decision);
  const failure = {
    schemaVersion: CKS_FAILURE_ATTRIBUTION_SCHEMA_V1,
    semanticRuleId: CKS_KNOWLEDGE_LINEAGE_SEMANTIC_RULE_V1,
    causalMode: "NOT_APPLICABLE",
    causes: [],
  } as Record<string, unknown>;
  failure.failureAttributionDigest = failureAttributionDigestV1(failure);
  const outcome = {
    schemaVersion: CKS_TASK_OUTCOME_EVIDENCE_SCHEMA_V1,
    semanticRuleId: CKS_KNOWLEDGE_LINEAGE_SEMANTIC_RULE_V1,
    scopeRef: scope,
    taskRef,
    decisionRef: { decisionId: decision.decisionId, decisionDigest: decision.decisionDigest },
    outcomeId: `outcome:v1:${hex("f")}`,
    outcomeClass: "SUCCEEDED",
    contributingKnowledgeRefs: [alpha],
    failureAttribution: failure,
  } as Record<string, unknown>;
  outcome.outcomeDigest = taskOutcomeEvidenceDigestV1(outcome);

  let previous: string | null = null;
  const event = (sequence: number, eventType: string, fact: unknown): Record<string, unknown> => {
    const value = {
      schemaVersion: CKS_KNOWLEDGE_USAGE_EVENT_SCHEMA_V1,
      semanticRuleId: CKS_KNOWLEDGE_LINEAGE_SEMANTIC_RULE_V1,
      eventId: `lineage-event:v1:${(sequence + 10).toString(16).padStart(64, "0")}`,
      eventType,
      scopeRef: scope,
      taskRef,
      occurredAtMs: 1000 + sequence * 10,
      receivedAtMs: 1000 + sequence * 10,
      scopeSequence: sequence,
      previousEventDigest: previous,
      fact,
    } as Record<string, unknown>;
    value.factDigest = knowledgeUsageFactDigestV1(fact);
    value.eventDigest = knowledgeUsageEventDigestV1(value);
    previous = value.eventDigest as string;
    return value;
  };
  return [
    event(0, "TASK_OPENED", { task }),
    event(1, "SEARCH_RECORDED", { search }),
    event(2, "KNOWLEDGE_INSPECTED", { scopeRef: scope, taskRef, searchRef, knowledgeRef: alpha }),
    event(3, "KNOWLEDGE_INSPECTED", { scopeRef: scope, taskRef, searchRef, knowledgeRef: beta }),
    event(4, "KNOWLEDGE_DISPOSITIONED", { scopeRef: scope, taskRef, knowledgeRef: alpha, disposition: "USED", reasonCode: "SELECTED_FOR_TASK" }),
    event(5, "KNOWLEDGE_DISPOSITIONED", { scopeRef: scope, taskRef, knowledgeRef: beta, disposition: "REJECTED", reasonCode: "STALE" }),
    event(6, "DECISION_RECORDED", { decision }),
    event(7, "OUTCOME_RECORDED", { outcome }),
  ];
}

const fixture = (): Record<string, any> => JSON.parse(readFileSync("tests/fixtures/cks-08/contracts-valid-v1.json", "utf8"));
const invalidFixture = (): Record<string, any> => JSON.parse(readFileSync("tests/fixtures/cks-08/contracts-invalid-v1.json", "utf8"));

 test("CKS-08 contracts have closed JSON schemas and digest-bound valid fixtures", () => {
  const ajv = new Ajv2020({ allErrors: true, strict: true });
  const schemas: Array<[string, string, unknown]> = [
    ["event", "schemas/contracts/cks-knowledge-usage-event-v1.schema.json", fixture().knowledgeUsageEvent],
    ["decision", "schemas/contracts/cks-decision-knowledge-binding-v1.schema.json", fixture().decisionKnowledgeBinding],
    ["outcome", "schemas/contracts/cks-task-outcome-evidence-v1.schema.json", { ...fixture().taskOutcomeEvidence, failureAttribution: fixture().failureAttribution }],
    ["failure", "schemas/contracts/cks-failure-attribution-v1.schema.json", fixture().failureAttribution],
    ["profile", "schemas/contracts/cks-knowledge-evidence-profile-v1.schema.json", fixture().knowledgeEvidenceProfile],
  ];
  for (const [name, path, value] of schemas) {
    const validate = ajv.compile(JSON.parse(readFileSync(path, "utf8")));
    assert.equal(validate(value), true, `${name}: ${JSON.stringify(validate.errors)}`);
  }
  const f = fixture();
  assert.equal(validateKnowledgeUsageEventV1(f.knowledgeUsageEvent), true);
  assert.equal(validateDecisionKnowledgeBindingV1(f.decisionKnowledgeBinding), true);
  assert.equal(validateFailureAttributionV1(f.failureAttribution), true);
  assert.equal(validateTaskOutcomeEvidenceV1(f.taskOutcomeEvidence), true);
  assert.equal(validateKnowledgeEvidenceProfileV1(f.knowledgeEvidenceProfile), true);
  assert.equal(validateKnowledgeUsageEventV1(invalidFixture().missingMandatoryDigest), false);
  assert.equal(validateFailureAttributionV1(invalidFixture().prohibitedRawContent), false);
  assert.equal(validateFailureAttributionV1(invalidFixture().unknownFailureSubtype), false);
});

test("P14 reconstructs all six usage sets without inference", () => {
  const result = reconstructKnowledgeUsageV1(makeLineage());
  assert.equal(result.status, "RECONSTRUCTED");
  if (result.status !== "RECONSTRUCTED") return;
  assert.deepEqual(result.searched.map((ref) => ref.knowledgeId), ["fixture:alpha", "fixture:beta", "fixture:gamma"]);
  assert.deepEqual(result.inspected.map((ref) => ref.knowledgeId), ["fixture:alpha", "fixture:beta"]);
  assert.deepEqual(result.used.map((ref) => ref.knowledgeId), ["fixture:alpha"]);
  assert.deepEqual(result.rejected.map((item) => [item.knowledgeRef.knowledgeId, item.reasonCode]), [["fixture:beta", "STALE"]]);
  assert.deepEqual(result.decisionSupporting.map((ref) => ref.knowledgeId), ["fixture:alpha"]);
  assert.deepEqual(result.outcomeContributing.map((ref) => ref.knowledgeId), ["fixture:alpha"]);
});

test("lineage denies missing, late, replayed, cross-scope and tampered events", () => {
  const valid = makeLineage();
  assert.equal(reconstructKnowledgeUsageV1(valid.slice(0, -1)).status, "DENIED");
  const late = structuredClone(valid) as Array<Record<string, any>>;
  late[1]!.receivedAtMs = late[1]!.occurredAtMs + 300001;
  assert.equal(reconstructKnowledgeUsageV1(late).status, "DENIED");
  assert.equal(reconstructKnowledgeUsageV1([...valid, valid[0]]).status, "DENIED");
  const crossScope = structuredClone(valid) as Array<Record<string, any>>;
  crossScope[2]!.scopeRef = { scopeId: `scope:v1:${hex("b")}`, scopeDigest: hex("b") };
  assert.equal(reconstructKnowledgeUsageV1(crossScope).status, "DENIED");
  const tampered = structuredClone(valid) as Array<Record<string, any>>;
  tampered[3]!.fact.knowledgeRef.knowledgeDigest = hex("e");
  tampered[3]!.factDigest = knowledgeUsageFactDigestV1(tampered[3]!.fact);
  tampered[3]!.eventDigest = knowledgeUsageEventDigestV1(tampered[3]!);
  assert.equal(reconstructKnowledgeUsageV1(tampered).status, "DENIED");
});

test("P16 preserves explicit uncertainty and multi-cause attribution, while contribution is not causality", () => {
  const supportedUnsigned = {
    schemaVersion: CKS_FAILURE_ATTRIBUTION_SCHEMA_V1,
    semanticRuleId: CKS_KNOWLEDGE_LINEAGE_SEMANTIC_RULE_V1,
    causalMode: "MULTI_CONTRIBUTING",
    causes: [
      { class: "EXECUTION", subtype: "ACTION_FAILED", certainty: "SUPPORTED", causeEventRefs: [{ eventId: `lineage-event:v1:${hex("1")}`, eventDigest: hex("1") }], affectedKnowledgeRefs: [] },
      { class: "EXTERNAL", subtype: "DEPENDENCY_UNAVAILABLE", certainty: "SUPPORTED", causeEventRefs: [{ eventId: `lineage-event:v1:${hex("2")}`, eventDigest: hex("2") }], affectedKnowledgeRefs: [] },
    ],
    failureAttributionDigest: "",
  };
  const supported = { ...supportedUnsigned, failureAttributionDigest: failureAttributionDigestV1(supportedUnsigned) } as unknown as FailureAttributionV1;
  assert.equal(validateFailureAttributionV1(supported), true);
  const unresolved = { ...supported, causalMode: "ALTERNATIVES_UNRESOLVED", causes: supported.causes.map((cause) => ({ ...cause, certainty: "POSSIBLE" })), failureAttributionDigest: "" } as unknown as Record<string, unknown>;
  unresolved.failureAttributionDigest = failureAttributionDigestV1(unresolved);
  assert.equal(validateFailureAttributionV1(unresolved), true);
  const misattributed = makeLineage() as Array<Record<string, any>>;
  const outcome = misattributed[7]!.fact.outcome;
  outcome.outcomeClass = "FAILED";
  outcome.failureAttribution = { ...supported, failureAttributionDigest: failureAttributionDigestV1(supported as unknown as Record<string, unknown>) };
  outcome.outcomeDigest = taskOutcomeEvidenceDigestV1(outcome);
  misattributed[7]!.fact = { outcome };
  misattributed[7]!.factDigest = knowledgeUsageFactDigestV1(misattributed[7]!.fact);
  misattributed[7]!.eventDigest = knowledgeUsageEventDigestV1(misattributed[7]!);
  assert.equal(reconstructKnowledgeUsageV1(misattributed).status, "DENIED");
});

test("profiles keep source, applicability, freshness, contradiction, generalization and operational dimensions separate", () => {
  const profile = fixture().knowledgeEvidenceProfile;
  assert.equal(validateKnowledgeEvidenceProfileV1(profile), true);
  assert.deepEqual(Object.keys(profile.dimensions).sort(), ["applicability", "contradiction", "freshness", "generalization", "operational", "source"]);
  const tampered = structuredClone(profile);
  tampered.dimensions.operational.marker = "+O";
  tampered.profileDigest = knowledgeEvidenceProfileDigestV1(tampered);
  assert.equal(validateKnowledgeEvidenceProfileV1(tampered), false, "operational credit cannot be added without its raw counters");
});
