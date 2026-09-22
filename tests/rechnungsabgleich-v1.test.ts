import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import test from "node:test";
import {
  bestellungsentwurfBildenV1,
  mengenzustandV1,
  wareneingangErfassenV1,
  wareneingangLedgerBildenV1,
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
  verifyRechnungsabgleichFallDigestV1,
  readerFactsDigestV1,
  RECHNUNGSABGLEICH_MATCHING_MODE_V1,
  RECHNUNGSABGLEICH_COMPARISON_MODE_V1,
  UNRESOLVED_INVOICE_EVIDENCE_INCOMPLETE_V1,
  type RechnungsabgleichFallOutcomeV1,
  type RechnungsabgleichReceiptValuationV1,
} from "../packages/contracts/src/rechnungsabgleich-v1.js";
import { canonicalJson } from "../packages/contracts/src/canonical-json.js";

// Real reused fixtures: the frozen AP-04 purchase-side references (SUPPLIER + PO),
// the retained erp-read reader contract, the matched erp-read export (the SEALED
// reader source), and the independently-attested warehouse goods-receipt valuations.
const load = <T>(p: string): T => JSON.parse(readFileSync(p, "utf8")) as T;
const PACK = load<ErvCasePackV1>("tests/fixtures/incoming-invoice/ap-04-erv-cases-v1.json");
const READER_CONTRACT = load<ErpReadConnectorContractV1>("tests/fixtures/erp-read/contract-v1.json");
const READER_EXPORT = load<ErpSupportedExportV1>("tests/fixtures/erp-read/matched-export-v1.json");
const VAL_STANDARD = load<RechnungsabgleichReceiptValuationV1>("tests/fixtures/incoming-invoice/receipt-valuation-v1.json");
const VAL_2450 = load<RechnungsabgleichReceiptValuationV1>("tests/fixtures/incoming-invoice/receipt-valuation-2450-v1.json");
const VAL_UNKNOWN_SUPPLIER = load<RechnungsabgleichReceiptValuationV1>("tests/fixtures/incoming-invoice/receipt-valuation-unknown-supplier-v1.json");
const VAL_PO_IDENTITY = load<RechnungsabgleichReceiptValuationV1>("tests/fixtures/incoming-invoice/receipt-valuation-po-identity-v1.json");

// The frozen AP-04 purchase-side references: the M0 profile declares supplierId +
// quantity as LOSSY (the erp-read source is sales-side), so these are REUSED from
// the frozen pack by versioned identity — never word-mapped from the erp-read customerId.
const FROZEN_CASE = PACK.cases.find((c) => c.caseId === "two-way-matched-strict");
if (!FROZEN_CASE) throw new Error("frozen AP-04 two-way-matched-strict case missing");
const FROZEN_SUPPLIER = FROZEN_CASE.references.find((r) => r.body.referenceKind === "SUPPLIER") as ErvEvidenceReferenceV1;
const FROZEN_PO = FROZEN_CASE.references.find((r) => r.body.referenceKind === "PURCHASE_ORDER") as ErvEvidenceReferenceV1;
const PO_AMOUNT_MINOR = FROZEN_PO.body.matchAmountMinor as number;

/** Closed canonical sha256 (the same rule the reader/mapping/valuation modules use). */
function resealed(value: unknown): string {
  return createHash("sha256").update(canonicalJson(value), "utf8").digest("hex");
}

function entwurf(overrides: Record<string, unknown> = {}): BestellentwurfV1 {
  const r = bestellungsentwurfBildenV1({
    bestellungId: "bestellung:eink-001",
    lieferantId: "lieferant:metall-001",
    bestellungZeitstempel: "2026-09-10T08:00:00Z",
    positionen: [
      { positionId: "position:eink-001-01", artikelId: "EINK-ART-001", einheit: "STK", waehrung: "EUR", bestellteMenge: 100, berechneteMengeMinor: null },
    ],
    ...overrides,
  });
  assert.equal(r.outcome, "ENTWURF", `expected ENTWURF: ${JSON.stringify(r)}`);
  if (r.outcome !== "ENTWURF") throw new Error("unreachable");
  return r.entwurf;
}

/** Invoke the REAL retained erp-read reader (createErpReadAdapterV1) on the
 *  SEALED matched synthetic export and return the reader's closed READ result
 *  (records + metadata + readbackDigest) plus the reader's LOCAL_SYNTHETIC
 *  lineage attestation for the EXACT owned-read records. */
