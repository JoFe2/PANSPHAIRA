import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import Ajv2020 from "ajv/dist/2020.js";
import { applyNegativeCase, loadFixture, validateCompatibilityMigration } from "../../tools/azure-power-platform/validate-compatibility-migration.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const validPath = "tests/fixtures/azure-power-platform/compatibility-valid.json";
const revokedPath = "tests/fixtures/azure-power-platform/compatibility-revoked.json";
const schema = JSON.parse(await readFile(path.join(root, "contracts/azure-power-platform/compatibility-migration.schema.json"), "utf8"));
const validateSchema = new Ajv2020({ allErrors: true, strict: true }).compile(schema);
const valid = await loadFixture(validPath, root);
const revoked = await loadFixture(revokedPath, root);
const negativeCases = [
  ["unknown-schema", "SCHEMA_VERSION_DENIED"],
  ["unknown-field", "UNKNOWN_FIELD_DENIED"],
  ["unknown-action", "UNKNOWN_ACTION_DENIED"],
  ["hidden-write", "HIDDEN_WRITE_DENIED"],
  ["self-approval", "SELF_APPROVAL_DENIED"],
  ["digest-drift", "DIGEST_DRIFT_DENIED"],
  ["replay", "REPLAY_DENIED"],
  ["expiry", "EXPIRY_DENIED"],
  ["revocation", "REVOCATION_DENIED"],
  ["stale-policy", "STALE_POLICY_DENIED"],
  ["missing-migration-edge", "MIGRATION_EDGE_DENIED"],
  ["incompatible-version", "INCOMPATIBLE_VERSION_DENIED"],
  ["mutable-latest-reference", "MUTABLE_VERSION_DENIED"],
  ["authority-change", "AUTHORITY_CHANGE_DENIED"],
  ["irreversible-transition", "IRREVERSIBLE_TRANSITION_DENIED"],
  ["missing-exact-rollback", "ROLLBACK_TARGET_DENIED"],
];

test("accepts only the exact shared full tuple and emits a deterministic local no-op readback", () => {
  assert.equal(validateSchema(valid), true, JSON.stringify(validateSchema.errors));
  const first = validateCompatibilityMigration(valid);
  const second = validateCompatibilityMigration(structuredClone(valid));
  assert.equal(first.accepted, true, JSON.stringify(first));
  assert.deepEqual(first, second);
  assert.deepEqual(first.projection, {
    status: "ALLOWED",
    reasonCode: "COMPATIBILITY_MIGRATION_ALLOWED",
    environmentClass: "LOCAL_SYNTHETIC_REPOSITORY_ONLY",
    fullTupleDigest: "da3e8e1b731a5ae80635b960eaae77cc16d755fe44d7303f298a05cf1867631d",
    component: valid.tuple.component,
    schema: valid.tuple.schema,
    policy: valid.tuple.policy,
    source: valid.tuple.source,
    target: valid.tuple.target,
    compatibilityResult: "COMPATIBLE",
    migrationEdge: "synthetic-power-platform-component-1.0.0-to-1.1.0",
    rollbackTarget: valid.tuple.lkg.digest,
    evidenceRefs: ["evidence-001", "evidence-002", "evidence-003", "evidence-004", "evidence-005"],
    limitations: valid.limitations,
    negativeReasonCodes: valid.negativeResults.map((item) => item.reasonCode),
    externalMutationPerformed: false,
  });
  assert.equal(valid.migration.transition, "NO_OP_FORWARD_COMPATIBLE");
  assert.equal(valid.migration.effectCount, 0);
  assert.equal(valid.tuple.source.status, "ACCEPTED");
  assert.equal(valid.tuple.target.status, "ACCEPTED");
  assert.equal(valid.tuple.lkg.status, "LKG");
  assert.equal(valid.rollback.targetDigest, valid.tuple.lkg.digest);
});

test("the revoked fixture produces a local deterministic denial before any sandbox action", () => {
  assert.deepEqual(revoked, {
    schemaVersion: "pansphaira.azure-power-platform/compatibility-migration-revoked-fixture/v1",
    fixtureKind: "REVOKED",
    baseFixture: validPath,
    revocationState: "REVOKED",
    expectedReasonCode: "REVOCATION_DENIED",
  });
  const candidate = structuredClone(valid);
  candidate.admission.revocationState = revoked.revocationState;
  assert.equal(validateSchema(candidate), true, JSON.stringify(validateSchema.errors));
  const first = validateCompatibilityMigration(candidate);
  const second = validateCompatibilityMigration(structuredClone(candidate));
  assert.equal(first.accepted, false);
  assert.equal(first.reasonCode, revoked.expectedReasonCode);
  assert.deepEqual(first, second);
  assert.deepEqual(first.projection, { status: "DENIED", reasonCode: "REVOCATION_DENIED" });
});

test("unknown, stale, irreversible, mutable, replayed, expired, revoked, and write-bearing candidates fail closed", () => {
  for (const [caseId, expectedReasonCode] of negativeCases) {
    const candidate = applyNegativeCase(valid, caseId);
    const first = validateCompatibilityMigration(candidate);
    const second = validateCompatibilityMigration(structuredClone(candidate));
    assert.equal(first.accepted, false, caseId);
    assert.equal(first.status, "DENIED", caseId);
    assert.equal(first.reasonCode, expectedReasonCode, caseId);
    assert.deepEqual(first, second, caseId);
    assert.deepEqual(first.projection, { status: "DENIED", reasonCode: expectedReasonCode }, caseId);
  }
});

test("schema and runtime reject added fields, and the readback records the required closed evidence", () => {
  const unknown = { ...structuredClone(valid), unlisted: true };
  assert.equal(validateSchema(unknown), false);
  assert.equal(validateCompatibilityMigration(unknown).reasonCode, "UNKNOWN_FIELD_DENIED");
  const result = validateCompatibilityMigration(valid);
  assert.equal(result.accepted, true);
  assert.deepEqual(result.projection.evidenceRefs, valid.evidence.refs.map((ref) => ref.id));
  assert.equal(result.projection.policy.generation, 12);
  assert.equal(result.projection.rollbackTarget, valid.tuple.lkg.digest);
  assert.equal(result.projection.negativeReasonCodes.length, 16);
  assert.equal(result.projection.externalMutationPerformed, false);
});
