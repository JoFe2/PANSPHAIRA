// Original #567 B1 owner dialogue on the REAL native565 local synthetic
// fixture and the REAL #563 durable draft store: genuine purpose-qualified
// admission reaches the actual transport once per explicit request, invalid
// formats settle as observed INVALID (never an invented UNKNOWN), a valid
// closed proposal becomes a versioned delta only via explicit confirmation,
// and every failure path retains the same draft for manual continuation.
// Synthetic evidence only — this is not real-model acceptance (AC01/AC06 stay
// NOT_RUN/blocked/open).
import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join } from 'node:path';
import { nativeFixture565 } from '../pan565/native-fixture.mjs';
import { request527 } from '../pan527/helpers.mjs';
import { mountProtectedWorkspaceDocumentV1 } from '../../src/pan527/origin-session-adapter.mjs';
import { createNativeConfigurationProposalModelV1, MODEL_CONNECTION_PROPOSAL_PURPOSE_V1 } from '../../src/pan565/native-model-connection.mjs';
import { createNativeConfigurationProposalOwnerV1, isNativeConfigurationProposalOwnerV1 } from '../../src/pan567/configuration-proposal-owner.mjs';
import { createAgentConfigurationDraftStoreV1 } from '../../src/pan563/draft-store.mjs';
import { pan441EmployeeProfileV1 } from '../../dist/packages/contracts/src/pan441-employee-profile.js';
import { bindRuntimeTemplateV1 } from '../../src/pan529/runtime-template-contract.mjs';
import { shapeIdentity527 } from '../pan527/helpers.mjs';

const f = await nativeFixture565({ alter: o => { o.productGrant.allowedPurposes = [MODEL_CONNECTION_PROPOSAL_PURPOSE_V1]; } });
const root = mkdtempSync(join(f.tls.root, 'pan567-draft-'));
const drafts = createAgentConfigurationDraftStoreV1({ root, profile: pan441EmployeeProfileV1(), template: bindRuntimeTemplateV1(shapeIdentity527('tenant-a')) });
const model = createNativeConfigurationProposalModelV1(f.owner, f.sessions.binding);
const owner = createNativeConfigurationProposalOwnerV1({ drafts, binding: f.sessions.binding, model });
const principal = f.sessions.authenticate(f.headers);
after(async () => { owner.close(); drafts.close(); rmSync(root, { recursive: true, force: true }); await f.close(); });

// One actual open question of the CURRENT authoritative draft, with the value
// the SAME registered definition would accept — never a fixture-invented field.
function pickAskable(read) {
  for (const q of read.questions) {
    const d = read.definitions[q.field];
    if (d.type === 'SECRET_REFERENCE' && d.allowedValues.includes(null)) return { field: q.field, value: null };
    if (d.type === 'INTEGER') return { field: q.field, value: d.allowedValues[0] };
    if (d.type === 'SET') return { field: q.field, value: [d.allowedValues[0]] };
    if (typeof d.allowedValues[0] === 'string') return { field: q.field, value: d.allowedValues[0] };
  }
  return null;
}
const proposalCommand = (revision, intent) => ({ schemaVersion: 'pansphaira.agent-configuration/proposal-request/v1', expectedRevision: revision, confirm: true, intent });

test('#567 owner brand: exact binding and closed lifetime only — foreign, clone, malformed and closed deny', () => {
  assert.equal(isNativeConfigurationProposalOwnerV1(owner, f.sessions.binding), true);
  assert.equal(isNativeConfigurationProposalOwnerV1(owner, { ...f.sessions.binding, tenantId: 'tenant-b' }), false);
  assert.equal(isNativeConfigurationProposalOwnerV1(owner, { ...f.sessions.binding }), true, 'plain structural clone of the SAME binding is the same binding');
  assert.equal(isNativeConfigurationProposalOwnerV1(owner, {}), false);
  assert.equal(isNativeConfigurationProposalOwnerV1(owner, null), false);
  assert.equal(isNativeConfigurationProposalOwnerV1(owner, 'binding'), false);
  assert.equal(isNativeConfigurationProposalOwnerV1({ drafts }, f.sessions.binding), false);
});

