import { createHash } from 'node:crypto';

const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');
const digestPattern = /^[a-f0-9]{64}$/;
const boundary = Object.freeze({ authorityGrant: 'NONE', promotionGrant: 'NONE', executionGrant: 'NONE' });

const frozen = Object.freeze({
  selectorDigest: 'ea6029f3691b5e4ac635945541a2680b9c81eaefb712c3c936dc33fbbe724afc',
  questionDigest: '842527ddfdc7fb706b2fd0af798be286c03aa85b37152a011a8f0affff331c28',
  selectorRawDigest: 'f3bc8dab9cc3de5f8e17b28a461a59f2ae3366f77ba2a2ef68077ebb5c6edf1f',
  questionRawDigest: 'caf52e0bfb5dcbf506705bfbe98d9eee8cbc8fc1d28cf10ad41ea76fa33315ca',
  assertionsDigest: '98340060dc2cc17af874dd4f8152976a9d5f7fd229fd409c6bfd38c3a7dea78f',
  repository: 'https://github.com/apache/ofbiz-framework.git',
  version: 'release24.09.07',
  selector: 'refs/tags/release24.09.07',
  tagObject: '12b6d40382ac38d3252df78781f9877d46f5f9f7',
  commit: '42819e5ae1d5339d3a204ac06b43e69d46a9c0ae',
  immutableSelector: 'tag:12b6d40382ac38d3252df78781f9877d46f5f9f7;commit:42819e5ae1d5339d3a204ac06b43e69d46a9c0ae',
  cap: 20 * 1024 * 1024,
  parser: { id: 'cscl06-exact-byte-parser', version: '1.0.0' },
  canonicalizer: { id: 'cscl06-canonical-json', version: '1.0.0' },
  legal: {
    licenseId: 'Apache-2.0',
    licenseSha256: '98ea9a04fd3da336cbc8b09bd8362a177fe3296d4f15bedcb908ae1017a94021',
    noticeSha256: '940993239ad83e55d0bb49dab870d548249b91c690d63e180c3eee0305060e34',
  },
});

const memberDigests = new Map(Object.entries({
  'LICENSE': ['12097', '98ea9a04fd3da336cbc8b09bd8362a177fe3296d4f15bedcb908ae1017a94021'],
  'NOTICE': ['166', '940993239ad83e55d0bb49dab870d548249b91c690d63e180c3eee0305060e34'],
  'applications/datamodel/entitydef/party-entitymodel.xml': ['154245', 'faa79dfd90fb1403b0b3012002881f94101bb2d138e801e532c63e0ce3d6ccb5'],
  'applications/datamodel/entitydef/product-entitymodel.xml': ['273984', '9821c27fd5b00f6f7fc7f6be99a475d6a07a94fc8c42fb1cdb2454f0e0449341'],
  'applications/datamodel/entitydef/order-entitymodel.xml': ['158309', 'f2ab886b766185ceeaae52c0124d90c3bf2caa2cab45afbba3c8ece5f7d4a976'],
  'applications/datamodel/data/seed/PartySeedData.xml': ['50115', '7858558668cc3d10a310061c96c506c1babae6c432e8a6ce7162e07017f8a227'],
  'applications/datamodel/data/seed/ProductSeedData.xml': ['83134', 'ddb97b5d8a0ea68e9b037712bfd78a6e9b8a8c33be424323ba503c06d2d4b076'],
  'applications/datamodel/data/seed/OrderSeedData.xml': ['42033', 'ad6be0c9c7f6d58dac59aa189972096b3ae06155b99f2dbc514bc3527d603c79'],
  'applications/party/servicedef/services.xml': ['112366', '4014d63d9e8ea2a94e271a6ace4c18ae1aedce0bfca50e2709bb71808c516d12'],
  'applications/party/servicedef/services_party.xml': ['8954', '5c2f21cafb83678fa64acf98c7cde8fdc6ffb5466fd9c54669a4e3b4a51a4845'],
  'applications/party/src/docs/asciidoc/party.adoc': ['3339', '7117a71f31d280f89ac6c8b1acaa424fc55961510117d47e797d73eb78c22c3b'],
  'applications/product/servicedef/services.xml': ['128825', '69f806fd192cf9a66b651dc5295c29fde1eebea2fac439ed3c691caad55393d6'],
  'applications/product/src/docs/asciidoc/product.adoc': ['3340', 'f22e9bd488594839ed2ed89976826db9c651772d808673e58517063cb7a708ac'],
  'applications/order/servicedef/services.xml': ['112722', 'ea50e28f8256c8fdd4f71ef1cd20d16c4b56cec9c5e4edf2930bf7887f844151'],
  'applications/order/servicedef/services_order.xml': ['20379', '028bb94c5b0727b3e524d09eac96c05b2b90b068fd45223ab2440afc1363235e'],
  'applications/order/src/docs/asciidoc/order.adoc': ['8681', 'bde85a9bad40fdf9ed103cfb4288a6b95022eaa2a5044c9ee0efc49b40e432f5'],
  'applications/order/src/docs/asciidoc/_include/order-status-diagrams.adoc': ['1865', '1cbcb6936543dfc72da17d996264dc4fd1749585749d395333f7f163d35729a9'],
  'applications/order/src/docs/asciidoc/_include/order-create-order-diagrams.adoc': ['2908', '517d8990f255d2eb1460c24870f45309e1b924bcaf79607555a6ee134073d83e'],
}));

