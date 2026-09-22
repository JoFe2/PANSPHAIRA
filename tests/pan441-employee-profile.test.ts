import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import Ajv2020 from "ajv/dist/2020.js";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  PAN441_ALLOWED_FIELDS_V1,
  PAN441_CRITICAL_IDENTITY_FIELDS_V1,
  PAN441_DENIED_OPERATIONS_V1,
  PAN441_READ_CAPABILITY_ID_V1,
  PAN441_READ_ACTION_V1,
  PAN441_READ_CAPABILITY_VERSION_V1,
  PAN441_TENANT_V1,
  authorizePan441EmployeeReadV1,
  canonicalJson,
  computeSkillPackageDigestV1,
  pan441NarrowProfileReplacementV1,
  syntheticCapabilityCatalogueV1,
  pan441EmployeeProfileV1,
  pan441SkillRequestV1,
  verifyPan441ProfileV1,
} from "../packages/contracts/src/index.js";
import type { IntegrationProfileV1 } from "../packages/contracts/src/index.js";


function sha256(value: unknown): string {
  return createHash("sha256").update(canonicalJson(value), "utf8").digest("hex");
}

const profile = pan441EmployeeProfileV1();
const integration = (JSON.parse(
  readFileSync("tests/fixtures/integration-profile/positive-variants-v1.json", "utf8"),
) as IntegrationProfileV1[])[0]!;

function identity(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    userId: "user:alice-example",
    tenant: PAN441_TENANT_V1,
    profileId: profile.profileId,
    profileGeneration: 1,
    authenticated: true,
    permissions: [PAN441_READ_CAPABILITY_ID_V1],
    ...overrides,
  };
}
function request(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    operation: PAN441_READ_ACTION_V1,
    targetUserId: "user:alice-example",
    fields: ["displayName", "department", "jobTitle"],
    capabilityId: PAN441_READ_CAPABILITY_ID_V1,
    capabilityVersion: PAN441_READ_CAPABILITY_VERSION_V1,
    ...overrides,
  };
}
function decide(
  identityOverrides: Record<string, unknown> = {},
  requestOverrides: Record<string, unknown> = {},
  profileValue: unknown = profile,
  skillValue: unknown = pan441SkillRequestV1(),
) {
  return authorizePan441EmployeeReadV1(
    profileValue,
    integration,
    identity(identityOverrides),
    request(requestOverrides),
    skillValue,
  );
}

test("PAN441 public schema accepts the released profile and rejects extra authority fields", () => {
  const ajv = new Ajv2020({ strict: false });
  const schema = JSON.parse(readFileSync("schemas/contracts/pan441-employee-profile-v1.schema.json", "utf8"));
  const validate = ajv.compile(schema);
  assert.equal(validate(profile), true);
  const widened = { ...profile, writes: ["employee.directory.update"] };
  assert.equal(validate(widened), false);
});

test("PAN441 profile is fixed, digest-bound and explicitly read-only", () => {
  const verified = verifyPan441ProfileV1(profile);
  assert.equal(verified.profileId, "profile:pan441-employee-assistant-read-only");
  assert.equal(verified.authorityProfile, "SAFE_GUIDED");
  assert.deepEqual(verified.allowedFields, [...PAN441_ALLOWED_FIELDS_V1]);
  assert.deepEqual(verified.deniedOperations, [...PAN441_DENIED_OPERATIONS_V1]);
  assert.deepEqual(verified.deniedCriticalIdentityFields, [...PAN441_CRITICAL_IDENTITY_FIELDS_V1]);
  assert.equal(verified.catalogue.activationDefault, "INACTIVE");
  assert.equal(verified.lifecycle.storage, "NO_RUNTIME_STORAGE");
});

