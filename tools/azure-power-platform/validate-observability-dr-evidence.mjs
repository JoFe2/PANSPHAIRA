#!/usr/bin/env node
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import Ajv2020 from "ajv/dist/2020.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const schemaPath = path.join(root, "docs/development/azure-power-platform/observability-dr-evidence.schema.json");
const digestPattern = /^[a-f0-9]{64}$/;
const requiredLimitations = [
  "LOCAL_SYNTHETIC_REPOSITORY_ONLY",
  "OFFLINE_VALIDATOR_ONLY",
  "NO_TELEMETRY_EXPORTER",
  "NO_SERVICE_INTEGRATION",
  "NO_RECOVERY_EXECUTION",
  "NO_PRODUCTION_DR_CLAIM",
  "REDACTED_REPORT_ONLY",
];
const requiredNonClaims = [
  "NOT_A_TELEMETRY_EXPORTER",
  "NOT_A_SERVICE_INTEGRATION",
  "NOT_A_RECOVERY_EXECUTION",
  "NOT_A_PRODUCTION_DR_CLAIM",
];
const requiredNegativeResults = [
  ["RECEIPT_READBACK_MISMATCH", "RECEIPT_READBACK_MISMATCH_DENIED"],
  ["MISSING_EVENT_SEQUENCE", "MISSING_EVENT_SEQUENCE_DENIED"],
  ["ALTERED_DIGEST", "ALTERED_DIGEST_DENIED"],
  ["STALE_POLICY", "STALE_POLICY_DENIED"],
  ["REVOKED_POLICY", "REVOKED_POLICY_DENIED"],
  ["INFERRED_ROLLBACK", "INFERRED_ROLLBACK_DENIED"],
  ["ZERO_RESIDUE_ABSENT", "ZERO_RESIDUE_ABSENT_DENIED"],
  ["MUTABLE_EVIDENCE_REFERENCE", "MUTABLE_EVIDENCE_REFERENCE_DENIED"],
  ["SENSITIVE_IDENTIFIER", "SENSITIVE_IDENTIFIER_DENIED"],
  ["UNSUPPORTED_PRODUCTION_DR_ASSERTION", "UNSUPPORTED_PRODUCTION_DR_ASSERTION_DENIED"],
];

function isObject(value) { return value !== null && typeof value === "object" && !Array.isArray(value); }
function canonicalize(value) {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (isObject(value)) return Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonicalize(value[key])]));
  return value;
}
export function digestJson(value) { return createHash("sha256").update(JSON.stringify(canonicalize(value))).digest("hex"); }
function without(value, key) { const copy = { ...value }; delete copy[key]; return copy; }
function sameJson(left, right) { return JSON.stringify(canonicalize(left)) === JSON.stringify(canonicalize(right)); }
function failure(reasonCode) { return { accepted: false, status: "DENIED", reasonCode, report: { status: "DENIED", reasonCode, redacted: true } }; }
function exactArray(value, expected) { return Array.isArray(value) && value.length === expected.length && value.every((item, index) => item === expected[index]); }

