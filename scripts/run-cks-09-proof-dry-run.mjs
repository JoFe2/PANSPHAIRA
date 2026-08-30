#!/usr/bin/env node
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { resolve, dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { cks09Digest, REPLAY_MODES } from "../dist/packages/contracts/src/cks-task-fingerprint.js";
import { score } from "./cks-09-score-synthetic-proof.mjs";

/**
 * CKS-09 offline proof dry-run readback. Verifies an admitted, sealed, digest-pinned evidence
 * envelope, re-runs the frozen synthetic proof pipeline, and renders a privacy-safe,
 * evidence-bound receipt. Deterministic: identical inputs render byte-identical receipts.
 */

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const ENVELOPE_SCHEMA_VERSION = "pansphaira.cks/e2e-proof-evidence/v1";
const ENVELOPE_FIXTURE_KIND = "E2E_PROOF_EVIDENCE";
const RECEIPT_SCHEMA_VERSION = "pansphaira.cks/offline-proof-receipt/v1";
const RECEIPT_PATH = join(ROOT, "verification/cks-09-offline-proof-receipt-v1.json");
const TASK_ID = "PSAI289-QWEN-06-OFFLINE-PROOF-READBACK";
const MODE = "SIMULATION_OR_SHADOW_ONLY";
const SCOPE = "ADMITTED_SYNTHETIC_SEALED_HOLDOUT_ONLY";
const SHADOW_FLAGS = ["externalStateChanged", "modelsOrServicesCalled", "procedureContentReturned"];
const HOLDOUT_FIXTURE_ID = "cks-09-holdout";
const REQUIRED_EVIDENCE = new Map([
  ["evidence:holdout-cases", { fixtureId: "cks-09-holdout", fixturePath: "tests/fixtures/cks-09/holdout-cases-v1.json" }],
  ["evidence:pattern-traps", { fixtureId: "cks-09-pattern-traps", fixturePath: "tests/fixtures/cks-09/pattern-trap-cases-v1.json" }],
  ["evidence:ground-truth", { fixtureId: "cks-09-holdout-ground-truth", fixturePath: "tests/fixtures/cks-09/holdout-ground-truth-v1.json" }],
]);
const REQUIRED_CRITERIA = new Set([
  "P17_EXPERIENCE_IMPROVES_QUALITY_COST",
  "P18_PLANTED_STABLE_IDENTIFIED_TRAPS_DENIED",
  "INAPPLICABLE_VERSION_DRIFT_REUSE_DENIED",
  "SHADOW_ONLY_SIMULATION_BOUNDARY",
  "CANDIDATE_PRESERVATION",
]);

function isRecord(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value) && Object.getPrototypeOf(value) === Object.prototype;
}

function sha256OfFile(absolutePath) {
  return `sha256:${createHash("sha256").update(readFileSync(absolutePath)).digest("hex")}`;
}

function failClosed(verdict, reason, envelope, envelopePath) {
  const body = {
    schemaVersion: RECEIPT_SCHEMA_VERSION,
    taskId: TASK_ID,
    mode: MODE,
    scope: SCOPE,
    verdict,
    reasons: [reason],
    externalStateChanged: false,
    modelsOrServicesCalled: false,
    procedureContentReturned: false,
    admission: null,
    envelope: {
      fixtureId: isRecord(envelope) && typeof envelope.fixtureId === "string" ? envelope.fixtureId : null,
      fixturePath: envelopePath !== undefined ? relative(ROOT, envelopePath).split("\\").join("/") : null,
      sha256: isRecord(envelope) ? null : null,
    },
    evidence: [],
    criteria: [],
    proof: null,
    nonClaims: ["No success is claimed without the required admitted, sealed, digest-verified evidence."],
  };
  return { ...body, canonicalDigest: cks09Digest(body) };
}

