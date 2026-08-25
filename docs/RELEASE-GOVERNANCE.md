# Release governance

This document is the canonical, fail-closed publication contract for
PanSphaira. The machine-readable companion is
[`release/governance.json`](../release/governance.json), enforced by
`npm run release-governance:verify` in every pull request.

## Product increments, not calendar identity

A public release is named for the functional, evidence-backed increment it
delivers. A date or editorial cadence may appear as provenance, but labels such
as “Daily”, “today's release” or “previous Daily” must not be the identity of an
active public release. The current regular release is
`v0.2.0-poc.20260825.1`, **PanSphaira v0.2.0-poc.20260825.1 — canonical-number
hardening**. Its increment rejects negative zero before canonicalization in
Verification Fabric timestamps and Extension Assurance Profile numeric
boundaries. It performs no migration, restore, filesystem, package, schema or service
mutation, pointer switch, migration or rollback execution, activation,
promotion, production deployment or external completion inference.
`v0.1.0` is historical only.

Editorial Daily content is independent. It may describe progress, decisions,
learnings or a preview. It does not gate a release and must not claim that a
version was published until the anonymous public readback below passes.

## Release-state policy

- **Draft:** preparation only; never public/current.
- **Prerelease:** an explicitly labeled preview; never regular Latest.
- **Regular Latest:** the newest accepted product increment with
  `draft=false`, `prerelease=false`, and an exact anonymous
  `/releases/latest` readback matching its tag.

Repository state, CI, a tag, authenticated API output or an editorial post is
insufficient by itself. After publication, run:

```sh
env -u GH_TOKEN npm run release-governance:public-readback
```

The verifier sends no authorization header. It checks the release ID,
publication timestamp and URL, tag reference, release title/body, target,
Latest/draft/prerelease state, raw `main` public
surfaces, exact asset-name set, sizes, asset-manifest content and SHA-256 bytes.
Unknown, missing or extra evidence fails closed.

## Required publication evidence

Before publication, the pull request must contain:

1. a functional increment name and exact expected tag;
2. claim-to-evidence mappings and explicit non-claims;
3. conservative Security Assurance and Known Limitations boundaries;
4. a complete release-asset inventory, manifest and SHA-256 digests;
5. focused positive and negative validator tests;
6. secret/private-path scanning of active public surfaces;
7. green repository, lint, checksum and supply-chain gates.

After publication, preserve an anonymous readback record for the tag, Latest
state, public docs, release metadata and every asset byte. Editing title/body
does not authorize changing a tag, target or asset. Any mismatch blocks the
public claim and requires correction or rollback.

## Public README and documentation presentation

Every pull request and release candidate must inspect the root README on both
mobile and desktop rendering, not only as Markdown source. Accessibility is
part of the release surface: meaningful images require non-empty, descriptive
alt text, while an extended text alternative may live in a compact
`<details>` disclosure or in clearly linked architecture documentation.

The release-governance verifier applies this rule to the paths declared in
`activePublicFiles`. Unencapsulated technical labels such as `Text fallback:`
or placeholder labels fail closed because they turn implementation scaffolding
into primary public copy. Empty or generic Markdown/HTML image alt text also
fails closed. Declared historical archive prefixes remain immutable evidence
and are not retroactively rewritten by this presentation gate. The check does
not claim exhaustive assistive-technology certification; it preserves useful
alternatives while keeping the active README and documentation
orientation-focused.

## Claim/evidence boundary

The canonical mappings live in `release/governance.json`. Every claim needs a
stable ID, existing evidence paths and at least one non-claim. For this proof of
concept, evidence is local and synthetic. It does not establish production
readiness, certification, universal containment, customer-data fitness,
generic ETL/MDM capability or a production system of record.

Each grouped functional component in a release additionally records its
user-oriented claim and value, included public-manifest bytes, focused positive
proof, relevant changed-surface fail-closed proof, explicit non-claims, and
PDCA plus exact release-commit and asset-checksum bindings. The governance
validator requires included bytes and focused proof paths to be present in the
public manifest. Repository PDCA paths must exist but remain outside the public
asset under the existing development-evidence hygiene rule. This is release
evidence for included functionality, not a separate product scope or an
invitation to add broad optional test matrices.

## Active videos and historical evidence

Only video IDs listed under `videos.activeVerifiedIds` may appear on active
README Watch/video surfaces. Withdrawn IDs fail validation. Historical Daily
candidate records under the declared archive prefixes remain immutable
provenance and are not scanned as current public identity.

## Change procedure and rollback

Change the canonical JSON, docs, validator and tests together. Preserve asset
bytes and tags unless a separate release task explicitly authorizes replacing
them. A metadata-only correction is reversible by restoring the prior
title/body; first record the tag/target and anonymous asset inventory so the
rollback cannot silently mutate release evidence.
