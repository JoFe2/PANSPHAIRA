# CKS-07 empty-KB proof harness

This is a local, synthetic, read-only proof slice for the CKS-07 acceptance criteria. It does not contact the Internet, invoke a model, promote Knowledge, grant Authority, or mutate an external system.

## Run

From the repository root:

```text
node --test tests/cks-07-empty-kb-dry-run.test.mjs
node scripts/run-cks-07-empty-kb-dry-run.mjs --fixture tests/fixtures/cks-07/e2e-positive-evidence-v1.json --dry-run
git diff --check origin/main...HEAD
```

The harness renders the public-safe projection to:

`verification/cks-07-empty-kb-dry-run-evidence-v1.json`

The local environment may require `node --jitless` because of its native V8 memory-permission restriction. That is an infrastructure workaround, not a product behavior change.

## Evidence flow

1. The existing empty/minimal-KB fixture is scored by the frozen P11/P13 scorer.
2. The existing P12 positive and negative fixtures are replayed through the frozen gap-acquisition contract.
3. Every receipt-bearing decision is replayed with identical input bytes and compared byte-for-byte.
4. Receipt runtime validation and the P12 JSON Schema are checked before a public projection is rendered.
5. Only summary fields, finite states, digests, and explicit non-claims are rendered. Raw candidate statements are not copied into the public-safe draft.

## Acceptance matrix

| Criterion | Local proof |
| --- | --- |
| P11 | Nine cases report requirement recall, requirement precision, and critical misses. The committed draft records mean recall `0.14814814814814814`, mean precision `0.2222222222222222`, 15 total critical misses, and eight cases containing critical misses. |
| P12 | A1 and A2 recoveries terminate at the earliest qualifying alternate level. `GAP_MISSING` is emitted only after A0, A1, and A2 all return `NO_MATCH`. A3-A5 candidates remain `NON_AUTHORITATIVE_CANDIDATE`, `NOT_ACCEPTED`, and `NOT_REQUESTED`. |
| P13 | The combined Sufficiency proof has zero false-completeness cases versus eight for the simple solver, retains one true-completeness case, and records absolute reduction `1`. |
| Fail closed | Missing, bad-source, applicability, conflicting, and unknown-semantic cases remain finite gap states. Incomplete recovery and changed knowledge bundles are `BLOCKED`. |
| Authority boundary | `INTERNET_RESULT` and `MODEL_RESULT` are never accepted Knowledge and never grant Authority. The boundary is explicitly read-only and excludes credentials, policy, capability, tool-write, and execution authority. |

## Public-safe scope and non-claims

The evidence is `PUBLIC_SAFE_LOCAL_SYNTHETIC`, `OFFLINE_PROFILE_ONLY`, and `DRY_RUN`. It claims only this deterministic fixture replay and its contract checks. It does not claim CI, merge, release, deployment, production activation, global domain quality, or parent-epic completion.

The harness writes no credentials, remotes, providers, services, DSH state, or spill configuration. It performs no promotion or external write.
