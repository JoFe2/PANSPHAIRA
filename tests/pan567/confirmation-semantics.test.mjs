// Original #567 B1 explicit confirmation semantics on the REAL native565
// synthetic fixture and the REAL #563 durable draft store. This journey closes
// the three owner behaviours no accepted dialogue/browser journey ever
// executed: (a) an explicit SUBSET confirmation of a genuine two-question
// draft — the rejected proposed field stays an ACTUAL open question and the
// accepted subset becomes one versioned delta
// (configuration-proposal-owner.mjs:128-130 maps only acceptedFields through
// the existing answers path; B1-AC03 "bestätigte Antwort, anschließend
// versionierter Deltaentwurf", UIDOD-02 proposal/decision/effect separated);
// (b) a confirm naming a field that is NOT part of the proposal denies
// PROPOSAL_FIELD_DENIED, consumes the single-use pending record, writes
// nothing and dispatches nothing — only a fresh explicit request recovers
// (configuration-proposal-owner.mjs:120-122; B1-AC04 and UIDOD-03 "kein
// blinder Mutationretry"); (c) a proposal request against a fully resolved
// registered draft denies before the transport: zero provider traffic, no
// consent or budget consumed (configuration-proposal-owner.mjs:79; A4-AC05,
// B1-AC01). Synthetic transport only — never a real-model acceptance claim
// (AC01/AC06 stay NOT_RUN/blocked/open).
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { nativeFixture565 } from '../pan565/native-fixture.mjs';
import { createNativeConfigurationProposalModelV1, MODEL_CONNECTION_PROPOSAL_PURPOSE_V1 } from '../../src/pan565/native-model-connection.mjs';
import { createNativeConfigurationProposalOwnerV1 } from '../../src/pan567/configuration-proposal-owner.mjs';
import { createAgentConfigurationDraftStoreV1 } from '../../src/pan563/draft-store.mjs';
import { pan441EmployeeProfileV1 } from '../../dist/packages/contracts/src/pan441-employee-profile.js';
import { bindRuntimeTemplateV1 } from '../../src/pan529/runtime-template-contract.mjs';
import { shapeIdentity527 } from '../pan527/helpers.mjs';

const proposeCommand = (revision, intent) => ({ schemaVersion: 'pansphaira.agent-configuration/proposal-request/v1', expectedRevision: revision, confirm: true, intent });
const confirmCommand = (revision, proposalDigest, acceptedFields) => ({ schemaVersion: 'pansphaira.agent-configuration/proposal-confirm/v1', expectedRevision: revision, proposalDigest, acceptedFields, confirm: true });
const answers = (revision, list) => ({ schemaVersion: 'pansphaira.agent-configuration/answers/v1', expectedRevision: revision, answers: list });
// One own fixture per journey: the native565 product grant's unchanged
// limits565 maxRequests=3 ledger is cumulative per owner, so each scenario
// runs on its OWN ledger — no cap raise, no reset, no shared accounting.
async function proposalFixture(tag) {
  const f = await nativeFixture565({ alter: o => { o.productGrant.allowedPurposes = [MODEL_CONNECTION_PROPOSAL_PURPOSE_V1]; } });
  const root = mkdtempSync(join(f.tls.root, 'pan567-' + tag + '-'));
  const drafts = createAgentConfigurationDraftStoreV1({ root, profile: pan441EmployeeProfileV1(), template: bindRuntimeTemplateV1(shapeIdentity527('tenant-a')) });
  const owner = createNativeConfigurationProposalOwnerV1({ drafts, binding: f.sessions.binding, model: createNativeConfigurationProposalModelV1(f.owner, f.sessions.binding) });
  await f.prerequisites();
  const principal = f.sessions.authenticate(f.headers);
  return { f, root, drafts, owner, principal,
    async close() { owner.close(); drafts.close(); rmSync(root, { recursive: true, force: true }); await f.close(); } };
}
// The registered draft is brought into its genuine TWO-question state through
// the EXISTING answers path only: goal.purpose starts UNKNOWN; an explicit
// UNKNOWN of access.checkStatus (a registered SYNTHETIC_MODEL-required field
// whose only dependency model.reference is profile-template CONFIRMED) is the
// second ACTUAL open question — no fixture-invented field, no store surgery.
function openTwoQuestions(x) {
  const fresh = x.drafts.read(x.principal);
  assert.deepEqual(fresh.questions.map(q => q.field), ['goal.purpose'], 'the fresh registered draft asks exactly the one profile-unresolved goal.purpose');
  const saved = x.drafts.save(answers(fresh.revision, [{ field: 'access.checkStatus', value: null, confirmation: 'UNKNOWN' }]), x.principal);
  assert.deepEqual([...saved.questions.map(q => q.field)].sort(), ['access.checkStatus', 'goal.purpose'], 'two ACTUAL open questions answered through the existing answers path');
  return saved;
}
function assertInertMinimizedTransport(f, intentLiteral) {
  const dispatched = f.server.observations.filter(o => o.method === 'POST').at(-1);
  const bodyText = JSON.stringify(dispatched.body);
  assert.ok(bodyText.includes(intentLiteral), 'the registered user intent travels inside the minimized context');
  assert.ok(bodyText.includes('pansphaira.agent-configuration/proposal-context/v1'), 'the minimized server-built context travels as inert data');
  assert.equal(bodyText.includes('SYNTHETIC_PRIVATE_FILE_CANARY'), false, 'no secret material to the transport body');
}