function realReader(): { readback: Extract<ErpReadResultV1, { outcome: "READ" }>; reader: ReturnType<typeof buildAttestation> } {
  const adapter = createErpReadAdapterV1({ contract: READER_CONTRACT, source: READER_EXPORT, enabled: true, now: "2026-09-10T08:30:00Z" });
  const res = adapter({ operation: "LIST_INVOICES", tenantId: "tenant:synthetic-zoo", principalId: "principal:bi-m1-reader", scopes: ["erp.synthetic.bi.read"], credentialPresent: true, fields: READER_CONTRACT.fields.invoices, pageSize: 2 });
  assert.equal(res.outcome, "READ", `real reader must READ the matched export: ${JSON.stringify(res)}`);
  if (res.outcome !== "READ") throw new Error("unreachable");
  return { readback: res, reader: buildAttestation(res) };
}
/** Build the retained reader's LOCAL_SYNTHETIC attestation for a READ result:
 *  the lineage identity comes from the reader metadata (the SEALED source's
 *  identity); the factsDigest binds the EXACT records. */
function buildAttestation(res: { records: readonly unknown[]; metadata: { sourceDatasetId: string; sourceDigest: string } }) {
  return {
    trust: "LOCAL_SYNTHETIC" as const,
    sourceDatasetId: res.metadata.sourceDatasetId,
    sourceDigest: res.metadata.sourceDigest,
    factsDigest: readerFactsDigestV1(res.records),
  };
}

/** Invoke the REAL receipt entrypoints: open the per-position ledger and record a
 *  receipt (menge), returning the entrypoint's ledger. menge 0 -> the empty owned
 *  ledger (no receipt recorded). */
function realReceiptLedger(e: BestellentwurfV1, menge: number, eingangsId: string): WareneingangLedgerV1 {
  const opened = wareneingangLedgerBildenV1(e, "position:eink-001-01");
  assert.equal(opened.outcome, "LEDGER", `expected LEDGER: ${JSON.stringify(opened)}`);
  if (opened.outcome !== "LEDGER") throw new Error("unreachable");
  const ledger = opened.ledger;
  if (menge < 1) return ledger;
  const applied = wareneingangErfassenV1(e, ledger, {
    eingangsId, bestellungId: e.bestellungId, positionId: "position:eink-001-01", einheit: "STK", menge, zeitstempel: "2026-09-12T10:00:00Z", korrekturVon: null,
  });
  assert.equal(applied.outcome, "WARENEINGANG_ERFASST", `expected WARENEINGANG_ERFASST: ${JSON.stringify(applied)}`);
  if (applied.outcome !== "WARENEINGANG_ERFASST") throw new Error("unreachable");
  return applied.ledger;
}

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
    receiptLedger: realReceiptLedger(e, 100, "wareneingang:wg-eink-001"),
    receiptValuation: VAL_STANDARD,
    supplierReference: FROZEN_SUPPLIER,
    poReference: FROZEN_PO,
    tolerancePolicy: { variantId: "STRICT_ZERO_V1", version: "1.0.0" },
    ...overrides,
  };
}

