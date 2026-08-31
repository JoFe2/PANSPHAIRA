# CSCL-04 Dolibarr 24.0.0 source-native profile

Status: **closed training-system profile** for issue #321. This profile consumes the CSCL-01 selector and question inventory unchanged. It does not derive, normalize, or compare cross-system concepts.

## Immutable source and replay

- Official repository: `https://github.com/Dolibarr/dolibarr.git`
- Annotated tag: `refs/tags/24.0.0`
- Tag object: `5dd1b29feb8014839b54bb0f48d988eeac3c61dd`
- Peeled commit: `769c7db907099643558e77d7002c109cfda919e5`
- License: `GPL-3.0-or-later`
- CSCL-01 selector-set digest: `ea6029f3691b5e4ac635945541a2680b9c81eaefb712c3c936dc33fbbe724afc`
- CSCL-01 question-inventory digest: `842527ddfdc7fb706b2fd0af798be286c03aa85b37152a011a8f0affff331c28`

`dolibarr-24.0.0-capture-v1.json` stores the exact selected tree files, `COPYING`, `COPYRIGHT`, annotated-tag payload, and peeled-commit payload as Base64. The decoded capture is 974,795 bytes, below the 20 MiB cap. Each entry is bound to a path, byte length, and SHA-256. The capture manifest digest is `07ba842a00c7c14af4e76e462366f651f0fa57a8b2714481b72485ab5a530c1e`. The builder has no network import or fetch call and replays only these bytes.

## Closed output

The output has exactly three families and twelve frozen questions per family:

- `PARTY_CUSTOMER_MANAGEMENT`: 12 cells / 12 Source Facts
- `PRODUCT_ITEM_MANAGEMENT`: 12 cells / 12 Source Facts
- `SALES_ORDER_MANAGEMENT`: 12 cells / 12 Source Facts

Total: **36 cells and 36 Source Facts**. Every Source Fact records the immutable selector, full source-file SHA-256, exact byte range, excerpt SHA-256, parser/canonicalizer version, and legal identity. Each cell references exactly its Source Fact. The System Profile references all 36 fact and cell digests and uses only Dolibarr-native terminology including `Societe`, `client`, `fournisseur`, `llx_societe`, `Product`, `TYPE_PRODUCT`, `TYPE_SERVICE`, `llx_product`, `Commande`, `llx_commande`, `llx_commandedet`, and `STATUS_SHIPMENTONPROCESS`.

## Explicit ambiguity and conflict evidence

- `llx_societe.sql` comments `client` as `0/1/2`, while `Societe::$client` documents `0..3`, including `3=customer and prospect`. The corresponding cell is `CONFLICTING`; neither wording is silently repaired.
- `llx_product` labels `stock` as denormalized, `fifo` and `lifo` as TODO/not used, and `hidden` as not used/deprecated. The corresponding cell is `AMBIGUOUS`; field presence is not promoted into active behavior.
- `Commande::STATUS_ACCEPTED` and `Commande::STATUS_SHIPMENTONPROCESS` both equal `2`, but `STATUS_ACCEPTED` is a deprecated backward-compatibility name. The corresponding cell is `CONFLICTING`; both native names and the deprecation are retained.

## Fail-closed boundary and nonclaims

Validation denies annotated-tag/peeled-commit substitution, unofficial repository or mirror identity, source/legal/parser/canonicalizer/path drift, source-byte or manifest redigestion, network-policy widening, cap overflow, invented facts, missing cells, omitted negative counterevidence, extra fields including `Authority`, and mismatched fact/cell/profile references.

This profile is not exhaustive documentation of Dolibarr, does not claim a common core, does not infer compatibility with another system, does not inspect the iDempiere holdout, and grants no authority, promotion, execution, production-fitness, procurement, or customer-fit status.
