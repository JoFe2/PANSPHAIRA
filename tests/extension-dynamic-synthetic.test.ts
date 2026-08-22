import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import test from "node:test";
import { canonicalJson } from "../packages/contracts/src/canonical-json.js";
import {
  EXTENSION_DYNAMIC_CLAIM_BOUNDARY_V1,
  EXTENSION_DYNAMIC_CONFIG_SCHEMA_V1,
  EXTENSION_DYNAMIC_LOCAL_IMAGE_ID_V1,
  EXTENSION_DYNAMIC_OBSERVED_SCHEMA_V1,
  EXTENSION_DYNAMIC_RECEIPT_SCHEMA_V1,
  EXTENSION_DYNAMIC_SYNTHETIC_RUNNER_DIGEST_V1,
  EXTENSION_DYNAMIC_SYNTHETIC_SUBJECT_TREE_DIGEST_V1,
  buildExtensionDynamicDockerArgsV1,
  buildExtensionDynamicReceiptV1,
  validateExtensionDynamicConfigV1,
  type ExtensionDynamicConfigV1,
  type ExtensionDynamicObservedV1,
} from "../packages/contracts/src/extension-dynamic-synthetic.js";

function fixture(): ExtensionDynamicConfigV1 {
  return JSON.parse(readFileSync(
    "tests/fixtures/extension-dynamic/core-v1.json",
    "utf8",
  )) as ExtensionDynamicConfigV1;
}

function digest(value: unknown): string {
  return createHash("sha256").update(canonicalJson(value)).digest("hex");
}

function observed(scenario: ExtensionDynamicConfigV1["scenario"]): ExtensionDynamicObservedV1 {
  const expected = scenario === "success"
    ? { outcome: "SUCCESS" as const, exitCode: 0, timedOut: false }
    : scenario === "injected-failure"
      ? { outcome: "INJECTED_FAILURE" as const, exitCode: 1, timedOut: false }
      : { outcome: "TIMEOUT" as const, exitCode: 124, timedOut: true };
  return {
    schemaVersion: EXTENSION_DYNAMIC_OBSERVED_SCHEMA_V1,
    ...expected,
    cleanup: { containerRemoved: true, scratchRemoved: true, residueCount: 0 },
    readback: {
      preTreeDigest: "a".repeat(64),
      postTreeDigest: "b".repeat(64),
      egressPolicy: "NETWORK_NONE",
    },
  };
}

function reorderKeys(value: unknown, seed: number): unknown {
  if (Array.isArray(value)) return value.map((item) => reorderKeys(item, seed + 1));
  if (value === null || typeof value !== "object") return value;
  const entries = Object.entries(value as Record<string, unknown>);
  const offset = entries.length === 0 ? 0 : seed % entries.length;
  const rotated = [...entries.slice(offset), ...entries.slice(0, offset)].reverse();
  return Object.fromEntries(rotated.map(([key, item]) => [key, reorderKeys(item, seed + 1)]));
}

function expectDenial(value: unknown, code: string): void {
  assert.throws(
    () => validateExtensionDynamicConfigV1(value),
    (error: unknown) => error instanceof Error && error.message.startsWith(`EXTENSION_DYNAMIC_${code}`),
    `expected denial ${code} for ${JSON.stringify(value)}`,
  );
}

test("ETL-DYN closed validation accepts the seeded core fixture and freezes the v1 constants", () => {
  const input = fixture();
  assert.equal(EXTENSION_DYNAMIC_CONFIG_SCHEMA_V1, "chimpmaera.extension-trust/dynamic-synthetic-config/v1");
  assert.equal(EXTENSION_DYNAMIC_RECEIPT_SCHEMA_V1, "chimpmaera.extension-trust/dynamic-synthetic-receipt/v1");
  assert.equal(
    EXTENSION_DYNAMIC_CLAIM_BOUNDARY_V1,
    "LOCAL_SYNTHETIC_DYNAMIC_PROOF_ONLY_NO_CONTAINMENT_CLAIM_NO_THIRD_PARTY_TRUST_NO_ACTIVATION_NO_PRODUCTION",
  );
  assert.deepEqual(validateExtensionDynamicConfigV1(input), input);
  assert.equal(validateExtensionDynamicConfigV1(input).subject.digest, EXTENSION_DYNAMIC_SYNTHETIC_SUBJECT_TREE_DIGEST_V1);
  assert.equal(validateExtensionDynamicConfigV1(input).runnerDigest, EXTENSION_DYNAMIC_SYNTHETIC_RUNNER_DIGEST_V1);
});

