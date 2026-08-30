#!/usr/bin/env node
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

import {
  buildSyntheticFixtureModel,
  scoreSyntheticLineageFixture,
} from "./cks-08-score-synthetic-lineage.mjs";
import {
  isReconstructedKnowledgeUsageV1,
  reconstructCksLineageUsageV1,
  verifyCksLineageReconstructionV1,
} from "../dist/packages/contracts/src/cks-lineage-reconstructor.js";
import { evaluateCksSeededFailureAttributionV1 } from "../dist/packages/contracts/src/cks-failure-attribution-evaluator.js";

export const CKS_08_DRY_RUN_SCHEMA_V1 = "chimpmaera.verification/cks-08-lineage-dry-run/v1";
const ROOT = resolve(fileURLToPath(new URL("..", import.meta.url)));
const EVIDENCE_PATH = "verification/cks-08-lineage-dry-run-evidence-v1.json";
const REQUIRED_PROFILE_DIMENSIONS = ["source", "applicability", "freshness", "contradiction", "generalization", "operational"];
const EXPECTED_POSITIVE_KEYS = ["schemaVersion", "fixtureClass", "semanticRuleId", "sourceFixtures", "p14", "p15", "p16", "failClosed", "profileDimensions", "privacy"];
const EXPECTED_REJECTION_KEYS = ["schemaVersion", "fixtureClass", "semanticRuleId", "sourceFixture", "cases"];

const readJson = (relativePath) => JSON.parse(readFileSync(resolve(ROOT, relativePath), "utf8"));
const clone = (value) => JSON.parse(JSON.stringify(value));
const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");
const digestJson = (value) => sha256(`${JSON.stringify(value)}\n`);
const fail = (message) => { throw new Error(`CKS-08 offline dry-run failed: ${message}`); };
const exactKeys = (value, expected) => JSON.stringify(Object.keys(value).sort()) === JSON.stringify([...expected].sort());
const usageShape = (result) => ({
  searched: result.searched.map((ref) => ref.knowledgeId),
  inspected: result.inspected.map((ref) => ref.knowledgeId),
  used: result.used.map((ref) => ref.knowledgeId),
  rejected: result.rejected.map((item) => [item.knowledgeRef.knowledgeId, item.reasonCode]),
  decisionSupporting: result.decisionSupporting.map((ref) => ref.knowledgeId),
  outcomeContributing: result.outcomeContributing.map((ref) => ref.knowledgeId),
});

function validateManifests(positive, rejections) {
  if (!exactKeys(positive, EXPECTED_POSITIVE_KEYS) || positive.schemaVersion !== "cks-08-e2e-positive-evidence/v1" || positive.fixtureClass !== "LOCAL_SYNTHETIC_REPLAYABLE" || positive.semanticRuleId !== "chimpmaera.knowledge/usage-lineage-semantics/v1") fail("positive manifest shape denied");
  if (!exactKeys(rejections, EXPECTED_REJECTION_KEYS) || rejections.schemaVersion !== "cks-08-e2e-rejections/v1" || rejections.fixtureClass !== positive.fixtureClass || rejections.semanticRuleId !== positive.semanticRuleId) fail("rejection manifest shape denied");
  if (JSON.stringify(positive.profileDimensions) !== JSON.stringify(REQUIRED_PROFILE_DIMENSIONS)) fail("profile dimension contract drifted");
  if (rejections.sourceFixture !== positive.sourceFixtures.lineageRejections) fail("rejection source binding drifted");
  if (positive.privacy.rawReceiptsEmitted || positive.privacy.rawContentEmitted || positive.privacy.credentialsOrPersonalDataEmitted) fail("privacy manifest permits raw evidence");
}

