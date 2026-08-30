import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

import {
  buildReadOnlyProjection,
  canonicalize,
  sha256,
} from "../../src/cks-10/read-only-projection-publisher.mjs";
import {
  CANONICAL_RELATIVE,
  MANIFEST_RELATIVE,
  PROJECTION_ZONE,
  ROLLBACK_BOUNDARY,
  REMOVAL_MANIFEST_SCHEMA_VERSION,
  buildRollbackPlan,
  listTree,
  removeProjectedArtifacts,
  readbackCanonicalEvidence,
  runProjectionRollbackReadback,
  verifyCanonicalEvidenceSnapshot,
} from "../../scripts/verify-cks-10-projection-rollback.mjs";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const fixturePath = resolve(repoRoot, "tests/fixtures/cks-10/canonical-evidence-snapshot-v1.json");
const publisherInputPath = resolve(repoRoot, "tests/fixtures/cks-10/publisher-input-v1.json");

// Materializes a disposable sandbox with the exact canonical fixture bytes,
// the generated projection envelope, and a removal manifest.
function makeSandbox() {
  const root = mkdtempSync(join(tmpdir(), "cks10-rollback-test-"));
  mkdirSync(join(root, "canonical"), { recursive: true });
  mkdirSync(join(root, PROJECTION_ZONE), { recursive: true });
  const fixtureRaw = readFileSync(fixturePath);
  writeFileSync(join(root, CANONICAL_RELATIVE), fixtureRaw);
  const input = JSON.parse(readFileSync(publisherInputPath, "utf8"));
  const projection = buildReadOnlyProjection(input);
  const envelopeName = `projection-envelope-${projection.exchange.projectionId}.json`;
  const envelopeBytes = canonicalize(projection);
  writeFileSync(join(root, join(PROJECTION_ZONE, envelopeName)), envelopeBytes);
  const manifest = makeManifestWithDigest(envelopeName, envelopeBytes);
  writeFileSync(join(root, MANIFEST_RELATIVE), canonicalize(manifest));
  const manifestRoundTrip = JSON.parse(readFileSync(join(root, MANIFEST_RELATIVE), "utf8"));
  const canonicalPath = join(root, CANONICAL_RELATIVE);
  const fixtureDoc = JSON.parse(fixtureRaw.toString("utf8"));
  return {
    root,
    canonicalPath,
    manifest: manifestRoundTrip,
    envelopeName,
    envelopeBytes,
    canonicalDigest: sha256(new Uint8Array(fixtureRaw)),
    canonicalContent: canonicalize(fixtureDoc),
    fixtureDoc,
    cleanup: () => rmSync(root, { recursive: true, force: true }),
  };
}

function makeManifestWithDigest(envelopeName, envelopeBytes) {
  return {
    schemaVersion: REMOVAL_MANIFEST_SCHEMA_VERSION,
    manifestId: "cks10-removal-manifest-290-0001",
    canonicalEvidencePath: CANONICAL_RELATIVE,
    artifacts: [{ path: `${PROJECTION_ZONE}/${envelopeName}`, sha256: sha256(envelopeBytes) }],
  };
}

function assertDenied(result, expected) {
  assert.equal(result.outcome, "DENIED", `expected DENIED, got ${result.outcome}`);
  assert.ok(result.reasonCodes.includes(expected), `expected reason code ${expected} in [${result.reasonCodes.join(", ")}]`);
  assert.deepEqual(result.boundary, ROLLBACK_BOUNDARY);
}

test("removing only generated projection artifacts leaves canonical evidence digests and content byte-equal", () => {
  const sandbox = makeSandbox();
  const { root, canonicalPath, manifest, canonicalDigest, canonicalContent, fixtureDoc, cleanup } = sandbox;
  const preTree = listTree(root);
  try {
    const result = runProjectionRollbackReadback({ sandboxRoot: root, canonicalEvidencePath: canonicalPath, manifest, dryRun: false });
    assert.equal(result.outcome, "VERIFIED");
    assert.deepEqual(result.reasonCodes, []);
    assert.equal(result.removedCount, 2);
    assert.equal(result.digestUnchanged, true);
    assert.equal(result.contentUnchanged, true);
    assert.equal(result.treeExactMinusRemoved, true);
    assert.equal(result.canonicalDigest, canonicalDigest);
    assert.deepEqual(result.boundary, ROLLBACK_BOUNDARY);

    // Re-read canonical evidence from disk and prove exact unchanged bytes.
    const raw = readFileSync(canonicalPath);
    assert.equal(sha256(new Uint8Array(raw)), canonicalDigest);
    const parsed = JSON.parse(raw.toString("utf8"));
    assert.equal(canonicalize(parsed), canonicalContent);
    assert.deepEqual(parsed, fixtureDoc);
    const snapshotCheck = verifyCanonicalEvidenceSnapshot(parsed);
    assert.equal(snapshotCheck.outcome, "VERIFIED");

    // Generated projection artifacts are gone; canonical evidence remains.
    assert.equal(existsSync(join(root, MANIFEST_RELATIVE)), false);
    assert.equal(existsSync(join(root, join(PROJECTION_ZONE, sandbox.envelopeName))), false);
    assert.equal(existsSync(canonicalPath), true);
    const postTree = listTree(root);
    assert.deepEqual(postTree, ["canonical/canonical-evidence-snapshot-v1.json"]);
    assert.ok(preTree.length > postTree.length);
  } finally {
    cleanup();
  }
});

