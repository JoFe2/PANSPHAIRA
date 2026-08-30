import {
  readMediaWikiEditionLifecycleV1,
  type MediaWikiEditionLifecycleReadV1,
} from "../../contracts/src/mediawiki-edition-lifecycle.js";
import {
  importMediaWikiMiniDumpEditionV1,
  type MediaWikiMiniDumpEditionV1,
  type MediaWikiMiniDumpProfileV1,
} from "../../contracts/src/mediawiki-mini-dump.js";
import {
  MEDIAWIKI_READONLY_QUERY_BOUNDARY_V1,
  mediaWikiReadonlyQueryReceiptDigestV1,
  mediaWikiReadonlyQueryResultIdV1,
  validateMediaWikiReadonlyEditionSourceV1,
  validateMediaWikiReadonlyQueryCorpusV1,
  type MediaWikiReadonlyEditionSourceV1,
  type MediaWikiReadonlyQueryCorpusV1,
  type MediaWikiReadonlyQueryReceiptV1,
  type MediaWikiReadonlyQueryRequestV1,
  type MediaWikiReadonlyQueryResultV1,
} from "../../contracts/src/mediawiki-query-receipt.js";
import type { EpistemicStatusV1 } from "../../contracts/src/knowledge-envelope.js";

const QUERY_ERROR = "MEDIAWIKI_READONLY_QUERY_DENIED";
const TOKEN = /[a-z0-9]+/g;

function deepFreeze<T>(value: T): T {
  if (value !== null && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const child of Object.values(value)) deepFreeze(child);
  }
  return value;
}

function exactKeys(value: unknown, keys: readonly string[]): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    && Object.getPrototypeOf(value) === Object.prototype
    && JSON.stringify(Object.keys(value).sort()) === JSON.stringify([...keys].sort());
}

function tokens(value: string): string[] {
  return [...new Set(value.toLowerCase().match(TOKEN) ?? [])].filter((item) => item.length >= 2).sort();
}

function assertRequest(value: unknown): asserts value is MediaWikiReadonlyQueryRequestV1 {
  if (!exactKeys(value, ["query", "ranking", "maxResults"])
    || typeof value.query !== "string" || value.query.length < 2 || value.query.length > 160
    || !["EXACT_LEXICAL", "LOCAL_HYBRID"].includes(value.ranking as string)
    || typeof value.maxResults !== "number" || !Number.isSafeInteger(value.maxResults)
    || value.maxResults < 1 || value.maxResults > 100) throw new Error(QUERY_ERROR);
  const queryTokens = tokens(value.query);
  if (queryTokens.length < 1 || queryTokens.length > 32) throw new Error(QUERY_ERROR);
}

function assertCorpus(value: unknown): asserts value is MediaWikiReadonlyQueryCorpusV1 {
  if (!validateMediaWikiReadonlyQueryCorpusV1(value)) throw new Error(QUERY_ERROR);
}

function normalizeSource(source: MediaWikiReadonlyEditionSourceV1): MediaWikiReadonlyEditionSourceV1 {
  if (!validateMediaWikiReadonlyEditionSourceV1(source)) throw new Error(QUERY_ERROR);
  return deepFreeze({
    edition: source.edition,
    state: source.state,
    epistemicStatus: source.epistemicStatus,
    freshnessState: source.freshnessState,
  });
}

function source(
  edition: MediaWikiMiniDumpEditionV1,
  state: "ACTIVE" | "SELECTED" = "ACTIVE",
  epistemicStatus: EpistemicStatusV1 = "SUPPORTED",
  freshnessState: "CURRENT" | "HISTORICAL" = state === "ACTIVE" ? "CURRENT" : "HISTORICAL",
): MediaWikiReadonlyEditionSourceV1 {
  return normalizeSource({ edition, state, epistemicStatus, freshnessState });
}

export function activeMediaWikiReadonlyEditionV1(
  edition: MediaWikiMiniDumpEditionV1,
  epistemicStatus: EpistemicStatusV1 = "SUPPORTED",
): MediaWikiReadonlyEditionSourceV1 {
  return source(edition, "ACTIVE", epistemicStatus, "CURRENT");
}

export function selectedMediaWikiReadonlyEditionV1(
  edition: MediaWikiMiniDumpEditionV1,
  epistemicStatus: EpistemicStatusV1 = "SUPPORTED",
): MediaWikiReadonlyEditionSourceV1 {
  return source(edition, "SELECTED", epistemicStatus, "HISTORICAL");
}

export function mediaWikiReadonlyQueryCorpusV1(
  active: MediaWikiReadonlyEditionSourceV1,
  selected: readonly MediaWikiReadonlyEditionSourceV1[] = [],
): MediaWikiReadonlyQueryCorpusV1 {
  const corpus = deepFreeze({ active: normalizeSource(active), selected: selected.map(normalizeSource) });
  assertCorpus(corpus);
  return corpus;
}

