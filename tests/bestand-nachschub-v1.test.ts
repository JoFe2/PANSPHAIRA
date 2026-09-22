import assert from "node:assert/strict";
import test from "node:test";
import {
  BESTAND_UNIT_V1,
  bestandslageBerechnenV1,
  bestandAenderungAnwendenV1,
  nachschubEntscheidenV1,
  bestandsfrischeBewertenV1,
  nachschubEntscheidenFrischeV1,
  wareneingangZuBestandsaenderungV1,
  verfuegbarVonV1,
  verifyBestandslageDigestV1,
  BESTAND_MAX_QUANTITY_V1,
  type BestandslageV1,
  type BestandsFrischePolitikV1,
} from "../packages/contracts/src/bestand-nachschub-v1.js";
import {
  bestellungsentwurfBildenV1,
  wareneingangErfassenV1,
} from "../packages/contracts/src/beschaffung-wareneingang-v1.js";

function lage1() {
  const result = bestandslageBerechnenV1([
    { artikelId: "SYN-ART-001", lagerortId: "LAGER-01", einheit: "STK", physisch: 100, reserviert: 20 },
    { artikelId: "SYN-ART-002", lagerortId: "LAGER-01", einheit: "STK", physisch: 10, reserviert: 0 },
  ]);
  assert.equal(result.outcome, "LAGE");
  if (result.outcome !== "LAGE") throw new Error("unreachable");
  return result.lage;
}

test("M3-AC1: a Bestandslage separates physisch/reserviert, derives verfuegbar, and digest-verifies", () => {
  const lage = lage1();
  assert.equal(lage.schemaVersion, "cm.fachprofil/bestand/v1");
  assert.equal(BESTAND_UNIT_V1, "STK");
  const p1 = lage.positions[0];
  if (p1 === undefined) throw new Error("expected first position");
  assert.equal(p1.physisch, 100);
  assert.equal(p1.reserviert, 20);
  assert.equal(verfuegbarVonV1(p1), 80);
  // the closed invariant: reserviert <= physisch for every position
  for (const p of lage.positions) assert.ok(p.reserviert <= p.physisch);
  assert.equal(verifyBestandslageDigestV1(lage), true);
  // a tampered digest fails closed
  assert.equal(verifyBestandslageDigestV1({ ...lage, positions: [{ ...p1, physisch: 999 }] }), false);
});

test("M3-AC2: a versioned EINKUNFT change applies with readback; a replayed change is a closed denial (no double write)", () => {
  const lage = lage1();
  const aenderung = {
    schemaVersion: "cm.fachprofil/bestand-aenderung/v1",
    aenderungsId: "aenderung:bestand-einkunft-001",
    artikelId: "SYN-ART-001",
    lagerortId: "LAGER-01",
    einheit: "STK",
    art: "EINKUNFT",
    menge: 30,
    zeitstempel: "2026-09-21T06:00:00Z",
  };
  const applied = bestandAenderungAnwendenV1(lage, aenderung, []);
  assert.equal(applied.outcome, "GEAENDERT");
  if (applied.outcome !== "GEAENDERT") throw new Error("unreachable");
  const after = applied.lage.lage.positions.find((p) => p.artikelId === "SYN-ART-001");
  assert.equal(after?.physisch, 130);
  assert.equal(after?.reserviert, 20);
  assert.equal(applied.afterDigest, applied.lage.lage.lageDigest);
  assert.notEqual(applied.afterDigest, applied.beforeDigest);
  assert.deepEqual(applied.lage.appliedAenderungsIds, ["aenderung:bestand-einkunft-001"]);
  // replay: the same versioned change must be denied by the dedup ledger
  const replay = bestandAenderungAnwendenV1(applied.lage.lage, aenderung, applied.lage.appliedAenderungsIds);
  assert.equal(replay.outcome, "DENIED");
  if (replay.outcome === "DENIED") assert.equal(replay.code, "AENDERUNG_REPLAY_DENIED");
});

