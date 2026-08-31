import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import Ajv2020 from "ajv/dist/2020.js";
import addFormats from "ajv-formats";

import {
  CAPTURE_BYTE_CAP,
  EXPECTED_IDENTITY,
  buildDolibarrProfile,
  canonicalJson,
  renderProfileArtifacts,
  validateCapture,
  validateProfileBundle,
} from "../../src/cscl-04/profile-builder.mjs";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const capturePath = resolve(repoRoot, "tests/fixtures/cscl-04/dolibarr-24.0.0-capture-v1.json");
const readCapture = async () => JSON.parse(await readFile(capturePath, "utf8"));
const clone = (value) => structuredClone(value);

async function schemas() {
  const ajv = new Ajv2020({ allErrors: true, strict: true, allowUnionTypes: true });
  addFormats(ajv);
  const load = async (name) => ajv.compile(JSON.parse(await readFile(resolve(repoRoot, `contracts/cscl-01/${name}-v1.schema.json`), "utf8")));
  return { fact: await load("source-fact"), cell: await load("evidence-cell"), profile: await load("system-profile") };
}

test("RED: exact annotated tag, peeled commit, legal identity, parser and path are mandatory", async () => {
  const capture = await readCapture();
  assert.deepEqual(validateCapture(capture), { valid: true, reasonCodes: [] });
  assert.deepEqual(capture.identity, EXPECTED_IDENTITY);
  assert.ok(capture.totalDecodedBytes <= CAPTURE_BYTE_CAP);
  assert.equal(capture.files.every((file) => file.encoding === "base64"), true);

  const attacks = [
    ["ANNOTATED_TAG_OBJECT_MISMATCH", (x) => { x.identity.tagObject = x.identity.peeledCommit; }],
    ["PEELED_COMMIT_MISMATCH", (x) => { x.identity.peeledCommit = x.identity.tagObject; }],
    ["OFFICIAL_REPOSITORY_MISMATCH", (x) => { x.identity.officialRepository = "https://git.example/dolibarr.git"; }],
    ["LICENSE_ID_MISMATCH", (x) => { x.legal.licenseId = "GPL-3.0-only"; }],
    ["PARSER_VERSION_MISMATCH", (x) => { x.parser.version = "1.0.1"; }],
    ["CANONICALIZER_VERSION_MISMATCH", (x) => { x.canonicalizer.version = "1.0.1"; }],
    ["OFFLINE_NETWORK_POLICY_MISMATCH", (x) => { x.networkPolicy = "ONLINE_ALLOWED"; }],
    ["CAPTURE_PATH_SET_MISMATCH", (x) => { x.files[0].path = "htdocs/societe/class/copied.class.php"; }],
    ["SOURCE_BYTES_DIGEST_MISMATCH", (x) => { x.files[1].base64 = x.files[1].base64.slice(0, -4) + "AAAA"; }],
    ["CAPTURE_MANIFEST_DIGEST_MISMATCH", (x) => { x.captureDigest = "f".repeat(64); }],
    ["CAPTURE_BYTE_CAP_EXCEEDED", (x) => { x.totalDecodedBytes = CAPTURE_BYTE_CAP + 1; }],
  ];
  for (const [reason, mutate] of attacks) {
    const changed = clone(capture); mutate(changed);
    assert.ok(validateCapture(changed).reasonCodes.includes(reason), reason);
  }
});