test("dry-run plans removals without deleting anything and proves the same canonical digest", () => {
  const sandbox = makeSandbox();
  const { root, canonicalPath, manifest, canonicalDigest, cleanup } = sandbox;
  const preTree = listTree(root);
  try {
    const result = runProjectionRollbackReadback({ sandboxRoot: root, canonicalEvidencePath: canonicalPath, manifest, dryRun: true });
    assert.equal(result.outcome, "VERIFIED");
    assert.equal(result.dryRun, true);
    assert.equal(result.plannedRemovals, 2);
    assert.equal(result.removedCount, 0);
    assert.equal(result.filesUnchanged, true);
    assert.equal(result.canonicalDigest, canonicalDigest);
    assert.deepEqual(listTree(root), preTree);
    assert.equal(existsSync(join(root, MANIFEST_RELATIVE)), true);
    assert.equal(existsSync(join(root, join(PROJECTION_ZONE, sandbox.envelopeName))), true);
  } finally {
    cleanup();
  }
});

test("rollbacks are deterministic across repeated runs", () => {
  const first = makeSandbox();
  const second = makeSandbox();
  try {
    const a = runProjectionRollbackReadback({ sandboxRoot: first.root, canonicalEvidencePath: first.canonicalPath, manifest: first.manifest, dryRun: false });
    const b = runProjectionRollbackReadback({ sandboxRoot: second.root, canonicalEvidencePath: second.canonicalPath, manifest: second.manifest, dryRun: false });
    assert.equal(a.outcome, "VERIFIED");
    assert.equal(b.outcome, "VERIFIED");
    assert.equal(a.canonicalDigest, b.canonicalDigest);
    assert.equal(a.removedCount, b.removedCount);
    assert.equal(canonicalize(a), canonicalize(b));
    assert.equal(first.canonicalDigest, second.canonicalDigest);
  } finally {
    first.cleanup();
    second.cleanup();
  }
});

test("removal plans that name canonical evidence or paths outside the projection zone are denied", () => {
  const canonicalTarget = makeSandbox();
  try {
    const manifest = structuredClone(canonicalTarget.manifest);
    manifest.artifacts.push({ path: CANONICAL_RELATIVE, sha256: canonicalTarget.canonicalDigest });
    const result = runProjectionRollbackReadback({ sandboxRoot: canonicalTarget.root, canonicalEvidencePath: canonicalTarget.canonicalPath, manifest, dryRun: false });
    assertDenied(result, "MANIFEST_LISTS_CANONICAL_EVIDENCE");
    assert.equal(existsSync(canonicalTarget.canonicalPath), true);
    assert.equal(existsSync(join(canonicalTarget.root, join(PROJECTION_ZONE, canonicalTarget.envelopeName))), true);
  } finally {
    canonicalTarget.cleanup();
  }

  const outsideZone = makeSandbox();
  try {
    const manifest = structuredClone(outsideZone.manifest);
    manifest.artifacts.push({ path: "generated/stray-artifact.json", sha256: "a".repeat(64) });
    const result = runProjectionRollbackReadback({ sandboxRoot: outsideZone.root, canonicalEvidencePath: outsideZone.canonicalPath, manifest, dryRun: false });
    assertDenied(result, "MANIFEST_PATH_OUTSIDE_PROJECTION_ZONE");
    assert.equal(existsSync(join(outsideZone.root, join(PROJECTION_ZONE, outsideZone.envelopeName))), true);
  } finally {
    outsideZone.cleanup();
  }
});

test("removal plans with artifact digest drift are denied with zero deletions", () => {
  const sandbox = makeSandbox();
  const { root, canonicalPath, cleanup } = sandbox;
  try {
    const plan = buildRollbackPlan({
      sandboxRoot: root,
      canonicalEvidencePath: canonicalPath,
      manifest: structuredClone(sandbox.manifest),
    });
    assert.equal(plan.outcome, "PLANNED");
    assert.equal(plan.deletions.length, 2);

    // Simulate drift between planning and removal.
    writeFileSync(join(root, join(PROJECTION_ZONE, sandbox.envelopeName)), "drifted");
    const removal = removeProjectedArtifacts({ sandboxRoot: root, plan });
    assertDenied(removal, "REMOVAL_ARTIFACT_DIGEST_DRIFT");
    assert.equal(removal.removedCount, 0);
    assert.equal(existsSync(join(root, MANIFEST_RELATIVE)), true);
    assert.equal(existsSync(join(root, join(PROJECTION_ZONE, sandbox.envelopeName))), true);

    // Canonical evidence was never touched by the aborted removal.
    const readback = readbackCanonicalEvidence({ canonicalEvidencePath: canonicalPath, expected: { digest: sandbox.canonicalDigest, content: sandbox.canonicalContent } });
    assert.equal(readback.outcome, "VERIFIED");
  } finally {
    cleanup();
  }
});

