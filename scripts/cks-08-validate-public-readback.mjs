#!/usr/bin/env node
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const CKS_08_PUBLIC_READBACK_TEMPLATE_SCHEMA_V1 = "chimpmaera.verification/cks-08-public-readback-template/v1";
export const CKS_08_PUBLIC_READBACK_RECEIPT_SCHEMA_V1 = "chimpmaera.verification/cks-08-public-readback-receipt/v1";
const ROOT = resolve(fileURLToPath(new URL("..", import.meta.url)));
const TEMPLATE_PATH = "verification/cks-08-public-readback-template-v1.json";
const REQUIRED_EVIDENCE = ["RELEASE_METADATA", "LATEST_RELEASE", "TAG_REFERENCE", "PUBLIC_ASSET_SET_AND_DIGESTS", "PUBLIC_MAIN_SURFACES"];
const DECISIONS = ["D-001", "D-002", "D-003", "D-004", "D-005", "D-006", "D-007"];
const TEMPLATE_KEYS = ["schemaVersion", "templateId", "taskId", "claimBoundary", "processContext", "precondition", "requiredEvidence", "privacy", "templateDigest"];

const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");
const exactKeys = (value, expected) => value !== null && typeof value === "object" && !Array.isArray(value)
  && JSON.stringify(Object.keys(value).sort()) === JSON.stringify([...expected].sort());

export function canonicalJson(value) {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  if (value !== null && typeof value === "object") {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonicalJson(value[key])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

export function canonicalDigest(value, omittedKey) {
  const copy = structuredClone(value);
  delete copy[omittedKey];
  return sha256(canonicalJson(copy));
}

function deny(message) {
  throw new Error(`CKS-08 public-readback validator denied: ${message}`);
}

export function validatePublicReadbackTemplate(template) {
  if (!exactKeys(template, TEMPLATE_KEYS)) deny("template shape denied");
  if (template.schemaVersion !== CKS_08_PUBLIC_READBACK_TEMPLATE_SCHEMA_V1) deny("template schema denied");
  if (template.templateId !== "template:cks-08-public-readback-v1") deny("template identity denied");
  if (template.taskId !== "INT-PSAI288-PUBLIC-READBACK-HARNESS-01") deny("task binding denied");
  if (template.claimBoundary !== "PREPUBLICATION_LOCAL_DETERMINISTIC_VALIDATOR_PREPARATION_ONLY_NO_NETWORK_NO_PUBLICATION_NO_GITHUB_MUTATION_NO_TELEMETRY_NO_RAW_PUBLIC_CONTENT_NO_PRODUCTION") deny("claim boundary denied");
  if (!exactKeys(template.processContext, ["operatingModel", "priorDecisions", "disposition", "processVariantCreated"])
    || template.processContext.operatingModel !== "Operating Model v1.1"
    || JSON.stringify(template.processContext.priorDecisions) !== JSON.stringify(DECISIONS)
    || template.processContext.disposition !== "PRESERVED_NO_OVERRIDE"
    || template.processContext.processVariantCreated !== false) deny("process context denied");
  if (!exactKeys(template.precondition, ["publicStateExists", "publicationAuthorized", "anonymousCredentialsRequired", "networkAllowedDuringDryRun"])
    || template.precondition.publicStateExists !== false
    || template.precondition.publicationAuthorized !== false
    || template.precondition.anonymousCredentialsRequired !== true
    || template.precondition.networkAllowedDuringDryRun !== false) deny("prepublication boundary denied");
  if (JSON.stringify(template.requiredEvidence) !== JSON.stringify(REQUIRED_EVIDENCE)) deny("required evidence set denied");
  if (!exactKeys(template.privacy, ["rawPublicContentEmitted", "credentialsOrPersonalDataEmitted", "allowedReceiptFields"])
    || template.privacy.rawPublicContentEmitted !== false
    || template.privacy.credentialsOrPersonalDataEmitted !== false
    || JSON.stringify(template.privacy.allowedReceiptFields) !== JSON.stringify(["bounded status", "evidence identifiers", "non-sensitive digests", "reason codes"])) deny("privacy boundary denied");
  if (!/^[a-f0-9]{64}$/.test(template.templateDigest) || canonicalDigest(template, "templateDigest") !== template.templateDigest) deny("template digest denied");
  return true;
}

export function renderPublicReadbackDryRun(template, templateBytes = canonicalJson(template)) {
  validatePublicReadbackTemplate(template);
  const receipt = {
    schemaVersion: CKS_08_PUBLIC_READBACK_RECEIPT_SCHEMA_V1,
    receiptId: "receipt:cks-08-public-readback-dry-run-v1",
    taskId: template.taskId,
    recordStatus: "TECHNICALLY_COMPLETE_PREPUBLICATION",
    status: "PREPARED_DRY_RUN",
    claimBoundary: template.claimBoundary,
    processContext: template.processContext,
    inputBinding: {
      templatePath: TEMPLATE_PATH,
      templateSha256: sha256(templateBytes),
      templateCanonicalDigest: template.templateDigest
    },
    execution: {
      mode: "DRY_RUN",
      networkCalls: 0,
      externalStateMutated: false,
      credentialsRead: false
    },
    publicReadback: {
      state: "NOT_EXECUTED_PRE_PUBLIC_STATE",
      requiredEvidence: template.requiredEvidence.map((evidenceId) => ({ evidenceId, state: "PENDING_PUBLIC_STATE" })),
      requiredEvidencePresent: false,
      readbackExecuted: false,
      readbackSuccessClaimed: false
    },
    privacy: {
      rawPublicContentEmitted: false,
      credentialsOrPersonalDataEmitted: false,
      emittedFields: template.privacy.allowedReceiptFields
    },
    failClosed: {
      successWithoutRequiredEvidence: false,
      publicReadbackAuthorized: false,
      rule: "A public-readback success claim requires all required evidence from an authorized public state; missing, pending, unknown, or mismatched evidence is denied."
    }
  };
  return { ...receipt, receiptDigest: canonicalDigest(receipt, "receiptDigest") };
}

function parseArgs(args) {
  const expected = ["--template", TEMPLATE_PATH, "--dry-run"];
  if (JSON.stringify(args) !== JSON.stringify(expected)) deny(`usage: node scripts/cks-08-validate-public-readback.mjs --template ${TEMPLATE_PATH} --dry-run`);
  return { templatePath: TEMPLATE_PATH };
}

const invoked = process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url));
if (invoked) {
  try {
    const { templatePath } = parseArgs(process.argv.slice(2));
    if (process.env.GH_TOKEN) deny("anonymous credential boundary denied");
    const bytes = readFileSync(resolve(ROOT, templatePath));
    const receipt = renderPublicReadbackDryRun(JSON.parse(bytes.toString("utf8")), bytes);
    process.stdout.write(`${JSON.stringify(receipt, null, 2)}\n`);
  } catch (error) {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  }
}
