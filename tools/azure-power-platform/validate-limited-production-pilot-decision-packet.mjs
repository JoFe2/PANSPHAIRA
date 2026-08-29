#!/usr/bin/env node
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import Ajv2020 from "ajv/dist/2020.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const SCHEMA_PATH = path.join(ROOT, "docs/development/azure-power-platform/limited-production-pilot-decision-packet.schema.json");
const PACKET_SCHEMA = "pansphaira.azure-power-platform/limited-production-pilot-decision-packet/v1";
const ENVIRONMENT_CLASS = "LOCAL_SYNTHETIC_REPOSITORY_ONLY";
const POLICY_GENERATION = 17;
const DIGEST = /^[a-f0-9]{64}$/;
const VERSION = /^\d+\.\d+\.\d+$/;
const REPOSITORY_REFERENCE = /^(docs|tests|tools|contracts)\/[A-Za-z0-9._/-]+$/;
const EXPECTED_PINS = Object.freeze({
  component: { id: "synthetic-limited-production-pilot", version: "1.0.0", digest: "1111111111111111111111111111111111111111111111111111111111111111" },
  schema: { id: "synthetic-limited-production-pilot-decision-packet", version: "1.0.0", digest: "2222222222222222222222222222222222222222222222222222222222222222" },
  policy: { id: "synthetic-limited-production-pilot-policy", version: "1.0.0", generation: POLICY_GENERATION, digest: "3333333333333333333333333333333333333333333333333333333333333333" },
  tupleDigest: "e087cdf965529b6874d5e3de7ff9782f986da4fc01a15cacec4813beb32f4032",
});
const LIMITATIONS = Object.freeze([
  "LOCAL_SYNTHETIC_REPOSITORY_ONLY", "NO_TENANT_VALIDATION", "NO_SANDBOX_DEPLOYMENT", "NO_PRODUCTION_DATA",
  "NO_CREDENTIAL_USE", "NO_EXTERNAL_MUTATION", "NO_APPROVAL_CLAIM", "NO_RELEASE", "NO_PUBLIC_READBACK",
  "NO_AUTO_PROMOTION", "SEPARATE_OWNER_AUTHORIZATION_REQUIRED", "EXACT_LKG_ROLLBACK_ONLY", "SYNTHETIC_EVIDENCE_ONLY",
]);
const NON_CLAIMS = Object.freeze([
  "NOT_APPROVED", "NOT_DEPLOYED", "NOT_RELEASED", "NOT_PUBLISHED", "NOT_PROMOTED", "NOT_PRODUCTION_READY",
  "NOT_TENANT_VALIDATED", "NOT_A_PUBLIC_READBACK", "NOT_AN_EXECUTION_AUTHORIZATION",
]);
const NEGATIVE_RESULTS = Object.freeze([
  ["MISSING_SANDBOX_EVIDENCE", "SANDBOX_EVIDENCE_DENIED"],
  ["INCOMPLETE_NEGATIVE_RESULTS", "NEGATIVE_EVIDENCE_DENIED"],
  ["PRODUCTION_READINESS_ASSERTION", "PRODUCTION_READINESS_DENIED"],
  ["PRODUCTION_DATA", "PRODUCTION_DATA_DENIED"],
  ["TENANT_IDENTIFIER", "TENANT_IDENTIFIER_DENIED"],
  ["CREDENTIAL_MATERIAL", "CREDENTIAL_MATERIAL_DENIED"],
  ["AUTO_PROMOTION", "AUTO_PROMOTION_DENIED"],
  ["CONFLATED_APPROVER_EXECUTOR", "AUTHORITY_SEPARATION_DENIED"],
  ["MISSING_ROLLBACK_PLAN", "ROLLBACK_TARGET_DENIED"],
  ["MISSING_READBACK_PLAN", "READBACK_PLAN_DENIED"],
  ["APPROVED_WITHOUT_EXTERNAL_AUTHORIZATION", "EXTERNAL_AUTHORIZATION_DENIED"],
  ["EXECUTE_WITHOUT_READBACK", "READBACK_REQUIRED_DENIED"],
  ["PUBLISH_WITHOUT_READBACK", "READBACK_REQUIRED_DENIED"],
  ["PROMOTE_WITHOUT_READBACK", "READBACK_REQUIRED_DENIED"],
]);
const EVIDENCE = Object.freeze([
  ["packet-schema", "docs/development/azure-power-platform/limited-production-pilot-decision-packet.schema.json", "PACKET_SCHEMA"],
  ["offline-validator", "tools/azure-power-platform/validate-limited-production-pilot-decision-packet.mjs", "OFFLINE_VALIDATOR"],
  ["focused-test", "tests/azure-power-platform/limited-production-pilot-decision-packet.test.mjs", "FOCUSED_TEST"],
  ["sandbox-evidence", "tests/azure-power-platform/sandbox-preflight.test.mjs", "SANDBOX_EVIDENCE"],
  ["negative-matrix", "tests/azure-power-platform/readonly-denial-matrix.test.mjs", "NEGATIVE_MATRIX"],
  ["rollback-reference", "tests/fixtures/azure-power-platform/tuple-valid.json", "ROLLBACK_REFERENCE"],
  ["readback-plan", "tests/azure-power-platform/authoritative-readback-receipt.test.mjs", "READBACK_PLAN"],
  ["public-redaction", "tests/azure-power-platform/public-readback.test.mjs", "PUBLIC_REDACTION"],
]);
const AUTHORITY_NAMES = ["decisionOwner", "pilotExecutionOwner", "promotionOwner", "rollbackOwner", "publicReadbackOwner"];

