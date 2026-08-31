# Canonical JSON / Digest Profile Inventory v1 (FND-PS-04)

- **Task ID:** CAMPAIGN-V1-FND-PS-04-INTEGRATE-01
- **Accepted census artifact:** `cfda3f1601b2a0d4430059933a2ca2e2a5107606` (#338)
- **Base commit (exact current public Main, `origin/main`):**
  `dac921d459cbcfc16e4912dff558c8786e6438de`
- **Companion artifacts:**
  - `verification/canonical-json-profile-inventory-v1.json` — machine-testable inventory
  - `tests/canonical-json-profile-inventory.test.ts` — deterministic scanner + fail-closed validator (31 tests)
- **Process context preserved (not re-litigated):** Operating Model v1.1 and decisions D-001 through D-007. No new process variant is introduced by this slice.

## Purpose and decision

This document records the refreshed repository-wide census of canonical JSON
serialization profiles on exact admitted Main. It is a **decision artifact and a
testable inventory**, not a utility consolidation:

1. **No implementation is declared equivalent to any other.** Equivalence stance is
   `NOT-PROVEN` with `claims: []`. The required evidence dimensions are
   `valid / invalid / unicode / number`; the existing runtime parity test
   (`tests/canonical-json-runtime-parity.test.mjs`, digest-pinned) proves
   **valid + invalid only**. `unicode` and `number` evidence is missing, so
   `missingDimensions: ["unicode", "number"]` and no equivalence claim is
   permitted. Similar names or shapes (30 similar-shape sites, see below) never
   produce an equivalence claim.
2. **No utility consolidation and no product-runtime change.** The slice changes
   only the three issue-authorized product paths. The 33 discovered
   `canonicalJson` implementations remain where they are; consolidating them
   would require the shared valid/invalid/Unicode/number proof that does not
   yet exist.
3. **Historical digest-bound bytes are not regenerated.** All 42 non-self-referential byte
   obligations (33 pinned profile implementations, 1 parity-evidence test,
   1 parity fixture, 7 ledger-name-match files) are verified unchanged on
   disk against `SHA256SUMS` by the inventory test. The three derived census
   artifacts bind separately through `repository-integrity` to avoid a hash cycle.

## Scan methodology (single source of truth)

The scanner is embedded in `tests/canonical-json-profile-inventory.test.ts`;
the inventory JSON is generated from the same logic, and the validator
recomputes the scan at test time, so inventory and scanner cannot drift apart
silently.

- **Scan roots:** `src`, `packages`, `scripts`, `demo`, `tools`, `tests`,
  `benchmarks`, `docs` (skipping `node_modules`, `dist`, `.git`).
- **Extensions:** `.ts`, `.mts`, `.cts`, `.js`, `.mjs`, `.cjs`.
- **Self-exclusion:** the census test file itself is counted in
  `filesScanned` (591) but excluded from every census dimension, so the prose
  in this document and the test's own regexes can never skew the counts they
  define. A dedicated self-consistency test asserts this.
- **Detection (line-local, form-based):**
  - `declaration` — a line declaring `canonicalJson`
    (`function|const|let|var canonicalJson`);
  - `import site` — a line importing `canonicalJson` from a module;
  - `re-export` — an `export { ... canonicalJson ... }` line;
  - `similar-shape site` — a declaration of a canonicalize-family helper
    (`canonicalize`, `encodeCanonical`, `canonicalDigest`).
- **Classification (line-local, reproducible from a single source line):**
  - `alias` — a direct rebind of a canonicalize-family helper
    (`canonicalJson = encodeCanonical` / `canonicalJson = canonicalize`);
  - `wrapper` — an arrow-form declaration that delegates on the **same line**
    to a canonicalize-family helper;
  - `implementation` — everything else, including arrow functions with their
    own serialization body.
- **Owner family:** the second path segment under `src/`, `packages/`, or
  `tools/`; otherwise the top-level segment. Note `cks` legitimately spans
  `src/cks/` and `packages/cks/` (3 import files).
- **Ledger:** `SHA256SUMS`, one digest per line, leading `./` stripped.

## Integration ownership (current Main)

The accepted census is replayed without changing the historical byte set. Its
three decision/validator artifacts are digest-bound inputs of the existing
`repository-integrity` Verification Fabric node:

- `docs/architecture/canonical-json-profile-inventory.md` — `DERIVED_EVIDENCE`;
- `verification/canonical-json-profile-inventory-v1.json` — `CONTRACT`;
- `tests/canonical-json-profile-inventory.test.ts` — `VALIDATOR`.

The validator rejects a stale `origin/main` base commit, an omitted or
mis-owned integration artifact, and any current-byte digest that differs from
the node declaration. `verification/verification-dag-v2.json` remains the
authoritative ownership declaration; its own change is graph-change
fail-closed, while `package.json` remains covered by central toolchain
invalidation. This adds no new process variant or runtime utility.

## Fresh census vs historical hints

Historical lexical counts (81 declarations / 80 files; 172 import sites /
171 files) are **historical hints, not expected truth**. The fresh mechanical
scan supersedes them:

| Metric | Fresh (admitted Main) | Historical hint |
|---|---|---|
| Files scanned | 591 | — |
| Declaration sites | 33 | 81 |
| Declaration files | 33 | 80 |
| Import sites | 194 | 172 |
| Import files | 193 | 171 |
| Re-export sites | 4 | — |
| Similar-shape sites | 30 | — |
| Byte obligations | 42 | — |
| Pinned profile files | 33 | — |

The large gap between the historical hint (81) and the fresh count (33) is
expected: the hint was produced by ad-hoc grep methods that disagree with each
other; this scan is the reproducible baseline. Fresh counts and uncertainty
are reproducible on admitted Main by running the census test.

## Profiles (33 declarations, 33 files)

30 `implementation`, 2 `alias`, 1 `wrapper`. By owner and class:

| Owner | implementation | alias | wrapper |
|---|---|---|---|
| cks-12 | 10 | — | — |
| contracts | 2 | 1 | — |
| cscl-01 | 1 | — | — |
| cscl-04 | — | 1 | — |
| cscl-05 | 1 | — | — |
| cscl-06 | 1 | — | — |
| cscl-07 | 1 | — | — |
| demo | 1 | — | — |
| rks-01 | 2 | — | 1 |
| scripts | 9 | — | — |
| tests | 1 | — | — |
| video-production-reference | 1 | — | — |

- Aliases: `packages/contracts/src/asf-synthetic-lifecycle-harness.ts:262`,
  `src/cscl-04/profile-builder.mjs:96`.
- Wrapper: `src/rks-01/deterministic-ingestion.mjs:20`
  (`export const canonicalJson = (value) => JSON.stringify(canonicalize(value));`).
  Arrow declarations with their own serialization body
  (`src/cscl-07/matrix.mjs:6`, `scripts/refresh-integrity-data.mjs:9`) are
  implementations, not wrappers — the classifier requires a same-line
  canonicalize-family helper reference for `wrapper`.
- Full file/line/owner/classification/digest table:
  `verification/canonical-json-profile-inventory-v1.json` → `profiles`.

## Consumers

- **14 consumer families**, 194 import sites across 193 files. Largest:
  `contracts` 124/124, `tests` 36/35 (one file with two import lines), `demo`
  9/9, `scripts` 8/8, `cks` 3/3. Full table:
  `verification/canonical-json-profile-inventory-v1.json` → `consumerFamilies`.
- **4 re-exports:** `demo/openclaw-agent/capability-m1-4-adapter.mjs:23`,
  `packages/contracts/src/index.ts:1`, `src/cscl-03/profile-builder.mjs:8`,
  `src/rks-02/comparator.mjs:6`.
- **30 similar-shape sites** (`canonicalize` 25, `encodeCanonical` 3,
  `canonicalDigest` 2) across contracts, scripts, tools, tests, and src
  families. Every entry carries `equivalence: "not-claimed"`.

## Byte obligations (42) and ledger state

Basis categories: `profile-implementation` (33 pinned profile files),
`parity-evidence` (1), `parity-fixture` (1), `ledger-name-match` (7).
The three derived census artifacts are excluded from this set because including
an artifact's own digest in that artifact would create an impossible hash cycle;
all three are independently bound by the `repository-integrity` DAG node.

**Canonical ledger state:**
- 1715 parseable digest lines and 1715 unique `./`-prefixed paths;
- zero duplicate paths and zero digest conflicts;
- the previously mixed-prefix duplicate tail was normalized mechanically.

The validator requires the obligation set to match exactly (no omitted,
duplicate, unknown, or tampered entries), each basis to match, and both the
recorded digest and the on-disk sha256 to agree. Any historical byte change
fails validation.

## Equivalence policy (fail-closed)

- `requiredDimensions: ["valid", "invalid", "unicode", "number"]`.
- Current evidence proves `valid` + `invalid` only (via
  `tests/canonical-json-runtime-parity.test.mjs`), so `stance: "NOT-PROVEN"`,
  `claims: []`, `missingDimensions: ["unicode", "number"]`.
- A claim is only stancable `PROVEN` when every claim covers all four
  dimensions; the validator rejects unproven claims, weakened dimension
  lists, and inconsistent stances. The parity test file and its fixture are
  byte-pinned, so the evidence itself cannot drift silently.

## Uncertainty and known limitations

- The census is **lexical/form-based**, not semantic: it counts declarations
  and import sites, not call graphs. Line-local classification is
  deliberately conservative — when in doubt, `implementation`.
- Owner families are mechanical path derivations, not code-ownership
  records.
- The scan roots exclude `.github`, `config`, and other non-code directories
  by design (source-code census); JSON fixture files are covered via the
  ledger name-match basis instead.
- A local Node exit 133/SIGTRAP or docker ENOENT during verification is
  infrastructure evidence, not a product verdict: record it, keep the
  artifact clean, and let the controller run the authoritative pinned-Node /
  host-Docker gates.

## Scope guard

This integration changes only the six authorized paths: this document, the
inventory JSON, the census test, `package.json`,
`verification/verification-dag-v2.json`, and `SHA256SUMS`. No historical
digest-bound bytes are regenerated, no utility consolidation or product-runtime
change is made, and no credential/remote/provider/service/CI/harness/DSH_HOME/
spill change, push, merge, or release occurs.