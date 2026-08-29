import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync, unlinkSync, writeFileSync } from "node:fs";
import test from "node:test";
import Ajv2020 from "ajv/dist/2020.js";
import { canonicalJson } from "../packages/contracts/src/canonical-json.js";
import {
  activateMediaWikiXmlLocalEditionV1,
  importMediaWikiXmlLocalV1,
  MEDIAWIKI_XML_LOCAL_BOUNDARY_V1,
  projectMediaWikiXmlLocalV1,
  queryMediaWikiXmlLocalV1,
  selectMediaWikiXmlLocalKnowledgeV1,
  validateMediaWikiXmlLocalProfileV1,
  type MediaWikiXmlLocalProfileV1,
} from "../packages/contracts/src/mediawiki-xml-local-adapter.js";
import { validateLocalFileCorpusEditionV1 } from "../packages/contracts/src/local-file-knowledge-corpus.js";
import { validateKnowledgeEnvelopeV1 } from "../packages/contracts/src/knowledge-envelope.js";
import type { KnowledgeTaxonomyV1 } from "../packages/contracts/src/knowledge-envelope.js";

const root = "tests/fixtures/mediawiki-xml";
const profile = JSON.parse(readFileSync(`${root}/current-pages-profile.synthetic-v1.json`, "utf8")) as MediaWikiXmlLocalProfileV1;
const taxonomyFixture = JSON.parse(readFileSync("tests/fixtures/knowledge-envelope/taxonomy-generations-v1.json", "utf8")) as { activeTaxonomy: KnowledgeTaxonomyV1 };
const taxonomy = taxonomyFixture.activeTaxonomy;
const source = new Uint8Array(readFileSync(`${root}/${profile.source.path}`));
const sha256 = (value: Uint8Array): string => createHash("sha256").update(value).digest("hex");

function assertDenied(action: () => unknown, code: string): void {
  assert.throws(action, (error: unknown) => error instanceof Error && error.message === code);
}

function candidateProfile(overrides: Partial<MediaWikiXmlLocalProfileV1["corpus"]>): MediaWikiXmlLocalProfileV1 {
  return { ...profile, corpus: { ...profile.corpus, ...overrides } };
}

test("PSAI107 official pilot adapter binds source manifest, digest, licence, and taxonomy", () => {
  assert.equal(validateMediaWikiXmlLocalProfileV1(profile), true);
  const schema = JSON.parse(readFileSync("schemas/contracts/mediawiki-xml-local-profile-v1.schema.json", "utf8"));
  const validateSchema = new Ajv2020({ allErrors: true, strict: true }).compile(schema);
  assert.equal(validateSchema(profile), true, JSON.stringify(validateSchema.errors));
  const first = importMediaWikiXmlLocalV1(root, profile, taxonomy);
  const second = importMediaWikiXmlLocalV1(root, profile, taxonomy);
  assert.equal(canonicalJson(first), canonicalJson(second));
  assert.equal(first.source.sourceDigest, profile.source.expectedSourceDigest);
  assert.equal(first.source.byteSize, profile.source.byteSize);
  assert.equal(first.miniDumpEdition.rawTransport.sourceChecksum, profile.source.expectedSourceDigest);
  assert.equal(first.miniDumpEdition.dump.sourceUrl, profile.pilot.sourceUrl);
  assert.equal(first.miniDumpEdition.dump.snapshotDate, profile.pilot.snapshotDate);
  assert.equal(first.edition.files.length, first.miniDumpEdition.pages.length);
  assert.equal(first.edition.files[0]?.licence, profile.license.licence);
  assert.equal(first.envelopes.length, first.edition.files.length);
  assert.equal(first.envelopes.every((envelope) => validateKnowledgeEnvelopeV1(envelope, taxonomy).length === 0), true);
  assert.equal(validateLocalFileCorpusEditionV1(first.edition), true);
  assert.equal(first.edition.authorityBoundary.includes("NO_NETWORK"), true);
  assert.equal(first.profile.authorityBoundary, MEDIAWIKI_XML_LOCAL_BOUNDARY_V1);
});

