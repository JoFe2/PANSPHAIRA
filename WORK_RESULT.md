# WORK_RESULT — AP-06 Frozen Adapted-ERV Proof Probe (issue #366, parent #360)

**Status: NOT DELIVERED / NOT CLOSED.** This is a local, in-bounds working result on a fresh
current-main checkout (HEAD `3ce0c4d550c52e7995c8c60ed86288bc3ef2ce80`, i.e. `AP06_EXACT_HEAD_V1`).
Parent-side gates remain open (see *Unresolved / parent-side gates*): independent review, exact
PR/Main CI, release, anonymous readback, and reconciliation. No push, no public mutation, no
credentials, no external systems, no issue closure. The delivery job controller performs fresh
Qwen review, exact PR/Main CI, release and anonymous readback; this work never authors or
approves those receipts.

## Task

Integrate the **AP-06 frozen adapted-ERV proof probe**: a synthetic, non-customer, TYPED
verification artifact that proves the exact-bound chain
source → document → extraction → validation → matching → exception/advisor → UI → receipt, and
that the baseline (`LEAN`) and the dialogue-derived changed variant
(`SEGREGATED_ENTERPRISE`) execute through the **same released core** with **byte-identical
core/module digests** while only requirement/configuration digests, selected variants and
resulting process/UI/readback differ. Depends on #365 (AP-05), #374 (ERV-UI-01), #375 (ERV-BI-01).

The proof probe (public thread): baseline is `LEAN` with the released synthetic invoice
intake/extraction and no mandatory PO/Receipt match; the changed requirement (entered through the
setup-agent dialogue) requires both PO and receipt evidence, a 2% matching tolerance, and a
separate approval above EUR 10,000; the expected resolved variant is `SEGREGATED_ENTERPRISE`. The
proof reuses the same released intake, extraction, matching, advisor and UI capability IDs with
byte-identical core/module digests. Missing evidence stays `UNKNOWN`/`NEEDS_CLARIFICATION`; an
invented function or Authority is denied. The 200-bps three-way ERV decision has **no released
executable variant** → it stays `TYPED_UNKNOWN`.

## Core finding (reproduced RED on fresh main)

On fresh main the AP-06 capability is **entirely absent** — no module, no test, no verification
artifact, no index export. Demonstrated RED:

```
$ git cat-file -e HEAD:packages/contracts/src/incoming-invoice-ap06-proof-probe.ts
  fatal: path '...' does not exist in 'HEAD'        # module ABSENT at HEAD
$ git show HEAD:packages/contracts/src/index.ts | grep -c "ap06-proof-probe"
  0                                                  # no export at HEAD
```

The module the focused test imports does not exist at HEAD, so the test cannot compile or pass —
the capability is a missing behavior, not a pre-existing one.

## The change (TDD, minimal, additive)

A frozen-probe module that re-binds the released capability chain (byte-identical predecessor
sources) and produces/checks a synthetic, deterministic, non-customer verification artifact.
Follows the AP-05 `predecessorSources` frozen-predecessor pattern; no legacy candidates/state.

New files (4):
- **`packages/contracts/src/incoming-invoice-ap06-proof-probe.ts`** — the AP-06 module.
  Exports `AP06_EXACT_HEAD_V1`, `generateIncomingInvoiceAp06ProofProbeV1`,
  `verifyIncomingInvoiceAp06ProofProbeV1`. Verdict = `NARROW_GO`.
  - `FROZEN_OBLIGATIONS_V1` (10 obligations) byte-binds the released chain:
    `ap01-blueprint`, `ap02-intake` (+ supplier-invoice fixture), `extraction-benchmark`,
    `ap03-holdout`, `ap04-erv-core` ×3 (`incoming-invoice-erv.ts` + case pack + schema),
    `pan365-adaptive-ui`, `pan365-ap05-receipt-manifest`.
  - Shared ERV core `packages/contracts/src/incoming-invoice-erv.ts`
    (21114 B, sha256 `6ba5250783df35f60602a11437c843272ab014bf24e69135cfbf52dfb41750cf`) —
    identical across both variants.
  - 8-layer exact-bound chain; 9-row case matrix; `TYPED_UNKNOWN` for the 200-bps three-way
    decision (registry fixes `RATE_BPS@1.0.0` at 100 bps; a requested 200 bps is unsupported →
    TYPED_UNKNOWN, never an invented capability). Fail-closed `ProbeError` reason codes.
