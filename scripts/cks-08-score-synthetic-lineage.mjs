#!/usr/bin/env node
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import Ajv2020 from "ajv/dist/2020.js";

import {
  CKS_DECISION_KNOWLEDGE_BINDING_SCHEMA_V1,
  CKS_DIRECT_FAILURE_EVENT_TYPE_BY_CLASS_V1,
  CKS_DIRECT_FAILURE_RECEIPT_SCHEMA_V1,
  CKS_FAILURE_ATTRIBUTION_SCHEMA_V1,
  CKS_KNOWLEDGE_EVIDENCE_PROFILE_SCHEMA_V1,
  CKS_KNOWLEDGE_LINEAGE_SEMANTIC_RULE_V1,
  CKS_KNOWLEDGE_USAGE_EVENT_SCHEMA_V1,
  CKS_TASK_OUTCOME_EVIDENCE_SCHEMA_V1,
  decisionKnowledgeBindingDigestV1,
  directFailureReceiptDigestV1,
  failureAttributionDigestV1,
  knowledgeEvidenceProfileDigestV1,
  knowledgeUsageEventDigestV1,
  knowledgeUsageFactDigestV1,
  taskOutcomeEvidenceDigestV1,
  usageLineageSearchDigestV1,
  usageLineageTaskDigestV1,
} from "../dist/packages/contracts/src/cks-knowledge-lineage.js";
import { reconstructCksLineageUsageV1 } from "../dist/packages/contracts/src/cks-lineage-reconstructor.js";
import { computeCksLineageFeatureReportV1 } from "../dist/packages/contracts/src/cks-evidence-profile-features.js";
import { evaluateCksSeededFailureAttributionV1 } from "../dist/packages/contracts/src/cks-failure-attribution-evaluator.js";

export const SYNTHETIC_LINEAGE_SCORE_SCHEMA_V1 = "cks-08-synthetic-lineage-score/v1";
const ROOT = resolve(fileURLToPath(new URL("..", import.meta.url)));
const DEFAULT_CASES = "tests/fixtures/cks-08/synthetic-lineage-cases-v1.json";
const DEFAULT_GROUND_TRUTH = "tests/fixtures/cks-08/synthetic-lineage-ground-truth-v1.json";
const DEFAULT_SCHEMA = "schemas/contracts/cks-synthetic-lineage-case-v1.schema.json";

const digest = (token) => createHash("sha256").update(`cks-08-synthetic:${token}`, "utf8").digest("hex");
const clone = (value) => JSON.parse(JSON.stringify(value));
const refKey = (ref) => `${ref.knowledgeId}|${ref.knowledgeDigest}`;
const causeKey = (cause) => `${cause.class}|${cause.subtype}`;
const readJson = (path) => JSON.parse(readFileSync(path, "utf8"));
const pathFromRoot = (path) => resolve(ROOT, path);

function profileFor(task, fixture) {
  const knowledgeRef = fixture.knowledgeRefs.alpha;
  const profileKind = task.profile;
  const profile = {
    schemaVersion: CKS_KNOWLEDGE_EVIDENCE_PROFILE_SCHEMA_V1,
    semanticRuleId: CKS_KNOWLEDGE_LINEAGE_SEMANTIC_RULE_V1,
    scopeRef: fixture.scopeRef,
    knowledgeRef,
    dimensions: {
      source: {
        knowledgeDigest: knowledgeRef.knowledgeDigest,
        attributionSetDigest: digest("attribution"),
        epistemicStatus: profileKind === "source-defect" ? "DISPUTED" : "VERIFIED",
        trust: profileKind === "source-defect" ? "LOW" : "HIGH",
      },
      applicability: {
        applicabilityScopeDigest: digest("applicability-scope"),
        contextFingerprintDigest: digest("context-profile"),
        matchState: profileKind === "applicability-mismatch" ? "NO_MATCH" : "MATCH",
      },
      freshness: {
        knowledgeDigest: knowledgeRef.knowledgeDigest,
        evaluatedAtMs: 1000,
        freshnessState: profileKind === "stale" ? "STALE" : "FRESH",
      },
      contradiction: {
        knowledgeDigest: knowledgeRef.knowledgeDigest,
        conflictSetDigest: digest("conflict-set"),
        contradictionState: profileKind === "contradicted" ? "DECLARED_UNRESOLVED" : "NONE_DECLARED",
      },
      generalization: {
        validTaskOccurrenceCount: 1,
        distinctTaskSemanticCount: 1,
        distinctContextCount: 1,
        distinctJointUsageUnitCount: 1,
        identicalRepetitionCount: 0,
        marker: null,
      },
      operational: {
        eligibleOutcomeOccurrenceCount: 1,
        distinctOperationalUnitCount: 1,
        distinctOutcomeUnitsByClass: { SUCCEEDED: 0, FAILED: 1, PARTIAL: 0, DENIED: 0 },
        uncertainOutcomeOccurrenceCount: 0,
        failureCauseObservations: [],
        marker: "+O",
      },
    },
    profileDigest: "",
  };
  profile.profileDigest = knowledgeEvidenceProfileDigestV1(profile);
  return profile;
}

