import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import test from "node:test";
import Ajv2020 from "ajv/dist/2020.js";
import {
  AP03_EXTRACTION_HOLDOUT_SHA256_V1,
  AP04_ERV_CASE_PACK_SHA256_V1,
  benchmarkSyntheticInvoiceExtractionV1,
  canonicalJson,
  compileErvCapabilityCoreV1,
  ERV_ANALYTICS_METRIC_CATALOG_V1,
  generateErvAnalyticsLocalReportV1,
  generateErvAnalyticsPackV1,
  verifyErvAnalyticsPackV1,
  type ErvAnalyticsPackInputV1,
} from "../packages/contracts/src/index.js";

const AP03_PATH = "tests/fixtures/incoming-invoice/ap-03-holdout-v1.json";
const AP04_PATH = "tests/fixtures/incoming-invoice/ap-04-erv-cases-v1.json";
const SCHEMA_PATH = "schemas/contracts/incoming-invoice-erv-analytics-v1.schema.json";
const ARTIFACT_PATH = "verification/incoming-invoice-erv-analytics-v1.json";
const AP03_BYTES_V1 = 2991;
const AP04_BYTES_V1 = 19841;

function bytes(path: string): Uint8Array {
  return Uint8Array.from(readFileSync(path));
}
function baselineInput(): ErvAnalyticsPackInputV1 {
  return {
    scenario: "BASELINE",
    receipts: [
      { receiptId: "AP03_EXTRACTION_RECEIPT_V1", path: AP03_PATH, state: "RELEASED", bytes: bytes(AP03_PATH) },
      { receiptId: "AP04_ERV_CORE_V1", path: AP04_PATH, state: "RELEASED", bytes: bytes(AP04_PATH) },
    ],
    adaptedToleranceRequests: [],
  };
}
function adaptedInput(): ErvAnalyticsPackInputV1 {
  return {
    scenario: "ADAPTED",
    receipts: [
      { receiptId: "AP03_EXTRACTION_RECEIPT_V1", path: AP03_PATH, state: "REQUESTED_NOT_EXECUTED", bytes: new Uint8Array(0) },
      { receiptId: "AP04_ERV_CORE_V1", path: AP04_PATH, state: "RELEASED", bytes: bytes(AP04_PATH) },
    ],
    adaptedToleranceRequests: [{ variantId: "RATE_BPS_V1", rateBasisPoints: 200 }],
  };
}
function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}
function shaHex(value: unknown): string {
  return createHash("sha256").update(canonicalJson(value)).digest("hex");
}
function core(): any {
  const pack = JSON.parse(readFileSync(AP04_PATH, "utf8"));
  const result = compileErvCapabilityCoreV1(pack, AP04_ERV_CASE_PACK_SHA256_V1);
  assert.equal(result.outcome, "DECIDED", "released AP-04 core must decide");
  if (result.outcome !== "DECIDED") throw new Error("expected decided ERV core");
  return result.package;
}
function benchmark(): any {
  const holdout = JSON.parse(readFileSync(AP03_PATH, "utf8"));
  const result = benchmarkSyntheticInvoiceExtractionV1(holdout, AP03_EXTRACTION_HOLDOUT_SHA256_V1);
  assert.equal(result.outcome, "PUBLISHED", "released AP-03 benchmark must publish");
  if (result.outcome !== "PUBLISHED") throw new Error("expected published extraction benchmark");
  return result;
}
function withoutKey(value: any, key: string): any {
  const copy = clone(value);
  delete copy[key];
  return copy;
}

