#!/usr/bin/env node
/**
 * CKS-10 minimized read-only Task-Knowledge-Decision-Outcome projection
 * contract validator (cks-10/minimized-projection/v1 @ 1.0.0).
 *
 * Frozen by docs/architecture/cks-10-analytics-bridge-decision-v1.md
 * (CKS-10-BOUNDARY-DECISION-V1). This validator freezes the closed schema,
 * the canonical digest rule, and the fail-closed boundary checks. It adds no
 * runtime, endpoint, connector, or activation.
 *
 * Usage:
 *   node scripts/validate-cks-10-projection-contract.mjs <fixture.json>
 *   node scripts/validate-cks-10-projection-contract.mjs --self-test
 *
 * Digest rule:
 *   Canonical form is the UTF-8 JSON rendering of the envelope with object
 *   keys sorted lexicographically at every depth, array order preserved, and
 *   no insignificant whitespace. The self digest
 *   (exchange.projectionDigest) is the SHA-256 hex of the canonical form of
 *   the full envelope with that key removed. contract.contractSchemaDigest
 *   is the SHA-256 hex of the schema file bytes as committed.
 *
 * Fail-closed: any missing, malformed, unknown, mismatched, impossible-time,
 * unresolved, out-of-scope, drifted, or secret-bearing material is a denial.
 * The validator performs no wall-clock access: time bounds are validated as
 * deterministic ordering over the declared instants; live ingress re-checks
 * the trusted clock, Policy, and invalidation state separately.
 */
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const SCHEMA_REL = "contracts/cks-10/knowledge-projection-v1.schema.json";
const FIXTURE_REL = "tests/fixtures/cks-10/projection-contract-v1.json";

const sha256Hex = (bytes) => createHash("sha256").update(bytes).digest("hex");
const isObj = (v) => v !== null && typeof v === "object" && !Array.isArray(v);

/** Canonical JSON: keys sorted lexicographically at every depth, arrays keep order. */
function canonicalize(value) {
  const walk = (v) => {
    if (Array.isArray(v)) return `[${v.map(walk).join(",")}]`;
    if (v !== null && typeof v === "object") {
      return `{${Object.keys(v)
        .sort()
        .map((k) => `${JSON.stringify(k)}:${walk(v[k])}`)
        .join(",")}}`;
    }
    return JSON.stringify(v);
  };
  return walk(value);
}

function deepEqual(a, b) {
  return canonicalize(a) === canonicalize(b);
}

function resolveRef(root, ref) {
  if (typeof ref !== "string" || !ref.startsWith("#/")) return null;
  let node = root;
  for (const raw of ref.slice(2).split("/")) {
    const part = raw.replace(/~1/g, "/").replace(/~0/g, "~");
    if (!isObj(node) || !Object.hasOwn(node, part)) return null;
    node = node[part];
  }
  return node;
}

function typeMatches(value, type) {
  switch (type) {
    case "object":
      return isObj(value);
    case "array":
      return Array.isArray(value);
    case "string":
      return typeof value === "string";
    case "boolean":
      return typeof value === "boolean";
    case "integer":
      return Number.isInteger(value);
    case "number":
      return typeof value === "number" && Number.isFinite(value);
    case "null":
      return value === null;
    default:
      return true;
  }
}

/**
 * Minimal draft-2020-12 evaluator covering exactly the keyword subset the
 * CKS-10 projection schema uses: $ref (local), const, enum, oneOf, anyOf,
 * type, pattern, minLength, maxLength, minimum, maximum, minItems, maxItems,
 * required, properties, additionalProperties, items, allOf, contains. Unknown keywords are
 * not silently ignored by callers: the schema is reviewed as a whole.
 */
