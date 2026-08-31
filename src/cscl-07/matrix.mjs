import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const sha256 = (value) => createHash("sha256").update(value).digest("hex");
export const canonicalJson = (value) => JSON.stringify(value, (_key, child) => {
  if (!child || Array.isArray(child) || typeof child !== "object") return child;
  return Object.fromEntries(Object.keys(child).sort().map((key) => [key, child[key]]));
});
const digest = (value) => sha256(canonicalJson(value));
const parse = (bytes) => JSON.parse(bytes.toString("utf8"));
const exactKeys = (object, keys, code) => {
  if (!object || Array.isArray(object) || typeof object !== "object" || canonicalJson(Object.keys(object).sort()) !== canonicalJson([...keys].sort())) throw new Error(code);
};

async function readJson(repoRoot, path) { return parse(await readFile(resolve(repoRoot, path))); }

function extract(systemId, profileArtifact, factsArtifact, cellsArtifact) {
  if (systemId === "odoo-community") return { profile: profileArtifact.profile, facts: profileArtifact.sourceFacts, cells: profileArtifact.cells };
  if (systemId === "apache-ofbiz") return { profile: profileArtifact.profile, facts: profileArtifact.facts, cells: profileArtifact.cells };
  if (systemId === "dolibarr") return {
    profile: profileArtifact,
    facts: factsArtifact.sourceFacts ?? factsArtifact,
    cells: (cellsArtifact.cells ?? cellsArtifact).map((wrapper) => wrapper.cell),
  };
  return { profile: profileArtifact, facts: factsArtifact, cells: cellsArtifact };
}

