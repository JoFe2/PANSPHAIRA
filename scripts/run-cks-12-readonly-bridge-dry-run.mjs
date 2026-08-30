#!/usr/bin/env node
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

if (process.argv.length !== 3 || process.argv[2] !== "--dry-run") {
  console.error("usage: node scripts/run-cks-12-readonly-bridge-dry-run.mjs --dry-run");
  process.exitCode = 2;
} else {
  const root = fileURLToPath(new URL("..", import.meta.url));
  const fixture = JSON.parse(readFileSync(`${root}/tests/fixtures/cks-12/minimized-projection-v1.json`, "utf8"));
  const bridge = await import("../dist/src/cks-12/readonly-kaleidosphere-bridge.js");
  const result = bridge.runReadOnlyMinimizedProjection(fixture);
  console.log(bridge.canonicalJson(result));
  if (result.status !== "CANDIDATE_RECORDED") process.exitCode = 1;
}
