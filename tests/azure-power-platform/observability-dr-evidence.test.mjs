import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import Ajv2020 from "ajv/dist/2020.js";
import { applyNegativeCase, loadFixture, validateObservabilityDrEvidence } from "../../tools/azure-power-platform/validate-observability-dr-evidence.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const validPath = "tests/fixtures/azure-power-platform/observability-dr-valid.json";
const unsafePath = "tests/fixtures/azure-power-platform/observability-dr-unsafe.json";
const schema = JSON.parse(await readFile(path.join(root, "docs/development/azure-power-platform/observability-dr-evidence.schema.json"), "utf8"));
const validateSchema = new Ajv2020({ allErrors: true, strict: true }).compile(schema);
const valid = await loadFixture(validPath, root);
const unsafe = await loadFixture(unsafePath, root);

const negativeCases = [
  ["receipt-readback-mismatch", "RECEIPT_READBACK_MISMATCH_DENIED"],
  ["missing-event-sequence", "MISSING_EVENT_SEQUENCE_DENIED"],
  ["altered-digest", "ALTERED_DIGEST_DENIED"],
  ["stale-policy", "STALE_POLICY_DENIED"],
  ["revoked-policy", "REVOKED_POLICY_DENIED"],
  ["inferred-rollback", "INFERRED_ROLLBACK_DENIED"],
  ["absent-zero-residue", "ZERO_RESIDUE_ABSENT_DENIED"],
  ["mutable-evidence-reference", "MUTABLE_EVIDENCE_REFERENCE_DENIED"],
  ["tenant-identifier", "TENANT_IDENTIFIER_DENIED"],
  ["personal-identity", "PERSONAL_IDENTITY_DENIED"],
  ["credential", "CREDENTIAL_DENIED"],
  ["private-path", "PRIVATE_PATH_DENIED"],
  ["internal-host", "INTERNAL_HOST_DENIED"],
  ["retention-claim", "RETENTION_CLAIM_DENIED"],
  ["rto-rpo-claim", "RTO_RPO_CLAIM_DENIED"],
  ["actual-dr-assertion", "ACTUAL_DR_ASSERTION_DENIED"],
];

function keys(value) {
  if (Array.isArray(value)) return value.flatMap(keys);
  if (value === null || typeof value !== "object") return [];
  return Object.entries(value).flatMap(([key, child]) => [key, ...keys(child)]);
}

test("accepts canonical local synthetic telemetry and binds every accepted operation to authoritative readback and receipt", async () => {
  assert.equal(validateSchema(valid), true, JSON.stringify(validateSchema.errors));
  const result = await validateObservabilityDrEvidence(valid);
  assert.equal(result.accepted, true, JSON.stringify(result));
  assert.equal(result.status, "VALIDATED");
  assert.equal(result.report.recovery.executionClass, "LOCAL_SYNTHETIC_EXERCISE");
  assert.equal(result.report.recovery.target, "EXACT_ACCEPTED_LKG_FULL_TUPLE");
  assert.equal(result.report.recovery.zeroOwnedResidue, true);
  assert.equal(valid.operations.length, 2);
  for (const operation of valid.operations) {
    assert.equal(operation.event.outcome, "ACCEPTED");
    assert.equal(operation.readback.source, "LOCAL_SYNTHETIC_AUTHORITATIVE_READBACK");
    assert.equal(operation.readback.eventDigest, operation.event.eventDigest);
    assert.equal(operation.receipt.readbackDigest, operation.readback.readbackDigest);
  }
});

test("emits a report with limitations and evidence digests but no operational identifiers", async () => {
  const result = await validateObservabilityDrEvidence(valid);
  assert.equal(result.accepted, true);
  assert.equal(result.report.redacted, true);
  assert.deepEqual(result.report.limitations, valid.limitations);
  assert.deepEqual(result.report.evidenceDigests, valid.evidence.refs.map((ref) => ref.digest));
  assert.equal(keys(result.report).some((key) => /operationId|eventDigest|readbackDigest|receiptDigest|reference|\bid\b/i.test(key)), false);
  const rendered = JSON.stringify(result.report);
  for (const operation of valid.operations) assert.equal(rendered.includes(operation.event.operationId), false);
});

test("receipt/readback, sequence, digest, policy, recovery, residue, mutable-reference, and unsafe evidence cases fail closed", async () => {
  for (const [caseId, reasonCode] of negativeCases) {
    const result = await validateObservabilityDrEvidence(applyNegativeCase(valid, caseId));
    assert.equal(result.accepted, false, caseId);
    assert.equal(result.reasonCode, reasonCode, caseId);
    assert.deepEqual(result.report, { status: "DENIED", reasonCode, redacted: true }, caseId);
  }
});

test("the committed unsafe fixture is denied before any report can disclose it", async () => {
  const result = await validateObservabilityDrEvidence(unsafe);
  assert.equal(result.accepted, false);
  assert.equal(result.reasonCode, "TENANT_IDENTIFIER_DENIED");
  assert.deepEqual(result.report, { status: "DENIED", reasonCode: "TENANT_IDENTIFIER_DENIED", redacted: true });
});
