import {
  PROJECTION_BOUNDARY,
  PROJECTION_CONTRACT_ID,
  PROJECTION_CONTRACT_VERSION,
  PROJECTION_EXCLUDED_FIELDS,
  PROJECTION_PURPOSE_CLASS,
  PROJECTION_SCHEMA_VERSION,
  canonicalize,
  sha256,
} from "./read-only-projection-publisher.mjs";

const ID_RE = /^[A-Za-z][A-Za-z0-9._:-]{3,127}$/u;
const VERSION_RE = /^[0-9]+\.[0-9]+\.[0-9]+$/u;
const DIGEST_RE = /^[a-f0-9]{64}$/u;
const FIELD_ID_RE = /^[a-z][a-z0-9]*(\.[a-z][a-z0-9]*){1,4}$/u;
const INSTANT_RE = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})Z$/u;
const RECORD_CLASSES = new Set(["TASK", "KNOWLEDGE", "DECISION", "OUTCOME"]);
const DATA_CLASSIFICATIONS = new Set(["PUBLIC", "INTERNAL", "CONFIDENTIAL", "RESTRICTED"]);
const EVIDENCE_CLASSES = new Set(["CANONICAL_DERIVATIVE", "AGGREGATE_DERIVATIVE", "SYNTHETIC"]);
const FIELD_CLASSES = new Set(["SCALAR_FACT", "AGGREGATE_MEASURE", "RELATIONSHIP_EDGE"]);
const AGGREGATE_STATISTICS = new Set(["COUNT", "DISTINCT_COUNT", "SUM", "MEAN", "MIN", "MAX", "RATIO"]);
const CONTRACT_SCHEMA_DIGEST = "5f7f38d9350863993c58d6cb0dddb25f17906298471f3b40b620255b0789f86e";

export const PROJECTION_GUARD_SCHEMA_VERSION = "pansphaira.cks10/projection-envelope-guards/v1";
export const PROJECTION_CONTRACT_SCHEMA_DIGEST = CONTRACT_SCHEMA_DIGEST;

class GuardFailure extends Error {
  constructor(code) {
    super(code);
    this.code = code;
  }
}

const isObject = (value) => value !== null && typeof value === "object" && !Array.isArray(value);

function requireObject(value, code = "ENVELOPE_OBJECT_REQUIRED") {
  if (!isObject(value)) throw new GuardFailure(code);
  return value;
}

function exactKeys(value, keys) {
  const allowed = new Set(keys);
  if (!Object.keys(value).every((key) => allowed.has(key))) throw new GuardFailure("UNKNOWN_FIELD");
}

function string(value, pattern, code = "MALFORMED_BINDING") {
  if (typeof value !== "string" || value.length === 0 || !pattern.test(value)) throw new GuardFailure(code);
  return value;
}

function id(value) {
  return string(value, ID_RE);
}

function version(value) {
  return string(value, VERSION_RE);
}

function digest(value) {
  return string(value, DIGEST_RE);
}

function boundedString(value) {
  if (typeof value !== "string" || value.length < 1 || value.length > 512 || /[\u0000-\u001f\u007f]/u.test(value)) {
    throw new GuardFailure("BOUNDED_VALUE_REQUIRED");
  }
  return value;
}

function instantMs(value) {
  const match = typeof value === "string" ? INSTANT_RE.exec(value) : null;
  if (match === null) throw new GuardFailure("INVALID_UTC_INSTANT");
  const [year, month, day, hour, minute, second] = match.slice(1).map(Number);
  if (year < 1 || month < 1 || month > 12 || day < 1 || day > 31 || hour > 23 || minute > 59 || second > 59) {
    throw new GuardFailure("INVALID_UTC_INSTANT");
  }
  const date = new Date(Date.UTC(0, month - 1, day, hour, minute, second));
  date.setUTCFullYear(year);
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day ||
      date.getUTCHours() !== hour || date.getUTCMinutes() !== minute || date.getUTCSeconds() !== second) {
    throw new GuardFailure("INVALID_UTC_INSTANT");
  }
  return date.getTime();
}