function isObject(value) { return value !== null && typeof value === "object" && !Array.isArray(value); }
function canonicalize(value) {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (isObject(value)) return Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonicalize(value[key])]));
  return value;
}
export function digestJson(value) { return createHash("sha256").update(JSON.stringify(canonicalize(value))).digest("hex"); }
function sameJson(left, right) { return JSON.stringify(canonicalize(left)) === JSON.stringify(canonicalize(right)); }
function failure(reasonCode) {
  return { accepted: false, status: "DENIED", reasonCode, projection: { status: "DENIED", reasonCode, redacted: true } };
}
function success(packet) {
  const projection = {
    schemaVersion: PACKET_SCHEMA,
    status: "CANDIDATE_READBACK",
    packetStatus: packet.packetStatus,
    environmentClass: packet.environmentClass,
    decision: packet.decisionGate.state,
    nextOwnerOnlyDecision: packet.decisionGate.nextOwnerOnlyDecision,
    noDeployment: true,
    approval: "NOT_CLAIMED",
    release: "NOT_RELEASED",
    publication: "NOT_PERFORMED",
    promotion: "NOT_PERFORMED",
    exactPins: packet.exactPins,
    policyGeneration: packet.exactPins.policy.generation,
    evidenceRefs: packet.evidence.refs.map((ref) => ({ id: ref.id, reference: ref.reference, digest: ref.digest })),
    limitations: [...packet.limitations],
    negativeResults: packet.negativeResults.map(({ case: caseName, reasonCode, outcome, effectCount }) => ({ case: caseName, reasonCode, outcome, effectCount })),
    rollback: { target: packet.rollback.target, targetTupleDigest: packet.rollback.targetTupleDigest, targetStatus: packet.rollback.targetStatus, authorization: packet.rollback.authorization },
    redacted: true,
  };
  return { accepted: true, status: "VALIDATED", reasonCode: "LIMITED_PRODUCTION_PILOT_DECISION_PACKET_VALIDATED", projection };
}

