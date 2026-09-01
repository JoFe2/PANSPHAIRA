import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const PRODUCT = "PRODUCT_ITEM_MANAGEMENT";
const MATRIX_PATH = "verification/cscl-07-semantic-evidence-matrix-v1.json";
const MATRIX_DIGEST = "d68dff995ab03e426302f593a5f73e10ffa886040217b7355e310878aa957d8d";
const PROMOTED_QUESTION = "states-transitions";

export const canonicalJson = (value) => JSON.stringify(sortDeep(value));

function sortDeep(value) {
  if (Array.isArray(value)) return value.map(sortDeep);
  if (value && typeof value === "object")
    return Object.fromEntries(Object.keys(value).sort().map((key) => [key, sortDeep(value[key])]));
  return value;
}

function digest(value) {
  return createHash("sha256").update(canonicalJson(value)).digest("hex");
}

function sha256(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

const RELATION_SPEC_PATH = "tests/fixtures/cscl-07/relation-spec-v1.json";
const RELATION_SPEC_DIGEST = "a47e78346dbe3453b86f2545dfa437e966253490a9f2f993cdbca064e74d3599";
const RELATION_SPEC_BYTES_DIGEST = "6007e8729ff8a63b5dc94bf200008a34ac1d586edcb1b6a1bc8b71b39bea51d2";
const ORACLE_PATH = "tests/cscl-09/product-candidate-independent-oracle.mjs";
const ORACLE_RECEIPT_PATH = "verification/cscl-09-product-candidate-independent-replay-v1.json";

const isPositive = (state) => state === "SUPPORTED" || state === "VARIANT";
const coordinate = (questionId, systemId) => `${questionId}/${systemId}`;
const sourceFactReference = (fact) => ({
  factId: fact.factId,
  factDigest: fact.factDigest,
  excerptSha256: fact.exactEvidence.excerptSha256,
  exactLocator: fact.exactEvidence.exactLocator,
});

function resolveDimensionEvidence({ matrix, rows, dimension, expectedQuestionId, errorCode }) {
  if (!dimension || dimension.evidence.length !== matrix.systemOrder.length)
    throw new Error(errorCode);
  const cellsByDigest = new Map(rows.flatMap((row) => row.cells.map((cell) => [
    cell.sourceCellDigest,
    { row, cell },
  ])));
  return dimension.evidence.map((reference, index) => {
    const found = cellsByDigest.get(reference.sourceCellDigest);
    if (!found || reference.systemId !== matrix.systemOrder[index] ||
        found.row.questionId !== expectedQuestionId || found.cell.systemId !== reference.systemId ||
        canonicalJson(reference.sourceFactReferences) !== canonicalJson(found.cell.sourceFacts.map(sourceFactReference)))
      throw new Error(errorCode);
    return { questionId: found.row.questionId, systemId: found.cell.systemId, cell: found.cell };
  });
}

function resolveReviewedDimensions(matrix, relationSpec, rows, promotedRelation) {
  const { specDigest, ...specBody } = relationSpec;
  if (specDigest !== RELATION_SPEC_DIGEST || digest(specBody) !== RELATION_SPEC_DIGEST ||
      matrix.relationSpecDigest !== RELATION_SPEC_DIGEST)
    throw new Error("RELATION_SPEC_DIGEST_MISMATCH");

  const edge = relationSpec.evidenceEdges.find((candidate) => candidate.relationId === promotedRelation.relationId);
  if (!edge || edge.state !== "VARIANT_RELATION" ||
      canonicalJson(edge.systems) !== canonicalJson(matrix.systemOrder) ||
      edge.matchingDimensions.length !== 1 || edge.matchingDimensions[0].dimension !== "purpose" ||
      edge.differingDimensions.length !== 1 || edge.differingDimensions[0].dimension !== "statesTransitions" ||
      canonicalJson(promotedRelation.supportedDimensions) !== canonicalJson(["purpose", "statesTransitions"]))
    throw new Error("REVIEWED_DIMENSION_ROLE_MISMATCH");

  const matching = resolveDimensionEvidence({
    matrix,
    rows,
    dimension: edge.matchingDimensions[0],
    expectedQuestionId: "objects-roles",
    errorCode: "MATCHING_PURPOSE_EVIDENCE_MISMATCH",
  });
  const differing = resolveDimensionEvidence({
    matrix,
    rows,
    dimension: edge.differingDimensions[0],
    expectedQuestionId: PROMOTED_QUESTION,
    errorCode: "DIFFERING_STATES_TRANSITIONS_EVIDENCE_MISMATCH",
  });
  if (!matching.every(({ cell }) => isPositive(cell.sourceCell.state)))
    throw new Error("MATCHING_PURPOSE_NOT_POSITIVELY_EVIDENCED");

  const expectedRelationReferences = differing.map(({ cell }) => ({
    systemId: cell.systemId,
    sourceProfileDigest: cell.sourceProfileDigest,
    sourceCellDigest: cell.sourceCellDigest,
    sourceFactIds: cell.sourceFacts.map((fact) => fact.factId),
    evidenceReferences: cell.sourceCell.evidence,
  }));
  if (canonicalJson(promotedRelation.cellReferences) !== canonicalJson(expectedRelationReferences))
    throw new Error("PROMOTED_RELATION_CELL_REFERENCE_MISMATCH");

  return {
    matchingDimension: edge.matchingDimensions[0],
    differingDimension: edge.differingDimensions[0],
    matching,
    differing,
  };
}

export function deriveProductItemCandidate(matrix, relationSpec) {
  if (digest(matrix) !== MATRIX_DIGEST) throw new Error("SOURCE_MATRIX_DIGEST_MISMATCH");

  const rows = matrix.rows.filter((row) => row.capabilityFamily === PRODUCT);
  const relations = matrix.relationCandidates.filter((relation) => relation.capabilityFamily === PRODUCT);
  const relationByQuestion = new Map(relations.map((relation) => [relation.questionId, relation]));

  // Fail-closed promotion: exactly one reviewed Product VARIANT_RELATION, and it must be the
  // states-transitions review. Any other shape is a source-mutation and throws.
  const variantRelations = relations.filter((relation) => relation.state === "VARIANT_RELATION");
  if (variantRelations.length !== 1) throw new Error("EXPECTED_SINGLE_PRODUCT_VARIANT_RELATION");
  const promotedRelation = variantRelations[0];
  if (promotedRelation.questionId !== PROMOTED_QUESTION) throw new Error("UNEXPECTED_PRODUCT_VARIANT_RELATION");
  const dimensions = resolveReviewedDimensions(matrix, relationSpec, rows, promotedRelation);
  const matchingCoordinates = new Set(dimensions.matching.map(({ questionId, systemId }) => coordinate(questionId, systemId)));
  const differingCoordinates = new Set(dimensions.differing.map(({ questionId, systemId }) => coordinate(questionId, systemId)));

  // The reviewed relation promotes only its matching purpose dimension. The five matching evidence
  // cells are in objects-roles and are evidence-only projections of that shared purpose. Every
  // states-transitions cell belongs to the explicitly differing dimension and therefore remains a
  // system variant or unresolved evidence. Frequency never enters this classification.
  const classify = (state, questionId, systemId) => matchingCoordinates.has(coordinate(questionId, systemId)) && isPositive(state)
    ? "CORE"
    : isPositive(state) ? "SYSTEM_VARIANT" : state === "ABSENT" ? "ABSENCE" : "UNRESOLVED_CONFLICT";

  const analyses = rows.map((row) => {
    const relation = relationByQuestion.get(row.questionId);
    return {
      questionId: row.questionId,
      relationState: relation.state,
      relationReason: relation.reason,
      supportedDimensions: relation.supportedDimensions,
      elements: row.cells.map((cell) => {
        const cellCoordinate = coordinate(row.questionId, cell.systemId);
        const reviewedDimension = matchingCoordinates.has(cellCoordinate) ? {
          relationId: promotedRelation.relationId,
          role: "MATCHING",
          dimension: "purpose",
          sourceFactsRole: "EVIDENCE_ONLY",
        } : differingCoordinates.has(cellCoordinate) ? {
          relationId: promotedRelation.relationId,
          role: "DIFFERING",
          dimension: "statesTransitions",
          sourceFactsRole: "SYSTEM_NATIVE_VARIANT_EVIDENCE",
        } : null;
        const classification = classify(cell.sourceCell.state, row.questionId, cell.systemId);
        return {
          elementId: `product-item:${row.questionId}:${cell.systemId}`,
          classification,
          classificationBasis: reviewedDimension?.role === "MATCHING"
            ? "REVIEWED_MATCHING_PURPOSE"
            : reviewedDimension?.role === "DIFFERING"
              ? "REVIEWED_DIFFERING_SYSTEM_NATIVE_DIMENSION"
              : isPositive(cell.sourceCell.state)
                ? "SOURCE_NATIVE_POSITIVE_NOT_PROMOTED"
                : cell.sourceCell.state === "ABSENT"
                  ? "EXPLICIT_SOURCE_ABSENCE"
                  : "AMBIGUOUS_OR_CONFLICTING_SOURCE_EVIDENCE",
          reviewedDimension,
          questionId: row.questionId,
          systemId: cell.systemId,
          sourceState: cell.sourceCell.state,
          relationState: relation.state,
          sourceCellDigest: cell.sourceCellDigest,
          sourceProfileDigest: cell.sourceProfileDigest,
          sourceFacts: cell.sourceFacts.map((fact) => ({
            factId: fact.factId,
            factDigest: fact.factDigest,
            claim: fact.claim,
            exactEvidence: fact.exactEvidence,
          })),
          counterevidence: cell.sourceCell.counterexamples,
        };
      }),
    };
  });

  const elements = analyses.flatMap((analysis) => analysis.elements);
  const byClass = (classification) => elements.filter((element) => element.classification === classification).map((element) => element.elementId);
  const classificationCounts = Object.fromEntries([
    "CORE", "OPTIONAL_FEATURE", "SYSTEM_VARIANT", "PROCESS_VARIANT", "ABSENCE", "UNRESOLVED_CONFLICT",
  ].map((classification) => [classification, byClass(classification).length]));
  const relationCounts = Object.fromEntries(["UNRESOLVED", "VARIANT_RELATION", "DENIED"].map((state) =>
    [state, relations.filter((relation) => relation.state === state).length]));
  const coreElements = byClass("CORE");
  const differingElements = elements.filter((element) => element.reviewedDimension?.role === "DIFFERING");
  const differingSystemVariants = differingElements.filter((element) => element.classification === "SYSTEM_VARIANT").map((element) => element.elementId);
  const differingUnresolved = differingElements.filter((element) => element.classification === "UNRESOLVED_CONFLICT").map((element) => element.elementId);

  return {
    schemaVersion: "pansphaira.cscl09/product-candidate/v1",
    candidateId: "cscl-09-product-item-management-candidate-v1",
    status: "NON_AUTHORITATIVE_CANDIDATE_FROZEN",
    sourceAuthority: {
      releaseTag: "2026_08_31_v4",
      releasedMain: "27488888a35fc59caa51bff12fb4ba8c0f28c31d",
      matrixPath: MATRIX_PATH,
      matrixDigest: MATRIX_DIGEST,
      relationSpecPath: RELATION_SPEC_PATH,
      relationSpecDigest: RELATION_SPEC_DIGEST,
      relationSpecBytesDigest: RELATION_SPEC_BYTES_DIGEST,
      evidenceReviewDigest: matrix.evidenceReviewDigest,
      reviewLedgerCount: matrix.relationCandidates.length,
    },
    capabilityFamily: PRODUCT,
    frozenScope: ["products", "items", "goods", "services", "offerings", "lifecycle semantics", "states and transitions"],
    denominator: {
      rows: rows.length,
      cells: rows.flatMap((row) => row.cells).length,
      systems: matrix.systemOrder.length,
      relationCandidates: relations.length,
    },
    classificationCounts,
    relationCounts,
    promotedRelations: [{
      relationId: promotedRelation.relationId,
      questionId: promotedRelation.questionId,
      relationState: promotedRelation.state,
      promotionBasis: "SINGLE_REVIEWED_VARIANT_RELATION_NOT_FREQUENCY",
      matchingDimensions: [{
        dimension: dimensions.matchingDimension.dimension,
        assertion: dimensions.matchingDimension.assertion,
        sourceQuestionId: "objects-roles",
        coreElementIds: coreElements,
      }],
      differingDimensions: [{
        dimension: dimensions.differingDimension.dimension,
        assertion: dimensions.differingDimension.assertion,
        sourceQuestionId: PROMOTED_QUESTION,
        systemVariantElementIds: differingSystemVariants,
        unresolvedElementIds: differingUnresolved,
      }],
      coreElementIds: coreElements,
      reason: promotedRelation.reason,
    }],
    analyses,
    commonCore: coreElements,
    commonCoreSemantics: {
      coreId: "product-item:shared-purpose",
      classification: "CORE",
      admittedDimension: dimensions.matchingDimension.dimension,
      semanticAssertion: dimensions.matchingDimension.assertion,
      sourceQuestionId: "objects-roles",
      evidenceElementIds: coreElements,
      sourceFactsRole: "EVIDENCE_ONLY",
      excludedFromCore: [
        "SOURCE_NATIVE_OBJECT_NAMES_AND_BOUNDARIES",
        "FIELDS_ROUTES_STATES_TRANSITIONS_POLICIES_AND_PROCESSES",
      ],
    },
    optionalFeatures: byClass("OPTIONAL_FEATURE"),
    systemVariants: byClass("SYSTEM_VARIANT"),
    processVariants: byClass("PROCESS_VARIANT"),
    absences: byClass("ABSENCE"),
    unresolvedConflicts: byClass("UNRESOLVED_CONFLICT"),
    completeEvidenceConclusion: "The complete 12-row Product denominator contains exactly one reviewed positive relation: the states-transitions VARIANT_RELATION. Its matching purpose dimension is evidenced by five objects-roles cells and is the only admitted common-core semantic assertion; their source-native names and object boundaries are evidence only. Its differing statesTransitions dimension contributes 3 system variants (dolibarr, tryton, apache-ofbiz) and 2 unresolved cells (odoo-community, erpnext), never core states or policies. The other 43 supported source-native elements remain system variants, with 3 explicit absences and 4 other ambiguous/conflicting elements preserved. The 9 UNRESOLVED and 2 DENIED relations are preserved without a positive claim.",
    nonclaims: [
      "NO_UNIVERSAL_ERP_CLAIM", "NO_COMPATIBILITY_CLAIM", "NO_EXECUTION_CLAIM",
      "NO_AUTHORITATIVE_OR_FURTHER_PROMOTION_CLAIM", "NO_AUTHORITY_CLAIM", "NO_HOLDOUT_SEMANTICS_CLAIM",
    ],
  };
}

export async function buildProductItemCandidate({ repoRoot }) {
  const [matrixBytes, relationSpecBytes] = await Promise.all([
    readFile(resolve(repoRoot, MATRIX_PATH), "utf8"),
    readFile(resolve(repoRoot, RELATION_SPEC_PATH), "utf8"),
  ]);
  if (sha256(relationSpecBytes) !== RELATION_SPEC_BYTES_DIGEST)
    throw new Error("RELATION_SPEC_BYTES_MISMATCH");
  return {
    candidate: deriveProductItemCandidate(JSON.parse(matrixBytes), JSON.parse(relationSpecBytes)),
  };
}

export async function renderArtifacts({ repoRoot }) {
  const { candidate } = await buildProductItemCandidate({ repoRoot });
  const [guide, oracleBytes, independentReplay] = await Promise.all([
    readFile(resolve(repoRoot, "docs/architecture/cscl-09-product-mapping-application-guide-v1.md"), "utf8"),
    readFile(resolve(repoRoot, ORACLE_PATH), "utf8"),
    readFile(resolve(repoRoot, ORACLE_RECEIPT_PATH), "utf8"),
  ]);
  const candidateBytes = `${canonicalJson(candidate)}\n`;
  const independentReplayReceipt = JSON.parse(independentReplay);
  if (independentReplayReceipt.outcome !== "PASS" ||
      independentReplayReceipt.digests.candidateBytes !== sha256(candidateBytes) ||
      independentReplayReceipt.digests.matrixCanonical !== candidate.sourceAuthority.matrixDigest ||
      independentReplayReceipt.digests.relationSpecCanonical !== candidate.sourceAuthority.relationSpecDigest ||
      independentReplayReceipt.digests.oracleImplementation !== sha256(oracleBytes))
    throw new Error("INDEPENDENT_REPLAY_RECEIPT_MISMATCH");
  const receiptPayload = {
    schemaVersion: "pansphaira.cscl09/product-candidate-receipt/v1",
    receiptId: "cscl-09-product-item-management-candidate-receipt-v1",
    outcome: "FROZEN_SHARED_PURPOSE_CORE_WITH_DIFFERING_STATES_TRANSITIONS_VARIANTS_AND_LIMITS",
    sourceAuthority: candidate.sourceAuthority,
    counts: {
      rows: 12,
      cells: 60,
      systems: 5,
      reviews: 12,
      unresolvedRelations: 9,
      variantRelations: 1,
      deniedRelations: 2,
      positiveProductRelations: 1,
      promotedCoreElements: 5,
      systemVariants: 46,
      absences: 3,
      unresolvedConflicts: 6,
    },
    digests: {
      matrix: candidate.sourceAuthority.matrixDigest,
      evidenceReview: candidate.sourceAuthority.evidenceReviewDigest,
      relationSpec: candidate.sourceAuthority.relationSpecDigest,
      candidate: sha256(candidateBytes),
      mappingApplicationGuide: sha256(guide),
      independentReplay: sha256(independentReplay),
    },
    verification: {
      deterministicReplayRuns: 2,
      deterministicReplayByteIdentical: true,
      exactProductDenominatorVerified: true,
      sourceAndOriginalEvidenceTraceabilityVerified: true,
      matchingPurposeOnlyPromotionVerified: true,
      differingStatesTransitionsExcludedFromCore: true,
      independentReplay: {
        oraclePath: ORACLE_PATH,
        oracleSha256: sha256(oracleBytes),
        receiptPath: ORACLE_RECEIPT_PATH,
        receiptSha256: sha256(independentReplay),
        outcome: independentReplayReceipt.outcome,
        relations: independentReplayReceipt.counts.relations,
        classifications: independentReplayReceipt.counts.classifications,
        originalEvidenceEdges: independentReplayReceipt.counts.originalEvidenceEdges,
      },
      callerFrequencyExtraHoldoutAuthorityDenialsVerified: true,
      focusedCommand: "node --test tests/cscl-09/product-candidate.test.mjs",
      initialRedCommand: "node --test tests/cscl-09/product-candidate.test.mjs",
      initialRedReason: "ERR_MODULE_NOT_FOUND src/cscl-09/product-candidate.mjs",
      networkAccesses: 0,
      externalSystemAccesses: 0,
    },
    nonclaims: candidate.nonclaims,
  };
  const receipt = { ...receiptPayload, receiptDigest: digest(receiptPayload) };
  return {
    candidate: candidateBytes,
    receipt: `${canonicalJson(receipt)}\n`,
    independentReplay,
    guide,
  };
}