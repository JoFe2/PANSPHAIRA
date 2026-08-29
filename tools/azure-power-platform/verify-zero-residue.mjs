#!/usr/bin/env node

import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import Ajv2020 from 'ajv/dist/2020.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '../..');
const PLAN_SCHEMA_PATH = resolve(ROOT, 'docs/development/azure-power-platform/reset-uninstall-plan.schema.json');
const PACKAGE = {
  id: 'pansphaira.readonly-canvas-workbench',
  version: '1.0.0',
  manifestPath: 'power-platform/readonly-canvas-workbench/manifest.json',
  manifestSha256: '6ebad932d63f541b17d365f130cc2207d9326baeaa91c521a95685a9c9a143a9',
  bindingPath: 'power-platform/readonly-canvas-workbench/connector-binding.json',
  bindingSha256: '051eefbc6f97145a96c24f0d3629861c1b60b932a6d00db6503c059457126cc3',
};
const RESOURCE_CLASSES = Object.freeze([
  'SYNTHETIC_CANVAS_PACKAGE',
  'SYNTHETIC_CONNECTOR_BINDING',
  'SYNTHETIC_READ_FLOW',
  'SYNTHETIC_POLICY_REFERENCE',
  'SYNTHETIC_TUPLE_LEDGER',
]);
const RESOURCE_IDS = new Set([
  'synthetic-canvas-package',
  'synthetic-connector-binding',
  'synthetic-read-flow',
  'synthetic-policy-reference',
  'synthetic-tuple-ledger',
]);
const HASH = /^[a-f0-9]{64}$/;
const FIXTURE_SCHEMA = 'pansphaira.azure-power-platform/reset-uninstall-fixture/v1';
const EXACT_TUPLE = {
  component: { id: 'power-platform-read-connector', version: '1.0.0', digest: '71805da9cf453748dbde0917bcf5477a90fa5aca828fe9d8c30d88de6c758830' },
  schema: { id: 'power-platform-read-connector-schema', version: '1.0.0', digest: 'd555893c9ac16923fb9607c723aaf190c8796bac4a61d5727c7635e5dda1f63f' },
  policy: { id: 'policy:synthetic-safe-guided', version: '1.0.0', generation: null, generationReason: 'The capability policy v1 export is version-and-digest bound and does not export a numeric policyGeneration.', digest: 'c0670df5ef0d91635316b52f66cc65123792b857c328d24e21daf98a0adf2b89' },
  candidateTupleDigest: 'fde14e6eb8b3f6e10a1f2e6d6b646d534ed23456c2e404d10946345fb32b4a15',
  lkgTupleDigest: '5555555555555555555555555555555555555555555555555555555555555555',
};
const EXACT_EVIDENCE = {
  'contracts/azure-power-platform/readonly-connector.openapi.yaml': '20b5505962cf08ed813002f2a210f2db9fcfed37f374d4959baa912cf2d56287',
  'contracts/azure-power-platform/authoritative-readback-receipt.schema.json': '20d7a20a812857a6bd79d3c324bd2a5c9f40cd995a865f4857e3b7224a2a37f8',
  'power-platform/readonly-canvas-workbench/manifest.json': PACKAGE.manifestSha256,
  'power-platform/readonly-canvas-workbench/connector-binding.json': PACKAGE.bindingSha256,
  'tests/azure-power-platform/azpp-m1-tuple-ledger.test.mjs': '30b68a35cb950058a2e13a2c1f1637059ed4902f0b113b1ebde06062ca29edc9',
  'tests/azure-power-platform/authoritative-readback-receipt.test.mjs': '3542b9c5b578d37b4562f8f5f5cb4808aef666e721f5f0358a99e81e1a80dd58',
};

