import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

import {
  CAPABILITY_FAMILIES,
  EVIDENCE_STATES,
  QUESTION_KINDS,
  SCHEMA_PATHS,
  canonicalJson,
  deriveOverallVerdict,
  evaluateCommonCore,
  evaluateHoldoutFamily,
  freezeProtocol,
  sealCandidate,
  sha256Bytes,
  validateProtocolSchemas,
  verifyFrozenProtocol,
} from "../../src/cscl-01/protocol.mjs";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const fixtureRoot = resolve(repoRoot, "tests/fixtures/cscl-01");
const readJson = async (name) => JSON.parse(await readFile(resolve(fixtureRoot, name), "utf8"));

function exactEvidence(systemId, state = "SUPPORTED", equivalent = true) {
  return {
    schemaVersion: "pansphaira.cscl01/evidence-cell/v1",
    systemId,
    questionId: "objects-roles",
    state,
    equivalenceProof: {
      nativeMeaningSha256: equivalent ? "2".repeat(64) : "3".repeat(64),
      candidateMeaningSha256: "2".repeat(64),
    },
    evidence: [{ sourceFactId: `${systemId}.fact-1`, exactLocator: "sha256:0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef#L1-L2", excerptSha256: "1".repeat(64) }],
    counterexamples: state === "ABSENT" || state === "CONFLICTING" ? ["Exact negative evidence retained"] : [],
    boundary: { authorityGrant: "NONE", promotionGrant: "NONE", executionGrant: "NONE" },
  };
}

const trainingIds = ["odoo-community", "erpnext", "dolibarr", "tryton", "apache-ofbiz"];

test("CSCL protocol exposes eight closed schema contracts", async () => {
  assert.equal(SCHEMA_PATHS.length, 8);
  const result = await validateProtocolSchemas({ repoRoot });
  assert.deepEqual(result, { valid: true, errors: [] });
  for (const path of SCHEMA_PATHS) {
    const schema = JSON.parse(await readFile(resolve(repoRoot, path), "utf8"));
    assert.equal(schema.additionalProperties, false, path);
    assert.doesNotMatch(JSON.stringify(schema), /Authority|authorityGrant.*(?:WRITE|EXECUTE|PROMOTE)/);
  }
});

test("source, family, question, evidence-state and decision fixtures freeze before outputs", async () => {
  const selectors = await readJson("source-selector-set-v1.json");
  const questions = await readJson("question-inventory-v1.json");
  const rules = await readJson("decision-rule-v1.json");
  assert.deepEqual(selectors.systems.map((x) => x.id), [...trainingIds, "idempiere"]);
  assert.equal(selectors.systems.filter((x) => x.role === "TRAINING").length, 5);
  assert.equal(selectors.systems.filter((x) => x.role === "HOLDOUT").length, 1);
  assert.ok(selectors.systems.filter((x) => x.id !== "tryton").every((x) => /^[0-9a-f]{40}$/.test(x.source.commit)));
  assert.equal(selectors.systems.find((x) => x.id === "tryton").source.artifacts.length, 4);
  assert.ok(selectors.systems.filter((x) => x.id !== "tryton").every((x) => x.source.pinnedUrl.includes(x.source.commit)));
  assert.deepEqual(questions.capabilityFamilies, CAPABILITY_FAMILIES);
  assert.deepEqual(questions.questions.map((x) => x.kind), QUESTION_KINDS);
  assert.doesNotMatch(questions.inventoryId, /generic|common-core/i);
  assert.doesNotMatch(questions.questions.map((x) => x.prompt).join(" "), /What generic|common-core/i);
  assert.match(questions.questions[0].prompt, /source-native.*exact system terminology/i);
  assert.deepEqual(rules.evidenceStates, EVIDENCE_STATES);
  assert.deepEqual(rules.boundary, { authorityGrant: "NONE", promotionGrant: "NONE", executionGrant: "NONE" });
});

