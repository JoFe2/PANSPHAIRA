import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, rmSync } from "node:fs";
import test from "node:test";
import {
  MEDIAWIKI_READONLY_QUERY_BOUNDARY_V1,
  mediaWikiReadonlyQueryReceiptDigestV1,
  validateMediaWikiReadonlyQueryReceiptAgainstCorpusV1,
  validateMediaWikiReadonlyQueryReceiptV1,
  type MediaWikiReadonlyQueryCorpusV1,
  type MediaWikiReadonlyQueryReceiptV1,
} from "../packages/contracts/src/mediawiki-query-receipt.js";
import {
  activeMediaWikiReadonlyEditionV1,
  mediaWikiReadonlyQueryCorpusV1,
  queryMediaWikiMountedDumpV1,
  queryMediaWikiReadonlyLifecycleRootV1,
  queryMediaWikiReadonlyV1,
  selectedMediaWikiReadonlyEditionV1,
} from "../packages/local-knowledge/src/mediawiki-readonly-query.js";
import {
  importMediaWikiMiniDumpEditionV1,
  projectMediaWikiMiniDumpEditionV1,
  type MediaWikiMiniDumpEditionV1,
  type MediaWikiMiniDumpProfileV1,
} from "../packages/contracts/src/mediawiki-mini-dump.js";
import {
  activateMediaWikiEditionV1,
  initializeMediaWikiEditionLifecycleV1,
} from "../packages/contracts/src/mediawiki-edition-lifecycle.js";

const fixtureRoot = "tests/fixtures/mediawiki-mini-dump";
const fixtureManifest = JSON.parse(readFileSync(`${fixtureRoot}/manifest.json`, "utf8")) as {
  profiles: { positive: MediaWikiMiniDumpProfileV1 };
};
const profile = fixtureManifest.profiles.positive;
const sourceBytes = new Uint8Array(readFileSync(`${fixtureRoot}/${profile.source.path}`));

function sha256(value: Uint8Array): string {
  return createHash("sha256").update(value).digest("hex");
}

function changedEdition(): MediaWikiMiniDumpEditionV1 {
  const source = new TextDecoder().decode(sourceBytes).replace(
    "Alpha is the first synthetic article.",
    "Alpha is the FIRST synthetic article.",
  );
  const bytes = new TextEncoder().encode(source);
  return projectMediaWikiMiniDumpEditionV1({
    ...profile,
    source: { ...profile.source, expectedSourceDigest: sha256(bytes), byteSize: bytes.byteLength },
  }, bytes);
}

function corpusWithConflict(): MediaWikiReadonlyQueryCorpusV1 {
  const active = importMediaWikiMiniDumpEditionV1(fixtureRoot, profile);
  return mediaWikiReadonlyQueryCorpusV1(
    activeMediaWikiReadonlyEditionV1(active),
    [selectedMediaWikiReadonlyEditionV1(changedEdition(), "UNVERIFIED")],
  );
}

function request(ranking: "EXACT_LEXICAL" | "LOCAL_HYBRID", query = "synthetic article") {
  return { query, ranking, maxResults: 20 } as const;
}

