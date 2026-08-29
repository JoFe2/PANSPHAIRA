import assert from "node:assert/strict";
import test from "node:test";

import { makeCcpCostBudgetV1 } from "../packages/contracts/src/ccp-cost-budget.js";
import {
  canonicalCcpFairQueueSelectionJsonV1,
  parseCcpFairQueueSelectionV1,
  selectCcpFairQueueV1,
  verifyCcpFairQueueSelectionV1,
  CCP_FAIR_QUEUE_SELECTION_SCHEMA_V1,
  type CcpFairQueueCandidateV1,
} from "../packages/contracts/src/ccp-fair-queue.js";

const digest = (_character: string): string => "0123456789abcdef".repeat(4);
const identity = {
  ledgerId: "ledger:ccp-scheduler",
  tenantId: "tenant:synthetic",
  repositoryId: "repository:pansphaira",
  contributionId: "contribution:psai52-scheduler",
};

function makeBudget(): unknown {
  return makeCcpCostBudgetV1({
    budgetId: "budget:scheduler-window",
    ...identity,
    logicalAtMs: 0,
    budgetUnits: 5,
    committedUnits: 0,
    consumedUnits: 0,
  });
}

function candidate(
  id: string,
  overrides: Partial<CcpFairQueueCandidateV1> = {},
): CcpFairQueueCandidateV1 {
  return {
    schemaVersion: "cm.ccp-fair-queue-candidate/v1",
    candidateId: `queue:${id}`,
    ...identity,
    receiptDigest: digest(id[0] ?? "a"),
    headDigest: digest(id[0] ?? "a"),
    admissionState: "ADMITTED",
    headState: "CURRENT",
    deepCiClaimEligible: true,
    enqueuedAtMs: 10,
    costUnits: 1,
    fairnessKey: "fair:tenant-a",
    lastSelectedSequence: 0,
    ...overrides,
  };
}

test("CCP-PSAI52-FQ-001 selects a finite deterministic fair batch", () => {
  const input = {
    schemaVersion: "cm.ccp-fair-queue-selection-input/v1",
    selectionId: "selection:scheduler-round-1",
    logicalAtMs: 100,
    maxItems: 2,
    budget: makeBudget(),
    candidates: [
      candidate("alpha", { fairnessKey: "fair:tenant-a", lastSelectedSequence: 3, costUnits: 2 }),
      candidate("beta", { fairnessKey: "fair:tenant-b", lastSelectedSequence: 0, costUnits: 3 }),
      candidate("gamma", { fairnessKey: "fair:tenant-c", lastSelectedSequence: 1, costUnits: 4 }),
    ],
  };
  const first = selectCcpFairQueueV1(input);
  const second = selectCcpFairQueueV1(structuredClone(input));
  assert.equal(first.schemaVersion, CCP_FAIR_QUEUE_SELECTION_SCHEMA_V1);
  assert.deepEqual(first.selected.map((item) => item.candidateId), ["queue:beta", "queue:alpha"]);
  assert.equal(first.selectedCostUnits, 5);
  assert.equal(first.remainingBudgetUnits, 0);
  assert.equal(first.eligibleCount, 3);
  assert.equal(first.excludedCount, 1);
  assert.equal(first.exclusions[0]?.reasonCode, "COST_BUDGET_EXCEEDED");
  assert.equal(canonicalCcpFairQueueSelectionJsonV1(first), canonicalCcpFairQueueSelectionJsonV1(second));
  assert.equal(Object.isFrozen(first), true);
  assert.equal(verifyCcpFairQueueSelectionV1(first)?.selectionDigest, first.selectionDigest);
});

test("CCP-PSAI52-FQ-002 superseded, quarantined and unknown receipts are excluded before claim", () => {
  const input = {
    schemaVersion: "cm.ccp-fair-queue-selection-input/v1",
    selectionId: "selection:scheduler-round-2",
    logicalAtMs: 100,
    maxItems: 3,
    budget: makeBudget(),
    candidates: [
      candidate("current"),
      candidate("superseded", { headState: "SUPERSEDED", deepCiClaimEligible: false }),
      candidate("quarantined", { admissionState: "QUARANTINED", deepCiClaimEligible: false }),
      candidate("unknown", { admissionState: "UNKNOWN", headState: "UNKNOWN", deepCiClaimEligible: false }),
    ],
  };
  const result = selectCcpFairQueueV1(input);
  assert.deepEqual(result.selected.map((item) => item.candidateId), ["queue:current"]);
  assert.deepEqual(result.exclusions.map((item) => item.reasonCode), [
    "SUPERSEDED_CANDIDATE",
    "QUARANTINED_CANDIDATE",
    "UNKNOWN_CANDIDATE",
  ]);
  assert.ok(result.selected.every((item) => item.deepCiClaimEligible));
});

test("CCP-PSAI52-FQ-003 malformed and forged selection receipts deny", () => {
  assert.throws(() => selectCcpFairQueueV1({}), /CCP_FAIR_QUEUE_SCHEMA_DENIED/);
  const result = selectCcpFairQueueV1({
    schemaVersion: "cm.ccp-fair-queue-selection-input/v1",
    selectionId: "selection:scheduler-round-3",
    logicalAtMs: 100,
    maxItems: 1,
    budget: makeBudget(),
    candidates: [candidate("only")],
  });
  const forged = structuredClone(result) as unknown as Record<string, unknown>;
  forged.selectedCount = 99;
  assert.equal(verifyCcpFairQueueSelectionV1(forged), null);
  assert.throws(() => parseCcpFairQueueSelectionV1({ ...result, foreignField: true }), /CCP_FAIR_QUEUE_SCHEMA_DENIED/);
});
