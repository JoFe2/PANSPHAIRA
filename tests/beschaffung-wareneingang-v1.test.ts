import assert from "node:assert/strict";
import test from "node:test";
import {
  bestellungsentwurfBildenV1,
  mengenzustandV1,
  rechnungsabgleichFertigkeitV1,
  wareneingangErfassenV1,
  type BestellentwurfV1,
  type WareneingangLedgerV1,
  wareneingangLedgerBildenV1,
} from "../packages/contracts/src/beschaffung-wareneingang-v1.js";

function entwurf(input: Record<string, unknown> = {}): BestellentwurfV1 {
  const result = bestellungsentwurfBildenV1({
    bestellungId: "bestellung:eink-001",
    lieferantId: "lieferant:metall-001",
    bestellungZeitstempel: "2026-09-10T08:00:00Z",
    positionen: [
      { positionId: "position:eink-001-01", artikelId: "EINK-ART-001", einheit: "STK", waehrung: "EUR", bestellteMenge: 100, berechneteMengeMinor: null },
      { positionId: "position:eink-001-02", artikelId: "EINK-ART-002", einheit: "PAAR", waehrung: "EUR", bestellteMenge: 10, berechneteMengeMinor: null },
    ],
    ...input,
  });
  assert.equal(result.outcome, "ENTWURF", `expected ENTWURF, got ${JSON.stringify(result)}`);
  if (result.outcome !== "ENTWURF") throw new Error("unreachable");
  return result.entwurf;
}

function eingang(bestellungId: string, positionId: string, einheit: string, menge: number, eingangsId: string, korrekturVon: string | null = null) {
  return { schemaVersion: "cm.fachprofil/wareneingang/v1", eingangsId, bestellungId, positionId, einheit, menge, zeitstempel: "2026-09-12T10:00:00Z", korrekturVon };
}

test("M1S2-AC1: Normalfall — a full Wareneingang adopts the position, separates bestellte/angenommene, readbacks, and enables reconciliation", () => {
  const e = entwurf();
  const r = wareneingangErfassenV1(e, null, eingang(e.bestellungId, "position:eink-001-01", "STK", 100, "wareneingang:wg-001"));
  assert.equal(r.outcome, "WARENEINGANG_ERFASST");
  if (r.outcome !== "WARENEINGANG_ERFASST") throw new Error("unreachable");
  assert.equal(r.position.bestellteMenge, 100);
  assert.equal(r.position.angenommeneMenge, 100);
  assert.equal(r.position.berechneteMengeMinor, null); // separate concept, still un-set by the receipt
  assert.equal(r.ledger.eintraege.length, 1);
  assert.deepEqual(r.ledger.appliedEingangsIds, ["wareneingang:wg-001"]);
  assert.notEqual(r.afterDigest, r.beforeDigest);
  // the readback ledger carries the separated quantity concepts
  const zustand = mengenzustandV1(e, r.ledger);
  assert.equal(zustand.bestellteMenge, 100);
  assert.equal(zustand.angenommeneMenge, 100);
  // reconciliation eligibility is GREEN on the closed quantity dimension
  const fert = rechnungsabgleichFertigkeitV1({ positionId: r.position.positionId, bestellteMenge: 100, einheit: "STK", waehrung: "EUR" }, 100);
  assert.equal(fert.outcome, "ABGLEICH_FERTIGKEIT");
});

test("M1S2-AC2: Teilmenge — a partial receipt leaves bestellte > angenommene; a second partial receipt completes it", () => {
  const e = entwurf();
  const first = wareneingangErfassenV1(e, null, eingang(e.bestellungId, "position:eink-001-01", "STK", 40, "wareneingang:wg-010"));
  assert.equal(first.outcome, "WARENEINGANG_ERFASST");
  if (first.outcome !== "WARENEINGANG_ERFASST") throw new Error("unreachable");
  assert.equal(first.position.angenommeneMenge, 40);
  assert.ok(first.position.angenommeneMenge < first.position.bestellteMenge);
  const second = wareneingangErfassenV1(e, first.ledger, eingang(e.bestellungId, "position:eink-001-01", "STK", 60, "wareneingang:wg-011"));
  assert.equal(second.outcome, "WARENEINGANG_ERFASST");
  if (second.outcome !== "WARENEINGANG_ERFASST") throw new Error("unreachable");
  assert.equal(second.position.angenommeneMenge, 100);
  assert.equal(second.position.angenommeneMenge, second.position.bestellteMenge);
  // partial-set reconciliation eligibility: 40 < 100 is still eligible (reconcile the adopted part)
  const partFert = rechnungsabgleichFertigkeitV1({ positionId: "position:eink-001-01", bestellteMenge: 100, einheit: "STK", waehrung: "EUR" }, 40);
  assert.equal(partFert.outcome, "ABGLEICH_FERTIGKEIT");
});

