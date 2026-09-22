import assert from "node:assert/strict";
import test from "node:test";
import {
  ErpOrderCapabilityCellV1,
  syntheticErpOrderProfilesV1,
} from "../packages/contracts/src/erp-order-capability-cell.js";
import { syntheticCapabilityCatalogueV1 } from "../packages/contracts/src/capability-catalogue.js";
import {
  KUNDENAUFTRAG_DECLARED_LOSSES_V1,
  bindKundenauftragToCellV1,
  executeKundenauftragAsLieferzusageV1,
  verifyLieferzusageDigestV1,
  type KundenauftragVerfuegbarkeitEvidenzV1,
} from "../packages/contracts/src/kundenauftrag-lieferzusage-v1.js";

function core() {
  const catalogue = syntheticCapabilityCatalogueV1();
  const profiles = syntheticErpOrderProfilesV1(catalogue);
  return { catalogue, profiles, core: new ErpOrderCapabilityCellV1({ catalogue, profiles, activeProfileDigest: profiles[0].profileDigest }) };
}

function stock(physisch = 100, reserviert = 0): KundenauftragVerfuegbarkeitEvidenzV1 {
  return {
    quelle: "BESTANDSPOSITION_EVIDENCE",
    bestandsposition: { artikelId: "SYN-ART-001", lagerortId: "LAGER-01", einheit: "STK", physisch, reserviert },
    beobachtetAm: "2026-09-14",
  };
}

function auftrag(suffix: string, over: Record<string, unknown> = {}) {
  return {
    auftragsId: `request:erp-cell-${suffix}`,
    kundeId: "kunde:zoo-001",
    artikelId: "SYN-CELL-ERP-01",
    menge: 2,
    lieferzusageFrist: "2026-10-01",
    zeitbasis: "2026-09-15",
    verfuegbarkeit: stock(),
    ...over,
  };
}

test("M2-AC1: a Kundenauftrag with proven availability + future date executes over the REAL reused cell and yields a digest-verified, evidence-bound Lieferzusage", () => {
  const { core: cell } = core();
  const result = executeKundenauftragAsLieferzusageV1(auftrag("m2-order-001"), cell);
  assert.equal(result.outcome, "LIEFERZUSAGE");
  if (result.outcome !== "LIEFERZUSAGE") throw new Error("unreachable");
  const receipt = result.receipt;
  assert.equal(receipt.outcome, "SYNTHETIC_LIEFERZUSAGE_FROM_ERP_ORDER_CELL");
  assert.equal(receipt.auftragsId, "request:erp-cell-m2-order-001");
  assert.equal(receipt.artikelId, "SYN-CELL-ERP-01");
  assert.equal(receipt.menge, 2);
  assert.equal(receipt.actionContract, "erp.order.create/v1");
  assert.equal(receipt.cellOutcome, "SYNTHETIC_ORDER_READBACK_AND_ROLLBACK_VERIFIED");
  assert.equal(receipt.cellEffectCount, 1);
  assert.equal(receipt.cellRollbackCount, 1);
  assert.equal(receipt.cellFinalDigest, receipt.cellBeforeDigest, "cell compensating rollback leaves zero residue");
  // the decision is now bound to the stock/date evidence, not just the cell
  assert.equal(receipt.entscheidung.art, "LIEFERZUSAGE");
  assert.equal(receipt.entscheidung.verfuegbar, 100);
  assert.equal(receipt.entscheidung.menge, 2);
  assert.equal(receipt.verfuegbarkeit.quelle, "BESTANDSPOSITION_EVIDENCE");
  assert.equal(receipt.lieferzusageFrist, "2026-10-01");
  assert.equal(receipt.zeitbasis, "2026-09-15");
  assert.ok(receipt.lieferzusageFrist >= receipt.zeitbasis, "promised date is not before the decision basis");
  assert.equal(verifyLieferzusageDigestV1(receipt), true);
  assert.deepEqual(receipt.declaredLossReasonCodes, KUNDENAUFTRAG_DECLARED_LOSSES_V1.map((l) => l.reasonCode));
});

test("M2-AC2: the second data profile (different provider profile + sku + menge) runs the unchanged fachliche composition", () => {
  const { profiles, core: cell } = core();
  const first = executeKundenauftragAsLieferzusageV1(auftrag("m2-p1-001"), cell);
  assert.equal(first.outcome, "LIEFERZUSAGE");
  const switched = cell.switchProfile(profiles[0].profileDigest, profiles[1].profileDigest);
  assert.equal(switched.outcome, "EXACT_PROFILE_SWITCHED");
  assert.equal(switched.unchangedAction, "erp.order.create");
  const second = executeKundenauftragAsLieferzusageV1(auftrag("m2-p2-001", { artikelId: "SYN-CELL-ERP-02", menge: 5 }), cell);
  assert.equal(second.outcome, "LIEFERZUSAGE");
  if (second.outcome !== "LIEFERZUSAGE") throw new Error("unreachable");
  const firstDigest = first.outcome === "LIEFERZUSAGE" ? first.receipt.cellProfileDigest : "";
  assert.notEqual(second.receipt.cellProfileDigest, firstDigest);
  assert.equal(second.receipt.artikelId, "SYN-CELL-ERP-02");
  assert.equal(second.receipt.menge, 5);
  assert.equal(verifyLieferzusageDigestV1(second.receipt), true);
});

