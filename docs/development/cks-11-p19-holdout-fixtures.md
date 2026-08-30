# CKS-11 P19 workflow holdout fixtures

Task: PSAI291-QWEN-06A-P19-WORKFLOW-HOLDOUT-FIXTURES.

## Purpose

Deterministic, privacy-safe holdout evidence for W5 / P19 shadow parity
(`docs/architecture/cks-11-governance-decision-v1.md`): on applicable
holdouts the governed shadow path demonstrates equal-or-better predeclared
quality at strictly lower measured generative-reasoning cost, and the
required safe-abort cases deny fail-closed. Nothing executes;
`replayShadowWorkflowV1` (`src/cks/shadow-workflow-replay-v1.ts`) compares
supplied recorded projections only.

## Fixtures

- `tests/fixtures/cks-11/p19-workflow-holdouts-v1.json` — two APPLICABLE
  holdouts (`p19-applicable-order-1`, `p19-applicable-order-2`), each with
  baseline and governed projections. Baseline and governed output,
  verification, rollback, and dependency evidence are identical; governed
  quality is equal or better (0.90 = 0.90, 0.85 >= 0.82) and governed
  reasoning cost is strictly lower (80 < 100, 110 < 150). Each projection's
  knowledge dependency snapshot is digest-bound to the holdout's exact
  `knowledgeInput` bindings.
- `tests/fixtures/cks-11/p19-workflow-rejections-v1.json` — four SAFE_ABORT
  holdouts, each a fully materialized applicability input with exactly one
  denial: unknown input field (INVALID_INPUT), Knowledge version drift
  (VERSION_DRIFT), unavailable boundary (BOUNDARY_UNAVAILABLE), and
  authority widening (AUTHORITY_WIDENING).
- `tests/cks-11/p19-holdout-fixtures.test.ts` — the merged run proves
  SHADOW_PARITY_VERIFIED / PASS (2 applicable + 4 safe aborts, decision
  reasons `["NONE"]`, stable decision digest across calls, frozen results);
  each file alone aborts fail-closed (holdouts: `SAFE_ABORT_REQUIRED`,
  rejections: `NOT_APPLICABLE`); mutated governed evidence (cost equal,
  quality lower, output or verification divergence), a forged transitive
  closure digest, and capability/authority widening on applicable holdouts
  all deny fail-closed.

## Fail-closed properties

- Fast paths cannot widen Capability or Authority: envelope digests are
  compared at applicability time, widening aborts the fast path
  (`FAST_PATH_ABORTED`) and therefore the replay decision.
- A standalone fixture file is not sufficient evidence: each file alone
  aborts, so a P19 PASS requires both applicable parity and safe-abort
  coverage of the declared reasons.
- No execution, promotion, activation, or authority change is performed or
  implied by these fixtures; all values are synthetic.

## Verification

- `npm run build --silent` — pre-existing unrelated type errors in
  `src/cks/function-extraction-v1.ts` and
  `tests/cks-11/function-extraction-contract.test.ts` exit the build with
  code 2 at HEAD; emit still completes because `noEmitOnError` is not set.
  Recorded as infrastructure evidence, not a product verdict; the controller
  runs the authoritative pinned-Node / host-Docker gates.
- `node --test dist/tests/cks-11/p19-holdout-fixtures.test.js`
- The repository profile command
  `npm test -- --runInBand tests/cks-11/p19-holdout-fixtures.test.ts` is
  jest-style; this repository runs native `node --test` on compiled
  `dist/tests/**.js`, and the npm `test` script does not list cks-11 tests,
  so the literal command cannot pass locally. The focused check above is the
  local equivalent.
- `git diff --check main...HEAD`