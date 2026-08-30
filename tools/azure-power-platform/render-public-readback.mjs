#!/usr/bin/env node

import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const FIXTURE_ROOT = path.join(ROOT, "tests/fixtures/azure-power-platform");
const DIGEST = /^[a-f0-9]{64}$/;
const VERSION = /^\d+\.\d+\.\d+$/;
const SAFE_REF = /^(docs|tests|tools|release|pull)\/[A-Za-z0-9._/-]+$/;
const HEX_COMMIT = /^[a-f0-9]{40}$/;

export const PUBLIC_READBACK_SCHEMA = "pansphaira.azure-power-platform/public-readback/v1";
export const PUBLIC_FIELD_ALLOWLIST = Object.freeze([
  "schemaVersion",
  "packetKind",
  "packetStatus",
  "environmentClass",
  "component",
  "schema",
  "policy",
  "evidenceRefs",
  "limitations",
  "negativeResults",
  "rollback",
  "historicalMilestone",
  "ownerReadbackPlaceholders",
]);

const LIMITATIONS = Object.freeze([
  "LOCAL_SYNTHETIC_REPOSITORY_ONLY",
  "NO_TENANT_VALIDATION",
  "NO_RUNTIME_VALIDATION",
  "NO_PRODUCTION_VALIDATION",
  "NO_EXTERNAL_CONFIGURATION",
  "NO_EXTERNAL_MUTATION",
  "NO_IMPORT_EXECUTION",
  "NO_PUBLICATION",
  "NO_PROMOTION",
  "OWNER_ONLY_NEXT_ACTIONS",
  "SYNTHETIC_EVIDENCE_ONLY",
]);
const NEGATIVE_RESULT_KEYS = ["case", "outcome", "reasonCode", "effectCount", "evidenceRef"];
const PLACEHOLDER_KEYS = ["name", "status", "reference", "digest", "requiredOwnerReadback"];
const FORBIDDEN_KEY = /(?:tenant|subscription|environment(?:id|name)|credential|access.?token|password|secret|private.?path|internal.?host|principal|email|raw.?payload|security.?payload)/i;
const FORBIDDEN_TEXT = /(?:https?:\/\/|secret:\/\/|bearer\s+|(?:^|[^a-z])(?:tenant|subscription|environment)[-_:/]?(?:id|name)\b|(?:^|\/)tenant(?:\/|$)|\/tmp\/|\/home\/|\\\\|[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}|production\s*(?:ready|validated|authorized)|tenant\s*validated|credential\s*used|provider\s*call\s*performed)/i;

export class PublicReadbackError extends Error {
  constructor(reasonCode, message = reasonCode) {
    super(message);
    this.name = "PublicReadbackError";
    this.reasonCode = reasonCode;
  }
}

