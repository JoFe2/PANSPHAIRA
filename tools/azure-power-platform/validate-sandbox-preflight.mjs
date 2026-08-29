#!/usr/bin/env node
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const packetSchemaVersion = "pansphaira.azure-power-platform/sandbox-preflight-packet/v1";
const fixtureSchemaVersion = "pansphaira.azure-power-platform/sandbox-preflight-fixture/v1";
const environmentClass = "SINGLE_TENANT_DISPOSABLE_SANDBOX";
const evidenceClass = "LOCAL_SYNTHETIC_REPOSITORY_ONLY";
const digestPattern = /^[a-f0-9]{64}$/;
const immutableVersion = /^\d+\.\d+\.\d+$/;
const referenceTime = "2026-08-28T12:00:00Z";
const evidenceExpiry = "2026-08-29T00:00:00Z";
const operations = ["LIST_CAPABILITIES", "SUBMIT_GOVERNED_QUERY", "GET_OPERATION_STATUS", "GET_READBACK", "GET_RECEIPT"];
const actions = ["READ_RECORD", "READ_METADATA"];
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
const expectedNegativeResults = [
  ["UNKNOWN_FIELDS", "UNKNOWN_FIELD_DENIED"],
  ["UNKNOWN_ACTIONS", "UNKNOWN_ACTION_DENIED"],
  ["HIDDEN_WRITES", "HIDDEN_WRITE_DENIED"],
  ["SELF_APPROVAL", "APPROVAL_SAME_ACTOR_DENIED"],
  ["DIGEST_DRIFT", "DIGEST_DRIFT_DENIED"],
  ["REPLAY", "REPLAY_CONSUMED_DENIED"],
  ["EXPIRY", "AUTHORITY_EXPIRED_DENIED"],
  ["REVOCATION", "AUTHORITY_REVOKED_DENIED"],
  ["STALE_POLICY", "POLICY_STALE_DENIED"],
  ["MISSING_AUTHORIZATION", "MISSING_AUTHORIZATION_DENIED"],
  ["WRONG_ENVIRONMENT_CLASS", "WRONG_ENVIRONMENT_CLASS_DENIED"],
  ["PRIVATE_IDENTIFIER", "PRIVATE_IDENTIFIER_DENIED"],
  ["EXPIRED_EVIDENCE", "EVIDENCE_EXPIRED_DENIED"],
];
const exactPins = {
  componentId: "synthetic-power-platform-read-capability",
  schemaId: "synthetic-sandbox-preflight-schema",
  policyId: "synthetic-sandbox-preflight-policy",
  componentDigest: "1111111111111111111111111111111111111111111111111111111111111111",
  schemaDigest: "2222222222222222222222222222222222222222222222222222222222222222",
  policyDigest: "3333333333333333333333333333333333333333333333333333333333333333",
  grantDigest: "4444444444444444444444444444444444444444444444444444444444444444",
  bundleDigest: "5555555555555555555555555555555555555555555555555555555555555555",
  lkgDigest: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
};
const expectedKeys = {
  packet: ["schemaVersion", "packetKind", "packetStatus", "environmentClass", "evidenceClass", "authorization", "capabilitySurface", "tuple", "preflight", "limitations", "negativeResults", "rollback", "evidence", "publicSafeProjection", "nonClaims"],
  authorization: ["grantId", "grantVersion", "grantDigest", "decision", "scope", "delegation", "requesterRole", "ownerRole", "requiredOwnerAttestations", "ownerAttestationRefs", "requesterMayAttest", "independentOwnerAttestationRequired", "notAnApproval", "source", "issuedAt", "expiresAt", "grantState"],
  capabilitySurface: ["allowedOperations", "allowedActions", "governedMutationActions", "unknownActionsDenied", "hiddenWritesAllowed", "genericInvocationAllowed", "writeTargets"],
  tuple: ["component", "schema", "policy", "tupleDigest"],
  artifact: ["id", "version", "digest"],
  policy: ["id", "version", "generation", "digest"],
  preflight: ["referenceTime", "authenticationPerformed", "cloudDiscoveryPerformed", "externalMutationPerformed", "consumptionState", "checks"],
  check: ["id", "outcome", "evidenceRef"],
  negative: ["case", "outcome", "reasonCode", "effectCount", "evidenceRef"],
  rollback: ["target", "targetTupleDigest", "targetVersion", "lkgReference", "authorizationRequired", "partialRollbackAllowed", "latestVersionFallbackAllowed", "evidenceRefs"],
  evidence: ["bundleDigest", "refs"],
  evidenceRef: ["id", "ref", "digest", "validUntil"],
  projection: ["status", "reasonCode", "environmentClass", "authorizationClaim", "authenticationPerformed", "cloudDiscoveryPerformed", "externalMutationPerformed", "identifiersRedacted"],
};

function isObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}
function exactKeys(value, keys) {
  return isObject(value) && Object.keys(value).length === keys.length && Object.keys(value).every((key) => keys.includes(key));
}
function canonicalize(value) {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (isObject(value)) return Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonicalize(value[key])]));
  return value;
}
function digestJson(value) {
  return createHash("sha256").update(JSON.stringify(canonicalize(value))).digest("hex");
}
function failure(reasonCode) {
  return {
    accepted: false,
    status: "DENIED",
    reasonCode,
    reasonCodes: [reasonCode],
    projection: { status: "DENIED", reasonCode },
  };
}
function success() {
  return {
    accepted: true,
    status: "READY",
    reasonCode: "SYNTHETIC_PREFLIGHT_READY",
    reasonCodes: [],
    projection: {
      status: "READY",
      reasonCode: "SYNTHETIC_PREFLIGHT_READY",
      environmentClass,
      authorizationClaim: "NOT_AN_APPROVAL",
      authenticationPerformed: false,
      cloudDiscoveryPerformed: false,
      externalMutationPerformed: false,
      identifiersRedacted: true,
    },
  };
}

function containsPrivateMaterial(value) {
  const privateValue = /(?:bearer\s+|access[_-]?token|(?:secret|password|credential)(?:[-_:]|\s)|(?:tenant|subscription|identity|environment)(?:id|[-:])|\/tmp\/|\/home\/|[A-Za-z]:[\\/]|\\\\|https?:\/\/)/i;
  const visit = (item, key = "") => {
    const normalizedKey = key.replace(/[^a-z0-9]/gi, "").toLowerCase();
    const privateKey = ["tenant", "subscription", "credential", "secret", "password", "accesstoken", "identity", "environmentid", "privatepath", "endpoint", "host"].includes(normalizedKey)
      || ["tenant", "subscription", "credential", "secret", "password", "identity", "privatepath", "endpoint", "host"].some((prefix) => normalizedKey.startsWith(prefix));
    if (privateKey || (typeof item === "string" && privateValue.test(item))) return true;
    if (Array.isArray(item)) return item.some((child) => visit(child));
    if (isObject(item)) return Object.entries(item).some(([childKey, child]) => visit(child, childKey));
    return false;
  };
  return visit(value);
}
function validDigest(value) { return typeof value === "string" && digestPattern.test(value); }
function validVersion(value) { return typeof value === "string" && immutableVersion.test(value); }
function sameJson(left, right) { return JSON.stringify(left) === JSON.stringify(right); }

