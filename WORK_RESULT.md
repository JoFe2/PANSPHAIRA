# WORK_RESULT — PS360 source/documentation acceptance gap closure (parent #360)

**Status: local source closure complete. NOT DELIVERED / NOT CLOSED.** This is a
bounded source-only working result on a fresh current-main checkout (HEAD
`ae765100ac731b519906bacee5ce02dbeb2680d9`, the public AP-06 release commit).
This is **not** a duplicate AP implementation: the AP-01…AP-06 work and the
AP-06 frozen adapted-ERV proof probe (verdict `NARROW_GO`) and its release are
already public and byte-frozen. The one remaining unimplemented acceptance
criterion was the stale `WORK IN PROGRESS` ERV status in the released README
whose own text required removal after the public #366 `NARROW_GO` verdict and
closure. Parent-side gates remain open (see *Unresolved / parent-side gates*):
independent review, exact PR/Main CI, release, anonymous readback, and issue
closure. No push, no public mutation, no credentials, no external systems, no
issue closure. The delivery job controller performs fresh Qwen review, exact
PR/Main CI, release and anonymous readback; this work never authors or approves
those receipts and never claims delivered.

## Task

Complete the remaining source/documentation acceptance gap of #360: replace the
stale ERV status marker with `PROVEN_LOCAL_SYNTHETIC_POC` carrying the exact
immutable public proof/release links and a bounded `NARROW_GO` explanation;
reconcile the related proof documentation only as needed; map every parent
criterion to released evidence and test paths in a source-bound closure
document; keep the changed 200-bps variant typed `UNKNOWN` and never present it
as a released/supported/proven execution.

## Source inspection (fresh Main, ae76510)

SOURCE_ALREADY_PRESENT for all AP proof work: AP-01…AP-06 artifacts are
released, byte-frozen and replayable on this HEAD (probe
`verification/incoming-invoice-ap06-proof-probe-v1.json`, verdict
`NARROW_GO`, all nine `caseMatrix` rows oracle-matched, all eight `chain`
layers bound to released module digests). Nothing was rebuilt.

The stale marker reproduced RED before the fix:
`README.md` still carried `WORK IN PROGRESS · PLANNED · SHORT-TERM PROOF` and
the "Remove this work-in-progress marker only after #366 …" sentence;
`docs/INCOMING-INVOICE-PROVING-GROUND.md` still carried
`WORK_IN_PROGRESS_PLANNED_NOT_DELIVERED` with a stale `Current status` table
(`Product implementation | Not started`, `Product release | None`).

## TDD (RED → GREEN)

- RED: `tests/release-governance.test.mjs` gained the PS360 assertion block
  (new marker, exact public release tag + raw proof URL substrings, `NARROW_GO`
  verdict substrings, baseline `MATCHED` through the released core, 200-bps
  typed `UNKNOWN` wording, and the fail-closed negative that the 200-bps
  variant is never presented as released/supported/proven). Focused run on the
  fresh tree: 1 failure at the new marker assertion (86/87) — the stale README
  body in the failure diff confirmed the RED.
- GREEN: minimal source edits (below); focused run 87/87, and the canonical
  `release-governance:test` pair 92/92.

## Source changes (bounded; no governance weakened)

- `README.md`: the ERV marker is now
  `PROVEN_LOCAL_SYNTHETIC_POC · NARROW_GO · LOCAL SYNTHETIC`; the
  marker-removal sentence is replaced by the exact immutable public links
  (release tag
  `ap-06-frozen-adapted-erv-proof-probe-with-narrow-go-verdict-issue-366-95ecd4d587d9`
  and raw proof
  `https://raw.githubusercontent.com/JoFe2/PANSPHAIRA/ae765100ac731b519906bacee5ce02dbeb2680d9/verification/incoming-invoice-ap06-proof-probe-v1.json`)
  plus the bounded NARROW_GO explanation: the baseline resolves `MATCHED`
  through the released core, while the changed 200-bps tolerance has no
  released executable variant and stays typed `UNKNOWN` — not a proven 200-bps
  execution or arbitrary adaptability. Marketing-first layout, standalone core
  plus optional ERP framing, all nonclaim boundaries and the PS373 substrings
  are preserved; README word count (test metric) 999 → 997 (≤ 1000) and H2
  count unchanged at 8 (≤ 8). Two small unasserted marketing phrases were
  trimmed to keep the hard word budget; no asserted or probe-guarded text was
  removed.