test("M3-AC3: counter-examples — insufficient available for VERAUSGABE/RESERVIERUNG, unknown position, unknown art, non-closed tokens, invariant violation — all fail closed", () => {
  const lage = lage1();
  const base = {
    schemaVersion: "cm.fachprofil/bestand-aenderung/v1",
    aenderungsId: "aenderung:bestand-x-001",
    artikelId: "SYN-ART-001",
    lagerortId: "LAGER-01",
    einheit: "STK",
    zeitstempel: "2026-09-21T07:00:00Z",
  };
  const cases: Array<{ over: Record<string, unknown>; code: string }> = [
    { over: { art: "VERAUSGABE", menge: 81 }, code: "AENDERUNG_INSUFFICIENT_AVAILABLE" }, // verfuegbar 80
    { over: { art: "RESERVIERUNG", menge: 81 }, code: "AENDERUNG_INSUFFICIENT_AVAILABLE" },
    { over: { art: "VERAUSGABE", menge: 50, aenderungsId: "aenderung:bestand-x-002", artikelId: "SYN-ART-999" }, code: "AENDERUNG_POSITION_UNKNOWN" },
    { over: { art: "VERSCHIEBUNG", menge: 5 }, code: "AENDERUNG_ART_NOT_CLOSED" },
    { over: { art: "EINKUNFT", menge: 5, aenderungsId: "aenderung:bestand-x-003", artikelId: "artikel-1" }, code: "AENDERUNG_TOKENS_NOT_CLOSED" },
    { over: { art: "EINKUNFT", menge: 5, aenderungsId: "aenderung:bestand-x-004", einheit: "KG" }, code: "AENDERUNG_UNIT_NOT_STK" },
    { over: { art: "EINKUNFT", menge: 0 }, code: "AENDERUNG_MENGE_NOT_POSITIVE" },
    { over: { art: "EINKUNFT", menge: 5, aenderungsId: "aenderung:bestand-x-005", zeitstempel: "21.09.2026" }, code: "AENDERUNG_ZEITSTAMPF_NOT_CLOSED" },
  ];
  for (let i = 0; i < cases.length; i += 1) {
    const item = cases[i];
    if (item === undefined) throw new Error("missing case");
    const r = bestandAenderungAnwendenV1(lage, { ...base, ...item.over }, []);
    assert.equal(r.outcome, "DENIED", `case ${i}`);
    if (r.outcome === "DENIED") assert.equal(r.code, item.code);
  }
  // the closed invariant reserviert <= physisch is enforced at computation
  const bad = bestandslageBerechnenV1([{ artikelId: "SYN-ART-001", lagerortId: "LAGER-01", einheit: "STK", physisch: 10, reserviert: 20 }]);
  assert.equal(bad.outcome, "DENIED");
  if (bad.outcome === "DENIED") assert.equal(bad.code, "RESERVATION_EXCEEDS_PHYSICAL");
  // duplicate closed position identity is denied
  const dup = bestandslageBerechnenV1([
    { artikelId: "SYN-ART-001", lagerortId: "LAGER-01", einheit: "STK", physisch: 10, reserviert: 0 },
    { artikelId: "SYN-ART-001", lagerortId: "LAGER-01", einheit: "STK", physisch: 5, reserviert: 0 },
  ]);
  assert.equal(dup.outcome, "DENIED");
  if (dup.outcome === "DENIED") assert.equal(dup.code, "DUPLICATE_POSITION");
});

test("M3-AC4: a Nachschub decision compares verfuegbar with a closed threshold and decides (it never silently writes)", () => {
  const lage = lage1();
  const anforderung = (over: Record<string, unknown> = {}) => ({
    anforderungsId: "nachschub:syn-art-002-001",
    artikelId: "SYN-ART-002",
    lagerortId: "LAGER-01",
    einheit: "STK",
    schwellenwert: 15,
    nachschubmenge: 40,
    grund: "verfuegbarer Bestand unter dem fachlichen Schwellenwert",
    ...over,
  });
  // verfuegbar(SYN-ART-002) = 10 < schwellenwert 15 -> required
  const required = nachschubEntscheidenV1(lage, anforderung());
  assert.equal(required.outcome, "NACHSCHUB_ERFORDERLICH");
  if (required.outcome === "NACHSCHUB_ERFORDERLICH") {
    assert.equal(required.angeforderteMenge, 40);
    assert.equal(required.verfuegbar, 10);
    assert.equal(required.schwellenwert, 15);
  }
  // fachliche variant: a LOWER threshold on the same lage -> not required (verfuegbar 10 >= 10)
  const notRequired = nachschubEntscheidenV1(lage, anforderung({ anforderungsId: "nachschub:syn-art-002-002", schwellenwert: 10 }));
  assert.equal(notRequired.outcome, "NACHSCHUB_NICHT_ERFORDERLICH");
  if (notRequired.outcome === "NACHSCHUB_NICHT_ERFORDERLICH") assert.equal(notRequired.verfuegbar, 10);
  // counter-examples
  const badId = nachschubEntscheidenV1(lage, anforderung({ anforderungsId: "nachschub" }));
  assert.equal(badId.outcome, "DENIED");
  if (badId.outcome === "DENIED") assert.equal(badId.code, "NACHSCHUB_ID_NOT_CLOSED");
  const badGrund = nachschubEntscheidenV1(lage, anforderung({ anforderungsId: "nachschub:x-003", grund: "" }));
  assert.equal(badGrund.outcome, "DENIED");
  if (badGrund.outcome === "DENIED") assert.equal(badGrund.code, "NACHSCHUB_GRUND_EMPTY");
  const unknownPos = nachschubEntscheidenV1(lage, anforderung({ anforderungsId: "nachschub:x-004", artikelId: "SYN-ART-999" }));
  assert.equal(unknownPos.outcome, "DENIED");
  if (unknownPos.outcome === "DENIED") assert.equal(unknownPos.code, "NACHSCHUB_POSITION_UNKNOWN");
});