function evaluate(value, schema, root, pointer, issues) {
  if (!isObj(schema)) {
    issues.push(`SCHEMA_INVALID_NODE:${pointer}`);
    return;
  }
  if (schema.$ref !== undefined) {
    const target = resolveRef(root, schema.$ref);
    if (target === null) {
      issues.push(`SCHEMA_REF:${pointer}:${schema.$ref}`);
      return;
    }
    evaluate(value, target, root, pointer, issues);
    return;
  }
  if (schema.const !== undefined && !deepEqual(value, schema.const)) {
    issues.push(`SCHEMA_CONST:${pointer}`);
    return;
  }
  if (schema.enum !== undefined && !schema.enum.some((candidate) => deepEqual(candidate, value))) {
    issues.push(`SCHEMA_ENUM:${pointer}`);
    return;
  }
  if (Array.isArray(schema.oneOf)) {
    const matches = schema.oneOf.filter((candidate) => {
      const nested = [];
      evaluate(value, candidate, root, pointer, nested);
      return nested.length === 0;
    });
    if (matches.length !== 1) {
      issues.push(`SCHEMA_ONEOF:${pointer}`);
      return;
    }
    return;
  }
  if (Array.isArray(schema.anyOf)) {
    const ok = schema.anyOf.some((candidate) => {
      const nested = [];
      evaluate(value, candidate, root, pointer, nested);
      return nested.length === 0;
    });
    if (!ok) {
      issues.push(`SCHEMA_ANYOF:${pointer}`);
      return;
    }
    return;
  }
  if (Array.isArray(schema.allOf)) {
    for (const candidate of schema.allOf) evaluate(value, candidate, root, pointer, issues);
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
    if (typeof schema.minLength === "number" && [...value].length < schema.minLength) {
      issues.push(`SCHEMA_MINLENGTH:${pointer}`);
    }
    if (typeof schema.maxLength === "number" && [...value].length > schema.maxLength) {
      issues.push(`SCHEMA_MAXLENGTH:${pointer}`);
    }
  }
  if (typeof value === "number") {
    if (typeof schema.minimum === "number" && value < schema.minimum) issues.push(`SCHEMA_MINIMUM:${pointer}`);
    if (typeof schema.maximum === "number" && value > schema.maximum) issues.push(`SCHEMA_MAXIMUM:${pointer}`);
  }
  if (Array.isArray(value)) {
    if (typeof schema.minItems === "number" && value.length < schema.minItems) {
      issues.push(`SCHEMA_MINITEMS:${pointer}`);
    }
    if (typeof schema.maxItems === "number" && value.length > schema.maxItems) {
      issues.push(`SCHEMA_MAXITEMS:${pointer}`);
    }
    if (schema.items !== undefined) {
      value.forEach((item, index) => evaluate(item, schema.items, root, `${pointer}/${index}`, issues));
    }
    if (schema.contains !== undefined) {
      const matches = value.filter((item) => {
        const nested = [];
        evaluate(item, schema.contains, root, pointer, nested);
        return nested.length === 0;
      }).length;
      const minimum = typeof schema.minContains === "number" ? schema.minContains : 1;
      if (matches < minimum) issues.push(`SCHEMA_CONTAINS:${pointer}`);
    }
  }
  if (isObj(value)) {
    if (Array.isArray(schema.required)) {
      for (const key of schema.required) {
        if (!Object.hasOwn(value, key)) issues.push(`SCHEMA_REQUIRED:${pointer}/${key}`);
      }
    }
    const props = isObj(schema.properties) ? schema.properties : null;
    if (props !== null) {
      for (const [key, subSchema] of Object.entries(props)) {
        if (Object.hasOwn(value, key)) evaluate(value[key], subSchema, root, `${pointer}/${key}`, issues);
      }
      if (schema.additionalProperties === false) {
        for (const key of Object.keys(value)) {
          if (!Object.hasOwn(props, key)) issues.push(`SCHEMA_UNKNOWN_FIELD:${pointer}/${key}`);
        }
      }
    }
  }
}

const INSTANT_RE = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})Z$/;

