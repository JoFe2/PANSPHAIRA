import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import Ajv2020 from "ajv/dist/2020.js";
import { applyNegativeCase, loadFixture, validateIdentitySecurityProfile } from "../../tools/azure-power-platform/validate-identity-security-profile.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const validPath = "tests/fixtures/azure-power-platform/identity-profile-valid.json";
const escalatingPath = "tests/fixtures/azure-power-platform/identity-profile-escalating.json";
const schema = JSON.parse(await readFile(path.join(root, "docs/development/azure-power-platform/identity-security-profile.schema.json"), "utf8"));
const validateSchema = new Ajv2020({ allErrors: true, strict: true }).compile(schema);
const validProfile = await loadFixture(validPath, root);
const escalatingFixture = await loadFixture(escalatingPath, root);

function assertPublicProjection(result) {
  assert.deepEqual(Object.keys(result.projection).sort(), ["environmentClass", "evidenceRefs", "negativeReasonCodes", "policy", "redacted", "status"].sort());
  assert.equal(JSON.stringify(result.projection).includes("opaque-principal"), false);
  assert.equal(JSON.stringify(result.projection).includes("LOCAL_SYNTHETIC_REPOSITORY_ONLY"), true);
}

test("accepts the synthetic profile with opaque separate principals and public-safe evidence", () => {
  assert.equal(validateSchema(validProfile), true, JSON.stringify(validateSchema.errors));
  const result = validateIdentitySecurityProfile(validProfile);
  assert.equal(result.accepted, true, JSON.stringify(result));
  assert.equal(result.reasonCode, "SYNTHETIC_IDENTITY_PROFILE_READY");
  assertPublicProjection(result);
  assert.equal(new Set(Object.values(validProfile.principals)).size, 7);
  assert.equal(validProfile.delegation.model, "DELEGATED_LEAST_PRIVILEGE");
  assert.deepEqual(validProfile.delegation.scope, ["READ_ONLY_CAPABILITY_DISCOVERY"]);
  assert.deepEqual(validProfile.capabilityDiscovery.actions, ["READ_CAPABILITY_METADATA"]);
  assert.deepEqual(validProfile.publicEvidence.redactionAllowlist, ["environmentClass", "policy.generation", "policy.digest", "evidence.refs", "negativeResults"]);
  assert.deepEqual(validProfile.authorizationWaits.map((wait) => [wait.authorizationClass, wait.disposition, wait.laterThan]), [
    ["IDENTITY", "OWNER_ONLY_WAIT", "2026-08-28T12:00:00Z"],
    ["CONSENT", "OWNER_ONLY_WAIT", "2026-08-28T12:00:00Z"],
    ["DLP", "OWNER_ONLY_WAIT", "2026-08-28T12:00:00Z"],
    ["EXECUTION", "OWNER_ONLY_WAIT", "2026-08-28T12:00:00Z"],
  ]);
  assert.equal(JSON.stringify(validProfile.evidence).includes("/"), false);
  assert.equal(JSON.stringify(validProfile.evidence).includes("@"), false);
});

test("the escalating fixture is deterministic and fail-closed for every declared escalation", () => {
  assert.equal(escalatingFixture.fixtureKind, "DENIED");
  for (const { caseId, expectedReasonCode } of escalatingFixture.cases) {
    const candidate = applyNegativeCase(validProfile, caseId);
    const first = validateIdentitySecurityProfile(candidate);
    const second = validateIdentitySecurityProfile(structuredClone(candidate));
    assert.equal(first.accepted, false, caseId);
    assert.equal(first.reasonCode, expectedReasonCode, caseId);
    assert.deepEqual(first, second, caseId);
    assert.deepEqual(first.projection, { status: "DENIED", reasonCode: expectedReasonCode }, caseId);
  }
});

test("rejects unsafe public evidence without reflecting tenant, identity, path, host, credential, or secret material", () => {
  const publicEvidenceLeaks = [
    ["tenantId", "tenant-synthetic-001"],
    ["subscriptionId", "subscription-synthetic-001"],
    ["environmentId", "environment-synthetic-001"],
    ["personalIdentity", "person@example.test"],
    ["privatePath", "/tmp/private-evidence.json"],
    ["internalHost", "https://internal.example.test"],
    ["credential", "Bearer synthetic-value"],
    ["secretReference", "secret://synthetic-value"],
  ];
  for (const [field, value] of publicEvidenceLeaks) {
    const candidate = structuredClone(validProfile);
    candidate.publicEvidence.record[field] = value;
    const result = validateIdentitySecurityProfile(candidate);
    assert.equal(result.accepted, false, field);
    assert.equal(result.reasonCode, "PUBLIC_EVIDENCE_UNSAFE_DENIED", field);
    assert.equal(JSON.stringify(result).includes(value), false, field);
  }
});

test("rejects provider credentials, reusable secret references, and unknown fields even when added outside public evidence", () => {
  const candidates = [
    ["providerCredential", "PROVIDER_CREDENTIAL_DENIED"],
    ["secretReference", "REUSABLE_SECRET_REFERENCE_DENIED"],
    ["unrecognized", "UNKNOWN_FIELD_DENIED"],
  ];
  for (const [field, expectedReasonCode] of candidates) {
    const candidate = structuredClone(validProfile);
    candidate[field] = "synthetic-value";
    assert.equal(validateIdentitySecurityProfile(candidate).reasonCode, expectedReasonCode, field);
  }
});

test("schema and runtime both reject unknown fields and runtime never claims tenant access", () => {
  const unknown = { ...structuredClone(validProfile), unlisted: true };
  assert.equal(validateSchema(unknown), false);
  const result = validateIdentitySecurityProfile(unknown);
  assert.equal(result.reasonCode, "UNKNOWN_FIELD_DENIED");
  const nestedUnknown = structuredClone(validProfile);
  nestedUnknown.principals.unlisted = "opaque-principal-extra-008";
  assert.equal(validateIdentitySecurityProfile(nestedUnknown).reasonCode, "UNKNOWN_FIELD_DENIED");
  assert.equal(validProfile.nonClaims.includes("NOT_A_TENANT_AUTHORIZATION"), true);
  assert.equal(validProfile.nonClaims.includes("NOT_A_PROVISIONING_ACTION"), true);
});