function buildLineage(task, ordinal, fixture) {
  const taskSemanticDigest = digest(`task-semantic:${task.taskSemantic}`);
  const contextFingerprintDigest = digest(`context:${task.context}`);
  const taskValue = {
    schemaVersion: "chimpmaera.knowledge/usage-lineage-task/v1",
    semanticRuleId: CKS_KNOWLEDGE_LINEAGE_SEMANTIC_RULE_V1,
    scopeRef: fixture.scopeRef,
    taskId: `task:v1:${ordinal.toString(16).padStart(64, "0")}`,
    taskKind: task.taskKind,
    objectiveDigest: digest(`objective:${task.name}`),
    applicabilityContextDigest: contextFingerprintDigest,
    taskSemanticDigest,
    contextFingerprintDigest,
    taskDigest: "",
  };
  taskValue.taskDigest = usageLineageTaskDigestV1(taskValue);
  const taskRef = { taskId: taskValue.taskId, taskDigest: taskValue.taskDigest };
  const knowledgeRef = (name) => fixture.knowledgeRefs[name];
  const searchValue = {
    schemaVersion: "chimpmaera.knowledge/usage-lineage-search/v1",
    semanticRuleId: CKS_KNOWLEDGE_LINEAGE_SEMANTIC_RULE_V1,
    scopeRef: fixture.scopeRef,
    taskRef,
    searchId: `search:v1:${(ordinal + 1000).toString(16).padStart(64, "0")}`,
    searchIntentDigest: digest(`search-intent:${task.name}`),
    resultKnowledgeRefs: task.searchResults.map(knowledgeRef).sort((a, b) => refKey(a).localeCompare(refKey(b))),
    searchDigest: "",
  };
  searchValue.searchDigest = usageLineageSearchDigestV1(searchValue);
  const searchRef = { searchId: searchValue.searchId, searchDigest: searchValue.searchDigest };
  const decisionValue = {
    schemaVersion: CKS_DECISION_KNOWLEDGE_BINDING_SCHEMA_V1,
    semanticRuleId: CKS_KNOWLEDGE_LINEAGE_SEMANTIC_RULE_V1,
    scopeRef: fixture.scopeRef,
    taskRef,
    decisionId: `decision:v1:${(ordinal + 2000).toString(16).padStart(64, "0")}`,
    decisionClass: "SELECTED",
    supportingKnowledgeRefs: task.decisionSupporting.map(knowledgeRef).sort((a, b) => refKey(a).localeCompare(refKey(b))),
    decisionDigest: "",
  };
  decisionValue.decisionDigest = decisionKnowledgeBindingDigestV1(decisionValue);
  let previousEventDigest = null;
  const events = [];
  const append = (sequence, eventType, fact) => {
    const event = {
      schemaVersion: CKS_KNOWLEDGE_USAGE_EVENT_SCHEMA_V1,
      semanticRuleId: CKS_KNOWLEDGE_LINEAGE_SEMANTIC_RULE_V1,
      eventId: `lineage-event:v1:${(ordinal * 16 + sequence).toString(16).padStart(64, "0")}`,
      eventType,
      scopeRef: fixture.scopeRef,
      taskRef,
      occurredAtMs: 1000 + ordinal * 100 + sequence,
      receivedAtMs: 1000 + ordinal * 100 + sequence,
      scopeSequence: sequence,
      previousEventDigest,
      fact,
      factDigest: knowledgeUsageFactDigestV1(fact),
      eventDigest: "",
    };
    event.eventDigest = knowledgeUsageEventDigestV1(event);
    previousEventDigest = event.eventDigest;
    events.push(event);
    return event;
  };
  const opened = append(0, "TASK_OPENED", { task: taskValue });
  const searched = append(1, "SEARCH_RECORDED", { search: searchValue });
  for (const [index, id] of task.inspected.entries()) {
    append(2 + index, "KNOWLEDGE_INSPECTED", {
      scopeRef: fixture.scopeRef,
      taskRef,
      searchRef,
      knowledgeRef: knowledgeRef(id),
    });
  }
  const dispositionEvents = new Map();
  for (const id of task.inspected) {
    const rejected = task.rejected.find((item) => item.id === id);
    dispositionEvents.set(id, append(events.length, "KNOWLEDGE_DISPOSITIONED", {
      scopeRef: fixture.scopeRef,
      taskRef,
      knowledgeRef: knowledgeRef(id),
      disposition: rejected ? "REJECTED" : "USED",
      reasonCode: rejected?.reasonCode ?? "SELECTED_FOR_TASK",
    }));
  }
  const decisionEvent = append(events.length, "DECISION_RECORDED", { decision: decisionValue });
  const directReceiptEvents = new Map();
  for (const cause of [...task.causes].sort((a, b) => causeKey(a).localeCompare(causeKey(b)))) {
    if (!Object.hasOwn(CKS_DIRECT_FAILURE_EVENT_TYPE_BY_CLASS_V1, cause.class)) continue;
    const receipt = {
      schemaVersion: CKS_DIRECT_FAILURE_RECEIPT_SCHEMA_V1,
      semanticRuleId: CKS_KNOWLEDGE_LINEAGE_SEMANTIC_RULE_V1,
      scopeRef: fixture.scopeRef,
      taskRef,
      decisionRef: { decisionId: decisionValue.decisionId, decisionDigest: decisionValue.decisionDigest },
      failureClass: cause.class,
      failureSubtype: cause.subtype,
      evidenceDigest: digest(`direct-evidence:${task.name}:${causeKey(cause)}`),
      receiptDigest: "",
    };
    receipt.receiptDigest = directFailureReceiptDigestV1(receipt);
    directReceiptEvents.set(causeKey(cause), append(events.length, CKS_DIRECT_FAILURE_EVENT_TYPE_BY_CLASS_V1[cause.class], { receipt }));
  }
  const eventForCause = (cause) => {
    if (cause.class === "UNKNOWN") return opened;
    if (cause.class === "DECISION") return decisionEvent;
    if (cause.class === "SEARCH") return searched;
    if (Object.hasOwn(CKS_DIRECT_FAILURE_EVENT_TYPE_BY_CLASS_V1, cause.class)) return directReceiptEvents.get(causeKey(cause));
    const affected = cause.affectedKnowledge?.[0];
    return dispositionEvents.get(affected) ?? dispositionEvents.get(task.used[0]) ?? decisionEvent;
  };
  const causes = task.causes.map((cause) => ({
    class: cause.class,
    subtype: cause.subtype,
    certainty: cause.certainty,
    causeEventRefs: cause.class === "UNKNOWN" ? [] : [{ eventId: eventForCause(cause).eventId, eventDigest: eventForCause(cause).eventDigest }],
    affectedKnowledgeRefs: cause.affectedKnowledge.map(knowledgeRef).sort((a, b) => refKey(a).localeCompare(refKey(b))),
  })).sort((a, b) => causeKey(a).localeCompare(causeKey(b)));
  const failureAttribution = {
    schemaVersion: CKS_FAILURE_ATTRIBUTION_SCHEMA_V1,
    semanticRuleId: CKS_KNOWLEDGE_LINEAGE_SEMANTIC_RULE_V1,
    causalMode: task.causalMode,
    causes,
    failureAttributionDigest: "",
  };
  failureAttribution.failureAttributionDigest = failureAttributionDigestV1(failureAttribution);
  const outcomeValue = {
    schemaVersion: CKS_TASK_OUTCOME_EVIDENCE_SCHEMA_V1,
    semanticRuleId: CKS_KNOWLEDGE_LINEAGE_SEMANTIC_RULE_V1,
    scopeRef: fixture.scopeRef,
    taskRef,
    decisionRef: { decisionId: decisionValue.decisionId, decisionDigest: decisionValue.decisionDigest },
    outcomeId: `outcome:v1:${(ordinal + 3000).toString(16).padStart(64, "0")}`,
    outcomeClass: task.outcomeClass,
    contributingKnowledgeRefs: task.outcomeContributing.map(knowledgeRef).sort((a, b) => refKey(a).localeCompare(refKey(b))),
    failureAttribution,
    outcomeDigest: "",
  };
  outcomeValue.outcomeDigest = taskOutcomeEvidenceDigestV1(outcomeValue);
  append(events.length, "OUTCOME_RECORDED", { outcome: outcomeValue });
  return {
    task,
    taskRef,
    events,
    profile: profileFor(task, fixture),
    attributionInput: {
      schemaVersion: "chimpmaera.knowledge/failure-attribution-evaluator/v1",
      semanticRuleId: CKS_KNOWLEDGE_LINEAGE_SEMANTIC_RULE_V1,
      scopeRef: fixture.scopeRef,
      taskRef,
      events,
      evidence: task.causes.map((declared) => ({
        cause: causes.find((cause) => causeKey(cause) === `${declared.class}|${declared.subtype}`),
        witness: declared.witness,
      })),
      profiles: [profileFor(task, fixture)],
    },
  };
}

