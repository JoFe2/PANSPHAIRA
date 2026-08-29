#!/usr/bin/env node
import {
  DOCTOR_FIXTURE_OBSERVATION_SCHEMA_V1,
  renderPublicDoctorReportV1,
  runFixtureDoctorV1,
} from "../dist/packages/contracts/src/update-doctor.js";
import {
  UPDATE_SYNTHETIC_APPLY_HARNESS_FAILURES_V1,
  UPDATE_SYNTHETIC_APPLY_HARNESS_RECEIPT_SCHEMA_V1,
  UPDATE_SYNTHETIC_APPLY_HARNESS_SOURCE_TUPLE_DIGEST_V1,
  UPDATE_SYNTHETIC_APPLY_HARNESS_TARGET_TUPLE_DIGEST_V1,
  UPDATE_SYNTHETIC_APPLY_HARNESS_TARGET_TUPLE_V1,
  UPDATE_SYNTHETIC_APPLY_HARNESS_VERSION_V1,
  runUpdateSyntheticApplyHarnessV1,
  updateSyntheticApplyHarnessReceiptDigestV1,
  verifyUpdateSyntheticApplyHarnessReceiptV1,
} from "../dist/packages/contracts/src/update-synthetic-apply-harness.js";
import { canonicalJson } from "../dist/packages/contracts/src/canonical-json.js";
import { createHash } from "node:crypto";

export const UPDATE_CONTROLLER_SYNTHETIC_EVIDENCE_SCHEMA_V1 =
  "chimpmaera.update/synthetic-delivery-packet/v1";
export const UPDATE_CONTROLLER_SYNTHETIC_EVIDENCE_VERSION_V1 = "1.0.0";
export const UPDATE_CONTROLLER_SYNTHETIC_EVIDENCE_SCENARIOS_V1 = Object.freeze([
  "SUCCESS",
  "PARTIAL_MIGRATION",
  "FAILED_POSTCONDITION",
  "REGISTRY_OUTAGE",
  "INVALID_LKG",
]);
export const UPDATE_CONTROLLER_SYNTHETIC_EVIDENCE_CLAIMS_V1 = Object.freeze([
  "PINNED_SIX_AXIS_TUPLE_VERIFIED",
  "CM_DOCTOR_READ_ONLY_ZERO_WRITE_REDACTED",
  "PARTIAL_MIGRATION_ROLLS_BACK_TO_EXACT_UNREVOKED_LKG_ZERO_RESIDUE",
  "FAILED_POSTCONDITION_ROLLS_BACK_TO_EXACT_UNREVOKED_LKG_ZERO_RESIDUE",
  "REGISTRY_OUTAGE_PRESERVES_LOCAL_ACCEPTED_OPERATION",
  "INVALID_LKG_ENTERS_SAFE_READ_ONLY_MODE",
  "UPDATER_AND_CANDIDATE_CANNOT_SELF_ATTEST_OR_SELF_PROMOTE",
  "ROLLBACK_RETRY_IS_DETERMINISTIC_AND_FULLY_RECEIPTED",
]);
export const UPDATE_CONTROLLER_SYNTHETIC_EVIDENCE_NON_CLAIMS_V1 = Object.freeze([
  "NO_OWNER_OPERATED_PR_CI_OR_RELEASE",
  "NO_MERGE_OR_PRODUCTION_ACTIVATION",
  "NO_LIVE_REGISTRY_PROVIDER_OR_EXTERNAL_SERVICE",
  "NO_OPERATOR_IDENTITY_OR_FILESYSTEM_PATH_EXPORT",
  "NO_SECURITY_CERTIFICATION_OR_HOSTILE_HOST_PROOF",
  "NO_AUTONOMOUS_PROMOTION_AUTHORITY",
]);

const DOCTOR_PROBES = Object.freeze([
  "cm:doctor-installation",
  "cm:doctor-runtime",
  "cm:doctor-configuration",
  "cm:doctor-version-lock",
  "cm:doctor-health-readback",
]);
const DOCTOR_TIME_MS = 1_787_612_401_000;
const DOCTOR_TIMEOUT_MS = 10;
const DOCTOR_REPORT_ID = "cm:doctor-report-synthetic-001";
const EXPECTED_VERIFIED_RESULT = Object.freeze({
  outcome: "VERIFIED",
  reasonCodes: ["SYNTHETIC_APPLY_RECEIPT_VERIFIED"],
  exitCode: 0,
});

function digest(value) {
  return createHash("sha256").update(canonicalJson(value)).digest("hex");
}

