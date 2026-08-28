import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import test from "node:test";
import Ajv2020 from "ajv/dist/2020.js";
import { canonicalJson } from "../packages/contracts/src/canonical-json.js";
import {
  MEDIAWIKI_MINI_DUMP_BOUNDARY_V1,
  MEDIAWIKI_MINI_DUMP_CANONICALIZER_VERSION_V1,
  MEDIAWIKI_MINI_DUMP_PARSER_VERSION_V1,
  importMediaWikiMiniDumpEditionV1,
  projectMediaWikiMiniDumpEditionV1,
  queryMediaWikiMiniDumpEditionV1,
  validateMediaWikiMiniDumpEditionV1,
  validateMediaWikiMiniDumpProfileV1,
  type MediaWikiMiniDumpEditionV1,
  type MediaWikiMiniDumpProfileV1,
} from "../packages/contracts/src/mediawiki-mini-dump.js";

const fixtureRoot = "tests/fixtures/mediawiki-mini-dump";
const manifest = JSON.parse(readFileSync(`${fixtureRoot}/manifest.json`, "utf8")) as {
  profiles: { positive: MediaWikiMiniDumpProfileV1; reordered: MediaWikiMiniDumpProfileV1 };
  files: Array<{ path: string; sha256: string; byteSize: number }>;
};
const positiveProfile = manifest.profiles.positive;
const reorderedProfile = manifest.profiles.reordered;
const sourceBytes = (name: string): Uint8Array => new Uint8Array(readFileSync(`${fixtureRoot}/${name}`));

function replaceSource(
  profile: MediaWikiMiniDumpProfileV1,
  mutate: (source: string) => string,
): { profile: MediaWikiMiniDumpProfileV1; bytes: Uint8Array } {
  const bytes = sourceBytes(profile.source.path);
  const source = new TextDecoder().decode(bytes);
  const mutated = new TextEncoder().encode(mutate(source));
  return {
    bytes: mutated,
    profile: {
      ...profile,
      source: {
        ...profile.source,
        expectedSourceDigest: cryptoSha256(mutated),
        byteSize: mutated.byteLength,
      },
    },
  };
}

function cryptoSha256(value: Uint8Array): string {
  return createHash("sha256").update(value).digest("hex");
}

function assertImmutable(value: unknown): void {
  assert.equal(Object.isFrozen(value), true);
  if (value !== null && typeof value === "object") {
    for (const nested of Object.values(value)) assertImmutable(nested);
  }
}

