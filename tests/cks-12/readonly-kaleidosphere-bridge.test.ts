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

type MutableV2 = Record<string, any>;
type EdgeEvidenceEnvelopeV2 = import("../../src/cks-12/readonly-kaleidosphere-bridge.js").EdgeEvidenceEnvelopeV2;
type V2Result = import("../../src/cks-12/readonly-kaleidosphere-bridge.js").CandidateV2 | import("../../src/cks-12/readonly-kaleidosphere-bridge.js").Denied;
const v2Bytes = readFileSync("tests/fixtures/cks-12/edge-authority-v2.json");
const v2Fixture = JSON.parse(v2Bytes.toString("utf8")) as MutableV2;
const cloneV2 = (): MutableV2 => structuredClone(v2Fixture) as MutableV2;
const runV2 = (value: unknown): V2Result => bridge.runReadOnlyMinimizedProjection(value as EdgeEvidenceEnvelopeV2);
const v2Denial = (value: unknown, expectedReasonCode: string): import("../../src/cks-12/readonly-kaleidosphere-bridge.js").Denied => {
  const result = runV2(value);
  assert.equal(result.status, "DENIED");
  if (result.status === "DENIED") {
    assert.ok(result.reasonCodes.includes(expectedReasonCode as never), `${expectedReasonCode}: ${JSON.stringify(result)}`);
    return result;
  }
  throw new Error("expected v2 denial");
};
const redigestEdge = (edge: MutableV2): MutableV2 => {
  const { evidenceBindingSha256: _ignored, ...body } = edge;
  return { ...body, evidenceBindingSha256: bridge.digest(body) };
};
type FndPs02AdversarialCase = Readonly<{ caseId: string; expectedReasonCode: string; mutate: (value: MutableV2) => void }>;
const FND_PS_02_ADVERSARIAL_MATRIX: readonly FndPs02AdversarialCase[] = Object.freeze([
  {
    caseId: "PAIRED_ENDPOINT_EVIDENCE_SUBSTITUTION",
    expectedReasonCode: "EDGE_EVIDENCE_AUTHORITY_DENIED",
    mutate: (value) => {
      value.projection.nodes[0].id = "knowledge-forged-001";
      value.projection.edges[0] = redigestEdge({
        ...value.projection.edges[0],
        canonicalKnowledge: { ...value.projection.edges[0].canonicalKnowledge, knowledgeId: "CKS-12-KNOWLEDGE-FORGED-001" },
        evidence: [{ ...value.projection.edges[0].evidence[0], evidenceId: "CKS-12-FORGED-VALIDATION-001" }, value.projection.edges[0].evidence[1]],
        from: "knowledge-forged-001",
      });
    },
  },
  {
    caseId: "FULLY_REDIGESTED_FORGED_RELATION",
    expectedReasonCode: "EDGE_EVIDENCE_AUTHORITY_DENIED",
    mutate: (value) => { value.projection.edges[0] = redigestEdge({ ...value.projection.edges[0], relation: "KNOWLEDGE_DECIDES" }); },
  },
  {
    caseId: "STALE_EVIDENCE_REFERENCE",
    expectedReasonCode: "EDGE_EVIDENCE_AUTHORITY_DENIED",
    mutate: (value) => { value.projection.edges[0].evidence[0].evidenceSha256 = "0".repeat(64); },
  },
  {
    caseId: "STALE_CANONICAL_KNOWLEDGE_BINDING",
    expectedReasonCode: "EDGE_EVIDENCE_AUTHORITY_DENIED",
    mutate: (value) => { value.projection.edges[0].canonicalKnowledge.knowledgeSha256 = "1".repeat(64); },
  },
  {
    caseId: "INCOMPLETE_EVIDENCE_DENOMINATOR",
    expectedReasonCode: "EDGE_EVIDENCE_AUTHORITY_DENIED",
    mutate: (value) => { value.projection.edges[0].evidence.pop(); },
  },
  {
    caseId: "ENDPOINTS_WITHOUT_EVIDENCE",
    expectedReasonCode: "EDGE_EVIDENCE_AUTHORITY_DENIED",
    mutate: (value) => {
      value.projection.edges[0].evidence = [];
      value.projection.edges[0] = redigestEdge(value.projection.edges[0]);
    },
  },
  {
    caseId: "PROMOTION_REQUEST",
    expectedReasonCode: "AUTHORITY_EXPANSION_DENIED",
    mutate: (value) => { value.promotionRequested = true; },
  },
  {
    caseId: "CANONICAL_KNOWLEDGE_MUTATION",
    expectedReasonCode: "KALEIDOSPHERE_MUTATION_DENIED",
    mutate: (value) => { value.canonicalEvidenceBeforeSha256 = "f".repeat(64); },
  },
]);
const assertDeepFrozen = (value: unknown): void => {
  if (value === null || typeof value !== "object") return;
  assert.equal(Object.isFrozen(value), true);
  for (const nested of Object.values(value as Record<string, unknown>)) assertDeepFrozen(nested);
};

