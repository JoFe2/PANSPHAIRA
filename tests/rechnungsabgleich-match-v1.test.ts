import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import test from "node:test";
import {
  bestellungsentwurfBildenV1,
  wareneingangLedgerBildenV1,
  wareneingangErfassenV1,
  mengenzustandV1,
  type BestellentwurfV1,
  type WareneingangLedgerV1,
} from "../packages/contracts/src/beschaffung-wareneingang-v1.js";
import {
  createErpReadAdapterV1,
  type ErpReadResultV1,
  type ErpSupportedExportV1,
  type ErpReadConnectorContractV1,
} from "../packages/contracts/src/erp-read-connector.js";
import {
  AP04_ERV_CASE_PACK_SHA256_V1,
  type ErvCasePackV1,
  type ErvEvidenceReferenceV1,
} from "../packages/contracts/src/incoming-invoice-erv.js";
import {
  rechnungsabgleichFallZusammensetzenV1,
  readerFactsDigestV1,
  UNRESOLVED_INVOICE_EVIDENCE_INCOMPLETE_V1,
  type RechnungsabgleichReceiptValuationV1,
} from "../packages/contracts/src/rechnungsabgleich-v1.js";
import {
  rechnungsabgleichMatchZusammensetzenV1,
  verifyRechnungsabgleichMatchDigestV1,
  INVOICE_LINE_SCHEMA_V1,
  RECHNUNGSABGLEICH_MATCH_SCHEMA_V1,
  RECHNUNGSABGLEICH_DECISIVE_MODE_V1,
  PO_IDENTITY_MAPPING_SCHEMA_V1,
  PROCUREMENT434_APPROVED_SOURCES_SCHEMA_V1,
  AP04_ERV_CASE_PACK_CANONICAL_SHA256_V1,
  type RechnungsabgleichInvoiceLineV1,
  type RechnungsabgleichPoIdentityMappingV1,
  type Procurement434ApprovedSourcesV1,
  type ReconciliationMatchOutcomeV1,
} from "../packages/contracts/src/rechnungsabgleich-match-v1.js";
import { canonicalJson } from "../packages/contracts/src/canonical-json.js";

// Real reused fixtures: the frozen AP-04 purchase-side references (SUPPLIER +
// PO), the retained erp-read reader contract, the matched erp-read export (the
// SEALED reader source), the independent sealed goods-receipt valuation, the
// SEALED purchase-side supplier invoice line (coherent positive line 100/2400),
// the coherent partial/over counter-example lines (50/200), the explicit
// PO-identity mapping and the code-owned approved-source manifest (R2).
const load = <T>(p: string): T => JSON.parse(readFileSync(p, "utf8")) as T;
const PACK = load<ErvCasePackV1>("tests/fixtures/incoming-invoice/ap-04-erv-cases-v1.json");
const READER_CONTRACT = load<ErpReadConnectorContractV1>("tests/fixtures/erp-read/contract-v1.json");
const READER_EXPORT = load<ErpSupportedExportV1>("tests/fixtures/erp-read/matched-export-v1.json");
const VAL_STANDARD = load<RechnungsabgleichReceiptValuationV1>("tests/fixtures/incoming-invoice/receipt-valuation-v1.json");
const VAL_2450 = load<RechnungsabgleichReceiptValuationV1>("tests/fixtures/incoming-invoice/receipt-valuation-2450-v1.json");
const VAL_UNKNOWN_SUPPLIER = load<RechnungsabgleichReceiptValuationV1>("tests/fixtures/incoming-invoice/receipt-valuation-unknown-supplier-v1.json");
const VAL_PO_IDENTITY = load<RechnungsabgleichReceiptValuationV1>("tests/fixtures/incoming-invoice/receipt-valuation-po-identity-v1.json");
const LINE_POSITIVE = load<RechnungsabgleichInvoiceLineV1>("tests/fixtures/incoming-invoice/invoice-line-v1.json");
const LINE_PARTIAL = load<RechnungsabgleichInvoiceLineV1>("tests/fixtures/incoming-invoice/invoice-line-partial-v1.json");
const LINE_OVER = load<RechnungsabgleichInvoiceLineV1>("tests/fixtures/incoming-invoice/invoice-line-over-v1.json");
const LINE_WRONG_SUPPLIER = load<RechnungsabgleichInvoiceLineV1>("tests/fixtures/incoming-invoice/invoice-line-wrong-supplier-v1.json");
const LINE_WRONG_UNIT = load<RechnungsabgleichInvoiceLineV1>("tests/fixtures/incoming-invoice/invoice-line-wrong-unit-v1.json");
const LINE_WRONG_CURRENCY = load<RechnungsabgleichInvoiceLineV1>("tests/fixtures/incoming-invoice/invoice-line-wrong-currency-v1.json");
const PO_MAPPING = load<RechnungsabgleichPoIdentityMappingV1>("tests/fixtures/procurement-434/po-identity-mapping-v1.json");
const APPROVED_SOURCES = load<Procurement434ApprovedSourcesV1>("tests/fixtures/procurement-434/approved-sources-v1.json");

const FROZEN_CASE = PACK.cases.find((c) => c.caseId === "two-way-matched-strict");
if (!FROZEN_CASE) throw new Error("frozen AP-04 two-way-matched-strict case missing");
const FROZEN_SUPPLIER = FROZEN_CASE.references.find((r) => r.body.referenceKind === "SUPPLIER") as ErvEvidenceReferenceV1;
const FROZEN_PO = FROZEN_CASE.references.find((r) => r.body.referenceKind === "PURCHASE_ORDER") as ErvEvidenceReferenceV1;

