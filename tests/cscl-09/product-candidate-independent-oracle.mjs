import { createHash } from "node:crypto";

const PRODUCT = "PRODUCT_ITEM_MANAGEMENT";
const MATRIX_CANONICAL_DIGEST = "d68dff995ab03e426302f593a5f73e10ffa886040217b7355e310878aa957d8d";
const MATRIX_BYTES_DIGEST = "02ffb40584d857b2f7a8fdf2ba193c78a2561721969d511348fff726a95a9797";
const RELATION_SPEC_CANONICAL_DIGEST = "a47e78346dbe3453b86f2545dfa437e966253490a9f2f993cdbca064e74d3599";
const RELATION_SPEC_BYTES_DIGEST = "6007e8729ff8a63b5dc94bf200008a34ac1d586edcb1b6a1bc8b71b39bea51d2";
const PROMOTED_RELATION_ID = "relation:PRODUCT_ITEM_MANAGEMENT:states-transitions";
const PROMOTED_QUESTION = "states-transitions";

const deepSort = (value) => {
  if (Array.isArray(value)) return value.map(deepSort);
  if (value && typeof value === "object")
    return Object.fromEntries(Object.keys(value).sort().map((key) => [key, deepSort(value[key])]));
  return value;
};
const stableBytes = (value) => JSON.stringify(deepSort(value));
const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");
const same = (left, right) => stableBytes(left) === stableBytes(right);
const positive = (state) => state === "SUPPORTED" || state === "VARIANT";
const coordinate = (questionId, systemId) => `${questionId}/${systemId}`;

function requireReplay(condition, code) {
  if (!condition) throw new Error(code);
}

function parseExact(bytes, code) {
  try {
    return JSON.parse(bytes.toString());
  } catch {
    throw new Error(code);
  }
}

function factReference(fact) {
  return {
    factId: fact.factId,
    factDigest: fact.factDigest,
    excerptSha256: fact.exactEvidence.excerptSha256,
    exactLocator: fact.exactEvidence.exactLocator,
  };
}

function resolveEvidence(matrix, rows, dimension, questionId, code) {
  requireReplay(dimension?.evidence?.length === matrix.systemOrder.length, code);
  const cells = new Map(rows.flatMap((row) => row.cells.map((cell) => [
    cell.sourceCellDigest,
    { questionId: row.questionId, cell },
  ])));
  return dimension.evidence.map((reference, index) => {
    const found = cells.get(reference.sourceCellDigest);
    requireReplay(found && reference.systemId === matrix.systemOrder[index] &&
      found.questionId === questionId && found.cell.systemId === reference.systemId &&
      same(reference.sourceFactReferences, found.cell.sourceFacts.map(factReference)), code);
    return { questionId: found.questionId, systemId: found.cell.systemId, cell: found.cell };
  });
}

