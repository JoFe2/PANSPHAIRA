import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import Ajv2020 from "ajv/dist/2020.js";
import {
  CKS_ESCALATION_CAUSE_TO_DISPOSITION_V1,
  CKS_ESCALATION_CAUSES_V1,
  CKS_ESCALATION_CLAIM_BOUNDARY_V1,
  CKS_ADVISORY_SELECTOR_CLAIM_BOUNDARY_V1,
  CKS_ADVISORY_SELECTOR_SCHEMA_V1,
  CKS_REQUIRED_SCENARIO_TAGS_V1,
  cksEscalationEvidenceDigestV1,
  cksEscalationReceiptDigestV1,
  cksEscalationTaskVectorDigestV1,
  cksAdvisoryDecisionDigestV1,
  cksSelectorQualificationEvidenceLineageDigestV1,
  CKS_QUALIFICATION_NONE,
  CKS_QUALIFICATION_NONE_DIGEST_V1,
  cksExactProfileDigestV1,
  validateCksEscalationEvidenceV1,
  validateCksCompetenceQualificationProfileV1,
  validateCksExactQualificationBindingsV1,
  type CksEscalationEvidenceV1,
  type CksEscalationTriggerByCauseV1,
  type CksAdvisorySelectorCandidateV1,
  type CksAdvisorySelectorInputV1,
  type CksQualificationDenialV1,
  selectSmallestQualifiedProfileV1,
} from "../packages/contracts/src/cks-qualification.js";

const SCHEMA_PATH = "schemas/contracts/cks-competence-qualification-profile-v1.schema.json";
const FIXTURE_PATH = "tests/fixtures/cks-qualification/profile-binding-v1.json";
const ESCALATION_SCHEMA_PATH = "schemas/contracts/cks-escalation-v1.schema.json";
const ESCALATION_FIXTURE_PATH = "tests/fixtures/cks-qualification/escalation-causes-v1.json";
const SELECTOR_FIXTURE_PATH = "tests/fixtures/cks-qualification/smallest-qualified-v1.json";

type Json = Record<string, unknown>;

type EscalationBinding<Receipt extends { causeCode: unknown; disposition: unknown; triggerEvidence: unknown }> =
  Receipt extends unknown ? Pick<Receipt, "causeCode" | "disposition" | "triggerEvidence"> : never;
type EscalationCause = keyof CksEscalationTriggerByCauseV1;
type ExpectedEscalationBinding = {
  readonly [Cause in EscalationCause]: {
    readonly causeCode: Cause;
    readonly disposition: typeof CKS_ESCALATION_CAUSE_TO_DISPOSITION_V1[Cause];
    readonly triggerEvidence: CksEscalationTriggerByCauseV1[Cause];
  };
}[EscalationCause];
type TypesEqual<Left, Right> = [Left] extends [Right]
  ? [Right] extends [Left] ? true : false
  : false;
type AssertType<Condition extends true> = Condition;
const ESCALATION_TYPES_ARE_CAUSE_BOUND: AssertType<
  TypesEqual<EscalationBinding<CksEscalationEvidenceV1>, ExpectedEscalationBinding>
> = true;

function loadFixture(): Json {
  return JSON.parse(readFileSync(FIXTURE_PATH, "utf8")) as Json;
}

const SCHEMA = JSON.parse(readFileSync(SCHEMA_PATH, "utf8")) as Json;
const SCHEMA_VALIDATE = new Ajv2020({ strict: true, allErrors: true }).compile(SCHEMA);
const ESCALATION_SCHEMA = JSON.parse(readFileSync(ESCALATION_SCHEMA_PATH, "utf8")) as Json;
const ESCALATION_SCHEMA_VALIDATE = new Ajv2020({ strict: true, allErrors: true }).compile(ESCALATION_SCHEMA);

function schemaValid(doc: unknown): boolean {
  return SCHEMA_VALIDATE(doc) === true;
}

function escalationSchemaValid(doc: unknown): boolean {
  return ESCALATION_SCHEMA_VALIDATE(doc) === true;
}

function expectDenied(input: unknown, reason: CksQualificationDenialV1): void {
  const result = validateCksCompetenceQualificationProfileV1(input);
  assert.equal(result.outcome, "DENIED", `expected DENIED(${reason}); got ${JSON.stringify(result)}`);
  if (result.outcome === "DENIED") assert.equal(result.reason, reason);
}

