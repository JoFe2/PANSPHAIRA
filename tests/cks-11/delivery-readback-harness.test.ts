import { strict as assert } from "node:assert";
import { spawnSync } from "node:child_process";
import { describe, it } from "node:test";

function run(...args: string[]) { return spawnSync(process.execPath, ["scripts/validate-cks-11-delivery-readback.mjs", ...args], { encoding: "utf8" }); }
void describe("CKS-11 delivery readback harness", () => {
  void it("binds delivered #289 evidence without inventing external closure", () => {
    const result = run("--self-test"); assert.equal(result.status, 0, result.stderr); assert.match(result.stdout, /LOCAL_PACKAGE_VALID_EXTERNAL_CLOSURE_BLOCKED/); assert.match(result.stdout, /EXTERNAL_READBACK_REQUIRED/); assert.match(result.stdout, /RELEASE_REQUIRED_PENDING_DELIVERY/);
  });
  void it("fails closed if local synthetic evidence is asked to close PR CI merge activation or public-main", () => {
    const result = run("--require-closure"); assert.notEqual(result.status, 0); assert.match(result.stderr, /EXTERNAL_READBACK_REQUIRED/);
  });
});
