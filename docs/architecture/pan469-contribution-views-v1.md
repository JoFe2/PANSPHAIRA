# PAN469 — low-conflict contributions via generated shared views

Bounded, repository-local pilot for one module family using **independent
contribution records** and a **deterministic generated shared view** instead of
many contributors editing one shared list (CONTRIB-02, issue #469).

## Scope

`src/pan469/contribution-views.mjs` is the new module; the affected existing
entry points (`module:new` scaffold, `module:check`, `module:graph`,
`module:release` inventory in `scripts/module-contribution.mjs`) are reused for
the bounded contribution modules and their byte-bound inventory. This module
adds only the contribution-record layer and the order-independent derivation
that turns a **set** of individual records into one shared view with a **single
integration owner**.

## Behavior

1. **Individual records (CONTRIB-02-AC01).** `newContributionRecord` /
   `processContributions` admit ten distinct bounded contributions for one
   family. Each record is individually preserved: its bytes are sealed by
   `recordSha256` over its canonical content, so the record survives the
   generated shared view unchanged and later tampering is detectable.
   Fail-closed controls: a re-submitted identical record is refused
   (`CONTRIBUTION_DUPLICATE`), the same id with different content is refused
   (`CONTRIBUTION_ID_CONFLICT`), and a malformed record is refused with its
   exact code. None of these imply a successful contribution.

2. **Deterministic shared view (CONTRIB-02-AC02).** `deriveSharedView` sorts
   the accepted set by id and canonical-encodes the manifest, so differently
   ordered input reproduces byte-identical output. The shared view declares a
   single integration owner (`single-integration-owner-derived-view`);
   contributors never edit the shared list, they add/replace individual records
   and the view is regenerated from the set. `detectViewDrift` refuses a
   hand-edited shared view (`SHARED_VIEW_DRIFT`) by re-deriving from the
   individual records and comparing digests. The empty set is refused
   (`SHARED_VIEW_EMPTY`).

3. **Work measurement (CONTRIB-02-AC03).** `measureContributorSteps` counts
   contributor steps, duplicate/conflict/correction counts and active
   integration work against the existing shared-list path on the same input.
   Counts are integers; no wall-clock timing is inferred — missing timing
   stays `unknown`. A refused conflict is not counted as a completed correction;
   canonical acceptance remains a separate gate, not a true flag in this report. Non-integer or negative counts are refused
   (`CONTRIBUTOR_MEASUREMENT_NON_INTEGER`). The same applicable acceptance
   applies to both paths.

## Census note

This module defines its own local canonical encoder
(`encodeContributionCanonical`) and deliberately does **not** import or declare
the repository `canonicalJson` symbol, so the canonical-json census dimensions
are unchanged (same design decision as the PAN470 module). Only `filesScanned`
advances by the number of new scanned source files.

## Non-claims

- One-family pilot only; no evidence for thousands of contributions per day
  and no separate contribution platform.
- No public writes; synthetic pilot data only; no real contributor identities.
- No new CI, no new publishing authority, no replacement of the canonical
  full-suite CI.
- Local candidate only; independent acceptance, integration, exact-head CI,
  release and public readback remain with the delivery owner.