function setPath(doc: Json, path: string[], value: unknown): Json {
  const next = structuredClone(doc);
  let node: Json = next;
  for (let i = 0; i < path.length - 1; i += 1) node = node[path[i]!] as Json;
  node[path[path.length - 1]!] = value;
  return next;
}

function deletePath(doc: Json, path: string[]): Json {
  const next = structuredClone(doc);
  let node: Json = next;
  for (let i = 0; i < path.length - 1; i += 1) node = node[path[i]!] as Json;
  delete node[path[path.length - 1]!];
  return next;
}

test("fixture profile validates against the closed schema and the runtime validator", () => {
  const fixture = loadFixture();
  assert.equal(schemaValid(fixture), true, JSON.stringify(SCHEMA_VALIDATE.errors));
  const result = validateCksCompetenceQualificationProfileV1(fixture);
  assert.equal(result.outcome, "VALID");
});

test("profile digest binds the exact bindings", () => {
  const fixture = loadFixture();
  assert.match(String(fixture.profileDigest), /^[a-f0-9]{64}$/);
  assert.equal(String(fixture.profileDigest), cksExactProfileDigestV1(fixture.bindings));
  const result = validateCksCompetenceQualificationProfileV1(fixture);
  assert.equal(result.outcome, "VALID");
  if (result.outcome === "VALID") assert.equal(result.profileDigest, cksExactProfileDigestV1(fixture.bindings));
});

test("any change to a required binding creates a different profile", () => {
  const fixture = loadFixture();
  const base = cksExactProfileDigestV1(fixture.bindings);
  const mutations: [string[], unknown][] = [
    [["bindings", "modelArtifact", "artifactDigest"], "f".repeat(64)],
    [["bindings", "quantization", "weightsDigest"], "e".repeat(64)],
    [["bindings", "runtime", "buildDigest"], "d".repeat(64)],
    [["bindings", "context", "contextWindowTokens"], 147456],
    [["bindings", "prompt", "systemPromptDigest"], "c".repeat(64)],
    [["bindings", "tools", "orderedToolIdsAndVersions"], ["web-search@1.0.0"]],
    [["bindings", "retriever", "configDigest"], "b".repeat(64)],
    [["bindings", "verifier", "thresholdPolicyDigest"], "a".repeat(64)],
    [["bindings", "knowledge", "knowledgeManifestDigest"], "9".repeat(64)],
    [["bindings", "qualificationSuite", "suiteVersion"], "qualification-suite-2"],
  ];
  for (const [path, value] of mutations) {
    const mutated = setPath(fixture, path, value);
    assert.notEqual(cksExactProfileDigestV1(mutated.bindings), base, `mutation ${path.join(".")}`);
    const standalone = validateCksExactQualificationBindingsV1(mutated.bindings);
    assert.equal(standalone.outcome, "VALID");
    expectDenied(mutated, "DIGEST_MISMATCH");
  }
  const rerankerUp = setPath(
    setPath(
      setPath(fixture, ["bindings", "reranker", "componentIdOrNONE"], "cross-encoder-reranker"),
      ["bindings", "reranker", "versionOrNONE"],
      "1.1.0",
    ),
    ["bindings", "reranker", "configDigest"],
    "8".repeat(64),
  );
  assert.notEqual(cksExactProfileDigestV1(rerankerUp.bindings), base);
  const standaloneUp = validateCksExactQualificationBindingsV1(rerankerUp.bindings);
  assert.equal(standaloneUp.outcome, "VALID");
  expectDenied(rerankerUp, "DIGEST_MISMATCH");
});

test("evidence state is not profile identity", () => {
  const fixture = loadFixture();
  const base = cksExactProfileDigestV1(fixture.bindings);
  for (const state of ["QUALIFIED", "SUSPENDED_DRIFT", "REVOKED_EVIDENCE"] as const) {
    const doc = { ...fixture, state, profileDigest: base };
    const result = validateCksCompetenceQualificationProfileV1(doc);
    assert.equal(result.outcome, "VALID");
    if (result.outcome === "VALID") assert.equal(result.profileDigest, base);
  }
});

test("digest is independent of key insertion order", () => {
  const fixture = loadFixture();
  const bindings = fixture.bindings as Json;
  const reordered: Json = {};
  for (const key of Object.keys(bindings).reverse()) {
    const inner = bindings[key] as Json;
    const innerReordered: Json = {};
    for (const innerKey of Object.keys(inner).reverse()) innerReordered[innerKey] = inner[innerKey];
    reordered[key] = innerReordered;
  }
  assert.equal(cksExactProfileDigestV1(reordered), cksExactProfileDigestV1(bindings));
});

