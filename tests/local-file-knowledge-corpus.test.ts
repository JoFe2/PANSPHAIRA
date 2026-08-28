import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import Ajv2020 from "ajv/dist/2020.js";
import { canonicalJson } from "../packages/contracts/src/canonical-json.js";
import {
  activateLocalFileCorpusEditionV1,
  buildLocalFileCorpusIndexV1,
  LOCAL_FILE_CORPUS_BOUNDARY_V1,
  LOCAL_FILE_CORPUS_PROFILE_SCHEMA_V1,
  localFileCorpusManifestDigestV1,
  localFileCorpusReceiptDigestV1,
  queryLocalFileCorpusV1,
  readLocalFileCorpusEditionV1,
  validateLocalFileCorpusEditionV1,
  validateLocalFileCorpusIndexV1,
  type LocalFileCorpusProfileV1,
} from "../packages/contracts/src/local-file-knowledge-corpus.js";

const fixtureRoot = (edition: 1 | 2): string =>
  `tests/fixtures/local-file-corpus/edition-${edition}`;

const profiles: Record<1 | 2, LocalFileCorpusProfileV1> = {
  1: {
    schemaVersion: LOCAL_FILE_CORPUS_PROFILE_SCHEMA_V1,
    enabled: true,
    corpusId: "corpus:synthetic-fulfilment",
    editionId: "edition:synthetic-fulfilment-v1",
    priorEditionId: null,
    observedAtMs: 1_786_000_000_000,
    files: [
      { path: "operations.md", expectedContentDigest: "f2ea5859e3b5be0753626376b8109d785dcb055dbf0c1636c97863f49254e2c6", licence: "OWNER_AUTHORIZED", permittedUses: ["CURATED_READ", "EXPLORATORY_READ"], sharedSourceIds: ["source:fulfilment-handbook"] },
      { path: "policy.txt", expectedContentDigest: "9d45a1d2f0359f3005571efb9f88054706be8ca40e036e7cb5266cb273253415", licence: "OWNER_AUTHORIZED", permittedUses: ["CURATED_READ", "EXPLORATORY_READ"], sharedSourceIds: ["source:fulfilment-handbook"] },
    ],
    conflicts: [
      { left: { path: "operations.md", line: 2 }, right: { path: "policy.txt", line: 1 }, kind: "CONTRADICTION" },
      { left: { path: "operations.md", line: 2 }, right: { path: "policy.txt", line: 2 }, kind: "SOURCE_DEPENDENCY" },
    ],
  },
  2: {
    schemaVersion: LOCAL_FILE_CORPUS_PROFILE_SCHEMA_V1,
    enabled: true,
    corpusId: "corpus:synthetic-fulfilment",
    editionId: "edition:synthetic-fulfilment-v2",
    priorEditionId: "edition:synthetic-fulfilment-v1",
    observedAtMs: 1_786_086_400_000,
    files: [
      { path: "operations.md", expectedContentDigest: "2443494eeb568b4721649f706ea1c926fd73e4cbf06c048e88a449d6cbc1f5b9", licence: "OWNER_AUTHORIZED", permittedUses: ["CURATED_READ", "EXPLORATORY_READ"], sharedSourceIds: ["source:fulfilment-handbook"] },
      { path: "policy.txt", expectedContentDigest: "0879bbaf9892dd4752993096e99f6ae9a72c0f6a75d77ff8321d1093e0665b5d", licence: "OWNER_AUTHORIZED", permittedUses: ["CURATED_READ", "EXPLORATORY_READ"], sharedSourceIds: ["source:fulfilment-handbook"] },
    ],
    conflicts: [
      { left: { path: "operations.md", line: 2 }, right: { path: "policy.txt", line: 1 }, kind: "CONTRADICTION" },
      { left: { path: "operations.md", line: 2 }, right: { path: "policy.txt", line: 2 }, kind: "SOURCE_DEPENDENCY" },
    ],
  },
};

test("LKC-FILES-01 profile schema and runtime share the closed positive boundary", () => {
  const schema = JSON.parse(readFileSync("schemas/contracts/local-file-corpus-profile-v1.schema.json", "utf8"));
  const validate = new Ajv2020({ strict: true }).compile(schema);
  assert.equal(validate(profiles[1]), true, JSON.stringify(validate.errors));
  assert.equal(validate(profiles[2]), true, JSON.stringify(validate.errors));
  const unknown = { ...profiles[1], downloadUrl: "https://example.invalid/corpus" };
  assert.equal(validate(unknown), false);
  assert.throws(() => readLocalFileCorpusEditionV1(fixtureRoot(1), unknown), /PROFILE_DENIED/);
});

