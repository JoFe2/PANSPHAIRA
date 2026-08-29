import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  ASF_ROLLBACK_ABSENT_LKG_DIGEST_V1,
  ASF_ROLLBACK_AUTHORITY_V1,
  ASF_ROLLBACK_DECISION_REASON_DISABLE_V1,
  ASF_ROLLBACK_DECISION_REASON_LKG_V1,
  ASF_ROLLBACK_EXIT_CODES_V1,
  ASF_ROLLBACK_RUNTIME_EFFECT_V1,
  asfRollbackReceiptDigestV1,
  decideAsfRollbackV1,
  parseAsfRollbackV1,
  validateAsfRollbackReceiptV1,
  type AsfRollbackInputV1,
  type AsfRollbackReasonCodeV1,
} from "../packages/contracts/src/asf-rollback.js";
import { canonicalJson } from "../packages/contracts/src/canonical-json.js";

const acceptedInstall = JSON.parse(readFileSync("tests/fixtures/asf-inactive-install/accepted.json", "utf8")) as Record<string, any>;
const exactLkgFixture = JSON.parse(readFileSync("tests/fixtures/asf-rollback/exact-lkg.json", "utf8")) as Record<string, any>;
const mismatchedLkgFixture = JSON.parse(readFileSync("tests/fixtures/asf-rollback/mismatched-lkg.json", "utf8")) as Record<string, any>;
const residueFixture = JSON.parse(readFileSync("tests/fixtures/asf-rollback/residue.json", "utf8")) as Record<string, any>;

const lkg = exactLkgFixture.lkg;

const NEGATIVE_PROBES = [
  { outcome: "DENIED", probeId: "NO_AUTOMATIC_ROLLBACK" },
  { outcome: "DENIED", probeId: "NO_CROSS_SCOPE_MODIFICATION" },
  { outcome: "DENIED", probeId: "NO_PARTIAL_RESTORE" },
  { outcome: "DENIED", probeId: "NO_RUNTIME_EXECUTION" },
];

function sha256(value: unknown): string {
  return createHash("sha256").update(canonicalJson(value)).digest("hex");
}

function beforeRecords(): Record<string, any>[] {
  return [
    {
      generationDigest: acceptedInstall.generation.generationDigest,
      lockIdentity: acceptedInstall.generation.lockDigest,
      skillId: acceptedInstall.generation.skillId,
      state: "ACTIVE",
      version: acceptedInstall.generation.version,
    },
    {
      generationDigest: acceptedInstall.installed[0].generationDigest,
      lockIdentity: acceptedInstall.installed[0].lockDigest,
      skillId: acceptedInstall.installed[0].skillId,
      state: acceptedInstall.installed[0].state,
      version: acceptedInstall.installed[0].version,
    },
  ];
}

// Byte-identical restoration of the LKG tuple: target scope swapped to the LKG,
// every unrelated record carried over verbatim.
function restoredRecords(): Record<string, any>[] {
  return beforeRecords().map((record) =>
    record.skillId === lkg.skillId
      ? { generationDigest: lkg.generationDigest, lockIdentity: lkg.lockIdentity, skillId: lkg.skillId, state: "ACTIVE", version: lkg.version }
      : record,
  );
}

function readbackFor(records: Record<string, any>[]): Record<string, any> {
  return { digest: sha256({ records }), records };
}

function inputFor(opts: { lkg?: Record<string, any>[]; readback?: Record<string, any> } = {}): AsfRollbackInputV1 {
  const before = beforeRecords();
  // Deep-clone the shared fixture references: sub-cases mutate their inputs
  // (automatic, requesterClass, approval digest, negative probes), and node:test
  // runs sequentially in one process, so un-cloned references would leak.
  return {
    schemaVersion: "chimpmaera.asf/rollback/v1",
    analysisReceipt: structuredClone(acceptedInstall.analysisReceipt),
    analysisStatus: "FRESH",
    approval: structuredClone(exactLkgFixture.approval),
    beforeSnapshot: { digest: sha256({ records: before }), records: before },
    candidate: {
      generationDigest: acceptedInstall.generation.generationDigest,
      lockDigest: acceptedInstall.generation.lockDigest,
      skillId: acceptedInstall.generation.skillId,
      version: acceptedInstall.generation.version,
    },
    lkg: opts.lkg ?? structuredClone([lkg]),
    negativeProbes: structuredClone(NEGATIVE_PROBES),
    readback: opts.readback ?? readbackFor(restoredRecords()),
    rollbackRequest: structuredClone(exactLkgFixture.rollbackRequest),
  } as unknown as AsfRollbackInputV1;
}

