import { readFileSync } from "node:fs";
import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import { GOVERNED_ASSETS_SCHEMA_V1, governedAssetsDigestV1 } from "../../src/cks/governed-assets-v1.js";
import {
  DETERMINISTIC_FUNCTION_PARITY_SCHEMA_V1,
  DETERMINISTIC_FUNCTION_PARITY_VERIFIER_V1,
  verifyDeterministicFunctionParityV1,
  type DeterministicFunctionParityDecisionV1,
} from "../../src/cks/deterministic-function-parity-v1.js";

type Data = Record<string, any>;
type HoldoutFixtureV1 = {
  holdoutId: string;
  caseClass: string;
  input: Data;
  expected: string;
  expectedReasonCodes: readonly string[];
  expectedDecisionDigest: string;
};
type FixtureEnvelopeV1 = {
  schemaVersion: string;
  verifierVersion: string;
  stableSubstep: string;
  holdouts: readonly HoldoutFixtureV1[];
};
type ExpectedBindingV1 = {
  evidenceId: string;
  fallbackId: string;
  readbackId: string;
  receiptId: string;
  typedInput: Data;
  result: Data;
};

const REQUIRED_REJECTION_CLASSES = [
  "MISSING",
  "AMBIGUOUS",
  "STALE",
  "DRIFTED",
  "NONCANONICAL",
  "UNBOUND_ROLLBACK",
];

const HOLDOUTS = JSON.parse(
  readFileSync("tests/fixtures/cks-11/p20-function-parity-holdouts-v1.json", "utf8"),
) as FixtureEnvelopeV1;
const REJECTIONS = JSON.parse(
  readFileSync("tests/fixtures/cks-11/p20-function-parity-rejections-v1.json", "utf8"),
) as FixtureEnvelopeV1;
const EXPECTED_BINDINGS: readonly ExpectedBindingV1[] = [
  {
    evidenceId: "evidence:p20-order-1-output",
    fallbackId: "fallback:normalize-order",
    readbackId: "readback:normalize-order",
    receiptId: "receipt:normalize-order-rollback",
    typedInput: { orderId: "fixture-order-1", retryCount: 0 },
    result: {
      kind: "OUTPUT",
      value: { normalized: true, orderId: "fixture-order-1" },
    },
  },
  {
    evidenceId: "evidence:p20-order-2-declared-error",
    fallbackId: "fallback:normalize-order-error",
    readbackId: "readback:normalize-order-error",
    receiptId: "receipt:normalize-order-2-rollback",
    typedInput: { orderId: "fixture-order-2", retryCount: 1 },
    result: {
      kind: "DECLARED_ERROR",
      value: { code: "INVALID_ORDER", terminal: true },
    },
  },
];

function assertEnvelope(source: Data): void {
  assert.equal(source.schemaVersion, DETERMINISTIC_FUNCTION_PARITY_SCHEMA_V1);
  assert.equal(source.verifierVersion, DETERMINISTIC_FUNCTION_PARITY_VERIFIER_V1);
  assert.equal(source.stableSubstep, "step:normalize-order");
}

function refsOf(input: Data): Data[] {
  return [
    input.functionRef,
    input.sourceStepRef,
    ...(input.evidenceRefs as Data[]),
    ...Object.values(input.rollback as Record<string, Data>),
  ];
}

// Canonical ref rule: digest must equal governedAssetsDigestV1 of the ref's
// descriptor {kind, id, schemaVersion, version}.
function assertCanonicalRefs(input: Data): void {
  assert.equal(input.functionRef.kind, "FUNCTION_CANDIDATE");
  assert.equal(input.functionRef.id, "function:stable-order-normalizer");
  assert.equal(input.sourceStepRef.kind, "WORKFLOW_CANDIDATE");
  assert.equal(input.sourceStepRef.id, "step:normalize-order");
  assert.deepEqual((input.evidenceRefs as Data[]).map((value: Data) => value.kind), ["EVIDENCE"]);
  assert.deepEqual(Object.values(input.rollback as Record<string, Data>).map((value: Data) => value.kind), ["FALLBACK_PATH", "READBACK", "RECEIPT"]);
  for (const value of refsOf(input)) {
    assert.equal(value.schemaVersion, GOVERNED_ASSETS_SCHEMA_V1);
    assert.equal(value.version, "1.0.0");
    assert.equal(value.digestAlgorithm, "SHA-256");
    assert.match(value.digest, /^[a-f0-9]{64}$/);
    assert.equal(
      value.digest,
      governedAssetsDigestV1({ kind: value.kind, id: value.id, schemaVersion: value.schemaVersion, version: value.version }),
    );
  }
}

