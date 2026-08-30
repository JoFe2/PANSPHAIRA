#!/usr/bin/env node
/**
 * Deterministic CKS-10 local delivery-readback harness.
 *
 * This is a read-only, offline gate over the committed synthetic CKS-10
 * evidence set. It verifies the exact manifest byte pin, materialized leaves,
 * artifact digests, dependency graph, criterion mapping, and RELEASE_REQUIRED_PENDING_DELIVERY state.
 * It does not create a PR, invoke CI, wait on an external actor, merge, release,
 * or close an issue. Those actions need separate authorization.
 *
 * Usage:
 *   node scripts/verify-cks-10-delivery-readback.mjs
 *   node scripts/verify-cks-10-delivery-readback.mjs --self-test
 */
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const MANIFEST_PATH = "tests/fixtures/cks-10/delivery-readback-manifest-v1.json";
const EXPECTED_MANIFEST_SHA256 = "47e5c08c85e1e71b4c0b6c849acdb265ef9632b760856e774ca34d089f7ca7e8";
const DIGEST_RE = /^[a-f0-9]{64}$/u;
const VERSION = "1.0.0";
const PRESERVED_DECISIONS = ["D-001", "D-002", "D-003", "D-004", "D-005", "D-006", "D-007"];
const REQUIRED_ARTIFACT_IDS = [
  "boundary-decision", "projection-schema", "candidate-return-schema",
  "prerequisite-fixture", "projection-fixture", "candidate-return-fixture",
  "p21-projection-fixture", "p21-expected-fixture", "p21-negative-fixture",
  "canonical-evidence-fixture", "local-integration-manifest",
  "prerequisite-validator", "projection-validator", "candidate-return-validator",
  "p21-validator", "rollback-harness", "local-integration-runner",
  "boundary-decision-receipt", "prerequisite-receipt", "projection-contract-receipt",
  "publisher-receipt", "envelope-guards-receipt", "candidate-return-receipt",
  "p21-replay-receipt", "rollback-readback-receipt", "local-integration-receipt",
];
const REQUIRED_CRITERIA = {
  "AC-1-MINIMIZED-PROJECTION": ["projection-schema", "projection-fixture", "projection-validator", "projection-contract-receipt", "publisher-receipt"],
  "AC-2-FAIL-CLOSED-ENVELOPE": ["projection-contract-receipt", "envelope-guards-receipt", "local-integration-runner", "local-integration-receipt"],
  "AC-3-P21-REPLAY": ["p21-projection-fixture", "p21-expected-fixture", "p21-negative-fixture", "p21-validator", "p21-replay-receipt"],
  "AC-4-CANDIDATE-AUTHORITY-BOUNDARY": ["candidate-return-schema", "candidate-return-fixture", "candidate-return-validator", "candidate-return-receipt", "p21-replay-receipt"],
  "AC-5-ROLLBACK-READBACK": ["canonical-evidence-fixture", "rollback-harness", "rollback-readback-receipt", "local-integration-receipt"],
};
const REQUIRED_DELIVERY_STATE = {
  decision: "RELEASE_REQUIRED_PENDING_DELIVERY",
  releaseRequired: true,
  releasePerformed: false,
  implementationAuthorization: false,
  pullRequestAuthorization: false,
  ciAuthorization: false,
  mergeAuthorization: false,
  releaseAuthorization: false,
  issueCloseAuthorization: false,
  externalWaitState: "NONE",
  externalClaimState: "NONE",
};
const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");
const isObject = (value) => value !== null && typeof value === "object" && !Array.isArray(value);
const sameList = (left, right) => Array.isArray(left) && left.length === right.length && left.every((item, index) => item === right[index]);
const uniqueSorted = (values) => [...new Set(values)].sort();

function add(issues, code) {
  if (!issues.includes(code)) issues.push(code);
}

function exactKeys(value, keys, path, issues) {
  if (!isObject(value)) {
    add(issues, `TYPE_OBJECT:${path}`);
    return false;
  }
  for (const key of Object.keys(value)) if (!keys.includes(key)) add(issues, `UNKNOWN_FIELD:${path}.${key}`);
  for (const key of keys) if (!Object.hasOwn(value, key)) add(issues, `MISSING_FIELD:${path}.${key}`);
  return true;
}

function validRelativePath(path) {
  return typeof path === "string" && path.length > 0 && !path.startsWith("/") && !path.split("/").includes("..");
}

