#!/usr/bin/env node
// Real, bounded CKS-05 pilot. This is deliberately a five-run stop-condition
// probe, not the 960/1344-run benchmark and never authorizes a substitution
// claim. Raw model output remains local; the durable receipt contains digests.
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath, pathToFileURL } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, "..");
const EXPECTED_ARMS = [
  ["ARM-SCB-01", "SMALL", "CLOSED_BOOK"],
  ["ARM-SNR-02", "SMALL", "NAIVE_RAG"],
  ["ARM-SKF-03", "SMALL", "STRUCTURED_FABRIC"],
  ["ARM-LCB-04", "LARGE", "CLOSED_BOOK"],
  ["ARM-LKF-05", "LARGE", "STRUCTURED_FABRIC"],
];
const EXPECTED_RUNTIME_SHA = "915a3ad0b4de517ea6e50d82edaf4a0a6f1b3a3beeddbdb85317fb1ab2363b0b";
const EXPECTED_MODEL_SHA = {
  SMALL: "ed81a97aa6aa5a1c25664fe4e9721f009e19fe151c71dcec6a52553a24372f9f",
  LARGE: "07deb7fa91bf751d3000774fe5bb8afae5ffb41255fd19980147468052e07177",
};

export const sha256 = (value) => createHash("sha256").update(value).digest("hex");
const canonical = (value) => {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value && typeof value === "object") return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonical(value[key])}`).join(",")}}`;
  return JSON.stringify(value);
};
export const definePilotArms = (config) => structuredClone(config.arms ?? []);

export function validatePilotConfig(config) {
  const errors = [];
  const fail = (code, detail) => errors.push(`${code}: ${detail}`);
  if (config?.schemaVersion !== "pansphaira.cks05/real-bounded-pilot/v1") fail("SCHEMA", "unsupported pilot config");
  if (config?.runtime?.build !== 10661 || config?.runtime?.commit !== "32176338a") fail("RUNTIME_VERSION", "llama.cpp b10661/32176338a is required");
  if (config?.runtime?.archiveSha256 !== EXPECTED_RUNTIME_SHA) fail("RUNTIME_DIGEST", "pinned b10661 archive digest differs");
  for (const role of ["SMALL", "LARGE"]) if (config?.models?.[role]?.sha256 !== EXPECTED_MODEL_SHA[role]) fail("MODEL_DIGEST", `${role} model digest differs`);
  const observed = (config?.arms ?? []).map((arm) => [arm.armId, arm.modelRole, arm.knowledgeMode]);
  if (canonical(observed) !== canonical(EXPECTED_ARMS)) fail("ARM_SET", "exact issue outcome matrix with small/large closed-book controls is required");
  if (!config?.task?.question || !config?.task?.goldAnswer || !config?.task?.knowledge?.answerFact) fail("TASK", "question, gold, and knowledge are required");
  if (config?.generation?.seed !== 104729 || config?.generation?.temperature !== 0) fail("GENERATION", "bounded deterministic pilot settings drifted");
  return errors;
}

export function buildPrompt(config, arm) {
  const instruction = `Answer the fictional-domain question. If the supplied material does not establish the answer, emit exactly <final>${config.task.abstentionToken}</final>. Otherwise emit exactly one final channel as <final>CLEARANCE-CODE</final>. Reasoning may precede it but must never appear inside the final channel.`;
  let material = "No domain material is supplied (closed book).";
  if (arm.knowledgeMode === "NAIVE_RAG") material = `Raw retrieved text:\n${config.task.knowledge.raw}`;
  if (arm.knowledgeMode === "STRUCTURED_FABRIC") material = `Structured Knowledge Fabric:\n${config.task.knowledge.structured}`;
  return `${instruction}\n\n${material}\n\nQuestion: ${config.task.question}`;
}

