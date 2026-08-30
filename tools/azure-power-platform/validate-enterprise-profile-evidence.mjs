#!/usr/bin/env node
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import Ajv2020 from "ajv/dist/2020.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const schemaPath = path.join(root, "docs/development/azure-power-platform/enterprise-profile-evidence.schema.json");
const schema = JSON.parse(await readFile(schemaPath, "utf8"));
const validateSchema = new Ajv2020({ allErrors: true, strict: true }).compile(schema);
const digestPattern = /^[a-f0-9]{64}$/;
const versionPattern = /^\d+\.\d+\.\d+$/;
const policyGeneration = 17;
const evidenceIds = Array.from({ length: 8 }, (_, index) => `evidence-${String(index + 1).padStart(3, "0")}`);
const limitationSet = [
  "LOCAL_SYNTHETIC_REPOSITORY_ONLY", "NO_TENANT_VALIDATION", "NO_RUNTIME_VALIDATION", "NO_PRODUCTION_VALIDATION",
  "NO_EXTERNAL_CONFIGURATION", "NO_EXTERNAL_MUTATION", "NO_IMPORT_EXECUTION", "NO_PUBLICATION", "NO_PROMOTION",
  "OWNER_ONLY_NEXT_ACTIONS", "SYNTHETIC_EVIDENCE_ONLY",
];
const nonClaimSet = [
  "NOT_TENANT_VALIDATED", "NOT_RUNTIME_VALIDATED", "NOT_PRODUCTION_VALIDATED", "NOT_ENTERPRISE_READY", "NOT_CLOUD_CONFIGURED",
  "NOT_IMPORT_AUTHORITY", "NOT_EXECUTION_AUTHORITY", "NOT_PUBLICATION_AUTHORITY", "NOT_PROMOTION_AUTHORITY", "NOT_RELEASED",
];
const negativeCases = [
  ["INCOMPLETE_EVIDENCE", "INCOMPLETE_EVIDENCE_DENIED"], ["CROSS_TUPLE_MISMATCH", "CROSS_TUPLE_MISMATCH_DENIED"],
  ["PRODUCTION_READINESS_ASSERTION", "PRODUCTION_READINESS_DENIED"], ["UNIDENTIFIED_AUTHORITY", "AUTHORITY_IDENTITY_DENIED"],
  ["OMITTED_LIMITATION", "LIMITATION_MISSING_DENIED"], ["PUBLIC_UNSAFE_MATERIAL", "PUBLIC_UNSAFE_MATERIAL_DENIED"],
  ["CAPABILITY_AS_AUTHORITY", "CAPABILITY_BYTES_AUTHORITY_DENIED"], ["PACKAGE_AS_AUTHORITY", "PACKAGE_AUTHORITY_DENIED"],
  ["NO_RELEASE_AS_AUTHORITY", "NO_RELEASE_AUTHORITY_DENIED"], ["MISSING_RESET_RESIDUE_PROOF", "ZERO_OWNED_RESIDUE_DENIED"],
  ["MISSING_POLICY_GENERATION", "POLICY_GENERATION_DENIED"], ["MISSING_ROLLBACK_TARGET", "ROLLBACK_TARGET_DENIED"],
];
const actions = ["IMPORT", "EXECUTION", "PUBLICATION", "PROMOTION", "ROLLBACK"];

