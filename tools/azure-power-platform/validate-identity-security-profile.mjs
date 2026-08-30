#!/usr/bin/env node
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const referenceTime = "2026-08-28T12:00:00Z";
const digestPattern = /^[a-f0-9]{64}$/;
const expectedTopLevelKeys = ["schemaVersion", "profileKind", "profileStatus", "environmentClass", "policy", "principals", "delegation", "capabilityDiscovery", "authorizationWaits", "validity", "limitations", "negativeResults", "rollback", "evidence", "publicEvidence", "nonClaims"];
const expectedPrincipalKeys = ["proposer", "approver", "executor", "verifier", "importer", "publisher", "rollback"];
const expectedEvidenceIds = ["evidence-001", "evidence-002", "evidence-003", "evidence-004", "evidence-005", "evidence-006", "evidence-007"];
const expectedAuthorizationClasses = ["IDENTITY", "CONSENT", "DLP", "EXECUTION"];
const expectedNegativeResults = [
  ["UNKNOWN_FIELDS", "UNKNOWN_FIELD_DENIED"], ["UNKNOWN_ACTIONS", "UNKNOWN_ACTION_DENIED"], ["HIDDEN_WRITES", "HIDDEN_WRITE_DENIED"], ["SELF_APPROVAL", "SELF_APPROVAL_DENIED"], ["COMBINED_APPROVER_EXECUTOR", "DUTY_SEPARATION_DENIED"], ["COMBINED_IMPORTER_PUBLISHER", "DUTY_SEPARATION_DENIED"], ["PROVIDER_CREDENTIAL", "PROVIDER_CREDENTIAL_DENIED"], ["REUSABLE_SECRET_REFERENCE", "REUSABLE_SECRET_REFERENCE_DENIED"], ["BROAD_ROLE", "BROAD_ROLE_DENIED"], ["MISSING_EXPIRY", "EXPIRY_STATE_MISSING_DENIED"], ["MISSING_REVOCATION", "REVOCATION_STATE_MISSING_DENIED"], ["CAPABILITY_BYTES_AUTHORITY", "CAPABILITY_BYTES_AUTHORITY_DENIED"], ["DIGEST_DRIFT", "DIGEST_DRIFT_DENIED"], ["REPLAY", "REPLAY_DENIED"], ["EXPIRY", "EXPIRY_DENIED"], ["REVOCATION", "REVOCATION_DENIED"], ["STALE_POLICY", "STALE_POLICY_DENIED"], ["PUBLIC_EVIDENCE_PRIVATE", "PUBLIC_EVIDENCE_UNSAFE_DENIED"],
];
const exactPins = {
  policyDigest: "1111111111111111111111111111111111111111111111111111111111111111",
  capabilityDigest: "2222222222222222222222222222222222222222222222222222222222222222",
  rollbackDigest: "3333333333333333333333333333333333333333333333333333333333333333",
  bundleDigest: "4444444444444444444444444444444444444444444444444444444444444444",
};

function isObject(value) { return value !== null && typeof value === "object" && !Array.isArray(value); }
function sameJson(left, right) { return JSON.stringify(left) === JSON.stringify(right); }
function exactKeys(value, keys) { return isObject(value) && Object.keys(value).length === keys.length && Object.keys(value).every((key) => keys.includes(key)); }
function validDigest(value) { return typeof value === "string" && digestPattern.test(value); }
function failure(reasonCode) { return { accepted: false, status: "DENIED", reasonCode, reasonCodes: [reasonCode], projection: { status: "DENIED", reasonCode } }; }
function success(profile) {
  const record = profile.publicEvidence.record;
  return { accepted: true, status: "READY", reasonCode: "SYNTHETIC_IDENTITY_PROFILE_READY", reasonCodes: [], projection: { status: "READY", environmentClass: record.environmentClass, policy: structuredClone(record.policy), evidenceRefs: [...record.evidenceRefs], negativeReasonCodes: [...record.negativeReasonCodes], redacted: true } };
}

