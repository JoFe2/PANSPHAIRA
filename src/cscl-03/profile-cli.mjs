#!/usr/bin/env node
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import process from "node:process";

import { buildErpnextProfile, captureErpnextSources, verifyErpnextProfileBundle } from "./profile-builder.mjs";
import { sha256Bytes } from "../cscl-01/protocol.mjs";

function parseArgs(argv) {
  const [command, ...rest] = argv;
  const options = {};
  for (let index = 0; index < rest.length; index += 1) {
    const token = rest[index];
    if (token === "--network") {
      options.network = true;
      continue;
    }
    if (!["--repo-root", "--fixture-root", "--output-dir"].includes(token) || !rest[index + 1]) throw new Error(`INVALID_ARGUMENT:${token}`);
    options[token.slice(2).replaceAll("-", "_")] = rest[index + 1];
    index += 1;
  }
  return { command, options };
}

function jsonBytes(value) {
  return Buffer.from(`${JSON.stringify(value, null, 2)}\n`);
}

async function main() {
  const { command, options } = parseArgs(process.argv.slice(2));
  const repoRoot = resolve(options.repo_root ?? process.cwd());
  const fixtureRoot = resolve(options.fixture_root ?? resolve(repoRoot, "tests/fixtures/cscl-03"));
  if (command === "capture") {
    const manifest = await captureErpnextSources({ fixtureRoot, allowNetwork: options.network === true });
    process.stdout.write(`${JSON.stringify({ captured: manifest.sources.length, totalDecodedBytes: manifest.totalDecodedBytes })}\n`);
    return;
  }
  if (command !== "build") throw new Error("COMMAND_MUST_BE_BUILD_OR_CAPTURE");
  const outputDir = resolve(options.output_dir ?? resolve(repoRoot, "verification/cscl-03-build"));
  const built = await buildErpnextProfile({ repoRoot, fixtureRoot });
  const verification = await verifyErpnextProfileBundle(built.bundle, { repoRoot, fixtureRoot });
  if (verification.outcome !== "VERIFIED") throw new Error(`PROFILE_VERIFICATION_FAILED:${verification.reasonCodes.join(",")}`);
  await mkdir(outputDir, { recursive: true });
  const artifacts = {
    "source-facts-v1.json": built.bundle.sourceFacts,
    "evidence-cells-v1.json": built.bundle.evidenceCells,
    "system-profile-v1.json": built.bundle.systemProfile,
  };
  const artifactDigests = {};
  for (const [name, value] of Object.entries(artifacts)) {
    const bytes = jsonBytes(value);
    await writeFile(resolve(outputDir, name), bytes);
    artifactDigests[name] = sha256Bytes(bytes);
  }
  const receipt = {
    schemaVersion: "pansphaira.cscl03/build-receipt/v1",
    systemId: "erpnext",
    version: "v16.33.0",
    commit: "b24c9eba551905e256e336ff170a91a92d197a2f",
    counts: {
      capturedSources: 9,
      decodedSourceBytes: 306404,
      capabilityFamilies: 3,
      questionsPerFamily: 12,
      sourceFacts: built.bundle.sourceFacts.length,
      evidenceCells: built.bundle.evidenceCells.length,
      sourceNativeTerms: built.bundle.systemProfile.sourceNativeTerminology.length,
    },
    protocolBindings: built.bundle.protocolBindings,
    captureManifestDigest: built.bundle.captureManifestDigest,
    bundleDigest: built.digest,
    artifactDigests,
    verification,
    nonClaims: built.bundle.nonClaims,
    boundary: built.bundle.boundary,
  };
  await writeFile(resolve(outputDir, "build-receipt-v1.json"), jsonBytes(receipt));
  process.stdout.write(`${JSON.stringify(receipt)}\n`);
}

main().catch((error) => {
  process.stderr.write(`${error.message}\n`);
  process.exitCode = 1;
});