test("LKC-FILES-01 materializes two closed immutable UTF-8 editions with exact citations", () => {
  const first = readLocalFileCorpusEditionV1(fixtureRoot(1), profiles[1]);
  const second = readLocalFileCorpusEditionV1(fixtureRoot(2), profiles[2]);
  for (const edition of [first, second]) {
    assert.equal(validateLocalFileCorpusEditionV1(edition), true);
    assert.equal(edition.authorityBoundary, LOCAL_FILE_CORPUS_BOUNDARY_V1);
    assert.equal(edition.manifestDigest, localFileCorpusManifestDigestV1(edition));
    assert.deepEqual(edition.files.map((file) => file.path), ["operations.md", "policy.txt"]);
    assert.ok(edition.files.flatMap((file) => file.chunks).every((chunk) => /#L\d+$/.test(chunk.citation)));
  }
  assert.notEqual(first.rootDigest, second.rootDigest);
  assert.notEqual(first.manifestDigest, second.manifestDigest);
});

test("LKC-FILES-01 lexical query is deterministic and exposes conflicts and shared sources", () => {
  const edition = readLocalFileCorpusEditionV1(fixtureRoot(1), profiles[1]);
  const first = queryLocalFileCorpusV1(edition, "approved orders business day", "CURATED_READ");
  const second = queryLocalFileCorpusV1(edition, "business approved orders day", "CURATED_READ");
  assert.equal(canonicalJson(first), canonicalJson(second));
  assert.equal(first.receiptDigest, localFileCorpusReceiptDigestV1(first));
  assert.equal(first.results.length, 2);
  assert.ok(first.results.every((item) => item.sharedSourceIds.includes("source:fulfilment-handbook")));
  assert.ok(first.results.every((item) => item.conflictsWith.length >= 1));
  assert.deepEqual(first.results.map((item) => item.citation), ["operations.md#L2", "policy.txt#L1"]);
});

test("LKC-FILES-01 activates an exact successor and injected failure restores LKG with zero residue", () => {
  const first = readLocalFileCorpusEditionV1(fixtureRoot(1), profiles[1]);
  const second = readLocalFileCorpusEditionV1(fixtureRoot(2), profiles[2]);
  const initial = { accepted: first, lastKnownGood: first };
  const activated = activateLocalFileCorpusEditionV1(initial, second);
  assert.equal(activated.outcome, "ACTIVATED");
  assert.equal(activated.registry.accepted.manifestDigest, second.manifestDigest);
  assert.equal(activated.registry.lastKnownGood.manifestDigest, first.manifestDigest);
  assert.deepEqual(activated.stagedResidue, []);
  for (const injection of ["AFTER_VALIDATE", "AFTER_STAGE"] as const) {
    const rolledBack = activateLocalFileCorpusEditionV1(initial, second, injection);
    assert.equal(rolledBack.outcome, "ROLLED_BACK");
    assert.equal(rolledBack.registry.accepted.manifestDigest, first.manifestDigest);
    assert.equal(rolledBack.registry.lastKnownGood.manifestDigest, first.manifestDigest);
    assert.deepEqual(rolledBack.stagedResidue, []);
  }
});

test("LKC-FILES-01 fails closed on disabled, digest drift, extras, path and edition-chain drift", () => {
  const first = readLocalFileCorpusEditionV1(fixtureRoot(1), profiles[1]);
  const undeclaredExistingFile = { ...profiles[1], files: [profiles[1].files[0]], conflicts: [] };
  const probes: Array<[unknown, RegExp]> = [
    [{ ...profiles[1], enabled: false }, /LOCAL_FILE_CORPUS_DISABLED/],
    [{ ...profiles[1], files: [{ ...profiles[1].files[0], expectedContentDigest: "f".repeat(64) }, profiles[1].files[1]] }, /CONTENT_DRIFT/],
    [undeclaredExistingFile, /CLOSED_MANIFEST_DENIED/],
    [{ ...profiles[1], files: [{ ...profiles[1].files[0], path: "../escape.md" }, profiles[1].files[1]] }, /PROFILE_DENIED/],
  ];
  for (const [profile, expected] of probes) {
    assert.throws(() => readLocalFileCorpusEditionV1(fixtureRoot(1), profile), expected);
  }
  const invalidSuccessor = { ...readLocalFileCorpusEditionV1(fixtureRoot(2), profiles[2]), priorEditionId: "edition:wrong" };
  const denied = activateLocalFileCorpusEditionV1({ accepted: first, lastKnownGood: first }, invalidSuccessor);
  assert.equal(denied.outcome, "ROLLED_BACK");
  assert.equal(denied.reason, "CANDIDATE_DENIED");
  assert.deepEqual(denied.stagedResidue, []);
});

test("LKC-FILES-01 fixture bytes are local synthetic text without credential or external-call material", () => {
  const combined = [1, 2].flatMap((edition) => ["operations.md", "policy.txt"].map((name) =>
    readFileSync(`${fixtureRoot(edition as 1 | 2)}/${name}`, "utf8"))).join("\n");
  assert.doesNotMatch(combined, /https?:\/\/|Authorization:|api[_-]?key|secret|token|\/home\/|credential/i);
});

test("LKC-FILES-01 persistent index binds Accepted and LKG to verified immutable chunks", () => {
  const accepted = readLocalFileCorpusEditionV1(fixtureRoot(2), profiles[2]);
  const lastKnownGood = readLocalFileCorpusEditionV1(fixtureRoot(1), profiles[1]);
  const index = buildLocalFileCorpusIndexV1(accepted, lastKnownGood);
  assert.equal(validateLocalFileCorpusIndexV1(index), true);
  assert.equal(index.activeEditionId, accepted.editionId);
  assert.equal(index.acceptedEditionId, accepted.editionId);
  assert.equal(index.lastKnownGoodEditionId, lastKnownGood.editionId);
  assert.ok(index.entries.length > 0);
  assert.ok(index.entries.every((entry) => entry.editionId === accepted.editionId));
  assert.equal(validateLocalFileCorpusIndexV1({ ...index, entries: [] }), false);
  assert.equal(validateLocalFileCorpusIndexV1({ ...index, lastKnownGoodEditionId: accepted.editionId }), false);
});
