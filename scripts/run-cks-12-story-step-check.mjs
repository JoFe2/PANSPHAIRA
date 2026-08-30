#!/usr/bin/env node
/**
 * Independent CKS-12 story-step v2 checker.
 *
 * This file deliberately does not import the TypeScript manifest. It checks the
 * checked-in bytes, bindings, and receipt against the frozen contract so that
 * the positive path has an independent verifier and all denials are fail-closed.
 */
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const FIXTURE_PATH = "tests/fixtures/cks-12/part-ii-23-step-fixture-v1.json";
const RECEIPT_PATH = "verification/cks-12/story-step-version-receipt-v1.json";
const DIGEST = /^[0-9a-f]{64}$/;
const IDS = Array.from({ length: 23 }, (_, i) => `CKS-12-P2-SS-${String(i + 1).padStart(2, "0")}`);
const MANIFEST_SHA256 = "15dd2521cbf9773db85c1188ff80c40423998d0a043919538c68f3161b36eaa0";
const VOCABULARY_SHA256 = "d178bb61b1e773e8ecc2641a439392a5b882d4b40d494feb66042a770906b869";
const BOUNDARY_ID = "CKS-12-CLOSED-LOOP-BOUNDARY-V1";
const BOUNDARY_SHA256 = "d643f720a996c9ac2d167296c1edfd228760a3ca19196c09f9c0dfd6615d1328";
const BASE_COMMIT = "353017c4f60e30463d0a78fd6fd2509a37d37f76";
const REPOSITORY = "JoFe2/PANSPHAIRA";
const FIXTURE_ID = "CKS-12-PART-II-STORY-STEPS-FIXTURE-V2";
const FIXTURE_VERSION = "v2";
const RECEIPT_ID = "CKS-12-STORY-STEP-VERSION-RECEIPT-V2";
const RUN_ID = "CKS-12-STORY-STEP-VERSION-RUN-V2";
const GENESIS = "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855";
const COMPONENT_FIELDS = [
  "boundaryContractVersion", "panSphairaCommit", "panSphairaRelease", "canonicalJsonVersion", "hashAlgorithm",
  "nodeVersion", "npmVersion", "harnessId", "harnessVersion", "harnessSha256",
  "competenceModelId", "competenceModelVersion", "competenceModelSha256", "tokenizerId", "tokenizerVersion", "tokenizerSha256",
  "inferenceRuntimeId", "inferenceRuntimeVersion", "inferenceRuntimeSha256", "knowledgeContractVersion", "knowledgeEditionId", "knowledgeEditionVersion", "knowledgeEditionSha256",
  "retrievalProfileId", "retrievalProfileVersion", "retrievalProfileSha256", "verifierId", "verifierVersion", "verifierSha256",
  "fixturePackId", "fixturePackVersion", "fixtureManifestSha256", "receiptSchemaVersion", "projectionSchemaVersion", "candidateSchemaVersion",
  "kaleidoSphereProductVersion", "kaleidoSphereContractVersion", "kaleidoSphereArtifactSha256", "workflowContractVersion", "functionContractVersion",
  "costModelVersion", "costModelSha256", "syntheticClockVersion", "syntheticClockSha256",
];
const DENIALS = ["FIXTURE_INTEGRITY_FAILED", "MISSING_INPUT", "PRODUCTION_ACTION_DENIED", "PROOF_OBLIGATION_MISMATCH", "RECEIPT_INTEGRITY_FAILED", "UNKNOWN_VARIANT", "VERSION_LOCK_MISMATCH"];

