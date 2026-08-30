import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import type { CandidateGateSuccess, DetectionSuccess } from "../../src/cks-12/empty-kb-acquisition-gate.js";

const specifier = import.meta.url.endsWith(".ts")
  ? "../../src/cks-12/empty-kb-acquisition-gate.ts"
  : "../../src/cks-12/empty-kb-acquisition-gate.js";
const gate: typeof import("../../src/cks-12/empty-kb-acquisition-gate.js") = await import(specifier);

const fixturePath = "tests/fixtures/cks-12/empty-kb-acquisition-v1.json";
const receiptPath = "verification/cks-12/empty-kb-acquisition-receipt-v1.json";
const fixtureBytes = readFileSync(fixturePath);
const fixture = JSON.parse(fixtureBytes.toString("utf8")) as Record<string, unknown>;
const receipt = JSON.parse(readFileSync(receiptPath, "utf8")) as Record<string, unknown>;
const sha256 = (value: string | Uint8Array): string => createHash("sha256").update(value).digest("hex");
const clone = (): Record<string, unknown> => structuredClone(fixture);

function requireDetection(value: unknown): DetectionSuccess {
  const outcome = gate.detectNeedGap(value);
  assert.equal(outcome.status, "NEED_GAP_CONFIRMED");
  if (outcome.status !== "NEED_GAP_CONFIRMED") throw new Error("expected detection success");
  return outcome;
}

function requireCandidate(value: unknown): CandidateGateSuccess {
  const outcome = gate.runEmptyKbAcquisitionGate(value);
  assert.equal(outcome.status, "CANDIDATE_RECORDED");
  if (outcome.status !== "CANDIDATE_RECORDED") throw new Error("expected candidate success");
  return outcome;
}

test("AC-01: empty baseline produces a typed Need and confirmed missing-Knowledge gap", () => {
  const input = fixture.detection;
  const result = requireDetection(input);
  assert.equal((input as Record<string, unknown>).baseline && ((input as Record<string, unknown>).baseline as Record<string, unknown>).entries instanceof Array, true);
  assert.equal(result.gapClass, "MISSING_KNOWLEDGE");
  assert.equal(result.retrievalExhausted, true);
  assert.deepEqual(result.unresolvedRequirementIds, ["REQ-01", "REQ-02", "REQ-03", "REQ-04"]);
  assert.equal(result.need.decisionId, "synthetic-order-approval");
  assert.deepEqual(result.need.knowledgeClasses, ["POLICY", "PRICING", "APPLICABILITY"]);
  assert.equal(result.authority, "NONE");
  assert.equal(result.capabilityDelta, "NONE");
  assert.equal(result.effect, "NONE");
  assert.equal(result.successClaimed, false);
});

test("AC-01: requirement recall and false-completeness measurements are retained", () => {
  const result = requireDetection(fixture.detection);
  assert.deepEqual(result.requirementRecall, {
    matchedRequirementCount: 4,
    groundTruthRequirementCount: 4,
    rate: 1,
    missedRequirementIds: [],
  });
  assert.deepEqual(result.falseCompleteness, {
    falseCompleteCount: 0,
    completenessClaimCount: 0,
    rate: 0,
    unresolvedRequirementCountAtClaim: 0,
  });
});

test("AC-02: controlled acquisition records only an untrusted public-synthetic CANDIDATE", () => {
  const result = requireCandidate(fixture);
  assert.equal(result.status, "CANDIDATE_RECORDED");
  assert.equal(result.sourceEvidence.sourceKind, "PUBLIC_SYNTHETIC");
  assert.equal(result.sourceEvidence.acquisitionState, "ACQUIRED_UNTRUSTED");
  assert.equal(result.sourceEvidence.immutable, true);
  assert.equal(result.candidate.status, "CANDIDATE");
  assert.equal(result.promotionStatus, "NOT_PROMOTED");
  assert.equal(result.executionClaimed, false);
  assert.equal(result.productionClaimed, false);
  assert.equal(result.successClaimed, false);
  assert.equal(result.authority, "NONE");
  assert.equal(result.effect, "NONE");
});

test("AC-02: source, validation, and promotion boundaries fail closed", () => {
  const live = clone();
  (live.sourceEvidence as Record<string, unknown>).sourceKind = "LIVE_EXTERNAL";
  const deniedLive = gate.runEmptyKbAcquisitionGate(live);
  assert.equal(deniedLive.status, "DENIED");
  if (deniedLive.status === "DENIED") assert.ok(deniedLive.reasonCodes.includes("SOURCE_NOT_SYNTHETIC"));

  const untrusted = clone();
  (untrusted.sourceEvidence as Record<string, unknown>).acquisitionState = "VALIDATED";
  const deniedUntrusted = gate.runEmptyKbAcquisitionGate(untrusted);
  assert.equal(deniedUntrusted.status, "DENIED");
  if (deniedUntrusted.status === "DENIED") assert.ok(deniedUntrusted.reasonCodes.includes("SOURCE_NOT_UNTRUSTED"));

  const promotion = clone();
  promotion.promotionRequested = true;
  const deniedPromotion = gate.runEmptyKbAcquisitionGate(promotion);
  assert.equal(deniedPromotion.status, "DENIED");
  if (deniedPromotion.status === "DENIED") assert.ok(deniedPromotion.reasonCodes.includes("PROMOTION_DENIED"));

  const incompleteCandidate = clone();
  (incompleteCandidate.candidate as Record<string, unknown>).requirementIds = ["REQ-01"];
  const deniedIncompleteCandidate = gate.runEmptyKbAcquisitionGate(incompleteCandidate);
  assert.equal(deniedIncompleteCandidate.status, "DENIED");
  if (deniedIncompleteCandidate.status === "DENIED") assert.ok(deniedIncompleteCandidate.reasonCodes.includes("CANDIDATE_VALIDATION_FAILED"));
});

