# CKS-04 baseline evidence receipt

Task: `PSAI284-L5-EVIDENCE-REPLAY-READBACK-HARNESS`

This note describes the checked-in evidence boundary for the CKS-04 no-fine-tune baseline. It preserves the existing Operating Model and decision bindings; it does not create a new process variant.

## Receipt contents

The artifact at `verification/cks-04-no-finetune-baseline-evidence-v1.json` contains:

- exact execution bindings and their IDs, versions, and SHA-256 digests;
- the source scenario and case fixture references plus the scenario fixture digest;
- deterministic replay results and per-case receipt digests;
- explicit P2/P3 counts, failure summary, and abstention summary;
- explicit precondition policy and verifier separation;
- a nonclaims review and a local-only publication boundary.

The artifact is deliberately `NOT_QUALIFIED`. A verified receipt means that the deterministic checks accepted the recorded outcome for scoring; it does not mean the model has been qualified.

## Fail-closed verifier

`scripts/verify-cks-04-baseline-evidence.mjs` rejects unless the evidence:

1. uses the expected evidence schema and local source paths;
2. matches the manifest template's exact model, quantization, runtime, prompt, tool, Knowledge, and verifier bindings;
3. uses the local no-fine-tune, deny-network, no-authority posture;
4. identifies the deterministic verifier independently from the semantic verifier;
5. replays the source scenario fixture through the existing deterministic CKS-04 verifier and matches every recorded result and digest;
6. preserves typed bounded retrieval, information-need detection, claim/procedure coverage, and fail-closed outcomes;
7. reconciles all case, P2/P3, receipt, failure, and abstention totals; and
8. retains explicit precondition and nonclaims/publication review fields.

The template gate is explicit: local template evidence is accepted only with `--allow-template`. Missing that flag is a denial, not an implicit default. Any binding drift, replay mismatch, missing receipt, count mismatch, or attempted external-publication status is denied.

## Public readback

`scripts/render-cks-04-public-readback.mjs` is a local renderer only. With `--dry-run`, it verifies the artifact and prints a stable terminal readback containing:

- qualification and publication status;
- exact bindings;
- total, P2, and P3 counts;
- failures and abstentions with reason codes;
- deterministic/semantic verifier separation; and
- the nonclaims review.

It writes no publication or release record. The evidence remains local until a separately authorized process reviews it.

## Expected baseline

The six scenarios are:

| Phase | Cases | Expected behavior |
| --- | ---: | --- |
| P2 | 1 | Unknown synthetic fact and procedure are retrieved and applied with complete evidence coverage; `PASS`. |
| P3 | 5 | Applicability mismatch, exclusion, parametric conflict, missing Knowledge, and conflicting Knowledge; all `ABSTAIN`. |

Expected aggregate: six verified receipts, one verified pass, five fail-closed abstentions, and zero failures. Missing or conflicting Knowledge is never promoted from model output to a supported answer.
