import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import * as path from "node:path";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const CLI = path.join(ROOT, "src", "sales-stock", "cli.mjs");

function run(...args) {
  return spawnSync(process.execPath, [CLI, ...args], { cwd: ROOT, encoding: "utf8" });
}

test("documented npm entrypoint runs the positive journey, not usage", () => {
  const packageJson = JSON.parse(readFileSync(path.join(ROOT, "package.json"), "utf8"));
  assert.match(packageJson.scripts["sales-stock:journey"], /cli\.mjs run$/);
  const result = spawnSync("npm", ["run", "sales-stock:journey", "--silent"], { cwd: ROOT, encoding: "utf8" });
  assert.equal(result.status, 0, result.stderr);
  assert.equal(JSON.parse(result.stdout).outcome, "CONNECTED_SALES_STOCK_JOURNEY");
});

test("CLI positive path emits a connected journey", () => {
  const result = run("run");
  assert.equal(result.status, 0, result.stderr);
  const payload = JSON.parse(result.stdout);
  assert.equal(payload.outcome, "CONNECTED_SALES_STOCK_JOURNEY");
  assert.equal(payload.stages.replenishment.outcome, "NACHSCHUB_ERFORDERLICH");
});

test("CLI negative path emits a closed reservation denial", () => {
  const result = run("negative", "reservation-conflict");
  assert.equal(result.status, 0, result.stderr);
  const payload = JSON.parse(result.stdout);
  assert.deepEqual(
    { outcome: payload.outcome, stage: payload.stage, code: payload.code },
    { outcome: "DENIED", stage: "BESTAND_RESERVATION", code: "AENDERUNG_INSUFFICIENT_AVAILABLE" },
  );
});

test("CLI rejects unknown commands without fabricating a result", () => {
  const result = run("unknown");
  assert.equal(result.status, 1);
  assert.match(result.stderr, /UNKNOWN_COMMAND:unknown/);
  assert.equal(result.stdout, "");
});
