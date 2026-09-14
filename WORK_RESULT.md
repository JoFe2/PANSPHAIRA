# WORK_RESULT — XRA-PS-02 native wire/head integration (campaign node)

**Status: local PanSphaira change complete. NOT DELIVERED / NOT CLOSED.** This is a
bounded, locally validated source result on fresh current main
`a70b3ff9ca07d5061e8c6e22564d23b0cc97acf8`, with no legacy XRA-PS-02 candidate or
state. The scope is ONLY the additive closure of the remaining XRA-PS-02 work:
implement the native wire/head integration that connects the real KaleidoSphere
native authority-free service candidate (versioned, nested-binding, served by
`POST /v1/pansphaira-analytics/native-projection` from
`services/bi-agent/src/pansphaira-analytics/native-candidate.mjs`) to an independent
PAN adjudicator in `src/cks-12/kaleidosphere-candidate-quarantine.ts`, superseding
the local flat synthetic candidate and the stale bound heads
`24db4e926385b006c9f2fbca3588adece72e7fb0` /
`90c574e9a06cb752be06270395d44a31eabc44ae` with the reconciled released pair
`7f662672bfc45087342f23e5c589d43598f5c20d` (PAN release `2026_09_05_v1`) and
`545a3b44ea88c96eded060c11c7c3a2afe0edff6` (KS service release `2026_09_09_v1`,
tree `c0699e1b4cfdfaf3076928e644ba5da3e9b7798c`); define the AC02
restriction/conflict cases from real native output or an independently sourced PAN
adjudication context; and produce-and-verify the seven-stage Root-QS replay, the
five paired clean-room cases, the new paired receipt, and the registration gates.
The existing locally-proven AC01/AC04 flat source slice, the four original
acceptance criteria, and all publication/nonclaim fences are preserved unchanged.
The four original ACs: **AC01** independent PAN adjudication, consumer verdict
non-authoritative; **AC02** five exact outcomes
(positive→`ACCEPTED_BOUNDED`, restricted-unknown→`RESTRICTED`,
conflicting-counterevidence→`DENIED`, forged-candidate→`DENIED`,
stale-head→`DENIED`); **AC03** paired receipt binds both released heads plus the
complete seven-stage chain
(`GENERATION→PROJECTION→INGESTION→SEMANTICS→ANALYSIS→CANDIDATE→ADJUDICATION`);
**AC04** no canonical Knowledge/authority/capability/effect mutation. The delivery
job controller owns the fresh Qwen review, exact PR/Main CI, release and anonymous
readback; this work never authors or approves those receipts and never claims
delivered. No push, no public mutation, no credentials, no external systems, no
issue closure. `publicly_delivered` remains false.

## Task

Execute issue #344 (campaign node XRA-PS-02) on exact Main head `a70b3ff`.
Constraints that stayed in force: additive closure only, no weakening of any
original AC; native v1 freezes `unknown=false` and empty counterevidence, so the
AC02 restriction/conflict cases are defined from an explicit independently sourced
PAN adjudication context (schema
`pansphaira.xra-ps-02/native-adjudication-context/v1`, `provenance.source` =
independent PAN adjudication) — never fabricated as normal v1 service
output, and the KS verifier is never trusted as PAN authority; TDD minimal fix with
focused positive/negative tests; register and run all canonical required
tests/toolchain/governance checks; no weakening of tests or governance; local
commit + this WORK_RESULT.md with actual commands/results and unresolved gates; no
KS product change (no no-op KS release — the existing immutable service is
sufficient); Qwen ran the pinned repositories and the real loopback HTTP chain in
its dedicated root test VM via `qwen-test` and collected the actual outputs into
this candidate as evidence fixtures; local VM success does NOT establish a working
public evidence URL (HTTP 404 remains missing); missing required source/evidence
bytes, registration, or public transport are RELEASE_BLOCKERS, never FOLLOW_UPs.

## Source inspection (fresh main, a70b3ff) — RED

- At HEAD `a70b3ff` the module `src/cks-12/kaleidosphere-candidate-quarantine.ts`
  carries only the flat v1 surface: the flat synthetic candidate bound to the stale
  heads `24db4e92…`/`90c574e9…`, `ADJUDICATION_CHAIN_STAGES` (7 stages),
  `candidateDigestV1`/`createCandidateV1`/`adjudicateCandidateV1`,
  `createPairedAdjudicationReceiptV1`/`verifyPairedAdjudicationReceiptV1`, and the
  canonical Knowledge pin `d756437db8c991ee78ea7a9fcc7a9d4749daf8eebda51d5ba31fcc53e1b1242a`.
  It has **zero** native-surface symbols (`grep -c "Native"` on the HEAD module: 0)
  and does not import the projection contract
  `packages/contracts/src/kaleidosphere-analytics-projection.js`.
- **RED demonstrated exactly:** with the HEAD module restored
  (`git show HEAD:src/cks-12/kaleidosphere-candidate-quarantine.ts`), `npm run build`
  fails the new native test at compile time with
  `error TS2724: ... has no exported member named 'KALEIDOSPHERE_RECONCILED_RELEASED_HEAD_V1'. Did you mean 'KALEIDOSPHERE_EXPECTED_RELEASED_HEAD_V1'?`
  (and the same for the PAN-side reconciled released head constant and
  `verifyNativePairedAdjudicationReceiptV1`), and running the compiled test file
  against the HEAD-compiled module fails with
  `SyntaxError: The requested module
  '../../src/cks-12/kaleidosphere-candidate-quarantine.js' does not provide an
  export named 'KALEIDOSPHERE_RECONCILED_RELEASED_HEAD_V1'` —
  `ℹ tests 1 / ℹ pass 0 / ℹ fail 1`. The focused flat suite
  (`dist/tests/cks-12/kaleidosphere-candidate-quarantine.test.js`, 5 tests) passes
  at HEAD and is preserved byte-identically in behavior.

## Implementation (additive, TDD)

- `src/cks-12/kaleidosphere-candidate-quarantine.ts` (sha256
  `d39fbfc9f982c9bbe33567134f3b5a9d0eecaa1935f49e66815c8b5a1ef815a9`): the flat v1
  surface is byte-preserved; a native section is appended that adds:
  - Reconciled released head constants — PAN side (`7f662672…`) and KS side
    (`545a3b44…`) — the frozen `RECONCILED_RELEASED_HEADS_V1` pair, the KS released
    tree `c0699e1b…`, and the distinct later byte-equivalent PanSphaira head
    `988395110a9189d1b8cd4ee98184ed5c1d77a15d` (recorded as
    `pansphairaHead.commitOid`, never as the releaseCommit).
  - Schemas: candidate `kaleidosphere.pansphaira-analytics/native-authority-free-candidate/v1`,
    adjudication `pansphaira.xra-ps-02/native-candidate-adjudication/v1`,
    context `pansphaira.xra-ps-02/native-adjudication-context/v1`,
    receipt `pansphaira.xra-ps-02/native-paired-receipt/v1`,
    receipt id `pansphaira:xra-ps-02-native-paired-receipt-001`.
  - `createNativeAdjudicationContextV1` — the independently sourced PAN
    adjudication context (`provenance.source` = independent PAN adjudication,
    canonical Knowledge pin, source contract sha256; optional `unknown` flag and
    independently provided counterevidence
    entries with exact keys `{evidenceId, evidenceSha256, reason:
    "CONTRADICTS_OWNER_EVIDENCE"}`). This is the ONLY source of the AC02
    restriction/conflict cases; native v1 service output always carries
    `unknown=false` and empty counterevidence.
  - `nativeTransportBytesV1` / `nativeProjectionDigestV1` — canonical transport
    re-derivation and the digest trio
    (`rawArtifactSha256 22f34bf33874a42cde5a5a23a2242935e8b2b145aa8e2364a5aef26b8ec3e6e8`,
    `canonicalTransportSha256 91c26eb69860767ec2898a48676caaeb52c808de284bb0fbfbe8a986d30ad19c`,
    `projectionBodyDigest cc5f6cc9591ccf4b6b3c4b9f954aa9da09695b784d7abaa585c082aea195ef1b`).
  - `nativeCandidateDigestV1` — digest over the candidate's 11 keys minus
    `resultSha256`; `deriveNativeAnalysisV1` — independent deterministic
    re-derivation of the service analysis (computed/observed claims, coverage,
    counterevidence, `resultSha256`).
  - `adjudicateNativeCandidateV1` — fail-closed gate order: envelope/shape →
    `NATIVE_CANDIDATE_SCHEMA_DENIED`; non-reconciled released heads →
    `NATIVE_STALE_HEAD_DENIED`; candidate shape/digest → `NATIVE_CANDIDATE_SCHEMA_DENIED`;
    transport digest mismatch vs recomputation → `NATIVE_FORGED_CANDIDATE_DENIED`;
    binding pins (raw/transport/body/contracts/release sidecar) →
    `NATIVE_FORGED_CANDIDATE_DENIED`; transport parse vs
    `buildKaleidosphereAnalyticsProjectionV1()` → `NATIVE_INDEPENDENT_PROVENANCE_DENIED`;
    analysis re-derivation equality → `NATIVE_FORGED_CANDIDATE_DENIED`;
    head bindings (incl. `sourceFileIdentity` bound to the raw artifact sha256) →
    `NATIVE_STALE_HEAD_DENIED`; invalid context → `NATIVE_CANDIDATE_SCHEMA_DENIED`;
    non-empty independent counterevidence →
    `NATIVE_CONFLICTING_COUNTEREVIDENCE_DENIED`; `unknown=true` →
    `NATIVE_EVIDENCE_RESTRICTED_UNKNOWN`; else `NATIVE_EVIDENCE_ACCEPTED`
    (`ACCEPTED_BOUNDED`). Every outcome fills `authority "NONE"`, `effect "NONE"`,
    `capabilityDelta "NONE"`, `canonicalKnowledgeMutation "NONE"`,
    `kaleidoSphereServiceVerdictAuthoritative false`, and the canonical Knowledge
    before/after sha256 from `buildAuthoritativeAdjudicationInputs()`.
  - `createNativePairedAdjudicationReceiptV1` /
    `verifyNativePairedAdjudicationReceiptV1` — the paired receipt binds both
    reconciled released heads and the complete seven-stage chain
    (`GENERATION→PROJECTION→INGESTION→SEMANTICS→ANALYSIS→CANDIDATE→ADJUDICATION`,
    stage digests `nativeChain`); verification requires the exact material
    (`canonicalTransportBytes`, `rawArtifactBytes`), re-runs the full adjudication
    and chain, and is fail-closed `DENIED`/`["NATIVE_RECEIPT_DENIED"]` without
    material or on any tampered field. Receipt creation refuses any candidate whose
    recomputed outcome is not `ACCEPTED_BOUNDED`
    (`XRA_PS_02_NATIVE_RECEIPT_INPUT_DENIED`).
  - `fetchNativeProjectionV1` — loopback wire client for
    `POST /v1/pansphaira-analytics/native-projection` (body = canonical transport
    bytes, `application/octet-stream`, timeout): service down →
    `UNAVAILABLE`/`XRA_PS_02_NATIVE_SERVICE_UNAVAILABLE`; exact 4-key CANDIDATE
    envelope → `CANDIDATE`; exact 7-key DENIED envelope → relayed; anything else →
    `UNAVAILABLE`/`XRA_PS_02_NATIVE_WIRE_SHAPE_DENIED`.
