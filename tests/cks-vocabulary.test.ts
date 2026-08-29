import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import Ajv2020 from "ajv/dist/2020.js";
import {
  CKS_COMPLEXITY_DIMENSIONS_V1,
  CKS_DENIAL_REASONS_V1,
  CKS_KNOWLEDGE_KINDS_V1,
  CKS_MATURITY_LEVELS_V1,
  CKS_NONCLAIMS_V1,
  CKS_QUALIFICATION_LEVELS_V1,
  CKS_VOCABULARY_V1,
  KNOWLEDGE_AUTHORITY_BOUNDARY_V1,
  cksScopeMembersV1,
  cksVocabularyDigestV1,
  isCksScopeMemberV1,
  validateCksVocabularyV1,
  type CksReasonV1,
  type CksScopeV1,
  type CksVocabularyV1,
} from "../packages/contracts/src/index.js";

const PINNED_DIGEST_V1 = "3f7c1891a5fd2ecf01882df395921f9b8f2af268f74e4ac6b83a3caed69a03c0";
const SCHEMA_VERSION_V1 = "chimpmaera.cks/vocabulary/v1";
const EXPECTED_KINDS = ["FACT", "RULE", "PROCEDURE", "GUIDE", "EXAMPLE", "COUNTEREXAMPLE", "CONSTRAINT"];
const EXPECTED_QUALIFICATIONS = ["Q0", "Q1", "Q2", "Q3", "Q4", "Q5", "Q6"];
const EXPECTED_MATURITY = ["L0", "L1", "L2", "L3", "L4", "L5", "L6"];
const EXPECTED_DIMENSIONS = ["R", "K", "P", "U"];
const EXPECTED_REASONS = ["SCHEMA_DENIED", "STALE_VERSION_DENIED", "AUTHORITY_DENIED", "REGISTRY_MUTATION_DENIED", "NONCLAIM_MUTATION_DENIED", "APPLICABILITY_MISMATCH_DENIED", "CROSS_SCOPE_BINDING_DENIED", "DIGEST_TAMPERED_DENIED"];
const EXPECTED_NONCLAIMS = ["NO_KNOWLEDGE_OBJECT_SEMANTICS", "NO_QUERY_SEMANTICS", "NO_APPLICABILITY_SEMANTICS", "NO_EVIDENCE_SEMANTICS", "NO_QUALIFICATION_ASSESSMENT_SEMANTICS", "NO_ESCALATION_SEMANTICS", "NO_STORAGE_SEMANTICS", "NO_RETRIEVAL_SEMANTICS", "NO_ROUTING_OR_PROVIDER_SEMANTICS", "NO_CAPABILITY_OR_POLICY_SEMANTICS", "NO_WRITE_OR_EXECUTION_AUTHORITY", "NO_RUNTIME_ACTIVATION_SEMANTICS", "LEVELS_AND_DIMENSIONS_CARRY_NO_SCORE_WEIGHT_OR_THRESHOLD", "VOCABULARY_IS_NOT_A_TRUTH_CLAIM"];

const loadSchema = (): any => JSON.parse(readFileSync("schemas/contracts/cks-vocabulary-v1.schema.json", "utf8"));
const fresh = (): Record<string, any> => structuredClone(CKS_VOCABULARY_V1);
const rehash = (value: Record<string, any>): void => { value.vocabularyDigest = cksVocabularyDigestV1(value); };
const djb2 = (text: string): number => { let hash = 5381; for (let index = 0; index < text.length; index += 1) hash = ((hash << 5) + hash + text.charCodeAt(index)) >>> 0; return hash; };
const unordered = (value: CksVocabularyV1): Record<string, unknown> => { const copy = { ...value } as Record<string, unknown>; delete copy.vocabularyDigest; return copy; };