function forbiddenContent(value, key = "") {
  const normalized = key.replace(/[^a-z0-9]/gi, "").toLowerCase();
  const forbiddenKeys = new Map([
    ["tenant", "TENANT_IDENTIFIER_DENIED"], ["tenantid", "TENANT_IDENTIFIER_DENIED"], ["subscription", "TENANT_IDENTIFIER_DENIED"], ["subscriptionid", "TENANT_IDENTIFIER_DENIED"],
    ["identity", "PERSONAL_IDENTITY_DENIED"], ["personalidentity", "PERSONAL_IDENTITY_DENIED"], ["email", "PERSONAL_IDENTITY_DENIED"], ["credential", "CREDENTIAL_DENIED"],
    ["secret", "CREDENTIAL_DENIED"], ["token", "CREDENTIAL_DENIED"], ["password", "CREDENTIAL_DENIED"], ["privatepath", "PRIVATE_PATH_DENIED"],
    ["host", "INTERNAL_HOST_DENIED"], ["hostname", "INTERNAL_HOST_DENIED"], ["internalhost", "INTERNAL_HOST_DENIED"], ["retention", "RETENTION_CLAIM_DENIED"],
    ["rto", "RTO_RPO_CLAIM_DENIED"], ["rpo", "RTO_RPO_CLAIM_DENIED"], ["actualdr", "ACTUAL_DR_ASSERTION_DENIED"], ["actualdrassertion", "ACTUAL_DR_ASSERTION_DENIED"],
  ]);
  if (forbiddenKeys.has(normalized)) return forbiddenKeys.get(normalized);
  if (typeof value === "string") {
    if (/(?:[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,})/i.test(value)) return "PERSONAL_IDENTITY_DENIED";
    if (/(?:bearer\s+|secret:\/\/|api[_-]?key|password=|token=)/i.test(value)) return "CREDENTIAL_DENIED";
    if (/(?:^|\s)(?:\/[^\s]+|[A-Z]:\\[^\s]+|\\\\[^\s]+)/i.test(value)) return "PRIVATE_PATH_DENIED";
    if (/(?:localhost|\.internal\b|\.local\b|internal[-_.]?(?:host|server))/i.test(value)) return "INTERNAL_HOST_DENIED";
    if (/\b(?:retention|rto|rpo)\b/i.test(value)) return /\b(?:rto|rpo)\b/i.test(value) ? "RTO_RPO_CLAIM_DENIED" : "RETENTION_CLAIM_DENIED";
    if (/\b(?:actual\s+(?:dr|disaster recovery)|production\s+(?:dr|recovery)\s+(?:executed|complete))/i.test(value)) return "ACTUAL_DR_ASSERTION_DENIED";
  }
  if (Array.isArray(value)) return value.map((item) => forbiddenContent(item)).find(Boolean);
  if (isObject(value)) return Object.entries(value).map(([childKey, child]) => forbiddenContent(child, childKey)).find(Boolean);
  return undefined;
}

async function validateSchema(candidate) {
  const schema = JSON.parse(await readFile(schemaPath, "utf8"));
  const validator = new Ajv2020({ allErrors: true, strict: true }).compile(schema);
  return validator(candidate);
}
function tuplePayload(candidate) {
  const { component, telemetrySchema, policy, lkg, evidenceDigest } = candidate.tuple;
  return { environmentClass: candidate.environmentClass, component, telemetrySchema, policy, lkg, evidenceDigest };
}
function lkgPayload(lkg) { return { version: lkg.version, digest: lkg.digest, status: lkg.status, revocationState: lkg.revocationState }; }
function operationDigest(value, digestField) { return digestJson(without(value, digestField)); }

function validateEvidence(candidate) {
  const refs = candidate.evidence?.refs;
  if (!Array.isArray(refs) || refs.length === 0) return "EVIDENCE_REFERENCE_DENIED";
  const ids = new Set();
  for (const ref of refs) {
    if (!digestPattern.test(ref.digest) || ref.reference !== `sha256:${ref.digest}` || ids.has(ref.id)) return "MUTABLE_EVIDENCE_REFERENCE_DENIED";
    ids.add(ref.id);
  }
  if (candidate.evidence.bundleDigest !== digestJson({ refs })) return "ALTERED_DIGEST_DENIED";
  if (candidate.tuple.evidenceDigest !== candidate.evidence.bundleDigest) return "ALTERED_DIGEST_DENIED";
  return null;
}
function validateOperation(operation, expectedSequence, candidate) {
  const { event, readback, receipt } = operation;
  if (event.sequence !== expectedSequence || readback.sequence !== expectedSequence + 1 || receipt.sequence !== expectedSequence + 2) return "MISSING_EVENT_SEQUENCE_DENIED";
  if (event.operationId !== readback.operationId || event.operationId !== receipt.operationId) return "RECEIPT_READBACK_MISMATCH_DENIED";
  if (event.outcome !== "ACCEPTED" || readback.source !== "LOCAL_SYNTHETIC_AUTHORITATIVE_READBACK" || readback.status !== "READ_CONFIRMED" || receipt.outcome !== "ACCEPTED_READBACK_BOUND") return "AUTHORITATIVE_READBACK_DENIED";
  if (event.policyGeneration !== candidate.policy.generation || event.policyDigest !== candidate.policy.digest || event.fullTupleDigest !== candidate.tuple.fullTupleDigest) return "STALE_POLICY_DENIED";
  if (event.eventDigest !== operationDigest(event, "eventDigest")) return "ALTERED_DIGEST_DENIED";
  if (readback.eventDigest !== event.eventDigest || readback.fullTupleDigest !== candidate.tuple.fullTupleDigest || readback.readbackDigest !== operationDigest(readback, "readbackDigest")) return "RECEIPT_READBACK_MISMATCH_DENIED";
  if (receipt.eventDigest !== event.eventDigest || receipt.readbackDigest !== readback.readbackDigest || receipt.fullTupleDigest !== candidate.tuple.fullTupleDigest || receipt.receiptDigest !== operationDigest(receipt, "receiptDigest")) return "RECEIPT_READBACK_MISMATCH_DENIED";
  return null;
}
function validateNegativeResults(results, evidenceIds) {
  if (!Array.isArray(results) || results.length !== requiredNegativeResults.length) return "NEGATIVE_RESULTS_DENIED";
  for (let index = 0; index < requiredNegativeResults.length; index += 1) {
    const [caseName, reasonCode] = requiredNegativeResults[index];
    const result = results[index];
    if (!result || result.case !== caseName || result.reasonCode !== reasonCode || result.effectCount !== 0 || !evidenceIds.has(result.evidenceRef)) return "NEGATIVE_RESULTS_DENIED";
  }
  return null;
}
function redactedReport(candidate) {
  return {
    status: "VALIDATED_LOCAL_SYNTHETIC_EVIDENCE",
    environmentClass: candidate.environmentClass,
    policy: { generation: candidate.policy.generation, digest: candidate.policy.digest },
    fullTupleDigest: candidate.tuple.fullTupleDigest,
    recovery: { milestone: candidate.recoveryExercise.milestone, executionClass: candidate.recoveryExercise.executionClass, target: candidate.recoveryExercise.rollbackTarget.target, tupleDigest: candidate.recoveryExercise.rollbackTarget.tupleDigest, zeroOwnedResidue: true },
    limitations: [...candidate.limitations],
    negativeReasonCodes: candidate.negativeResults.map((result) => result.reasonCode),
    evidenceDigests: candidate.evidence.refs.map((ref) => ref.digest),
    nonClaims: [...candidate.nonClaims],
    redacted: true,
  };
}

