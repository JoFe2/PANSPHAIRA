/**
 * Immutable CKS-12 Part-II story-step catalog and its v2 evidence bindings.
 *
 * v2 binds every catalog row to a distinct versioned fixture subject and
 * versioned receipt subject. It remains a dry, synthetic contract: no model,
 * runtime, Workflow, Function, adapter, or production action is executed.
 */

import { createHash } from "node:crypto";

export function canonicalJson(value: unknown): string {
  if (value === null || typeof value === "boolean" || typeof value === "string") return JSON.stringify(value);
  if (typeof value === "number") {
    if (!Number.isFinite(value)) throw new TypeError("Canonical JSON rejects non-finite numbers");
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  if (typeof value !== "object" || Object.getPrototypeOf(value) !== Object.prototype) {
    throw new TypeError("Canonical JSON accepts plain JSON objects only");
  }
  const record = value as Record<string, unknown>;
  return `{${Object.keys(record).sort().map((key) => {
    if (record[key] === undefined) throw new TypeError("Canonical JSON rejects undefined object values");
    return `${JSON.stringify(key)}:${canonicalJson(record[key])}`;
  }).join(",")}}`;
}

const utf8 = new TextEncoder();
const sha256Hex = (value: string | Uint8Array): string => createHash("sha256").update(value).digest("hex");
const digestCanonical = (value: unknown): string => sha256Hex(utf8.encode(canonicalJson(value)));

export const BOUNDARY_RECEIPT_ID = "CKS-12-CLOSED-LOOP-BOUNDARY-V1";
export const BOUNDARY_RECEIPT_SHA256 = "d643f720a996c9ac2d167296c1edfd228760a3ca19196c09f9c0dfd6615d1328";
export const BOUNDARY_CONTRACT_VERSION = "v1";
export const REPOSITORY = "JoFe2/PANSPHAIRA";
export const BASE_COMMIT = "353017c4f60e30463d0a78fd6fd2509a37d37f76";
export const GENESIS_PREVIOUS_RECEIPT_SHA256 = "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855";

export const STORY_STEP_FIXTURE_SCHEMA_VERSION = "chimpmaera.cks/story-step-fixture/v2";
export const STORY_STEP_VERSION_RECEIPT_SCHEMA_VERSION = "chimpmaera.cks/story-step-version-receipt/v2";
export const STORY_STEP_RECEIPT_SCHEMA_VERSION = "chimpmaera.cks/closed-loop-step-receipt/v1";
export const STORY_STEP_FIXTURE_ID = "CKS-12-PART-II-STORY-STEPS-FIXTURE-V2";
export const STORY_STEP_VERSION_RECEIPT_ID = "CKS-12-STORY-STEP-VERSION-RECEIPT-V2";
export const STORY_STEP_VERSION_RUN_ID = "CKS-12-STORY-STEP-VERSION-RUN-V2";
export const STORY_STEP_FIXTURE_VERSION = "v2";
export const STORY_STEP_CATALOG_KIND = "ORDERED_PART_II_SYNTHETIC_STORY_STEPS";
export const STORY_STEP_COUNT = 23;
export const HASH_ALGORITHM = "SHA-256";
export const DIGEST_ENCODING = "64_LOWERCASE_HEXADECIMAL_NO_PREFIX";
export const MUTATION_RULE = "BYTE_CHANGE_REQUIRES_NEW_VERSION_AND_DIGEST";
export const RECEIPT_DIGEST_RULE = "SHA256_CANONICAL_JSON_OMIT_ONLY_TOP_LEVEL_receiptSha256";

export const ORDERED_STORY_STEP_IDS = Object.freeze([
  "CKS-12-P2-SS-01", "CKS-12-P2-SS-02", "CKS-12-P2-SS-03", "CKS-12-P2-SS-04",
  "CKS-12-P2-SS-05", "CKS-12-P2-SS-06", "CKS-12-P2-SS-07", "CKS-12-P2-SS-08",
  "CKS-12-P2-SS-09", "CKS-12-P2-SS-10", "CKS-12-P2-SS-11", "CKS-12-P2-SS-12",
  "CKS-12-P2-SS-13", "CKS-12-P2-SS-14", "CKS-12-P2-SS-15", "CKS-12-P2-SS-16",
  "CKS-12-P2-SS-17", "CKS-12-P2-SS-18", "CKS-12-P2-SS-19", "CKS-12-P2-SS-20",
  "CKS-12-P2-SS-21", "CKS-12-P2-SS-22", "CKS-12-P2-SS-23",
] as const);
export const STORY_STEP_VOCABULARY_SHA256 = "d178bb61b1e773e8ecc2641a439392a5b882d4b40d494feb66042a770906b869";

export interface StoryStepFixtureEntry {
  ordinal: number;
  id: string;
  event: string;
  ownerIssue: string;
  requiredResult: string;
}
const step = (ordinal: number, id: string, event: string, ownerIssue: string, requiredResult: string): StoryStepFixtureEntry => ({
  ordinal, id, event, ownerIssue, requiredResult,
});
const rawStorySteps: StoryStepFixtureEntry[] = [
  step(1, "CKS-12-P2-SS-01", "EMPTY_KNOWLEDGE_BASELINE", "#287", "Exact empty or minimal Knowledge edition and ground-truth requirements locked before solving"),
  step(2, "CKS-12-P2-SS-02", "KNOWLEDGE_NEED_DECLARED", "#287", "Typed Need binds decision, Knowledge classes, scope, and unresolved material claims"),
  step(3, "CKS-12-P2-SS-03", "FORWARD_REQUIREMENTS_ENUMERATED", "#287", "Forward requirements recorded independently of solver output"),
  step(4, "CKS-12-P2-SS-04", "ALTERNATE_RETRIEVAL_EXHAUSTED", "#287", "Primary and frozen alternate retrieval attempts separately receipted"),
  step(5, "CKS-12-P2-SS-05", "KNOWLEDGE_GAP_CONFIRMED", "#287", "Finite gap class distinguishes retrieval failure, missing Knowledge, and unknown semantics"),
  step(6, "CKS-12-P2-SS-06", "OFFLINE_ACQUISITION_PLANNED", "#287", "Bounded plan selects only a prepackaged public-synthetic source fixture"),
  step(7, "CKS-12-P2-SS-07", "SOURCE_EVIDENCE_ACQUIRED", "#287", "Immutable ACQUIRED_UNTRUSTED source evidence with no validation, promotion, Capability, or Authority"),
  step(8, "CKS-12-P2-SS-08", "KNOWLEDGE_CANDIDATE_CREATED", "#287", "New immutable Knowledge asset in CANDIDATE"),
  step(9, "CKS-12-P2-SS-09", "CANDIDATE_VALIDATED", "#287", "Independent validation binds source, contradiction, Applicability, freshness, and sufficiency"),
  step(10, "CKS-12-P2-SS-10", "GOVERNED_SYNTHETIC_PROMOTION", "#287", "Separate governed receipt creates PROMOTED_SYNTHETIC_ONLY without live activation"),
  step(11, "CKS-12-P2-SS-11", "KNOWLEDGE_SUFFICIENCY_PROVED", "#287", "Forward, gap-finder, boundary, and backward proof bind the promoted exact version"),
  step(12, "CKS-12-P2-SS-12", "GROUNDED_SOLUTION_RECORDED", "#288", "Every material solution claim binds used Knowledge and Evidence or abstains"),
  step(13, "CKS-12-P2-SS-13", "USAGE_OUTCOME_LINEAGE_RECORDED", "#288", "Minimized Task to Search to Knowledge to Decision to Outcome lineage complete"),
  step(14, "CKS-12-P2-SS-14", "OPERATIONAL_REPETITION_RECORDED", "#288", "Same-context repeats increment only +O"),
  step(15, "CKS-12-P2-SS-15", "CROSS_CONTEXT_GENERALIZATION_RECORDED", "#288", "Distinct predeclared holdout strata contribute at most one +G unit per stratum"),
  step(16, "CKS-12-P2-SS-16", "FAILURE_ATTRIBUTED", "#288", "Planted negative outcome receives finite causal class and explicit uncertainty or multi-cause set"),
  step(17, "CKS-12-P2-SS-17", "APPLICABILITY_NARROWED", "#288", "Narrower immutable candidate separately validates and receives governed synthetic-only promotion"),
  step(18, "CKS-12-P2-SS-18", "REVERSE_EXPERIENCE_PATTERN_VALIDATED", "#289", "Fingerprint retrieval emits a counterevidence-preserving Pattern candidate separately validated"),
  step(19, "CKS-12-P2-SS-19", "KALEIDOSPHERE_READ_ONLY_CANDIDATE", "#290", "Minimized read-only projection returns authority-free CANDIDATE with zero invented edges"),
  step(20, "CKS-12-P2-SS-20", "SHADOW_WORKFLOW_PARITY_MEASURED", "#291", "Version-bound shadow Workflow reaches the parity gate on applicable holdouts"),
  step(21, "CKS-12-P2-SS-21", "DETERMINISTIC_FUNCTION_COST_PARITY_MEASURED", "#291", "Closed shadow Function has byte-deterministic output, proof parity, and lower reasoning and retrieval cost"),
  step(22, "CKS-12-P2-SS-22", "KNOWLEDGE_DRIFT_REVALIDATED", "#292", "Supersession causes REVALIDATION_REQUIRED and new validation before reuse"),
  step(23, "CKS-12-P2-SS-23", "UNKNOWN_VARIANT_FAST_PATH_ABORTED", "#292", "Unknown variant ends FAST_PATH_DENIED with ABORTED_UNKNOWN_VARIANT and zero effects"),
];
const freezeStep = (entry: StoryStepFixtureEntry): Readonly<StoryStepFixtureEntry> => Object.freeze({ ...entry });
export const STORY_STEP_MANIFEST: readonly Readonly<StoryStepFixtureEntry>[] = Object.freeze(rawStorySteps.map(freezeStep));
export const STORY_STEP_MANIFEST_SHA256 = digestCanonical(STORY_STEP_MANIFEST);

export const COMPONENT_VERSION_LOCK_SCHEMA_VERSION = "chimpmaera.cks/component-version-lock/v1";
export const EXACT_COMPONENT_VERSION_LOCK_FIELDS = Object.freeze([
  "boundaryContractVersion", "panSphairaCommit", "panSphairaRelease", "canonicalJsonVersion", "hashAlgorithm",
  "nodeVersion", "npmVersion", "harnessId", "harnessVersion", "harnessSha256",
  "competenceModelId", "competenceModelVersion", "competenceModelSha256", "tokenizerId", "tokenizerVersion", "tokenizerSha256",
  "inferenceRuntimeId", "inferenceRuntimeVersion", "inferenceRuntimeSha256", "knowledgeContractVersion", "knowledgeEditionId", "knowledgeEditionVersion", "knowledgeEditionSha256",
  "retrievalProfileId", "retrievalProfileVersion", "retrievalProfileSha256", "verifierId", "verifierVersion", "verifierSha256",
  "fixturePackId", "fixturePackVersion", "fixtureManifestSha256", "receiptSchemaVersion", "projectionSchemaVersion", "candidateSchemaVersion",
  "kaleidoSphereProductVersion", "kaleidoSphereContractVersion", "kaleidoSphereArtifactSha256", "workflowContractVersion", "functionContractVersion",
  "costModelVersion", "costModelSha256", "syntheticClockVersion", "syntheticClockSha256",
] as const);

export type ComponentVersionLock = Record<typeof EXACT_COMPONENT_VERSION_LOCK_FIELDS[number], string>;
export const COMPONENT_VERSION_LOCK: Readonly<ComponentVersionLock> = Object.freeze({
  boundaryContractVersion: "v1", panSphairaCommit: BASE_COMMIT, panSphairaRelease: "v0.2.0-poc.20260825.1",
  canonicalJsonVersion: "repository-canonical-json-v1", hashAlgorithm: HASH_ALGORITHM,
  nodeVersion: "24.14.1", npmVersion: "11.16.0", harnessId: "cks-12-story-step-version-checker", harnessVersion: "v2",
  harnessSha256: "f83287da1557a2c5dc526dddb6b429488c5508e946a600c365c1f10fa7f11e8c",
  competenceModelId: "cks-12-synthetic-competence-model", competenceModelVersion: "v2", competenceModelSha256: "557d6b0f4471ec438a81781e38df57ef033869396252a6992d7580b5f810da3d",
  tokenizerId: "cks-12-synthetic-tokenizer", tokenizerVersion: "v2", tokenizerSha256: "4ea52babc6dcb3d90b530dae4a221f9f8e1200d17282e3ee650a15d8fdda01da",
  inferenceRuntimeId: "cks-12-no-execution-runtime", inferenceRuntimeVersion: "v2", inferenceRuntimeSha256: "f889a5fbd6f949a2137832d2e24a5469d56146ca4c05096994d6ed48e9caf315",
  knowledgeContractVersion: "v1", knowledgeEditionId: "CKS-12-MINIMAL-KNOWLEDGE-EDITION", knowledgeEditionVersion: "v2", knowledgeEditionSha256: "73ee641a54a55c7de7e506cf0923e070ce4298370ea0a225d940f263f0726071",
  retrievalProfileId: "CKS-12-OFFLINE-RETRIEVAL-PROFILE", retrievalProfileVersion: "v2", retrievalProfileSha256: "f42d8143a8e202283beaab35f892dc58c5c3b6aec0633818a50b689b089e58c4",
  verifierId: "cks-12-story-step-version-checker", verifierVersion: "v2", verifierSha256: "f83287da1557a2c5dc526dddb6b429488c5508e946a600c365c1f10fa7f11e8c",
  fixturePackId: "CKS-12-PART-II-STORY-STEPS-FIXTURE-PACK", fixturePackVersion: "v2", fixtureManifestSha256: STORY_STEP_MANIFEST_SHA256,
  receiptSchemaVersion: STORY_STEP_RECEIPT_SCHEMA_VERSION, projectionSchemaVersion: "chimpmaera.cks/kaleidosphere-projection/v1", candidateSchemaVersion: "chimpmaera.cks/kaleidosphere-candidate/v1",
  kaleidoSphereProductVersion: "v0.8.0", kaleidoSphereContractVersion: "2.0.0", kaleidoSphereArtifactSha256: "841ff5a3b0900f1cd1592180e6ca8be90190fda95578feb347704596cca70d5c",
  workflowContractVersion: "v1", functionContractVersion: "v1", costModelVersion: "v2", costModelSha256: "922aafcdc087a3cae443198db01cbbed191200ba1d18247d01adb2ae951f5d2c",
  syntheticClockVersion: "v2", syntheticClockSha256: "15be1f7adcacf21777d55c1ed400c3f593fde6d3c8acadf116f8064361a87358",
});
export const COMPONENT_VERSION_LOCK_SHA256 = "5f1d5a35e347be67d4d2b38e68c0f632e1f214757ede9333a79dc35f715bbd57";

export const NON_CLAIMS = Object.freeze([
  "CKS_07_THROUGH_CKS_11_DEPENDENCY_PROOFS_PASSED", "CKS_12_SYNTHETIC_LOOP_PASSED", "MODEL_OR_RUNTIME_EXECUTED",
  "KALEIDOSPHERE_CKS_ADAPTER_EXISTS_OR_RAN", "WORKFLOW_OR_FUNCTION_ACTIVATED", "GENERALIZATION_BEYOND_FROZEN_SYNTHETIC_FIXTURES",
  "PRODUCTION_READINESS", "SECURITY_CERTIFICATION", "AVAILABILITY_OR_PERFORMANCE", "MERGED_OR_RELEASED",
] as const);

export interface StoryStepEvidenceBinding {
  stepId: string;
  stepOrdinal: number;
  fixtureId: string;
  fixtureVersion: string;
  fixtureSha256: string;
  receiptId: string;
  receiptVersion: string;
  receiptSha256: string;
  componentVersionLockSha256: string;
}

const stepFixtureSubject = (entry: Readonly<StoryStepFixtureEntry>) => ({
  fixtureId: `${entry.id}-FIXTURE-V2`, fixtureVersion: STORY_STEP_FIXTURE_VERSION, step: entry,
});
const stepReceiptSubject = (binding: Omit<StoryStepEvidenceBinding, "receiptSha256">) => ({
  schemaVersion: STORY_STEP_RECEIPT_SCHEMA_VERSION, receiptId: binding.receiptId, receiptVersion: binding.receiptVersion,
  runId: STORY_STEP_VERSION_RUN_ID, stepId: binding.stepId, stepOrdinal: binding.stepOrdinal,
  fixtureId: binding.fixtureId, fixtureVersion: binding.fixtureVersion, fixtureSha256: binding.fixtureSha256,
  componentVersionLockSha256: binding.componentVersionLockSha256, status: "RECORDED", reasonCode: "STEP_VERSION_BOUND",
  authority: "NONE", capabilityDelta: "NONE", effect: "NONE", executionClaimed: false, productionClaimed: false,
});

export function createStoryStepEvidenceBindings(): readonly Readonly<StoryStepEvidenceBinding>[] {
  return Object.freeze(STORY_STEP_MANIFEST.map((entry) => {
    const fixtureId = `${entry.id}-FIXTURE-V2`;
    const base: Omit<StoryStepEvidenceBinding, "receiptSha256"> = {
      stepId: entry.id, stepOrdinal: entry.ordinal, fixtureId, fixtureVersion: STORY_STEP_FIXTURE_VERSION,
      fixtureSha256: digestCanonical(stepFixtureSubject(entry)), receiptId: `${entry.id}-RECEIPT-V2`, receiptVersion: "v2",
      componentVersionLockSha256: COMPONENT_VERSION_LOCK_SHA256,
    };
    return Object.freeze({ ...base, receiptSha256: digestCanonical(stepReceiptSubject(base)) });
  }));
}
export const STORY_STEP_EVIDENCE_BINDINGS = createStoryStepEvidenceBindings();
export const STORY_STEP_BINDINGS_SHA256 = digestCanonical(STORY_STEP_EVIDENCE_BINDINGS);

export interface StoryStepVersionReceiptV2 {
  schemaVersion: string; receiptId: string; runId: string; boundaryContractVersion: string; boundaryReceiptId: string; boundaryReceiptSha256: string;
  repository: string; baseCommit: string; fixtureId: string; fixtureVersion: string; fixtureSha256: string; catalogKind: string; storyStepCount: number;
  orderedStoryStepIds: string[]; storyStepVocabularySha256: string; storyStepManifestSha256: string; stepBindingsSha256: string;
  stepBindings: StoryStepEvidenceBinding[]; componentVersionLockSchemaVersion: string; componentVersionLock: ComponentVersionLock;
  componentVersionLockSha256: string; hashAlgorithm: string; digestEncoding: string; exactComponentVersionLockFields: string[];
  previousReceiptSha256: string; status: "RECORDED"; reasonCode: string; authority: "NONE"; capabilityDelta: "NONE"; effect: "NONE";
  integratedProofState: "EVIDENCE_INCOMPLETE"; executionClaimed: false; productionClaimed: false; successClaimed: false; nonClaims: string[]; receiptSha256: string;
}

export function createStoryStepVersionReceipt(fixtureSha256: string): StoryStepVersionReceiptV2 {
  if (!/^[0-9a-f]{64}$/.test(fixtureSha256)) throw new TypeError("fixtureSha256 must be 64 lowercase hexadecimal characters");
  const body: Omit<StoryStepVersionReceiptV2, "receiptSha256"> = {
    schemaVersion: STORY_STEP_VERSION_RECEIPT_SCHEMA_VERSION, receiptId: STORY_STEP_VERSION_RECEIPT_ID, runId: STORY_STEP_VERSION_RUN_ID,
    boundaryContractVersion: BOUNDARY_CONTRACT_VERSION, boundaryReceiptId: BOUNDARY_RECEIPT_ID, boundaryReceiptSha256: BOUNDARY_RECEIPT_SHA256,
    repository: REPOSITORY, baseCommit: BASE_COMMIT, fixtureId: STORY_STEP_FIXTURE_ID, fixtureVersion: STORY_STEP_FIXTURE_VERSION,
    fixtureSha256, catalogKind: STORY_STEP_CATALOG_KIND, storyStepCount: STORY_STEP_COUNT, orderedStoryStepIds: [...ORDERED_STORY_STEP_IDS],
    storyStepVocabularySha256: STORY_STEP_VOCABULARY_SHA256, storyStepManifestSha256: STORY_STEP_MANIFEST_SHA256, stepBindingsSha256: STORY_STEP_BINDINGS_SHA256,
    stepBindings: STORY_STEP_EVIDENCE_BINDINGS.map((binding) => ({ ...binding })), componentVersionLockSchemaVersion: COMPONENT_VERSION_LOCK_SCHEMA_VERSION,
    componentVersionLock: { ...COMPONENT_VERSION_LOCK }, componentVersionLockSha256: COMPONENT_VERSION_LOCK_SHA256,
    hashAlgorithm: HASH_ALGORITHM, digestEncoding: DIGEST_ENCODING, exactComponentVersionLockFields: [...EXACT_COMPONENT_VERSION_LOCK_FIELDS],
    previousReceiptSha256: GENESIS_PREVIOUS_RECEIPT_SHA256, status: "RECORDED", reasonCode: "STORY_STEP_VERSION_BINDING_RECORDED",
    authority: "NONE", capabilityDelta: "NONE", effect: "NONE", integratedProofState: "EVIDENCE_INCOMPLETE", executionClaimed: false,
    productionClaimed: false, successClaimed: false, nonClaims: [...NON_CLAIMS],
  };
  return Object.freeze({ ...body, receiptSha256: digestCanonical(body) });
}

export const storyStepFixtureDigest = sha256Hex;