function hasSensitiveField(value, names) {
  if (Array.isArray(value)) return value.some((item) => hasSensitiveField(item, names));
  if (!isObject(value)) return false;
  return Object.entries(value).some(([key, item]) => names.has(key.replace(/[^a-z0-9]/gi, "").toLowerCase()) || hasSensitiveField(item, names));
}
function publicEvidenceIsUnsafe(publicEvidence) {
  if (!isObject(publicEvidence)) return false;
  const prohibitedKeys = new Set(["tenant", "tenantid", "subscription", "subscriptionid", "environmentid", "identity", "personalidentity", "privatepath", "host", "internalhost", "credential", "providercredential", "secret", "secretreference", "accesstoken", "password"]);
  const unsafeValue = /(?:bearer\s+|secret:\/\/|(?:tenant|subscription|environment)[-_:/]?id\b|[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}|(?:^|\/)\.?\.?\/(?:tmp|home|private)\/|https?:\/\/|\\\\)/i;
  const visit = (value, key = "") => {
    const normalized = key.replace(/[^a-z0-9]/gi, "").toLowerCase();
    if (prohibitedKeys.has(normalized)) return true;
    if (typeof value === "string" && unsafeValue.test(value)) return true;
    if (Array.isArray(value)) return value.some((item) => visit(item));
    if (isObject(value)) return Object.entries(value).some(([childKey, child]) => visit(child, childKey));
    return false;
  };
  return visit(publicEvidence);
}

function validateShape(profile) {
  if (!exactKeys(profile, expectedTopLevelKeys)) return false;
  if (!exactKeys(profile.policy, ["id", "version", "generation", "digest"])) return false;
  if (!exactKeys(profile.principals, expectedPrincipalKeys)) return false;
  if (!exactKeys(profile.delegation, ["model", "role", "scope", "providerCredentialsAllowed", "reusableSecretReferencesAllowed"])) return false;
  if (!exactKeys(profile.capabilityDiscovery, ["operations", "actions", "unknownActionsDenied", "hiddenWritesAllowed", "genericInvocationAllowed", "writeActions", "capabilityDigest", "capabilityBytesAsAuthority"])) return false;
  if (!Array.isArray(profile.authorizationWaits) || profile.authorizationWaits.length !== 4 || profile.authorizationWaits.some((item) => !exactKeys(item, ["authorizationClass", "sourceState", "disposition", "ownerWaitRef", "laterThan"]))) return false;
  if (!exactKeys(profile.validity, ["referenceTime", "issuedAt", "expiresAt", "revocationState", "replayState"])) return false;
  if (!exactKeys(profile.rollback, ["target", "targetVersion", "targetDigest", "disposition", "evidenceRefs"])) return false;
  if (!exactKeys(profile.evidence, ["bundleDigest", "refs"]) || !Array.isArray(profile.evidence.refs) || profile.evidence.refs.length !== 7 || profile.evidence.refs.some((item) => !exactKeys(item, ["id", "digest", "validUntil"]))) return false;
  if (!exactKeys(profile.publicEvidence, ["redactionAllowlist", "record"]) || !exactKeys(profile.publicEvidence.record, ["environmentClass", "policy", "evidenceRefs", "negativeReasonCodes", "redacted"]) || !exactKeys(profile.publicEvidence.record.policy, ["generation", "digest"])) return false;
  return true;
}

