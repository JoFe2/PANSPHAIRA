import { readFileSync } from "node:fs";
import test from "node:test";
import assert from "node:assert/strict";
import Ajv2020 from "ajv/dist/2020.js";
import {
  cks09Digest,
  counterevidenceAssessmentDigestV1,
  diversityProofDigestV1,
  evaluatePredicateV1,
  evaluateSolutionPatternV1,
  knowledgeBundleDigestV1,
  resolveTaskFamilyV1,
  solutionPatternDigestV1,
  taskFamilyDigestV1,
  taskFingerprintDigestV1,
  validateCounterevidenceAssessmentV1,
  validateDiversityProofV1,
  validateKnowledgeBundleV1,
  validateSolutionPatternTransitionV1,
  validateSolutionPatternV1,
  validateTaskFamilyV1,
  validateTaskFingerprintV1,
  type CounterevidenceAssessmentV1,
  type CounterexampleRecordV1,
  type DependencyRecordV1,
  type DiversityProofV1,
  type EvidenceRecordV1,
  type KnowledgeBundleV1,
  type KnownFailureRecordV1,
  type ProvenanceRecordV1,
  type SolutionPatternV1,
  type TaskFamilyV1,
  type TaskFingerprintV1,
  type VersionConstraintV1,
} from "../packages/contracts/src/cks-task-fingerprint.js";

const validFixture = JSON.parse(readFileSync("tests/fixtures/cks-09/contracts-valid-v1.json", "utf8")) as Record<string, unknown>;
const invalidFixture = JSON.parse(readFileSync("tests/fixtures/cks-09/contracts-invalid-v1.json", "utf8")) as Record<string, unknown>;

function digestChar(char: string): string {
  return `sha256:${char.repeat(64)}`;
}

function fingerprint(id: string, contextShapeId: string, inputShapeId: string, version = "node-24.14.1", effectClass: TaskFingerprintV1["effectClass"] = "READ_ONLY", objectiveShapeId = "shape:normalize"): TaskFingerprintV1 {
  const unsigned = {
    fingerprintId: id,
    taskFamilyId: "family:document-transform",
    objectiveShapeId,
    inputShapeId,
    outputShapeId: "shape:normalized",
    contextShapeId,
    constraintIds: ["constraint:safety"],
    effectClass,
    dependencyIds: ["dependency:parser"],
    versionVector: [{ componentId: "runtime:node", versionScheme: "OPAQUE_EXACT" as const, exactValue: version }],
  };
  return { ...unsigned, canonicalDigest: taskFingerprintDigestV1(unsigned) };
}

function family(exclusionClauses: TaskFamilyV1["exclusionClauses"] = [{ factPath: "/effectClass", operator: "EQ", operand: "EXTERNAL_OR_IRREVERSIBLE" }]): TaskFamilyV1 {
  const unsigned = {
    familyId: "family:document-transform",
    membershipClauses: [{ factPath: "/objectiveShapeId", operator: "EQ" as const, operand: "shape:normalize" }],
    invariantIds: ["invariant:normalized-output"],
    variantAxes: ["contextShapeId", "inputShapeId"] as const,
    exclusionClauses,
    evidenceRefs: ["evidence:family-001"],
    provenanceRefs: ["provenance:fixture-a"],
  };
  return { ...unsigned, canonicalDigest: taskFamilyDigestV1(unsigned) };
}

function evidence(id: string, taskFingerprintDigest: string, kind: EvidenceRecordV1["kind"] = "OBSERVATION", provenanceRef = "provenance:fixture-a"): EvidenceRecordV1 {
  return { evidenceId: id, kind, sourceDigest: digestChar("a"), taskFingerprintDigest, outcomeDigest: digestChar("b"), provenanceRef };
}

function provenance(id: string, rootChar: string, sealed = true): ProvenanceRecordV1 {
  return { provenanceId: id, sourceKind: "synthetic-fixture", sourceLocator: `fixture/${id}`, rootDigest: digestChar(rootChar), parentDigests: [], producerId: "producer:cks09", toolchainVersionVector: [], sealed };
}

