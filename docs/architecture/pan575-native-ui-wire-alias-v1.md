# PAN575 native UI provider-wire alias v1 (closed, versioned)

Scope. The actual native UI owner path (#565 owner -> #575 shared broker loop
-> #548 consumer) declares the two native capabilities `ui.view.read` and
`ui.view.propose`. The available local inference server enforces
`tools[i].function.name ~ [A-Za-z0-9_-]{1,256}` and answered the real
predecessor request shape with HTTP 400 (measured for the utility path; the
UI-specific request had not been executed against that server). This adapter
closes that provider incompatibility for the native UI path WITHOUT a second
agent engine, ledger, credential store, consent grant or new task purpose.

Seam and binding. `src/pan565/connection-transport.mjs` is the only code-owned
provider-wire boundary; the adaptation lives inside it as
`MODEL_UI_WIRE_ALIAS_V1` (`schemaVersion:
`pansphaira.model-connection/ui-wire-alias/v1`):

- `ui.view.read` -> `ui_view_read`
- `ui.view.propose` -> `ui_view_propose`

Outgoing: `adaptNativeUiWireRequestV1` renames declared tools AND the
assistant tool-call transcript entries (follow-up turns) of the actual
`bound.request` just before the POST. The adapter engages ONLY on requests
that actually declare one of the two UI-catalog names. Every other request —
existing routes, probes, utility-path pre-aliased tools, historical synthetic
samples AND the original574 native composition tools with their own dotted
capability ids (`pan522.material.plan`, `erp.order.create`, which are NOT part
of the closed UI catalog) — passes byte-identical with no alias map and keeps
its ORIGINAL broker/tool guards: not renamed, not blocked, not admitted as a
capability by this adapter. Within an actual UI-catalog request, unknown,
unmappable or colliding dotted/mixed names (a UI-catalog name combined with a
foreign dotted name is exactly such a refusal) are refused BEFORE dispatch
with `MODEL_CONNECTION_WIRE_NAME_DENIED` (zero POSTs: dispatch not started).
Malformed injected bindings (alias==native, dotted alias, colliding aliases)
fail closed with `MODEL_CONNECTION_WIRE_ALIAS_DENIED`.

Incoming: when a request was adapted, every response `tool_calls[*].function.
name` must equal exactly one alias declared in that request (case-sensitive).
Unknown, forged, wrong-case or native-mixed names are refused with
`MODEL_CONNECTION_WIRE_ALIAS_DENIED`; accepted names are restored to the
EXACT known native identity before broker and owner validation, so the
original broker candidate guard (`request.tools.some(name===...)`), the
original opaque call-id correlation (`isModelChatCallIdV1`, fresh challenges)
and the owner completion settlement check
(`canonicalJson(['ui.view.read','ui.view.propose'])`) all keep seeing only
native identities. The alias never reaches broker/owner/546 as a capability
and cannot mint rights.

Authority unchanged. Task consent, COST/runtime reservation before dispatch,
UNKNOWN_USAGE across reopen without blind retry, the separate #546
preview/confirmation/CAS/readback/undo authority and the durable native
budget ledger are reused untouched.

Identity invalidation. `connectionTransportIdentityV1()` hashes the
transport file bytes; the alias binding lives in that file, so changed
adapter bytes rotate adapterDigest/parserDigest, which changes every bound
owner `identity(t)` and invalidates prior checks/consents via the existing
`MODEL_CONNECTION_STALE_DENIED` path. No new version channel was added.

Evidence class. The strict-wire probe
(`tests/pan575/native-ui-wire-adapter.test.mjs`) uses a local HTTP protocol
peer that enforces `[A-Za-z0-9_-]{1,256}` and answers dotted names with 400,
mirroring the real server constraint. Its model peer is explicitly
synthetic; every verdict stays `SYNTHETIC_PROBE_ONLY`/fixture-level with
`realModelAcceptance:false`. This is transport/protocol evidence only: it is
not original575 model acceptance, not browser acceptance and not whole-issue
closure.
