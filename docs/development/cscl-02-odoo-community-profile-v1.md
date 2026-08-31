# CSCL-02 Odoo Community 19.0 source-native profile

Status: deterministic training-system profile for issue #319. This artifact consumes the released CSCL-01 selectors, questions, legal identity, and closed schemas at base `201baa3ed96b71e9577189b208435bdbb589fcba` (`2026_08_31_v2`).

## Frozen identity and capture

- Official repository: `https://github.com/odoo/odoo.git`
- Version/selector: `19.0` / `refs/heads/19.0`
- Immutable commit: `1eb4fcdf08ddbc1341bdc8cb8129906722f54bdc`
- License: `LGPL-3.0-only`
- Capture requires explicit `network: true`; offline replay is the default build path and never calls `fetch`.
- The delivery-safe source bundle stores Base64 plus raw byte length, SHA-256, immutable raw URL, and repository path for each admitted file.
- Decoded capture total: 338,845 bytes, below the 20 MiB ceiling.

Captured paths are exactly `LICENSE`, `COPYRIGHT`, `odoo/addons/base/models/res_partner.py`, `addons/product/models/product_template.py`, `addons/product/models/product_product.py`, and `addons/sale/models/sale_order.py`. No other ERP or iDempiere source was inspected.

## Profile construction

`src/cscl-02/odoo-profile.mjs` validates the exact repository, commit, selector-set digest, legal identity and obligations, parser/canonicalizer versions, source path allowlist, immutable URLs, raw lengths, SHA-256 values, Base64 canonicality, and decoded-size ceiling. It then resolves immutable unique byte anchors from the frozen cell specification and emits:

- 36 CSCL-01 Source Facts;
- 36 CSCL-01 Evidence Cells, exactly one for every 3-family × 12-question pair;
- one CSCL-01 System Profile with 36 cell references and 90 source-native terminology entries.

Evidence state counts are 27 `SUPPORTED`, 3 `ABSENT`, and 6 `AMBIGUOUS`. Absence and ambiguity statements identify their captured-file search scope and do not generalize beyond the admitted bytes. No candidate or equivalence is derived; `candidateMeaningSha256` is a stable non-candidate sentinel distinct from native meaning.

Canonical artifact: `verification/cscl-02-odoo-community-profile-v1.json`.

## Replay and checks

```bash
node --test tests/cscl-02/odoo-profile.test.mjs
node --test tests/cscl-01/protocol.test.mjs
node --check src/cscl-02/odoo-profile.mjs
node --check tests/cscl-02/odoo-profile.test.mjs
```

Two offline builds produced byte-identical 133,639-byte artifacts with SHA-256 `23d58e71c999c4b1151899ba53610b21ee21c90da3d986f0872a01a352f18be3`.

## Boundaries and nonclaims

This profile preserves Odoo-native `res.partner`, `Contact`, `product.template`, `Product`, `product.product`, `Product Variant`, `sale.order`, `Quotation`, `Sales Order`, field, method, and state terminology. It does not create normalized names or cross-system equivalences. It grants no Authority, promotion, execution, production support, compatibility, procurement, customer-fit, common-core, Capability candidate, or holdout claim.
