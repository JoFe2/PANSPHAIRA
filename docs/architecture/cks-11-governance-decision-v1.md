# CKS-11 governance decision v1

## Decision metadata

| Field | Value |
|---|---|
| Task | `PLAN-PSAI291-GOVERNANCE-DECISION-01` |
| Issue | `JoFe2/PANSPHAIRA#291` (`CKS-11`) |
| Parent | `JoFe2/PANSPHAIRA#280` (`CKS-M1`) |
| Decision version | `cks-11-governance-decision/v1` |
| Repository base | `353017c4f60e30463d0a78fd6fd2509a37d37f76` |
| Status | Frozen planning and integration boundary; implementation remains unauthorized |
| Authority | None granted |

This decision is subordinate to Operating Model v1.1 and decisions D-001
through D-007. It preserves them without reinterpretation and creates no new
lane, role, approval route, delivery state or process variant. Canon laws,
including Capability-is-not-Authority, exact Approval, current Evidence,
explicit evolution and fail-closed ambiguity, continue to control.

The key words **MUST**, **MUST NOT**, **REQUIRED**, **SHOULD** and **MAY** are
normative in this record.

## 1. Decision and smallest boundary

CKS-11 v1 accepts only an exact, current `S6 VALIDATED_PATTERN` produced by the
CKS-09 boundary. It may compile that input into a `WorkflowCandidate`, collect
replay, counterexample, holdout and shadow-parity Evidence, and present an exact
candidate for a separate promotion decision. An approved promotion creates an
immutable, inactive `GovernedWorkflow`. After workflow shadow parity, a closed
stable substep may be represented as an inactive `FunctionCandidate` and tested
for deterministic parity.

The v1 vocabulary is deliberately small:

- **`WorkflowCandidate`**: an immutable, non-authoritative proposal at W0-W6.
  It can be replayed or run in simulation/shadow, but it is neither promoted nor
  active.
- **`GovernedWorkflow`**: an immutable snapshot of one exact W6
  `WorkflowCandidate`, admitted by a separate digest-bound promotion Approval.
  Promotion does not activate it.
- **`FunctionCandidate`**: an immutable, non-authoritative extraction proposal
  at F0-F6. It is never a deployed Function in this boundary.

`SolutionPattern` remains the upstream CKS-09 contract; this record does not
create a second pattern type. V1 intentionally defines no `GovernedFunction`,
deployment contract, runtime scheduler or production activation route. A later
proposal must define and separately approve those surfaces before they exist.

Compilation and extraction are transformations of exact contracts, not grants
of trust, Capability or Authority. Every workflow and extracted candidate
retains its Knowledge, Verification, rollback, Capability and Authority
boundaries. A fast path is an optimization inside those boundaries, never a
new boundary.

## 2. Independent S/W/F maturity axes

Maturity is Evidence about one exact artifact version. It is not admission,
promotion, deployment, activation, Authority or a general quality label. The
S, W and F axes are independent: S6 does not imply W0, W6 does not imply
promotion, and F6 does not imply a runnable Function.

### 2.1 Solution Pattern axis (S)

| Level | Finite meaning | Minimum Evidence to enter |
|---|---|---|
| `S0 OBSERVED` | One provenance-bound trajectory or proposed recurrence exists. | Exact source trajectory and Knowledge-use receipt. |
| `S1 REPEATED` | The structure recurs in more than one valid trajectory. | Exact replay set, distinct trajectory IDs and known failures. Frequency alone is insufficient. |
| `S2 STRUCTURED_CANDIDATE` | Inputs, preconditions, decision shape, outputs and Knowledge requirements are typed. | Closed candidate contract and dependency-set digest. |
| `S3 APPLICABILITY_BOUNDED` | Included and excluded contexts, material discriminators and unresolved differences are explicit. | Applicability contract, negative matches and ambiguity probes. |
| `S4 COUNTEREXAMPLE_TESTED` | Narrow-context, correlation, frequency-only and similar-but-inapplicable traps are rejected. | Counterexample-set digest and deterministic outcomes. |
| `S5 HOLDOUT_VALIDATED` | The candidate improves the predeclared quality/cost objective on unseen applicable variants without unsafe reuse. | Holdout-set, baseline, metric and result digests. |
| `S6 VALIDATED_PATTERN` | All S0-S5 Evidence is current and independently reviewable; the pattern is eligible as a workflow-compilation input. | Validation receipt binding exact pattern, Knowledge, Applicability and Evidence versions. |