const familySlugs = new Map([
  ['PARTY_CUSTOMER_MANAGEMENT', 'party-customer-management'],
  ['PRODUCT_ITEM_MANAGEMENT', 'product-item-management'],
  ['SALES_ORDER_MANAGEMENT', 'sales-order-management'],
]);
const questionIds = ['objects-roles', 'relations', 'operations', 'inputs-outputs', 'states-transitions', 'events', 'preconditions', 'invariants', 'exceptions-errors', 'readbacks', 'api-service-exposure', 'absence-ambiguity-conflict'];
const allowedStates = new Set(['SUPPORTED', 'VARIANT', 'ABSENT', 'AMBIGUOUS', 'CONFLICTING', 'UNMAPPED']);

function fail(code, message = code) {
  const error = new Error(message);
  error.code = code;
  throw error;
}

function assertClosed(record, keys, code = 'EXTRA_FIELD') {
  if (!record || typeof record !== 'object' || Array.isArray(record)) fail(code);
  const actual = Object.keys(record).sort();
  const expected = [...keys].sort();
  if (actual.length !== expected.length || actual.some((key, i) => key !== expected[i])) fail(code);
}

function assertBoundary(value) {
  assertClosed(value, Object.keys(boundary));
  if (canonicalJson(value) !== canonicalJson(boundary)) fail('BOUNDARY_DRIFT');
}

export function canonicalJson(value) {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonicalJson(value[key])}`).join(',')}}`;
}

function digestRecord(record, digestKey) {
  const unsigned = { ...record };
  delete unsigned[digestKey];
  return sha256(Buffer.from(canonicalJson(unsigned)));
}

function strictBase64(text) {
  if (typeof text !== 'string' || text.length === 0 || text.length % 4 !== 0 || !/^[A-Za-z0-9+/]*={0,2}$/.test(text)) fail('BASE64_DRIFT');
  const bytes = Buffer.from(text, 'base64');
  if (bytes.toString('base64') !== text) fail('BASE64_DRIFT');
  return bytes;
}

function validateSourceIdentity(corpus) {
  assertClosed(corpus, ['schemaVersion', 'source', 'legal', 'captureCapBytes', 'encoding', 'members', 'boundary']);
  assertClosed(corpus.source, ['kind', 'officialRepository', 'version', 'selector', 'tagObject', 'commit']);
  const expectedSource = {
    kind: 'ANNOTATED_GIT_TAG_AND_PEELED_COMMIT', officialRepository: frozen.repository,
    version: frozen.version, selector: frozen.selector, tagObject: frozen.tagObject, commit: frozen.commit,
  };
  if (canonicalJson(corpus.source) !== canonicalJson(expectedSource)) fail('SOURCE_IDENTITY_DRIFT');
  if (corpus.source.tagObject === corpus.source.commit) fail('SOURCE_IDENTITY_DRIFT');
  assertClosed(corpus.legal, ['licenseId', 'licensePath', 'licenseBytes', 'licenseSha256', 'noticePath', 'noticeBytes', 'noticeSha256', 'obligations']);
  if (corpus.legal.licenseId !== frozen.legal.licenseId || corpus.legal.licensePath !== 'LICENSE' || corpus.legal.licenseBytes !== 12097 || corpus.legal.licenseSha256 !== frozen.legal.licenseSha256 || corpus.legal.noticePath !== 'NOTICE' || corpus.legal.noticeBytes !== 166 || corpus.legal.noticeSha256 !== frozen.legal.noticeSha256) fail('LEGAL_DRIFT');
  if (canonicalJson(corpus.legal.obligations) !== canonicalJson(['PRESERVE_LICENSE', 'PRESERVE_NOTICE_AND_ATTRIBUTION', 'MARK_MODIFIED_FILES', 'STATE_CHANGES'])) fail('LEGAL_DRIFT');
  if (corpus.schemaVersion !== 'pansphaira.cscl06/official-source-corpus/v1' || corpus.encoding !== 'BASE64_RAW_MEMBER_BYTES') fail('SOURCE_IDENTITY_DRIFT');
  if (corpus.captureCapBytes !== frozen.cap) fail('CAP_DRIFT');
  assertBoundary(corpus.boundary);
}

