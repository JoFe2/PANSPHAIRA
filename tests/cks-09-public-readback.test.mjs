import { execFileSync, spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import test from "node:test";
import assert from "node:assert/strict";
import {
  EVIDENCE_SCHEMA_VERSION,
  RECEIPT_SCHEMA_VERSION,
  REQUIRED_EVIDENCE,
  TASK_ID,
  TEMPLATE_PATH,
  digest,
  validatePublicReadback,
} from "../scripts/cks-09-validate-public-readback.mjs";

const root = new URL("../", import.meta.url).pathname;
const template = JSON.parse(readFileSync(TEMPLATE_PATH, "utf8"));
const releaseDisposition = JSON.parse(readFileSync(`${root}docs/evidence/conveyor/sol-psai289-release-disposition-01.json`, "utf8"));
const closure = JSON.parse(readFileSync(`${root}verification/closure-psai289-v1.json`, "utf8"));

function validEvidence() {
  return {
    schemaVersion: EVIDENCE_SCHEMA_VERSION,
    recordKind: "ANONYMOUS_PUBLIC_READBACK_EVIDENCE",
    taskId: TASK_ID,
    captureState: "CAPTURED",
    capture: {
      anonymous: true,
      authorizationHeaderPresent: false,
      credentialMaterialObserved: false,
      rawPayloadRetained: false,
      procedureContentReturned: false,
      networkPerformed: true,
      externalStateChanged: false,
    },
    expected: {
      publicRecordId: "cks-09-release-pending",
      publicRecordDigest: "sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
    },
    observed: {
      publicRecordId: "cks-09-release-pending",
      publicRecordDigest: "sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
      statusCode: 200,
      responseDigest: "sha256:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
    },
  };
}

function assertSelfDigest(receipt) {
  const { canonicalDigest, ...body } = receipt;
  assert.match(canonicalDigest, /^sha256:[a-f0-9]{64}$/);
  assert.equal(digest(body), canonicalDigest);
}

test("CKS-09 template preserves the reviewed process and states that no public state has been captured", () => {
  assert.equal(template.schemaVersion, "pansphaira.cks/public-readback-evidence-template/v1");
  assert.equal(template.recordKind, "PUBLIC_READBACK_EVIDENCE_TEMPLATE");
  assert.equal(template.taskId, TASK_ID);
  assert.equal(template.captureState, "NOT_CAPTURED");
  assert.deepEqual(template.process, {
    operatingModel: "v1.1",
    preservedDecisionIds: ["D-001", "D-002", "D-003", "D-004", "D-005", "D-006", "D-007"],
    processVariantIntroduced: false,
  });
  assert.deepEqual(template.requiredEvidence, REQUIRED_EVIDENCE);
  assert.equal(template.privacyBoundary.networkPerformedByValidator, false);
  assert.equal(template.privacyBoundary.externalStateChanged, false);
});

test("successful terminal proof requires a later governed release without claiming that release exists", () => {
  assert.equal(releaseDisposition.decision, "RELEASE_REQUIRED_PENDING_DELIVERY");
  assert.equal(releaseDisposition.disposition.releaseDisposition, "RELEASE_REQUIRED_PENDING_DELIVERY");
  assert.equal(releaseDisposition.disposition.releaseRequired, true);
  assert.equal(releaseDisposition.disposition.releasePerformed, false);
  assert.equal(closure.issueState.issue289.releaseDisposition, "RELEASE_REQUIRED_PENDING_DELIVERY");
  assert.equal(closure.executionBoundary.releasePerformed, false);
  assert.equal(JSON.stringify(releaseDisposition).includes("NO_RELEASE"), false);
});

test("dry-run preparation is ready but does not claim a public-readback success before evidence exists", () => {
  const receipt = validatePublicReadback(template);
  assert.equal(receipt.schemaVersion, RECEIPT_SCHEMA_VERSION);
  assert.equal(receipt.validatorVerdict, "PASS");
  assert.equal(receipt.publicReadbackVerdict, "INCONCLUSIVE");
  assert.equal(receipt.successClaimed, false);
  assert.deepEqual(receipt.reasons, ["PUBLIC_STATE_NOT_CAPTURED"]);
  assert.equal(receipt.executionBoundary.dryRunOnly, true);
  assert.equal(receipt.executionBoundary.networkPerformedByValidator, false);
  assert.equal(receipt.executionBoundary.externalStateChanged, false);
  assertSelfDigest(receipt);
});

test("complete anonymous privacy-safe expected-to-observed evidence can receive a bounded PASS", () => {
  const receipt = validatePublicReadback(validEvidence());
  assert.equal(receipt.validatorVerdict, "PASS");
  assert.equal(receipt.publicReadbackVerdict, "PASS");
  assert.equal(receipt.successClaimed, true);
  assert.deepEqual(receipt.reasons, []);
  assert.deepEqual(receipt.evidence, {
    captureState: "CAPTURED",
    expectedPublicRecordDigest: "sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
    observedResponseDigest: "sha256:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
    statusCode: 200,
  });
  assertSelfDigest(receipt);
});

test("missing required privacy or evidence bindings fail closed and cannot claim success", () => {
  for (const [field, value, expectedReason] of [
    ["anonymous", false, "CAPTURE_BOUNDARY_DENIED"],
    ["authorizationHeaderPresent", true, "CAPTURE_BOUNDARY_DENIED"],
    ["rawPayloadRetained", true, "CAPTURE_BOUNDARY_DENIED"],
    ["procedureContentReturned", true, "CAPTURE_BOUNDARY_DENIED"],
    ["externalStateChanged", true, "CAPTURE_BOUNDARY_DENIED"],
  ]) {
    const input = validEvidence();
    input.capture[field] = value;
    const receipt = validatePublicReadback(input);
    assert.equal(receipt.validatorVerdict, "DENIED");
    assert.equal(receipt.publicReadbackVerdict, "DENIED");
    assert.equal(receipt.successClaimed, false);
    assert.deepEqual(receipt.reasons, [expectedReason]);
    assertSelfDigest(receipt);
  }

  const mismatch = validEvidence();
  mismatch.observed.publicRecordDigest = "sha256:cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc";
  const receipt = validatePublicReadback(mismatch);
  assert.equal(receipt.successClaimed, false);
  assert.deepEqual(receipt.reasons, ["PUBLIC_RECORD_MISMATCH"]);
});

test("the CLI dry-run is deterministic, network-free, and returns the prepared bounded receipt", () => {
  const first = execFileSync(process.execPath, ["scripts/cks-09-validate-public-readback.mjs", "--dry-run"], { cwd: root, encoding: "utf8" });
  const second = execFileSync(process.execPath, ["scripts/cks-09-validate-public-readback.mjs", "--dry-run"], { cwd: root, encoding: "utf8" });
  assert.equal(first, second);
  const receipt = JSON.parse(first);
  assert.equal(receipt.validatorVerdict, "PASS");
  assert.equal(receipt.publicReadbackVerdict, "INCONCLUSIVE");
  assert.equal(receipt.successClaimed, false);
  assert.equal(receipt.executionBoundary.networkPerformedByValidator, false);
  assertSelfDigest(receipt);
});

test("the CLI fails closed for unreadable evidence rather than claiming a public-readback success", () => {
  const result = spawnSync(process.execPath, [
    "scripts/cks-09-validate-public-readback.mjs",
    "--dry-run",
    "--evidence",
    "tests/fixtures/cks-09/does-not-exist.json",
  ], { cwd: root, encoding: "utf8" });
  assert.equal(result.status, 1);
  const receipt = JSON.parse(result.stdout);
  assert.equal(receipt.validatorVerdict, "DENIED");
  assert.equal(receipt.successClaimed, false);
  assert.deepEqual(receipt.reasons, ["EVIDENCE_SHAPE_DENIED"]);
});
