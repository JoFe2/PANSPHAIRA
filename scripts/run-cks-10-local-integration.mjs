#!/usr/bin/env node
/**
 * Deterministic, offline CKS-10 integration dry-run.
 *
 * This composes the frozen minimized-projection publisher and contract, the
 * envelope guards, candidate-return contract, P21 replay, and sandboxed
 * rollback readback. It reads only committed synthetic fixtures/receipts and
 * writes no repository state. The rollback dependency owns its disposable OS
 * tmpdir sandbox and removes it before returning.
 *
 * usage: node --jitless scripts/run-cks-10-local-integration.mjs
 */
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

import { buildReadOnlyProjection, canonicalize, sha256 } from "../src/cks-10/read-only-projection-publisher.mjs";
import { verifyProjectionEnvelope } from "../src/cks-10/projection-envelope-guards.mjs";
import { validateP21Replay } from "./verify-cks-10-p21-replay.mjs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const MANIFEST_PATH = "tests/fixtures/cks-10/local-integration-manifest-v1.json";
const DIGEST_RE = /^[a-f0-9]{64}$/u;
const REQUIRED_P21_CLASSES = ["GAP", "CLUSTER", "CO_USAGE", "NEGATIVE_EVIDENCE", "PATTERN"];
const FORBIDDEN_PROJECTION_KEYS = new Set([
  "canonicalEvidence", "rawPrompt", "rawRows", "credential", "approvalToken",
  "mutablePolicy", "workflowDefinition", "effectPayload", "callback",
]);

const sha256Bytes = (bytes) => createHash("sha256").update(bytes).digest("hex");
const isObject = (value) => value !== null && typeof value === "object" && !Array.isArray(value);
const readBytes = (relativePath) => readFileSync(resolve(ROOT, relativePath));
const readJson = (relativePath) => JSON.parse(readBytes(relativePath).toString("utf8"));
const clone = (value) => structuredClone(value);

function fail(code) {
  throw new Error(code);
}

function assert(condition, code) {
  if (!condition) fail(code);
}

function hasReason(result, reason) {
  return result.outcome === "DENIED" && result.reasonCodes.some((code) => code === reason || code.startsWith(`${reason}:`));
}

function expectDenied(name, operation, reason) {
  const result = operation();
  assert(hasReason(result, reason), `FAIL_CLOSED_CASE_FAILED:${name}:${result.outcome}:${result.reasonCodes?.join(",") ?? "NO_REASONS"}`);
  return name;
}

