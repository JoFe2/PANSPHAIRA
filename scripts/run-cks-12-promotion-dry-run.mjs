#!/usr/bin/env node
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

if (process.argv.length !== 3 || process.argv[2] !== "--dry-run") {
  console.error("usage: node scripts/run-cks-12-promotion-dry-run.mjs --dry-run");
  process.exitCode = 2;
} else {
  const root = fileURLToPath(new URL("..", import.meta.url));
  const fixture = JSON.parse(readFileSync(`${root}/tests/fixtures/cks-12/governed-promotion-v1.json`, "utf8"));
  const expected = JSON.parse(readFileSync(`${root}/verification/cks-12/governed-promotion-lineage-receipt-v1.json`, "utf8"));
  const governed = await import("../dist/src/cks-12/governed-promotion-lineage.js");

  const validation = governed.validateGovernedSyntheticKnowledge(fixture);
  const promotion = governed.promoteGovernedSyntheticKnowledge(fixture);
  const input = { promotedKnowledge: promotion, validation, solution: fixture.solution, lineage: fixture.lineage };
  const solution = governed.recordGroundedSolution(input);
  const lineage = governed.recordUsageOutcomeLineage(input);
  const requalification = governed.invalidateKnowledgeDependencies({ promotedKnowledge: promotion, ...fixture.requalification });
  const unknownVariant = governed.evaluateKnownVariantFastPath({ variant: "UNDECLARED", validationState: "VALIDATED" });
  const outcomes = { validation, promotion, solution, lineage, requalification, unknownVariant };

  assert.deepEqual(outcomes, expected.outcomes);
  assert.equal(validation.status, "VALIDATED");
  assert.equal(promotion.state, "PROMOTED_SYNTHETIC_ONLY");
  assert.equal(solution.status, "GROUNDED_SOLUTION_RECORDED");
  assert.equal(lineage.status, "USAGE_OUTCOME_LINEAGE_RECORDED");
  console.log(governed.canonicalJson({
    schemaVersion: "chimpmaera.cks/governed-promotion-dry-run/v1",
    status: "PASS_SYNTHETIC_ONLY",
    validationReceiptId: validation.validationReceiptId,
    promotionReceiptId: promotion.promotionReceiptId,
    solutionId: solution.solutionId,
    lineageReceiptId: lineage.lineageReceiptId,
    authority: "NONE",
    capabilityDelta: "NONE",
    effect: "NONE",
    productionClaimed: false,
  }));
}