function rehashEvents(events, startIndex) {
  let previousEventDigest = startIndex > 0 ? events[startIndex - 1].eventDigest : null;
  for (let index = startIndex; index < events.length; index += 1) {
    const event = events[index];
    event.previousEventDigest = previousEventDigest;
    event.factDigest = knowledgeUsageFactDigestV1(event.fact);
    event.eventDigest = knowledgeUsageEventDigestV1(event);
    previousEventDigest = event.eventDigest;
  }
  return events;
}

export function buildSyntheticFixtureModel(fixture) {
  const built = new Map(fixture.tasks.map((task, index) => [task.name, buildLineage(task, index + 1, fixture)]));
  return { fixture, built };
}

function expectedReconstruction(result) {
  return {
    searched: result.searched.map((ref) => ref.knowledgeId),
    inspected: result.inspected.map((ref) => ref.knowledgeId),
    used: result.used.map((ref) => ref.knowledgeId),
    rejected: result.rejected.map((item) => [item.knowledgeRef.knowledgeId, item.reasonCode]),
    decisionSupporting: result.decisionSupporting.map((ref) => ref.knowledgeId),
    outcomeContributing: result.outcomeContributing.map((ref) => ref.knowledgeId),
  };
}

function mutateNegative(item, model) {
  const source = model.built.get(item.sourceTask);
  if (!source) throw new Error(`unknown negative source task: ${item.sourceTask}`);
  const events = clone(source.events);
  if (item.mutation === "REMOVE_OUTCOME") events.pop();
  else if (item.mutation === "LATE_EVENT") {
    events[1].receivedAtMs += 300001;
    rehashEvents(events, 1);
  }
  else if (item.mutation === "REPLAY_FIRST_EVENT") events.push(clone(events[0]));
  else if (item.mutation === "CROSS_SCOPE") {
    events[2].scopeRef = { scopeId: `scope:v1:${"b".repeat(64)}`, scopeDigest: "b".repeat(64) };
    rehashEvents(events, 2);
  }
  else if (item.mutation === "TAMPER_FACT") events[2].fact.knowledgeRef.knowledgeDigest = "a".repeat(64);
  if (item.mutation === "REMOVE_EVIDENCE") return { ...source.attributionInput, evidence: [] };
  if (item.mutation === "CHANGE_WITNESS_DIMENSION") return { ...source.attributionInput, evidence: [{ ...source.attributionInput.evidence[0], witness: { kind: "KNOWLEDGE_PROFILE", dimension: "SOURCE" } }] };
  if (item.mutation === "CHANGE_CERTAINTY") return { ...source.attributionInput, evidence: [{ ...source.attributionInput.evidence[0], cause: { ...source.attributionInput.evidence[0].cause, certainty: "POSSIBLE" } }] };
  if (item.mutation === "ADD_FOURTH_CAUSE") return { ...source.attributionInput, evidence: [...source.attributionInput.evidence, ...source.attributionInput.evidence, ...source.attributionInput.evidence] };
  return events;
}

