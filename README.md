<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="assets/brand/pansphaira-icon-negative.svg">
    <source media="(prefers-color-scheme: light)" srcset="assets/brand/pansphaira-icon-positive.svg">
    <img src="assets/brand/pansphaira-icon-positive.svg" width="260" alt="PanSphaira geometric icon of seven connected circles">
  </picture>
</p>

# PanSphaira

**Governed by default. Adaptable by design. Improved through evidence.**

The current regular release provides an open-source proof-of-concept control
plane for governed, verifiable AI-agent actions across business systems, with a
runnable local synthetic demo. An agent may propose work; policy, approval,
credentials, execution, authoritative readback and receipts remain outside the
model.

**Product direction:** An open, knowledge-driven operating system for governed,
adaptable AI ecosystems. This broader direction is not a claim of current
product maturity or universal live compatibility.

**Planned research direction:** [Competence–Knowledge Separation and qualified
model routing](https://github.com/JoFe2/PANSPHAIRA/issues/280) explores how
external, evidence-bound knowledge could support the smallest qualified model.
It is backlog research, not delivered functionality or implementation authority.

**Status:** [current regular release](https://github.com/JoFe2/PANSPHAIRA/releases/latest)
· proof of concept · Linux x86_64 · [Apache-2.0](LICENSE)

[**Run the POC**](#quickstart) ·
[**Documentation**](https://jofe2.github.io/PANSPHAIRA/) ·
[**Latest release**](https://github.com/JoFe2/PANSPHAIRA/releases/latest) ·
[**How it works**](#how-it-works)

[Security and limitations](docs/SECURITY-ASSURANCE.md) ·
[Repository documentation](docs/README.md)

## How it works

<p align="center">
  <img src="assets/diagrams/layers/02-control-architecture-v3.png" width="900" alt="PanSphaira control architecture from Agent Sphere through governed crossing, Gateway, capability contract, adapter provider, readback receipt, and knowledge revision.">
</p>

<p align="center"><em>Control architecture view: the Agent proposes, a governed crossing and Gateway evaluate context, rights, policy and approval, then provider readback and receipt close the loop.</em></p>

- **Agent proposes, not executes.** The Agent side emits typed proposals
  without raw credentials, direct effect routes or self-approval.
- **Gateway governs the crossing.** Trusted code evaluates context, rights,
  policy and approval at use time before a bounded adapter/provider action.
- **Readback closes success.** Provider readback and a bound receipt verify the
  result; evidence can inform later knowledge revision without becoming
  authority.

Sphere is terminology and visualization only, not a protocol, schema, API or
runtime abstraction.

See the
[combined technical architecture](docs/ARCHITECTURE.md#combined-architecture-agent-sphere-gateway-sphere-and-governed-crossings).

<details>
<summary>Accessible architecture description</summary>

Agent Sphere typed proposal -> governed crossing -> Gateway context, rights,
policy and approval checks -> capability contract -> adapter/provider bounded
action -> authoritative readback and receipt -> evidence-bound knowledge
revision. The Agent proposes; the Gateway governs; readback and receipt close
the supported local-synthetic loop. Ingestion, confidence/verification,
default selection and execution authority are separate: an evidence revision or
unverified knowledge record may exist without becoming an authoritative
default.

</details>

## Adaptive Knowledge Engineering

**Adaptive Knowledge Engineering** turns observations, domain knowledge,
integration behavior, tests and outcomes into versioned knowledge bound to
provenance and evidence. Candidates are validated, improved, superseded and
reused across agents, tools and systems only where their applicability and
authority boundaries fit.

**Adapt once. Validate it. Reuse it everywhere it fits.**

**Solve → Validate → Package as Knowledge → Share → Reuse → Improve**

**Design direction:** Every integration can teach the system how to adapt the
next one—without silently expanding authority. [Governed Knowledge
Harvest](docs/KNOWLEDGE-HARVEST.md) defines the detailed lineage, maturity and
promotion model.

## Proof today

- The target-neutral core is reused across the released synthetic CRM and ERP
  path: policy and approval precede the bounded effect, then semantic readback
  and a digest-bound receipt verify it. Denial, drift and replay probes fail
  closed. [Run the proof](docs/SECURE-DEFAULT-PROOF.md).
- Released Builder, HMI/harness and capability contracts cover typed discovery,
  planning, synthetic reuse, authority-free discover/explain flows and
  contribution preparation. Selected local-synthetic bindings and the
  `SAFE_GUIDED` reference path are evidence—not a live-system builder or
  production UI.
- The released foundation includes typed/provenance-bound artifacts,
  contracts, templates, adapters, verification/evidence mechanisms, and
  supersession and negative-evidence patterns. Positive evidence, negative
  probes, owner corrections and rejected variants can inform later governed
  revisions. [Explore Governed Knowledge Harvest](docs/KNOWLEDGE-HARVEST.md).

Broader live-system onboarding, provider add/replace, resource-plane adapters
and an outcome-validating autonomous learning loop across arbitrary live
systems remain direction. Provenance-bound knowledge expands an open-ended,
user-need-driven option space across system, tool and provider combinations;
each combination still needs its own applicability boundary and evidence.

## Quickstart

For the release-bound path, download the current Latest archive and its
published checksum sidecar, then verify before extracting:

This release is the **canonical-number hardening** increment. It rejects
negative zero before canonicalization in Verification Fabric timestamps and
Extension Assurance Profile numeric fields. It grants no new trust, admission,
activation, execution or marketplace authority.

```sh
release=v0.2.0-poc.20260825.1
archive=cm-product-increment-rc-20260825-canonical-number.tar.gz
base=https://github.com/JoFe2/PANSPHAIRA/releases/download/$release
curl -fLO "$base/$archive"
curl -fLO "$base/$archive.sha256"
sha256sum -c "$archive.sha256"
tar -xzf "$archive"
cd cm-product-increment-rc-20260825-canonical-number
```

On a supported Linux host with Docker and Compose, run there or from a
contributor checkout root:

```sh
./demo/install.sh
```

Open the loopback URL printed by the installer. The demo creates local random
secrets and fictional fixtures. See the [full quickstart](docs/QUICKSTART.md)
for prerequisites, expected `READY_VERIFIED` output and ownership-scoped cleanup.

Remove only installer-owned resources:

```sh
./demo/uninstall.sh --purge
```

## Evidence and scope

- [Documentation and capability hub](docs/README.md): task-oriented routes and
  maturity labels.
- [Capability and maturity matrix](docs/capabilities.md): released, locally
  validated, candidate, planned and external-evidence surfaces.
- [Security Assurance](docs/SECURITY-ASSURANCE.md): exact scoped claims,
  evidence, trusted computing base and non-claims.
- [Known Limitations](docs/KNOWN-LIMITATIONS.md): production, identity,
  provider, isolation and external-evidence gaps.
- [Terminology and identity guardrails](docs/PANSPHAIRA-TERMINOLOGY.md):
  PanSphaira/Sphere vocabulary and the default-KEEP stable-ID register.
- [Canon](docs/CANON.md) and [Architecture](docs/ARCHITECTURE.md): durable laws,
  trust boundaries and adapters.

This is a local synthetic PoC, not a hosted service, production release,
security certification or support promise. Use synthetic data on a disposable
or development host. Shared, ingested or unverified knowledge grants no
authority.

## Releases

- [Latest regular release](https://github.com/JoFe2/PANSPHAIRA/releases/latest)
- [All releases and history](https://github.com/JoFe2/PANSPHAIRA/releases)
- [Releases Atom feed](https://github.com/JoFe2/PANSPHAIRA/releases.atom)

Release pages own included capabilities, increment details, evidence boundaries,
related issues/PRs, tests, assets and SHA-256 information;
[release governance](docs/RELEASE-GOVERNANCE.md) defines publication evidence
and anonymous readback.

## Project and community

**Share what you know. Expand what everyone can build.**

- [Contribute](CONTRIBUTING.md), [get support](SUPPORT.md), or report a
  vulnerability through the [private security route](SECURITY.md).
- Report reproducible defects through [Issues](https://github.com/JoFe2/PANSPHAIRA/issues)
  and use [Discussions](https://github.com/JoFe2/PANSPHAIRA/discussions)
  for public project conversation; neither route creates a support SLA.

Code is Apache-2.0 under [LICENSE](LICENSE), [NOTICE](NOTICE) and
[THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md). External media artifacts keep
their own license boundary; Apache-2.0 grants no trademark rights.
[CITATION.cff](CITATION.cff) provides citation metadata. Community conduct and
the Developer Certificate of Origin are defined in
[CONTRIBUTING.md](CONTRIBUTING.md).

Voluntary creator support:

<p>
  <a href="https://ko-fi.com/chimpmaera"><img src="assets/support/ko-fi.png" alt="Support PanSphaira on Ko-fi" width="180" height="33"></a>
  &nbsp;
  <a href="https://buymeacoffee.com/jimpansky"><img src="assets/support/buy-me-a-coffee.png" alt="Support PanSphaira on Buy Me a Coffee" width="180" height="33"></a>
</p>
