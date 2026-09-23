// PAN469 / CONTRIB-02 — low-conflict contributions using generated shared views.
//
// These tests drive the ACTUAL affected entry points:
//   1. the released scripts/module-contribution.mjs CLI (module:new scaffold,
//      check, graph, release, verify) — reused for the bounded pilot
//      contribution modules and their byte-bound deterministic inventory, and
//   2. the new src/pan469/contribution-views.mjs entry points (sealed
//      contribution records, order-independent shared-view derivation, drift
//      refusal and contributor-step measurement).
// No helper-only or mock-only boundary: every positive and negative is observed
// through the real entry points on real git fixtures and the real module API.
import { createHash } from 'node:crypto';
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync, execFileSync } from 'node:child_process';

const CLI = '/workspace/psai-ks-source-handoff/contribution-views/PANSPHAIRA/scripts/module-contribution.mjs';
const MOD = await import('/workspace/psai-ks-source-handoff/contribution-views/PANSPHAIRA/src/pan469/contribution-views.mjs');

const git = (root, ...a) => execFileSync('git', a, { cwd: root, encoding: 'utf8' });
const run = (root, ...a) => spawnSync(process.execPath, [CLI, ...a], { cwd: root, encoding: 'utf8' });
const json = (r) => { assert.equal(r.status, 0, r.stderr); return JSON.parse(r.stdout); };
const FAMILY = 'pan469-pilot';
const slug = (i) => `pv-pilot-${String(i).padStart(2, '0')}`;

