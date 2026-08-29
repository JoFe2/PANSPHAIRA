# Competence-Knowledge Contracts (CKS issue 281)

Status: **local, frozen, additive, authority-free vocabulary contract**.

This slice freezes only the additive, authority-free CKS vocabulary v1 for
CKS issue #281. It preserves Operating Model v1.1 decisions D-001 to
D-007 and invents no new process variant. It defines names and their finite
sets; it does not define how anything is applied, scored, routed, stored,
retrieved, executed, or activated.

## Frozen vocabulary

- `schemaVersion` is exactly `chimpmaera.cks/vocabulary/v1`.
- Knowledge kinds: `FACT`, `RULE`, `PROCEDURE`, `GUIDE`, `EXAMPLE`, `COUNTEREXAMPLE`, `CONSTRAINT`.
- Qualification identifiers: `Q0` through `Q6`.
- Maturity identifiers: `L0` through `L6`.
- Independent task-complexity dimensions: `R`, `K`, `P`, `U`. These are
  dimension names only. They carry no score, weight, threshold, or routing
  meaning, and no dimension implies any other dimension, level, or kind.
- Denial reasons: `SCHEMA_DENIED`, `STALE_VERSION_DENIED`, `AUTHORITY_DENIED`,
  `REGISTRY_MUTATION_DENIED`, `NONCLAIM_MUTATION_DENIED`,
  `APPLICABILITY_MISMATCH_DENIED`, `CROSS_SCOPE_BINDING_DENIED`,
  `DIGEST_TAMPERED_DENIED`.
- The manifest carries the existing read-only Knowledge authority boundary
  constant `READ_ONLY_KNOWLEDGE_NO_CREDENTIAL_POLICY_CAPABILITY_TOOL_WRITE_OR_EXECUTION_AUTHORITY`,
  reused from the knowledge envelope contract. The boundary is referenced,
  not redefined.
- The manifest is bound by the canonical SHA-256 digest
  `3f7c1891a5fd2ecf01882df395921f9b8f2af268f74e4ac6b83a3caed69a03c0`,
  computed over `canonicalJson` of the manifest with the `vocabularyDigest`
  field excluded.

Qualification identifiers and maturity identifiers are distinct vocabularies:
no `Qn` is a maturity identifier, no `Ln` is a qualification identifier, and
no complexity dimension is a member of any other scope.

## Validation and denial

`schemas/contracts/cks-vocabulary-v1.schema.json` is a closed Draft 2020-12
schema: `additionalProperties` is false, every registry is a fixed ordered
tuple enforced with `prefixItems`, `minItems`/`maxItems` and `items: false`.
`validateCksVocabularyV1` is the TypeScript mirror of the same contract and
returns frozen reason codes, never a throw. Denial is fail-closed and
cumulative: unknown fields, stale or future `schemaVersion` values, authority
boundary drift, reordered/omitted/duplicated registry members, unfrozen
applicability values that merely match a scope's identifier grammar,
cross-scope bindings (for example a maturity identifier in a qualification
slot), and digest drift or tampering all deny. The digest gate runs last, so
a content mutation with an old digest reports both `REGISTRY_MUTATION_DENIED`
(or another content reason) and `DIGEST_TAMPERED_DENIED`.

## v1 immutability

v1 is frozen. No field is added, removed, renamed, or re-scored, and no frozen
registry member is reordered, re-sorted, or replaced inside v1. The frozen
tuples, the reason set, the nonclaims, the
authority boundary constant, and the pinned digest are the complete contract.
Any content difference from the pinned manifest is denied by the digest gate
or the schema. Object-key order is representation-only: `canonicalJson`
intentionally absorbs key order, so semantically identical reordered objects
remain valid and produce the same pinned digest; registry array order remains
contractual and is denied when changed.

## Verification Fabric reuse and qualification binding

An evidence entry's `attestationDigest` is an identity reference, not a
self-authenticating string. Runtime readers resolve that digest to the
existing Verification Fabric v2 attestation and deny an unresolved or
malformed record, digest drift, a missing PASS result for `attestedTest`, or
an expiry echo that differs from the attestation. Coverage state is derived
from the attestation's authoritative expiry, including when the CKS entry
omits `expiresAtMs`; an entry cannot extend an expired attestation.

Qualification and escalation do not introduce a second #281 profile format.
They reuse the already published CKS-06 contracts in `cks-qualification.ts`:
the exact qualification profile binds the knowledge manifest and applicability
policy in its closed eleven-part identity, while the typed escalation receipt
retains R/K/P/U and remains advisory-only. #281 freezes Q0–Q6 as an orthogonal
vocabulary and supplies validated Knowledge Object, Applicability, Evidence
Pack and Coverage identities; a bare digest string is never evidence and never
grants qualification, routing, Capability, or Authority. These checks reuse
the #47/#116 Verification Fabric identities and the #286 qualification surface
rather than duplicating either contract.

## Additive successor policy and incompatible replacement

A successor (v2 or later) must be additive or an explicit replacement:

- Additive successors keep every v1 identifier, its scope, its order, and
  its meaning. They may add new identifiers to a registry only in a new
  schema version with a new schema identity, a new pinned digest, and an
  updated closed schema. v1 consumers keep validating v1 manifests exactly
  as frozen; a v2 manifest never satisfies the v1 schema because the v1
  `schemaVersion` const and v1 tuple shapes are fixed.
- Incompatible changes (renaming, reordering, re-scoring, or re-scoping any
  frozen identifier) are replacements, not successors. They ship under a new
  schema identity and digest, and v1 remains available and valid for
  v1-identified manifests. No version mutates another version's frozen set.

