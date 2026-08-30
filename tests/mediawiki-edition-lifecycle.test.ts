import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import {
  existsSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import {
  activateMediaWikiEditionStageV1,
  activateMediaWikiEditionV1,
  cleanupMediaWikiEditionResidueV1,
  initializeMediaWikiEditionLifecycleV1,
  readMediaWikiEditionLifecycleV1,
  revokeMediaWikiEditionV1,
  stageMediaWikiEditionV1,
  verifyMediaWikiEditionStageV1,
} from "../packages/contracts/src/mediawiki-edition-lifecycle.js";
import {
  importMediaWikiMiniDumpEditionV1,
  projectMediaWikiMiniDumpEditionV1,
  type MediaWikiMiniDumpProfileV1,
} from "../packages/contracts/src/mediawiki-mini-dump.js";

const fixtureRoot = "tests/fixtures/mediawiki-mini-dump";
const fixtureManifest = JSON.parse(readFileSync(`${fixtureRoot}/manifest.json`, "utf8")) as {
  syntheticOnly: boolean;
  networkAllowed: boolean;
  pilot: { kind: string; sourceUrl: string; snapshotDate: string; pages: number };
  profiles: { positive: MediaWikiMiniDumpProfileV1 };
};
const profile = fixtureManifest.profiles.positive;
const sourceBytes = new Uint8Array(readFileSync(`${fixtureRoot}/${profile.source.path}`));

function sha256(value: Uint8Array): string {
  return createHash("sha256").update(value).digest("hex");
}

function changedEdition() {
  const source = new TextDecoder().decode(sourceBytes);
  const bytes = new TextEncoder().encode(source.replace(
    "Alpha is the first synthetic article.",
    "Alpha is the FIRST synthetic article.",
  ));
  return projectMediaWikiMiniDumpEditionV1({
    ...profile,
    source: { ...profile.source, expectedSourceDigest: sha256(bytes), byteSize: bytes.byteLength },
  }, bytes);
}

function temporaryRoot(): string {
  return mkdtempSync(path.join(os.tmpdir(), "psai107-edition-lifecycle-"));
}

function removeRoot(root: string): void {
  rmSync(root, { recursive: true, force: true });
}

test("PSAI107 lifecycle imports bounded pilot metadata offline and atomically activates a verified edition", () => {
  assert.equal(fixtureManifest.syntheticOnly, true);
  assert.equal(fixtureManifest.networkAllowed, false);
  assert.equal(fixtureManifest.pilot.kind, "BOUNDED_OFFICIAL_PILOT_SNAPSHOT_METADATA_ONLY");
  const initial = importMediaWikiMiniDumpEditionV1(fixtureRoot, profile);
  const next = changedEdition();
  const root = temporaryRoot();
  try {
    const initialized = initializeMediaWikiEditionLifecycleV1(root, initial);
    assert.equal(initialized.index.activeEditionDigest, initial.editionDigest);
    const staged = stageMediaWikiEditionV1(root, {
      edition: next,
      parentEditionDigest: initial.editionDigest,
    });
    assert.equal(staged.outcome, "STAGED");
    const stagedDigest = staged.outcome === "STAGED" ? staged.stagedEditionDigest : "";
    assert.equal(readMediaWikiEditionLifecycleV1(root).index.activeEditionDigest, initial.editionDigest);
    assert.equal(verifyMediaWikiEditionStageV1(root, stagedDigest).outcome, "STAGED");
    const result = activateMediaWikiEditionStageV1(root, stagedDigest);
    assert.equal(result.outcome, "ACTIVATED");
    assert.equal(result.activeEditionDigest, next.editionDigest);
    const readback = readMediaWikiEditionLifecycleV1(root);
    assert.equal(readback.index.activeEditionDigest, next.editionDigest);
    assert.equal(readback.index.lastKnownGoodEditionDigest, initial.editionDigest);
    assert.ok(readback.index.entries.length >= fixtureManifest.pilot.pages);
    assert.ok(readback.index.entries.every((entry) => entry.editionDigest === next.editionDigest));
    assert.deepEqual(readdirSync(path.join(root, "staging")), []);
    assert.equal(existsSync(path.join(root, "active-index.json.tmp")), false);
  } finally {
    removeRoot(root);
  }
});

test("PSAI107 failed activation and revoke restore the exact prior LKG and leave no active new-index residue", () => {
  const initial = importMediaWikiMiniDumpEditionV1(fixtureRoot, profile);
  const next = changedEdition();
  const root = temporaryRoot();
  try {
    initializeMediaWikiEditionLifecycleV1(root, initial);
    const priorIndexBytes = readFileSync(path.join(root, "active-index.json"));
    const priorManifestBytes = readFileSync(path.join(root, "editions", initial.editionDigest, "manifest.json"));
    const failed = activateMediaWikiEditionV1(root, {
      edition: next,
      parentEditionDigest: initial.editionDigest,
    }, { injectFailureAt: "AFTER_SWITCH" });
    assert.equal(failed.outcome, "ROLLED_BACK");
    assert.deepEqual(readFileSync(path.join(root, "active-index.json")), priorIndexBytes);
    assert.deepEqual(readFileSync(path.join(root, "editions", initial.editionDigest, "manifest.json")), priorManifestBytes);
    assert.equal(existsSync(path.join(root, "editions", next.editionDigest)), false);
    assert.deepEqual(readdirSync(path.join(root, "staging")), []);

    assert.equal(activateMediaWikiEditionV1(root, {
      edition: next,
      parentEditionDigest: initial.editionDigest,
    }).outcome, "ACTIVATED");
    const revoked = revokeMediaWikiEditionV1(root);
    assert.equal(revoked.outcome, "ACTIVATED");
    const restored = readMediaWikiEditionLifecycleV1(root);
    assert.equal(restored.index.activeEditionDigest, initial.editionDigest);
    assert.equal(restored.index.acceptedEditionDigest, initial.editionDigest);
    assert.equal(restored.index.lastKnownGoodEditionDigest, initial.editionDigest);
    assert.ok(restored.index.entries.every((entry) => entry.editionDigest === initial.editionDigest));
    assert.deepEqual(readFileSync(path.join(root, "editions", initial.editionDigest, "manifest.json")), priorManifestBytes);
  } finally {
    removeRoot(root);
  }
});

test("PSAI107 failure between edition promotion and pointer replacement leaves no activation residue", () => {
  const initial = importMediaWikiMiniDumpEditionV1(fixtureRoot, profile);
  const next = changedEdition();
  for (const activationPath of ["STAGED", "COMBINED"] as const) {
    const root = temporaryRoot();
    try {
      initializeMediaWikiEditionLifecycleV1(root, initial);
      const priorIndexBytes = readFileSync(path.join(root, "active-index.json"));
      const failed = activationPath === "STAGED"
        ? (() => {
            const staged = stageMediaWikiEditionV1(root, {
              edition: next,
              parentEditionDigest: initial.editionDigest,
            });
            assert.equal(staged.outcome, "STAGED");
            return activateMediaWikiEditionStageV1(
              root,
              staged.outcome === "STAGED" ? staged.stagedEditionDigest : "",
              { injectFailureAt: "AFTER_PROMOTE" },
            );
          })()
        : activateMediaWikiEditionV1(root, {
            edition: next,
            parentEditionDigest: initial.editionDigest,
          }, { injectFailureAt: "AFTER_PROMOTE" });
      assert.equal(failed.outcome, "ROLLED_BACK", activationPath);
      assert.equal(failed.reason, "INJECTED_FAILURE", activationPath);
      assert.deepEqual(readFileSync(path.join(root, "active-index.json")), priorIndexBytes, activationPath);
      assert.equal(existsSync(path.join(root, "editions", next.editionDigest)), false, activationPath);
      assert.deepEqual(readdirSync(path.join(root, "staging")), [], activationPath);
      assert.equal(activateMediaWikiEditionV1(root, {
        edition: next,
        parentEditionDigest: initial.editionDigest,
      }).outcome, "ACTIVATED", activationPath);
    } finally {
      removeRoot(root);
    }
  }
});

test("PSAI107 lifecycle fails closed for stale, duplicate, incomplete, tampered, interrupted, cross-volume and unowned state", () => {
  const initial = importMediaWikiMiniDumpEditionV1(fixtureRoot, profile);
  const next = changedEdition();
  const root = temporaryRoot();
  try {
    initializeMediaWikiEditionLifecycleV1(root, initial);
    const stale = activateMediaWikiEditionV1(root, { edition: next, parentEditionDigest: "0".repeat(64) });
    assert.equal(stale.outcome, "DENIED");
    assert.equal(stale.reason, "STALE_PARENT_DENIED");
    assert.equal(readMediaWikiEditionLifecycleV1(root).index.activeEditionDigest, initial.editionDigest);

    assert.equal(activateMediaWikiEditionV1(root, {
      edition: next,
      parentEditionDigest: initial.editionDigest,
    }).outcome, "ACTIVATED");
    const duplicate = activateMediaWikiEditionV1(root, {
      edition: next,
      parentEditionDigest: next.editionDigest,
    });
    assert.equal(duplicate.outcome, "DENIED");
    assert.equal(duplicate.reason, "DUPLICATE_ACTIVATION_DENIED");

    const tamperedRoot = temporaryRoot();
    try {
      initializeMediaWikiEditionLifecycleV1(tamperedRoot, initial);
      const staged = stageMediaWikiEditionV1(tamperedRoot, {
        edition: next,
        parentEditionDigest: initial.editionDigest,
      });
      assert.equal(staged.outcome, "STAGED");
      const digest = staged.outcome === "STAGED" ? staged.stagedEditionDigest : "";
      writeFileSync(path.join(tamperedRoot, "staging", digest, "index.json"), "{}", "utf8");
      assert.equal(verifyMediaWikiEditionStageV1(tamperedRoot, digest).outcome, "DENIED");
      assert.throws(() => readMediaWikiEditionLifecycleV1(tamperedRoot), /TAMPERED_STAGE_DENIED|INDEX_DENIED/);
    } finally {
      removeRoot(tamperedRoot);
    }

    const interruptedRoot = temporaryRoot();
    try {
      initializeMediaWikiEditionLifecycleV1(interruptedRoot, initial);
      const interrupted = activateMediaWikiEditionV1(interruptedRoot, {
        edition: next,
        parentEditionDigest: initial.editionDigest,
      }, { injectFailureAt: "INTERRUPTED_STAGE" });
      assert.equal(interrupted.outcome, "DENIED");
      assert.equal(interrupted.reason, "INTERRUPTED_STAGE_DENIED");
      assert.equal(readMediaWikiEditionLifecycleV1(interruptedRoot).index.activeEditionDigest, initial.editionDigest);
      const deniedWhileStaged = activateMediaWikiEditionV1(interruptedRoot, {
        edition: next,
        parentEditionDigest: initial.editionDigest,
      });
      assert.equal(deniedWhileStaged.outcome, "DENIED");
      assert.equal(deniedWhileStaged.reason, "INTERRUPTED_STAGE_DENIED");
      assert.equal(cleanupMediaWikiEditionResidueV1(interruptedRoot).outcome, "CLEANED");
      assert.equal(readMediaWikiEditionLifecycleV1(interruptedRoot).index.activeEditionDigest, initial.editionDigest);
    } finally {
      removeRoot(interruptedRoot);
    }

    const crossVolume = activateMediaWikiEditionV1(root, {
      edition: changedEdition(),
      parentEditionDigest: next.editionDigest,
    }, { activeIndexPath: "/dev/shm/psai107-active-index.json" });
    assert.equal(crossVolume.outcome, "DENIED");
    assert.match(crossVolume.reason, /OWNERSHIP_DENIED|CROSS_VOLUME_POINTER_DENIED/);
    writeFileSync(path.join(root, "unowned.tmp"), "residue", "utf8");
    const unowned = activateMediaWikiEditionV1(root, {
      edition: changedEdition(),
      parentEditionDigest: next.editionDigest,
    });
    assert.equal(unowned.outcome, "DENIED");
    assert.equal(unowned.reason, "OWNERSHIP_DENIED");
  } finally {
    removeRoot(root);
  }
});