function lexicalScore(text: string, queryTokens: readonly string[]): { score: number; matched: string[] } {
  const words: string[] = text.toLowerCase().match(TOKEN) ?? [];
  const matched = queryTokens.filter((token) => words.includes(token));
  return { score: matched.length, matched };
}

function resultFor(
  sourceEntry: MediaWikiReadonlyEditionSourceV1,
  page: MediaWikiMiniDumpEditionV1["pages"][number],
  chunk: MediaWikiMiniDumpEditionV1["pages"][number]["chunks"][number],
  request: MediaWikiReadonlyQueryRequestV1,
  queryTokens: readonly string[],
): MediaWikiReadonlyQueryResultV1 | null {
  const lexical = lexicalScore(chunk.text, queryTokens);
  const title = lexicalScore(page.title, queryTokens);
  const normalizedQuery = request.query.toLowerCase().trim().replace(/\s+/g, " ");
  const exactPhrase = chunk.text.toLowerCase().includes(normalizedQuery);
  // A title match can affect hybrid ordering, but it is not evidence that the
  // chunk itself answers the query. Never expose a title-only ranking hit as a
  // retrieved passage.
  if (lexical.score === 0 && !exactPhrase) return null;
  const score = request.ranking === "EXACT_LEXICAL"
    ? lexical.score + (exactPhrase ? queryTokens.length : 0)
    : lexical.score * 10 + title.score * 2 + (exactPhrase ? 5 : 0);
  if (score <= 0) return null;
  const resultId = mediaWikiReadonlyQueryResultIdV1(sourceEntry.edition.editionDigest, chunk.citationId);
  return {
    resultId,
    editionId: sourceEntry.edition.editionId,
    editionState: sourceEntry.state as "ACTIVE" | "SELECTED",
    citationId: chunk.citationId,
    citation: chunk.citation,
    exactPassage: chunk.text,
    project: sourceEntry.edition.project,
    language: sourceEntry.edition.language,
    pageId: page.pageId,
    revisionId: page.revisionId,
    title: page.title,
    canonicalUrl: page.canonicalUrl,
    snapshotDate: sourceEntry.edition.dump.snapshotDate,
    license: { ...sourceEntry.edition.license },
    contentDigest: page.contentDigest,
    editionDigest: sourceEntry.edition.editionDigest,
    chunkDigest: chunk.chunkDigest,
    score,
    ranking: {
      strategy: request.ranking,
      lexicalScore: lexical.score,
      titleScore: title.score,
      exactPhrase,
      matchedTokens: [...new Set([...lexical.matched, ...title.matched])].sort(),
    },
    sourceEpistemicStatus: sourceEntry.epistemicStatus,
    epistemicStatus: sourceEntry.epistemicStatus,
    freshness: {
      state: sourceEntry.freshnessState,
      snapshotDate: sourceEntry.edition.dump.snapshotDate,
      revisionTimestamp: page.timestamp,
    },
    conflictsWith: [],
  };
}

function contradictionGroups(results: readonly MediaWikiReadonlyQueryResultV1[]): string[][] {
  const groups = new Map<string, MediaWikiReadonlyQueryResultV1[]>();
  for (const result of results) {
    const line = /#L[1-9][0-9]*$/.exec(result.citation)?.[0] ?? result.citation;
    const key = `${result.project}:${result.pageId}:${result.canonicalUrl}:${line}`;
    groups.set(key, [...(groups.get(key) ?? []), result]);
  }
  return [...groups.values()]
    .filter((group) => group.length > 1 && new Set(group.map((item) => item.exactPassage)).size > 1)
    .map((group) => group.map((item) => item.resultId).sort());
}

function completeContradictions(
  results: readonly MediaWikiReadonlyQueryResultV1[],
): { results: MediaWikiReadonlyQueryResultV1[]; contradictions: { claimIds: string[]; kind: "CONTRADICTION" }[] } {
  const groups = contradictionGroups(results);
  const byId = new Map(groups.flatMap((group) => group.map((id) => [id, group] as const)));
  const completed = results.map((result) => {
    const conflict = byId.get(result.resultId) ?? [];
    return {
      ...result,
      epistemicStatus: conflict.length > 0 ? "DISPUTED" : result.sourceEpistemicStatus,
      conflictsWith: conflict.filter((id) => id !== result.resultId).sort(),
    };
  });
  return { results: completed, contradictions: groups.map((claimIds) => ({ claimIds, kind: "CONTRADICTION" as const })) };
}