CKS-11 consumes S6 but does not promote S maturity. A success rate, cluster
size, model confidence or analytics recommendation cannot advance an S level.

### 2.2 Workflow axis (W)

| Level | Finite meaning | Minimum Evidence to enter |
|---|---|---|
| `W0 COMPILED_CANDIDATE` | A candidate step graph is deterministically compiled from one exact S6 pattern. | S6 reference, compiler version/digest, graph digest and compilation receipt. |
| `W1 CONTRACT_BOUND` | Closed inputs, outputs, preconditions, aborts, step order, Knowledge dependencies, Verification checkpoints, rollback and Capability/Authority ceilings are complete. | Schema validation and complete dependency/boundary digests. |
| `W2 REPLAY_VERIFIED` | Replays preserve the declared route, bindings and receipt decisions for exact fixtures. | Replay-set digest, environment/toolchain bindings and repeat results. |
| `W3 COUNTEREXAMPLE_SAFE` | Missing, malformed, ambiguous, stale, drifted and boundary-widening cases abort with the exact v1 statuses. | Required negative-probe set and zero unauthorized fast-path executions. |
| `W4 APPLICABLE_HOLDOUT_VERIFIED` | Unseen applicable and inapplicable cases are separated before fast-path selection. | Holdout Applicability results, known exclusions and false-match accounting. |
| `W5 SHADOW_PARITY_VERIFIED` | On applicable holdouts, shadow execution is equal or better under the predeclared quality metric and uses less measured generative-reasoning cost than the free-reasoning baseline; unsafe cases abort. | P19 baseline/candidate run-set digests, metric version, quality/cost results and abort receipts. |
| `W6 PROMOTION_ELIGIBLE` | W0-W5 Evidence, dependency freshness and fallback/rollback rehearsal are current and complete. | Eligibility receipt from a verifier distinct from the candidate producer. |

A W6 artifact remains a `WorkflowCandidate`. Only a separate promotion Approval
may create a `GovernedWorkflow`, which retains maturity W6 and starts inactive.

### 2.3 Function axis (F)

| Level | Finite meaning | Minimum Evidence to enter |
|---|---|---|
| `F0 SUBSTEP_IDENTIFIED` | One stable substep is selected from an exact W5 or W6 workflow revision. | Source workflow/step references and extraction rationale. |
| `F1 DEPENDENCY_BOUND` | The exact transitive Knowledge, Workflow, Function, Verification, rollback, Capability and Authority dependencies of the source substep are copied without omission or widening. | Source and extracted dependency-set equality/subset checks. |
| `F2 CONTRACT_CLOSED` | Input, output, logic, determinism and finite error contracts are closed and typed. | Schema/logic/error versions and digests plus unknown-field rejection. |
| `F3 DETERMINISTIC_REPLAY_VERIFIED` | Identical canonical inputs and pinned dependencies produce the same typed output or error and decision digest. | Repeated replay-set and byte/result digests. |
| `F4 COUNTEREXAMPLE_SAFE` | Missing, malformed, out-of-scope, stale and drifted cases abort; hidden state and nondeterminism probes fail closed. | Negative-probe set and abort receipts. |
| `F5 SHADOW_PARITY_VERIFIED` | The candidate matches the original workflow substep on applicable fixtures and holdouts while the original path remains authoritative. | P20 original/candidate result pairs, parity verifier and mismatch receipts. |
| `F6 PROMOTION_ELIGIBLE` | F0-F5 Evidence is current, fallback to the exact source step is rehearsed, and no boundary widened. | Eligibility receipt and exact source-step fallback readback. |