test("CKS issue 281 canonical manifest passes closed schema and TS validator with the pinned digest", () => {
  const ajv = new Ajv2020({ allErrors: true, strict: true });
  const validate = ajv.compile(loadSchema());
  assert.equal(validate(CKS_VOCABULARY_V1), true, JSON.stringify(validate.errors));
  assert.deepEqual(validateCksVocabularyV1(CKS_VOCABULARY_V1), []);
  assert.equal(cksVocabularyDigestV1(CKS_VOCABULARY_V1), PINNED_DIGEST_V1);
  assert.equal(CKS_VOCABULARY_V1.vocabularyDigest, PINNED_DIGEST_V1);
  assert.equal(CKS_VOCABULARY_V1.schemaVersion, SCHEMA_VERSION_V1);
  assert.equal(CKS_VOCABULARY_V1.authorityBoundary, KNOWLEDGE_AUTHORITY_BOUNDARY_V1);
  assert.deepEqual([...CKS_KNOWLEDGE_KINDS_V1], EXPECTED_KINDS);
  assert.deepEqual([...CKS_QUALIFICATION_LEVELS_V1], EXPECTED_QUALIFICATIONS);
  assert.deepEqual([...CKS_MATURITY_LEVELS_V1], EXPECTED_MATURITY);
  assert.deepEqual([...CKS_COMPLEXITY_DIMENSIONS_V1], EXPECTED_DIMENSIONS);
  assert.deepEqual([...CKS_DENIAL_REASONS_V1], EXPECTED_REASONS);
  assert.deepEqual([...CKS_NONCLAIMS_V1], EXPECTED_NONCLAIMS);
});

test("CKS issue 281 TS tuples exactly equal the schema fixed ordered tuple values", () => {
  const schema = loadSchema();
  assert.equal(schema.additionalProperties, false);
  assert.deepEqual([...schema.required].sort(), ["authorityBoundary", "complexityDimensions", "denialReasons", "knowledgeKinds", "maturityLevels", "nonclaims", "qualificationLevels", "schemaVersion", "vocabularyDigest"]);
  assert.equal(schema.properties.schemaVersion.const, SCHEMA_VERSION_V1);
  assert.equal(schema.properties.authorityBoundary.const, KNOWLEDGE_AUTHORITY_BOUNDARY_V1);
  assert.equal(schema.properties.vocabularyDigest.pattern, "^[a-f0-9]{64}$");
  const tupleProps: Array<[string, readonly string[]]> = [
    ["knowledgeKinds", CKS_KNOWLEDGE_KINDS_V1],
    ["qualificationLevels", CKS_QUALIFICATION_LEVELS_V1],
    ["maturityLevels", CKS_MATURITY_LEVELS_V1],
    ["complexityDimensions", CKS_COMPLEXITY_DIMENSIONS_V1],
    ["denialReasons", CKS_DENIAL_REASONS_V1],
    ["nonclaims", CKS_NONCLAIMS_V1],
  ];
  for (const [key, tuple] of tupleProps) {
    const definition = schema.properties[key] as { type: string; minItems: number; maxItems: number; items: boolean; prefixItems: Array<{ const: string }> };
    assert.equal(definition.type, "array", key);
    assert.equal(definition.minItems, tuple.length, key);
    assert.equal(definition.maxItems, tuple.length, key);
    assert.equal(definition.items, false, key);
    assert.deepEqual(definition.prefixItems.map((item) => item.const), [...tuple], key);
  }
});

test("CKS issue 281 Q and L are distinct and R/K/P/U carry no score, weight, threshold or routing meaning", () => {
  const scopes: Array<[CksScopeV1, readonly string[]]> = [
    ["KNOWLEDGE_KIND", CKS_KNOWLEDGE_KINDS_V1],
    ["QUALIFICATION", CKS_QUALIFICATION_LEVELS_V1],
    ["MATURITY", CKS_MATURITY_LEVELS_V1],
    ["COMPLEXITY", CKS_COMPLEXITY_DIMENSIONS_V1],
  ];
  for (const [scope, members] of scopes) {
    assert.deepEqual([...cksScopeMembersV1(scope)], [...members], scope);
    for (const member of members) assert.equal(isCksScopeMemberV1(scope, member), true, `${scope}:${member}`);
  }
  for (const level of EXPECTED_QUALIFICATIONS) {
    assert.equal(isCksScopeMemberV1("MATURITY", level), false, `Q-in-L:${level}`);
    assert.equal(isCksScopeMemberV1("KNOWLEDGE_KIND", level), false, `Q-in-kind:${level}`);
    assert.equal(isCksScopeMemberV1("COMPLEXITY", level), false, `Q-in-dim:${level}`);
  }
  for (const level of EXPECTED_MATURITY) {
    assert.equal(isCksScopeMemberV1("QUALIFICATION", level), false, `L-in-Q:${level}`);
    assert.equal(isCksScopeMemberV1("KNOWLEDGE_KIND", level), false, `L-in-kind:${level}`);
    assert.equal(isCksScopeMemberV1("COMPLEXITY", level), false, `L-in-dim:${level}`);
  }
  for (const dimension of EXPECTED_DIMENSIONS) {
    for (const scoreLike of [`${dimension}0`, `${dimension}1`, `${dimension}2`, `${dimension}10`, "HIGH", "LOW", "MEDIUM", "WEIGHT_1", "THRESHOLD", "ROUTE_A"]) assert.equal(isCksScopeMemberV1("COMPLEXITY", scoreLike), false, `dim:${dimension}:${scoreLike}`);
    for (const otherScope of ["KNOWLEDGE_KIND", "QUALIFICATION", "MATURITY"] as CksScopeV1[]) assert.equal(isCksScopeMemberV1(otherScope, dimension), false, `dim-cross:${dimension}:${otherScope}`);
  }
  for (const member of ["Q7", "Q8", "L9", "L00", "X", "FACTOID", "OBSERVATION", "CLAIM", "RULESET"]) {
    for (const [scope] of scopes) assert.equal(isCksScopeMemberV1(scope, member), false, `unfrozen:${member}:${scope}`);
  }
  for (const member of [null, undefined, 0, 42, true, "", " ", "fact", ["FACT"], { FACT: true }]) assert.equal(isCksScopeMemberV1("KNOWLEDGE_KIND", member), false);
});