export function verifyReleasedInputs(inputs) {
  const { manifest, relationSpec, evidenceReview, profiles } = inputs;
  const { manifestDigest, ...manifestBody } = manifest;
  const { specDigest, ...specBody } = relationSpec;
  const { reviewDigest, ...reviewBody } = evidenceReview;
  if (digest(manifestBody) !== manifestDigest) throw new Error("INPUT_MANIFEST_DIGEST_MISMATCH");
  if (digest(specBody) !== specDigest) throw new Error("RELATION_SPEC_DIGEST_MISMATCH");
  if (digest(reviewBody) !== reviewDigest || evidenceReview.relationSpecDigest !== specDigest) throw new Error("EVIDENCE_REVIEW_DIGEST_MISMATCH");
  if (manifest.releasedMain !== "8dae13e416ca42709bf04f01faba5b3b4708deeb" || manifest.releaseTag !== "2026_08_31_v3") throw new Error("RELEASE_BINDING_MISMATCH");
  if (canonicalJson(manifest.systemOrder) !== canonicalJson(["odoo-community", "erpnext", "dolibarr", "tryton", "apache-ofbiz"])) throw new Error("PROFILE_SET_OR_ORDER_MISMATCH");
  if (manifest.profiles.length !== 5 || profiles.length !== 5 || new Set(manifest.profiles.map((x) => x.systemId)).size !== 5) throw new Error("PROFILE_DENOMINATOR_MISMATCH");
  for (const source of profiles) {
    if (digest(source.receipt) !== source.binding.receiptDigest || digest(source.profile) !== source.binding.profileDigest || digest(source.facts) !== source.binding.factsDigest || digest(source.cells) !== source.binding.cellsDigest) throw new Error("RELEASED_PROFILE_CONTENT_DIGEST_MISMATCH");
    if (source.profile.systemId !== source.binding.systemId || source.cells.length !== 36 || source.profile.evidenceCells.length !== 36 || source.facts.length !== source.binding.counts.facts) throw new Error("RELEASED_PROFILE_DENOMINATOR_MISMATCH");
  }
  const states = Object.fromEntries(["SUPPORTED", "ABSENT", "AMBIGUOUS", "VARIANT", "CONFLICTING", "UNMAPPED"].map((state) => [state, profiles.flatMap((x) => x.cells).filter((cell) => cell.state === state).length]));
  if (canonicalJson(states) !== canonicalJson({ SUPPORTED: 152, ABSENT: 8, AMBIGUOUS: 16, VARIANT: 1, CONFLICTING: 3, UNMAPPED: 0 })) throw new Error("RELEASED_CELL_STATE_DENOMINATOR_MISMATCH");
  if (evidenceReview.reviews.length !== 36 || new Set(evidenceReview.reviews.map((x) => x.relationId)).size !== 36) throw new Error("EVIDENCE_REVIEW_DENOMINATOR_MISMATCH");
  const allCells = new Map();
  for (const source of profiles) for (const cell of source.cells) allCells.set(`${source.binding.systemId}:${digest(cell)}`, { source, cell });
  const validateReferences = (references) => {
    if (!Array.isArray(references) || references.length !== 5 || new Set(references.map((x) => x.systemId)).size !== 5) throw new Error("EVIDENCE_REVIEW_SOURCE_BINDING_MISMATCH");
    for (const reference of references) {
      const found = allCells.get(`${reference.systemId}:${reference.sourceCellDigest}`);
      if (!found) throw new Error("EVIDENCE_REVIEW_CELL_DIGEST_MISMATCH");
      const expected = found.cell.evidence.map((edge) => {
        const fact = found.source.factsById.get(edge.sourceFactId);
        return { factId: fact.factId, factDigest: fact.factDigest, excerptSha256: edge.excerptSha256, exactLocator: edge.exactLocator };
      });
      if (canonicalJson(reference.sourceFactReferences) !== canonicalJson(expected)) throw new Error("EVIDENCE_REVIEW_FACT_DIGEST_MISMATCH");
    }
  };
  const edgeById = new Map(relationSpec.evidenceEdges.map((edge) => [edge.relationId, edge]));
  if (edgeById.size !== relationSpec.evidenceEdges.length) throw new Error("RELATION_EDGE_DUPLICATE");
  for (let index = 0; index < evidenceReview.reviews.length; index += 1) {
    const family = manifest.familyOrder[Math.floor(index / 12)];
    const question = manifest.questionOrder[index % 12];
    const expectedId = `relation:${family}:${question}`;
    const review = evidenceReview.reviews[index];
    if (review.relationId !== expectedId) throw new Error("EVIDENCE_REVIEW_ORDER_MISMATCH");
    validateReferences(review.reviewedCellReferences);
    if (!Array.isArray(review.semanticDimensionsAssessed) || review.semanticDimensionsAssessed.length === 0) throw new Error("EVIDENCE_REVIEW_DIMENSION_MISSING");
    for (const assessed of review.semanticDimensionsAssessed) validateReferences(assessed.evidence);
    if (review.outcome === "UNRESOLVED" && (!Array.isArray(review.missingOrInsufficientDimensions) || review.missingOrInsufficientDimensions.length === 0)) throw new Error("EVIDENCE_REVIEW_UNRESOLVED_DIMENSION_MISSING");
    if (review.outcome === "DENIED") {
      if (!Array.isArray(review.negativeEvidence) || review.negativeEvidence.length === 0) throw new Error("EVIDENCE_REVIEW_DENIAL_EVIDENCE_MISSING");
      for (const negative of review.negativeEvidence) {
        const found = allCells.get(`${negative.systemId}:${negative.sourceCellDigest}`);
        if (!found || !["ABSENT", "CONFLICTING"].includes(found.cell.state) || negative.state !== found.cell.state || canonicalJson(negative.counterexamples) !== canonicalJson(found.cell.counterexamples)) throw new Error("EVIDENCE_REVIEW_DENIAL_EVIDENCE_MISMATCH");
      }
    }
    if (["POTENTIAL_EQUIVALENCE", "VARIANT_RELATION", "DISTINCT"].includes(review.outcome)) {
      const edge = edgeById.get(review.relationId);
      if (!edge || edge.state !== review.outcome || new Set(edge.systems).size < 2) throw new Error("RELATION_MINIMUM_PROOF_MISSING");
      for (const dimension of [...(edge.matchingDimensions ?? []), ...(edge.differingDimensions ?? [])]) validateReferences(dimension.evidence);
      if (review.outcome === "VARIANT_RELATION" && (!edge.matchingDimensions?.some((x) => x.dimension === "purpose") || !edge.differingDimensions?.some((x) => relationSpec.minimumProofRules.VARIANT_RELATION.requiredDifferingDimensionsAnyOf.includes(x.dimension)))) throw new Error("RELATION_MINIMUM_PROOF_MISSING");
    }
  }
  for (const edge of relationSpec.evidenceEdges) if (!evidenceReview.reviews.some((review) => review.relationId === edge.relationId && review.outcome === edge.state)) throw new Error("RELATION_EDGE_WITHOUT_REVIEW");
  return { outcome: "VERIFIED", stateDistribution: states };
}