test("PSAI107 positive synthetic fixture has a schema-valid immutable canonical edition", () => {
  const schema = JSON.parse(readFileSync("schemas/contracts/mediawiki-mini-dump-edition-v1.schema.json", "utf8"));
  const validateSchema = new Ajv2020({ allErrors: true, strict: true }).compile(schema);
  assert.equal(validateMediaWikiMiniDumpProfileV1(positiveProfile), true);
  const edition = importMediaWikiMiniDumpEditionV1(fixtureRoot, positiveProfile);

  assert.equal(validateMediaWikiMiniDumpEditionV1(edition), true);
  assert.equal(validateSchema(edition), true, JSON.stringify(validateSchema.errors));
  assert.equal(edition.pages.length, 6);
  assert.deepEqual(edition.pages.map((page) => page.title), [
    "Alpha Article",
    "Beta Article",
    "Delta Article",
    "Epsilon Article",
    "Gamma Article",
    "Zeta Article",
  ]);
  assert.equal(edition.project, "wikipedia:synthetic");
  assert.equal(edition.contentDigest, "83555e2c995aea05d52cdc482dc85e51e145db768159a756aea82fdc62abe3ff");
  assert.equal(edition.editionDigest, "53cf9a6e0b610f549b2268b61b51c0c6221d384e73e6635e40c154cd8ceb6e72");
  assert.equal(edition.language, "en");
  assert.equal(edition.dump.kind, "CURRENT_PAGES_MINI_DUMP");
  assert.equal(edition.dump.sourceUrl, "https://dumps.wikimedia.org/other/20260827/synthetic-mini.xml");
  assert.equal(edition.dump.snapshotDate, "2026-08-27");
  assert.equal(edition.rawTransport.sourceChecksum, positiveProfile.source.expectedSourceDigest);
  assert.equal(edition.rawTransport.byteSize, positiveProfile.source.byteSize);
  assert.equal(edition.provenance.parserVersion, MEDIAWIKI_MINI_DUMP_PARSER_VERSION_V1);
  assert.equal(edition.provenance.canonicalizerVersion, MEDIAWIKI_MINI_DUMP_CANONICALIZER_VERSION_V1);
  assert.deepEqual(edition.provenance.imageDigests, []);
  assert.equal(edition.license.licence, "CC0-1.0");
  assert.match(edition.license.attributionTemplate, /synthetic fixture/i);
  assert.equal(edition.authorityBoundary, MEDIAWIKI_MINI_DUMP_BOUNDARY_V1);

  const alpha = edition.pages[0];
  assert.ok(alpha);
  assert.equal(alpha.namespace, 0);
  assert.equal(alpha.canonicalTitle, "Alpha_Article");
  assert.equal(alpha.canonicalUrl, "https://synthetic.example.invalid/wiki/Alpha_Article");
  assert.equal(alpha.pageId, 1001);
  assert.equal(alpha.revisionId, 2001);
  assert.equal(alpha.snapshotDate, "2026-08-27");
  assert.equal(alpha.project, "wikipedia:synthetic");
  assert.equal(alpha.licence, "CC0-1.0");
  assert.equal(alpha.text, "Alpha is the first synthetic article.\nIt has two lines.");
  assert.equal(alpha.chunks[0]?.text, "Alpha is the first synthetic article.");
  assert.equal(alpha.chunks[1]?.citation, "Alpha_Article#L2");
  assert.match(alpha.contentDigest, /^[a-f0-9]{64}$/);
  assert.match(edition.editionDigest, /^[a-f0-9]{64}$/);
  assertImmutable(edition);
});

test("PSAI107 identical bytes and semantic page reordering share canonical content and edition digests", () => {
  const first = importMediaWikiMiniDumpEditionV1(fixtureRoot, positiveProfile);
  const replay = projectMediaWikiMiniDumpEditionV1(positiveProfile, sourceBytes("positive-mini.xml"));
  const reordered = importMediaWikiMiniDumpEditionV1(fixtureRoot, reorderedProfile);

  assert.equal(first.editionDigest, replay.editionDigest);
  assert.equal(first.contentDigest, replay.contentDigest);
  assert.equal(first.editionDigest, reordered.editionDigest);
  assert.equal(first.contentDigest, reordered.contentDigest);
  assert.deepEqual(first.pages, reordered.pages);
  assert.notEqual(first.rawTransport.sourceChecksum, reordered.rawTransport.sourceChecksum);
  assert.notEqual(canonicalJson(first.rawTransport), canonicalJson(reordered.rawTransport));
});