function validatePacketShape(packet) {
  if (!exactKeys(packet, expectedKeys.packet)) return false;
  if (!exactKeys(packet.authorization, expectedKeys.authorization)) return false;
  if (!exactKeys(packet.capabilitySurface, expectedKeys.capabilitySurface)) return false;
  if (!exactKeys(packet.tuple, expectedKeys.tuple) || !exactKeys(packet.tuple.component, expectedKeys.artifact) || !exactKeys(packet.tuple.schema, expectedKeys.artifact) || !exactKeys(packet.tuple.policy, expectedKeys.policy)) return false;
  if (!exactKeys(packet.preflight, expectedKeys.preflight) || !Array.isArray(packet.preflight.checks) || packet.preflight.checks.length !== 8 || packet.preflight.checks.some((check) => !exactKeys(check, expectedKeys.check))) return false;
  if (!exactKeys(packet.rollback, expectedKeys.rollback) || !exactKeys(packet.evidence, expectedKeys.evidence) || !Array.isArray(packet.evidence.refs) || packet.evidence.refs.length !== 8 || packet.evidence.refs.some((ref) => !exactKeys(ref, expectedKeys.evidenceRef))) return false;
  if (!exactKeys(packet.publicSafeProjection, expectedKeys.projection)) return false;
  return true;
}
function validateNegativeResults(results) {
  if (!Array.isArray(results) || results.length !== expectedNegativeResults.length) return false;
  return expectedNegativeResults.every(([caseName, reasonCode], index) => {
    const item = results[index];
    return exactKeys(item, expectedKeys.negative) && item.case === caseName && item.outcome === "DENY" && item.reasonCode === reasonCode && item.effectCount === 0 && item.evidenceRef === "negative-matrix";
  });
}
function validateChecks(checks) {
  const expected = [
    ["AUTHORIZATION_PRESENT", "owner-attestation"],
    ["DELEGATED_LEAST_PRIVILEGE", "owner-attestation"],
    ["OWNER_ATTESTATIONS_REQUIRED", "policy-attestation"],
    ["ENVIRONMENT_CLASS_EXPLICIT", "focused-tests"],
    ["CAPABILITY_SURFACE_CLOSED", "focused-tests"],
    ["EXACT_TUPLE_PINNED", "focused-tests"],
    ["EVIDENCE_CURRENT", "focused-tests"],
    ["ROLLBACK_LKG_BOUND", "lkg-reference"],
  ];
  return expected.every(([id, evidenceRef], index) => checks[index]?.id === id && checks[index]?.outcome === "PASS" && checks[index]?.evidenceRef === evidenceRef);
}
function validatePacketValues(packet) {
  if (packet.schemaVersion !== packetSchemaVersion || packet.packetKind !== "SYNTHETIC_SINGLE_TENANT_SANDBOX_PREFLIGHT" || packet.packetStatus !== "SYNTHETIC_CANDIDATE" || packet.environmentClass !== environmentClass || packet.evidenceClass !== evidenceClass) return "WRONG_ENVIRONMENT_CLASS_DENIED";
  const auth = packet.authorization;
  if (auth.grantId !== "synthetic-sandbox-grant-001" || auth.grantVersion !== "1.0.0" || auth.grantDigest !== exactPins.grantDigest || auth.decision !== "SIMULATED_ALLOW" || !sameJson(auth.scope, [environmentClass]) || auth.delegation !== "DELEGATED_LEAST_PRIVILEGE" || auth.requesterRole !== "SANDBOX_OPERATOR" || auth.ownerRole !== "RESOURCE_OWNER" || !sameJson(auth.requiredOwnerAttestations, ["RESOURCE_OWNER", "POLICY_OWNER"]) || !sameJson(auth.ownerAttestationRefs, ["owner-attestation", "policy-attestation"]) || auth.requesterMayAttest !== false || auth.independentOwnerAttestationRequired !== true || auth.notAnApproval !== true || auth.source !== "SYNTHETIC_FIXTURE_ONLY" || auth.issuedAt !== "2026-08-28T08:00:00Z" || auth.grantState !== "ACTIVE") return auth.requesterRole === auth.ownerRole ? "APPROVAL_SAME_ACTOR_DENIED" : "AUTHORITY_BINDING_DENIED";
  if (auth.expiresAt <= referenceTime) return "AUTHORITY_EXPIRED_DENIED";
  if (packet.capabilitySurface.hiddenWritesAllowed !== false || packet.capabilitySurface.genericInvocationAllowed !== false || packet.capabilitySurface.governedMutationActions.length !== 0 || packet.capabilitySurface.writeTargets.length !== 0) return "HIDDEN_WRITE_DENIED";
  if (!sameJson(packet.capabilitySurface.allowedOperations, operations) || !sameJson(packet.capabilitySurface.allowedActions, actions) || packet.capabilitySurface.unknownActionsDenied !== true) return "UNKNOWN_ACTION_DENIED";
  if (packet.preflight.authenticationPerformed !== false || packet.preflight.cloudDiscoveryPerformed !== false || packet.preflight.externalMutationPerformed !== false) return "AUTHORITY_BINDING_DENIED";
  if (packet.preflight.consumptionState !== "UNCONSUMED") return "REPLAY_CONSUMED_DENIED";
  if (packet.tuple.policy.generation !== 7) return "POLICY_STALE_DENIED";
  if (packet.tuple.component.id !== exactPins.componentId || packet.tuple.component.version !== "1.0.0" || packet.tuple.component.digest !== exactPins.componentDigest || packet.tuple.schema.id !== exactPins.schemaId || packet.tuple.schema.version !== "1.0.0" || packet.tuple.schema.digest !== exactPins.schemaDigest || packet.tuple.policy.id !== exactPins.policyId || packet.tuple.policy.version !== "1.0.0" || packet.tuple.policy.digest !== exactPins.policyDigest) return "DIGEST_DRIFT_DENIED";
  if (!validDigest(packet.tuple.tupleDigest) || digestJson({ component: packet.tuple.component, schema: packet.tuple.schema, policy: packet.tuple.policy, capabilitySurface: packet.capabilitySurface }) !== packet.tuple.tupleDigest) return "DIGEST_DRIFT_DENIED";
  if (packet.preflight.referenceTime !== referenceTime || !validateChecks(packet.preflight.checks) || !validateNegativeResults(packet.negativeResults)) return "SCHEMA_DENIED";
  if (!Array.isArray(packet.limitations) || packet.limitations.length < 10 || !packet.limitations.includes("NO_CREDENTIALS") || !packet.limitations.includes("NO_EXTERNAL_MUTATION") || !packet.limitations.includes("OWNER_AUTHORIZATION_REQUIRED_AT_EXECUTION")) return "SCHEMA_DENIED";
  if (packet.rollback.target !== "EXACT_LKG_FULL_PREFLIGHT_TUPLE" || packet.rollback.targetTupleDigest !== exactPins.lkgDigest || packet.rollback.targetVersion !== "1.0.0" || packet.rollback.lkgReference !== "lkg-reference" || packet.rollback.authorizationRequired !== true || packet.rollback.partialRollbackAllowed !== false || packet.rollback.latestVersionFallbackAllowed !== false || !sameJson(packet.rollback.evidenceRefs, ["lkg-reference", "rollback-test"])) return "ROLLBACK_TARGET_DENIED";
  if (packet.evidence.bundleDigest !== exactPins.bundleDigest) return "DIGEST_DRIFT_DENIED";
  const expectedEvidence = new Map([
    ["packet-schema", "docs/development/azure-power-platform/sandbox-preflight-packet.schema.json"],
    ["offline-validator", "tools/azure-power-platform/validate-sandbox-preflight.mjs"],
    ["focused-tests", "tests/azure-power-platform/sandbox-preflight.test.mjs"],
    ["owner-attestation", "tests/fixtures/azure-power-platform/sandbox-preflight-authorized.json"],
    ["policy-attestation", "tests/fixtures/azure-power-platform/sandbox-preflight-authorized.json"],
    ["negative-matrix", "tests/fixtures/azure-power-platform/sandbox-preflight-denied.json"],
    ["lkg-reference", "tests/fixtures/azure-power-platform/sandbox-preflight-authorized.json"],
    ["rollback-test", "tests/azure-power-platform/sandbox-preflight.test.mjs"],
  ]);
  for (const ref of packet.evidence.refs) {
    if (!expectedEvidence.has(ref.id) || ref.ref !== expectedEvidence.get(ref.id) || !validDigest(ref.digest) || ref.validUntil !== evidenceExpiry || ref.validUntil <= referenceTime) return ref.validUntil <= referenceTime ? "EVIDENCE_EXPIRED_DENIED" : "EVIDENCE_REFERENCE_DENIED";
  }
  if (packet.evidence.refs.map((ref) => ref.id).sort().join(",") !== [...expectedEvidence.keys()].sort().join(",")) return "EVIDENCE_REFERENCE_DENIED";
  if (packet.publicSafeProjection.status !== "READY" || packet.publicSafeProjection.reasonCode !== "SYNTHETIC_PREFLIGHT_READY" || packet.publicSafeProjection.environmentClass !== environmentClass || packet.publicSafeProjection.authorizationClaim !== "NOT_AN_APPROVAL" || packet.publicSafeProjection.authenticationPerformed !== false || packet.publicSafeProjection.cloudDiscoveryPerformed !== false || packet.publicSafeProjection.externalMutationPerformed !== false || packet.publicSafeProjection.identifiersRedacted !== true) return "SCHEMA_DENIED";
  if (!sameJson(packet.nonClaims, ["NOT_AN_APPROVAL", "NOT_A_TENANT_AUTHORIZATION", "NOT_A_CLOUD_PREFLIGHT", "NOT_A_PRODUCTION_READINESS_RESULT", "NOT_A_BUSINESS_SUCCESS_RESULT"])) return "SCHEMA_DENIED";
  return null;
}