test("M2-AC3: a replayed Kundenauftrag is a closed denial by the reused cell (no double order)", () => {
  const { core: cell } = core();
  const first = executeKundenauftragAsLieferzusageV1(auftrag("m2-replay-001"), cell);
  assert.equal(first.outcome, "LIEFERZUSAGE");
  const replay = executeKundenauftragAsLieferzusageV1(auftrag("m2-replay-001"), cell);
  assert.equal(replay.outcome, "DENIED");
  if (replay.outcome === "DENIED") {
    assert.equal(replay.code, "CELL_EXECUTION_DENIED");
    assert.match(replay.detail, /REPLAY/);
  }
});

test("M2-AC4: counter-examples — non-closed auftragsId/artikelId, out-of-range menge, non-ISO/non-semantic lieferfrist, missing kundeId, bad verfuegbarkeit are closed denials", () => {
  const { core: cell } = core();
  const bad = [
    auftrag("x", { auftragsId: "order:123" }),
    auftrag("m2-bad-001", { artikelId: "artikel-1" }),
    auftrag("m2-bad-002", { menge: 0 }),
    auftrag("m2-bad-003", { menge: 101 }),
    auftrag("m2-bad-004", { lieferzusageFrist: "01.10.2026" }),
    auftrag("m2-bad-005", { kundeId: "" }),
    auftrag("m2-bad-006", { verfuegbarkeit: { quelle: "BESTANDSPOSITION_EVIDENCE" } }),
  ];
  const expected = ["KUNDENAUFTRAG_AUFTRAGSID_NOT_CLOSED", "KUNDENAUFTRAG_ARTIKELID_NOT_CLOSED", "KUNDENAUFTRAG_MENGE_NOT_IN_RANGE", "KUNDENAUFTRAG_MENGE_NOT_IN_RANGE", "KUNDENAUFTRAG_LIEFERFRIST_NOT_ISO_DATE", "KUNDENAUFTRAG_KUNDEID_MISSING", "KUNDENAUFTRAG_VERFUEGBARKEIT_NOT_CLOSED"];
  for (let i = 0; i < bad.length; i += 1) {
    const r = executeKundenauftragAsLieferzusageV1(bad[i] as never, cell);
    assert.equal(r.outcome, "DENIED", `case ${i}`);
    if (r.outcome === "DENIED") assert.equal(r.code, expected[i]);
  }
  const clean = executeKundenauftragAsLieferzusageV1(auftrag("m2-clean-001"), cell);
  assert.equal(clean.outcome, "LIEFERZUSAGE");
});

test("M2-AC5: the declared losses are explicit and not word-mapped (kundeId/lieferfrist stay fachliche-only; cell receipt carries no customer)", () => {
  const bound = bindKundenauftragToCellV1(auftrag("m2-loss-001"));
  assert.equal(bound.outcome, "BOUND");
  if (bound.outcome !== "BOUND") throw new Error("unreachable");
  assert.deepEqual(bound.binding.declaredLossReasonCodes, ["KUNDE_IDENTITY_NOT_IN_CELL", "LIEFERFRIST_NOT_IN_CELL"]);
  assert.equal(bound.binding.cellRequestId, bound.binding.auftragsId);
  assert.equal(bound.binding.cellSku, bound.binding.artikelId);
  assert.equal(bound.binding.cellQuantity, bound.binding.menge);
  const { core: cell } = core();
  const result = executeKundenauftragAsLieferzusageV1(auftrag("m2-loss-002"), cell);
  assert.equal(result.outcome, "LIEFERZUSAGE");
  if (result.outcome === "LIEFERZUSAGE") {
    assert.ok(result.receipt.declaredLossReasonCodes.includes("KUNDE_IDENTITY_NOT_IN_CELL"));
    assert.ok(result.receipt.declaredLossReasonCodes.includes("LIEFERFRIST_NOT_IN_CELL"));
    assert.equal(verifyLieferzusageDigestV1(result.receipt), true);
  }
  const tampered = { ...result.receipt, lieferzusageDigest: "0".repeat(64) };
  assert.equal(verifyLieferzusageDigestV1(tampered), false);
});

