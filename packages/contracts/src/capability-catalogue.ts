import { createHash } from "node:crypto";
import { canonicalJson } from "./canonical-json.js";

export const CAPABILITY_CATALOGUE_API_VERSION =
  "chimpmaera.security/capability-catalogue/v1" as const;
export const CAPABILITY_ACTION_API_VERSION =
  "chimpmaera.security/capability-action/v1" as const;
export const CAPABILITY_ACTIVATION_API_VERSION =
  "chimpmaera.security/capability-activation/v1" as const;
export const CAPABILITY_POLICY_BINDING_API_VERSION =
  "chimpmaera.security/capability-policy-binding/v1" as const;
export const CAPABILITY_EXECUTION_REQUEST_API_VERSION =
  "chimpmaera.security/capability-execution-request/v1" as const;
export const CAPABILITY_GATEWAY_DECISION_API_VERSION =
  "chimpmaera.security/capability-gateway-decision/v1" as const;
export const CAPABILITY_BROKER_RECEIPT_API_VERSION =
  "chimpmaera.security/capability-broker-receipt/v1" as const;
export const SYNTHETIC_CAPABILITY_CATALOGUE_ID =
  "chimpmaera.local/synthetic-actions" as const;
export const SYNTHETIC_CAPABILITY_CATALOGUE_VERSION = "1.0.0" as const;

export type CapabilityActionIdV1 = "crm.contact.create" | "erp.order.create" | "employee.directory.read_own";
export type CapabilityResourceV1 = "synthetic.crm.contact" | "synthetic.erp.order" | "employee.directory.own";

export type StrictJsonSchemaV1 = Readonly<{
  type: "object";
  additionalProperties: false;
  required: readonly string[];
  properties: Readonly<Record<string, Readonly<Record<string, unknown>>>>;
}>;

export type CapabilityResourceBoundsV1 = Readonly<{
  maxRequestBytes: number;
  maxResponseBytes: number;
  maxExecutionMs: number;
  maxInvocations: 1;
}>;

export type CapabilityEvidenceContractV1 = Readonly<{
  required: true;
  allowedSinkTypes: readonly ["SYNTHETIC_MEMORY"];
  receiptSchemaVersion: typeof CAPABILITY_BROKER_RECEIPT_API_VERSION;
  correlationMode: "SHA256_SANITIZED";
}>;

export type CapabilityActionV1 = Readonly<{
  schemaVersion: typeof CAPABILITY_ACTION_API_VERSION;
  actionId: CapabilityActionIdV1;
  version: "1.0.0";
  digest: string;
  resource: CapabilityResourceV1;
  requestSchema: StrictJsonSchemaV1;
  responseSchema: StrictJsonSchemaV1;
  resourceBounds: CapabilityResourceBoundsV1;
  evidenceContract: CapabilityEvidenceContractV1;
  limitations: readonly string[];
  activationState: "INACTIVE";
}>;

export type CapabilityCatalogueV1 = Readonly<{
  schemaVersion: typeof CAPABILITY_CATALOGUE_API_VERSION;
  catalogueId: typeof SYNTHETIC_CAPABILITY_CATALOGUE_ID;
  version: typeof SYNTHETIC_CAPABILITY_CATALOGUE_VERSION;
  digest: string;
  activationDefault: "INACTIVE";
  actions: readonly CapabilityActionV1[];
}>;

export type CapabilityActivationV1 = Readonly<{
  schemaVersion: typeof CAPABILITY_ACTIVATION_API_VERSION;
  activationId: string;
  catalogueVersion: string;
  catalogueDigest: string;
  actionId: string;
  actionVersion: string;
  actionDigest: string;
  tenant: string;
  maintainerId: string;
  authorizedAt: string;
  expiresAt: string;
  activationState: "ACTIVE";
  digest: string;
}>;

export type CapabilityActivationPolicyV1 = Readonly<{
  schemaVersion: typeof CAPABILITY_POLICY_BINDING_API_VERSION;
  policyId: string;
  version: "1.0.0";
  digest: string;
  tenant: string;
  actionIds: readonly CapabilityActionIdV1[];
  maintainerIds: readonly string[];
  validFrom: string;
  expiresAt: string;
}>;

export type CapabilityExecutionRequestV1 = Readonly<{
  schemaVersion: typeof CAPABILITY_EXECUTION_REQUEST_API_VERSION;
  catalogueVersion: string;
  catalogueDigest: string;
  actionId: string;
  actionVersion: string;
  actionDigest: string;
  resource: string;
  tenant: string;
  workloadIdentity: string;
  userIdentity: string;
  policyDigest: string;
  correlationId: string;
  requestId: string;
  evidenceSink: Readonly<{ type: "SYNTHETIC_MEMORY"; sinkId: string }>;
  request: Readonly<Record<string, unknown>>;
}>;

export const CAPABILITY_DECISION_ISSUES_V1 = [
  "ACTION_DIGEST_MISMATCH_DENIED",
  "ACTION_INACTIVE_DENIED",
  "ACTION_SCHEMA_INVALID_DENIED",
  "ACTION_UNKNOWN_DENIED",
  "ACTION_VERSION_STALE_DENIED",
  "ACTIVATION_AUTHORIZATION_INVALID_DENIED",
  "ACTIVATION_STALE_DENIED",
  "BROKER_DECISION_INVALID_DENIED",
  "CATALOGUE_DIGEST_MISMATCH_DENIED",
  "CATALOGUE_SCHEMA_INVALID_DENIED",
  "CATALOGUE_VERSION_STALE_DENIED",
  "CORRELATION_MISSING_DENIED",
  "CROSS_TENANT_DENIED",
  "EVIDENCE_SINK_MISSING_DENIED",
  "IDENTITY_MISSING_DENIED",
  "POLICY_BINDING_MISMATCH_DENIED",
  "POLICY_MISSING_DENIED",
  "POLICY_STALE_DENIED",
  "PREPARED_EFFECT_INVALID_DENIED",
  "REPLAY_CONSUMED_DENIED",
  "REPLAY_IN_FLIGHT_DENIED",
  "REQUEST_RESOURCE_DENIED",
  "REQUEST_SCHEMA_INVALID_DENIED",
  "REQUEST_SNAPSHOT_INVALID_DENIED",
  "RESOURCE_BOUNDS_DENIED",
  "RESPONSE_SCHEMA_INVALID_DENIED",
  "SYNTHETIC_COMMIT_AMBIGUOUS_CONSUMED",
] as const;
export type CapabilityDecisionIssueV1 = typeof CAPABILITY_DECISION_ISSUES_V1[number];

