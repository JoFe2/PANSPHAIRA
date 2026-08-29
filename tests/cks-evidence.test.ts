import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import Ajv2020 from "ajv/dist/2020.js";
import {
  CKS_APPLICABILITY_BINDING_SCHEMA_V1,
  CKS_KNOWLEDGE_OBJECT_SCHEMA_V1,
  cksApplicabilityBindingDigestV1,
  cksKnowledgeObjectDigestV1,
  knowledgeEnvelopeDigestV1,
  knowledgeTaxonomyDigestV1,
  VERIFICATION_ATTESTATION_SCHEMA_V2,
  verificationAttestationDigestV2,
  type CksApplicabilityBindingV1,
  type CksKnowledgeObjectV1,
  type KnowledgeEnvelopeV1,
  type KnowledgeTaxonomyV1,
  type VerificationAttestationV2,
} from "../packages/contracts/src/index.js";
import {
  CKS_EVIDENCE_COVERAGE_SCHEMA_V1,
  CKS_EVIDENCE_DENIAL_REASONS_V1,
  CKS_EVIDENCE_PACK_SCHEMA_V1,
  CKS_EVIDENCE_STATES_V1,
  cksEvidenceCoverageDigestV1,
  cksEvidencePackDigestV1,
  validateCksEvidenceCoverageV1,
  validateCksEvidencePackV1,
  type CksEvidenceCoverageV1,
  type CksEvidenceEntryV1,
  type CksEvidencePackV1,
  type CksEvidenceStateV1,
} from "../packages/contracts/src/cks-evidence.js";

const DIGEST = "a".repeat(64);
const schema = (name: string): Record<string, unknown> => JSON.parse(readFileSync(`schemas/contracts/${name}`, "utf8"));
const djb2 = (text: string): number => { let hash = 5381; for (let index = 0; index < text.length; index += 1) hash = ((hash << 5) + hash + text.charCodeAt(index)) >>> 0; return hash; };

const CLAIM_A = "claim:cks-evidence-1";
const CLAIM_B = "claim:cks-evidence-2";
const TEST_A = "npm run contracts:gate";
const TEST_B = "npm run lint";
const emptyAuthority = () => ({ credentials: [] as [], policyApprovals: [] as [], capabilities: [] as [], toolAccess: [] as [], writeTargets: [] as [], executionRoutes: [] as [] });