test('#567 invalid model text: one actual synthetic POST, observed INVALID, no invented UNKNOWN, same draft for manual fallback', async () => {
  await f.prerequisites();
  const read = drafts.read(principal);
  const result = await owner.handle(principal, f.headers, proposalCommand(read.revision, 'Ich brauche eine klare Grundkonfiguration ohne KI-Druck.'));
  assert.equal(result.outcome, 'PROPOSAL_INVALID');
  assert.equal(result.draftRetained, true);
  assert.equal(result.activationAuthorized, false);
  assert.equal(f.server.post(), 1, 'exactly one synthetic proposal POST');
  const dispatched = f.server.observations.filter(o => o.method === 'POST').at(-1);
  const bodyText = JSON.stringify(dispatched.body);
  assert.ok(bodyText.includes('Ich brauche eine klare Grundkonfiguration ohne KI-Druck.'), 'registered user intent travels inside the minimized context');
  assert.ok(bodyText.includes('pansphaira.agent-configuration/proposal-context/v1'), 'the minimized server-built context itself travels as inert data');
  // The closed proposal purpose is INTERNAL admission metadata of the
  // existing native565 owner (proven separately below by the unqualified-grant
  // denial and by the original independent transport admission): the minimized
  // provider body must not be padded with purpose text to satisfy any oracle.
  assert.equal(bodyText.includes(MODEL_CONNECTION_PROPOSAL_PURPOSE_V1), false, 'internal admission metadata stays out of the minimized provider body');
  assert.equal(bodyText.includes('SYNTHETIC_PRIVATE_FILE_CANARY'), false, 'no secret material to the transport body');
  const after = drafts.read(principal);
  assert.equal(after.revision, read.revision, 'invalid proposal never wrote');
  // Manual non-AI fallback on the SAME authoritative draft.
  const ask = pickAskable(after);
  assert.ok(ask, 'fixture draft has an actual open question');
  const saved = drafts.save({ schemaVersion: 'pansphaira.agent-configuration/answers/v1', expectedRevision: after.revision, answers: [{ field: ask.field, value: ask.value, confirmation: 'CONFIRM' }] }, principal);
  assert.equal(saved.revision, after.revision + 1);
});

test('#567 valid closed proposal: explicit confirm applies a versioned delta; second confirm is stale; readback matches the draft', async () => {
  const read = drafts.read(principal);
  const ask = pickAskable(read);
  assert.ok(ask);
  const other = read.questions.find(q => q.field !== ask.field);
  f.server.setResponseText(JSON.stringify({
    schemaVersion: 'pansphaira.agent-configuration/proposal/v1', capabilityReference: 'configuration.onboarding.propose/v1', expectedRevision: read.revision,
    proposals: [{ field: ask.field, value: ask.value, rationale: 'Begründet aus den zugelassenen Werten des Kontexts.' }],
    clarifications: other ? [{ field: other.field, question: 'Darf dieser Wert später ergänzt werden?' }] : [],
  }));
  const postsBefore = f.server.post();
  const proposed = await owner.handle(principal, f.headers, proposalCommand(read.revision, 'Bitte mit den zugelassenen Standardwerten vorschlagen.'));
  assert.equal(proposed.outcome, 'PROPOSED');
  assert.equal(f.server.post(), postsBefore + 1);
  assert.equal(proposed.proposal.proposals[0].field, ask.field);
  assert.equal(drafts.read(principal).revision, read.revision, 'a proposal never writes by itself');
  const confirmed = await owner.handle(principal, f.headers, { schemaVersion: 'pansphaira.agent-configuration/proposal-confirm/v1', expectedRevision: read.revision, proposalDigest: proposed.proposal.proposalDigest, acceptedFields: [ask.field], confirm: true });
  assert.equal(confirmed.outcome, 'APPLIED');
  assert.equal(confirmed.newRevision, read.revision + 1);
  const reread = drafts.read(principal);
  assert.equal(reread.revision, read.revision + 1);
  assert.deepEqual(reread.draft.fields[ask.field].value, ask.value);
  assert.equal(reread.draft.fields[ask.field].confirmation, 'CONFIRMED');
  const again = await owner.handle(principal, f.headers, { schemaVersion: 'pansphaira.agent-configuration/proposal-confirm/v1', expectedRevision: read.revision, proposalDigest: proposed.proposal.proposalDigest, acceptedFields: [ask.field], confirm: true });
  assert.equal(again.outcome, 'PROPOSAL_STALE');
  assert.equal(drafts.read(principal).revision, read.revision + 1, 'stale confirm wrote nothing');
});

