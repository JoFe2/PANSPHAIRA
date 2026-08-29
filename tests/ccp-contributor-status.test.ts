import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  canonicalCcpContributorStatusJsonV1,
  parseCcpContributorStatusV1,
  projectCcpContributorStatusV1,
  verifyCcpContributorStatusV1,
  CCP_CONTRIBUTOR_STATUS_SCHEMA_V1,
  type CcpContributorStatusInputV1,
} from "../packages/contracts/src/ccp-contributor-status.js";
import { ccpDigestDomainV1 } from "../packages/contracts/src/ccp-event-envelope.js";

const fixture = (name: string): any =>
  JSON.parse(readFileSync(`tests/fixtures/ccp-status/${name}`, "utf8"));

const digest = (character: string): string => character.repeat(64);

const completeInput = (): CcpContributorStatusInputV1 => ({
  schemaVersion: "cm.ccp-contributor-status-input/v1",
  ledgerId: "ledger:contributor-status",
  tenantId: "tenant:synthetic",
  repositoryId: "repository:pansphaira",
  contributionId: "contribution:status-queued",
  admissionState: "ADMITTED",
  headState: "CURRENT",
  queued: true,
  migrationState: "CURRENT",
  lkgState: "UNCHANGED",
  requiredEvidenceRefs: ["evidence:admission-receipt", "evidence:queue-receipt"],
  presentEvidenceRefs: ["evidence:admission-receipt", "evidence:queue-receipt"],
  admissionReceiptDigest: digest("a"),
  queueReceiptDigest: digest("b"),
  quarantineReceiptDigest: null,
  migrationReceiptDigest: null,
  lkgRestoreReceiptDigest: null,
  privateDetails: "private-only contributor detail",
});

function statusWith(overrides: Partial<CcpContributorStatusInputV1>): CcpContributorStatusInputV1 {
  return { ...completeInput(), ...overrides };
}

test("CCP-PSAI52-CONTRIBUTOR-STATUS-001 projects all canonical contributor states", () => {
  const missing = projectCcpContributorStatusV1(fixture("missing-evidence.json"));
  const rebase = projectCcpContributorStatusV1(fixture("rebase-required.json"));
  const quarantined = projectCcpContributorStatusV1(fixture("quarantined.json").quarantined);
  const restored = projectCcpContributorStatusV1(fixture("quarantined.json").restored);
  const queued = projectCcpContributorStatusV1(completeInput());
  const superseded = projectCcpContributorStatusV1(statusWith({
    contributionId: "contribution:status-superseded",
    queued: false,
    headState: "SUPERSEDED",
  }));

  assert.deepEqual(
    [queued.status, superseded.status, quarantined.status, missing.status, rebase.status, restored.status],
    ["QUEUED", "SUPERSEDED", "QUARANTINED", "MISSING_EVIDENCE", "REBASE_REQUIRED", "LKG_RESTORED"],
  );
  assert.deepEqual(
    [queued.reasonCode, superseded.reasonCode, quarantined.reasonCode, missing.reasonCode, rebase.reasonCode, restored.reasonCode],
    [
      "QUEUED_WITH_COMPLETE_EVIDENCE",
      "HEAD_SUPERSEDED",
      "CONTRIBUTION_QUARANTINED",
      "REQUIRED_EVIDENCE_MISSING",
      "MIGRATION_REBASE_REQUIRED",
      "LKG_RESTORED",
    ],
  );
  assert.ok([queued, superseded, quarantined, missing, rebase, restored].every((item) => item.readOnly));
  assert.ok([queued, superseded, quarantined, missing, rebase, restored].every((item) => !item.queueStateChanged));
  assert.ok([queued, superseded, quarantined, missing, rebase, restored].every((item) => !item.mergeAuthorized));
  assert.equal(missing.evidence.complete, false);
  assert.equal(missing.evidence.missingCount, 1);
  assert.equal(rebase.evidence.complete, true);
  assert.equal(restored.receiptDigests.lkgRestore, digest("9"));
});

test("CCP-PSAI52-CONTRIBUTOR-STATUS-002 is deterministic, frozen and read-only", () => {
  const input = completeInput();
  const before = JSON.stringify(input);
  const first = projectCcpContributorStatusV1(input);
  const second = projectCcpContributorStatusV1(structuredClone(input));

  assert.equal(JSON.stringify(input), before);
  assert.equal(first.schemaVersion, CCP_CONTRIBUTOR_STATUS_SCHEMA_V1);
  assert.equal(canonicalCcpContributorStatusJsonV1(first), canonicalCcpContributorStatusJsonV1(second));
  assert.equal(first.statusDigest, second.statusDigest);
  assert.equal(Object.isFrozen(first), true);
  assert.equal(Object.isFrozen(first.evidence), true);
  assert.equal(Object.isFrozen(first.receiptDigests), true);
  assert.equal(verifyCcpContributorStatusV1(first)?.statusDigest, first.statusDigest);

  // A semantically equivalent reorder has the same canonical projection.
  const reordered = { ...input, requiredEvidenceRefs: [...input.requiredEvidenceRefs].reverse(), presentEvidenceRefs: [...input.presentEvidenceRefs].reverse() };
  assert.equal(
    projectCcpContributorStatusV1(reordered).statusDigest,
    first.statusDigest,
  );
});

test("CCP-PSAI52-CONTRIBUTOR-STATUS-003 never claims queue success without required evidence", () => {
  const missingReference = projectCcpContributorStatusV1(fixture("missing-evidence.json"));
  assert.equal(missingReference.status, "MISSING_EVIDENCE");
  assert.notEqual(missingReference.status, "QUEUED");

  const missingQueueReceipt = projectCcpContributorStatusV1(statusWith({ queueReceiptDigest: null }));
  assert.equal(missingQueueReceipt.status, "MISSING_EVIDENCE");
  assert.equal(missingQueueReceipt.evidence.receiptEvidenceComplete, false);
  assert.equal(missingQueueReceipt.evidence.complete, false);
  assert.equal(missingQueueReceipt.reasonCode, "REQUIRED_EVIDENCE_MISSING");
});

test("CCP-PSAI52-CONTRIBUTOR-STATUS-004 malformed and rehashed forged statuses deny", () => {
  assert.throws(() => projectCcpContributorStatusV1({}), /CCP_CONTRIBUTOR_STATUS_INPUT_SCHEMA_DENIED/);
  const legitimate = projectCcpContributorStatusV1(completeInput());
  const forged = structuredClone(legitimate) as Record<string, any>;
  forged.status = "MISSING_EVIDENCE";
  forged.reasonCode = "REQUIRED_EVIDENCE_MISSING";
  forged.nextAction = "PROVIDE_REQUIRED_EVIDENCE";
  forged.evidence.complete = false;
  const { statusDigest: _statusDigest, ...unsigned } = forged;
  forged.statusDigest = ccpDigestDomainV1(CCP_CONTRIBUTOR_STATUS_SCHEMA_V1, unsigned);
  assert.throws(() => parseCcpContributorStatusV1(forged), /CCP_CONTRIBUTOR_STATUS_SCHEMA_DENIED/);
  assert.equal(verifyCcpContributorStatusV1(forged), null);
  assert.throws(
    () => parseCcpContributorStatusV1({ ...legitimate, privateDetails: "must be rejected" }),
    /CCP_CONTRIBUTOR_STATUS_SCHEMA_DENIED/,
  );
});
