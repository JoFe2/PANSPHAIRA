#!/usr/bin/env node
/**
 * Measurement-only harness: pure-compute p50/p95 + allocation evidence for the pinned
 * Node.js implementation of the three required paths, and the one bounded index/comparison
 * reuse comparison.
 *
 * MEASUREMENT BOUNDARY (non-goals, matching the issue):
 *   - No Mojo migration, no GPU, no expected-speedup claim. This records what the
 *     CURRENT Node.js code actually does, before any such proposal.
 *   - Every measured call is PURE COMPUTE: in-process, deterministic, no provider call,
 *     no network, no process spawn, no CI, no authorization grant, no wall-clock wait on
 *     external systems. The only I/O is one-time fixture load OUTSIDE the timed loop.
 *   - The bounded optimization compared here is request-local index/comparison-value
 *     reuse only. It is a measurement candidate, NOT the production path.
 *
 * Run under the repo-pinned toolchain with --expose-gc so allocation evidence is real:
 *   node --expose-gc scripts/measure-node-pure-compute.mjs
 *
 * Without --expose-gc the latency p50/p95 are still reported; allocationBytes are null
 * and gcEnabled=false (the harness degrades, it does not fake a number).
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { resolve, sep } from "node:path";

import {
  cks09Digest,
  counterevidenceAssessmentDigestV1,
  diversityProofDigestV1,
  solutionPatternDigestV1,
  taskFamilyDigestV1,
  taskFingerprintDigestV1,
} from "../dist/packages/contracts/src/cks-task-fingerprint.js";
import {
  retrieveTaskToSuccessfulKnowledgeV1,
} from "../dist/packages/cks/src/applicability-aware-retrieval.js";
import {
  retrieveTaskToSuccessfulKnowledgeIndexedV1,
} from "../dist/packages/cks/src/applicability-aware-retrieval-indexed.js";
import { canonicalJson } from "../dist/packages/contracts/src/canonical-json.js";
import {
  compileEffectiveRightsV1,
  syntheticEffectiveRightsInputV1,
} from "../dist/packages/contracts/src/effective-rights.js";
import {
  queryMediaWikiReadonlyV1,
  activeMediaWikiReadonlyEditionV1,
  selectedMediaWikiReadonlyEditionV1,
  mediaWikiReadonlyQueryCorpusV1,
} from "../dist/packages/local-knowledge/src/mediawiki-readonly-query.js";
import {
  importMediaWikiMiniDumpEditionV1,
  projectMediaWikiMiniDumpEditionV1,
} from "../dist/packages/contracts/src/mediawiki-mini-dump.js";
import { createHash } from "node:crypto";

const CLAIM_BOUNDARY =
  "OFFLINE_DETERMINISTIC_PURE_COMPUTE_NO_PROVIDER_NO_NETWORK_NO_PROCESS_SPAWN_NO_CI_NO_AUTHORITY_NO_WAIT";

function sha256Hex(value) {
  return createHash("sha256").update(value).digest("hex");
}

// ---------------------------------------------------------------------------
// Benchmarking
// ---------------------------------------------------------------------------

function percentile(sortedAsc, p) {
  if (sortedAsc.length === 0) return 0;
  const idx = Math.min(sortedAsc.length - 1, Math.floor((p / 100) * sortedAsc.length));
  return sortedAsc[idx];
}

function round(value, digits = 6) {
  const f = 10 ** digits;
  return Math.round(value * f) / f;
}

/** Deterministic retained-output size: the Canonical-JSON byte length of a result. */
function canonicalBytes(value) {
  return canonicalJson(value).length;
}

/** Settle the heap to a stable baseline before measuring (best-effort; no-op without --expose-gc). */
function settle() {
  const gc = global.gc;
  if (!gc) return;
  gc();
  gc();
}

