import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";
import { dryRun, validateClosureGateEvidence, validateTemplate } from "../scripts/cks-07-validate-public-readback.mjs";

const ROOT = resolve(import.meta.dirname, "..");
const SCRIPT = resolve(ROOT, "scripts/cks-07-validate-public-readback.mjs");
const TEMPLATE = resolve(ROOT, "verification/cks-07-public-readback-template-v1.json");
const RELEASE = resolve(ROOT, "docs/evidence/conveyor/sol-psai287-release-or-no-release-01.json");
const INTEGRATION = resolve(ROOT, "docs/evidence/conveyor/int-psai287-pr-ci-package-01.json");
const template = () => JSON.parse(readFileSync(TEMPLATE, "utf8"));

function run() {
  const nodeOptions = `${process.env.NODE_OPTIONS ?? ""} --jitless`.trim();
  return JSON.parse(execFileSync(process.execPath, [SCRIPT, "--template", TEMPLATE, "--dry-run"], {
    cwd: ROOT,
    encoding: "utf8",
    env: { ...process.env, NODE_OPTIONS: nodeOptions },
  }));
}

test("prepares a deterministic public-safe readback receipt without public execution", () => {
  const receipt = run();
  assert.deepEqual(receipt, dryRun(TEMPLATE));
  assert.deepEqual(receipt, template().expectedReceipt);
  assert.equal(receipt.decision, "PREPARED_DRY_RUN_ONLY");
  assert.equal(receipt.publicReadback.status, "NOT_EXECUTED");
  assert.equal(receipt.publicReadback.reason, "PUBLIC_STATE_EVIDENCE_NOT_COLLECTED");
  assert.equal(receipt.failClosed.networkUsed, false);
  assert.equal(receipt.failClosed.credentialUse, false);
  assert.equal(receipt.failClosed.publicReadbackSuccessClaimed, false);
});

test("requires local preflight and the anonymous public-readback entrypoint binding", () => {
  const receipt = run();
  assert.deepEqual(receipt.evidence.map(({ evidenceId, status }) => ({ evidenceId, status })), [
    { evidenceId: "LOCAL_RELEASE_GOVERNANCE_PREFLIGHT", status: "PASS" },
    { evidenceId: "READBACK_ENTRYPOINT_BINDING", status: "PASS" },
    { evidenceId: "ROOT_DELIVERY_CLOSURE_GUARD", status: "BLOCKED" },
  ]);
  assert.deepEqual(receipt.publicReadback.command, ["node", "scripts/verify-release-governance.mjs", "--public-readback"]);
  assert.equal(receipt.publicReadback.authentication, "ANONYMOUS_GH_TOKEN_UNSET");
  assert.equal(receipt.publicReadback.activationCondition, "POST_PUBLICATION_WITH_PUBLIC_STATE_EVIDENCE");
});

test("release mismatch and the immutable artifact path-boundary violation block closure", () => {
  const release = JSON.parse(readFileSync(RELEASE, "utf8"));
  const integration = JSON.parse(readFileSync(INTEGRATION, "utf8"));
  assert.doesNotThrow(() => validateClosureGateEvidence(release, integration));
  assert.deepEqual(run().closureGate, {
    taskId: "CLOSURE-PSAI287-ROOT-DELIVERY-01",
    releaseRequired: true,
    releaseDisposition: "RELEASE_REQUIRED_PENDING_AUTHORIZED_EXECUTION",
    publicReadbackRequired: true,
    issueCloseRequired: true,
    declaredArtifactPathBoundary: "closure-audits/CLOSURE-PSAI287-ROOT-DELIVERY-01/**",
    changedPathCount: 47,
    insideBoundaryCount: 0,
    outsideBoundaryCount: 47,
    status: "BLOCKED",
  });

  const noRelease = structuredClone(release);
  noRelease.localDisposition.value = "NO_RELEASE";
  assert.throws(() => validateClosureGateEvidence(noRelease, integration), /RELEASE_DISPOSITION_MISMATCH/);
  const falseBoundaryPass = structuredClone(integration);
  falseBoundaryPass.artifactPathBoundary.status = "PASS";
  assert.throws(() => validateClosureGateEvidence(release, falseBoundaryPass), /INTEGRATION_PATH_BOUNDARY_INVALID/);
});

test("missing required evidence and a public-readback success claim are denied before execution", () => {
  const missingEvidence = template();
  missingEvidence.requiredEvidence.pop();
  assert.throws(() => validateTemplate(missingEvidence), /CKS_07_PUBLIC_READBACK_REQUIRED_EVIDENCE_INVALID/);

  const falseSuccess = template();
  falseSuccess.expectedReceipt.publicReadback.status = "PASS";
  assert.throws(() => validateTemplate(falseSuccess), /CKS_07_PUBLIC_READBACK_EXPECTED_RECEIPT_INVALID/);
});

test("the receipt is deterministic and retains explicit non-claims", () => {
  const first = run();
  const second = run();
  assert.equal(JSON.stringify(first), JSON.stringify(second));
  assert.deepEqual(first.nonClaims, [
    "public state exists",
    "anonymous public readback passed",
    "CI",
    "merge",
    "release",
    "deployment",
    "production activation",
    "issue close",
  ]);
});
