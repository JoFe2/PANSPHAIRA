import { spawn } from "node:child_process";
import {
  EXTENSION_DYNAMIC_LOCAL_IMAGE_ID_V1,
  EXTENSION_DYNAMIC_OBSERVED_SCHEMA_V1,
  buildExtensionDynamicDockerArgsV1,
  buildExtensionDynamicReceiptV1,
  validateExtensionDynamicConfigV1,
} from "../dist/packages/contracts/src/extension-dynamic-synthetic.js";
import {
  cleanupExtensionDynamicStagingV1,
  prepareExtensionDynamicStagingV1,
  sha256TreeV1,
} from "./extension-dynamic-synthetic.mjs";

export const EXTENSION_DYNAMIC_CONTAINER_PREFIX_V1 = "chimpmaera-etl-dyn-";
export const EXTENSION_DYNAMIC_PROCESS_OUTPUT_LIMIT_V1 = 65_536;
export const EXTENSION_DYNAMIC_CONTROL_TIMEOUT_MS_V1 = 10_000;

function processFailure(code, detail) {
  throw new Error(`EXTENSION_DYNAMIC_PROCESS_${code}: ${detail}`);
}

function validateProcessRequest(command, args, options) {
  if (typeof command !== "string" || command.length === 0 || command.includes("\0")) {
    processFailure("COMMAND", "non-empty NUL-free command required");
  }
  if (!Array.isArray(args) || args.some((value) => typeof value !== "string" || value.includes("\0"))) {
    processFailure("ARGS", "string argv required");
  }
  if (options === null || typeof options !== "object" || Array.isArray(options)) {
    processFailure("OPTIONS", "plain options object required");
  }
  const timeoutMs = options.timeoutMs;
  const maxOutputBytes = options.maxOutputBytes ?? EXTENSION_DYNAMIC_PROCESS_OUTPUT_LIMIT_V1;
  if (!Number.isSafeInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > 60_000) {
    processFailure("TIMEOUT", "timeoutMs must be from 1 through 60000");
  }
  if (!Number.isSafeInteger(maxOutputBytes) || maxOutputBytes < 1 || maxOutputBytes > EXTENSION_DYNAMIC_PROCESS_OUTPUT_LIMIT_V1) {
    processFailure("OUTPUT_LIMIT", `maxOutputBytes must be from 1 through ${EXTENSION_DYNAMIC_PROCESS_OUTPUT_LIMIT_V1}`);
  }
  return { timeoutMs, maxOutputBytes };
}

export function extensionDynamicContainerNameV1(runId) {
  if (typeof runId !== "string" || !/^[a-z0-9][a-z0-9-]{0,31}$/.test(runId)) {
    processFailure("RUN_ID", "lowercase alphanumeric run id required");
  }
  return `${EXTENSION_DYNAMIC_CONTAINER_PREFIX_V1}${runId}`;
}

export async function runBoundedProcessV1(command, args, options, spawnImpl = spawn) {
  const { timeoutMs, maxOutputBytes } = validateProcessRequest(command, args, options);
  if (typeof spawnImpl !== "function") processFailure("SPAWN", "spawn function required");

  return await new Promise((resolve, reject) => {
    let child;
    try {
      child = spawnImpl(command, args, {
        cwd: options.cwd,
        env: options.env,
        shell: false,
        stdio: ["ignore", "pipe", "pipe"],
      });
    } catch (error) {
      reject(error);
      return;
    }

    let stdout = Buffer.alloc(0);
    let stderr = Buffer.alloc(0);
    let timedOut = false;
    let outputExceeded = false;
    let settled = false;
    let forceTimer;
    let reapTimer;

    const append = (current, chunk) => {
      const next = Buffer.concat([current, Buffer.from(chunk)]);
      if (next.length > maxOutputBytes) {
        outputExceeded = true;
        child.kill("SIGKILL");
        return next.subarray(0, maxOutputBytes);
      }
      return next;
    };

    child.stdout?.on("data", (chunk) => { stdout = append(stdout, chunk); });
    child.stderr?.on("data", (chunk) => { stderr = append(stderr, chunk); });

    const timeout = setTimeout(() => {
      timedOut = true;
      child.kill("SIGTERM");
      forceTimer = setTimeout(() => {
        child.kill("SIGKILL");
        reapTimer = setTimeout(() => {
          if (settled) return;
          settled = true;
          reject(new Error("EXTENSION_DYNAMIC_PROCESS_TIMEOUT_UNREAPED"));
        }, 1_000);
      }, 1_000);
    }, timeoutMs);

    child.once("error", (error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      clearTimeout(forceTimer);
      clearTimeout(reapTimer);
      reject(error);
    });
    child.once("close", (exitCode, signal) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      clearTimeout(forceTimer);
      clearTimeout(reapTimer);
      if (outputExceeded) {
        reject(new Error(`EXTENSION_DYNAMIC_PROCESS_OUTPUT_EXCEEDED: ${maxOutputBytes}`));
        return;
      }
      resolve({
        exitCode,
        signal,
        timedOut,
        stdout: stdout.toString("utf8"),
        stderr: stderr.toString("utf8"),
      });
    });
  });
}

