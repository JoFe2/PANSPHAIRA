# CSCL-09 Product / Item Management Mapping and Application Guide v1

Status: **frozen non-authoritative candidate promoting only the matching `purpose` dimension of exactly one reviewed states-transitions VARIANT_RELATION** into a bounded common core.

## Authority and boundary

This guide applies only to `PRODUCT_ITEM_MANAGEMENT` from CSCL-07 release `2026_08_31_v4` at `27488888a35fc59caa51bff12fb4ba8c0f28c31d`, matrix digest `d68dff995ab03e426302f593a5f73e10ffa886040217b7355e310878aa957d8d`. It also binds the released CSCL-07 relation-spec bytes (`tests/fixtures/cscl-07/relation-spec-v1.json`, bytes SHA-256 `6007e8729ff8a63b5dc94bf200008a34ac1d586edcb1b6a1bc8b71b39bea51d2`, canonical spec digest `a47e78346dbe3453b86f2545dfa437e966253490a9f2f993cdbca064e74d3599`) because those bytes preserve which evidence belongs to the matching and differing dimensions. The complete Product denominator is 12 rows, 60 source cells, five training systems, and 12 reviewed relations.

The Product family carries exactly one positive reviewed relation in the full 36-row matrix: the **states-transitions VARIANT_RELATION**. Its matching `purpose` evidence is the five `objects-roles` cells. Its differing `statesTransitions` evidence is the five states-transitions cells: `dolibarr`, `tryton`, and `apache-ofbiz` are system variants, while `odoo-community` and `erpnext` remain unresolved. The remaining 11 relations are **9 UNRESOLVED and 2 DENIED**. Candidate-level promotion is applied only to the matching purpose dimension of that one relation. It makes no universal ERP, compatibility, execution, production-fitness, authoritative promotion, further promotion, or Authority claim.

## What promotion means and what it does not mean

The common core is populated **only** by the five positive `objects-roles` cells cited as evidence for the relation's matching `purpose` dimension. Those cells are evidence-only bindings for one admitted semantic assertion: each cited source-native object identifies the system record used for a product, item, good, service, or offering. It is a *bounded* core:

- It does **not** admit source-native object names or boundaries from the five evidence cells. They prove purpose but remain system scoped.
- It does **not** assert that the five systems share identical product states or transitions. `statesTransitions` is the relation's differing dimension: positive cells remain system variants and ambiguous cells remain unresolved.
- It is never derived from majority count or frequency. A supported cell in any other row is a system variant whether or not four or five systems happen to evidence it. Frequency is evidence that a source state is common; it is never a promotion input.
- No source-native name, object boundary, field, route, state, transition, policy, or process enters the common core silently. Only the matching purpose projection is admitted, and the basis is recorded (`SINGLE_REVIEWED_VARIANT_RELATION_NOT_FREQUENCY`).

## Frozen result

| Classification | Count | Application meaning |
|---|---:|---|
| Core | 5 | Evidence bindings for the single shared-purpose assertion: the five `objects-roles` cells cited by the relation's matching `purpose` dimension. Source-native names and boundaries are evidence only, not core semantics. |
| Optional feature | 0 | No reviewed positive relation supports a cross-system optional feature. |
| System variant | 46 | A source-native positive element not admitted as matching-purpose evidence. This includes all three positive states-transitions cells and the three api-service-exposure supports. |
| Process variant | 0 | No Product relation was positively reviewed as a process variant. |
| Absence | 3 | Exact bounded source absence; never synthesize a field, route, state, transition, or policy to fill it. |
| Unresolved conflict | 6 | Two differing states-transitions cells, one api-service-exposure cell, and three absence-ambiguity-conflict cells are ambiguous; preserve the limitation and counterevidence. |

The two denied relations are `api-service-exposure` and `absence-ambiguity-conflict`. The other nine relations are unresolved: `objects-roles`, `relations`, `operations`, `inputs-outputs`, `events`, `preconditions`, `invariants`, `exceptions-errors`, and `readbacks`. The single positive relation is `states-transitions` (VARIANT_RELATION). Its use of `objects-roles` evidence for matching purpose does not promote the separately reviewed and unresolved `objects-roles` relation.

