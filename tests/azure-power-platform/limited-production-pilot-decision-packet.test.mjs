import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import Ajv2020 from "ajv/dist/2020.js";
import {
  applyNegativeCase,
  digestJson,
  EXPECTED_PINS,
  loadFixture,
  validatePacket,
} from "../../tools/azure-power-platform/validate-limited-production-pilot-decision-packet.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const readyPath = "tests/fixtures/azure-power-platform/pilot-decision-ready.json";
const unsafePath = "tests/fixtures/azure-power-platform/pilot-decision-unsafe.json";
const toolPath = "tools/azure-power-platform/validate-limited-production-pilot-decision-packet.mjs";
const schemaPath = path.join(root, "docs/development/azure-power-platform/limited-production-pilot-decision-packet.schema.json");
const packet = await loadFixture(readyPath, root);
const unsafe = await loadFixture(unsafePath, root);
const schema = JSON.parse(await readFile(schemaPath, "utf8"));
const validateSchema = new Ajv2020({ allErrors: true, strict: true }).compile(schema);

const negativeCases = [
  ["missing-sandbox-evidence", "SANDBOX_EVIDENCE_DENIED"],
  ["incomplete-negative-results", "NEGATIVE_EVIDENCE_DENIED"],
  ["production-readiness-assertion", "PRODUCTION_READINESS_DENIED"],
  ["production-data", "PRODUCTION_DATA_DENIED"],
  ["tenant-identifier", "PUBLIC_UNSAFE_MATERIAL_DENIED"],
  ["credential-material", "PUBLIC_UNSAFE_MATERIAL_DENIED"],
  ["auto-promotion", "AUTO_PROMOTION_DENIED"],
  ["conflated-approver-executor", "AUTHORITY_SEPARATION_DENIED"],
  ["missing-rollback-plan", "ROLLBACK_TARGET_DENIED"],
  ["missing-readback-plan", "READBACK_PLAN_DENIED"],
  ["approved-without-external-authorization", "EXTERNAL_AUTHORIZATION_DENIED"],
  ["execute-without-readback", "READBACK_REQUIRED_DENIED"],
  ["publish-without-readback", "SCHEMA_DENIED"],
  ["promote-without-readback", "READBACK_REQUIRED_DENIED"],
];

function cli(fixture, ...args) {
  return JSON.parse(execFileSync(process.execPath, [toolPath, "--input", fixture, ...args], {
    cwd: root,
    encoding: "utf8",
    env: { ...process.env, NODE_OPTIONS: "--jitless" },
  }));
}

test("accepts an explicitly undecided synthetic packet with immutable evidence and separate authorities", () => {
  assert.equal(validateSchema(packet), true, JSON.stringify(validateSchema.errors));
  const result = validatePacket(packet);
  assert.equal(result.accepted, true, JSON.stringify(result));
  assert.equal(result.status, "VALIDATED");
  assert.equal(packet.packetStatus, "DECISION_READY_INACTIVE");
  assert.equal(packet.environmentClass, "LOCAL_SYNTHETIC_REPOSITORY_ONLY");
  assert.equal(packet.decisionGate.state, "UNDECIDED");
  assert.equal(packet.decisionGate.selectedOption, null);
  assert.deepEqual(packet.decisionGate.options, ["AUTHORIZE_PILOT_EXECUTION", "DECLINE_PILOT", "REQUEST_MORE_EVIDENCE"]);
  assert.equal(packet.exactPins.policy.generation, 17);
  assert.deepEqual(packet.exactPins, EXPECTED_PINS);
  assert.equal(packet.exactPins.tupleDigest, digestJson({ component: packet.exactPins.component, schema: packet.exactPins.schema, policy: packet.exactPins.policy }));
  assert.equal(packet.authorityBoundary.authoritiesAreDistinct, true);
  assert.equal(new Set(Object.values(packet.authorityBoundary.authorities)).size, 5);
  assert.equal(packet.authorityBoundary.externalAuthorizationPresent, false);
  assert.equal(packet.riskRegister.length, 4);
});

