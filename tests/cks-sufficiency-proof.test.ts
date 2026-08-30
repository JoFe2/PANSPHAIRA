import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import test from "node:test";
import Ajv2020 from "ajv/dist/2020.js";
import { canonicalJson } from "../packages/contracts/src/canonical-json.js";
import {
  analyzeForwardRequirementsV1,
  forwardRequirementFixtureDigestV1,
  type ForwardRequirementAnalysisInputV1,
} from "../packages/contracts/src/cks-requirement-analysis.js";
import {
  GAP_FINDER_RESULT_SCHEMA_V1,
  KNOWLEDGE_SUFFICIENCY_PROOF_INPUT_SCHEMA_V1,
  P13_A0_RETRIEVAL_RECEIPT_SCHEMA_V1,
  P13_FALSE_COMPLETENESS_PROOF_INPUT_SCHEMA_V1,
  SUFFICIENCY_AUTHORITY_BOUNDARY_V1,
  backwardClaimDigestV1,
  backwardClaimProofDigestV1,
  boundaryProbeDigestV1,
  gapFinderItemDigestV1,
  gapFinderResultDigestV1,
  p13A0RetrievalReceiptDigestV1,
  p13A0RetrievalReceiptSetDigestV1,
  p13FixtureDigestV1,
  p13RequirementKeyV1,
  proveKnowledgeSufficiencyV1,
  proveP13FalseCompletenessV1,
  requirementBindingsDigestV1,
  sufficiencyProofDigestV1,
  sufficiencyProofFixtureDigestV1,
  validateKnowledgeSufficiencyProofInputV1,
  validateKnowledgeSufficiencyProofV1,
  validateP13FalseCompletenessProofInputV1,
  validateP13FalseCompletenessProofV1,
  validateSeparateGapFinderResultV1,
  type KnowledgeSufficiencyProofInputV1,
  type P13A0RetrievalReceiptV1,
  type P13FalseCompletenessCaseV1,
  type SufficiencyBoundaryProbeV1,
  type SufficiencyGapClassV1,
  type SufficiencyRequirementOutcomeV1,
} from "../packages/contracts/src/cks-sufficiency-proof.js";

const positiveFixture = JSON.parse(readFileSync("tests/fixtures/cks-07/sufficiency-proof-positive-v1.json", "utf8")) as Fixture;
const negativeFixture = JSON.parse(readFileSync("tests/fixtures/cks-07/sufficiency-proof-negative-v1.json", "utf8")) as Fixture;
const golden = JSON.parse(readFileSync("tests/fixtures/cks-07/requirement-analysis-golden-v1.json", "utf8")) as {
  input: ForwardRequirementAnalysisInputV1;
};
const schemaValidator = new Ajv2020({ allErrors: true, strict: true }).compile(
  JSON.parse(readFileSync("schemas/contracts/cks-sufficiency-proof-v1.schema.json", "utf8")),
);

type FixtureCase = {
  caseId: string;
  oracleOutcome: "SUFFICIENT" | "INSUFFICIENT";
  kind: "SUFFICIENT" | SufficiencyGapClassV1;
  probeOutcome: "INSUFFICIENT" | "BLOCKED";
  backwardStatus: "PASS" | "FAIL";
  a0CandidateBytes: "PRESENT_FOR_ALL" | "ABSENT_FOR_ALL";
};
type Fixture = { suiteId: string; denominatorDigest: string; cases: FixtureCase[] };

const hash = (value: unknown): string => createHash("sha256").update(canonicalJson(value)).digest("hex");
const digestWithout = (value: Record<string, unknown>, key: string): string =>
  hash(Object.fromEntries(Object.entries(value).filter(([name]) => name !== key)));

