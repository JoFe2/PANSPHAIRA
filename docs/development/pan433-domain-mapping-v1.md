# PAN433 domain-mapping convention v1

Status: local synthetic acceptance on branch `feat/domain433-alternate`; this document does not claim ERP interoperability, production readiness, provider execution, publication, or issue closure.

## Purpose and meaning

PAN433 is a thin, read-only boundary for accepting two explicitly versioned storage layouts into the already released procurement invoice fact consumer. It establishes a mapping convention, not a new business core and not a universal ontology. The business meaning is the released invoice fact: invoice identity, order identity, customer identity, lifecycle status, issue/due dates, gross EUR minor amount, and currency. The two storage layouts are only source representations of those facts.

The default layout is `pan433.storage/invoice-row/v1` (`DEFAULT_INVOICE_ROW`). The alternate layout is `pan433.storage/invoice-document/v2` (`ALTERNATE_INVOICE_DOCUMENT`). They have different field paths and source schemas but converge on the same target `chimpmaera.connector/erp-read/v1`. The real PAN433 entry point then executes the released M0 `applyFachprofilToErpReadInvoiceV1` core and hands the same source-bound invoice identity/amount to the existing `procurement-434` PO -> goods-receipt -> ERP-reader -> three-way invoice-reconciliation consumer. The alternate is approved in the bounded PAN433 surface; it does not modify or broaden `fachprofil-mapping-v1.ts`, whose frozen M0 identity remains authoritative. Mapping-only output is not an accepted business result.

## Prerequisites and source authority

A source must be a plain object with the exact profile-owned schema, source-system identity, non-empty dataset identity, one record, closed fields, and a digest over the canonical source content excluding `sourceDigest`. Synthetic source systems are `PAN433_DEFAULT_SYNTHETIC` and `PAN433_ALTERNATE_SYNTHETIC`; their fixtures are not ERP captures.

The code-owned profiles are the only approved semantic identities. A profile must be structurally valid, self-sealed, and byte-equivalent to one of the two exported approved profiles. The complete approval graph is runtime deep-frozen; exported references cannot mutate the authority that `isApprovedPan433MappingProfileV1` compares. Rehashing a changed caller profile does not grant approval. Source digests bind source bytes and are checked before field mapping. Unknown fields, unsupported versions, duplicate records, missing semantic identities, impossible calendar dates, reversed dates, malformed full UTC metadata timestamps (exact `YYYY-MM-DDTHH:mm:ssZ`), non-EUR currency, negative/non-integer minor amounts, and tampered bytes fail closed.

Source systems own source facts. PAN433 owns only the explicit field correspondence and admission decision. It does not infer customer identity, quantity, unit, currency conversion, tax meaning, or missing values. The reused core owns downstream invoice-fact semantics and declared losses; PAN433 preserves the core result rather than rewriting it.

## State ownership and effects

PAN433 has no productive state. It reads a supplied local source artifact, runs the existing procurement-434 local PO/receipt/reader path, and emits either an accepted `RECHNUNGSABGLEICH_MATCH`/`MATCHED` business result or a deterministic denial. A source mapping that cannot be closed to the downstream reader facts is denied. It performs no network access, provider call, ERP write, booking, mutation, credential use, runtime/controller change, or publication. The profile effect declaration is `reads: true`, `writes: false`, `authority: NONE`. The downstream released core remains authority-none for this path.

## I/O guarantees

Accepted output contains the selected profile identity, layout, source dataset/digest, the normalized invoice facts, the released M0 result (including declared loss codes), and the existing procurement-434 result with its sealed evidence, quantity reconciliation, and non-productive authority. Denials contain a stable code and bounded detail; no partial mapped invoice is emitted. The CLI `src/pan433/domain-mapping-cli.mjs` is the real local entry point and exits 0 only for the accepted downstream business result, 1 for a semantic/mapping/downstream denial, and 2 for usage or unreadable JSON errors. For example, a mutated downstream invoice line is preserved as `DOWNSTREAM_CONSUMER_DENIED` with the canonical business failure `MATCH_INVOICE_LINE_SEAL_BROKEN`.

The fixtures intentionally use the same synthetic invoice facts in different layouts so equivalence is a supported business-result property of these two profiles: both reach `THREE_WAY_INVOICE_PO_RECEIPT_V1` with `MATCHED`, 2400 EUR minor and ordered/received/invoiced quantity 2. This is not evidence of real ERP interoperability. PAN433 does not claim quantity/unit support from the M0 mapping fragment; the M0 losses remain explicit, while procurement-434 supplies and independently verifies the purchase-side quantity/unit evidence.

## Versions, effects, and migration

| Identity | Version | Role | Compatibility |
|---|---:|---|---|
| `pan433.domain-mapping/v1` | 1 | bounded mapping contract | additive PAN433 surface |
| `pan433.storage/invoice-row/v1` | 1.0.0 | default source | direct |
| `pan433.storage/invoice-document/v2` | 2.0.0 | alternate source | direct |
| `chimpmaera.connector/erp-read/v1` | 1.0.0 | shared target fact shape | released target |
| `pan433:default-invoice-row-to-erp-invoice/v1` | 1.0.0 | code-owned profile | approved |
| `pan433:alternate-invoice-document-to-erp-invoice/v1` | 1.0.0 | code-owned profile | approved |

This implementation reuses the released `fachprofil-mapping-v1.ts` M0 contract and `procurement-434` contribution/dependency convention. It extends only the PAN433 adapter boundary; it does not edit KTS432, PAN432, prior candidates, provider/runtime/controller code, or the released M0 mapping identity. The module-contribution catalog records the direct semantic dependency and focused tests. Integrity migration updates the public-file manifest, checksum ledger, verification DAG, and canonical inventory as ordinary local repository artifacts.

## Acceptance gates

Focused: `npm run pan433:mapping:test` (build, 18 tests; includes both CLI positives, both actual procurement-434 business connections, the canonical downstream denial, declared-path resolution, impossible-date/full-timestamp negatives, and runtime approval immutability).

Contribution: `npm run module:check`, `node scripts/module-contribution.mjs impact --base d47884f8c1b066916fe8379c19eb8f941dce1093`, and `npm run module:test -- --base d47884f8c1b066916fe8379c19eb8f941dce1093` after reviewing selected tests.

Canonical: `npm test` (including the registered PAN433 regression suite), `npm run lint`, `node --test dist/tests/canonical-json-profile-inventory.test.js`, and `node --test tests/canonical-json-runtime-parity.test.mjs`. The initial isolated-worker full run encountered missing Docker and temporary-space exhaustion. Parent integration recovered those environment failures and passed the full repository lifecycle; worker-local failures do not waive canonical checks. CI remains required at the exact publication candidate, followed by Main CI and governed release readback.