export async function validateObservabilityDrEvidence(candidate) {
  if (!isObject(candidate)) return failure("SCHEMA_DENIED");
  const sensitive = forbiddenContent(candidate);
  if (sensitive) return failure(sensitive);
  if (candidate.policy?.status === "REVOKED" || candidate.tuple?.policy?.status === "REVOKED" || candidate.tuple?.lkg?.revocationState === "REVOKED") return failure("REVOKED_POLICY_DENIED");
  if (candidate.recoveryExercise?.inferredRollback !== undefined && candidate.recoveryExercise.inferredRollback !== false) return failure("INFERRED_ROLLBACK_DENIED");
  if (candidate.recoveryExercise?.zeroResidue?.ownedResidueCount !== undefined && candidate.recoveryExercise.zeroResidue.ownedResidueCount !== 0) return failure("ZERO_RESIDUE_ABSENT_DENIED");
  if (Array.isArray(candidate.evidence?.refs) && candidate.evidence.refs.some((ref) => !isObject(ref) || typeof ref.digest !== "string" || ref.reference !== `sha256:${ref.digest}`)) return failure("MUTABLE_EVIDENCE_REFERENCE_DENIED");
  if (!(await validateSchema(candidate))) return failure("SCHEMA_DENIED");
  if (!sameJson(candidate.policy, candidate.tuple.policy) || candidate.policy.generation !== 14) return failure("STALE_POLICY_DENIED");
  if (candidate.tuple.lkg.tupleDigest !== digestJson(lkgPayload(candidate.tuple.lkg)) || candidate.tuple.fullTupleDigest !== digestJson(tuplePayload(candidate))) return failure("ALTERED_DIGEST_DENIED");
  const evidenceError = validateEvidence(candidate);
  if (evidenceError) return failure(evidenceError);
  if (!exactArray(candidate.limitations, requiredLimitations) || !exactArray(candidate.nonClaims, requiredNonClaims)) return failure("LIMITATIONS_OR_NONCLAIMS_DENIED");
  if (candidate.operations.length !== 2 || candidate.operations[0].event.kind !== "SYNTHETIC_TELEMETRY_ACCEPT" || candidate.operations[1].event.kind !== "RESET_UNINSTALL") return failure("OPERATION_SET_DENIED");
  for (const [index, operation] of candidate.operations.entries()) {
    const operationError = validateOperation(operation, index * 3 + 1, candidate);
    if (operationError) return failure(operationError);
  }
  const recovery = candidate.recoveryExercise;
  const resetOperation = candidate.operations[1];
  if (recovery.operationId !== resetOperation.event.operationId || recovery.executionClass !== "LOCAL_SYNTHETIC_EXERCISE" || recovery.inferredRollback !== false) return failure("INFERRED_ROLLBACK_DENIED");
  const target = recovery.rollbackTarget;
  const lkg = candidate.tuple.lkg;
  if (target.target !== "EXACT_ACCEPTED_LKG_FULL_TUPLE" || target.version !== lkg.version || target.digest !== lkg.digest || target.tupleDigest !== lkg.tupleDigest || target.status !== lkg.status || target.revocationState !== lkg.revocationState) return failure("EXACT_LKG_TARGET_DENIED");
  const zeroResidue = recovery.zeroResidue;
  if (zeroResidue.ownedResidueCount !== 0 || zeroResidue.ownedResidueProjection.length !== 0 || zeroResidue.ownedResidueProjectionDigest !== digestJson([]) || resetOperation.readback.ownedResidueCount !== 0 || resetOperation.readback.ownedResidueProjectionDigest !== zeroResidue.ownedResidueProjectionDigest) return failure("ZERO_RESIDUE_ABSENT_DENIED");
  const negativeError = validateNegativeResults(candidate.negativeResults, new Set(candidate.evidence.refs.map((ref) => ref.id)));
  if (negativeError) return failure(negativeError);
  return { accepted: true, status: "VALIDATED", reasonCode: "LOCAL_SYNTHETIC_OBSERVABILITY_DR_EVIDENCE_VALIDATED", report: redactedReport(candidate) };
}