function scalar(value) {
  if (value === null || typeof value === "boolean") return;
  if (typeof value === "number" && Number.isFinite(value)) return;
  if (typeof value === "string") {
    boundedString(value);
    return;
  }
  throw new GuardFailure("SCALAR_REQUIRED");
}

function validateField(field, recordClass, sourceRefIds, assetTriples) {
  requireObject(field);
  exactKeys(field, ["fieldId", "fieldVersion", "fieldClass", "value", "sourceRefId"]);
  const fieldId = string(field.fieldId, FIELD_ID_RE);
  if (!fieldId.startsWith(`${recordClass.toLowerCase()}.`)) throw new GuardFailure("FIELD_RECORD_CLASS_MISMATCH");
  if (/(^|\.)(prompt|completion|message|chain[_ .-]?of[_ .-]?thought|transcript|trace|rationale|secret|credential|password|passwd|token|cookie|signing|key|raw|sql|file|binary|command|code|callback|route|host|path|url|network|policy|approval|authority|lease|workflow\.run|invalidation|tenant|customer|user|actor|session|provider)(\.|$)/iu.test(fieldId)) {
    throw new GuardFailure("EXCLUDED_FIELD_PRESENT");
  }
  if (!FIELD_CLASSES.has(field.fieldClass)) throw new GuardFailure("UNKNOWN_FIELD_CLASS");
  version(field.fieldVersion);
  const fieldSourceRefId = id(field.sourceRefId);
  if (!sourceRefIds.has(fieldSourceRefId)) throw new GuardFailure("FIELD_SOURCE_REFERENCE_MISMATCH");
  if (field.fieldClass === "SCALAR_FACT") {
    scalar(field.value);
  } else if (field.fieldClass === "AGGREGATE_MEASURE") {
    const measure = requireObject(field.value);
    exactKeys(measure, ["measureClass", "statistic", "value", "sampleCount", "unit"]);
    string(measure.measureClass, /^[A-Z][A-Z0-9_]{2,63}$/u);
    if (!AGGREGATE_STATISTICS.has(measure.statistic)) throw new GuardFailure("UNKNOWN_AGGREGATE_STATISTIC");
    if (typeof measure.value !== "number" || !Number.isFinite(measure.value)) throw new GuardFailure("AGGREGATE_VALUE_REQUIRED");
    if (!Number.isSafeInteger(measure.sampleCount) || measure.sampleCount < 0 || measure.sampleCount > 1_000_000) {
      throw new GuardFailure("AGGREGATE_SAMPLE_COUNT_INVALID");
    }
    if (Object.hasOwn(measure, "unit")) boundedString(measure.unit);
  } else {
    const edge = requireObject(field.value);
    exactKeys(edge, ["relationClass", "target"]);
    string(edge.relationClass, /^[A-Z][A-Z0-9_]{2,63}$/u);
    const target = requireObject(edge.target);
    exactKeys(target, ["assetId", "assetVersion", "assetDigest"]);
    const triple = `${id(target.assetId)}@${version(target.assetVersion)}@${digest(target.assetDigest)}`;
    if (!assetTriples.has(triple)) throw new GuardFailure("RELATIONSHIP_TARGET_OUT_OF_SCOPE");
  }
}

function sourceBinding(source) {
  requireObject(source);
  exactKeys(source, ["sourceRefId", "assetId", "assetVersion", "assetDigest", "assetClass", "dataClassification", "evidenceClass", "provenanceDigest"]);
  return {
    sourceRefId: id(source.sourceRefId),
    assetId: id(source.assetId),
    assetVersion: version(source.assetVersion),
    assetDigest: digest(source.assetDigest),
    assetClass: string(source.assetClass, /^[A-Z][A-Z0-9_]{2,63}$/u),
    dataClassification: DATA_CLASSIFICATIONS.has(source.dataClassification) ? source.dataClassification : (() => { throw new GuardFailure("UNKNOWN_DATA_CLASSIFICATION"); })(),
    evidenceClass: EVIDENCE_CLASSES.has(source.evidenceClass) ? source.evidenceClass : (() => { throw new GuardFailure("UNKNOWN_EVIDENCE_CLASS"); })(),
    provenanceDigest: digest(source.provenanceDigest),
  };
}