export function canonicalJson(value) {
  if (value === null || typeof value === "boolean" || typeof value === "string") return JSON.stringify(value);
  if (typeof value === "number") {
    if (!Number.isFinite(value)) throw new TypeError("non-finite number");
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  if (typeof value !== "object" || Object.getPrototypeOf(value) !== Object.prototype) throw new TypeError("plain JSON object required");
  return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonicalJson(value[key])}`).join(",")}}`;
}
const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");
const digest = (value) => sha256(Buffer.from(canonicalJson(value), "utf8"));
const isObject = (value) => value !== null && typeof value === "object" && !Array.isArray(value) && Object.getPrototypeOf(value) === Object.prototype;
const exactKeys = (value, fields, label, deny) => {
  if (!isObject(value)) { deny("MISSING_INPUT", `${label} must be a plain JSON object`); return; }
  const expected = new Set(fields);
  for (const field of fields) if (!Object.hasOwn(value, field)) deny("MISSING_INPUT", `${label}.${field} is missing`);
  for (const field of Object.keys(value)) if (!expected.has(field)) deny("FIXTURE_INTEGRITY_FAILED", `${label}.${field} is not in the closed field set`);
};
const equal = (actual, expected, label, code, deny) => { if (actual !== expected) deny(code, `${label}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`); };
const stepFixtureSubject = (step) => ({ fixtureId: `${step.id}-FIXTURE-V2`, fixtureVersion: FIXTURE_VERSION, step });
const stepReceiptSubject = (binding) => ({
  schemaVersion: "chimpmaera.cks/closed-loop-step-receipt/v1", receiptId: binding.receiptId, receiptVersion: binding.receiptVersion,
  runId: RUN_ID, stepId: binding.stepId, stepOrdinal: binding.stepOrdinal, fixtureId: binding.fixtureId, fixtureVersion: binding.fixtureVersion,
  fixtureSha256: binding.fixtureSha256, componentVersionLockSha256: binding.componentVersionLockSha256,
  status: "RECORDED", reasonCode: "STEP_VERSION_BOUND", authority: "NONE", capabilityDelta: "NONE", effect: "NONE",
  executionClaimed: false, productionClaimed: false,
});

const expectedLock = (harnessSha256) => ({
  boundaryContractVersion: "v1", panSphairaCommit: BASE_COMMIT, panSphairaRelease: "v0.2.0-poc.20260825.1",
  canonicalJsonVersion: "repository-canonical-json-v1", hashAlgorithm: "SHA-256", nodeVersion: "24.14.1", npmVersion: "11.16.0",
  harnessId: "cks-12-story-step-version-checker", harnessVersion: "v2", harnessSha256,
  competenceModelId: "cks-12-synthetic-competence-model", competenceModelVersion: "v2", competenceModelSha256: "557d6b0f4471ec438a81781e38df57ef033869396252a6992d7580b5f810da3d",
  tokenizerId: "cks-12-synthetic-tokenizer", tokenizerVersion: "v2", tokenizerSha256: "4ea52babc6dcb3d90b530dae4a221f9f8e1200d17282e3ee650a15d8fdda01da",
  inferenceRuntimeId: "cks-12-no-execution-runtime", inferenceRuntimeVersion: "v2", inferenceRuntimeSha256: "f889a5fbd6f949a2137832d2e24a5469d56146ca4c05096994d6ed48e9caf315",
  knowledgeContractVersion: "v1", knowledgeEditionId: "CKS-12-MINIMAL-KNOWLEDGE-EDITION", knowledgeEditionVersion: "v2", knowledgeEditionSha256: "73ee641a54a55c7de7e506cf0923e070ce4298370ea0a225d940f263f0726071",
  retrievalProfileId: "CKS-12-OFFLINE-RETRIEVAL-PROFILE", retrievalProfileVersion: "v2", retrievalProfileSha256: "f42d8143a8e202283beaab35f892dc58c5c3b6aec0633818a50b689b089e58c4",
  verifierId: "cks-12-story-step-version-checker", verifierVersion: "v2", verifierSha256: harnessSha256,
  fixturePackId: "CKS-12-PART-II-STORY-STEPS-FIXTURE-PACK", fixturePackVersion: "v2", fixtureManifestSha256: MANIFEST_SHA256,
  receiptSchemaVersion: "chimpmaera.cks/closed-loop-step-receipt/v1", projectionSchemaVersion: "chimpmaera.cks/kaleidosphere-projection/v1", candidateSchemaVersion: "chimpmaera.cks/kaleidosphere-candidate/v1",
  kaleidoSphereProductVersion: "v0.8.0", kaleidoSphereContractVersion: "2.0.0", kaleidoSphereArtifactSha256: "841ff5a3b0900f1cd1592180e6ca8be90190fda95578feb347704596cca70d5c",
  workflowContractVersion: "v1", functionContractVersion: "v1", costModelVersion: "v2", costModelSha256: "922aafcdc087a3cae443198db01cbbed191200ba1d18247d01adb2ae951f5d2c",
  syntheticClockVersion: "v2", syntheticClockSha256: "15be1f7adcacf21777d55c1ed400c3f593fde6d3c8acadf116f8064361a87358",
});