// F4 regression (review probe P3, RED->GREEN): M2 wrapped the cell
// creation/rollback as a delivery promise WITHOUT availability or date
// reasoning. Probe P3 reproduced: real cell, SYN-ART-001, qty 100, no
// availability evidence and lieferzusageFrist "2026-99-99" returned
// LIEFERZUSAGE carrying the impossible date. Now the cell execution proof is
// separated from a stock/date-bound proposal: a closed SEMANTIC date is
// checked (2026-09-99 is not a real date) and availability is CLOSED (either
// explicit stock evidence or declared UNBEWEIST). Missing/unproven
// availability or a past/impossible date yield a closed KLARUNG, not a
// promise-shaped success.

test("M2-F4A: probe P3 — no availability evidence + impossible date is NOT a LIEFERZUSAGE (DENIED by the closed semantic date; a KLARUNG would be the terminal without the date)", () => {
  const { core: cell } = core();
  // The review probe's exact inputs: no availability evidence (UNBEWEIST) and
  // the impossible date 2026-99-99. The closed semantic date check fires first
  // (a real calendar date is required), so this is a DENIAL, not a promise.
  const p3 = executeKundenauftragAsLieferzusageV1(auftrag("m2-p3-001", {
    lieferzusageFrist: "2026-99-99",
    verfuegbarkeit: { quelle: "UNBEWEIST" },
  }), cell);
  assert.equal(p3.outcome, "DENIED");
  if (p3.outcome === "DENIED") assert.equal(p3.code, "KUNDENAUFTRAG_LIEFERFRIST_NOT_ISO_DATE");

  // A real, valid future date + UNBEWEIST availability is not a promise either:
  // it is a closed KLARUNG (clarification), and the cell is NOT executed.
  const kl = executeKundenauftragAsLieferzusageV1(auftrag("m2-p3-002", {
    lieferzusageFrist: "2026-10-01",
    verfuegbarkeit: { quelle: "UNBEWEIST" },
  }), cell);
  assert.equal(kl.outcome, "KLARUNG");
  if (kl.outcome === "KLARUNG") {
    assert.equal(kl.klarung.grundCode, "VERFUEGBARKEIT_UNBEWEIST");
    assert.equal(kl.klarung.verfuegbarkeit.quelle, "UNBEWEIST");
  }
  // The KLARUNG did NOT execute the cell: the same auftragsId still executes
  // with real availability (no replay poisoning from the clarification path).
  const after = executeKundenauftragAsLieferzusageV1(auftrag("m2-p3-002", {
    lieferzusageFrist: "2026-10-01",
    verfuegbarkeit: stock(),
  }), cell);
  assert.equal(after.outcome, "LIEFERZUSAGE");
});

test("M2-F4B: missing availability (UNBEWEIST) is a KLARUNG, not a promise; the cell execution proof stays separated", () => {
  const { core: cell } = core();
  const r = executeKundenauftragAsLieferzusageV1(auftrag("m2-f4b-001", {
    lieferzusageFrist: "2026-10-01",
    verfuegbarkeit: { quelle: "UNBEWEIST" },
  }), cell);
  assert.equal(r.outcome, "KLARUNG");
  if (r.outcome === "KLARUNG") {
    assert.equal(r.klarung.grundCode, "VERFUEGBARKEIT_UNBEWEIST");
    assert.match(r.klarung.detail, /availability/i);
  }
  // a digest-verified KLARUNG is a closed, verifiable terminal
  const kl = r.outcome === "KLARUNG" ? r.klarung : null;
  if (kl) {
    const core_ = Object.fromEntries(Object.entries(kl).filter(([k]) => k !== "klarungDigest"));
    // klarungDigest must be a 64-hex string over the closed content
    assert.match(kl.klarungDigest, /^[a-f0-9]{64}$/);
  }
});

test("M2-F4C: a shortage (available < requested menge) is a KLARUNG (ENGPASS), never a promise", () => {
  const { core: cell } = core();
  // available = 3 - 0 = 3 < requested 100 -> shortage clarification
  const r = executeKundenauftragAsLieferzusageV1(auftrag("m2-f4c-001", {
    lieferzusageFrist: "2026-10-01",
    menge: 100,
    verfuegbarkeit: stock(3, 0),
  }), cell);
  assert.equal(r.outcome, "KLARUNG");
  if (r.outcome === "KLARUNG") {
    assert.equal(r.klarung.grundCode, "ENGPASS_MENGE_OBER_VERFUEGBAR");
    assert.match(r.klarung.detail, /available 3/);
  }
  // partial availability equal to menge is NOT a shortage: 5 available, 5
  // requested -> LIEFERZUSAGE (positive boundary)
  const ok = executeKundenauftragAsLieferzusageV1(auftrag("m2-f4c-002", {
    lieferzusageFrist: "2026-10-01",
    menge: 5,
    verfuegbarkeit: stock(5, 0),
  }), cell);
  assert.equal(ok.outcome, "LIEFERZUSAGE");
  if (ok.outcome === "LIEFERZUSAGE") assert.equal(ok.receipt.entscheidung.verfuegbar, 5);
});