- `docs/INCOMING-INVOICE-PROVING-GROUND.md`: marker now
  `PROVEN_LOCAL_SYNTHETIC_POC_NARROW_GO`; frontmatter and `## Proof packages`
  heading updated from "planned"; `Current status` table reconciled (work
  packages `6/6` frozen and executed; acceptance identifiers `34/34` preserved
  (28 + 6 exercised); public AP implementation issues kept at `6/6 open` —
  last recorded state, closure is the controller's; product implementation:
  bounded local-synthetic proof released, general product not started; product
  release: public local-synthetic PoC release (AP-06), general product none);
  the six added acceptance identifiers are now recorded as exercised by the
  released AP-05 receipt manifest and AP-06 proof probe; the promotion-gating
  paragraph records the public `NARROW_GO` verdict satisfying
  `AP-05-AC05`–`AP-05-AC08` and `AP-06-AC06`–`AP-06-AC07`, the 200-bps
  `TYPED_UNKNOWN` boundary, and states the general end-to-end product is not
  delivered.
- `tests/release-governance.test.mjs`: the two stale positive assertions
  (README marker-removal sentence, doc WIP marker) became fail-closed
  negatives; new positives for the new markers, the exact public links, the
  NARROW_GO substrings and the reconciled status rows. No existing assertion
  was weakened or deleted.
- `docs/evidence/PS360-SOURCE-CLOSURE-v1.md` (new, repository-only, not in the
  public manifest): source-bound closure record mapping every parent #360
  criterion (the 34 acceptance identifiers across AP-01…AP-06) to released
  evidence artifacts and focused test paths, with the genuinely unmet items
  retained explicitly (200-bps variant `TYPED_UNKNOWN`; parent delivery
  receipts owned by the controller; general product not delivered;
  ERP-enhanced composition separately authorized).
- `SHA256SUMS` and `verification/verification-dag-v2.json`:
  repository-required integrity refresh for the changed source only. The DAG
  diff is exactly two re-hashed inputs (`README.md`,
  `tests/release-governance.test.mjs`); `graphVersion` remains 47, node count
  56, no manifest entry added, no frozen producer/fixture/contract touched
  (the frozen AP-06 probe bytes are unchanged — `git status` shows none of the
  `verification/incoming-invoice-*` artifacts modified).

## Commands and actual results (local, offline-capable, Node ≥ 24)

- `npm install --cache /tmp/npm-cache --no-audit --no-fund` — exit 0
  (fresh environment; 139 packages).
- RED: `node --test tests/release-governance.test.mjs` on the fresh tree —
  exit 1, 86/87 (single failure at the new marker assertion).
- `npm run release-governance:test --cache /tmp/npm-cache`
  (`tests/release-governance.test.mjs` + `tests/public-product-spelling.test.mjs`)
  — exit 0, 92/92.
- `npm run integrity:refresh --cache /tmp/npm-cache` — exit 0: "refreshed 30
  runtime-lock artifacts, 47 proof artifacts, and 1809 checksums" (entry count
  unchanged at 1809).
- `sha256sum --check SHA256SUMS` — exit 0, 1809/1809 OK.
- `npm run release-governance:verify --cache /tmp/npm-cache` — exit 0,
  `RELEASE_GOVERNANCE_PASS`.
- `npm test --cache /tmp/npm-cache` (pretest chain: build + 25 focused suites
  including `incoming-invoice-ap06-proof-probe:test:compiled` proving the
  frozen probe regenerates byte-identically; then the main suite) — see
  *Full suite result* below.
- `npm run lint --cache /tmp/npm-cache` — see *Full suite result* below.

## Full suite result

`npm test --cache /tmp/npm-cache` (single invocation: pretest chain, then the
main `node --test` suite) — overall exit 1, caused solely by the environment
(not Docker installed in this container):