function validateEnvelopeShape(envelope) {
  requireObject(envelope);
  exactKeys(envelope, ["schemaVersion", "contract", "exchange", "producer", "intendedConsumer", "tenantScope", "purpose", "records", "time", "boundary", "excludedFields"]);
  if (envelope.schemaVersion !== PROJECTION_SCHEMA_VERSION) throw new GuardFailure("SCHEMA_VERSION_UNSUPPORTED");

  const contract = requireObject(envelope.contract);
  exactKeys(contract, ["contractId", "contractVersion", "contractSchemaDigest"]);
  if (contract.contractId !== PROJECTION_CONTRACT_ID || contract.contractVersion !== PROJECTION_CONTRACT_VERSION) throw new GuardFailure("CONTRACT_UNSUPPORTED");
  if (digest(contract.contractSchemaDigest) !== CONTRACT_SCHEMA_DIGEST) throw new GuardFailure("CONTRACT_SCHEMA_DIGEST_MISMATCH");

  const exchange = requireObject(envelope.exchange);
  exactKeys(exchange, ["exchangeId", "projectionId", "projectionVersion", "replayId", "projectionDigest"]);
  const exchangeIds = [id(exchange.exchangeId), id(exchange.projectionId), id(exchange.replayId)];
  if (new Set(exchangeIds).size !== exchangeIds.length) throw new GuardFailure("DUPLICATE_EXCHANGE_BINDING_ID");
  version(exchange.projectionVersion);
  digest(exchange.projectionDigest);

  const producer = requireObject(envelope.producer);
  exactKeys(producer, ["producerId", "producerVersion", "producerDigest"]);
  id(producer.producerId); version(producer.producerVersion); digest(producer.producerDigest);
  const consumer = requireObject(envelope.intendedConsumer);
  exactKeys(consumer, ["consumerId", "consumerVersion", "consumerDigest"]);
  id(consumer.consumerId); version(consumer.consumerVersion); digest(consumer.consumerDigest);
  if (producer.producerId === consumer.consumerId) throw new GuardFailure("DUPLICATE_PEER_BINDING_ID");

  const tenantScope = requireObject(envelope.tenantScope);
  exactKeys(tenantScope, ["opaqueTenantScopeId", "scope", "scopeDecision"]);
  id(tenantScope.opaqueTenantScopeId);
  const scope = requireObject(tenantScope.scope);
  exactKeys(scope, ["scopeId", "scopeVersion", "scopeDigest"]);
  id(scope.scopeId); version(scope.scopeVersion); digest(scope.scopeDigest);
  const decision = requireObject(tenantScope.scopeDecision);
  exactKeys(decision, ["decisionId", "decisionVersion", "decisionDigest"]);
  id(decision.decisionId); version(decision.decisionVersion); digest(decision.decisionDigest);

  const purpose = requireObject(envelope.purpose);
  exactKeys(purpose, ["purposeClass", "purposeRegistry"]);
  if (purpose.purposeClass !== PROJECTION_PURPOSE_CLASS) throw new GuardFailure("PURPOSE_UNSUPPORTED");
  const registry = requireObject(purpose.purposeRegistry);
  exactKeys(registry, ["registryId", "registryVersion", "registryDigest"]);
  id(registry.registryId); version(registry.registryVersion); digest(registry.registryDigest);

  if (!Array.isArray(envelope.records) || envelope.records.length < 1 || envelope.records.length > 64) throw new GuardFailure("RECORDS_BOUNDED_ARRAY_REQUIRED");
  const assetTriples = new Set();
  for (const record of envelope.records) {
    requireObject(record);
    exactKeys(record, ["recordId", "recordClass", "assetId", "assetVersion", "assetDigest", "assetClass", "dataClassification", "evidenceClass", "sources", "fields"]);
    id(record.recordId); version(record.assetVersion); digest(record.assetDigest);
    if (!RECORD_CLASSES.has(record.recordClass)) throw new GuardFailure("UNKNOWN_RECORD_CLASS");
    string(record.assetClass, /^[A-Z][A-Z0-9_]{2,63}$/u);
    if (!DATA_CLASSIFICATIONS.has(record.dataClassification)) throw new GuardFailure("UNKNOWN_DATA_CLASSIFICATION");
    if (!EVIDENCE_CLASSES.has(record.evidenceClass)) throw new GuardFailure("UNKNOWN_EVIDENCE_CLASS");
    assetTriples.add(`${record.assetId}@${record.assetVersion}@${record.assetDigest}`);
  }

  const recordIds = new Set();
  const sourceRefIds = new Set();
  const assetMetadata = new Map();
  const provenanceByAsset = new Map();
  const requiredClasses = new Set(RECORD_CLASSES);
  for (const record of envelope.records) {
    if (recordIds.has(record.recordId)) throw new GuardFailure("DUPLICATE_RECORD_ID");
    recordIds.add(record.recordId); requiredClasses.delete(record.recordClass);
    if (!Array.isArray(record.sources) || record.sources.length < 1 || record.sources.length > 8) throw new GuardFailure("SOURCES_BOUNDED_ARRAY_REQUIRED");
    const recordSources = new Set();
    for (const rawSource of record.sources) {
      const source = sourceBinding(rawSource);
      if (recordSources.has(source.sourceRefId) || sourceRefIds.has(source.sourceRefId)) throw new GuardFailure("DUPLICATE_SOURCE_REFERENCE");
      recordSources.add(source.sourceRefId); sourceRefIds.add(source.sourceRefId);
      if (source.assetId !== id(record.assetId) || source.assetVersion !== version(record.assetVersion) || source.assetDigest !== digest(record.assetDigest) ||
          source.assetClass !== record.assetClass || source.dataClassification !== record.dataClassification || source.evidenceClass !== record.evidenceClass) {
        throw new GuardFailure("SOURCE_METADATA_MISMATCH");
      }
      const assetKey = `${source.assetId}@${source.assetVersion}@${source.assetDigest}`;
      const metadata = canonicalize([source.assetClass, source.dataClassification, source.evidenceClass]);
      if (assetMetadata.has(assetKey) && assetMetadata.get(assetKey) !== metadata) throw new GuardFailure("ASSET_METADATA_DRIFT");
      if (provenanceByAsset.has(assetKey) && provenanceByAsset.get(assetKey) !== source.provenanceDigest) throw new GuardFailure("PROVENANCE_DIGEST_DRIFT");
      assetMetadata.set(assetKey, metadata); provenanceByAsset.set(assetKey, source.provenanceDigest);
    }
    if (!Array.isArray(record.fields) || record.fields.length > 16) throw new GuardFailure("FIELDS_BOUNDED_ARRAY_REQUIRED");
    const fieldIds = new Set();
    for (const field of record.fields) {
      if (isObject(field) && fieldIds.has(field.fieldId)) throw new GuardFailure("DUPLICATE_FIELD_ID");
      if (isObject(field)) fieldIds.add(field.fieldId);
      validateField(field, record.recordClass, recordSources, assetTriples);
    }
  }
  if (requiredClasses.size !== 0) throw new GuardFailure("REQUIRED_RECORD_CLASS_MISSING");

  const time = requireObject(envelope.time);
  exactKeys(time, ["issuedAt", "freshUntil", "retainUntil"]);
  const issuedAt = instantMs(time.issuedAt);
  const freshUntil = instantMs(time.freshUntil);
  const retainUntil = instantMs(time.retainUntil);
  if (!(issuedAt < freshUntil)) throw new GuardFailure("TIME_ORDER_ISSUED_BEFORE_FRESH_REQUIRED");
  if (!(issuedAt < retainUntil)) throw new GuardFailure("TIME_ORDER_ISSUED_BEFORE_RETAIN_REQUIRED");
  if (!(retainUntil <= freshUntil)) throw new GuardFailure("TIME_ORDER_RETAIN_MUST_NOT_EXCEED_FRESH");

  if (canonicalize(envelope.boundary) !== canonicalize(PROJECTION_BOUNDARY)) throw new GuardFailure("BOUNDARY_MISMATCH");
  if (canonicalize(envelope.excludedFields) !== canonicalize(PROJECTION_EXCLUDED_FIELDS)) throw new GuardFailure("EXCLUDED_FIELDS_MISMATCH");
  return { issuedAt, freshUntil, retainUntil };
}