function fail(message) {
  throw new Error(`CKS-08 synthetic score failed: ${message}`);
}

export function scoreSyntheticLineageFixture(fixture, groundTruth) {
  const validate = new Ajv2020({ allErrors: true, strict: true }).compile(readJson(pathFromRoot(DEFAULT_SCHEMA)));
  if (!validate(fixture)) fail(`fixture schema denied: ${JSON.stringify(validate.errors)}`);
  const model = buildSyntheticFixtureModel(fixture);
  const p14 = groundTruth.p14.tasks.map((expected) => {
    const built = model.built.get(expected.name);
    const result = reconstructCksLineageUsageV1(built?.events ?? []);
    if (result.status !== "RECONSTRUCTED") fail(`${expected.name} did not reconstruct`);
    const actual = expectedReconstruction(result);
    if (JSON.stringify(actual) !== JSON.stringify(expected.usage)) fail(`${expected.name} reconstruction ground truth mismatch`);
    return { name: expected.name, status: result.status };
  });
  const p15 = groundTruth.p15.groups.map((expected) => {
    const lineages = expected.taskNames.map((name) => model.built.get(name)?.events ?? []);
    const baseDimensions = profileFor(fixture.tasks.find((task) => task.name === expected.taskNames[0]), fixture).dimensions;
    const { generalization, operational } = baseDimensions;
    const report = computeCksLineageFeatureReportV1({
      scopeRef: fixture.scopeRef,
      knowledgeRef: fixture.knowledgeRefs.alpha,
      lineages,
      dimensions: { source: baseDimensions.source, applicability: baseDimensions.applicability, freshness: baseDimensions.freshness, contradiction: baseDimensions.contradiction },
      thresholds: fixture.thresholds,
    });
    if (report.status !== "REPORTED") fail(`${expected.name} did not report`);
    const actual = report.dimensions;
    const values = { validTaskOccurrenceCount: actual.generalization.validTaskOccurrenceCount, distinctTaskSemanticCount: actual.generalization.distinctTaskSemanticCount, distinctContextCount: actual.generalization.distinctContextCount, distinctJointUsageUnitCount: actual.generalization.distinctJointUsageUnitCount, identicalRepetitionCount: actual.generalization.identicalRepetitionCount, generalizationMarker: actual.generalization.marker, operationalMarker: actual.operational.marker };
    if (JSON.stringify(values) !== JSON.stringify(expected.metrics)) fail(`${expected.name} repetition/diversity ground truth mismatch`);
    return { name: expected.name, status: report.status, metrics: values };
  });
  const p16 = groundTruth.p16.cases.map((expected) => {
    const built = model.built.get(expected.name);
    const result = evaluateCksSeededFailureAttributionV1(built?.attributionInput);
    if (result.status !== "EVALUATED") fail(`${expected.name} attribution denied`);
    const actual = { outcomeClass: result.outcomeClass, causalMode: result.causalMode, causes: result.causes.map((cause) => ({ class: cause.class, subtype: cause.subtype, certainty: cause.certainty })) };
    const expectedShape = { outcomeClass: expected.outcomeClass, causalMode: expected.causalMode, causes: expected.causes };
    if (JSON.stringify(actual) !== JSON.stringify(expectedShape)) fail(`${expected.name} attribution ground truth mismatch`);
    return { name: expected.name, status: result.status, outcomeClass: result.outcomeClass, causalMode: result.causalMode };
  });
  const negatives = fixture.negativeCases.map((item) => {
    const candidate = mutateNegative(item, model);
    const result = Array.isArray(candidate) ? reconstructCksLineageUsageV1(candidate) : evaluateCksSeededFailureAttributionV1(candidate);
    if (result.status !== item.expectedStatus) fail(`${item.name} was not fail-closed`);
    return { name: item.name, status: result.status, reasonCodes: result.reasonCodes ?? [] };
  });
  return {
    schemaVersion: SYNTHETIC_LINEAGE_SCORE_SCHEMA_V1,
    status: "PASS",
    fixtureSchemaVersion: fixture.schemaVersion,
    metrics: { p14Reconstructed: p14.length, p15Groups: p15.length, p16Attributed: p16.length, deniedNegativeCases: negatives.length },
    p14,
    p15,
    p16,
    negatives,
  };
}

function parseArgs(args) {
  const fixtureIndex = args.indexOf("--fixture");
  const fixturePath = fixtureIndex >= 0 ? args[fixtureIndex + 1] : DEFAULT_CASES;
  if (!fixturePath || args.filter((arg) => arg === "--fixture").length > 1 || args.some((arg) => !["--dry-run", "--fixture", fixturePath].includes(arg))) throw new Error("usage: node scripts/cks-08-score-synthetic-lineage.mjs --fixture <path> --dry-run");
  return fixturePath;
}

const invoked = process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url));
if (invoked) {
  try {
    const fixturePath = parseArgs(process.argv.slice(2));
    const fixture = readJson(pathFromRoot(fixturePath));
    const groundTruth = readJson(pathFromRoot(DEFAULT_GROUND_TRUTH));
    process.stdout.write(`${JSON.stringify(scoreSyntheticLineageFixture(fixture, groundTruth), null, 2)}\n`);
  } catch (error) {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  }
}
