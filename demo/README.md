# PanSphaira local demo installer

The demo is the bounded implementation example for
[The PanSphaira Canon](../docs/CANON.md). Use
[Architecture](../docs/ARCHITECTURE.md) and
[Known Limitations](../docs/KNOWN-LIMITATIONS.md) to distinguish shipped local
behavior from non-claims.

The installer starts a local synthetic CRM/ERP stack and verifies
authenticated provider readiness, mapped fictional identities, a
digest-bound catalog, one governed CRM-to-ERP order flow and the deterministic
Admin-AI preview boundary.

The released local Wave 1 surface adds an Approval Workbench for the
existing synthetic order escalation. It derives the readable business diff
from a bounded provider snapshot, binds its local version plus requester,
purpose, impacts, rollback and Policy, then rechecks freshness at approval and
use. An authenticated local Approve issues a short one-use lease; Reject issues
none. The provider gate and separate decision/effect receipts preserve those
bindings. Stale, hidden, truncated, rejected, tampered, expired and replayed
leases cannot execute. This remains a deterministic static-policy demo with no
real provider transaction/ETag, live LLM or production owner identity.

## Requirements

- Linux x86_64;
- Docker Engine with Docker Compose v2;
- `jq`, `curl`, OpenSSL and `sha256sum`;
- permission to build the local demo image and create installer-owned Docker
  containers, volumes and networks;
- free loopback ports `7780`, `7781` and `7782`, unless overridden with unique
  `CM_*_PORT` loopback bindings.

Do not use production credentials or real customer data. Initial installation
may download the pinned container images declared in `compose.yaml`.

## Install

From the release root:

```sh
./demo/install.sh
```

The guided defaults select the complete synthetic demo with safe local
authority. The optional `RAMPAGE` profile is a test-lab mode and requires the
explicit `CM_RAMPAGE_CONFIRM=I_UNDERSTAND_LOCAL_DEMO_ONLY` opt-in. It does not
grant host privileges.

Success prints `READY_VERIFIED` and loopback URLs for PanSphaira, EspoCRM and
Dolibarr. An unchanged rerun is idempotent. The Admin-AI PoC uses a
deterministic local policy, not a live LLM or production delegation service.
The dashboard permission X-ray is GET-only and informational: it displays the
exact synthetic profile/assignment/capability/constraint intersection and
issues no executable authority.

The source tree also contains a Wave 3 Paperless-ngx zoo adapter contract. It
is intentionally disabled in this installer (`CM_DMS=off`) and is tested only
against synthetic HTTP fixtures. It reads bounded metadata through fixed GET
paths and has no upload, content-download, delete or arbitrary-URL operation.
The playable stack does not install or claim compatibility with Paperless.

After a SAFE_GUIDED install, the bounded endpoint smoke can be run with:

```sh
./demo/approval-workbench-smoke.sh
```

The script creates one additional fictional Dolibarr order, proves a rejected
proposal cannot act, proves an approved lease acts once, rejects replay, and
writes digest-only evidence under `.chimpmaera-demo/public/`.

## Effective entry and evidence handoff

Docker daemon access is an administrator prerequisite: the existing operator
must authorize image builds and only the synthetic installation's containers,
volumes and eight project-isolated network allocations. Having source files does
not supply these rights or address capacity. Do not change daemon address pools,
prune foreign resources, add users to privileged groups or repair global harness
configuration to make an installation pass. A failed convergence or readback is
not a successful start.

Use unique explicit loopback bindings when the defaults are unavailable:

```sh
CM_CHIMP_PORT=127.0.0.1:43730 \
CM_ESPO_PORT=127.0.0.1:43731 \
CM_DOLI_PORT=127.0.0.1:43732 \
./demo/install.sh
```

These are example ports, not a claim that they are free or native-tested on the
current machine. The active URLs, vendor public origins and runtime health Host
use the selected bindings. An unchanged rerun retains the bindings stored in
`.chimpmaera-demo/config.env`; an explicit valid override replaces them. Invalid,
non-loopback, duplicated or credential-bearing address inputs are denied. A
failed port allocation does not print successful active addresses. DMS stays
`off`, has no active URL and is not an installed Paperless service. Do not put
credentials, tokens or passwords in URLs.

The six `READINESS_*` rows keep distinct proof classes:

- `SOURCE` records the local image-build input digest, not a qualified source
  commit or complete release tree identity. Its file names are invocation-local.
- `BUILD` records the observed immutable image returned after the image build.
- `SERVICE` records completion of the selected semantic native readback.
- `READINESS_MODEL` stays `NOT_RUN`: this installer executes no real model proof.
- `TOOLS` records the native provider bootstrap, not LLM/tool composition.
- `BUSINESS` records the selected synthetic governed flow, or
  `NOT_APPLICABLE_SEED_DISABLED` when seeding is disabled.

`NOT_RUN` model evidence neither upgrades the local run to global readiness nor
invalidates independently measured build or native service evidence. A
`SOURCE_EVIDENCE_ONLY` release is source evidence, not a ready installation.
The selected run still requires the real build, actual configured services,
authenticated provider readback and the selected synthetic business checks.

