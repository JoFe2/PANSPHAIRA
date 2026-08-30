# RKS-01 source-governance boundary v1

## Scope

This boundary defines metadata-only contracts and deterministic validation for a bounded external-source lifecycle. It does **not** fetch, store, parse, canonicalize, quote, summarize, or otherwise ingest source content. Tests use short synthetic byte sequences, not source material.

The lifecycle has six closed (`additionalProperties: false`) records:

1. **Source profile** — names one official HTTPS canonical URL, one immutable revision/version tuple, media type, pinned parser/canonicalizer versions, and an engineering license/obligation decision.
2. **Source snapshot** — binds retrieval time, byte length, and SHA-256 of exact acquired bytes to that profile. It is immutable metadata; changed bytes require a new snapshot.
3. **Admission decision** — separately records validation of the profile/snapshot and copies the license, notice, attribution, obligation, and allowed-transformation boundary.
4. **Ingestion candidate** — remains `UNTRUSTED_CANDIDATE`; it binds exact source and candidate byte digests and preserves the admitted obligations.
5. **Promotion receipt** — can only bind a validated candidate and admission chain through `GOVERNED_PROMOTION`, with a finite `revalidateBy`. It is a governance receipt, not a truth declaration.
6. **Drift event** — append-only metadata that binds the prior event digest. Drift maps to `REVALIDATION_REQUIRED`; it cannot overwrite history or silently preserve a promotion.

Acquisition, validation, candidate construction, promotion, and drift handling are distinct transitions. Possession of one record does not imply any later transition.

## Canonical digest and trust model

`canonicalJson` recursively sorts object keys while preserving array order. Every record digest is SHA-256 over the canonical UTF-8 encoding of that record with only its own digest field omitted. `sealGovernanceBundle` is a deterministic construction adapter: it derives chain references and digests from its inputs; it does not validate or trust them.

`verifyGovernanceBundle` recomputes all digests internally. A caller cannot provide an `expectedDigests` map. The profile and admission decision are checked against separately provisioned trusted registry entries keyed by `profileId` and `decisionId`; therefore changing a profile or admitted source bytes and re-digesting the whole chain cannot self-attest. Exact source and candidate bytes are supplied out of band and re-hashed by the verifier. The trusted current time and prior drift-event digest are also out-of-band validation state.

Equivalent objects with different key insertion order replay to the same digest and result. No verifier state is mutated by this module.

## Fail-closed rules

Validation denies:

- unknown or absent license decisions and obligations;
- moving-only identities such as `latest`, `main`, or a branch head (not representable by the identity enum);
- unknown/extra fields at every schema level;
- record digest drift or exact source/candidate byte mismatch;
- canonical URL, immutable identity, media type, parser, or canonicalizer mismatch between profile and snapshot;
- license, notice, attribution, or obligation loss;
- a candidate claiming promotion directly;
- caller-authored expected digests;
- profile substitution followed by consistent re-digestion;
- broken profile → snapshot → admission → candidate → promotion/drift lineage;
- transformation-class mismatch, widening, or downgrade;
- an `UNMODIFIED_ONLY` candidate whose bytes differ from source bytes;
- prior-event substitution/history rewrite;
- expired admission or promotion revalidation windows;
- detected bytes drift without `REVALIDATION_REQUIRED`;
- any truth, Capability, Authority, executable, action-authority, or history-rewrite widening.

A byte change does not update a snapshot. The next stage must create a new immutable snapshot and admission chain, and the existing dependent promotion remains revalidation-required.

## Transformation classes

- `TRANSFORM_ALLOWED` means the engineering source review permits bounded transformation **subject to every recorded obligation**. It is not a legal conclusion.
- `UNMODIFIED_ONLY` is narrower: candidate bytes must equal source bytes exactly, and widening to transformed output is denied. This models the RFC archival control without claiming that the implementation has made a legal determination.

The schemas intentionally cannot encode `UNKNOWN` as an admissible license state. Unknown or incomplete review must remain outside this admitted boundary.

## Explicit nonclaims

All six records fix `truthGrant`, `capabilityGrant`, and `authorityGrant` to `NONE`. Candidate and promotion records additionally deny executability/action authority. This work makes no claim of:

- source correctness, completeness, freshness, or truth;
- Capability qualification or executable behavior;
- action, network, tenant, policy, approval, or promotion authority;
- autonomous promotion, production activation, model training, or model utility;
- legal advice or final legal interpretation;
- source acquisition, content ingestion, parser correctness, or canonicalizer correctness;
- completion of the three-source pilot or comparative verdict in PANSPHAIRA #311.

Those later claims require separate governed evidence and are outside RKS01-SOL-01.
