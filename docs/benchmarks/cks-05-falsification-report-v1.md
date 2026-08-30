# CKS-05 comparative benchmark — terminal falsification report v1

## Disposition

**FALSIFIED_EARLY_STOP — no model-substitution claim.**

Issue #285 asked for a comparative Knowledge Fabric benchmark **and falsification report**. The corrected real bounded pilot reached the exact pinned runtime and both exact model artifacts, but failed the minimum execution/output gate required before a larger paired schedule could produce meaningful quality or efficiency statistics.

## Exact bindings

- Runtime: llama.cpp build `10661`, commit `32176338a`
- Runtime archive SHA-256: `915a3ad0b4de517ea6e50d82edaf4a0a6f1b3a3beeddbdb85317fb1ab2363b0b`
- Small model SHA-256: `ed81a97aa6aa5a1c25664fe4e9721f009e19fe151c71dcec6a52553a24372f9f`
- Large model SHA-256: `07deb7fa91bf751d3000774fe5bb8afae5ffb41255fd19980147468052e07177`
- Fresh task: `SYN-SABLE-MERIDIAN-20260830-04`
- Receipt: `d54178845e2e8702ebeb95a53d51f3c1c16a3e147da7c1687ef8dd56477854de`

Raw prompts, Knowledge bytes, model outputs and reasoning are not published. The receipt preserves their digests and byte counts.

## Real five-arm result

| Arm | Model | Knowledge mode | Terminal | Valid final | Task success | Abstained | Elapsed ms |
|---|---|---|---:|---:|---:|---:|---:|
| ARM-SCB-01 | Small | Closed book | completed | yes | no | yes | 4,461.675 |
| ARM-SNR-02 | Small | Naive RAG | completed | no | no | no | 4,618.677 |
| ARM-SKF-03 | Small | Structured Fabric | completed | no | no | no | 5,231.191 |
| ARM-LCB-04 | Large | Closed book | completed | no | no | no | 32,914.466 |
| ARM-LKF-05 | Large | Structured Fabric | completed | no | no | no | 37,302.938 |

Observed totals:

- scheduled/completed/failed: **5 / 5 / 0**
- supported task successes: **0**
- correct closed-book abstentions: **1**
- unsupported exact gold answers in closed book: **0**
- valid final channels: **1/5**
- confidence interval: **unavailable at n=1/arm**

## Stop-condition decision

The larger paired benchmark is stopped before expansion because four of five arms failed the closed final-answer protocol and no Knowledge-enabled arm produced an admissible supported answer. Running the full static/updated, facts/guidance and single/multi-hop schedule would spend additional compute without first satisfying the minimum measurement interface.

Therefore:

- quality threshold: **not passed**
- efficiency threshold: **not passed**
- model substitution: **denied**
- structured-vs-raw superiority: **not claimed**
- small-vs-large superiority: **not claimed**
- architecture promotion: **denied**

This is a terminal falsification of the tested configuration, not evidence that Knowledge Fabric generally fails. A successor experiment requires a separately versioned model/output protocol and fresh hidden tasks; it must not overwrite this result.
