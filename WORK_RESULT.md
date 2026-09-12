# WORK_RESULT — CSCL-12 terminal verdict derivation and versioned Capability Library pilot delivery

**Status: local PanSphaira change complete. NOT DELIVERED / NOT CLOSED.** This is a
bounded, locally validated source result on fresh current main
`faa35380928d29ec8aecc1e36277712c083754c8` (the CSCL-11 holdout-gate commit), with no
legacy CSCL-12 state. The scope is ONLY the CSCL-12 pilot reconciliation:
independently verify the CSCL-01..11 chain (AC1), recompute the terminal verdict
from the byte-frozen candidate bytes plus #328's holdout mappings **without trusting
child labels or aggregates** (AC2), emit exactly one terminal verdict and name the
failed boundaries (AC3), and register the reconciled pilot in the Verification DAG
with canonical tests, sanitized public evidence and nested-then-root integrity
(AC4). All hard gates pass on the exact PR head (AC5). AC6/AC7 — the SHA-bound merge,
exact Main CI, serial release and anonymous readback, plus closure of the terminal
children and #317 and queue reconciliation — are owned by the delivery job
controller; this work never authors or approves those receipts and never claims
delivered. No holdout tuning, no universal-compatibility or Authority claim; all
original ACs and publication fences unchanged. No push, no public mutation, no
credentials, no external systems, no issue closure. `publicly_delivered` remains
false.

## Task

Execute issue #329 [CSCL-12] "Derive terminal verdict and deliver versioned
Capability Library pilot" on exact Main head `faa3538`. Acceptance criteria:

- **AC1** — Independently verify CSCL-01..11 exact commits, schemas, denominators,
  digests and nonclaims — including #328's `NARROW_GO` holdout receipt (verdictDigest
  `7a8056b2c254…8fa`), the iDempiere source/legal/license byte binding at pinned
  commit `731515dcdd5278b843db33b9d3109d155b881951` (16-file capture receipt +
  locator verification, 36 facts), and the byte-frozen CSCL-08/09/10 candidate
  digests (`94bd8998…` / `26b2719e…` / `636c3331…`).
- **AC2** — Recompute the terminal verdict from frozen candidate bytes plus #328's
  holdout mappings **without trusting child labels or aggregates**.
- **AC3** — Emit exactly one of `GO` / `NARROW_GO` / `FALSIFIED_WITH_EVIDENCE` and
  name the failed boundaries.
- **AC4** — Register canonical tests, sanitized public evidence, the Verification
  DAG node(s) for the reconciled pilot (CSCL-11 currently has none) and
  nested-then-root integrity.
- **AC5** — Pass full suite, lint, integrity, governance and diff gates on the exact
  PR head.
- **AC6/AC7** — SHA-bound merge, exact Main CI, serial release, anonymous readback,
  closure of terminal children and #317, queue reconciliation — owned by the
  delivery job controller; the worker never authors or approves those receipts.

## Source inspection (fresh main, faa3538)

- **RED (registration absent):** at HEAD `faa3538` the Verification DAG v2
  (`verification/verification-dag-v2.json`, graphId
  `chimpmaera.verification/evidence-dag/v2`, graph
  `verification-fabric-shadow`) has `graphVersion 47` with **56 nodes** and **no**
  `cscl-11-idempiere-serial-holdout-gate-v1` node: the reconciled pilot (the 13
  `verification/cscl-11-idempiere-*.json` artifacts, the gate modules, the locator
  producer and its test) is owned by no DAG node, so `buildVerificationImpactPlanV2`
  would report `UNMAPPED_PATH` for any cscl-11 path. The new focused test
  (`CSCL-11 serial holdout gate is a registered DAG node bound to the frozen
  reconciled pilot`) fails RED on the pre-fix manifest: `47 !== 48` (graphVersion
  pin) and the node lookup is `undefined`. Additionally, the moment the test file
  itself (a DAG input of the `repository-integrity` owner) is edited, the canonical
  digest test fails RED (`vf-shadow-v2:tests/verification-fabric-v2.test.ts`,
  observed `55876784…` vs recorded `25fbc703…`) — the drift detector correctly
  refuses the stale pin until the graph is re-anchored.
