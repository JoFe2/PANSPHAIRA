import { readFileSync } from "node:fs";
import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import { governedAssetsDigestV1 } from "../../src/cks/governed-assets-v1.js";
import {
  type HistoricalKnowledgeReceiptV1,
  type KnowledgeBindingV1,
  type ResolvedKnowledgeDependencyV1,
  resolveKnowledgeDependenciesV1,
} from "../../src/cks/knowledge-revalidation-v1.js";

type Data = Record<string, any>;
const FIXTURE = JSON.parse(
  readFileSync("tests/fixtures/cks-11/knowledge-dependency-cases-v1.json", "utf8"),
) as Data;

function input(overrides: Partial<Data> = {}): Data {
  return {
    asOfMs: FIXTURE.asOfMs,
    workflowInputs: structuredClone(FIXTURE.workflowInputs),
    functionInputs: structuredClone(FIXTURE.functionInputs),
    knowledgeRecords: [structuredClone(FIXTURE.currentRecord)],
    historicalReceipts: [],
    ...overrides,
  };
}

function evaluate(binding: Data, record: Data, overrides: Partial<Data> = {}): Data {
  return resolveKnowledgeDependenciesV1({
    ...input({
      workflowInputs: [structuredClone(binding)],
      functionInputs: [],
      knowledgeRecords: [structuredClone(record)],
    }),
    ...overrides,
  });
}

function receipt(): HistoricalKnowledgeReceiptV1 {
  const value = {
    receiptId: "receipt:workflow-orders-1",
    subjectKind: "WORKFLOW" as const,
    subjectId: "workflow/orders",
    subjectVersion: "1.0.0",
    subjectDigest: "2222222222222222222222222222222222222222222222222222222222222222",
    knowledgeDependencySetDigest:
      "3333333333333333333333333333333333333333333333333333333333333333",
    recordedTimeMs: 50,
    previousReceiptDigest: null,
    receiptDigest: "0".repeat(64),
  };
  value.receiptDigest = governedAssetsDigestV1(value, "receiptDigest");
  return value;
}

void describe("CKS-11 deterministic Knowledge revalidation v1", () => {
  void it("allows exact current workflow and function dependencies", () => {
    const original = input();
    const result = resolveKnowledgeDependenciesV1(original);
    assert.equal(result.status, "FAST_PATH_ALLOWED");
    assert.equal(result.resolutionStatus, "CURRENT");
    assert.deepEqual(result.reasonCodes, ["NONE"]);
    assert.equal(result.resolvedDependencies.length, 2);
    assert.equal(result.decisionDigest, resolveKnowledgeDependenciesV1(original).decisionDigest);
  });

  void it("returns REVALIDATION_REQUIRED for supersession", () => {
    const superseded = {
      ...FIXTURE.currentRecord,
      state: "SUPERSEDED",
      supersededBy: "2026.08.29",
    };
    const result = evaluate(FIXTURE.binding, superseded);
    assert.equal(result.status, "REVALIDATION_REQUIRED");
    assert.deepEqual(result.reasonCodes, ["KNOWLEDGE_SUPERSEDED"]);
  });

  void it("returns REVALIDATION_REQUIRED for version, digest, freshness and scope drift", () => {
    const versionDrift = evaluate(FIXTURE.binding, {
      ...FIXTURE.currentRecord,
      version: "2026.08.29",
      supersededBy: null,
    });
    assert.equal(versionDrift.status, "REVALIDATION_REQUIRED");
    assert.deepEqual(versionDrift.reasonCodes, ["VERSION_DRIFT"]);

    const digestDrift = evaluate(FIXTURE.binding, {
      ...FIXTURE.currentRecord,
      digest: "4".repeat(64),
    });
    assert.equal(digestDrift.status, "REVALIDATION_REQUIRED");
    assert.deepEqual(digestDrift.reasonCodes, ["DIGEST_MISMATCH"]);

    const freshnessDrift = evaluate(FIXTURE.binding, {
      ...FIXTURE.currentRecord,
      freshness: { validFromMs: 1, validUntilMs: 1000 },
    });
    assert.equal(freshnessDrift.status, "REVALIDATION_REQUIRED");
    assert.deepEqual(freshnessDrift.reasonCodes, ["VERSION_DRIFT"]);

    const scopeDrift = evaluate(FIXTURE.binding, {
      ...FIXTURE.currentRecord,
      scope: "tenant:other/orders",
    });
    assert.equal(scopeDrift.status, "REVALIDATION_REQUIRED");
    assert.deepEqual(scopeDrift.reasonCodes, ["VERSION_DRIFT"]);
  });

  void it("fails closed for missing, ambiguous, stale and malformed inputs", () => {
    const missingRecord = resolveKnowledgeDependenciesV1(input({ knowledgeRecords: [] }));
    assert.equal(missingRecord.status, "REVALIDATION_REQUIRED");
    assert.deepEqual(missingRecord.reasonCodes, ["KNOWLEDGE_MISSING"]);

    const stale = resolveKnowledgeDependenciesV1(input({ asOfMs: 1000 }));
    assert.equal(stale.status, "REVALIDATION_REQUIRED");
    assert.deepEqual(stale.reasonCodes, ["STALE_KNOWLEDGE"]);

    const ambiguous = resolveKnowledgeDependenciesV1(
      input({ knowledgeRecords: [structuredClone(FIXTURE.currentRecord), structuredClone(FIXTURE.currentRecord)] }),
    );
    assert.equal(ambiguous.status, "FAST_PATH_ABORTED");
    assert.deepEqual(ambiguous.reasonCodes, ["AMBIGUOUS_MATCH"]);

    const missingInputs = resolveKnowledgeDependenciesV1({ ...input(), functionInputs: undefined });
    assert.equal(missingInputs.status, "FAST_PATH_ABORTED");
    assert.deepEqual(missingInputs.reasonCodes, ["INVALID_INPUT"]);

    const duplicateInputs = resolveKnowledgeDependenciesV1(
      input({ workflowInputs: [structuredClone(FIXTURE.binding), structuredClone(FIXTURE.binding)] }),
    );
    assert.equal(duplicateInputs.status, "FAST_PATH_ABORTED");
    assert.deepEqual(duplicateInputs.reasonCodes, ["INVALID_INPUT"]);
  });

  void it("keeps exact workflow/function bindings and historical receipts immutable", () => {
    const historical = receipt();
    const original = input({ historicalReceipts: [historical] });
    const originalSnapshot = structuredClone(original);
    const result = resolveKnowledgeDependenciesV1(original);
    assert.equal(Object.isFrozen(result), true);
    assert.equal(Object.isFrozen(result.workflowInputs), true);
    assert.equal(Object.isFrozen(result.functionInputs), true);
    assert.equal(Object.isFrozen(result.historicalReceipts), true);
    assert.equal(Object.isFrozen(result.historicalReceipts[0]), true);
    assert.deepEqual(original, originalSnapshot);
    assert.deepEqual(result.historicalReceipts[0], historical);

    const binding = result.workflowInputs[0] as KnowledgeBindingV1;
    const record = result.resolvedDependencies[0] as ResolvedKnowledgeDependencyV1;
    assert.equal(binding.knowledgeId, FIXTURE.binding.knowledgeId);
    assert.equal(binding.version, FIXTURE.binding.version);
    assert.equal(binding.digest, FIXTURE.binding.digest);
    assert.equal(binding.scope, FIXTURE.binding.scope);
    assert.equal(record.registryState, "CURRENT");
  });
});
