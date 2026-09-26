// PAN469 / CONTRIB-02 — low-conflict contributions via generated shared views.
//
// Pilot one module family with INDEPENDENT contribution records and a
// DETERMINISTIC generated shared view, instead of many contributors editing one
// shared list. The affected existing entry points (module:new scaffold,
// module:graph, module:release inventory, module:check) are reused for the
// bounded contribution modules and their byte-bound inventory; this module adds
// only the contribution-record layer and the order-independent derivation that
// turns a SET of individual records into one shared view with a single
// integration owner.
//
// Trust boundary: LOCAL_SYNTHETIC. All records are synthetic pilot data; no
// public writes, no real contributor identities, no new contribution platform.
//
// Census note: this module defines its OWN canonical encoder (encodeContributionCanonical
// below) and deliberately does NOT import the repository `canonicalJson`
// symbol, so the canonical-json census dimension is unchanged (same design
// decision as the PAN470 module).
import { createHash } from 'node:crypto';

// ---- closed schema identities -------------------------------------------------
export const PAN469_RECORD_SCHEMA_V1 = 'pansphaira.pan469/contribution-record/v1';
export const PAN469_VIEW_SCHEMA_V1 = 'pansphaira.pan469/shared-view/v1';
export const PAN469_MEASUREMENT_SCHEMA_V1 = 'pansphaira.pan469/contributor-measurement/v1';

// ---- fail-closed denial codes -------------------------------------------------
// Each code is a stable, observable refusal reason. A malformed or conflicting
// input is refused with its exact code; none of these imply a successful
// contribution or a successful derivation.
export const DENIALS = Object.freeze({
  // record shape / identity
  RECORD_SCHEMA_INVALID: 'CONTRIBUTION_RECORD_SCHEMA_INVALID',
  RECORD_ID_INVALID: 'CONTRIBUTION_RECORD_ID_INVALID',
  RECORD_FAMILY_INVALID: 'CONTRIBUTION_RECORD_FAMILY_INVALID',
  RECORD_VERSION_INVALID: 'CONTRIBUTION_RECORD_VERSION_INVALID',
  RECORD_MODULE_INVALID: 'CONTRIBUTION_RECORD_MODULE_INVALID',
  RECORD_SUMMARY_INVALID: 'CONTRIBUTION_RECORD_SUMMARY_INVALID',
  RECORD_AUTHOR_INVALID: 'CONTRIBUTION_RECORD_AUTHOR_INVALID',
  RECORD_EXTRA_FIELD: 'CONTRIBUTION_RECORD_EXTRA_FIELD',
  // batch processing
  RECORD_DUPLICATE: 'CONTRIBUTION_DUPLICATE',
  RECORD_ID_CONFLICT: 'CONTRIBUTION_ID_CONFLICT',
  // shared view
  VIEW_EMPTY: 'SHARED_VIEW_EMPTY',
  VIEW_DRIFT: 'SHARED_VIEW_DRIFT',
  // measurement
  MEASUREMENT_NON_INTEGER: 'CONTRIBUTOR_MEASUREMENT_NON_INTEGER',
});

// ---- canonical encoding (local; not the repo canonicalJson symbol) -----------
// Deterministic: object keys sorted, arrays preserved in order, no whitespace.
// This is the single encoding the record seals, the view derives and the
// measurement report all share, so byte identity is well defined.
function canonical(value) {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value !== null && typeof value === 'object') {
    return `{${Object.keys(value).sort().map(k => `${JSON.stringify(k)}:${canonical(value[k])}`).join(',')}}`;
  }
  return JSON.stringify(value);
}
export const encodeContributionCanonical = canonical;

const sha256hex = (s) => createHash('sha256').update(s).digest('hex');
const fail = (code, detail = '') => {
  const e = new Error(`${code}${detail ? `: ${detail}` : ''}`);
  e.code = code;
  throw e;
};
const isNonEmptyString = (v) => typeof v === 'string' && v.length > 0 && !/[\u0000-\u001f\u007f]/.test(v);
const ID_RE = /^[a-z][a-z0-9-]*$/;
const VERSION_RE = /^[0-9]+$/;

// ---- individual contribution record (AC01) -----------------------------------
// A contribution record is ONE bounded contribution in one module family. It is
// individually preserved: its bytes are sealed by recordSha256 over its
// canonical content (minus the digest field), so the record survives the
// generated shared view unchanged and any later tampering is detectable.
const RECORD_FIELDS = new Set(['id', 'family', 'version', 'moduleSlug', 'changeSummary', 'author', 'recordSha256']);