/** Deterministic instant parsing; no wall-clock access. Null when out of range. */
function instantMs(value) {
  const match = typeof value === "string" ? INSTANT_RE.exec(value) : null;
  if (match === null) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const hour = Number(match[4]);
  const minute = Number(match[5]);
  const second = Number(match[6]);
  if (year < 1 || month < 1 || month > 12 || day < 1 || day > 31 || hour > 23 || minute > 59 || second > 59) {
    return null;
  }
  const candidate = new Date(Date.UTC(0, month - 1, day, hour, minute, second));
  candidate.setUTCFullYear(year);
  if (candidate.getUTCFullYear() !== year || candidate.getUTCMonth() !== month - 1 ||
      candidate.getUTCDate() !== day || candidate.getUTCHours() !== hour ||
      candidate.getUTCMinutes() !== minute || candidate.getUTCSeconds() !== second) {
    return null;
  }
  return candidate.getTime();
}

function timeOrderIssues(envelope, issues) {
  const t = envelope.time;
  if (!isObj(t)) return;
  const fields = [
    ["issuedAt", "TIME_INVALID_INSTANT_ISSUED_AT"],
    ["freshUntil", "TIME_INVALID_INSTANT_FRESH_UNTIL"],
    ["retainUntil", "TIME_INVALID_INSTANT_RETAIN_UNTIL"],
  ];
  const ms = {};
  for (const [key, code] of fields) {
    ms[key] = t[key] === undefined ? undefined : instantMs(t[key]);
    if (ms[key] === null) issues.push(code);
  }
  if (ms.issuedAt !== undefined && ms.freshUntil !== undefined && ms.issuedAt !== null && ms.freshUntil !== null) {
    if (!(ms.issuedAt < ms.freshUntil)) issues.push("TIME_ORDER_VIOLATION_ISSUED_BEFORE_FRESH");
  }
  if (ms.issuedAt !== undefined && ms.retainUntil !== undefined && ms.issuedAt !== null && ms.retainUntil !== null) {
    if (!(ms.issuedAt < ms.retainUntil)) issues.push("TIME_ORDER_VIOLATION_ISSUED_BEFORE_RETAIN");
  }
  if (ms.freshUntil !== undefined && ms.retainUntil !== undefined && ms.freshUntil !== null && ms.retainUntil !== null) {
    if (!(ms.retainUntil <= ms.freshUntil)) issues.push("TIME_ORDER_VIOLATION_RETAIN_EXCEEDS_FRESH");
  }
}

function selfDigestIssue(envelope, issues) {
  const exchange = envelope.exchange;
  if (!isObj(exchange) || typeof exchange.projectionDigest !== "string") return;
  const base = structuredClone(envelope);
  delete base.exchange.projectionDigest;
  const computed = sha256Hex(canonicalize(base));
  if (computed !== exchange.projectionDigest) issues.push("DIGEST_SELF_MISMATCH");
}

function contractSchemaDigestIssue(envelope, schemaBytes, issues) {
  const contract = envelope.contract;
  if (!isObj(contract) || typeof contract.contractSchemaDigest !== "string") return;
  if (contract.contractSchemaDigest !== sha256Hex(schemaBytes)) issues.push("CONTRACT_SCHEMA_DIGEST_MISMATCH");
}

