// PROC434-POSITIVE — real local program entry for the purchase normal path:
//   Bestellung -> Wareneingang -> Rechnungsabgleich (decisive three-way match).
//
// This is a DOCUMENTED, EXECUTABLE entry point (the AUFTRAG's "dokumentierter
// echter CLI-/Programmeinstieg"). It reuses the EXISTING, tested module
// implementations (the real entrypoints) — it does NOT reimplement the
// Fachkern:
//   * bestellungsentwurfBildenV1          (PO draft, real entrypoint)
//   * wareneingangLedgerBildenV1          (open per-position receipt ledger)
//   * wareneingangErfassenV1              (record a real goods receipt)
//   * createErpReadAdapterV1              (the retained erp-read reader)
//   * rechnungsabgleichMatchZusammensetzenV1  (the decisive three-way match,
//     which runs the F1 composition as its precondition, performs the
//     procurement-level quantity/identity reconciliation (R1) and RUNS the
//     reused ERV amount core under the verified frozen AP-04 pack (R2))
//
// The decisive match is grounded in ACTUAL, SEALED invoice evidence:
//   * the frozen AP-04 pack (SUPPLIER + PO references, content-sealed),
//     verified against its independently retained frozen identity BEFORE
//     evaluation (tolerance-policy bytes included, R2);
//   * the real erp-read reader fact (invoice:synthetic-101 totalMinor),
//   * the independent sealed goods-receipt valuation,
//   * the SEALED purchase-side supplier invoice line (invoice-line-v1.json) —
//     coherent with the frozen PO-2026-0001 source quantity and the accepted receipt (2/2/2),
//     admitted by the code-owned approved-source manifest (R2),
//   * the explicit PO-identity mapping (po-identity-mapping-v1.json) that
//     binds the local draft's supplier/article/order/position identities to
//     the closed PO evidence (R1).
//
// NO production dispatch or booking: the composition requests only
// READ_SYNTHETIC / WRITE_LOCAL_PROOF and the ERV core grants no booking
// authority. The result and a readable local proof record are written for
// readback (see rechnungsabgleich-path-cli.mjs). The local proof digest is a
// RECURSIVE canonical JSON digest over the whole proof record (R3) and the
// verifier RE-VERIFIES the embedded decisive-match digest at readback instead
// of trusting the stored boolean. A corrected proof digest is integrity
// evidence, not an independent source-authentication claim.
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { canonicalJson } from "../../dist/packages/contracts/src/canonical-json.js";
import {
  bestellungsentwurfBildenV1,
  wareneingangLedgerBildenV1,
  wareneingangErfassenV1,
} from "../../dist/packages/contracts/src/beschaffung-wareneingang-v1.js";
import { createErpReadAdapterV1 } from "../../dist/packages/contracts/src/erp-read-connector.js";
import { readerFactsDigestV1 } from "../../dist/packages/contracts/src/rechnungsabgleich-v1.js";
import {
  rechnungsabgleichMatchZusammensetzenV1,
  verifyRechnungsabgleichMatchDigestV1,
} from "../../dist/packages/contracts/src/rechnungsabgleich-match-v1.js";

// The closed synthetic read timestamp: inside the reader's freshness window
// (export generatedAt 08:00Z, expiresAt 09:00Z, maxAgeSeconds 3600). It is a
// fixed closed value, NOT the wall clock, so the path is deterministic.
export const PROC434_READ_NOW_V1 = "2026-09-10T08:30:00Z";
// The closed goods-receipt timestamp.
export const PROC434_RECEIPT_NOW_V1 = "2026-09-12T10:00:00Z";
// The fixed normal-path identities (closed, synthetic).
export const PROC434_POSITION_ID_V1 = "position:eink-001-01";
export const PROC434_BESTELLUNG_ID_V1 = "bestellung:eink-001";
export const PROC434_EINGANGS_ID_V1 = "wareneingang:wg-eink-001";
export const PROC434_INVOICE_ID_V1 = "invoice:synthetic-101";
export const PROC434_LOCAL_PROOF_SCHEMA_V1 = "cm.proc434/local-proof/v1";
export const PROC434_CASE_ID_V1 = `proc434:${PROC434_BESTELLUNG_ID_V1}:${PROC434_POSITION_ID_V1}`;

