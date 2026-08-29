import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import Ajv2020 from "ajv/dist/2020.js";
import {
  CKS_APPLICABILITY_BINDING_SCHEMA_V1,
  CKS_KNOWLEDGE_DENIAL_REASONS_V1,
  CKS_KNOWLEDGE_OBJECT_SCHEMA_V1,
  CKS_KNOWLEDGE_QUERY_SCHEMA_V1,
  CKS_KNOWLEDGE_STATUSES_V1,
  cksApplicabilityBindingDigestV1,
  cksKnowledgeObjectDigestV1,
  cksKnowledgeQueryDigestV1,
  knowledgeEnvelopeDigestV1,
  knowledgeTaxonomyDigestV1,
  validateCksApplicabilityBindingV1,
  validateCksKnowledgeObjectV1,
  validateCksKnowledgeQueryV1,
  type CksApplicabilityBindingV1,
  type CksKnowledgeObjectV1,
  type CksKnowledgeQueryV1,
  type KnowledgeEnvelopeV1,
  type KnowledgeTaxonomyV1,
} from "../packages/contracts/src/index.js";

const DIGEST = "a".repeat(64);
const schema = (name: string): Record<string, unknown> => JSON.parse(readFileSync(`schemas/contracts/${name}`, "utf8"));
const djb2 = (text: string): number => { let hash = 5381; for (let index = 0; index < text.length; index += 1) hash = ((hash << 5) + hash + text.charCodeAt(index)) >>> 0; return hash; };

const taxonomy = (): KnowledgeTaxonomyV1 => {
  const unsigned = { schemaVersion: "chimpmaera.knowledge/taxonomy/v1" as const, taxonomyId: "knowledge:cks-taxonomy", generation: 1, priorGeneration: null, kinds: ["PROCEDURE", "CLAIM", "OBSERVATION", "DEFINITION", "RELATIONSHIP", "UNRESOLVED"], migrations: [], compatibility: "STRICT_ADDITIVE_OR_EXPLICIT_RENAME" as const };
  return { ...unsigned, taxonomyDigest: knowledgeTaxonomyDigestV1(unsigned) };
};
const envelope = (): KnowledgeEnvelopeV1 => {
  const activeTaxonomy = taxonomy();
  const unsigned = {
    schemaVersion: "chimpmaera.knowledge/envelope/v1" as const, envelopeId: "knowledge:cks-pruning", taxonomy: { taxonomyId: activeTaxonomy.taxonomyId, generation: activeTaxonomy.generation, taxonomyDigest: activeTaxonomy.taxonomyDigest }, scope: { namespace: "synthetic:cks", audience: "PUBLIC_SYNTHETIC" as const }, kind: "PROCEDURE", statement: "Prune dormant synthetic orchard trees with clean tools.", attribution: [{ sourceId: "source:cks-fixture", citation: "Synthetic CKS fixture.", sourceDigest: DIGEST, observedAtMs: 1_000, licence: "CC0-1.0" as const }], epistemicStatus: "VERIFIED" as const, trust: "HIGH" as const, freshness: { assessedAtMs: 1_000, staleAfterMs: 2_000 }, sensitivity: "PUBLIC" as const, permittedUses: ["CURATED_READ", "KNOWLEDGE_GENERATION_CANDIDATE"] as const, conflictsWith: [] as string[], derivedFrom: [] as string[], generationCandidate: "ACCEPTED" as const, authority: { credentials: [] as [], policyApprovals: [] as [], capabilities: [] as [], toolAccess: [] as [], writeTargets: [] as [], executionRoutes: [] as [] }, authorityBoundary: "READ_ONLY_KNOWLEDGE_NO_CREDENTIAL_POLICY_CAPABILITY_TOOL_WRITE_OR_EXECUTION_AUTHORITY" as const,
  };
  return { ...unsigned, envelopeDigest: knowledgeEnvelopeDigestV1(unsigned) };
};
const object = (): CksKnowledgeObjectV1 => {
  const source = envelope();
  const unsigned = { schemaVersion: CKS_KNOWLEDGE_OBJECT_SCHEMA_V1, objectId: "knowledge:cks-pruning-object", provenance: { envelopeId: source.envelopeId, envelopeDigest: source.envelopeDigest, scopeNamespace: source.scope.namespace }, knowledgeKind: "PROCEDURE" as const, qualificationLevel: "Q2" as const, maturityLevel: "L1" as const, complexityDimensions: ["R", "K"] as const, validity: { notBeforeMs: 1_000, notAfterMs: 2_000 }, status: "ACTIVE" as const, supersedes: [] as const, authority: { credentials: [] as [], policyApprovals: [] as [], capabilities: [] as [], toolAccess: [] as [], writeTargets: [] as [], executionRoutes: [] as [] } };
  return { ...unsigned, objectDigest: cksKnowledgeObjectDigestV1(unsigned) };
};
const query = (): CksKnowledgeQueryV1 => {
  const target = object();
  const unsigned = { schemaVersion: CKS_KNOWLEDGE_QUERY_SCHEMA_V1, queryId: "query:cks-pruning", object: { objectId: target.objectId, objectDigest: target.objectDigest }, scopeNamespace: "synthetic:cks", requestedAtMs: 1_500, authority: { credentials: [] as [], policyApprovals: [] as [], capabilities: [] as [], toolAccess: [] as [], writeTargets: [] as [], executionRoutes: [] as [] } };
  return { ...unsigned, queryDigest: cksKnowledgeQueryDigestV1(unsigned) };
};
const applicability = (): CksApplicabilityBindingV1 => {
  const target = object();
  const unsigned = { schemaVersion: CKS_APPLICABILITY_BINDING_SCHEMA_V1, object: { objectId: target.objectId, objectDigest: target.objectDigest }, scopeNamespace: "synthetic:cks", acceptedContext: { domain: ["orchard"] }, materialDimensions: ["domain"] as const, authority: { credentials: [] as [], policyApprovals: [] as [], capabilities: [] as [], toolAccess: [] as [], writeTargets: [] as [], executionRoutes: [] as [] } };
  return { ...unsigned, applicabilityDigest: cksApplicabilityBindingDigestV1(unsigned) };
};

