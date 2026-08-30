# CKS-05 Bounded Benchmark Protocol v1 (PSAI285-BENCHMARK-PROTOCOL-01)

Status: approved bounded protocol, design receipt only — execution NOT granted,
benchmark NOT run, model-substitution claim DENIED (no measurements)

Date: 2026-08-28

Normative parent:
[PSAI285 benchmark design decision](../evidence/conveyor/sol-psai285-benchmark-design-decision-01.json)
(decision receipt `PSAI285-BENCHMARK-PROTOCOL-01`, `APPROVE_BOUNDED_PROTOCOL`)

This document is the human-readable view of a fail-closed benchmark manifest.
The machine-readable contract is
[`schemas/cks-05-benchmark-manifest-v1`](../schemas/cks-05-benchmark-manifest-v1.schema.json)
(schema version `chimpmaera.cks05/benchmark-manifest/v1`), the valid fixture is
[`tests/fixtures/cks-05/benchmark-manifest-valid-v1.json`](../tests/fixtures/cks-05/benchmark-manifest-valid-v1.json),
and the binding test is
[`tests/cks-05-benchmark-contract.test.mjs`](../tests/cks-05-benchmark-contract.test.mjs).
Where prose and schema disagree, the schema and the decision receipt win.

## 1. Source binding

The approved decision receipt is bound by digest, not by path alone:

| Binding | Value |
| --- | --- |
| Receipt path | `docs/evidence/conveyor/sol-psai285-benchmark-design-decision-01.json` |
| Receipt byte digest (SHA-256) | `d2ef97d082197f2bd2ebbe22c09ef8ca512980d399a83679d1b05c34f5e2514a` |
| Protocol canonical digest (SHA-256 of RFC 8785-style canonical form: sorted keys, compact separators) | `6cb74f218a60ab8309aae5a0250196981778f412a6ab8b534162aa68d0e12ecd` |

Both digests are `const`-pinned in the schema and recomputed from the receipt
file by the contract test. Any drift between the receipt, the schema, or the
fixture fails the test before anything is executed.

Governance carried by the protocol:

- Operating Model v1.1; preserved decision IDs `D-001` through `D-007`; no new
  process variant introduced.
- Unknown-field policy: `REJECT` (closed schemas, `additionalProperties: false`
  at every level).
- Claim boundary: any eventual conclusion is limited to the exact frozen fresh
  synthetic domains, tasks, Knowledge editions, arms, model bytes, runtime
  bytes, host manifest, and run records admitted by this protocol.
- Execution authorization: `NOT_GRANTED_DESIGN_RECEIPT_ONLY`. Approving the
  protocol grants no model acquisition, service, credential, repository-effect,
  publication, merge, release, or issue authority.

## 2. Research question

Within four frozen fresh synthetic domains, can bounded structured Knowledge,
optional non-answer guidance, and a compact local model match the quality of a
larger local raw-facts profile while passing predeclared efficiency gates?

## 3. Model profiles (two local artifacts, SHA-256 pinned)

| Profile | Role | Artifact | Bytes | SHA-256 |
| --- | --- | --- | --- | --- |
| `MODEL-SMALL-VIBETHINKER-3B-Q8_0-ED81A97A` | SMALL | `vibethinker-3b-q8_0.gguf` (GGUF) | 3285476032 | `ed81a97aa6aa5a1c25664fe4e9721f009e19fe151c71dcec6a52553a24372f9f` |
| `MODEL-LARGE-QWEN3_8-27B-Q5_K_M-07DEB7FA` | LARGE | `Qwen3.8-27B-Q5_K_M.gguf` (GGUF) | 19834055648 | `07deb7fa91bf751d3000774fe5bb8afae5ffb41255fd19980147468052e07177` |

Both profiles: `maxInputTokens` 12000, `maxGeneratedTokens` 256, one response
per seed, no repair conversation, no hidden retry. One pinned llama.cpp
b10167 CPU-only runtime bundle
(`90097614d81dc8bfe758852b5af6002b6354fe2768b079820ed142201c516351`) serves
both; the runtime argv and environment allow-list are digest-pinned. A missing
or digest-mismatched profile is a `COMPETENCE_LIMIT` stop (STOP-01), not a
reason to substitute another model.

## 4. Arms

Five arms over the two profiles. Every arm runs the identical hidden task
suite, the identical Knowledge editions, the identical generation seeds, and
exactly one retrieval mode.