test("ERV-BI-AC01 the metric catalog is closed over all six analyses with frozen formulas", () => {
  const catalog = ERV_ANALYTICS_METRIC_CATALOG_V1;
  assert.equal(catalog.length, 6);
  assert.equal(Object.isFrozen(catalog), true);
  assert.deepEqual(catalog.map((metric) => metric.analysis), [1, 2, 3, 4, 5, 6]);
  assert.deepEqual(catalog.map((metric) => metric.metricId).sort(), [
    "ERV_APPROVAL_WORKLOAD_AMOUNT_BANDS_V1",
    "ERV_EVIDENCE_READBACK_VERDICT_V1",
    "ERV_EXCEPTION_REASON_DISTRIBUTION_V1",
    "ERV_EXTRACTION_OUTCOMES_V1",
    "ERV_FIELD_COMPLETENESS_ERRORS_V1",
    "ERV_MATCH_OUTCOME_TOLERANCE_V1",
  ]);
  assert.equal(new Set(catalog.map((metric) => `${metric.metricId}@${metric.metricVersion}`)).size, 6, "metric ids are unique at a single version");
  for (const metric of catalog) {
    assert.equal(Object.isFrozen(metric), true);
    assert.equal(metric.metricVersion, "1.0.0");
    assert.equal(typeof metric.formula, "string");
    assert.ok(metric.formula.length > 0, "formula is explicit");
    assert.ok(Array.isArray(metric.dimensions) && metric.dimensions.length >= 1, "dimensions are explicit");
    assert.equal(typeof metric.denominator.basis, "string");
    assert.ok(metric.denominator.expected === null || Number.isSafeInteger(metric.denominator.expected));
    assert.equal(typeof metric.unknownHandling, "string");
    assert.ok(metric.unknownHandling.length > 0);
    assert.equal(metric.units, "count");
    assert.ok(metric.applicability.startsWith("APPLIES_WHEN_"), "applicability gate is explicit");
  }
});

test("ERV-BI-AC02 the pack derives only from the exact released receipts with no identity leakage", () => {
  const { pack, serialized } = generateErvAnalyticsPackV1(baselineInput());
  assert.deepEqual(pack.receipts.map((receipt) => [receipt.receiptId, receipt.state, receipt.identity.byteLength, receipt.identity.sha256]), [
    ["AP03_EXTRACTION_RECEIPT_V1", "RELEASED", AP03_BYTES_V1, AP03_EXTRACTION_HOLDOUT_SHA256_V1],
    ["AP04_ERV_CORE_V1", "RELEASED", AP04_BYTES_V1, AP04_ERV_CASE_PACK_SHA256_V1],
  ]);
  assert.equal(pack.binding.ap03ReceiptSha256, AP03_EXTRACTION_HOLDOUT_SHA256_V1);
  assert.equal(pack.binding.ap04CoreDigest, core().readback.decisionDigest, "core digest binds the released AP-04 decision digest");
  assert.equal(pack.core.decisionDigest, core().readback.decisionDigest);
  assert.equal(pack.core.caseCount, 8);
  assert.equal(pack.core.deterministicReplay, true);

  // no raw document, party/invoice identity, free text or credential may appear anywhere in the projection
  for (const token of ["SYN-SUP", "SYN-INV", "INV-2026", "PO-2026", "RCV-2026", "supplierId", "invoiceId", "referenceId", "customerId", "questionText", "credential", "password", "supplier_id", "invoice_number", "2026-09-02"]) {
    assert.equal(serialized.includes(token), false, `leak token ${token}`);
  }
  for (const key of ["bookingAuthorityGranted", "productivePostingAuthorized", "systemOfRecord", "arbitraryQueryAllowed", "erpRequired", "externalPublication", "biExecutionAuthority", "financialOpinion", "fraudClaim"]) {
    assert.equal((pack.authority as Record<string, unknown>)[key], false, key);
  }
  assert.equal(pack.scope, "PREBUILT_AGGREGATE_ANALYSIS");
  assert.deepEqual(pack.nonclaims, [
    "NO_FINANCIAL_OR_ACCOUNTING_OPINION",
    "NO_ANOMALY_OR_FRAUD_CLAIM",
    "NO_PRODUCTION_DASHBOARD",
    "NO_ARBITRARY_QUERY",
    "NO_ERP_DEPENDENCY",
    "NO_EXTERNAL_PUBLICATION",
    "NO_BI_EXECUTION_AUTHORITY",
    "NO_PARTY_OR_INVOICE_IDENTITY",
    "NO_CUSTOMER_DATA_EVALUATED",
  ]);
});

