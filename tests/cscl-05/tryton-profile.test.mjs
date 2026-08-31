import assert from "node:assert/strict";
import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";
import Ajv2020 from "ajv/dist/2020.js";
import addFormats from "ajv-formats";

import {
  buildTrytonProfile,
  canonicalJson,
  validateTrytonCapture,
} from "../../src/cscl-05/tryton-profile.mjs";

const repoRoot = resolve(import.meta.dirname, "../..");
const fixtureRoot = resolve(repoRoot, "tests/fixtures/cscl-05");
const boundary = { authorityGrant: "NONE", promotionGrant: "NONE", executionGrant: "NONE" };

async function schema(name) {
  return JSON.parse(await readFile(resolve(repoRoot, `contracts/cscl-01/${name}-v1.schema.json`), "utf8"));
}

async function built() {
  return buildTrytonProfile({ repoRoot });
}

test("offline build emits exactly 36 complete source-native cells and facts", async () => {
  const result = await built();
  assert.equal(result.facts.length, 36);
  assert.equal(result.cells.length, 36);
  assert.equal(result.profile.evidenceCells.length, 36);
  const coordinates = new Set(result.profile.evidenceCells.map((c) => `${c.capabilityFamily}:${c.questionId}`));
  assert.equal(coordinates.size, 36);
  assert.deepEqual(new Set(result.cells.map((c) => c.systemId)), new Set(["tryton"]));
  assert.deepEqual(result.profile.boundary, boundary);
  assert.equal(result.profile.systemRole, "TRAINING");
  assert.equal(result.profile.holdoutIsolation, "TRAINING_PROFILE");
});

test("facts, cells, and profile satisfy frozen closed schemas", async () => {
  const ajv = new Ajv2020({ allErrors: true, strict: true });
  addFormats(ajv);
  const factValidator = ajv.compile(await schema("source-fact"));
  const cellValidator = ajv.compile(await schema("evidence-cell"));
  const profileValidator = ajv.compile(await schema("system-profile"));
  const result = await built();
  for (const fact of result.facts) assert.equal(factValidator(fact), true, JSON.stringify(factValidator.errors));
  for (const cell of result.cells) assert.equal(cellValidator(cell), true, JSON.stringify(cellValidator.errors));
  assert.equal(profileValidator(result.profile), true, JSON.stringify(profileValidator.errors));
});

test("all evidence binds exact raw member bytes and every negative has counterevidence", async () => {
  const result = await built();
  const manifest = JSON.parse(await readFile(resolve(fixtureRoot, "source-members-v1.json"), "utf8"));
  const members = new Map(manifest.members.map((m) => [m.member, m]));
  const facts = new Map(result.facts.map((f) => [f.factId, f]));
  for (const cell of result.cells) {
    assert.ok(cell.evidence.length > 0);
    if (["ABSENT", "CONFLICTING"].includes(cell.state)) assert.ok(cell.counterexamples.length > 0);
    for (const reference of cell.evidence) {
      const fact = facts.get(reference.sourceFactId);
      assert.ok(fact);
      assert.equal(reference.excerptSha256, fact.exactEvidence.excerptSha256);
      const member = [...members.values()].find((m) => fact.exactEvidence.exactLocator.includes(`#${m.member}:`));
      assert.ok(member, fact.exactEvidence.exactLocator);
      assert.equal(fact.sourceIdentity.sourceBytesSha256, member.rawSha256);
    }
  }
});

test("profile preserves Tryton terms and rejects generic normalization", async () => {
  const result = await built();
  const terms = result.profile.sourceNativeTerminology.map((x) => x.term);
  for (const term of ["party.party", "party.address", "product.template", "product.product", "sale.sale", "sale.line", "Quotation", "Confirmed", "Processing", "Done", "Cancelled"])
    assert.ok(terms.includes(term), term);
  const serialized = canonicalJson(result);
  for (const forbidden of ["business partner", "item master", "common core", "\"Authority\":"])
    assert.equal(serialized.toLowerCase().includes(forbidden.toLowerCase()), false, forbidden);
});

test("offline build is byte deterministic and performs no network", async () => {
  const oldFetch = globalThis.fetch;
  globalThis.fetch = () => { throw new Error("network attempted"); };
  try {
    const a = await built();
    const b = await built();
    assert.equal(canonicalJson(a), canonicalJson(b));
  } finally {
    globalThis.fetch = oldFetch;
  }
});

test("frozen identities deny fixture drift, member drift, extras, and paired redigestion", async () => {
  const mutations = [
    ["selectorDigest", "0".repeat(64)],
    ["questionDigest", "1".repeat(64)],
    ["parserVersion", "9.9.9"],
    ["canonicalizerVersion", "9.9.9"],
  ];
  for (const [key, value] of mutations)
    await assert.rejects(() => buildTrytonProfile({ repoRoot, overrides: { [key]: value } }), /frozen|drift|forbidden/i);
  await assert.rejects(() => buildTrytonProfile({ repoRoot, overrides: { extra: true } }), /extra|forbidden/i);
  const dir = await mkdtemp(join(tmpdir(), "cscl05-drift-"));
  const manifest = JSON.parse(await readFile(resolve(fixtureRoot, "source-members-v1.json"), "utf8"));
  const first = manifest.members[0];
  await writeFile(join(dir, "member.bin"), Buffer.from("replacement"));
  await assert.rejects(() => buildTrytonProfile({ repoRoot, memberOverrides: { [first.member]: join(dir, "member.bin") } }), /member|digest|length/i);
});

test("committed closed facts, cells, and profile match the deterministic offline build", async () => {
  const result = await built();
  for (const [name, value] of [["facts-v1.json", result.facts], ["cells-v1.json", result.cells], ["profile-v1.json", result.profile]]) {
    const committed = JSON.parse(await readFile(resolve(fixtureRoot, "expected", name), "utf8"));
    assert.equal(canonicalJson(committed), canonicalJson(value), name);
  }
});

test("capture verifier admits only exact official index, artifacts, signatures, safe regular members and cap", async () => {
  const captureDir = resolve(fixtureRoot, "artifacts");
  const receipt = await validateTrytonCapture({ repoRoot, captureDir });
  assert.equal(receipt.artifacts.length, 4);
  assert.equal(receipt.signaturesVerified, 4);
  assert.ok(receipt.totalBytes <= 20 * 1024 * 1024);
  assert.deepEqual(receipt.mirrorSubstitution, "DENIED");
});

test("capture verifier denies unsigned, wrong artifact/index/key/signature/tarball, traversal, symlink, mirror, and cap", async () => {
  for (const mutation of ["missingSignature", "artifactDigest", "indexDigest", "wrongKey", "signatureDigest", "signedTarball", "traversal", "symlink", "cap", "mirror"])
    await assert.rejects(() => validateTrytonCapture({ repoRoot, captureDir: resolve(fixtureRoot, "artifacts"), testMutation: mutation }), /capture|signature|digest|index|unsafe|cap|official|mirror|key/i);
});