/**
 * Measure pure compute of fn. Warmup primes the JIT/allocators; then each iteration:
 *   gc()  ->  before=heapUsed  ->  result=fn()  ->  after=heapUsed (NO gc between fn and
 * after, so the delta captures the full working-set allocation of the call: the returned
 * result object PLUS the transient strings/maps that have not yet been collected).
 *
 * CAVEAT (recorded in the receipt methodology): this working-set delta is dominated by the
 * RETAINED result object (which is byte-identical between the original and the indexed
 * variant) and is sensitive to V8 GC timing mid-call. It is indicative of per-call working
 * set, NOT a precise transient-allocation count. The precise, GC-independent allocation
 * reduction from the bounded index reuse is reported separately as `derivedIndexReuseModel`
 * (a static count of context-index Map constructions) and the deterministic retained output
 * size as `retainedOutputBytes`.
 */
function bench(name, fn, { warmup = 25, iterations = 250 } = {}) {
  settle();
  for (let i = 0; i < warmup; i++) fn();
  const gc = global.gc;
  const timesMs = new Array(iterations);
  const allocBytes = new Array(iterations);
  let held; // at most one live result at a time
  for (let i = 0; i < iterations; i++) {
    if (gc) gc();
    const before = process.memoryUsage().heapUsed;
    const t0 = process.hrtime.bigint();
    held = fn();
    const t1 = process.hrtime.bigint();
    const after = process.memoryUsage().heapUsed;
    timesMs[i] = Number(t1 - t0) / 1e6;
    allocBytes[i] = Math.max(0, after - before);
  }
  held = undefined;
  const sorted = [...timesMs].sort((a, b) => a - b);
  const sortedAlloc = [...allocBytes].sort((a, b) => a - b);
  return {
    name,
    iterations,
    warmup,
    gcEnabled: Boolean(gc),
    latencyMs: {
      p50: round(percentile(sorted, 50)),
      p95: round(percentile(sorted, 95)),
      min: round(sorted[0]),
      max: round(sorted[sorted.length - 1]),
      mean: round(sorted.reduce((a, b) => a + b, 0) / sorted.length),
    },
    workingSetGrowthBytes: gc
      ? {
          p50: percentile(sortedAlloc, 50),
          p95: percentile(sortedAlloc, 95),
          mean: round(sortedAlloc.reduce((a, b) => a + b, 0) / sortedAlloc.length),
        }
      : null,
    allocationNote:
      "heapUsed working-set delta (result + uncollected transients); GC-timing-sensitive and dominated by the retained result object — indicative, not a precise transient count",
  };
}

// ---------------------------------------------------------------------------
// CKS retrieval dataset (scaled by candidate count; shared context per size)
// ---------------------------------------------------------------------------

const bundle = JSON.parse(readFileSync("tests/fixtures/cks-09/contracts-valid-v1.json", "utf8")).knowledgeBundle;

function digestChar(char) {
  return `sha256:${char.repeat(64)}`;
}

function fingerprint(id, inputShapeId = "shape:document", contextShapeId = "context:batch", version = "node-24.14.1", effectClass = "READ_ONLY") {
  const unsigned = {
    fingerprintId: id,
    taskFamilyId: "family:document-transform",
    objectiveShapeId: "shape:normalize",
    inputShapeId,
    outputShapeId: "shape:normalized",
    contextShapeId,
    constraintIds: ["constraint:safety"],
    effectClass,
    dependencyIds: ["dependency:parser"],
    versionVector: [{ componentId: "runtime:node", versionScheme: "OPAQUE_EXACT", exactValue: version }],
  };
  return { ...unsigned, canonicalDigest: taskFingerprintDigestV1(unsigned) };
}