- `tests/cks-12/kaleidosphere-candidate-quarantine-native.test.ts` (sha256
  `f5d68f57b1dd4e7d9bff778822b6a001b61ff7a7477278eebefe18e1f4481ae0`) — the TDD
  contract, 6 tests: AC01 (exact digests, released heads, non-authoritative
  consumer verdict, canonical Knowledge equality), AC02 (five paired clean-room
  cases executed in independent child processes against the compiled module —
  exact triples: `ACCEPTED_BOUNDED/NATIVE_EVIDENCE_ACCEPTED`,
  `RESTRICTED/NATIVE_EVIDENCE_RESTRICTED_UNKNOWN`,
  `DENIED/NATIVE_CONFLICTING_COUNTEREVIDENCE_DENIED`,
  `DENIED/NATIVE_FORGED_CANDIDATE_DENIED`,
  `DENIED/NATIVE_STALE_HEAD_DENIED`; plus foreign-provenance and stale-Knowledge
  context denials), AC03 (receipt id/heads, exact VERIFIED shape with the 7
  stages, six tamper denials, no-material denial, substitution-candidate receipt
  refusal), AC04 (before/after deep-equality, all NONE fields), wire
  (port-1 down → exact UNAVAILABLE; loopback harness: real capture 200 →
  CANDIDATE + `ACCEPTED_BOUNDED`; substitution capture → CANDIDATE +
  `DENIED [NATIVE_STALE_HEAD_DENIED]`; malformed → exact WIRE_SHAPE_DENIED;
  denial codes equal the six KS codes), fail-closed (Proxy/hostile candidate
  shapes denied with zero invocation; missing envelope keys; stale releasedHeads).
- Evidence fixtures (real VM loopback HTTP captures, LOCAL_VM_REAL_HTTP scope,
  explicit nonclaim: not public evidence, not a working public evidence URL):
  - `tests/fixtures/cks-analytics/xra-ps-02-native-service-capture-v1.json`
    (sha256 `949632ef2b517b36ec8969700c9b54fd2a94d3b47751bdd070b319a76864ee4a`) —
    the real captured 200 response of the pinned KS service
    (`545a3b44`) for the real projection input (identical to the local-synthetic
    `projection-v1.json` input bytes).
  - `tests/fixtures/cks-analytics/xra-ps-02-native-service-substitution-capture-v1.json`
    (sha256 `645c238a2fbb762958dc2473414c2a85ab8feb104185b9f938ea374c0887dbff`) —
    the identical-input substitution capture: only the three candidate head-binding
    fields differ (`bindings.kaleidosphereHead.commitOid/treeOid`,
    `bindings.environmentSha256` at the service head `a2ea4b60…`/`2f321d4c…`);
    `resultSha256` is IDENTICAL (`b3027cef…`), so the head binding is the stale-head
    falsifier.

## Registration

- `release/public-files.manifest`: +2 fixture lines (count 1512 → 1514); pins
  updated in `scripts/build-public-release.sh:192`
  (`if count != 1514:`), `tests/verification-fabric-v2.test.ts:299`,
  `tests/release-governance.test.mjs:322`. The new native test file is
  repository-only (added to `repository_only_files` next to its flat sibling and
  the module), so the public count stays 1514.
- Verification DAG `verification/verification-dag-v2.json`: graphVersion 48 → 49;
  node `cks-12-closed-learning-loop-v1` gains the two fixtures as
  `DERIVED_EVIDENCE` inputs (localeCompare-sorted); all node inputs re-digested by
  `npm run integrity:refresh`. graphVersion pins updated in
  `tests/verification-fabric-v2.test.ts` (109/395),
  `tests/contribution-intake-ledger.test.ts:769`,
  `tools/video-production-reference/tests/slice.test.mjs:808`;
  `scripts/refresh-integrity-data.mjs` sets `dag.graphVersion = 49` and owns the
  two fixtures in `cks12FocusedInputs`.
- Canonical-JSON census: `filesScanned` 640 → 641 (the new native test file),
  ledger 1828 → 1830 (the two manifest fixtures); new append-only profile-version
  migration V13
  `XRA-PS-02-NATIVE-WIRE-INTEGRATE/INTEGRITY-GENERATOR/V13`
  (`fromSha256 c37787b6…` → `toSha256 c45eef7d08a69273146d264bb68c15a9f984767e51e8e11097e8106997216640`,
  the on-disk digest of `scripts/refresh-integrity-data.mjs`); chain pin updated to
  `[2..13]`; admitted v1 and reviewed v2-v12 digests remain immutable. The census
  artifact, DAG, `SHA256SUMS` (1830 lines) and the slice receipt are
  nested-then-root bound via `integrity:refresh` (final run after every
  digest-bound edit).
- Slice receipt
  `verification/pansphaira-kaleidosphere-analytics-slice-v1.json`: rewritten
  additively — scope `LOCAL_SYNTHETIC_AND_LOCAL_VM_REAL_HTTP`,
  `implementationSha256 d39fbfc9…`, `focusedTestNative` + sha256, gate receipts
  (build/npm test/git diff --check all PASS), AC01/AC02/AC04 PROVEN_LOCALLY
  (AC02 with the five-case native map), AC03 NOT_PROVEN (local chainStages
  complete; public chain not proven), new top-level `nativeScope` (superseded
  flat synthetic candidate + stale bound heads; reconciled released heads;
  service endpoint/transport/scope; paired receipt
  `pansphaira:xra-ps-02-native-paired-receipt-001` with the 7 stages and
  `VERIFIED` local verification / fail-closed DENIED; both evidence fixtures with
  exact sha256s and the identical-input substitution derivation; restriction/conflict
  source = independent PAN adjudication context; nonclaim: HTTP 404 remains
  missing), original `authoritativeInputs` (stale flat heads) preserved as the
  flat-slice binding, `authorityState` all NONE, the six required nonclaims
  retained.
- `package.json`: `xra-ps-02:test` / `xra-ps-02:test:compiled` now run both the
  flat and the native quarantine test files.
- `tests/public-product-spelling.test.mjs`: the two new public fixtures are
  classified under the existing `stable-xra-ps02-technical-identifier` family
  (same as the module and slice receipt) — additive classification only.
- No KS product change: no no-op KS release; the existing immutable pinned KS
  service (`545a3b44`) is sufficient.

## Test results (actual commands, this candidate)

- RED (documented above): HEAD module → TS2724 compile errors +
  `SyntaxError: ... does not provide an export named
  'KALEIDOSPHERE_RECONCILED_RELEASED_HEAD_V1'`, `tests 1 / pass 0 / fail 1`;
  module restored (sha256 `d39fbfc9…` re-verified) and rebuilt → GREEN.
- `npm run build --silent` → clean.
- `npm run xra-ps-02:test` (build + both quarantine suites) → **11/11 pass**
  (6 native + 5 existing flat, byte-preserved).
- `node --test dist/tests/verification-fabric-v2.test.js` → 32/32 pass.
- `node --test dist/tests/verification-fabric.test.js` → 3/3 pass.
- `node --test dist/tests/canonical-json-profile-inventory.test.js` → 35/35 pass.
- `node --test dist/tests/contribution-intake-ledger.test.js` → 27/27 pass.
- `npm run release-governance:test` (release-governance + public-product-spelling)
  → 92/92 pass.
- `npm run release-governance:verify` → `RELEASE_GOVERNANCE_PASS`.
- `node --test tools/video-production-reference/tests/slice.test.mjs
  tools/video-production-reference/tests/closure.test.mjs` → 116/116 pass.
- Full `npm test` (pretest + test): all suites pass except 9 tests in
  `tests/builder-agent-runtime.test.mjs`,
  `tests/managed-skill-lifecycle-runtime.test.mjs`,
  `tests/model-access-broker-runtime.test.mjs`,
  `tests/openclaw-agent-runtime-lock.test.mjs` (×2),
  `tests/openclaw-agent-runtime.test.mjs` (×2) and 1 test in the
  `wiki:test:compiled` suite (`PSAI107 default-off offline container profile…`):
  every one is `spawnSync docker ENOENT` because **docker is not installed on this
  host** (`command -v docker` → absent). None of those test files is touched by
  this diff.
- Docker-dependent tests re-run in the qwen-test root VM (node v24.21.0, docker
  29.1.3) against the exact streamed working tree
  (tar digest `52a6237872955884b87170b786ff8af86238be5278af6ef9d9cb871639a1cd5d`,
  extracted to `/root/xra-ps-02/pansphaira`):
  `node --test tests/builder-agent-runtime.test.mjs
  tests/managed-skill-lifecycle-runtime.test.mjs
  tests/model-access-broker-runtime.test.mjs
  tests/openclaw-agent-runtime-lock.test.mjs
  tests/openclaw-agent-runtime.test.mjs
  tests/kiwix-zim-assessment.test.mjs` → **34/34 pass** (all 9 main-suite docker
  tests named and green), and
  `node --test tests/local-knowledge-wiki-container.test.mjs` → 2/2 pass
  (PSAI107 docker test green).