test("M1-F1A: full receipt + sealed independent valuation -> the narrowed explicit INVOICE-vs-PO amount comparison; decision=null, purchase match explicitly unavailable (NOT a purchase match)", () => {
  const fall = rechnungsabgleichFallZusammensetzenV1(baseInput(), PACK);
  assert.equal(fall.outcome, "RECHNUNGSABGLEICH_FALL", JSON.stringify(fall, null, 1));
  if (fall.outcome !== "RECHNUNGSABGLEICH_FALL") throw new Error("unreachable");
  assert.equal(fall.schemaVersion, "cm.fachprofil/rechnungsabgleich-fall/v1");
  // The narrowed claim: explicit synthetic INVOICE-vs-PO amount comparison.
  assert.equal(fall.comparison, RECHNUNGSABGLEICH_COMPARISON_MODE_V1);
  assert.equal(RECHNUNGSABGLEICH_COMPARISON_MODE_V1, "INVOICE_PO_AMOUNT_ONLY_V1");
  // No decisive decision: the real matcher was NOT run.
  assert.equal(fall.decision, null);
  // The amount comparison is real evidence: invoice 2400 (real reader fact,
  // M0 amount sub-use) vs the frozen PO 2400 under the frozen STRICT_ZERO.
  assert.equal(fall.amountComparison.invoiceAmountMinor, PO_AMOUNT_MINOR);
  assert.equal(fall.amountComparison.poAmountMinor, PO_AMOUNT_MINOR);
  assert.equal(fall.amountComparison.deltaMinor, 0);
  assert.equal(fall.amountComparison.agreement, "AGREES");
  assert.equal(fall.amountComparison.tolerancePolicy.variantId, "STRICT_ZERO_V1");
  // The decisive purchase match is explicitly UNAVAILABLE on this source:
  // the M0 profile declares the invoice-side supplier/quantity losses, and a
  // PO supplier identity + a quantity zero sentinel are NOT invoice evidence.
  assert.equal(fall.purchaseMatch.available, false);
  assert.equal(fall.purchaseMatch.mode, RECHNUNGSABGLEICH_MATCHING_MODE_V1);
  assert.equal(RECHNUNGSABGLEICH_MATCHING_MODE_V1, "THREE_WAY_INVOICE_PO_RECEIPT_V1");
  assert.equal(fall.purchaseMatch.reasonCode, UNRESOLVED_INVOICE_EVIDENCE_INCOMPLETE_V1);
  assert.ok(fall.purchaseMatch.detail.includes("not invoice evidence"));
  // Quantities: ordered 100, received 100 (real readback), invoiced UNRESOLVED
  // (null) — the erp-read source declares quantity a loss; never fabricated.
  assert.equal(fall.quantities.bestellteMenge, 100);
  assert.equal(fall.quantities.mengenReceived, 100);
  assert.equal(fall.quantities.invoicedMenge, null);
  assert.equal(fall.quantities.einheit, "STK");
  // The receipt dimension: the INDEPENDENT sealed valuation (distinct from the
  // PO), never the PO amount.
  assert.equal(fall.receiptValuation.referenceId, VAL_STANDARD.referenceId);
  assert.equal(fall.receiptValuation.matchAmountMinor, VAL_STANDARD.matchAmountMinor);
  assert.notEqual(fall.receiptValuation.referenceId, FROZEN_PO.body.referenceId);
  // The M0 declared losses are carried through explicitly.
  assert.deepEqual(fall.declaredLossReasonCodes, ["COUNTERPARTY_IDENTITY_UNAVAILABLE", "QUANTITY_UNAVAILABLE"]);
  // The reader chain is bound to the SEALED source identity.
  assert.equal(fall.source.sourceDigest, READER_EXPORT.lineage.sourceDigest);
  assert.equal(fall.source.sourceDatasetId, READER_EXPORT.lineage.sourceDatasetId);
  assert.ok(fall.source.readbackDigest.length === 64);
  assert.equal(verifyRechnungsabgleichFallDigestV1(fall), true);
});

test("M1-F1B (parent counterexample, preserved): partial receipt (1 of 100) via real receipt entrypoint stays UNRESOLVED, never a match", () => {
  const e = entwurf();
  const fall = rechnungsabgleichFallZusammensetzenV1(
    baseInput({ receiptLedger: realReceiptLedger(e, 1, "wareneingang:wg-partial") }),
    PACK,
  );
  assert.equal(fall.outcome, "UNRESOLVED", JSON.stringify(fall, null, 1));
  if (fall.outcome === "UNRESOLVED") assert.equal(fall.code, "UNRESOLVED_PARTIAL_RECEIPT");
});

test("M1-F1C: no adopted receipt (empty real ledger) stays UNRESOLVED, never a match", () => {
  const e = entwurf();
  const fall = rechnungsabgleichFallZusammensetzenV1(
    baseInput({ receiptLedger: realReceiptLedger(e, 0, "wareneingang:wg-none") }),
    PACK,
  );
  assert.equal(fall.outcome, "UNRESOLVED", JSON.stringify(fall, null, 1));
  if (fall.outcome === "UNRESOLVED") assert.equal(fall.code, "UNRESOLVED_NO_RECEIPT");
});

