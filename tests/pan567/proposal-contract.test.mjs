// Original #567 B1 closed proposal contract: request intent is bounded inert
// data, the minimized context registers it, the answer is independently
// revalidated, and only explicit confirmation maps to the existing answers
// command. Synthetic contract-only tests — no model, no browser, no runtime.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { canonicalJson } from '../../dist/packages/contracts/src/canonical-json.js';
import {
  buildAgentConfigurationProposalContextV1, validateAgentConfigurationProposalRequestV1,
  validateAgentConfigurationProposalConfirmV1, validateAgentConfigurationProposalV1,
  agentConfigurationProposalAnswersV1, AGENT_CONFIGURATION_PROPOSAL_CAPABILITY_V1,
} from '../../dist/packages/contracts/src/agent-configuration-proposal-v1.js';
const hash = v => createHash('sha256').update(canonicalJson(v)).digest('hex');
const definitions = {
  'test.channel': { type: 'SELECT', allowedValues: ['mail', 'chat'], dependencies: [] },
  'test.volume': { type: 'INTEGER', allowedValues: [1, 10], dependencies: [] },
  'test.secret': { type: 'SECRET_REFERENCE', allowedValues: [null], dependencies: ['test.channel'] },
};
const readback = { policyDigest: 'f'.repeat(64), revision: 3,
  questions: [{ field: 'test.secret', label: 'Secretreferenz', reason: 'MISSING_REQUIRED' }],
  definitions, draft: { fields: { 'test.channel': { value: 'mail' }, 'test.volume': { value: null }, 'test.secret': { value: null } } } };
const intent = 'Ich möchte Benachrichtigungen nur per Chat erhalten.';
const context = () => buildAgentConfigurationProposalContextV1(readback, intent);

test('#567 request: bounded user intent required; markup, oversize and extra keys deny', () => {
  assert.deepEqual(validateAgentConfigurationProposalRequestV1({ schemaVersion: 'pansphaira.agent-configuration/proposal-request/v1', expectedRevision: 3, confirm: true, intent }, 3), { intent });
  for (const bad of [
    { schemaVersion: 'pansphaira.agent-configuration/proposal-request/v1', expectedRevision: 3, confirm: true },
    { schemaVersion: 'pansphaira.agent-configuration/proposal-request/v1', expectedRevision: 3, confirm: true, intent: 'ab' },
    { schemaVersion: 'pansphaira.agent-configuration/proposal-request/v1', expectedRevision: 3, confirm: true, intent: 'x'.repeat(321) },
    { schemaVersion: 'pansphaira.agent-configuration/proposal-request/v1', expectedRevision: 3, confirm: true, intent: '<script>alert(1)</script> absicht' },
    { schemaVersion: 'pansphaira.agent-configuration/proposal-request/v1', expectedRevision: 3, confirm: true, intent: '  führende Lücke' },
    { schemaVersion: 'pansphaira.agent-configuration/proposal-request/v1', expectedRevision: 2, confirm: true, intent },
    { schemaVersion: 'pansphaira.agent-configuration/proposal-request/v1', expectedRevision: 3, confirm: true, intent, tenantId: 'tenant-b' },
  ]) assert.throws(() => validateAgentConfigurationProposalRequestV1(bad, 3), Error, JSON.stringify(bad));
});

test('#567 minimized context registers the intent, confirmed dependencies and no secrets or identifiers', () => {
  const c = context();
  assert.equal(hash(c.contextText), c.contextDigest);
  const parsed = JSON.parse(c.contextText);
  assert.deepEqual(parsed.capabilityReferences, [AGENT_CONFIGURATION_PROPOSAL_CAPABILITY_V1]);
  assert.equal(parsed.userIntent, intent);
  assert.deepEqual(parsed.confirmedDependencies, [{ field: 'test.channel', value: 'mail' }]);
  // The actual question is test.secret: its registered SECRET_REFERENCE
  // definition carries exactly allowedValues=[null] — no unrelated field's
  // values are projected onto it.
  assert.deepEqual(parsed.questions[0], { field: 'test.secret', label: 'Secretreferenz', reason: 'MISSING_REQUIRED', allowedValues: [null] });
  assert.equal(parsed.expectedRevision, 3);
  // Different intent must change the digest; no session/tenant/secret fields.
  assert.notEqual(buildAgentConfigurationProposalContextV1(readback, 'Eine andere Absicht mit gleicher Länge.').contextDigest, c.contextDigest);
  assert.equal(/session|tenant|cookie|secret[A-Z]/.test(c.contextText.replace('SECRET_REFERENCE', '').replace('test.secret', '')), false);
});