function refreshApproval(input: AsfRollbackInputV1): void {
  (input as any).approval.requestDigest = sha256(input.rollbackRequest);
}

function denied(value: unknown, reason: AsfRollbackReasonCodeV1): void {
  const result = decideAsfRollbackV1(value);
  assert.deepEqual(result, {
    outcome: "DENIED",
    reasonCodes: [reason],
    exitCode: ASF_ROLLBACK_EXIT_CODES_V1[reason],
    failClosed: { affectedScope: "DISABLE_OR_RETAIN_LKG", unrelatedAcceptedGenerations: "UNCHANGED" },
  });
}

test("a failed synthetic candidate restores the byte-identical LKG tuple with a stable rollback receipt", () => {
  const input = inputFor();
  const before = structuredClone(input);
  const result = decideAsfRollbackV1(input);
  assert.equal(result.outcome, "ACCEPTED");
  if (result.outcome !== "ACCEPTED") return;

  assert.deepEqual(input, before);
  assert.deepEqual(result.reasonCodes, ["ASF_ROLLBACK_ACCEPTED"]);
  assert.equal(result.exitCode, 0);
  assert.equal(result.result, "LKG_RESTORED");
  assert.equal(result.stateTransition.applied, false);
  assert.equal(result.stateTransition.beforeSnapshotDigest, input.beforeSnapshot.digest);
  assert.equal(result.stateTransition.afterSnapshotDigest, input.readback.digest);
  assert.equal(result.receipt.requestId, input.rollbackRequest.requestId);
  assert.equal(result.receipt.approverClass, "ASF_RING_APPROVER_V1");
  assert.equal(result.receipt.decisionReason, ASF_ROLLBACK_DECISION_REASON_LKG_V1);
  assert.equal(result.receipt.candidateGenerationDigest, input.candidate.generationDigest);
  assert.equal(result.receipt.candidateLockDigest, input.candidate.lockDigest);
  assert.equal(result.receipt.lkgGenerationDigest, lkg.generationDigest);
  assert.equal(result.receipt.lkgLockIdentity, lkg.lockIdentity);
  assert.equal(result.receipt.beforeSnapshotDigest, input.beforeSnapshot.digest);
  assert.equal(result.receipt.afterSnapshotDigest, input.readback.digest);
  assert.equal(result.receipt.readbackDigest, input.readback.digest);
  assert.equal(result.receipt.skillId, input.candidate.skillId);
  assert.deepEqual(result.receipt.targetScope, input.rollbackRequest.targetScope);
  assert.equal(result.receipt.runtimeEffect, ASF_ROLLBACK_RUNTIME_EFFECT_V1);
  assert.deepEqual(result.receipt.authority, ASF_ROLLBACK_AUTHORITY_V1);
  assert.equal(validateAsfRollbackReceiptV1(result.receipt), true);
  assert.equal(result.receiptDigest, asfRollbackReceiptDigestV1(result.receipt));
  assert.equal(result.receiptJson, canonicalJson(result.receipt));

  // Exact restoration: the projected target is the LKG tuple and nothing else moved.
  const target = result.projection.records.find((record) => record.skillId === lkg.skillId);
  assert.deepEqual(target, { generationDigest: lkg.generationDigest, lockIdentity: lkg.lockIdentity, skillId: lkg.skillId, state: "ACTIVE", version: lkg.version });
  const unrelated = result.projection.records.find((record) => record.skillId === "skill:unrelated");
  assert.deepEqual(unrelated, input.beforeSnapshot.records.find((record) => record.skillId === "skill:unrelated"));
  assert.deepEqual(result.projection.records, input.readback.records);
  assert.equal(result.projection.snapshotDigest, input.readback.digest);

  // Stable receipt: an identical re-evaluation yields the identical receipt.
  const reEvaluated = decideAsfRollbackV1(structuredClone(input));
  assert.equal(reEvaluated.outcome, "ACCEPTED");
  if (reEvaluated.outcome !== "ACCEPTED") return;
  assert.deepEqual(reEvaluated.receipt, result.receipt);
});

