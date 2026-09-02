# Contributing to PanSphaira

Focused code, tests, documentation, fixtures, and design proposals are welcome
when they preserve PanSphaira's authority, safety, evidence, license, media,
and trademark boundaries.

## Fast path

1. Choose an issue, or open a short one describing the problem and proposed
   result.
2. Fork the repository and create a branch.
3. Make one focused change.
4. Run the relevant checks.
5. Open a pull request linked to the issue. Draft and independently useful
   partial pull requests are welcome.

Commenting before implementation is optional and can help avoid duplicate
work. It is not a claim, assignment, or pre-approval gate. Maintainers may
clarify scope, suggest splitting large work, or backfill an issue for work that
started earlier when the issue states the baseline and prior progress honestly.

Public status labels have precise meanings:

- `status:planned` — defined for a later sequence.
- `status:ready` — dependencies are clear and work can start.
- `status:blocked` — an explicit dependency or maintainer gate is unmet.
- `status:in-progress` — implementation has begun.

Security-critical issues may be marked `help wanted`, but are never beginner
tasks. A `good first issue` label is reserved for independent, low-risk work
whose dependencies are satisfied.

## Validation and evidence

Use evidence proportional to the changed surface:

- L0/L1 documentation, fixtures, and low-risk changes need their relevant
  focused checks.
- Changed L2/L3 authority, network, runtime, credential, data, or security
  surfaces need applicable positive and negative/security tests.
- Routine checks run in CI where available; do not recreate CI as manual
  ceremony.

The complete local check set is:

    npm ci --ignore-scripts --no-audit --no-fund
    npm run release-governance:verify
    npm run lint
    npm test
    npm run external-video-service:test
    sha256sum --check SHA256SUMS

Evidence should identify the exact tested commit and relevant versions or
digests, include deterministic counts or readback, and be sufficient to check
the supported claim. Sanitize logs and receipts. Do not publish raw exploit
details or security-sensitive fixtures.

The repository CI uses least-privilege, GitHub-hosted pull-request workflows.
Fork pull requests receive no production credentials. Never add secrets,
personal data, private prompts, host inventories, local paths, or non-public
artifacts. Use fictional fixtures.

Never use `pull_request_target`, owner/self-hosted infrastructure, or secrets to
execute untrusted contributor code. Preserve fail-closed authorization, strict
schemas, loopback defaults, minimal audit data, and ownership-scoped cleanup.

## Progress and review

Use one public issue for each clear, adoptable delivery slice or epic; do not
mirror every internal microtask. Each issue records scope, non-scope,
dependencies, measurable acceptance criteria, negative probes, required
evidence, rollback or recovery, and explicit non-claims.

Track the status chain as `planned` → `ready` → `in progress` →
`locally validated` → `merged` → `released`. Record implementation steps and
PDCA milestones as an issue checklist or material status comment, not per
commit. A pull request links its issue and applicable evidence.

An implementation issue stays open until reviewed work is merged. A private or
local branch does not close it. Release notes close the public delivery loop
only when the change is actually published. Never present `locally validated`
as `released`, or `planned` as `proven`. Security-sensitive final integration,
merge, and release remain maintainer-controlled.

Each published release is named for a functional product increment, never a
calendar-driven “Daily” identity. Choose exactly one versioned class. A
`REGULAR_RUNNABLE_ARTIFACT` has a project-built archive plus exact SHA-256
sidecar; a `SOURCE_EVIDENCE_ONLY` release has no custom assets and says exactly
`NO_ASSETS_SOURCE_ONLY`. Governance designates which class may own GitHub
Latest. A source/evidence-only Latest does not supersede or broaden the
separately identified runnable artifact.

Every new body follows the exact [release governance
contract](docs/RELEASE-GOVERNANCE.md): class, exact merge SHA, included
capabilities and issues, claim/proof boundary, tests, class-specific assets and
checksums, explicit nonclaims, and a closure state that remains blocked pending
public readback. Publication is complete only after anonymous public readback
confirms the tag-derived target, Latest class/state (`draft=false`,
`prerelease=false`), body, exact-head public docs and every declared asset byte.
The post-creation read-only workflow must pass before the final owner closes an
issue or marks its Queue row terminal; local or authenticated evidence cannot
substitute.

Run one **bounded contradiction preflight** for every public delivery. Map each
material claim ID to its maturity and proof class, authoritative artifact,
exact identity, executable or anonymous-readback gate, and explicit nonclaim.
Release-identity drift, proof-class inflation, a missing exact-head documented
path, circular or caller-minted provenance, and stale public status or
governance fail closed. The sole exception form is an exact acceptance ID with
a named negative regression probe; it cannot grant conformance or authorize a
historical tag, body, target, or asset mutation.

An editorial Daily may tell progress, decisions, learnings or preview a future
increment. It does not gate a release and must not describe a candidate as
published before that anonymous readback passes. Historical Daily manifests
remain provenance, not current release identity. Follow the canonical
[release governance contract](docs/RELEASE-GOVERNANCE.md); no historical record
is silently reclassified under the new taxonomy.

## Pull-request contract

Summarize the smallest useful result, link its issue, list relevant validation
and negative probes, and describe authority, safety, compatibility, rollback,
and known limitations. Keep unrelated cleanup out of the pull request.

Contributors must have the right to submit their work under the repository
license. No separate CLA, DCO sign-off, signed commit, assignment, bespoke
tool, or additional account setup is required by this guide.

## Security reporting

Report suspected vulnerabilities privately through [SECURITY.md](SECURITY.md),
not in an issue or pull request. Do not disclose credentials, exploit details,
affected private infrastructure, or other sensitive evidence publicly.

## Security follow-ups

The following are prioritized repository-hardening follow-ups, not contributor
prerequisites:

- **P0, low friction:** enable secret scanning, push protection, and
  CodeQL/default scanning when available.
- **P0 before trusting external code:** add CODEOWNERS for high-risk paths and
  require one maintainer/code-owner approval for external pull requests while
  preserving an owner bypass. Until that can be configured safely, the
  maintainer-controlled merge gate remains the fallback.