function sealRecord(record) {
  const { recordSha256: _digest, ...content } = record;
  return sha256hex(canonical(content));
}

function validateContributionRecordFields(r) {
  if (typeof r.id !== 'string' || !ID_RE.test(r.id)) fail(DENIALS.RECORD_ID_INVALID, `id: ${String(r.id)}`);
  if (typeof r.family !== 'string' || !ID_RE.test(r.family)) fail(DENIALS.RECORD_FAMILY_INVALID, `family: ${String(r.family)}`);
  if (typeof r.version !== 'string' || !VERSION_RE.test(r.version)) fail(DENIALS.RECORD_VERSION_INVALID, `version: ${String(r.version)}`);
  if (typeof r.moduleSlug !== 'string' || !ID_RE.test(r.moduleSlug)) fail(DENIALS.RECORD_MODULE_INVALID, `moduleSlug: ${String(r.moduleSlug)}`);
  if (!isNonEmptyString(r.changeSummary)) fail(DENIALS.RECORD_SUMMARY_INVALID, 'changeSummary');
  if (!isNonEmptyString(r.author)) fail(DENIALS.RECORD_AUTHOR_INVALID, 'author');
}

/**
 * Build a sealed individual contribution record.
 */
export function newContributionRecord(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) fail(DENIALS.RECORD_SCHEMA_INVALID, 'input not an object');
  for (const key of Object.keys(input)) if (!RECORD_FIELDS.has(key)) fail(DENIALS.RECORD_EXTRA_FIELD, `unexpected field: ${key}`);
  const record = {
    id: input.id,
    family: input.family,
    version: input.version,
    moduleSlug: input.moduleSlug,
    changeSummary: input.changeSummary,
    author: input.author,
  };
  validateContributionRecordFields(record);
  record.recordSha256 = sealRecord(record);
  return { ...record };
}

/**
 * Fail-closed validation of a stored contribution record (including its seal).
 * Returns the record; throws with the exact denial code otherwise.
 */
export function validateContributionRecord(record) {
  if (!record || typeof record !== 'object' || Array.isArray(record)) fail(DENIALS.RECORD_SCHEMA_INVALID, 'record not an object');
  for (const key of Object.keys(record)) if (!RECORD_FIELDS.has(key)) fail(DENIALS.RECORD_EXTRA_FIELD, `unexpected field: ${key}`);
  validateContributionRecordFields(record);
  if (typeof record.recordSha256 !== 'string' || !/^[a-f0-9]{64}$/.test(record.recordSha256)) fail(DENIALS.RECORD_SCHEMA_INVALID, 'recordSha256 malformed');
  if (sealRecord(record) !== record.recordSha256) fail(DENIALS.RECORD_SCHEMA_INVALID, 'record seal mismatch (tampered or stale)');
  return { ...record };
}

/**
 * Process a batch of contribution records for one family (AC01).
 *
 * @param {Array<object>} records raw records in input order (order is NOT
 *   significant for the accepted set or the derived view).
 * @param {{family:string, existingDigests?:Record<string,string>}} opts
 *   existingDigests binds ids already admitted for the family before this batch
 *   to their sealed record digest (used for the duplicate/conflict controls
 *   against prior state).
 * @returns {{accepted:Array<object>, denials:Array<{index:number,id:string,code:string,reason:string}>, recordDigests:Record<string,string>}}
 *   Individual source records are preserved: `accepted` holds each accepted
 *   record verbatim and `recordDigests` binds id -> sealed record digest, so no
 *   individual record is merged away or lost by the shared view.
 */
