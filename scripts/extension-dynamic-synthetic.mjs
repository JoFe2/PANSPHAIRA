import { createHash } from "node:crypto";
import {
  chmod,
  lstat,
  mkdir,
  open,
  readdir,
  readFile,
  realpath,
  rm,
  rmdir,
} from "node:fs/promises";
import path from "node:path";

export const EXTENSION_DYNAMIC_STAGE_ROOT_V1 = "/tmp/chimpmaera/extension-dynamic";
export const EXTENSION_DYNAMIC_SOURCE_ROOT_V1 = path.resolve("tests/fixtures/extension-dynamic");
export const EXTENSION_DYNAMIC_SUBJECT_TREE_DIGEST_V1 = "00f5e0f2a16f744df208888303bc2c07f7c92c31ca8ffefae0a7d5f89d745398";
export const EXTENSION_DYNAMIC_RUNNER_DIGEST_V1 = "08f8f4b696c08edeb2871966a8e62d7af5d6c37283a5a29a95213f9ebe0230c6";

const PARENT_ROOT = path.dirname(EXTENSION_DYNAMIC_STAGE_ROOT_V1);
const SOURCE_SUBJECT = path.join(EXTENSION_DYNAMIC_SOURCE_ROOT_V1, "subject");
const SOURCE_RUNNER = path.join(EXTENSION_DYNAMIC_SOURCE_ROOT_V1, "runner", "runner.js");
const OPTION_KEYS = new Set(["expectedSubjectDigest", "expectedRunnerDigest"]);

function fail(code, detail) {
  throw new Error(`EXTENSION_DYNAMIC_STAGING_${code}: ${detail}`);
}

function modeOf(metadata) {
  return metadata.mode & 0o777;
}

async function maybeLstat(target) {
  try {
    return await lstat(target);
  } catch (error) {
    if (error?.code === "ENOENT") return null;
    throw error;
  }
}

function assertOwnedDirectory(metadata, target, expectedMode) {
  if (metadata.isSymbolicLink() || !metadata.isDirectory()) fail("UNSAFE_DIRECTORY", target);
  if (typeof process.getuid !== "function" || metadata.uid !== process.getuid()) fail("OWNER", target);
  if (modeOf(metadata) !== expectedMode) fail("MODE", `${target}:${modeOf(metadata).toString(8)}`);
}

function assertHexDigest(value, name) {
  if (typeof value !== "string" || !/^[a-f0-9]{64}$/.test(value)) fail("DIGEST", name);
}

export async function sha256FileV1(filePath) {
  const metadata = await lstat(filePath);
  if (metadata.isSymbolicLink() || !metadata.isFile()) fail("SOURCE_TYPE", filePath);
  const bytes = await readFile(filePath);
  return createHash("sha256").update(bytes).digest("hex");
}

export async function sha256TreeV1(rootPath) {
  const rootMetadata = await lstat(rootPath);
  if (rootMetadata.isSymbolicLink() || !rootMetadata.isDirectory()) fail("SOURCE_ROOT", rootPath);
  const records = [];

  async function visit(directory, relativeDirectory) {
    const names = await readdir(directory);
    names.sort((left, right) => left.localeCompare(right, "en"));
    for (const name of names) {
      const absolute = path.join(directory, name);
      const relative = relativeDirectory === "" ? name : `${relativeDirectory}/${name}`;
      const metadata = await lstat(absolute);
      if (metadata.isSymbolicLink()) fail("SOURCE_SYMLINK", relative);
      if (metadata.isDirectory()) {
        await visit(absolute, relative);
      } else if (metadata.isFile()) {
        records.push(`${relative}\0${await sha256FileV1(absolute)}\n`);
      } else {
        fail("SOURCE_TYPE", relative);
      }
    }
  }

  await visit(rootPath, "");
  if (records.length === 0) fail("SOURCE_EMPTY", rootPath);
  records.sort((left, right) => left.localeCompare(right, "en"));
  return createHash("sha256").update(records.join(""), "utf8").digest("hex");
}