function isObject(value) { return value !== null && typeof value === "object" && !Array.isArray(value); }
function canonicalize(value) {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (isObject(value)) return Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonicalize(value[key])]));
  return value;
}
export function digestJson(value) { return createHash("sha256").update(JSON.stringify(canonicalize(value))).digest("hex"); }
function sameJson(left, right) { return JSON.stringify(canonicalize(left)) === JSON.stringify(canonicalize(right)); }
function failure(reasonCode) { return { accepted: false, status: "DENIED", reasonCode, report: { status: "DENIED", reasonCode, redacted: true } }; }
function success(packet) {
  return {
    accepted: true,
    status: "VALIDATED",
    reasonCode: "SYNTHETIC_ENTERPRISE_PROFILE_EVIDENCE_VALIDATED",
    report: {
      status: "VALIDATED_LOCAL_SYNTHETIC_CANDIDATE",
      packetStatus: packet.packetStatus,
      environmentClass: packet.environmentClass,
      policy: { version: packet.policy.version, generation: packet.policy.generation, digest: packet.policy.digest },
      componentVersions: Object.fromEntries(Object.entries(packet.components).map(([key, value]) => [key, value.version])),
      componentDigests: Object.fromEntries(Object.entries(packet.components).map(([key, value]) => [key, value.digest])),
      fullTupleDigest: packet.fullTuple.digest,
      lkg: { version: packet.lkg.version, fullTupleDigest: packet.lkg.fullTupleDigest, status: packet.lkg.status },
      zeroOwnedResidue: packet.resetUninstall.uninstall.ownedResidueCount === 0,
      limitations: [...packet.limitations],
      negativeReasonCodes: packet.negativeResults.map((item) => item.reasonCode),
      evidenceRefs: packet.evidence.refs.map((item) => item.id),
      publicClosure: { planningArtifact: true, planningPr: true, implementationPrs: packet.publicClosure.implementationPrs.length, release: "NOT_RELEASED", publicReadback: true },
      nonValidatedClaims: packet.nonValidatedClaims.map((item) => item.claim),
      nonClaims: [...packet.nonClaims],
      redacted: true,
    },
  };
}
function containsUnsafeMaterial(value, key = "") {
  const normalized = key.replace(/[^a-z0-9]/gi, "").toLowerCase();
  if (["tenant", "tenantid", "subscription", "subscriptionid", "environmentid", "credential", "accesstoken", "password", "secret", "secretreference", "privatepath", "internalhost"].includes(normalized)) return true;
  if (typeof value === "string" && /(?:bearer\s+|secret:\/\/|https?:\/\/|\\\\|(?:tenant|subscription|environment)[-_:/]?id\b|[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,})/i.test(value)) return true;
  if (Array.isArray(value)) return value.some((item) => containsUnsafeMaterial(item));
  if (isObject(value)) return Object.entries(value).some(([childKey, child]) => containsUnsafeMaterial(child, childKey));
  return false;
}
function componentPayload(packet) {
  return { environmentClass: packet.environmentClass, policy: packet.policy, components: packet.components };
}
function receiptDigest(receipt) {
  return digestJson({ operationId: receipt.operationId, eventDigest: receipt.eventDigest, readbackDigest: receipt.readbackDigest, status: receipt.status, effectCount: 0 });
}
function allImmutableArtifacts(packet) {
  return Object.values(packet.components).every((artifact) => versionPattern.test(artifact.version) && digestPattern.test(artifact.digest));
}
function evidenceById(packet) { return new Map(packet.evidence.refs.map((ref) => [ref.id, ref])); }
function exactNegativeResults(packet, ids) {
  if (!Array.isArray(packet.negativeResults) || packet.negativeResults.length !== negativeCases.length) return false;
  return negativeCases.every(([caseName, reasonCode], index) => {
    const result = packet.negativeResults[index];
    return result?.case === caseName && result.outcome === "DENY" && result.reasonCode === reasonCode && result.effectCount === 0 && ids.has(result.evidenceRef);
  });
}
function validateEvidence(packet, ids) {
  if (!Array.isArray(packet.evidence.refs) || packet.evidence.refs.length !== evidenceIds.length) return "INCOMPLETE_EVIDENCE_DENIED";
  if (!sameJson(packet.evidence.refs.map((ref) => ref.id), evidenceIds)) return "INCOMPLETE_EVIDENCE_DENIED";
  if (packet.evidence.bundleDigest !== digestJson(packet.evidence.refs)) return "EVIDENCE_DIGEST_DENIED";
  for (const ref of packet.evidence.refs) {
    if (!digestPattern.test(ref.digest) || ref.immutable !== true || ref.policyGeneration !== policyGeneration) return "IMMUTABLE_EVIDENCE_REFERENCE_DENIED";
    if (!packet.limitations.includes(ref.limitation) || !packet.negativeResults.some((result) => result.reasonCode === ref.negativeResult)) return "EVIDENCE_COMPLETENESS_DENIED";
    if (ref.rollbackTarget !== packet.lkg.fullTupleDigest || !packet.nextActions.some((action) => action.id === ref.ownerOnlyNextAction)) return "EVIDENCE_COMPLETENESS_DENIED";
  }
  return null;
}
function validatePublicClosure(publicClosure) {
  const links = [publicClosure.planningArtifact, publicClosure.planningPr, ...publicClosure.implementationPrs, publicClosure.publicReadback];
  if (!links.every((link) => link.status === "LINKED" && digestPattern.test(link.digest) && /^(docs|tests|pull)\//.test(link.reference))) return "PUBLIC_CLOSURE_DENIED";
  if (publicClosure.release.status !== "NOT_RELEASED" || publicClosure.release.reference !== null || publicClosure.release.digest !== null) return "PUBLIC_CLOSURE_DENIED";
  return null;
}

export function validateEnterpriseProfileEvidence(packet) {
  if (!isObject(packet)) return failure("SCHEMA_DENIED");
  if (containsUnsafeMaterial(packet)) return failure("PUBLIC_UNSAFE_MATERIAL_DENIED");
  if (packet.packetStatus !== undefined && packet.packetStatus !== "CANDIDATE_ONLY") return failure("PRODUCTION_READINESS_DENIED");
  if (packet.environmentClass !== undefined && packet.environmentClass !== "LOCAL_SYNTHETIC_REPOSITORY_ONLY") return failure("ENVIRONMENT_CLASS_DENIED");
  if (packet.policy?.generation !== undefined && packet.policy.generation !== policyGeneration) return failure("POLICY_GENERATION_DENIED");
  if (Array.isArray(packet.evidence?.refs) && (packet.evidence.refs.length !== evidenceIds.length || !sameJson(packet.evidence.refs.map((ref) => ref?.id), evidenceIds))) return failure("INCOMPLETE_EVIDENCE_DENIED");
  if (packet.authorityBoundary?.unidentifiedAuthorityAllowed === true) return failure("AUTHORITY_IDENTITY_DENIED");
  if (packet.authorityBoundary && Object.values(packet.authorityBoundary.authorities ?? {}).some((value) => typeof value !== "string" || !/^opaque-authority-[a-z]+-[0-9]{3}$/.test(value))) return failure("AUTHORITY_IDENTITY_DENIED");
  if (packet.authorityBoundary?.capabilityBytesGrantAuthority === true) return failure("CAPABILITY_BYTES_AUTHORITY_DENIED");
  if (packet.authorityBoundary?.packageGrantsAuthority === true) return failure("PACKAGE_AUTHORITY_DENIED");
  if (packet.authorityBoundary?.noReleaseDecisionGrantsAuthority === true) return failure("NO_RELEASE_AUTHORITY_DENIED");
  if (packet.resetUninstall?.uninstall?.ownedResidueCount !== undefined && packet.resetUninstall.uninstall.ownedResidueCount !== 0) return failure("ZERO_OWNED_RESIDUE_DENIED");
  if (packet.rollback?.targetFullTupleDigest !== undefined && packet.lkg?.fullTupleDigest !== packet.rollback.targetFullTupleDigest) return failure("ROLLBACK_TARGET_DENIED");
  if (!validateSchema(packet)) return failure("SCHEMA_DENIED");
  if (packet.packetStatus !== "CANDIDATE_ONLY" || packet.environmentClass !== "LOCAL_SYNTHETIC_REPOSITORY_ONLY") return failure("SCHEMA_DENIED");
  if (!sameJson(packet.policy, packet.fullTuple.policy) || packet.policy.generation !== policyGeneration || packet.policy.status !== "ACTIVE") return failure("CROSS_TUPLE_MISMATCH_DENIED");
  if (!allImmutableArtifacts(packet)) return failure("IMMUTABLE_COMPONENT_REFERENCE_DENIED");
  if (!sameJson(packet.components, packet.fullTuple.components) || packet.fullTuple.digest !== digestJson(componentPayload(packet))) return failure("CROSS_TUPLE_MISMATCH_DENIED");
  for (const [domain, evidence] of Object.entries(packet)) {
    if (["alm", "compatibility", "delegatedIdentitySecurity", "observabilityDr", "receipts"].includes(domain) && (!sameJson(evidence.artifact, packet.components[domain]) || evidence.status !== "VALIDATED_LOCAL_SYNTHETIC")) return failure("CROSS_TUPLE_MISMATCH_DENIED");
  }
  if (packet.lkg.status !== "LKG" || packet.lkg.revocationState !== "UNREVOKED" || !digestPattern.test(packet.lkg.fullTupleDigest)) return failure("ROLLBACK_TARGET_DENIED");
  if (packet.lkg.fullTupleDigest !== packet.fullTuple.digest) return failure("CROSS_TUPLE_MISMATCH_DENIED");
  if (packet.resetUninstall.reset.targetTupleDigest !== packet.lkg.fullTupleDigest || packet.resetUninstall.uninstall.command !== "NO_COMMAND_EXECUTED_OFFLINE" || packet.resetUninstall.reset.command !== "NO_COMMAND_EXECUTED_OFFLINE" || packet.resetUninstall.uninstall.postcondition !== "ZERO_OWNED_RESIDUE" || packet.resetUninstall.readback.targetTupleDigest !== packet.lkg.fullTupleDigest || packet.resetUninstall.receipt.status !== "ACCEPTED_READBACK_BOUND") return failure("RESET_UNINSTALL_EVIDENCE_DENIED");
  if (packet.resetUninstall.readback.operationId !== packet.resetUninstall.receipt.operationId || packet.resetUninstall.receipt.receiptDigest !== receiptDigest(packet.resetUninstall.receipt)) return failure("RECEIPT_BINDING_DENIED");
  if (packet.rollback.targetFullTupleDigest !== packet.lkg.fullTupleDigest || packet.rollback.target !== "EXACT_LKG_FULL_TUPLE_FROM_INDEPENDENT_TRUSTED_CONTEXT" || packet.rollback.authorization !== "OWNER_ONLY_REQUIRED" || packet.rollback.partialRollbackAllowed || packet.rollback.latestVersionFallbackAllowed) return failure("ROLLBACK_TARGET_DENIED");
  if (!sameJson(packet.limitations, limitationSet) || !sameJson(packet.nonClaims, nonClaimSet)) return failure("LIMITATION_MISSING_DENIED");
  const ids = evidenceById(packet);
  const domains = ["alm", "compatibility", "delegatedIdentitySecurity", "observabilityDr", "receipts"];
  const referencedEvidenceIds = [
    ...domains.flatMap((domain) => packet[domain].evidenceRefs),
    packet.lkg.evidenceRef,
    packet.resetUninstall.receipt.evidenceRef,
    packet.rollback.evidenceRef,
    ...packet.nextActions.map((action) => action.evidenceRef),
  ];
  if (referencedEvidenceIds.some((id) => !ids.has(id))) return failure("UNRESOLVED_EVIDENCE_REFERENCE_DENIED");
  const evidenceError = validateEvidence(packet, ids);
  if (evidenceError) return failure(evidenceError);
  if (!exactNegativeResults(packet, ids)) return failure("NEGATIVE_EVIDENCE_DENIED");
  const actionAuthorities = {
    IMPORT: packet.authorityBoundary.authorities.importOwner,
    EXECUTION: packet.authorityBoundary.authorities.executionOwner,
    PUBLICATION: packet.authorityBoundary.authorities.publicationOwner,
    PROMOTION: packet.authorityBoundary.authorities.promotionOwner,
    ROLLBACK: packet.authorityBoundary.authorities.rollbackOwner,
  };
  if (!packet.nextActions.every((action) => action.authorizationStatus === "OWNER_ONLY_REQUIRED" && action.effectCount === 0 && ids.has(action.evidenceRef) && action.ownerAuthority === actionAuthorities[action.action])) return failure("OWNER_ONLY_ACTION_DENIED");
  if (new Set(packet.nextActions.map((action) => action.action)).size !== actions.length || !actions.every((action) => packet.nextActions.some((item) => item.action === action))) return failure("OWNER_ONLY_ACTION_DENIED");
  const authorities = Object.values(packet.authorityBoundary.authorities);
  if (new Set(authorities).size !== authorities.length || packet.authorityBoundary.importExecutionAuthorized || packet.authorityBoundary.publicationAuthorized || packet.authorityBoundary.promotionAuthorized || packet.authorityBoundary.rollbackAuthorized) return failure("AUTHORITY_ESCALATION_DENIED");
  const publicError = validatePublicClosure(packet.publicClosure);
  if (publicError) return failure(publicError);
  if (!packet.nonValidatedClaims.every((claim) => claim.status === "ABSENT") || !sameJson(packet.nonValidatedClaims.map((claim) => claim.claim), ["TENANT_VALIDATION", "RUNTIME_VALIDATION", "PRODUCTION_VALIDATION", "ENTERPRISE_READINESS", "CLOUD_CONFIGURATION"])) return failure("NONCLAIM_DISPOSITION_DENIED");
  return success(packet);
}

export function applyNegativeCase(packet, caseId) {
  const candidate = structuredClone(packet);
  switch (caseId) {
    case "incomplete-evidence": candidate.evidence.refs.pop(); break;
    case "cross-tuple-mismatch": candidate.fullTuple.components.alm.digest = "f".repeat(64); break;
    case "production-readiness-assertion": candidate.packetStatus = "ENTERPRISE_READY"; break;
    case "unidentified-authority": candidate.authorityBoundary.authorities.importOwner = "unidentified"; break;
    case "omitted-limitation": candidate.limitations.pop(); break;
    case "public-unsafe-material": candidate.publicClosure.planningArtifact.reference = "https://example.invalid/tenant"; break;
    case "capability-as-authority": candidate.authorityBoundary.capabilityBytesGrantAuthority = true; break;
    case "package-as-authority": candidate.authorityBoundary.packageGrantsAuthority = true; break;
    case "no-release-as-authority": candidate.authorityBoundary.noReleaseDecisionGrantsAuthority = true; break;
    case "missing-reset-residue-proof": candidate.resetUninstall.uninstall.ownedResidueCount = 1; break;
    case "missing-policy-generation": candidate.policy.generation = null; break;
    case "missing-rollback-target": candidate.rollback.targetFullTupleDigest = "f".repeat(64); break;
    default: throw new Error(`unknown negative case: ${caseId}`);
  }
  return candidate;
}
export async function loadFixture(fixturePath, base = root) { return JSON.parse(await readFile(path.resolve(base, fixturePath), "utf8")); }

async function main() {
  const args = process.argv.slice(2);
  const inputIndex = args.indexOf("--input");
  const input = inputIndex >= 0 ? args[inputIndex + 1] : undefined;
  const expectInvalid = args.includes("--expect-invalid");
  if (!input || inputIndex < 0 || args.length !== (expectInvalid ? 3 : 2)) {
    console.error("usage: node tools/azure-power-platform/validate-enterprise-profile-evidence.mjs --input <path> [--expect-invalid]");
    process.exitCode = 2;
    return;
  }
  try {
    const result = validateEnterpriseProfileEvidence(await loadFixture(input));
    console.log(JSON.stringify(result.report));
    process.exitCode = result.accepted === !expectInvalid ? 0 : 1;
  } catch {
    console.log(JSON.stringify({ status: "DENIED", reasonCode: "INPUT_DENIED", redacted: true }));
    process.exitCode = expectInvalid ? 0 : 1;
  }
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await main();
