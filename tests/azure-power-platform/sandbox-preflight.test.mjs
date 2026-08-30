import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import Ajv2020 from "ajv/dist/2020.js";
import { applyNegativeCase, loadFixture, validatePacket } from "../../tools/azure-power-platform/validate-sandbox-preflight.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const authorizedPath = "tests/fixtures/azure-power-platform/sandbox-preflight-authorized.json";
const deniedPath = "tests/fixtures/azure-power-platform/sandbox-preflight-denied.json";
const schemaPath = path.join(root, "docs/development/azure-power-platform/sandbox-preflight-packet.schema.json");
const negativeCases = [
  ["unknown-fields", "UNKNOWN_FIELD_DENIED"],
  ["unknown-actions", "UNKNOWN_ACTION_DENIED"],
  ["hidden-writes", "HIDDEN_WRITE_DENIED"],
  ["self-approval", "APPROVAL_SAME_ACTOR_DENIED"],
  ["digest-drift", "DIGEST_DRIFT_DENIED"],
  ["replay", "REPLAY_CONSUMED_DENIED"],
  ["expiry", "AUTHORITY_EXPIRED_DENIED"],
  ["revocation", "AUTHORITY_REVOKED_DENIED"],
  ["stale-policy", "POLICY_STALE_DENIED"],
  ["missing-authorization", "MISSING_AUTHORIZATION_DENIED"],
  ["wrong-environment", "WRONG_ENVIRONMENT_CLASS_DENIED"],
  ["private-identifier", "PRIVATE_IDENTIFIER_DENIED"],
  ["expired-evidence", "EVIDENCE_EXPIRED_DENIED"],
];

const packet = await loadFixture(authorizedPath, root);
const deniedFixture = await loadFixture(deniedPath, root);
const schema = JSON.parse(await readFile(schemaPath, "utf8"));
const validateSchema = new Ajv2020({ allErrors: true, strict: true }).compile(schema);

function publicProjection(result) {
  return result.projection;
}

function assertNoPrivateKeys(value) {
  const forbiddenKey = /^(tenant|subscription|identity|credential|secret|accessToken|environmentId|privatePath|endpoint|host)$/i;
  const visit = (item) => {
    if (Array.isArray(item)) return item.forEach(visit);
    if (item === null || typeof item !== "object") return;
    for (const [key, child] of Object.entries(item)) {
      assert.equal(forbiddenKey.test(key), false, `private key: ${key}`);
      visit(child);
    }
  };
  visit(value);
}

test("the synthetic delegated least-privilege packet validates offline", () => {
  assert.equal(validateSchema(packet), true, JSON.stringify(validateSchema.errors));
  const result = validatePacket(packet);
  assert.equal(result.accepted, true, JSON.stringify(result));
  assert.equal(result.status, "READY");
  assert.equal(result.reasonCode, "SYNTHETIC_PREFLIGHT_READY");
  assert.deepEqual(publicProjection(result), {
    status: "READY",
    reasonCode: "SYNTHETIC_PREFLIGHT_READY",
    environmentClass: "SINGLE_TENANT_DISPOSABLE_SANDBOX",
    authorizationClaim: "NOT_AN_APPROVAL",
    authenticationPerformed: false,
    cloudDiscoveryPerformed: false,
    externalMutationPerformed: false,
    identifiersRedacted: true,
  });
  assert.equal(packet.authorization.delegation, "DELEGATED_LEAST_PRIVILEGE");
  assert.deepEqual(packet.authorization.requiredOwnerAttestations, ["RESOURCE_OWNER", "POLICY_OWNER"]);
  assert.deepEqual(packet.authorization.ownerAttestationRefs, ["owner-attestation", "policy-attestation"]);
  assert.equal(packet.rollback.target, "EXACT_LKG_FULL_PREFLIGHT_TUPLE");
  assert.equal(packet.rollback.targetTupleDigest, "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa");
  assert.deepEqual(packet.rollback.evidenceRefs, ["lkg-reference", "rollback-test"]);
  assertNoPrivateKeys(packet);
  assert.equal(JSON.stringify(packet).includes("/tmp/"), false);
  assert.equal(JSON.stringify(packet).includes("https://"), false);
});

test("the packet is deterministic and does not claim actual approval or cloud contact", () => {
  const first = validatePacket(packet);
  const second = validatePacket(structuredClone(packet));
  assert.deepEqual(first, second);
  assert.equal(packet.authorization.notAnApproval, true);
  assert.equal(packet.preflight.authenticationPerformed, false);
  assert.equal(packet.preflight.cloudDiscoveryPerformed, false);
  assert.equal(packet.preflight.externalMutationPerformed, false);
  assert.deepEqual(packet.capabilitySurface.allowedActions, ["READ_RECORD", "READ_METADATA"]);
  assert.deepEqual(packet.capabilitySurface.governedMutationActions, []);
  assert.equal(packet.capabilitySurface.genericInvocationAllowed, false);
});

test("all declared fail-closed cases deny with stable public reason codes", () => {
  assert.equal(deniedFixture.fixtureKind, "DENIED");
  assert.equal(deniedFixture.cases.length, negativeCases.length);
  for (const [caseId, expectedReasonCode] of negativeCases) {
    const candidate = applyNegativeCase(packet, caseId);
    const first = validatePacket(candidate);
    const second = validatePacket(structuredClone(candidate));
    assert.equal(first.accepted, false, caseId);
    assert.equal(first.status, "DENIED", caseId);
    assert.equal(first.reasonCode, expectedReasonCode, caseId);
    assert.deepEqual(first, second, caseId);
    assert.deepEqual(Object.keys(first.projection).sort(), ["reasonCode", "status"].sort(), caseId);
  }
});

test("credential, private path, unknown capability, and missing authorization deny without leakage", () => {
  const credential = structuredClone(packet);
  credential.credential = "REDACTED";
  assert.equal(validatePacket(credential).reasonCode, "PRIVATE_IDENTIFIER_DENIED");

  const privatePath = structuredClone(packet);
  privatePath.evidence.refs[0].ref = "/tmp/private-evidence.json";
  assert.equal(validatePacket(privatePath).reasonCode, "PRIVATE_IDENTIFIER_DENIED");

  const unknownAction = structuredClone(packet);
  unknownAction.capabilitySurface.allowedActions = ["NEW_CAPABILITY"];
  assert.equal(validatePacket(unknownAction).reasonCode, "UNKNOWN_ACTION_DENIED");

  const missing = structuredClone(packet);
  delete missing.authorization;
  assert.equal(validatePacket(missing).reasonCode, "MISSING_AUTHORIZATION_DENIED");

  for (const candidate of [credential, privatePath, unknownAction, missing]) {
    assert.equal(JSON.stringify(validatePacket(candidate)).includes("REDACTED"), false);
    assert.equal(JSON.stringify(validatePacket(candidate)).includes("/tmp"), false);
  }
});

test("unknown packet fields are rejected by both schema and validator", () => {
  const unknown = { ...structuredClone(packet), unlisted: true };
  assert.equal(validateSchema(unknown), false);
  assert.equal(validatePacket(unknown).reasonCode, "UNKNOWN_FIELD_DENIED");
});
