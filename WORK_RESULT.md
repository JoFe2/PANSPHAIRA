# WORK_RESULT — CSCL-11 serial holdout gate against the held-out iDempiere ERP

**Status: local PanSphaira change complete. NOT DELIVERED / NOT CLOSED.** This is a
bounded, locally validated source result on fresh current main
`f4a98e0837a0c4d329f394328e86e81b9d81e689` (the V001 delivery-contract commit), with
no legacy CSCL-11 state. The scope is ONLY the CSCL-11 serial holdout gate: it
consumes the three byte-frozen CSCL-08/09/10 capability candidates **read-only**,
builds a held-out iDempiere ERP profile **independently** of those candidates, maps
the holdout facts onto the frozen core/variant/absence/counterexample slots, computes
the frozen coverage/core-preservation/contradiction/unmapped/rewrite metrics with
complete denominators, and emits the independent
`GO / NARROW_GO / FALSIFIED_WITH_EVIDENCE` holdout receipt conforming to
`contracts/cscl-01/holdout-verdict-v1.schema.json` — without holdout tuning, without a
universal-compatibility claim, and without any Authority/promotion/execution claim.
Parent-side gates remain open (see *Unresolved / parent-side gates*): independent
review, semantic main integration, exact PR/Main CI, release + Docker-E2E, and
anonymous / version-bound public readback. The delivery job controller performs fresh
Qwen review, exact PR/Main CI, release and anonymous readback; this work never authors
or approves those receipts and never claims delivered. `publicly_delivered` remains
false. No push, no public mutation, no credentials, no external systems, no issue
closure.

## Task

Execute the CSCL-11 serial holdout gate against the byte-frozen CSCL-08/09/10
capability candidates and the held-out iDempiere ERP. Acceptance criteria:

- **AC1** — Prove no iDempiere semantic source was consumed by CSCL-01..10 beyond
  identity/legal preflight.
- **AC2** — Capture the exact official iDempiere source, documentation and license
  bytes at the pinned commit.
- **AC3** — Build the three-family (Party/Product/Sales) holdout profile
  independently of the candidates.
- **AC4** — Map holdout facts to the frozen core/variant/absence/counterexample slots
  **without editing candidate bytes**.
- **AC5** — Compute the frozen coverage, core-preservation, contradiction, unmapped
  and rewrite metrics with complete denominators.
- **AC6** — Any required core edit is reported as narrowing/falsification,
  **not patched away**.
- **AC7** — Produce the independent `GO / NARROW_GO / FALSIFIED_WITH_EVIDENCE` holdout
  receipt conforming to `contracts/cscl-01/holdout-verdict-v1.schema.json` — without
  holdout tuning, universal-compatibility, or Authority claims.

## Source inspection (fresh main, f4a98e0)

- **RED (feature absent):** at HEAD `f4a98e0` there are no `src/cscl-11/` or
  `tests/cscl-11/` files tracked, no `cscl11:test` script, and the `posttest` chain
  begins at `npm run cscl09:test` (no cscl11). `npm run cscl11:test` is a missing
  script and `node --test tests/cscl-11/holdout-gate.test.mjs` is a missing file.
  Confirmed: `git ls-tree -r --name-only HEAD | grep cscl-11` → none;
  `git show HEAD:package.json | grep cscl11:test` → none.
- **Frozen protocol (read-only, DO NOT EDIT):** `src/cscl-01/protocol.mjs` provides
  `evaluateHoldoutFamily(input)` and `deriveOverallVerdict(familyResults,
  governanceGates)`, plus the internal `GATE_NAMES`
  (`source, legal, history, integrity, denominator, isolation`). The CSCL-11 gate
  drives the verdict through this frozen protocol; it does not redefine it.
- **Byte-frozen candidates (read-only):** `verification/cscl-08-party-candidate-v1.json`
  (frozen `94bd8998…`), `verification/cscl-09-product-candidate-v1.json`
  (frozen `26b2719e…`), `verification/cscl-10-sales-candidate-v1.json`
  (frozen `636c3331…`). The gate re-reads these and asserts
  `actualDigest === frozenDigest` (no mutation); any drift trips
  `CANDIDATE_BYTES_MUTATED_AFTER_FREEZE`.
- **Held-out iDempiere pin:** upstream
  `https://github.com/idempiere/idempiere.git`, commit
  `731515dcdd5278b843db33b9d3109d155b881951` at selector `refs/heads/release-13`,
  license `GPL-2.0-or-later`, `noticeStatus: ABSENT_AT_PIN`, 16 pinned files
  (14 Java + `LICENSE.md` + `README.md`), 36 captured source facts.
