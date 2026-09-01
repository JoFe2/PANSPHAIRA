# CKS-12 top-level envelope policy v1

Status: `IMPLEMENTED / EXACT DELIVERY INPUTS / LOCAL WORKER EVIDENCE ONLY`

- Implementation task: `CAMPAIGN-V1-FND-PS-FU-01-IMPLEMENT-01`
- Delivery task: `CAMPAIGN-V1-FND-PS-FU-01-DELIVERY-01`
- Policy ID: `chimpmaera.cks/readonly-kaleidosphere-top-level-envelope-policy/v1`
- Admitted bridge schema: `chimpmaera.cks/readonly-kaleidosphere-bridge/v1`
- Boundary: `runReadOnlyMinimizedProjection(input: unknown)` only

This policy hardens the Risk-C unknown-input boundary on the admitted Main. It
preserves Operating Model v1.1 and decisions D-001 through D-007. It does not
create another process lane, authorize an external call, use credentials, widen
Capability or Authority, promote an asset, or make a production claim.

## Exact v1 envelope

A v1 top-level envelope has exactly these own keys:

1. `authorityRequested`
2. `canonicalEvidenceAfterSha256`
3. `canonicalEvidenceBeforeSha256`
4. `capabilityRequested`
5. `componentVersions`
6. `dryRun`
7. `operation`
8. `projection`
9. `promotionRequested`
10. `schemaVersion`

Object-key order is not semantic. Every listed key is required. Every key must
be a string-keyed, own, enumerable data property. No other own key is admitted,
including a non-enumerable key or a symbol. Accessor properties are not data
properties and are denied without invoking a getter or setter.

The top-level value must be a direct plain object with `Object.prototype` as its
prototype. Arrays, functions, class instances, null-prototype records, and all
Proxy objects are denied. Proxy rejection occurs before ordinary prototype,
own-key, descriptor, or property-get operations, so caller-controlled
`getPrototypeOf`, `ownKeys`, `getOwnPropertyDescriptor`, and `get` traps are not
invoked by top-level validation.

## Snapshot-before-semantics rule

Validation performs these steps in order:

1. Reject non-objects and Proxy objects.
2. Require the ordinary plain-object prototype.
3. collect all own keys with `Reflect.ownKeys` and compare them with the exact
   v1 key set;
4. inspect each required own-property descriptor;
5. reject a missing, non-enumerable, or accessor descriptor; and
6. copy only descriptor `value` entries into a frozen internal snapshot.

All subsequent top-level semantic reads use that internal snapshot, not the
caller object. No `Reflect.get`, property read, getter, or caller-provided
expected-value object participates in constructing the snapshot.

## Semantic locks

After structural admission, the existing bridge semantics apply to the
snapshot, with these explicit v1 locks:

- `schemaVersion` equals the admitted bridge schema above;
- `componentVersions` is compared with the bridge-owned
  `COMPONENT_VERSIONS` constant, never a caller-owned expectation;
- `dryRun` is exactly `true`;
- `operation` is exactly `READ_ONLY_MINIMIZED_PROJECTION`;
- the before digest is 64 lowercase hexadecimal characters and the after
  digest is exactly equal to it;
- `authorityRequested`, `capabilityRequested`, and `promotionRequested` are
  each exactly `false`, rather than merely not equal to `true`; and
- `projection` remains subject to the existing minimized projection, node, and
  edge checks.

A top-level representation-policy failure returns the existing stable denial
`MISSING_INPUT / bridge input must be an object`. A schema mismatch returns
`VERSION_LOCK_MISMATCH / bridge envelope schema mismatch`. Any non-`false`
authority, capability, or promotion request returns the existing
`AUTHORITY_EXPANSION_DENIED` denial. No denied input produces a candidate.

## Compatibility and adversarial evidence

The canonical plain-JSON fixture already has exactly the ten declared own
enumerable data fields. Its raw bytes are unchanged, and the bridge continues
to produce the committed candidate and receipt canonical bytes. This policy
changes only malformed or adversarial top-level representations and values.

The focused test matrix covers:

- the unchanged fixture, candidate, and receipt byte contract;
- exact required keys and own enumerable data descriptors;
- missing, hidden, symbol, and unknown keys;
- hidden and symbol `authority`, `capability`, `promotion`, `raw`, and `unknown`
  fields;
- every declared field represented as an accessor, with zero invocations;
- top-level Proxies carrying throwing `getPrototypeOf`, `ownKeys`,
  `getOwnPropertyDescriptor`, or `get` traps;
- schema-version drift; and
- non-boolean or non-`false` authority, capability, and promotion requests.

The adversarial Proxy case is the focused RED/GREEN regression. On the admitted
base, an `ownKeys` trap occupied an uninspected top-level shape surface and the
input was accepted as a candidate. Under this v1 policy, the same input receives
the stable top-level denial.

## Exact cumulative delivery candidate

