// UI-ACT-699: versioned CODE-OWNED semantic action anchors plus an honest
// read-only live projection over existing #696 action observations and the
// current authorized context/surface read. A confirmed observation binds the
// exact registered anchor only while the CURRENT context still matches; every
// other state returns a typed neutral fallback and never a guessed DOM target.
// There is deliberately no registration API and no selector/authority field:
// caller or model strings can never become a CSS selector, click or shell
// target, and projection grants no execute/approve/resume/Fach rights.
import {canonicalJson} from '../../dist/packages/contracts/src/canonical-json.js';
import {uiTaskClosedV2} from './native-ui-task-projection-v2.mjs';

export const workspaceActionAnchorRegistryVersionV1 = 1;

// Closed, code-owned registry. Extending it needs a source change plus a
// registryVersion bump; remote/plugin uncertified registration is impossible.
const anchors = Object.freeze([
  Object.freeze({registryVersion: 1, anchorId: 'anchor:pan.erv.module-card', capability: 'pan.workspace.view.preview/v1', kind: 'MODULE_CARD_INSTANCE', moduleId: 'pan.erv', viewId: 'pan.erv.view', targetClass: 'module-card'}),
  Object.freeze({registryVersion: 1, anchorId: 'anchor:pan597.document-surface', capability: 'pan.workspace.document.display/v2', kind: 'REGISTERED_SURFACE_DOCUMENT', targetClass: 'document-surface'}),
]);
export const workspaceSemanticAnchorRegistryV1 = anchors;
export const workspaceActionAnchorProjectionStatusesV1 = Object.freeze(['BOUND', 'PENDING', 'FALLBACK']);

const deniedTargetKeys = ['selector', 'cssSelector', 'domTarget', 'clickTarget', 'href', 'onclick'];
const currentKeys = ['schemaVersion', 'epoch', 'expectedEpoch', 'revisions', 'primaryObjectId', 'surfaces', 'view'];
const observedPhases = ['PROPOSED', 'ADMITTED', 'DISPATCHED', 'RESULT_CONFIRMED', 'UNKNOWN', 'PRIVACY_RETIRED'];
const pendingText = Object.freeze({
  PROPOSED: 'Presentation pending: proposal shown, nothing applied yet.',
  ADMITTED: 'Presentation pending: admitted for preview only, nothing applied yet.',
  // A legacy DISPATCHED observation proves only that a task row exists; the
  // observation DTO carries no dispatch attestation, so no attempt is claimed.
  DISPATCHED: 'Presentation pending: admitted, awaiting independent confirmation.',
});
const fallbackText = 'Presentation unavailable for this step; no target highlight.';

// Descriptor-safe snapshot: reads only own enumerable value properties and
// denies accessors BEFORE executing any caller getter, so a hostile input can
// never run code or mutate during validation (uiTaskClosedV2 semantics without
// a closed key list, for DTOs with additional owner fields).
function plainData(value, code) {
  if (!value || typeof value !== 'object' || Array.isArray(value) || Object.getPrototypeOf(value) !== Object.prototype) throw Error(code);
  const d = Object.getOwnPropertyDescriptors(value);
  const out = Object.create(null);
  for (const k of Reflect.ownKeys(d)) {
    const x = d[k];
    if (typeof k === 'symbol' || !x.enumerable || !('value' in x)) throw Error(code);
    out[k] = x.value;
  }
  return out;
}

function findAnchor(target) {
  return anchors.find((a) => a.kind === target.kind
    && (a.moduleId === undefined || a.moduleId === target.moduleId)
    && (a.viewId === undefined || a.viewId === target.viewId)) ?? null;
}

// An unregistered kind is a typed fallback, not a shape error: never adopt or
// guess fields of an unknown target into a highlight decision.
function targetKindIsUnknown(target) {
  return !anchors.some((a) => a.kind === plainData(target, 'ANCHOR_UI_TARGET_REPRESENTATION_ONLY').kind);
}

