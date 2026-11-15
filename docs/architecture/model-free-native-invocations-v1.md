# Model-free final-text invocation v1

PAN608 extends the existing PAN548 context/task input owner. It consumes the
actual PAN546 preview validator/reducer and the PAN597 registered browser
surface delivery path. It does not create a second shell, registry, policy or
task engine, model/provider, field database or source loader.

## Closed provider contract

`pansphaira.workspace-invocation/final-text/v1` accepts complete typed final text,
not partial transcripts. The entire input must match the closed reversible
card-preview or selected-document-display grammar. Negation, correction,
unknown remainder and multiple wishes go to MAIN without starting a model.
NONE and CLARIFY are explicit non-effects. Native context/card selection and a
registered target are required; neither IDs nor arguments are invented.

The authenticated resolver emits `candidate-set/v1` with complete
`candidate/v1` members: object/document/target references, native source/view/
target revisions, canonical argument bytes/digest, principal/session/tab/
context/generation scope, fixed purpose/constraints, policy reference and the
original native lease deadline. Only a uniquely selected complete member is
admissible. A null or ambiguous selection cannot be bypassed by selecting a
member directly in an admission call.

`admission/v1` binds the original request digest, entire set digest, exact
candidate/argument digest, registered capability, policy, scope and deadline.
The independent executor requires the actual owner-issued token and rechecks
current native context, profile/source revisions, generation, target Pin/Dirty
and lease immediately before the existing owner effect. A durable once-attempt
marker is written on the same PAN548 native task ledger; lost replies/restart
must be independently read and never trigger an automatic effect replay.

## Rights and honest phases

Capabilities are only `pan.workspace.view.preview/v1` and
`pan.workspace.document.display/v2`, intersected with the current authentic
principal, REVERSIBLE_UI_PRESENTATION purpose, local-only/no-send constraints
and native lease. This scope cannot change no-send, declare mail.send or
externalDraft.write, save a profile, publish shared state, execute business
work or acquire model/cost/audio/private/production/KS authority. Existing
Learning-Routing/#128–#130/#286 material remains non-authorizing.

The executor returns PREVIEW_VALIDATED, not PREVIEW_RENDERED. The existing
browser preview validator and final local context/generation/expiry fence
must actually commit the preview DOM before PREVIEW_RENDERED is displayed.
The profile revision remains unchanged. PERSONAL_PROFILE_SAVED requires the
existing explicit confirmation, native profile CAS and independent readback.
RESTORED requires the existing separate confirmed Undo CAS/readback; offline
Undo cannot claim success. Shared publishing remains outside this scope.

Document acceptance is DOCUMENT_ACCEPTED, not rendering. PAN597 alone performs
native read, before-DOM permit, final local fence and DOM ACK/readback, keeping
original bytes and all prior delivery/epoch/restart safety properties.

## Local operations and consumer evidence

Preview discard changes the existing local draft immediately, without waiting
for a router/provider/network. Optional native cancellation is best-effort and
is never called a successful remote rollback. Local text stop rejects late
responses without claiming cancellation of an already dispatched remote
effect. No audio installation is introduced or required; existing audio stop
ownership is not changed. Independent task readback is not redispatch or a
successful remote Undo.

The existing browser canvas exposes a typed final-text field, native card and
target selectors and the same native preview/confirm/discard/Undo controls.
Real synthetic native SQLite/TLS and Chromium positive/negative probes bind
Desktop/390/CSS-zoom evidence to current build bytes. CSS zoom, native browser
zoom, DOM geometry, painted raster and actual image sighting are separate.
This functional release is SOURCE_EVIDENCE_ONLY, not a prebuilt installer or
real-model/physical-device/whole-design acceptance.

## PAN696 ACT-01 bounded action observation (source-only, same owners)

The existing admission/executor seam additionally exposes a read-only
versioned observation of one invocation: request
`pansphaira.workspace-action-observation/request/v1` accepts only
`schemaVersion` and the existing `invocationId` handle; any unknown field,
forged handle or foreign principal is denied at the same authenticated
boundary, and observation alone never dispatches, grants rights or mutates.
The response `pansphaira.workspace-action-observation/v1` binds the actual
run/task/step/attempt (real dispatch ordinal; `taskRevision` is the separate
durable task row revision, never the attempt count), the authenticated
tenant/actor, the admitted capability and argument schema, the object
reference with its expected revision set plus the actual expected view/native
revisions, the exact canonical argument digest, the causal context-set digest
binding, the idempotency operation, and an optional code-owned semantic UI
target. `PROPOSED`/`ADMITTED`/`DISPATCHED`/`RESULT_CONFIRMED`/`UNKNOWN` and
`DOCUMENT_ACCEPTED` are derived only from existing journal/row facts; the
executor readback carries the same binding even when the caller ignores it.
A genuine after-begin reply loss stays `UNKNOWN` with attempt 1 retained and
confers no re-dispatch right. Accepted is never rendered, and rendered is
never persisted: `personalViewPersistenceProduced` requires the existing
personal-save CAS/readback, `physicalPixelSightCertified` remains false here,
and `model`/`modelPlanLineage` stay `NOT_RUN`/`null` — observation infers no
model plan lineage and grants no new authority; effective authorization and
limits remain at the existing owner/executor. The existing unavailable native
pause/cancel/resume (PAN698) and the offer-line API (PAN704) stay explicitly
unavailable; this observation is neither.

Observations are origin-epoch bound: a privacy revoke (including one followed
by a providerSwitch) retires the row-backed and in-memory proposals, after
which observation returns the minimal `PRIVACY_RETIRED` DTO with no object,
proof, argument/set digests or actor disclosure and never retroactively
adopts the newer current epoch. A durable effect committed before retirement
survives as historical audit under the origin epoch; mid-finish retirement
shows explicit `availability: "PRIVACY_RETIRED"` in the executor readback
instead of an executor error, without redispatch. Row-backed observations
revalidate the persisted original-command bytes through the existing task
core before trusting them. Journal expansion (PAN697), UI surface (PAN699)
and observation history (PAN700) remain unimplemented here.