test("ERV-BI-AC03 baseline + adapted produce deterministic COMPLETE/PARTIAL/UNKNOWN states", () => {
  const baseline = generateErvAnalyticsPackV1(baselineInput());
  const adapted = generateErvAnalyticsPackV1(adaptedInput());
  assert.equal(generateErvAnalyticsPackV1(baselineInput()).serialized, baseline.serialized, "deterministic replay (baseline)");
  assert.equal(generateErvAnalyticsPackV1(adaptedInput()).serialized, adapted.serialized, "deterministic replay (adapted)");

  assert.deepEqual(baseline.pack.metrics.map((metric) => metric.state), ["COMPLETE", "COMPLETE", "COMPLETE", "COMPLETE", "COMPLETE", "COMPLETE"]);
  assert.equal(baseline.pack.metrics.every((metric) => metric.reasonCode === null), true);

  assert.deepEqual(adapted.pack.metrics.map((metric) => metric.state), ["UNKNOWN", "UNKNOWN", "PARTIAL", "COMPLETE", "COMPLETE", "COMPLETE"]);
  assert.equal(adapted.pack.metrics[0]!.reasonCode, "AP03_EXTRACTION_NOT_EXECUTED");
  assert.equal(adapted.pack.metrics[1]!.reasonCode, "AP03_EXTRACTION_NOT_EXECUTED");
  assert.equal(adapted.pack.metrics[2]!.reasonCode, "ADAPTED_TOLERANCE_NOT_EXECUTED");
  assert.equal(adapted.pack.metrics[0]!.denominator.total, 0);
  assert.equal(adapted.pack.metrics[0]!.rows.length, 0);
  // the adapted tolerance variant is represented as a zeroed PARTIAL row, never dropped
  assert.ok(adapted.pack.metrics[2]!.rows.some((row) => row.dimension === "tolerance:RATE_BPS_V1:ADAPTED:200bps" && row.value === 0));
  // an unadapted variant is rejected at generate time (fail closed), not silently counted
  const unknownVariant: ErvAnalyticsPackInputV1 = {
    scenario: "ADAPTED",
    receipts: adaptedInput().receipts,
    adaptedToleranceRequests: [{ variantId: "NOT_A_RELEASED_VARIANT", rateBasisPoints: 200 }],
  };
  assert.throws(() => generateErvAnalyticsPackV1(unknownVariant), /ADAPTED_VARIANT_NOT_RELEASED/);
});

test("ERV-BI-AC04 canonical + TABLE projections bind identical metric/result/config/core digests", () => {
  const { pack } = generateErvAnalyticsPackV1(baselineInput());
  // both projections bind the same metric / result / config / core digests as the pack
  assert.deepEqual(pack.projections.canonical.binding, pack.binding);
  assert.deepEqual(pack.projections.table.binding, pack.binding);
  assert.deepEqual(Object.keys(pack.binding).sort(), ["ap03ReceiptSha256", "ap04CoreDigest", "configDigest", "metricCatalogDigest", "resultDigest"]);

  // packDigest independently recomputes over the pack minus its own digest
  assert.equal(shaHex(withoutKey(pack, "packDigest")), pack.packDigest);
  // canonical projection digest recomputes over the body minus projections + digest
  assert.equal(shaHex(withoutKey(withoutKey(pack, "packDigest"), "projections")), pack.projections.canonical.digest);
  // table projection digest recomputes over its rows
  assert.equal(shaHex(pack.projections.table.rows), pack.projections.table.digest);

  // the TABLE projection is a flat, BI-consumable row set with no ERP dependency
  assert.ok(pack.projections.table.rows.length > 0);
  for (const row of pack.projections.table.rows) {
    assert.equal(typeof row.analysis, "number");
    assert.equal(typeof row.metricId, "string");
    assert.equal(typeof row.dimension, "string");
    assert.equal(typeof row.value, "number");
    assert.equal(row.units, "count");
    assert.ok(["COMPLETE", "PARTIAL", "UNKNOWN", "DENIED"].includes(row.state));
  }

  // the standalone local report reads both scenarios back and binds the same catalog + config digests
  const report = generateErvAnalyticsLocalReportV1(baselineInput(), adaptedInput());
  assert.equal(report.baseline.packId, "erv-analytics-pack:baseline:v1");
  assert.equal(report.adapted.packId, "erv-analytics-pack:adapted:v1");
  assert.equal(report.binding.metricCatalogDigest, pack.binding.metricCatalogDigest);
  assert.equal(report.binding.configDigest, pack.binding.configDigest);
  // reportDigest is computed over {reportId, baseline, adapted, binding}; strip both reportDigest and serialized to recompute independently
  assert.equal(shaHex(withoutKey(withoutKey(report, "reportDigest"), "serialized")), report.reportDigest);
});