## Reading the candidate

Each of the 12 `analyses` preserves the released relation state and reason. Each of its five `elements` binds:

1. classification, classification basis, reviewed matching/differing role where applicable, and released source state;
2. system ID, question ID, cell digest, and source-profile digest;
3. every referenced fact ID and fact digest;
4. the exact source-native claim;
5. original locator and excerpt digest; and
6. explicit counterevidence for every absence, ambiguity, or conflict.

The single `promotedRelations` entry documents the candidate-level promotion. Its matching entry binds `purpose` to the five `objects-roles` core evidence element IDs and its differing entry binds `statesTransitions` to three system-variant IDs plus two unresolved IDs. `commonCore` contains only the five matching-purpose evidence IDs. `commonCoreSemantics` carries the sole admitted assertion and explicitly excludes source-native object names and boundaries, fields, routes, states, transitions, policies, and processes.

## Application procedure

1. Verify the exact release SHA, matrix digest, relation-spec bytes digest, and canonical relation-spec digest before reading any candidate element.
2. Select by `questionId` and exact `systemId`; caller labels and claimed frequency never select or upgrade an element.
3. For a `CORE` element (an `objects-roles` cell cited by the matching purpose dimension), apply only `commonCoreSemantics.semanticAssertion`. Treat its source fact as evidence, not permission to generalize its native name, object boundary, field, route, state, transition, or policy.
4. For a `SYSTEM_VARIANT`, replay the bound cell, fact digest, locator, and excerpt digest. Keep source-native terminology and semantics. A supported cell is a variant whether or not it is frequent.
5. For an `ABSENCE`, retain the negative boundary and counterevidence. Do not infer an equivalent API, route, workflow state, transition, or policy.
6. For an `UNRESOLVED_CONFLICT`, surface the unresolved reason and all counterevidence. Do not choose a preferred meaning.
7. Reject extra fields, caller verdicts, majority/frequency arguments, altered digests, external system material, or Authority claims.
8. Produce readback evidence containing the candidate ID, matrix digest, question/system pair, cell digest, fact digest, exact locator, excerpt digest, classification, and counterevidence where applicable.

## Evidence expectations

A conforming readback is evidence of applying this guide only when all lineage fields replay exactly and the emitted classification equals the source-state and reviewed-dimension-role mapping. Missing or changed lineage is a denial, not a gap that may be repaired by naming similarity or frequency. A readback claiming a `CORE` element outside the five matching-purpose `objects-roles` evidence cells — or admitting any differing states-transitions fact into core semantics — is nonconforming. The common core asserts only the shared purpose of the single reviewed states-transitions VARIANT_RELATION; it does not assert cross-system identity of object boundaries, product states, transitions, fields, or policies.

## Independent replay

`tests/cscl-09/product-candidate-independent-oracle.mjs` is an independently implemented source oracle: it does not import `src/cscl-09/product-candidate.mjs`. From the exact released matrix and relation-spec bytes it separately derives all 12 relation results, all 60 classifications, and all 60 original-evidence edges. `verification/cscl-09-product-candidate-independent-replay-v1.json` freezes its replay digests and exact 12/60/60 denominator. The focused command `node --test tests/cscl-09/product-candidate.test.mjs` binds that receipt, proves caller labels and frequencies are unused, and proves direct candidate classification or evidence substitutions are denied independently of the production derivation.

## Future validation boundary

Future isolated validation may consume this frozen non-authoritative candidate by exact digest. It must not modify the candidate, reveal external (holdout) semantics before the declared gate, or reinterpret absence/unresolved evidence as success. The candidate's nonclaim is **no authoritative or further promotion claim**: this is coherent with the bounded candidate-level matching-purpose promotion already recorded. Any authoritative promotion, or later promotion of a further relation, object, operation, state, or process, requires separate released evidence and Authority.