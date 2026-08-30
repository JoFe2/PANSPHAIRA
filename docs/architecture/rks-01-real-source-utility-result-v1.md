# RKS-01 real-source utility result — protocols v1 and v2

## Terminal verdict

**FALSIFIED_WITH_EVIDENCE**

The standing comparative-utility hypothesis remains unmeasured. Both authorized protocols terminated at their mandatory pre-score gates, so no scored assignment was issued and the complete frozen denominator remains `0 / 126` receipts, `126 / 126` not executed, `0` scored failures, and `0` exclusions.

## Protocol v1 — preserved terminal result

- Status: `FALSIFIED_PRE_SCORE`
- Verdict: `FALSIFIED_WITH_EVIDENCE`
- Cause: `QWEN3_8_27B_Q5_K_M` consumed all 192 completion tokens in `reasoning_content`, returned empty `content`, and could not satisfy the strict closed-answer schema.
- Scored receipts: `0 / 126`; not executed: `126 / 126`.
- Exact predecessor: `baf8c21a4e27b271682b9662089d3187f015f6d5`.
- Byte-preserved evidence: `verification/rks-01-run-receipts/protocol-v1/`.
- Preserved comparator SHA-256: `f8b321248bbc062d6bef6ac766228e5120a8c80970a554b787ba385c308a7a6c`.
- Preserved report SHA-256: `25412262e143d719b85beb2be70ca9883eba68a75029c7f80ae88cb0986f950d`.

The v1 verdict was not erased, relabeled as a measured comparison, or replaced by v2.

## Protocol v2 — one authorized compatibility delta

The pre-frozen envelope SHA-256 is `cd5bc607072fdc4c5eee0eb7d87662230d1f8413159e50d84e273b37f4ff4da9`. Relative to v1, its only server-argument additions were:

```text
--reasoning off
--reasoning-format none
--reasoning-budget 0
```

Tasks, corpora, source/task/context digests, model paths and hashes, runtime and bundled-library hashes, temperature `0`, seed `104729`, maximum completion tokens `192`, strict answer schema, assignment order, thresholds, arm assignments, and scoring rules remained unchanged.

### Revalidation

- Task-suite digest: `803ac5f0fa16f8b43f4e229714efe27afbcf8c35a7e8a69bb11d0e7ee0a902c2`.
- Context-contract digest: `0722d5185d3ccd118b5a6c020d27ab5dabd4f28e11cddb4639237c514c753273`.
- Comparison-source-set digest: `9db857ec6c970138aa6db689e3e575a3788c9926ed3a1dbe6c96175b069dc542`.
- Hardware: `NVIDIA GeForce RTX 5090`, driver `580.173.02`, compute capability `12.0`.
- Exact `llama-server`, 12 bundled libraries, and all three model files rehashed to their frozen values.
- All 126 assignments re-derived in the frozen lowercase-SHA-256 order before probing.

### Fresh strict-JSON probes

| Exact profile | Probe | HTTP | completion tokens | prompt ms | generation ms | wall ms | Raw response SHA-256 |
|---|---:|---:|---:|---:|---:|---:|---|
| `VIBETHINKER_3B_Q8_0` | PASS | 200 | 75 | 31.993 | 407.425 | 446.73143699999855 | `2bafbc3bcb608ab5c4812f994d45beeb047efcd87e5719b8545dd03569bc1700` |
| `FASTCONTEXT_4B_Q8_0_D24F7B8B` | PASS | 200 | 79 | 17.13 | 435.525 | 459.2787779999999 | `899b8793d47592f321a76ba1f587fd6041e441ca6ef38f9edd190c66449338a4` |
| `QWEN3_8_27B_Q5_K_M` | **FAIL** | 400 | not returned | not returned | not returned | 26.046008999997866 | `4e317b744f23ef1323fa291b67cbf6f11b86beba77fe95db907304cac9f8cf9f` |

The exact Qwen response was:

```json
{"error":{"code":400,"message":"Failed to initialize samplers: std::exception","type":"invalid_request_error"}}
```

This was the one fresh protocol-v2 schema probe for that exact model. The protocol required terminal falsification if any v2 probe failed and authorized no further compatibility correction, probe retry, scored fallback, or substitution. Therefore no scored server was started and no scored request was sent.

## Protocol v2 decision derivation

- Final v2 verdict: `FALSIFIED_WITH_EVIDENCE`.
- Hard gate `allModelSchemaProbes`: `false`.
- Hard gate `completeAssignments`: `false` because scoring was correctly prohibited.
- Scored receipts: `0 / 126`.
- Scored failures: `0 / 126` (no scored request was attempted).
- Exclusions: `0 / 126`.
- Not executed: `126 / 126`.
- Quality, grounding, applicability, update compliance, denial safety, arm token costs, and Raw-vs-Guided / Guided-vs-Large comparisons: `NOT_MEASURED_PRE_SCORE_GATE_FAILED`.

Null comparative metrics remain null; they are not converted into zero scores or inferred from model labels.

## Limitation and nonclaims

This is terminal evidence about the two exact frozen inference protocols, not comparative evidence that typed Knowledge helps or hurts, not a general small-model claim, not legal advice, not production readiness, not autonomous-promotion authority, and not action authority. The standing comparative hypothesis remains unmeasured because no scored task was legally reachable under either authorized protocol.