// R3: RECURSIVE canonical JSON digest (the repository's canonical
// serialization, shared with the contracts). It covers nested result /
// provenance / authority content exactly as read back — the previous
// top-level-key JSON.stringify dropped nested fields from the hashed
// representation.
const sha = (value) => createHash("sha256").update(canonicalJson(value), "utf8").digest("hex");

/** Load the real reused fixtures (relative to the repository root). */
export function loadProc434Fixtures(rootDir, fixtureRoot) {
  const base = `${rootDir}/${fixtureRoot}`;
  const read = (p) => JSON.parse(readFileSync(`${base}/${p}`, "utf8"));
  return {
    pack: read("tests/fixtures/incoming-invoice/ap-04-erv-cases-v1.json"),
    readerContract: read("tests/fixtures/erp-read/contract-v1.json"),
    readerExport: read("tests/fixtures/erp-read/matched-export-v1.json"),
    receiptValuation: read("tests/fixtures/incoming-invoice/receipt-valuation-v1.json"),
    invoiceLine: read("tests/fixtures/incoming-invoice/invoice-line-v1.json"),
    poIdentityMapping: read("tests/fixtures/procurement-434/po-identity-mapping-v1.json"),
    approvedSources: read("tests/fixtures/procurement-434/approved-sources-v1.json"),
  };
}

/** Run the real PO draft entrypoint (the closed purchase order). */
export function buildProc434PoV1() {
  const result = bestellungsentwurfBildenV1({
    bestellungId: PROC434_BESTELLUNG_ID_V1,
    lieferantId: "lieferant:metall-001",
    bestellungZeitstempel: "2026-09-10T08:00:00Z",
    positionen: [
            // The ordered quantity equals the frozen PO-2026-0001 SOURCE quantity (2): the
      // positive path is quantity-coherent with the frozen PO, not merely identity-mapped.
      // No unit conversion or amount rewriting — the closed amount stays 2400 EUR minor.
      { positionId: PROC434_POSITION_ID_V1, artikelId: "EINK-ART-001", einheit: "STK", waehrung: "EUR", bestellteMenge: 2, berechneteMengeMinor: null },
    ],
  });
  if (result.outcome !== "ENTWURF") return { ok: false, code: result.code, detail: "the PO draft entrypoint did not close" };
  return { ok: true, entwurf: result.entwurf };
}

/** Run the real goods-receipt entrypoints (open the ledger, record the receipt). */
export function recordProc434GoodsReceiptV1(entwurf, menge, eingangsId) {
  const opened = wareneingangLedgerBildenV1(entwurf, PROC434_POSITION_ID_V1);
  if (opened.outcome !== "LEDGER") return { ok: false, code: opened.code, detail: "could not open the receipt ledger" };
  if (menge < 1) return { ok: true, ledger: opened.ledger, adopted: 0 };
  const applied = wareneingangErfassenV1(entwurf, opened.ledger, {
    eingangsId, bestellungId: entwurf.bestellungId, positionId: PROC434_POSITION_ID_V1, einheit: "STK", menge, zeitstempel: PROC434_RECEIPT_NOW_V1, korrekturVon: null,
  });
  if (applied.outcome !== "WARENEINGANG_ERFASST") return { ok: false, code: applied.code, detail: "the goods-receipt entrypoint denied the receipt" };
  return { ok: true, ledger: applied.ledger, adopted: menge };
}

