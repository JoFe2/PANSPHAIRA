# KS238 — bounded PAN order/source handoff to the sales analysis

Status: `LOCAL_SYNTHETIC_SOURCE_HANDOFF_IMPLEMENTED`

This is the concrete PAN-side source handoff required by KaleidoSphere KS238
(SALES-ANALYSIS-01). It reuses the released order/source definitions and
existing capability cells rather than building a second order module. It is a
local synthetic source handoff, **not** production ERP qualification and **not**
a complete KS238 capability.

## Reused actual modules

| Foundation | KS238 use | Classification |
| --- | --- | --- |
| `erp-read-connector.ts` `readErpOrdersFromLabelledSourceBytesV1` | Executed on the exact labelled local-synthetic source bytes; proves order/customer records and reader metadata | REUSE |
| `erp-read-connector.ts` `createErpReadAdapterV1` `LIST_CUSTOMERS` | Evidences customer status for each referenced customer | REUSE |
| `erp-read-connector.ts` contract `chimpmaera.connector/erp-read/v1` | The released order/source definition; verified via `verifyErpReadConnectorContractV1` | REUSE |
| `erp-order-capability-cell.ts` `ERP_ORDER_SEMANTICS_V1` | Bounded discrete-unit (`DISCRETE_UNITS` / `EACH`) quantity semantics | REUSE |

No second order-management module is introduced. The adapter is a thin,
read-only composition over the actual released reader results.

## What is exposed (evidenced facts only)

The handoff exposes only these evidenced order/customer/status/quantity/unit/
period facts:

- `orderIdentity` — `orderId`, `customerId` from the actual order reader.
- `customerIdentity` + `customerStatus` — from the actual `LIST_CUSTOMERS`
  reader; a referenced customer absent from that reader is `UNAVAILABLE`,
  never inferred.
- `orderStatus` — the reader's closed `OPEN` / `FULFILLED` / `CANCELLED`.
- `orderPeriod` — calendar month derived from the evidenced `orderDate`.
- `quantityUnit` — the bounded capability-cell discrete-unit semantic
  (`ERP_ORDER_CREATE_DISCRETE_UNITS_V1`, `DISCRETE_UNITS`, `EACH`).

`statusCounts` is an evidence-only count over the reader's status field. It is
**not** revenue.

## What is explicitly withheld

Net revenue is **never** inferred from order status or ordered quantity. The
released order reader exposes `totalMinor`, but the handoff performs **no**
monetary conversion and exposes no amount, currency value, net revenue, ordered
quantity, delivery fact, historical order-book fact, order-intake aggregate, or
credit/cancellation netting. Absent facts remain `REVENUE_AND_HISTORY_UNAVAILABLE`
with a closed `missingFields` list.

## Source binding and serialization

`adaptOrderSourceToSalesAnalysis()` re-verifies and re-digests both actual
reader results; it never accepts a caller-supplied digest or label as approval.
The content binding (`tenantId`, `sourceDigest`, `sourceBytesSha256`,
`readbackDigest`, `customerSourceDigest`) is derived from the records plus the
reader metadata, not from any caller field.

`rebindSerializedOrderSource()` proves the binding survives serialization: a
downstream analysis may carry the `binding` + `bindingDigest`, and on receipt it
is re-derived from the actual reader results. A caller that reseals or
substitutes the source (or the digests) fails closed with
`SERIALIZED_BINDING_MISMATCH` — the re-bound result is only approval when the
reader-derived binding matches exactly.

## Public entry point

`createKs238OrderSourceHandoff({ contract, sourceBytes, sourceLabel, enabled,
now })` owns the actual reader execution. Callers provide only the labelled
source bytes, the released read contract, and the decision time; a
caller-supplied read-result object is never accepted as handoff authority.

## Boundary and nonclaims

- Read-only; no network, provider, runtime, model, write, approval, mutation,
  publication, public-write, purchasing, or order-management authority.
- No KS guided CLI is added or duplicated; the KS question/source/period
  decision surface remains separately owned by Flash.
- Independent review and public delivery remain owned by
  Hermes/Supervisor e2e345eb187a.

Focused proof: `node --test tests/ks238/order-source-handoff.test.mjs`
(run after `npm run build`). Canonical command: `npm test`.