function makeForward(item: FixtureCase): {
  analysis: ReturnType<typeof analyzeForwardRequirementsV1>;
  requirementCandidates: ForwardRequirementAnalysisInputV1["candidates"];
} {
  const input = structuredClone(golden.input) as any;
  input.analysisId = `analysis:${item.caseId.slice("case:".length)}`;
  input.caseId = item.caseId;
  if (item.kind !== "SUFFICIENT") {
    const candidateId = "cand:access";
    if (item.kind === "MISSING") {
      input.candidates = input.candidates.filter((candidate: any) => candidate.candidateId !== "cand:audit");
      input.mappings = input.mappings.filter((mapping: any) => mapping.candidateId !== "cand:audit");
    } else if (item.kind === "BAD_SOURCE") {
      input.candidates = input.candidates.map((candidate: any) => candidate.candidateId === candidateId
        ? { ...candidate, sourceClass: "PINNED_PRIMARY_EVIDENCE" } : candidate);
    } else if (item.kind === "APPLICABILITY") {
      input.candidates = input.candidates.map((candidate: any) => candidate.candidateId === candidateId
        ? { ...candidate, applicability: "NOT_APPLICABLE" } : candidate);
    } else if (item.kind === "CONFLICTING") {
      input.candidates = input.candidates.map((candidate: any) => candidate.candidateId === candidateId
        ? { ...candidate, conflictState: "CONFLICTING" } : candidate);
    } else if (item.kind === "UNKNOWN_SEMANTIC") {
      input.mappings = input.mappings.map((mapping: any) => mapping.candidateId === candidateId
        ? { ...mapping, requirementId: null, outcome: "UNKNOWN_SEMANTIC" } : mapping);
    }
  }
  input.fixtureDigest = forwardRequirementFixtureDigestV1(input);
  return { analysis: analyzeForwardRequirementsV1(input), requirementCandidates: input.candidates };
}

function makeA0Receipts(
  item: FixtureCase,
  forward: ReturnType<typeof analyzeForwardRequirementsV1>,
  knowledgeBundleDigest: string,
): P13A0RetrievalReceiptV1[] {
  return forward.requirements.filter((requirement) => requirement.applicability === "APPLICABLE").map((requirement) => {
    const candidateEnvelopeDigests = item.a0CandidateBytes === "PRESENT_FOR_ALL"
      ? [hash({ caseId: item.caseId, requirementId: requirement.requirementId, a0Candidate: true })]
      : [];
    const draft = {
      schemaVersion: P13_A0_RETRIEVAL_RECEIPT_SCHEMA_V1,
      caseId: item.caseId,
      requirementKey: p13RequirementKeyV1(item.caseId, forward.requirementSetDigest, requirement.requirementId),
      attemptOrdinal: 0 as const,
      level: "A0" as const,
      strategyId: "strategy:primary",
      queryDigest: hash({ caseId: item.caseId, requirementId: requirement.requirementId, query: "primary" }),
      knowledgeBundleDigest,
      outcome: candidateEnvelopeDigests.length > 0 ? "BAD_SOURCE" as const : "NO_MATCH" as const,
      candidateEnvelopeDigests,
      selectedEnvelopeDigests: [],
      reasonCodes: candidateEnvelopeDigests.length > 0 ? ["COMPARATOR_IGNORES_QUALIFICATION"] : ["NO_CANDIDATE_BYTES"],
    };
    return { ...draft, receiptDigest: p13A0RetrievalReceiptDigestV1(draft) };
  });
}

