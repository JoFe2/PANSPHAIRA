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