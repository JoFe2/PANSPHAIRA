import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { test } from "node:test";
const modulePath = import.meta.url.endsWith(".ts") ? "../../src/cks-12/readonly-kaleidosphere-bridge.ts" : "../../src/cks-12/readonly-kaleidosphere-bridge.js";
const bridge: typeof import("../../src/cks-12/readonly-kaleidosphere-bridge.js") = await import(modulePath);
const bytes = readFileSync("tests/fixtures/cks-12/minimized-projection-v1.json"); const fixture = JSON.parse(bytes.toString("utf8")); const receipt = JSON.parse(readFileSync("verification/cks-12/readonly-candidate-receipt-v1.json", "utf8"));
const hash = (value: Uint8Array) => createHash("sha256").update(value).digest("hex");
const topLevelEnvelopeKeysV1 = Object.freeze(["authorityRequested", "canonicalEvidenceAfterSha256", "canonicalEvidenceBeforeSha256", "capabilityRequested", "componentVersions", "dryRun", "operation", "projection", "promotionRequested", "schemaVersion"] as const);
const topLevelEnvelopeDenial = { status: "DENIED", reasonCodes: ["MISSING_INPUT"], details: ["bridge input must be an object"] };
test("CKS-12 SS-19 sends only minimized read-only projection and returns authority-free candidate", () => {
  const result = bridge.runReadOnlyMinimizedProjection(fixture); assert.deepEqual(result, receipt.candidate);
  assert.equal(result.status, "CANDIDATE_RECORDED"); if (result.status !== "CANDIDATE_RECORDED") return; assert.equal(result.inventedEdgeCount, 0); assert.equal(result.authority, "NONE");
});
test("v1 exact top-level own-data envelope preserves canonical candidate and receipt bytes", () => {
  assert.deepEqual(Reflect.ownKeys(fixture), topLevelEnvelopeKeysV1);
  for (const key of topLevelEnvelopeKeysV1) {
    const descriptor = Object.getOwnPropertyDescriptor(fixture, key);
    assert.ok(descriptor && descriptor.enumerable && "value" in descriptor, key);
  }
  const result = bridge.runReadOnlyMinimizedProjection(fixture);
  assert.equal(bridge.canonicalJson(result), bridge.canonicalJson(receipt.candidate));
  if (result.status === "CANDIDATE_RECORDED") assert.equal(bridge.canonicalJson(bridge.createReceipt(receipt.fixtureSha256, result)), bridge.canonicalJson(receipt));
});
test("top-level throwing Proxy reflection and get traps return a stable denial", () => {
  for (const trap of ["ownKeys", "getOwnPropertyDescriptor", "get", "getPrototypeOf"]) {
    let invocations = 0;
    const input = new Proxy(structuredClone(fixture), { [trap]: () => { invocations += 1; throw new Error("attacker trap"); } });
    assert.deepEqual(bridge.runReadOnlyMinimizedProjection(input), topLevelEnvelopeDenial, trap);
    assert.equal(invocations, 0, `${trap}: caller-controlled trap must not run`);
  }
});
test("top-level accessors are denied without invocation", () => {
  for (const key of topLevelEnvelopeKeysV1) {
    const value = structuredClone(fixture); let invocations = 0;
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (!descriptor || !("value" in descriptor)) throw new Error(`missing fixture data field: ${key}`);
    Object.defineProperty(value, key, { enumerable: true, configurable: true, get: () => { invocations += 1; return descriptor.value; } });
    assert.deepEqual(bridge.runReadOnlyMinimizedProjection(value), topLevelEnvelopeDenial, key);
    assert.equal(invocations, 0, key);
  }
});
test("missing, non-enumerable, and unknown top-level fields deny the exact v1 envelope", () => {
  for (const key of topLevelEnvelopeKeysV1) {
    const missing = structuredClone(fixture); delete missing[key];
    assert.deepEqual(bridge.runReadOnlyMinimizedProjection(missing), topLevelEnvelopeDenial, `missing:${key}`);
    const hidden = structuredClone(fixture);
    Object.defineProperty(hidden, key, { ...Object.getOwnPropertyDescriptor(hidden, key), enumerable: false });
    assert.deepEqual(bridge.runReadOnlyMinimizedProjection(hidden), topLevelEnvelopeDenial, `non-enumerable:${key}`);
  }
  const unknown = structuredClone(fixture); unknown.unknown = true;
  assert.deepEqual(bridge.runReadOnlyMinimizedProjection(unknown), topLevelEnvelopeDenial, "unknown enumerable field");
});
test("hidden and symbol authority, capability, promotion, raw, and unknown fields fail closed", () => {
  for (const field of ["authority", "capability", "promotion", "raw", "unknown"] as const) for (const surface of ["hidden", "symbol"] as const) {
    const value = structuredClone(fixture);
    const key: PropertyKey = surface === "hidden" ? field : Symbol(field);
    Object.defineProperty(value, key, { value: true, enumerable: surface === "symbol", configurable: true });
    assert.deepEqual(bridge.runReadOnlyMinimizedProjection(value), topLevelEnvelopeDenial, `${surface}:${field}`);
  }
});
test("v1 envelope locks its schema and requires explicit no-authority values", () => {
  const wrongVersion = structuredClone(fixture); wrongVersion.schemaVersion = "chimpmaera.cks/readonly-kaleidosphere-bridge/v2";
  assert.deepEqual(bridge.runReadOnlyMinimizedProjection(wrongVersion), { status: "DENIED", reasonCodes: ["VERSION_LOCK_MISMATCH"], details: ["bridge envelope schema mismatch"] });
  for (const field of ["authorityRequested", "capabilityRequested", "promotionRequested"] as const) for (const invalid of [true, null, 0, "false", undefined]) {
    const value = structuredClone(fixture); value[field] = invalid;
    assert.deepEqual(bridge.runReadOnlyMinimizedProjection(value), { status: "DENIED", reasonCodes: ["AUTHORITY_EXPANSION_DENIED"], details: ["candidate delivery cannot expand authority, capability, or promotion"] }, `${field}:${String(invalid)}`);
  }
});
test("non-dry-run, mutation, raw projection, and authority expansion fail closed", () => {
  for (const mutate of [(value: any) => { value.dryRun = false; }, (value: any) => { value.operation = "MUTATE"; }, (value: any) => { value.projection.nodes[0].secret = "raw"; }, (value: any) => { value.projection.edges.push({ from: "invented", to: "decision-001" }); }, (value: any) => { value.canonicalEvidenceAfterSha256 = "0".repeat(64); }, (value: any) => { value.promotionRequested = true; }, (value: any) => { value.authorityRequested = true; }]) { const value = structuredClone(fixture); mutate(value); assert.equal(bridge.runReadOnlyMinimizedProjection(value).status, "DENIED"); }
});
const structuralDenial = { status: "DENIED", reasonCodes: ["RAW_PROJECTION_DENIED"], details: ["projection must contain only minimized schema fields"] };
const nodeShapeDenial = { status: "DENIED", reasonCodes: ["RAW_PROJECTION_DENIED"], details: ["projection nodes may contain only identifiers and kinds"] };
const edgeShapeDenial = { status: "DENIED", reasonCodes: ["INVENTED_EDGE_DENIED"], details: ["every minimized edge endpoint must be reconstructible from projected nodes"] };
test("missing projection returns a stable structural denial", () => {
  const value = structuredClone(fixture); delete value.projection;
  assert.deepEqual(bridge.runReadOnlyMinimizedProjection(value), topLevelEnvelopeDenial);
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

const deliveryHead = "1".repeat(40);
const deliveryTree = "2".repeat(40);
const deliveryAuthorityExpectation = () => Object.freeze({
  mutable: false,
  independentReviewCount: 1,
  independentReviewOwner: "ROOT_QS_SOL_FINAL_OWNER",
  workerExternalEffect: "NONE",
  deferredActions: Object.freeze([...bridge.FND_PS_FU_01_DELIVERY_POLICY.authorityExpectation.deferredActions]),
});
const deliveryCandidate = () => ({
  schemaVersion: bridge.FND_PS_FU_01_DELIVERY_POLICY.schemaVersion,
  taskId: bridge.FND_PS_FU_01_DELIVERY_POLICY.taskId,
  baseHead: bridge.FND_PS_FU_01_DELIVERY_POLICY.baseHead,
  candidateHead: deliveryHead,
  candidateTree: deliveryTree,
  observedHead: deliveryHead,
  observedTree: deliveryTree,
  changedPaths: [...bridge.FND_PS_FU_01_DELIVERY_POLICY.scope],
  gateReceipts: bridge.FND_PS_FU_01_DELIVERY_POLICY.gateInputs.map(({ gateId, gateInput }) => ({ gateId, gateInput, status: "PASS", candidateHead: deliveryHead, candidateTree: deliveryTree, outputSha256: "3".repeat(64) })),
  integrityReceipts: bridge.FND_PS_FU_01_DELIVERY_POLICY.integrityReceiptPaths.map((path) => ({ path, status: "VERIFIED", sha256: "4".repeat(64), candidateHead: deliveryHead, candidateTree: deliveryTree })),
  issueAcceptance: bridge.FND_PS_FU_01_DELIVERY_POLICY.issueAcceptance.map(({ criterionId, evidenceId }) => ({ criterionId, evidenceId, status: "PASS" })),
  authorityExpectation: deliveryAuthorityExpectation(),
});
const deliveryReasonCodes = (value: unknown) => {
  const result = bridge.evaluateFndPsFu01DeliveryReadiness(value);
  assert.equal(result.status, "NOT_READY");
  return result.status === "NOT_READY" ? result.reasonCodes : [];
};
test("exact cumulative head, tree, gates, integrity receipts, and issue acceptance are reproducible", () => {
  const input = deliveryCandidate();
  const expected = {
    status: "READY_FOR_ONE_INDEPENDENT_ISSUE_REVIEW",
    taskId: "CAMPAIGN-V1-FND-PS-FU-01-DELIVERY-01",
    candidateHead: deliveryHead,
    candidateTree: deliveryTree,
    independentReviewCount: 1,
    independentReviewOwner: "ROOT_QS_SOL_FINAL_OWNER",
    authority: "NONE",
    effect: "NONE",
    fullPublicClosureClaimed: false,
  };
  assert.deepEqual(bridge.evaluateFndPsFu01DeliveryReadiness(input), expected);
  assert.deepEqual(bridge.evaluateFndPsFu01DeliveryReadiness(input), expected);
  const packageJson = JSON.parse(readFileSync("package.json", "utf8"));
  assert.equal(packageJson.scripts["fnd-ps-fu-01:test"], "npm run build --silent && node --test dist/tests/cks-12/readonly-kaleidosphere-bridge.test.js");
  const gateInputs: readonly string[] = bridge.FND_PS_FU_01_DELIVERY_POLICY.gateInputs.map(({ gateInput }) => gateInput);
  assert.equal(gateInputs.includes("npm test"), false);
  assert.deepEqual(bridge.FND_PS_FU_01_DELIVERY_POLICY.authorityExpectation.deferredActions, ["INDEPENDENT_REVIEW", "FINAL_FULL_SUITE", "PR", "CI", "MERGE", "RELEASE", "ANONYMOUS_READBACK", "ISSUE_CLOSURE"]);
});
test("missing gate prevents delivery readiness", () => {
  const input = deliveryCandidate(); input.gateReceipts.pop();
  assert.deepEqual(deliveryReasonCodes(input), ["MISSING_GATE"]);
});
test("stale candidate or gate head prevents delivery readiness", () => {
  const staleCandidate = deliveryCandidate(); staleCandidate.observedHead = "5".repeat(40);
  assert.deepEqual(deliveryReasonCodes(staleCandidate), ["STALE_HEAD"]);
  const staleGate = deliveryCandidate(); staleGate.gateReceipts[0]!.candidateTree = "6".repeat(40);
  assert.deepEqual(deliveryReasonCodes(staleGate), ["STALE_HEAD"]);
});
test("scope drift prevents delivery readiness", () => {
  const input = deliveryCandidate(); input.changedPaths.push("outside/allowlist");
  assert.deepEqual(deliveryReasonCodes(input), ["SCOPE_DRIFT"]);
});
test("unresolved or remapped issue criterion prevents delivery readiness", () => {
  const unresolved = deliveryCandidate(); unresolved.issueAcceptance[0]!.status = "PENDING";
  assert.deepEqual(deliveryReasonCodes(unresolved), ["UNRESOLVED_CRITERION"]);
  const remapped = deliveryCandidate(); (remapped.issueAcceptance[0] as { evidenceId: string }).evidenceId = "SELF_ATTESTED";
  assert.deepEqual(deliveryReasonCodes(remapped), ["UNRESOLVED_CRITERION"]);
});
test("mutable authority expectation prevents delivery readiness", () => {
  const input = deliveryCandidate(); input.authorityExpectation = { ...deliveryAuthorityExpectation() } as typeof input.authorityExpectation;
  assert.deepEqual(deliveryReasonCodes(input), ["MUTABLE_AUTHORITY_EXPECTATION"]);
});
test("missing or malformed integrity receipt prevents delivery readiness", () => {
  const missing = deliveryCandidate(); missing.integrityReceipts.pop();
  assert.deepEqual(deliveryReasonCodes(missing), ["INTEGRITY_RECEIPT_INVALID"]);
  const malformed = deliveryCandidate(); malformed.integrityReceipts[0]!.sha256 = "0".repeat(63);
  assert.deepEqual(deliveryReasonCodes(malformed), ["INTEGRITY_RECEIPT_INVALID"]);
});