- **`tests/incoming-invoice-ap06-proof-probe.test.ts`** — 4 focused tests (regenerate +
  byte-match + fail-closed negatives).
- **`scripts/generate-incoming-invoice-ap06-proof-probe.mjs`** — reads the 10 predecessor sources
  + frozen setup, generates/checks the verification JSON; `--check` asserts reproducibility.
- **`verification/incoming-invoice-ap06-proof-probe-v1.json`** — the generated artifact, digest
  `ee8a43aa145f6e7217bf31318a341473d2eaa875cfe54d5adf050fe93b74b287`.

Registration cascade (modified, 10 files):
- `packages/contracts/src/index.ts` — re-export (does not match the census re-export regex → no
  re-export count change).
- `package.json` — `incoming-invoice-ap06-proof-probe:generate`, `:test`, `:test:compiled`, plus a
  `pretest` chain entry (after the AP-05 compiled run, before ERV-analytics).
- `release/public-files.manifest` — +4 entries (`0644`, identity mapping); data lines 1491→**1495**.
- `scripts/build-public-release.sh` (`count != 1495`), `tests/release-governance.test.mjs`
  (`count, 1495`), `tests/verification-fabric-v2.test.ts` (`publicManifestPaths.length, 1495`).
- `tests/canonical-json-profile-inventory.test.ts` + `verification/canonical-json-profile-inventory-v1.json`
  — census counts: `filesScanned 635`, `importSites 212`, `importFiles 211`, ledger
  `entries 1809` / `uniquePaths 1809`; contracts consumer family `importSites 131` /
  `importFiles 131` (the module is the only new direct `canonicalJson` importer).
- `SHA256SUMS` — regenerated by `scripts/refresh-integrity-data.mjs` (1805→1809 lines: +4 new
  files, updated digests for changed files incl. the DAG).
- `verification/verification-dag-v2.json` — regenerator re-bound 7 input digests;
  **graphVersion 47, 56 nodes, no new node, no structural change** (digest-only re-bind).

### AC coverage

- **AC01** exact-bound chain source→document→extraction→validation→matching→exception/advisor→
  UI→receipt (8 layers, each bound to a released byte-identical module digest).
- **AC02** case matrix (positive, duplicate, tamper, mismatch, UNKNOWN, cancellation, replay —
  9 rows) matches the oracle.
- **AC03** independent verdict = `NARROW_GO` (a GO/NARROW_GO/FALSIFIED_WITH_EVIDENCE value).
- **AC04** release/readback names only synthetic scenario packs + tested capability layers.
- **AC05** zero-residue cleanup: pure function, no writes, no clock, idempotent generation.
- **AC06** `LEAN` vs `SEGREGATED_ENTERPRISE` run through the same released core:
  `coreModuleDigestIdentical`, `onlyRequirementConfigurationDiffer`; shared core source digest
  identical, requirement+configuration digests differ.
- **AC07** the changed variant produces oracle-predicted process/UI/advisor/readback differences
  + a bound reuse receipt; omitting the dialogue delta, substituting answers, inventing a
  capability or mutating the core all **fail closed**.

## Actual commands and results (fresh current-main checkout)

```
$ npm run build                                        # tsc -p tsconfig.json
  exit 0

$ npm run incoming-invoice-ap06-proof-probe:test:compiled    # focused RED→GREEN
  tests 4, pass 4, fail 0

$ node scripts/generate-incoming-invoice-ap06-proof-probe.mjs --check
  ee8a43aa145f6e7217bf31318a341473d2eaa875cfe54d5adf050fe93b74b287   # reproducible, byte-stable

$ node scripts/refresh-integrity-data.mjs              # SHA256SUMS + DAG regenerator
  IDEMPOTENT: no new changes after refresh (stable fixpoint)

$ node --test dist/tests/canonical-json-profile-inventory.test.js   # census
  tests 35, pass 35, fail 0     # filesScanned=635 / importSites=212 / ledger=1809

$ npm run incoming-invoice-ap05-receipt-manifest:test:compiled      # frozen predecessor intact
  tests 6,  pass 6

$ npm test                                             # canonical entrypoint
  tests 717, pass 706, fail 11
```