test("M1S2-AC3: Korrekturbezug — a correction references the prior eingangsId and replaces it (net new − old), not a blind second write", () => {
  const e = entwurf();
  const first = wareneingangErfassenV1(e, null, eingang(e.bestellungId, "position:eink-001-02", "PAAR", 8, "wareneingang:wg-020"));
  assert.equal(first.outcome, "WARENEINGANG_ERFASST");
  if (first.outcome !== "WARENEINGANG_ERFASST") throw new Error("unreachable");
  // correction: the 8 PAAR were wrong, actually 6
  const korrektur = wareneingangErfassenV1(e, first.ledger, eingang(e.bestellungId, "position:eink-001-02", "PAAR", 6, "wareneingang:wg-021", "wareneingang:wg-020"));
  assert.equal(korrektur.outcome, "WARENEINGANG_ERFASST");
  if (korrektur.outcome !== "WARENEINGANG_ERFASST") throw new Error("unreachable");
  assert.equal(korrektur.position.angenommeneMenge, 6);
  // the ledger records both the superseded event and the correction (verlauf)
  const superseded = korrektur.ledger.eintraege.find((t) => t.eingangsId === "wareneingang:wg-020");
  assert.equal(superseded?.ersetzt, true);
  const effective = korrektur.ledger.eintraege.find((t) => t.eingangsId === "wareneingang:wg-021");
  assert.equal(effective?.ersetzt, false);
  // correcting an already-superseded event is denied
  const bad = wareneingangErfassenV1(e, korrektur.ledger, eingang(e.bestellungId, "position:eink-001-02", "PAAR", 5, "wareneingang:wg-022", "wareneingang:wg-020"));
  assert.equal(bad.outcome, "DENIED");
  if (bad.outcome === "DENIED") assert.equal(bad.code, "WARENEINGANG_KORREKTUR_REF_NOT_ERSETZBAR");
});

test("M1S2-AC4: Doppelereignis — a replayed eingangsId is a closed denial (no blind re-write)", () => {
  const e = entwurf();
  const first = wareneingangErfassenV1(e, null, eingang(e.bestellungId, "position:eink-001-01", "STK", 30, "wareneingang:wg-030"));
  assert.equal(first.outcome, "WARENEINGANG_ERFASST");
  if (first.outcome !== "WARENEINGANG_ERFASST") throw new Error("unreachable");
  const replay = wareneingangErfassenV1(e, first.ledger, eingang(e.bestellungId, "position:eink-001-01", "STK", 30, "wareneingang:wg-030"));
  assert.equal(replay.outcome, "DENIED");
  if (replay.outcome === "DENIED") assert.equal(replay.code, "WARENEINGANG_REPLAY_DENIED");
});

test("M1S2-AC5: counter-examples — falsche Einheit, fehlende Relation, Over-Receipt, non-closed tokens, doppelte Position im Entwurf — all fail closed", () => {
  const e = entwurf();
  // falsche Einheit
  const unit = wareneingangErfassenV1(e, null, eingang(e.bestellungId, "position:eink-001-01", "KG", 5, "wareneingang:wg-040"));
  assert.equal(unit.outcome, "DENIED");
  if (unit.outcome === "DENIED") assert.equal(unit.code, "WARENEINGANG_UNIT_MISMATCH");
  // fehlende Relation (position not in the Entwurf)
  const missing = wareneingangErfassenV1(e, null, eingang(e.bestellungId, "position:eink-999", "STK", 5, "wareneingang:wg-041"));
  assert.equal(missing.outcome, "DENIED");
  if (missing.outcome === "DENIED") assert.equal(missing.code, "WARENEINGANG_POSITION_UNKNOWN");
  // Over-Receipt
  const over = wareneingangErfassenV1(e, null, eingang(e.bestellungId, "position:eink-001-01", "STK", 101, "wareneingang:wg-042"));
  assert.equal(over.outcome, "DENIED");
  if (over.outcome === "DENIED") assert.equal(over.code, "WARENEINGANG_OVER_RECEIPT_DENIED");
  // non-closed eingangsId
  const id = wareneingangErfassenV1(e, null, eingang(e.bestellungId, "position:eink-001-01", "STK", 5, "wg-043"));
  assert.equal(id.outcome, "DENIED");
  if (id.outcome === "DENIED") assert.equal(id.code, "WARENEINGANG_ID_NOT_CLOSED");
  // correction referencing an unknown event
  const first = wareneingangErfassenV1(e, null, eingang(e.bestellungId, "position:eink-001-01", "STK", 10, "wareneingang:wg-044"));
  if (first.outcome !== "WARENEINGANG_ERFASST") throw new Error("unreachable");
  const unknownRef = wareneingangErfassenV1(e, first.ledger, eingang(e.bestellungId, "position:eink-001-01", "STK", 5, "wareneingang:wg-045", "wareneingang:does-not-exist"));
  assert.equal(unknownRef.outcome, "DENIED");
  if (unknownRef.outcome === "DENIED") assert.equal(unknownRef.code, "WARENEINGANG_KORREKTUR_REF_UNKNOWN");
  // duplicate position identity in the Entwurf
  const dup = bestellungsentwurfBildenV1({
    bestellungId: "bestellung:eink-dup",
    lieferantId: "lieferant:metall-001",
    bestellungZeitstempel: "2026-09-10T08:00:00Z",
    positionen: [
      { positionId: "position:eink-dup-01", artikelId: "EINK-ART-001", einheit: "STK", waehrung: "EUR", bestellteMenge: 10, berechneteMengeMinor: null },
      { positionId: "position:eink-dup-01", artikelId: "EINK-ART-002", einheit: "STK", waehrung: "EUR", bestellteMenge: 5, berechneteMengeMinor: null },
    ],
  });
  assert.equal(dup.outcome, "DENIED");
  if (dup.outcome === "DENIED") assert.equal(dup.code, "POSITION_ID_DUPLICATE");
});

