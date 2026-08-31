# CSCL-07 adversarial semantic evidence matrix v1

Status: **complete released-profile matrix with explicit unresolved and denied relations** for the exact `2026_08_31_v3` release at `8dae13e416ca42709bf04f01faba5b3b4708deeb`.

## Boundary

CSCL-07 is a read-only analytic matrix step. It consumes only the five released training profiles: Odoo Community, ERPNext, Dolibarr, Tryton, and Apache OFBiz. It performs no network access and does not read, name as an input, or semantically inspect the iDempiere holdout. It does not produce a Capability, Process Pattern, common-core, promotion, execution, truth, compatibility, procurement, production-fitness, or Authority claim.

Source-profile `equivalenceProof`, `nativeMeaningSha256`, and `candidateMeaningSha256` fields are preserved byte-for-byte as opaque lineage. They are never relation evidence. Equal names, labels, question IDs, states, digests, field shapes, lexical forms, or 4/5 frequency cannot establish a relation.

## Frozen inputs before matrix output

`tests/fixtures/cscl-07/released-input-set-manifest-v1.json` binds:

- exact Main SHA and release tag;
- deterministic system, family, and question order;
- each released receipt and profile/fact/cell artifact by path, byte length, and SHA-256;
- independently canonicalized receipt, profile, fact-set, and cell-set digests;
- exactly five profiles, 36 rows, and 180 cells.

The loader rejects any artifact/content digest mismatch before constructing a relation. It independently reproduces the released state denominator:

| System | SUPPORTED | ABSENT | AMBIGUOUS | VARIANT | CONFLICTING | UNMAPPED |
|---|---:|---:|---:|---:|---:|---:|
| Odoo Community | 27 | 3 | 6 | 0 | 0 | 0 |
| ERPNext | 31 | 0 | 5 | 0 | 0 | 0 |
| Dolibarr | 33 | 0 | 1 | 0 | 2 | 0 |
| Tryton | 28 | 4 | 3 | 1 | 0 | 0 |
| Apache OFBiz | 33 | 1 | 1 | 0 | 1 | 0 |
| **Total** | **152** | **8** | **16** | **1** | **3** | **0** |

## Relation semantics and review ledger

`relation-spec-v1.json` freezes the closed analytic state set:

- `POTENTIAL_EQUIVALENCE`
- `VARIANT_RELATION`
- `DISTINCT`
- `UNRESOLVED`
- `DENIED`

A potential equivalence requires exact references from at least two systems, evidence-backed shared purpose, at least one additional matching operational dimension, and no involved absence, conflict, or unresolved counterexample. A variant requires shared purpose plus an exact differing operational dimension. Distinct requires positive material difference; missing proof is insufficient. Explicit absence/conflict or a forbidden shortcut is denied. Everything that cannot meet another rule remains unresolved.

`evidence-review-v1.json` is frozen before expected matrix generation. Its 36 reviews each bind all five cell digests, exact fact digests/locators/excerpts, assessed dimensions, and an outcome. Unresolved reviews name missing dimensions; denied reviews bind exact negative states and counterexamples. Two reviews meet the variant rule:

1. product/item states and transitions;
2. sales-order states and transitions.

No review meets the potential-equivalence or distinct minimum. Final review-derived counts are 28 unresolved, 6 denied, 2 variant relations, 0 potential equivalences, and 0 distinct relations.

## Matrix shape and preservation

Rows use frozen family/question order; each row has exactly five system cells in frozen system order. Every released source cell appears once and unchanged. Each matrix cell also contains its exact referenced Source Fact records and source-profile digest. Full released System Profiles and all Source Facts are retained under `sourceProfiles`, preserving native terminology and the one extra OFBiz source fact without changing the 180-cell denominator.

The expected and verification matrix bytes are identical:

- `tests/fixtures/cscl-07/expected-matrix-v1.json`
- `verification/cscl-07-semantic-evidence-matrix-v1.json`

`src/cscl-07/matrix.mjs` independently verifies released inputs, review references, minimum proof rules, order, denominator, cell/fact pairing, negatives, counterexamples, matrix replay, and closed top-level output fields. `renderArtifacts()` seals canonical matrix and receipt bytes deterministically.

## Adversarial behavior

Tests deny missing/duplicate profiles, rows, and cells; digest drift; fact/cell substitution; paired substitution and redigestion; omitted negative, ambiguous, conflicting, variant, or counterexample evidence; lexical synonym/homonym; field-shape similarity; frequency majority; caller labels/verdicts/digests/counts; invented evidence edges; order dependence; extras; holdout/iDempiere additions; and prohibited claim fields. An attacker-selected identical `candidateMeaningSha256` across all five cells cannot create a potential equivalence.