test("M3-AC5: a second data profile (independent artikel/lagerort positions) runs the same core with a composed change + decision", () => {
  const second = bestandslageBerechnenV1([
    { artikelId: "SYN-ART-777", lagerortId: "LAGER-07", einheit: "STK", physisch: 5, reserviert: 4 },
  ]);
  assert.equal(second.outcome, "LAGE");
  if (second.outcome !== "LAGE") throw new Error("unreachable");
  const lage2 = second.lage;
  assert.equal(verfuegbarVonV1(lage2.positions[0] as BestandsPositionShaped), 1);
  const einkunft = bestandAenderungAnwendenV1(lage2, {
    schemaVersion: "cm.fachprofil/bestand-aenderung/v1",
    aenderungsId: "aenderung:bestand-einkunft-777",
    artikelId: "SYN-ART-777",
    lagerortId: "LAGER-07",
    einheit: "STK",
    art: "EINKUNFT",
    menge: 3,
    zeitstempel: "2026-09-21T08:00:00Z",
  }, []);
  assert.equal(einkunft.outcome, "GEAENDERT");
  if (einkunft.outcome !== "GEAENDERT") throw new Error("unreachable");
  const after = einkunft.lage.lage.positions[0] as BestandsPositionShaped;
  assert.equal(after.physisch, 8);
  assert.equal(after.reserviert, 4);
  // a RESERVIERUNG_AUFLUESEN on the second profile honors the closed invariant
  const aufloesen = bestandAenderungAnwendenV1(einkunft.lage.lage, {
    schemaVersion: "cm.fachprofil/bestand-aenderung/v1",
    aenderungsId: "aenderung:bestand-aufl-777",
    artikelId: "SYN-ART-777",
    lagerortId: "LAGER-07",
    einheit: "STK",
    art: "RESERVIERUNG_AUFLUESEN",
    menge: 4,
    zeitstempel: "2026-09-21T08:30:00Z",
  }, einkunft.lage.appliedAenderungsIds);
  assert.equal(aufloesen.outcome, "GEAENDERT");
  if (aufloesen.outcome !== "GEAENDERT") throw new Error("unreachable");
  assert.equal(verifyBestandslageDigestV1(aufloesen.lage.lage), true);
  // a replenishment decision on the second profile (verfuegbar 8 >= 5 -> not required)
  const decision = nachschubEntscheidenV1(aufloesen.lage.lage, {
    anforderungsId: "nachschub:syn-art-777-001",
    artikelId: "SYN-ART-777",
    lagerortId: "LAGER-07",
    einheit: "STK",
    schwellenwert: 5,
    nachschubmenge: 12,
    grund: "nachschub zur wiedereindeckung",
  });
  assert.equal(decision.outcome, "NACHSCHUB_NICHT_ERFORDERLICH");
});

type BestandsPositionShaped = { artikelId: string; lagerortId: string; einheit: "STK"; physisch: number; reserviert: number; herkunft: import("../packages/contracts/src/bestand-nachschub-v1.js").BestandspositionHerkunftV1 | null };

// F6 regression (review probe P5, RED->GREEN): a VALID input quantity must not
// produce an invalid but digest-verified state through arithmetic. The review
// candidate applied a valid EINKUNFT of 1 to physisch = Number.MAX_SAFE_INTEGER
// and emitted GEAENDERT with physical 9007199254740992 (outside safe integers),
// a state verifyBestandslageDigestV1 still accepted while the constructor
// re-denied. Now the arithmetic RESULT is checked against the closed quantity
// bounds before any state is emitted.
function einkunft(aenderungsId: string, menge: number, zeitstempel = "2026-09-21T09:00:00Z") {
  return { schemaVersion: "cm.fachprofil/bestand-aenderung/v1", aenderungsId, artikelId: "SYN-ART-001", lagerortId: "LAGER-01", einheit: "STK", art: "EINKUNFT", menge, zeitstempel };
}

