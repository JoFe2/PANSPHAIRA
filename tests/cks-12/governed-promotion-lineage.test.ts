import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const modulePath = import.meta.url.endsWith(".ts") ? "../../src/cks-12/governed-promotion-lineage.ts" : "../../src/cks-12/governed-promotion-lineage.js";
const governed: typeof import("../../src/cks-12/governed-promotion-lineage.js") = await import(modulePath);
const fixtureBytes = readFileSync("tests/fixtures/cks-12/governed-promotion-v1.json");
const fixture = JSON.parse(fixtureBytes.toString("utf8"));
const receipt = JSON.parse(readFileSync("verification/cks-12/governed-promotion-lineage-receipt-v1.json", "utf8"));
const hash = (value: Uint8Array) => createHash("sha256").update(value).digest("hex");

test("CKS-12 SS-10/11: validated public-synthetic candidate is separately governed-promoted", () => {
  const promotion = governed.promoteGovernedSyntheticKnowledge(fixture);
  assert.ok(!("reasonCodes" in promotion));
  if ("reasonCodes" in promotion) return;
  assert.equal(promotion.state, "PROMOTED_SYNTHETIC_ONLY");
  assert.deepEqual(promotion, receipt.outcomes.promotion);
  assert.equal(promotion.authority, "NONE");
  assert.equal(promotion.effect, "NONE");
});
test("CKS-12 SS-22/23: supersession invalidates dependencies and unknown variant aborts safely", () => {
  const promotion = governed.promoteGovernedSyntheticKnowledge(fixture);
  assert.ok(!("reasonCodes" in promotion));
  if ("reasonCodes" in promotion) return;
  const requalification = governed.invalidateKnowledgeDependencies({ promotedKnowledge: promotion, ...fixture.requalification });
  assert.deepEqual(requalification, receipt.outcomes.requalification);
  assert.deepEqual(governed.evaluateKnownVariantFastPath({ variant: "UNDECLARED", validationState: "VALIDATED" }), receipt.outcomes.unknownVariant);
});
test("governed promotion fails closed for stale, synthetic-scope, direct-promotion, and re-digested substitution violations", () => {
  for (const mutate of [
    (value: any) => { value.validation.stale = true; },
    (value: any) => { value.candidate.sourceKind = "LIVE_EXTERNAL"; },
    (value: any) => { value.promotionRequested = false; },
    (value: any) => { value.candidate.knowledgeSha256 = "0".repeat(64); value.validation.receiptSha256 = governed.digest(Object.fromEntries(Object.entries(value.validation).filter(([key]) => key !== "receiptSha256"))); },
  ]) {
    const value = structuredClone(fixture);
    mutate(value);
    const outcome = governed.promoteGovernedSyntheticKnowledge(value);
    assert.ok("status" in outcome);
    if ("status" in outcome) assert.equal(outcome.status, "DENIED");
  }
});
test("governed fixture and receipt are immutable, version-bound evidence", () => {
  assert.equal(fixtureBytes.toString("utf8"), governed.canonicalJson(fixture));
  assert.equal(receipt.fixtureSha256, hash(fixtureBytes));
  const { receiptSha256, ...body } = receipt;
  assert.equal(receiptSha256, governed.digest(body));
  assert.deepEqual(governed.createReceipt(receipt.fixtureSha256, receipt.outcomes), receipt);
});