test("build emits exact closed 36-cell source-native profile with exact-byte facts", async () => {
  const capture = await readCapture();
  const first = buildDolibarrProfile(capture);
  const second = buildDolibarrProfile(capture);
  assert.equal(canonicalJson(first), canonicalJson(second));
  assert.deepEqual(first.counts, { capabilityFamilies: 3, questionsPerFamily: 12, cells: 36, sourceFacts: 36 });
  assert.equal(first.cells.length, 36);
  assert.equal(first.sourceFacts.length, 36);
  assert.equal(first.profile.evidenceCells.length, 36);
  assert.deepEqual(new Set(first.cells.map((x) => `${x.capabilityFamily}/${x.questionId}`)).size, 36);
  assert.deepEqual(first.profile.capabilityFamilies, ["PARTY_CUSTOMER_MANAGEMENT", "PRODUCT_ITEM_MANAGEMENT", "SALES_ORDER_MANAGEMENT"]);
  assert.equal(first.profile.systemId, "dolibarr");
  assert.equal(first.profile.systemRole, "TRAINING");
  assert.equal(first.profile.holdoutIsolation, "TRAINING_PROFILE");

  const validators = await schemas();
  for (const fact of first.sourceFacts) assert.equal(validators.fact(fact), true, JSON.stringify(validators.fact.errors));
  for (const { capabilityFamily, cellDigest, ...cell } of first.cells) assert.equal(validators.cell(cell), true, JSON.stringify(validators.cell.errors));
  assert.equal(validators.profile(first.profile), true, JSON.stringify(validators.profile.errors));

  const bytes = Buffer.concat(capture.files.map((x) => Buffer.from(x.base64, "base64")));
  assert.equal(bytes.length, capture.totalDecodedBytes);
  for (const fact of first.sourceFacts) {
    const file = capture.files.find((x) => fact.exactEvidence.exactLocator.includes(`path=${x.path};`));
    assert.ok(file);
    const source = Buffer.from(file.base64, "base64");
    assert.ok(fact.exactEvidence.byteEnd <= source.length);
  }
  assert.doesNotMatch(canonicalJson(first), /res\.partner|DocType|party model|common-core|normalizedVocabulary/i);
});

test("closed validation denies invented facts, missing cells, omitted counterevidence and extras", async () => {
  const bundle = buildDolibarrProfile(await readCapture());
  assert.deepEqual(validateProfileBundle(bundle), { valid: true, reasonCodes: [] });
  const attacks = [
    ["SOURCE_FACT_DIGEST_MISMATCH", (x) => { x.sourceFacts[0].claim = "Invented replacement"; }],
    ["CELL_DIGEST_MISMATCH", (x) => { x.cells[0].evidence[0].excerptSha256 = "f".repeat(64); }],
    ["MISSING_CELL", (x) => { x.cells.pop(); }],
    ["PROFILE_CELL_REFERENCE_MISMATCH", (x) => { x.profile.evidenceCells.pop(); }],
    ["NEGATIVE_COUNTEREVIDENCE_OMITTED", (x) => { x.cells.find((c) => c.state === "CONFLICTING").counterexamples = []; }],
    ["EXTRA_FIELD_FORBIDDEN", (x) => { x.profile.Authority = "WRITE"; }],
    ["SOURCE_FACT_SET_MISMATCH", (x) => { x.sourceFacts.push(clone(x.sourceFacts[0])); }],
    ["INVENTED_SOURCE_FACT_REFERENCE", (x) => { x.cells[2].evidence[0].sourceFactId = "dolibarr.invented-fact"; }],
  ];
  for (const [reason, mutate] of attacks) {
    const changed = clone(bundle); mutate(changed);
    assert.ok(validateProfileBundle(changed).reasonCodes.includes(reason), `${reason}: ${validateProfileBundle(changed).reasonCodes}`);
  }
});

test("rendered offline artifacts are canonical and byte-identical to committed outputs", async () => {
  const capture = await readCapture();
  const first = renderProfileArtifacts(capture);
  const second = renderProfileArtifacts(capture);
  assert.deepEqual(first, second);
  assert.deepEqual(Object.keys(first).sort(), ["evidence-cells-v1.json", "source-facts-v1.json", "system-profile-v1.json"]);
  for (const [name, bytes] of Object.entries(first)) {
    assert.equal(bytes, canonicalJson(JSON.parse(bytes)) + "\n");
    assert.equal(bytes, await readFile(resolve(repoRoot, `tests/fixtures/cscl-04/${name}`), "utf8"));
  }
  const source = await readFile(resolve(repoRoot, "src/cscl-04/profile-builder.mjs"), "utf8");
  assert.doesNotMatch(source, /from ["']node:(?:http|https|net|tls)|\bfetch\s*\(/);
});

test("paired source substitution and redigestion cannot replace frozen official capture", async () => {
  const capture = await readCapture();
  const changed = clone(capture);
  changed.identity.officialRepository = "https://mirror.example/Dolibarr/dolibarr.git";
  changed.files[0].path = "mirror/COPYING";
  changed.files[0].sha256 = "0".repeat(64);
  changed.captureDigest = "0".repeat(64);
  const denied = validateCapture(changed);
  assert.ok(denied.reasonCodes.includes("OFFICIAL_REPOSITORY_MISMATCH"));
  assert.ok(denied.reasonCodes.includes("CAPTURE_PATH_SET_MISMATCH"));
  assert.ok(denied.reasonCodes.includes("SOURCE_BYTES_DIGEST_MISMATCH"));
});