/** Provenance and scope rules: refs must resolve, targets must be in scope, digests must not drift. */
function referenceAndScopeIssues(envelope, issues) {
  const records = Array.isArray(envelope.records) ? envelope.records : [];
  const recordIds = new Set();
  const allSourceIds = new Set();
  const assetDigests = new Map(); // `${assetId}@${assetVersion}` -> Set(digests)
  const assetMetadata = new Map(); // `${assetId}@${assetVersion}@${assetDigest}` -> Set(metadata tuples)
  const provenanceDigests = new Map(); // source asset triple -> Set(provenance digests)
  const fieldRefs = [];

  const noteAsset = (asset, source = false) => {
    if (!isObj(asset)) return;
    const { assetId, assetVersion, assetDigest, assetClass, dataClassification, evidenceClass } = asset;
    if (typeof assetId !== "string" || typeof assetVersion !== "string" || typeof assetDigest !== "string") return;
    const key = `${assetId}@${assetVersion}`;
    if (!assetDigests.has(key)) assetDigests.set(key, new Set());
    assetDigests.get(key).add(assetDigest);
    if (typeof assetClass === "string" && typeof dataClassification === "string" && typeof evidenceClass === "string") {
      const triple = `${key}@${assetDigest}`;
      if (!assetMetadata.has(triple)) assetMetadata.set(triple, new Set());
      assetMetadata.get(triple).add(canonicalize([assetClass, dataClassification, evidenceClass]));
      if (source && typeof asset.provenanceDigest === "string") {
        if (!provenanceDigests.has(triple)) provenanceDigests.set(triple, new Set());
        provenanceDigests.get(triple).add(asset.provenanceDigest);
      }
    }
  };

  records.forEach((record, i) => {
    if (!isObj(record)) return;
    if (typeof record.recordId === "string") {
      if (recordIds.has(record.recordId)) issues.push(`DUPLICATE_RECORD_ID:${record.recordId}`);
      recordIds.add(record.recordId);
    }
    noteAsset(record);
    const sourceIds = new Set();
    if (Array.isArray(record.sources)) {
      for (const source of record.sources) {
        if (!isObj(source)) continue;
        if (typeof source.sourceRefId === "string") {
          if (sourceIds.has(source.sourceRefId)) issues.push(`DUPLICATE_SOURCE_REF:${source.sourceRefId}`);
          if (allSourceIds.has(source.sourceRefId)) issues.push(`DUPLICATE_SOURCE_REF:${source.sourceRefId}`);
          sourceIds.add(source.sourceRefId);
          allSourceIds.add(source.sourceRefId);
        }
        noteAsset(source, true);
      }
    }
    if (Array.isArray(record.fields)) {
      const fieldIds = new Set();
      record.fields.forEach((field, j) => {
        if (!isObj(field)) return;
        if (typeof field.fieldId === "string") {
          if (fieldIds.has(field.fieldId)) issues.push(`DUPLICATE_FIELD_ID:${i}/${j}`);
          fieldIds.add(field.fieldId);
          if (typeof record.recordClass === "string" &&
              !field.fieldId.startsWith(`${record.recordClass.toLowerCase()}.`)) {
            issues.push(`FIELD_RECORD_CLASS_MISMATCH:${i}/${j}`);
          }
        }
        if (typeof field.sourceRefId === "string" && !sourceIds.has(field.sourceRefId)) {
          issues.push(`SOURCE_REF_UNRESOLVED:${i}/${j}`);
        }
        if (field.fieldClass === "RELATIONSHIP_EDGE" && isObj(field.value) && isObj(field.value.target)) {
          fieldRefs.push({ i, j, target: field.value.target });
        }
      });
    }
  });

  for (const { i, j, target } of fieldRefs) {
    if (typeof target.assetId !== "string" || typeof target.assetVersion !== "string" || typeof target.assetDigest !== "string") {
      continue;
    }
    const digests = assetDigests.get(`${target.assetId}@${target.assetVersion}`);
    if (!digests || !digests.has(target.assetDigest)) {
      issues.push(`RELATIONSHIP_TARGET_OUT_OF_SCOPE:${i}/${j}`);
    }
  }

  for (const [key, digests] of assetDigests) {
    if (digests.size > 1) issues.push(`DIGEST_DRIFT:${key}`);
  }
  for (const [key, metadata] of assetMetadata) {
    if (metadata.size > 1) issues.push(`ASSET_METADATA_DRIFT:${key}`);
  }
  for (const [key, digests] of provenanceDigests) {
    if (digests.size > 1) issues.push(`PROVENANCE_DRIFT:${key}`);
  }
}

const EXCLUDED_FIELD_ID_PATTERNS = [
  /(^|\.)(prompt|completion|message|chain[_ .-]?of[_ .-]?thought|transcript|trace|rationale)(\.|$)/i,
  /(^|\.)(secret|credential|password|passwd|token|cookie|signing|key)(\.|$)/i,
  /(^|\.)(raw|sql|file|binary|command|code|callback|route|host|path|url|network)(\.|$)/i,
  /(^|\.)(policy|approval|lease|workflow\.run|invalidation)(\.|$)/i,
  /(^|\.)(tenant|customer|user|actor|session|provider)(\.|$)/i,
];