test("independent formula oracle recomputes every metric from the released receipts", () => {
  const { pack } = generateErvAnalyticsPackV1(baselineInput());
  const decisions = core().decisions;
  const byDimension = (metricIndex: number) => {
    const metric = pack.metrics[metricIndex]!;
    const map = new Map<string, number>();
    for (const row of metric.rows) map.set(row.dimension, row.value);
    return map;
  };

  // analysis 3 — match outcome + tolerance-use (independently aggregated)
  const expectedMatch: Record<string, number> = {};
  const expectedTolerance: Record<string, number> = {};
  for (const decision of decisions) {
    expectedMatch[`match:${decision.variant.matchingModeId}:${decision.outcome}`] = (expectedMatch[`match:${decision.variant.matchingModeId}:${decision.outcome}`] ?? 0) + 1;
    expectedTolerance[`tolerance:${decision.variant.tolerancePolicyId}`] = (expectedTolerance[`tolerance:${decision.variant.tolerancePolicyId}`] ?? 0) + 1;
  }
  const m3 = byDimension(2);
  for (const [dimension, value] of Object.entries(expectedMatch)) assert.equal(m3.get(dimension), value, dimension);
  for (const [dimension, value] of Object.entries(expectedTolerance)) assert.equal(m3.get(dimension), value, dimension);
  assert.equal(pack.metrics[2]!.denominator.total, decisions.length);
  assert.equal(m3.size, Object.keys(expectedMatch).length + Object.keys(expectedTolerance).length, "no invented or dropped tolerance/match rows");

  // analysis 4 — exception / reason-code distribution
  const expectedCodes: Record<string, number> = {};
  for (const decision of decisions) {
    const code = decision.outcome === "EXCEPTION" ? decision.exceptionCode : decision.outcome === "DENIED" ? decision.reasonCode : null;
    if (code !== null) expectedCodes[code] = (expectedCodes[code] ?? 0) + 1;
  }
  const m4 = byDimension(3);
  for (const [code, value] of Object.entries(expectedCodes)) assert.equal(m4.get(`code:${code}`), value, code);
  assert.equal(pack.metrics[3]!.denominator.total, Object.values(expectedCodes).reduce((sum, value) => sum + value, 0));

  // analysis 5 — approval-workload + amount bands (identity-free)
  const autoMatched = decisions.filter((decision: any) => decision.outcome === "MATCHED").length;
  const m5 = byDimension(4);
  assert.equal(m5.get("workload:auto:matched"), autoMatched);
  assert.equal(m5.get("workload:review:required"), decisions.length - autoMatched);
  const withAmount = decisions.filter((decision: any) => decision.outcome === "MATCHED" || decision.outcome === "CONFLICT").length;
  const bandSum = [...m5.entries()].filter(([dimension]) => dimension.startsWith("amount:")).reduce((sum, [, value]) => sum + value, 0);
  assert.equal(bandSum, withAmount, "amount bands cover exactly the MATCHED + CONFLICT decisions");

  // analysis 6 — evidence / verdict distribution
  const expectedVerdict: Record<string, number> = {};
  const expectedVerified: Record<string, number> = {};
  for (const decision of decisions) {
    expectedVerdict[decision.outcome] = (expectedVerdict[decision.outcome] ?? 0) + 1;
    expectedVerified[decision.outcome] = (expectedVerified[decision.outcome] ?? 0) + decision.evidenceCitations.filter((citation: any) => citation.verified).length;
  }
  const m6 = byDimension(5);
  for (const [outcome, value] of Object.entries(expectedVerdict)) assert.equal(m6.get(`verdict:${outcome}`), value, outcome);
  for (const [outcome, value] of Object.entries(expectedVerified)) assert.equal(m6.get(`verdict:${outcome}:evidence:verified`), value, outcome);

  // analysis 1 + 2 — extraction outcomes / completeness from the released AP-03 benchmark
  const bm = benchmark();
  const m1 = byDimension(0);
  for (const systemId of ["baseline", "boundedSyntheticModel"]) {
    assert.equal(m1.get(`system:${systemId}:VALID`), bm.systems[systemId].validation.validated, systemId);
    assert.equal(m1.get(`system:${systemId}:REJECTED`), bm.systems[systemId].validation.rejected, systemId);
  }
  assert.equal(pack.metrics[0]!.denominator.total, bm.denominators.disposition);
  const m2 = byDimension(1);
  for (const dimension of ["layout", "lineItems", "taxes", "totals"]) {
    assert.equal(m2.get(`dimension:${dimension}:completeness`), bm.denominators[dimension], dimension);
  }
  const expectedErrors: Record<string, number> = {};
  for (const error of bm.errors) expectedErrors[error.dimension] = (expectedErrors[error.dimension] ?? 0) + 1;
  for (const [dimension, value] of Object.entries(expectedErrors)) assert.equal(m2.get(`dimension:${dimension}:errors`), value, dimension);
});