function decodeCorpus(corpus) {
  validateSourceIdentity(corpus);
  if (!Array.isArray(corpus.members)) fail('OFFICIAL_MEMBER_DRIFT');
  const paths = corpus.members.map((member) => member?.path);
  if (new Set(paths).size !== paths.length) fail('DUPLICATE_MEMBER');
  if (corpus.members.length !== memberDigests.size) fail('OFFICIAL_MEMBER_DRIFT');
  const decoded = new Map();
  let totalRawBytes = 0;
  for (const member of corpus.members) {
    assertClosed(member, ['path', 'byteLength', 'sha256', 'base64']);
    if (typeof member.path !== 'string' || member.path.startsWith('/') || member.path.includes('..') || member.path.includes('\\')) fail('PATH_DRIFT');
    if (decoded.has(member.path)) fail('DUPLICATE_MEMBER');
    const fixed = memberDigests.get(member.path);
    if (!fixed) fail('PATH_DRIFT');
    const bytes = strictBase64(member.base64);
    if (member.byteLength !== bytes.length || member.sha256 !== sha256(bytes)) fail('BASE64_DRIFT');
    if (String(member.byteLength) !== fixed[0] || member.sha256 !== fixed[1]) fail('OFFICIAL_MEMBER_DRIFT');
    decoded.set(member.path, bytes);
    totalRawBytes += bytes.length;
  }
  if ([...memberDigests.keys()].some((path) => !decoded.has(path))) fail('OFFICIAL_MEMBER_DRIFT');
  if (totalRawBytes > frozen.cap) fail('CAP_EXCEEDED');
  return { decoded, totalRawBytes };
}

function validateProtocolBytes(selectorBytes, questionBytes) {
  if (!Buffer.isBuffer(selectorBytes) && !(selectorBytes instanceof Uint8Array)) fail('PROTOCOL_DRIFT');
  if (!Buffer.isBuffer(questionBytes) && !(questionBytes instanceof Uint8Array)) fail('PROTOCOL_DRIFT');
  if (sha256(selectorBytes) !== frozen.selectorRawDigest || sha256(questionBytes) !== frozen.questionRawDigest) fail('PROTOCOL_DRIFT');
  const selectors = JSON.parse(Buffer.from(selectorBytes));
  const questions = JSON.parse(Buffer.from(questionBytes));
  if (sha256(Buffer.from(canonicalJson(selectors))) !== frozen.selectorDigest || sha256(Buffer.from(canonicalJson(questions))) !== frozen.questionDigest) fail('PROTOCOL_DRIFT');
  const source = selectors.systems.find((system) => system.id === 'apache-ofbiz')?.source;
  if (!source || source.tagObject !== frozen.tagObject || source.commit !== frozen.commit || source.officialRepository !== frozen.repository) fail('PROTOCOL_DRIFT');
  if (canonicalJson(questions.questions.map(({ id }) => id)) !== canonicalJson(questionIds)) fail('PROTOCOL_DRIFT');
}