test("FND-PS-02 accepts the exact owner-derived v2 edge and keeps every relation non-authoritative", () => {
  assert.equal(v2Bytes.toString("utf8"), bridge.canonicalJson(v2Fixture));
  assert.equal(bridge.digest(bridge.PanSphairaEdgeEvidenceInputsV2), bridge.FND_PS_02_EDGE_EVIDENCE_CONTRACT_V2.ownerEvidenceInputsSha256);
  const result = runV2(v2Fixture);
  assert.equal(result.status, "CANDIDATE_RECORDED");
  if (result.status !== "CANDIDATE_RECORDED") return;
  const suppliedEdge = v2Fixture.projection.edges[0];
  const returnedEdge = result.edges[0];
  assert.ok(returnedEdge);
  const { authority: _authority, effect: _effect, relationTruth: _relationTruth, ...returnedBinding } = returnedEdge!;
  assert.deepEqual(returnedBinding, suppliedEdge);
  const { evidenceBindingSha256, authority: _edgeAuthority, effect: _edgeEffect, relationTruth: _edgeRelationTruth, ...bindingBody } = returnedEdge!;
  assert.equal(bridge.digest(bindingBody), evidenceBindingSha256);
  assert.equal(result.projectionSha256, bridge.digest(v2Fixture.projection));
  assert.equal(result.canonicalEvidenceSha256, bridge.PanSphairaEdgeEvidenceInputsV2.canonicalKnowledge.knowledgeSha256);
  assert.equal(result.edgeEvidenceAuthoritySha256, bridge.FND_PS_02_EDGE_EVIDENCE_CONTRACT_V2.ownerEvidenceInputsSha256);
  assert.equal(result.edgeEvidenceAuthorityVersion, bridge.EDGE_EVIDENCE_AUTHORITY_VERSION_V2);
  assert.equal(result.relationTruth, "NOT_GRANTED");
  assert.equal(result.canonicalKnowledgeMutation, "NONE");
  assert.equal(result.promotion, "NOT_AUTHORIZED");
  assert.equal(result.authority, "NONE");
  assert.equal(result.effect, "NONE");
  assert.deepEqual(result.nonclaims, bridge.FND_PS_02_EDGE_EVIDENCE_CONTRACT_V2.nonclaims);
  assertDeepFrozen(result);
});

test("FND-PS-02 reusable adversarial matrix denies every owner/evidence authority substitution", () => {
  for (const adversarialCase of FND_PS_02_ADVERSARIAL_MATRIX) {
    const value = cloneV2();
    adversarialCase.mutate(value);
    v2Denial(value, adversarialCase.expectedReasonCode);
  }
});

