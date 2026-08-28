import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import Ajv2020 from "ajv/dist/2020.js";
import {
  GAP_ACQUISITION_RECEIPT_SCHEMA_V1,
  findGapAndRouteAcquisitionV1,
  gapAcquisitionReceiptDigestV1,
  validateGapAcquisitionReceiptV1,
  type GapAcquisitionInputV1,
  type GapAcquisitionReceiptV1,
} from "../packages/contracts/src/cks-gap-acquisition.js";

const positive = JSON.parse(readFileSync("tests/fixtures/cks-07/gap-acquisition-positive-v1.json", "utf8")) as {
  cases: Array<{ caseId: string; input: GapAcquisitionInputV1; expectedState: string }>;
};
const negative = JSON.parse(readFileSync("tests/fixtures/cks-07/gap-acquisition-negative-v1.json", "utf8")) as {
  cases: Array<{ caseId: string; input: GapAcquisitionInputV1; expectedState: string; assertions?: string[] }>;
};

function schemaValidator(): (value: unknown) => boolean {
  const ajv = new Ajv2020({ allErrors: true, strict: true });
  return ajv.compile(JSON.parse(readFileSync("schemas/contracts/cks-gap-acquisition-receipt-v1.schema.json", "utf8")));
}

const validReceipt = (receipt: GapAcquisitionReceiptV1, label: string): void => {
  assert.equal(receipt.schemaVersion, GAP_ACQUISITION_RECEIPT_SCHEMA_V1, label);
  assert.equal(validateGapAcquisitionReceiptV1(receipt), true, `${label}: runtime`);
  assert.equal(schemaValidator()(receipt), true, `${label}: JSON Schema`);
};

test("P12 recovers at the earliest alternate retrieval level", () => {
  const a1 = positive.cases.find((item) => item.caseId === "case:recover-a1");
  const a2 = positive.cases.find((item) => item.caseId === "case:recover-a2");
  assert.ok(a1);
  assert.ok(a2);
  const first = findGapAndRouteAcquisitionV1(a1.input);
  const second = findGapAndRouteAcquisitionV1(a2.input);
  assert.equal(first.state, "RECOVERED");
  assert.equal(second.state, "RECOVERED");
  assert.ok(first.receipt);
  assert.ok(second.receipt);
  validReceipt(first.receipt, "A1 recovery");
  validReceipt(second.receipt, "A2 recovery");
  assert.deepEqual(first.receipt.attempts.map((attempt) => attempt.outcome), ["NO_MATCH", "QUALIFYING_MATCH"]);
  assert.deepEqual(second.receipt.attempts.map((attempt) => attempt.outcome), ["NO_MATCH", "NO_MATCH", "QUALIFYING_MATCH"]);
  assert.deepEqual(first, findGapAndRouteAcquisitionV1(a1.input));
  assert.deepEqual(second, findGapAndRouteAcquisitionV1(a2.input));
});

test("P12 declares missing only after complete A0-A2 recovery and keeps A3-A5 non-authoritative", () => {
  const item = positive.cases.find((candidate) => candidate.caseId === "case:missing-with-candidates");
  assert.ok(item);
  const decision = findGapAndRouteAcquisitionV1(item.input);
  assert.equal(decision.state, "GAP_MISSING");
  assert.ok(decision.receipt);
  validReceipt(decision.receipt, "missing receipt");
  assert.deepEqual(decision.receipt.attempts.map((attempt) => attempt.level), ["A0", "A1", "A2"]);
  assert.deepEqual(decision.receipt.attempts.map((attempt) => attempt.outcome), ["NO_MATCH", "NO_MATCH", "NO_MATCH"]);
  assert.equal(new Set(decision.receipt.attempts.map((attempt) => attempt.knowledgeBundleDigest)).size, 1);
  assert.equal(decision.receipt.acquisitionCandidates.length, 3);
  for (const candidate of decision.receipt.acquisitionCandidates) {
    assert.equal(candidate.disposition, "NON_AUTHORITATIVE_CANDIDATE");
    assert.equal(candidate.acceptanceStatus, "NOT_ACCEPTED");
    assert.equal(candidate.promotionStatus, "NOT_REQUESTED");
    assert.equal(candidate.authorityBoundary, "READ_ONLY_KNOWLEDGE_NO_CREDENTIAL_POLICY_CAPABILITY_TOOL_WRITE_OR_EXECUTION_AUTHORITY");
  }
  assert.equal(decision.receipt.promotionStatus, "NOT_REQUESTED");
  assert.equal(decision.receipt.acceptedKnowledgeDigest, null);
});

test("negative and fail-closed P12 cases remain finite and deterministic", () => {
  for (const item of negative.cases) {
    const decision = findGapAndRouteAcquisitionV1(item.input);
    assert.equal(decision.state, item.expectedState, item.caseId);
    assert.ok(["RECOVERED", "NOT_APPLICABLE", "GAP_MISSING", "GAP_BAD_SOURCE", "GAP_APPLICABILITY", "GAP_CONFLICTING", "GAP_UNKNOWN_SEMANTIC", "BLOCKED"].includes(decision.state));
    assert.deepEqual(decision, findGapAndRouteAcquisitionV1(item.input), `${item.caseId}: deterministic`);
    if (item.expectedState === "BLOCKED") assert.equal(decision.receipt, null, item.caseId);
    else {
      assert.ok(decision.receipt);
      validReceipt(decision.receipt, item.caseId);
      if (item.assertions !== undefined) {
        const serialized = JSON.stringify(decision.receipt);
        for (const assertion of item.assertions) assert.equal(serialized.includes(assertion), true, `${item.caseId}: ${assertion}`);
      }
    }
  }
});

test("receipt digest binds promotion separation and rejects authority leaks", () => {
  const item = positive.cases.find((candidate) => candidate.caseId === "case:missing-with-candidates");
  assert.ok(item);
  const decision = findGapAndRouteAcquisitionV1(item.input);
  assert.ok(decision.receipt);
  const mutated = structuredClone(decision.receipt) as Record<string, any>;
  const candidate = mutated.acquisitionCandidates[1] as Record<string, any>;
  candidate.acceptanceStatus = "ACCEPTED";
  mutated.receiptDigest = gapAcquisitionReceiptDigestV1(mutated);
  assert.equal(validateGapAcquisitionReceiptV1(mutated), false);
  assert.equal(schemaValidator()(mutated), false);
});