function diversityProof(patternId: string, episodes: readonly TaskFingerprintV1[], evidenceRefs: readonly string[], provenanceRefs: readonly string[], contextShapeIds: readonly string[], axes: DiversityProofV1["coveredVariantAxes"] = ["contextShapeId", "inputShapeId"]): DiversityProofV1 {
  const unsigned = { proofId: "proof:stable-001", patternId, independentEpisodeRefs: evidenceRefs, taskVariantIds: episodes.map((item) => item.fingerprintId).sort(), contextShapeIds, coveredVariantAxes: axes, contrastPairRefs: ["evidence:contrast-001"], provenanceRefs };
  return { ...unsigned, canonicalDigest: diversityProofDigestV1(unsigned) };
}

function evaluationPattern(): SolutionPatternV1 {
  const unsigned = {
    patternId: "pattern:normalize-document",
    maturity: "S4" as const,
    taskFamilyIds: ["family:document-transform"],
    applicabilityClauses: [{ factPath: "/objectiveShapeId", operator: "EQ" as const, operand: "shape:normalize" }],
    preconditions: [{ factPath: "/effectClass", operator: "EQ" as const, operand: "READ_ONLY" }],
    procedureDigest: digestChar("c"),
    expectedOutcomeDigest: digestChar("d"),
    dependencyRefs: ["dependency:parser"],
    evidenceRefs: ["evidence:obs-001"],
    provenanceRefs: ["provenance:fixture-a"],
    knownFailureRefs: [],
    counterexampleRefs: [],
    counterevidenceAssessmentRef: "assessment:search-001",
    versionConstraintRefs: ["constraint:node-exact"],
  };
  return { ...unsigned, canonicalDigest: solutionPatternDigestV1(unsigned) };
}

test("contract fixtures are closed, digest-bound and schema-compatible", () => {
  const schemaCases = [
    ["cks-task-fingerprint-v1.schema.json", "taskFingerprint"],
    ["cks-task-family-v1.schema.json", "taskFamily"],
    ["cks-knowledge-bundle-v1.schema.json", "knowledgeBundle"],
    ["cks-solution-pattern-candidate-v1.schema.json", "solutionPatternCandidate"],
  ] as const;
  for (const [file, key] of schemaCases) {
    const schema = JSON.parse(readFileSync(`schemas/contracts/${file}`, "utf8"));
    const validate = new Ajv2020({ allErrors: true, strict: true }).compile(schema);
    assert.equal(validate(validFixture[key]), true, `${file}: ${JSON.stringify(validate.errors)}`);
    assert.equal(validate(invalidFixture[key]), false, `${file} accepted the invalid fixture`);
  }
  assert.deepEqual(validateTaskFingerprintV1(validFixture.taskFingerprint), []);
  assert.deepEqual(validateTaskFamilyV1(validFixture.taskFamily), []);
  assert.deepEqual(validateKnowledgeBundleV1(validFixture.knowledgeBundle), []);
  assert.deepEqual(validateSolutionPatternV1(validFixture.solutionPatternCandidate), []);
  assert.notDeepEqual(validateTaskFingerprintV1(invalidFixture.taskFingerprint), []);
  assert.notDeepEqual(validateTaskFamilyV1(invalidFixture.taskFamily), []);
  assert.notDeepEqual(validateKnowledgeBundleV1(invalidFixture.knowledgeBundle), []);
  assert.notDeepEqual(validateSolutionPatternV1(invalidFixture.solutionPatternCandidate), []);
  assert.deepEqual(
    validateTaskFingerprintV1({ ...(validFixture.taskFingerprint as object), canonicalDigest: digestChar("0") }),
    ["PROSE_ONLY_INPUT"],
    "runtime validation must reject a well-formed but structurally incorrect digest",
  );
  const orphanedContentUnsigned = {
    ...(validFixture.knowledgeBundle as KnowledgeBundleV1),
    contentRefs: [{ ...((validFixture.knowledgeBundle as KnowledgeBundleV1).contentRefs[0]!), provenanceRef: "provenance:missing" }],
  };
  assert.deepEqual(
    validateKnowledgeBundleV1({ ...orphanedContentUnsigned, canonicalDigest: knowledgeBundleDigestV1(orphanedContentUnsigned) }),
    ["INVALID_KNOWLEDGE_BUNDLE"],
  );
});

