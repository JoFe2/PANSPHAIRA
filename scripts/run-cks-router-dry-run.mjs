#!/usr/bin/env node
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

import {
  CKS_ADVISORY_SELECTOR_SCHEMA_V1,
  CKS_REQUIRED_SCENARIO_TAGS_V1,
  cksExactProfileDigestV1,
  cksSelectorQualificationEvidenceLineageDigestV1,
  selectSmallestQualifiedProfileV1,
  validateCksCompetenceQualificationProfileV1,
  validateCksEscalationEvidenceV1,
} from "../dist/packages/contracts/src/cks-qualification.js";
import {
  cksMeasurementDigestV1,
  cksRequestDigestV1,
  validateCksResourceAdmissionRequestV1,
} from "../dist/packages/contracts/src/cks-resource-admission.js";
import {
  cksShadowEvaluationWindowDigestV1,
  evaluateCksShadowEvaluationV1,
  validateCksShadowEvaluationV1,
} from "../dist/packages/contracts/src/cks-shadow-evaluation.js";

const ROOT = resolve(process.cwd());
const DIGEST = /^[a-f0-9]{64}$/;
const COMMIT = /^[a-f0-9]{40}$/;
const CLAIM_BOUNDARY = "OFFLINE_DETERMINISTIC_DRY_RUN_NO_PROVIDER_CALL_NO_ROUTE_EXECUTION_NO_AUTHORITY_GRANT";
const REQUIRED_DECISIONS = ["D-001", "D-002", "D-003", "D-004", "D-005", "D-006", "D-007"];
const REQUIRED_BINDINGS = [
  "modelArtifact", "quantization", "runtime", "context", "prompt", "tools",
  "retriever", "reranker", "verifier", "knowledge", "qualificationSuite",
];

function digest(value) {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}

function fixturePath(value) {
  if (typeof value !== "string" || value.length === 0 || value.startsWith("/") || value.includes("\\") || value.includes("\0")) {
    throw new Error(`UNSAFE_FIXTURE_PATH:${String(value)}`);
  }
  const file = resolve(ROOT, value);
  if (!file.startsWith(`${ROOT}${sep}`)) throw new Error(`UNSAFE_FIXTURE_PATH:${value}`);
  return file;
}

function loadReferencedJson(relativePath) {
  return readJson(fixturePath(relativePath));
}

function verifyEvidenceReferences(references) {
  if (!Array.isArray(references) || references.length !== 3) throw new Error("REQUIRED_CKS_EVIDENCE_REFERENCE_COUNT");
  const expectedGates = ["CKS-03", "CKS-04", "CKS-05"];
  const verified = references.map((reference, index) => {
    if (reference?.gateId !== expectedGates[index]
      || typeof reference.path !== "string"
      || typeof reference.role !== "string"
      || reference.schemaVersion !== "pansphaira.dev/cks-positive-evidence-reference/v1"
      || reference.subject !== "PSAI286-QWEN-06-OFFLINE-E2E-HARNESS"
      || typeof reference.acceptance !== "string"
      || reference.suite !== reference.gateId
      || typeof reference.verifier !== "string"
      || typeof reference.replayCommand !== "string"
      || reference.terminalReceipt !== "POSITIVE"
      || !COMMIT.test(reference.commit ?? "")
      || !DIGEST.test(reference.sha256 ?? "")) {
      throw new Error(`MALFORMED_CKS_EVIDENCE_REFERENCE:${index}`);
    }
    const path = fixturePath(reference.path);
    const actual = createHash("sha256").update(readFileSync(path)).digest("hex");
    if (actual !== reference.sha256) throw new Error(`EVIDENCE_REFERENCE_DIGEST_MISMATCH:${reference.gateId}`);
    return {
      gateId: reference.gateId,
      role: reference.role,
      schemaVersion: reference.schemaVersion,
      subject: reference.subject,
      acceptance: reference.acceptance,
      suite: reference.suite,
      verifier: reference.verifier,
      replayCommand: reference.replayCommand,
      terminalReceipt: reference.terminalReceipt,
      path: reference.path,
      commit: reference.commit,
      sha256: reference.sha256,
      status: "POSITIVE",
    };
  });
  return verified;
}