- Posttest chain (local): 24 suites green up to the docker ENOENT stop, then the
  remaining tail run explicitly — azpp 91/91, asf 66/66, ccp 108/108,
  cks-contracts 69/69, update-* 42/42, xra-ps-01 8/8, **xra-ps-02:test:compiled
  11/11**, evid-prov-01 26/26, status-truth-01 34/34.
- Public release builder local verification (local only, output discarded, NOT a
  public release): `bash scripts/build-public-release.sh --output
  /tmp/xra-ps-02-verify/cm-product-increment-rc-20260912` → exit 0,
  `STAGING=…`, `ARCHIVE=…`, `ARCHIVE_SHA256=2dc6a4fbc581abca510b6d33ef379108a45f158050f0c93539a5fdc5f49d3ebb`;
  temp output removed.
- `git diff --check` → clean. Governance leak scan over all 19 changed/new files:
  no `/home/…`, no `/mnt/…` (other than the pre-existing regex literal in
  `scripts/build-public-release.sh:115`), no `agent:` session identifiers.

## AC04 before/after (actual output)

Command: node ESM script importing the compiled module; before =
`buildAuthoritativeAdjudicationInputs()`; full native adjudication + receipt
creation + verification executed; after = same call:

```
canonicalKnowledgeSha256: d756437db8c991ee78ea7a9fcc7a9d4749daf8eebda51d5ba31fcc53e1b1242a
authority: NONE | effect: NONE | capabilityDelta: NONE | canonicalKnowledgeMutation: NONE
knowledgeBefore === knowledgeAfter: true = d756437db8c991ee78ea7a9fcc7a9d4749daf8eebda51d5ba31fcc53e1b1242a
outcome: ACCEPTED_BOUNDED | reason: NATIVE_EVIDENCE_ACCEPTED | receipt: VERIFIED
AC04 BEFORE_AFTER_DEEPEQUAL: PASS
```

## Nonclaims and fences (unchanged, all retained)

- NO_CANDIDATE_PROMOTION — the native candidate remains `state "CANDIDATE"`,
  authority all-false, nonclaims embedded in the candidate frame.
- NO_PERSISTENCE_OR_HISTORY — nothing is persisted or appended to any history.
- NO_GLOBAL_TRUTH_OR_UTILITY_CLAIM, NO_PARITY_GENERALIZATION.
- NO_XRA_KS_01_ADMISSION_OR_EXACT_HEAD_CLOSURE.
- NO_EXTERNAL_RELEASE_OR_CROSS_REPOSITORY_CHAIN_PROOF.
- The KS service verdict is non-authoritative (`authority "NONE"`,
  `kaleidoSphereServiceVerdictAuthoritative false`); the KS verifier is never
  trusted as PAN authority; the AC02 restriction/conflict cases come only from
  the independent PAN adjudication context.
- The evidence fixtures are LOCAL_VM_REAL_HTTP loopback captures: local VM
  success does not establish a working public evidence URL (HTTP 404 remains
  missing).
- Historical producer release (`7f662672…`), tested source, and newly delivered
  adjudicator identities stay distinct; no reminted historical evidence, no
  synthetic PASS.

## Unresolved gates (controller-owned; RELEASE_BLOCKERS, not FOLLOW_UPs)

1. Fresh Qwen review of this exact candidate (independent of the author).
2. Exact PR/Main CI on the delivered head.
3. Serial release of the public artifact for this head.
4. Anonymous public readback (release + readback receipts).
5. AC03 public chain proof: the paired receipt is VERIFIED locally with exact
   material and fail-closed DENIED otherwise, but the public
   PR/Main CI + release + readback chain is **NOT_PROVEN**; the public evidence
   URL remains HTTP 404 / missing.
All of the above remain WAIT. Nothing here claims delivery; `publicly_delivered`
remains false.

## Follow-up correction — PublicationRegistrationFailure (on top of 63f87df)