test("PAN441 freezes policy arrays and binds the actual skill and catalogue identities", () => {
  assert.equal(Object.isFrozen(PAN441_ALLOWED_FIELDS_V1), true);
  assert.equal(Object.isFrozen(PAN441_CRITICAL_IDENTITY_FIELDS_V1), true);
  assert.equal(Object.isFrozen(PAN441_DENIED_OPERATIONS_V1), true);
  assert.throws(() => (PAN441_ALLOWED_FIELDS_V1 as unknown as string[]).push("email"), TypeError);
  assert.throws(() => (PAN441_CRITICAL_IDENTITY_FIELDS_V1 as unknown as string[]).push("email"), TypeError);
  assert.throws(() => (PAN441_DENIED_OPERATIONS_V1 as unknown as string[]).push("employee.directory.read.all"), TypeError);

  const skill = pan441SkillRequestV1();
  assert.equal(skill.manifest.id, profile.skill.skillId);
  assert.equal(skill.manifest.version, profile.skill.version);
  assert.equal(skill.source.version, profile.skill.version);
  assert.equal(skill.source.digest, profile.skill.packageDigest);
  const selected = syntheticCapabilityCatalogueV1().actions.find(({ actionId }) => actionId === PAN441_READ_ACTION_V1);
  assert.ok(selected);
  assert.equal(selected!.version, profile.capability.version);
  assert.equal(selected!.resource, profile.capability.resource);
  assert.equal(selected!.digest, profile.capability.catalogueActionDigest);
});

test("PAN441 canonical npm lifecycle registers the compiled suite once", () => {
  const packageJson = JSON.parse(readFileSync("package.json", "utf8")) as { scripts: { test: string } };
  const suite = "dist/tests/pan441-employee-profile.test.js";
  assert.equal(packageJson.scripts.test.split(/\s+/).filter((entry) => entry === suite).length, 1);
});

test("PAN441 actual authorization path allows only the authenticated user's own read", () => {
  const decision = decide();
  assert.equal(decision.outcome, "ALLOW");
  assert.deepEqual(decision.reasonCodes, ["OWN_SCOPE_READ_ALLOWED"]);
  assert.deepEqual(decision.projectedRecord, {
    displayName: "Alex Example",
    department: "Operations",
    jobTitle: "Coordinator",
  });
  assert.equal(Object.hasOwn(decision.projectedRecord!, "nationalId"), false);
  assert.equal(Object.hasOwn(decision.projectedRecord!, "personalEmail"), false);
  assert.match(decision.builderDecisionDigest!, /^[a-f0-9]{64}$/);
  assert.match(decision.effectiveRightsDigest!, /^[a-f0-9]{64}$/);
  assert.match(decision.skillRequestDigest!, /^[a-f0-9]{64}$/);
});

test("PAN441 denies other-user reads and missing identity or permission", () => {
  const otherUser = decide({}, { targetUserId: "user:bob-example" });
  assert.equal(otherUser.outcome, "DENY");
  assert.deepEqual(otherUser.reasonCodes, ["OWN_SCOPE_DENIED"]);

  const missingIdentity = authorizePan441EmployeeReadV1(
    profile, integration, undefined, request(), pan441SkillRequestV1(),
  );
  assert.equal(missingIdentity.outcome, "DENY");
  assert.deepEqual(missingIdentity.reasonCodes, ["IDENTITY_MISSING_DENIED"]);

  const missingPermission = decide({ permissions: [] });
  assert.equal(missingPermission.outcome, "DENY");
  assert.deepEqual(missingPermission.reasonCodes, ["PERMISSION_MISSING_DENIED"]);
});

test("PAN441 denies unavailable capabilities and every write-shaped operation", () => {
  const unavailable = decide({}, {
    capabilityId: "capability:employee.directory.read.all",
    capabilityVersion: "1.0.0",
  });
  assert.equal(unavailable.outcome, "DENY");
  assert.deepEqual(unavailable.reasonCodes, ["CAPABILITY_UNAVAILABLE_DENIED"]);

  for (const operation of [
    "employee.directory.write",
    "employee.directory.create",
    "employee.directory.update",
    "employee.directory.delete",
  ]) {
    const denied = decide({}, { operation });
    assert.equal(denied.outcome, "DENY", operation);
    assert.deepEqual(denied.reasonCodes, ["WRITE_DENIED"], operation);
  }
});