test("CKS issue 281 100 deterministic key reorderings preserve schema validity and the exact digest", () => {
  const ajv = new Ajv2020({ allErrors: true, strict: true });
  const validate = ajv.compile(loadSchema());
  const unsigned = unordered(CKS_VOCABULARY_V1);
  const keys = Object.keys(unsigned);
  for (let replay = 0; replay < 100; replay += 1) {
    const ordered = [...keys].sort((a, b) => { const left = djb2(`${replay}:${a}`); const right = djb2(`${replay}:${b}`); return left === right ? a.localeCompare(b) : left - right; });
    const reordered = Object.fromEntries(ordered.map((key) => [key, unsigned[key]])) as Record<string, unknown>;
    assert.equal(cksVocabularyDigestV1(reordered), PINNED_DIGEST_V1, `digest-order:${replay}`);
    const signed = { ...reordered, vocabularyDigest: PINNED_DIGEST_V1 } as CksVocabularyV1;
    assert.equal(validate(signed), true, `schema-order:${replay}:${JSON.stringify(validate.errors)}`);
    assert.deepEqual(validateCksVocabularyV1(signed), [], `ts-order:${replay}`);
  }
});

test("CKS issue 281 repeated validation and digest are byte-for-byte deterministic", () => {
  const reasons: string[] = [];
  const digests: string[] = [];
  for (let replay = 0; replay < 100; replay += 1) {
    reasons.push(JSON.stringify(validateCksVocabularyV1(CKS_VOCABULARY_V1)));
    digests.push(cksVocabularyDigestV1(CKS_VOCABULARY_V1));
  }
  assert.equal(new Set(reasons).size, 1);
  assert.equal(new Set(digests).size, 1);
  assert.equal(digests[0], PINNED_DIGEST_V1);
  const denied = validateCksVocabularyV1(fresh());
  assert.deepEqual(denied, []);
});

