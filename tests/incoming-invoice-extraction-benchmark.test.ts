import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import test from "node:test";
import Ajv2020 from "ajv/dist/2020.js";
import {
  AP03_EXTRACTION_HOLDOUT_SHA256_V1,
  benchmarkSyntheticInvoiceExtractionV1,
  validateIncomingInvoiceExtractionProposalV1,
} from "../packages/contracts/src/index.js";

const holdoutPath = "tests/fixtures/incoming-invoice/ap-03-holdout-v1.json";
const holdoutBytes = readFileSync(holdoutPath);
const holdout = JSON.parse(holdoutBytes.toString("utf8"));

function squared(value: number): number { return value * value; }

test("AP-03-AC01 frozen local-synthetic holdout covers layout, line items, taxes, totals and failure cases", () => {
  assert.equal(createHash("sha256").update(holdoutBytes).digest("hex"), AP03_EXTRACTION_HOLDOUT_SHA256_V1);
  assert.equal(AP03_EXTRACTION_HOLDOUT_SHA256_V1, "41959bab323542694b120f8d55314620c214f3a44f7c8d36270e47ac8f9b9edb");
  assert.deepEqual(holdout.sourceBinding, {
    sourceId: "source:synthetic:ap-02:supplier-invoice-v1",
    sourceSha256: "fad5979234e5ca8d31e2a10e7a9650c5f4f32693610c2fcf2678b0ab5a5f525b",
    supplierId: "SYN-SUP-001",
    invoiceNumber: "SYN-INV-2026-0001",
  });
  assert.deepEqual(holdout.authority, {
    mode: "LOCAL_SYNTHETIC_PROOF", customerData: false, externalProvider: false, productivePosting: false,
  });
  const valid = holdout.cases.filter((item: { expected: { disposition: string } }) => item.expected.disposition === "VALID");
  const rejected = holdout.cases.filter((item: { expected: { disposition: string } }) => item.expected.disposition === "REJECTED");
  assert.equal(valid.length, 3);
  assert.equal(rejected.length, 2);
  assert.deepEqual(valid.map((item: { expected: { extraction: { layout: string } } }) => item.expected.extraction.layout),
    ["TABLE", "COMPACT", "TAX_EXEMPT"]);
  for (const item of valid) {
    assert.ok(item.expected.extraction.lineItems.length > 0);
    assert.ok(item.expected.extraction.taxes.length > 0);
    assert.deepEqual(Object.keys(item.expected.extraction.totals).sort(),
      ["grossAmountMinor", "netAmountMinor", "taxAmountMinor"]);
  }
  assert.deepEqual(rejected.map((item: { expected: { reasonCode: string } }) => item.expected.reasonCode),
    ["VALIDATION_TOTAL_MISMATCH", "LAYOUT_UNSUPPORTED"]);
});

test("AP-03-AC02 deterministic baseline and bounded synthetic model proposal use exact internally-derived denominators", () => {
  const report = benchmarkSyntheticInvoiceExtractionV1(holdout, AP03_EXTRACTION_HOLDOUT_SHA256_V1);
  assert.equal(report.outcome, "PUBLISHED");
  if (report.outcome !== "PUBLISHED") throw new Error("expected benchmark report");
  const validCount = holdout.cases.filter((item: { expected: { disposition: string } }) => item.expected.disposition === "VALID").length;
  assert.deepEqual(report.denominators, {
    disposition: holdout.cases.length,
    layout: validCount,
    lineItems: validCount,
    taxes: validCount,
    totals: validCount,
    confidence: holdout.cases.length,
  });
  assert.deepEqual(report.systems.baseline.exactCorrect, {
    disposition: 5, layout: 3, lineItems: 3, taxes: 3, totals: 3,
  });
  assert.deepEqual(report.systems.boundedSyntheticModel.exactCorrect, {
    disposition: 4, layout: 2, lineItems: 2, taxes: 2, totals: 2,
  });
  assert.equal(report.systems.baseline.proposalKind, "DETERMINISTIC_BASELINE");
  assert.equal(report.systems.boundedSyntheticModel.proposalKind, "BOUNDED_SYNTHETIC_MODEL_PROPOSAL");
  assert.equal(Object.isFrozen(report), true);
});

