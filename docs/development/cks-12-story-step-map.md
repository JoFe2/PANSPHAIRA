# CKS-12 Part-II story-step map

Status: `RECONCILED_REPLAY_VERIFIED / RELEASE_REQUIRED_PENDING_DELIVERY`

This map records the immutable v2 catalog for the Part-II integration story. The
reconciled replay was independently audited from current-main base
`46a65171c2bfb8e252e6455080eacc818afa1061`; the older commit embedded in the
immutable component lock remains historical fixture identity and was not silently
rewritten. It preserves Operating Model v1.1 and decisions D-001 through D-007; it does not
create a process variant, execute a model/runtime, activate a Workflow or
Function, or claim `PASS_SYNTHETIC_ONLY`.

## Versioned artifacts

- Manifest implementation: `src/cks-12/story-step-manifest.ts`
- Canonical fixture bytes:
  `tests/fixtures/cks-12/part-ii-23-step-fixture-v1.json`
- Version receipt:
  `verification/cks-12/story-step-version-receipt-v1.json`
- Fixture ID/version: `CKS-12-PART-II-STORY-STEPS-FIXTURE-V2` / `v2`
- Fixture SHA-256:
  `aa75328c23692f014ff49d0f20664eb7910ccd05d1e52cb227aef527f84a40f3`
- Story-step vocabulary SHA-256:
  `d178bb61b1e773e8ecc2641a439392a5b882d4b40d494feb66042a770906b869`
- Receipt ID: `CKS-12-STORY-STEP-VERSION-RECEIPT-V2`
- Receipt status: `RECORDED` for catalog binding only
- Integrated proof state: `EVIDENCE_INCOMPLETE`

The fixture is canonical compact JSON. Its semantic arrays preserve the exact
order below. Any byte change requires a new fixture version and digest; the
already-committed v1 bytes are not silently re-identified. Receipt digests use SHA-256 over
canonical JSON after omitting only the top-level `receiptSha256` field.

## Ordered catalog

| Ordinal | Stable ID | Event | Owner |
|---:|---|---|---|
| 01 | `CKS-12-P2-SS-01` | `EMPTY_KNOWLEDGE_BASELINE` | #287 |
| 02 | `CKS-12-P2-SS-02` | `KNOWLEDGE_NEED_DECLARED` | #287 |
| 03 | `CKS-12-P2-SS-03` | `FORWARD_REQUIREMENTS_ENUMERATED` | #287 |
| 04 | `CKS-12-P2-SS-04` | `ALTERNATE_RETRIEVAL_EXHAUSTED` | #287 |
| 05 | `CKS-12-P2-SS-05` | `KNOWLEDGE_GAP_CONFIRMED` | #287 |
| 06 | `CKS-12-P2-SS-06` | `OFFLINE_ACQUISITION_PLANNED` | #287 |
| 07 | `CKS-12-P2-SS-07` | `SOURCE_EVIDENCE_ACQUIRED` | #287 |
| 08 | `CKS-12-P2-SS-08` | `KNOWLEDGE_CANDIDATE_CREATED` | #287 |
| 09 | `CKS-12-P2-SS-09` | `CANDIDATE_VALIDATED` | #287 |
| 10 | `CKS-12-P2-SS-10` | `GOVERNED_SYNTHETIC_PROMOTION` | #287 |
| 11 | `CKS-12-P2-SS-11` | `KNOWLEDGE_SUFFICIENCY_PROVED` | #287 |
| 12 | `CKS-12-P2-SS-12` | `GROUNDED_SOLUTION_RECORDED` | #288 |
| 13 | `CKS-12-P2-SS-13` | `USAGE_OUTCOME_LINEAGE_RECORDED` | #288 |
| 14 | `CKS-12-P2-SS-14` | `OPERATIONAL_REPETITION_RECORDED` | #288 |
| 15 | `CKS-12-P2-SS-15` | `CROSS_CONTEXT_GENERALIZATION_RECORDED` | #288 |
| 16 | `CKS-12-P2-SS-16` | `FAILURE_ATTRIBUTED` | #288 |
| 17 | `CKS-12-P2-SS-17` | `APPLICABILITY_NARROWED` | #288 |
| 18 | `CKS-12-P2-SS-18` | `REVERSE_EXPERIENCE_PATTERN_VALIDATED` | #289 |
| 19 | `CKS-12-P2-SS-19` | `KALEIDOSPHERE_READ_ONLY_CANDIDATE` | #290 |
| 20 | `CKS-12-P2-SS-20` | `SHADOW_WORKFLOW_PARITY_MEASURED` | #291 |
| 21 | `CKS-12-P2-SS-21` | `DETERMINISTIC_FUNCTION_COST_PARITY_MEASURED` | #291 |
| 22 | `CKS-12-P2-SS-22` | `KNOWLEDGE_DRIFT_REVALIDATED` | #292 |
| 23 | `CKS-12-P2-SS-23` | `UNKNOWN_VARIANT_FAST_PATH_ABORTED` | #292 |

The required result text for every row is bound in the fixture and is copied
from the frozen CKS-12 boundary. The final falsification report, when a later
worker supplies execution evidence, is closure over these 23 steps and is not
a twenty-fourth step.

## Version-lock boundary

The catalog carries the exact schema
`chimpmaera.cks/component-version-lock/v1` and the complete closed field list
from the frozen boundary. Empty values, ranges, `latest`, inferred defaults,
unresolved aliases, or mixed locks are not acceptable. The fixture and receipt
bind the repository `JoFe2/PANSPHAIRA`, frozen boundary contract `v1`, base
commit `353017c4f60e30463d0a78fd6fd2509a37d37f76`, and SHA-256 lower-case digest
encoding without a prefix.

The receipt deliberately records `authority=NONE`, `capabilityDelta=NONE`,
`effect=NONE`, `successClaimed=false`, and the frozen non-claims. In particular,
it does not claim that the dependency proofs, synthetic loop, model/runtime,
KaleidoSphere adapter, Workflow/Function activation, or production readiness
have been proven.

Every row also has a distinct v2 fixture subject and v2 receipt subject,
including exact fixture and receipt SHA-256 values and the exact component-lock
digest. The independent checker is
`node scripts/run-cks-12-story-step-check.mjs --dry-run`. It verifies the
23-step order, catalog digest, concrete component lock, all immutable bindings,
and receipt self-digest before emitting a bound `RECORDED` result. It fails
closed for missing or unsupported versions, stale bindings, reordered/
duplicated/missing steps, and execution or production claims. The emitted
result retains `executionClaimed=false` and `productionClaimed=false`.

## Checks

Focused catalog coverage is in
`tests/cks-12/story-step-manifest.test.ts`. The repository profile’s
story-step checker is expected to verify the same fixture/receipt bindings and
must be run by the controller if that checker is supplied in the execution
environment.
