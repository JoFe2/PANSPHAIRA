#!/usr/bin/env node
/**
 * Deterministic local CKS-10 prerequisite readback gate.
 *
 * This is a closed, local evidence gate for the #288/#289 prerequisite
 * metadata. It does not ingest data, call a service, read the wall clock, or
 * promote a candidate. A fixture passes only when its issue evidence and P21
 * candidate readback are complete, minimized, versioned, digest-bound, and
 * bound to one exact tenant/scope, time, provenance, and replay tuple.
 *
 * Usage:
 *   node scripts/verify-cks-10-prerequisites.mjs tests/fixtures/cks-10/prerequisite-evidence-v1.json
 *   node scripts/verify-cks-10-prerequisites.mjs --self-test
 */
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const DEFAULT_FIXTURE = "tests/fixtures/cks-10/prerequisite-evidence-v1.json";
const DIGEST_RE = /^[a-f0-9]{64}$/;
const VERSION_RE = /^[0-9]+\.[0-9]+\.[0-9]+$/;
const ID_RE = /^[A-Za-z][A-Za-z0-9._:#-]{2,127}$/;
const ISSUE_RE = /^#[0-9]+$/;
const INSTANT_RE = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})Z$/;
const SUPPORTED_VERSION = "1.0.0";
// Independent canonical-content and exact-byte pins make the committed local
// prerequisite input immutable. Both change only with a reviewed fixture.
const EXPECTED_FIXTURE_DIGEST = "8e02b0666ddd3e968b12c501fea58e9ba92f2019888e5a27b08d0f317d6cfa2e";
const EXPECTED_FIXTURE_BYTES_DIGEST = "33a065d3df95f29276da72aa645fb6a742b828380c942b97fb2d00f79582adc3";

const REQUIRED_ISSUES = ["#288", "#289"];
const REQUIRED_CANDIDATE_CLASSES = ["GAP", "CLUSTER", "CO_USAGE", "NEGATIVE_EVIDENCE", "PATTERN"];
const REQUIRED_EVIDENCE_KINDS = [
  "GAP_SIGNAL",
  "CLUSTER_SIGNAL",
  "CO_USAGE_SIGNAL",
  "NEGATIVE_EVIDENCE_SIGNAL",
  "PATTERN_SIGNAL",
];
const CANDIDATE_EVIDENCE_KIND = {
  GAP: "GAP_SIGNAL",
  CLUSTER: "CLUSTER_SIGNAL",
  CO_USAGE: "CO_USAGE_SIGNAL",
  NEGATIVE_EVIDENCE: "NEGATIVE_EVIDENCE_SIGNAL",
  PATTERN: "PATTERN_SIGNAL",
};
const EXCLUDED_CLASSES = [
  "RAW_PROMPTS_COMPLETIONS_MESSAGES_OR_CHAIN_OF_THOUGHT",
  "RAW_MODEL_OR_TOOL_TRACES",
  "RAW_ROWS_SQL_FILES_OR_BINARY_BLOBS",
  "SECRETS_CREDENTIALS_TOKENS_KEYS_COOKIES",
  "DIRECT_TENANT_CUSTOMER_USER_ACTOR_SESSION_IDENTIFIERS",
  "MUTABLE_POLICY_APPROVAL_INVALIDATION_OR_AUTHORITY_STATE",
  "EXECUTABLE_CODE_COMMANDS_CALLBACKS_OR_EFFECT_PAYLOADS",
];
const ALLOWED_MINIMIZED_FIELDS = [
  "candidateClass",
  "evidenceIds",
  "edgeIds",
  "blindSpots",
  "signalCode",
  "observation.metricCode",
  "observation.bucketCode",
  "observation.count",
];
const REQUIRED_EVIDENCE_MINIMIZED_FIELDS = [
  "edgeIds",
  "signalCode",
  "observation.metricCode",
  "observation.bucketCode",
  "observation.count",
];
const REQUIRED_CANDIDATE_MINIMIZED_FIELDS = [
  "candidateClass",
  "evidenceIds",
  "edgeIds",
  "blindSpots",
  "signalCode",
];
const REQUIRED_TENANT_SCOPE = {
  tenantScopeId: "tscope-290-synthetic-lane1",
  scopeId: "scope.cks10.analytics-exploration",
  scopeVersion: SUPPORTED_VERSION,
  scopeDigest: "9ce99e13d145ac481dcf8fbe2f18d122f2f1773370d3726da2c5f421ad7e0da8",
  decisionId: "CKS-10-BOUNDARY-DECISION-V1",
  decisionVersion: SUPPORTED_VERSION,
  decisionDigest: "2a0cfa0be3452f98518f2be2eeb6b2d54fb0a9a84efbaa18609c9e9c39b0db15",
  tenantScopeDigest: "5fe36265b865edd8fe23c1a98a9c52040da3a5f6d31e32a49447731c095f4668",
};
const REQUIRED_ISSUE_METADATA = {
  "#288": {
    issueVersion: SUPPORTED_VERSION,
    issueDigest: "4148075ef45959e9687683cab331d35923046e79bcb36e3bb0300473c6378ead",
    sourceId: "issue-288",
    evidenceKinds: ["GAP_SIGNAL", "CO_USAGE_SIGNAL", "NEGATIVE_EVIDENCE_SIGNAL"],
  },
  "#289": {
    issueVersion: SUPPORTED_VERSION,
    issueDigest: "4e4d69f8e7662d7aa94bdffccd8fa1d0800b62225a7de6fc91fff96f23673f31",
    sourceId: "issue-289",
    evidenceKinds: ["CLUSTER_SIGNAL", "PATTERN_SIGNAL"],
  },
};
const REQUIRED_EVIDENCE = {
  "ev-288-gap-290-0001": {
    issueId: "#288",
    evidenceKind: "GAP_SIGNAL",
    sourceKind: "ISSUE_THREAD_SUMMARY",
    signalCode: "UNRESOLVED_TASK_OUTCOME_TRANSITION",
    observation: { metricCode: "MISSING_TRANSITION_COUNT", bucketCode: "SINGLE_BOUNDARY_GAP", count: 1 },
    declaredEdgeIds: ["edge-288-gap-co-usage-290-0001"],
  },
  "ev-289-cluster-290-0001": {
    issueId: "#289",
    evidenceKind: "CLUSTER_SIGNAL",
    sourceKind: "REPEATED_BOUNDARY_SUMMARY",
    signalCode: "RELATED_EVIDENCE_CLUSTER",
    observation: { metricCode: "RELATED_SIGNAL_COUNT", bucketCode: "TWO_MEMBER_CLUSTER", count: 2 },
    declaredEdgeIds: ["edge-289-cluster-pattern-290-0001"],
  },
  "ev-288-co-usage-290-0001": {
    issueId: "#288",
    evidenceKind: "CO_USAGE_SIGNAL",
    sourceKind: "CO_USAGE_SUMMARY",
    signalCode: "SHARED_SCOPE_USAGE",
    observation: { metricCode: "CO_USAGE_COUNT", bucketCode: "TWO_SIGNAL_PAIR", count: 2 },
    declaredEdgeIds: ["edge-288-co-usage-289-cluster-290-0001"],
  },
  "ev-288-negative-evidence-290-0001": {
    issueId: "#288",
    evidenceKind: "NEGATIVE_EVIDENCE_SIGNAL",
    sourceKind: "NEGATIVE_CONTROL_SUMMARY",
    signalCode: "ABSENT_EXPECTED_LINK",
    observation: { metricCode: "EXPECTED_LINK_COUNT", bucketCode: "ZERO_OBSERVED", count: 0 },
    declaredEdgeIds: ["edge-288-negative-gap-290-0001"],
  },
  "ev-289-pattern-290-0001": {
    issueId: "#289",
    evidenceKind: "PATTERN_SIGNAL",
    sourceKind: "SEQUENCE_PATTERN_SUMMARY",
    signalCode: "REPEATED_ORDER_PATTERN",
    observation: { metricCode: "ORDER_PATTERN_COUNT", bucketCode: "TWO_REPETITIONS", count: 2 },
    declaredEdgeIds: ["edge-289-cluster-pattern-290-0001"],
  },
};
const REQUIRED_EDGES = {
  "edge-288-gap-co-usage-290-0001": {
    sourceEvidenceId: "ev-288-gap-290-0001",
    targetEvidenceId: "ev-288-co-usage-290-0001",
    relationClass: "CO_OCCURS_WITH",
  },
  "edge-289-cluster-pattern-290-0001": {
    sourceEvidenceId: "ev-289-cluster-290-0001",
    targetEvidenceId: "ev-289-pattern-290-0001",
    relationClass: "CLUSTER_MEMBER",
  },
  "edge-288-negative-gap-290-0001": {
    sourceEvidenceId: "ev-288-negative-evidence-290-0001",
    targetEvidenceId: "ev-288-gap-290-0001",
    relationClass: "CONTRASTS",
  },
  "edge-288-co-usage-289-cluster-290-0001": {
    sourceEvidenceId: "ev-288-co-usage-290-0001",
    targetEvidenceId: "ev-289-cluster-290-0001",
    relationClass: "SHARED_SCOPE_SIGNAL",
  },
};
const REQUIRED_CANDIDATES = {
  "p21-gap-290-0001": {
    candidateClass: "GAP",
    signalCode: "UNRESOLVED_TASK_OUTCOME_TRANSITION",
    evidenceIds: ["ev-288-gap-290-0001"],
    edgeIds: [],
    blindSpots: ["NO_CAUSAL_EXPLANATION", "NO_LIVE_STATE_RECHECK"],
  },
  "p21-cluster-290-0001": {
    candidateClass: "CLUSTER",
    signalCode: "RELATED_EVIDENCE_CLUSTER",
    evidenceIds: ["ev-289-cluster-290-0001", "ev-289-pattern-290-0001"],
    edgeIds: ["edge-289-cluster-pattern-290-0001"],
    blindSpots: ["NO_CLUSTER_CAUSALITY", "NO_GENERALIZATION_BEYOND_PLANTED_SET"],
  },
  "p21-co-usage-290-0001": {
    candidateClass: "CO_USAGE",
    signalCode: "SHARED_SCOPE_USAGE",
    evidenceIds: ["ev-288-co-usage-290-0001", "ev-289-cluster-290-0001"],
    edgeIds: ["edge-288-co-usage-289-cluster-290-0001"],
    blindSpots: ["NO_USAGE_INTENT", "NO_CROSS_SCOPE_REUSE"],
  },
  "p21-negative-evidence-290-0001": {
    candidateClass: "NEGATIVE_EVIDENCE",
    signalCode: "ABSENT_EXPECTED_LINK",
    evidenceIds: ["ev-288-negative-evidence-290-0001", "ev-288-gap-290-0001"],
    edgeIds: ["edge-288-negative-gap-290-0001"],
    blindSpots: ["ABSENCE_IS_NOT_PROOF", "NO_NEGATIVE_CONTROL_COVERAGE_OUTSIDE_SCOPE"],
  },
  "p21-pattern-290-0001": {
    candidateClass: "PATTERN",
    signalCode: "REPEATED_ORDER_PATTERN",
    evidenceIds: ["ev-289-pattern-290-0001"],
    edgeIds: [],
    blindSpots: ["NO_PREDICTIVE_CLAIM", "NO_PATTERN_SEARCH_OUTSIDE_PLANTED_SET"],
  },
};
const REQUIRED_P21_METHOD = {
  methodId: "p21.local.readback",
  methodVersion: SUPPORTED_VERSION,
  methodDigest: "9ce3d22ae50f6cb914188b9f475b56a4c0c8f5d8cd47a2b3e8caa244c46318a7",
};
const REQUIRED_P21_BLIND_SPOTS = [
  "NO_LIVE_POLICY_OR_INVALIDATION_READBACK",
  "NO_CAUSAL_INFERENCE",
  "NO_CROSS_TENANT_OR_CROSS_SCOPE_JOIN",
  "NO_RAW_EVIDENCE_OR_EXECUTABLE_MATERIAL",
];