function graphIssues(dependencies, artifactIds, issues) {
  if (!Array.isArray(dependencies)) {
    add(issues, "DEPENDENCY_SET_INVALID");
    return;
  }
  const byId = new Map();
  for (const [index, entry] of dependencies.entries()) {
    if (!exactKeys(entry, ["artifactId", "dependsOn"], `dependencies.${index}`, issues)) continue;
    if (typeof entry.artifactId !== "string" || !Array.isArray(entry.dependsOn)) {
      add(issues, `DEPENDENCY_INVALID:${index}`);
      continue;
    }
    if (byId.has(entry.artifactId)) add(issues, `DUPLICATE_DEPENDENCY:${entry.artifactId}`);
    byId.set(entry.artifactId, entry.dependsOn);
    for (const dependency of entry.dependsOn) {
      if (!artifactIds.has(dependency)) add(issues, `UNRESOLVED_DEPENDENCY:${entry.artifactId}:${dependency}`);
    }
  }
  const visiting = new Set();
  const visited = new Set();
  const visit = (id) => {
    if (visited.has(id)) return;
    if (visiting.has(id)) {
      add(issues, `DEPENDENCY_CYCLE:${id}`);
      return;
    }
    visiting.add(id);
    for (const dependency of byId.get(id) ?? []) if (byId.has(dependency)) visit(dependency);
    visiting.delete(id);
    visited.add(id);
  };
  for (const id of byId.keys()) visit(id);
}

function manifestIssues(manifest, { pinManifest = true, manifestBytes = null } = {}) {
  const issues = [];
  const rootKeys = ["schemaVersion", "manifestId", "manifestVersion", "taskId", "preservedDecisions", "deliveryState", "artifacts", "dependencies", "criteria"];
  if (!exactKeys(manifest, rootKeys, "manifest", issues)) return issues;
  if (manifest.schemaVersion !== "pansphaira.cks10/delivery-readback-manifest/v1") add(issues, "MANIFEST_SCHEMA_UNSUPPORTED");
  if (manifest.manifestId !== "cks10-delivery-readback-manifest-290-0001") add(issues, "MANIFEST_ID_UNSUPPORTED");
  if (manifest.manifestVersion !== VERSION) add(issues, "MANIFEST_VERSION_UNSUPPORTED");
  if (manifest.taskId !== "INT-PSAI290-DELIVERY-READBACK-02") add(issues, "TASK_ID_MISMATCH");
  if (!sameList(manifest.preservedDecisions, PRESERVED_DECISIONS)) add(issues, "PRESERVED_DECISIONS_MISMATCH");
  if (!isObject(manifest.deliveryState) || Object.keys(REQUIRED_DELIVERY_STATE).some((key) => manifest.deliveryState[key] !== REQUIRED_DELIVERY_STATE[key]) ||
      Object.keys(manifest.deliveryState ?? {}).some((key) => !Object.hasOwn(REQUIRED_DELIVERY_STATE, key))) {
    add(issues, "PREMATURE_EXTERNAL_WAIT_OR_CLAIM");
  }
  if (pinManifest && (manifestBytes === null || sha256(manifestBytes) !== EXPECTED_MANIFEST_SHA256)) add(issues, "MANIFEST_DIGEST_MISMATCH");
  if (!Array.isArray(manifest.artifacts)) {
    add(issues, "ARTIFACT_SET_INVALID");
    return issues;
  }
  const artifactIds = new Set();
  for (const [index, artifact] of manifest.artifacts.entries()) {
    const path = `artifacts.${index}`;
    if (!exactKeys(artifact, ["artifactId", "artifactClass", "path", "sha256", "minimumBytes", "requiredMarkers"], path, issues)) continue;
    if (typeof artifact.artifactId !== "string" || !REQUIRED_ARTIFACT_IDS.includes(artifact.artifactId)) add(issues, `ARTIFACT_ID_UNSUPPORTED:${artifact.artifactId ?? index}`);
    if (artifactIds.has(artifact.artifactId)) add(issues, `DUPLICATE_ARTIFACT_ID:${artifact.artifactId}`);
    artifactIds.add(artifact.artifactId);
    if (!new Set(["DECISION", "CONTRACT", "FIXTURE", "VALIDATOR", "RECEIPT"]).has(artifact.artifactClass)) add(issues, `ARTIFACT_CLASS_INVALID:${artifact.artifactId}`);
    if (!validRelativePath(artifact.path)) add(issues, `ARTIFACT_PATH_INVALID:${artifact.artifactId}`);
    if (!DIGEST_RE.test(artifact.sha256 ?? "")) add(issues, `ARTIFACT_DIGEST_INVALID:${artifact.artifactId}`);
    if (!Number.isInteger(artifact.minimumBytes) || artifact.minimumBytes < 512) add(issues, `ARTIFACT_MINIMUM_BYTES_INVALID:${artifact.artifactId}`);
    if (!Array.isArray(artifact.requiredMarkers) || artifact.requiredMarkers.length < 2 || artifact.requiredMarkers.some((marker) => typeof marker !== "string" || marker.length < 3)) add(issues, `ARTIFACT_MARKERS_INVALID:${artifact.artifactId}`);
  }
  for (const requiredId of REQUIRED_ARTIFACT_IDS) if (!artifactIds.has(requiredId)) add(issues, `MISSING_MATERIALIZED_LEAF:${requiredId}`);
  if (artifactIds.size !== REQUIRED_ARTIFACT_IDS.length || manifest.artifacts.length !== REQUIRED_ARTIFACT_IDS.length) add(issues, "ARTIFACT_SET_INVALID");
  graphIssues(manifest.dependencies, artifactIds, issues);
  if (!Array.isArray(manifest.criteria) || manifest.criteria.length !== Object.keys(REQUIRED_CRITERIA).length) {
    add(issues, "CRITERION_SET_INVALID");
  } else {
    const criterionIds = new Set();
    for (const [index, criterion] of manifest.criteria.entries()) {
      if (!exactKeys(criterion, ["criterionId", "evidenceArtifactIds"], `criteria.${index}`, issues)) continue;
      criterionIds.add(criterion.criterionId);
      const expected = REQUIRED_CRITERIA[criterion.criterionId];
      if (!expected) add(issues, `CRITERION_UNSUPPORTED:${criterion.criterionId}`);
      else if (!Array.isArray(criterion.evidenceArtifactIds) || expected.some((id) => !criterion.evidenceArtifactIds.includes(id)) ||
          criterion.evidenceArtifactIds.some((id) => !artifactIds.has(id))) add(issues, `CRITERION_MAPPING_UNRESOLVED:${criterion.criterionId}`);
    }
    for (const id of Object.keys(REQUIRED_CRITERIA)) if (!criterionIds.has(id)) add(issues, `MISSING_CRITERION:${id}`);
    if (criterionIds.size !== Object.keys(REQUIRED_CRITERIA).length) add(issues, "CRITERION_SET_INVALID");
  }
  return issues;
}