const taxonomy = (): KnowledgeTaxonomyV1 => {
  const unsigned = { schemaVersion: "chimpmaera.knowledge/taxonomy/v1" as const, taxonomyId: "knowledge:cks-taxonomy", generation: 1, priorGeneration: null, kinds: ["PROCEDURE", "CLAIM", "OBSERVATION", "DEFINITION", "RELATIONSHIP", "UNRESOLVED"], migrations: [], compatibility: "STRICT_ADDITIVE_OR_EXPLICIT_RENAME" as const };
  return { ...unsigned, taxonomyDigest: knowledgeTaxonomyDigestV1(unsigned) };
};
const envelope = (): KnowledgeEnvelopeV1 => {
  const activeTaxonomy = taxonomy();
  const unsigned = {
    schemaVersion: "chimpmaera.knowledge/envelope/v1" as const, envelopeId: "knowledge:cks-pruning", taxonomy: { taxonomyId: activeTaxonomy.taxonomyId, generation: activeTaxonomy.generation, taxonomyDigest: activeTaxonomy.taxonomyDigest }, scope: { namespace: "synthetic:cks", audience: "PUBLIC_SYNTHETIC" as const }, kind: "PROCEDURE", statement: "Prune dormant synthetic orchard trees with clean tools.", attribution: [{ sourceId: "source:cks-fixture", citation: "Synthetic CKS fixture.", sourceDigest: DIGEST, observedAtMs: 1_000, licence: "CC0-1.0" as const }], epistemicStatus: "VERIFIED" as const, trust: "HIGH" as const, freshness: { assessedAtMs: 1_000, staleAfterMs: 2_000 }, sensitivity: "PUBLIC" as const, permittedUses: ["CURATED_READ", "KNOWLEDGE_GENERATION_CANDIDATE"] as const, conflictsWith: [] as string[], derivedFrom: [] as string[], generationCandidate: "ACCEPTED" as const, authority: emptyAuthority(), authorityBoundary: "READ_ONLY_KNOWLEDGE_NO_CREDENTIAL_POLICY_CAPABILITY_TOOL_WRITE_OR_EXECUTION_AUTHORITY" as const,
  };
  return { ...unsigned, envelopeDigest: knowledgeEnvelopeDigestV1(unsigned) };
};
const object = (): CksKnowledgeObjectV1 => {
  const source = envelope();
  const unsigned = { schemaVersion: CKS_KNOWLEDGE_OBJECT_SCHEMA_V1, objectId: "knowledge:cks-pruning-object", provenance: { envelopeId: source.envelopeId, envelopeDigest: source.envelopeDigest, scopeNamespace: source.scope.namespace }, knowledgeKind: "PROCEDURE" as const, qualificationLevel: "Q2" as const, maturityLevel: "L1" as const, complexityDimensions: ["R", "K"] as const, validity: { notBeforeMs: 1_000, notAfterMs: 2_000 }, status: "ACTIVE" as const, supersedes: [] as const, authority: emptyAuthority() };
  return { ...unsigned, objectDigest: cksKnowledgeObjectDigestV1(unsigned) };
};
const applicability = (): CksApplicabilityBindingV1 => {
  const target = object();
  const unsigned = { schemaVersion: CKS_APPLICABILITY_BINDING_SCHEMA_V1, object: { objectId: target.objectId, objectDigest: target.objectDigest }, scopeNamespace: "synthetic:cks", acceptedContext: { domain: ["orchard"] }, materialDimensions: ["domain"] as const, authority: emptyAuthority() };
  return { ...unsigned, applicabilityDigest: cksApplicabilityBindingDigestV1(unsigned) };
};
const attestation = (slot: "a" | "b", expiresAtMs = 3_000, nodeSuffix: string = slot): VerificationAttestationV2 => {
  const unsigned = { schemaVersion: VERIFICATION_ATTESTATION_SCHEMA_V2, nodeId: `verification:node-${nodeSuffix}`, nodeDigest: DIGEST, graphDigest: DIGEST, toolchainDigest: DIGEST, environmentDigest: DIGEST, createdAtMs: 1_000, expiresAtMs, testResults: [{ test: slot === "a" ? TEST_A : TEST_B, outcome: "PASS" as const }] };
  return { ...unsigned, attestationDigest: verificationAttestationDigestV2(unsigned) };
};
const conflictB = attestation("b", 3_000, "b-conflict");
const attestationResolver = (...values: VerificationAttestationV2[]): ReadonlyMap<string, VerificationAttestationV2> => new Map(
  values.map((value) => [value.attestationDigest, value]),
);
const defaultAttestationResolver = (): ReadonlyMap<string, VerificationAttestationV2> => attestationResolver(attestation("a"), attestation("b"), conflictB);
const defaultEvidence = (): readonly CksEvidenceEntryV1[] => [
  { claimId: CLAIM_A, attestationDigest: attestation("a").attestationDigest, attestedTest: TEST_A, expiresAtMs: 3_000 },
  { claimId: CLAIM_B, attestationDigest: attestation("b").attestationDigest, attestedTest: TEST_B },
];
const evidencePack = (claims: readonly string[] = [CLAIM_A, CLAIM_B], evidence: readonly CksEvidenceEntryV1[] = defaultEvidence()): CksEvidencePackV1 => {
  const target = object(), binding = applicability();
  const unsigned = { schemaVersion: CKS_EVIDENCE_PACK_SCHEMA_V1, packId: "evidence:cks-evidence-pack", object: { objectId: target.objectId, objectDigest: target.objectDigest }, applicabilityDigest: binding.applicabilityDigest, scopeNamespace: "synthetic:cks", claims: claims.map((claimId) => ({ claimId })), evidence: [...evidence], validity: { notBeforeMs: 1_000, notAfterMs: 2_000 }, authority: emptyAuthority() };
  return { ...unsigned, packDigest: cksEvidencePackDigestV1(unsigned) };
};
const evidenceCoverage = (pack: CksEvidencePackV1 = evidencePack(), evaluatedAtMs = 1_500, state: CksEvidenceStateV1 = "COMPLETE"): CksEvidenceCoverageV1 => {
  const unsigned = { schemaVersion: CKS_EVIDENCE_COVERAGE_SCHEMA_V1, coverageId: "evidence:cks-evidence-coverage", pack: { packId: pack.packId, packDigest: pack.packDigest }, scopeNamespace: "synthetic:cks", evaluatedAtMs, status: state, claims: pack.claims.map((claim) => ({ claimId: claim.claimId, state })), authority: emptyAuthority() };
  return { ...unsigned, coverageDigest: cksEvidenceCoverageDigestV1(unsigned) };
};
const scenarioPack = (claims: readonly string[], evidence: readonly Record<string, unknown>[]): Record<string, any> => {
  const target = object(), binding = applicability();
  const unsigned = { schemaVersion: CKS_EVIDENCE_PACK_SCHEMA_V1, packId: "evidence:cks-evidence-pack", object: { objectId: target.objectId, objectDigest: target.objectDigest }, applicabilityDigest: binding.applicabilityDigest, scopeNamespace: "synthetic:cks", claims: claims.map((claimId) => ({ claimId })), evidence: [...evidence], validity: { notBeforeMs: 1_000, notAfterMs: 2_000 }, authority: emptyAuthority() };
  return { ...unsigned, packDigest: cksEvidencePackDigestV1(unsigned) };
};
const scenarioCoverage = (pack: Record<string, any>, evaluatedAtMs: number, status: string, claimStates: readonly Record<string, unknown>[]): Record<string, any> => {
  const unsigned = { schemaVersion: CKS_EVIDENCE_COVERAGE_SCHEMA_V1, coverageId: "evidence:cks-evidence-coverage", pack: { packId: pack.packId, packDigest: pack.packDigest }, scopeNamespace: "synthetic:cks", evaluatedAtMs, status, claims: [...claimStates], authority: emptyAuthority() };
  return { ...unsigned, coverageDigest: cksEvidenceCoverageDigestV1(unsigned) };
};

