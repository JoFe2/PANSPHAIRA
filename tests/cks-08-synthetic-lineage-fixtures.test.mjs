import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import Ajv2020 from "ajv/dist/2020.js";
import {
  buildSyntheticFixtureModel,
  scoreSyntheticLineageFixture,
} from "../scripts/cks-08-score-synthetic-lineage.mjs";
import { computeCksLineageFeatureReportV1 } from "../dist/packages/contracts/src/cks-evidence-profile-features.js";
import { evaluateCksSeededFailureAttributionV1 } from "../dist/packages/contracts/src/cks-failure-attribution-evaluator.js";
import { reconstructCksLineageUsageV1 } from "../dist/packages/contracts/src/cks-lineage-reconstructor.js";

const readJson = (path) => JSON.parse(readFileSync(path, "utf8"));
const cases = () => readJson("tests/fixtures/cks-08/synthetic-lineage-cases-v1.json");
const groundTruth = () => readJson("tests/fixtures/cks-08/synthetic-lineage-ground-truth-v1.json");
const score = () => scoreSyntheticLineageFixture(cases(), groundTruth());


test("CKS-08 synthetic fixture schema and ground truth are closed and deterministic", () => {
  const fixture = cases();
  const schema = readJson("schemas/contracts/cks-synthetic-lineage-case-v1.schema.json");
  const validate = new Ajv2020({ allErrors: true, strict: true }).compile(schema);
  assert.equal(validate(fixture), true, JSON.stringify(validate.errors));
  assert.equal(validate({ ...fixture, unexpected: true }), false);
  assert.equal(fixture.scopeClass, "LOCAL_SYNTHETIC_FIXTURE");
  assert.equal(groundTruth().semanticRuleId, fixture.semanticRuleId);
});

test("P14 reconstructs each ground-truth task and exposes all six Knowledge usage sets", () => {
  const model = buildSyntheticFixtureModel(cases());
  for (const expected of groundTruth().p14.tasks) {
    const built = model.built.get(expected.name);
    assert.ok(built, expected.name);
    const first = reconstructCksLineageUsageV1(built.events);
    const second = reconstructCksLineageUsageV1(structuredClone(built.events));
    assert.equal(first.status, "RECONSTRUCTED", expected.name);
    assert.deepEqual(second, first, `${expected.name}: deterministic reconstruction`);
    if (first.status !== "RECONSTRUCTED") continue;
    const actual = {
      searched: first.searched.map((ref) => ref.knowledgeId),
      inspected: first.inspected.map((ref) => ref.knowledgeId),
      used: first.used.map((ref) => ref.knowledgeId),
      rejected: first.rejected.map((item) => [item.knowledgeRef.knowledgeId, item.reasonCode]),
      decisionSupporting: first.decisionSupporting.map((ref) => ref.knowledgeId),
      outcomeContributing: first.outcomeContributing.map((ref) => ref.knowledgeId),
    };
    assert.deepEqual(actual, expected.usage, expected.name);
  }
});

test("P15 rejects repetition inflation while retaining independent novelty and context", () => {
  const result = score();
  assert.equal(result.status, "PASS");
  assert.equal(result.metrics.p15Groups, 2);
  const repetition = result.p15.find((item) => item.name === "identical-repetition-does-not-become-generalization");
  const diverse = result.p15.find((item) => item.name === "independent-novelty-and-context-diversity");
  assert.deepEqual(repetition?.metrics, {
    validTaskOccurrenceCount: 8,
    distinctTaskSemanticCount: 1,
    distinctContextCount: 1,
    distinctJointUsageUnitCount: 1,
    identicalRepetitionCount: 7,
    generalizationMarker: null,
    operationalMarker: "+O",
  });
  assert.equal(diverse?.metrics.generalizationMarker, "+G");
  assert.equal(diverse?.metrics.distinctJointUsageUnitCount, 4);

  const model = buildSyntheticFixtureModel(cases());
  const group = cases().featureGroups.repetition;
  const lineages = group.map((name) => model.built.get(name).events).reverse();
  const profile = model.built.get(group[0]).profile;
  const report = computeCksLineageFeatureReportV1({
    scopeRef: cases().scopeRef,
    knowledgeRef: cases().knowledgeRefs.alpha,
    lineages,
    dimensions: {
      source: profile.dimensions.source,
      applicability: profile.dimensions.applicability,
      freshness: profile.dimensions.freshness,
      contradiction: profile.dimensions.contradiction,
    },
    thresholds: cases().thresholds,
  });
  assert.equal(report.status, "REPORTED");
  if (report.status === "REPORTED") assert.equal(report.dimensions.generalization.marker, null);
});

test("P16 attributes every seeded causal class and retains independent profile dimensions", () => {
  const model = buildSyntheticFixtureModel(cases());
  const expected = groundTruth().p16.cases;
  assert.equal(expected.length, 17);
  for (const item of expected) {
    const built = model.built.get(item.name);
    assert.ok(built, item.name);
    const first = evaluateCksSeededFailureAttributionV1(built.attributionInput);
    const second = evaluateCksSeededFailureAttributionV1(structuredClone(built.attributionInput));
    assert.deepEqual(second, first, `${item.name}: deterministic attribution`);
    assert.equal(first.status, "EVALUATED", item.name);
    if (first.status !== "EVALUATED") continue;
    assert.equal(first.outcomeClass, item.outcomeClass, item.name);
    assert.equal(first.causalMode, item.causalMode, item.name);
    assert.deepEqual(first.causes.map(({ class: causeClass, subtype, certainty }) => ({ class: causeClass, subtype, certainty })), item.causes, item.name);
    assert.deepEqual(Object.keys(first.evidenceProfiles[0].dimensions).sort(), ["applicability", "contradiction", "freshness", "generalization", "operational", "source"], `${item.name}: dimensions remain separate`);
  }
});

test("P14/P16 fail closed for missing, late, replayed, cross-scope and tampered lineage plus attribution ambiguity", () => {
  const result = score();
  assert.equal(result.metrics.deniedNegativeCases, cases().negativeCases.length);
  assert.deepEqual(result.negatives.map((item) => item.name), cases().negativeCases.map((item) => item.name));
  assert.ok(result.negatives.every((item) => item.status === "DENIED"));
  assert.deepEqual(score(), result, "whole score is deterministic across fresh fixture reads");
});
