#!/usr/bin/env node
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const schemaVersion = "pansphaira.azure-power-platform/compatibility-migration/v1";
const referenceTime = "2026-08-28T12:00:00Z";
const digestPattern = /^[a-f0-9]{64}$/;
const immutableVersion = /^\d+\.\d+\.\d+$/;
const allowedAction = "VALIDATE_COMPATIBILITY_MIGRATION";
const expectedNegativeResults = [
  ["UNKNOWN_SCHEMA", "SCHEMA_VERSION_DENIED"],
  ["UNKNOWN_FIELDS", "UNKNOWN_FIELD_DENIED"],
  ["UNKNOWN_ACTION", "UNKNOWN_ACTION_DENIED"],
  ["HIDDEN_WRITE", "HIDDEN_WRITE_DENIED"],
  ["SELF_APPROVAL", "SELF_APPROVAL_DENIED"],
  ["DIGEST_DRIFT", "DIGEST_DRIFT_DENIED"],
  ["REPLAY", "REPLAY_DENIED"],
  ["EXPIRY", "EXPIRY_DENIED"],
  ["REVOCATION", "REVOCATION_DENIED"],
  ["STALE_POLICY", "STALE_POLICY_DENIED"],
  ["MISSING_MIGRATION_EDGE", "MIGRATION_EDGE_DENIED"],
  ["INCOMPATIBLE_VERSION", "INCOMPATIBLE_VERSION_DENIED"],
  ["MUTABLE_LATEST_REFERENCE", "MUTABLE_VERSION_DENIED"],
  ["AUTHORITY_CHANGE", "AUTHORITY_CHANGE_DENIED"],
  ["IRREVERSIBLE_TRANSITION", "IRREVERSIBLE_TRANSITION_DENIED"],
  ["MISSING_EXACT_ROLLBACK", "ROLLBACK_TARGET_DENIED"],
];
const expected = {
  environmentClass: "LOCAL_SYNTHETIC_REPOSITORY_ONLY",
  sharedLifecycle: { versioning: "SHARED_VERSIONING", migration: "SHARED_MIGRATION", revocation: "SHARED_REVOCATION", compatibility: "SHARED_COMPATIBILITY", accepted: "ACCEPTED", lkg: "LKG" },
  admission: { requestId: "synthetic-compatibility-admission-001", issuedAt: "2026-08-28T08:00:00Z", expiresAt: "2026-08-29T08:00:00Z", proposer: "opaque-authority-proposer-001", approver: "opaque-authority-approver-002" },
  component: { id: "synthetic-power-platform-component", version: "1.1.0", digest: "1111111111111111111111111111111111111111111111111111111111111111" },
  schema: { id: "synthetic-compatibility-schema", version: "1.0.0", digest: "2222222222222222222222222222222222222222222222222222222222222222" },
  policy: { id: "synthetic-compatibility-policy", version: "1.0.0", generation: 12, digest: "3333333333333333333333333333333333333333333333333333333333333333" },
  evidenceDigest: "4444444444444444444444444444444444444444444444444444444444444444",
  source: { version: "1.0.0", digest: "5555555555555555555555555555555555555555555555555555555555555555", status: "ACCEPTED" },
  target: { version: "1.1.0", digest: "6666666666666666666666666666666666666666666666666666666666666666", status: "ACCEPTED" },
  lkg: { version: "1.0.0", digest: "7777777777777777777777777777777777777777777777777777777777777777", status: "LKG", revocationState: "UNREVOKED" },
  migration: { edgeId: "synthetic-power-platform-component-1.0.0-to-1.1.0", fromVersion: "1.0.0", toVersion: "1.1.0", edgeDigest: "8888888888888888888888888888888888888888888888888888888888888888", transition: "NO_OP_FORWARD_COMPATIBLE", authority: "opaque-authority-migration-003", reversible: true, effectCount: 0 },
  compatibility: { result: "COMPATIBLE", componentVersion: "1.1.0", schemaVersion: "1.0.0", policyGeneration: 12, evidenceDigest: "4444444444444444444444444444444444444444444444444444444444444444" },
  rollback: { target: "EXACT_LKG_FULL_TUPLE_DIGEST_FROM_INDEPENDENT_TRUSTED_CONTEXT", targetVersion: "1.0.0", targetDigest: "7777777777777777777777777777777777777777777777777777777777777777", targetStatus: "LKG", targetRevocationState: "UNREVOKED", partialRollbackAllowed: false, latestVersionFallbackAllowed: false, evidenceRefs: ["evidence-004", "evidence-005"] },
  limitations: ["LOCAL_SYNTHETIC_REPOSITORY_ONLY", "NO_SANDBOX_ACTION", "NO_EXTERNAL_MUTATION", "NO_HIDDEN_WRITES", "NO_SELF_APPROVAL", "EXACT_IMMUTABLE_VERSIONS_ONLY", "EXACT_LKG_ROLLBACK_ONLY", "SYNTHETIC_EVIDENCE_ONLY"],
  evidence: { bundleDigest: "9999999999999999999999999999999999999999999999999999999999999999", refs: [
    { id: "evidence-001", ref: "contracts/azure-power-platform/compatibility-migration.schema.json", digest: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa" },
    { id: "evidence-002", ref: "tools/azure-power-platform/validate-compatibility-migration.mjs", digest: "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb" },
    { id: "evidence-003", ref: "tests/azure-power-platform/compatibility-migration.test.mjs", digest: "cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc" },
    { id: "evidence-004", ref: "tests/fixtures/azure-power-platform/compatibility-valid.json", digest: "dddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd" },
    { id: "evidence-005", ref: "tests/fixtures/azure-power-platform/compatibility-revoked.json", digest: "eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee" },
  ] },
  nonClaims: ["NOT_A_SANDBOX_ACTION", "NOT_A_PROVIDER_AUTHORIZATION", "NOT_A_MIGRATION_EXECUTION", "NOT_A_BUSINESS_SUCCESS_RESULT"],
};
const keys = {
  root: ["schemaVersion", "candidateKind", "environmentClass", "sharedLifecycle", "admission", "surface", "tuple", "migration", "compatibility", "rollback", "limitations", "negativeResults", "evidence", "nonClaims"],
  sharedLifecycle: ["versioning", "migration", "revocation", "compatibility", "accepted", "lkg"],
  admission: ["requestId", "issuedAt", "expiresAt", "replayState", "revocationState", "proposer", "approver", "action"],
  surface: ["requestedAction", "allowedActions", "writeActions", "hiddenWritesAllowed", "externalMutation", "effectCount"],
  tuple: ["component", "schema", "policy", "evidenceDigest", "source", "target", "lkg", "tupleDigest"],
  artifact: ["id", "version", "digest"], policy: ["id", "version", "generation", "digest"], state: ["version", "digest", "status"], lkg: ["version", "digest", "status", "revocationState"],
  migration: ["edgeId", "fromVersion", "toVersion", "edgeDigest", "transition", "authority", "reversible", "effectCount"], compatibility: ["result", "componentVersion", "schemaVersion", "policyGeneration", "evidenceDigest"],
  rollback: ["target", "targetVersion", "targetDigest", "targetStatus", "targetRevocationState", "partialRollbackAllowed", "latestVersionFallbackAllowed", "evidenceRefs"],
  negative: ["case", "outcome", "reasonCode", "effectCount", "evidenceRef"], evidence: ["bundleDigest", "refs"], evidenceRef: ["id", "ref", "digest"],
};

function isObject(value) { return value !== null && typeof value === "object" && !Array.isArray(value); }
function exactKeys(value, names) { return isObject(value) && Object.keys(value).length === names.length && Object.keys(value).every((name) => names.includes(name)); }
function sameJson(left, right) { return JSON.stringify(left) === JSON.stringify(right); }
function canonicalize(value) { return Array.isArray(value) ? value.map(canonicalize) : isObject(value) ? Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonicalize(value[key])])) : value; }
function digestJson(value) { return createHash("sha256").update(JSON.stringify(canonicalize(value))).digest("hex"); }
function failure(reasonCode) { return { accepted: false, status: "DENIED", reasonCode, reasonCodes: [reasonCode], projection: { status: "DENIED", reasonCode } }; }
function tuplePayload(candidate) {
  return { environmentClass: candidate.environmentClass, component: candidate.tuple.component, schema: candidate.tuple.schema, policy: candidate.tuple.policy, evidenceDigest: candidate.tuple.evidenceDigest, source: candidate.tuple.source, target: candidate.tuple.target, lkg: candidate.tuple.lkg, migration: candidate.migration, compatibility: candidate.compatibility };
}
function validShape(candidate) {
  return exactKeys(candidate, keys.root) && exactKeys(candidate.sharedLifecycle, keys.sharedLifecycle) && exactKeys(candidate.admission, keys.admission) && exactKeys(candidate.surface, keys.surface) && exactKeys(candidate.tuple, keys.tuple) && exactKeys(candidate.tuple.component, keys.artifact) && exactKeys(candidate.tuple.schema, keys.artifact) && exactKeys(candidate.tuple.policy, keys.policy) && exactKeys(candidate.tuple.source, keys.state) && exactKeys(candidate.tuple.target, keys.state) && exactKeys(candidate.tuple.lkg, keys.lkg) && exactKeys(candidate.migration, keys.migration) && exactKeys(candidate.compatibility, keys.compatibility) && exactKeys(candidate.rollback, keys.rollback) && exactKeys(candidate.evidence, keys.evidence) && Array.isArray(candidate.evidence.refs) && candidate.evidence.refs.every((ref) => exactKeys(ref, keys.evidenceRef)) && Array.isArray(candidate.negativeResults) && candidate.negativeResults.every((item) => exactKeys(item, keys.negative));
}
function hasMutableVersion(candidate) {
  const versions = [candidate?.tuple?.component?.version, candidate?.tuple?.schema?.version, candidate?.tuple?.policy?.version, candidate?.tuple?.source?.version, candidate?.tuple?.target?.version, candidate?.tuple?.lkg?.version, candidate?.migration?.fromVersion, candidate?.migration?.toVersion, candidate?.compatibility?.componentVersion, candidate?.compatibility?.schemaVersion, candidate?.rollback?.targetVersion];
  return versions.some((version) => typeof version !== "string" || !immutableVersion.test(version));
}
function exactNegativeResults(results) {
  return Array.isArray(results) && results.length === expectedNegativeResults.length && expectedNegativeResults.every(([caseName, reasonCode], index) => sameJson(results[index], { case: caseName, outcome: "DENY", reasonCode, effectCount: 0, evidenceRef: "evidence-003" }));
}
function success(candidate) {
  return {
    accepted: true, status: "ALLOWED", reasonCode: "COMPATIBILITY_MIGRATION_ALLOWED", reasonCodes: [],
    projection: {
      status: "ALLOWED", reasonCode: "COMPATIBILITY_MIGRATION_ALLOWED", environmentClass: candidate.environmentClass,
      fullTupleDigest: candidate.tuple.tupleDigest, component: structuredClone(candidate.tuple.component), schema: structuredClone(candidate.tuple.schema), policy: structuredClone(candidate.tuple.policy),
      source: structuredClone(candidate.tuple.source), target: structuredClone(candidate.tuple.target), compatibilityResult: candidate.compatibility.result, migrationEdge: candidate.migration.edgeId,
      rollbackTarget: candidate.rollback.targetDigest, evidenceRefs: candidate.evidence.refs.map((ref) => ref.id), limitations: [...candidate.limitations], negativeReasonCodes: candidate.negativeResults.map((item) => item.reasonCode), externalMutationPerformed: false,
    },
  };
}

