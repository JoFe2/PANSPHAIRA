import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const read = p => readFileSync(new URL('../' + p, import.meta.url), 'utf8');

test('contribution automation has a single local command and canonical test registration', () => {
  const {scripts} = JSON.parse(read('package.json'));
  assert.match(scripts['module:check'] ?? '', /node --test tests\/module-contribution\.test\.mjs/);
  assert.match(scripts['module:check'], /module-contribution\.mjs check/);
  assert.match(scripts.test, /tests\/module-contribution-workflow\.test\.mjs/);
  assert.match(scripts.test, /tests\/module-contribution\.test\.mjs/);
});

test('existing read-only CI derives summaries and manifests without new publishing authority', () => {
  const ci = read('.github/workflows/ci.yml');
  assert.match(ci, /contents: read/);
  assert.match(ci, /module-contribution\.mjs impact --base/);
  assert.match(ci, /module-contribution\.mjs release/);
  assert.match(ci, /module-contribution\.mjs verify --manifest/);
  assert.match(ci, /name: module-contribution-\$\{\{ github.sha \}\}/);
  assert.doesNotMatch(ci, /pull_request_target|contents: write|secrets\./);
});

test('small contributions do not require a preliminary issue or separate graph paperwork', () => {
  const guide = read('CONTRIBUTING.md');
  assert.match(guide, /Small fixes do not require a preliminary issue/);
  assert.match(guide, /npm run module:check/);
  const pr = read('.github/PULL_REQUEST_TEMPLATE.md');
  assert.doesNotMatch(pr, /I linked the issue/);
  assert.match(pr, /if applicable/);
});

test('UI-QUALITY-01 existing guides and conditional PR rules name actual UI evidence and keep bug owners', () => {
  for (const path of ['CONTRIBUTING.md','docs/MODULE-CONTRIBUTION.md']) {
    const guide=read(path).replace(/\s+/g,' ');
    assert.match(guide,/UI-QUALITY-01/);
    assert.match(guide,/Browser.*backend.*persisted target readback/);
    assert.match(guide,/proposal.*decision.*authority.*effect/);
    assert.match(guide,/390 px/);assert.match(guide,/actually inspect/);
    assert.match(guide,/#537/);assert.match(guide,/#538/);
    assert.match(guide,/NOT_RUN.*not.*PASS/i);
  }
  const pr=read('.github/PULL_REQUEST_TEMPLATE.md');
  assert.match(pr,/UI applicability.*N\/A.*reason/);
  assert.match(pr,/UI change.*documentation-only/);
  assert.match(pr,/Browser.*backend.*persisted target readback/);
  assert.match(pr,/390 px.*actually inspected/);
  assert.match(pr,/commit.*build.*viewport.*data.*context.*state/);
  assert.match(pr,/denied.*stale.*unknown/);
});

test('UI-QUALITY-01 canonical registration is separate from actual native product acceptance', () => {
  const {scripts,devDependencies}=JSON.parse(read('package.json'));
  assert.equal(scripts.pretest.split('npm run pan537:test').length,2);
  assert.match(scripts['pan537:test'],/run-pan537-proposal-diff-browser-tests\.mjs$/);
  const runner=read('scripts/run-pan537-proposal-diff-browser-tests.mjs');
  for(const path of ['tests/pan537/browser-proposal-diff.test.mjs','tests/pan538/setup-overflow.test.mjs'])assert.ok(runner.includes(JSON.stringify(path)),path);
  assert.match(runner,/--test-concurrency=1/);assert.doesNotMatch(runner,/--test-skip-pattern|--test-name-pattern/);
  assert.equal(devDependencies.playwright,'1.63.0');
  assert.match(read('.github/workflows/ci.yml'),/npm run proof:secure-default/);
  assert.match(read('scripts/verify-secure-default-proof.mjs'),/npm test/);
  // This is invocation/ownership evidence, not browser, screenshots or release PASS.
});