function makeProofInput(item: FixtureCase): KnowledgeSufficiencyProofInputV1 {
  const { analysis: forward, requirementCandidates } = makeForward(item);
  const bindings = forward.requirements.map((requirement) => ({
    requirementId: requirement.requirementId,
    needDigest: hash({ caseId: item.caseId, requirementId: requirement.requirementId }),
  }));
  const stateToGap = (state: string): { gapClass: SufficiencyGapClassV1; requirementOutcome: SufficiencyRequirementOutcomeV1 } => {
    if (state === "SATISFIED") return { gapClass: "NONE", requirementOutcome: "SATISFIED" };
    if (state === "NOT_APPLICABLE") return { gapClass: "NONE", requirementOutcome: "NOT_APPLICABLE" };
    const gapClass = state as Exclude<SufficiencyGapClassV1, "NONE">;
    return { gapClass, requirementOutcome: `GAP_${gapClass}` as SufficiencyRequirementOutcomeV1 };
  };
  const gapResults = bindings.map((binding) => {
    const requirement = forward.requirements.find((candidate) => candidate.requirementId === binding.requirementId);
    assert.ok(requirement);
    const combination = stateToGap(requirement.state);
    const draft = {
      needDigest: binding.needDigest,
      ...combination,
      sourceClasses: combination.requirementOutcome === "SATISFIED" ? ["ACTIVE_CURATED_KNOWLEDGE"] as const : [] as const,
      evidenceDigests: [hash({ caseId: item.caseId, evidence: binding.requirementId })],
    };
    return { ...draft, resultDigest: gapFinderItemDigestV1(draft) };
  });
  const knowledgeBundleDigest = hash({ knowledgeBundle: "cks-07", caseId: item.caseId });
  const a0RetrievalReceipts = makeA0Receipts(item, forward, knowledgeBundleDigest);
  const gapDraft = {
    schemaVersion: GAP_FINDER_RESULT_SCHEMA_V1,
    caseId: item.caseId,
    requirementSetDigest: forward.requirementSetDigest,
    knowledgeBundleDigest,
    results: gapResults,
  };
  const gapFinderResult = { ...gapDraft, finderDigest: gapFinderResultDigestV1(gapDraft) };
  const boundaryProbes: SufficiencyBoundaryProbeV1[] = ["MISSING", "BAD_SOURCE", "APPLICABILITY", "CONFLICTING", "UNKNOWN_SEMANTIC"].map((probeClass, index) => {
    const probe = {
      probeId: `probe:${item.caseId.slice("case:".length)}-${index}`,
      probeClass: probeClass as SufficiencyBoundaryProbeV1["probeClass"],
      needDigest: bindings[0]?.needDigest ?? hash(null),
      expectedOutcome: item.probeOutcome,
      observedOutcome: item.probeOutcome,
      sourceClasses: probeClass === "BAD_SOURCE" ? ["INTERNET_RESULT"] as const : [] as const,
      evidenceDigests: [hash({ caseId: item.caseId, probeClass })],
    };
    return { ...probe, probeDigest: boundaryProbeDigestV1(probe) };
  });
  const claims = bindings.map((binding) => {
    const requirement = forward.requirements.find((candidate) => candidate.requirementId === binding.requirementId);
    assert.ok(requirement);
    const proven = item.backwardStatus === "PASS";
    const claim = {
      needDigest: binding.needDigest,
      claimOutcome: requirement.state === "NOT_APPLICABLE" ? "NOT_APPLICABLE" as const : "SATISFIED" as const,
      proofState: proven ? "PROVEN" as const : "UNPROVEN" as const,
      sourceClasses: proven && requirement.state === "SATISFIED" ? ["ACTIVE_CURATED_KNOWLEDGE"] as const : [] as const,
      evidenceDigests: [hash({ caseId: item.caseId, claim: binding.requirementId })],
    };
    return { ...claim, claimDigest: backwardClaimDigestV1(claim) };
  });
  const backwardDraft = { claims, proofStatus: item.backwardStatus };
  const backwardClaimProof = { ...backwardDraft, proofDigest: backwardClaimProofDigestV1(backwardDraft) };
  const draft = {
    schemaVersion: KNOWLEDGE_SUFFICIENCY_PROOF_INPUT_SCHEMA_V1,
    proofId: `proof:${item.caseId.slice("case:".length)}`,
    caseId: item.caseId,
    fixtureDigest: hash(null),
    requirementSetDigest: forward.requirementSetDigest,
    knowledgeBundleDigest,
    forwardRequirementAnalysis: forward,
    requirementCandidates,
    a0RetrievalReceipts,
    a0RetrievalReceiptSetDigest: p13A0RetrievalReceiptSetDigestV1(a0RetrievalReceipts),
    requirementBindings: bindings,
    requirementBindingsDigest: requirementBindingsDigestV1(bindings),
    gapFinderResult,
    boundaryProbes,
    backwardClaimProof,
    authorityBoundary: SUFFICIENCY_AUTHORITY_BOUNDARY_V1,
  };
  return { ...draft, fixtureDigest: sufficiencyProofFixtureDigestV1(draft) };
}

