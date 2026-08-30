#!/usr/bin/env node
/**
 * Deterministic CKS-10 P21 replay validator.
 *
 * P21 is deliberately a closed replay over one admitted minimized projection.
 * It reproduces only the planted signals from exact projection/source digests,
 * checks every emitted evidence edge against the explicit allowlist, verifies
 * global and per-candidate blind spots, and treats every candidate as inert
 * review material. No candidate can grant Authority or promote a governed
 * Knowledge, Workflow, or Function.
 *
 * The validator has no wall-clock, network, filesystem, policy, or lifecycle
 * access beyond the files supplied by its CLI. Callers must provide a trusted
 * integer clock and a replay Map; unavailable guards therefore fail closed.
 *
 * Usage:
 *   node scripts/verify-cks-10-p21-replay.mjs
 *   node scripts/verify-cks-10-p21-replay.mjs <projection.json> <expected.json> [emitted.json]
 */
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { verifyProjectionEnvelope } from "../src/cks-10/projection-envelope-guards.mjs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const DEFAULT_PROJECTION = resolve(ROOT, "tests/fixtures/cks-10/p21-planted-projection-v1.json");
const DEFAULT_EXPECTED = resolve(ROOT, "tests/fixtures/cks-10/p21-expected-candidates-v1.json");
const VERSION = "1.0.0";
const EXPECTED_SCHEMA_VERSION = "pansphaira.cks10/p21-expected-candidates/v1";
const PURPOSE_CLASS = "CKS10_ANALYTICS_EXPLORATION";
const DIGEST_RE = /^[a-f0-9]{64}$/u;
const ID_RE = /^[A-Za-z][A-Za-z0-9._:-]{3,127}$/u;
const CLASS_RE = /^[A-Z][A-Z0-9_]{2,63}$/u;
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
  ["edge-p21-negative-gap-290-0001", "ev-p21-negative-evidence-290-0001", "ev-p21-gap-290-0001", "CONTRASTS"],
  ["edge-p21-gap-cluster-290-0001", "ev-p21-gap-290-0001", "ev-p21-cluster-290-0001", "RELATED_SIGNAL"],
  ["edge-p21-cluster-cousage-290-0001", "ev-p21-cluster-290-0001", "ev-p21-co-usage-290-0001", "SHARED_SCOPE_SIGNAL"],
  ["edge-p21-drift-pattern-290-0001", "ev-p21-drift-290-0001", "ev-p21-pattern-290-0001", "DRIFT_CONTEXT"],
  ["edge-p21-pattern-workflow-290-0001", "ev-p21-pattern-290-0001", "ev-p21-workflow-290-0001", "SUGGESTS_REVIEW"],
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
const FROZEN_RETURN_BOUNDARY = {
  lifecycleClass: "UNTRUSTED_CANDIDATE",
  authorityClass: "NONE",
  effectClass: "NONE",
  requestedDisposition: "REVIEW_ONLY",
  promotionClaim: "NONE",
};
const FORBIDDEN_KEY_RE = /(authority|approval|promotion|capability|action|effect|execute|invoke)/iu;

const isObject = (value) => value !== null && typeof value === "object" && !Array.isArray(value);

/** Canonical JSON sorts object keys recursively and preserves array order. */
export function canonicalize(value) {
  if (Array.isArray(value)) return `[${value.map(canonicalize).join(",")}]`;
  if (isObject(value)) return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonicalize(value[key])}`).join(",")}}`;
  return JSON.stringify(value);
}

export function sha256(value) {
  return createHash("sha256").update(typeof value === "string" ? value : canonicalize(value)).digest("hex");
}

function sameValue(left, right) {
  return canonicalize(left) === canonicalize(right);
}

function digestWithout(value, key) {
  const copy = structuredClone(value);
  delete copy[key];
  return sha256(copy);
}

function addIssue(issues, code) {
  if (!issues.includes(code)) issues.push(code);
}

function exactKeys(value, keys, code, issues) {
  if (!isObject(value)) {
    addIssue(issues, code);
    return;
  }
  const allowed = new Set(keys);
  for (const key of Object.keys(value)) if (!allowed.has(key)) addIssue(issues, `${code}:${key}`);
}