test("AP-03-AC03 no model output becomes authoritative without validation", () => {
  const invalid = validateIncomingInvoiceExtractionProposalV1({
    proposalKind: "BOUNDED_SYNTHETIC_MODEL_PROPOSAL",
    caseId: "adversarial",
    confidence: 1,
    disposition: "VALID",
    extraction: {
      layout: "TABLE",
      lineItems: [{ description: "Invented", quantity: 1, unitAmountMinor: 100, netAmountMinor: 999 }],
      taxes: [{ rateBasisPoints: 2000, baseAmountMinor: 999, taxAmountMinor: 200 }],
      totals: { netAmountMinor: 999, taxAmountMinor: 200, grossAmountMinor: 1199 },
    },
    authoritative: true,
  }, "LAYOUT=TABLE\nLINE=Invented|1|100|100\nTAX=20|100|20\nTOTAL=100|20|120");
  assert.deepEqual(invalid, {
    outcome: "REJECTED", reasonCode: "PROPOSAL_SHAPE_DENIED", validated: false, authoritative: false,
  });

  const report = benchmarkSyntheticInvoiceExtractionV1(holdout, AP03_EXTRACTION_HOLDOUT_SHA256_V1);
  assert.equal(report.outcome, "PUBLISHED");
  if (report.outcome !== "PUBLISHED") throw new Error("expected benchmark report");
  assert.equal(report.authority.authoritativeOutputs, false);
  assert.equal(report.authority.productivePostingAuthorized, false);
  assert.equal(report.authority.customerDataAuthorized, false);
  assert.equal(report.authority.externalProviderCalls, false);
  assert.equal(report.systems.boundedSyntheticModel.validation.validated + report.systems.boundedSyntheticModel.validation.rejected,
    report.denominators.confidence);
  assert.ok(report.systems.boundedSyntheticModel.validation.rejected > 0);
});

test("AP-03-AC04 benchmark publishes errors, confidence calibration and explicit nonclaims", () => {
  const report = benchmarkSyntheticInvoiceExtractionV1(holdout, AP03_EXTRACTION_HOLDOUT_SHA256_V1);
  assert.equal(report.outcome, "PUBLISHED");
  if (report.outcome !== "PUBLISHED") throw new Error("expected benchmark report");
  assert.deepEqual(report.errors.map((error) => [error.systemId, error.caseId, error.dimension]), [
    ["bounded-synthetic-model-v1", "layout-compact-multi-line", "disposition"],
    ["bounded-synthetic-model-v1", "layout-compact-multi-line", "layout"],
    ["bounded-synthetic-model-v1", "layout-compact-multi-line", "lineItems"],
    ["bounded-synthetic-model-v1", "layout-compact-multi-line", "taxes"],
    ["bounded-synthetic-model-v1", "layout-compact-multi-line", "totals"],
  ]);
  const confidences = [0.95, 0.8, 0.85, 0.9, 0.9];
  const correctness = [1, 0, 1, 1, 1];
  const expectedBrier = confidences.reduce((sum, confidence, index) =>
    sum + squared(confidence - correctness[index]!), 0) / correctness.length;
  assert.equal(report.systems.boundedSyntheticModel.confidenceCalibration.brierScore, expectedBrier);
  assert.deepEqual(report.systems.boundedSyntheticModel.confidenceCalibration.bins, [{
    lowerInclusive: 0.8, upperInclusive: 1, count: 5, meanConfidence: 0.88, observedExactDispositionAccuracy: 0.8,
  }]);
  assert.deepEqual(report.nonclaims, [
    "NO_CUSTOMER_DATA_EVALUATED",
    "NO_EXTERNAL_PROVIDER_EVALUATED",
    "NO_PRODUCTIVE_ALLOCATION_OR_POSTING_AUTHORIZED",
    "NO_ARBITRARY_MODEL_CLAIM",
    "NO_PRODUCTION_FITNESS_CLAIM",
  ]);
  const schema = JSON.parse(readFileSync("schemas/contracts/incoming-invoice-extraction-benchmark-v1.schema.json", "utf8"));
  const validate = new Ajv2020({ allErrors: true, strict: true }).compile(schema);
  assert.equal(validate(report), true, JSON.stringify(validate.errors));
});

test("AP-03 rejects mutated or malformed holdouts instead of changing benchmark denominators", () => {
  assert.deepEqual(benchmarkSyntheticInvoiceExtractionV1({ ...holdout, unexpected: true }, AP03_EXTRACTION_HOLDOUT_SHA256_V1), {
    outcome: "DENIED", reasonCode: "HOLDOUT_SHAPE_DENIED",
  });
  assert.deepEqual(benchmarkSyntheticInvoiceExtractionV1(holdout, "0".repeat(64)), {
    outcome: "DENIED", reasonCode: "HOLDOUT_DIGEST_DENIED",
  });
});

test("AP-03 focused suite is registered exactly once in canonical pretest", () => {
  const packageJson = JSON.parse(readFileSync("package.json", "utf8")) as { scripts: Record<string, string> };
  assert.equal(packageJson.scripts["incoming-invoice-extraction:test"],
    "npm run build --silent && node --test dist/tests/incoming-invoice-extraction-benchmark.test.js");
  assert.equal(((packageJson.scripts.pretest ?? "").match(/npm run incoming-invoice-extraction:test/g) ?? []).length, 1);
});