const FORBIDDEN_KEY = /^(tenant|subscription|credential|secret|password|accesstoken|privatepath|endpoint|host|principal|email|rawpayload)(?:id|identifier|name|reference|material|value)?$/i;
const FORBIDDEN_TEXT = /(?:https?:\/\/|secret:\/\/|bearer\s+|\/tmp\/|\/home\/|\\\\|\b(?:tenant|subscription|environment)\s*(?:id|identifier|name)\b|production\s+ready|credential\s+used)/i;
function containsUnsafeMaterial(value, key = "") {
  const normalizedKey = key.replace(/[^a-z0-9]/gi, "");
  if (FORBIDDEN_KEY.test(normalizedKey)) return true;
  if (typeof value === "string" && FORBIDDEN_TEXT.test(value)) return true;
  if (Array.isArray(value)) return value.some((item) => containsUnsafeMaterial(item));
  if (isObject(value)) return Object.entries(value).some(([childKey, child]) => containsUnsafeMaterial(child, childKey));
  return false;
}
function evidenceMap(packet) { return new Map(packet.evidence?.refs?.map((ref) => [ref.id, ref]) ?? []); }
function normalizeCase(caseId) { return String(caseId).replace(/-/g, "_").toUpperCase(); }

function validateEvidence(packet, ids) {
  if (!Array.isArray(packet.evidence?.refs) || packet.evidence.refs.length !== EVIDENCE.length) return "INCOMPLETE_EVIDENCE_DENIED";
  for (let index = 0; index < EVIDENCE.length; index += 1) {
    const [id, reference, purpose] = EVIDENCE[index];
    const ref = packet.evidence.refs[index];
    if (!ref || ref.id !== id || ref.reference !== reference || ref.purpose !== purpose || ref.immutable !== true || !DIGEST.test(ref.digest) || !REPOSITORY_REFERENCE.test(ref.reference)) return "IMMUTABLE_EVIDENCE_REFERENCE_DENIED";
  }
  if (packet.evidence.bundleDigest !== digestJson(packet.evidence.refs)) return "EVIDENCE_DIGEST_DENIED";
  const referencedIds = [
    ...packet.sandboxEvidence.evidenceRefs,
    ...packet.negativeResults.map((result) => result.evidenceRef),
    packet.rollback.evidenceRef,
    "packet-schema", "offline-validator", "focused-test", "readback-plan", "public-redaction",
  ];
  if (referencedIds.some((id) => !ids.has(id))) return "UNRESOLVED_EVIDENCE_REFERENCE_DENIED";
  return null;
}
function validateNegativeResults(packet, ids) {
  if (!Array.isArray(packet.negativeResults) || packet.negativeResults.length !== NEGATIVE_RESULTS.length) return "NEGATIVE_EVIDENCE_DENIED";
  for (let index = 0; index < NEGATIVE_RESULTS.length; index += 1) {
    const [caseName, reasonCode] = NEGATIVE_RESULTS[index];
    const result = packet.negativeResults[index];
    if (!result || result.case !== caseName || result.outcome !== "DENY" || result.reasonCode !== reasonCode || result.effectCount !== 0 || !ids.has(result.evidenceRef)) return "NEGATIVE_EVIDENCE_DENIED";
  }
  return null;
}