/** Fail-closed envelope verification; the first broken boundary wins, in a fixed order. */
export function verifyEnvelope(envelope, envelopePath) {
  const reject = (reason, verdict = "INCONCLUSIVE") => ({ ok: false, verdict, reason });
  if (!isRecord(envelope)) return reject("PROSE_ONLY_INPUT");
  if (envelope.schemaVersion !== ENVELOPE_SCHEMA_VERSION || envelope.fixtureKind !== ENVELOPE_FIXTURE_KIND) {
    return reject("PROSE_ONLY_INPUT");
  }
  if (envelope.evidenceAdmission !== "ADMITTED" || envelope.requiredEvidencePresent !== true) {
    return reject("MISSING_288_DIGEST");
  }
  if (envelope.holdoutSealed !== true) return reject("UNSEALED_HOLDOUT");
  if (!REPLAY_MODES.includes(envelope.replayMode)) return reject("LIVE_REPLAY_FORBIDDEN");
  for (const flag of SHADOW_FLAGS) {
    if (envelope[flag] !== false) return reject("LIVE_REPLAY_FORBIDDEN", "DENIED");
  }
  if (!Array.isArray(envelope.evidenceRefs) || envelope.evidenceRefs.length === 0) {
    return reject("MISSING_EVIDENCE");
  }
  if (envelope.taskId !== TASK_ID) return reject("MISSING_EVIDENCE");
  if (envelope.evidenceRefs.length !== REQUIRED_EVIDENCE.size) return reject("MISSING_EVIDENCE");
  const refs = [];
  for (const ref of envelope.evidenceRefs) {
    if (!isRecord(ref)
      || typeof ref.evidenceId !== "string" || ref.evidenceId.length === 0
      || typeof ref.fixtureId !== "string" || ref.fixtureId.length === 0
      || typeof ref.fixturePath !== "string" || ref.fixturePath.length === 0
      || typeof ref.sha256 !== "string") {
      return reject("PROSE_ONLY_INPUT");
    }
    const expected = REQUIRED_EVIDENCE.get(ref.evidenceId);
    if (expected === undefined || expected.fixtureId !== ref.fixtureId || expected.fixturePath !== ref.fixturePath) {
      return reject("MISSING_EVIDENCE");
    }
    if (refs.some((item) => item.evidenceId === ref.evidenceId)) return reject("MISSING_EVIDENCE");
    const absolutePath = resolve(ROOT, ref.fixturePath);
    if (!existsSync(absolutePath)) return reject("MISSING_EVIDENCE");
    if (sha256OfFile(absolutePath) !== ref.sha256) return reject("MISSING_288_DIGEST");
    refs.push({ evidenceId: ref.evidenceId, fixtureId: ref.fixtureId, fixturePath: ref.fixturePath, sha256: ref.sha256 });
  }
  if (!Array.isArray(envelope.criteria) || envelope.criteria.length !== REQUIRED_CRITERIA.size) return reject("MISSING_EVIDENCE");
  const refIds = new Set(refs.map((item) => item.evidenceId));
  const criterionIds = new Set();
  for (const criterion of envelope.criteria) {
    if (!isRecord(criterion)
      || typeof criterion.criterionId !== "string" || criterion.criterionId.length === 0
      || typeof criterion.claim !== "string" || criterion.claim.length === 0
      || criterion.expectedVerdict !== "PASS"
      || !Array.isArray(criterion.evidenceRefs) || criterion.evidenceRefs.length === 0
      || criterion.evidenceRefs.some((id) => typeof id !== "string" || !refIds.has(id))) {
      return reject("MISSING_EVIDENCE");
    }
    if (!REQUIRED_CRITERIA.has(criterion.criterionId) || criterionIds.has(criterion.criterionId)) return reject("MISSING_EVIDENCE");
    criterionIds.add(criterion.criterionId);
  }
  const holdoutRef = refs.find((item) => item.fixtureId === HOLDOUT_FIXTURE_ID);
  if (holdoutRef === undefined) return reject("MISSING_EVIDENCE");
  return {
    ok: true,
    refs,
    holdoutRef,
    criteria: envelope.criteria,
    nonClaims: Array.isArray(envelope.nonClaims) ? envelope.nonClaims : [],
    replayMode: envelope.replayMode,
  };
}

function exactByCase(actual, expected) {
  if (!Array.isArray(actual) || !Array.isArray(expected) || actual.length !== expected.length) return false;
  const normalize = (items) => [...items].sort((left, right) => left.caseId.localeCompare(right.caseId));
  return JSON.stringify(normalize(actual)) === JSON.stringify(normalize(expected));
}

function exactStrings(actual, expected) {
  return Array.isArray(actual) && Array.isArray(expected)
    && JSON.stringify([...actual].sort()) === JSON.stringify([...expected].sort());
}

export function criterionVerdict(criterionId, proof, groundTruth = readFileSync(join(ROOT, "tests/fixtures/cks-09/holdout-ground-truth-v1.json"), "utf8")) {
  if (typeof groundTruth === "string") groundTruth = JSON.parse(groundTruth);
  switch (criterionId) {
    case "P17_EXPERIENCE_IMPROVES_QUALITY_COST":
      return proof.p17.verdict === groundTruth.p17.expectedVerdict
        && proof.p17.aggregate.qualityDelta > 0
        && proof.p17.aggregate.costReduction > 0
        && proof.p17.aggregate.efficiencyDelta > 0
        ? "PASS" : "DENIED";
    case "P18_PLANTED_STABLE_IDENTIFIED_TRAPS_DENIED": {
      const acceptedCases = proof.p18.caseResults.filter((item) => item.evaluation.verdict === "ACCEPTED").map((item) => item.caseId);
      const denied = proof.p18.caseResults.filter((item) => item.evaluation.verdict === "DENIED")
        .map((item) => ({ caseId: item.caseId, verdict: item.evaluation.verdict, reason: item.evaluation.reason }));
      const expectedDenied = groundTruth.p18.deniedCaseIds.map((caseId) => ({ caseId, verdict: "DENIED", reason: groundTruth.p18.denialReason }));
      return proof.p18.verdict === groundTruth.p18.expectedVerdict
        && exactStrings(acceptedCases, groundTruth.p18.acceptedCaseIds)
        && exactStrings(proof.p18.deniedCaseIds, groundTruth.p18.deniedCaseIds)
        && exactByCase(denied, expectedDenied)
        ? "PASS" : "DENIED";
    }
    case "INAPPLICABLE_VERSION_DRIFT_REUSE_DENIED": {
      const expected = groundTruth.reuseBoundaries.map((item) => ({ caseId: item.caseId, outcome: item.expectedOutcome, reason: item.expectedReason }));
      return exactByCase(proof.reuseBoundaries, expected) ? "PASS" : "DENIED";
    }
    case "SHADOW_ONLY_SIMULATION_BOUNDARY": {
      const expected = groundTruth.failureClosedBoundaries.map((item) => ({ caseId: item.caseId, verdict: item.expectedVerdict, reason: item.expectedReason }));
      return proof.p17.mode === MODE
        && proof.p17.externalStateChanged === false
        && proof.p17.modelsOrServicesCalled === false
        && proof.p17.procedureContentReturned === false
        && exactByCase(proof.failureClosedChecks, expected)
        ? "PASS" : "DENIED";
    }
    case "CANDIDATE_PRESERVATION":
      return proof.preservation.counterevidenceCoverage === groundTruth.preservation.counterevidenceCoverage
        && exactStrings(proof.preservation.dependencyRefs, groundTruth.preservation.dependencies)
        && exactStrings(proof.preservation.knownFailureRefs, groundTruth.preservation.knownFailures)
        && exactStrings(proof.preservation.counterexampleRefs, groundTruth.preservation.counterexamples)
        && exactStrings(proof.preservation.provenanceRefs, groundTruth.preservation.provenance)
        ? "PASS" : "DENIED";
    default:
      return "DENIED";
  }
}