export type CapabilityExecutionTicketV1 = Readonly<{
  catalogueVersion: string;
  catalogueDigest: string;
  actionId: string;
  actionVersion: string;
  actionDigest: string;
  activationDigest: string;
  policyId: string;
  policyVersion: string;
  policyDigest: string;
  tenant: string;
  correlationDigest: string;
  requestId: string;
  requestDigest: string;
  evidenceSink: CapabilityExecutionRequestV1["evidenceSink"];
  request: Readonly<Record<string, unknown>>;
}>;

export type CapabilityGatewayDecisionV1 = Readonly<{
  schemaVersion: typeof CAPABILITY_GATEWAY_DECISION_API_VERSION;
  stage: "GATEWAY";
  outcome: "ALLOW" | "DENY";
  catalogueVersion: string | null;
  catalogueDigest: string | null;
  actionId: string | null;
  actionVersion: string | null;
  actionDigest: string | null;
  correlationDigest: string | null;
  requestDigest: string | null;
  ticket: CapabilityExecutionTicketV1 | null;
  issues: readonly CapabilityDecisionIssueV1[];
  decisionDigest: string;
}>;

export type CapabilityBrokerReceiptV1 = Readonly<{
  schemaVersion: typeof CAPABILITY_BROKER_RECEIPT_API_VERSION;
  stage: "BROKER";
  outcome: "EXECUTED" | "DENY" | "AMBIGUOUS";
  catalogueVersion: string | null;
  catalogueDigest: string | null;
  actionId: string | null;
  actionVersion: string | null;
  actionDigest: string | null;
  correlationDigest: string | null;
  requestDigest: string | null;
  responseDigest: string | null;
  response: Readonly<Record<string, unknown>> | null;
  effectCount: 0 | 1 | null;
  effectState: "NONE" | "CONFIRMED_ONE" | "AMBIGUOUS_CONSUMED";
  issues: readonly CapabilityDecisionIssueV1[];
  receiptDigest: string;
}>;

export interface PreparedSyntheticCapabilityEffectV1 {
  readonly response: Readonly<Record<string, unknown>>;
  readonly commit: () => void;
}

export interface SyntheticCapabilityExecutorV1 {
  prepare(
    action: CapabilityActionV1,
    request: Readonly<Record<string, unknown>>,
  ): PreparedSyntheticCapabilityEffectV1;
}

export interface CapabilityMonotonicClockV1 {
  nowMs(): number;
}

export type CapabilityReplayStateV1 = "IN_FLIGHT" | "CONSUMED";
export type CapabilityReplayStoreV1 = Map<string, CapabilityReplayStateV1>;

type RecordValue = Record<string, unknown>;

const ACTION_IDS = ["crm.contact.create", "erp.order.create", "employee.directory.read_own"] as const;
const CATALOGUE_KEYS = [
  "actions", "activationDefault", "catalogueId", "digest", "schemaVersion", "version",
] as const;
const ACTION_KEYS = [
  "activationState", "actionId", "digest", "evidenceContract", "limitations", "requestSchema",
  "resource", "resourceBounds", "responseSchema", "schemaVersion", "version",
] as const;
const ACTIVATION_KEYS = [
  "actionDigest", "actionId", "actionVersion", "activationId", "activationState", "authorizedAt",
  "catalogueDigest", "catalogueVersion", "digest", "expiresAt", "maintainerId", "schemaVersion", "tenant",
] as const;
const POLICY_KEYS = [
  "actionIds", "digest", "expiresAt", "maintainerIds", "policyId", "schemaVersion",
  "tenant", "validFrom", "version",
] as const;
const REQUEST_KEYS = [
  "actionDigest", "actionId", "actionVersion", "catalogueDigest", "catalogueVersion", "correlationId",
  "evidenceSink", "policyDigest", "request", "requestId", "resource", "schemaVersion", "tenant",
  "userIdentity", "workloadIdentity",
] as const;
const GATEWAY_CORE_KEYS = [
  "actionDigest", "actionId", "actionVersion", "catalogueDigest", "catalogueVersion", "correlationDigest",
  "issues", "outcome", "requestDigest", "schemaVersion", "stage", "ticket",
] as const;
const TICKET_KEYS = [
  "actionDigest", "actionId", "actionVersion", "activationDigest", "catalogueDigest", "catalogueVersion",
  "correlationDigest", "evidenceSink", "policyDigest", "policyId", "policyVersion", "request",
  "requestDigest", "requestId", "tenant",
] as const;
const LIMITATIONS = [
  "LOCAL_SYNTHETIC_VALIDATION_ONLY",
  "NO_LIVE_PROVIDER_OR_CREDENTIAL_USE",
  "CATALOGUE_ADMISSION_DOES_NOT_ESTABLISH_SAFETY",
  "SYNCHRONOUS_PREPARE_BOUND_ONLY_NO_CANCELLATION",
  "IN_MEMORY_REPLAY_RESERVATION_ONLY",
] as const;
const BOUNDS: CapabilityResourceBoundsV1 = {
  maxRequestBytes: 512,
  maxResponseBytes: 512,
  maxExecutionMs: 1000,
  maxInvocations: 1,
};
const EVIDENCE_CONTRACT: CapabilityEvidenceContractV1 = {
  required: true,
  allowedSinkTypes: ["SYNTHETIC_MEMORY"],
  receiptSchemaVersion: CAPABILITY_BROKER_RECEIPT_API_VERSION,
  correlationMode: "SHA256_SANITIZED",
};

