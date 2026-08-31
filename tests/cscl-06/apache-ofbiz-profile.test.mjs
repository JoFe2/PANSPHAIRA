import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import {
  buildApacheOfbizProfile,
  canonicalJson,
  validateOfflineReplay,
} from '../../src/cscl-06/profile.mjs';

const root = new URL('../../', import.meta.url);
const fixtureUrl = (name) => new URL(`../fixtures/cscl-06/${name}`, import.meta.url);
const loadJson = async (name) => JSON.parse(await readFile(fixtureUrl(name), 'utf8'));

async function inputs() {
  return {
    selectorBytes: await readFile(new URL('tests/fixtures/cscl-01/source-selector-set-v1.json', root)),
    questionBytes: await readFile(new URL('tests/fixtures/cscl-01/question-inventory-v1.json', root)),
    corpus: await loadJson('official-source-corpus-v1.json'),
    assertions: await loadJson('source-native-assertions-v1.json'),
  };
}

const clone = (value) => structuredClone(value);

async function expectDenied(mutator, code) {
  const data = await inputs();
  mutator(data);
  assert.throws(() => buildApacheOfbizProfile(data), (error) => error?.code === code);
}

test('RED: builds exactly 36 closed source-native OFBiz cells', async () => {
  const result = buildApacheOfbizProfile(await inputs());
  assert.equal(result.facts.length, 37);
  assert.equal(result.cells.length, 36);
  assert.equal(result.profile.evidenceCells.length, 36);
  assert.deepEqual(result.counts, {
    families: 3,
    questions: 12,
    facts: 37,
    cells: 36,
    supported: 33,
    absent: 1,
    ambiguous: 1,
    conflicting: 1,
    corpusMembers: 18,
  });
  assert.equal(result.profile.systemId, 'apache-ofbiz');
  assert.equal(result.profile.systemRole, 'TRAINING');
  assert.equal(result.profile.holdoutIsolation, 'TRAINING_PROFILE');
  assert.equal(result.profile.boundary.authorityGrant, 'NONE');
});

test('replay is deterministic and matches the committed expected build', async () => {
  const data = await inputs();
  const first = buildApacheOfbizProfile(data);
  const second = buildApacheOfbizProfile(await inputs());
  assert.equal(canonicalJson(first), canonicalJson(second));
  assert.equal(canonicalJson(first), canonicalJson(await loadJson('expected-build-v1.json')));
});

test('offline replay reads only embedded Base64 source members', async () => {
  const result = validateOfflineReplay(await inputs(), {
    fetch: () => { throw new Error('network must not be called'); },
  });
  assert.equal(result.offline, true);
  assert.equal(result.byteIdentical, true);
  assert.ok(result.totalRawBytes > 0 && result.totalRawBytes <= 20 * 1024 * 1024);
});

test('every fact and cell validates against CSCL-01 closed schemas', async () => {
  const { default: Ajv2020 } = await import('ajv/dist/2020.js');
  const addFormats = (await import('ajv-formats')).default;
  const ajv = new Ajv2020({ strict: true, allErrors: true });
  addFormats(ajv);
  const factSchema = JSON.parse(await readFile(new URL('contracts/cscl-01/source-fact-v1.schema.json', root), 'utf8'));
  const cellSchema = JSON.parse(await readFile(new URL('contracts/cscl-01/evidence-cell-v1.schema.json', root), 'utf8'));
  const profileSchema = JSON.parse(await readFile(new URL('contracts/cscl-01/system-profile-v1.schema.json', root), 'utf8'));
  const result = buildApacheOfbizProfile(await inputs());
  for (const fact of result.facts) assert.equal(ajv.validate(factSchema, fact), true, JSON.stringify(ajv.errors));
  for (const cell of result.cells) assert.equal(ajv.validate(cellSchema, cell), true, JSON.stringify(ajv.errors));
  assert.equal(ajv.validate(profileSchema, result.profile), true, JSON.stringify(ajv.errors));
});

