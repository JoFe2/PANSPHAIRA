# PAN575 opt-in real-local-model qualification entrypoint

One additive source-only entrypoint, `scripts/run-pan575-local-model-qualification.mjs`,
on top of the EXISTING mechanisms: the ACTUAL native565 owner composition APIs
(`createNativeCompositionFeedbackModelV1` → `prepareNativeCompositionFeedbackV1`
→ confirm → `runNativeCompositionFeedbackV1`), the `ModelAccessBrokerV1`
canonical request contract (`chimpmaera.model/model-request/v1`, six-field
budget `maxCostMicros/maxInputBytes/maxOutputBytes/maxRequests/maxTokens/timeoutMs`),
the existing bounded broker tool-feedback loop (LOOP-AC01..05 end reasons,
UNKNOWN_USAGE retention on unconfirmed paths), the existing pan565 owner-bound
local connection transport and the actual Original574 native tools. No second
harness, no second budget ledger, no provider fallback, no alternate request
builder: the consumer path IS the owner path. All tests here are deterministic
LOCAL scripted HTTP against a self-certified fake provider — real inference
never runs in the default suites.

- Real inference is opt-in only: consent environment
  `PAN575_LOCAL_MODEL_QUALIFICATION=REAL_LOCAL_MODEL_RUN_V1` plus a bounded
  CLOSED config (loopback-only origin, owner limits inside the existing
  ceilings `maxCostMicros<=100000`/`maxRequests<=3`, bounded grant expiry,
  code-owned probe test digest). The exact required fields are
  `origin, model, deploymentId, configurationRevision, credentialFile,
  receiptDir, stateDir, sessionOrigin, runtimeIdentityPath, sessionSubject,
  pricing, limits, expectedTestDataDigest, expiresAtMs` — anything else denies
  with exit 5. Example (placeholder values):

  ```json
  {
    "origin": "http://127.0.0.1:8787",
    "model": "model:local-qwen",
    "deploymentId": "local-qwen-deployment",
    "configurationRevision": 1,
    "credentialFile": "/owner/private/local-model.secret",
    "receiptDir": "/outside/repo/receipt-run",
    "stateDir": "/owner/private/pan575-state",
    "sessionOrigin": "https://app.pan575.example",
    "runtimeIdentityPath": "/owner/private/runtime-identity.json",
    "sessionSubject": "synthetic:pan575-qualification",
    "pricing": {"currency":"EUR","revision":1,"inputMicrosPerMillionTokens":0,"outputMicrosPerMillionTokens":0},
    "limits": {"maxCostMicros":100000,"maxTimeMs":30000,"maxTurns":3,"maxTools":2,"maxRequests":3,"maxTokens":4096,"maxInputBytes":65536,"maxOutputBytes":65536},
    "expectedTestDataDigest": "<MODEL_CONNECTION_TEST_DATA_DIGEST_V1>",
    "expiresAtMs": 1762500000000
  }
  ```

  `expectedTestDataDigest` must equal the code-owned probe digest
  `MODEL_CONNECTION_TEST_DATA_DIGEST_V1`; the composition payload/offer
  digests stay OWNER-DERIVED (receipt `composition.payloadDigest`/
  `composition.offerDigest`), never config-supplied. `stateDir` is an existing
  owner-owned `0700` directory OUTSIDE the repo holding the session envelope,
  the browser-profile model-connection row and the durable cost-ledger
  databases; `sessionOrigin` is the protected session adapter's own hosted
  https origin and `runtimeIdentityPath` a genuine runtime-identity document.
  BOUNDARY: this utility proves a bounded owner-bound observation only. It
  proves NOTHING about model provenance, does not exercise the browser, does
  not complete full issue 575 and is not in scope for 565.
- Bounded stable owner custody: `stateDir`, principal (subject/identity) and
  ledger identity are the SAME across invocations and must stay that way. A
  retained UNKNOWN hold or settled history is never evaded by pointing the
  next run at a different state root, subject or identity — a repeat
  invocation over the same custody either observes the retained hold and
  refuses BEFORE any additional inference POST, or (after settled history)
  keeps the conservation math fixed: the prior settled row keeps its exact
  state and consumed units and the fixed ceilings keep applying (a further
  run denies on the exhausted ceiling, no budget reset).
