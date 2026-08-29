# Update-controller synthetic delivery packet

Status: local, redacted, deterministic synthetic evidence for
`QWEN-PSAI53-DELIVERY-PACKET-09`. This packet is a pre-owner-operated handoff
for PR/CI/release review. It is not a release, promotion, deployment, or
runtime controller.

## Scope and evidence boundary

`scripts/render-update-controller-synthetic-evidence.mjs` composes the already
verified pure update contracts with the isolated in-memory apply harness. It
only renders canonical JSON to stdout. It does not read or write the
filesystem, start a process or service, access Docker, contact a registry, use
credentials, or change a pointer. `--dry-run` and `--readback` intentionally
produce the same packet; the readback is the verifier's public projection, not
an effectful apply.

The packet schema is
`chimpmaera.update/synthetic-delivery-packet/v1`, evidence version `1.0.0`,
evidence class `LOCAL_SYNTHETIC_REDACTED`, and mode `DRY_RUN_READBACK`. Its
canonical packet digest is computed over every packet field except
`packetDigest`.

## Exact six-axis tuple

The candidate/target tuple is fixed by
`UPDATE_SYNTHETIC_APPLY_HARNESS_TARGET_TUPLE_V1` and is verified by the harness
receipt verifier. Component digests below are synthetic fixture values, not
software provenance claims.

| Axis | Component | Version | Digest |
| --- | --- | --- | --- |
| Core | `core:safe-guided` | `1.1.0` | `1111111111111111111111111111111111111111111111111111111111111111` |
| Pack | `pack:general` | `1.0.0` | `2222222222222222222222222222222222222222222222222222222222222222` |
| Adapter | `adapter:dev` | `1.0.0` | `3333333333333333333333333333333333333333333333333333333333333333` |
| Policy | `policy:default` | `2.0.0` | `4444444444444444444444444444444444444444444444444444444444444444` |
| Schema | `schema:catalog` | `1.0.0` | `5555555555555555555555555555555555555555555555555555555555555555` |
| Generation | `generation:safe-guided` | `1.0.0` | `6666666666666666666666666666666666666666666666666666666666666666` |

Target tuple digest:
`8f873e2a8c3dd819a2bcc68b4865c9e6f60f40fb1d20823054829e5758375088`

The synthetic unrevoked LKG/source tuple is also pinned, rather than inferred:

| Axis | Component | Version | Digest |
| --- | --- | --- | --- |
| Core | `core:safe-guided` | `1.0.0` | `aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa` |
| Pack | `pack:general` | `1.0.0` | `bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb` |
| Adapter | `adapter:dev` | `1.0.0` | `cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc` |
| Policy | `policy:default` | `1.0.0` | `dddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd` |
| Schema | `schema:catalog` | `1.0.0` | `eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee` |
| Generation | `generation:safe-guided` | `1.0.0` | `ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff` |

Its tuple digest is:
`38332b435a93cc7683650322d402be575785481db1e1af7eb3fa1687fc964a39`.
The complete LKG digest is
`d0fe0bd6e84def21f3f98fcc7b0e5d19e549c0b1212905e070bfb2568424211b`.

## Redacted Doctor readback

The packet runs the fixture Doctor with the exact five QUICK probes:

- `cm:doctor-installation`
- `cm:doctor-runtime`
- `cm:doctor-configuration`
- `cm:doctor-version-lock`
- `cm:doctor-health-readback`

The public projection reports `readOnly: true`, `mutationCount: 0`, the bound
source tuple digest, and five `PASS` / `OBSERVATION_MATCHED` results. The
fixture's `privateObservation` values are discarded before rendering. No
secrets, operator identities, credentials, private paths, command output,
host addresses, or raw fixture observations are exported.

## Scenario receipts and readback

Every listed receipt is independently verified as
`VERIFIED / SYNTHETIC_APPLY_RECEIPT_VERIFIED` before it is included. The
receipt's digest, target tuple digest, source tuple digest, final pointer,
owner-state digest, residue count, state trace, contract checks, and final
readback are bound together.