function independentlyDerive(matrix, relationSpec) {
  requireReplay(sha256(stableBytes(matrix)) === MATRIX_CANONICAL_DIGEST, "ORACLE_MATRIX_CANONICAL_DIGEST_MISMATCH");
  const { specDigest, ...specBody } = relationSpec;
  requireReplay(specDigest === RELATION_SPEC_CANONICAL_DIGEST &&
    sha256(stableBytes(specBody)) === RELATION_SPEC_CANONICAL_DIGEST &&
    matrix.relationSpecDigest === RELATION_SPEC_CANONICAL_DIGEST,
  "ORACLE_RELATION_SPEC_CANONICAL_DIGEST_MISMATCH");

  const rows = matrix.rows.filter((row) => row.capabilityFamily === PRODUCT);
  const relations = matrix.relationCandidates.filter((relation) => relation.capabilityFamily === PRODUCT);
  requireReplay(rows.length === 12 && rows.flatMap((row) => row.cells).length === 60 && relations.length === 12,
    "ORACLE_PRODUCT_DENOMINATOR_MISMATCH");
  const relationByQuestion = new Map(relations.map((relation) => [relation.questionId, relation]));
  const variants = relations.filter((relation) => relation.state === "VARIANT_RELATION");
  requireReplay(variants.length === 1 && variants[0].relationId === PROMOTED_RELATION_ID,
    "ORACLE_REVIEWED_RELATION_MISMATCH");
  const promoted = variants[0];

  const edge = relationSpec.evidenceEdges.find((candidate) => candidate.relationId === PROMOTED_RELATION_ID);
  requireReplay(edge?.state === "VARIANT_RELATION" && same(edge.systems, matrix.systemOrder) &&
    edge.matchingDimensions?.length === 1 && edge.matchingDimensions[0].dimension === "purpose" &&
    edge.differingDimensions?.length === 1 && edge.differingDimensions[0].dimension === "statesTransitions" &&
    same(promoted.supportedDimensions, ["purpose", "statesTransitions"]),
  "ORACLE_DIMENSION_ROLE_MISMATCH");

  const matching = resolveEvidence(matrix, rows, edge.matchingDimensions[0], "objects-roles",
    "ORACLE_MATCHING_PURPOSE_EVIDENCE_MISMATCH");
  const differing = resolveEvidence(matrix, rows, edge.differingDimensions[0], PROMOTED_QUESTION,
    "ORACLE_DIFFERING_STATES_EVIDENCE_MISMATCH");
  requireReplay(matching.every(({ cell }) => positive(cell.sourceCell.state)),
    "ORACLE_MATCHING_PURPOSE_STATE_MISMATCH");

  const expectedRelationReferences = differing.map(({ cell }) => ({
    systemId: cell.systemId,
    sourceProfileDigest: cell.sourceProfileDigest,
    sourceCellDigest: cell.sourceCellDigest,
    sourceFactIds: cell.sourceFacts.map((fact) => fact.factId),
    evidenceReferences: cell.sourceCell.evidence,
  }));
  requireReplay(same(promoted.cellReferences, expectedRelationReferences),
    "ORACLE_PROMOTED_RELATION_REFERENCE_MISMATCH");

  const matchingCoordinates = new Set(matching.map((item) => coordinate(item.questionId, item.systemId)));
  const differingCoordinates = new Set(differing.map((item) => coordinate(item.questionId, item.systemId)));
  const classify = (state, questionId, systemId) => matchingCoordinates.has(coordinate(questionId, systemId)) && positive(state)
    ? "CORE"
    : positive(state) ? "SYSTEM_VARIANT" : state === "ABSENT" ? "ABSENCE" : "UNRESOLVED_CONFLICT";

  const analyses = rows.map((row) => {
    const relation = relationByQuestion.get(row.questionId);
    requireReplay(relation, "ORACLE_RELATION_MISSING");
    return {
      questionId: row.questionId,
      relationState: relation.state,
      relationReason: relation.reason,
      supportedDimensions: relation.supportedDimensions,
      elements: row.cells.map((cell) => {
        const cellCoordinate = coordinate(row.questionId, cell.systemId);
        const reviewedDimension = matchingCoordinates.has(cellCoordinate) ? {
          relationId: PROMOTED_RELATION_ID,
          role: "MATCHING",
          dimension: "purpose",
          sourceFactsRole: "EVIDENCE_ONLY",
        } : differingCoordinates.has(cellCoordinate) ? {
          relationId: PROMOTED_RELATION_ID,
          role: "DIFFERING",
          dimension: "statesTransitions",
          sourceFactsRole: "SYSTEM_NATIVE_VARIANT_EVIDENCE",
        } : null;
        return {
          elementId: `product-item:${row.questionId}:${cell.systemId}`,
          classification: classify(cell.sourceCell.state, row.questionId, cell.systemId),
          classificationBasis: reviewedDimension?.role === "MATCHING"
            ? "REVIEWED_MATCHING_PURPOSE"
            : reviewedDimension?.role === "DIFFERING"
              ? "REVIEWED_DIFFERING_SYSTEM_NATIVE_DIMENSION"
              : positive(cell.sourceCell.state)
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
  const byClass = (classification) => elements.filter((element) => element.classification === classification)
    .map((element) => element.elementId);
  const classificationCounts = Object.fromEntries([
    "CORE", "OPTIONAL_FEATURE", "SYSTEM_VARIANT", "PROCESS_VARIANT", "ABSENCE", "UNRESOLVED_CONFLICT",
  ].map((classification) => [classification, byClass(classification).length]));
  const relationCounts = Object.fromEntries(["UNRESOLVED", "VARIANT_RELATION", "DENIED"].map((state) =>
    [state, relations.filter((relation) => relation.state === state).length]));
  const coreElements = byClass("CORE");
  const differingElements = elements.filter((element) => element.reviewedDimension?.role === "DIFFERING");
  const differingSystemVariants = differingElements.filter((element) => element.classification === "SYSTEM_VARIANT")
    .map((element) => element.elementId);
  const differingUnresolved = differingElements.filter((element) => element.classification === "UNRESOLVED_CONFLICT")
    .map((element) => element.elementId);

  return {
    candidate: {
      schemaVersion: "pansphaira.cscl09/product-candidate/v1",
      candidateId: "cscl-09-product-item-management-candidate-v1",
      status: "NON_AUTHORITATIVE_CANDIDATE_FROZEN",
      sourceAuthority: {
        releaseTag: "2026_08_31_v4",
        releasedMain: "27488888a35fc59caa51bff12fb4ba8c0f28c31d",
        matrixPath: "verification/cscl-07-semantic-evidence-matrix-v1.json",
        matrixDigest: MATRIX_CANONICAL_DIGEST,
        relationSpecPath: "tests/fixtures/cscl-07/relation-spec-v1.json",
        relationSpecDigest: RELATION_SPEC_CANONICAL_DIGEST,
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
        relationId: promoted.relationId,
        questionId: promoted.questionId,
        relationState: promoted.state,
        promotionBasis: "SINGLE_REVIEWED_VARIANT_RELATION_NOT_FREQUENCY",
        matchingDimensions: [{
          dimension: edge.matchingDimensions[0].dimension,
          assertion: edge.matchingDimensions[0].assertion,
          sourceQuestionId: "objects-roles",
          coreElementIds: coreElements,
        }],
        differingDimensions: [{
          dimension: edge.differingDimensions[0].dimension,
          assertion: edge.differingDimensions[0].assertion,
          sourceQuestionId: PROMOTED_QUESTION,
          systemVariantElementIds: differingSystemVariants,
          unresolvedElementIds: differingUnresolved,
        }],
        coreElementIds: coreElements,
        reason: promoted.reason,
      }],
      analyses,
      commonCore: coreElements,
      commonCoreSemantics: {
        coreId: "product-item:shared-purpose",
        classification: "CORE",
        admittedDimension: edge.matchingDimensions[0].dimension,
        semanticAssertion: edge.matchingDimensions[0].assertion,
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
    },
    relations,
    elements,
  };
}

export function independentlyReplayProductCandidate({ matrixBytes, relationSpecBytes, candidateBytes, oracleBytes }) {
  requireReplay(sha256(matrixBytes) === MATRIX_BYTES_DIGEST, "ORACLE_MATRIX_BYTES_DIGEST_MISMATCH");
  requireReplay(sha256(relationSpecBytes) === RELATION_SPEC_BYTES_DIGEST,
    "ORACLE_RELATION_SPEC_BYTES_DIGEST_MISMATCH");
  const matrix = parseExact(matrixBytes, "ORACLE_MATRIX_PARSE_DENIED");
  const relationSpec = parseExact(relationSpecBytes, "ORACLE_RELATION_SPEC_PARSE_DENIED");
  const candidate = parseExact(candidateBytes, "ORACLE_CANDIDATE_PARSE_DENIED");
  requireReplay(candidateBytes.toString() === `${stableBytes(candidate)}\n`, "ORACLE_CANDIDATE_NONCANONICAL_BYTES");

  const expected = independentlyDerive(matrix, relationSpec);
  requireReplay(same(candidate, expected.candidate), "ORACLE_CANDIDATE_DERIVATION_MISMATCH");

  const relationReplay = expected.relations.map((relation) => ({
    relationId: relation.relationId,
    state: relation.state,
    reason: relation.reason,
    supportedDimensions: relation.supportedDimensions,
  }));
  const classificationReplay = expected.elements.map((element) => ({
    elementId: element.elementId,
    classification: element.classification,
    classificationBasis: element.classificationBasis,
    reviewedDimension: element.reviewedDimension,
    sourceState: element.sourceState,
    sourceCellDigest: element.sourceCellDigest,
  }));
  const originalEvidenceReplay = expected.elements.flatMap((element) => element.sourceFacts.map((fact) => ({
    elementId: element.elementId,
    sourceCellDigest: element.sourceCellDigest,
    factId: fact.factId,
    factDigest: fact.factDigest,
    claim: fact.claim,
    exactLocator: fact.exactEvidence.exactLocator,
    excerptSha256: fact.exactEvidence.excerptSha256,
  })));
  requireReplay(relationReplay.length === 12 && classificationReplay.length === 60 && originalEvidenceReplay.length === 60,
    "ORACLE_REPLAY_DENOMINATOR_MISMATCH");
  const { specDigest: _specDigest, ...relationSpecBody } = relationSpec;

  const receiptBody = {
    schemaVersion: "pansphaira.cscl09/product-candidate-independent-replay/v1",
    receiptId: "cscl-09-product-item-management-independent-replay-v1",
    outcome: "PASS",
    implementation: {
      path: "tests/cscl-09/product-candidate-independent-oracle.mjs",
      importsProductionImplementation: false,
      productionImplementationImports: 0,
      derivation: "INDEPENDENT_SOURCE_RELATION_AND_CLASSIFICATION_REPLAY",
    },
    counts: {
      relations: relationReplay.length,
      classifications: classificationReplay.length,
      originalEvidenceEdges: originalEvidenceReplay.length,
      coreEvidenceElements: expected.candidate.commonCore.length,
      systemVariants: expected.candidate.systemVariants.length,
      absences: expected.candidate.absences.length,
      unresolvedConflicts: expected.candidate.unresolvedConflicts.length,
      callerLabelsUsed: 0,
      frequenciesUsed: 0,
    },
    semanticResult: {
      promotedRelationId: PROMOTED_RELATION_ID,
      admittedMatchingDimension: "purpose",
      matchingEvidenceQuestionId: "objects-roles",
      differingDimension: "statesTransitions",
      differingEvidenceQuestionId: PROMOTED_QUESTION,
      commonCoreElementIds: expected.candidate.commonCore,
      differingSystemVariantElementIds: expected.candidate.promotedRelations[0].differingDimensions[0].systemVariantElementIds,
      differingUnresolvedElementIds: expected.candidate.promotedRelations[0].differingDimensions[0].unresolvedElementIds,
    },
    digests: {
      matrixBytes: sha256(matrixBytes),
      matrixCanonical: sha256(stableBytes(matrix)),
      relationSpecBytes: sha256(relationSpecBytes),
      relationSpecCanonical: sha256(stableBytes(relationSpecBody)),
      candidateBytes: sha256(candidateBytes),
      oracleImplementation: sha256(oracleBytes),
      relationReplay: sha256(stableBytes(relationReplay)),
      classificationReplay: sha256(stableBytes(classificationReplay)),
      originalEvidenceReplay: sha256(stableBytes(originalEvidenceReplay)),
    },
  };
  return { ...receiptBody, receiptDigest: sha256(stableBytes(receiptBody)) };
}

export function renderIndependentReplayReceipt(inputs) {
  return `${stableBytes(independentlyReplayProductCandidate(inputs))}\n`;
}