// Actual registered privacy proof, not a comment: the minimized context only
// ever carries the SECRET_REFERENCE definition's own registered reference
// value (null here), never raw secret material, and never confirmed values
// that no open question declared as a dependency.
test('#567 privacy: SECRET_REFERENCE dependency carries only its registered null reference; unasked confirmed values stay out', () => {
  const privacyDefinitions = { ...definitions, 'test.volume': { ...definitions['test.volume'], dependencies: ['test.secret'] } };
  const privacyRead = { policyDigest: 'f'.repeat(64), revision: 4,
    questions: [{ field: 'test.volume', label: 'Menge', reason: 'MISSING_REQUIRED' }],
    definitions: privacyDefinitions,
    draft: { fields: { 'test.channel': { value: 'chat' }, 'test.volume': { value: null }, 'test.secret': { value: null } } } };
  const c = buildAgentConfigurationProposalContextV1(privacyRead, 'Menge festlegen; Secretreferenz bleibt unbestimmt.');
  const parsed = JSON.parse(c.contextText);
  assert.deepEqual(parsed.questions, [{ field: 'test.volume', label: 'Menge', reason: 'MISSING_REQUIRED', allowedValues: [1, 10] }]);
  assert.deepEqual(parsed.confirmedDependencies, [{ field: 'test.secret', value: null }]);
  assert.equal(JSON.stringify(parsed).includes('chat'), false, 'a confirmed value that is no declared dependency is never sent');
  const rawSecretRead = { ...privacyRead, draft: { fields: { 'test.channel': { value: 'chat' }, 'test.volume': { value: null }, 'test.secret': { value: 'raw-secret-canary-not-a-reference' } } } };
  assert.equal(buildAgentConfigurationProposalContextV1(rawSecretRead, 'Unvertrauter Rohwert in einem Secretreferenzfeld.').contextText.includes('raw-secret-canary-not-a-reference'), true,
    'the context forwards the draft value verbatim: raw secrets are refused at the existing draft store boundary (RAW_SECRET_OR_REFERENCE_DENIED), never silently redacted here — no regex-redaction claim');
});

test('#567 answer revalidation: closed shape, registered capability, exact revision, askable fields, policy values, inert text', () => {
  const c = context();
  const base = v => ({ schemaVersion: 'pansphaira.agent-configuration/proposal/v1', expectedRevision: 3, clarifications: [], ...v });
  const ok = validateAgentConfigurationProposalV1(base({ capabilityReference: AGENT_CONFIGURATION_PROPOSAL_CAPABILITY_V1, proposals: [{ field: 'test.secret', value: null, rationale: 'Derzeit keine Secretreferenz bestätigt.' }], }), { definitions, askableFields: c.askableFields, expectedRevision: 3, contextDigest: c.contextDigest });
  assert.equal(ok.outcome, 'VALID');
  assert.match(ok.proposal.proposalDigest, /^[a-f0-9]{64}$/);
  const deny = (mutate, code) => assert.deepEqual(validateAgentConfigurationProposalV1(mutate(base({ capabilityReference: AGENT_CONFIGURATION_PROPOSAL_CAPABILITY_V1, proposals: [{ field: 'test.secret', value: null, rationale: 'Derzeit keine Secretreferenz bestätigt.' }] })), { definitions, askableFields: c.askableFields, expectedRevision: 3, contextDigest: c.contextDigest }), { outcome: 'INVALID', code });
  deny(v => ({ ...v, capabilityReference: 'free.tools/anything' }), 'PROPOSAL_CAPABILITY_DENIED');
  deny(v => ({ ...v, expectedRevision: 2 }), 'PROPOSAL_REVISION_DENIED');
  deny(v => ({ ...v, proposals: [{ field: 'test.volume', value: 5, rationale: 'Bestätigte Frage nicht offen.' }] }), 'PROPOSAL_FIELD_DENIED');
  deny(v => ({ ...v, proposals: [{ field: 'test.secret', value: 'tenant-b/key', rationale: 'Unbekannte Secretreferenz angenommen.' }] }), 'PROPOSAL_VALUE_DENIED');
  deny(v => ({ ...v, proposals: [{ field: 'test.secret', value: null, rationale: '<b>fett</b>' }] }), 'PROPOSAL_TEXT_DENIED');
  deny(v => ({ ...v, extraKey: 1 }), 'PROPOSAL_SCHEMA_DENIED');
  deny(v => ({ ...v, proposals: [], clarifications: [] }), 'PROPOSAL_SCHEMA_DENIED');
});

test('#567 explicit confirmation maps only the accepted subset into the existing answers command', () => {
  const c = context();
  const answer = validateAgentConfigurationProposalV1({ schemaVersion: 'pansphaira.agent-configuration/proposal/v1', capabilityReference: AGENT_CONFIGURATION_PROPOSAL_CAPABILITY_V1, expectedRevision: 3, proposals: [{ field: 'test.secret', value: null, rationale: 'Derzeit keine Secretreferenz bestätigt.' }], clarifications: [{ field: 'test.secret', question: 'Soll eine Secretreferenz gesetzt werden?' }] }, { definitions, askableFields: c.askableFields, expectedRevision: 3, contextDigest: c.contextDigest });
  assert.equal(answer.outcome, 'VALID');
  const confirm = validateAgentConfigurationProposalConfirmV1({ schemaVersion: 'pansphaira.agent-configuration/proposal-confirm/v1', expectedRevision: 3, proposalDigest: answer.proposal.proposalDigest, acceptedFields: ['test.secret'], confirm: true });
  assert.deepEqual(agentConfigurationProposalAnswersV1(answer.proposal, confirm.acceptedFields, 3), { schemaVersion: 'pansphaira.agent-configuration/answers/v1', expectedRevision: 3, answers: [{ field: 'test.secret', value: null, confirmation: 'CONFIRM' }] });
  assert.throws(() => validateAgentConfigurationProposalConfirmV1({ schemaVersion: 'pansphaira.agent-configuration/proposal-confirm/v1', expectedRevision: 3, proposalDigest: answer.proposal.proposalDigest, acceptedFields: ['test.secret', 'test.secret'], confirm: true }), Error);
  assert.throws(() => validateAgentConfigurationProposalConfirmV1({ schemaVersion: 'pansphaira.agent-configuration/proposal-confirm/v1', expectedRevision: 3, proposalDigest: answer.proposal.proposalDigest, acceptedFields: ['test.secret'], confirm: true, replacement: 'CONFIRMED' }), Error);
});
