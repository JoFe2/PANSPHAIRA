#!/usr/bin/env node

import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import Ajv2020 from 'ajv/dist/2020.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const schemaPath = path.join(root, 'docs/development/azure-power-platform/alm-package-plan.schema.json');
const transitionKinds = ['EXPORT', 'IMPORT', 'UPGRADE', 'ROLLBACK', 'PUBLICATION', 'PROMOTION'];
const exact = {
  package: { id: 'pansphaira.synthetic-alm-package', version: '2.3.0', immutable: true, digest: '2222222222222222222222222222222222222222222222222222222222222222', manifestDigest: '4444444444444444444444444444444444444444444444444444444444444444', exportDigest: '3333333333333333333333333333333333333333333333333333333333333333' },
  tuple: {
    component: { id: 'synthetic-power-platform-component', version: '2.3.0', digest: '5555555555555555555555555555555555555555555555555555555555555555' },
    schema: { id: 'synthetic-alm-contract', version: '1.4.0', digest: '6666666666666666666666666666666666666666666666666666666666666666' },
    policy: { id: 'synthetic-alm-policy', version: '1.0.0', generation: 17, digest: '1111111111111111111111111111111111111111111111111111111111111111' },
    packageDigest: '2222222222222222222222222222222222222222222222222222222222222222',
    candidateTupleDigest: '7777777777777777777777777777777777777777777777777777777777777777',
    lkgTupleDigest: '8888888888888888888888888888888888888888888888888888888888888888',
  },
  migrationDigest: '9999999999999999999999999999999999999999999999999999999999999999',
};
const expectedAuthorities = ['proposer', 'exportOwner', 'importOwner', 'upgradeOwner', 'rollbackOwner', 'publicationOwner', 'promotionOwner', 'verifier'];
const exactAuthorities = { proposer: 'opaque-authority-proposer-001', exportOwner: 'opaque-authority-export-002', importOwner: 'opaque-authority-import-003', upgradeOwner: 'opaque-authority-upgrade-004', rollbackOwner: 'opaque-authority-rollback-005', publicationOwner: 'opaque-authority-publication-006', promotionOwner: 'opaque-authority-promotion-007', verifier: 'opaque-authority-verifier-008' };
const expectedTransitionAuthorities = { EXPORT: 'exportOwner', IMPORT: 'importOwner', UPGRADE: 'upgradeOwner', ROLLBACK: 'rollbackOwner', PUBLICATION: 'publicationOwner', PROMOTION: 'promotionOwner' };
const expectedNegativeResults = [
  ['TENANT_IDENTIFIER', 'TENANT_IDENTIFIER_DENIED'], ['ENVIRONMENT_IDENTIFIER', 'ENVIRONMENT_IDENTIFIER_DENIED'], ['CREDENTIAL', 'CREDENTIAL_DENIED'], ['CONNECTION_STRING', 'CONNECTION_STRING_DENIED'], ['REUSABLE_SECRET_REFERENCE', 'REUSABLE_SECRET_REFERENCE_DENIED'], ['PRODUCTION_CLASS', 'PRODUCTION_CLASS_DENIED'], ['IMPLICIT_IMPORT', 'IMPLICIT_IMPORT_DENIED'], ['IMPLICIT_PROMOTION', 'IMPLICIT_PROMOTION_DENIED'], ['DIGEST_DRIFT', 'PACKAGE_DIGEST_DRIFT_DENIED'], ['MISSING_LKG_TARGET', 'LKG_TARGET_MISSING_OR_MISMATCH_DENIED'], ['MERGED_AUTHORITIES', 'MERGED_AUTHORITIES_DENIED'], ['DATAVERSE_AS_LEDGER', 'DATAVERSE_LEDGER_DENIED'], ['INFERRED_ROLLBACK_FROM_CANCELLATION', 'CANCELLATION_ROLLBACK_INFERENCE_DENIED'], ['OWNED_RESIDUE', 'ZERO_OWNED_RESIDUE_NOT_PROVEN'],
];
const forbiddenKeys = new Set(['tenant', 'tenantid', 'subscription', 'subscriptionid', 'environmentid', 'environmentidentifier', 'credential', 'password', 'accesstoken', 'connectionstring', 'connectionstrings', 'secretreference', 'reusablesecret', 'secretref', 'dataverseledger', 'dataverseasledger']);
const forbiddenValues = /(?:bearer\s+|secret:\/\/|(?:tenant|subscription|environment)[-_:/]?id\b|(?:accountkey|sharedaccesssignature|clientsecret|connectionstring)\s*=|https?:\/\/|\\\\)/i;