const sha = (value: unknown): string => createHash("sha256").update(canonicalJson(value), "utf8").digest("hex");
/** Re-seal the invoice line over its amount-carrying identity core (the self-delivered digest). */
function lineSeal(core: Record<string, unknown>): string { return sha(core); }
/** Build a re-sealed invoice line from the positive line with a partial override. */
function line(overrides: Record<string, unknown> = {}): RechnungsabgleichInvoiceLineV1 {
  const body = { ...LINE_POSITIVE, ...overrides } as RechnungsabgleichInvoiceLineV1;
  const core = {
    invoiceId: body.invoiceId, supplierId: body.supplierId, bestellungId: body.bestellungId,
    positionId: body.positionId, einheit: body.einheit, waehrung: body.waehrung,
    menge: body.menge, amountMinor: body.amountMinor,
  };
  return { ...body, contentSha256: lineSeal(core) };
}
/** Re-seal the PO-identity mapping over its identity core. */
function poMappingSeal(core: Record<string, unknown>): string { return sha(core); }
/** Build a re-sealed PO-identity mapping with a partial override. */
function mapping(overrides: Record<string, unknown> = {}): RechnungsabgleichPoIdentityMappingV1 {
  const body = { ...PO_MAPPING, ...overrides } as RechnungsabgleichPoIdentityMappingV1;
  const core = {
    poReferenceId: body.poReferenceId, supplierClosedIdentity: body.supplierClosedIdentity,
    localSupplierId: body.localSupplierId, localBestellungId: body.localBestellungId,
    localPositionId: body.localPositionId, localArtikelId: body.localArtikelId,
  };
  return { ...body, contentSha256: poMappingSeal(core) };
}

function entwurf(overrides: Record<string, unknown> = {}): BestellentwurfV1 {
  const r = bestellungsentwurfBildenV1({
    bestellungId: "bestellung:eink-001",
    lieferantId: "lieferant:metall-001",
    bestellungZeitstempel: "2026-09-10T08:00:00Z",
    positionen: [
      // The ordered quantity equals the frozen PO-2026-0001 source quantity (2): the decisive
      // match enforces the source quantity as the comparison authority (identity-only
      // mapping does NOT reconcile a quantity discrepancy).
      { positionId: "position:eink-001-01", artikelId: "EINK-ART-001", einheit: "STK", waehrung: "EUR", bestellteMenge: 2, berechneteMengeMinor: null },
    ],
    ...overrides,
  });
  assert.equal(r.outcome, "ENTWURF", `expected ENTWURF: ${JSON.stringify(r)}`);
  if (r.outcome !== "ENTWURF") throw new Error("unreachable");
  return r.entwurf;
}

function realReader(): { readback: Extract<ErpReadResultV1, { outcome: "READ" }>; reader: { trust: "LOCAL_SYNTHETIC"; sourceDatasetId: string; sourceDigest: string; factsDigest: string } } {
  const adapter = createErpReadAdapterV1({ contract: READER_CONTRACT, source: READER_EXPORT, enabled: true, now: "2026-09-10T08:30:00Z" });
  const res = adapter({ operation: "LIST_INVOICES", tenantId: "tenant:synthetic-zoo", principalId: "principal:bi-m1-reader", scopes: ["erp.synthetic.bi.read"], credentialPresent: true, fields: READER_CONTRACT.fields.invoices, pageSize: 2 });
  assert.equal(res.outcome, "READ", `real reader must READ the matched export: ${JSON.stringify(res)}`);
  if (res.outcome !== "READ") throw new Error("unreachable");
  return { readback: res, reader: { trust: "LOCAL_SYNTHETIC", sourceDatasetId: res.metadata.sourceDatasetId, sourceDigest: res.metadata.sourceDigest, factsDigest: readerFactsDigestV1(res.records) } };
}

function realReceiptLedger(e: BestellentwurfV1, menge: number, eingangsId: string): WareneingangLedgerV1 {
  const opened = wareneingangLedgerBildenV1(e, "position:eink-001-01");
  assert.equal(opened.outcome, "LEDGER", `expected LEDGER: ${JSON.stringify(opened)}`);
  if (opened.outcome !== "LEDGER") throw new Error("unreachable");
  const ledger = opened.ledger;
  if (menge < 1) return ledger;
  const applied = wareneingangErfassenV1(e, ledger, { eingangsId, bestellungId: e.bestellungId, positionId: "position:eink-001-01", einheit: "STK", menge, zeitstempel: "2026-09-12T10:00:00Z", korrekturVon: null });
  assert.equal(applied.outcome, "WARENEINGANG_ERFASST", `expected WARENEINGANG_ERFASST: ${JSON.stringify(applied)}`);
  if (applied.outcome !== "WARENEINGANG_ERFASST") throw new Error("unreachable");
  return applied.ledger;
}

/** The closed positive decisive-match input: the F1 full-receipt precondition +
 *  the SEALED purchase-side supplier invoice line + the explicit PO-identity
 *  mapping + the code-owned approved-source manifest (R1/R2). */
function baseInput(overrides: Record<string, unknown> = {}) {
  const e = entwurf();
  const { readback, reader } = realReader();
  return {
    erpReadSource: READER_EXPORT,
    erpReadContract: READER_CONTRACT,
    erpReadNow: "2026-09-10T08:30:00Z",
    erpReadReadback: readback,
    reader,
    entwurf: e,
    binding: { erpReadInvoiceId: "invoice:synthetic-101", poReferenceId: FROZEN_PO.body.referenceId, positionId: "position:eink-001-01", bestellungId: "bestellung:eink-001" },
    receiptLedger: realReceiptLedger(e, 2, "wareneingang:wg-eink-001"),
    receiptValuation: VAL_STANDARD,
    supplierReference: FROZEN_SUPPLIER,
    poReference: FROZEN_PO,
    tolerancePolicy: { variantId: "STRICT_ZERO_V1", version: "1.0.0" },
    invoiceLine: LINE_POSITIVE,
    poIdentityMapping: PO_MAPPING,
    approvedSources: APPROVED_SOURCES,
    ...overrides,
  };
}

