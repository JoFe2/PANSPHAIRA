# CKS-10 delivery readback and no-release checklist

Task: `INT-PSAI290-DELIVERY-READBACK-02`

## Local readback command

Run from the repository root:

```text
node scripts/verify-cks-10-delivery-readback.mjs
node scripts/verify-cks-10-delivery-readback.mjs --self-test
```

The harness reads the byte-pinned manifest at
`tests/fixtures/cks-10/delivery-readback-manifest-v1.json`. It is offline and
read-only. Its deterministic JSON receipt records every materialized decision,
contract, fixture, validator, prerequisite receipt, integration dry-run
receipt, rollback readback proof, and criterion mapping by artifact ID, class,
and SHA-256 digest.

A normal receipt outcome of `VERIFIED_LOCAL_READBACK_ONLY` means only that the
committed local evidence set passed this gate. It is not a delivery, external
state, PR, CI, merge, release, or issue-close claim.

## Required local evidence

- AC-1: the minimized projection contract, fixture, validator, publisher, and
  receipts bind stable IDs, versions, digests, and classes while excluding
  secrets, raw prompts, credentials, unnecessary payloads, and mutable policy
  state.
- AC-2: the projection-contract, envelope-guard, and local-integration evidence
  requires tenant/scope, retention, freshness, provenance, and replay to deny
  closed on missing or mismatched input.
- AC-3: the P21 planted projection, expected candidates, negative fixture,
  validator, and receipt reproduce GAP, CLUSTER, CO_USAGE, NEGATIVE_EVIDENCE,
  and PATTERN candidates with explicit blind spots and zero invented edges.
- AC-4: the candidate-return contract evidence fixes `authorityClass` to
  `NONE`; candidates cannot promote Knowledge, Workflow, or Function.
- AC-5: the canonical-evidence fixture, rollback harness, and rollback receipt
  prove removal is confined to generated projection artifacts and canonical
  PanSphAIra evidence remains unchanged.

## Fail-closed conditions

The harness denies when any required leaf is absent, has an unexpected digest,
is a skeleton-only file, has unresolved dependencies, introduces a dependency
cycle, has an unresolved criterion mapping, or contains a premature external
wait or claim.

The self-test exercises all of these local denial classes. The manifest is also
pinned by exact UTF-8 byte SHA-256 in the harness, so a manifest modification is
not accepted without an explicit reviewed harness update.

## Pending release checklist

This planned issue does not authorize any implementation, PR, CI, merge,
release, or issue-close action. Record all items as false before considering a
separately authorized action:

| Authorization or action | Required state |
| --- | --- |
| Implementation | `false` |
| Pull request | `false` |
| CI | `false` |
| Merge | `false` |
| Release | `false` |
| Issue close | `false` |
| External wait | `NONE` |
| External claim | `NONE` |

Decision: **RELEASE_REQUIRED_PENDING_DELIVERY**. This records the required later
governed release while making no claim that PR delivery, merge, or release exists.

The local verification receipt is
`verification/cks-10-delivery-readback-v1.json`. It preserves Operating Model
v1.1 and decisions D-001 through D-007; no process variant is introduced.

## Repository gate

Before any separately authorized next step, run:

```text
git diff --check origin/main...HEAD
```

A passing local readback or diff check does not substitute for the controller's
authoritative pinned-Node or host-Docker gates, and it grants no external
authority.
