---
title: CKS-10 analytics bridge boundary decision v1
description: Freeze a minimized PanSphAIra-to-KaleidoSphere projection and an authority-free candidate return boundary without implementing or activating it.
---

# CKS-10 analytics bridge boundary decision v1

- Decision ID: `CKS-10-BOUNDARY-DECISION-V1`
- Task ID: `PLAN-PSAI290-BOUNDARY-DECISION-01`
- Decision version: `1.0.0`
- Decision status: `ACCEPTED_BOUNDARY_ONLY_INTEGRATION_UNPROVEN`

## Decision outcome and precedence

CKS-10 selects one two-envelope producer/consumer boundary:

1. PanSphAIra produces a versioned, minimized, digest-bound projection that
   KaleidoSphere may consume only for the declared exploration purpose.
2. KaleidoSphere may return only versioned, digest-bound, authority-free
   candidates. PanSphAIra treats every return as untrusted candidate material.

This decision is subordinate to Operating Model v1.1 and preserves decisions
D-001 through D-007. It does not amend them, add a process variant, or transfer
an ownership or approval step. If this receipt and those decisions appear to
conflict, the existing operating model and decisions prevail and the bridge
remains disabled.

This is an architecture decision and deterministic integration receipt only.
It adds no schema implementation, endpoint, connector, storage, collector,
runtime, policy, approval, promotion, invalidation, or external action.

## Ownership invariant

| Concern | PanSphAIra | KaleidoSphere |
| --- | --- | --- |
| Knowledge | Sole owner of canonical Knowledge and its lifecycle | May explore a minimized projection and suggest `KNOWLEDGE_CANDIDATE` records |
| Promotion | Sole owner of every promotion decision and status transition | Cannot approve, promote, publish, activate, or imply promotion |
| Invalidation | Sole owner of invalidation, revocation, supersession, and revalidation | May return an `INVALIDATION_CANDIDATE`; cannot invalidate anything |
| Governed assets | Sole owner of governed Knowledge, Workflow, Function, policy, manifests, and their canonical versions | Receives no governed-asset ownership and cannot create or mutate a canonical asset |
| Authority | Sole owner of Policy, Approval, credentials, execution authority, and effect authorization | Has `Authority: NONE`; analysis confidence, rank, or provenance is never Authority |
| Analytics implementation | Defines the admitted purpose, source scope, and return gate | Owns its internal exploration and candidate-generation implementation without gaining PanSphAIra rights |

A candidate may inform a later, separate PanSphAIra-controlled process. It is
not Knowledge, a Workflow, a Function, an approval, an invalidation, an
executable plan, or a governed asset. PanSphAIra must independently validate
current source state, Policy, Approval, provenance, and all applicable governed
asset rules before it can create or change any canonical asset.

## Alternatives considered

### A. Shared database or shared canonical domain model

Rejected. Shared mutable storage would blur producer/consumer ownership, let
analytics state look canonical, and make tenant, retention, invalidation, and
Authority enforcement depend on undocumented database behavior.

### B. Rich export of prompts, governed assets, policy state, and raw evidence

Rejected. Full-context export violates minimization, expands secret and
credential exposure, exports mutable Policy/Approval state, and creates an
unbounded replay and retention surface.

### C. Minimized export with automated write-back or promotion

Rejected. A score, model result, analysis, or candidate cannot authorize its
own promotion. Automated write-back would transfer promotion, invalidation,
Workflow, Function, or other governed-asset Authority to KaleidoSphere.

### D. One-way projection with no return contract

Not selected. It is safe as the operational fallback, but it cannot carry
bounded exploration results back for PanSphAIra-controlled consideration.
When any CKS-10 admission check cannot be satisfied, this one-way/no-return
state collapses further to a disabled bridge; it does not justify a wider
interface.

### E. Versioned minimized projection plus authority-free candidates

Selected. It gives KaleidoSphere enough explicitly allowlisted material for
exploration while keeping every canonical lifecycle and Authority decision in
PanSphAIra. Both directions are independently versioned, digest-bound, scoped,
time-bounded, and fail closed.

## Selected producer/consumer boundary

The logical contracts selected by this decision are:

- projection: `cks-10/minimized-projection/v1`, exact contract version `1.0.0`;
- return: `cks-10/candidate-return/v1`, exact contract version `1.0.0`; and
- compatibility tuple: projection `1.0.0` / return `1.0.0` only.

