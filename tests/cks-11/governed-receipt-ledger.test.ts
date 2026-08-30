import { readFileSync } from "node:fs";
import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import {
  governedAssetsDigestV1,
  governedAssetsRefSetDigestV1,
  type ExactRefV1,
} from "../../src/cks/governed-assets-v1.js";
import {
  appendGovernedReceiptV1,
  governedReceiptLedgerDigestV1,
  type GovernedReceiptLedgerInputV1,
} from "../../src/cks/governed-receipt-ledger-v1.js";

type Data = Record<string, any>;
const DIGEST = "0".repeat(64);
const CASES = JSON.parse(
  readFileSync("tests/fixtures/cks-11/receipt-ledger-cases-v1.json", "utf8"),
) as Data;

function subjectCase(kind: "workflowSubject" | "functionSubject"): Data {
  return structuredClone(CASES[kind]);
}

function receipt(
  template: Data,
  subjectRef: Data,
  workflowDependencies: readonly Data[],
  functionDependencies: readonly Data[],
  receiptId: string,
  previousReceiptDigest: string | null,
  recordedTimeMs: number,
): Data {
  const value = structuredClone(template);
  value.receiptId = receiptId;
  value.subjectRef = structuredClone(subjectRef);
  value.workflowDependencySetDigest = governedAssetsRefSetDigestV1(workflowDependencies);
  value.functionDependencySetDigest = governedAssetsRefSetDigestV1(functionDependencies);
  value.previousReceiptDigest = previousReceiptDigest;
  value.recordedTimeMs = recordedTimeMs;
  value.contextDigest = governedAssetsDigestV1({ receiptId, recordedTimeMs });
  value.decisionDigest = governedAssetsDigestV1({
    subjectRef: value.subjectRef,
    decisionStatus: value.decisionStatus,
    reasonCodes: value.reasonCodes,
    contextDigest: value.contextDigest,
    recordedTimeMs: value.recordedTimeMs,
  });
  value.receiptDigest = governedAssetsDigestV1(value, "receiptDigest");
  return value;
}

function inputFor(
  kind: "workflowSubject" | "functionSubject",
  historicalEntries: readonly Data[],
  newEntry: Data,
): GovernedReceiptLedgerInputV1 {
  const source = subjectCase(kind);
  return {
    subjectKind: source.subjectKind,
    subjectRef: source.subjectRef as ExactRefV1,
    workflowDependencies: source.workflowDependencies as ExactRefV1[],
    functionDependencies: source.functionDependencies as ExactRefV1[],
    historicalEntries: historicalEntries as unknown as GovernedReceiptLedgerInputV1["historicalEntries"],
    newEntry: newEntry as unknown as GovernedReceiptLedgerInputV1["newEntry"],
  } as GovernedReceiptLedgerInputV1;
}

function accepted(result: ReturnType<typeof appendGovernedReceiptV1>): asserts result is Extract<
  ReturnType<typeof appendGovernedReceiptV1>,
  { outcome: "ACCEPTED" }
> {
  assert.equal(result.outcome, "ACCEPTED");
  assert.deepEqual(result.reasonCodes, ["NONE"]);
  assert.equal(result.exitCode, 0);
}

function workflowLedgerParts(): {
  input: GovernedReceiptLedgerInputV1;
  first: Data;
  second: Data;
} {
  const source = subjectCase("workflowSubject");
  const first = receipt(
    CASES.receiptTemplate,
    source.subjectRef,
    source.workflowDependencies,
    source.functionDependencies,
    "receipt:workflow-1",
    null,
    10,
  );
  const second = receipt(
    CASES.receiptTemplate,
    source.subjectRef,
    source.workflowDependencies,
    source.functionDependencies,
    "receipt:workflow-2",
    first.receiptDigest,
    20,
  );
  return { input: inputFor("workflowSubject", [first], second), first, second };
}

