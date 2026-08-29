#!/usr/bin/env node
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

export const PUBLIC_READBACK_SCHEMA = "pansphaira.asf/public-readback-input/v1";
export const PUBLIC_READBACK_OUTPUT_SCHEMA = "pansphaira.asf/public-readback/v1";
export const LOCAL_AUTHORITY = "LOCAL_DETERMINISTIC_HARNESS_ONLY";
export const NO_RELEASE_STATEMENT = "No protected delivery, release, or public readback occurred.";

const HEX_DIGEST = /^[a-f0-9]{64}$/;
const TRUSTED_LIFECYCLE_DIGESTS = Object.freeze({
  deniedActivation: "44dd8e316dfec00edb9229b23955be93fced250e67e90a8570491c4135864574",
  rollback: "434091c9e7d5dcfdf7e4cf5cedba4d72f4bd6641ead019345a9c3df789846f63",
  success: "48ac37da1240df7db9752ea77597112fa5d5383fe1bdd37b4768be446a513f86",
});
const ALLOWED_CLAIMS = new Set(["VERIFIED_SYNTHETIC_LIFECYCLE_RECEIPTS", "DETERMINISTIC_REDACTION_ONLY"]);
const REQUIRED_NON_CLAIMS = new Set([
  "COMMITTED_EXTERNAL_STATE",
  "EXTERNAL_ACTION",
  "EXPLOIT_EXECUTION",
  "LIVE_PROVIDER_OR_SERVICE",
  "PRODUCTION_ROLLOUT",
  "PUBLIC_READBACK",
  "RELEASE",
  "SECURITY_DISCLOSURE",
  "PROTECTED_DELIVERY",
]);
const SAFE_KEY_EXCEPTIONS = new Set(["lifecycleReceiptDigest", "receiptDigest", "stageReceipts", "noRelease"]);
const DANGEROUS_KEY = /(?:raw|private|secret|credential|token|session|job|host|path|url|link|finding|exploit|payload|vulnerab|cve|external.?action|execute|deliver|publish|deploy)/i;

function canonicalJson(value) {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonicalJson(value[key])}`).join(",")}}`;
}

export function sha256Canonical(value) {
  return createHash("sha256").update(canonicalJson(value), "utf8").digest("hex");
}

function reject(code, detail) {
  throw new Error(`${code}${detail === undefined ? "" : `: ${detail}`}`);
}

function isPlainObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function scanForUnsafeMaterial(value, location = "input") {
  if (Array.isArray(value)) {
    value.forEach((child, index) => scanForUnsafeMaterial(child, `${location}[${index}]`));
    return;
  }
  if (!isPlainObject(value)) {
    if (typeof value === "string" && (/\b(?:https?|ftp):\/\//i.test(value) || /(?:^|[\\/])(?:mnt|tmp|home|var|etc|private)(?:[\\/]|$)/i.test(value) || /\b(?:bearer|ghp_|sk-)\S+/i.test(value))) {
      reject("RAW_SENSITIVE_VALUE", location);
    }
    return;
  }
  for (const [key, child] of Object.entries(value)) {
    if (DANGEROUS_KEY.test(key) && !SAFE_KEY_EXCEPTIONS.has(key)) reject("RAW_SENSITIVE_FIELD", `${location}.${key}`);
    scanForUnsafeMaterial(child, `${location}.${key}`);
  }
}

function requireString(value, location) {
  if (typeof value !== "string" || value.length === 0) reject("MALFORMED_RECEIPT", location);
  return value;
}

function requireDigest(value, location) {
  if (typeof value !== "string" || !HEX_DIGEST.test(value)) reject("MALFORMED_DIGEST", location);
  return value;
}

function requireStringArray(value, location) {
  if (!Array.isArray(value) || value.some((item) => typeof item !== "string" || item.length === 0)) reject("MALFORMED_RECEIPT", location);
}

function validateReceipt(receipt) {
  if (!isPlainObject(receipt)) reject("MISSING_RECEIPT", "receipt");
  for (const key of ["schemaVersion", "authority", "fixtureId", "scenario", "outcome", "reasonCodes", "lifecycleReceiptDigest", "stageReceipts", "state", "receiptDigest"]) {
    if (!(key in receipt)) reject("MISSING_RECEIPT_FIELD", key);
  }
  if (receipt.schemaVersion !== "pansphaira.asf/synthetic-lifecycle/v1" || receipt.authority !== LOCAL_AUTHORITY) reject("UNSUPPORTED_RECEIPT", "schema or authority");
  requireString(receipt.fixtureId, "receipt.fixtureId");
  if (!(receipt.scenario in TRUSTED_LIFECYCLE_DIGESTS) || !["ACCEPTED", "DENIED"].includes(receipt.outcome)) reject("UNSUPPORTED_RECEIPT", "scenario or outcome");
  requireStringArray(receipt.reasonCodes, "receipt.reasonCodes");
  requireDigest(receipt.lifecycleReceiptDigest, "receipt.lifecycleReceiptDigest");
  if (TRUSTED_LIFECYCLE_DIGESTS[receipt.scenario] !== receipt.lifecycleReceiptDigest) reject("UNVERIFIED_RECEIPT", "lifecycle digest is not a checked-in synthetic receipt");
  if (!isPlainObject(receipt.stageReceipts) || Object.keys(receipt.stageReceipts).length === 0) reject("MISSING_RECEIPT", "stageReceipts");
  for (const [stage, digest] of Object.entries(receipt.stageReceipts)) {
    if (!/^[a-z][a-zA-Z0-9-]*$/.test(stage)) reject("UNSUPPORTED_RECEIPT", `stage ${stage}`);
    requireDigest(digest, `stageReceipts.${stage}`);
  }
  if (!isPlainObject(receipt.state) || !Array.isArray(receipt.state.active) || !Array.isArray(receipt.state.installed)) reject("MALFORMED_RECEIPT", "receipt.state");
  for (const collection of [receipt.state.active, receipt.state.installed]) {
    for (const item of collection) {
      if (!isPlainObject(item) || typeof item.generationDigest !== "string" || !HEX_DIGEST.test(item.generationDigest) || typeof item.skillId !== "string" || typeof item.state !== "string" || typeof item.version !== "string") reject("MALFORMED_RECEIPT", "receipt.state item");
    }
  }
  requireDigest(receipt.receiptDigest, "receipt.receiptDigest");
  const { receiptDigest, ...unsigned } = receipt;
  if (sha256Canonical(unsigned) !== receiptDigest) reject("TAMPERED_RECEIPT", "receipt digest mismatch");
}

export function validatePublicReadbackInput(input) {
  if (!isPlainObject(input)) reject("MALFORMED_INPUT", "root");
  scanForUnsafeMaterial(input);
  if (input.schemaVersion !== PUBLIC_READBACK_SCHEMA || input.authority !== LOCAL_AUTHORITY) reject("UNSUPPORTED_INPUT", "schema or authority");
  for (const key of ["fixtureId", "receipt", "lineage", "claims", "nonClaims", "noRelease"]) {
    if (!(key in input)) reject("MISSING_INPUT_FIELD", key);
  }
  requireString(input.fixtureId, "fixtureId");
  validateReceipt(input.receipt);
  if (!Array.isArray(input.lineage) || input.lineage.length === 0) reject("MISSING_LINEAGE", "lineage");
  for (const item of input.lineage) {
    if (!isPlainObject(item) || typeof item.criterion !== "string" || typeof item.receipt !== "string") reject("MALFORMED_LINEAGE", "lineage item");
    requireDigest(item.digest, `lineage.${item.receipt}`);
    if (input.receipt.stageReceipts[item.receipt] !== item.digest) reject("UNVERIFIED_LINEAGE", item.receipt);
  }
  if (!Array.isArray(input.claims) || input.claims.some((claim) => !ALLOWED_CLAIMS.has(claim))) reject("UNSUPPORTED_CLAIM", "claims");
  if (!Array.isArray(input.nonClaims) || ![...REQUIRED_NON_CLAIMS].every((claim) => input.nonClaims.includes(claim))) reject("MISSING_NONCLAIM", "nonClaims");
  if (!isPlainObject(input.noRelease) || input.noRelease.statement !== NO_RELEASE_STATEMENT || input.noRelease.status !== "NOT_CLAIMED" || input.noRelease.evidence !== "LOCAL_SYNTHETIC_ONLY") reject("INVALID_NO_RELEASE_STATEMENT");
  return input;
}

function sorted(values) {
  return [...values].sort((left, right) => left.localeCompare(right));
}

export function renderPublicReadback(input) {
  validatePublicReadbackInput(input);
  const receipt = input.receipt;
  const stageNames = sorted(Object.keys(receipt.stageReceipts));
  return {
    schemaVersion: PUBLIC_READBACK_OUTPUT_SCHEMA,
    authority: LOCAL_AUTHORITY,
    scope: "SYNTHETIC_LOCAL_ONLY",
    redactedDemo: {
      fixtureId: input.fixtureId,
      outcome: receipt.outcome,
      reasonCodes: [...receipt.reasonCodes],
      lifecycleReceiptDigest: receipt.lifecycleReceiptDigest,
      stageReceiptDigests: Object.fromEntries(stageNames.map((stage) => [stage, receipt.stageReceipts[stage]])),
      state: receipt.state,
    },
    recoveryGuide: {
      mode: "RESTORE_EXACT_LKG_OR_DENY",
      trigger: "Any missing, stale, mismatched, tampered, unsafe, or unverified receipt fails closed.",
      readback: "Compare the exact expected synthetic state and receipt digests before recording recovery success.",
      residue: "A failed dry run has no external side effect; do not infer cleanup, delivery, release, or public readback.",
    },
    plannedVersusImplemented: [
      { item: "Deterministic synthetic receipt verification and redacted readback", status: "IMPLEMENTED_LOCAL_ONLY", evidence: "checked-in synthetic lifecycle receipt" },
      { item: "Recovery/nonclaim template", status: "IMPLEMENTED_LOCAL_ONLY", evidence: "this side-effect-free dry run" },
      { item: "Protected delivery, release, or public readback", status: "NOT_IMPLEMENTED_AND_NOT_CLAIMED", evidence: "explicit no-release statement" },
    ],
    noReleaseStatement: NO_RELEASE_STATEMENT,
    lineage: input.lineage.map((item) => ({ criterion: item.criterion, receipt: item.receipt, digest: item.digest })),
  };
}

function main(argv) {
  const fixtureIndex = argv.indexOf("--fixture");
  if (fixtureIndex === -1 || !argv[fixtureIndex + 1] || !argv.includes("--dry-run")) reject("USAGE", "--dry-run --fixture <path> is required");
  const fixturePath = argv[fixtureIndex + 1];
  const input = JSON.parse(readFileSync(fixturePath, "utf8"));
  process.stdout.write(`${JSON.stringify(renderPublicReadback(input), null, 2)}\n`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    main(process.argv.slice(2));
  } catch (error) {
    process.stderr.write(`PUBLIC_READBACK_REJECTED: ${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  }
}