const rehashObject = (value: Record<string, any>): void => { value.objectDigest = cksKnowledgeObjectDigestV1(value); };
const rehashApplicability = (value: Record<string, any>): void => { value.applicabilityDigest = cksApplicabilityBindingDigestV1(value); };
const rehashPack = (value: Record<string, any>): void => { value.packDigest = cksEvidencePackDigestV1(value); };
const rehashCoverage = (value: Record<string, any>): void => { value.coverageDigest = cksEvidenceCoverageDigestV1(value); };

test("CKS issue 281 Leaf-3 exact pack/coverage fixtures have closed schema and runtime parity", () => {
  const ajv = new Ajv2020({ allErrors: true, strict: true });
  const validatePackSchema = ajv.compile(schema("cks-evidence-pack-v1.schema.json"));
  const validateCoverageSchema = ajv.compile(schema("cks-evidence-coverage-v1.schema.json"));
  const target = object(), binding = applicability(), pack = evidencePack(), coverage = evidenceCoverage(pack);
  assert.deepEqual([...CKS_EVIDENCE_STATES_V1], ["COMPLETE", "CONFLICT", "MISSING", "STALE"]);
  assert.deepEqual([...CKS_EVIDENCE_DENIAL_REASONS_V1], ["SCHEMA_DENIED", "STALE_VERSION_DENIED", "AUTHORITY_DENIED", "DIGEST_TAMPERED_DENIED", "PROVENANCE_UNRESOLVED_DENIED", "VALIDITY_DENIED", "CLAIM_COVERAGE_MISMATCH_DENIED", "EVIDENCE_MISSING_DENIED", "EVIDENCE_CONFLICT_DENIED", "EVIDENCE_STALE_DENIED", "CLAIM_STATE_MISMATCH_DENIED", "APPLICABILITY_MISMATCH_DENIED", "SUBJECT_MISMATCH_DENIED", "CROSS_SCOPE_BINDING_DENIED"]);
  assert.equal(validatePackSchema(pack), true, JSON.stringify(validatePackSchema.errors));
  assert.equal(validateCoverageSchema(coverage), true, JSON.stringify(validateCoverageSchema.errors));
  assert.deepEqual(validateCksEvidencePackV1(pack, target, binding, defaultAttestationResolver()), []);
  assert.deepEqual(validateCksEvidenceCoverageV1(coverage, pack, defaultAttestationResolver()), []);
  assert.equal(pack.object.objectDigest, target.objectDigest);
  assert.equal(pack.applicabilityDigest, binding.applicabilityDigest);
  assert.equal(coverage.pack.packDigest, pack.packDigest);
  assert.equal(validatePackSchema({ ...pack, extra: true }), false);
  assert.equal(validateCoverageSchema({ ...coverage, extra: true }), false);
});

