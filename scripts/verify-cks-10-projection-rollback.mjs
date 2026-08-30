#!/usr/bin/env node
// CKS-10 projection removal/rollback dry-run and readback harness.
//
// usage:
//   node scripts/verify-cks-10-projection-rollback.mjs [--dry-run] [fixturePath] [publisherInputPath]
//
// Local, sandboxed, dry-run-first harness. It:
//   1. materializes a throwaway sandbox (os tmpdir) containing the canonical
//      synthetic evidence snapshot (exact fixture bytes) and the generated
//      projection artifacts (built by the pure read-only projection publisher);
//   2. plans removal of ONLY generated projection artifacts (the manifest must
//      exactly cover the generated projection zone and never name the canonical
//      evidence path);
//   3. re-reads the canonical synthetic evidence after removal and proves exact
//      unchanged raw bytes, canonicalized content, and SHA-256 digests.
// It never reads rich canonicalEvidence bodies into projections, never mutates
// canonical evidence or repository files, and carries no authority or effect.
// Deletion is confined to generated artifacts inside the disposable sandbox.
//
// exit codes: 0 = VERIFIED, 1 = DENIED/failed, 2 = usage error.

import { mkdtempSync, readFileSync, writeFileSync, rmSync, mkdirSync, existsSync, unlinkSync, readdirSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

import {
  buildReadOnlyProjection,
  canonicalize,
  sha256,
} from "../src/cks-10/read-only-projection-publisher.mjs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const DEFAULT_FIXTURE = join(ROOT, "tests/fixtures/cks-10/canonical-evidence-snapshot-v1.json");
const DEFAULT_PUBLISHER_INPUT = join(ROOT, "tests/fixtures/cks-10/publisher-input-v1.json");

const ID_RE = /^[A-Za-z][A-Za-z0-9._:-]{3,127}$/u;
const DIGEST_RE = /^[a-f0-9]{64}$/u;
const EXACT_VERSION = "1.0.0";

export const ROLLBACK_SCHEMA_VERSION = "pansphaira.cks10/projection-rollback-readback/v1";
export const CANONICAL_SNAPSHOT_SCHEMA_VERSION = "pansphaira.cks10/canonical-evidence-snapshot/v1";
export const REMOVAL_MANIFEST_SCHEMA_VERSION = "pansphaira.cks10/projection-removal-manifest/v1";

export const CANONICAL_ZONE = "canonical";
export const PROJECTION_ZONE = "projection";
export const CANONICAL_RELATIVE = join(CANONICAL_ZONE, "canonical-evidence-snapshot-v1.json");
export const MANIFEST_RELATIVE = join(PROJECTION_ZONE, "removal-manifest.json");

// Frozen boundary: removal/rollback carries no authority, no effect, no
// promotion claim, and deletes nothing outside generated projection artifacts.
export const ROLLBACK_BOUNDARY = Object.freeze({
  readOnly: true,
  authorityClass: "NONE",
  effectClass: "NONE",
  promotionClaim: "NONE",
  writeInstructionAllowed: false,
  deletionZone: "GENERATED_PROJECTION_ARTIFACTS_ONLY",
  canonicalEvidenceMutation: 0,
  repoFileMutation: 0,
});

const SNAPSHOT_KEYS = ["records", "schemaVersion", "snapshotDigest", "snapshotId", "snapshotVersion"];
const SNAPSHOT_RECORD_KEYS = [
  "recordId", "recordClass", "assetId", "assetVersion", "assetDigest", "assetClass",
  "dataClassification", "evidenceClass", "sourceRefId", "provenanceDigest", "fields", "canonicalEvidence",
];
const MANIFEST_KEYS = ["artifacts", "canonicalEvidencePath", "manifestId", "schemaVersion"];
const MANIFEST_ARTIFACT_KEYS = ["path", "sha256"];
const REQUIRED_RECORD_CLASSES = new Set(["TASK", "KNOWLEDGE", "DECISION", "OUTCOME"]);

const isRecord = (value) => value !== null && typeof value === "object" && !Array.isArray(value);
const uniqueSorted = (values) => [...new Set(values)].sort();

function denied(reasonCodes, extra = {}) {
  return { outcome: "DENIED", reasonCodes: uniqueSorted(reasonCodes), boundary: ROLLBACK_BOUNDARY, ...extra };
}

// ---------------------------------------------------------------------------
// Canonical evidence snapshot validation (fail-closed, closed field set).
// ---------------------------------------------------------------------------

export function verifyCanonicalEvidenceSnapshot(snapshot) {
  const issues = [];
  if (!isRecord(snapshot)) {
    return denied(["SNAPSHOT_MUST_BE_OBJECT"]);
  }
  if (Object.keys(snapshot).some((key) => !SNAPSHOT_KEYS.includes(key))) {
    issues.push("SNAPSHOT_UNKNOWN_FIELD");
  }
  if (snapshot.schemaVersion !== CANONICAL_SNAPSHOT_SCHEMA_VERSION) {
    issues.push("SNAPSHOT_SCHEMA_VERSION_MISMATCH");
  }
  if (!ID_RE.test(typeof snapshot.snapshotId === "string" ? snapshot.snapshotId : "")) {
    issues.push("SNAPSHOT_ID_MALFORMED");
  }
  if (snapshot.snapshotVersion !== EXACT_VERSION) {
    issues.push("SNAPSHOT_VERSION_MISMATCH");
  }
  if (!Array.isArray(snapshot.records) || snapshot.records.length < 1 || snapshot.records.length > 32) {
    issues.push("SNAPSHOT_RECORDS_INVALID");
  } else {
    const recordIds = new Set();
    for (const record of snapshot.records) {
      if (!isRecord(record)) {
        issues.push("SNAPSHOT_RECORD_MUST_BE_OBJECT");
        continue;
      }
      if (Object.keys(record).some((key) => !SNAPSHOT_RECORD_KEYS.includes(key))) {
        issues.push("SNAPSHOT_RECORD_UNKNOWN_FIELD");
      }
      if (!ID_RE.test(typeof record.recordId === "string" ? record.recordId : "")) {
        issues.push("SNAPSHOT_RECORD_ID_MALFORMED");
      } else if (recordIds.has(record.recordId)) {
        issues.push("SNAPSHOT_DUPLICATE_RECORD_ID");
      } else {
        recordIds.add(record.recordId);
      }
      if (!REQUIRED_RECORD_CLASSES.has(record.recordClass)) {
        issues.push("SNAPSHOT_RECORD_CLASS_UNSUPPORTED");
      }
      if (!DIGEST_RE.test(typeof record.assetDigest === "string" ? record.assetDigest : "")) {
        issues.push("SNAPSHOT_ASSET_DIGEST_MALFORMED");
      }
      if (!DIGEST_RE.test(typeof record.provenanceDigest === "string" ? record.provenanceDigest : "")) {
        issues.push("SNAPSHOT_PROVENANCE_DIGEST_MALFORMED");
      }
      if (!Array.isArray(record.fields) || record.fields.length < 1 || record.fields.length > 64) {
        issues.push("SNAPSHOT_FIELDS_INVALID");
      }
      // The canonical synthetic evidence body is the very content the readback
      // must prove unchanged; it must be present on every record.
      if (!isRecord(record.canonicalEvidence) || Object.keys(record.canonicalEvidence).length < 1) {
        issues.push("SNAPSHOT_MISSING_CANONICAL_EVIDENCE");
      }
    }
  }
  if (!DIGEST_RE.test(typeof snapshot.snapshotDigest === "string" ? snapshot.snapshotDigest : "")) {
    issues.push("SNAPSHOT_DIGEST_MALFORMED");
  } else {
    const withoutDigest = structuredClone(snapshot);
    delete withoutDigest.snapshotDigest;
    if (sha256(withoutDigest) !== snapshot.snapshotDigest) {
      issues.push("SNAPSHOT_DIGEST_MISMATCH");
    }
  }
  if (issues.length > 0) {
    return denied(issues);
  }
  return { ok: true, outcome: "VERIFIED", reasonCodes: [], digest: snapshot.snapshotDigest, boundary: ROLLBACK_BOUNDARY };
}

// ---------------------------------------------------------------------------
// Filesystem helpers (sandbox only).
// ---------------------------------------------------------------------------

export function listTree(root) {
  const files = [];
  const walk = (dir) => {
    for (const entry of readdirSync(dir)) {
      const abs = join(dir, entry);
      const st = statSync(abs);
      if (st.isDirectory()) {
        walk(abs);
      } else if (st.isFile()) {
        files.push(relative(root, abs).split(sep).join("/"));
      }
    }
  };
  walk(root);
  return uniqueSorted(files);
}

function sameSet(a, b) {
  if (a.length !== b.length) return false;
  return a.every((value, index) => value === b[index]);
}

function isWellFormedRelativePath(value) {
  if (typeof value !== "string" || value.length < 1 || value.length > 256) return false;
  if (value.startsWith("/") || value.split("/").includes("..")) return false;
  return value.split("/").every((segment) => segment.length > 0);
}

// ---------------------------------------------------------------------------
// Removal plan: ONLY generated projection artifacts, fail-closed otherwise.
// ---------------------------------------------------------------------------

function verifyRemovalManifest(manifest, canonicalRelativePath, zoneFiles) {
  const issues = [];
  if (!isRecord(manifest)) {
    issues.push("MANIFEST_MUST_BE_OBJECT");
    return { issues, artifactPaths: [] };
  }
  if (Object.keys(manifest).some((key) => !MANIFEST_KEYS.includes(key))) {
    issues.push("MANIFEST_UNKNOWN_FIELD");
  }
  if (manifest.schemaVersion !== REMOVAL_MANIFEST_SCHEMA_VERSION) {
    issues.push("MANIFEST_SCHEMA_VERSION_MISMATCH");
  }
  if (!ID_RE.test(typeof manifest.manifestId === "string" ? manifest.manifestId : "")) {
    issues.push("MANIFEST_ID_MALFORMED");
  }
  if (manifest.canonicalEvidencePath !== canonicalRelativePath) {
    issues.push("MANIFEST_CANONICAL_PATH_MISMATCH");
  }
  const artifactPaths = [];
  if (!Array.isArray(manifest.artifacts) || manifest.artifacts.length < 1 || manifest.artifacts.length > 32) {
    issues.push("MANIFEST_ARTIFACTS_INVALID");
  } else {
    const seen = new Set();
    for (const artifact of manifest.artifacts) {
      if (!isRecord(artifact) || Object.keys(artifact).some((key) => !MANIFEST_ARTIFACT_KEYS.includes(key))) {
        issues.push("MANIFEST_ARTIFACT_MALFORMED");
        continue;
      }
      if (!isWellFormedRelativePath(artifact.path)) {
        issues.push("MANIFEST_PATH_MALFORMED");
        continue;
      }
      if (!artifact.path.startsWith(`${PROJECTION_ZONE}/`)) {
        issues.push("MANIFEST_PATH_OUTSIDE_PROJECTION_ZONE");
      }
      if (artifact.path === canonicalRelativePath) {
        issues.push("MANIFEST_LISTS_CANONICAL_EVIDENCE");
      }
      if (seen.has(artifact.path)) {
        issues.push("MANIFEST_DUPLICATE_ARTIFACT_PATH");
      }
      seen.add(artifact.path);
      artifactPaths.push(artifact.path);
      if (!DIGEST_RE.test(typeof artifact.sha256 === "string" ? artifact.sha256 : "")) {
        issues.push("MANIFEST_ARTIFACT_DIGEST_MALFORMED");
      }
    }
  }
  // The manifest plus the manifest file itself must exactly cover the
  // generated projection zone: nothing more, nothing less.
  const plannedSet = uniqueSorted([...artifactPaths, MANIFEST_RELATIVE]);
  if (!sameSet(plannedSet, zoneFiles)) {
    issues.push("MANIFEST_SET_MISMATCH");
  }
  return { issues, artifactPaths };
}

export function buildRollbackPlan({ sandboxRoot, canonicalEvidencePath, manifest }) {
  const issues = [];
  const allFiles = listTree(sandboxRoot);
  const canonicalZoneFiles = allFiles.filter((entry) => entry.startsWith(`${CANONICAL_ZONE}/`));
  if (canonicalZoneFiles.length !== 1 || canonicalZoneFiles[0] !== CANONICAL_RELATIVE) {
    issues.push("CANONICAL_ZONE_UNEXPECTED");
  }
  const zoneFiles = allFiles.filter((entry) => entry.startsWith(`${PROJECTION_ZONE}/`));
  const { issues: manifestIssues, artifactPaths } = verifyRemovalManifest(manifest, CANONICAL_RELATIVE, zoneFiles);
  issues.push(...manifestIssues);

  // The manifest file on disk must round-trip to exactly the supplied object.
  const manifestFileAbs = join(sandboxRoot, MANIFEST_RELATIVE);
  if (existsSync(manifestFileAbs)) {
    try {
      const fromDisk = JSON.parse(readFileSync(manifestFileAbs, "utf8"));
      if (canonicalize(fromDisk) !== canonicalize(manifest)) {
        issues.push("MANIFEST_FILE_DRIFT");
      }
    } catch {
      issues.push("MANIFEST_FILE_INVALID_JSON");
    }
  }
  // A missing manifest file is reported by MANIFEST_SET_MISMATCH above.

  // Per-artifact existence and digest checks (only for well-formed paths).
  const planned = [];
  for (const artifact of isRecord(manifest) && Array.isArray(manifest.artifacts) ? manifest.artifacts : []) {
    if (!isRecord(artifact) || !isWellFormedRelativePath(artifact.path)) continue;
    const abs = join(sandboxRoot, ...artifact.path.split("/"));
    if (!existsSync(abs) || !statSync(abs).isFile()) {
      issues.push("MANIFEST_ARTIFACT_MISSING");
      continue;
    }
    const raw = readFileSync(abs);
    const actual = sha256(new Uint8Array(raw));
    if (DIGEST_RE.test(typeof artifact.sha256 === "string" ? artifact.sha256 : "") && actual !== artifact.sha256) {
      issues.push("MANIFEST_ARTIFACT_DIGEST_MISMATCH");
      continue;
    }
    planned.push({ path: abs, relativePath: artifact.path, sha256: actual });
  }

  // Canonical evidence: must exist, parse, and be a valid admitted snapshot.
  const canonicalRaw = readCanonicalFile(canonicalEvidencePath, issues);
  let expected = null;
  if (canonicalRaw !== null) {
    let parsed = null;
    try {
      parsed = JSON.parse(canonicalRaw.toString("utf8"));
    } catch {
      issues.push("CANONICAL_FILE_INVALID_JSON");
    }
    if (parsed !== null) {
      const check = verifyCanonicalEvidenceSnapshot(parsed);
      if (!check.ok) {
        issues.push(...check.reasonCodes);
      } else {
        expected = {
          digest: sha256(new Uint8Array(canonicalRaw)),
          content: canonicalize(parsed),
          snapshotDigest: parsed.snapshotDigest,
          byteLength: canonicalRaw.length,
        };
      }
    }
  }

  if (issues.length > 0 || expected === null) {
    return denied(issues, { stage: "PLAN", artifactCount: 0 });
  }
  const deletions = uniqueSorted([...planned.map((entry) => entry.relativePath), MANIFEST_RELATIVE])
    .map((relativePath) => {
      const entry = planned.find((candidate) => candidate.relativePath === relativePath);
      if (entry) return entry;
      const path = join(sandboxRoot, ...relativePath.split("/"));
      return { path, relativePath, sha256: sha256(new Uint8Array(readFileSync(path))) };
    });
  return {
    outcome: "PLANNED",
    reasonCodes: [],
    boundary: ROLLBACK_BOUNDARY,
    stage: "PLAN",
    deletions,
    canonicalPath: canonicalEvidencePath,
    canonicalDigest: expected.digest,
    canonicalByteLength: expected.byteLength,
    artifactCount: deletions.length,
    expected,
  };
}

function readCanonicalFile(canonicalEvidencePath, issues) {
  try {
    return readFileSync(canonicalEvidencePath);
  } catch {
    issues.push("CANONICAL_FILE_MISSING");
    return null;
  }
}

// ---------------------------------------------------------------------------
// Removal: re-verify every digest, then delete exactly the planned set.
// ---------------------------------------------------------------------------

export function removeProjectedArtifacts({ sandboxRoot, plan }) {
  if (!isRecord(plan) || plan.outcome !== "PLANNED" || !Array.isArray(plan.deletions)) {
    return denied(["REMOVAL_PLAN_REQUIRED"], { stage: "REMOVAL" });
  }
  const issues = [];
  const canonicalReadback = readbackCanonicalEvidence({
    canonicalEvidencePath: plan.canonicalPath,
    expected: plan.expected,
  });
  if (canonicalReadback.outcome !== "VERIFIED") {
    issues.push("REMOVAL_CANONICAL_EVIDENCE_DRIFT");
  }
  // Verify all before deleting anything: an artifact that drifts between
  // planning and removal aborts the whole removal with zero deletions.
  for (const deletion of plan.deletions) {
    if (!existsSync(deletion.path) || !statSync(deletion.path).isFile()) {
      issues.push("REMOVAL_ARTIFACT_MISSING");
      continue;
    }
    const actual = sha256(new Uint8Array(readFileSync(deletion.path)));
    if (actual !== deletion.sha256) {
      issues.push("REMOVAL_ARTIFACT_DIGEST_DRIFT");
    }
  }
  if (issues.length > 0) {
    return denied(issues, { stage: "REMOVAL", removedCount: 0 });
  }
  for (const deletion of plan.deletions) {
    unlinkSync(deletion.path);
  }
  for (const deletion of plan.deletions) {
    if (existsSync(deletion.path)) {
      issues.push("REMOVAL_ARTIFACT_STILL_PRESENT");
    }
  }
  if (issues.length > 0) {
    return denied(issues, { stage: "REMOVAL", removedCount: 0 });
  }
  return { outcome: "REMOVED", reasonCodes: [], boundary: ROLLBACK_BOUNDARY, stage: "REMOVAL", removedCount: plan.deletions.length };
}

// ---------------------------------------------------------------------------
// Readback: re-read canonical evidence and prove exact unchanged digests and
// content. Success is impossible without the re-read evidence.
// ---------------------------------------------------------------------------

export function readbackCanonicalEvidence({ canonicalEvidencePath, expected }) {
  if (!isRecord(expected) || !DIGEST_RE.test(expected.digest ?? "") || typeof expected.content !== "string") {
    return denied(["READBACK_EXPECTED_STATE_REQUIRED"], { stage: "READBACK" });
  }
  let raw = null;
  try {
    raw = readFileSync(canonicalEvidencePath);
  } catch {
    return denied(["READBACK_CANONICAL_MISSING"], { stage: "READBACK" });
  }
  let parsed = null;
  try {
    parsed = JSON.parse(raw.toString("utf8"));
  } catch {
    return denied(["READBACK_CANONICAL_INVALID_JSON"], { stage: "READBACK" });
  }
  const snapshotCheck = verifyCanonicalEvidenceSnapshot(parsed);
  const issues = [];
  if (!snapshotCheck.ok) {
    issues.push("READBACK_SNAPSHOT_INVALID", ...snapshotCheck.reasonCodes);
  }
  const digest = sha256(new Uint8Array(raw));
  const content = canonicalize(parsed);
  const digestMatches = digest === expected.digest;
  const contentMatches = content === expected.content;
  const snapshotDigestMatches = digestMatches && contentMatches;
  if (!digestMatches) issues.push("READBACK_CANONICAL_DIGEST_MISMATCH");
  if (!contentMatches) issues.push("READBACK_CANONICAL_CONTENT_MISMATCH");
  if (issues.length > 0) {
    return denied(issues, { stage: "READBACK", digest, byteLength: raw.length, digestMatches, contentMatches, snapshotDigestMatches });
  }
  return {
    outcome: "VERIFIED",
    reasonCodes: [],
    boundary: ROLLBACK_BOUNDARY,
    stage: "READBACK",
    digest,
    byteLength: raw.length,
    digestMatches: true,
    contentMatches: true,
    snapshotDigestMatches: true,
    snapshotDigest: parsed.snapshotDigest,
  };
}

// ---------------------------------------------------------------------------
// Orchestration: pre-state -> verified dry-run plan -> (remove) -> readback.
// ---------------------------------------------------------------------------

export function runProjectionRollbackReadback({ sandboxRoot, canonicalEvidencePath, manifest, dryRun = false }) {
  const preTree = listTree(sandboxRoot);
  const plan = buildRollbackPlan({ sandboxRoot, canonicalEvidencePath, manifest });
  if (plan.outcome === "DENIED") {
    return denied(plan.reasonCodes, { stage: "PLAN", dryRun });
  }

  if (dryRun) {
    const issues = [];
    const readback = readbackCanonicalEvidence({ canonicalEvidencePath, expected: plan.expected });
    issues.push(...readback.reasonCodes);
    const postTree = listTree(sandboxRoot);
    if (!sameSet(postTree, preTree)) {
      issues.push("DRY_RUN_TREE_CHANGED");
    }
    for (const deletion of plan.deletions) {
      if (!existsSync(deletion.path)) {
        issues.push("DRY_RUN_REMOVED_ARTIFACT");
      }
    }
    if (issues.length > 0) {
      return denied(issues, { stage: "DRY_RUN", dryRun: true });
    }
    return {
      outcome: "VERIFIED",
      reasonCodes: [],
      boundary: ROLLBACK_BOUNDARY,
      stage: "DRY_RUN",
      dryRun: true,
      removedCount: 0,
      plannedRemovals: plan.deletions.length,
      canonicalDigest: plan.canonicalDigest,
      canonicalByteLength: plan.canonicalByteLength,
      filesUnchanged: true,
    };
  }

  const removal = removeProjectedArtifacts({ sandboxRoot, plan });
  if (removal.outcome === "DENIED") {
    return denied(removal.reasonCodes, { stage: "REMOVAL", dryRun: false });
  }
  const readback = readbackCanonicalEvidence({ canonicalEvidencePath, expected: plan.expected });
  const issues = [...readback.reasonCodes];
  const postTree = listTree(sandboxRoot);
  const expectedTree = uniqueSorted(preTree.filter((entry) => !plan.deletions.some((deletion) => deletion.relativePath === entry)));
  if (!sameSet(postTree, expectedTree)) {
    issues.push("READBACK_TREE_DRIFT");
  }
  for (const deletion of plan.deletions) {
    if (existsSync(deletion.path)) {
      issues.push("READBACK_PROJECTION_NOT_REMOVED");
    }
  }
  if (issues.length > 0) {
    return denied(issues, { stage: "READBACK", dryRun: false });
  }
  return {
    outcome: "VERIFIED",
    reasonCodes: [],
    boundary: ROLLBACK_BOUNDARY,
    stage: "READBACK",
    dryRun: false,
    removedCount: removal.removedCount,
    canonicalDigest: readback.digest,
    canonicalByteLength: readback.byteLength,
    contentUnchanged: readback.contentMatches,
    digestUnchanged: readback.digestMatches,
    snapshotDigest: readback.snapshotDigest,
    treeExactMinusRemoved: true,
  };
}

// ---------------------------------------------------------------------------
// CLI: materialize the sandbox from repository fixtures and run the harness.
// ---------------------------------------------------------------------------

function crossCheckPublisherInput(fixture, publisherInput) {
  const issues = [];
  if (!isRecord(publisherInput) || !Array.isArray(publisherInput.canonicalSnapshots)) {
    return ["PUBLISHER_INPUT_INVALID"];
  }
  const fixtureByRecord = new Map(fixture.records.map((record) => [record.recordId, record]));
  const inputByRecord = new Map(publisherInput.canonicalSnapshots.map((snapshot) => [snapshot.recordId, snapshot]));
  if (fixtureByRecord.size !== inputByRecord.size) {
    issues.push("CANONICAL_SNAPSHOT_RECORD_SET_MISMATCH");
  }
  for (const [recordId, record] of fixtureByRecord) {
    const snapshot = inputByRecord.get(recordId);
    if (snapshot === undefined) {
      issues.push("CANONICAL_SNAPSHOT_RECORD_MISSING_IN_PUBLISHER_INPUT");
      continue;
    }
    if (canonicalize(record) !== canonicalize(snapshot)) {
      issues.push("CANONICAL_SNAPSHOT_RECORD_DRIFT");
    }
  }
  for (const recordId of inputByRecord.keys()) {
    if (!fixtureByRecord.has(recordId)) {
      issues.push("CANONICAL_SNAPSHOT_RECORD_MISSING_IN_SNAPSHOT");
    }
  }
  return uniqueSorted(issues);
}

function main(argv) {
  const args = argv.slice(2);
  if (args.includes("--help") || args.includes("-h")) {
    console.log("usage: node scripts/verify-cks-10-projection-rollback.mjs [--dry-run] [fixturePath] [publisherInputPath]");
    return 0;
  }
  const dryRun = args.includes("--dry-run");
  const positional = args.filter((entry) => !entry.startsWith("--"));
  if (positional.length > 2) {
    console.log("cks-10-projection-rollback: USAGE_ERROR too many positional arguments");
    return 2;
  }
  const fixturePath = resolve(positional[0] ?? DEFAULT_FIXTURE);
  const publisherInputPath = resolve(positional[1] ?? DEFAULT_PUBLISHER_INPUT);

  const fail = (tag, issues) => {
    for (const issue of uniqueSorted(issues)) {
      console.log(`cks-10-projection-rollback: ISSUE ${issue}`);
    }
    console.log(`cks-10-projection-rollback: FAIL ${tag} issues=${uniqueSorted(issues).length}`);
    return 1;
  };

  let fixtureRaw;
  let publisherInputRaw;
  try {
    fixtureRaw = readFileSync(fixturePath);
    publisherInputRaw = readFileSync(publisherInputPath);
  } catch {
    return fail("FIXTURE_READ", ["FIXTURE_READ_FAILED"]);
  }
  const fixture = JSON.parse(fixtureRaw.toString("utf8"));
  const publisherInput = JSON.parse(publisherInputRaw.toString("utf8"));
  const fixtureCheck = verifyCanonicalEvidenceSnapshot(fixture);
  if (!fixtureCheck.ok) {
    return fail("FIXTURE", fixtureCheck.reasonCodes);
  }
  const crossIssues = crossCheckPublisherInput(fixture, publisherInput);
  if (crossIssues.length > 0) {
    return fail("CROSS_CHECK", crossIssues);
  }

  let projection;
  try {
    projection = buildReadOnlyProjection(publisherInput);
  } catch (error) {
    return fail("PROJECTION_BUILD", ["PROJECTION_BUILD_DENIED"]);
  }

  const envelopeName = `projection-envelope-${projection.exchange.projectionId}.json`;
  const envelopeBytes = canonicalize(projection);
  const manifest = {
    schemaVersion: REMOVAL_MANIFEST_SCHEMA_VERSION,
    manifestId: "cks10-removal-manifest-290-0001",
    canonicalEvidencePath: CANONICAL_RELATIVE,
    artifacts: [
      { path: `${PROJECTION_ZONE}/${envelopeName}`, sha256: sha256(envelopeBytes) },
    ],
  };
  const manifestBytes = canonicalize(manifest);

  const sandboxRoot = mkdtempSync(join(tmpdir(), "cks10-rollback-"));
  try {
    mkdirSync(join(sandboxRoot, CANONICAL_ZONE), { recursive: true });
    mkdirSync(join(sandboxRoot, PROJECTION_ZONE), { recursive: true });
    // Canonical evidence is copied with EXACT fixture bytes.
    writeFileSync(join(sandboxRoot, CANONICAL_RELATIVE), fixtureRaw);
    writeFileSync(join(sandboxRoot, PROJECTION_ZONE, envelopeName), envelopeBytes);
    writeFileSync(join(sandboxRoot, MANIFEST_RELATIVE), manifestBytes);
    const manifestRoundTrip = JSON.parse(readFileSync(join(sandboxRoot, MANIFEST_RELATIVE), "utf8"));

    const result = runProjectionRollbackReadback({
      sandboxRoot,
      canonicalEvidencePath: join(sandboxRoot, CANONICAL_RELATIVE),
      manifest: manifestRoundTrip,
      dryRun,
    });

    for (const issue of result.reasonCodes) {
      console.log(`cks-10-projection-rollback: ISSUE ${issue}`);
    }
    if (result.outcome === "VERIFIED") {
      const mode = dryRun ? `mode=dry-run plannedRemovals=${result.plannedRemovals}` : `mode=full removed=${result.removedCount}`;
      console.log(
        `cks-10-projection-rollback: PASS ${mode} canonicalDigest=${result.canonicalDigest} canonicalBytes=${result.canonicalByteLength} ` +
        `boundary=AUTHORITY_NONE_EFFECT_NONE_PROMOTION_NONE deletionZone=GENERATED_PROJECTION_ARTIFACTS_ONLY`
      );
      return 0;
    }
    console.log(`cks-10-projection-rollback: FAIL mode=${dryRun ? "dry-run" : "full"} stage=${result.stage} issues=${result.reasonCodes.length}`);
    return 1;
  } finally {
    rmSync(sandboxRoot, { recursive: true, force: true });
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  process.exitCode = main(process.argv);
}