## Rollback

Rollback is operator-controlled and repository-local:

1. Pin consumers to the v1 schema identity and the pinned v1 digest.
2. Revert to the exact frozen v1 files (`competence-knowledge-vocabulary.ts`,
   the v1 schema, and this document); do not synthesize intermediate states.
3. Retain any denied or rejected manifest attempts append-only for audit.
4. Remove only CKS-scoped state. Do not alter unrelated frozen contracts.

## Reused foundations

This contract reuses, without duplication:

- `canonicalJson` from `packages/contracts/src/canonical-json.ts` for the
  canonical digest.
- The read-only Knowledge authority boundary constant from
  `packages/contracts/src/knowledge-envelope.ts`.
- The Knowledge Envelope, Verification Fabric, and learning-routing record
  shapes of contracts #47, #116, and #128 to #130. Those contracts are
  referenced as prior frozen work; their shapes are not copied here.

## Nonclaims

The vocabulary is names only. v1 explicitly does not provide:

- `NO_KNOWLEDGE_OBJECT_SEMANTICS` — no Knowledge Object is defined.
- `NO_QUERY_SEMANTICS` — no query form, matching rule, or query behavior.
- `NO_APPLICABILITY_SEMANTICS` — an identifier in a slot is not an
  applicability decision.
- `NO_EVIDENCE_SEMANTICS` — no evidence, citation, or verification binding.
- `NO_QUALIFICATION_ASSESSMENT_SEMANTICS` — `Q0` to `Q6` are identifiers, not
  an assessment procedure or rubric.
- `NO_ESCALATION_SEMANTICS` — no escalation path or trigger.
- `NO_STORAGE_SEMANTICS` — no storage, persistence, or retention rule.
- `NO_RETRIEVAL_SEMANTICS` — no retrieval or lookup behavior.
- `NO_ROUTING_OR_PROVIDER_SEMANTICS` — no routing, provider, or model
  selection meaning for any dimension.
- `NO_CAPABILITY_OR_POLICY_SEMANTICS` — no capability grant or policy
  evaluation.
- `NO_WRITE_OR_EXECUTION_AUTHORITY` — the vocabulary grants no write, tool,
  credential, or execution authority; the authority boundary remains the
  existing read-only Knowledge boundary.
- `NO_RUNTIME_ACTIVATION_SEMANTICS` — nothing here activates or is activated
  at runtime.
- `LEVELS_AND_DIMENSIONS_CARRY_NO_SCORE_WEIGHT_OR_THRESHOLD` — no identifier
  encodes a numeric score, weight, or threshold, and none implies one.
- `VOCABULARY_IS_NOT_A_TRUTH_CLAIM` — freezing names is not a claim that any
  fact, rule, or procedure is true.

This proves strict local contracts and deterministic validation only. It does
not prove knowledge content, truth, production storage or retrieval, routing,
provider behavior, capability, policy, deployment, or any execution
authority.

## Frozen Knowledge Object, Query and Applicability bindings

Leaf-2 adds closed, authority-free bindings on top of the frozen vocabulary;
it does not revise the Leaf-1 vocabulary bytes or any pre-existing envelope
or applicability contract. The exact schema identities are:

- `chimpmaera.cks/knowledge-object/v1`
- `chimpmaera.cks/knowledge-query/v1`
- `chimpmaera.cks/applicability/v1`

A Knowledge Object fixes its vocabulary values, validity interval, status,
optional replacement references, and an exact `(envelopeId, envelopeDigest,
scopeNamespace)` provenance binding. Its finite status registry is exactly
`ACTIVE`, `SUPERSEDED`. A Query and an Applicability binding each carry an
exact object identity/digest and the same namespace; neither can bind across
namespaces. The Applicability binding hands its `acceptedContext` to the
existing `validateAcceptedContextV1` contract and requires every declared
material dimension to be present in that accepted context. It does not copy,
alter, or broaden the existing applicability vocabulary.

`validateCksKnowledgeObjectV1` resolves provenance only against the exact
existing Knowledge Envelope binding from #47: envelope id, canonical digest,
namespace and knowledge kind must all match. `validateCksKnowledgeQueryV1`
and `validateCksApplicabilityBindingV1` resolve only against the supplied
exact object. All three validators are fail-closed, return only the frozen
`CKS_KNOWLEDGE_DENIAL_REASONS_V1` registry, and use canonical SHA-256 helpers
that are invariant under object-key order. Unknown fields, stale versions,
digest drift, invalid validity intervals, unresolved supersession references,
applicability mismatch, cross-scope binding, and non-empty authority records
deny.

### Leaf-2 nonclaims and migration

These bindings prove identity and compatibility only. They do not establish
the truth, correctness, completeness, priority, ranking, retrieval result,
applicability outcome, execution, policy, capability, credential, tool,
write, or activation authority of a Knowledge Object. `SUPERSEDED` and a
resolved `supersedes` reference are immutable references, not a lifecycle
operation, deletion rule, rollback instruction, or automatic replacement.

v1 remains closed and immutable. Any field, registry, enum, meaning, or
validation change ships under a new schema identity and new digest; consumers
must explicitly select and validate that version. A later version may retain
v1 records by validating them under their original v1 schema, but it cannot
silently upgrade, reinterpret, or make a v2 record satisfy these v1 bindings.
Migration is therefore explicit record re-issuance with new canonical
digests, while rollback is a return to the exact v1 record and its existing
envelope/applicability references.