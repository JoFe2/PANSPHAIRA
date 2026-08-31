import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import Ajv2020 from "ajv/dist/2020.js";
import addFormats from "ajv-formats";

export const SCHEMA_PATHS = Object.freeze([
  "contracts/cscl-01/source-fact-v1.schema.json",
  "contracts/cscl-01/system-profile-v1.schema.json",
  "contracts/cscl-01/semantic-concept-v1.schema.json",
  "contracts/cscl-01/process-pattern-candidate-v1.schema.json",
  "contracts/cscl-01/capability-candidate-v1.schema.json",
  "contracts/cscl-01/evidence-cell-v1.schema.json",
  "contracts/cscl-01/mapping-receipt-v1.schema.json",
  "contracts/cscl-01/holdout-verdict-v1.schema.json",
]);

const FIXTURE_PATHS = Object.freeze({
  selectors: "tests/fixtures/cscl-01/source-selector-set-v1.json",
  questions: "tests/fixtures/cscl-01/question-inventory-v1.json",
  rules: "tests/fixtures/cscl-01/decision-rule-v1.json",
  adversarial: "tests/fixtures/cscl-01/adversarial-cases-v1.json",
});

export const CAPABILITY_FAMILIES = Object.freeze([
  "PARTY_CUSTOMER_MANAGEMENT",
  "PRODUCT_ITEM_MANAGEMENT",
  "SALES_ORDER_MANAGEMENT",
]);
export const QUESTION_KINDS = Object.freeze([
  "OBJECTS_ROLES", "RELATIONS", "OPERATIONS", "INPUTS_OUTPUTS",
  "STATES_TRANSITIONS", "EVENTS", "PRECONDITIONS", "INVARIANTS",
  "EXCEPTIONS_ERRORS", "READBACKS", "API_SERVICE_EXPOSURE",
  "ABSENCE_AMBIGUITY_CONFLICT",
]);
export const EVIDENCE_STATES = Object.freeze([
  "SUPPORTED", "VARIANT", "ABSENT", "AMBIGUOUS", "CONFLICTING", "UNMAPPED",
]);
const TRAINING_IDS = Object.freeze(["odoo-community", "erpnext", "dolibarr", "tryton", "apache-ofbiz"]);
const GATE_NAMES = Object.freeze(["source", "legal", "history", "integrity", "denominator", "isolation"]);
const DIGEST = /^[a-f0-9]{64}$/;
const BOUNDARY = Object.freeze({ authorityGrant: "NONE", promotionGrant: "NONE", executionGrant: "NONE" });