- **Frozen pilot bytes (read-only, DO NOT EDIT):** the 13 committed `verification/
  cscl-11-idempiere-*.json` artifacts (12 gate-produced + the locator-verification
  evidence), the frozen CSCL-08/09/10 candidate bytes, `src/cscl-01/protocol.mjs`
  (frozen verdict rule), `src/cscl-11/holdout-gate.mjs` / `holdout-facts.mjs` and
  `scripts/capture-cscl-11-source-locators.mjs` — all consumed read-only by this
  change; none is modified.
- **Registration surfaces to reconcile:** `tests/verification-fabric-v2.test.ts`
  (graphVersion pin, the two exact `selectedNodes` lists, the exact `selectedTests`
  list, and the new focused test), `tests/contribution-intake-ledger.test.ts`
  (graphVersion + node-count pins), `tools/video-production-reference/tests/
  slice.test.mjs` (independent DAG oracle version pin), `scripts/refresh-
  integrity-data.mjs` (the canonical integrity generator must own the new node),
  `verification/canonical-json-profile-inventory-v1.json` + its census test (the
  generator byte change requires the fail-closed canonical-JSON profile version
  migration), and the two integrity manifests (`SHA256SUMS`, the video tool's
  internal `SHA256SUMS`) which re-anchor via `npm run integrity:refresh`.
- **Public evidence already registered:** all 15 cscl-11 public files are already in
  `release/public-files.manifest` (1514 total / 1512 data lines) from `faa3538`;
  this change adds **no new public files** and does not touch the manifest, the
  builder count bound, or `package.json` (the `cscl11:test` script and its `posttest`
  head were already registered by the CSCL-11 commit).

## TDD (RED → GREEN)

- **RED (base `faa3538`, before the fix):** the focused registration test fails
  (`graphVersion 47 !== 48`; node absent) and the canonical DAG digest test fails
  on the edited test-file input — both demonstrated before the fix, with the drift
  detector correctly naming the stale path. See *Source inspection*.
- **GREEN (minimal add):** one DAG node + its canonical generator ownership + the
  focused positive/negative tests + the version pins. `node --test dist/tests/
  verification-fabric-v2.test.js` → **32/32 PASS** (was 30/32 RED with the new test
  failing).
- **Positive (focused):** the new test asserts the node exists with `dependsOn`
  exactly `["cscl-08-party-candidate-v1", "cscl-09-product-candidate-v1",
  "cscl-10-sales-candidate-v1"]`, `ownedTests ["npm run cscl11:test"]`,
  `riskClass "HIGH"`, `globalInvalidation false`, exactly 17 inputs (4 `VALIDATOR`:
  the two gate modules, the gate test, the locator producer; 13 `DERIVED_EVIDENCE`:
  the 13 pilot artifacts) with every on-disk sha256 re-hashed and matched, the four
  invariants verbatim, `graphVersion 48`, and the `cscl11:test` script + `posttest`
  head binding. Bounded ownership: a change to `src/cscl-11/holdout-gate.mjs` or to
  `verification/cscl-11-idempiere-holdout-verdict-overall-v1.json` selects **only**
  `["cscl-11-idempiere-serial-holdout-gate-v1"]` with `selectedTests ["npm run
  cscl11:test"]` (mode `IMPACTED_SHADOW`, no full fallback).
- **Negative / fail-closed (focused):** observed digest drift on any node input →
  `GRAPH_DRIFT`; a tampered input sha256 (`"0"×63 + "g"`) or an orphaned dependency
  (`cscl-99-missing-node`) makes `validateVerificationDagV2` reject the graph. The
  census fail-closed chain rejects any generator byte change without a recorded
  version migration (`profile-version-migration:current:…`,
  `byte-obligation-mismatch:…#on-disk`).

## Source changes (bounded; no governance weakened)

Nine files modified; **no new files**, **no public manifest change**, **no
package.json change**, no governance/authority file altered, no test weakened, no
exempt prefix widened.