export async function readbackExtensionDynamicImageV1(spawnImpl = spawn) {
  const inspected = await runBoundedProcessV1("docker", [
    "image", "inspect", EXTENSION_DYNAMIC_LOCAL_IMAGE_ID_V1, "--format", "{{json .Id}}",
  ], { timeoutMs: EXTENSION_DYNAMIC_CONTROL_TIMEOUT_MS_V1 }, spawnImpl);
  if (inspected.timedOut || inspected.exitCode !== 0) {
    processFailure("IMAGE_NOT_LOCAL", inspected.stderr.trim() || String(inspected.exitCode));
  }
  let observed;
  try {
    observed = JSON.parse(inspected.stdout.trim());
  } catch {
    processFailure("IMAGE_READBACK", "docker image inspect returned invalid JSON");
  }
  if (observed !== EXTENSION_DYNAMIC_LOCAL_IMAGE_ID_V1) {
    processFailure("IMAGE_ID_DRIFT", String(observed));
  }
  return observed;
}

async function inspectContainerAbsentV1(containerName, spawnImpl) {
  const inspected = await runBoundedProcessV1("docker", [
    "container", "inspect", containerName, "--format", "{{json .Id}}",
  ], { timeoutMs: EXTENSION_DYNAMIC_CONTROL_TIMEOUT_MS_V1 }, spawnImpl);
  if (inspected.exitCode === 0) processFailure("CONTAINER_PRESENT", containerName);
  const diagnostic = `${inspected.stdout}\n${inspected.stderr}`;
  if (inspected.timedOut || !/No such (object|container)/i.test(diagnostic)) {
    processFailure("CONTAINER_ABSENCE_UNPROVEN", diagnostic.trim() || String(inspected.exitCode));
  }
  return true;
}

export async function removeExtensionDynamicContainerV1(containerName, spawnImpl = spawn) {
  if (!/^chimpmaera-etl-dyn-[a-z0-9][a-z0-9-]{0,31}$/.test(containerName)) {
    processFailure("CONTAINER_SCOPE", containerName);
  }
  await runBoundedProcessV1("docker", ["container", "rm", "--force", containerName], {
    timeoutMs: EXTENSION_DYNAMIC_CONTROL_TIMEOUT_MS_V1,
  }, spawnImpl);
  return await inspectContainerAbsentV1(containerName, spawnImpl);
}

function expectedExecutionV1(scenario, result) {
  const observed = result.timedOut
    ? { outcome: "TIMEOUT", exitCode: 124, timedOut: true }
    : result.exitCode === 0
      ? { outcome: "SUCCESS", exitCode: 0, timedOut: false }
      : result.exitCode === 1
        ? { outcome: "INJECTED_FAILURE", exitCode: 1, timedOut: false }
        : null;
  if (observed === null) processFailure("UNEXPECTED_EXIT", `${result.exitCode}:${result.signal}`);
  const expectedOutcome = scenario === "success"
    ? "SUCCESS"
    : scenario === "injected-failure" ? "INJECTED_FAILURE" : "TIMEOUT";
  if (observed.outcome !== expectedOutcome) {
    processFailure("SCENARIO_MISMATCH", `${scenario}:${observed.outcome}`);
  }
  return observed;
}