export function validateCompatibilityMigration(candidate) {
  if (!isObject(candidate)) return failure("SCHEMA_DENIED");
  if (candidate.schemaVersion !== schemaVersion) return failure("SCHEMA_VERSION_DENIED");
  if (candidate.surface?.requestedAction !== allowedAction || !sameJson(candidate.surface?.allowedActions, [allowedAction]) || candidate.admission?.action !== allowedAction) return failure("UNKNOWN_ACTION_DENIED");
  if (candidate.surface?.hiddenWritesAllowed === true || candidate.surface?.externalMutation === true || candidate.surface?.effectCount !== 0 || candidate.surface?.writeActions?.length) return failure("HIDDEN_WRITE_DENIED");
  if (candidate.admission?.proposer === candidate.admission?.approver) return failure("SELF_APPROVAL_DENIED");
  if (candidate.admission?.replayState === "CONSUMED") return failure("REPLAY_DENIED");
  if (candidate.admission?.expiresAt && candidate.admission.expiresAt <= referenceTime) return failure("EXPIRY_DENIED");
  if (candidate.admission?.revocationState === "REVOKED" || candidate.tuple?.lkg?.revocationState === "REVOKED" || candidate.rollback?.targetRevocationState === "REVOKED") return failure("REVOCATION_DENIED");
  if (!candidate.migration || !candidate.migration.edgeId) return failure("MIGRATION_EDGE_DENIED");
  if (candidate.compatibility?.result !== "COMPATIBLE") return failure("INCOMPATIBLE_VERSION_DENIED");
  if (candidate.migration?.reversible !== true) return failure("IRREVERSIBLE_TRANSITION_DENIED");
  if (!candidate.rollback || candidate.rollback.target !== "EXACT_LKG_FULL_TUPLE_DIGEST_FROM_INDEPENDENT_TRUSTED_CONTEXT") return failure("ROLLBACK_TARGET_DENIED");
  if (hasMutableVersion(candidate)) return failure("MUTABLE_VERSION_DENIED");
  if (candidate.tuple?.policy?.generation !== 12 || candidate.compatibility?.policyGeneration !== 12) return failure("STALE_POLICY_DENIED");
  if (candidate.migration?.authority !== expected.migration.authority) return failure("AUTHORITY_CHANGE_DENIED");
  if (!validShape(candidate)) return failure("UNKNOWN_FIELD_DENIED");
  if (candidate.candidateKind !== "SYNTHETIC_COMPATIBILITY_MIGRATION_CANDIDATE" || candidate.environmentClass !== expected.environmentClass || !sameJson(candidate.sharedLifecycle, expected.sharedLifecycle)) return failure("SCHEMA_DENIED");
  if (!sameJson({ requestId: candidate.admission.requestId, issuedAt: candidate.admission.issuedAt, expiresAt: candidate.admission.expiresAt, proposer: candidate.admission.proposer, approver: candidate.admission.approver }, expected.admission) || candidate.admission.replayState !== "UNCONSUMED" || candidate.admission.revocationState !== "UNREVOKED") return failure("AUTHORITY_CHANGE_DENIED");
  if (!sameJson(candidate.surface, { requestedAction: allowedAction, allowedActions: [allowedAction], writeActions: [], hiddenWritesAllowed: false, externalMutation: false, effectCount: 0 })) return failure("HIDDEN_WRITE_DENIED");
  if (!sameJson(candidate.tuple.component, expected.component) || !sameJson(candidate.tuple.schema, expected.schema) || !sameJson(candidate.tuple.policy, expected.policy) || candidate.tuple.evidenceDigest !== expected.evidenceDigest || !sameJson(candidate.tuple.source, expected.source) || !sameJson(candidate.tuple.target, expected.target) || !sameJson(candidate.tuple.lkg, expected.lkg) || !sameJson(candidate.migration, expected.migration) || !sameJson(candidate.compatibility, expected.compatibility)) return failure("DIGEST_DRIFT_DENIED");
  if (!digestPattern.test(candidate.tuple.tupleDigest) || candidate.tuple.tupleDigest !== digestJson(tuplePayload(candidate))) return failure("DIGEST_DRIFT_DENIED");
  if (!sameJson(candidate.rollback, expected.rollback)) return failure("ROLLBACK_TARGET_DENIED");
  if (!sameJson(candidate.limitations, expected.limitations) || !sameJson(candidate.evidence, expected.evidence) || !sameJson(candidate.nonClaims, expected.nonClaims) || !exactNegativeResults(candidate.negativeResults)) return failure("DIGEST_DRIFT_DENIED");
  return success(candidate);
}

