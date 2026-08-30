import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import * as parity from "../../src/cks-12/deterministic-function-cost-parity.js";
const bytes = readFileSync("tests/fixtures/cks-12/function-cost-parity-v1.json");
const fixture = JSON.parse(bytes.toString("utf8"));
const receipt = JSON.parse(readFileSync("verification/cks-12/function-cost-parity-receipt-v1.json", "utf8"));
test("CKS-12 SS-21: deterministic Function replays preserve proof and reduce measured cost", () => {
  const result = parity.measureDeterministicFunctionCostParity(fixture);
  assert.equal(result.status, "FUNCTION_COST_PARITY_RECORDED");
  assert.deepEqual(result, receipt.result);
  if (result.status === "FUNCTION_COST_PARITY_RECORDED") { assert.equal(result.replayCount, 3); assert.equal(result.workflowCost.verifierChecks, result.functionCost.verifierChecks); }
});
test("Function nondeterminism, proof weakening, and non-reduction fail closed", () => {
  for (const mutate of [(value: any) => { value.functionReplays[1].output = "DIFFERENT"; }, (value: any) => { value.functionReplays[0].proofDigest = "d".repeat(64); }, (value: any) => { value.functionReplays[0].cost.retrievalCalls = 4; }]) { const value = structuredClone(fixture); mutate(value); assert.equal(parity.measureDeterministicFunctionCostParity(value).status, "DENIED"); }
});
test("Function parity fixture and receipt are canonical and immutable", () => { assert.equal(bytes.toString("utf8"), parity.canonicalJson(fixture)); const { receiptSha256, ...body } = receipt; assert.equal(receipt.fixtureSha256, createHash("sha256").update(bytes).digest("hex")); assert.equal(receiptSha256, parity.digest(body)); const result = parity.measureDeterministicFunctionCostParity(fixture); if (result.status === "FUNCTION_COST_PARITY_RECORDED") assert.deepEqual(parity.createReceipt(receipt.fixtureSha256, result), receipt); });
