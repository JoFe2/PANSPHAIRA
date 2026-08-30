# RKS-01 real-source utility result v1

## Terminal verdict

**FALSIFIED_WITH_EVIDENCE**

The mandatory pre-score JSON-schema gate failed for the exact large-reference profile. Under the frozen no-substitution/no-envelope-change rule, no scored task was permitted to run. This is a runtime/model-envelope incompatibility result, not a measured comparative-quality result.

## Frozen boundary

- Base head: `ffea51336c7d0d4ee76ac2e2e56a7c400ad6f9ac`
- Task-suite digest: `803ac5f0fa16f8b43f4e229714efe27afbcf8c35a7e8a69bb11d0e7ee0a902c2`
- Context-contract digest: `0722d5185d3ccd118b5a6c020d27ab5dabd4f28e11cddb4639237c514c753273`
- Comparison-source-set digest: `9db857ec6c970138aa6db689e3e575a3788c9926ed3a1dbe6c96175b069dc542`
- Tasks frozen before model output: 18: six each for Wikidata, CPython v3.14.7, and OpenAPI 3.2.0; one of every required stratum per source.
- Intended scored denominator: 126 assignments (primary 72, replication 36, large reference 18), temperature 0, seed 104729, maximum 192 generated tokens.

## Exact pre-score evidence

All model bytes, the b10167 `llama-server`, and 12 bundled libraries rehashed successfully (16 exact byte artifacts total). Hardware revalidation reported `NVIDIA GeForce RTX 5090, 580.173.02, compute capability 12.0`. Driver `580.173.02` matched the frozen manifest. Each server was loopback-only, one-slot, context 4096, batch 512/ubatch 256, 8 threads, all GPU layers, flash attention on, f16 KV, prompt cache disabled/reuse 0, Jinja, perf and metrics enabled.

| Exact profile | SHA-256 | Probe | HTTP | finish | prompt | completion | total | prompt ms | generation ms | wall ms |
|---|---|---:|---:|---|---:|---:|---:|---:|---:|---:|
| VibeThinker 3B Q8_0 | `ed81a97aa6aa5a1c25664fe4e9721f009e19fe151c71dcec6a52553a24372f9f` | PASS | 200 | `stop` | 125 | 75 | 200 | 33.861 | 406.241 | 449.1592019999989 |
| FastContext 4B Q8_0 | `d24f7b8bcce3e68464faa423a181e703ae52dd7b34974a5c27a70218c4c92c90` | PASS | 200 | `stop` | 125 | 79 | 204 | 19.785 | 435.855 | 463.6105669999997 |
| Qwen3.8-27B Q5_K_M | `07deb7fa91bf751d3000774fe5bb8afae5ffb41255fd19980147468052e07177` | **FAIL** | 200 | `length` | 165 | 192 | 357 | 225.894 | 2704.691 | 2946.039112000002 |

Runtime SHA-256: `d4f6893329395396b1a4e75820f2fe10e048c72a3b657e2182595e7fd352ab3c`.

The Qwen response consumed the complete frozen 192-token allowance in `reasoning_content` (821 characters), returned an empty `content` string, and therefore could not parse as the required closed answer object. No retry occurred. Increasing `max_tokens`, disabling reasoning, changing template/runtime, or substituting a model would mutate the frozen envelope and was not authorized.

## Exact comparative evidence and denominators

| Evidence class | Raw count / denominator | Result |
|---|---:|---|
| Scored assignments | 0 / 126 | `NOT_EXECUTED_PRE_SCORE_GATE_FAILED` |
| Failed scored assignments | 0 / 126 | None were attempted |
| Excluded scored assignments | 0 / 126 | No exclusions |
| Not-executed assignments | 126 / 126 | Mandatory schema probe failed |
| Task quality | 0 measured / 18 tasks per arm | `NOT_MEASURED_PRE_SCORE_GATE_FAILED` |
| Material-claim evidence coverage | 0 measured claims / 0 measured claims | `NOT_MEASURED_PRE_SCORE_GATE_FAILED` |
| Unsupported material claims | 0 measured | `NOT_MEASURED_PRE_SCORE_GATE_FAILED` |
| Applicability accuracy | 0 measured / 0 measured | `NOT_MEASURED_PRE_SCORE_GATE_FAILED` |
| Update compliance | 0 measured / 0 measured | `NOT_MEASURED_PRE_SCORE_GATE_FAILED` |
| Safe denial / authority denial | 0 measured / 0 measured | `NOT_MEASURED_PRE_SCORE_GATE_FAILED` |
| Scored prompt+completion cost | 0 measured tokens / 0 scored runs | `NOT_MEASURED_PRE_SCORE_GATE_FAILED` |

The probe-token table is startup qualification evidence only and is excluded from scored arm cost. No quality, grounding, applicability, drift-safety, denial-safety, Raw-vs-Guided token ratio, or Guided-vs-Large comparison can honestly be calculated. Null metrics are retained as null rather than presented as zero performance or rounded percentages.

## Decision derivation

The frozen inference envelope requires every exact model to pass a synthetic JSON-schema probe before the first scored request. Qwen3.8-27B Q5_K_M failed that hard gate. The frozen decision rule makes any hard-gate failure sufficient for `FALSIFIED_WITH_EVIDENCE`. The verifier independently parses the raw Qwen response and checks profile, HTTP 200, `finish_reason: length`, empty content, and exactly 192 completion tokens before accepting the verdict.

## Limitation and nonclaims

The intended pilot was only `n=18`, already too small for a general model claim. The realized scored sample is `n=0` because fail-closed pre-score validation worked. This result does not claim comparative inferiority of typed Knowledge, general small-model replacement, legal advice, production readiness, autonomous promotion, or action authority.