test('facts bind exact raw bytes, locators, parser, legal identity, and no candidate meaning', async () => {
  const result = buildApacheOfbizProfile(await inputs());
  const noCandidate = result.noCandidateMeaningSha256;
  for (const fact of result.facts) {
    assert.equal(fact.sourceIdentity.immutableSelector, 'tag:12b6d40382ac38d3252df78781f9877d46f5f9f7;commit:42819e5ae1d5339d3a204ac06b43e69d46a9c0ae');
    assert.equal(fact.legal.licenseId, 'Apache-2.0');
    assert.equal(fact.legal.licenseSha256, '98ea9a04fd3da336cbc8b09bd8362a177fe3296d4f15bedcb908ae1017a94021');
    assert.deepEqual(fact.parser, { id: 'cscl06-exact-byte-parser', version: '1.0.0' });
    assert.deepEqual(fact.canonicalizer, { id: 'cscl06-canonical-json', version: '1.0.0' });
  }
  for (const cell of result.cells) assert.equal(cell.equivalenceProof.candidateMeaningSha256, noCandidate);
});

test('explicit negative and ambiguous cells preserve OFBiz evidence and counterevidence', async () => {
  const result = buildApacheOfbizProfile(await inputs());
  const byKey = new Map(result.cells.map((cell) => [cell.questionId, cell]));
  assert.equal(byKey.get('product-item-management--absence-ambiguity-conflict').state, 'ABSENT');
  assert.ok(byKey.get('product-item-management--absence-ambiguity-conflict').counterexamples.some((x) => x.includes('statusId')));
  assert.equal(byKey.get('party-customer-management--absence-ambiguity-conflict').state, 'AMBIGUOUS');
  assert.equal(byKey.get('sales-order-management--absence-ambiguity-conflict').state, 'CONFLICTING');
});

test('denies annotated tag/peeled commit substitution independently', async () => {
  await expectDenied((d) => { d.corpus.source.tagObject = d.corpus.source.commit; }, 'SOURCE_IDENTITY_DRIFT');
  await expectDenied((d) => { d.corpus.source.commit = d.corpus.source.tagObject; }, 'SOURCE_IDENTITY_DRIFT');
});

test('denies source, legal, parser, path, mirror, and Base64 drift', async () => {
  await expectDenied((d) => { d.corpus.source.officialRepository = 'https://example.invalid/apache/ofbiz-framework.git'; }, 'SOURCE_IDENTITY_DRIFT');
  await expectDenied((d) => { d.corpus.legal.licenseId = 'Apache-2.0-or-later'; }, 'LEGAL_DRIFT');
  await expectDenied((d) => { d.assertions.parser.version = '1.0.1'; }, 'PARSER_DRIFT');
  await expectDenied((d) => { d.corpus.members[0].path = '../LICENSE'; }, 'PATH_DRIFT');
  await expectDenied((d) => { d.corpus.members[0].base64 += 'A'; }, 'BASE64_DRIFT');
});

test('denies invented/normalized facts, missing cells/counterevidence, extras, and Authority', async () => {
  await expectDenied((d) => { d.assertions.cells[0].claim = 'Business Partner master normalized across ERPs'; }, 'NORMALIZED_OR_UNEVIDENCED_CLAIM');
  await expectDenied((d) => { d.assertions.cells.pop(); }, 'CELL_COVERAGE');
  await expectDenied((d) => { d.assertions.cells.find((x) => x.state === 'ABSENT').counterexamples = []; }, 'MISSING_COUNTEREVIDENCE');
  await expectDenied((d) => { d.assertions.cells[0].Authority = 'WRITE'; }, 'EXTRA_FIELD');
  await expectDenied((d) => { d.assertions.boundary.authorityGrant = 'READ'; }, 'BOUNDARY_DRIFT');
});

test('denies paired redigestion, duplicate evidence, and cap breach', async () => {
  await expectDenied((d) => {
    const bytes = Buffer.from(d.corpus.members[2].base64, 'base64');
    bytes[0] ^= 1;
    d.corpus.members[2].base64 = bytes.toString('base64');
    d.corpus.members[2].sha256 = createHash('sha256').update(bytes).digest('hex');
  }, 'OFFICIAL_MEMBER_DRIFT');
  await expectDenied((d) => { d.corpus.members.push(clone(d.corpus.members[0])); }, 'DUPLICATE_MEMBER');
  await expectDenied((d) => { d.corpus.captureCapBytes = 1; }, 'CAP_DRIFT');
});
