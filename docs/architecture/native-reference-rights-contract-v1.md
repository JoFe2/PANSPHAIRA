# Native reference source / rights boundary v1

Scope: owner-local, read-only provider/consumer contract work. This is not a
live supplier relation, directory, field grant, browser binding, or completion
of DUI-16 / original546.

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

The existing available field catalog is unchanged. Direct reads or view BIND
operations for supplier/assignee fields still deny. No HTTP route, UI binding,
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

## Concrete next boundary

Qualify a real registered metadata/object/field/relation-rights provider and
its exact consumer/context/revision contract before exposing values or live
bindings. Preserve this explicit UNAVAILABLE response until that boundary is
actually qualified. Then qualify typed public transport, bounded manual/table
consumers and any affected browser states, followed by necessary independent
review and existing exact-source delivery gates. A schema or source reference
alone must never flip the rights flags to true.
