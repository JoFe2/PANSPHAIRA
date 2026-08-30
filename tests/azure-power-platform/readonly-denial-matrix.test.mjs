import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import Ajv2020 from "ajv/dist/2020.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const contractPath = path.join(root, "contracts/azure-power-platform/readonly-denial-matrix.schema.json");
const fixturePath = path.join(root, "tests/fixtures/azure-power-platform/denials.json");
const readJson = async (filePath) => JSON.parse(await readFile(filePath, "utf8"));
const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");
const digestPattern = /^[a-f0-9]{64}$/;

const schema = await readJson(contractPath);
const matrix = await readJson(fixturePath);
const validateMatrix = new Ajv2020({ allErrors: true, strict: true }).compile(schema);

function canonicalize(value) {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value !== null && typeof value === "object") {
    return Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonicalize(value[key])]));
  }
  return value;
}

function digestJson(value) {
  return sha256(Buffer.from(JSON.stringify(canonicalize(value))));
}

function without(value, key) {
  const copy = { ...value };
  delete copy[key];
  return copy;
}

function proposalCore(request) {
  return {
    operationKey: request.operationKey,
    action: request.action,
    actionVersion: request.actionVersion,
    actionDigest: request.actionDigest,
    policyGeneration: request.policyGeneration,
    policyDigest: request.policyDigest,
    authorityId: request.authorityId,
    authorityVersion: request.authorityVersion,
    authorityDigest: request.authorityDigest,
    request: request.request,
  };
}

function projectionFor(request) {
  return {
    schemaVersion: matrix.admissionBoundary.schemaVersion,
    environmentClass: request.environmentClass,
    policyId: matrix.selectedPolicy.id,
    policyVersion: matrix.selectedPolicy.version,
    policyGeneration: matrix.selectedPolicy.generation,
    policyDigest: matrix.selectedPolicy.digest,
    authorityId: matrix.selectedAuthority.id,
    authorityVersion: matrix.selectedAuthority.version,
    authorityDigest: matrix.selectedAuthority.digest,
    action: request.action,
    actionVersion: request.actionVersion,
    actionDigest: request.actionDigest,
    proposalDigest: request.proposalDigest,
    requestDigest: request.requestDigest,
    evidenceDigest: matrix.evidence.evidenceDigest,
    outcome: "ALLOW",
    reasonCode: null,
    effectCount: 0,
    rollbackTarget: matrix.rollback.target,
  };
}

function deny(request, reasonCode) {
  return {
    outcome: "DENY",
    reasonCode,
    effectCount: 0,
    projection: null,
    decisionDigest: digestJson({
      boundary: matrix.admissionBoundary.id,
      environmentClass: matrix.environmentClass,
      policyGeneration: matrix.selectedPolicy.generation,
      policyDigest: matrix.selectedPolicy.digest,
      requestDigest: request.requestDigest ?? null,
      reasonCode,
    }),
  };
}

function exactKeys(value, expected) {
  return value !== null
    && typeof value === "object"
    && !Array.isArray(value)
    && JSON.stringify(Object.keys(value).sort()) === JSON.stringify([...expected].sort());
}

const requestKeys = [
  "schemaVersion", "environmentClass", "operationKey", "action", "actionVersion", "actionDigest",
  "policyGeneration", "policyDigest", "authorityId", "authorityVersion", "authorityDigest",
  "proposalDigest", "requestDigest", "replayNonce", "issuedAt", "expiresAt", "requester", "approver",
  "revocationStatus", "request",
];
const innerRequestKeys = ["resource", "operation", "fields"];

