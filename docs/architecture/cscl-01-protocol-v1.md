# CSCL-01 comparison protocol v1

Status: **frozen admission contract** for issues #318 / #317. This document and the committed fixtures govern all later CSCL workers. They grant no truth, promotion, execution, write, or business authority.

## Boundary and nonclaims

This admission run inspected only official repository/release/documentation identity, immutable selectors, license/notice material, and protocol mechanics. It did **not** inspect or extract ERP business objects, modules, fields, workflows, APIs, or implementation semantics. iDempiere semantics remain isolated until all three training candidates are byte-frozen. No candidate, common core, production fitness, compatibility, procurement, or customer-fit claim is made.

## Frozen systems and legal identities

| Role | System | Version selector | Immutable identity | License |
|---|---|---|---|---|
| Training | Odoo Community | protected `19.0` | `1eb4fcdf08ddbc1341bdc8cb8129906722f54bdc` | `LGPL-3.0-only`; exact pinned LICENSE and COPYRIGHT bytes |
| Training | ERPNext | `v16.33.0` | `b24c9eba551905e256e336ff170a91a92d197a2f` | `GPL-3.0-only`; exact pinned license and project metadata bytes |
| Training | Dolibarr | tag `24.0.0` | tag object `5dd1b29feb8014839b54bb0f48d988eeac3c61dd`; peeled commit `769c7db907099643558e77d7002c109cfda919e5` | `GPL-3.0-or-later`; exact pinned COPYING and COPYRIGHT bytes |
| Training | Tryton | official 8.0 signed artifacts | `trytond-8.0.9`, `trytond_party-8.0.3`, `trytond_product-8.0.1`, `trytond_sale-8.0.3`, each with exact SHA-256, byte length, and detached-signature identity | `GPL-3.0-or-later`; exact LICENSE/COPYRIGHT members from the signed official `trytond` archive |
| Training | Apache OFBiz | tag `release24.09.07` | tag object `12b6d40382ac38d3252df78781f9877d46f5f9f7`; peeled commit `42819e5ae1d5339d3a204ac06b43e69d46a9c0ae` | `Apache-2.0`; exact pinned LICENSE and NOTICE bytes |
| Holdout | iDempiere | protected `release-13` / 13 Orion LTS | `731515dcdd5278b843db33b9d3109d155b881951` | `GPL-2.0-or-later`; exact pinned `LICENSE.md`; no repository NOTICE identified, so file-level notices must be retained if present; README is separately typed project metadata |

The complete URLs, byte lengths, hashes, obligations, and Tryton artifact signatures are normative in `tests/fixtures/cscl-01/source-selector-set-v1.json`. A moving branch name is never sufficient: branch-based products are bound to the recorded commit. Annotated tags retain both tag object and peeled commit. The official Tryton code service required login during preflight, so only anonymous official `downloads.tryton.org/8.0` versioned signed artifacts are admitted; GitHub mirrors are forbidden even if content or labels appear equivalent.

## Exact-byte capture rule

A later source fact is admissible only when it binds the frozen selector-set digest, immutable selector, exact source-byte SHA-256, byte range/locator, excerpt digest, parser version, canonicalizer version, exact legal identity, and obligations. Moving aliases, copied legal bytes at another URL, mirror substitution, license/version drift, parser drift, and history rewriting fail closed. CSCL-01 does not download or admit semantic source subsets.

## Frozen families and source-native questions

The only families are:

1. `PARTY_CUSTOMER_MANAGEMENT`
2. `PRODUCT_ITEM_MANAGEMENT`
3. `SALES_ORDER_MANAGEMENT`

Every system-profile worker answers the twelve frozen question kinds in `question-inventory-v1.json`: objects/roles, relations, operations, inputs/outputs, states/transitions, events, preconditions, invariants, exceptions/errors, readbacks, API/service exposure, and absence/ambiguity/conflict. Answers must preserve **source-native terminology and meaning** with exact native evidence. A profile cannot emit caller-normalized or common-core vocabulary. Cross-system concepts are derived only in CSCL-07 and later.