test("FND-PS-02 paired endpoint/evidence substitutions fail even after self-redigest", () => {
  const value = cloneV2();
  value.projection.nodes[0].id = "knowledge-forged-001";
  value.projection.edges[0] = redigestEdge({
    ...value.projection.edges[0],
    canonicalKnowledge: { ...value.projection.edges[0].canonicalKnowledge, knowledgeId: "CKS-12-KNOWLEDGE-FORGED-001" },
    evidence: [{ ...value.projection.edges[0].evidence[0], evidenceId: "CKS-12-FORGED-VALIDATION-001" }, value.projection.edges[0].evidence[1]],
    from: "knowledge-forged-001",
  });
  v2Denial(value, "EDGE_EVIDENCE_AUTHORITY_DENIED");
});

test("FND-PS-02 fully re-digested forged relation remains denied", () => {
  const value = cloneV2();
  value.projection.edges[0] = redigestEdge({ ...value.projection.edges[0], relation: "KNOWLEDGE_DECIDES" });
  v2Denial(value, "EDGE_EVIDENCE_AUTHORITY_DENIED");
});

test("FND-PS-02 stale and incomplete evidence fail closed", () => {
  const staleEvidence = cloneV2();
  staleEvidence.projection.edges[0].evidence[0].evidenceSha256 = "0".repeat(64);
  v2Denial(staleEvidence, "EDGE_EVIDENCE_AUTHORITY_DENIED");

  const staleKnowledge = cloneV2();
  staleKnowledge.projection.edges[0].canonicalKnowledge.knowledgeSha256 = "1".repeat(64);
  v2Denial(staleKnowledge, "EDGE_EVIDENCE_AUTHORITY_DENIED");

  const incomplete = cloneV2();
  incomplete.projection.edges[0].evidence.pop();
  v2Denial(incomplete, "EDGE_EVIDENCE_AUTHORITY_DENIED");

  const missingBinding = cloneV2();
  delete missingBinding.projection.edges[0].canonicalKnowledge;
  v2Denial(missingBinding, "EDGE_EVIDENCE_AUTHORITY_DENIED");
});

test("FND-PS-02 endpoint identifiers alone never grant relation truth", () => {
  const value = cloneV2();
  value.projection.edges[0].evidence = [];
  value.projection.edges[0] = redigestEdge(value.projection.edges[0]);
  const denial = v2Denial(value, "EDGE_EVIDENCE_AUTHORITY_DENIED");
  assert.equal(denial.reasonCodes.includes("INVENTED_EDGE_DENIED" as never), false);
});