test("aliases, ranges, and defaults never establish equality", () => {
  const fixture = loadFixture();
  const base = cksExactProfileDigestV1(fixture.bindings);
  const range = setPath(fixture, ["bindings", "runtime", "runtimeVersion"], "1.x");
  assert.notEqual(cksExactProfileDigestV1(range.bindings), base, "range");
  const family = setPath(fixture, ["bindings", "runtime", "runtimeId"], "pansphaira-runtime-family");
  assert.notEqual(cksExactProfileDigestV1(family.bindings), base, "family");
  const alias = setPath(fixture, ["bindings", "modelArtifact", "architectureId"], "decoder-only");
  assert.notEqual(cksExactProfileDigestV1(alias.bindings), base, "alias");
});

test("unknown fields deny", () => {
  const fixture = loadFixture();
  expectDenied({ ...fixture, alias: true }, "UNKNOWN_FIELD");
  expectDenied(setPath(fixture, ["bindings", "modelArtifact", "providerName"], "gpt-9"), "UNKNOWN_FIELD");
  expectDenied(setPath(fixture, ["bindings", "embedder"], { configDigest: CKS_QUALIFICATION_NONE_DIGEST_V1 }), "UNKNOWN_FIELD");
});

test("missing fields deny", () => {
  const fixture = loadFixture();
  const noState = { ...fixture };
  delete noState.state;
  expectDenied(noState, "MISSING_FIELD");
  const noDigest = { ...fixture };
  delete noDigest.profileDigest;
  expectDenied(noDigest, "MISSING_FIELD");
  expectDenied(deletePath(fixture, ["bindings", "retriever"]), "MISSING_FIELD");
  expectDenied(deletePath(fixture, ["bindings", "prompt", "stopSequenceDigest"]), "MISSING_FIELD");
});

test("malformed values deny", () => {
  const fixture = loadFixture();
  expectDenied(setPath(fixture, ["bindings", "modelArtifact", "artifactDigest"], "A".repeat(64)), "MALFORMED_VALUE");
  expectDenied(setPath(fixture, ["bindings", "modelArtifact", "artifactDigest"], "a".repeat(63)), "MALFORMED_VALUE");
  expectDenied(setPath(fixture, ["bindings", "runtime", "runtimeId"], "Runtime-1"), "MALFORMED_VALUE");
  expectDenied(setPath(fixture, ["bindings", "context", "contextWindowTokens"], 0), "MALFORMED_VALUE");
  expectDenied(setPath(fixture, ["bindings", "context", "maximumInputTokens"], 12.5), "MALFORMED_VALUE");
  expectDenied(setPath(fixture, ["bindings", "tools", "orderedToolIdsAndVersions"], ["web-search"]), "MALFORMED_VALUE");
  expectDenied(setPath(fixture, ["bindings", "retriever", "indexContractDigest"], "sha256:abc"), "MALFORMED_VALUE");
  expectDenied(setPath(fixture, ["bindings", "reranker", "componentIdOrNONE"], "None"), "MALFORMED_VALUE");
  expectDenied({ ...fixture, schemaVersion: "chimpmaera.dev/cks-competence-qualification-profile/v2" }, "MALFORMED_VALUE");
  expectDenied({ ...fixture, profileDigest: "nothex" }, "MALFORMED_VALUE");
});

test("truncation policy must be DENY", () => {
  const fixture = loadFixture();
  expectDenied(setPath(fixture, ["bindings", "context", "truncationPolicy"], "TRUNCATE"), "TRUNCATION_POLICY_NOT_DENY");
});

test("unbounded context window denies", () => {
  const fixture = loadFixture();
  expectDenied(setPath(fixture, ["bindings", "context", "maximumOutputTokens"], 32769), "CONTEXT_WINDOW_VIOLATION");
});

test("broken NONE pairing denies", () => {
  const fixture = loadFixture();
  expectDenied(setPath(fixture, ["bindings", "reranker", "configDigest"], "c".repeat(64)), "NONE_PAIRING_MISMATCH");
  expectDenied(setPath(fixture, ["bindings", "knowledge", "knowledgeManifestDigest"], CKS_QUALIFICATION_NONE_DIGEST_V1), "NONE_PAIRING_MISMATCH");
  expectDenied(setPath(fixture, ["bindings", "verifier", "semanticVerifierIdOrNONE"], "semantic-checker"), "NONE_PAIRING_MISMATCH");
  expectDenied(setPath(fixture, ["bindings", "retriever", "componentIdOrNONE"], CKS_QUALIFICATION_NONE), "NONE_PAIRING_MISMATCH");
});