test("M3-AC6: F6 — arithmetic that leaves the closed quantity bounds is a denial, never an invalid but digest-verified state", () => {
  // (a) the review counterexample: physisch at the closed bound + EINKUNFT 1
  const atBound = bestandslageBerechnenV1([
    { artikelId: "SYN-ART-001", lagerortId: "LAGER-01", einheit: "STK", physisch: BESTAND_MAX_QUANTITY_V1, reserviert: 0 },
  ]);
  assert.equal(atBound.outcome, "LAGE");
  if (atBound.outcome !== "LAGE") throw new Error("unreachable");
  const overflow = bestandAenderungAnwendenV1(atBound.lage, einkunft("aenderung:bestand-f6-001", 1), []);
  assert.equal(overflow.outcome, "DENIED");
  if (overflow.outcome === "DENIED") assert.equal(overflow.code, "AENDERING_QUANTITY_OUT_OF_BOUNDS");
  // no new state was emitted: the before-lage is unchanged and still valid
  assert.equal(verifyBestandslageDigestV1(atBound.lage), true);

  // (b) the unsafe-integer source state (Number.MAX_SAFE_INTEGER) is itself a
  // closed denial at initialization — it can no longer enter the system.
  const unsafe = bestandslageBerechnenV1([
    { artikelId: "SYN-ART-001", lagerortId: "LAGER-01", einheit: "STK", physisch: Number.MAX_SAFE_INTEGER, reserviert: 0 },
  ]);
  assert.equal(unsafe.outcome, "DENIED");
  if (unsafe.outcome === "DENIED") assert.equal(unsafe.code, "POSITION_QUANTITY_OUT_OF_BOUNDS");

  // (b2) a NON-safe-integer quantity (MAX_SAFE_INTEGER + 1) is OUT OF BOUNDS —
  // it leaves the safe numeric domain. It must NOT be mislabelled NEGATIVE.
  const nonsafe = bestandslageBerechnenV1([
    { artikelId: "SYN-ART-001", lagerortId: "LAGER-01", einheit: "STK", physisch: Number.MAX_SAFE_INTEGER + 1, reserviert: 0 },
  ]);
  assert.equal(nonsafe.outcome, "DENIED");
  if (nonsafe.outcome === "DENIED") {
    assert.equal(nonsafe.code, "POSITION_QUANTITY_OUT_OF_BOUNDS", "a non-safe-integer quantity is out of bounds, not negative");
    assert.notEqual(nonsafe.code, "POSITION_NEGATIVE_QUANTITY");
  }
  // (b3) a genuinely negative quantity is NEGATIVE (a distinct, accurate denial).
  const negative = bestandslageBerechnenV1([
    { artikelId: "SYN-ART-001", lagerortId: "LAGER-01", einheit: "STK", physisch: -5, reserviert: 0 },
  ]);
  assert.equal(negative.outcome, "DENIED");
  if (negative.outcome === "DENIED") assert.equal(negative.code, "POSITION_NEGATIVE_QUANTITY");

  // (c) a safe, in-bounds application still works end to end (positive case).
  const safe = bestandslageBerechnenV1([
    { artikelId: "SYN-ART-001", lagerortId: "LAGER-01", einheit: "STK", physisch: BESTAND_MAX_QUANTITY_V1 - 4, reserviert: 0 },
  ]);
  assert.equal(safe.outcome, "LAGE");
  if (safe.outcome !== "LAGE") throw new Error("unreachable");
  const applied = bestandAenderungAnwendenV1(safe.lage, einkunft("aenderung:bestand-f6-002", 4), []);
  assert.equal(applied.outcome, "GEAENDERT");
  if (applied.outcome !== "GEAENDERT") throw new Error("unreachable");
  const appliedPos = applied.lage.lage.positions[0];
  if (appliedPos === undefined) throw new Error("unreachable");
  assert.equal(appliedPos.physisch, BESTAND_MAX_QUANTITY_V1);
  assert.equal(verifyBestandslageDigestV1(applied.lage.lage), true);

  // (d) the resulting in-bounds state re-enters the constructor without denial.
  const reinit = bestandslageBerechnenV1(applied.lage.lage.positions);
  assert.equal(reinit.outcome, "LAGE");
});

// ---------------------------------------------------------------------------
// F5 regression (review probe P4, RED->GREEN): M3 could neither represent nor
// reject stale inventory, and retained no purchase/order lineage. Probe P4
// reproduced: a position built with synthetic observedAt:'2000-01-01T00:00:00Z'
// + sourceSystem:'synthetic-old' SILENTLY DROPPED both fields; the replenishment
// decision then returned NACHSCHUB_NICHT_ERFORDERLICH on that timeless stock,
// and an EINKUNFT dated in 2000 was accepted as GEAENDERT with the change
// timestamp discarded. Now: (a) the origin bundle (herkunft: quelle/
// beobachtetAm/quelleRevision) is RETAINED on every position, (b) the Nachschub
// decision runs under a closed freshness policy with explicit
// BESTANDSFRISCHHEIT_UNBEWEIST / BESTANDSFRISCHHEIT_VERALTET terminals, and
// (c) every applied change is retained as lineage (verlauf) with a source-
// bound Beleg — not just the change id. A source-bound M1->M3 receipt adapter
// maps REAL M1 received-quantity evidence into a closed EINKUNFT change via an
// EXPLICIT identity/unit adapter (never inferred from shared spelling, never
// from a rollback or stock balance).

const F5_POLITIK: BestandsFrischePolitikV1 = {
  politikId: "frische:m3-politik-001",
  version: "1.0.0",
  maximalerAlterSekunden: 86_400, // 1 day freshness horizon
  entscheidungsZeitpunkt: "2026-09-21T12:00:00Z",
};