function isRecord(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function exactKeys(value, expected, label) {
  if (!isRecord(value) || JSON.stringify(Object.keys(value).sort()) !== JSON.stringify([...expected].sort())) {
    throw new PublicReadbackError("ALLOWLIST_FIELD_DENIED", `${label} is not an exact allow-listed object`);
  }
}

function assertValue(condition, reasonCode, message) {
  if (!condition) throw new PublicReadbackError(reasonCode, message);
}

function scanForUnsafeMaterial(value, key = "") {
  if (FORBIDDEN_KEY.test(key)) throw new PublicReadbackError("PUBLIC_UNSAFE_MATERIAL_DENIED");
  if (typeof value === "string" && FORBIDDEN_TEXT.test(value)) throw new PublicReadbackError("PUBLIC_UNSAFE_MATERIAL_DENIED");
  if (Array.isArray(value)) {
    for (const item of value) scanForUnsafeMaterial(item);
  } else if (isRecord(value)) {
    for (const [childKey, child] of Object.entries(value)) scanForUnsafeMaterial(child, childKey);
  }
}

function publicReference(value) {
  return typeof value === "string" && SAFE_REF.test(value) && !value.includes("..") && !value.endsWith("/");
}

function validateArtifact(value, label) {
  exactKeys(value, ["id", "version", "digest"], label);
  assertValue(typeof value.id === "string" && /^[a-z][a-z0-9.-]{2,80}$/.test(value.id), "ARTIFACT_ID_DENIED");
  assertValue(VERSION.test(value.version), "IMMUTABLE_VERSION_DENIED");
  assertValue(DIGEST.test(value.digest), "DIGEST_DENIED");
}

function validateEvidenceRefs(value) {
  assertValue(Array.isArray(value) && value.length > 0, "EVIDENCE_REFERENCE_DENIED");
  const ids = new Set();
  for (const item of value) {
    exactKeys(item, ["id", "reference", "digest"], "evidence reference");
    assertValue(typeof item.id === "string" && /^[a-z][a-z0-9-]{2,80}$/.test(item.id), "EVIDENCE_REFERENCE_DENIED");
    assertValue(!ids.has(item.id), "EVIDENCE_REFERENCE_DENIED");
    ids.add(item.id);
    assertValue(publicReference(item.reference), "EVIDENCE_REFERENCE_DENIED");
    assertValue(DIGEST.test(item.digest), "DIGEST_DENIED");
  }
  return ids;
}

function validatePolicy(policy) {
  exactKeys(policy, ["id", "version", "generation", "digest"], "policy");
  assertValue(policy.id === "power-platform-read-policy", "POLICY_BINDING_DENIED");
  assertValue(VERSION.test(policy.version), "IMMUTABLE_VERSION_DENIED");
  assertValue(Number.isInteger(policy.generation) && policy.generation === 7, "POLICY_GENERATION_DENIED");
  assertValue(DIGEST.test(policy.digest), "DIGEST_DENIED");
}

function validateNegativeResults(value, evidenceIds) {
  assertValue(Array.isArray(value) && value.length >= 7, "NEGATIVE_EVIDENCE_DENIED");
  const cases = new Set();
  for (const item of value) {
    exactKeys(item, NEGATIVE_RESULT_KEYS, "negative result");
    assertValue(item.outcome === "DENY" && item.effectCount === 0, "NEGATIVE_EVIDENCE_DENIED");
    assertValue(typeof item.case === "string" && /^[A-Z][A-Z0-9_]{2,80}$/.test(item.case), "NEGATIVE_EVIDENCE_DENIED");
    assertValue(typeof item.reasonCode === "string" && /^[A-Z][A-Z0-9_]{2,100}$/.test(item.reasonCode), "NEGATIVE_EVIDENCE_DENIED");
    assertValue(!cases.has(item.case) && evidenceIds.has(item.evidenceRef), "NEGATIVE_EVIDENCE_DENIED");
    cases.add(item.case);
  }
  return value.map((item) => ({
    case: item.case,
    reasonCode: item.reasonCode,
    outcome: item.outcome,
    effectCount: item.effectCount,
  }));
}

function validateRollback(value, evidenceIds) {
  exactKeys(value, ["target", "targetTupleDigest", "targetStatus", "targetRevocationStatus", "authorization", "partialRollbackAllowed", "latestVersionFallbackAllowed", "evidenceRef"], "rollback");
  assertValue(value.target === "EXACT_LKG_FULL_TUPLE_DIGEST_FROM_INDEPENDENT_TRUSTED_CONTEXT", "ROLLBACK_TARGET_DENIED");
  assertValue(DIGEST.test(value.targetTupleDigest), "ROLLBACK_TARGET_DENIED");
  assertValue(value.targetStatus === "LKG" && value.targetRevocationStatus === "UNREVOKED", "ROLLBACK_TARGET_DENIED");
  assertValue(value.authorization === "OWNER_ONLY_REQUIRED" && value.partialRollbackAllowed === false && value.latestVersionFallbackAllowed === false, "ROLLBACK_TARGET_DENIED");
  assertValue(evidenceIds.has(value.evidenceRef), "EVIDENCE_REFERENCE_DENIED");
}

function validateHistoricalMilestone(value) {
  exactKeys(value, ["status", "limitation", "planningReference", "pullRequest", "implementationCommit", "release"], "historical milestone");
  assertValue(value.status === "RECONCILED_REPOSITORY_ONLY", "HISTORICAL_STATUS_DENIED");
  assertValue(value.limitation === "REPOSITORY_ONLY_NO_FUTURE_MILESTONE_CLAIM", "HISTORICAL_LIMITATION_DENIED");
  assertValue(publicReference(value.planningReference), "HISTORICAL_REFERENCE_DENIED");
  exactKeys(value.pullRequest, ["number", "reference", "state", "merged"], "historical pull request");
  assertValue(value.pullRequest.number === 77 && value.pullRequest.reference === "pull/77" && value.pullRequest.state === "CLOSED" && value.pullRequest.merged === true, "HISTORICAL_PULL_REQUEST_DENIED");
  exactKeys(value.implementationCommit, ["sha", "reference"], "historical commit");
  assertValue(HEX_COMMIT.test(value.implementationCommit.sha) && value.implementationCommit.reference === "pull/77", "HISTORICAL_COMMIT_DENIED");
  exactKeys(value.release, ["tag", "targetCommit", "reference", "status"], "historical release");
  assertValue(/^v\d+\.\d+\.\d+(?:-[a-z0-9.-]+)?$/.test(value.release.tag) && HEX_COMMIT.test(value.release.targetCommit) && publicReference(value.release.reference) && value.release.status === "RECONCILED_REPOSITORY_ONLY", "HISTORICAL_RELEASE_DENIED");
}

function validatePlaceholders(value) {
  assertValue(Array.isArray(value) && value.length >= 5, "OWNER_READBACK_PLACEHOLDER_DENIED");
  const names = new Set();
  for (const item of value) {
    exactKeys(item, PLACEHOLDER_KEYS, "owner readback placeholder");
    assertValue(typeof item.name === "string" && /^[a-z][a-zA-Z0-9-]{1,60}$/.test(item.name) && !names.has(item.name), "OWNER_READBACK_PLACEHOLDER_DENIED");
    assertValue(item.status === "PENDING_OWNER_READBACK" && item.reference === null && item.digest === null && item.requiredOwnerReadback === true, "OWNER_READBACK_PLACEHOLDER_DENIED");
    names.add(item.name);
  }
  for (const required of ["planningPr", "ci", "merge", "releaseDecision", "release", "publicReadback"]) assertValue(names.has(required), "OWNER_READBACK_PLACEHOLDER_DENIED");
}

export function validatePublicReadbackInput(input) {
  try {
    exactKeys(input, PUBLIC_FIELD_ALLOWLIST, "packet");
    scanForUnsafeMaterial(input);
    assertValue(input.schemaVersion === PUBLIC_READBACK_SCHEMA, "SCHEMA_DENIED");
    assertValue(input.packetKind === "PUBLIC_SAFE_PLANNING_EVIDENCE", "PACKET_KIND_DENIED");
    assertValue(input.packetStatus === "CANDIDATE_ONLY", "PRODUCTION_READINESS_DENIED");
    assertValue(input.environmentClass === "LOCAL_SYNTHETIC_REPOSITORY_ONLY", "ENVIRONMENT_CLASS_DENIED");
    validateArtifact(input.component, "component");
    validateArtifact(input.schema, "schema");
    validatePolicy(input.policy);
    const evidenceIds = validateEvidenceRefs(input.evidenceRefs);
    assertValue(JSON.stringify(input.limitations) === JSON.stringify(LIMITATIONS), "LIMITATION_MISSING_DENIED");
    const negativeResults = validateNegativeResults(input.negativeResults, evidenceIds);
    validateRollback(input.rollback, evidenceIds);
    validateHistoricalMilestone(input.historicalMilestone);
    validatePlaceholders(input.ownerReadbackPlaceholders);
    return { accepted: true, negativeResults };
  } catch (error) {
    if (error instanceof PublicReadbackError) return { accepted: false, reasonCode: error.reasonCode };
    return { accepted: false, reasonCode: "INPUT_DENIED" };
  }
}

function projectHistoricalMilestone(value) {
  return {
    status: value.status,
    limitation: value.limitation,
    planningReference: value.planningReference,
    pullRequest: { number: value.pullRequest.number, reference: value.pullRequest.reference, state: value.pullRequest.state, merged: value.pullRequest.merged },
    implementationCommit: { sha: value.implementationCommit.sha, reference: value.implementationCommit.reference },
    release: { tag: value.release.tag, targetCommit: value.release.targetCommit, reference: value.release.reference, status: value.release.status },
  };
}

export function renderPublicReadback(input) {
  const validation = validatePublicReadbackInput(input);
  if (!validation.accepted) return { status: "REJECTED", reasonCode: validation.reasonCode, redacted: true };
  const deniedCases = validation.negativeResults.map((item) => item.case);
  return {
    schemaVersion: PUBLIC_READBACK_SCHEMA,
    status: "DRY_RUN_PUBLIC_SAFE",
    packetKind: input.packetKind,
    packetStatus: input.packetStatus,
    environmentClass: input.environmentClass,
    claimBoundary: "LOCAL_SYNTHETIC_REPOSITORY_ONLY; NO_TENANT_VALIDATION; NO_RUNTIME_VALIDATION; NO_PRODUCTION_VALIDATION",
    exactPins: {
      component: { id: input.component.id, version: input.component.version, digest: input.component.digest },
      schema: { id: input.schema.id, version: input.schema.version, digest: input.schema.digest },
      policy: { id: input.policy.id, version: input.policy.version, generation: input.policy.generation, digest: input.policy.digest },
    },
    evidenceReferences: input.evidenceRefs.map((item) => ({ id: item.id, reference: item.reference, digest: item.digest })),
    limitations: [...input.limitations],
    negativeResultSummary: {
      count: validation.negativeResults.length,
      deniedCases,
      allEffectFree: validation.negativeResults.every((item) => item.outcome === "DENY" && item.effectCount === 0),
    },
    rollbackTarget: {
      target: input.rollback.target,
      targetTupleDigest: input.rollback.targetTupleDigest,
      targetStatus: input.rollback.targetStatus,
      targetRevocationStatus: input.rollback.targetRevocationStatus,
      authorization: input.rollback.authorization,
    },
    historicalMilestone: projectHistoricalMilestone(input.historicalMilestone),
    ownerReadbackPlaceholders: input.ownerReadbackPlaceholders.map((item) => ({ ...item })),
    nonValidatedClaims: ["TENANT_VALIDATION", "RUNTIME_VALIDATION", "PRODUCTION_VALIDATION"],
    redacted: true,
  };
}

async function loadFixture(fixturePath) {
  assertValue(typeof fixturePath === "string" && fixturePath.length > 0, "FIXTURE_PATH_DENIED");
  const absolute = path.resolve(ROOT, fixturePath);
  const relative = path.relative(FIXTURE_ROOT, absolute);
  assertValue(relative && !relative.startsWith("..") && !path.isAbsolute(relative), "FIXTURE_PATH_DENIED");
  return JSON.parse(await readFile(absolute, "utf8"));
}

function usage() {
  console.error("usage: node tools/azure-power-platform/render-public-readback.mjs --dry-run --fixture <path> [--expect-rejected]");
}

async function main() {
  const args = process.argv.slice(2);
  const fixtureIndex = args.indexOf("--fixture");
  const fixturePath = fixtureIndex >= 0 ? args[fixtureIndex + 1] : undefined;
  const dryRun = args.includes("--dry-run");
  const expectRejected = args.includes("--expect-rejected");
  if (!dryRun || !fixturePath || args.some((arg, index) => arg === "--fixture" && index !== fixtureIndex) || args.some((arg) => !["--dry-run", "--fixture", fixturePath, "--expect-rejected"].includes(arg))) {
    usage();
    process.exitCode = 2;
    return;
  }
  try {
    const input = await loadFixture(fixturePath);
    const output = renderPublicReadback(input);
    const rejected = output.status === "REJECTED";
    console.log(JSON.stringify(output));
    process.exitCode = rejected === expectRejected ? 0 : 1;
  } catch (error) {
    const output = { status: "REJECTED", reasonCode: error instanceof PublicReadbackError ? error.reasonCode : "INPUT_DENIED", redacted: true };
    console.log(JSON.stringify(output));
    process.exitCode = expectRejected ? 0 : 1;
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await main();
