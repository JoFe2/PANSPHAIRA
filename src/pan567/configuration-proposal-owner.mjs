// Original #567 B1 proposal-only onboarding owner. Attaches to the EXISTING
// #563 durable draft store (same row, revision and CAS owner) and the EXISTING
// #565 native model connection owner (same consent, transport and cost ledger
// via the closed proposal-purpose admission). No second draft store, model
// broker, authority store, task database, global panel or free tool surface.
// A model proposal never writes: only the user's explicit confirmation turns
// the accepted subset into a versioned answers delta through the draft
// store's own save path, which revalidates under the bound policy. On any
// invalid format, model error, quota/auth denial or unknown load the same
// draft is retained for manual non-AI continuation — no silent provider
// change, no budget increase, no duplicate request after unknown load.
import { randomBytes } from 'node:crypto';
import { configurationClosedObjectV1 } from '../../dist/packages/contracts/src/agent-configuration-draft-v1.js';
import { canonicalJson } from '../../dist/packages/contracts/src/canonical-json.js';
import {
  buildAgentConfigurationProposalContextV1, validateAgentConfigurationProposalRequestV1,
  validateAgentConfigurationProposalConfirmV1, validateAgentConfigurationProposalV1,
  agentConfigurationProposalAnswersV1, AGENT_CONFIGURATION_PROPOSAL_READBACK_SCHEMA_V1,
  AGENT_CONFIGURATION_PROPOSAL_CONTEXT_MAX_BYTES,
} from '../../dist/packages/contracts/src/agent-configuration-proposal-v1.js';
import { isAgentConfigurationDraftStoreV1 } from '../pan563/draft-store.mjs';
import {
  isNativeConfigurationProposalModelV1, prepareNativeConfigurationProposalV1, runNativeConfigurationProposalV1,
  authenticateNativeConfigurationProposalSessionV1,
} from '../pan565/native-model-connection.mjs';
// Exact-owner brand: each admitted owner maps to ITS OWN construction binding;
// a foreign binding (any different canonical value, including a one-field
// clone such as a changed tenantId), a malformed or plain-object binding and
// every closed owner fail. The WeakMap entry is dropped on close(), so a
// closed owner can never be re-asserted.
// Pending proposals are bound to the EXACT code-authenticated native565
// session that produced them (plus owner binding and draft revision), never
// to a tenant+subject+instance label alone: a second real session of the same
// subject can neither consume nor overwrite another session's pending state.
const owned = new WeakMap();
const readback = (outcome, reason, expectedRevision, proposal = null, newRevision = null) => Object.freeze({
  schemaVersion: AGENT_CONFIGURATION_PROPOSAL_READBACK_SCHEMA_V1, outcome, reason,
  expectedRevision, newRevision, proposal, draftRetained: true, activationAuthorized: false, realModelAcceptance: false,
});
// Server-side context minimization guard: the model sees only the bounded
// registered user intent, open questions, registered allowed values and
// confirmed dependency values from the current authoritative readback —
// never secrets, session ids or foreign tenants.
export function createNativeConfigurationProposalOwnerV1(options) {
  configurationClosedObjectV1(options, ['drafts', 'binding', 'model']);
  const { drafts, binding, model } = options;
  if (!isAgentConfigurationDraftStoreV1(drafts, binding) || !isNativeConfigurationProposalModelV1(model, binding)) throw Error('CONFIGURATION_PROPOSAL_OWNER_DENIED');
  const bindingText = canonicalJson(binding);
  const pending = new Map();
  let closed = false;
  function keyFor(principal, headers) {
    if (closed) throw Error('CONFIGURATION_PROPOSAL_OWNER_CLOSED');
    if (principal.tenantId !== binding.tenantId || principal.instanceId !== binding.instanceId || principal.generation !== binding.generation
      || !['reader', 'reviewer'].includes(principal.role) || typeof principal.subjectId !== 'string' || !/^[a-z0-9][a-z0-9:_-]{0,79}$/.test(principal.subjectId)) throw Error('CONFIGURATION_OWNERSHIP_DENIED');
    // Bind to the EXACT code-authenticated originating native565 session, not
    // merely to tenant+subject+instance: the existing native565 session store
    // authenticates the cookie, re-derives the session identity in code (the
    // request header is only a claim), and enforces origin, lifetime and
    // revocation here and at every recheck.
    const session = authenticateNativeConfigurationProposalSessionV1(model, headers);
    if (session.principal.tenantId !== principal.tenantId || session.principal.subjectId !== principal.subjectId
      || session.principal.instanceId !== principal.instanceId || session.principal.generation !== principal.generation
      || session.principal.role !== principal.role) throw Error('CONFIGURATION_OWNERSHIP_DENIED');
    return binding.tenantId + '|' + principal.subjectId + '|' + binding.instanceId + '|' + session.sessionId;
  }
  async function propose(principal, headers, command) {
    if (closed) throw Error('CONFIGURATION_PROPOSAL_OWNER_CLOSED');
    // A missing, malformed, foreign or revoked originating session denies here
    // — before the draft is read, before the transport, before any pending
    // state could be written or consumed.
    const key = keyFor(principal, headers);
    const read = drafts.read(principal);
    // Context/tenant/session/revision, the bounded user intent and current
    // rights are checked here server-side against the authenticated principal
    // and the fresh draft — never against a browser-supplied projection.
    let request;
    if (command !== null && typeof command === 'object') request = validateAgentConfigurationProposalRequestV1(command, read.revision);
    else throw Error('PROPOSAL_REQUEST_DENIED');
    if (read.outcome === 'RESOLVED' || !read.questions.length) return readback('NOTHING_TO_PROPOSE', 'ALL_QUESTIONS_RESOLVED', read.revision);
    const context = buildAgentConfigurationProposalContextV1(read, request.intent);
    if (Buffer.byteLength(context.contextText, 'utf8') > AGENT_CONFIGURATION_PROPOSAL_CONTEXT_MAX_BYTES) return readback('CONTEXT_TOO_LARGE', 'PROPOSAL_CONTEXT_DENIED', read.revision);
    for (const [key, record] of pending) if (record.expiresAtMs <= Date.now() || record.expectedRevision !== read.revision) pending.delete(key);
    if (pending.size >= 16) return readback('MODEL_CONNECTION_DENIED', 'MODEL_CONNECTION_CAPACITY_DENIED', read.revision);
    const runId = 'operation:pan567-' + randomBytes(24).toString('hex');
    const proposal = { contextText: context.contextText, contextDigest: context.contextDigest,
      validate: (text) => { let parsed = null; try { parsed = JSON.parse(text); } catch { /* closed format below */ }
        return validateAgentConfigurationProposalV1(parsed, { definitions: read.definitions, askableFields: context.askableFields, expectedRevision: read.revision, contextDigest: context.contextDigest }); } };
    let run;
    try {
      const prepared = prepareNativeConfigurationProposalV1(model, headers, { runId, expiresAtMs: Date.now() + 30000 }, proposal);
      run = await runNativeConfigurationProposalV1(model, headers, prepared.ticket, { offerDigest: prepared.offer.offerDigest, confirm: true }, proposal);
    } catch (error) {
      const code = error instanceof Error && /^MODEL_CONNECTION_[A-Z_]+$/.test(error.message) ? error.message : 'PROPOSAL_UNAVAILABLE';
      return readback('MODEL_CONNECTION_DENIED', code, read.revision);
    }
    // Revalidate the CURRENT draft after the await: a proposal that completed
    // late against a moved, revoked or closed context never becomes pending —
    // the confirmed values and any concurrent manual save win.
    if (closed || drafts.read(principal).revision !== read.revision) return readback('REVISION_CONFLICT', 'DRAFT_REVISION_DRIFT_AFTER_COMPLETION', read.revision);
    // A late result only becomes pending for the SAME still-authenticated
    // session: if it expired, was revoked (real logout) or closed meanwhile,
    // nothing is stored and the draft is retained for manual continuation.
    let lateKey = null; try { lateKey = keyFor(principal, headers); } catch { /* session gone or claim moved */ }
    if (lateKey !== key) return readback('MODEL_CONNECTION_DENIED', 'PROPOSAL_SESSION_LOST_AFTER_COMPLETION', read.revision);
    if (run.outcome === 'PROPOSED') {
      pending.set(key, { expectedRevision: read.revision, proposal: run.proposal, expiresAtMs: Date.now() + 300000, usageState: run.usageState, identity: run.identity });
      return readback('PROPOSED', run.evidenceReason ?? 'PROPOSAL_RECEIVED_NOT_MODEL_ACCEPTANCE', read.revision, run.proposal);
    }
    if (run.outcome === 'INVALID_FORMAT') return readback('PROPOSAL_INVALID', run.reason, read.revision);
    return readback('MODEL_UNAVAILABLE', run.reason, read.revision);
  }
  function confirm(principal, headers, command) {
    if (closed) throw Error('CONFIGURATION_PROPOSAL_OWNER_CLOSED');
    // Headers are checked on confirm too: a missing, malformed, foreign or
    // revoked session denies BEFORE anything is consumed, so another session's
    // pending proposal survives untouched.
    const key = keyFor(principal, headers);
    const input = validateAgentConfigurationProposalConfirmV1(command);
    const record = pending.get(key);
    pending.delete(key); // single use: any consumed or failed proposal needs a fresh explicit request
    if (!record || record.expiresAtMs <= Date.now() || record.proposal.proposalDigest !== input.proposalDigest || record.expectedRevision !== input.expectedRevision) return readback('PROPOSAL_STALE', 'PROPOSAL_STALE_OR_CONSUMED', input.expectedRevision, record?.proposal ?? null);
    if (!input.acceptedFields.every(field => record.proposal.proposals.some(p => p.field === field))) return readback('PROPOSAL_STALE', 'PROPOSAL_FIELD_DENIED', input.expectedRevision, record.proposal);
    // At commit: the originating session must still be the SAME live session
    // and the draft revision must not have moved — a concurrent manual save
    // wins; a late confirm never overwrites or silently replaces it.
    let commitKey = null; try { commitKey = keyFor(principal, headers); } catch { /* session gone between checks */ }
    if (commitKey !== key || drafts.read(principal).revision !== record.expectedRevision) return readback('PROPOSAL_STALE', 'DRAFT_MOVED_OR_SESSION_LOST_BEFORE_COMMIT', input.expectedRevision, record.proposal);
    const answers = agentConfigurationProposalAnswersV1(record.proposal, input.acceptedFields, input.expectedRevision);
    const saved = drafts.save(answers, principal); // existing CAS + full policy revalidation at commit
    return readback('APPLIED', 'PROPOSAL_DELTA_PERSISTED', input.expectedRevision, record.proposal, saved.revision);
  }
  const owner = Object.freeze({
    async handle(principal, headers, command) {
      configurationClosedObjectV1(command ?? {}, command && Object.hasOwn(command ?? {}, 'proposalDigest')
        ? ['schemaVersion', 'expectedRevision', 'proposalDigest', 'acceptedFields', 'confirm']
        : ['schemaVersion', 'expectedRevision', 'confirm', 'intent']);
      if (command?.schemaVersion === 'pansphaira.agent-configuration/proposal-confirm/v1') return confirm(principal, headers, command);
      return await propose(principal, headers, command);
    },
    close() { if (!closed) { closed = true; pending.clear(); owned.delete(owner); } },
  });
  owned.set(owner, bindingText);
  return owner;
}
export const isNativeConfigurationProposalOwnerV1 = (candidate, binding) => owned.has(candidate)
  && binding !== null && typeof binding === 'object' && owned.get(candidate) === canonicalJson(binding);
