import assert from "node:assert/strict";
import test from "node:test";

import { makeCcpCostBudgetV1 } from "../packages/contracts/src/ccp-cost-budget.js";
import {
  selectCcpFairQueueV1,
  type CcpFairQueueCandidateV1,
} from "../packages/contracts/src/ccp-fair-queue.js";
import {
  canonicalCcpSloObservabilityJsonV1,
  parseCcpSloObservabilityV1,
  projectCcpSloObservabilityV1,
  verifyCcpSloObservabilityV1,
  CCP_SLO_CLAIM_BOUNDARY_V1,
} from "../packages/contracts/src/ccp-slo-observability.js";

const digest = (_character: string): string => "0123456789abcdef".repeat(4);
const identity = {
  ledgerId: "ledger:ccp-scheduler",
  tenantId: "tenant:synthetic",
  repositoryId: "repository:pansphaira",
  contributionId: "contribution:psai52-scheduler",
};

function candidate(id: string, overrides: Partial<CcpFairQueueCandidateV1> = {}): CcpFairQueueCandidateV1 {
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
    fairnessKey: `fair:${id}`,
    lastSelectedSequence: 0,
    ...overrides,
  };
}

function fixture() {
  const candidates = [
    candidate("alpha", { fairnessKey: "fair:tenant-a", costUnits: 2, enqueuedAtMs: 10 }),
    candidate("beta", { fairnessKey: "fair:tenant-b", costUnits: 1, enqueuedAtMs: 20, lastSelectedSequence: 1 }),
    candidate("gamma", { fairnessKey: "fair:tenant-c", costUnits: 1, enqueuedAtMs: 30, lastSelectedSequence: 2 }),
    candidate("superseded", { headState: "SUPERSEDED", deepCiClaimEligible: false }),
    candidate("quarantined", { admissionState: "QUARANTINED", deepCiClaimEligible: false }),
    candidate("unknown", { admissionState: "UNKNOWN", headState: "UNKNOWN", deepCiClaimEligible: false }),
  ];
  const selection = selectCcpFairQueueV1({
    schemaVersion: "cm.ccp-fair-queue-selection-input/v1",
    selectionId: "selection:scheduler-slo",
    logicalAtMs: 100,
    maxItems: 2,
    budget: makeCcpCostBudgetV1({
      budgetId: "budget:scheduler-window",
      ...identity,
      logicalAtMs: 0,
      budgetUnits: 10,
      committedUnits: 0,
      consumedUnits: 0,
    }),
    candidates,
  });
  return { candidates, selection };
}

test("CCP-PSAI52-SLO-001 projects queue age, fairness, cost and recovery SLOs", () => {
  const { candidates, selection } = fixture();
  const observation = projectCcpSloObservabilityV1({
    schemaVersion: "cm.ccp-slo-observation-input/v1",
    observationId: "observation:scheduler-round",
    logicalAtMs: 100,
    selection,
    candidates,
    recovery: { attempts: 4, recovered: 3, failed: 1 },
    targets: {
      maxQueueAgeMs: 95,
      minFairnessCoverageBps: 6000,
      maxSelectedCostUnits: 4,
      minRecoveryRateBps: 7000,
    },
  });
  assert.equal(observation.outcome, "SLO_MET");
  assert.equal(observation.claimBoundary, CCP_SLO_CLAIM_BOUNDARY_V1);
  assert.deepEqual(observation.queueAge, {
    eligibleCount: 3,
    oldestEligibleAgeMs: 90,
    p95EligibleAgeMs: 90,
    targetMaxQueueAgeMs: 95,
    met: true,
  });
  assert.deepEqual(observation.fairness, {
    eligibleFairnessKeyCount: 3,
    selectedFairnessKeyCount: 2,
    coverageBps: 6666,
    targetCoverageBps: 6000,
    met: true,
  });
  assert.equal(observation.cost.selectedUnits, 3);
  assert.equal(observation.recovery.recoveryRateBps, 7500);
  assert.equal(observation.exclusions.total, 4);
  assert.deepEqual(
    observation.exclusions.byReason.filter((item) => item.count > 0),
    [
      { reasonCode: "UNKNOWN_CANDIDATE", count: 1 },
      { reasonCode: "QUARANTINED_CANDIDATE", count: 1 },
      { reasonCode: "SUPERSEDED_CANDIDATE", count: 1 },
      { reasonCode: "MAX_ITEMS_REACHED", count: 1 },
    ],
  );
  assert.equal(Object.isFrozen(observation), true);
  assert.equal(verifyCcpSloObservabilityV1(observation)?.observationDigest, observation.observationDigest);
});

test("CCP-PSAI52-SLO-002 misses an explicit target without claiming deep verification", () => {
  const { candidates, selection } = fixture();
  const observation = projectCcpSloObservabilityV1({
    schemaVersion: "cm.ccp-slo-observation-input/v1",
    observationId: "observation:scheduler-miss",
    logicalAtMs: 100,
    selection,
    candidates,
    recovery: { attempts: 4, recovered: 1, failed: 3 },
    targets: {
      maxQueueAgeMs: 10,
      minFairnessCoverageBps: 9000,
      maxSelectedCostUnits: 2,
      minRecoveryRateBps: 9000,
    },
  });
  assert.equal(observation.outcome, "SLO_MISSED");
  assert.equal(observation.claimBoundary, "SLO_PROJECTION_ONLY_NO_DEEP_VERIFICATION_CLAIM");
  assert.equal(observation.queueAge.met, false);
  assert.equal(observation.fairness.met, false);
  assert.equal(observation.cost.met, false);
  assert.equal(observation.recovery.met, false);
});

test("CCP-PSAI52-SLO-003 canonical read-back and malformed evidence deny fail-closed", () => {
  const { candidates, selection } = fixture();
  const input = {
    schemaVersion: "cm.ccp-slo-observation-input/v1",
    observationId: "observation:scheduler-readback",
    logicalAtMs: 100,
    selection,
    candidates,
    recovery: { attempts: 0, recovered: 0, failed: 0 },
    targets: { maxQueueAgeMs: 100, minFairnessCoverageBps: 0, maxSelectedCostUnits: 5, minRecoveryRateBps: 10000 },
  };
  const first = projectCcpSloObservabilityV1(input);
  const second = projectCcpSloObservabilityV1(structuredClone(input));
  assert.equal(canonicalCcpSloObservabilityJsonV1(first), canonicalCcpSloObservabilityJsonV1(second));
  assert.equal(parseCcpSloObservabilityV1(first).observationDigest, first.observationDigest);
  const forged = structuredClone(first) as unknown as Record<string, unknown>;
  (forged.recovery as Record<string, unknown>).recovered = 99;
  assert.equal(verifyCcpSloObservabilityV1(forged), null);
  assert.throws(() => projectCcpSloObservabilityV1({ ...input, candidates: [] }), /CCP_SLO_OBSERVATION_SCHEMA_DENIED/);
});
