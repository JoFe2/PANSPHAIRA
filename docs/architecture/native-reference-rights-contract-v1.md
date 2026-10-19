# Native reference source / rights boundary v1

Scope: the supplier source-evidence contract remains owner-local and unavailable
for live supplier fields or relations. The separately qualified native reference
subset below adds protected order/position references and receipt count to the
existing typed/manual TABLE path. Neither subset completes DUI-16 / original546.

## Exact provider and consumer

`src/pan541/native-erv-read-adapter.mjs` adds `referenceEvidence(request)` on
the existing branded native reader. Its request is the same closed
`tenantId/objectId/expectedRevision` request as the invoice read. It reads the
same actual PAN516 state, validates the fixed leading binding and matching
invoice revision, and returns
`pansphaira.native-order-supplier-source-evidence/v1`.

The digest binds the actual native order/supplier reference values, tenant,
parent invoice, native revision, native binding, quantity unit and currency.
The values themselves are not returned. A source reference is not a qualified
supplier entity, name directory, assignee, field permission, or relation grant.
Missing names stay UNKNOWN; unsupported assignee metadata stays UNAVAILABLE.
The unconfigured reader remains unavailable rather than fabricating source data.

`src/pan546/native-data-catalog.mjs` adds owner-local
`referenceContract(headers, command)`, with closed request version
`pansphaira.workspace-native-reference/read-v1`, the existing real protected
context-verification DTO, and the single relation ID
`native.order-supplier-reference`.

It reuses the existing session, native role, parent object and context guards;
rechecks current source/context after reading; and returns
`pansphaira.workspace-native-reference-contract/v1`.
Source grain is one native order/supplier reference, NOT one supplier entity.
The reference unit is NATIVE_REFERENCE_ID. Limits are one source record, at
most one future row, depth0, no pagination and no free queries.

## Rights are deliberately not invented

The source-evidence method grants no object/metadata/field/relation authority.
The protected qualification response stays UNAVAILABLE with reason
NATIVE_METADATA_OR_FIELD_RIGHTS_NOT_QUALIFIED, empty rows and authorizedFieldIds,
rowCount:null (not a fabricated zero result), and false field/relation/directory
qualification flags. Execution, booking, payment and business-effect flags stay
false. No order/supplier reference value or session proof is returned.

This supplier-evidence method does not add supplier/assignee fields to the
available catalog. Direct supplier/assignee reads and BIND operations still deny.
No supplier HTTP route, supplier UI binding,
role-administration feature, second database, supplier directory or productive
capability is enabled by this owner-local contract.

## Focused registered regression

The existing `tests/pan546/native-view.test.mjs` owner contains four additional
`DUI-16 native reference contract` cases, not a new test owner or UI suite:

- Compare source digests with the actual native snapshot for both allowed
  parent invoices; verify grain/limits/UNKNOWN/unavailability and all logical
  native target rows unchanged.
- Deny fabricated grants/fields, queries, filters, cursors/depth and accessors
  without executing getters; keep the existing field and BIND denials.
- Exercise real protected sessions, separately authenticated tenant-b, origin,
  native subject and tab binding. Caller headers cannot create authority.
- Advance the synthetic fixture using a real valid native confirmation chain;
  old native revision/context calls deny and introduce no additional changes.

Reproduce the four focused cases with supported Node24:

    node --test --test-reporter=tap --test-name-pattern='^DUI-16 native reference contract' tests/pan546/native-view.test.mjs

The directly affected unchanged native reader/view consumers can be exercised
without any browser or broad unchanged suite:

    node --test --test-reporter=tap tests/pan541/native-erv-read.test.mjs tests/pan546/native-view.test.mjs

Use owned HOME/cache/scratch, the qualified existing compiled baseline and
dependencies. No root npm ci, fresh product/model/audio provider, or preview
cutover is implied. Focused local GREEN is not independent acceptance, hosted
Source/Main CI, merge, functional release or original546 delivery.

## Remaining supplier/directory boundary

Qualify a real existing supplier metadata/object/field/relation-rights provider
and its exact consumer/context/revision contract before exposing supplier or
assignee values or live relations. Preserve the explicit supplier UNAVAILABLE
response until that boundary is actually qualified. Observing supplier references
or delivering the independent native reference subset must never flip these
supplier rights flags to true. No caller-supplied grant or productive permission
change is admitted by this contract.