- **Governance state to reconcile:** the 15 newly-public cscl-11 files require the
  fail-closed governance reconciliation (manifest `1495 → 1510` data lines; canonical-
  JSON census `filesScanned 636 → 639`, ledger `1811 → 1826`), described below. No gate
  or test is weakened; the count bound and census are the same fail-closed mechanisms
  prior public-file additions maintained.

## TDD (RED → GREEN)

- **RED (base `f4a98e0`, before the fix):** the CSCL-11 holdout gate is entirely
  absent (see *Source inspection*). `npm run cscl11:test` → `missing script`;
  `node --test tests/cscl-11/holdout-gate.test.mjs` → no such file. This is the real,
  non-environmental RED demonstrated before authoring.
- **GREEN (minimal add):** `src/cscl-11/holdout-gate.mjs` + `src/cscl-11/holdout-
  facts.mjs`, `tests/cscl-11/holdout-gate.test.mjs` (16 tests), and 12
  `verification/cscl-11-idempiere-*.json` artifacts. `npm run cscl11:test` →
  **16/16 PASS** (exit 0).
- **Positive (focused):**
  - AC3: the holdout profile bundle is schema-valid, `HOLDOUT` role, 36 source facts /
    36 cells, digest self-consistent, with ≥1 `ABSENT` counterexample and 0
    `SUPPORTED` (no affirmative iDempiere semantic support asserted by the
    candidates).
  - AC2: the source-capture receipt binds exactly 16 pinned files at commit
    `731515d…` with the `GPL-2.0-or-later` license bytes and `ABSENT_AT_PIN` notice.
  - AC4: the product mapping is 1 CORE + 8 VARIANT (`coreTotal=5`,
    `coreIdentityPreserved=5`, 0 unmapped); the party/sales mappings carry
    `coreTotal=0`, which the mapping-receipt schema rejects at
    `/denominators/coreTotal` minimum — **that rejection is the falsification signal,
    not a defect to patch** (AC6).
  - AC5: party/sales → `FALSIFIED_WITH_EVIDENCE`, product → `GO`, all 6 governance
    gates true, overall `NARROW_GO`.
  - AC7: all 4 `holdout-verdict-v1` receipts (party/product/sales/overall) conform to
    the frozen schema and are digest self-consistent.
  - AC1: the isolation proof is `clean: true` — `NO_IDEMPIERE_SEMANTIC_SOURCE_
    CONSUMED_BY_CSCL_01_10`, every candidate `frozenDigestMatchesActual: true` with
    empty `idempiereFactRefs` and empty `nonTrainingSystemIds`.
- **Negative / mutation:**
  - flipping a frozen candidate byte → `CANDIDATE_BYTES_MUTATED_AFTER_FREEZE`.
  - a deliberately broken isolation governance gate → `deriveOverallVerdict`
    `FALSIFIED_WITH_EVIDENCE` + `ISOLATION_HARD_GATE_FAILED`.
- **Toolchain:** all eight frozen `contracts/cscl-01/*.schema.json` compile.

## Source changes (bounded; no governance weakened)

New files (all mode `0644`, registered in the release manifest and
`repository_only`/public set as applicable):

- `src/cscl-11/holdout-gate.mjs` — the gate module: pin/selector/legal constants,
  frozen candidate digests, `buildSourceFacts`, `buildCells`, `buildProfile`,
  `buildProfileBundle`, `buildSourceCaptureReceipt`, `buildMappingReceipt`,
  `ac1HoldoutIsolationProof`, `computeGates`, `buildHoldoutGate`,
  `buildVerdictReceipts`, `writeArtifacts`.
- `src/cscl-11/holdout-facts.mjs` — `FACTS` (36 held-out iDempiere source facts) and
  `FILES` (16 pinned file bytes).
- `tests/cscl-11/holdout-gate.test.mjs` — 16 tests (AC1..AC7 + mutation + negative +
  toolchain).
- 12 `verification/cscl-11-idempiere-*.json` artifacts (source-capture receipt,
  holdout profile, mapping ×3, isolation proof, governance gates, family results,
  holdout verdict ×3 [party/product/sales] + overall).

Modified files (bounded governance reconciliation; fail-closed, not weakened):

- `package.json` — **+1 line** `cscl11:test = node --test tests/cscl-11/
  holdout-gate.test.mjs`, and `cscl11:test` **prepended** to `posttest` (single
  canonical registration).
- `release/public-files.manifest` — **+15** cscl-11 data lines
  (`1495 → 1510` total data lines).
- `scripts/build-public-release.sh` — **line 192**: fail-closed manifest
  count-bound `1495 → 1510` (the single declared owner of that bound; the same
  reconciliation prior public-file additions performed — maintaining the gate, not
  weakening it).
