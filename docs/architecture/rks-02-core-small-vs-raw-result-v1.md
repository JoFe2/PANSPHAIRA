# RKS-02 core two-small-model Guided Knowledge vs Raw RAG result

## Terminal verdict

**FALSIFIED_WITH_EVIDENCE**

Both mandatory small profiles passed one fresh unscored strict-JSON probe. The exact hash-ordered `108 / 108` assignments were then issued once under the inherited RKS-01 protocol-v1 server/request envelope. There were no scored retries, fallbacks, substitutions, exclusions, Large Reference requests, or Large Reference gates.

The bounded Guided Knowledge hypothesis did not pass. Primary Guided missed the frozen exact `3 / 3` update and `3 / 3` authority-denial hard gates, and both profile comparisons missed applicability and strict safety improvement. Primary also missed grounding strict improvement; replication improved grounding but did not pass the remaining gates.

## Frozen execution

- Released base: `ca9eca75f3ecc6b2e3389349666f632cc051c499` / `2026_08_30_v15`.
- Frozen tasks: `18` (`6` per source class).
- Assignments: VibeThinker `72` (Closed, Raw, Typed, Guided); FastContext `36` (Raw, Guided); total `108`.
- Runtime: llama.cpp b10167, one loopback slot/profile, context `4096`, batch `512`, ubatch `256`, threads `8`, all GPU layers, flash attention on, f16 KV, prompt cache off/reuse `0`, Jinja/perf/metrics/slots.
- Request: temperature `0`, seed `104729`, maximum completion `192`, strict closed JSON. No reasoning flags.
- Hardware revalidated: NVIDIA GeForce RTX 5090, driver `580.173.02`, compute capability `12.0`.
- Runtime, 12 bundled libraries, both model files, task suite, three corpora, and inherited scoring code rehashed to frozen values.
- RKS-01 protocol-v1 and protocol-v2 falsification reports remained byte-preserved.

## One-shot probes and complete denominator

| Profile | Probe | HTTP | Scored receipts | Success | Schema failure | HTTP failure | Excluded |
|---|---:|---:|---:|---:|---:|---:|---:|
| `VIBETHINKER_3B_Q8_0` | PASS | 200 | 72 | 38 | 28 | 6 | 0 |
| `FASTCONTEXT_4B_Q8_0_D24F7B8B` | PASS | 200 | 36 | 10 | 20 | 6 | 0 |
| **Total** | **2 / 2 PASS** |  | **108** | **48** | **48** | **12** | **0** |

All 12 HTTP failures were Guided CPython tasks whose inherited prompt exceeded the frozen 4096-token context (`4241` to `4542` request tokens). They remain in the denominator. The 48 schema failures likewise remain zero-scored denominator entries. No request was retried.

## Raw metrics

| Profile / arm | Quality | Evidence coverage | Unsupported claims | Applicability | Update | Safe denial | Authority denial | Prompt | Completion | Total tokens |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| Primary Closed | 0 / 18 | 0 / 5 | 0 | 3 / 18 | 0 / 3 | 0 / 9 | 0 / 3 | 3,941 | 1,390 | 5,331 |
| Primary Raw | 0 / 18 | 0 / 3 | 0 | 3 / 18 | 0 / 3 | 0 / 9 | 0 / 3 | 35,163 | 2,825 | 37,988 |
| Primary Typed | 0 / 18 | 0 / 0 | 0 | 3 / 18 | 0 / 3 | 0 / 9 | 0 / 3 | 38,498 | 2,427 | 40,925 |
| Primary Guided | 0 / 18 | 0 / 1 | 1 | 1 / 18 | 0 / 3 | 0 / 9 | 0 / 3 | 25,151 | 2,099 | 27,250 |
| Replication Raw | 0 / 18 | 0 / 5 | 5 | 4 / 18 | 0 / 3 | 0 / 9 | 0 / 3 | 35,163 | 2,995 | 38,158 |
| Replication Guided | 1 / 18 | 1 / 2 | 1 | 2 / 18 | 0 / 3 | 0 / 9 | 0 / 3 | 25,151 | 2,266 | 27,417 |

Failed requests return no usage and therefore contribute zero recorded tokens, while remaining in every quality/safety denominator. The frozen token gate nevertheless passes mechanically: Primary Guided/Raw = `27,250 / 37,988` (`0.7173317889859956`); replication Guided/Raw = `27,417 / 38,158` (`0.7185125006551706`). This token result does not override failed hard, quality-adjacent, grounding, applicability, or safety gates.

## Frozen gate derivation

| Gate | Primary | Replication |
|---|---:|---:|
| Quality at least Raw minus 1 / 18 | PASS | PASS |
| Grounding metrics neither worse with one strict | **FAIL** | PASS |
| Applicability not lower | **FAIL** | **FAIL** |
| Update and safe denial not lower with one strict | **FAIL** | **FAIL** |
| Guided prompt+completion <= 90% Raw | PASS | PASS |
| Profile comparison | **FAIL** | **FAIL** |

Primary hard gates:

- Guided update compliance exactly `3 / 3`: **FAIL** (`0 / 3`).
- Guided authority denial exactly `3 / 3`: **FAIL** (`0 / 3`).
- Complete `108 / 108`, complete failure denominator, zero exclusions, and source/legal/drift/authority control: PASS.

Because the primary hard gates and both profile comparisons do not pass, neither `GO` nor `NARROW_GO` is reachable. The deterministic verdict is `FALSIFIED_WITH_EVIDENCE`.

## Evidence and limitations

- Exact receipt set digest: `04b790bc0bc90fdba8655468351b60b59e0bcab3331b642dfe2d642ce3f0f350`.
- Canonical comparator: `verification/rks-02-comparator-receipt-v1.json`.
- Failure-complete report: `verification/rks-02-falsification-report-v1.json`.
- Raw immutable run evidence: `verification/rks-02-run-receipts/`.
- Independent verifier recomputed every assignment, task/context/prompt/source/model/runtime/seed hash, raw-response parse, usage, timing, deterministic score, aggregate, gate and verdict.

This is bounded descriptive evidence from `n=18` frozen tasks, six per source class. It is not a general small-model verdict, not a Large Reference comparison, not production readiness, not autonomous promotion authority, and not action authority.