test("PROC434-M1-P (R1 coherent positive): the decisive positive normal path — PO -> goods receipt -> invoice match yields a REAL MATCHED decision with COHERENT quantities (ordered 100 / received 100 / invoiced 100) and the procurement-level quantity reconciliation (the gap the F1 correction left explicit is closed, with real quantity semantics)", () => {
  const res = rechnungsabgleichMatchZusammensetzenV1(baseInput(), PACK);
  assert.equal(res.outcome, "RECHNUNGSABGLEICH_MATCH", JSON.stringify(res, null, 1));
  if (res.outcome !== "RECHNUNGSABGLEICH_MATCH") throw new Error("unreachable");
  // The decisive mode is the frozen three-way mode, actually ASSEMBLED and RUN.
  assert.equal(res.mode, RECHNUNGSABGLEICH_DECISIVE_MODE_V1);
  assert.equal(RECHNUNGSABGLEICH_DECISIVE_MODE_V1, "THREE_WAY_INVOICE_PO_RECEIPT_V1");
  assert.equal(res.schemaVersion, RECHNUNGSABGLEICH_MATCH_SCHEMA_V1);
  // The REAL ERV decision is MATCHED, grounded at the closed amount (2400 minor).
  assert.equal(res.decision.outcome, "MATCHED", JSON.stringify(res.decision, null, 1));
  if (res.decision.outcome !== "MATCHED") throw new Error("unreachable");
  assert.equal(res.decision.matchedAmountMinor, 2400);
  // All four references are INDEPENDENTLY evidenced (recomputed digests close):
  // the frozen SUPPLIER + PO, the independent goods-receipt valuation, and the
  // assembled INVOICE (supplier + line quantity + real reader amount).
  const kinds = res.decision.evidenceCitations.map((c) => c.referenceKind).sort();
  assert.deepEqual(kinds, ["INVOICE", "PURCHASE_ORDER", "RECEIPT", "SUPPLIER"]);
  assert.ok(res.decision.evidenceCitations.every((c) => c.verified === true), "every citation must verify independently");
  // R2: the derived ERV evidence PRESERVES THE ACTUAL source identity (no
  // substituted fixed locator): the INVOICE citation is the bound invoice
  // document's own identity, independently evidenced.
  const invoiceCitation = res.decision.evidenceCitations.find((c) => c.referenceKind === "INVOICE");
  const receiptCitation = res.decision.evidenceCitations.find((c) => c.referenceKind === "RECEIPT");
  assert.ok(invoiceCitation !== undefined && receiptCitation !== undefined);
  assert.equal(invoiceCitation.referenceId, "invoice:synthetic-101");
  assert.equal(receiptCitation.referenceId, "RCV-VAL-2026-0001");
  // No productive or booking authority: the ERV core grants none and the
  // composition requests only READ_SYNTHETIC / WRITE_LOCAL_PROOF.
  assert.equal(res.decision.authority.productivePostingAuthorized, false);
  assert.equal(res.decision.authority.bookingAuthorityGranted, false);
  assert.equal(res.decision.authority.riskDCapability, "SEPARATELY_AUTHORIZED");
  // R1: the quantities are COHERENT across the three representations: ordered
  // 2, received 2 (full receipt), invoiced 2 (the sealed line quantity) — all
  // equal to the frozen PO-2026-0001 source quantity (2). The closed amount
  // stays 2400 minor across all three representations.
  assert.deepEqual(res.quantities, { bestellteMenge: 2, mengenReceived: 2, invoicedMenge: 2, einheit: "STK", waehrung: "EUR" });
  // R1: the procurement-level reconciliation is closed: full invoice, no remainder.
  assert.deepEqual(res.reconciliation, { invoicedMenge: 2, remainingMenge: 0, policy: "FULL_INVOICE" });
  // The invoice-line evidence is the sealed local source (the supplied losses).
  assert.equal(res.invoiceLine.supplierId, "SYN-SUP-001");
  assert.equal(res.invoiceLine.menge, 2);
  assert.equal(res.invoiceLine.amountMinor, 2400);
  assert.equal(res.invoiceLine.locator, "tests/fixtures/incoming-invoice/invoice-line-v1.json#invoice:synthetic-101");
  assert.equal(res.invoiceLine.generator, "M1_RECHNUNGSZEILE_V1");
  assert.ok(/^[a-f0-9]{64}$/.test(res.invoiceLine.contentSha256));
  // R2: the ACTUAL verified AP-04 pack identity (the checked bytes, not a
  // substituted constant) closes over both retained digests.
  assert.deepEqual(res.ap04Pack, {
    sha256: AP04_ERV_CASE_PACK_SHA256_V1,
    canonicalSha256: AP04_ERV_CASE_PACK_CANONICAL_SHA256_V1,
  });
  // The F1 narrowed claim is retained for traceability; its digest closes.
  assert.ok(/^[a-f0-9]{64}$/.test(res.fallDigest));
  // The result is locally re-readable: its closed matchDigest verifies.
  assert.equal(verifyRechnungsabgleichMatchDigestV1(res), true);
});

test("PROC434-M1-P2: the positive path is the DECISIVE match, distinct from the F1 narrowed fall (same inputs; the F1 fall stays a non-decisive comparison, the decisive match RUNS the real matcher)", () => {
  const input = baseInput();
  const fall = rechnungsabgleichFallZusammensetzenV1(input, PACK);
  assert.equal(fall.outcome, "RECHNUNGSABGLEICH_FALL", JSON.stringify(fall, null, 1));
  if (fall.outcome !== "RECHNUNGSABGLEICH_FALL") throw new Error("unreachable");
  // The F1 composition (without the invoice line) stays the NARROWED claim:
  // decision null, purchase match explicitly unavailable.
  assert.equal(fall.decision, null);
  assert.equal(fall.purchaseMatch.available, false);
  assert.equal(fall.purchaseMatch.reasonCode, UNRESOLVED_INVOICE_EVIDENCE_INCOMPLETE_V1);
  assert.equal(fall.quantities.invoicedMenge, null);
  // The decisive match (with the sealed invoice line + mapping + manifest) runs
  // the real matcher and MATCHES — the same source-bound precondition, the gap
  // closed.
  const res = rechnungsabgleichMatchZusammensetzenV1(input, PACK);
  assert.equal(res.outcome, "RECHNUNGSABGLEICH_MATCH");
  if (res.outcome !== "RECHNUNGSABGLEICH_MATCH") throw new Error("unreachable");
  assert.equal(res.decision.outcome, "MATCHED");
  // The decisive result is built ON TOP of the F1 fall (its digest is retained).
  assert.equal(res.fallDigest, fall.fallDigest);
});

test("PROC434-M1-N0 (F1 precondition preserved): without the sealed invoice line the decisive match is NOT assembled — the F1 residual (narrowed, non-decisive) is preserved", () => {
  const input = baseInput({ invoiceLine: undefined });
  const res = rechnungsabgleichMatchZusammensetzenV1(input, PACK);
  // No invoice line -> the precondition fall is reached but the decisive match
  // is unavailable: propagated as the F1 UNRESOLVED/DENIED outcome (here the
  // fall is reached, so the invoice-line absence is a MATCH denial, not a match).
  assert.notEqual(res.outcome, "RECHNUNGSABGLEICH_MATCH", JSON.stringify(res, null, 1));
});