function encodeCanonical(value) {
  if (value === null) return "null";
  if (typeof value === "string" || typeof value === "boolean") return JSON.stringify(value);
  if (typeof value === "number" && Number.isFinite(value)) return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(encodeCanonical).join(",")}]`;
  if (typeof value === "object" && Object.getPrototypeOf(value) === Object.prototype) {
    return `{${Object.keys(value).sort().map((key) => {
      if (value[key] === undefined) throw new Error("UNSAFE_CANONICAL_VALUE");
      return `${JSON.stringify(key)}:${encodeCanonical(value[key])}`;
    }).join(",")}}`;
  }
  throw new Error("UNSAFE_CANONICAL_VALUE");
}

export function canonicalJson(value) {
  return encodeCanonical(value);
}

export function sha256Bytes(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

async function readFixture(repoRoot, path) {
  return JSON.parse(await readFile(resolve(repoRoot, path), "utf8"));
}

function validateSelectorSet(selectors) {
  const ids = selectors?.systems?.map((system) => system.id) ?? [];
  if (canonicalJson(ids) !== canonicalJson([...TRAINING_IDS, "idempiere"])) throw new Error("SOURCE_SYSTEM_SET_DRIFT");
  if (selectors.systems.filter((system) => system.role === "TRAINING").length !== 5) throw new Error("TRAINING_DENOMINATOR_DRIFT");
  if (selectors.systems.filter((system) => system.role === "HOLDOUT").map((system) => system.id).join() !== "idempiere") throw new Error("HOLDOUT_IDENTITY_DRIFT");
  for (const system of selectors.systems) {
    if (!system.source?.pinnedUrl?.startsWith("https://") || /(?:\/|=)(?:main|master|latest)(?:\/|$)/i.test(system.source.pinnedUrl)) throw new Error("MOVING_ONLY_IDENTITY");
    if (!system.legal?.licenseId || !DIGEST.test(system.legal.licenseSha256) || !Array.isArray(system.legal.obligations) || system.legal.obligations.length === 0) throw new Error("LEGAL_IDENTITY_INCOMPLETE");
    if (system.id !== "tryton") {
      if (!/^[a-f0-9]{40}$/.test(system.source.commit) || !system.source.pinnedUrl.includes(system.source.commit)) throw new Error("IMMUTABLE_COMMIT_REQUIRED");
      if (!system.legal.licenseUrl.includes(system.source.commit)) throw new Error("LICENSE_URL_NOT_PINNED_TO_SOURCE");
    }
  }
  const tryton = selectors.systems.find((system) => system.id === "tryton");
  if (tryton.source.kind !== "SIGNED_OFFICIAL_ARTIFACT_SET" || tryton.source.officialRepository !== "https://downloads.tryton.org/8.0/") throw new Error("TRYTON_OFFICIAL_SIGNED_SOURCE_REQUIRED");
  if (/github\.com\/tryton/i.test(canonicalJson(tryton))) throw new Error("TRYTON_MIRROR_FORBIDDEN");
  if (tryton.source.artifacts.length !== 4 || tryton.source.artifacts.some((artifact) => !artifact.url.startsWith("https://downloads.tryton.org/8.0/") || !artifact.signatureUrl.startsWith("https://downloads.tryton.org/8.0/") || !DIGEST.test(artifact.sha256) || !DIGEST.test(artifact.signatureSha256))) throw new Error("TRYTON_ARTIFACT_SET_INCOMPLETE");
  const holdout = selectors.systems.find((system) => system.id === "idempiere");
  if (!holdout.legal.licenseUrl.endsWith(`/${holdout.source.commit}/LICENSE.md`) || holdout.legal.noticeUrl !== null || holdout.legal.noticeStatus !== "NO_REPOSITORY_NOTICE_FILE_IDENTIFIED_RETAIN_FILE_LEVEL_NOTICES_IF_PRESENT") throw new Error("HOLDOUT_LEGAL_IDENTITY_INVALID");
}

function validateQuestionInventory(questions) {
  if (canonicalJson(questions.capabilityFamilies) !== canonicalJson(CAPABILITY_FAMILIES)) throw new Error("CAPABILITY_FAMILY_DRIFT");
  if (canonicalJson(questions.questions.map((question) => question.kind)) !== canonicalJson(QUESTION_KINDS)) throw new Error("QUESTION_INVENTORY_DRIFT");
  if (/generic|common-core/i.test(questions.inventoryId) || /what generic|common-core/i.test(questions.questions.map((question) => question.prompt).join(" "))) throw new Error("PREMATURE_NORMALIZATION_FORBIDDEN");
  if (!questions.questions.slice(0, 4).every((question) => /source-native/i.test(question.prompt))) throw new Error("SOURCE_NATIVE_QUESTION_REQUIRED");
}

function validateRules(rules) {
  if (rules.trainingDenominator !== 5 || rules.minimumEquivalentTrainingSystems !== 4 || rules.commonCore.completeCellsRequired !== 5) throw new Error("COMMON_CORE_THRESHOLD_DRIFT");
  if (rules.commonCore.exactEvidenceRequired !== true || rules.commonCore.unresolvedConflictingCounterexamplesAllowed !== 0 || rules.commonCore.frequencyNameOrShapeAloneQualifies !== false) throw new Error("COMMON_CORE_RULE_DRIFT");
  if (canonicalJson(rules.evidenceStates) !== canonicalJson(EVIDENCE_STATES)) throw new Error("EVIDENCE_STATE_DRIFT");
  if (rules.holdoutFamilyGo.coreIdentityMeaningPreservationRatio !== 1 || rules.holdoutFamilyGo.maximumCoreContradictions !== 0 || rules.holdoutFamilyGo.minimumApplicableMappedRatio !== 0.8 || rules.holdoutFamilyGo.maximumUnmappedRatio !== 0.2) throw new Error("HOLDOUT_THRESHOLD_DRIFT");
  if (canonicalJson(rules.boundary) !== canonicalJson(BOUNDARY)) throw new Error("BOUNDARY_WIDENING");
}

export async function validateProtocolSchemas({ repoRoot }) {
  const ajv = new Ajv2020({ allErrors: true, strict: true, allowUnionTypes: true });
  addFormats(ajv);
  const errors = [];
  for (const path of SCHEMA_PATHS) {
    try {
      const schema = JSON.parse(await readFile(resolve(repoRoot, path), "utf8"));
      ajv.compile(schema);
    } catch (error) {
      errors.push({ path, message: error.message });
    }
  }
  return { valid: errors.length === 0, errors };
}

export async function freezeProtocol({ repoRoot }) {
  const fixtures = {};
  for (const [name, path] of Object.entries(FIXTURE_PATHS)) fixtures[name] = await readFixture(repoRoot, path);
  validateSelectorSet(fixtures.selectors);
  validateQuestionInventory(fixtures.questions);
  validateRules(fixtures.rules);
  const digests = Object.fromEntries(Object.entries(fixtures).map(([name, value]) => [name, sha256Bytes(Buffer.from(canonicalJson(value)))]));
  const bundle = {
    schemaVersion: "pansphaira.cscl01/protocol-freeze/v1",
    fixtures,
    digests,
    boundary: BOUNDARY,
  };
  const bytes = Buffer.from(canonicalJson(bundle));
  return { bundle, bytes, digest: sha256Bytes(bytes), digests };
}

export async function verifyFrozenProtocol(bundle, { repoRoot } = {}) {
  try {
    const trusted = await freezeProtocol({ repoRoot });
    const suppliedNames = Object.keys(bundle?.fixtures ?? {}).sort();
    if (canonicalJson(suppliedNames) !== canonicalJson(Object.keys(FIXTURE_PATHS).sort())) throw new Error("FIXTURE_SET_MISMATCH");
    for (const name of suppliedNames) {
      const actual = sha256Bytes(Buffer.from(canonicalJson(bundle.fixtures[name])));
      if (actual !== bundle.digests?.[name] || actual !== trusted.digests[name]) throw new Error("TRUSTED_FIXTURE_DIGEST_MISMATCH");
    }
    if (canonicalJson(bundle.boundary) !== canonicalJson(BOUNDARY)) throw new Error("BOUNDARY_WIDENING");
    return { outcome: "VERIFIED", reasonCodes: ["COMMITTED_PROTOCOL_FIXTURES_VERIFIED"], replayDigest: sha256Bytes(Buffer.from(canonicalJson(bundle))) };
  } catch (error) {
    return { outcome: "DENIED", reasonCodes: [error.message] };
  }
}

export function sealCandidate(candidate) {
  const copy = structuredClone(candidate);
  delete copy.candidateBytesSha256;
  delete copy.candidateDigest;
  const bytes = Buffer.from(canonicalJson(copy));
  const digest = sha256Bytes(bytes);
  return { candidate: { ...copy, candidateBytesSha256: digest, candidateDigest: digest }, bytes, digest };
}

export function evaluateCommonCore(cells) {
  const reasonCodes = [];
  const bySystem = new Map((cells ?? []).map((cell) => [cell.systemId, cell]));
  if (cells?.length !== 5 || bySystem.size !== 5 || TRAINING_IDS.some((id) => !bySystem.has(id))) reasonCodes.push("INCOMPLETE_FIVE_SYSTEM_DENOMINATOR");
  let equivalents = 0;
  for (const id of TRAINING_IDS) {
    const cell = bySystem.get(id);
    if (!cell) continue;
    const exact = Array.isArray(cell.evidence) && cell.evidence.length > 0 && cell.evidence.every((item) => item.exactLocator && DIGEST.test(item.excerptSha256));
    if (!exact) reasonCodes.push("EXACT_EVIDENCE_REQUIRED");
    if (["ABSENT", "CONFLICTING"].includes(cell.state) && (!Array.isArray(cell.counterexamples) || cell.counterexamples.length === 0)) reasonCodes.push("NEGATIVE_EVIDENCE_INCOMPLETE");
    if (cell.state === "CONFLICTING") reasonCodes.push("UNRESOLVED_CONFLICTING_COUNTEREXAMPLE");
    const proof = cell.equivalenceProof;
    if (["SUPPORTED", "VARIANT"].includes(cell.state) && proof && DIGEST.test(proof.nativeMeaningSha256) && proof.nativeMeaningSha256 === proof.candidateMeaningSha256) equivalents += 1;
  }
  if (equivalents < 4) reasonCodes.push("SEMANTIC_EQUIVALENCE_BELOW_4_OF_5");
  const uniqueReasons = [...new Set(reasonCodes)];
  return { classification: uniqueReasons.length === 0 ? "COMMON_CORE" : "DENIED", equivalentSystems: equivalents, reasonCodes: uniqueReasons };
}

function deriveMappingCounts(input, reasons) {
  if (!Array.isArray(input.mappings)) return {
    applicable: input.applicable, mappedToCore: input.mappedToCore,
    mappedToVariant: input.mappedToVariant, unmapped: input.unmapped,
  };
  const extensions = Array.isArray(input.extensions) ? input.extensions : [];
  const ids = [...input.mappings.map((row) => row.holdoutConceptId), ...extensions.map((row) => row.holdoutConceptId)];
  if (new Set(ids).size !== ids.length) reasons.push("DUPLICATE_HOLDOUT_CONCEPT");
  for (const row of input.mappings) {
    const mapped = row.classification === "CORE" || row.classification === "VARIANT";
    if ((mapped && (!row.candidateElementId || row.meaningPreserved !== true)) || (!mapped && (row.classification !== "UNMAPPED" || row.candidateElementId !== null || row.meaningPreserved !== false))) reasons.push("MAPPING_CLASSIFICATION_INCONSISTENT");
  }
  return {
    applicable: ids.length,
    mappedToCore: input.mappings.filter((row) => row.classification === "CORE").length,
    mappedToVariant: input.mappings.filter((row) => row.classification === "VARIANT").length,
    unmapped: input.mappings.filter((row) => row.classification === "UNMAPPED").length + extensions.length,
  };
}

function deriveCoreCounts(input, reasons) {
  if (!Array.isArray(input.coreElements)) return { coreTotal: input.coreTotal, coreIdentityPreserved: input.coreIdentityPreserved, coreContradictions: input.coreContradictions };
  const ids = input.coreElements.map((element) => element.id);
  if (new Set(ids).size !== ids.length) reasons.push("DUPLICATE_CORE_ELEMENT");
  if (input.coreElements.some((element) => element.deleted || element.renamed || element.semanticMutation)) reasons.push("FUNDAMENTAL_CORE_REWRITE");
  return {
    coreTotal: input.coreElements.length,
    coreIdentityPreserved: input.coreElements.filter((element) => element.identityPreserved === true && !element.deleted && !element.renamed && !element.semanticMutation).length,
    coreContradictions: input.coreElements.filter((element) => element.contradiction === true).length,
  };
}

export function evaluateHoldoutFamily(input) {
  const reasonCodes = [];
  const actualDigest = sha256Bytes(input.candidateBytes);
  if (actualDigest !== input.frozenCandidateDigest) reasonCodes.push("CANDIDATE_BYTES_MUTATED_AFTER_FREEZE");
  const counts = deriveMappingCounts(input, reasonCodes);
  const core = deriveCoreCounts(input, reasonCodes);
  const { applicable, mappedToCore, mappedToVariant, unmapped } = counts;
  const { coreTotal, coreIdentityPreserved, coreContradictions } = core;
  if (!Number.isInteger(applicable) || applicable <= 0 || mappedToCore + mappedToVariant + unmapped !== applicable) reasonCodes.push("INCOMPLETE_OR_INCONSISTENT_DENOMINATOR");
  if (!Number.isInteger(coreTotal) || coreTotal <= 0 || coreIdentityPreserved > coreTotal) reasonCodes.push("INVALID_CORE_DENOMINATOR");
  const mappingRatio = applicable > 0 ? (mappedToCore + mappedToVariant) / applicable : 0;
  const unmappedRatio = applicable > 0 ? unmapped / applicable : 1;
  const corePreservationRatio = coreTotal > 0 ? coreIdentityPreserved / coreTotal : 0;
  if (corePreservationRatio !== 1) reasonCodes.push("CORE_IDENTITY_OR_MEANING_NOT_100_PERCENT_PRESERVED");
  if (coreContradictions !== 0) reasonCodes.push("CORE_CONTRADICTION");
  if (mappingRatio < 0.8) reasonCodes.push("HOLDOUT_MAPPING_BELOW_80_PERCENT");
  if (unmappedRatio > 0.2) reasonCodes.push("HOLDOUT_UNMAPPED_ABOVE_20_PERCENT");
  for (const gate of GATE_NAMES) if (input.governanceGates?.[gate] !== true) reasonCodes.push(`${gate.toUpperCase()}_HARD_GATE_FAILED`);
  const uniqueReasons = [...new Set(reasonCodes)];
  return {
    verdict: uniqueReasons.length === 0 ? "GO" : "FALSIFIED_WITH_EVIDENCE",
    reasonCodes: uniqueReasons,
    mappingRatio,
    unmappedRatio,
    corePreservationRatio,
    denominators: { ...counts, ...core },
    inputs: input,
  };
}

export function deriveOverallVerdict(familyResults, governanceGates) {
  const reasonCodes = [];
  if (!Array.isArray(familyResults) || familyResults.length !== 3) reasonCodes.push("INCOMPLETE_THREE_FAMILY_DENOMINATOR");
  const normalized = (familyResults ?? []).map((result) => typeof result === "string" ? result : result.verdict);
  const namedFamilies = (familyResults ?? []).filter((result) => typeof result === "object").map((result) => result.capabilityFamily);
  if (namedFamilies.length > 0 && (new Set(namedFamilies).size !== 3 || CAPABILITY_FAMILIES.some((family) => !namedFamilies.includes(family)))) reasonCodes.push("DUPLICATE_OR_MISSING_CAPABILITY_FAMILY");
  for (const gate of GATE_NAMES) if (governanceGates?.[gate] !== true) reasonCodes.push(`${gate.toUpperCase()}_HARD_GATE_FAILED`);
  if (reasonCodes.length > 0) return { verdict: "FALSIFIED_WITH_EVIDENCE", reasonCodes };
  const passCount = normalized.filter((value) => value === "GO").length;
  if (passCount === 3) return { verdict: "GO", reasonCodes: ["ALL_THREE_FAMILIES_GO"] };
  if (passCount === 1 || passCount === 2) return { verdict: "NARROW_GO", reasonCodes: ["ONE_OR_TWO_FAMILIES_GO"] };
  return { verdict: "FALSIFIED_WITH_EVIDENCE", reasonCodes: ["NO_FAMILY_GO"] };
}
