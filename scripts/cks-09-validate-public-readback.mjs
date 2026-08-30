#!/usr/bin/env node
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const TASK_ID = "INT-PSAI289-PUBLIC-READBACK-HARNESS-01";
const TEMPLATE_SCHEMA_VERSION = "pansphaira.cks/public-readback-evidence-template/v1";
const EVIDENCE_SCHEMA_VERSION = "pansphaira.cks/public-readback-evidence/v1";
const RECEIPT_SCHEMA_VERSION = "pansphaira.cks/public-readback-validation-receipt/v1";
const TEMPLATE_PATH = join(ROOT, "verification/cks-09-public-readback-template-v1.json");
const DECISION_IDS = ["D-001", "D-002", "D-003", "D-004", "D-005", "D-006", "D-007"];
const REQUIRED_EVIDENCE = [
  "anonymousCapture",
  "authorizationHeaderAbsent",
  "credentialMaterialAbsent",
  "rawPayloadNotRetained",
  "procedureContentAbsent",
  "expectedPublicRecordBinding",
  "observedPublicRecordBinding",
  "responseDigest",
];

function isRecord(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value) && Object.getPrototypeOf(value) === Object.prototype;
}

function exactKeys(value, keys) {
  return isRecord(value)
    && Object.keys(value).length === keys.length
    && keys.every((key) => Object.hasOwn(value, key));
}

function canonicalJson(value) {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  if (isRecord(value)) return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonicalJson(value[key])}`).join(",")}}`;
  return JSON.stringify(value);
}

export function digest(value) {
  return `sha256:${createHash("sha256").update(canonicalJson(value)).digest("hex")}`;
}

function isSha256(value) {
  return typeof value === "string" && /^sha256:[a-f0-9]{64}$/.test(value);
}

function isPublicRecordId(value) {
  return typeof value === "string" && /^[A-Za-z0-9][A-Za-z0-9._:-]{2,127}$/.test(value);
}

function validProcess(process) {
  return exactKeys(process, ["operatingModel", "preservedDecisionIds", "processVariantIntroduced"])
    && process.operatingModel === "v1.1"
    && Array.isArray(process.preservedDecisionIds)
    && process.preservedDecisionIds.length === DECISION_IDS.length
    && process.preservedDecisionIds.every((id, index) => id === DECISION_IDS[index])
    && process.processVariantIntroduced === false;
}

function validTemplate(input) {
  return exactKeys(input, [
    "schemaVersion", "recordKind", "taskId", "captureState", "process", "requiredEvidence", "privacyBoundary", "nonClaims",
  ])
    && input.schemaVersion === TEMPLATE_SCHEMA_VERSION
    && input.recordKind === "PUBLIC_READBACK_EVIDENCE_TEMPLATE"
    && input.taskId === TASK_ID
    && input.captureState === "NOT_CAPTURED"
    && validProcess(input.process)
    && Array.isArray(input.requiredEvidence)
    && input.requiredEvidence.length === REQUIRED_EVIDENCE.length
    && input.requiredEvidence.every((id, index) => id === REQUIRED_EVIDENCE[index])
    && exactKeys(input.privacyBoundary, ["networkPerformedByValidator", "externalStateChanged", "retainedFields", "prohibitedFields"])
    && input.privacyBoundary.networkPerformedByValidator === false
    && input.privacyBoundary.externalStateChanged === false
    && Array.isArray(input.privacyBoundary.retainedFields)
    && Array.isArray(input.privacyBoundary.prohibitedFields)
    && Array.isArray(input.nonClaims)
    && input.nonClaims.length > 0;
}

function validEvidence(input) {
  if (!exactKeys(input, ["schemaVersion", "recordKind", "taskId", "captureState", "capture", "expected", "observed"])) {
    return "EVIDENCE_SHAPE_DENIED";
  }
  if (input.schemaVersion !== EVIDENCE_SCHEMA_VERSION || input.recordKind !== "ANONYMOUS_PUBLIC_READBACK_EVIDENCE" || input.taskId !== TASK_ID || input.captureState !== "CAPTURED") {
    return "EVIDENCE_IDENTITY_DENIED";
  }
  if (!exactKeys(input.capture, ["anonymous", "authorizationHeaderPresent", "credentialMaterialObserved", "rawPayloadRetained", "procedureContentReturned", "networkPerformed", "externalStateChanged"])) {
    return "CAPTURE_BOUNDARY_DENIED";
  }
  if (input.capture.anonymous !== true || input.capture.authorizationHeaderPresent !== false || input.capture.credentialMaterialObserved !== false
    || input.capture.rawPayloadRetained !== false || input.capture.procedureContentReturned !== false
    || input.capture.networkPerformed !== true || input.capture.externalStateChanged !== false) {
    return "CAPTURE_BOUNDARY_DENIED";
  }
  if (!exactKeys(input.expected, ["publicRecordId", "publicRecordDigest"]) || !isPublicRecordId(input.expected.publicRecordId) || !isSha256(input.expected.publicRecordDigest)) {
    return "EXPECTED_BINDING_DENIED";
  }
  if (!exactKeys(input.observed, ["publicRecordId", "publicRecordDigest", "statusCode", "responseDigest"]) || !isPublicRecordId(input.observed.publicRecordId)
    || !isSha256(input.observed.publicRecordDigest) || !Number.isInteger(input.observed.statusCode) || input.observed.statusCode < 200 || input.observed.statusCode > 299
    || !isSha256(input.observed.responseDigest)) {
    return "OBSERVED_BINDING_DENIED";
  }
  if (input.expected.publicRecordId !== input.observed.publicRecordId || input.expected.publicRecordDigest !== input.observed.publicRecordDigest) {
    return "PUBLIC_RECORD_MISMATCH";
  }
  return null;
}

