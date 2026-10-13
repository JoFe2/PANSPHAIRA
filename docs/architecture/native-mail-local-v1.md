# Existing native MAILLOCAL: own synthetic read and local draft v1

Original602 has one bounded profile: `OWN_SYNTHETIC_NATIVE`, source
`pan.maillocal.own-synthetic/v1`. This is deterministic preparation, not an
inference, real mailbox, external account or send capability. The optional
trusted workspace owner enables `mailLocal: true` with the existing native
context selection. Surfaces, unrelated widgets, agent/model runs and completion
of other epics are not activation prerequisites. Default remains off.

## Original acceptance boundaries

- AC01: the pre-adapter tracked connector inventory considered the existing CRM,
  ERP and Power Platform read contracts and native/browser owners. Those schemas
  do not supply this mail profile. One code-owned synthetic source projection
  therefore consumes the existing PAN548 session, context, native SQLite owner
  connection and projection signer; no provider client or second task engine.
- AC02: native original account/thread/message revision, fixed reply recipients,
  attachment metadata/digest and minimized source body bind a versioned local
  `LOCAL_UNTRUSTED_DETERMINISTIC_REPLY`. A local row write is not an external
  draftwrite, profile save, send, model run or productive business effect.
- AC03: all source content is literal untrusted data. It cannot choose recipients,
  rights, operations or a target. Current native session/context/object boundaries,
  reviewer role and actual session CSRF protect local preparation/deletion.
  Read grants last at most 5000 ms; at most 64 grants and 64 draft/tombstone rows
  are admitted. Body bound is 16384 UTF-8 bytes and local retention is 24 hours.
  Expiry/native privacy-epoch cleanup runs on owner startup/access in a separately
  committed transaction, so a denied read cannot roll it back. Row bytes become
  null, retaining bounded tombstone metadata. Source freshness still fences the
  protected preview/preparation, but does not block an authorized own-draft
  deletion. After a source correction and reload, only independently confirmed
  deletion metadata (no stale source/draft body) is offered. This is not a forensic disk/WAL
  erasure claim or a new background scheduler.
- AC04: actual authenticated, verified TLS and existing Chromium execute source
  read, protected preview, explicit local preparation, independent native draft
  readback, browser reload/readback and deletion. Independent native confirmation
  binds exact source/draft bytes; caller recomputation of a hash is not authority.
  Separate OS-process restart probes reread the same signed draft and verify the
  deleted tombstone without replaying source/target writes.

## Connected product and existing ownership

`createNativeWorkspaceMailLocalV1` uses the existing PAN548 owner connection.
`mountProtectedWorkspaceMailLocalV1` adds only the closed authenticated
`/workspace/mail-local/` namespace. Source/confirm-source/draft/current/
confirm-draft read native state; prepare/delete require the existing reviewer
mutation boundary and CSRF. Unlisted send, external-draft, provider and arbitrary
registration routes are absent. The synthetic correction seam is server/fixture
owner-only, branded to the actual workspace/native owner; it is not an HTTP,
agent tool, source importer or account configuration.

The browser consumes existing shell/context lifetimes, facts and read-only table
rendering. It uses text nodes for source/draft content, never source instructions
or HTML. Native context replacement, local privacy invalidation and unconfirmed
responses erase presentation bytes and fence late responses. A denied/unknown
write is not automatically retried. After reload, an explicit read discovers the
native local draft without cookies/grants/source body in localStorage. Keyboard
controls, focus, bounded table scrolling, desktop/390px, reduced motion, recovery
and CSS layout zoom are qualified separately from real browser zoom, physical
mobile/device, model or human/global-design acceptance.

The existing agent/voice/PTT infrastructure is not rebuilt or silently enabled.
The local typed-final action is explicitly deterministic. This contract grants
no microphone sampling, cloud costs, private mail, productive send or external
account rights and does not replace the actual consent-gated real dialog path.

## Public qualification entry

`npm run pan602:test` builds compiled contracts and existing browser assets and
executes its fixed complete native, contract, TLS, process, browser and registration
list. It rejects caller selection/skipping/sharding/startup imports and nested
invocation. Use the already-supported owned Linux x86-64 Node24 toolchain and
existing Playwright/CA tooling. Node/native TMPDIR remains the owned long scratch;
only the owned Chromium subprocess gets the existing live descriptor alias.

Positive probes inspect original recipients/attachments, local untrusted draft,
reload/readback, row deletion and zero observed external/business/profile effects.
Negative probes cover foreign account/thread/principal, source corrections/stale
revision, literal injection, copied owner labels, forged signed/caller-rehashed
bytes, role/CSRF, partial/corrected/send/broad-scope intent, retention, native privacy
revocation, and late responses after context replacement.

A development execution or source contract is not a released acceptance. Required
independent review, exact immutable source/registered gates, existing required
Source/Main CI, protected merge, classified new release, anonymous exact archived
product/event readback and explicit original-issue closure remain delivery gates.
