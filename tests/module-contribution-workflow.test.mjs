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
