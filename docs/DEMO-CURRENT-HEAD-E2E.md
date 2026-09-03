# Current-head Docker E2E contract

This is the bounded scheduled and release gate for issue #377. It reuses the
published local synthetic demo lifecycle; it does not introduce another
installation or Authority model. Operating Model v1.1 and D-001 through D-007
remain unchanged.

## Execution and cost boundary

`.github/workflows/demo-current-head-e2e.yml` runs weekly, on explicit manual
dispatch, and as a reusable release prerequisite. It does not run Docker on
ordinary pull requests. Pull requests run the focused, non-Docker contract
suite:

```sh
node --test tests/demo-current-head-e2e*.test.mjs
```

The workflow accepts a release target only from its release-event caller. The
target must be a lowercase 40-hex commit, checkout must resolve to that exact
commit, and tracked bytes must be clean. The direct scheduled/manual target is
the immutable event SHA. Checkout, Node and artifact actions use full commit
pins; Node, npm and Docker Compose use repository-declared exact versions. The
Compose binary is downloaded from the lock URL and verified before use.

The job is globally serialized because the legacy demo has a compatibility
image tag, uses the isolated project name
`pansphaira-e2e-<run-id>-<attempt>`, has a 45-minute job limit and gives the
runner 2,100 seconds. The runner reserves ten minutes of job budget for
fail-closed purge and artifact retention. Services bind only to explicit
loopback ports. Registry/build inputs are the digest-pinned declarations in
`demo/manifests/supply-chain/artifact-lock-v1.json`; runtime service networks
are internal or have IP masquerading disabled. No arbitrary provider endpoint
is accepted.

## Positive lifecycle

The runner performs, in order:

1. exact commit/tree, clean-checkout, lock and empty-namespace preflight;
2. `SAFE_DEMO_COLD` through `demo/acceptance.sh`, which invokes the canonical
   installer and its existing executable acceptance assertions;
3. a fresh `demo/readback.sh` provider readback and a five-service healthy
   Compose snapshot;
4. minimized receipt construction from observed values rather than a caller
   PASS field;
5. `demo/uninstall.sh --purge`, followed by label-scoped fallback cleanup and
   a zero-residue readback; and
6. sanitation, closed artifact-set validation and receipt revalidation.

For E2E runs, `CM_DEMO_RUN_OWNER` must exactly equal the Compose project. The
runtime image receives that run-owner label. Uninstall requires both the
pre-existing installer-owner label and the exact run-owner label before image
removal. Fallback cleanup selects only the exact Compose project or run-owner
label. A different owner is never treated as disposable residue.

## Receipt and retained evidence

A successful `receipt.json` uses
`pansphaira.demo/current-head-e2e-receipt/v1` and binds:

- exact commit and tree;
- Compose file, digest-verified Compose CLI, package lock, supply-chain lock,
  every declared OCI reference and the locally resolved immutable runtime
  image ID;
- SAFE_GUIDED authority, admin policy, catalogue, identity, synthetic fixture
  and local-egress-policy digests;
- all five service states and health results;
- the current-byte governed CRM-to-ERP effect receipt;
- a minimized digest plus SHA-256 of fresh authoritative provider readback;
- install and acceptance evidence digests, elapsed budget and timeout state;
- ownership-scoped cleanup, state removal and zero containers, volumes,
  networks and run-owned images; and
- the exact sanitation and nonclaim boundary.

Only `receipt.json`, `e2e.log` and `cleanup.log` are retained for 14 days.
Provider payloads and generated credentials are not retained. Before writing,
known generated secret values, repository/temp/home roots, common hosted-runner
paths, credential-shaped values and ANSI control sequences are removed. A
second scan rejects any retained file that still contains a secret value,
credential pattern or runner path. The receipt contains synthetic counts,
status and digests only; it is not customer-data or production evidence.
Failures retain a sanitized `failure.json` and logs, never a success receipt.
The workflow always performs a second idempotent purge before upload.

## Fail-closed and release completion

`verification/demo-current-head-e2e/contract-v1.json` is the closed six-criterion
mapping. The focused suite proves that each of these cannot validate after the
receipt is re-digested: failed health, wrong fixture, missing readback, owned
residue, timeout and stale receipt. It also covers stale head, caller-authored
PASS, missing negative proof, failed hard gate, overclaim, issue not publicly
CLOSED, Queue not DONE and residual ownership.

`release/governance.json` requires the reusable E2E before anonymous public
release readback. Final completion is stricter than publication: the retained
artifact and all hard gates must be successful provider readbacks for the same
commit/tree, the E2E must complete after the released-tree timestamp and be no
more than seven days old, all negative case IDs must be present, issue #377
must read publicly as `CLOSED`/`COMPLETED`, and the authoritative Queue item
must be `DONE`, unowned and have no residual ownership. A release body,
caller-supplied PASS, re-digested receipt or local package state cannot
substitute for those observations.

The final owner can execute the same validator with:

```text
npm run demo-current-head-e2e:completion -- --envelope <provider-readback-envelope> --target-sha <release-sha> --target-tree <release-tree> --now-ms <epoch-ms>
```

The validator is read-only. It grants no publication, issue, Queue, provider,
credential, production or Authority mutation capability. The local worker does
not claim those final external states; the final owner performs and reads them
in the existing D-001 through D-007 sequence.
