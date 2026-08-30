import assert from 'node:assert/strict';
import {performance} from 'node:perf_hooks';
import {readFile} from 'node:fs/promises';
import test from 'node:test';

import {importMediaWikiMiniDumpEditionV1} from '../dist/packages/contracts/src/mediawiki-mini-dump.js';
import {
  activeMediaWikiReadonlyEditionV1,
  mediaWikiReadonlyQueryCorpusV1,
  queryMediaWikiReadonlyV1,
} from '../dist/packages/local-knowledge/src/mediawiki-readonly-query.js';
import {validateMediaWikiReadonlyQueryReceiptAgainstCorpusV1} from '../dist/packages/contracts/src/mediawiki-query-receipt.js';

const receiptPath = 'docs/evidence/conveyor/psai282-local-knowledge-fabric-closure-v1.json';
const fixtureRoot = 'tests/fixtures/mediawiki-mini-dump';
const manifest = JSON.parse(await readFile(`${fixtureRoot}/manifest.json`, 'utf8'));

async function closureReceipt() {
  return JSON.parse(await readFile(receiptPath, 'utf8'));
}

function executeCases(cases) {
  const edition = importMediaWikiMiniDumpEditionV1(fixtureRoot, manifest.profiles.positive);
  const corpus = mediaWikiReadonlyQueryCorpusV1(activeMediaWikiReadonlyEditionV1(edition));
  return cases.map((entry) => {
    const started = performance.now();
    const result = queryMediaWikiReadonlyV1(corpus, {query: entry.query, ranking: 'LOCAL_HYBRID', maxResults: 20});
    const elapsedMs = performance.now() - started;
    assert.equal(validateMediaWikiReadonlyQueryReceiptAgainstCorpusV1(result, corpus), true);
    assert.equal(result.network, 'DISABLED');
    assert.equal(result.model, 'DISABLED');
    assert.equal(result.authorityBoundary, 'READ_ONLY_LOCAL_MEDIAWIKI_SYNTHETIC_NO_NETWORK_NO_MODEL_NO_EXECUTION_AUTHORITY');
    assert.ok(Object.values(result.authority).every((values) => Array.isArray(values) && values.length === 0));
    assert.ok(elapsedMs <= entry.latencyBudgetMs, `${entry.caseId} latency budget`);
    for (const item of result.results) {
      assert.ok(item.exactPassage.length > 0);
      assert.match(item.editionDigest, /^[a-f0-9]{64}$/);
      assert.match(item.contentDigest, /^[a-f0-9]{64}$/);
      assert.match(item.chunkDigest, /^[a-f0-9]{64}$/);
      assert.ok(item.canonicalUrl.startsWith('https://'));
      assert.ok(item.pageId > 0 && item.revisionId > 0);
    }
    return {caseId: entry.caseId, resultIds: result.results.map((item) => item.pageId), receiptDigest: result.receiptDigest};
  });
}

test('PSAI282 current contracts implement one deterministic local Knowledge Fabric without a second lifecycle', async () => {
  const receipt = await closureReceipt();
  assert.equal(receipt.schemaVersion, 'pansphaira.cks/local-knowledge-fabric-closure/v1');
  assert.equal(receipt.issue, 282);
  assert.equal(receipt.currentMainBase, '272ae2abb348c5dd27a36fda5a541f01d5dc098e');
  assert.equal(receipt.disposition, 'REUSE_CKS_CONTRACTS_AND_MEDIAWIKI_EDITION_LIFECYCLE');
  assert.deepEqual(receipt.nonClaims, [
    'NO_GRAPH_INFRASTRUCTURE',
    'NO_VECTOR_RETRIEVAL_CLAIM',
    'NO_NETWORK_OR_MODEL_DEPENDENCY',
    'NO_KNOWLEDGE_PROMOTION_OR_AUTHORITY',
  ]);
});

test('PSAI282 retrieval baseline has exact top-1 recall/precision, visible missing Knowledge and stable receipts', async () => {
  const receipt = await closureReceipt();
  const first = executeCases(receipt.baseline.cases);
  const second = executeCases(receipt.baseline.cases);
  assert.deepEqual(second, first);
  let truePositive = 0;
  let predicted = 0;
  let relevant = 0;
  for (const [index, entry] of receipt.baseline.cases.entries()) {
    const observed = first[index].resultIds;
    relevant += entry.expectedTopPageId === null ? 0 : 1;
    predicted += observed.length > 0 ? 1 : 0;
    if (entry.expectedTopPageId !== null) {
      assert.equal(observed[0], entry.expectedTopPageId);
      truePositive += observed[0] === entry.expectedTopPageId ? 1 : 0;
    } else {
      assert.deepEqual(observed, []);
    }
  }
  assert.equal(truePositive / relevant, receipt.baseline.top1Recall);
  assert.equal(truePositive / predicted, receipt.baseline.top1Precision);
  assert.equal(first.length, receipt.baseline.queryOperationCount);
});

test('PSAI282 closure binds canonical CKS and Wiki gates plus contradiction/supersession visibility', async () => {
  const [receipt, packageJson] = await Promise.all([closureReceipt(), readFile('package.json', 'utf8').then(JSON.parse)]);
  assert.match(packageJson.scripts.posttest, /npm run cks-contracts:test/);
  assert.match(packageJson.scripts.posttest, /npm run wiki:test/);
  assert.deepEqual(receipt.requiredGates, [
    'npm run cks-contracts:test',
    'npm run wiki:test',
    'node --test tests/cks-02-local-knowledge-fabric-closure.test.mjs',
  ]);
  assert.equal(receipt.visibility.contradictions, 'EXPLICIT_DISPUTED_RESULTS');
  assert.equal(receipt.visibility.supersession, 'ACTIVE_OR_SUPERSEDED_TYPED_OBJECTS');
  assert.equal(receipt.visibility.missingKnowledge, 'ZERO_RESULT_RECEIPT');
});
