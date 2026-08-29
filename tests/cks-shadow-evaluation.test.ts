import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import Ajv2020 from "ajv/dist/2020.js";
import {
  CKS_SHADOW_EVALUATION_CLAIM_BOUNDARY_V1,
  CKS_SHADOW_EVALUATION_SCHEMA_V1,
  CKS_SHADOW_EVALUATION_THRESHOLDS_V1,
  cksShadowEvaluationWindowDigestV1,
  evaluateCksShadowEvaluationV1,
  validateCksShadowEvaluationV1,
} from "../packages/contracts/src/cks-shadow-evaluation.js";
import {
  CKS_ADVISORY_SELECTOR_CLAIM_BOUNDARY_V1,
  CKS_ADVISORY_SELECTOR_SCHEMA_V1,
  CKS_REQUIRED_SCENARIO_TAGS_V1,
  cksAdvisoryDecisionDigestV1,
  cksExactProfileDigestV1,
  selectSmallestQualifiedProfileV1,
  type CksAdvisorySelectorCandidateV1,
  type CksAdvisorySelectorInputV1,
} from "../packages/contracts/src/cks-qualification.js";

type Json = Record<string, any>;

const FIXTURE_PATH = "tests/fixtures/cks-shadow-evaluation/shadow-golden-v1.json";
const SCHEMA_PATH = "schemas/contracts/cks-shadow-evaluation-v1.schema.json";

const fixture = JSON.parse(readFileSync(FIXTURE_PATH, "utf8")) as Json;
const schema = JSON.parse(readFileSync(SCHEMA_PATH, "utf8")) as Json;
const validateSchema = new Ajv2020({ allErrors: true, strict: true }).compile(schema);

function evaluationInput(document: Json): Json {
  return {
    schemaVersion: document.schemaVersion,
    evaluationId: document.evaluationId,
    manifest: document.manifest,
    thresholds: document.thresholds,
    windows: document.windows,
  };
}

function rebindWindows(document: Json, mutate: (window: Json) => void): Json {
  const next = structuredClone(document) as Json;
  for (const window of next.windows as Json[]) {
    mutate(window);
    window.windowDigest = cksShadowEvaluationWindowDigestV1(window);
  }
  return next;
}

function assertBlocked(document: Json, reason: string): void {
  const evaluated = evaluateCksShadowEvaluationV1(evaluationInput(document));
  assert.equal(evaluated.outcome, "ACTIVATION_BLOCKED");
  if (evaluated.outcome === "ACTIVATION_BLOCKED") {
    assert.ok((evaluated.reasonCodes as readonly string[]).includes(reason), JSON.stringify(evaluated));
  }
  const validation = validateCksShadowEvaluationV1(document);
  assert.equal(validation.outcome, "DENIED");
}

test("golden receipt proves paired quality preservation and measured cost/latency benefit", () => {
  assert.equal(validateSchema(fixture), true, JSON.stringify(validateSchema.errors));
  assert.deepEqual(fixture.thresholds, CKS_SHADOW_EVALUATION_THRESHOLDS_V1);

  const evaluated = evaluateCksShadowEvaluationV1(evaluationInput(fixture));
  assert.deepEqual(evaluated, fixture);
  assert.equal(evaluated.outcome, "ACTIVATION_ELIGIBLE_FOR_SEPARATE_AUTHORIZATION");
  if (evaluated.outcome !== "ACTIVATION_ELIGIBLE_FOR_SEPARATE_AUTHORIZATION") return;
  assert.equal(evaluated.activationMode, "OFF");
  assert.equal(evaluated.claimBoundary, CKS_SHADOW_EVALUATION_CLAIM_BOUNDARY_V1);
  assert.equal(evaluated.passedWindowCount, 2);
  assert.equal(validateCksShadowEvaluationV1(evaluated).outcome, "VALID");

  for (const window of fixture.windows as Json[]) {
    assert.equal(window.baselineDigest, fixture.manifest.baselineDigest);
    assert.equal(window.costPerVerifiedSuccessReductionLowerBoundPpm >= 100000, true);
    assert.equal(window.p95ElapsedRatioUpperBoundPpmVersusFallback <= 1000000, true);
    assert.equal(window.qualityDeltaPairedBootstrapLowerBoundPpmVersusFallback >= -10000, true);
  }
});

test("quality cannot be traded for cost, and every window must pass independently", () => {
  const qualityRegression = rebindWindows(fixture, (window) => {
    window.qualityDeltaPairedBootstrapLowerBoundPpmVersusFallback = -10001;
  });
  assertBlocked(qualityRegression, "QUALITY_GATE_FAILED");

  const oneWindowFails = rebindWindows(fixture, (window) => {
    if (window.windowOrdinal === 1) window.materialClaimCoverageWilsonLowerBoundPpm = 989999;
  });
  assertBlocked(oneWindowFails, "QUALITY_GATE_FAILED");

  const costRegression = rebindWindows(fixture, (window) => {
    window.shadowCostPerVerifiedSuccessMicros = 950;
    window.costPerVerifiedSuccessReductionLowerBoundPpm = 50000;
  });
  assertBlocked(costRegression, "EFFICIENCY_GATE_FAILED");
});