## Closed records and separation

The eight draft-2020-12 schemas are closed at the top level and at nested records:

- Source Fact: immutable source/legal/parser evidence only.
- System Profile: source-native terminology and cell references; role/isolation pairing is conditional.
- Evidence Cell: exactly one closed state: `SUPPORTED`, `VARIANT`, `ABSENT`, `AMBIGUOUS`, `CONFLICTING`, or `UNMAPPED`.
- Semantic Concept: verifier-derived core classification plus explicit variants, absences, ambiguities, and counterexamples.
- Process Pattern Candidate and Capability Candidate: frozen non-authoritative candidate records.
- Mapping Receipt: holdout-to-frozen-candidate mappings and complete recomputed denominators.
- Holdout Verdict: one-family or complete three-family verdict only.

No record grants Authority. Hidden authority, promotion, execution, or extra fields are schema-invalid.

## Equivalence and candidate freeze

A common-core element requires all of the following:

- complete cells from exactly all five training systems;
- exact evidence in every cell;
- meaning-equivalence proof in at least 4 of 5 systems;
- zero unresolved conflicting counterexample;
- complete explicit negative evidence where absent or conflicting.

Frequency, labels, spelling, names, lexical similarity, and structural shape alone never qualify. Equivalence is derived from trusted meaning-proof digests, not a caller boolean or classification label. All non-core behavior remains an explicit variant/absence/ambiguity/counterexample.

Candidate bytes use deterministic sorted-key UTF-8 canonical JSON and SHA-256. The verifier strips and re-derives caller digest fields. Candidate bytes freeze before any holdout semantic capture and cannot be edited afterward.

## Holdout and verdict protocol

For each family, iDempiere `GO` requires:

- 100% frozen core identity and meaning preserved;
- zero core contradiction;
- at least 80% of applicable holdout semantics mapped to frozen core or declared variants;
- at most 20% unmapped;
- complete, internally recomputed denominators;
- all source, legal, history, integrity, denominator, and isolation gates green.

`mappedToCore + mappedToVariant + unmapped` must equal `applicable`; mapping and extension identifiers are unique and counted once; `coreIdentityPreserved <= coreTotal`. A core/variant row requires a non-null candidate element and preserved meaning. An unmapped row requires null candidate element and false preservation. Holdout additions are reported only as `HOLDOUT_EXTENSION_ONLY` and never mutate candidate bytes.

“No fundamental rewrite” means zero frozen-core deletion, rename, or semantic mutation. Any such rewrite, contradiction, byte mutation, denominator inconsistency, or hard-gate failure yields `FALSIFIED_WITH_EVIDENCE` for the family.

Overall: three family passes = `GO`; one or two passes with every governance gate green = `NARROW_GO`; otherwise = `FALSIFIED_WITH_EVIDENCE`. Overall computation requires exactly the three distinct frozen families and ignores caller verdict/ratio labels.

## One-writer leases

The deterministic decision fixture freezes one writer per future output prefix:

- CSCL-02..06: `evidence/cscl-02/odoo-community/`, `evidence/cscl-03/erpnext/`, `evidence/cscl-04/dolibarr/`, `evidence/cscl-05/tryton/`, `evidence/cscl-06/apache-ofbiz/`.
- CSCL-08..10: `evidence/cscl-08/party-customer-management/`, `evidence/cscl-09/product-item-management/`, `evidence/cscl-10/sales-order-management/`.

Cross-lease writes are forbidden. Workers consume the committed selector, question, rule, schema, and protocol digests and must not accept caller replacements.

## Determinism and adversarial contract

`freezeProtocol()` derives expected digests only from committed fixtures. Caller expected digests, labels, and verdicts are ignored. Two replays must be byte-identical. Tests deny extra fields, lexical collision, frequency majority, missing fifth cell, omitted negative evidence, paired substitution/re-digestion, source/version/license drift, moving-only identities, history rewrite, holdout leakage, candidate mutation, duplicate/inconsistent mappings, incomplete family denominators, and hidden authority/promotion/execution fields.
