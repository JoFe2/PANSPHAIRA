#!/usr/bin/env node
import { createHash } from "node:crypto";
import { spawn, spawnSync } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  renameSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { dirname, isAbsolute, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

export const RECEIPT_SCHEMA = "pansphaira.demo/current-head-e2e-receipt/v1";
export const FAILURE_SCHEMA = "pansphaira.demo/current-head-e2e-failure/v1";
export const COMPLETION_SCHEMA = "pansphaira.demo/current-head-e2e-completion/v1";
export const WORKFLOW_PATH = ".github/workflows/demo-current-head-e2e.yml";
export const RECEIPT_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1_000;
export const E2E_TIMEOUT_SECONDS = 2_100;
export const ARTIFACT_RETENTION_DAYS = 14;

export const EXPECTED_SERVICES = Object.freeze([
  "chimpmaera",
  "doli-db",
  "dolibarr",
  "espo-db",
  "espocrm",
]);

export const NEGATIVE_PROOF_CASES = Object.freeze([
  "FAILED_HEALTH",
  "WRONG_FIXTURE",
  "MISSING_READBACK",
  "OWNED_RESIDUE",
  "RUNTIME_TIMEOUT",
  "STALE_RECEIPT",
  "STALE_HEAD",
  "CALLER_AUTHORED_PASS",
  "MISSING_NEGATIVE_PROOF",
  "FAILED_HARD_GATE",
  "OVERCLAIM",
  "ISSUE_NOT_PUBLIC_CLOSED",
  "QUEUE_NOT_DONE",
  "RESIDUAL_OWNERSHIP",
]);

export const REQUIRED_HARD_GATES = Object.freeze([
  "demo-current-head-e2e",
  "release-governance-public-readback",
  "repository-tests",
]);

const RECEIPT_CLAIM_BOUNDARY = Object.freeze([
  "LOCAL_SYNTHETIC_ONLY",
  "NO_PRODUCTION_OR_CUSTOMER_DATA_CLAIM",
  "NO_REGISTRY_SIGNATURE_PROVENANCE_OR_REPRODUCIBLE_BUILD_CLAIM",
  "NO_PUBLICATION_ISSUE_QUEUE_OR_AUTHORITY_EFFECT",
]);

const COMPLETION_CLAIM_BOUNDARY = Object.freeze([
  "EVIDENCE_VALIDATION_ONLY",
  "NO_PROVIDER_QUEUE_ISSUE_OR_RELEASE_MUTATION",
  "NO_PRODUCTIVE_EFFECT_OR_AUTHORITY_GRANT",
]);

const FIXTURE_BINDINGS = Object.freeze([
  ["SAFE_GUIDED-v1", "demo/manifests/authority/SAFE_GUIDED-v1.json"],
  ["admin-ai-poc-policy-v1", "demo/manifests/authority/admin-ai-poc-policy-v1.json"],
  ["crm-erp-playable-v1", "demo/manifests/catalog/crm-erp-playable-v1.json"],
  ["panskys-zoo-demo-v1", "demo/manifests/fixtures/panskys-zoo-demo-v1.json"],
  ["panskys-zoo-v1", "demo/manifests/identity/panskys-zoo-v1.json"],
  ["local-default-deny-v1", "demo/manifests/network/local-egress-policy-v1.json"],
]);

const SUCCESS_RETAINED_FILES = Object.freeze([
  "cleanup.log",
  "e2e.log",
  "receipt.json",
]);

const TOP_KEYS = Object.freeze([
  "artifactPolicy",
  "authoritativeReadback",
  "claimBoundary",
  "cleanup",
  "execution",
  "fixtures",
  "governedEffect",
  "locks",
  "networkBoundary",
  "producedBy",
  "receiptDigest",
  "schemaVersion",
  "serviceHealth",
  "source",
]);

const SCRIPT_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const MAX_CAPTURE_BYTES = 2 * 1024 * 1024;
const HASH_RE = /^[a-f0-9]{64}$/;
const SHA_RE = /^[a-f0-9]{40}$/;
const ISO_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;
const NAMESPACE_RE = /^pansphaira-e2e-[1-9][0-9]{0,19}-[1-9][0-9]{0,5}$/;

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

function stableBytes(value, seen = new Set()) {
  if (value === null || typeof value === "boolean" || typeof value === "string") {
    return JSON.stringify(value);
  }
  if (typeof value === "number") {
    if (!Number.isFinite(value) || Object.is(value, -0)) throw new Error("NON_CANONICAL_NUMBER");
    return JSON.stringify(value);
  }
  if (typeof value !== "object" || seen.has(value)) throw new Error("NON_JSON_VALUE");
  seen.add(value);
  let output;
  if (Array.isArray(value)) {
    output = `[${value.map((entry) => stableBytes(entry, seen)).join(",")}]`;
  } else {
    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) throw new Error("NON_PLAIN_OBJECT");
    const descriptors = Object.getOwnPropertyDescriptors(value);
    const keys = Reflect.ownKeys(descriptors);
    if (keys.some((key) => typeof key !== "string")) throw new Error("SYMBOL_KEY_DENIED");
    const entries = keys.sort().map((key) => {
      const descriptor = descriptors[key];
      if (!descriptor.enumerable || descriptor.get || descriptor.set || descriptor.value === undefined) {
        throw new Error("NON_DATA_PROPERTY");
      }
      return `${JSON.stringify(key)}:${stableBytes(descriptor.value, seen)}`;
    });
    output = `{${entries.join(",")}}`;
  }
  seen.delete(value);
  return output;
}

function isPlainJson(value) {
  try {
    stableBytes(value);
    return true;
  } catch {
    return false;
  }
}

function exactKeys(value, expected) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  return JSON.stringify(Object.keys(value).sort()) === JSON.stringify([...expected].sort());
}

function exactArray(actual, expected) {
  return Array.isArray(actual)
    && actual.length === expected.length
    && actual.every((entry, index) => entry === expected[index]);
}

function validIso(value) {
  return typeof value === "string" && ISO_RE.test(value) && Number.isFinite(Date.parse(value));
}

function pushUnless(issues, condition, code) {
  if (!condition) issues.push(code);
}

function verdict(issues) {
  const reasonCodes = [...new Set(issues)].sort();
  return Object.freeze({ outcome: reasonCodes.length === 0 ? "PASS" : "DENY", reasonCodes });
}

export function receiptDigest(unsignedReceipt) {
  return sha256(stableBytes(unsignedReceipt));
}

export function receiptFileSha256(receipt) {
  return sha256(`${JSON.stringify(receipt, null, 2)}\n`);
}

export function buildSuccessReceipt(unsignedReceipt) {
  if (!isPlainJson(unsignedReceipt) || Object.hasOwn(unsignedReceipt, "receiptDigest")) {
    throw new Error("UNSIGNED_RECEIPT_INVALID");
  }
  return { ...unsignedReceipt, receiptDigest: receiptDigest(unsignedReceipt) };
}

function secretPatterns() {
  return [
    /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/i,
    /\bgh[pousr]_[A-Za-z0-9]{20,}\b/,
    /\bglpat-[A-Za-z0-9_-]{20,}\b/,
    /\bsk-[A-Za-z0-9_-]{20,}\b/,
    /\bhf_[A-Za-z0-9]{20,}\b/,
    /\b(?:AKIA|ASIA)[A-Z0-9]{16}\b/,
    /\b(?:authorization|password|passwd|api[_-]?key|access[_-]?token|client[_-]?secret)\s*[:=]\s*[^\s,;]+/i,
  ];
}

