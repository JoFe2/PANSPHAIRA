import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtemp, readFile, readdir, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

import {
  CAPTURE_LIMIT_BYTES,
  loadAndVerifyCapture,
  replayCapture,
  evaluateDrift,
} from "../../src/rks-01/deterministic-ingestion.mjs";
import { buildCorpusInputs } from "../../src/rks-01/corpus-builder.mjs";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const manifestPath = resolve(repoRoot, "tests/fixtures/rks-01/source-capture-manifest-v1.json");
const driftCases = JSON.parse(await readFile(resolve(repoRoot, "tests/fixtures/rks-01/drift-cases-v1.json"), "utf8"));

async function verified(overrides = {}) {
  return loadAndVerifyCapture({ repoRoot, manifestPath, ...overrides });
}

async function copiedManifest() {
  const value = JSON.parse(await readFile(manifestPath, "utf8"));
  return value;
}

function mutateEntry(manifest, patch) {
  Object.assign(manifest.sources.find((source) => source.role === "OPENAPI_SPEC"), patch);
  return manifest;
}

test("base64 snapshot transport is delivery-safe and decodes to every exact admitted raw byte", async () => {
  const manifest = await copiedManifest();
  const snapshotRoot = resolve(repoRoot, "tests/fixtures/rks-01/source-snapshots");
  const artifacts = (await readdir(snapshotRoot, { recursive: true, withFileTypes: true }))
    .filter((entry) => entry.isFile())
    .map((entry) => resolve(entry.parentPath, entry.name));
  assert.equal(artifacts.length, manifest.sources.length);
  assert.ok(artifacts.every((path) => path.endsWith(".b64")), "raw source payload path remains");

  let decodedDeliveryHazards = 0;
  for (const source of manifest.sources) {
    assert.equal(source.storageEncoding, "BASE64");
    assert.match(source.encodedArtifactPath, /^tests\/fixtures\/rks-01\/source-snapshots\/.+\.b64$/);
    const encoded = await readFile(resolve(repoRoot, source.encodedArtifactPath));
    assert.equal(encoded.toString("ascii").endsWith("\n"), true);
    const lines = encoded.toString("ascii").slice(0, -1).split("\n");
    assert.ok(lines.every((line, index) => line.length <= 76 && (index === lines.length - 1 || line.length === 76)));
    const raw = Buffer.from(lines.join(""), "base64");
    const canonicalLines = raw.toString("base64").match(/.{1,76}/g);
    assert.equal(encoded.equals(Buffer.from(`${canonicalLines.join("\n")}\n`, "ascii")), true, "base64 is not canonical");
    assert.equal(raw.byteLength, source.rawByteLength);
    assert.equal(createHash("sha256").update(raw).digest("hex"), source.rawSha256);
    assert.doesNotMatch(encoded.toString("ascii"), /^(?:<<<<<<< |=======|>>>>>>> )|[ \t]+$/m);
    if (/^(?:<<<<<<< |=======|>>>>>>> )|[ \t]+$/m.test(raw.toString("utf8"))) decodedDeliveryHazards += 1;
  }
  assert.ok(decodedDeliveryHazards > 0, "regression fixture must retain official conflict-marker/trailing-whitespace bytes");
});

test("offline capture admits the exact frozen official selector set and required obligations", async () => {
  const capture = await verified();
  assert.equal(capture.outcome, "VERIFIED");
  assert.deepEqual(capture.counts, { wikidata: 20, cpythonDocuments: 20, openapiDocuments: 1, rfcControls: 3, obligations: 3, total: 47 });
  assert.ok(capture.totalBytes > 0 && capture.totalBytes <= CAPTURE_LIMIT_BYTES);
  assert.equal(capture.networkRequests, 0);
  assert.equal(capture.digests.sourceSetDigest, "6b13a1e1a23c0a94b1a259c44ceb9a0cf8713766f5632a1a0381e7134799601d");
  assert.equal(capture.digests.canonicalRecordsDigest, "c258b3f41e716469ea54e6bc18c239c96e890b9cce2d975c85e45282518cd911");
  assert.deepEqual(capture.nonClaims, ["NO_MODEL_EXECUTION", "NO_FINAL_RAW_OR_TYPED_CORPUS", "NO_TRUTH_CAPABILITY_OR_AUTHORITY_GRANT"]);
});

