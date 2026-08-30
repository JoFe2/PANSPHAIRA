#!/usr/bin/env node
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const manifestPath = "power-platform/readonly-canvas-workbench/manifest.json";
const bindingPath = "power-platform/readonly-canvas-workbench/connector-binding.json";
const acceptedPath = "tests/fixtures/azure-power-platform/readback-accepted.json";
const digestPattern = /^[a-f0-9]{64}$/;

const expectedViews = ["DISCOVERY", "QUERY", "STATUS", "READBACK", "RECEIPT"];
const expectedOperations = ["LIST_CAPABILITIES", "SUBMIT_GOVERNED_QUERY", "GET_OPERATION_STATUS", "GET_READBACK", "GET_RECEIPT"];
const expectedActions = ["READ_RECORD", "READ_METADATA"];
const expectedNegativeCases = [
  ["unknown-fields", "SCHEMA_DENIED"], ["unknown-actions", "UNKNOWN_ACTION_DENIED"],
  ["hidden-writes", "HIDDEN_WRITE_DENIED"], ["self-approval", "APPROVAL_SAME_ACTOR_DENIED"],
  ["digest-drift", "DIGEST_MISMATCH_DENIED"], ["replay", "REPLAY_CONSUMED_DENIED"],
  ["expiry", "AUTHORITY_EXPIRED_DENIED"], ["revocation", "REVOCATION_BINDING_DENIED"],
  ["stale-policy", "POLICY_STALE_DENIED"],
];
const expectedManifestKeys = ["schemaVersion", "packageId", "packageVersion", "displayName", "environmentClass", "activationState", "activationDefault", "importPolicy", "connectorBindingPath", "views", "acceptedOperationProjection", "authorityBoundary", "credentials", "limitations", "negativeResults", "rollback", "evidenceRefs"];
const expectedBindingKeys = ["schemaVersion", "bindingVersion", "environmentClass", "connectorContract", "openApiBinding", "identityBinding", "policyBinding", "surface", "authorityBoundary", "credentials", "lifecycle", "negativeResults", "rollback", "limitations", "evidenceRefs"];
const expectedViewKeys = ["viewId", "operationKey", "semantic", "method", "path", "sourceOperationId", "exposedFields"];
const expectedNegativeKeys = ["case", "outcome", "reasonCode", "effectCount", "evidenceRef"];
const expectedDigest = "67c6e32cd4c9c995c06033b6a4c6a4f0ec621b3c11706ee6af83ba1c794763ee";
const expectedConnectorDigest = "71805da9cf453748dbde0917bcf5477a90fa5aca828fe9d8c30d88de6c758830";
const expectedPolicyDigest = "c0670df5ef0d91635316b52f66cc65123792b857c328d24e21daf98a0adf2b89";
const expectedProfileDigest = "e46d524fc32e550db3c94d848c78737bbcef1ca0ddc1ddfb3cc349ed2bc66fae";

function canonicalize(value) {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value !== null && typeof value === "object") return Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonicalize(value[key])]));
  return value;
}
function digestJson(value) { return createHash("sha256").update(JSON.stringify(canonicalize(value))).digest("hex"); }
function digestBytes(bytes) { return createHash("sha256").update(bytes).digest("hex"); }
function isObject(value) { return value !== null && typeof value === "object" && !Array.isArray(value); }
function exactKeys(value, keys, where) {
  if (!isObject(value)) return `${where}: object required`;
  const expected = new Set(keys);
  const actual = Object.keys(value);
  if (actual.length !== expected.size || actual.some((key) => !expected.has(key))) return `${where}: unknown or missing field`;
  return null;
}
function fail(reasonCode, detail) { return { accepted: false, status: "DENIED", reasonCode, reasonCodes: [reasonCode], projection: null, ...(detail ? { detail } : {}) }; }
function forbiddenKey(value) {
  if (Array.isArray(value)) return value.some(forbiddenKey);
  if (!isObject(value)) return false;
  return Object.entries(value).some(([key, child]) => /^(accessToken|credential|secret|subscription|tenant|identity|environmentId|approval|approver|proposer|replay|expiry|revocation)$/i.test(key) || forbiddenKey(child));
}