These are logical contract identifiers, not claims that wire schemas or
runtimes already exist. A future implementation must freeze closed schemas and
canonical digest rules before any exchange is admissible.

### PanSphAIra-produced minimized projection

Every projection must carry the following closed field classes. Values are
immutable for that projection and all identifiers are stable, opaque,
PanSphAIra-minted or registry-bound identifiers rather than display names:

| Field class | Required binding |
| --- | --- |
| Contract | contract ID, exact contract version, and contract/schema digest |
| Exchange | exchange ID, projection ID, projection version, projection digest, and PanSphAIra-minted replay ID |
| Producer/consumer | producer ID/version/digest and intended consumer ID/version/digest |
| Tenant and scope | opaque tenant-scope ID plus scope ID, scope version, scope digest, and immutable scope-decision reference ID/version/digest |
| Purpose | one closed purpose class and its versioned registry digest |
| Source | stable asset ID, asset version, asset digest, asset class, data classification, evidence class, and provenance digest for every source reference |
| Time | issued-at, fresh-until, and retain-until instants with `issued-at < fresh-until` and `retain-until <= fresh-until` |
| Payload | only allowlisted, bounded, typed scalar facts, aggregate measures, or relationship edges necessary for the declared purpose; every field has a stable field ID/version/class and source reference |

The projection contains only the minimum field set that passes a documented
necessity test for its declared purpose. A field is omitted when an ID,
version, digest, class, bounded aggregate, or relationship is sufficient.
Unknown fields and free-form extension maps are prohibited.

The projection explicitly excludes:

- secrets, credentials, tokens, keys, cookies, credential references, and
  authentication or signing material;
- raw prompts, completions, messages, chain-of-thought, model transcripts,
  arbitrary rationale text, and tool or command logs;
- raw rows, SQL, files, binary blobs, full governed-asset bodies, and any
  payload not necessary for the declared exploration purpose;
- direct tenant, customer, user, actor, session, host, path, URL, network, or
  provider identifiers when an opaque scoped identifier is sufficient;
- mutable Policy, Approval, Authority, lease, decision, workflow-run, and
  invalidation state, including policy rules and signatures; and
- executable code, commands, Function bodies, Workflow definitions, effect
  payloads, callbacks, arbitrary routes, or write instructions.

An immutable scope-decision ID/version/digest may bind what PanSphAIra already
allowed for this export. The mutable policy document and its live state do not
cross the boundary. PanSphAIra evaluates live Policy and invalidation state
before export and evaluates them again before admitting any returned candidate.

### KaleidoSphere-produced authority-free return

A return envelope must bind exactly to one admitted projection. It carries:

- the exact contract ID/version/digest and candidate-envelope ID/version/digest;
- the original exchange, replay, projection, tenant-scope, scope, purpose, and
  producer/consumer bindings without relabeling;
- a stable candidate ID/version/digest and one candidate class from the exact
  PanSphAIra-owned candidate-class registry version/digest;
- source asset IDs/versions/digests and the complete projection digest;
- the KaleidoSphere implementation ID/version/digest and bounded method,
  model, configuration, and evidence provenance IDs/versions/digests used to
  generate the candidate, without prompts or raw traces;
- generated-at, fresh-until, and retain-until instants no broader than the
  source projection; and
- only inert, bounded candidate facts, relationship suggestions, aggregate
  measurements, closed reason codes, and confidence values.

The candidate class may describe an analytics, Knowledge, Workflow, Function,
or invalidation possibility, but the envelope is fixed to:

- `lifecycleClass: UNTRUSTED_CANDIDATE`;
- `authorityClass: NONE`;
- `effectClass: NONE`;
- `requestedDisposition: REVIEW_ONLY`; and
- `promotionClaim: NONE`.

A Workflow or Function candidate may identify a gap or declarative possibility;
it cannot contain executable code, a command, an effect payload, an active
binding, or an invocation route. An invalidation candidate is only a signal for
PanSphAIra review. No return value can promote Knowledge, a Workflow, or a
Function, invalidate an asset, change Policy, satisfy Approval, or authorize an
effect.

After successful envelope validation, the strongest permitted ingress outcome
is `QUARANTINED_CANDIDATE`. Quarantine is not promotion and is not a governed
asset. Other outcomes are `DENIED` and `DUPLICATE_NOOP`; none conveys Authority.

