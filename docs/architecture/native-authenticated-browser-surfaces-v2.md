# Native authenticated browser surfaces v2

Original PAN597 is a model-free read-only display profile on the existing shell. PAN527 remains the session/origin owner; PAN548 remains the native context and minimal durable task-projection owner. PAN597 owns only Surface state and Delivery outbox. PAN453's existing resource ledger supplies the same SQLite connection and transaction through a nonserializable code-owner attachment. There is no second task controller, model/broker grant, profile-save or business execution authority.

## Versioned contract

`packages/contracts/src/workspace-surface-v2.ts` declares additive contributions to existing PAN546/PAN541 plugin/context contracts: `pan.erv.document.v2`, `pan.analysis.stock.v2`, `pan.setup.monitor.v2`. No caller URL, arbitrary plugin, new source registry or silent v1 assertion expansion. Document is the leading native read-only invoice reference with its original source SHA, not an original PDF/DMS. Analysis reuses the PAN549/PAN515 result, explicit units and missing facts. Monitor reuses the PAN527 coordinator; its raw status digest is preserved separately from the canonical whole-view result digest.

A Surface is bound to authenticated origin, tenant, principal, role, actual session/tab, connection epoch and native context epoch. Registration/reconnect requires its own proof; shared cookies cannot change role or grant foreign Surface access. Peers must have the same allowed principal/role/session and live native tab. Only the mounting code owner can attach native readers, with the exact leading reader/context identity. Two actual browser windows are not device qualification.

Display commands retain original canonical bytes/digest in the PAN548 task row, joined atomically to PAN597's outbox. New requests carry source/target Surface and connection/context epochs, exact native view-revision digests, target local generation, allowed object/route/data revision and bounded original expiration. Same command ID with different canonical bytes rejects; an explicit identical retry reads the original authenticated row, never reconstructed current preconditions. Lost queue or restarted owner returns retained OUTCOME_UNCONFIRMED, without re-enqueue or double DOM action. Old owner generations fail closed. Unresolved markers are never deleted to manufacture recovery.

ACCEPTED, DELIVERED, DATA_LOADED and RENDERED are separate. Native read and DOM permit revalidate source/target scope, view/object bytes, epochs, expiration, Pin/Dirty and local generation, including after the existing SQLite reservation. The renderer additionally checks original expiration and every current local guard after the asynchronous permit response, immediately before a synchronous actual DOM commit. A locally stopped Surface cannot poll, receive/render or send a new command even when its native Revoke transport failed. A lost permit uses the explicit versioned native return-to-v1 operation, without clearing the original task or commit marker. Legacy unopted v1 consumers retain their old contract and deny v2 contexts instead of misrepresenting them.

Renderreceipt binds the actual loaded projection digest, source/object/data/result revision, Surface/connection/local/native context epoch and client-reported committed DOM. It does not certify physical pixels, a human sighting, physical device or productive effect. HTTP acceptance alone is not RENDERED. Native read-only state/profile and business sources are independently checked unchanged by the fixed suite.

## Fixed budgets and public reproduction

Opt in via the existing native assembly `enableWorkspaceBrowserV1({...existing owner inputs, contextSelection:true, surfaces:true})`. The existing protected browser-first bootstrap exposes this model-free profile; an unconfigured invoice source remains unavailable, not synthesized. Native analysis requires the existing explicitly attached reader. No model price, usage, consent, audio, private source, production or counterpart rights are inferred.

`npm run pan597:test` is the closed Linux/x86_64 fixed entry. It uses the existing locked TypeScript/esbuild/Playwright tools, original owned CA/TLS and native fixtures. Only an invocation-owned TMPDIR or RUNNER_TEMP is accepted; no test selectors, skip/shard/startup imports or nested test marker. Browser ports are run serially. Existing 5000ms request, 8000ms browser action and 60000ms command expiry ceilings remain. Journal retention is 128 events, batch 16, active pending queue 8 per target, lifetime 128 task rows and 32 Surface rows. Bounds are not crash-safe productive-runtime or unbounded-retention claims.

The fixed native/browser cases cover actual distinct browser windows and leading document read; actual analysis/monitor; manual navigation, Pin and dirty profile; lost acceptance response with identical original bytes and one DOM commit; wrong role/proof/foreign Surface/schema/route; stale generation/view/ACK; cursor gap/snapshot and real outbox loss; retained task after native reopen and actual backend child exit/restart; native tabs.setZoom/getZoom 200% separate from CSS1 and painted raster; and the narrow independent-review corrections for late expired permit, failed native Revoke/local Stop and lost permit/v1 recovery. Registration/required canonical CI, protected merge, classified release, anonymous exact archive/readback and original closure remain separate delivery gates.

