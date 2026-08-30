import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import Ajv2020 from 'ajv/dist/2020.js';
import { applyNegativeCase, loadFixture, validateAlmPackagePlan } from '../../tools/azure-power-platform/validate-alm-package-plan.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const validPath = 'tests/fixtures/azure-power-platform/alm-package-plan-valid.json';
const unsafePath = 'tests/fixtures/azure-power-platform/alm-package-plan-unsafe.json';
const schema = JSON.parse(await readFile(path.join(root, 'docs/development/azure-power-platform/alm-package-plan.schema.json'), 'utf8'));
const validateSchema = new Ajv2020({ allErrors: true, strict: true }).compile(schema);
const validPlan = await loadFixture(validPath, root);
const unsafeFixture = await loadFixture(unsafePath, root);

 test('accepts an immutable public-safe no-op ALM plan with six separately gated inactive transitions', () => {
  assert.equal(validateSchema(validPlan), true, JSON.stringify(validateSchema.errors));
  const result = validateAlmPackagePlan(validPlan);
  assert.equal(result.accepted, true, JSON.stringify(result));
  assert.equal(result.reasonCode, 'SYNTHETIC_ALM_PLAN_READY');
  assert.equal(validPlan.package.immutable, true);
  assert.equal(validPlan.package.digest, validPlan.tuple.packageDigest);
  assert.equal(validPlan.rollback.targetTupleDigest, validPlan.tuple.lkgTupleDigest);
  assert.deepEqual(validPlan.transitions.map((transition) => transition.kind), ['EXPORT', 'IMPORT', 'UPGRADE', 'ROLLBACK', 'PUBLICATION', 'PROMOTION']);
  assert.equal(new Set(validPlan.transitions.map((transition) => transition.authorization.ownerAuthority)).size, 6);
  assert.equal(validPlan.resetUninstall.uninstall.ownedResidueCount, 0);
  assert.equal(validPlan.execution.providerCalls, 0);
  assert.equal(JSON.stringify(result.projection).includes('opaque-authority'), false);
  assert.equal(JSON.stringify(result.projection).includes('tenant'), false);
 });

test('unsafe fixture fails closed for every declared escalation', () => {
  assert.equal(unsafeFixture.fixtureKind, 'DENIED');
  for (const { caseId, expectedReasonCode } of unsafeFixture.cases) {
    const first = validateAlmPackagePlan(applyNegativeCase(validPlan, caseId));
    const second = validateAlmPackagePlan(applyNegativeCase(structuredClone(validPlan), caseId));
    assert.equal(first.accepted, false, caseId);
    assert.equal(first.reasonCode, expectedReasonCode, caseId);
    assert.deepEqual(first, second, caseId);
    assert.deepEqual(first.projection, { status: 'DENIED', reasonCode: expectedReasonCode }, caseId);
  }
});

test('schema and runtime reject unknown fields and cannot treat cancellation as rollback', () => {
  const unknown = { ...structuredClone(validPlan), unlisted: true };
  assert.equal(validateSchema(unknown), false);
  assert.equal(validateAlmPackagePlan(unknown).reasonCode, 'PLAN_SCHEMA_DENIED');
  const cancellation = structuredClone(validPlan);
  cancellation.rollback.cancellationDisposition = 'ROLLBACK';
  assert.equal(validateAlmPackagePlan(cancellation).reasonCode, 'PLAN_SCHEMA_DENIED');
});

test('public projection is redacted and records exact policy generation and evidence references', () => {
  const result = validateAlmPackagePlan(validPlan);
  assert.deepEqual(Object.keys(result.projection).sort(), ['environmentClass', 'evidenceRefs', 'negativeReasonCodes', 'packageDigest', 'packageVersion', 'policyGeneration', 'redacted', 'status', 'transitionKinds'].sort());
  assert.equal(result.projection.redacted, true);
  assert.equal(result.projection.policyGeneration, 17);
  assert.deepEqual(result.projection.evidenceRefs, validPlan.evidence.refs.map((ref) => ref.id));
});
