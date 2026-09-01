import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import test from "node:test";

import { buildProductItemCandidate, canonicalJson, deriveProductItemCandidate, renderArtifacts } from "../../src/cscl-09/product-candidate.mjs";
import { independentlyReplayProductCandidate, renderIndependentReplayReceipt } from "./product-candidate-independent-oracle.mjs";

const root = resolve(import.meta.dirname, "../..");

const PROMOTED_CORE = [
  "product-item:objects-roles:odoo-community",
  "product-item:objects-roles:erpnext",
  "product-item:objects-roles:dolibarr",
  "product-item:objects-roles:tryton",
  "product-item:objects-roles:apache-ofbiz",
];
const DIFFERING_SYSTEM_VARIANTS = [
  "product-item:states-transitions:dolibarr",
  "product-item:states-transitions:tryton",
  "product-item:states-transitions:apache-ofbiz",
];
const DIFFERING_UNRESOLVED = [
  "product-item:states-transitions:odoo-community",
  "product-item:states-transitions:erpnext",
];

test("binds the released CSCL-07 authority and exact Product denominator", async () => {
  const result = await buildProductItemCandidate({ repoRoot: root });

  assert.deepEqual(result.candidate.sourceAuthority, {
    releaseTag: "2026_08_31_v4",
    releasedMain: "27488888a35fc59caa51bff12fb4ba8c0f28c31d",
    matrixPath: "verification/cscl-07-semantic-evidence-matrix-v1.json",
    matrixDigest: "d68dff995ab03e426302f593a5f73e10ffa886040217b7355e310878aa957d8d",
    relationSpecPath: "tests/fixtures/cscl-07/relation-spec-v1.json",
    relationSpecDigest: "a47e78346dbe3453b86f2545dfa437e966253490a9f2f993cdbca064e74d3599",
    relationSpecBytesDigest: "6007e8729ff8a63b5dc94bf200008a34ac1d586edcb1b6a1bc8b71b39bea51d2",
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
    CORE: 5,
    OPTIONAL_FEATURE: 0,
    SYSTEM_VARIANT: 46,
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

  // Only the relation's matching purpose evidence enters the bounded core. The relation's differing
  // statesTransitions evidence remains system-native or unresolved.
  assert.deepEqual(candidate.commonCore, PROMOTED_CORE);
  assert.deepEqual(candidate.commonCoreSemantics, {
    coreId: "product-item:shared-purpose",
    classification: "CORE",
    admittedDimension: "purpose",
    semanticAssertion: "Each cited source-native object claim identifies the system record used for a product, item, good or service offering; native names and object boundaries remain different.",
    sourceQuestionId: "objects-roles",
    evidenceElementIds: PROMOTED_CORE,
    sourceFactsRole: "EVIDENCE_ONLY",
    excludedFromCore: [
      "SOURCE_NATIVE_OBJECT_NAMES_AND_BOUNDARIES",
      "FIELDS_ROUTES_STATES_TRANSITIONS_POLICIES_AND_PROCESSES",
    ],
  });
  assert.equal(candidate.optionalFeatures.length, 0);
  assert.equal(candidate.processVariants.length, 0);
  assert.equal(candidate.systemVariants.length, 46);
  assert.equal(candidate.absences.length, 3);
  assert.equal(candidate.unresolvedConflicts.length, 6);
  assert.deepEqual(candidate.systemVariants.filter((elementId) => elementId.startsWith("product-item:states-transitions:")), DIFFERING_SYSTEM_VARIANTS);
  assert.deepEqual(candidate.unresolvedConflicts.filter((elementId) => elementId.startsWith("product-item:states-transitions:")), DIFFERING_UNRESOLVED);

  const coreElements = elements.filter((element) => element.classification === "CORE");
  assert.deepEqual(coreElements.map((element) => element.elementId), PROMOTED_CORE);
  assert.ok(coreElements.every((element) => element.classificationBasis === "REVIEWED_MATCHING_PURPOSE" &&
    element.reviewedDimension.role === "MATCHING" && element.reviewedDimension.dimension === "purpose" &&
    element.reviewedDimension.sourceFactsRole === "EVIDENCE_ONLY"));
  const differingElements = elements.filter((element) => element.reviewedDimension?.role === "DIFFERING");
  assert.equal(differingElements.length, 5);
  assert.ok(differingElements.every((element) => element.questionId === "states-transitions" &&
    element.classification !== "CORE" && element.reviewedDimension.dimension === "statesTransitions"));

  assert.equal(candidate.promotedRelations.length, 1);
  assert.deepEqual(candidate.promotedRelations[0], {
    relationId: "relation:PRODUCT_ITEM_MANAGEMENT:states-transitions",
    questionId: "states-transitions",
    relationState: "VARIANT_RELATION",
    promotionBasis: "SINGLE_REVIEWED_VARIANT_RELATION_NOT_FREQUENCY",
    matchingDimensions: [{
      dimension: "purpose",
      assertion: candidate.commonCoreSemantics.semanticAssertion,
      sourceQuestionId: "objects-roles",
      coreElementIds: PROMOTED_CORE,
    }],
    differingDimensions: [{
      dimension: "statesTransitions",
      assertion: "The cited controls materially differ: archive flags, Disabled/End of Life controls, sell/buy/type flags, DeactivableMixin, and lifecycle dates are preserved as distinct source-native variants.",
      sourceQuestionId: "states-transitions",
      systemVariantElementIds: DIFFERING_SYSTEM_VARIANTS,
      unresolvedElementIds: DIFFERING_UNRESOLVED,
    }],
    coreElementIds: PROMOTED_CORE,
    reason: candidate.analyses.find((analysis) => analysis.questionId === "states-transitions").relationReason,
  });
  assert.match(candidate.completeEvidenceConclusion, /matching purpose[\s\S]*differing statesTransitions[\s\S]*9 UNRESOLVED and 2 DENIED/);
  assert.ok(candidate.nonclaims.includes("NO_AUTHORITATIVE_OR_FURTHER_PROMOTION_CLAIM"));
  assert.ok(!candidate.nonclaims.includes("NO_PROMOTION_CLAIM"));
});

test("independent oracle replays all relations, classifications, and original evidence edges", async () => {
  const [matrixBytes, relationSpecBytes, candidateBytes, oracleBytes, frozenReplay] = await Promise.all([
    readFile(resolve(root, "verification/cscl-07-semantic-evidence-matrix-v1.json")),
    readFile(resolve(root, "tests/fixtures/cscl-07/relation-spec-v1.json")),
    readFile(resolve(root, "verification/cscl-09-product-candidate-v1.json")),
    readFile(resolve(root, "tests/cscl-09/product-candidate-independent-oracle.mjs")),
    readFile(resolve(root, "verification/cscl-09-product-candidate-independent-replay-v1.json"), "utf8"),
  ]);
  assert.doesNotMatch(oracleBytes.toString(), /from\s+["']\.\.\/\.\.\/src\/cscl-09\/product-candidate\.mjs["']/);
  const replay = independentlyReplayProductCandidate({ matrixBytes, relationSpecBytes, candidateBytes, oracleBytes });
  assert.equal(replay.outcome, "PASS");
  assert.deepEqual(replay.counts, {
    relations: 12,
    classifications: 60,
    originalEvidenceEdges: 60,
    coreEvidenceElements: 5,
    systemVariants: 46,
    absences: 3,
    unresolvedConflicts: 6,
    callerLabelsUsed: 0,
    frequenciesUsed: 0,
  });
  assert.deepEqual(replay.semanticResult.commonCoreElementIds, PROMOTED_CORE);
  assert.deepEqual(replay.semanticResult.differingSystemVariantElementIds, DIFFERING_SYSTEM_VARIANTS);
  assert.deepEqual(replay.semanticResult.differingUnresolvedElementIds, DIFFERING_UNRESOLVED);
  assert.equal(renderIndependentReplayReceipt({ matrixBytes, relationSpecBytes, candidateBytes, oracleBytes }), frozenReplay);

  for (const [label, mutate] of [
    ["differing state promoted", (changed) => {
      changed.analyses.find((analysis) => analysis.questionId === "states-transitions").elements[2].classification = "CORE";
    }],
    ["matching purpose demoted", (changed) => {
      changed.analyses.find((analysis) => analysis.questionId === "objects-roles").elements[0].classification = "SYSTEM_VARIANT";
    }],
    ["original evidence substituted", (changed) => {
      changed.analyses[0].elements[0].sourceFacts[0].claim += " invented";
    }],
  ]) {
    const changed = JSON.parse(candidateBytes);
    mutate(changed);
    assert.throws(() => independentlyReplayProductCandidate({
      matrixBytes,
      relationSpecBytes,
      candidateBytes: Buffer.from(`${canonicalJson(changed)}\n`),
      oracleBytes,
    }), /ORACLE_CANDIDATE_DERIVATION_MISMATCH/, label);
  }
});

test("denies caller, frequency, digest, extra-field, holdout, promotion, and Authority mutations", async () => {
  const first = await buildProductItemCandidate({ repoRoot: root });
  const second = await buildProductItemCandidate({ repoRoot: root });
  assert.equal(canonicalJson(first.candidate), canonicalJson(second.candidate));

  const matrix = JSON.parse(await readFile(resolve(root, "verification/cscl-07-semantic-evidence-matrix-v1.json"), "utf8"));
  const relationSpec = JSON.parse(await readFile(resolve(root, "tests/fixtures/cscl-07/relation-spec-v1.json"), "utf8"));
  assert.equal(canonicalJson(deriveProductItemCandidate(matrix, relationSpec)), canonicalJson(first.candidate));
  assert.equal(matrix.relationCandidates.filter((relation) => relation.state === "VARIANT_RELATION").length, 2);
  assert.equal(matrix.relationCandidates.filter((relation) => relation.capabilityFamily === "PRODUCT_ITEM_MANAGEMENT" && relation.state === "VARIANT_RELATION").length, 1);
  assert.deepEqual(first.candidate.commonCore, PROMOTED_CORE);

  const attacks = [
    ["caller label", (changed) => { changed.callerLabel = "common"; }],
    ["frequency", (changed) => { changed.frequency = "5/5"; }],
    ["extra field", (changed) => { changed.rows[0].cells[0].extra = true; }],
    ["holdout", (changed) => { changed.holdoutPath = "sealed/system"; }],
    ["promotion", (changed) => { changed.promotion = "AUTHORITATIVE"; }],
    ["authority", (changed) => { changed.Authority = "WRITE"; }],
    ["relation demoted from core", (changed) => {
      const index = changed.relationCandidates.findIndex((relation) => relation.capabilityFamily === "PRODUCT_ITEM_MANAGEMENT" && relation.state === "VARIANT_RELATION");
      changed.relationCandidates[index].state = "POTENTIAL_EQUIVALENCE";
    }],
  ];
  for (const [label, mutate] of attacks) {
    const changed = structuredClone(matrix);
    mutate(changed);
    assert.throws(() => deriveProductItemCandidate(changed, relationSpec), /SOURCE_MATRIX_DIGEST_MISMATCH/, label);
  }
  const changedRelationSpec = structuredClone(relationSpec);
  changedRelationSpec.evidenceEdges.find((edge) => edge.relationId === "relation:PRODUCT_ITEM_MANAGEMENT:states-transitions")
    .matchingDimensions[0].dimension = "statesTransitions";
  assert.throws(() => deriveProductItemCandidate(matrix, changedRelationSpec), /RELATION_SPEC_DIGEST_MISMATCH/);
});

test("freezes deterministic candidate, receipt, and Mapping/Application Guide artifacts", async () => {
  const first = await renderArtifacts({ repoRoot: root });
  const second = await renderArtifacts({ repoRoot: root });
  assert.deepEqual(first, second);
  assert.equal(first.candidate, await readFile(resolve(root, "verification/cscl-09-product-candidate-v1.json"), "utf8"));
  assert.equal(first.receipt, await readFile(resolve(root, "verification/cscl-09-product-candidate-receipt-v1.json"), "utf8"));
  assert.equal(first.independentReplay, await readFile(resolve(root, "verification/cscl-09-product-candidate-independent-replay-v1.json"), "utf8"));
  assert.equal(first.guide, await readFile(resolve(root, "docs/architecture/cscl-09-product-mapping-application-guide-v1.md"), "utf8"));

  const candidate = JSON.parse(first.candidate);
  const receipt = JSON.parse(first.receipt);
  assert.equal(candidate.status, "NON_AUTHORITATIVE_CANDIDATE_FROZEN");
  assert.equal(receipt.outcome, "FROZEN_SHARED_PURPOSE_CORE_WITH_DIFFERING_STATES_TRANSITIONS_VARIANTS_AND_LIMITS");
  assert.equal(receipt.digests.matrix, candidate.sourceAuthority.matrixDigest);
  assert.equal(receipt.counts.promotedCoreElements, 5);
  assert.equal(receipt.counts.systemVariants, 46);
  assert.equal(receipt.counts.variantRelations, 1);
  assert.equal(receipt.verification.independentReplay.outcome, "PASS");
  assert.equal(receipt.verification.independentReplay.relations, 12);
  assert.equal(receipt.verification.independentReplay.classifications, 60);
  assert.equal(receipt.verification.independentReplay.originalEvidenceEdges, 60);
  assert.match(first.guide, /common core/i);
  assert.match(first.guide, /never.*frequency|frequency.*never/i);
  assert.match(first.guide, /system variant/i);
  assert.match(first.guide, /absence/i);
  assert.match(first.guide, /unresolved/i);
  assert.match(first.guide, /non-authoritative/i);
  assert.match(first.guide, /states-transitions VARIANT_RELATION/i);
  assert.match(first.guide, /independent.*oracle/i);
  assert.match(first.guide, /no authoritative or further promotion/i);
});