function receipt(body) {
  return { ...body, canonicalDigest: digest(body) };
}

function baseReceipt(inputDigest) {
  return {
    schemaVersion: RECEIPT_SCHEMA_VERSION,
    recordKind: "DETERMINISTIC_DECISION_AND_INTEGRATION_RECEIPT",
    taskId: TASK_ID,
    process: {
      operatingModel: "v1.1",
      preservedDecisionIds: DECISION_IDS,
      processVariantIntroduced: false,
    },
    executionBoundary: {
      dryRunOnly: true,
      networkPerformedByValidator: false,
      externalStateChanged: false,
      publicationMergeOrReleasePerformed: false,
      authorityGranted: false,
    },
    inputDigest,
    nonClaims: [
      "The validator does not perform a network request, mutate public state, or infer public state from local repository state.",
      "Validator readiness is not a public-readback success claim.",
      "No public-readback success is claimed without complete, anonymous, privacy-safe, expected-to-observed evidence bindings.",
    ],
  };
}

/**
 * Validate only an externally captured, privacy-safe evidence projection. This function never
 * fetches, retains a raw payload, accepts credentials, or changes external state.
 */
export function validatePublicReadback(input) {
  const inputDigest = digest(input);
  if (validTemplate(input)) {
    return receipt({
      ...baseReceipt(inputDigest),
      validatorVerdict: "PASS",
      publicReadbackVerdict: "INCONCLUSIVE",
      successClaimed: false,
      reasons: ["PUBLIC_STATE_NOT_CAPTURED"],
      evidence: { captureState: "NOT_CAPTURED", requiredEvidence: REQUIRED_EVIDENCE },
    });
  }

  const reason = validEvidence(input);
  if (reason !== null) {
    return receipt({
      ...baseReceipt(inputDigest),
      validatorVerdict: "DENIED",
      publicReadbackVerdict: "DENIED",
      successClaimed: false,
      reasons: [reason],
      evidence: { captureState: isRecord(input) && typeof input.captureState === "string" ? input.captureState : "INVALID", requiredEvidence: REQUIRED_EVIDENCE },
    });
  }

  return receipt({
    ...baseReceipt(inputDigest),
    validatorVerdict: "PASS",
    publicReadbackVerdict: "PASS",
    successClaimed: true,
    reasons: [],
    evidence: {
      captureState: "CAPTURED",
      expectedPublicRecordDigest: input.expected.publicRecordDigest,
      observedResponseDigest: input.observed.responseDigest,
      statusCode: input.observed.statusCode,
    },
  });
}

function parseArgs(argv) {
  const evidenceIndex = argv.indexOf("--evidence");
  return {
    dryRun: argv.includes("--dry-run"),
    help: argv.includes("--help"),
    evidencePath: evidenceIndex >= 0 ? argv[evidenceIndex + 1] : TEMPLATE_PATH,
    malformed: evidenceIndex >= 0 && argv[evidenceIndex + 1] === undefined,
  };
}

export function main(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (args.help || args.malformed || !args.dryRun) {
    process.stdout.write("Usage: node scripts/cks-09-validate-public-readback.mjs --dry-run [--evidence <privacy-safe-evidence.json>]\n");
    process.exitCode = args.help ? 0 : 2;
    return;
  }
  let input;
  try {
    input = JSON.parse(readFileSync(resolve(args.evidencePath), "utf8"));
  } catch {
    input = null;
  }
  const result = validatePublicReadback(input);
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  process.exitCode = result.validatorVerdict === "DENIED" ? 1 : 0;
}

if (process.argv[1] !== undefined && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();

export { EVIDENCE_SCHEMA_VERSION, RECEIPT_SCHEMA_VERSION, REQUIRED_EVIDENCE, TASK_ID, TEMPLATE_PATH };