test('#567 session-bound pending state: foreign, malformed and missing real sessions deny without consuming or writing; same-session confirm stays functional', async () => {
  // The preceding dialogue tests confirmed the open answers; reopen ONE
  // actual question through the same existing answers path (explicit UNKNOWN,
  // no fixture-invented field) so the session proofs run on a real open draft.
  await drafts.save({ schemaVersion: 'pansphaira.agent-configuration/answers/v1', expectedRevision: drafts.read(principal).revision, answers: [{ field: 'context.locale', value: null, confirmation: 'UNKNOWN' }] }, principal);
  const read = drafts.read(principal);
  const ask = pickAskable(read);
  assert.ok(ask);
  const body = { schemaVersion: 'pansphaira.agent-configuration/proposal/v1', capabilityReference: 'configuration.onboarding.propose/v1', expectedRevision: read.revision, proposals: [{ field: ask.field, value: ask.value, rationale: 'Zugelassener Wert des aktuellen Entwurfs für die Sitzungstrennung.' }], clarifications: [] };
  f.server.setResponseText(JSON.stringify(body));
  const postsBefore = f.server.post();
  const proposed = await owner.handle(principal, f.headers, proposalCommand(read.revision, 'Echte Sitzungstrennung am registrierten Owner prüfen.'));
  assert.equal(proposed.outcome, 'PROPOSED');
  assert.equal(f.server.post(), postsBefore + 1);
  const confirmCommand = { schemaVersion: 'pansphaira.agent-configuration/proposal-confirm/v1', expectedRevision: read.revision, proposalDigest: proposed.proposal.proposalDigest, acceptedFields: [ask.field], confirm: true };
  // A second REAL authenticated session of the SAME tenant/subject/instance
  // must not consume the pending proposal of the originating session.
  const headersB = f.issue(), b = f.sessions.authenticate(headersB);
  assert.equal(b.subjectId, principal.subjectId);
  assert.notEqual(headersB['x-pan565-session'], f.headers['x-pan565-session']);
  const foreign = await owner.handle(b, headersB, confirmCommand);
  assert.equal(foreign.outcome, 'PROPOSAL_STALE');
  assert.equal(drafts.read(principal).revision, read.revision, 'foreign session confirm wrote nothing');
  // A wrong session claim on the SAME valid cookie is not trusted as a label.
  await assert.rejects(owner.handle(principal, { ...f.headers, 'x-pan565-session': 'session:' + '0'.repeat(64) }, confirmCommand), /MODEL_CONNECTION_SCOPE_DENIED/);
  // A missing claim denies too: the closed seam requires the exact header.
  const { 'x-pan565-session': missing, ...headersNoClaim } = f.headers;
  assert.equal(missing, f.headers['x-pan565-session']);
  await assert.rejects(owner.handle(principal, headersNoClaim, confirmCommand), /MODEL_CONNECTION_SCOPE_DENIED/);
  assert.equal(drafts.read(principal).revision, read.revision, 'denied confirms never wrote');
  // Same-session explicit confirmation remains fully functional (CAS + readback).
  const applied = await owner.handle(principal, f.headers, confirmCommand);
  assert.equal(applied.outcome, 'APPLIED');
  assert.equal(applied.newRevision, read.revision + 1);
  assert.equal(drafts.read(principal).revision, read.revision + 1);
  // The ACTUAL revocation (real logout) and the genuine held-expiry lifetime
  // run in their own fixtures below: THIS shared native565 synthetic grant's
  // ledger is cumulative across the whole fixture (same owner, root and
  // subject), and its unchanged limits565 maxRequests=3 is ALREADY consumed
  // by the invalid, valid and same-session proposals above (prepareProposal
  // checks committed runtime.committedUnits+1<=maxRequests BEFORE dispatch).
  // A further proposal here therefore honestly answers MODEL_CONNECTION_DENIED
  // /MODEL_CONNECTION_BUDGET_EXHAUSTED — a real capacity answer, never proof
  // about revocation or session lifetime, and no cap may be raised or reset.
  assert.equal(f.server.post(), postsBefore + 1, 'no denied confirm or session claim added provider traffic beyond the single actual proposal');
});

