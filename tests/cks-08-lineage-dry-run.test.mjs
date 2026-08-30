import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { renderCks08EvidenceDraft } from "../scripts/run-cks-08-lineage-dry-run.mjs";

const readJson = (path) => JSON.parse(readFileSync(path, "utf8"));
const positive = () => readJson("tests/fixtures/cks-08/e2e-positive-evidence-v1.json");
const rejections = () => readJson("tests/fixtures/cks-08/e2e-rejections-v1.json");


test("CKS-08 offline harness replays bounded positive and negative receipts deterministically", () => {
  const first = renderCks08EvidenceDraft(positive(), rejections());
  const second = renderCks08EvidenceDraft(structuredClone(positive()), structuredClone(rejections()));
  assert.deepEqual(second, first);
  assert.equal(first.status, "PASS");
  assert.equal(first.state, "DRAFT_PRE_COMMIT");
  assert.equal(first.testedCommit, null);
  assert.equal(first.replay.positiveLineageTasks.length, 2);
  assert.equal(first.replay.deniedLineageCases.length, 5);
  assert.equal(first.replay.deniedAttributionCases.length, 4);
  assert.ok(first.replay.boundedReceiptCount > 0);
});

test("P14 exposes all six Knowledge usage sets for each replayed task", () => {
  const report = renderCks08EvidenceDraft(positive(), rejections());
  assert.deepEqual(report.acceptance.P14, {
    status: "PASS",
    directTaskCount: 2,
    scorerTaskCount: 2,
    exactUsageFields: ["searched", "inspected", "used", "rejected", "decisionSupporting", "outcomeContributing"]
  });
  assert.deepEqual(report.replay.positiveLineageTasks.map(({ name, status }) => ({ name, status })), [
    { name: "act-alpha-usage", status: "RECONSTRUCTED" },
    { name: "retrieve-delta-usage", status: "RECONSTRUCTED" }
  ]);
});

test("P15 separates repeated observations from independent generalization", () => {
  const report = renderCks08EvidenceDraft(positive(), rejections());
  assert.equal(report.acceptance.P15.repetitionInflationPrevented, true);
  assert.deepEqual(report.acceptance.P15.groups[0].metrics, {
    validTaskOccurrenceCount: 8,
    distinctTaskSemanticCount: 1,
    distinctContextCount: 1,
    distinctJointUsageUnitCount: 1,
    identicalRepetitionCount: 7,
    generalizationMarker: null,
    operationalMarker: "+O"
  });
  assert.equal(report.acceptance.P15.groups[1].metrics.generalizationMarker, "+G");
});

test("P16 retains causal uncertainty, multi-cause handling and six independent dimensions", () => {
  const report = renderCks08EvidenceDraft(positive(), rejections());
  assert.equal(report.acceptance.P16.caseCount, 17);
  assert.deepEqual(report.acceptance.P16.causalModes, ["ALTERNATIVES_UNRESOLVED", "MULTI_CONTRIBUTING", "SINGLE", "UNKNOWN"]);
  assert.deepEqual(report.acceptance.P16.uncertaintyClasses, ["CONFIRMED", "POSSIBLE", "SUPPORTED", "UNKNOWN"]);
  assert.deepEqual(report.acceptance.independentProfileDimensions.dimensions, ["source", "applicability", "freshness", "contradiction", "generalization", "operational"]);
});

test("missing, late, replayed, cross-scope and tampered lineage deny without partial usage sets", () => {
  const report = renderCks08EvidenceDraft(positive(), rejections());
  assert.equal(report.acceptance.failClosed.status, "PASS");
  assert.equal(report.acceptance.failClosed.noPartialUsageSets, true);
  assert.deepEqual(report.replay.deniedLineageCases.map((item) => item.name), ["missing", "late", "replayed", "cross-scope", "tampered"]);
  assert.ok(report.replay.deniedLineageCases.every((item) => item.status === "DENIED"));
  assert.ok(report.replay.deniedAttributionCases.every((item) => item.status === "DENIED"));
});

test("privacy-safe evidence denies a broadened manifest", () => {
  const mutated = positive();
  mutated.privacy.rawContentEmitted = true;
  assert.throws(() => renderCks08EvidenceDraft(mutated, rejections()), /privacy manifest permits raw evidence/);
});