F6 remains an inactive `FunctionCandidate`. Function promotion, packaging,
deployment and activation are outside v1 and each require a later governed
contract and separate Approval.

### 2.4 Legal transitions

The only maturity advances are adjacent transitions:

```text
S0 -> S1 -> S2 -> S3 -> S4 -> S5 -> S6
W0 -> W1 -> W2 -> W3 -> W4 -> W5 -> W6
F0 -> F1 -> F2 -> F3 -> F4 -> F5 -> F6
```

Each advance MUST append a `MATURITY_TRANSITION` receipt with all Evidence
required by the destination level. Levels cannot be skipped, inferred from a
later level, or changed in place. Changed artifact bytes create a new version,
digest and predecessor reference; Evidence does not transfer unless every
bound input remains exact and the new transition records why transfer is
valid.

Assurance status is orthogonal to maturity and is the closed set
`VALIDATION_CURRENT`, `REVALIDATION_REQUIRED`, `REJECTED`, `WITHDRAWN` and
`SUPERSEDED`. Any level may move from `VALIDATION_CURRENT` to a fail-closed
status by an append-only receipt. `REJECTED`, `WITHDRAWN` and `SUPERSEDED` are
terminal for that exact revision. `REVALIDATION_REQUIRED` may return to
`VALIDATION_CURRENT` only after fresh Evidence and an exact revalidation
receipt; no historical receipt is rewritten.

## 3. Exact references and common contract fields

Every cross-record reference is an `ExactRef` with all of these fields:

| Field | Requirement |
|---|---|
| `kind` | Closed record kind. |
| `id` | Stable identity, not a name search or mutable alias. |
| `schemaVersion` | Exact schema version. |
| `version` | Exact immutable artifact/edition version; ranges and `latest` are forbidden. |
| `digestAlgorithm` | Exactly `SHA-256` in v1. |
| `digest` | Lower-case 64-hex digest of the referenced canonical bytes. |

Candidate and governed records MUST use closed schemas and contain:

- `schemaVersion`, `recordKind`, `artifactId`, `artifactVersion`, `maturity` and
  `assuranceStatus`;
- `artifactDigest` and optional exact `predecessorRef` plus a supersession
  reason;
- exact `canonicalizationRef` and digest algorithm;
- exact source, compiler/extractor and Applicability references;
- typed input, output, precondition, postcondition and finite error contracts;
- exact `knowledgeDependencies`, `workflowDependencies` and
  `functionDependencies`, including explicitly empty arrays;
- a digest of each dependency set and of the complete transitive closure;
- exact `verificationPlanRef` and `evidenceRefs`;
- exact `capabilityBoundaryRef` and `authorityRequirementRef`, plus canonical
  ceiling/requirement-set digests;
- exact `rollbackContractRef` and `lastKnownGoodRef`, or a typed
  `NOT_APPLICABLE` rollback result with Evidence that no durable effect can
  occur;
- known failures, exclusions and counterexample-set references; and
- immutable transition, invalidation, promotion and Verification receipt
  references.

Records use the exact version/digest of the repository canonical-JSON
primitive named by `canonicalizationRef`: compact UTF-8 JSON, recursively
lexicographic object keys and declared array order. Closed schemas normalize
set-like reference arrays by `(kind, id, version, digest)` before hashing;
ordered workflow steps retain declared order. Field validators reject numbers
outside their canonical boundary, including non-finite values and negative
zero, before canonicalization. `artifactDigest` is the SHA-256 of the closed
record with only `artifactDigest` omitted. Unknown fields, duplicate refs,
non-canonical values or a digest mismatch are invalid and fail closed.

### 3.1 `WorkflowCandidate`

In addition to the common fields, a `WorkflowCandidate` MUST bind:

- one exact S6 `sourcePatternRef` and its validation receipt;
- a stable step graph with step IDs, typed edges, ordering rules and graph
  digest;