test("binds evidence, limitations, negative results, rollback, and public-safe redaction", () => {
  assert.equal(packet.evidence.bundleDigest, digestJson(packet.evidence.refs));
  assert.equal(packet.publicRedaction.digest, digestJson({ ...packet.publicRedaction, digest: undefined }));
  assert.equal(packet.sandboxEvidence.status, "VALIDATED_OFFLINE");
  assert.equal(packet.sandboxEvidence.deploymentPerformed, false);
  assert.equal(packet.sandboxEvidence.productionDataObserved, false);
  assert.equal(packet.negativeResults.length, 14);
  assert.ok(packet.negativeResults.every((result) => result.outcome === "DENY" && result.effectCount === 0));
  assert.equal(packet.rollback.target, "EXACT_LKG_FULL_TUPLE_DIGEST_FROM_INDEPENDENT_TRUSTED_CONTEXT");
  assert.equal(packet.rollback.targetTupleDigest, packet.exactPins.tupleDigest);
  assert.equal(packet.rollback.authorization, "OWNER_ONLY_REQUIRED");
  assert.equal(packet.rollback.executionStatus, "RECORDED_NOT_EXECUTED");
  assert.deepEqual(validatePacket(packet).projection, {
    schemaVersion: packet.schemaVersion,
    status: "CANDIDATE_READBACK",
    packetStatus: "DECISION_READY_INACTIVE",
    environmentClass: "LOCAL_SYNTHETIC_REPOSITORY_ONLY",
    decision: "UNDECIDED",
    nextOwnerOnlyDecision: "AUTHORIZE_OR_DECLINE_LIMITED_PRODUCTION_PILOT",
    noDeployment: true,
    approval: "NOT_CLAIMED",
    release: "NOT_RELEASED",
    publication: "NOT_PERFORMED",
    promotion: "NOT_PERFORMED",
    exactPins: packet.exactPins,
    policyGeneration: 17,
    evidenceRefs: packet.evidence.refs.map(({ id, reference, digest }) => ({ id, reference, digest })),
    limitations: packet.limitations,
    negativeResults: packet.negativeResults.map(({ case: caseName, reasonCode, outcome, effectCount }) => ({ case: caseName, reasonCode, outcome, effectCount })),
    rollback: { target: packet.rollback.target, targetTupleDigest: packet.rollback.targetTupleDigest, targetStatus: "LKG", authorization: "OWNER_ONLY_REQUIRED" },
    redacted: true,
  });
});

test("all declared fail-closed cases deny deterministically without an effect", () => {
  for (const [caseId, expectedReasonCode] of negativeCases) {
    const candidate = applyNegativeCase(packet, caseId);
    const first = validatePacket(candidate);
    const second = validatePacket(structuredClone(candidate));
    assert.equal(first.accepted, false, caseId);
    assert.equal(first.status, "DENIED", caseId);
    assert.equal(first.reasonCode, expectedReasonCode, caseId);
    assert.deepEqual(first, second, caseId);
    assert.equal(first.projection.redacted, true, caseId);
    assert.equal(JSON.stringify(first).includes("synthetic-tenant"), false, caseId);
    assert.equal(JSON.stringify(first).includes("synthetic-credential"), false, caseId);
  }
});

test("schema and runtime reject unknown, unsafe, approved, execute, publish, and promote claims", () => {
  const unknown = { ...structuredClone(packet), unlisted: true };
  assert.equal(validateSchema(unknown), false);
  assert.equal(validatePacket(unknown).reasonCode, "SCHEMA_DENIED");
  assert.equal(validatePacket(unsafe).accepted, false);
  assert.equal(validatePacket(unsafe).reasonCode, "PUBLIC_UNSAFE_MATERIAL_DENIED");
  assert.equal(JSON.stringify(validatePacket(unsafe)).includes("tenant"), false);
  assert.equal(JSON.stringify(validatePacket(unsafe)).includes("credential"), false);
});

test("the CLI emits a no-deployment candidate readback and expected invalid denial", () => {
  const first = cli(readyPath);
  const second = cli(readyPath);
  assert.deepEqual(first, second);
  assert.equal(first.status, "CANDIDATE_READBACK");
  assert.equal(first.noDeployment, true);
  assert.equal(first.decision, "UNDECIDED");
  assert.equal(first.nextOwnerOnlyDecision, "AUTHORIZE_OR_DECLINE_LIMITED_PRODUCTION_PILOT");
  assert.equal(first.approval, "NOT_CLAIMED");
  assert.equal(first.release, "NOT_RELEASED");
  assert.equal(first.publication, "NOT_PERFORMED");
  assert.equal(first.promotion, "NOT_PERFORMED");
  assert.deepEqual(cli(unsafePath, "--expect-invalid"), { status: "DENIED", reasonCode: "PUBLIC_UNSAFE_MATERIAL_DENIED", redacted: true });
});
