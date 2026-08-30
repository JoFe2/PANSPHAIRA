# CKS-12 closed-loop boundary v1

Status: `BOUNDARY_FROZEN / SYNTHETIC_PROOF_NOT_RUN`

- Task: `PLAN-PSAI292-CLOSED-LOOP-BOUNDARY-01`
- Issue: `CKS-12` / [#292](https://github.com/JoFe2/PANSPHAIRA/issues/292)
- Parent: [#280](https://github.com/JoFe2/PANSPHAIRA/issues/280)
- Repository base: `353017c4f60e30463d0a78fd6fd2509a37d37f76`
- Machine-readable companion:
  `verification/cks-12-closed-loop-boundary-v1.json`

This receipt freezes a design and evidence boundary. It does **not** record a
CKS-12 execution, positive dependency readback, model run, KaleidoSphere run,
workflow activation, Function deployment, or production proof. The current
proof state is `EVIDENCE_INCOMPLETE`; `PASS_SYNTHETIC_ONLY` is prohibited until
every receipt and metric required below exists and verifies.

## 1. Controlling process and preserved decisions

Operating Model v1.1 and controller decisions `D-001` through `D-007` remain
controlling. This receipt does not add a process lane, bypass, approval class,
or alternate promotion path. It freezes their CKS-12 integration consequences:

| Decision | Frozen consequence |
| --- | --- |
| `D-001` | The Part-II integration story has exactly the 23 ordered stable IDs in section 2. Missing, duplicate, reordered, or unknown steps deny completion. |
| `D-002` | Fixtures are immutable raw bytes; receipts are immutable canonical JSON; every material component is exact-version and SHA-256 locked. |
| `D-003` | Acquisition produces untrusted source evidence, never accepted Knowledge. Validation and governed synthetic-only promotion are separate receipts and transitions. |
| `D-004` | Operational repetition (`+O`) and cross-context generalization (`+G`) are independent evidence dimensions. Attributed negative evidence may only propose a narrower Applicability version. |
| `D-005` | KaleidoSphere receives only a minimized read-only projection and returns only an authority-free `CANDIDATE`; PanSphaira retains validation, promotion, invalidation, Capability, and Authority. |
| `D-006` | Workflow and Function evidence remains shadow-only. Parity, cost, drift revalidation, and fast-path denial are measured without activation or proof weakening. |
| `D-007` | The falsification gates and stop conditions in sections 8 and 9 are mandatory. No missing, invalid, stale, or unrun evidence can be reported as success. |

The Part-II ordering inherited from #280 is unchanged: CKS-07 Need/Gap and
Sufficiency precede CKS-08 lineage; lineage precedes CKS-09 pattern evidence;
CKS-10 analytics consumes only valid minimized lineage; CKS-11 Workflow follows
validated Pattern evidence and Function follows shadow parity; CKS-12 closes
only this synthetic loop.

## 2. Exact ordered Part-II story-step vocabulary

The following array order is semantic and immutable. A compatible v1 run has
exactly one or more chained receipts for each step and no other story-step ID.
The IDs, spelling, case, ordinal, and order are part of the contract.

| Ordinal | Stable story-step ID | Required immutable result |
| ---: | --- | --- |
| 01 | `CKS-12-P2-SS-01` | `EMPTY_KNOWLEDGE_BASELINE`: an exact empty/minimal Knowledge edition and ground-truth requirement fixture are locked before solving. |
| 02 | `CKS-12-P2-SS-02` | `KNOWLEDGE_NEED_DECLARED`: a typed Need identifies the decision, required Knowledge classes, scope, and unresolved material claims. |
| 03 | `CKS-12-P2-SS-03` | `FORWARD_REQUIREMENTS_ENUMERATED`: the forward analyzer records all predicted requirements independently of solver output. |
| 04 | `CKS-12-P2-SS-04` | `ALTERNATE_RETRIEVAL_EXHAUSTED`: primary and frozen alternate retrieval profiles are attempted and separately receipted before absence is inferred. |
| 05 | `CKS-12-P2-SS-05` | `KNOWLEDGE_GAP_CONFIRMED`: the gap finder records a finite gap class and distinguishes retrieval failure from missing Knowledge or unknown semantics. |
| 06 | `CKS-12-P2-SS-06` | `OFFLINE_ACQUISITION_PLANNED`: a bounded plan selects only a prepackaged public-synthetic source fixture; no external fetch is permitted. |
| 07 | `CKS-12-P2-SS-07` | `SOURCE_EVIDENCE_ACQUIRED`: acquisition emits immutable `ACQUIRED_UNTRUSTED` source evidence and grants no validation, promotion, Capability, or Authority. |
| 08 | `CKS-12-P2-SS-08` | `KNOWLEDGE_CANDIDATE_CREATED`: qualification creates a new immutable Knowledge asset in `CANDIDATE`. |
| 09 | `CKS-12-P2-SS-09` | `CANDIDATE_VALIDATED`: an independent deterministic validator binds source, contradiction, Applicability, freshness, and sufficiency evidence and transitions only to `VALIDATED`. |
| 10 | `CKS-12-P2-SS-10` | `GOVERNED_SYNTHETIC_PROMOTION`: a separate governed decision consumes the validation receipt and creates `PROMOTED_SYNTHETIC_ONLY`; it performs no live activation. |
| 11 | `CKS-12-P2-SS-11` | `KNOWLEDGE_SUFFICIENCY_PROVED`: forward requirements, independent gap-finder probes, boundary probes, and backward proof all bind the promoted exact version. |
| 12 | `CKS-12-P2-SS-12` | `GROUNDED_SOLUTION_RECORDED`: every material solution claim binds used Knowledge and Evidence; unsupported material claims abstain. |
| 13 | `CKS-12-P2-SS-13` | `USAGE_OUTCOME_LINEAGE_RECORDED`: minimized Task → Search → Retrieved/Used/Rejected Knowledge → Decision → Outcome lineage is complete and digest-bound. |
| 14 | `CKS-12-P2-SS-14` | `OPERATIONAL_REPETITION_RECORDED`: same-context repeat evidence increments only `+O`, keyed by the exact context-equivalence digest. |
| 15 | `CKS-12-P2-SS-15` | `CROSS_CONTEXT_GENERALIZATION_RECORDED`: distinct predeclared holdout contexts contribute at most one `+G` unit per context stratum. |
| 16 | `CKS-12-P2-SS-16` | `FAILURE_ATTRIBUTED`: a planted negative outcome receives a finite causal class, evidence, and explicit uncertainty or multi-cause set. |
| 17 | `CKS-12-P2-SS-17` | `APPLICABILITY_NARROWED`: the attributed Applicability failure creates a narrower candidate version that separately traverses validation and governed synthetic-only promotion; prior bytes remain unchanged. |
| 18 | `CKS-12-P2-SS-18` | `REVERSE_EXPERIENCE_PATTERN_VALIDATED`: typed fingerprint retrieval emits a counterevidence-preserving Solution Pattern candidate, and a separate validator—not frequency—marks it `VALIDATED`. |
| 19 | `CKS-12-P2-SS-19` | `KALEIDOSPHERE_READ_ONLY_CANDIDATE`: the minimized projection is read without canonical-source mutation and an authority-free analytic `CANDIDATE` is returned with zero invented edges. |
| 20 | `CKS-12-P2-SS-20` | `SHADOW_WORKFLOW_PARITY_MEASURED`: the validated Pattern compiles to a version-bound shadow Workflow and reaches the parity gate on applicable holdouts. |
| 21 | `CKS-12-P2-SS-21` | `DETERMINISTIC_FUNCTION_COST_PARITY_MEASURED`: one closed substep is extracted as a shadow Function with byte-deterministic output, proof parity, and strictly lower measured reasoning and retrieval cost. |
| 22 | `CKS-12-P2-SS-22` | `KNOWLEDGE_DRIFT_REVALIDATED`: supersession invalidates bound Pattern/Workflow/Function eligibility as `REVALIDATION_REQUIRED`; the new version must re-enter validation before reuse. |
| 23 | `CKS-12-P2-SS-23` | `UNKNOWN_VARIANT_FAST_PATH_ABORTED`: an unknown variant terminates as `FAST_PATH_DENIED` with `ABORTED_UNKNOWN_VARIANT`, zero effects, and retained slow-path/escalation eligibility only. |

The final falsification report is the closure over all 23 step receipts; it is
not a twenty-fourth story step.

## 3. Immutable fixture, version-lock, and receipt contract

### 3.1 Hash and canonicalization

- Algorithm: SHA-256 over exact bytes, encoded as 64 lowercase hexadecimal
  characters without a prefix.
- Fixture, model, runtime, source, and artifact digests hash raw bytes.
- Structured digests use the repository `canonicalJson` behavior: UTF-8 JSON,
  lexicographically sorted object keys, preserved array order, no insignificant
  whitespace, finite JSON numbers only, and no `undefined` or non-plain object.
- A receipt digest is SHA-256 over canonical JSON after removing only the
  top-level `receiptSha256` field. No other field is omitted.
- `previousReceiptSha256` is the prior receipt digest. The first receipt uses
  the SHA-256 of empty bytes:
  `e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855`.

SHA-256 here provides deterministic integrity binding, not identity,
authenticity, trusted time, Authority, or permission.

### 3.2 Exact step-receipt fields

Schema `chimpmaera.cks/closed-loop-step-receipt/v1` is closed. Every field is
required, including empty arrays and `NONE` values:

1. `schemaVersion`
2. `receiptId`
3. `runId`
4. `stepId`
5. `stepOrdinal`
6. `receiptSequence`
7. `actorClass`
8. `actorIdSha256`
9. `syntheticClockTick`
10. `observedAtMs`
11. `expiresAtMs`
12. `scopeSha256`
13. `fixtureId`
14. `fixtureVersion`
15. `fixtureSha256`
16. `inputReceiptSha256s`
17. `previousReceiptSha256`
18. `componentVersionLock`
19. `artifactBindings`
20. `knowledgeBindings`
21. `applicabilitySha256`
22. `evidenceSha256s`
23. `stateBefore`
24. `stateAfter`
25. `status`
26. `reasonCode`
27. `abortStatus`
28. `metricObservationIds`
29. `authority`
30. `capabilityDelta`
31. `effect`
32. `receiptSha256`

`actorClass` is one of `ACQUISITION`, `VALIDATOR`, `GOVERNED_PROMOTER`,
`SOLVER`, `LINEAGE_RECORDER`, `ANALYTICS_ADAPTER`, `SHADOW_WORKFLOW`,
`SHADOW_FUNCTION`, `REVALIDATOR`, or `FALSIFICATION_HARNESS`.
`actorIdSha256` is a synthetic pseudonymous identity binding, not Authority.
`authority`, `capabilityDelta`, and `effect` must each equal `NONE`. Receipt
`status` is one of `RECORDED`, `DENIED`, `ABORTED`, or `FALSIFIED`.
`abortStatus` is `NOT_ABORTED` unless the fast path terminates with one of the
finite abort statuses in section 4.3. Input, evidence, metric, artifact, and
Knowledge arrays use their declared semantic order; producers may not sort
away story order or duplicate entries.

Every `artifactBindings` entry has exactly `role`, `artifactId`,
`artifactVersion`, and `artifactSha256`. Every `knowledgeBindings` entry has
exactly `knowledgeId`, `knowledgeVersion`, `knowledgeSha256`,
`applicabilitySha256`, and `state`. Unknown nested fields deny just as unknown
top-level fields do.

### 3.3 Exact component-version-lock fields

Schema `chimpmaera.cks/component-version-lock/v1` is also closed. Every run and
every step receipt binds these exact fields:

- `boundaryContractVersion`, `panSphairaCommit`, `panSphairaRelease`,
  `canonicalJsonVersion`, `hashAlgorithm`;
- `nodeVersion`, `npmVersion`, `harnessId`, `harnessVersion`, `harnessSha256`;
- `competenceModelId`, `competenceModelVersion`, `competenceModelSha256`,
  `tokenizerId`, `tokenizerVersion`, `tokenizerSha256`;
- `inferenceRuntimeId`, `inferenceRuntimeVersion`, `inferenceRuntimeSha256`;
- `knowledgeContractVersion`, `knowledgeEditionId`, `knowledgeEditionVersion`,
  `knowledgeEditionSha256`;
- `retrievalProfileId`, `retrievalProfileVersion`, `retrievalProfileSha256`;
- `verifierId`, `verifierVersion`, `verifierSha256`;
- `fixturePackId`, `fixturePackVersion`, `fixtureManifestSha256`;
- `receiptSchemaVersion`, `projectionSchemaVersion`, `candidateSchemaVersion`;
- `kaleidoSphereProductVersion`, `kaleidoSphereContractVersion`,
  `kaleidoSphereArtifactSha256`;
- `workflowContractVersion`, `functionContractVersion`;
- `costModelVersion`, `costModelSha256`;
- `syntheticClockVersion`, `syntheticClockSha256`.

Each `Version` value is one exact immutable identifier. Empty values, version
ranges, tags without commit/artifact digests, `latest`, inferred defaults, and
unresolved aliases deny the run. Known repository context is PanSphaira base
`353017c4f60e30463d0a78fd6fd2509a37d37f76`, current release
`v0.2.0-poc.20260825.1`, package manager `npm@11.16.0`, and the existing
external BI compatibility pair KaleidoSphere/SBA `v0.8.0` with contract
`2.0.0`. Those known pins do not prove that a CKS projection adapter or a
KaleidoSphere CKS analyzer exists; their missing exact artifact and run locks
keep this receipt at `EVIDENCE_INCOMPLETE`.

### 3.4 Immutability rules

A fixture identity is the tuple `(fixtureId, fixtureVersion, fixtureSha256)`.
Any byte change creates a new version and digest; overwrite, mutable aliases,
and in-place repair are prohibited. A receipt is append-only and chains the
exact prior receipt. Revalidation creates new asset and receipt versions; it
never edits historical evidence. A verifier must reject unknown fields,
missing fields, duplicate IDs, chain gaps, digest mismatch, expired evidence,
mixed component locks, step reorder, or reuse of a receipt under another run,
scope, fixture, or Applicability digest.

## 4. Finite states and transitions

### 4.1 Acquired-source state

Finite states: `PLANNED`, `ACQUIRED_UNTRUSTED`, `QUARANTINED`.

Allowed transitions are `PLANNED -> ACQUIRED_UNTRUSTED`,
`PLANNED -> QUARANTINED`, and `ACQUIRED_UNTRUSTED -> QUARANTINED`.
Acquisition has no transition to a Knowledge lifecycle state. A new candidate
may only reference an acquisition receipt as untrusted source evidence.

### 4.2 Knowledge, Pattern, Workflow, and Function asset state

Finite states: `CANDIDATE`, `VALIDATED`, `PROMOTED_SYNTHETIC_ONLY`,
`REVALIDATION_REQUIRED`, and `REJECTED`.

Allowed transitions:

- `CANDIDATE -> VALIDATED` or `CANDIDATE -> REJECTED`;
- `VALIDATED -> PROMOTED_SYNTHETIC_ONLY` or `VALIDATED -> REJECTED`;
- `PROMOTED_SYNTHETIC_ONLY -> REVALIDATION_REQUIRED` on any bound dependency,
  Applicability, contract, or digest change;
- `REVALIDATION_REQUIRED -> VALIDATED` for a new immutable version after all
  validation gates rerun, or `REVALIDATION_REQUIRED -> REJECTED`;
- `VALIDATED -> PROMOTED_SYNTHETIC_ONLY` then remains a separate governed
  decision after revalidation.

`REJECTED` is terminal. `PROMOTED_SYNTHETIC_ONLY` means eligible only inside the
bound synthetic proof. It does not mean installed, active, deployed, released,
or executable against a live target.

Prohibited transitions include:

- `ACQUIRED_UNTRUSTED -> VALIDATED`;
- `ACQUIRED_UNTRUSTED -> PROMOTED_SYNTHETIC_ONLY`;
- `CANDIDATE -> PROMOTED_SYNTHETIC_ONLY`;
- `REVALIDATION_REQUIRED -> PROMOTED_SYNTHETIC_ONLY`;
- any transition based only on frequency, model output, KaleidoSphere output,
  correlation, a scalar confidence value, or previous success;
- any transition to production, deployment, activation, Capability, or
  Authority state. No such states exist in this vocabulary.

### 4.3 Fast-path attempt and abort status

Fast-path states are `SHADOW_ONLY`, `ELIGIBILITY_CHECK`,
`ELIGIBLE_SYNTHETIC_ONLY`, `COMPLETED_SYNTHETIC_ONLY`, and
`FAST_PATH_DENIED`.

Allowed transitions are:

- `SHADOW_ONLY -> ELIGIBILITY_CHECK`;
- `ELIGIBILITY_CHECK -> ELIGIBLE_SYNTHETIC_ONLY` or `FAST_PATH_DENIED`;
- `ELIGIBLE_SYNTHETIC_ONLY -> COMPLETED_SYNTHETIC_ONLY` or
  `FAST_PATH_DENIED`.

`FAST_PATH_DENIED` and `COMPLETED_SYNTHETIC_ONLY` are terminal. A denied attempt
must have exactly one abort status from:

- `ABORTED_UNKNOWN_VARIANT`
- `ABORTED_KNOWLEDGE_DRIFT`
- `ABORTED_STALE_KNOWLEDGE`
- `ABORTED_AMBIGUOUS_MATCH`
- `ABORTED_MISSING_INPUT`
- `ABORTED_PROOF_MISMATCH`
- `ABORTED_INTEGRITY_FAILURE`
- `ABORTED_STOP_CONDITION`

A completed attempt has `NOT_ABORTED`. `FAST_PATH_DENIED ->
COMPLETED_SYNTHETIC_ONLY`, fallback execution inside the same attempt, and any
effect after denial are prohibited. An expected unknown/drift probe may make
the overall synthetic test pass only when its attempt terminates denied with
zero effects.

### 4.4 Integrated proof state

Finite states are `EVIDENCE_INCOMPLETE`, `READY`, `RUNNING`,
`PASS_SYNTHETIC_ONLY`, `FALSIFIED`, and `ABORTED`.

Only `EVIDENCE_INCOMPLETE -> READY -> RUNNING` may lead to a verdict. `RUNNING`
may terminate as `PASS_SYNTHETIC_ONLY`, `FALSIFIED`, or `ABORTED`.
`PASS_SYNTHETIC_ONLY` requires all positive gates, all negative probes, all
metrics, all 23 ordered steps, and positive exact dependency receipts from
CKS-07 through CKS-11. Missing or unrun evidence remains
`EVIDENCE_INCOMPLETE`; malformed/integrity-invalid evidence is `ABORTED`; a
valid measurement that violates a claim gate is `FALSIFIED`.

## 5. Separation rules

### 5.1 Acquisition is not promotion

The acquisition actor may copy only bytes from the finite offline synthetic
source pack and emit `ACQUIRED_UNTRUSTED`. It cannot validate its own output.
The validator consumes the immutable source receipt and emits a separate
`CANDIDATE -> VALIDATED` receipt. A separately identified governed promoter
then consumes the validation receipt and may emit `VALIDATED ->
PROMOTED_SYNTHETIC_ONLY`. Distinct `receiptId`, `receiptSequence`, actor class,
and input digest bindings are mandatory; one combined receipt, self-approval,
or success-based auto-promotion is denied.

### 5.2 Repetition is not generalization

`+O` counts successful executions sharing one exact context-equivalence digest.
It measures operational repeatability only. `+G` counts successful,
predeclared, materially distinct context strata on holdout fixtures. Repeats in
one stratum never increase the number of generalization strata; semantic
similarity alone is insufficient. The evidence profile retains source,
Applicability, freshness, contradiction, operational repetition,
generalization, counterexamples, and failures as independent fields, never one
truth score.

Failure attribution uses only `KNOWLEDGE_CONTENT`, `RETRIEVAL`,
`APPLICABILITY`, `REASONING`, `WORKFLOW`, `FUNCTION`, `EXECUTION`,
`VERIFICATION`, `INPUT`, `DRIFT`, `MULTI_CAUSE`, or `UNRESOLVED`. Only a
receipt-supported `APPLICABILITY` failure may create a narrowing candidate.
The narrower version must preserve the counterexample and old Applicability
bytes and separately traverse `CANDIDATE -> VALIDATED ->
PROMOTED_SYNTHETIC_ONLY`.

## 6. Read-only KaleidoSphere boundary

The v1 projection schema is
`chimpmaera.cks/kaleidosphere-projection/v1`. Its exact fields are:

- `schemaVersion`, `projectionId`, `projectionVersion`, `scopeSha256`;
- `sourceReceiptSha256s`, `taskFingerprintSha256`, `contextClassSha256s`;
- `knowledgeBindings` containing only stable ID, exact version, content digest,
  and Applicability digest;
- `searchClass`, `retrievedKnowledgeIds`, `usedKnowledgeIds`,
  `rejectedKnowledgeIds`;
- `decisionClass`, `decisionBindingSha256`, `outcomeClass`;
- `failureAttributionClasses`, `counterevidenceSha256s`;
- `operationalContextSha256`, `generalizationStrataSha256s`;
- `retentionClass`, `observedAtMs`, `expiresAtMs`, `projectionSha256`.

It excludes raw prompts/reasoning, source text, customer or tenant payloads,
credentials, secrets, tokens, personal data, raw rows, SQL, URLs, mutable policy
state, free-form action payloads, and all approval, Capability, Authority,
deployment, activation, publication, apply, or mutation fields. Transfer is a
read-only analysis input; the canonical PanSphaira evidence digest before and
after analysis must be identical. This boundary authorizes no external fetch,
source acquisition, live network operation, database access, or write-back.

The exact return schema is
`chimpmaera.cks/kaleidosphere-candidate/v1` with fields `schemaVersion`,
`candidateId`, `candidateVersion`, `projectionSha256`, `analysisKind`,
`referencedNodeIds`, `supportEdgeSha256s`, `counterevidenceSha256s`,
`blindSpots`, `status`, `authority`, `capabilityDelta`, `effect`,
`promotion`, and `candidateSha256`. `analysisKind` is one of `GAP`, `CO_USAGE`,
`NEGATIVE_EVIDENCE`, `SOLUTION_PATTERN`, `WORKFLOW`, or `DRIFT`. The fixed
values are `status=CANDIDATE`, `authority=NONE`, `capabilityDelta=NONE`,
`effect=NONE`, and `promotion=NOT_AUTHORIZED`. Every node and edge must be
reconstructible from the projection; zero invented edges are allowed.

KaleidoSphere cannot validate or promote Knowledge, Pattern, Workflow, or
Function assets. The currently documented SBA `v0.8.0`/contract `2.0.0` pair is
only a known compatibility pin; it is not CKS-12 evidence and does not widen
its existing boundary.

## 7. Shadow Workflow, Function parity, cost, and drift

A validated Solution Pattern may compile only to a `SHADOW_ONLY` Workflow bound
to exact Knowledge, Applicability, verifier, fixture, runtime, and contract
digests. On the same predeclared applicable holdouts, free reasoning and the
shadow Workflow are compared for:

- material-claim correctness and abstention;
- requirement coverage and false-completeness behavior;
- output class and deterministic verifier verdict;
- exact proof-obligation and evidence-digest set;
- denial/abort semantics; and
- `authority=NONE`, `capabilityDelta=NONE`, and `effect=NONE`.

Parity requires no weaker value on any dimension and no missing proof
obligation. It does not authorize activation.

A Function may be extracted only for a closed deterministic input, output,
logic, error, and version contract after Workflow shadow parity. Function
output and proof-obligation digests must be byte-identical across replays and
match the shadow Workflow substep. Cost is measured on identical fixtures and
component locks using integer `modelCalls`, `reasoningInputTokens`,
`reasoningOutputTokens`, `retrievalCalls`, `retrievedBytes`, and
`verifierChecks`. The Function must strictly reduce both total reasoning tokens
and retrieval calls while keeping verifier checks and proof obligations equal
or greater and quality equal or better. Wall-clock time is diagnostic only and
cannot satisfy the cost gate.

Any Knowledge, Applicability, verifier, Workflow, Function, or contract version
change moves every dependent promoted asset to `REVALIDATION_REQUIRED` before
another eligibility decision. Historical receipts remain valid only for their
old bytes. Unknown, ambiguous, missing-input, stale, or drifted variants end the
fast path as `FAST_PATH_DENIED`; they may be handed to a separately governed
full-reasoning/escalation path but gain no effect or Authority from that handoff.

## 8. Minimum falsification metrics and pass gates

Rates are stored as exact integer numerator/denominator pairs. Rounded floats
never determine a gate. Each metric binds the fixture IDs, run receipts,
component lock digest, baseline arm, candidate arm, and raw integer counts.

| Metric | Minimum evidence and exact gate |
| --- | --- |
| Story coverage and replay | Exactly 23/23 ordered step IDs; at least 3 clean complete replays; identical fixture, receipt-chain, state, verdict, and metric digests. |
| Quality | At least 3 applicable holdout context strata. `correctMaterialAssertions / expectedMaterialAssertions = 1/1` after aggregation, zero unsupported material assertions, and candidate quality no lower than the frozen free-reasoning baseline. |
| Requirement recall and precision | Ground-truth requirements are frozen before solving. Critical and total recall are each `1/1`; precision is reported and must not be lower than the baseline. Any critical miss stops the run. |
| False completeness | At least 3 known-incomplete probes. `incorrectSufficient / knownIncomplete = 0`, and the combined sufficiency process must be strictly lower than the frozen simple-solver baseline, whose same-pack numerator must be at least 1. |
| Repetition/generalization | At least 3 same-context successful repeats contribute to `+O`; at least 3 distinct context strata including 1 untouched holdout contribute to `+G`; duplicate context digests contribute zero additional `+G`. |
| Failure attribution | At least 3 planted failures, including `APPLICABILITY`, `DRIFT`, and one `MULTI_CAUSE` or `UNRESOLVED` case. Exact single-cause/set attribution is `1/1`; unsupported causal certainty is zero. One governed Applicability narrowing is replayed. |
| KaleidoSphere boundary | At least 1 projection/candidate round trip; forbidden fields `0`, invented edges `0`, canonical source mutations `0`, authority/capability/effects `0`, and before/after canonical evidence digests equal. |
| Shadow parity | At least 3 applicable holdouts; quality/proof/denial parity `1/1`, unexpected mismatches `0`, and all bound dependencies exact. |
| Function parity and determinism | At least 3 byte-identical Function replays per applicable holdout; output and proof parity `1/1`; missing proof obligations `0`. |
| Cost | On identical locks and inputs, Function total reasoning tokens `<` shadow Workflow total reasoning tokens and Function retrieval calls `<` shadow Workflow retrieval calls; verifier checks and proof obligations are not reduced. Raw counts and the exact cost-model digest are mandatory. |
| Revalidation and abort | At least 1 Knowledge supersession and 1 unknown variant. Old-version fast-path successes `0`; both attempts end `FAST_PATH_DENIED` with the exact drift/unknown abort status and effects `0`; reuse occurs only after new validation and promotion receipts. |
| Boundary denials | Every prohibited operation in section 10 has at least one named negative probe; unexpected successes `0`. |

The report must also include confusion counts, abstentions, unresolved cases,
missing/invalid receipt counts, run exclusions with reasons, all baseline raw
counts, all candidate raw counts, and every stop condition encountered. No run
may be silently excluded after its immutable start receipt.

## 9. Stop conditions and verdict rules

Immediately stop the affected run and issue no success receipt when any of the
following occurs:

1. A fixture, receipt, chain, scope, Applicability, or component-version digest
   is missing, duplicated, stale, mixed, or mismatched.
2. Any of the 23 story IDs is missing, duplicated, reordered, or unknown, or a
   dependency proof from CKS-07 through CKS-11 lacks a positive exact receipt.
3. Acquisition uses an external fetch or directly validates/promotes its result;
   validation self-approves; promotion is autonomous or not separately governed.
4. Repetition is counted as generalization, frequency/correlation creates truth,
   or a failure narrows Applicability without the separate governed lifecycle.
5. The KaleidoSphere projection contains a forbidden field, references an
   invented node/edge, mutates canonical evidence, or its candidate carries
   promotion, Capability, Authority, or effect semantics.
6. Shadow or Function parity mismatches, a proof obligation is removed, output
   is nondeterministic, or the locked cost comparison does not strictly improve
   both reasoning tokens and retrieval calls.
7. Stale/drifted/unknown/ambiguous/missing input reaches a completed fast path,
   or any denied/aborted path produces an effect.
8. Critical requirement recall is below 1, false completeness is nonzero,
   attribution is incorrect/overclaimed, a minimum denominator is unmet, or
   three clean replays differ.
9. Any external fetch, production/live action, authority or capability
   expansion, deployment, activation, installation, publication, release, or
   customer/tenant data appears.

Integrity, boundary, or prerequisite failures produce `ABORTED` or
`EVIDENCE_INCOMPLETE` as defined in section 4. A valid measurement that misses a
quality, parity, cost, attribution, or falsification gate produces `FALSIFIED`.
Evidence is retained append-only. Retrying requires a new run ID and new chained
receipts; a retry cannot erase the stopped run. Only all gates passing may
produce `PASS_SYNTHETIC_ONLY`, and that verdict must include the complete report
and receipt-chain digest.

## 10. Explicit denied authority and non-claims

This boundary explicitly denies:

- external fetch and any automatic Internet-to-Knowledge path;
- autonomous validation, autonomous promotion, reprioritization, or
  self-approval;
- production action, live-tenant action, live data use, telemetry, or customer
  claim;
- Authority expansion, approval authority, credential access, or policy change;
- Capability expansion, tool/action expansion, execution rights, or effectful
  fallback;
- Workflow or Function installation, deployment, activation, scheduling, or
  learned production routing;
- KaleidoSphere write-back, canonical-evidence mutation, promotion, apply, or
  action authority; and
- merge, release, publication, availability, performance, security,
  generalization beyond the frozen synthetic fixtures, or production readiness.

The only claim made by this artifact is that the CKS-12 v1 vocabulary and
fail-closed evidence boundary are frozen on these repository bytes. The CKS-12
learning-loop outcome remains unproven until the required evidence is produced,
verified, and reported without any stop condition.