function lageMitHerkunft() {
  const r = bestandslageBerechnenV1([
    { artikelId: "SYN-ART-001", lagerortId: "LAGER-01", einheit: "STK", physisch: 100, reserviert: 20,
      herkunft: { quelle: "synthetic-erp", beobachtetAm: "2026-09-21T06:00:00Z", quelleRevision: "rev-2026-09-21" } },
  ]);
  assert.equal(r.outcome, "LAGE");
  if (r.outcome !== "LAGE") throw new Error("unreachable");
  return r.lage;
}

test("M3-F5A: probe P4 — a 2000 observation is RETAINED and the decision is STALE, not a silent NACHSCHUB_NICHT_ERFORDERLICH", () => {
  // The review's exact counterexample fields: observedAt 2000-01-01, source
  // 'synthetic-old'. They must now be RETAINED (never silently dropped).
  const r = bestandslageBerechnenV1([
    { artikelId: "SYN-ART-001", lagerortId: "LAGER-01", einheit: "STK", physisch: 50, reserviert: 0,
      herkunft: { quelle: "synthetic-old", beobachtetAm: "2000-01-01T00:00:00Z", quelleRevision: "rev-old-001" } },
  ]);
  assert.equal(r.outcome, "LAGE");
  if (r.outcome !== "LAGE") throw new Error("unreachable");
  const pos = r.lage.positions[0];
  assert.ok(pos !== undefined);
  // RETAINED: the origin bundle survives in the emitted state...
  assert.deepEqual(pos.herkunft, { quelle: "synthetic-old", beobachtetAm: "2000-01-01T00:00:00Z", quelleRevision: "rev-old-001" });
  // ...and is covered by the closed digest (dropping it would break verify).
  assert.equal(verifyBestandslageDigestV1(r.lage), true);
  const stripped = { ...r.lage, positions: [{ ...pos, herkunft: null }] };
  assert.equal(verifyBestandslageDigestV1(stripped), false, "the digest covers the retained origin bundle");

  // The freshness verdict on that retained, 26-year-old observation is STALE.
  const frische = bestandsfrischeBewertenV1(pos, F5_POLITIK);
  assert.equal(frische.outcome, "BESTANDSFRISCHHEIT_VERALTET");
  if (frische.outcome === "BESTANDSFRISCHHEIT_VERALTET") assert.ok(frische.alterSekunden > 800_000_000);

  // The Nachschub decision UNDER the policy is an explicit STALE terminal —
  // no threshold decision (NACHSCHUB_NICHT_ERFORDERLICH) is taken on stale stock.
  const entscheidung = nachschubEntscheidenFrischeV1(r.lage, {
    anforderungsId: "nachschub:syn-art-001-f5a", artikelId: "SYN-ART-001", lagerortId: "LAGER-01", einheit: "STK",
    schwellenwert: 10, nachschubmenge: 20, grund: "f5 stale probe",
  }, F5_POLITIK);
  assert.equal(entscheidung.outcome, "BESTANDSFRISCHHEIT_VERALTET");
});

test("M3-F5B: a timeless position (no herkunft) is UNPROVEN at decision time; a current position reaches the threshold decision", () => {
  // (a) no origin bundle -> BESTANDSFRISCHHEIT_UNBEWEIST (probe P4's silent
  //     drop is now an explicit terminal, never a threshold decision).
  const timeless = bestandslageBerechnenV1([{ artikelId: "SYN-ART-002", lagerortId: "LAGER-01", einheit: "STK", physisch: 10, reserviert: 0 }]);
  assert.equal(timeless.outcome, "LAGE");
  if (timeless.outcome !== "LAGE") throw new Error("unreachable");
  const tp = timeless.lage.positions[0];
  assert.ok(tp !== undefined);
  assert.equal(tp.herkunft, null, "the origin bundle is explicitly absent, not silently fabricated");
  const f = bestandsfrischeBewertenV1(tp, F5_POLITIK);
  assert.equal(f.outcome, "BESTANDSFRISCHHEIT_UNBEWEIST");
  const d = nachschubEntscheidenFrischeV1(timeless.lage, {
    anforderungsId: "nachschub:syn-art-002-f5b", artikelId: "SYN-ART-002", lagerortId: "LAGER-01", einheit: "STK",
    schwellenwert: 5, nachschubmenge: 10, grund: "f5 unproven probe",
  }, F5_POLITIK);
  assert.equal(d.outcome, "BESTANDSFRISCHHEIT_UNBEWEIST");

  // (b) a proven, CURRENT observation (6h old < 1d horizon) reaches the
  //     threshold decision: verfuegbar 80 < schwellenwert 80? no, 80 >= 80...
  const lag2 = lageMitHerkunft(); // physisch 100, reserviert 20 -> verfuegbar 80, observed 06:00 (6h before 12:00)
  const f2 = bestandsfrischeBewertenV1(lag2.positions[0] as BestandslageV1["positions"][0], F5_POLITIK);
  assert.equal(f2.outcome, "BESTANDSFRISCHHEIT_BEWIESEN_AKTUELL");
  if (f2.outcome === "BESTANDSFRISCHHEIT_BEWIESEN_AKTUELL") assert.equal(f2.alterSekunden, 21_600);
  const d2 = nachschubEntscheidenFrischeV1(lag2, {
    anforderungsId: "nachschub:syn-art-001-f5b", artikelId: "SYN-ART-001", lagerortId: "LAGER-01", einheit: "STK",
    schwellenwert: 81, nachschubmenge: 40, grund: "f5 current + below threshold",
  }, F5_POLITIK);
  assert.equal(d2.outcome, "NACHSCHUB_ERFORDERLICH");
  if (d2.outcome === "NACHSCHUB_ERFORDERLICH") {
    assert.equal(d2.verfuegbar, 80);
    assert.equal(d2.frische.outcome, "BESTANDSFRISCHHEIT_BEWIESEN_AKTUELL");
    assert.equal(d2.politikId, "frische:m3-politik-001");
  }

  // (c) a FUTURE observation is impossible -> closed denial.
  const future = bestandslageBerechnenV1([{ artikelId: "SYN-ART-003", lagerortId: "LAGER-01", einheit: "STK", physisch: 5, reserviert: 0,
    herkunft: { quelle: "synthetic-erp", beobachtetAm: "2026-09-22T00:00:00Z", quelleRevision: "rev-future" } }]);
  assert.equal(future.outcome, "LAGE");
  if (future.outcome !== "LAGE") throw new Error("unreachable");
  const fp = future.lage.positions[0];
  assert.ok(fp !== undefined);
  assert.equal(bestandsfrischeBewertenV1(fp, F5_POLITIK).outcome, "DENIED");
});

