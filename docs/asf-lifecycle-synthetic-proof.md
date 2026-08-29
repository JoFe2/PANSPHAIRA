# ASF lifecycle synthetic proof

Status: local synthetic proof and draft readback only.

This document binds the public-safe draft to the deterministic ASF synthetic lifecycle harness already present in this repository. It does not claim that protected delivery, release, production rollout, or public readback occurred. It is a reproduction aid for local review, not an operational deployment or publication record.

## Scope and authority

- Authority: `LOCAL_DETERMINISTIC_HARNESS_ONLY`.
- Input: checked-in, deterministic synthetic lifecycle receipts; no live provider, service, credential, customer data, or external state.
- Output: deterministic redacted demo, recovery guide projection, and planned-versus-implemented template.
- Side effects: none. The renderer only reads the selected fixture and writes the rendered JSON to stdout in dry-run mode.
- Process: Operating Model v1.1 and controller-supplied decisions D-001 through D-007 are preserved. This slice creates no process variant and does not reinterpret those decisions.

The renderer is intentionally redaction-first. It rejects unsafe material before it validates or projects a receipt. Rejection is the result; no partial public-safe document is emitted.

## Exact synthetic lineage

The checked-in synthetic source is:

- `packages/contracts/src/asf-synthetic-lifecycle-harness.ts`
- `tests/asf-synthetic-lifecycle-harness.test.ts`
- `tests/fixtures/asf-synthetic-lifecycle/success.json`
- `tests/fixtures/asf-synthetic-lifecycle/denied-activation.json`

The local source was read on branch `conveyor/pansphaira-35` at parent `43fa52d64c15a30619386491181f6ca4a4079898`; the recorded comparison point is `origin/main` at `353017c4f60e30463d0a78fd6fd2509a37d37f76`. The public-safe fixture is a digest-only projection of those checked-in synthetic receipts, not a new lifecycle authority.

Exact source bytes used for the projection:

| Path | SHA-256 |
| --- | --- |
| `packages/contracts/src/asf-synthetic-lifecycle-harness.ts` | `fb55b14eb882480136dd8281a2ceef104fed7317e23e18863b37bf662c3ebcbe` |
| `tests/asf-synthetic-lifecycle-harness.test.ts` | `bda3ede35c1c159b43b9a8e59a525fa6143f7aba4a1820e5ac0a8f612e6604cc` |
| `tests/fixtures/asf-synthetic-lifecycle/success.json` | `53fe9809b369c0941e59182a059a709380b7c1eabcdac95b28e2af38adfbf35b` |
| `tests/fixtures/asf-synthetic-lifecycle/denied-activation.json` | `4b97226c0951251586d6e11cae8e446745bc0004c256bd5a6fdc51e4d06b1b63` |

Verified receipt bindings used by `tests/fixtures/asf-public-readback/verified.json`:

| Criterion | Receipt | Digest |
| --- | --- | --- |
| deterministic generation | `generation` | `ae64117ef4f59674d75086d45e06e031414e2898c2d5c91d76407247a57bb0a9` |
| provenance/quality/risk analysis | `analysis` | `1a1d0d009f92a8469b2743886a318558666d930446776aaef19c18e2c99a768c` |
| immutable content addressing | `bundleLock` | `5d1acd3cfbf88d1bb5b1aa1076278663d0fc10b2890fac0be7697e605e5fcf90` |
| rollback readback | `rollback` | `c58393fae66f363517cd3a9ae967bc53595b03374fd323d5df9de942e42497e8` |
| public-safe projection | `public` | `1bb4d2203fc8393593140b830557f14fbb8fa09c2e19a2b90f87b0dfd6bbac45` |
| complete synthetic lifecycle | lifecycle receipt | `48ac37da1240df7db9752ea77597112fa5d5383fe1bdd37b4768be446a513f86` |

The fixture also carries a SHA-256 digest over its canonical receipt object: `43cf6c5a99d56ef65b73e8eada4a3b8e514b0271e14e22cf2092c1bceadf8c2f`. A changed field, missing stage, changed digest, or changed lineage entry is rejected.

## Reproduction

From the repository root:

```text
npm run build --silent && node --test tests/asf-public-readback.test.mjs
node scripts/render-asf-public-readback.mjs --dry-run --fixture tests/fixtures/asf-public-readback/verified.json
```

The second command is read-only and deterministic. Running it twice with the same fixture must produce byte-identical JSON. The checked-in `leak.json` fixture is expected to reject; it is a negative probe, not evidence of an external security finding.

## Recovery and nonclaims

A renderer rejection means the draft is unusable. It does not authorize a retry against a provider, a delivery, a release, a publication, or an external action. Recovery is represented as a plan only: retain the receipt evidence, restore the exact last-known-good synthetic lock when a verified matching readback exists, otherwise deny and remain disabled. No claim of cleanup, pointer mutation, rollback execution, or zero residue is made by this local readback.

The mandatory statement for this slice is:

> No protected delivery, release, or public readback occurred.

Claims are limited to verified synthetic lifecycle receipt projection and deterministic redaction. Explicit nonclaims are: committed external state, external action, exploit execution, live provider or service use, production rollout, public readback, release, security disclosure, and protected delivery.

## Planned versus implemented

Implemented locally:

- digest validation for the synthetic receipt and every referenced stage;
- exact lineage binding to the checked-in synthetic receipt digests;
- deterministic sorting and JSON rendering;
- redaction-first rejection of raw identity, token, path, host, session, job, URL, security finding, exploit payload, unverified link, unsupported claim, and external-action material;
- a side-effect-free recovery/nonclaim template.

Planned or explicitly not implemented here:

- protected delivery, release, public publication, and production rollout;
- live provider/service integration, credential use, or customer-data access;
- any external action, security disclosure, exploit handling, or external state mutation;
- treating this draft as proof that a protected readback happened.