export function validatePacket(packet) {
  if (!isObject(packet)) return failure("SCHEMA_DENIED");
  if (containsPrivateMaterial(packet)) return failure("PRIVATE_IDENTIFIER_DENIED");
  if (!Object.hasOwn(packet, "authorization")) return failure("MISSING_AUTHORIZATION_DENIED");
  if (!exactKeys(packet, expectedKeys.packet)) return failure("UNKNOWN_FIELD_DENIED");
  if (!exactKeys(packet.authorization, expectedKeys.authorization)) return failure("MISSING_AUTHORIZATION_DENIED");
  if (packet.authorization.requesterRole === packet.authorization.ownerRole || packet.authorization.requesterMayAttest === true) return failure("APPROVAL_SAME_ACTOR_DENIED");
  if (!packet.authorization) return failure("MISSING_AUTHORIZATION_DENIED");
  if (packet.capabilitySurface?.allowedActions?.some((action) => !actions.includes(action)) || packet.capabilitySurface?.allowedOperations?.some((operation) => !operations.includes(operation))) return failure("UNKNOWN_ACTION_DENIED");
  if (packet.capabilitySurface?.governedMutationActions?.length || packet.capabilitySurface?.writeTargets?.length || packet.capabilitySurface?.hiddenWritesAllowed === true) return failure("HIDDEN_WRITE_DENIED");
  if (packet.preflight?.consumptionState === "CONSUMED") return failure("REPLAY_CONSUMED_DENIED");
  if (packet.authorization?.grantState === "REVOKED") return failure("AUTHORITY_REVOKED_DENIED");
  if (packet.authorization?.expiresAt && packet.authorization.expiresAt <= referenceTime) return failure("AUTHORITY_EXPIRED_DENIED");
  const valueReason = validatePacketValues(packet);
  return valueReason ? failure(valueReason) : success();
}