test("M1S2-AC6: second data profile (independent lieferant/artikel/unit/currency) runs the unchanged core; reconciliation blocks on unknown currency / no receipt", () => {
  const second = bestellungsentwurfBildenV1({
    bestellungId: "bestellung:eink-777",
    lieferantId: "lieferant:plastik-777",
    bestellungZeitstempel: "2026-09-11T09:00:00Z",
    positionen: [
      { positionId: "position:eink-777-01", artikelId: "EINK-ART-777", einheit: "M", waehrung: "USD", bestellteMenge: 500, berechneteMengeMinor: null },
    ],
  });
  assert.equal(second.outcome, "ENTWURF");
  if (second.outcome !== "ENTWURF") throw new Error("unreachable");
  const e2 = second.entwurf;
  const r = wareneingangErfassenV1(e2, null, eingang(e2.bestellungId, "position:eink-777-01", "M", 250, "wareneingang:wg-770"));
  assert.equal(r.outcome, "WARENEINGANG_ERFASST");
  if (r.outcome !== "WARENEINGANG_ERFASST") throw new Error("unreachable");
  assert.equal(r.position.angenommeneMenge, 250);
  assert.equal(r.position.einheit, "M");
  assert.equal(r.position.waehrung, "USD");
  // reconciliation eligibility for the closed USD dimension
  const fert = rechnungsabgleichFertigkeitV1({ positionId: "position:eink-777-01", bestellteMenge: 500, einheit: "M", waehrung: "USD" }, 250);
  assert.equal(fert.outcome, "ABGLEICH_FERTIGKEIT");
  // reconciliation blocks on no receipt
  const noReceipt = rechnungsabgleichFertigkeitV1({ positionId: "position:eink-777-01", bestellteMenge: 500, einheit: "M", waehrung: "USD" }, 0);
  assert.equal(noReceipt.outcome, "ABGLEICH_BLOCKED");
  if (noReceipt.outcome === "ABGLEICH_BLOCKED") assert.equal(noReceipt.code, "NO_RECEIPT");
  // reconciliation blocks on an unknown (non-closed) currency
  const badCurrency = rechnungsabgleichFertigkeitV1({ positionId: "position:eink-777-01", bestellteMenge: 500, einheit: "M", waehrung: "euro" }, 250);
  assert.equal(badCurrency.outcome, "ABGLEICH_BLOCKED");
  if (badCurrency.outcome === "ABGLEICH_BLOCKED") assert.equal(badCurrency.code, "CURRENCY_UNKNOWN");
});

// F2 regression (review probe P2, RED->GREEN): a foreign Wareneingang ledger
// must never contaminate accepted quantities. The review candidate accepted A's
// returned ledger while receiving for B, relabeled it as order B and reported
// 50 received (40 of A's + 10 of B's) with only the identical local positionId
// as the "binding". No forged digest or malformed object was needed.
function entwurfId(bestellungId: string): BestellentwurfV1 {
  const r = bestellungsentwurfBildenV1({
    bestellungId,
    lieferantId: "lieferant:metall-001",
    bestellungZeitstempel: "2026-09-10T08:00:00Z",
    positionen: [{ positionId: "position:shared", artikelId: "EINK-ART-001", einheit: "STK", waehrung: "EUR", bestellteMenge: 100, berechneteMengeMinor: null }],
  });
  assert.equal(r.outcome, "ENTWURF");
  if (r.outcome !== "ENTWURF") throw new Error("unreachable");
  return r.entwurf;
}