export function applyNegativeCase(candidate, caseId) {
  const result = structuredClone(candidate);
  switch (caseId) {
    case "receipt-readback-mismatch": result.operations[0].receipt.readbackDigest = "f".repeat(64); break;
    case "missing-event-sequence": result.operations[1].readback.sequence = 7; break;
    case "altered-digest": result.tuple.component.digest = "f".repeat(64); break;
    case "stale-policy": result.policy.generation = 13; result.tuple.policy.generation = 13; break;
    case "revoked-policy": result.policy.status = "REVOKED"; result.tuple.policy.status = "REVOKED"; break;
    case "inferred-rollback": result.recoveryExercise.inferredRollback = true; break;
    case "absent-zero-residue": result.recoveryExercise.zeroResidue.ownedResidueCount = 1; break;
    case "mutable-evidence-reference": result.evidence.refs[0].reference = "latest"; break;
    case "tenant-identifier": result.tenantId = "synthetic-tenant-001"; break;
    case "personal-identity": result.identity = "synthetic.person@example.test"; break;
    case "credential": result.credential = "Bearer synthetic"; break;
    case "private-path": result.privatePath = "/private/synthetic"; break;
    case "internal-host": result.internalHost = "synthetic.internal"; break;
    case "retention-claim": result.retention = "seven years"; break;
    case "rto-rpo-claim": result.rto = "one hour"; break;
    case "actual-dr-assertion": result.actualDrAssertion = "actual DR completed"; break;
    default: throw new Error(`unknown negative case: ${caseId}`);
  }
  return result;
}
export async function loadFixture(fixturePath, base = root) { return JSON.parse(await readFile(path.resolve(base, fixturePath), "utf8")); }

async function main() {
  const args = process.argv.slice(2);
  const inputIndex = args.indexOf("--input");
  const input = inputIndex >= 0 ? args[inputIndex + 1] : undefined;
  const expectInvalid = args.includes("--expect-invalid");
  if (!input || inputIndex === -1 || args.length !== (expectInvalid ? 3 : 2)) {
    console.error("usage: node tools/azure-power-platform/validate-observability-dr-evidence.mjs --input <path> [--expect-invalid]");
    process.exitCode = 2;
    return;
  }
  try {
    const result = await validateObservabilityDrEvidence(await loadFixture(input));
    console.log(JSON.stringify(result.report));
    process.exitCode = result.accepted === !expectInvalid ? 0 : 1;
  } catch {
    console.log(JSON.stringify({ status: "DENIED", reasonCode: "INPUT_DENIED", redacted: true }));
    process.exitCode = expectInvalid ? 0 : 1;
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await main();
