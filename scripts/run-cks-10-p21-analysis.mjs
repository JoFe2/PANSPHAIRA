#!/usr/bin/env node
/**
 * Deterministic local P21 analytic-fixture readback.
 *
 * The input is one admitted CKS-10 minimized projection. The companion
 * expected-output fixture is intentionally closed and pinned to the seven
 * synthetic signals in this slice. The analysis only reads bounded scalar or
 * aggregate fields, reproduces inert candidate records, and accepts edges
 * only when they are explicitly declared by the expected fixture. It does not
 * infer relationships, access the wall clock, call a service, write state, or
 * promote anything.
 *
 * Usage:
 *   node scripts/run-cks-10-p21-analysis.mjs tests/fixtures/cks-10/p21-planted-projection-v1.json
 */
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const EXPECTED_PATH = resolve(ROOT, "tests/fixtures/cks-10/p21-expected-candidates-v1.json");
const PROJECTION_SCHEMA_VERSION = "pansphaira.cks10/knowledge-projection/v1";
const PROJECTION_CONTRACT_ID = "cks-10/minimized-projection/v1";
const VERSION = "1.0.0";
const DIGEST_RE = /^[a-f0-9]{64}$/u;
const ID_RE = /^[A-Za-z][A-Za-z0-9._:-]{3,127}$/u;
const VERSION_RE = /^[0-9]+\.[0-9]+\.[0-9]+$/u;
const CLASS_RE = /^[A-Z][A-Z0-9_]{2,63}$/u;

