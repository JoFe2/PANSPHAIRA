import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import Ajv2020 from "ajv/dist/2020.js";
import addFormats from "ajv-formats";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const contractPath = path.join(root, "contracts/azure-power-platform/authoritative-readback-receipt.schema.json");
const fixtureDir = path.join(root, "tests/fixtures/azure-power-platform");
const readJson = async (filePath) => JSON.parse(await readFile(filePath, "utf8"));
const schema = await readJson(contractPath);
const accepted = await readJson(path.join(fixtureDir, "readback-accepted.json"));
const tamperedReadback = await readJson(path.join(fixtureDir, "readback-tampered.json"));
const ajv = new Ajv2020({ allErrors: true, strict: true });
addFormats(ajv);
const validateSchema = ajv.compile(schema);
const expectedIssuer = "pansphaira.local-readback-verifier";
const maxReadbackDelayMs = 30_000;
const negativeReasons = new Set([
  "MISSING_READBACK_DENIED",
  "DELAYED_READBACK_DENIED",
  "READBACK_TAMPERED_DENIED",
  "RECEIPT_TAMPERED_DENIED",
  "REQUEST_BINDING_MISMATCH_DENIED",
  "STALE_TUPLE_DENIED",
  "ISSUER_ALIAS_DENIED",
  "UNKNOWN_RECEIPT_FIELD_DENIED",
]);

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

function fullTuple(value) {
  return {
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
}

function deny(reasonCode) {
  return { accepted: false, reasonCode };
}

function hasUnknownReceiptKey(receipt) {
  const allowed = new Set(["schemaVersion", "issuer", "version", "issuedAt", "fullTupleDigest", "bindings", "receiptDigest"]);
  const bindingAllowed = new Set([
    "operationId", "requestDigest", "decisionDigest", "readbackDigest", "policyId", "policyVersion",
    "policyGeneration", "policyDigest", "evidenceDigest", "lkgTupleDigest", "rollbackTarget",
  ]);
  if (receipt === null || typeof receipt !== "object" || Array.isArray(receipt)) return true;
  if (Object.keys(receipt).some((key) => !allowed.has(key))) return true;
  return receipt.bindings === null
    || typeof receipt.bindings !== "object"
    || Array.isArray(receipt.bindings)
    || Object.keys(receipt.bindings).some((key) => !bindingAllowed.has(key));
}

function verifyReceipt(value) {
  if (value?.readback === undefined) return deny("MISSING_READBACK_DENIED");
  if (value?.receipt?.issuer !== expectedIssuer) return deny("ISSUER_ALIAS_DENIED");
  if (hasUnknownReceiptKey(value?.receipt)) return deny("UNKNOWN_RECEIPT_FIELD_DENIED");
  if (!validateSchema(value)) return deny("UNKNOWN_RECEIPT_FIELD_DENIED");

  if (value.statusObservation.source === value.readback.source) return deny("READBACK_TAMPERED_DENIED");
  if (value.operation.operationId !== value.request.operationId
    || value.operation.operationId !== value.statusObservation.operationId
    || value.operation.operationId !== value.readback.operationId) {
    return deny("REQUEST_BINDING_MISMATCH_DENIED");
  }
  if (value.requestDigest !== digestJson(value.request)) return deny("REQUEST_BINDING_MISMATCH_DENIED");
  if (value.request.action !== value.operation.action
    || value.request.actionVersion !== value.operation.actionVersion
    || value.request.actionDigest !== value.operation.actionDigest) {
    return deny("REQUEST_BINDING_MISMATCH_DENIED");
  }
  if (value.evidence.bundleDigest !== digestJson(without(value.evidence, "bundleDigest"))) {
    return deny("STALE_TUPLE_DENIED");
  }
  if (value.policy.generation !== value.decision.policyGeneration
    || value.policy.id !== value.decision.policyId
    || value.policy.version !== value.decision.policyVersion
    || value.policy.digest !== value.decision.policyDigest) {
    return deny("STALE_TUPLE_DENIED");
  }
  if (value.decision.requestDigest !== value.requestDigest
    || value.decision.operationId !== value.operation.operationId
    || value.decision.action !== value.operation.action
    || value.decision.actionVersion !== value.operation.actionVersion
    || value.decision.actionDigest !== value.operation.actionDigest
    || value.decision.evidenceDigest !== value.evidence.bundleDigest
    || value.decisionDigest !== digestJson(value.decision)) {
    return deny("REQUEST_BINDING_MISMATCH_DENIED");
  }
  if (value.readback.requestDigest !== value.requestDigest
    || value.readback.action !== value.operation.action
    || value.readback.actionVersion !== value.operation.actionVersion
    || value.readback.actionDigest !== value.operation.actionDigest) {
    return deny("REQUEST_BINDING_MISMATCH_DENIED");
  }
  const readbackDelayMs = Date.parse(value.readback.observedAt) - Date.parse(value.statusObservation.observedAt);
  if (readbackDelayMs < 0 || readbackDelayMs > maxReadbackDelayMs) {
    return deny("DELAYED_READBACK_DENIED");
  }
  if (value.readbackDigest !== digestJson(value.readback)) return deny("READBACK_TAMPERED_DENIED");
  if (value.lkg.revocationStatus !== "UNREVOKED"
    || value.rollback.targetTupleDigest !== value.lkg.tupleDigest
    || value.rollback.targetStatus !== value.lkg.status
    || value.rollback.target !== value.decision.rollbackTarget) {
    return deny("STALE_TUPLE_DENIED");
  }
  if (value.receipt.fullTupleDigest !== digestJson(fullTuple(value))) return deny("STALE_TUPLE_DENIED");

  const expectedBindings = {
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
  if (JSON.stringify(canonicalize(value.receipt.bindings)) !== JSON.stringify(canonicalize(expectedBindings))) {
    return deny("REQUEST_BINDING_MISMATCH_DENIED");
  }
  if (value.receipt.receiptDigest !== digestJson(without(value.receipt, "receiptDigest"))) {
    return deny("RECEIPT_TAMPERED_DENIED");
  }
  return { accepted: true, receiptDigest: value.receipt.receiptDigest, fullTupleDigest: value.receipt.fullTupleDigest };
}

function shuffledObject(value) {
  if (Array.isArray(value)) return value.map(shuffledObject);
  if (value !== null && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).reverse().map(([key, child]) => [key, shuffledObject(child)]));
  }
  return value;
}

