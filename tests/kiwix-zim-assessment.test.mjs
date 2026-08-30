import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, rmSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

import {
  activateMediaWikiEditionV1,
  initializeMediaWikiEditionLifecycleV1,
} from "../dist/packages/contracts/src/mediawiki-edition-lifecycle.js";
import {
  importMediaWikiMiniDumpEditionV1,
  projectMediaWikiMiniDumpEditionV1,
  validateMediaWikiMiniDumpEditionV1,
} from "../dist/packages/contracts/src/mediawiki-mini-dump.js";
import {
  mediaWikiReadonlyQueryReceiptDigestV1,
  validateMediaWikiReadonlyQueryReceiptAgainstCorpusV1,
  validateMediaWikiReadonlyQueryReceiptV1,
} from "../dist/packages/contracts/src/mediawiki-query-receipt.js";
import {
  activeMediaWikiReadonlyEditionV1,
  mediaWikiReadonlyQueryCorpusV1,
  queryMediaWikiReadonlyLifecycleRootV1,
  queryMediaWikiReadonlyV1,
  selectedMediaWikiReadonlyEditionV1,
} from "../dist/packages/local-knowledge/src/mediawiki-readonly-query.js";

const repoRoot = resolve(import.meta.dirname, "..");
const assessment = JSON.parse(readFileSync(resolve(repoRoot, "tests/fixtures/kiwix-zim-assessment/assessment-v1.json"), "utf8"));
const syntheticManifest = JSON.parse(readFileSync(resolve(repoRoot, "tests/fixtures/mediawiki-mini-dump/manifest.json"), "utf8"));
const pilotManifest = JSON.parse(readFileSync(resolve(repoRoot, "tests/fixtures/wikimedia-pilot/expected-measurement-schema.json"), "utf8"));
const syntheticProfile = syntheticManifest.profiles.positive;
const syntheticFixture = assessment.fixtures.syntheticMiniDump;
const officialFixture = assessment.fixtures.boundedOfficialPilot;