test("protocol replay is byte-identical and trusts committed fixture digests only", async () => {
  const first = await freezeProtocol({ repoRoot });
  const second = await freezeProtocol({ repoRoot });
  assert.equal(first.bytes.equals(second.bytes), true);
  assert.deepEqual(first.digests, second.digests);
  assert.equal(first.digest, sha256Bytes(first.bytes));
  const verified = await verifyFrozenProtocol(first.bundle, { repoRoot, expectedDigests: { selectors: "f".repeat(64) }, verdict: "GO", label: "trusted" });
  assert.equal(verified.outcome, "VERIFIED");
  assert.deepEqual(verified.reasonCodes, ["COMMITTED_PROTOCOL_FIXTURES_VERIFIED"]);
});

test("mirror and redigested legal URL substitutions deny even with copied bytes", async () => {
  const frozen = await freezeProtocol({ repoRoot });
  for (const mutate of [
    (bundle) => { bundle.fixtures.selectors.systems.find((x) => x.id === "tryton").source.officialRepository = "https://github.com/tryton/tryton.git"; },
    (bundle) => { bundle.fixtures.selectors.systems.find((x) => x.id === "idempiere").legal.licenseUrl = "https://idempiere.org/source-code/"; },
  ]) {
    const changed = structuredClone(frozen.bundle);
    mutate(changed);
    changed.digests.selectors = sha256Bytes(Buffer.from(canonicalJson(changed.fixtures.selectors)));
    const denied = await verifyFrozenProtocol(changed, { repoRoot });
    assert.equal(denied.outcome, "DENIED");
    assert.ok(denied.reasonCodes.includes("TRUSTED_FIXTURE_DIGEST_MISMATCH"));
  }
});

test("profile contract binds source-native vocabulary and role-isolation combinations", async () => {
  const schema = JSON.parse(await readFile(resolve(repoRoot, "contracts/cscl-01/system-profile-v1.schema.json"), "utf8"));
  assert.ok(schema.required.includes("sourceNativeTerminology"));
  assert.equal(schema.properties.commonCore, undefined);
  assert.equal(schema.properties.normalizedVocabulary, undefined);
  assert.ok(Array.isArray(schema.allOf) && schema.allOf.length >= 2);
});

test("legal contract models absent notice honestly and forbids copied fake notice identity", async () => {
  const schema = JSON.parse(await readFile(resolve(repoRoot, "contracts/cscl-01/source-fact-v1.schema.json"), "utf8"));
  const legal = schema.$defs.legal;
  assert.ok(legal.required.includes("noticeStatus"));
  assert.deepEqual(legal.properties.noticeStatus.enum, ["PRESENT", "ABSENT_AT_PIN"]);
  assert.ok(Array.isArray(legal.allOf) && legal.allOf.length === 2);
});

test("canonical JSON is order-independent and rejects unsafe values", () => {
  assert.equal(canonicalJson({ b: 2, a: [true, null] }), '{"a":[true,null],"b":2}');
  assert.equal(canonicalJson({ a: [true, null], b: 2 }), canonicalJson({ b: 2, a: [true, null] }));
  assert.throws(() => canonicalJson({ unsafe: undefined }), /UNSAFE_CANONICAL_VALUE/);
});

test("common core requires equivalent semantics in at least four systems and all five exact cells", () => {
  const cells = trainingIds.map((id) => exactEvidence(id));
  assert.equal(evaluateCommonCore(cells).classification, "COMMON_CORE");
  assert.equal(evaluateCommonCore(cells.slice(0, 4)).classification, "DENIED");
  assert.ok(evaluateCommonCore(cells.slice(0, 4)).reasonCodes.includes("INCOMPLETE_FIVE_SYSTEM_DENOMINATOR"));

  const frequencyOnly = cells.map((cell, index) => exactEvidence(cell.systemId, "SUPPORTED", index === 4));
  assert.equal(evaluateCommonCore(frequencyOnly).classification, "DENIED");
  assert.ok(evaluateCommonCore(frequencyOnly).reasonCodes.includes("SEMANTIC_EQUIVALENCE_BELOW_4_OF_5"));
});