test("M1-F1D: full receipt but NO independent receipt valuation stays UNRESOLVED (the PO amount is never copied into the receipt)", () => {
  const fall = rechnungsabgleichFallZusammensetzenV1(baseInput({ receiptValuation: null }), PACK);
  assert.equal(fall.outcome, "UNRESOLVED", JSON.stringify(fall, null, 1));
  if (fall.outcome === "UNRESOLVED") assert.equal(fall.code, "UNRESOLVED_RECEIPT_VALUATION_ABSENT");
});

test("M1-F1E: a receipt valuation whose content seal is broken stays UNRESOLVED (tamper-evident independent binding)", () => {
  const tampered = { ...VAL_STANDARD, matchAmountMinor: 999999 }; // breaks the seal
  const fall = rechnungsabgleichFallZusammensetzenV1(baseInput({ receiptValuation: tampered }), PACK);
  assert.equal(fall.outcome, "UNRESOLVED", JSON.stringify(fall, null, 1));
  if (fall.outcome === "UNRESOLVED") assert.equal(fall.code, "UNRESOLVED_RECEIPT_VALUATION_ABSENT");
});

test("M1-F1I: unknown supplier identity (receipt attested under a supplier that does not close to the PO) stays UNRESOLVED, never reconstructed", () => {
  const fall = rechnungsabgleichFallZusammensetzenV1(baseInput({ receiptValuation: VAL_UNKNOWN_SUPPLIER }), PACK);
  assert.equal(fall.outcome, "UNRESOLVED", JSON.stringify(fall, null, 1));
  if (fall.outcome === "UNRESOLVED") assert.equal(fall.code, "UNRESOLVED_RECEIPT_VALUATION_ABSENT");
});

test("M1-F1J: a receipt valuation whose identity equals the PO reference is not independently bound (separate-reference rule) -> UNRESOLVED", () => {
  const fall = rechnungsabgleichFallZusammensetzenV1(baseInput({ receiptValuation: VAL_PO_IDENTITY }), PACK);
  assert.equal(fall.outcome, "UNRESOLVED", JSON.stringify(fall, null, 1));
  if (fall.outcome === "UNRESOLVED") assert.equal(fall.code, "UNRESOLVED_RECEIPT_VALUATION_ABSENT");
});

