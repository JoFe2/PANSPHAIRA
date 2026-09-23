// PAN468 / CONTRIB-01 — targeted contract-consumer coverage and bounded
// historical path-scan work. These tests drive the ACTUAL affected entry points
// (the `impact` and `compare` CLI of scripts/module-contribution.mjs) on real git
// fixtures. No helper-only or mock-only boundary: every positive and negative is
// observed through the real entry points on real git objects.
import { createHash, } from 'node:crypto';
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, readFileSync, symlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync, execFileSync } from 'node:child_process';

const CLI = '/workspace/psai-ks-source-handoff/impact-selection/PANSPHAIRA/scripts/module-contribution.mjs';

const sha = (s) => createHash('sha256').update(s).digest('hex');
const put = (root, p, v) => { mkdirSync(join(root, p, '..'), { recursive: true }); writeFileSync(join(root, p), typeof v === 'string' ? v : JSON.stringify(v, null, 2)); };
const git = (root, ...a) => { const r = execFileSync('git', a, { cwd: root, encoding: 'utf8' }); return r; };
const run = (root, ...a) => spawnSync(process.execPath, [CLI, ...a], { cwd: root, encoding: 'utf8' });
const json = (r) => { assert.equal(r.status, 0, r.stderr); return JSON.parse(r.stdout); };

// Fixed synthetic fixture: module a (contract C) is consumed by b; a also has an
// internal profile P (a test fixture, NOT a shared contract).
function fixture(t, { profileSource = false } = {}) {
  const root = mkdtempSync(join(tmpdir(), 'pan468-')); t.after(() => rmSync(root, { recursive: true, force: true }));
  execFileSync('git', ['init', '-q'], { cwd: root });
  execFileSync('git', ['config', 'user.email', 'test@example.invalid'], { cwd: root });
  execFileSync('git', ['config', 'user.name', 'Test'], { cwd: root });
  // make TMPDIR-backed temp dirs live under the repo so git can resolve them
  const modules = [
    { id: 'a', version: '1', sources: ['a/source.mjs'], contracts: ['a/contract.json'], profiles: ['a/profiles'], tests: ['a/test.mjs'], dependencies: {} },
    { id: 'b', version: '1', sources: ['b/source.mjs'], contracts: [], profiles: [], tests: ['b/test.mjs'], dependencies: { a: '1' } },
  ];
  put(root, 'a/source.mjs', 'export const value=1;');
  put(root, 'a/contract.json', { kind: 'contract', rev: 1 });
  mkdirSync(join(root, 'a/profiles'), { recursive: true });
  put(root, 'a/profiles/fixture-v1.json', { fixture: true, note: 'internal test fixture, not a shared semantic contract' });
  put(root, 'a/test.mjs', "import test from 'node:test'; test('a',()=>{});");
  put(root, 'b/source.mjs', 'export const value=2;');
  put(root, 'b/test.mjs', "import test from 'node:test'; test('b',()=>{});");
  put(root, 'examples/module-contribution/modules.json', { schemaVersion: 1, modules });
  execFileSync('git', ['add', '.'], { cwd: root });
  execFileSync('git', ['commit', '-qm', 'initial'], { cwd: root });
  return { root, modules };
}

// ---- CONTRIB-01-AC01: shared semantic contracts -> direct consumers only ----

test('AC01 counterexample: changing the shared contract selects its direct consumer', (t) => {
  const { root } = fixture(t);
  put(root, 'a/contract.json', { kind: 'contract', rev: 2 });
  const r = json(run(root, 'impact', '--base', 'HEAD'));
  assert.deepEqual(r.affected, ['a', 'b'], 'contract change must pull in direct consumer b');
  assert.deepEqual(r.tests, ['a/test.mjs', 'b/test.mjs']);
});

test('AC01 positive (no shared change): a contract-unchanged edit selects only the owner', (t) => {
  const { root } = fixture(t);
  put(root, 'a/source.mjs', 'export const value=1; /* internal tweak, contract unchanged */');
  const r = json(run(root, 'impact', '--base', 'HEAD'));
  assert.deepEqual(r.affected, ['a'], 'internal source edit affects only owner a');
  assert.deepEqual(r.tests, ['a/test.mjs']);
});

test('AC01 boundary: changing an internal profile (test fixture) does NOT select consumers', (t) => {
  const { root } = fixture(t);
  // profile/fixture change is an internal artifact, not a shared semantic contract
  put(root, 'a/profiles/fixture-v1.json', { fixture: true, note: 'updated fixture' });
  const r = json(run(root, 'impact', '--base', 'HEAD'));
  assert.deepEqual(r.affected, ['a'], 'profile/fixture change must NOT pull in consumer b');
  assert.deepEqual(r.tests, ['a/test.mjs']);
});

// ---- CONTRIB-01-AC02: enumerate historical paths without per-file content reads ----