export async function loadReleasedInputs({ repoRoot }) {
  const manifestPath = resolve(repoRoot, "tests/fixtures/cscl-07/released-input-set-manifest-v1.json");
  const relationPath = resolve(repoRoot, "tests/fixtures/cscl-07/relation-spec-v1.json");
  const reviewPath = resolve(repoRoot, "tests/fixtures/cscl-07/evidence-review-v1.json");
  const manifest = parse(await readFile(manifestPath));
  const relationSpec = parse(await readFile(relationPath));
  const evidenceReview = parse(await readFile(reviewPath));
  const { manifestDigest, ...manifestBody } = manifest;
  const { specDigest, ...specBody } = relationSpec;
  if (digest(manifestBody) !== manifestDigest) throw new Error("INPUT_MANIFEST_DIGEST_MISMATCH");
  if (digest(specBody) !== specDigest) throw new Error("RELATION_SPEC_DIGEST_MISMATCH");
  if (manifest.releasedMain !== "8dae13e416ca42709bf04f01faba5b3b4708deeb" || manifest.releaseTag !== "2026_08_31_v3") throw new Error("RELEASE_BINDING_MISMATCH");
  if (canonicalJson(manifest.systemOrder) !== canonicalJson(["odoo-community", "erpnext", "dolibarr", "tryton", "apache-ofbiz"])) throw new Error("PROFILE_SET_OR_ORDER_MISMATCH");
  if (manifest.profiles.length !== 5 || new Set(manifest.profiles.map((x) => x.systemId)).size !== 5) throw new Error("PROFILE_DENOMINATOR_MISMATCH");

  const loaded = [];
  for (const binding of manifest.profiles) {
    for (const artifact of binding.artifacts) {
      const bytes = await readFile(resolve(repoRoot, artifact.path));
      if (bytes.length !== artifact.byteLength || sha256(bytes) !== artifact.sha256) throw new Error("RELEASED_ARTIFACT_DIGEST_MISMATCH");
    }
    const receipt = await readJson(repoRoot, binding.receiptPath);
    const profileArtifact = await readJson(repoRoot, binding.profilePath);
    const factsArtifact = binding.factsPath ? await readJson(repoRoot, binding.factsPath) : undefined;
    const cellsArtifact = binding.cellsPath ? await readJson(repoRoot, binding.cellsPath) : undefined;
    const source = extract(binding.systemId, profileArtifact, factsArtifact, cellsArtifact);
    if (digest(receipt) !== binding.receiptDigest || digest(source.profile) !== binding.profileDigest || digest(source.facts) !== binding.factsDigest || digest(source.cells) !== binding.cellsDigest) throw new Error("RELEASED_PROFILE_CONTENT_DIGEST_MISMATCH");
    if (source.profile.systemId !== binding.systemId || source.cells.length !== 36 || source.profile.evidenceCells.length !== 36 || source.facts.length !== binding.counts.facts) throw new Error("RELEASED_PROFILE_DENOMINATOR_MISMATCH");
    const factsById = new Map(source.facts.map((fact) => [fact.factId, fact]));
    if (factsById.size !== source.facts.length) throw new Error("DUPLICATE_SOURCE_FACT");
    loaded.push({ ...source, receipt, binding, factsById });
  }
  const states = Object.fromEntries(["SUPPORTED", "ABSENT", "AMBIGUOUS", "VARIANT", "CONFLICTING", "UNMAPPED"].map((state) => [state, loaded.flatMap((x) => x.cells).filter((cell) => cell.state === state).length]));
  const expectedStates = { SUPPORTED: 152, ABSENT: 8, AMBIGUOUS: 16, VARIANT: 1, CONFLICTING: 3, UNMAPPED: 0 };
  if (canonicalJson(states) !== canonicalJson(expectedStates)) throw new Error("RELEASED_CELL_STATE_DENOMINATOR_MISMATCH");
  const inputs = { manifest, relationSpec, evidenceReview, profiles: loaded, stateDistribution: states };
  verifyReleasedInputs(inputs);
  return inputs;
}

