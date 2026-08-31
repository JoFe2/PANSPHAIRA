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
const structuralDenial = { status: "DENIED", reasonCodes: ["RAW_PROJECTION_DENIED"], details: ["projection must contain only minimized schema fields"] };
const nodeShapeDenial = { status: "DENIED", reasonCodes: ["RAW_PROJECTION_DENIED"], details: ["projection nodes may contain only identifiers and kinds"] };
const edgeShapeDenial = { status: "DENIED", reasonCodes: ["INVENTED_EDGE_DENIED"], details: ["every minimized edge endpoint must be reconstructible from projected nodes"] };
test("missing projection returns a stable structural denial", () => {
  const value = structuredClone(fixture); delete value.projection;
  assert.deepEqual(bridge.runReadOnlyMinimizedProjection(value), structuralDenial);
});
test("missing, null, and non-array nodes and edges return stable structural denials", () => {
  for (const field of ["nodes", "edges"] as const) for (const invalid of [undefined, null, {}, "not-an-array"]) {
    const value = structuredClone(fixture); if (invalid === undefined) delete value.projection[field]; else value.projection[field] = invalid;
    assert.deepEqual(bridge.runReadOnlyMinimizedProjection(value), structuralDenial, `${field}:${String(invalid)}`);
  }
});
test("duplicate node identifiers return a stable raw-projection denial", () => {
  const value = structuredClone(fixture); value.projection.nodes[1].id = value.projection.nodes[0].id;
  assert.deepEqual(bridge.runReadOnlyMinimizedProjection(value), { status: "DENIED", reasonCodes: ["RAW_PROJECTION_DENIED"], details: ["projection node identifiers must be unique"] });
});
test("malformed node shapes return a stable raw-projection denial", () => {
  for (const invalid of [null, {}, { id: 1, kind: "KNOWLEDGE" }, { id: "knowledge-001", kind: 1 }, { id: "knowledge-001", kind: "KNOWLEDGE", raw: true }]) {
    const value = structuredClone(fixture); value.projection.nodes = [invalid];
    assert.deepEqual(bridge.runReadOnlyMinimizedProjection(value), nodeShapeDenial);
  }
});
test("malformed edge shapes return a stable invented-edge denial", () => {
  for (const invalid of [null, {}, { from: 1, to: "decision-001" }, { from: "knowledge-001", to: 1 }, { from: "knowledge-001", to: "decision-001", raw: true }, { from: "invented", to: "decision-001" }]) {
    const value = structuredClone(fixture); value.projection.edges = [invalid];
    assert.deepEqual(bridge.runReadOnlyMinimizedProjection(value), edgeShapeDenial);
  }
});
test("readonly fixture and receipt are canonical and bound", () => { assert.equal(bytes.toString("utf8"), bridge.canonicalJson(fixture)); assert.equal(receipt.fixtureSha256, hash(bytes)); const { receiptSha256, ...body } = receipt; assert.equal(receiptSha256, bridge.digest(body)); const result = bridge.runReadOnlyMinimizedProjection(fixture); if (result.status === "CANDIDATE_RECORDED") assert.deepEqual(bridge.createReceipt(receipt.fixtureSha256, result), receipt); });