export function extractGeneratedOutput(stdout, prompt) {
  let generated = String(stdout ?? "");
  const promptIndex = generated.lastIndexOf(prompt);
  if (promptIndex >= 0) generated = generated.slice(promptIndex + prompt.length);
  generated = generated.split(/\n\[ Prompt:/, 1)[0];
  generated = generated.replace(/\nExiting\.\.\.\s*$/, "");
  return generated.trim();
}

export function extractFinalAnswer(generatedOutput) {
  const value = String(generatedOutput ?? "").replace(/<\|(?:im_end|endoftext)\|>/g, "").trim();
  const openingCount = (value.match(/<final>/g) ?? []).length;
  const closingCount = (value.match(/<\/final>/g) ?? []).length;
  if (openingCount !== 1 || closingCount !== 1) return null;
  const match = value.match(/<final>\s*([^<>\r\n]{1,128}?)\s*<\/final>/);
  if (!match) return null;
  const answer = match[1].trim();
  return answer.length > 0 ? answer : null;
}

function digestFile(path) {
  const result = spawnSync("sha256sum", [path], { encoding: "utf8", timeout: 600000 });
  if (result.status !== 0) throw new Error(`cannot hash model artifact: ${result.stderr ?? "unknown error"}`);
  const digest = result.stdout.trim().split(/\s+/, 1)[0];
  if (!/^[a-f0-9]{64}$/.test(digest)) throw new Error("sha256sum returned a malformed digest");
  return digest;
}

function invokeLlama({ runtimePath, modelPath, config, arm, prompt }) {
  const started = process.hrtime.bigint();
  const child = spawnSync(runtimePath, [
    "-m", modelPath,
    "-p", prompt,
    "-n", String(config.generation.maxGeneratedTokens),
    "-c", "2048",
    "-ngl", "0",
    "--seed", String(config.generation.seed),
    "--temp", String(config.generation.temperature),
    "--no-display-prompt",
    "--no-show-timings",
    "--no-warmup",
    "--simple-io",
    "--log-disable",
    "--single-turn",
  ], {
    encoding: "utf8",
    timeout: config.generation.timeoutSeconds * 1000,
    maxBuffer: 16 * 1024 * 1024,
    env: { PATH: process.env.PATH ?? "/usr/bin:/bin", HOME: process.env.HOME ?? "/tmp", LC_ALL: "C" },
  });
  const elapsedMs = Number(process.hrtime.bigint() - started) / 1e6;
  const timedOut = child.error?.code === "ETIMEDOUT";
  return {
    terminalStatus: child.status === 0 && !timedOut ? "COMPLETED" : "FAILED",
    exitCode: child.status,
    failureCodeOrNull: timedOut ? "TIMEOUT" : child.status === 0 ? null : "NONZERO_RUNTIME_EXIT",
    elapsedMs,
    stdout: child.stdout ?? "",
    stderr: `${child.stderr ?? ""}${child.error ? `\n${child.error.message}` : ""}`,
  };
}

export function runBoundedPilot(config, options = {}) {
  const errors = validatePilotConfig(config);
  if (errors.length) throw new Error(`PILOT_REJECTED: ${errors.join("; ")}`);
  const invoke = options.invoke ?? ((args) => invokeLlama({ ...args, ...options }));
  const selectedArms = options.armIds?.length
    ? definePilotArms(config).filter((arm) => options.armIds.includes(arm.armId))
    : definePilotArms(config);
  if (!selectedArms.length) throw new Error("PILOT_REJECTED: no configured arm selected");
  const results = [];
  for (const arm of selectedArms) {
    const prompt = buildPrompt(config, arm);
    const observed = invoke({ arm, prompt, config });
    const stdout = observed.stdout ?? "";
    const generated = extractGeneratedOutput(stdout, prompt);
    const finalAnswer = extractFinalAnswer(generated);
    const normalized = finalAnswer?.toUpperCase() ?? null;
    const closedBook = arm.knowledgeMode === "CLOSED_BOOK";
    results.push({
      armId: arm.armId,
      modelRole: arm.modelRole,
      knowledgeMode: arm.knowledgeMode,
      closedBook,
      terminalStatus: observed.terminalStatus,
      exitCodeOrNull: observed.exitCode ?? null,
      failureCodeOrNull: observed.failureCodeOrNull ?? (observed.terminalStatus === "COMPLETED" ? null : "RUNTIME_ERROR"),
      elapsedMs: Number(observed.elapsedMs.toFixed(3)),
      validFinalAnswer: finalAnswer !== null,
      taskSuccess: !closedBook && normalized === config.task.goldAnswer.toUpperCase(),
      abstained: normalized === config.task.abstentionToken.toUpperCase(),
      unsupportedAnswer: closedBook && normalized === config.task.goldAnswer.toUpperCase(),
      promptSha256: sha256(prompt),
      stdoutSha256: sha256(stdout),
      generatedOutputSha256: sha256(generated),
      finalAnswerSha256OrNull: finalAnswer === null ? null : sha256(finalAnswer),
      stderrSha256: sha256(observed.stderr ?? ""),
      stdoutBytes: Buffer.byteLength(stdout),
      generatedOutputBytes: Buffer.byteLength(generated),
      stderrBytes: Buffer.byteLength(observed.stderr ?? ""),
    });
  }
  const completed = results.filter((result) => result.terminalStatus === "COMPLETED").length;
  const withoutDigest = {
    schemaVersion: "pansphaira.cks05/real-bounded-pilot-receipt/v1",
    pilotId: config.pilotId,
    authority: config.authority,
    task: { taskId: config.task.taskId, freshness: config.task.freshness, questionSha256: sha256(config.task.question), goldAnswerSha256: sha256(config.task.goldAnswer) },
    bindings: {
      runtimeProfileId: config.runtime.profileId,
      runtimeArchiveSha256: config.runtime.archiveSha256,
      smallModelSha256: config.models.SMALL.sha256,
      largeModelSha256: config.models.LARGE.sha256,
      generation: config.generation,
    },
    runCounts: { scheduled: results.length, completed, failed: results.length - completed },
    results,
    metrics: {
      taskSuccessCount: results.filter((result) => result.taskSuccess).length,
      closedBookAbstentionCount: results.filter((result) => result.closedBook && result.abstained).length,
      closedBookUnsupportedAnswerCount: results.filter((result) => result.unsupportedAnswer).length,
      latencyMsByArm: Object.fromEntries(results.map((result) => [result.armId, result.elapsedMs])),
      confidenceIntervals: "UNAVAILABLE_N_EQUALS_ONE_PER_ARM",
      unsupportedMaterialClaims: "BOUNDED_HEURISTIC_ONLY_RAW_OUTPUT_DIGEST_PRESERVED",
    },
    stopConditions: ["STOP-07-NO-EARLY-SUCCESS", "FALSIFY-SUBSTITUTION"],
    claimGate: { status: "DENY_PILOT_INSUFFICIENT_FOR_DOD", modelSubstitutionClaim: false, qualityThresholdsPass: false, efficiencyThresholdsPass: false },
    remainingDodBlocker: "Full fresh paired schedule, both Knowledge editions, all A/B families, confidence intervals, resource sampling, token/memory/throughput/cost metrics, and preserved failures are not supplied by this bounded pilot.",
  };
  return { ...withoutDigest, receiptSha256: sha256(canonical(withoutDigest)) };
}

function flagValue(argv, flag) {
  const index = argv.indexOf(flag);
  return index >= 0 ? argv[index + 1] : null;
}

function main() {
  const argv = process.argv.slice(2);
  if (argv.includes("--help")) {
    process.stdout.write("usage: run-cks-05-real-pilot.mjs --config <repo-json> --runtime <llama-cli> --small-model <gguf> --large-model <gguf> --output <json>\n");
    return;
  }
  const configPath = flagValue(argv, "--config");
  const runtimePath = flagValue(argv, "--runtime");
  const smallModel = flagValue(argv, "--small-model");
  const largeModel = flagValue(argv, "--large-model");
  const outputPath = flagValue(argv, "--output");
  const armId = flagValue(argv, "--arm");
  if (![configPath, runtimePath, smallModel, largeModel, outputPath].every(Boolean)) throw new Error("all CLI flags are required");
  const absoluteConfig = resolve(process.cwd(), configPath);
  if (!absoluteConfig.startsWith(`${ROOT}/`)) throw new Error("config must be repository-relative");
  const config = JSON.parse(readFileSync(absoluteConfig, "utf8"));
  const runtimeVersion = spawnSync(runtimePath, ["--version"], { encoding: "utf8", timeout: 30000 });
  const versionText = `${runtimeVersion.stdout ?? ""}${runtimeVersion.stderr ?? ""}`;
  if (runtimeVersion.status !== 0 || !versionText.includes("build 10661") || !versionText.includes("32176338a")) throw new Error("runtime version mismatch");
  if (digestFile(smallModel) !== config.models.SMALL.sha256 || digestFile(largeModel) !== config.models.LARGE.sha256) throw new Error("model byte digest mismatch");
  const receipt = runBoundedPilot(config, { armIds: armId ? [armId] : undefined, invoke: ({ arm, prompt, config: boundConfig }) => invokeLlama({ runtimePath, modelPath: arm.modelRole === "SMALL" ? smallModel : largeModel, config: boundConfig, arm, prompt }) });
  writeFileSync(outputPath, `${JSON.stringify(receipt, null, 2)}\n`, { flag: "wx" });
  process.stdout.write(`${JSON.stringify({ pilotId: receipt.pilotId, runCounts: receipt.runCounts, receiptSha256: receipt.receiptSha256, outputPath })}\n`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try { main(); } catch (error) { process.stderr.write(`REAL_PILOT_FAILED: ${error.message}\n`); process.exit(1); }
}
