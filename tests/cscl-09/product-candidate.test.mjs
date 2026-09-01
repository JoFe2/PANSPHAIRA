import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import test from "node:test";

import { buildProductItemCandidate, canonicalJson, deriveProductItemCandidate, renderArtifacts } from "../../src/cscl-09/product-candidate.mjs";

const root = resolve(import.meta.dirname, "../..");

const PROMOTED_CORE = [
  "product-item:states-transitions:dolibarr",
  "product-item:states-transitions:tryton",
  "product-item:states-transitions:apache-ofbiz",
];

test("binds the released CSCL-07 authority and exact Product denominator", async () => {
  const result = await buildProductItemCandidate({ repoRoot: root });

  assert.deepEqual(result.candidate.sourceAuthority, {
    releaseTag: "2026_08_31_v4",
    releasedMain: "27488888a35fc59caa51bff12fb4ba8c0f28c31d",
    matrixPath: "verification/cscl-07-semantic-evidence-matrix-v1.json",
    matrixDigest: "d68dff995ab03e426302f593a5f73e10ffa886040217b7355e310878aa957d8d",
    evidenceReviewDigest: "779d304ff4ddc92f1bf1f1fc8471ff079ab9e89044331f098ddf0523375ccfc0",
    reviewLedgerCount: 36,
  });
  assert.equal(result.candidate.capabilityFamily, "PRODUCT_ITEM_MANAGEMENT");
  assert.deepEqual(result.candidate.denominator, {
    rows: 12,
    cells: 60,
    systems: 5,
    relationCandidates: 12,
  });
});

test("preserves every Product classification, matrix cell, fact, and original evidence reference", async () => {
  const { candidate } = await buildProductItemCandidate({ repoRoot: root });

  assert.deepEqual(candidate.classificationCounts, {
    CORE: 3,
    OPTIONAL_FEATURE: 0,
    SYSTEM_VARIANT: 48,
    PROCESS_VARIANT: 0,
    ABSENCE: 3,
    UNRESOLVED_CONFLICT: 6,
  });
  assert.deepEqual(candidate.relationCounts, { UNRESOLVED: 9, VARIANT_RELATION: 1, DENIED: 2 });
  assert.equal(candidate.analyses.length, 12);
  assert.deepEqual(candidate.analyses.map((analysis) => analysis.questionId), [
    "objects-roles", "relations", "operations", "inputs-outputs", "states-transitions", "events",
    "preconditions", "invariants", "exceptions-errors", "readbacks", "api-service-exposure",
    "absence-ambiguity-conflict",
  ]);

  const elements = candidate.analyses.flatMap((analysis) => analysis.elements);
  assert.equal(elements.length, 60);
  assert.equal(new Set(elements.map((element) => `${element.questionId}/${element.systemId}`)).size, 60);
  assert.ok(elements.every((element) => /^[a-f0-9]{64}$/.test(element.sourceCellDigest)));
  assert.ok(elements.every((element) => /^[a-f0-9]{64}$/.test(element.sourceProfileDigest)));
  assert.ok(elements.every((element) => element.sourceFacts.length > 0));
  assert.ok(elements.flatMap((element) => element.sourceFacts).every((fact) =>
    fact.factId && /^[a-f0-9]{64}$/.test(fact.factDigest) && fact.claim &&
      fact.exactEvidence.exactLocator && /^[a-f0-9]{64}$/.test(fact.exactEvidence.excerptSha256)
  ));
  assert.ok(elements.filter((element) => ["ABSENT", "AMBIGUOUS", "CONFLICTING"].includes(element.sourceState))
    .every((element) => element.counterevidence.length > 0));

  // The single promoted states-transitions VARIANT_RELATION contributes exactly its 3 positively
  // evidenced cells to the bounded core; no supported cell from any other row is promoted.
  assert.deepEqual(candidate.commonCore, PROMOTED_CORE);
  assert.equal(candidate.optionalFeatures.length, 0);
  assert.equal(candidate.processVariants.length, 0);
  assert.equal(candidate.systemVariants.length, 48);
  assert.equal(candidate.absences.length, 3);
  assert.equal(candidate.unresolvedConflicts.length, 6);
  assert.equal(candidate.systemVariants.filter((elementId) => elementId.startsWith("product-item:states-transitions:")).length, 0);

  assert.equal(candidate.promotedRelations.length, 1);
  assert.deepEqual(candidate.promotedRelations[0], {
    relationId: "relation:PRODUCT_ITEM_MANAGEMENT:states-transitions",
    questionId: "states-transitions",
    relationState: "VARIANT_RELATION",
    promotionBasis: "SINGLE_REVIEWED_VARIANT_RELATION_NOT_FREQUENCY",
    matchingDimensions: ["purpose"],
    differingDimensions: ["statesTransitions"],
    coreElementIds: PROMOTED_CORE,
    reason: candidate.analyses.find((analysis) => analysis.questionId === "states-transitions").relationReason,
  });
  assert.match(candidate.completeEvidenceConclusion, /states-transitions VARIANT_RELATION[\s\S]*9 UNRESOLVED and 2 DENIED/);
});