- Owner-bound identity: the secret is read only through the existing
  protected owner-file primitive, bound at transport bind time by sha256
  fingerprint; every admission point re-checks grant expiry, the wall-clock
  deadline and the live secret fingerprint. The existing loop revalidates
  current authority after the provider returns and BEFORE invoking any tool,
  so rotation mid-run ⇒ `LOOP_OWNER_STALE` immediately with zero tool
  effects and retained unknown usage. A config label alone never establishes
  provenance: only an actually observed `GET /v1/models` 401→200 exchange,
  the exact model-id echo and broker-guarded provider turns count as
  owner-bound live observations; browser/UI evidence is out of scope
  (`NOT_EXERCISED`).
- Composition wire identity (code-owned, corrected): dispatch is owner-driven
  and the owner's closed transport adapter owns the wire presentation. The
  exact Original574 pair keeps its dotted NATIVE identity end-to-end and
  reaches the provider ONLY through the closed composition binding
  `MODEL_COMPOSITION_WIRE_ALIAS_V1` (`pan522.material.plan →
  pan522_material_plan`, `erp.order.create → erp_order_create`) inside
  `src/pan565/connection-transport.mjs` — the provider-safe names already
  proven against the real server in run04, because the real local Qwen server
  rejects dotted function names (`must match [A-Za-z0-9_-]{1,256}`). The
  mapping is closed: the ONLY admitted composition shape is the exact pair, a
  proper subset, any mixture or unknown dotted name denies as
  `MODEL_CONNECTION_WIRE_NAME_DENIED` before dispatch; there is no generic
  normalization, no caller-selected mapping and no dotted fallback. The same
  closed mapping re-maps the assistant transcript and restores every provider
  response name back to the dotted native identity, so the ORIGINAL
  broker/tool guards only ever see the native pair. If a provider rejects the
  alias pair, the run denies as a bounded `LOOP_PROVIDER_DENIED` with the
  ledger hold retained — reported, not hidden.
- Receipts separate the layers: REACHABILITY, AUTHENTICATION,
  MODEL_AVAILABILITY, INFERENCE phases plus `scope.directTransport`,
  `scope.nativeLoop`, `scope.browser`, `scope.fullIssue575`,
  `scope.fullIssue565`. A completed loop reports only honest owner-bound
  observation labels — verdict
  `OWNER_BOUND_COMPOSITION_LOOP_OBSERVED_REAL_MODEL_NOT_QUALIFIED`,
  `scope.directTransport=OBSERVED_OWNER_BOUND_EXCHANGE`,
  `scope.nativeLoop=OBSERVED_OWNER_COMPOSITION_TOOL_LOOP_MODEL_PROVENANCE_PENDING`
  — never a `REAL_LOCAL_MODEL_TOOL_LOOP_QUALIFIED` or
  `QUALIFIED_ACTUAL_LOCAL_MODEL` false qualification. Deployment/model
  provenance stays a separate, parent-bound real-model proof: no config label
  and no scripted fake provider can establish it.
