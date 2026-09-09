# WORK_RESULT — PS364 AP-04 ERV relational hardening v2

Status: local work complete. NOT delivered. Per directives the parent performs
independent review, exact PR/Main CI, release, and anonymous readback. No push,
no public mutation, no credentials, no external systems, no issue closure.

## Task

"Preserve the historical AP-04 proof while adding a small versioned relational
hardening slice and exact evidence terminology" (parent #360, related #390;
complete before #366; patch bounded, package refactoring out of scope).

## Source inspection (fresh Main, e36dc23)

SOURCE_ALREADY_PRESENT for the historical proof: AP-04 v1 ERV core is present
and replayable — `packages/contracts/src/incoming-invoice-erv.ts`, frozen 8-case
pack `tests/fixtures/incoming-invoice/ap-04-erv-cases-v1.json` (RAW
`136bbdfcb61bf48ab0043d828dbf797e9b9156f58d284cc7f9b921da59040845`),
`tests/incoming-invoice-erv.test.ts` 8/8 green. v1 was not rebuilt; the v2
slice is additive and pins the v1 decision digest (`b9fde591a23ff0d67987aac87bbf756101ab17cb5b0d2ef8f329b33b23833ed3`)
in v2 test R-12, and re-runs the v1 suite as regression (8/8 after wiring).

Missing relational behavior demonstrated RED before implementation:

- RED-A (acceptance 4): no versioned mode verifies supplier/quantity/unit/
  currency relations — wrong supplier at an equal amount cannot return
  CONFLICT and amount-level behavior cannot express `UNKNOWN` for an
  unverified relation.
- RED-B (acceptance 3): no deterministic, order-independent denial of
  duplicate reference kinds; a last-write-wins merge is possible.

## Added files (v2 slice)

- `packages/contracts/src/incoming-invoice-erv-relational-v2.ts` — versioned
  relational matcher: five-branch decision
  (MATCHED/CONFLICT/UNKNOWN/EXCEPTION/DENIED); amount-level modes verify only
  match amounts and return `UNKNOWN` — never `MATCHED` — while a supplier,
  quantity, unit, or currency relation is not enforced by the versioned mode;
  relational modes return `CONFLICT` on a wrong relation at equal amounts;
  duplicate reference kinds denied deterministically and order-independently
  (no last-write-wins); four distinct evidence dimensions
  (`integrityVerified`, `originVerified`, `semanticsVerified`,
  `runtimeObserved`); `deterministicReplay` block with policy
  `LOCAL_COMPILER_DETERMINISTIC_REPLAY` and no `readback` key; six frozen
  nonclaims including `NO_SYSTEM_OF_RECORD_READBACK_PERFORMED`. All outputs
  deep-frozen.
- `tests/fixtures/incoming-invoice/ap-04-erv-relational-cases-v2.json` — frozen
  16-case local-synthetic pack (RAW `a6888ec06f92d4236061b393c2ed3e0d7fd54ca9875558b9a3b7295d25fe6ae5`,
  CANONICAL `3f80e39ffcfa7f437f1995be33c0af931ba696c7dd408e0a9b0352298b88e565`).
- `schemas/contracts/incoming-invoice-erv-relational-v2.schema.json` — draft
  2020-12 schema for the v2 decision/evidence package.
- `tests/incoming-invoice-erv-relational.test.ts` — R-01..R-13 strict-TDD
  suite (positive and negative: wrong supplier at equal amount, quantity
  mismatch, duplicate/permuted references, currency mismatch, substituted body
  with recomputed caller hash, v1 pack byte-identity and digest pin).
- `docs/evidence/WORK_RESULT.md` — this file (repository-only, not public).

## Wiring

- `packages/contracts/src/index.ts`: barrel export for the v2 module.
- `package.json`: `incoming-invoice-erv-relational:test` and
  `incoming-invoice-erv-relational:test:compiled` scripts plus exactly-once
  registration in the canonical pretest.

## Public wording (acceptance 2, 7)

- `docs/INCOMING-INVOICE-PROVING-GROUND.md`, AP-04 package section: now
  distinguishes versioned amount-level matching (verifies only match amounts;
  `UNKNOWN`, never `MATCHED`, while a relation is not enforced by that mode)
  from general invoice/PO/receipt matching (relational modes return `CONFLICT`
  on a wrong relation at equal amounts); states deterministic,
  order-independent duplicate-kind denial (no last-write-wins); names the four
  distinct evidence dimensions; states that repeating the local compiler is
  deterministic replay of frozen local-synthetic inputs, not an external or
  system-of-record readback; and that the standalone authority-free core
  remains useful without ERP or posting. The
  `WORK_IN_PROGRESS_PLANNED_NOT_DELIVERED` marker (asserted by
  `tests/release-governance.test.mjs`) is preserved.
