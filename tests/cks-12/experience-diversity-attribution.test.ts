import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { test } from "node:test";
const modulePath = import.meta.url.endsWith(".ts") ? "../../src/cks-12/experience-diversity-attribution.ts" : "../../src/cks-12/experience-diversity-attribution.js";
const experience: typeof import("../../src/cks-12/experience-diversity-attribution.js") = await import(modulePath);
const bytes = readFileSync("tests/fixtures/cks-12/experience-diversity-v1.json"); const fixture = JSON.parse(bytes.toString("utf8")); const receipt = JSON.parse(readFileSync("verification/cks-12/experience-diversity-receipt-v1.json", "utf8"));
const hash = (value: Uint8Array) => createHash("sha256").update(value).digest("hex");
test("CKS-12 SS-12 through SS-18 preserve lineage, distinct diversity evidence, and attributed narrowing", () => {
  const result = experience.validateExperienceDiversity(fixture);
  assert.equal(result.status, "EXPERIENCE_VALIDATED");
  assert.deepEqual(result, receipt.evidence);
  if (result.status !== "EXPERIENCE_VALIDATED") return;
  assert.equal(result.operationalRepetitions, 3); assert.equal(result.generalizationUnits, 3); assert.equal(result.attributedFailureCount, 3); assert.equal(result.narrowedApplicability.state, "PROMOTED_SYNTHETIC_ONLY");
});
test("repetition/generalization conflation and stale narrowing fail closed", () => {
  const conflated = structuredClone(fixture); conflated.generalizations[1].stratum = "REGION-A";
  const stale = structuredClone(fixture); stale.applicability.stale = true;
  const ungovened = structuredClone(fixture); ungovened.applicability.lifecycle.splice(1, 1);
  for (const value of [conflated, stale, ungovened]) { const result = experience.validateExperienceDiversity(value); assert.equal(result.status, "DENIED"); }
});
test("experience fixture and receipt bind exact immutable evidence", () => {
  assert.equal(bytes.toString("utf8"), experience.canonicalJson(fixture)); assert.equal(receipt.fixtureSha256, hash(bytes));
  const { receiptSha256, ...body } = receipt; assert.equal(receiptSha256, experience.digest(body));
  const result = experience.validateExperienceDiversity(fixture); assert.notEqual(result.status, "DENIED"); if (result.status !== "DENIED") assert.deepEqual(experience.createReceipt(receipt.fixtureSha256, result), receipt);
});