- `verification/verification-dag-v2.json` — **one node added**
  (`cscl-11-idempiere-serial-holdout-gate-v1`; `graphVersion 47 → 48`, 56 → 57
  nodes), produced by the canonical generator; four changed-input digests
  re-anchored by `npm run integrity:refresh`. The node's four invariants (verbatim):
  1. "The byte-frozen CSCL-08/09/10 candidates are consumed read-only: raw
     candidate bytes, frozen digests and frozen slots are replayed without editing,
     and any drift fails CANDIDATE_BYTES_MUTATED_AFTER_FREEZE."
  2. "The exact official iDempiere bytes at the pinned immutable commit
     731515dcdd5278b843db33b9d3109d155b881951 are bound: 16-file capture receipt
     with per-file sha256/byteLength, GPL-2.0-or-later license bytes and committed
     locator evidence (HTTP 200 plus whole-file digest match for all 16 rawUrls);
     any dead, drifted or digest-mismatched locator fails the source gate closed."
  3. "All 36 holdout source facts, 36 evidence cells and the complete
     party/product/sales denominators replay deterministically from the frozen
     bytes; the empty party and sales frozen cores are reported as
     FALSIFIED_WITH_EVIDENCE narrowing, never patched."
  4. "No holdout tuning, no universal-ERP-compatibility claim and no Authority,
     promotion or execution grant; the overall GO / NARROW_GO /
     FALSIFIED_WITH_EVIDENCE verdict derives only from the frozen protocol
     functions and the six governance gates."
- `scripts/refresh-integrity-data.mjs` — the canonical integrity generator now owns
  the new node (find-or-push block that re-digests its 17 inputs from the current
  bytes) and advances `graphVersion` to `48`. This byte change is canonically
  admitted via the fail-closed canonical-JSON census below — the same mechanism
  every prior generator advance used.