function isObject(value) { return value !== null && typeof value === 'object' && !Array.isArray(value); }
function sameJson(left, right) { return JSON.stringify(left) === JSON.stringify(right); }
function failure(reasonCode) { return { accepted: false, status: 'DENIED', reasonCode, reasonCodes: [reasonCode], projection: { status: 'DENIED', reasonCode } }; }
function success(plan) {
  return { accepted: true, status: 'READY', reasonCode: 'SYNTHETIC_ALM_PLAN_READY', reasonCodes: [], projection: structuredClone(plan.publicSafeProjection) };
}
function sensitiveMaterial(value, key = '') {
  const normalized = key.replace(/[^a-z0-9]/gi, '').toLowerCase();
  if (forbiddenKeys.has(normalized)) return true;
  if (normalized === 'environmentclass' && typeof value === 'string' && /^(production|prod)$/i.test(value)) return true;
  if (typeof value === 'string' && forbiddenValues.test(value)) return true;
  if (Array.isArray(value)) return value.some((item) => sensitiveMaterial(item));
  if (isObject(value)) return Object.entries(value).some(([childKey, child]) => sensitiveMaterial(child, childKey));
  return false;
}
function hasDataverseLedger(value, key = '') {
  const normalized = key.replace(/[^a-z0-9]/gi, '').toLowerCase();
  if ((normalized === 'ledger' || normalized === 'dataverseledger' || normalized === 'dataverseasledger') && (value === 'DATAVERSE' || isObject(value))) return true;
  if (Array.isArray(value)) return value.some((item) => hasDataverseLedger(item));
  if (isObject(value)) return Object.entries(value).some(([childKey, child]) => hasDataverseLedger(child, childKey));
  return false;
}
function assert(condition, reasonCode, detail) { if (!condition) throw Object.assign(new Error(detail), { reasonCode }); }

export async function validatePlanSchema(plan) {
  const schema = JSON.parse(await readFile(schemaPath, 'utf8'));
  const validate = new Ajv2020({ allErrors: true, strict: false }).compile(schema);
  assert(validate(plan), 'PLAN_SCHEMA_DENIED', 'plan does not satisfy the closed ALM package plan schema');
  return true;
}

function validateTransitions(plan) {
  assert(plan.transitions.length === transitionKinds.length, 'TRANSITION_SET_DENIED', 'all six transitions are required exactly once');
  const seen = new Set();
  for (const transition of plan.transitions) {
    assert(!seen.has(transition.kind), 'TRANSITION_SET_DENIED', 'transition kinds must be distinct');
    seen.add(transition.kind);
    assert(transition.state === 'INACTIVE' && transition.operation === 'NO_OP_PLAN_ONLY' && transition.effectCount === 0 && transition.command === null, 'ACTIVE_TRANSITION_DENIED', 'every transition must be inactive and no-op');
    assert(transition.authorization.required === true && transition.authorization.independent === true && transition.authorization.granted === false, 'AUTHORIZATION_STATE_DENIED', 'each transition needs a separate future owner authorization');
    assert(transition.authorization.ownerAuthority === plan.authorities[expectedTransitionAuthorities[transition.kind]], 'AUTHORIZATION_OWNER_MISMATCH_DENIED', 'transition owner does not match its separately named authority');
  }
  assert(sameJson([...seen].sort(), [...transitionKinds].sort()), 'TRANSITION_SET_DENIED', 'import, export, upgrade, rollback, publication, and promotion must all be present');
}