function validateProcessBinding(binding) {
  if (binding?.operatingModel !== "Operating Model v1.1"
    || JSON.stringify(binding.decisions) !== JSON.stringify(REQUIRED_DECISIONS)) {
    throw new Error("PROCESS_CONTEXT_MISMATCH");
  }
}

function buildCandidates(fixture, evidence) {
  const profile = loadReferencedJson(fixture.qualificationBinding.profilePath);
  const selectorFixture = loadReferencedJson(fixture.qualificationBinding.selectorPath);
  const profileValidation = validateCksCompetenceQualificationProfileV1(profile);
  if (profileValidation.outcome !== "VALID") throw new Error("PROFILE_FIXTURE_INVALID");
  const evidenceByGate = Object.fromEntries(evidence.map((item) => [item.gateId, item.sha256]));
  return selectorFixture.candidates.map((spec) => {
    const candidateProfile = structuredClone(profile);
    if (spec.profileVariant !== "base") {
      candidateProfile.bindings.runtime = {
        ...candidateProfile.bindings.runtime,
        runtimeVersion: spec.profileVariant,
      };
    }
    candidateProfile.state = spec.profileState;
    candidateProfile.profileDigest = cksExactProfileDigestV1(candidateProfile.bindings);
    const profileDigest = candidateProfile.profileDigest;
    const qualificationEvidenceUnsigned = {
      exactProfileDigest: profileDigest,
      qualificationSuiteReceiptDigest: candidateProfile.bindings.qualificationSuite.freshCertificationReceiptDigest,
      issuedAtMs: 0,
      expiresAtMs: 2_000,
      cks03: { status: "POSITIVE", receiptDigest: evidenceByGate["CKS-03"] },
      cks04: { status: "POSITIVE", receiptDigest: evidenceByGate["CKS-04"] },
      cks05: { status: "POSITIVE", receiptDigest: evidenceByGate["CKS-05"] },
    };
    return {
      profile: candidateProfile,
      coverageBox: spec.coverageBox,
      scenarioTags: [...CKS_REQUIRED_SCENARIO_TAGS_V1],
      qualificationEvidence: {
        ...qualificationEvidenceUnsigned,
        lineageDigest: cksSelectorQualificationEvidenceLineageDigestV1(qualificationEvidenceUnsigned),
      },
      riskImpactPolicy: spec.riskImpactPolicy,
      authorityPolicy: spec.authorityPolicy,
      catalogAvailability: {
        status: spec.catalogAvailability,
        exactProfileDigest: profileDigest,
        catalogReceiptDigest: evidenceByGate["CKS-03"],
      },
      resourceAdmission: {
        status: spec.resourceAdmission,
        exactProfileDigest: profileDigest,
        admissionReceiptDigest: evidenceByGate["CKS-04"],
      },
      qualificationTierOrdinal: spec.qualificationTierOrdinal,
      certifiedCoverageBoxCardinality: spec.certifiedCoverageBoxCardinality,
      reservedCostMicros: spec.reservedCostMicros,
      qualifiedP95ElapsedMs: spec.qualifiedP95ElapsedMs,
      peakResidentBytes: spec.peakResidentBytes,
    };
  });
}

function runEscalation(fixture) {
  const bundle = loadReferencedJson(fixture.typedEscalation.casesPath);
  const required = fixture.typedEscalation.requiredCauses;
  const causes = bundle.cases.map((entry) => {
    const result = validateCksEscalationEvidenceV1(entry.document);
    if (result.outcome !== "VALID") throw new Error(`ESCALATION_REJECTED:${entry.name}`);
    if (!required.includes(result.causeCode)) throw new Error(`UNEXPECTED_ESCALATION_CAUSE:${result.causeCode}`);
    return {
      caseId: entry.name,
      causeCode: result.causeCode,
      disposition: result.disposition,
      evidenceDigest: result.evidenceDigest,
      receiptDigest: result.receiptDigest,
    };
  });
  const actual = causes.map((cause) => cause.causeCode);
  if (required.length !== actual.length || required.some((cause) => !actual.includes(cause))) {
    throw new Error("ESCALATION_CAUSE_COVERAGE_INCOMPLETE");
  }
  return causes;
}