function makeP13Input(fixture: Fixture): {
  input: any;
  cases: P13FalseCompletenessCaseV1[];
} {
  const cases = fixture.cases.map((item) => {
    const proofInput = makeProofInput(item);
    const caseInputDigest = proofInput.fixtureDigest;
    const simpleSolver = {
      solverId: "CKS-07-SIMPLE-SOLVER-V1" as const,
      inputDigest: caseInputDigest,
      denominatorDigest: fixture.denominatorDigest,
    };
    return { caseId: item.caseId, oracleOutcome: item.oracleOutcome, denominatorDigest: fixture.denominatorDigest, caseInputDigest, proofInput, simpleSolver };
  });
  const draft = {
    schemaVersion: P13_FALSE_COMPLETENESS_PROOF_INPUT_SCHEMA_V1,
    suiteId: fixture.suiteId,
    fixtureDigest: hash(null),
    denominatorDigest: fixture.denominatorDigest,
    cases,
  };
  return { input: { ...draft, fixtureDigest: p13FixtureDigestV1(draft) }, cases };
}

test("combined gate requires forward, separate gap, boundary, and backward passes", () => {
  const item = positiveFixture.cases[0];
  assert.ok(item);
  const input = makeProofInput(item);
  assert.equal(validateKnowledgeSufficiencyProofInputV1(input), true);
  assert.equal(schemaValidator(input), true);
  const first = proveKnowledgeSufficiencyV1(input);
  const second = proveKnowledgeSufficiencyV1(structuredClone(input));
  assert.deepEqual(second, first);
  assert.deepEqual([first.forwardOutcome, first.gapFinderOutcome, first.boundaryOutcome, first.backwardOutcome], ["PASS", "PASS", "PASS", "PASS"]);
  assert.equal(first.outcome, "SUFFICIENT");
  assert.equal(first.materialCompleteness, "MATERIAL_COMPLETE");
  assert.equal(validateKnowledgeSufficiencyProofV1(first), true);
  assert.equal(schemaValidator(first), true);
  assert.equal(sufficiencyProofDigestV1(Object.fromEntries(Object.entries(first).reverse())), first.proofDigest);
});

test("missing, bad-source, applicability, conflict, and unknown-semantic cases fail closed", () => {
  for (const item of negativeFixture.cases) {
    const input = makeProofInput(item);
    const result = proveKnowledgeSufficiencyV1(input);
    assert.equal(validateKnowledgeSufficiencyProofInputV1(input), true, item.caseId);
    assert.equal(result.outcome, "INSUFFICIENT", item.caseId);
    assert.equal(result.materialCompleteness, "NOT_MATERIAL_COMPLETE", item.caseId);
    assert.equal(result.blockedReasons.length, 0, item.caseId);
    assert.ok(result.forwardOutcome === "FAIL" || result.gapFinderOutcome === "FAIL" || result.backwardOutcome === "FAIL", item.caseId);
    assert.equal(validateKnowledgeSufficiencyProofV1(result), true, item.caseId);
    assert.equal(schemaValidator(result), true, item.caseId);
  }
});

test("P13 proves reduction against the frozen simple solver on identical bytes", () => {
  const positive = makeP13Input(positiveFixture);
  const negative = makeP13Input(negativeFixture);
  const suite = {
    schemaVersion: P13_FALSE_COMPLETENESS_PROOF_INPUT_SCHEMA_V1,
    suiteId: "suite:cks-07-p13-combined",
    fixtureDigest: hash(null),
    denominatorDigest: positive.input.denominatorDigest,
    cases: [...positive.cases, ...negative.cases],
  };
  const input = { ...suite, fixtureDigest: p13FixtureDigestV1(suite) };
  assert.equal(validateP13FalseCompletenessProofInputV1(input), true);
  assert.equal(schemaValidator(input), true);
  const result = proveP13FalseCompletenessV1(input);
  assert.equal(result.proofOutcome, "PASS");
  assert.equal(result.metrics?.insufficientOracleCases, 5);
  assert.equal(result.metrics?.sufficientOracleCases, 1);
  assert.equal(result.metrics?.combinedFalseCompletenessCount, 0);
  assert.equal(result.metrics?.simpleSolverFalseCompletenessCount, 5);
  assert.equal(result.metrics?.combinedTrueCompletenessCount, 1);
  assert.equal(result.metrics?.falseCompletenessAbsoluteReduction, 1);
  assert.equal(validateP13FalseCompletenessProofV1(result), true);
  assert.equal(schemaValidator(result), true);
});