- **Pretest chain (build + 25 focused suites): fully green.** `tsc -p
  tsconfig.json` (exit 0), then all 25 focused suites pass with zero
  failures — 432/432 focused tests — including
  `incoming-invoice-ap06-proof-probe:test:compiled` (4/4: the frozen AP-06
  proof probe regenerates byte-for-byte, binds source/setup/variant/probe
  identities against the checked-in bytes, the verifier rejects an omitted
  delta / invented capability / mutated identities, and the generator fails
  closed). No focused suite failure.
- **Main suite: 717 tests, 708 pass, 9 fail.** All 9 failures are
  `Error: spawnSync docker ENOENT` — the `docker` binary is absent in this
  container, so the five runtime-posture suites that shell out to
  `docker compose config` cannot run:
  - `tests/builder-agent-runtime.test.mjs` — `BLD-001-G6 remains default-off
    and pins the real OpenClaw fixture image`, `BLD-001-G6 services are
    non-root, read-only, unprivileged and closed-network only` (2)
  - `tests/managed-skill-lifecycle-runtime.test.mjs` — `AAS-037 runtime is
    default-off and pins the proven OpenClaw image`, `AAS-037 agent is
    non-root/read-only with a read-only managed skill volume and one closed
    network` (2)
  - `tests/model-access-broker-runtime.test.mjs` — `AAS-036-6/8 runtime is
    default-off, pinned, isolated and rollback scoped` (1)
  - `tests/openclaw-agent-runtime-lock.test.mjs` — `OPENCLAW-M1.1 accepted
    setup sends only explicit linux/amd64 build and run requests`,
    `OPENCLAW-M1.1 reset after interruption is idempotent, default-off and
    ownership-scoped` (2)
  - `tests/openclaw-agent-runtime.test.mjs` — `AAS-035 default-off profile
    and immutable OpenClaw image lock`, `AAS-035 non-root read-only bounded
    posture has one closed network` (2)
- Combined (focused + main): 1139 tests, 1130 pass, 9 fail — every failure
  is the docker-binary-missing `ENOENT` spawn error above, none is an
  assertion failure, and none involves a file changed by this work
  (`README.md`, `docs/INCOMING-INVOICE-PROVING-GROUND.md`,
  `tests/release-governance.test.mjs`, `SHA256SUMS`,
  `verification/verification-dag-v2.json`). An A/B re-run of the main suite
  against pristine `ae76510` was not performed in this session; the failure
  signatures (missing `docker` binary) are environmental by construction.
- `npm run lint --cache /tmp/npm-cache` — exit 0 (`tsc -p tsconfig.json`, the
  same build already executed and green as the first step of the pretest
  chain).

## Unresolved / parent-side gates

- **200-bps changed variant (genuinely unmet, by design)**: the requested
  `RATE_BPS_V1@1.0.0 rateBasisPoints=200` has no released AP-04 core variant
  (released variant is `rateBasisPoints=100`); the changed execution stays
  `TYPED_UNKNOWN` with `coreExecutable=false`. This is the narrow boundary of
  the public `NARROW_GO` verdict, not a defect of this source work.
- **Parent delivery receipts (out of scope per directives, not performed
  here)**: independent (Qwen) review, exact PR/Main CI, release publication,
  anonymous readback, and public issue closure for #360/#361–#366. The public
  AP implementation issues remain recorded as `6/6 open`; closure happens
  after controller readback.
- **General end-to-end product**: not delivered; the README keeps the
  `[work in progress](https://github.com/JoFe2/PANSPHAIRA/issues/360)` link
  for the general product. Only the bounded incoming-invoice local-synthetic
  proof slice is proven.

## Nonclaims

- `NO_CUSTOMER_DATA_EVALUATED`; `NO_EXTERNAL_PROVIDER_EVALUATED`;
  `NO_PRODUCTIVE_ALLOCATION_OR_POSTING_AUTHORIZED`; `NO_BOOKING_AUTHORITY_GRANTED`;
  `NO_LIVE_ERP_SYSTEM_CLAIM`; `NO_INVENTED_CAPABILITY_OR_AUTHORITY`;
  `NO_TOLERANCE_SUBSTITUTION_FOR_MISSING_VARIANT`. Nothing here is a claim
  that #360 is delivered or closed; the 200-bps variant is never presented as
  a released, supported or proven execution, and no arbitrary adaptability is
  claimed as proven.