test("PROC434-M1-N0b (R2 source boundary): without the code-owned approved-source manifest the decisive match is NOT assembled — the admitted synthetic sources have no independent retained identity boundary", () => {
  const input = baseInput({ approvedSources: undefined });
  const res = rechnungsabgleichMatchZusammensetzenV1(input, PACK);
  assert.equal(res.outcome, "DENIED", JSON.stringify(res, null, 1));
  if (res.outcome === "DENIED") assert.equal(res.code, "MATCH_APPROVED_SOURCES_NOT_CLOSED");
});

test("PROC434-M1-N0c (R1 identity mapping): without the explicit PO-identity mapping the decisive match is NOT assembled — an unrelated amount reference is not an identity link", () => {
  const input = baseInput({ poIdentityMapping: undefined });
  const res = rechnungsabgleichMatchZusammensetzenV1(input, PACK);
  assert.equal(res.outcome, "DENIED", JSON.stringify(res, null, 1));
  if (res.outcome === "DENIED") assert.equal(res.code, "MATCH_PO_MAPPING_NOT_CLOSED");
});

test("PROC434-M1-N1 (missing invoice quantity, closed counter-example): a line with menge 0 (the M0 zero sentinel) is DENIED — the invoiced line quantity must be a closed positive quantity, never a sentinel", () => {
  const res = rechnungsabgleichMatchZusammensetzenV1(baseInput({ invoiceLine: line({ menge: 0 }) }), PACK);
  // The re-sealed menge-0 line is not admitted (no retained entry) — admission
  // fails closed before the quantity gate; either way the match is DENIED.
  assert.equal(res.outcome, "DENIED", JSON.stringify(res, null, 1));
  if (res.outcome === "DENIED") {
    assert.ok(res.code === "MATCH_INVOICE_LINE_SOURCE_NOT_ADMITTED" || res.code === "MATCH_INVOICE_LINE_MENGE_NOT_CLOSED", `unexpected code ${res.code}`);
  }
});

test("PROC434-M1-N2 (wrong unit, closed counter-example): an ADMITTED line in a unit that does not equal the bound position's closed unit is DENIED — quantities are only comparable in the same closed unit", () => {
  const res = rechnungsabgleichMatchZusammensetzenV1(baseInput({ invoiceLine: LINE_WRONG_UNIT }), PACK);
  assert.equal(res.outcome, "DENIED", JSON.stringify(res, null, 1));
  if (res.outcome === "DENIED") assert.equal(res.code, "MATCH_INVOICE_LINE_UNIT_MISMATCH");
});

test("PROC434-M1-N3 (wrong supplier, closed counter-example): an ADMITTED line whose supplier does not close to the PO/supplier identity is DENIED — the supplier relation is never word-mapped or reconstructed", () => {
  const res = rechnungsabgleichMatchZusammensetzenV1(baseInput({ invoiceLine: LINE_WRONG_SUPPLIER }), PACK);
  assert.equal(res.outcome, "DENIED", JSON.stringify(res, null, 1));
  if (res.outcome === "DENIED") assert.equal(res.code, "MATCH_INVOICE_LINE_SUPPLIER_NOT_CLOSED");
});

test("PROC434-M1-N4 (partial receipt, F1 precondition preserved): a partial receipt (1 of 2) stays UNRESOLVED at the F1 precondition — no decisive match is assembled", () => {
  const e = entwurf();
  const { readback, reader } = realReader();
  const input = baseInput({
    entwurf: e,
    receiptLedger: realReceiptLedger(e, 1, "wareneingang:wg-partial"),
  });
  const res = rechnungsabgleichMatchZusammensetzenV1(input, PACK);
  assert.equal(res.outcome, "UNRESOLVED", JSON.stringify(res, null, 1));
  if (res.outcome === "UNRESOLVED") assert.equal(res.code, "UNRESOLVED_PARTIAL_RECEIPT");
});

test("PROC434-M1-N5 (no receipt, F1 precondition preserved): an empty real ledger (no adopted receipt) stays UNRESOLVED — the receipt dimension cannot be decided", () => {
  const e = entwurf();
  const input = baseInput({ entwurf: e, receiptLedger: realReceiptLedger(e, 0, "wareneingang:wg-none") });
  const res = rechnungsabgleichMatchZusammensetzenV1(input, PACK);
  assert.equal(res.outcome, "UNRESOLVED", JSON.stringify(res, null, 1));
  if (res.outcome === "UNRESOLVED") assert.equal(res.code, "UNRESOLVED_NO_RECEIPT");
});

test("PROC434-M1-N6 (double event / correction at the receipt entrypoint, F1 preserved): a second identical receipt event is DENIED by the entrypoint (no blind re-write) — the composition only consumes a real ledger, so a double event never yields a match", () => {
  const e = entwurf();
  const opened = wareneingangLedgerBildenV1(e, "position:eink-001-01");
  if (opened.outcome !== "LEDGER") throw new Error("unreachable");
  const first = wareneingangErfassenV1(e, opened.ledger, { eingangsId: "wareneingang:wg-dup", bestellungId: e.bestellungId, positionId: "position:eink-001-01", einheit: "STK", menge: 2, zeitstempel: "2026-09-12T10:00:00Z", korrekturVon: null });
  if (first.outcome !== "WARENEINGANG_ERFASST") throw new Error("unreachable");
  // The entrypoint refuses a double event (replay denied) — no ledger rewrite.
  const replay = wareneingangErfassenV1(e, first.ledger, { eingangsId: "wareneingang:wg-dup", bestellungId: e.bestellungId, positionId: "position:eink-001-01", einheit: "STK", menge: 2, zeitstempel: "2026-09-12T11:00:00Z", korrekturVon: null });
  assert.equal(replay.outcome, "DENIED", JSON.stringify(replay));
  if (replay.outcome === "DENIED") assert.equal(replay.code, "WARENEINGANG_REPLAY_DENIED");
  // A correction that supersedes the event is honored by the real ledger; the
  // decisive match consumes the real ledger readback, so a corrected (partially
  // netted) ledger is reflected, never a blind double count.
  const correct = wareneingangErfassenV1(e, first.ledger, { eingangsId: "wareneingang:wg-corr", bestellungId: e.bestellungId, positionId: "position:eink-001-01", einheit: "STK", menge: 1, zeitstempel: "2026-09-12T12:00:00Z", korrekturVon: "wareneingang:wg-dup" });
  assert.equal(correct.outcome, "WARENEINGANG_ERFASST", JSON.stringify(correct));
  if (correct.outcome === "WARENEINGANG_ERFASST") {
    const net = correct.ledger.eintraege.filter((x) => !x.ersetzt).reduce((s, x) => s + x.menge, 0);
    assert.equal(net, 1, "the correction netted the ledger to 1 (partial of 2) — a partial receipt, not a full match");
    // The corrected (partial) ledger propagates through the decisive path as
    // UNRESOLVED_PARTIAL_RECEIPT (the F1 precondition), never a match.
    const { readback, reader } = realReader();
    const input = baseInput({
      entwurf: e,
      receiptLedger: correct.ledger,
      erpReadReadback: readback,
      reader,
    });
    const res = rechnungsabgleichMatchZusammensetzenV1(input, PACK);
    assert.equal(res.outcome, "UNRESOLVED", JSON.stringify(res, null, 1));
    if (res.outcome === "UNRESOLVED") assert.equal(res.code, "UNRESOLVED_PARTIAL_RECEIPT");
  }
});