## Fail-closed rules

### Tenant and scope

- Both sides must compare the exact opaque tenant-scope ID, scope ID/version/
  digest, purpose class, intended peer, and projection digest.
- Missing, unknown, malformed, unverified, or mismatched bindings are denied
  before exploration or candidate admission.
- Candidate references must be a subset of source IDs and field classes in the
  admitted projection. Scope expansion, substitution, relabeling, wildcarding,
  or a reference to an unprojected source is denied.
- Cross-tenant joins, caches, training, aggregates, replay, or candidate reuse
  are outside CKS-10. A request for any of them requires a separate decision;
  absence of that decision means denial.

### Retention

- Every exchange has finite `retain-until`; missing, infinite, extended, or
  already expired retention is denied.
- KaleidoSphere may shorten but never extend the PanSphAIra limit. Derived
  state, caches, indexes, and candidate material inherit the earliest source
  expiry.
- At expiry, use and return are denied and retained projection/derivative bytes
  must be removed. If the consumer cannot enforce or locally evidence this
  bound, it must reject the projection before retaining it.
- Retention expiry does not become permission to omit provenance or to keep an
  unbound aggregate.

### Freshness and invalidation

- Both ingress points and every reuse check `issued-at`, `fresh-until`, source
  versions/digests, and current PanSphAIra invalidation state.
- An unavailable trusted clock, impossible time ordering, future-issued
  envelope, stale source, superseded version, digest drift, or invalidated
  source is denied.
- A candidate cannot extend source freshness. Source invalidation makes later
  returns inadmissible and makes any quarantined candidate ineligible for
  promotion until PanSphAIra performs a fresh independent evaluation.

### Provenance

- Every projected fact and candidate claim must resolve through immutable
  IDs/versions/digests to an in-scope source and the exact projection.
- Missing, partial, ambiguous, self-asserted, digest-invalid, class-invalid, or
  out-of-scope provenance is denied. Neither side may infer or fill a missing
  binding from names, ordering, prior exchanges, or mutable external state.
- Confidence and rank are evidence attributes only. They never substitute for
  provenance, Policy, Approval, readback, or Authority.

### Replay

The replay key is the complete canonical tuple of contract, peer, exchange,
tenant-scope, scope, purpose, projection, candidate, and digest bindings.

- The first valid candidate envelope can create at most one quarantined
  candidate record.
- An exact-byte duplicate within all valid time and source-state bounds returns
  `DUPLICATE_NOOP`: no second record, lifecycle transition, promotion,
  invalidation, or other state change occurs. It is not a success receipt.
- Reuse of an exchange or replay ID with different bytes or any changed tuple
  member is `DENIED_REPLAY`.
- Replay across a tenant, scope, purpose, peer, version, source digest,
  candidate ID, retention window, freshness window, or invalidation generation
  is denied.
- Replay after expiry, source invalidation, contract retirement, or prior
  consumption is denied. Only PanSphAIra may mint a fresh exchange from a
  freshly evaluated projection; KaleidoSphere cannot refresh or rebind one.

## Explicit reject conditions

The bridge rejects without exploration, quarantine, promotion, mutation, or a
success claim when any of the following is true:

1. a contract, registry, producer, consumer, implementation, source, scope,
   projection, candidate, provenance, or evidence ID/version/digest is absent,
   malformed, unknown, unsupported, or mismatched;
2. an unknown field, unknown class, free-form extension, silent default,
   coercion, downgrade, or schema fallback is required;
3. a secret, credential, raw prompt, raw trace, raw row, SQL statement,
   unnecessary payload, mutable policy state, executable body, effect payload,
   callback, arbitrary route, host, or path is present;
4. tenant or scope cannot be verified exactly, a reference is out of scope, or
   cross-tenant/cross-scope reuse is attempted;
5. retention or freshness is missing, unbounded, expired, widened, impossible,
   or unenforceable;
6. provenance is incomplete, source bytes or versions drift, or PanSphAIra
   reports the source invalid, superseded, revoked, or stale;
7. replay is mutated, cross-boundary, expired, invalidated, or would create a
   second state change;
8. a candidate claims approval, activation, publication, promotion,
   invalidation, Policy, Authority, write semantics, executable Workflow or
   Function semantics, or any lifecycle other than `UNTRUSTED_CANDIDATE`;