export function applyNegativeCase(packet, caseId) {
  const candidate = structuredClone(packet);
  switch (caseId) {
    case "unknown-fields": candidate.unlisted = true; break;
    case "unknown-actions": candidate.capabilitySurface.allowedActions = ["UNKNOWN_CAPABILITY"]; break;
    case "hidden-writes": candidate.capabilitySurface.governedMutationActions = ["CREATE_RECORD"]; break;
    case "self-approval": candidate.authorization.ownerRole = candidate.authorization.requesterRole; break;
    case "digest-drift": candidate.tuple.tupleDigest = "ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff"; break;
    case "replay": candidate.preflight.consumptionState = "CONSUMED"; break;
    case "expiry": candidate.authorization.expiresAt = "2026-08-28T11:59:59Z"; break;
    case "revocation": candidate.authorization.grantState = "REVOKED"; break;
    case "stale-policy": candidate.tuple.policy.generation = 6; break;
    case "missing-authorization": delete candidate.authorization; break;
    case "wrong-environment": candidate.environmentClass = "MULTI_TENANT_PRODUCTION"; break;
    case "private-identifier": candidate.tenantId = "REDACTED_SYNTHETIC_ONLY"; break;
    case "expired-evidence": candidate.evidence.refs[0].validUntil = "2026-08-28T11:59:59Z"; break;
    default: throw new Error(`unknown negative case: ${caseId}`);
  }
  return candidate;
}

export async function loadFixture(fixturePath, base = root) {
  return JSON.parse(await readFile(path.resolve(base, fixturePath), "utf8"));
}

async function main() {
  const args = process.argv.slice(2);
  const fixtureIndex = args.indexOf("--fixture");
  const fixturePath = fixtureIndex >= 0 ? args[fixtureIndex + 1] : undefined;
  if (!args.includes("--dry-run") || !fixturePath) {
    console.error("usage: node tools/azure-power-platform/validate-sandbox-preflight.mjs --dry-run --fixture <path>");
    process.exitCode = 2;
    return;
  }
  try {
    const fixture = await loadFixture(fixturePath);
    let result;
    if (fixture?.schemaVersion === packetSchemaVersion) {
      result = validatePacket(fixture);
    } else if (fixture?.schemaVersion === fixtureSchemaVersion && fixture.fixtureKind === "DENIED" && Array.isArray(fixture.cases)) {
      if (!fixture.cases.every((item) => isObject(item) && Object.keys(item).sort().join(",") === ["caseId", "expectedReasonCode"].sort().join(","))) throw new Error("invalid denial fixture");
      const packet = await loadFixture("tests/fixtures/azure-power-platform/sandbox-preflight-authorized.json");
      const results = fixture.cases.map((item) => {
        const actual = validatePacket(applyNegativeCase(packet, item.caseId));
        if (actual.accepted || actual.reasonCode !== item.expectedReasonCode) throw new Error(`denial mismatch: ${item.caseId}`);
        return actual;
      });
      result = results.at(-1) ?? failure("SCHEMA_DENIED");
    } else {
      result = failure("SCHEMA_DENIED");
    }
    console.log(JSON.stringify(result.projection));
    process.exitCode = result.accepted ? 0 : 1;
  } catch {
    console.log(JSON.stringify({ status: "DENIED", reasonCode: "SCHEMA_DENIED" }));
    process.exitCode = 1;
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await main();