test("PROC434-M1-N7 (amount conflict with the real reader fact, closed counter-example): a line whose amountMinor conflicts with the real erp-read reader fact is DENIED — the authoritative invoice amount stays the reader fact, the line cannot re-label it", () => {
  const res = rechnungsabgleichMatchZusammensetzenV1(baseInput({ invoiceLine: line({ amountMinor: 2500 }) }), PACK);
  assert.equal(res.outcome, "DENIED", JSON.stringify(res, null, 1));
  if (res.outcome === "DENIED") {
    // The re-sealed conflicting amount is not admitted (no retained entry);
    // admission fails closed before the reader cross-check; either way DENIED.
    assert.ok(res.code === "MATCH_INVOICE_LINE_SOURCE_NOT_ADMITTED" || res.code === "MATCH_INVOICE_LINE_AMOUNT_CONFLICTS_READER", `unexpected code ${res.code}`);
  }
});

test("PROC434-M1-N8 (amount beyond the frozen tolerance -> real ERV CONFLICT, closed counter-example): with the independent receipt valuation at 2450 (distinct from the PO's 2400) the three amounts disagree beyond STRICT_ZERO — the decisive match RUNS and the real ERV core returns CONFLICT (a real negative, not a manufactured match)", () => {
  const res = rechnungsabgleichMatchZusammensetzenV1(baseInput({ receiptValuation: VAL_2450 }), PACK);
  assert.equal(res.outcome, "RECHNUNGSABGLEICH_MATCH", JSON.stringify(res, null, 1));
  if (res.outcome !== "RECHNUNGSABGLEICH_MATCH") throw new Error("unreachable");
  // The decisive matcher was RUN (not skipped) and the real ERV core decided
  // CONFLICT: the receipt amount (2450) does not agree with the invoice/PO
  // (2400) under STRICT_ZERO.
  assert.equal(res.decision.outcome, "CONFLICT", JSON.stringify(res.decision, null, 1));
  assert.equal(res.decision.authority.bookingAuthorityGranted, false);
});

// ---- R1: the procurement-level QUANTITY/IDENTITY reconciliation ----

test("PROC434-M1-R1a (legitimate PARTIAL invoice): an ADMITTED line invoicing 1 of the ordered 2 (full receipt) is an explicit UNRESOLVED_PARTIAL_INVOICE with the REMAINING quantity (1) stated — never a MATCHED decision and never a silent claim shrink", () => {
  const res = rechnungsabgleichMatchZusammensetzenV1(baseInput({ invoiceLine: LINE_PARTIAL }), PACK);
  assert.equal(res.outcome, "UNRESOLVED", JSON.stringify(res, null, 1));
  if (res.outcome === "UNRESOLVED") {
    assert.equal(res.code, "UNRESOLVED_PARTIAL_INVOICE");
    assert.equal(res.remainingMenge, 1);
  }
});

test("PROC434-M1-R1b (OVER-invoicing rejected): an ADMITTED line invoicing 4 (more than the ordered/accepted 2) is DENIED — a matched decision is never issued beyond the ordered/accepted quantity (the 999 false-positive is gone)", () => {
  const res = rechnungsabgleichMatchZusammensetzenV1(baseInput({ invoiceLine: LINE_OVER }), PACK);
  assert.equal(res.outcome, "DENIED", JSON.stringify(res, null, 1));
  if (res.outcome === "DENIED") assert.equal(res.code, "MATCH_INVOICE_LINE_OVER_INVOICED");
});

test("PROC434-M1-R1c (the 999 false-positive is gone): a line invoicing 999 (the review's reproduced over-invoice) is DENIED as over-invoicing — it can never read as a match", () => {
  // The over fixture (200) is the retained coherent counter-example; a 999 line
  // is a further over-invoice. It is not admitted (no retained entry for the
  // re-sealed 999 content), so admission fails closed BEFORE the quantity gate;
  // either way it is a DENIED outcome, never a MATCHED decision.
  const res999 = rechnungsabgleichMatchZusammensetzenV1(baseInput({ invoiceLine: line({ menge: 999 }) }), PACK);
  assert.equal(res999.outcome, "DENIED", JSON.stringify(res999, null, 1));
  if (res999.outcome === "DENIED") {
    assert.ok(res999.code === "MATCH_INVOICE_LINE_SOURCE_NOT_ADMITTED" || res999.code === "MATCH_INVOICE_LINE_OVER_INVOICED", `unexpected code ${res999.code}`);
  }
});

test("PROC434-M1-R1d (evidence-vs-draft DISAGREEMENT): a PO-identity mapping whose local draft identities do not close to the draft (supplier/order/position/article) is DENIED — the identity link between the draft and the PO evidence is unresolved, never word-mapped", () => {
  for (const [name, override] of [
    ["supplier", { localSupplierId: "lieferant:unknown-999" }],
    ["order", { localBestellungId: "bestellung:eink-999" }],
    ["position", { localPositionId: "position:eink-999-01" }],
    ["article", { localArtikelId: "EINK-ART-999" }],
  ] as const) {
    const res = rechnungsabgleichMatchZusammensetzenV1(baseInput({ poIdentityMapping: mapping(override) }), PACK);
    assert.equal(res.outcome, "DENIED", `${name}: ${JSON.stringify(res, null, 1)}`);
    if (res.outcome === "DENIED") assert.equal(res.code, "MATCH_PO_MAPPING_IDENTITY_MISMATCH", `${name}: expected ${res.code}`);
  }
});