test("CKS issue 281 adversarial manifest mutations deny fail-closed with frozen reasons", () => {
  const cases: Array<{ caseId: string; mutate: (value: Record<string, any>) => void; rehash: boolean; expected: readonly CksReasonV1[] }> = [
    { caseId: "unknown-field", mutate: (value) => { value.extra = "x"; }, rehash: false, expected: ["SCHEMA_DENIED"] },
    { caseId: "unknown-field-rehashed", mutate: (value) => { value.extra = "x"; }, rehash: true, expected: ["SCHEMA_DENIED"] },
    { caseId: "omitted-registry", mutate: (value) => { delete value.knowledgeKinds; }, rehash: false, expected: ["SCHEMA_DENIED"] },
    { caseId: "stale-version-v0", mutate: (value) => { value.schemaVersion = "chimpmaera.cks/vocabulary/v0"; }, rehash: false, expected: ["STALE_VERSION_DENIED", "DIGEST_TAMPERED_DENIED"] },
    { caseId: "future-version-v2", mutate: (value) => { value.schemaVersion = "chimpmaera.cks/vocabulary/v2"; }, rehash: true, expected: ["STALE_VERSION_DENIED"] },
    { caseId: "authority-drift", mutate: (value) => { value.authorityBoundary = "READ_WRITE_KNOWLEDGE_FULL_EXECUTION_AUTHORITY"; }, rehash: true, expected: ["AUTHORITY_DENIED"] },
    { caseId: "authority-wrong-type", mutate: (value) => { value.authorityBoundary = []; }, rehash: true, expected: ["SCHEMA_DENIED"] },
    { caseId: "kinds-semantic-mutation-old-digest", mutate: (value) => { value.knowledgeKinds[0] = "RULE"; }, rehash: false, expected: ["REGISTRY_MUTATION_DENIED", "DIGEST_TAMPERED_DENIED"] },
    { caseId: "kinds-reordered", mutate: (value) => { value.knowledgeKinds = [...value.knowledgeKinds].reverse(); }, rehash: true, expected: ["REGISTRY_MUTATION_DENIED"] },
    { caseId: "kinds-omitted-member", mutate: (value) => { value.knowledgeKinds = value.knowledgeKinds.slice(0, -1); }, rehash: true, expected: ["REGISTRY_MUTATION_DENIED"] },
    { caseId: "kinds-duplicated-member", mutate: (value) => { value.knowledgeKinds = [...value.knowledgeKinds.slice(0, -1), value.knowledgeKinds[0]]; }, rehash: true, expected: ["REGISTRY_MUTATION_DENIED"] },
    { caseId: "kinds-open-ended-envelope-kind", mutate: (value) => { value.knowledgeKinds = [...value.knowledgeKinds, "OBSERVATION"]; }, rehash: true, expected: ["APPLICABILITY_MISMATCH_DENIED"] },
    { caseId: "kinds-added-unfrozen-kind", mutate: (value) => { value.knowledgeKinds = [...value.knowledgeKinds, "CLAIM"]; }, rehash: true, expected: ["APPLICABILITY_MISMATCH_DENIED"] },
    { caseId: "kinds-cross-scope-level", mutate: (value) => { value.knowledgeKinds = ["L3", ...value.knowledgeKinds.slice(1)]; }, rehash: true, expected: ["CROSS_SCOPE_BINDING_DENIED"] },
    { caseId: "qualification-cross-scope-maturity", mutate: (value) => { value.qualificationLevels = [...CKS_MATURITY_LEVELS_V1]; }, rehash: true, expected: ["CROSS_SCOPE_BINDING_DENIED"] },
    { caseId: "maturity-in-qualification-slot", mutate: (value) => { value.qualificationLevels[0] = "L0"; }, rehash: true, expected: ["CROSS_SCOPE_BINDING_DENIED"] },
    { caseId: "qualification-unfrozen-level", mutate: (value) => { value.qualificationLevels[0] = "Q7"; }, rehash: true, expected: ["APPLICABILITY_MISMATCH_DENIED"] },
    { caseId: "dimension-score", mutate: (value) => { value.complexityDimensions[0] = "R2"; }, rehash: true, expected: ["APPLICABILITY_MISMATCH_DENIED"] },
    { caseId: "dimension-weight-word", mutate: (value) => { value.complexityDimensions[0] = "HIGH"; }, rehash: true, expected: ["SCHEMA_DENIED"] },
    { caseId: "reason-unfrozen", mutate: (value) => { value.denialReasons[0] = "EXTRA_DENIED"; }, rehash: true, expected: ["APPLICABILITY_MISMATCH_DENIED"] },
    { caseId: "reason-cross-scope", mutate: (value) => { value.denialReasons[0] = "Q3"; }, rehash: true, expected: ["CROSS_SCOPE_BINDING_DENIED"] },
    { caseId: "reasons-reordered", mutate: (value) => { value.denialReasons = [...value.denialReasons].reverse(); }, rehash: true, expected: ["REGISTRY_MUTATION_DENIED"] },
    { caseId: "nonclaims-omitted", mutate: (value) => { value.nonclaims = value.nonclaims.slice(0, -1); }, rehash: true, expected: ["NONCLAIM_MUTATION_DENIED"] },
    { caseId: "nonclaims-added", mutate: (value) => { value.nonclaims = [...value.nonclaims, "NO_TRUTH_CLAIM_AT_ALL"]; }, rehash: true, expected: ["NONCLAIM_MUTATION_DENIED"] },
    { caseId: "nonclaims-reordered", mutate: (value) => { value.nonclaims = [...value.nonclaims].reverse(); }, rehash: true, expected: ["NONCLAIM_MUTATION_DENIED"] },
    { caseId: "nonclaims-cross-scope", mutate: (value) => { value.nonclaims = [...value.nonclaims, "Q3"]; }, rehash: true, expected: ["NONCLAIM_MUTATION_DENIED", "CROSS_SCOPE_BINDING_DENIED"] },
    { caseId: "digest-drift", mutate: (value) => { value.vocabularyDigest = "0".repeat(64); }, rehash: false, expected: ["DIGEST_TAMPERED_DENIED"] },
    { caseId: "digest-malformed", mutate: (value) => { value.vocabularyDigest = "0".repeat(63); }, rehash: false, expected: ["SCHEMA_DENIED"] },
    { caseId: "digest-uppercase", mutate: (value) => { value.vocabularyDigest = PINNED_DIGEST_V1.toUpperCase(); }, rehash: false, expected: ["SCHEMA_DENIED"] },
  ];
  for (const probe of cases) {
    const value = fresh();
    probe.mutate(value);
    if (probe.rehash) rehash(value);
    const reasons = validateCksVocabularyV1(value);
    for (const expected of probe.expected) assert.ok(reasons.includes(expected), `${probe.caseId}:${expected}:${JSON.stringify(reasons)}`);
  }
  const forbiddenFields = ["score", "weight", "threshold", "route", "routes", "routing", "provider", "providers", "capability", "capabilities", "credential", "credentials", "tool", "tools", "write", "writes", "execution", "authority", "policy", "escalation", "evidence", "storage", "retrieval", "query"];
  for (const field of forbiddenFields) {
    const value = fresh();
    value[field] = field === "authority" ? { credentials: ["x"] } : "x";
    const reasons = validateCksVocabularyV1(value);
    assert.ok(reasons.includes("SCHEMA_DENIED"), `forbidden-field:${field}:${JSON.stringify(reasons)}`);
  }
});