The delivery policy
`pansphaira.fnd-ps-fu-01/delivery-candidate-policy/v1` prepares one exact
candidate for one independent issue review. It is a pure fail-closed evaluation:
it reads no repository, network, credential, provider, CI, issue, PR, release or
service state and performs no effect. A ready evaluation does not perform or
authorize the review or any later action.

The admitted cumulative base is
`b41337348f3b379870c3006a9647ecdfdc29f6f7`. The changed-path sequence is exact:

1. `SHA256SUMS`
2. `docs/architecture/cks-12-top-level-envelope-policy-v1.md`
3. `package.json`
4. `release/public-files.manifest`
5. `scripts/build-public-release.sh`
6. `src/cks-12/readonly-kaleidosphere-bridge.ts`
7. `tests/cks-12/readonly-kaleidosphere-bridge.test.ts`
8. `tests/release-governance.test.mjs`
9. `verification/verification-dag-v2.json`

The final clean commit supplies `candidateHead` from `git rev-parse HEAD` and
`candidateTree` from `git rev-parse HEAD^{tree}`. Each observed repository
identity, gate receipt and integrity receipt must repeat both values exactly.
The head cannot be embedded in bytes that determine that same head; Git's commit
object binds the reported head to the reported tree, and the handoff records
both after the final local commit. This avoids a recursive or mutable identity.

### Exact gate inputs

Every gate receipt has status `PASS`, a 64-character lowercase SHA-256 output
digest, and the exact candidate head and tree. The gate set is closed:

| Gate ID | Input |
| --- | --- |
| `FOCUSED_POSITIVE_NEGATIVE` | `npm run fnd-ps-fu-01:test` |
| `LINT` | `npm run lint` |
| `RELEASE_GOVERNANCE_TEST` | `npm run release-governance:test` |
| `RELEASE_GOVERNANCE_VERIFY` | `npm run release-governance:verify` |
| `SUPPLY_CHAIN_VERIFY` | `npm run supply-chain:verify` |
| `CHECKSUMS` | `sha256sum -c SHA256SUMS` |
| `VERIFICATION_PLAN` | `npm run verification:plan` |
| `PUBLIC_RELEASE_BUILD` | `./scripts/build-public-release.sh --output <isolated-absolute-path>` |
| `DIFF_CHECK` | `git diff --check origin/main...HEAD` |

`npm test` is deliberately not a worker gate: the Root-QS Sol final owner owns
the separately authorized final full suite. An infrastructure-blocked gate is
not converted into `PASS` and therefore cannot produce delivery readiness; it
also is not a product-failure verdict.

The integrity receipt set is exactly `SHA256SUMS`,
`release/public-files.manifest`, and `verification/verification-dag-v2.json`.
Each receipt is `VERIFIED`, SHA-256 shaped and head/tree bound. Together they
make the cumulative source/test/document bytes, public inclusion and
Verification Fabric registration independently reproducible.

### Issue acceptance mapping

| Criterion ID | Required evidence ID | Issue acceptance |
| --- | --- | --- |
| `AC-TOP-LEVEL-PROXY-FAIL-CLOSED` | `TEST-TOP-LEVEL-THROWING-PROXY-DENIAL` | Throwing top-level Proxy traps neither run nor escape, and no Proxy candidate is accepted. |
| `AC-TOP-LEVEL-ACCESSOR-NONINVOCATION` | `TEST-TOP-LEVEL-ACCESSOR-ZERO-INVOCATIONS` | Every top-level field represented as an accessor is denied with zero invocations. |
| `AC-EXACT-ENVELOPE-ADJUDICATION` | `TEST-HIDDEN-SYMBOL-AND-UNKNOWN-FIELDS-DENIED` | Hidden, symbol, raw, authority, capability, promotion and unknown fields are adjudicated by v1. |
| `AC-PLAIN-JSON-COMPATIBILITY` | `TEST-CANONICAL-CANDIDATE-AND-RECEIPT-BYTES` | Existing plain-JSON fixture, candidate and receipt canonical bytes remain equal. |
| `AC-CANARY-3-SEPARATION` | `POLICY-CANARY-3-AUTHORITY-SEPARATION` | Positive, negative, independent-review and public-closure authority remains sequential and separate. |

Every mapping must occur exactly once with status `PASS`. Missing gates, gate
input drift, stale candidate or receipt identities, scope drift, missing or
malformed integrity receipts, missing/remapped/non-PASS criteria, or a mutable
authority expectation returns `NOT_READY`. No partial result upgrades to ready.

## Canary-3 authority separation

Positive success evidence, negative fail-closed evidence, independent review,
and full public closure remain separately authorized in the inherited
sequential Canary-3 order. Evidence from one step does not authorize or imply a
later step. This worker artifact records only implementation and worker-owned
local positive/negative checks and exact gate inputs; it does not claim an
independent review or full public closure. The immutable expectation assigns
exactly one review plus the final full suite, PR, CI, merge, release, anonymous
readback and issue closure to the Root-QS Sol final owner. This worker's effect
and authority remain `NONE`. Any policy-field or representation-rule change
requires a new version and the same sequential authority.
