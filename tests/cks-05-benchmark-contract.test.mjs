import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { join, resolve } from "node:path";
import test from "node:test";
import Ajv2020 from "ajv/dist/2020.js";
import addFormats from "ajv-formats";

const root = resolve(import.meta.dirname, "..");
const load = (p) => JSON.parse(readFileSync(join(root, p), "utf8"));

const schema = load("schemas/cks-05-benchmark-manifest-v1.schema.json");
const manifest = load("tests/fixtures/cks-05/benchmark-manifest-valid-v1.json");
const decisionPath = manifest.protocol.decisionReceipt.path;
const decisionBytes = readFileSync(join(root, decisionPath));

const sha256 = (b) => createHash("sha256").update(b).digest("hex");
// RFC 8785-style canonical form: sorted keys, compact separators. The same
// function is used when deriving the fixture's protocolDigestSha256, so the
// source binding below is exact and reproducible.
const canonical = (v) => {
  if (Array.isArray(v)) return `[${v.map(canonical).join(",")}]`;
  if (v && typeof v === "object") {
    return `{${Object.keys(v).sort().map((k) => `${JSON.stringify(k)}:${canonical(v[k])}`).join(",")}}`;
  }
  return JSON.stringify(v);
};

const ajv = new Ajv2020({ allErrors: true, strict: true });
addFormats(ajv);
const validate = (obj) => {
  const ok = ajv.validate(schema, obj);
  return { ok, errors: ajv.errors ?? [] };
};

// Placeholder instance digests for artifacts that do not yet exist (harness
// tree, scorer, prompt template, task-suite edition, knowledge renderings,
// host manifest, resource sampler, ...) are derived deterministically so the
// fixture cannot be hand-edited: every one must equal this derivation.
const fixtureDerivation = (field) => sha256(`CKS05-FIXTURE-DIGEST-V1|${field}`);
const INSTANCE_DIGEST_FIELDS = [
  "harnessTreeSha256",
  "scorerArtifactSha256",
  "outputSchemaSha256",
  "promptTemplateSha256",
  "taskGeneratorArtifactSha256",
  "taskSeedDigestSha256",
  "taskSuiteEditionSha256",
  "knowledgeSeedDigestSha256",
  "knowledgeK0EditionSha256",
  "knowledgeK1EditionSha256",
  "knowledgeK0CanonicalFactInventorySha256",
  "knowledgeK1CanonicalFactInventorySha256",
  "rawK0RenderingSha256",
  "rawK1RenderingSha256",
  "structuredK0RenderingSha256",
  "structuredK1RenderingSha256",
  "factParityReceiptK0Sha256",
  "factParityReceiptK1Sha256",
  "guidanceArtifactSha256",
  "guidanceLeakageAuditSha256",
  "armManifestSha256",
  "runtimeArgvSha256",
  "runtimeEnvironmentAllowListSha256",
  "hostManifestSha256",
  "resourceSamplerArtifactSha256",
];
const flipHex = (hex) => `${hex[0] === "e" ? "f" : "e"}${hex.slice(1)}`;

test("schema is a closed 2020-12 contract pinned under the chimpmaera namespace", () => {
  assert.equal(schema.$schema, "https://json-schema.org/draft/2020-12/schema");
  assert.ok(schema.$id.startsWith("https://schemas.chimpmaera.dev/"));
  assert.equal(schema.additionalProperties, false);
  // Invariant: every required name must exist in properties (fail-closed schema hygiene).
  const walk = (node) => {
    if (!node || typeof node !== "object") return;
    if (Array.isArray(node)) {
      node.forEach(walk);
      return;
    }
    if (
      Array.isArray(node.required) &&
      node.properties &&
      !Object.isFrozen(node.properties)
    ) {
      for (const name of node.required) assert.ok(name in node.properties, `required "${name}" missing from properties`);
    }
    for (const value of Object.values(node)) walk(value);
  };
  walk(schema);
});

test("valid fixture manifest validates against the schema", () => {
  const { ok, errors } = validate(manifest);
  assert.equal(ok, true, JSON.stringify(errors, null, 2));
});

