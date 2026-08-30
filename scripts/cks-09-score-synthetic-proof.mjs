#!/usr/bin/env node
import { readFileSync } from "node:fs";
import { resolve, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  cks09Digest,
  counterevidenceAssessmentDigestV1,
  diversityProofDigestV1,
  knowledgeBundleDigestV1,
  solutionPatternDigestV1,
  taskFamilyDigestV1,
  taskFingerprintDigestV1,
  versionConstraintDigestV1,
} from "../dist/packages/contracts/src/cks-task-fingerprint.js";
import { retrieveTaskToSuccessfulKnowledgeV1 } from "../dist/packages/cks/src/applicability-aware-retrieval.js";
import { evaluateShadowExperienceAblationV1 } from "../dist/packages/cks/src/shadow-experience-ablation.js";
import { evaluateP18V1, evaluateSolutionPatternCandidateV1 } from "../dist/packages/cks/src/solution-pattern-candidate-evaluator.js";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const SCHEMA_VERSION = "pansphaira.cks/synthetic-case/v1";
const BUNDLE = {
  bundleId: "bundle:baseline-001",
  contentRefs: [{ contentId: "content:normalizer", contentDigest: "sha256:" + "1".repeat(64), provenanceRef: "provenance:fixture-a" }],
  scopeIds: ["scope:synthetic"],
  versionVector: [{ componentId: "runtime:node", versionScheme: "OPAQUE_EXACT", exactValue: "node-24.14.1" }],
  provenanceRefs: ["provenance:fixture-a"],
};
BUNDLE.canonicalDigest = knowledgeBundleDigestV1(BUNDLE);

function digestChar(char) { return `sha256:${char.repeat(64)}`; }
function sorted(values) { return [...values].sort((left, right) => left.localeCompare(right)); }
function readJson(path) { return JSON.parse(readFileSync(path, "utf8")); }
function fail(message) { throw new Error(message); }
function expect(condition, message) { if (!condition) fail(message); }

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

function provenance(id, rootChar) {
  return {
    provenanceId: id,
    sourceKind: "synthetic-fixture",
    sourceLocator: `fixture/${id}`,
    rootDigest: digestChar(rootChar),
    parentDigests: [],
    producerId: "producer:cks09",
    toolchainVersionVector: [],
    sealed: true,
  };
}