## Source-qualified native reference subset

The existing PAN542 native read owner already authorizes orderId, positionId and
receiptIds in the PAN546 Human projection for its two closed parent invoices.
The authority is the actual persisted native role mapping, authenticated
session tenant/instance/generation and protected native context/revision, not
an observed supplier ID or a caller JSON permission claim.

`src/pan546/native-human-workspace.mjs` composes this same native read and same
projection in code-owner-only `readReferences(headers, {context})`. It verifies
the real protected ERV context before and after the read and requires the
current native parent revision. The existing protected GET catalog can consume
this read-only composition without manufacturing an Origin header. The public
Human `call()` boundary retains its existing strict Origin/CSRF behavior; it is
not relaxed for GET. No new route or operational permission is created.

`src/pan546/native-data-catalog.mjs` consumes and validates that actual closed
projection and correlates parent/native basis before advertising these fields:

- `erv.invoice.orderReference`: STRING / NATIVE_REFERENCE_ID.
- `erv.invoice.positionReference`: STRING / NATIVE_REFERENCE_ID.
- `erv.invoice.receiptCount`: NUMBER / COUNT, the actual authorized receiptIds
  length, not a query over a supplier directory.

These are scalar references already returned by the authorized native parent
read. They grant no access to a related entity, supplier name, assignee, document
number, arbitrary relation, free query, pagination or deeper traversal. Current
native source qualification contributes to the catalog source digest. Existing
session/tenant/role/object/context/source revision guards remain in the path;
unknown fields and caller-added rights remain denied. All business effect,
execution, booking and payment flags remain false.

The existing closed typed public DATA/catalog contract admits the explicit
NATIVE_REFERENCE_ID unit. The existing manual reducer and personal-view CAS
remain the only binding/persistence path. Before displaying a new preview, the
browser performs actual protected DATA reads for its newly bound visible fields
in batches of at most eight, validates context/source/revision and rechecks the
final preview fence. It does not substitute cached UNAVAILABLE placeholders or
store native values in the personal view.

TABLE is a real one-row native table with explicit current invoice, grain and
depth0 metadata outside its horizontal scroller. Column headings carry units;
values carry native source/unit/revision provenance. A bounded keyboard-focusable
local scroll region preserves page width, including390px and CSS layout zoom200%.
Readonly cards do not reserve a hidden property-editor column. This is neither
physical-device nor real browser-chrome zoom acceptance, nor a generic relation
or supplier table.

## Focused qualified-subset regression

The same registered native-view owner contains four `DUI-16 authorized reference
fields` cases. They compare against the actual protected native Human read for
all existing mapped read roles; exercise the real GET/public-Origin distinction,
closed typed DTO/unit tampering, manual/AGENT reducer equivalence, personal CAS
and fresh readback; deny foreign tenant/session/native subject/origin/tab,
unknown fields/relations and stale source/context/revision; and verify every
native target logical table unchanged by these read/view operations.

The same existing browser-view owner has one `DUI-16 authorized reference browser`
journey. It uses real controls and server transport, new-field native DATA during
preview, explicit personal confirmation, persisted digest/readback, logout and
fresh-session restore. It verifies no business mutation or implicit retry,
actual consumed editor asset bytes, a real semantic TABLE, local keyboard scroll,
390px/CSS200% readable viewport and sightable screenshots. No product model,
audio, foreign provider, new suite owner or parallel UI owner is involved.

Build the affected compiled contracts/consumer and browser assets before the
standalone native/browser entries:

    npm run build
    node scripts/build-pan541-browser.mjs
    node --test --test-reporter=tap --test-name-pattern='^DUI-16 authorized reference fields' tests/pan546/native-view.test.mjs
    node --test --test-reporter=tap --test-name-pattern='^DUI-16 authorized reference browser' tests/pan546/browser-view.test.mjs

Use the existing declared browser module/certutil and invocation-owned private
scratch recipe, not system temp or a global harness change. The original frozen
supplier preparation and4/14/133 evidence remain separate retained scopes;
unchanged results are not a new whole-successor acceptance. Independent focused
acceptance and exact-source canonical/hosted/protected merge/release/archive/
governance/event gates remain distinct. Partial delivery keeps original546 OPEN
and leaves supplier/directory/assignee/document-number capabilities UNAVAILABLE.