const PROJECTION_CONTRACT_DIGEST = "5f7f38d9350863993c58d6cb0dddb25f17906298471f3b40b620255b0789f86e";
const FROZEN_BOUNDARY = {
  readOnly: true,
  authorityClass: "NONE",
  effectClass: "NONE",
  promotionClaim: "NONE",
  writeInstructionAllowed: false,
};
const FROZEN_EXCLUDED_FIELDS = [
  "SECRETS",
  "CREDENTIALS",
  "TOKENS_KEYS_COOKIES_OR_SIGNING_MATERIAL",
  "RAW_PROMPTS_COMPLETIONS_MESSAGES_OR_CHAIN_OF_THOUGHT",
  "RAW_MODEL_OR_TOOL_TRACES",
  "RAW_ROWS_SQL_FILES_OR_BINARY_BLOBS",
  "FULL_GOVERNED_ASSET_BODIES",
  "UNNECESSARY_PAYLOADS",
  "DIRECT_TENANT_CUSTOMER_USER_ACTOR_SESSION_HOST_PATH_URL_NETWORK_OR_PROVIDER_IDENTIFIERS_WHEN_OPAQUE_SCOPE_IDS_SUFFICE",
  "MUTABLE_POLICY_STATE",
  "MUTABLE_APPROVAL_AUTHORITY_LEASE_WORKFLOW_RUN_OR_INVALIDATION_STATE",
  "EXECUTABLE_CODE_COMMANDS_FUNCTION_BODIES_WORKFLOW_DEFINITIONS_OR_EFFECT_PAYLOADS",
  "CALLBACKS_ARBITRARY_ROUTES_HOSTS_OR_PATHS",
];
const REQUIRED_CLASSES = ["GAP", "CLUSTER", "CO_USAGE", "NEGATIVE_EVIDENCE", "PATTERN", "WORKFLOW", "DRIFT"];
const GLOBAL_BLIND_SPOTS = [
  "NO_LIVE_POLICY_OR_INVALIDATION_READBACK",
  "NO_CAUSAL_INFERENCE",
  "NO_CROSS_SCOPE_OR_CROSS_TENANT_JOIN",
  "NO_RAW_EVIDENCE_OR_EXECUTABLE_MATERIAL",
  "NO_DRIFT_ROOT_CAUSE_OR_REPAIR",
];
const CANDIDATE_BLIND_SPOTS = {
  GAP: ["NO_CAUSAL_EXPLANATION", "NO_LIVE_STATE_RECHECK"],
  CLUSTER: ["NO_CLUSTER_CAUSALITY", "NO_GENERALIZATION_BEYOND_PLANTED_SET"],
  CO_USAGE: ["NO_USAGE_INTENT", "NO_CROSS_SCOPE_REUSE"],
  NEGATIVE_EVIDENCE: ["ABSENCE_IS_NOT_PROOF", "NO_NEGATIVE_CONTROL_COVERAGE_OUTSIDE_SCOPE"],
  PATTERN: ["NO_PREDICTIVE_CLAIM", "NO_PATTERN_SEARCH_OUTSIDE_PLANTED_SET"],
  WORKFLOW: ["NO_WORKFLOW_DEFINITION", "NO_EXECUTION_OR_APPROVAL_BINDING"],
  DRIFT: ["NO_DRIFT_ROOT_CAUSE", "NO_REPAIR_OR_INVALIDATION_DECISION"],
};
const SIGNALS = [
  {
    candidateId: "p21-gap-290-0001",
    candidateClass: "GAP",
    evidenceId: "ev-p21-gap-290-0001",
    fieldId: "task.transition",
    signalCode: "UNRESOLVED_TASK_OUTCOME_TRANSITION",
    observation: { fieldClass: "SCALAR_FACT", value: "UNRESOLVED_TASK_OUTCOME_TRANSITION" },
  },
  {
    candidateId: "p21-cluster-290-0001",
    candidateClass: "CLUSTER",
    evidenceId: "ev-p21-cluster-290-0001",
    fieldId: "knowledge.cluster",
    signalCode: "RELATED_EVIDENCE_CLUSTER",
    observation: {
      fieldClass: "AGGREGATE_MEASURE",
      value: { measureClass: "RELATED_EVIDENCE_CLUSTER", statistic: "COUNT", value: 2, sampleCount: 2 },
    },
  },
  {
    candidateId: "p21-co-usage-290-0001",
    candidateClass: "CO_USAGE",
    evidenceId: "ev-p21-co-usage-290-0001",
    fieldId: "decision.cousage",
    signalCode: "SHARED_SCOPE_USAGE",
    observation: { fieldClass: "SCALAR_FACT", value: "SHARED_SCOPE_USAGE" },
  },
  {
    candidateId: "p21-negative-evidence-290-0001",
    candidateClass: "NEGATIVE_EVIDENCE",
    evidenceId: "ev-p21-negative-evidence-290-0001",
    fieldId: "outcome.negative",
    signalCode: "ABSENT_EXPECTED_LINK",
    observation: {
      fieldClass: "AGGREGATE_MEASURE",
      value: { measureClass: "ABSENT_EXPECTED_LINK", statistic: "COUNT", value: 0, sampleCount: 1 },
    },
  },
  {
    candidateId: "p21-pattern-290-0001",
    candidateClass: "PATTERN",
    evidenceId: "ev-p21-pattern-290-0001",
    fieldId: "knowledge.pattern",
    signalCode: "REPEATED_ORDER_PATTERN",
    observation: { fieldClass: "SCALAR_FACT", value: "REPEATED_ORDER_PATTERN" },
  },
  {
    candidateId: "p21-workflow-290-0001",
    candidateClass: "WORKFLOW",
    evidenceId: "ev-p21-workflow-290-0001",
    fieldId: "task.workflow",
    signalCode: "DECLARATIVE_WORKFLOW_GAP",
    observation: { fieldClass: "SCALAR_FACT", value: "DECLARATIVE_WORKFLOW_GAP" },
  },
  {
    candidateId: "p21-drift-290-0001",
    candidateClass: "DRIFT",
    evidenceId: "ev-p21-drift-290-0001",
    fieldId: "decision.drift",
    signalCode: "SOURCE_DIGEST_DRIFT_SIGNAL",
    observation: { fieldClass: "SCALAR_FACT", value: "SOURCE_DIGEST_DRIFT_SIGNAL" },
  },
];
const EDGE_DEFINITIONS = [
  {
    edgeId: "edge-p21-negative-gap-290-0001",
    sourceEvidenceId: "ev-p21-negative-evidence-290-0001",
    targetEvidenceId: "ev-p21-gap-290-0001",
    relationClass: "CONTRASTS",
  },
  {
    edgeId: "edge-p21-gap-cluster-290-0001",
    sourceEvidenceId: "ev-p21-gap-290-0001",
    targetEvidenceId: "ev-p21-cluster-290-0001",
    relationClass: "RELATED_SIGNAL",
  },
  {
    edgeId: "edge-p21-cluster-cousage-290-0001",
    sourceEvidenceId: "ev-p21-cluster-290-0001",
    targetEvidenceId: "ev-p21-co-usage-290-0001",
    relationClass: "SHARED_SCOPE_SIGNAL",
  },
  {
    edgeId: "edge-p21-drift-pattern-290-0001",
    sourceEvidenceId: "ev-p21-drift-290-0001",
    targetEvidenceId: "ev-p21-pattern-290-0001",
    relationClass: "DRIFT_CONTEXT",
  },
  {
    edgeId: "edge-p21-pattern-workflow-290-0001",
    sourceEvidenceId: "ev-p21-pattern-290-0001",
    targetEvidenceId: "ev-p21-workflow-290-0001",
    relationClass: "SUGGESTS_REVIEW",
  },
];
const CANDIDATE_RELATIONS = {
  GAP: {
    evidenceIds: ["ev-p21-negative-evidence-290-0001", "ev-p21-gap-290-0001", "ev-p21-cluster-290-0001"],
    edgeIds: ["edge-p21-negative-gap-290-0001", "edge-p21-gap-cluster-290-0001"],
  },
  CLUSTER: {
    evidenceIds: ["ev-p21-gap-290-0001", "ev-p21-cluster-290-0001", "ev-p21-co-usage-290-0001"],
    edgeIds: ["edge-p21-gap-cluster-290-0001", "edge-p21-cluster-cousage-290-0001"],
  },
  CO_USAGE: {
    evidenceIds: ["ev-p21-cluster-290-0001", "ev-p21-co-usage-290-0001"],
    edgeIds: ["edge-p21-cluster-cousage-290-0001"],
  },
  NEGATIVE_EVIDENCE: {
    evidenceIds: ["ev-p21-negative-evidence-290-0001", "ev-p21-gap-290-0001"],
    edgeIds: ["edge-p21-negative-gap-290-0001"],
  },
  PATTERN: {
    evidenceIds: ["ev-p21-drift-290-0001", "ev-p21-pattern-290-0001", "ev-p21-workflow-290-0001"],
    edgeIds: ["edge-p21-drift-pattern-290-0001", "edge-p21-pattern-workflow-290-0001"],
  },
  WORKFLOW: {
    evidenceIds: ["ev-p21-pattern-290-0001", "ev-p21-workflow-290-0001"],
    edgeIds: ["edge-p21-pattern-workflow-290-0001"],
  },
  DRIFT: {
    evidenceIds: ["ev-p21-drift-290-0001", "ev-p21-pattern-290-0001"],
    edgeIds: ["edge-p21-drift-pattern-290-0001"],
  },
};