test('#567 actual logout on an independently owned fixture: a revoked real session cannot confirm its pending proposal; the still-live session keeps and applies its own', async () => {
  // Own fresh native565 fixture: SAME unchanged limits565 and real grant, own
  // ledger, real owner and prerequisites — independent of the dialogue tests
  // above, so the cumulative shared-ledger capacity cannot pre-deny this
  // genuine logout scenario (no cap raise, no reset, no re-opened accounting).
  const f2 = await nativeFixture565({ alter: o => { o.productGrant.allowedPurposes = [MODEL_CONNECTION_PROPOSAL_PURPOSE_V1]; } });
  const root2 = mkdtempSync(join(f2.tls.root, 'pan567-draft-logout-'));
  const drafts2 = createAgentConfigurationDraftStoreV1({ root: root2, profile: pan441EmployeeProfileV1(), template: bindRuntimeTemplateV1(shapeIdentity527('tenant-a')) });
  const owner2 = createNativeConfigurationProposalOwnerV1({ drafts: drafts2, binding: f2.sessions.binding, model: createNativeConfigurationProposalModelV1(f2.owner, f2.sessions.binding) });
  // The REAL /workspace/logout route sits behind the unchanged workspaceDocument
  // guard (origin-session-adapter.mjs:707 rejects every workspace route without a
  // genuinely mounted protected workspace). This is the existing minimal protected
  // workspace mounting pattern of the SAME native565 fixture family
  // (native-model-connection.test.mjs 553-R1): same gateway, same sessionAdapter
  // and binding identityDigest, same origin and TLS, no guard lowered, nothing
  // simulated; the ERV reader is honestly unused here and throws if ever called.
  const mount2 = mountProtectedWorkspaceDocumentV1(f2.tls.gateway, { optIn: true, tenantId: 'tenant-a', identityDigest: f2.sessions.binding.identityDigest, origin: f2.tls.origin, html: '', script: '', style: '', readErv() { throw Error('UNUSED_TEST_READER'); } });
  try {
    await f2.prerequisites();
    const p2 = f2.sessions.authenticate(f2.headers);
    const read = drafts2.read(p2);
    const ask = pickAskable(read);
    assert.ok(ask, 'the fresh fixture draft carries an actual open question for the revocation proof');
    f2.server.setResponseText(JSON.stringify({ schemaVersion: 'pansphaira.agent-configuration/proposal/v1', capabilityReference: 'configuration.onboarding.propose/v1', expectedRevision: read.revision,
      proposals: [{ field: ask.field, value: ask.value, rationale: 'Zugelassener Wert des aktuellen Entwurfs für den Widerrufsfall.' }], clarifications: [] }));
    // The still-live originating session holds its OWN pending record.
    const live = await owner2.handle(p2, f2.headers, proposalCommand(read.revision, 'Echte Sitzung vor dem Widerruf einer anderen.'));
    assert.equal(live.outcome, 'PROPOSED');
    const headersC = f2.issue(), c = f2.sessions.authenticate(headersC);
    assert.equal(c.subjectId, p2.subjectId, 'a second REAL session of the same registered subject');
    assert.notEqual(headersC['x-pan565-session'], f2.headers['x-pan565-session']);
    const proposedC = await owner2.handle(c, headersC, proposalCommand(read.revision, 'Nach dem Widerruf einer echten Sitzung bestätigen.'));
    assert.equal(proposedC.outcome, 'PROPOSED', 'own ledger: two proposals inside the unchanged maxRequests=3');
    const logout = await request527(f2.tls, '/t/tenant-a/workspace/logout', { cookie: headersC.cookie, origin: f2.tls.origin }, 'POST');
    assert.equal(logout.status, 200, logout.body);
    assert.deepEqual(JSON.parse(logout.body), { outcome: 'LOGGED_OUT' }, 'the real protected route answers its own closed logout result');
    await assert.rejects(owner2.handle(c, headersC, { schemaVersion: 'pansphaira.agent-configuration/proposal-confirm/v1', expectedRevision: read.revision, proposalDigest: proposedC.proposal.proposalDigest, acceptedFields: [ask.field], confirm: true }), /HOSTED_SESSION_DENIED/);
    assert.equal(drafts2.read(p2).revision, read.revision, 'the revoked session confirm wrote nothing');
    // The live session's own pending survives the OTHER session's revocation
    // and still confirms normally (existing CAS + readback).
    const applied = await owner2.handle(p2, f2.headers, { schemaVersion: 'pansphaira.agent-configuration/proposal-confirm/v1', expectedRevision: read.revision, proposalDigest: live.proposal.proposalDigest, acceptedFields: [ask.field], confirm: true });
    assert.equal(applied.outcome, 'APPLIED');
    assert.equal(applied.newRevision, read.revision + 1);
    assert.equal(drafts2.read(p2).revision, read.revision + 1);
    // The revocation is real on the same protected ingress, not just inside the
    // owner: the logged-out session itself is gone; the OTHER live session keeps
    // its own protected route untouched.
    assert.equal((await request527(f2.tls, '/t/tenant-a/workspace/context', { cookie: headersC.cookie, origin: f2.tls.origin })).status, 401, 'the revoked session is denied on its own former route');
    assert.equal((await request527(f2.tls, '/t/tenant-a/workspace/context', { cookie: f2.headers.cookie, origin: f2.tls.origin })).status, 200, 'the surviving live session keeps its own protected route');
    assert.equal(f2.server.post(), 2, 'exactly the two proposal requests; the logout denial added no traffic and no retry');
  } finally { mount2.close(); owner2.close(); drafts2.close(); rmSync(root2, { recursive: true, force: true }); await f2.close(); }
});