function expectDenied(value, reasonCode) {
  const first = verifyReceipt(value);
  const second = verifyReceipt(structuredClone(value));
  assert.equal(first.accepted, false);
  assert.equal(second.accepted, false);
  assert.deepEqual(first, second);
  if (reasonCode) assert.equal(first.reasonCode, reasonCode);
}

test("closed schema distinguishes status observation from authoritative readback and has no client success field", () => {
  assert.equal(validateSchema(accepted), true, ajv.errorsText(validateSchema.errors));
  assert.equal(schema.additionalProperties, false);
  assert.equal(accepted.statusObservation.source, "OPERATION_STATUS_STORE");
  assert.equal(accepted.statusObservation.status, "ACCEPTED");
  assert.equal(accepted.readback.source, "AUTHORITATIVE_POST_ACCEPT_READBACK");
  assert.equal(accepted.readback.status, "READ_CONFIRMED");
  assert.equal(accepted.statusObservation.success, undefined);
  assert.equal(accepted.statusObservation.businessSuccess, undefined);
  assert.equal(accepted.readback.success, undefined);
  const keys = (value) => value && typeof value === "object"
    ? Object.entries(value).flatMap(([key, child]) => [key, ...keys(child)])
    : [];
  assert.equal(keys(accepted).some((key) => key === "success" || key === "businessSuccess"), false);
});

test("accepted synthetic read requires and verifies authoritative readback with matching tuple and request digest", () => {
  const result = verifyReceipt(accepted);
  assert.equal(result.accepted, true);
  assert.equal(result.receiptDigest, accepted.receipt.receiptDigest);
  assert.equal(accepted.statusObservation.status, "ACCEPTED");
  assert.equal(accepted.readback.status, "READ_CONFIRMED");
  assert.equal(accepted.readback.effectCount, 0);
  assert.equal(accepted.requestDigest, digestJson(accepted.request));
  assert.equal(accepted.readback.requestDigest, accepted.requestDigest);
  assert.equal(accepted.decision.requestDigest, accepted.requestDigest);
  assert.notEqual(accepted.statusObservation.source, accepted.readback.source);
});