const CRM_REQUEST_SCHEMA: StrictJsonSchemaV1 = {
  type: "object",
  additionalProperties: false,
  required: ["email", "name"],
  properties: {
    email: { type: "string", minLength: 3, maxLength: 120, pattern: "^[^@\\s]+@example\\.test$" },
    name: { type: "string", minLength: 1, maxLength: 80 },
  },
};
const CRM_RESPONSE_SCHEMA: StrictJsonSchemaV1 = {
  type: "object",
  additionalProperties: false,
  required: ["contactId"],
  properties: { contactId: { type: "string", pattern: "^synthetic-contact-[0-9]{3}$" } },
};
const ERP_REQUEST_SCHEMA: StrictJsonSchemaV1 = {
  type: "object",
  additionalProperties: false,
  required: ["quantity", "sku"],
  properties: {
    quantity: { type: "integer", minimum: 1, maximum: 100 },
    sku: { type: "string", minLength: 3, maxLength: 32, pattern: "^SYN-[A-Z0-9-]+$" },
  },
};
const ERP_RESPONSE_SCHEMA: StrictJsonSchemaV1 = {
  type: "object",
  additionalProperties: false,
  required: ["orderId"],
  properties: { orderId: { type: "string", pattern: "^synthetic-order-[0-9]{3}$" } },
};
const EMPLOYEE_DIRECTORY_REQUEST_SCHEMA: StrictJsonSchemaV1 = {
  type: "object",
  additionalProperties: false,
  required: ["userId"],
  properties: { userId: { type: "string", minLength: 6, maxLength: 80, pattern: "^user:[a-z0-9-]+$" } },
};
const EMPLOYEE_DIRECTORY_RESPONSE_SCHEMA: StrictJsonSchemaV1 = {
  type: "object",
  additionalProperties: false,
  required: ["displayName"],
  properties: { displayName: { type: "string", minLength: 1, maxLength: 80 } },
};

const ACTION_SPEC: Readonly<Record<CapabilityActionIdV1, Readonly<{
  resource: CapabilityResourceV1;
  requestSchema: StrictJsonSchemaV1;
  responseSchema: StrictJsonSchemaV1;
}>>> = {
  "crm.contact.create": {
    resource: "synthetic.crm.contact",
    requestSchema: CRM_REQUEST_SCHEMA,
    responseSchema: CRM_RESPONSE_SCHEMA,
  },
  "erp.order.create": {
    resource: "synthetic.erp.order",
    requestSchema: ERP_REQUEST_SCHEMA,
    responseSchema: ERP_RESPONSE_SCHEMA,
  },
  "employee.directory.read_own": {
    resource: "employee.directory.own",
    requestSchema: EMPLOYEE_DIRECTORY_REQUEST_SCHEMA,
    responseSchema: EMPLOYEE_DIRECTORY_RESPONSE_SCHEMA,
  },
};

function digest(value: unknown): string {
  return createHash("sha256").update(canonicalJson(value)).digest("hex");
}

function digestOrNull(value: unknown): string | null {
  try { return digest(value); } catch { return null; }
}

function isRecord(value: unknown): value is RecordValue {
  return value !== null
    && typeof value === "object"
    && !Array.isArray(value)
    && Object.getPrototypeOf(value) === Object.prototype;
}

function exactKeys(value: unknown, expected: readonly string[]): value is RecordValue {
  return isRecord(value)
    && canonicalJson(Object.keys(value).sort()) === canonicalJson([...expected].sort());
}

function isDigest(value: unknown): value is string {
  return typeof value === "string" && /^[a-f0-9]{64}$/.test(value);
}

function isBoundId(value: unknown, prefix: string): value is string {
  return typeof value === "string"
    && new RegExp(`^${prefix}:[a-z0-9][a-z0-9._-]{2,63}$`).test(value);
}

function isCorrelationId(value: unknown): value is string {
  return isBoundId(value, "correlation")
    || (typeof value === "string" && /^corr-aas035-[a-z0-9-]{8,64}$/.test(value));
}

function isTimestamp(value: unknown): value is string {
  return typeof value === "string"
    && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/.test(value)
    && Number.isFinite(Date.parse(value));
}

function withoutDigest<T extends { readonly digest: string }>(value: T): Omit<T, "digest"> {
  const { digest: _ignored, ...core } = value;
  return core;
}

function actionMaterial(
  actionId: CapabilityActionIdV1,
): Omit<CapabilityActionV1, "digest"> {
  const spec = ACTION_SPEC[actionId];
  return {
    schemaVersion: CAPABILITY_ACTION_API_VERSION,
    actionId,
    version: "1.0.0",
    resource: spec.resource,
    requestSchema: spec.requestSchema,
    responseSchema: spec.responseSchema,
    resourceBounds: BOUNDS,
    evidenceContract: EVIDENCE_CONTRACT,
    limitations: LIMITATIONS,
    activationState: "INACTIVE",
  };
}

function expectedAction(actionId: CapabilityActionIdV1): CapabilityActionV1 {
  const core = actionMaterial(actionId);
  return { ...core, digest: digest(core) };
}

function validStrictSchema(value: unknown): value is StrictJsonSchemaV1 {
  if (!exactKeys(value, ["additionalProperties", "properties", "required", "type"])) return false;
  if (value.type !== "object" || value.additionalProperties !== false || !isRecord(value.properties)) return false;
  if (!Array.isArray(value.required)
    || value.required.some((key) => typeof key !== "string")
    || new Set(value.required).size !== value.required.length) return false;
  return canonicalJson([...value.required].sort()) === canonicalJson(Object.keys(value.properties).sort());
}

function validateJson(schema: StrictJsonSchemaV1, value: unknown): value is Readonly<Record<string, unknown>> {
  if (!isRecord(value)) return false;
  const keys = Object.keys(value).sort();
  if (canonicalJson(keys) !== canonicalJson([...schema.required].sort())) return false;
  return keys.every((key) => {
    const rule = schema.properties[key];
    const item = value[key];
    if (rule === undefined) return false;
    if (rule.type === "string") {
      if (typeof item !== "string") return false;
      if (typeof rule.minLength === "number" && item.length < rule.minLength) return false;
      if (typeof rule.maxLength === "number" && item.length > rule.maxLength) return false;
      return typeof rule.pattern !== "string" || new RegExp(rule.pattern).test(item);
    }
    if (rule.type === "integer") {
      return Number.isSafeInteger(item)
        && (typeof rule.minimum !== "number" || Number(item) >= rule.minimum)
        && (typeof rule.maximum !== "number" || Number(item) <= rule.maximum);
    }
    return false;
  });
}