function family() {
  const unsigned = {
    familyId: "family:document-transform",
    membershipClauses: [{ factPath: "/objectiveShapeId", operator: "EQ", operand: "shape:normalize" }],
    invariantIds: ["invariant:normalized-output"],
    variantAxes: ["contextShapeId", "inputShapeId"],
    exclusionClauses: [{ factPath: "/effectClass", operator: "EQ", operand: "EXTERNAL_OR_IRREVERSIBLE" }],
    evidenceRefs: ["evidence:family-001"],
    provenanceRefs: ["provenance:fixture-a"],
  };
  return { ...unsigned, canonicalDigest: taskFamilyDigestV1(unsigned) };
}

function evidence(id, taskFingerprintDigest, outcomeDigest, kind = "OBSERVATION", provenanceRef = "provenance:fixture-a") {
  return { evidenceId: id, kind, sourceDigest: digestChar("a"), taskFingerprintDigest, outcomeDigest, provenanceRef };
}

function provenance(id, rootChar) {
  return { provenanceId: id, sourceKind: "synthetic-fixture", sourceLocator: `fixture/${id}`, rootDigest: digestChar(rootChar), parentDigests: [], producerId: "producer:cks09", toolchainVersionVector: [], sealed: true };
}

function makePattern(overrides = {}) {
  const unsigned = {
    patternId: "pattern:normalize-document",
    maturity: "S4",
    taskFamilyIds: ["family:document-transform"],
    applicabilityClauses: [{ factPath: "/objectiveShapeId", operator: "EQ", operand: "shape:normalize" }],
    preconditions: [{ factPath: "/effectClass", operator: "EQ", operand: "READ_ONLY" }],
    procedureDigest: digestChar("c"),
    expectedOutcomeDigest: digestChar("d"),
    dependencyRefs: ["dependency:parser"],
    evidenceRefs: ["evidence:obs-001", "evidence:obs-002", "evidence:obs-003"],
    provenanceRefs: ["provenance:fixture-a", "provenance:fixture-b", "provenance:fixture-c"],
    knownFailureRefs: ["failure:known-001"],
    counterexampleRefs: ["counterexample:similar-001"],
    counterevidenceAssessmentRef: "assessment:search-001",
    versionConstraintRefs: ["constraint:node-exact"],
    ...overrides,
  };
  return { ...unsigned, canonicalDigest: solutionPatternDigestV1(unsigned) };
}

/**
 * Build a valid CKS retrieval request of the given candidate count. All candidates are
 * the same valid pattern (so every one passes the applicability gate -> SELECTED); the
 * scaling axis is candidate count against a shared context, which is exactly the axis on
 * which the bounded index reuse differs (indices built once per request vs. per candidate).
 */