| Arm | Name | Profile | Representation | Payload |
| --- | --- | --- | --- | --- |
| `ARM-LRF-01` | LARGE_RAW_FACTS | LARGE | RAW | FACTS_ONLY |
| `ARM-SRF-02` | SMALL_RAW_FACTS | SMALL | RAW | FACTS_ONLY |
| `ARM-LSF-03` | LARGE_STRUCTURED_FACTS | LARGE | STRUCTURED | FACTS_ONLY |
| `ARM-SSF-04` | SMALL_STRUCTURED_FACTS | SMALL | STRUCTURED | FACTS_ONLY |
| `ARM-SSG-05` | SMALL_STRUCTURED_FACTS_AND_GUIDANCE | SMALL | STRUCTURED | FACTS_AND_NON_ANSWER_GUIDANCE |

Per-arm retrieval capabilities are closed and all false: `tools`, `network`,
`multiTurn`, `agenticLoop`, `crossRunMemory`, `effects`. The schema pins each
arm's profile binding; re-binding an arm to the wrong profile is rejected.

## 5. Cross-arm identity

Identical across all arms (never regenerated per arm, and question bytes are
identical across editions): `taskId`, `taskPromptCoreSha256`,
`goldRecordSha256`, `evidenceGraphSha256`, `editionId`, `editionSha256`,
`canonicalFactInventorySha256`, `scenarioPairId`, `domainId`, `hopClass`,
`updateSensitivity`, `generationSeed`, `maxInputTokens`,
`maxGeneratedTokens`.

Representation parity: raw and structured renderings per edition must share
the same canonical atomic-fact inventory digest and evidence IDs (parity
receipts are digest-pinned per edition). Any arm-specific task, version, or
edition substitution is rejected.

## 6. Task suite

- Four frozen fresh synthetic domains: `SYN-ASTER-LOGISTICS`,
  `SYN-BOREALIS-MAINTENANCE`, `SYN-CALDERA-ALLOCATIONS`, `SYN-DIONE-COMPLIANCE`.
- 4 scenario pairs per domain (16 pairs), 2 tasks per pair, 32 hidden tasks
  per edition.
- Hop strata: 16 `SINGLE_HOP` + 16 `MULTI_HOP`.
- Update sensitivity: 16 `UPDATE_SENSITIVE_TASKS` + 16
  `EDITION_INVARIANT_CONTROL_TASKS`.
- Freshness: domains, rules, entities, facts, updates, task bytes, gold
  labels, and evidence graphs are generated after profile lock, are entirely
  synthetic (never copied from the repository or a real organization), are
  never used for training or tuning, and remain hidden from model operators
  and models until each scored request.

Knowledge editions: `K0_STATIC` (frozen pre-update) and `K1_UPDATED` (frozen
post-update). Seeds: bootstrap and schedule digests are pinned; the
generation-seed list `[104729, 130363, 155921]` is pinned by its list digest
`350d921b7a2ed747911d1c32f9c1cb5c390d36c6b9ab769be7b0d1a79b105f84`.

## 7. Generation

Temperature 0.7, top-k 20, top-p 0.8, min-p 0, repeat penalty 1, presence and
frequency penalty 0, `maxGeneratedTokens` 256, streaming on, one response per
seed. Response contract: one JSON object containing `answerClaims`,
`evidenceIds`, and `finalAnswer`; no grammar-constrained decoding and no model
judge. Retry policy: `NO_RETRY` — a hidden retry or operator correction
requires a new protocol edition and preserves the original run.

## 8. Retrieval policy

Allowed mode: `EMBEDDED_CONTEXT` only — all edition-bound knowledge is
embedded in the single scored request prompt; the model never initiates
retrieval; exactly one response per predeclared generation seed.

Six forbidden modes, each with a closed rejection definition:

| Forbidden mode | Rejection |
| --- | --- |
| `RETRIEVAL_TOOL` | Frozen profiles have no tool, function, shell, filesystem, or network access |
| `EXTERNAL_ENDPOINT` | Isolated loopback-only servers, no egress route; no remote endpoint may serve knowledge |
| `MULTI_TURN_CONVERSATION` | One response per seed; no repair conversation |
| `AGENTIC_LOOP` | Agent mode off; no planning loop, tool loop, or effect execution |
| `CROSS_RUN_CACHED_STATE` | No cross-run memory; each run is stateless and independently derived |
| `OPERATOR_SUPPLIED_CORRECTION` | Requires a new protocol edition; the original run is preserved |