- material input and context discriminators required for Applicability;
- each step's exact Knowledge reads, decision contract, possible Capability
  proposal, Verification checkpoint and abort behavior;
- terminal success criteria and authoritative Readback requirements for any
  effect reached through the separately governed execution path;
- the free-reasoning baseline, quality metric, reasoning-cost metric, holdouts,
  counterexamples and shadow plan; and
- exact original/fallback and rollback paths.

The candidate contains Authority requirements and ceilings, never an Approval,
credential or reusable authority grant.

### 3.2 `GovernedWorkflow`

A `GovernedWorkflow` MUST bind one exact W6 `sourceCandidateRef`, the exact
promotion Approval and the `PROMOTION` receipt. Its governed body—step graph,
inputs, outputs, errors, Applicability, all dependencies, Verification,
rollback, Capability ceiling and Authority requirements—MUST be byte-for-byte
or digest-for-digest identical to the approved candidate body. Promotion
metadata may be added but no operational boundary may be omitted or widened.

A `GovernedWorkflow` is immutable and inactive by itself. Runtime selection and
activation state live outside its bytes so activation cannot rewrite the
artifact or its history. Every activation, if later authorized, must bind this
exact artifact digest in a separate record and Approval.

### 3.3 `FunctionCandidate`

A `FunctionCandidate` MUST bind:

- the exact source Workflow version/digest, stable source step IDs and source
  subgraph digest;
- a closed `inputSchemaRef` and `outputSchemaRef`;
- a versioned `logicRef` binding algorithm/implementation bytes and digest;
- a finite `errorContract` in which every valid input returns exactly one typed
  output or one declared error;
- the complete transitive dependency closure copied from the source substep;
- the original-step fallback and parity verifier; and
- P20 replay, counterexample and shadow-parity Evidence.

Eligible v1 logic is either `PURE` or `PROPOSAL_ONLY`. It MUST NOT read a clock,
random source, model, network, filesystem, environment variable, credential or
mutable global state unless the value is supplied through the typed,
digest-bound input contract. `PROPOSAL_ONLY` may emit a closed Capability
request candidate; it cannot execute the Capability. Any effect remains behind
the GovernedWorkflow's existing Policy, Approval, use-time enforcement,
Readback and Receipt path. A substep that cannot meet this determinism boundary
remains a workflow step and is not extracted.

## 4. Exact dependencies and automatic invalidation

A Knowledge dependency is exact only when it binds the Knowledge record ID,
schema version, immutable edition/version, content digest, Applicability digest,
Evidence digest, freshness/validity boundary and supersession lineage. Mutable
aliases, version ranges, nearest matches and implicit current versions are
forbidden.

The selector maintains a reverse dependency index over exact digests. Any of
the following events MUST automatically mark every transitive dependent
`REVALIDATION_REQUIRED` and append an `INVALIDATION` receipt:

- a bound Knowledge edition is superseded, revoked, unavailable or expired;
- its content, version, schema, Evidence, Applicability, assumption, outcome or
  freshness binding differs;
- a Workflow or Function dependency version/digest differs or disappears;
- the compiler, extractor, verifier, metric, runtime/configuration or
  dependency-closure digest drifts; or
- a new counterexample invalidates a material precondition or claimed outcome.

Event propagation is not trusted as the only guard. Immediately before every
fast-path use, trusted code MUST resolve and compare every exact dependency and
freshness binding. Supersession or drift detected there returns
`REVALIDATION_REQUIRED` even if the reverse index is stale or unavailable.
There is no grace period and no use of a superseded artifact as current.

Revalidation creates new Evidence and receipts. It never edits the old
Knowledge, Workflow, Function or receipt bytes. Workflow and Function
dependencies and historical receipts therefore remain exact and immutable.
Rollback may select an exact prior known-good revision, but it cannot relabel
that revision as current without its own authorized selection record and
current dependency checks.