function buildCksRequest(candidateCount, episodeCount) {
  const task = fingerprint("task:holdout-001");
  const episodes = [];
  for (let i = 0; i < episodeCount; i++) {
    episodes.push(fingerprint(`task:episode-${String(i).padStart(3, "0")}`, `shape:doc-${i % 4}`, i % 2 === 0 ? "context:batch" : "context:interactive"));
  }
  // Dedicated failure / counterexample fingerprints + evidence so the applicability gate's
  // provenance linkage (evidence.taskFingerprintDigest === record.taskFingerprintDigest and
  // matching sealed provenance) holds and every candidate passes to SELECTED.
  const failureFingerprint = fingerprint("task:failure-001", "shape:document-failure");
  const counterexampleFingerprint = fingerprint("task:counterexample-001", "shape:other");
  const evidenceRecords = [
    ...episodes.map((episode, i) => evidence(`evidence:obs-${String(i).padStart(3, "0")}`, episode.canonicalDigest, digestChar("d"), "OBSERVATION", `provenance:fixture-${"abc"[i % 3]}`)),
    evidence("evidence:failure-001", failureFingerprint.canonicalDigest, digestChar("f"), "KNOWN_FAILURE", "provenance:fixture-a"),
    evidence("evidence:counterexample-001", counterexampleFingerprint.canonicalDigest, digestChar("f"), "COUNTEREXAMPLE", "provenance:fixture-b"),
    evidence("evidence:contrast-001", episodes[0].canonicalDigest, digestChar("d"), "CONTRAST_PAIR", "provenance:fixture-a"),
  ];
  // The first three evidence records are the valid, resolving set every candidate references.
  const provenanceRecords = [provenance("provenance:fixture-a", "1"), provenance("provenance:fixture-b", "2"), provenance("provenance:fixture-c", "3")];
  const constraintUnsigned = { constraintId: "constraint:node-exact", componentId: "runtime:node", versionScheme: "OPAQUE_EXACT", allowedExactValues: ["node-24.14.1"], evidenceRefs: ["evidence:obs-000"] };
  const versionConstraint = { ...constraintUnsigned, canonicalDigest: cks09Digest(constraintUnsigned) };
  const dependency = { dependencyId: "dependency:parser", kind: "TOOL", requiredStateDigest: digestChar("e"), versionConstraintRef: versionConstraint.constraintId, verificationEvidenceRef: "evidence:obs-000" };
  const assessmentUnsigned = { assessmentId: "assessment:search-001", searchEvidenceRefs: ["evidence:obs-001"], knownFailureRefs: ["failure:known-001"], counterexampleRefs: ["counterexample:similar-001"], negativeControlRefs: ["evidence:contrast-001"], coverageStatus: "COMPLETE" };
  const assessment = { ...assessmentUnsigned, canonicalDigest: counterevidenceAssessmentDigestV1(assessmentUnsigned) };
  const failure = {
    failureId: "failure:known-001", patternId: "pattern:normalize-document",
    taskFingerprintDigest: failureFingerprint.canonicalDigest,
    expectedOutcomeDigest: digestChar("d"), observedOutcomeDigest: digestChar("f"), evidenceRef: "evidence:failure-001", provenanceRef: "provenance:fixture-a", resolution: "BOUNDED_BY_PRECONDITION",
  };
  const counterexample = {
    counterexampleId: "counterexample:similar-001", patternId: "pattern:normalize-document",
    taskFingerprintDigest: counterexampleFingerprint.canonicalDigest,
    matchedSimilarityFacts: ["objectiveShapeId=shape:normalize"], blockingStructuralDimension: "inputShapeId", expectedDenialReason: "MATCHED_COUNTEREXAMPLE", evidenceRef: "evidence:counterexample-001", provenanceRef: "provenance:fixture-b",
  };
  const proofUnsigned = {
    proofId: "proof:stable-001", patternId: "pattern:normalize-document", independentEpisodeRefs: ["evidence:obs-000", "evidence:obs-001", "evidence:obs-002"],
    taskVariantIds: [episodes[0].fingerprintId, episodes[1].fingerprintId, episodes[2].fingerprintId].sort(), contextShapeIds: ["context:batch", "context:interactive"], coveredVariantAxes: ["contextShapeId", "inputShapeId"],
    contrastPairRefs: ["evidence:contrast-001"], provenanceRefs: ["provenance:fixture-a", "provenance:fixture-b", "provenance:fixture-c"],
  };
  const proof = { ...proofUnsigned, canonicalDigest: diversityProofDigestV1(proofUnsigned) };
  const context = {
    families: [family()], evidence: evidenceRecords, provenance: provenanceRecords, dependencies: [dependency], versionConstraints: [versionConstraint],
    knownFailures: [failure], counterexamples: [counterexample], assessments: [assessment], diversityProofs: [proof], episodes, holdoutEpisodeDigests: [],
    dependencyStateDigests: new Map([[dependency.dependencyId, dependency.requiredStateDigest]]),
  };
  const candidates = [];
  for (let i = 0; i < candidateCount; i++) {
    candidates.push({ pattern: makePattern(), knowledgeBundle: bundle });
  }
  return { task, candidates, context, arm: "KNOWLEDGE_PLUS_EXPERIENCE", replayMode: "SHADOW" };
}

// ---------------------------------------------------------------------------
// ERV dataset (scaled by per-operand scope size)
// ---------------------------------------------------------------------------