function sha256(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

function clone(value) {
  return structuredClone(value);
}

function assertImmutable(value) {
  assert.equal(Object.isFrozen(value), true);
  if (value !== null && typeof value === "object") {
    for (const nested of Object.values(value)) assertImmutable(nested);
  }
}

function officialProfile() {
  return {
    ...pilotManifest.synthetic.profile,
    project: officialFixture.project,
    source: {
      ...pilotManifest.synthetic.profile.source,
      path: officialFixture.sourcePath,
      expectedSourceDigest: officialFixture.checksum,
      byteSize: officialFixture.byteSize,
    },
    xmlFiles: [officialFixture.sourcePath],
    dump: {
      kind: "CURRENT_PAGES_MINI_DUMP",
      sourceUrl: officialFixture.sourceUrl,
      snapshotDate: officialFixture.snapshotDate,
    },
    license: officialFixture.license,
  };
}

function changedSyntheticEdition() {
  const sourcePath = resolve(repoRoot, `${syntheticFixture.root}/${syntheticFixture.sourcePath}`);
  const changed = new TextEncoder().encode(new TextDecoder().decode(readFileSync(sourcePath)).replace(
    "Alpha is the first synthetic article.",
    "Alpha is the FIRST synthetic article.",
  ));
  return projectMediaWikiMiniDumpEditionV1({
    ...syntheticProfile,
    source: {
      ...syntheticProfile.source,
      expectedSourceDigest: sha256(changed),
      byteSize: changed.byteLength,
    },
  }, changed);
}

function request() {
  return { query: "synthetic article", ranking: "LOCAL_HYBRID", maxResults: 20 };
}

function lifecycleReadback(edition) {
  const lifecycleRoot = resolve(repoRoot, `.kiwix-zim-assessment-runtime-${process.pid}`);
  rmSync(lifecycleRoot, { recursive: true, force: true });
  mkdirSync(lifecycleRoot);
  try {
    initializeMediaWikiEditionLifecycleV1(lifecycleRoot, edition);
    const receipt = queryMediaWikiReadonlyLifecycleRootV1(lifecycleRoot, request());
    assert.equal(receipt.activeEditionDigest, edition.editionDigest);
    assert.equal(validateMediaWikiReadonlyQueryReceiptV1(receipt), true);
    assert.equal(receipt.receiptDigest, mediaWikiReadonlyQueryReceiptDigestV1(receipt));
    return receipt;
  } finally {
    rmSync(lifecycleRoot, { recursive: true, force: true });
  }
}

function completeResult(result, edition) {
  assert.ok(result.exactPassage.length > 0);
  assert.equal(result.project, edition.project);
  assert.ok(result.pageId > 0);
  assert.ok(result.revisionId > 0);
  assert.match(result.canonicalUrl, /^https:\/\//);
  assert.equal(result.snapshotDate, edition.dump.snapshotDate);
  assert.ok(result.license.licence.length > 0);
  assert.ok(result.license.attributionTemplate.length > 0);
  assert.match(result.contentDigest, /^[a-f0-9]{64}$/);
  assert.equal(result.editionDigest, edition.editionDigest);
}

function compatibleCandidate(edition, receipt) {
  return {
    format: "ZIM",
    inputOnly: true,
    provenance: {
      sourcePinVerifiable: true,
      sourceUrl: edition.dump.sourceUrl,
      sourceDigest: edition.rawTransport.sourceChecksum,
      sourceByteSize: edition.rawTransport.byteSize,
      readerVersion: "future-kiwix-reader/v1",
      decompressorVersion: "future-zim-decompressor/v1",
    },
    identity: {
      project: edition.project,
      language: edition.language,
      pageId: true,
      revisionId: true,
      revisionHistoryEquivalentAttribution: true,
      canonicalUrl: true,
    },
    license: {
      verifiable: true,
      permittedUse: true,
    },
    attribution: {
      present: true,
      retainedInEdition: true,
      retainedInResults: true,
    },
    immutableSnapshot: {
      snapshotDate: edition.dump.snapshotDate,
      sourcePinned: true,
      deterministicReplay: true,
      immutableEdition: true,
    },
    decompression: {
      deterministic: true,
    },
    media: {
      ambiguity: false,
    },
    lifecycle: {
      activePointer: "SHARED_EXISTING_LIFECYCLE",
      queryReceipt: "SHARED_EXISTING_QUERY_RECEIPT",
    },
    automaticTruthClaim: false,
    output: {
      editionSchema: assessment.canonicalTarget.editionSchema,
      editionDigest: edition.editionDigest,
      contentDigest: edition.contentDigest,
      receiptDigest: receipt.receiptDigest,
    },
  };
}

function assessFutureReader(candidate, edition, receipt, sharedChecks) {
  const hardRejects = [];
  if (candidate.format !== "ZIM") hardRejects.push("UNSUPPORTED_READER_FORMAT");
  if (candidate.inputOnly !== true) hardRejects.push("ADAPTER_MUST_BE_INPUT_ONLY");
  if (candidate.media?.ambiguity === true) hardRejects.push("MEDIA_AMBIGUITY");
  if (candidate.decompression?.deterministic !== true) hardRejects.push("NON_DETERMINISTIC_DECOMPRESSION");
  if (candidate.lifecycle?.activePointer !== "SHARED_EXISTING_LIFECYCLE") hardRejects.push("SEPARATE_ACTIVE_POINTER");
  if (candidate.lifecycle?.queryReceipt !== "SHARED_EXISTING_QUERY_RECEIPT") hardRejects.push("SEPARATE_QUERY_RECEIPT");
  if (candidate.automaticTruthClaim === true) hardRejects.push("AUTOMATIC_TRUTH_NOT_ALLOWED");
  if (hardRejects.length > 0) return { verdict: "REJECT", reasonCodes: hardRejects, results: [] };

  const deferred = [];
  if (candidate.identity?.revisionHistoryEquivalentAttribution !== true) deferred.push("REVISION_HISTORY_ATTRIBUTION_MISSING");
  if (candidate.provenance?.sourcePinVerifiable !== true || candidate.license?.verifiable !== true) {
    deferred.push("SOURCE_OR_LICENSE_UNVERIFIABLE");
  }
  if (deferred.length > 0) return { verdict: "DEFER", reasonCodes: deferred, results: [] };

  const allSharedChecks = {
    canonicalEditionValidator: validateMediaWikiMiniDumpEditionV1(edition),
    immutableEditionDigestReplay: sharedChecks.immutableEditionDigestReplay,
    sharedActiveLifecycleReadback: sharedChecks.sharedActiveLifecycleReadback,
    sharedQueryReceiptValidator: validateMediaWikiReadonlyQueryReceiptV1(receipt),
    sharedQueryReceiptCorpusReadback: sharedChecks.sharedQueryReceiptCorpusReadback,
    completeResultProvenance: receipt.results.every((result) => {
      try {
        completeResult(result, edition);
        return true;
      } catch {
        return false;
      }
    }),
    visibleCrossSourceContradictions: sharedChecks.visibleCrossSourceContradictions,
    noAutomaticTruthPromotion: candidate.automaticTruthClaim === false,
  };
  const failed = Object.entries(allSharedChecks).filter(([, passed]) => !passed).map(([name]) => name);
  if (failed.length > 0) return { verdict: "DEFER", reasonCodes: failed.map((name) => `SHARED_CHECK_FAILED:${name}`), results: [] };

  return {
    verdict: "ACCEPT",
    reasonCodes: ["INPUT_ONLY_CAN_MAP_TO_EXISTING_CANONICAL_LIFECYCLE"],
    adapterRole: "INPUT_ONLY",
    mapping: {
      direction: assessment.mapping.direction,
      targetEditionSchema: assessment.canonicalTarget.editionSchema,
      targetEditionDigest: edition.editionDigest,
      targetContentDigest: edition.contentDigest,
      targetQueryReceiptSchema: assessment.canonicalTarget.queryReceiptSchema,
      targetQueryReceiptDigest: receipt.receiptDigest,
      separateActivePointer: false,
      separateQueryReceipt: false,
    },
    sharedChecks: allSharedChecks,
    receipt,
    results: receipt.results,
  };
}

test("PSAI107 assessment enumerates the one-way, input-only Kiwix/ZIM contract", () => {
  assert.equal(assessment.governance.operatingModelVersion, "1.1");
  assert.deepEqual(assessment.governance.preservedDecisionIds, ["D-001", "D-002", "D-003", "D-004", "D-005", "D-006", "D-007"]);
  assert.equal(assessment.governance.processVariantIntroduced, false);
  assert.equal(assessment.boundary.adapterRole, "INPUT_ONLY");
  assert.equal(assessment.boundary.implementsZimImporter, false);
  assert.equal(assessment.boundary.implementsSecondLifecycle, false);
  assert.equal(assessment.boundary.automaticTruthPromotion, false);
  for (const section of ["provenance", "identity", "license", "attribution", "immutableSnapshot"]) {
    assert.ok(Array.isArray(assessment.requirements[section]));
    assert.ok(assessment.requirements[section].length >= 2);
  }
  assert.equal(assessment.mapping.inputOnly, true);
  assert.equal(assessment.mapping.mustReuseEditionSchema, true);
  assert.equal(assessment.mapping.mustReuseLifecycle, true);
  assert.equal(assessment.mapping.mustReuseQueryReceipt, true);
  assert.equal(assessment.mapping.separateActivePointer, false);
  assert.equal(assessment.mapping.separateQueryReceipt, false);
  assert.equal(assessment.mapping.automaticTruthClaim, false);
  assert.deepEqual(assessment.mapping.requiredResultFields, [
    "exactPassage", "project", "pageId", "revisionId", "canonicalUrl", "snapshotDate", "license", "contentDigest", "editionDigest",
  ]);
  assert.deepEqual(assessment.canonicalTarget.requiredSharedChecks, [
    "canonical_edition_validator",
    "immutable_edition_digest_replay",
    "shared_active_lifecycle_readback",
    "shared_query_receipt_validator",
    "shared_query_receipt_corpus_readback",
    "complete_result_provenance",
    "visible_cross_source_contradictions",
    "no_automatic_truth_promotion",
  ]);
});

test("PSAI107 synthetic mini dump and bounded official pilot test double replay into immutable editions", () => {
  const syntheticRoot = resolve(repoRoot, syntheticFixture.root);
  const syntheticFirst = importMediaWikiMiniDumpEditionV1(syntheticRoot, syntheticProfile);
  const syntheticReplay = importMediaWikiMiniDumpEditionV1(syntheticRoot, syntheticProfile);
  assert.equal(syntheticFirst.contentDigest, syntheticFixture.expectedContentDigest);
  assert.equal(syntheticFirst.editionDigest, syntheticFixture.expectedEditionDigest);
  assert.equal(syntheticFirst.editionDigest, syntheticReplay.editionDigest);
  assert.equal(syntheticFirst.contentDigest, syntheticReplay.contentDigest);
  assert.equal(validateMediaWikiMiniDumpEditionV1(syntheticFirst), true);
  assertImmutable(syntheticFirst);

  const bytes = new Uint8Array(readFileSync(resolve(repoRoot, officialFixture.sourceBytesRef)));
  assert.equal(officialFixture.sourceProject, pilotManifest.official.project);
  assert.equal(officialFixture.language, pilotManifest.official.language);
  assert.equal(sha256(bytes), officialFixture.checksum);
  assert.equal(bytes.byteLength, officialFixture.byteSize);
  const officialFirst = projectMediaWikiMiniDumpEditionV1(officialProfile(), bytes);
  const officialReplay = projectMediaWikiMiniDumpEditionV1(officialProfile(), bytes);
  assert.equal(officialFirst.project, officialFixture.project);
  assert.equal(officialFirst.dump.sourceUrl, officialFixture.sourceUrl);
  assert.equal(officialFirst.dump.snapshotDate, officialFixture.snapshotDate);
  assert.deepEqual(officialFirst.license, officialFixture.license);
  assert.equal(officialFirst.contentDigest, officialFixture.contentDigest);
  assert.equal(officialFirst.editionDigest, officialReplay.editionDigest);
  assert.equal(officialFirst.contentDigest, officialReplay.contentDigest);
  assert.equal(validateMediaWikiMiniDumpEditionV1(officialFirst), true);
  assertImmutable(officialFirst);
  assert.notEqual(syntheticFirst.editionDigest, officialFirst.editionDigest);
});

test("PSAI107 compatible future reader maps only to shared lifecycle and receipt checks", () => {
  const edition = importMediaWikiMiniDumpEditionV1(resolve(repoRoot, syntheticFixture.root), syntheticProfile);
  const corpus = mediaWikiReadonlyQueryCorpusV1(activeMediaWikiReadonlyEditionV1(edition));
  const receipt = queryMediaWikiReadonlyV1(corpus, request());
  const lifecycleReceipt = lifecycleReadback(edition);
  const replay = importMediaWikiMiniDumpEditionV1(resolve(repoRoot, syntheticFixture.root), syntheticProfile);
  const changed = changedSyntheticEdition();
  const conflictCorpus = mediaWikiReadonlyQueryCorpusV1(
    activeMediaWikiReadonlyEditionV1(edition),
    [selectedMediaWikiReadonlyEditionV1(changed, "UNVERIFIED")],
  );
  const conflictReceipt = queryMediaWikiReadonlyV1(conflictCorpus, request());
  assert.equal(validateMediaWikiReadonlyQueryReceiptAgainstCorpusV1(conflictReceipt, conflictCorpus), true);
  assert.ok(conflictReceipt.contradictions.length > 0);
  assert.ok(conflictReceipt.results.some((result) => result.epistemicStatus === "DISPUTED"));
  assert.ok(conflictReceipt.results.some((result) => result.sourceEpistemicStatus === "UNVERIFIED"));

  const assessed = assessFutureReader(compatibleCandidate(edition, receipt), edition, receipt, {
    immutableEditionDigestReplay: replay.editionDigest === edition.editionDigest,
    sharedActiveLifecycleReadback: lifecycleReceipt.activeEditionDigest === edition.editionDigest,
    sharedQueryReceiptCorpusReadback: validateMediaWikiReadonlyQueryReceiptAgainstCorpusV1(receipt, corpus),
    visibleCrossSourceContradictions: conflictReceipt.contradictions.length > 0
      && conflictReceipt.results.filter((result) => result.pageId === 1001).length === 2,
  });
  assert.equal(assessed.verdict, "ACCEPT");
  assert.equal(assessed.adapterRole, "INPUT_ONLY");
  assert.equal(assessed.mapping.separateActivePointer, false);
  assert.equal(assessed.mapping.separateQueryReceipt, false);
  assert.equal(assessed.sharedChecks.noAutomaticTruthPromotion, true);
  assert.equal(assessed.sharedChecks.sharedActiveLifecycleReadback, true);
  assert.equal(assessed.sharedChecks.sharedQueryReceiptValidator, true);
  assert.equal(assessed.sharedChecks.sharedQueryReceiptCorpusReadback, true);
  assert.equal(assessed.receipt.receiptDigest, mediaWikiReadonlyQueryReceiptDigestV1(assessed.receipt));
  assert.ok(assessed.results.length > 0);
  for (const result of assessed.results) completeResult(result, edition);
});

test("PSAI107 required Kiwix/ZIM negative cases reject or defer closed", () => {
  const edition = importMediaWikiMiniDumpEditionV1(resolve(repoRoot, syntheticFixture.root), syntheticProfile);
  const corpus = mediaWikiReadonlyQueryCorpusV1(activeMediaWikiReadonlyEditionV1(edition));
  const receipt = queryMediaWikiReadonlyV1(corpus, request());
  const baseline = compatibleCandidate(edition, receipt);
  const mutations = {
    "absent-revision-history-equivalent-attribution": (candidate) => {
      candidate.identity.revisionHistoryEquivalentAttribution = false;
    },
    "unverifiable-source-or-license": (candidate) => {
      candidate.provenance.sourcePinVerifiable = false;
      candidate.license.verifiable = false;
    },
    "media-ambiguity": (candidate) => {
      candidate.media.ambiguity = true;
    },
    "non-deterministic-decompression": (candidate) => {
      candidate.decompression.deterministic = false;
    },
    "separate-active-pointer": (candidate) => {
      candidate.lifecycle.activePointer = "SEPARATE";
    },
    "separate-query-receipt": (candidate) => {
      candidate.lifecycle.queryReceipt = "SEPARATE";
    },
    "zim-automatically-accepted": (candidate) => {
      candidate.automaticTruthClaim = true;
    },
  };
  assert.equal(assessment.negativeCases.length, Object.keys(mutations).length);
  for (const negative of assessment.negativeCases) {
    const mutate = mutations[negative.caseId];
    assert.equal(typeof mutate, "function", negative.caseId);
    const candidate = clone(baseline);
    mutate(candidate);
    const result = assessFutureReader(candidate, edition, receipt, {
      immutableEditionDigestReplay: true,
      sharedActiveLifecycleReadback: true,
      sharedQueryReceiptCorpusReadback: true,
      visibleCrossSourceContradictions: true,
    });
    assert.equal(result.verdict, negative.expectedVerdict, negative.caseId);
    assert.ok(result.reasonCodes.includes(negative.reasonCode), `${negative.caseId} missing ${negative.reasonCode}`);
    assert.deepEqual(result.results, []);
  }
});

test("PSAI107 every assessment receipt result preserves exact passage, identity and digest fields", () => {
  const edition = importMediaWikiMiniDumpEditionV1(resolve(repoRoot, syntheticFixture.root), syntheticProfile);
  const officialBytes = new Uint8Array(readFileSync(resolve(repoRoot, officialFixture.sourceBytesRef)));
  const officialEdition = projectMediaWikiMiniDumpEditionV1(officialProfile(), officialBytes);
  for (const candidateEdition of [edition, officialEdition]) {
    const corpus = mediaWikiReadonlyQueryCorpusV1(activeMediaWikiReadonlyEditionV1(candidateEdition));
    const receipt = queryMediaWikiReadonlyV1(corpus, request());
    assert.equal(validateMediaWikiReadonlyQueryReceiptV1(receipt), true);
    assert.equal(validateMediaWikiReadonlyQueryReceiptAgainstCorpusV1(receipt, corpus), true);
    assertImmutable(receipt);
    for (const result of receipt.results) completeResult(result, candidateEdition);
  }
});

// Keep a direct lifecycle symbol reference in this focused assessment so a
// future refactor cannot silently replace the shared activation boundary with
// a ZIM-specific pointer.
assert.equal(typeof activateMediaWikiEditionV1, "function");
