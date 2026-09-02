# AZPP-M1 public planning and evidence packet

Status: `CANDIDATE_ONLY`. This packet is a local, public-safe planning artifact and
 dry-run renderer input. It is not a tenant readback, deployment, release,
production decision, or claim that any future owner action occurred.

## Claim boundary

- Environment class: `LOCAL_SYNTHETIC_REPOSITORY_ONLY`.
- Tenant validation: explicitly not performed (`NO_TENANT_VALIDATION`).
- Runtime and production validation: explicitly not performed
  (`NO_RUNTIME_VALIDATION`, `NO_PRODUCTION_VALIDATION`).
- No external configuration, mutation, import, publication, or promotion was
  performed. The packet carries synthetic repository evidence only.
- A content digest is a pin, not an authorization, approval, credential, or
  execution result.

The renderer at
`tools/azure-power-platform/render-public-readback.mjs` accepts only the
allow-listed fields in
`tests/fixtures/azure-power-platform/public-readback-safe.json`. Unknown fields,
private material, unsupported production claims, and security-sensitive payloads
are rejected and produce only a redacted denial record.

## Exact pins and evidence references

| Item | Version | Digest / generation |
|---|---|---|
| Power Platform read connector | `1.0.0` | `1111111111111111111111111111111111111111111111111111111111111111` |
| Read connector schema | `1.0.0` | `6db105c03ad1d0fac78e6c53ac9259d5cbad69197b20dd92f5a5188572f13db2` |
| Power Platform read policy | `1.0.0` | generation `7`; `3333333333333333333333333333333333333333333333333333333333333333` |

The seven negative results are recorded as typed, effect-free denials in the
fixture: missing component digest, mutable version, private identifier,
unknown field, policy-generation mismatch, revoked LKG, and digest drift.
Each result references the `negative-matrix` evidence item and has
`effectCount: 0`.

Evidence references are repository-relative and digest-pinned:

- `historical-reconciliation` → `docs/evidence/conveyor/sol-psai32-state-reconcile-01.json`
  (`732ab2513546111ab496c63aa4b5e7595a87c7f28533e4f0491cd5c101acb6fa`)
- `connector-contract` → `docs/development/ppread-001-authority-free-power-platform-read-connector-pdca.md`
  (`bbf9260e76397248e3e97a7cca6417726b1bfc2e024d97066653f4a546388e19`)
- `connector-schema` → `docs/evidence/conveyor/sol-psai32-state-reconcile-01.json`
  (`6db105c03ad1d0fac78e6c53ac9259d5cbad69197b20dd92f5a5188572f13db2`)
- `negative-matrix` → `tests/azure-power-platform/readonly-denial-matrix.test.mjs`
  (`e8eb5a2d9f59d13fbe4ed477e63023f866da43e59f3dabc7985855f9efe6f0e0`)
- `rollback-lkg` → `tests/fixtures/azure-power-platform/tuple-valid.json`
  (`0e5fec98360b8d12fcefaa39063e4ca5344a707409c890daa51e5ff3db88e949`)

## Rollback target

The only recorded rollback target is
`EXACT_LKG_FULL_TUPLE_DIGEST_FROM_INDEPENDENT_TRUSTED_CONTEXT`, with target
 digest
`5555555555555555555555555555555555555555555555555555555555555555`, status
`LKG`, and revocation status `UNREVOKED`. Rollback authorization is
`OWNER_ONLY_REQUIRED`; partial rollback and latest-version fallback are both
false. This record names a target; it does not execute rollback.

## Historical and future milestones

Historical PR `#77`, commit
`5c4558bf94695e0766891347fbfa5ff2696f9842`, and release
`v0.2.0-poc.20260803.5` are represented only as
`RECONCILED_REPOSITORY_ONLY` evidence. Their repository-only limitation is
`REPOSITORY_ONLY_NO_FUTURE_MILESTONE_CLAIM`; historical closure does not prove
unchecked sandbox, import, proposal, execution, reset, pilot, release, or
public-readback milestones.

The safe fixture includes owner-controlled placeholders for `planningPr`,
`ci`, `merge`, `releaseDecision` (release/no-release), `release`, and
`publicReadback`. Every placeholder has status
`PENDING_OWNER_READBACK`, `reference: null`, `digest: null`, and
`requiredOwnerReadback: true`. No external URL, owner identity, release status,
or future completion is invented here.

## Dry-run commands

```text
node --test tests/azure-power-platform/public-readback.test.mjs
node tools/azure-power-platform/render-public-readback.mjs --dry-run --fixture tests/fixtures/azure-power-platform/public-readback-safe.json
node tools/azure-power-platform/render-public-readback.mjs --dry-run --fixture tests/fixtures/azure-power-platform/public-readback-unsafe.json --expect-rejected
```

The fixture is planning/evidence input only. Any later owner-controlled PR,
CI, merge, release/no-release decision, or authoritative public readback must
be populated from an authoritative owner readback and revalidated; this packet
does not claim those actions occurred.
