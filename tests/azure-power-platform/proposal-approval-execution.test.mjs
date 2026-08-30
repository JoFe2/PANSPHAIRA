import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import Ajv2020 from "ajv/dist/2020.js";
import addFormats from "ajv-formats";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const fixtureDir = path.join(root, "tests/fixtures/azure-power-platform");
const schema = JSON.parse(await readFile(path.join(root, "contracts/azure-power-platform/proposal-approval-execution.schema.json"), "utf8"));
const approved = JSON.parse(await readFile(path.join(fixtureDir, "proposal-approved.json"), "utf8"));
const selfApproved = JSON.parse(await readFile(path.join(fixtureDir, "proposal-self-approved.json"), "utf8"));
const replayFixture = JSON.parse(await readFile(path.join(fixtureDir, "proposal-replay.json"), "utf8"));
const ajv = new Ajv2020({ allErrors: true, strict: true });
addFormats(ajv);
const validateSchema = ajv.compile(schema);
const digestPattern = /^[a-f0-9]{64}$/;
const expectedReasonCodes = [
  "UNKNOWN_FIELD_DENIED",
  "UNKNOWN_ACTION_DENIED",
  "HIDDEN_WRITE_DENIED",
  "SELF_APPROVAL_DENIED",
  "SAME_PRINCIPAL_ALIAS_DENIED",
  "MISSING_AUTHORIZATION_DENIED",
  "REPLAY_DENIED",
  "EXPIRY_DENIED",
  "REVOCATION_DENIED",
  "STALE_POLICY_DENIED",
  "DIGEST_DRIFT_DENIED",
  "TUPLE_DRIFT_DENIED",
  "GENERIC_COMMAND_DENIED",
  "CANCELLATION_AS_ROLLBACK_DENIED",
];

function canonicalize(value) {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value !== null && typeof value === "object") {
    return Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonicalize(value[key])]));
  }
  return value;
}

function digestJson(value) {
  return createHash("sha256").update(JSON.stringify(canonicalize(value))).digest("hex");
}

function without(value, key) {
  const copy = { ...value };
  delete copy[key];
  return copy;
}

function normalizedPrincipal(value) {
  const normalized = String(value).trim().toLowerCase();
  return normalized === "principal:synthetic-proposer-alias" ? "principal:synthetic-proposer" : normalized;
}

function unknownField(value) {
  if (value === null || typeof value !== "object") return false;
  if (Array.isArray(value)) return value.some(unknownField);
  if (Object.prototype.hasOwnProperty.call(value, "unlistedField")) return true;
  return Object.values(value).some(unknownField);
}

function deny(reasonCode) {
  return { accepted: false, outcome: "DENY", reasonCode, effectCount: 0, mutationCount: 0 };
}

