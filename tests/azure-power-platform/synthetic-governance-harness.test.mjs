import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { canonicalBytes, runHarness } from '../../tools/azure-power-platform/run-synthetic-governance-harness.mjs';

const root = new URL('../../', import.meta.url);
const tool = new URL('../../tools/azure-power-platform/run-synthetic-governance-harness.mjs', import.meta.url);
const fixture = (name) => new URL(`../fixtures/azure-power-platform/${name}`, import.meta.url).pathname;

const requiredDenials = [
  'UNKNOWN_ACTION',
  'UNKNOWN_FIELD',
  'HIDDEN_WRITE',
  'SELF_APPROVAL',
  'DIGEST_DRIFT',
  'REPLAY_NONCE',
  'EXPIRY',
  'REVOCATION',
  'STALE_POLICY',
  'MISSING_READBACK',
  'RECEIPT_TAMPER',
  'STALE_TUPLE',
  'GENERIC_ESCAPE',
  'UNAUTHORIZED_IMPORT_MARKER',
  'NONZERO_RESIDUE',
];

test('synthetic read-only acceptance binds authoritative readback and receipt', async () => {
  const evidence = await runHarness(fixture('e2e-readonly-success.json'));
  assert.equal(evidence.outcome, 'ALLOW');
  assert.equal(evidence.evidenceClass, 'DRY_RUN_SYNTHETIC_PROOF');
  assert.equal(evidence.realSandboxEvidence, false);
  assert.deepEqual(evidence.acceptedOperations.map((operation) => operation.operation), [
    'READ_RECORD', 'UPDATE_SYNTHETIC_RECORD', 'RESET_TO_LKG',
  ]);
  assert.equal(evidence.acceptedOperations[0].authoritativeReadback, 'READ_CONFIRMED');
  assert.equal(evidence.acceptedOperations[0].receipt, 'BOUND');
  assert.equal(evidence.acceptedOperations[1].lifecycleState, 'EXECUTION_REQUEST');
  assert.equal(evidence.acceptedOperations[1].directExecutionAllowed, false);
  assert.equal(evidence.acceptedOperations[1].providerCallPerformed, false);
  assert.equal(evidence.resetProof.ownedResidueCount, 0);
  assert.equal(evidence.resetProof.postInventoryCount, 0);
  assert.deepEqual(evidence.sideEffects, {
    networkCalls: 0,
    credentialUses: 0,
    tenantDiscoveries: 0,
    providerCalls: 0,
    mutationCount: 0,
    ownedResidueCount: 0,
  });
  assert.deepEqual([...requiredDenials].sort(), evidence.negativeResults.map((result) => result.id).filter((id) => requiredDenials.includes(id)).sort());
  for (const result of evidence.negativeResults) {
    assert.equal(result.outcome, 'DENY');
    assert.equal(result.effectCount, 0);
    assert.equal(result.mutationCount, 0);
  }
  assert.equal(evidence.rollback.target, 'EXACT_LKG_FULL_TUPLE_DIGEST_FROM_INDEPENDENT_TRUSTED_CONTEXT');
  assert.ok(evidence.versionsAndDigests.authoritativeReadback.actionDigest);
  assert.ok(evidence.versionsAndDigests.resetUninstall.lkgTupleDigest);
  assert.ok(evidence.evidenceRefs.every((ref) => /^[a-f0-9]{64}$/.test(ref.sha256)));
});

test('the denied proposal case is fail closed and side-effect free', async () => {
  const evidence = await runHarness(fixture('e2e-proposal-denied.json'));
  assert.equal(evidence.outcome, 'DENY');
  assert.deepEqual(evidence.acceptedOperations, []);
  assert.equal(evidence.sideEffects.mutationCount, 0);
  assert.equal(evidence.sideEffects.providerCalls, 0);
  const requested = evidence.negativeResults.find((result) => result.id === 'REQUESTED_PROPOSAL');
  assert.deepEqual(requested, {
    id: 'REQUESTED_PROPOSAL',
    outcome: 'DENY',
    reasonCode: 'SELF_APPROVAL_DENIED',
    effectCount: 0,
    mutationCount: 0,
  });
  assert.ok(evidence.negativeResults.some((result) => result.id === 'LIFECYCLE_SELF_APPROVAL'));
});

test('reset fixture proves exact reset and zero owned residue', async () => {
  const evidence = await runHarness(fixture('e2e-reset.json'));
  assert.equal(evidence.outcome, 'ALLOW');
  assert.equal(evidence.resetProof.outcome, 'RESET_TO_LKG_AND_EMPTY');
  assert.equal(evidence.resetProof.ownedResidueCount, 0);
  assert.equal(evidence.resetProof.postInventoryCount, 0);
  assert.equal(evidence.resetProof.uninstallAttempted, false);
  assert.equal(evidence.acceptedOperations[1].lifecycleState, 'EXECUTION_REQUEST');
  assert.equal(evidence.acceptedOperations[1].providerCallPerformed, false);
  assert.equal(evidence.acceptedOperations[2].effectCount, 5);
});

test('two in-process runs have identical public-safe evidence bytes', async () => {
  const first = await runHarness(fixture('e2e-readonly-success.json'));
  const second = await runHarness(fixture('e2e-readonly-success.json'));
  assert.ok(canonicalBytes(first).equals(canonicalBytes(second)));
  assert.equal(first.publicEvidenceDigest, second.publicEvidenceDigest);
});

test('CLI flags expose deterministic dry-run evidence and expected denial', () => {
  const run = (name, ...args) => JSON.parse(execFileSync(process.execPath, [tool.pathname, '--dry-run', '--fixture', fixture(name), ...args], { cwd: new URL(root).pathname, encoding: 'utf8', env: { ...process.env, NODE_OPTIONS: '--jitless' } }));
  const success = run('e2e-readonly-success.json', '--assert-byte-deterministic');
  assert.equal(success.byteDeterministic, true);
  assert.equal(success.outcome, 'ALLOW');
  const denied = run('e2e-proposal-denied.json', '--expect-denied');
  assert.equal(denied.outcome, 'DENY');
  const reset = run('e2e-reset.json', '--assert-zero-residue');
  assert.equal(reset.resetProof.postInventoryCount, 0);
});

test('fixture input is local and injected, not a generic external operation', async () => {
  await assert.rejects(() => runHarness('/tmp/not-an-allowlisted-fixture.json'), /allowlisted fixture directory/);
  const source = await readFile(new URL('../../tools/azure-power-platform/run-synthetic-governance-harness.mjs', import.meta.url), 'utf8');
  assert.doesNotMatch(source, /from ['"]node:(?:http|https|net|tls|child_process)['"]/);
  assert.doesNotMatch(source, /\b(?:fetch|spawn|exec|docker|az)\s*\(/);
});