test("states outside the closed enum deny", () => {
  const fixture = loadFixture();
  expectDenied({ ...fixture, state: "SUPERQUALIFIED" }, "INVALID_STATE");
  expectDenied({ ...fixture, state: "unqualified" }, "INVALID_STATE");
});

test("tampered digest denies", () => {
  const fixture = loadFixture();
  expectDenied({ ...fixture, profileDigest: "0".repeat(64) }, "DIGEST_MISMATCH");
});

test("schema rejects additional properties and open values at every level", () => {
  const fixture = loadFixture();
  assert.equal(schemaValid({ ...fixture, extra: 1 }), false);
  assert.equal(schemaValid(setPath(fixture, ["bindings", "modelArtifact", "providerName"], "gpt-9")), false);
  assert.equal(schemaValid(setPath(fixture, ["bindings", "context", "truncationPolicy"], "TRUNCATE")), false);
  assert.equal(schemaValid({ ...fixture, state: "SUPERQUALIFIED" }), false);
});

test("runtime and schema freeze the same closed field inventory", () => {
  const fixture = loadFixture();
  const bindings = fixture.bindings as Json;
  const schemaBindings = (SCHEMA["$defs"] as Json).bindings as Json;
  assert.deepEqual([...(schemaBindings.required as string[])].sort(), Object.keys(bindings).sort());
  for (const bindingName of Object.keys(bindings)) {
    const schemaBinding = (schemaBindings.properties as Json)[bindingName] as Json;
    assert.deepEqual(
      [...(schemaBinding.required as string[])].sort(),
      Object.keys(bindings[bindingName] as Json).sort(),
      bindingName,
    );
  }
});

test("NONE absence is exact and read-back-able", () => {
  assert.match(CKS_QUALIFICATION_NONE_DIGEST_V1, /^[a-f0-9]{64}$/);
  const bindings = loadFixture().bindings as Json;
  assert.equal((bindings.reranker as Json).componentIdOrNONE, CKS_QUALIFICATION_NONE);
  assert.equal((bindings.reranker as Json).configDigest, CKS_QUALIFICATION_NONE_DIGEST_V1);
  assert.equal((bindings.verifier as Json).semanticVerifierIdOrNONE, CKS_QUALIFICATION_NONE);
  assert.equal((bindings.verifier as Json).semanticVerifierDigest, CKS_QUALIFICATION_NONE_DIGEST_V1);
});

test("all AC-03 escalation causes are typed, digest-bound, and schema-valid", () => {
  assert.equal(ESCALATION_TYPES_ARE_CAUSE_BOUND, true);
  const fixture = JSON.parse(readFileSync(ESCALATION_FIXTURE_PATH, "utf8")) as Json;
  const cases = fixture.cases as Json[];
  assert.equal(cases.length, CKS_ESCALATION_CAUSES_V1.length);
  assert.deepEqual(
    cases.map((entry) => (entry.document as Json).causeCode).sort(),
    [...CKS_ESCALATION_CAUSES_V1].sort(),
  );
  for (const entry of cases) {
    const document = entry.document as Json;
    assert.equal(escalationSchemaValid(document), true, `${String(entry.name)}: ${JSON.stringify(ESCALATION_SCHEMA_VALIDATE.errors)}`);
    const result = validateCksEscalationEvidenceV1(document);
    assert.equal(result.outcome, "VALID", String(entry.name));
    if (result.outcome === "VALID") {
      assert.equal(result.causeCode, document.causeCode);
      assert.equal(result.disposition, document.disposition);
      assert.equal(result.evidenceDigest, document.evidenceDigest);
      assert.equal(result.receiptDigest, document.receiptDigest);
    }
    const trigger = document.triggerEvidence as Json;
    assert.equal(trigger.kind, document.causeCode);
    assert.equal(document.claimBoundary, CKS_ESCALATION_CLAIM_BOUNDARY_V1);
    assert.equal(document.taskVectorDigest, cksEscalationTaskVectorDigestV1(document.taskVector));
    assert.equal(document.evidenceDigest, cksEscalationEvidenceDigestV1(trigger));
    assert.equal(document.receiptDigest, cksEscalationReceiptDigestV1(document));
    assert.equal(
      document.disposition,
      CKS_ESCALATION_CAUSE_TO_DISPOSITION_V1[document.causeCode as keyof typeof CKS_ESCALATION_CAUSE_TO_DISPOSITION_V1],
    );
  }
});