test("CKS issue 281 unknown fields, stale versions, digest drift, applicability mismatch and cross-scope bindings deny", () => {
  const ajv = new Ajv2020({ allErrors: true, strict: true });
  const validate = ajv.compile(loadSchema());
  const cases: Array<{ caseId: string; mutate: (value: Record<string, any>) => void; rehash: boolean; schemaInvalid: boolean; expected: CksReasonV1 }> = [
    { caseId: "unknown-field", mutate: (value) => { value.extra = "x"; }, rehash: true, schemaInvalid: true, expected: "SCHEMA_DENIED" },
    { caseId: "stale-version", mutate: (value) => { value.schemaVersion = "chimpmaera.cks/vocabulary/v0"; }, rehash: true, schemaInvalid: true, expected: "STALE_VERSION_DENIED" },
    { caseId: "digest-drift", mutate: (value) => { value.vocabularyDigest = "0".repeat(64); }, rehash: false, schemaInvalid: false, expected: "DIGEST_TAMPERED_DENIED" },
    { caseId: "applicability-mismatch", mutate: (value) => { value.knowledgeKinds = [...value.knowledgeKinds, "OBSERVATION"]; }, rehash: true, schemaInvalid: true, expected: "APPLICABILITY_MISMATCH_DENIED" },
    { caseId: "cross-scope-binding", mutate: (value) => { value.maturityLevels[0] = "Q3"; }, rehash: true, schemaInvalid: true, expected: "CROSS_SCOPE_BINDING_DENIED" },
  ];
  for (const probe of cases) {
    const value = fresh();
    probe.mutate(value);
    if (probe.rehash) rehash(value);
    assert.deepEqual(validateCksVocabularyV1(value), [probe.expected], probe.caseId);
    assert.equal(validate(value), !probe.schemaInvalid, `${probe.caseId}:${JSON.stringify(validate.errors)}`);
  }
});

test("CKS issue 281 null, scalar, array, prototype-bearing and partial inputs deny deterministically without throwing", () => {
  const ajv = new Ajv2020({ allErrors: true, strict: true });
  const validate = ajv.compile(loadSchema());
  const classInstance = new (class { readonly schemaVersion = SCHEMA_VERSION_V1 })();
  const inputs: unknown[] = [null, undefined, 0, 42, true, false, "", SCHEMA_VERSION_V1, ["FACT"], new Date(), Object.create(null), Object.create(String.prototype), classInstance, {}, { schemaVersion: SCHEMA_VERSION_V1 }];
  for (const input of inputs) {
    let reasons: readonly CksReasonV1[] = [];
    let schemaValid = true;
    assert.doesNotThrow(() => { reasons = validateCksVocabularyV1(input); });
    assert.doesNotThrow(() => { schemaValid = validate(input as object); });
    assert.ok(Array.isArray(reasons) && reasons.length > 0, `malformed:${JSON.stringify(input)}:${JSON.stringify(reasons)}`);
    assert.ok(reasons.includes("SCHEMA_DENIED"), `malformed-reason:${JSON.stringify(reasons)}`);
    assert.equal(schemaValid, false, `malformed-schema:${JSON.stringify(validate.errors)}`);
  }
});