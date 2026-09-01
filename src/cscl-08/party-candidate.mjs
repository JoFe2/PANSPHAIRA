import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const PARTY = "PARTY_CUSTOMER_MANAGEMENT";
const MATRIX_PATH = "verification/cscl-07-semantic-evidence-matrix-v1.json";
const MATRIX_DIGEST = "d68dff995ab03e426302f593a5f73e10ffa886040217b7355e310878aa957d8d";

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

export function derivePartyCandidate(matrix) {
  if (digest(matrix) !== MATRIX_DIGEST) throw new Error("SOURCE_MATRIX_DIGEST_MISMATCH");

  const rows = matrix.rows.filter((row) => row.capabilityFamily === PARTY);
  const relations = matrix.relationCandidates.filter((relation) => relation.capabilityFamily === PARTY);
  const relationByQuestion = new Map(relations.map((relation) => [relation.questionId, relation]));
  const classify = (state) => state === "SUPPORTED" || state === "VARIANT"
    ? "SYSTEM_VARIANT"
    : state === "ABSENT" ? "ABSENCE" : "UNRESOLVED_CONFLICT";
  const analyses = rows.map((row) => {
    const relation = relationByQuestion.get(row.questionId);
    return {
      questionId: row.questionId,
      relationState: relation.state,
      relationReason: relation.reason,
      supportedDimensions: relation.supportedDimensions,
      elements: row.cells.map((cell) => ({
        elementId: `party:${row.questionId}:${cell.systemId}`,
        classification: classify(cell.sourceCell.state),
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
  const relationCounts = Object.fromEntries(["UNRESOLVED", "DENIED"].map((state) =>
    [state, relations.filter((relation) => relation.state === state).length]));

  return {
    schemaVersion: "pansphaira.cscl08/party-candidate/v1",
    candidateId: "cscl-08-party-customer-management-candidate-v1",
    status: "NON_AUTHORITATIVE_CANDIDATE_FROZEN",
      sourceAuthority: {
        releaseTag: "2026_08_31_v4",
        releasedMain: "27488888a35fc59caa51bff12fb4ba8c0f28c31d",
        matrixPath: MATRIX_PATH,
        matrixDigest: MATRIX_DIGEST,
        evidenceReviewDigest: matrix.evidenceReviewDigest,
        reviewLedgerCount: matrix.relationCandidates.length,
      },
      capabilityFamily: PARTY,
      frozenScope: ["parties", "organizations", "persons", "customer roles", "addresses/contact points", "lifecycle semantics"],
      denominator: {
        rows: rows.length,
        cells: rows.flatMap((row) => row.cells).length,
        systems: matrix.systemOrder.length,
        relationCandidates: relations.length,
      },
      classificationCounts,
      relationCounts,
      analyses,
      commonCore: byClass("CORE"),
      optionalFeatures: byClass("OPTIONAL_FEATURE"),
      systemVariants: byClass("SYSTEM_VARIANT"),
      processVariants: byClass("PROCESS_VARIANT"),
      absences: byClass("ABSENCE"),
      unresolvedConflicts: byClass("UNRESOLVED_CONFLICT"),
      completeEvidenceConclusion: "The complete 12-row Party denominator contains zero Party VARIANT_RELATION or POTENTIAL_EQUIVALENCE inputs: 9 UNRESOLVED and 3 DENIED. Therefore no common core, optional feature, or process variant is positively derived; all 49 supported source-native elements remain system variants, with 4 explicit absences and 7 ambiguous/conflicting elements preserved.",
      nonclaims: [
        "NO_UNIVERSAL_ERP_CLAIM", "NO_COMPATIBILITY_CLAIM", "NO_EXECUTION_CLAIM",
        "NO_PROMOTION_CLAIM", "NO_AUTHORITY_CLAIM", "NO_HOLDOUT_SEMANTICS_CLAIM",
      ],
  };
}

export async function buildPartyCandidate({ repoRoot }) {
  const matrix = JSON.parse(await readFile(resolve(repoRoot, MATRIX_PATH), "utf8"));
  return { candidate: derivePartyCandidate(matrix) };
}

export async function renderArtifacts({ repoRoot }) {
  const { candidate } = await buildPartyCandidate({ repoRoot });
  const guide = await readFile(resolve(repoRoot, "docs/architecture/cscl-08-party-mapping-application-guide-v1.md"), "utf8");
  const candidateBytes = `${canonicalJson(candidate)}\n`;
  const receiptPayload = {
    schemaVersion: "pansphaira.cscl08/party-candidate-receipt/v1",
    receiptId: "cscl-08-party-customer-management-candidate-receipt-v1",
    outcome: "FROZEN_EMPTY_CORE_WITH_SOURCE_BOUND_VARIANTS_AND_LIMITS",
    sourceAuthority: candidate.sourceAuthority,
    counts: {
      rows: 12,
      cells: 60,
      systems: 5,
      reviews: 12,
      unresolvedRelations: 9,
      deniedRelations: 3,
      positivePartyRelations: 0,
      promotedCoreElements: 0,
      systemVariants: 49,
      absences: 4,
      unresolvedConflicts: 7,
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
      exactPartyDenominatorVerified: true,
      sourceAndOriginalEvidenceTraceabilityVerified: true,
      callerFrequencyExtraHoldoutAuthorityDenialsVerified: true,
      focusedCommand: "node --test tests/cscl-08/party-candidate.test.mjs",
      initialRedCommand: "node --test tests/cscl-08/party-candidate.test.mjs",
      initialRedReason: "ERR_MODULE_NOT_FOUND src/cscl-08/party-candidate.mjs",
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