export function applyNegativeCase(candidate, caseId) {
  const result = structuredClone(candidate);
  switch (caseId) {
    case "unknown-schema": result.schemaVersion = "pansphaira.azure-power-platform/compatibility-migration/v999"; break;
    case "unknown-field": result.unlisted = true; break;
    case "unknown-action": result.surface.requestedAction = "UNKNOWN_ACTION"; break;
    case "hidden-write": result.surface.writeActions = ["CREATE_RECORD"]; break;
    case "self-approval": result.admission.approver = result.admission.proposer; break;
    case "digest-drift": result.tuple.component.digest = "ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff"; break;
    case "replay": result.admission.replayState = "CONSUMED"; break;
    case "expiry": result.admission.expiresAt = "2026-08-28T11:59:59Z"; break;
    case "revocation": result.admission.revocationState = "REVOKED"; break;
    case "stale-policy": result.tuple.policy.generation = 11; result.compatibility.policyGeneration = 11; break;
    case "missing-migration-edge": delete result.migration.edgeId; break;
    case "incompatible-version": result.compatibility.result = "INCOMPATIBLE"; break;
    case "mutable-latest-reference": result.migration.toVersion = "latest"; break;
    case "authority-change": result.migration.authority = "opaque-authority-migration-999"; break;
    case "irreversible-transition": result.migration.reversible = false; break;
    case "missing-exact-rollback": result.rollback.target = "LATEST_LKG"; break;
    default: throw new Error(`unknown negative case: ${caseId}`);
  }
  return result;
}