test("coverage denies a semantically modified evidence pack that retains its old pack digest", () => {
  const pack = structuredClone(evidencePack()) as Record<string, any>;
  const coverage = evidenceCoverage(pack as CksEvidencePackV1);
  pack.validity.notAfterMs = 1_900;
  assert.ok(validateCksEvidenceCoverageV1(coverage, pack, defaultAttestationResolver()).includes("DIGEST_TAMPERED_DENIED"));
});

test("CKS issue 281 Leaf-3 evidence entries reuse Verification Fabric v2 attestation digest identities", () => {
  const fresh = attestation("a");
  const target = object(), binding = applicability(), pack = evidencePack();
  assert.equal(pack.evidence[0]!.attestationDigest, fresh.attestationDigest);
  assert.equal(pack.evidence[0]!.attestedTest, TEST_A);
  assert.deepEqual(validateCksEvidencePackV1(pack, target, binding, defaultAttestationResolver()), []);
});

test("CKS issue 281 Leaf-3 evidence fails closed for fabricated, mismatched, and expired attestations", () => {
  const target = object(), binding = applicability(), pack = evidencePack();
  assert.ok(validateCksEvidencePackV1(pack, target, binding).includes("PROVENANCE_UNRESOLVED_DENIED"));

  const fabricated = structuredClone(pack) as Record<string, any>;
  fabricated.evidence[0].attestationDigest = DIGEST;
  rehashPack(fabricated);
  assert.ok(validateCksEvidencePackV1(fabricated, target, binding, defaultAttestationResolver()).includes("PROVENANCE_UNRESOLVED_DENIED"));

  const misresolved = structuredClone(pack) as Record<string, any>;
  misresolved.evidence[0].attestationDigest = DIGEST;
  rehashPack(misresolved);
  assert.ok(validateCksEvidencePackV1(
    misresolved,
    target,
    binding,
    new Map([[DIGEST, attestation("a")], [attestation("b").attestationDigest, attestation("b")]]),
  ).includes("DIGEST_TAMPERED_DENIED"));

  const mismatched = structuredClone(pack) as Record<string, any>;
  mismatched.evidence[0].attestedTest = TEST_B;
  rehashPack(mismatched);
  assert.ok(validateCksEvidencePackV1(mismatched, target, binding, defaultAttestationResolver()).includes("SUBJECT_MISMATCH_DENIED"));

  const expired = attestation("a", 1_400);
  const expiredPack = scenarioPack([CLAIM_A], [{ claimId: CLAIM_A, attestationDigest: expired.attestationDigest, attestedTest: TEST_A }]);
  const expiredCoverage = scenarioCoverage(expiredPack, 1_500, "COMPLETE", [{ claimId: CLAIM_A, state: "COMPLETE" }]);
  assert.ok(validateCksEvidenceCoverageV1(expiredCoverage, expiredPack, attestationResolver(expired)).includes("EVIDENCE_STALE_DENIED"));

  const extended = scenarioPack([CLAIM_A], [{ claimId: CLAIM_A, attestationDigest: expired.attestationDigest, attestedTest: TEST_A, expiresAtMs: 9_999 }]);
  assert.ok(validateCksEvidencePackV1(extended, target, binding, attestationResolver(expired)).includes("DIGEST_TAMPERED_DENIED"));
});