test("a missing valid LKG disables only the declared scope while the unrelated accepted generation is unchanged", () => {
  const disabled = beforeRecords().map((record) =>
    record.skillId === lkg.skillId ? { ...record, state: "DISABLED" } : record,
  );
  const input = inputFor({ lkg: [], readback: readbackFor(disabled) });
  const result = decideAsfRollbackV1(input);
  assert.equal(result.outcome, "ACCEPTED");
  if (result.outcome !== "ACCEPTED") return;

  assert.equal(result.result, "SCOPE_DISABLED");
  assert.equal(result.receipt.decisionReason, ASF_ROLLBACK_DECISION_REASON_DISABLE_V1);
  assert.equal(result.receipt.lkgGenerationDigest, ASF_ROLLBACK_ABSENT_LKG_DIGEST_V1);
  assert.equal(result.receipt.lkgLockIdentity, ASF_ROLLBACK_ABSENT_LKG_DIGEST_V1);
  assert.equal(result.receipt.afterSnapshotDigest, input.readback.digest);
  const target = result.projection.records.find((record) => record.skillId === lkg.skillId);
  assert.deepEqual(target, {
    generationDigest: input.candidate.generationDigest,
    lockIdentity: input.candidate.lockDigest,
    skillId: input.candidate.skillId,
    state: "DISABLED",
    version: input.candidate.version,
  });
  assert.deepEqual(
    result.projection.records.filter((record) => record.skillId !== lkg.skillId),
    input.beforeSnapshot.records.filter((record) => record.skillId !== lkg.skillId),
  );
  assert.equal(validateAsfRollbackReceiptV1(result.receipt), true);
});

test("repeated identical evaluations are deterministic and canonical parsing agrees", () => {
  const first = decideAsfRollbackV1(inputFor());
  const second = decideAsfRollbackV1(structuredClone(inputFor()));
  assert.equal(first.outcome, "ACCEPTED");
  assert.deepEqual(second, first);

  const parsed = parseAsfRollbackV1(canonicalJson(inputFor()));
  assert.equal(parsed.outcome, "ACCEPTED");
  if (parsed.outcome !== "ACCEPTED") return;
  assert.deepEqual(parsed, first);
  assert.equal(parsed.receipt.runtimeEffect, "NOT_RUN");
  assert.equal(parsed.receipt.authority.rollback, "DECISION_ONLY");
  assert.equal("runtime" in parsed, false);
  assert.equal("callback" in parsed, false);
});

test("mismatched, revoked, or mutable LKG evidence fails closed", () => {
  denied(inputFor({ lkg: [mismatchedLkgFixture.lkg] }), "LKG_MISMATCH_DENIED");
  denied(inputFor({ lkg: [{ ...lkg, status: "REVOKED" }] }), "LKG_REVOKED_DENIED");
  denied(inputFor({ lkg: [{ ...lkg, locator: "asf-bundle+sha256:latest" }] }), "LKG_MUTABLE_DENIED");
  denied(
    inputFor({
      lkg: [
        {
          ...lkg,
          generationDigest: acceptedInstall.generation.generationDigest,
          lockIdentity: acceptedInstall.generation.lockDigest,
          version: acceptedInstall.generation.version,
        },
      ],
    }),
    "LKG_MISMATCH_DENIED",
  );
  denied(inputFor({ lkg: [lkg, { ...lkg }] }), "LKG_MISMATCH_DENIED");
});

