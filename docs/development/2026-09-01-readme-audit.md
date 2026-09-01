# DOC-README-01 current-Main audit

Issue: [#352](https://github.com/JoFe2/PANSPHAIRA/issues/352)
Audited base: `ea664cb6423bb3427707584aa657d3d5a5b46cb5`
Corrected head: recorded by the issue-closing PR
Scope: public orientation, Quickstart, documentation navigation, and the narrow release-governance rules that bind those surfaces.

This is a line-addressed review record, not a new maturity source. Release pages own volatile release identity; `docs/capabilities.md` owns the human-readable maturity matrix; `release/governance.json` owns the immutable runnable archive tuple.

## Change-to-evidence map

| Corrected surface | Evidence checked | Result and boundary |
| --- | --- | --- |
| `README.md:13-33` — current PoC, direction, status, and primary routes | `release/governance.json`; public GitHub Latest readback; `docs/SECURITY-ASSURANCE.md`; `docs/KNOWN-LIMITATIONS.md`; `LICENSE` | Root orientation is version-agnostic and identifies Latest as a public evidence release. It does not call a source-only release a runnable archive or claim production maturity. |
| `README.md:40-82` — Adaptive Knowledge Engineering and tailoring loop | `docs/KNOWLEDGE-HARVEST.md`; `docs/CANON.md`; `docs/ARCHITECTURE.md`; `docs/capabilities.md`; `docs/roadmap.md` | Need/evidence/constraint → Blueprint → governed adaptation → policy/approval → bounded effect → readback/receipt → reuse is presented as the product method. Delivered, candidate/inactive, planned, and external-evidence-required states are separate. Knowledge grants no Authority. |
| `README.md:84-119` — control architecture | `docs/ARCHITECTURE.md`; `docs/SECURITY-ASSURANCE.md`; `demo/manifests/authority/SAFE_GUIDED-v1.json`; `demo/manifests/authority/RAMPAGE-v1.json` | Gateway/policy/approval wording is explicitly scoped to `SAFE_GUIDED`; `RAMPAGE` remains a separate opt-in outside that governed reference path. |
| `README.md:121-145` — proof today | `docs/SECURE-DEFAULT-PROOF.md`; `docs/architecture/cks-m1/closure-v1.md`; closed issue #280; `docs/capabilities.md` | CKS is a completed bounded synthetic result, not backlog research. Real-model/general-small-model, real-source utility, production routing, universal integration, and knowledge-promotion claims remain denied or externally gated. |
| `README.md:147-193` — Quickstart/evidence/releases | `demo/install.sh`; `demo/uninstall.sh`; `docs/QUICKSTART.md`; `docs/RELEASE-GOVERNANCE.md`; GitHub releases pages | Main is a runnable source candidate, not immutable release evidence. Volatile tuple details are excluded from README and delegated to the full Quickstart/release page. Cleanup remains ownership-scoped. |
| `docs/QUICKSTART.md:8-130` | `package.json` engines; lockfile; demo scripts; `docs/PANSPHAIRA-TERMINOLOGY.md`; immutable `v0.2.0-poc.20260825.1` release page and governed archive tuple | The safety boundary is concise. Ordinary `npm ci` is primary; offline mode is optional. Main/Latest evidence and the historical checksum-bound runnable archive are distinct. Stable `cm`/`chimpmaera` identities are explained rather than renamed. |
| `docs/.vitepress/config.mts:119-178` and `docs/index.md:47-60` | Existing `docs/CANON.md`, `docs/ARCHITECTURE.md`, `docs/SECURITY-ASSURANCE.md`, `docs/KNOWN-LIMITATIONS.md`, `docs/EXTERNAL-BI-SERVICE.md`; absence of active `docs/BI-EXECUTION-SPINE-CONTRACT.md` | Dead BI navigation now points to the active external-service boundary. Canon, Architecture, Security Assurance, and Known Limitations are visible as governing concepts without duplicating their content. |
| `scripts/verify-release-governance.mjs` and `tests/release-governance.test.mjs` | `release/governance.json.currentRelease`; README/Quickstart ownership statements; fail-closed negative probes | The full Quickstart must contain exactly one immutable governed archive tuple. README must contain none. Wrong, duplicated, hidden, or stale tuples continue to fail. No tag, asset, or release classification is changed by this issue. |

## Link and anchor audit

Audited the exact-base README before correction and rechecked corrected local targets through the documentation build:

- 43 target occurrences / 35 distinct targets;
- 30 relative-path occurrences, all case-correct;
- same-document `#quickstart` and `#how-it-works` anchors resolved;
- the Architecture fragment resolved;
- nine distinct external HTTP(S) targets returned successful bounded readback;
- no confirmed broken README links and no transient remote failures;
- one separate VitePress sidebar route was confirmed dead and corrected to `EXTERNAL-BI-SERVICE`.

## Verification

- `npm run docs:test` — 5/5 PASS;
- `npm run public-spelling:test` — 4/4 PASS;
- `npm run release-governance:test` — 52/52 PASS, including negative probes;
- `npm run supply-chain:verify` — PASS;
- `sha256sum --check SHA256SUMS` — PASS after final digest refresh;
- `git diff --check` — PASS.

## Residual finding

`release/governance.json` continues to define the checksum-bound runnable product archive, while GitHub Latest may point to a later source-only evidence release. This change makes the public orientation honest and enforces ownership separation; it does not redesign release classes, replace immutable archive evidence, or retroactively change tags/assets.
