#!/usr/bin/env node
/**
 * CKS-10 authority-free analytic candidate return contract validator
 * (cks-10/candidate-return/v1 @ 1.0.0).
 *
 * This is a local, deterministic contract gate. It validates the closed schema,
 * exact digest rules, evidence references, bounded confidence and blind spots,
 * and the fixed authority-free boundary. It does not ingest, retain, promote,
 * execute, call a service, or access the wall clock.
 *
 * Usage:
 *   node scripts/validate-cks-10-candidate-return.mjs tests/fixtures/cks-10/candidate-return-cases-v1.json
 *   node scripts/validate-cks-10-candidate-return.mjs --self-test
 *
 * Canonical JSON sorts object keys at every depth, preserves array order, and
 * omits insignificant whitespace. candidateEnvelope.envelopeDigest covers the
 * complete return with that digest removed; candidate.candidateDigest covers the
 * complete candidate object with that digest removed. The schema digest is the
 * SHA-256 of the committed schema file bytes.
 */
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const SCHEMA_REL = "contracts/cks-10/analytic-candidate-return-v1.schema.json";
const FIXTURE_REL = "tests/fixtures/cks-10/candidate-return-cases-v1.json";
const AUTHORITY_PROJECTION_REL = "tests/fixtures/cks-10/projection-contract-v1.json";
const DIGEST_RE = /^[a-f0-9]{64}$/;
const INSTANT_RE = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})Z$/;
const FORBIDDEN_KEY_RE = /(authority|promotion|workflow|function|capability|action)/i;
const FIXED_NEGATIVE_MARKER_POINTERS = new Set([
  "#/boundary/authorityClass",
  "#/boundary/promotionClaim",
]);

const sha256Hex = (bytes) => createHash("sha256").update(bytes).digest("hex");
const isObject = (value) => value !== null && typeof value === "object" && !Array.isArray(value);

