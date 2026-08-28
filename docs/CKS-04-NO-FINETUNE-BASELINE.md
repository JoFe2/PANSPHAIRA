# CKS-04 no-fine-tune baseline

This repository contains a local, deterministic CKS-04 evidence/replay baseline. It is a review artifact, not a qualification result.

## What is bound

`verification/cks-04-no-finetune-baseline-evidence-v1.json` records the exact model, quantization, runtime, prompt, Knowledge edition, query tool, and verifier bindings. The execution posture is:

- `LOCAL_NO_FINE_TUNE`
- `DENY_ALL` network policy
- weight modification forbidden
- action authority `NONE`
- `VERIFIED_RECEIPT_ONLY` scoring

The deterministic verifier is `PSAI284-DETERMINISTIC-EPISTEMIC-VERIFIER` v1. The semantic verifier is identified separately, is not implemented or trusted in this receipt, and cannot override deterministic failure.

## Replay coverage

The six offline scenarios are replayed from `tests/fixtures/cks-04/p2-p3-scenarios-v1.json`:

- P2: one unknown synthetic fact/procedure case; one verified pass with complete claim-to-evidence and procedure coverage.
- P3: five fail-closed cases covering applicability mismatch, active exclusion, parametric conflict, missing Knowledge, and conflicting Knowledge; all five abstain with explicit reason codes.

Every case must emit a typed bounded Knowledge Query request. The deterministic receipt checks request and Knowledge bindings, task scope, applicability, exclusions, explicit preconditions, Knowledge state, claim/procedure evidence coverage, response state, IDs, versions, and digests.

## Local checks

Build the TypeScript contracts before invoking the replay scripts:

```text
npm run build
node --test tests/cks-04-baseline-evidence.test.mjs
node scripts/verify-cks-04-baseline-evidence.mjs --input verification/cks-04-no-finetune-baseline-evidence-v1.json --allow-template
node scripts/render-cks-04-public-readback.mjs --input verification/cks-04-no-finetune-baseline-evidence-v1.json --dry-run
```

The verifier requires `--allow-template` because this checked-in artifact uses the local manifest template. Without that explicit gate it denies the evidence. The renderer always remains a dry-run local readback and first performs the same fail-closed verification.

## Nonclaims

This baseline does not claim model competence, model qualification, fine-tuning or weight modification, semantic review completion, action authority, external publication, or release approval. `qualificationStatus` therefore remains `NOT_QUALIFIED`.