const sha256Hex = (value) => createHash("sha256").update(value).digest("hex");
const isObject = (value) => value !== null && typeof value === "object" && !Array.isArray(value);

/** Canonical JSON: recursively sorted object keys, preserved array order, no whitespace. */
function canonicalize(value) {
  if (Array.isArray(value)) return `[${value.map(canonicalize).join(",")}]`;
  if (isObject(value)) {
    return `{${Object.keys(value)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${canonicalize(value[key])}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

function digestWithout(value, key) {
  const copy = structuredClone(value);
  delete copy[key];
  return sha256Hex(canonicalize(copy));
}

function sameValue(left, right) {
  return canonicalize(left) === canonicalize(right);
}

function addIssue(issues, code) {
  issues.add(code);
}

function exactKeys(value, allowed, path, issues) {
  if (!isObject(value)) {
    addIssue(issues, `TYPE_OBJECT:${path}`);
    return false;
  }
  for (const key of Object.keys(value)) {
    if (!allowed.includes(key)) addIssue(issues, `UNKNOWN_FIELD:${path}.${key}`);
  }
  return true;
}

function required(value, keys, path, issues) {
  if (!isObject(value)) return;
  for (const key of keys) {
    if (!Object.hasOwn(value, key)) addIssue(issues, `MISSING_FIELD:${path}.${key}`);
  }
}

function stringField(value, key, path, issues, pattern = null) {
  if (typeof value?.[key] !== "string") {
    addIssue(issues, `INVALID_STRING:${path}.${key}`);
    return;
  }
  if (pattern !== null && !pattern.test(value[key])) addIssue(issues, `INVALID_FORMAT:${path}.${key}`);
}

function exactDigest(value, key, path, issues) {
  stringField(value, key, path, issues, DIGEST_RE);
  if (typeof value?.[key] === "string" && DIGEST_RE.test(value[key]) && digestWithout(value, key) !== value[key]) {
    addIssue(issues, `DIGEST_MISMATCH:${path}.${key}`);
  }
}

function exactVersion(value, key, path, issues) {
  stringField(value, key, path, issues, VERSION_RE);
}

function supportedVersion(value, key, path, issues) {
  exactVersion(value, key, path, issues);
  if (value?.[key] !== SUPPORTED_VERSION) addIssue(issues, `UNSUPPORTED_VERSION:${path}.${key}`);
}

function idList(value, path, issues, { allowEmpty = true } = {}) {
  if (!Array.isArray(value) || (!allowEmpty && value.length === 0) ||
    value.some((id) => typeof id !== "string" || !ID_RE.test(id)) ||
    new Set(value).size !== value.length) {
    addIssue(issues, `INVALID_ID_LIST:${path}`);
    return [];
  }
  return value;
}

function exactInstant(value, key, path, issues) {
  stringField(value, key, path, issues, INSTANT_RE);
  if (typeof value?.[key] === "string" && INSTANT_RE.test(value[key]) && instantMs(value[key]) === null) {
    addIssue(issues, `INVALID_INSTANT:${path}.${key}`);
  }
}

function instantMs(value) {
  const match = typeof value === "string" ? INSTANT_RE.exec(value) : null;
  if (match === null) return null;
  const [year, month, day, hour, minute, second] = match.slice(1).map(Number);
  if (year < 1) return null;
  const date = new Date(Date.UTC(0, month - 1, day, hour, minute, second));
  date.setUTCFullYear(year);
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day ||
    date.getUTCHours() !== hour || date.getUTCMinutes() !== minute || date.getUTCSeconds() !== second) {
    return null;
  }
  return date.getTime();
}

function validateContract(contract, issues) {
  const path = "contract";
  if (!exactKeys(contract, ["contractId", "contractVersion", "contractDigest"], path, issues)) return;
  required(contract, ["contractId", "contractVersion", "contractDigest"], path, issues);
  if (contract.contractId !== "cks-10/prerequisite-readback/v1") addIssue(issues, "CONTRACT_ID_UNSUPPORTED");
  supportedVersion(contract, "contractVersion", path, issues);
  exactDigest(contract, "contractDigest", path, issues);
  if (contract.contractDigest !== "a1afaed26d959d4a6d9261161df823cd04114972a610622691d75d742ea7de4a") {
    addIssue(issues, "CONTRACT_DIGEST_UNSUPPORTED");
  }
}

function validateTenantScope(tenantScope, issues) {
  const path = "tenantScope";
  if (!exactKeys(tenantScope, ["tenantScopeId", "scopeId", "scopeVersion", "scopeDigest", "decisionId", "decisionVersion", "decisionDigest", "tenantScopeDigest"], path, issues)) return;
  required(tenantScope, ["tenantScopeId", "scopeId", "scopeVersion", "scopeDigest", "decisionId", "decisionVersion", "decisionDigest", "tenantScopeDigest"], path, issues);
  stringField(tenantScope, "tenantScopeId", path, issues, ID_RE);
  stringField(tenantScope, "scopeId", path, issues, ID_RE);
  supportedVersion(tenantScope, "scopeVersion", path, issues);
  if (tenantScope.scopeDigest !== sha256Hex(canonicalize({ scopeId: tenantScope.scopeId, scopeVersion: tenantScope.scopeVersion }))) addIssue(issues, "DIGEST_MISMATCH:tenantScope.scopeDigest");
  stringField(tenantScope, "decisionId", path, issues, ID_RE);
  supportedVersion(tenantScope, "decisionVersion", path, issues);
  if (tenantScope.decisionDigest !== sha256Hex(canonicalize({ decisionId: tenantScope.decisionId, decisionVersion: tenantScope.decisionVersion }))) addIssue(issues, "DIGEST_MISMATCH:tenantScope.decisionDigest");
  if (tenantScope.tenantScopeDigest !== digestWithout(tenantScope, "tenantScopeDigest")) addIssue(issues, "DIGEST_MISMATCH:tenantScope.tenantScopeDigest");
  if (!sameValue(tenantScope, REQUIRED_TENANT_SCOPE)) addIssue(issues, "TENANT_SCOPE_NOT_FROZEN");
}

function validateRetention(retention, issues) {
  const path = "retention";
  if (!exactKeys(retention, ["retentionVersion", "retainUntil", "finite", "derivedStatePolicy", "expiryDisposition", "retentionDigest"], path, issues)) return;
  required(retention, ["retentionVersion", "retainUntil", "finite", "derivedStatePolicy", "expiryDisposition", "retentionDigest"], path, issues);
  supportedVersion(retention, "retentionVersion", path, issues);
  exactInstant(retention, "retainUntil", path, issues);
  if (retention.finite !== true) addIssue(issues, "RETENTION_NOT_FINITE");
  if (retention.derivedStatePolicy !== "EARLIEST_SOURCE_EXPIRY") addIssue(issues, "RETENTION_DERIVATION_UNSAFE");
  if (retention.expiryDisposition !== "DENY_USE_RETURN_AND_RETAIN") addIssue(issues, "RETENTION_EXPIRY_NOT_DENY");
  exactDigest(retention, "retentionDigest", path, issues);
}

function validateFreshness(freshness, issues) {
  const path = "freshness";
  if (!exactKeys(freshness, ["freshnessVersion", "issuedAt", "freshUntil", "trustedClockRequired", "invalidationCheck", "staleDisposition", "freshnessDigest"], path, issues)) return;
  required(freshness, ["freshnessVersion", "issuedAt", "freshUntil", "trustedClockRequired", "invalidationCheck", "staleDisposition", "freshnessDigest"], path, issues);
  supportedVersion(freshness, "freshnessVersion", path, issues);
  exactInstant(freshness, "issuedAt", path, issues);
  exactInstant(freshness, "freshUntil", path, issues);
  if (freshness.trustedClockRequired !== true) addIssue(issues, "FRESHNESS_TRUSTED_CLOCK_NOT_REQUIRED");
  if (freshness.invalidationCheck !== "REQUIRED_BEFORE_USE_AND_RETURN") addIssue(issues, "FRESHNESS_INVALIDATION_NOT_REQUIRED");
  if (freshness.staleDisposition !== "DENY") addIssue(issues, "FRESHNESS_STALE_NOT_DENY");
  const issued = instantMs(freshness.issuedAt);
  const fresh = instantMs(freshness.freshUntil);
  if (issued !== null && fresh !== null && !(issued < fresh)) addIssue(issues, "FRESHNESS_ORDER_VIOLATION");
  exactDigest(freshness, "freshnessDigest", path, issues);
}

function validateTimeBounds(retention, freshness, issues) {
  const issued = instantMs(freshness?.issuedAt);
  const freshUntil = instantMs(freshness?.freshUntil);
  const retainUntil = instantMs(retention?.retainUntil);
  if (issued !== null && retainUntil !== null && !(issued < retainUntil)) {
    addIssue(issues, "RETENTION_NOT_AFTER_ISSUANCE");
  }
  if (freshUntil !== null && retainUntil !== null && !(retainUntil <= freshUntil)) {
    addIssue(issues, "RETENTION_EXCEEDS_FRESHNESS");
  }
}

function validateReplay(replay, tenantScope, contract, issues) {
  const path = "replay";
  if (!exactKeys(replay, ["replayVersion", "replayId", "duplicateDisposition", "mutationDisposition", "crossScopeDisposition", "tuple", "tupleDigest", "replayDigest"], path, issues)) return;
  required(replay, ["replayVersion", "replayId", "duplicateDisposition", "mutationDisposition", "crossScopeDisposition", "tuple", "tupleDigest", "replayDigest"], path, issues);
  supportedVersion(replay, "replayVersion", path, issues);
  stringField(replay, "replayId", path, issues, ID_RE);
  if (replay.duplicateDisposition !== "DUPLICATE_NOOP") addIssue(issues, "REPLAY_DUPLICATE_NOT_NOOP");
  if (replay.mutationDisposition !== "DENY_REPLAY") addIssue(issues, "REPLAY_MUTATION_NOT_DENY");
  if (replay.crossScopeDisposition !== "DENY") addIssue(issues, "REPLAY_CROSS_SCOPE_NOT_DENY");
  if (!exactKeys(replay.tuple, ["contractId", "contractVersion", "replayId", "tenantScopeId", "scopeId", "scopeVersion", "candidateIds", "evidenceIds", "edgeIds"], `${path}.tuple`, issues)) return;
  required(replay.tuple, ["contractId", "contractVersion", "replayId", "tenantScopeId", "scopeId", "scopeVersion", "candidateIds", "evidenceIds", "edgeIds"], `${path}.tuple`, issues);
  const tuplePath = `${path}.tuple`;
  stringField(replay.tuple, "contractId", tuplePath, issues);
  supportedVersion(replay.tuple, "contractVersion", tuplePath, issues);
  for (const key of ["replayId", "tenantScopeId", "scopeId"]) stringField(replay.tuple, key, tuplePath, issues, ID_RE);
  supportedVersion(replay.tuple, "scopeVersion", tuplePath, issues);
  idList(replay.tuple.candidateIds, `${tuplePath}.candidateIds`, issues, { allowEmpty: false });
  idList(replay.tuple.evidenceIds, `${tuplePath}.evidenceIds`, issues, { allowEmpty: false });
  idList(replay.tuple.edgeIds, `${tuplePath}.edgeIds`, issues, { allowEmpty: false });
  if (replay.tuple.contractId !== contract?.contractId || replay.tuple.contractVersion !== contract?.contractVersion) {
    addIssue(issues, "REPLAY_CONTRACT_TUPLE_MISMATCH");
  }
  if (replay.tuple.replayId !== replay.replayId || replay.tuple.tenantScopeId !== tenantScope?.tenantScopeId ||
    replay.tuple.scopeId !== tenantScope?.scopeId || replay.tuple.scopeVersion !== tenantScope?.scopeVersion) {
    addIssue(issues, "REPLAY_SCOPE_TUPLE_MISMATCH");
  }
  stringField(replay, "tupleDigest", path, issues, DIGEST_RE);
  if (isObject(replay.tuple) && replay.tupleDigest !== sha256Hex(canonicalize(replay.tuple))) {
    addIssue(issues, "DIGEST_MISMATCH:replay.tupleDigest");
  }
  exactDigest(replay, "replayDigest", path, issues);
}

function validateBinding(binding, expected, path, issues) {
  const keys = [
    "tenantScopeId", "scopeId", "scopeVersion", "scopeDigest", "tenantScopeDigest",
    "retainUntil", "retentionVersion", "retentionDigest", "issuedAt", "freshUntil",
    "freshnessVersion", "freshnessDigest", "replayId", "replayVersion", "replayDigest", "bindingDigest",
  ];
  if (!exactKeys(binding, keys, path, issues)) return;
  required(binding, keys, path, issues);
  supportedVersion(binding, "scopeVersion", path, issues);
  // The component digests are validated against the root tenant-scope,
  // retention, freshness, and replay metadata through the expected binding.
  // Re-hashing this aggregate per field would make those independently
  // named digests circular.
  exactInstant(binding, "retainUntil", path, issues);
  supportedVersion(binding, "retentionVersion", path, issues);

  exactInstant(binding, "issuedAt", path, issues);
  exactInstant(binding, "freshUntil", path, issues);
  supportedVersion(binding, "freshnessVersion", path, issues);

  stringField(binding, "tenantScopeId", path, issues, ID_RE);
  stringField(binding, "scopeId", path, issues, ID_RE);
  stringField(binding, "replayId", path, issues, ID_RE);
  supportedVersion(binding, "replayVersion", path, issues);
  for (const key of ["scopeDigest", "tenantScopeDigest", "retentionDigest", "freshnessDigest", "replayDigest"]) {
    stringField(binding, key, path, issues, DIGEST_RE);
  }

  exactDigest(binding, "bindingDigest", path, issues);
  if (isObject(expected) && !sameValue(binding, expected)) addIssue(issues, `BINDING_MISMATCH:${path}`);
}

function validateIssue(issue, path, issues) {
  if (!exactKeys(issue, ["issueId", "issueVersion", "issueDigest"], path, issues)) return;
  required(issue, ["issueId", "issueVersion", "issueDigest"], path, issues);
  stringField(issue, "issueId", path, issues, ISSUE_RE);
  supportedVersion(issue, "issueVersion", path, issues);
  exactDigest(issue, "issueDigest", path, issues);
  const expected = REQUIRED_ISSUE_METADATA[issue.issueId];
  if (!expected || issue.issueVersion !== expected.issueVersion || issue.issueDigest !== expected.issueDigest) {
    addIssue(issues, `ISSUE_BINDING_UNSUPPORTED:${path}`);
  }
}

function validateProvenance(provenance, issue, path, issues) {
  if (!exactKeys(provenance, ["sourceId", "sourceVersion", "sourceDigest", "chain", "provenanceDigest"], path, issues)) return;
  required(provenance, ["sourceId", "sourceVersion", "sourceDigest", "chain", "provenanceDigest"], path, issues);
  stringField(provenance, "sourceId", path, issues, ID_RE);
  supportedVersion(provenance, "sourceVersion", path, issues);
  stringField(provenance, "sourceDigest", path, issues, DIGEST_RE);
  exactDigest(provenance, "provenanceDigest", path, issues);
  const expectedIssue = REQUIRED_ISSUE_METADATA[issue?.issueId];
  if (!expectedIssue || provenance.sourceId !== expectedIssue.sourceId ||
    provenance.sourceVersion !== issue?.issueVersion || provenance.sourceDigest !== issue?.issueDigest) {
    addIssue(issues, `PROVENANCE_SOURCE_MISMATCH:${path}`);
  }
  if (!Array.isArray(provenance.chain) || provenance.chain.length !== 1) {
    addIssue(issues, `PROVENANCE_CHAIN_INCOMPLETE:${path}`);
  } else {
    const node = provenance.chain[0];
    if (!exactKeys(node, ["nodeId", "nodeVersion", "nodeDigest"], `${path}.chain.0`, issues)) return;
    required(node, ["nodeId", "nodeVersion", "nodeDigest"], `${path}.chain.0`, issues);
    stringField(node, "nodeId", `${path}.chain.0`, issues, ISSUE_RE);
    supportedVersion(node, "nodeVersion", `${path}.chain.0`, issues);
    stringField(node, "nodeDigest", `${path}.chain.0`, issues, DIGEST_RE);
    if (node.nodeId !== issue?.issueId || node.nodeVersion !== issue?.issueVersion || node.nodeDigest !== issue?.issueDigest) addIssue(issues, `PROVENANCE_CHAIN_MISMATCH:${path}`);
  }
}

function validateMinimizedFields(fields, expected, path, issues) {
  if (!Array.isArray(fields) || fields.length === 0) {
    addIssue(issues, `MINIMIZATION_FIELDS_MISSING:${path}`);
    return;
  }
  if (new Set(fields).size !== fields.length) addIssue(issues, `MINIMIZATION_FIELDS_DUPLICATE:${path}`);
  for (const field of fields) {
    if (!ALLOWED_MINIMIZED_FIELDS.includes(field)) addIssue(issues, `MINIMIZATION_FIELD_NOT_ALLOWLISTED:${path}`);
  }
  if (!sameValue(fields, expected)) addIssue(issues, `MINIMIZATION_FIELDS_MISMATCH:${path}`);
}

function validateEvidence(evidence, index, expectedBinding, issues, evidenceById) {
  const path = `evidence[${index}]`;
  const keys = ["evidenceId", "evidenceVersion", "evidenceDigest", "issue", "evidenceKind", "sourceKind", "signalCode", "observation", "binding", "provenance", "declaredEdgeIds", "minimizedFields"];
  if (!exactKeys(evidence, keys, path, issues)) return;
  required(evidence, keys, path, issues);
  stringField(evidence, "evidenceId", path, issues, ID_RE);
  supportedVersion(evidence, "evidenceVersion", path, issues);
  exactDigest(evidence, "evidenceDigest", path, issues);
  validateIssue(evidence.issue, `${path}.issue`, issues);
  if (!REQUIRED_EVIDENCE_KINDS.includes(evidence.evidenceKind)) addIssue(issues, `EVIDENCE_KIND_UNSUPPORTED:${path}`);
  stringField(evidence, "sourceKind", path, issues, /^[A-Z][A-Z0-9_]{2,63}$/);
  stringField(evidence, "signalCode", path, issues, /^[A-Z][A-Z0-9_]{2,63}$/);
  if (!exactKeys(evidence.observation, ["metricCode", "bucketCode", "count"], `${path}.observation`, issues)) return;
  required(evidence.observation, ["metricCode", "bucketCode", "count"], `${path}.observation`, issues);
  stringField(evidence.observation, "metricCode", `${path}.observation`, issues, /^[A-Z][A-Z0-9_]{2,63}$/);
  stringField(evidence.observation, "bucketCode", `${path}.observation`, issues, /^[A-Z][A-Z0-9_]{2,63}$/);
  if (!Number.isInteger(evidence.observation.count) || evidence.observation.count < 0 || evidence.observation.count > 1000000) addIssue(issues, `OBSERVATION_COUNT_INVALID:${path}`);
  validateBinding(evidence.binding, expectedBinding, `${path}.binding`, issues);
  validateProvenance(evidence.provenance, evidence.issue, `${path}.provenance`, issues);
  idList(evidence.declaredEdgeIds, `${path}.declaredEdgeIds`, issues);
  validateMinimizedFields(evidence.minimizedFields, REQUIRED_EVIDENCE_MINIMIZED_FIELDS, `${path}.minimizedFields`, issues);

  const expected = REQUIRED_EVIDENCE[evidence.evidenceId];
  if (!expected || evidence.issue?.issueId !== expected.issueId || evidence.evidenceKind !== expected.evidenceKind ||
    evidence.sourceKind !== expected.sourceKind || evidence.signalCode !== expected.signalCode ||
    !sameValue(evidence.observation, expected.observation) || !sameValue(evidence.declaredEdgeIds, expected.declaredEdgeIds)) {
    addIssue(issues, `PLANTED_EVIDENCE_MISMATCH:${path}`);
  }
  if (typeof evidence.evidenceId === "string") {
    if (evidenceById.has(evidence.evidenceId)) addIssue(issues, `DUPLICATE_EVIDENCE_ID:${evidence.evidenceId}`);
    evidenceById.set(evidence.evidenceId, evidence);
  }
}

function validateEdge(edge, index, evidenceById, issues, edgeById) {
  const path = `declaredEdges[${index}]`;
  const keys = ["edgeId", "edgeVersion", "edgeDigest", "sourceEvidenceId", "targetEvidenceId", "relationClass", "declaredByEvidenceId", "explicit"];
  if (!exactKeys(edge, keys, path, issues)) return;
  required(edge, keys, path, issues);
  stringField(edge, "edgeId", path, issues, ID_RE);
  supportedVersion(edge, "edgeVersion", path, issues);
  exactDigest(edge, "edgeDigest", path, issues);
  for (const key of ["sourceEvidenceId", "targetEvidenceId", "declaredByEvidenceId"]) stringField(edge, key, path, issues, ID_RE);
  stringField(edge, "relationClass", path, issues, /^[A-Z][A-Z0-9_]{2,63}$/);
  if (edge.explicit !== true) addIssue(issues, `EDGE_NOT_EXPLICIT:${path}`);
  if (!evidenceById.has(edge.sourceEvidenceId) || !evidenceById.has(edge.targetEvidenceId) || edge.declaredByEvidenceId !== edge.sourceEvidenceId) addIssue(issues, `EDGE_SOURCE_OR_TARGET_INVALID:${path}`);
  if (!evidenceById.get(edge.sourceEvidenceId)?.declaredEdgeIds?.includes(edge.edgeId)) addIssue(issues, `DECLARED_EDGE_NOT_WITNESSED:${path}`);
  const expected = REQUIRED_EDGES[edge.edgeId];
  if (!expected || edge.sourceEvidenceId !== expected.sourceEvidenceId || edge.targetEvidenceId !== expected.targetEvidenceId ||
    edge.relationClass !== expected.relationClass || edge.declaredByEvidenceId !== expected.sourceEvidenceId || edge.explicit !== true) {
    addIssue(issues, `PLANTED_EDGE_MISMATCH:${path}`);
  }
  if (typeof edge.edgeId === "string") {
    if (edgeById.has(edge.edgeId)) addIssue(issues, `DUPLICATE_EDGE_ID:${edge.edgeId}`);
    edgeById.set(edge.edgeId, edge);
  }
}

function validateCandidate(candidate, index, expectedBinding, expectedReplayDigest, evidenceById, edgeById, issues, candidateById) {
  const path = `p21.candidates[${index}]`;
  const keys = ["candidateId", "candidateVersion", "candidateDigest", "candidateClass", "signalCode", "evidenceIds", "edgeIds", "binding", "replayTupleDigest", "blindSpots", "reproduction", "minimizedFields"];
  if (!exactKeys(candidate, keys, path, issues)) return;
  required(candidate, keys, path, issues);
  stringField(candidate, "candidateId", path, issues, ID_RE);
  supportedVersion(candidate, "candidateVersion", path, issues);
  exactDigest(candidate, "candidateDigest", path, issues);
  if (!REQUIRED_CANDIDATE_CLASSES.includes(candidate.candidateClass)) addIssue(issues, `CANDIDATE_CLASS_UNSUPPORTED:${path}`);
  stringField(candidate, "signalCode", path, issues, /^[A-Z][A-Z0-9_]{2,63}$/);
  const evidenceIds = idList(candidate.evidenceIds, `${path}.evidenceIds`, issues, { allowEmpty: false });
  const edgeIds = idList(candidate.edgeIds, `${path}.edgeIds`, issues);
  for (const evidenceId of evidenceIds) if (!evidenceById.has(evidenceId)) addIssue(issues, `CANDIDATE_EVIDENCE_OUT_OF_SCOPE:${path}`);
  const supportingEvidence = evidenceIds.map((evidenceId) => evidenceById.get(evidenceId)).filter(Boolean);
  if (!supportingEvidence.some((evidence) => evidence.evidenceKind === CANDIDATE_EVIDENCE_KIND[candidate.candidateClass])) {
    addIssue(issues, `CANDIDATE_CLASS_EVIDENCE_MISSING:${path}`);
  }
  if (!supportingEvidence.some((evidence) => evidence.signalCode === candidate.signalCode)) {
    addIssue(issues, `CANDIDATE_SIGNAL_UNSUPPORTED:${path}`);
  }
  for (const edgeId of edgeIds) {
    const edge = edgeById.get(edgeId);
    if (!edge) {
      addIssue(issues, `INVENTED_EDGE:${path}`);
    } else if (!evidenceIds.includes(edge.sourceEvidenceId) || !evidenceIds.includes(edge.targetEvidenceId)) {
      addIssue(issues, `EDGE_NOT_SUPPORTED_BY_CANDIDATE:${path}`);
    }
  }
  validateBinding(candidate.binding, expectedBinding, `${path}.binding`, issues);
  stringField(candidate, "replayTupleDigest", path, issues, DIGEST_RE);
  if (candidate.replayTupleDigest !== expectedReplayDigest) addIssue(issues, `REPLAY_TUPLE_MISMATCH:${path}`);
  if (!Array.isArray(candidate.blindSpots) || candidate.blindSpots.length === 0 ||
    new Set(candidate.blindSpots).size !== candidate.blindSpots.length ||
    candidate.blindSpots.some((spot) => typeof spot !== "string" || !/^[A-Z][A-Z0-9_]{2,63}$/.test(spot))) {
    addIssue(issues, `BLIND_SPOTS_MISSING:${path}`);
  }
  if (candidate.reproduction !== "PLANTED_EVIDENCE_REPRODUCTION") addIssue(issues, `REPRODUCTION_NOT_PLANTED:${path}`);
  validateMinimizedFields(candidate.minimizedFields, REQUIRED_CANDIDATE_MINIMIZED_FIELDS, `${path}.minimizedFields`, issues);

  const expected = REQUIRED_CANDIDATES[candidate.candidateId];
  if (!expected || candidate.candidateClass !== expected.candidateClass || candidate.signalCode !== expected.signalCode ||
    !sameValue(candidate.evidenceIds, expected.evidenceIds) || !sameValue(candidate.edgeIds, expected.edgeIds) ||
    !sameValue(candidate.blindSpots, expected.blindSpots)) {
    addIssue(issues, `PLANTED_CANDIDATE_MISMATCH:${path}`);
  }
  if (typeof candidate.candidateId === "string") {
    if (candidateById.has(candidate.candidateId)) addIssue(issues, `DUPLICATE_CANDIDATE_ID:${candidate.candidateId}`);
    candidateById.set(candidate.candidateId, candidate);
  }
}

function validateFixture(fixture, rawText) {
  const issues = new Set();
  const result = () => [...issues].sort();
  const topKeys = ["schemaVersion", "contract", "fixtureDigest", "tenantScope", "retention", "freshness", "replay", "minimization", "evidence", "declaredEdges", "p21"];
  if (!exactKeys(fixture, topKeys, "#", issues)) return result();
  required(fixture, topKeys, "#", issues);
  if (fixture.schemaVersion !== "pansphaira.cks10/prerequisite-evidence/v1") addIssue(issues, "SCHEMA_VERSION_UNSUPPORTED");
  validateContract(fixture.contract, issues);
  exactDigest(fixture, "fixtureDigest", "#", issues);
  if (fixture.fixtureDigest !== digestWithout(fixture, "fixtureDigest")) addIssue(issues, "FIXTURE_DIGEST_MISMATCH");
  if (fixture.fixtureDigest !== EXPECTED_FIXTURE_DIGEST) addIssue(issues, "FIXTURE_DIGEST_NOT_PINNED");
  if (typeof rawText !== "string") {
    addIssue(issues, "FIXTURE_BYTES_MISSING");
  } else {
    if (sha256Hex(rawText) !== EXPECTED_FIXTURE_BYTES_DIGEST) addIssue(issues, "FIXTURE_BYTES_DIGEST_MISMATCH");
    leakScan(rawText, issues);
  }
  validateTenantScope(fixture.tenantScope, issues);
  validateRetention(fixture.retention, issues);
  validateFreshness(fixture.freshness, issues);
  validateTimeBounds(fixture.retention, fixture.freshness, issues);
  validateReplay(fixture.replay, fixture.tenantScope, fixture.contract, issues);

  if (!exactKeys(fixture.minimization, ["mode", "rawPayloadIncluded", "excludedClasses", "allowedFields", "minimizedEvidenceOnly"], "minimization", issues)) return result();
  required(fixture.minimization, ["mode", "rawPayloadIncluded", "excludedClasses", "allowedFields", "minimizedEvidenceOnly"], "minimization", issues);
  if (fixture.minimization.mode !== "ALLOWLIST_ONLY") addIssue(issues, "MINIMIZATION_MODE_UNSAFE");
  if (fixture.minimization.rawPayloadIncluded !== false) addIssue(issues, "RAW_PAYLOAD_NOT_EXCLUDED");
  if (fixture.minimization.minimizedEvidenceOnly !== true) addIssue(issues, "MINIMIZATION_NOT_ENFORCED");
  if (!sameValue(fixture.minimization.excludedClasses, EXCLUDED_CLASSES)) addIssue(issues, "EXCLUDED_CLASSES_MISMATCH");
  if (!sameValue(fixture.minimization.allowedFields, ALLOWED_MINIMIZED_FIELDS)) addIssue(issues, "ALLOWED_FIELDS_MISMATCH");

  const expectedBinding = {
    tenantScopeId: fixture.tenantScope?.tenantScopeId,
    scopeId: fixture.tenantScope?.scopeId,
    scopeVersion: fixture.tenantScope?.scopeVersion,
    scopeDigest: fixture.tenantScope?.scopeDigest,
    tenantScopeDigest: fixture.tenantScope?.tenantScopeDigest,
    retainUntil: fixture.retention?.retainUntil,
    retentionVersion: fixture.retention?.retentionVersion,
    retentionDigest: fixture.retention?.retentionDigest,
    issuedAt: fixture.freshness?.issuedAt,
    freshUntil: fixture.freshness?.freshUntil,
    freshnessVersion: fixture.freshness?.freshnessVersion,
    freshnessDigest: fixture.freshness?.freshnessDigest,
    replayId: fixture.replay?.replayId,
    replayVersion: fixture.replay?.replayVersion,
    replayDigest: fixture.replay?.replayDigest,
  };
  expectedBinding.bindingDigest = sha256Hex(canonicalize(expectedBinding));

  const evidenceById = new Map();
  const evidenceItems = Array.isArray(fixture.evidence) ? fixture.evidence : [];
  if (!Array.isArray(fixture.evidence)) addIssue(issues, "EVIDENCE_LIST_INVALID");
  if (evidenceItems.length !== Object.keys(REQUIRED_EVIDENCE).length) addIssue(issues, "EVIDENCE_COUNT_MISMATCH");
  for (const [index, evidence] of evidenceItems.entries()) validateEvidence(evidence, index, expectedBinding, issues, evidenceById);
  const actualEvidenceIds = [...evidenceById.keys()];
  if (!sameValue(actualEvidenceIds, Object.keys(REQUIRED_EVIDENCE))) addIssue(issues, "PLANTED_EVIDENCE_SET_MISMATCH");
  const issueIds = [...new Set(evidenceItems.map((evidence) => evidence?.issue?.issueId).filter((id) => typeof id === "string"))].sort();
  if (!sameValue(issueIds, [...REQUIRED_ISSUES].sort())) addIssue(issues, "REQUIRED_ISSUES_NOT_DIVERSE");
  const evidenceKinds = [...new Set(evidenceItems.map((evidence) => evidence?.evidenceKind).filter(Boolean))].sort();
  if (!sameValue(evidenceKinds, [...REQUIRED_EVIDENCE_KINDS].sort())) addIssue(issues, "EVIDENCE_KINDS_NOT_DIVERSE");
  for (const issueId of REQUIRED_ISSUES) {
    const actualKinds = [...new Set(evidenceItems
      .filter((evidence) => evidence?.issue?.issueId === issueId)
      .map((evidence) => evidence?.evidenceKind))].sort();
    if (!sameValue(actualKinds, [...REQUIRED_ISSUE_METADATA[issueId].evidenceKinds].sort())) {
      addIssue(issues, `ISSUE_EVIDENCE_MAPPING_MISMATCH:${issueId}`);
    }
  }

  const edgeById = new Map();
  const edgeItems = Array.isArray(fixture.declaredEdges) ? fixture.declaredEdges : [];
  if (!Array.isArray(fixture.declaredEdges)) addIssue(issues, "DECLARED_EDGES_LIST_INVALID");
  if (edgeItems.length !== Object.keys(REQUIRED_EDGES).length) addIssue(issues, "DECLARED_EDGE_COUNT_MISMATCH");
  for (const [index, edge] of edgeItems.entries()) validateEdge(edge, index, evidenceById, issues, edgeById);
  if (!sameValue([...edgeById.keys()], Object.keys(REQUIRED_EDGES))) addIssue(issues, "PLANTED_EDGE_SET_MISMATCH");
  const declaredEdgeIds = new Set(edgeById.keys());
  for (const evidence of evidenceItems) {
    const evidenceEdgeIds = Array.isArray(evidence?.declaredEdgeIds) ? evidence.declaredEdgeIds : [];
    for (const edgeId of evidenceEdgeIds) if (!declaredEdgeIds.has(edgeId)) addIssue(issues, `UNDECLARED_EVIDENCE_EDGE:${edgeId}`);
    if (evidenceEdgeIds.some((edgeId) => {
      const edge = edgeById.get(edgeId);
      return edge && edge.sourceEvidenceId !== evidence?.evidenceId && edge.targetEvidenceId !== evidence?.evidenceId;
    })) {
      addIssue(issues, `EVIDENCE_EDGE_DECLARATION_MISMATCH:${evidence?.evidenceId ?? "UNKNOWN"}`);
    }
  }

  if (!exactKeys(fixture.p21, ["method", "candidateClasses", "candidates", "blindSpots", "inventedEdges"], "p21", issues)) return result();
  required(fixture.p21, ["method", "candidateClasses", "candidates", "blindSpots", "inventedEdges"], "p21", issues);
  if (!exactKeys(fixture.p21.method, ["methodId", "methodVersion", "methodDigest"], "p21.method", issues)) return result();
  required(fixture.p21.method, ["methodId", "methodVersion", "methodDigest"], "p21.method", issues);
  stringField(fixture.p21.method, "methodId", "p21.method", issues, ID_RE);
  supportedVersion(fixture.p21.method, "methodVersion", "p21.method", issues);
  exactDigest(fixture.p21.method, "methodDigest", "p21.method", issues);
  if (!sameValue(fixture.p21.method, REQUIRED_P21_METHOD)) addIssue(issues, "P21_METHOD_NOT_FROZEN");
  if (!sameValue(fixture.p21.candidateClasses, REQUIRED_CANDIDATE_CLASSES)) addIssue(issues, "P21_CANDIDATE_CLASSES_MISMATCH");
  if (!Array.isArray(fixture.p21.blindSpots) || fixture.p21.blindSpots.length === 0 ||
    new Set(fixture.p21.blindSpots).size !== fixture.p21.blindSpots.length ||
    fixture.p21.blindSpots.some((spot) => typeof spot !== "string" || !/^[A-Z][A-Z0-9_]{2,63}$/.test(spot))) {
    addIssue(issues, "P21_BLIND_SPOTS_MISSING");
  }
  if (!sameValue(fixture.p21.blindSpots, REQUIRED_P21_BLIND_SPOTS)) addIssue(issues, "P21_BLIND_SPOTS_MISMATCH");
  if (fixture.p21.inventedEdges !== 0) addIssue(issues, "P21_INVENTED_EDGES_NONZERO");
  const candidateById = new Map();
  const candidateItems = Array.isArray(fixture.p21.candidates) ? fixture.p21.candidates : [];
  if (!Array.isArray(fixture.p21.candidates)) addIssue(issues, "P21_CANDIDATE_LIST_INVALID");
  if (candidateItems.length !== Object.keys(REQUIRED_CANDIDATES).length) addIssue(issues, "P21_CANDIDATE_COUNT_MISMATCH");
  for (const [index, candidate] of candidateItems.entries()) validateCandidate(candidate, index, expectedBinding, fixture.replay?.tupleDigest, evidenceById, edgeById, issues, candidateById);
  const candidateClasses = [...new Set(candidateItems.map((candidate) => candidate?.candidateClass).filter(Boolean))].sort();
  if (!sameValue(candidateClasses, [...REQUIRED_CANDIDATE_CLASSES].sort())) addIssue(issues, "P21_CANDIDATES_NOT_REPRODUCED");
  const actualCandidateIds = [...candidateById.keys()];
  if (!sameValue(actualCandidateIds, Object.keys(REQUIRED_CANDIDATES))) addIssue(issues, "PLANTED_CANDIDATE_SET_MISMATCH");
  if (!sameValue(fixture.replay?.tuple?.candidateIds, actualCandidateIds)) addIssue(issues, "REPLAY_CANDIDATE_TUPLE_MISMATCH");
  if (!sameValue(fixture.replay?.tuple?.evidenceIds, actualEvidenceIds)) addIssue(issues, "REPLAY_EVIDENCE_TUPLE_MISMATCH");
  const actualEdgeIds = [...edgeById.keys()];
  if (!sameValue(fixture.replay?.tuple?.edgeIds, actualEdgeIds)) addIssue(issues, "REPLAY_EDGE_TUPLE_MISMATCH");
  return result();
}

function leakScan(rawText, issues) {
  const patterns = [
    ["SECRET_LEAK_PRIVATE_KEY", /-----BEGIN [A-Z0-9 ]*PRIVATE KEY-----/],
    ["SECRET_LEAK_BEARER", /\bBearer\s+[A-Za-z0-9._-]{16,}/i],
    ["SECRET_LEAK_ASSIGNMENT", /\b(password|passwd|pwd|secret|token|api_?key)\s*[:=]\s*["'][^"']{8,}["']/i],
    ["RAW_PAYLOAD_MARKER", /["'](?:rawPrompt|rawCompletion|rawTrace|rawSql|binaryBlob)["']\s*:/i],
  ];
  for (const [code, pattern] of patterns) if (pattern.test(rawText)) addIssue(issues, code);
}

function validateFixturePath(path) {
  let rawText;
  try {
    rawText = readFileSync(path, "utf8");
  } catch {
    return report("fixture", path, ["MISSING_FILE"]);
  }
  let fixture;
  try {
    fixture = JSON.parse(rawText);
  } catch {
    return report("fixture", path, ["INVALID_JSON"]);
  }
  return report("fixture", path, validateFixture(fixture, rawText));
}

function report(label, path, issues) {
  if (issues.length === 0) {
    console.log(`cks-10-prerequisites: PASS ${label}=${path} evidence=5 candidates=5 inventedEdges=0 issues=0`);
    return 0;
  }
  for (const issue of issues) console.log(`cks-10-prerequisites: ISSUE ${issue}`);
  console.log(`cks-10-prerequisites: FAIL ${label}=${path} issues=${issues.length}`);
  return 1;
}

function selfTest() {
  const fixturePath = resolve(ROOT, DEFAULT_FIXTURE);
  let baseline;
  let rawText;
  try {
    rawText = readFileSync(fixturePath, "utf8");
    baseline = JSON.parse(rawText);
  } catch (error) {
    console.log(`cks-10-prerequisites: SELF_TEST FAIL setup=${error?.code ?? "ERROR"}`);
    return 1;
  }
  const failures = [];
  let cases = 1;
  const baselineIssues = validateFixture(baseline, rawText);
  if (baselineIssues.length !== 0) failures.push(`baseline: expected no issues got ${baselineIssues.join(",")}`);

  const check = (name, mutate, expected, render = (copy) => JSON.stringify(copy)) => {
    cases += 1;
    const copy = structuredClone(baseline);
    mutate(copy);
    let issues;
    try {
      issues = validateFixture(copy, render(copy));
    } catch (error) {
      failures.push(`${name}: validator threw ${error?.name ?? "ERROR"}`);
      return;
    }
    if (issues.length === 0 || !expected.some((prefix) => issues.some((issue) => issue.startsWith(prefix)))) {
      failures.push(`${name}: expected ${expected.join("|")} got ${issues.join(",")}`);
    }
  };
  check("missing-issue-evidence", (e) => { e.evidence = e.evidence.filter((item) => item.issue.issueId !== "#289"); }, ["REQUIRED_ISSUES_NOT_DIVERSE"]);
  check("extra-evidence", (e) => { e.evidence.push(structuredClone(e.evidence[0])); }, ["EVIDENCE_COUNT_MISMATCH"]);
  check("issue-evidence-mapping", (e) => { e.evidence[0].issue = structuredClone(e.evidence[1].issue); }, ["ISSUE_EVIDENCE_MAPPING_MISMATCH", "PLANTED_EVIDENCE_MISMATCH"]);
  check("planted-observation-drift", (e) => { e.evidence[3].observation.count = 1; }, ["PLANTED_EVIDENCE_MISMATCH"]);
  check("evidence-version-unsupported", (e) => { e.evidence[0].evidenceVersion = "2.0.0"; }, ["UNSUPPORTED_VERSION:evidence[0].evidenceVersion"]);
  check("evidence-minimization-widened", (e) => { e.evidence[0].minimizedFields.push("candidateClass"); }, ["MINIMIZATION_FIELDS_MISMATCH"]);
  check("malformed-evidence-list", (e) => { e.evidence = {}; }, ["EVIDENCE_LIST_INVALID"]);
  check("tenant-scope-mismatch", (e) => { e.evidence[0].binding.tenantScopeId = "tscope-other"; }, ["BINDING_MISMATCH"]);
  check("tenant-scope-root-substitution", (e) => { e.tenantScope.tenantScopeId = "tscope-other"; }, ["TENANT_SCOPE_NOT_FROZEN"]);
  check("retention-infinite", (e) => { e.retention.finite = false; }, ["RETENTION_NOT_FINITE"]);
  check("retention-exceeds-freshness", (e) => { e.retention.retainUntil = "2026-08-28T06:12:00Z"; }, ["RETENTION_EXCEEDS_FRESHNESS"]);
  check("retention-unsupported-version", (e) => { e.retention.retentionVersion = "2.0.0"; }, ["UNSUPPORTED_VERSION:retention.retentionVersion"]);
  check("freshness-invalid-order", (e) => { e.freshness.freshUntil = e.freshness.issuedAt; }, ["FRESHNESS_ORDER_VIOLATION"]);
  check("freshness-invalid-calendar", (e) => { e.freshness.issuedAt = "2026-02-30T04:12:00Z"; }, ["INVALID_INSTANT:freshness.issuedAt"]);
  check("freshness-invalidation-bypass", (e) => { e.freshness.invalidationCheck = "OPTIONAL"; }, ["FRESHNESS_INVALIDATION_NOT_REQUIRED"]);
  check("provenance-digest-drift", (e) => { e.evidence[0].provenance.sourceDigest = "0".repeat(64); }, ["PROVENANCE_SOURCE_MISMATCH"]);
  check("provenance-source-substitution", (e) => { e.evidence[0].provenance.sourceId = "issue-289"; }, ["PROVENANCE_SOURCE_MISMATCH"]);
  check("provenance-chain-incomplete", (e) => { e.evidence[0].provenance.chain = []; }, ["PROVENANCE_CHAIN_INCOMPLETE"]);
  check("replay-mutation", (e) => { e.replay.mutationDisposition = "ACCEPT"; }, ["REPLAY_MUTATION_NOT_DENY"]);
  check("replay-scope-substitution", (e) => { e.replay.tuple.scopeId = "scope.other"; }, ["REPLAY_SCOPE_TUPLE_MISMATCH"]);
  check("replay-list-duplicate", (e) => { e.replay.tuple.candidateIds[1] = e.replay.tuple.candidateIds[0]; }, ["INVALID_ID_LIST:replay.tuple.candidateIds"]);
  check("replay-version-unsupported", (e) => { e.replay.replayVersion = "2.0.0"; }, ["UNSUPPORTED_VERSION:replay.replayVersion"]);
  check("candidate-version-unsupported", (e) => { e.p21.candidates[0].candidateVersion = "2.0.0"; }, ["UNSUPPORTED_VERSION:p21.candidates[0].candidateVersion"]);
  check("candidate-version-unversioned", (e) => { e.p21.candidates[0].candidateVersion = "latest"; }, ["INVALID_FORMAT:p21.candidates[0].candidateVersion"]);
  check("invented-edge", (e) => { e.p21.candidates[0].edgeIds = ["edge-not-declared"]; }, ["INVENTED_EDGE"]);
  check("unwitnessed-declared-edge", (e) => { e.evidence[0].declaredEdgeIds = []; }, ["DECLARED_EDGE_NOT_WITNESSED"]);
  check("declared-edge-relation-drift", (e) => { e.declaredEdges[0].relationClass = "UNPLANTED_RELATION"; }, ["PLANTED_EDGE_MISMATCH"]);
  check("candidate-class-evidence-mismatch", (e) => { e.p21.candidates[0].evidenceIds = ["ev-289-pattern-290-0001"]; }, ["CANDIDATE_CLASS_EVIDENCE_MISSING", "CANDIDATE_SIGNAL_UNSUPPORTED"]);
  check("candidate-planted-edge-omitted", (e) => { e.p21.candidates[1].edgeIds = []; }, ["PLANTED_CANDIDATE_MISMATCH"]);
  check("candidate-evidence-list-malformed", (e) => { e.p21.candidates[0].evidenceIds = {}; }, ["INVALID_ID_LIST:p21.candidates[0].evidenceIds"]);
  check("blind-spot-omitted", (e) => { e.p21.candidates[0].blindSpots = []; }, ["BLIND_SPOTS_MISSING"]);
  check("blind-spot-substitution", (e) => { e.p21.candidates[0].blindSpots = ["OTHER_LIMITATION"]; }, ["PLANTED_CANDIDATE_MISMATCH"]);
  check("p21-blind-spot-invalid", (e) => { e.p21.blindSpots = ["not-explicit"]; }, ["P21_BLIND_SPOTS_MISSING"]);
  check("p21-invented-edge-count", (e) => { e.p21.inventedEdges = 1; }, ["P21_INVENTED_EDGES_NONZERO"]);
  check("unknown-field", (e) => { e.p21.candidates[0].unreviewed = true; }, ["UNKNOWN_FIELD"]);
  check("raw-material", (e) => { e.minimization.rawPayloadIncluded = true; }, ["RAW_PAYLOAD_NOT_EXCLUDED"]);
  check("raw-material-marker", (e) => { e.p21.candidates[0].rawPrompt = "not admitted"; }, ["RAW_PAYLOAD_MARKER"]);
  check("nested-digest-corruption", (e) => { e.evidence[0].evidenceDigest = "0".repeat(64); }, ["DIGEST_MISMATCH:evidence[0].evidenceDigest"]);
  check("fixture-digest-corruption", (e) => { e.fixtureDigest = "0".repeat(64); }, ["DIGEST_MISMATCH:#.fixtureDigest", "FIXTURE_DIGEST_MISMATCH"]);
  check("self-consistent-fixture-substitution", (e) => {
    e.replay.replayId = "cks10-prereq-replay-290-0002";
    e.fixtureDigest = digestWithout(e, "fixtureDigest");
  }, ["FIXTURE_DIGEST_NOT_PINNED"]);
  check("fixture-byte-drift", () => {}, ["FIXTURE_BYTES_DIGEST_MISMATCH"], () => `${rawText} `);
  if (failures.length > 0) {
    for (const failure of failures) console.log(`cks-10-prerequisites: SELF_TEST_FAILURE ${failure}`);
    console.log(`cks-10-prerequisites: SELF_TEST FAIL cases=${cases} failures=${failures.length}`);
    return 1;
  }
  console.log(`cks-10-prerequisites: SELF_TEST PASS cases=${cases} failures=0`);
  return 0;
}

function main(argv) {
  const args = argv.slice(2);
  if (args.length === 1 && args[0] === "--self-test") return selfTest();
  if (args.length !== 1 || args[0] === "--help" || args[0] === "-h") {
    console.error("usage: node scripts/verify-cks-10-prerequisites.mjs <fixture.json> | --self-test");
    return 2;
  }
  return validateFixturePath(resolve(process.cwd(), args[0]));
}

process.exitCode = main(process.argv);
