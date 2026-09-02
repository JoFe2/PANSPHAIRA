---
title: Quickstart
description: Install, verify, run, and ownership-scope cleanup for PanSphaira's fictional local CRM-to-ERP proof of concept.
---

# Quickstart

> **Local synthetic safety boundary**
>
> Run only on a disposable or development Linux x86_64 host. The demo uses
> fictional fixtures, creates local random credentials, binds services to
> loopback, and must be removed with the ownership-scoped cleanup command below.
> It is not a production deployment or a live-system compatibility test.

For background, see the [Canon](CANON.md), [Operating Field
Guide](OPERATING-FIELD-GUIDE.md), [Architecture](ARCHITECTURE.md) and [Known
Limitations](KNOWN-LIMITATIONS.md).

## Requirements

Install Docker Engine with Docker Compose v2 and the local command-line tools
`jq`, `curl`, OpenSSL and `sha256sum`. The repository requires the exact Node.js
and npm ranges declared in [`package.json`](../package.json) (currently Node.js
24 and npm 11).

Repository paths and stable technical identifiers may still use `chimpmaera` or
`cm`; see the [terminology and identity guardrails](PANSPHAIRA-TERMINOLOGY.md).

## Choose a source identity

### Current Main source candidate

Public Main is the runnable development source candidate. It is not a
checksum-bound release asset and must remain distinct from released evidence:

```sh
git clone https://github.com/JoFe2/PANSPHAIRA.git
cd PANSPHAIRA
git switch main
git rev-parse HEAD
```

At this governance baseline the public **Latest** page identifies the
source-only evidence release `2026_09_02_v7`, exact target
`1e65fee46c609ba7239d63b9c245b32e045e004c`, with zero custom assets. It is an
explicit legacy pre-v2 record, not a conforming body template. Inspect the live
target and asset list on
[Latest](https://github.com/JoFe2/PANSPHAIRA/releases/latest) before relying on
that moving public identity. Record `git rev-parse HEAD` for a Main checkout;
GitHub-generated source archives are not substitutes for the project-published
checksum sidecar of the historical runnable archive below.

### Historical verified runnable archive

The prior `v0.2.0-poc.20260825.1` canonical-number hardening release remains a
historical verified runnable PoC archive with a project-published SHA-256
sidecar. It is **not Latest**. Use its immutable [release
page](https://github.com/JoFe2/PANSPHAIRA/releases/tag/v0.2.0-poc.20260825.1)
or the exact commands below to obtain and verify the archive and sidecar; do
not infer current-Main content or current release status from that historical
artifact.

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

## Verify the source candidate

Install the exact locked dependencies, then run the repository checks:

```sh
npm ci --ignore-scripts --no-audit --no-fund
npm run lint
npm test
```

If the complete npm cache is already populated and network-free installation is
required, use the optional offline form instead:

```sh
npm ci --offline --ignore-scripts --no-audit --no-fund
```

The external video boundary has a lightweight contract check that neither
builds a GPU image nor downloads a model:

```sh
npm run external-video-service:test
```

Passing source tests is local candidate evidence; it does not turn a Main
checkout into a release archive or establish production fitness.

## Run the playable demo

```sh
./demo/install.sh
```

The installer creates random local demo credentials, builds the PanSphaira
runtime image, starts the pinned CRM/ERP stack, loads fictional fixtures and
performs semantic readback. Initial installation can download the pinned
container images.

Success prints `READY_VERIFIED` and three loopback URLs. Keep the generated
credentials local. The default `SAFE_GUIDED` flow exercises permitted, denied
and escalation outcomes. The separately confirmed `RAMPAGE` profile is an
explicit local-demo opt-in and is outside the governed SAFE_GUIDED reference
path.

## Optional external BI service

BI is not embedded in the CM demo stack. To use the standalone BI subsystem,
run the supported KaleidoSphere v0.8.0 compatibility release, then point CM only
at its SBA loopback URL with `BI_AGENT_BASE_URL`. Direct Superset URLs are
rejected. See the [External BI service contract](EXTERNAL-BI-SERVICE.md).

## Stop and remove owned state

```sh
./demo/uninstall.sh --purge
```

The cleanup command is ownership-scoped. Never substitute broad Docker prune or
filesystem deletion commands. Cleanup is not provider Rollback or authority
Revoke; [CM-CAN-13](CANON.md) defines the distinction.