- Durable accounting IS integrated against the owner's OWN ledger
  (`durableOwnerLedger=INTEGRATED_OWNER_BOUND_COST_LEDGER_V1`), but the label
  is NOT proof: the receipt reports ACTUAL observed exact-row states via
  `observeOwnerLedgerReservationV1`. Observation addresses ONLY the bound
  authenticated principal (`sessions.authenticate(headers)` +
  `profiles.readModelConnection(principal)`), the exact current identity
  digest and one exact `operation_id`, using the owner's own path algorithm
  (`native-model-budget-` + canonical hash of `principalKey + ':' +
  identityDigest`). No directory enumeration, no SELECT-all, no foreign
  principal/operation rows, no directory-derived operation ids (exercised:
  planted foreign operation rows in the SAME database and foreign
  principal/identity ledger directories never appear in the serialized
  observation or receipt). The ledger path is never followed through a
  symlink and everything fail-closes: a missing ledger directory/file/row
  reports `NO_RESERVATION` while an unreadable (garbage) SQLite file, a
  symlinked ledger path or a row whose accounting is malformed or corrupt
  reports `OBSERVATION_UNAVAILABLE` — DISTINCT states, and unavailable,
  missing or corrupt is never promoted to `NO_RESERVATION` or to an
  accounting PASS (exercised with sentinel bytes/modes verified preserved
  and zero provider requests). Before the own reservation exists the
  conservative answer is `NO_RESERVATION` (`stateBeforeReservation`); a
  retained prior hold is observed only as the exact `lastOperation` the
  profile row names. Durability is an ACCOUNTING PREDICATE over the TWO
  ACTUAL exact-operation snapshots — the full accounting tuple captured
  BEFORE close (`reservationBeforeClose`) and AFTER the full owner/profile
  reopen (`reservation`) must each carry admissible owner accounting
  (closed state, complete safe-integer units, non-negative, consumed <=
  reserved, units inside the fixed owner ceilings, no consumption before
  settlement) and the complete {state,reserved,consumed} tuple must be
  identical (`reservationDurableAcrossReopen`). Two equal `NO_RESERVATION`
  or `OBSERVATION_UNAVAILABLE` labels, or equal-but-corrupt fields, can
  never satisfy it. The exit-0 observation requires this predicate, not a
  `SETTLED` label (exercised: the genuine full-ceiling dispatch-fence row —
  `UNKNOWN_USAGE`, 100000/3, zero consumption — is observed by a raw
  read-only SQLite read AND by the exported observer while the FIRST POST
  is in flight, before any response or tool effect; the settled reopen
  conserves the exact tuple including `modelConsumed=2`/`runtimeConsumed=2`
  at the exercised synthetic prices). UNKNOWN holds retain the full
  `maxCostMicros`/`maxRequests` ceiling and survive the reopen: a repeat
  qualification over the SAME stable `stateDir`/principal/runtime identity
  with only a FRESH output `receiptDir` refuses redispatch BEFORE any
  additional inference POST and leaves the prior UNKNOWN row unchanged;
  after settled history a repeat over the same custody preserves the prior
  exact row/consumption and denies a new full reservation against the
  remaining fixed ceiling (`MODEL_CONNECTION_BUDGET_EXHAUSTED`) — no
  delete/recreate of occupied receipts or held ledgers, no budget reset,
  no root/subject/identity change. Raw paths and private exception strings
  never enter the receipt.
- Output custody (run08 hardening, run09 correction). The receipt output
  `qualification-receipt.json` is reserved BEFORE any native tool action or
  network request as a NEW regular file, opened exclusively with
  `O_WRONLY|O_CREAT|O_EXCL|O_NOFOLLOW` (destructured from the `node:fs`
  `constants` export — `node:fs` exposes these flags ONLY via `constants`,
  there are no top-level ESM `O_*` exports) inside the realpath-validated
  receiptDir. A pre-existing leaf — regular file, symlink (owned or
  dangling) or directory — denies the run with exit 5 and
  `QUALIFICATION_RECEIPT_OUTPUT_OCCUPIED` and ZERO provider calls; the
  pre-existing bytes/mode/type are preserved (the denial cannot touch the
  leaf: the reservation writes only through the exclusively opened
  `O_EXCL` fd) and the output is never removed and recreated as a
  workaround. Immediately after the claim — before any binding or network
  action — the bound fd writes a small parseable IN_PROGRESS/UNKNOWN
  non-success record (`state=IN_PROGRESS`, `exitCode=null`,
  `realModelAcceptance=false`, never a false PASS), so an interrupted
  network attempt leaves truthful evidence instead of zero bytes. At
  completion the SAME fd positionally rewrites the file from offset 0
  (each write binds buffer offset, remaining length and file position)
  and then truncates to the final written length — no leaf-path
  re-resolution, no path-based chmod/write, no replacement, no stale
  suffix from the in-flight record — and `fchmod(0600)` is applied to the
  fd (closed in the completion `finally`), so an existing symlink cannot
  redirect the write outside the admitted receiptDir; an interrupted run
  finalizes through that fd with truthful
  `NOT_RUN`/`UNKNOWN`/`FAILED` phases, never a false PASS. A config or
  binding deny before the network releases the owned reservation (exact-
  owned cleanup: unlinked only while the leaf is still exactly the file
  opened, so an existing unrelated file is never removed).
