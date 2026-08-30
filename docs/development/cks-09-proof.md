# CKS-09 Offline Proof Dry-Run Receipt

## Metadata

- **Issue:** `PSAI289-QWEN-06-OFFLINE-PROOF-READBACK`
- **Pinned base:** `0622259` on `conveyor/pansphaira-289` (local slice; not pushed, merged, or released)
- **Risk lane:** local / offline / synthetic — simulation or shadow replay only
- **Data:** local synthetic fixtures only (admitted, sealed, raw-byte `sha256`-pinned); no tenant, customer, or production data
- **Network/provider:** none — no model, provider, service, tool, storage, or network call
- **Authority:** no execution or production authority; evidence-bound readback only

## What this proves

A deterministic offline dry-run (`scripts/run-cks-09-proof-dry-run.mjs`) verifies an
admitted, sealed, digest-pinned evidence envelope
(`tests/fixtures/cks-09/e2e-positive-evidence-v1.json`), re-runs the frozen synthetic
proof pipeline, and renders the privacy-safe, evidence-bound receipt
`verification/cks-09-offline-proof-receipt-v1.json`
(`canonicalDigest sha256:b70a3107d3a3fa0ad7de2ac6f1073d2b9be2d1def1abd1fff1269936da5d13c4`).

Every criterion is evidence-bound to the complete five-criterion set and the three
exactly pinned fixture ID/path pairs (`holdout-cases-v1.json`,
`pattern-trap-cases-v1.json`, `holdout-ground-truth-v1.json`); partial criterion sets,
substituted evidence paths, and duplicate bindings fail closed. The admitted positive
set passes:

| Criterion | Verdict |
| --- | --- |
| `P17_EXPERIENCE_IMPROVES_QUALITY_COST` — paired ablation derives quality labels from exact selected pattern IDs versus authoritative ground truth and cost from retrieval invocations/reports/selections plus the ground-truth error penalty; caller checks and event counts are not scored | PASS |
| `P18_PLANTED_STABLE_IDENTIFIED_TRAPS_DENIED` — planted stable pattern accepted; frequency-only, narrow-context, and correlation traps denied | PASS |
| `INAPPLICABLE_VERSION_DRIFT_REUSE_DENIED` — similar-looking-but-inapplicable, version-drift, unknown-context, and absent-evidence reuses denied | PASS |
| `SHADOW_ONLY_SIMULATION_BOUNDARY` — replay stayed simulation/shadow; no external state, no model/service call, no procedure content; 5 fail-closed boundaries exercised | PASS |
| `CANDIDATE_PRESERVATION` — dependencies, known failures, counterexamples, and provenance preserved with complete counterevidence coverage | PASS |

Fail-closed behavior is proven by `tests/fixtures/cks-09/e2e-rejections-v1.json` (8
envelope-boundary mutations) and `tests/cks-09-proof-dry-run.test.mjs`: non-admitted
evidence, unsealed holdout, live replay mode, and any truthy shadow-boundary flag are
denied or inconclusive with frozen reason codes; tampered digest pins and missing
evidence fixtures fail closed with `MISSING_288_DIGEST` / `MISSING_EVIDENCE`. Identical
inputs render byte-identical receipts, and the committed receipt is byte-identical to a
fresh render.

The final criterion verifier compares exact P18 accepted/denied case identities and
denial verdicts/reasons, exact reuse-boundary identities/outcomes/reasons, all five exact
shadow-boundary identities/verdicts/reasons, and equality of every preserved dependency,
known-failure, counterexample, provenance, and coverage field. Same-length substitutions
therefore deny rather than pass. Caller-authored paired summaries and re-digested label or
event-count substitutions cannot manufacture P17 evidence.

## Expected focused commands

```bash
/usr/bin/node --test dist/tests/cks-task-fingerprint-pattern-contracts.test.js dist/tests/cks-applicability-aware-retrieval.test.js dist/tests/cks-shadow-experience-ablation.test.js dist/tests/cks-solution-pattern-candidate-evaluator.test.js tests/cks-09-synthetic-proof-fixtures.test.mjs tests/cks-09-proof-dry-run.test.mjs tests/cks-09-public-readback.test.mjs
/usr/bin/node scripts/run-cks-09-proof-dry-run.mjs --fixture tests/fixtures/cks-09/e2e-positive-evidence-v1.json --dry-run
git diff --check main...HEAD
```

## Non-claims

- This is an admitted synthetic shadow replay only.
- It is not a production quality, cost, efficiency, or generalization claim.
- It grants no execution authority and contains no procedure content.
- It calls no model, provider, service, tool, storage, or external state.
- A successful terminal issue proof requires a later governed release; this local proof
  neither performs nor claims that release.
- No success is claimed without the required admitted, sealed, digest-verified
  evidence; absent or tampered evidence fails closed.