async function writeExclusive(source, destination) {
  const bytes = await readFile(source);
  const handle = await open(destination, "wx", 0o400);
  try {
    await handle.writeFile(bytes);
  } finally {
    await handle.close();
  }
  await chmod(destination, 0o400);
}

async function copySubjectTree(sourceRoot, destinationRoot) {
  const directories = [destinationRoot];

  async function visit(sourceDirectory, destinationDirectory) {
    const names = await readdir(sourceDirectory);
    names.sort((left, right) => left.localeCompare(right, "en"));
    for (const name of names) {
      const source = path.join(sourceDirectory, name);
      const destination = path.join(destinationDirectory, name);
      const metadata = await lstat(source);
      if (metadata.isSymbolicLink()) fail("SOURCE_SYMLINK", source);
      if (metadata.isDirectory()) {
        await mkdir(destination, { mode: 0o700 });
        directories.push(destination);
        await visit(source, destination);
      } else if (metadata.isFile()) {
        await writeExclusive(source, destination);
      } else {
        fail("SOURCE_TYPE", source);
      }
    }
  }

  await visit(sourceRoot, destinationRoot);
  for (const directory of directories.reverse()) await chmod(directory, 0o500);
}

async function removeParentWhenEmpty() {
  const parentMetadata = await maybeLstat(PARENT_ROOT);
  if (parentMetadata === null) return true;
  assertOwnedDirectory(parentMetadata, PARENT_ROOT, 0o700);
  if ((await readdir(PARENT_ROOT)).length !== 0) return false;
  await rmdir(PARENT_ROOT);
  return true;
}

async function makeOwnedTreeRemovable(rootPath) {
  const expectedUid = process.getuid();

  async function visit(target) {
    const metadata = await lstat(target);
    if (metadata.isSymbolicLink()) fail("CLEANUP_SYMLINK", target);
    if (metadata.uid !== expectedUid) fail("OWNER", target);
    if (metadata.isDirectory()) {
      await chmod(target, 0o700);
      for (const name of await readdir(target)) await visit(path.join(target, name));
      await chmod(target, 0o700);
    } else if (metadata.isFile()) {
      await chmod(target, 0o600);
    } else {
      fail("CLEANUP_TYPE", target);
    }
  }

  await visit(rootPath);
}