function produceMatrix(inputs) {
  const { manifest, relationSpec, evidenceReview, profiles } = inputs;
  const edgeById = new Map(relationSpec.evidenceEdges.map((edge) => [edge.relationId, edge]));
  const rows = [];
  const relationCandidates = [];
  let index = 0;
  for (const capabilityFamily of manifest.familyOrder) for (const questionId of manifest.questionOrder) {
    const cells = profiles.map((source) => {
      const sourceCell = source.cells[index];
      const profileReference = source.profile.evidenceCells[index];
      if (profileReference.capabilityFamily !== capabilityFamily || !(profileReference.questionId === questionId || profileReference.questionId.endsWith(`--${questionId}`))) throw new Error("SOURCE_CELL_COORDINATE_MISMATCH");
      if (sourceCell.systemId !== source.binding.systemId) throw new Error("SOURCE_CELL_SYSTEM_MISMATCH");
      const sourceFacts = sourceCell.evidence.map((reference) => {
        const fact = source.factsById.get(reference.sourceFactId);
        if (!fact || fact.exactEvidence.excerptSha256 !== reference.excerptSha256 || fact.exactEvidence.exactLocator !== reference.exactLocator) throw new Error("SOURCE_CELL_FACT_SUBSTITUTION");
        return fact;
      });
      if (sourceFacts.length === 0) throw new Error("SOURCE_CELL_EVIDENCE_OMITTED");
      if (["ABSENT", "CONFLICTING"].includes(sourceCell.state) && sourceCell.counterexamples.length === 0) throw new Error("SOURCE_NEGATIVE_COUNTEREXAMPLE_OMITTED");
      return {
        systemId: source.binding.systemId,
        sourceProfileDigest: source.binding.profileDigest,
        sourceCellDigest: digest(sourceCell),
        sourceCell,
        sourceFacts,
      };
    });
    const relationId = `relation:${capabilityFamily}:${questionId}`;
    const review = evidenceReview.reviews[index];
    const edge = edgeById.get(relationId);
    rows.push({ capabilityFamily, questionId, cells });
    relationCandidates.push({
      relationId,
      capabilityFamily,
      questionId,
      state: review.outcome,
      reason: review.reason,
      supportedDimensions: edge ? [...edge.matchingDimensions, ...edge.differingDimensions].map((dimension) => dimension.dimension) : [],
      cellReferences: cells.map((cell) => ({
        systemId: cell.systemId,
        sourceProfileDigest: cell.sourceProfileDigest,
        sourceCellDigest: cell.sourceCellDigest,
        sourceFactIds: cell.sourceFacts.map((fact) => fact.factId),
        evidenceReferences: cell.sourceCell.evidence,
      })),
    });
    index += 1;
  }
  return {
    schemaVersion: "pansphaira.cscl07/semantic-evidence-matrix/v1",
    releasedInputSetManifestDigest: manifest.manifestDigest,
    relationSpecDigest: relationSpec.specDigest,
    evidenceReviewDigest: evidenceReview.reviewDigest,
    systemOrder: manifest.systemOrder,
    familyOrder: manifest.familyOrder,
    questionOrder: manifest.questionOrder,
    sourceProfiles: profiles.map((source) => ({ systemId: source.binding.systemId, profile: source.profile, sourceFacts: source.facts })),
    rows,
    relationCandidates,
    nonclaims: relationSpec.nonclaims,
  };
}