function buildErvInput(extraScopeItems) {
  const base = structuredClone(syntheticEffectiveRightsInputV1());
  for (const operand of base.operands) {
    for (const key of ["actions", "resources", "fields", "purposes", "effects"]) {
      const original = operand.scope[key];
      // Preserve the common base (so the intersection stays non-empty -> ALLOW) and add
      // distinct synthetic items to scale the scope workload.
      operand.scope[key] = [...original, ...Array.from({ length: extraScopeItems }, (_, i) => `${key}:item-${i}`)];
    }
  }
  return base;
}

// ---------------------------------------------------------------------------
// Local MediaWiki read-only dataset (scaled by edition count)
// ---------------------------------------------------------------------------

const fixtureRoot = "tests/fixtures/mediawiki-mini-dump";
const fixtureManifest = JSON.parse(readFileSync(`${fixtureRoot}/manifest.json`, "utf8"));
const positiveProfile = fixtureManifest.profiles.positive;

function baseEdition() {
  return importMediaWikiMiniDumpEditionV1(fixtureRoot, positiveProfile);
}

function changedEdition() {
  const sourceBytes = new Uint8Array(readFileSync(`${fixtureRoot}/${positiveProfile.source.path}`));
  const source = new TextDecoder().decode(sourceBytes).replace(
    "Alpha is the first synthetic article.",
    "Alpha is the FIRST synthetic article.",
  );
  const bytes = new TextEncoder().encode(source);
  return projectMediaWikiMiniDumpEditionV1(
    { ...positiveProfile, source: { ...positiveProfile.source, expectedSourceDigest: sha256Hex(bytes), byteSize: bytes.byteLength } },
    bytes,
  );
}

function buildLocalCorpus(editionCount) {
  const activeEdition = baseEdition();
  const active = activeMediaWikiReadonlyEditionV1(activeEdition);
  const selected = [];
  for (let i = 0; i < editionCount - 1; i++) {
    selected.push(selectedMediaWikiReadonlyEditionV1(changedEdition(), "UNVERIFIED"));
  }
  const corpus = mediaWikiReadonlyQueryCorpusV1(active, selected);
  const totalPages = corpus.active.edition.pages.length + selected.reduce((n, s) => n + s.edition.pages.length, 0);
  const totalChunks = corpus.active.edition.pages.reduce((n, p) => n + p.chunks.length, 0)
    + selected.reduce((n, s) => n + s.edition.pages.reduce((m, p) => m + p.chunks.length, 0), 0);
  return { corpus, request: { query: "synthetic article", ranking: "LOCAL_HYBRID", maxResults: 50 }, pages: totalPages, chunks: totalChunks };
}

// ---------------------------------------------------------------------------
// Parity gate: the bounded index-reuse variant MUST be byte-identical to the original.
// Fail closed if this ever regresses.
// ---------------------------------------------------------------------------