For a tested-identity handoff, retain the actual clean source commit and tree,
qualified release tag when applicable, observed image identity, configured
project/run ownership, all three effective bindings, redacted installer stdout,
the per-run journal and authoritative `.chimpmaera-demo/readback.json`.
Independently reach each printed active URL and bind its response to the claimed
native service and project. Do not label an unavailable native run as measured:
keep native proof `NOT_RUN` and its precise owning-host capacity/access trigger.
Never substitute the local build-input digest, a branch name or HTTP 200 alone
for that tested identity and service proof.

### Retained entry native observation — 2026-10-14

The previously capacity-held entry candidate was reconciled in its retained
checkout onto released Main `b32682297cc09fdf059ee7fd1e93ed0809a05158`.
Its four retained feature files were byte-preserved in development tree
`0c78c7536af9d879d53a73e2850f5212d2a5c835`. There was no changed-source
commit at this development-run boundary; these are not frozen release results.
The complete 3,053-file staged source export ran the actual unmodified
installer, not Fake Docker or substituted bootstrap scripts.

Eight simultaneous default-IPAM network allocations and three concurrent
loopback bindings were actually observed and their exact owned probe networks
removed. The subsequent isolated SAFE_GUIDED seeded installer exited zero in
105,262 ms. Each emitted address was independently joined to its observed
project container, pinned image, loopback port and authenticated native service:

- PanSphaira: `http://127.0.0.1:49789`, native status and SAFE_GUIDED identity;
- EspoCRM: `http://127.0.0.1:35681`, native authenticated admin and version 9.1.9;
- Dolibarr: `http://127.0.0.1:42899`, native authenticated status and version 22.0.3.

The observed built runtime image was
`sha256:cc8c46cba7c58aa976f22a1704a19da0a7c52720ef965cb3490a917b64345914`.
A real warm installer retained those persisted ports and project despite an
ambient independent Compose name. An occupied owned loopback port caused a
real nonzero convergence exit, no successful active-address output, and no
change to the independent synthetic HTTP control. Existing safe stop retained
all five owned volumes; the qualified run/image/project-bound purge then left
zero owned containers, networks, volumes or images and preserved the foreign
baseline. Those addresses are measured historical bindings, not reserved ports
or a claim that a later machine will have them available.

The six readiness rows were observed separately: local build inputs, built
image, semantic native services, model `NOT_RUN`, native provider bootstrap
with model/tool composition `NOT_RUN`, and the selected synthetic governed
business flow. Disabled DMS had no URL. The earlier twelve mock-interaction
checks remain only interaction/rendering/document evidence. This development
observation is not exact-head canonical CI, frozen original acceptance, a
finished source-only installation or full issue closure; the normal required
review, qualification, release and anonymous exact readback remain separate.

Existing browser-first owner #562 receives this exact bounded tested identity,
readiness distinction and secret-file references, never raw secrets or new
inferred rights.
There is no additional setup UI or separate browser-first owner here. For safe
interruption, run `./demo/uninstall.sh` to stop the configured installation while
retaining data. See the exact-owned purge checks below; ordinary interactive
installation does not acquire destructive custody merely by printing a command.

## Local runtime state

The installer generates random local demo secrets and state under
`.chimpmaera-demo/`. Per-run diagnostic receipts are written under
`.chimpmaera-acceptance/`. Neither directory belongs in a source or release
archive.

The scheduled/release exact-head gate is documented in
[Current-head Docker E2E](../docs/DEMO-CURRENT-HEAD-E2E.md). Its
`CM_DEMO_RUN_OWNER` input is reserved for the bounded CI runner: it must equal
the isolated Compose project and adds a second ownership label to the locally
built image. Ordinary interactive installs leave it unset.

## Cleanup

The uninstall parser accepts no option, `--purge`, `--help` or `-h` only.
Help exits zero without Docker or file effects. Unknown or extra arguments exit
two before any Docker call or file mutation, even when configuration exists.

Stop the configured installation while retaining its volumes and local state:

```sh
./demo/uninstall.sh
```

Only explicit `--purge` selects data removal. It requires one configured Compose
project, its matching bounded run-owner marker, the observed installer image
ownership and exact run label, and matching project labels on existing declared
volumes. All checks happen before teardown; the configured project is passed
explicitly so an ambient `COMPOSE_PROJECT_NAME` cannot redirect the operation.
Linked state or configuration is rejected.

```sh
./demo/uninstall.sh --purge
```

Missing or contradictory ownership refuses purge without removing data. Ordinary
interactive installs without the bounded run marker can be stopped, but this
safety-qualified purge path does not infer their destructive ownership. Do not
invent a marker, relabel resources, use Docker pruning, or broadly delete files
to force cleanup. Retain the stopped state for an owning operator's qualified
resource disposition.

The focused native safety probe uses only newly created synthetic resources,
no-network containers and an independently read live control. It demonstrates
stop/data retention and exact-owned purge, not a fresh full installer, ERP result,
model execution or hostile same-user sandbox.

`READY_VERIFIED` applies only to the selected local run. It is not a
publication, production, support, performance or security-certification
claim.