function excludedFieldIssues(envelope, issues) {
  const records = Array.isArray(envelope.records) ? envelope.records : [];
  records.forEach((record, recordIndex) => {
    if (!isObj(record) || !Array.isArray(record.fields)) return;
    record.fields.forEach((field, fieldIndex) => {
      if (isObj(field) && typeof field.fieldId === "string" &&
          EXCLUDED_FIELD_ID_PATTERNS.some((pattern) => pattern.test(field.fieldId))) {
        issues.push(`EXCLUDED_FIELD_PRESENT:${recordIndex}/${fieldIndex}`);
      }
    });
  });
}

function identityBindingIssues(envelope, issues) {
  const exchange = isObj(envelope.exchange) ? envelope.exchange : null;
  if (!exchange) return;
  const values = ["exchangeId", "projectionId", "replayId"]
    .map((key) => [key, exchange[key]])
    .filter(([, value]) => typeof value === "string");
  const seen = new Set();
  for (const [key, value] of values) {
    if (seen.has(value)) issues.push(`DUPLICATE_EXCHANGE_BINDING_ID:${key}`);
    seen.add(value);
  }
  const producerId = isObj(envelope.producer) ? envelope.producer.producerId : undefined;
  const consumerId = isObj(envelope.intendedConsumer) ? envelope.intendedConsumer.consumerId : undefined;
  if (typeof producerId === "string" && producerId === consumerId) {
    issues.push("DUPLICATE_PEER_BINDING_ID");
  }
}

const FROZEN_BOUNDARY = {
  readOnly: true,
  authorityClass: "NONE",
  effectClass: "NONE",
  promotionClaim: "NONE",
  writeInstructionAllowed: false,
};

const FROZEN_EXCLUDED_FIELDS = [
  "SECRETS",
  "CREDENTIALS",
  "TOKENS_KEYS_COOKIES_OR_SIGNING_MATERIAL",
  "RAW_PROMPTS_COMPLETIONS_MESSAGES_OR_CHAIN_OF_THOUGHT",
  "RAW_MODEL_OR_TOOL_TRACES",
  "RAW_ROWS_SQL_FILES_OR_BINARY_BLOBS",
  "FULL_GOVERNED_ASSET_BODIES",
  "UNNECESSARY_PAYLOADS",
  "DIRECT_TENANT_CUSTOMER_USER_ACTOR_SESSION_HOST_PATH_URL_NETWORK_OR_PROVIDER_IDENTIFIERS_WHEN_OPAQUE_SCOPE_IDS_SUFFICE",
  "MUTABLE_POLICY_STATE",
  "MUTABLE_APPROVAL_AUTHORITY_LEASE_WORKFLOW_RUN_OR_INVALIDATION_STATE",
  "EXECUTABLE_CODE_COMMANDS_FUNCTION_BODIES_WORKFLOW_DEFINITIONS_OR_EFFECT_PAYLOADS",
  "CALLBACKS_ARBITRARY_ROUTES_HOSTS_OR_PATHS",
];

function frozenBindingIssues(envelope, issues) {
  if (envelope.boundary !== undefined && !deepEqual(envelope.boundary, FROZEN_BOUNDARY)) {
    issues.push("BOUNDARY_MISMATCH");
  }
  if (envelope.excludedFields !== undefined && !deepEqual(envelope.excludedFields, FROZEN_EXCLUDED_FIELDS)) {
    issues.push("EXCLUDED_FIELDS_MISMATCH");
  }
}