export function validatePacket(packet) {
  if (!isObject(packet)) return failure("SCHEMA_DENIED");
  if (containsUnsafeMaterial(packet)) return failure("PUBLIC_UNSAFE_MATERIAL_DENIED");
  if (!Object.hasOwn(packet, "sandboxEvidence")) return failure("SANDBOX_EVIDENCE_DENIED");
  if (!Object.hasOwn(packet, "negativeResults")) return failure("NEGATIVE_EVIDENCE_DENIED");
  if (!Object.hasOwn(packet, "rollback")) return failure("ROLLBACK_TARGET_DENIED");
  if (!Object.hasOwn(packet, "readbackPlan")) return failure("READBACK_PLAN_DENIED");
  if (packet.packetStatus !== "DECISION_READY_INACTIVE" || packet.environmentClass !== ENVIRONMENT_CLASS) return failure("PRODUCTION_READINESS_DENIED");
  if (packet.decisionGate?.state !== "UNDECIDED" || packet.decisionGate?.selectedOption !== null) return failure("EXTERNAL_AUTHORIZATION_DENIED");
  if (packet.decisionGate?.ownerDecision?.status !== "PENDING_SEPARATELY_AUTHORIZED_OWNER_DECISION" || packet.decisionGate?.ownerDecision?.externalAuthorizationRequired !== true || packet.decisionGate?.ownerDecision?.authorizationReference !== null || packet.decisionGate?.ownerDecision?.authorizationDigest !== null) return failure("EXTERNAL_AUTHORIZATION_DENIED");
  if (packet.authorityBoundary?.automaticPromotion === true || packet.promotionGate?.automatic === true) return failure("AUTO_PROMOTION_DENIED");
  if (packet.sandboxEvidence?.productionDataObserved === true) return failure("PRODUCTION_DATA_DENIED");
  if (packet.authorityBoundary?.approverMayExecute === true || packet.authorityBoundary?.executorMayPromote === true) return failure("AUTHORITY_SEPARATION_DENIED");
  if (packet.decisionGate?.state === "APPROVED" || packet.executionGate?.status !== "BLOCKED_OWNER_DECISION" || packet.promotionGate?.status !== "BLOCKED_OWNER_DECISION") return failure("EXTERNAL_AUTHORIZATION_DENIED");
  if (packet.executionGate?.readbackRequired !== true || packet.executionGate?.readbackPresent !== false || packet.promotionGate?.readbackRequired !== true || packet.promotionGate?.readbackPresent !== false) return failure("READBACK_REQUIRED_DENIED");
  const negativeError = validateNegativeResults(packet, evidenceMap(packet));
  if (negativeError) return failure(negativeError);

  const schema = globalThis.__limitedPilotSchema;
  if (!schema) return failure("SCHEMA_DENIED");
  if (!schema(packet)) return failure("SCHEMA_DENIED");
  if (!sameJson(packet.exactPins, EXPECTED_PINS)) return failure("DIGEST_BINDING_DENIED");
  if (packet.exactPins.tupleDigest !== digestJson({ component: packet.exactPins.component, schema: packet.exactPins.schema, policy: packet.exactPins.policy })) return failure("DIGEST_BINDING_DENIED");
  if (!sameJson(packet.limitations, LIMITATIONS) || !sameJson(packet.nonClaims, NON_CLAIMS)) return failure("LIMITATION_MISSING_DENIED");
  if (packet.sandboxEvidence.status !== "VALIDATED_OFFLINE" || packet.sandboxEvidence.evidenceClass !== ENVIRONMENT_CLASS || packet.sandboxEvidence.environmentClass !== ENVIRONMENT_CLASS || packet.sandboxEvidence.deploymentPerformed !== false || packet.sandboxEvidence.productionDataObserved !== false || packet.sandboxEvidence.externalContact !== false) return failure("SANDBOX_EVIDENCE_DENIED");
  const authorities = packet.authorityBoundary.authorities;
  if (!packet.authorityBoundary.authoritiesAreDistinct || new Set(AUTHORITY_NAMES.map((name) => authorities[name])).size !== AUTHORITY_NAMES.length) return failure("AUTHORITY_SEPARATION_DENIED");
  if (packet.authorityBoundary.externalAuthorizationPresent || packet.authorityBoundary.executionAuthorized || packet.authorityBoundary.publicationAuthorized || packet.authorityBoundary.promotionAuthorized) return failure("EXTERNAL_AUTHORIZATION_DENIED");
  if (packet.rollback.targetTupleDigest !== EXPECTED_PINS.tupleDigest || packet.rollback.authorization !== "OWNER_ONLY_REQUIRED" || packet.rollback.executionStatus !== "RECORDED_NOT_EXECUTED" || packet.rollback.partialRollbackAllowed || packet.rollback.latestVersionFallbackAllowed) return failure("ROLLBACK_TARGET_DENIED");
  if (packet.readbackPlan.status !== "PENDING_OWNER_READBACK" || packet.readbackPlan.ownerOnlyDecision !== "AUTHORIZE_OR_DECLINE_LIMITED_PRODUCTION_PILOT" || packet.readbackPlan.reference !== null || packet.readbackPlan.digest !== null) return failure("READBACK_PLAN_DENIED");
  const evidenceError = validateEvidence(packet, evidenceMap(packet));
  if (evidenceError) return failure(evidenceError);
  if (packet.publicRedaction.digest !== digestJson({ ...packet.publicRedaction, digest: undefined })) return failure("PUBLIC_REDACTION_DENIED");
  return success(packet);
}

