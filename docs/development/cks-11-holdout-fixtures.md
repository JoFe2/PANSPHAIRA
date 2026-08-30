# CKS-11 P19/P20 holdout fixtures

`p19-p20-holdouts-v1.json` binds the P19 applicable quality/cost claims to two
existing shadow projections and declares the P20 stable typed substep boundary.
P19 must have two applicable holdouts plus the four exact safe aborts:
`INVALID_INPUT`, `VERSION_DRIFT`, `BOUNDARY_UNAVAILABLE`, and
`AUTHORITY_WIDENING`. P20 accepts only identical typed `OUTPUT` or
`DECLARED_ERROR` results with original-step fallback, readback, and rollback
receipt bindings.

The companion rejection manifest requires mismatch, unbound rollback, dry-run,
synthetic, stale, and unverified-external material to remain fail-closed. Both
fixtures are local synthetic evidence only and set `promotionState: DENIED`.
They cannot establish promotion, activation, merge, release, production
execution, or public-main state.