test("predicates are typed and three-valued; missing facts never become applicable", () => {
  const facts = { objectiveShapeId: "shape:normalize", constraintIds: ["constraint:safety"] };
  assert.deepEqual(evaluatePredicateV1({ factPath: "/objectiveShapeId", operator: "EQ", operand: "shape:normalize" }, facts), { truth: "TRUE" });
  assert.deepEqual(evaluatePredicateV1({ factPath: "/missing", operator: "EQ", operand: "anything" }, facts), { truth: "UNKNOWN", reason: "MISSING_FACT" });
  assert.deepEqual(evaluatePredicateV1({ factPath: "/constraintIds", operator: "SET_CONTAINS_ALL", operand: ["constraint:safety"] }, facts), { truth: "TRUE" });
  assert.equal(validateTaskFamilyV1({ ...(validFixture.taskFamily as object), membershipClauses: [{ factPath: "/objectiveShapeId", operator: "EQ", operand: { raw: "private payload" } }] }).length > 0, true);
  const nestedOperandFamily = { ...(validFixture.taskFamily as TaskFamilyV1), membershipClauses: [{ factPath: "/constraintIds", operator: "EQ", operand: [["constraint:safety"]] }] };
  assert.equal(validateTaskFamilyV1({ ...nestedOperandFamily, canonicalDigest: taskFamilyDigestV1(nestedOperandFamily) }).length > 0, true);
});

test("P18 diversity proof accepts a planted stable shape and rejects traps", () => {
  const stableEpisodes = [fingerprint("task:fp-001", "context:batch", "shape:document"), fingerprint("task:fp-002", "context:interactive", "shape:document-alt"), fingerprint("task:fp-003", "context:batch", "shape:document-alt")];
  const stableEvidence = [evidence("evidence:obs-001", stableEpisodes[0]!.canonicalDigest), evidence("evidence:obs-002", stableEpisodes[1]!.canonicalDigest, "OBSERVATION", "provenance:fixture-b"), evidence("evidence:obs-003", stableEpisodes[2]!.canonicalDigest, "OBSERVATION", "provenance:fixture-c"), evidence("evidence:contrast-001", stableEpisodes[0]!.canonicalDigest, "CONTRAST_PAIR")];
  const stableProvenance = [provenance("provenance:fixture-a", "1"), provenance("provenance:fixture-b", "2"), provenance("provenance:fixture-c", "3")];
  const context = { evidence: stableEvidence, provenance: stableProvenance, families: [family()], episodes: stableEpisodes, holdoutEpisodeDigests: [] };
  const proof = diversityProof("pattern:normalize-document", stableEpisodes, ["evidence:obs-001", "evidence:obs-002", "evidence:obs-003"], ["provenance:fixture-a", "provenance:fixture-b", "provenance:fixture-c"], ["context:batch", "context:interactive"]);
  assert.deepEqual(validateDiversityProofV1(proof, context), []);

  const duplicateEpisodes = [stableEpisodes[0]!, { ...stableEpisodes[0]!, fingerprintId: "task:fp-004" }, stableEpisodes[1]!];
  const duplicateEvidence = [evidence("evidence:obs-001", duplicateEpisodes[0]!.canonicalDigest), evidence("evidence:obs-002", duplicateEpisodes[1]!.canonicalDigest, "OBSERVATION", "provenance:fixture-b"), evidence("evidence:obs-003", duplicateEpisodes[2]!.canonicalDigest, "OBSERVATION", "provenance:fixture-c")];
  const duplicateProof = diversityProof("pattern:frequency-trap", duplicateEpisodes, ["evidence:obs-001", "evidence:obs-002", "evidence:obs-003"], ["provenance:fixture-a", "provenance:fixture-b", "provenance:fixture-c"], ["context:batch", "context:interactive"]);
  assert.ok(validateDiversityProofV1(duplicateProof, { ...context, evidence: duplicateEvidence, episodes: duplicateEpisodes }).includes("INVALID_DIVERSITY_PROOF"));

  const narrowEpisodes = [fingerprint("task:narrow-001", "context:batch", "shape:document"), fingerprint("task:narrow-002", "context:batch", "shape:document"), fingerprint("task:narrow-003", "context:batch", "shape:document")];
  const narrowEvidence = narrowEpisodes.map((item, index) => evidence(`evidence:narrow-00${index + 1}`, item.canonicalDigest, "OBSERVATION", `provenance:fixture-${String.fromCharCode(97 + index)}`));
  const narrowProof = diversityProof("pattern:narrow-trap", narrowEpisodes, narrowEvidence.map((item) => item.evidenceId), ["provenance:fixture-a", "provenance:fixture-b", "provenance:fixture-c"], ["context:batch"]);
  assert.ok(validateDiversityProofV1(narrowProof, { ...context, evidence: narrowEvidence, episodes: narrowEpisodes }).includes("INVALID_DIVERSITY_PROOF"));

  const correlationProof = { ...proof, patternId: "pattern:correlation-trap", contrastPairRefs: [], canonicalDigest: "sha256:" + "0".repeat(64) };
  assert.ok(validateDiversityProofV1(correlationProof, context).includes("INVALID_DIVERSITY_PROOF"));
});