export function applyNegativeCase(packet, caseId) {
  const candidate = structuredClone(packet);
  switch (normalizeCase(caseId)) {
    case "MISSING_SANDBOX_EVIDENCE": delete candidate.sandboxEvidence; break;
    case "INCOMPLETE_NEGATIVE_RESULTS": candidate.negativeResults.pop(); break;
    case "PRODUCTION_READINESS_ASSERTION": candidate.packetStatus = "PRODUCTION_READY"; break;
    case "PRODUCTION_DATA": candidate.sandboxEvidence.productionDataObserved = true; break;
    case "TENANT_IDENTIFIER": candidate.tenantId = "synthetic-tenant"; break;
    case "CREDENTIAL_MATERIAL": candidate.credential = "synthetic-credential"; break;
    case "AUTO_PROMOTION": candidate.authorityBoundary.automaticPromotion = true; break;
    case "CONFLATED_APPROVER_EXECUTOR": candidate.authorityBoundary.authorities.pilotExecutionOwner = candidate.authorityBoundary.authorities.decisionOwner; break;
    case "MISSING_ROLLBACK_PLAN": delete candidate.rollback; break;
    case "MISSING_READBACK_PLAN": delete candidate.readbackPlan; break;
    case "APPROVED_WITHOUT_EXTERNAL_AUTHORIZATION": candidate.decisionGate.state = "APPROVED"; break;
    case "EXECUTE_WITHOUT_READBACK": candidate.executionGate.readbackRequired = false; break;
    case "PUBLISH_WITHOUT_READBACK": candidate.publicRedaction.publication = "PUBLISHED"; break;
    case "PROMOTE_WITHOUT_READBACK": candidate.promotionGate.readbackPresent = true; break;
    default: throw new Error(`unknown negative case: ${caseId}`);
  }
  return candidate;
}

export async function loadFixture(fixturePath, base = ROOT) {
  return JSON.parse(await readFile(path.resolve(base, fixturePath), "utf8"));
}

async function initializeSchemaValidator() {
  const schema = JSON.parse(await readFile(SCHEMA_PATH, "utf8"));
  const ajv = new Ajv2020({ allErrors: true, strict: true });
  const validate = ajv.compile(schema);
  globalThis.__limitedPilotSchema = validate;
  return validate;
}

async function main() {
  const args = process.argv.slice(2);
  const inputIndex = args.indexOf("--input");
  const input = inputIndex >= 0 ? args[inputIndex + 1] : undefined;
  const expectInvalid = args.includes("--expect-invalid");
  if (!input || inputIndex < 0 || args.length !== (expectInvalid ? 3 : 2)) {
    console.error("usage: node tools/azure-power-platform/validate-limited-production-pilot-decision-packet.mjs --input <path> [--expect-invalid]");
    process.exitCode = 2;
    return;
  }
  try {
    await initializeSchemaValidator();
    const result = validatePacket(await loadFixture(input));
    console.log(JSON.stringify(result.projection));
    process.exitCode = result.accepted === !expectInvalid ? 0 : 1;
  } catch {
    console.log(JSON.stringify({ status: "DENIED", reasonCode: "INPUT_DENIED", redacted: true }));
    process.exitCode = expectInvalid ? 0 : 1;
  }
}

await initializeSchemaValidator();
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await main();

export { EVIDENCE, EXPECTED_PINS, LIMITATIONS, NEGATIVE_RESULTS, NON_CLAIMS };
