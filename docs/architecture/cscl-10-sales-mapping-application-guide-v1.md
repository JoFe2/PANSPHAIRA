# CSCL-10 Sales Order Management Mapping and Application Guide v1

Status: **frozen non-authoritative candidate with an explicit empty common core and one source-bound variant relation**.

## Authority and boundary

This guide applies only to `SALES_ORDER_MANAGEMENT` from CSCL-07 release `2026_08_31_v4` at `27488888a35fc59caa51bff12fb4ba8c0f28c31d`, matrix digest `d68dff995ab03e426302f593a5f73e10ffa886040217b7355e310878aa957d8d`. The complete sales denominator is 12 rows, 60 source cells, five training systems, and 12 reviewed relations.

Of the two positive `VARIANT_RELATION` reviews in the full 36-review matrix, exactly one belongs to sales: **`states-transitions`**, reviewed as `FROZEN_EXACT_PURPOSE_AND_DIFFERING_OPERATIONAL_DIMENSION_EDGE` with supported dimensions `purpose` and `statesTransitions` over all five SUPPORTED source cells. The remaining eleven sales relations are **10 UNRESOLVED and 1 DENIED** (`absence-ambiguity-conflict`), and the complete evidence contains **zero `POTENTIAL_EQUIVALENCE` reviews**. Therefore the common core is empty: this candidate promotes no canonical object, operation, input/output, state, invariant, precondition, exception, readback, field, route, policy, or process into a common core. The reviewed variant relation is surfaced as a source-bound relation variant only; a variant relation is not an equivalence and never promotes a core element. This candidate makes no universal ERP, compatibility, execution, promotion, production-fitness, or Authority claim.

## Frozen result

| Classification | Count | Application meaning |
|---|---:|---|
| Core | 0 | Empty common core; nothing may be implemented as cross-system semantics from this candidate. |
| Optional feature | 0 | No reviewed positive relation supports a cross-system optional feature. |
| System variant | 53 | A source-native supported element, usable only with its system, cell digest, fact digest, and exact original evidence. |
| Process variant | 0 | No sales relation was positively reviewed as a process variant. |
| Absence | 1 | Exact bounded source absence (Tryton, `absence-ambiguity-conflict`); never synthesize a field, route, state, transition, or policy to fill it. |
| Unresolved conflict | 6 | Four ambiguous and two conflicting source elements; preserve the limitation and counterevidence. |

The one reviewed variant relation is `states-transitions` (relation ID `relation:SALES_ORDER_MANAGEMENT:states-transitions`). It records that all five systems share the same purpose while differing on the frozen operational dimension edge; it must be replayed per system with its bound cell digests, fact digests, locators, and excerpt digests. The denied dimension is `absence-ambiguity-conflict`. The other ten dimensions are unresolved: `objects-roles`, `relations`, `operations`, `inputs-outputs`, `events`, `preconditions`, `invariants`, `exceptions-errors`, `readbacks`, and `api-service-exposure`.

## Reading the candidate

Each of the 12 `analyses` preserves the released relation state and reason. Each of its five `elements` binds:

1. classification and released source state;
2. system ID, question ID, cell digest, and source-profile digest;
3. every referenced fact ID and fact digest;
4. the exact source-native claim;
5. original locator and excerpt digest; and
6. explicit counterevidence for every absence, ambiguity, or conflict.

`promotedVariantRelations` contains exactly one entry and preserves the full reviewed relation: relation ID, question ID, state, frozen reason, supported dimensions, and all five cell references with their source cell/profile digests, fact IDs, and original evidence references. This provides source-bound descriptions of objects/roles, relations, operations, inputs/outputs, order lifecycle states and transitions, events, preconditions, invariants, exceptions/errors, readbacks, and service exposure. Those descriptions remain variants or limits; they are not canonical interfaces.

## Application procedure

1. Verify the exact release SHA and canonical matrix digest before reading any candidate element.
2. Select by `questionId` and exact `systemId`; caller labels and claimed frequency never select or upgrade an element.
3. For a `SYSTEM_VARIANT`, replay the bound cell, fact digest, locator, and excerpt digest. Keep source-native terminology and semantics.
4. For the reviewed `states-transitions` variant relation, apply it per system only through `promotedVariantRelations`: replay each of the five cell references with its exact original evidence. Never generalize the shared purpose into a cross-system canonical lifecycle, and never drop the differing operational dimension.
5. For an `ABSENCE`, retain the negative boundary and counterevidence. Do not infer an equivalent API, route, workflow state, transition, or policy.
6. For an `UNRESOLVED_CONFLICT`, surface the unresolved reason and all counterevidence. Do not choose a preferred meaning.
7. Reject extra fields, caller verdicts, majority/frequency arguments, altered digests, external system material, or Authority claims.
8. Produce readback evidence containing the candidate ID, matrix digest, question/system pair, cell digest, fact digest, exact locator, excerpt digest, classification, and counterevidence where applicable.

## Evidence expectations

A conforming readback is evidence of applying this guide only when all lineage fields replay exactly and the emitted classification equals the released source state mapping. Missing or changed lineage is a denial, not a gap that may be repaired by naming similarity or frequency. Since the common core is empty, a readback claiming any promoted canonical field, route, lifecycle state, operation, policy, or cross-system process is nonconforming. A readback of the `states-transitions` variant relation is conforming only when it names the relation ID, the frozen reason, both supported dimensions, and all five source-bound cell references with their exact original evidence.

## Future validation boundary

Future isolated validation may consume this frozen candidate by exact digest. It must not modify the candidate, reveal external semantics before the declared gate, or reinterpret absence/unresolved evidence as success. The single variant relation remains a variant until separately released evidence and Authority establish otherwise; any later promotion requires its own released evidence and never follows from frequency, shared naming, or caller labels.