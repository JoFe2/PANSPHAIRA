#!/usr/bin/env node
import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { lstatSync, readFileSync, realpathSync, writeFileSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import Ajv2020 from "ajv/dist/2020.js";

const MANIFEST_PATH = "security/secure-default-proof-v1.json";
const EVIDENCE_PATH = "security/secure-default-proof-evidence-v1.json";
const SCHEMA_PATH = "schemas/security/secure-default-proof-v1.schema.json";
const REQUIRED_CLAIMS = [
  "CM-SD-001", "CM-SD-002", "CM-SD-003", "CM-SD-004", "CM-SD-005",
  "CM-SD-006", "CM-SD-007", "CM-SD-008", "CM-SD-009", "CM-SD-010",
  "CM-SD-011", "CM-SD-012", "CM-SD-NC-001",
];
const PRIVATE_PATTERNS = [
  /\/home\/[A-Za-z0-9._-]+(?:\/|\b)/,
  /\/mnt\/[A-Za-z0-9._-]+(?:\/|\b)/,
  /https?:\/\/[^/\s:@]+:[^/\s@]+@/,
  /\bgh[pousr]_[A-Za-z0-9]{20,}\b/,
  /\bsk-[A-Za-z0-9_-]{20,}\b/,
  /\bhf_[A-Za-z0-9]{20,}\b/,
  /\b[0-9]{8,12}:[A-Za-z0-9_-]{30,}\b/,
];
const UNIVERSAL_CLAIM = /\b(?:production[- ]ready|universally secure|universal security|unhackable|absolute(?:ly)? safe|hostile[- ]host resistant|all profiles (?:are|remain) secure)\b/i;

export function canonicalJson(value) {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  if (value !== null && typeof value === "object") {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonicalJson(value[key])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

const sha256 = (value) => createHash("sha256").update(value).digest("hex");
const add = (issues, condition, code) => { if (!condition) issues.push(code); };

function readJson(root, relative, missingCode, issues) {
  try {
    return JSON.parse(readFileSync(path.join(root, relative), "utf8"));
  } catch {
    issues.push(missingCode);
    return null;
  }
}

function safeRelative(relative) {
  return typeof relative === "string"
    && relative.length > 0
    && !path.isAbsolute(relative)
    && !relative.includes("\\")
    && !relative.includes("\0")
    && relative === relative.normalize("NFC")
    && relative.split("/").every((part) => part && part !== "." && part !== "..");
}

function safeFile(root, relative) {
  if (!safeRelative(relative)) return null;
  let current = root;
  try {
    for (const part of relative.split("/")) {
      current = path.join(current, part);
      if (lstatSync(current).isSymbolicLink()) return null;
    }
    if (!lstatSync(current).isFile()) return null;
    const canonical = realpathSync(current);
    const fromRoot = path.relative(realpathSync(root), canonical);
    if (fromRoot === ".." || fromRoot.startsWith(`..${path.sep}`) || path.isAbsolute(fromRoot)) return null;
    return current;
  } catch {
    return null;
  }
}

function publicPaths(root, issues) {
  try {
    return new Set(readFileSync(path.join(root, "release/public-files.manifest"), "utf8")
      .split("\n").filter((line) => line && !line.startsWith("#")).map((line) => line.split("\t")[0]));
  } catch {
    issues.push("PUBLIC_MANIFEST_MISSING_DENIED");
    return new Set();
  }
}

function expectedReportCore(manifest, manifestDigest) {
  const artifacts = [...manifest.artifacts]
    .map(({ path: artifactPath, sha256: digest }) => ({ path: artifactPath, sha256: digest }))
    .sort((left, right) => left.path.localeCompare(right.path, "en"));
  return {
    schemaVersion: "chimpmaera.security/secure-default-proof-evidence/v1",
    proofId: manifest.proofId,
    profile: manifest.profile,
    evidenceState: "CURRENT",
    manifestDigest,
    schemaDigest: manifest.schemaBinding.sha256,
    verifierDigest: manifest.verifier.sha256,
    inputSetDigest: sha256(canonicalJson(artifacts)),
    commands: [
      ...manifest.commands.focused.map((command) => ({ command, category: "FOCUSED", outcome: "PASS" })),
      { command: manifest.commands.authoritative, category: "AUTHORITATIVE", outcome: "PASS" },
    ],
    comparison: {
      focusedSubsetOfAuthoritative: true,
      authoritativeCommand: "npm test",
      noSkipping: true,
    },
    claimVerdicts: manifest.claims.map(({ claimId, verdict }) => ({ claimId, verdict })),
    overallVerdict: "PASS",
  };
}

export function buildSecureDefaultEvidence(manifest) {
  const manifestDigest = sha256(canonicalJson(manifest));
  const core = expectedReportCore(manifest, manifestDigest);
  return { ...core, reportDigest: sha256(canonicalJson(core)) };
}

export function validateSecureDefaultProof(root = process.cwd(), { evidencePath = EVIDENCE_PATH } = {}) {
  root = path.resolve(root);
  const issues = [];
  const manifest = readJson(root, MANIFEST_PATH, "MANIFEST_MISSING_DENIED", issues);
  const schema = readJson(root, SCHEMA_PATH, "SCHEMA_MISSING_DENIED", issues);
  const evidence = readJson(root, evidencePath, "EVIDENCE_MISSING_DENIED", issues);
  if (!manifest || !schema) return [...new Set(issues)].sort();

  try {
    const validate = new Ajv2020({ allErrors: true, strict: true }).compile(schema);
    add(issues, validate(manifest), `MANIFEST_SCHEMA_DENIED:${JSON.stringify(validate.errors ?? [])}`);
  } catch {
    issues.push("SCHEMA_INVALID_DENIED");
  }

  add(issues, manifest.schemaBinding?.path === SCHEMA_PATH, "SCHEMA_BINDING_PATH_DENIED");
  add(issues, manifest.profile === "SAFE_GUIDED", "PROFILE_SCOPE_BROADENED_DENIED");
  add(issues, canonicalJson(manifest.profileExclusions) === canonicalJson(["FULL_CONTROL_LAB", "RAMPAGE"]), "PROFILE_EXCLUSIONS_MISSING_DENIED");
  add(issues, manifest.commands?.proof === "npm run proof:secure-default" && manifest.commands?.authoritative === "npm test", "COMMAND_CLOSURE_DENIED");
  add(issues, Array.isArray(manifest.commands?.focused) && manifest.commands.focused.length >= 2, "FOCUSED_PROBES_MISSING_DENIED");

  const serializedManifest = JSON.stringify(manifest);
  add(issues, !PRIVATE_PATTERNS.some((pattern) => pattern.test(serializedManifest)), "PRIVATE_PATH_OR_SECRET_LEAK_DENIED");

  const publicSet = publicPaths(root, issues);
  const artifactMap = new Map();
  for (const artifact of manifest.artifacts ?? []) {
    if (!safeRelative(artifact.path)) {
      issues.push(`PATH_ESCAPE_DENIED:${artifact.path}`);
      continue;
    }
    add(issues, !artifactMap.has(artifact.path), `ARTIFACT_DUPLICATE_DENIED:${artifact.path}`);
    artifactMap.set(artifact.path, artifact);
    const absolute = safeFile(root, artifact.path);
    if (!absolute) issues.push(`ARTIFACT_MISSING_OR_UNSAFE_DENIED:${artifact.path}`);
    else add(issues, sha256(readFileSync(absolute)) === artifact.sha256, `ARTIFACT_DIGEST_MISMATCH_DENIED:${artifact.path}`);
    add(issues, publicSet.has(artifact.path), `PUBLIC_PROOF_PATH_MISSING_DENIED:${artifact.path}`);
  }
  for (const binding of [
    [manifest.schemaBinding?.path, manifest.schemaBinding?.sha256, "SCHEMA"],
    [manifest.verifier?.path, manifest.verifier?.sha256, "VERIFIER"],
    [manifest.verifier?.negativeTestPath, manifest.verifier?.negativeTestSha256, "TEST"],
  ]) {
    const artifact = artifactMap.get(binding[0]);
    add(issues, artifact?.role === binding[2] && artifact?.sha256 === binding[1], `BOUND_ARTIFACT_MISMATCH_DENIED:${binding[0]}`);
  }

  const claimIds = (manifest.claims ?? []).map(({ claimId }) => claimId);
  for (const id of claimIds) add(issues, REQUIRED_CLAIMS.includes(id), `UNKNOWN_CLAIM_ID_DENIED:${id}`);
  for (const id of REQUIRED_CLAIMS) add(issues, claimIds.includes(id), `REQUIRED_CLAIM_MISSING_DENIED:${id}`);
  add(issues, new Set(claimIds).size === claimIds.length, "DUPLICATE_CLAIM_ID_DENIED");

  for (const claim of manifest.claims ?? []) {
    const nonClaim = claim.claimId === "CM-SD-NC-001";
    add(issues, nonClaim === (claim.kind === "NON_CLAIM" && claim.verdict === "EXPLICITLY_NOT_CLAIMED"), `CLAIM_VERDICT_CONTRADICTION_DENIED:${claim.claimId}`);
    if (!nonClaim) {
      add(issues, claim.kind === "PROPERTY" && claim.verdict === "PROVEN_LOCAL_SYNTHETIC", `CLAIM_VERDICT_CONTRADICTION_DENIED:${claim.claimId}`);
      add(issues, !UNIVERSAL_CLAIM.test(claim.statement), `UNIVERSAL_SECURITY_CLAIM_DENIED:${claim.claimId}`);
    }
    for (const [field, role] of [["implementationPaths", "IMPLEMENTATION"], ["testPaths", "TEST"], ["evidencePaths", "EVIDENCE"]]) {
      for (const relative of claim[field] ?? []) {
        add(issues, artifactMap.get(relative)?.role === role, `CLAIM_${role}_BINDING_DENIED:${claim.claimId}:${relative}`);
      }
    }
  }

  if (evidence) {
    const evidenceKeys = ["claimVerdicts", "commands", "comparison", "evidenceState", "inputSetDigest", "manifestDigest", "overallVerdict", "profile", "proofId", "reportDigest", "schemaDigest", "schemaVersion", "verifierDigest"].sort();
    add(issues, canonicalJson(Object.keys(evidence).sort()) === canonicalJson(evidenceKeys), "EVIDENCE_SHAPE_DENIED");
    add(issues, !PRIVATE_PATTERNS.some((pattern) => pattern.test(JSON.stringify(evidence))), "PRIVATE_PATH_OR_SECRET_LEAK_DENIED");
    const expected = buildSecureDefaultEvidence(manifest);
    add(issues, evidence.evidenceState === "CURRENT", "EVIDENCE_STALE_DENIED");
    add(issues, evidence.manifestDigest === expected.manifestDigest, "EVIDENCE_STALE_DENIED");
    add(issues, evidence.inputSetDigest === expected.inputSetDigest, "EVIDENCE_STALE_DENIED");
    add(issues, evidence.reportDigest === sha256(canonicalJson(Object.fromEntries(Object.entries(evidence).filter(([key]) => key !== "reportDigest")))), "EVIDENCE_TAMPERED_DENIED");
    const evidenceIds = (evidence.claimVerdicts ?? []).map(({ claimId }) => claimId);
    for (const id of evidenceIds) add(issues, REQUIRED_CLAIMS.includes(id), `UNKNOWN_CLAIM_ID_DENIED:${id}`);
    add(issues, canonicalJson(evidence.claimVerdicts) === canonicalJson(expected.claimVerdicts), "CONTRADICTORY_EVIDENCE_DENIED");
    add(issues, canonicalJson(evidence.commands) === canonicalJson(expected.commands), "CONTRADICTORY_EVIDENCE_DENIED");
    add(issues, canonicalJson(evidence.comparison) === canonicalJson(expected.comparison), "AUTHORITATIVE_COMPARATOR_DENIED");
    add(issues, evidence.overallVerdict === "PASS", "CONTRADICTORY_EVIDENCE_DENIED");
  }
  return [...new Set(issues)].sort();
}

export function runProofCommand(command, root, {
  output = (chunk) => process.stderr.write(chunk),
  phase = (value) => process.stderr.write(`PROOF_PHASE ${JSON.stringify(value)}\n`),
  maxBuffer = 32 * 1024 * 1024,
} = {}) {
  // The test seam may tighten, never enlarge, the original combined byte cap.
  if (!Number.isSafeInteger(maxBuffer) || maxBuffer < 1 || maxBuffer > 32 * 1024 * 1024) {
    return Promise.reject(new Error("PROOF_OUTPUT_BOUND_INVALID"));
  }
  const environment = { ...process.env };
  for (const name of Object.keys(environment)) {
    if (/(?:TOKEN|PASSWORD|SECRET|API_KEY|PRIVATE_KEY)/i.test(name)) delete environment[name];
  }
  return new Promise((resolve, reject) => {
    const started = process.hrtime.bigint();
    phase({ event: "START", command });
    const child = spawn(command, {
      cwd: root,
      shell: true,
      env: environment,
      stdio: ["ignore", "pipe", "pipe"],
      detached: process.platform !== "win32",
    });
    let bytes = 0;
    let commandError;
    const terminateOwnedCommand = () => {
      if (!child.pid) return;
      try {
        if (process.platform === "win32") child.kill("SIGKILL");
        else process.kill(-child.pid, "SIGKILL");
      } catch (error) {
        if (error.code !== "ESRCH") commandError ??= error;
      }
    };
    const interrupted = () => {
      commandError ??= new Error("PROOF_COMMAND_INTERRUPTED");
      terminateOwnedCommand();
    };
    const forward = (chunk) => {
      bytes += chunk.length;
      if (bytes > maxBuffer) {
        commandError ??= new Error("PROOF_COMMAND_OUTPUT_LIMIT");
        terminateOwnedCommand();
      } else if (!commandError) {
        try { output(chunk); } catch (error) {
          commandError = error;
          terminateOwnedCommand();
        }
      }
    };
    process.once("SIGINT", interrupted);
    process.once("SIGTERM", interrupted);
    child.stdout.on("data", forward);
    child.stderr.on("data", forward);
    child.once("error", (error) => { commandError = error; });
    // close, not exit, establishes that both output streams have drained.
    child.once("close", (code, signal) => {
      process.off("SIGINT", interrupted);
      process.off("SIGTERM", interrupted);
      const passed = !commandError && code === 0;
      phase({ event: "END", command, exit: code, signal,
        elapsedMilliseconds: Number(process.hrtime.bigint() - started) / 1e6,
        outputBytes: bytes, outcome: passed ? "PASS" : "FAIL" });
      if (!passed) reject(new Error(`PROOF_COMMAND_FAILED:${command}`, { cause: commandError }));
      else resolve();
    });
  });
}

async function main() {
  const root = process.cwd();
  const issues = validateSecureDefaultProof(root);
  if (issues.length) throw new Error(issues.join("\n"));
  const manifest = JSON.parse(readFileSync(path.join(root, MANIFEST_PATH), "utf8"));
  for (const command of [...manifest.commands.focused, manifest.commands.authoritative]) await runProofCommand(command, root);
  const actual = buildSecureDefaultEvidence(manifest);
  const checked = JSON.parse(readFileSync(path.join(root, EVIDENCE_PATH), "utf8"));
  if (canonicalJson(actual) !== canonicalJson(checked)) throw new Error("CHECKED_EVIDENCE_NOT_REPRODUCIBLE_DENIED");
  const output = `${JSON.stringify(actual, null, 2)}\n`;
  const outputIndex = process.argv.indexOf("--output");
  if (outputIndex >= 0) {
    const target = process.argv[outputIndex + 1];
    if (!target) throw new Error("OUTPUT_PATH_REQUIRED");
    writeFileSync(target, output, { flag: "w" });
  }
  process.stdout.write(output);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => { console.error(error.message); process.exitCode = 2; });
}