const isObject = (value) => value !== null && typeof value === "object" && !Array.isArray(value);
function canonicalize(value) {
  if (Array.isArray(value)) return `[${value.map(canonicalize).join(",")}]`;
  if (isObject(value)) return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonicalize(value[key])}`).join(",")}}`;
  return JSON.stringify(value);
}
const sha256 = (value) => createHash("sha256").update(typeof value === "string" ? value : canonicalize(value)).digest("hex");
function digestWithout(value, key) {
  const copy = structuredClone(value);
  delete copy[key];
  return sha256(copy);
}
function sameValue(left, right) {
  return canonicalize(left) === canonicalize(right);
}
function exactKeys(value, keys, path, issues) {
  if (!isObject(value)) {
    issues.push(`OBJECT_REQUIRED:${path}`);
    return;
  }
  const allowed = new Set(keys);
  for (const key of Object.keys(value)) if (!allowed.has(key)) issues.push(`UNKNOWN_FIELD:${path}.${key}`);
}
function required(value, keys, path, issues) {
  if (!isObject(value)) return;
  for (const key of keys) if (!Object.hasOwn(value, key)) issues.push(`MISSING_FIELD:${path}.${key}`);
}
function stringField(value, key, path, pattern, issues) {
  if (typeof value?.[key] !== "string" || !pattern.test(value[key])) issues.push(`INVALID_FIELD:${path}.${key}`);
}
function validateDigest(value, key, path, issues, expected = null) {
  stringField(value, key, path, DIGEST_RE, issues);
  if (typeof value?.[key] === "string" && DIGEST_RE.test(value[key])) {
    if (digestWithout(value, key) !== value[key]) issues.push(`DIGEST_MISMATCH:${path}.${key}`);
    if (expected !== null && value[key] !== expected) issues.push(`DIGEST_NOT_PINNED:${path}.${key}`);
  }
}
function validateProjection(projection, issues) {
  exactKeys(projection, ["schemaVersion", "contract", "exchange", "producer", "intendedConsumer", "tenantScope", "purpose", "records", "time", "boundary", "excludedFields"], "projection", issues);
  required(projection, ["schemaVersion", "contract", "exchange", "producer", "intendedConsumer", "tenantScope", "purpose", "records", "time", "boundary", "excludedFields"], "projection", issues);
  if (projection.schemaVersion !== PROJECTION_SCHEMA_VERSION) issues.push("PROJECTION_SCHEMA_VERSION_UNSUPPORTED");
  exactKeys(projection.contract, ["contractId", "contractVersion", "contractSchemaDigest"], "projection.contract", issues);
  if (projection.contract?.contractId !== PROJECTION_CONTRACT_ID || projection.contract?.contractVersion !== VERSION) issues.push("PROJECTION_CONTRACT_UNSUPPORTED");
  if (projection.contract?.contractSchemaDigest !== PROJECTION_CONTRACT_DIGEST) issues.push("PROJECTION_SCHEMA_DIGEST_UNSUPPORTED");
  exactKeys(projection.exchange, ["exchangeId", "projectionId", "projectionVersion", "projectionDigest", "replayId"], "projection.exchange", issues);
  for (const key of ["exchangeId", "projectionId", "replayId"]) stringField(projection.exchange, key, "projection.exchange", ID_RE, issues);
  stringField(projection.exchange, "projectionVersion", "projection.exchange", VERSION_RE, issues);
  stringField(projection.exchange, "projectionDigest", "projection.exchange", DIGEST_RE, issues);
  exactKeys(projection.producer, ["producerId", "producerVersion", "producerDigest"], "projection.producer", issues);
  exactKeys(projection.intendedConsumer, ["consumerId", "consumerVersion", "consumerDigest"], "projection.intendedConsumer", issues);
  exactKeys(projection.tenantScope, ["opaqueTenantScopeId", "scope", "scopeDecision"], "projection.tenantScope", issues);
  exactKeys(projection.tenantScope?.scope, ["scopeId", "scopeVersion", "scopeDigest"], "projection.tenantScope.scope", issues);
  exactKeys(projection.tenantScope?.scopeDecision, ["decisionId", "decisionVersion", "decisionDigest"], "projection.tenantScope.scopeDecision", issues);
  exactKeys(projection.purpose, ["purposeClass", "purposeRegistry"], "projection.purpose", issues);
  if (projection.purpose?.purposeClass !== "CKS10_ANALYTICS_EXPLORATION") issues.push("PROJECTION_PURPOSE_UNSUPPORTED");
  if (!sameValue(projection.boundary, FROZEN_BOUNDARY)) issues.push("PROJECTION_BOUNDARY_MISMATCH");
  if (!sameValue(projection.excludedFields, FROZEN_EXCLUDED_FIELDS)) issues.push("PROJECTION_EXCLUDED_FIELDS_MISMATCH");
  if (!Array.isArray(projection.records) || projection.records.length !== 4) issues.push("PROJECTION_RECORD_SET_MISMATCH");
  const recordClasses = new Set();
  const fieldIds = new Set();
  for (const [index, record] of (Array.isArray(projection.records) ? projection.records : []).entries()) {
    const path = `projection.records[${index}]`;
    exactKeys(record, ["recordId", "recordClass", "assetId", "assetVersion", "assetDigest", "assetClass", "dataClassification", "evidenceClass", "sources", "fields"], path, issues);
    required(record, ["recordId", "recordClass", "assetId", "assetVersion", "assetDigest", "assetClass", "dataClassification", "evidenceClass", "sources", "fields"], path, issues);
    if (typeof record?.recordClass === "string") recordClasses.add(record.recordClass);
    if (!Array.isArray(record?.sources) || record.sources.length !== 1) issues.push(`SOURCE_SET_MISMATCH:${path}`);
    const source = record?.sources?.[0];
    if (!sameValue(source, {
      sourceRefId: source?.sourceRefId,
      assetId: record?.assetId,
      assetVersion: record?.assetVersion,
      assetDigest: record?.assetDigest,
      assetClass: record?.assetClass,
      dataClassification: record?.dataClassification,
      evidenceClass: record?.evidenceClass,
      provenanceDigest: source?.provenanceDigest,
    })) issues.push(`SOURCE_RECORD_BINDING_MISMATCH:${path}`);
    for (const [fieldIndex, field] of (Array.isArray(record?.fields) ? record.fields : []).entries()) {
      const fieldPath = `${path}.fields[${fieldIndex}]`;
      exactKeys(field, ["fieldId", "fieldVersion", "fieldClass", "value", "sourceRefId"], fieldPath, issues);
      required(field, ["fieldId", "fieldVersion", "fieldClass", "value", "sourceRefId"], fieldPath, issues);
      if (typeof field?.fieldId === "string") {
        if (fieldIds.has(field.fieldId)) issues.push(`DUPLICATE_FIELD_ID:${field.fieldId}`);
        fieldIds.add(field.fieldId);
      }
      if (field?.sourceRefId !== source?.sourceRefId) issues.push(`FIELD_SOURCE_MISMATCH:${fieldPath}`);
    }
  }
  if (!sameValue([...recordClasses].sort(), ["DECISION", "KNOWLEDGE", "OUTCOME", "TASK"])) issues.push("PROJECTION_RECORD_CLASSES_MISMATCH");
  if (typeof projection.exchange?.projectionDigest === "string" && DIGEST_RE.test(projection.exchange.projectionDigest)) {
    const withoutDigest = structuredClone(projection);
    delete withoutDigest.exchange.projectionDigest;
    if (sha256(withoutDigest) !== projection.exchange.projectionDigest) issues.push("PROJECTION_DIGEST_MISMATCH");
  }
}
function validateExpected(expected, projection, issues) {
  exactKeys(expected, ["schemaVersion", "projectionBinding", "globalBlindSpots", "allowedEvidenceEdges", "evidence", "candidates", "inventedEdges", "fixtureDigest"], "expected", issues);
  required(expected, ["schemaVersion", "projectionBinding", "globalBlindSpots", "allowedEvidenceEdges", "evidence", "candidates", "inventedEdges", "fixtureDigest"], "expected", issues);
  if (expected.schemaVersion !== "pansphaira.cks10/p21-expected-candidates/v1") issues.push("EXPECTED_SCHEMA_VERSION_UNSUPPORTED");
  const binding = expected.projectionBinding;
  exactKeys(binding, ["contractId", "contractVersion", "projectionId", "projectionVersion", "projectionDigest", "replayId", "opaqueTenantScopeId", "scopeId", "scopeVersion", "purposeClass"], "expected.projectionBinding", issues);
  const expectedBinding = {
    contractId: projection.contract?.contractId,
    contractVersion: projection.contract?.contractVersion,
    projectionId: projection.exchange?.projectionId,
    projectionVersion: projection.exchange?.projectionVersion,
    projectionDigest: projection.exchange?.projectionDigest,
    replayId: projection.exchange?.replayId,
    opaqueTenantScopeId: projection.tenantScope?.opaqueTenantScopeId,
    scopeId: projection.tenantScope?.scope?.scopeId,
    scopeVersion: projection.tenantScope?.scope?.scopeVersion,
    purposeClass: projection.purpose?.purposeClass,
  };
  if (!sameValue(binding, expectedBinding)) issues.push("PROJECTION_BINDING_MISMATCH");
  validateDigest(expected, "fixtureDigest", "expected", issues);
  if (!Array.isArray(expected.globalBlindSpots) || !sameValue(expected.globalBlindSpots, GLOBAL_BLIND_SPOTS)) issues.push("GLOBAL_BLIND_SPOTS_MISMATCH");
  if (expected.inventedEdges !== 0) issues.push("INVENTED_EDGES_NONZERO");
  const evidenceById = new Map();
  if (!Array.isArray(expected.evidence) || expected.evidence.length !== SIGNALS.length) issues.push("EVIDENCE_COUNT_MISMATCH");
  for (const [index, evidence] of (Array.isArray(expected.evidence) ? expected.evidence : []).entries()) {
    const path = `expected.evidence[${index}]`;
    exactKeys(evidence, ["evidenceId", "evidenceVersion", "evidenceDigest", "evidenceClass", "signalCode", "sourceRecordId", "sourceFieldId", "observation", "declaredEdgeIds"], path, issues);
    required(evidence, ["evidenceId", "evidenceVersion", "evidenceDigest", "evidenceClass", "signalCode", "sourceRecordId", "sourceFieldId", "observation", "declaredEdgeIds"], path, issues);
    stringField(evidence, "evidenceId", path, ID_RE, issues);
    if (evidence?.evidenceVersion !== VERSION) issues.push(`UNSUPPORTED_VERSION:${path}.evidenceVersion`);
    validateDigest(evidence, "evidenceDigest", path, issues);
    if (evidence?.evidenceClass !== "PLANTED_PROJECTION_SIGNAL") issues.push(`EVIDENCE_CLASS_MISMATCH:${path}`);
    if (typeof evidence?.evidenceId === "string") evidenceById.set(evidence.evidenceId, evidence);
  }
  const observed = new Map();
  const allFields = (Array.isArray(projection.records) ? projection.records : []).flatMap((record) =>
    (Array.isArray(record.fields) ? record.fields : []).map((field) => ({ record, field })));
  for (const signal of SIGNALS) {
    const matches = allFields.filter(({ field }) => field?.fieldId === signal.fieldId && field?.fieldClass === signal.observation.fieldClass && sameValue(field.value, signal.observation.value));
    if (matches.length !== 1) issues.push(`PLANTED_SIGNAL_COUNT_MISMATCH:${signal.candidateClass}`);
    if (matches.length === 1) {
      const match = matches[0];
      observed.set(signal.evidenceId, { recordId: match.record.recordId, fieldId: match.field.fieldId, observation: signal.observation });
      const evidence = evidenceById.get(signal.evidenceId);
      if (!evidence || evidence.signalCode !== signal.signalCode || evidence.sourceRecordId !== match.record.recordId ||
        evidence.sourceFieldId !== match.field.fieldId || !sameValue(evidence.observation, signal.observation)) {
        issues.push(`PLANTED_EVIDENCE_MISMATCH:${signal.candidateClass}`);
      }
    }
  }
  if (!sameValue([...evidenceById.keys()], SIGNALS.map((signal) => signal.evidenceId))) issues.push("EVIDENCE_ID_SET_MISMATCH");
  const edgeById = new Map();
  if (!Array.isArray(expected.allowedEvidenceEdges) || expected.allowedEvidenceEdges.length !== EDGE_DEFINITIONS.length) issues.push("ALLOWED_EDGE_COUNT_MISMATCH");
  for (const [index, edge] of (Array.isArray(expected.allowedEvidenceEdges) ? expected.allowedEvidenceEdges : []).entries()) {
    const path = `expected.allowedEvidenceEdges[${index}]`;
    exactKeys(edge, ["edgeId", "edgeVersion", "edgeDigest", "sourceEvidenceId", "targetEvidenceId", "relationClass", "declaredByEvidenceId", "explicit"], path, issues);
    required(edge, ["edgeId", "edgeVersion", "edgeDigest", "sourceEvidenceId", "targetEvidenceId", "relationClass", "declaredByEvidenceId", "explicit"], path, issues);
    if (edge?.edgeVersion !== VERSION) issues.push(`UNSUPPORTED_VERSION:${path}.edgeVersion`);
    validateDigest(edge, "edgeDigest", path, issues);
    if (edge?.explicit !== true) issues.push(`EDGE_NOT_EXPLICIT:${path}`);
    if (typeof edge?.edgeId === "string") edgeById.set(edge.edgeId, edge);
  }
  for (const definition of EDGE_DEFINITIONS) {
    const edge = edgeById.get(definition.edgeId);
    if (!edge || edge.sourceEvidenceId !== definition.sourceEvidenceId || edge.targetEvidenceId !== definition.targetEvidenceId ||
      edge.relationClass !== definition.relationClass || edge.declaredByEvidenceId !== definition.sourceEvidenceId || edge.explicit !== true) {
      issues.push(`ALLOWED_EDGE_MISMATCH:${definition.edgeId}`);
    }
    if (edge && !evidenceById.has(edge.sourceEvidenceId) && !evidenceById.has(edge.targetEvidenceId)) issues.push(`EDGE_OUT_OF_SCOPE:${definition.edgeId}`);
  }
  if (!sameValue([...edgeById.keys()], EDGE_DEFINITIONS.map((edge) => edge.edgeId))) issues.push("ALLOWED_EDGE_SET_MISMATCH");
  for (const evidence of (Array.isArray(expected.evidence) ? expected.evidence : [])) {
    for (const edgeId of (Array.isArray(evidence?.declaredEdgeIds) ? evidence.declaredEdgeIds : [])) {
      const edge = edgeById.get(edgeId);
      if (!edge || edge.declaredByEvidenceId !== evidence.evidenceId) issues.push(`EDGE_NOT_WITNESSED:${evidence.evidenceId}:${edgeId}`);
    }
  }
  const candidateById = new Map();
  if (!Array.isArray(expected.candidates) || expected.candidates.length !== SIGNALS.length) issues.push("CANDIDATE_COUNT_MISMATCH");
  for (const [index, candidate] of (Array.isArray(expected.candidates) ? expected.candidates : []).entries()) {
    const path = `expected.candidates[${index}]`;
    exactKeys(candidate, ["candidateId", "candidateVersion", "candidateDigest", "candidateClass", "signalCode", "evidenceIds", "edgeIds", "blindSpots", "reproduction"], path, issues);
    required(candidate, ["candidateId", "candidateVersion", "candidateDigest", "candidateClass", "signalCode", "evidenceIds", "edgeIds", "blindSpots", "reproduction"], path, issues);
    stringField(candidate, "candidateId", path, ID_RE, issues);
    if (candidate?.candidateVersion !== VERSION) issues.push(`UNSUPPORTED_VERSION:${path}.candidateVersion`);
    validateDigest(candidate, "candidateDigest", path, issues);
    if (!CLASS_RE.test(candidate?.candidateClass ?? "") || !REQUIRED_CLASSES.includes(candidate.candidateClass)) issues.push(`CANDIDATE_CLASS_UNSUPPORTED:${path}`);
    const signal = SIGNALS.find((item) => item.candidateClass === candidate?.candidateClass);
    const relations = CANDIDATE_RELATIONS[candidate?.candidateClass];
    if (!signal || candidate.candidateId !== signal.candidateId || candidate.signalCode !== signal.signalCode ||
      !sameValue(candidate.evidenceIds, relations?.evidenceIds) || !sameValue(candidate.edgeIds, relations?.edgeIds) ||
      !sameValue(candidate.blindSpots, CANDIDATE_BLIND_SPOTS[candidate.candidateClass])) {
      issues.push(`PLANTED_CANDIDATE_MISMATCH:${path}`);
    }
    if (!Array.isArray(candidate?.blindSpots) || candidate.blindSpots.length === 0 || new Set(candidate.blindSpots).size !== candidate.blindSpots.length ||
      candidate.blindSpots.some((spot) => typeof spot !== "string" || !CLASS_RE.test(spot))) issues.push(`BLIND_SPOTS_MISSING:${path}`);
    if (candidate?.reproduction !== "PLANTED_PROJECTION_SIGNAL") issues.push(`REPRODUCTION_NOT_PLANTED:${path}`);
    for (const evidenceId of (Array.isArray(candidate?.evidenceIds) ? candidate.evidenceIds : [])) if (!evidenceById.has(evidenceId)) issues.push(`CANDIDATE_EVIDENCE_OUT_OF_SCOPE:${path}`);
    for (const edgeId of (Array.isArray(candidate?.edgeIds) ? candidate.edgeIds : [])) {
      const edge = edgeById.get(edgeId);
      if (!edge || !candidate.evidenceIds.includes(edge.sourceEvidenceId) || !candidate.evidenceIds.includes(edge.targetEvidenceId)) issues.push(`INVENTED_EDGE:${path}`);
    }
    if (typeof candidate?.candidateId === "string") candidateById.set(candidate.candidateId, candidate);
  }
  if (!sameValue([...candidateById.keys()], SIGNALS.map((signal) => signal.candidateId))) issues.push("CANDIDATE_ID_SET_MISMATCH");
  if (!sameValue([...candidateById.values()].map((candidate) => candidate.candidateClass), REQUIRED_CLASSES)) issues.push("CANDIDATE_CLASS_SET_MISMATCH");
  if (observed.size !== SIGNALS.length) issues.push("PLANTED_CANDIDATES_NOT_REPRODUCED");
}
function loadJson(path, issues, label) {
  try {
    return JSON.parse(readFileSync(path, "utf8"));
  } catch (error) {
    issues.push(`${label}_${error?.code === "ENOENT" ? "MISSING_FILE" : "INVALID_JSON"}`);
    return null;
  }
}
function main(argv) {
  const args = argv.slice(2);
  if (args.length !== 1 || args[0] === "--help" || args[0] === "-h") {
    console.error("usage: node scripts/run-cks-10-p21-analysis.mjs <projection.json>");
    return 2;
  }
  const projectionPath = resolve(process.cwd(), args[0]);
  const issues = [];
  const projection = loadJson(projectionPath, issues, "PROJECTION");
  const expected = loadJson(EXPECTED_PATH, issues, "EXPECTED");
  if (projection !== null) validateProjection(projection, issues);
  if (expected !== null && projection !== null) validateExpected(expected, projection, issues);
  const uniqueIssues = [...new Set(issues)].sort();
  if (uniqueIssues.length > 0) {
    for (const issue of uniqueIssues) console.log(`cks-10-p21-analysis: ISSUE ${issue}`);
    console.log(`cks-10-p21-analysis: FAIL projection=${projectionPath} issues=${uniqueIssues.length}`);
    return 1;
  }
  console.log(`cks-10-p21-analysis: PASS projection=${projectionPath} candidates=${SIGNALS.length} evidence=${SIGNALS.length} allowedEdges=${EDGE_DEFINITIONS.length} inventedEdges=0 issues=0`);
  return 0;
}

process.exitCode = main(process.argv);
