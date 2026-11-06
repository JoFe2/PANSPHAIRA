# PAN575 opt-in real-local-model qualification entrypoint

One additive source-only entrypoint, `scripts/run-pan575-local-model-qualification.mjs`,
on top of the EXISTING mechanisms: the `ModelAccessBrokerV1` canonical request
contract (`chimpmaera.model/model-request/v1`, six-field budget
`maxCostMicros/maxInputBytes/maxOutputBytes/maxRequests/maxTokens/timeoutMs`),
the existing bounded broker tool-feedback loop (LOOP-AC01..05 end reasons,
UNKNOWN_USAGE retention on unconfirmed paths), the existing pan565 owner-bound
local connection transport and the actual Original574 native tools. No second
harness, no second budget ledger, no provider fallback.

- Real inference is opt-in only: consent environment
  `PAN575_LOCAL_MODEL_QUALIFICATION=REAL_LOCAL_MODEL_RUN_V1` plus a bounded
  closed config (loopback-only origin, owner limits inside the existing
  ceilings, bounded grant expiry, expected test-data digest). Nothing here
  runs in the default CI suites; the deterministic tests drive a scripted
  fake provider, which is self-certified and therefore never model
  acceptance (`realModelAcceptance=false`, `evidenceClass`
  `OWNER_BOUND_NOT_QUALIFIED`, synthetic fixtures are never relabelled).
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
  (NOT_EXERCISED).
- Wire-alias binding (run04 correction). The first real-server run reached
  inference and failed with a genuine HTTP 400 from the actual local Qwen
  server: `function name 'pan522.material.plan' must match
  [A-Za-z0-9_-]{1,256}` in `tools[0].function.name` — the dotted Original574
  capability IDs are valid NATIVE identities but provider-INCOMPATIBLE wire
  names, and the earlier scripted peer did not model this boundary. The
  utility now presents a utility-local CLOSED alias mapping
  (`pan522.material.plan -> pan522_material_plan`,
  `erp.order.create -> erp_order_create`) as the declared provider tool
  names. These are documented presentation aliases only: the native
  capability IDs, authority, grants and schemas are unchanged; each alias
  stays bound to the ORIGINAL already-authorized `invoke`/`validate` pair
  and the exact native identity (the native readback still carries and is
  validated against the original `capabilityId`). Missing, unknown,
  duplicate or provider-unsafe aliases deny the run with
  `QUALIFICATION_ALIAS_DENIED` (exit 5, before any network action); aliases
  are declared host-side, never a model-selectable registry. The alias
  binding is part of the deterministic test-data/config identity (hashed
  into `expectedTestDataDigest`) and appears in the receipt as
  `toolAliasBinding`, `toolAliasBindingDigest`, `nativeCapabilities` and
  `toolWireNames`. The deterministic test peer now enforces the real
  wire-name character/length contract (portable `<=64` chars, compatible
  with the real server's 256-char cap) and would have rejected the old
  dotted descriptors, and the real local-model entrypoint must be rerun
  against the actual server before any interop claim.
- Receipts separate the layers: REACHABILITY, AUTHENTICATION,
  MODEL_AVAILABILITY, INFERENCE phases plus `scope.directTransport`,
  `scope.nativeLoop`, `scope.browser`, `scope.fullIssue575`,
  `scope.fullIssue565`. A completed loop reports only honest owner-bound
  observation labels — verdict `OWNER_BOUND_TOOL_LOOP_OBSERVED_REAL_MODEL_NOT_QUALIFIED`,
  `scope.directTransport=OBSERVED_OWNER_BOUND_EXCHANGE`,
  `scope.nativeLoop=OBSERVED_TOOL_LOOP_MODEL_PROVENANCE_PENDING` — never a
  `REAL_LOCAL_MODEL_TOOL_LOOP_QUALIFIED` or `QUALIFIED_ACTUAL_LOCAL_MODEL`
  false qualification. Deployment/model provenance stays a separate,
  parent-bound real-model proof: no config label and no scripted fake
  provider can establish it.
- Durable accounting and unknown-usage reconciliation against the owner
  ledger are NOT integrated here: the receipt carries
  `durableOwnerLedger=NOT_INTEGRATED_ORIGINAL_CRITERIA_UNFULFILLED` and the
  existing loop readback labels are unchanged. This entrypoint is a bounded
  observation utility, not full issue delivery and not live product
  authorization; the original issue criteria remain unfulfilled.
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
