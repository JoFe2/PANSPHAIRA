import test from "node:test";
import assert from "node:assert/strict";
import {
  DEFAULT_SALES_STOCK_JOURNEY_INPUT_V1,
  runSalesStockJourneyV1,
  runSalesStockNegativeProbeV1,
} from "../packages/contracts/src/sales-stock-journey-v1.js";

test("connected local sales/stock journey retains M1 -> M3 -> M2 -> M3 lineage", () => {
  const result = runSalesStockJourneyV1();
  assert.equal(result.outcome, "CONNECTED_SALES_STOCK_JOURNEY");
  if (result.outcome !== "CONNECTED_SALES_STOCK_JOURNEY") return;
  assert.equal(result.identity.adapterId, "adapter:m1-eink-001-to-m3-syn-art-001-to-m2-cell-001");
  assert.equal(result.stages.bestellung.positionen[0]?.artikelId, "EINK-ART-001");
  assert.equal(result.stages.wareneingang.angenommeneMenge, 50);
  assert.equal(result.stages.stockAfterReceipt.positions[0]?.physisch, 70);
  assert.equal(result.stages.lieferproposal.entscheidung.art, "LIEFERZUSAGE");
  assert.equal(result.stages.reservation.lage.positions[0]?.reserviert, 60);
  assert.equal(result.stages.reservation.lage.verlauf.length, 2);
  assert.equal(result.stages.reservation.lage.verlauf[1]?.beleg?.belegId, "request:erp-cell-sales-stock-001");
  assert.equal(result.stages.replenishment.outcome, "NACHSCHUB_ERFORDERLICH");
  assert.equal(result.stages.replenishment.verfuegbar, 10);
  assert.equal(result.stages.replenishment.frische.outcome, "BESTANDSFRISCHHEIT_BEWIESEN_AKTUELL");
});

test("shortage is a clarification and cannot be turned into a promise", () => {
  const result = runSalesStockJourneyV1({ ...DEFAULT_SALES_STOCK_JOURNEY_INPUT_V1, requestedQuantity: 80 });
  assert.equal(result.outcome, "CONNECTED_SALES_STOCK_CLARIFICATION");
  if (result.outcome !== "CONNECTED_SALES_STOCK_CLARIFICATION") return;
  assert.equal(result.clarification.grundCode, "ENGPASS_MENGE_OBER_VERFUEGBAR");
});

test("reservation over available stock is denied without a partial state", () => {
  const result = runSalesStockNegativeProbeV1("reservation-conflict");
  assert.equal(result.outcome, "DENIED");
  if (result.outcome !== "DENIED") return;
  assert.equal(result.stage, "BESTAND_RESERVATION");
  assert.equal(result.code, "AENDERUNG_INSUFFICIENT_AVAILABLE");
});

test("stale retained stock evidence denies replenishment", () => {
  const result = runSalesStockNegativeProbeV1("stale-observation");
  assert.equal(result.outcome, "DENIED");
  if (result.outcome !== "DENIED") return;
  assert.equal(result.stage, "NACHSCHUB");
  assert.match(result.detail, /stale/i);
});