function validAction(value: unknown): value is CapabilityActionV1 {
  if (!exactKeys(value, ACTION_KEYS)
    || value.schemaVersion !== CAPABILITY_ACTION_API_VERSION
    || !ACTION_IDS.includes(value.actionId as CapabilityActionIdV1)
    || value.version !== "1.0.0"
    || value.activationState !== "INACTIVE"
    || !isDigest(value.digest)
    || !validStrictSchema(value.requestSchema)
    || !validStrictSchema(value.responseSchema)) return false;
  const expected = expectedAction(value.actionId as CapabilityActionIdV1);
  return canonicalJson(value) === canonicalJson(expected)
    && digest(withoutDigest(value as unknown as CapabilityActionV1)) === value.digest;
}

export function verifyCapabilityCatalogueV1(value: unknown): CapabilityCatalogueV1 {
  if (!exactKeys(value, CATALOGUE_KEYS)
    || value.schemaVersion !== CAPABILITY_CATALOGUE_API_VERSION
    || value.catalogueId !== SYNTHETIC_CAPABILITY_CATALOGUE_ID
    || value.version !== SYNTHETIC_CAPABILITY_CATALOGUE_VERSION
    || value.activationDefault !== "INACTIVE"
    || !isDigest(value.digest)
    || !Array.isArray(value.actions)
    || value.actions.length !== ACTION_IDS.length
    || !value.actions.every(validAction)) throw new Error("CATALOGUE_SCHEMA_INVALID_DENIED");
  const actions = value.actions as unknown as CapabilityActionV1[];
  if (new Set(actions.map(({ actionId }) => actionId)).size !== ACTION_IDS.length
    || canonicalJson(actions.map(({ actionId }) => actionId)) !== canonicalJson(ACTION_IDS)
    || digest(withoutDigest(value as unknown as CapabilityCatalogueV1)) !== value.digest) {
    throw new Error("CATALOGUE_DIGEST_MISMATCH_DENIED");
  }
  return value as unknown as CapabilityCatalogueV1;
}

export function syntheticCapabilityCatalogueV1(): CapabilityCatalogueV1 {
  const core: Omit<CapabilityCatalogueV1, "digest"> = {
    schemaVersion: CAPABILITY_CATALOGUE_API_VERSION,
    catalogueId: SYNTHETIC_CAPABILITY_CATALOGUE_ID,
    version: SYNTHETIC_CAPABILITY_CATALOGUE_VERSION,
    activationDefault: "INACTIVE",
    actions: ACTION_IDS.map(expectedAction),
  };
  return { ...core, digest: digest(core) };
}

export function verifyCapabilityPolicyBindingV1(
  value: unknown,
  observedAt: string,
): CapabilityActivationPolicyV1 {
  if (!exactKeys(value, POLICY_KEYS)
    || value.schemaVersion !== CAPABILITY_POLICY_BINDING_API_VERSION
    || !isBoundId(value.policyId, "policy")
    || value.version !== "1.0.0"
    || !isDigest(value.digest)
    || !isBoundId(value.tenant, "tenant")
    || !Array.isArray(value.actionIds)
    || canonicalJson(value.actionIds) !== canonicalJson(ACTION_IDS)
    || !Array.isArray(value.maintainerIds)
    || value.maintainerIds.length === 0
    || value.maintainerIds.some((id) => !isBoundId(id, "maintainer"))
    || new Set(value.maintainerIds).size !== value.maintainerIds.length
    || !isTimestamp(value.validFrom)
    || !isTimestamp(value.expiresAt)
    || digest(withoutDigest(value as unknown as CapabilityActivationPolicyV1)) !== value.digest) {
    throw new Error("POLICY_BINDING_MISMATCH_DENIED");
  }
  if (!isTimestamp(observedAt)
    || Date.parse(value.validFrom) > Date.parse(observedAt)
    || Date.parse(value.expiresAt) <= Date.parse(observedAt)) {
    throw new Error("POLICY_STALE_DENIED");
  }
  return value as unknown as CapabilityActivationPolicyV1;
}

export function syntheticCapabilityPolicyBindingV1(): CapabilityActivationPolicyV1 {
  const core: Omit<CapabilityActivationPolicyV1, "digest"> = {
    schemaVersion: CAPABILITY_POLICY_BINDING_API_VERSION,
    policyId: "policy:synthetic-safe-guided",
    version: "1.0.0",
    tenant: "tenant:synthetic-zoo",
    actionIds: [...ACTION_IDS],
    maintainerIds: ["maintainer:synthetic-reviewer"],
    validFrom: "2026-08-09T10:00:00Z",
    expiresAt: "2026-08-10T10:00:00Z",
  };
  return { ...core, digest: digest(core) };
}

export function verifyCapabilityActivationV1(
  value: unknown,
  catalogue: CapabilityCatalogueV1,
  policy: CapabilityActivationPolicyV1,
  observedAt: string,
): CapabilityActivationV1 {
  if (!exactKeys(value, ACTIVATION_KEYS)
    || value.schemaVersion !== CAPABILITY_ACTIVATION_API_VERSION
    || value.activationState !== "ACTIVE"
    || !isBoundId(value.activationId, "activation")
    || !isBoundId(value.tenant, "tenant")
    || !isBoundId(value.maintainerId, "maintainer")
    || !isTimestamp(value.authorizedAt)
    || !isTimestamp(value.expiresAt)
    || !isDigest(value.digest)
    || digest(withoutDigest(value as unknown as CapabilityActivationV1)) !== value.digest) {
    throw new Error("ACTIVATION_AUTHORIZATION_INVALID_DENIED");
  }
  if (value.tenant !== policy.tenant) throw new Error("CROSS_TENANT_DENIED");
  if (!policy.maintainerIds.includes(value.maintainerId)) {
    throw new Error("ACTIVATION_AUTHORIZATION_INVALID_DENIED");
  }
  if (!isTimestamp(observedAt)
    || Date.parse(value.authorizedAt) > Date.parse(observedAt)
    || Date.parse(value.expiresAt) <= Date.parse(observedAt)) throw new Error("ACTIVATION_STALE_DENIED");
  const action = catalogue.actions.find(({ actionId }) => actionId === value.actionId);
  if (value.catalogueVersion !== catalogue.version) throw new Error("CATALOGUE_VERSION_STALE_DENIED");
  if (value.catalogueDigest !== catalogue.digest) throw new Error("CATALOGUE_DIGEST_MISMATCH_DENIED");
  if (action === undefined) throw new Error("ACTION_UNKNOWN_DENIED");
  if (value.actionVersion !== action.version) throw new Error("ACTION_VERSION_STALE_DENIED");
  if (value.actionDigest !== action.digest) throw new Error("ACTION_DIGEST_MISMATCH_DENIED");
  return value as unknown as CapabilityActivationV1;
}

