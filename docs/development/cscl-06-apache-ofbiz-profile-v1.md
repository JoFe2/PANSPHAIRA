# CSCL-06 Apache OFBiz release24.09.07 source-native profile

Status: **closed training-system profile** for issue #323. This profile consumes the frozen CSCL-01 selector and question inventory. It grants no Authority, promotion, execution, compatibility, procurement, or customer-fit claim.

## Immutable source and legal identity

- Official repository: `https://github.com/apache/ofbiz-framework.git`
- Selector: `refs/tags/release24.09.07`
- Annotated tag object: `12b6d40382ac38d3252df78781f9877d46f5f9f7`
- Peeled commit: `42819e5ae1d5339d3a204ac06b43e69d46a9c0ae`
- License: `Apache-2.0`; `LICENSE` is 12,097 bytes, SHA-256 `98ea9a04fd3da336cbc8b09bd8362a177fe3296d4f15bedcb908ae1017a94021`.
- Notice: `NOTICE` is 166 bytes, SHA-256 `940993239ad83e55d0bb49dab870d548249b91c690d63e180c3eee0305060e34`.
- Obligations retained from CSCL-01: `PRESERVE_LICENSE`, `PRESERVE_NOTICE_AND_ATTRIBUTION`, `MARK_MODIFIED_FILES`, `STATE_CHANGES`.

The capture contains 18 exact repository members and 1,177,462 decoded raw bytes, below the 20 MiB cap. Every member is Base64 encoded with its original byte length, SHA-256, commit, and repository member path. Independent acquisition replay matched all 18 decoded members to Git objects at the peeled commit. The annotated tag and peeled commit are checked independently and may not substitute for each other.

## Captured official members

The bounded corpus includes only `LICENSE`, `NOTICE`, and exact Party, Product, and Order entity definitions, seed data, service definitions, and component AsciiDoc needed to answer the frozen questions. The normative member list, raw lengths, hashes, and Base64 bytes are in `tests/fixtures/cscl-06/official-source-corpus-v1.json`.

No other ERP and no holdout business semantics were inspected. OFBiz terms are not renamed to cross-system concepts.

## Source-native results

| Family | Objects / roles | Relations | Operations and boundary | States / events | Explicit negative result |
|---|---|---|---|---|---|
| `PARTY_CUSTOMER_MANAGEMENT` | `Party`, `Person`, company/group, customer, supplier, employee | `PartyRelationship`, From/To `Party`, `PartyRole` | `createPerson`; `setPartyStatus`; java service definitions | `statusId`, `StatusValidChange`, ECA check, `oldStatusId` | `AMBIGUOUS`: the documentation says Party may be person/company/group and lists customer/supplier/employee, but does not establish customer as one exclusive Party entity type. |
| `PRODUCT_ITEM_MANAGEMENT` | `Product`, `Catalog`, `Category`; physical/digital | `ProductAssoc`, Main/Assoc Product, `ProductType` | `createProduct`; `discontinueProductSales`; groovy service definitions | `introductionDate`, `releaseDate`, `supportDiscontinuationDate`, `salesDiscontinuationDate` | `ABSENT`: the complete captured `Product` entity has no `statusId`; lifecycle dates are not normalized into a status workflow. |
| `SALES_ORDER_MANAGEMENT` | sales order, customer, products/services, payment and shipping terms | `OrderRole`, `OrderHeader`, `PartyRole`, `OrderItem` | `createOrderFromShoppingCart`; `changeOrderStatus`; java service definitions | `ORDER_CREATED`, `ORDER_PROCESSING`, `ORDER_APPROVED`, `ORDER_SENT`, `ORDER_HOLD`, `ORDER_COMPLETED`, `ORDER_REJECTED`, `ORDER_CANCELLED`, `StatusValidChange` | `CONFLICTING`: prose says cancellation is available up to final confirmation, while seed transitions permit `ORDER_APPROVED` and `ORDER_SENT` to reach `ORDER_CANCELLED`. |

All twelve CSCL-01 questions are closed for each family: 36 cells total. The build emits 37 exact source facts because the Sales Order conflict retains both sides as separate facts. States are 33 `SUPPORTED`, one `ABSENT`, one `AMBIGUOUS`, and one `CONFLICTING`.

## Deterministic artifacts and replay

- Source corpus: `tests/fixtures/cscl-06/official-source-corpus-v1.json`
- Frozen source-native assertions and exact excerpts: `tests/fixtures/cscl-06/source-native-assertions-v1.json`
- Emitted facts, cells, and profile: `tests/fixtures/cscl-06/expected-build-v1.json`
- Builder/validator: `src/cscl-06/profile.mjs`
- Adversarial and schema tests: `tests/cscl-06/apache-ofbiz-profile.test.mjs`
- Verification receipt: `verification/cscl-06-apache-ofbiz-profile-receipt-v1.json`

`buildApacheOfbizProfile()` verifies both frozen CSCL-01 canonical digests and raw fixture digests, exact source/tag/legal identity, a closed member allowlist, strict Base64, member raw length/hash, exact unique byte locators, parser/canonicalizer versions, complete 3 × 12 coverage, negative counterevidence, boundaries, and the cap. Facts, cells, and profile are deterministically canonicalized and hashed. Offline replay uses only embedded member bytes; the test injects a network function that throws and still obtains a byte-identical double build.

The `candidateMeaningSha256` field required by the frozen cell schema is a fixed digest of `CSCL-07_CANDIDATE_MEANING_NOT_DERIVED`; it is deliberately unequal to native meaning and makes no equivalence claim. Cross-system meaning is reserved for CSCL-07 and later.