test("ETL-DYN builds the exact safe docker argv for the seeded core fixture", () => {
  const input = fixture();
  assert.deepEqual(buildExtensionDynamicDockerArgsV1(input), [
    "docker",
    "run",
    "--rm",
    "--pull",
    "never",
    "--network",
    "none",
    "--read-only",
    "--cap-drop",
    "ALL",
    "--security-opt",
    "no-new-privileges",
    "--user",
    "1000:1000",
    "--memory",
    "536870912",
    "--memory-swap",
    "536870912",
    "--cpus",
    "0.5",
    "--pids-limit",
    "64",
    "-v",
    "/tmp/chimpmaera/extension-dynamic/subject/core:/subject:ro",
    "-v",
    "/tmp/chimpmaera/extension-dynamic/runner/runner.js:/runner/runner.js:ro",
    "-v",
    "/tmp/chimpmaera/extension-dynamic/scratch:/scratch:rw",
    EXTENSION_DYNAMIC_LOCAL_IMAGE_ID_V1,
    "node",
    "/runner/runner.js",
    "--scenario",
    "success",
    "--timeout-ms",
    "30000",
  ]);
});

test("ETL-DYN emits deterministic success, injected-failure and timeout receipts", () => {
  const scenarios = ["success", "injected-failure", "timeout"] as const;
  const expected = {
    success: { outcome: "SUCCESS", exitCode: 0 },
    "injected-failure": { outcome: "INJECTED_FAILURE", exitCode: 1 },
    timeout: { outcome: "TIMEOUT", exitCode: 124 },
  } as const;
  for (const scenario of scenarios) {
    const input = { ...fixture(), scenario };
    const first = buildExtensionDynamicReceiptV1(input, observed(scenario)) as Record<string, any>;
    const second = buildExtensionDynamicReceiptV1(input, observed(scenario)) as Record<string, any>;
    assert.equal(canonicalJson(first), canonicalJson(second), scenario);
    assert.equal(first.schemaVersion, EXTENSION_DYNAMIC_RECEIPT_SCHEMA_V1, scenario);
    assert.equal(first.claimBoundary, EXTENSION_DYNAMIC_CLAIM_BOUNDARY_V1, scenario);
    assert.equal(first.scenario, scenario, scenario);
    assert.equal(first.outcome, expected[scenario].outcome, scenario);
    assert.equal(first.exitCode, expected[scenario].exitCode, scenario);
    assert.equal(first.execution, "OBSERVED_LOCAL_SYNTHETIC", scenario);
    assert.deepEqual(first.cleanup, { containerRemoved: true, scratchRemoved: true, residueCount: 0 });
    assert.equal(first.readback.egressPolicy, "NETWORK_NONE");
    const { receiptDigest, ...body } = first;
    assert.equal(receiptDigest, digest(body), scenario);
  }

  const notRun = buildExtensionDynamicReceiptV1(fixture()) as Record<string, any>;
  assert.equal(notRun.execution, "NOT_RUN");
  assert.equal(notRun.outcome, "NOT_RUN");
  assert.equal(notRun.exitCode, null);
  assert.equal(notRun.cleanup, "NOT_RUN");
});

test("ETL-DYN validation, argv and receipt digest survive 100 object-key reorder repetitions", () => {
  const input = fixture();
  const baseArgs = buildExtensionDynamicDockerArgsV1(input);
  const baseReceipt = canonicalJson(buildExtensionDynamicReceiptV1(input));
  for (let repetition = 0; repetition < 100; repetition += 1) {
    const reordered = reorderKeys(input, repetition);
    const validated = validateExtensionDynamicConfigV1(reordered);
    assert.deepEqual(validated, input, String(repetition));
    assert.deepEqual(buildExtensionDynamicDockerArgsV1(reordered), baseArgs, String(repetition));
    assert.equal(canonicalJson(buildExtensionDynamicReceiptV1(reordered)), baseReceipt, String(repetition));
  }
});

test("ETL-DYN denies unsafe image, path, scenario and timeout shapes", () => {
  const unsafe: Array<[string, unknown]> = [
    ["IMAGE", { ...fixture(), image: { name: "node:24-bookworm", id: "sha256:9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08" } }],
    ["IMAGE", { ...fixture(), image: { name: "node:24-bookworm-slim", id: "node:24-bookworm-slim" } }],
    ["IMAGE_ID_DRIFT", { ...fixture(), image: { name: "node:24-bookworm-slim", id: `sha256:${"f".repeat(64)}` } }],
    ["SUBJECT_PATH", { ...fixture(), subject: { ...fixture().subject, hostPath: "relative/core" } }],
    ["SCRATCH_PATH", { ...fixture(), scratchHostPath: "scratch" }],
    ["RUNNER_PATH", { ...fixture(), runnerHostPath: "/etc/passwd" }],
    ["SCENARIO", { ...fixture(), scenario: "arbitrary" }],
    ["TIMEOUT", { ...fixture(), timeoutMs: 0 }],
    ["TIMEOUT", { ...fixture(), timeoutMs: 30000.5 }],
    ["TIMEOUT", { ...fixture(), timeoutMs: "30000" }],
    ["RUNNER_DIGEST", { ...fixture(), runnerDigest: "not-a-digest" }],
    ["SUBJECT", { ...fixture(), subject: { ...fixture().subject, digest: "x".repeat(64) } }],
  ];
  for (const [code, value] of unsafe) {
    expectDenial(value, code);
  }
});