test("applicability denies similar tasks, precondition failures and exact version drift", () => {
  const stable = fingerprint("task:fp-001", "context:batch", "shape:document");
  const episodes = [
    stable,
    fingerprint("task:fp-002", "context:interactive", "shape:document-alt"),
    fingerprint("task:fp-003", "context:batch", "shape:document-other"),
  ];
  const familyRecord = family();
  const evidenceRecords = [
    evidence("evidence:obs-001", episodes[0]!.canonicalDigest),
    evidence("evidence:obs-002", episodes[1]!.canonicalDigest, "OBSERVATION", "provenance:fixture-b"),
    evidence("evidence:obs-003", episodes[2]!.canonicalDigest, "OBSERVATION", "provenance:fixture-c"),
    evidence("evidence:contrast-001", episodes[0]!.canonicalDigest, "CONTRAST_PAIR"),
  ];
  const provenanceRecords = [provenance("provenance:fixture-a", "1"), provenance("provenance:fixture-b", "2"), provenance("provenance:fixture-c", "3")];
  const constraintUnsigned = { constraintId: "constraint:node-exact", componentId: "runtime:node", versionScheme: "OPAQUE_EXACT" as const, allowedExactValues: ["node-24.14.1"], evidenceRefs: ["evidence:obs-001"] };
  const versionConstraint: VersionConstraintV1 = { ...constraintUnsigned, canonicalDigest: cks09Digest(constraintUnsigned) };
  const dependency: DependencyRecordV1 = { dependencyId: "dependency:parser", kind: "TOOL", requiredStateDigest: digestChar("e"), versionConstraintRef: versionConstraint.constraintId, verificationEvidenceRef: "evidence:obs-001" };
  const assessmentUnsigned = { assessmentId: "assessment:search-001", searchEvidenceRefs: ["evidence:obs-002"], knownFailureRefs: [], counterexampleRefs: [], negativeControlRefs: ["evidence:obs-003"], coverageStatus: "COMPLETE" as const };
  const assessment: CounterevidenceAssessmentV1 = { ...assessmentUnsigned, canonicalDigest: counterevidenceAssessmentDigestV1(assessmentUnsigned) };
  const pattern = evaluationPattern();
  const proof = diversityProof(pattern.patternId, episodes, ["evidence:obs-001", "evidence:obs-002", "evidence:obs-003"], ["provenance:fixture-a", "provenance:fixture-b", "provenance:fixture-c"], ["context:batch", "context:interactive"]);
  const baseContext = { families: [familyRecord], evidence: evidenceRecords, provenance: provenanceRecords, dependencies: [dependency], versionConstraints: [versionConstraint], knownFailures: [] as KnownFailureRecordV1[], counterexamples: [] as CounterexampleRecordV1[], assessments: [assessment], diversityProofs: [proof], episodes, holdoutEpisodeDigests: [], dependencyStateDigests: new Map([[dependency.dependencyId, dependency.requiredStateDigest]]) };
  assert.deepEqual(evaluateSolutionPatternV1(pattern, stable, baseContext), { result: "APPLICABLE_SHADOW_ONLY", patternId: pattern.patternId });
  const unconstrainedPattern = { ...pattern, versionConstraintRefs: [] as string[] };
  unconstrainedPattern.canonicalDigest = solutionPatternDigestV1(unconstrainedPattern);
  assert.equal(evaluateSolutionPatternV1(unconstrainedPattern, stable, baseContext).reason, "VERSION_UNKNOWN");
  assert.equal(evaluateSolutionPatternV1(pattern, fingerprint("task:drift-001", "context:batch", "shape:document", "node-24.15.0"), baseContext).reason, "VERSION_INCOMPATIBLE");
  const missingVersion = { ...fingerprint("task:drift-unknown", "context:batch", "shape:document"), versionVector: [] };
  missingVersion.canonicalDigest = taskFingerprintDigestV1(missingVersion);
  assert.equal(evaluateSolutionPatternV1(pattern, missingVersion, baseContext).reason, "VERSION_UNKNOWN");
  const unlistedVersion = {
    ...stable,
    versionVector: [
      ...stable.versionVector,
      { componentId: "runtime:parser", versionScheme: "OPAQUE_EXACT" as const, exactValue: "parser-1.0.0" },
    ],
  };
  unlistedVersion.canonicalDigest = taskFingerprintDigestV1(unlistedVersion);
  assert.equal(evaluateSolutionPatternV1(pattern, unlistedVersion, baseContext).reason, "VERSION_UNKNOWN");
  assert.equal(evaluateSolutionPatternV1(pattern, fingerprint("task:similar-001", "context:batch", "shape:document", "node-24.14.1", "REVERSIBLE_LOCAL"), baseContext).reason, "PRECONDITION_FALSE");
  assert.equal(evaluateSolutionPatternV1(pattern, fingerprint("task:inapplicable-001", "context:batch", "shape:other", "node-24.14.1", "READ_ONLY", "shape:other"), baseContext).reason, "AMBIGUOUS_TASK_FAMILY");
  const mislabeledFamily = { ...stable, fingerprintId: "task:family-mismatch", taskFamilyId: "family:other" };
  mislabeledFamily.canonicalDigest = taskFingerprintDigestV1(mislabeledFamily);
  assert.equal(evaluateSolutionPatternV1(pattern, mislabeledFamily, baseContext).reason, "AMBIGUOUS_TASK_FAMILY");
  const correlationTrap = { ...proof, contrastPairRefs: [] };
  correlationTrap.canonicalDigest = diversityProofDigestV1(correlationTrap);
  assert.equal(evaluateSolutionPatternV1(pattern, stable, { ...baseContext, diversityProofs: [correlationTrap] }).reason, "INVALID_DIVERSITY_PROOF");
  const failureEvidence = evidence("evidence:failure-001", episodes[1]!.canonicalDigest, "KNOWN_FAILURE");
  const invalidatingFailure: KnownFailureRecordV1 = {
    failureId: "failure:known-001",
    patternId: pattern.patternId,
    taskFingerprintDigest: episodes[1]!.canonicalDigest,
    expectedOutcomeDigest: pattern.expectedOutcomeDigest,
    observedOutcomeDigest: digestChar("f"),
    evidenceRef: failureEvidence.evidenceId,
    provenanceRef: failureEvidence.provenanceRef,
    resolution: "INVALIDATES_PATTERN",
  };
  const patternWithFailure = { ...pattern, knownFailureRefs: [invalidatingFailure.failureId] };
  patternWithFailure.canonicalDigest = solutionPatternDigestV1(patternWithFailure);
  assert.equal(evaluateSolutionPatternV1(patternWithFailure, stable, { ...baseContext, evidence: [...evidenceRecords, failureEvidence], knownFailures: [invalidatingFailure] }).reason, "UNRESOLVED_FAILURE");
  const foreignEvidencePattern = { ...pattern, evidenceRefs: ["evidence:obs-002"] };
  foreignEvidencePattern.canonicalDigest = solutionPatternDigestV1(foreignEvidencePattern);
  assert.equal(evaluateSolutionPatternV1(foreignEvidencePattern, stable, baseContext).reason, "INVALID_PROVENANCE");
  assert.equal(evaluateSolutionPatternV1({ ...pattern, maturity: "S2", canonicalDigest: solutionPatternDigestV1({ ...pattern, maturity: "S2", canonicalDigest: undefined }) }, stable, baseContext).reason, "INSUFFICIENT_MATURITY");
});