test("receipt binds canonical request, independent decision, readback, policy generation, evidence and LKG", () => {
  const result = verifyReceipt(accepted);
  assert.equal(result.accepted, true);
  assert.equal(accepted.decision.source, "INDEPENDENT_POLICY_AUTHORITY");
  assert.equal(accepted.decisionDigest, digestJson(accepted.decision));
  assert.equal(accepted.readbackDigest, digestJson(accepted.readback));
  assert.equal(accepted.evidence.bundleDigest, digestJson(without(accepted.evidence, "bundleDigest")));
  assert.equal(accepted.receipt.bindings.policyGeneration, accepted.policy.generation);
  assert.equal(accepted.receipt.bindings.policyDigest, accepted.policy.digest);
  assert.equal(accepted.receipt.bindings.evidenceDigest, accepted.evidence.bundleDigest);
  assert.equal(accepted.receipt.bindings.lkgTupleDigest, accepted.lkg.tupleDigest);
  assert.equal(accepted.rollback.targetTupleDigest, accepted.lkg.tupleDigest);
  assert.equal(accepted.receipt.fullTupleDigest, digestJson(fullTuple(accepted)));
  assert.equal(accepted.receipt.receiptDigest, digestJson(without(accepted.receipt, "receiptDigest")));
  assert.equal(accepted.negativeResults.length, 8);
  assert.deepEqual(new Set(accepted.negativeResults.map((item) => item.reasonCode)), negativeReasons);
});

test("canonical key reordering produces the same deterministic receipt verification", () => {
  assert.deepEqual(verifyReceipt(shuffledObject(accepted)), verifyReceipt(accepted));
});

test("missing or delayed readback denies fail closed", () => {
  const missing = structuredClone(accepted);
  delete missing.readback;
  expectDenied(missing, "MISSING_READBACK_DENIED");

  const delayed = structuredClone(accepted);
  delayed.readback.observedAt = "2026-08-28T08:01:00Z";
  expectDenied(delayed, "DELAYED_READBACK_DENIED");
});

test("tampered readback or receipt denies after any binding mismatch", () => {
  expectDenied(tamperedReadback, "READBACK_TAMPERED_DENIED");

  const receiptTampered = structuredClone(accepted);
  receiptTampered.receipt.issuedAt = "2026-08-28T08:00:05Z";
  expectDenied(receiptTampered, "RECEIPT_TAMPERED_DENIED");
});

test("wrong request digest, stale tuple, issuer alias and unknown receipt field deny", () => {
  const wrongRequest = structuredClone(accepted);
  wrongRequest.requestDigest = "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
  expectDenied(wrongRequest, "REQUEST_BINDING_MISMATCH_DENIED");

  const stale = structuredClone(accepted);
  stale.policy.generation = 8;
  expectDenied(stale, "STALE_TUPLE_DENIED");

  const issuerAlias = structuredClone(accepted);
  issuerAlias.receipt.issuer = "pansphaira.readback-verifier";
  expectDenied(issuerAlias, "ISSUER_ALIAS_DENIED");

  const unknownField = structuredClone(accepted);
  unknownField.receipt.unlisted = true;
  expectDenied(unknownField, "UNKNOWN_RECEIPT_FIELD_DENIED");
});

test("synthetic fixtures contain no tenant or identity-bearing fields", () => {
  const forbidden = /^(tenant|subscription|identity|credential|accessToken|secret)$/i;
  const keys = (value) => {
    if (Array.isArray(value)) return value.flatMap(keys);
    if (value === null || typeof value !== "object") return [];
    return Object.entries(value).flatMap(([key, child]) => [key, ...keys(child)]);
  };
  for (const fixture of [accepted, tamperedReadback]) {
    assert.equal(keys(fixture).some((key) => forbidden.test(key)), false);
    assert.equal(fixture.environmentClass, "LOCAL_SYNTHETIC_REPOSITORY_ONLY");
  }
});