function verifiedReceipt(scenario) {
  const receipt = runUpdateSyntheticApplyHarnessV1({ failure: scenario });
  const verification = verifyUpdateSyntheticApplyHarnessReceiptV1(receipt);
  if (canonicalJson(verification) !== canonicalJson(EXPECTED_VERIFIED_RESULT)) {
    throw new Error(`SYNTHETIC_RECEIPT_${scenario}_NOT_VERIFIED`);
  }
  if (receipt.schemaVersion !== UPDATE_SYNTHETIC_APPLY_HARNESS_RECEIPT_SCHEMA_V1
    || updateSyntheticApplyHarnessReceiptDigestV1(receipt) !== receipt.receiptDigest) {
    throw new Error(`SYNTHETIC_RECEIPT_${scenario}_DIGEST_DENIED`);
  }
  return receipt;
}

function doctorProjection() {
  const fixture = {
    schemaVersion: DOCTOR_FIXTURE_OBSERVATION_SCHEMA_V1,
    observedLockDigest: UPDATE_SYNTHETIC_APPLY_HARNESS_SOURCE_TUPLE_DIGEST_V1,
    mutationCount: 0,
    probes: DOCTOR_PROBES.map((checkId) => ({
      checkId,
      outcome: "MATCH",
      durationMs: 1,
      privateObservation: { opaque: "redaction-canary", source: "local-fixture" },
    })),
  };
  const report = runFixtureDoctorV1({
    reportId: DOCTOR_REPORT_ID,
    profile: "QUICK",
    expectedLockDigest: UPDATE_SYNTHETIC_APPLY_HARNESS_SOURCE_TUPLE_DIGEST_V1,
    generatedAtMs: DOCTOR_TIME_MS,
    timeoutMs: DOCTOR_TIMEOUT_MS,
    fixture,
  });
  if (report.readOnly !== true || report.checks.length !== DOCTOR_PROBES.length
    || report.checks.some(({ status }) => status !== "PASS")) {
    throw new Error("CM_DOCTOR_READ_ONLY_CHECK_DENIED");
  }
  const rendered = renderPublicDoctorReportV1(report);
  if (/redaction-canary|privateObservation|\/home\/|(?:secret|token|credential)/i.test(rendered)) {
    throw new Error("CM_DOCTOR_REDACTION_DENIED");
  }
  return JSON.parse(rendered);
}

function receiptProjection(receipt) {
  return {
    scenario: receipt.scenario,
    outcome: receipt.outcome,
    readOnly: receipt.readOnly,
    receiptDigest: receipt.receiptDigest,
    tupleDigest: receipt.tupleDigest,
    sourceTupleDigest: receipt.sourceTupleDigest,
    lkgDigest: receipt.lkgDigest,
    lkgState: receipt.lkgState,
    lkgRevoked: receipt.lkgRevoked,
    initialPointer: receipt.initialPointer,
    finalPointer: receipt.finalPointer,
    initialOwnerStateDigest: receipt.initialOwnerStateDigest,
    finalOwnerStateDigest: receipt.finalOwnerStateDigest,
    residueCount: receipt.residueCount,
    stateTrace: receipt.stateTrace,
    contractChecks: receipt.contractChecks,
    retryOrdinal: receipt.retryOrdinal,
    retryReceiptDigest: receipt.retryReceiptDigest,
    readback: receipt.readback,
  };
}

function noApplyWorkWasPerformed(receipt) {
  return receipt.contractChecks.promotionGate === "NOT_PERFORMED"
    && receipt.contractChecks.migrationEdge === "NOT_PERFORMED"
    && receipt.contractChecks.checkpoint === "NOT_PERFORMED"
    && receipt.contractChecks.applyJournal === "NOT_PERFORMED"
    && receipt.contractChecks.postcondition === "NOT_PERFORMED"
    && receipt.contractChecks.rollbackReadback === "NOT_APPLICABLE";
}