function replayDirectLineage(positive, rejections) {
  const lineagePositive = readJson(positive.sourceFixtures.lineagePositive);
  const directTasks = new Map(lineagePositive.tasks.map((task) => [task.name, task]));
  const accepted = positive.p14.tasks.map((expected) => {
    const task = directTasks.get(expected.name);
    if (!task) fail(`missing direct positive task ${expected.name}`);
    const first = reconstructCksLineageUsageV1(task.events);
    const second = reconstructCksLineageUsageV1(clone(task.events));
    if (!isReconstructedKnowledgeUsageV1(first) || JSON.stringify(first) !== JSON.stringify(second)) fail(`${expected.name} was not deterministic RECONSTRUCTED`);
    if (JSON.stringify(usageShape(first)) !== JSON.stringify(expected.usage)) fail(`${expected.name} usage receipt mismatch`);
    if (verifyCksLineageReconstructionV1(first).outcome !== "ACCEPTED") fail(`${expected.name} receipt verification denied`);
    return { name: expected.name, eventCount: task.events.length, status: first.status, usage: usageShape(first) };
  });

  const lineageRejections = readJson(rejections.sourceFixture);
  const sourceCases = new Map(lineageRejections.cases.map((item) => [item.name, item]));
  const denied = rejections.cases.map((expected) => {
    const item = sourceCases.get(expected.name);
    if (!item) fail(`missing direct rejection ${expected.name}`);
    const first = reconstructCksLineageUsageV1(item.events);
    const second = reconstructCksLineageUsageV1(clone(item.events));
    if (first.status !== expected.expectedStatus || JSON.stringify(first) !== JSON.stringify(second)) fail(`${expected.name} rejection was not deterministic`);
    if (JSON.stringify(first.reasonCodes) !== JSON.stringify(expected.expectedReasonCodes)) fail(`${expected.name} reason code mismatch`);
    if (verifyCksLineageReconstructionV1(first).outcome !== "ACCEPTED") fail(`${expected.name} denial receipt verification denied`);
    return { name: expected.name, eventCount: item.events.length, status: first.status, reasonCodes: first.reasonCodes };
  });
  return { accepted, denied };
}

function checkSyntheticProof(positive) {
  const cases = readJson(positive.sourceFixtures.syntheticCases);
  const groundTruth = readJson(positive.sourceFixtures.syntheticGroundTruth);
  const scored = scoreSyntheticLineageFixture(cases, groundTruth);
  if (scored.status !== "PASS") fail("synthetic scorer did not pass");

  const model = buildSyntheticFixtureModel(cases);
  const p15 = positive.p15.groups.map((expected) => {
    const actual = scored.p15.find((item) => item.name === expected.name);
    if (!actual || JSON.stringify(actual.metrics) !== JSON.stringify(expected.metrics)) fail(`${expected.name} P15 metrics mismatch`);
    return { name: actual.name, metrics: actual.metrics };
  });
  const p16 = positive.p16.caseNames.map((name) => {
    const actual = scored.p16.find((item) => item.name === name);
    const built = model.built.get(name);
    if (!actual || !built) fail(`${name} P16 receipt missing`);
    const evaluation = evaluateCksSeededFailureAttributionV1(clone(built.attributionInput));
    if (evaluation.status !== "EVALUATED") fail(`${name} P16 replay denied`);
    if (JSON.stringify(Object.keys(evaluation.evidenceProfiles[0].dimensions).sort()) !== JSON.stringify([...REQUIRED_PROFILE_DIMENSIONS].sort())) fail(`${name} profile dimensions collapsed`);
    return {
      name,
      outcomeClass: actual.outcomeClass,
      causalMode: actual.causalMode,
      causes: evaluation.causes.map(({ class: causeClass, subtype, certainty }) => ({ class: causeClass, subtype, certainty }))
    };
  });
  const modes = [...new Set(p16.map((item) => item.causalMode))].sort();
  const certainties = [...new Set(groundTruth.p16.cases.flatMap((item) => item.causes.map((cause) => cause.certainty)))].sort();
  if (JSON.stringify(modes) !== JSON.stringify([...positive.p16.requiredCausalModes].sort())) fail("causal mode coverage mismatch");
  if (JSON.stringify(certainties) !== JSON.stringify([...positive.p16.requiredCertainties].sort())) fail("certainty coverage mismatch");

  const expectedNegativeNames = [...positive.failClosed.attributionRejectionNames].sort();
  const actualNegativeNames = scored.negatives.filter((item) => expectedNegativeNames.includes(item.name)).map((item) => item.name).sort();
  if (JSON.stringify(actualNegativeNames) !== JSON.stringify(expectedNegativeNames) || !scored.negatives.filter((item) => expectedNegativeNames.includes(item.name)).every((item) => item.status === "DENIED")) fail("attribution rejection coverage mismatch");

  return {
    p15,
    p16,
    attributionDenials: scored.negatives.filter((item) => expectedNegativeNames.includes(item.name)).map(({ name, status, reasonCodes }) => ({ name, status, reasonCodes })),
    syntheticMetrics: scored.metrics,
  };
}

function artifactDigests(positive) {
  return Object.fromEntries(Object.values(positive.sourceFixtures).map((path) => [path, sha256(readFileSync(resolve(ROOT, path)))]));
}