test('#567 subset confirmation: bounded two-field proposal on two ACTUAL open questions; the explicitly accepted subset becomes one versioned delta, the rejected field stays an ACTUAL open question with nothing written; one dispatch total', async () => {
  const x = await proposalFixture('confirm-subset');
  try {
    const opened = openTwoQuestions(x);
    x.f.server.setResponseText(JSON.stringify({
      schemaVersion: 'pansphaira.agent-configuration/proposal/v1', capabilityReference: 'configuration.onboarding.propose/v1', expectedRevision: opened.revision,
      proposals: [
        { field: 'goal.purpose', value: 'employee.directory.summary', rationale: 'Beide Zwecke sind zugelassen; dieser passt zur gelesenen Absicht.' },
        { field: 'access.checkStatus', value: 'NOT_RUN', rationale: 'Die Verbindungsprüfung wurde in diesem Entwurf noch nicht ausgeführt.' },
      ],
      clarifications: [{ field: 'goal.purpose', question: 'Darf der Zweck später erneut bestätigt werden?' }],
    }));
    const postsBefore = x.f.server.post();
    const proposed = await x.owner.handle(x.principal, x.f.headers, proposeCommand(opened.revision, 'Zwei offene Werte vorschlagen, aber nur einen ausdrücklich bestätigen.'));
    assert.equal(proposed.outcome, 'PROPOSED');
    assert.equal(proposed.proposal.proposals.length, 2, 'the closed proposal covers BOTH actual open questions');
    assert.equal(x.f.server.post(), postsBefore + 1, 'exactly one synthetic proposal dispatch');
    assertInertMinimizedTransport(x.f, 'Zwei offene Werte vorschlagen, aber nur einen ausdrücklich bestätigen.');
    assert.equal(x.drafts.read(x.principal).revision, opened.revision, 'a proposal never writes by itself');
    // The user's explicit DECISION accepts only ONE of the two proposed
    // fields — proposal, decision and effect stay separate (UIDOD-02).
    const confirmed = await x.owner.handle(x.principal, x.f.headers, confirmCommand(opened.revision, proposed.proposal.proposalDigest, ['access.checkStatus']));
    assert.equal(confirmed.outcome, 'APPLIED');
    assert.equal(confirmed.newRevision, opened.revision + 1, 'the accepted subset is exactly ONE versioned delta on the SAME draft');
    assert.equal(x.f.server.post(), postsBefore + 1, 'confirmation wrote through the existing draft store, not through a second model request');
    const after = x.drafts.read(x.principal);
    assert.equal(after.draft.fields['access.checkStatus'].confirmation, 'CONFIRMED');
    assert.equal(after.draft.fields['access.checkStatus'].value, 'NOT_RUN', 'exactly the accepted proposed value persisted');
    assert.equal(after.draft.fields['goal.purpose'].value, null, 'the REJECTED proposal field received no silent write');
    assert.equal(after.draft.fields['goal.purpose'].confirmation, 'UNKNOWN');
    assert.deepEqual(after.questions.map(q => q.field), ['goal.purpose'], 'the rejected field remains an ACTUAL open question for manual non-AI continuation');
    assert.equal(confirmed.draftRetained, true); assert.equal(confirmed.activationAuthorized, false); assert.equal(confirmed.realModelAcceptance, false);
  } finally { await x.close(); }
});