test("ETL-DYN denies unknown fields at every closed level", () => {
  const unknown: Array<[string, unknown]> = [
    ["UNKNOWN_FIELD", { ...fixture(), runtimeActivation: true }],
    ["UNKNOWN_FIELD", { ...fixture(), subject: { ...fixture().subject, extra: 1 } }],
    ["UNKNOWN_FIELD", { ...fixture(), image: { ...fixture().image, tag: "latest" } }],
    ["UNKNOWN_FIELD", { ...fixture(), resources: { ...fixture().resources, gpus: 1 } }],
    ["MISSING_FIELD", Object.fromEntries(Object.entries(fixture()).filter(([key]) => key !== "runnerDigest"))],
    ["MISSING_FIELD", { ...fixture(), subject: { id: fixture().subject.id, version: fixture().subject.version, digest: fixture().subject.digest } }],
    ["SCHEMA_VERSION", { ...fixture(), schemaVersion: "chimpmaera.extension-trust/dynamic-synthetic-config/v2" }],
  ];
  for (const [code, value] of unknown) {
    expectDenial(value, code);
  }
});

test("ETL-DYN denies subject digest drift and resource violations", () => {
  expectDenial({ ...fixture(), subject: { ...fixture().subject, digest: "f".repeat(64) } }, "SUBJECT_DIGEST_DRIFT");
  expectDenial({ ...fixture(), runnerDigest: "f".repeat(64) }, "RUNNER_DIGEST_DRIFT");

  const resources: Array<[string, unknown]> = [
    ["RESOURCES", { ...fixture(), resources: { ...fixture().resources, pidsLimit: 0 } }],
    ["RESOURCES", { ...fixture(), resources: { ...fixture().resources, memoryBytes: -1 } }],
    ["RESOURCES", { ...fixture(), resources: { ...fixture().resources, cpus: 0 } }],
    ["RESOURCES", { ...fixture(), resources: { ...fixture().resources, cpus: "0.5" } }],
    ["RESOURCES", { ...fixture(), resources: { ...fixture().resources, pidsLimit: 129 } }],
    ["RESOURCES", { ...fixture(), resources: { ...fixture().resources, memoryBytes: 67_108_863 } }],
    ["RESOURCES", { ...fixture(), resources: { ...fixture().resources, cpus: 1.1 } }],
    ["MISSING_FIELD", { ...fixture(), resources: { pidsLimit: 64, memoryBytes: 536870912 } }],
  ];
  for (const [code, value] of resources) {
    expectDenial(value, code);
  }
});

test("ETL-DYN denies unsafe or overlapping mounts before argv construction", () => {
  const cases: Array<[string, unknown]> = [
    ["SUBJECT_PATH", { ...fixture(), subject: { ...fixture().subject, hostPath: "/etc" } }],
    ["SUBJECT_PATH", { ...fixture(), subject: { ...fixture().subject, hostPath: "/tmp/chimpmaera/extension-dynamic/subject/../runner" } }],
    ["RUNNER_PATH", { ...fixture(), runnerHostPath: "/tmp/chimpmaera/extension-dynamic/subject/core/runner.js" }],
    ["SCRATCH_PATH", { ...fixture(), scratchHostPath: "/tmp" }],
  ];
  for (const [code, value] of cases) {
    assert.throws(() => buildExtensionDynamicDockerArgsV1(value), new RegExp(`EXTENSION_DYNAMIC_${code}`));
  }
});

test("ETL-DYN denies false observed success, inconsistent exits and incomplete cleanup/readback", () => {
  const input = fixture();
  const base = observed("success");
  const cases: Array<[string, unknown]> = [
    ["OBSERVED_OUTCOME_MISMATCH", { ...base, outcome: "INJECTED_FAILURE" }],
    ["OBSERVED_EXIT_CODE_MISMATCH", { ...base, exitCode: 1 }],
    ["OBSERVED_TIMEOUT_MISMATCH", { ...base, timedOut: true }],
    ["OBSERVED_CLEANUP", { ...base, cleanup: { ...base.cleanup, containerRemoved: false } }],
    ["OBSERVED_READBACK", { ...base, readback: { ...base.readback, preTreeDigest: "bad" } }],
    ["OBSERVED_EGRESS", { ...base, readback: { ...base.readback, egressPolicy: "OPEN" } }],
  ];
  for (const [code, value] of cases) {
    assert.throws(() => buildExtensionDynamicReceiptV1(input, value), new RegExp(`EXTENSION_DYNAMIC_${code}`));
  }
});
