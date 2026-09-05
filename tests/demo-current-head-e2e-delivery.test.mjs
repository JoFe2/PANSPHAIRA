import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";

const BASE_HEAD = "b676c984b3fb53381b456010047d32e775fb3782";
const RECORD_PATH = "closure-audits/PS377-DEMO-CI-01-R1/implementation-evidence.json";
const CONTRACT_PATH = "verification/demo-current-head-e2e/contract-v1.json";

const EXPECTED_AC_IDS = [
  "DEMO-CI-AC01",
  "DEMO-CI-AC02",
  "DEMO-CI-AC03",
  "DEMO-CI-AC04",
  "DEMO-CI-AC05",
  "DEMO-CI-AC06",
];

// The fixed adversarial negative-proof IDs the #377 executable contract requires.
const EXPECTED_NEGATIVE_PROOF_IDS = [
  "FAILED_HEALTH",
  "WRONG_FIXTURE",
  "MISSING_READBACK",
  "OWNED_RESIDUE",
  "RUNTIME_TIMEOUT",
  "STALE_RECEIPT",
  "STALE_HEAD",
  "CALLER_AUTHORED_PASS",
  "MISSING_NEGATIVE_PROOF",
  "FAILED_HARD_GATE",
  "OVERCLAIM",
  "ISSUE_NOT_PUBLIC_CLOSED",
  "QUEUE_NOT_DONE",
  "RESIDUAL_OWNERSHIP",
];

function loadRecord() {
  assert.ok(existsSync(RECORD_PATH), `delivery record is missing: ${RECORD_PATH}`);
  return JSON.parse(readFileSync(RECORD_PATH, "utf8"));
}

test("the PS377 R1 delivery record exists and binds to the exact base head", () => {
  const record = loadRecord();
  assert.equal(record.schemaVersion, "pansphaira.qwen-delivery/implementation-evidence/v1");
  assert.equal(record.deliveryId, "PS377-DEMO-CI-01-R1");
  assert.equal(record.round, "R1");
  assert.equal(record.issue.repository, "JoFe2/PANSPHAIRA");
  assert.equal(record.issue.number, 377);
  assert.equal(record.baseHead, BASE_HEAD);
  assert.match(record.baseHead, /^[a-f0-9]{40}$/);
  assert.match(record.baseTree, /^[a-f0-9]{40}$/);
});

test("the delivery record is a pending state, not a runtime pass receipt", () => {
  const record = loadRecord();
  assert.match(record.implementationState, /PENDING_EXACT_HEAD_HOST_DOCKER_RECEIPT$/);
  assert.ok(record.exactHeadRuntimeEvidence.producedByThisDelivery === false);
  assert.ok(record.exactHeadRuntimeEvidence.callerAuthoredPassAccepted === false);
  assert.ok(record.exactHeadRuntimeEvidence.localSyntheticReceiptSubstitutesForProviderReadback === false);
  assert.ok(record.nonClaims.includes("THIS_RECORD_IS_NOT_A_RUNTIME_PASS_RECEIPT"));
  assert.ok(record.nonClaims.includes("EXACT_HEAD_HOST_DOCKER_RECEIPT_IS_CI_ONLY_AND_PENDING"));
  assert.ok(record.nonClaims.includes("NO_PUBLIC_ISSUE_CLOSED_OR_QUEUE_DONE_CLAIM"));
});

test("the delivery record maps all six #377 criteria with no remainder", () => {
  const record = loadRecord();
  assert.deepEqual(record.acceptanceOwnership.mappedIds, EXPECTED_AC_IDS);
  assert.deepEqual(record.acceptanceOwnership.unmappedIds, []);
  assert.equal(record.acceptanceOwnership.mappedIds.length, EXPECTED_AC_IDS.length);
});

test("the delivery record carries the complete fixed negative-proof ID set", () => {
  const record = loadRecord();
  assert.deepEqual(record.requiredNegativeProofCaseIds, EXPECTED_NEGATIVE_PROOF_IDS);
  assert.equal(record.requiredNegativeProofCaseIds.length, EXPECTED_NEGATIVE_PROOF_IDS.length);
});

test("the delivery record stays inside the read-only authority boundary", () => {
  const record = loadRecord();
  for (const key of [
    "credentialAccess",
    "customerDataAccess",
    "productiveExternalEffect",
    "publication",
    "pushMergeRelease",
    "issueMutation",
    "queueMutation",
    "authorityWidening",
  ]) {
    assert.equal(record.authorityBoundary[key], false, `authorityBoundary.${key} must be false`);
  }
});

test("the delivery record agrees with the executable #377 contract", () => {
  const record = loadRecord();
  const contract = JSON.parse(readFileSync(CONTRACT_PATH, "utf8"));
  assert.deepEqual(
    record.acceptanceOwnership.mappedIds,
    contract.acceptance.map(({ id }) => id),
    "delivery acceptance IDs must match the executable contract with no drift",
  );
  assert.deepEqual(
    record.requiredNegativeProofCaseIds,
    contract.negativeProofCaseIds,
    "delivery negative-proof IDs must match the executable contract with no drift",
  );
});

test("the delivery record records a green focused replay on the exact base head", () => {
  const record = loadRecord();
  assert.equal(record.focusedReplay.outcome, "PASS");
  assert.equal(record.focusedReplay.baseHead, BASE_HEAD);
  assert.equal(record.focusedReplay.baseTree, record.baseTree);
  assert.equal(record.focusedReplay.productFail, 0);
  assert.equal(record.focusedReplay.productPass, record.focusedReplay.productTests);
  assert.ok(record.focusedReplay.productTests >= 23, "the #377 product adversarial matrix must be fully present");
});