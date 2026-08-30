# CKS-12 falsification report

The final synthetic-only report closes the 23 immutable Part-II step bindings. It is accepted only when the exact accepted package-head set is present and each gate is independently represented: quality, critical and total requirement recall, false completeness, attributed failures, Function/Workflow cost, and declared stop conditions.

The validator fails closed on a missing, stale, conflicting, unauthorized, or untested package head. It records `PASS_SYNTHETIC_ONLY` only for the frozen synthetic fixture; the receipt has `authority`, `capabilityDelta`, and `effect` fixed to `NONE`, and it makes no production claim.

The report retains all raw baseline/candidate counts, confusion counts, abstentions, unresolved cases, receipt failures, exclusions, exact denominators, and all nine stop-condition classes. Delivery remains `RELEASE_REQUIRED_PENDING_DELIVERY`; this report is not release evidence.

Run after compilation:

`node scripts/run-cks-12-falsification-report.mjs --dry-run`
