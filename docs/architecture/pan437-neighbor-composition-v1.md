# PAN437 — bounded order-to-complaint composition

Status: `LOCAL_SYNTHETIC_ORDER_BINDING_IMPLEMENTED`

The existing complaint lifecycle in `src/cscl-13/complaint.mjs` remains the only user path. The narrow neighbor boundary is `src/cscl-13/pan437-neighbor.mjs`; it binds the existing order reader to independently supplied, explicitly labelled synthetic delivery references without creating delivery facts.

## Reused actual module

The applicable existing order-side module is `packages/contracts/src/erp-read-connector.ts`, contract `chimpmaera.connector/erp-read/v1`, consumed through `createErpReadAdapterV1`. `readErpOrdersFromLabelledSourceBytesV1()` is a narrow source-byte entry point over that adapter: it requires the exact `LOCAL_SYNTHETIC_ERP_ORDER_SOURCE_V1` label, parses the bytes, executes paginated `LIST_ORDERS`, preserves the reader's source digest, and records the exact source-byte SHA-256. The result proves only order/customer records and reader metadata.

`erp-order-capability-cell.ts` remains an order-creation/readback/rollback capability cell with `network: DISABLED` and `SYNTHETIC_MEMORY_ONLY`; it is not a delivery output and is not used as one. Qwen procurement ownership and all older candidates remain outside this path.

## Boundary and evidence split

`bindOrderReadToComplaintReferences()` validates the existing delivery-reference fixture, requires its explicit `SYNTHETIC_DELIVERY` lineage, and checks tenant, every delivery's order/customer identity, and matching source digest against the actual reader result. It binds the reader readback, source-byte digest, and independently canonicalized reference digest into the complaint ledger snapshot.

The delivery references prove only the delivered positions, quantities, timestamps, and article facts explicitly present in that synthetic fixture. The order read proves only order/customer identity and source provenance. Order status, invoice state, stock promises, trust labels, or caller-supplied delivery-shaped objects never manufacture delivery facts. The retained future delivery-position candidate remains a denied contract path (`DELIVERY_POSITION_OUTPUT_REQUIRED` / `ORDER_READ_BINDING_REQUIRED`) and is not promoted to authority.

## Actual user journey and fail-closed migration

`src/cscl-13/complaint-cli.mjs` executes the reader on labelled source bytes before every `select`, `raise`, `decide`, `read`, and `evidence` call. Separate calls reuse the existing complaint ledger and persisted snapshot/hydrate history. A source-label, reader, tenant, identity, source, reference, quantity, or decision failure returns a fixed denial before state mutation; persisted snapshots also reject order-binding or reference drift. No network, public write, purchasing logic, ERP mutation, or approval effect exists, and real-world delivery remains unproved.