test("missing, unknown, or stale evidence fails closed before any activation claim", () => {
  const unknownCksEvidence = rebindWindows(fixture, (window) => {
    window.requiredEvidence.cks04.status = "UNKNOWN";
  });
  assertBlocked(unknownCksEvidence, "CKS_EVIDENCE_NOT_POSITIVE");

  const missingEvidence = structuredClone(fixture) as Json;
  delete missingEvidence.windows[0].requiredEvidence.cks05;
  assert.equal(validateSchema(missingEvidence), false);
  assertBlocked(missingEvidence, "MALFORMED_INPUT");

  const staleBaselineBinding = structuredClone(fixture) as Json;
  staleBaselineBinding.manifest.baselineDigest = "9".repeat(64);
  assert.equal(validateSchema(staleBaselineBinding), true);
  assertBlocked(staleBaselineBinding, "MALFORMED_INPUT");

  const forbiddenEffectClaim = { ...fixture, routeExecuted: true };
  assert.equal(validateSchema(forbiddenEffectClaim), false);
  const blockedForbiddenEffectClaim = evaluateCksShadowEvaluationV1(forbiddenEffectClaim);
  assert.equal(blockedForbiddenEffectClaim.outcome, "ACTIVATION_BLOCKED");
  if (blockedForbiddenEffectClaim.outcome === "ACTIVATION_BLOCKED") {
    assert.deepEqual(blockedForbiddenEffectClaim.reasonCodes, ["MALFORMED_INPUT"]);
  }
});

test("window sequencing and frozen thresholds are deterministic fail-closed gates", () => {
  const badSequence = structuredClone(fixture) as Json;
  badSequence.windows[1].windowOrdinal = 0;
  for (const window of badSequence.windows as Json[]) {
    window.windowDigest = cksShadowEvaluationWindowDigestV1(window);
  }
  assertBlocked(badSequence, "WINDOW_SEQUENCE_INVALID");

  const thresholdTamper = structuredClone(fixture) as Json;
  thresholdTamper.thresholds.costPerVerifiedSuccessReductionLowerBoundPpm = 1;
  assert.equal(validateSchema(thresholdTamper), true);
  assertBlocked(thresholdTamper, "MALFORMED_INPUT");
});

test("router selects the smallest fully qualified available profile, not the cheapest wider one", () => {
  const selectorFixture = JSON.parse(readFileSync(
    "tests/fixtures/cks-qualification/smallest-qualified-v1.json", "utf8",
  )) as Json;
  const baseProfile = JSON.parse(readFileSync(
    "tests/fixtures/cks-qualification/profile-binding-v1.json", "utf8",
  )) as Json;
  const candidates = (selectorFixture.candidates as Json[]).map((spec) => {
    const profile = structuredClone(baseProfile) as Json;
    if (spec.profileVariant !== "base") {
      profile.bindings.runtime = { ...profile.bindings.runtime, runtimeVersion: spec.profileVariant };
    }
    profile.state = spec.profileState;
    profile.profileDigest = cksExactProfileDigestV1(profile.bindings);
    const digest = profile.profileDigest as string;
    return {
      profile,
      coverageBox: spec.coverageBox,
      scenarioTags: [...CKS_REQUIRED_SCENARIO_TAGS_V1],
      qualificationEvidence: {
        cks03: { status: "POSITIVE", receiptDigest: "1".repeat(64) },
        cks04: { status: "POSITIVE", receiptDigest: "2".repeat(64) },
        cks05: { status: "POSITIVE", receiptDigest: "3".repeat(64) },
      },
      riskImpactPolicy: spec.riskImpactPolicy,
      authorityPolicy: spec.authorityPolicy,
      catalogAvailability: { status: spec.catalogAvailability, exactProfileDigest: digest, catalogReceiptDigest: "4".repeat(64) },
      resourceAdmission: { status: spec.resourceAdmission, exactProfileDigest: digest, admissionReceiptDigest: "5".repeat(64) },
      qualificationTierOrdinal: spec.qualificationTierOrdinal,
      certifiedCoverageBoxCardinality: spec.certifiedCoverageBoxCardinality,
      reservedCostMicros: spec.reservedCostMicros,
      qualifiedP95ElapsedMs: spec.qualifiedP95ElapsedMs,
      peakResidentBytes: spec.peakResidentBytes,
    } as unknown as CksAdvisorySelectorCandidateV1;
  });
  const input = {
    schemaVersion: selectorFixture.schemaVersion as typeof CKS_ADVISORY_SELECTOR_SCHEMA_V1,
    taskVector: selectorFixture.taskVector as readonly [number, number, number, number],
    candidates,
  } satisfies CksAdvisorySelectorInputV1;

  const decision = selectSmallestQualifiedProfileV1(input);
  assert.equal(decision.outcome, "ADVISORY_RECOMMENDATION");
  if (decision.outcome !== "ADVISORY_RECOMMENDATION") return;
  assert.equal(decision.orderingKey[0], 2);
  assert.equal(decision.orderingKey[1], 36);
  assert.equal(decision.selectedProfileDigest, candidates[0]!.profile.profileDigest);
  assert.equal(decision.claimBoundary, CKS_ADVISORY_SELECTOR_CLAIM_BOUNDARY_V1);
  assert.equal(decision.decisionDigest, cksAdvisoryDecisionDigestV1(decision));
  assert.deepEqual(selectSmallestQualifiedProfileV1({ ...input, candidates: [...candidates].reverse() }), decision);
});
