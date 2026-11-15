# Native ERV KS price-variance QUERY adapter v1 (PAN692, source-only)

This documents the actual reachable contract of `src/pan542/ks-price-variance-query.mjs`
as registered on the existing `pan542-native-erv-human-v1` owner. It is derived
evidence from the registered native tests only; it is not a UI, real-model,
real-data-source, whole-PAN617 or release acceptance.

## What it is

One bounded adapter for exactly one closed deviation type (`SUPPLIER_PRICE_VARIANCE`).
It runs the actual pinned external KaleidoSphere procurement price computation
(`services/bi-control/src/business-bi/procurement-analysis.mjs`, commit
`5550c603b005c9c168f39f4047b1b46d2c076409`, file sha256
`7eb01232c7ae93f42e9fa390f20acae26e543b6f0970a1b31567acfc3b957cf6`) over a
code-owned minimized synthetic native basis and, after one separate explicit
confirmation, dispatches the existing native PAN542 QUERY. `KS692_KS_SOURCE`
must name the actual pinned checkout; a missing, foreign, different-commit or
dirty checkout denies (`KS_PRICE_VARIANCE_SOURCE_PROVENANCE_DENIED` /
`KS_PRICE_VARIANCE_PINNED_SOURCE_DENIED`). KS is pinned public code here, not a
new real data source.

## Reachable surface

- `prepare({invoiceId})` recomputes the candidate from current native state and
  returns a frozen receipt with `candidateHandle`/`candidateDigest` binding the
  finding, the pinned KS commit/file hash, the code-owned invoice identity, the
  native/proposal revision and digest, and the session scope. Only the two
  closed code-owned invoice bindings are selectable
  (`AP-PAN516-MATCHED-01`, `AP-PAN516-PARTIAL-01`); the registered tests cover
  `AP-PAN516-MATCHED-01`. The synthetic invoice keeps its own identity: it is
  explicitly not relabeled as the COMMON `purchase_invoice`, and the confirmed
  native unit price replaces the source PO net price in the minimized basis.
- `confirm({candidateHandle,candidateDigest,confirm:true})` re-verifies the
  pinned KS provenance/bytes, recomputes the candidate, requires an exact
  digest+handle match owned by the same authenticated subject, requires
  `queryAllowed` (actual nonzero variance, QUERY-capable state, mapped
  REVIEWER-role readback) and then dispatches the single native QUERY decision.
  Tampered/foreign/stale handles deny (`KS_PRICE_VARIANCE_CONFIRM_STALE_OR_FOREIGN_DENIED`,
  `KS_PRICE_VARIANCE_FOREIGN_CANDIDATE_DENIED`, `KS_PRICE_VARIANCE_NO_QUERY_ALLOWED_DENIED`).
  Inside the existing native `BEGIN IMMEDIATE` commit callback the KS source is
  re-checked byte-exact, so post-begin drift denies with zero events and zero
  new fences. The single-use `queryEffectId` makes a replay a stale/foreign or
  already-decided denial, never a second effect.
- `read`/`reconcile` are the existing native PAN542 read and committed-response-loss
  reconciliation, unchanged.

## Authority and persistence boundary

Rights come only from the existing PAN542 protected sessions, roles, CSRF,
CAS revisions, task identity and STOP/REVOKE controls; KS text, digests or
labels grant nothing. The adapter is a pure read-only attachment to the already
initialized native owner (no re-initialization, no adoption). The explanation
text exists only in the adapter receipt
(`explanationPersistence:'ADAPTER_RECEIPT_ONLY_NOT_NATIVE_DECISION_STORAGE'`);
no new native text persistence, store, metric kernel or HTTP route was added.

## Nonclaims

Zero-variance candidates are not query-allowed and produce no effects. Only the
closed registered invoice scope is proven. This is not browser/human, real-model,
KS-real-data, whole-617/289/250, canonical-CI or release acceptance, and it
gives no booking, payment, dispatch or execution authority.
