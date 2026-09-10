# WORK_RESULT — PS374-ERV-UI-01 (issue #374, parent #360)

**Status: NOT DELIVERED / NOT CLOSED.** This is a local, in-bounds working result on a fresh
current-main checkout. Parent-side gates remain open (see *Unresolved / parent-side gates*):
independent review, exact PR/Main CI, release, anonymous readback, and reconciliation. No push,
no public mutation, no credentials, no external systems, no issue closure.

## Task

Publish a versioned, renderer-neutral `ErvUiPackageV1` and prove that an **independent generic
frontend consumer** can render baseline (`LEAN`) and dialogue-derived (`SEGREGATED_ENTERPRISE`)
ERV states **without hard-coded ERV business logic**. Depends on #365.

## Core finding (reproduced RED on fresh main)

A schema-conforming independent generic package passes the Ajv schema, yet rendering reported
`DENIED / PACKAGE_INTEGRITY_DENIED` because validation still required hard-coded released AP05
bindings. Qualified fix: **separate trusted producer/source validation from schema-only
rendering, and preserve the source-forgery denials.**

On fresh main the capability is absent. Reproduced RED:

```
$ node --test erv-ui-reference/test.mjs
Error [ERR_MODULE_NOT_FOUND]: Cannot find module '.../erv-ui-reference/reference.mjs'
  tests 1, pass 0, fail 1
```

## The change (TDD, minimal, additive)

New self-contained, framework-neutral reference module in a **new top-level directory**
`erv-ui-reference/` — deliberately outside the 8 census `SCAN_ROOTS` and out of `SHA256SUMS`
(mirrors the `video:test` / `adaptive-controller:test` self-contained-reference precedent). It is
a pure Node/ESM module (no build, no `tsc`).

- **`schema.json`** — the closed, versioned `ErvUiPackageV1` contract (JSON Schema draft 2020-12,
  `additionalProperties: false` at every level). Ordered screens/sections/components; field IDs;
  display kinds; explicit `VALUE/UNKNOWN/CONFLICT/UNSUPPORTED` states with the
  value↔reasonCode invariant; labels/help/accessibility text; evidence refs and reason codes.
  Safe actions: stable action ID, `enabled`/`disabledReason` invariant, required evidence,
  effective Authority `NONE`, confirmation/readback intent, and `additionalProperties: false`
  forbids any `callback`/`code`/`route` token. Binds requirement/configuration/scenario/core
  digests and a self-integrity readback.
  - Note: the conditional `if/then/else` value/reasonCode (and enabled/disabledReason) logic was
    made strict-mode-clean for Ajv 8.20 by declaring the conditionally-required property in the
    sub-node's own `properties` (semantics unchanged).
- **`descriptors.mjs`** — neutral, local-synthetic fixtures (LEAN + SEGREGATED_ENTERPRISE)
  carrying the concrete ERV field/action/component identifiers. Kept OUT of the engine so the
  consumer stays renderer-neutral (no ERV allowlist, no scenario branching). No customer data,
  no ERP, no productive posting.
- **`reference.mjs`** — the neutral engine: canonical-JSON + SHA-256 primitives; the closed
  schema driver (Ajv2020 strict); the data-driven trusted producer (`createErvUiPackageV1` +
  `createLeanBaseline`/`createSegregatedEnterprise`); the **schema-only renderer** / independent
  generic consumer (`renderErvUiPackageV1` / `genericReferenceConsumerRender`); the
  self-consistency integrity gate (`verifyErvUiPackageV1Integrity`) — the fail-closed forgery
  denials; the exact component/action delta (`computeErvUiPackageDeltaV1`); and the **separate,
  preserved trusted-source forgery gate** (`verifyTrustedErvUiSourceV1` → `SOURCE_FORGERY_DENIED`).
- **`test.mjs`** — focused AC01–AC06 positive/negative + fail-closed matrix (28 tests).
- **`package.json`** — added `erv-ui-reference:test` (self-contained, no build) and chained it
  into `pretest` (matching the self-contained `adaptive-controller:test` / `video:test` precedent).
  Two lines only; no governance change.

### AC coverage

