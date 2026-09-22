import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { canonicalJson } from "../../dist/packages/contracts/src/canonical-json.js";
import {
  PAN433_ALTERNATE_MAPPING_V1,
  PAN433_DEFAULT_MAPPING_V1,
  PAN433_MAPPING_SCHEMA_V1,
  consumePan433MappedInvoiceV1,
  consumePan433MappedInvoiceThroughProcurement434V1,
  isApprovedPan433MappingProfileV1,
  mapPan433SourceV1,
  verifyPan433MappingProfileV1,
} from "../../dist/packages/contracts/src/pan433-domain-mapping-v1.js";
import {
  buildProc434DecisiveMatchInputV1,
  buildProc434PoV1,
  loadProc434Fixtures,
  recordProc434GoodsReceiptV1,
  runProc434ReaderV1,
} from "../../src/procurement-434/rechnungsabgleich-path.mjs";

const load = (file) => JSON.parse(readFileSync(path.join(process.cwd(), file), "utf8"));
const DEFAULT = load("tests/fixtures/pan433/default-invoice-row-v1.json");
const ALTERNATE = load("tests/fixtures/pan433/alternate-invoice-document-v2.json");
const CLI = path.join(process.cwd(), "src/pan433/domain-mapping-cli.mjs");
const runCli = (mapping, sourcePath) => execFileSync(process.execPath, [CLI, "--mapping", mapping, "--source", sourcePath, "--json"], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
const resealSource = (source) => { const { sourceDigest: _drop, ...content } = source; return { ...source, sourceDigest: createHash("sha256").update(canonicalJson(content), "utf8").digest("hex") }; };
const resealProfile = (profile) => { const { profileDigest: _drop, ...content } = profile; return { ...profile, profileDigest: createHash("sha256").update(canonicalJson(content), "utf8").digest("hex") }; };
const resolvePath = (value, declaredPath) => {
  let current = value;
  for (const match of declaredPath.matchAll(/([^.[\]]+)|\[(\d+)\]/g)) current = current[match[1] ?? Number(match[2])];
  return current;
};
const procurement434Context = () => {
  const fixtures = loadProc434Fixtures(process.cwd(), "");
  const po = buildProc434PoV1();
  const receipt = recordProc434GoodsReceiptV1(po.entwurf, 2, "wareneingang:wg-eink-001");
  const read = runProc434ReaderV1(fixtures.readerContract, fixtures.readerExport, "2026-09-10T08:30:00Z");
  const input = buildProc434DecisiveMatchInputV1({ fixtures, entwurf: po.entwurf, ledger: receipt.ledger, readback: read.readback, reader: read.reader });
  assert.ok(input, "procurement-434 must expose a closed business input");
  return { fixtures, input };
};

for (const [name, source, profile] of [["default", DEFAULT, PAN433_DEFAULT_MAPPING_V1], ["alternate", ALTERNATE, PAN433_ALTERNATE_MAPPING_V1]]) {
  test(`${name} source has a distinct storage layout and passes the real adapter plus released M0 consumer`, () => {
    const result = consumePan433MappedInvoiceV1(source, profile);
    assert.equal(result.outcome, "ACCEPTED", JSON.stringify(result));
    assert.equal(result.mapping.profileId, profile.profileId);
    assert.equal(result.mapping.sourceDigest, source.sourceDigest);
    assert.deepEqual(result.mapping.invoice, {
      invoiceId: "invoice:synthetic-101", orderId: "order:synthetic-101", customerId: "customer:zoo-001",
      invoiceStatus: "OPEN", issueDate: "2026-09-02", dueDate: "2026-09-16", totalMinor: 2400, currency: "EUR",
    });
    assert.equal(result.core.reference.referenceId, "invoice:synthetic-101");
    assert.equal(result.core.reference.matchAmountMinor, 2400);
    assert.deepEqual(result.core.reference.declaredLossReasonCodes, ["COUNTERPARTY_IDENTITY_UNAVAILABLE", "QUANTITY_UNAVAILABLE"]);
  });

  test(`${name} documented CLI entry point produces the accepted downstream result`, () => {
    const output = execFileSync(process.execPath, [CLI, "--mapping", name, "--source", path.join(process.cwd(), name === "default" ? "tests/fixtures/pan433/default-invoice-row-v1.json" : "tests/fixtures/pan433/alternate-invoice-document-v2.json"), "--json"], { encoding: "utf8" });
    const result = JSON.parse(output);
    assert.equal(result.outcome, "ACCEPTED");
    assert.equal(result.mapping.layout, name === "default" ? "DEFAULT_INVOICE_ROW" : "ALTERNATE_INVOICE_DOCUMENT");
    assert.equal(result.core.reference.matchAmountMinor, 2400);
  });
}

for (const [name, source, profile] of [["default", DEFAULT, PAN433_DEFAULT_MAPPING_V1], ["alternate", ALTERNATE, PAN433_ALTERNATE_MAPPING_V1]]) {
  test(`${name} source reaches the existing procurement-434 core and downstream consumer`, () => {
    const { fixtures, input } = procurement434Context();
    const result = consumePan433MappedInvoiceThroughProcurement434V1(source, profile, input, fixtures.pack);
    assert.equal(result.outcome, "ACCEPTED", JSON.stringify(result));
    assert.equal(result.business.outcome, "RECHNUNGSABGLEICH_MATCH");
    assert.equal(result.business.decision.outcome, "MATCHED");
    assert.equal(result.business.mode, "THREE_WAY_INVOICE_PO_RECEIPT_V1");
    assert.deepEqual(result.business.quantities, { bestellteMenge: 2, mengenReceived: 2, invoicedMenge: 2, einheit: "STK", waehrung: "EUR" });
  });
}

test("the existing downstream consumer denial is preserved as a critical denial, not downgraded to mapping success", () => {
  const { fixtures, input } = procurement434Context();
  const broken = structuredClone(input);
  broken.invoiceLine.menge = 3;
  const result = consumePan433MappedInvoiceThroughProcurement434V1(DEFAULT, PAN433_DEFAULT_MAPPING_V1, broken, fixtures.pack);
  assert.equal(result.outcome, "DENIED");
  assert.equal(result.code, "DOWNSTREAM_CONSUMER_DENIED");
  assert.equal(result.business?.outcome, "DENIED");
  assert.equal(result.business?.code, "MATCH_INVOICE_LINE_SEAL_BROKEN");
});

test("every declared source path resolves against its actual source layout", () => {
  for (const [source, profile] of [[DEFAULT, PAN433_DEFAULT_MAPPING_V1], [ALTERNATE, PAN433_ALTERNATE_MAPPING_V1]]) {
    for (const fieldMap of profile.fieldMaps) assert.notEqual(resolvePath(source, fieldMap.sourcePath), undefined, fieldMap.sourcePath);
  }
});

test("impossible calendar dates and malformed full metadata timestamps fail closed in both layouts", () => {
  const cases = [
    [DEFAULT, PAN433_DEFAULT_MAPPING_V1, (source) => { source.batches[0].records[0].invoice.issueDate = "2026-02-30"; }, "FIELD_SEMANTICS_INVALID"],
    [ALTERNATE, PAN433_ALTERNATE_MAPPING_V1, (source) => { source.documents[0].lifecycle.payBy = "2026-02-30"; }, "FIELD_SEMANTICS_INVALID"],
    [DEFAULT, PAN433_DEFAULT_MAPPING_V1, (source) => { source.batches[0].records[0].updatedAt = "2026-09-10T07:50:00Zgarbage"; }, "SOURCE_SHAPE_INVALID"],
    [ALTERNATE, PAN433_ALTERNATE_MAPPING_V1, (source) => { source.documents[0].changedAt = "2026-09-10"; }, "SOURCE_SHAPE_INVALID"],
  ];
  for (const [source, profile, mutate, code] of cases) {
    const altered = structuredClone(source);
    mutate(altered);
    altered.sourceDigest = resealSource(altered).sourceDigest;
    assert.equal(mapPan433SourceV1(altered, profile).code, code);
  }
});

test("approved mapping authority is runtime immutable and cannot be changed through exported references", () => {
  assert.equal(Object.isFrozen(PAN433_DEFAULT_MAPPING_V1), true);
  assert.equal(Object.isFrozen(PAN433_DEFAULT_MAPPING_V1.fieldMaps), true);
  assert.equal(Object.isFrozen(PAN433_DEFAULT_MAPPING_V1.fieldMaps[0]), true);
  assert.throws(() => { PAN433_DEFAULT_MAPPING_V1.fieldMaps[0].sourcePath = "nonexistent"; }, TypeError);
  assert.equal(isApprovedPan433MappingProfileV1(PAN433_DEFAULT_MAPPING_V1), true);
  assert.equal(mapPan433SourceV1(DEFAULT, PAN433_DEFAULT_MAPPING_V1).outcome, "MAPPED");
});

test("the checked-in convention names ownership, I/O, versions, effects, reuse, and nonclaims", () => {
  const convention = readFileSync(path.join(process.cwd(), "docs/development/pan433-domain-mapping-v1.md"), "utf8");
  for (const term of ["Purpose", "Meaning", "Prerequisites", "State ownership", "I/O guarantees", "Versions", "Effects", "procurement-434", "does not claim"]) {
    assert.match(convention, new RegExp(term, "i"));
  }
});

test("the two approved profiles are versioned, explicit, and converge only at the same released target", () => {
  assert.equal(PAN433_DEFAULT_MAPPING_V1.schemaVersion, PAN433_MAPPING_SCHEMA_V1);
  assert.equal(PAN433_ALTERNATE_MAPPING_V1.schemaVersion, PAN433_MAPPING_SCHEMA_V1);
  assert.notEqual(PAN433_DEFAULT_MAPPING_V1.source.schema, PAN433_ALTERNATE_MAPPING_V1.source.schema);
  assert.notDeepEqual(PAN433_DEFAULT_MAPPING_V1.fieldMaps.map((m) => m.sourcePath), PAN433_ALTERNATE_MAPPING_V1.fieldMaps.map((m) => m.sourcePath));
  assert.deepEqual(PAN433_DEFAULT_MAPPING_V1.target, PAN433_ALTERNATE_MAPPING_V1.target);
  assert.equal(verifyPan433MappingProfileV1(PAN433_DEFAULT_MAPPING_V1), true);
  assert.equal(isApprovedPan433MappingProfileV1(PAN433_DEFAULT_MAPPING_V1), true);
  assert.equal(isApprovedPan433MappingProfileV1(PAN433_ALTERNATE_MAPPING_V1), true);
  assert.equal(PAN433_DEFAULT_MAPPING_V1.effects.writes, false);
  assert.equal(PAN433_DEFAULT_MAPPING_V1.effects.authority, "NONE");
});

test("the real CLI entry point fails closed for a tampered source and unsupported source version", () => {
  const dir = mkdtempSync(path.join(tmpdir(), "pan433-cli-negative-"));
  try {
    const tampered = structuredClone(DEFAULT);
    tampered.batches[0].records[0].invoice.totalMinor = 2401;
    const tamperedPath = path.join(dir, "tampered.json");
    writeFileSync(tamperedPath, JSON.stringify(tampered));
    assert.throws(() => runCli("default", tamperedPath), (error) => {
      assert.equal(error.status, 1);
      const result = JSON.parse(error.stdout);
      assert.equal(result.outcome, "DENIED");
      assert.equal(result.code, "SOURCE_DIGEST_INVALID");
      return true;
    });
    const unsupported = structuredClone(ALTERNATE);
    unsupported.schemaVersion = "pan433.storage/invoice-document/v9";
    const unsupportedPath = path.join(dir, "unsupported.json");
    writeFileSync(unsupportedPath, JSON.stringify(unsupported));
    assert.throws(() => runCli("alternate", unsupportedPath), (error) => {
      assert.equal(error.status, 1);
      const result = JSON.parse(error.stdout);
      assert.equal(result.outcome, "DENIED");
      assert.equal(result.code, "SOURCE_SCHEMA_UNSUPPORTED");
      return true;
    });
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test("a caller-rehashed but semantically changed profile is denied by the code-owned approval boundary", () => {
  const altered = resealProfile({ ...PAN433_ALTERNATE_MAPPING_V1, purpose: "caller replacement" });
  assert.equal(verifyPan433MappingProfileV1(altered), true);
  assert.equal(isApprovedPan433MappingProfileV1(altered), false);
  const result = mapPan433SourceV1(ALTERNATE, altered);
  assert.equal(result.outcome, "DENIED");
  assert.equal(result.code, "MAPPING_PROFILE_NOT_APPROVED");
});

test("a profile digest mismatch is denied before source mapping", () => {
  const altered = { ...PAN433_DEFAULT_MAPPING_V1, profileDigest: "0".repeat(64) };
  const result = mapPan433SourceV1(DEFAULT, altered);
  assert.equal(result.outcome, "DENIED");
  assert.equal(result.code, "MAPPING_PROFILE_DIGEST_MISMATCH");
});

test("tampered source bytes are denied even when the source layout remains recognizable", () => {
  const altered = structuredClone(DEFAULT);
  altered.batches[0].records[0].invoice.totalMinor = 2401;
  const result = mapPan433SourceV1(altered, PAN433_DEFAULT_MAPPING_V1);
  assert.equal(result.outcome, "DENIED");
  assert.equal(result.code, "SOURCE_DIGEST_INVALID");
});

test("unsupported source version, unknown field, and ambiguous record cardinality fail closed", () => {
  const unsupported = structuredClone(DEFAULT);
  unsupported.schemaVersion = "pan433.storage/invoice-row/v9";
  assert.equal(mapPan433SourceV1(unsupported, PAN433_DEFAULT_MAPPING_V1).code, "SOURCE_SCHEMA_UNSUPPORTED");
  const unknown = structuredClone(DEFAULT);
  unknown.batches[0].records[0].invoice.extra = "not declared";
  unknown.sourceDigest = resealSource(unknown).sourceDigest;
  assert.equal(mapPan433SourceV1(unknown, PAN433_DEFAULT_MAPPING_V1).code, "SOURCE_SHAPE_INVALID");
  const ambiguous = structuredClone(DEFAULT);
  ambiguous.batches[0].records.push(structuredClone(ambiguous.batches[0].records[0]));
  ambiguous.sourceDigest = resealSource(ambiguous).sourceDigest;
  assert.equal(mapPan433SourceV1(ambiguous, PAN433_DEFAULT_MAPPING_V1).code, "AMBIGUOUS_RECORD");
});

test("currency, date, quantity, and missing semantic identity are not guessed or converted", () => {
  const currency = structuredClone(ALTERNATE);
  currency.documents[0].money.currencyCode = "USD";
  currency.sourceDigest = resealSource(currency).sourceDigest;
  assert.equal(mapPan433SourceV1(currency, PAN433_ALTERNATE_MAPPING_V1).code, "FIELD_SEMANTICS_INVALID");
  const quantity = structuredClone(DEFAULT);
  quantity.batches[0].records[0].invoice.quantity = 1;
  quantity.sourceDigest = resealSource(quantity).sourceDigest;
  assert.equal(mapPan433SourceV1(quantity, PAN433_DEFAULT_MAPPING_V1).code, "SOURCE_SHAPE_INVALID");
  const unit = structuredClone(ALTERNATE);
  unit.documents[0].money.unit = "piece";
  unit.sourceDigest = resealSource(unit).sourceDigest;
  assert.equal(mapPan433SourceV1(unit, PAN433_ALTERNATE_MAPPING_V1).code, "SOURCE_SHAPE_INVALID");
  const date = structuredClone(DEFAULT);
  date.batches[0].records[0].invoice.dueDate = "2026-09-01";
  date.sourceDigest = resealSource(date).sourceDigest;
  assert.equal(mapPan433SourceV1(date, PAN433_DEFAULT_MAPPING_V1).code, "FIELD_SEMANTICS_INVALID");
  const identity = structuredClone(ALTERNATE);
  delete identity.documents[0].commercial.customerRef;
  identity.sourceDigest = resealSource(identity).sourceDigest;
  assert.equal(mapPan433SourceV1(identity, PAN433_ALTERNATE_MAPPING_V1).code, "SOURCE_SHAPE_INVALID");
});
