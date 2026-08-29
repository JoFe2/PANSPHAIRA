import assert from "node:assert/strict";
import test from "node:test";
import {
  CKS_APPLICABILITY_BINDING_SCHEMA_V1,
  CKS_BINDING_NAMES_V1,
  CKS_COMPETENCE_QUALIFICATION_PROFILE_SCHEMA_V1,
  CKS_COMPLEXITY_DIMENSIONS_V1,
  CKS_EVIDENCE_COVERAGE_SCHEMA_V1,
  CKS_EVIDENCE_PACK_SCHEMA_V1,
  CKS_EVIDENCE_STATES_V1,
  CKS_ESCALATION_SCHEMA_V1,
  CKS_KNOWLEDGE_OBJECT_SCHEMA_V1,
  CKS_KNOWLEDGE_QUERY_SCHEMA_V1,
  CKS_MATURITY_LEVELS_V1,
  CKS_NONCLAIMS_V1,
  CKS_QUALIFICATION_LEVELS_V1,
  CKS_VOCABULARY_SCHEMA_V1,
  VERIFICATION_ATTESTATION_SCHEMA_V2,
  cksEvidencePackDigestV1,
  verificationAttestationDigestV2,
  type CksEvidencePackV1,
} from "../packages/contracts/src/index.js";

const DIGEST = "a".repeat(64);
const emptyAuthority = () => ({
  credentials: [] as [], policyApprovals: [] as [], capabilities: [] as [],
  toolAccess: [] as [], writeTargets: [] as [], executionRoutes: [] as [],
});

test("CKS issue 281 adds vocabulary, knowledge and evidence while reusing the published CKS-06 qualification contracts", () => {
  assert.deepEqual([
    CKS_VOCABULARY_SCHEMA_V1,
    CKS_KNOWLEDGE_OBJECT_SCHEMA_V1,
    CKS_KNOWLEDGE_QUERY_SCHEMA_V1,
    CKS_APPLICABILITY_BINDING_SCHEMA_V1,
    CKS_EVIDENCE_PACK_SCHEMA_V1,
    CKS_EVIDENCE_COVERAGE_SCHEMA_V1,
  ], [
    "chimpmaera.cks/vocabulary/v1",
    "chimpmaera.cks/knowledge-object/v1",
    "chimpmaera.cks/knowledge-query/v1",
    "chimpmaera.cks/applicability/v1",
    "chimpmaera.cks/evidence-pack/v1",
    "chimpmaera.cks/evidence-coverage/v1",
  ]);
  assert.equal(CKS_COMPETENCE_QUALIFICATION_PROFILE_SCHEMA_V1, "chimpmaera.dev/cks-competence-qualification-profile/v1");
  assert.equal(CKS_ESCALATION_SCHEMA_V1, "chimpmaera.dev/cks-escalation/v1");
  assert.ok(CKS_BINDING_NAMES_V1.includes("knowledge"));
  assert.deepEqual([...CKS_QUALIFICATION_LEVELS_V1], ["Q0", "Q1", "Q2", "Q3", "Q4", "Q5", "Q6"]);
  assert.deepEqual([...CKS_MATURITY_LEVELS_V1], ["L0", "L1", "L2", "L3", "L4", "L5", "L6"]);
  assert.deepEqual([...CKS_COMPLEXITY_DIMENSIONS_V1], ["R", "K", "P", "U"]);
  assert.deepEqual([...CKS_EVIDENCE_STATES_V1], ["COMPLETE", "CONFLICT", "MISSING", "STALE"]);
  assert.ok(CKS_NONCLAIMS_V1.includes("NO_QUALIFICATION_ASSESSMENT_SEMANTICS"));
  assert.ok(CKS_NONCLAIMS_V1.includes("NO_ESCALATION_SEMANTICS"));
});

test("CKS issue 281 evidence reuses the exact Verification Fabric attestation identity", () => {
  const attestationUnsigned = {
    schemaVersion: VERIFICATION_ATTESTATION_SCHEMA_V2,
    nodeId: "verification:cks-integration", nodeDigest: DIGEST, graphDigest: DIGEST,
    toolchainDigest: DIGEST, environmentDigest: DIGEST, createdAtMs: 1_000,
    testResults: [{ test: "npm run cks:test", outcome: "PASS" as const }],
  };
  const attestation = { ...attestationUnsigned, attestationDigest: verificationAttestationDigestV2(attestationUnsigned) };
  const packUnsigned = {
    schemaVersion: CKS_EVIDENCE_PACK_SCHEMA_V1,
    packId: "evidence:cks-integration-pack",
    object: { objectId: "knowledge:cks-integration-object", objectDigest: DIGEST },
    applicabilityDigest: DIGEST, scopeNamespace: "synthetic:cks-integration",
    claims: [{ claimId: "claim:cks-integration" }],
    evidence: [{ claimId: "claim:cks-integration", attestationDigest: attestation.attestationDigest, attestedTest: "npm run cks:test" }],
    validity: { notBeforeMs: 1_000, notAfterMs: 2_000 }, authority: emptyAuthority(),
  };
  const pack = { ...packUnsigned, packDigest: cksEvidencePackDigestV1(packUnsigned) } as CksEvidencePackV1;
  assert.equal(pack.evidence[0]?.attestationDigest, attestation.attestationDigest);
  assert.equal(pack.packDigest, cksEvidencePackDigestV1(pack));
});