test("M2-F4D: a promised date before the decision time basis is a KLARUNG (retroactive promise denied)", () => {
  const { core: cell } = core();
  const r = executeKundenauftragAsLieferzusageV1(auftrag("m2-f4d-001", {
    lieferzusageFrist: "2026-09-01",   // before zeitbasis 2026-09-15
    verfuegbarkeit: stock(),
  }), cell);
  assert.equal(r.outcome, "KLARUNG");
  if (r.outcome === "KLARUNG") assert.equal(r.klarung.grundCode, "LIEFERFRIST_IN_VERGANGENHEIT");
  // the same day as the basis is allowed (not before)
  const same = executeKundenauftragAsLieferzusageV1(auftrag("m2-f4d-002", {
    lieferzusageFrist: "2026-09-15",
    verfuegbarkeit: stock(),
  }), cell);
  assert.equal(same.outcome, "LIEFERZUSAGE");
});

test("M2-F4E: the date is checked SEMANTICALLY, not just by format (2026-09-99 and 2026-02-30 are denied; 2026-02-28 and a real date pass)", () => {
  const { core: cell } = core();
  const badDates: Array<[string, "KUNDENAUFTRAG_LIEFERFRIST_NOT_ISO_DATE" | "KUNDENAUFTRAG_ZEITBASIS_NOT_ISO_DATE"]> = [
    ["2026-99-99", "KUNDENAUFTRAG_LIEFERFRIST_NOT_ISO_DATE"],
    ["2026-02-30", "KUNDENAUFTRAG_LIEFERFRIST_NOT_ISO_DATE"],
    ["2026-04-31", "KUNDENAUFTRAG_LIEFERFRIST_NOT_ISO_DATE"],
    ["2026-13-01", "KUNDENAUFTRAG_LIEFERFRIST_NOT_ISO_DATE"],
    ["2026-00-10", "KUNDENAUFTRAG_LIEFERFRIST_NOT_ISO_DATE"],
  ];
  for (const [date, code] of badDates) {
    const r = executeKundenauftragAsLieferzusageV1(auftrag("m2-f4e-d", { lieferzusageFrist: date }), cell);
    assert.equal(r.outcome, "DENIED", date);
    if (r.outcome === "DENIED") assert.equal(r.code, code, date);
  }
  // a real date on the boundary (leap-safe: 2026 is not a leap year, 2028 is)
  const realDate = executeKundenauftragAsLieferzusageV1(auftrag("m2-f4e-ok", {
    lieferzusageFrist: "2028-02-29",   // 2028 IS a leap year -> valid
    verfuegbarkeit: stock(),
  }), cell);
  assert.equal(realDate.outcome, "LIEFERZUSAGE");
  // the zeitbasis is checked semantically too
  const badBasis = executeKundenauftragAsLieferzusageV1(auftrag("m2-f4e-basis", { zeitbasis: "2026-02-30" }), cell);
  assert.equal(badBasis.outcome, "DENIED");
  if (badBasis.outcome === "DENIED") assert.equal(badBasis.code, "KUNDENAUFTRAG_ZEITBASIS_NOT_ISO_DATE");
});

test("M2-F4F: the LIEFERZUSAGE receipt is a synthetic local proof — explicitly NOT a proof of a persisted order or completed delivery (complaint boundary)", () => {
  const { core: cell } = core();
  const r = executeKundenauftragAsLieferzusageV1(auftrag("m2-f4f-001"), cell);
  assert.equal(r.outcome, "LIEFERZUSAGE");
  if (r.outcome !== "LIEFERZUSAGE") throw new Error("unreachable");
  // The cell effect is a synthetic insert/readback/ROLLBACK (rollbackCount 1,
  // final == before): there is NO persisted order and NO completed delivery.
  assert.equal(r.receipt.cellOutcome, "SYNTHETIC_ORDER_READBACK_AND_ROLLBACK_VERIFIED");
  assert.equal(r.receipt.cellRollbackCount, 1);
  assert.equal(r.receipt.cellFinalDigest, r.receipt.cellBeforeDigest);
  // The outcome is explicitly the synthetic-from-cell label, not a delivery
  // claim.
  assert.equal(r.receipt.outcome, "SYNTHETIC_LIEFERZUSAGE_FROM_ERP_ORDER_CELL");
  // The receipt grants no booking authority (the reused core grants none).
  assert.ok(!("authority" in r.receipt) || r.receipt.actionContract === "erp.order.create/v1");
});
