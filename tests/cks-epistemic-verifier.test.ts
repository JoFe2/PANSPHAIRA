import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import Ajv2020 from "ajv/dist/2020.js";
import {
  CKS_DETERMINISTIC_VERIFIER_ID_V1,
  CKS_SEMANTIC_VERIFIER_ID_V1,
  competenceResponseDigestV1,
  validateCksEpistemicVerificationCaseV1,
  validateCksVerificationReceiptV1,
  verificationCaseDigestV1,
  verificationReceiptDigestV1,
  verifyCksEpistemicCaseV1,
  type CksEpistemicVerificationCaseV1,
} from "../packages/contracts/src/cks-epistemic-verifier.js";
import { evidencePackDigestV1, knowledgeQueryRequestDigestV1 } from "../packages/contracts/src/cks-competence-runtime.js";

const rawFixture = JSON.parse(readFileSync("tests/fixtures/cks-04/verification-cases-v1.json", "utf8")) as {
  schemaVersion: string;
  fixtureId: string;
  fixtureVersion: string;
  cases: CksEpistemicVerificationCaseV1[];
};

function materialize(raw: CksEpistemicVerificationCaseV1): CksEpistemicVerificationCaseV1 {
  const value = structuredClone(raw) as any;
  for (const request of value.requests) request.requestDigest = knowledgeQueryRequestDigestV1(request);
  for (const pack of value.evidencePacks) {
    const request = value.requests.find((candidate) => candidate.requestId === pack.request.requestId);
    assert.ok(request);
    pack.request.requestDigest = request.requestDigest;
    pack.packDigest = evidencePackDigestV1(pack);
  }
  value.response.responseDigest = competenceResponseDigestV1(value.response);
  value.caseDigest = verificationCaseDigestV1(value);
  return value;
}

const positive = (): CksEpistemicVerificationCaseV1 => materialize(rawFixture.cases[0]!);

function rehash(value: CksEpistemicVerificationCaseV1): CksEpistemicVerificationCaseV1 {
  value.response.responseDigest = competenceResponseDigestV1(value.response);
  for (const pack of value.evidencePacks) pack.packDigest = evidencePackDigestV1(pack);
  value.caseDigest = verificationCaseDigestV1(value);
  return value;
}

test("CKS-04 deterministic verifier passes unknown synthetic fact and procedure with complete coverage", () => {
  const input = positive();
  assert.equal(validateCksEpistemicVerificationCaseV1(input), true);
  const result = verifyCksEpistemicCaseV1(input);
  assert.equal(result.outcome, "PASS");
  assert.ok(result.receipt);
  assert.equal(validateCksVerificationReceiptV1(result.receipt), true);
  assert.deepEqual(result.receipt.claimCoverage.map((claim) => claim.covered), [true, true]);
  assert.deepEqual(result.receipt.procedureCoverage.map((step) => step.covered), [true]);
  assert.equal(result.receipt.verifier.verifierId, CKS_DETERMINISTIC_VERIFIER_ID_V1);
  assert.equal(result.receipt.semanticVerifier.verifierId, CKS_SEMANTIC_VERIFIER_ID_V1);
  assert.equal(result.receipt.semanticVerifier.trusted, false);
  assert.equal(result.receipt.semanticVerifier.mayOverrideDeterministicFailure, false);
});

test("receipt schema is closed and binds all exact execution versions", () => {
  const result = verifyCksEpistemicCaseV1(positive());
  assert.ok(result.receipt);
  const schema = JSON.parse(readFileSync("schemas/contracts/cks-verification-receipt-v1.schema.json", "utf8"));
  const validate = new Ajv2020({ strict: true }).compile(schema);
  assert.equal(validate(result.receipt), true, JSON.stringify(validate.errors));
  assert.equal(result.receipt.bindings.model.version, "artifact-revision-91cad511");
  assert.equal(result.receipt.bindings.quantization.version, "1");
  assert.equal(result.receipt.bindings.runtime.version, "b10661");
  assert.equal(result.receipt.bindings.prompt.version, "1");
  assert.equal(result.receipt.bindings.tool.version, "1");
  assert.equal(result.receipt.bindings.knowledge.version, "1");
  assert.equal(result.receipt.receiptDigest, verificationReceiptDigestV1(result.receipt));
  assert.equal(validate({ ...result.receipt, unexpected: true }), false);
});

