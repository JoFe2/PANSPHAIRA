import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  canonical,
  loadReadbackFixture,
  replayReadback,
  renderPublicReport,
  validateReadbackFixture,
} from "../scripts/cks-05-replay-readback.mjs";

const root = resolve(import.meta.dirname, "..");
const fixturePath = resolve(root, "verification/cks-05-public-readback-template-v1.json");

function fixture() {
  return JSON.parse(readFileSync(fixturePath, "utf8"));
}

test("CKS-05 replay recomputes the sealed chain and renders all required A/B cells", () => {
  const readback = replayReadback(fixture(), root);
  assert.equal(readback.status, "READBACK_VALID");
  assert.deepEqual(readback.chain.validationErrors, []);
  assert.equal(readback.chain.stages.length, 5);
  assert.equal(readback.runCounts.scheduled, 120);
  assert.equal(readback.runCounts.failed, 6);
  assert.equal(readback.runCounts.invalidated, 3);
  assert.equal(readback.runCounts.scored, 117);
  assert.deepEqual(
    readback.comparisons.map((comparison) => comparison.reportId),
    fixture().requiredComparisons,
  );
  assert.equal(readback.claimGuard.status, "DENY");
  assert.equal(readback.claimGuard.modelSubstitutionClaim, false);
  assert.equal(readback.publicSafe.rawTaskBytesPublished, false);
  assert.equal(readback.publicSafe.rawKnowledgeSeedBytesPublished, false);
  assert.equal(readback.publicSafe.rawRenderingBytesPublished, false);
  assert.match(readback.reportDraft, /structured versus raw/i);
  assert.match(readback.reportDraft, /facts versus non-answer guidance/i);
  assert.match(readback.reportDraft, /static versus updated/i);
  assert.match(readback.reportDraft, /single-hop versus multi-hop/i);
  assert.doesNotMatch(readback.reportDraft, /finalAnswer|goldRecord|answerClaims/);
});

test("CKS-05 readback preserves per-arm counts, uncertainty, and every failure", () => {
  const readback = replayReadback(fixture(), root);
  assert.deepEqual(
    Object.fromEntries(Object.entries(readback.perArm["ARM-LRF-01"]).filter(([key]) => key !== "scoreAggregates")),
    { scheduled: 24, observed: 24, completed: 18, failed: 6, invalidated: 0, scored: 24 },
  );
  assert.equal(readback.failures.length, 9);
  assert.equal(readback.failures.filter((failure) => failure.failureCodeOrNull === "TIMEOUT").length, 6);
  assert.equal(readback.failures.filter((failure) => failure.failureCodeOrNull === "DOCKER_ENOENT").length, 3);
  assert.equal(readback.comparisons[0].confidenceInterval.available, true);
  assert.equal(readback.comparisons[0].confidenceInterval.resamplingUnitCount, 4);
  assert.equal(readback.scoreAggregates.task_success.denominator, 117);
  assert.equal(readback.stopConditions.ruleIds.includes("STOP-06-RESOURCE-OR-TIME"), true);
  assert.equal(readback.stopConditions.ruleIds.includes("FALSIFY-SUBSTITUTION"), true);
  assert.ok(readback.stopConditions.simplifications.every((entry) => entry.endsWith("=BLOCKED_UNTIL_COMPLETE_VALID_EVIDENCE")));
});

test("CKS-05 readback fails closed on a source binding change", () => {
  const altered = fixture();
  altered.evidenceChain.l1Manifest.manifestId = "forged-manifest";
  assert.throws(
    () => replayReadback(altered, root),
    /FAIL_CLOSED_READBACK_REJECTED:.*L1_BINDING/,
  );
});

test("CKS-05 fixture validation rejects claim guard weakening", () => {
  const altered = fixture();
  altered.publicSafeContract.substitutionClaimRequiresQualityAndEfficiency = false;
  assert.match(validateReadbackFixture(altered).join("; "), /CLAIM_GUARD_DRIFT/);
});

test("CKS-05 report rendering is deterministic", () => {
  const readback = replayReadback(fixture(), root);
  assert.equal(renderPublicReport(readback), renderPublicReport(structuredClone(readback)));
  assert.equal(canonical(readback), canonical(replayReadback(fixture(), root)));
});

// Keep the imported loader exercised as part of the public CLI contract.
test("CKS-05 loader resolves the repository fixture", () => {
  assert.equal(loadReadbackFixture("verification/cks-05-public-readback-template-v1.json", root).fixtureId, "CKS05-PUBLIC-READBACK-V1");
});
