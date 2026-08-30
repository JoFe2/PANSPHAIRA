# CKS-11 P20 function-parity fixtures

Task: RECOVERY-PSAI291-P20-FUNCTION-PARITY-01.

## Purpose

Deterministic, privacy-safe holdout evidence for W5 / P20 function parity
(`docs/architecture/cks-11-governance-decision-v1.md`): for the stable
substep `step:normalize-order`, the extracted Function candidate
`function:stable-order-normalizer` reproduces the original step's typed
result exactly — for both typed result kinds, `OUTPUT` and
`DECLARED_ERROR` — with bound typed evidence and a retained
original-step fallback rollback (fallback path, readback, and rollback
receipt). Nothing executes;
`verifyDeterministicFunctionParityV1`
(`src/cks/deterministic-function-parity-v1.ts`) is a pure verifier over
supplied typed projections and never promotes, activates, deploys, or
replaces its source substep.

## Fixtures

- `tests/fixtures/cks-11/p20-function-parity-holdouts-v1.json` — two
  PARITY_VERIFIED holdouts on the stable substep
  `step:normalize-order`: `p20-applicable-output-order-1`
  (POSITIVE_OUTPUT_PARITY, typed `OUTPUT` equality) and
  `p20-applicable-declared-error-order-2`
  (POSITIVE_DECLARED_ERROR_PARITY, typed `DECLARED_ERROR` equality). Each
  holdout carries one fully materialized
  `DeterministicFunctionParityInputV1`, a pinned
  `expectedDecisionDigest`, pinned typed input/result payloads, and a bound
  rollback triple. Every ref in the
  file is canonical: `digest === governedAssetsDigestV1({kind, id,
  schemaVersion, version})` under `pansphaira.cks-11/governed-assets/v1`,
  version `1.0.0`, `SHA-256`; the focused validator pins the exact
  Workflow/Function dependency IDs and the fallback/readback/historical
  rollback-receipt snapshot IDs, then confirms the source fixture bytes are
  unchanged after replay.
- `tests/fixtures/cks-11/p20-function-parity-rejections-v1.json` — six
  PARITY_REJECTED holdouts, each the same materialized base input with
  exactly one denial: missing evidence refs (MISSING,
  `INVALID_INPUT`), an ambiguous noncanonical top-level shape
  (AMBIGUOUS, `INVALID_INPUT`), a stale baseline whose original typed
  result no longer matches (STALE, `RESULT_MISMATCH`), a candidate that
  drifted from the frozen original (DRIFTED, `RESULT_MISMATCH`), a
  noncanonical evidence ref digest (NONCANONICAL, `INVALID_INPUT`), and
  an unbound rollback readback (UNBOUND_ROLLBACK, `ROLLBACK_UNBOUND`).
  Each carry a pinned `expectedDecisionDigest`.
- `tests/cks-11/p20-function-parity-fixtures.test.ts` — the holdout file
  proves both PARITY_VERIFIED / PASS decisions against the pinned
  digests (original and candidate result digests equal, parity and
  deterministic-replay digests present, canonical refs, frozen decisions,
  identical decision digests across a fresh replay); the rejection file
  proves every declared denial class denies fail-closed with the exact
  single reason code and null parity/replay digests; runtime mutation of
  a pinned holdout input (candidate drift, unbound rollback, missing
  evidence, synthetic shape, schema-version drift) also denies
  fail-closed. Exact dependency and rollback snapshot bindings are checked
  before replay, and both fixture envelopes are checked for input immutability
  after replay.
- `docs/development/cks-11-p20-function-parity-fixtures.md` — this
  document.

## Fail-closed properties

- A single malformed dimension denies the whole decision: missing,
  ambiguous, stale, drifted, or noncanonical fixtures each abort with
  exactly one reason code (`INVALID_INPUT`, `RESULT_MISMATCH`, or
  `ROLLBACK_UNBOUND`) and null parity / deterministic-replay digests.
- Typed `DECLARED_ERROR` results are first-class parity evidence: a
  terminal declared error is verified by exact typed-value equality, the
  same as typed `OUTPUT`.
- Rollback is a binding condition, not an annotation: any null or
  malformed fallback / readback / receipt ref denies
  (`ROLLBACK_UNBOUND`).
- The `EVIDENCE_INCOMPLETE` reason code is declared in the decision
  contract but not emitted by the v1 verifier (absent evidence is
  `INVALID_INPUT`); it is reserved for future evidence-binding
  verification.
- No execution, promotion, activation, or authority change is performed
  or implied by these fixtures; all values are synthetic. P19/P20
  promotion remains `DENIED`
  (`tests/fixtures/cks-11/p19-p20-holdouts-v1.json`,
  `tests/fixtures/cks-11/p19-p20-rejections-v1.json`).

## Verification

- Continuation rerun in this worktree: the required canonical build and focused
  test commands below both reproduce the local Node/V8 startup SIGTRAP (exit
  133), while `git diff --check main...HEAD` exits 0. This confirms the prior
  infrastructure classification without changing the four P20 artifacts.
- `npm run build --silent` — local Node v24.19.0 aborts during V8 isolate
  startup with a native SIGTRAP (exit 133, `SetPermissions` errno 12), before
  TypeScript runs. This is local runtime infrastructure evidence, not a
  product verdict; the controller runs the authoritative pinned-Node /
  host-Docker gates.
- `node --test dist/tests/cks-11/p20-function-parity-fixtures.test.js` — the
  same local Node startup SIGTRAP occurs (exit 133), including with the
  bounded `--max-old-space-size=256` retry. The compiled focused test remains
  the required gate for the controller environment.
- `NODE_OPTIONS=--jitless node --test
  dist/tests/cks-11/p20-function-parity-fixtures.test.js` — bounded V8
  execution passes all 3 focused tests (3 passed, 0 failed). This is only a
  local runtime workaround; it does not replace the required canonical
  command above.
- `NODE_OPTIONS=--jitless npm run build --silent` — reaches TypeScript after
  bypassing the local V8 startup failure, but reports pre-existing CKS
  compilation errors in `src/cks/function-extraction-v1.ts` and its contract
  test. Those files are outside this fixture slice and were not changed.
- `git diff --check main...HEAD` — passes.