const rehashObject = (value: Record<string, any>): void => { value.objectDigest = cksKnowledgeObjectDigestV1(value); };
const rehashQuery = (value: Record<string, any>): void => { value.queryDigest = cksKnowledgeQueryDigestV1(value); };
const rehashApplicability = (value: Record<string, any>): void => { value.applicabilityDigest = cksApplicabilityBindingDigestV1(value); };

test("CKS issue 281 Leaf-2 exact object/query/applicability fixtures have closed schema and runtime parity", () => {
  const ajv = new Ajv2020({ allErrors: true, strict: true });
  const validateObject = ajv.compile(schema("cks-knowledge-object-v1.schema.json"));
  const validateQuery = ajv.compile(schema("cks-knowledge-query-v1.schema.json"));
  const validateApplicability = ajv.compile(schema("cks-applicability-v1.schema.json"));
  const activeTaxonomy = taxonomy(), source = envelope(), target = object(), request = query(), binding = applicability();
  assert.deepEqual([...CKS_KNOWLEDGE_STATUSES_V1], ["ACTIVE", "SUPERSEDED"]);
  assert.deepEqual([...CKS_KNOWLEDGE_DENIAL_REASONS_V1], ["SCHEMA_DENIED", "STALE_VERSION_DENIED", "AUTHORITY_DENIED", "DIGEST_TAMPERED_DENIED", "PROVENANCE_UNRESOLVED_DENIED", "VALIDITY_DENIED", "SUPERSESSION_UNRESOLVED_DENIED", "APPLICABILITY_MISMATCH_DENIED", "CROSS_SCOPE_BINDING_DENIED"]);
  assert.equal(validateObject(target), true, JSON.stringify(validateObject.errors));
  assert.equal(validateQuery(request), true, JSON.stringify(validateQuery.errors));
  assert.equal(validateApplicability(binding), true, JSON.stringify(validateApplicability.errors));
  assert.deepEqual(validateCksKnowledgeObjectV1(target, activeTaxonomy, [source], []), []);
  assert.deepEqual(validateCksKnowledgeQueryV1(request, target), []);
  assert.deepEqual(validateCksApplicabilityBindingV1(binding, target), []);
  assert.equal(target.provenance.envelopeDigest, source.envelopeDigest);
});