function assertScenarioReceipt(receipt) {
  if (receipt.scenario === "PARTIAL_MIGRATION" || receipt.scenario === "FAILED_POSTCONDITION") {
    if (receipt.outcome !== "ROLLED_BACK_ZERO_RESIDUE"
      || receipt.finalPointer.activeTupleDigest !== UPDATE_SYNTHETIC_APPLY_HARNESS_SOURCE_TUPLE_DIGEST_V1
      || receipt.finalOwnerStateDigest !== receipt.initialOwnerStateDigest
      || receipt.residueCount !== 0 || receipt.lkgState !== "COMPLETE" || receipt.lkgRevoked !== false
      || receipt.contractChecks.rollbackReadback !== "VERIFIED") {
      throw new Error(`SYNTHETIC_RECEIPT_${receipt.scenario}_ROLLBACK_DENIED`);
    }
  }
  if (receipt.scenario === "REGISTRY_OUTAGE"
    && (receipt.outcome !== "PRESERVE_ACCEPTED"
      || canonicalJson(receipt.initialPointer) !== canonicalJson(receipt.finalPointer)
      || receipt.contractChecks.continuity !== "PRESERVE_ACCEPTED"
      || canonicalJson(receipt.stateTrace) !== canonicalJson(["CHECK_CONTINUITY", "REGISTRY_UNAVAILABLE", "PRESERVE_ACCEPTED", "READBACK"])
      || !noApplyWorkWasPerformed(receipt))) {
    throw new Error("SYNTHETIC_RECEIPT_REGISTRY_OUTAGE_DENIED");
  }
  if (receipt.scenario === "INVALID_LKG"
    && (receipt.outcome !== "SAFE_READ_ONLY" || receipt.readOnly !== true
      || receipt.lkgState !== "INCOMPLETE"
      || canonicalJson(receipt.initialPointer) !== canonicalJson(receipt.finalPointer)
      || receipt.contractChecks.continuity !== "ENTER_SAFE_READ_ONLY"
      || canonicalJson(receipt.stateTrace) !== canonicalJson(["CHECK_CONTINUITY", "INVALID_LKG", "ENTER_SAFE_READ_ONLY", "READBACK"])
      || !noApplyWorkWasPerformed(receipt))) {
    throw new Error("SYNTHETIC_RECEIPT_INVALID_LKG_DENIED");
  }
}

export function buildUpdateControllerSyntheticEvidenceV1() {
  const receipts = UPDATE_CONTROLLER_SYNTHETIC_EVIDENCE_SCENARIOS_V1.map((scenario) => {
    const receipt = verifiedReceipt(scenario);
    assertScenarioReceipt(receipt);
    return receiptProjection(receipt);
  });
  const doctor = doctorProjection();
  const base = {
    schemaVersion: UPDATE_CONTROLLER_SYNTHETIC_EVIDENCE_SCHEMA_V1,
    evidenceVersion: UPDATE_CONTROLLER_SYNTHETIC_EVIDENCE_VERSION_V1,
    evidenceClass: "LOCAL_SYNTHETIC_REDACTED",
    mode: "DRY_RUN_READBACK",
    scope: {
      workItem: "CLOSURE-PSAI53-ROOT-DELIVERY-01-FINALIZER-01",
      operation: "isolated synthetic update-controller proof",
      ownerOperatedNext: true,
    },
    tuple: UPDATE_SYNTHETIC_APPLY_HARNESS_TARGET_TUPLE_V1,
    tupleDigest: UPDATE_SYNTHETIC_APPLY_HARNESS_TARGET_TUPLE_DIGEST_V1,
    sourceTupleDigest: UPDATE_SYNTHETIC_APPLY_HARNESS_SOURCE_TUPLE_DIGEST_V1,
    doctor: {
      projection: doctor,
      readOnly: true,
      mutationCount: 0,
      export: "REDACTED_PUBLIC_PROJECTION",
    },
    receipts,
    claims: UPDATE_CONTROLLER_SYNTHETIC_EVIDENCE_CLAIMS_V1,
    nonClaims: UPDATE_CONTROLLER_SYNTHETIC_EVIDENCE_NON_CLAIMS_V1,
    ownerGate: {
      pr: "NOT_PERFORMED",
      ci: "NOT_PERFORMED",
      release: "NOT_PERFORMED",
      promotionAuthority: "NOT_ISSUED",
    },
  };
  return {
    ...base,
    packetDigest: digest(base),
  };
}

export function renderUpdateControllerSyntheticEvidenceV1() {
  return `${canonicalJson(buildUpdateControllerSyntheticEvidenceV1())}\n`;
}

const invokedPath = process.argv[1] === undefined ? "" : process.argv[1];
if (invokedPath.endsWith("render-update-controller-synthetic-evidence.mjs")) {
  const args = process.argv.slice(2);
  if (args.length > 1 || (args.length === 1 && !["--dry-run", "--readback"].includes(args[0]))) {
    process.stderr.write("USAGE: node scripts/render-update-controller-synthetic-evidence.mjs [--dry-run|--readback]\n");
    process.exitCode = 2;
  } else {
    try {
      process.stdout.write(renderUpdateControllerSyntheticEvidenceV1());
    } catch (error) {
      process.stderr.write(`${error instanceof Error ? error.message : "SYNTHETIC_EVIDENCE_FAILED"}\n`);
      process.exitCode = 1;
    }
  }
}