test("PSAI107 read-only query returns exact stored passages and complete citation receipts", () => {
  const edition = importMediaWikiMiniDumpEditionV1(fixtureRoot, profile);
  const corpus = mediaWikiReadonlyQueryCorpusV1(activeMediaWikiReadonlyEditionV1(edition));
  const lexical = queryMediaWikiReadonlyV1(corpus, request("EXACT_LEXICAL", "first synthetic article"));
  const hybrid = queryMediaWikiReadonlyV1(corpus, request("LOCAL_HYBRID", "first synthetic article"));
  assert.equal(validateMediaWikiReadonlyQueryReceiptV1(lexical), true);
  assert.equal(validateMediaWikiReadonlyQueryReceiptAgainstCorpusV1(lexical, corpus), true);
  assert.equal(lexical.receiptDigest, mediaWikiReadonlyQueryReceiptDigestV1(lexical));
  assert.equal(lexical.network, "DISABLED");
  assert.equal(lexical.model, "DISABLED");
  assert.equal(lexical.authorityBoundary, MEDIAWIKI_READONLY_QUERY_BOUNDARY_V1);
  assert.ok(lexical.results.length > 0);
  for (const result of lexical.results) {
    assert.equal(result.exactPassage, edition.pages.find((page) => page.pageId === result.pageId)?.chunks
      .find((chunk) => chunk.citationId === result.citationId)?.text);
    assert.equal(result.project, edition.project);
    assert.equal(result.pageId, edition.pages.find((page) => page.pageId === result.pageId)?.pageId);
    assert.equal(result.revisionId, edition.pages.find((page) => page.pageId === result.pageId)?.revisionId);
    assert.equal(result.citation, edition.pages.find((page) => page.pageId === result.pageId)?.chunks
      .find((chunk) => chunk.citationId === result.citationId)?.citation);
    assert.equal(result.canonicalUrl, edition.pages.find((page) => page.pageId === result.pageId)?.canonicalUrl);
    assert.equal(result.editionDigest, edition.editionDigest);
    assert.equal(result.contentDigest, edition.pages.find((page) => page.pageId === result.pageId)?.contentDigest);
    assert.equal(result.chunkDigest, edition.pages.find((page) => page.pageId === result.pageId)?.chunks
      .find((chunk) => chunk.citationId === result.citationId)?.chunkDigest);
    assert.equal(result.snapshotDate, edition.dump.snapshotDate);
    assert.deepEqual(result.license, edition.license);
    assert.equal(result.license.attributionTemplate, edition.license.attributionTemplate);
    assert.equal(result.freshness.snapshotDate, edition.dump.snapshotDate);
    assert.equal(result.freshness.revisionTimestamp, edition.pages.find((page) => page.pageId === result.pageId)?.timestamp);
    assert.match(result.canonicalUrl, /^https:\/\//);
    assert.ok(result.pageId > 0 && result.revisionId > 0);
  }
  assert.deepEqual(lexical.results.map((item) => item.exactPassage), hybrid.results.map((item) => item.exactPassage));
  assert.notDeepEqual(lexical.results.map((item) => item.score), hybrid.results.map((item) => item.score));
});

test("PSAI107 active lifecycle and mounted-dump query paths remain fully offline", () => {
  const edition = importMediaWikiMiniDumpEditionV1(fixtureRoot, profile);
  const lifecycleRoot = `/tmp/psai107-query-lifecycle-${process.pid}`;
  rmSync(lifecycleRoot, { recursive: true, force: true });
  mkdirSync(lifecycleRoot);
  try {
    initializeMediaWikiEditionLifecycleV1(lifecycleRoot, edition);
    const fromLifecycle = queryMediaWikiReadonlyLifecycleRootV1(lifecycleRoot, request("LOCAL_HYBRID"));
    const fromMount = queryMediaWikiMountedDumpV1(fixtureRoot, profile, request("LOCAL_HYBRID"));
    assert.ok(fromLifecycle.results.length > 0);
    assert.deepEqual(fromLifecycle.results.map((item) => item.exactPassage), fromMount.results.map((item) => item.exactPassage));
  } finally {
    rmSync(lifecycleRoot, { recursive: true, force: true });
  }
});

test("PSAI107 conflicting active and selected editions stay distinct and visibly disputed", () => {
  const corpus = corpusWithConflict();
  const receipt = queryMediaWikiReadonlyV1(corpus, request("LOCAL_HYBRID"));
  assert.equal(validateMediaWikiReadonlyQueryReceiptAgainstCorpusV1(receipt, corpus), true);
  assert.equal(receipt.selectedEditionDigests.length, 1);
  const alpha = receipt.results.filter((item) => item.pageId === 1001);
  assert.equal(alpha.length, 2);
  assert.notEqual(alpha[0]?.editionDigest, alpha[1]?.editionDigest);
  assert.notEqual(alpha[0]?.exactPassage, alpha[1]?.exactPassage);
  assert.ok(alpha.every((item) => item.epistemicStatus === "DISPUTED"));
  assert.ok(alpha.some((item) => item.sourceEpistemicStatus === "UNVERIFIED"));
  assert.equal(receipt.contradictions.length, 1);
  assert.equal(receipt.contradictions[0]?.claimIds.length, 2);
  assert.ok(alpha.every((item) => item.conflictsWith.length === 1));
});

test("PSAI107 receipt and source gates fail closed for mutation, collapse, stale state, authority and network paths", () => {
  const corpus = corpusWithConflict();
  const receipt = queryMediaWikiReadonlyV1(corpus, request("EXACT_LEXICAL", "synthetic article"));
  const missingCitation = structuredClone(receipt) as unknown as Record<string, unknown>;
  delete (missingCitation.results as Array<Record<string, unknown>>)[0]!.citation;
  assert.equal(validateMediaWikiReadonlyQueryReceiptV1(missingCitation), false);

  const mutated = structuredClone(receipt) as unknown as MediaWikiReadonlyQueryReceiptV1;
  (mutated.results as unknown as Array<Record<string, unknown>>)[0]!.exactPassage = "mutated after receipt";
  (mutated as any).receiptDigest = mediaWikiReadonlyQueryReceiptDigestV1(mutated);
  assert.equal(validateMediaWikiReadonlyQueryReceiptAgainstCorpusV1(mutated, corpus), false);

  const authority = structuredClone(receipt) as unknown as Record<string, unknown>;
  authority.executionAuthority = "EXECUTE";
  assert.equal(validateMediaWikiReadonlyQueryReceiptV1(authority), false);

  const stale = structuredClone(corpus.selected[0]!) as unknown as Record<string, unknown>;
  stale.state = "STALE";
  assert.throws(() => mediaWikiReadonlyQueryCorpusV1(corpus.active, [stale as never]), /READONLY_QUERY_DENIED/);

  const collapsed = receipt.results.filter((item) => item.editionDigest === corpus.active.edition.editionDigest);
  assert.equal(collapsed.length < receipt.results.length, true);
  assert.equal(new Set(receipt.results.map((item) => item.resultId)).size, receipt.results.length);

  assert.throws(() => queryMediaWikiReadonlyV1(corpus, {
    ...request("LOCAL_HYBRID"),
    networkFallback: true,
  } as never), /READONLY_QUERY_DENIED/);
  assert.throws(() => queryMediaWikiReadonlyV1(corpus, {
    ...request("LOCAL_HYBRID"),
    model: "embedding-v1",
  } as never), /READONLY_QUERY_DENIED/);
});

test("PSAI107 failed activation cannot expose a non-active edition through the lifecycle query", () => {
  const initial = importMediaWikiMiniDumpEditionV1(fixtureRoot, profile);
  const next = changedEdition();
  const lifecycleRoot = `/tmp/psai107-query-not-active-${process.pid}`;
  rmSync(lifecycleRoot, { recursive: true, force: true });
  mkdirSync(lifecycleRoot);
  try {
    initializeMediaWikiEditionLifecycleV1(lifecycleRoot, initial);
    const denied = activateMediaWikiEditionV1(lifecycleRoot, { edition: next, parentEditionDigest: "0".repeat(64) });
    assert.equal(denied.outcome, "DENIED");
    const receipt = queryMediaWikiReadonlyLifecycleRootV1(lifecycleRoot, request("EXACT_LEXICAL"));
    assert.equal(receipt.activeEditionDigest, initial.editionDigest);
    assert.ok(receipt.results.every((item) => item.editionDigest === initial.editionDigest));
  } finally {
    rmSync(lifecycleRoot, { recursive: true, force: true });
  }
});