test("M1-F1H: closed counter-examples — over-receipt, unbound attestation, missing fact, unsealed source, non-frozen tolerance, PO supplier mismatch, foreign receipt ledger, over-bound quantity, stale read window — all fail closed", () => {
  const e = entwurf();
  // Over-receipt: the receipt entrypoint enforces the closed bound; a direct
  // 150 is DENIED at the entrypoint (the composition only ever sees <=100).
  const over = wareneingangErfassenV1(e, null, { eingangsId: "wareneingang:wg-over", bestellungId: e.bestellungId, positionId: "position:eink-001-01", einheit: "STK", menge: 150, zeitstempel: "2026-09-12T10:00:00Z", korrekturVon: null });
  assert.equal(over.outcome, "DENIED");
  if (over.outcome === "DENIED") assert.equal(over.code, "WARENEINGANG_OVER_RECEIPT_DENIED");
  // Reader-attestation not bound to the owned-read records: the factsDigest is
  // computed over DIFFERENT records than the owned read -> not closed -> DENIED.
  const unbound = rechnungsabgleichFallZusammensetzenV1(
    baseInput({ reader: { trust: "LOCAL_SYNTHETIC", sourceDatasetId: READER_EXPORT.lineage.sourceDatasetId, sourceDigest: READER_EXPORT.lineage.sourceDigest, factsDigest: readerFactsDigestV1([{ invoiceId: "invoice:tampered" }]) } }),
    PACK,
  );
  assert.equal(unbound.outcome, "DENIED");
  if (unbound.outcome === "DENIED") assert.equal(unbound.code, "FALL_READER_ATTESTATION_NOT_CLOSED");
  // No reader attestation at all is not closed -> DENIED.
  const noAttestation = rechnungsabgleichFallZusammensetzenV1(baseInput({ reader: undefined }), PACK);
  assert.equal(noAttestation.outcome, "DENIED");
  if (noAttestation.outcome === "DENIED") assert.equal(noAttestation.code, "FALL_READER_ATTESTATION_NOT_CLOSED");
  // Missing reader fact: the bound invoice is not in the owned-read records.
  const missingFact = rechnungsabgleichFallZusammensetzenV1(baseInput({ binding: { erpReadInvoiceId: "invoice:synthetic-999", poReferenceId: FROZEN_PO.body.referenceId, positionId: "position:eink-001-01", bestellungId: "bestellung:eink-001" } }), PACK);
  assert.equal(missingFact.outcome, "DENIED");
  if (missingFact.outcome === "DENIED") assert.equal(missingFact.code, "FALL_ERP_READ_FACT_MISSING");
  // A hand-crafted (unsealed) source cannot establish the reader chain: the
  // module re-reads through the retained reader over the SEALED source; a
  // caller-fabricated source fails the reader's closed self-seal.
  const handSource = { schemaVersion: "chimpmaera.connector/erp-supported-export/v1", exportId: "export:hand-made-001", tenantId: "tenant:synthetic-zoo", generatedAt: "2026-09-10T08:00:00Z", expiresAt: "2026-09-10T09:00:00Z", lineage: { sourceSystem: "SYNTHETIC_ERP", sourceDatasetId: "dataset:hand-001", extractionMode: "SUPPORTED_EXPORT", sourceDigest: "a".repeat(64) }, batches: [] };
  const handSourceFall = rechnungsabgleichFallZusammensetzenV1(baseInput({ erpReadSource: handSource }), PACK);
  assert.equal(handSourceFall.outcome, "DENIED");
  if (handSourceFall.outcome === "DENIED") assert.equal(handSourceFall.code, "FALL_ERP_READ_SOURCE_NOT_CLOSED");
  // Stale read window: the module's own owned read applies the reader's
  // freshness policy; a read timestamp past the export's expiresAt is refused.
  const stale = rechnungsabgleichFallZusammensetzenV1(baseInput({ erpReadNow: "2026-09-11T00:00:00Z" }), PACK);
  assert.equal(stale.outcome, "DENIED");
  if (stale.outcome === "DENIED") assert.equal(stale.code, "FALL_ERP_READ_SOURCE_NOT_CLOSED");
  // Tolerance variant not present in the frozen pack registry -> not closed.
  const unknownTolerance = rechnungsabgleichFallZusammensetzenV1(baseInput({ tolerancePolicy: { variantId: "INVENTED_V1", version: "9.9.9" } }), PACK);
  assert.equal(unknownTolerance.outcome, "DENIED");
  if (unknownTolerance.outcome === "DENIED") assert.equal(unknownTolerance.code, "FALL_TOLERANCE_VARIANT_NOT_FROZEN");
  // PO supplier mismatch.
  const poSupplierMismatch = rechnungsabgleichFallZusammensetzenV1(baseInput({ poReference: { ...FROZEN_PO, body: { ...FROZEN_PO.body, supplierId: "lieferant:other-999" } } }), PACK);
  assert.equal(poSupplierMismatch.outcome, "DENIED");
  if (poSupplierMismatch.outcome === "DENIED") assert.equal(poSupplierMismatch.code, "FALL_PO_SUPPLIER_MISMATCH");
  // Foreign receipt ledger (owned by another bestellung) is rejected before any read.
  const foreignLedger = realReceiptLedger(entwurf({ bestellungId: "bestellung:foreign-001" }), 100, "wareneingang:wg-foreign");
  const foreign = rechnungsabgleichFallZusammensetzenV1(baseInput({ receiptLedger: foreignLedger }), PACK);
  assert.equal(foreign.outcome, "DENIED");
  if (foreign.outcome === "DENIED") assert.equal(foreign.code, "FALL_RECEIPT_BESTELLUNG_MISMATCH");
  // Over-bound quantity on the ledger (hand-built ledger claiming 150 > 100).
  const overBound = { ...realReceiptLedger(e, 100, "wareneingang:wg-150"), eintraege: [{ eingangsId: "wareneingang:wg-150b", positionId: "position:eink-001-01", menge: 150, korrekturVon: null, ersetzt: false }], appliedEingangsIds: ["wareneingang:wg-150b"] };
  const overBoundFall = rechnungsabgleichFallZusammensetzenV1(baseInput({ receiptLedger: overBound }), PACK);
  assert.equal(overBoundFall.outcome, "DENIED");
  if (overBoundFall.outcome === "DENIED") assert.equal(overBoundFall.code, "FALL_RECEIPT_EXCEEDS_ORDERED");
});