export function queryMediaWikiReadonlyV1(
  corpus: MediaWikiReadonlyQueryCorpusV1,
  request: MediaWikiReadonlyQueryRequestV1,
): MediaWikiReadonlyQueryReceiptV1 {
  assertCorpus(corpus);
  assertRequest(request);
  const queryTokens = tokens(request.query);
  const sources = [corpus.active, ...corpus.selected];
  const rawResults = sources.flatMap((sourceEntry) => sourceEntry.edition.pages.flatMap((page) =>
    page.chunks.flatMap((chunk) => {
      const result = resultFor(sourceEntry, page, chunk, request, queryTokens);
      return result === null ? [] : [result];
    }),
  )).sort((left, right) => right.score - left.score
    || left.project.localeCompare(right.project)
    || left.pageId - right.pageId
    || left.revisionId - right.revisionId
    || left.editionDigest.localeCompare(right.editionDigest)
    || left.citation.localeCompare(right.citation));
  const rankedResultIds = new Set(rawResults.slice(0, request.maxResults).map((result) => result.resultId));
  const disclosedResultIds = new Set(rankedResultIds);
  for (const group of contradictionGroups(rawResults)) {
    if (group.some((resultId) => rankedResultIds.has(resultId))) {
      for (const resultId of group) disclosedResultIds.add(resultId);
    }
  }
  const completed = completeContradictions(rawResults.filter((result) => disclosedResultIds.has(result.resultId)));
  const unsigned: Omit<MediaWikiReadonlyQueryReceiptV1, "receiptDigest"> = {
    schemaVersion: "chimpmaera.knowledge/mediawiki-readonly-query-receipt/v1",
    operation: "READ_ONLY_QUERY",
    network: "DISABLED",
    model: "DISABLED",
    query: request.query,
    normalizedQuery: queryTokens.join(" "),
    queryTokens,
    ranking: request.ranking,
    maxResults: request.maxResults,
    activeEditionDigest: corpus.active.edition.editionDigest,
    selectedEditionDigests: corpus.selected.map((item) => item.edition.editionDigest),
    contradictions: completed.contradictions,
    results: completed.results,
    authority: {
      credentials: [],
      policyApprovals: [],
      capabilities: [],
      toolAccess: [],
      writeTargets: [],
      executionRoutes: [],
    },
    authorityBoundary: MEDIAWIKI_READONLY_QUERY_BOUNDARY_V1,
  };
  return deepFreeze({ ...unsigned, receiptDigest: mediaWikiReadonlyQueryReceiptDigestV1(unsigned) });
}

export class MediaWikiReadonlyQueryAdapterV1 {
  readonly corpus: MediaWikiReadonlyQueryCorpusV1;

  constructor(corpus: MediaWikiReadonlyQueryCorpusV1) {
    this.corpus = mediaWikiReadonlyQueryCorpusV1(corpus.active, corpus.selected);
    Object.freeze(this);
  }

  query(request: MediaWikiReadonlyQueryRequestV1): MediaWikiReadonlyQueryReceiptV1 {
    return queryMediaWikiReadonlyV1(this.corpus, request);
  }
}

export function createMediaWikiReadonlyQueryAdapterV1(
  corpus: MediaWikiReadonlyQueryCorpusV1,
): MediaWikiReadonlyQueryAdapterV1 {
  return new MediaWikiReadonlyQueryAdapterV1(corpus);
}

export function queryMediaWikiReadonlyFromLifecycleV1(
  lifecycle: MediaWikiEditionLifecycleReadV1,
  request: MediaWikiReadonlyQueryRequestV1,
): MediaWikiReadonlyQueryReceiptV1 {
  if (lifecycle.index.activeEditionDigest !== lifecycle.manifest.edition.editionDigest) throw new Error(QUERY_ERROR);
  const corpus = mediaWikiReadonlyQueryCorpusV1(activeMediaWikiReadonlyEditionV1(lifecycle.manifest.edition));
  return queryMediaWikiReadonlyV1(corpus, request);
}

export function queryMediaWikiReadonlyLifecycleRootV1(
  root: string,
  request: MediaWikiReadonlyQueryRequestV1,
): MediaWikiReadonlyQueryReceiptV1 {
  return queryMediaWikiReadonlyFromLifecycleV1(readMediaWikiEditionLifecycleV1(root), request);
}

export function queryMediaWikiMountedDumpV1(
  root: string,
  profile: MediaWikiMiniDumpProfileV1,
  request: MediaWikiReadonlyQueryRequestV1,
): MediaWikiReadonlyQueryReceiptV1 {
  return queryMediaWikiReadonlyV1(
    mediaWikiReadonlyQueryCorpusV1(activeMediaWikiReadonlyEditionV1(importMediaWikiMiniDumpEditionV1(root, profile))),
    request,
  );
}

export const queryMediaWikiReadonlyMountedDumpV1 = queryMediaWikiMountedDumpV1;