function validateCurrent(current) {
  const c = uiTaskClosedV2(current, currentKeys, 'ANCHOR_PROJECTION_INPUT_DENIED');
  if (c.schemaVersion !== 'pansphaira.workspace-action-anchor/current/v1'
    || !Number.isSafeInteger(c.epoch) || c.epoch < 1
    || !Number.isSafeInteger(c.expectedEpoch) || c.expectedEpoch < 1
    || typeof c.primaryObjectId !== 'string'
    || !Array.isArray(c.surfaces) || c.surfaces.length > 32
    || !(c.view === null || (c.view && typeof c.view === 'object' && Object.getPrototypeOf(c.view) === Object.prototype))) {
    throw Error('ANCHOR_PROJECTION_INPUT_DENIED');
  }
  if (c.view !== null) uiTaskClosedV2(c.view, ['revision', 'viewDigest'], 'ANCHOR_PROJECTION_INPUT_DENIED');
  const seen = new Set();
  for (const s of c.surfaces) {
    const surface = uiTaskClosedV2(s, ['surfaceId', 'revisions'], 'ANCHOR_PROJECTION_INPUT_DENIED');
    if (typeof surface.surfaceId !== 'string' || seen.has(surface.surfaceId)) throw Error('ANCHOR_PROJECTION_INPUT_DENIED');
    seen.add(surface.surfaceId);
  }
  return c;
}

function validateObservation(observation) {
  const o = plainData(observation, 'ANCHOR_PROJECTION_INPUT_DENIED');
  for (const key of deniedTargetKeys) if (Object.hasOwn(o, key)) throw Error('ANCHOR_UI_TARGET_REPRESENTATION_ONLY');
  for (const key of ['schemaVersion', 'phase', 'semanticTarget', 'expectedRevisions', 'objectRef', 'taskRevision', 'capability']) {
    if (!Object.hasOwn(o, key)) throw Error('ANCHOR_PROJECTION_INPUT_DENIED');
  }
  if (o.schemaVersion !== 'pansphaira.workspace-action-observation/v1'
    || !observedPhases.includes(o.phase)
    || !o.semanticTarget || typeof o.semanticTarget !== 'object') {
    throw Error('ANCHOR_PROJECTION_INPUT_DENIED');
  }
  // expectedRevisions participates in canonicalJson compares, which execute
  // getters: snapshot it descriptor-safe first, deny accessors outright.
  plainData(o.expectedRevisions, 'ANCHOR_PROJECTION_INPUT_DENIED');
  return o;
}

function project(status, fields) {
  return Object.freeze({
    schemaVersion: 'pansphaira.workspace-action-anchor-projection/v1',
    status, anchorId: null, targetClass: null, uiTargetRef: null,
    displayPhase: 'UNKNOWN', observedPhase: 'UNKNOWN', highlightAllowed: false,
    reason: null, stepText: fallbackText, objectId: null, taskRevision: null,
    executionAuthorityGranted: false, businessEffectProduced: false, ...fields,
  });
}