/** Canonical JSON: keys sorted lexicographically at every depth, arrays retain order. */
function canonicalize(value) {
  if (Array.isArray(value)) return `[${value.map(canonicalize).join(",")}]`;
  if (isObject(value)) {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonicalize(value[key])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

function deepEqual(left, right) {
  return canonicalize(left) === canonicalize(right);
}

function resolveRef(root, ref) {
  if (typeof ref !== "string" || !ref.startsWith("#/")) return null;
  let node = root;
  for (const rawPart of ref.slice(2).split("/")) {
    const part = rawPart.replace(/~1/g, "/").replace(/~0/g, "~");
    if (!isObject(node) || !Object.hasOwn(node, part)) return null;
    node = node[part];
  }
  return node;
}

function typeMatches(value, type) {
  switch (type) {
    case "object": return isObject(value);
    case "array": return Array.isArray(value);
    case "string": return typeof value === "string";
    case "number": return typeof value === "number" && Number.isFinite(value);
    case "integer": return Number.isInteger(value);
    case "boolean": return typeof value === "boolean";
    case "null": return value === null;
    default: return true;
  }
}

/** Minimal draft-2020-12 evaluator for the closed schema used by this contract. */
function evaluate(value, schema, root, pointer, issues) {
  if (!isObject(schema)) {
    issues.push(`SCHEMA_INVALID_NODE:${pointer}`);
    return;
  }
  if (schema.$ref !== undefined) {
    const target = resolveRef(root, schema.$ref);
    if (target === null) issues.push(`SCHEMA_REF:${pointer}:${schema.$ref}`);
    else evaluate(value, target, root, pointer, issues);
    return;
  }
  if (schema.const !== undefined && !deepEqual(value, schema.const)) {
    issues.push(`SCHEMA_CONST:${pointer}`);
    return;
  }
  if (Array.isArray(schema.enum) && !schema.enum.some((candidate) => deepEqual(candidate, value))) {
    issues.push(`SCHEMA_ENUM:${pointer}`);
    return;
  }
  if (schema.type !== undefined && !typeMatches(value, schema.type)) {
    issues.push(`SCHEMA_TYPE:${pointer}`);
    return;
  }
  if (typeof value === "string") {
    if (typeof schema.pattern === "string") {
      try {
        if (!new RegExp(schema.pattern, "u").test(value)) issues.push(`SCHEMA_PATTERN:${pointer}`);
      } catch {
        issues.push(`SCHEMA_PATTERN:${pointer}`);
      }
    }
    if (typeof schema.minLength === "number" && [...value].length < schema.minLength) issues.push(`SCHEMA_MINLENGTH:${pointer}`);
    if (typeof schema.maxLength === "number" && [...value].length > schema.maxLength) issues.push(`SCHEMA_MAXLENGTH:${pointer}`);
  }
  if (typeof value === "number") {
    if (typeof schema.minimum === "number" && value < schema.minimum) issues.push(`SCHEMA_MINIMUM:${pointer}`);
    if (typeof schema.maximum === "number" && value > schema.maximum) issues.push(`SCHEMA_MAXIMUM:${pointer}`);
  }
  if (Array.isArray(value)) {
    if (typeof schema.minItems === "number" && value.length < schema.minItems) issues.push(`SCHEMA_MINITEMS:${pointer}`);
    if (typeof schema.maxItems === "number" && value.length > schema.maxItems) issues.push(`SCHEMA_MAXITEMS:${pointer}`);
    if (schema.uniqueItems === true) {
      const unique = new Set(value.map(canonicalize));
      if (unique.size !== value.length) issues.push(`SCHEMA_UNIQUEITEMS:${pointer}`);
    }
    if (schema.items !== undefined) value.forEach((item, index) => evaluate(item, schema.items, root, `${pointer}/${index}`, issues));
  }
  if (isObject(value)) {
    if (Array.isArray(schema.required)) {
      for (const key of schema.required) {
        if (!Object.hasOwn(value, key)) issues.push(`SCHEMA_REQUIRED:${pointer}/${key}`);
      }
    }
    const properties = isObject(schema.properties) ? schema.properties : null;
    if (properties !== null) {
      for (const [key, childSchema] of Object.entries(properties)) {
        if (Object.hasOwn(value, key)) evaluate(value[key], childSchema, root, `${pointer}/${key}`, issues);
      }
      if (schema.additionalProperties === false) {
        for (const key of Object.keys(value)) {
          if (!Object.hasOwn(properties, key)) issues.push(`SCHEMA_UNKNOWN_FIELD:${pointer}/${key}`);
        }
      }
    }
  }
}

/** Deterministic UTC instant parsing; null means malformed or impossible calendar time. */
function instantMs(value) {
  const match = typeof value === "string" ? INSTANT_RE.exec(value) : null;
  if (match === null) return null;
  const [year, month, day, hour, minute, second] = match.slice(1).map(Number);
  if (year < 1 || month < 1 || month > 12 || hour > 23 || minute > 59 || second > 59) return null;
  const date = new Date(Date.UTC(0, month - 1, day, hour, minute, second));
  date.setUTCFullYear(year);
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day && date.getUTCHours() === hour &&
    date.getUTCMinutes() === minute && date.getUTCSeconds() === second
    ? date.getTime() : null;
}

function timeIssues(candidateReturn, issues) {
  const time = isObject(candidateReturn.time) ? candidateReturn.time : null;
  if (time === null) return;
  const generated = instantMs(time.generatedAt);
  const fresh = instantMs(time.freshUntil);
  const retain = instantMs(time.retainUntil);
  if (generated === null) issues.push("TIME_INVALID_INSTANT_GENERATED_AT");
  if (fresh === null) issues.push("TIME_INVALID_INSTANT_FRESH_UNTIL");
  if (retain === null) issues.push("TIME_INVALID_INSTANT_RETAIN_UNTIL");
  if (generated !== null && fresh !== null && !(generated < fresh)) issues.push("TIME_ORDER_VIOLATION_GENERATED_BEFORE_FRESH");
  if (generated !== null && retain !== null && !(generated < retain)) issues.push("TIME_ORDER_VIOLATION_GENERATED_BEFORE_RETAIN");
  if (fresh !== null && retain !== null && !(retain <= fresh)) issues.push("TIME_ORDER_VIOLATION_RETAIN_EXCEEDS_FRESH");
}

function digestIssues(candidateReturn, schemaBytes, issues) {
  const envelope = candidateReturn.candidateEnvelope;
  if (isObject(envelope) && typeof envelope.envelopeDigest === "string") {
    const base = structuredClone(candidateReturn);
    delete base.candidateEnvelope.envelopeDigest;
    if (sha256Hex(canonicalize(base)) !== envelope.envelopeDigest) issues.push("ENVELOPE_DIGEST_MISMATCH");
  }
  const candidate = candidateReturn.candidate;
  if (isObject(candidate) && typeof candidate.candidateDigest === "string") {
    const base = structuredClone(candidate);
    delete base.candidateDigest;
    if (sha256Hex(canonicalize(base)) !== candidate.candidateDigest) issues.push("CANDIDATE_DIGEST_MISMATCH");
  }
  const contract = candidateReturn.contract;
  if (isObject(contract) && typeof contract.contractSchemaDigest === "string" &&
      contract.contractSchemaDigest !== sha256Hex(schemaBytes)) {
    issues.push("CONTRACT_SCHEMA_DIGEST_MISMATCH");
  }
}

const FROZEN_BOUNDARY = {
  lifecycleClass: "UNTRUSTED_CANDIDATE",
  authorityClass: "NONE",
  effectClass: "NONE",
  requestedDisposition: "REVIEW_ONLY",
  promotionClaim: "NONE",
};

const FROZEN_EXCLUDED_FIELDS = [
  "AUTHORITY_OR_APPROVAL",
  "PROMOTION_OR_PUBLICATION",
  "WORKFLOW_OR_FUNCTION_DEFINITION",
  "CAPABILITY_OR_EXECUTION_BINDING",
  "ACTION_OR_EFFECT_PAYLOAD",
  "SECRETS_CREDENTIALS_TOKENS_KEYS_COOKIES_OR_SIGNING_MATERIAL",
  "RAW_PROMPTS_COMPLETIONS_MESSAGES_TRACES_OR_CHAIN_OF_THOUGHT",
  "RAW_ROWS_SQL_FILES_BINARY_BLOBS_OR_FULL_ASSET_BODIES",
  "MUTABLE_POLICY_LEASE_INVALIDATION_OR_LIFECYCLE_STATE",
  "CALLBACKS_ARBITRARY_ROUTES_HOSTS_PATHS_OR_NETWORK_IDENTIFIERS",
];

function boundaryIssues(candidateReturn, issues) {
  if (candidateReturn.boundary !== undefined && !deepEqual(candidateReturn.boundary, FROZEN_BOUNDARY)) issues.push("BOUNDARY_MISMATCH");
  if (candidateReturn.excludedFields !== undefined && !deepEqual(candidateReturn.excludedFields, FROZEN_EXCLUDED_FIELDS)) issues.push("EXCLUDED_FIELDS_MISMATCH");
}

function referenceIssues(candidateReturn, issues) {
  const refs = Array.isArray(candidateReturn.evidenceRefs) ? candidateReturn.evidenceRefs : [];
  const seenEvidence = new Set();
  const seenSources = new Set();
  for (const ref of refs) {
    if (!isObject(ref)) continue;
    if (typeof ref.evidenceId === "string") {
      if (seenEvidence.has(ref.evidenceId)) issues.push(`DUPLICATE_EVIDENCE_ID:${ref.evidenceId}`);
      seenEvidence.add(ref.evidenceId);
    }
    if (typeof ref.sourceAssetId === "string" && typeof ref.sourceAssetVersion === "string") {
      const sourceKey = `${ref.sourceAssetId}@${ref.sourceAssetVersion}`;
      if (seenSources.has(sourceKey)) issues.push(`DUPLICATE_SOURCE_ASSET_REF:${sourceKey}`);
      seenSources.add(sourceKey);
    }
  }
  if (refs.length === 0) issues.push("EVIDENCE_REFS_MISSING");
}

function identity(id, version, digest) {
  return { id, version, digest };
}

function authorityBindingIssues(candidateReturn, authorityProjection, issues) {
  if (!isObject(authorityProjection)) {
    issues.push("AUTHORITY_PROJECTION_REQUIRED");
    return;
  }
  if (!deepEqual(candidateReturn.projection, {
    projectionId: authorityProjection.exchange?.projectionId,
    projectionVersion: authorityProjection.exchange?.projectionVersion,
    projectionDigest: authorityProjection.exchange?.projectionDigest,
  })) issues.push("AUTHORITY_PROJECTION_BINDING_MISMATCH");
  if (!deepEqual(candidateReturn.exchange, {
    exchangeId: authorityProjection.exchange?.exchangeId,
    replayId: authorityProjection.exchange?.replayId,
  })) issues.push("AUTHORITY_EXCHANGE_BINDING_MISMATCH");
  if (!deepEqual(candidateReturn.tenantScope, {
    opaqueTenantScopeId: authorityProjection.tenantScope?.opaqueTenantScopeId,
    scopeId: authorityProjection.tenantScope?.scope?.scopeId,
    scopeVersion: authorityProjection.tenantScope?.scope?.scopeVersion,
    scopeDigest: authorityProjection.tenantScope?.scope?.scopeDigest,
    scopeDecision: identity(
      authorityProjection.tenantScope?.scopeDecision?.decisionId,
      authorityProjection.tenantScope?.scopeDecision?.decisionVersion,
      authorityProjection.tenantScope?.scopeDecision?.decisionDigest,
    ),
  })) issues.push("AUTHORITY_SCOPE_BINDING_MISMATCH");
  if (!deepEqual(candidateReturn.purpose, {
    purposeClass: authorityProjection.purpose?.purposeClass,
    purposeRegistry: identity(
      authorityProjection.purpose?.purposeRegistry?.registryId,
      authorityProjection.purpose?.purposeRegistry?.registryVersion,
      authorityProjection.purpose?.purposeRegistry?.registryDigest,
    ),
  })) issues.push("AUTHORITY_PURPOSE_BINDING_MISMATCH");
  if (!deepEqual(candidateReturn.projectionPeers, {
    producer: identity(authorityProjection.producer?.producerId, authorityProjection.producer?.producerVersion, authorityProjection.producer?.producerDigest),
    consumer: identity(authorityProjection.intendedConsumer?.consumerId, authorityProjection.intendedConsumer?.consumerVersion, authorityProjection.intendedConsumer?.consumerDigest),
  })) issues.push("AUTHORITY_PEER_BINDING_MISMATCH");
  const sourceTriples = new Set((authorityProjection.records ?? []).flatMap((record) => record.sources ?? [])
    .map((source) => `${source.assetId}@${source.assetVersion}@${source.assetDigest}`));
  for (const ref of candidateReturn.evidenceRefs ?? []) {
    if (!sourceTriples.has(`${ref?.sourceAssetId}@${ref?.sourceAssetVersion}@${ref?.sourceAssetDigest}`)) {
      issues.push(`AUTHORITY_EVIDENCE_OUT_OF_SCOPE:${ref?.evidenceId ?? "MISSING_ID"}`);
    }
  }
  const projectionIssued = instantMs(authorityProjection.time?.issuedAt);
  const projectionFresh = instantMs(authorityProjection.time?.freshUntil);
  const projectionRetain = instantMs(authorityProjection.time?.retainUntil);
  const generated = instantMs(candidateReturn.time?.generatedAt);
  const fresh = instantMs(candidateReturn.time?.freshUntil);
  const retain = instantMs(candidateReturn.time?.retainUntil);
  if ([projectionIssued, projectionFresh, projectionRetain, generated, fresh, retain].every((value) => value !== null) &&
      (!(projectionIssued <= generated) || !(fresh <= projectionFresh) || !(retain <= projectionRetain))) {
    issues.push("AUTHORITY_TIME_BOUNDARY_WIDENED");
  }
}

function forbiddenFieldIssues(value, pointer, issues) {
  if (Array.isArray(value)) {
    value.forEach((item, index) => forbiddenFieldIssues(item, `${pointer}/${index}`, issues));
    return;
  }
  if (!isObject(value)) return;
  for (const [key, child] of Object.entries(value)) {
    const childPointer = `${pointer}/${key}`;
    if (FORBIDDEN_KEY_RE.test(key) && !FIXED_NEGATIVE_MARKER_POINTERS.has(childPointer)) {
      issues.push(`FORBIDDEN_FIELD:${childPointer}`);
    }
    forbiddenFieldIssues(child, childPointer, issues);
  }
}

function validateReturn(candidateReturn, rawText, schemaBytes, authorityProjection) {
  const issues = [];
  let schema;
  try {
    schema = JSON.parse(schemaBytes);
  } catch {
    schema = null;
    issues.push("SCHEMA_INVALID_JSON");
  }
  if (!isObject(candidateReturn)) {
    issues.push("RETURN_NOT_OBJECT");
  } else {
    if (schema !== null) evaluate(candidateReturn, schema, schema, "#", issues);
    timeIssues(candidateReturn, issues);
    digestIssues(candidateReturn, schemaBytes, issues);
    referenceIssues(candidateReturn, issues);
    authorityBindingIssues(candidateReturn, authorityProjection, issues);
    boundaryIssues(candidateReturn, issues);
    forbiddenFieldIssues(candidateReturn, "#", issues);
    for (const [index, ref] of (Array.isArray(candidateReturn.evidenceRefs) ? candidateReturn.evidenceRefs : []).entries()) {
      if (isObject(ref) && typeof ref.evidenceDigest === "string" && !DIGEST_RE.test(ref.evidenceDigest)) {
        issues.push(`EVIDENCE_DIGEST_INVALID:${index}`);
      }
    }
  }
  return [...new Set(issues)];
}

function report(label, path, issues, candidateReturn = null) {
  if (issues.length === 0) {
    const candidates = isObject(candidateReturn?.candidate) ? 1 : 0;
    const evidence = Array.isArray(candidateReturn?.evidenceRefs) ? candidateReturn.evidenceRefs.length : 0;
    console.log(`cks-10-candidate-return: PASS ${label}=${path} candidates=${candidates} evidence=${evidence} issues=0`);
    return 0;
  }
  for (const issue of issues) console.log(`cks-10-candidate-return: ISSUE ${issue}`);
  console.log(`cks-10-candidate-return: FAIL ${label}=${path} issues=${issues.length}`);
  return 1;
}

function validateFixturePath(fixturePath) {
  let rawText;
  let candidateReturn;
  try {
    rawText = readFileSync(fixturePath, "utf8");
    candidateReturn = JSON.parse(rawText);
  } catch (error) {
    return report("fixture", fixturePath, [error?.code === "ENOENT" ? "MISSING_FILE" : "INVALID_JSON"]);
  }
  const schemaBytes = readFileSync(resolve(ROOT, SCHEMA_REL), "utf8");
  const authorityProjection = JSON.parse(readFileSync(resolve(ROOT, AUTHORITY_PROJECTION_REL), "utf8"));
  return report("fixture", fixturePath, validateReturn(candidateReturn, rawText, schemaBytes, authorityProjection), candidateReturn);
}

function selfTest() {
  const failures = [];
  let cases = 0;
  let baseline;
  let rawText;
  let schemaBytes;
  let authorityProjection;
  try {
    rawText = readFileSync(resolve(ROOT, FIXTURE_REL), "utf8");
    baseline = JSON.parse(rawText);
    schemaBytes = readFileSync(resolve(ROOT, SCHEMA_REL), "utf8");
    authorityProjection = JSON.parse(readFileSync(resolve(ROOT, AUTHORITY_PROJECTION_REL), "utf8"));
  } catch (error) {
    console.log(`cks-10-candidate-return: SELF_TEST FAIL setup=${error?.code ?? "ERROR"}`);
    return 1;
  }
  cases += 1;
  const baselineIssues = validateReturn(baseline, rawText, schemaBytes, authorityProjection);
  if (baselineIssues.length !== 0) failures.push(`baseline: [${baselineIssues.join(", ")}]`);

  const check = (name, mutate, expected) => {
    cases += 1;
    const candidateReturn = structuredClone(baseline);
    mutate(candidateReturn);
    const issues = validateReturn(candidateReturn, JSON.stringify(candidateReturn), schemaBytes, authorityProjection);
    const missing = expected.filter((prefix) => !issues.some((issue) => issue.startsWith(prefix)));
    if (issues.length === 0 || missing.length > 0) {
      failures.push(`${name}: missing [${missing.join(", ")}], got [${issues.join(", ")}]`);
    }
  };

  check("unknown-top-level-field", (value) => { value.extra = true; }, ["SCHEMA_UNKNOWN_FIELD"]);
  check("missing-evidence-references", (value) => { delete value.evidenceRefs; }, ["SCHEMA_REQUIRED", "EVIDENCE_REFS_MISSING"]);
  check("malformed-evidence-digest", (value) => { value.evidenceRefs[0].evidenceDigest = "not-a-digest"; }, ["SCHEMA_PATTERN", "EVIDENCE_DIGEST_INVALID"]);
  check("candidate-digest-corruption", (value) => { value.candidate.candidateDigest = "0".repeat(64); }, ["CANDIDATE_DIGEST_MISMATCH"]);
  check("envelope-digest-corruption", (value) => { value.candidateEnvelope.envelopeDigest = "0".repeat(64); }, ["ENVELOPE_DIGEST_MISMATCH"]);
  check("schema-digest-corruption", (value) => { value.contract.contractSchemaDigest = "0".repeat(64); }, ["CONTRACT_SCHEMA_DIGEST_MISMATCH"]);
  check("authority-field", (value) => { value.candidate.authority = "FULL"; }, ["SCHEMA_UNKNOWN_FIELD", "FORBIDDEN_FIELD"]);
  check("promotion-field", (value) => { value.candidate.promotion = "APPROVE"; }, ["SCHEMA_UNKNOWN_FIELD", "FORBIDDEN_FIELD"]);
  check("workflow-field", (value) => { value.candidate.workflow = { id: "run-1" }; }, ["SCHEMA_UNKNOWN_FIELD", "FORBIDDEN_FIELD"]);
  check("function-field", (value) => { value.candidate.function = { id: "fn-1" }; }, ["SCHEMA_UNKNOWN_FIELD", "FORBIDDEN_FIELD"]);
  check("capability-field", (value) => { value.candidate.capability = "execute"; }, ["SCHEMA_UNKNOWN_FIELD", "FORBIDDEN_FIELD"]);
  check("action-field", (value) => { value.candidate.action = "write"; }, ["SCHEMA_UNKNOWN_FIELD", "FORBIDDEN_FIELD"]);
  check("camel-case-authority-field", (value) => { value.candidate.authorityGrant = "FULL"; }, ["SCHEMA_UNKNOWN_FIELD", "FORBIDDEN_FIELD"]);
  check("camel-case-action-field", (value) => { value.candidate.actionPayload = "write"; }, ["SCHEMA_UNKNOWN_FIELD", "FORBIDDEN_FIELD"]);
  check("boundary-escalation", (value) => { value.boundary.authorityClass = "FULL"; }, ["SCHEMA_CONST", "BOUNDARY_MISMATCH"]);
  check("promotion-marker-escalation", (value) => { value.boundary.promotionClaim = "PROMOTED"; }, ["SCHEMA_CONST", "BOUNDARY_MISMATCH"]);
  check("missing-proposed-kind", (value) => { delete value.candidate.proposedKind; }, ["SCHEMA_REQUIRED"]);
  check("unknown-proposed-kind", (value) => { value.candidate.proposedKind = "ACTION_CANDIDATE"; }, ["SCHEMA_ENUM"]);
  check("missing-blind-spots", (value) => { value.blindSpots = []; }, ["SCHEMA_MINITEMS"]);
  check("missing-confidence", (value) => { delete value.confidence; }, ["SCHEMA_REQUIRED"]);
  check("confidence-out-of-range", (value) => { value.confidence.score = 2; }, ["SCHEMA_MAXIMUM"]);
  check("time-order", (value) => { value.time.retainUntil = "2026-08-28T05:30:00Z"; }, ["TIME_ORDER_VIOLATION_RETAIN_EXCEEDS_FRESH"]);
  check("retain-not-after-generated", (value) => { value.time.retainUntil = value.time.generatedAt; }, ["TIME_ORDER_VIOLATION_GENERATED_BEFORE_RETAIN"]);
  check("impossible-calendar-time", (value) => { value.time.generatedAt = "2026-02-29T04:30:00Z"; }, ["TIME_INVALID_INSTANT_GENERATED_AT"]);
  check("duplicate-evidence-reference", (value) => { value.evidenceRefs[1].evidenceId = value.evidenceRefs[0].evidenceId; }, ["DUPLICATE_EVIDENCE_ID"]);
  check("duplicate-source-reference", (value) => {
    value.evidenceRefs[1].sourceAssetId = value.evidenceRefs[0].sourceAssetId;
    value.evidenceRefs[1].sourceAssetVersion = value.evidenceRefs[0].sourceAssetVersion;
  }, ["DUPLICATE_SOURCE_ASSET_REF"]);
  check("excluded-fields-tamper", (value) => { value.excludedFields.pop(); }, ["SCHEMA_CONST", "EXCLUDED_FIELDS_MISMATCH"]);
  check("paired-scope-substitution-redigested", (value) => {
    value.tenantScope.scopeId = "scope.cks10.paired-substitution";
    const base = structuredClone(value);
    delete base.candidateEnvelope.envelopeDigest;
    value.candidateEnvelope.envelopeDigest = sha256Hex(canonicalize(base));
  }, ["AUTHORITY_SCOPE_BINDING_MISMATCH"]);

  if (failures.length > 0) {
    for (const failure of failures) console.log(`cks-10-candidate-return: SELF_TEST_FAILURE ${failure}`);
    console.log(`cks-10-candidate-return: SELF_TEST FAIL cases=${cases} failures=${failures.length}`);
    return 1;
  }
  console.log(`cks-10-candidate-return: SELF_TEST PASS cases=${cases} failures=0`);
  return 0;
}

function main(argv) {
  const args = argv.slice(2);
  if (args.includes("--self-test")) return selfTest();
  if (args.length !== 1 || args[0] === "--help" || args[0] === "-h") {
    console.error("usage: node scripts/validate-cks-10-candidate-return.mjs <fixture.json> | --self-test");
    return 2;
  }
  return validateFixturePath(resolve(process.cwd(), args[0]));
}

process.exitCode = main(process.argv);