function sourceBindingsFromEnvelope(envelope) {
  return envelope.records.flatMap((record) => record.sources).map(sourceBinding).sort((left, right) => left.sourceRefId.localeCompare(right.sourceRefId));
}

function trustedContext(options) {
  const expectedEnvelope = options.expectedEnvelope;
  const supplied = options.expectedBindings ?? options.expected ?? {};
  if (expectedEnvelope !== undefined) {
    requireObject(expectedEnvelope, "EXPECTED_ENVELOPE_REQUIRED");
    return {
      tenantScope: expectedEnvelope.tenantScope,
      purpose: expectedEnvelope.purpose,
      producer: expectedEnvelope.producer,
      intendedConsumer: expectedEnvelope.intendedConsumer,
      exchange: expectedEnvelope.exchange,
      projectionDigest: expectedEnvelope.exchange?.projectionDigest,
      sourceBindings: sourceBindingsFromEnvelope(expectedEnvelope),
    };
  }
  if (!isObject(supplied)) throw new GuardFailure("TRUSTED_BINDINGS_REQUIRED");
  const result = {
    tenantScope: supplied.tenantScope ?? options.expectedTenantScope,
    purpose: supplied.purpose ?? options.expectedPurpose,
    producer: supplied.producer ?? options.expectedProducer,
    intendedConsumer: supplied.intendedConsumer ?? options.expectedConsumer,
    exchange: supplied.exchange ?? options.expectedExchange,
    projectionDigest: supplied.projectionDigest ?? options.expectedProjectionDigest,
    sourceBindings: supplied.sourceBindings ?? options.expectedSourceBindings,
  };
  if (!result.tenantScope || !result.purpose || !result.producer || !result.intendedConsumer || !result.exchange ||
      typeof result.projectionDigest !== "string" || !Array.isArray(result.sourceBindings)) {
    throw new GuardFailure("TRUSTED_BINDINGS_REQUIRED");
  }
  return result;
}

