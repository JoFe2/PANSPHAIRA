import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  PILOT_CHECKSUM_MISMATCH,
  PILOT_MOUNTED_DUMP_REQUIRED,
  PILOT_RECEIPT_SAMPLE_INCOMPLETE,
  preflightWikimediaPilotV1,
  runSyntheticWikimediaPilotEvidenceV1,
  validateWikimediaPilotEvidenceReportV1,
  validateWikimediaPilotManifestV1,
  type WikimediaPilotManifestV1,
} from "../packages/local-knowledge/src/wikimedia-pilot-evidence.js";

const fixture = JSON.parse(readFileSync("tests/fixtures/wikimedia-pilot/expected-measurement-schema.json", "utf8")) as WikimediaPilotManifestV1;


function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function assertReceiptFields(report: ReturnType<typeof runSyntheticWikimediaPilotEvidenceV1>): void {
  const receipt = report.receiptSample[0];
  assert.ok(receipt);
  assert.ok(receipt.results.length > 0);
  for (const result of receipt.results) {
    assert.ok(result.exactPassage.length > 0);
    assert.ok(result.project.length > 0);
    assert.ok(result.pageId > 0);
    assert.ok(result.revisionId > 0);
    assert.match(result.canonicalUrl, /^https:\/\//);
    assert.match(result.snapshotDate, /^\d{4}-\d{2}-\d{2}$/);
    assert.ok(result.license.licence.length > 0);
    assert.match(result.contentDigest, /^[a-f0-9]{64}$/);
    assert.match(result.editionDigest, /^[a-f0-9]{64}$/);
  }
}

test("offline dry-run validates the complete manifest and makes no measurement claim", () => {
  const preflight = preflightWikimediaPilotV1(fixture);
  assert.equal(preflight.operation, "PILOT_PREFLIGHT");
  assert.equal(preflight.measurementStatus, "NOT_MEASURED");
  assert.deepEqual(preflight.claims, []);
  assert.equal(Object.hasOwn(preflight, "storageBytes"), false);
  assert.equal(Object.hasOwn(preflight, "importElapsedMs"), false);
  assert.equal(Object.hasOwn(preflight, "queryLatencyMs"), false);
  assert.equal(validateWikimediaPilotManifestV1(fixture), true);
});

test("synthetic evidence records deterministic re-import equality, receipts, and raw machine measurements", () => {
  const report = runSyntheticWikimediaPilotEvidenceV1(fixture, (() => {
    let tick = 0;
    return () => (tick += 1);
  })());
  assert.equal(report.mountedSnapshot, false);
  assert.deepEqual(report.claims, []);
  assert.equal(report.immutableEditions.equal, true);
  assert.equal(report.immutableEditions.firstEditionDigest, report.immutableEditions.reimportEditionDigest);
  assert.equal(report.immutableEditions.firstEditionDigest, fixture.synthetic.expectedEditionDigest);
  assert.equal(report.rawEvidence.length, 3);
  assert.deepEqual(report.rawEvidence.map((sample) => sample.operation), ["IMPORT", "REIMPORT", "QUERY"]);
  for (const sample of report.rawEvidence) {
    assert.equal(sample.environmentId, "synthetic-offline");
    assert.ok(Number.isFinite(sample.elapsedMs));
    assert.ok(Number.isSafeInteger(sample.bytes));
    assert.ok(sample.bytes > 0);
    if (sample.operation === "QUERY") assert.ok(Number.isFinite(sample.queryLatencyMs));
  }
  assertReceiptFields(report);
  assert.equal(validateWikimediaPilotEvidenceReportV1(report), true);
});

test("manifest and mounted execution fail closed for the required negative cases", () => {
  for (const field of ["url", "checksum", "byteSize", "snapshotDate", "license", "attribution"] as const) {
    const invalid = clone(fixture);
    delete (invalid.official as unknown as Record<string, unknown>)[field];
    assert.equal(validateWikimediaPilotManifestV1(invalid), false, field);
    assert.throws(() => preflightWikimediaPilotV1(invalid), /PILOT_MANIFEST_INVALID/);
  }

  const nonImmutable = clone(fixture);
  (nonImmutable.official as unknown as { url: string }).url = "https://dumps.wikimedia.org/wikipedia/en/latest/enwiki-latest-pages-articles.xml";
  assert.equal(validateWikimediaPilotManifestV1(nonImmutable), false);

  const unsupported = clone(fixture);
  (unsupported.official as unknown as { project: string }).project = "wiktionary:en";
  assert.equal(validateWikimediaPilotManifestV1(unsupported), false);

  const checksum = clone(fixture);
  (checksum.synthetic as unknown as { expectedContentDigest: string }).expectedContentDigest = "0".repeat(64);
  assert.throws(() => runSyntheticWikimediaPilotEvidenceV1(checksum), new RegExp(PILOT_CHECKSUM_MISMATCH));

  const incomplete = clone(fixture);
  (incomplete.synthetic as unknown as { receiptSampleSize: number }).receiptSampleSize = 32;
  assert.throws(() => runSyntheticWikimediaPilotEvidenceV1(incomplete), new RegExp(PILOT_RECEIPT_SAMPLE_INCOMPLETE));

  const missingMount = clone(fixture);
  (missingMount.synthetic as unknown as { root: string }).root = "tests/fixtures/wikimedia-pilot/not-mounted";
  assert.throws(() => runSyntheticWikimediaPilotEvidenceV1(missingMount), new RegExp(PILOT_MOUNTED_DUMP_REQUIRED));
});

test("report validator rejects mixed environments and claimed metrics without raw evidence", () => {
  const report = runSyntheticWikimediaPilotEvidenceV1(fixture, (() => {
    let tick = 0;
    return () => (tick += 1);
  })());
  const mixed = clone(report);
  const mixedEvidence = mixed.rawEvidence[1];
  assert.ok(mixedEvidence);
  (mixedEvidence as unknown as { environmentId: string }).environmentId = "different-machine";
  assert.equal(validateWikimediaPilotEvidenceReportV1(mixed), false);

  const claimedWithoutEvidence = clone(report) as unknown as Record<string, unknown>;
  claimedWithoutEvidence.mountedSnapshot = true;
  claimedWithoutEvidence.claims = { storageBytes: 1, importElapsedMs: 1, queryLatencyMs: 1 };
  claimedWithoutEvidence.rawEvidence = [];
  assert.equal(validateWikimediaPilotEvidenceReportV1(claimedWithoutEvidence), false);
});