/** Run the real retained erp-read reader over the sealed matched export. */
export function runProc434ReaderV1(readerContract, readerExport, now) {
  const adapter = createErpReadAdapterV1({ contract: readerContract, source: readerExport, enabled: true, now });
  const readback = adapter({ operation: "LIST_INVOICES", tenantId: readerContract.tenantId, principalId: readerContract.identity.principalId, scopes: readerContract.identity.scopes, credentialPresent: true, fields: readerContract.fields.invoices, pageSize: readerContract.policy.maxPageSize });
  if (readback.outcome !== "READ") return { ok: false, code: readback.code, detail: "the retained erp-read reader refused the read" };
  const reader = { trust: "LOCAL_SYNTHETIC", sourceDatasetId: readback.metadata.sourceDatasetId, sourceDigest: readback.metadata.sourceDigest, factsDigest: readerFactsDigestV1(readback.records) };
  return { ok: true, readback, reader };
}

/**
 * Run the decisive three-way purchase match (the F1 composition as
 * precondition + the R1 quantity/identity reconciliation + the reused ERV
 * amount core under the verified frozen AP-04 pack). Returns the closed
 * decisive-match outcome. This is the ACTUAL invoice match.
 */
export function buildProc434DecisiveMatchInputV1({ fixtures, entwurf, ledger, readback, reader }) {
  const frozen = fixtures.pack.cases.find((c) => c.caseId === "two-way-matched-strict");
  if (!frozen) return null;
  const supplierReference = frozen.references.find((r) => r.body.referenceKind === "SUPPLIER");
  const poReference = frozen.references.find((r) => r.body.referenceKind === "PURCHASE_ORDER");
  return {
    erpReadSource: fixtures.readerExport,
    erpReadContract: fixtures.readerContract,
    erpReadNow: PROC434_READ_NOW_V1,
    erpReadReadback: readback,
    reader,
    entwurf,
    binding: { erpReadInvoiceId: PROC434_INVOICE_ID_V1, poReferenceId: poReference.body.referenceId, positionId: PROC434_POSITION_ID_V1, bestellungId: PROC434_BESTELLUNG_ID_V1 },
    receiptLedger: ledger,
    receiptValuation: fixtures.receiptValuation,
    supplierReference,
    poReference,
    tolerancePolicy: { variantId: "STRICT_ZERO_V1", version: "1.0.0" },
    invoiceLine: fixtures.invoiceLine,
    poIdentityMapping: fixtures.poIdentityMapping,
    approvedSources: fixtures.approvedSources,
  };
}

export function runProc434DecisiveMatchV1({ fixtures, entwurf, ledger, readback, reader }) {
  const input = buildProc434DecisiveMatchInputV1({ fixtures, entwurf, ledger, readback, reader });
  if (input === null) return { outcome: "DENIED", code: "PROC434_FROZEN_CASE_MISSING", detail: "the frozen AP-04 two-way-matched-strict case is missing" };
  return rechnungsabgleichMatchZusammensetzenV1(input, fixtures.pack);
}

/**
 * Run the full PROC434-POSITIVE normal path (PO -> goods receipt -> decisive
 * invoice match) and return the closed, readable result plus its provenance.
 * No production dispatch or booking: READ_SYNTHETIC / WRITE_LOCAL_PROOF only.
 */