test("escalation evidence fails closed for forged facts, causes, and dispositions", () => {
  const fixture = JSON.parse(readFileSync(ESCALATION_FIXTURE_PATH, "utf8")) as Json;
  const document = structuredClone((fixture.cases as Json[])[0]!.document as Json);
  const trigger = document.triggerEvidence as Json;
  trigger.materialKnowledgeObjectDigest = "f".repeat(64);
  assert.equal(validateCksEscalationEvidenceV1(document).outcome, "DENIED");
  assert.equal(escalationSchemaValid({ ...document, extra: true }), false);
  assert.equal(
    validateCksEscalationEvidenceV1({
      ...document,
      triggerEvidence: { ...(document.triggerEvidence as Json), kind: "COMPETENCE_LIMIT" },
    }).outcome,
    "DENIED",
  );
  const valid = (fixture.cases as Json[])[1]!.document as Json;
  assert.equal(
    validateCksEscalationEvidenceV1({
      ...valid,
      disposition: "RECLASSIFY_AND_RESELECT",
    }).outcome,
    "DENIED",
  );
});

test("each escalation trigger denies unsupported escalation facts", () => {
  const fixture = JSON.parse(readFileSync(ESCALATION_FIXTURE_PATH, "utf8")) as Json;
  const documents = (fixture.cases as Json[]).map((entry) => entry.document as Json);
  const mutations: [number, (trigger: Json) => void][] = [
    [0, (trigger) => { trigger.trigger = "UNPROVEN"; }],
    [1, (trigger) => { trigger.conflictingEvidenceDigests = ["6".repeat(64)]; }],
    [2, (trigger) => { trigger.rejectedCheck = "UNPROVEN"; }],
    [3, (trigger) => {
      for (const metric of ["NodeCount", "EdgeCount", "LongestPath", "ContextTokens", "ToolSteps", "DependencyCount", "PathLeaseCount"]) {
        trigger[`current${metric}`] = trigger[`previous${metric}`];
      }
      trigger.currentDecompositionDigest = trigger.previousDecompositionDigest;
    }],
    [4, (trigger) => { trigger.coveredPpm = 1_000_001; }],
    [5, (trigger) => { trigger.taskVectorDigest = "0".repeat(64); }],
  ];
  for (const [index, mutate] of mutations) {
    const document = structuredClone(documents[index]!);
    const trigger = document.triggerEvidence as Json;
    mutate(trigger);
    document.evidenceDigest = cksEscalationEvidenceDigestV1(trigger);
    document.receiptDigest = cksEscalationReceiptDigestV1(document);
    assert.equal(validateCksEscalationEvidenceV1(document).outcome, "DENIED", `case ${index}`);
  }
});

test("escalation receipt carries R/K/P/U only as an independent tuple", () => {
  const fixture = JSON.parse(readFileSync(ESCALATION_FIXTURE_PATH, "utf8")) as Json;
  const document = (fixture.cases as Json[])[0]!.document as Json;
  assert.deepEqual(document.taskVector, [3, 4, 2, 5]);
  assert.equal("risk" in document, false);
  assert.equal("impact" in document, false);
  assert.equal("authority" in document, false);
  assert.equal("modelStrength" in document, false);
  for (const forbiddenIndependentClaim of ["risk", "impact", "authority", "modelStrength"]) {
    const forged = { ...document, [forbiddenIndependentClaim]: "declared" };
    assert.equal(escalationSchemaValid(forged), false, forbiddenIndependentClaim);
    assert.equal(validateCksEscalationEvidenceV1(forged).outcome, "DENIED", forbiddenIndependentClaim);
  }
});

test("missing applicability link is independently sufficient for low-coverage escalation", () => {
  const fixture = JSON.parse(readFileSync(ESCALATION_FIXTURE_PATH, "utf8")) as Json;
  const document = structuredClone((fixture.cases as Json[])[4]!.document as Json);
  const trigger = document.triggerEvidence as Json;
  trigger.coveredPpm = 1_000_000;
  trigger.applicabilityLinkPresent = false;
  document.evidenceDigest = cksEscalationEvidenceDigestV1(trigger);
  document.receiptDigest = cksEscalationReceiptDigestV1(document);
  assert.equal(escalationSchemaValid(document), true, JSON.stringify(ESCALATION_SCHEMA_VALIDATE.errors));
  assert.equal(validateCksEscalationEvidenceV1(document).outcome, "VALID");
});