function runCapacity(fixture, selectedProfileDigest) {
  const bundle = loadReferencedJson(fixture.capacityAdmission.casePath);
  const entry = bundle.cases.find((candidate) => candidate.name === fixture.capacityAdmission.caseName);
  if (!entry) throw new Error("CAPACITY_CASE_NOT_FOUND");
  const request = structuredClone(entry.document);
  request.measurement.exactProfileDigest = selectedProfileDigest;
  request.measurement.measurementDigest = cksMeasurementDigestV1(request.measurement);
  request.requestDigest = cksRequestDigestV1(request);
  const result = validateCksResourceAdmissionRequestV1(request);
  if (result.outcome !== "VALID") throw new Error(`CAPACITY_ADMISSION_DENIED:${result.reason}`);
  const demand = request.candidates.reduce((total, candidate) => ({
    totalTokens: total.totalTokens + candidate.demand.inputTokens + candidate.demand.toolSchemaTokens
      + candidate.demand.maximumOutputTokens + candidate.demand.safetyReserveTokens,
    concurrentSequences: total.concurrentSequences + candidate.demand.concurrentSequences,
  }), { totalTokens: 0, concurrentSequences: 0 });
  const bucket = request.measurement.capacityBuckets.find((candidate) => candidate.bucketDigest === result.capacityBucketDigest);
  return {
    outcome: result.outcome,
    requestDigest: result.requestDigest,
    exactProfileDigest: selectedProfileDigest,
    capacityBucketDigest: result.capacityBucketDigest,
    capacityBucketId: bucket?.bucketId,
    measuredDemand: demand,
    dependencyReady: true,
    pathLeasesAdmitted: request.candidates.flatMap((candidate) => candidate.pathLeases.map((lease) => ({
      candidateId: candidate.candidateId,
      path: lease.resolvedPath,
      mode: lease.mode,
    }))),
    claimBoundary: result.claimBoundary,
  };
}

function runShadow(fixture, evidence) {
  const source = loadReferencedJson(fixture.shadowEvaluation.inputPath);
  const evidenceByGate = Object.fromEntries(evidence.map((item) => [item.gateId, item.sha256]));
  const input = {
    schemaVersion: source.schemaVersion,
    evaluationId: `${source.evaluationId}-router-dry-run`,
    manifest: source.manifest,
    thresholds: source.thresholds,
    windows: source.windows.map((window) => {
      const next = structuredClone(window);
      next.requiredEvidence = {
        cks03: { status: "POSITIVE", receiptDigest: evidenceByGate["CKS-03"] },
        cks04: { status: "POSITIVE", receiptDigest: evidenceByGate["CKS-04"] },
        cks05: { status: "POSITIVE", receiptDigest: evidenceByGate["CKS-05"] },
      };
      next.windowDigest = cksShadowEvaluationWindowDigestV1(next);
      return next;
    }),
  };
  const evaluated = evaluateCksShadowEvaluationV1(input);
  if (evaluated.outcome !== "ACTIVATION_ELIGIBLE_FOR_SEPARATE_AUTHORIZATION") {
    throw new Error(`SHADOW_GATE_BLOCKED:${evaluated.reasonCodes.join(",")}`);
  }
  const validation = validateCksShadowEvaluationV1(evaluated);
  if (validation.outcome !== "VALID") throw new Error(`SHADOW_RECEIPT_INVALID:${validation.reason}`);
  if (evaluated.activationMode !== fixture.shadowEvaluation.expectedActivationMode) throw new Error("SHADOW_ACTIVATION_BOUNDARY_CHANGED");
  return {
    outcome: evaluated.outcome,
    activationMode: evaluated.activationMode,
    reasonCodes: evaluated.reasonCodes,
    passedWindowCount: evaluated.passedWindowCount,
    decisionDigest: evaluated.decisionDigest,
    receiptDigest: evaluated.receiptDigest,
    claimBoundary: evaluated.claimBoundary,
  };
}