const LEAK_PATTERNS = [
  ["LEAK_PRIVATE_KEY", /-----BEGIN [A-Z0-9 ]*PRIVATE KEY-----/],
  ["LEAK_OPENAI_KEY", /\bsk-[A-Za-z0-9_-]{20,}\b/],
  ["LEAK_GITHUB_TOKEN", /\bgh[pousr]_[A-Za-z0-9]{20,}\b/],
  ["LEAK_GITHUB_FINE_TOKEN", /\bgithub_pat_[A-Za-z0-9_]{20,}\b/],
  ["LEAK_AWS_KEY_ID", /\bAKIA[0-9A-Z]{16}\b/],
  ["LEAK_TELEGRAM_TOKEN", /\b[0-9]{8,12}:[A-Za-z0-9_-]{30,}\b/],
  ["LEAK_CREDENTIAL_URL", /https?:\/\/[^/\s:@"]+:[^/\s@"]+@[^\s"']+/],
  ["LEAK_BEARER_TOKEN", /\bAuthorization\b["']?\s*[:=]\s*["']?Bearer\s+[A-Za-z0-9._-]{16,}/i],
  ["LEAK_SECRET_ASSIGNMENT", /\b(password|passwd|pwd|secret|token|api_?key)\s*[:=]\s*["'][^"']{8,}["']/i],
  ["LEAK_PRIVATE_PATH", /(?:^|[\s"'=:,])\/(?:mnt|home|root|etc|var|proc)\/[A-Za-z0-9._-]+/],
];

function leakIssues(rawText, issues) {
  for (const [code, pattern] of LEAK_PATTERNS) {
    if (pattern.test(rawText)) issues.push(code);
  }
}

function validateEnvelope(envelope, rawText, schemaBytes) {
  const issues = [];
  let schema = null;
  try {
    schema = JSON.parse(schemaBytes);
  } catch {
    issues.push("SCHEMA_INVALID_JSON");
  }
  if (!isObj(envelope)) {
    issues.push("ENVELOPE_NOT_OBJECT");
  } else {
    if (schema !== null) evaluate(envelope, schema, schema, "#", issues);
    timeOrderIssues(envelope, issues);
    selfDigestIssue(envelope, issues);
    contractSchemaDigestIssue(envelope, schemaBytes, issues);
    referenceAndScopeIssues(envelope, issues);
    excludedFieldIssues(envelope, issues);
    identityBindingIssues(envelope, issues);
    frozenBindingIssues(envelope, issues);
    leakIssues(rawText, issues);
  }
  return [...new Set(issues)];
}

function report(label, path, issues) {
  if (issues.length === 0) {
    console.log(`cks-10-projection-contract: PASS ${label}=${path} issues=0`);
    return 0;
  }
  for (const issue of issues) console.log(`cks-10-projection-contract: ISSUE ${issue}`);
  console.log(`cks-10-projection-contract: FAIL ${label}=${path} issues=${issues.length}`);
  return 1;
}

function validateFixturePath(fixturePath) {
  let rawText;
  try {
    rawText = readFileSync(fixturePath, "utf8");
  } catch {
    return report("fixture", fixturePath, ["MISSING_FILE"]);
  }
  let envelope;
  try {
    envelope = JSON.parse(rawText);
  } catch {
    return report("fixture", fixturePath, ["INVALID_JSON"]);
  }
  const schemaBytes = readFileSync(resolve(ROOT, SCHEMA_REL), "utf8");
  return report("fixture", fixturePath, validateEnvelope(envelope, rawText, schemaBytes));
}

function selfTest() {
  const failures = [];
  let caseCount = 0;
  let baseline = null;
  let baselineIssues = [];
  let schemaBytes = null;
  try {
    const rawText = readFileSync(resolve(ROOT, FIXTURE_REL), "utf8");
    baseline = JSON.parse(rawText);
    schemaBytes = readFileSync(resolve(ROOT, SCHEMA_REL), "utf8");
    baselineIssues = validateEnvelope(baseline, rawText, schemaBytes);
  } catch (error) {
    console.log(`cks-10-projection-contract: SELF_TEST FAIL setup=${error && error.code ? error.code : "ERROR"}`);
    return 1;
  }

  caseCount += 1;
  if (baselineIssues.length !== 0) {
    failures.push(`baseline: expected 0 issues, got [${baselineIssues.join(", ")}]`);
  }

  const check = (name, mutate, expected) => {
    caseCount += 1;
    const envelope = structuredClone(baseline);
    mutate(envelope);
    const raw = JSON.stringify(envelope, null, 2);
    const issues = validateEnvelope(envelope, raw, schemaBytes);
    const hit = issues.length > 0 && expected.some((prefix) => issues.some((code) => code.startsWith(prefix)));
    if (!hit) failures.push(`${name}: expected one of [${expected.join(", ")}], got [${issues.join(", ")}]`);
  };

  check("unknown-top-level-field", (e) => {
    e.extraExtension = { note: "free-form extension maps are prohibited" };
  }, ["SCHEMA_UNKNOWN_FIELD"]);
  check("missing-required-top-level", (e) => {
    delete e.tenantScope;
  }, ["SCHEMA_REQUIRED"]);
  check("missing-opaque-tenant-scope-id", (e) => {
    delete e.tenantScope.opaqueTenantScopeId;
  }, ["SCHEMA_REQUIRED"]);
  check("malformed-scope-digest", (e) => {
    e.tenantScope.scope.scopeDigest = "not-a-digest";
  }, ["SCHEMA_PATTERN"]);
  check("missing-scope-decision-digest", (e) => {
    delete e.tenantScope.scopeDecision.decisionDigest;
  }, ["SCHEMA_REQUIRED"]);
  check("aliased-producer-consumer", (e) => {
    e.intendedConsumer.consumerId = e.producer.producerId;
  }, ["DUPLICATE_PEER_BINDING_ID"]);
  check("missing-record-fields", (e) => {
    delete e.records[0].fields;
  }, ["SCHEMA_REQUIRED"]);
  check("missing-replay-id", (e) => {
    delete e.exchange.replayId;
  }, ["SCHEMA_REQUIRED"]);
  check("self-digest-corruption", (e) => {
    e.exchange.projectionDigest = "0".repeat(64);
  }, ["DIGEST_SELF_MISMATCH"]);
  check("contract-schema-digest-corruption", (e) => {
    e.contract.contractSchemaDigest = "0".repeat(64);
  }, ["CONTRACT_SCHEMA_DIGEST_MISMATCH"]);
  check("impossible-time-order", (e) => {
    e.time.freshUntil = "2026-08-28T04:12:00Z";
  }, ["TIME_ORDER_VIOLATION_ISSUED_BEFORE_FRESH"]);
  check("retain-exceeds-fresh", (e) => {
    e.time.retainUntil = "2026-08-28T06:00:00Z";
  }, ["TIME_ORDER_VIOLATION_RETAIN_EXCEEDS_FRESH"]);
  check("retain-not-after-issued", (e) => {
    e.time.retainUntil = e.time.issuedAt;
  }, ["TIME_ORDER_VIOLATION_ISSUED_BEFORE_RETAIN"]);
  check("missing-fresh-until", (e) => {
    delete e.time.freshUntil;
  }, ["SCHEMA_REQUIRED"]);
  check("missing-retain-until", (e) => {
    delete e.time.retainUntil;
  }, ["SCHEMA_REQUIRED"]);
  check("invalid-instant-month13", (e) => {
    e.time.issuedAt = "2026-13-01T00:00:00Z";
  }, ["TIME_INVALID_INSTANT_ISSUED_AT"]);
  check("invalid-calendar-date", (e) => {
    e.time.issuedAt = "2026-02-29T00:00:00Z";
  }, ["TIME_INVALID_INSTANT_ISSUED_AT"]);
  check("non-utc-instant", (e) => {
    e.time.issuedAt = "2026-08-28T06:12:00+02:00";
  }, ["SCHEMA_PATTERN"]);
  check("version-range-latest", (e) => {
    e.exchange.projectionVersion = "latest";
  }, ["SCHEMA_PATTERN"]);
  check("unknown-purpose-class", (e) => {
    e.purpose.purposeClass = "OTHER_PURPOSE";
  }, ["SCHEMA_CONST"]);
  check("excluded-fields-tampered", (e) => {
    e.excludedFields.pop();
  }, ["SCHEMA_CONST"]);
  check("boundary-flags-tampered", (e) => {
    e.boundary.authorityClass = "FULL";
  }, ["SCHEMA_CONST"]);
  check("dangling-source-reference", (e) => {
    e.records[0].fields[0].sourceRefId = "src-missing-290-0001";
  }, ["SOURCE_REF_UNRESOLVED"]);
  check("missing-provenance-digest", (e) => {
    delete e.records[0].sources[0].provenanceDigest;
  }, ["SCHEMA_REQUIRED"]);
  check("malformed-provenance-digest", (e) => {
    e.records[0].sources[0].provenanceDigest = "not-a-digest";
  }, ["SCHEMA_PATTERN"]);
  check("out-of-scope-relationship-target", (e) => {
    e.records[3].fields[1].value.target.assetDigest = "1".repeat(64);
  }, ["RELATIONSHIP_TARGET_OUT_OF_SCOPE"]);
  check("asset-digest-drift", (e) => {
    e.records[0].assetDigest = "2".repeat(64);
  }, ["DIGEST_DRIFT"]);
  check("asset-metadata-drift", (e) => {
    e.records[0].sources[0].assetClass = "OTHER_ASSET_CLASS";
  }, ["ASSET_METADATA_DRIFT"]);
  check("provenance-drift", (e) => {
    const source = structuredClone(e.records[0].sources[0]);
    source.sourceRefId = "src-task-290-0002";
    source.provenanceDigest = "3".repeat(64);
    e.records[1].sources.push(source);
  }, ["PROVENANCE_DRIFT"]);
  check("duplicate-record-id", (e) => {
    e.records[1].recordId = "rec-task-290-0001";
  }, ["DUPLICATE_RECORD_ID"]);
  check("duplicate-source-ref-across-records", (e) => {
    e.records[1].sources[0].sourceRefId = "src-task-290-0001";
  }, ["DUPLICATE_SOURCE_REF"]);
  check("duplicate-exchange-binding-id", (e) => {
    e.exchange.projectionId = e.exchange.exchangeId;
  }, ["DUPLICATE_EXCHANGE_BINDING_ID"]);
  check("excluded-prompt-field", (e) => {
    e.records[0].fields[0].fieldId = "task.raw.prompt";
  }, ["EXCLUDED_FIELD_PRESENT"]);
  check("duplicate-field-id", (e) => {
    e.records[0].fields[1].fieldId = e.records[0].fields[0].fieldId;
  }, ["DUPLICATE_FIELD_ID"]);
  check("field-record-class-mismatch", (e) => {
    e.records[0].fields[0].fieldId = "knowledge.state";
  }, ["FIELD_RECORD_CLASS_MISMATCH"]);
  check("unbounded-aggregate-sample", (e) => {
    e.records[1].fields[0].value.sampleCount = 2000000;
  }, ["SCHEMA_ONEOF"]);
  check("control-character-in-value", (e) => {
    e.records[0].fields[0].value = "IN_PROGRESS\nTAMPERED";
  }, ["SCHEMA_ONEOF"]);
  check("free-form-extension-map-value", (e) => {
    e.records[0].fields.push({
      fieldId: "task.extensions",
      fieldVersion: "1.0.0",
      fieldClass: "SCALAR_FACT",
      value: {},
      sourceRefId: "src-task-290-0001",
    });
  }, ["SCHEMA_ONEOF"]);
  check("secret-scan-provider-marker", (e) => {
    e.records[0].fields[0].value = ["s", "k-", "abcdefghijklmnopqrstuvwxyz0123456789"].join("");
  }, ["LEAK_OPENAI_KEY"]);

  if (failures.length > 0) {
    for (const failure of failures) console.log(`cks-10-projection-contract: SELF_TEST_FAILURE ${failure}`);
    console.log(`cks-10-projection-contract: SELF_TEST FAIL cases=${caseCount} failures=${failures.length}`);
    return 1;
  }
  console.log(`cks-10-projection-contract: SELF_TEST PASS cases=${caseCount} failures=0`);
  return 0;
}

function main(argv) {
  const args = argv.slice(2);
  if (args.includes("--self-test")) return selfTest();
  if (args.length !== 1 || args[0] === "--help" || args[0] === "-h") {
    console.error("usage: node scripts/validate-cks-10-projection-contract.mjs <fixture.json> | --self-test");
    return 2;
  }
  return validateFixturePath(resolve(process.cwd(), args[0]));
}

process.exitCode = main(process.argv);