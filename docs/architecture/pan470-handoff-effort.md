# PAN470 — complete worker handoff + measurable finalization effort (CONTRIB-03)

Bounded first slice. This module makes a worker handoff COMPLETE (it names exact
base/head, completed and unmet AC IDs, commands/exits, evidence locations, integration
surfaces and nonclaims) and makes finalization effort MEASURABLE (exact recorded
intervals per active phase, kept separate from CI wait / idle / unknown, aggregated by
accepted deliverable and by model/harness) — using the EXISTING work-order and receipt
surfaces, with no new telemetry platform.

## Surfaces and entry points

`src/pan470/handoff-effort.mjs` is a read-only, synthetic, local entry point that drives
the ACTUAL released entry points:

- `runSyntheticDevelopmentWorker()` (dev-worker controller) — the base `WorkReceiptV1`.
- `validateReceiptDigest()` (dev-worker controller) — the existing mandatory receipt
  gate, retained and re-checked (AC03).
- `WORK_ORDER_SCHEMA_V1` / `WORK_RECEIPT_SCHEMA_V1` — the existing work-order/receipt
  schema identities the handoff is bound to.

## Functions

| Function | Role |
| --- | --- |
| `buildHandoffReceipt({order, receipt, baseCommit, headCommit, completedAcIds, unmetAc, commands, evidence, integrationSurfaces, nonClaims})` | Add the completeness fields a base `WorkReceiptV1` lacks; emit `handoffDigest`. |
| `validateHandoffReceipt(handoff, {evidenceRoot})` | Fail-closed validation; malformed receipts and stale evidence (recorded sha256 no longer matches current bytes / missing file) do NOT imply completion. |
| `measureEffort({deliverableId, modelAlias, harnessDigest, intervals, passive})` | Exact recorded intervals per active phase (IMPLEMENTATION, SELF_CHECK, REVIEW, CORRECTION, FINALIZATION) separate from passive (CI_WAIT, IDLE, UNKNOWN); `activeTotalMs`. |
| `aggregateEffort(records)` | Aggregate by accepted deliverable and by model/harness; passive summed separately. |
| `composeCompletedHandoff({workOrder, frozenBaseCommit, candidateHeadCommit, ...})` | Compose ONE real completed handoff through the released entry points (self-check gate retained). |
| `generateHandoffReport({handoff, effortRecords, evidenceRoot})` | Report generation from one real completed handoff + effort; `nonRetrospective: true`. |

## Denial codes (fail-closed)

`HANDBOFF_RECEIPT_SCHEMA_DENIED`, `HANDBOFF_RECEIPT_DIGEST_MISMATCH`,
`HANDBOFF_BASE_MISMATCH`, `HANDBOFF_HEAD_MISSING`, `HANDBOFF_WORK_ORDER_DIGEST_MISMATCH`,
`HANDBOFF_AC_EMPTY`, `HANDBOFF_AC_DUP`, `HANDBOFF_AC_UNKNOWN`, `HANDBOFF_AC_OVERLAP`,
`HANDBOFF_COMMAND_EMPTY`, `HANDBOFF_COMMAND_EXIT_INVALID`, `HANDBOFF_EVIDENCE_EMPTY`,
`HANDBOFF_EVIDENCE_MISSING`, `HANDBOFF_EVIDENCE_STALE`, `HANDBOFF_INTEGRATION_EMPTY`,
`HANDBOFF_NONCLAIMS_EMPTY`, `EFFORT_INTERVAL_INVALID`, `EFFORT_PHASE_UNKNOWN`,
`EFFORT_STATE_UNKNOWN`, `EFFORT_INTERVAL_OVERLAP`.

## Non-claims

- No percentage of effort is inferred from tokens, commit counts or overlapping wall
  time; passive time is never folded into active effort (AC02 / non-retrospective).
- Bookkeeping is not a new blocking delivery gate (AC03).
- No live publication, production/customer/host data, or credentials; synthetic local
  evidence only.

## Evidence

`tests/fixtures/pan470/evidence-selfcheck-v1.txt` is the exact-byte self-check evidence
the handoff's evidence location binds to; `validateHandoffReceipt` re-derives its sha256
from current on-disk bytes to prove the receipt is not stale (AC03).