function validateAssertions(assertions, decoded) {
  assertClosed(assertions, ['schemaVersion', 'parser', 'canonicalizer', 'cells', 'boundary']);
  assertClosed(assertions.parser, ['id', 'version']);
  assertClosed(assertions.canonicalizer, ['id', 'version']);
  if (canonicalJson(assertions.parser) !== canonicalJson(frozen.parser) || canonicalJson(assertions.canonicalizer) !== canonicalJson(frozen.canonicalizer)) fail('PARSER_DRIFT');
  assertBoundary(assertions.boundary);
  if (assertions.schemaVersion !== 'pansphaira.cscl06/source-native-assertions/v1') fail('ASSERTION_DRIFT');
  if (!Array.isArray(assertions.cells) || assertions.cells.length !== 36) fail('CELL_COVERAGE');
  const expectedKeys = [];
  for (const family of familySlugs.keys()) for (const question of questionIds) expectedKeys.push(`${family}:${question}`);
  const actualKeys = [];
  for (const cell of assertions.cells) {
    assertClosed(cell, ['capabilityFamily', 'questionId', 'state', 'claim', 'evidence', 'counterexamples']);
    if (!familySlugs.has(cell.capabilityFamily) || !questionIds.includes(cell.questionId) || !allowedStates.has(cell.state)) fail('CELL_COVERAGE');
    actualKeys.push(`${cell.capabilityFamily}:${cell.questionId}`);
    if (typeof cell.claim !== 'string' || !cell.claim.trim()) fail('NORMALIZED_OR_UNEVIDENCED_CLAIM');
    if (/business partner|stock keeping unit|customer master|cross[- ]system|normalized across erp/i.test(cell.claim)) fail('NORMALIZED_OR_UNEVIDENCED_CLAIM');
    if (!Array.isArray(cell.evidence) || cell.evidence.length < 1 || cell.evidence.length > 4) fail('MISSING_EVIDENCE');
    if (!Array.isArray(cell.counterexamples)) fail('MISSING_COUNTEREVIDENCE');
    if ((cell.state === 'ABSENT' || cell.state === 'CONFLICTING') && cell.counterexamples.length === 0) fail('MISSING_COUNTEREVIDENCE');
    for (const evidence of cell.evidence) {
      assertClosed(evidence, ['path', 'excerpt', 'nativeTerms']);
      const bytes = decoded.get(evidence.path);
      if (!bytes) fail('PATH_DRIFT');
      if (typeof evidence.excerpt !== 'string' || !evidence.excerpt) fail('MISSING_EVIDENCE');
      const excerpt = Buffer.from(evidence.excerpt);
      const start = bytes.indexOf(excerpt);
      if (start < 0 || bytes.indexOf(excerpt, start + 1) >= 0) fail('LOCATOR_DRIFT');
      if (!Array.isArray(evidence.nativeTerms) || evidence.nativeTerms.length === 0 || evidence.nativeTerms.some((term) => typeof term !== 'string' || !evidence.excerpt.includes(term))) fail('NORMALIZED_OR_UNEVIDENCED_CLAIM');
    }
  }
  if (canonicalJson(actualKeys) !== canonicalJson(expectedKeys)) fail('CELL_COVERAGE');
  const productBytes = decoded.get('applications/datamodel/entitydef/product-entitymodel.xml').toString('utf8');
  const productStart = productBytes.indexOf('    <entity entity-name="Product"');
  const productEnd = productBytes.indexOf('    </entity>', productStart);
  if (productStart < 0 || productEnd < 0 || /<field name="statusId"/.test(productBytes.slice(productStart, productEnd))) fail('NEGATIVE_EVIDENCE_DRIFT');
  if (sha256(Buffer.from(canonicalJson(assertions))) !== frozen.assertionsDigest) fail('ASSERTION_DRIFT');
}

function legalRecord(corpus) {
  return {
    licenseId: corpus.legal.licenseId,
    licenseSha256: corpus.legal.licenseSha256,
    obligations: [...corpus.legal.obligations],
    noticeStatus: 'PRESENT',
    noticeUrl: `https://raw.githubusercontent.com/apache/ofbiz-framework/${frozen.commit}/NOTICE`,
    noticeBytes: corpus.legal.noticeBytes,
    noticeSha256: corpus.legal.noticeSha256,
    attribution: [],
  };
}

