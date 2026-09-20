import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, cpSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve, dirname } from 'node:path';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { canonicalJson } from '../dist/packages/contracts/src/index.js';
const root = resolve(import.meta.dirname, '..');
const producerPath = 'contracts/analytics/producer-manifest-v1.json';
const consumerPath = 'tests/fixtures/paired-analytics/consumer-support-manifest-v1-545a3b44.json';
const digest = v => createHash('sha256').update(canonicalJson(v)).digest('hex');
function probe(mutate, args = []) {
  const dir = mkdtempSync(resolve(tmpdir(), 'paired-runner-'));
  try {
    for (const folder of ['contracts/analytics', 'tests/fixtures/paired-analytics', 'tests/fixtures/cks-analytics', 'verification', 'src/cks-12']) {
      mkdirSync(dirname(resolve(dir, folder)), { recursive: true });
      cpSync(resolve(root, folder), resolve(dir, folder), { recursive: true });
    }
    const p = JSON.parse(readFileSync(resolve(dir, producerPath)));
    const c = JSON.parse(readFileSync(resolve(dir, consumerPath)));
    mutate(p, c);
    const { manifestDigest, ...pb } = p;
    p.manifestDigest = digest(pb);
    const { integrity, ...cb } = c;
    c.integrity.digest = `sha256:${digest(cb)}`;
    writeFileSync(resolve(dir, producerPath), JSON.stringify(p));
    writeFileSync(resolve(dir, consumerPath), JSON.stringify(c));
    const result = spawnSync(process.execPath, [resolve(root, 'scripts/run-paired-analytics-parity.mjs'), ...args], { cwd: dir, encoding: 'utf8' });
    return { ...result, producerDigest: p.manifestDigest, evidence: JSON.parse(readFileSync(resolve(dir, 'verification/paired-analytics-compatibility-v1.json'))) };
  } finally { rmSync(dir, { recursive: true, force: true }); }
}
test('runner denies rehashed removal of a mandatory capability against independent authority', () => {
  const result = probe((p, c) => { c.support.supported = c.support.supported.filter(x => x.id !== 'bi.status.read'); });
  assert.notEqual(result.status, 0, result.stdout + result.stderr);
});

test('floating commits and trees cannot establish their own pin', async () => {
  const { derivePairedAnalyticsPinnedV1, verifyPairedAnalyticsParityV1 } = await import('../dist/src/analytics/paired-analytics-parity.js');
  const p = JSON.parse(readFileSync(resolve(root, producerPath)));
  const c = JSON.parse(readFileSync(resolve(root, consumerPath)));
  for (const h of [p.producer.serviceHead, c.bindings.kaleidosphereHead]) { h.commitOid = 'main'; h.treeOid = 'latest'; }
  p.producer.reconciledReleasedHeads.pansphaira = 'main';
  const { manifestDigest, ...pb } = p; p.manifestDigest = digest(pb);
  const { integrity, ...cb } = c; c.integrity.digest = `sha256:${digest(cb)}`;
  assert.throws(() => derivePairedAnalyticsPinnedV1(p, c), /HEAD_INVALID/);
});
test('runner denies rehashed floating refs', () => {
  const result = probe((p, c) => {
    for (const h of [p.producer.serviceHead, c.bindings.kaleidosphereHead]) { h.commitOid = 'main'; h.treeOid = 'latest'; }
    p.producer.reconciledReleasedHeads.pansphaira = 'main';
  });
  assert.notEqual(result.status, 0);
});

test('runner reports a newly added unrelated optional gap without repinning', () => {
  const result = probe(p => p.gaps.push({ id: 'OPTIONAL_NEW', state: 'PENDING', field: 'optional.connector', note: 'Not promised by this pair', observed: {} }));
  assert.equal(result.status, 0, result.stderr);
  assert.ok(result.evidence.optionalGapReports.some(g => g.id === 'OPTIONAL_NEW'));
  assert.equal(result.evidence.inputDigests?.producer, result.producerDigest);
});

for (const [name, mutate] of [
  ['missing gap inventory', p => { delete p.gaps; }],
  ['malformed optional gap', p => p.gaps.push({ state: 'PENDING' })],
  ['promised capability disguised as optional', p => p.gaps.push({ id: 'bi.status.read', state: 'PENDING', field: 'support.supported', note: 'mandatory broken', observed: {} })],
  ['unknown schema', (p, c) => { p.schemaVersion = 'unknown'; c.schemaVersion = 'unknown'; }],
  ['invented calculation/verdict', p => { p.evidence.computed.nodeCount = 999999; p.runtimeProjection.adjudication.outcome = 'DENIED'; }],
  ['missing derivation and config', (p, c) => { delete p.derivedFrom; delete p.fieldSurfaceDigest; c.bindings.config = {}; }],
  ['authority escalation', p => { p.authorityState.authority = 'ADMIN'; p.runtimeProjection.adjudication.authority = 'ADMIN'; }],
]) test(`runner denies rehashed ${name}`, () => assert.notEqual(probe(mutate).status, 0));
test('static receipt never names manifest release strings as executed heads', () => {
  const result = probe(() => {});
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.evidence.testedHeads, null);
  assert.equal(result.evidence.executionStatus, 'PENDING_PINNED_EXECUTION');
});

test('execution cannot succeed with an unresolved counterpart or a floating expected PAN ref', () => {
  const result = probe(() => {}, ['--counterpart', '/nonexistent-public-counterpart', '--pan-head', 'main', '--output', resolve(tmpdir(), 'paired-execution-denial.json')]);
  assert.notEqual(result.status, 0, result.stdout + result.stderr);
});

test('execution rejects a different or dirty Git head before running counterpart code', async () => {
  const { executePinnedPair } = await import('../scripts/paired-analytics-execution.mjs');
  const dir = mkdtempSync(resolve(tmpdir(), 'paired-git-'));
  const git = args => {
    const result = spawnSync('git', args, { cwd: dir, encoding: 'utf8' });
    assert.equal(result.status, 0, result.stderr);
    return result.stdout.trim();
  };
  try {
    git(['init', '--quiet']);
    writeFileSync(resolve(dir, 'tracked'), 'baseline');
    git(['add', 'tracked']);
    git(['-c', 'user.name=Fixture', '-c', 'user.email=fixture@example.invalid', 'commit', '--quiet', '-m', 'fixture']);
    const head = git(['rev-parse', 'HEAD']);
    const input = { root: dir, counterpart: dir, pinned: {}, consumer: {} };
    assert.throws(() => executePinnedPair({ ...input, expectedPanHead: 'main' }), /IMMUTABLE_OID/);
    assert.throws(() => executePinnedPair({ ...input, expectedPanHead: '0'.repeat(40) }), /HEAD_MISMATCH/);
    assert.throws(() => executePinnedPair({ ...input, expectedPanHead: head }), /RUNNER_SOURCE_MISMATCH/);
    writeFileSync(resolve(dir, 'tracked'), 'dirty');
    assert.throws(() => executePinnedPair({ ...input, expectedPanHead: head }), /DIRTY_CHECKOUT/);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('a floating declared PAN release head cannot establish a pin either', async () => {
  const { derivePairedAnalyticsPinnedV1 } = await import('../dist/src/analytics/paired-analytics-parity.js');
  const p = JSON.parse(readFileSync(resolve(root, producerPath)));
  const c = JSON.parse(readFileSync(resolve(root, consumerPath)));
  p.producer.reconciledReleasedHeads.pansphaira = 'main';
  assert.throws(() => derivePairedAnalyticsPinnedV1(p, c), /HEAD_INVALID/);
});
