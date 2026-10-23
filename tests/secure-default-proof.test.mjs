import assert from "node:assert/strict";
import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import test from "node:test";
import { spawn, spawnSync } from "node:child_process";
import {
  canonicalJson,
  runProofCommand,
  validateSecureDefaultProof,
} from "../scripts/verify-secure-default-proof.mjs";
import { createHash } from "node:crypto";

const ROOT = resolve(import.meta.dirname, "..");
const MANIFEST = "security/secure-default-proof-v1.json";
const EVIDENCE = "security/secure-default-proof-evidence-v1.json";
const sha256 = (value) => createHash("sha256").update(value).digest("hex");

function fixture() {
  const target = mkdtempSync(join(tmpdir(), "cm-secure-default-proof-"));
  const manifest = JSON.parse(readFileSync(join(ROOT, MANIFEST), "utf8"));
  const files = new Set([
    MANIFEST,
    EVIDENCE,
    "release/public-files.manifest",
    ...manifest.artifacts.map(({ path }) => path),
  ]);
  for (const relative of files) {
    const destination = join(target, relative);
    mkdirSync(dirname(destination), { recursive: true });
    cpSync(join(ROOT, relative), destination);
  }
  return target;
}

function updateJson(root, relative, mutate, { resignEvidence = false } = {}) {
  const file = join(root, relative);
  const value = JSON.parse(readFileSync(file, "utf8"));
  mutate(value);
  if (resignEvidence) {
    const { reportDigest: ignored, ...core } = value;
    value.reportDigest = sha256(canonicalJson(core));
  }
  writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`);
}

test("secure-default manifest and checked evidence validate on repository bytes", () => {
  assert.deepEqual(validateSecureDefaultProof(ROOT), []);
});

test("missing, stale, tampered and contradictory evidence fail closed", async (t) => {
  const probes = [
    ["missing", "EVIDENCE_MISSING_DENIED", (root) => validateSecureDefaultProof(root, { evidencePath: "security/missing-evidence.json" })],
    ["stale", "EVIDENCE_STALE_DENIED", (root) => {
      updateJson(root, EVIDENCE, (value) => { value.evidenceState = "STALE"; }, { resignEvidence: true });
      return validateSecureDefaultProof(root);
    }],
    ["tampered", "EVIDENCE_TAMPERED_DENIED", (root) => {
      updateJson(root, EVIDENCE, (value) => { value.overallVerdict = "FAIL"; });
      return validateSecureDefaultProof(root);
    }],
    ["contradictory", "CONTRADICTORY_EVIDENCE_DENIED", (root) => {
      updateJson(root, EVIDENCE, (value) => { value.claimVerdicts[0].verdict = "EXPLICITLY_NOT_CLAIMED"; }, { resignEvidence: true });
      return validateSecureDefaultProof(root);
    }],
  ];
  for (const [name, expected, run] of probes) {
    await t.test(name, () => {
      const issues = run(fixture());
      assert.ok(issues.some((issue) => issue.includes(expected)), issues.join("\n"));
    });
  }
});

test("unknown claims, unsafe paths, private paths and digest drift fail closed", async (t) => {
  const probes = [
    ["unknown claim", "UNKNOWN_CLAIM_ID_DENIED", (root) => updateJson(root, MANIFEST, (value) => { value.claims[0].claimId = "CM-SD-999"; })],
    ["path escape", "PATH_ESCAPE_DENIED", (root) => updateJson(root, MANIFEST, (value) => { value.artifacts.push({ path: "../private", role: "EVIDENCE", sha256: "0".repeat(64) }); })],
    ["private path", "PRIVATE_PATH_OR_SECRET_LEAK_DENIED", (root) => updateJson(root, MANIFEST, (value) => { value.claimBoundary += ` Private path: ${["", "home", "example", "private"].join("/")}.`; })],
    ["digest mismatch", "ARTIFACT_DIGEST_MISMATCH_DENIED", (root) => updateJson(root, MANIFEST, (value) => { value.artifacts.find(({ path }) => path === "demo/runtime/enforcement-gate.mjs").sha256 = "0".repeat(64); })],
  ];
  for (const [name, expected, mutate] of probes) {
    await t.test(name, () => {
      const root = fixture();
      mutate(root);
      const issues = validateSecureDefaultProof(root);
      assert.ok(issues.some((issue) => issue.includes(expected)), issues.join("\n"));
    });
  }
});

test("a falsely broadened universal-security claim is denied", () => {
  const root = fixture();
  updateJson(root, MANIFEST, (value) => {
    value.claims[0].statement = "The SAFE_GUIDED implementation is universally secure and eliminates all meaningful security uncertainty.";
  });
  const issues = validateSecureDefaultProof(root);
  assert.ok(issues.some((issue) => issue.includes("UNIVERSAL_SECURITY_CLAIM_DENIED")), issues.join("\n"));
});

const shellQuote = (value) => `'${value.replaceAll("'", "'\"'\"'")}'`;
const proofChild = (source) => `${shellQuote(process.execPath)} -e ${shellQuote(source)}`;

