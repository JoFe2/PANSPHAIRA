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
| `erp-read-connector.ts` `readErpOrdersFromLabelledSourceBytesV1` | Executed on the exact labelled local-synthetic source bytes; proves order records and reader metadata | REUSE |
| `erp-read-connector.ts` `createErpReadAdapterV1` `LIST_CUSTOMERS` | Executed and **drained across pages by its own cursor** before joining customer status | REUSE |
| `erp-read-connector.ts` contract `chimpmaera.connector/erp-read/v1` | The released order/source definition; verified via `verifyErpReadConnectorContractV1` | REUSE |
| `erp-order-capability-cell.ts` `ERP_ORDER_SEMANTICS_V1` | Retained **only as explicitly non-evidentiary capability metadata** for this reader (no per-order quantity or unit is evidenced) | REUSE (vocabulary only) |

No second order-management module is introduced. The adapter is a thin,
read-only composition over the actual released reader results.

## What is exposed (evidenced facts only)

The handoff exposes only these evidenced order/customer/status/period facts:

- `orderIdentity` — `orderId`, `customerId` from the actual order reader.
- `customerIdentity` + `customerStatus` — from the actual `LIST_CUSTOMERS`
  reader **drained to completion by cursor** (bounded page ceiling, per-page
  readback re-verification, consistent page identity across pages, no repeated
  page content); a referenced customer absent from the fully drained reader is
  `UNAVAILABLE`, never inferred, and never an unread page mislabelled as a
  missing fact.
- `orderStatus` — the reader's closed `OPEN` / `FULFILLED` / `CANCELLED`.
- `orderPeriod` — calendar month derived from the evidenced `orderDate`.

`statusCounts` is an evidence-only count over the reader's status field. It is
**not** revenue.

## What is explicitly withheld

Net revenue is **never** inferred from order status or ordered quantity. The
released order reader exposes `totalMinor`, but the handoff performs **no**
monetary conversion and exposes no amount, currency value, net revenue,
delivery fact, historical order-book fact, order-intake aggregate, or
credit/cancellation netting.

**Per-order quantity and unit are UNAVAILABLE for this reader.** The selected
source and the released reader expose exactly
`orderId, customerId, orderStatus, orderDate, totalMinor, currency` — no
quantity, no unit, no order-create capability binding. Every supported order
therefore carries the closed object `{ quantity: "UNAVAILABLE", unit: "UNAVAILABLE" }`;
a unitless reader result never becomes a per-order `EACH` fact. The
capability-cell vocabulary (`ERP_ORDER_CREATE_DISCRETE_UNITS_V1`,
`DISCRETE_UNITS`, `EACH`) is retained only as explicitly non-evidentiary
capability metadata, not as a per-order unit claim.

Absent facts remain `REVENUE_AND_HISTORY_UNAVAILABLE` with a closed
`facts` / `missingFields` / `nonClaims` list, **embedded in the binding** so
the explicit unavailable/history semantics are digest-bound to the consumer
contract, survive serialization, and are returned on rebind.

## Authority boundary (no caller-rehashed facts)

`verifyOrderSourceRead` and the customer-page verification are **non-authoritative
projection checks** (the order verifier is exported): they verify shape and the
caller-recomputable readback hash of caller-owned results, but verification of
a caller-rehashed projection is never approval. A forged record set that
merely re-proves its own readback hash cannot re-establish the source identity.

Source consistency is established where the released readers are **executed by
the handoff itself** against independently selected source bytes, the released
read contract, and the decision time; selection authority remains external:

- `createKs238OrderSourceHandoff({ contract, sourceBytes, sourceLabel, enabled,
  now })` owns the actual reader execution (including the cursor drain).
- `rebindSerializedOrderSource({ sourceLabel, sourceBytes, sourceBytesSha256,
  contract, now, binding, bindingDigest })` accepts **no caller-owned reader
  results at all**. It re-executes the released readers against the
  independently retained identity carried **outside the substituted payload**
  (label, source bytes, their sha256, the released contract, the decision
  time), and the freshly derived binding must match the carried
  binding/digest exactly.

Consequences (all covered by focused negatives with exact denial codes):

- A caller-rehashed forged reader result (changed customer/status with a
  recomputed readback hash) is not authority: the genuine rebind still reports
  the true order; carrying the forged projection's binding against the
  genuine retained source is `DENIED / SERIALIZED_BINDING_MISMATCH`.
- A resealed substituted source **plus** its matching new binding (both
  substituted) against the originally retained source identity is
  `DENIED / SERIALIZED_BINDING_MISMATCH` — source-plus-binding replacement is
  not approval of an already selected source.
- A wrong retained sha256 for the carried bytes is `DENIED / SOURCE_BYTES_MISMATCH`;
  missing rebind identity is `DENIED / REBIND_INPUT_REQUIRED`.

## Source binding and serialization

`adaptOrderSourceToSalesAnalysis()` re-verifies and re-digests caller-owned
reader-result records and metadata. Its content binding (`tenantId`,
`sourceDigest`, `sourceBytesSha256`, `readbackDigest`, `customerSourceDigest`)
is a consistency projection, not independent evidence or approval.

`rebindSerializedOrderSource()` checks the transported `binding` +
`bindingDigest`, including the embedded closed `unsupportedFacts` contract,
against a fresh reader execution. The receiving integration must retain the
selected source bytes/hash, contract and decision time independently of the
transported payload. With that anchor unchanged, substituted records or bindings
are denied and unsupported/missing semantics survive the round-trip.

This helper does not establish who may select or replace the trusted inputs.
A caller able to replace both the retained inputs and the payload can select a
new internally consistent source; the helper alone cannot detect that authority
violation. Downstream integration owns retention and authorization of that anchor.
A successful `REBOUND` is source consistency, never production or publication approval.

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
- No production ERP qualification and no complete KS238 capability is claimed;
  no revenue or order-intake monetary facts are produced or implied.

Focused proof: `node --test tests/ks238/order-source-handoff.test.mjs`
(run after `npm run build`). Canonical command: `npm test`.