function admit(request, replayState, outboundWriteCallback) {
  if (!exactKeys(request, requestKeys) || !exactKeys(request.request, innerRequestKeys)) {
    return deny(request, "UNKNOWN_FIELD_DENIED");
  }
  if (!matrix.admissionBoundary.allowedActions.includes(request.action)) {
    return deny(request, "UNKNOWN_ACTION_DENIED");
  }
  if (request.request.operation !== "READ") {
    return deny(request, "HIDDEN_WRITE_DENIED");
  }
  if (request.request.resource !== "synthetic.power-platform.record") {
    return deny(request, "HIDDEN_WRITE_DENIED");
  }
  if (request.requester === request.approver) {
    return deny(request, "APPROVAL_SAME_ACTOR_DENIED");
  }
  if (request.requester !== matrix.selectedAuthority.requester
    || request.approver !== matrix.selectedAuthority.approver) {
    return deny(request, "AUTHORITY_BINDING_DENIED");
  }
  if (request.policyDigest !== matrix.selectedPolicy.digest
    || request.authorityId !== matrix.selectedAuthority.id
    || request.authorityVersion !== matrix.selectedAuthority.version
    || request.authorityDigest !== matrix.selectedAuthority.digest
    || request.actionVersion !== "1.0.0"
    || request.actionDigest !== "1111111111111111111111111111111111111111111111111111111111111111") {
    return deny(request, "DIGEST_DRIFT_DENIED");
  }
  if (replayState.has(request.replayNonce)) {
    return deny(request, "REPLAY_CONSUMED_DENIED");
  }
  if (Date.parse(request.expiresAt) <= Date.parse(matrix.observedAt)) {
    return deny(request, "AUTHORITY_EXPIRED_DENIED");
  }
  if (request.revocationStatus !== "UNREVOKED" || matrix.selectedAuthority.revocationStatus !== "UNREVOKED") {
    return deny(request, "AUTHORITY_REVOKED_DENIED");
  }
  if (request.policyGeneration !== matrix.selectedPolicy.generation) {
    return deny(request, "POLICY_STALE_DENIED");
  }
  if (request.requestDigest !== digestJson(without(request, "requestDigest"))
    || request.proposalDigest !== digestJson(proposalCore(request))) {
    return deny(request, "DIGEST_DRIFT_DENIED");
  }

  const projection = projectionFor(request);
  const result = {
    outcome: "ALLOW",
    reasonCode: null,
    effectCount: 0,
    projection,
    decisionDigest: digestJson(projection),
  };
  replayState.add(request.replayNonce);
  if (result.effectCount !== 0) outboundWriteCallback();
  return result;
}

function shuffledObject(value) {
  if (Array.isArray(value)) return value.map(shuffledObject);
  if (value !== null && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).reverse().map(([key, child]) => [key, shuffledObject(child)]));
  }
  return value;
}

function probeRequest(base, probe) {
  const request = structuredClone(base);
  switch (probe) {
    case "UNKNOWN_ACTION": request.action = "DELETE_RECORD"; break;
    case "UNKNOWN_FIELD": request.unlistedField = "forbidden"; break;
    case "HIDDEN_WRITE": request.request.operation = "UPDATE"; break;
    case "SELF_APPROVAL": request.approver = request.requester; break;
    case "DIGEST_DRIFT": request.requestDigest = "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"; break;
    case "REPLAY_NONCE": break;
    case "EXPIRY": request.expiresAt = "2026-08-09T10:29:00Z"; break;
    case "REVOCATION": request.revocationStatus = "REVOKED"; break;
    case "STALE_POLICY": request.policyGeneration = 6; break;
    default: throw new Error(`unhandled probe ${probe}`);
  }
  return request;
}