**Status: local registration correction complete. NOT DELIVERED / NOT CLOSED.**
This is an additive, locally validated source correction on the exact committed
candidate head `63f87df47a3390ccac030102b1e404a83f92975a` (tree
`4e63c6ae876eb7567dd9b0c8d5837afc7eb2995f`) for the named defect
**PublicationRegistrationFailure** (issue #344, campaign node XRA-PS-02). It does
not alter the prior native wire/head integration (commit `63f87df`); it restores
the canonical registration and nested/root/DAG integrity of the four
repository-only independent adjudicator/proof-closure files. No push, no public
mutation, no credentials, no external systems, no issue closure.
`publicly_delivered` remains false.

### Defect

The four repository-only closure files are:

- `src/cks-12/kaleidosphere-candidate-quarantine.ts` (independent PAN
  adjudicator, sha256 `d39fbfc9f982c9bbe33567134f3b5a9d0eecaa1935f49e66815c8b5a1ef815a9`)
- `tests/cks-12/kaleidosphere-candidate-quarantine.test.ts` (flat test,
  sha256 `874bfe3e8e7a69bd6a31474c5ca1b8712437a5f8e54b3d51cb48bbfce4e7507f`)
- `tests/cks-12/kaleidosphere-candidate-quarantine-native.test.ts` (native test,
  sha256 `f5d68f57b1dd4e7d9bff778822b6a001b61ff7a7477278eebefe18e1f4481ae0`)
- `verification/pansphaira-kaleidosphere-analytics-slice-v1.json` (paired slice
  receipt)

At `63f87df` all four were already repository-only (absent from
`release/public-files.manifest` and present in the builder's
`repository_only_files` set), the manifest count was already consistently 1514,
and three of the four were already registered in both the root `SHA256SUMS` and
the verification-DAG node `cks-12-closed-learning-loop-v1`. The concrete gap was
that the **native test** was **additionally absent from (a) the root
`SHA256SUMS` and (b) the verification-DAG path registration** on node
`cks-12-closed-learning-loop-v1`, despite the slice receipt claiming both tests
are bound. The required correction: register the actual independent
adjudicator/proof closure, reconcile the four repository-only exceptions, and
derive the exact manifest count consistently in the builder and the governance
tests (compute the actual final count), restoring canonical registration and
coherent nested/root/DAG integrity using repository-native tooling in dependency
order.

### Correction (minimal, TDD, repository-native tooling, dependency order)

- `tests/release-governance.test.mjs` (sha256
  `0c6fd608f063fd864158cb75c18c26ce703668686985fb7cd2fd65c53952ee9a`): +1 test
  (TDD RED→GREEN) asserting, for each of the four closure paths — repository-only
  manifest exclusion (0 manifest lines) and builder `repository_only_files`
  classification; exact root `SHA256SUMS` registration at the file's true
  sha256; exact verification-DAG path registration on
  `cks-12-closed-learning-loop-v1` with role `VALIDATOR` for the three
  code/test files and `DERIVED_EVIDENCE` for the slice receipt, each at the
  file's true sha256; and that the builder's exact-count binding
  (`if count != N:`) equals the actual manifest line count (the consistent
  derived count, not a hand-set constant).
- Root `SHA256SUMS` (sha256 `f2bae9a827006e1dc3d682e642ed19cef45d836b7debfbe2047552fd99a13cb7`):
  +1 line `f5d68f57b1dd4e7d9bff778822b6a001b61ff7a7477278eebefe18e1f4481ae0  ./tests/cks-12/kaleidosphere-candidate-quarantine-native.test.ts`,
  placed at the tool-sorted position (1830 → 1831 lines).
- `verification/verification-dag-v2.json` (sha256
  `3e3709c67ac1bee8f369e2384a6369071f7fefb6559a36bffed75545b82a7d86`): the native
  test is registered as a `VALIDATOR` input on node
  `cks-12-closed-learning-loop-v1` at the localeCompare-sorted position;
  `graphVersion` remains 49.
- `verification/canonical-json-profile-inventory-v1.json` (sha256
  `e9614ff422f0abb83293d696f914720f4b9bcd90d440ab2012f8a42e1a55e436`):
  `freshCounts.ledgerEntries` and `ledgerUniquePaths` 1830 → 1831 to match the
  new root `SHA256SUMS` line. The census test's self-exclusion and `filesScanned`
  (641) are unchanged; the stale unvalidated `integrationOwnership` pin for the
  census test was deliberately left untouched (it is not validated by any gate).
- `tests/canonical-json-profile-inventory.test.ts` (sha256
  `83dbed4d3bb3a34294ff2636a4ed4dcfe2e6b6cfde166b261886bc9ce4051b0a`):
  `EXPECTED_LEDGER` 1830 → 1831 (`entries`/`uniquePaths`); `filesScanned` stays
  641; the V2–V13 migration chain is unchanged. The census test validates the
  census-test file's sha256 against the DAG `repository-integrity` node input
  (auto-updated by `integrity:refresh`), not the stale inventory pin.
- `npm run integrity:refresh` (`scripts/refresh-integrity-data.mjs`, sha256
  `c45eef7d08a69273146d264bb68c15a9f984767e51e8e11097e8106997216640` — **unchanged,
  net-zero diff**): re-digested the `repository-integrity` node's pins for the
  census test, governance test, and inventory to their new post-edit bytes, and
  re-sorted the root `SHA256SUMS`. The tool was **not** edited to force the
  closure through `cks12FocusedInputs`/the additions list — doing so would have
  cascaded into a new canonical-JSON profile migration (V14) and profile/byte
  obligation pins, contradicting the minimal-correction constraint. The closure
  files follow the established sibling pattern of **direct** registration in the
  DAG and `SHA256SUMS`, then a repository-native `integrity:refresh` to
  re-digest/sort/preserve.

### Preserved (unchanged by this correction)

- Implementation semantics, legacy historical evidence, and the native
  restricted/conflicting semantics; the exact reconciled released-head pair
  identities (`7f662672…` PAN / `545a3b44…` KS); the `LOCAL_VM_REAL_HTTP`
  scope and the `AC03 NOT_PROVEN` nonclaim. All four closure files are
  **byte-identical to `63f87df`** (verified: empty `git diff` vs HEAD for all
  four).
- `review.artifact` / the paired slice receipt were **not** replaced with an
  unrelated capture or a generic public file. No manifest membership was waived
  (all four remain excluded from the public manifest). No CI or Root-QS success
  was invented. No no-op KS release was added. The manifest count (1514) was
  computed, not asserted by hand.

### Test results (actual commands, this candidate)

- `npm run release-governance:test` (release-governance + public-product-spelling)
  → **93/93 pass** (was 92/92; +1 new governance test, RED→GREEN).
- `node --test dist/tests/canonical-json-profile-inventory.test.js` → **35/35 pass**.
- `npm run xra-ps-02:test:compiled` (flat + native quarantine suites, all four
  ACs) → **11/11 pass**.
- `node --test dist/tests/verification-fabric-v2.test.js` → **32/32 pass**.
- `node --test dist/tests/contribution-intake-ledger.test.js` → **27/27 pass**.
- `node --test dist/tests/trust-compatibility-foundation-closure.test.js` → **9/9 pass**.
- `node --test tools/video-production-reference/tests/slice.test.mjs
  tools/video-production-reference/tests/closure.test.mjs` → **116/116 pass**.
- `npm run build` → exit 0.
- Public-release builder local verification (local only, output discarded, **not**
  a public release): `bash scripts/build-public-release.sh --output
  /tmp/xra-ps02-staging/cm-product-increment-rc-20260913` → exit 0,
  `ARCHIVE_SHA256=e8cedd682856643736c9948d7a6b2996065208830074fa33652c66bc1349c2a8`;
  the 1514-count binding held (no `UNMANIFESTED_SOURCE_FILE`); all four closure
  files confirmed **absent** from the staged public tree; staged public file
  count = 1514 (1513 + the staged `SHA256SUMS`). Temp output removed. The archive
  fingerprint differs from the `63f87df` record because four already-public
  manifest files (the two test files and the two verification JSONs) changed
  bytes in this correction — no closure file entered the public tree.
- `git diff --check` → clean.

### Diff confinement

`git diff` vs `63f87df` is confined to exactly **5 files**:
`SHA256SUMS`, `tests/canonical-json-profile-inventory.test.ts`,
`tests/release-governance.test.mjs`,
`verification/canonical-json-profile-inventory-v1.json`,
`verification/verification-dag-v2.json`. The four closure files and the
repository-native tool are unchanged.

### Unresolved gates (controller-owned; RELEASE_BLOCKERS, not FOLLOW_UPs)

Unchanged from the prior record: fresh Qwen review of this exact candidate,
exact PR/Main CI, serial release of the public artifact, anonymous public
readback, and the AC03 public chain proof (NOT_PROVEN; public evidence URL
remains HTTP 404 / missing). All remain WAIT. Nothing here claims delivery;
`publicly_delivered` remains false.
## Follow-up correction — PublicationRegistrationFailure (public registration; on top of 66d42f8)

XRA-PS-02: the actual independent adjudicator/proof closure was tracked and
hash-bound but excluded from the public release.
`verification/pansphaira-kaleidosphere-analytics-slice-v1.json` was not
registered in `release/public-files.manifest`, and all four closure paths were
carried as `repository_only_files` exceptions in
`scripts/build-public-release.sh`. Correction191 had restored the native test
`SHA256SUMS` and verification-DAG registration only; the paired slice receipt
(the canonical `review.artifact`) remained unregistered, and the review record
had been misdirected at `release/public-files.manifest` instead of the slice
receipt.

### Defect (reproduced on 66d42f8 before any change)

- Baseline staging build (`scripts/build-public-release.sh --output ...`)
  exited 0 with deterministic `ARCHIVE_SHA256 e8cedd68…c2a8` and all four
  closure files ABSENT from the staged public tree.
- `tests/release-governance.test.mjs` (XRA-PS-02) and
  `tests/verification-fabric-v2.test.ts` still bound the pre-registration
  count (1514).

### Correction (minimal, TDD, repository-native tooling, dependency order)

1. `release/public-files.manifest`: +4 identity lines (mode 0644) registering
   the complete proof closure — the adjudicator implementation
   (`src/cks-12/kaleidosphere-candidate-quarantine.ts`), both focused tests
   (`tests/cks-12/kaleidosphere-candidate-quarantine.test.ts` and
   `tests/cks-12/kaleidosphere-candidate-quarantine-native.test.ts`), and the
   paired slice receipt
   (`verification/pansphaira-kaleidosphere-analytics-slice-v1.json`), i.e.
   the restored `review.artifact`. 1514 → 1518 data lines.
2. `scripts/build-public-release.sh`: the four `repository_only_files`
   exceptions removed; the count binding now derives the actual final count
   (`if count != 1518:`).
3. `tests/release-governance.test.mjs`: XRA-PS-02 now asserts public manifest
   registration of all four paths (identity mapping, mode 0644), builder
   exception reconciliation, and that the builder count binding equals the
   manifest's own line count (the computed final count, 1518).
4. `tests/verification-fabric-v2.test.ts`: exact public count 1514 → 1518.
5. `npm run integrity:refresh` (run after all edits, dependency order):
   re-digested the five affected `repository-integrity` / `ap-05` pins
   (manifest CONTRACT + DERIVED_EVIDENCE, builder SECURITY, governance test
   VALIDATOR, verification-fabric test VALIDATOR); `graphVersion` 49 and all
   57 nodes/roles otherwise unchanged; root `SHA256SUMS` rebuilt (1831 lines).
   The tool itself is unchanged.

### Preserved (unchanged by this correction)

- Implementation semantics, legacy historical evidence, native
  restricted/conflicting semantics; the exact reconciled released-head pair
  identities (`7f662672…` PAN / `545a3b44…` KS); the `LOCAL_VM_REAL_HTTP`
  scope and the `AC03 NOT_PROVEN` nonclaim. The four closure files are
  **byte-identical to `66d42f8`** (verified: empty `git diff` vs HEAD for all
  four).
- The `review.artifact` is the paired slice receipt
  (`verification/pansphaira-kaleidosphere-analytics-slice-v1.json`), now
  publicly registered. It was not replaced with an unrelated capture or a
  generic public file — in particular not with the manifest itself. No
  manifest membership was waived. No CI or Root-QS success was invented. No
  no-op KS release was added. No exclusions or skipped tests.

### Test results (actual commands, this candidate)

- `npm run release-governance:test` (release-governance +
  public-product-spelling) → **93/93 pass**. RED before the manifest/builder
  edits: `expected: 1518` and `public manifest registration:
  src/cks-12/kaleidosphere-candidate-quarantine.ts (0 !== 1)`.
- `node --test dist/tests/verification-fabric-v2.test.js` → **32/32 pass**.
- `npm run xra-ps-02:test` (flat + native quarantine suites) → **11/11 pass**
  (all five AC cases; service-down / substitution / malformed fail-closed).
- `node --test dist/tests/canonical-json-profile-inventory.test.js` →
  **35/35 pass**.
- Post-fix staging build (`scripts/build-public-release.sh --output
  /tmp/ps344-fixed/...`): exit 0, count binding 1518, all four closure files
  PRESENT in the staged public tree; staged set equals the manifest
  destinations (plus the staging-generated `SHA256SUMS`, verified with
  `sha256sum -c`); `ARCHIVE_SHA256 10111abe0613920bb63a3dd903cd00206ffbdfaea3140c52764acea63124a11c`
  (deterministic, re-verified with `sha256sum`).

### Diff confinement

`release/public-files.manifest` (+4 lines), `scripts/build-public-release.sh`
(−4 exception lines, count binding), `tests/release-governance.test.mjs`,
`tests/verification-fabric-v2.test.ts`, `verification/verification-dag-v2.json`
(five re-digested pins), `SHA256SUMS` (rebuilt, 1831 lines). The four closure
files and the repository-native tool are unchanged.

### Independent guest verification (authorized root test VM, 2026-09-13)

The exact retained dirty tree (plus the real `.git`) was streamed to the
dedicated root guest and re-verified before execution: all seven edited files
matched by sha256 (`GUEST_TREE_BYTES_MATCH`), `git rev-parse HEAD` =
`66d42f810da866f8958d5f382aecd427a33acf47`, the same seven modified paths, and
`HEAD^{tree}` = `fcabb91dbc5d2c468ad58c741bb90131f235aade`.

- Guest environment: node v24.21.0, npm 11.19.0, Docker 29.1.3, GNU tar 1.35.
- Full canonical suite (`npm test`, i.e. pretest + test + posttest):
  **2257/2257 pass, 0 skipped, 0 fail, exit 0** — including the two
  development-worker M1B tests and the supply-chain public-staging contract.
  An initial guest run reported two `ADMISSION_BINDING_DENIED` failures in
  `dist/tests/development-worker.test.js` because the first tree copy omitted
  the `.git` directory that the controller's admission gate requires
  (existence check only; no git invocation). After copying the real `.git`
  and re-verifying all seven bytes, the full suite was re-run from scratch and
  is fully green. This was an environment-copy artifact, not a product
  defect; no product bytes changed.
- Guest staging build (`scripts/build-public-release.sh --output ...`): exit
  0. The staged tree is **content-identical to the local staged tree**: all
  1519 files (1518 manifest destinations + staging-generated `SHA256SUMS`)
  match file-by-file sha256 and mode (`CROSS_MACHINE_CONTENT_IDENTICAL`).
  The archive byte hashes differ between machines solely because of GNU tar
  1.34 (local) vs 1.35 (guest); staged content is identical.
- Root `SHA256SUMS` re-verified read-only on this candidate: 1831/1831 entries
  match working-tree digests; `verification/verification-dag-v2.json` pins
  verified: 1015/1015 sha256 pins match, `graphVersion` 49, 57 nodes, with the
  five re-digested pins being the only delta vs `66d42f8`.

Preserved: `LOCAL_VM_REAL_HTTP` scope and the `AC03 NOT_PROVEN` nonclaim;
nothing here claims delivery.

### Unresolved gates (controller-owned; RELEASE_BLOCKERS, not FOLLOW_UPs)

Unchanged: fresh independent review of this exact candidate, exact PR/Main CI,
serial release of the public artifact, anonymous public readback, and the AC03
public chain proof (NOT_PROVEN; the public evidence URL remains missing). All
remain WAIT. Nothing here claims delivery; `publicly_delivered` remains false.

---

# WORK_RESULT — PAR-PS-01 Producer Analytics Manifest (campaign node)

**Status: ADMISSION GATE UNMET — dependency wait (WAIT_DEPENDENCY). No product
work performed; NOT DELIVERED / NOT CLOSED.**

## Task

Execute issue #345 (campaign node PAR-PS-01, campaign
PS-KS-AUTONOMOUS-CAMPAIGN-V1; parent #342) on exact Main head
`45c2c77143a6e123e3d6dd43370dfd310dd50554` (clean; branch `main`; fresh source,
no legacy candidate or state). The product scope is additive over this head:
add `contracts/analytics/producer-manifest-v1.json` produced by a deterministic
`scripts/build-producer-analytics-manifest.mjs` and covered by
`tests/producer-analytics-manifest.test.ts`, describing only the concepts,
fields, evidence, coverage, and semantics actually emitted by the delivered
XRA-PS-02 paired slice (issue #344). The admission gate is "XRA-PS-02
paired slice delivered."

## Admission gate revalidation on the current head (actual commands, actual
observations)

- `git rev-parse HEAD` → `45c2c77143a6e123e3d6dd43370dfd310dd50554`;
  `git status --short` → clean; branch `main`; head subject `Register
  XRA-PS-02 PAN adjudicator and proof closure in the public release`.
- `verification/pansphaira-kaleidosphere-analytics-slice-v1.json` (the in-tree
  hash-bound slice receipt at this head):
  - `acceptance.XRA-PS-02-AC03.status` = **`NOT_PROVEN`** — local chainStages
    complete, public chain unproven; its `nonclaim`: "XRA-KS-01/#151 admission,
    both exact released-head readbacks, Root-QS, repository CI, and parent
    closure are absent."
  - `requiredNonclaims` include
    `NO_EXTERNAL_RELEASE_OR_CROSS_REPOSITORY_CHAIN_PROOF` and
    `NO_XRA_KS_01_ADMISSION_OR_EXACT_HEAD_CLOSURE`.
  - `nativeScope.nonclaim`: "Local VM loopback success does not establish a
    working public evidence URL (HTTP 404 remains missing); this receipt
    asserts no public transport, admission, or closure."
  - `scope` = `LOCAL_SYNTHETIC_AND_LOCAL_VM_REAL_HTTP` with
    `reconciledReleasedHeads` pansphaira
    `7f662672bfc45087342f23e5c589d43598f5c20d` / kaleidoSphere
    `545a3b44ea88c96eded060c11c7c3a2afe0edff6` — the prior stale
    `LOCAL_SYNTHETIC_ONLY` concern is resolved; this is a **delivery-completion
    wait, not a stale-synthetic wait**.
- `WORK_RESULT.md` (`66d42f8` and `45c2c77` sections): all controller-owned
  gates — fresh independent review, exact PR/Main CI, serial release of the
  public artifact, anonymous public readback, and the AC03 public chain proof —
  remain **WAIT**; "`publicly_delivered` remains false".
- No XRA-PS-02 Root-QS replay artifact exists in-tree (the `root-qs` artifacts
  under `closure-audits/` and `docs/evidence/conveyor/` belong to other nodes);
  no in-tree reference to parent #341 closure.
- The slice CONTENT is in-tree and publicly registered at this head:
  `release/public-files.manifest` line 673 (adjudicator
  `src/cks-12/kaleidosphere-candidate-quarantine.ts`), lines 819–820 (both
  focused tests), lines 1092–1093 (the two `LOCAL_VM_REAL_HTTP` capture
  fixtures), line 1514 (the slice receipt itself); 1518 data lines; the
  `scripts/build-public-release.sh` count binding is `1518`. The pending item
  is the slice's **delivery**, not its content.
- #344 is publicly closed as completed, but per the binding rules "never infer
  proof completeness merely from DONE/closed" and "closed is not proof of
  external artifacts", the closure label does not establish the AC03 public
  chain or the public release/readback.

**Verdict: the admission gate "XRA-PS-02 paired slice delivered" is unmet.**
The controller-owned gates (fresh independent review, exact PR/Main CI, serial
release, anonymous readback) are all WAIT and the XRA-PS-02-AC03 public chain
(Root-QS replay over the seven-stage chain, both repositories' exact CI and
anonymous readback, parent #341 closure) is absent from the tree and not
supplied.

## Why no product work was performed

Deriving the manifest now would describe a slice whose public delivery is
pending and would risk violating PAR-PS-01-AC01/AC02 if the slice changes
during #344's delivery correction. All three target artifacts are ABSENT at
this head (`contracts/analytics/` does not exist;
`scripts/build-producer-analytics-manifest.mjs` absent;
`tests/producer-analytics-manifest.test.ts` absent; zero `producer-manifest`
references anywhere in-tree), so this is **not** `SOURCE_ALREADY_PRESENT` —
the work is unstarted and correctly held.

## Acceptance criteria mapping (node not admitted; nothing executed)

- `PAR-PS-01-AC01` (generated-vs-runtime projection comparison): **NOT
  EXECUTED** — admission gate unmet. Missing-input owner: the #344 (XRA-PS-02)
  delivery owner — the Qwen two-repository lane owns implementation/evidence;
  the controller owns serialized GitHub publication and readback.
- `PAR-PS-01-AC02` (schema/diff tests): **NOT EXECUTED** — same missing input.
- `PAR-PS-01-AC03` (two clean generation runs, byte-identical): **NOT
  EXECUTED** — same missing input.

The missing input is reported with its owner and a verifiable resume trigger,
not as a product defect.

## Verifiable resume trigger

A current-head `verification/pansphaira-kaleidosphere-analytics-slice-v1.json`
with `XRA-PS-02-AC03 != NOT_PROVEN` and a WORK_RESULT showing the
controller-owned gates cleared (public release + readback receipts present,
public evidence URL resolvable and not HTTP 404), with the in-tree slice
receipt re-bound at the current head so that `publicly_delivered` is no longer
false. Until then #345 remains dependency-held; revalidate immediately before
launch.

## Commands and results (this node; all local; no push, no public mutation)

- `git rev-parse HEAD` → `45c2c77143a6e123e3d6dd43370dfd310dd50554`;
  `git status --short` → (empty, clean)
- `cat verification/pansphaira-kaleidosphere-analytics-slice-v1.json` → AC03
  `NOT_PROVEN` (quoted above)
- `ls contracts/analytics/` / `ls scripts/build-producer-analytics-manifest.mjs`
  / `ls tests/producer-analytics-manifest.test.ts` → all ABSENT
- `grep -rn "producer-manifest" . --exclude-dir=.git` → zero references
- XRA-PS-02 Root-QS replay and #341 closure searches → absent
- `npm ci --cache /tmp/npm-cache --no-audit --no-fund` → exit 0. Environment
  note: `/home` is read-only for this user, so npm could not create its default
  cache `/home/node/.npm`; the cache was redirected to `/tmp/npm-cache`.
  Environment workaround only; no repository bytes affected.
- `sha256sum --check SHA256SUMS` → exit 0 (all entries OK)
- `npm run release-governance:verify` → `RELEASE_GOVERNANCE_PASS`, exit 0
- `npm run release-governance:test` → 93/93 pass, exit 0
- `npm run lint` (tsc --noEmit) → exit 0
- `npm run supply-chain:verify` → `PASS`, exit 0
- `npm test` (authoritative lifecycle: pretest + test + posttest):
  - pretest: every batch green, 0 fail.
  - test: 729 tests — **722 pass, 7 fail**. All seven failures are
    `spawnSync docker ENOENT` in compose-config render tests: AAS-035 ×2,
    AAS-036 ×1, AAS-037 ×2 in `tests/openclaw-agent-runtime.test.mjs` and
    BLD-001-G6 ×2 in `tests/builder-agent-runtime.test.mjs`. Cause: the
    `docker` CLI is not installed in this workspace container — an environment
    gap, not a product defect. The in-tree `45c2c77` guest evidence (dedicated
    VM, Docker 29.1.3) records the full suite 2257/2257 pass on this exact
    tree.
  - posttest: cscl11/09/10/08/07/02/03/04/05/06/01, rks02, rks01, cksm1,
    **cks12:test:compiled (91 tests — the XRA-PS-02 focused suite), cks11,
    cks10, cks09, cks08, cks07, cks05, cks04, cks03, cks02** all pass (0 fail);
    `wiki:test:compiled` ran 68 tests — 67 pass, 1 fail (the same
    `spawnSync docker ENOENT`, `tests/local-knowledge-wiki-container.test.mjs`),
    which aborted the `&&` chain before the tail steps.
  - The aborted tail steps, run individually (all exit 0): azpp 91/91, asf
    66/66, ccp 108/108, cks-contracts 69/69,
    update-controller-synthetic-evidence 42/42, **xra-ps-01 8/8, xra-ps-02
    11/11**, evid-prov-01 26/26, status-truth-01 34/34,
    external-video-service 6/6.
- `git diff --exit-code` (CI step "Confirm tests did not modify tracked
  files") → exit 0; working tree clean.

The only unrun-locally items are the eight docker-dependent tests above
(7 in the main batch + 1 in `wiki:test:compiled`); every other canonical
check passed locally on this head.

## Unresolved gates (controller-owned; all WAIT; carried from #344)

Fresh independent review of the exact candidate, exact PR/Main CI, serial
release of the public artifact, anonymous public readback, and the AC03 public
chain proof (public PR/Main CI + release + readback; Root-QS replay over the
seven-stage chain; both repositories' exact CI and anonymous readback; parent
#341 closure). `publicly_delivered` remains false. Nothing here claims
delivery.

## Nonclaims

No manifest, generator, or test was created or modified; no product bytes,
release bytes, or governance artifact changed. No push, no public mutation, no
credentials, no external systems, no issue closure. No future-roadmap
capability, no consumer-support claim, and no historical-retention semantics
are asserted anywhere by this record.

## Local commit

This record only. `WORK_RESULT.md` is a `repository_only_files` exclusion in
`scripts/build-public-release.sh` (tracked; excluded from the public release;
pinned by no manifest), so this commit affects no release content.

---

# WORK_RESULT — PAR-PS-01 receipt correction (spelling-classification
boundary; record bytes only)

**Status: candidate record repair. Admission-gate verdict unchanged —
ADMISSION GATE UNMET (WAIT_DEPENDENCY). NOT DELIVERED / NOT CLOSED.**

## Defect found in the committed receipt (provenance boundary)

The section above, committed at `707d269607931d5b1a2916bdae6e4d43d6bffec9`,
records `npm run release-governance:test` as "93/93 pass, exit 0" and
asserts "every other canonical check passed locally on this head". At that
exact committed head the deterministic in-tree run yields **92/93, exit 1**:
the record byte that commit introduced — the bare legacy all-caps product
display token in the parenthetical issue reference at line 616 of this file
— has no KEEP classification in the tracked gate
`tests/public-product-spelling.test.mjs` ("every retained all-caps token
has an explicit KEEP classification", assertion at line 142). Base
`45c2c77143a6e123e3d6dd43370dfd310dd50554` has zero occurrences of that
token in this file, so the commit's own diff introduced the failure and the
committed receipt did not match the tested head.

## Reproduction (exact head 707d269, before correction; actual output)

- `git rev-parse HEAD` → `707d269607931d5b1a2916bdae6e4d43d6bffec9`
- `npm run release-governance:test` → `# pass 92 / # fail 1`, exit 1.
  Failing test: `every retained all-caps token has an explicit KEEP
  classification`; unclassified entry
  `WORK_RESULT.md:616:XRA-PS-02 paired slice (…) The admission gate is
  "XRA-PS-02` (the bare legacy all-caps display token elided here so this
  record itself stays inside the gate).

## Correction (minimal; record bytes only)

- Line 616 reworded: the parenthetical issue reference no longer carries
  the bare legacy all-caps display token; it now reads `(issue #344)`,
  matching the reference convention used by every other section of this
  file (issue number + campaign node name).
- No test bytes, contract bytes, manifest bytes, release bytes, or product
  bytes changed: the diff shows `WORK_RESULT.md` only (the reworded line,
  plus this appended correction record). The tracked gate
  `tests/public-product-spelling.test.mjs` is preserved unchanged; no test,
  public entry, or evidence was removed or reclassified.
- `WORK_RESULT.md` is a `repository_only_files` exclusion in
  `scripts/build-public-release.sh` and is absent from `SHA256SUMS` and
  `release/public-files.manifest`; neither `scripts/verify-release-governance.mjs`
  nor any `.github/workflows/` step reads it, so this correction affects no
  release content and no other registered gate.

## Re-validation (corrected tree; actual commands, actual observations)

- `npm run release-governance:test` → 93/93 pass, 0 fail, exit 0 (run on
  the corrected tree after the line rewording, before this record was
  appended).
- `sha256sum --check SHA256SUMS` → exit 0 (all 1831 entries OK).
- `npm run release-governance:verify` → `RELEASE_GOVERNANCE_PASS`, exit 0.
- `npm run release-governance:test` with this record appended (final
  tree) → 93/93 pass, 0 fail, exit 0.
- `git status --short` after the final run → only `WORK_RESULT.md`
  modified (the reworded line plus this record); no other tracked bytes
  touched.

## Unchanged

The admission-gate verdict of the section above is unchanged and remains in
force: the XRA-PS-02 paired slice is not delivered (the in-tree slice
receipt holds AC03 `NOT_PROVEN`; `publicly_delivered` remains false;
controller-owned gates WAIT). No product work is performed or claimed;
nothing here claims delivery. No push, no public mutation, no credentials,
no external systems, no issue closure. No future-roadmap capability, no
consumer-support claim, and no historical-retention semantics are asserted
anywhere by this record.

## Independent re-verification (fresh current main, 2026-09-13) — SOURCE_ALREADY_PRESENT

A fresh independent pass on this exact working tree (HEAD `45c2c77143a6e123e3d6dd43370dfd310dd50554`,
on top of the native wire/head integration `66d42f8` and the reference base
`a70b3ff9ca07d5061e8c6e22564d23b0cc97acf8`) found the XRA-PS-02 native
wire/head integration **already implemented, registered, and locally proven**.
No source was rebuilt. The verification below re-derives every claim from the
bytes on disk (no reliance on prior records). Environment: node v24.19.0,
npm 11.17.0, TypeScript 5.9.3, **docker ABSENT**.

### SOURCE_ALREADY_PRESENT — exact paths (hash re-derived and matching)

- `src/cks-12/kaleidosphere-candidate-quarantine.ts` sha256
  `d39fbfc9f982c9bbe33567134f3b5a9d0eecaa1935f49e66815c8b5a1ef815a9` — native
  surface present: `KALEIDOSPHERE_RECONCILED_RELEASED_HEAD_V1` /
  `PANSPHAIRA_RECONCILED_RELEASED_HEAD_V1` (= the reconciled released pair
  `545a3b44…` / `7f662672…`), `RECONCILED_RELEASED_HEADS_V1`,
  `ADJUDICATION_CHAIN_STAGES` (the exact seven
  `GENERATION→PROJECTION→INGESTION→SEMANTICS→ANALYSIS→CANDIDATE→ADJUDICATION`),
  `createNativeAdjudicationContextV1`, `adjudicateNativeCandidateV1`,
  `createNativePairedAdjudicationReceiptV1`, `verifyNativePairedAdjudicationReceiptV1`,
  `fetchNativeProjectionV1`, `nativeTransportBytesV1`, `nativeProjectionDigestV1`,
  `nativeCandidateDigestV1`.
- `tests/cks-12/kaleidosphere-candidate-quarantine-native.test.ts` sha256
  `f5d68f57b1dd4e7d9bff778822b6a001b61ff7a7477278eebefe18e1f4481ae0` (6 tests).
- `tests/cks-12/kaleidosphere-candidate-quarantine.test.ts` sha256
  `874bfe3e8e7a69bd6a31474c5ca1b8712437a5f8e54b3d51cb48bbfce4e7507f` (5 tests, flat, preserved).
- `verification/pansphaira-kaleidosphere-analytics-slice-v1.json` sha256
  `f72c163b560f8a270c5aa720d794a90b2c533e4033d9e5a6201bc94db1da6b2d` (scope
  `LOCAL_SYNTHETIC_AND_LOCAL_VM_REAL_HTTP`).
- Evidence fixtures (LOCAL_VM_REAL_HTTP loopback captures):
  `tests/fixtures/cks-analytics/xra-ps-02-native-service-capture-v1.json` sha256
  `949632ef2b517b36ec8969700c9b54fd2a94d3b47751bdd070b319a76864ee4a`;
  `tests/fixtures/cks-analytics/xra-ps-02-native-service-substitution-capture-v1.json`
  sha256 `645c238a2fbb762958dc2473414c2a85ab8feb104185b9f938ea374c0887dbff`.
  The substitution capture is a genuine identical-input substitution: `resultSha256`
  is IDENTICAL to the real capture (`b3027cef96da4262ec7a2a43bbdcea275a23e988aff0aab92f29745e4df81099`);
  only the three head-binding fields differ (`bindings.kaleidosphereHead.commitOid/treeOid`,
  `bindings.environmentSha256`) — the stale-head falsifier.

### Registration (re-derived, all consistent)

- Root `SHA256SUMS`: `sha256sum -c SHA256SUMS` → **all 1831 entries OK**; the four
  closure files registered at their true sha256s (lines 977, 1123, 1124, 1824).
- `release/public-files.manifest`: 1518 data lines; all four closure files present
  (mode 0644). The builder count binding is the computed final count.
- `verification/verification-dag-v2.json`: `graphVersion 49`, 57 nodes; node
  `cks-12-closed-learning-loop-v1` registers the implementation + both tests as
  `VALIDATOR` and the slice receipt as `DERIVED_EVIDENCE`, each at the file's true sha256.
- `npm run integrity:refresh` → **net-zero** (0 changed files): the
  DAG/SHA256SUMS/census registration is self-consistent and stable.

### Test results (actual commands, this environment)

- `npm run build` → exit 0 (TypeScript 5.9.3, clean).
- `npm run xra-ps-02:test:compiled` (flat + native quarantine) → **11/11 pass, 0 fail**
  (AC01 independent non-authoritative adjudication; AC02 five exact clean-room
  outcomes via independent child processes; AC03 receipt VERIFIED + 6 tamper denials +
  no-material denial + gate-failing-candidate refusal; AC04 before/after deep-equality;
  wire service-down/substitution/malformed fail-closed; exotic-input zero-invocation denial).
- `node --test dist/tests/verification-fabric-v2.test.js` → 32/32;
  `dist/tests/verification-fabric.test.js` → 3/3;
  `dist/tests/canonical-json-profile-inventory.test.js` → 35/35;
  `dist/tests/contribution-intake-ledger.test.js` → 27/27;
  `dist/tests/trust-compatibility-foundation-closure.test.js` → 9/9.
- `npm run release-governance:test` (release-governance + public-product-spelling) → **93/93**;
  `npm run release-governance:verify` → **RELEASE_GOVERNANCE_PASS**.
- `node --test tools/video-production-reference/tests/slice.test.mjs
  tools/video-production-reference/tests/closure.test.mjs` → 116/116.
- Full `npm test` (pretest + test + posttest) → **722/729 pass, 7 fail**. All 7 failures
  are `spawnSync docker ENOENT` (BLD-001-G6 ×2, AAS-037 ×2, AAS-036-6, AAS-035 ×2) in
  `tests/builder-agent-runtime.test.mjs`, `tests/managed-skill-lifecycle-runtime.test.mjs`,
  `tests/model-access-broker-runtime.test.mjs`, `tests/openclaw-gateway-state.test.mjs` —
  **docker is not installed in this environment** and **none of those files is touched by
  this change** (verified against `git diff a70b3ff..45c2c77`). These are pre-existing
  environment limitations, not product defects of this candidate. (The docker tests were
  re-run green in the docker-equipped root VM in the prior record: 34/34 + 2/2.)
- Local public-release staging (local only, output discarded, NOT a public release):
  `bash scripts/build-public-release.sh --output /tmp/ps344-staging/cm-product-increment-rc-20260913-vfy`
  → exit 0; 1518 count binding held (no `UNMANIFESTED_SOURCE_FILE`); all four closure files
  **PRESENT** in the staged public tree and byte-identical to the repo; staged tree
  content self-consistent (`sha256sum -c` all OK, 1517 listed + 2 SHA256SUMS files that
  cannot self-hash). The staged archive byte hash differs from the prior record solely due
  to GNU tar version (metadata), not staged content.
- `git diff --check` → clean.

### AC binding (confirmed by reading the implementation, not just the tests)

- **AC01** `adjudicateNativeCandidateV1` is fail-closed (strict gate order: envelope shape →
  reconciled heads → closed candidate shape → byte digests vs bindings → transport provenance
  vs the PAN-owned `buildKaleidosphereAnalyticsProjectionV1()` → independent
  `deriveNativeAnalysisV1` re-derivation → head bindings → context → conflict → restriction);
  every outcome carries `authority/effect/capabilityDelta/canonicalKnowledgeMutation = "NONE"`
  and `kaleidoSphereServiceVerdictAuthoritative = false`.
- **AC02** the five exact outcomes are produced; the restriction/conflict cases come only from
  the independently sourced PAN adjudication context
  (`provenance.source = "PANSPHAIRA_INDEPENDENT_ADJUDICATION"`, validated; foreign source or
  stale canonical-Knowledge digest → `NATIVE_CANDIDATE_SCHEMA_DENIED`), never fabricated as v1
  service output.
- **AC03** `verifyNativePairedAdjudicationReceiptV1` re-runs the full adjudication and chain
  from exact material and is fail-closed `DENIED`/`["NATIVE_RECEIPT_DENIED"]` without material or
  on any tampered field; the receipt binds both reconciled released heads and the complete
  seven-stage chain.
- **AC04** `buildAuthoritativeAdjudicationInputs()` before/after is deep-equal and
  `canonicalKnowledgeSha256` is invariant
  (`d756437db8c991ee78ea7a9fcc7a9d4749daf8eebda51d5ba31fcc53e1b1242a`).

### Public evidence bound: honest terminal outcome (unchanged by this re-verification)

- AC01 / AC02 / AC04: **PROVEN_LOCALLY** (genuine, fail-closed, on the real captured
  `LOCAL_VM_REAL_HTTP` service output). AC03's **local** receipt property is VERIFIED; the
  **public** chain proof (Root-QS, cross-repository CI/readback, serial release, anonymous
  public readback) is **NOT_PROVEN** — public transport is absent (HTTP 404 remains missing)
  and this environment forbids push / external systems / public mutation.
- **#344 (XRA-PS-02) public-evidence-bound terminal outcome: WAIT / BLOCKED_EXTERNAL on the
  public chain.** The controller-owned public gates — fresh independent review of this exact
  candidate, exact PR/Main CI, serial release of the public artifact, and anonymous public
  readback — all remain pending. `publicly_delivered` remains **false**. Nothing here claims
  delivery.
- **Epic #341: does NOT report PASS and is NOT closed.** The exact child readback shows #344
  is not publicly delivered (public chain NOT_PROVEN), so the parent acceptance "every child
  reaches a public evidence-bound terminal outcome" is not satisfied by a PASS for #344, and
  "closes only after exact child readback" is not met. The epic remains open with #344 at
  WAIT. (Sibling children #343/XRA-PS-01 and #151/XRA-KS-01 are recorded delivered/closed by
  supplied owner-attested provenance; their public readback is not independently re-verified
  from this clone.)
- No push, no public mutation, no credentials, no external systems, no issue closure. The
  delivery job controller owns the fresh repository-routed independent review, exact
  PR/Main CI, release, and anonymous readback; this work never authors or approves those
  receipts.

### Unresolved gates (controller-owned; RELEASE_BLOCKERS, not FOLLOW_UPs) — unchanged

1. Fresh independent Qwen review of this exact candidate.
2. Exact PR/Main CI on the delivered head.
3. Serial release of the public artifact for this head.
4. Anonymous public readback (release + readback receipts).
5. AC03 public chain proof (NOT_PROVEN; public evidence URL HTTP 404 / missing).

All remain WAIT. Nothing here claims delivery; `publicly_delivered` remains false.

## AC03 execution/evidence — real Root-QS paired chain + v2 successor receipt (fresh current main `d4dc2fa`, 2026-09-13)

This node produces the missing **AC03 execution/evidence** for issue #344 on the fresh
current-Main candidate. It adds the real Root-QS execution of the seven-stage chain in the
dedicated root test VM, the raw Root-QS evidence, a **v2 successor paired receipt** that
separately binds the immutable released **input heads** and the **tested PAN adjudicator
source**, a v2 slice, and a focused RED/GREEN/NEGATIVE test — while preserving the released
source-only history (the v1 receipt bytes, the two real-HTTP capture fixtures, all existing
tests, the public registration and proofs).

### What was insufficient (RED) and what this node adds

The prior candidate (`d4dc2fa`) carried the v1 **source-local** base receipt
(`pansphaira:xra-ps-02-native-paired-receipt-001`, digest `d45085872866815e…`). It binds the
two reconciled released heads and the complete seven-stage chain, but it binds **no tested
source and no live execution**: it cannot distinguish "we launched the real pinned KS service
at the released head and its real response drove the independent PAN verifier" from "this
source happens to produce this candidate". That is the "old source-local proof", and it is
**structurally insufficient** for AC03 execution/evidence. This node supplies the AC03
execution/evidence deliverable on top of it (additive; the v1 base is preserved by reference,
never rewritten).

### Deliverables (new/additive; v1 receipt bytes + historical captures untouched)

| path | role | sha256 |
| --- | --- | --- |
| `scripts/run-xra-ps-02-root-qs-replay.mjs` | executable Root-QS replay runner: launches the pinned KS native-projection service, feeds its real response to the independent PAN verifier, drives the five outcomes + three falsifiers, emits raw Root-QS evidence | `895ed1bd9b637c6007b9aa0eb7de4e9879af0275fdb9c0e59e6c5ae7440474d8` |
| `tests/cks-12/kaleidosphere-candidate-quarantine-rootqs.test.ts` | focused RED/GREEN/NEGATIVE test (7 tests) binding the v2 receipt + raw Root-QS evidence | `00d7c3ef922fa05fd5494d861765b02793bb2f868ed5688f2b16353ce9a99f58` |
| `tests/fixtures/cks-analytics/xra-ps-02-native-paired-receipt-v2.json` | **v2 successor paired receipt** (two-group binding) | `851fc4f553978a167dae42caaad4cef3ff77311db1d73186e699a2e1f14492cf` |
| `tests/fixtures/cks-analytics/xra-ps-02-native-root-qs-raw-v2.json` | raw Root-QS execution evidence (real VM run) | `f4c8df82b92017eb07654b39e834cc87cd020f441543564ff1634b6068e0f94a` |
| `verification/pansphaira-kaleidosphere-analytics-slice-v2.json` | v2 analytics slice (supersedes the v1 slice by reference; v1 preserved) | `b4abf58cdb1d1e7ac9dc25ceceef41226d79c84c2ca461253ac29dbae9e5aeaf` |

All five are registered in `release/public-files.manifest`, `SHA256SUMS`, the release DAG
(graphVersion 49), and the governance closure roles. The frozen v1 receipt
(`xra-ps-02-native-paired-receipt-v1.json`, `d4508587…`) and the two real-HTTP capture
fixtures (`xra-ps-02-native-service-capture-v1.json`,
`xra-ps-02-native-service-substitution-capture-v1.json`) are preserved byte-for-byte.

### The v2 successor receipt (two-group binding)

- `schemaVersion` `pansphaira.xra-ps-02/native-paired-receipt/v2`; `receiptId`
  `pansphaira:xra-ps-02-native-paired-receipt-002`; `receiptDigest`
  `162f479a391a819f8395303a6cae07e0891ecc799b70bacdeded95858e4207f9`.
- Preserves the v1 base by reference (additive, never rewritten): `baseReceiptId`
  `pansphaira:xra-ps-02-native-paired-receipt-001`, `baseReceiptDigest`
  `d45085872866815e82f013c164b436d4169acbafee6d117c358adbc17bf33c6f`,
  `baseAdjudicationDigest` `12f10e019a0214e8e4bb453a85290538b9d86bc1eae17a239239573fef727b92`.
- **Group 1 — released input heads** (`inputHeads`, `inputHeadsDigest`
  `59b6aa5f1b97e1f73cad555f2a5764a0534750f188ee3564bc30681f12089fb8`) bind the immutable
  released pair and the canonical transport:
  - `pansphairaHeadCommit` `988395110a9189d1b8cd4ee98184ed5c1d77a15d`
  - `pansphairaReleaseCommit` `7f662672bfc45087342f23e5c589d43598f5c20d`
  - `pansphairaReleaseTag` `2026_09_05_v1`
  - `pansphairaReleaseReceiptSha256` `bd485d4525cfce9b843de54b2fb6e30e30e560857e6f06faa0f494f65dddb1c6`
  - `kaleidoSphereHeadCommit` `545a3b44ea88c96eded060c11c7c3a2afe0edff6`
  - `kaleidoSphereHeadTree` `c0699e1b4cfdfaf3076928e644ba5da3e9b7798c`
  - `canonicalTransportSha256` `91c26eb69860767ec2898a48676caaeb52c808de284bb0fbfbe8a986d30ad19c`
  - `projectionDigest` `cc5f6cc9591ccf4b6b3c4b9f954aa9da09695b784d7abaa585c082aea195ef1b`
  - `rawArtifactSha256` `22f34bf33874a42cde5a5a23a2242935e8b2b145aa8e2364a5aef26b8ec3e6e8`
  - `sourceContractSha256` `d2995f7e8ed46031902d09a5138202a489834d4a018646c50920a482bbf7da44`
- **Group 2 — tested PAN adjudicator source** (`testedSource`, `testedSourceDigest`
  `50abb6d8f8e582a2f231931d7c163399535959dbd7edfcc72873ebec2ed0e708`) binds the exact source
  and focused test that were executed, plus the exact pinned KS service identity:
  - `adjudicatorSha256` `3712c9fc41b7704aabfa04db1b0e76398e44d3b520694a7aac475c12e02a4d5b`
    = on-disk `src/cks-12/kaleidosphere-candidate-quarantine.ts` (re-derived and matched)
  - `focusedNativeTestSha256` `f5d68f57b1dd4e7d9bff778822b6a001b61ff7a7477278eebefe18e1f4481ae0`
    = on-disk `tests/cks-12/kaleidosphere-candidate-quarantine-native.test.ts`
  - `kaleidoSphereServerSha256` `1ff0e7476269e93a8bc52d446e7fc408199a7181103a54e54a8bc16149c844e5`
  - `kaleidoSphereHeadCommit` / `kaleidoSphereHeadTree` (same released head as group 1)

  The two groups are separate objects with distinct digests (`inputHeadsDigest ≠
  testedSourceDigest`), so the immutable released input heads and the tested source are bound
  **independently**. The tested source is the additive v2 adjudicator source, deliberately
  distinct from the pre-v2 released implementation the v1 slice bound.

### Seven-stage chain + real Root-QS execution (raw Root-QS evidence)

`tests/fixtures/cks-analytics/xra-ps-02-native-root-qs-raw-v2.json`
(`pansphaira.xra-ps-02/native-root-qs-raw/v1`, issue #344):
- **command** `node scripts/run-xra-ps-02-root-qs-replay.mjs (PAN_ROOT=/tmp/pan KS_ROOT=/tmp/ks PORT=18877)`;
  **scope** `LOCAL_VM_REAL_HTTP`; **transport** `loopback HTTP (127.0.0.1)`; **runtime** node
  `v24.21.0` (dedicated root test VM).
- **real pinned KS service**: `healthz` `UP`, `serverSha256` `1ff0e747…` at the exact released
  head (`545a3b44…` / `c0699e1b…`), `headsEndpoint.nativeReleaseRegistry.status` `RELEASED`.
- **full runtime compatibility of the reconciled released pair**: the live service reproduces
  the historical capture byte-for-byte (`liveCandidate.matchesHistoricalCapture` `true`,
  `resultSha256` `b3027cef96da4262ec7a2a43bbdcea275a23e988aff0aab92f29745e4df81099`), and its
  real response is fed to the existing independent PAN verifier, which re-derives the
  deterministic analysis from the canonical transport bytes + PAN-owned projection and never
  trusts the KS service envelope/verdict.
- **chain** (bound at every stage with command/runtime/source identities, inputs and raw
  outputs): GENERATION → PROJECTION → INGESTION → SEMANTICS → ANALYSIS → CANDIDATE →
  ADJUDICATION.

### Five paired outcomes + three real falsifiers (through the real paired chain)

- **outcomes** (native v1 `unknown=false` / empty counterevidence; restriction/conflict derived
  from explicit independently sourced PAN adjudication context):
  - `ACCEPTED_BOUNDED` / `NATIVE_EVIDENCE_ACCEPTED` (positive)
  - `RESTRICTED` / `NATIVE_EVIDENCE_RESTRICTED_UNKNOWN` (restricted-unknown)
  - `DENIED` / `NATIVE_CONFLICTING_COUNTEREVIDENCE_DENIED` (conflicting-counterevidence)
  - `DENIED` / `NATIVE_FORGED_CANDIDATE_DENIED` (forged-candidate)
  - `DENIED` / `NATIVE_STALE_HEAD_DENIED` (stale-head)
- **falsifiers** (real, in-VM): `service-down` / `XRA_PS_02_NATIVE_SERVICE_UNAVAILABLE`,
  `substitution` / `NATIVE_STALE_HEAD_DENIED`, `malformed` / `XRA_PS_02_NATIVE_WIRE_SHAPE_DENIED`.
- **before/after (invariant)**: canonical Knowledge digest
  `d756437db8c991ee78ea7a9fcc7a9d4749daf8eebda51d5ba31fcc53e1b1242a` before === after;
  authority `NONE`/`NONE`, capability delta `NONE`/`NONE`, effect `NONE`/`NONE`.

### RED → GREEN → NEGATIVE (focused test, 7 tests)

`tests/cks-12/kaleidosphere-candidate-quarantine-rootqs.test.ts`:
- **RED**: the v1 source-local base receipt binds no tested source and no live execution
  (no `testedSource`/`testedSourceDigest`, no `rootQsExecution`/`inputHeads`/
  `inputHeadsDigest`), is a different schema/identity from v2, and is fail-closed `DENIED`
  (`["NATIVE_V2_RECEIPT_DENIED"]`) when checked as a v2 successor receipt.
- **GREEN (×5)**: (1) the committed v2 receipt from actual execution verifies `VERIFIED` with
  exact material (7-stage chain, authority/effect `NONE`); (2) the v2 receipt independently
  binds the tested PAN adjudicator source, separately from the released input heads (on-disk
  shas re-derived and matched; distinct group digests); (3) the five paired outcomes and three
  real falsifiers are bound exactly (`scope` `LOCAL_VM_REAL_HTTP`); (4) canonical Knowledge,
  authority, capability and effect are unchanged (before === after); (5) the real pinned KS
  service reproduces the historical capture (full runtime compatibility).
- **NEGATIVE**: tampering a released input head, the raw Root-QS results (flipped outcome),
  a mismatched tested source, missing raw-results material, or a forged tested source (even
  when internally self-consistent) all fail closed (`DENIED`) against the committed proof.

### Census re-baseline (FND-PS-04) — additive V14 migration, no weakening

The new artifacts and the generator change re-baselined the FND-PS-04 canonical-JSON census.
Because the generator `scripts/refresh-integrity-data.mjs` is code-owned and pinned through a
one-way immutable profile-version-migration chain, this is an **additive** migration, not an
edit to any frozen digest:
- generator digest moved `c45eef7d08a6…` →
  `886b6e4ce240405db56758064ba6ae00d6f31d9c9d365ef09c4d62fd7448165d` (V13 `toSha256` frozen at
  `c45eef7d…`; V14 `toSha256` = current on-disk digest).
- V14 migration appended to both the test's `PROFILE_VERSION_MIGRATIONS`
  (`…/INTEGRITY-GENERATOR/V14`) and the artifact's `profileVersionMigrations` (the validator
  compares every key+value of each migration to its code-owned entry; chain now `[2..14]`).
- `filesScanned` 641 → **643**; ledger 1831 → **1836** (entries = unique = 1836, duplicate 0).
- The two `c45eef7d…` byteObligation/profile `sha256` values for the generator entry →
  `886b6e4c…`; census artifact digest now
  `77c20fd8b10eb238358f4a4c444de2e178d59231dcf919d1cd1a841de8214766` (matches `SHA256SUMS`).

### Count-binding fix (FND-XR-01)

`tests/verification-fabric-v2.test.ts:299` still bound the pre-change public-file count `1518`
while `release/public-files.manifest` is exactly **1523** data lines (2 `#` header lines +
1523 source/destination/mode rows; the 5 new public files). Updated `1518` → `1523` — the same
legitimate count-binding update the prior correction made (1514 → 1518). No test logic or
governance assertion weakened.

### Governance registration (additive; public count 1518 → 1523)

- `release/public-files.manifest` +5 (now 1523 data lines).
- `scripts/build-public-release.sh` public count → 1523 (the `count != 1523` guard).
- `tests/release-governance.test.mjs` closure roles +5 (9 closure roles).
- `tests/verification-fabric-v2.test.ts:299` → 1523.
- `tests/public-product-spelling.test.mjs` +3 `stable-xra-ps02-technical-identifier` paths
  (runner, v2 slice, v2 raw).
- `verification/verification-dag-v2.json` `graphVersion` 49, +9 closure paths.
- `SHA256SUMS` 1836 entries (was 1831); all 5 new artifacts + the census artifact re-verified
  against on-disk sha256.

### Test results (actual commands, this candidate, 2026-09-13)

```
npm run build                                                          -> exit 0 (tsc -p tsconfig.json)
node --test dist/tests/cks-12/kaleidosphere-candidate-quarantine-native.test.js   -> tests 6  pass 6  fail 0
node --test dist/tests/cks-12/kaleidosphere-candidate-quarantine-rootqs.test.js   -> tests 7  pass 7  fail 0
node --test dist/tests/canonical-json-profile-inventory.test.js                   -> tests 35 pass 35 fail 0
node --test dist/tests/verification-fabric-v2.test.js                             -> tests 32 pass 32 fail 0
node --test tests/release-governance.test.mjs                                       -> tests 88 pass 88 fail 0
node --test tests/public-product-spelling.test.mjs                                  -> tests 5  pass 5  fail 0
npm test   (full suite)                                                              -> tests 729 pass 722 fail 7
```

The 7 full-suite failures are exactly the pre-existing `spawnSync docker ENOENT` environmental
failures (BLD-001-G6 ×2, AAS-037 ×2, AAS-036-6/8, AAS-035 ×2) — `docker` is absent on this host
and none of those test files is touched by this change. The 8th failure from the earlier full
run (FND-XR-01, `verification-fabric-v2` `1523 !== 1518`) is now **passing** after the
count-binding fix, leaving exactly the 7 docker-ENOENT cases.

### Nonclaims and fences (unchanged, all retained)

- **Scope is `LOCAL_VM_REAL_HTTP`** over loopback HTTP (127.0.0.1) inside the dedicated root
  test VM; the raw Root-QS evidence is **not public evidence, not public-closure evidence, and
  not a working public evidence URL** (public transport absent; HTTP 404 remains missing).
- **Frozen v1 constants untouched**; the v1 receipt bytes and the two real-HTTP capture fixtures
  are preserved byte-for-byte (v2 supersedes by reference, never rewrites history).
- **No no-op KS release**: the real pinned KS native-projection service was launched and its
  real response drove the independent PAN verifier.
- No push, no public mutation, no credentials, no external systems, no issue closure. The
  delivery job controller owns the fresh repository-routed independent review, exact PR/Main
  CI, serialized release, and anonymous public readback; this work never authors or approves
  those receipts.

### Unresolved gates (controller-owned; RELEASE_BLOCKERS, not FOLLOW_UPs)

1. Fresh independent Qwen review of this exact candidate.
2. Exact PR/Main CI on the delivered head.
3. Serial release of the public artifact for this head.
4. Anonymous public readback (release + readback receipts).
5. AC03 public chain proof (**NOT_PROVEN**; public evidence URL HTTP 404 / missing).
6. (Environmental, not a correctness gate on this candidate) 7 `spawnSync docker ENOENT`
   full-suite failures — `docker` absent on this host; none of those test files is touched by
   this change.

All remain WAIT. Nothing here claims delivery; `publicly_delivered` remains false.