- `tests/verification-fabric-v2.test.ts` — **line 299**: `publicManifestPaths.length`
  `1495 → 1510`.
- `tests/release-governance.test.mjs` — **line 322**: `count` `1495 → 1510`
  (this test cross-checks the builder's regex-extracted bound against the manifest
  data-line count, so it and `build-public-release.sh` move together).
- `tests/canonical-json-profile-inventory.test.ts` — census `filesScanned 636 → 639`,
  ledger `1811 → 1826` (all other census counts unchanged; the cscl-11 imports are
  multi-line and the scanner's `IMPORT_RE` is line-local).
- `verification/canonical-json-profile-inventory-v1.json` — matching
  `freshCounts` (`filesScanned 636 → 639`; `ledgerEntries` and
  `ledgerUniquePaths` `1811 → 1826`); byte-exact `JSON.stringify(…, 2)` round-trip.
- `verification/verification-dag-v2.json` — re-digested by `integrity:refresh`;
  `graphVersion` stays pinned at `47` (no structural change).
- `SHA256SUMS` — re-digested by `integrity:refresh` (`1811 → 1826` entries; +15
  cscl-11, 8 re-digested content-changed files; zero pre-existing entries dropped).

Explicitly **NOT** changed: `src/cscl-01/protocol.mjs` (frozen), the three frozen
candidate byte sets, no test weakened, no exempt prefix widened, no
governance/authority file altered, no credential or execution-policy change.

## Verdict (the independent holdout receipt — AC6/AC7)

`verification/cscl-11-idempiere-holdout-verdict-overall-v1.json`:
`schemaVersion pansphaira.cscl01/holdout-verdict/v1`, scope `OVERALL`.

| Capability family | Applicable facts | Core/Variant/Unmapped | `coreTotal` | Verdict | reasonCodes |
|---|---|---|---|---|---|
| `PARTY_CUSTOMER_MANAGEMENT` | 9 | 0 / 9 / 0 | 0 | `FALSIFIED_WITH_EVIDENCE` | `INVALID_CORE_DENOMINATOR`, `CORE_IDENTITY_OR_MEANING_NOT_100_PERCENT_PRESERVED` |
| `PRODUCT_ITEM_MANAGEMENT` | 9 | 1 / 8 / 0 | 5 | `GO` | `HOLDOUT_FAMILY_GO` |
| `SALES_ORDER_MANAGEMENT` | 10 | 0 / 10 / 0 | 0 | `FALSIFIED_WITH_EVIDENCE` | `INVALID_CORE_DENOMINATOR`, `CORE_IDENTITY_OR_MEANING_NOT_100_PERCENT_PRESERVED` |

- **Overall: `NARROW_GO`**, `reasonCodes: ["ONE_OR_TWO_FAMILIES_GO"]`,
  `verdictDigest 7a8056b2c254256e046116aba9ebb559ebf71b966d5e2d752643fc1c680f18fa`.
  Family receipts: party `d434857e…`, product `0e7342a6…`, sales `850b0e18…`.
- **Governance gates:** `source, legal, history, integrity, denominator, isolation`
  — all `true`.
- **AC1 isolation:** `clean: true`,
  `NO_IDEMPIERE_SEMANTIC_SOURCE_CONSUMED_BY_CSCL_01_10`; all three candidates
  `frozenDigestMatchesActual: true`, `idempiereFactRefs: []`,
  `nonTrainingSystemIds: []`.
- **AC6 (not patched away):** the empty frozen core for party/sales
  (`coreTotal=0`) is reported as `INVALID_CORE_DENOMINATOR` /
  `CORE_IDENTITY_OR_MEANING_NOT_100_PERCENT_PRESERVED` — a narrowing/falsification
  finding, not a defect the gate edits around. The mapping-receipt schema's
  `/denominators/coreTotal` minimum is what rejects it; the gate surfaces that
  rejection as the verdict.
- **Non-claims in the receipt:** `NO_HOLDOUT_TUNING_APPLIED`,
  `NO_UNIVERSAL_ERP_COMPATIBILITY_CLAIM`,
  `NO_AUTHORITY_PROMOTION_OR_EXECUTION_GRANT`,
  `EMPTY_FROZEN_CORE_REPORTED_AS_NARROWING_NOT_PATCHED`; boundary
  `authorityGrant/promotionGrant/executionGrant` all `NONE`.

## Commands and actual results (local, offline-capable, Node ≥ 24)

Ran on fresh current main `f4a98e0`. Environment note: `/tmp` is a 1.0G RAM-backed
tmpfs; the public-release staging test copies the ~52M public file set into `/tmp`, so
`/tmp` staging dirs are cleaned between runs (a run that starts on a full `/tmp`
fails only with `ENOSPC`, not an assertion — see *Full suite result*).

1. `npm run cscl11:test` — exit 0, **16/16 PASS**.
2. CSCL chain via canonical file targets (`cscl01 → cscl11`): **88/88 PASS**, all
   exit 0 (16+6+4+5+9+10+8+5+5+4+16).
3. `npm run build` (`tsc -p tsconfig.json`) — exit 0; fresh `dist` carries the new
   census constants (`filesScanned: 639`, ledger `1826`).
4. `node --test dist/tests/canonical-json-profile-inventory.test.js dist/tests/
   verification-fabric-v2.test.js` — exit 0, **66/0** (census 35 + fabric-v2 31).
5. `node --test tests/release-governance.test.mjs` — exit 0, **87/0**.
6. `node --test tests/public-product-spelling.test.mjs` — exit 0, **5/5**
   (`retained-total=605`, every retained token classified; no unclassified).
7. `node --test tests/supply-chain-verifier.test.mjs` — exit 0, **7/7** (the real
   `build-public-release.sh` builder stages all **1510** public files, finds no
   unmanifested file, and the extracted count bound equals the manifest data-line
   count: `1510 == 1510` ✓).
8. `sha256sum --check SHA256SUMS` — exit 0, **1826/1826 OK**.
9. `npm run release-governance:verify` — exit 0, `RELEASE_GOVERNANCE_PASS`.

## Full suite result

Green and offline-capable across every directly-affected + CSCL + governance check
(88 CSCL + 35 census + 31 fabric-v2 + 87 release-governance + 5 spelling + 7
supply-chain, plus the `release-governance:verify` and `sha256sum --check` gates).
No assertion-level failure is attributable to this change.

Two environmental notes (neither is a regression from this change):

- **Docker-spawning tests** — `tests/openclaw-agent-runtime-lock.test.mjs`,
  `tests/openclaw-agent-runtime.test.mjs`, and
  `tests/model-access-broker-runtime.test.mjs` spawn `docker compose` and fail on
  this host with `Error: spawnSync docker ENOENT` because `docker` is not on the host
  `PATH` (per the operator model the Docker daemon is inside the `qwen-test` guest VM,
  not the host). Proven **pre-existing at clean HEAD**: stashing all nine tracked
  changes and re-running the three at HEAD reproduces the identical `ENOENT` failures
  with zero of this diff applied. They would pass in the guest VM / exact PR/Main CI.
- **`/tmp` `ENOSPC`** — the `supply-chain-verifier` staging test copies the public
  file set to `/tmp`; a run started while `/tmp` (1.0G tmpfs) was full from leftover
  staging dirs fails only with `ENOSPC` (`copyfile`). With free space it passes 7/7
  (run above).

## Unresolved / parent-side gates (NOT done here; owned by the delivery controller)

Per the mandate, the delivery job controller — not this work — performs the
following. They are recorded as UNRESOLVED and are **never** claimed delivered here:

- AC7 independent candidate review (fresh Qwen review).
- Semantic main integration / merge.
- Exact PR/Main CI.
- Release (functional product increment, exact versioned class, SHA-256 sidecar) and
  Docker-E2E.
- Anonymous public readback and functional + version-bound public readback
  (`release-governance:public-readback` / `--public-readback` is a network action
  reserved to the controller and was **not** run here).
- The three docker-spawning tests above run in the guest VM / CI, not the host.
- Public issue closure, only after the post-creation read-only workflow passes, per
  the release governance contract in `JoFe2/PANSPHAIRA`
  `docs/RELEASE-GOVERNANCE.md`.

No push, no public mutation, no credentials, no external systems, and no issue
closure were performed in this work.

## Nonclaims

- This does not claim readiness, delivery, or certification for CSCL-11.
- This does not assert universal ERP compatibility — the overall verdict is
  `NARROW_GO` (one of three families `GO`); `NO_UNIVERSAL_ERP_COMPATIBILITY_CLAIM`.
- This does not apply holdout tuning (`NO_HOLDOUT_TUNING_APPLIED`); the held-out
  profile is built independently of the candidates.
- This does not grant or claim authority/promotion/execution (boundary `NONE`);
  `NO_AUTHORITY_PROMOTION_OR_EXECUTION_GRANT`.
- This does not patch away the falsification — the empty frozen core is reported as
  narrowing/falsification (`EMPTY_FROZEN_CORE_REPORTED_AS_NARROWING_NOT_PATCHED`).
- This does not weaken any test or governance gate; the count-bound and census
  reconciliation maintain the fail-closed `build-public-release.sh` / release-
  governance / canonical-JSON census state.
- `publicly_delivered` remains false; delivery and readback stay with the delivery
  controller.