## 5. Applicability before every fast path

Applicability is evaluated before ranking, cost optimization, workflow
selection, Function selection or fast-path execution. Similarity, frequency,
success rate and model confidence are not Applicability.

The Applicability contract MUST bind its schema/version/digest, material context
dimensions, included and excluded scopes, preconditions, supported system/
provider/product/configuration versions, valid-time/freshness bounds, known
counterexamples and the canonical request-context digest. All material inputs
must be present and typed. V1 permits a workflow fast path only when exactly one
current `GovernedWorkflow` matches the exact context and a later, separate
activation has authorized its use. A `FunctionCandidate` may be selected only
for shadow comparison under that same Applicability result; its output remains
non-authoritative. No-match and multi-match outcomes cannot be ranked into a
fast path.

The closed route status set is:

- `FAST_PATH_ALLOWED`: every gate passed; the reason code MUST be `NONE`.
- `FAST_PATH_ABORTED`: no fast-path step or partial result may execute or be
  represented as success.
- `REVALIDATION_REQUIRED`: the artifact is removed from fast-path selection
  until fresh Evidence produces an exact revalidation receipt.

The required fail-closed mappings are exact:

| Condition | Route status | Reason code | Required behavior |
|---|---|---|---|
| Required input absent | `FAST_PATH_ABORTED` | `MISSING_INPUT` | Ask for context or enter the normal governed reasoning path; execute nothing. |
| Input malformed or unknown field/value | `FAST_PATH_ABORTED` | `INVALID_INPUT` | Reject the fast path; do not coerce or infer. |
| No applicable exact match | `FAST_PATH_ABORTED` | `NOT_APPLICABLE` | Use no candidate result or Evidence outside its boundary. |
| More than one compatible match, unresolved discriminator or contradictory result | `FAST_PATH_ABORTED` | `AMBIGUOUS_MATCH` | Surface the alternatives and require disambiguation. |
| Knowledge dependency absent | `REVALIDATION_REQUIRED` | `KNOWLEDGE_MISSING` | Withdraw all transitive dependent fast paths. |
| Knowledge freshness expired | `REVALIDATION_REQUIRED` | `STALE_KNOWLEDGE` | Require current Knowledge Evidence. |
| Knowledge edition superseded or revoked | `REVALIDATION_REQUIRED` | `KNOWLEDGE_SUPERSEDED` | Revalidate against an exact new edition or explicitly retain an authorized exact prior edition. |
| Any bound schema/version/configuration/dependency differs | `REVALIDATION_REQUIRED` | `VERSION_DRIFT` | Block use until the exact changed closure is reverified. |
| Any canonical digest differs | `REVALIDATION_REQUIRED` | `DIGEST_MISMATCH` | Quarantine the mismatched record and its dependents. |
| Required Evidence missing, stale, skipped or unverifiable | `REVALIDATION_REQUIRED` | `EVIDENCE_INCOMPLETE` | A success or parity claim is forbidden. |
| Verification or rollback/fallback unavailable | `REVALIDATION_REQUIRED` | `BOUNDARY_UNAVAILABLE` | Do not enter the fast path. |
| Requested Capability exceeds the approved ceiling | `FAST_PATH_ABORTED` | `CAPABILITY_WIDENING` | Deny; create a new candidate and separate approval request if needed. |
| Required/effective Authority exceeds or cannot prove the current envelope | `FAST_PATH_ABORTED` | `AUTHORITY_WIDENING` | Deny; no fallback may self-grant Authority. |
| Unknown contract, route status or reason code | `FAST_PATH_ABORTED` | `INVALID_CONTRACT` | Reject rather than defaulting to an allowed state. |

A normal reasoning fallback receives the original request and the abort receipt,
not partial fast-path output, cached Authority or a synthetic success. It remains
subject to the same Knowledge, Capability, Authority, Verification and effect
boundaries.

## 6. Capability, Authority, Verification and rollback preservation

### 6.1 Capability and Authority