The 11 `npm test` failures are all **environmental**, none touch AP-06 or any in-scope governance
file:
- **9 × `spawnSync docker ENOENT`** — `docker` is absent in this environment
  (`command -v docker` → DOCKER_ABSENT). Failing files: `builder-agent-runtime`,
  `managed-skill-lifecycle-runtime`, `model-access-broker-runtime`,
  `openclaw-agent-runtime-lock`, `openclaw-agent-runtime`. Proven pre-existing: stashing all 14
  changed files and re-running those files on clean HEAD reproduces the identical failures.
- **2 × `ENOSPC`** in `supply-chain-verifier.test.mjs` — the 1 GB `/tmp` tmpfs fills under
  full-suite scratch load (each run copies ~52 MB of fixtures). Proven environmental:
  `node --test tests/supply-chain-verifier.test.mjs` on a clean `/tmp` passes **7/7, exit 0**.
  (Transient `/tmp/cm-*` test residue from repeated runs was removed; zero-residue restored.)

All in-scope tests pass within the full run: AP-06 (4/4), release-governance,
verification-fabric-v2, census (35/35), manifest count (1495). `SHA256SUMS` is self-consistent
with the on-disk bytes.

## Change surface (verified with `git status`)

- Modified (10): `SHA256SUMS`, `package.json`, `packages/contracts/src/index.ts`,
  `release/public-files.manifest`, `scripts/build-public-release.sh`,
  `tests/canonical-json-profile-inventory.test.ts`, `tests/release-governance.test.mjs`,
  `tests/verification-fabric-v2.test.ts`,
  `verification/canonical-json-profile-inventory-v1.json`, `verification/verification-dag-v2.json`.
- Added (4): the module, generator script, test, and verification artifact.

File SHA-256 (added files):
```
e2bc23278720885edc5742007a65405f1a2686daeca0ce044cf0ae1e0048bf6f  packages/contracts/src/incoming-invoice-ap06-proof-probe.ts
3db7b13111e527baff69fe21d1d03c28718453237559a0139964a9d1e83fd5a3  scripts/generate-incoming-invoice-ap06-proof-probe.mjs
4e4725ca8fed4c62936f49d6349a0f73bc87dad21aba9809ba6ee3061a89fba5  tests/incoming-invoice-ap06-proof-probe.test.ts
183d4fb117b9e5996b61f740d89fcf8b47d92fdb911f7567d94dc190f58b7194  verification/incoming-invoice-ap06-proof-probe-v1.json
```

## Governance verification

- Frozen predecessors: the 10 bound released sources (incl. the ERV core `incoming-invoice-erv.ts`
  and the AP-05 receipt manifest) are **unchanged** in this diff; the AP-05 receipt manifest
  regenerates **byte-for-byte** (ap05 test 6/6). The probe re-binds them, it does not modify them.
- No test weakened and no governance rule changed; optional hints remain optional. The manifest
  count, census counts, and DAG graphVersion (locked at 47) were raised **only** to the values the
  single canonical regenerator produces, and the regenerator is idempotent (stable fixpoint).
- No new DAG node was added: AP-06 reuses frozen predecessors and introduces no new capability, so
  a digest-only re-bind at graphVersion 47 is the correct, non-weakening registration.

## Unresolved / parent-side gates (NOT done here, by boundary)

- Dependencies on #365 (AP-05), #374 (ERV-UI-01), #375 (ERV-BI-01) must be satisfied before this
  can land.
- The full `npm test` feature suite and the complete `pretest` chain run under exact PR/Main CI by
  the parent. The 9 docker-ENOENT and 2 ENOSPC failures above are environmental in this sandbox
  and are expected to resolve (or be excluded) under the parent's CI environment; they are not
  defects of this change.
- Parent performs: independent review, exact PR/Main CI, release, and anonymous readback.
  Reconciliation. Queue/issue closure (AC05's operational half) is the delivery controller's job,
  not this work's.
- **This work must NOT be claimed as delivered, and issue #366 must NOT be closed.**