test("receipt byte digest is source-bound to the approved design decision", () => {
  const recomputed = sha256(decisionBytes);
  assert.equal(manifest.protocol.decisionReceipt.sha256, recomputed);
});

test("protocol canonical digest is source-bound to the approved design decision", () => {
  const recomputed = sha256(Buffer.from(canonical(JSON.parse(decisionBytes.toString("utf8"))), "utf8"));
  assert.equal(manifest.protocol.protocolDigestSha256, recomputed);
});

test("schema itself pins the recomputed receipt digests", () => {
  const protocolProps = schema.properties.protocol.properties;
  assert.equal(protocolProps.decisionReceipt.properties.sha256.const, sha256(decisionBytes));
  assert.equal(
    protocolProps.protocolDigestSha256.const,
    sha256(Buffer.from(canonical(JSON.parse(decisionBytes.toString("utf8"))), "utf8"))
  );
});

test("instance digests are deterministic placeholders, not hand edits", () => {
  for (const field of INSTANCE_DIGEST_FIELDS) {
    assert.equal(manifest.admission[field], fixtureDerivation(field), field);
  }
  assert.equal(manifest.admission.harnessCommitSha1, fixtureDerivation("harnessCommitSha1").slice(0, 40));
  // No two instance digests may collide (reused digests across distinct artifacts are a pairing smell).
  const all = [
    manifest.admission.harnessCommitSha1,
    ...INSTANCE_DIGEST_FIELDS.map((f) => manifest.admission[f]),
  ];
  assert.equal(new Set(all).size, all.length);
});

test("cross-arm comparability: identical task/Knowledge identity and single retrieval mode", () => {
  const expectedArmIds = ["ARM-LRF-01", "ARM-SRF-02", "ARM-LSF-03", "ARM-SSF-04", "ARM-SSG-05"];
  assert.equal(manifest.arms.length, 5);
  assert.deepEqual(manifest.arms.map((a) => a.armId).sort(), [...expectedArmIds].sort());
  const profileIds = new Set(manifest.modelProfiles.map((p) => p.profileId));
  assert.equal(manifest.modelProfiles.length, 2);
  for (const arm of manifest.arms) {
    assert.deepEqual(arm.editions, ["K0_STATIC", "K1_UPDATED"]);
    assert.deepEqual(arm.allowedRetrievalModes, ["EMBEDDED_CONTEXT"]);
    assert.deepEqual(arm.retrievalCapabilities, {
      tools: false,
      network: false,
      multiTurn: false,
      agenticLoop: false,
      crossRunMemory: false,
      effects: false,
    });
    assert.ok(profileIds.has(arm.modelProfileId), `${arm.armId} references an unknown profile`);
  }
  // Model byte identities are pinned in both the profiles and L1 admission.
  const small = manifest.modelProfiles.find((p) => p.role === "SMALL");
  const large = manifest.modelProfiles.find((p) => p.role === "LARGE");
  assert.equal(small.sha256, manifest.admission.smallModelSha256);
  assert.equal(large.sha256, manifest.admission.largeModelSha256);
  for (const arm of manifest.arms) {
    const profile = manifest.modelProfiles.find((p) => p.profileId === arm.modelProfileId);
    assert.ok(profile, `${arm.armId} profile lookup`);
  }
  // Arm-to-profile binding matches the approved design (which arm uses which bytes).
  const binding = Object.fromEntries(manifest.arms.map((a) => [a.armId, a.modelProfileId]));
  assert.equal(binding["ARM-LRF-01"], large.profileId);
  assert.equal(binding["ARM-SRF-02"], small.profileId);
  assert.equal(binding["ARM-LSF-03"], large.profileId);
  assert.equal(binding["ARM-SSF-04"], small.profileId);
  assert.equal(binding["ARM-SSG-05"], small.profileId);
  // Knowledge editions are identical frozen editions for every arm.
  assert.deepEqual(manifest.knowledgeEditions.map((e) => e.editionId), ["K0_STATIC", "K1_UPDATED"]);
  assert.equal(manifest.crossArmIdentity.neverRegeneratedPerArm, true);
  assert.equal(manifest.crossArmIdentity.taskQuestionBytesIdenticalAcrossEditions, true);
  assert.equal(manifest.crossArmIdentity.rejectOnArmSpecificSubstitution, true);
});

