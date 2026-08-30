# CKS-11 Governed Asset Contracts v1

This document describes the runtime contract implemented by
`src/cks/governed-assets-v1.ts`. It is an implementation companion to the
frozen CKS-11 governance decision and does not create a new process variant.

## Records

The v1 slice contains three non-executable, immutable record types:

- `WorkflowCandidate`: a compiled proposal sourced from an exact
  `SOLUTION_PATTERN` and transformed by an exact `COMPILER`.
- `GovernedWorkflow`: the authoritative W6 snapshot of one candidate body.
  `sourceCandidateBodyDigest` must equal `bodyDigest`; promotion requires one
  exact `APPROVAL` and one matching promotion receipt. The copied body must
  retain the W6 Evidence gates (Evidence, counterexamples and holdouts).
- `FunctionCandidate`: an extracted proposal sourced from a
  `GOVERNED_WORKFLOW` or `WorkflowCandidate`, transformed by an `EXTRACTOR`.
  It is never a deployed or activated function in this version.

Every record has a closed key set, schema and canonicalization binding, exact
SHA-256 artifact digest, applicability contract/result, assurance state,
verification receipts, invalidation history, and explicit predecessor and
supersession fields.

## Maturity and evidence

S, W, and F are independent axes. Each axis has levels 0 through 6 with
closed names. A transition is adjacent-only and requires exactly one
`MATURITY_TRANSITION` reference per prior level. W and F apply evidence gates
as they advance; W6 and F6 require eligibility evidence. Function F6 also
requires a fallback readback. No candidate is promoted by this module.

## Exact dependencies and historical receipts

Knowledge dependencies preserve record ID, schema, edition, content digest,
applicability digest, evidence digest, validity window, and supersession
lineage. Workflow and Function dependency arrays are closed, duplicate-free,
set-digested references. The complete transitive closure is copied and bound
by digest. Reference versions are exact: ranges, wildcards, and `latest` are
rejected.

Validated results are detached deep-frozen copies. Receipts are digest-bound
and append-only: an identical receipt is idempotent, while a correction must
be a successor carrying `previousReceiptDigest`; no historical receipt is
rewritten in place. `ACTIVATION` remains future-evidence-only and is rejected
by this v1 validator because this slice grants no activation authority.

## Applicability, Verification, rollback, Capability, Authority

Workflow and Function bodies explicitly carry:

- applicability and material-context bindings;
- input/output, pre/postcondition, terminal readback, Verification plan,
  evidence, holdout, and counterexample references;
- original/fallback paths, rollback contract, and last-known-good reference;
- capability boundary and immutable capability ceiling digest; and
- Authority requirement and immutable authority digest.

A fast path is only a route decision. It requires exact governed-workflow
references, current applicability/knowledge/version/digest/evidence state,
complete input, exact boundaries, and no stop state. Requested capabilities
must be contained by both the policy-enabled set and the approved ceiling.
Authority grants must cover every requirement, including actor, tenant,
action, target, scope, validity window, and budget. Any mismatch returns an
abort decision before execution; no fast path can widen Capability or
Authority.

## Fail-closed behavior

Unknown record keys, reference kinds, versions, maturity values, dependency
drift, digest mismatch, missing evidence, invalid rollback bindings, and
boundary widening return deterministic `REJECTED` results with ordered reason
codes and a non-zero exit code. The module has no authority to execute,
deploy, activate, or release an asset.