function replayFingerprint(envelope) {
  return sha256(envelope);
}

function safeCorrelationDigest(envelope) {
  const exchange = isObject(envelope?.exchange) ? envelope.exchange : {};
  return sha256({
    schemaVersion: typeof envelope?.schemaVersion === "string" ? envelope.schemaVersion : null,
    exchangeId: typeof exchange.exchangeId === "string" ? exchange.exchangeId : null,
    projectionId: typeof exchange.projectionId === "string" ? exchange.projectionId : null,
    replayId: typeof exchange.replayId === "string" ? exchange.replayId : null,
  });
}

function result(envelope, outcome, reasonCodes, extra = {}) {
  return {
    outcome,
    reasonCodes: [...new Set(reasonCodes)],
    correlationDigest: safeCorrelationDigest(envelope),
    ...extra,
  };
}

/**
 * Verify one already-minimized projection against caller-supplied trusted bindings.
 * No clock, policy, filesystem, network, or lifecycle state is read. A trusted
 * integer `nowMs` and a Map replay ledger are mandatory so unavailable guards
 * cannot silently become an allow.
 */
export function verifyProjectionEnvelope(envelope, options = {}) {
  const issues = [];
  let context;
  let time;
  try {
    time = validateEnvelopeShape(envelope);
    context = trustedContext(options);
    if (typeof options.authorityProjectionDigest !== "string" || !DIGEST_RE.test(options.authorityProjectionDigest)) {
      issues.push("AUTHORITY_PROJECTION_DIGEST_REQUIRED");
    } else if (context.projectionDigest !== options.authorityProjectionDigest ||
               envelope.exchange.projectionDigest !== options.authorityProjectionDigest) {
      issues.push("AUTHORITY_PROJECTION_DIGEST_MISMATCH");
    }
    if (!Number.isSafeInteger(options.nowMs)) issues.push("TRUSTED_CLOCK_REQUIRED");
    if (Number.isSafeInteger(options.nowMs)) {
      if (options.nowMs >= time.retainUntil) issues.push("RETENTION_EXPIRED");
      if (options.nowMs >= time.freshUntil) issues.push("FRESHNESS_STALE");
      if (time.issuedAt > options.nowMs) issues.push("FUTURE_ISSUED_ENVELOPE");
    }
    if (canonicalize(envelope.tenantScope) !== canonicalize(context.tenantScope)) issues.push("TENANT_SCOPE_MISMATCH");
    if (canonicalize(envelope.purpose) !== canonicalize(context.purpose)) issues.push("PURPOSE_BINDING_MISMATCH");
    if (canonicalize(envelope.producer) !== canonicalize(context.producer)) issues.push("PRODUCER_BINDING_MISMATCH");
    if (canonicalize(envelope.intendedConsumer) !== canonicalize(context.intendedConsumer)) issues.push("CONSUMER_BINDING_MISMATCH");
    const expectedExchange = context.exchange;
    for (const key of ["exchangeId", "projectionId", "projectionVersion", "replayId"]) {
      if (envelope.exchange[key] !== expectedExchange[key]) issues.push(`EXCHANGE_${key.toUpperCase()}_MISMATCH`);
    }
    if (envelope.exchange.projectionDigest !== context.projectionDigest) issues.push("PROJECTION_DIGEST_BINDING_MISMATCH");
    const withoutDigest = structuredClone(envelope);
    delete withoutDigest.exchange.projectionDigest;
    if (sha256(withoutDigest) !== envelope.exchange.projectionDigest) issues.push("PROJECTION_DIGEST_SELF_MISMATCH");
    const actualSources = sourceBindingsFromEnvelope(envelope);
    const expectedSources = context.sourceBindings.map(sourceBinding).sort((left, right) => left.sourceRefId.localeCompare(right.sourceRefId));
    if (canonicalize(actualSources) !== canonicalize(expectedSources)) issues.push("PROVENANCE_BINDING_MISMATCH");
    if (!(options.replayState instanceof Map)) issues.push("REPLAY_STATE_REQUIRED");
  } catch (error) {
    const code = error instanceof GuardFailure ? error.code : "ENVELOPE_GUARD_ERROR";
    issues.push(code);
  }

  if (issues.length !== 0) return result(envelope, "DENIED", issues);
  const replayId = envelope.exchange.replayId;
  const fingerprint = replayFingerprint(envelope);
  const prior = options.replayState.get(replayId);
  if (prior !== undefined) {
    if (prior === fingerprint) return result(envelope, "DUPLICATE_NOOP", ["REPLAY_EXACT_DUPLICATE"], { projectionDigest: envelope.exchange.projectionDigest });
    return result(envelope, "DENIED", ["DENIED_REPLAY_MUTATION"]);
  }
  options.replayState.set(replayId, fingerprint);
  return result(envelope, "VERIFIED", ["PROJECTION_ENVELOPE_VERIFIED"], {
    projectionDigest: envelope.exchange.projectionDigest,
    replayDigest: fingerprint,
  });
}

export const guardProjectionEnvelope = verifyProjectionEnvelope;
export const verifyMinimizedProjectionEnvelope = verifyProjectionEnvelope;

/** Throwing adapter for callers that use guards as assertions. */
export function assertProjectionEnvelope(envelope, options = {}) {
  const checked = verifyProjectionEnvelope(envelope, options);
  if (checked.outcome !== "VERIFIED") {
    throw new TypeError(`CKS10_PROJECTION_ENVELOPE_DENIED:${checked.reasonCodes.join(",")}`);
  }
  return envelope;
}

export function createProjectionReplayGuard() {
  const replayState = new Map();
  return {
    verify(envelope, options = {}) {
      return verifyProjectionEnvelope(envelope, { ...options, replayState });
    },
    get size() {
      return replayState.size;
    },
  };
}

export const createReplayGuard = createProjectionReplayGuard;

export { canonicalize, sha256 };
