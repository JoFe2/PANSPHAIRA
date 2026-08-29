import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import test from "node:test";

import {
  cksShadowEvaluationWindowDigestV1,
  evaluateCksShadowEvaluationV1,
} from "../packages/contracts/src/cks-shadow-evaluation.js";
import { validateCksEscalationEvidenceV1 } from "../packages/contracts/src/cks-qualification.js";
import { validateCksResourceAdmissionRequestV1 } from "../packages/contracts/src/cks-resource-admission.js";

type Json = Record<string, any>;

const POSITIVE = "tests/fixtures/cks-router-dry-run/positive-evidence-v1.json";
const NEGATIVE = "tests/fixtures/cks-router-dry-run/rejections-v1.json";
const SCRIPT = "scripts/run-cks-router-dry-run.mjs";

function load(path: string): Json {
  return JSON.parse(readFileSync(path, "utf8")) as Json;
}

function run(fixture: unknown): { status: number | null; stdout: string; stderr: string } {
  const result = spawnSync(process.execPath, [SCRIPT, "--fixture", "-"], {
    cwd: process.cwd(),
    encoding: "utf8",
    input: `${JSON.stringify(fixture)}\n`,
  });
  return { status: result.status, stdout: result.stdout, stderr: result.stderr };
}

test("CKS-06 offline harness replays binding, escalation, selection, capacity, and shadow gates", () => {
  const positive = load(POSITIVE);
  const result = spawnSync(process.execPath, [SCRIPT, "--fixture", POSITIVE], {
    cwd: process.cwd(),
    encoding: "utf8",
  });
  assert.equal(result.status, 0, result.stderr);
  const receipt = JSON.parse(result.stdout) as Json;
  assert.equal(receipt.outcome, "PASS");
  assert.deepEqual(receipt.qualification.boundFields, [
    "modelArtifact", "quantization", "runtime", "context", "prompt", "tools",
    "retriever", "reranker", "verifier", "knowledge", "qualificationSuite",
  ]);
  assert.equal(receipt.evidence.allRequiredReferencesVerified, true);
  assert.deepEqual(
    receipt.typedEscalation.causes.map((cause: Json) => cause.causeCode),
    positive.typedEscalation.requiredCauses,
  );
  assert.equal(receipt.selection.outcome, "ADVISORY_RECOMMENDATION");
  assert.equal(receipt.selection.orderingKey[0], 2);
  assert.equal(receipt.selection.orderingKey[1], 36);
  assert.equal(receipt.capacityAdmission.outcome, "VALID");
  assert.equal(receipt.capacityAdmission.capacityBucketId, "parallel-128k");
  assert.equal(receipt.capacityAdmission.measuredDemand.totalTokens, 114624);
  assert.equal(receipt.capacityAdmission.measuredDemand.concurrentSequences, 2);
  assert.equal(receipt.shadowGating.outcome, "ACTIVATION_ELIGIBLE_FOR_SEPARATE_AUTHORIZATION");
  assert.equal(receipt.shadowGating.activationMode, "OFF");
  assert.deepEqual(receipt.separationChecks, {
    riskImpactAndAuthorityNotInOrderingKey: true,
    resourceAdmissionDoesNotGrantAuthority: true,
    shadowEligibilityDoesNotActivateRouting: true,
  });
});

test("CKS-06 harness is deterministic and preserves the no-effect boundary", () => {
  const first = run(load(POSITIVE));
  assert.equal(first.status, 0, first.stderr);
  const second = run(load(POSITIVE));
  assert.equal(second.status, 0, second.stderr);
  assert.deepEqual(JSON.parse(first.stdout), JSON.parse(second.stdout));
  const receipt = JSON.parse(first.stdout) as Json;
  assert.deepEqual(receipt.nonClaims, [
    "NO_PROVIDER_CALL", "NO_ROUTE_EXECUTION", "NO_AUTHORITY_GRANT", "NO_AUTOMATIC_ACTIVATION",
  ]);
});

test("CKS-06 fails closed when required positive evidence is absent or tampered", () => {
  const positive = load(POSITIVE);
  const missing = structuredClone(positive) as Json;
  missing.requiredPositiveEvidenceReferences.pop();
  const missingResult = run(missing);
  assert.equal(missingResult.status, 1);
  assert.match(missingResult.stderr, /FAIL_CLOSED:REQUIRED_CKS_EVIDENCE_REFERENCE_COUNT/);

  const tampered = structuredClone(positive) as Json;
  tampered.requiredPositiveEvidenceReferences[0].sha256 = "0".repeat(64);
  const tamperedResult = run(tampered);
  assert.equal(tamperedResult.status, 1);
  assert.match(tamperedResult.stderr, /FAIL_CLOSED:EVIDENCE_REFERENCE_DIGEST_MISMATCH:CKS-03/);
});

test("CKS-06 typed escalation, capacity, and shadow negative fixtures reject deterministically", () => {
  const negative = load(NEGATIVE);
  assert.equal(negative.cases.length, 6);
  assert.deepEqual(negative.cases.map((entry: Json) => entry.expectedFailure), [
    "REQUIRED_CKS_EVIDENCE_REFERENCE_COUNT",
    "EVIDENCE_REFERENCE_DIGEST_MISMATCH:CKS-03",
    "DISPOSITION_MISMATCH",
    "LEASE_CONFLICT",
    "CKS_EVIDENCE_NOT_POSITIVE",
    "EFFICIENCY_GATE_FAILED",
  ]);

  const escalation = load("tests/fixtures/cks-qualification/escalation-causes-v1.json");
  const rejectedEscalation = structuredClone(escalation.cases[0].document) as Json;
  rejectedEscalation.disposition = "RECLASSIFY_AND_RESELECT";
  const escalationResult = validateCksEscalationEvidenceV1(rejectedEscalation);
  assert.deepEqual(escalationResult, {
    outcome: "DENIED",
    reason: "DISPOSITION_MISMATCH",
    detail: "disposition",
  });

  const admission = load("tests/fixtures/cks-resource-admission/admission-cases-v1.json");
  const validAdmission = admission.cases[0].document as Json;
  const rejectedAdmission = { ...validAdmission, requestDigest: "0".repeat(64) };
  const admissionResult = validateCksResourceAdmissionRequestV1(rejectedAdmission);
  assert.equal(admissionResult.outcome, "DENIED");
  if (admissionResult.outcome === "DENIED") assert.equal(admissionResult.reason, "DIGEST_MISMATCH");

  const shadow = load("tests/fixtures/cks-shadow-evaluation/shadow-golden-v1.json");
  const shadowInput = {
    schemaVersion: shadow.schemaVersion,
    evaluationId: shadow.evaluationId,
    manifest: shadow.manifest,
    thresholds: shadow.thresholds,
    windows: (shadow.windows as Json[]).map((window) => {
      const next = structuredClone(window) as Json;
      next.requiredEvidence.cks04.status = "UNKNOWN";
      next.windowDigest = cksShadowEvaluationWindowDigestV1(next);
      return next;
    }),
  };
  const shadowResult = evaluateCksShadowEvaluationV1(shadowInput);
  assert.equal(shadowResult.outcome, "ACTIVATION_BLOCKED");
  if (shadowResult.outcome === "ACTIVATION_BLOCKED") {
    assert.deepEqual(shadowResult.reasonCodes, ["CKS_EVIDENCE_NOT_POSITIVE"]);
  }
});
