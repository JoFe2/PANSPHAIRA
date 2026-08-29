import assert from "node:assert/strict";
import test from "node:test";

import {
  canonicalCcpCostBudgetJsonV1,
  ccpCostBudgetDigestV1,
  makeCcpCostBudgetV1,
  parseCcpCostBudgetV1,
  verifyCcpCostBudgetV1,
} from "../packages/contracts/src/ccp-cost-budget.js";

const identity = {
  ledgerId: "ledger:ccp-scheduler",
  tenantId: "tenant:synthetic",
  repositoryId: "repository:pansphaira",
  contributionId: "contribution:psai52-scheduler",
};

function input(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    budgetId: "budget:scheduler-window",
    ...identity,
    logicalAtMs: 10,
    budgetUnits: 12,
    committedUnits: 7,
    consumedUnits: 3,
    ...overrides,
  };
}

test("CCP-PSAI52-COST-001 creates a deterministic finite budget receipt", () => {
  const first = makeCcpCostBudgetV1(input());
  const second = makeCcpCostBudgetV1({ ...input(), consumedUnits: 3 });
  assert.equal(first.remainingUnits, 5);
  assert.equal(first.exhausted, false);
  assert.equal(first.budgetDigest, ccpCostBudgetDigestV1(first));
  assert.equal(canonicalCcpCostBudgetJsonV1(first), canonicalCcpCostBudgetJsonV1(second));
  assert.equal(Object.isFrozen(first), true);
  assert.equal(parseCcpCostBudgetV1(Object.fromEntries(Object.entries(first).reverse())).budgetDigest, first.budgetDigest);
});

test("CCP-PSAI52-COST-002 exhaustion and counters are explicit", () => {
  const exhausted = makeCcpCostBudgetV1(input({ budgetUnits: 4, committedUnits: 4, consumedUnits: 4 }));
  assert.deepEqual(
    { remainingUnits: exhausted.remainingUnits, exhausted: exhausted.exhausted },
    { remainingUnits: 0, exhausted: true },
  );
  assert.notEqual(verifyCcpCostBudgetV1(exhausted), null);
});

test("CCP-PSAI52-COST-003 malformed order, drift and unknown fields deny fail-closed", () => {
  assert.throws(() => makeCcpCostBudgetV1(input({ budgetUnits: 0 })), /CCP_COST_BUDGET_SCHEMA_DENIED/);
  assert.throws(() => makeCcpCostBudgetV1(input({ committedUnits: 13 })), /CCP_COST_BUDGET_SCHEMA_DENIED/);
  assert.throws(() => makeCcpCostBudgetV1(input({ consumedUnits: 8 })), /CCP_COST_BUDGET_SCHEMA_DENIED/);
  const budget = makeCcpCostBudgetV1(input());
  const forged = { ...budget, remainingUnits: 99 };
  assert.equal(verifyCcpCostBudgetV1(forged), null);
  assert.throws(() => parseCcpCostBudgetV1({ ...budget, foreignField: true }), /CCP_COST_BUDGET_SCHEMA_DENIED/);
  assert.throws(() => parseCcpCostBudgetV1("not-a-budget"), /CCP_COST_BUDGET_SCHEMA_DENIED/);
});