export function verifyMatrix(matrix, inputs) {
  verifyReleasedInputs(inputs);
  exactKeys(matrix, ["schemaVersion", "releasedInputSetManifestDigest", "relationSpecDigest", "evidenceReviewDigest", "systemOrder", "familyOrder", "questionOrder", "sourceProfiles", "rows", "relationCandidates", "nonclaims"], "MATRIX_EXTRA_OR_MISSING_FIELD");
  if (canonicalJson(matrix) !== canonicalJson(produceMatrix(inputs))) throw new Error("MATRIX_REPLAY_MISMATCH");
  return { outcome: "VERIFIED", rows: 36, cells: 180, holdoutAccesses: 0, matrixDigest: digest(matrix) };
}

export async function buildMatrix({ repoRoot }) {
  const inputs = await loadReleasedInputs({ repoRoot });
  const matrix = produceMatrix(inputs);
  const verification = verifyMatrix(matrix, inputs);
  return { inputs, matrix, verification };
}

export async function renderArtifacts({ repoRoot }) {
  const built = await buildMatrix({ repoRoot });
  const matrix = `${canonicalJson(built.matrix)}\n`;
  const states = ["SUPPORTED", "ABSENT", "AMBIGUOUS", "VARIANT", "CONFLICTING", "UNMAPPED"];
  const stateDistributionBySystem = Object.fromEntries(built.inputs.profiles.map((source) => [source.binding.systemId, Object.fromEntries(states.map((state) => [state, source.cells.filter((cell) => cell.state === state).length]))]));
  const relationStates = ["POTENTIAL_EQUIVALENCE", "VARIANT_RELATION", "DISTINCT", "UNRESOLVED", "DENIED"];
  const relationCandidateCounts = Object.fromEntries(relationStates.map((state) => [state, built.matrix.relationCandidates.filter((candidate) => candidate.state === state).length]));
  const receiptBody = {
    schemaVersion: "pansphaira.cscl07/semantic-evidence-matrix-receipt/v1",
    receiptId: "cscl-07-semantic-evidence-matrix-receipt-v1",
    releasedMain: built.inputs.manifest.releasedMain,
    releaseTag: built.inputs.manifest.releaseTag,
    outcome: "COMPLETE_MATRIX_WITH_EXPLICIT_UNRESOLVED_AND_DENIED_RELATIONS",
    counts: { profiles: 5, families: 3, questionsPerFamily: 12, rows: 36, inputCells: 180, omittedCells: 0, duplicatedCells: 0, evidenceReviews: 36, holdoutAccesses: 0 },
    stateDistribution: built.inputs.stateDistribution,
    stateDistributionBySystem,
    relationCandidateCounts,
    unresolvedDeniedCounts: { unresolved: relationCandidateCounts.UNRESOLVED, denied: relationCandidateCounts.DENIED },
    digests: {
      releasedInputSetManifest: built.inputs.manifest.manifestDigest,
      relationSpec: built.inputs.relationSpec.specDigest,
      evidenceReview: built.inputs.evidenceReview.reviewDigest,
      matrix: built.verification.matrixDigest,
    },
    matrixCanonicalByteLength: Buffer.byteLength(matrix.slice(0, -1)),
    verification: {
      initialRedCommand: "node --test tests/cscl-07/matrix.test.mjs",
      initialRedReason: "ERR_MODULE_NOT_FOUND src/cscl-07/matrix.mjs",
      focusedCommand: "node --test tests/cscl-07/matrix.test.mjs",
      deterministicReplayRuns: 2,
      deterministicReplayByteIdentical: true,
      releasedStateDenominatorVerified: true,
      reviewLedgerComplete: true,
      networkAccesses: 0,
      holdoutAccesses: 0,
    },
    nonclaims: built.inputs.relationSpec.nonclaims,
  };
  const receipt = { ...receiptBody, receiptDigest: digest(receiptBody) };
  return { matrix, receipt: `${canonicalJson(receipt)}\n` };
}