function selectorQualificationEvidence(profile: Json): Json {
  const unsigned = {
    exactProfileDigest: profile.profileDigest,
    qualificationSuiteReceiptDigest: (profile.bindings as Json).qualificationSuite
      && ((profile.bindings as Json).qualificationSuite as Json).freshCertificationReceiptDigest,
    issuedAtMs: 0,
    expiresAtMs: 2_000,
    cks03: { status: "POSITIVE", receiptDigest: "1".repeat(64) },
    cks04: { status: "POSITIVE", receiptDigest: "2".repeat(64) },
    cks05: { status: "POSITIVE", receiptDigest: "3".repeat(64) },
  };
  return { ...unsigned, lineageDigest: cksSelectorQualificationEvidenceLineageDigestV1(unsigned) };
}

function loadSelectorInput(): CksAdvisorySelectorInputV1 {
  const fixture = JSON.parse(readFileSync(SELECTOR_FIXTURE_PATH, "utf8")) as Json;
  const baseProfile = loadFixture();
  const candidates = (fixture.candidates as Json[]).map((spec) => {
    const profile = structuredClone(baseProfile);
    const variant = spec.profileVariant as string;
    if (variant !== "base") {
      (profile.bindings as Json).runtime = {
        ...((profile.bindings as Json).runtime as Json),
        runtimeVersion: variant,
      };
    }
    profile.state = spec.profileState;
    profile.profileDigest = cksExactProfileDigestV1(profile.bindings);
    const profileDigest = profile.profileDigest as string;
    const candidate = {
      profile,
      coverageBox: spec.coverageBox,
      scenarioTags: [...CKS_REQUIRED_SCENARIO_TAGS_V1],
      qualificationEvidence: selectorQualificationEvidence(profile),
      riskImpactPolicy: spec.riskImpactPolicy,
      authorityPolicy: spec.authorityPolicy,
      catalogAvailability: {
        status: spec.catalogAvailability,
        exactProfileDigest: profileDigest,
        catalogReceiptDigest: "4".repeat(64),
      },
      resourceAdmission: {
        status: spec.resourceAdmission,
        exactProfileDigest: profileDigest,
        admissionReceiptDigest: "5".repeat(64),
      },
      qualificationTierOrdinal: spec.qualificationTierOrdinal,
      certifiedCoverageBoxCardinality: spec.certifiedCoverageBoxCardinality,
      reservedCostMicros: spec.reservedCostMicros,
      qualifiedP95ElapsedMs: spec.qualifiedP95ElapsedMs,
      peakResidentBytes: spec.peakResidentBytes,
    };
    return candidate as unknown as CksAdvisorySelectorCandidateV1;
  });
  return {
    schemaVersion: fixture.schemaVersion as typeof CKS_ADVISORY_SELECTOR_SCHEMA_V1,
    evidenceAsOfMs: 1_000,
    taskVector: fixture.taskVector as readonly [number, number, number, number],
    candidates,
  };
}

test("selector chooses the smallest fully qualified available profile deterministically", () => {
  const input = loadSelectorInput();
  const decision = selectSmallestQualifiedProfileV1(input);
  assert.equal(decision.outcome, "ADVISORY_RECOMMENDATION");
  if (decision.outcome !== "ADVISORY_RECOMMENDATION") return;
  assert.equal(decision.orderingKey[0], 2);
  assert.equal(decision.orderingKey[1], 36);
  assert.equal(decision.selectedProfileDigest, input.candidates[0]!.profile.profileDigest);
  assert.equal(decision.claimBoundary, CKS_ADVISORY_SELECTOR_CLAIM_BOUNDARY_V1);
  assert.equal(decision.decisionDigest, cksAdvisoryDecisionDigestV1(decision));

  const reordered = { ...input, candidates: [...input.candidates].reverse() };
  assert.deepEqual(selectSmallestQualifiedProfileV1(reordered), decision);
});