test("M3-F5C: a source-bound Beleg is retained as lineage (verlauf), not just the change id", () => {
  const lage = lageMitHerkunft();
  const aenderung = {
    schemaVersion: "cm.fachprofil/bestand-aenderung/v1",
    aenderungsId: "aenderung:bestand-einkunft-f5c",
    artikelId: "SYN-ART-001",
    lagerortId: "LAGER-01",
    einheit: "STK",
    art: "EINKUNFT",
    menge: 30,
    zeitstempel: "2026-09-21T09:00:00Z",
    beleg: { belegId: "wareneingang:wg-001", belegArt: "WARENEINGANG", quelle: "m1-wareneingang", zeitstempel: "2026-09-21T09:00:00Z" },
  };
  const applied = bestandAenderungAnwendenV1(lage, aenderung, []);
  assert.equal(applied.outcome, "GEAENDERT");
  if (applied.outcome !== "GEAENDERT") throw new Error("unreachable");
  // The change is RETAINED as lineage with its Beleg + before/after digests.
  const verlauf = applied.lage.lage.verlauf;
  assert.equal(verlauf.length, 1);
  const v = verlauf[0];
  assert.ok(v !== undefined);
  assert.equal(v.aenderungsId, "aenderung:bestand-einkunft-f5c");
  assert.equal(v.art, "EINKUNFT");
  assert.equal(v.zeitstempel, "2026-09-21T09:00:00Z", "the change timestamp is RETAINED, not discarded");
  assert.deepEqual(v.beleg, { belegId: "wareneingang:wg-001", belegArt: "WARENEINGANG", quelle: "m1-wareneingang", zeitstempel: "2026-09-21T09:00:00Z" });
  // Chain: the entry's beforeDigest IS the before-lage digest (the chain link),
  // and the after-lage digest (covering the entry) is the result's afterDigest.
  assert.equal(v.beforeDigest, lage.lageDigest);
  assert.equal(applied.afterDigest, applied.lage.lage.lageDigest);
  assert.equal(verifyBestandslageDigestV1(applied.lage.lage), true);
  // The lineage + Beleg + timestamp are covered by the closed digest: dropping
  // the lineage, or tampering with the retained evidence, breaks verification.
  const tampered = { ...applied.lage.lage, verlauf: [] };
  assert.equal(verifyBestandslageDigestV1(tampered), false, "dropping the retained lineage breaks the digest");
  const tamperedZeit = { ...applied.lage.lage, verlauf: [{ ...v, zeitstempel: "2026-09-21T09:59:59Z" }] };
  assert.equal(verifyBestandslageDigestV1(tamperedZeit), false, "tampering with the retained change timestamp breaks the digest");
  // The chain extends: a second change links its beforeDigest to the first
  // result's afterDigest (no lineage is ever lost between changes).
  const zweiter = { ...aenderung, aenderungsId: "aenderung:bestand-vera-f5c", art: "VERAUSGABE", menge: 10, zeitstempel: "2026-09-21T10:00:00Z", beleg: { belegId: "auftrag:ku-002", belegArt: "KUNDENAUFTRAG", quelle: "m2-kundenauftrag", zeitstempel: "2026-09-21T10:00:00Z" } };
  const applied2 = bestandAenderungAnwendenV1(applied.lage.lage, zweiter, applied.lage.appliedAenderungsIds);
  assert.equal(applied2.outcome, "GEAENDERT");
  if (applied2.outcome === "GEAENDERT") {
    const v2 = applied2.lage.lage.verlauf[1];
    assert.ok(v2 !== undefined);
    assert.equal(v2.beforeDigest, applied.afterDigest, "the lineage chain links change 2 to the change-1 after-state");
    assert.equal(verifyBestandslageDigestV1(applied2.lage.lage), true);
  }
  // a 2000-dated EINKUNFT still applies arithmetically (the change is
  // versioned) but is RETAINED with its timestamp — probe P4's silent
  // timestamp drop is gone.
  const stale2000 = { ...aenderung, aenderungsId: "aenderung:bestand-einkunft-f5c-2000", zeitstempel: "2000-01-01T00:00:00Z",
    beleg: { belegId: "wareneingang:wg-2000", belegArt: "WARENEINGANG", quelle: "synthetic-old", zeitstempel: "2000-01-01T00:00:00Z" } };
  const applied2000 = bestandAenderungAnwendenV1(lage, stale2000, []);
  assert.equal(applied2000.outcome, "GEAENDERT");
  if (applied2000.outcome === "GEAENDERT") {
    const v2000 = applied2000.lage.lage.verlauf[0];
    assert.ok(v2000 !== undefined);
    assert.equal(v2000.zeitstempel, "2000-01-01T00:00:00Z", "the 2000 timestamp is retained in lineage");
  }
  // a malformed Beleg is a closed denial, not a silent drop.
  const badBeleg = bestandAenderungAnwendenV1(lage, { ...aenderung, aenderungsId: "aenderung:bestand-bad-beleg", beleg: { belegId: "x", belegArt: "WARENEINGANG", quelle: "m", zeitstempel: "2026-09-21T09:00:00Z" } }, []);
  assert.equal(badBeleg.outcome, "DENIED");
  if (badBeleg.outcome === "DENIED") assert.equal(badBeleg.code, "AENDERUNG_BELEG_NOT_CLOSED");
});