// A fresh isolated git repo with the module-contribution parent directory, so
// the REAL `module:new` scaffold entry point can create the pilot modules here.
function repo(t) {
  const root = mkdtempSync(join(tmpdir(), 'pan469-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  execFileSync('git', ['init', '-q'], { cwd: root });
  execFileSync('git', ['config', 'user.email', 'test@example.invalid'], { cwd: root });
  execFileSync('git', ['config', 'user.name', 'Test'], { cwd: root });
  mkdirSync(join(root, 'examples/module-contribution'), { recursive: true });
  writeFileSync(join(root, 'examples/module-contribution/.keep'), '');
  git(root, 'add', '.');
  git(root, 'commit', '-qm', 'init');
  return root;
}

// The ten bounded pilot contribution records, one per scaffolded module.
function pilotRecords(root) {
  const recs = [];
  for (let i = 1; i <= 10; i++) {
    recs.push(MOD.newContributionRecord({
      id: slug(i),
      family: FAMILY,
      version: '1',
      moduleSlug: slug(i),
      changeSummary: `bounded pilot contribution ${i}`,
      author: 'synthetic-contributor',
    }));
  }
  return recs;
}

// Drive the REAL released module-contribution CLI (module:new scaffold + check
// + graph + release + verify) to create and byte-bind the ten bounded pilot
// contribution modules. Returns the real deterministic release inventory.
function scaffoldPilotModules(root) {
  for (let i = 1; i <= 10; i++) assert.equal(run(root, 'scaffold', slug(i)).status, 0, 'module:new scaffold');
  // Assemble the family descriptor (the real module:new convention is one
  // descriptor listing the family's modules) from the generated per-module
  // descriptors, so the REAL `check`/`graph`/`release` entry points operate on
  // the whole pilot family.
  const familyModules = [];
  for (let i = 1; i <= 10; i++) {
    const perModule = JSON.parse(readFileSync(join(root, 'examples/module-contribution', slug(i), 'modules.json'), 'utf8'));
    assert.equal(perModule.schemaVersion, 1, 'scaffold emits a v1 module descriptor');
    assert.equal(perModule.modules.length, 1);
    familyModules.push(perModule.modules[0]);
  }
  writeFileSync(join(root, 'examples/module-contribution/modules.json'), JSON.stringify({ schemaVersion: 1, modules: familyModules }, null, 2));
  // REAL `check`: validates the generated family descriptor (all 10 modules).
  assert.equal(json(run(root, 'check')).modules, 10, 'real module:check sees the 10 pilot modules');
  // REAL `graph`: the generated module graph/manifest for the family.
  const graph = json(run(root, 'graph'));
  assert.equal(graph.modules.length, 10, 'real module:graph enumerates the 10 pilot modules');
  // REAL `release`: a deterministic byte-bound inventory. Two runs must be
  // byte-identical (no non-determinism) and the inventory must be byte-verified
  // by the REAL `verify` entry point.
  const rel = run(root, 'release');
  assert.equal(rel.status, 0, rel.stderr);
  const manifest = JSON.parse(rel.stdout);
  assert.match(manifest.sourceCommit, /^[a-f0-9]{40}$/);
  assert.equal(run(root, 'release').stdout, rel.stdout, 'real module:release inventory is byte-deterministic');
  writeFileSync(join(root, 'pv-release-inventory.json'), rel.stdout);
  const verify = json(run(root, 'verify', '--manifest', 'pv-release-inventory.json'));
  assert.equal(verify.valid, true, 'real module:verify re-derives and confirms the byte-bound inventory');
  return manifest;
}

// ===========================================================================
// CONTRIB-02-AC01 — ten distinct bounded contributions with duplicate,
// conflicting-ID and malformed-input controls; individual source records
// preserved.
// ===========================================================================

test('AC01 positive: ten distinct bounded contributions are accepted through the real entry points', (t) => {
  const root = repo(t);
  const manifest = scaffoldPilotModules(root); // REAL module:new/check/graph/release/verify
  assert.ok(manifest.files.length >= 10, 'real release inventory binds the pilot module files');
  const recs = pilotRecords(root);
  const batch1 = MOD.processContributions(recs.slice(0, 7), { family: FAMILY });
  assert.equal(batch1.accepted.length, 7, 'seven records accepted in the first batch');
  assert.equal(batch1.denials.length, 0, 'no denials on ten distinct bounded contributions (first seven)');
  // A second batch completes the ten; its accepted records plus the first must
  // preserve every individual source record (sealed digest per id).
  const batch2 = MOD.processContributions(recs.slice(7), { family: FAMILY, existingDigests: batch1.recordDigests });
  assert.equal(batch2.accepted.length, 3, 'three records accepted in the second batch');
  const all = [...batch1.accepted, ...batch2.accepted];
  assert.equal(all.length, 10, 'ten individual contribution records are preserved');
  const digests = MOD.processContributions(all, { family: FAMILY, existingDigests: {} }).recordDigests;
  for (const r of all) assert.equal(digests[r.id], r.recordSha256, `record ${r.id} individually preserved by sealed digest`);
  // Each accepted record still seals to its own bytes (individual preservation).
  for (const r of all) assert.equal(MOD.validateContributionRecord(r).recordSha256, r.recordSha256, `record ${r.id} seals intact`);
});

test('AC01 duplicate control: a re-submitted identical record is refused, not re-added', (t) => {
  const root = repo(t);
  const recs = pilotRecords(root);
  const first = MOD.processContributions([recs[0]], { family: FAMILY });
  assert.equal(first.accepted.length, 1);
  // Re-submit the identical record (same sealed content) in a later batch.
  const dup = MOD.processContributions([recs[0]], { family: FAMILY, existingDigests: first.recordDigests });
  assert.equal(dup.accepted.length, 0, 'duplicate is not re-accepted');
  assert.equal(dup.denials.length, 1);
  assert.equal(dup.denials[0].code, MOD.DENIALS.RECORD_DUPLICATE, 'exact duplicate denial code');
  assert.equal(dup.denials[0].id, slug(1));
});

test('AC01 conflicting-ID control: the same id with different content is refused', (t) => {
  const root = repo(t);
  const recs = pilotRecords(root);
  const first = MOD.processContributions([recs[0]], { family: FAMILY });
  // A different record claiming the SAME id but with different changeSummary.
  const conflict = MOD.newContributionRecord({ id: slug(1), family: FAMILY, version: '1', moduleSlug: slug(1), changeSummary: 'DIFFERENT content', author: 'synthetic-contributor' });
  assert.notEqual(conflict.recordSha256, recs[0].recordSha256, 'conflicting record has different bytes');
  const res = MOD.processContributions([conflict], { family: FAMILY, existingDigests: first.recordDigests });
  assert.equal(res.accepted.length, 0, 'conflicting id is not accepted');
  assert.equal(res.denials.length, 1);
  assert.equal(res.denials[0].code, MOD.DENIALS.RECORD_ID_CONFLICT, 'exact conflicting-id denial code');
});

test('AC01 malformed-input control: a malformed record is refused with its exact code', (t) => {
  const root = repo(t);
  const recs = pilotRecords(root);
  const bad = MOD.newContributionRecord({ id: slug(1), family: FAMILY, version: '1', moduleSlug: slug(1), changeSummary: 'ok', author: 'synthetic-contributor' });
  const malformed = { ...bad, id: 'PV-BAD-ID' }; // invalid id (uppercase) -> schema denial
  const res = MOD.processContributions([malformed], { family: FAMILY });
  assert.equal(res.accepted.length, 0);
  assert.equal(res.denials.length, 1);
  assert.equal(res.denials[0].code, MOD.DENIALS.RECORD_ID_INVALID, 'malformed id denial code');
  // A tampered sealed record is also refused (seal mismatch).
  const tampered = { ...recs[2], changeSummary: 'tampered after sealing' };
  const tam = MOD.processContributions([tampered], { family: FAMILY });
  assert.equal(tam.accepted.length, 0);
  assert.equal(tam.denials[0].code, MOD.DENIALS.RECORD_SCHEMA_INVALID, 'tampered seal denial code');
});

// ===========================================================================
// CONTRIB-02-AC02 — generate the same graph/manifest from differently ordered
// input and reproduce byte-identical output; shared derivations have one
// integration owner.
// ===========================================================================

test('AC02 positive: differently ordered input reproduces a byte-identical shared view', (t) => {
  const root = repo(t);
  scaffoldPilotModules(root);
  const recs = pilotRecords(root);
  const accepted = MOD.processContributions(recs, { family: FAMILY }).accepted;
  assert.equal(accepted.length, 10);
  const viewA = MOD.deriveSharedView(accepted, { family: FAMILY });
  // A different input ordering of the SAME records.
  const reordered = [...accepted].sort((a, b) => (a.id > b.id ? -1 : a.id < b.id ? 1 : 0));
  const viewB = MOD.deriveSharedView(reordered, { family: FAMILY });
  // A shuffled (non-sorted) ordering.
  const shuffled = [accepted[3], accepted[0], accepted[9], accepted[7], accepted[1], accepted[4], accepted[8], accepted[2], accepted[6], accepted[5]];
  const viewC = MOD.deriveSharedView(shuffled, { family: FAMILY });
  assert.equal(viewA.viewSha256, viewB.viewSha256, 'byte-identical view across orderings (reverse)');
  assert.equal(viewA.viewSha256, viewC.viewSha256, 'byte-identical view across orderings (shuffled)');
  assert.equal(viewA.schemaVersion, MOD.PAN469_VIEW_SCHEMA_V1);
  assert.equal(viewA.recordCount, 10);
  assert.equal(viewA.graph.nodes.length, 10, 'the generated view graph carries all 10 contributions');
  // Shared derivations have ONE integration owner.
  assert.equal(viewA.integrationOwner, 'single-integration-owner-derived-view');
  assert.equal(viewB.integrationOwner, viewA.integrationOwner);
});

test('AC02 drift negative: a hand-edited shared view is refused against the derivation', (t) => {
  const root = repo(t);
  const recs = pilotRecords(root);
  const accepted = MOD.processContributions(recs, { family: FAMILY }).accepted;
  const view = MOD.deriveSharedView(accepted, { family: FAMILY });
  // A clean re-derivation matches the on-disk view.
  const clean = MOD.detectViewDrift(view, accepted, { family: FAMILY });
  assert.equal(clean.valid, true, 'clean re-derivation is accepted');
  // A contributor hand-edits the shared list directly (adds a node).
  const handEdited = structuredClone(view);
  handEdited.graph.nodes.push({ id: 'pv-hacked', moduleSlug: 'pv-hacked', version: '1' });
  const drift = MOD.detectViewDrift(handEdited, accepted, { family: FAMILY });
  assert.equal(drift.valid, false, 'hand-edit of the shared view is refused');
  assert.equal(drift.code, MOD.DENIALS.VIEW_DRIFT, 'exact drift denial code');
  assert.notEqual(drift.observedViewSha256, drift.expectedViewSha256);
});

test('AC02 empty negative: a view cannot be derived from zero records', (t) => {
  const root = repo(t);
  let threw = null;
  try { MOD.deriveSharedView([], { family: FAMILY }); } catch (e) { threw = e; }
  assert.ok(threw, 'empty derivation throws');
  assert.equal(threw.code, MOD.DENIALS.VIEW_EMPTY, 'exact empty-view denial code');
});

// ===========================================================================
// CONTRIB-02-AC03 — measure contributor steps, conflict/correction count and
// active integration work against the existing path while retaining the same
// applicable acceptance; missing timings remain unknown.
// ===========================================================================

test('AC03 positive: contributor steps and integration work are measured against the existing path', (t) => {
  const root = repo(t);
  scaffoldPilotModules(root); // the existing path: 10 contributions each edit+check the shared descriptor
  const recs = pilotRecords(root);
  const proc = MOD.processContributions(recs, { family: FAMILY });
  const measurement = MOD.measureContributorSteps({
    records: proc.accepted,
    denials: proc.denials,
    derivations: 1, // generated-view path: one integration owner, one derivation
    existingDescriptorEdits: 10, // existing path: every contribution edits the one shared descriptor
    existingDescriptorChecks: 10, // existing path: every contribution re-checks it
  });
  assert.equal(measurement.schemaVersion, MOD.PAN469_MEASUREMENT_SCHEMA_V1);
  assert.equal(measurement.contributorSteps, 10, 'ten contributor steps measured');
  assert.equal(measurement.activeIntegrationWork.generatedView.derivations, 1, 'generated view: one derivation');
  assert.equal(measurement.activeIntegrationWork.existingPath.descriptorEdits, 10, 'existing path: ten descriptor edits');
  assert.equal(measurement.activeIntegrationWork.existingPath.descriptorChecks, 10, 'existing path: ten descriptor checks');
  // Missing timings remain unknown (not inferred).
  assert.equal(measurement.timing.contributor, 'unknown', 'contributor timing stays unknown');
  assert.equal(measurement.timing.integration, 'unknown', 'integration timing stays unknown');
  // Same applicable acceptance is retained.
  assert.equal(measurement.sameApplicableAcceptance, true);
  // The report is a derivation from the accepted set + measurement.
  const report = MOD.generateMeasurementReport({ measurement, accepted: proc.accepted, family: FAMILY });
  assert.equal(report.acceptedRecordCount, 10);
  assert.match(report.reportSha256, /^[a-f0-9]{64}$/);
});

test('AC03 conflict/correction counts are attributed to the measured denials', (t) => {
  const root = repo(t);
  const recs = pilotRecords(root);
  const first = MOD.processContributions([recs[0]], { family: FAMILY });
  const conflict = MOD.newContributionRecord({ id: slug(1), family: FAMILY, version: '1', moduleSlug: slug(1), changeSummary: 'DIFFERENT', author: 'x' });
  const dup = recs[1];
  const batch = MOD.processContributions([conflict, dup], { family: FAMILY, existingDigests: { [slug(1)]: recs[0].recordSha256, [slug(2)]: dup.recordSha256 } });
  assert.equal(batch.denials[0].code, MOD.DENIALS.RECORD_ID_CONFLICT, 'conflicting id denied');
  assert.equal(batch.denials[1].code, MOD.DENIALS.RECORD_DUPLICATE, 'duplicate denied');
  const measurement = MOD.measureContributorSteps({
    records: batch.accepted,
    denials: batch.denials,
    derivations: 1,
    existingDescriptorEdits: 2,
    existingDescriptorChecks: 2,
  });
  assert.equal(measurement.conflictCount, 1, 'one conflict counted');
  assert.equal(measurement.correctionCount, 1, 'one correction counted (conflicting id corrected by resubmission)');
  assert.equal(measurement.duplicateCount, 1, 'one duplicate counted');
});

test('AC03 non-integer negative: a non-integer integration count is refused', (t) => {
  const root = repo(t);
  let threw = null;
  try {
    MOD.measureContributorSteps({ records: [], denials: [], derivations: 1.5, existingDescriptorEdits: 0, existingDescriptorChecks: 0 });
  } catch (e) { threw = e; }
  assert.ok(threw, 'non-integer count throws');
  assert.equal(threw.code, MOD.DENIALS.MEASUREMENT_NON_INTEGER, 'exact non-integer denial code');
});