9. KaleidoSphere requests direct canonical storage, governed-asset mutation,
   credentials, a privileged callback, or a PanSphAIra effect route; or
10. required local evidence has not passed. Missing evidence keeps the
    integration verdict unproven and the bridge disabled; it cannot be replaced
    with an optimistic issue, delivery, compatibility, or runtime claim.

A denial response contains only a closed reason code and correlation digest. It
must not reflect rejected secrets, payloads, paths, prompts, or credentials.

## Compatibility and version policy

- `cks-10/minimized-projection/v1@1.0.0` and
  `cks-10/candidate-return/v1@1.0.0` are immutable exact wire decisions once
  implemented. Closed schemas reject additional properties.
- Admission requires the exact compatibility tuple and exact contract and
  class-registry digests. Semantic-version ranges, best-effort parsing, implicit
  downgrade, and “latest” resolution are prohibited.
- Any field, field meaning, class, digest algorithm, canonicalization rule,
  tenant/scope rule, retention rule, freshness rule, provenance rule, replay
  rule, or return disposition change requires a newly frozen exact contract
  version. Unknown versions fail closed.
- An implementation may explicitly support more than one exact frozen version,
  but it validates each independently. It may not translate through an
  unreviewed adapter or inherit evidence or Authority from another version.
- A change that could widen disclosure, scope, retention, candidate capability,
  promotion, invalidation, governed-asset ownership, or Authority requires a
  successor architecture decision. It is never treated as a compatible patch.
- If exact compatibility cannot be established before transfer, no projection
  is sent. If it cannot be re-established on return, no candidate is admitted.

## Evidence inputs and local readback boundary

`#288` and `#289` are referenced only as evidence-input identifiers. They do
not prove their own content, state, delivery, compatibility, or completion.
They become admissible evidence only if a later deterministic local readback
harness verifies captured immutable input bytes, identity, expected claim
mapping, and content digest against this decision.

This receipt performs no issue lookup and records no mutable external state. It
creates no wait, owner handoff, owner assignment, dependency state, or delivery
record. Failure to admit either input does not widen CKS-10; it leaves the
integration claim unproven and the bridge disabled.

The machine-readable companion receipt is
`verification/cks-10-boundary-decision-v1.json`. It binds this decision's
selected alternative, ownership, reject rules, compatibility policy, evidence
input identifiers, nonclaims, and required repository verification.

## Nonclaims

This decision does not claim or perform:

- product behavior, a wire schema, endpoint, connector, queue, database,
  retention worker, deletion worker, replay store, or runtime activation;
- an actual projection export or candidate return;
- KaleidoSphere access to PanSphAIra Knowledge, credentials, Policy, Approval,
  governed assets, storage, or effect routes beyond this unimplemented logical
  projection;
- promotion or invalidation of Knowledge, a Workflow, a Function, or any other
  governed asset;
- privacy, security, isolation, deletion, provenance, compatibility,
  performance, cost, tenant, production, or operational proof;
- verification, completion, delivery, or external state of `#288` or `#289`;
- a wait, handoff, issue delivery, external mutation, push, merge, release, or
  deployment; or
- a change to Operating Model v1.1 or decisions D-001 through D-007.

The only success claim available to this slice is that the bounded decision and
its deterministic companion receipt are committed and the required repository
diff check passes. Until that evidence exists, success must not be claimed. The
integration verdict remains `NOT_IMPLEMENTED_NOT_INTEGRATED_NOT_DELIVERED`.

## Deterministic receipt summary

- Selected alternative: `VERSIONED_MINIMIZED_PROJECTION_AUTHORITY_FREE_CANDIDATE_RETURN`.
- Producer flow: `PANSPHAIRA_TO_KALEIDOSPHERE_MINIMIZED_PROJECTION`.
- Return flow: `KALEIDOSPHERE_TO_PANSPHAIRA_UNTRUSTED_CANDIDATE`.
- PanSphAIra ownership: `KNOWLEDGE_PROMOTION_INVALIDATION_GOVERNED_ASSETS_AUTHORITY`.
- KaleidoSphere authority: `NONE`.
- Failure mode: `DENY_OR_DUPLICATE_NOOP_WITHOUT_STATE_CHANGE`.
- Operational fallback: `BRIDGE_DISABLED`.
- Integration verdict: `NOT_IMPLEMENTED_NOT_INTEGRATED_NOT_DELIVERED`.