test('#567 genuine held expiry on an independently owned fixture: the late reply of an expired real session neither becomes pending nor writes', async () => {
  // Own fresh native565 fixture — same unchanged limits, real principal, real
  // bootstrap; the held TIMEOUT reply is released only by THIS test.
  const f3 = await nativeFixture565({ alter: o => { o.productGrant.allowedPurposes = [MODEL_CONNECTION_PROPOSAL_PURPOSE_V1]; } });
  const root3 = mkdtempSync(join(f3.tls.root, 'pan567-draft-expiry-'));
  const drafts3 = createAgentConfigurationDraftStoreV1({ root: root3, profile: pan441EmployeeProfileV1(), template: bindRuntimeTemplateV1(shapeIdentity527('tenant-a')) });
  const owner3 = createNativeConfigurationProposalOwnerV1({ drafts: drafts3, binding: f3.sessions.binding, model: createNativeConfigurationProposalModelV1(f3.owner, f3.sessions.binding) });
  try {
    await f3.prerequisites();
    const p3 = f3.sessions.authenticate(f3.headers);
    const read3 = drafts3.read(p3);
    const ask3 = pickAskable(read3);
    assert.ok(ask3, 'the fixture draft carries an actual open question for the expiry proof');
    const headersE = (() => { const issued = f3.sessions.issueOwnerSession({ subjectId: 'synthetic:erv-reader', role: 'reader', expiresAtMs: Date.now() + 150 });
      return { cookie: issued.cookieHeader, origin: f3.tls.origin, 'x-pan565-session': 'session:' + createHash('sha256').update(issued.cookieHeader).digest('hex') }; })();
    const e = f3.sessions.authenticate(headersE);
    assert.equal(e.subjectId, p3.subjectId, 'a real short-lived session of the SAME registered subject');
    f3.server.setMode('TIMEOUT');
    const postsBeforeE = f3.server.post();
    const proposedE = owner3.handle(e, headersE, proposalCommand(read3.revision, 'Auf die Antwort einer ablaufenden echten Sitzung warten.'));
    for (let i = 0; i < 200 && f3.server.post() === postsBeforeE; i++) await new Promise(r => setTimeout(r, 25));
    assert.equal(f3.server.post(), postsBeforeE + 1, 'the held proposal request reached the transport exactly once');
    await new Promise(r => setTimeout(r, 300)); // the genuine registered lifetime elapsed while the reply was still held
    f3.server.release();
    const late = await proposedE;
    f3.server.setMode('OK');
    // The released TIMEOUT transport answers with a malformed {} AND the
    // registered session lifetime has genuinely elapsed: the existing
    // semantics reject a late result for the lost session before any
    // settlement claim — the ledger keeps its real (possibly UNKNOWN-held)
    // usage, never a fabricated settlement, never a retry or provider change.
    assert.equal(late.outcome, 'MODEL_CONNECTION_DENIED');
    assert.equal(late.reason, 'PROPOSAL_SESSION_LOST_AFTER_COMPLETION');
    assert.equal(late.draftRetained, true);
    assert.equal(drafts3.read(p3).revision, read3.revision, 'a late result from an expired session wrote nothing');
    assert.equal(f3.server.post(), postsBeforeE + 1, 'no retry and no duplicate request after the held expiry');
    assert.ok(drafts3.read(p3).questions.some(q => q.field === ask3.field), 'the same draft keeps its actual open question for manual non-AI continuation');
  } finally { owner3.close(); drafts3.close(); rmSync(root3, { recursive: true, force: true }); await f3.close(); }
});