export function renderReceipt(envelope, envelopePath) {
  const verification = verifyEnvelope(envelope, envelopePath);
  if (!verification.ok) return { receipt: failClosed(verification.verdict, verification.reason, envelope, envelopePath), exitCode: 1 };
  let proof;
  try {
    proof = score(join(ROOT, verification.holdoutRef.fixturePath));
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    const body = failClosed("DENIED", "UNRESOLVED_FAILURE", envelope, envelopePath);
    return { receipt: { ...body, detail }, exitCode: 1 };
  }
  const criteria = verification.criteria.map((criterion) => ({
    criterionId: criterion.criterionId,
    claim: criterion.claim,
    evidenceRefs: [...criterion.evidenceRefs].sort(),
    verdict: criterionVerdict(criterion.criterionId, proof),
  }));
  const verdict = criteria.every((item) => item.verdict === "PASS") ? "PASS" : "DENIED";
  const body = {
    schemaVersion: RECEIPT_SCHEMA_VERSION,
    taskId: TASK_ID,
    mode: MODE,
    scope: SCOPE,
    verdict,
    reasons: verdict === "PASS" ? [] : ["UNRESOLVED_FAILURE"],
    externalStateChanged: false,
    modelsOrServicesCalled: false,
    procedureContentReturned: false,
    admission: {
      evidenceAdmission: "ADMITTED",
      holdoutSealed: true,
      replayMode: verification.replayMode,
    },
    envelope: {
      fixtureId: envelope.fixtureId,
      fixturePath: relative(ROOT, envelopePath).split("\\").join("/"),
      sha256: sha256OfFile(envelopePath),
    },
    evidence: verification.refs,
    criteria,
    proof,
    nonClaims: [...verification.nonClaims],
  };
  return { receipt: { ...body, canonicalDigest: cks09Digest(body) }, exitCode: verdict === "PASS" ? 0 : 1 };
}

function parseArgs(argv) {
  const fixtureIndex = argv.indexOf("--fixture");
  return {
    fixturePath: fixtureIndex >= 0 ? argv[fixtureIndex + 1] : undefined,
    dryRun: argv.includes("--dry-run"),
  };
}

export function main(argv = process.argv.slice(2)) {
  const { fixturePath, dryRun } = parseArgs(argv);
  if (fixturePath === undefined || argv.includes("--help")) {
    process.stdout.write("Usage: node scripts/run-cks-09-proof-dry-run.mjs --fixture <e2e-positive-evidence-v1.json> [--dry-run]\n");
    process.exitCode = fixturePath === undefined ? 2 : 0;
    return;
  }
  const absolutePath = resolve(fixturePath);
  let envelope;
  try {
    envelope = JSON.parse(readFileSync(absolutePath, "utf8"));
  } catch {
    const receipt = failClosed("INCONCLUSIVE", existsSync(absolutePath) ? "PROSE_ONLY_INPUT" : "MISSING_EVIDENCE", null, absolutePath);
    process.stdout.write(`${JSON.stringify(receipt, null, 2)}\n`);
    process.exitCode = 1;
    return;
  }
  const { receipt, exitCode } = renderReceipt(envelope, absolutePath);
  if (!dryRun && receipt.verdict === "PASS") {
    writeFileSync(RECEIPT_PATH, `${JSON.stringify(receipt, null, 2)}\n`);
  }
  process.stdout.write(`${JSON.stringify(receipt, null, 2)}\n`);
  process.exitCode = exitCode;
}

if (process.argv[1] !== undefined && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();

export { RECEIPT_PATH, RECEIPT_SCHEMA_VERSION };