- `README.md`: unchanged — the AP-01..AP-06 chain already exists and is
  asserted verbatim by release-governance; keeping the patch bounded.

## Governance registration (additive; no governance weakened)

- `verification/verification-dag-v2.json`: new node
  `ap-04-incoming-invoice-erv-relational-v2` (dependsOn the v1 node; six sha-
  bound inputs across CONTRACT/FIXTURE/SCHEMA/VALIDATOR/SOURCE roles;
  `ownedTests` = `npm run incoming-invoice-erv-relational:test`; five
  invariants; `riskClass` HIGH; `globalInvalidation` false); `graphVersion`
  46 to 47; 56 nodes.
- `scripts/refresh-integrity-data.mjs`: `graphVersion` 47 (script digest
  `11a5f5657e40951d323538bb2fc51d970a31843d0a2c5681126785b3074cbed0`).
- Exact-count sites advanced in lockstep: `tests/verification-fabric-v2.test.ts`
  (graphVersion 47; public manifest 1477), `tests/contribution-intake-ledger.test.ts`
  CCP-M1-INT-026 (graphVersion 47; 56 nodes), `tests/release-governance.test.mjs`
  (1477), `scripts/build-public-release.sh` (1477),
  `tools/video-production-reference/tests/slice.test.mjs` independent DAG
  oracle (graphVersion 47 — this site was found by the full-suite run and
  advanced, matching the per-bump convention recorded in `closure-audits/`).
- `release/public-files.manifest`: +4 files (v2 module, v2 schema, v2 fixture,
  v2 test) at family-block positions following the AP-05 delivery; public
  count 1473 to 1477.
- FND-PS-04 census (`tests/canonical-json-profile-inventory.test.ts` +
  `verification/canonical-json-profile-inventory-v1.json`): V11 migration
  entry `PS364-AP04-ERV-RELATIONAL-V2/INTEGRITY-GENERATOR/V11` (from
  `2a0f330f...` to `11a5f565...`); `filesScanned` 624; ledger 1791/1791/0;
  `importSites` 205 unchanged (`canonicalJsonV1` is not `canonicalJson` under
  the word-boundary rule); migration chain `[2..11]`.
- `tools/video-production-reference/SHA256SUMS`: local closure manifest
  re-pins `tests/slice.test.mjs` to `2cde95fe...` (manual re-pin; the
  repository-root refresh script binds but does not regenerate this
  repository-only contract).
- `SHA256SUMS`: 1791 entries; `sha256sum --check` all OK.

## Commands and actual results (local, offline, Node 24)

All npm commands required `--cache /tmp/npm-cache` (read-only home).

- `npm run build --silent --cache /tmp/npm-cache` — exit 0.
- `npm test --cache /tmp/npm-cache` — pretest (build + 25 focused suites) fully
  green, including `incoming-invoice-erv:test:compiled` 8/8 and
  `incoming-invoice-erv-relational:test:compiled` 13/13 and `video:test`
  116/116; main suite: 717 tests, 708 pass, 9 fail (see Unresolved gates).
- `npm run lint --cache /tmp/npm-cache` (`tsc -p tsconfig.json --noEmit`) —
  exit 0.
- `npm run release-governance:verify --cache /tmp/npm-cache` —
  `RELEASE_GOVERNANCE_PASS`, exit 0.
- `npm run release-governance:test --cache /tmp/npm-cache` (release-governance
  + public-product-spelling) — 85/85.
- `sha256sum --check SHA256SUMS` — 1791/1791 OK.
- Targeted governance suites (compiled): verification-fabric-v2 31/31,
  contribution-intake-ledger 27/27, canonical-json-profile-inventory 35/35;
  uncompiled: release-governance 80/80, video 116/116.
- A/B on pristine HEAD (`git worktree add /tmp/pristine-main HEAD`, removed
  afterwards): the 9 docker-dependent failures reproduce identically without
  this patch (29 tests in the five affected files: 20 pass, same 9 fail);
  cscl-09 product-candidate passes 5/5 on pristine and in-tree.

## Unresolved gates