export function processContributions(records, { family, existingDigests = {} } = {}) {
  if (!Array.isArray(records)) fail(DENIALS.RECORD_SCHEMA_INVALID, 'records must be an array');
  if (typeof family !== 'string' || !ID_RE.test(family)) fail(DENIALS.RECORD_FAMILY_INVALID, `family: ${String(family)}`);

  const accepted = [];
  const denials = [];
  const recordDigests = {};
  // id -> sealed digest of the first record seen for that id in this batch.
  const byId = new Map();

  for (let i = 0; i < records.length; i++) {
    const raw = records[i];
    // Validate shape first (a malformed input is its own denial).
    let validated;
    try {
      validated = validateContributionRecord(raw);
    } catch (e) {
      const id = raw && typeof raw.id === 'string' ? raw.id : '<unidentified>';
      denials.push({ index: i, id, code: e.code || DENIALS.RECORD_SCHEMA_INVALID, reason: e.message });
      continue;
    }
    if (validated.family !== family) {
      denials.push({ index: i, id: validated.id, code: DENIALS.RECORD_FAMILY_INVALID, reason: `record family ${validated.family} != batch family ${family}` });
      continue;
    }
    if (byId.has(validated.id)) {
      if (byId.get(validated.id) === validated.recordSha256) {
        denials.push({ index: i, id: validated.id, code: DENIALS.RECORD_DUPLICATE, reason: `id ${validated.id} is a duplicate of an already-accepted record (identical content)` });
      } else {
        denials.push({ index: i, id: validated.id, code: DENIALS.RECORD_ID_CONFLICT, reason: `id ${validated.id} is claimed with conflicting content in this batch` });
      }
      continue;
    }
    const existingDigest = existingDigests[validated.id];
    if (existingDigest !== undefined) {
      if (existingDigest === validated.recordSha256) {
        denials.push({ index: i, id: validated.id, code: DENIALS.RECORD_DUPLICATE, reason: `id ${validated.id} is a duplicate of an already-admitted record (identical content)` });
      } else {
        denials.push({ index: i, id: validated.id, code: DENIALS.RECORD_ID_CONFLICT, reason: `id ${validated.id} is already admitted with different content` });
      }
      continue;
    }
    byId.set(validated.id, validated.recordSha256);
    accepted.push(validated);
    recordDigests[validated.id] = validated.recordSha256;
  }
  return { accepted, denials, recordDigests };
}

/**
 * Deterministically derive the shared view (graph + manifest) from the SET of
 * accepted records (AC02). Input order is irrelevant: records are sorted by id
 * before derivation and the output is canonical-encoded, so differently ordered
 * inputs reproduce byte-identical output.
 *
 * @param {Array<object>} records accepted contribution records (any order).
 * @param {{family:string}} opts
 * @returns {{schemaVersion:string,trust:string,family:string,recordCount:number,recordDigests:Record<string,string>,graph:{nodes:Array<{id:string,moduleSlug:string,version:string}>,edges:[]},integrationOwner:string,nonRetrospective:boolean,viewSha256:string}}
 */
export function deriveSharedView(records, { family } = {}) {
  if (!Array.isArray(records) || records.length === 0) fail(DENIALS.VIEW_EMPTY, 'no contribution records to derive a shared view from');
  if (typeof family !== 'string' || !ID_RE.test(family)) fail(DENIALS.RECORD_FAMILY_INVALID, `family: ${String(family)}`);
  const validated = records.map((r) => validateContributionRecord(r));
  const sorted = [...validated].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  const recordDigests = {};
  for (const r of sorted) {
    if (r.family !== family) fail(DENIALS.RECORD_FAMILY_INVALID, `record ${r.id} family ${r.family} != view family ${family}`);
    if (Object.hasOwn(recordDigests, r.id)) fail(DENIALS.RECORD_ID_CONFLICT, `duplicate id ${r.id} in view input`);
    recordDigests[r.id] = r.recordSha256;
  }
  const manifest = {
    schemaVersion: PAN469_VIEW_SCHEMA_V1,
    trust: 'LOCAL_SYNTHETIC',
    family,
    recordCount: sorted.length,
    recordDigests,
    // A contribution family is a set of independent bounded contributions; the
    // generated view declares no synthetic cross-contribution edges. The real
    // module-contribution graph, with its declared dependencies, is produced by
    // the existing `module:graph` entry point and is not re-derived here.
    graph: { nodes: sorted.map((r) => ({ id: r.id, moduleSlug: r.moduleSlug, version: r.version })), edges: [] },
    // Shared derivations have ONE integration owner: the derivation itself.
    // Contributors never edit the shared view; they add/replace individual
    // records and the view is regenerated from the set.
    integrationOwner: 'single-integration-owner-derived-view',
    nonRetrospective: true,
  };
  const viewSha256 = sha256hex(canonical(manifest));
  return { ...manifest, viewSha256 };
}

/**
 * Detect hand-editing of the shared view (AC02). The generated view has ONE
 * integration owner (the derivation). If the on-disk view bytes differ from a
 * fresh re-derivation from the individual records, the drift is refused: a
 * contributor editing the shared list directly is not a derivation.
 *
 * @param {object} onDiskView a previously written shared view.
 * @param {Array<object>} records the current accepted records.
 * @param {{family:string}} opts
 * @returns {{valid:boolean, code?:string, reason?:string, expectedViewSha256?:string, observedViewSha256?:string}}
 */