export function syntheticCapabilityActivationV1(
  catalogue: CapabilityCatalogueV1,
  actionId: CapabilityActionIdV1 = "crm.contact.create",
): CapabilityActivationV1 {
  const action = catalogue.actions.find((candidate) => candidate.actionId === actionId);
  if (action === undefined) throw new Error("ACTION_UNKNOWN_DENIED");
  const core: Omit<CapabilityActivationV1, "digest"> = {
    schemaVersion: CAPABILITY_ACTIVATION_API_VERSION,
    activationId: "activation:synthetic-maintainer-001",
    catalogueVersion: catalogue.version,
    catalogueDigest: catalogue.digest,
    actionId: action.actionId,
    actionVersion: action.version,
    actionDigest: action.digest,
    tenant: "tenant:synthetic-zoo",
    maintainerId: "maintainer:synthetic-reviewer",
    authorizedAt: "2026-08-09T10:00:00Z",
    expiresAt: "2026-08-10T10:00:00Z",
    activationState: "ACTIVE",
  };
  return { ...core, digest: digest(core) };
}

function issueFrom(error: unknown): CapabilityDecisionIssueV1 {
  const message = error instanceof Error ? error.message : "CATALOGUE_SCHEMA_INVALID_DENIED";
  return CAPABILITY_DECISION_ISSUES_V1.includes(message as CapabilityDecisionIssueV1)
    ? message as CapabilityDecisionIssueV1
    : "CATALOGUE_SCHEMA_INVALID_DENIED";
}

function requestReadback(value: unknown): Pick<CapabilityGatewayDecisionV1,
  "catalogueVersion" | "catalogueDigest" | "actionId" | "actionVersion" | "actionDigest" |
  "correlationDigest" | "requestDigest"> {
  const candidate = isRecord(value) ? value : {};
  return {
    catalogueVersion: typeof candidate.catalogueVersion === "string" ? candidate.catalogueVersion : null,
    catalogueDigest: typeof candidate.catalogueDigest === "string" ? candidate.catalogueDigest : null,
    actionId: typeof candidate.actionId === "string" ? candidate.actionId : null,
    actionVersion: typeof candidate.actionVersion === "string" ? candidate.actionVersion : null,
    actionDigest: typeof candidate.actionDigest === "string" ? candidate.actionDigest : null,
    correlationDigest: typeof candidate.correlationId === "string" ? digest(candidate.correlationId) : null,
    requestDigest: digestOrNull(candidate.request),
  };
}

function makeGatewayDecision(
  core: Omit<CapabilityGatewayDecisionV1, "decisionDigest">,
): CapabilityGatewayDecisionV1 {
  return { ...core, decisionDigest: digest(core) };
}

function denyGateway(value: unknown, issues: readonly CapabilityDecisionIssueV1[]): CapabilityGatewayDecisionV1 {
  return makeGatewayDecision({
    schemaVersion: CAPABILITY_GATEWAY_DECISION_API_VERSION,
    stage: "GATEWAY",
    outcome: "DENY",
    ...requestReadback(value),
    ticket: null,
    issues: [...new Set(issues)].sort(),
  });
}