test("CKS issue 281 Leaf-2 canonical object-key reorderings preserve all canonical digests and validation results", () => {
  const activeTaxonomy = taxonomy(), source = envelope(), target = object(), request = query(), binding = applicability();
  for (let replay = 0; replay < 100; replay += 1) {
    const reorder = <T>(value: T): T => {
      if (Array.isArray(value)) return value.map(reorder) as T;
      if (value !== null && typeof value === "object") {
        const record = value as Record<string, unknown>;
        return Object.fromEntries(Object.keys(record).sort((left, right) => { const a = djb2(`${replay}:${left}`), b = djb2(`${replay}:${right}`); return a === b ? left.localeCompare(right) : a - b; }).map((key) => [key, reorder(record[key])])) as T;
      }
      return value;
    };
    const reorderedObject = reorder(target), reorderedQuery = reorder(request), reorderedBinding = reorder(binding);
    assert.equal(cksKnowledgeObjectDigestV1(reorderedObject), target.objectDigest, `object:${replay}`);
    assert.equal(cksKnowledgeQueryDigestV1(reorderedQuery), request.queryDigest, `query:${replay}`);
    assert.equal(cksApplicabilityBindingDigestV1(reorderedBinding), binding.applicabilityDigest, `applicability:${replay}`);
    assert.deepEqual(validateCksKnowledgeObjectV1(reorderedObject, activeTaxonomy, [source], []), [], `object:${replay}`);
    assert.deepEqual(validateCksKnowledgeQueryV1(reorderedQuery, target), [], `query:${replay}`);
    assert.deepEqual(validateCksApplicabilityBindingV1(reorderedBinding, target), [], `applicability:${replay}`);
  }
});

test("CKS issue 281 Leaf-2 unknown fields, stale versions, digest drift, invalid validity, unresolved supersession, applicability mismatch, cross-namespace binding and authority deny", () => {
  const activeTaxonomy = taxonomy(), source = envelope(), baseObject = object(), baseQuery = query(), baseApplicability = applicability();
  const cases: Array<{ name: string; value: Record<string, any>; validate: () => readonly string[]; expected: string }> = [];
  const unknown = structuredClone(baseObject) as Record<string, any>; unknown.extra = true; cases.push({ name: "unknown", value: unknown, validate: () => validateCksKnowledgeObjectV1(unknown, activeTaxonomy, [source], []), expected: "SCHEMA_DENIED" });
  const stale = structuredClone(baseObject) as Record<string, any>; stale.schemaVersion = "chimpmaera.cks/knowledge-object/v0"; rehashObject(stale); cases.push({ name: "stale", value: stale, validate: () => validateCksKnowledgeObjectV1(stale, activeTaxonomy, [source], []), expected: "STALE_VERSION_DENIED" });
  const drift = structuredClone(baseObject) as Record<string, any>; drift.objectDigest = DIGEST; cases.push({ name: "drift", value: drift, validate: () => validateCksKnowledgeObjectV1(drift, activeTaxonomy, [source], []), expected: "DIGEST_TAMPERED_DENIED" });
  const invalidValidity = structuredClone(baseObject) as Record<string, any>; invalidValidity.validity.notAfterMs = 999; rehashObject(invalidValidity); cases.push({ name: "validity", value: invalidValidity, validate: () => validateCksKnowledgeObjectV1(invalidValidity, activeTaxonomy, [source], []), expected: "VALIDITY_DENIED" });
  const unresolved = structuredClone(baseObject) as Record<string, any>; unresolved.supersedes = [{ objectId: "knowledge:missing-object", objectDigest: DIGEST }]; rehashObject(unresolved); cases.push({ name: "supersession", value: unresolved, validate: () => validateCksKnowledgeObjectV1(unresolved, activeTaxonomy, [source], []), expected: "SUPERSESSION_UNRESOLVED_DENIED" });
  const mismatch = structuredClone(baseApplicability) as Record<string, any>; mismatch.materialDimensions = ["domain", "industry"]; rehashApplicability(mismatch); cases.push({ name: "applicability", value: mismatch, validate: () => validateCksApplicabilityBindingV1(mismatch, baseObject), expected: "APPLICABILITY_MISMATCH_DENIED" });
  const crossScope = structuredClone(baseQuery) as Record<string, any>; crossScope.scopeNamespace = "synthetic:other"; rehashQuery(crossScope); cases.push({ name: "cross-scope", value: crossScope, validate: () => validateCksKnowledgeQueryV1(crossScope, baseObject), expected: "CROSS_SCOPE_BINDING_DENIED" });
  const authority = structuredClone(baseApplicability) as Record<string, any>; authority.authority.credentials = ["credential:forbidden"]; rehashApplicability(authority); cases.push({ name: "authority", value: authority, validate: () => validateCksApplicabilityBindingV1(authority, baseObject), expected: "AUTHORITY_DENIED" });
  for (const probe of cases) assert.ok(probe.validate().includes(probe.expected), `${probe.name}:${JSON.stringify(probe.validate())}`);
});