function receiptIssues(manifest, readDisk) {
  const issues = [];
  if (!isObject(manifest) || manifest.schemaVersion !== "pansphaira.cks10/local-integration-manifest/v1") {
    return ["INVALID_MANIFEST_SCHEMA"];
  }
  if (!Array.isArray(manifest.dependencyReceipts)) {
    issues.push("DEPENDENCY_RECEIPT_SET_INVALID");
    return issues;
  }
  if (manifest.dependencyReceipts.length !== 6) issues.push("DEPENDENCY_RECEIPT_SET_INVALID");
  const byId = new Map();
  for (const dependency of manifest.dependencyReceipts) {
    if (!isObject(dependency) || typeof dependency.receiptId !== "string" || typeof dependency.path !== "string" ||
        !DIGEST_RE.test(dependency.sha256 ?? "") || !Array.isArray(dependency.dependsOn)) {
      issues.push("DEPENDENCY_RECEIPT_INVALID");
      continue;
    }
    if (byId.has(dependency.receiptId)) issues.push(`DUPLICATE_DEPENDENCY_ID:${dependency.receiptId}`);
    byId.set(dependency.receiptId, dependency);
    if (readDisk) {
      let raw;
      try {
        raw = readBytes(dependency.path);
      } catch {
        issues.push(`DEPENDENCY_RECEIPT_MISSING:${dependency.receiptId}`);
        continue;
      }
      if (sha256Bytes(raw) !== dependency.sha256) issues.push(`DEPENDENCY_RECEIPT_DIGEST_MISMATCH:${dependency.receiptId}`);
      try {
        if (!isObject(JSON.parse(raw.toString("utf8")))) issues.push(`DEPENDENCY_RECEIPT_INVALID_JSON:${dependency.receiptId}`);
      } catch {
        issues.push(`DEPENDENCY_RECEIPT_INVALID_JSON:${dependency.receiptId}`);
      }
    }
  }
  for (const dependency of byId.values()) {
    for (const requiredId of dependency.dependsOn) {
      if (!byId.has(requiredId)) issues.push(`UNRESOLVED_DEPENDENCY:${dependency.receiptId}:${requiredId}`);
    }
  }
  const visiting = new Set();
  const complete = new Set();
  const visit = (id) => {
    if (complete.has(id)) return;
    if (visiting.has(id)) {
      issues.push(`DEPENDENCY_CYCLE:${id}`);
      return;
    }
    visiting.add(id);
    for (const child of byId.get(id)?.dependsOn ?? []) if (byId.has(child)) visit(child);
    visiting.delete(id);
    complete.add(id);
  };
  for (const id of byId.keys()) visit(id);

  if (!Array.isArray(manifest.issueCriteria) || manifest.issueCriteria.length !== 5) {
    issues.push("ISSUE_CRITERIA_SET_INVALID");
  } else {
    const criterionIds = new Set();
    for (const criterion of manifest.issueCriteria) {
      if (!isObject(criterion) || typeof criterion.criterionId !== "string" ||
          !byId.has(criterion.producerReceipt) || !byId.has(criterion.consumerReceipt) ||
          !Array.isArray(criterion.expectedReceipts) || criterion.expectedReceipts.length === 0) {
        issues.push("ISSUE_CRITERION_UNRESOLVED");
        continue;
      }
      if (criterionIds.has(criterion.criterionId)) issues.push(`DUPLICATE_CRITERION_ID:${criterion.criterionId}`);
      criterionIds.add(criterion.criterionId);
    }
  }
  return [...new Set(issues)].sort();
}

function expectManifestDenial(name, manifest, expectedPrefix) {
  const issues = receiptIssues(manifest, false);
  assert(issues.some((issue) => issue.startsWith(expectedPrefix)), `MANIFEST_FAIL_CLOSED_CASE_FAILED:${name}:${issues.join(",")}`);
  return name;
}

function assertProjectionBoundary(projection, manifest) {
  assert(projection.contract.contractId === manifest.projection.contractId, "PROJECTION_CONTRACT_ID_MISMATCH");
  assert(projection.contract.contractVersion === manifest.projection.contractVersion, "PROJECTION_CONTRACT_VERSION_MISMATCH");
  assert(projection.exchange.projectionDigest === manifest.projection.projectionDigest, "PROJECTION_DIGEST_RECEIPT_MISMATCH");
  const withoutDigest = clone(projection);
  delete withoutDigest.exchange.projectionDigest;
  assert(sha256(withoutDigest) === projection.exchange.projectionDigest, "PROJECTION_SELF_DIGEST_MISMATCH");
  assert(canonicalize(projection.boundary) === canonicalize({
    readOnly: true, authorityClass: "NONE", effectClass: "NONE", promotionClaim: "NONE", writeInstructionAllowed: false,
  }), "PROJECTION_BOUNDARY_MISMATCH");
  assert(projection.records.map((record) => record.recordClass).join(",") === manifest.projection.recordClasses.join(","), "PROJECTION_CLASS_COVERAGE_MISMATCH");
  for (const record of projection.records) {
    assert(typeof record.recordId === "string" && typeof record.assetVersion === "string" && DIGEST_RE.test(record.assetDigest), "PROJECTION_ID_VERSION_DIGEST_INVALID");
    assert(typeof record.assetClass === "string" && typeof record.evidenceClass === "string", "PROJECTION_CLASS_METADATA_INVALID");
  }
  const scanKeys = (value) => {
    if (Array.isArray(value)) return value.forEach(scanKeys);
    if (!isObject(value)) return;
    for (const [key, child] of Object.entries(value)) {
      assert(!FORBIDDEN_PROJECTION_KEYS.has(key), `PROJECTION_EXCLUDED_PAYLOAD_PRESENT:${key}`);
      scanKeys(child);
    }
  };
  scanKeys(projection);
  for (const excluded of ["SECRETS", "CREDENTIALS", "RAW_PROMPTS_COMPLETIONS_MESSAGES_OR_CHAIN_OF_THOUGHT", "MUTABLE_POLICY_STATE"]) {
    assert(projection.excludedFields.includes(excluded), `PROJECTION_EXCLUSION_DECLARATION_MISSING:${excluded}`);
  }
}