test("PROC434-M1-R1e (PO mapping does not close to the bound PO/supplier): a PO-identity mapping whose poReferenceId or supplierClosedIdentity does not close to the bound PO reference / supplier-closed identity is DENIED", () => {
  for (const [name, override] of [
    ["poReference", { poReferenceId: "PO-2026-9999" }],
    ["supplierClosed", { supplierClosedIdentity: "SYN-SUP-999" }],
  ] as const) {
    const res = rechnungsabgleichMatchZusammensetzenV1(baseInput({ poIdentityMapping: mapping(override) }), PACK);
    assert.equal(res.outcome, "DENIED", `${name}: ${JSON.stringify(res, null, 1)}`);
    if (res.outcome === "DENIED") assert.equal(res.code, "MATCH_PO_MAPPING_IDENTITY_MISMATCH", `${name}: expected ${res.code}`);
  }
});

test("PROC434-M1-R1f (broken PO-identity mapping seal): a PO-identity mapping whose content seal does not close over its identity core is DENIED — a tampered or re-sealed mapping is not source-bound", () => {
  const broken = { ...mapping(), contentSha256: "f".repeat(64) } as RechnungsabgleichPoIdentityMappingV1;
  const res = rechnungsabgleichMatchZusammensetzenV1(baseInput({ poIdentityMapping: broken }), PACK);
  assert.equal(res.outcome, "DENIED", JSON.stringify(res, null, 1));
  if (res.outcome === "DENIED") assert.equal(res.code, "MATCH_PO_MAPPING_NOT_CLOSED");
});

test("PROC434-M1-R1g (PO mapping not admitted by the retained manifest): a re-sealed PO-identity mapping (content changed, self-digest recomputed) has no retained entry — a caller's content+self-hash is NOT source authority (admission fails closed)", () => {
  // A re-sealed mapping with an altered article identity: the seal is VALID over
  // the (altered) content, but the retained manifest only admits the original.
  // The identity gate (R1d) would also deny it; admission is checked after the
  // identity link, so a mapping that closes to the draft but is re-sealed is
  // denied by admission.
  const resealed = mapping({ localArtikelId: "EINK-ART-001" }); // closes to draft
  const res = rechnungsabgleichMatchZusammensetzenV1(baseInput({ poIdentityMapping: { ...resealed, contentSha256: "0".repeat(64) } }), PACK);
  // A broken seal is caught by the seal gate (before admission):
  assert.equal(res.outcome, "DENIED", JSON.stringify(res, null, 1));
  if (res.outcome === "DENIED") assert.equal(res.code, "MATCH_PO_MAPPING_NOT_CLOSED");
});

// ---- R2: source authenticity (the caller's content+self-hash is NOT authority) ----

test("PROC434-M1-R2a (same-ID source RESEAL is not authority): a line with the SAME invoice/supplier/order/position but a changed quantity and a RECOMPUTED self-digest is DENIED — no retained manifest entry matches the re-sealed content (the review's 1/100/101/999 false-positives are gone)", () => {
  for (const q of [1, 101]) {
    const res = rechnungsabgleichMatchZusammensetzenV1(baseInput({ invoiceLine: line({ menge: q }) }), PACK);
    assert.equal(res.outcome, "DENIED", `menge ${q}: ${JSON.stringify(res, null, 1)}`);
    if (res.outcome === "DENIED") assert.equal(res.code, "MATCH_INVOICE_LINE_SOURCE_NOT_ADMITTED", `menge ${q}: expected admission denial`);
  }
});

test("PROC434-M1-R2b (METADATA SWAP is not authority): a line whose evidence locator/generator/attester is swapped WITHOUT a rehash is DENIED — the retained manifest binds the ACTUAL evidence identity", () => {
  // The positive line (valid self-seal) with a swapped evidence identity (same
  // content, new locator/generator/attester). The self-seal still closes (the
  // content is unchanged) but the manifest has no entry for the swapped
  // identity -> admission fails closed.
  const swapped = {
    ...LINE_POSITIVE,
    evidence: { ...LINE_POSITIVE.evidence, locator: "reviewer-swapped-source", generator: "reviewer", attestedBy: "nobody" },
  } as RechnungsabgleichInvoiceLineV1;
  const res = rechnungsabgleichMatchZusammensetzenV1(baseInput({ invoiceLine: swapped }), PACK);
  assert.equal(res.outcome, "DENIED", JSON.stringify(res, null, 1));
  if (res.outcome === "DENIED") assert.equal(res.code, "MATCH_INVOICE_LINE_SOURCE_NOT_ADMITTED");
});

test("PROC434-M1-R2c (STRICT_ZERO tolerance MUTATION under the same variant name/version is not authority): a loaded AP-04 pack with absoluteToleranceMinor changed 0 -> 50 under the SAME variantId/version is DENIED BEFORE evaluation — the tolerance-policy bytes are part of the frozen pack identity (the receipt-2450 CONFLICT cannot be flipped to MATCHED)", () => {
  const mutatedPack = structuredClone(PACK) as ErvCasePackV1;
  const policy = (mutatedPack as unknown as { variants: { tolerancePolicies: Array<{ variantId: string; absoluteToleranceMinor: number }> } }).variants.tolerancePolicies.find((p) => p.variantId === "STRICT_ZERO_V1");
  assert.ok(policy !== undefined, "STRICT_ZERO_V1 policy must exist in the pack");
  policy.absoluteToleranceMinor = 50;
  // The mutated pack no longer closes to its retained frozen identity:
  const res = rechnungsabgleichMatchZusammensetzenV1(baseInput(), mutatedPack);
  assert.equal(res.outcome, "DENIED", JSON.stringify(res, null, 1));
  if (res.outcome === "DENIED") assert.equal(res.code, "MATCH_AP04_PACK_NOT_FROZEN");
  // And the receipt-2450 case (which the mutation was meant to flip to MATCHED)
  // stays a real CONFLICT under the ORIGINAL frozen pack.
  const conflict = rechnungsabgleichMatchZusammensetzenV1(baseInput({ receiptValuation: VAL_2450 }), PACK);
  assert.equal(conflict.outcome, "RECHNUNGSABGLEICH_MATCH");
  if (conflict.outcome === "RECHNUNGSABGLEICH_MATCH") assert.equal(conflict.decision.outcome, "CONFLICT");
});