void describe("CKS-11 governed receipt ledger v1", () => {
  void it("appends canonical workflow and function receipts with exact bindings", () => {
    const workflow = workflowLedgerParts();
    const workflowResult = appendGovernedReceiptV1(workflow.input);
    accepted(workflowResult);
    assert.deepEqual(workflowResult.record.workflowDependencies, workflow.input.workflowDependencies);
    assert.deepEqual(workflowResult.record.functionDependencies, workflow.input.functionDependencies);
    assert.deepEqual(workflowResult.record.entries, [workflow.first, workflow.second]);
    assert.equal(workflowResult.record.headReceiptDigest, workflow.second.receiptDigest);
    assert.equal(
      workflowResult.record.ledgerDigest,
      governedReceiptLedgerDigestV1(workflowResult.record),
    );

    const functionSource = subjectCase("functionSubject");
    const functionReceipt = receipt(
      CASES.receiptTemplate,
      functionSource.subjectRef,
      functionSource.workflowDependencies,
      functionSource.functionDependencies,
      "receipt:function-1",
      null,
      30,
    );
    const functionResult = appendGovernedReceiptV1(
      inputFor("functionSubject", [], functionReceipt),
    );
    accepted(functionResult);
    assert.deepEqual(functionResult.record.workflowDependencies, functionSource.workflowDependencies);
    assert.deepEqual(functionResult.record.functionDependencies, functionSource.functionDependencies);
    assert.deepEqual(functionResult.record.entries, [functionReceipt]);
  });

  void it("detaches and freezes dependency bindings and historical receipt bytes", () => {
    const { input } = workflowLedgerParts();
    const mutableInput = input as Data;
    const result = appendGovernedReceiptV1(input);
    accepted(result);
    assert.notEqual(result.record.entries, input.historicalEntries);
    assert.notEqual(result.record.entries[0], input.historicalEntries[0]);
    assert.equal(Object.isFrozen(result.record), true);
    assert.equal(Object.isFrozen(result.record.workflowDependencies), true);
    assert.equal(Object.isFrozen(result.record.workflowDependencies[0]), true);
    assert.equal(Object.isFrozen(result.record.entries), true);
    assert.equal(Object.isFrozen(result.record.entries[0]), true);

    mutableInput.workflowDependencies[0]!.id = "mutated-after-append";
    mutableInput.historicalEntries[0]!.requestDigest = "f".repeat(64);
    assert.equal(result.record.workflowDependencies[0]!.id, "workflow/orders-step-1");
    assert.equal(result.record.entries[0]!.requestDigest, "1".repeat(64));
    assert.throws(() => {
      (result.record.entries[0] as Data).requestDigest = DIGEST;
    }, TypeError);
  });

  void it("denies mutation, replacement, foreign digest, and broken chain attempts", () => {
    const valid = workflowLedgerParts();

    const mutation = structuredClone(valid) as Data;
    mutation.first.requestDigest = "f".repeat(64);
    assert.equal(appendGovernedReceiptV1(mutation.input).outcome, "REJECTED");
    assert.equal(
      (appendGovernedReceiptV1(mutation.input) as Data).reasonCodes.includes("DIGEST_MISMATCH"),
      true,
    );

    const replacement = structuredClone(valid) as Data;
    replacement.input.newEntry = structuredClone(replacement.first);
    const replacementResult = appendGovernedReceiptV1(replacement.input);
    assert.equal(replacementResult.outcome, "REJECTED");
    assert.equal((replacementResult as Data).reasonCodes.includes("DUPLICATE_REF"), true);

    const foreign = structuredClone(valid) as Data;
    foreign.second.workflowDependencySetDigest = "f".repeat(64);
    foreign.second.receiptDigest = governedAssetsDigestV1(foreign.second, "receiptDigest");
    const foreignResult = appendGovernedReceiptV1(foreign.input);
    assert.equal(foreignResult.outcome, "REJECTED");
    assert.equal((foreignResult as Data).reasonCodes.includes("DEPENDENCY_SET_DIGEST_MISMATCH"), true);

    const brokenChain = structuredClone(valid) as Data;
    brokenChain.second.previousReceiptDigest = "e".repeat(64);
    brokenChain.second.receiptDigest = governedAssetsDigestV1(
      brokenChain.second,
      "receiptDigest",
    );
    const chainResult = appendGovernedReceiptV1(brokenChain.input);
    assert.equal(chainResult.outcome, "REJECTED");
    assert.equal((chainResult as Data).reasonCodes.includes("RECEIPT_BINDING_INVALID"), true);
  });

  void it("denies duplicate identities, foreign subjects, and noncanonical receipts", () => {
    const valid = workflowLedgerParts();

    const duplicateHistory = structuredClone(valid) as Data;
    duplicateHistory.input.historicalEntries = [
      duplicateHistory.first,
      structuredClone(duplicateHistory.first),
    ];
    const duplicateResult = appendGovernedReceiptV1(duplicateHistory.input);
    assert.equal(duplicateResult.outcome, "REJECTED");
    assert.equal((duplicateResult as Data).reasonCodes.includes("DUPLICATE_REF"), true);

    const foreignSubject = structuredClone(valid) as Data;
    foreignSubject.second.subjectRef.id = "workflow/foreign";
    foreignSubject.second.decisionDigest = governedAssetsDigestV1({
      subjectRef: foreignSubject.second.subjectRef,
      decisionStatus: foreignSubject.second.decisionStatus,
      reasonCodes: foreignSubject.second.reasonCodes,
      contextDigest: foreignSubject.second.contextDigest,
      recordedTimeMs: foreignSubject.second.recordedTimeMs,
    });
    foreignSubject.second.receiptDigest = governedAssetsDigestV1(
      foreignSubject.second,
      "receiptDigest",
    );
    const foreignSubjectResult = appendGovernedReceiptV1(foreignSubject.input);
    assert.equal(foreignSubjectResult.outcome, "REJECTED");
    assert.equal(
      (foreignSubjectResult as Data).reasonCodes.includes("RECEIPT_BINDING_INVALID"),
      true,
    );

    const noncanonical = structuredClone(valid) as Data;
    noncanonical.second.unexpected = true;
    const noncanonicalResult = appendGovernedReceiptV1(noncanonical.input);
    assert.equal(noncanonicalResult.outcome, "REJECTED");
    assert.equal((noncanonicalResult as Data).reasonCodes.includes("UNKNOWN_FIELD"), true);
  });
});