export async function runExtensionDynamicScenarioV1(baseConfig, runId, dependencies = {}) {
  if (dependencies === null || typeof dependencies !== "object" || Array.isArray(dependencies)) {
    processFailure("DEPENDENCIES", "plain object required");
  }
  const unknownDependencies = Object.keys(dependencies).filter((key) => ![
    "spawnImpl", "prepareStaging", "cleanupStaging", "sha256Tree",
  ].includes(key));
  if (unknownDependencies.length > 0) processFailure("DEPENDENCY_KEY", unknownDependencies.sort().join(","));

  const spawnImpl = dependencies.spawnImpl ?? spawn;
  const prepareStaging = dependencies.prepareStaging ?? prepareExtensionDynamicStagingV1;
  const cleanupStaging = dependencies.cleanupStaging ?? cleanupExtensionDynamicStagingV1;
  const sha256Tree = dependencies.sha256Tree ?? sha256TreeV1;
  const containerName = extensionDynamicContainerNameV1(runId);
  const validatedBase = validateExtensionDynamicConfigV1(baseConfig);

  let prepared;
  let config;
  let execution;
  let dockerArgs;
  let observedExecution;
  let preTreeDigest;
  let postTreeDigest;
  let containerRemoved = false;
  let stageCleanup;

  try {
    prepared = await prepareStaging();
    config = validateExtensionDynamicConfigV1({
      ...validatedBase,
      subject: {
        ...validatedBase.subject,
        digest: prepared.subjectDigest,
        hostPath: prepared.subjectHostPath,
      },
      runnerDigest: prepared.runnerDigest,
      runnerHostPath: prepared.runnerHostPath,
      scratchHostPath: prepared.scratchHostPath,
    });
    preTreeDigest = await sha256Tree(config.subject.hostPath);
    if (preTreeDigest !== config.subject.digest) processFailure("PRE_TREE_DRIFT", preTreeDigest);
    await readbackExtensionDynamicImageV1(spawnImpl);
    await removeExtensionDynamicContainerV1(containerName, spawnImpl);

    const frozen = [...buildExtensionDynamicDockerArgsV1(config)];
    if (frozen.shift() !== "docker" || frozen.shift() !== "run" || frozen.shift() !== "--rm") {
      processFailure("FROZEN_ARGV", "expected docker run --rm prefix");
    }
    dockerArgs = ["run", "--name", containerName, ...frozen];
    execution = await runBoundedProcessV1("docker", dockerArgs, {
      timeoutMs: config.timeoutMs,
    }, spawnImpl);
    postTreeDigest = await sha256Tree(config.subject.hostPath);
    if (postTreeDigest !== preTreeDigest) processFailure("POST_TREE_DRIFT", postTreeDigest);

    observedExecution = expectedExecutionV1(config.scenario, execution);
  } finally {
    containerRemoved = await removeExtensionDynamicContainerV1(containerName, spawnImpl);
    if (prepared !== undefined) {
      stageCleanup = await cleanupStaging();
      if (stageCleanup?.stageRootRemoved !== true || stageCleanup?.residueCount !== 0) {
        processFailure("STAGING_CLEANUP", JSON.stringify(stageCleanup));
      }
    }
  }
  if (!containerRemoved || stageCleanup?.residueCount !== 0) {
    processFailure("RECEIPT_BEFORE_CLEANUP", containerName);
  }
  const receipt = buildExtensionDynamicReceiptV1(config, {
    schemaVersion: EXTENSION_DYNAMIC_OBSERVED_SCHEMA_V1,
    ...observedExecution,
    cleanup: { containerRemoved: true, scratchRemoved: true, residueCount: 0 },
    readback: { preTreeDigest, postTreeDigest, egressPolicy: "NETWORK_NONE" },
  });
  return {
    config,
    containerName,
    dockerArgv: ["docker", ...dockerArgs],
    execution,
    receipt,
  };
}