test("M3-F5D: the source-bound M1->M3 receipt adapter maps REAL M1 received quantity via an explicit identity/unit adapter (positive + closed negatives)", () => {
  // REAL M1 evidence: a closed Bestellentwurf + a real Wareneingang receipt
  // (50 of the 100 ordered) via the real M1 entrypoint.
  const entw = bestellungsentwurfBildenV1({
    bestellungId: "bestellung:eink-f5d",
    lieferantId: "lieferant:metall-f5d",
    bestellungZeitstempel: "2026-09-10T08:00:00Z",
    positionen: [{ positionId: "position:eink-f5d-01", artikelId: "EINK-ART-001", einheit: "STK", waehrung: "EUR", bestellteMenge: 100, berechneteMengeMinor: null }],
  });
  assert.equal(entw.outcome, "ENTWURF");
  if (entw.outcome !== "ENTWURF") throw new Error("unreachable");
  const eingang = wareneingangErfassenV1(entw.entwurf, null, {
    eingangsId: "wareneingang:wg-f5d-01",
    bestellungId: "bestellung:eink-f5d",
    positionId: "position:eink-f5d-01",
    einheit: "STK",
    menge: 50,
    zeitstempel: "2026-09-21T09:30:00Z",
    korrekturVon: null,
  });
  assert.equal(eingang.outcome, "WARENEINGANG_ERFASST");
  if (eingang.outcome !== "WARENEINGANG_ERFASST") throw new Error("unreachable");
  const ledger = eingang.ledger;

  // The EXPLICIT identity/unit adapter: EINK-ART-001/STK -> SYN-ART-001 @ LAGER-01.
  const adapter = {
    adapterId: "adapter:eink-nach-syn-001",
    mappingen: [{ m1ArtikelId: "EINK-ART-001", m3ArtikelId: "SYN-ART-001", m3LagerortId: "LAGER-01", einheit: "STK" }],
  };
  const baseInput = {
    adapter,
    m1Entwurf: entw.entwurf,
    m1Ledger: ledger,
    m1EingangsId: "wareneingang:wg-f5d-01",
    m1Quelle: "m1-wareneingang",
    m1Zeitstempel: "2026-09-21T09:30:00Z",
    m3Ziel: { artikelId: "SYN-ART-001", lagerortId: "LAGER-01" },
  };
  // POSITIVE: the real received quantity (50) is mapped into a closed EINKUNFT
  // change with a source-bound Beleg (the M1 eingangsId + source + time).
  const mapped = wareneingangZuBestandsaenderungV1(baseInput);
  assert.equal(mapped.outcome, "BELEGT", JSON.stringify(mapped));
  if (mapped.outcome !== "BELEGT") throw new Error("unreachable");
  assert.equal(mapped.aenderung.art, "EINKUNFT");
  assert.equal(mapped.aenderung.menge, 50, "the REAL M1 received quantity, not an invented one");
  assert.equal(mapped.aenderung.artikelId, "SYN-ART-001");
  assert.equal(mapped.aenderung.lagerortId, "LAGER-01");
  assert.equal(mapped.aenderung.einheit, "STK");
  assert.match(mapped.aenderung.aenderungsId, /^aenderung:bestand-wareneingang-[a-z0-9-]{3,64}$/);
  assert.deepEqual(mapped.aenderung.beleg, { belegId: "wareneingang:wg-f5d-01", belegArt: "WARENEINGANG", quelle: "m1-wareneingang", zeitstempel: "2026-09-21T09:30:00Z" });
  // The mapped change applies cleanly to a closed M3 position.
  const m3Lage = bestandslageBerechnenV1([{ artikelId: "SYN-ART-001", lagerortId: "LAGER-01", einheit: "STK", physisch: 0, reserviert: 0 }]);
  assert.equal(m3Lage.outcome, "LAGE");
  if (m3Lage.outcome !== "LAGE") throw new Error("unreachable");
  const applied = bestandAenderungAnwendenV1(m3Lage.lage, mapped.aenderung, []);
  assert.equal(applied.outcome, "GEAENDERT");
  if (applied.outcome === "GEAENDERT") {
    const p = applied.lage.lage.positions[0];
    assert.ok(p !== undefined);
    assert.equal(p.physisch, 50);
    assert.equal(verifyBestandslageDigestV1(applied.lage.lage), true);
  }

  // NEGATIVES — none of these may be inferred; each is a closed denial.
  // (a) shared spelling alone proves NO relation: an unlisted M1 article
  //     (EINK-ART-002) is denied even though it shares the EINK-ART- prefix.
  const noRelEntw = bestellungsentwurfBildenV1({
    bestellungId: "bestellung:eink-f5d-2",
    lieferantId: "lieferant:metall-f5d",
    bestellungZeitstempel: "2026-09-10T08:00:00Z",
    positionen: [{ positionId: "position:eink-f5d-2-01", artikelId: "EINK-ART-002", einheit: "STK", waehrung: "EUR", bestellteMenge: 100, berechneteMengeMinor: null }],
  });
  assert.equal(noRelEntw.outcome, "ENTWURF");
  if (noRelEntw.outcome !== "ENTWURF") throw new Error("unreachable");
  const noRelLedger = wareneingangErfassenV1(noRelEntw.entwurf, null, {
    eingangsId: "wareneingang:wg-f5d-02",
    bestellungId: "bestellung:eink-f5d-2",
    positionId: "position:eink-f5d-2-01",
    einheit: "STK",
    menge: 50,
    zeitstempel: "2026-09-21T09:30:00Z",
    korrekturVon: null,
  });
  assert.equal(noRelLedger.outcome, "WARENEINGANG_ERFASST");
  if (noRelLedger.outcome !== "WARENEINGANG_ERFASST") throw new Error("unreachable");
  const noRelation = wareneingangZuBestandsaenderungV1({
    ...baseInput,
    m1Entwurf: noRelEntw.entwurf,
    m1Ledger: noRelLedger.ledger,
    m1EingangsId: "wareneingang:wg-f5d-02",
  });
  assert.equal(noRelation.outcome, "DENIED");
  if (noRelation.outcome === "DENIED") assert.equal(noRelation.code, "ADAPTER_M1_LAGERORT_UNKNOWN");

  // (b) a zero received quantity is NOT a positive EINKUNFT (unknown receipt).
  const zeroState = wareneingangZuBestandsaenderungV1({
    ...baseInput,
    m1Ledger: { ...ledger, eintraege: [], appliedEingangsIds: [] },
    m1EingangsId: "wareneingang:wg-f5d-03",
  });
  assert.equal(zeroState.outcome, "DENIED");
  if (zeroState.outcome === "DENIED") assert.equal(zeroState.code, "ADAPTER_EVIDENCE_MENGE_NOT_POSITIVE");

  // (c) a non-closed M3 target is a closed denial.
  const badTarget = wareneingangZuBestandsaenderungV1({ ...baseInput, m3Ziel: { artikelId: "syn-art-001", lagerortId: "LAGER-01" } });
  assert.equal(badTarget.outcome, "DENIED");
  if (badTarget.outcome === "DENIED") assert.equal(badTarget.code, "ADAPTER_TARGET_NOT_CLOSED");

  // (d) a non-closed source identity token is a closed denial.
  const badQuelle = wareneingangZuBestandsaenderungV1({ ...baseInput, m1Quelle: "M1 WARENEINGANG!" });
  assert.equal(badQuelle.outcome, "DENIED");
  if (badQuelle.outcome === "DENIED") assert.equal(badQuelle.code, "ADAPTER_QUELLE_NOT_CLOSED");
});