test("P13 blocks fabricated comparator requirements and A0 input drift", () => {
  const positive = makeP13Input(positiveFixture);
  const negative = makeP13Input(negativeFixture);
  const suite = {
    schemaVersion: P13_FALSE_COMPLETENESS_PROOF_INPUT_SCHEMA_V1,
    suiteId: "suite:cks-07-p13-parity",
    fixtureDigest: hash(null),
    denominatorDigest: positive.input.denominatorDigest,
    cases: [...positive.cases, ...negative.cases],
  };
  const input = { ...suite, fixtureDigest: p13FixtureDigestV1(suite) };

  const fabricatedRequirements = structuredClone(input) as any;
  fabricatedRequirements.cases[0].simpleSolver.requirementIds = ["req:fabricated"];
  fabricatedRequirements.cases[0].simpleSolver.a0CoveredRequirementIds = ["req:fabricated"];
  fabricatedRequirements.fixtureDigest = p13FixtureDigestV1(fabricatedRequirements);
  assert.equal(validateP13FalseCompletenessProofInputV1(fabricatedRequirements), false);
  assert.equal(proveP13FalseCompletenessV1(fabricatedRequirements).proofOutcome, "BLOCKED");

  const a0Drift = structuredClone(input) as any;
  const proofInput = a0Drift.cases[0].proofInput;
  proofInput.a0RetrievalReceipts[0].candidateEnvelopeDigests = [];
  proofInput.a0RetrievalReceipts[0].receiptDigest = p13A0RetrievalReceiptDigestV1(proofInput.a0RetrievalReceipts[0]);
  proofInput.a0RetrievalReceiptSetDigest = p13A0RetrievalReceiptSetDigestV1(proofInput.a0RetrievalReceipts);
  proofInput.fixtureDigest = sufficiencyProofFixtureDigestV1(proofInput);
  a0Drift.cases[0].caseInputDigest = proofInput.fixtureDigest;
  a0Drift.fixtureDigest = p13FixtureDigestV1(a0Drift);
  assert.notEqual(a0Drift.cases[0].simpleSolver.inputDigest, proofInput.fixtureDigest);
  assert.equal(validateP13FalseCompletenessProofInputV1(a0Drift), false);
  assert.equal(proveP13FalseCompletenessV1(a0Drift).proofOutcome, "BLOCKED");
});

test("missing dependencies and authority leaks block rather than fabricate completeness", () => {
  const item = positiveFixture.cases[0];
  assert.ok(item);
  const input = makeProofInput(item);
  assert.equal(proveKnowledgeSufficiencyV1(undefined).outcome, "BLOCKED");
  const unknownProbe = structuredClone(input) as any;
  unknownProbe.boundaryProbes[0].probeClass = "NOT_A_PROBE";
  assert.equal(proveKnowledgeSufficiencyV1(unknownProbe).outcome, "BLOCKED");
  const internetEvidence = structuredClone(input) as any;
  internetEvidence.gapFinderResult.results[0].sourceClasses = ["INTERNET_RESULT"];
  internetEvidence.gapFinderResult.results[0].resultDigest = gapFinderItemDigestV1(internetEvidence.gapFinderResult.results[0]);
  internetEvidence.gapFinderResult.finderDigest = gapFinderResultDigestV1(internetEvidence.gapFinderResult);
  internetEvidence.fixtureDigest = sufficiencyProofFixtureDigestV1(internetEvidence);
  assert.equal(validateSeparateGapFinderResultV1(internetEvidence.gapFinderResult), false);
  assert.equal(proveKnowledgeSufficiencyV1(internetEvidence).outcome, "BLOCKED");
  const forged = proveKnowledgeSufficiencyV1(input) as any;
  forged.outcome = "SUFFICIENT";
  forged.materialCompleteness = "MATERIAL_COMPLETE";
  forged.backwardOutcome = "FAIL";
  forged.proofDigest = digestWithout(forged, "proofDigest");
  assert.equal(validateKnowledgeSufficiencyProofV1(forged), false);
});