function runChild(label, args, requiredFragment) {
  const child = spawnSync(process.execPath, ["--jitless", ...args], {
    cwd: ROOT,
    encoding: "utf8",
    env: { ...process.env, NO_COLOR: "1" },
  });
  assert(child.error === undefined, `CHILD_PROCESS_ERROR:${label}:${child.error?.code ?? "UNKNOWN"}`);
  assert(child.status === 0, `CHILD_PROCESS_FAILED:${label}:exit=${child.status}:signal=${child.signal}:stderr=${child.stderr.trim()}`);
  const stdout = child.stdout.trim();
  assert(stdout.includes(requiredFragment), `CHILD_PROCESS_RECEIPT_MISSING:${label}:${stdout}`);
  return stdout;
}

function main() {
  const manifest = readJson(MANIFEST_PATH);
  const dependencyIssues = receiptIssues(manifest, true);
  assert(dependencyIssues.length === 0, `DEPENDENCY_RECEIPTS_INVALID:${dependencyIssues.join(",")}`);
  for (const artifact of manifest.inputArtifacts) {
    assert(sha256Bytes(readBytes(artifact.path)) === artifact.sha256, `INPUT_ARTIFACT_DIGEST_MISMATCH:${artifact.path}`);
  }

  const manifestFailures = [
    expectManifestDenial("missing_dependency_receipt", { ...clone(manifest), dependencyReceipts: clone(manifest.dependencyReceipts).slice(1) }, "DEPENDENCY_RECEIPT_SET_INVALID"),
    expectManifestDenial("duplicate_id", (() => { const value = clone(manifest); value.dependencyReceipts.push(clone(value.dependencyReceipts[0])); return value; })(), "DUPLICATE_DEPENDENCY_ID"),
    expectManifestDenial("invalid_manifest_schema", { ...clone(manifest), schemaVersion: "invalid" }, "INVALID_MANIFEST_SCHEMA"),
    expectManifestDenial("unresolved_dependency", (() => { const value = clone(manifest); value.dependencyReceipts[0].dependsOn = ["missing-receipt"]; return value; })(), "UNRESOLVED_DEPENDENCY"),
    expectManifestDenial("dependency_cycle", (() => { const value = clone(manifest); value.dependencyReceipts[0].dependsOn = ["rollback-readback"]; return value; })(), "DEPENDENCY_CYCLE"),
  ];

  const publisherInput = readJson("tests/fixtures/cks-10/publisher-input-v1.json");
  const projection = buildReadOnlyProjection(publisherInput);
  assertProjectionBoundary(projection, manifest);
  const trustedNowMs = Date.parse("2026-08-28T04:30:00Z");
  const envelopeVerified = verifyProjectionEnvelope(projection, {
    expectedEnvelope: clone(projection), authorityProjectionDigest: projection.exchange.projectionDigest,
    nowMs: trustedNowMs, replayState: new Map(),
  });
  assert(envelopeVerified.outcome === "VERIFIED", `ENVELOPE_POSITIVE_FAILED:${envelopeVerified.reasonCodes.join(",")}`);
  const envelopeFailures = [
    expectDenied("tenant_scope_mismatch", () => {
      const altered = clone(projection); altered.tenantScope.opaqueTenantScopeId = "tscope-290-other";
      return verifyProjectionEnvelope(altered, { expectedEnvelope: projection, authorityProjectionDigest: projection.exchange.projectionDigest, nowMs: trustedNowMs, replayState: new Map() });
    }, "TENANT_SCOPE_MISMATCH"),
    expectDenied("retention_expired", () => verifyProjectionEnvelope(projection, {
      expectedEnvelope: projection, authorityProjectionDigest: projection.exchange.projectionDigest,
      nowMs: Date.parse("2026-08-28T05:12:00Z"), replayState: new Map(),
    }), "RETENTION_EXPIRED"),
    expectDenied("freshness_stale", () => verifyProjectionEnvelope(projection, {
      expectedEnvelope: projection, authorityProjectionDigest: projection.exchange.projectionDigest,
      nowMs: Date.parse("2026-08-28T05:12:00Z"), replayState: new Map(),
    }), "FRESHNESS_STALE"),
    expectDenied("provenance_mismatch", () => {
      const altered = clone(projection); altered.records[0].sources[0].provenanceDigest = "0".repeat(64);
      return verifyProjectionEnvelope(altered, { expectedEnvelope: projection, authorityProjectionDigest: projection.exchange.projectionDigest, nowMs: trustedNowMs, replayState: new Map() });
    }, "PROVENANCE_BINDING_MISMATCH"),
  ];

  const candidateValidation = runChild("candidate_contract", ["scripts/validate-cks-10-candidate-return.mjs", "tests/fixtures/cks-10/candidate-return-cases-v1.json"], "cks-10-candidate-return: PASS");
  const candidateFailClosed = runChild("candidate_contract_self_test", ["scripts/validate-cks-10-candidate-return.mjs", "--self-test"], "SELF_TEST PASS cases=29 failures=0");

  const p21Projection = readJson("tests/fixtures/cks-10/p21-planted-projection-v1.json");
  const p21Expected = readJson("tests/fixtures/cks-10/p21-expected-candidates-v1.json");
  const p21NowMs = readJson("tests/fixtures/cks-10/p21-replay-negative-cases-v1.json").trustedNowMs;
  const p21State = new Map();
  const p21Verified = validateP21Replay({
    projection: p21Projection, trustedProjection: clone(p21Projection), authorityProjectionDigest: p21Projection.exchange.projectionDigest, expected: p21Expected,
    emitted: clone(p21Expected), nowMs: p21NowMs, replayState: p21State,
  });
  assert(p21Verified.outcome === "VERIFIED", `P21_POSITIVE_FAILED:${p21Verified.reasonCodes.join(",")}`);
  const producedClasses = p21Verified.candidateSet.candidates.map((candidate) => candidate.candidateClass);
  for (const candidateClass of REQUIRED_P21_CLASSES) assert(producedClasses.includes(candidateClass), `P21_REQUIRED_CANDIDATE_MISSING:${candidateClass}`);
  assert(p21Verified.inventedEdges === 0 && p21Verified.candidateBlindSpotCount === 14 && p21Verified.globalBlindSpots.length === 5, "P21_BLIND_SPOT_OR_EDGE_RECEIPT_MISMATCH");
  assert(p21Verified.authorityClass === "NONE" && p21Verified.promotionClaim === "NONE", "P21_AUTHORITY_BOUNDARY_MISMATCH");
  const p21Failures = [
    expectDenied("candidate_authority_field", () => {
      const emitted = clone(p21Expected); emitted.candidates[0].authorityClass = "FULL";
      return validateP21Replay({ projection: p21Projection, trustedProjection: p21Projection, authorityProjectionDigest: p21Projection.exchange.projectionDigest, expected: p21Expected, emitted, nowMs: p21NowMs, replayState: new Map() });
    }, "AUTHORITY_BEARING_FIELD"),
    expectDenied("invented_evidence_edge", () => {
      const emitted = clone(p21Expected); emitted.allowedEvidenceEdges.push({ edgeId: "edge-p21-invented-290-0001" });
      return validateP21Replay({ projection: p21Projection, trustedProjection: p21Projection, authorityProjectionDigest: p21Projection.exchange.projectionDigest, expected: p21Expected, emitted, nowMs: p21NowMs, replayState: new Map() });
    }, "INVENTED_EDGE"),
    expectDenied("blind_spot_omission", () => {
      const emitted = clone(p21Expected); emitted.candidates[0].blindSpots.pop();
      return validateP21Replay({ projection: p21Projection, trustedProjection: p21Projection, authorityProjectionDigest: p21Projection.exchange.projectionDigest, expected: p21Expected, emitted, nowMs: p21NowMs, replayState: new Map() });
    }, "BLIND_SPOTS_MISMATCH"),
    expectDenied("replayed_candidate", () => validateP21Replay({
      projection: p21Projection, trustedProjection: clone(p21Projection), authorityProjectionDigest: p21Projection.exchange.projectionDigest, expected: p21Expected,
      emitted: clone(p21Expected), nowMs: p21NowMs, replayState: p21State,
    }), "REPLAYED_CANDIDATE"),
    expectDenied("replay_mutation", () => {
      const replayState = new Map([[p21Projection.exchange.replayId, "different-fingerprint"]]);
      return validateP21Replay({ projection: p21Projection, trustedProjection: clone(p21Projection), authorityProjectionDigest: p21Projection.exchange.projectionDigest, expected: p21Expected, emitted: clone(p21Expected), nowMs: p21NowMs, replayState });
    }, "DENIED_REPLAY_MUTATION"),
  ];

  const rollbackDryRun = runChild("rollback_readback_dry_run", ["scripts/verify-cks-10-projection-rollback.mjs", "--dry-run"], "cks-10-projection-rollback: PASS mode=dry-run plannedRemovals=2 canonicalDigest=32bc11fa39e14484e5c7b3f3243f79092b87464e5eccf325e12e1a6e9a456674");
  const canonical = readJson(manifest.canonicalEvidenceReadback.fixture);
  assert(canonical.snapshotDigest === manifest.canonicalEvidenceReadback.snapshotDigest, "CANONICAL_SNAPSHOT_DIGEST_MISMATCH");
  assert(sha256Bytes(readBytes(manifest.canonicalEvidenceReadback.fixture)) === manifest.canonicalEvidenceReadback.exactBytesSha256, "CANONICAL_BYTES_CHANGED");

  console.log(JSON.stringify({
    schemaVersion: "pansphaira.cks10/local-integration-receipt/v1",
    integrationId: "cks10-local-integration-290-0001",
    taskId: manifest.taskId,
    mode: manifest.mode,
    outcome: "VERIFIED",
    dependencyReceiptIds: manifest.dependencyReceipts.map((receipt) => receipt.receiptId),
    issueCriteria: manifest.issueCriteria.map((criterion) => criterion.criterionId),
    projection: { digest: projection.exchange.projectionDigest, recordClasses: projection.records.map((record) => record.recordClass), authorityClass: projection.boundary.authorityClass },
    envelope: { outcome: envelopeVerified.outcome, failClosed: envelopeFailures },
    candidateContract: { validation: candidateValidation, failClosedSelfTest: candidateFailClosed },
    p21: { outcome: p21Verified.outcome, candidateClasses: producedClasses, inventedEdges: p21Verified.inventedEdges, blindSpots: p21Verified.globalBlindSpots.length + p21Verified.candidateBlindSpotCount, failClosed: p21Failures },
    rollbackReadback: { outcome: manifest.canonicalEvidenceReadback.expectedDryRun, canonicalBytesSha256: manifest.canonicalEvidenceReadback.exactBytesSha256, receipt: rollbackDryRun },
    manifestFailClosed: manifestFailures,
    preservedDecisions: manifest.preservedDecisions,
  }));
}

try {
  main();
} catch (error) {
  console.error(`cks-10-local-integration: FAIL ${error instanceof Error ? error.message : "UNKNOWN"}`);
  process.exitCode = 1;
}