The real model/capped-consent paths under PAN565/567/575/548 remain OPEN/NOT_RUN until their actual authorized runtime/model/usable route/price/currency/usage and explicit capped consent exist. This Surface profile does not claim their acceptance or block independently authorized display work.

## Additive browser-pair handshake v1 — limited PAN605 prerequisite

`owner.browserPairingV1` and the closed protected `POST /t/<tenant>/workspace/surfaces/browser-pair-v1` operation add a browser-only handshake to this SAME PAN597 Surface owner and existing native ledger. Each profile authenticates independently through PAN527/PAN548. The session identifier is derived and verified from its actual protected cookie, not a caller-supplied role or free session name. A copied full session is not another login. There is no second task controller, product login service, browser extension, desktop companion or placement engine.

The source explicitly selects an existing native document reference. `offer` issues a 20-lowercase-hex code, valid for 60000ms. Every claim attempt commits before code verification; each authenticated session has at most five attempts per 60000ms, shared across its tabs. `claim` consumes the code once with `CONFIRM_RECEIVER_PAIRING`; only the source can subsequently confirm the exact target Surface and original scope digest with `CONFIRM_SOURCE_PAIRING`. Confirmation and a scoped `revoke` are distinct from an unknown transport outcome. A new explicit source offer invalidates its old link. Pair rows are lifetime-bounded at128, returned lists at8 and attempt subjects at256; exhaustion fails closed, not an unbounded production-retention claim.

The paired reference is bound to the current origin/workspace, source and receiver sessions/tabs, Surface connection and context epochs, local generations and native document revision/digest. Both sides must still pass the existing native reader. Logout, expiry, source correction, Pin/Dirty, reconnect and loss/replacement of the code owner invalidate old witnesses. Original credential/proof witnesses exist only in current owner memory: never in pairing SQLite rows, readbacks, another profile, URLs or browserstorage. Restart cannot recover them from a code or retained row. Deadline tests force an invocation-owned native row into the past to exercise the actual guard; they are not a claim of waiting out every wall-clock duration.

Crucial capability boundary: `projectionDeliveryGranted`, `fieldProjectionGranted`, execution/business/model/audio and physical-device claims remain false. `fieldProjectionGrant` and `dataClassGrant` are explicitly null. The scope digest is reference identity, NOT a data-class approval. The original v2 Delivery owner still rejects cross-session dispatch after pairing. A PAN606 consumer must separately attach a real restricted DisplaySession and an approved field projection intersected with current source/receiver/workspace/data-class rights before any field delivery. This prerequisite does not implement or qualify PAN606 and does not complete PAN605's wider delivery, other-engine, physical-device or window-placement criteria. Both issues remain open until their own actual criteria and delivery gates are met.

The existing SURF panel exposes manual source/receiver/confirm/readback/revoke controls. Code input/output is transient and cleared on consumption/revoke/retirement; no pairing token or field data is restored from local/session storage. An original delayed native list response cannot overwrite a later local revoke. Background readback does not replace the code input or take focus. The receiver's390px viewport is established before navigation, separately from1280px source rendering; live viewport-emulation focus transitions are not physical-device or responsive-resize focus certification. A speculative shared-main focus guard was rejected and is not part of this change.

`npm run pan597:test` retains every original native/browser/restart/registration case and adds the registered pairing native and actual browser cases. Actual two persistent Chromium profiles use separate physical profile directories and separately issued authenticated sessions, with storage-isolation and protected session-ID readback. Those are not another engine or physical device. The unchanged existing PAN563 test-only `tabs.setZoom/getZoom` fixture supplies native browser200/CSS1 and painted raster for the new controls; no product extension is introduced. Tests never open microphone/audio; source fixtures are public synthetic data and their native history is checked unchanged. Loopback TLS/native SQLite/authentication probes are not Docker/runtime/device/productive-source or human-perception acceptance. Source/review/required CI/merge/classified release/anonymous readback remain separate gates.


## Jo240897: self-label metadata v1, manual route and precise denial