export function admitCapabilityExecutionAtGatewayV1(
  catalogueValue: unknown,
  activationValue: unknown,
  policyValue: unknown,
  requestValue: unknown,
  observedAt: string,
): CapabilityGatewayDecisionV1 {
  const preIssues: CapabilityDecisionIssueV1[] = [];
  if (!isRecord(requestValue) || requestValue.policyDigest === undefined) preIssues.push("POLICY_MISSING_DENIED");
  if (!isRecord(requestValue) || requestValue.workloadIdentity === undefined || requestValue.userIdentity === undefined) {
    preIssues.push("IDENTITY_MISSING_DENIED");
  }
  if (!isRecord(requestValue) || requestValue.correlationId === undefined || requestValue.requestId === undefined) {
    preIssues.push("CORRELATION_MISSING_DENIED");
  }
  if (!isRecord(requestValue) || requestValue.evidenceSink === undefined) preIssues.push("EVIDENCE_SINK_MISSING_DENIED");
  if (policyValue === null || policyValue === undefined) preIssues.push("POLICY_MISSING_DENIED");
  if (!exactKeys(requestValue, REQUEST_KEYS)) preIssues.push("REQUEST_SCHEMA_INVALID_DENIED");
  if (preIssues.length > 0 || !isRecord(requestValue)) return denyGateway(requestValue, preIssues);

  let catalogue: CapabilityCatalogueV1;
  try { catalogue = verifyCapabilityCatalogueV1(catalogueValue); } catch (error) {
    return denyGateway(requestValue, [issueFrom(error)]);
  }
  let policy: CapabilityActivationPolicyV1;
  try { policy = verifyCapabilityPolicyBindingV1(policyValue, observedAt); } catch (error) {
    return denyGateway(requestValue, [issueFrom(error)]);
  }
  const candidate = requestValue as unknown as CapabilityExecutionRequestV1;
  if (candidate.schemaVersion !== CAPABILITY_EXECUTION_REQUEST_API_VERSION
    || !isDigest(candidate.policyDigest)
    || !isBoundId(candidate.tenant, "tenant")
    || !isBoundId(candidate.workloadIdentity, "workload")
    || !isBoundId(candidate.userIdentity, "user")
    || !isCorrelationId(candidate.correlationId)
    || !isBoundId(candidate.requestId, "request")
    || !exactKeys(candidate.evidenceSink, ["sinkId", "type"])
    || candidate.evidenceSink.type !== "SYNTHETIC_MEMORY"
    || !isBoundId(candidate.evidenceSink.sinkId, "evidence")) {
    return denyGateway(requestValue, ["REQUEST_SCHEMA_INVALID_DENIED"]);
  }
  if (candidate.catalogueVersion !== catalogue.version) return denyGateway(requestValue, ["CATALOGUE_VERSION_STALE_DENIED"]);
  if (candidate.catalogueDigest !== catalogue.digest) return denyGateway(requestValue, ["CATALOGUE_DIGEST_MISMATCH_DENIED"]);
  const action = catalogue.actions.find(({ actionId }) => actionId === candidate.actionId);
  if (action === undefined) return denyGateway(requestValue, ["ACTION_UNKNOWN_DENIED"]);
  if (candidate.actionVersion !== action.version) return denyGateway(requestValue, ["ACTION_VERSION_STALE_DENIED"]);
  if (candidate.actionDigest !== action.digest) return denyGateway(requestValue, ["ACTION_DIGEST_MISMATCH_DENIED"]);
  if (candidate.resource !== action.resource) return denyGateway(requestValue, ["REQUEST_RESOURCE_DENIED"]);
  if (candidate.tenant !== policy.tenant) return denyGateway(requestValue, ["CROSS_TENANT_DENIED"]);
  if (!policy.actionIds.includes(action.actionId) || candidate.policyDigest !== policy.digest) {
    return denyGateway(requestValue, ["POLICY_BINDING_MISMATCH_DENIED"]);
  }
  let activation: CapabilityActivationV1;
  try { activation = verifyCapabilityActivationV1(activationValue, catalogue, policy, observedAt); } catch (error) {
    return denyGateway(requestValue, [issueFrom(error)]);
  }
  if (activation.actionId !== action.actionId) return denyGateway(requestValue, ["ACTION_INACTIVE_DENIED"]);
  if (!validateJson(action.requestSchema, candidate.request)) return denyGateway(requestValue, ["REQUEST_SCHEMA_INVALID_DENIED"]);
  if (Buffer.byteLength(canonicalJson(candidate.request)) > action.resourceBounds.maxRequestBytes) {
    return denyGateway(requestValue, ["RESOURCE_BOUNDS_DENIED"]);
  }
  const readback = requestReadback(candidate);
  const ticket: CapabilityExecutionTicketV1 = {
    catalogueVersion: catalogue.version,
    catalogueDigest: catalogue.digest,
    actionId: action.actionId,
    actionVersion: action.version,
    actionDigest: action.digest,
    activationDigest: activation.digest,
    policyId: policy.policyId,
    policyVersion: policy.version,
    policyDigest: policy.digest,
    tenant: candidate.tenant,
    correlationDigest: readback.correlationDigest ?? digest("correlation:invalid"),
    requestId: candidate.requestId,
    requestDigest: readback.requestDigest ?? digest(null),
    evidenceSink: candidate.evidenceSink,
    request: candidate.request,
  };
  return makeGatewayDecision({
    schemaVersion: CAPABILITY_GATEWAY_DECISION_API_VERSION,
    stage: "GATEWAY",
    outcome: "ALLOW",
    ...readback,
    ticket,
    issues: [],
  });
}

export function verifyCapabilityGatewayDecisionV1(value: unknown): CapabilityGatewayDecisionV1 {
  if (!exactKeys(value, [...GATEWAY_CORE_KEYS, "decisionDigest"])) {
    throw new Error("BROKER_DECISION_INVALID_DENIED");
  }
  const { decisionDigest, ...core } = value;
  if (!isDigest(decisionDigest) || digest(core) !== decisionDigest
    || value.schemaVersion !== CAPABILITY_GATEWAY_DECISION_API_VERSION
    || value.stage !== "GATEWAY"
    || !Array.isArray(value.issues)
    || !value.issues.every((issue) => CAPABILITY_DECISION_ISSUES_V1.includes(issue as CapabilityDecisionIssueV1))
    || (value.outcome === "ALLOW"
      ? !validExecutionTicket(value.ticket) || value.issues.length !== 0
        || value.catalogueVersion !== value.ticket.catalogueVersion
        || value.catalogueDigest !== value.ticket.catalogueDigest
        || value.actionId !== value.ticket.actionId
        || value.actionVersion !== value.ticket.actionVersion
        || value.actionDigest !== value.ticket.actionDigest
        || value.correlationDigest !== value.ticket.correlationDigest
        || value.requestDigest !== value.ticket.requestDigest
      : value.outcome !== "DENY" || value.ticket !== null)) {
    throw new Error("BROKER_DECISION_INVALID_DENIED");
  }
  return value as unknown as CapabilityGatewayDecisionV1;
}

function validExecutionTicket(value: unknown): value is CapabilityExecutionTicketV1 {
  return exactKeys(value, TICKET_KEYS)
    && typeof value.catalogueVersion === "string"
    && isDigest(value.catalogueDigest)
    && typeof value.actionId === "string"
    && typeof value.actionVersion === "string"
    && isDigest(value.actionDigest)
    && isDigest(value.activationDigest)
    && isBoundId(value.policyId, "policy")
    && value.policyVersion === "1.0.0"
    && isDigest(value.policyDigest)
    && isBoundId(value.tenant, "tenant")
    && isDigest(value.correlationDigest)
    && isBoundId(value.requestId, "request")
    && isDigest(value.requestDigest)
    && exactKeys(value.evidenceSink, ["sinkId", "type"])
    && value.evidenceSink.type === "SYNTHETIC_MEMORY"
    && isBoundId(value.evidenceSink.sinkId, "evidence")
    && isRecord(value.request);
}

function makeBrokerReceipt(
  core: Omit<CapabilityBrokerReceiptV1, "receiptDigest">,
): CapabilityBrokerReceiptV1 {
  return { ...core, receiptDigest: digest(core) };
}