Each run record must name exactly one allowed mode; any observed forbidden
mode rejects the record as `EXECUTION_INVALID`.

## 9. Run plan

- Derivation (frozen before execution):
  `runId = run:<sha256(protocolDigestSha256|armId|taskId|editionId|generationSeed)>`,
  `pairKey = pair:<sha256(protocolDigestSha256|taskId|editionId|generationSeed)>`.
- Scheduled counts: 5 arms × 32 tasks/edition × 2 editions × 3 seeds =
  **960 scheduled run records**.
- Paired contrasts per edition: 96 paired executions (32 independent task
  units) per arm contrast; 96 paired executions (32 independent task units)
  per static-vs-updated contrast per arm; 48 paired executions (16 independent
  scenario-pair units) per single-vs-multi-hop contrast per arm/edition.
- Independence rule: generation seeds are repeated observations, not
  independent task units. Seeds are averaged within `taskId` before arm or
  edition inference; hop inference averages within `scenarioPairId`.
- Blocking unit: `taskId × editionId × generationSeed`.
- Arm order: digest-derived, balanced, cyclic, frozen before execution; no
  operator reordering after outputs are visible.
- Concurrency: at most **1** concurrent scored request; one isolated server
  per profile per seed session, preloaded (3 sessions per profile, 6 total).
- Warmup: explicit harness warmup only, excluded from scored metrics; cold
  load and peak resident memory are reported separately per session and never
  folded into scored evidence. Primary request efficiency starts immediately
  before the request byte write and ends after the final streamed response
  byte.

## 10. Provenance contract

- Attempt ordinal 1, append-only, no hidden retry.
- Terminal statuses: `COMPLETED`, `FAILED`, `INVALIDATED`; a failure code is
  null exactly when the terminal status is `COMPLETED`.
- Model failures scored zero (L1–L3 remained valid, failure inside the
  admitted envelope): `TIMEOUT`, `OOM_WITHIN_ADMITTED_ENVELOPE`,
  `NONZERO_RUNTIME_EXIT`, `MALFORMED_STREAM`,
  `OUTPUT_LIMIT_WITHOUT_VALID_FINAL`, `INVALID_JSON`,
  `REFUSAL_NO_VALID_ANSWER`, `RUNTIME_ERROR`.
- Infrastructure invalidations (never a product verdict): `HOST_DRIFT`,
  `CLOCK_INVALID`, `RESOURCE_SAMPLER_GAP`, `THERMAL_INVALID`,
  `UNRELATED_PROCESS_INTERFERENCE`, `HARNESS_SIGTRAP_EXIT_133`,
  `DOCKER_ENOENT`.
- Layer reject codes: L1 `COMPETENCE_LIMIT_OR_INTEGRITY_MISMATCH`, L2
  `PAIRING_OR_INPUT_MISMATCH`, L3 `EXECUTION_INVALID`, L4
  `SCORING_INVALID`, L5 `STATISTICS_INVALID_OR_CI_UNAVAILABLE`, L6
  `CLAIM_GATE_DENIED`.
- Run records carry timing (monotonic raw nanoseconds, clock resolution),
  resource samples (interval, count, coverage), exit status, and digests of
  stdout/stderr/response. Score records carry scorer and gold digests,
  per-metric true/false positive-negative counts, guidance constraint
  outcomes, multi-hop path correctness, and critical-violation codes.
- Preservation rule: original request, response if any, bounded stdout/stderr,
  exit status, timing, resource samples, failure code, and all digests remain
  append-only. Corrections use a new protocol edition and new run IDs.

## 11. Timing and resource collection

- Device mode `CPU_ONLY` (GPU zero invariant enforced); primary timing clock
  `CLOCK_MONOTONIC_RAW`; audit clock UTC RFC 3339 nanos, never used for
  latency; wall clock never used as latency.
- Request timeout 300 s; protocol wall-clock budget 72 h; at most 1
  concurrent scored request.
- Resource sampling every 100 ms; minimum valid sample coverage 0.99.
- CPU accounting: `/proc/<pid>/stat` user+system tick deltas converted with
  the frozen `_SC_CLK_TCK`, cross-checked against cgroup-v2 `cpu.stat`.
  Memory: cgroup-v2 `memory.current` + `/proc/<pid>/smaps_rollup` plus
  cgroup `memory.peak` when available. I/O: cgroup-v2 `io.stat` deltas per
  request block. Energy: RAPL all-ARM continuous or not available, never used
  as a claim gate when unavailable.