test("replays independently and denies caller, frequency, extra-field, holdout, and authority mutations", async () => {
  const first = await buildProductItemCandidate({ repoRoot: root });
  const second = await buildProductItemCandidate({ repoRoot: root });
  assert.equal(canonicalJson(first.candidate), canonicalJson(second.candidate));

  const matrix = JSON.parse(await readFile(resolve(root, "verification/cscl-07-semantic-evidence-matrix-v1.json"), "utf8"));
  assert.equal(canonicalJson(deriveProductItemCandidate(matrix)), canonicalJson(first.candidate));
  assert.equal(matrix.relationCandidates.filter((relation) => relation.state === "VARIANT_RELATION").length, 2);
  assert.equal(matrix.relationCandidates.filter((relation) => relation.capabilityFamily === "PRODUCT_ITEM_MANAGEMENT" && relation.state === "VARIANT_RELATION").length, 1);
  assert.deepEqual(first.candidate.commonCore, PROMOTED_CORE);

  const attacks = [
    ["caller label", (changed) => { changed.callerLabel = "common"; }],
    ["frequency", (changed) => { changed.frequency = "5/5"; }],
    ["extra field", (changed) => { changed.rows[0].cells[0].extra = true; }],
    ["holdout", (changed) => { changed.holdoutPath = "sealed/system"; }],
    ["authority", (changed) => { changed.Authority = "WRITE"; }],
    ["relation demoted from core", (changed) => {
      const index = changed.relationCandidates.findIndex((relation) => relation.capabilityFamily === "PRODUCT_ITEM_MANAGEMENT" && relation.state === "VARIANT_RELATION");
      changed.relationCandidates[index].state = "POTENTIAL_EQUIVALENCE";
    }],
  ];
  for (const [label, mutate] of attacks) {
    const changed = structuredClone(matrix);
    mutate(changed);
    assert.throws(() => deriveProductItemCandidate(changed), /SOURCE_MATRIX_DIGEST_MISMATCH/, label);
  }
});

test("freezes deterministic candidate, receipt, and Mapping/Application Guide artifacts", async () => {
  const first = await renderArtifacts({ repoRoot: root });
  const second = await renderArtifacts({ repoRoot: root });
  assert.deepEqual(first, second);
  assert.equal(first.candidate, await readFile(resolve(root, "verification/cscl-09-product-candidate-v1.json"), "utf8"));
  assert.equal(first.receipt, await readFile(resolve(root, "verification/cscl-09-product-candidate-receipt-v1.json"), "utf8"));
  assert.equal(first.guide, await readFile(resolve(root, "docs/architecture/cscl-09-product-mapping-application-guide-v1.md"), "utf8"));

  const candidate = JSON.parse(first.candidate);
  const receipt = JSON.parse(first.receipt);
  assert.equal(candidate.status, "NON_AUTHORITATIVE_CANDIDATE_FROZEN");
  assert.equal(receipt.outcome, "FROZEN_SINGLE_STATES_TRANSITIONS_VARIANT_RELATION_CORE_WITH_SOURCE_BOUND_VARIANTS_AND_LIMITS");
  assert.equal(receipt.digests.matrix, candidate.sourceAuthority.matrixDigest);
  assert.equal(receipt.counts.promotedCoreElements, 3);
  assert.equal(receipt.counts.variantRelations, 1);
  assert.match(first.guide, /common core/i);
  assert.match(first.guide, /never.*frequency|frequency.*never/i);
  assert.match(first.guide, /system variant/i);
  assert.match(first.guide, /absence/i);
  assert.match(first.guide, /unresolved/i);
  assert.match(first.guide, /non-authoritative/i);
  assert.match(first.guide, /states-transitions VARIANT_RELATION/i);
});