# Native ERV source compatibility v2

This is an explicit code-owner source-metadata successor in the existing native target SQLite store. It is not another permissions registry, a business migration, an HTTP route, automatic source adoption or execution authority.

## Exact predecessor and current source

The predecessor is released primary `3a54908b377b749e0df229fc6212492acfa9ea15`, tree `44d113fd044590f055d273364d800ce4506ded9d`, release `420127236`. Its complete original source remains the V1 test and rollback subject. V1 catalog bytes, original configuration/binding, roles, decisions, task identity, and the immutable V1 compatibility receipt remain unchanged.

The closed V2 catalog binds that predecessor's eleven-file effective identity, including the unchanged V1 catalog, to the current twelve-file identity. Only the existing native backend implementation and the exact REVOKE HTTP-denial adapter correction may differ from the predecessor closure; no caller-supplied hashes or grants are accepted. The V2 catalog itself is additionally source-bound.

## Explicit owner operation

Use `transitionNativeErvHumanSourceCompatibilityV2({root, owner: 'LOCAL_SYNTHETIC_OWNER', sessions})` with the current genuine protected session adapter and the existing native store. The option shape is closed. Current session/tenant binding, existing namespace ownership, immutable configuration, and complete task-attached decision history are checked before source metadata is appended.

Supported predecessor states are deliberately finite:

1. An original genuine legacy configuration with its already valid, immutable V1 receipt for the exact published predecessor. The V2 receipt includes the predecessor transition digest; V1 is neither fabricated nor overwritten.
2. A configuration genuinely initialized by the exact published predecessor itself. V2 does not invent a V1 receipt for it.
3. A fresh configuration already initialized by current source needs no transition. Its explicit owner operation is a source-bound no-op, not a grant.

Original legacy data without its genuine V1 predecessor receipt, unknown source closures, forged catalogs, foreign/unbranded sessions, caller hashes, invalid history, and active namespace fences remain denied. Calling the V1 source transition on current V2 source is not silently converted to V2; the unchanged V1 target check remains authoritative.

The successor appends one guarded `pan542_source_compatibility_v2` receipt in the same native target. Existing tables and V1 receipt are not changed. Insert/replace, update and delete guards prevent a conflicting successor record. Admission holds the existing namespace fence and SQLite writer transaction. As in V1, the namespace lease is released only after admission and before metadata DDL while SQLite retains the writer lock, so a crash at DDL rolls back without orphaning a business-operation fence. Earlier fenced failures remain fail-closed.

## Evidence and nonclaims

Registered tests retain original V1 assertions against the genuine complete V1 source, not a hybrid adapter/backend. Current-source tests cover the explicit preserved-history successor, exact direct predecessor, idempotency, both versions' immutable guards, prior-source readback, owner/session/tenant/hash/fence denials, missing predecessor, actual target/catalog drift and interrupted-DDL rollback/restart. Source preparation reuses declared immutable source inputs; no production or personal store is a fixture.

All receipts retain false booking, payment-order, productive-dispatch and execution authority. Business decision ABI and original decision/source basis remain V1 and unchanged. Source compatibility, a local green test or a rendered frame is not independent acceptance, mandatory CI, protected integration, a published functional release, anonymous readback or whole PAN539/PAN546 closure.
