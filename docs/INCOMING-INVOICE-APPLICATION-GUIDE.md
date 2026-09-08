# Incoming-invoice Application Guide v1

This guide documents the local synthetic AP-05 adaptive UI contract. It is a
deterministic manifest projection over the AP-01 scenario and AP-04 ERV
evidence state; it is not a frontend or a requirements authority.

## Applicability

- Local synthetic incoming-invoice ERV evidence only.
- Versioned AP-04 matching and tolerance variants.
- Read-only inspection and local proof recording under
  `LOCAL_SYNTHETIC_PROOF`.

## Variants

| Scenario | Selection | Existing process variant |
| --- | --- | --- |
| `LEAN` | AP-01 low-complexity scenario | `TWO_WAY_INVOICE_PO_V1` |
| `CONTROLLED` | AP-01 controlled scenario | `THREE_WAY_INVOICE_PO_RECEIPT_V1` |
| `SEGREGATED_ENTERPRISE` | AP-01 segregation-required scenario | `THREE_WAY_INVOICE_PO_RECEIPT_V1` |

The manifest always exposes evidence references and status. Receipt,
tolerance, approval-trail and separation-of-duties fields are exposed only
when the selected scenario/evidence requires them. A changed requirement with
separate approval above EUR 10,000 selects `SEGREGATED_ENTERPRISE`; the setup
delta records that threshold and scenario change explicitly. Actions are
derived from the ERV outcome; an unverified or incomplete reference never enables
match acknowledgement.

## Limits and nonclaims

- Missing required context, unknown variants and hidden authority fail closed.
- The setup dialogue may select or parameterize existing capability/process
  variants only; it cannot invent executable functions or grant authority.
- There is no production frontend, live ERP call, customer-data processing,
  productive posting/allocation, autonomous approval, or universal-adaptation
  claim.