The canonical Capability set used by a fast path MUST be a subset of both the
GovernedWorkflow ceiling and the currently enabled Profile/Policy set. The
compiled or extracted path may narrow that set but MUST NOT add an action,
resource, field, target, tenant, purpose, data class, network route, credential
use or effect class.

Authority is evaluated at use time as the intersection of the Owner/Profile
envelope, Actor and tenant, current Policy, exact target/action/scope, Approval,
time/use/budget limits and active stop state. A candidate stores only
requirements and ceilings. It cannot cache an Approval, convert prior success
into Authority, administer its own Evidence, or bypass the existing broker and
effect boundary. Changed workflow, function, input, target, Policy generation,
Capability set or digest requires a new exact decision; fast paths cannot widen
Capability or Authority.

### 6.2 Verification

Compilation and extraction MUST preserve every source Verification checkpoint.
They may add checks but cannot remove, weaken, defer past an effect, or replace a
semantic/authoritative check with transport success. For an effect, success
still requires current use-time enforcement, authoritative Readback and a bound
Receipt. For pure computation, success requires the declared typed output and
all deterministic invariants.

Required Evidence records bind the exact subject, claim, Applicability,
fixtures/holdouts/counterexamples, baseline and candidate run sets, code/model/
runtime/toolchain/configuration versions and digests, verifier and metric
versions, predeclared thresholds, raw-result digest, observed result, freshness
window and positive/negative outcomes. Missing, stale, mismatched, skipped or
self-asserted Evidence is uncertainty and cannot produce `PASS`, W6, F6,
promotion or activation.

P19 is satisfied only by equal-or-better predeclared quality and strictly lower
measured generative-reasoning cost on applicable holdouts, plus the required
safe-abort cases. P20 is satisfied only by deterministic typed parity for the
stable substep, negative/error parity, exact dependency preservation and a
rehearsed fallback to the original step. Neither proof is claimed by this
document; this decision freezes the Evidence they must later provide.

### 6.3 Rollback and fallback

Every workflow retains an exact fallback/rollback contract with trigger,
scope, last-known-good reference, required Capability/Authority, compensation
or restore action, reconciliation rule, expected Readback and verifier digest.
Rollback is a new, separately authorized compensating action where an effect
occurred; it is never authority inherited from promotion or activation.

A `FunctionCandidate` rollback disables candidate selection and restores the
exact source workflow step. For `PURE` or `PROPOSAL_ONLY` extraction this is a
routing fallback, not proof that a separately executed downstream effect was
reversed. If an effect may have occurred and its outcome is unknown, the route
stays blocked until authoritative reconciliation; retry and fallback cannot
create a duplicate effect.

## 7. Immutable deterministic receipts

Every decision appends a receipt; no receipt is updated or deleted. The closed
v1 receipt kinds are `MATURITY_TRANSITION`, `VERIFICATION`, `FAST_PATH_DECISION`,
`INVALIDATION`, `REVALIDATION`, `PROMOTION`, `ACTIVATION` and `ROLLBACK`.
`ACTIVATION` is defined only as a required future evidence kind; this decision
does not authorize one.

A receipt MUST contain:

- receipt schema version, kind, stable ID and exact subject `ExactRef`;
- prior and resulting maturity/assurance status where applicable;
- exact decision status and ordered finite reason codes;
- request, input-context and Applicability result digests;
- Knowledge, Workflow, Function and transitive dependency-set digests;
- Capability ceiling/used-set and Authority-requirement/effective-envelope
  digests, with no credentials or unnecessary payloads;
- exact Verification plan, Evidence and verifier refs;
- fallback/rollback ref and last-known-good ref where applicable;
- promotion or activation Approval ref where applicable;
- exact environment/configuration/toolchain refs;
- `previousReceiptDigest` (or explicit `null`) and exact recorded time; and
- `decisionDigest` plus `receiptDigest`.