test("lexical collisions, unresolved conflict and omitted negative evidence never qualify", () => {
  const homonym = trainingIds.map((id) => exactEvidence(id, "SUPPORTED", false));
  assert.ok(evaluateCommonCore(homonym).reasonCodes.includes("SEMANTIC_EQUIVALENCE_BELOW_4_OF_5"));
  const conflict = trainingIds.map((id) => exactEvidence(id));
  conflict[4] = exactEvidence(trainingIds[4], "CONFLICTING", false);
  assert.ok(evaluateCommonCore(conflict).reasonCodes.includes("UNRESOLVED_CONFLICTING_COUNTEREXAMPLE"));
  const absentWithoutCounterexample = trainingIds.map((id) => exactEvidence(id));
  absentWithoutCounterexample[4] = { ...exactEvidence(trainingIds[4], "ABSENT", false), counterexamples: [] };
  assert.ok(evaluateCommonCore(absentWithoutCounterexample).reasonCodes.includes("NEGATIVE_EVIDENCE_INCOMPLETE"));
});

test("holdout family GO applies frozen bytes, exact denominators and 80/20 thresholds", () => {
  const candidateBytes = Buffer.from('{"core":["c1"],"variants":["v1"]}');
  const digest = sha256Bytes(candidateBytes);
  const go = evaluateHoldoutFamily({
    candidateBytes,
    frozenCandidateDigest: digest,
    applicable: 10,
    mappedToCore: 7,
    mappedToVariant: 1,
    unmapped: 2,
    coreTotal: 2,
    coreIdentityPreserved: 2,
    coreContradictions: 0,
    governanceGates: { source: true, legal: true, history: true, integrity: true, denominator: true, isolation: true },
  });
  assert.equal(go.verdict, "GO");
  assert.equal(go.mappingRatio, 0.8);
  assert.equal(go.unmappedRatio, 0.2);

  const mutated = evaluateHoldoutFamily({ ...go.inputs, candidateBytes: Buffer.from("mutated"), frozenCandidateDigest: digest });
  assert.equal(mutated.verdict, "FALSIFIED_WITH_EVIDENCE");
  assert.ok(mutated.reasonCodes.includes("CANDIDATE_BYTES_MUTATED_AFTER_FREEZE"));
});

test("holdout fails closed on rewrite, contradiction, threshold, denominator, isolation or hard gate", () => {
  const bytes = Buffer.from("frozen");
  const baseline = {
    candidateBytes: bytes, frozenCandidateDigest: sha256Bytes(bytes), applicable: 10,
    mappedToCore: 8, mappedToVariant: 0, unmapped: 2, coreTotal: 2,
    coreIdentityPreserved: 2, coreContradictions: 0,
    governanceGates: { source: true, legal: true, history: true, integrity: true, denominator: true, isolation: true },
  };
  for (const patch of [
    { coreIdentityPreserved: 1 }, { coreContradictions: 1 },
    { mappedToCore: 7, unmapped: 3 }, { applicable: 0, mappedToCore: 0, unmapped: 0 },
    { governanceGates: { ...baseline.governanceGates, legal: false } },
    { governanceGates: { ...baseline.governanceGates, isolation: false } },
  ]) assert.equal(evaluateHoldoutFamily({ ...baseline, ...patch }).verdict, "FALSIFIED_WITH_EVIDENCE");
});

