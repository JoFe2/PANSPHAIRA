# CKS-07 public-readback preparation

This slice prepares a deterministic, public-safe readback decision receipt before public-state evidence is collected. It is a dry run only: it does not call GitHub, inspect a public release, download an asset, use a credential, or claim that any public state exists.

## Run

From the repository root:

```text
NODE_OPTIONS=--jitless node --test tests/cks-07-public-readback.test.mjs
NODE_OPTIONS=--jitless node scripts/cks-07-validate-public-readback.mjs --template verification/cks-07-public-readback-template-v1.json --dry-run
git diff --check origin/main...HEAD
```

The template at `verification/cks-07-public-readback-template-v1.json` is the bounded expected receipt. The validator accepts only that closed template shape, runs the local release-governance preflight, and verifies that the future anonymous readback target remains bound to `scripts/verify-release-governance.mjs --public-readback`.

## Decision boundary

The successful dry-run decision is `PREPARED_DRY_RUN_ONLY`, not public-readback success. Its public-readback status remains `NOT_EXECUTED` with reason `PUBLIC_STATE_EVIDENCE_NOT_COLLECTED`.

The planned public step may be activated only after publication with public-state evidence. It must use the existing anonymous entrypoint with `GH_TOKEN` unset. Missing local-preflight evidence, a missing entrypoint binding, a changed closed template, a credential-bearing environment, or a fabricated public-readback `PASS` receipt is denied before a success receipt can be rendered.

## Non-claims

This receipt does not claim a public state exists, that anonymous public readback passed, CI, merge, release, deployment, or production activation. The dry run is local and read-only; it changes no remotes, providers, services, credentials, DSH state, or spill configuration.
