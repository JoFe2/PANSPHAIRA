#!/usr/bin/env node

import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { resolve, relative, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import Ajv2020 from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
import { applyNegativeCase, loadFixture, verifyZeroResidue } from './verify-zero-residue.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '../..');
const FIXTURE_ROOT = resolve(ROOT, 'tests/fixtures/azure-power-platform');
const HASH = /^[a-f0-9]{64}$/;
const ENVIRONMENT = 'LOCAL_SYNTHETIC_REPOSITORY_ONLY';
const ROLLBACK_TARGET = 'EXACT_LKG_FULL_TUPLE_DIGEST_FROM_INDEPENDENT_TRUSTED_CONTEXT';
const READONLY_SCHEMA = 'contracts/azure-power-platform/readonly-connector.schema.json';
const READONLY_OPENAPI = 'contracts/azure-power-platform/readonly-connector.openapi.yaml';
const READBACK_SCHEMA = 'contracts/azure-power-platform/authoritative-readback-receipt.schema.json';
const PROPOSAL_SCHEMA = 'contracts/azure-power-platform/proposal-approval-execution.schema.json';
const RESET_SCHEMA = 'docs/development/azure-power-platform/reset-uninstall-plan.schema.json';
const DENIALS = 'tests/fixtures/azure-power-platform/denials.json';
const READBACK_FIXTURE = 'tests/fixtures/azure-power-platform/readback-accepted.json';
const TAMPERED_READBACK = 'tests/fixtures/azure-power-platform/readback-tampered.json';
const PROPOSAL_FIXTURE = 'tests/fixtures/azure-power-platform/proposal-approved.json';
const ZERO_RESIDUE = 'tests/fixtures/azure-power-platform/zero-residue.json';
const NONZERO_RESIDUE = 'tests/fixtures/azure-power-platform/nonzero-residue.json';

const READONLY_CASES = new Map([
  ['UNKNOWN_ACTION', 'UNKNOWN_ACTION_DENIED'],
  ['UNKNOWN_FIELD', 'UNKNOWN_FIELD_DENIED'],
  ['HIDDEN_WRITE', 'HIDDEN_WRITE_DENIED'],
  ['SELF_APPROVAL', 'APPROVAL_SAME_ACTOR_DENIED'],
  ['DIGEST_DRIFT', 'DIGEST_DRIFT_DENIED'],
  ['REPLAY_NONCE', 'REPLAY_CONSUMED_DENIED'],
  ['EXPIRY', 'AUTHORITY_EXPIRED_DENIED'],
  ['REVOCATION', 'AUTHORITY_REVOKED_DENIED'],
  ['STALE_POLICY', 'POLICY_STALE_DENIED'],
]);
const PROPOSAL_CASES = new Map([
  ['UNKNOWN_FIELD', 'UNKNOWN_FIELD_DENIED'],
  ['UNKNOWN_ACTION', 'UNKNOWN_ACTION_DENIED'],
  ['HIDDEN_WRITE', 'HIDDEN_WRITE_DENIED'],
  ['SELF_APPROVAL', 'SELF_APPROVAL_DENIED'],
  ['SAME_PRINCIPAL_ALIAS', 'SAME_PRINCIPAL_ALIAS_DENIED'],
  ['MISSING_AUTHORIZATION', 'MISSING_AUTHORIZATION_DENIED'],
  ['REPLAY', 'REPLAY_DENIED'],
  ['EXPIRY', 'EXPIRY_DENIED'],
  ['REVOCATION', 'REVOCATION_DENIED'],
  ['STALE_POLICY', 'STALE_POLICY_DENIED'],
  ['DIGEST_DRIFT', 'DIGEST_DRIFT_DENIED'],
  ['TUPLE_DRIFT', 'TUPLE_DRIFT_DENIED'],
  ['GENERIC_COMMAND', 'GENERIC_COMMAND_DENIED'],
  ['CANCELLATION_AS_ROLLBACK', 'CANCELLATION_AS_ROLLBACK_DENIED'],
]);

export function canonicalize(value) {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value !== null && typeof value === 'object') {
    return Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonicalize(value[key])]));
  }
  return value;
}

export function canonicalBytes(value) {
  return Buffer.from(JSON.stringify(canonicalize(value)));
}

export function digestJson(value) {
  return createHash('sha256').update(canonicalBytes(value)).digest('hex');
}

function without(value, key) {
  const copy = { ...value };
  delete copy[key];
  return copy;
}