test('#567 denied field in confirm: a clarification-only field is not writable — PROPOSAL_FIELD_DENIED consumes the single-use pending, writes and dispatches nothing; only a fresh explicit request recovers; no blind retry', async () => {
  const x = await proposalFixture('confirm-fielddenied');
  try {
    const opened = openTwoQuestions(x);
    x.f.server.setResponseText(JSON.stringify({
      schemaVersion: 'pansphaira.agent-configuration/proposal/v1', capabilityReference: 'configuration.onboarding.propose/v1', expectedRevision: opened.revision,
      proposals: [{ field: 'goal.purpose', value: 'employee.directory.summary', rationale: 'Zugelassener Zweck aus dem minimierten Kontext des Entwurfs.' }],
      clarifications: [{ field: 'access.checkStatus', question: 'Wurde die Verbindungsprüfung bewusst noch nicht ausgeführt?' }],
    }));
    const postsBefore = x.f.server.post();
    const proposed = await x.owner.handle(x.principal, x.f.headers, proposeCommand(opened.revision, 'Ein Vorschlag mit echter Rückfrage auf das zweite offene Feld.'));
    assert.equal(proposed.outcome, 'PROPOSED');
    assert.equal(x.f.server.post(), postsBefore + 1);
    // Confirming the CLARIFICATION field names a registered open question
    // that was never proposed: the confirm denies PROPOSAL_FIELD_DENIED and,
    // by the owner's single-use rule, the pending proposal is consumed.
    const denied = await x.owner.handle(x.principal, x.f.headers, confirmCommand(opened.revision, proposed.proposal.proposalDigest, ['access.checkStatus']));
    assert.equal(denied.outcome, 'PROPOSAL_STALE');
    assert.equal(denied.reason, 'PROPOSAL_FIELD_DENIED', 'a clarification is a hint, never a writable proposal entry');
    assert.deepEqual(denied.proposal, proposed.proposal, 'the honest readback still shows the consumed proposal itself');
    assert.equal(denied.draftRetained, true);
    assert.equal(x.drafts.read(x.principal).revision, opened.revision, 'the denied confirm wrote nothing');
    // Re-sending the previously valid confirm must NOT resurrect the consumed
    // record: no blind reuse, no automatic retry, no new dispatch.
    const reused = await x.owner.handle(x.principal, x.f.headers, confirmCommand(opened.revision, proposed.proposal.proposalDigest, ['goal.purpose']));
    assert.equal(reused.outcome, 'PROPOSAL_STALE');
    assert.equal(reused.reason, 'PROPOSAL_STALE_OR_CONSUMED');
    assert.equal(reused.proposal, null, 'a consumed record is honestly gone, not half-alive');
    assert.equal(x.drafts.read(x.principal).revision, opened.revision, 'the reused confirm wrote nothing');
    assert.equal(x.f.server.post(), postsBefore + 1, 'neither denied confirm added provider traffic or a retry');
    // The honest recovery IS a fresh explicit request (second dispatch inside
    // the unchanged grant limit), which then confirms normally through the
    // existing CAS path.
    const fresh = await x.owner.handle(x.principal, x.f.headers, proposeCommand(opened.revision, 'Nach verworfener Bestätigung bewusst neu angefragt.'));
    assert.equal(fresh.outcome, 'PROPOSED');
    assert.equal(x.f.server.post(), postsBefore + 2, 'exactly the two explicit requests, never an automatic third');
    assertInertMinimizedTransport(x.f, 'Nach verworfener Bestätigung bewusst neu angefragt.');
    const applied = await x.owner.handle(x.principal, x.f.headers, confirmCommand(opened.revision, fresh.proposal.proposalDigest, ['goal.purpose']));
    assert.equal(applied.outcome, 'APPLIED');
    assert.equal(applied.newRevision, opened.revision + 1);
    const after = x.drafts.read(x.principal);
    assert.equal(after.draft.fields['goal.purpose'].confirmation, 'CONFIRMED');
    assert.equal(after.draft.fields['goal.purpose'].value, 'employee.directory.summary');
    assert.equal(after.draft.fields['access.checkStatus'].confirmation, 'UNKNOWN', 'the clarified field stays untouched for the manual same-draft answer');
  } finally { await x.close(); }
});

test('#567 fully resolved draft: a proposal request denies ALL_QUESTIONS_RESOLVED BEFORE the transport — zero provider traffic, nothing consumed, revision and readback flags unchanged', async () => {
  const x = await proposalFixture('confirm-resolved');
  try {
    const fresh = x.drafts.read(x.principal);
    // Resolve the registered draft through the SAME existing answers path the
    // A2 owner enforces (both ALWAYS-required unresolved fields, one batch).
    const resolved = x.drafts.save(answers(fresh.revision, [
      { field: 'goal.purpose', value: 'employee.business.help', confirmation: 'CONFIRM' },
      { field: 'data.fields', value: ['displayName'], confirmation: 'CONFIRM' },
    ]), x.principal);
    assert.equal(resolved.outcome, 'RESOLVED');
    assert.deepEqual(resolved.questions, []);
    const postsBefore = x.f.server.post();
    assert.equal(postsBefore, 0, 'the connection prerequisites of this fixture answered over GETs only — no chat dispatch yet');
    const result = await x.owner.handle(x.principal, x.f.headers, proposeCommand(resolved.revision, 'Der Entwurf ist vollständig — ein Vorschlag wäre überflüssig.'));
    assert.equal(result.outcome, 'NOTHING_TO_PROPOSE');
    assert.equal(result.reason, 'ALL_QUESTIONS_RESOLVED');
    assert.equal(result.expectedRevision, resolved.revision);
    assert.equal(result.newRevision, null);
    assert.equal(result.proposal, null, 'no fabricated proposal for a draft without open questions');
    assert.equal(result.draftRetained, true); assert.equal(result.activationAuthorized, false); assert.equal(result.realModelAcceptance, false);
    assert.equal(x.f.server.post(), postsBefore, 'the denied request never reached the transport — no cost, no consent consumption');
    assert.equal(x.drafts.read(x.principal).revision, resolved.revision, 'the resolved draft stayed byte-identical');
  } finally { await x.close(); }
});
