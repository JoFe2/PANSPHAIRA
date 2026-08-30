# CKS-08 public-readback validator

Status: prepared and dry-run locally before any task-scoped public state exists.
This is a bounded, deterministic prepublication receipt only. It does not
publish, query public services, change GitHub state, read credentials, collect
telemetry, emit raw public content, or claim public-readback success.

## Boundary

`scripts/cks-08-validate-public-readback.mjs` accepts exactly the frozen
prepublication template and `--dry-run`. The template preserves Operating Model
v1.1 and D-001 through D-007 without a process variant. It requires five future
anonymous evidence classes: release metadata, latest release, tag reference,
public asset set and digests, and public main surfaces.

The dry-run has zero network calls and writes no external state. Its output is a
privacy-safe receipt containing only bounded statuses, evidence identifiers,
non-sensitive digests, and reason codes. Every required evidence item remains
`PENDING_PUBLIC_STATE`; therefore `readbackExecuted`,
`readbackSuccessClaimed`, `requiredEvidencePresent`, and
`publicReadbackAuthorized` are all false.

## Dry run

Run only with credentials unset:

```sh
env -u GH_TOKEN node scripts/cks-08-validate-public-readback.mjs --template verification/cks-08-public-readback-template-v1.json --dry-run
```

The output is deterministic and has a canonical SHA-256 receipt digest. The
validator rejects an altered template, a changed process boundary, raw-content
emission, a missing required evidence class, or any attempt to treat a
prepublication state as public-readback success.

## Local verification record

The focused test and dry-run were attempted with `GH_TOKEN` explicitly unset:

- `env -u GH_TOKEN node --test tests/cks-08-public-readback.test.mjs` was
  blocked before test-program entry by the local Node/V8
  `OS::SetPermissions` errno assertion (exit 133 / `SIGTRAP`).
- `env -u GH_TOKEN node scripts/cks-08-validate-public-readback.mjs --template verification/cks-08-public-readback-template-v1.json --dry-run`
  was blocked before script entry by the same infrastructure failure (exit 133
  / `SIGTRAP`).
- `git diff --check origin/main...HEAD` passed locally.

The Node failures are infrastructure evidence rather than a product verdict.
No test or dry-run success is claimed from these blocked commands; the
controller must rerun them with the authoritative pinned Node runtime.

## Required future evidence

After a separately authorized publication, an anonymous public readback must
obtain and compare all five required evidence classes. Until then, and whenever
an item is missing, pending, unknown, or mismatched, the outcome remains
fail-closed. This preparation neither authorizes publication nor substitutes for
that future evidence.