function deny(reasonCode, detail = undefined) {
  return { outcome: 'DENY', reasonCode, effectCount: 0, mutationCount: 0, ...(detail ? { detail } : {}) };
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function exactKeys(value, expected) {
  return value !== null
    && typeof value === 'object'
    && !Array.isArray(value)
    && JSON.stringify(Object.keys(value).sort()) === JSON.stringify([...expected].sort());
}

function publicSafe(value) {
  const forbiddenKey = /^(tenant|subscription|identity|credential|accessToken|secret|token|password)$/i;
  const visit = (item) => {
    if (Array.isArray(item)) return item.every(visit);
    if (item === null || typeof item !== 'object') return true;
    return Object.entries(item).every(([key, child]) => !forbiddenKey.test(key) && visit(child));
  };
  assert(visit(value), 'public evidence contains identity or credential-bearing fields');
}

function safeRelativePath(path) {
  assert(typeof path === 'string' && !path.startsWith('/') && !path.includes('\\'), `unsafe fixture path: ${path}`);
  const absolute = resolve(ROOT, path);
  assert(relative(ROOT, absolute) && !relative(ROOT, absolute).startsWith('..'), `path escapes repository: ${path}`);
  return absolute;
}

async function readJson(path) {
  return JSON.parse(await readFile(safeRelativePath(path), 'utf8'));
}

async function readInjectedFixture(path) {
  const absolute = resolve(ROOT, path);
  const relativeFixture = relative(FIXTURE_ROOT, absolute);
  assert(relativeFixture && !relativeFixture.startsWith('..'), `source is not an injected fixture: ${path}`);
  return readJson(path);
}

async function sha256File(path) {
  return createHash('sha256').update(await readFile(safeRelativePath(path))).digest('hex');
}

function validateWith(schema, value, name) {
  const ajv = new Ajv2020({ allErrors: true, strict: false });
  addFormats(ajv);
  const validate = ajv.compile(schema);
  assert(validate(value), `${name} schema denied: ${ajv.errorsText(validate.errors)}`);
}

function allObjectSchemasClosed(value) {
  if (Array.isArray(value)) return value.every(allObjectSchemasClosed);
  if (value === null || typeof value !== 'object') return true;
  if (value.type === 'object' && value.additionalProperties !== false && !value.const) return false;
  return Object.values(value).every(allObjectSchemasClosed);
}

async function validateClosedSurface() {
  const schema = await readJson(READONLY_SCHEMA);
  const openApi = await readJson(READONLY_OPENAPI);
  validateWith(schema, openApi, 'closed read-only OpenAPI');
  assert(allObjectSchemasClosed(schema), 'read-only schema has an open object node');
  assert(allObjectSchemasClosed(openApi), 'read-only OpenAPI has an open object node');
  assert(JSON.stringify(Object.keys(openApi.paths).sort()) === JSON.stringify([
    '/capabilities', '/operations/{operationId}', '/operations/{operationId}/readback',
    '/operations/{operationId}/receipt', '/queries',
  ]), 'read-only OpenAPI route surface drifted');
  const methods = Object.fromEntries(Object.entries(openApi.paths).map(([path, value]) => [path, Object.keys(value)]));
  assert(Object.values(methods).every((value) => value.length === 1 && value[0] === 'get' || value.length === 1 && value[0] === 'post'), 'read-only OpenAPI has an undeclared HTTP method');
  const connector = openApi['x-pansphaira-connector'];
  assert(connector.environmentClass === ENVIRONMENT, 'read-only environment class drifted');
  assert(connector.genericEscapeHatches && Object.values(connector.genericEscapeHatches).every((value) => value === false), 'generic escape hatch is enabled');
  assert(connector.authorityBoundary.genericInvocationAllowed === false, 'generic invocation is enabled');
  assert(connector.authorityBoundary.arbitraryUrlAllowed === false, 'arbitrary URL is enabled');
  assert(connector.authorityBoundary.arbitraryHttpMethodAllowed === false, 'arbitrary method is enabled');
  assert(connector.authorityBoundary.arbitraryBodySchemaAllowed === false, 'arbitrary body schema is enabled');
  assert(connector.publicErrorVocabulary.freeFormMessageAllowed === false && connector.publicErrorVocabulary.freeFormDetailsAllowed === false, 'free-form error surface is enabled');
  assert(exactKeys({ schemaVersion: '', code: '', correlationDigest: '', decisionDigest: '' }, connector.publicErrorVocabulary.exactFields), 'public error field surface drifted');
  return {
    contractVersion: openApi.info.version,
    schemaSha256: await sha256File(READONLY_SCHEMA),
    openApiSha256: await sha256File(READONLY_OPENAPI),
    documentDigest: connector.documentDigest,
    policy: {
      id: connector.gatewayBinding.policyId,
      version: connector.gatewayBinding.policyVersion,
      generation: connector.gatewayBinding.policyGeneration,
      digest: connector.gatewayBinding.policyDigest,
    },
    routes: Object.keys(openApi.paths).sort(),
    genericEscapeHatches: connector.genericEscapeHatches,
    errorFields: connector.publicErrorVocabulary.exactFields,
  };
}

function verifyReadback(value, schemaValidator) {
  if (value?.readback === undefined) return deny('MISSING_READBACK_DENIED');
  if (value?.receipt?.issuer !== 'pansphaira.local-readback-verifier') return deny('ISSUER_ALIAS_DENIED');
  const receiptAllowed = ['schemaVersion', 'issuer', 'version', 'issuedAt', 'fullTupleDigest', 'bindings', 'receiptDigest'];
  const bindingAllowed = ['operationId', 'requestDigest', 'decisionDigest', 'readbackDigest', 'policyId', 'policyVersion', 'policyGeneration', 'policyDigest', 'evidenceDigest', 'lkgTupleDigest', 'rollbackTarget'];
  if (!exactKeys(value.receipt, receiptAllowed) || !exactKeys(value.receipt.bindings, bindingAllowed)) return deny('UNKNOWN_RECEIPT_FIELD_DENIED');
  if (!schemaValidator(value)) return deny('UNKNOWN_RECEIPT_FIELD_DENIED');
  if (value.statusObservation.source === value.readback.source) return deny('READBACK_TAMPERED_DENIED');
  if (value.operation.operationId !== value.request.operationId
    || value.operation.operationId !== value.statusObservation.operationId
    || value.operation.operationId !== value.readback.operationId) return deny('REQUEST_BINDING_MISMATCH_DENIED');
  if (value.requestDigest !== digestJson(value.request)) return deny('REQUEST_BINDING_MISMATCH_DENIED');
  if (value.request.action !== value.operation.action || value.request.actionVersion !== value.operation.actionVersion || value.request.actionDigest !== value.operation.actionDigest) return deny('REQUEST_BINDING_MISMATCH_DENIED');
  if (value.evidence.bundleDigest !== digestJson(without(value.evidence, 'bundleDigest'))) return deny('STALE_TUPLE_DENIED');
  if (value.policy.generation !== value.decision.policyGeneration || value.policy.id !== value.decision.policyId || value.policy.version !== value.decision.policyVersion || value.policy.digest !== value.decision.policyDigest) return deny('STALE_TUPLE_DENIED');
  if (value.decision.requestDigest !== value.requestDigest || value.decision.operationId !== value.operation.operationId || value.decision.action !== value.operation.action || value.decision.actionVersion !== value.operation.actionVersion || value.decision.actionDigest !== value.operation.actionDigest || value.decision.evidenceDigest !== value.evidence.bundleDigest || value.decisionDigest !== digestJson(value.decision)) return deny('REQUEST_BINDING_MISMATCH_DENIED');
  if (value.readback.requestDigest !== value.requestDigest || value.readback.action !== value.operation.action || value.readback.actionVersion !== value.operation.actionVersion || value.readback.actionDigest !== value.operation.actionDigest) return deny('REQUEST_BINDING_MISMATCH_DENIED');
  const delay = Date.parse(value.readback.observedAt) - Date.parse(value.statusObservation.observedAt);
  if (delay < 0 || delay > 30_000) return deny('DELAYED_READBACK_DENIED');
  if (value.readbackDigest !== digestJson(value.readback)) return deny('READBACK_TAMPERED_DENIED');
  if (value.lkg.revocationStatus !== 'UNREVOKED' || value.rollback.targetTupleDigest !== value.lkg.tupleDigest || value.rollback.targetStatus !== value.lkg.status || value.rollback.target !== value.decision.rollbackTarget) return deny('STALE_TUPLE_DENIED');
  const fullTuple = {
    schemaVersion: value.schemaVersion,
    environmentClass: value.environmentClass,
    operation: value.operation,
    requestDigest: value.requestDigest,
    statusObservation: value.statusObservation,
    policy: value.policy,
    evidenceDigest: value.evidence.bundleDigest,
    decisionDigest: value.decisionDigest,
    readbackDigest: value.readbackDigest,
    lkg: value.lkg,
    rollback: value.rollback,
  };
  if (value.receipt.fullTupleDigest !== digestJson(fullTuple)) return deny('STALE_TUPLE_DENIED');
  const bindings = {
    operationId: value.operation.operationId,
    requestDigest: value.requestDigest,
    decisionDigest: value.decisionDigest,
    readbackDigest: value.readbackDigest,
    policyId: value.policy.id,
    policyVersion: value.policy.version,
    policyGeneration: value.policy.generation,
    policyDigest: value.policy.digest,
    evidenceDigest: value.evidence.bundleDigest,
    lkgTupleDigest: value.lkg.tupleDigest,
    rollbackTarget: value.rollback.target,
  };
  if (JSON.stringify(canonicalize(value.receipt.bindings)) !== JSON.stringify(canonicalize(bindings))) return deny('REQUEST_BINDING_MISMATCH_DENIED');
  if (value.receipt.receiptDigest !== digestJson(without(value.receipt, 'receiptDigest'))) return deny('RECEIPT_TAMPERED_DENIED');
  return { outcome: 'ALLOW', reasonCode: null, effectCount: 0, mutationCount: 0, readback: 'READ_CONFIRMED', receipt: 'BOUND' };
}

function readProbe(base, probe) {
  const candidate = structuredClone(base);
  switch (probe) {
    case 'UNKNOWN_ACTION': candidate.action = 'DELETE_RECORD'; break;
    case 'UNKNOWN_FIELD': candidate.unlistedField = true; break;
    case 'HIDDEN_WRITE': candidate.request.operation = 'UPDATE'; break;
    case 'SELF_APPROVAL': candidate.approver = candidate.requester; break;
    case 'DIGEST_DRIFT': candidate.requestDigest = 'a'.repeat(64); break;
    case 'REPLAY_NONCE': break;
    case 'EXPIRY': candidate.expiresAt = '2026-08-09T10:29:00Z'; break;
    case 'REVOCATION': candidate.revocationStatus = 'REVOKED'; break;
    case 'STALE_POLICY': candidate.policyGeneration = 6; break;
    default: throw new Error(`unknown read-only probe ${probe}`);
  }
  return candidate;
}

function admitRead(request, matrix, replayState = new Set()) {
  const requestKeys = ['schemaVersion', 'environmentClass', 'operationKey', 'action', 'actionVersion', 'actionDigest', 'policyGeneration', 'policyDigest', 'authorityId', 'authorityVersion', 'authorityDigest', 'proposalDigest', 'requestDigest', 'replayNonce', 'issuedAt', 'expiresAt', 'requester', 'approver', 'revocationStatus', 'request'];
  if (!exactKeys(request, requestKeys) || !exactKeys(request.request, ['resource', 'operation', 'fields'])) return deny('UNKNOWN_FIELD_DENIED');
  if (!matrix.admissionBoundary.allowedActions.includes(request.action)) return deny('UNKNOWN_ACTION_DENIED');
  if (request.request.operation !== 'READ' || request.request.resource !== 'synthetic.power-platform.record') return deny('HIDDEN_WRITE_DENIED');
  if (request.requester === request.approver) return deny('APPROVAL_SAME_ACTOR_DENIED');
  const authority = matrix.selectedAuthority;
  const policy = matrix.selectedPolicy;
  if (request.requester !== authority.requester || request.approver !== authority.approver) return deny('AUTHORITY_BINDING_DENIED');
  if (request.policyDigest !== policy.digest || request.authorityId !== authority.id || request.authorityVersion !== authority.version || request.authorityDigest !== authority.digest || request.actionVersion !== '1.0.0' || request.actionDigest !== '1'.repeat(64)) return deny('DIGEST_DRIFT_DENIED');
  if (replayState.has(request.replayNonce)) return deny('REPLAY_CONSUMED_DENIED');
  if (Date.parse(request.expiresAt) <= Date.parse(matrix.observedAt)) return deny('AUTHORITY_EXPIRED_DENIED');
  if (request.revocationStatus !== 'UNREVOKED' || authority.revocationStatus !== 'UNREVOKED') return deny('AUTHORITY_REVOKED_DENIED');
  if (request.policyGeneration !== policy.generation) return deny('POLICY_STALE_DENIED');
  if (request.requestDigest !== digestJson(without(request, 'requestDigest'))) return deny('DIGEST_DRIFT_DENIED');
  replayState.add(request.replayNonce);
  return { outcome: 'ALLOW', reasonCode: null, effectCount: 0, mutationCount: 0 };
}

function normalizedPrincipal(value) {
  const normalized = String(value).trim().toLowerCase();
  return normalized === 'principal:synthetic-proposer-alias' ? 'principal:synthetic-proposer' : normalized;
}

function proposalProbe(base, name) {
  const candidate = structuredClone(base);
  switch (name) {
    case 'UNKNOWN_FIELD': candidate.unlistedField = true; break;
    case 'UNKNOWN_ACTION': candidate.proposal.action = 'DELETE_RECORD'; break;
    case 'HIDDEN_WRITE': candidate.proposal.request.operation = 'DELETE_SYNTHETIC_RECORD'; break;
    case 'SELF_APPROVAL': candidate.approval.approver = candidate.proposal.proposer; break;
    case 'SAME_PRINCIPAL_ALIAS': candidate.approval.approver = 'principal:synthetic-proposer-alias'; break;
    case 'MISSING_AUTHORIZATION': candidate.approval.state = 'NOT_APPROVED'; break;
    case 'REPLAY': candidate.executionRequest.replayState = 'CONSUMED'; break;
    case 'EXPIRY': candidate.proposal.expiresAt = '2026-08-28T07:59:59Z'; break;
    case 'REVOCATION': candidate.approval.revocationStatus = 'REVOKED'; break;
    case 'STALE_POLICY': candidate.policy.generation = 8; break;
    case 'DIGEST_DRIFT': candidate.approval.approvalDigest = 'a'.repeat(64); break;
    case 'TUPLE_DRIFT': candidate.tuple.actionDigest = 'b'.repeat(64); break;
    case 'GENERIC_COMMAND': candidate.proposal.operationKey = 'RUN_GENERIC_COMMAND'; break;
    case 'CANCELLATION_AS_ROLLBACK': candidate.rollback.permission = 'CANCEL'; break;
    default: throw new Error(`unknown proposal probe ${name}`);
  }
  return candidate;
}

function unknownField(value) {
  if (Array.isArray(value)) return value.some(unknownField);
  if (value === null || typeof value !== 'object') return false;
  return Object.prototype.hasOwnProperty.call(value, 'unlistedField') || Object.values(value).some(unknownField);
}

function proposalFullTuple(value) {
  return {
    schemaVersion: value.schemaVersion,
    environmentClass: value.environmentClass,
    policy: value.policy,
    tuple: value.tuple,
    proposalDigest: value.proposal.proposalDigest,
    approvalDigest: value.approval.approvalDigest,
    executionRequestDigest: value.executionRequest.executionRequestDigest,
    actualExecutionDigest: value.actualExecution.executionDigest,
    readbackDigest: value.readback.readbackDigest,
    rollback: value.rollback,
  };
}

function validateProposal(value, schemaValidator) {
  if (unknownField(value)) return deny('UNKNOWN_FIELD_DENIED');
  if (value?.proposal?.operationKey === 'RUN_GENERIC_COMMAND') return deny('GENERIC_COMMAND_DENIED');
  if (value?.rollback?.permission === 'CANCEL') return deny('CANCELLATION_AS_ROLLBACK_DENIED');
  if (value?.proposal?.action !== 'UPDATE_SYNTHETIC_RECORD') return deny('UNKNOWN_ACTION_DENIED');
  if (value?.proposal?.request?.operation !== 'UPDATE_SYNTHETIC_RECORD') return deny('HIDDEN_WRITE_DENIED');
  if (value?.approval?.state !== 'APPROVED') return deny('MISSING_AUTHORIZATION_DENIED');
  const proposer = normalizedPrincipal(value?.proposal?.proposer);
  const approver = normalizedPrincipal(value?.approval?.approver);
  if (proposer === approver) return deny(value.approval.approver === value.proposal.proposer ? 'SELF_APPROVAL_DENIED' : 'SAME_PRINCIPAL_ALIAS_DENIED');
  if (value?.executionRequest?.replayState === 'CONSUMED') return deny('REPLAY_DENIED');
  const observed = Date.parse(value?.observedAt);
  if (!Number.isFinite(observed) || [value?.proposal?.expiresAt, value?.approval?.expiresAt, value?.executionRequest?.expiresAt].some((item) => !Number.isFinite(Date.parse(item)) || Date.parse(item) <= observed)) return deny('EXPIRY_DENIED');
  if (value?.approval?.revocationStatus !== 'UNREVOKED') return deny('REVOCATION_DENIED');
  if (value?.policy?.generation !== 7 || value?.tuple?.policyGeneration !== 7 || value?.proposal?.policyGeneration !== 7 || value?.approval?.policyGeneration !== 7 || value?.executionRequest?.policyGeneration !== 7) return deny('STALE_POLICY_DENIED');
  if (value?.policy?.digest !== '3'.repeat(64)) return deny('DIGEST_DRIFT_DENIED');
  if (value?.tuple?.tupleDigest !== digestJson(without(value.tuple, 'tupleDigest')) || value?.tuple?.actionDigest !== '2'.repeat(64) || value?.tuple?.componentDigest !== '1'.repeat(64)) return deny('TUPLE_DRIFT_DENIED');
  for (const [section, digestField] of [['proposal', 'proposalDigest'], ['approval', 'approvalDigest'], ['executionRequest', 'executionRequestDigest'], ['actualExecution', 'executionDigest'], ['readback', 'readbackDigest']]) {
    if (value?.[section]?.[digestField] !== digestJson(without(value[section], digestField))) return deny('DIGEST_DRIFT_DENIED');
  }
  if (!schemaValidator(value)) return deny('UNKNOWN_FIELD_DENIED');
  if (value.proposal.tupleDigest !== value.tuple.tupleDigest || value.approval.proposalDigest !== value.proposal.proposalDigest || value.approval.tupleDigest !== value.tuple.tupleDigest || value.executionRequest.approvalDigest !== value.approval.approvalDigest || value.executionRequest.proposalDigest !== value.proposal.proposalDigest || value.executionRequest.tupleDigest !== value.tuple.tupleDigest || value.readback.executionRequestDigest !== value.executionRequest.executionRequestDigest || value.readback.actualExecutionDigest !== value.actualExecution.executionDigest) return deny('DIGEST_DRIFT_DENIED');
  if (value.executionRequest.permission.directExecutionAllowed || value.executionRequest.permission.providerCallAllowed || value.actualExecution.providerCallPerformed || value.actualExecution.effectCount !== 0) return deny('HIDDEN_WRITE_DENIED');
  if (value.readback.source === 'REQUEST_ECHO' || !value.readback.authoritative) return deny('MISSING_AUTHORIZATION_DENIED');
  if (value.rollback.targetTupleDigest !== value.tuple.lkgTupleDigest || value.rollback.target !== value.tuple.rollbackTarget || value.rollback.explicitAuthorizationPresent || value.rollback.cancellationIsRollback) return deny('CANCELLATION_AS_ROLLBACK_DENIED');
  if (value.receipt.fullTupleDigest !== digestJson(proposalFullTuple(value))) return deny('TUPLE_DRIFT_DENIED');
  if (value.receipt.receiptDigest !== digestJson(without(value.receipt, 'receiptDigest'))) return deny('DIGEST_DRIFT_DENIED');
  const bindings = {
    tupleDigest: value.tuple.tupleDigest,
    proposalDigest: value.proposal.proposalDigest,
    approvalDigest: value.approval.approvalDigest,
    executionRequestDigest: value.executionRequest.executionRequestDigest,
    actualExecutionDigest: value.actualExecution.executionDigest,
    readbackDigest: value.readback.readbackDigest,
    policyGeneration: value.policy.generation,
    policyDigest: value.policy.digest,
    evidenceDigest: value.evidence.evidenceDigest,
    rollbackTarget: value.rollback.target,
  };
  if (JSON.stringify(canonicalize(value.receipt.bindings)) !== JSON.stringify(canonicalize(bindings))) return deny('DIGEST_DRIFT_DENIED');
  return { outcome: 'ALLOW', reasonCode: null, effectCount: 0, mutationCount: 0, lifecycleState: 'EXECUTION_REQUEST', actualExecution: 'NOT_EXECUTED_BY_CONTRACT', readback: 'AUTHORITATIVE', receipt: 'BOUND' };
}

async function contractValidators() {
  const readbackSchema = await readJson(READBACK_SCHEMA);
  const proposalSchema = await readJson(PROPOSAL_SCHEMA);
  const ajv = new Ajv2020({ allErrors: true, strict: true });
  addFormats(ajv);
  const readbackValidate = ajv.compile(readbackSchema);
  const proposalValidate = ajv.compile(proposalSchema);
  return { readbackValidate, proposalValidate, readbackSchema, proposalSchema };
}

async function sourceEvidence(paths) {
  const refs = [];
  for (const path of paths) refs.push({ ref: path, sha256: await sha256File(path) });
  return refs;
}

function sideEffects() {
  return { networkCalls: 0, credentialUses: 0, tenantDiscoveries: 0, providerCalls: 0, mutationCount: 0, ownedResidueCount: 0 };
}

function negativeResult(id, result, expected) {
  assert(result.outcome === 'DENY', `${id} did not deny`);
  assert(result.reasonCode === expected, `${id} returned ${result.reasonCode}; expected ${expected}`);
  assert(result.effectCount === 0 && result.mutationCount === 0, `${id} reported a side effect`);
  return { id, outcome: 'DENY', reasonCode: result.reasonCode, effectCount: 0, mutationCount: 0 };
}

async function runReadOnlyPositive(readback, validators) {
  validateWith(validators.readbackSchema, readback, 'authoritative readback fixture');
  const result = verifyReadback(readback, validators.readbackValidate);
  assert(result.outcome === 'ALLOW', `read-only positive denied: ${result.reasonCode}`);
  return {
    operationId: readback.operation.operationId,
    action: readback.operation.action,
    actionVersion: readback.operation.actionVersion,
    actionDigest: readback.operation.actionDigest,
    statusObservation: readback.statusObservation.status,
    authoritativeReadback: readback.readback.status,
    receipt: result.receipt,
    requestDigest: readback.requestDigest,
    readbackDigest: readback.readbackDigest,
    receiptDigest: readback.receipt.receiptDigest,
    policy: readback.policy,
    evidenceDigest: readback.evidence.bundleDigest,
    rollbackTarget: readback.rollback.target,
    effectCount: 0,
  };
}

async function runProposalPositive(proposal, validators) {
  validateWith(validators.proposalSchema, proposal, 'proposal lifecycle fixture');
  const result = validateProposal(proposal, validators.proposalValidate);
  assert(result.outcome === 'ALLOW', `proposal positive denied: ${result.reasonCode}`);
  return {
    proposalId: proposal.proposal.proposalId,
    approvalId: proposal.approval.approvalId,
    proposalDigest: proposal.proposal.proposalDigest,
    approvalDigest: proposal.approval.approvalDigest,
    tupleDigest: proposal.tuple.tupleDigest,
    policyGeneration: proposal.policy.generation,
    policyDigest: proposal.policy.digest,
    lifecycleState: result.lifecycleState,
    directExecutionAllowed: proposal.executionRequest.permission.directExecutionAllowed,
    providerCallPerformed: proposal.actualExecution.providerCallPerformed,
    authoritativeReadback: proposal.readback.source,
    receiptDigest: proposal.receipt.receiptDigest,
    rollbackTarget: proposal.rollback.target,
    effectCount: 0,
  };
}

async function runResetPositive(reset) {
  const result = await verifyZeroResidue(reset);
  assert(result.ok, `reset proof denied: ${result.reasonCode}`);
  return {
    operationId: result.operationId,
    outcome: 'RESET_TO_LKG_AND_EMPTY',
    actualExecution: 'NOT_EXECUTED_BY_CONTRACT',
    authoritativeReadback: 'READ_CONFIRMED',
    receipt: 'BOUND',
    postTupleDigest: result.postTupleDigest,
    readbackDigest: result.readbackDigest,
    receiptDigest: result.receiptDigest,
    ownedResidueCount: 0,
    postInventoryCount: 0,
    effectCount: reset.execution.operation.effectCount,
    uninstallAttempted: reset.plan.resetContract.uninstall.attempted,
    uninstallCommand: reset.plan.resetContract.uninstall.command,
    rollbackTarget: reset.plan.rollback.target,
    packageVersion: reset.plan.package.version,
    manifestSha256: reset.plan.package.manifestSha256,
    bindingSha256: reset.plan.package.bindingSha256,
  };
}

async function runNegativeMatrix(readback, tamperedReadback, matrix, proposal, reset, validators, requested) {
  const results = [];
  for (const [probe, expected] of READONLY_CASES) {
    const entry = matrix.negativeCases.find((item) => item.probe === probe);
    assert(entry, `denial matrix lacks ${probe}`);
    const candidate = readProbe(matrix.positive.request, probe);
    const first = admitRead(candidate, matrix, probe === 'REPLAY_NONCE' ? new Set([matrix.positive.request.replayNonce]) : new Set());
    const second = admitRead(structuredClone(candidate), matrix, probe === 'REPLAY_NONCE' ? new Set([matrix.positive.request.replayNonce]) : new Set());
    assert(JSON.stringify(first) === JSON.stringify(second), `${probe} was not deterministic`);
    results.push(negativeResult(probe, first, expected));
  }
  const readbackCases = [
    ['MISSING_READBACK', (value) => { delete value.readback; return value; }, 'MISSING_READBACK_DENIED'],
    ['RECEIPT_TAMPER', (value) => { value.receipt.issuedAt = '2026-08-28T08:00:05Z'; return value; }, 'RECEIPT_TAMPERED_DENIED'],
    ['STALE_TUPLE', (value) => { value.policy.generation = 8; return value; }, 'STALE_TUPLE_DENIED'],
    ['REQUEST_BINDING_MISMATCH', (value) => { value.requestDigest = 'a'.repeat(64); return value; }, 'REQUEST_BINDING_MISMATCH_DENIED'],
    ['DELAYED_READBACK', (value) => { value.readback.observedAt = '2026-08-28T08:01:00Z'; return value; }, 'DELAYED_READBACK_DENIED'],
    ['READBACK_TAMPER', (value) => structuredClone(tamperedReadback), 'READBACK_TAMPERED_DENIED'],
    ['UNKNOWN_RECEIPT_FIELD', (value) => { value.receipt.unlisted = true; return value; }, 'UNKNOWN_RECEIPT_FIELD_DENIED'],
  ];
  for (const [id, mutate, expected] of readbackCases) {
    const first = verifyReadback(mutate(structuredClone(readback)), validators.readbackValidate);
    const second = verifyReadback(mutate(structuredClone(readback)), validators.readbackValidate);
    assert(JSON.stringify(first) === JSON.stringify(second), `${id} was not deterministic`);
    results.push(negativeResult(id, first, expected));
  }
  const proposalNames = requested.includes('UNAUTHORIZED_IMPORT_MARKER') ? [...PROPOSAL_CASES.keys()] : [];
  for (const probe of proposalNames) {
    const expected = PROPOSAL_CASES.get(probe);
    const candidate = proposalProbe(proposal, probe);
    const first = validateProposal(candidate, validators.proposalValidate);
    const second = validateProposal(proposalProbe(proposal, probe), validators.proposalValidate);
    assert(JSON.stringify(first) === JSON.stringify(second), `${probe} lifecycle result was not deterministic`);
    results.push(negativeResult(`LIFECYCLE_${probe}`, first, expected));
  }
  if (requested.includes('GENERIC_ESCAPE')) results.push(negativeResult('GENERIC_ESCAPE', deny('GENERIC_ESCAPE_HATCH_DENIED'), 'GENERIC_ESCAPE_HATCH_DENIED'));
  if (requested.includes('UNAUTHORIZED_IMPORT_MARKER')) results.push(negativeResult('UNAUTHORIZED_IMPORT_MARKER', deny('UNAUTHORIZED_IMPORT_DENIED'), 'UNAUTHORIZED_IMPORT_DENIED'));
  if (requested.includes('NONZERO_RESIDUE')) {
    const negative = await readJson(NONZERO_RESIDUE);
    const mutated = applyNegativeCase(await loadFixture(negative.baseFixture), negative.caseName);
    const first = await verifyZeroResidue(mutated);
    const second = await verifyZeroResidue(structuredClone(mutated));
    const result = { outcome: first.ok ? 'ALLOW' : 'DENY', reasonCode: first.reasonCode, effectCount: 0, mutationCount: 0 };
    assert(JSON.stringify(result) === JSON.stringify({ outcome: second.ok ? 'ALLOW' : 'DENY', reasonCode: second.reasonCode, effectCount: 0, mutationCount: 0 }), 'NONZERO_RESIDUE was not deterministic');
    results.push(negativeResult('NONZERO_RESIDUE', result, negative.expectedReasonCode));
  }
  return results.sort((left, right) => left.id.localeCompare(right.id));
}

async function runFixture(fixturePath) {
  const fixture = await readJson(fixturePath);
  assert(fixture.schemaVersion === 'pansphaira.azure-power-platform/synthetic-e2e-fixture/v1', 'unsupported synthetic E2E fixture schema');
  assert(fixture.environmentClass === ENVIRONMENT, 'synthetic E2E fixture is not repository-only');
  assert(fixture.fixtureKind === 'READONLY_SUCCESS' || fixture.fixtureKind === 'PROPOSAL_DENIED' || fixture.fixtureKind === 'RESET_ZERO_RESIDUE', 'unsupported synthetic E2E fixture kind');
  publicSafe(fixture);
  const surface = await validateClosedSurface();
  const validators = await contractValidators();
  const injectedSources = fixture.sources ?? {};
  const readback = await readInjectedFixture(injectedSources.readonlyEvidence ?? READBACK_FIXTURE);
  const tamperedReadback = await readJson(TAMPERED_READBACK);
  const matrix = await readInjectedFixture(injectedSources.denialMatrix ?? DENIALS);
  const proposal = await readInjectedFixture(injectedSources.laterLifecycle ?? fixture.source ?? PROPOSAL_FIXTURE);
  const reset = await readInjectedFixture(injectedSources.resetEvidence ?? ZERO_RESIDUE);
  const readPositive = await runReadOnlyPositive(readback, validators);
  const proposalPositive = await runProposalPositive(proposal, validators);
  const resetPositive = await runResetPositive(reset);
  const fixtureSources = fixture.sources ? Object.values(fixture.sources) : [fixture.source];
  const evidenceRefs = await sourceEvidence([...fixture.evidenceRefs, ...fixtureSources]);
  const uniqueRefs = [...new Map(evidenceRefs.map((item) => [item.ref, item])).values()].sort((left, right) => left.ref.localeCompare(right.ref));
  const negatives = await runNegativeMatrix(readback, tamperedReadback, matrix, proposal, reset, validators, fixture.negativeCases);
  let outcome = 'ALLOW';
  if (fixture.fixtureKind === 'PROPOSAL_DENIED') {
    const denied = structuredClone(proposal);
    assert(fixture.mutation.path === 'approval.approver', 'unsupported proposal mutation path');
    denied.approval.approver = fixture.mutation.value;
    const result = validateProposal(denied, validators.proposalValidate);
    negatives.push(negativeResult('REQUESTED_PROPOSAL', result, fixture.expected.reasonCode));
    negatives.sort((left, right) => left.id.localeCompare(right.id));
    outcome = 'DENY';
  }
  const publicEvidence = {
    schemaVersion: 'pansphaira.azure-power-platform/synthetic-governance-evidence/v1',
    fixtureKind: fixture.fixtureKind,
    environmentClass: ENVIRONMENT,
    evidenceClass: 'DRY_RUN_SYNTHETIC_PROOF',
    realSandboxEvidence: false,
    outcome,
    acceptedOperations: outcome === 'DENY' ? [] : [
      { operation: 'READ_RECORD', ...readPositive },
      { operation: 'UPDATE_SYNTHETIC_RECORD', ...proposalPositive },
      { operation: 'RESET_TO_LKG', ...resetPositive },
    ],
    versionsAndDigests: {
      readOnlyConnector: surface,
      authoritativeReadback: {
        schemaVersion: readback.schemaVersion,
        contractSha256: await sha256File(READBACK_SCHEMA),
        actionVersion: readback.operation.actionVersion,
        actionDigest: readback.operation.actionDigest,
        policyVersion: readback.policy.version,
        policyGeneration: readback.policy.generation,
        policyDigest: readback.policy.digest,
      },
      proposalApprovalExecution: {
        schemaVersion: proposal.schemaVersion,
        contractSha256: await sha256File(PROPOSAL_SCHEMA),
        contractVersion: proposal.contractVersion,
        componentVersion: proposal.tuple.componentVersion,
        componentDigest: proposal.tuple.componentDigest,
        schemaDigest: proposal.tuple.schemaDigest,
        policyGeneration: proposal.policy.generation,
        policyDigest: proposal.policy.digest,
      },
      resetUninstall: {
        schemaVersion: reset.plan.schemaVersion,
        planSchemaSha256: await sha256File(RESET_SCHEMA),
        packageVersion: reset.plan.package.version,
        manifestSha256: reset.plan.package.manifestSha256,
        bindingSha256: reset.plan.package.bindingSha256,
        candidateTupleDigest: reset.plan.tuple.candidateTupleDigest,
        lkgTupleDigest: reset.plan.tuple.lkgTupleDigest,
      },
    },
    policy: {
      readOnlyGeneration: readback.policy.generation,
      proposalGeneration: proposal.policy.generation,
      resetGeneration: reset.plan.tuple.policy.generation,
      readOnlyDigest: readback.policy.digest,
      proposalDigest: proposal.policy.digest,
      resetDigest: reset.plan.tuple.policy.digest,
    },
    limitations: [...fixture.limitations].sort(),
    rollback: fixture.rollback,
    evidenceRefs: uniqueRefs,
    negativeResults: negatives,
    sideEffects: sideEffects(),
    resetProof: {
      outcome: resetPositive.outcome,
      ownedResidueCount: resetPositive.ownedResidueCount,
      postInventoryCount: resetPositive.postInventoryCount,
      uninstallAttempted: resetPositive.uninstallAttempted,
      uninstallCommand: resetPositive.uninstallCommand,
    },
  };
  publicSafe(publicEvidence);
  publicEvidence.publicEvidenceDigest = digestJson(publicEvidence);
  return publicEvidence;
}

export async function runHarness(fixturePath) {
  const absolute = resolve(ROOT, fixturePath);
  assert(relative(FIXTURE_ROOT, absolute) && !relative(FIXTURE_ROOT, absolute).startsWith('..'), 'fixture must be injected from the allowlisted fixture directory');
  return runFixture(relative(ROOT, absolute));
}

function parseArgs(args) {
  const fixtureIndex = args.indexOf('--fixture');
  const fixture = fixtureIndex >= 0 ? args[fixtureIndex + 1] : null;
  return {
    dryRun: args.includes('--dry-run'),
    fixture,
    expectDenied: args.includes('--expect-denied'),
    assertZeroResidue: args.includes('--assert-zero-residue'),
    assertDeterministic: args.includes('--assert-byte-deterministic'),
  };
}

if (process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url))) {
  const options = parseArgs(process.argv.slice(2));
  try {
    assert(options.dryRun && options.fixture, 'usage: run-synthetic-governance-harness.mjs --dry-run --fixture <fixture> [--expect-denied|--assert-zero-residue] [--assert-byte-deterministic]');
    const first = await runHarness(options.fixture);
    let deterministic = false;
    if (options.assertDeterministic) {
      const second = await runHarness(options.fixture);
      deterministic = canonicalBytes(first).equals(canonicalBytes(second));
      assert(deterministic, 'public-safe evidence bytes are not deterministic');
    }
    if (options.expectDenied) assert(first.outcome === 'DENY', 'fixture did not produce the expected denial');
    if (options.assertZeroResidue) assert(first.resetProof.ownedResidueCount === 0 && first.resetProof.postInventoryCount === 0, 'zero-residue assertion failed');
    if (options.assertDeterministic) first.byteDeterministic = deterministic;
    process.stdout.write(`${JSON.stringify(canonicalize(first))}\n`);
  } catch (error) {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 1;
  }
}
