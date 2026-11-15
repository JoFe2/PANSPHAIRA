# Native ERV source compatibility v3

This is an explicit code-owner source-metadata successor in the existing native target SQLite store. It is not another permissions registry, a business migration, an HTTP route, automatic source adoption or execution authority.

## Exact predecessor and current source

The predecessor is released primary `79df9fda08411514426b2931c6f30b0aa3dc40a1`, tree `9bb0e5548be0158fba58a14a02afb180e467143a`, release `438045921`. Its complete twelve-file effective identity, including the unchanged V1 and V2 catalogs, is the V2 test and rollback subject. V1 and V2 catalog bytes, original configuration/binding, roles, decisions, task identities, and both immutable compatibility receipts remain unchanged historical facts.

The closed V3 catalog binds that predecessor's twelve-file effective identity to the current thirteen-file identity. Only the existing native backend implementation and the exact reviewed adapter route-glue correction may differ from the predecessor closure; every other pin is inherited byte-identically. No caller-supplied hashes, policies, grants or transition data are accepted. The V3 catalog itself is additionally source-bound. The V2 catalog remains a historical released transition and its validator keeps binding its own released V1 predecessor; nothing was rehashed in place.

## Explicit owner operation

Use `transitionNativeErvHumanSourceCompatibilityV3({root, owner: 'LOCAL_SYNTHETIC_OWNER', sessions})` with the current genuine protected session adapter and the existing native store. The option shape is closed. Current session/tenant binding, existing namespace ownership, immutable configuration, and complete task-attached decision history are checked before source metadata is appended.

Supported predecessor states are deliberately finite:

1. A genuine V2-era configuration carrying its already valid, immutable V2 receipt (which itself keeps validating the genuine V1 receipt where that is the historical chain). The V3 receipt includes the V2 predecessor transition digest; earlier receipts are neither fabricated nor overwritten.
2. A configuration genuinely initialized by the exact released V2 primary itself. V3 does not invent a V2 receipt for it.
3. A fresh configuration already initialized by current source needs no transition. Its explicit owner operation is a source-bound no-op, not a grant, and the initialized configuration is checked against the exact closed V3 catalog closure.

V2-era data without its genuine V2 predecessor receipt, unknown source closures, forged catalogs, foreign/unbranded sessions, caller hashes, invalid history, and active namespace fences remain denied. Calling the V1 or V2 source transition on current V3 source is not silently converted to V3; the unchanged V1/V2 target checks remain authoritative and keep failing closed on drift.

The successor appends one guarded `pan542_source_compatibility_v3` receipt in the same native target. Existing tables and the V1/V2 receipts are not changed. Insert/replace, update and delete guards prevent a conflicting successor record. Admission holds the existing namespace fence and SQLite writer transaction. As in V1/V2, the namespace lease is released only after admission and before metadata DDL while SQLite retains the writer lock, so a crash at DDL rolls back without orphaning a business-operation fence. Earlier fenced failures remain fail-closed.

## Evidence and nonclaims

Registered tests retain the original V1 assertions against the genuine complete V1 source and the original V2 assertions against the genuine complete released V2 source, never a hybrid of an older backend with a newer adapter. Current-source tests cover the explicit preserved-history successor, exact direct predecessor, fresh-source strict binding and no-op, idempotency, all three versions' immutable guards, prior-source readback/rollback, owner/session/tenant/hash/fence denials, retired-entry drift denials, missing predecessor, actual target/catalog drift and interrupted-DDL rollback/restart. Source preparation reuses declared immutable source inputs; no production or personal store is a fixture.

All receipts retain false booking, payment-order, productive-dispatch and execution authority. Business decision ABI and original decision/source basis remain unchanged. Source compatibility, a local green test or a rendered frame is not independent acceptance, mandatory CI, protected integration, a published functional release, anonymous readback or whole PAN539/PAN546 closure.
