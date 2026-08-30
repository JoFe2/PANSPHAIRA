import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { test } from "node:test";
const script = "scripts/run-cks-12-e2e-proof-dry-run.mjs";
test("CKS-12 e2e proof readback includes every accepted package head and 23 ordered steps", () => { const result = spawnSync(process.execPath, ["--jitless", script, "--dry-run"], { encoding: "utf8" }); assert.equal(result.status, 0, result.stderr); const receipt = JSON.parse(result.stdout); assert.equal(receipt.result.status, "PASS_SYNTHETIC_ONLY"); assert.equal(receipt.result.storyStepCount, 23); assert.equal(receipt.result.packageHeadIds.length, 8); });
test("missing or conflicting package heads block e2e integration", async () => { const { runE2eProof } = await import(`${process.cwd()}/${script}`); const fixture = JSON.parse(readFileSync("tests/fixtures/cks-12/e2e-proof-manifest-v1.json", "utf8")); fixture.packageHeads.pop(); assert.equal(runE2eProof(fixture).status, "ABORTED"); });
