#!/usr/bin/env node
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

import { verifyBaselineEvidence } from "./verify-cks-04-baseline-evidence.mjs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const readJson = (path) => JSON.parse(readFileSync(resolve(ROOT, path), "utf8"));
const line = (label, value) => `${label}: ${value}`;

export function renderPublicReadback(evidence) {
  const verified = verifyBaselineEvidence(evidence, { allowTemplate: true });
  const { report, p2, p3, failed, abstained } = verified;
  const bindings = evidence.bindings;
  const renderBinding = (name, binding) => {
    if (name === "knowledge") return `  ${name}: ${binding.editionId} @ ${binding.version} sha256=${binding.digest} contract=${binding.contractVersion}`;
    if (name === "semanticVerifier") return `  ${name}: ${binding.id} @ ${binding.version} rubric=${binding.rubricId} trusted=${binding.trusted}`;
    return `  ${name}: ${binding.id} @ ${binding.version} sha256=${binding.digest}`;
  };
  const abstentionRows = abstained.length === 0
    ? ["  (none)"]
    : abstained.map((result) => `  ${result.scenarioId} [${result.category}] -> ${result.actualReasonCodes.join(",")}`);
  const failureRows = failed.length === 0
    ? ["  (none)"]
    : failed.map((result) => `  ${result.scenarioId} -> ${result.actualReasonCodes.join(",")}`);
  return [
    "CKS-04 LOCAL PUBLIC READBACK",
    line("qualification", evidence.qualificationStatus),
    line("publication", `${evidence.publication.scope}; external=${evidence.publication.externalPublicationAuthorized}`),
    line("baselineDigest", report.baselineDigest),
    "",
    "EXACT BINDINGS",
    ...Object.entries(bindings).map(([name, binding]) => renderBinding(name, binding)),
    "",
    "COUNTS",
    line("  total cases", evidence.counts.totalCases),
    line("  P2", `${evidence.counts.p2.totalCases} cases; pass=${evidence.counts.p2.passes}; abstain=${evidence.counts.p2.abstentions}; failures=${evidence.counts.p2.failures}`),
    line("  P3", `${evidence.counts.p3.totalCases} cases; pass=${evidence.counts.p3.passes}; abstain=${evidence.counts.p3.abstentions}; failures=${evidence.counts.p3.failures}`),
    line("  verified receipts", evidence.counts.receiptVerifiedCases),
    line("  verified passes", evidence.counts.verifiedPasses),
    line("  fail-closed abstentions", evidence.counts.failClosedAbstentions),
    "",
    "FAILURES",
    ...failureRows,
    "",
    "ABSTENTIONS",
    ...abstentionRows,
    "",
    "VERIFIER SEPARATION",
    `  deterministic: ${evidence.verifierSeparation.deterministic.verifierId} protocol=${evidence.verifierSeparation.deterministic.protocolId} version=${evidence.verifierSeparation.deterministic.version} trusted=${evidence.verifierSeparation.deterministic.trusted}`,
    `  semantic: ${evidence.verifierSeparation.semantic.verifierId} rubric=${evidence.verifierSeparation.semantic.rubricId} version=${evidence.verifierSeparation.semantic.version} trusted=${evidence.verifierSeparation.semantic.trusted} override=${evidence.verifierSeparation.semantic.mayOverrideDeterministicFailure}`,
    "",
    "NONCLAIMS REVIEW",
    ...evidence.nonclaims.map((claim) => `  - ${claim}`),
    "",
    "REPLAY",
    line("  mode", evidence.replay.mode),
    line("  scenarios", report.results.map((result) => result.scenarioId).join(", ")),
    line("  semantic result", "not evaluated / not trusted"),
  ].join("\n");
}

function parseArgs(argv) {
  const args = new Map();
  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];
    if (value === "--input") args.set("input", argv[++index]);
    else if (value === "--dry-run") args.set("dryRun", true);
    else throw new Error(`UNKNOWN_ARGUMENT:${value}`);
  }
  if (typeof args.get("input") !== "string" || args.get("dryRun") !== true) {
    throw new Error("USAGE: --input <evidence.json> --dry-run");
  }
  return args;
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  process.stdout.write(`${renderPublicReadback(readJson(args.get("input")))}\n`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    main();
  } catch (error) {
    process.stderr.write(`CKS-04 public readback denied: ${error instanceof Error ? error.message : "READBACK_FAILED"}\n`);
    process.exitCode = 1;
  }
}