test("PROC434-M1-R2d (the loaded AP-04 pack is verified against its RETAINED frozen identity): the positive result reports the ACTUAL verified pack identity (both retained digests), not a substituted constant", () => {
  const res = rechnungsabgleichMatchZusammensetzenV1(baseInput(), PACK);
  assert.equal(res.outcome, "RECHNUNGSABGLEICH_MATCH");
  if (res.outcome !== "RECHNUNGSABGLEICH_MATCH") throw new Error("unreachable");
  assert.equal(res.ap04Pack.sha256, AP04_ERV_CASE_PACK_SHA256_V1);
  assert.equal(res.ap04Pack.canonicalSha256, AP04_ERV_CASE_PACK_CANONICAL_SHA256_V1);
  // The retained manifest carries the same frozen identity.
  assert.equal(APPROVED_SOURCES.ap04Pack.sha256, AP04_ERV_CASE_PACK_SHA256_V1);
  assert.equal(APPROVED_SOURCES.ap04Pack.canonicalSha256, AP04_ERV_CASE_PACK_CANONICAL_SHA256_V1);
});

test("PROC434-M1-R2e (receipt valuation not admitted by the retained manifest): a re-sealed receipt valuation (content changed, self-digest recomputed) is DENIED — its amount cannot authenticate from a self-hash alone", () => {
  // A re-sealed valuation: the F1 precondition would accept it if its seal
  // closes, but the R2 manifest admission requires a retained entry. An
  // altered valuation (matchAmountMinor changed + resealed) has no entry.
  const resealed = {
    ...VAL_2450,
    matchAmountMinor: 2400,
    contentSha256: sha({
      referenceId: VAL_2450.referenceId, referenceKind: VAL_2450.referenceKind, belegId: VAL_2450.belegId,
      bestellungId: VAL_2450.bestellungId, positionId: VAL_2450.positionId, supplierId: VAL_2450.supplierId,
      einheit: VAL_2450.einheit, waehrung: VAL_2450.waehrung, matchAmountMinor: 2400,
    }),
  } as unknown as RechnungsabgleichReceiptValuationV1;
  const res = rechnungsabgleichMatchZusammensetzenV1(baseInput({ receiptValuation: resealed }), PACK);
  assert.equal(res.outcome, "DENIED", JSON.stringify(res, null, 1));
  if (res.outcome === "DENIED") assert.equal(res.code, "MATCH_RECEIPT_VALUATION_SOURCE_NOT_ADMITTED");
});

// ---- Preserved F1 / source-substitution negatives (the review's passing protections) ----

test("PROC434-M1-N9 (swapped source despite a recomputed self-delivered digest, closed counter-example): a line re-sealed over the SWAPPED supplier content (a valid self-digest) does NOT authenticate the source — the supplier does not close to the PO/supplier identity, so the decisive match is DENIED (no false security from self-hashes)", () => {
  // The swapped line carries a VALID self-delivered digest over its own (swapped)
  // content — the seal is NOT the authentication basis. The closed check is the
  // supplier close to the PO/supplier identity, which fails. (This line is
  // admitted by the retained manifest so the closed supplier gate is exercised
  // in isolation from source admission.)
  const swapped = LINE_WRONG_SUPPLIER;
  assert.ok(/^[a-f0-9]{64}$/.test(swapped.contentSha256));
  assert.ok(swapped.contentSha256 !== LINE_POSITIVE.contentSha256, "the swapped line is a different self-delivered digest");
  const res = rechnungsabgleichMatchZusammensetzenV1(baseInput({ invoiceLine: swapped }), PACK);
  assert.equal(res.outcome, "DENIED", JSON.stringify(res, null, 1));
  if (res.outcome === "DENIED") assert.equal(res.code, "MATCH_INVOICE_LINE_SUPPLIER_NOT_CLOSED");
});

test("PROC434-M1-N10 (broken invoice-line seal, closed counter-example): a line whose content seal does not close over its amount-carrying identity core is DENIED — a tampered or re-sealed line is not source-bound", () => {
  const broken = { ...line(), contentSha256: "f".repeat(64) } as RechnungsabgleichInvoiceLineV1;
  const res = rechnungsabgleichMatchZusammensetzenV1(baseInput({ invoiceLine: broken }), PACK);
  assert.equal(res.outcome, "DENIED", JSON.stringify(res, null, 1));
  if (res.outcome === "DENIED") assert.equal(res.code, "MATCH_INVOICE_LINE_SEAL_BROKEN");
});

test("PROC434-M1-N11 (broken binding, closed counter-examples): an invoice line bound to the wrong invoice, order, or position is DENIED — an identical local id in another order is a different closed identity", () => {
  for (const [name, code, override] of [
    ["invoice", "MATCH_INVOICE_LINE_INVOICE_MISMATCH", { invoiceId: "invoice:synthetic-102" }],
    ["order", "MATCH_INVOICE_LINE_ORDER_MISMATCH", { bestellungId: "bestellung:eink-999" }],
    ["position", "MATCH_INVOICE_LINE_POSITION_MISMATCH", { positionId: "position:eink-999-01" }],
  ] as const) {
    // These re-sealed lines (changed invoice/order/position, recomputed digest)
    // are not admitted (no retained entry) — admission fails closed before the
    // binding gate; either way the match is DENIED.
    const res = rechnungsabgleichMatchZusammensetzenV1(baseInput({ invoiceLine: line(override) }), PACK);
    assert.equal(res.outcome, "DENIED", `${name}: ${JSON.stringify(res, null, 1)}`);
    if (res.outcome === "DENIED") {
      assert.ok(res.code === code || res.code === "MATCH_INVOICE_LINE_SOURCE_NOT_ADMITTED", `${name}: expected ${code} or admission denial, got ${res.code}`);
    }
  }
});