| Scenario | Public outcome | Read-only | Required readback |
| --- | --- | ---: | --- |
| `SUCCESS` | `APPLIED` | false | Candidate pointer at target tuple, revision 2, residue 0; postcondition `ACCEPT_SWITCH`. |
| `PARTIAL_MIGRATION` | `ROLLED_BACK_ZERO_RESIDUE` | false | Exact `lkg:synthetic-001` pointer and source tuple, revision 3, original owner-state digest, complete unrevoked LKG, residue 0. |
| `FAILED_POSTCONDITION` | `ROLLED_BACK_ZERO_RESIDUE` | false | Same exact LKG, pointer, owner-state, and zero-residue conditions as partial migration. |
| `REGISTRY_OUTAGE` | `PRESERVE_ACCEPTED` | false | Initial and final pointers are byte-identical at the locally Accepted candidate; no registry fallback is claimed. |
| `INVALID_LKG` | `SAFE_READ_ONLY` | true | Pointer is unchanged, LKG state is `INCOMPLETE`, and no apply or rollback is reported. |

The rollback scenarios include `POSTCONDITION_FAILED`, `ROLLBACK_LKG`,
`CLEANUP`, `ZERO_RESIDUE`, and `RETRY_READBACK` in their state trace. Retry
ordinal is fixed at `2`; repeating the same scenario produces byte-identical
receipts and retry receipt digests. Changing residue or any other bound field
causes `DIGEST_MISMATCH_DENIED` rather than a success claim.

## Authority and fail-closed boundary

The promotion gate is an independent contract check. It binds the candidate,
updater, exact target tuple, artifact digest, independent verifier, separate
promoter decision, and identity boundary while issuing no capability. The
candidate/updater cannot occupy the verifier or promoter role; the underlying
promotion-gate suite covers self-attestation, self-promotion, role collision,
identity substitution, tuple drift, and capability-claim denial.

The packet's explicit claims are limited to:

- `PINNED_SIX_AXIS_TUPLE_VERIFIED`
- `CM_DOCTOR_READ_ONLY_ZERO_WRITE_REDACTED`
- `PARTIAL_MIGRATION_ROLLS_BACK_TO_EXACT_UNREVOKED_LKG_ZERO_RESIDUE`
- `FAILED_POSTCONDITION_ROLLS_BACK_TO_EXACT_UNREVOKED_LKG_ZERO_RESIDUE`
- `REGISTRY_OUTAGE_PRESERVES_LOCAL_ACCEPTED_OPERATION`
- `INVALID_LKG_ENTERS_SAFE_READ_ONLY_MODE`
- `UPDATER_AND_CANDIDATE_CANNOT_SELF_ATTEST_OR_SELF_PROMOTE`
- `ROLLBACK_RETRY_IS_DETERMINISTIC_AND_FULLY_RECEIPTED`

The packet also carries these explicit nonclaims:

- no owner-operated PR, CI, or release;
- no merge or production activation;
- no live registry, provider, or external service;
- no operator identity or filesystem-path export;
- no security certification or hostile-host proof; and
- no autonomous promotion authority.

The owner gate is therefore `NOT_PERFORMED` for PR, CI, and release, and
`NOT_ISSUED` for promotion authority. Any owner-operated gate must independently
read back this packet and run its own pinned-Node/host-Docker checks.

## Reproduction and verification

From the repository root:

```sh
npm run build --silent && node --test tests/update-controller-synthetic-evidence.test.mjs
node scripts/render-update-controller-synthetic-evidence.mjs --dry-run
node scripts/render-update-controller-synthetic-evidence.mjs --readback
```

The focused delivery-packet test covers tuple and receipt binding, Doctor
zero-write readback and redaction, all five scenario outcomes, receipt tamper
denial, deterministic rollback retry, identical dry-run and readback output,
unsupported CLI mode rejection, and the renderer's absence of
filesystem/process/network/credential export paths. The underlying
synthetic-apply and promotion-gate suites supply the stale/forged CAS,
self-attestation, self-promotion, and role-collision fail-closed checks.

Verification record for this workspace: the required command was attempted
exactly as written and the local Node process exited `133` before the build
completed with the V8 `OS::SetPermissions` assertion (`Check failed: 12 ==
(*__errno_location ())`). This is infrastructure evidence, not a product
verdict. Re-running the same build and focused test with
`NODE_OPTIONS=--jitless` passed the build and all 7 focused tests. The direct
promotion-gate and synthetic-apply suites also passed all 14 tests under that
workaround. The broader `npm run test` was not used as an acceptance claim:
under the workaround it stopped at an unrelated loopback test because
`WebAssembly` is unavailable in jitless mode (`fetch failed`).

This slice proves only local synthetic contract composition and redacted
readback. It does not prove installation, migration execution, package
integrity, live registry behavior, Docker behavior, owner review, CI, release,
deployment, production operation, or any external identity or credential
boundary.
