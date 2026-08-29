import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  canonicalCcpEvidenceExplanationJsonV1,
  ccpEvidenceExplanationDigestV1,
  explainCcpContributorStatusV1,
  parseCcpEvidenceExplanationV1,
  verifyCcpEvidenceExplanationV1,
  CCP_EVIDENCE_EXPLANATION_REDACTED_FIELDS_V1,
  CCP_EVIDENCE_EXPLANATION_SCHEMA_V1,
} from "../packages/contracts/src/ccp-evidence-explanation.js";
import { ccpDigestDomainV1 } from "../packages/contracts/src/ccp-event-envelope.js";
import { projectCcpContributorStatusV1 } from "../packages/contracts/src/ccp-contributor-status.js";

const fixture = (name: string): any =>
  JSON.parse(readFileSync(`tests/fixtures/ccp-status/${name}`, "utf8"));

test("CCP-PSAI52-CONTRIBUTOR-STATUS-005 explanations cover missing, rebase, quarantine and restore", () => {
  const cases = [
    [fixture("missing-evidence.json"), "MISSING_EVIDENCE", "REQUIRED_EVIDENCE_MISSING"],
    [fixture("rebase-required.json"), "REBASE_REQUIRED", "MIGRATION_REBASE_REQUIRED"],
    [fixture("quarantined.json").quarantined, "QUARANTINED", "CONTRIBUTION_QUARANTINED"],
    [fixture("quarantined.json").restored, "LKG_RESTORED", "LKG_RESTORED"],
  ] as const;

  for (const [input, expectedStatus, expectedReason] of cases) {
    const status = projectCcpContributorStatusV1(input);
    const explanation = explainCcpContributorStatusV1(status);
    assert.equal(explanation.schemaVersion, CCP_EVIDENCE_EXPLANATION_SCHEMA_V1);
    assert.equal(explanation.status, expectedStatus);
    assert.equal(explanation.reasonCode, expectedReason);
    assert.equal(explanation.redacted, true);
    assert.equal(explanation.redactionPolicy, "PUBLIC_REASON_CODE_ONLY");
    assert.deepEqual([...explanation.redactedFields], [...CCP_EVIDENCE_EXPLANATION_REDACTED_FIELDS_V1]);
    assert.ok(explanation.publicMessage.length > 0);
    assert.equal(verifyCcpEvidenceExplanationV1(explanation)?.explanationDigest, explanation.explanationDigest);

    const serialized = JSON.stringify(explanation);
    assert.equal(serialized.includes("private-only contributor detail"), false);
    assert.equal(serialized.includes("private migration diagnostic"), false);
    assert.equal(serialized.includes("private quarantine reason"), false);
    assert.equal(serialized.includes("private restore diagnostic"), false);
    assert.equal(serialized.includes("customer@example.invalid"), false);
    assert.equal(serialized.includes("restricted metadata"), false);
    assert.equal(serialized.includes("suspicious payload fragment"), false);
    assert.equal(serialized.includes("failed verification details"), false);
    assert.equal(serialized.includes("rawEvidence"), true);
  }
});

test("CCP-PSAI52-CONTRIBUTOR-STATUS-006 queued and superseded explanations remain bounded", () => {
  const base = {
    schemaVersion: "cm.ccp-contributor-status-input/v1",
    ledgerId: "ledger:contributor-status",
    tenantId: "tenant:synthetic",
    repositoryId: "repository:pansphaira",
    contributionId: "contribution:explanation-queued",
    admissionState: "ADMITTED",
    headState: "CURRENT",
    queued: true,
    migrationState: "CURRENT",
    lkgState: "UNCHANGED",
    requiredEvidenceRefs: ["evidence:admission-receipt", "evidence:queue-receipt"],
    presentEvidenceRefs: ["evidence:admission-receipt", "evidence:queue-receipt"],
    admissionReceiptDigest: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
    queueReceiptDigest: "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
    quarantineReceiptDigest: null,
    migrationReceiptDigest: null,
    lkgRestoreReceiptDigest: null,
    privateDetails: "private queued note",
  };
  const queued = explainCcpContributorStatusV1(projectCcpContributorStatusV1(base));
  const superseded = explainCcpContributorStatusV1(projectCcpContributorStatusV1({
    ...base,
    contributionId: "contribution:explanation-superseded",
    queued: false,
    headState: "SUPERSEDED",
  }));
  assert.deepEqual(
    [queued.reasonCode, queued.nextAction, superseded.reasonCode, superseded.nextAction],
    ["QUEUED_WITH_COMPLETE_EVIDENCE", "WAIT_FOR_VERIFICATION", "HEAD_SUPERSEDED", "NO_ACTION_HEAD_SUPERSEDED"],
  );
  assert.equal(queued.evidence.complete, true);
  assert.equal(superseded.evidence.complete, true);
  assert.equal(JSON.stringify(queued).includes("private queued note"), false);
});

test("CCP-PSAI52-CONTRIBUTOR-STATUS-007 explanations are canonical, frozen and fail closed", () => {
  const status = projectCcpContributorStatusV1(fixture("rebase-required.json"));
  const explanation = explainCcpContributorStatusV1(status);
  const reordered = Object.fromEntries(Object.entries(explanation).reverse());
  assert.equal(canonicalCcpEvidenceExplanationJsonV1(explanation), canonicalCcpEvidenceExplanationJsonV1(reordered));
  assert.equal(ccpEvidenceExplanationDigestV1(reordered), explanation.explanationDigest);
  assert.equal(Object.isFrozen(explanation), true);
  assert.equal(Object.isFrozen(explanation.evidence), true);
  assert.equal(Object.isFrozen(explanation.redactedFields), true);

  const forged = structuredClone(explanation) as Record<string, any>;
  forged.publicMessage = "Evidence for contribution:secret was approved";
  const { explanationDigest: _explanationDigest, ...unsigned } = forged;
  forged.explanationDigest = ccpDigestDomainV1(CCP_EVIDENCE_EXPLANATION_SCHEMA_V1, unsigned);
  assert.throws(() => parseCcpEvidenceExplanationV1(forged), /CCP_EVIDENCE_EXPLANATION_SCHEMA_DENIED/);
  assert.equal(verifyCcpEvidenceExplanationV1(forged), null);

  assert.throws(
    () => explainCcpContributorStatusV1({}),
    /CCP_CONTRIBUTOR_STATUS_SCHEMA_DENIED/,
  );
});