test("CKS issue 281 Leaf-2 supersession resolution rejects structurally incomplete and digest-forged matching candidates", () => {
  const activeTaxonomy = taxonomy(), source = envelope(), baseObject = object();
  const predecessor = structuredClone(baseObject) as Record<string, any>;
  predecessor.objectId = "knowledge:cks-pruning-predecessor";
  rehashObject(predecessor);
  const successor = structuredClone(baseObject) as Record<string, any>;
  successor.supersedes = [{ objectId: predecessor.objectId, objectDigest: predecessor.objectDigest }];
  rehashObject(successor);
  const validateWith = (candidate: unknown): readonly string[] => validateCksKnowledgeObjectV1(successor, activeTaxonomy, [source], [candidate as CksKnowledgeObjectV1]);
  assert.deepEqual(validateWith(predecessor), []);
  assert.deepEqual(validateWith({ objectId: predecessor.objectId, objectDigest: predecessor.objectDigest }), ["SUPERSESSION_UNRESOLVED_DENIED"]);
  const digestForged = structuredClone(predecessor) as Record<string, any>;
  digestForged.maturityLevel = "L2";
  assert.deepEqual(validateWith(digestForged), ["SUPERSESSION_UNRESOLVED_DENIED"]);
});

test("query and applicability deny when the supplied knowledge object bytes drift behind its digest", () => {
  const forgedObject = structuredClone(object()) as Record<string, any>;
  forgedObject.maturityLevel = "L2";
  assert.ok(validateCksKnowledgeQueryV1(query(), forgedObject as CksKnowledgeObjectV1).includes("DIGEST_TAMPERED_DENIED"));
  assert.ok(validateCksApplicabilityBindingV1(applicability(), forgedObject as CksKnowledgeObjectV1).includes("DIGEST_TAMPERED_DENIED"));
});

test("CKS issue 281 Leaf-2 unsafe integer timestamps deny with schema and runtime parity", () => {
  const ajv = new Ajv2020({ allErrors: true, strict: true });
  const validateObject = ajv.compile(schema("cks-knowledge-object-v1.schema.json"));
  const validateQuery = ajv.compile(schema("cks-knowledge-query-v1.schema.json"));
  const activeTaxonomy = taxonomy(), source = envelope();
  const unsafeInteger = Number.MAX_SAFE_INTEGER + 1;
  const notBefore = structuredClone(object()) as Record<string, any>;
  notBefore.validity.notBeforeMs = unsafeInteger;
  rehashObject(notBefore);
  const notAfter = structuredClone(object()) as Record<string, any>;
  notAfter.validity.notAfterMs = unsafeInteger;
  rehashObject(notAfter);
  const requestedAt = structuredClone(query()) as Record<string, any>;
  requestedAt.requestedAtMs = unsafeInteger;
  rehashQuery(requestedAt);
  const probes = [
    { name: "notBeforeMs", value: notBefore, schemaValidate: validateObject, runtimeValidate: () => validateCksKnowledgeObjectV1(notBefore, activeTaxonomy, [source], []) },
    { name: "notAfterMs", value: notAfter, schemaValidate: validateObject, runtimeValidate: () => validateCksKnowledgeObjectV1(notAfter, activeTaxonomy, [source], []) },
    { name: "requestedAtMs", value: requestedAt, schemaValidate: validateQuery, runtimeValidate: () => validateCksKnowledgeQueryV1(requestedAt, object()) },
  ];
  for (const probe of probes) {
    assert.equal(probe.schemaValidate(probe.value), false, `${probe.name}:schema accepted ${unsafeInteger}`);
    assert.deepEqual(probe.runtimeValidate(), ["SCHEMA_DENIED"], `${probe.name}:runtime`);
  }
});
