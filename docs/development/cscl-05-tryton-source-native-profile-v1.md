# CSCL-05 Tryton 8.0 source-native profile

This profile is a **training-system evidence profile only**. It answers the 12 frozen CSCL-01 questions for each of `PARTY_CUSTOMER_MANAGEMENT`, `PRODUCT_ITEM_MANAGEMENT`, and `SALES_ORDER_MANAGEMENT` while retaining Tryton model, field, state, transition, method, and exception names. It derives no cross-system concept, candidate, common core, compatibility conclusion, or Authority.

## Immutable official source

Only these exact files from `https://downloads.tryton.org/8.0/` are admitted:

- `trytond-8.0.9.tar.gz`
- `trytond_party-8.0.3.tar.gz`
- `trytond_product-8.0.1.tar.gz`
- `trytond_sale-8.0.3.tar.gz`

The committed fixture retains the exact four tarballs, four detached signatures, the frozen `SHA256` index, and the 95-byte official `https://downloads.tryton.org/signify/8.0.pub` key. `validateTrytonCapture()` checks frozen URL, length and SHA-256 identity, requires exactly one matching index row for each tarball and signature, parses the signify `Ed` key/signature records, requires key-id equality, constructs the Ed25519 SPKI key, and verifies each detached signature over the exact tarball bytes with Node's built-in crypto. This proves only detached signature validity for those file bytes.

GitHub mirrors and any other base/key URL are denied even if bytes match. Missing or altered index, key, signature, or tarball bytes fail closed. Tar traversal, links, non-file/non-directory members, malformed headers, truncation, and captures above 20 MiB are denied.

## Delivery-safe semantic members

`source-members-v1.json` binds every selected raw member to its source archive, exact member path, raw byte length, raw SHA-256, and committed storage path. Offline builds compare each stored member byte-for-byte with the matching regular member in the signed tarball. The selected members cover Tryton Workflow/RPC mechanics and the Party, Address, Contact Mechanism, Product Template, Product, UoM, Sale, and native exception declarations used by the facts.

## Outputs

The deterministic offline build emits and the tests schema-validate:

- 36 closed Source Facts in `tests/fixtures/cscl-05/expected/facts-v1.json`;
- 36 closed Evidence Cells in `tests/fixtures/cscl-05/expected/cells-v1.json`;
- one closed System Profile in `tests/fixtures/cscl-05/expected/profile-v1.json`.

Each fact binds the frozen CSCL-01 selector digest, exact artifact/member selector, complete selected-member digest, exact byte range and excerpt digest, legal identity and obligations, parser/canonicalizer versions, and no-authority boundary. Each profile coordinate is represented exactly once. `ABSENT` cells carry counterevidence; generic RPC evidence is `AMBIGUOUS`, not a claim of a model-specific documented API.

## Operation and nonclaims

The default build is offline and invokes no network API. Recapture is explicit: supply a local capture directory to `validateTrytonCapture()` after downloading only from the frozen official URLs. The module never downloads automatically.

No iDempiere or other ERP semantics were inspected. No candidate, equivalence, common core, production fitness, procurement, compatibility, customer fit, promotion, execution, or Authority is granted. Evidence-cell candidate-meaning digests bind the explicit `NO_CANDIDATE_DERIVATION_CSCL05_SOURCE_PROFILE_ONLY` sentinel rather than inventing candidate meaning.