function validatePlanValues(plan) {
  assert(plan.environmentClass === 'LOCAL_SYNTHETIC_REPOSITORY_ONLY', 'ENVIRONMENT_CLASS_DENIED', 'only local synthetic repository evidence is accepted');
  assert(sameJson(plan.policy, exact.tuple.policy), 'POLICY_DIGEST_DRIFT_DENIED', 'top-level policy version, generation, or digest drifted');
  assert(sameJson(plan.package, exact.package), 'PACKAGE_DIGEST_DRIFT_DENIED', 'package identity, version, immutability, or digest drifted');
  assert(sameJson(plan.tuple, exact.tuple), 'TUPLE_DIGEST_DRIFT_DENIED', 'component, schema, policy, package, candidate, or LKG tuple drifted');
  assert(plan.versioning.migrationInput.digest === exact.migrationDigest, 'MIGRATION_DIGEST_DRIFT_DENIED', 'migration input digest drifted');
  assert(plan.rollback.targetTupleDigest === plan.tuple.lkgTupleDigest && plan.resetUninstall.reset.targetTupleDigest === plan.tuple.lkgTupleDigest && plan.resetUninstall.reset.packageDigest === plan.package.digest && plan.resetUninstall.uninstall.packageDigest === plan.package.digest, 'LKG_TARGET_MISSING_OR_MISMATCH_DENIED', 'reset and rollback must name the exact LKG tuple and immutable package');
  assert(plan.rollback.target === 'EXACT_LKG_FULL_TUPLE_FROM_INDEPENDENT_TRUSTED_CONTEXT' && plan.rollback.authorizationRequired === true && plan.rollback.independentOwnerRequired === true, 'LKG_TARGET_MISSING_OR_MISMATCH_DENIED', 'rollback must be separately authorized against an exact independent LKG');
  assert(plan.rollback.inferredFromCancellation === false && plan.rollback.cancellationDisposition === 'CANCELLATION_IS_NOT_ROLLBACK', 'CANCELLATION_ROLLBACK_INFERENCE_DENIED', 'cancellation cannot infer rollback');
  assert(plan.resetUninstall.status === 'ZERO_OWNED_RESIDUE_VERIFIED' && plan.resetUninstall.uninstall.ownedResidueCount === 0 && plan.resetUninstall.uninstall.ownedResidueDigest === '4f53cda18c2baa0c0354bb5f9a3ecbe5ed12ab4d8e11ba873c2f11161202b945' && plan.resetUninstall.uninstall.postcondition === 'ZERO_OWNED_RESIDUE', 'ZERO_OWNED_RESIDUE_NOT_PROVEN', 'applicable reset/uninstall milestone lacks exact zero-residue proof');
  assert(plan.execution.mode === 'NO_OP_PLAN_ONLY' && plan.execution.providerCalls === 0 && plan.execution.externalMutation === false && plan.execution.networkContact === false && plan.execution.implicitImportAllowed === false && plan.execution.implicitPromotionAllowed === false, 'EXECUTION_NOT_NOOP_DENIED', 'plan cannot authorize an implicit or external action');
  const authorities = expectedAuthorities.map((key) => plan.authorities[key]);
  assert(new Set(authorities).size === authorities.length, 'MERGED_AUTHORITIES_DENIED', 'all owner authorities must be distinct');
  assert(sameJson(plan.authorities, exactAuthorities), 'AUTHORITY_PIN_MISMATCH_DENIED', 'authority identifiers differ from the exact synthetic owner set');
  assert(sameJson(plan.publicSafeProjection.transitionKinds, transitionKinds) && plan.publicSafeProjection.packageDigest === plan.package.digest && plan.publicSafeProjection.policyGeneration === plan.policy.generation, 'PUBLIC_PROJECTION_DENIED', 'public projection does not bind the exact package and policy');
  assert(sameJson(plan.negativeResults.map(({ case: caseName, reasonCode }) => [caseName, reasonCode]), expectedNegativeResults), 'NEGATIVE_MATRIX_DENIED', 'negative evidence matrix is incomplete or drifted');
  assert(sameJson(plan.publicSafeProjection.negativeReasonCodes, expectedNegativeResults.map(([, reasonCode]) => reasonCode)), 'PUBLIC_PROJECTION_DENIED', 'public projection does not bind the negative evidence matrix');
  assert(plan.resetUninstall.zeroResidueEvidenceRef === 'evidence-005', 'EVIDENCE_REFERENCE_DENIED', 'zero-residue proof is not bound to the reset/uninstall evidence');
  assert(plan.evidence.refs.every((ref) => ref.redacted === true && /^evidence-[0-9]{3}$/.test(ref.id)), 'EVIDENCE_REFERENCE_DENIED', 'evidence references must be redacted opaque references');
  validateTransitions(plan);
}

