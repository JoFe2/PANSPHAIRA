# CKS-08 offline lineage proof

Status: technically complete as a local synthetic, deterministic proof artifact;
authoritative runtime execution is deferred to the controller's pinned-Node gate.
No live system, telemetry, provider, service, production data, raw receipt or
raw content is involved.

## Plan

Run the bounded CKS-08 replay against the frozen lineage and seeded-attribution
contracts, compare every positive result with its fixture ground truth, exercise
fail-closed negatives, and render only a privacy-safe evidence draft. Preserve
Operating Model v1.1 and D-001 through D-007 without introducing a process
variant.

The proof is deliberately synthetic and local. Its claim boundary is:
`OFFLINE_DETERMINISTIC_CKS_08_PROOF_ONLY_NO_TELEMETRY_NO_RAW_CONTENT_NO_LIVE_SYSTEM_NO_PRODUCTION`.

## Do

- Added `scripts/run-cks-08-lineage-dry-run.mjs` as the end-to-end replay and
  evidence-draft renderer.
- Added the positive and rejection manifests under
  `tests/fixtures/cks-08/`.
- Replayed the existing bounded positive lineage tasks and the five direct
  rejection cases: missing, late, replayed, cross-scope and tampered.
- Replayed the synthetic scorer for P14, P15 and P16, including four explicit
  attribution denials for missing witness, contribution-only Knowledge
  causality, uncertainty mislabelled as a single cause, and a fourth cause.
- Rendered `verification/cks-08-lineage-dry-run-evidence-v1.json` with bounded
  counts, statuses, reason codes, fixture labels and non-sensitive SHA-256
  digests only. Raw events and content are not emitted.

## Acceptance coverage

- P14: two direct tasks and two synthetic scorer tasks expose searched,
  inspected, used, rejected, decisionSupporting and outcomeContributing sets.
- P15: eight identical occurrences collapse to one joint usage unit and do not
  receive `+G`; four diverse occurrences retain two task semantics, two
  contexts and four joint units and receive `+G`.
- P16: 17 seeded cases cover Knowledge, Search, Decision, Execution, Task Input,
  External, Governance and Unknown classes, with SINGLE,
  MULTI_CONTRIBUTING, ALTERNATIVES_UNRESOLVED and UNKNOWN modes plus
  CONFIRMED, SUPPORTED, POSSIBLE and UNKNOWN certainty.
- Fail-closed lineage cases deny without partial usage sets and preserve their
  frozen reason codes.
- Source, applicability, freshness, contradiction, generalization and
  operational dimensions remain separate and digest-bound.

## Check

The privacy-safe draft is internally closed: the recorded source fixture
SHA-256 values match the current fixture bytes, and its report digest matches
the exact JSON serialization. Those checks were performed locally with
`python3` because the available Node runtime failed during isolate startup.

Required command observations in this worker environment:

- `node --test tests/cks-08-lineage-dry-run.test.mjs`: blocked before test
  execution with exit 133 / SIGTRAP (`v8::base::OS::SetPermissions` errno
  assertion).
- `node scripts/run-cks-08-lineage-dry-run.mjs --fixture tests/fixtures/cks-08/e2e-positive-evidence-v1.json --dry-run`:
  blocked before harness execution with the same exit 133 / SIGTRAP.
- `npm run build --silent`: blocked before TypeScript execution with the same
  exit 133 / SIGTRAP.
- `git diff --check origin/main...HEAD`: passed with exit 0.

The Node failure is recorded as infrastructure evidence, not as a product
failure or acceptance verdict. The controller must rerun the focused test,
dry-run and authoritative pinned-Node/host-Docker gates. This worker does not
claim those runtime commands passed.

## Act

Commit the clean allowlisted proof artifact locally. Keep the evidence in
`DRAFT_PRE_COMMIT` state and retain the explicit non-claims: no live system,
telemetry collection, model/provider claim, production validation, publication,
or security certification. Do not push, merge, release, mutate credentials,
remotes, services or CI authority.