function validateValues(profile) {
  if (profile.schemaVersion !== "pansphaira.azure-power-platform/identity-security-profile/v1" || profile.profileKind !== "SYNTHETIC_DELEGATED_LEAST_PRIVILEGE" || profile.profileStatus !== "SYNTHETIC_CANDIDATE" || profile.environmentClass !== "LOCAL_SYNTHETIC_REPOSITORY_ONLY") return "SCHEMA_DENIED";
  const { policy, principals, delegation, capabilityDiscovery, validity } = profile;
  if (policy.id !== "synthetic-delegated-identity-policy" || policy.version !== "1.0.0" || policy.digest !== exactPins.policyDigest) return "DIGEST_DRIFT_DENIED";
  if (policy.generation !== 13) return "STALE_POLICY_DENIED";
  const principalValues = Object.values(principals);
  if (principalValues.some((value) => typeof value !== "string" || !/^opaque-principal-[a-z]+-[0-9]{3}$/.test(value))) return "SCHEMA_DENIED";
  if (principals.proposer === principals.approver) return "SELF_APPROVAL_DENIED";
  if (principals.approver === principals.executor || principals.importer === principals.publisher || new Set(principalValues).size !== principalValues.length) return "DUTY_SEPARATION_DENIED";
  if (delegation.providerCredentialsAllowed === true) return "PROVIDER_CREDENTIAL_DENIED";
  if (delegation.reusableSecretReferencesAllowed === true) return "REUSABLE_SECRET_REFERENCE_DENIED";
  if (delegation.role !== "CAPABILITY_DISCOVERY_READER") return "BROAD_ROLE_DENIED";
  if (delegation.model !== "DELEGATED_LEAST_PRIVILEGE" || !sameJson(delegation.scope, ["READ_ONLY_CAPABILITY_DISCOVERY"])) return "SCHEMA_DENIED";
  if (capabilityDiscovery.capabilityBytesAsAuthority === true) return "CAPABILITY_BYTES_AUTHORITY_DENIED";
  if (capabilityDiscovery.hiddenWritesAllowed === true || capabilityDiscovery.genericInvocationAllowed === true || capabilityDiscovery.writeActions?.length) return "HIDDEN_WRITE_DENIED";
  if (!sameJson(capabilityDiscovery.operations, ["DISCOVER_READONLY_CAPABILITIES"]) || !sameJson(capabilityDiscovery.actions, ["READ_CAPABILITY_METADATA"]) || capabilityDiscovery.unknownActionsDenied !== true) return "UNKNOWN_ACTION_DENIED";
  if (capabilityDiscovery.capabilityDigest !== exactPins.capabilityDigest) return "DIGEST_DRIFT_DENIED";
  if (validity.referenceTime !== referenceTime || validity.issuedAt !== "2026-08-28T08:00:00Z") return "SCHEMA_DENIED";
  if (validity.replayState === "CONSUMED") return "REPLAY_DENIED";
  if (validity.revocationState === "REVOKED") return "REVOCATION_DENIED";
  if (validity.expiresAt <= referenceTime) return "EXPIRY_DENIED";
  if (validity.expiresAt !== "2026-08-29T08:00:00Z" || validity.revocationState !== "ACTIVE" || validity.replayState !== "UNCONSUMED") return "SCHEMA_DENIED";
  if (!profile.authorizationWaits.every((wait, index) => wait.authorizationClass === expectedAuthorizationClasses[index] && wait.sourceState === "UNAVAILABLE_OFFLINE" && wait.disposition === "OWNER_ONLY_WAIT" && wait.ownerWaitRef === expectedEvidenceIds[index] && wait.laterThan === referenceTime)) return "SCHEMA_DENIED";
  if (!Array.isArray(profile.limitations) || !sameJson(profile.limitations, ["NO_TENANT_DISCOVERY", "NO_PROVIDER_CREDENTIALS", "NO_REUSABLE_SECRETS", "NO_EXTERNAL_MUTATION", "NO_CAPABILITY_BYTES_AUTHORITY", "NO_PUBLIC_IDENTIFIERS", "OWNER_ONLY_AUTHORIZATION_WAIT", "SYNTHETIC_EVIDENCE_ONLY"])) return "SCHEMA_DENIED";
  if (!Array.isArray(profile.negativeResults) || profile.negativeResults.length !== expectedNegativeResults.length || !profile.negativeResults.every((item, index) => exactKeys(item, ["case", "reasonCode", "effectCount", "evidenceRef"]) && item.case === expectedNegativeResults[index][0] && item.reasonCode === expectedNegativeResults[index][1] && item.effectCount === 0 && item.evidenceRef === (index === 17 ? "evidence-006" : "evidence-005"))) return "SCHEMA_DENIED";
  if (profile.rollback.target !== "EXACT_LKG_IDENTITY_SECURITY_PROFILE" || profile.rollback.targetVersion !== "1.0.0" || profile.rollback.targetDigest !== exactPins.rollbackDigest || profile.rollback.disposition !== "OWNER_ONLY_WAIT" || !sameJson(profile.rollback.evidenceRefs, ["evidence-007"])) return "DIGEST_DRIFT_DENIED";
  if (profile.evidence.bundleDigest !== exactPins.bundleDigest || !profile.evidence.refs.every((item, index) => item.id === expectedEvidenceIds[index] && validDigest(item.digest) && item.validUntil === "2026-08-29T00:00:00Z")) return "DIGEST_DRIFT_DENIED";
  const publicRecord = profile.publicEvidence.record;
  if (!sameJson(profile.publicEvidence.redactionAllowlist, ["environmentClass", "policy.generation", "policy.digest", "evidence.refs", "negativeResults"]) || publicRecord.environmentClass !== profile.environmentClass || publicRecord.policy.generation !== policy.generation || publicRecord.policy.digest !== policy.digest || !sameJson(publicRecord.evidenceRefs, expectedEvidenceIds) || !sameJson(publicRecord.negativeReasonCodes, expectedNegativeResults.map(([, reasonCode]) => reasonCode)) || publicRecord.redacted !== true) return "SCHEMA_DENIED";
  if (!sameJson(profile.nonClaims, ["NOT_A_TENANT_AUTHORIZATION", "NOT_A_PROVIDER_CONNECTION", "NOT_A_CONSENT_GRANT", "NOT_A_DLP_DECISION", "NOT_A_PROVISIONING_ACTION"])) return "SCHEMA_DENIED";
  return null;
}

