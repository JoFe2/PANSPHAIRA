# CSCL-09 Product / Item Management Mapping and Application Guide v1

Status: **frozen non-authoritative candidate promoting exactly one reviewed states-transitions VARIANT_RELATION** into a bounded common core.

## Authority and boundary

This guide applies only to `PRODUCT_ITEM_MANAGEMENT` from CSCL-07 release `2026_08_31_v4` at `27488888a35fc59caa51bff12fb4ba8c0f28c31d`, matrix digest `d68dff995ab03e426302f593a5f73e10ffa886040217b7355e310878aa957d8d`. The complete Product denominator is 12 rows, 60 source cells, five training systems, and 12 reviewed relations.

The Product family carries exactly one positive reviewed relation in the full 36-row matrix: the **states-transitions VARIANT_RELATION** (shared `purpose`, differing `statesTransitions`). The remaining 11 relations are **9 UNRESOLVED and 2 DENIED**. Promotion is applied to that single reviewed relation and only to it. Its three positively-evidenced cells (`dolibarr`, `tryton`, `apache-ofbiz`) form the bounded common core; its two ambiguous cells remain unresolved. The other 48 supported source-native elements are **not** promoted from frequency and stay system variants. It makes no universal ERP, compatibility, execution, production-fitness, or Authority claim.

## What promotion means and what it does not mean

The common core is populated **only** by the cells of the single reviewed states-transitions VARIANT_RELATION whose released source state is positive (SUPPORTED or VARIANT). It is a *bounded* core:

- It does **not** assert that the five systems share identical product states or transitions. `statesTransitions` is the relation's differing dimension and remains a system variant; the core asserts the shared purpose only.
- It is never derived from majority count or frequency. A supported cell in any other row is a system variant whether or not four or five systems happen to evidence it. Frequency is evidence that a source state is common; it is never a promotion input.
- No field, route, policy, or process enters the common core silently. Only the explicitly reviewed relation is promoted, and the basis is recorded (`SINGLE_REVIEWED_VARIANT_RELATION_NOT_FREQUENCY`).

## Frozen result

| Classification | Count | Application meaning |
|---|---:|---|
| Core | 3 | Bounded common core: the positively-evidenced cells of the single states-transitions VARIANT_RELATION (dolibarr, tryton, apache-ofbiz). Usable only as the shared-purpose lifecycle reading for that dimension, not as identical states. |
| Optional feature | 0 | No reviewed positive relation supports a cross-system optional feature. |
| System variant | 48 | A source-native supported element (including the 3 api-service-exposure supports and all supported cells outside the promoted row), usable only with its system, cell digest, fact digest, and exact original evidence. |
| Process variant | 0 | No Product relation was positively reviewed as a process variant. |
| Absence | 3 | Exact bounded source absence; never synthesize a field, route, state, transition, or policy to fill it. |
| Unresolved conflict | 6 | Two states-transitions ambiguous cells, one api-service-exposure ambiguous cell, and three absence-ambiguity-conflict ambiguous cells; preserve the limitation and counterevidence. |

The two denied dimensions are `api-service-exposure` and `absence-ambiguity-conflict`. The other nine dimensions are unresolved: `objects-roles`, `relations`, `operations`, `inputs-outputs`, `events`, `preconditions`, `invariants`, `exceptions-errors`, and `readbacks`. The one positive dimension is `states-transitions` (VARIANT_RELATION), and it is the only reviewed relation that is promoted.

## Reading the candidate

Each of the 12 `analyses` preserves the released relation state and reason. Each of its five `elements` binds:

1. classification and released source state;
2. system ID, question ID, cell digest, and source-profile digest;
3. every referenced fact ID and fact digest;
4. the exact source-native claim;
5. original locator and excerpt digest; and
6. explicit counterevidence for every absence, ambiguity, or conflict.

The single `promotedRelations` entry documents the promotion: its `relationId`, `questionId` (`states-transitions`), `relationState` (`VARIANT_RELATION`), the `promotionBasis` (`SINGLE_REVIEWED_VARIANT_RELATION_NOT_FREQUENCY`), the matching dimension (`purpose`), the differing dimension (`statesTransitions`), the `coreElementIds`, and the released relation `reason`. `commonCore` equals that `coreElementIds` list.

## Application procedure

1. Verify the exact release SHA and canonical matrix digest before reading any candidate element.
2. Select by `questionId` and exact `systemId`; caller labels and claimed frequency never select or upgrade an element.
3. For a `CORE` element (a states-transitions cell of the promoted relation), apply it as the shared-purpose lifecycle reading for `PRODUCT_ITEM_MANAGEMENT` and keep the differing `statesTransitions` dimension explicit and system-scoped; do not generalize it to identical states across systems.
4. For a `SYSTEM_VARIANT`, replay the bound cell, fact digest, locator, and excerpt digest. Keep source-native terminology and semantics. A supported cell is a variant whether or not it is frequent.
5. For an `ABSENCE`, retain the negative boundary and counterevidence. Do not infer an equivalent API, route, workflow state, transition, or policy.
6. For an `UNRESOLVED_CONFLICT`, surface the unresolved reason and all counterevidence. Do not choose a preferred meaning.
7. Reject extra fields, caller verdicts, majority/frequency arguments, altered digests, external system material, or Authority claims.
8. Produce readback evidence containing the candidate ID, matrix digest, question/system pair, cell digest, fact digest, exact locator, excerpt digest, classification, and counterevidence where applicable.

## Evidence expectations

A conforming readback is evidence of applying this guide only when all lineage fields replay exactly and the emitted classification equals the released source state mapping. Missing or changed lineage is a denial, not a gap that may be repaired by naming similarity or frequency. A readback claiming a `CORE` element for any question other than the promoted states-transitions relation — or claiming a core element derived from frequency, a caller label, or an extra matrix field — is nonconforming. The common core asserts only the shared purpose of the single reviewed states-transitions VARIANT_RELATION; it does not assert cross-system identity of product states or transitions.

## Future validation boundary

Future isolated validation may consume this frozen non-authoritative candidate by exact digest. It must not modify the candidate, reveal external (holdout) semantics before the declared gate, or reinterpret absence/unresolved evidence as success. Any later promotion of a further relation, object, operation, state, or process requires separate released evidence and Authority.