import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { test } from "node:test";
const modulePath = import.meta.url.endsWith(".ts") ? "../../src/cks-12/readonly-kaleidosphere-bridge.ts" : "../../src/cks-12/readonly-kaleidosphere-bridge.js";
const bridge: typeof import("../../src/cks-12/readonly-kaleidosphere-bridge.js") = await import(modulePath);
const bytes = readFileSync("tests/fixtures/cks-12/minimized-projection-v1.json"); const fixture = JSON.parse(bytes.toString("utf8")); const receipt = JSON.parse(readFileSync("verification/cks-12/readonly-candidate-receipt-v1.json", "utf8"));
const hash = (value: Uint8Array) => createHash("sha256").update(value).digest("hex");
test("CKS-12 SS-19 sends only minimized read-only projection and returns authority-free candidate", () => {
  const result = bridge.runReadOnlyMinimizedProjection(fixture); assert.deepEqual(result, receipt.candidate);
  assert.equal(result.status, "CANDIDATE_RECORDED"); if (result.status !== "CANDIDATE_RECORDED") return; assert.equal(result.inventedEdgeCount, 0); assert.equal(result.authority, "NONE");
});
test("non-dry-run, mutation, raw projection, and authority expansion fail closed", () => {
  for (const mutate of [(value: any) => { value.dryRun = false; }, (value: any) => { value.operation = "MUTATE"; }, (value: any) => { value.projection.nodes[0].secret = "raw"; }, (value: any) => { value.projection.edges.push({ from: "invented", to: "decision-001" }); }, (value: any) => { value.canonicalEvidenceAfterSha256 = "0".repeat(64); }, (value: any) => { value.promotionRequested = true; }, (value: any) => { value.authorityRequested = true; }]) { const value = structuredClone(fixture); mutate(value); assert.equal(bridge.runReadOnlyMinimizedProjection(value).status, "DENIED"); }
});
test("readonly fixture and receipt are canonical and bound", () => { assert.equal(bytes.toString("utf8"), bridge.canonicalJson(fixture)); assert.equal(receipt.fixtureSha256, hash(bytes)); const { receiptSha256, ...body } = receipt; assert.equal(receiptSha256, bridge.digest(body)); const result = bridge.runReadOnlyMinimizedProjection(fixture); if (result.status === "CANDIDATE_RECORDED") assert.deepEqual(bridge.createReceipt(receipt.fixtureSha256, result), receipt); });
