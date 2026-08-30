import { createHash } from "node:crypto";

const ID_RE = /^[A-Za-z][A-Za-z0-9._:-]{3,127}$/u;
const VERSION_RE = /^[0-9]+\.[0-9]+\.[0-9]+$/u;
const DIGEST_RE = /^[a-f0-9]{64}$/u;
const FIELD_ID_RE = /^[a-z][a-z0-9]*(\.[a-z][a-z0-9]*){1,4}$/u;
const INSTANT_RE = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})Z$/u;

export const PROJECTION_SCHEMA_VERSION = "pansphaira.cks10/knowledge-projection/v1";
export const PROJECTION_CONTRACT_ID = "cks-10/minimized-projection/v1";
export const PROJECTION_CONTRACT_VERSION = "1.0.0";
export const PROJECTION_PURPOSE_CLASS = "CKS10_ANALYTICS_EXPLORATION";

export const PROJECTION_BOUNDARY = Object.freeze({
  readOnly: true,
  authorityClass: "NONE",
  effectClass: "NONE",
  promotionClaim: "NONE",
  writeInstructionAllowed: false,
});

export const PROJECTION_EXCLUDED_FIELDS = Object.freeze([
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
]);

const RECORD_CLASSES = new Set(["TASK", "KNOWLEDGE", "DECISION", "OUTCOME"]);
const DATA_CLASSIFICATIONS = new Set(["PUBLIC", "INTERNAL", "CONFIDENTIAL", "RESTRICTED"]);
const EVIDENCE_CLASSES = new Set(["CANONICAL_DERIVATIVE", "AGGREGATE_DERIVATIVE", "SYNTHETIC"]);
const FIELD_CLASSES = new Set(["SCALAR_FACT", "AGGREGATE_MEASURE", "RELATIONSHIP_EDGE"]);
const AGGREGATE_STATISTICS = new Set(["COUNT", "DISTINCT_COUNT", "SUM", "MEAN", "MIN", "MAX", "RATIO"]);
const FORBIDDEN_FIELD_RE = /(^|\.)(prompt|completion|message|chain[_ .-]?of[_ .-]?thought|transcript|trace|rationale|secret|credential|password|passwd|token|cookie|signing|key|raw|sql|file|binary|command|code|callback|route|host|path|url|network|policy|approval|authority|lease|workflow\.run|invalidation|tenant|customer|user|actor|session|provider)(\.|$)/iu;
const LEAK_PATTERNS = [
  /-----BEGIN [A-Z0-9 ]*PRIVATE KEY-----/u,
  /\bsk-[A-Za-z0-9_-]{20,}\b/u,
  /\bgh[pousr]_[A-Za-z0-9]{20,}\b/u,
  /\bgithub_pat_[A-Za-z0-9_]{20,}\b/u,
  /\bAKIA[0-9A-Z]{16}\b/u,
  /\b[0-9]{8,12}:[A-Za-z0-9_-]{30,}\b/u,
  /https?:\/\/[^/\s:@"]+:[^/\s@"]+@[^\s"']+/u,
  /\bAuthorization["']?\s*[:=]\s*["']?Bearer\s+[A-Za-z0-9._-]{16,}/iu,
];

const isRecord = (value) => value !== null && typeof value === "object" && !Array.isArray(value);

/** Canonical JSON: recursively sorted object keys, preserved array order, no whitespace. */
export function canonicalize(value) {
  const walk = (current) => {
    if (Array.isArray(current)) return `[${current.map(walk).join(",")}]`;
    if (isRecord(current)) {
      return `{${Object.keys(current).sort().map((key) => `${JSON.stringify(key)}:${walk(current[key])}`).join(",")}}`;
    }
    if (typeof current === "number" && !Number.isFinite(current)) {
      throw new TypeError("non-finite numbers are not canonical JSON");
    }
    if (current === undefined || typeof current === "function" || typeof current === "symbol" || typeof current === "bigint") {
      throw new TypeError("unsupported canonical JSON value");
    }
    return JSON.stringify(current);
  };
  return walk(value);
}

export function sha256(value) {
  const bytes = typeof value === "string" || value instanceof Uint8Array ? value : canonicalize(value);
  return createHash("sha256").update(bytes).digest("hex");
}

function fail(path, message) {
  throw new TypeError(`CKS10_PROJECTION_DENIED:${path}:${message}`);
}

function requireObject(value, path) {
  if (!isRecord(value)) fail(path, "OBJECT_REQUIRED");
  return value;
}

function requireExactKeys(value, keys, path) {
  const allowed = new Set(keys);
  for (const key of Object.keys(value)) {
    if (!allowed.has(key)) fail(`${path}.${key}`, "UNKNOWN_FIELD");
  }
}

function requiredString(value, path, pattern = null) {
  if (typeof value !== "string" || value.length === 0 || (pattern !== null && !pattern.test(value))) {
    fail(path, "MALFORMED_STRING");
  }
  return value;
}

function id(value, path) {
  return requiredString(value, path, ID_RE);
}

function version(value, path) {
  return requiredString(value, path, VERSION_RE);
}

function digest(value, path) {
  return requiredString(value, path, DIGEST_RE);
}

function classCode(value, path) {
  return requiredString(value, path, /^[A-Z][A-Z0-9_]{2,63}$/u);
}

function boundedString(value, path) {
  if (typeof value !== "string" || value.length < 1 || value.length > 512 || /[\u0000-\u001f\u007f]/u.test(value)) {
    fail(path, "BOUNDED_STRING_REQUIRED");
  }
  return value;
}

function instantMs(value, path) {
  const match = typeof value === "string" ? INSTANT_RE.exec(value) : null;
  if (match === null) fail(path, "INVALID_UTC_INSTANT");
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const hour = Number(match[4]);
  const minute = Number(match[5]);
  const second = Number(match[6]);
  if (year < 1 || month < 1 || month > 12 || day < 1 || day > 31 || hour > 23 || minute > 59 || second > 59) {
    fail(path, "INVALID_UTC_INSTANT");
  }
  const candidate = new Date(Date.UTC(0, month - 1, day, hour, minute, second));
  candidate.setUTCFullYear(year);
  if (candidate.getUTCFullYear() !== year || candidate.getUTCMonth() !== month - 1 ||
      candidate.getUTCDate() !== day || candidate.getUTCHours() !== hour ||
      candidate.getUTCMinutes() !== minute || candidate.getUTCSeconds() !== second) {
    fail(path, "INVALID_UTC_INSTANT");
  }
  return candidate.getTime();
}

function copyIdentity(value, path, requiredKeys) {
  const source = requireObject(value, path);
  requireExactKeys(source, requiredKeys, path);
  const output = {};
  for (const key of requiredKeys) {
    output[key] = key.endsWith("Digest") ? digest(source[key], `${path}.${key}`) :
      key.endsWith("Version") ? version(source[key], `${path}.${key}`) : id(source[key], `${path}.${key}`);
  }
  return output;
}

function copyContract(value) {
  const source = requireObject(value, "contract");
  requireExactKeys(source, ["contractId", "contractVersion", "contractSchemaDigest"], "contract");
  if (source.contractId !== PROJECTION_CONTRACT_ID) fail("contract.contractId", "UNSUPPORTED_CONTRACT");
  if (source.contractVersion !== PROJECTION_CONTRACT_VERSION) fail("contract.contractVersion", "UNSUPPORTED_VERSION");
  return {
    contractId: source.contractId,
    contractVersion: source.contractVersion,
    contractSchemaDigest: digest(source.contractSchemaDigest, "contract.contractSchemaDigest"),
  };
}

function copyTenantScope(value) {
  const source = requireObject(value, "tenantScope");
  requireExactKeys(source, ["opaqueTenantScopeId", "scope", "scopeDecision"], "tenantScope");
  const scope = requireObject(source.scope, "tenantScope.scope");
  requireExactKeys(scope, ["scopeId", "scopeVersion", "scopeDigest"], "tenantScope.scope");
  const decision = requireObject(source.scopeDecision, "tenantScope.scopeDecision");
  requireExactKeys(decision, ["decisionId", "decisionVersion", "decisionDigest"], "tenantScope.scopeDecision");
  return {
    opaqueTenantScopeId: id(source.opaqueTenantScopeId, "tenantScope.opaqueTenantScopeId"),
    scope: {
      scopeId: id(scope.scopeId, "tenantScope.scope.scopeId"),
      scopeVersion: version(scope.scopeVersion, "tenantScope.scope.scopeVersion"),
      scopeDigest: digest(scope.scopeDigest, "tenantScope.scope.scopeDigest"),
    },
    scopeDecision: {
      decisionId: id(decision.decisionId, "tenantScope.scopeDecision.decisionId"),
      decisionVersion: version(decision.decisionVersion, "tenantScope.scopeDecision.decisionVersion"),
      decisionDigest: digest(decision.decisionDigest, "tenantScope.scopeDecision.decisionDigest"),
    },
  };
}

function copyPurpose(value) {
  const source = requireObject(value, "purpose");
  requireExactKeys(source, ["purposeClass", "purposeRegistry"], "purpose");
  if (source.purposeClass !== PROJECTION_PURPOSE_CLASS) fail("purpose.purposeClass", "UNSUPPORTED_PURPOSE");
  const registry = requireObject(source.purposeRegistry, "purpose.purposeRegistry");
  requireExactKeys(registry, ["registryId", "registryVersion", "registryDigest"], "purpose.purposeRegistry");
  return {
    purposeClass: source.purposeClass,
    purposeRegistry: {
      registryId: id(registry.registryId, "purpose.purposeRegistry.registryId"),
      registryVersion: version(registry.registryVersion, "purpose.purposeRegistry.registryVersion"),
      registryDigest: digest(registry.registryDigest, "purpose.purposeRegistry.registryDigest"),
    },
  };
}

function copyTime(value) {
  const source = requireObject(value, "time");
  requireExactKeys(source, ["issuedAt", "freshUntil", "retainUntil"], "time");
  const issuedAt = boundedString(source.issuedAt, "time.issuedAt");
  const freshUntil = boundedString(source.freshUntil, "time.freshUntil");
  const retainUntil = boundedString(source.retainUntil, "time.retainUntil");
  const issuedMs = instantMs(issuedAt, "time.issuedAt");
  const freshMs = instantMs(freshUntil, "time.freshUntil");
  const retainMs = instantMs(retainUntil, "time.retainUntil");
  if (!(issuedMs < freshMs)) fail("time", "ISSUED_NOT_BEFORE_FRESH");
  if (!(issuedMs < retainMs)) fail("time", "ISSUED_NOT_BEFORE_RETAIN");
  if (!(retainMs <= freshMs)) fail("time", "RETAIN_AFTER_FRESH");
  return { issuedAt, freshUntil, retainUntil };
}

function copyScalar(value, path) {
  if (value === null || typeof value === "boolean") return value;
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") return boundedString(value, path);
  fail(path, "SCALAR_REQUIRED");
}

function copyAggregate(value, path) {
  const source = requireObject(value, path);
  requireExactKeys(source, ["measureClass", "statistic", "value", "sampleCount", "unit"].filter((key) => Object.hasOwn(source, key)), path);
  const output = {
    measureClass: classCode(source.measureClass, `${path}.measureClass`),
    statistic: source.statistic,
    value: source.value,
    sampleCount: source.sampleCount,
  };
  if (!AGGREGATE_STATISTICS.has(output.statistic)) fail(`${path}.statistic`, "UNSUPPORTED_STATISTIC");
  if (typeof output.value !== "number" || !Number.isFinite(output.value)) fail(`${path}.value`, "FINITE_NUMBER_REQUIRED");
  if (!Number.isInteger(output.sampleCount) || output.sampleCount < 0 || output.sampleCount > 1_000_000) {
    fail(`${path}.sampleCount`, "BOUNDED_INTEGER_REQUIRED");
  }
  if (Object.hasOwn(source, "unit")) output.unit = boundedString(source.unit, `${path}.unit`);
  return output;
}

function copyRelationship(value, path, assetKeys) {
  const source = requireObject(value, path);
  requireExactKeys(source, ["relationClass", "target"], path);
  const target = requireObject(source.target, `${path}.target`);
  requireExactKeys(target, ["assetId", "assetVersion", "assetDigest"], `${path}.target`);
  const targetTriple = {
    assetId: id(target.assetId, `${path}.target.assetId`),
    assetVersion: version(target.assetVersion, `${path}.target.assetVersion`),
    assetDigest: digest(target.assetDigest, `${path}.target.assetDigest`),
  };
  if (!assetKeys.has(`${targetTriple.assetId}@${targetTriple.assetVersion}@${targetTriple.assetDigest}`)) {
    fail(`${path}.target`, "RELATIONSHIP_TARGET_OUT_OF_SCOPE");
  }
  return { relationClass: classCode(source.relationClass, `${path}.relationClass`), target: targetTriple };
}

function copyField(value, path, recordClass, sourceRefId, assetKeys) {
  const source = requireObject(value, path);
  requireExactKeys(source, ["fieldId", "fieldVersion", "fieldClass", "value", "sourceRefId"], path);
  const fieldId = requiredString(source.fieldId, `${path}.fieldId`, FIELD_ID_RE);
  if (!fieldId.startsWith(`${recordClass.toLowerCase()}.`)) fail(`${path}.fieldId`, "RECORD_CLASS_MISMATCH");
  if (FORBIDDEN_FIELD_RE.test(fieldId)) fail(`${path}.fieldId`, "EXCLUDED_FIELD");
  const fieldClass = source.fieldClass;
  if (!FIELD_CLASSES.has(fieldClass)) fail(`${path}.fieldClass`, "UNSUPPORTED_FIELD_CLASS");
  const fieldSourceRefId = id(source.sourceRefId, `${path}.sourceRefId`);
  if (fieldSourceRefId !== sourceRefId) fail(`${path}.sourceRefId`, "SOURCE_REF_MISMATCH");
  const output = {
    fieldId,
    fieldVersion: version(source.fieldVersion, `${path}.fieldVersion`),
    fieldClass,
    value: fieldClass === "SCALAR_FACT" ? copyScalar(source.value, `${path}.value`) :
      fieldClass === "AGGREGATE_MEASURE" ? copyAggregate(source.value, `${path}.value`) :
        copyRelationship(source.value, `${path}.value`, assetKeys),
    sourceRefId: fieldSourceRefId,
  };
  return output;
}

function copyRecord(value, path, assetKeys) {
  const source = requireObject(value, path);
  // Canonical snapshots may contain rich evidence bodies. They are deliberately
  // not part of the projection input contract and are never read or copied.
  for (const key of ["recordId", "recordClass", "assetId", "assetVersion", "assetDigest", "assetClass", "dataClassification", "evidenceClass", "sourceRefId", "provenanceDigest", "fields"]) {
    if (!Object.hasOwn(source, key)) fail(`${path}.${key}`, "REQUIRED_FIELD");
  }
  const recordClass = source.recordClass;
  if (!RECORD_CLASSES.has(recordClass)) fail(`${path}.recordClass`, "UNSUPPORTED_RECORD_CLASS");
  const record = {
    recordId: id(source.recordId, `${path}.recordId`),
    recordClass,
    assetId: id(source.assetId, `${path}.assetId`),
    assetVersion: version(source.assetVersion, `${path}.assetVersion`),
    assetDigest: digest(source.assetDigest, `${path}.assetDigest`),
    assetClass: classCode(source.assetClass, `${path}.assetClass`),
    dataClassification: source.dataClassification,
    evidenceClass: source.evidenceClass,
  };
  if (!DATA_CLASSIFICATIONS.has(record.dataClassification)) fail(`${path}.dataClassification`, "UNSUPPORTED_CLASSIFICATION");
  if (!EVIDENCE_CLASSES.has(record.evidenceClass)) fail(`${path}.evidenceClass`, "UNSUPPORTED_EVIDENCE_CLASS");
  const sourceRefId = id(source.sourceRefId, `${path}.sourceRefId`);
  const provenanceDigest = digest(source.provenanceDigest, `${path}.provenanceDigest`);
  if (!Array.isArray(source.fields) || source.fields.length > 16) fail(`${path}.fields`, "BOUNDED_ARRAY_REQUIRED");
  const fields = source.fields.map((field, index) => copyField(field, `${path}.fields[${index}]`, recordClass, sourceRefId, assetKeys));
  return {
    ...record,
    sources: [{
      sourceRefId,
      assetId: record.assetId,
      assetVersion: record.assetVersion,
      assetDigest: record.assetDigest,
      assetClass: record.assetClass,
      dataClassification: record.dataClassification,
      evidenceClass: record.evidenceClass,
      provenanceDigest,
    }],
    fields,
  };
}

function scanProjectionForLeaks(projection) {
  const raw = canonicalize(projection);
  for (const pattern of LEAK_PATTERNS) {
    if (pattern.test(raw)) fail("projection", "SECRET_OR_CREDENTIAL_MATERIAL");
  }
}

/**
 * Build one inert projection from caller-supplied canonical snapshots.
 *
 * Input is intentionally metadata-plus-minimized-fields. A snapshot may carry
 * any additional canonical evidence outside this input shape (for example a
 * `canonicalEvidence` payload); it is never read or copied. The returned
 * envelope is a fresh object and this function performs no writes or clock,
 * network, filesystem, policy, or lifecycle access.
 */
export function buildReadOnlyProjection(input) {
  const request = requireObject(input, "input");
  const allowed = ["contract", "exchange", "producer", "intendedConsumer", "tenantScope", "purpose", "canonicalSnapshots", "time"];
  requireExactKeys(request, allowed, "input");
  const contract = copyContract(request.contract);
  const exchangeInput = requireObject(request.exchange, "exchange");
  requireExactKeys(exchangeInput, ["exchangeId", "projectionId", "projectionVersion", "replayId"], "exchange");
  const exchange = {
    exchangeId: id(exchangeInput.exchangeId, "exchange.exchangeId"),
    projectionId: id(exchangeInput.projectionId, "exchange.projectionId"),
    projectionVersion: version(exchangeInput.projectionVersion, "exchange.projectionVersion"),
    replayId: id(exchangeInput.replayId, "exchange.replayId"),
  };
  if (exchange.exchangeId === exchange.projectionId || exchange.exchangeId === exchange.replayId || exchange.projectionId === exchange.replayId) {
    fail("exchange", "DUPLICATE_BINDING_ID");
  }
  const producer = copyIdentity(request.producer, "producer", ["producerId", "producerVersion", "producerDigest"]);
  const intendedConsumer = copyIdentity(request.intendedConsumer, "intendedConsumer", ["consumerId", "consumerVersion", "consumerDigest"]);
  if (producer.producerId === intendedConsumer.consumerId) fail("producer", "PEER_IDENTITY_COLLISION");
  const tenantScope = copyTenantScope(request.tenantScope);
  const purpose = copyPurpose(request.purpose);
  const time = copyTime(request.time);
  if (!Array.isArray(request.canonicalSnapshots) || request.canonicalSnapshots.length < 1 || request.canonicalSnapshots.length > 64) {
    fail("canonicalSnapshots", "BOUNDED_ARRAY_REQUIRED");
  }

  const assetKeys = new Set();
  for (const [index, snapshot] of request.canonicalSnapshots.entries()) {
    const candidate = requireObject(snapshot, `canonicalSnapshots[${index}]`);
    if (typeof candidate.assetId === "string" && typeof candidate.assetVersion === "string" && typeof candidate.assetDigest === "string") {
      assetKeys.add(`${candidate.assetId}@${candidate.assetVersion}@${candidate.assetDigest}`);
    }
  }
  const records = request.canonicalSnapshots.map((snapshot, index) => copyRecord(snapshot, `canonicalSnapshots[${index}]`, assetKeys));
  const recordIds = new Set();
  const sourceRefIds = new Set();
  const classes = new Set();
  for (const record of records) {
    if (recordIds.has(record.recordId)) fail("records", "DUPLICATE_RECORD_ID");
    if (sourceRefIds.has(record.sources[0].sourceRefId)) fail("records", "DUPLICATE_SOURCE_REF_ID");
    recordIds.add(record.recordId);
    sourceRefIds.add(record.sources[0].sourceRefId);
    classes.add(record.recordClass);
    const fieldIds = new Set();
    for (const field of record.fields) {
      if (fieldIds.has(field.fieldId)) fail("records.fields", "DUPLICATE_FIELD_ID");
      fieldIds.add(field.fieldId);
    }
  }
  for (const requiredClass of RECORD_CLASSES) {
    if (!classes.has(requiredClass)) fail("records", "REQUIRED_RECORD_CLASS_MISSING");
  }

  const projection = {
    schemaVersion: PROJECTION_SCHEMA_VERSION,
    contract,
    exchange,
    producer,
    intendedConsumer,
    tenantScope,
    purpose,
    records,
    time,
    boundary: { ...PROJECTION_BOUNDARY },
    excludedFields: [...PROJECTION_EXCLUDED_FIELDS],
  };
  scanProjectionForLeaks(projection);
  projection.exchange.projectionDigest = sha256(projection);
  return projection;
}

export const buildProjection = buildReadOnlyProjection;
