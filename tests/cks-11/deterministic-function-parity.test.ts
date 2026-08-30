import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import { GOVERNED_ASSETS_SCHEMA_V1, governedAssetsDigestV1 } from "../../src/cks/governed-assets-v1.js";
import { DETERMINISTIC_FUNCTION_PARITY_SCHEMA_V1, DETERMINISTIC_FUNCTION_PARITY_VERIFIER_V1, verifyDeterministicFunctionParityV1 } from "../../src/cks/deterministic-function-parity-v1.js";

type Data = Record<string, any>;
function ref(kind: string, id: string): Data { const schemaVersion = GOVERNED_ASSETS_SCHEMA_V1; const version = "1.0.0"; return { kind, id, schemaVersion, version, digestAlgorithm: "SHA-256", digest: governedAssetsDigestV1({ kind, id, schemaVersion, version }) }; }
function input(): Data { return { schemaVersion: DETERMINISTIC_FUNCTION_PARITY_SCHEMA_V1, verifierVersion: DETERMINISTIC_FUNCTION_PARITY_VERIFIER_V1, functionRef: ref("FUNCTION_CANDIDATE", "function:stable-order-normalizer"), sourceStepRef: ref("WORKFLOW_CANDIDATE", "step:normalize-order"), typedInput: { orderId: "fixture-order-1", retryCount: 0 }, originalResult: { kind: "OUTPUT", value: { normalized: true, orderId: "fixture-order-1" } }, candidateResult: { kind: "OUTPUT", value: { normalized: true, orderId: "fixture-order-1" } }, evidenceRefs: [ref("EVIDENCE", "evidence:p20-parity")], rollback: { originalStepFallbackRef: ref("FALLBACK_PATH", "fallback:normalize-order"), readbackRef: ref("READBACK", "readback:normalize-order"), rollbackReceiptRef: ref("RECEIPT", "receipt:normalize-order-rollback") } }; }

void describe("CKS-11 deterministic Function parity v1", () => {
  void it("proves equal typed output deterministically with bound rollback", () => {
    const first = verifyDeterministicFunctionParityV1(input());
    const second = verifyDeterministicFunctionParityV1(input());
    assert.equal(first.status, "PARITY_VERIFIED"); assert.equal(first.outcome, "PASS"); assert.deepEqual(first.reasonCodes, ["NONE"]);
    assert.equal(first.originalResultDigest, first.candidateResultDigest); assert.equal(first.decisionDigest, second.decisionDigest);
    assert.match(first.parityDigest!, /^[a-f0-9]{64}$/); assert.match(first.deterministicReplayDigest!, /^[a-f0-9]{64}$/);
    assert.equal(Object.isFrozen(first), true);
  });
  void it("preserves declared typed errors as parity evidence", () => {
    const value = input(); value.originalResult = { kind: "DECLARED_ERROR", value: { code: "INVALID_ORDER", terminal: true } }; value.candidateResult = structuredClone(value.originalResult);
    assert.equal(verifyDeterministicFunctionParityV1(value).status, "PARITY_VERIFIED");
  });
  void it("fails closed on mismatch, unbound rollback, synthetic shape, and absent evidence", () => {
    const mismatch = input(); mismatch.candidateResult.value.normalized = false; assert.deepEqual(verifyDeterministicFunctionParityV1(mismatch).reasonCodes, ["RESULT_MISMATCH"]);
    const rollback = input(); rollback.rollback.readbackRef = null; assert.deepEqual(verifyDeterministicFunctionParityV1(rollback).reasonCodes, ["ROLLBACK_UNBOUND"]);
    const evidence = input(); evidence.evidenceRefs = []; assert.deepEqual(verifyDeterministicFunctionParityV1(evidence).reasonCodes, ["INVALID_INPUT"]);
    const dryRun = input(); dryRun.synthetic = true; assert.deepEqual(verifyDeterministicFunctionParityV1(dryRun).reasonCodes, ["INVALID_INPUT"]);
  });
  void it("denies paired evidence and rollback substitution after canonical re-digestion", () => {
    const substituted = input();
    substituted.evidenceRefs = [ref("EVIDENCE", "evidence:attacker-substitute")];
    substituted.rollback = {
      originalStepFallbackRef: ref("FALLBACK_PATH", "fallback:attacker-substitute"),
      readbackRef: ref("READBACK", "readback:attacker-substitute"),
      rollbackReceiptRef: ref("RECEIPT", "receipt:attacker-substitute"),
    };
    const result = verifyDeterministicFunctionParityV1(substituted);
    assert.equal(result.status, "PARITY_REJECTED");
    assert.deepEqual(result.reasonCodes, ["EVIDENCE_INCOMPLETE", "ROLLBACK_UNBOUND"]);
  });
});