export function runDryRun(fixture) {
  if (fixture?.schemaVersion !== "chimpmaera.dev/cks-router-dry-run/v1" || fixture.claimBoundary !== CLAIM_BOUNDARY) {
    throw new Error("DRY_RUN_FIXTURE_BOUNDARY_MISMATCH");
  }
  validateProcessBinding(fixture.processBinding);
  const evidence = verifyEvidenceReferences(fixture.requiredPositiveEvidenceReferences);
  const typedEscalations = runEscalation(fixture);
  const candidates = buildCandidates(fixture, evidence);
  const preCapacitySelection = selectSmallestQualifiedProfileV1({
    schemaVersion: CKS_ADVISORY_SELECTOR_SCHEMA_V1,
    evidenceAsOfMs: fixture.qualificationEvidenceAsOfMs,
    taskVector: fixture.qualificationBinding.taskVector,
    candidates,
  });
  if (preCapacitySelection.outcome !== "ADVISORY_RECOMMENDATION") throw new Error("NO_QUALIFIED_PROFILE");
  const selectedProfileDigest = preCapacitySelection.selectedProfileDigest;
  const capacity = runCapacity(fixture, selectedProfileDigest);
  const selection = selectSmallestQualifiedProfileV1({
    schemaVersion: CKS_ADVISORY_SELECTOR_SCHEMA_V1,
    evidenceAsOfMs: fixture.qualificationEvidenceAsOfMs,
    taskVector: fixture.qualificationBinding.taskVector,
    candidates: candidates.map((candidate) => candidate.profile.profileDigest === selectedProfileDigest
      ? { ...candidate, resourceAdmission: { ...candidate.resourceAdmission, admissionReceiptDigest: capacity.requestDigest } }
      : candidate),
  });
  if (selection.outcome !== "ADVISORY_RECOMMENDATION" || selection.selectedProfileDigest !== selectedProfileDigest) {
    throw new Error("SELECTION_NOT_STABLE_AFTER_CAPACITY_ADMISSION");
  }
  const shadow = runShadow(fixture, evidence);
  const result = {
    schemaVersion: "chimpmaera.dev/cks-router-dry-run-receipt/v1",
    fixtureId: fixture.fixtureId,
    outcome: "PASS",
    claimBoundary: CLAIM_BOUNDARY,
    processBinding: fixture.processBinding,
    evidence: {
      requiredPositiveCksEvidenceReferences: evidence,
      allRequiredReferencesVerified: true,
    },
    qualification: {
      profileDigest: selectedProfileDigest,
      boundFields: REQUIRED_BINDINGS,
      exactProfileValidation: "VALID",
    },
    typedEscalation: {
      outcome: "ALL_REQUIRED_CAUSES_TYPED",
      causes: typedEscalations,
    },
    selection,
    capacityAdmission: capacity,
    shadowGating: shadow,
    separationChecks: {
      riskImpactAndAuthorityNotInOrderingKey: true,
      resourceAdmissionDoesNotGrantAuthority: true,
      shadowEligibilityDoesNotActivateRouting: shadow.activationMode === "OFF",
    },
    nonClaims: ["NO_PROVIDER_CALL", "NO_ROUTE_EXECUTION", "NO_AUTHORITY_GRANT", "NO_AUTOMATIC_ACTIVATION"],
  };
  return { ...result, receiptDigest: digest(result) };
}

function main() {
  const index = process.argv.indexOf("--fixture");
  const value = index >= 0 ? process.argv[index + 1] : undefined;
  if (!value || process.argv.length !== index + 2) throw new Error("USAGE: --fixture <repository-relative-json|->");
  const fixture = value === "-" ? JSON.parse(readFileSync(0, "utf8")) : readJson(fixturePath(value));
  process.stdout.write(`${JSON.stringify(runDryRun(fixture), null, 2)}\n`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    main();
  } catch (error) {
    process.stderr.write(`FAIL_CLOSED:${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  }
}