export async function loadFixture(fixturePath, base = root) { return JSON.parse(await readFile(path.resolve(base, fixturePath), "utf8")); }

async function main() {
  const args = process.argv.slice(2);
  const inputIndex = args.indexOf("--input");
  const fixturePath = inputIndex >= 0 ? args[inputIndex + 1] : undefined;
  if (!fixturePath || inputIndex < 0 || args.length !== 2) { console.error("usage: node tools/azure-power-platform/validate-compatibility-migration.mjs --input <path>"); process.exitCode = 2; return; }
  try {
    const fixture = await loadFixture(fixturePath);
    let candidate = fixture;
    if (fixture?.schemaVersion === "pansphaira.azure-power-platform/compatibility-migration-revoked-fixture/v1" && fixture.fixtureKind === "REVOKED" && fixture.revocationState === "REVOKED" && fixture.expectedReasonCode === "REVOCATION_DENIED" && typeof fixture.baseFixture === "string") {
      candidate = await loadFixture(fixture.baseFixture);
      candidate.admission.revocationState = fixture.revocationState;
    }
    const result = validateCompatibilityMigration(candidate);
    console.log(JSON.stringify(result.projection));
    process.exitCode = result.accepted ? 0 : 1;
  } catch {
    console.log(JSON.stringify({ status: "DENIED", reasonCode: "SCHEMA_DENIED" }));
    process.exitCode = 1;
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await main();