export function canonicalize(value) {
  if (Array.isArray(value)) return `[${value.map(canonicalize).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonicalize(value[key])}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

export function digestJson(value) {
  return createHash('sha256').update(canonicalize(value)).digest('hex');
}

function fail(reasonCode, detail) {
  return { ok: false, reasonCode, detail };
}

function assert(condition, reasonCode, detail) {
  if (!condition) throw Object.assign(new Error(detail), { reasonCode });
}

function objectWithout(object, field) {
  const result = { ...object };
  delete result[field];
  return result;
}

function sameJson(left, right) {
  return canonicalize(left) === canonicalize(right);
}

function exactKeys(value, expected, reasonCode) {
  assert(value && typeof value === 'object' && !Array.isArray(value), reasonCode, 'expected an object');
  assert(sameJson(Object.keys(value).sort(), [...expected].sort()), reasonCode, `fields must be exactly ${expected.join(',')}`);
}

async function sha256File(relativePath) {
  const bytes = await readFile(resolve(ROOT, relativePath));
  return createHash('sha256').update(bytes).digest('hex');
}

export async function validatePlanSchema(plan) {
  const schema = JSON.parse(await readFile(PLAN_SCHEMA_PATH, 'utf8'));
  const ajv = new Ajv2020({ allErrors: true, strict: false });
  const validate = ajv.compile(schema);
  assert(validate(plan), 'PLAN_SCHEMA_DENIED', ajv.errorsText(validate.errors));
  assert(plan.environmentClass === 'LOCAL_SYNTHETIC_REPOSITORY_ONLY', 'ENVIRONMENT_CLASS_DENIED', 'only the local synthetic repository class is accepted');
  assert(sameJson(plan.ownedResourceClasses, RESOURCE_CLASSES), 'RESOURCE_CLASS_DENIED', 'resource classes are not the package-owned synthetic set');
  assert(plan.package.manifestSha256 === await sha256File(PACKAGE.manifestPath), 'PACKAGE_DIGEST_MISMATCH_DENIED', 'manifest byte digest differs from the exact pin');
  assert(plan.package.bindingSha256 === await sha256File(PACKAGE.bindingPath), 'PACKAGE_DIGEST_MISMATCH_DENIED', 'connector binding byte digest differs from the exact pin');
  assert(sameJson(plan.package, PACKAGE), 'PACKAGE_PIN_MISMATCH_DENIED', 'package identity, version, paths, or digests differ from the declared pin');
  assert(sameJson(plan.tuple, EXACT_TUPLE), 'TUPLE_PIN_MISMATCH_DENIED', 'component, schema, policy, candidate, or LKG tuple digest differs from the exact pin');
  assert(plan.tuple.policy.generation === null, 'POLICY_GENERATION_MISMATCH_DENIED', 'this binding requires an explicit null policy generation');
  assert(plan.resetContract.uninstall.command === null && plan.resetContract.uninstall.tenantContactAllowed === false && plan.resetContract.uninstall.attempted === false, 'UNINSTALL_EXECUTION_DENIED', 'uninstall must remain an unattempted offline plan');
  assert(plan.rollback.targetTupleDigest === plan.tuple.lkgTupleDigest, 'ROLLBACK_TARGET_MISMATCH_DENIED', 'rollback target is not the declared exact LKG tuple');
  assert(plan.evidenceRefs.length === Object.keys(EXACT_EVIDENCE).length, 'EVIDENCE_REFERENCE_DENIED', 'evidence reference set is not exact');
  for (const evidence of plan.evidenceRefs) {
    assert(EXACT_EVIDENCE[evidence.ref] === evidence.sha256, 'EVIDENCE_REFERENCE_DENIED', `evidence digest is not the exact pin for ${evidence.ref}`);
    assert(await sha256File(evidence.ref) === evidence.sha256, 'EVIDENCE_DIGEST_MISMATCH_DENIED', `evidence bytes differ for ${evidence.ref}`);
  }
  return true;
}

function validateResourceInventory(inventory, tupleDigest, where) {
  assert(Array.isArray(inventory), 'INVENTORY_SHAPE_DENIED', `${where} inventory must be an array`);
  const seen = new Set();
  for (const resource of inventory) {
    exactKeys(resource, ['resourceClass', 'resourceId', 'ownerPackageId', 'state', 'tupleDigest'], 'INVENTORY_SHAPE_DENIED');
    assert(RESOURCE_CLASSES.includes(resource.resourceClass), 'UNKNOWN_OWNED_OBJECT_DENIED', `${where} contains an unknown resource class`);
    assert(RESOURCE_IDS.has(resource.resourceId), 'UNKNOWN_OWNED_OBJECT_DENIED', `${where} contains an unknown resource id`);
    assert(!seen.has(resource.resourceId), 'UNKNOWN_OWNED_OBJECT_DENIED', `${where} contains a duplicate resource id`);
    seen.add(resource.resourceId);
    assert(resource.ownerPackageId === PACKAGE.id, 'FOREIGN_RESOURCE_DENIED', `${where} contains a non-package owner`);
    assert(resource.state === 'PRESENT', 'INVENTORY_STATE_DENIED', `${where} resource is not a present synthetic object`);
    if (resource.tupleDigest !== tupleDigest) {
      const mutationCode = resource.resourceId === 'synthetic-tuple-ledger' ? 'LEDGER_MUTATION_DENIED' : 'TUPLE_MISMATCH_DENIED';
      assert(false, mutationCode, `${where} resource is not bound to the tuple`);
    }
  }
  return seen;
}

function validateTuple(tuple, expected, inventoryDigest, where) {
  exactKeys(tuple, ['schemaVersion', 'environmentClass', 'packageId', 'packageVersion', 'manifestSha256', 'bindingSha256', 'policyId', 'policyVersion', 'policyGeneration', 'policyDigest', 'tupleDigest', 'ownedInventoryDigest'], 'TUPLE_SHAPE_DENIED');
  for (const [field, value] of Object.entries(expected)) {
    assert(tuple[field] === value, 'TUPLE_MISMATCH_DENIED', `${where}.${field} differs from the declared exact tuple`);
  }
  assert(tuple.ownedInventoryDigest === inventoryDigest, 'TUPLE_MISMATCH_DENIED', `${where}.ownedInventoryDigest does not bind its inventory`);
  return digestJson(tuple);
}

function validateRecovery(operation, fixture) {
  exactKeys(operation, ['schemaVersion', 'operationId', 'operationKind', 'request', 'requestDigest', 'effectCount', 'recovery'], 'OPERATION_SHAPE_DENIED');
  exactKeys(operation.recovery, ['mode', 'authorizationStatus', 'authorizationDigest', 'requiresNewReceiptReadback', 'notCancellation'], 'RECOVERY_SHAPE_DENIED');
  const mode = operation.recovery.mode;
  const cancellation = operation.operationKind === 'CANCELLATION' || mode === 'CANCELLATION' || operation.outcome === 'CANCELLED' || fixture.outcome === 'CANCELLED';
  assert(!cancellation, 'CANCELLATION_INFERRED_DENIED', 'cancellation cannot be inferred as reset or compensation');
  if (mode === 'AUTHORIZED_ROLLBACK' || mode === 'AUTHORIZED_COMPENSATION') {
    assert(operation.recovery.authorizationStatus === 'FRESH_AUTHORIZED', 'NEW_RECEIPT_READBACK_REQUIRED_DENIED', 'rollback or compensation requires fresh authorization');
    assert(HASH.test(operation.recovery.authorizationDigest), 'NEW_RECEIPT_READBACK_REQUIRED_DENIED', 'recovery authorization must be digest-bound');
    assert(operation.recovery.requiresNewReceiptReadback === true && operation.recovery.notCancellation === true, 'NEW_RECEIPT_READBACK_REQUIRED_DENIED', 'recovery requires a new receipt and readback and must not be cancellation');
    assert(operation.operationId !== fixture.priorOperationId, 'NEW_RECEIPT_READBACK_REQUIRED_DENIED', 'recovery reused the prior operation');
  } else {
    assert(mode === 'NONE', 'RECOVERY_MODE_DENIED', 'recovery mode is neither authorized rollback/compensation nor no recovery');
    assert(operation.recovery.authorizationStatus === 'NOT_REQUIRED' && operation.recovery.authorizationDigest === null && operation.recovery.requiresNewReceiptReadback === false && operation.recovery.notCancellation === true, 'RECOVERY_SHAPE_DENIED', 'no-recovery fields are inconsistent');
  }
  assert(operation.operationId.length > 0 && operation.operationId.length < 128, 'OPERATION_ID_DENIED', 'operation id is missing or unreasonable');
  assert(operation.request && typeof operation.request === 'object', 'REQUEST_SHAPE_DENIED', 'request is required');
  assert(operation.requestDigest === digestJson(operation.request), 'REQUEST_DIGEST_MISMATCH_DENIED', 'request digest does not match request');
}

function validateReadback(readback, operation, preTupleDigest, postTupleDigest, residueDigest, postInventoryDigest) {
  exactKeys(readback, ['schemaVersion', 'source', 'operationId', 'requestDigest', 'preTupleDigest', 'postTupleDigest', 'status', 'outcome', 'ownedResidueCount', 'ownedResidueProjectionDigest', 'inventoryDigest', 'effectCount', 'observedAt'], 'READBACK_SHAPE_DENIED');
  assert(readback.schemaVersion === 'pansphaira.azure-power-platform/reset-uninstall-readback/v1', 'READBACK_SHAPE_DENIED', 'unsupported readback schema');
  assert(readback.source === 'LOCAL_SYNTHETIC_AUTHORITATIVE_READBACK', 'READBACK_SOURCE_DENIED', 'readback is not from the local authoritative synthetic projection');
  assert(readback.operationId === operation.operationId && readback.requestDigest === operation.requestDigest, 'READBACK_MISMATCH_DENIED', 'readback is not for this operation and request');
  assert(readback.preTupleDigest === preTupleDigest && readback.postTupleDigest === postTupleDigest, 'TUPLE_MISMATCH_DENIED', 'readback tuple references do not match');
  assert(readback.status === 'READ_CONFIRMED', 'MISSING_READBACK_DENIED', 'authoritative readback was not confirmed');
  assert(readback.ownedResidueCount === 0 && readback.ownedResidueProjectionDigest === residueDigest, 'RESIDUE_PRESENT_DENIED', 'owned residue projection is not empty');
  assert(readback.inventoryDigest === postInventoryDigest, 'READBACK_MISMATCH_DENIED', 'readback inventory digest differs from post state');
  assert(Number.isInteger(readback.effectCount) && readback.effectCount >= 0, 'READBACK_SHAPE_DENIED', 'readback effect count is invalid');
  assert(typeof readback.observedAt === 'string' && readback.observedAt.length > 0, 'READBACK_SHAPE_DENIED', 'readback timestamp is missing');
  return digestJson(readback);
}

function validateReceipt(receipt, operation, readbackDigest, fullTupleDigest, fixture) {
  exactKeys(receipt, ['schemaVersion', 'issuer', 'operationId', 'requestDigest', 'readbackDigest', 'fullTupleDigest', 'outcome', 'receiptDigest', 'issuedAt'], 'RECEIPT_SHAPE_DENIED');
  assert(receipt.schemaVersion === 'pansphaira.azure-power-platform/reset-uninstall-receipt/v1', 'RECEIPT_SHAPE_DENIED', 'unsupported receipt schema');
  assert(receipt.issuer === 'LOCAL_SYNTHETIC_VERIFICATION_HARNESS', 'RECEIPT_ISSUER_DENIED', 'receipt issuer is not the local harness');
  assert(receipt.operationId === operation.operationId && receipt.requestDigest === operation.requestDigest, 'RECEIPT_MISMATCH_DENIED', 'receipt is not for this operation and request');
  assert(receipt.readbackDigest === readbackDigest && receipt.fullTupleDigest === fullTupleDigest, 'RECEIPT_MISMATCH_DENIED', 'receipt does not bind the readback and full tuple');
  assert(receipt.outcome === 'RESET_TO_LKG_AND_EMPTY' || receipt.outcome === 'NO_IMPORT_CLEAN', 'RECEIPT_OUTCOME_DENIED', 'receipt outcome is not an accepted clean outcome');
  assert(receipt.receiptDigest === digestJson(objectWithout(receipt, 'receiptDigest')), 'RECEIPT_DIGEST_MISMATCH_DENIED', 'receipt digest is not self-consistent');
  assert(receipt.receiptDigest !== fixture.priorReceiptDigest && receipt.readbackDigest !== fixture.priorReadbackDigest, 'NEW_RECEIPT_READBACK_REQUIRED_DENIED', 'recovery reused an earlier receipt or readback');
  assert(typeof receipt.issuedAt === 'string' && receipt.issuedAt.length > 0, 'RECEIPT_SHAPE_DENIED', 'receipt timestamp is missing');
}

export async function verifyZeroResidue(fixture) {
  try {
    assert(fixture && fixture.schemaVersion === FIXTURE_SCHEMA, 'FIXTURE_SCHEMA_DENIED', 'unsupported fixture schema');
    assert(fixture.environmentClass === 'LOCAL_SYNTHETIC_REPOSITORY_ONLY', 'ENVIRONMENT_CLASS_DENIED', 'fixture is not local synthetic evidence');
    assert(fixture.plan && fixture.execution, 'FIXTURE_SHAPE_DENIED', 'plan and execution are required');
    await validatePlanSchema(fixture.plan);
    const { plan, execution } = fixture;
    const operation = execution.operation;
    validateRecovery(operation, fixture);
    const target = {
      schemaVersion: 'pansphaira.azure-power-platform/reset-uninstall-tuple/v1',
      environmentClass: plan.environmentClass,
      packageId: plan.package.id,
      packageVersion: plan.package.version,
      manifestSha256: plan.package.manifestSha256,
      bindingSha256: plan.package.bindingSha256,
      policyId: plan.tuple.policy.id,
      policyVersion: plan.tuple.policy.version,
      policyGeneration: plan.tuple.policy.generation,
      policyDigest: plan.tuple.policy.digest,
    };
    const preInventorySet = validateResourceInventory(execution.ownedInventoryBefore, plan.tuple.candidateTupleDigest, 'pre');
    const postInventorySet = validateResourceInventory(execution.ownedInventoryAfter, plan.tuple.lkgTupleDigest, 'post');
    assert(operation.operationKind === 'RESET_TO_LKG' || operation.operationKind === 'NO_IMPORT_CHECK', 'OPERATION_KIND_DENIED', 'operation is outside the plan');
    assert(operation.request.packageId === plan.package.id && operation.request.targetTupleDigest === plan.tuple.lkgTupleDigest && operation.request.mode === operation.operationKind, 'REQUEST_TARGET_MISMATCH_DENIED', 'request does not target the exact package LKG operation');
    if (operation.operationKind === 'NO_IMPORT_CHECK') {
      assert(preInventorySet.size === 0 && postInventorySet.size === 0, 'NO_IMPORT_NOT_CLEAN_DENIED', 'no-import state must have no owned inventory');
      assert(operation.recovery.mode === 'NONE', 'RECOVERY_MODE_DENIED', 'no-import check cannot claim rollback or compensation');
    } else {
      assert(preInventorySet.size === RESOURCE_IDS.size, 'OWNED_INVENTORY_INCOMPLETE_DENIED', 'reset proof must start with the complete synthetic owned inventory');
      if (postInventorySet.size !== 0) {
        const leftover = execution.ownedInventoryAfter[0];
        const residueCode = {
          SYNTHETIC_CONNECTOR_BINDING: 'LEFTOVER_CONNECTOR_BINDING_DENIED',
          SYNTHETIC_READ_FLOW: 'LEFTOVER_FLOW_DENIED',
          SYNTHETIC_POLICY_REFERENCE: 'LEFTOVER_POLICY_REFERENCE_DENIED',
        }[leftover.resourceClass] ?? 'RESIDUE_PRESENT_DENIED';
        assert(false, residueCode, 'reset proof contains package-owned residue');
      }
      assert(operation.effectCount === preInventorySet.size, 'EFFECT_COUNT_MISMATCH_DENIED', 'reset effect count must cover each owned synthetic resource');
    }
    const preInventoryDigest = digestJson(execution.ownedInventoryBefore);
    const postInventoryDigest = digestJson(execution.ownedInventoryAfter);
    const preTupleDigest = validateTuple(execution.preTuple, { ...target, tupleDigest: operation.operationKind === 'NO_IMPORT_CHECK' ? plan.tuple.lkgTupleDigest : plan.tuple.candidateTupleDigest }, preInventoryDigest, 'preTuple');
    const postTupleDigest = validateTuple(execution.postTuple, { ...target, tupleDigest: plan.tuple.lkgTupleDigest }, postInventoryDigest, 'postTuple');
    assert(execution.preTuple.ownedInventoryDigest === preInventoryDigest, 'TUPLE_MISMATCH_DENIED', 'pre tuple inventory digest mismatch');
    assert(execution.postTuple.ownedInventoryDigest === postInventoryDigest, 'TUPLE_MISMATCH_DENIED', 'post tuple inventory digest mismatch');
      assert(execution.readback, 'MISSING_READBACK_DENIED', 'authoritative readback is missing');
    assert(execution.ownedResidueProjection && sameJson(execution.ownedResidueProjection.resourceClasses, RESOURCE_CLASSES), 'RESIDUE_PROJECTION_SHAPE_DENIED', 'residue projection must cover only the named package-owned classes');
    exactKeys(execution.ownedResidueProjection, ['schemaVersion', 'resourceClasses', 'resources', 'count', 'digest'], 'RESIDUE_PROJECTION_SHAPE_DENIED');
    assert(execution.ownedResidueProjection.schemaVersion === 'pansphaira.azure-power-platform/owned-residue/v1', 'RESIDUE_PROJECTION_SHAPE_DENIED', 'unsupported residue projection schema');
    assert(sameJson(execution.ownedResidueProjection.resources, execution.ownedInventoryAfter), 'RESIDUE_PROJECTION_MISMATCH_DENIED', 'residue projection is not the post inventory projection');
    assert(execution.ownedResidueProjection.count === execution.ownedResidueProjection.resources.length, 'RESIDUE_PROJECTION_MISMATCH_DENIED', 'residue count does not match projection');
    assert(execution.ownedResidueProjection.digest === digestJson(execution.ownedResidueProjection.resources), 'RESIDUE_PROJECTION_MISMATCH_DENIED', 'residue projection digest mismatch');
    const residueDigest = execution.ownedResidueProjection.digest;
    const readbackDigest = validateReadback(execution.readback, operation, preTupleDigest, postTupleDigest, residueDigest, postInventoryDigest);
    const fullTupleDigest = digestJson({ preTupleDigest, postTupleDigest, readbackDigest });
    validateReceipt(execution.receipt, operation, readbackDigest, fullTupleDigest, fixture);
    return { ok: true, reasonCode: 'ZERO_OWNED_RESIDUE_VERIFIED', operationId: operation.operationId, postTupleDigest, readbackDigest, receiptDigest: execution.receipt.receiptDigest };
  } catch (error) {
    return fail(error.reasonCode ?? 'ZERO_RESIDUE_VERIFICATION_FAILED', error.message);
  }
}

export async function loadFixture(path) {
  return JSON.parse(await readFile(resolve(ROOT, path), 'utf8'));
}

export function applyNegativeCase(fixture, caseName) {
  const mutated = structuredClone(fixture);
  switch (caseName) {
    case 'unknown-owned-object': mutated.execution.ownedInventoryAfter.push({ resourceClass: 'SYNTHETIC_UNKNOWN', resourceId: 'synthetic-unknown', ownerPackageId: PACKAGE.id, state: 'PRESENT', tupleDigest: mutated.plan.tuple.lkgTupleDigest }); break;
    case 'leftover-connector-binding': mutated.execution.ownedInventoryAfter.push({ resourceClass: 'SYNTHETIC_CONNECTOR_BINDING', resourceId: 'synthetic-connector-binding', ownerPackageId: PACKAGE.id, state: 'PRESENT', tupleDigest: mutated.plan.tuple.lkgTupleDigest }); break;
    case 'leftover-flow': mutated.execution.ownedInventoryAfter.push({ resourceClass: 'SYNTHETIC_READ_FLOW', resourceId: 'synthetic-read-flow', ownerPackageId: PACKAGE.id, state: 'PRESENT', tupleDigest: mutated.plan.tuple.lkgTupleDigest }); break;
    case 'leftover-policy-reference': mutated.execution.ownedInventoryAfter.push({ resourceClass: 'SYNTHETIC_POLICY_REFERENCE', resourceId: 'synthetic-policy-reference', ownerPackageId: PACKAGE.id, state: 'PRESENT', tupleDigest: mutated.plan.tuple.lkgTupleDigest }); break;
    case 'ledger-mutation': mutated.execution.ownedInventoryBefore.find((resource) => resource.resourceId === 'synthetic-tuple-ledger').tupleDigest = 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'; break;
    case 'tuple-mismatch': mutated.execution.postTuple.tupleDigest = 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'; break;
    case 'missing-readback': delete mutated.execution.readback; break;
    case 'inferred-cancellation': mutated.execution.operation.recovery.mode = 'CANCELLATION'; break;
    case 'missing-new-recovery-evidence': mutated.execution.operation.recovery.requiresNewReceiptReadback = false; break;
    default: throw new Error(`unknown negative case: ${caseName}`);
  }
  return mutated;
}

if (process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url))) {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const fixtureIndex = args.indexOf('--fixture');
  const fixturePath = fixtureIndex >= 0 ? args[fixtureIndex + 1] : null;
  if (!dryRun || !fixturePath || args.length !== 3) {
    console.error('usage: verify-zero-residue.mjs --dry-run --fixture <local-json>');
    process.exitCode = 2;
  } else {
    const fixture = await loadFixture(fixturePath);
    let candidate = fixture;
    if (fixture.fixtureKind === 'NEGATIVE_CASE') candidate = applyNegativeCase(await loadFixture(fixture.baseFixture), fixture.caseName);
    const result = await verifyZeroResidue(candidate);
    console.log(JSON.stringify(result));
    process.exitCode = result.ok ? 0 : 1;
  }
}