test("CKS issue 281 Leaf-3 canonical key and evidence-entry reorderings preserve one canonical digest and invariant results", () => {
  const target = object(), binding = applicability(), pack = evidencePack(), coverage = evidenceCoverage(pack);
  for (let replay = 0; replay < 100; replay += 1) {
    const reorder = <T>(value: T, salt: string): T => {
      if (Array.isArray(value)) {
        const shuffled = value.map((item, index) => ({ item, order: djb2(`${replay}:${salt}[${index}]`) })).sort((left, right) => left.order - right.order).map((entry) => entry.item);
        return shuffled.map((item, index) => reorder(item, `${salt}[${index}]`)) as T;
      }
      if (value !== null && typeof value === "object") {
        const record = value as Record<string, unknown>;
        return Object.fromEntries(Object.keys(record).sort((left, right) => { const a = djb2(`${replay}:${salt}.${left}`), b = djb2(`${replay}:${salt}.${right}`); return a === b ? left.localeCompare(right) : a - b; }).map((key) => [key, reorder(record[key], `${salt}.${key}`)])) as T;
      }
      return value;
    };
    const reorderedPack = reorder(pack, "pack"), reorderedCoverage = reorder(coverage, "coverage");
    assert.equal(cksEvidencePackDigestV1(reorderedPack), pack.packDigest, `pack:${replay}`);
    assert.equal(cksEvidenceCoverageDigestV1(reorderedCoverage), coverage.coverageDigest, `coverage:${replay}`);
    assert.deepEqual(validateCksEvidencePackV1(reorderedPack, target, binding, defaultAttestationResolver()), [], `pack:${replay}`);
    assert.deepEqual(validateCksEvidenceCoverageV1(reorderedCoverage, reorderedPack, defaultAttestationResolver()), [], `coverage:${replay}`);
  }
});

test("CKS issue 281 Leaf-3 COMPLETE requires valid evidence for every material claim and faithful conflict/missing/stale coverage is preserved", () => {
  const target = object(), binding = applicability();
  const freshA = attestation("a").attestationDigest, otherB = attestation("b").attestationDigest;
  const conflictPack = scenarioPack([CLAIM_A, CLAIM_B], [
    { claimId: CLAIM_A, attestationDigest: freshA, attestedTest: TEST_A, expiresAtMs: 3_000 },
    { claimId: CLAIM_B, attestationDigest: otherB, attestedTest: TEST_B },
    { claimId: CLAIM_B, attestationDigest: conflictB.attestationDigest, attestedTest: TEST_B },
  ]);
  assert.deepEqual(validateCksEvidenceCoverageV1(scenarioCoverage(conflictPack, 1_500, "CONFLICT", [{ claimId: CLAIM_A, state: "COMPLETE" }, { claimId: CLAIM_B, state: "CONFLICT" }]), conflictPack, defaultAttestationResolver()), []);
  const missingPack = scenarioPack([CLAIM_A, "claim:cks-evidence-3"], [
    { claimId: CLAIM_A, attestationDigest: freshA, attestedTest: TEST_A, expiresAtMs: 3_000 },
  ]);
  assert.deepEqual(validateCksEvidenceCoverageV1(scenarioCoverage(missingPack, 1_500, "MISSING", [{ claimId: CLAIM_A, state: "COMPLETE" }, { claimId: "claim:cks-evidence-3", state: "MISSING" }]), missingPack, defaultAttestationResolver()), []);
  const stalePack = scenarioPack([CLAIM_A, "claim:cks-evidence-4"], [
    { claimId: CLAIM_A, attestationDigest: freshA, attestedTest: TEST_A, expiresAtMs: 3_000 },
    { claimId: "claim:cks-evidence-4", attestationDigest: attestation("b", 1_400).attestationDigest, attestedTest: TEST_B, expiresAtMs: 1_400 },
  ]);
  assert.deepEqual(validateCksEvidenceCoverageV1(scenarioCoverage(stalePack, 1_500, "STALE", [{ claimId: CLAIM_A, state: "COMPLETE" }, { claimId: "claim:cks-evidence-4", state: "STALE" }]), stalePack, attestationResolver(attestation("a"), attestation("b", 1_400))), []);
});

