import assert from 'node:assert/strict';
import { test } from 'node:test';
import { loadFixture, verifyZeroResidue, applyNegativeCase, digestJson } from '../../tools/azure-power-platform/verify-zero-residue.mjs';

const fixturePath = 'tests/fixtures/azure-power-platform/zero-residue.json';

function rebindEvidence(fixture) {
  const execution = fixture.execution;
  execution.operation.requestDigest = digestJson(execution.operation.request);
  execution.readback.operationId = execution.operation.operationId;
  execution.receipt.operationId = execution.operation.operationId;
  execution.preTuple.ownedInventoryDigest = digestJson(execution.ownedInventoryBefore);
  execution.postTuple.ownedInventoryDigest = digestJson(execution.ownedInventoryAfter);
  const preTupleDigest = digestJson(execution.preTuple);
  const postTupleDigest = digestJson(execution.postTuple);
  execution.readback.requestDigest = execution.operation.requestDigest;
  execution.readback.preTupleDigest = preTupleDigest;
  execution.readback.postTupleDigest = postTupleDigest;
  execution.readback.ownedResidueProjectionDigest = digestJson(execution.ownedResidueProjection.resources);
  execution.readback.inventoryDigest = digestJson(execution.ownedInventoryAfter);
  const readbackDigest = digestJson(execution.readback);
  execution.receipt.requestDigest = execution.operation.requestDigest;
  execution.receipt.readbackDigest = readbackDigest;
  execution.receipt.fullTupleDigest = digestJson({ preTupleDigest, postTupleDigest, readbackDigest });
  delete execution.receipt.receiptDigest;
  execution.receipt.receiptDigest = digestJson(execution.receipt);
  return fixture;
}

function noImportFixture(base) {
  const fixture = structuredClone(base);
  const { execution } = fixture;
  execution.operation.operationId = 'synthetic-no-import-check-0001';
  execution.operation.operationKind = 'NO_IMPORT_CHECK';
  execution.operation.request = { packageId: fixture.plan.package.id, targetTupleDigest: fixture.plan.tuple.lkgTupleDigest, mode: 'NO_IMPORT_CHECK' };
  execution.operation.effectCount = 0;
  execution.operation.recovery = { mode: 'NONE', authorizationStatus: 'NOT_REQUIRED', authorizationDigest: null, requiresNewReceiptReadback: false, notCancellation: true };
  execution.ownedInventoryBefore = [];
  execution.ownedInventoryAfter = [];
  execution.preTuple.tupleDigest = fixture.plan.tuple.lkgTupleDigest;
  execution.readback.outcome = 'NO_IMPORT_CLEAN';
  execution.readback.effectCount = 0;
  execution.receipt.outcome = 'NO_IMPORT_CLEAN';
  return rebindEvidence(fixture);
}

test('synthetic owned inventory resets to exact LKG and has zero owned residue', async () => {
  const result = await verifyZeroResidue(await loadFixture(fixturePath));
  assert.equal(result.ok, true);
  assert.equal(result.reasonCode, 'ZERO_OWNED_RESIDUE_VERIFIED');
  assert.equal(result.postTupleDigest, '56db83a16d1910f1eefca3000997df95cfb8696fdb45b399baf1a62b6ab1da79');
});

test('no-import state is idempotently recognized as clean', async () => {
  const base = await loadFixture(fixturePath);
  const result = await verifyZeroResidue(noImportFixture(base));
  assert.equal(result.ok, true);
  assert.equal(result.reasonCode, 'ZERO_OWNED_RESIDUE_VERIFIED');
});

test('negative evidence fails closed for every owned-residue and evidence condition', async () => {
  const base = await loadFixture(fixturePath);
  const cases = new Map([
    ['unknown-owned-object', 'UNKNOWN_OWNED_OBJECT_DENIED'],
    ['leftover-connector-binding', 'LEFTOVER_CONNECTOR_BINDING_DENIED'],
    ['leftover-flow', 'LEFTOVER_FLOW_DENIED'],
    ['leftover-policy-reference', 'LEFTOVER_POLICY_REFERENCE_DENIED'],
    ['ledger-mutation', 'LEDGER_MUTATION_DENIED'],
    ['tuple-mismatch', 'TUPLE_MISMATCH_DENIED'],
    ['missing-readback', 'MISSING_READBACK_DENIED'],
    ['inferred-cancellation', 'CANCELLATION_INFERRED_DENIED'],
    ['missing-new-recovery-evidence', 'NEW_RECEIPT_READBACK_REQUIRED_DENIED'],
  ]);
  for (const [caseName, reasonCode] of cases) {
    const result = await verifyZeroResidue(applyNegativeCase(base, caseName));
    assert.equal(result.ok, false, caseName);
    assert.equal(result.reasonCode, reasonCode, caseName);
  }
});

test('authorized compensation is distinct from cancellation and binds fresh evidence', async () => {
  const fixture = await loadFixture(fixturePath);
  fixture.execution.operation.operationId = 'synthetic-compensation-0001';
  fixture.execution.operation.recovery.mode = 'AUTHORIZED_COMPENSATION';
  fixture.execution.receipt.issuedAt = '2026-08-28T00:00:02Z';
  rebindEvidence(fixture);
  const result = await verifyZeroResidue(fixture);
  assert.equal(result.ok, true);
});

test('the committed nonzero fixture is fail-closed when exercised through the verifier', async () => {
  const negative = await loadFixture('tests/fixtures/azure-power-platform/nonzero-residue.json');
  const result = await verifyZeroResidue(applyNegativeCase(await loadFixture(negative.baseFixture), negative.caseName));
  assert.equal(result.ok, false);
  assert.equal(result.reasonCode, negative.expectedReasonCode);
});