test("AC-07: false completeness cannot become acquisition success", () => {
  const falseComplete = clone();
  ((falseComplete.detection as Record<string, unknown>).solverAssessment as Record<string, unknown>).completenessClaimed = true;
  const detected = requireDetection(falseComplete.detection);
  assert.equal(detected.falseCompleteness.falseCompleteCount, 1);
  assert.equal(detected.falseCompleteness.rate, 1);
  const denied = gate.runEmptyKbAcquisitionGate(falseComplete);
  assert.equal(denied.status, "DENIED");
  if (denied.status === "DENIED") {
    assert.ok(denied.reasonCodes.includes("FALSE_COMPLETENESS_DETECTED"));
    assert.ok(!("candidate" in denied));
  }
});

test("AC-07: incomplete requirement recall cannot authorize acquisition", () => {
  const incompleteRecall = clone();
  ((incompleteRecall.detection as Record<string, unknown>).enumeratedRequirements as Array<Record<string, unknown>>).pop();
  const detected = requireDetection(incompleteRecall.detection);
  assert.equal(detected.requirementRecall.rate, 0.75);
  const denied = gate.runEmptyKbAcquisitionGate(incompleteRecall);
  assert.equal(denied.status, "DENIED");
  if (denied.status === "DENIED") assert.ok(denied.reasonCodes.includes("NEED_INCOMPLETE"));
});

test("AC-03: requirements without independent forward-enumeration evidence cannot authorize acquisition", () => {
  const missingForwardEvidence = clone();
  delete (missingForwardEvidence.detection as Record<string, unknown>).enumerationEvidence;
  const denied = gate.runEmptyKbAcquisitionGate(missingForwardEvidence);
  assert.equal(denied.status, "DENIED");
  if (denied.status === "DENIED") assert.ok(denied.reasonCodes.includes("NEED_INCOMPLETE"));
});

test("AC-07: malformed, non-empty, or non-exhausted evidence never claims success", () => {
  const nonEmpty = clone();
  (((nonEmpty.detection as Record<string, unknown>).baseline as Record<string, unknown>).entries as unknown[]).push({ id: "invented" });
  const deniedNonEmpty = gate.runEmptyKbAcquisitionGate(nonEmpty);
  assert.equal(deniedNonEmpty.status, "DENIED");
  if (deniedNonEmpty.status === "DENIED") assert.ok(deniedNonEmpty.reasonCodes.includes("EMPTY_KB_REQUIRED"));

  const partial = clone();
  (((partial.detection as Record<string, unknown>).retrievalAttempts as Array<Record<string, unknown>>)[1]!).status = "UNAVAILABLE";
  const observed = requireDetection(partial.detection);
  assert.equal(observed.gapClass, "RETRIEVAL_FAILURE");
  assert.equal(observed.retrievalExhausted, false);
  const deniedPartial = gate.runEmptyKbAcquisitionGate(partial);
  assert.equal(deniedPartial.status, "DENIED");
  if (deniedPartial.status === "DENIED") assert.ok(deniedPartial.reasonCodes.includes("RETRIEVAL_NOT_EXHAUSTED"));

  const malformed = gate.runEmptyKbAcquisitionGate({});
  assert.equal(malformed.status, "DENIED");
});

test("AC-07: fixture and receipt are canonical, deterministic, and explicitly incomplete", () => {
  assert.equal(fixtureBytes.toString("utf8"), gate.canonicalJson(fixture));
  assert.deepEqual(gate.createEmptyKbAcquisitionFixture(), fixture);
  assert.equal(fixture.schemaVersion, gate.SCHEMA_VERSION);
  assert.equal(fixture.fixtureId, gate.FIXTURE_ID);
  assert.equal(fixture.fixtureVersion, gate.FIXTURE_VERSION);
  assert.equal(sha256(fixtureBytes), receipt.fixtureSha256);
  assert.equal(receipt.status, "RECORDED");
  assert.equal(receipt.integratedProofState, "EVIDENCE_INCOMPLETE");
  assert.equal(receipt.authority, "NONE");
  assert.equal(receipt.capabilityDelta, "NONE");
  assert.equal(receipt.effect, "NONE");
  assert.equal(receipt.executionClaimed, false);
  assert.equal(receipt.productionClaimed, false);
  assert.equal(receipt.promotionClaimed, false);
  assert.equal(receipt.successClaimed, false);
  const { receiptSha256, ...body } = receipt;
  assert.equal(receiptSha256, gate.digest(body));
  const generated = gate.createEmptyKbAcquisitionReceipt(
    sha256(fixtureBytes),
    requireDetection(fixture.detection),
    requireCandidate(fixture),
  );
  assert.deepEqual(generated, receipt);
});
