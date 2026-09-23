# PAN442 — local bound business task and opaque tool handle journey

Status: `LOCAL_SYNTHETIC_BOUND_TASK_IMPLEMENTED` (repository-only)

This implements one bounded synthetic business task: an ordinary caller uses a
**server-issued opaque handle** plus an allowed operation input to create one
synthetic Dolibarr sales order through the accepted demo Order seam. The
caller never assembles authority payloads, and a caller-selected source plus
caller-selected digest is **not** an authority root.

It is a local synthetic bound task, **not** live authentication, **not** a
global exactly-once guarantee, **not** a public write, and **not** a real
provider. No private input, external model, runtime or model change is used.

## Reused actual foundation (additive; nothing modified)

| Accepted foundation | PAN442 use | Classification |
| --- | --- | --- |
| `demo/runtime/admin-ai-poc.mjs` `AdminAiPoc.decide` | Produces the `SYNTHETIC_DOLIBARR_ORDER_CREATE` decision with outcome `OWNER_ESCALATION` | REUSE |
| `demo/runtime/approval-workbench.mjs` `ApprovalWorkbench.register` / `decide` | Registers the escalation proposal; the local owner `owner:local-demo` approves; issues the owner-escalation lease authority | REUSE |
| `demo/runtime/enforcement-gate.mjs` `DemoMutationGate.execute` (owner-escalation lease path) | Single execution under the lease with mutation reservation and semantic readback | REUSE |
| `demo/runtime/authoritative-approval-snapshot.mjs` | Authoritative approval snapshot and business diff of the canonical Order action | REUSE |
| `demo/manifests/authority/admin-ai-poc-policy-v1.json` | The pinned policy bytes and digest | REUSE |
| canonical Order action (AAS-016-2 positive path) | scope `dolibarr / panskys-zoo-demo / Order / CREATE_IF_ABSENT`, payload `POST /orders` body `{ref_client: CM-ADMIN-AI-ESCALATION-001, socid: 7, date: 1767225600}`, requester `requester:local-demo`, purpose `CREATE_SYNTHETIC_SALES_ORDER`, budget `EUR 0.00` | REUSE (canonical seam) |

No second gateway, scheduler, journal platform, identity provider, policy,
approval or lease mechanism is introduced. The existing policy, approval,
lease and origin/CSRF restrictions are preserved unchanged.

## The bound binding (server-side authoritative)

A clearly-labelled **synthetic trusted task source** (`LOCAL_SYNTHETIC`, not a
live identity-provider claim) is retained outside caller-controlled payloads.
At creation time the issuer binds, into an immutable and deep-frozen
`binding`:

- the object identity (provider, entity, operation, refClient, customerId,
  orderDateEpoch) and its `objectVersion`;
- `purpose`, `tenant`, `user` and the run identity `runId`;
- the `amountLimitMinor` / `currency` limits;
- the `issuedAtMs` / `expiresAtMs` window;
- `sourceDigest` (the attested trusted-source digest), `principalDigest` and a
  `secretFingerprint`.

The opaque handle is
`base64url(canonicalJson({v:1, d:handleDigest, s:signature}))` where
`handleDigest = sha256(canonicalJson(binding))` and
`signature = sha256(issuerSecret || handleDigest)`. The handle is opaque to the
caller and single-use; the resolver re-derives the signature from the trusted
store, never from caller input.

## Fail-closed use-time checks (exact codes, failed stage)

Every check runs **before** any provider mutation, read or business output,
short-circuits at the first failure, and pins the failed stage:

| Stage | Denial code | Trigger |
| --- | --- | --- |
| OPERATION | `BTH_OPERATION_INVALID_DENIED` | operation input deviates from the exact key set (caller-supplied source/digest/binding fields are not an authority root) |
| HANDLE_INVALID | `BTH_HANDLE_INVALID_DENIED` | handle is not a well-formed v1 token (guessed/malformed) |
| LOOKUP | `BTH_HANDLE_UNKNOWN_DENIED` | well-formed handle digest was never issued |
| SIGNATURE | `BTH_HANDLE_TAMPERED_DENIED` | token signature does not re-derive from the trusted store (handle-field edit) |
| SIGNATURE | `BTH_BINDING_DIGEST_MISMATCH_DENIED` | the stored binding's canonical digest does not re-derive to the signed handle digest (stored-binding substitution fails closed before any field compare) |
| EXPIRY | `BTH_HANDLE_EXPIRED_DENIED` | `now >= expiresAtMs` |
| TENANT | `BTH_TENANT_MISMATCH_DENIED` | operation tenant differs from the bound tenant |
| PRINCIPAL | `BTH_PRINCIPAL_MISMATCH_DENIED` | operation user differs from the bound user |
| RUN | `BTH_RUN_MISMATCH_DENIED` | operation run identity differs from the bound run |
| OBJECT | `BTH_OBJECT_MISMATCH_DENIED` | provider/entity/operation/refClient/customerId/orderDateEpoch differ |
| VERSION | `BTH_VERSION_MISMATCH_DENIED` | objectVersion differs from the bound object version |
| LIMITS | `BTH_AMOUNT_LIMIT_DENIED` / `BTH_CURRENCY_MISMATCH_DENIED` | declared amount exceeds the limit / currency differs |
| SUPPORTED | `BTH_BINDING_UNSUPPORTED_DENIED` | the bound task business scope (tenant/provider/entity/operation/refClient/customerId/orderDateEpoch/purpose/currency) is not the single fixture the accepted Order seam executes |
| COMPOSE | `BTH_COMPOSE_FAILED` | the accepted Order seam did not reach a fresh owner approval |
| EXECUTE | `BTH_EXECUTE_FAILED` / `BTH_HANDLE_REPLAY_DENIED` | the gate did not PASS / single-use handle already consumed |

On the negative paths there is exactly zero mutation and zero provider read,
and the failed stage is recorded.

## Authority-binding security properties (single-fixture adapter)

This adapter is explicitly **single-fixture**: the accepted demo Order seam
(`AdminAiPoc` `SYNTHETIC_DOLIBARR_ORDER_CREATE` → the fixed synthetic Order)
executes the exact business scope named by `SUPPORTED_ORDER_BINDING`. Three
properties keep the executed Order bound to the resolved task and keep the
trusted source / issued binding authoritative:

1. **F1 — executed Order is the resolved binding.** `BoundTaskHandleResolver`
   denies at the `SUPPORTED` stage, before any snapshot, approval, lease or
   provider effect, when a valid trusted binding's business scope differs from
   `SUPPORTED_ORDER_BINDING`. A valid alternate binding (different customer,
   ref, date, tenant, purpose or currency) therefore cannot execute an
   unrelated hardcoded Order; it is denied with `BTH_BINDING_UNSUPPORTED_DENIED`.
2. **F2 — issuance ignores the public lookup map.** The issuer builds a
   **private** index only from the digest-attested `tasks` array and reads the
   task from it. The public `byTaskRef` Map on the source is digest-excluded
   and mutable, but is never consulted as authority, so a caller `.set()` of an
   unattested task cannot grant that task (or its limits) into an issued
   binding; the binding retains the original principal and limits.
3. **F3 — the signed handle re-derives the stored binding.** Resolution
   recomputes the canonical digest of the stored binding (excluding its
   `handleDigest` field) and requires it to equal the signed handle digest
   before any field comparison. Replacing the stored binding or its
   `{binding, used}` wrapper therefore fails closed at `SIGNATURE`
   (`BTH_BINDING_DIGEST_MISMATCH_DENIED`) even though the token signature still
   validates, and the usage flag is kept separate from authorization data.

## Real positive entry point (A3)

`useBoundTaskHandle` in `src/pan442/bound-task-handle.mjs` is the real local
entry point. For a valid handle and matching operation input it composes the
accepted Order seam end-to-end:

1. resolve and run the staged use-time checks (all PASS);
2. `AdminAiPoc.decide` → `SYNTHETIC_DOLIBARR_ORDER_CREATE` → `OWNER_ESCALATION`;
3. `ApprovalWorkbench.register` + `decide(APPROVE)` by `owner:local-demo`;
4. `DemoMutationGate.execute` under the `OWNER_ESCALATION_LEASE_HMAC_V1`
   authority (single use, reservation, semantic readback);
5. retain the observed result separately in the issuer journal, pinning the
   approved owner actor, lease id and the receipt / business-diff / snapshot
   digests.

It must not silently bypass approval, lease or policy to make the
demonstration pass: the positive path reaches `PASS` only because the real
seam produces a fresh owner approval and a single gated execution.

## Explicit limits

- **Synthetic only**: `trust.label = LOCAL_SYNTHETIC`; this is not a live
  identity-provider claim and not live authentication.
- **Model text cannot grant approval**: approval is issued only by the local
  owner actor through the accepted workbench, never by model or caller text.
- **Not global exactly-once**: the single-use guarantee is per bound handle,
  not a distributed exactly-once property.
- **No public writes / real providers / external network.**
- **Additive**: the new contract and module are additive; no existing
  contract, policy, approval, lease or origin/CSRF semantics is modified.
