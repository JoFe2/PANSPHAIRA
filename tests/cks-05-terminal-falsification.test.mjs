import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import test from "node:test";

const canonical = (value) => {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value && typeof value === "object") return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonical(value[key])}`).join(",")}}`;
  return JSON.stringify(value);
};
const sha256 = (value) => createHash("sha256").update(value).digest("hex");
const receipt = JSON.parse(readFileSync("verification/cks-05-real-pilot-v4-receipt.json", "utf8"));
const report = readFileSync("docs/benchmarks/cks-05-falsification-report-v1.md", "utf8");

test("CKS-05 terminal report binds the exact real five-arm receipt", () => {
  const { receiptSha256, ...unsigned } = receipt;
  assert.equal(receiptSha256, sha256(canonical(unsigned)));
  assert.equal(receipt.runCounts.scheduled, 5);
  assert.equal(receipt.runCounts.completed, 5);
  assert.equal(receipt.runCounts.failed, 0);
  assert.deepEqual(receipt.results.map((result) => result.armId), [
    "ARM-SCB-01", "ARM-SNR-02", "ARM-SKF-03", "ARM-LCB-04", "ARM-LKF-05",
  ]);
  assert.equal(receipt.results.filter((result) => result.closedBook).length, 2);
  assert.equal(receipt.metrics.taskSuccessCount, 0);
  assert.equal(receipt.metrics.closedBookAbstentionCount, 1);
  assert.equal(receipt.metrics.closedBookUnsupportedAnswerCount, 0);
});

test("CKS-05 stop condition denies substitution and avoids fabricated confidence", () => {
  assert.equal(receipt.claimGate.status, "DENY_PILOT_INSUFFICIENT_FOR_DOD");
  assert.equal(receipt.claimGate.modelSubstitutionClaim, false);
  assert.equal(receipt.claimGate.qualityThresholdsPass, false);
  assert.equal(receipt.claimGate.efficiencyThresholdsPass, false);
  assert.equal(receipt.metrics.confidenceIntervals, "UNAVAILABLE_N_EQUALS_ONE_PER_ARM");
  assert.match(report, /FALSIFIED_EARLY_STOP/);
  assert.match(report, new RegExp(receipt.receiptSha256));
  assert.match(report, /model substitution: \*\*denied\*\*/i);
  assert.doesNotMatch(report, /structured-vs-raw superiority: \*\*claimed\*\*/i);
});

test("CKS-05 durable receipt publishes digests and counts, never raw model material", () => {
  for (const result of receipt.results) {
    assert.match(result.promptSha256, /^[a-f0-9]{64}$/);
    assert.match(result.stdoutSha256, /^[a-f0-9]{64}$/);
    assert.match(result.generatedOutputSha256, /^[a-f0-9]{64}$/);
    assert.equal("stdout" in result, false);
    assert.equal("stderr" in result, false);
    assert.equal("prompt" in result, false);
  }
});