test("canonical evidence mutation after planning aborts rollback before any deletion", () => {
  const sandbox = makeSandbox();
  const { root, canonicalPath, cleanup } = sandbox;
  try {
    const plan = buildRollbackPlan({
      sandboxRoot: root,
      canonicalEvidencePath: canonicalPath,
      manifest: structuredClone(sandbox.manifest),
    });
    assert.equal(plan.outcome, "PLANNED");
    writeFileSync(canonicalPath, Buffer.concat([readFileSync(canonicalPath), Buffer.from(" ")]));

    const removal = removeProjectedArtifacts({ sandboxRoot: root, plan });
    assertDenied(removal, "REMOVAL_CANONICAL_EVIDENCE_DRIFT");
    assert.equal(removal.removedCount, 0);
    assert.equal(existsSync(join(root, MANIFEST_RELATIVE)), true);
    assert.equal(existsSync(join(root, join(PROJECTION_ZONE, sandbox.envelopeName))), true);
  } finally {
    cleanup();
  }
});

test("manifest-level digest drift and missing artifacts fail closed at planning", () => {
  const driftedDigest = makeSandbox();
  try {
    const manifest = structuredClone(driftedDigest.manifest);
    manifest.artifacts[0].sha256 = "b".repeat(64);
    const result = runProjectionRollbackReadback({ sandboxRoot: driftedDigest.root, canonicalEvidencePath: driftedDigest.canonicalPath, manifest, dryRun: false });
    assertDenied(result, "MANIFEST_ARTIFACT_DIGEST_MISMATCH");
    assert.equal(existsSync(join(driftedDigest.root, join(PROJECTION_ZONE, driftedDigest.envelopeName))), true);
  } finally {
    driftedDigest.cleanup();
  }

  const missing = makeSandbox();
  try {
    const manifest = structuredClone(missing.manifest);
    manifest.artifacts[0].path = `${PROJECTION_ZONE}/projection-envelope-never-written.json`;
    manifest.artifacts[0].sha256 = "c".repeat(64);
    const result = runProjectionRollbackReadback({ sandboxRoot: missing.root, canonicalEvidencePath: missing.canonicalPath, manifest, dryRun: false });
    assertDenied(result, "MANIFEST_ARTIFACT_MISSING");
    assert.equal(existsSync(missing.canonicalPath), true);
  } finally {
    missing.cleanup();
  }
});

test("tampered canonical evidence is denied by snapshot validation and by readback digest/content checks", () => {
  const sandbox = makeSandbox();
  const { root, canonicalPath, cleanup } = sandbox;
  try {
    // Tamper the stored snapshot digest: the snapshot itself no longer verifies.
    const doc = structuredClone(sandbox.fixtureDoc);
    doc.snapshotDigest = "d".repeat(64);
    writeFileSync(canonicalPath, JSON.stringify(doc, null, 2) + "\n");
    const plan = buildRollbackPlan({ sandboxRoot: root, canonicalEvidencePath: canonicalPath, manifest: sandbox.manifest });
    assertDenied(plan, "SNAPSHOT_DIGEST_MISMATCH");

    // A byte change to canonical evidence fails the readback against the
    // pre-removal expected state, so success cannot be claimed on drift.
    const raw = readFileSync(canonicalPath);
    const readback = readbackCanonicalEvidence({ canonicalEvidencePath: canonicalPath, expected: { digest: sandbox.canonicalDigest, content: sandbox.canonicalContent } });
    assertDenied(readback, "READBACK_CANONICAL_DIGEST_MISMATCH");
    assert.equal(readback.digestMatches, false);
    assert.ok(raw.length > 0);
  } finally {
    cleanup();
  }
});

test("success is impossible without re-read evidence", () => {
  const sandbox = makeSandbox();
  const { root, canonicalPath, cleanup } = sandbox;
  try {
    const missing = readbackCanonicalEvidence({ canonicalEvidencePath: join(root, "canonical/absent.json"), expected: { digest: sandbox.canonicalDigest, content: sandbox.canonicalContent } });
    assertDenied(missing, "READBACK_CANONICAL_MISSING");

    const noExpected = readbackCanonicalEvidence({ canonicalEvidencePath: canonicalPath, expected: {} });
    assertDenied(noExpected, "READBACK_EXPECTED_STATE_REQUIRED");

    const noPlan = removeProjectedArtifacts({ sandboxRoot: root, plan: {} });
    assertDenied(noPlan, "REMOVAL_PLAN_REQUIRED");
  } finally {
    cleanup();
  }
});