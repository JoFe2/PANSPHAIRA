<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="assets/brand/pansphaira-icon-negative.svg">
    <source media="(prefers-color-scheme: light)" srcset="assets/brand/pansphaira-icon-positive.svg">
    <img src="assets/brand/pansphaira-icon-positive.svg" width="260" alt="PanSphaira geometric icon of seven connected circles">
  </picture>
</p>

# PanSphaira

**Governed by default. Adaptable by design. Improved through evidence.**

The public repository provides an open-source proof-of-concept control plane
for governed, verifiable AI-agent actions across business systems, with a
runnable local synthetic demo. An Agent may propose work; policy, approval,
credentials, execution, authoritative readback and receipts remain outside the
model.

**Product direction:** An open, knowledge-driven operating system for governed,
adaptable AI ecosystems. This broader direction is not a claim of current
product maturity or universal live compatibility. No production readiness is
claimed.

**Status:** [latest public evidence release](https://github.com/JoFe2/PANSPHAIRA/releases/latest)
· proof of concept · Linux x86_64 · [Apache-2.0](LICENSE)

[**Run the local proof**](#quickstart) ·
[**Documentation**](https://jofe2.github.io/PANSPHAIRA/) ·
[**Latest public release**](https://github.com/JoFe2/PANSPHAIRA/releases/latest) ·
[**Capabilities and maturity**](docs/capabilities.md)

[Security and limitations](docs/SECURITY-ASSURANCE.md) ·
[Repository documentation](docs/README.md)

## How it works

PanSphaira turns needs into governed proposals verified by authoritative
readback and receipts.

## Adaptive Knowledge Engineering

**Adaptive Knowledge Engineering** builds knowledge-based business processes
tailored to individual needs while keeping governance, integration, readback
and evidence verifiable. The PoC proves only a bounded local-synthetic loop;
each added example must prove its own applicability and evidence boundary.

```text
Need + source knowledge + constraints
  -> Capability / Process Blueprint
  -> governed configuration or adaptation
  -> policy and approval
  -> bounded integration or action
  -> authoritative readback and receipt
  -> evidence revision and reuse
```

Tailoring covers data, process steps, system bindings, policy, approval,
evidence and nonclaims—not arbitrary automation, complete control, universal
compatibility or self-proving production behavior.

**Delivered:** provenance-bound local-synthetic proofs, including the CKS chain
below. **Candidate / inactive:** source-native candidates preserve variants and
counterevidence; inclusion or validation does not activate them.
**Planned:** an open-ended, user-need-driven option space in a Capability
Library with independent validation before release. **External evidence
required:** provider, tenant, environment and holdout claims remain unproven
until their separate gates pass. See the [capability
matrix](docs/capabilities.md), [Canon](docs/CANON.md),
[Architecture](docs/ARCHITECTURE.md) and [roadmap](docs/roadmap.md).

**Adapt once. Validate it. Reuse it everywhere it fits.**

**Solve → Validate → Package as Knowledge → Share → Reuse → Improve**

Every integration can teach the system how to adapt the next one—without
silently expanding authority. [Governed Knowledge
Harvest](docs/KNOWLEDGE-HARVEST.md) owns the detailed lineage, maturity and
promotion model.

## Control architecture

<p align="center">
  <img src="assets/diagrams/layers/02-control-architecture-v3.png" width="900" alt="PanSphaira control architecture from Agent Sphere through governed crossing, Gateway, capability contract, adapter provider, readback receipt, and knowledge revision.">
</p>

<p align="center"><em>The Agent proposes; the governed crossing and Gateway evaluate context, rights, policy and approval; provider readback and a receipt close the supported loop.</em></p>

- **In the SAFE_GUIDED reference path, the Agent proposes, not executes.** The
  Agent side emits typed proposals without
  raw credentials, direct effect routes or self-approval.
- **The SAFE_GUIDED Gateway governs the crossing.** Trusted code evaluates
  context, rights, policy and approval before a bounded adapter/provider action.
- **Readback closes success.** Provider readback and a bound receipt verify the
  result; evidence may inform later knowledge revision without becoming
  authority.

These bullets describe the default `SAFE_GUIDED` proof. The explicit local-demo
`RAMPAGE` opt-in is outside that governed reference path. Sphere is terminology
and visualization only, not a protocol, schema, API or runtime abstraction.
See the [combined technical
architecture](docs/ARCHITECTURE.md#combined-architecture-agent-sphere-gateway-sphere-and-governed-crossings).

<details>
<summary>Accessible architecture description</summary>

Agent proposal -> governed crossing -> Gateway checks -> bounded action ->
authoritative readback and receipt -> evidence revision. Ingestion,
verification, default selection and execution authority remain separate: an
unverified knowledge record may exist without becoming an authoritative default.

</details>

## Proof today

Current Main proves one target-neutral synthetic CRM/ERP path: policy and
approval precede the effect; readback and a receipt verify it. Denial, drift and
replay fail closed. [Run the proof](docs/SECURE-DEFAULT-PROOF.md).

Released evidence remains bounded to its proof; candidate material grants no
activation; planned work is not current behavior; live systems and holdouts
remain external gates. The [capability matrix](docs/capabilities.md) owns each
classification.

The [completed Competence–Knowledge Separation proof
chain](docs/architecture/cks-m1/closure-v1.md) provides a bounded local-synthetic
research result for external knowledge, evidence-aware qualification and
smallest-qualified model routing without granting Capability or Authority. Its
real-model arm stopped with a falsification result; it does not prove general
small-model replacement, real-source ingestion utility, production model
qualification, live routing or autonomous knowledge promotion.

Arbitrary live-system onboarding, provider replacement and autonomous outcome
learning remain planned or require external evidence. Every system/provider
combination needs its own proof. See [Known Limitations](docs/KNOWN-LIMITATIONS.md).

## Quickstart

The public **Latest** page owns current release identity and evidence; public
Main is the runnable source candidate. Clone Main and keep that source identity
distinct from release evidence:

```sh
git clone https://github.com/JoFe2/PANSPHAIRA.git
cd PANSPHAIRA
git switch main
./demo/install.sh
```

Requirements are Linux x86_64, Docker with Compose v2, `jq`, `curl`, OpenSSL and
`sha256sum`. The installer uses fictional fixtures and local random secrets,
then prints `READY_VERIFIED` and loopback URLs after readback.

See the [full Quickstart](docs/QUICKSTART.md) for source verification, expected
output, the separate historical verified runnable archive, optional subsystem
boundaries and ownership-scoped cleanup. Do not treat that historical archive
as Latest or infer Main content from it.

```sh
./demo/uninstall.sh --purge
```

## Evidence and scope

- [Documentation hub](docs/README.md) and [capability
  matrix](docs/capabilities.md): canonical routes and maturity labels.
- [Security Assurance](docs/SECURITY-ASSURANCE.md), [Known
  Limitations](docs/KNOWN-LIMITATIONS.md), [Canon](docs/CANON.md) and
  [Architecture](docs/ARCHITECTURE.md): claims, gaps, laws and boundaries.
This is a local synthetic PoC, not a hosted service, security certification or
support promise. Use synthetic data on a disposable or development host.
Shared, ingested or unverified knowledge grants no authority.

## Releases

- [Latest public evidence release](https://github.com/JoFe2/PANSPHAIRA/releases/latest)
- [All releases and history](https://github.com/JoFe2/PANSPHAIRA/releases)
- [Releases Atom feed](https://github.com/JoFe2/PANSPHAIRA/releases.atom)

Release pages own included capabilities, increment details, evidence boundaries,
related issues/PRs, tests, assets and SHA-256 information; [release
governance](docs/RELEASE-GOVERNANCE.md) defines the intended publication and
anonymous-readback contract.

## Project and community

**Share what you know. Expand what everyone can build.**

- [Contribute](CONTRIBUTING.md), [get support](SUPPORT.md), or report a
  vulnerability through the [private security route](SECURITY.md).
- Report reproducible defects through [Issues](https://github.com/JoFe2/PANSPHAIRA/issues)
  and use [Discussions](https://github.com/JoFe2/PANSPHAIRA/discussions) for
  public project conversation; neither route creates a support SLA.

Code is Apache-2.0 under [LICENSE](LICENSE), [NOTICE](NOTICE) and
[THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md); external media keep their own
license boundary, and Apache-2.0 grants no trademark rights. See
[CITATION.cff](CITATION.cff) and [CONTRIBUTING.md](CONTRIBUTING.md).

Voluntary creator support:

<p>
  <a href="https://ko-fi.com/chimpmaera"><img src="assets/support/ko-fi.png" alt="Support PanSphaira on Ko-fi" width="180" height="33"></a>
  &nbsp;
  <a href="https://buymeacoffee.com/jimpansky"><img src="assets/support/buy-me-a-coffee.png" alt="Support PanSphaira on Buy Me a Coffee" width="180" height="33"></a>
</p>