export function renderCks08EvidenceDraft(positive, rejections) {
  validateManifests(positive, rejections);
  const direct = replayDirectLineage(positive, rejections);
  const synthetic = checkSyntheticProof(positive);
  const totalEvents = [...direct.accepted, ...direct.denied].reduce((sum, item) => sum + item.eventCount, 0);
  const report = {
    schemaVersion: CKS_08_DRY_RUN_SCHEMA_V1,
    status: "PASS",
    evidenceId: "evidence:cks-08-lineage-dry-run-v1",
    evidenceClass: "LOCAL_SYNTHETIC",
    state: "DRAFT_PRE_COMMIT",
    testedCommit: null,
    claimBoundary: "OFFLINE_DETERMINISTIC_CKS_08_PROOF_ONLY_NO_TELEMETRY_NO_RAW_CONTENT_NO_LIVE_SYSTEM_NO_PRODUCTION",
    processContext: {
      operatingModel: "Operating Model v1.1",
      priorDecisions: ["D-001", "D-002", "D-003", "D-004", "D-005", "D-006", "D-007"],
      disposition: "PRESERVED_NO_OVERRIDE"
    },
    replay: {
      status: "PASS",
      boundedReceiptCount: totalEvents,
      positiveLineageTasks: direct.accepted,
      deniedLineageCases: direct.denied,
      deniedAttributionCases: synthetic.attributionDenials
    },
    acceptance: {
      P14: {
        status: "PASS",
        directTaskCount: direct.accepted.length,
        scorerTaskCount: synthetic.syntheticMetrics.p14Reconstructed,
        exactUsageFields: ["searched", "inspected", "used", "rejected", "decisionSupporting", "outcomeContributing"]
      },
      P15: {
        status: "PASS",
        groups: synthetic.p15,
        repetitionInflationPrevented: true
      },
      P16: {
        status: "PASS",
        caseCount: synthetic.p16.length,
        causalModes: [...new Set(synthetic.p16.map((item) => item.causalMode))].sort(),
        uncertaintyClasses: [...new Set(readJson(positive.sourceFixtures.syntheticGroundTruth).p16.cases.flatMap((item) => item.causes.map((cause) => cause.certainty)))].sort()
      },
      failClosed: {
        status: "PASS",
        lineageCases: direct.denied.length,
        attributionCases: synthetic.attributionDenials.length,
        noPartialUsageSets: true
      },
      independentProfileDimensions: {
        status: "PASS",
        dimensions: positive.profileDimensions
      }
    },
    privacy: {
      rawReceiptsEmitted: false,
      rawContentEmitted: false,
      credentialsOrPersonalDataEmitted: false,
      evidenceContainsOnly: ["bounded counts", "fixture labels", "validated statuses", "reason codes", "non-sensitive digests"]
    },
    nonClaims: positive.privacy.nonClaims,
    artifactDigests: artifactDigests(positive),
    verification: {
      focusedCommand: "node --test tests/cks-08-lineage-dry-run.test.mjs",
      dryRunCommand: "node scripts/run-cks-08-lineage-dry-run.mjs --fixture tests/fixtures/cks-08/e2e-positive-evidence-v1.json --dry-run",
      authoritativeCommand: "npm test",
      diffCheck: "git diff --check origin/main...HEAD"
    }
  };
  return { ...report, reportDigest: digestJson(report) };
}

function parseArgs(args) {
  const fixtureIndex = args.indexOf("--fixture");
  const fixturePath = fixtureIndex >= 0 ? args[fixtureIndex + 1] : "tests/fixtures/cks-08/e2e-positive-evidence-v1.json";
  const allowed = new Set(["--dry-run", "--write-evidence", "--fixture", fixturePath]);
  if (!fixturePath || args.filter((arg) => arg === "--fixture").length > 1 || args.some((arg) => !allowed.has(arg))) throw new Error("usage: node scripts/run-cks-08-lineage-dry-run.mjs --fixture <path> --dry-run");
  return { fixturePath, writeEvidence: args.includes("--write-evidence") };
}

const invoked = process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url));
if (invoked) {
  try {
    const { fixturePath, writeEvidence } = parseArgs(process.argv.slice(2));
    const positive = readJson(fixturePath);
    const rejections = readJson("tests/fixtures/cks-08/e2e-rejections-v1.json");
    const report = renderCks08EvidenceDraft(positive, rejections);
    if (writeEvidence) writeFileSync(resolve(ROOT, EVIDENCE_PATH), `${JSON.stringify(report, null, 2)}\n`, "utf8");
    process.stdout.write(`${JSON.stringify({ status: report.status, evidenceId: report.evidenceId, reportDigest: report.reportDigest, boundedReceiptCount: report.replay.boundedReceiptCount }, null, 2)}\n`);
  } catch (error) {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  }
}