test("required fail-closed probes deny the rollback", () => {
  denied({}, "SCHEMA_DENIED");

  const unsupported = inputFor();
  (unsupported as any).schemaVersion = "chimpmaera.asf/rollback/v2";
  denied(unsupported, "UNSUPPORTED_VERSION_DENIED");

  const automatic = inputFor();
  (automatic as any).rollbackRequest.automatic = true;
  denied(automatic, "AUTO_ROLLBACK_DENIED");

  const mutableTarget = inputFor();
  (mutableTarget as any).rollbackRequest.targetScope.routeId = "route:latest";
  refreshApproval(mutableTarget);
  denied(mutableTarget, "MUTABLE_ALIAS_OR_RANGE_DENIED");

  const selfApproval = inputFor();
  (selfApproval as any).rollbackRequest.requesterClass = "ASF_RING_APPROVER_V1";
  refreshApproval(selfApproval);
  denied(selfApproval, "SELF_APPROVAL_DENIED");

  const noApproval = inputFor();
  (noApproval as any).approval.decision = "REJECT";
  denied(noApproval, "MISSING_APPROVAL_DENIED");

  const drift = inputFor();
  (drift as any).approval.requestDigest = "0".repeat(64);
  denied(drift, "DIGEST_MISMATCH_DENIED");

  const revokedAnalysis = inputFor();
  (revokedAnalysis as any).analysisStatus = "REVOKED";
  denied(revokedAnalysis, "ANALYSIS_REVOKED_DENIED");

  const staleAnalysis = inputFor();
  (staleAnalysis as any).analysisStatus = "STALE";
  denied(staleAnalysis, "ANALYSIS_STALE_DENIED");

  const badEvidence = inputFor();
  (badEvidence as any).analysisReceipt = { ...badEvidence.analysisReceipt, evidenceDigest: "1".repeat(64) };
  denied(badEvidence, "EVIDENCE_MISSING_DENIED");

  const missingReadback = inputFor({ readback: { digest: "0".repeat(64), records: [] } });
  denied(missingReadback, "MISSING_READBACK_DENIED");

  const readbackDigestDrift = inputFor({ readback: { digest: "1".repeat(64), records: restoredRecords() } });
  denied(readbackDigestDrift, "DIGEST_MISMATCH_DENIED");

  const residue = inputFor({ readback: residueFixture });
  denied(residue, "RESIDUE_DENIED");

  const partial = inputFor({
    readback: readbackFor(
      restoredRecords().map((record) => (record.skillId === lkg.skillId ? { ...record, version: "0.8.0" } : record)),
    ),
  });
  denied(partial, "PARTIAL_RESTORE_DENIED");

  const crossScope = inputFor({
    readback: readbackFor(
      restoredRecords().map((record) => (record.skillId === "skill:unrelated" ? { ...record, generationDigest: "0".repeat(64) } : record)),
    ),
  });
  denied(crossScope, "CROSS_SCOPE_DENIED");

  const droppedRecord = inputFor({ readback: readbackFor(restoredRecords().filter((record) => record.skillId !== "skill:unrelated")) });
  denied(droppedRecord, "CROSS_SCOPE_DENIED");

  const extraRecord = inputFor({
    readback: readbackFor([
      ...restoredRecords(),
      { generationDigest: "2".repeat(64), lockIdentity: "2".repeat(64), skillId: "skill:extra", state: "ACTIVE", version: "1.0.0" },
    ]),
  });
  denied(extraRecord, "RESIDUE_DENIED");

  const inactiveBefore = inputFor();
  const inactiveRecords = beforeRecords().map((record) => (record.skillId === lkg.skillId ? { ...record, state: "DISABLED" } : record));
  (inactiveBefore as any).beforeSnapshot = readbackFor(inactiveRecords);
  denied(inactiveBefore, "DIGEST_MISMATCH_DENIED");

  const badProbes = inputFor();
  (badProbes as any).negativeProbes = NEGATIVE_PROBES.slice(0, 3);
  denied(badProbes, "NEGATIVE_PROBE_DENIED");

  const wrongProbe = inputFor();
  (wrongProbe as any).negativeProbes = [...NEGATIVE_PROBES.slice(0, 3), { outcome: "DENIED", probeId: "NO_SKIP_ROLLBACK" }];
  denied(wrongProbe, "NEGATIVE_PROBE_DENIED");
});

test("non-canonical encodings and negative parse probes are rejected without authority", () => {
  const input = inputFor();
  const nonCanonical = parseAsfRollbackV1(JSON.stringify(input));
  assert.equal(nonCanonical.outcome, "DENIED");
  if (nonCanonical.outcome !== "DENIED") return;
  assert.deepEqual(nonCanonical.reasonCodes, ["NONCANONICAL_ENCODING_DENIED"]);

  const invalid = parseAsfRollbackV1("not-json");
  assert.deepEqual(invalid.reasonCodes, ["INVALID_JSON_DENIED"]);
  assert.equal(invalid.exitCode, ASF_ROLLBACK_EXIT_CODES_V1.INVALID_JSON_DENIED);

  const notString = parseAsfRollbackV1({} as unknown as string);
  assert.deepEqual(notString.reasonCodes, ["INVALID_JSON_DENIED"]);

  const duplicateKey = canonicalJson(input).replace(
    '"skillId":"skill:qwen.synthetic"',
    '"skillId":"skill:qwen.synthetic","skillId":"skill:qwen.synthetic"',
  );
  const duplicated = parseAsfRollbackV1(duplicateKey);
  assert.deepEqual(duplicated.reasonCodes, ["DUPLICATE_KEY_DENIED"]);
});

test("rollback receipt validation rejects tampered receipts", () => {
  const accepted = decideAsfRollbackV1(inputFor());
  assert.equal(accepted.outcome, "ACCEPTED");
  if (accepted.outcome !== "ACCEPTED") return;
  assert.equal(validateAsfRollbackReceiptV1(accepted.receipt), true);
  assert.equal(validateAsfRollbackReceiptV1({ ...accepted.receipt, result: "SCOPE_DISABLED" }), false);
  assert.equal(validateAsfRollbackReceiptV1({ ...accepted.receipt, receiptDigest: "0".repeat(64) }), false);
  assert.equal(validateAsfRollbackReceiptV1({ ...accepted.receipt, readbackDigest: "1".repeat(64) }), false);
});