export function validateAlmPackagePlan(plan) {
  try {
    if (!isObject(plan)) return failure('PLAN_SCHEMA_DENIED');
    if (plan.environmentClass === 'PRODUCTION' || plan.environmentClass === 'PROD') return failure('PRODUCTION_CLASS_DENIED');
    if (plan.execution?.implicitImportAllowed === true) return failure('IMPLICIT_IMPORT_DENIED');
    if (plan.execution?.implicitPromotionAllowed === true) return failure('IMPLICIT_PROMOTION_DENIED');
    if (hasDataverseLedger(plan)) return failure('DATAVERSE_LEDGER_DENIED');
    if (sensitiveMaterial(plan)) return failure('PUBLIC_SAFE_MATERIAL_DENIED');
    const schema = JSON.parse(requireSchemaText);
    const validate = new Ajv2020({ allErrors: true, strict: false }).compile(schema);
    if (!validate(plan)) return failure('PLAN_SCHEMA_DENIED');
    validatePlanValues(plan);
    return success(plan);
  } catch (error) {
    return failure(error.reasonCode ?? 'PLAN_DENIED');
  }
}

let requireSchemaText = '{}';
try { requireSchemaText = await readFile(schemaPath, 'utf8'); } catch { /* async callers receive schema failure */ }

export function applyNegativeCase(plan, caseId) {
  const candidate = structuredClone(plan);
  switch (caseId) {
    case 'tenant-identifier': candidate.tenantId = 'tenant-synthetic-001'; break;
    case 'environment-identifier': candidate.environmentId = 'environment-synthetic-001'; break;
    case 'credential': candidate.credential = 'Bearer synthetic-value'; break;
    case 'connection-string': candidate.connectionString = 'AccountKey=synthetic-value'; break;
    case 'reusable-secret-reference': candidate.secretReference = 'secret://synthetic-value'; break;
    case 'production-class': candidate.environmentClass = 'PRODUCTION'; break;
    case 'implicit-import': candidate.execution.implicitImportAllowed = true; break;
    case 'implicit-promotion': candidate.execution.implicitPromotionAllowed = true; break;
    case 'digest-drift': candidate.package.digest = 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'; break;
    case 'missing-lkg-target': delete candidate.rollback.targetTupleDigest; break;
    case 'merged-authorities': candidate.authorities.importOwner = candidate.authorities.exportOwner; break;
    case 'dataverse-as-ledger': candidate.ledger = { type: 'DATAVERSE' }; break;
    case 'inferred-rollback-from-cancellation': candidate.rollback.inferredFromCancellation = true; break;
    case 'owned-residue': candidate.resetUninstall.uninstall.ownedResidueCount = 1; break;
    case 'active-transition': candidate.transitions.find((item) => item.kind === 'IMPORT').state = 'ACTIVE'; break;
    default: throw new Error(`unknown negative case: ${caseId}`);
  }
  return candidate;
}

export async function loadFixture(fixturePath, base = root) { return JSON.parse(await readFile(path.resolve(base, fixturePath), 'utf8')); }

async function main() {
  const args = process.argv.slice(2);
  const inputIndex = args.indexOf('--input');
  const fixturePath = inputIndex >= 0 ? args[inputIndex + 1] : undefined;
  if (!fixturePath || inputIndex < 0 || args.length !== 2) { console.error('usage: node tools/azure-power-platform/validate-alm-package-plan.mjs --input <path>'); process.exitCode = 2; return; }
  try {
    const fixture = await loadFixture(fixturePath);
    let result;
    if (fixture?.schemaVersion === 'pansphaira.azure-power-platform/alm-package-plan/v1') result = validateAlmPackagePlan(fixture);
    else if (fixture?.fixtureKind === 'DENIED' && fixture?.baseFixture && Array.isArray(fixture.cases)) {
      const base = await loadFixture(fixture.baseFixture);
      const results = fixture.cases.map(({ caseId, expectedReasonCode }) => {
        const candidate = validateAlmPackagePlan(applyNegativeCase(base, caseId));
        if (candidate.accepted || candidate.reasonCode !== expectedReasonCode) throw new Error(`denial mismatch: ${caseId}`);
        return candidate;
      });
      result = results.at(-1) ?? failure('PLAN_SCHEMA_DENIED');
    } else result = failure('PLAN_SCHEMA_DENIED');
    console.log(JSON.stringify(result.projection));
    process.exitCode = result.accepted ? 0 : 1;
  } catch { console.log(JSON.stringify({ status: 'DENIED', reasonCode: 'PLAN_SCHEMA_DENIED' })); process.exitCode = 1; }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await main();