export function validateIdentitySecurityProfile(profile) {
  if (!isObject(profile)) return failure("SCHEMA_DENIED");
  if (publicEvidenceIsUnsafe(profile.publicEvidence)) return failure("PUBLIC_EVIDENCE_UNSAFE_DENIED");
  if (hasSensitiveField(profile, new Set(["providercredential", "credential", "accesstoken", "password"]))) return failure("PROVIDER_CREDENTIAL_DENIED");
  if (hasSensitiveField(profile, new Set(["secretreference", "reusablesecret", "secretref"]))) return failure("REUSABLE_SECRET_REFERENCE_DENIED");
  if (!isObject(profile.validity) || !Object.hasOwn(profile.validity, "expiresAt")) return failure("EXPIRY_STATE_MISSING_DENIED");
  if (!isObject(profile.validity) || !Object.hasOwn(profile.validity, "revocationState")) return failure("REVOCATION_STATE_MISSING_DENIED");
  if (!exactKeys(profile, expectedTopLevelKeys)) return failure("UNKNOWN_FIELD_DENIED");
  if (!validateShape(profile)) return failure("UNKNOWN_FIELD_DENIED");
  const reasonCode = validateValues(profile);
  return reasonCode ? failure(reasonCode) : success(profile);
}

export function applyNegativeCase(profile, caseId) {
  const candidate = structuredClone(profile);
  switch (caseId) {
    case "unknown-field": candidate.unlisted = true; break;
    case "unknown-action": candidate.capabilityDiscovery.actions = ["WRITE_CAPABILITY_METADATA"]; break;
    case "hidden-write": candidate.capabilityDiscovery.writeActions = ["CREATE_RECORD"]; break;
    case "self-approval": candidate.principals.approver = candidate.principals.proposer; break;
    case "combined-approver-executor": candidate.principals.executor = candidate.principals.approver; break;
    case "combined-importer-publisher": candidate.principals.publisher = candidate.principals.importer; break;
    case "provider-credential": candidate.providerCredential = "synthetic-provider-credential"; break;
    case "reusable-secret-reference": candidate.secretReference = "synthetic-secret-reference"; break;
    case "broad-role": candidate.delegation.role = "GLOBAL_ADMINISTRATOR"; break;
    case "missing-expiry": delete candidate.validity.expiresAt; break;
    case "missing-revocation": delete candidate.validity.revocationState; break;
    case "capability-bytes-authority": candidate.capabilityDiscovery.capabilityBytesAsAuthority = true; break;
    case "digest-drift": candidate.policy.digest = "ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff"; break;
    case "replay": candidate.validity.replayState = "CONSUMED"; break;
    case "expiry": candidate.validity.expiresAt = "2026-08-28T11:59:59Z"; break;
    case "revocation": candidate.validity.revocationState = "REVOKED"; break;
    case "stale-policy": candidate.policy.generation = 12; break;
    default: throw new Error(`unknown negative case: ${caseId}`);
  }
  return candidate;
}

export async function loadFixture(fixturePath, base = root) { return JSON.parse(await readFile(path.resolve(base, fixturePath), "utf8")); }

async function main() {
  const args = process.argv.slice(2);
  const inputIndex = args.indexOf("--input");
  const fixturePath = inputIndex >= 0 ? args[inputIndex + 1] : undefined;
  if (!fixturePath || inputIndex < 0 || args.length !== 2) { console.error("usage: node tools/azure-power-platform/validate-identity-security-profile.mjs --input <path>"); process.exitCode = 2; return; }
  try {
    const fixture = await loadFixture(fixturePath);
    let result;
    if (fixture?.schemaVersion === "pansphaira.azure-power-platform/identity-security-profile/v1") result = validateIdentitySecurityProfile(fixture);
    else if (fixture?.schemaVersion === "pansphaira.azure-power-platform/identity-security-profile-escalating-fixture/v1" && fixture.fixtureKind === "DENIED" && Array.isArray(fixture.cases)) {
      const base = await loadFixture(fixture.baseFixture);
      const results = fixture.cases.map(({ caseId, expectedReasonCode }) => {
        const candidate = validateIdentitySecurityProfile(applyNegativeCase(base, caseId));
        if (candidate.accepted || candidate.reasonCode !== expectedReasonCode) throw new Error(`denial mismatch: ${caseId}`);
        return candidate;
      });
      result = results.at(-1) ?? failure("SCHEMA_DENIED");
    } else result = failure("SCHEMA_DENIED");
    console.log(JSON.stringify(result.projection));
    process.exitCode = result.accepted ? 0 : 1;
  } catch { console.log(JSON.stringify({ status: "DENIED", reasonCode: "SCHEMA_DENIED" })); process.exitCode = 1; }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await main();