test("every source is pinned, exact-byte bound, safely stored, and legally classified", async () => {
  const capture = await verified();
  for (const source of capture.sources) {
    assert.match(source.rawSha256, /^[0-9a-f]{64}$/);
    assert.equal(source.actualSha256, source.rawSha256);
    assert.equal(source.actualByteLength, source.rawByteLength);
    assert.match(source.retrievedAt, /^2026-/);
    assert.ok(source.canonicalUrl.startsWith("https://"));
    assert.ok(source.pinnedRequestUrl.startsWith("https://"));
    assert.ok(!/(?:\/|=)(?:main|master|latest)(?:\/|$|&)/i.test(source.pinnedRequestUrl));
    assert.ok(!source.encodedArtifactPath.startsWith("/") && !source.encodedArtifactPath.includes(".."));
    assert.ok(["TRANSFORM_ALLOWED", "UNMODIFIED_ONLY"].includes(source.transformationClass));
    assert.ok(source.license.id && source.license.notice && source.license.obligations.length > 0);
    assert.ok(source.parser.id && source.parser.version && source.canonicalizer.id && source.canonicalizer.version);
  }
});

test("Wikidata parsing preserves complete statements including rank, qualifiers, and references", async () => {
  const capture = await verified();
  const wikidata = capture.canonicalRecords.filter((record) => record.sourceClass === "WIKIDATA_STRUCTURED");
  assert.equal(wikidata.length, 20);
  for (const record of wikidata) {
    assert.equal(record.entity.id, record.selector);
    assert.equal(record.entity.lastrevid, Number(record.revision));
    for (const statements of Object.values(record.entity.claims)) {
      for (const statement of statements) {
        assert.ok(Object.hasOwn(statement, "rank"));
        assert.ok(Object.hasOwn(statement, "mainsnak"));
        assert.ok(Object.hasOwn(statement, "qualifiers"));
        assert.ok(Object.hasOwn(statement, "references"));
      }
    }
  }
});

test("repeated offline replay is byte-identical and Raw/typed precursors bind one equal source set", async () => {
  const first = await verified();
  const second = await replayCapture({ repoRoot, manifestPath });
  assert.deepEqual(second.digests, first.digests);
  assert.equal(second.receiptBytes.equals(first.receiptBytes), true);

  const corpusA = buildCorpusInputs(first);
  const corpusB = buildCorpusInputs(second);
  assert.equal(corpusA.raw.sourceSetDigest, corpusA.typed.sourceSetDigest);
  assert.equal(corpusA.raw.sourceSetDigest, first.digests.sourceSetDigest);
  assert.equal(corpusA.raw.records.length, corpusA.typed.records.length);
  assert.equal(corpusA.digest, corpusB.digest);
  assert.equal(corpusA.finalCorpusBuilt, false);
});

test("changed bytes, revision, parser, or license create a new immutable capture and require revalidation", async () => {
  const capture = await verified();
  for (const change of driftCases.changes) {
    const result = evaluateDrift(capture, change);
    assert.equal(result.outcome, "REVALIDATION_REQUIRED", change.kind);
    assert.notEqual(result.newCaptureDigest, capture.digests.captureDigest);
    assert.equal(result.priorCaptureDigest, capture.digests.captureDigest);
    assert.equal(result.historyByteIdentical, true);
    assert.ok(result.reasonCodes.includes(change.reasonCode));
  }
});