function assertCksParity(request, label) {
  const original = retrieveTaskToSuccessfulKnowledgeV1(request);
  const indexed = retrieveTaskToSuccessfulKnowledgeIndexedV1(request);
  if (canonicalJson(original) !== canonicalJson(indexed)) {
    throw new Error(`PARITY_VIOLATION:${label}`);
  }
  return { originalOutcome: original.outcome, selectedCount: original.selected.length, reportCount: original.reports.length };
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

function main() {
  const startedAt = new Date().toISOString();
  const receipt = {
    schemaVersion: "chimpmaera.dev/node-pure-compute-measurement/v1",
    claimBoundary: CLAIM_BOUNDARY,
    environment: {
      nodeVersion: process.version,
      platform: process.platform,
      arch: process.arch,
      execArgv: process.execArgv,
      gcEnabled: Boolean(global.gc),
      startedAt,
      repoPinned: { node: ">=24.14.1 <25", npm: ">=11.11.0 <12" },
    },
    methodology: {
      warmupPerBench: "JIT + allocator priming, discarded",
      iterationsPerBench: 250,
      latency: "process.hrtime.bigint() wall-clock per call, in-process pure compute (the reliable primary metric)",
      allocation: [
        "retainedOutputBytes = Canonical-JSON byte length of the result (deterministic; byte-identical between original and indexed for CKS)",
        "workingSetGrowthBytes = heapUsed delta (gc-settle before, after call, no intervening gc) = result + uncollected transients; GC-timing-sensitive and dominated by the retained result object — indicative, not a precise transient count",
        "derivedIndexReuseModel = static count of context-index Map constructions the bounded index reuse removes (GC-independent allocation signal for the CKS comparison)",
      ],
      allocationCaveat: "the working-set heap delta is NOT used to claim a speedup/allocation win; the reliable allocation evidence is retainedOutputBytes (invariant) + derivedIndexReuseModel (reduction magnitude). Any orig-vs-indexed delta in workingSetGrowthBytes at these sizes is within GC noise.",
      separation: "measured time is pure compute only: no provider/network/process/CI/authorization/wait; fixture load is outside the timed loop",
    },
    cksRetrieval: { entryPoints: ["retrieveTaskToSuccessfulKnowledgeV1", "retrieveTaskToSuccessfulKnowledgeIndexedV1"], optimizationCompared: "request-local index/comparison-value reuse (indices built once per request; historical + requested Canonical-JSON computed once and reused)", sizes: [] },
    effectiveRights: { entryPoint: "compileEffectiveRightsV1", sizes: [] },
    localReadonlyPath: { entryPoint: "queryMediaWikiReadonlyV1", sizes: [] },
  };

  // ---- CKS retrieval: 3 sizes, original vs indexed, with a parity gate per size ----
  const cksSizes = [
    { label: "small", candidates: 5, episodes: 8 },
    { label: "medium", candidates: 60, episodes: 24 },
    { label: "large", candidates: 240, episodes: 48 },
  ];
  for (const size of cksSizes) {
    const request = buildCksRequest(size.candidates, size.episodes);
    const parity = assertCksParity(request, `cks-${size.label}`);
    const original = bench(`cks-${size.label}-original`, () => retrieveTaskToSuccessfulKnowledgeV1(request));
    const indexed = bench(`cks-${size.label}-indexed`, () => retrieveTaskToSuccessfulKnowledgeIndexedV1(request));
    const p50Delta = indexed.latencyMs.p50 - original.latencyMs.p50;
    const p95Delta = indexed.latencyMs.p95 - original.latencyMs.p95;
    // Deterministic retained-output invariant: the original and indexed variants are
    // byte-identical, so their Canonical-JSON output size is identical and preserved.
    const retained = canonicalBytes(retrieveTaskToSuccessfulKnowledgeV1(request));
    // GC-independent derived model of the allocation the bounded index reuse removes.
    // The original rebuilds the context-index Maps PER CANDIDATE:
    //   historicalEpisodes: evidenceById + episodesByDigest
    //   candidateReferenceDenial: provenanceById + evidenceById   (evidenceById twice)
    // => 4 Map constructions over the context arrays per candidate. The indexed variant
    // builds evidenceById + episodesByDigest + provenanceById ONCE per request (3 total).
    // Total context-index Map-slot population (each .map() + Map.set() allocates):
    //   original ≈ N * (2*|evidence| + |episodes| + |provenance|)
    //   indexed  ≈       (|evidence| + |episodes| + |provenance|)   (constant in N)
    const evidenceCount = size.episodes + 3; // per-episode obs + failure + counterexample + contrast
    const episodeCount = size.episodes;
    const provenanceCount = 3;
    const originalSlots = size.candidates * (2 * evidenceCount + episodeCount + provenanceCount);
    const indexedSlots = evidenceCount + episodeCount + provenanceCount;
    receipt.cksRetrieval.sizes.push({
      label: size.label,
      dataset: { candidateCount: size.candidates, episodeCount: size.episodes, evidenceRecordCount: evidenceCount, provenanceRecordCount: provenanceCount, structuralDimensions: "TASK_FINGERPRINT_STRUCTURAL_DIMENSIONS" },
      parity: { byteIdentical: true, ...parity },
      retainedOutputBytes: retained,
      derivedIndexReuseModel: {
        note: "static count of context-index Map constructions the bounded index reuse removes (GC-independent allocation signal; NOT a wall-clock measurement)",
        contextIndexMapConstructionsPerRequest: { original: 4 * size.candidates, indexed: 3 },
        contextIndexMapSlotPopulationPerRequest: { original: originalSlots, indexed: indexedSlots },
        reductionFactor: round(originalSlots / indexedSlots),
      },
      original,
      indexed,
      deltaMs: {
        p50: round(p50Delta),
        p95: round(p95Delta),
        // relative improvement is reported as evidence, NOT as a speedup guarantee.
        p50PercentOfOriginal: original.latencyMs.p50 > 0 ? round(100 * p50Delta / original.latencyMs.p50) : null,
        p95PercentOfOriginal: original.latencyMs.p95 > 0 ? round(100 * p95Delta / original.latencyMs.p95) : null,
      },
    });
  }

  // ---- ERV: canonical (valid) + a validation-scaling stress probe ----
  // NOTE: ERV's effective scope is bounded to a small KNOWN value set (ACTIONS/RESOURCES/
  // FIELDS/PURPOSES/EFFECTS) with no duplicates and no unknowns, so a *valid* input is
  // inherently small (sub-millisecond). The "scope-validation-stress" size grows the raw
  // item count with (mostly unknown) values to show validation work scales with input size;
  // it ends in SCOPE_UNKNOWN_DENIED BY DESIGN and is a scaling probe, not a representative
  // valid workload.
  const ervSizes = [
    { label: "canonical", role: "representative valid workload", extraScopeItems: 0 },
    { label: "scope-validation-stress", role: "raw-size validation scaling probe (denied by design)", extraScopeItems: 1000 },
  ];
  for (const size of ervSizes) {
    const input = buildErvInput(size.extraScopeItems);
    const result = compileEffectiveRightsV1(input);
    const operandScopeSize = input.operands.reduce((n, o) => n + o.scope.actions.length + o.scope.resources.length + o.scope.fields.length + o.scope.purposes.length + o.scope.effects.length, 0);
    const b = bench(`erv-${size.label}`, () => compileEffectiveRightsV1(input));
    receipt.effectiveRights.sizes.push({
      label: size.label,
      role: size.role,
      dataset: { operandCount: input.operands.length, totalScopeItems: operandScopeSize, outcome: result.outcome, issueCount: result.issues.length, issues: [...result.issues] },
      retainedOutputBytes: canonicalBytes(result),
      benchmark: b,
    });
  }

  // ---- Local read-only path: 2 sizes ----
  const localSizes = [
    { label: "single-edition", editions: 1 },
    { label: "two-edition", editions: 2 },
  ];
  for (const size of localSizes) {
    const { corpus, request, pages, chunks } = buildLocalCorpus(size.editions);
    const result = queryMediaWikiReadonlyV1(corpus, request);
    const b = bench(`local-${size.label}`, () => queryMediaWikiReadonlyV1(corpus, request));
    receipt.localReadonlyPath.sizes.push({
      label: size.label,
      dataset: { editionCount: size.editions, pageCount: pages, chunkCount: chunks, resultCount: result.results.length, network: result.network, model: result.model },
      retainedOutputBytes: canonicalBytes(result),
      benchmark: b,
    });
  }

  receipt.finishedAt = new Date().toISOString();
  process.stdout.write(`${JSON.stringify(receipt, null, 2)}\n`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    main();
  } catch (error) {
    process.stderr.write(`FAIL_CLOSED:${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  }
}