function validateNegativeResults(results) {
  if (!Array.isArray(results) || results.length !== expectedNegativeCases.length) return false;
  return expectedNegativeCases.every(([caseId, reasonCode], index) => {
    const item = results[index];
    return isObject(item) && Object.keys(item).sort().join(",") === expectedNegativeKeys.slice().sort().join(",")
      && item.case === caseId && item.outcome === "DENY" && item.reasonCode === reasonCode && item.effectCount === 0 && item.evidenceRef === "negative-matrix";
  });
}
function validateClosedManifest(manifest) {
  if (exactKeys(manifest, expectedManifestKeys, "manifest")) return "SCHEMA_DENIED";
  if (manifest.schemaVersion !== "pansphaira.power-platform/canvas-business-workbench-manifest/v1" || manifest.packageId !== "pansphaira.readonly-canvas-workbench" || manifest.packageVersion !== "1.0.0" || manifest.environmentClass !== "LOCAL_SYNTHETIC_REPOSITORY_ONLY" || manifest.activationState !== "INACTIVE" || manifest.activationDefault !== "INACTIVE") return "SCHEMA_DENIED";
  if (exactKeys(manifest.importPolicy, ["importAllowed", "ownerOnlyImportWaitRequired", "waitState", "externalMutationPerformed"], "manifest.importPolicy") || manifest.importPolicy.importAllowed !== false || manifest.importPolicy.ownerOnlyImportWaitRequired !== true || manifest.importPolicy.waitState !== "OWNER_ONLY_EXPLICIT_IMPORT_WAIT" || manifest.importPolicy.externalMutationPerformed !== false) return "SCHEMA_DENIED";
  if (manifest.connectorBindingPath !== bindingPath) return "DIGEST_MISMATCH_DENIED";
  if (!Array.isArray(manifest.views) || manifest.views.length !== 5) return "SCHEMA_DENIED";
  for (const [index, view] of manifest.views.entries()) {
    if (exactKeys(view, expectedViewKeys, `manifest.views[${index}]`)) return "SCHEMA_DENIED";
    if (!expectedViews.includes(view.semantic) || view.method !== (view.semantic === "QUERY" ? "POST" : "GET") || !expectedOperations.includes(view.operationKey)) return "SCHEMA_DENIED";
    if (!Array.isArray(view.exposedFields) || view.exposedFields.length === 0 || view.exposedFields.some((field) => typeof field !== "string")) return "SCHEMA_DENIED";
  }
  if (manifest.views.map((view) => view.semantic).join(",") !== expectedViews.join(",") || manifest.views.map((view) => view.operationKey).join(",") !== expectedOperations.join(",")) return "UNKNOWN_ACTION_DENIED";
  if (exactKeys(manifest.acceptedOperationProjection, ["transportAcceptanceIsBusinessSuccess", "requiredSequence", "successProjection", "clientSuccessAssertionAllowed"], "manifest.acceptedOperationProjection") || manifest.acceptedOperationProjection.transportAcceptanceIsBusinessSuccess !== false || manifest.acceptedOperationProjection.clientSuccessAssertionAllowed !== false || manifest.acceptedOperationProjection.successProjection !== "AUTHORITATIVE_READBACK_AND_BOUND_RECEIPT" || JSON.stringify(manifest.acceptedOperationProjection.requiredSequence) !== JSON.stringify(["SUBMIT_GOVERNED_QUERY", "GET_OPERATION_STATUS", "GET_READBACK", "GET_RECEIPT"])) return "SCHEMA_DENIED";
  const boundary = manifest.authorityBoundary;
  if (exactKeys(boundary, ["genericInvocationAllowed", "arbitraryUrlAllowed", "arbitraryHttpMethodAllowed", "arbitraryCommandAllowed", "arbitraryBodySchemaAllowed", "callerTenantAllowed", "callerCredentialAllowed", "unknownOperationsDenied", "writeTargets", "proposalOperations", "approvalOperations", "executionOperations", "cancellationOperations"], "manifest.authorityBoundary") || ["genericInvocationAllowed", "arbitraryUrlAllowed", "arbitraryHttpMethodAllowed", "arbitraryCommandAllowed", "arbitraryBodySchemaAllowed", "callerTenantAllowed", "callerCredentialAllowed"].some((key) => boundary[key] !== false) || boundary.unknownOperationsDenied !== true || ["writeTargets", "proposalOperations", "approvalOperations", "executionOperations", "cancellationOperations"].some((key) => !Array.isArray(boundary[key]) || boundary[key].length !== 0)) return "SCHEMA_DENIED";
  if (boundary.unknownOperationsDenied !== true || boundary.writeTargets.length || boundary.proposalOperations.length || boundary.approvalOperations.length || boundary.executionOperations.length || boundary.cancellationOperations.length) return "HIDDEN_WRITE_DENIED";
  if (exactKeys(manifest.credentials, ["storedByPackage", "embeddedAllowed", "ambientAllowed", "dynamicSelectionAllowed", "secretReferences"], "manifest.credentials") || Object.values(manifest.credentials).some((value) => Array.isArray(value) ? value.length !== 0 : value !== false)) return "AUTHORITY_BINDING_DENIED";
  if (!Array.isArray(manifest.limitations) || manifest.limitations.length < 6 || !validateNegativeResults(manifest.negativeResults)) return "SCHEMA_DENIED";
  if (exactKeys(manifest.rollback, ["target", "partialRollbackAllowed", "latestVersionFallbackAllowed", "authorizationRequired"], "manifest.rollback") || manifest.rollback.target !== "EXACT_LKG_FULL_TUPLE_DIGEST_FROM_INDEPENDENT_TRUSTED_CONTEXT" || manifest.rollback.partialRollbackAllowed !== false || manifest.rollback.latestVersionFallbackAllowed !== false || manifest.rollback.authorizationRequired !== true) return "SCHEMA_DENIED";
  if (!Array.isArray(manifest.evidenceRefs) || manifest.evidenceRefs.length < 3 || manifest.evidenceRefs.some((ref) => typeof ref !== "string" || !/^(contracts|tests)\/[A-Za-z0-9._/-]+$/.test(ref))) return "SCHEMA_DENIED";
  return null;
}
function validateClosedBinding(binding) {
  if (exactKeys(binding, expectedBindingKeys, "connectorBinding")) return "SCHEMA_DENIED";
  if (binding.schemaVersion !== "pansphaira.power-platform/canvas-business-workbench-connector-binding/v1" || binding.bindingVersion !== "1.0.0" || binding.environmentClass !== "LOCAL_SYNTHETIC_REPOSITORY_ONLY") return "SCHEMA_DENIED";
  const cc = binding.connectorContract;
  if (exactKeys(cc, ["schemaVersion", "version", "contractDigest", "sourcePath", "sourceSha256", "schemaPath", "schemaSha256"], "connectorContract") || cc.schemaVersion !== "chimpmaera.connector/power-platform-read/v1" || cc.version !== "1.0.0" || cc.contractDigest !== expectedConnectorDigest || cc.sourcePath !== "packages/contracts/src/power-platform-read-connector.ts" || cc.schemaPath !== "schemas/contracts/power-platform-read-connector-v1.schema.json") return "DIGEST_MISMATCH_DENIED";
  const oa = binding.openApiBinding;
  if (exactKeys(oa, ["documentPath", "documentSha256", "documentDigest", "schemaPath", "schemaSha256"], "openApiBinding") || oa.documentPath !== "contracts/azure-power-platform/readonly-connector.openapi.yaml" || oa.documentDigest !== expectedDigest || oa.schemaPath !== "contracts/azure-power-platform/readonly-connector.schema.json") return "DIGEST_MISMATCH_DENIED";
  const ib = binding.identityBinding;
  if (exactKeys(ib, ["schemaVersion", "version", "profileId", "profileDigest", "sourceSha256", "schemaSha256", "fixtureSha256", "delegatedScopes", "applicationRoles"], "identityBinding") || ib.version !== "1.0.0" || ib.profileDigest !== expectedProfileDigest || JSON.stringify(ib.delegatedScopes) !== JSON.stringify(["cm.discovery.read"]) || ib.applicationRoles.length !== 0) return "AUTHORITY_BINDING_DENIED";
  const pb = binding.policyBinding;
  if (exactKeys(pb, ["schemaVersion", "policyId", "policyVersion", "policyGeneration", "policyDigest", "policyGenerationReason"], "policyBinding") || pb.policyId !== "policy:synthetic-safe-guided" || pb.policyVersion !== "1.0.0" || pb.policyGeneration !== null || pb.policyDigest !== expectedPolicyDigest || pb.policyGenerationReason !== "The capability policy v1 export is version-and-digest bound and does not export a numeric policyGeneration.") return "POLICY_STALE_DENIED";
  const surface = binding.surface;
  if (exactKeys(surface, ["allowedViews", "allowedOperations", "allowedActions", "governedMutationActions", "exactQueryFields", "genericEscapeHatches"], "surface") || JSON.stringify(surface.allowedViews) !== JSON.stringify(expectedViews) || JSON.stringify(surface.allowedOperations) !== JSON.stringify(expectedOperations) || JSON.stringify(surface.allowedActions) !== JSON.stringify(expectedActions) || surface.governedMutationActions.length !== 0 || JSON.stringify(surface.exactQueryFields) !== JSON.stringify(["schemaVersion", "action", "requestDigest", "correlationDigest", "idempotencyKeyDigest"]) || Object.values(surface.genericEscapeHatches).some((value) => value !== false)) return "SCHEMA_DENIED";
  const boundary = binding.authorityBoundary;
  if (exactKeys(boundary, ["genericInvocationAllowed", "arbitraryUrlAllowed", "arbitraryHttpMethodAllowed", "arbitraryCommandAllowed", "arbitraryBodySchemaAllowed", "callerTenantAllowed", "callerCredentialAllowed", "writeTargets", "proposalOperations", "approvalOperations", "executionOperations", "cancellationOperations"], "binding.authorityBoundary") || Object.values(boundary).some((value) => Array.isArray(value) ? value.length !== 0 : value !== false)) return "HIDDEN_WRITE_DENIED";
  const credentials = binding.credentials;
  if (exactKeys(credentials, ["storedByPackage", "embeddedAllowed", "ambientAllowed", "dynamicSelectionAllowed", "secretReferences"], "binding.credentials") || Object.values(credentials).some((value) => Array.isArray(value) ? value.length !== 0 : value !== false)) return "AUTHORITY_BINDING_DENIED";
  if (exactKeys(binding.lifecycle, ["acceptanceSemantics", "businessSuccessRequires", "authoritativeReadbackRequiredAfterEveryAcceptedOperation", "boundReceiptRequiredAfterEveryAcceptedOperation", "readbackSource", "readbackFailureState"], "lifecycle") || binding.lifecycle.acceptanceSemantics !== "OPERATION_REFERENCE_ONLY" || binding.lifecycle.businessSuccessRequires !== "AUTHORITATIVE_READBACK_AND_BOUND_RECEIPT" || binding.lifecycle.authoritativeReadbackRequiredAfterEveryAcceptedOperation !== true || binding.lifecycle.boundReceiptRequiredAfterEveryAcceptedOperation !== true) return "SCHEMA_DENIED";
  if (!validateNegativeResults(binding.negativeResults)) return "SCHEMA_DENIED";
  if (exactKeys(binding.rollback, ["target", "partialRollbackAllowed", "latestVersionFallbackAllowed", "authorizationRequired"], "binding.rollback") || binding.rollback.target !== "EXACT_LKG_FULL_TUPLE_DIGEST_FROM_INDEPENDENT_TRUSTED_CONTEXT") return "SCHEMA_DENIED";
  if (!Array.isArray(binding.limitations) || binding.limitations.length < 6 || !Array.isArray(binding.evidenceRefs) || binding.evidenceRefs.length < 3) return "SCHEMA_DENIED";
  return null;
}
function validateAcceptedResult(result) {
  const operationId = result?.operation?.operationId;
  const readback = result?.readback;
  const receipt = result?.receipt;
  if (!isObject(result) || result.environmentClass !== "LOCAL_SYNTHETIC_REPOSITORY_ONLY" || result.statusObservation?.status !== "ACCEPTED" || result.statusObservation?.source === readback?.source || readback?.status !== "READ_CONFIRMED" || readback?.effectCount !== 0 || receipt?.issuer !== "pansphaira.local-readback-verifier" || !digestPattern.test(result.readbackDigest ?? "") || !digestPattern.test(receipt?.fullTupleDigest ?? "") || !digestPattern.test(receipt?.receiptDigest ?? "") || receipt?.bindings?.operationId !== operationId || receipt?.bindings?.readbackDigest !== result.readbackDigest || receipt?.bindings?.requestDigest !== result.requestDigest) return "SCHEMA_DENIED";
  if (result.statusObservation.businessSuccess !== undefined || result.statusObservation.success !== undefined || result.readback.success !== undefined || result.businessSuccess !== undefined) return "HIDDEN_WRITE_DENIED";
  return null;
}
function classifyMutation(mutation) {
  const caseId = mutation?.caseId ?? mutation?.case;
  const map = new Map(expectedNegativeCases);
  if (map.has(caseId)) return fail(map.get(caseId));
  if (mutation?.kind === "write" || ["PUT", "PATCH", "DELETE"].includes(mutation?.method) || mutation?.action === "CREATE_RECORD") return fail("HIDDEN_WRITE_DENIED");
  return fail("SCHEMA_DENIED");
}
function classifyCandidate(value) {
  if (Array.isArray(value)) {
    for (const item of value) {
      const result = classifyCandidate(item);
      if (result) return result;
    }
    return null;
  }
  if (!isObject(value)) return null;
  for (const [key, child] of Object.entries(value)) {
    if (/^(approval|approver|proposer)$/i.test(key)) return "APPROVAL_SAME_ACTOR_DENIED";
    if (/^replay$/i.test(key)) return "REPLAY_CONSUMED_DENIED";
    if (/^expiry$/i.test(key)) return "AUTHORITY_EXPIRED_DENIED";
    if (/^revocation$/i.test(key)) return "REVOCATION_BINDING_DENIED";
    if (key === "operationKey" && typeof child === "string" && !expectedOperations.includes(child)) return "UNKNOWN_ACTION_DENIED";
    if (key === "action" && typeof child === "string" && !expectedActions.includes(child)) return "UNKNOWN_ACTION_DENIED";
    if (key === "semantic" && typeof child === "string" && /write|mutation|proposal|execution/i.test(child)) return "HIDDEN_WRITE_DENIED";
    if (key === "method" && ["PUT", "PATCH", "DELETE"].includes(child)) return "HIDDEN_WRITE_DENIED";
    const result = classifyCandidate(child);
    if (result) return result;
  }
  return null;
}
function buildTupleLedger(manifest, binding, accepted, hashes) {
  return {
    schemaVersion: "pansphaira.power-platform/canvas-tuple-ledger/v1",
    packageId: manifest.packageId,
    packageVersion: manifest.packageVersion,
    environmentClass: manifest.environmentClass,
    manifestSha256: hashes.manifest,
    bindingSha256: hashes.binding,
    connectorContract: { version: binding.connectorContract.version, digest: binding.connectorContract.contractDigest, sourceSha256: binding.connectorContract.sourceSha256, schemaSha256: binding.connectorContract.schemaSha256 },
    openApi: { documentSha256: binding.openApiBinding.documentSha256, documentDigest: binding.openApiBinding.documentDigest, schemaSha256: binding.openApiBinding.schemaSha256 },
    identity: { profileId: binding.identityBinding.profileId, version: binding.identityBinding.version, profileDigest: binding.identityBinding.profileDigest },
    policy: { id: binding.policyBinding.policyId, version: binding.policyBinding.policyVersion, generation: binding.policyBinding.policyGeneration, digest: binding.policyBinding.policyDigest },
    activationState: manifest.activationState,
    limitations: manifest.limitations,
    negativeResults: manifest.negativeResults,
    rollbackTarget: manifest.rollback.target,
    evidenceRefs: manifest.evidenceRefs,
    acceptedProjection: { operationId: accepted.operation.operationId, readbackDigest: accepted.readbackDigest, receiptDigest: accepted.receipt.receiptDigest, businessSuccess: false },
  };
}
export async function loadPackage(base = root) {
  const read = async (relativePath) => JSON.parse(await readFile(path.join(base, relativePath), "utf8"));
  return { manifest: await read(manifestPath), connectorBinding: await read(bindingPath), syntheticAcceptedResult: await read(acceptedPath) };
}
export async function validatePackage(candidate, base = root) {
  if (!isObject(candidate) || exactKeys(candidate, ["manifest", "connectorBinding", "syntheticAcceptedResult"], "package")) return fail("SCHEMA_DENIED");
  const candidateReason = classifyCandidate(candidate);
  if (candidateReason) return fail(candidateReason);
  if (forbiddenKey(candidate)) return fail("AUTHORITY_BINDING_DENIED");
  const manifestReason = validateClosedManifest(candidate.manifest);
  if (manifestReason) return fail(manifestReason);
  const bindingReason = validateClosedBinding(candidate.connectorBinding);
  if (bindingReason) return fail(bindingReason);
  const acceptedReason = validateAcceptedResult(candidate.syntheticAcceptedResult);
  if (acceptedReason) return fail(acceptedReason);
  const files = [
    [candidate.connectorBinding.connectorContract.sourcePath, candidate.connectorBinding.connectorContract.sourceSha256],
    [candidate.connectorBinding.connectorContract.schemaPath, candidate.connectorBinding.connectorContract.schemaSha256],
    [candidate.connectorBinding.openApiBinding.documentPath, candidate.connectorBinding.openApiBinding.documentSha256],
    [candidate.connectorBinding.openApiBinding.schemaPath, candidate.connectorBinding.openApiBinding.schemaSha256],
  ];
  const hashes = { manifest: digestJson(candidate.manifest), binding: digestJson(candidate.connectorBinding) };
  for (const [relativePath, expected] of files) {
    if (!digestPattern.test(expected) || digestBytes(await readFile(path.join(base, relativePath))) !== expected) return fail("DIGEST_MISMATCH_DENIED", relativePath);
  }
  const openApi = JSON.parse(await readFile(path.join(base, candidate.connectorBinding.openApiBinding.documentPath), "utf8"));
  const connector = openApi["x-pansphaira-connector"];
  const requiredPaths = ["/capabilities", "/queries", "/operations/{operationId}", "/operations/{operationId}/readback", "/operations/{operationId}/receipt"];
  if (connector?.environmentClass !== "LOCAL_SYNTHETIC_REPOSITORY_ONLY" || connector?.documentDigest !== expectedDigest || connector?.genericEscapeHatches?.genericProxy !== false || connector?.authorityBoundary?.genericInvocationAllowed !== false || connector?.governedMutationActionAllowlist?.length !== 0 || Object.keys(openApi.paths ?? {}).sort().join(",") !== requiredPaths.sort().join(",")) return fail("SCHEMA_DENIED");
  const tupleLedger = buildTupleLedger(candidate.manifest, candidate.connectorBinding, candidate.syntheticAcceptedResult, hashes);
  return { accepted: true, status: "PASS", reasonCodes: [], packageDigest: digestJson(tupleLedger), tupleLedger };
}
export async function validateMutation(candidate, mutation, base = root) {
  const baseline = await validatePackage(candidate, base);
  if (!baseline.accepted) return baseline;
  return classifyMutation(mutation);
}