test("run-count arithmetic: 5 arms x 32 tasks x 2 editions x 3 seeds = 960 scheduled runs", () => {
  const c = manifest.runPlan.scheduledCounts;
  assert.equal(c.arms, manifest.arms.length);
  assert.equal(c.arms, 5);
  assert.equal(c.taskIdsPerEdition, manifest.taskSuite.taskIdsPerEdition);
  assert.equal(c.taskIdsPerEdition, 32);
  assert.equal(c.knowledgeEditions, manifest.knowledgeEditions.length);
  assert.equal(c.knowledgeEditions, 2);
  assert.equal(c.generationSeeds, manifest.generation.seeds.length);
  assert.equal(c.generationSeeds, 3);
  assert.equal(c.totalScheduledRunRecords, c.arms * c.taskIdsPerEdition * c.knowledgeEditions * c.generationSeeds);
  assert.equal(c.totalScheduledRunRecords, 960);
  // Paired contrasts: per task/seed, 5 arms give pairs; unit counts follow the approved design.
  assert.equal(c.pairedExecutionsPerArmContrastPerEdition, c.taskIdsPerEdition * c.generationSeeds);
  assert.equal(c.pairedExecutionsPerArmContrastPerEdition, 96);
  assert.equal(c.independentTaskUnitsPerArmContrastPerEdition, c.taskIdsPerEdition);
  assert.equal(c.pairedExecutionsPerSingleMultiContrastPerArmEdition, 16 * c.generationSeeds);
  assert.equal(c.independentScenarioPairUnitsPerSingleMultiContrastPerArmEdition, manifest.taskSuite.scenarioPairCount);
  // Task suite internal arithmetic.
  const t = manifest.taskSuite;
  assert.equal(t.domainCount * t.scenarioPairsPerDomain, t.scenarioPairCount);
  assert.equal(t.scenarioPairCount * t.tasksPerScenarioPair, t.taskIdsPerEdition);
  assert.equal(t.hopStrata.SINGLE_HOP + t.hopStrata.MULTI_HOP, t.taskIdsPerEdition);
  assert.equal(t.updateSensitivity.UPDATE_SENSITIVE_TASKS + t.updateSensitivity.EDITION_INVARIANT_CONTROL_TASKS, t.taskIdsPerEdition);
});

test("claim gate is fail-closed before execution: DENY_NOT_EXECUTED and no substitution claim", () => {
  const c = manifest.claimEligibility;
  assert.equal(c.gateId, "L6-MODEL-SUBSTITUTION");
  assert.equal(c.preExecutionStatus, "DENY_NOT_EXECUTED");
  assert.equal(c.modelSubstitutionClaimBeforeExecution, false);
  assert.equal(c.noEarlySuccess, true);
  assert.ok(c.qualityThresholds.length >= 1, "quality thresholds present");
  assert.ok(c.efficiencyThresholds.length >= 1, "efficiency thresholds present");
  assert.ok(c.substitutionGateLogic.includes("QUALITY_EFFICIENCY"));
  // Stop/simplification rules can falsify or simplify the architecture.
  assert.ok(c.stopRuleIds.includes("STOP-07-NO-EARLY-SUCCESS"));
  for (const id of ["SIMPLIFY-STRUCTURE", "SIMPLIFY-GUIDANCE", "SIMPLIFY-UPDATES", "SIMPLIFY-MULTI-HOP", "FALSIFY-SUBSTITUTION"]) {
    assert.ok(c.stopRuleIds.includes(id), `missing stop/simplification rule ${id}`);
  }
  assert.equal(manifest.receipt.currentEvidenceVerdict, "MANIFEST_DEFINED_EXECUTION_NOT_AUTHORIZED_NO_BENCHMARK_RESULT_NO_MODEL_SUBSTITUTION_CLAIM");
  assert.equal(manifest.receipt.actionsNotPerformed.benchmarkRuns, 0);
  assert.equal(manifest.receipt.actionsNotPerformed.modelInvocations, 0);
});