- Validity conditions: identical host-manifest digest and cgroup limits for
  every arm; no overlapping scored request, model acquisition, update,
  backup, build, or unrelated benchmark; no swap-in or major-fault anomaly
  beyond the predeclared host threshold; no thermal throttling or CPU-set
  drift; at least 99 percent resource-sample coverage.

Quality metrics (9): `task_success`, `atomic_fact_f1`,
`evidence_attribution_f1`, `unsupported_claim_rate`, `stale_claim_rate`,
`guidance_adherence`, `multi_hop_path_accuracy`, `critical_violation_rate`,
`model_failure_rate`.

Efficiency metrics (9): `time_to_first_token_ms`, `time_to_final_ms`,
`prompt_tokens`, `generated_tokens`, `decode_tokens_per_second`,
`cpu_seconds`, `peak_resident_bytes`, `cold_load_ms`,
`energy_joules_optional`.

## 12. Claim gate (L6-MODEL-SUBSTITUTION)

Pre-execution status: **`DENY_NOT_EXECUTED`**. No model-substitution claim
before execution; no early success — interim evidence may stop for integrity,
harm, competence, or futility, but can never pass a quality, efficiency,
architecture, or substitution gate before the complete scheduled design is
present.

Quality thresholds (paired deltas unless noted, 95% confidence):

1. Overall `task_success` delta lower bound ≥ −0.03.
2. Overall `atomic_fact_f1` delta lower bound ≥ −0.02.
3. Multi-hop `task_success` delta lower bound ≥ −0.05.
4. `unsupported_claim_rate` delta upper bound ≤ +0.01.
5. `stale_claim_rate` delta upper bound ≤ +0.01.
6. `ARM-SSG-05` absolute overall `task_success` lower bound ≥ 0.80.
7. `ARM-SSG-05` absolute multi-hop `task_success` lower bound ≥ 0.75.
8. `ARM-SSG-05` has zero critical violations and its `model_failure_rate`
   upper bound ≤ 0.05.

Efficiency thresholds:

1. `ARM-SSG-05` vs `ARM-LRF-01` paired `time_to_final` point ratio ≤ 0.70 and
   upper 95% ratio bound ≤ 0.80.
2. `ARM-SSG-05` vs `ARM-LRF-01` paired `cpu_seconds` upper 95% ratio bound
   ≤ 0.80.
3. Median of the three small-to-large `peak_resident_bytes` session ratios
   ≤ 0.65 and every session ratio ≤ 0.75.
4. Resource-sample coverage ≥ 0.99 for both profiles and no efficiency
   validity condition failed.

Gate logic: **PASS only if all integrity, completion, confidence-interval,
quality, efficiency, and scope gates pass simultaneously; otherwise DENY.**
Mandatory report IDs: `AB-MODEL-RAW`, `AB-MODEL-STRUCTURED`,
`AB-STRUCTURED-VS-RAW-LARGE`, `AB-STRUCTURED-VS-RAW-SMALL`,
`AB-FACTS-VS-GUIDANCE-SMALL`, `AB-STATIC-VS-UPDATED`,
`AB-SINGLE-VS-MULTI-HOP`. A missing result is `PARTIAL_NO_CLAIM`.

Allowed passing wording (only if every gate passes): "On the exact frozen
fresh synthetic domains and profiles in this protocol, ARM-SSG-05 met the
predeclared quality non-inferiority and efficiency thresholds relative to
ARM-LRF-01." Forbidden wording includes "the small model replaces the large
model", general "better/production-ready/safer/universally more efficient"
claims, and any substitution claim outside the tested frozen synthetic
domains.

## 13. Stop, simplification, and falsification rules

The protocol must be able to falsify or simplify the architecture. Twelve
rules are pinned; each fails closed.