test("PSAI107 query results carry complete passage and parent provenance", () => {
  const edition = importMediaWikiMiniDumpEditionV1(fixtureRoot, positiveProfile);
  const results = queryMediaWikiMiniDumpEditionV1(edition);
  assert.equal(results.length, 12);
  for (const result of results) {
    assert.ok(result.exactPassage.length > 0);
    assert.equal(result.project, "wikipedia:synthetic");
    assert.ok(result.pageId > 0);
    assert.ok(result.revisionId > 0);
    assert.match(result.canonicalUrl, /^https:\/\//);
    assert.equal(result.snapshotDate, "2026-08-27");
    assert.equal(result.license.licence, "CC0-1.0");
    assert.equal(result.contentDigest.length, 64);
    assert.equal(result.editionDigest, edition.editionDigest);
  }
  assertImmutable(results);
});

test("PSAI107 local import is offline and does not call a network client", () => {
  const originalFetch = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = (async () => {
    calls += 1;
    throw new Error("NETWORK_CALL_FORBIDDEN");
  }) as typeof globalThis.fetch;
  try {
    const edition = importMediaWikiMiniDumpEditionV1(fixtureRoot, positiveProfile);
    assert.equal(edition.pages.length, 6);
    assert.equal(calls, 0);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("PSAI107 fail-closed negative matrix denies unsafe, unsupported and drifted input", () => {
  const matrix = JSON.parse(readFileSync(`${fixtureRoot}/negative-matrix.json`, "utf8")) as Array<{
    caseId: string;
    expected: string;
  }>;
  assert.equal(matrix.length, 17);
  const cases: Array<[string, () => void]> = [
    ["doctype", () => {
      const mutated = replaceSource(positiveProfile, (source) => `<!DOCTYPE mediawiki [<!ENTITY x SYSTEM \"https://invalid/secret\">]>\n${source}`);
      assert.throws(() => projectMediaWikiMiniDumpEditionV1(mutated.profile, mutated.bytes), /UNSAFE_XML/);
    }],
    ["external-entity", () => {
      const mutated = replaceSource(positiveProfile, (source) => source.replace("Alpha is", "&secret; is"));
      assert.throws(() => projectMediaWikiMiniDumpEditionV1(mutated.profile, mutated.bytes), /UNSAFE_XML/);
    }],
    ["media", () => {
      const mutated = replaceSource(positiveProfile, (source) => source.replace("<ns>0</ns>", "<ns>6</ns>"));
      assert.throws(() => projectMediaWikiMiniDumpEditionV1(mutated.profile, mutated.bytes), /MEDIA_DENIED/);
    }],
    ["namespace", () => {
      const mutated = replaceSource(positiveProfile, (source) => source.replace("<ns>0</ns>", "<ns>1</ns>"));
      assert.throws(() => projectMediaWikiMiniDumpEditionV1(mutated.profile, mutated.bytes), /NAMESPACE_DENIED/);
    }],
    ["duplicate-identity", () => {
      const mutated = replaceSource(positiveProfile, (source) => source.replace("<id>1002</id>", "<id>1001</id>"));
      assert.throws(() => projectMediaWikiMiniDumpEditionV1(mutated.profile, mutated.bytes), /PAGE_IDENTITY_DENIED/);
    }],
    ["missing-identity", () => {
      const mutated = replaceSource(positiveProfile, (source) => source.replace("    <id>1002</id>\n", ""));
      assert.throws(() => projectMediaWikiMiniDumpEditionV1(mutated.profile, mutated.bytes), /PAGE_IDENTITY_DENIED/);
    }],
    ["unsupported-revision", () => {
      const mutated = replaceSource(positiveProfile, (source) => source.replace("<model>wikitext</model>", "<model>json</model>"));
      assert.throws(() => projectMediaWikiMiniDumpEditionV1(mutated.profile, mutated.bytes), /REVISION_SHAPE_DENIED/);
    }],
    ["oversized-text", () => {
      const mutated = replaceSource(positiveProfile, (source) => source.replace("Alpha is the first synthetic article.", "A".repeat(262_145)));
      assert.throws(() => projectMediaWikiMiniDumpEditionV1(mutated.profile, mutated.bytes), /REVISION_SIZE_DENIED/);
    }],
    ["deep-text", () => {
      const mutated = replaceSource(positiveProfile, (source) => source.replace("<text bytes=", `${"<nested>".repeat(40)}<text bytes=`).replace("It has two lines.</text>", `It has two lines.</text>${"</nested>".repeat(40)}`));
      assert.throws(() => projectMediaWikiMiniDumpEditionV1(mutated.profile, mutated.bytes), /PARSE_DEPTH_DENIED|STRUCTURE_DENIED/);
    }],
    ["malformed-xml", () => {
      const mutated = replaceSource(positiveProfile, (source) => source.replace("</revision>", ""));
      assert.throws(() => projectMediaWikiMiniDumpEditionV1(mutated.profile, mutated.bytes), /MALFORMED_DENIED/);
    }],
    ["malformed-attribute-separator", () => {
      const mutated = replaceSource(positiveProfile, (source) => source.replace('" version="0.11"', '"version="0.11"'));
      assert.throws(
        () => projectMediaWikiMiniDumpEditionV1(mutated.profile, mutated.bytes),
        /MALFORMED_DENIED/,
      );
    }],
    ["missing-siteinfo", () => {
      const mutated = replaceSource(positiveProfile, (source) => source.replace(/  <siteinfo>[\s\S]*?  <\/siteinfo>\n/, ""));
      assert.throws(() => projectMediaWikiMiniDumpEditionV1(mutated.profile, mutated.bytes), /STRUCTURE_DENIED/);
    }],
    ["missing-license-attribution", () => {
      assert.throws(() => projectMediaWikiMiniDumpEditionV1({ ...positiveProfile, license: { ...positiveProfile.license, attributionTemplate: "" } }, sourceBytes("positive-mini.xml")), /LICENSE_DENIED/);
    }],
    ["missing-license", () => {
      assert.throws(() => projectMediaWikiMiniDumpEditionV1({ ...positiveProfile, license: { ...positiveProfile.license, licence: "" } }, sourceBytes("positive-mini.xml")), /LICENSE_DENIED/);
    }],
    ["digest-drift", () => {
      assert.throws(() => projectMediaWikiMiniDumpEditionV1({ ...positiveProfile, source: { ...positiveProfile.source, expectedSourceDigest: "0".repeat(64) } }, sourceBytes("positive-mini.xml")), /DIGEST_DRIFT_DENIED/);
    }],
    ["mixed-edition", () => {
      const mutated = replaceSource(positiveProfile, (source) => source.replace('xml:lang="en"', 'xml:lang="fr"'));
      assert.throws(() => projectMediaWikiMiniDumpEditionV1(mutated.profile, mutated.bytes), /MIXED_EDITION_DENIED/);
    }],
    ["disabled-profile", () => {
      assert.throws(() => projectMediaWikiMiniDumpEditionV1({ ...positiveProfile, enabled: false }, sourceBytes("positive-mini.xml")), /DISABLED/);
    }],
  ];
  for (const [caseId, probe] of cases) {
    assert.ok(matrix.some((item) => item.caseId === caseId), `matrix missing ${caseId}`);
    probe();
  }
});

test("PSAI107 profile and edition validators reject missing attribution and extra fields", () => {
  assert.equal(validateMediaWikiMiniDumpProfileV1({ ...positiveProfile, extra: true }), false);
  const edition = importMediaWikiMiniDumpEditionV1(fixtureRoot, positiveProfile);
  assert.equal(validateMediaWikiMiniDumpEditionV1({ ...edition, extra: true }), false);
  assert.equal(validateMediaWikiMiniDumpEditionV1({ ...edition, license: { ...edition.license, attributionTemplate: "" } }), false);
  assert.equal(validateMediaWikiMiniDumpEditionV1({ ...edition, editionDigest: "0".repeat(64) }), false);
  assert.equal(validateMediaWikiMiniDumpEditionV1({
    ...edition,
    pages: [...edition.pages, edition.pages[0]],
  }), false);
  const firstPage = edition.pages[0];
  assert.ok(firstPage);
  assert.equal(validateMediaWikiMiniDumpEditionV1({
    ...edition,
    pages: [{ ...firstPage, canonicalUrl: `${edition.site.base}/tampered` }, ...edition.pages.slice(1)],
  }), false);
});
