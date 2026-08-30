#!/usr/bin/env node
import { readFileSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const usage = "Usage: node scripts/verify-wikimedia-pilot.mjs --fixture <manifest.json> --offline-dry-run";

function argument(name) {
  const index = process.argv.indexOf(name);
  return index === -1 ? null : process.argv[index + 1] ?? null;
}

function loadFixture(root, fixturePath) {
  if (!fixturePath) throw new Error(`${usage}\nPILOT_FIXTURE_REQUIRED`);
  const absolute = path.resolve(root, fixturePath);
  let value;
  try {
    value = JSON.parse(readFileSync(absolute, "utf8"));
  } catch {
    throw new Error("PILOT_FIXTURE_READ_DENIED");
  }
  // Accept an evidence-schema envelope as well as a direct manifest. This
  // keeps the fixture machine-readable without making the runtime trust a
  // second, duplicated manifest copy.
  if (value && typeof value === "object" && value.manifest && typeof value.manifest === "object") return value.manifest;
  return value;
}

export async function runWikimediaPilotVerification({ root = process.cwd(), fixturePath, offlineDryRun = false } = {}) {
  if (!offlineDryRun) throw new Error("PILOT_NETWORKED_MODE_DENIED");
  const module = await import(pathToFileURL(path.join(root, "dist/packages/local-knowledge/src/wikimedia-pilot-evidence.js")));
  const manifest = loadFixture(root, fixturePath);
  const preflight = module.preflightWikimediaPilotV1(manifest);
  return {
    schemaVersion: module.WIKIMEDIA_PILOT_EVIDENCE_SCHEMA_V1,
    operation: "WIKIMEDIA_PILOT_VERIFY",
    network: "DISABLED",
    offlineDryRun: true,
    preflight,
    claims: [],
    note: "Manifest shape validated; no storage, import-time, or query-performance claim was measured or emitted.",
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const result = await runWikimediaPilotVerification({
      fixturePath: argument("--fixture"),
      offlineDryRun: process.argv.includes("--offline-dry-run"),
    });
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  } catch (error) {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 2;
  }
}
