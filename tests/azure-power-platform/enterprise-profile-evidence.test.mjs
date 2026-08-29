import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import Ajv2020 from "ajv/dist/2020.js";
import {
  applyNegativeCase,
  digestJson,
  loadFixture,
  validateEnterpriseProfileEvidence,
} from "../../tools/azure-power-platform/validate-enterprise-profile-evidence.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const schema = JSON.parse(await readFile(path.join(root, "docs/development/azure-power-platform/enterprise-profile-evidence.schema.json"), "utf8"));
const validateSchema = new Ajv2020({ allErrors: true, strict: true }).compile(schema);
const validPacket = await loadFixture("tests/fixtures/azure-power-platform/enterprise-profile-valid.json", root);
const incompletePacket = await loadFixture("tests/fixtures/azure-power-platform/enterprise-profile-incomplete.json", root);

const expectedNegativeReasons = new Map([
  ["incomplete-evidence", "INCOMPLETE_EVIDENCE_DENIED"],
  ["cross-tuple-mismatch", "CROSS_TUPLE_MISMATCH_DENIED"],
  ["production-readiness-assertion", "PRODUCTION_READINESS_DENIED"],
  ["unidentified-authority", "AUTHORITY_IDENTITY_DENIED"],
  ["omitted-limitation", "LIMITATION_MISSING_DENIED"],
  ["public-unsafe-material", "PUBLIC_UNSAFE_MATERIAL_DENIED"],
  ["capability-as-authority", "CAPABILITY_BYTES_AUTHORITY_DENIED"],
  ["package-as-authority", "PACKAGE_AUTHORITY_DENIED"],
  ["no-release-as-authority", "NO_RELEASE_AUTHORITY_DENIED"],
  ["missing-reset-residue-proof", "ZERO_OWNED_RESIDUE_DENIED"],
  ["missing-policy-generation", "POLICY_GENERATION_DENIED"],
  ["missing-rollback-target", "ROLLBACK_TARGET_DENIED"],
]);

test("accepts a schema-valid synthetic candidate and exposes no eligibility claim", () => {
  assert.equal(validateSchema(validPacket), true, JSON.stringify(validateSchema.errors));
  const result = validateEnterpriseProfileEvidence(validPacket);
  assert.equal(result.accepted, true, JSON.stringify(result));
  assert.equal(result.status, "VALIDATED");
  assert.equal(result.report.packetStatus, "CANDIDATE_ONLY");
  assert.equal(result.report.environmentClass, "LOCAL_SYNTHETIC_REPOSITORY_ONLY");
  assert.equal(result.report.policy.generation, 17);
  assert.equal(result.report.zeroOwnedResidue, true);
  assert.deepEqual(result.report.nonValidatedClaims, ["TENANT_VALIDATION", "RUNTIME_VALIDATION", "PRODUCTION_VALIDATION", "ENTERPRISE_READINESS", "CLOUD_CONFIGURATION"]);
  assert.equal(result.report.publicClosure.release, "NOT_RELEASED");
  assert.equal(result.report.redacted, true);
});

test("binds the full tuple and evidence bundle to canonical immutable digests", () => {
  assert.equal(validPacket.fullTuple.digest, digestJson({ environmentClass: validPacket.environmentClass, policy: validPacket.policy, components: validPacket.components }));
  assert.equal(validPacket.evidence.bundleDigest, digestJson(validPacket.evidence.refs));
  assert.equal(validPacket.resetUninstall.receipt.receiptDigest, digestJson({
    operationId: validPacket.resetUninstall.receipt.operationId,
    eventDigest: validPacket.resetUninstall.receipt.eventDigest,
    readbackDigest: validPacket.resetUninstall.receipt.readbackDigest,
    status: validPacket.resetUninstall.receipt.status,
    effectCount: 0,
  }));
  for (const [domain, artifact] of Object.entries(validPacket.components)) {
    assert.deepEqual(validPacket[domain].artifact, artifact, domain);
    assert.match(artifact.digest, /^[a-f0-9]{64}$/);
    assert.match(artifact.version, /^\d+\.\d+\.\d+$/);
  }
  assert.equal(validPacket.lkg.fullTupleDigest, validPacket.fullTuple.digest);
  assert.equal(validPacket.rollback.targetFullTupleDigest, validPacket.lkg.fullTupleDigest);
  assert.equal(validPacket.resetUninstall.reset.targetTupleDigest, validPacket.lkg.fullTupleDigest);
});

test("rejects the incomplete packet at both schema and runtime boundaries", () => {
  assert.equal(validateSchema(incompletePacket), false);
  const result = validateEnterpriseProfileEvidence(incompletePacket);
  assert.equal(result.accepted, false);
  assert.equal(result.reasonCode, "SCHEMA_DENIED");
  assert.deepEqual(result.report, { status: "DENIED", reasonCode: "SCHEMA_DENIED", redacted: true });
});

test("rejects every declared fail-closed escalation without producing an effect", () => {
  for (const [caseId, expectedReasonCode] of expectedNegativeReasons) {
    const candidate = applyNegativeCase(validPacket, caseId);
    const first = validateEnterpriseProfileEvidence(candidate);
    const second = validateEnterpriseProfileEvidence(structuredClone(candidate));
    assert.equal(first.accepted, false, caseId);
    assert.equal(first.reasonCode, expectedReasonCode, caseId);
    assert.deepEqual(first, second, caseId);
    assert.equal(first.report.redacted, true, caseId);
    assert.equal(JSON.stringify(first).includes("https://"), false, caseId);
  }
});

test("does not accept a capability, package, or no-release decision as authority", () => {
  for (const caseId of ["capability-as-authority", "package-as-authority", "no-release-as-authority"]) {
    const result = validateEnterpriseProfileEvidence(applyNegativeCase(validPacket, caseId));
    assert.equal(result.accepted, false, caseId);
    assert.match(result.reasonCode, /AUTHORITY|RELEASE/);
  }
  assert.equal(validPacket.authorityBoundary.importExecutionAuthorized, false);
  assert.equal(validPacket.authorityBoundary.publicationAuthorized, false);
  assert.equal(validPacket.authorityBoundary.promotionAuthorized, false);
  assert.equal(validPacket.authorityBoundary.rollbackAuthorized, false);
});

test("binds each separately authorized next action to its named owner", () => {
  const candidate = structuredClone(validPacket);
  candidate.nextActions.find((action) => action.action === "IMPORT").ownerAuthority = "opaque-authority-import-999";
  const result = validateEnterpriseProfileEvidence(candidate);
  assert.equal(result.accepted, false);
  assert.equal(result.reasonCode, "OWNER_ONLY_ACTION_DENIED");
});

test("rejects an LKG or rollback target that does not name the exact full tuple", () => {
  const candidate = structuredClone(validPacket);
  candidate.lkg.fullTupleDigest = "f".repeat(64);
  const result = validateEnterpriseProfileEvidence(candidate);
  assert.equal(result.accepted, false);
  assert.equal(result.reasonCode, "ROLLBACK_TARGET_DENIED");
});

test("keeps public closure linked while explicitly recording that no release exists", () => {
  const closure = validPacket.publicClosure;
  assert.equal(closure.planningArtifact.status, "LINKED");
  assert.equal(closure.planningPr.status, "LINKED");
  assert.ok(closure.implementationPrs.length >= 1);
  assert.equal(closure.publicReadback.status, "LINKED");
  assert.deepEqual(closure.release, { status: "NOT_RELEASED", reference: null, digest: null, reason: "CANDIDATE_ONLY_NO_RELEASE" });
  assert.equal(validateEnterpriseProfileEvidence(validPacket).accepted, true);
});
