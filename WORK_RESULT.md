# WORK_RESULT — V001 delivery-contract issue template + bounded CONTRIBUTING/test integration (issue #416)

**Status: local PanSphaira change complete. NOT DELIVERED / NOT CLOSED.** This is a
bounded, locally validated source result on a fresh current-main checkout, admitted
at source main `d68fcbc24358277302bf25d27951639f3284d5c6` for issue #416
(label `priority:p2`, state READY). The scope is ONLY the independently authorized
V001 deliverable: a delivery-contract GitHub issue template plus a bounded
CONTRIBUTING section and a focused, canonically-registered test. Parent-side gates
remain open (see *Unresolved / parent-side gates*): independent review, semantic
main integration, exact PR/Main CI, release, Docker-E2E, and anonymous /
version-bound public readback. No push, no public mutation, no credentials, no
external systems, no issue closure. The delivery job controller performs fresh
Qwen review, exact PR/Main CI, release and anonymous readback; this work never
authors or approves those receipts and never claims delivered. `publicly_delivered`
remains false.

## Task

Implement ONLY the V001 scope for issue #416 in `JoFe2/PANSPHAIRA`:

- **AC01** — a new GitHub issue template
  `.github/ISSUE_TEMPLATE/delivery-contract.yml` with four sections (Ergebnis /
  Definition of Done, Readiness, Integration / Lieferung, Fortsetzung /
  Nachweis) and 16 required fields capturing result + non-claims, acceptance class,
  hard acceptance criteria with evidence type, versioned inputs/provenance, required
  authority, technical prerequisites **separated** from external proofs/holds/
  administration, priority, common integration surfaces, candidate line, Delivery
  Owner, independent Reviewer, and (when waiting) the on-hold owner + resume
  trigger. **No pre-filled success/READY/authorization claims.** Evidence is the
  actually-parsed form structure plus required-field tests.
- **AC02** — a short CONTRIBUTING section linking the template; explain that
  Readiness is scoped to the named range; that Code / Integration / public
  delivery / certification / administration are distinct; that filled fields grant
  no approval and lift no holds; and that independent reviews plus the
  release/readback rules remain binding.
- **AC03** — preserve the existing Bug/Feature forms, the private security report,
  secret protection, and the "proposal is not authorization" hint; no
  migration/rewriting of history. Evidence = baseline comparison + diff review.
- **AC04** — at most two short fictional examples (one independently-deliverable
  tooling; one where certification waits on external evidence while independent
  work continues). A focused test using a **real YAML parser** checking valid
  GitHub form structure, unique IDs, required fields, links, and secure defaults,
  plus negative tests for missing claim-boundary/authority/owner/reviewer and for
  hold-removing changes. The test is registered canonically **exactly once**.
- **AC05** — independent candidate review, semantic main integration, all PR/Main
  CI, release, Docker-E2E, anonymous readback, and functional + version-bound
  public readback: **owned by the delivery controller, NOT this work.** Recorded
  below as UNRESOLVED and never claimed delivered.

## Source inspection (fresh Main, d68fcbc)

- No existing delivery-contract template. `.github/ISSUE_TEMPLATE/` held the
  Bug/Feature forms plus the private security-report pointer. Gap confirmed before
  authoring; the existing forms were left byte-identical (AC03).
- `scripts/build-public-release.sh` is a fail-closed source-tree integrity gate: it
  walks `root.rglob("*")` (line 251) and every file must be either in the release
  manifest, under an exempt prefix (`.github/` at line 279), in
  `repository_only_files` (lines 198–229), or under `repository_only_prefixes`
  (lines 230–250); otherwise it raises `UNMANIFESTED_SOURCE_FILE:<relative>`
  (line 288). The manifest count is bound to `1495` (line 192).
- The focused test lives under `tests/` (not a release-exempt prefix) and is not in
  the manifest, so it **must** be registered in `repository_only_files` — the
  canonical mechanism (precedent set by the sibling `tests/*.test.ts` entries at
  lines 204–205 and 211–228). This is not a test/governance weakening: it is the
  single declared owner of that set, and it does not change the manifest count.