test("moving identity, source mismatch, obligation loss, extra sources, parser drift, and re-digested substitution fail closed", async () => {
  const cases = [
    [mutateEntry(await copiedManifest(), { pinnedRequestUrl: "https://raw.githubusercontent.com/OAI/OpenAPI-Specification/main/versions/3.2.0.md", immutableIdentity: { kind: "MOVING_ALIAS", revision: "main" } }), "MOVING_ONLY_IDENTITY"],
    [mutateEntry(await copiedManifest(), { canonicalUrl: "https://attacker.invalid/spec", rawSha256: "0".repeat(64) }), "SOURCE_IDENTITY_MISMATCH"],
    [mutateEntry(await copiedManifest(), { license: { id: "Apache-2.0", notice: "", obligations: [] } }), "MISSING_LICENSE_OBLIGATIONS"],
    [{ ...(await copiedManifest()), sources: [...(await copiedManifest()).sources, structuredClone((await copiedManifest()).sources[0])] }, "EXTRA_OR_DUPLICATE_SOURCE"],
    [mutateEntry(await copiedManifest(), { parser: { id: "commonmark-bounded", version: "9.9.9" } }), "PARSER_DRIFT"],
  ];
  for (const [manifest, reason] of cases) {
    await assert.rejects(() => verified({ manifest }), new RegExp(reason));
  }

  const substituted = mutateEntry(await copiedManifest(), { canonicalUrl: "https://attacker.invalid/spec", pinnedRequestUrl: "https://attacker.invalid/spec" });
  substituted.sources.find((source) => source.role === "OPENAPI_SPEC").rawSha256 = "f".repeat(64);
  await assert.rejects(() => verified({ manifest: substituted, allowManifestDigestMismatch: true }), /SOURCE_IDENTITY_MISMATCH/);
});

test("unsafe paths, symlinks, total bytes over 20 MiB, and source history mutation deny", async () => {
  const unsafe = mutateEntry(await copiedManifest(), { encodedArtifactPath: "../escape.b64" });
  await assert.rejects(() => verified({ manifest: unsafe }), /UNSAFE_SOURCE_PATH/);

  const oversized = await copiedManifest();
  oversized.sources[0].rawByteLength = CAPTURE_LIMIT_BYTES + 1;
  await assert.rejects(() => verified({ manifest: oversized }), /CAPTURE_SIZE_LIMIT_EXCEEDED/);

  const tempRoot = await mkdtemp(resolve(tmpdir(), "rks01-symlink-"));
  const manifest = await copiedManifest();
  const target = resolve(repoRoot, manifest.sources[0].encodedArtifactPath);
  const link = resolve(tempRoot, "linked-source.b64");
  await symlink(target, link);
  manifest.sources[0].encodedArtifactPath = "linked-source.b64";
  await assert.rejects(() => loadAndVerifyCapture({ repoRoot: tempRoot, manifest }), /SOURCE_SYMLINK_FORBIDDEN/);

  const capture = await verified();
  const mutatedHistory = structuredClone(capture);
  mutatedHistory.sources[0].rawSha256 = "a".repeat(64);
  assert.throws(() => evaluateDrift(mutatedHistory, driftCases.changes[0]), /SOURCE_HISTORY_MUTATION/);
});

test("RFC 9987 remains identity-byte unmodified-only control and transformed prose is denied", async () => {
  const capture = await verified();
  const rfc = capture.sources.filter((source) => source.sourceProfile === "ietf-rfc9987-archival-control-v1");
  assert.equal(rfc.length, 3);
  assert.ok(rfc.every((source) => source.transformationClass === "UNMODIFIED_ONLY"));
  assert.equal(capture.canonicalRecords.some((record) => record.sourceClass === "RFC_DERIVATIVE_PROSE"), false);
  assert.throws(() => buildCorpusInputs(capture, { transformRfc: true }), /RFC_TRANSFORMED_PROSE_DENIED/);
});

test("capture CLI is offline by default and network mode is explicit", async () => {
  const script = await readFile(resolve(repoRoot, "scripts/capture-rks-01-sources.mjs"), "utf8");
  assert.match(script, /--network/);
  assert.match(script, /OFFLINE_VERIFICATION/);
  assert.doesNotMatch(script, /execSync|spawnSync/);
});