test("PSAI107 exact local readback is deterministic and lifecycle-bound", () => {
  const projection = importMediaWikiXmlLocalV1(root, profile, taxonomy);
  const query = queryMediaWikiXmlLocalV1(projection, "synthetic content");
  assert.equal(query.results.length, 2);
  const receipt = query.results.find((result) => result.text.includes("Alpha"));
  assert.ok(receipt);
  assert.equal(receipt.citation, "page-1001.txt#L1");
  assert.equal(receipt.text, "Alpha pilot content is synthetic.");

  const selection = selectMediaWikiXmlLocalKnowledgeV1(projection, taxonomy, profile.corpus.observedAtMs);
  assert.equal(selection.selected.length, projection.envelopes.length);
  assert.equal(selection.rejected.length, 0);

  const current = { accepted: projection.edition, lastKnownGood: projection.edition };
  const successorProjection = projectMediaWikiXmlLocalV1(
    candidateProfile({ editionId: "mediawiki-xml:pilot-edition-v2", priorEditionId: projection.edition.editionId }),
    source,
    taxonomy,
  );
  const activated = activateMediaWikiXmlLocalEditionV1(current, successorProjection);
  assert.equal(activated.outcome, "ACTIVATED");
  assert.equal(activated.registry.accepted.editionId, "mediawiki-xml:pilot-edition-v2");
  assert.equal(activated.registry.lastKnownGood.editionId, projection.edition.editionId);
  assert.deepEqual(activated.stagedResidue, []);

  const unbound = projectMediaWikiXmlLocalV1(
    candidateProfile({ editionId: "mediawiki-xml:pilot-edition-v3", priorEditionId: null }),
    source,
    taxonomy,
  );
  const denied = activateMediaWikiXmlLocalEditionV1(current, unbound);
  assert.equal(denied.outcome, "ROLLED_BACK");
  assert.equal(denied.reason, "CANDIDATE_DENIED");
  assert.equal(denied.registry.accepted.editionId, projection.edition.editionId);
});

test("PSAI107 negative matrix fails closed without network fallback", () => {
  assertDenied(() => importMediaWikiXmlLocalV1(root, { ...profile, syntheticOnly: false } as unknown, taxonomy), "MEDIAWIKI_XML_LOCAL_PROFILE_DENIED");
  assertDenied(() => importMediaWikiXmlLocalV1(root, profile, { ...taxonomy, taxonomyDigest: "0".repeat(64) }), "MEDIAWIKI_XML_LOCAL_TAXONOMY_DENIED");
  const mismatch = new Uint8Array(source);
  mismatch[0] = mismatch[0] === 60 ? 61 : 60;
  assertDenied(() => projectMediaWikiXmlLocalV1(profile, mismatch, taxonomy), "MEDIAWIKI_XML_LOCAL_DIGEST_DRIFT_DENIED");
  assertDenied(() => importMediaWikiXmlLocalV1("tests/fixtures/mediawiki-xml/missing", profile, taxonomy), "MEDIAWIKI_XML_LOCAL_ROOT_DENIED");
  const extra = `${root}/extra-denied.json`;
  writeFileSync(extra, "{}");
  try {
    assertDenied(() => importMediaWikiXmlLocalV1(root, profile, taxonomy), "MEDIAWIKI_XML_LOCAL_CLOSED_MANIFEST_DENIED");
  } finally {
    // The fixture mutation is part of the test only and is removed before the test returns.
    unlinkSync(extra);
  }
  const ambiguous = { ...profile, license: { ...profile.license, licence: "" } } as unknown;
  assertDenied(() => projectMediaWikiXmlLocalV1(ambiguous, source, taxonomy), "MEDIAWIKI_XML_LOCAL_PROFILE_DENIED");
});