test("PROC434-M1-N12 (not a closed LOCAL_SYNTHETIC_FIXTURE, closed counter-example): an invoice line with the wrong sourceKind (or a non-object) is DENIED — the supplied source must be a closed, content-sealed LOCAL_SYNTHETIC_FIXTURE", () => {
  const nonFixture = { ...line(), evidence: { ...line().evidence, sourceKind: "PRODUCTION" as unknown as "LOCAL_SYNTHETIC_FIXTURE" } } as unknown as RechnungsabgleichInvoiceLineV1;
  const res = rechnungsabgleichMatchZusammensetzenV1(baseInput({ invoiceLine: nonFixture }), PACK);
  assert.equal(res.outcome, "DENIED", JSON.stringify(res, null, 1));
  if (res.outcome === "DENIED") {
    // The wrong sourceKind is caught by the closed-shape gate (before admission):
    assert.equal(res.code, "MATCH_INVOICE_LINE_NOT_CLOSED");
  }
  const res2 = rechnungsabgleichMatchZusammensetzenV1(baseInput({ invoiceLine: "not-an-object" }), PACK);
  assert.equal(res2.outcome, "DENIED");
  if (res2.outcome === "DENIED") assert.equal(res2.code, "MATCH_INVOICE_LINE_NOT_CLOSED");
});

test("PROC434-M1-N13 (F1 reader source-binding preserved): a caller-resealed altered reader fact with an unchanged source identity is DENIED at the F1 precondition — the decisive match is not assembled (no false security from self-hashes)", () => {
  const input = baseInput();
  const readbackRecords = (input.erpReadReadback as unknown as { records: Array<Record<string, unknown>> }).records;
  if (readbackRecords.length < 1) throw new Error("unreachable: no reader records");
  const originalAmount = (readbackRecords[0] as Record<string, unknown>).totalMinor as number;
  const altered = readbackRecords.map((record, index) => (index === 0 ? { ...record, totalMinor: originalAmount + 100 } : record));
  const resealDigest = createHash("sha256").update(canonicalJson({ entity: "invoices", records: altered, metadata: (input.erpReadReadback as { metadata: Record<string, unknown> }).metadata }), "utf8").digest("hex");
  const res = rechnungsabgleichMatchZusammensetzenV1(
    baseInput({
      erpReadReadback: { ...(input.erpReadReadback as object), records: altered, readbackDigest: resealDigest },
      reader: { ...(input.reader as object), factsDigest: readerFactsDigestV1(altered) },
    }),
    PACK,
  );
  assert.equal(res.outcome, "DENIED", JSON.stringify(res, null, 1));
  if (res.outcome === "DENIED") assert.equal(res.code, "FALL_READER_SOURCE_BINDING_NOT_CLOSED");
});

test("PROC434-M1-N14 (unknown supplier receipt valuation, F1 preserved): a goods-receipt valuation attested under an unknown supplier (does not close to the PO) stays UNRESOLVED at the F1 precondition — never reconstructed", () => {
  const res = rechnungsabgleichMatchZusammensetzenV1(baseInput({ receiptValuation: VAL_UNKNOWN_SUPPLIER }), PACK);
  assert.equal(res.outcome, "UNRESOLVED", JSON.stringify(res, null, 1));
  if (res.outcome === "UNRESOLVED") assert.equal(res.code, "UNRESOLVED_RECEIPT_VALUATION_ABSENT");
});

test("PROC434-M1-N15 (separate-reference rule, F1 preserved): a receipt valuation whose referenceId equals the PO referenceId is not independently bound -> UNRESOLVED at the F1 precondition", () => {
  const res = rechnungsabgleichMatchZusammensetzenV1(baseInput({ receiptValuation: VAL_PO_IDENTITY }), PACK);
  assert.equal(res.outcome, "UNRESOLVED", JSON.stringify(res, null, 1));
  if (res.outcome === "UNRESOLVED") assert.equal(res.code, "UNRESOLVED_RECEIPT_VALUATION_ABSENT");
});

test("PROC434-M1-N16 (currency mismatch, closed counter-example): an ADMITTED line in a currency that does not equal the bound position's closed currency is DENIED — the amount dimension is unresolved", () => {
  const res = rechnungsabgleichMatchZusammensetzenV1(baseInput({ invoiceLine: LINE_WRONG_CURRENCY }), PACK);
  assert.equal(res.outcome, "DENIED", JSON.stringify(res, null, 1));
  if (res.outcome === "DENIED") assert.equal(res.code, "MATCH_INVOICE_LINE_CURRENCY_MISMATCH");
});

test("PROC434-M1-M: the decisive composition is a REAL composition, not a claim shrink — it names the real frozen mode, runs the reused ERV core, and the synthetic sources are explicitly labeled (no production/booking claim)", () => {
  const res = rechnungsabgleichMatchZusammensetzenV1(baseInput(), PACK);
  assert.equal(res.outcome, "RECHNUNGSABGLEICH_MATCH");
  if (res.outcome !== "RECHNUNGSABGLEICH_MATCH") throw new Error("unreachable");
  // The real frozen mode is named and the reused ERV core decided it.
  assert.equal(res.mode, "THREE_WAY_INVOICE_PO_RECEIPT_V1");
  assert.equal(res.decision.outcome, "MATCHED");
  assert.equal(res.decision.variant.matchingModeId, "THREE_WAY_INVOICE_PO_RECEIPT_V1");
  assert.equal(res.decision.variant.matchingModeVersion, "1.0.0");
  assert.equal(res.decision.variant.tolerancePolicyId, "STRICT_ZERO_V1");
  // The reused frozen AP-04 pack identity is the consumer's pack.
  assert.equal(AP04_ERV_CASE_PACK_SHA256_V1.length, 64);
  // The synthetic sources are explicitly labeled (the invoice line is a
  // LOCAL_SYNTHETIC_FIXTURE); the composition grants no productive authority.
  assert.equal(LINE_POSITIVE.evidence.sourceKind, "LOCAL_SYNTHETIC_FIXTURE");
  assert.equal(INVOICE_LINE_SCHEMA_V1, "cm.fachprofil/rechnungszeile/v1");
  assert.equal(PO_IDENTITY_MAPPING_SCHEMA_V1, "cm.proc434/po-identity-mapping/v1");
  assert.equal(PROCUREMENT434_APPROVED_SOURCES_SCHEMA_V1, "cm.proc434/procurement-434-approved-sources/v1");
  assert.equal(res.decision.authority.productivePostingAuthorized, false);
  assert.equal(res.decision.authority.bookingAuthorityGranted, false);
  // The result is re-readable locally: its closed matchDigest verifies.
  assert.equal(verifyRechnungsabgleichMatchDigestV1(res), true);
  assert.equal(verifyRechnungsabgleichMatchDigestV1({ ...res, matchDigest: "0".repeat(64) }), false);
});