const PROBE_NAMES = [
  "unknown-top-level-field",
  "unknown-admission-field",
  "digest-drift-small-model",
  "seed-drift",
  "retrieval-escape-mode",
  "retrieval-escape-tool-capability",
  "hidden-retry",
  "attempt-ordinal-not-1",
  "concurrent-scored-requests-2",
  "sample-coverage-below-0.99",
  "pre-execution-claim-status-pass",
  "model-substitution-claim-before-execution",
  "missing-arm",
  "wall-clock-budget-73h",
  "arm-bound-to-wrong-profile",
  "unknown-terminal-status",
];

test("fail-closed: every drift or escape probe is rejected by the schema", () => {
  const probes = new Map(PROBE_NAMES.map((n) => [n, null]));
  let p;

  p = structuredClone(manifest);
  p.unexpectedTopLevelField = "drift";
  probes.set("unknown-top-level-field", p);

  p = structuredClone(manifest);
  p.admission.unexpectedAdmissionField = "drift";
  probes.set("unknown-admission-field", p);

  p = structuredClone(manifest);
  p.admission.smallModelSha256 = flipHex(p.admission.smallModelSha256);
  probes.set("digest-drift-small-model", p);

  p = structuredClone(manifest);
  p.generation.seeds = [1, 2, 3];
  probes.set("seed-drift", p);

  p = structuredClone(manifest);
  p.arms[0].allowedRetrievalModes = ["EMBEDDED_CONTEXT", "RETRIEVAL_TOOL"];
  probes.set("retrieval-escape-mode", p);

  p = structuredClone(manifest);
  p.arms[0].retrievalCapabilities.tools = true;
  probes.set("retrieval-escape-tool-capability", p);

  p = structuredClone(manifest);
  p.provenanceContract.hiddenRetry = true;
  probes.set("hidden-retry", p);

  p = structuredClone(manifest);
  p.provenanceContract.attemptOrdinal = 2;
  probes.set("attempt-ordinal-not-1", p);

  p = structuredClone(manifest);
  p.runPlan.concurrentScoredRequests = 2;
  p.timingAndResourceCollection.maxConcurrentScoredRequests = 2;
  probes.set("concurrent-scored-requests-2", p);

  p = structuredClone(manifest);
  p.timingAndResourceCollection.minimumValidSampleCoverage = 0.98;
  probes.set("sample-coverage-below-0.99", p);

  p = structuredClone(manifest);
  p.claimEligibility.preExecutionStatus = "PASS";
  probes.set("pre-execution-claim-status-pass", p);

  p = structuredClone(manifest);
  p.claimEligibility.modelSubstitutionClaimBeforeExecution = true;
  probes.set("model-substitution-claim-before-execution", p);

  p = structuredClone(manifest);
  p.arms.pop();
  probes.set("missing-arm", p);

  p = structuredClone(manifest);
  p.timingAndResourceCollection.protocolWallClockBudgetHours = 73;
  probes.set("wall-clock-budget-73h", p);

  p = structuredClone(manifest);
  p.arms[0].modelProfileId = "MODEL-SMALL-VIBETHINKER-3B-Q8_0-ED81A97A";
  probes.set("arm-bound-to-wrong-profile", p);

  p = structuredClone(manifest);
  p.provenanceContract.terminalStatuses = ["COMPLETED", "FAILED", "INVALIDATED", "SKIPPED"];
  probes.set("unknown-terminal-status", p);

  const failures = [];
  for (const [name, obj] of probes) {
    const { ok, errors } = validate(obj);
    if (ok) failures.push(`${name}: probe unexpectedly VALIDATED`);
    else if (errors.length === 0) failures.push(`${name}: rejected with no error detail`);
  }
  assert.deepEqual(failures, [], failures.join("\n"));
});

test("fail-closed: mutating the schema-pinned protocol digest itself is rejected", () => {
  const p = structuredClone(manifest);
  p.protocol.protocolDigestSha256 = flipHex(p.protocol.protocolDigestSha256);
  const { ok } = validate(p);
  assert.equal(ok, false);
});