`decisionDigest` is the SHA-256 of the decision payload encoded with the exact
repository canonicalization reference bound by the subject. `receiptDigest` is
the SHA-256 of the complete canonical receipt with only `receiptDigest`
omitted. Identical bound inputs produce the same decision, status, reason
ordering and `decisionDigest`. A repeated write of the same receipt digest is
idempotent; changed facts create a new append-only receipt linked to the prior
digest. Corrections and supersession are successor receipts, never history
rewrites.

Historical execution receipts continue to point to the exact Knowledge,
Workflow and Function versions used at that time. Supersession, revalidation,
rollback and promotion MUST NOT retarget or re-sign them.

## 8. Separate promotion, deployment and activation decisions

Promotion and activation are distinct and neither is implied by maturity:

1. A W6 `WorkflowCandidate` may be promoted only by an Approval bound to its
   exact artifact/body digest, dependency closure, Applicability, Evidence,
   Capability ceiling, Authority requirements and rollback. The resulting
   `GovernedWorkflow` is inactive.
2. Activating that `GovernedWorkflow` requires another, separate Approval bound
   to an exact deployment target/configuration, active Policy generation,
   current dependency readback, effective Capability/Authority intersection,
   validity/use limits and rollback. No activation is authorized in this slice.
3. An F6 `FunctionCandidate` has no promotion target in v1. A later governed
   Function contract needs its own promotion Approval. Packaging/deployment and
   runtime/production activation each remain separately approved transitions.
4. An Approval for one transition MUST NOT be reused for another. Absence,
   expiry, revocation, mismatch or ambiguity denies the transition.

The following proposals are explicitly rejected:

- promotion from success rate, frequency, similarity, cluster size, confidence,
  cost reduction or shadow parity alone;
- any Capability or Authority widening by compilation, optimization, fallback,
  promotion, Function extraction or activation;
- autonomous Knowledge, Workflow or Function promotion;
- autonomous code generation followed by packaging or deployment;
- autonomous deployment, mutable in-place replacement or silent rollback;
- production activation, release or external completion inference without its
  own separately authorized and verified decision.

## 9. Dependency and integration boundary

- Positive, current CKS-09 (`#289`) S6 pattern Evidence is a hard prerequisite.
- CKS-10 (`#290`) analytics is optional. A manually supplied validated S6
  candidate may enter the same gate; analytics output remains an
  authority-free candidate and cannot promote anything.
- CKS-11 may reuse CKS-253 adaptive/shadow Evidence-gate patterns, but does not
  inherit delivery, activation or Authority from them.
- CKS-12 may consume only exact CKS-11 artifacts and receipts after its own
  authorization. This decision does not close CKS-12 or the parent epic.

## 10. Deterministic decision/integration receipt

| Receipt field | Bound value |
|---|---|
| Decision | Freeze the smallest CKS-11 governed-workflow/function-extraction boundary described above. |
| Accepted vocabulary | `WorkflowCandidate`, `GovernedWorkflow`, `FunctionCandidate` |
| Accepted axes | Independent finite S0-S6, W0-W6 and F0-F6 Evidence maturities |
| Required prerequisite | Exact current CKS-09 S6 pattern; CKS-10 analytics optional |
| Fast-path ordering | Closed input/dependency checks, then Applicability, unique match and current Evidence before execution |
| Drift result | Automatic `REVALIDATION_REQUIRED`, both event-driven and at use time |
| Boundary preservation | Knowledge, Verification, rollback, Capability and Authority retained exactly; narrowing only |
| History | Content-addressed immutable artifacts and append-only exact receipts |
| Promotion/activation | Distinct digest-bound Approvals; no activation authorized |
| Evidence claim | Documentation decision only; P19/P20 execution Evidence is not claimed |
| Repository verification | `git diff --check origin/main...HEAD` (result bound in `verification/cks-11-governance-decision-v1.json`) |

This receipt makes the planning boundary deterministic and reviewable. It does
not implement a compiler, selector, Function runtime, deployment path or
production control, and it does not claim tests or success for Evidence that
has not been produced.