- `verification/canonical-json-profile-inventory-v1.json` — **one**
  `profileVersionMigrations` entry added (`CSCL-12-PILOT-RECONCILIATION/INTEGRITY-
  GENERATOR/V12`, `fromSha256 11a5f565…` = the HEAD generator digest, `toSha256
  c37787b6…` = the new generator digest; reason: "Advance the Verification DAG to
  graph v48 and canonically own the CSCL-11 iDempiere serial holdout gate family
  registered as the reconciled pilot node; admitted v1 and reviewed v2-v11 digests
  remain immutable.") plus the two recorded generator digests advanced
  (`profiles` declaration + `byteObligations`, basis `profile-version-migration`)
  — exactly the reconciliation the V11 advance made in `faa3538`. Byte-exact
  `JSON.stringify(…, 2)` round-trip preserved; the immutable v1 admitted-base
  fixture is untouched.
- `tests/canonical-json-profile-inventory.test.ts` — the mirrored migration chain
  gains the identical V12 entry and the generator version pin extends
  `[2..11] → [2..12]`.
- `tests/verification-fabric-v2.test.ts` — `graphVersion` pin `47 → 48`; the new
  focused test (positive + bounded-ownership + `GRAPH_DRIFT` + tamper/orphan
  negatives); the node inserted into the two exact `selectedNodes` lists (AWI-03
  and contract-changes) and `npm run cscl11:test` into the exact AWI-03
  `selectedTests` list.
- `tests/contribution-intake-ledger.test.ts` — pins `graphVersion 47 → 48`,
  `nodes.length 56 → 57`.
- `tools/video-production-reference/tests/slice.test.mjs` — the independent DAG
  oracle pin `47 → 48`; its internal closure manifest
  (`tools/video-production-reference/SHA256SUMS`) re-digests that one line, keeping
  the tool-internal `verifyClosure` PASS.
- `SHA256SUMS` — re-digested by `npm run integrity:refresh` (1828 entries; 8 lines
  re-digested for content-changed files; zero pre-existing entries dropped).

## AC1 — independent verification (byte-level, this session)

- **Introducing commits (verified by `git log` at `faa3538`):**
  `201baa3` CSCL-01 protocol (#330), `8dae13e` CSCL-02..06 five source-native
  profiles (#331), `2748888` CSCL-07 adversarial evidence matrix (#332),
  `a01647c` CSCL-08 Party candidate (#350), `ea664cb` CSCL-09 Product candidate
  (#351), `57c2dba` CSCL-10 Sales candidate (#353), `faa3538` CSCL-11 holdout gate
  (this base head).
- **#328 holdout receipt:** `verification/cscl-11-idempiere-holdout-verdict-
  overall-v1.json` carries `verdictDigest
  7a8056b2c254256e046116aba9ebb559ebf71b966d5e2d752643fc1c680f18fa` — reproduced
  byte-identically by the independent recompute (below), so the committed receipt is
  not a trusted label: it is the output of the frozen rule over the frozen inputs.
- **iDempiere source/legal/license binding (receipt re-read independently):**
  `resolvedCommit 731515dcdd5278b843db33b9d3109d155b881951`,
  `officialRepository https://github.com/idempiere/idempiere.git`, selector
  `refs/heads/release-13`, `factCount 36`, 16 captured files,
  `legal.licenseId GPL-2.0-or-later` (license bytes sha256 `ff71df08…`),
  `noticeStatus ABSENT_AT_PIN`, and the committed locator-verification evidence
  (`artifactReceiptDigest 3511b300fbef2050fdd43bb98bf556bcdde982967c25dc78955cc7209b263d72`,
  `resolvedCount 16`, `unresolved []`). Offline re-validation this session:
  `node scripts/capture-cscl-11-source-locators.mjs --verify` →
  `{"ok": true, "mode": "verify-offline"}`.
- **Byte-frozen candidate digests (independent reads):**
  party `94bd8998d38edbd9728be6283206867f2b2aca5a161a216972994ab16ea4f111`,
  product `26b2719ec82280454af9a517a80711a9901c0e288dc6fb7af7a6ef595d745d08`,
  sales `636c33318dc0b542e5be8b1849eb798dcebbf3ac51ea64ea86ffcacac99d6c0e` — each
  `frozenDigest === actualDigest` (**BOUND**, no drift).
- **Nonclaims in the committed receipts:** `NO_HOLDOUT_TUNING_APPLIED`,
  `NO_UNIVERSAL_ERP_COMPATIBILITY_CLAIM`, `NO_AUTHORITY_PROMOTION_OR_EXECUTION_GRANT`,
  `EMPTY_FROZEN_CORE_REPORTED_AS_NARROWING_NOT_PATCHED`; boundary
  `authorityGrant/promotionGrant/executionGrant` all `NONE`. AC1 isolation:
  `clean: true`, `NO_IDEMPIERE_SEMANTIC_SOURCE_CONSUMED_BY_CSCL_01_10`.

## AC2 — terminal verdict recompute (no trusted labels)

Independent driver: `buildHoldoutGate({ repoRoot: "/workspace" })` from the
unmodified `src/cscl-11/holdout-gate.mjs` (which reads the frozen candidate bytes,
the frozen 36 iDempiere facts, the committed locator evidence, and drives the frozen
`src/cscl-01/protocol.mjs` functions `evaluateHoldoutFamily` /
`deriveOverallVerdict`); each of the 12 artifact values re-serialized as
`JSON.stringify(value, null, 2) + "\n"` and sha256-compared against the committed
bytes in `verification/`. Result this session:

- **12/12 artifacts byte-identical** to the committed receipts (source-capture
  receipt, holdout profile, mapping ×3, isolation proof, governance gates, family
  results, holdout verdict ×4). The committed labels are therefore *reproduced
  outputs*, not inputs: no child label or aggregate was trusted.
- **Terminal verdict: `NARROW_GO`**, `reasonCodes ["ONE_OR_TWO_FAMILIES_GO"]`,
  `verdictDigest 7a8056b2c254…18fa` (recomputed == committed).

## AC3 — the one terminal verdict and its failed boundaries

`verification/cscl-11-idempiere-holdout-verdict-overall-v1.json`:
`schemaVersion pansphaira.cscl01/holdout-verdict/v1`, scope `OVERALL`.

| Capability family | Applicable facts | Core/Variant/Unmapped | `coreTotal` | Verdict | reasonCodes |
|---|---|---|---|---|---|
| `PARTY_CUSTOMER_MANAGEMENT` | 9 | 0 / 9 / 0 | 0 | **`FALSIFIED_WITH_EVIDENCE`** (failed boundary) | `INVALID_CORE_DENOMINATOR`, `CORE_IDENTITY_OR_MEANING_NOT_100_PERCENT_PRESERVED` |
| `PRODUCT_ITEM_MANAGEMENT` | 9 | 1 / 8 / 0 | 5 | `GO` | `HOLDOUT_FAMILY_GO` (receipt nonclaim code) |
| `SALES_ORDER_MANAGEMENT` | 10 | 0 / 10 / 0 | 0 | **`FALSIFIED_WITH_EVIDENCE`** (failed boundary) | `INVALID_CORE_DENOMINATOR`, `CORE_IDENTITY_OR_MEANING_NOT_100_PERCENT_PRESERVED` |

- **Overall: `NARROW_GO`** — exactly one verdict, emitted by the frozen
  `deriveOverallVerdict` over the three family verdicts plus the six governance
  gates (`source, legal, history, integrity, denominator, isolation` — all `true`).
- **Failed boundaries (named):** `PARTY_CUSTOMER_MANAGEMENT` and
  `SALES_ORDER_MANAGEMENT`. The empty frozen cores (`coreTotal = 0`) are reported
  as `FALSIFIED_WITH_EVIDENCE` narrowing — **never patched away**; the mapping-
  receipt schema's `/denominators/coreTotal` minimum is what rejects them, and the
  gate surfaces that rejection as the verdict.
- **Governance gates:** all six `true`. **Nonclaims:** as listed under AC1 — no
  holdout tuning, no universal-compatibility claim, no Authority grant.

## AC4 — registration (nested-then-root integrity)

- **DAG node (nested):** `cscl-11-idempiere-serial-holdout-gate-v1` —
  `dependsOn` the three frozen-candidate nodes (the pilot consumes them read-only),
  `ownedTests ["npm run cscl11:test"]` (the canonical focused suite, already
  registered in `package.json` and at the `posttest` head), `riskClass "HIGH"`,
  `globalInvalidation false`, 17 inputs (4 `VALIDATOR` + 13 `DERIVED_EVIDENCE`,
  each sha256-bound to the current bytes), 4 invariants. Final verified shape:
  `graphVersion 48`, 57 nodes, 17 node inputs, 4 invariants.
- **Root integrity:** `npm run integrity:refresh` re-digested all changed node
  inputs and re-wrote `SHA256SUMS` (1828 entries) from the manifest union; a second
  run is a byte-for-byte **no-op** (idempotent), proving the tree is stably
  anchored. The canonical-JSON census admitted the generator byte change only via
  the fail-closed V12 version migration (immutable v1 base + reviewed v2-v11
  digests untouched). The video tool's internal closure manifest re-digests its
  single changed line and `verifyClosure` stays PASS.
- **Sanitized public evidence:** the 15 cscl-11 public files were already registered
  in `release/public-files.manifest` (1514 total / 1512 data lines) and are
  re-staged byte-identically by the public build below; this change adds no new
  public files and alters no manifest line.

## Commands and actual results (local, offline-capable, Node v24)

Ran on exact Main head `faa3538` (local working head after the change; no push).

1. Independent AC2 recompute (driver described above, 12 artifacts recomputed and
   sha256-compared): **12/12 byte-identical**, terminal `NARROW_GO`,
   `verdictDigest 7a8056b2c254256e046116aba9ebb559ebf71b966d5e2d752643fc1c680f18fa`
   recomputed == committed, `OVERALL_RECOMPUTE_MATCH: true`; all three candidates
   `BOUND`; locator `resolvedCount 16`, `unresolved []`.
2. `node scripts/capture-cscl-11-source-locators.mjs --verify` — exit 0,
   `{"ok": true, "mode": "verify-offline"}`.
3. `npm run cscl11:test` — exit 0, **20/20 PASS**.
4. CSCL chain, canonical file targets (`cscl-01 → cscl-11`, 11 test files):
   **92/92 PASS**, all exit 0 (16+6+4+5+9+10+8+5+5+4+20).
5. `npm run build` (`tsc -p tsconfig.json`) — exit 0.
6. `node --test dist/tests/verification-fabric-v2.test.js dist/tests/
   contribution-intake-ledger.test.js dist/tests/canonical-json-profile-
   inventory.test.js` — exit 0, **94/94** (fabric-v2 32 + ledger 27 + census 35).
7. `node --test tools/video-production-reference/tests/slice.test.mjs tools/
   video-production-reference/tests/closure.test.mjs` — exit 0, **116/116**
   (slice 100 + closure 16; internal closure verify PASS).
8. `sha256sum -c SHA256SUMS` — exit 0, **1828/1828 OK**.
9. `npm run integrity:refresh` — exit 0; second run a **no-op** (stable tree).
10. `npm run lint` — exit 0.
11. `npm run release-governance:verify` — exit 0, `RELEASE_GOVERNANCE_PASS`.
12. `npm run supply-chain:verify` — exit 0.
13. `./scripts/build-public-release.sh --output /tmp/public-build-cscl12b/cm-
    product-increment-rc-20260912` — exit 0,
    `ARCHIVE_SHA256=056aee79023a4075e816087ac8348f248d889e12c4643239072bfb8a9ee62481`
    (new archive SHA vs the CSCL-11 run because the census artifact, census test,
    DAG and their SHA256SUMS lines are now the re-anchored bytes; the public file
    set itself is unchanged at 1512 data lines).

## Full suite result

`npm test` on the exact PR head: **729 tests, 720 pass, 9 fail, 0 cancelled** —
every census/fabric/ledger/governance/supply-chain/public-build/integrity check
green. The 9 failures are exclusively `Error: spawnSync docker ENOENT` in the five
docker-spawning runtime test files (`tests/builder-agent-runtime.test.mjs` ×2,
`tests/managed-skill-lifecycle-runtime.test.mjs` ×2, `tests/model-access-broker-
runtime.test.mjs` ×1, `tests/openclaw-agent-runtime-lock.test.mjs` ×2, `tests/
openclaw-agent-runtime.test.mjs` ×2): `docker` is not on the host `PATH` (the Docker
daemon is inside the `qwen-test` guest VM, not the host). **Proven pre-existing at
clean HEAD:** with all nine tracked changes stashed, the same five files at `faa3538`
fail the same 9 tests with the identical `ENOENT` (29 tests in those files: 20
pass / 9 fail). They run in the guest VM / exact PR/Main CI. Zero assertion-level
failure is attributable to this change.

Environmental note (not a regression): `/tmp` is a 1.0G RAM-backed tmpfs. Stale
`cm-supply-chain-test-*` staging dirs (≈52M each, 20 leftover from a prior
ENOSPC-interrupted run) had filled it and killed an intermediate suite run with
`ENOSPC`. After removing the stale staging dirs (test artifacts, recreated on
demand) the full suite completed as recorded above; `/tmp` staging dirs should be
cleaned between runs.

## Unresolved / parent-side gates (NOT done here; owned by the delivery controller)

Per the mandate, the delivery job controller — not this work — performs the
following. They are recorded as UNRESOLVED and are **never** claimed delivered here:

- AC6/AC7 fresh Qwen review of the candidate.
- SHA-bound merge to Main and exact PR/Main CI (including the five docker-spawning
  runtime tests above, which run in the guest VM / CI).
- Serial release (functional product increment, exact versioned class, SHA-256
  sidecar) and Docker-E2E.
- Anonymous public readback and functional + version-bound public readback
  (`release-governance:public-readback` / `--public-readback` is a network action
  reserved to the controller and was **not** run here).
- Closure of the terminal CSCL children and #317, and queue reconciliation, only
  after the post-creation read-only workflow passes, per
  `docs/RELEASE-GOVERNANCE.md`.

No push, no public mutation, no credentials, no external systems, and no issue
closure were performed in this work.

## Nonclaims

- This does not claim readiness, delivery, or certification for the Capability
  Library pilot; `publicly_delivered` remains false and delivery/readback stay with
  the delivery controller.
- The terminal verdict is `NARROW_GO` — one of three capability families is `GO`;
  `PARTY_CUSTOMER_MANAGEMENT` and `SALES_ORDER_MANAGEMENT` are
  `FALSIFIED_WITH_EVIDENCE` (failed boundaries, empty frozen cores reported as
  narrowing, never patched). No universal ERP compatibility is claimed
  (`NO_UNIVERSAL_ERP_COMPATIBILITY_CLAIM`).
- No holdout tuning was applied (`NO_HOLDOUT_TUNING_APPLIED`); the verdict derives
  only from the frozen protocol functions and the six governance gates over the
  frozen bytes.
- No Authority, promotion or execution grant is made or claimed (boundary `NONE`).
- No test was weakened and no governance gate changed: the count bound, the public
  manifest (unchanged), the canonical-JSON census (admitted only via the fail-closed
  V12 migration) and the DAG drift detector all retain their fail-closed behavior.
- Missing-input reporting: none. All required source/evidence bytes, registrations
  and public transport were present at `faa3538` or are produced locally here; no
  RELEASE_BLOCKER with an external owner arises from this change.