function fullTuplePayload(value) {
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

function validateApproved(value, replayState = new Set()) {
  if (unknownField(value)) return deny("UNKNOWN_FIELD_DENIED");
  if (value?.proposal?.operationKey === "RUN_GENERIC_COMMAND") return deny("GENERIC_COMMAND_DENIED");
  if (value?.rollback?.permission === "CANCEL") return deny("CANCELLATION_AS_ROLLBACK_DENIED");
  if (value?.proposal?.action !== "UPDATE_SYNTHETIC_RECORD") return deny("UNKNOWN_ACTION_DENIED");
  if (value?.proposal?.request?.operation !== "UPDATE_SYNTHETIC_RECORD") return deny("HIDDEN_WRITE_DENIED");
  if (value?.approval?.state !== "APPROVED") return deny("MISSING_AUTHORIZATION_DENIED");
  const proposer = normalizedPrincipal(value?.proposal?.proposer);
  const approver = normalizedPrincipal(value?.approval?.approver);
  if (proposer === approver) {
    return deny(value.approval.approver === value.proposal.proposer
      ? "SELF_APPROVAL_DENIED"
      : "SAME_PRINCIPAL_ALIAS_DENIED");
  }
  if (value?.executionRequest?.replayState === "CONSUMED" || replayState.has(value?.executionRequest?.replayNonce)) {
    return deny("REPLAY_DENIED");
  }
  const observedAt = Date.parse(value?.observedAt);
  const expiryValues = [value?.proposal?.expiresAt, value?.approval?.expiresAt, value?.executionRequest?.expiresAt];
  if (!Number.isFinite(observedAt) || expiryValues.some((item) => !Number.isFinite(Date.parse(item)) || Date.parse(item) <= observedAt)) {
    return deny("EXPIRY_DENIED");
  }
  if (value?.approval?.revocationStatus !== "UNREVOKED") return deny("REVOCATION_DENIED");
  if (value?.policy?.generation !== 7 || value?.tuple?.policyGeneration !== 7 || value?.proposal?.policyGeneration !== 7 || value?.approval?.policyGeneration !== 7 || value?.executionRequest?.policyGeneration !== 7) {
    return deny("STALE_POLICY_DENIED");
  }
  if (value?.policy?.digest !== "3333333333333333333333333333333333333333333333333333333333333333") return deny("DIGEST_DRIFT_DENIED");
  const expectedTuple = digestJson(without(value.tuple, "tupleDigest"));
  if (value?.tuple?.tupleDigest !== expectedTuple
    || value?.tuple?.actionDigest !== "2222222222222222222222222222222222222222222222222222222222222222"
    || value?.tuple?.componentDigest !== "1111111111111111111111111111111111111111111111111111111111111111") return deny("TUPLE_DRIFT_DENIED");
  if (value?.proposal?.proposalDigest !== digestJson(without(value.proposal, "proposalDigest"))) return deny("DIGEST_DRIFT_DENIED");
  if (value?.approval?.approvalDigest !== digestJson(without(value.approval, "approvalDigest"))) return deny("DIGEST_DRIFT_DENIED");
  if (value?.executionRequest?.executionRequestDigest !== digestJson(without(value.executionRequest, "executionRequestDigest"))) return deny("DIGEST_DRIFT_DENIED");
  if (value?.actualExecution?.executionDigest !== digestJson(without(value.actualExecution, "executionDigest"))) return deny("DIGEST_DRIFT_DENIED");
  if (value?.readback?.readbackDigest !== digestJson(without(value.readback, "readbackDigest"))) return deny("DIGEST_DRIFT_DENIED");
  if (!validateSchema(value)) return deny("UNKNOWN_FIELD_DENIED");

  if (value.proposal.tupleDigest !== value.tuple.tupleDigest
    || value.approval.proposalDigest !== value.proposal.proposalDigest
    || value.approval.tupleDigest !== value.tuple.tupleDigest
    || value.executionRequest.approvalDigest !== value.approval.approvalDigest
    || value.executionRequest.proposalDigest !== value.proposal.proposalDigest
    || value.executionRequest.tupleDigest !== value.tuple.tupleDigest
    || value.readback.executionRequestDigest !== value.executionRequest.executionRequestDigest
    || value.readback.actualExecutionDigest !== value.actualExecution.executionDigest
    || value.receipt.bindings.tupleDigest !== value.tuple.tupleDigest
    || value.receipt.bindings.proposalDigest !== value.proposal.proposalDigest
    || value.receipt.bindings.approvalDigest !== value.approval.approvalDigest
    || value.receipt.bindings.executionRequestDigest !== value.executionRequest.executionRequestDigest
    || value.receipt.bindings.actualExecutionDigest !== value.actualExecution.executionDigest
    || value.receipt.bindings.readbackDigest !== value.readback.readbackDigest) return deny("DIGEST_DRIFT_DENIED");
  if (value.executionRequest.permission.directExecutionAllowed
    || value.executionRequest.permission.providerCallAllowed
    || value.actualExecution.providerCallPerformed
    || value.actualExecution.effectCount !== 0) return deny("HIDDEN_WRITE_DENIED");
  if (value.readback.source === "REQUEST_ECHO" || !value.readback.authoritative) return deny("MISSING_AUTHORIZATION_DENIED");
  if (value.rollback.targetTupleDigest !== value.tuple.lkgTupleDigest
    || value.rollback.target !== value.tuple.rollbackTarget
    || value.rollback.explicitAuthorizationPresent
    || value.rollback.cancellationIsRollback) return deny("CANCELLATION_AS_ROLLBACK_DENIED");
  if (value.readback.readbackDigest !== digestJson(without(value.readback, "readbackDigest"))) return deny("DIGEST_DRIFT_DENIED");
  if (value.receipt.fullTupleDigest !== digestJson(fullTuplePayload(value))) return deny("TUPLE_DRIFT_DENIED");
  if (value.receipt.receiptDigest !== digestJson(without(value.receipt, "receiptDigest"))) return deny("DIGEST_DRIFT_DENIED");
  const expectedBindings = {
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
  if (JSON.stringify(canonicalize(value.receipt.bindings)) !== JSON.stringify(canonicalize(expectedBindings))) return deny("DIGEST_DRIFT_DENIED");
  return { accepted: true, outcome: "ACCEPTED", reasonCode: null, effectCount: 0, mutationCount: 0, receiptDigest: value.receipt.receiptDigest };
}

function probe(base, name) {
  const candidate = structuredClone(base);
  switch (name) {
    case "UNKNOWN_FIELD": candidate.unlistedField = true; break;
    case "UNKNOWN_ACTION": candidate.proposal.action = "DELETE_RECORD"; break;
    case "HIDDEN_WRITE": candidate.proposal.request.operation = "DELETE_SYNTHETIC_RECORD"; break;
    case "SELF_APPROVAL": candidate.approval.approver = candidate.proposal.proposer; break;
    case "SAME_PRINCIPAL_ALIAS": candidate.approval.approver = "principal:synthetic-proposer-alias"; break;
    case "MISSING_AUTHORIZATION": candidate.approval.state = "NOT_APPROVED"; break;
    case "REPLAY": candidate.executionRequest.replayState = "CONSUMED"; break;
    case "EXPIRY": candidate.proposal.expiresAt = "2026-08-28T07:59:59Z"; break;
    case "REVOCATION": candidate.approval.revocationStatus = "REVOKED"; break;
    case "STALE_POLICY": candidate.policy.generation = 8; break;
    case "DIGEST_DRIFT": candidate.approval.approvalDigest = "a".repeat(64); break;
    case "TUPLE_DRIFT": candidate.tuple.actionDigest = "b".repeat(64); break;
    case "GENERIC_COMMAND": candidate.proposal.operationKey = "RUN_GENERIC_COMMAND"; break;
    case "CANCELLATION_AS_ROLLBACK": candidate.rollback.permission = "CANCEL"; break;
    default: throw new Error(`Unknown probe ${name}`);
  }
  return candidate;
}

test("the contract is closed, synthetic, pinned, and explicitly separates every lifecycle state", () => {
  assert.equal(validateSchema(approved), true, ajv.errorsText(validateSchema.errors));
  assert.equal(validateSchema(selfApproved), true, ajv.errorsText(validateSchema.errors));
  assert.equal(validateSchema(replayFixture), true, ajv.errorsText(validateSchema.errors));
  assert.equal(schema.oneOf.length, 2);
  assert.equal(approved.environmentClass, "LOCAL_SYNTHETIC_REPOSITORY_ONLY");
  assert.deepEqual(approved.lifecycle.states, ["PROPOSAL", "APPROVAL", "EXECUTION_REQUEST", "ACTUAL_EXECUTION", "READBACK", "RECEIPT", "ROLLBACK", "PUBLICATION"]);
  assert.equal(approved.permissions.executionRequest, "REQUEST_ONLY_NO_DIRECT_EXECUTION");
  assert.equal(approved.permissions.actualExecution, "NO_EXECUTION_IN_THIS_CONTRACT");
  assert.equal(approved.permissions.rollback, "EXPLICIT_AUTHORIZATION_REQUIRED_NO_INFERENCE");
  assert.equal(approved.permissions.publication, "EXPLICIT_PUBLIC_AUTHORIZATION_REQUIRED");
  assert.equal(approved.executionRequest.permission.directExecutionAllowed, false);
  assert.equal(approved.executionRequest.permission.providerCallAllowed, false);
  assert.equal(approved.actualExecution.providerCallPerformed, false);
  assert.equal(approved.publication.authorized, false);
  assert.deepEqual(new Set(approved.negativeResults.map((item) => item.reasonCode)), new Set(expectedReasonCodes));
});

test("a synthetic proposal has an exact tuple, expiry, and nonce; only independent approval enables the request", () => {
  const result = validateApproved(approved);
  assert.deepEqual(result, { accepted: true, outcome: "ACCEPTED", reasonCode: null, effectCount: 0, mutationCount: 0, receiptDigest: approved.receipt.receiptDigest });
  assert.notEqual(approved.proposal.proposer, approved.approval.approver);
  assert.equal(approved.approval.authorizationSource, "INDEPENDENT_APPROVAL_RECORD");
  assert.equal(approved.approval.independent, true);
  assert.match(approved.tuple.tupleDigest, digestPattern);
  assert.match(approved.proposal.proposalNonce, /nonce/);
  assert.match(approved.executionRequest.replayNonce, /nonce/);
  assert.ok(Date.parse(approved.proposal.expiresAt) > Date.parse(approved.observedAt));
  assert.equal(approved.executionRequest.approvalDigest, approved.approval.approvalDigest);
});

test("the execution request is not an execution capability and requires readback then receipt", () => {
  assert.deepEqual(approved.executionRequest.permission.requiredFollowUp, ["AUTHORITATIVE_READBACK", "BOUND_RECEIPT"]);
  assert.equal(approved.actualExecution.state, "NOT_EXECUTED_BY_CONTRACT");
  assert.equal(approved.readback.source, "AUTHORITATIVE_SYNTHETIC_CONTROL_PLANE_READBACK");
  assert.equal(approved.readback.authoritative, true);
  assert.equal(approved.receipt.tamperEvidence.independentReadbackRequired, true);
  assert.equal(approved.receipt.bindings.readbackDigest, approved.readback.readbackDigest);
  assert.equal(approved.receipt.bindings.rollbackTarget, approved.rollback.target);
  assert.equal(approved.rollback.explicitAuthorizationPresent, false);
  assert.equal(approved.rollback.cancellationIsRollback, false);
});

test("every lifecycle denial is deterministic, non-mutating, and bound to a non-sensitive reason", () => {
  const expected = new Map(approved.negativeResults.map((item) => [item.probe, item.reasonCode]));
  for (const probeName of expected.keys()) {
    const first = validateApproved(probe(approved, probeName));
    const second = validateApproved(probe(approved, probeName));
    assert.deepEqual(first, second, probeName);
    assert.equal(first.accepted, false, probeName);
    assert.equal(first.outcome, "DENY", probeName);
    assert.equal(first.effectCount, 0, probeName);
    assert.equal(first.mutationCount, 0, probeName);
    assert.equal(first.reasonCode, expected.get(probeName), probeName);
    assert.match(first.reasonCode, /^[A-Z_]+_DENIED$/);
  }
});

test("the named self-approved and replay fixtures are closed, explicit denial records", () => {
  assert.deepEqual(selfApproved, {
    schemaVersion: "pansphaira.azure-power-platform/proposal-approval-execution/v1",
    fixtureKind: "SELF_APPROVED",
    baseFixture: "tests/fixtures/azure-power-platform/proposal-approved.json",
    expectedReasonCode: "SELF_APPROVAL_DENIED",
    mutation: { path: "approval.approver", value: "principal:synthetic-proposer" },
  });
  assert.deepEqual(replayFixture, {
    schemaVersion: "pansphaira.azure-power-platform/proposal-approval-execution/v1",
    fixtureKind: "REPLAY",
    baseFixture: "tests/fixtures/azure-power-platform/proposal-approved.json",
    expectedReasonCode: "REPLAY_DENIED",
    mutation: { path: "executionRequest.replayState", value: "CONSUMED" },
  });
  const selfCandidate = structuredClone(approved);
  selfCandidate.approval.approver = selfApproved.mutation.value;
  const replayCandidate = structuredClone(approved);
  replayCandidate.executionRequest.replayState = replayFixture.mutation.value;
  assert.equal(validateApproved(selfCandidate).reasonCode, selfApproved.expectedReasonCode);
  assert.equal(validateApproved(replayCandidate).reasonCode, replayFixture.expectedReasonCode);
});

test("canonical key reordering preserves the accepted result and unknown fields cannot be smuggled", () => {
  const reverse = (value) => Array.isArray(value)
    ? value.map(reverse)
    : value !== null && typeof value === "object"
      ? Object.fromEntries(Object.entries(value).reverse().map(([key, child]) => [key, reverse(child)]))
      : value;
  assert.deepEqual(validateApproved(reverse(approved)), validateApproved(approved));
  const unknown = structuredClone(approved);
  unknown.receipt.unlistedField = true;
  assert.equal(validateSchema(unknown), false);
  assert.equal(validateApproved(unknown).reasonCode, "UNKNOWN_FIELD_DENIED");
});