test("selector keeps risk/impact and Authority outside complexity/model-strength ordering", () => {
  const input = loadSelectorInput();
  const deniedRisk = { ...input, candidates: [...input.candidates] };
  deniedRisk.candidates[0] = { ...deniedRisk.candidates[0]!, riskImpactPolicy: "DENY" };
  const riskDecision = selectSmallestQualifiedProfileV1(deniedRisk);
  assert.equal(riskDecision.outcome, "ADVISORY_RECOMMENDATION");
  if (riskDecision.outcome === "ADVISORY_RECOMMENDATION") {
    assert.equal(riskDecision.selectedProfileDigest, deniedRisk.candidates[1]!.profile.profileDigest);
    assert.equal("risk" in riskDecision, false);
    assert.equal("impact" in riskDecision, false);
    assert.equal("authority" in riskDecision, false);
    assert.equal("modelStrength" in riskDecision, false);
  }

  const deniedAuthority = { ...input, candidates: [...input.candidates] };
  deniedAuthority.candidates[0] = { ...deniedAuthority.candidates[0]!, authorityPolicy: "DENY" };
  const authorityDecision = selectSmallestQualifiedProfileV1(deniedAuthority);
  assert.equal(authorityDecision.outcome, "ADVISORY_RECOMMENDATION");
  if (authorityDecision.outcome === "ADVISORY_RECOMMENDATION") {
    assert.equal(authorityDecision.selectedProfileDigest, deniedAuthority.candidates[1]!.profile.profileDigest);
  }
});

test("selector abstains or returns no profile when qualification evidence or admission is not fully positive", () => {
  const input = loadSelectorInput();
  const missingTag = { ...input, candidates: [...input.candidates] };
  missingTag.candidates[0] = {
    ...missingTag.candidates[0]!,
    scenarioTags: missingTag.candidates[0]!.scenarioTags.slice(1),
  };
  const tagDecision = selectSmallestQualifiedProfileV1(missingTag);
  assert.equal(tagDecision.outcome, "ADVISORY_RECOMMENDATION");
  if (tagDecision.outcome === "ADVISORY_RECOMMENDATION") {
    assert.equal(tagDecision.selectedProfileDigest, input.candidates[1]!.profile.profileDigest);
  }

  const noAdmission = {
    ...input,
    candidates: input.candidates.map((candidate) => ({
      ...candidate,
      resourceAdmission: { ...candidate.resourceAdmission, status: "DENIED" },
    })),
  };
  const admissionDecision = selectSmallestQualifiedProfileV1(noAdmission);
  assert.equal(admissionDecision.outcome, "NO_QUALIFIED_PROFILE");

  const staleEvidence = {
    ...input,
    candidates: input.candidates.map((candidate) => {
      const { lineageDigest: _lineageDigest, ...unsigned } = candidate.qualificationEvidence;
      const expired = { ...unsigned, expiresAtMs: input.evidenceAsOfMs };
      return {
        ...candidate,
        qualificationEvidence: {
          ...expired,
          lineageDigest: cksSelectorQualificationEvidenceLineageDigestV1(expired),
        },
      };
    }),
  };
  assert.equal(selectSmallestQualifiedProfileV1(staleEvidence).outcome, "NO_QUALIFIED_PROFILE");

  const forgedLineage = {
    ...input,
    candidates: input.candidates.map((candidate) => ({
      ...candidate,
      qualificationEvidence: {
        ...candidate.qualificationEvidence,
        exactProfileDigest: "0".repeat(64),
      },
    })),
  };
  assert.equal(selectSmallestQualifiedProfileV1(forgedLineage).outcome, "ABSTAIN");

  const malformed = selectSmallestQualifiedProfileV1({ ...input, taskVector: [7, 0, 0, 0] });
  assert.equal(malformed.outcome, "ABSTAIN");
  assert.equal(malformed.reason, "MALFORMED_INPUT");
  assert.equal(malformed.decisionDigest, cksAdvisoryDecisionDigestV1(malformed));

  const duplicate = {
    ...input,
    candidates: input.candidates.map((candidate, index) => index === 1
      ? { ...candidate, profile: input.candidates[0]!.profile }
      : candidate),
  };
  const duplicateDecision = selectSmallestQualifiedProfileV1(duplicate);
  assert.equal(duplicateDecision.outcome, "ABSTAIN");
  assert.equal(duplicateDecision.reason, "DUPLICATE_PROFILE");
  assert.equal(duplicateDecision.decisionDigest, cksAdvisoryDecisionDigestV1(duplicateDecision));
});