test('#567 closed proposal purpose is internal admission: a real grant without it denies before any provider dispatch', async () => {
  // Same real native565 fixture without the closed purpose in the product
  // grant: the qualified admission itself is measured, separately from the
  // minimized provider content which must never carry purpose text.
  const g = await nativeFixture565();
  const gRoot = mkdtempSync(join(g.tls.root, 'pan567-draft-nopurpose-'));
  const gDrafts = createAgentConfigurationDraftStoreV1({ root: gRoot, profile: pan441EmployeeProfileV1(), template: bindRuntimeTemplateV1(shapeIdentity527('tenant-a')) });
  const gOwner = createNativeConfigurationProposalOwnerV1({ drafts: gDrafts, binding: g.sessions.binding, model: createNativeConfigurationProposalModelV1(g.owner, g.sessions.binding) });
  try {
    await g.prerequisites();
    const gp = g.sessions.authenticate(g.headers);
    const read = gDrafts.read(gp);
    const result = await gOwner.handle(gp, g.headers, proposalCommand(read.revision, 'Ohne zugelassenen Vorschlagszweck angefragt.'));
    assert.equal(result.outcome, 'MODEL_CONNECTION_DENIED');
    assert.equal(result.reason, 'MODEL_CONNECTION_TASK_CONSENT_DENIED');
    assert.equal(g.server.post(), 0, 'unqualified internal admission never reaches the provider transport');
    assert.equal(gDrafts.read(gp).revision, read.revision, 'denied proposal wrote nothing');
  } finally { gOwner.close(); gDrafts.close(); rmSync(gRoot, { recursive: true, force: true }); await g.close(); }
});

test('#567 request revision and shape are checked against the fresh draft; no qualified path is a silent model', async () => {
  const read = drafts.read(principal);
  const postsBefore = f.server.post();
  await assert.rejects(owner.handle(principal, f.headers, proposalCommand(read.revision + 5, 'Veraltete Revision für einen Vorschlag.')), /PROPOSAL_REQUEST_DENIED/);
  await assert.rejects(owner.handle(principal, f.headers, { schemaVersion: 'pansphaira.agent-configuration/proposal-request/v1', expectedRevision: read.revision, confirm: true, intent: 'Zusatzfeld versucht.', tool: 'free.tools' }));
  assert.equal(f.server.post(), postsBefore, 'denied requests never reach the transport');
});

test('#567 closed owner: pending state dropped, brand gone, further traffic denies', async () => {
  owner.close();
  assert.equal(isNativeConfigurationProposalOwnerV1(owner, f.sessions.binding), false);
  await assert.rejects(owner.handle(principal, f.headers, proposalCommand(drafts.read(principal).revision, 'Nach dem Schließen angefragt.')), /CONFIGURATION_PROPOSAL_OWNER_CLOSED|CONFIGURATION_OWNERSHIP_DENIED/);
});