test("M1S2-F2A: foreign-ledger isolation — an identical local positionId in a different order is a different closed identity (probe P2)", () => {
  const A = entwurfId("bestellung:aaa");
  const B = entwurfId("bestellung:bbb");
  const recA = wareneingangErfassenV1(A, null, eingang(A.bestellungId, "position:shared", "STK", 40, "wareneingang:a10"));
  assert.equal(recA.outcome, "WARENEINGANG_ERFASST");
  if (recA.outcome !== "WARENEINGANG_ERFASST") throw new Error("unreachable");
  // Receiving for B while passing A's returned ledger must be a closed denial
  // BEFORE any entry is read, appended or resolved.
  const foreign = wareneingangErfassenV1(B, recA.ledger, eingang(B.bestellungId, "position:shared", "STK", 10, "wareneingang:b10"));
  assert.equal(foreign.outcome, "DENIED");
  if (foreign.outcome === "DENIED") assert.equal(foreign.code, "WARENEINGANG_LEDGER_FOREIGN_BESTELLUNG");
  // B's readback with the foreign ledger reports 0 — A's 40 are never
  // counted for B.
  const bState = mengenzustandV1(B, recA.ledger);
  assert.equal(bState.positionId, "position:shared");
  assert.equal(bState.angenommeneMenge, 0);
  // B's own (empty) ledger path still works and stays isolated.
  const own = wareneingangLedgerBildenV1(B, "position:shared");
  assert.equal(own.outcome, "LEDGER");
  if (own.outcome !== "LEDGER") throw new Error("unreachable");
  const recB = wareneingangErfassenV1(B, own.ledger, eingang(B.bestellungId, "position:shared", "STK", 10, "wareneingang:b10"));
  assert.equal(recB.outcome, "WARENEINGANG_ERFASST");
  if (recB.outcome !== "WARENEINGANG_ERFASST") throw new Error("unreachable");
  assert.equal(recB.ledger.bestellungId, "bestellung:bbb");
  assert.equal(recB.ledger.eintraege.length, 1);
  assert.equal(recB.position.angenommeneMenge, 10);
  // A's ledger is untouched by B's path (no cross-order mutation).
  assert.equal(mengenzustandV1(A, recA.ledger).angenommeneMenge, 40);
});

test("M1S2-F2B: foreign-ledger isolation — different position and different unit ownership are closed denials", () => {
  const e = entwurf();
  // open a ledger for the FIRST position, then receive for the SECOND
  const first = wareneingangLedgerBildenV1(e, "position:eink-001-01");
  assert.equal(first.outcome, "LEDGER");
  if (first.outcome !== "LEDGER") throw new Error("unreachable");
  const crossPosition = wareneingangErfassenV1(e, first.ledger, eingang(e.bestellungId, "position:eink-001-02", "STK", 5, "wareneingang:f21"));
  assert.equal(crossPosition.outcome, "DENIED");
  if (crossPosition.outcome === "DENIED") assert.equal(crossPosition.code, "WARENEINGANG_LEDGER_FOREIGN_POSITION");
  // same position, but a ledger whose unit does not match the position
  const unitLedger: WareneingangLedgerV1 = {
    schemaVersion: "cm.fachprofil/wareneingang-ledger/v1",
    bestellungId: e.bestellungId,
    positionId: "position:eink-001-01",
    einheit: "KG",
    eintraege: [],
    appliedEingangsIds: [],
  };
  const crossUnit = wareneingangErfassenV1(e, unitLedger, eingang(e.bestellungId, "position:eink-001-01", "STK", 5, "wareneingang:f22"));
  assert.equal(crossUnit.outcome, "DENIED");
  if (crossUnit.outcome === "DENIED") assert.equal(crossUnit.code, "WARENEINGANG_LEDGER_UNIT_MISMATCH");
  // an opened ledger for an unknown position is denied
  const unknown = wareneingangLedgerBildenV1(e, "position:eink-999");
  assert.equal(unknown.outcome, "DENIED");
  if (unknown.outcome === "DENIED") assert.equal(unknown.code, "WARENEINGANG_LEDGER_POSITION_UNKNOWN");
  // mengenzustand never reports a foreign ledger's quantities
  assert.equal(mengenzustandV1(e, unitLedger).angenommeneMenge, 0);
});