## TDD (RED → GREEN)

- **RED (base `d68fcbc`, before the fix):** the full `npm test` scope fails via
  `tests/supply-chain-verifier.test.mjs:89` — the "public release staging accepts
  an isolated Git worktree control file" test runs `build-public-release.sh` on a
  real repo copy and the new test file, being unregistered, raised
  `UNMANIFESTED_SOURCE_FILE:tests/delivery-contract-template.test.mjs`. This is the
  real, non-environmental RED this task required, demonstrated before the minimal
  fix.
- **GREEN (minimal fix):** register
  `tests/delivery-contract-template.test.mjs` in `repository_only_files`
  (`build-public-release.sh`, +1 line at line 206). No test or governance was
  weakened; no exempt prefix widened; the manifest count is still 1495; the single
  owner of the `repository_only_files` set is untouched. Focused:
  `node --test tests/supply-chain-verifier.test.mjs` → 7/7 PASS.
- **Focused test:** `tests/delivery-contract-template.test.mjs` — 11 tests, all
  GREEN, using the real `yaml` parser (`import { parse, stringify } from "yaml"`,
  `yaml@2.9.0`). Pure `validateDeliveryContract(source)` returns coded problems;
  `withMutation(mutate)` parses the real file, mutates, and re-stringifies through
  the parser. Positive: valid GitHub form structure, unique field IDs, all 16
  fields `validations.required: true`, the four section headers present, the
  hold/claim guard lines present, the CONTRIBUTING + RELEASE-GOVERNANCE links
  present, and no pre-filled success/READY/authorization claim. Negative (real
  mutations): removing the claim-boundary guard, removing the authority field,
  removing the delivery-owner field, removing the independent-reviewer field, and a
  hold-removing change each FAIL with a distinct coded problem.

## Source changes (bounded; no governance weakened)

New files:

- `.github/ISSUE_TEMPLATE/delivery-contract.yml` — the AC01 template (4 sections,
  16 required fields, hold/claim guards, links). Under `.github/`, a
  release-exempt prefix (`build-public-release.sh` line 279).
- `tests/delivery-contract-template.test.mjs` — the AC04 focused test (real YAML
  parser; positive + negative).

Modified files:

- `scripts/build-public-release.sh` — **+1 line**: register
  `tests/delivery-contract-template.test.mjs` in `repository_only_files` (the
  canonical, fail-closed mechanism; the single owner of that set). This is the
  RED→GREEN fix. It is a DAG node and is re-digested by `integrity:refresh`.
- `CONTRIBUTING.md` — bounded "## Delivery-contract template" section (AC02) with
  the four-part explanation and two short fictional examples; the canonical local
  check set is preserved. No security/private-report/secret-protection section was
  altered (AC03).
- `package.json` — the `test` script registers
  `tests/delivery-contract-template.test.mjs` **exactly once** (canonical, single
  registration).
- `tests/canonical-json-profile-inventory.test.ts` and
  `verification/canonical-json-profile-inventory-v1.json` — census recount driven
  by the new files (`filesScanned` 635→636; ledger 1809→1811), refreshed by
  `integrity:refresh`.
- `verification/verification-dag-v2.json` — re-digested by `integrity:refresh`;
  `graphVersion` remains pinned at 47.
- `SHA256SUMS` — re-digested (1811 entries).

Explicitly **NOT** changed: no test weakened, no governance/authority file altered,
no hold lifted, no credential or execution-policy change, no existing form
rewritten, no history migrated.

## Commands and actual results (local, offline-capable, Node ≥ 24)

Ran on fresh current main. Environment note: `/tmp` here is a 1.0G RAM-backed
tmpfs; `node --test` defaults to 16-way concurrency and the public-release
staging test copies the ~52M public file set, so the exact `npm test` scope was
executed with a per-file `/tmp` clean (same preserved-set carve-out) so orphaned
fixtures never accumulate. Results:

1. `npm ci --ignore-scripts --no-audit --no-fund` — exit 0 (installs
   `yaml@2.9.0`).
2. `npm run release-governance:verify` — exit 0, `RELEASE_GOVERNANCE_PASS`.
3. `npm run lint` — exit 0.
4. `npm test` (full canonical scope): **pretest 459 pass / 0 fail** (exit 0);
   **main `node --test` suite 75/80 files pass**; **posttest 593 pass / 1 fail**.
   The only failures are `Error: spawnSync docker ENOENT` (no Docker binary/daemon
   in this sandbox) in:
   - main: `tests/builder-agent-runtime.test.mjs`,
     `tests/managed-skill-lifecycle-runtime.test.mjs`,
     `tests/model-access-broker-runtime.test.mjs`,
     `tests/openclaw-agent-runtime-lock.test.mjs`,
     `tests/openclaw-agent-runtime.test.mjs`
   - posttest: `tests/local-knowledge-wiki-container.test.mjs` (PSAI107
     "default-off offline container profile proves positive and fail-closed
     cases", run under the `wiki:test:compiled` group)
   These are the **same five main-suite Docker files** the base PS360 result on
   this admission already documents as failing "solely by the environment (not
   Docker installed in this container)". All six failing files are byte-identical
   to base (unchanged by this diff — confirmed against the change set below), so
   none is a regression from this work; every failure is the missing-`docker`
   `ENOENT` spawn error, not an assertion failure.
5. `npm run external-video-service:test` — 6/6, exit 0.
6. `sha256sum --check SHA256SUMS` — exit 0, 1811/1811 OK.

Change-related focused tests (this work's surface):

- `node --test tests/delivery-contract-template.test.mjs` — 11/11 PASS.
- `node --test tests/supply-chain-verifier.test.mjs` — 7/7 PASS (the test that
  surfaced the UNMANIFESTED RED; GREEN after the `repository_only_files`
  registration).
- `node --test tests/public-product-spelling.test.mjs` — PASS (this
  WORK_RESULT.md is spelling-safe: display name `PanSphaira`, repository slug
  `JoFe2/PANSPHAIRA`, issue `#416`; no bare all-caps token and no former-owner
  token on any line).

## Full suite result

Green and offline-capable across the full canonical check set, **except** the six
Docker-container tests above, which cannot run without a Docker daemon in this
sandbox and are the identical pre-existing environmental failures already
documented on this same admission (base PS360 WORK_RESULT). The two change-related
focused tests are 18/18 green. No assertion-level failure is attributable to this
change.

## Unresolved / parent-side gates (NOT done here; owned by the delivery controller)

Per the mandate, the delivery job controller — not this work — performs the
following. They are recorded as UNRESOLVED and are **never** claimed delivered
here:

- AC05 independent candidate review (fresh Qwen review).
- AC05 semantic main integration / merge.
- AC05 exact PR/Main CI.
- AC05 release (functional product increment, exact versioned class, SHA-256
  sidecar) and Docker-E2E.
- AC05 anonymous public readback and functional + version-bound public readback.
- Public issue #416 closure, only after the post-creation read-only workflow
  passes, per the release governance contract in `JoFe2/PANSPHAIRA`
  `docs/RELEASE-GOVERNANCE.md`.

No push, no public mutation, no credentials, no external systems, and no issue
closure were performed in this work.

## Nonclaims

- This does not claim readiness, delivery, or certification for issue #416.
- This does not assert that the template "approves" anything or "lifts" any hold;
  filled fields grant no approval and lift no holds.
- This does not weaken any test, alter any authority/governance file, change
  credentials or execution policy, or rewrite history.
- The template contains no pre-filled success/READY/authorization claim.
- `publicly_delivered` remains false; delivery and readback stay with the delivery
  controller.