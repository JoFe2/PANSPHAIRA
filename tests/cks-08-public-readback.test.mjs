import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  CKS_08_PUBLIC_READBACK_RECEIPT_SCHEMA_V1,
  canonicalDigest,
  renderPublicReadbackDryRun,
  validatePublicReadbackTemplate,
} from "../scripts/cks-08-validate-public-readback.mjs";

const template = () => JSON.parse(readFileSync("verification/cks-08-public-readback-template-v1.json", "utf8"));

test("CKS-08 prepublication public-readback validator renders a deterministic privacy-safe bounded receipt", () => {
  const source = template();
  const first = renderPublicReadbackDryRun(source);
  const second = renderPublicReadbackDryRun(structuredClone(source));

  assert.deepEqual(second, first);
  assert.equal(first.schemaVersion, CKS_08_PUBLIC_READBACK_RECEIPT_SCHEMA_V1);
  assert.equal(first.status, "PREPARED_DRY_RUN");
  assert.equal(first.execution.networkCalls, 0);
  assert.equal(first.execution.externalStateMutated, false);
  assert.equal(first.execution.credentialsRead, false);
  assert.equal(first.publicReadback.readbackExecuted, false);
  assert.equal(first.publicReadback.readbackSuccessClaimed, false);
  assert.equal(first.publicReadback.requiredEvidencePresent, false);
  assert.equal(first.publicReadback.requiredEvidence.length, 5);
  assert.equal(first.receiptDigest, canonicalDigest(first, "receiptDigest"));
});

test("CKS-08 prepublication public-readback validator preserves privacy and process boundaries", () => {
  const receipt = renderPublicReadbackDryRun(template());
  assert.equal(receipt.processContext.operatingModel, "Operating Model v1.1");
  assert.deepEqual(receipt.processContext.priorDecisions, ["D-001", "D-002", "D-003", "D-004", "D-005", "D-006", "D-007"]);
  assert.equal(receipt.processContext.processVariantCreated, false);
  assert.equal(receipt.privacy.rawPublicContentEmitted, false);
  assert.equal(receipt.privacy.credentialsOrPersonalDataEmitted, false);
  assert.deepEqual(receipt.publicReadback.requiredEvidence.map(({ state }) => state), Array(5).fill("PENDING_PUBLIC_STATE"));
});

test("CKS-08 public-readback validator fails closed when required evidence or a success boundary is altered", () => {
  const missingEvidence = template();
  missingEvidence.requiredEvidence.pop();
  assert.throws(() => validatePublicReadbackTemplate(missingEvidence), /required evidence set denied/);

  const successClaim = template();
  successClaim.precondition.publicStateExists = true;
  assert.throws(() => validatePublicReadbackTemplate(successClaim), /prepublication boundary denied/);

  const privacyExpansion = template();
  privacyExpansion.privacy.rawPublicContentEmitted = true;
  assert.throws(() => validatePublicReadbackTemplate(privacyExpansion), /privacy boundary denied/);
});