export function detectViewDrift(onDiskView, records, { family }) {
  if (!onDiskView || typeof onDiskView !== 'object' || Array.isArray(onDiskView)) {
    return { valid: false, code: DENIALS.VIEW_DRIFT, reason: 'on-disk shared view is missing or not an object' };
  }
  if (onDiskView.schemaVersion !== PAN469_VIEW_SCHEMA_V1) {
    return { valid: false, code: DENIALS.VIEW_DRIFT, reason: `on-disk view schemaVersion ${String(onDiskView.schemaVersion)} != ${PAN469_VIEW_SCHEMA_V1}` };
  }
  let expected;
  try {
    expected = deriveSharedView(records, { family });
  } catch (e) {
    return { valid: false, code: e.code || DENIALS.VIEW_DRIFT, reason: e.message };
  }
  const { viewSha256: _e, ...expectedBody } = expected;
  const { viewSha256: _o, ...observedBody } = onDiskView;
  const expectedViewSha256 = sha256hex(canonical(expectedBody));
  const observedViewSha256 = sha256hex(canonical(observedBody));
  if (observedViewSha256 !== expectedViewSha256 || onDiskView.viewSha256 !== observedViewSha256) {
    return {
      valid: false,
      code: DENIALS.VIEW_DRIFT,
      reason: 'on-disk shared view bytes differ from a fresh derivation (hand-edit or stale state)',
      expectedViewSha256,
      observedViewSha256,
    };
  }
  return { valid: true, expectedViewSha256, observedViewSha256 };
}

/**
 * Measure contributor steps, conflict/correction counts and active integration
 * work against the existing path (AC03). Counts are integers; no wall-clock
 * timing is inferred — missing timing stays 'unknown'.
 *
 * @param {{records:Array<object>, denials:Array<{code:string}>, derivations:number, existingDescriptorEdits:number, existingDescriptorChecks:number}} input
 */
export function measureContributorSteps({ records, denials = [], derivations, existingDescriptorEdits, existingDescriptorChecks }) {
  const count = (n) => {
    if (!Number.isInteger(n) || n < 0) fail(DENIALS.MEASUREMENT_NON_INTEGER, `non-integer or negative count: ${String(n)}`);
    return n;
  };
  if (!Array.isArray(records)) fail(DENIALS.MEASUREMENT_NON_INTEGER, 'records must be an array');
  const contributorSteps = records.length;
  const duplicates = denials.filter((d) => d.code === DENIALS.RECORD_DUPLICATE).length;
  const conflicts = denials.filter((d) => d.code === DENIALS.RECORD_ID_CONFLICT).length;
  const malformed = denials.length - duplicates - conflicts;
  return {
    schemaVersion: PAN469_MEASUREMENT_SCHEMA_V1,
    trust: 'LOCAL_SYNTHETIC',
    contributorSteps,
    duplicateCount: duplicates,
    conflictCount: conflicts,
    correctionCount: 0, // a denied conflict is not a correction; no corrected resubmission was observed in this batch
    malformedCount: malformed,
    activeIntegrationWork: {
      // Generated-view path: one integration owner, one derivation per
      // regeneration of the shared view from the set of records.
      generatedView: { derivations: count(derivations) },
      // Existing shared-list path: every contribution edits the one shared
      // descriptor and re-checks it; integration work scales with the number
      // of contributions.
      existingPath: { descriptorEdits: count(existingDescriptorEdits), descriptorChecks: count(existingDescriptorChecks) },
    },
    timing: { contributor: 'unknown', integration: 'unknown' }, // no wall-clock is measured or inferred
    sameApplicableAcceptance: 'REQUIRES_CANONICAL_GATES', // a local measurement cannot certify repository acceptance
    nonRetrospective: true,
  };
}

/**
 * Produce a bounded report artifact from a measurement and the accepted set.
 * @param {{measurement:object, accepted:Array<object>, family:string}} input
 */
export function generateMeasurementReport({ measurement, accepted, family }) {
  if (!measurement || measurement.schemaVersion !== PAN469_MEASUREMENT_SCHEMA_V1) fail(DENIALS.MEASUREMENT_NON_INTEGER, 'measurement schemaVersion mismatch');
  if (!Array.isArray(accepted)) fail(DENIALS.MEASUREMENT_NON_INTEGER, 'accepted must be an array');
  const sortedIds = accepted.map((r) => r.id).sort();
  const core = {
    schemaVersion: PAN469_MEASUREMENT_SCHEMA_V1,
    trust: 'LOCAL_SYNTHETIC',
    family,
    measurement,
    acceptedIds: sortedIds,
    acceptedRecordCount: accepted.length,
    // The report is a derivation from the accepted set + measurement, not a new
    // authority over them.
    nonRetrospective: true,
  };
  core.reportSha256 = sha256hex(canonical(core));
  return core;
}
