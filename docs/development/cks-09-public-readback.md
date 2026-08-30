# CKS-09 public-readback validator preparation

## Bounded decision and integration receipt

- Task: `INT-PSAI289-PUBLIC-READBACK-HARNESS-01`
- Decision: prepare a deterministic, privacy-safe validator before any CKS-09 public state is treated as available.
- Process: Operating Model `v1.1`; decisions `D-001` through `D-007` are preserved exactly; no process variant is introduced.
- Scope: local dry-run preparation only. The validator makes no network request and does not mutate external state.

`scripts/cks-09-validate-public-readback.mjs` consumes only an explicitly supplied,
privacy-safe evidence projection. It has no HTTP client, accepts no authorization
material, and retains no raw public payload. The default input is
`verification/cks-09-public-readback-template-v1.json`, whose `captureState` is
`NOT_CAPTURED`.

A dry run is therefore successful only as validator preparation:

- `validatorVerdict: PASS`
- `publicReadbackVerdict: INCONCLUSIVE`
- `successClaimed: false`
- reason: `PUBLIC_STATE_NOT_CAPTURED`

This separation is deliberate: repository state, CI, a merge, a tag, or the
prepared template cannot establish public state. A later PASS requires one
complete `ANONYMOUS_PUBLIC_READBACK_EVIDENCE` record with all of the following:

1. an anonymous capture with no authorization header or credential material;
2. no retained raw payload or procedure content;
3. an expected public-record ID and SHA-256 digest;
4. a successful observed status, matching ID/digest, and response SHA-256 digest;
5. no external state change by the capture evidence.

Unknown fields, incomplete evidence, privacy-boundary violations, unreadable
input, and expected/observed mismatches are denied. A denial has
`successClaimed: false`. The emitted receipt is canonical-digest bound and
contains only bounded identifiers, SHA-256 digests, and status code—not raw
payloads, credentials, private paths, session identifiers, or procedure content.

## Focused commands

```sh
node --test tests/cks-09-public-readback.test.mjs
node scripts/cks-09-validate-public-readback.mjs --dry-run
git diff --check origin/main...HEAD
```

## Non-claims

- No CKS-09 public state, anonymous readback, publication, release, merge, or
  deployment is claimed by this preparation.
- The validator grants no implementation, routing, workflow, function,
  telemetry, Knowledge-acceptance, or pattern-promotion authority.
- A later public-readback PASS validates only the supplied bounded evidence
  projection; it does not widen the admitted CKS-09 synthetic/shadow boundary.