test("CKS issue 281 Leaf-3 unknown fields, stale versions, digest drift, stale evidence, missing or duplicate claim coverage, conflict, applicability, subject mismatch, cross-scope binding and authority deny", () => {
  const target = object(), binding = applicability(), basePack = evidencePack(), baseCoverage = evidenceCoverage(basePack);
  const cases: Array<{ name: string; validate: () => readonly string[]; expected: string }> = [];
  const packUnknown = structuredClone(basePack) as Record<string, any>;
  packUnknown.extra = true;
  cases.push({ name: "pack:unknown-field", validate: () => validateCksEvidencePackV1(packUnknown, target, binding, defaultAttestationResolver()), expected: "SCHEMA_DENIED" });
  const packStale = structuredClone(basePack) as Record<string, any>;
  packStale.schemaVersion = "chimpmaera.cks/evidence-pack/v0";
  rehashPack(packStale);
  cases.push({ name: "pack:stale-version", validate: () => validateCksEvidencePackV1(packStale, target, binding, defaultAttestationResolver()), expected: "STALE_VERSION_DENIED" });
  const packDrift = structuredClone(basePack) as Record<string, any>;
  packDrift.packDigest = DIGEST;
  cases.push({ name: "pack:digest-drift", validate: () => validateCksEvidencePackV1(packDrift, target, binding, defaultAttestationResolver()), expected: "DIGEST_TAMPERED_DENIED" });
  const packAuthority = structuredClone(basePack) as Record<string, any>;
  packAuthority.authority.credentials = ["credential:forbidden"];
  rehashPack(packAuthority);
  cases.push({ name: "pack:authority", validate: () => validateCksEvidencePackV1(packAuthority, target, binding, defaultAttestationResolver()), expected: "AUTHORITY_DENIED" });
  const secondTarget = structuredClone(target) as Record<string, any>;
  secondTarget.objectId = "knowledge:cks-evidence-object-2";
  rehashObject(secondTarget);
  cases.push({ name: "pack:provenance-unresolved", validate: () => validateCksEvidencePackV1(basePack, secondTarget as CksKnowledgeObjectV1, binding, defaultAttestationResolver()), expected: "PROVENANCE_UNRESOLVED_DENIED" });
  const otherBinding = structuredClone(binding) as Record<string, any>;
  otherBinding.object = { objectId: secondTarget.objectId, objectDigest: secondTarget.objectDigest };
  rehashApplicability(otherBinding);
  cases.push({ name: "pack:applicability-mismatch", validate: () => validateCksEvidencePackV1(basePack, target, otherBinding as CksApplicabilityBindingV1, defaultAttestationResolver()), expected: "APPLICABILITY_MISMATCH_DENIED" });
  const packCrossScope = structuredClone(basePack) as Record<string, any>;
  packCrossScope.scopeNamespace = "synthetic:other";
  rehashPack(packCrossScope);
  cases.push({ name: "pack:cross-scope", validate: () => validateCksEvidencePackV1(packCrossScope, target, binding, defaultAttestationResolver()), expected: "CROSS_SCOPE_BINDING_DENIED" });
  const packInvalidValidity = structuredClone(basePack) as Record<string, any>;
  packInvalidValidity.validity.notAfterMs = 999;
  rehashPack(packInvalidValidity);
  cases.push({ name: "pack:invalid-validity", validate: () => validateCksEvidencePackV1(packInvalidValidity, target, binding, defaultAttestationResolver()), expected: "VALIDITY_DENIED" });
  const packUnknownClaim = structuredClone(basePack) as Record<string, any>;
  packUnknownClaim.evidence = [...packUnknownClaim.evidence, { claimId: "claim:cks-evidence-x", attestationDigest: DIGEST, attestedTest: TEST_B }];
  rehashPack(packUnknownClaim);
  cases.push({ name: "pack:unknown-claim-evidence", validate: () => validateCksEvidencePackV1(packUnknownClaim, target, binding, defaultAttestationResolver()), expected: "SUBJECT_MISMATCH_DENIED" });
  const freshA = attestation("a").attestationDigest, otherB = attestation("b").attestationDigest;
  const stalePack = scenarioPack([CLAIM_A, "claim:cks-evidence-4"], [
    { claimId: CLAIM_A, attestationDigest: freshA, attestedTest: TEST_A, expiresAtMs: 3_000 },
    { claimId: "claim:cks-evidence-4", attestationDigest: attestation("b", 1_400).attestationDigest, attestedTest: TEST_B, expiresAtMs: 1_400 },
  ]);
  cases.push({ name: "coverage:stale-evidence", validate: () => validateCksEvidenceCoverageV1(scenarioCoverage(stalePack, 1_500, "COMPLETE", [{ claimId: CLAIM_A, state: "COMPLETE" }, { claimId: "claim:cks-evidence-4", state: "COMPLETE" }]), stalePack, attestationResolver(attestation("a"), attestation("b", 1_400))), expected: "EVIDENCE_STALE_DENIED" });
  const conflictPack = scenarioPack([CLAIM_A, CLAIM_B], [
    { claimId: CLAIM_A, attestationDigest: freshA, attestedTest: TEST_A, expiresAtMs: 3_000 },
    { claimId: CLAIM_B, attestationDigest: otherB, attestedTest: TEST_B },
    { claimId: CLAIM_B, attestationDigest: conflictB.attestationDigest, attestedTest: TEST_B },
  ]);
  cases.push({ name: "coverage:conflict", validate: () => validateCksEvidenceCoverageV1(scenarioCoverage(conflictPack, 1_500, "COMPLETE", [{ claimId: CLAIM_A, state: "COMPLETE" }, { claimId: CLAIM_B, state: "COMPLETE" }]), conflictPack, defaultAttestationResolver()), expected: "EVIDENCE_CONFLICT_DENIED" });
  const missingPack = scenarioPack([CLAIM_A, "claim:cks-evidence-3"], [
    { claimId: CLAIM_A, attestationDigest: freshA, attestedTest: TEST_A, expiresAtMs: 3_000 },
  ]);
  cases.push({ name: "coverage:missing-evidence", validate: () => validateCksEvidenceCoverageV1(scenarioCoverage(missingPack, 1_500, "COMPLETE", [{ claimId: CLAIM_A, state: "COMPLETE" }, { claimId: "claim:cks-evidence-3", state: "COMPLETE" }]), missingPack, defaultAttestationResolver()), expected: "EVIDENCE_MISSING_DENIED" });
  const falseState = scenarioCoverage(basePack, 1_500, "STALE", [{ claimId: CLAIM_A, state: "STALE" }, { claimId: CLAIM_B, state: "COMPLETE" }]);
  cases.push({ name: "coverage:false-state", validate: () => validateCksEvidenceCoverageV1(falseState, basePack, defaultAttestationResolver()), expected: "CLAIM_STATE_MISMATCH_DENIED" });
  const missingClaim = scenarioCoverage(basePack, 1_500, "COMPLETE", [{ claimId: CLAIM_A, state: "COMPLETE" }]);
  cases.push({ name: "coverage:missing-claim", validate: () => validateCksEvidenceCoverageV1(missingClaim, basePack, defaultAttestationResolver()), expected: "CLAIM_COVERAGE_MISMATCH_DENIED" });
  const duplicateClaim = scenarioCoverage(basePack, 1_500, "COMPLETE", [{ claimId: CLAIM_A, state: "COMPLETE" }, { claimId: CLAIM_A, state: "STALE" }]);
  cases.push({ name: "coverage:duplicate-claim", validate: () => validateCksEvidenceCoverageV1(duplicateClaim, basePack, defaultAttestationResolver()), expected: "CLAIM_COVERAGE_MISMATCH_DENIED" });
  const evaluatedOutside = scenarioCoverage(basePack, 9_999, "COMPLETE", [{ claimId: CLAIM_A, state: "COMPLETE" }, { claimId: CLAIM_B, state: "COMPLETE" }]);
  cases.push({ name: "coverage:evaluated-outside-validity", validate: () => validateCksEvidenceCoverageV1(evaluatedOutside, basePack, defaultAttestationResolver()), expected: "VALIDITY_DENIED" });
  const coverageCrossScope = structuredClone(baseCoverage) as Record<string, any>;
  coverageCrossScope.scopeNamespace = "synthetic:other";
  rehashCoverage(coverageCrossScope);
  cases.push({ name: "coverage:cross-scope", validate: () => validateCksEvidenceCoverageV1(coverageCrossScope, basePack, defaultAttestationResolver()), expected: "CROSS_SCOPE_BINDING_DENIED" });
  const packReferenceDrift = structuredClone(baseCoverage) as Record<string, any>;
  packReferenceDrift.pack.packDigest = DIGEST;
  rehashCoverage(packReferenceDrift);
  cases.push({ name: "coverage:pack-reference-drift", validate: () => validateCksEvidenceCoverageV1(packReferenceDrift, basePack, defaultAttestationResolver()), expected: "DIGEST_TAMPERED_DENIED" });
  const coverageAuthority = structuredClone(baseCoverage) as Record<string, any>;
  coverageAuthority.authority.credentials = ["credential:forbidden"];
  rehashCoverage(coverageAuthority);
  cases.push({ name: "coverage:authority", validate: () => validateCksEvidenceCoverageV1(coverageAuthority, basePack, defaultAttestationResolver()), expected: "AUTHORITY_DENIED" });
  for (const probe of cases) assert.ok(probe.validate().includes(probe.expected), `${probe.name}:${JSON.stringify(probe.validate())}`);
});