export function sanitizeArtifactText(input, options = {}) {
  let output = String(input).replace(/\u001b\[[0-9;]*m/g, "");
  const forbiddenValues = [...new Set((options.forbiddenValues ?? [])
    .filter((value) => typeof value === "string" && value.length >= 4))]
    .sort((left, right) => right.length - left.length);
  for (const value of forbiddenValues) output = output.split(value).join("[REDACTED]");
  const privateRoots = [...new Set((options.privateRoots ?? [])
    .filter((value) => typeof value === "string" && value.startsWith("/")))]
    .sort((left, right) => right.length - left.length);
  for (const value of privateRoots) output = output.split(value).join("[RUNNER_PATH]");
  output = output
    .replace(/\/(?:home|mnt|tmp|opt\/hostedtoolcache|__w)\/[A-Za-z0-9_@%+=:,./-]+/g, "[RUNNER_PATH]")
    .replace(/[A-Za-z]:\\(?:Users|actions-runner|runner)\\[^\r\n\t ]+/gi, "[RUNNER_PATH]");
  for (const pattern of secretPatterns()) output = output.replace(pattern, "[REDACTED]");
  return output;
}

export function artifactSafetyIssues(input, options = {}) {
  const text = String(input);
  const issues = [];
  const forbiddenValues = (options.forbiddenValues ?? [])
    .filter((value) => typeof value === "string" && value.length >= 4);
  const privateRoots = (options.privateRoots ?? [])
    .filter((value) => typeof value === "string" && value.startsWith("/"));
  if (forbiddenValues.some((value) => text.includes(value))) issues.push("ARTIFACT_SECRET_VALUE_EXPOSED");
  if (privateRoots.some((value) => text.includes(value))) issues.push("ARTIFACT_RUNNER_PATH_EXPOSED");
  if (/\/(?:home|mnt|tmp|opt\/hostedtoolcache|__w)\//.test(text)
      || /[A-Za-z]:\\(?:Users|actions-runner|runner)\\/i.test(text)) {
    issues.push("ARTIFACT_RUNNER_PATH_EXPOSED");
  }
  if (secretPatterns().some((pattern) => pattern.test(text))) issues.push("ARTIFACT_CREDENTIAL_PATTERN_EXPOSED");
  if (text.includes("\u0000")) issues.push("ARTIFACT_NUL_DENIED");
  return [...new Set(issues)].sort();
}

export function validateSuccessReceipt(receipt, expected) {
  const issues = [];
  if (!isPlainJson(expected)
      || !SHA_RE.test(expected.commitSha ?? "")
      || !SHA_RE.test(expected.treeSha ?? "")
      || !Number.isFinite(expected.nowMs)
      || !Number.isFinite(expected.maxAgeMs)
      || expected.maxAgeMs <= 0
      || !isPlainJson(expected.locks)
      || !Array.isArray(expected.fixtures)) {
    return verdict(["RECEIPT_EXPECTATION_INVALID"]);
  }
  if (!isPlainJson(receipt)) return verdict(["RECEIPT_NON_DATA_JSON_DENIED"]);
  pushUnless(issues, exactKeys(receipt, TOP_KEYS), "RECEIPT_SCHEMA_OVERCLAIM");
  pushUnless(issues, receipt.schemaVersion === RECEIPT_SCHEMA, "RECEIPT_SCHEMA_DENIED");

  const producedBy = receipt.producedBy ?? {};
  pushUnless(issues, exactKeys(producedBy, ["event", "kind", "repository", "runAttempt", "runId", "workflowPath"]), "RECEIPT_PRODUCER_SCHEMA_DENIED");
  pushUnless(issues, producedBy.kind === "GITHUB_ACTIONS_OBSERVATION", "RECEIPT_CALLER_AUTHORITY_DENIED");
  pushUnless(issues, producedBy.repository === "JoFe2/PANSPHAIRA" && producedBy.workflowPath === WORKFLOW_PATH, "RECEIPT_PRODUCER_DENIED");
  pushUnless(issues, ["release", "schedule", "workflow_dispatch"].includes(producedBy.event), "RECEIPT_EVENT_DENIED");
  pushUnless(issues, /^[1-9][0-9]{0,19}$/.test(producedBy.runId ?? "")
    && Number.isSafeInteger(producedBy.runAttempt) && producedBy.runAttempt > 0, "RECEIPT_RUN_IDENTITY_DENIED");

  const source = receipt.source ?? {};
  pushUnless(issues, exactKeys(source, ["commitSha", "treeSha"]), "RECEIPT_SOURCE_SCHEMA_DENIED");
  pushUnless(issues, SHA_RE.test(source.commitSha ?? "") && source.commitSha === expected?.commitSha, "RECEIPT_STALE_HEAD");
  pushUnless(issues, SHA_RE.test(source.treeSha ?? "") && source.treeSha === expected?.treeSha, "RECEIPT_STALE_TREE");

  const locks = receipt.locks ?? {};
  pushUnless(issues, exactKeys(locks, ["compose", "composeCli", "ociReferences", "packageLock", "runtimeImageId", "supplyChain"]), "RECEIPT_LOCK_SCHEMA_DENIED");
  for (const key of ["compose", "composeCli", "packageLock", "supplyChain"]) {
    const binding = locks[key] ?? {};
    const expectedBinding = expected?.locks?.[key] ?? {};
    pushUnless(issues, exactKeys(binding, Object.keys(expectedBinding)), `RECEIPT_${key.toUpperCase()}_LOCK_SCHEMA_DENIED`);
    pushUnless(issues, stableBytes(binding) === stableBytes(expectedBinding), `RECEIPT_${key.toUpperCase()}_LOCK_MISMATCH`);
  }
  pushUnless(issues, typeof locks.runtimeImageId === "string" && /^sha256:[a-f0-9]{64}$/.test(locks.runtimeImageId), "RECEIPT_RUNTIME_IMAGE_ID_INVALID");
  pushUnless(issues, Array.isArray(locks.ociReferences)
    && stableBytes(locks.ociReferences) === stableBytes(expected?.locks?.ociReferences ?? []), "RECEIPT_OCI_LOCK_MISMATCH");

  pushUnless(issues, Array.isArray(receipt.fixtures)
    && stableBytes(receipt.fixtures) === stableBytes(expected?.fixtures ?? []), "RECEIPT_FIXTURE_MISMATCH");

  const execution = receipt.execution ?? {};
  pushUnless(issues, exactKeys(execution, ["acceptance", "completedAt", "durationMs", "install", "namespace", "providerReadback", "scenario", "startedAt", "timedOut", "timeoutSeconds"]), "RECEIPT_EXECUTION_SCHEMA_DENIED");
  pushUnless(issues, NAMESPACE_RE.test(execution.namespace ?? ""), "RECEIPT_NAMESPACE_DENIED");
  pushUnless(issues, execution.scenario === "SAFE_DEMO_COLD", "RECEIPT_SCENARIO_DENIED");
  pushUnless(issues, execution.timeoutSeconds === E2E_TIMEOUT_SECONDS
    && execution.timedOut === false
    && Number.isSafeInteger(execution.durationMs)
    && execution.durationMs >= 0
    && execution.durationMs <= E2E_TIMEOUT_SECONDS * 1_000, "RECEIPT_TIMEOUT_OR_BUDGET_FAILED");
  const startedMs = validIso(execution.startedAt) ? Date.parse(execution.startedAt) : NaN;
  const completedMs = validIso(execution.completedAt) ? Date.parse(execution.completedAt) : NaN;
  pushUnless(issues, Number.isFinite(startedMs) && Number.isFinite(completedMs) && completedMs >= startedMs, "RECEIPT_TIME_RANGE_INVALID");
  pushUnless(issues, Number.isFinite(startedMs)
    && Number.isFinite(completedMs)
    && completedMs - startedMs === execution.durationMs
    && completedMs - startedMs <= E2E_TIMEOUT_SECONDS * 1_000, "RECEIPT_TIMEOUT_OR_BUDGET_FAILED");
  const nowMs = expected?.nowMs;
  pushUnless(issues, Number.isFinite(nowMs)
    && Number.isFinite(completedMs)
    && completedMs <= nowMs + 5 * 60 * 1_000
    && nowMs - completedMs <= (expected?.maxAgeMs ?? RECEIPT_MAX_AGE_MS), "RECEIPT_STALE");
  if (Number.isFinite(expected?.notBeforeMs)) {
    pushUnless(issues, Number.isFinite(completedMs) && completedMs >= expected.notBeforeMs, "RECEIPT_PREDATES_RELEASED_TREE");
  }
  for (const phase of ["install", "acceptance", "providerReadback"]) {
    const result = execution[phase] ?? {};
    pushUnless(issues, exactKeys(result, ["evidenceSha256", "outcome"])
      && result.outcome === "PASS" && HASH_RE.test(result.evidenceSha256 ?? ""), `RECEIPT_${phase.toUpperCase()}_FAILED`);
  }

  const expectedHealth = EXPECTED_SERVICES.map((service) => ({ health: "healthy", service, state: "running" }));
  pushUnless(issues, Array.isArray(receipt.serviceHealth)
    && stableBytes(receipt.serviceHealth) === stableBytes(expectedHealth), "RECEIPT_SERVICE_HEALTH_FAILED");

  const effect = receipt.governedEffect ?? {};
  pushUnless(issues, exactKeys(effect, ["effectReceiptDigest", "enforcementPoint", "evidenceEligibility", "knownInstallerGovernanceBypass", "outcome", "status"]), "RECEIPT_EFFECT_SCHEMA_DENIED");
  pushUnless(issues, effect.status === "PASS"
    && effect.knownInstallerGovernanceBypass === false
    && effect.evidenceEligibility === "CURRENT_BYTE_GATE_ENFORCED"
    && effect.enforcementPoint === "CHIMPMAERA_RUNTIME_MUTATION_GATE_V1"
    && effect.outcome === "PROVIDER_MUTATION_READBACK_VERIFIED"
    && HASH_RE.test(effect.effectReceiptDigest ?? ""), "RECEIPT_GOVERNED_EFFECT_FAILED");

  const readback = receipt.authoritativeReadback ?? {};
  pushUnless(issues, exactKeys(readback, ["minimizedDigest", "providerStatus", "seedVerified", "sourceSha256", "status"]), "RECEIPT_READBACK_SCHEMA_DENIED");
  pushUnless(issues, readback.status === "READY_VERIFIED"
    && readback.providerStatus === "PASS"
    && readback.seedVerified === true
    && HASH_RE.test(readback.sourceSha256 ?? "")
    && HASH_RE.test(readback.minimizedDigest ?? ""), "RECEIPT_AUTHORITATIVE_READBACK_MISSING");

  const cleanup = receipt.cleanup ?? {};
  pushUnless(issues, exactKeys(cleanup, ["attempted", "ownedResourcesAfter", "ownedResourcesBefore", "purgeOutcome", "stateRemoved", "strategy"]), "RECEIPT_CLEANUP_SCHEMA_DENIED");
  pushUnless(issues, cleanup.attempted === true
    && cleanup.purgeOutcome === "PASS"
    && cleanup.stateRemoved === true
    && cleanup.strategy === "COMPOSE_PROJECT_AND_RUN_OWNER_LABELS", "RECEIPT_CLEANUP_FAILED");
  for (const key of ["ownedResourcesBefore", "ownedResourcesAfter"]) {
    const counts = cleanup[key] ?? {};
    pushUnless(issues, exactKeys(counts, ["containers", "images", "networks", "volumes"])
      && Object.values(counts).every((count) => Number.isSafeInteger(count) && count >= 0), `RECEIPT_${key.toUpperCase()}_SCHEMA_DENIED`);
  }
  pushUnless(issues, ["containers", "images", "networks", "volumes"]
    .every((key) => cleanup.ownedResourcesAfter?.[key] === 0), "RECEIPT_OWNED_RESIDUE");

  const artifactPolicy = receipt.artifactPolicy ?? {};
  pushUnless(issues, exactKeys(artifactPolicy, ["credentialsRetained", "customerDataRetained", "rawProviderPayloadRetained", "retainedFiles", "retentionDays", "runnerPathsRetained", "sanitizationScan"]), "RECEIPT_ARTIFACT_POLICY_SCHEMA_DENIED");
  pushUnless(issues, artifactPolicy.credentialsRetained === false
    && artifactPolicy.customerDataRetained === false
    && artifactPolicy.rawProviderPayloadRetained === false
    && artifactPolicy.runnerPathsRetained === false
    && artifactPolicy.sanitizationScan === "PASS"
    && artifactPolicy.retentionDays === ARTIFACT_RETENTION_DAYS
    && exactArray(artifactPolicy.retainedFiles, SUCCESS_RETAINED_FILES), "RECEIPT_ARTIFACT_POLICY_FAILED");

  const network = receipt.networkBoundary ?? {};
  pushUnless(issues, exactKeys(network, ["declaredRegistryInputs", "runtimeExternalEgress", "verified"]), "RECEIPT_NETWORK_SCHEMA_DENIED");
  pushUnless(issues, network.declaredRegistryInputs === "PINNED_DIGEST_DECLARATIONS_ONLY"
    && network.runtimeExternalEgress === "DENIED_BY_INTERNAL_OR_NON_MASQUERADED_NETWORKS"
    && network.verified === true, "RECEIPT_NETWORK_BOUNDARY_FAILED");

  pushUnless(issues, exactArray(receipt.claimBoundary, RECEIPT_CLAIM_BOUNDARY), "RECEIPT_OVERCLAIM_DENIED");
  if (typeof receipt.receiptDigest === "string" && HASH_RE.test(receipt.receiptDigest)) {
    const { receiptDigest: recorded, ...unsigned } = receipt;
    pushUnless(issues, receiptDigest(unsigned) === recorded, "RECEIPT_DIGEST_MISMATCH");
  } else {
    issues.push("RECEIPT_DIGEST_MISMATCH");
  }
  issues.push(...artifactSafetyIssues(JSON.stringify(receipt)));
  return verdict(issues);
}

export function validateReleaseCompletion(envelope, expected) {
  if (!isPlainJson(expected)
      || !SHA_RE.test(expected.commitSha ?? "")
      || !SHA_RE.test(expected.treeSha ?? "")
      || !Number.isFinite(expected.nowMs)) {
    return verdict(["COMPLETION_EXPECTATION_INVALID"]);
  }
  if (!isPlainJson(envelope)) return verdict(["COMPLETION_NON_DATA_JSON_DENIED"]);
  const issues = [];
  pushUnless(issues, exactKeys(envelope, [
    "artifactReadback",
    "claimBoundary",
    "hardGates",
    "negativeProof",
    "publicIssue",
    "queue",
    "receipt",
    "releasedTree",
    "schemaVersion",
  ]), "COMPLETION_SCHEMA_OVERCLAIM");
  pushUnless(issues, envelope.schemaVersion === COMPLETION_SCHEMA, "COMPLETION_SCHEMA_DENIED");

  const released = envelope.releasedTree ?? {};
  pushUnless(issues, exactKeys(released, ["commitSha", "publishedAt", "treeSha"]), "RELEASED_TREE_SCHEMA_DENIED");
  pushUnless(issues, released.commitSha === expected?.commitSha && released.treeSha === expected?.treeSha, "COMPLETION_STALE_HEAD");
  pushUnless(issues, validIso(released.publishedAt), "RELEASED_TREE_TIME_INVALID");
  const publishedAtMs = validIso(released.publishedAt) ? Date.parse(released.publishedAt) : NaN;

  const receiptResult = validateSuccessReceipt(envelope.receipt, {
    ...expected,
    notBeforeMs: publishedAtMs,
  });
  issues.push(...receiptResult.reasonCodes);

  const artifact = envelope.artifactReadback ?? {};
  pushUnless(issues, exactKeys(artifact, ["artifactDigest", "artifactName", "conclusion", "headSha", "receiptFileSha256", "runAttempt", "runId", "source", "treeSha", "workflowPath"]), "COMPLETION_ARTIFACT_SCHEMA_DENIED");
  pushUnless(issues, artifact.source === "GITHUB_ACTIONS_PROVIDER_READBACK"
    && artifact.workflowPath === WORKFLOW_PATH
    && artifact.artifactName === `demo-current-head-e2e-${artifact.headSha}`
    && artifact.conclusion === "success"
    && artifact.headSha === expected?.commitSha
    && artifact.treeSha === expected?.treeSha
    && artifact.runId === envelope.receipt?.producedBy?.runId
    && artifact.runAttempt === envelope.receipt?.producedBy?.runAttempt
    && HASH_RE.test(artifact.artifactDigest ?? "")
    && artifact.receiptFileSha256 === receiptFileSha256(envelope.receipt), "COMPLETION_CALLER_AUTHORED_PASS_DENIED");

  const hardGates = envelope.hardGates;
  pushUnless(issues, Array.isArray(hardGates) && hardGates.length === REQUIRED_HARD_GATES.length, "COMPLETION_HARD_GATE_SET_INVALID");
  if (Array.isArray(hardGates)) {
    const names = hardGates.map((gate) => gate?.name);
    pushUnless(issues, exactArray(names, REQUIRED_HARD_GATES), "COMPLETION_HARD_GATE_SET_INVALID");
    for (const gate of hardGates) {
      pushUnless(issues, exactKeys(gate, ["conclusion", "headSha", "name", "source", "treeSha"])
        && gate.source === "GITHUB_ACTIONS_PROVIDER_READBACK"
        && gate.conclusion === "success"
        && gate.headSha === expected?.commitSha
        && gate.treeSha === expected?.treeSha, `COMPLETION_HARD_GATE_FAILED:${gate?.name ?? "unknown"}`);
    }
  }

  const negative = envelope.negativeProof ?? {};
  pushUnless(issues, exactKeys(negative, ["caseIds", "command", "headSha", "outcome", "treeSha"]), "COMPLETION_NEGATIVE_PROOF_SCHEMA_DENIED");
  pushUnless(issues, negative.command === "node --test tests/demo-current-head-e2e*.test.mjs"
    && negative.outcome === "PASS"
    && negative.headSha === expected?.commitSha
    && negative.treeSha === expected?.treeSha
    && exactArray(negative.caseIds, NEGATIVE_PROOF_CASES), "COMPLETION_NEGATIVE_PROOF_MISSING");

  const publicIssue = envelope.publicIssue ?? {};
  pushUnless(issues, exactKeys(publicIssue, ["deliveredCommit", "number", "observedAt", "repository", "source", "state", "stateReason"]), "COMPLETION_ISSUE_SCHEMA_DENIED");
  pushUnless(issues, publicIssue.source === "ANONYMOUS_GITHUB_PROVIDER_READBACK"
    && publicIssue.repository === "JoFe2/PANSPHAIRA"
    && publicIssue.number === 377
    && publicIssue.state === "CLOSED"
    && publicIssue.stateReason === "COMPLETED"
    && publicIssue.deliveredCommit === expected?.commitSha
    && validIso(publicIssue.observedAt), "COMPLETION_ISSUE_NOT_PUBLIC_CLOSED");

  const queue = envelope.queue ?? {};
  pushUnless(issues, exactKeys(queue, ["activeOwnershipCount", "itemId", "observedAt", "owner", "residualOwnership", "source", "status"]), "COMPLETION_QUEUE_SCHEMA_DENIED");
  pushUnless(issues, queue.source === "AUTHORITATIVE_QUEUE_READBACK"
    && queue.itemId === "AUDIT-CORRECTION-377"
    && queue.status === "DONE"
    && queue.owner === null
    && queue.activeOwnershipCount === 0
    && Array.isArray(queue.residualOwnership)
    && queue.residualOwnership.length === 0
    && validIso(queue.observedAt), "COMPLETION_QUEUE_NOT_DONE_OR_RESIDUAL_OWNERSHIP");

  pushUnless(issues, exactArray(envelope.claimBoundary, COMPLETION_CLAIM_BOUNDARY), "COMPLETION_OVERCLAIM_DENIED");
  issues.push(...artifactSafetyIssues(JSON.stringify(envelope)));
  return verdict(issues);
}

function digestFile(root, path) {
  return sha256(readFileSync(resolve(root, path)));
}

function countOccurrences(text, needle) {
  if (needle.length === 0) return 0;
  return text.split(needle).length - 1;
}

export function repositoryBindings(root = SCRIPT_ROOT, options = {}) {
  const lockPath = "demo/manifests/supply-chain/artifact-lock-v1.json";
  const composePath = "demo/compose.yaml";
  const packageLockPath = "package-lock.json";
  const lock = JSON.parse(readFileSync(resolve(root, lockPath), "utf8"));
  if (lock.schemaVersion !== "chimpmaera.demo/supply-chain-artifact-lock/v1") {
    throw new Error("SUPPLY_CHAIN_LOCK_SCHEMA_DENIED");
  }
  for (const declaration of lock.ociDeclarations ?? []) {
    if (!/@sha256:[a-f0-9]{64}$/.test(declaration.reference ?? "")) throw new Error("OCI_REFERENCE_NOT_PINNED");
    for (const location of declaration.locations ?? []) {
      const text = readFileSync(resolve(root, location.path), "utf8");
      if (countOccurrences(text, declaration.reference) !== location.occurrences) {
        throw new Error(`OCI_DECLARATION_DRIFT:${location.path}`);
      }
    }
  }
  const compose = readFileSync(resolve(root, composePath), "utf8");
  for (const marker of [
    'com.docker.network.bridge.enable_ip_masquerade: "false"',
    "internal: true",
  ]) if (!compose.includes(marker)) throw new Error("COMPOSE_NETWORK_BOUNDARY_DRIFT");

  const composeBinary = process.env.DOCKER_CONFIG
    ? resolve(process.env.DOCKER_CONFIG, "cli-plugins", "docker-compose")
    : null;
  if (options.requireComposeBinary === true && (!composeBinary || !existsSync(composeBinary))) {
    throw new Error("PINNED_COMPOSE_CLI_MISSING");
  }
  const composeCliSha256 = composeBinary && existsSync(composeBinary)
    ? sha256(readFileSync(composeBinary))
    : lock.ci?.dockerCompose?.sha256;
  if (composeCliSha256 !== lock.ci?.dockerCompose?.sha256) throw new Error("COMPOSE_CLI_DIGEST_MISMATCH");

  return {
    fixtures: FIXTURE_BINDINGS.map(([id, path]) => ({ id, path, sha256: digestFile(root, path) })),
    locks: {
      compose: { path: composePath, sha256: digestFile(root, composePath) },
      composeCli: {
        platform: lock.ci.dockerCompose.platform,
        sha256: composeCliSha256,
        version: lock.ci.dockerCompose.version,
      },
      ociReferences: lock.ociDeclarations.map(({ artifactId, reference }) => ({ artifactId, reference })),
      packageLock: { path: packageLockPath, sha256: digestFile(root, packageLockPath) },
      supplyChain: { lockId: lock.lockId, path: lockPath, sha256: digestFile(root, lockPath) },
    },
  };
}

function appendBounded(chunks, state, chunk) {
  const buffer = Buffer.from(chunk);
  if (state.bytes >= MAX_CAPTURE_BYTES) {
    state.truncated = true;
    return;
  }
  const available = MAX_CAPTURE_BYTES - state.bytes;
  chunks.push(buffer.subarray(0, available));
  state.bytes += Math.min(buffer.length, available);
  if (buffer.length > available) state.truncated = true;
}

let activeChild = null;
let interruption = null;

function killProcessGroup(child, signal) {
  if (!child?.pid) return;
  try { process.kill(-child.pid, signal); } catch { try { child.kill(signal); } catch { /* already gone */ } }
}

async function runProcess(file, args, options = {}) {
  const started = Date.now();
  const stdout = [];
  const stderr = [];
  const stdoutState = { bytes: 0, truncated: false };
  const stderrState = { bytes: 0, truncated: false };
  return new Promise((resolveRun) => {
    const child = spawn(file, args, {
      cwd: options.cwd,
      env: options.env,
      detached: process.platform !== "win32",
      shell: false,
      stdio: ["ignore", "pipe", "pipe"],
    });
    activeChild = child;
    let timedOut = false;
    let forcedTimer;
    const timer = setTimeout(() => {
      timedOut = true;
      killProcessGroup(child, "SIGTERM");
      forcedTimer = setTimeout(() => killProcessGroup(child, "SIGKILL"), 5_000);
    }, options.timeoutMs);
    child.stdout.on("data", (chunk) => appendBounded(stdout, stdoutState, chunk));
    child.stderr.on("data", (chunk) => appendBounded(stderr, stderrState, chunk));
    child.on("error", (error) => {
      stderr.push(Buffer.from(`PROCESS_SPAWN_ERROR:${error.code ?? error.message}\n`));
    });
    child.on("close", (code, signal) => {
      clearTimeout(timer);
      clearTimeout(forcedTimer);
      if (activeChild === child) activeChild = null;
      const truncation = "\n[OUTPUT_TRUNCATED_AT_2_MIB]\n";
      resolveRun({
        code,
        durationMs: Date.now() - started,
        signal,
        stderr: Buffer.concat(stderr).toString("utf8") + (stderrState.truncated ? truncation : ""),
        stdout: Buffer.concat(stdout).toString("utf8") + (stdoutState.truncated ? truncation : ""),
        timedOut,
      });
    });
  });
}

export const runBoundedProcess = runProcess;

function runOrThrow(result, phase) {
  if (result.timedOut) throw new Error(`RUNTIME_TIMEOUT:${phase}`);
  if (interruption) throw new Error(`RUNTIME_INTERRUPTED:${interruption}`);
  if (result.code !== 0) throw new Error(`PHASE_FAILED:${phase}:${result.code ?? result.signal ?? "unknown"}`);
  return result;
}

function parseEnvFile(path) {
  const output = {};
  for (const line of readFileSync(path, "utf8").split("\n")) {
    if (line === "") continue;
    const match = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (!match) throw new Error("DEMO_CONFIG_INVALID");
    output[match[1]] = match[2];
  }
  return output;
}

function parseComposePs(text) {
  const trimmed = text.trim();
  if (trimmed === "") return [];
  const rows = trimmed.startsWith("[")
    ? JSON.parse(trimmed)
    : trimmed.split("\n").filter(Boolean).map((line) => JSON.parse(line));
  return rows.map((row) => ({
    health: String(row.Health ?? "").toLowerCase(),
    service: row.Service,
    state: String(row.State ?? "").toLowerCase(),
  })).sort((left, right) => left.service.localeCompare(right.service, "en"));
}

function readSecretValues(stateRoot) {
  const directory = resolve(stateRoot, "secrets");
  if (!existsSync(directory)) return [];
  return readdirSync(directory, { withFileTypes: true })
    .filter((entry) => entry.isFile())
    .map((entry) => readFileSync(resolve(directory, entry.name), "utf8").trim())
    .filter((value) => value.length >= 4);
}

function destroyOwnedDirectory(path) {
  if (!existsSync(path)) return;
  const wipe = (candidate) => {
    const metadata = statSync(candidate);
    if (metadata.isDirectory()) {
      for (const name of readdirSync(candidate)) wipe(resolve(candidate, name));
    } else if (metadata.isFile() && metadata.size > 0) {
      writeFileSync(candidate, Buffer.alloc(Math.min(metadata.size, 1024 * 1024)));
    }
  };
  try { wipe(path); } catch { /* best effort before bounded removal */ }
  rmSync(path, { force: true, recursive: true });
}

async function dockerIds(args, timeoutMs = 30_000) {
  const result = runOrThrow(await runProcess("docker", args, {
    cwd: SCRIPT_ROOT,
    env: process.env,
    timeoutMs,
  }), `docker-${args[0]}`);
  return result.stdout.trim().split(/\s+/).filter(Boolean);
}

async function ownedInventory(namespace) {
  const [containers, volumes, networks, images] = await Promise.all([
    dockerIds(["ps", "-aq", "--filter", `label=com.docker.compose.project=${namespace}`]),
    dockerIds(["volume", "ls", "-q", "--filter", `label=com.docker.compose.project=${namespace}`]),
    dockerIds(["network", "ls", "-q", "--filter", `label=com.docker.compose.project=${namespace}`]),
    dockerIds(["image", "ls", "-q", "--filter", `label=io.chimpmaera.demo.run-owner=${namespace}`]),
  ]);
  return {
    containers: new Set(containers).size,
    images: new Set(images).size,
    networks: new Set(networks).size,
    volumes: new Set(volumes).size,
  };
}

async function removeLabeledResources(namespace, log) {
  const resources = [
    { list: ["ps", "-aq", "--filter", `label=com.docker.compose.project=${namespace}`], remove: ["rm", "-f"] },
    { list: ["volume", "ls", "-q", "--filter", `label=com.docker.compose.project=${namespace}`], remove: ["volume", "rm", "-f"] },
    { list: ["network", "ls", "-q", "--filter", `label=com.docker.compose.project=${namespace}`], remove: ["network", "rm"] },
    { list: ["image", "ls", "-q", "--filter", `label=io.chimpmaera.demo.run-owner=${namespace}`], remove: ["image", "rm", "-f"] },
  ];
  for (const resource of resources) {
    const ids = await dockerIds(resource.list);
    if (ids.length === 0) continue;
    const result = await runProcess("docker", [...resource.remove, ...new Set(ids)], {
      cwd: SCRIPT_ROOT,
      env: process.env,
      timeoutMs: 60_000,
    });
    log.push(`fallback-${resource.remove.join("-")}\n${result.stdout}${result.stderr}`);
    runOrThrow(result, `cleanup-${resource.remove.join("-")}`);
  }
}

async function purgeOwned(namespace, log, options = {}) {
  const stateRoot = resolve(SCRIPT_ROOT, ".chimpmaera-demo");
  const acceptanceRoot = resolve(SCRIPT_ROOT, ".chimpmaera-acceptance");
  let stateOwned = options.stateCreatedByRun === true;
  const configPath = resolve(stateRoot, "config.env");
  if (existsSync(configPath)) {
    const config = parseEnvFile(configPath);
    if (config.COMPOSE_PROJECT_NAME !== namespace || config.CM_DEMO_RUN_OWNER !== namespace) {
      throw new Error("CLEANUP_STATE_OWNERSHIP_MISMATCH");
    }
    stateOwned = true;
    const result = await runProcess(resolve(SCRIPT_ROOT, "demo/uninstall.sh"), ["--purge"], {
      cwd: SCRIPT_ROOT,
      env: process.env,
      timeoutMs: 180_000,
    });
    log.push(`uninstall\n${result.stdout}${result.stderr}`);
    if (result.code !== 0 || result.timedOut) log.push("uninstall-fallback-required\n");
  }
  await removeLabeledResources(namespace, log);
  if (stateOwned) destroyOwnedDirectory(stateRoot);
  if (options.acceptanceCreatedByRun === true) destroyOwnedDirectory(acceptanceRoot);
  const after = await ownedInventory(namespace);
  if (Object.values(after).some((count) => count !== 0) || (stateOwned && existsSync(stateRoot))) {
    throw new Error("CLEANUP_OWNED_RESIDUE");
  }
  return after;
}

function privateRoots(artifactDir) {
  return [
    SCRIPT_ROOT,
    artifactDir,
    process.env.GITHUB_WORKSPACE,
    process.env.RUNNER_TEMP,
    process.env.HOME,
  ].filter(Boolean);
}

function atomicJson(path, value) {
  const temporary = `${path}.tmp`;
  writeFileSync(temporary, `${JSON.stringify(value, null, 2)}\n`, { mode: 0o600 });
  renameSync(temporary, path);
}

function writeSanitizedArtifacts(artifactDir, logs, secretValues, receipt) {
  const roots = privateRoots(artifactDir);
  const sanitizerOptions = { forbiddenValues: secretValues, privateRoots: roots };
  const e2eText = sanitizeArtifactText(logs.e2e.join("\n"), { forbiddenValues: secretValues, privateRoots: roots });
  const cleanupText = sanitizeArtifactText(logs.cleanup.join("\n"), { forbiddenValues: secretValues, privateRoots: roots });
  const recordText = sanitizeArtifactText(JSON.stringify(receipt), sanitizerOptions);
  const sanitizedRecord = JSON.parse(recordText);
  if (receipt.schemaVersion === RECEIPT_SCHEMA && stableBytes(sanitizedRecord) !== stableBytes(receipt)) {
    throw new Error("SUCCESS_RECEIPT_REQUIRED_REDACTION");
  }
  writeFileSync(resolve(artifactDir, "e2e.log"), e2eText, { mode: 0o600 });
  writeFileSync(resolve(artifactDir, "cleanup.log"), cleanupText, { mode: 0o600 });
  atomicJson(resolve(artifactDir, receipt.schemaVersion === RECEIPT_SCHEMA ? "receipt.json" : "failure.json"), sanitizedRecord);
  for (const name of readdirSync(artifactDir)) {
    const path = resolve(artifactDir, name);
    if (!statSync(path).isFile()) throw new Error("ARTIFACT_NON_FILE_DENIED");
    const issues = artifactSafetyIssues(readFileSync(path, "utf8"), {
      forbiddenValues: secretValues,
      privateRoots: roots,
    });
    if (issues.length > 0) throw new Error(issues.join(","));
  }
}

function validateArtifactDirectory(artifactDir, expectedNames) {
  const names = readdirSync(artifactDir).sort();
  if (!exactArray(names, [...expectedNames].sort())) throw new Error("ARTIFACT_SET_INVALID");
}

function readGitIdentity(root) {
  const runGit = (args) => {
    const result = spawnSync("git", args, { cwd: root, encoding: "utf8", shell: false });
    if (result.status !== 0) throw new Error(`GIT_IDENTITY_FAILED:${args.join("-")}`);
    return (result.stdout ?? "").trim();
  };
  return {
    commitSha: runGit(["rev-parse", "HEAD"]),
    treeSha: runGit(["rev-parse", "HEAD^{tree}"]),
    trackedStatus: runGit(["status", "--porcelain", "--untracked-files=no"]),
  };
}

function minimizedReadback(readback) {
  const flow = readback?.providerBootstrap?.governedCrmToErpFlow ?? {};
  return {
    fixtureManifest: readback?.providerBootstrap?.fixtureManifest,
    governedEffect: {
      enforcementPoint: flow.enforcementPoint,
      evidenceEligibility: flow.evidenceEligibility,
      knownInstallerGovernanceBypass: flow.knownInstallerGovernanceBypass,
      outcome: flow.effectReceipt?.outcome,
      receiptDigest: flow.effectReceipt?.receiptDigest,
      status: flow.status,
    },
    providerStatus: readback?.providerBootstrap?.status,
    runningServices: readback?.runningServices,
    seedVerified: readback?.providerBootstrap?.seedVerified,
    status: readback?.status,
  };
}

export function immutableRuntimeImageDigest(value) {
  const match = /^(?:chimpmaera\/v01-runtime@)?(sha256:[a-f0-9]{64})$/.exec(value ?? "");
  if (!match) throw new Error("RUNTIME_IMAGE_REFERENCE_INVALID");
  return match[1];
}

function assertReadback(readback, bindings) {
  const fixture = bindings.fixtures.find(({ id }) => id === "panskys-zoo-demo-v1");
  const flow = readback?.providerBootstrap?.governedCrmToErpFlow;
  if (readback?.status !== "READY_VERIFIED"
      || readback?.providerBootstrap?.status !== "PASS"
      || readback?.providerBootstrap?.seedVerified !== true
      || readback?.providerBootstrap?.fixtureManifest?.id !== fixture.id
      || readback?.providerBootstrap?.fixtureManifest?.sha256 !== fixture.sha256
      || flow?.status !== "PASS"
      || flow?.knownInstallerGovernanceBypass !== false
      || flow?.evidenceEligibility !== "CURRENT_BYTE_GATE_ENFORCED"
      || flow?.enforcementPoint !== "CHIMPMAERA_RUNTIME_MUTATION_GATE_V1"
      || flow?.effectReceipt?.outcome !== "PROVIDER_MUTATION_READBACK_VERIFIED"
      || !HASH_RE.test(flow?.effectReceipt?.receiptDigest ?? "")) {
    throw new Error("AUTHORITATIVE_PROVIDER_READBACK_FAILED");
  }
}

export async function runCurrentHeadE2E(options) {
  const root = SCRIPT_ROOT;
  const artifactDir = resolve(options.artifactDir);
  if (!isAbsolute(options.artifactDir) || relative(root, artifactDir).split(sep)[0] !== "..") {
    throw new Error("ARTIFACT_DIRECTORY_MUST_BE_ABSOLUTE_AND_OUTSIDE_REPOSITORY");
  }
  if (!SHA_RE.test(options.targetSha ?? "")) throw new Error("TARGET_SHA_INVALID");
  if (!NAMESPACE_RE.test(options.namespace ?? "")) throw new Error("NAMESPACE_INVALID");
  if (!["release", "schedule", "workflow_dispatch"].includes(options.event)
      || !/^[1-9][0-9]{0,19}$/.test(options.runId ?? "")
      || !Number.isSafeInteger(options.runAttempt)
      || options.runAttempt < 1) {
    throw new Error("WORKFLOW_IDENTITY_INVALID");
  }
  if (options.timeoutSeconds !== E2E_TIMEOUT_SECONDS) throw new Error("TIMEOUT_CONTRACT_INVALID");
  mkdirSync(artifactDir, { mode: 0o700, recursive: true });
  for (const name of readdirSync(artifactDir)) rmSync(resolve(artifactDir, name), { force: true, recursive: true });

  const git = readGitIdentity(root);
  if (git.commitSha !== options.targetSha || git.trackedStatus !== "") throw new Error("CHECKOUT_NOT_CLEAN_EXACT_SHA");
  const bindings = repositoryBindings(root, { requireComposeBinary: true });
  const startedAtMs = Date.now();
  const deadline = startedAtMs + options.timeoutSeconds * 1_000;
  const stateRoot = resolve(root, ".chimpmaera-demo");
  const acceptanceRoot = resolve(root, ".chimpmaera-acceptance");
  if (existsSync(stateRoot) || existsSync(acceptanceRoot)) throw new Error("PREEXISTING_DEMO_STATE_DENIED");

  const logs = { cleanup: [], e2e: [] };
  let secretValues = [];
  let beforeCleanup = { containers: 0, images: 0, networks: 0, volumes: 0 };
  let afterCleanup = null;
  let evidence = null;
  let primaryError = null;
  const env = {
    ...process.env,
    CM_ACCEPTANCE_CHIMP_PORT: "127.0.0.1:17780",
    CM_ACCEPTANCE_DOLI_PORT: "127.0.0.1:17782",
    CM_ACCEPTANCE_ESPO_PORT: "127.0.0.1:17781",
    CM_ACCEPTANCE_PROJECT: options.namespace,
    CM_DEMO_RUN_OWNER: options.namespace,
  };
  const remaining = () => Math.max(1, deadline - Date.now());

  try {
    const initial = await ownedInventory(options.namespace);
    if (Object.values(initial).some((count) => count !== 0)) throw new Error("PREEXISTING_NAMESPACE_RESIDUE_DENIED");

    const composeVersion = runOrThrow(await runProcess("docker", ["compose", "version", "--short"], {
      cwd: root,
      env,
      timeoutMs: Math.min(30_000, remaining()),
    }), "compose-version");
    if (`v${composeVersion.stdout.trim().replace(/^v/, "")}` !== bindings.locks.composeCli.version) {
      throw new Error("COMPOSE_CLI_VERSION_MISMATCH");
    }

    const acceptance = await runProcess(resolve(root, "demo/acceptance.sh"), ["SAFE_DEMO_COLD", "1"], {
      cwd: root,
      env,
      timeoutMs: remaining(),
    });
    logs.e2e.push(`acceptance\n${acceptance.stdout}${acceptance.stderr}`);
    runOrThrow(acceptance, "acceptance");
    secretValues = readSecretValues(stateRoot);

    const config = parseEnvFile(resolve(stateRoot, "config.env"));
    if (config.COMPOSE_PROJECT_NAME !== options.namespace || config.CM_DEMO_RUN_OWNER !== options.namespace) {
      throw new Error("INSTALLED_NAMESPACE_OWNERSHIP_MISMATCH");
    }
    for (const [key, fixtureId] of [
      ["CM_AUTHORITY_MANIFEST_SHA256", "SAFE_GUIDED-v1"],
      ["CM_ADMIN_AI_POLICY_SHA256", "admin-ai-poc-policy-v1"],
      ["CM_CATALOG_MANIFEST_SHA256", "crm-erp-playable-v1"],
      ["CM_FIXTURE_MANIFEST_SHA256", "panskys-zoo-demo-v1"],
      ["CM_EGRESS_POLICY_MANIFEST_SHA256", "local-default-deny-v1"],
    ]) {
      if (config[key] !== bindings.fixtures.find(({ id }) => id === fixtureId)?.sha256) {
        throw new Error(`INSTALLED_FIXTURE_MISMATCH:${fixtureId}`);
      }
    }

    const acceptancePath = resolve(acceptanceRoot, "runs/SAFE_DEMO_COLD-01/acceptance.json");
    const acceptanceEvidence = JSON.parse(readFileSync(acceptancePath, "utf8"));
    if (acceptanceEvidence.status !== "PASS") throw new Error("ACCEPTANCE_RECEIPT_FAILED");
    const installSummaryPath = resolve(stateRoot, "journal/latest-summary.json");

    const provider = await runProcess(resolve(root, "demo/readback.sh"), [], {
      cwd: root,
      env,
      timeoutMs: Math.min(180_000, remaining()),
    });
    logs.e2e.push(`provider-readback\n${provider.stderr}\nPROVIDER_READBACK_CAPTURED_AND_MINIMIZED\n`);
    runOrThrow(provider, "provider-readback");
    const readback = JSON.parse(provider.stdout);
    assertReadback(readback, bindings);

    const ps = runOrThrow(await runProcess("docker", [
      "compose", "--env-file", resolve(stateRoot, "config.env"),
      "-f", resolve(root, "demo/compose.yaml"), "ps", "--format", "json",
    ], { cwd: root, env, timeoutMs: Math.min(60_000, remaining()) }), "service-health");
    const serviceHealth = parseComposePs(ps.stdout);
    const expectedHealth = EXPECTED_SERVICES.map((service) => ({ health: "healthy", service, state: "running" }));
    if (stableBytes(serviceHealth) !== stableBytes(expectedHealth)) throw new Error("SERVICE_HEALTH_FAILED");

    beforeCleanup = await ownedInventory(options.namespace);
    if (beforeCleanup.containers !== EXPECTED_SERVICES.length || beforeCleanup.images !== 1) {
      throw new Error("OWNED_RUNTIME_INVENTORY_INCOMPLETE");
    }
    const minimized = minimizedReadback(readback);
    evidence = {
      acceptanceSha256: digestFile(root, relative(root, acceptancePath)),
      installSha256: digestFile(root, relative(root, installSummaryPath)),
      minimizedReadbackDigest: sha256(stableBytes(minimized)),
      providerReadbackSha256: sha256(provider.stdout),
      readback,
      runtimeImageId: immutableRuntimeImageDigest(config.CM_CHIMP_IMAGE),
      serviceHealth,
    };
  } catch (error) {
    primaryError = error;
    logs.e2e.push(`failure-code=${error.message}\n`);
  } finally {
    secretValues = [...new Set([...secretValues, ...readSecretValues(stateRoot)])];
    try {
      afterCleanup = await purgeOwned(options.namespace, logs.cleanup, {
        acceptanceCreatedByRun: true,
        stateCreatedByRun: true,
      });
    } catch (cleanupError) {
      primaryError ??= cleanupError;
      logs.cleanup.push(`cleanup-failure=${cleanupError.message}\n`);
      try { afterCleanup = await ownedInventory(options.namespace); } catch { /* Docker itself unavailable */ }
    }
  }

  if (!primaryError && Date.now() > deadline) primaryError = new Error("RUNTIME_TIMEOUT:cleanup");
  if (primaryError || !evidence || !afterCleanup) {
    const failure = {
      schemaVersion: FAILURE_SCHEMA,
      source: { commitSha: git.commitSha, treeSha: git.treeSha },
      namespace: options.namespace,
      outcome: "FAIL",
      reasonCodes: [...new Set([
        primaryError?.message ?? "E2E_EVIDENCE_INCOMPLETE",
        ...(Object.values(afterCleanup ?? { unknown: 1 }).some((count) => count !== 0) ? ["OWNED_RESIDUE"] : []),
      ])].sort(),
      cleanup: {
        attempted: true,
        ownedResourcesAfter: afterCleanup,
        stateRemoved: !existsSync(stateRoot),
      },
      artifactPolicy: {
        credentialsRetained: false,
        customerDataRetained: false,
        rawProviderPayloadRetained: false,
        runnerPathsRetained: false,
        sanitizationScan: "PASS",
      },
      claimBoundary: RECEIPT_CLAIM_BOUNDARY,
    };
    writeSanitizedArtifacts(artifactDir, logs, secretValues, failure);
    validateArtifactDirectory(artifactDir, ["cleanup.log", "e2e.log", "failure.json"]);
    throw primaryError ?? new Error("E2E_EVIDENCE_INCOMPLETE");
  }

  const completedAtMs = Date.now();

  const flow = evidence.readback.providerBootstrap.governedCrmToErpFlow;
  const unsignedReceipt = {
    artifactPolicy: {
      credentialsRetained: false,
      customerDataRetained: false,
      rawProviderPayloadRetained: false,
      retainedFiles: SUCCESS_RETAINED_FILES,
      retentionDays: ARTIFACT_RETENTION_DAYS,
      runnerPathsRetained: false,
      sanitizationScan: "PASS",
    },
    authoritativeReadback: {
      minimizedDigest: evidence.minimizedReadbackDigest,
      providerStatus: evidence.readback.providerBootstrap.status,
      seedVerified: evidence.readback.providerBootstrap.seedVerified,
      sourceSha256: evidence.providerReadbackSha256,
      status: evidence.readback.status,
    },
    claimBoundary: RECEIPT_CLAIM_BOUNDARY,
    cleanup: {
      attempted: true,
      ownedResourcesAfter: afterCleanup,
      ownedResourcesBefore: beforeCleanup,
      purgeOutcome: "PASS",
      stateRemoved: !existsSync(stateRoot),
      strategy: "COMPOSE_PROJECT_AND_RUN_OWNER_LABELS",
    },
    execution: {
      acceptance: { evidenceSha256: evidence.acceptanceSha256, outcome: "PASS" },
      completedAt: new Date(completedAtMs).toISOString(),
      durationMs: completedAtMs - startedAtMs,
      install: { evidenceSha256: evidence.installSha256, outcome: "PASS" },
      namespace: options.namespace,
      providerReadback: { evidenceSha256: evidence.providerReadbackSha256, outcome: "PASS" },
      scenario: "SAFE_DEMO_COLD",
      startedAt: new Date(startedAtMs).toISOString(),
      timedOut: false,
      timeoutSeconds: options.timeoutSeconds,
    },
    fixtures: bindings.fixtures,
    governedEffect: {
      effectReceiptDigest: flow.effectReceipt.receiptDigest,
      enforcementPoint: flow.enforcementPoint,
      evidenceEligibility: flow.evidenceEligibility,
      knownInstallerGovernanceBypass: flow.knownInstallerGovernanceBypass,
      outcome: flow.effectReceipt.outcome,
      status: flow.status,
    },
    locks: { ...bindings.locks, runtimeImageId: evidence.runtimeImageId },
    networkBoundary: {
      declaredRegistryInputs: "PINNED_DIGEST_DECLARATIONS_ONLY",
      runtimeExternalEgress: "DENIED_BY_INTERNAL_OR_NON_MASQUERADED_NETWORKS",
      verified: true,
    },
    producedBy: {
      event: options.event,
      kind: "GITHUB_ACTIONS_OBSERVATION",
      repository: "JoFe2/PANSPHAIRA",
      runAttempt: options.runAttempt,
      runId: options.runId,
      workflowPath: WORKFLOW_PATH,
    },
    schemaVersion: RECEIPT_SCHEMA,
    serviceHealth: evidence.serviceHealth,
    source: { commitSha: git.commitSha, treeSha: git.treeSha },
  };
  const receipt = buildSuccessReceipt(unsignedReceipt);
  const receiptResult = validateSuccessReceipt(receipt, {
    ...bindings,
    commitSha: git.commitSha,
    maxAgeMs: RECEIPT_MAX_AGE_MS,
    nowMs: completedAtMs,
    treeSha: git.treeSha,
  });
  if (receiptResult.outcome !== "PASS") {
    const validationError = new Error(receiptResult.reasonCodes.join(","));
    const failure = {
      schemaVersion: FAILURE_SCHEMA,
      outcome: "FAIL",
      source: { commitSha: git.commitSha, treeSha: git.treeSha },
      execution: {
        namespace: options.namespace,
        scenario: "SAFE_DEMO_COLD",
        startedAt: new Date(startedAtMs).toISOString(),
        completedAt: new Date(completedAtMs).toISOString(),
        timeoutSeconds: options.timeoutSeconds,
        timedOut: receiptResult.reasonCodes.includes("RECEIPT_RUNTIME_TIMEOUT"),
      },
      failure: { reasonCodes: receiptResult.reasonCodes },
      cleanup: {
        attempted: true,
        purgeOutcome: "PASS",
        ownedResourcesAfter: afterCleanup,
        stateRemoved: !existsSync(stateRoot),
      },
      artifactPolicy: {
        credentialsRetained: false,
        customerDataRetained: false,
        rawProviderPayloadRetained: false,
        runnerPathsRetained: false,
        sanitizationScan: "PASS",
      },
      claimBoundary: RECEIPT_CLAIM_BOUNDARY,
    };
    writeSanitizedArtifacts(artifactDir, logs, secretValues, failure);
    validateArtifactDirectory(artifactDir, ["cleanup.log", "e2e.log", "failure.json"]);
    throw validationError;
  }
  writeSanitizedArtifacts(artifactDir, logs, secretValues, receipt);
  validateArtifactDirectory(artifactDir, SUCCESS_RETAINED_FILES);
  return receipt;
}

function parseArguments(argv) {
  const [command, ...tokens] = argv;
  const values = {};
  for (let index = 0; index < tokens.length; index += 2) {
    const key = tokens[index];
    const value = tokens[index + 1];
    if (!key?.startsWith("--") || value === undefined) throw new Error("ARGUMENTS_INVALID");
    const name = key.slice(2);
    if (Object.hasOwn(values, name)) throw new Error(`ARGUMENT_DUPLICATED:${name}`);
    values[name] = value;
  }
  return { command, values };
}

async function main(argv) {
  const { command, values } = parseArguments(argv);
  if (command === "run") {
    const allowed = ["artifact-dir", "event", "namespace", "run-attempt", "run-id", "target-sha", "timeout-seconds"];
    if (Object.keys(values).some((key) => !allowed.includes(key))) throw new Error("ARGUMENT_UNKNOWN");
    const receipt = await runCurrentHeadE2E({
      artifactDir: values["artifact-dir"],
      event: values.event,
      namespace: values.namespace,
      runAttempt: Number(values["run-attempt"]),
      runId: values["run-id"],
      targetSha: values["target-sha"],
      timeoutSeconds: Number(values["timeout-seconds"]),
    });
    process.stdout.write(`DEMO_CURRENT_HEAD_E2E_PASS ${receipt.receiptDigest}\n`);
    return;
  }
  if (command === "purge") {
    if (!exactKeys(values, ["namespace"])) throw new Error("ARGUMENTS_INVALID");
    if (!NAMESPACE_RE.test(values.namespace ?? "")) throw new Error("NAMESPACE_INVALID");
    const cleanupLog = [];
    const after = await purgeOwned(values.namespace, cleanupLog, {});
    if (Object.values(after).some((count) => count !== 0)) throw new Error("CLEANUP_OWNED_RESIDUE");
    process.stdout.write("DEMO_CURRENT_HEAD_E2E_PURGE_PASS\n");
    return;
  }
  if (command === "verify") {
    const allowed = ["now-ms", "receipt", "target-sha", "target-tree"];
    if (Object.keys(values).some((key) => !allowed.includes(key)) || !exactKeys(values, allowed)) throw new Error("ARGUMENTS_INVALID");
    const receipt = JSON.parse(readFileSync(resolve(values.receipt), "utf8"));
    const bindings = repositoryBindings(SCRIPT_ROOT);
    const result = validateSuccessReceipt(receipt, {
      ...bindings,
      commitSha: values["target-sha"],
      maxAgeMs: RECEIPT_MAX_AGE_MS,
      nowMs: Number(values["now-ms"]),
      treeSha: values["target-tree"],
    });
    if (result.outcome !== "PASS") throw new Error(result.reasonCodes.join(","));
    process.stdout.write(`DEMO_CURRENT_HEAD_E2E_RECEIPT_PASS ${receipt.receiptDigest}\n`);
    return;
  }
  if (command === "verify-completion") {
    const allowed = ["envelope", "now-ms", "target-sha", "target-tree"];
    if (Object.keys(values).some((key) => !allowed.includes(key)) || !exactKeys(values, allowed)) throw new Error("ARGUMENTS_INVALID");
    const envelope = JSON.parse(readFileSync(resolve(values.envelope), "utf8"));
    const bindings = repositoryBindings(SCRIPT_ROOT);
    const result = validateReleaseCompletion(envelope, {
      ...bindings,
      commitSha: values["target-sha"],
      maxAgeMs: RECEIPT_MAX_AGE_MS,
      nowMs: Number(values["now-ms"]),
      treeSha: values["target-tree"],
    });
    if (result.outcome !== "PASS") throw new Error(result.reasonCodes.join(","));
    process.stdout.write(`DEMO_CURRENT_HEAD_E2E_COMPLETION_PASS ${envelope.receipt.receiptDigest}\n`);
    return;
  }
  throw new Error("USAGE: demo-current-head-e2e.mjs <run|purge|verify|verify-completion> [arguments]");
}

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => {
    interruption ??= signal;
    killProcessGroup(activeChild, "SIGTERM");
  });
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main(process.argv.slice(2)).catch((error) => {
    process.stderr.write(`DEMO_CURRENT_HEAD_E2E_FAIL ${sanitizeArtifactText(error.message)}\n`);
    process.exitCode = 1;
  });
}