export function runProc434NormalPathV1({ rootDir, fixtureRoot, now = PROC434_READ_NOW_V1 } = {}) {
  const fixtures = loadProc434Fixtures(rootDir, fixtureRoot ?? "");
  const po = buildProc434PoV1();
  if (!po.ok) return { outcome: "DENIED", code: po.code, detail: po.detail };
  // The accepted goods receipt is FULL: it receives the frozen PO source quantity (2),
  // coherent with the bound position; the closed amount stays 2400 minor (unchanged).
  const receipt = recordProc434GoodsReceiptV1(po.entwurf, 2, PROC434_EINGANGS_ID_V1);
  if (!receipt.ok) return { outcome: "DENIED", code: receipt.code, detail: receipt.detail };
  const read = runProc434ReaderV1(fixtures.readerContract, fixtures.readerExport, now);
  if (!read.ok) return { outcome: "DENIED", code: read.code, detail: read.detail };
  const result = runProc434DecisiveMatchV1({ fixtures, entwurf: po.entwurf, ledger: receipt.ledger, readback: read.readback, reader: read.reader });
  if (result.outcome !== "RECHNUNGSABGLEICH_MATCH") return result;
  // The decisive match is re-readable: its closed matchDigest verifies against
  // its own content (re-verified at readback, R3 — the persisted boolean is NOT
  // trusted on its own). The local proof digest is a RECURSIVE canonical digest
  // over the deterministic proof core (R3). The ap04Pack provenance is the
  // ACTUAL verified pack identity (the checked bytes, R2).
  const proofCore = {
    schemaVersion: PROC434_LOCAL_PROOF_SCHEMA_V1,
    caseId: PROC434_CASE_ID_V1,
    result,
    provenance: {
      ap04Pack: { sha256: result.ap04Pack.sha256, canonicalSha256: result.ap04Pack.canonicalSha256 },
      sourceDatasetId: result.source.sourceDatasetId,
      sourceDigest: result.source.sourceDigest,
      readbackDigest: result.source.readbackDigest,
      invoiceLineSeal: result.invoiceLine.contentSha256,
      invoiceLineLocator: result.invoiceLine.locator,
      invoiceLineGenerator: result.invoiceLine.generator,
      readerAttestation: { trust: read.reader.trust, factsDigest: read.reader.factsDigest },
    },
    authority: { productivePostingAuthorized: false, bookingAuthorityGranted: false, riskDCapability: "SEPARATELY_AUTHORIZED" },
    nonclaims: [
      "NO_CUSTOMER_DATA_EVALUATED",
      "NO_EXTERNAL_PROVIDER_EVALUATED",
      "NO_PRODUCTIVE_ALLOCATION_OR_POSTING_AUTHORIZED",
      "NO_BOOKING_AUTHORITY_GRANTED",
      "NO_LIVE_ERP_SYSTEM_CLAIM",
      "PROOF_DIGEST_IS_INTEGRITY_EVIDENCE_NOT_INDEPENDENT_SOURCE_AUTHENTICATION",
    ],
  };
  // The embedded decisive-match digest is re-verified at proof assembly from
  // the result content (not taken from a stored boolean).
  proofCore.resultDigestVerified = verifyRechnungsabgleichMatchDigestV1(result);
  const proofDigest = sha(proofCore);
  return { ...proofCore, proofDigest };
}

/**
 * Verify a local proof record's closed digest against its content (R3):
 *   - the proofDigest must close over the RECURSIVE canonical form of the
 *     whole deterministic core (nested result / provenance / authority
 *     tampering changes the digest);
 *   - the embedded decisive-match digest is RE-VERIFIED at readback from the
 *     result content; the persisted resultDigestVerified boolean is checked
 *     against the fresh verification, never trusted on its own.
 */
export function verifyProc434LocalProofV1(value) {
  if (value === null || typeof value !== "object") return false;
  const { proofDigest, ...core } = value;
  if (typeof proofDigest !== "string") return false;
  if (proofDigest !== sha(core)) return false;
  if (core.schemaVersion !== PROC434_LOCAL_PROOF_SCHEMA_V1) return false;
  if (core.result === null || typeof core.result !== "object") return false;
  const fresh = verifyRechnungsabgleichMatchDigestV1(core.result);
  if (!fresh) return false;
  return core.resultDigestVerified === fresh;
}

/**
 * Persist the closed, re-readable local result/proof record to disk (the
 * AUFTRAG's "lokaler Zustand ... nachlesbar"). Writes the deterministic proof
 * record as pretty JSON and returns the absolute path. Creating the state file
 * is a local, non-productive write (WRITE_LOCAL_PROOF); it never dispatches or
 * books anything.
 */
export function writeProc434StateV1(result, filePath) {
  if (!filePath || typeof filePath !== "string") {
    throw new Error("writeProc434StateV1: filePath must be a non-empty string");
  }
  const abs = path.resolve(filePath);
  mkdirSync(path.dirname(abs), { recursive: true });
  writeFileSync(abs, JSON.stringify(result, null, 2) + "\n", "utf8");
  return abs;
}