export async function prepareExtensionDynamicStagingV1(options = {}) {
  if (options === null || typeof options !== "object" || Array.isArray(options)
    || Object.getPrototypeOf(options) !== Object.prototype) fail("OPTIONS", "plain object required");
  const unknown = Object.keys(options).filter((key) => !OPTION_KEYS.has(key));
  if (unknown.length > 0) fail("UNKNOWN_OPTION", unknown.sort().join(","));
  const expectedSubjectDigest = options.expectedSubjectDigest ?? EXTENSION_DYNAMIC_SUBJECT_TREE_DIGEST_V1;
  const expectedRunnerDigest = options.expectedRunnerDigest ?? EXTENSION_DYNAMIC_RUNNER_DIGEST_V1;
  assertHexDigest(expectedSubjectDigest, "expectedSubjectDigest");
  assertHexDigest(expectedRunnerDigest, "expectedRunnerDigest");

  if (await realpath(SOURCE_SUBJECT) !== SOURCE_SUBJECT) fail("SOURCE_REALPATH", SOURCE_SUBJECT);
  if (await realpath(SOURCE_RUNNER) !== SOURCE_RUNNER) fail("SOURCE_REALPATH", SOURCE_RUNNER);
  const sourceSubjectDigest = await sha256TreeV1(SOURCE_SUBJECT);
  const sourceRunnerDigest = await sha256FileV1(SOURCE_RUNNER);
  if (sourceSubjectDigest !== expectedSubjectDigest) fail("SUBJECT_DIGEST_DRIFT", sourceSubjectDigest);
  if (sourceRunnerDigest !== expectedRunnerDigest) fail("RUNNER_DIGEST_DRIFT", sourceRunnerDigest);

  let parentMetadata = await maybeLstat(PARENT_ROOT);
  if (parentMetadata === null) {
    await mkdir(PARENT_ROOT, { mode: 0o700 });
    await chmod(PARENT_ROOT, 0o700);
    parentMetadata = await lstat(PARENT_ROOT);
  }
  assertOwnedDirectory(parentMetadata, PARENT_ROOT, 0o700);
  if (await maybeLstat(EXTENSION_DYNAMIC_STAGE_ROOT_V1) !== null) fail("STAGE_EXISTS", EXTENSION_DYNAMIC_STAGE_ROOT_V1);

  let stageCreated = false;
  try {
    await mkdir(EXTENSION_DYNAMIC_STAGE_ROOT_V1, { mode: 0o700 });
    stageCreated = true;
    await chmod(EXTENSION_DYNAMIC_STAGE_ROOT_V1, 0o700);
    const subjectHostPath = path.join(EXTENSION_DYNAMIC_STAGE_ROOT_V1, "subject", "core");
    const runnerDirectory = path.join(EXTENSION_DYNAMIC_STAGE_ROOT_V1, "runner");
    const runnerHostPath = path.join(runnerDirectory, "runner.js");
    const scratchHostPath = path.join(EXTENSION_DYNAMIC_STAGE_ROOT_V1, "scratch");
    await mkdir(path.dirname(subjectHostPath), { mode: 0o700 });
    await mkdir(subjectHostPath, { mode: 0o700 });
    await mkdir(runnerDirectory, { mode: 0o700 });
    await mkdir(scratchHostPath, { mode: 0o700 });
    await copySubjectTree(SOURCE_SUBJECT, subjectHostPath);
    await writeExclusive(SOURCE_RUNNER, runnerHostPath);
    await chmod(runnerDirectory, 0o500);
    await chmod(path.dirname(subjectHostPath), 0o500);

    const stagedSubjectDigest = await sha256TreeV1(subjectHostPath);
    const stagedRunnerDigest = await sha256FileV1(runnerHostPath);
    if (stagedSubjectDigest !== sourceSubjectDigest) fail("STAGED_SUBJECT_DRIFT", stagedSubjectDigest);
    if (stagedRunnerDigest !== sourceRunnerDigest) fail("STAGED_RUNNER_DRIFT", stagedRunnerDigest);
    if (!await realpath(subjectHostPath).then((value) => value.startsWith(`${EXTENSION_DYNAMIC_STAGE_ROOT_V1}/`))) fail("STAGED_REALPATH", subjectHostPath);
    if (!await realpath(runnerHostPath).then((value) => value.startsWith(`${EXTENSION_DYNAMIC_STAGE_ROOT_V1}/`))) fail("STAGED_REALPATH", runnerHostPath);

    return {
      stageRoot: EXTENSION_DYNAMIC_STAGE_ROOT_V1,
      subjectHostPath,
      subjectDigest: stagedSubjectDigest,
      runnerHostPath,
      runnerDigest: stagedRunnerDigest,
      scratchHostPath,
      ownerUid: process.getuid(),
    };
  } catch (error) {
    if (stageCreated) {
      await makeOwnedTreeRemovable(EXTENSION_DYNAMIC_STAGE_ROOT_V1);
      await rm(EXTENSION_DYNAMIC_STAGE_ROOT_V1, { recursive: true, force: false });
      await removeParentWhenEmpty();
    }
    throw error;
  }
}

export async function cleanupExtensionDynamicStagingV1(stageRoot = EXTENSION_DYNAMIC_STAGE_ROOT_V1) {
  if (stageRoot !== EXTENSION_DYNAMIC_STAGE_ROOT_V1) fail("CLEANUP_ROOT", String(stageRoot));
  const metadata = await maybeLstat(stageRoot);
  if (metadata !== null) {
    assertOwnedDirectory(metadata, stageRoot, 0o700);
    await makeOwnedTreeRemovable(stageRoot);
    await rm(stageRoot, { recursive: true, force: false });
  }
  if (await maybeLstat(stageRoot) !== null) fail("CLEANUP_RESIDUE", stageRoot);
  const parentRemoved = await removeParentWhenEmpty();
  return { stageRootRemoved: true, parentRemoved, residueCount: 0 };
}