- 9 main-suite failures, all `spawnSync docker ENOENT` (no docker binary or
  daemon in this sandbox): `tests/builder-agent-runtime.test.mjs` (2),
  `tests/managed-skill-lifecycle-runtime.test.mjs` (2),
  `tests/model-access-broker-runtime.test.mjs` (1),
  `tests/openclaw-agent-runtime-lock.test.mjs` (2),
  `tests/openclaw-agent-runtime.test.mjs` (2). A/B-confirmed pre-existing at
  e36dc23; CI installs Compose before that step. Independent of every file in
  this patch.
- Parent-side gates (out of scope per directives, not performed here):
  independent review, exact PR/Main CI, release, anonymous readback.

## Nonclaims

- `NO_SYSTEM_OF_RECORD_READBACK_PERFORMED`; no ERP integration, no external
  providers, no productive allocation/posting/booking authority; synthetic,
  non-customer data only. The historical AP-04 v1 pack, contract, schema and
  tests remain byte-identical and replayable. Nothing here is a claim that the
  work is delivered.

## Correction — candidate release-title gate (post v2 commit)

Status: local correction complete. NOT delivered. The prior v2 work commit
(`ec7b60b`) is preserved untouched; this correction is a new, minimal,
additive commit on top of it. No history rewrite, no frozen pack/contract/test
mutation, no public mutation.

Rejected gate (exact): `Denied: functional release title required`.

Root cause: the exact release-body contract
(`release/governance.json#releaseBodyContract`) and the publication-evidence
rule in `docs/RELEASE-GOVERNANCE.md` require every publication to carry a
functional increment title and a named intended class, and the repository's
candidate records had no repository-only declaration binding this candidate to
that requirement. The v2 slice recorded the code evidence but did not declare
the functional release title, intended class or exact expected tag for the
source/evidence-only release this candidate is bound to.

Correction (additive; TDD RED -> GREEN; no governance weakened):

- RED: `tests/release-governance.test.mjs` gains a fail-closed validator
  `validateCandidateReleaseTitle` and a focused suite
  "candidate AP-04 relational hardening declares a functional release title
  (issue #393)". It fails on the fresh tree with
  `CANDIDATE_RELEASE_TITLE_MISSING` (declaration absent).
- GREEN: `docs/evidence/ap-04-erv-relational-release-title-v1.json`
  (repository-only, not public) declares, for candidate base
  `ec7b60b29700aa8d1b66280f756f5d11315dac9b`:
  - functional increment / release title:
    `PanSphaira — AP-04 ERV relational hardening: bounded relational matching
    and exact evidence semantics (Increment Candidate)`,
  - intended class `SOURCE_EVIDENCE_ONLY` (asset contract
    `NO_CUSTOM_ASSETS_SOURCE_ONLY`), cross-checked against
    `release/governance.json#releaseTaxonomy.classes[1]`,
  - exact expected tag `pan364-ap04-erv-relational-v2-source-v1` (the
    `pan<portfolio>-<slug>-source-v1` source-evidence tag convention),
  - the eight required body-contract sections and
    `NO_ASSETS_SOURCE_ONLY`, plus the exact closure-state markers
    `PUBLIC_READBACK: PENDING` and
    `ISSUE_QUEUE_TERMINAL: BLOCKED_PENDING_PUBLIC_READBACK`, all bound to the
    frozen `releaseBodyContract` in `release/governance.json`,
  - `delivered: false` and the three frozen nonclaims
    (`NO_SYSTEM_OF_RECORD_READBACK_PERFORMED`,
    `NOT_DELIVERED_NO_PUBLIC_MUTATION_NO_TAG_NO_RELEASE`,
    `NO_PRODUCTIVE_POSTING_OR_ALLOCATION_AUTHORITY`).
- `tests/release-governance.test.mjs` SHA-256 re-pinned in
  `SHA256SUMS` (entry count unchanged at 1791; `sha256sum --check` all OK).
- `verification/verification-dag-v2.json` lockstep re-pin: the
  `repository-integrity` node's input digest for
  `tests/release-governance.test.mjs` advanced to the corrected file's bytes
  (single hash change; `graphVersion` remains 47; node count unchanged at 56),
  and the DAG's own `SHA256SUMS` entry re-pinned to the re-pinned DAG bytes.
  No exact-count site changed (graphVersion 47, public count 1477, ledger
  1791/1791/0). The new declaration file, like `WORK_RESULT.md`, is a
  repository-only evidence record and is deliberately not added to the
  frozen 1791-entry census ledger.

The declaration is a repository-only planning record. It grants no
publication, tag, release, delivery or external authority; it is not a claim
that this candidate is delivered.