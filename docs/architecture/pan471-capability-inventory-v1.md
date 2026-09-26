# PAN471 — read-only capability inventory (architecture, v1)

Bounded first slice. Acceptance class CODE_CHANGE (tool-only portions TOOLING), priority p1.

## Purpose

Compose the EXISTING bounded order/customer handoff (`src/ks238/order-source-handoff.mjs`)
and the capability/module contracts (`capability-catalogue` + `erp-order-capability-cell`,
driven through the released reader surface) into a useful, READ-ONLY inventory of
capabilities, ownership and missing semantics.

It is synthetic and read-only: it drives the ACTUAL released entry points and emits no
writes, no capability activation/execution, no production/customer/host data, and no
credentials. Missing quantity, unit, price and business rule stay `UNAVAILABLE` (never
inferred). Observations, inferred relations and confirmed decisions remain separate.
Denied visibility is retained (not deleted) and is not complete coverage.

## Entry point

`src/pan471/capability-inventory.mjs`

- `createPan471CapabilityInventory({ contract, sourceBytes, sourceLabel, catalogue, profiles, now })`
  — the public read-only entry point. It owns the actual reader execution through the
  released ks238 handoff entry point (`createKs238OrderSourceHandoff`) against
  independently selected source bytes/contract/time, then composes the released catalogue
  (`listCapabilityCatalogueV1`) and capability-cell projections
  (`syntheticErpOrderProfilesV1` / `evaluateErpOrderProfileV1`) into a bound, read-only
  capability inventory.
- `rebindPan471Inventory({ sourceLabel, sourceBytes, sourceBytesSha256, contract, catalogue, profiles, now, inventoryBinding, bindingDigest })`
  — mandatory content-bound re-binding after serialization (anti-substitution).

## Composed surface (released, not reimplemented)

- `src/ks238/order-source-handoff.mjs` → `createKs238OrderSourceHandoff` (executes the
  released order + drained customer readers), `KS238_SOURCE_LABEL_V1`, `KS238_SUPPORTED_FACTS_V1`,
  `KS238_UNSUPPORTED_FACTS_V1`, `KS238_MISSING_FIELDS_V1`.
- `dist/packages/contracts/src/index.js` → `verifyErpReadConnectorContractV1`,
  `listCapabilityCatalogueV1`, `syntheticCapabilityCatalogueV1`, `syntheticErpOrderProfilesV1`,
  `evaluateErpOrderProfileV1`, `canonicalJson`, `ERP_ORDER_SEMANTICS_V1`.

## Capability classes (closed)

`ORDER_SOURCE_READ`, `CUSTOMER_SOURCE_READ`, `ERP_ORDER_CREATE`, `CRM_CONTACT_CREATE`,
`EMPLOYEE_DIRECTORY_READ_OWN`.

Availability: `AVAILABLE`, `UNAVAILABLE`, `DENIED`, `NOT_COVERED`.
Ownership: `RELEASED_CONTRACT`, `RELEASED_READER`, `CAPABILITY_CATALOGUE`, `CAPABILITY_CELL`, `HANDOFF`.

In this bounded slice: the order + customer reads are `AVAILABLE` (owned by the released
reader); `ERP_ORDER_CREATE` is `UNAVAILABLE` (owned by the capability cell — the order source
exposes no quantity/unit, so a create request cannot be evidenced); `CRM_CONTACT_CREATE` and
`EMPLOYEE_DIRECTORY_READ_OWN` are `NOT_COVERED` (catalogue-listed, no source bound).

## Anti-substitution / binding

The inventory is BOUND to a source identity (`sourceLabel` + `sourceBytesSha256` +
`sourceDigest`) and tenant. A wrong-tenant source is refused as a semantic `TENANT_MISMATCH`
(the released reader lumps a source/contract tenant mismatch under `SOURCE_MALFORMED`, so the
semantic refusal is surfaced by comparing the source bytes' declared tenant to the contract's
tenant before any fact is emitted). A substituted source is refused with
`SERIALIZED_BINDING_MISMATCH` on rebind: the released handoff reader is re-executed against the
carried bytes/contract/time and the freshly derived binding must match the carried digest.

## AC coverage

- **MIG-01-AC01** — normal read-only entry point with source/tenant/revision binding; wrong
  tenant (`TENANT_MISMATCH`) and substituted source (`SERIALIZED_BINDING_MISMATCH`) refused.
- **MIG-01-AC02** — missing quantity/unit/price/business rule stays `UNAVAILABLE` (never
  inferred); observations, inferred relations and confirmed decisions remain separate.
- **MIG-01-AC03** — dependencies and responsible open questions are shown; denied visibility
  (`NOT_COVERED`) is retained (not deletion) and is not complete coverage.

## Non-claims

Read-only inventory: no capability activation, execution, write, mutation or rollback. Missing
quantity, unit, amount and business rule remain `UNAVAILABLE` (never inferred). `NOT_COVERED` /
`DENIED` capabilities are retained (denied visibility is not deletion) and do not imply complete
coverage. Synthetic local evidence only: no production/customer/host data, no credentials, no
real external effects.