export function buildApacheOfbizProfile({ selectorBytes, questionBytes, corpus, assertions }) {
  validateProtocolBytes(selectorBytes, questionBytes);
  const { decoded, totalRawBytes } = decodeCorpus(corpus);
  validateAssertions(assertions, decoded);
  const facts = [];
  const cells = [];
  const evidenceCellRefs = [];
  const terminology = [];
  const noCandidateMeaningSha256 = sha256(Buffer.from('CSCL-07_CANDIDATE_MEANING_NOT_DERIVED'));

  for (const assertion of assertions.cells) {
    const slug = familySlugs.get(assertion.capabilityFamily);
    const combinedQuestionId = `${slug}--${assertion.questionId}`;
    const references = [];
    for (const [index, evidence] of assertion.evidence.entries()) {
      const sourceBytes = decoded.get(evidence.path);
      const excerptBytes = Buffer.from(evidence.excerpt);
      const byteStart = sourceBytes.indexOf(excerptBytes);
      const byteEnd = byteStart + excerptBytes.length;
      const excerptSha256 = sha256(excerptBytes);
      const fact = {
        schemaVersion: 'pansphaira.cscl01/source-fact/v1',
        factId: `ofbiz.${slug}.${assertion.questionId}.${index + 1}`,
        systemId: 'apache-ofbiz',
        systemRole: 'TRAINING',
        capabilityFamily: assertion.capabilityFamily,
        questionId: combinedQuestionId,
        claim: assertion.claim,
        sourceIdentity: {
          selectorSetDigest: frozen.selectorDigest,
          immutableSelector: frozen.immutableSelector,
          sourceBytesSha256: sha256(sourceBytes),
        },
        exactEvidence: {
          exactLocator: `${evidence.path}#bytes=${byteStart}-${byteEnd}`,
          excerptSha256,
          byteStart,
          byteEnd,
        },
        legal: legalRecord(corpus),
        parser: { ...frozen.parser },
        canonicalizer: { ...frozen.canonicalizer },
        boundary: { ...boundary },
        factDigest: '',
      };
      fact.factDigest = digestRecord(fact, 'factDigest');
      facts.push(fact);
      references.push({ sourceFactId: fact.factId, exactLocator: fact.exactEvidence.exactLocator, excerptSha256 });
      for (const term of evidence.nativeTerms) terminology.push({ term, meaning: assertion.claim, sourceFactDigest: fact.factDigest });
    }
    const nativeMeaningSha256 = sha256(Buffer.from(canonicalJson({ systemId: 'apache-ofbiz', capabilityFamily: assertion.capabilityFamily, questionId: assertion.questionId, state: assertion.state, claim: assertion.claim })));
    const cell = {
      schemaVersion: 'pansphaira.cscl01/evidence-cell/v1',
      systemId: 'apache-ofbiz',
      questionId: combinedQuestionId,
      state: assertion.state,
      equivalenceProof: { nativeMeaningSha256, candidateMeaningSha256: noCandidateMeaningSha256 },
      evidence: references,
      counterexamples: [...assertion.counterexamples],
      boundary: { ...boundary },
    };
    const cellDigest = sha256(Buffer.from(canonicalJson(cell)));
    cells.push(cell);
    evidenceCellRefs.push({ capabilityFamily: assertion.capabilityFamily, questionId: combinedQuestionId, cellDigest });
  }

  const profile = {
    schemaVersion: 'pansphaira.cscl01/system-profile/v1',
    profileId: 'apache-ofbiz-release24.09.07-source-native-profile-v1',
    systemId: 'apache-ofbiz',
    systemRole: 'TRAINING',
    selectorSetDigest: frozen.selectorDigest,
    questionInventoryDigest: frozen.questionDigest,
    sourceFactDigests: facts.map(({ factDigest }) => factDigest),
    sourceNativeTerminology: terminology,
    capabilityFamilies: [...familySlugs.keys()],
    evidenceCells: evidenceCellRefs,
    holdoutIsolation: 'TRAINING_PROFILE',
    boundary: { ...boundary },
    profileDigest: '',
  };
  profile.profileDigest = digestRecord(profile, 'profileDigest');
  const stateCount = (state) => cells.filter((cell) => cell.state === state).length;
  return {
    schemaVersion: 'pansphaira.cscl06/apache-ofbiz-profile-build/v1',
    source: { ...corpus.source },
    corpus: { members: corpus.members.map(({ path, byteLength, sha256: digest }) => ({ path, byteLength, sha256: digest })), totalRawBytes, capBytes: frozen.cap },
    facts,
    cells,
    profile,
    noCandidateMeaningSha256,
    counts: {
      families: familySlugs.size, questions: questionIds.length, facts: facts.length, cells: cells.length,
      supported: stateCount('SUPPORTED'), absent: stateCount('ABSENT'), ambiguous: stateCount('AMBIGUOUS'), conflicting: stateCount('CONFLICTING'), corpusMembers: corpus.members.length,
    },
    nonclaims: ['NO_CROSS_SYSTEM_CONCEPT_DERIVED', 'NO_CANDIDATE_MEANING_DERIVED', 'NO_HOLDOUT_INSPECTED', 'NO_AUTHORITY_PROMOTION_OR_EXECUTION_GRANT'],
    boundary: { ...boundary },
  };
}

export function validateOfflineReplay(inputs, options = {}) {
  void options.fetch;
  const first = buildApacheOfbizProfile(inputs);
  const second = buildApacheOfbizProfile(structuredClone(inputs));
  return { offline: true, byteIdentical: canonicalJson(first) === canonicalJson(second), totalRawBytes: first.corpus.totalRawBytes, buildDigest: sha256(Buffer.from(canonicalJson(first))) };
}

export const frozenApacheOfbizIdentity = Object.freeze({ ...frozen });