function bindingFromProjection(projection) {
  return {
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
}

function observedSignals(projection, issues) {
  const fields = (Array.isArray(projection?.records) ? projection.records : []).flatMap((record) =>
    (Array.isArray(record?.fields) ? record.fields : []).map((field) => ({ record, field })));
  return SIGNALS.map((signal) => {
    const matches = fields.filter(({ field }) => field?.fieldId === signal.fieldId &&
      field?.fieldClass === signal.observation.fieldClass && sameValue(field.value, signal.observation.value));
    if (matches.length !== 1) {
      addIssue(issues, `PLANTED_SIGNAL_COUNT_MISMATCH:${signal.candidateClass}`);
      return null;
    }
    const match = matches[0];
    return {
      signal,
      recordId: match.record.recordId,
      fieldId: match.field.fieldId,
      sourceRefId: match.field.sourceRefId,
      assetId: match.record.assetId,
      assetVersion: match.record.assetVersion,
      assetDigest: match.record.assetDigest,
    };
  });
}

function buildExpected(projection, issues) {
  const observed = observedSignals(projection, issues);
  const evidence = SIGNALS.map((signal, index) => {
    const match = observed[index];
    const edgeIds = EDGE_DEFINITIONS.filter(([, sourceEvidenceId]) => sourceEvidenceId === signal.evidenceId).map(([edgeId]) => edgeId);
    const item = {
      evidenceId: signal.evidenceId,
      evidenceVersion: VERSION,
      evidenceDigest: "",
      evidenceClass: "PLANTED_PROJECTION_SIGNAL",
      signalCode: signal.signalCode,
      sourceRecordId: match?.recordId,
      sourceFieldId: match?.fieldId,
      observation: signal.observation,
      declaredEdgeIds: edgeIds,
    };
    item.evidenceDigest = digestWithout(item, "evidenceDigest");
    return item;
  });
  const allowedEvidenceEdges = EDGE_DEFINITIONS.map(([edgeId, sourceEvidenceId, targetEvidenceId, relationClass]) => {
    const edge = {
      edgeId,
      edgeVersion: VERSION,
      edgeDigest: "",
      sourceEvidenceId,
      targetEvidenceId,
      relationClass,
      declaredByEvidenceId: sourceEvidenceId,
      explicit: true,
    };
    edge.edgeDigest = digestWithout(edge, "edgeDigest");
    return edge;
  });
  const candidates = SIGNALS.map((signal) => {
    const relations = CANDIDATE_RELATIONS[signal.candidateClass];
    const candidate = {
      candidateId: signal.candidateId,
      candidateVersion: VERSION,
      candidateDigest: "",
      candidateClass: signal.candidateClass,
      signalCode: signal.signalCode,
      evidenceIds: relations.evidenceIds,
      edgeIds: relations.edgeIds,
      blindSpots: CANDIDATE_BLIND_SPOTS[signal.candidateClass],
      reproduction: "PLANTED_PROJECTION_SIGNAL",
    };
    candidate.candidateDigest = digestWithout(candidate, "candidateDigest");
    return candidate;
  });
  const result = {
    schemaVersion: EXPECTED_SCHEMA_VERSION,
    projectionBinding: bindingFromProjection(projection),
    globalBlindSpots: GLOBAL_BLIND_SPOTS,
    allowedEvidenceEdges,
    evidence,
    candidates,
    inventedEdges: 0,
    fixtureDigest: "",
  };
  result.fixtureDigest = digestWithout(result, "fixtureDigest");
  return result;
}

function forbiddenKeyIssues(value, pointer, issues) {
  if (Array.isArray(value)) {
    value.forEach((item, index) => forbiddenKeyIssues(item, `${pointer}/${index}`, issues));
    return;
  }
  if (!isObject(value)) return;
  for (const [key, child] of Object.entries(value)) {
    if (FORBIDDEN_KEY_RE.test(key)) addIssue(issues, `AUTHORITY_BEARING_FIELD:${pointer}/${key}`);
    forbiddenKeyIssues(child, `${pointer}/${key}`, issues);
  }
}

function selfDigestIssues(items, key, prefix, issues) {
  if (!Array.isArray(items)) return;
  for (const [index, item] of items.entries()) {
    if (!isObject(item) || typeof item[key] !== "string" || !DIGEST_RE.test(item[key])) {
      addIssue(issues, `${prefix}_DIGEST_INVALID:${index}`);
    } else if (digestWithout(item, key) !== item[key]) {
      addIssue(issues, `${prefix}_DIGEST_MISMATCH:${index}`);
    }
  }
}

function edgeIssues(emitted, generated, issues) {
  const allowed = new Map((generated.allowedEvidenceEdges ?? []).map((edge) => [edge.edgeId, edge]));
  const evidenceIds = new Set((generated.evidence ?? []).map((evidence) => evidence.evidenceId));
  const emittedEdges = Array.isArray(emitted?.allowedEvidenceEdges) ? emitted.allowedEvidenceEdges : [];
  for (const edge of emittedEdges) {
    const expected = allowed.get(edge?.edgeId);
    if (!expected) {
      addIssue(issues, `INVENTED_EDGE:${edge?.edgeId ?? "MISSING_ID"}`);
      continue;
    }
    if (!sameValue(edge, expected)) addIssue(issues, `ALLOWED_EDGE_MISMATCH:${edge.edgeId}`);
    if (edge.explicit !== true) addIssue(issues, `EDGE_NOT_EXPLICIT:${edge.edgeId}`);
    if (!evidenceIds.has(edge.sourceEvidenceId) || !evidenceIds.has(edge.targetEvidenceId)) {
      addIssue(issues, `EDGE_OUT_OF_SCOPE:${edge.edgeId}`);
    }
    if (edge.declaredByEvidenceId !== edge.sourceEvidenceId) addIssue(issues, `EDGE_NOT_WITNESSED:${edge.edgeId}`);
  }
  if (emittedEdges.length !== generated.allowedEvidenceEdges.length) addIssue(issues, "ALLOWED_EDGE_SET_MISMATCH");
  const emittedIds = emittedEdges.map((edge) => edge?.edgeId);
  const generatedIds = generated.allowedEvidenceEdges.map((edge) => edge.edgeId);
  if (!sameValue(emittedIds, generatedIds)) addIssue(issues, "ALLOWED_EDGE_SET_MISMATCH");
  const emittedEvidence = Array.isArray(emitted?.evidence) ? emitted.evidence : [];
  const witnessed = new Map(emittedEvidence.map((evidence) => [evidence?.evidenceId, evidence]));
  for (const evidence of emittedEvidence) {
    for (const edgeId of (Array.isArray(evidence?.declaredEdgeIds) ? evidence.declaredEdgeIds : [])) {
      const edge = allowed.get(edgeId);
      if (!edge || edge.declaredByEvidenceId !== evidence.evidenceId) addIssue(issues, `EDGE_NOT_WITNESSED:${evidence.evidenceId}:${edgeId}`);
    }
  }
  for (const edge of generated.allowedEvidenceEdges) {
    const sourceEvidence = witnessed.get(edge.declaredByEvidenceId);
    if (!sourceEvidence) {
      addIssue(issues, `EDGE_WITNESS_MISSING:${edge.edgeId}`);
    } else if (!Array.isArray(sourceEvidence.declaredEdgeIds) || !sourceEvidence.declaredEdgeIds.includes(edge.edgeId)) {
      addIssue(issues, `EDGE_NOT_WITNESSED:${edge.edgeId}`);
    }
  }
}

function scopeIssues(emitted, projection, generated, issues) {
  if (!sameValue(emitted?.projectionBinding, generated.projectionBinding)) addIssue(issues, "CANDIDATE_SCOPE_MISMATCH");
  const records = new Map((projection.records ?? []).map((record) => [record.recordId, record]));
  const expectedEvidence = new Map((generated.evidence ?? []).map((evidence) => [evidence.evidenceId, evidence]));
  for (const evidence of (Array.isArray(emitted?.evidence) ? emitted.evidence : [])) {
    const expected = expectedEvidence.get(evidence?.evidenceId);
    const record = records.get(evidence?.sourceRecordId);
    const field = record?.fields?.find((item) => item.fieldId === evidence?.sourceFieldId);
    if (!expected || !record || !field || field.sourceRefId !== (record.sources?.[0]?.sourceRefId)) {
      addIssue(issues, `EVIDENCE_OUT_OF_SCOPE:${evidence?.evidenceId ?? "MISSING_ID"}`);
    }
    if (expected && (expected.sourceRecordId !== evidence.sourceRecordId || expected.sourceFieldId !== evidence.sourceFieldId)) {
      addIssue(issues, `PROVENANCE_BINDING_MISMATCH:${evidence.evidenceId}`);
    }
  }
}

function candidateIssues(emitted, generated, issues) {
  if (emitted?.inventedEdges !== 0) addIssue(issues, "INVENTED_EDGES_NONZERO");
  if (!sameValue(emitted?.globalBlindSpots, generated.globalBlindSpots)) addIssue(issues, "GLOBAL_BLIND_SPOTS_MISMATCH");
  if (!Array.isArray(emitted?.candidates) || emitted.candidates.length !== generated.candidates.length) {
    addIssue(issues, "CANDIDATE_SET_MISMATCH");
  }
  const generatedCandidates = new Map(generated.candidates.map((candidate) => [candidate.candidateId, candidate]));
  for (const candidate of (Array.isArray(emitted?.candidates) ? emitted.candidates : [])) {
    const expected = generatedCandidates.get(candidate?.candidateId);
    if (!expected) {
      addIssue(issues, `CANDIDATE_NOT_PLANTED:${candidate?.candidateId ?? "MISSING_ID"}`);
      continue;
    }
    if (!sameValue(candidate.blindSpots, expected.blindSpots)) addIssue(issues, `BLIND_SPOTS_MISMATCH:${candidate.candidateId}`);
    if (!Array.isArray(candidate.evidenceIds) || candidate.evidenceIds.some((id) => !generated.evidence.some((evidence) => evidence.evidenceId === id))) {
      addIssue(issues, `CANDIDATE_EVIDENCE_OUT_OF_SCOPE:${candidate.candidateId}`);
    }
    if (!Array.isArray(candidate.edgeIds) || candidate.edgeIds.some((id) => !generated.allowedEvidenceEdges.some((edge) => edge.edgeId === id))) {
      addIssue(issues, `INVENTED_EDGE:${candidate.candidateId}`);
    }
    for (const edgeId of (Array.isArray(candidate.edgeIds) ? candidate.edgeIds : [])) {
      const edge = generated.allowedEvidenceEdges.find((item) => item.edgeId === edgeId);
      if (edge && (!candidate.evidenceIds?.includes(edge.sourceEvidenceId) || !candidate.evidenceIds?.includes(edge.targetEvidenceId))) {
        addIssue(issues, `INVENTED_EDGE:${candidate.candidateId}`);
      }
    }
    if (!sameValue(candidate, expected)) addIssue(issues, `CANDIDATE_MISMATCH:${candidate.candidateId}`);
  }
  const ids = (Array.isArray(emitted?.candidates) ? emitted.candidates : []).map((candidate) => candidate?.candidateId);
  if (!sameValue(ids, generated.candidates.map((candidate) => candidate.candidateId))) addIssue(issues, "CANDIDATE_ID_SET_MISMATCH");
  if (new Set(ids).size !== ids.length) addIssue(issues, "DUPLICATE_CANDIDATE_ID");
}

function emittedIssues(emitted, projection, generated) {
  const issues = [];
  exactKeys(emitted, ["schemaVersion", "projectionBinding", "globalBlindSpots", "allowedEvidenceEdges", "evidence", "candidates", "inventedEdges", "fixtureDigest"], "EMITTED_UNKNOWN_FIELD", issues);
  forbiddenKeyIssues(emitted, "#", issues);
  if (!sameValue(emitted?.schemaVersion, generated.schemaVersion)) addIssue(issues, "EMITTED_SCHEMA_VERSION_MISMATCH");
  if (typeof emitted?.fixtureDigest !== "string" || !DIGEST_RE.test(emitted.fixtureDigest)) addIssue(issues, "EMITTED_FIXTURE_DIGEST_INVALID");
  else if (digestWithout(emitted, "fixtureDigest") !== emitted.fixtureDigest) addIssue(issues, "EMITTED_FIXTURE_DIGEST_MISMATCH");
  scopeIssues(emitted, projection, generated, issues);
  selfDigestIssues(emitted?.allowedEvidenceEdges, "edgeDigest", "EMITTED_EDGE", issues);
  selfDigestIssues(emitted?.evidence, "evidenceDigest", "EMITTED_EVIDENCE", issues);
  selfDigestIssues(emitted?.candidates, "candidateDigest", "EMITTED_CANDIDATE", issues);
  edgeIssues(emitted, generated, issues);
  candidateIssues(emitted, generated, issues);
  if (!sameValue(emitted, generated)) addIssue(issues, "EMITTED_CANDIDATE_SET_MISMATCH");
  return issues;
}

function expectedIssues(expected, generated) {
  const issues = [];
  exactKeys(expected, ["schemaVersion", "projectionBinding", "globalBlindSpots", "allowedEvidenceEdges", "evidence", "candidates", "inventedEdges", "fixtureDigest"], "EXPECTED_UNKNOWN_FIELD", issues);
  if (!sameValue(expected, generated)) addIssue(issues, "EXPECTED_FIXTURE_MISMATCH");
  if (typeof expected?.fixtureDigest !== "string" || !DIGEST_RE.test(expected.fixtureDigest)) addIssue(issues, "EXPECTED_FIXTURE_DIGEST_INVALID");
  else if (digestWithout(expected, "fixtureDigest") !== expected.fixtureDigest) addIssue(issues, "EXPECTED_FIXTURE_DIGEST_MISMATCH");
  return issues;
}

function safeReplayFingerprint(projection, emitted) {
  return sha256({ projectionDigest: projection?.exchange?.projectionDigest ?? null, replayId: projection?.exchange?.replayId ?? null, candidateSet: emitted });
}

/**
 * Validate one P21 replay. `trustedProjection`, `nowMs`, and `replayState` are
 * mandatory trusted inputs; omitting any one is a denial rather than an allow.
 */
export function validateP21Replay({ projection, trustedProjection, authorityProjectionDigest, expected, emitted = expected, nowMs, replayState } = {}) {
  const issues = [];
  if (!(replayState instanceof Map)) addIssue(issues, "REPLAY_STATE_REQUIRED");
  if (!Number.isSafeInteger(nowMs)) addIssue(issues, "TRUSTED_CLOCK_REQUIRED");
  if (!isObject(projection)) addIssue(issues, "PROJECTION_OBJECT_REQUIRED");
  if (!isObject(trustedProjection)) addIssue(issues, "TRUSTED_PROJECTION_REQUIRED");
  if (typeof authorityProjectionDigest !== "string" || !DIGEST_RE.test(authorityProjectionDigest)) {
    addIssue(issues, "AUTHORITY_PROJECTION_DIGEST_REQUIRED");
  }
  if (!isObject(expected)) addIssue(issues, "EXPECTED_FIXTURE_REQUIRED");
  if (!isObject(emitted)) addIssue(issues, "EMITTED_CANDIDATE_SET_REQUIRED");

  if (isObject(projection) && isObject(trustedProjection) && Number.isSafeInteger(nowMs)) {
    const guarded = verifyProjectionEnvelope(projection, {
      expectedEnvelope: trustedProjection,
      authorityProjectionDigest,
      nowMs,
      replayState: new Map(),
    });
    if (guarded.outcome !== "VERIFIED") guarded.reasonCodes.forEach((reason) => addIssue(issues, reason));
  }

  const generated = isObject(projection) ? buildExpected(projection, issues) : null;
  if (generated !== null && isObject(expected)) expectedIssues(expected, generated).forEach((issue) => addIssue(issues, issue));
  if (generated !== null && isObject(emitted)) emittedIssues(emitted, projection, generated).forEach((issue) => addIssue(issues, issue));

  if (issues.length !== 0) {
    return {
      outcome: "DENIED",
      reasonCodes: [...new Set(issues)].sort(),
      authorityClass: "NONE",
      effectClass: "NONE",
      promotionClaim: "NONE",
    };
  }

  const replayId = projection.exchange.replayId;
  const fingerprint = safeReplayFingerprint(projection, emitted);
  const prior = replayState.get(replayId);
  if (prior !== undefined) {
    const reason = prior === fingerprint ? "REPLAYED_CANDIDATE" : "DENIED_REPLAY_MUTATION";
    return {
      outcome: "DENIED",
      reasonCodes: [reason],
      authorityClass: "NONE",
      effectClass: "NONE",
      promotionClaim: "NONE",
    };
  }
  replayState.set(replayId, fingerprint);
  return {
    outcome: "VERIFIED",
    reasonCodes: ["P21_REPLAY_VERIFIED"],
    projectionDigest: projection.exchange.projectionDigest,
    replayId,
    candidateIds: generated.candidates.map((candidate) => candidate.candidateId),
    evidenceIds: generated.evidence.map((evidence) => evidence.evidenceId),
    allowedEdgeIds: generated.allowedEvidenceEdges.map((edge) => edge.edgeId),
    candidateSet: generated,
    inventedEdges: 0,
    globalBlindSpots: generated.globalBlindSpots,
    candidateBlindSpotCount: generated.candidates.reduce((count, candidate) => count + candidate.blindSpots.length, 0),
    boundary: FROZEN_RETURN_BOUNDARY,
    authorityClass: "NONE",
    effectClass: "NONE",
    promotionClaim: "NONE",
  };
}

export const verifyP21Replay = validateP21Replay;

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}