test("PAN441 denies critical identity fields rather than widening the projection", () => {
  for (const field of PAN441_CRITICAL_IDENTITY_FIELDS_V1) {
    const denied = decide({}, { fields: ["displayName", field] });
    assert.equal(denied.outcome, "DENY", field);
    assert.deepEqual(denied.reasonCodes, ["CRITICAL_IDENTITY_DENIED"], field);
  }
  const empty = decide({}, { fields: [] });
  assert.equal(empty.outcome, "DENY");
  assert.deepEqual(empty.reasonCodes, ["FIELD_SCOPE_DENIED"]);
});

test("PAN441 rejects caller-rehashed profile bytes, identity drift and tampered skill bytes", () => {
  const replaced = structuredClone(profile) as Record<string, any>;
  replaced.allowedFields = [...replaced.allowedFields, "personalEmail"];
  delete replaced.profileDigest;
  replaced.profileDigest = sha256(replaced);
  const profileDenied = decide({}, {}, replaced);
  assert.equal(profileDenied.outcome, "DENY");
  assert.deepEqual(profileDenied.reasonCodes, ["PAN441_PROFILE_NOT_RELEASED_DENIED"]);

  const identityDenied = decide({ profileGeneration: 2 });
  assert.equal(identityDenied.outcome, "DENY");
  assert.deepEqual(identityDenied.reasonCodes, ["IDENTITY_INVALID_DENIED"]);

  const skill = pan441SkillRequestV1() as Record<string, any>;
  skill.files[0].content += " changed";
  skill.files[0].digest = sha256(skill.files[0].content);
  const packageDigest = computeSkillPackageDigestV1({ manifest: skill.manifest, files: skill.files });
  skill.source.digest = packageDigest;
  skill.source.locator = `skill+sha256:${packageDigest}`;
  const skillDenied = decide({}, {}, profile, skill);
  assert.equal(skillDenied.outcome, "DENY");
  assert.deepEqual(skillDenied.reasonCodes, ["SKILL_ADMISSION_DENIED"]);
});

test("PAN441 accepts only the pinned narrower replacement and denies widening", () => {
  const narrow = pan441NarrowProfileReplacementV1();
  assert.deepEqual(narrow.allowedFields, ["displayName"]);
  assert.notEqual(narrow.profileDigest, profile.profileDigest);
  assert.equal(verifyPan441ProfileV1(structuredClone(narrow)).profileDigest, narrow.profileDigest);

  const narrowRead = decide({}, { fields: ["displayName"] }, narrow);
  assert.equal(narrowRead.outcome, "ALLOW");
  const narrowDepartment = decide({}, { fields: ["department"] }, narrow);
  assert.equal(narrowDepartment.outcome, "DENY");
  assert.deepEqual(narrowDepartment.reasonCodes, ["FIELD_SCOPE_DENIED"]);

  const widened = structuredClone(narrow) as Record<string, any>;
  widened.allowedFields = ["displayName", "department"];
  delete widened.profileDigest;
  widened.profileDigest = sha256(widened);
  assert.throws(() => verifyPan441ProfileV1(widened), /PAN441_PROFILE_NOT_RELEASED_DENIED/);
  assert.equal(decide({}, { fields: ["department"] }, widened).outcome, "DENY");
});

test("PAN441 integration profile and catalog gates remain bounded", () => {
  const integrationDrift = structuredClone(integration) as Record<string, any>;
  integrationDrift.integration.allowedActions = ["READ_RECORD", "WRITE_RECORD"];
  integrationDrift.profileDigest = "0".repeat(64);
  const denied = authorizePan441EmployeeReadV1(profile, integrationDrift, identity(), request(), pan441SkillRequestV1());
  assert.equal(denied.outcome, "DENY");
  assert.deepEqual(denied.reasonCodes, ["INTEGRATION_PROFILE_DENIED"]);
  assert.equal(profile.catalogue.catalogueId, "chimpmaera.local/synthetic-actions");
  assert.equal(profile.catalogue.version, "1.0.0");
});