`POST /t/<tenant>/workspace/surfaces/labels-v1` deliberately adds a separate
`pansphaira.workspace-surface/labels-command/v1` / `labels-readback/v1` ABI.
`list` accepts only schemaVersion and operation; `set` additionally accepts
one exact printable label (at most40 UTF-16 code units, empty clears it).
The authenticated current actor can label ONLY its own native Surface.
No caller Surface ID, role, rights, revision digest or other grant is accepted.
The existing native Surface table/connection gains `display_label_v1`; no
second registry/table/controller is created. Reconnect preserves the same
Surface's label, but all actual IDs, epochs, proof, native context/revision,
Pin/Dirty and task/UNKNOWN fences remain authoritative. Labels never grant
routing rights. The original closed v2 list/register/display/task/projection
shapes remain unchanged. The separate labels/v1 readback is closed, bounded
to the existing32 surfaces, scoped to the actual principal/session/current
boot, and explicitly sets labelAuthorityGranted and effect/grant flags false.

The panel presents confirmed self-labels and human-first destination options
alongside their actual Surface IDs/connection epochs. A newer unsaved label
edit and its focus survive a delayed native save response. A name is saved
metadata, not evidence of document loading or rendering.

The same panel always shows the normal same-Origin workspace URL and manual
second-window instructions. Open a window in the SAME browser profile and
navigate normally; do not copy cookies/invitations or perform another login
that replaces the first window's shared session. Source popup opening uses
noopener and reports only an opening REQUEST, never a successful registry,
render or blocked-popup verdict from a null return. The existing actual
normal-URL/manual second-window route is reusable. Actual popup blocking and
physical monitor placement remain separate, unqualified boundaries unless
observed. No extension, companion, OS-global window authority, automatic
placement or permission request is introduced; manual placement remains usable.

The existing PAN527 transport now retains native SURFACE-domain errors rather
than masking them as503/HOSTED_AUTH_UNAVAILABLE: proof/scope/target authority
errors403, unknown destination404, stale/reconnect/conflict/retired outcomes409,
bounded capacity/backpressure429, and other closed schema/input errors400.
The client shows the exact authenticated native code and HTTP status while
retaining the original command bytes. A native denial is not a render receipt
or proof that an earlier task was settled. A network/unconfirmed reply stays
UNKNOWN; no reconstruction, redispatch, refund or marker cleanup follows.
Stopped/foreign counterprobes independently reopen the native ledger and
assert no new task/outbox/DOM receipt. Existing pin/draft/native original-byte
and owner-restart UNKNOWN tests remain intact. This bounded correction is not
whole605/606, cross-session data delivery, other-engine/device, Main sighting,
full design, native zoom, model/audio/cloud or production qualification.


## Readable native document and setup-monitor presentation

The shared browser workspace renders the already-authorized DOCUMENT and MONITOR projections as labelled native information. DOCUMENT reuses the canonical synchronous native invoice card, including the actual invoice reference, revision, amounts and unresolved-status warning. MONITOR reuses the canonical setup-status summary and stage list, including the actual offline/no-live-model evidence. Neither view performs a second read or creates a second data store or authority path. Missing information is not invented.

Source/object/data revision and the exact result revision remain visible as provenance. The original source and data JSON remain byte-equivalent JSON values in keyboard-operable, initially collapsed technical details. The existing unrelated ANALYSIS presentation is not converted into a new analysis capability. A native invoice reference is not an original PDF or DMS document.

The synchronous existing before-DOM/commit/ACK boundary remains unchanged: accepted transport, loaded native data and a rendered target receipt remain distinct. Destination selection, native IDs/epochs/revisions, tenant/session denials, pinned or dirty content and original UNKNOWN custody are not relaxed. Rendering does not grant booking, payment, model, audio or productive rights.

The common registered-module navigation retains whole-word labels and one adaptive module row where the existing layout is horizontal. Overflow stays inside the existing navigation; keyboard focus scrolls the complete actual focused module into that region. No module is hidden or renamed to obtain fit, and no profile-specific exception is introduced. The existing five design compositions and narrow-screen layout remain separate from full original-profile visual acceptance.

The focused browser regressions cover actual 1280px five-profile navigation, narrow overflow/focus and real native DOCUMENT/MONITOR target rendering with exact raw JSON disclosure. Earlier source-bound generic-composition matrices remain historical evidence; their narrower positive verdict is not a claim that these subsequently observed readability defects were already absent. Whole issue605/606, physical monitors and actual popup-blocking acceptance remain separate.
