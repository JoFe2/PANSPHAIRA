# PAN435–436 connected local sales/stock journey v1

This increment is an offline, labelled synthetic composition. It does not add a provider, runtime, credential, notification, procurement dispatch, public write, or durable ERP/warehouse mutation.

## Connected path

1. M1 creates a synthetic purchase draft and records one idempotent goods receipt.
2. The explicit `adapter:m1-eink-001-to-m3-syn-art-001-to-m2-cell-001` maps the M1 article to the M3 article/location and preserves the source-bound receipt evidence.
3. M3 applies the receipt to a digest-bound stock position with retained origin and lineage.
4. M2 evaluates a customer delivery proposal over that stock evidence through the existing synthetic ERP order capability cell. A shortage is a clarification, never a promise.
5. A successful proposal is represented by an M3 reservation whose retained Beleg points to the M2 request. The reservation quantity is checked against, and then derived from, the accepted sales quantity; mismatches cannot produce connected success.
6. M3 evaluates replenishment only after the reservation, under an explicit freshness policy. The result is a nonbinding proposal.

The identity adapter is intentionally explicit: `EINK-ART-001`, `SYN-ART-001 @ LAGER-01`, and `SYN-CELL-ERP-01` are not silently treated as interchangeable. The journey output retains each identity and the adapter id.

## Acceptance boundaries corrected

- F1: timestamps are semantic UTC instants, not regex-only strings, and the closed order is `observedAt <= receiptAt <= decisionAt`; a future receipt is rejected before it can support a promise.
- F2: reservation quantity must equal the accepted proposal quantity. The old over-available reservation-conflict terminal remains a closed insufficient-availability denial.
- F3: the published schema includes the actual success, clarification, and denial branches and requires the non-claims array on connected success and clarification outputs.
- F4: `npm run sales-stock:journey` invokes the positive `cli.mjs run` path and is exercised as the documented entrypoint.
- F5: availability evidence is freshness-bound at the sales boundary. Unknown, future, or more-than-one-day-old stock evidence is a clarification and never a delivery promise.

## CLI and failure paths

`npm run sales-stock:journey` runs the positive path. The offline CLI also exposes `negative receipt-zero`, `negative shortage`, `negative reservation-conflict`, and `negative stale-observation`. These exercise input closure, M2 clarification, M3 available-stock protection, and the sales freshness boundary respectively.

All results are JSON readback from pure local functions. No command in this increment performs a network call or external write.
