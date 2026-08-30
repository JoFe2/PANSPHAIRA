# CKS-12 delivery readback

Delivery readback is a deterministic local integrity check over the synthetic end-to-end receipt and final falsification-report receipt. It requires the exact eight package heads and a synthetic-only verdict; it rejects absent, stale, or untested readback inputs.

Delivery state: `RELEASE_REQUIRED_PENDING_DELIVERY`. This local proof does not claim a PR, merge, release, publication, anonymous release readback, or issue closure.

`node scripts/validate-cks-12-delivery-readback.mjs --dry-run`