test("PROOF-RUNNER streams bounded output before child completion without polluting evidence stdout", async () => {
  const root = mkdtempSync(join(tmpdir(), "cm-proof-progress-"));
  const acknowledgement = join(root, "observed");
  const child = proofChild(`
    const fs = require('node:fs');
    process.stdout.write('EARLY_PROGRESS\\n');
    const start = Date.now();
    const timer = setInterval(() => {
      if (fs.existsSync(${JSON.stringify(acknowledgement)})) {
        clearInterval(timer);
        process.stderr.write('CHILD_COMPLETE\\n');
      } else if (Date.now() - start > 1500) {
        clearInterval(timer);
        process.exitCode = 7;
      }
    }, 10);
  `);
  let observed = "";
  const phases = [];
  try {
    await runProofCommand(child, root, {
      output: (chunk) => {
        observed += chunk.toString();
        if (observed.includes("EARLY_PROGRESS\n")) writeFileSync(acknowledgement, "observed");
      },
      phase: (value) => phases.push(value),
    });
    assert.match(observed, /EARLY_PROGRESS\n/);
    assert.match(observed, /CHILD_COMPLETE\n/);
    assert.deepEqual(phases.map(({ event }) => event), ["START", "END"]);
    assert.equal(phases[1].exit, 0);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("PROOF-RUNNER nonzero close denies completion and no later command runs", async () => {
  const phases = [];
  const before = [process.listenerCount("SIGINT"), process.listenerCount("SIGTERM")];
  let nextCommandReached = false;
  await assert.rejects(async () => {
    await runProofCommand(proofChild("process.stdout.write('BEFORE_FAILURE'); process.exitCode = 9"), ROOT,
      { output: () => {}, phase: (value) => phases.push(value) });
    nextCommandReached = true;
  }, /PROOF_COMMAND_FAILED:/);
  assert.equal(nextCommandReached, false);
  assert.equal(phases.at(-1).exit, 9);
  assert.equal(phases.at(-1).outcome, "FAIL");
  assert.deepEqual([process.listenerCount("SIGINT"), process.listenerCount("SIGTERM")], before);
});

test("PROOF-RUNNER combined output cap kills only its command group and cannot be enlarged", async () => {
  const phases = [];
  let forwarded = 0;
  const control = spawn(process.execPath, ["-e", "setTimeout(() => {}, 30000)"], { stdio: "ignore" });
  const controlClosed = new Promise((resolve) => control.once("close", resolve));
  try {
    await assert.rejects(runProofCommand(proofChild(
      "process.stdout.write('o'.repeat(768)); process.stderr.write('e'.repeat(768)); setTimeout(() => {}, 30000)"), ROOT,
    { maxBuffer: 1024, output: (chunk) => { forwarded += chunk.length; }, phase: (value) => phases.push(value) }),
    /PROOF_COMMAND_FAILED:/);
    assert.ok(forwarded <= 1024);
    assert.ok(phases.at(-1).outputBytes > 1024);
    assert.equal(phases.at(-1).outcome, "FAIL");
    assert.equal(phases.at(-1).signal, "SIGKILL");
    assert.equal(control.exitCode, null);
    process.kill(control.pid, 0);
    await assert.rejects(runProofCommand("exit 0", ROOT, { maxBuffer: 32 * 1024 * 1024 + 1 }),
      /PROOF_OUTPUT_BOUND_INVALID/);
  } finally {
    control.kill("SIGTERM");
    await controlClosed;
  }
});

test("PROOF-RUNNER keeps the existing credential-key removal and preserves nonsecret inputs", async () => {
  const keys = ["PROOF_TEST_TOKEN", "PROOF_TEST_PASSWORD", "PROOF_TEST_SECRET", "PROOF_TEST_API_KEY", "PROOF_TEST_PRIVATE_KEY"];
  const originals = new Map([...keys, "CM_PROOF_TEST_PRESENT"].map((key) => [key, process.env[key]]));
  let observed = "";
  try {
    for (const key of keys) process.env[key] = "synthetic-control-not-a-credential";
    process.env.CM_PROOF_TEST_PRESENT = "present";
    await runProofCommand(proofChild(`process.stdout.write(JSON.stringify({
      forbidden: ${JSON.stringify(keys)}.map((key) => process.env[key] ?? null),
      permitted: process.env.CM_PROOF_TEST_PRESENT
    }))`), ROOT, { output: (chunk) => { observed += chunk.toString(); }, phase: () => {} });
    assert.deepEqual(JSON.parse(observed), { forbidden: keys.map(() => null), permitted: "present" });
  } finally {
    for (const [key, value] of originals) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
});

test("PROOF-RUNNER default live output is stderr and parent stdout remains machine-readable", () => {
  const moduleURL = new URL("../scripts/verify-secure-default-proof.mjs", import.meta.url).href;
  const script = `import { runProofCommand } from ${JSON.stringify(moduleURL)};
    await runProofCommand(${JSON.stringify(proofChild("process.stdout.write('CHILD_RAW_PROGRESS\\n')"))}, process.cwd());
    process.stdout.write('PARENT_STDOUT\\n');`;
  const result = spawnSync(process.execPath, ["--input-type=module", "-e", script],
    { cwd: ROOT, encoding: "utf8", timeout: 4000, maxBuffer: 64 * 1024 });
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stdout, "PARENT_STDOUT\n");
  assert.match(result.stderr, /CHILD_RAW_PROGRESS\n/);
  assert.match(result.stderr, /PROOF_PHASE .*"event":"START"/);
  assert.match(result.stderr, /PROOF_PHASE .*"event":"END".*"outcome":"PASS"/);
});

test("PROOF-RUNNER real parent cancellation closes its active command and never reports success", () => {
  const moduleURL = new URL("../scripts/verify-secure-default-proof.mjs", import.meta.url).href;
  const command = proofChild("process.stdout.write('INTERRUPT_READY\\n'); setTimeout(() => {}, 30000)");
  const script = `import { runProofCommand } from ${JSON.stringify(moduleURL)};
    try {
      await runProofCommand(${JSON.stringify(command)}, process.cwd(), {
        phase: () => {},
        output: () => process.kill(process.pid, 'SIGTERM')
      });
      process.stdout.write('UNEXPECTED_SUCCESS');
    } catch (error) {
      if (error.cause?.message !== 'PROOF_COMMAND_INTERRUPTED') throw error;
      process.stderr.write('EXPECTED_INTERRUPTION\\n');
      process.exitCode = 31;
    }`;
  const result = spawnSync(process.execPath, ["--input-type=module", "-e", script],
    { cwd: ROOT, encoding: "utf8", timeout: 4000, maxBuffer: 64 * 1024 });
  assert.equal(result.status, 31, result.stderr);
  assert.equal(result.stdout, "");
  assert.equal(result.stderr, "EXPECTED_INTERRUPTION\n");
});