test("candidate transitions retain failure, counterexample, dependency, evidence and provenance references", () => {
  const fixturePattern = validFixture.solutionPatternCandidate as SolutionPatternV1;
  const previousUnsigned = {
    ...fixturePattern,
    dependencyRefs: ["dependency:parser", "dependency:renderer"],
    evidenceRefs: ["evidence:obs-001", "evidence:obs-002"],
    provenanceRefs: ["provenance:fixture-a", "provenance:fixture-b"],
    knownFailureRefs: ["failure:known-001", "failure:known-002"],
    counterexampleRefs: ["counterexample:similar-001", "counterexample:similar-002"],
    versionConstraintRefs: ["constraint:node-exact", "constraint:parser-exact"],
  };
  const previous = { ...previousUnsigned, canonicalDigest: solutionPatternDigestV1(previousUnsigned) };
  const nextUnsigned = { ...previous, evidenceRefs: [...previous.evidenceRefs, "evidence:obs-003"] };
  const next = { ...nextUnsigned, canonicalDigest: solutionPatternDigestV1({ ...nextUnsigned, canonicalDigest: undefined }) };
  assert.deepEqual(validateSolutionPatternTransitionV1(previous, next), []);
  for (const field of ["dependencyRefs", "evidenceRefs", "provenanceRefs", "knownFailureRefs", "counterexampleRefs", "versionConstraintRefs"] as const) {
    const droppedUnsigned = { ...next, [field]: next[field].slice(1) };
    const dropped = { ...droppedUnsigned, canonicalDigest: solutionPatternDigestV1(droppedUnsigned) };
    assert.deepEqual(validateSolutionPatternTransitionV1(previous, dropped), ["PROSE_ONLY_INPUT"], `${field} was not append-preserved`);
  }
  const changedAssessmentUnsigned = { ...next, counterevidenceAssessmentRef: "assessment:replacement-001" };
  const changedAssessment = { ...changedAssessmentUnsigned, canonicalDigest: solutionPatternDigestV1(changedAssessmentUnsigned) };
  assert.deepEqual(validateSolutionPatternTransitionV1(previous, changedAssessment), ["PROSE_ONLY_INPUT"]);
  const regressedUnsigned = { ...next, maturity: "S3" as const };
  const regressed = { ...regressedUnsigned, canonicalDigest: solutionPatternDigestV1(regressedUnsigned) };
  assert.deepEqual(validateSolutionPatternTransitionV1(previous, regressed), ["PROSE_ONLY_INPUT"]);
  assert.equal((validFixture.knowledgeBundle as KnowledgeBundleV1).canonicalDigest, knowledgeBundleDigestV1(validFixture.knowledgeBundle as Record<string, unknown>));
  assert.equal(resolveTaskFamilyV1(validFixture.taskFingerprint as TaskFingerprintV1, [validFixture.taskFamily as TaskFamilyV1]).result, "RESOLVED");
  assert.equal(validateCounterevidenceAssessmentV1({ ...(validFixture.solutionPatternCandidate as object) }).length > 0, true);
});