test("mapping rows derive exact denominators, reject duplicates, and ignore caller aggregates", () => {
  const bytes = Buffer.from("frozen-mapping-candidate");
  const mappings = Array.from({ length: 10 }, (_, index) => ({
    holdoutConceptId: `holdout.concept-${index}`,
    classification: index < 7 ? "CORE" : index === 7 ? "VARIANT" : "UNMAPPED",
    candidateElementId: index < 8 ? `candidate.element-${index}` : null,
    meaningPreserved: index < 8,
  }));
  const result = evaluateHoldoutFamily({
    candidateBytes: bytes,
    frozenCandidateDigest: sha256Bytes(bytes),
    mappings,
    extensions: [],
    applicable: 999,
    mappedToCore: 0,
    mappedToVariant: 0,
    unmapped: 999,
    coreElements: [
      { id: "core.one", identityPreserved: true, contradiction: false, deleted: false, renamed: false, semanticMutation: false },
      { id: "core.two", identityPreserved: true, contradiction: false, deleted: false, renamed: false, semanticMutation: false },
    ],
    governanceGates: { source: true, legal: true, history: true, integrity: true, denominator: true, isolation: true },
  });
  assert.equal(result.verdict, "GO");
  assert.deepEqual(result.denominators, { applicable: 10, mappedToCore: 7, mappedToVariant: 1, unmapped: 2, coreTotal: 2, coreIdentityPreserved: 2, coreContradictions: 0 });

  const duplicate = structuredClone(mappings);
  duplicate[9].holdoutConceptId = duplicate[8].holdoutConceptId;
  assert.ok(evaluateHoldoutFamily({ ...result.inputs, mappings: duplicate }).reasonCodes.includes("DUPLICATE_HOLDOUT_CONCEPT"));
  const inconsistent = structuredClone(mappings);
  inconsistent[0].candidateElementId = null;
  assert.ok(evaluateHoldoutFamily({ ...result.inputs, mappings: inconsistent }).reasonCodes.includes("MAPPING_CLASSIFICATION_INCONSISTENT"));
});

test("candidate digest is internally derived and caller digest fields are ignored", () => {
  const first = sealCandidate({ candidateId: "candidate.one", meaning: "frozen", candidateDigest: "f".repeat(64), candidateBytesSha256: "e".repeat(64) });
  const second = sealCandidate({ candidateId: "candidate.one", meaning: "frozen", candidateDigest: "0".repeat(64), candidateBytesSha256: "1".repeat(64) });
  assert.equal(first.digest, second.digest);
  assert.equal(first.candidate.candidateDigest, first.digest);
  assert.equal(first.candidate.candidateBytesSha256, first.digest);
});

test("overall recomputation requires three distinct frozen capability families", () => {
  const green = { source: true, legal: true, history: true, integrity: true, denominator: true, isolation: true };
  const duplicate = Array.from({ length: 3 }, () => ({ capabilityFamily: "PARTY_CUSTOMER_MANAGEMENT", verdict: "GO" }));
  const denied = deriveOverallVerdict(duplicate, green);
  assert.equal(denied.verdict, "FALSIFIED_WITH_EVIDENCE");
  assert.ok(denied.reasonCodes.includes("DUPLICATE_OR_MISSING_CAPABILITY_FAMILY"));
});

test("overall verdict is GO for three passes, NARROW_GO for one or two, otherwise falsified", () => {
  const green = { source: true, legal: true, history: true, integrity: true, denominator: true, isolation: true };
  assert.equal(deriveOverallVerdict(["GO", "GO", "GO"], green).verdict, "GO");
  assert.equal(deriveOverallVerdict(["GO", "GO", "FALSIFIED_WITH_EVIDENCE"], green).verdict, "NARROW_GO");
  assert.equal(deriveOverallVerdict(["GO", "FALSIFIED_WITH_EVIDENCE", "FALSIFIED_WITH_EVIDENCE"], green).verdict, "NARROW_GO");
  assert.equal(deriveOverallVerdict(["FALSIFIED_WITH_EVIDENCE", "FALSIFIED_WITH_EVIDENCE", "FALSIFIED_WITH_EVIDENCE"], green).verdict, "FALSIFIED_WITH_EVIDENCE");
  assert.equal(deriveOverallVerdict(["GO", "GO", "GO"], { ...green, history: false }).verdict, "FALSIFIED_WITH_EVIDENCE");
});

test("adversarial inventory freezes every required denial family", async () => {
  const cases = await readJson("adversarial-cases-v1.json");
  assert.deepEqual(cases.cases.map((x) => x.id), [
    "extra-fields", "lexical-homonym-synonym-collision", "frequency-majority",
    "omitted-fifth-system-cell", "omitted-absence-counterexample", "caller-digest-verdict",
    "paired-substitution-redigestion", "source-version-license-drift", "moving-only-identity",
    "history-rewrite", "holdout-semantic-leakage", "candidate-mutation-after-freeze",
    "hidden-authority-promotion-execution-fields",
  ]);
});
