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
test("throwing projection, node, and edge reflection traps return stable denials", () => {
  const attacks: Array<{ layer: string; expected: typeof structuralDenial; install: (value: any, trap: string) => void }> = [
    { layer: "projection", expected: structuralDenial, install: (value, trap) => { value.projection = new Proxy(value.projection, { [trap]: () => { throw new Error("attacker trap"); } }); } },
    { layer: "node", expected: nodeShapeDenial, install: (value, trap) => { value.projection.nodes[0] = new Proxy(value.projection.nodes[0], { [trap]: () => { throw new Error("attacker trap"); } }); } },
    { layer: "edge", expected: edgeShapeDenial, install: (value, trap) => { value.projection.edges[0] = new Proxy(value.projection.edges[0], { [trap]: () => { throw new Error("attacker trap"); } }); } },
  ];
  for (const attack of attacks) for (const trap of ["getPrototypeOf", "ownKeys", "getOwnPropertyDescriptor", "get"]) {
    const value = structuredClone(fixture); attack.install(value, trap);
    assert.deepEqual(bridge.runReadOnlyMinimizedProjection(value), attack.expected, `${attack.layer}:${trap}`);
  }
});
test("projection, node, and edge accessors are denied without invocation", () => {
  for (const layer of ["projection", "node", "edge"] as const) {
    const value = structuredClone(fixture); let invocations = 0;
    const target = layer === "projection" ? value.projection : layer === "node" ? value.projection.nodes[0] : value.projection.edges[0];
    const property = layer === "projection" ? "projectionId" : layer === "node" ? "id" : "from";
    Object.defineProperty(target, property, { enumerable: true, configurable: true, get: () => { invocations += 1; throw new Error("accessor invoked"); } });
    const expected = layer === "projection" ? structuralDenial : layer === "node" ? nodeShapeDenial : edgeShapeDenial;
    assert.deepEqual(bridge.runReadOnlyMinimizedProjection(value), expected, layer);
    assert.equal(invocations, 0, layer);
  }
});
test("non-enumerable and symbol own keys cannot bypass minimized shapes", () => {
  for (const layer of ["projection", "node", "edge"] as const) for (const hiddenKey of ["non-enumerable", "symbol"] as const) {
    const value = structuredClone(fixture);
    const target = layer === "projection" ? value.projection : layer === "node" ? value.projection.nodes[0] : value.projection.edges[0];
    if (hiddenKey === "symbol") target[Symbol("raw")] = true;
    else Object.defineProperty(target, "raw", { value: true, enumerable: false });
    const expected = layer === "projection" ? structuralDenial : layer === "node" ? nodeShapeDenial : edgeShapeDenial;
    assert.deepEqual(bridge.runReadOnlyMinimizedProjection(value), expected, `${layer}:${hiddenKey}`);
  }
});
test("multi-defect denials keep sorted reason codes aligned one-to-one with details", () => {
  const value = structuredClone(fixture);
  value.componentVersions.bridge = "wrong";
  value.dryRun = false;
  value.operation = "MUTATE";
  value.projection.raw = true;
  value.canonicalEvidenceAfterSha256 = "0".repeat(64);
  value.authorityRequested = true;
  assert.deepEqual(bridge.runReadOnlyMinimizedProjection(value), {
    status: "DENIED",
    reasonCodes: ["AUTHORITY_EXPANSION_DENIED", "DRY_RUN_REQUIRED", "KALEIDOSPHERE_MUTATION_DENIED", "RAW_PROJECTION_DENIED", "VERSION_LOCK_MISMATCH"],
    details: [
      "candidate delivery cannot expand authority, capability, or promotion",
      "only dry-run invocation is permitted",
      "canonical PanSphaira evidence must be digest-identical before and after analysis; only the read-only minimized operation is permitted",
      "projection must contain only minimized schema fields",
      "component lock mismatch",
    ],
  });
});
test("readonly fixture and receipt are canonical and bound", () => { assert.equal(bytes.toString("utf8"), bridge.canonicalJson(fixture)); assert.equal(receipt.fixtureSha256, hash(bytes)); const { receiptSha256, ...body } = receipt; assert.equal(receiptSha256, bridge.digest(body)); const result = bridge.runReadOnlyMinimizedProjection(fixture); if (result.status === "CANDIDATE_RECORDED") assert.deepEqual(bridge.createReceipt(receipt.fixtureSha256, result), receipt); });