function canonicalRef(kind: string, id: string): Data {
  const schemaVersion = GOVERNED_ASSETS_SCHEMA_V1;
  const version = "1.0.0";
  return {
    kind,
    id,
    schemaVersion,
    version,
    digestAlgorithm: "SHA-256",
    digest: governedAssetsDigestV1({ kind, id, schemaVersion, version }),
  };
}

function assertExactSnapshots(input: Data, expected: ExpectedBindingV1): void {
  assert.deepEqual(input.typedInput, expected.typedInput);
  assert.deepEqual(input.originalResult, expected.result);
  assert.deepEqual(input.candidateResult, expected.result);
  assert.deepEqual(input.functionRef, canonicalRef("FUNCTION_CANDIDATE", "function:stable-order-normalizer"));
  assert.deepEqual(input.sourceStepRef, canonicalRef("WORKFLOW_CANDIDATE", "step:normalize-order"));
  assert.deepEqual(input.evidenceRefs, [canonicalRef("EVIDENCE", expected.evidenceId)]);
  assert.deepEqual(input.rollback, {
    originalStepFallbackRef: canonicalRef("FALLBACK_PATH", expected.fallbackId),
    readbackRef: canonicalRef("READBACK", expected.readbackId),
    rollbackReceiptRef: canonicalRef("RECEIPT", expected.receiptId),
  });
}

function verify(holdouts: readonly Data[]): DeterministicFunctionParityDecisionV1[] {
  return holdouts.map((holdout) => verifyDeterministicFunctionParityV1(structuredClone(holdout.input)));
}

function assertPinned(holdouts: readonly Data[], decisions: readonly DeterministicFunctionParityDecisionV1[]): void {
  holdouts.forEach((holdout, index) => {
    const decision = decisions[index]!;
    assert.equal(decision.status, holdout.expected, holdout.holdoutId);
    assert.equal(decision.outcome, holdout.expected === "PARITY_VERIFIED" ? "PASS" : "ABORTED", holdout.holdoutId);
    assert.deepEqual(decision.reasonCodes, holdout.expectedReasonCodes, holdout.holdoutId);
    assert.match(decision.decisionDigest, /^[a-f0-9]{64}$/, holdout.holdoutId);
    assert.equal(decision.decisionDigest, holdout.expectedDecisionDigest, holdout.holdoutId);
    assert.equal(Object.isFrozen(decision), true, holdout.holdoutId);
  });
}

