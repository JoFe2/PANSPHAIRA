import assert from "node:assert/strict";
import { chmod, lstat, mkdir, mkdtemp, readFile, readlink, rm, symlink } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import {
  EXTENSION_DYNAMIC_RUNNER_DIGEST_V1,
  EXTENSION_DYNAMIC_SOURCE_ROOT_V1,
  EXTENSION_DYNAMIC_STAGE_ROOT_V1,
  EXTENSION_DYNAMIC_SUBJECT_TREE_DIGEST_V1,
  cleanupExtensionDynamicStagingV1,
  prepareExtensionDynamicStagingV1,
  sha256FileV1,
  sha256TreeV1,
} from "../scripts/extension-dynamic-synthetic.mjs";

const parentRoot = path.dirname(EXTENSION_DYNAMIC_STAGE_ROOT_V1);
const sourceSubject = path.join(EXTENSION_DYNAMIC_SOURCE_ROOT_V1, "subject");
const sourceRunner = path.join(EXTENSION_DYNAMIC_SOURCE_ROOT_V1, "runner", "runner.js");

async function absent(target) {
  await assert.rejects(lstat(target), (error) => error?.code === "ENOENT");
}

async function cleanOwnedRoot() {
  try {
    await cleanupExtensionDynamicStagingV1();
  } catch (error) {
    if (error?.code !== "ENOENT") throw error;
  }
}

test("ETL staging freezes the exact repository-owned file and tree bytes", { concurrency: false }, async () => {
  assert.equal(await sha256TreeV1(sourceSubject), EXTENSION_DYNAMIC_SUBJECT_TREE_DIGEST_V1);
  assert.equal(await sha256FileV1(sourceRunner), EXTENSION_DYNAMIC_RUNNER_DIGEST_V1);
  for (let repetition = 0; repetition < 25; repetition += 1) {
    assert.equal(await sha256TreeV1(sourceSubject), EXTENSION_DYNAMIC_SUBJECT_TREE_DIGEST_V1);
  }
});

test("ETL staging prepares private invoking-uid bytes and cleans with zero residue", { concurrency: false }, async () => {
  await cleanOwnedRoot();
  const prepared = await prepareExtensionDynamicStagingV1();
  try {
    assert.equal(prepared.stageRoot, EXTENSION_DYNAMIC_STAGE_ROOT_V1);
    assert.equal(prepared.subjectDigest, EXTENSION_DYNAMIC_SUBJECT_TREE_DIGEST_V1);
    assert.equal(prepared.runnerDigest, EXTENSION_DYNAMIC_RUNNER_DIGEST_V1);
    assert.equal(prepared.ownerUid, process.getuid());
    assert.deepEqual(await readFile(path.join(prepared.subjectHostPath, "core.json")), await readFile(path.join(sourceSubject, "core.json")));
    assert.deepEqual(await readFile(prepared.runnerHostPath), await readFile(sourceRunner));

    const expectedModes = new Map([
      [parentRoot, 0o700],
      [prepared.stageRoot, 0o700],
      [prepared.subjectHostPath, 0o500],
      [path.dirname(prepared.runnerHostPath), 0o500],
      [prepared.runnerHostPath, 0o400],
      [prepared.scratchHostPath, 0o700],
    ]);
    for (const [target, expectedMode] of expectedModes) {
      const metadata = await lstat(target);
      assert.equal(metadata.uid, process.getuid(), target);
      assert.equal(metadata.mode & 0o777, expectedMode, target);
      assert.equal(metadata.isSymbolicLink(), false, target);
    }
  } finally {
    const cleanup = await cleanupExtensionDynamicStagingV1();
    assert.deepEqual(cleanup, { stageRootRemoved: true, parentRemoved: true, residueCount: 0 });
  }
  await absent(EXTENSION_DYNAMIC_STAGE_ROOT_V1);
});

test("ETL staging denies digest drift before creating scoped state", { concurrency: false }, async () => {
  await cleanOwnedRoot();
  await assert.rejects(
    prepareExtensionDynamicStagingV1({ expectedSubjectDigest: "f".repeat(64) }),
    /EXTENSION_DYNAMIC_STAGING_SUBJECT_DIGEST_DRIFT/,
  );
  await assert.rejects(
    prepareExtensionDynamicStagingV1({ expectedRunnerDigest: "f".repeat(64) }),
    /EXTENSION_DYNAMIC_STAGING_RUNNER_DIGEST_DRIFT/,
  );
  await absent(EXTENSION_DYNAMIC_STAGE_ROOT_V1);
});

test("ETL staging denies unsafe parent mode and any existing stage root", { concurrency: false }, async () => {
  await cleanOwnedRoot();
  await mkdir(parentRoot, { mode: 0o700 });
  await chmod(parentRoot, 0o755);
  await assert.rejects(prepareExtensionDynamicStagingV1(), /EXTENSION_DYNAMIC_STAGING_MODE/);
  await chmod(parentRoot, 0o700);
  await mkdir(EXTENSION_DYNAMIC_STAGE_ROOT_V1, { mode: 0o700 });
  await assert.rejects(prepareExtensionDynamicStagingV1(), /EXTENSION_DYNAMIC_STAGING_STAGE_EXISTS/);
  await cleanupExtensionDynamicStagingV1();
});

test("ETL staging refuses a symlink replacement without following or deleting its target", { concurrency: false }, async () => {
  await cleanOwnedRoot();
  await mkdir(parentRoot, { mode: 0o700 });
  const target = await mkdtemp("/tmp/extension-dynamic-symlink-target-");
  await symlink(target, EXTENSION_DYNAMIC_STAGE_ROOT_V1);
  try {
    await assert.rejects(prepareExtensionDynamicStagingV1(), /EXTENSION_DYNAMIC_STAGING_STAGE_EXISTS/);
    await assert.rejects(cleanupExtensionDynamicStagingV1(), /EXTENSION_DYNAMIC_STAGING_UNSAFE_DIRECTORY/);
    assert.equal(await readlink(EXTENSION_DYNAMIC_STAGE_ROOT_V1), target);
    const targetMetadata = await lstat(target);
    assert.equal(targetMetadata.isDirectory(), true);
  } finally {
    await rm(EXTENSION_DYNAMIC_STAGE_ROOT_V1, { force: true });
    await rm(target, { recursive: true, force: true });
    await cleanupExtensionDynamicStagingV1();
  }
});

test("ETL staging cleanup is exact-root only, idempotent and process-execution free", { concurrency: false }, async () => {
  await cleanOwnedRoot();
  await assert.rejects(cleanupExtensionDynamicStagingV1("/tmp"), /EXTENSION_DYNAMIC_STAGING_CLEANUP_ROOT/);
  assert.deepEqual(await cleanupExtensionDynamicStagingV1(), { stageRootRemoved: true, parentRemoved: true, residueCount: 0 });
  const source = await readFile("scripts/extension-dynamic-synthetic.mjs", "utf8");
  assert.doesNotMatch(source, /node:child_process|spawn\(|execFile\(/);
});