function materializedLeafIssues(manifest, readArtifact) {
  const issues = [];
  for (const artifact of manifest.artifacts ?? []) {
    let bytes;
    try {
      bytes = readArtifact(artifact.path);
    } catch {
      add(issues, `MISSING_MATERIALIZED_LEAF:${artifact.artifactId}`);
      continue;
    }
    if (!Buffer.isBuffer(bytes) && !(bytes instanceof Uint8Array)) {
      add(issues, `LEAF_READ_INVALID:${artifact.artifactId}`);
      continue;
    }
    const normalized = Buffer.from(bytes);
    if (normalized.length < artifact.minimumBytes) add(issues, `SKELETON_ONLY_LEAF:${artifact.artifactId}`);
    if (sha256(normalized) !== artifact.sha256) add(issues, `ARTIFACT_DIGEST_MISMATCH:${artifact.artifactId}`);
    const text = normalized.toString("utf8");
    for (const marker of artifact.requiredMarkers ?? []) if (!text.includes(marker)) add(issues, `SKELETON_ONLY_LEAF:${artifact.artifactId}`);
    if (["CONTRACT", "FIXTURE", "RECEIPT"].includes(artifact.artifactClass)) {
      try {
        const parsed = JSON.parse(text);
        if (!isObject(parsed) || Object.keys(parsed).length < 2) add(issues, `SKELETON_ONLY_LEAF:${artifact.artifactId}`);
      } catch {
        add(issues, `LEAF_INVALID_JSON:${artifact.artifactId}`);
      }
    }
  }
  return issues;
}

function buildReceipt(manifest, manifestBytes) {
  return {
    schemaVersion: "pansphaira.cks10/delivery-readback-receipt/v1",
    receiptId: "cks-10-delivery-readback-v1-290-0001",
    taskId: manifest.taskId,
    outcome: "VERIFIED_LOCAL_READBACK_ONLY",
    decision: "RELEASE_REQUIRED_PENDING_DELIVERY",
    manifest: { manifestId: manifest.manifestId, manifestVersion: manifest.manifestVersion, exactBytesSha256: sha256(manifestBytes) },
    verifiedArtifacts: manifest.artifacts.map(({ artifactId, artifactClass, sha256: digest }) => ({ artifactId, artifactClass, sha256: digest })),
    criteria: manifest.criteria.map(({ criterionId, evidenceArtifactIds }) => ({ criterionId, evidenceArtifactIds })),
    failClosed: ["MISSING_MATERIALIZED_LEAF", "UNRESOLVED_DEPENDENCY", "DEPENDENCY_CYCLE", "SKELETON_ONLY_LEAF", "PREMATURE_EXTERNAL_WAIT_OR_CLAIM"],
    releaseChecklist: manifest.deliveryState,
    preservedDecisions: manifest.preservedDecisions,
    externalActionsPerformed: false,
  };
}

