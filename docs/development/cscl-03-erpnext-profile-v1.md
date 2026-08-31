# CSCL-03 ERPNext v16.33.0 source-native system profile

Status: independently replayable training-system profile for issue #320. The released CSCL-01 protocol at PANSPHAIRA `2026_08_31_v2` / `201baa3ed96b71e9577189b208435bdbb589fcba` is consumed unchanged.

## Frozen identity and legal boundary

- System: ERPNext
- Selector: `refs/tags/v16.33.0`
- Commit: `b24c9eba551905e256e336ff170a91a92d197a2f`
- Official repository: `https://github.com/frappe/erpnext.git`
- Captured byte origin: immutable `https://raw.githubusercontent.com/frappe/erpnext/b24c9eba551905e256e336ff170a91a92d197a2f/...` URLs only
- License: `GPL-3.0-only`
- Exact `license.txt`: 35,149 bytes, SHA-256 `3972dc9744f6499f0f9b2dbf76696f2ae7ad8af9b23dde66d6af86c9dfb36986`
- Exact project metadata `README.md`: 6,791 bytes, SHA-256 `709f84a1d8ef170c362070a80a717cb4a779b66b7202738820d9f836deb42c9a`

`README.md` remains typed as `PROJECT_METADATA`; it is not relabeled as a repository notice. Source Facts therefore record `noticeStatus: ABSENT_AT_PIN` and retain the exact README attribution separately.

## Captured official source bytes

Nine exact files are stored as canonical Base64 transport under `tests/fixtures/cscl-03/source-snapshots/`. Their decoded total is 306,404 bytes, below the frozen 20 MiB cap:

1. `license.txt`
2. `README.md`
3. `erpnext/selling/doctype/customer/customer.json`
4. `erpnext/selling/doctype/customer/customer.py`
5. `erpnext/stock/doctype/item/item.json`
6. `erpnext/stock/doctype/item/item.py`
7. `erpnext/selling/doctype/sales_order/sales_order.json`
8. `erpnext/selling/doctype/sales_order/sales_order.py`
9. `erpnext/selling/doctype/sales_order_item/sales_order_item.json`

The capture manifest binds each source path, immutable URL, Base64 snapshot path, decoded byte length, and raw SHA-256. Capture requires the explicit `--network` switch and refuses redirects. Build and verification are offline by default.

```bash
# Explicit network capture; not needed for normal replay
node src/cscl-03/profile-cli.mjs capture --network \
  --repo-root . \
  --fixture-root tests/fixtures/cscl-03

# Offline deterministic build and independent verification
node src/cscl-03/profile-cli.mjs build \
  --repo-root . \
  --fixture-root tests/fixtures/cscl-03 \
  --output-dir verification/cscl-03-build-v1
```

## Source-native profile result

The output contains exactly 36 family/question cells: twelve frozen questions for each of:

- `PARTY_CUSTOMER_MANAGEMENT`, expressed only with ERPNext terms such as `Customer`, `Customer Type`, `Customer Group`, `Disabled`, and `Is Frozen`;
- `PRODUCT_ITEM_MANAGEMENT`, expressed only with ERPNext terms such as `Item`, `Item Code`, `Variant Of`, `Default Unit of Measure`, `Opening Stock`, and `Item Price`;
- `SALES_ORDER_MANAGEMENT`, expressed only with ERPNext terms such as `Sales Order`, `Sales Order Item`, `Status`, `Delivery Status`, `Billing Status`, and `Closed`.

Each cell references one schema-valid Source Fact. Every Source Fact binds the released selector-set digest, exact immutable raw URL, whole-source raw SHA-256, zero-based byte range with exclusive `byteEnd`, exact excerpt SHA-256, legal record, parser `cscl03-source-native-extractor@1.0.0`, canonicalizer `cscl01-sorted-key-json@1.0.0`, and no-authority boundary. Every cell digest and profile digest is recomputed rather than trusted from the caller.

The three `absence-ambiguity-conflict` cells are explicit `AMBIGUOUS` records. Additional ambiguity is retained where Customer and Item controls do not evidence a single named workflow status model. Sales Order's separate `Status`, `Delivery Status`, `Billing Status`, and `Advance Payment Status` are preserved rather than collapsed.

## Fail-closed replay

Focused tests deny:

- mutable tag URLs, mirror or path substitution;
- source length/SHA or non-canonical Base64 drift;
- version, commit, legal, parser, or canonicalizer drift;
- missing family/question cells or source facts;
- invented or re-digested fact claims;
- broken fact/cell/profile pairings;
- extra or hidden `Authority` fields;
- caller-normalized terminology;
- implicit network capture.

## Outputs and nonclaims

Canonical outputs are in `verification/cscl-03-build-v1/`:

- `source-facts-v1.json`
- `evidence-cells-v1.json`
- `system-profile-v1.json`
- `build-receipt-v1.json`

This profile derives no cross-system concept, common core, candidate classification, compatibility conclusion, procurement conclusion, customer-fit conclusion, or complete ERPNext coverage claim. It inspects no holdout semantics and grants no authority, promotion, execution, or write capability.