test("missing Knowledge is abstention, never a deterministic success", () => {
  const input = positive();
  input.expected.state = "NEED_MORE_KNOWLEDGE";
  input.evidencePacks[0]!.status = "NEEDS_CONTEXT";
  input.evidencePacks[0]!.missingKnowledge = [{ needId: "need:temperature", reasonCode: "MATERIAL_FACT_MISSING" }];
  input.response.state = "NEED_MORE_KNOWLEDGE";
  input.response.answer = null;
  input.response.missingKnowledge = [{ needId: "need:temperature", reasonCode: "MATERIAL_FACT_MISSING" }];
  rehash(input);
  const result = verifyCksEpistemicCaseV1(input);
  assert.equal(result.outcome, "ABSTAIN");
  assert.ok(result.reasonCodes.includes("MISSING_KNOWLEDGE"));
  assert.notEqual(result.outcome, "PASS");
});

test("applicable conflicting Knowledge is preserved as abstention", () => {
  const input = positive();
  input.expected.state = "KNOWLEDGE_CONFLICT";
  input.evidencePacks[0]!.status = "CONFLICT";
  input.evidencePacks[0]!.conflicts = [{ conflictId: "conflict:temperature", claimIds: ["claim:synthetic-temperature", "claim:other-temperature"] }];
  input.response.state = "KNOWLEDGE_CONFLICT";
  input.response.answer = null;
  input.response.conflicts = [{ conflictId: "conflict:temperature", claimIds: ["claim:synthetic-temperature", "claim:other-temperature"] }];
  rehash(input);
  const result = verifyCksEpistemicCaseV1(input);
  assert.equal(result.outcome, "ABSTAIN");
  assert.ok(result.reasonCodes.includes("KNOWLEDGE_CONFLICT"));
});

test("unreturned Evidence, applicability drift, and unknown Preconditions fail closed", () => {
  const missingEvidence = positive();
  missingEvidence.response.materialClaims[0]!.evidenceIds = ["evidence:not-returned"];
  rehash(missingEvidence);
  const missingEvidenceResult = verifyCksEpistemicCaseV1(missingEvidence);
  assert.equal(missingEvidenceResult.outcome, "ABSTAIN");
  assert.ok(missingEvidenceResult.reasonCodes.includes("EVIDENCE_COVERAGE_INCOMPLETE"));
  assert.ok(missingEvidenceResult.reasonCodes.includes("UNRETURNED_EVIDENCE_ID"));

  const scopeDrift = positive();
  scopeDrift.evidencePacks[0]!.applicability.applicability.domain = { state: "VALUE", values: ["different-scope"], provenance: "DECLARED" };
  rehash(scopeDrift);
  const scopeResult = verifyCksEpistemicCaseV1(scopeDrift);
  assert.equal(scopeResult.outcome, "ABSTAIN");
  assert.ok(scopeResult.reasonCodes.includes("APPLICABILITY_MISMATCH"));

  const unknownPrecondition = positive();
  unknownPrecondition.response.preconditionChecks[0]!.result = "UNKNOWN";
  rehash(unknownPrecondition);
  const preconditionResult = verifyCksEpistemicCaseV1(unknownPrecondition);
  assert.equal(preconditionResult.outcome, "ABSTAIN");
  assert.ok(preconditionResult.reasonCodes.includes("PRECONDITION_UNKNOWN"));
});

test("malformed or digest-forged input cannot produce a receipt or success", () => {
  assert.deepEqual(verifyCksEpistemicCaseV1({}), { outcome: "DENIED", reasonCodes: ["MALFORMED_INPUT"], receipt: null });
  const forged = positive();
  forged.evidencePacks[0]!.claims[0]!.version = "999";
  const result = verifyCksEpistemicCaseV1(forged);
  assert.equal(result.outcome, "DENIED");
  assert.equal(result.receipt, null);
});
