# CKS-05 public-safe falsification report

Report id: `{{reportId}}`

This draft is a deterministic readback of the sealed CKS-05 evidence chain. It is not a model-substitution claim. It preserves the A/B result, uncertainty, run counts, failures, stop conditions, and the claim gate without publishing task bytes, Knowledge seed bytes, or rendering bytes.

## Evidence chain

Record the L1 manifest, L2 hidden-run binding, L3 ablation/parity binding, L4 executor replay, and score-aggregate readback. Each source is identified by repository path and a sealed SHA-256 byte digest. A chain is valid only when every binding and recomputed digest validates.

## A/B results

Report all required cells, including:

- structured versus raw;
- facts versus non-answer guidance;
- static versus updated Knowledge editions;
- single-hop versus multi-hop;
- model and representation contrasts where present.

For every cell report treatment and control arms, point estimate, 95% confidence interval availability and bounds, resampling unit, independent-unit count, paired run count, and status. Repeated generation seeds are observations, not independent task units.

## Per-arm results and score aggregates

Report scheduled, observed, completed, failed, invalidated, and scored counts for every arm. Report score aggregates without exposing individual task prompts, gold records, responses, or final answers. Preserve model failures as scored-zero evidence and infrastructure invalidations as non-product verdicts.

## Stop conditions and simplification

Stop conditions remain executable falsification guards. Missing evidence, invalidation, excessive model failure, critical violations, or unavailable thresholds must block success. A triggered `FALSIFY-SUBSTITUTION` rule falsifies the substitution claim; simplification rules may simplify structure, guidance, updates, or hop handling only when their declared evidence state permits it. Infrastructure invalidation is not a product-quality verdict.

## Substitution claim guard

The claim is `DENY` unless the complete schedule, every required A/B cell, available 95% confidence intervals, all quality thresholds, and all efficiency thresholds pass together. No quality-only, efficiency-only, partial, or early result may claim substitution.

## Public-safety boundary

Only sealed digests, identifiers, aggregate statistics, failure metadata, uncertainty metadata, and decision-state text are public-safe. Raw task bytes, raw Knowledge seed bytes, and raw RAW/STRUCTURED rendering bytes remain hidden.
