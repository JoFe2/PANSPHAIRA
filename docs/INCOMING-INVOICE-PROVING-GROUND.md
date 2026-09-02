---
title: Incoming-invoice adaptability proving ground
description: Planned synthetic PoC for evidence-derived LEAN, CONTROLLED, and SEGREGATED_ENTERPRISE incoming-invoice processes.
---

# Incoming-invoice adaptability proving ground

`WORK_IN_PROGRESS_PLANNED_NOT_DELIVERED`

Public delivery is tracked by
[epic #360](https://github.com/JoFe2/PANSPHAIRA/issues/360) and sequential
issues [#361](https://github.com/JoFe2/PANSPHAIRA/issues/361),
[#362](https://github.com/JoFe2/PANSPHAIRA/issues/362),
[#363](https://github.com/JoFe2/PANSPHAIRA/issues/363),
[#364](https://github.com/JoFe2/PANSPHAIRA/issues/364),
[#365](https://github.com/JoFe2/PANSPHAIRA/issues/365), and
[#366](https://github.com/JoFe2/PANSPHAIRA/issues/366).

The incoming-invoice proving ground is designed to test whether one capability
model can derive different process depths from evidence, risk, approval,
Authority, and segregation requirements without treating company size as a
workflow rule.

## Intended effect

```text
Source
→ Document
→ Document-AI extraction
→ Validation
→ Supplier / PO / Receipt / Invoice matching
→ Exception and evidence-citing advisor dialogue
→ Adaptive UI
→ Receipt and evidence verdict
```

The process is parameterized through three scenario packs:

| Scenario | Intended use |
|---|---|
| `LEAN` | Minimum justified controls for a bounded, explainable flow |
| `CONTROLLED` | Matching, tolerances, exceptions, and stronger evidence requirements |
| `SEGREGATED_ENTERPRISE` | Separated roles, approvals, escalation, and audit evidence |

These are process-complexity vectors, not company-size stereotypes.

## Planned proof packages

1. **AP-01 — Blueprint and scenario vectors**
   Freeze eight layers from source to proof, actors, outcomes, risks,
   falsifiers, scope, and scenario derivation.
2. **AP-02 — Supplier-invoice intake**
   Bind synthetic source bytes, provenance, document version, digest, metadata,
   and supplier-invoice identity; deny duplicate, tampered, unsupported, and
   ambiguous documents.
3. **AP-03 — Document-AI benchmark**
   Compare a deterministic baseline and model proposal against a frozen
   synthetic holdout covering layouts, line items, taxes, totals, and failures.
4. **AP-04 — Validation, matching, and advisor**
   Keep supplier, purchase order, receipt, and invoice evidence distinct;
   version two-/three-way matching and tolerance variants; preserve exceptions
   and missing context.
5. **AP-05 — Adaptive UI and Application Guide**
   Derive fields and actions from scenario and evidence state while keeping all
   variants explainable and testable.
6. **AP-06 — End-to-end verdict**
   Exercise positive, duplicate, tamper, mismatch, `UNKNOWN`, cancellation, and
   replay cases and emit `GO`, `NARROW_GO`, or
   `FALSIFIED_WITH_EVIDENCE`.

## Current status

| Item | Current state |
|---|---|
| Work-package specifications | `6/6` planned |
| Acceptance identifiers | `28/28` preserved |
| Scenario packs | `3/3` defined |
| Public AP implementation issues | `6/6` open |
| Product implementation | Not started |
| Product release | None |

Preparation artifacts may contain Blueprints, pseudocode, tentative paths,
tests, gaps, and UNKNOWNs. They are not implementation or compatibility
evidence.

## Dependencies and promotion

The complete proof depends on separately evidenced Document/Version plus
Supplier, Purchase Order, Receipt, and Matching capabilities. Preparation may
proceed with named gaps; product promotion must revalidate current Main,
dependencies, sources, holdout boundaries, contracts, paths, and tests.

Any productive allocation or posting remains separately governed. The planned
PoC uses synthetic data and does not claim production accounts-payable fitness,
universal extraction quality, tax/accounting completeness, or autonomous
booking Authority.

Return to the [PanSphaira overview](../README.md#applications) or inspect the
[Capability Matrix](capabilities.md).