function verify({ manifest, manifestBytes, readArtifact, pinManifest = true }) {
  const issues = manifestIssues(manifest, { pinManifest, manifestBytes });
  if (issues.length === 0) issues.push(...materializedLeafIssues(manifest, readArtifact));
  if (issues.length > 0) return { outcome: "DENIED", reasonCodes: uniqueSorted(issues) };
  return { outcome: "VERIFIED", receipt: buildReceipt(manifest, manifestBytes) };
}

function loadDefault() {
  const bytes = readFileSync(resolve(ROOT, MANIFEST_PATH));
  return { manifest: JSON.parse(bytes.toString("utf8")), manifestBytes: bytes, readArtifact: (path) => readFileSync(resolve(ROOT, path)) };
}

function selfTest() {
  const baseline = loadDefault();
  const failures = [];
  let cases = 0;
  const check = (name, mutate, expected) => {
    cases += 1;
    const manifest = structuredClone(baseline.manifest);
    const bytesByPath = new Map(manifest.artifacts.map((artifact) => [artifact.path, baseline.readArtifact(artifact.path)]));
    mutate(manifest, bytesByPath);
    const result = verify({ manifest, manifestBytes: baseline.manifestBytes, pinManifest: false, readArtifact: (path) => {
      if (!bytesByPath.has(path)) throw new Error("ENOENT");
      return bytesByPath.get(path);
    } });
    if (result.outcome !== "DENIED" || !result.reasonCodes.some((code) => code.startsWith(expected))) {
      failures.push(`${name}:${result.outcome}:${result.reasonCodes?.join(",") ?? "NO_REASON"}`);
    }
  };
  cases += 1;
  if (verify(baseline).outcome !== "VERIFIED") failures.push("baseline");
  check("missing-materialized-leaf", (manifest) => { manifest.artifacts.pop(); }, "MISSING_MATERIALIZED_LEAF");
  check("unresolved-dependency", (manifest) => { manifest.dependencies[0].dependsOn.push("missing-leaf"); }, "UNRESOLVED_DEPENDENCY");
  check("dependency-cycle", (manifest) => { manifest.dependencies.push({ artifactId: "projection-schema", dependsOn: ["projection-validator"] }); }, "DEPENDENCY_CYCLE");
  check("skeleton-only-leaf", (manifest, bytesByPath) => {
    const artifact = manifest.artifacts.find((item) => item.artifactId === "projection-validator");
    const skeleton = Buffer.from("#!/usr/bin/env node\n// skeleton\n", "utf8");
    artifact.sha256 = sha256(skeleton);
    bytesByPath.set(artifact.path, skeleton);
  }, "SKELETON_ONLY_LEAF");
  check("premature-external-wait-or-claim", (manifest) => { manifest.deliveryState.releaseAuthorization = true; }, "PREMATURE_EXTERNAL_WAIT_OR_CLAIM");
  if (failures.length > 0) {
    for (const failure of failures) console.log(`cks-10-delivery-readback: SELF_TEST_FAILURE ${failure}`);
    console.log(`cks-10-delivery-readback: SELF_TEST FAIL cases=${cases} failures=${failures.length}`);
    return 1;
  }
  console.log(`cks-10-delivery-readback: SELF_TEST PASS cases=${cases} failures=0`);
  return 0;
}

function main(argv) {
  if (argv.slice(2).length === 1 && argv[2] === "--self-test") return selfTest();
  if (argv.slice(2).length !== 0) {
    console.error("usage: node scripts/verify-cks-10-delivery-readback.mjs [--self-test]");
    return 2;
  }
  try {
    const result = verify(loadDefault());
    if (result.outcome !== "VERIFIED") {
      for (const reason of result.reasonCodes) console.log(`cks-10-delivery-readback: ISSUE ${reason}`);
      console.log(`cks-10-delivery-readback: DENIED issues=${result.reasonCodes.length}`);
      return 1;
    }
    console.log(JSON.stringify(result.receipt));
    return 0;
  } catch (error) {
    console.log(`cks-10-delivery-readback: ISSUE ${error?.code === "ENOENT" ? "MANIFEST_OR_LEAF_MISSING" : "MANIFEST_INVALID_JSON"}`);
    console.log("cks-10-delivery-readback: DENIED issues=1");
    return 1;
  }
}

process.exitCode = main(process.argv);