test("CKS issue 281 Leaf-3 unsafe integer timestamps deny with schema and runtime parity", () => {
  const ajv = new Ajv2020({ allErrors: true, strict: true });
  const validatePackSchema = ajv.compile(schema("cks-evidence-pack-v1.schema.json"));
  const validateCoverageSchema = ajv.compile(schema("cks-evidence-coverage-v1.schema.json"));
  const target = object(), binding = applicability();
  const unsafeInteger = Number.MAX_SAFE_INTEGER + 1;
  const notBefore = structuredClone(evidencePack()) as Record<string, any>;
  notBefore.validity.notBeforeMs = unsafeInteger;
  rehashPack(notBefore);
  const notAfter = structuredClone(evidencePack()) as Record<string, any>;
  notAfter.validity.notAfterMs = unsafeInteger;
  rehashPack(notAfter);
  const evaluatedAt = structuredClone(evidenceCoverage()) as Record<string, any>;
  evaluatedAt.evaluatedAtMs = unsafeInteger;
  rehashCoverage(evaluatedAt);
  const probes = [
    { name: "notBeforeMs", value: notBefore, schemaValidate: validatePackSchema, runtimeValidate: () => validateCksEvidencePackV1(notBefore, target, binding) },
    { name: "notAfterMs", value: notAfter, schemaValidate: validatePackSchema, runtimeValidate: () => validateCksEvidencePackV1(notAfter, target, binding) },
    { name: "evaluatedAtMs", value: evaluatedAt, schemaValidate: validateCoverageSchema, runtimeValidate: () => validateCksEvidenceCoverageV1(evaluatedAt, evidencePack()) },
  ];
  for (const probe of probes) {
    assert.equal(probe.schemaValidate(probe.value), false, `${probe.name}:schema accepted ${unsafeInteger}`);
    assert.deepEqual(probe.runtimeValidate(), ["SCHEMA_DENIED"], `${probe.name}:runtime`);
  }
});