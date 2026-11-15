// Ordinary registration census for PAN567: the canonical runner entry, the
// exact file set and the pretest chain are real package.json facts. DAG,
// SHA256SUMS and release-census updates are parent-owned after source review
// and are deliberately NOT asserted here (they did not exist yet at author
// time of this family).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
const entry = 'scripts/run-pan567-configuration-proposal-tests.mjs';
const files = ['tests/pan567/proposal-contract.test.mjs', 'tests/pan567/owner-dialogue.test.mjs', 'tests/pan567/confirmation-semantics.test.mjs', 'tests/pan567/browser-proposal.test.mjs', 'tests/pan567/registration.test.mjs'];
test('#567 canonical runner entry is registered and lists exactly the five ordinary test files', () => {
  const pkg = JSON.parse(readFileSync('package.json', 'utf8'));
  assert.equal(pkg.scripts['pan567:test'], 'TMPDIR="${TMPDIR:-${RUNNER_TEMP:?PAN567_OWNED_SCRATCH_REQUIRED}}" node ' + entry);
  assert.ok(pkg.scripts.pretest.split('&&').some(step => step.trim() === 'npm run pan567:test'), 'pan567:test runs in the ordinary pretest chain');
  const listed = spawnSync(process.execPath, [entry, '--list'], { encoding: 'utf8' });
  assert.equal(listed.status, 0);
  assert.deepEqual(JSON.parse(listed.stdout), files);
  assert.deepEqual(readdirSync('tests/pan567').filter(p => p.endsWith('.test.mjs')).map(p => 'tests/pan567/' + p).sort(), [...files].sort());
});
test('#567 startup selectors, test markers and NODE_OPTIONS injection deny before compilation', () => {
  const env = { ...process.env }; delete env.NODE_TEST_CONTEXT; delete env.NODE_OPTIONS;
  for (const args of [['--skip-native'], [files[0]], ['--test-shard=1/2'], ['--list', '--skip-browser']]) {
    const r = spawnSync(process.execPath, [entry, ...args], { encoding: 'utf8', env, timeout: 10000 });
    assert.notEqual(r.status, 0); assert.match(r.stderr, /PAN567_TEST_ARGUMENT_DENIED/); assert.equal(r.stdout, '');
  }
  for (const opts of ['--test-name-pattern=never', '--test_only', '--import=data:text/javascript,', '--require=missing']) {
    const r = spawnSync(process.execPath, [entry], { encoding: 'utf8', env: { ...env, NODE_OPTIONS: opts }, timeout: 10000 });
    assert.notEqual(r.status, 0); assert.equal(r.stdout, '');
  }
  for (const marker of ['', 'child-v8', 'unexpected']) {
    const r = spawnSync(process.execPath, [entry], { encoding: 'utf8', env: { ...env, NODE_TEST_CONTEXT: marker }, timeout: 10000 });
    assert.notEqual(r.status, 0); assert.match(r.stderr, /PAN567_TEST_ARGUMENT_DENIED/);
  }
});