- AC01 closed schema (baseline conforms; unknown top-level key / callback / missing reasonCode rejected).
- AC02 safe actions (stable id, Authority NONE, confirmation/readback intent, no callback/code/route; disabled↔reason invariant).
- AC03 bound digests recompute; LEAN vs SEGREGATED share requirement+core, differ configuration+scenario; reproducible exact delta.
- AC04 generic consumer renders both via the schema only; a11y matches an independent oracle; consumer carries no ERV allowlist / no scenario branching; an independent schema-conforming package renders without trusted-source binding.
- AC05 fail-closed: unknown field, extra component, hidden action, missing evidence, cross-context, reordered content, forged digest, tampered readback, unsupported display kind.
- AC06 deterministic, deeply immutable, framework-neutral, no ERP.
- Separation: schema-only rendering accepts a conforming self-consistent package; forgery denials preserved and distinct.

## Actual commands and results (fresh current-main checkout)

```
$ node --test erv-ui-reference/test.mjs        # focused RED→GREEN
  tests 28, pass 28, fail 0

$ npm run build                                # toolchain (tsc -p tsconfig.json)
  exit 0

$ node --test dist/tests/canonical-json-profile-inventory.test.js   # census
  tests 35, pass 35, fail 0                    # filesScanned=622 / ledger=1787 UNCHANGED

$ npm run incoming-invoice-erv:test:compiled
  tests 8,  pass 8
$ npm run incoming-invoice-adaptive-ui:test:compiled        # frozen-tolerance predecessor
  tests 10, pass 10
$ npm run incoming-invoice-ap05-receipt-manifest:test:compiled  # receipt manifest byte-for-byte
  tests 6,  pass 6
$ npm run release-governance:test
  tests 85, pass 85, fail 0

$ npm run erv-ui-reference:test --silent       # as registered
  tests 28, pass 28, fail 0
```

## Change surface (verified with `git status`)

- Modified: `package.json` (2 lines: new script + `pretest` chain entry).
- Added (new top-level dir): `erv-ui-reference/{schema.json, descriptors.mjs, reference.mjs, test.mjs}`.

File SHA-256 (added files):
```
ced5edd9d3566c9649d72daaa68927dac6369d2c7f7443251f45eac12b4b4e45  erv-ui-reference/schema.json
18c4738ac0aaeec377533de18aeff435d194bf5faab610d1ffa03df345db83ed  erv-ui-reference/descriptors.mjs
6d8c7f9b90fefa611b78314533fd7c0e38d7540de4e5031b881063693679d76c  erv-ui-reference/reference.mjs
01d758c7b269b0dbe794ce1cb51b75c52dbbe13dc3d32d540ea73876e7770afa  erv-ui-reference/test.mjs
```

## Governance verification

- Frozen predecessor `packages/contracts/src/incoming-invoice-adaptive-ui.ts`: **unchanged** (empty
  `git status` for the path); the AP-05 receipt manifest regenerates **byte-for-byte** against
  `verification/incoming-invoice-ap05-receipt-manifest-v1.json` (ap05 test 6/6).
- No governance artifact changed: `SHA256SUMS`, `verification/`, `scripts/refresh-integrity-data.mjs`
  all clean.
- Census: new top-level dir is outside the 8 `SCAN_ROOTS` and `.mjs`/`.json` fixtures are not ledger
  entries → `filesScanned=622` and ledger `entries=1787` are unchanged (census 35/35).
- Release-governance 85/85 (checks governance-config content, not the file tree).
- Tests were not weakened; governance was not changed; optional hints remain optional.

## Unresolved / parent-side gates (NOT done here, by boundary)

- Dependency on #365 (AP-01..06 standalone ERV package) must be satisfied before this can land.
- Full `npm test` feature suite and the complete `pretest` chain run under exact PR/Main CI by the
  parent (not re-run locally in full; only the governance-critical canonical subset above was run).
- If/when the reference module is later moved into a census `SCAN_ROOT`, the census counts and
  `SHA256SUMS` ledger would need a governed refresh — intentionally avoided here by the top-level
  placement.
- Parent performs: independent review, exact PR/Main CI, release, and anonymous readback. Reconciliation.
- **This work must NOT be claimed as delivered, and issue #374 must NOT be closed.**