function brokerReadback(value: unknown): Pick<CapabilityBrokerReceiptV1,
  "catalogueVersion" | "catalogueDigest" | "actionId" | "actionVersion" | "actionDigest" |
  "correlationDigest" | "requestDigest"> {
  const candidate = isRecord(value) ? value : {};
  return {
    catalogueVersion: typeof candidate.catalogueVersion === "string" ? candidate.catalogueVersion : null,
    catalogueDigest: typeof candidate.catalogueDigest === "string" ? candidate.catalogueDigest : null,
    actionId: typeof candidate.actionId === "string" ? candidate.actionId : null,
    actionVersion: typeof candidate.actionVersion === "string" ? candidate.actionVersion : null,
    actionDigest: typeof candidate.actionDigest === "string" ? candidate.actionDigest : null,
    correlationDigest: typeof candidate.correlationDigest === "string" ? candidate.correlationDigest : null,
    requestDigest: typeof candidate.requestDigest === "string" ? candidate.requestDigest : null,
  };
}

function denyBroker(value: unknown, issues: readonly CapabilityDecisionIssueV1[]): CapabilityBrokerReceiptV1 {
  return makeBrokerReceipt({
    schemaVersion: CAPABILITY_BROKER_RECEIPT_API_VERSION,
    stage: "BROKER",
    outcome: "DENY",
    ...brokerReadback(value),
    responseDigest: null,
    response: null,
    effectCount: 0,
    effectState: "NONE",
    issues: [...new Set(issues)].sort(),
  });
}

function ambiguousBroker(value: unknown): CapabilityBrokerReceiptV1 {
  return makeBrokerReceipt({
    schemaVersion: CAPABILITY_BROKER_RECEIPT_API_VERSION,
    stage: "BROKER",
    outcome: "AMBIGUOUS",
    ...brokerReadback(value),
    responseDigest: null,
    response: null,
    effectCount: null,
    effectState: "AMBIGUOUS_CONSUMED",
    issues: ["SYNTHETIC_COMMIT_AMBIGUOUS_CONSUMED"],
  });
}

const SYSTEM_MONOTONIC_CLOCK: CapabilityMonotonicClockV1 = {
  nowMs: () => Number(process.hrtime.bigint()) / 1_000_000,
};

function readMonotonicClock(clock: CapabilityMonotonicClockV1): number | null {
  try {
    const value = clock.nowMs();
    return Number.isFinite(value) ? value : null;
  } catch {
    return null;
  }
}

function validPreparedEffect(value: unknown): value is PreparedSyntheticCapabilityEffectV1 {
  return exactKeys(value, ["commit", "response"])
    && isRecord(value.response)
    && typeof value.commit === "function";
}

function snapshotRecord(value: Readonly<Record<string, unknown>>): Readonly<Record<string, unknown>> | null {
  try {
    const cloned = structuredClone(value) as unknown;
    if (!isRecord(cloned)) return null;
    return deepFreeze(cloned);
  } catch {
    return null;
  }
}

function deepFreeze<T>(value: T): T {
  if (value !== null && typeof value === "object" && !Object.isFrozen(value)) {
    for (const child of Object.values(value)) deepFreeze(child);
    Object.freeze(value);
  }
  return value;
}

function clearPreCommitReservation(replayStore: CapabilityReplayStoreV1, requestId: string): void {
  if (replayStore.get(requestId) === "IN_FLIGHT") replayStore.delete(requestId);
}

