# CKS-11 Function Extraction Eligibility v1

This document records the implementation boundary for
`src/cks/function-extraction-v1.ts`. It preserves the frozen CKS-11 process and
adds no Capability, Authority, promotion, deployment, or activation authority.

## Eligibility contract

`validateFunctionCandidateEligibilityV1` accepts one closed envelope containing:

- an exact `WorkflowCandidate` or `GovernedWorkflow` source snapshot at W5 or
  W6, with an exact workflow digest;
- one `STABLE` substep, with non-empty stability Evidence, exact step IDs and
  subgraph/closure digests;
- closed typed input and output schemas (`additionalProperties: false`);
- a versioned `PURE` or `PROPOSAL_ONLY` implementation whose deterministic
  marker is true and whose forbidden-input list is empty;
- an exhaustive finite typed error contract;
- exact Evidence, Knowledge, Workflow, Function and transitive dependency links;
- immutable historical receipt links;
- source Verification checkpoints, verifier, readback and receipt bindings;
- an exact source-step fallback, last-known-good rollback, fallback readback and
  rollback receipt; and
- a P20 parity record proving identical typed output/error results, zero
  mismatches and a non-empty deterministic replay digest.

All envelope keys are closed. References are exact SHA-256 bindings; aliases,
ranges, `latest`, duplicates and drift are rejected. The validator returns a
detached deeply frozen result. It never executes logic or changes a source
workflow, dependency, or historical receipt.

## Maturity and evidence

The existing governed-asset contracts retain the independent S/W/F axes:
`WorkflowCandidate` and `GovernedWorkflow` use W0-W6, while the extraction
candidate uses F0-F6. Eligibility requires F6, including the candidate's exact
eligibility receipt and fallback readback. The source must be W5 or W6 and
current. Missing stability, typed-contract, replay, counterexample, parity,
Verification, rollback, or receipt evidence returns `REJECTED` with a non-zero
exit code. No partial result is returned as a success claim.

## Boundary preservation

Capability sets are checked by exact structural containment: extracted
capabilities must be a subset of the source set. Authority requirements must
match the source exactly, including actor, tenant, action, target, and scope.
A `PROPOSAL_ONLY` candidate remains a request description; it cannot execute a
Capability or self-grant Authority. The existing policy, Approval, use-time
enforcement, authoritative Readback, and Receipt path remain authoritative.

P20 parity is shadow evidence only. It does not promote, activate, deploy, or
replace the original workflow step. Rollback selects the exact original-step
fallback and known-good binding; it does not rewrite the historical candidate or
receipt chain.

## Closed failure reasons

The validator emits deterministic ordered reasons including
`STABLE_SUBSTEP_REQUIRED`, `TYPED_INPUT_CONTRACT_INVALID`,
`LOGIC_CONTRACT_INVALID`, `ERROR_CONTRACT_INVALID`, `EVIDENCE_LINK_MISMATCH`,
`DEPENDENCY_LINK_MISMATCH`, `HISTORICAL_RECEIPT_MISMATCH`,
`VERIFICATION_BOUNDARY_INVALID`, `ROLLBACK_BOUNDARY_INVALID`,
`CAPABILITY_WIDENING`, `AUTHORITY_WIDENING`, and
`PARITY_EVIDENCE_INCOMPLETE`. Unknown fields and malformed envelopes emit
`INVALID_INPUT`. There is no default-to-eligible path.