test("FND-PS-02 proxy, accessor, hidden, and symbol inputs fail closed without attacker invocation", () => {
  for (const trap of ["ownKeys", "getOwnPropertyDescriptor", "get", "getPrototypeOf"]) {
    let invocations = 0;
    const input = new Proxy(cloneV2(), { [trap]: () => { invocations += 1; throw new Error("attacker trap"); } });
    const denial = v2Denial(input, "MISSING_INPUT");
    assert.deepEqual(denial.reasonCodes, ["MISSING_INPUT"], trap);
    assert.equal(invocations, 0, trap);
  }

  const proxyProjection = cloneV2();
  proxyProjection.projection = new Proxy(proxyProjection.projection, { get: () => { throw new Error("projection getter"); } });
  v2Denial(proxyProjection, "RAW_PROJECTION_DENIED");

  const proxyNodes = cloneV2();
  proxyNodes.projection.nodes = new Proxy(proxyNodes.projection.nodes, { ownKeys: () => { throw new Error("nodes trap"); } });
  v2Denial(proxyNodes, "RAW_PROJECTION_DENIED");

  const proxyEdge = cloneV2();
  proxyEdge.projection.edges[0] = new Proxy(proxyEdge.projection.edges[0], { get: () => { throw new Error("edge getter"); } });
  v2Denial(proxyEdge, "EDGE_EVIDENCE_AUTHORITY_DENIED");

  const accessorProjection = cloneV2();
  let projectionAccesses = 0;
  Object.defineProperty(accessorProjection.projection, "projectionId", { enumerable: true, configurable: true, get: () => { projectionAccesses += 1; return accessorProjection.projection.projectionId; } });
  v2Denial(accessorProjection, "RAW_PROJECTION_DENIED");
  assert.equal(projectionAccesses, 0);

  const accessorNode = cloneV2();
  let nodeAccesses = 0;
  Object.defineProperty(accessorNode.projection.nodes[0], "id", { enumerable: true, configurable: true, get: () => { nodeAccesses += 1; return "knowledge-001"; } });
  v2Denial(accessorNode, "RAW_PROJECTION_DENIED");
  assert.equal(nodeAccesses, 0);

  const accessorEdge = cloneV2();
  let edgeAccesses = 0;
  Object.defineProperty(accessorEdge.projection.edges[0], "from", { enumerable: true, configurable: true, get: () => { edgeAccesses += 1; return "knowledge-001"; } });
  v2Denial(accessorEdge, "EDGE_EVIDENCE_AUTHORITY_DENIED");
  assert.equal(edgeAccesses, 0);

  for (const surface of ["hidden", "symbol"] as const) {
    const value = cloneV2();
    const key: PropertyKey = surface === "hidden" ? "forgedAuthority" : Symbol("forgedAuthority");
    Object.defineProperty(value, key, { value: true, enumerable: surface === "symbol", configurable: true });
    v2Denial(value, "MISSING_INPUT");

    const nested = cloneV2();
    const nestedKey: PropertyKey = surface === "hidden" ? "raw" : Symbol("raw");
    Object.defineProperty(nested.projection.edges[0], nestedKey, { value: true, enumerable: surface === "symbol", configurable: true });
    v2Denial(nested, "EDGE_EVIDENCE_AUTHORITY_DENIED");
  }
});

test("FND-PS-02 authority expansion, promotion, and canonical-Knowledge mutation fail closed", () => {
  for (const [field, expectedReasonCode] of [
    ["authorityRequested", "AUTHORITY_EXPANSION_DENIED"],
    ["capabilityRequested", "AUTHORITY_EXPANSION_DENIED"],
    ["promotionRequested", "AUTHORITY_EXPANSION_DENIED"],
    ["canonicalEvidenceBeforeSha256", "KALEIDOSPHERE_MUTATION_DENIED"],
    ["canonicalEvidenceAfterSha256", "KALEIDOSPHERE_MUTATION_DENIED"],
  ] as const) {
    const value = cloneV2();
    value[field] = field.startsWith("canonicalEvidence") ? "f".repeat(64) : true;
    v2Denial(value, expectedReasonCode);
  }
});

test("FND-PS-02 validation snapshots input and isolates the authority-free returned candidate", () => {
  const input = cloneV2();
  const result = runV2(input);
  assert.equal(result.status, "CANDIDATE_RECORDED");
  if (result.status !== "CANDIDATE_RECORDED") return;
  const resultBytes = bridge.canonicalJson(result);
  input.projection.edges[0].from = "post-validation-forgery";
  input.projection.edges[0].canonicalKnowledge.knowledgeSha256 = "e".repeat(64);
  assert.equal(bridge.canonicalJson(result), resultBytes);
  assert.equal(result.edges[0]!.from, "knowledge-001");
  assert.equal(result.edges[0]!.relationTruth, "NOT_GRANTED");
  v2Denial(input, "EDGE_EVIDENCE_AUTHORITY_DENIED");

  assert.throws(() => { (result.edges[0] as MutableV2).from = "returned-forgery"; }, TypeError);
  assert.throws(() => { (result.edges[0]!.evidence as unknown as MutableV2[]).pop(); }, TypeError);
  assert.throws(() => { (result.nonclaims as unknown as string[]).push("PROMOTED"); }, TypeError);
  assert.deepEqual(runV2(v2Fixture), result);
});