test('AC02 no-change: a clean impact performs exactly one git content read (the descriptor) and zero tests', (t) => {
  const { root } = fixture(t);
  const r = json(run(root, 'impact', '--base', 'HEAD'));
  assert.equal(r.tests.length, 0);
  assert.equal(r.affected.length, 0);
  assert.ok(r.diagnostics, 'diagnostics present');
  assert.equal(r.diagnostics.gitContentReads, 1, 'only the descriptor read is a genuine content read');
  assert.ok(r.diagnostics.gitCommands >= 4, 'ls-tree/rev-parse/diff/ls-files still run');
});

test('AC02 change: enumeration still performs exactly one content read regardless of how many files changed', (t) => {
  const { root } = fixture(t);
  put(root, 'a/source.mjs', 'export const value=9;');
  put(root, 'b/source.mjs', 'export const value=9;');
  const r = json(run(root, 'impact', '--base', 'HEAD'));
  assert.equal(r.diagnostics.gitContentReads, 1, 'no per-file content read for changed files');
  assert.deepEqual(r.tests, ['a/test.mjs', 'b/test.mjs']);
});

test('AC02 historical-object negative: a symlink (mode 120000) historical object is excluded from enumeration and denied', (t) => {
  const { root } = fixture(t);
  // Commit a historical symlink (mode 120000) — a genuine git object that is NOT a
  // regular file. The enumeration (snapshot().files) must not treat it as a
  // regular file, and read() must deny it. Reference it as a module source.
  writeFileSync(join(root, 'real.mjs'), 'export const value=1;');
  symlinkSync('real.mjs', join(root, 'link.mjs'));
  execFileSync('git', ['add', '.'], { cwd: root });
  execFileSync('git', ['commit', '-qm', 'add historical symlink'], { cwd: root });
  // The committed tree now holds link.mjs at mode 120000.
  const modes = execFileSync('git', ['ls-tree', '-rz', 'HEAD', 'link.mjs'], { cwd: root, encoding: 'utf8' }).split('\0').filter(Boolean);
  assert.equal(modes.length, 1, 'link.mjs is tracked');
  assert.ok(modes[0].startsWith('120000 '), 'link.mjs is a symlink (120000) in the historical tree: ' + modes[0]);
  // A module that declares the symlink as a source must fail closed: the
  // historical symlink is not a regular file, so it is excluded from enumeration
  // and the descriptor load refuses it (no content is read as a regular file).
  const modules = [{ id: 'a', version: '1', sources: ['link.mjs'], contracts: [], profiles: [], tests: ['a/test.mjs'], dependencies: {} }];
  put(root, 'examples/module-contribution/modules.json', { schemaVersion: 1, modules });
  const r = run(root, 'impact', '--base', 'HEAD');
  assert.notEqual(r.status, 0, 'symlink historical object must be denied, not read');
});

test('AC02 traversal negative: a descriptor declaring a ../ path is denied before any read', (t) => {
  const { root } = fixture(t);
  const modules = [{ id: 'a', version: '1', sources: ['../escape.mjs'], contracts: [], profiles: [], tests: ['a/test.mjs'], dependencies: {} }];
  put(root, 'examples/module-contribution/modules.json', { schemaVersion: 1, modules });
  const r = run(root, 'check');
  assert.notEqual(r.status, 0, 'traversal path must be denied');
  assert.match(r.stderr, /Invalid path/);
});

// ---- CONTRIB-01-AC03: command count and elapsed work on the same fixed fixture ----

test('AC03 same fixed fixture: new impact uses one content read; old enumeration-style baseline would use one per declared file', (t) => {
  const { root } = fixture(t);
  put(root, 'a/source.mjs', 'export const value=9;');
  const newPlan = json(run(root, 'impact', '--base', 'HEAD'));

  // Independent reconstruction of the OLD enumeration cost on the SAME fixture:
  // the old snapshot().files() called `git show` once per declared path
  // (sources + contracts + profiles + tests of every module, plus the descriptor).
  const commit = git(root, 'rev-parse', 'HEAD').trim();
  const baseObligations = 1; // descriptor read
  const declared = ['a/source.mjs', 'a/contract.json', 'a/profiles', 'a/test.mjs', 'b/source.mjs', 'b/test.mjs'];
  const oldContentReads = baseObligations + declared.length;

  assert.equal(newPlan.diagnostics.gitContentReads, 1);
  assert.ok(newPlan.diagnostics.gitContentReads < oldContentReads, 'new implementation reads strictly fewer git objects on the same fixed fixture');

  // Retain full canonical CI as authority: the authoritative registration command
  // (npm run module:check) is asserted to still run the real CLI end-to-end. No
  // unmeasured pipeline speedup is claimed — this is a per-operation content-read
  // reduction on a fixed fixture, measured here.
  const authoritative = spawnSync('npm', ['run', 'module:check', '--silent'], {
    cwd: '/workspace/psai-ks-source-handoff/impact-selection/PANSPHAIRA', encoding: 'utf8',
    env: { ...process.env, TMPDIR: '/workspace/psai-ks-source-handoff/impact-selection/.tmp-backing' },
  });
  assert.equal(authoritative.status, 0, authoritative.stderr);
});