test("the denial matrix is schema-valid, closed, pinned, and has no generic escape hatch", async () => {
  assert.equal(validateMatrix(matrix), true, JSON.stringify(validateMatrix.errors));
  assert.equal(schema.additionalProperties, false);
  assert.equal(matrix.environmentClass, "LOCAL_SYNTHETIC_REPOSITORY_ONLY");
  assert.equal(matrix.selectedPolicy.generation, 7);
  assert.match(matrix.selectedPolicy.digest, digestPattern);
  assert.match(matrix.selectedAuthority.digest, digestPattern);
  assert.deepEqual(matrix.admissionBoundary.allowedActions, ["READ_RECORD", "READ_METADATA"]);
  assert.deepEqual(matrix.admissionBoundary.errorSurface.allowedFields, ["schemaVersion", "code", "correlationDigest", "decisionDigest"]);
  assert.equal(matrix.admissionBoundary.errorSurface.allowedReasonCodes.length, 10);
  assert.equal(matrix.admissionBoundary.zeroMutationOnDeny, true);
  assert.deepEqual(matrix.admissionBoundary.genericEscapeHatches, {
    genericAction: false,
    genericField: false,
    genericProxy: false,
    freeTextError: false,
    capabilityBytes: false,
  });
  assert.deepEqual(new Set(matrix.negativeCases.map((item) => item.expectedReason)).size, 9);
  assert.equal(matrix.evidence.evidenceDigest, digestJson(without(matrix.evidence, "evidenceDigest")));
  for (const reference of matrix.evidence.refs) {
    assert.match(reference.ref, /^(contracts|docs|packages|tests)\//);
    assert.equal(reference.digest, sha256(await readFile(path.join(root, reference.ref))), reference.id);
  }
});

test("an independently authorized synthetic read reaches the selected admission projection with stable evidence", () => {
  const request = matrix.positive.request;
  const replayState = new Set();
  let outboundCalls = 0;
  const result = admit(request, replayState, () => { outboundCalls += 1; });
  assert.equal(result.outcome, "ALLOW");
  assert.equal(result.reasonCode, null);
  assert.equal(result.effectCount, 0);
  assert.equal(outboundCalls, 0);
  assert.equal(request.requester !== request.approver, true);
  assert.equal(matrix.selectedAuthority.authorizationSource, "SELECTED_AUTHORITY_RECORD");
  assert.equal(matrix.selectedAuthority.capabilityBytesGrantAuthority, false);
  assert.deepEqual(result.projection, matrix.positive.projection);
  assert.equal(result.decisionDigest, matrix.positive.decisionDigest);
  assert.equal(result.decisionDigest, digestJson(result.projection));
  assert.equal(matrix.positive.request.requestDigest, digestJson(without(request, "requestDigest")));
  assert.equal(matrix.positive.request.proposalDigest, digestJson(proposalCore(request)));
});

test("equivalent canonical read inputs return the same allow decision digest", () => {
  const first = admit(structuredClone(matrix.positive.request), new Set(), () => {});
  const reordered = admit(shuffledObject(matrix.positive.request), new Set(), () => {});
  assert.equal(first.outcome, "ALLOW");
  assert.equal(reordered.outcome, "ALLOW");
  assert.equal(reordered.decisionDigest, first.decisionDigest);
  assert.deepEqual(reordered.projection, first.projection);
});

test("every named negative probe denies deterministically before any outbound or write callback", () => {
  const resultByProbe = new Map(matrix.negativeResults.map((item) => [item.probe, item]));
  assert.equal(resultByProbe.size, 9);
  for (const item of matrix.negativeCases) {
    const expected = resultByProbe.get(item.probe);
    assert.ok(expected, item.id);
    assert.equal(expected.reasonCode, item.expectedReason, item.id);
    const replayState = new Set(item.probe === "REPLAY_NONCE" ? [matrix.positive.request.replayNonce] : []);
    let outboundCalls = 0;
    const result = admit(probeRequest(matrix.positive.request, item.probe), replayState, () => { outboundCalls += 1; });
    assert.equal(result.outcome, item.expectedOutcome, item.id);
    assert.equal(result.reasonCode, item.expectedReason, item.id);
    assert.equal(result.effectCount, item.expectedEffectCount, item.id);
    assert.equal(outboundCalls, 0, item.id);
    assert.equal(expected.outcome, result.outcome, item.id);
    assert.equal(expected.effectCount, result.effectCount, item.id);
    assert.equal(expected.policyGeneration, matrix.selectedPolicy.generation, item.id);
    assert.equal(expected.evidenceDigest, matrix.evidence.evidenceDigest, item.id);
    assert.equal(expected.rollbackTarget, matrix.rollback.target, item.id);
  }
});

test("unknown capability-byte or self-declared approval cannot create an alternate authorization path", () => {
  const capabilityForgery = structuredClone(matrix.positive.request);
  capabilityForgery.capabilityBytes = "ff";
  const selfApprovalForgery = structuredClone(matrix.positive.request);
  selfApprovalForgery.approver = selfApprovalForgery.requester;
  assert.equal(admit(capabilityForgery, new Set(), () => {}).reasonCode, "UNKNOWN_FIELD_DENIED");
  assert.equal(admit(selfApprovalForgery, new Set(), () => {}).reasonCode, "APPROVAL_SAME_ACTOR_DENIED");
  assert.equal(matrix.selectedAuthority.selfApprovalAllowed, false);
  assert.equal(matrix.selectedAuthority.capabilityBytesGrantAuthority, false);
});