void describe("CKS-11 P20 function-parity fixtures v1", () => {
  void it("proves deterministic typed output/error parity with bound rollback for the stable substep", () => {
    assertEnvelope(HOLDOUTS);
    assert.equal(HOLDOUTS.holdouts.length, 2);
    const inputSnapshots = HOLDOUTS.holdouts.map((holdout) => structuredClone(holdout.input));
    const first = verify(HOLDOUTS.holdouts);
    assertPinned(HOLDOUTS.holdouts, first);
    for (const [index, holdout] of HOLDOUTS.holdouts.entries()) {
      const decision = first[index]!;
      assert.equal(decision.originalResultDigest, decision.candidateResultDigest, holdout.holdoutId);
      assert.match(decision.parityDigest!, /^[a-f0-9]{64}$/);
      assert.match(decision.deterministicReplayDigest!, /^[a-f0-9]{64}$/);
      assertCanonicalRefs(holdout.input);
      assertExactSnapshots(holdout.input, EXPECTED_BINDINGS[index]!);
      for (const ref of Object.values(holdout.input.rollback as Data)) {
        assert.notEqual(ref, null, holdout.holdoutId);
        assert.match(ref.digest, /^[a-f0-9]{64}$/, holdout.holdoutId);
      }
    }
    assert.deepEqual(HOLDOUTS.holdouts.map((holdout) => holdout.input), inputSnapshots);
    assert.equal(HOLDOUTS.holdouts[0]!.input.originalResult.kind, "OUTPUT");
    assert.equal(HOLDOUTS.holdouts[1]!.input.originalResult.kind, "DECLARED_ERROR");
    const second = verify(HOLDOUTS.holdouts);
    assert.deepEqual(
      second.map((decision) => decision.decisionDigest),
      first.map((decision) => decision.decisionDigest),
    );
  });

  void it("denies missing, ambiguous, stale, drifted, noncanonical, and unbound-rollback fixtures fail-closed", () => {
    assertEnvelope(REJECTIONS);
    assert.deepEqual(REJECTIONS.holdouts.map((holdout) => holdout.caseClass), REQUIRED_REJECTION_CLASSES);
    for (const holdout of REJECTIONS.holdouts) {
      assert.deepEqual(holdout.input.functionRef, canonicalRef("FUNCTION_CANDIDATE", "function:stable-order-normalizer"));
      assert.deepEqual(holdout.input.sourceStepRef, canonicalRef("WORKFLOW_CANDIDATE", "step:normalize-order"));
      assert.deepEqual(holdout.input.rollback.originalStepFallbackRef, canonicalRef("FALLBACK_PATH", "fallback:normalize-order"));
      assert.deepEqual(holdout.input.rollback.rollbackReceiptRef, canonicalRef("RECEIPT", "receipt:normalize-order-rollback"));
      if (holdout.caseClass !== "UNBOUND_ROLLBACK") {
        assert.deepEqual(holdout.input.rollback.readbackRef, canonicalRef("READBACK", "readback:normalize-order"));
      }
    }
    const inputSnapshots = REJECTIONS.holdouts.map((holdout) => structuredClone(holdout.input));
    const decisions = verify(REJECTIONS.holdouts);
    assertPinned(REJECTIONS.holdouts, decisions);
    for (const [index, holdout] of REJECTIONS.holdouts.entries()) {
      const decision = decisions[index]!;
      if (holdout.expectedReasonCodes[0] === "RESULT_MISMATCH") {
        assert.notEqual(decision.originalResultDigest, decision.candidateResultDigest, holdout.holdoutId);
      } else {
        assert.equal(decision.originalResultDigest, null, holdout.holdoutId);
        assert.equal(decision.candidateResultDigest, null, holdout.holdoutId);
      }
      assert.equal(decision.parityDigest, null, holdout.holdoutId);
      assert.equal(decision.deterministicReplayDigest, null, holdout.holdoutId);
    }
    assert.deepEqual(decisions.map((decision) => decision.reasonCodes), [
      ["INVALID_INPUT"],
      ["INVALID_INPUT"],
      ["RESULT_MISMATCH"],
      ["RESULT_MISMATCH"],
      ["INVALID_INPUT"],
      ["ROLLBACK_UNBOUND"],
    ]);
    assert.deepEqual(REJECTIONS.holdouts.map((holdout) => holdout.input), inputSnapshots);
  });

  void it("denies runtime mutation of a pinned holdout input fail-closed", () => {
    const cases: Array<(input: Data) => void> = [
      (input) => { input.candidateResult.value.normalized = false; },
      (input) => { input.rollback.readbackRef = null; },
      (input) => { input.evidenceRefs = []; },
      (input) => { input.synthetic = true; },
      (input) => { input.schemaVersion = "pansphaira.cks-11/deterministic-function-parity/v2"; },
    ];
    const expectedReasons = ["RESULT_MISMATCH", "ROLLBACK_UNBOUND", "INVALID_INPUT", "INVALID_INPUT", "INVALID_INPUT"];
    cases.forEach((mutate, index) => {
      const input = structuredClone(HOLDOUTS.holdouts[0]!.input) as Data;
      mutate(input);
      const result = verifyDeterministicFunctionParityV1(input);
      assert.equal(result.status, "PARITY_REJECTED");
      assert.equal(result.outcome, "ABORTED");
      assert.deepEqual(result.reasonCodes, [expectedReasons[index]!]);
    });
  });
});