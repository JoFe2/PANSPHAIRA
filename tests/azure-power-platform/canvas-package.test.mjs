import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { loadPackage, validateMutation, validatePackage } from "../../tools/azure-power-platform/validate-canvas-package.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const fixtureDir = path.join(root, "tests/fixtures/azure-power-platform");
const readJson = async (filePath) => JSON.parse(await readFile(filePath, "utf8"));
const digestPattern = /^[a-f0-9]{64}$/;
const negativeCases = [
  ["unknown-fields", "SCHEMA_DENIED"],
  ["unknown-actions", "UNKNOWN_ACTION_DENIED"],
  ["hidden-writes", "HIDDEN_WRITE_DENIED"],
  ["self-approval", "APPROVAL_SAME_ACTOR_DENIED"],
  ["digest-drift", "DIGEST_MISMATCH_DENIED"],
  ["replay", "REPLAY_CONSUMED_DENIED"],
  ["expiry", "AUTHORITY_EXPIRED_DENIED"],
  ["revocation", "REVOCATION_BINDING_DENIED"],
  ["stale-policy", "POLICY_STALE_DENIED"],
];

const packageValue = await loadPackage(root);

function assertNoAuthorityMaterial(value) {
  const forbidden = /^(accessToken|credential|secret|subscription|tenant|identity|environmentId|approval|approver|proposer|replay|expiry|revocation)$/i;
  const visit = (item) => {
    if (Array.isArray(item)) return item.forEach(visit);
    if (item === null || typeof item !== "object") return;
    for (const [key, child] of Object.entries(item)) {
      assert.equal(forbidden.test(key), false, `forbidden package field: ${key}`);
      visit(child);
    }
  };
  visit(value);
}

test("static package binds the exact closed connector tuple and emits a digest", async () => {
  const result = await validatePackage(packageValue, root);
  assert.equal(result.accepted, true, JSON.stringify(result));
  assert.equal(result.status, "PASS");
  assert.match(result.packageDigest, digestPattern);
  assert.equal(result.tupleLedger.schemaVersion, "pansphaira.power-platform/canvas-tuple-ledger/v1");
  assert.equal(result.tupleLedger.environmentClass, "LOCAL_SYNTHETIC_REPOSITORY_ONLY");
  assert.equal(result.tupleLedger.connectorContract.version, "1.0.0");
  assert.match(result.tupleLedger.connectorContract.digest, digestPattern);
  assert.match(result.tupleLedger.openApi.documentDigest, digestPattern);
  assert.equal(result.tupleLedger.policy.generation, null);
  assert.equal(result.tupleLedger.activationState, "INACTIVE");
  assert.equal(result.tupleLedger.rollbackTarget, "EXACT_LKG_FULL_TUPLE_DIGEST_FROM_INDEPENDENT_TRUSTED_CONTEXT");
  assert.equal(result.tupleLedger.evidenceRefs.length >= 3, true);
});

test("Canvas surface exposes only discovery, query, status, readback and receipt", () => {
  const manifest = packageValue.manifest;
  assert.deepEqual(manifest.views.map((view) => view.semantic), ["DISCOVERY", "QUERY", "STATUS", "READBACK", "RECEIPT"]);
  assert.deepEqual(manifest.views.map((view) => view.operationKey), ["LIST_CAPABILITIES", "SUBMIT_GOVERNED_QUERY", "GET_OPERATION_STATUS", "GET_READBACK", "GET_RECEIPT"]);
  assert.deepEqual(packageValue.connectorBinding.surface.allowedActions, ["READ_RECORD", "READ_METADATA"]);
  assert.deepEqual(packageValue.connectorBinding.surface.governedMutationActions, []);
  assert.equal(Object.values(packageValue.connectorBinding.surface.genericEscapeHatches).every((value) => value === false), true);
  assert.equal(packageValue.manifest.importPolicy.importAllowed, false);
  assert.equal(packageValue.manifest.activationState, "INACTIVE");
  assertNoAuthorityMaterial(packageValue);
});

test("accepted transport result routes to authoritative readback and receipt projection", () => {
  const accepted = packageValue.syntheticAcceptedResult;
  assert.equal(accepted.statusObservation.status, "ACCEPTED");
  assert.equal(accepted.statusObservation.businessSuccess, undefined);
  assert.equal(accepted.readback.status, "READ_CONFIRMED");
  assert.equal(accepted.readback.effectCount, 0);
  assert.equal(accepted.receipt.issuer, "pansphaira.local-readback-verifier");
  assert.equal(packageValue.manifest.acceptedOperationProjection.transportAcceptanceIsBusinessSuccess, false);
  assert.deepEqual(packageValue.manifest.acceptedOperationProjection.requiredSequence, ["SUBMIT_GOVERNED_QUERY", "GET_OPERATION_STATUS", "GET_READBACK", "GET_RECEIPT"]);
  assert.equal(packageValue.manifest.acceptedOperationProjection.successProjection, "AUTHORITATIVE_READBACK_AND_BOUND_RECEIPT");
});

test("unknown fields/actions, writes, self-approval, drift, replay, expiry, revocation and stale policy deny deterministically", async () => {
  for (const [caseId, reasonCode] of negativeCases) {
    const mutation = { caseId };
    if (caseId === "hidden-writes") Object.assign(mutation, { kind: "write", action: "CREATE_RECORD", method: "POST" });
    const first = await validateMutation(packageValue, mutation, root);
    const second = await validateMutation(structuredClone(packageValue), mutation, root);
    assert.equal(first.accepted, false, caseId);
    assert.equal(first.reasonCode, reasonCode, caseId);
    assert.deepEqual(first, second, caseId);
  }
});

test("the write-intent fixture is denied without changing the inactive package", async () => {
  const fixture = await readJson(path.join(fixtureDir, "canvas-package-write-intent.json"));
  const result = await validateMutation(packageValue, fixture.mutation, root);
  assert.equal(result.accepted, false);
  assert.equal(result.reasonCode, fixture.expectedReasonCode);
  assert.equal((await validatePackage(packageValue, root)).accepted, true);
});

test("package closure rejects unknown manifest fields and authority-bearing substitutions", async () => {
  const unknown = structuredClone(packageValue);
  unknown.manifest.unlisted = true;
  const unknownResult = await validatePackage(unknown, root);
  assert.equal(unknownResult.accepted, false);
  assert.equal(unknownResult.reasonCode, "SCHEMA_DENIED");

  const credential = structuredClone(packageValue);
  credential.manifest.credentials.embeddedAllowed = true;
  const credentialResult = await validatePackage(credential, root);
  assert.equal(credentialResult.accepted, false);
  assert.equal(credentialResult.reasonCode, "AUTHORITY_BINDING_DENIED");
});