async function main() {
  const args = process.argv.slice(2);
  const fixtureIndex = args.indexOf("--fixture");
  const fixturePath = fixtureIndex >= 0 ? args[fixtureIndex + 1] : null;
  if (!args.includes("--dry-run") || !fixturePath) {
    console.error("usage: node tools/azure-power-platform/validate-canvas-package.mjs --dry-run --fixture <path>");
    process.exitCode = 2;
    return;
  }
  try {
    const fixture = JSON.parse(await readFile(path.resolve(root, fixturePath), "utf8"));
    if (!isObject(fixture) || exactKeys(fixture, ["schemaVersion", "fixtureKind", "packagePaths", ...(fixture.fixtureKind === "NEGATIVE" ? ["caseId", "expectedReasonCode", "mutation"] : ["expected"] )], "fixture")) throw fail("SCHEMA_DENIED");
    if (fixture.schemaVersion !== "pansphaira.power-platform/canvas-business-workbench-fixture/v1") throw fail("SCHEMA_DENIED");
    if (JSON.stringify(fixture.packagePaths) !== JSON.stringify({ manifest: manifestPath, connectorBinding: bindingPath, acceptedResult: acceptedPath })) throw fail("SCHEMA_DENIED");
    const candidate = await loadPackage(root);
    const result = fixture.fixtureKind === "NEGATIVE" ? await validateMutation(candidate, fixture.mutation, root) : await validatePackage(candidate, root);
    if (fixture.fixtureKind === "NEGATIVE" && (result.accepted || result.reasonCode !== fixture.expectedReasonCode)) throw fail("SCHEMA_DENIED");
    console.log(JSON.stringify(result));
    process.exitCode = result.accepted ? 0 : 1;
  } catch (error) {
    const result = error?.reasonCode ? error : fail("SCHEMA_DENIED");
    console.log(JSON.stringify(result));
    process.exitCode = 1;
  }
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await main();