export function executeCapabilityAtBrokerV1(
  catalogueValue: unknown,
  activationValue: unknown,
  policyValue: unknown,
  gatewayDecisionValue: unknown,
  observedAt: string,
  replayStore: CapabilityReplayStoreV1,
  executor: SyntheticCapabilityExecutorV1,
  clock: CapabilityMonotonicClockV1 = SYSTEM_MONOTONIC_CLOCK,
): CapabilityBrokerReceiptV1 {
  let decision: CapabilityGatewayDecisionV1;
  try { decision = verifyCapabilityGatewayDecisionV1(gatewayDecisionValue); } catch {
    return denyBroker(isRecord(gatewayDecisionValue) ? gatewayDecisionValue.ticket : null, ["BROKER_DECISION_INVALID_DENIED"]);
  }
  if (decision.outcome !== "ALLOW" || decision.ticket === null) {
    return denyBroker(decision.ticket, ["BROKER_DECISION_INVALID_DENIED"]);
  }
  const ticket = decision.ticket;
  let catalogue: CapabilityCatalogueV1;
  try { catalogue = verifyCapabilityCatalogueV1(catalogueValue); } catch (error) {
    return denyBroker(ticket, [issueFrom(error)]);
  }
  if (policyValue === null || policyValue === undefined) {
    return denyBroker(ticket, ["POLICY_MISSING_DENIED"]);
  }
  let policy: CapabilityActivationPolicyV1;
  try { policy = verifyCapabilityPolicyBindingV1(policyValue, observedAt); } catch (error) {
    return denyBroker(ticket, [issueFrom(error)]);
  }
  let activation: CapabilityActivationV1;
  try { activation = verifyCapabilityActivationV1(activationValue, catalogue, policy, observedAt); } catch (error) {
    return denyBroker(ticket, [issueFrom(error)]);
  }
  const action = catalogue.actions.find(({ actionId }) => actionId === ticket.actionId);
  if (action === undefined) return denyBroker(ticket, ["ACTION_UNKNOWN_DENIED"]);
  if (ticket.catalogueVersion !== catalogue.version) return denyBroker(ticket, ["CATALOGUE_VERSION_STALE_DENIED"]);
  if (ticket.catalogueDigest !== catalogue.digest) return denyBroker(ticket, ["CATALOGUE_DIGEST_MISMATCH_DENIED"]);
  if (ticket.actionVersion !== action.version) return denyBroker(ticket, ["ACTION_VERSION_STALE_DENIED"]);
  if (ticket.actionDigest !== action.digest) return denyBroker(ticket, ["ACTION_DIGEST_MISMATCH_DENIED"]);
  if (ticket.activationDigest !== activation.digest || activation.actionId !== action.actionId) {
    return denyBroker(ticket, ["ACTIVATION_AUTHORIZATION_INVALID_DENIED"]);
  }
  if (ticket.policyId !== policy.policyId
    || ticket.policyVersion !== policy.version
    || ticket.policyDigest !== policy.digest
    || !policy.actionIds.includes(action.actionId)) {
    return denyBroker(ticket, ["POLICY_BINDING_MISMATCH_DENIED"]);
  }
  if (ticket.tenant !== policy.tenant) return denyBroker(ticket, ["CROSS_TENANT_DENIED"]);
  if (ticket.evidenceSink.type !== "SYNTHETIC_MEMORY") return denyBroker(ticket, ["EVIDENCE_SINK_MISSING_DENIED"]);
  if (digest(ticket.request) !== ticket.requestDigest || !validateJson(action.requestSchema, ticket.request)) {
    return denyBroker(ticket, ["REQUEST_SCHEMA_INVALID_DENIED"]);
  }
  const replayState = replayStore.get(ticket.requestId);
  if (replayState === "IN_FLIGHT") return denyBroker(ticket, ["REPLAY_IN_FLIGHT_DENIED"]);
  if (replayState === "CONSUMED") return denyBroker(ticket, ["REPLAY_CONSUMED_DENIED"]);

  let preparedValue: unknown;
  replayStore.set(ticket.requestId, "IN_FLIGHT");
  const requestSnapshot = snapshotRecord(ticket.request);
  if (requestSnapshot === null
    || !validateJson(action.requestSchema, requestSnapshot)
    || digest(requestSnapshot) !== ticket.requestDigest) {
    clearPreCommitReservation(replayStore, ticket.requestId);
    return denyBroker(ticket, ["REQUEST_SNAPSHOT_INVALID_DENIED"]);
  }
  const startedAt = readMonotonicClock(clock);
  if (startedAt === null) {
    clearPreCommitReservation(replayStore, ticket.requestId);
    return denyBroker(ticket, ["RESOURCE_BOUNDS_DENIED"]);
  }
  try { preparedValue = executor.prepare(action, requestSnapshot); } catch {
    clearPreCommitReservation(replayStore, ticket.requestId);
    return denyBroker(ticket, ["RESPONSE_SCHEMA_INVALID_DENIED"]);
  }
  const preparedAt = readMonotonicClock(clock);
  if (preparedAt === null
    || preparedAt < startedAt
    || preparedAt - startedAt > action.resourceBounds.maxExecutionMs) {
    clearPreCommitReservation(replayStore, ticket.requestId);
    return denyBroker(ticket, ["RESOURCE_BOUNDS_DENIED"]);
  }
  if (!validPreparedEffect(preparedValue)) {
    clearPreCommitReservation(replayStore, ticket.requestId);
    return denyBroker(ticket, ["PREPARED_EFFECT_INVALID_DENIED"]);
  }
  const responseSnapshot = snapshotRecord(preparedValue.response);
  if (responseSnapshot === null || !validateJson(action.responseSchema, responseSnapshot)) {
    clearPreCommitReservation(replayStore, ticket.requestId);
    return denyBroker(ticket, ["RESPONSE_SCHEMA_INVALID_DENIED"]);
  }
  if (Buffer.byteLength(canonicalJson(responseSnapshot)) > action.resourceBounds.maxResponseBytes) {
    clearPreCommitReservation(replayStore, ticket.requestId);
    return denyBroker(ticket, ["RESOURCE_BOUNDS_DENIED"]);
  }
  try {
    preparedValue.commit();
  } catch {
    replayStore.set(ticket.requestId, "CONSUMED");
    return ambiguousBroker(ticket);
  }
  replayStore.set(ticket.requestId, "CONSUMED");
  const responseDigest = digest(responseSnapshot);
  return makeBrokerReceipt({
    schemaVersion: CAPABILITY_BROKER_RECEIPT_API_VERSION,
    stage: "BROKER",
    outcome: "EXECUTED",
    ...brokerReadback(ticket),
    responseDigest,
    response: responseSnapshot,
    effectCount: 1,
    effectState: "CONFIRMED_ONE",
    issues: [],
  });
}

export function syntheticCapabilityExecutionRequestV1(
  catalogue: CapabilityCatalogueV1,
  actionId: CapabilityActionIdV1 = "crm.contact.create",
  policy: CapabilityActivationPolicyV1 = syntheticCapabilityPolicyBindingV1(),
): CapabilityExecutionRequestV1 {
  const action = catalogue.actions.find((candidate) => candidate.actionId === actionId);
  if (action === undefined) throw new Error("ACTION_UNKNOWN_DENIED");
  return {
    schemaVersion: CAPABILITY_EXECUTION_REQUEST_API_VERSION,
    catalogueVersion: catalogue.version,
    catalogueDigest: catalogue.digest,
    actionId: action.actionId,
    actionVersion: action.version,
    actionDigest: action.digest,
    resource: action.resource,
    tenant: "tenant:synthetic-zoo",
    workloadIdentity: "workload:synthetic-agent",
    userIdentity: "user:synthetic-operator",
    policyDigest: policy.digest,
    correlationId: "correlation:aas-012-001",
    requestId: "request:aas-012-001",
    evidenceSink: { type: "SYNTHETIC_MEMORY", sinkId: "evidence:synthetic-memory" },
    request: actionId === "crm.contact.create"
      ? { email: "alex@example.test", name: "Alex Example" }
      : actionId === "erp.order.create"
        ? { quantity: 2, sku: "SYN-ZOO-001" }
        : { userId: "user:synthetic-operator" },
  };
}

export function listCapabilityCatalogueV1(value: unknown): Readonly<{
  catalogueVersion: string | null;
  catalogueDigest: string | null;
  activationAuthority: false;
  executionAuthority: false;
  entries: readonly Readonly<{
    actionId: CapabilityActionIdV1;
    version: "1.0.0";
    digest: string;
    activationState: "INACTIVE";
  }>[];
}> {
  try {
    const catalogue = verifyCapabilityCatalogueV1(value);
    return {
      catalogueVersion: catalogue.version,
      catalogueDigest: catalogue.digest,
      activationAuthority: false,
      executionAuthority: false,
      entries: catalogue.actions.map(({ actionId, version, digest: actionDigest, activationState }) => ({
        actionId, version, digest: actionDigest, activationState,
      })),
    };
  } catch {
    return {
      catalogueVersion: null,
      catalogueDigest: null,
      activationAuthority: false,
      executionAuthority: false,
      entries: [],
    };
  }
}
