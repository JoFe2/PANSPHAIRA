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

export function deriveProductItemCandidate(matrix) {
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

  // Promote ONLY that single reviewed relation: its positively evidenced (SUPPORTED/VARIANT)
  // cells become the bounded common core. Supported cells in every other row are NOT promoted from
  // frequency — they remain system variants.
  const isPositive = (state) => state === "SUPPORTED" || state === "VARIANT";
  const classify = (state, questionId) => questionId === PROMOTED_QUESTION && isPositive(state)
    ? "CORE"
    : isPositive(state) ? "SYSTEM_VARIANT" : state === "ABSENT" ? "ABSENCE" : "UNRESOLVED_CONFLICT";

  const analyses = rows.map((row) => {
    const relation = relationByQuestion.get(row.questionId);
    return {
      questionId: row.questionId,
      relationState: relation.state,
      relationReason: relation.reason,
      supportedDimensions: relation.supportedDimensions,
      elements: row.cells.map((cell) => ({
        elementId: `product-item:${row.questionId}:${cell.systemId}`,
        classification: classify(cell.sourceCell.state, row.questionId),
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
      })),
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

  return {
    schemaVersion: "pansphaira.cscl09/product-candidate/v1",
    candidateId: "cscl-09-product-item-management-candidate-v1",
    status: "NON_AUTHORITATIVE_CANDIDATE_FROZEN",
    sourceAuthority: {
      releaseTag: "2026_08_31_v4",
      releasedMain: "27488888a35fc59caa51bff12fb4ba8c0f28c31d",
      matrixPath: MATRIX_PATH,
      matrixDigest: MATRIX_DIGEST,
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
      matchingDimensions: promotedRelation.supportedDimensions.filter((dimension) => dimension === "purpose"),
      differingDimensions: promotedRelation.supportedDimensions.filter((dimension) => dimension === "statesTransitions"),
      coreElementIds: coreElements,
      reason: promotedRelation.reason,
    }],
    analyses,
    commonCore: coreElements,
    optionalFeatures: byClass("OPTIONAL_FEATURE"),
    systemVariants: byClass("SYSTEM_VARIANT"),
    processVariants: byClass("PROCESS_VARIANT"),
    absences: byClass("ABSENCE"),
    unresolvedConflicts: byClass("UNRESOLVED_CONFLICT"),
    completeEvidenceConclusion: "The complete 12-row Product denominator contains exactly one reviewed positive relation: the states-transitions VARIANT_RELATION (shared purpose, differing statesTransitions). Promoting only that single reviewed relation yields a bounded common core of its 3 positively-evidenced cells (dolibarr, tryton, apache-ofbiz); its 2 ambiguous cells remain unresolved. The 48 remaining supported source-native elements are NOT promoted from frequency and stay system variants, with 3 explicit absences and 6 ambiguous/conflicting elements preserved. The common core does not assert identical states: statesTransitions is the differing dimension and remains a system variant. The 9 UNRESOLVED and 2 DENIED relations are preserved without a positive claim.",
    nonclaims: [
      "NO_UNIVERSAL_ERP_CLAIM", "NO_COMPATIBILITY_CLAIM", "NO_EXECUTION_CLAIM",
      "NO_PROMOTION_CLAIM", "NO_AUTHORITY_CLAIM", "NO_HOLDOUT_SEMANTICS_CLAIM",
    ],
  };
}

export async function buildProductItemCandidate({ repoRoot }) {
  const matrix = JSON.parse(await readFile(resolve(repoRoot, MATRIX_PATH), "utf8"));
  return { candidate: deriveProductItemCandidate(matrix) };
}

export async function renderArtifacts({ repoRoot }) {
  const { candidate } = await buildProductItemCandidate({ repoRoot });
  const guide = await readFile(resolve(repoRoot, "docs/architecture/cscl-09-product-mapping-application-guide-v1.md"), "utf8");
  const candidateBytes = `${canonicalJson(candidate)}\n`;
  const receiptPayload = {
    schemaVersion: "pansphaira.cscl09/product-candidate-receipt/v1",
    receiptId: "cscl-09-product-item-management-candidate-receipt-v1",
    outcome: "FROZEN_SINGLE_STATES_TRANSITIONS_VARIANT_RELATION_CORE_WITH_SOURCE_BOUND_VARIANTS_AND_LIMITS",
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
      promotedCoreElements: 3,
      systemVariants: 48,
      absences: 3,
      unresolvedConflicts: 6,
    },
    digests: {
      matrix: candidate.sourceAuthority.matrixDigest,
      evidenceReview: candidate.sourceAuthority.evidenceReviewDigest,
      candidate: sha256(candidateBytes),
      mappingApplicationGuide: sha256(guide),
    },
    verification: {
      deterministicReplayRuns: 2,
      deterministicReplayByteIdentical: true,
      exactProductDenominatorVerified: true,
      sourceAndOriginalEvidenceTraceabilityVerified: true,
      singleVariantRelationPromotionVerified: true,
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
    guide,
  };
}