test("ERV-BI-AC05 forged receipts, identity leakage, drift and substitution fail closed", () => {
  const input = baselineInput();
  const generated = generateErvAnalyticsPackV1(input).pack;

  // identity leakage in a candidate projection fails closed before any digest comparison
  const leaked = clone(generated) as any;
  leaked.metrics[0].rows.push({ dimension: "supplierId", value: 1 });
  assert.deepEqual(verifyErvAnalyticsPackV1(leaked, input).reasonCodes, ["IDENTITY_LEAKAGE_DENIED"]);

  // formula drift: a single recomputed row differs fails closed
  const drifted = clone(generated) as any;
  drifted.metrics[2].rows[0].value += 1;
  assert.deepEqual(verifyErvAnalyticsPackV1(drifted, input).reasonCodes, ["PACK_DIGEST_DENIED"]);

  // core substitution: binding a different decision digest fails closed
  const coreSubstituted = clone(generated) as any;
  coreSubstituted.binding.ap04CoreDigest = "f".repeat(64);
  assert.deepEqual(verifyErvAnalyticsPackV1(coreSubstituted, input).reasonCodes, ["PACK_DIGEST_DENIED"]);

  // config substitution: altering the amount-band configuration fails closed
  const configSubstituted = clone(generated) as any;
  configSubstituted.config.amountBandsMinor[3] = 999999;
  assert.deepEqual(verifyErvAnalyticsPackV1(configSubstituted, input).reasonCodes, ["PACK_DIGEST_DENIED"]);

  // forged AP-04 receipt bytes fail closed at generate time and at verify time
  const forged: ErvAnalyticsPackInputV1 = {
    ...baselineInput(),
    receipts: baselineInput().receipts.map((receipt) =>
      receipt.receiptId === "AP04_ERV_CORE_V1"
        ? { ...receipt, bytes: Uint8Array.from([...receipt.bytes, 0]) }
        : receipt),
  };
  assert.throws(() => generateErvAnalyticsPackV1(forged), /AP04_RECEIPT_DIGEST_DENIED/);
  assert.equal(verifyErvAnalyticsPackV1(generated, forged).valid, false);

  // double counting / unbounded grouping is not expressible: the catalog and metrics are closed at six
  assert.equal(generated.metrics.length, 6);
  assert.equal(packDigestMatches(generated), true);
  for (const row of generated.projections.table.rows) {
    assert.ok(ERV_ANALYTICS_METRIC_CATALOG_V1.some((metric) => metric.metricId === row.metricId), `table row references a catalog metric: ${row.metricId}`);
  }
});
function packDigestMatches(pack: any): boolean {
  return shaHex(withoutKey(pack, "packDigest")) === pack.packDigest;
}

test("ERV analytics artifact regenerates byte-for-byte, verifies, and conforms to the schema", () => {
  const input = baselineInput();
  const generated = generateErvAnalyticsPackV1(input);
  assert.equal(readFileSync(ARTIFACT_PATH, "utf8"), generated.serialized, "checked-in artifact matches regeneration");
  assert.deepEqual(verifyErvAnalyticsPackV1(generated.pack, input), { valid: true, reasonCodes: [] });
  const schema = JSON.parse(readFileSync(SCHEMA_PATH, "utf8"));
  const validate = new Ajv2020({ allErrors: true, strict: true }).compile(schema);
  assert.equal(validate(generated.pack), true, JSON.stringify(validate.errors));
  // the adapted pack must also conform to the same schema (states are a closed enum)
  const adapted = generateErvAnalyticsPackV1(adaptedInput());
  assert.equal(validate(adapted.pack), true, JSON.stringify(validate.errors));
});

test("ERV analytics focused suite is registered exactly once in canonical pretest", () => {
  const packageJson = JSON.parse(readFileSync("package.json", "utf8")) as { scripts: Record<string, string> };
  assert.equal(packageJson.scripts["incoming-invoice-erv-analytics:test"],
    "npm run build --silent && node --test dist/tests/incoming-invoice-erv-analytics.test.js");
  assert.equal(((packageJson.scripts.pretest ?? "").match(/npm run incoming-invoice-erv-analytics:test/g) ?? []).length, 1);
});