function evidence(id, taskFingerprintDigest, outcomeDigest, kind = "OBSERVATION", provenanceRef = "provenance:fixture-a") {
  return { evidenceId: id, kind, sourceDigest: digestChar("a"), taskFingerprintDigest, outcomeDigest, provenanceRef };
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

function buildContext(profile = "stable") {
  const stableEpisodes = [
    fingerprint("task:episode-001", "shape:document", "context:batch"),
    fingerprint("task:episode-002", "shape:document-alt", "context:interactive"),
    fingerprint("task:episode-003", "shape:document-other", "context:batch"),
  ];
  const episodes = profile === "frequency-only"
    ? [stableEpisodes[0], { ...stableEpisodes[0], fingerprintId: "task:episode-002" }, stableEpisodes[1]]
    : profile === "narrow-context"
      ? [
        fingerprint("task:episode-001", "shape:document", "context:batch"),
        fingerprint("task:episode-002", "shape:document-alt", "context:batch"),
        fingerprint("task:episode-003", "shape:document-other", "context:batch"),
      ]
      : stableEpisodes;
  const outcome = digestChar("d");
  const failureTask = fingerprint("task:failure-001", "shape:document-failure");
  const counterexampleTask = fingerprint("task:counterexample-001", "shape:other");
  const evidenceRecords = [
    evidence("evidence:family-001", episodes[0].canonicalDigest, outcome, "OBSERVATION", "provenance:fixture-a"),
    evidence("evidence:obs-001", episodes[0].canonicalDigest, outcome, "OBSERVATION", "provenance:fixture-a"),
    evidence("evidence:obs-002", episodes[1].canonicalDigest, outcome, "OBSERVATION", "provenance:fixture-b"),
    evidence("evidence:obs-003", episodes[2].canonicalDigest, outcome, "OBSERVATION", "provenance:fixture-c"),
    evidence("evidence:contrast-001", episodes[0].canonicalDigest, outcome, "CONTRAST_PAIR", "provenance:fixture-a"),
    evidence("evidence:failure-001", failureTask.canonicalDigest, digestChar("f"), "KNOWN_FAILURE", "provenance:fixture-a"),
    evidence("evidence:counterexample-001", counterexampleTask.canonicalDigest, digestChar("f"), "COUNTEREXAMPLE", "provenance:fixture-b"),
  ];
  const provenanceRecords = [provenance("provenance:fixture-a", "1"), provenance("provenance:fixture-b", "2"), provenance("provenance:fixture-c", "3")];
  const constraintUnsigned = {
    constraintId: "constraint:node-exact",
    componentId: "runtime:node",
    versionScheme: "OPAQUE_EXACT",
    allowedExactValues: ["node-24.14.1"],
    evidenceRefs: ["evidence:obs-001"],
  };
  const versionConstraint = { ...constraintUnsigned, canonicalDigest: versionConstraintDigestV1(constraintUnsigned) };
  const dependency = {
    dependencyId: "dependency:parser",
    kind: "TOOL",
    requiredStateDigest: digestChar("e"),
    versionConstraintRef: versionConstraint.constraintId,
    verificationEvidenceRef: "evidence:obs-001",
  };
  const failure = {
    failureId: "failure:known-001",
    patternId: "pattern:normalize-document",
    taskFingerprintDigest: failureTask.canonicalDigest,
    expectedOutcomeDigest: outcome,
    observedOutcomeDigest: digestChar("f"),
    evidenceRef: "evidence:failure-001",
    provenanceRef: "provenance:fixture-a",
    resolution: "BOUNDED_BY_PRECONDITION",
  };
  const counterexample = {
    counterexampleId: "counterexample:similar-001",
    patternId: "pattern:normalize-document",
    taskFingerprintDigest: counterexampleTask.canonicalDigest,
    matchedSimilarityFacts: ["objectiveShapeId=shape:normalize"],
    blockingStructuralDimension: "inputShapeId",
    expectedDenialReason: "MATCHED_COUNTEREXAMPLE",
    evidenceRef: "evidence:counterexample-001",
    provenanceRef: "provenance:fixture-b",
  };
  const assessmentUnsigned = {
    assessmentId: "assessment:search-001",
    searchEvidenceRefs: ["evidence:obs-002"],
    knownFailureRefs: [failure.failureId],
    counterexampleRefs: [counterexample.counterexampleId],
    negativeControlRefs: ["evidence:contrast-001"],
    coverageStatus: "COMPLETE",
  };
  const assessment = { ...assessmentUnsigned, canonicalDigest: counterevidenceAssessmentDigestV1(assessmentUnsigned) };
  const proofUnsigned = {
    proofId: "proof:stable-001",
    patternId: "pattern:normalize-document",
    independentEpisodeRefs: ["evidence:obs-001", "evidence:obs-002", "evidence:obs-003"],
    taskVariantIds: episodes.map((item) => item.fingerprintId).sort(),
    contextShapeIds: [...new Set(episodes.map((item) => item.contextShapeId))].sort(),
    coveredVariantAxes: ["contextShapeId", "inputShapeId"],
    contrastPairRefs: profile === "correlation" ? [] : ["evidence:contrast-001"],
    provenanceRefs: ["provenance:fixture-a", "provenance:fixture-b", "provenance:fixture-c"],
  };
  const proof = { ...proofUnsigned, canonicalDigest: diversityProofDigestV1(proofUnsigned) };
  return {
    families: [family()],
    evidence: evidenceRecords,
    provenance: provenanceRecords,
    dependencies: [dependency],
    versionConstraints: [versionConstraint],
    knownFailures: [failure],
    counterexamples: [counterexample],
    assessments: [assessment],
    diversityProofs: [proof],
    episodes,
    holdoutEpisodeDigests: [],
    dependencyStateDigests: new Map([[dependency.dependencyId, dependency.requiredStateDigest]]),
  };
}

function taskFor(profile) {
  if (profile === "similar-looking") return fingerprint("task:similar-looking", "shape:document", "context:batch", "node-24.14.1", "REVERSIBLE_LOCAL");
  if (profile === "version-drift") return fingerprint("task:version-drift", "shape:document", "context:batch", "node-24.15.0");
  if (profile === "missing-context") return fingerprint("task:missing-context");
  return fingerprint("task:holdout-request");
}

function contextAndCandidate(profile = "stable") {
  const context = buildContext(profile === "missing-context" ? "stable" : profile);
  const pattern = profile === "missing-context"
    ? makePattern({ applicabilityClauses: [{ factPath: "/missingFact", operator: "EQ", operand: "value" }] })
    : makePattern();
  const candidate = { pattern, knowledgeBundle: BUNDLE };
  return { context, pattern, candidate };
}

function hydrateP17(fixture, groundTruth = readJson(join(ROOT, "tests/fixtures/cks-09/holdout-ground-truth-v1.json"))) {
  expect(fixture.schemaVersion === SCHEMA_VERSION && fixture.fixtureKind === "P17_HOLDOUT", "invalid P17 fixture header");
  return {
    schemaVersion: "pansphaira.cks/shadow-replay/v1",
    evidenceAdmission: fixture.evidenceAdmission,
    requiredEvidencePresent: fixture.requiredEvidencePresent,
    holdoutSealed: fixture.holdoutSealed,
    replayMode: fixture.replayMode,
    externalStateChanged: fixture.externalStateChanged,
    modelsOrServicesCalled: fixture.modelsOrServicesCalled,
    procedureContentReturned: fixture.procedureContentReturned,
    groundTruth: groundTruth.p17,
    cases: fixture.cases.map((item) => {
      const built = contextAndCandidate(item.profile);
      return {
        caseId: item.caseId,
        holdoutVariantId: item.holdoutVariantId,
        knowledgeBundleDigest: BUNDLE.canonicalDigest,
        task: fingerprint(`task:${item.holdoutVariantId.slice("holdout:".length)}`),
        candidates: [built.candidate],
        context: built.context,
      };
    }),
  };
}

function runP18(fixture) {
  expect(fixture.schemaVersion === SCHEMA_VERSION && fixture.fixtureKind === "P18_PATTERN_TRAPS", "invalid P18 fixture header");
  const cases = fixture.cases.map((item) => {
    const built = contextAndCandidate(item.profile === "stable" ? "stable" : item.profile);
    return {
      caseId: item.caseId,
      fixtureClass: item.fixtureClass,
      request: { pattern: built.pattern, context: built.context, task: fingerprint(`task:${item.caseId}`), knowledgeBundle: BUNDLE },
    };
  });
  return evaluateP18V1({ cases });
}

function runReuseBoundaries(fixture) {
  const stable = contextAndCandidate("stable");
  return fixture.reuseBoundaries.map((expected) => {
    const task = taskFor(expected.profile);
    const boundary = expected.profile === "missing-context" ? contextAndCandidate("missing-context") : stable;
    const candidate = expected.profile === "missing-evidence"
      ? { ...boundary.candidate, successfulEvidenceRefs: [] }
      : boundary.candidate;
    const result = retrieveTaskToSuccessfulKnowledgeV1({
      task,
      candidates: [candidate],
      context: boundary.context,
      arm: "KNOWLEDGE_PLUS_EXPERIENCE",
      replayMode: "SHADOW",
    });
    const reason = result.reports[0]?.reason ?? result.denialReasons[0];
    expect(result.outcome === "DENIED" && reason === expected.expectedReason, `${expected.caseId}: expected ${expected.expectedReason}, got ${reason ?? result.outcome}`);
    return { caseId: expected.caseId, outcome: result.outcome, reason };
  });
}

function runFailureClosedChecks(p17Fixture, groundTruth) {
  const base = hydrateP17(p17Fixture, groundTruth);
  const checks = [];
  const deniedEvidence = evaluateShadowExperienceAblationV1({ ...base, requiredEvidencePresent: false });
  expect(deniedEvidence.verdict === "INCONCLUSIVE" && deniedEvidence.reasons.includes("MISSING_288_DIGEST"), "missing admitted evidence did not fail closed");
  checks.push({ caseId: "missing-admitted-evidence", verdict: deniedEvidence.verdict, reason: deniedEvidence.reasons[0] });
  const unsealed = evaluateShadowExperienceAblationV1({ ...base, holdoutSealed: false });
  expect(unsealed.verdict === "INCONCLUSIVE" && unsealed.reasons.includes("UNSEALED_HOLDOUT"), "unsealed holdout did not fail closed");
  checks.push({ caseId: "unsealed-holdout", verdict: unsealed.verdict, reason: unsealed.reasons[0] });
  const live = evaluateShadowExperienceAblationV1({ ...base, externalStateChanged: true });
  expect(live.verdict === "DENIED" && live.reasons.includes("LIVE_REPLAY_FORBIDDEN"), "live replay flag did not fail closed");
  checks.push({ caseId: "live-replay", verdict: live.verdict, reason: live.reasons[0] });
  const leaked = structuredClone(base);
  leaked.cases[0].holdoutVariantId = "holdout:wrong-split";
  const leakage = evaluateShadowExperienceAblationV1(leaked);
  expect(leakage.reasons.includes("HOLDOUT_LEAKAGE"), "holdout leakage did not fail closed");
  checks.push({ caseId: "holdout-leakage", verdict: leakage.verdict, reason: "HOLDOUT_LEAKAGE" });
  const built = contextAndCandidate("stable");
  const prose = evaluateSolutionPatternCandidateV1({ pattern: { patternId: "pattern:prose", procedure: "run this" }, context: built.context });
  expect(prose.verdict === "DENIED" && prose.reason === "PROSE_ONLY_INPUT" && !Object.hasOwn(prose, "procedure"), "prose input did not fail closed");
  checks.push({ caseId: "prose-input", verdict: prose.verdict, reason: prose.reason });
  return checks;
}

function score(fixturePath) {
  const holdout = readJson(fixturePath);
  const traps = readJson(join(ROOT, "tests/fixtures/cks-09/pattern-trap-cases-v1.json"));
  const groundTruth = readJson(join(ROOT, "tests/fixtures/cks-09/holdout-ground-truth-v1.json"));
  expect(holdout.fixtureKind === "P17_HOLDOUT", "--fixture must point to the P17 holdout fixture");
  const p17 = evaluateShadowExperienceAblationV1(hydrateP17(holdout, groundTruth));
  expect(p17.verdict === "PASS", `P17 verdict was ${p17.verdict}: ${p17.reasons.join(",")}`);
  expect((p17.aggregate?.qualityDelta ?? 0) > 0, "P17 quality did not improve");
  expect((p17.aggregate?.costReduction ?? 0) > 0, "P17 cost did not reduce");
  expect((p17.aggregate?.efficiencyDelta ?? 0) > 0, "P17 efficiency did not improve");
  expect(p17.mode === "SIMULATION_OR_SHADOW_ONLY" && p17.externalStateChanged === false && p17.modelsOrServicesCalled === false && p17.procedureContentReturned === false, "P17 exceeded shadow-only boundary");
  const p18 = runP18(traps);
  expect(p18.verdict === "PASS", `P18 verdict was ${p18.verdict}: ${p18.reasons.join(",")}`);
  expect(p18.acceptedPatternIds.length === 1 && p18.acceptedPatternIds[0] === "pattern:normalize-document", "P18 stable candidate was not uniquely identified");
  expect(p18.deniedCaseIds.length === 3, "P18 did not deny every trap");
  const boundaries = runReuseBoundaries(traps);
  const closed = runFailureClosedChecks(holdout, groundTruth);
  const result = {
    schemaVersion: "pansphaira.cks/synthetic-proof-receipt/v1",
    taskId: groundTruth.taskId,
    scope: "ADMITTED_SYNTHETIC_SEALED_HOLDOUT_ONLY",
    verdict: "PASS",
    p17,
    p18,
    reuseBoundaries: boundaries,
    failureClosedChecks: closed,
    preservation: {
      dependencyRefs: ["dependency:parser"],
      knownFailureRefs: ["failure:known-001"],
      counterexampleRefs: ["counterexample:similar-001"],
      provenanceRefs: ["provenance:fixture-a", "provenance:fixture-b", "provenance:fixture-c"],
      counterevidenceCoverage: "COMPLETE",
    },
    nonClaims: groundTruth.nonClaims,
  };
  return result;
}

function main() {
  const fixtureIndex = process.argv.indexOf("--fixture");
  const fixturePath = fixtureIndex >= 0 ? process.argv[fixtureIndex + 1] : undefined;
  if (fixturePath === undefined || process.argv.includes("--help")) {
    process.stdout.write("Usage: node scripts/cks-09-score-synthetic-proof.mjs --fixture <holdout-cases-v1.json> [--dry-run]\n");
    process.exitCode = fixturePath === undefined ? 2 : 0;
    return;
  }
  try {
    process.stdout.write(`${JSON.stringify(score(resolve(fixturePath)), null, 2)}\n`);
  } catch (error) {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  }
}

if (process.argv[1] !== undefined && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();

export { buildContext, hydrateP17, runP18, score };
