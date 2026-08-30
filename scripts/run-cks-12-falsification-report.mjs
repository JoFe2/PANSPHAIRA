#!/usr/bin/env node
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
const root = fileURLToPath(new URL("..", import.meta.url));
if (process.argv.length !== 3 || process.argv[2] !== "--dry-run") { console.error("usage: node scripts/run-cks-12-falsification-report.mjs --dry-run"); process.exitCode = 2; } else {
  const fixtureBytes = readFileSync(`${root}/tests/fixtures/cks-12/falsification-report-v1.json`);
  const fixture = JSON.parse(fixtureBytes.toString("utf8"));
  const validator = await import("../dist/src/cks-12/falsification-report-validator.js");
  const result = validator.validateFalsificationReport(fixture);
  const receipt = validator.createReceipt(createHash("sha256").update(fixtureBytes).digest("hex"), result);
  console.log(validator.canonicalJson(receipt));
  if (result.status !== "PASS_SYNTHETIC_ONLY") process.exitCode = 1;
}