| Rule | Trigger (abridged) | Action |
| --- | --- | --- |
| `STOP-01-PROFILE-COMPETENCE` | A selected artifact is absent, digest-mismatched, or fails the fixed non-scored probe | Stop before scored runs; `COMPETENCE_LIMIT`; no substitution |
| `STOP-02-INTEGRITY` | Any digest/invariant mismatch in task, seed, edition, parity, guidance, prompt, scorer, harness, arm, schedule, host, clock, or sampler | Stop the affected block `INVALID_NO_CLAIM`; new protocol edition, not a repair rerun |
| `STOP-03-LEAKAGE` | Task/gold leakage, guidance answer leakage, unblinding, cross-run memory, or arm-specific substitution | Invalidate the complete edition; no claim of any kind |
| `STOP-04-CRITICAL-VIOLATION` | First critical violation (credentials, tools, authority, effects, real entities, hidden-label disclosure) | Stop the profile, falsify its candidate use, deny substitution |
| `STOP-05-FAILURE-RATE` | After ≥ 16 runs for an arm/edition, preserved `model_failure_rate` > 0.125 | Stop the arm `COMPETENCE_LIMIT`; partial reports; deny affected claims |
| `STOP-06-RESOURCE-OR-TIME` | 72 h budget, 300 s timeout, resource envelope, thermal validity, CPU-only invariant, or 0.99 coverage exceeded | Stop; `PARTIAL_NO_CLAIM`; infrastructure evidence is never a product verdict |
| `STOP-07-NO-EARLY-SUCCESS` | An interim result appears to pass a gate before all 960 records and required intervals are present | Continue; interim review may stop only for harm, integrity, competence, exhaustion, or predeclared futility |
| `SIMPLIFY-STRUCTURE` | `structuredRepresentation` retainOnlyIf fails | Remove structured serialization; continue with parity-bound raw facts |
| `SIMPLIFY-GUIDANCE` | Guidance retainOnlyIf fails | Remove guidance; retain facts only |
| `SIMPLIFY-UPDATES` | `knowledgeUpdates` retainOnlyIf fails | Freeze `K0_STATIC`; reject the update path |
| `SIMPLIFY-MULTI-HOP` | `multiHop` retainOnlyIf fails | Restrict architecture and claims to single-hop tasks |
| `FALSIFY-SUBSTITUTION` | Any mandatory substitution quality or efficiency threshold fails or is unavailable | Retain the large profile, deny substitution, report the exact failed gates without post-hoc changes |

Architecture retainOnlyIf rules (full text in the manifest and decision
receipt): structured representation requires, for at least one model size at
`K1_UPDATED`, `task_success` lower bound ≥ 0.00 and either `atomic_fact_f1`
lower bound ≥ +0.03 or `time_to_final` upper ratio bound ≤ 0.90, with neither
model-size contrast's `task_success` lower bound below −0.02; guidance
requires `task_success` lower bound ≥ 0.00 and `guidance_adherence` lower
bound ≥ +0.05 with no increase in critical violations (SSG vs SSF at
`K1_UPDATED`); knowledge updates require +0.10 `task_success` lower bound and
−0.10 point-estimate `stale_claim_rate` on update-sensitive tasks with
control-task lower bound ≥ −0.02 (K1 vs K0 within SSG); multi-hop requires
absolute multi-hop `task_success` lower bound ≥ 0.75 and paired
multi-minus-single lower bound ≥ −0.10 (within SSG at `K1_UPDATED`).

## 14. Admission (L1) and current state

L1 admission is fail-closed: any missing, null, malformed, duplicate,
mutable, unknown, or digest-mismatched field; any raw task or Knowledge seed
exposed instead of a sealed digest; any unpinned model, runtime, harness,
scorer, prompt, host, clock, resource sampler, or edition; any profile
absence or failed fixed compatibility probe; and any service route,
credential, provider, download, fallback model, or unlisted environment
variable rejects execution before scored runs, without measurement or
substitution. Artifacts that do not yet exist (harness tree, scorer, prompt
template, task-suite edition, Knowledge renderings, host manifest, resource
sampler, and the remaining admission digests) are carried in the fixture as
deterministic placeholders derived from a fixed derivation; they are replaced
by real digests at admission time under a new protocol edition and are not
evidence of anything measured.

Current evidence verdict:
**`MANIFEST_DEFINED_EXECUTION_NOT_AUTHORIZED_NO_BENCHMARK_RESULT_NO_MODEL_SUBSTITUTION_CLAIM`**.
Zero model invocations, zero benchmark runs, no services started or called,
no credentials used, no push, merge, or release performed.

## 15. Required verification

```sh
node --test tests/cks-05-benchmark-contract.test.mjs
git diff --check origin/main...HEAD
```

The test suite validates the fixture against the closed schema, recomputes
both source digests from the decision receipt, pins them against the schema
constants, verifies cross-arm identity and the 960-run arithmetic, and runs
fifteen fail-closed drift/escape probes that the schema must reject.