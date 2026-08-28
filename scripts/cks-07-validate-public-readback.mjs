#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const ROOT = resolve(new URL("..", import.meta.url).pathname);
const DEFAULT_TEMPLATE = resolve(ROOT, "verification/cks-07-public-readback-template-v1.json");
const ENTRYPOINT = "scripts/verify-release-governance.mjs";
const READBACK_COMMAND = ["node", ENTRYPOINT, "--public-readback"];
const PREFLIGHT_COMMAND = ["node", ENTRYPOINT];
const REQUIRED_EVIDENCE = ["LOCAL_RELEASE_GOVERNANCE_PREFLIGHT", "READBACK_ENTRYPOINT_BINDING"];
const EXPECTED_RECEIPT = {
  schemaVersion: "pansphaira.verification/cks-07-public-readback-receipt/v1",
  receiptId: "receipt:cks-07-public-readback-preparation/v1",
  decision: "PREPARED_DRY_RUN_ONLY",
  publicReadback: {
    status: "NOT_EXECUTED",
    reason: "PUBLIC_STATE_EVIDENCE_NOT_COLLECTED",
    activationCondition: "POST_PUBLICATION_WITH_PUBLIC_STATE_EVIDENCE",
    command: READBACK_COMMAND,
    authentication: "ANONYMOUS_GH_TOKEN_UNSET",
  },
  evidence: [
    {
      evidenceId: "LOCAL_RELEASE_GOVERNANCE_PREFLIGHT",
      status: "PASS",
      command: PREFLIGHT_COMMAND,
      result: "RELEASE_GOVERNANCE_PASS",
    },
    {
      evidenceId: "READBACK_ENTRYPOINT_BINDING",
      status: "PASS",
      entrypoint: ENTRYPOINT,
      command: READBACK_COMMAND,
      authentication: "ANONYMOUS_GH_TOKEN_UNSET",
    },
  ],
  failClosed: {
    successRequiresAllRequiredEvidence: true,
    publicReadbackSuccessClaimed: false,
    networkUsed: false,
    credentialUse: false,
    activationBeforePublicStateEvidenceDenied: true,
  },
  nonClaims: [
    "public state exists",
    "anonymous public readback passed",
    "CI",
    "merge",
    "release",
    "deployment",
    "production activation",
  ],
};

const fail = (code) => { throw new Error(`CKS_07_PUBLIC_READBACK_${code}`); };
const assert = (condition, code) => { if (!condition) fail(code); };
const sameJson = (actual, expected) => JSON.stringify(actual) === JSON.stringify(expected);
const readJson = (path) => JSON.parse(readFileSync(path, "utf8"));

function parseArgs(args) {
  assert(args.length === 3 && args[0] === "--template" && args[2] === "--dry-run", "USAGE_EXPECTED_--template_<path>_--dry-run");
  return resolve(args[1]);
}

export function validateTemplate(template) {
  assert(template !== null && typeof template === "object" && !Array.isArray(template), "TEMPLATE_NOT_OBJECT");
  assert(template.schemaVersion === "pansphaira.verification/cks-07-public-readback-template/v1", "TEMPLATE_SCHEMA_INVALID");
  assert(template.templateId === "template:cks-07-public-readback-preparation/v1", "TEMPLATE_ID_INVALID");
  assert(sameJson(template.execution, {
    mode: "DRY_RUN",
    network: "DISABLED",
    publicStateEvidence: "NOT_COLLECTED_BY_DESIGN",
    entrypoint: ENTRYPOINT,
    command: READBACK_COMMAND,
    authentication: "ANONYMOUS_GH_TOKEN_UNSET",
    activationCondition: "POST_PUBLICATION_WITH_PUBLIC_STATE_EVIDENCE",
  }), "EXECUTION_BOUNDARY_INVALID");
  assert(sameJson(template.requiredEvidence, REQUIRED_EVIDENCE), "REQUIRED_EVIDENCE_INVALID");
  assert(sameJson(template.expectedReceipt, EXPECTED_RECEIPT), "EXPECTED_RECEIPT_INVALID");
}

function verifyEntrypointBinding() {
  assert(process.env.GH_TOKEN === undefined, "GH_TOKEN_MUST_BE_UNSET");
  const source = readFileSync(resolve(ROOT, ENTRYPOINT), "utf8");
  for (const requiredSource of [
    "export async function verifyPublicReadback(root = process.cwd()) {",
    "if (process.env.GH_TOKEN && publicReadback) throw new Error(\"PUBLIC_READBACK_REQUIRES_GH_TOKEN_UNSET\");",
    "if (publicReadback) console.log(JSON.stringify(await verifyPublicReadback(process.cwd()), null, 2));",
  ]) assert(source.includes(requiredSource), "READBACK_ENTRYPOINT_UNBOUND");
}

function verifyLocalPreflight() {
  const output = execFileSync(process.execPath, [ENTRYPOINT], {
    cwd: ROOT,
    encoding: "utf8",
    env: process.env,
  }).trim();
  assert(output === "RELEASE_GOVERNANCE_PASS", "LOCAL_PREFLIGHT_FAILED");
}

export function dryRun(templatePath = DEFAULT_TEMPLATE) {
  const template = readJson(templatePath);
  validateTemplate(template);
  verifyEntrypointBinding();
  verifyLocalPreflight();
  return EXPECTED_RECEIPT;
}

if (import.meta.url === new URL(process.argv[1], "file:").href) {
  try {
    const templatePath = parseArgs(process.argv.slice(2));
    process.stdout.write(`${JSON.stringify(dryRun(templatePath), null, 2)}\n`);
  } catch (error) {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 2;
  }
}