function main(argv) {
  const args = argv.slice(2);
  if (args.includes("--help") || args.length > 3) {
    console.error("usage: node scripts/verify-cks-10-p21-replay.mjs [projection.json] [expected.json] [emitted.json]");
    return args.includes("--help") ? 0 : 2;
  }
  const projectionPath = resolve(process.cwd(), args[0] ?? DEFAULT_PROJECTION);
  const expectedPath = resolve(process.cwd(), args[1] ?? DEFAULT_EXPECTED);
  const emittedPath = args[2] === undefined ? expectedPath : resolve(process.cwd(), args[2]);
  try {
    const projection = readJson(projectionPath);
    const trustedProjection = readJson(projectionPath);
    const expected = readJson(expectedPath);
    const emitted = readJson(emittedPath);
    const result = validateP21Replay({
      projection,
      trustedProjection,
      authorityProjectionDigest: expected.projectionBinding?.projectionDigest,
      expected,
      emitted,
      nowMs: Date.parse("2026-08-28T06:30:00Z"),
      replayState: new Map(),
    });
    if (result.outcome !== "VERIFIED") {
      for (const reason of result.reasonCodes) console.log(`cks-10-p21-replay: ISSUE ${reason}`);
      console.log(`cks-10-p21-replay: FAIL projection=${projectionPath} issues=${result.reasonCodes.length}`);
      return 1;
    }
    console.log(`cks-10-p21-replay: PASS candidates=${result.candidateIds.length} evidence=${result.evidenceIds.length} allowedEdges=${result.allowedEdgeIds.length} inventedEdges=0 blindSpots=${GLOBAL_BLIND_SPOTS.length + result.candidateBlindSpotCount} authority=NONE promotion=NONE`);
    return 0;
  } catch (error) {
    console.log(`cks-10-p21-replay: ISSUE ${error?.code === "ENOENT" ? "MISSING_FILE" : "INVALID_JSON"}`);
    console.log(`cks-10-p21-replay: FAIL projection=${projectionPath} issues=1`);
    return 1;
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) process.exitCode = main(process.argv);