test("M1-F1I0: a malformed (hand-crafted) bound position fails closed, not via a crash", () => {
  // position:malformed is not a closed position of the Entwurf -> FALL_POSITION_UNKNOWN.
  const malformed = rechnungsabgleichFallZusammensetzenV1(
    baseInput({ binding: { erpReadInvoiceId: "invoice:synthetic-101", poReferenceId: FROZEN_PO.body.referenceId, positionId: "position:malformed", bestellungId: "bestellung:eink-001" } }),
    PACK,
  );
  assert.equal(malformed.outcome, "DENIED");
  if (malformed.outcome === "DENIED") assert.equal(malformed.code, "FALL_POSITION_UNKNOWN");
});

test("M1-F1L (parent probe: missing-invoice-semantics): a FULL receipt (100 of 100) + independent sealed valuation with the M0-declared missing invoice supplier/quantity is NOT a decisive purchase match", () => {
  // The frozen M0 profile declares the erp-read source's supplierId and
  // quantity as losses. Even on a complete receipt with an independent sealed
  // valuation, the decisive purchase match must not be established from a PO
  // supplier identity and a quantity zero sentinel.
  const fall = rechnungsabgleichFallZusammensetzenV1(baseInput(), PACK);
  assert.equal(fall.outcome, "RECHNUNGSABGLEICH_FALL", JSON.stringify(fall, null, 1));
  if (fall.outcome !== "RECHNUNGSABGLEICH_FALL") throw new Error("unreachable");
  // No MATCHED decision exists: the real matcher was NOT run on incomplete
  // invoice-side evidence.
  assert.equal(fall.decision, null);
  assert.ok(!("MATCHED" in (fall as object)), "no MATCHED outcome may be carried");
  // The missing capability is explicit.
  assert.equal(fall.purchaseMatch.available, false);
  assert.equal(fall.purchaseMatch.reasonCode, "UNRESOLVED_INVOICE_EVIDENCE_INCOMPLETE");
  assert.equal(fall.quantities.invoicedMenge, null);
  assert.deepEqual(fall.declaredLossReasonCodes, ["COUNTERPARTY_IDENTITY_UNAVAILABLE", "QUANTITY_UNAVAILABLE"]);
  assert.equal(verifyRechnungsabgleichFallDigestV1(fall), true);
});

test("M1-F1M (parent probe: source-binding): caller-resealed altered facts with an unchanged source identity must not enter the comparison", () => {
  const input = baseInput();
  const originalDigest = (input.reader as { sourceDigest: string }).sourceDigest;
  const readbackRecords = (input.erpReadReadback as unknown as { records: Array<Record<string, unknown>> }).records;
  if (readbackRecords.length < 1) throw new Error("unreachable: no reader records");
  const originalAmount = (readbackRecords[0] as Record<string, unknown>).totalMinor as number;
  // The caller alters the reader record (totalMinor 2400 -> 2500) and
  // RESEALS: the readbackDigest and the attested factsDigest are rehashed over
  // the altered records, while the sourceDigest (the sealed source identity)
  // is kept. A self-consistent caller digest does not authenticate the source.
  const altered = readbackRecords.map((record, index) => (index === 0 ? { ...record, totalMinor: originalAmount + 100 } : record));
  const resealDigest = resealed({ entity: "invoices", records: altered, metadata: (input.erpReadReadback as { metadata: Record<string, unknown> }).metadata });
  const fall = rechnungsabgleichFallZusammensetzenV1(
    baseInput({
      erpReadReadback: { ...(input.erpReadReadback as object), records: altered, readbackDigest: resealDigest },
      reader: { ...(input.reader as object), factsDigest: readerFactsDigestV1(altered) },
    }),
    PACK,
  );
  // The sealed source identity is unchanged by the caller's re-sealing.
  assert.equal((input.reader as { sourceDigest: string }).sourceDigest, originalDigest);
  // The owned read over the sealed source no longer matches the supplied
  // readback -> the altered fact is NOT source-bound input.
  assert.equal(fall.outcome, "DENIED", JSON.stringify({ originalAmount, alteredAmount: (altered[0] as Record<string, unknown>).totalMinor, unchangedSourceDigest: originalDigest, fall }, null, 2));
  if (fall.outcome === "DENIED") assert.equal(fall.code, "FALL_READER_SOURCE_BINDING_NOT_CLOSED");
});