// Pure read-only resolution. `observation` comes from the existing owner
// (#696 observe()/executor readback), `current` from a FRESH authorized
// context verify + surface snapshot. Admission or pending phases never claim
// APPLIED; confirmation only binds an anchor, it never grants authority.
export function resolveWorkspaceActionAnchorV1(observation, current) {
  const o = validateObservation(observation);
  const c = validateCurrent(current);
  const base = {observedPhase: o.phase, taskRevision: o.taskRevision};
  if (o.phase === 'PRIVACY_RETIRED') return project('FALLBACK', {...base, reason: 'PRIVACY_RETIRED'});
  if (targetKindIsUnknown(o.semanticTarget)) return project('FALLBACK', {...base, reason: 'ANCHOR_UNREGISTERED'});
  const target = uiTaskClosedV2(o.semanticTarget, o.semanticTarget.kind === 'MODULE_CARD_INSTANCE'
    ? ['kind', 'moduleId', 'viewId', 'objectId', 'instanceId'] : ['kind', 'objectId', 'surfaceId'], 'ANCHOR_UI_TARGET_REPRESENTATION_ONLY');
  const anchor = findAnchor(target);
  if (!anchor || anchor.registryVersion !== workspaceActionAnchorRegistryVersionV1) {
    return project('FALLBACK', {...base, reason: 'ANCHOR_UNREGISTERED'});
  }
  if (anchor.capability !== o.capability) return project('FALLBACK', {...base, reason: 'ANCHOR_CAPABILITY_MISMATCH'});
  if (target.objectId !== c.primaryObjectId) return project('FALLBACK', {...base, anchorId: anchor.anchorId, reason: 'OBJECT_MISMATCH'});
  if (c.epoch !== c.expectedEpoch) return project('FALLBACK', {...base, anchorId: anchor.anchorId, reason: 'CONTEXT_EPOCH_STALE'});
  plainData(c.revisions, 'ANCHOR_PROJECTION_INPUT_DENIED');
  if (canonicalJson(c.revisions)!==canonicalJson(o.expectedRevisions.native)) {
    return project('FALLBACK', {...base, anchorId: anchor.anchorId, reason: 'CONTEXT_REVISION_STALE'});
  }
  if (o.phase === 'UNKNOWN') return project('FALLBACK', {...base, anchorId: anchor.anchorId, reason: 'OUTCOME_UNCONFIRMED'});
  if (o.phase !== 'RESULT_CONFIRMED') {
    // A legacy DISPATCHED row is not a dispatch attestation (begin-only proves
    // nothing): never claim TARGET_ATTEMPTED here; exact dispatch phase
    // classification is an explicitly open remainder of UI-ACT-699.
    return project('PENDING', {...base, anchorId: anchor.anchorId, targetClass: anchor.targetClass,
      displayPhase: o.phase === 'DISPATCHED' ? 'ADMITTED' : o.phase,
      reason: 'PHASE_' + o.phase, stepText: pendingText[o.phase], objectId: target.objectId});
  }
  if (anchor.kind === 'MODULE_CARD_INSTANCE') {
    if (!c.view) return project('FALLBACK', {...base, anchorId: anchor.anchorId, reason: 'CONTEXT_REVISION_STALE'});
    if (c.view.revision !== o.expectedRevisions.viewRevision || c.view.viewDigest !== o.expectedRevisions.viewDigest) {
      return project('FALLBACK', {...base, anchorId: anchor.anchorId, reason: 'CONTEXT_REVISION_STALE'});
    }
  } else {
    const peer = c.surfaces.find((s) => s.surfaceId === target.surfaceId);
    if (!peer) return project('FALLBACK', {...base, anchorId: anchor.anchorId, reason: 'SURFACE_UNAVAILABLE'});
    plainData(peer.revisions, 'ANCHOR_PROJECTION_INPUT_DENIED');
    if (canonicalJson(peer.revisions)!==canonicalJson(o.expectedRevisions.target)) {
      return project('FALLBACK', {...base, anchorId: anchor.anchorId, reason: 'SURFACE_REVISION_STALE'});
    }
  }
  const uiTargetRef = Object.freeze({
    schemaVersion: 'pansphaira.workspace-action-anchor/target-ref/v1', kind: 'REPRESENTATION_ONLY',
    anchorId: anchor.anchorId, objectId: target.objectId,
    instanceId: target.instanceId ?? null, surfaceId: target.surfaceId ?? null,
    dataAttributes: Object.freeze({'data-pan-anchor': anchor.anchorId, 'data-pan-object': target.objectId}),
  });
  return project('BOUND', {...base, anchorId: anchor.anchorId, targetClass: anchor.targetClass,
    uiTargetRef, displayPhase: o.rendered === true ? 'RENDERED' : 'CONFIRMED',
    highlightAllowed: o.rendered === true,
    reason: 'EXACT_REGISTERED_ANCHOR', stepText: 'Action confirmed on the registered anchor.',
    objectId: target.objectId});
}
