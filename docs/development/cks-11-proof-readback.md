# CKS-11 proof readback

The offline proof package validates only deterministic local synthetic artifacts.
It is not an execution, promotion, merge, release, production activation, or
public-main readback. Its declared `promotionState` remains `DENIED` unless an
independent current external readback package provides exact PR, CI, merge,
no-activation, and public-main bindings. Synthetic, dry-run, and stale evidence
must remain scoped to their declared local purpose.

The parent receipt binds independent P19 and P20 child evidence. P19 requires
equal-or-better quality at lower reasoning cost plus all declared safe-abort
cases. P20 separately requires deterministic typed output or declared-error
parity and the exact retained original-step rollback. Neither child may be
substituted, re-digested, or inferred from the other. Delivery remains
`RELEASE_REQUIRED_PENDING_DELIVERY`; `releasePerformed` is `false`, so this
package makes no release claim.