test("M1-F1N: the attestation must carry the SEALED source identity — a self-consistent but caller-chosen sourceDigest is not closed", () => {
  const forged = "b".repeat(64);
  const fall = rechnungsabgleichFallZusammensetzenV1(
    baseInput({ reader: { trust: "LOCAL_SYNTHETIC", sourceDatasetId: READER_EXPORT.lineage.sourceDatasetId, sourceDigest: forged, factsDigest: readerFactsDigestV1((baseInput().erpReadReadback as { records: readonly unknown[] }).records) } }),
    PACK,
  );
  assert.equal(fall.outcome, "DENIED");
  if (fall.outcome === "DENIED") assert.equal(fall.code, "FALL_READER_ATTESTATION_NOT_CLOSED");
});

test("M1-F1O: re-sealing with UNCHANGED content is accepted (content equivalence with the sealed source, not a self-consistent digest, is the authentication basis)", () => {
  // Recomputing the digests over the identical content yields the identical
  // closed values; the composition still requires equality with the owned read
  // over the sealed source.
  const input = baseInput();
  const readback = input.erpReadReadback as { records: readonly unknown[]; metadata: Record<string, unknown>; readbackDigest: string };
  const fall = rechnungsabgleichFallZusammensetzenV1(
    baseInput({
      erpReadReadback: { ...readback, readbackDigest: resealed({ entity: "invoices", records: readback.records, metadata: readback.metadata }) },
      reader: { trust: "LOCAL_SYNTHETIC", sourceDatasetId: READER_EXPORT.lineage.sourceDatasetId, sourceDigest: READER_EXPORT.lineage.sourceDigest, factsDigest: readerFactsDigestV1(readback.records) },
    }),
    PACK,
  );
  assert.equal(fall.outcome, "RECHNUNGSABGLEICH_FALL", JSON.stringify(fall, null, 1));
  if (fall.outcome !== "RECHNUNGSABGLEICH_FALL") throw new Error("unreachable");
  assert.equal(fall.decision, null);
  assert.equal(fall.purchaseMatch.available, false);
  assert.equal(verifyRechnungsabgleichFallDigestV1(fall), true);
});

test("M1-F1K: the composition names the real matching mode it serves, uses the real reader + receipt readback, and carries the M0 declared losses (no fabricated facts)", () => {
  const e = entwurf();
  const { readback, reader } = realReader();
  const ledger = realReceiptLedger(e, 100, "wareneingang:wg-mode");
  // The real receipt-entrypoint readback is the single source of the quantity.
  assert.equal(mengenzustandV1(e, ledger).angenommeneMenge, 100);
  const fall = rechnungsabgleichFallZusammensetzenV1(baseInput(), PACK);
  assert.equal(fall.outcome, "RECHNUNGSABGLEICH_FALL");
  if (fall.outcome !== "RECHNUNGSABGLEICH_FALL") throw new Error("unreachable");
  // The decisive purchase matching mode is named as the UNAVAILABLE
  // capability; the executed claim is the narrowed amount comparison.
  assert.equal(fall.purchaseMatch.mode, RECHNUNGSABGLEICH_MATCHING_MODE_V1);
  assert.equal(RECHNUNGSABGLEICH_MATCHING_MODE_V1, "THREE_WAY_INVOICE_PO_RECEIPT_V1");
  assert.equal(fall.purchaseMatch.available, false);
  assert.equal(fall.comparison, "INVOICE_PO_AMOUNT_ONLY_V1");
  // The invoiced line quantity is UNRESOLVED (null).
  assert.equal(fall.quantities.invoicedMenge, null);
  // The reader attestation is the REAL reader's LOCAL_SYNTHETIC lineage.
  assert.equal(reader.trust, "LOCAL_SYNTHETIC");
  assert.equal(reader.sourceDatasetId, READER_EXPORT.lineage.sourceDatasetId);
  // The frozen AP-04 pack identity is the reused consumer's pack.
  assert.equal(AP04_ERV_CASE_PACK_SHA256_V1.length, 64);
  // The owned readback digest is a closed sha256 over the read.
  assert.ok(/^[a-f0-9]{64}$/.test((readback as unknown as { readbackDigest: string }).readbackDigest));
});