export function checkStoryStepVersionContract(fixture, receipt, options = {}) {
  const reasons = new Set();
  const details = [];
  const deny = (code, detail) => { if (!DENIALS.includes(code)) throw new Error(`unknown denial ${code}`); reasons.add(code); details.push(detail); };
  if (!isObject(fixture) || !isObject(receipt)) { deny("MISSING_INPUT", "fixture and receipt are required objects"); return { status: "DENIED", reasonCodes: [...reasons].sort(), details }; }
  const harnessSha256 = "f83287da1557a2c5dc526dddb6b429488c5508e946a600c365c1f10fa7f11e8c";
  const lock = expectedLock(harnessSha256);
  exactKeys(fixture, ["baseCommit", "boundaryReceiptId", "boundaryReceiptSha256", "catalogKind", "componentVersionLock", "componentVersionLockSchemaVersion", "digestEncoding", "exactComponentVersionLockFields", "fixtureId", "fixtureVersion", "hashAlgorithm", "mutationRule", "receiptDigestRule", "repository", "schemaVersion", "storyStepCount", "storyStepManifestSha256", "storyStepVocabularySha256", "storySteps", "stepBindings", "stepBindingsSha256", "componentVersionLockSha256"], "fixture", deny);
  exactKeys(receipt, ["authority", "baseCommit", "boundaryContractVersion", "boundaryReceiptId", "boundaryReceiptSha256", "capabilityDelta", "catalogKind", "componentVersionLock", "componentVersionLockSchemaVersion", "componentVersionLockSha256", "digestEncoding", "effect", "exactComponentVersionLockFields", "executionClaimed", "fixtureId", "fixtureSha256", "fixtureVersion", "hashAlgorithm", "integratedProofState", "nonClaims", "orderedStoryStepIds", "previousReceiptSha256", "productionClaimed", "reasonCode", "receiptId", "receiptSha256", "repository", "runId", "schemaVersion", "status", "stepBindings", "stepBindingsSha256", "storyStepCount", "storyStepManifestSha256", "storyStepVocabularySha256", "successClaimed"], "receipt", deny);
  const fixtureBytes = options.fixtureBytes;
  if (fixtureBytes) equal(canonicalJson(fixture), Buffer.from(fixtureBytes).toString("utf8"), "fixture bytes", "FIXTURE_INTEGRITY_FAILED", deny);
  equal(fixture.schemaVersion, "chimpmaera.cks/story-step-fixture/v2", "fixture.schemaVersion", "FIXTURE_INTEGRITY_FAILED", deny);
  equal(fixture.fixtureId, FIXTURE_ID, "fixture.fixtureId", "FIXTURE_INTEGRITY_FAILED", deny);
  equal(fixture.fixtureVersion, FIXTURE_VERSION, "fixture.fixtureVersion", "FIXTURE_INTEGRITY_FAILED", deny);
  equal(fixture.storyStepCount, 23, "fixture.storyStepCount", "PROOF_OBLIGATION_MISMATCH", deny);
  equal(fixture.storyStepVocabularySha256, VOCABULARY_SHA256, "fixture vocabulary", "PROOF_OBLIGATION_MISMATCH", deny);
  equal(fixture.storyStepManifestSha256, MANIFEST_SHA256, "fixture manifest", "PROOF_OBLIGATION_MISMATCH", deny);
  equal(fixture.baseCommit, BASE_COMMIT, "fixture baseCommit", "VERSION_LOCK_MISMATCH", deny);
  equal(fixture.boundaryReceiptId, BOUNDARY_ID, "fixture boundaryReceiptId", "FIXTURE_INTEGRITY_FAILED", deny);
  equal(fixture.boundaryReceiptSha256, BOUNDARY_SHA256, "fixture boundaryReceiptSha256", "FIXTURE_INTEGRITY_FAILED", deny);
  equal(fixture.repository, REPOSITORY, "fixture repository", "VERSION_LOCK_MISMATCH", deny);
  if (!Array.isArray(fixture.storySteps) || fixture.storySteps.length !== 23) deny("PROOF_OBLIGATION_MISMATCH", "storySteps must contain exactly 23 entries");
  if (Array.isArray(fixture.storySteps)) {
    const seen = new Set();
    for (let i = 0; i < fixture.storySteps.length; i++) {
      const step = fixture.storySteps[i];
      if (!isObject(step)) { deny("MISSING_INPUT", `storySteps[${i}] must be an object`); continue; }
      if (step.id !== IDS[i] || step.ordinal !== i + 1 || seen.has(step.id)) deny("PROOF_OBLIGATION_MISMATCH", `story step ${i + 1} is missing, reordered, or duplicated`);
      seen.add(step.id);
    }
    equal(digest(fixture.storySteps), MANIFEST_SHA256, "storySteps digest", "PROOF_OBLIGATION_MISMATCH", deny);
  }
  exactKeys(fixture.componentVersionLock, COMPONENT_FIELDS, "fixture.componentVersionLock", deny);
  exactKeys(receipt.componentVersionLock, COMPONENT_FIELDS, "receipt.componentVersionLock", deny);
  const expectedFields = [...COMPONENT_FIELDS];
  if (JSON.stringify(fixture.exactComponentVersionLockFields) !== JSON.stringify(expectedFields) || JSON.stringify(receipt.exactComponentVersionLockFields) !== JSON.stringify(expectedFields)) deny("VERSION_LOCK_MISMATCH", "component lock field list is not the exact frozen list");
  const actualLock = fixture.componentVersionLock;
  for (const field of COMPONENT_FIELDS) {
    if (typeof actualLock?.[field] !== "string" || actualLock[field].length === 0) deny("MISSING_INPUT", `component lock ${field} is missing or empty`);
    if (actualLock?.[field] !== lock[field]) deny("VERSION_LOCK_MISMATCH", `unsupported or stale component lock value for ${field}`);
    if (receipt.componentVersionLock?.[field] !== actualLock?.[field]) deny("VERSION_LOCK_MISMATCH", `receipt component lock differs for ${field}`);
  }
  for (const field of ["harnessSha256", "competenceModelSha256", "tokenizerSha256", "inferenceRuntimeSha256", "knowledgeEditionSha256", "retrievalProfileSha256", "verifierSha256", "fixtureManifestSha256", "kaleidoSphereArtifactSha256", "costModelSha256", "syntheticClockSha256"]) if (!DIGEST.test(actualLock?.[field] ?? "")) deny("VERSION_LOCK_MISMATCH", `${field} is not a concrete SHA-256 digest`);
  const lockDigest = digest(actualLock);
  equal(fixture.componentVersionLockSha256, lockDigest, "fixture componentVersionLockSha256", "VERSION_LOCK_MISMATCH", deny);
  equal(receipt.componentVersionLockSha256, lockDigest, "receipt componentVersionLockSha256", "VERSION_LOCK_MISMATCH", deny);
  if (!Array.isArray(fixture.stepBindings) || fixture.stepBindings.length !== 23) deny("PROOF_OBLIGATION_MISMATCH", "stepBindings must contain exactly 23 entries");
  const expectedBindings = [];
  if (Array.isArray(fixture.storySteps) && Array.isArray(fixture.stepBindings)) {
    for (let i = 0; i < fixture.storySteps.length; i++) {
      const step = fixture.storySteps[i];
      const binding = fixture.stepBindings[i];
      if (!isObject(binding)) { deny("MISSING_INPUT", `stepBindings[${i}] must be an object`); continue; }
      exactKeys(binding, ["componentVersionLockSha256", "fixtureId", "fixtureSha256", "fixtureVersion", "receiptId", "receiptSha256", "receiptVersion", "stepId", "stepOrdinal"], `stepBindings[${i}]`, deny);
      const expected = { stepId: step.id, stepOrdinal: step.ordinal, fixtureId: `${step.id}-FIXTURE-V2`, fixtureVersion: FIXTURE_VERSION, fixtureSha256: digest(stepFixtureSubject(step)), receiptId: `${step.id}-RECEIPT-V2`, receiptVersion: "v2", componentVersionLockSha256: lockDigest };
      expected.receiptSha256 = digest(stepReceiptSubject(expected));
      expectedBindings.push(expected);
      if (canonicalJson(binding) !== canonicalJson(expected)) deny("RECEIPT_INTEGRITY_FAILED", `stepBindings[${i}] fixture or receipt digest does not match its immutable subject`);
    }
  }
  if (Array.isArray(fixture.stepBindings)) equal(digest(fixture.stepBindings), fixture.stepBindingsSha256 ?? digest(expectedBindings), "fixture stepBindings digest", "RECEIPT_INTEGRITY_FAILED", deny);
  for (const [label, value] of [["receipt.schemaVersion", receipt.schemaVersion], ["receipt.receiptId", receipt.receiptId], ["receipt.runId", receipt.runId], ["receipt.fixtureId", receipt.fixtureId], ["receipt.fixtureVersion", receipt.fixtureVersion], ["receipt.catalogKind", receipt.catalogKind], ["receipt.repository", receipt.repository], ["receipt.baseCommit", receipt.baseCommit], ["receipt.boundaryReceiptId", receipt.boundaryReceiptId], ["receipt.boundaryReceiptSha256", receipt.boundaryReceiptSha256], ["receipt.storyStepManifestSha256", receipt.storyStepManifestSha256], ["receipt.storyStepVocabularySha256", receipt.storyStepVocabularySha256]]) {
    const wanted = { "receipt.schemaVersion": "chimpmaera.cks/story-step-version-receipt/v2", "receipt.receiptId": RECEIPT_ID, "receipt.runId": RUN_ID, "receipt.fixtureId": FIXTURE_ID, "receipt.fixtureVersion": FIXTURE_VERSION, "receipt.catalogKind": "ORDERED_PART_II_SYNTHETIC_STORY_STEPS", "receipt.repository": REPOSITORY, "receipt.baseCommit": BASE_COMMIT, "receipt.boundaryReceiptId": BOUNDARY_ID, "receipt.boundaryReceiptSha256": BOUNDARY_SHA256, "receipt.storyStepManifestSha256": MANIFEST_SHA256, "receipt.storyStepVocabularySha256": VOCABULARY_SHA256 }[label];
    equal(value, wanted, label, "RECEIPT_INTEGRITY_FAILED", deny);
  }
  equal(receipt.storyStepCount, 23, "receipt.storyStepCount", "PROOF_OBLIGATION_MISMATCH", deny);
  equal(receipt.previousReceiptSha256, GENESIS, "receipt.previousReceiptSha256", "RECEIPT_INTEGRITY_FAILED", deny);
  equal(receipt.status, "RECORDED", "receipt.status", "RECEIPT_INTEGRITY_FAILED", deny);
  equal(receipt.integratedProofState, "EVIDENCE_INCOMPLETE", "receipt.integratedProofState", "PROOF_OBLIGATION_MISMATCH", deny);
  equal(receipt.successClaimed, false, "receipt.successClaimed", "PRODUCTION_ACTION_DENIED", deny);
  equal(receipt.executionClaimed, false, "receipt.executionClaimed", "PRODUCTION_ACTION_DENIED", deny);
  equal(receipt.productionClaimed, false, "receipt.productionClaimed", "PRODUCTION_ACTION_DENIED", deny);
  for (const field of ["authority", "capabilityDelta", "effect"]) equal(receipt[field], "NONE", `receipt.${field}`, "PRODUCTION_ACTION_DENIED", deny);
  equal(JSON.stringify(receipt.orderedStoryStepIds), JSON.stringify(IDS), "receipt orderedStoryStepIds", "PROOF_OBLIGATION_MISMATCH", deny);
  equal(canonicalJson(receipt.stepBindings), canonicalJson(fixture.stepBindings), "receipt stepBindings", "RECEIPT_INTEGRITY_FAILED", deny);
  equal(receipt.stepBindingsSha256, digest(fixture.stepBindings), "receipt stepBindingsSha256", "RECEIPT_INTEGRITY_FAILED", deny);
  if (!Array.isArray(receipt.nonClaims) || !receipt.nonClaims.includes("MODEL_OR_RUNTIME_EXECUTED") || !receipt.nonClaims.includes("PRODUCTION_READINESS")) deny("PRODUCTION_ACTION_DENIED", "required execution and production non-claims are absent");

  if (!DIGEST.test(receipt.fixtureSha256 ?? "")) deny("MISSING_INPUT", "receipt.fixtureSha256 must be a concrete digest");
  if (options.fixtureBytes) equal(receipt.fixtureSha256, sha256(options.fixtureBytes), "receipt.fixtureSha256", "FIXTURE_INTEGRITY_FAILED", deny);
  const { receiptSha256, ...receiptBody } = receipt;
  equal(receiptSha256, digest(receiptBody), "receipt.receiptSha256", "RECEIPT_INTEGRITY_FAILED", deny);
  if (reasons.size) return { status: "DENIED", reasonCodes: [...reasons].sort(), details };
  return { status: "RECORDED", receipt, executionClaimed: false, productionClaimed: false };
}

function main() {
  const dryRun = process.argv.includes("--dry-run");
  if (!dryRun || process.argv.length !== 3) {
    console.error("usage: node scripts/run-cks-12-story-step-check.mjs --dry-run");
    process.exitCode = 2;
    return;
  }
  const fixtureBytes = readFileSync(`${ROOT}/${FIXTURE_PATH}`);
  const receiptBytes = readFileSync(`${ROOT}/${RECEIPT_PATH}`);
  let fixture;
  let receipt;
  try { fixture = JSON.parse(fixtureBytes.toString("utf8")); receipt = JSON.parse(receiptBytes.toString("utf8")); }
  catch (error) { console.error(JSON.stringify({ status: "DENIED", reasonCodes: ["FIXTURE_INTEGRITY_FAILED"], details: [String(error)] })); process.exitCode = 1; return; }
  const result = checkStoryStepVersionContract(fixture, receipt, { fixtureBytes, receiptBytes });
  console.log(canonicalJson(result));
  if (result.status !== "RECORDED") process.exitCode = 1;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) main();
