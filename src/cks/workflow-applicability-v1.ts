/**
 * CKS-11 shadow fast-path applicability gate (v1).
 *
 * This is a decision-only guard. It does not replay, execute, promote, deploy,
 * activate, or grant authority. A shadow replay may proceed only after this
 * gate proves one exact compatible GovernedWorkflow, complete typed inputs,
 * current Knowledge, and unchanged Capability/Authority envelopes.
 */
import {
  evaluateFastPathRouteV1,
  governedAssetsDigestV1,
  type AuthorityGrantV1,
  type AuthorityRequirementV1,
  type CapabilityV1,
  type ExactRefV1,
  type FastPathRouteStatusV1,
  type RouteReasonCodeV1,
} from "./governed-assets-v1.js";
import {
  resolveKnowledgeDependenciesV1,
  type KnowledgeRevalidationInputV1,
  type KnowledgeRevalidationResultV1,
} from "./knowledge-revalidation-v1.js";

export const WORKFLOW_APPLICABILITY_SCHEMA_V1 =
  "pansphaira.cks-11/workflow-applicability/v1" as const;
export const WORKFLOW_APPLICABILITY_CONTRACT_SCHEMA_V1 =
  "pansphaira.cks-11/applicability-contract/v1" as const;

const DIGEST = /^[a-f0-9]{64}$/;
const DANGEROUS_KEYS = new Set(["__proto__", "prototype", "constructor"]);
const ROUTE_REASON_ORDER: readonly RouteReasonCodeV1[] = [
  "NONE",
  "MISSING_INPUT",
  "INVALID_INPUT",
  "NOT_APPLICABLE",
  "AMBIGUOUS_MATCH",
  "KNOWLEDGE_MISSING",
  "STALE_KNOWLEDGE",
  "KNOWLEDGE_SUPERSEDED",
  "VERSION_DRIFT",
  "DIGEST_MISMATCH",
  "EVIDENCE_INCOMPLETE",
  "BOUNDARY_UNAVAILABLE",
  "CAPABILITY_WIDENING",
  "AUTHORITY_WIDENING",
  "INVALID_CONTRACT",
];
const INPUT_KEYS = [
  "schemaVersion",
  "useTimeMs",
  "contextDigest",
  "applicabilityContract",
  "inputSchema",
  "providedInputs",
  "workflowMatches",
  "knowledgeInput",
  "evidenceStatus",
  "boundaryStatus",
  "capabilityEnvelope",
  "authorityEnvelope",
] as const;
const CONTRACT_KEYS = [
  "schemaVersion",
  "contractVersion",
  "contextDimensions",
  "includedScopes",
  "excludedScopes",
  "preconditions",
  "supportedConfigurations",
  "validFromMs",
  "validUntilMs",
  "knownCounterexampleDigests",
  "contractDigest",
] as const;
const TYPED_SCHEMA_KEYS = ["name", "type", "required"] as const;
const TYPED_INPUT_KEYS = ["name", "type", "value"] as const;
const MATCH_KEYS = ["workflowRef", "contextDigest", "applicabilityContractDigest"] as const;
const CAPABILITY_ENVELOPE_KEYS = [
  "baselineCeiling",
  "currentCeiling",
  "baselineEnabledCapabilities",
  "currentEnabledCapabilities",
  "requestedCapabilities",
] as const;
const AUTHORITY_ENVELOPE_KEYS = [
  "baselineRequirements",
  "currentRequirements",
  "baselineGrants",
  "currentGrants",
  "stopState",
] as const;
const CAPABILITY_KEYS = [
  "action",
  "dataClass",
  "credentialUse",
  "effectClass",
  "field",
  "networkRoute",
  "purpose",
  "resource",
  "target",
  "tenant",
] as const;
const AUTHORITY_REQUIREMENT_KEYS = ["actor", "tenant", "action", "target", "scope"] as const;
const AUTHORITY_GRANT_KEYS = [
  "actor",
  "tenant",
  "action",
  "target",
  "scope",
  "approvalDigest",
  "validFromMs",
  "validUntilMs",
  "budgetLimitCents",
] as const;
const INPUT_TYPES = ["string", "integer", "number", "boolean", "object", "array", "null"] as const;
type InputTypeV1 = (typeof INPUT_TYPES)[number];
type DataRecord = Record<string, unknown>;

export interface ApplicabilityContractV1 {
  readonly schemaVersion: typeof WORKFLOW_APPLICABILITY_CONTRACT_SCHEMA_V1;
  readonly contractVersion: string;
  readonly contextDimensions: readonly string[];
  readonly includedScopes: readonly string[];
  readonly excludedScopes: readonly string[];
  readonly preconditions: readonly string[];
  readonly supportedConfigurations: readonly string[];
  readonly validFromMs: number;
  readonly validUntilMs: number;
  readonly knownCounterexampleDigests: readonly string[];
  readonly contractDigest: string;
}

export interface TypedInputSchemaV1 {
  readonly name: string;
  readonly type: InputTypeV1;
  readonly required: boolean;
}

export interface TypedWorkflowInputV1 {
  readonly name: string;
  readonly type: InputTypeV1;
  readonly value: unknown;
}

export interface WorkflowApplicabilityMatchV1 {
  readonly workflowRef: ExactRefV1;
  readonly contextDigest: string;
  readonly applicabilityContractDigest: string;
}

export interface CapabilityEnvelopeSnapshotV1 {
  readonly baselineCeiling: readonly CapabilityV1[];
  readonly currentCeiling: readonly CapabilityV1[];
  readonly baselineEnabledCapabilities: readonly CapabilityV1[];
  readonly currentEnabledCapabilities: readonly CapabilityV1[];
  readonly requestedCapabilities: readonly CapabilityV1[];
}

export interface AuthorityEnvelopeSnapshotV1 {
  readonly baselineRequirements: readonly AuthorityRequirementV1[];
  readonly currentRequirements: readonly AuthorityRequirementV1[];
  readonly baselineGrants: readonly AuthorityGrantV1[];
  readonly currentGrants: readonly AuthorityGrantV1[];
  readonly stopState: "NONE" | "STOPPED";
}

export interface WorkflowApplicabilityInputV1 {
  readonly schemaVersion: typeof WORKFLOW_APPLICABILITY_SCHEMA_V1;
  readonly useTimeMs: number;
  readonly contextDigest: string;
  readonly applicabilityContract: ApplicabilityContractV1;
  readonly inputSchema: readonly TypedInputSchemaV1[];
  readonly providedInputs: readonly TypedWorkflowInputV1[];
  readonly workflowMatches: readonly WorkflowApplicabilityMatchV1[];
  readonly knowledgeInput: KnowledgeRevalidationInputV1;
  readonly evidenceStatus: "COMPLETE" | "INCOMPLETE";
  readonly boundaryStatus: "AVAILABLE" | "UNAVAILABLE";
  readonly capabilityEnvelope: CapabilityEnvelopeSnapshotV1;
  readonly authorityEnvelope: AuthorityEnvelopeSnapshotV1;
}

export interface WorkflowApplicabilityDecisionV1 {
  readonly status: FastPathRouteStatusV1;
  readonly reasonCodes: readonly RouteReasonCodeV1[];
  readonly decisionDigest: string;
  readonly shadowReplay: "ALLOWED" | "ABORTED";
  readonly matchedWorkflowRef: ExactRefV1 | null;
  readonly applicabilityDigest: string | null;
  readonly knowledgeDecisionDigest: string | null;
  readonly capabilityEnvelopeDigest: string | null;
  readonly authorityEnvelopeDigest: string | null;
}

function isPlainRecord(value: unknown): value is DataRecord {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) return false;
  for (const key of Reflect.ownKeys(value)) {
    if (typeof key !== "string" || DANGEROUS_KEYS.has(key)) return false;
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (descriptor === undefined || !("value" in descriptor) || descriptor.enumerable !== true) return false;
  }
  return true;
}

function isDenseArray(value: unknown): value is unknown[] {
  if (!Array.isArray(value) || Object.getPrototypeOf(value) !== Array.prototype) return false;
  const keys = Reflect.ownKeys(value);
  if (keys.length !== value.length + 1) return false;
  for (let index = 0; index < value.length; index += 1) {
    const descriptor = Object.getOwnPropertyDescriptor(value, index);
    if (descriptor === undefined || !("value" in descriptor) || descriptor.enumerable !== true) return false;
  }
  return true;
}

function hasExactKeys(value: unknown, keys: readonly string[]): value is DataRecord {
  if (!isPlainRecord(value)) return false;
  const actual = Object.keys(value).sort();
  const expected = [...keys].sort();
  return actual.length === expected.length && actual.every((key, index) => key === expected[index]);
}

function isSafeInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0 && !Object.is(value, -0);
}

function isExactString(value: unknown, maximum = 256): value is string {
  return (
    typeof value === "string" &&
    value.length > 0 &&
    value.length <= maximum &&
    value === value.trim() &&
    !/[\u0000-\u001f\u007f]/.test(value)
  );
}

function isDigest(value: unknown): value is string {
  return typeof value === "string" && DIGEST.test(value);
}

function isStringArray(value: unknown, allowEmpty = true): value is string[] {
  return isDenseArray(value) && (allowEmpty || value.length > 0) && value.every((entry) => isExactString(entry));
}

function hasNoDuplicates(values: readonly string[]): boolean {
  return new Set(values).size === values.length;
}

function isJsonValue(value: unknown, depth = 0): boolean {
  if (depth > 32 || value === null || typeof value === "string" || typeof value === "boolean") return value === null || typeof value !== "undefined";
  if (typeof value === "number") return Number.isFinite(value);
  if (Array.isArray(value)) return isDenseArray(value) && value.every((entry) => isJsonValue(entry, depth + 1));
  if (!isPlainRecord(value)) return false;
  return Object.values(value).every((entry) => isJsonValue(entry, depth + 1));
}

function isTypedValue(value: unknown, type: InputTypeV1): boolean {
  switch (type) {
    case "string":
      return isExactString(value);
    case "integer":
      return isSafeInteger(value);
    case "number":
      return typeof value === "number" && Number.isFinite(value);
    case "boolean":
      return typeof value === "boolean";
    case "object":
      return isPlainRecord(value) && isJsonValue(value);
    case "array":
      return isDenseArray(value) && isJsonValue(value);
    case "null":
      return value === null;
  }
}

function isInputType(value: unknown): value is InputTypeV1 {
  return typeof value === "string" && INPUT_TYPES.includes(value as InputTypeV1);
}

function isExactRefShape(value: unknown): value is ExactRefV1 {
  return (
    hasExactKeys(value, ["kind", "id", "schemaVersion", "version", "digestAlgorithm", "digest"]) &&
    isExactString(value["kind"]) &&
    isExactString(value["id"]) &&
    isExactString(value["schemaVersion"]) &&
    isExactString(value["version"]) &&
    isExactString(value["digestAlgorithm"]) &&
    isDigest(value["digest"])
  );
}

function isCapability(value: unknown): value is CapabilityV1 {
  if (!hasExactKeys(value, CAPABILITY_KEYS)) return false;
  return CAPABILITY_KEYS.every((key) => value[key] === null || isExactString(value[key]));
}

function isAuthorityRequirement(value: unknown): value is AuthorityRequirementV1 {
  if (!hasExactKeys(value, AUTHORITY_REQUIREMENT_KEYS)) return false;
  return (
    isExactString(value["actor"]) &&
    isExactString(value["tenant"]) &&
    isExactString(value["action"]) &&
    isExactString(value["target"]) &&
    (value["scope"] === null || isExactString(value["scope"]))
  );
}

function isAuthorityGrant(value: unknown): value is AuthorityGrantV1 {
  if (!hasExactKeys(value, AUTHORITY_GRANT_KEYS)) return false;
  return (
    isExactString(value["actor"]) &&
    isExactString(value["tenant"]) &&
    isExactString(value["action"]) &&
    isExactString(value["target"]) &&
    (value["scope"] === null || isExactString(value["scope"])) &&
    isDigest(value["approvalDigest"]) &&
    isSafeInteger(value["validFromMs"]) &&
    isSafeInteger(value["validUntilMs"]) &&
    value["validFromMs"] <= value["validUntilMs"] &&
    (value["budgetLimitCents"] === null || isSafeInteger(value["budgetLimitCents"]))
  );
}

function immutable<T>(value: T): T {
  if (value !== null && typeof value === "object") {
    for (const entry of Object.values(value as DataRecord)) immutable(entry);
    Object.freeze(value);
  }
  return value;
}

function sortedSetDigest(values: readonly unknown[]): string {
  const normalized = values.map((value) => governedAssetsDigestV1(value)).sort();
  return governedAssetsDigestV1(normalized);
}

function capabilityEnvelopeDigest(envelope: CapabilityEnvelopeSnapshotV1, current: boolean): string {
  return governedAssetsDigestV1({
    ceiling: sortedSetDigest(current ? envelope.currentCeiling : envelope.baselineCeiling),
    enabled: sortedSetDigest(
      current ? envelope.currentEnabledCapabilities : envelope.baselineEnabledCapabilities,
    ),
  });
}

function authorityEnvelopeDigest(envelope: AuthorityEnvelopeSnapshotV1, current: boolean): string {
  return governedAssetsDigestV1({
    requirements: sortedSetDigest(current ? envelope.currentRequirements : envelope.baselineRequirements),
    grants: sortedSetDigest(current ? envelope.currentGrants : envelope.baselineGrants),
    stopState: envelope.stopState,
  });
}

function clone<T>(value: T): T {
  if (value === null || typeof value !== "object") return value;
  if (Array.isArray(value)) return value.map((entry) => clone(entry)) as T;
  const result: DataRecord = {};
  for (const [key, entry] of Object.entries(value as DataRecord)) {
    Object.defineProperty(result, key, {
      value: clone(entry),
      writable: true,
      enumerable: true,
      configurable: true,
    });
  }
  return result as T;
}

function orderedReasons(reasons: readonly RouteReasonCodeV1[]): readonly RouteReasonCodeV1[] {
  const set = new Set(reasons);
  return ROUTE_REASON_ORDER.filter((reason) => set.has(reason));
}

function decision(
  status: FastPathRouteStatusV1,
  reasons: readonly RouteReasonCodeV1[],
  contextDigest: string | null,
  useTimeMs: number | null,
  matchedWorkflowRef: ExactRefV1 | null = null,
  applicabilityDigest: string | null = null,
  knowledgeDecisionDigest: string | null = null,
  capabilityDigest: string | null = null,
  authorityDigest: string | null = null,
): WorkflowApplicabilityDecisionV1 {
  const finalReasons = orderedReasons(reasons.length === 0 ? ["NONE"] : reasons);
  const payload = {
    status,
    reasonCodes: finalReasons,
    contextDigest,
    useTimeMs,
    matchedWorkflowRef,
    applicabilityDigest,
    knowledgeDecisionDigest,
    capabilityEnvelopeDigest: capabilityDigest,
    authorityEnvelopeDigest: authorityDigest,
  };
  return immutable(clone({
    status,
    reasonCodes: finalReasons,
    decisionDigest: governedAssetsDigestV1(payload),
    shadowReplay: status === "FAST_PATH_ALLOWED" ? "ALLOWED" : "ABORTED",
    matchedWorkflowRef,
    applicabilityDigest,
    knowledgeDecisionDigest,
    capabilityEnvelopeDigest: capabilityDigest,
    authorityEnvelopeDigest: authorityDigest,
  }));
}

function invalidDecision(input: unknown): WorkflowApplicabilityDecisionV1 {
  const record = isPlainRecord(input) ? input : {};
  return decision(
    "FAST_PATH_ABORTED",
    ["INVALID_INPUT"],
    isDigest(record["contextDigest"]) ? record["contextDigest"] : null,
    isSafeInteger(record["useTimeMs"]) ? record["useTimeMs"] : null,
  );
}

function validateContract(value: unknown): value is ApplicabilityContractV1 {
  if (!hasExactKeys(value, CONTRACT_KEYS)) return false;
  return (
    value["schemaVersion"] === WORKFLOW_APPLICABILITY_CONTRACT_SCHEMA_V1 &&
    isExactString(value["contractVersion"], 128) &&
    isStringArray(value["contextDimensions"], false) &&
    hasNoDuplicates(value["contextDimensions"]) &&
    isStringArray(value["includedScopes"]) &&
    hasNoDuplicates(value["includedScopes"]) &&
    isStringArray(value["excludedScopes"]) &&
    hasNoDuplicates(value["excludedScopes"]) &&
    isStringArray(value["preconditions"]) &&
    hasNoDuplicates(value["preconditions"]) &&
    isStringArray(value["supportedConfigurations"]) &&
    hasNoDuplicates(value["supportedConfigurations"]) &&
    isSafeInteger(value["validFromMs"]) &&
    isSafeInteger(value["validUntilMs"]) &&
    value["validFromMs"] < value["validUntilMs"] &&
    isDenseArray(value["knownCounterexampleDigests"]) &&
    value["knownCounterexampleDigests"].every(isDigest) &&
    hasNoDuplicates(value["knownCounterexampleDigests"]) &&
    isDigest(value["contractDigest"]) &&
    governedAssetsDigestV1(value, "contractDigest") === value["contractDigest"]
  );
}

function validateTypedInputs(schema: unknown, provided: unknown): "VALID" | "MISSING_INPUT" | "INVALID_INPUT" {
  if (!isDenseArray(schema) || !isDenseArray(provided)) return "INVALID_INPUT";
  const declarations: TypedInputSchemaV1[] = [];
  for (const entry of schema) {
    if (
      !hasExactKeys(entry, TYPED_SCHEMA_KEYS) ||
      !isExactString(entry["name"], 128) ||
      !isInputType(entry["type"]) ||
      typeof entry["required"] !== "boolean"
    ) return "INVALID_INPUT";
    declarations.push(entry as unknown as TypedInputSchemaV1);
  }
  if (new Set(declarations.map((entry) => entry.name)).size !== declarations.length) return "INVALID_INPUT";

  const values = new Map<string, TypedWorkflowInputV1>();
  for (const entry of provided) {
    if (
      !hasExactKeys(entry, TYPED_INPUT_KEYS) ||
      !isExactString(entry["name"], 128) ||
      !isInputType(entry["type"]) ||
      !isTypedValue(entry["value"], entry["type"])
    ) return "INVALID_INPUT";
    if (values.has(entry["name"])) return "INVALID_INPUT";
    values.set(entry["name"], entry as unknown as TypedWorkflowInputV1);
  }

  const declarationsByName = new Map(declarations.map((entry) => [entry.name, entry]));
  for (const value of values.values()) {
    const declaration = declarationsByName.get(value.name);
    if (declaration === undefined || declaration.type !== value.type) return "INVALID_INPUT";
  }
  for (const declaration of declarations) {
    if (declaration.required && !values.has(declaration.name)) return "MISSING_INPUT";
  }
  return "VALID";
}

function validateMatches(value: unknown): value is WorkflowApplicabilityMatchV1[] {
  if (!isDenseArray(value)) return false;
  return value.every(
    (entry) =>
      hasExactKeys(entry, MATCH_KEYS) &&
      isExactRefShape(entry["workflowRef"]) &&
      isDigest(entry["contextDigest"]) &&
      isDigest(entry["applicabilityContractDigest"]),
  );
}

function validateEnvelopes(
  capability: unknown,
  authority: unknown,
): capability is CapabilityEnvelopeSnapshotV1 {
  if (!hasExactKeys(capability, CAPABILITY_ENVELOPE_KEYS) || !hasExactKeys(authority, AUTHORITY_ENVELOPE_KEYS)) return false;
  const capabilityArrays = [
    capability["baselineCeiling"],
    capability["currentCeiling"],
    capability["baselineEnabledCapabilities"],
    capability["currentEnabledCapabilities"],
    capability["requestedCapabilities"],
  ];
  if (!capabilityArrays.every((value) => isDenseArray(value) && value.every(isCapability))) return false;
  const baselineRequirements = authority["baselineRequirements"];
  const currentRequirements = authority["currentRequirements"];
  const baselineGrants = authority["baselineGrants"];
  const currentGrants = authority["currentGrants"];
  if (
    !isDenseArray(baselineRequirements) ||
    !isDenseArray(currentRequirements) ||
    !isDenseArray(baselineGrants) ||
    !isDenseArray(currentGrants) ||
    !baselineRequirements.every(isAuthorityRequirement) ||
    !currentRequirements.every(isAuthorityRequirement) ||
    !baselineGrants.every(isAuthorityGrant) ||
    !currentGrants.every(isAuthorityGrant) ||
    (authority["stopState"] !== "NONE" && authority["stopState"] !== "STOPPED")
  ) return false;
  return true;
}

function knowledgeFailure(
  result: KnowledgeRevalidationResultV1,
  contextDigest: string,
  useTimeMs: number,
  applicabilityDigest: string,
  capabilityDigest: string,
  authorityDigest: string,
): WorkflowApplicabilityDecisionV1 {
  return decision(
    result.status,
    result.reasonCodes,
    contextDigest,
    useTimeMs,
    null,
    applicabilityDigest,
    result.decisionDigest,
    capabilityDigest,
    authorityDigest,
  );
}

/**
 * Evaluate applicability before any shadow workflow replay.
 *
 * The returned ALLOWED state authorizes only a bounded shadow replay decision;
 * it is not an execution, activation, promotion, or Authority grant.
 */
export function evaluateWorkflowApplicabilityV1(input: unknown): WorkflowApplicabilityDecisionV1 {
  if (!hasExactKeys(input, INPUT_KEYS)) return invalidDecision(input);
  const record = input;
  const contextDigest = record["contextDigest"];
  const useTimeMs = record["useTimeMs"];
  if (
    record["schemaVersion"] !== WORKFLOW_APPLICABILITY_SCHEMA_V1 ||
    !isSafeInteger(useTimeMs) ||
    !isDigest(contextDigest) ||
    !validateContract(record["applicabilityContract"]) ||
    !validateMatches(record["workflowMatches"]) ||
    !validateEnvelopes(record["capabilityEnvelope"], record["authorityEnvelope"]) ||
    (record["evidenceStatus"] !== "COMPLETE" && record["evidenceStatus"] !== "INCOMPLETE") ||
    (record["boundaryStatus"] !== "AVAILABLE" && record["boundaryStatus"] !== "UNAVAILABLE")
  ) return invalidDecision(input);

  const contract = record["applicabilityContract"] as ApplicabilityContractV1;
  const applicabilityDigest = contract.contractDigest;
  const capability = record["capabilityEnvelope"] as CapabilityEnvelopeSnapshotV1;
  const authority = record["authorityEnvelope"] as AuthorityEnvelopeSnapshotV1;
  const baselineCapabilityDigest = capabilityEnvelopeDigest(capability, false);
  const currentCapabilityDigest = capabilityEnvelopeDigest(capability, true);
  const currentAuthorityDigest = authorityEnvelopeDigest(authority, true);
  const baselineAuthorityDigest = authorityEnvelopeDigest(authority, false);

  if (baselineCapabilityDigest !== currentCapabilityDigest) {
    return decision(
      "FAST_PATH_ABORTED",
      ["CAPABILITY_WIDENING"],
      contextDigest,
      useTimeMs,
      null,
      applicabilityDigest,
      null,
      currentCapabilityDigest,
      currentAuthorityDigest,
    );
  }
  if (baselineAuthorityDigest !== currentAuthorityDigest) {
    return decision(
      "FAST_PATH_ABORTED",
      ["AUTHORITY_WIDENING"],
      contextDigest,
      useTimeMs,
      null,
      applicabilityDigest,
      null,
      currentCapabilityDigest,
      currentAuthorityDigest,
    );
  }

  const typedInputStatus = validateTypedInputs(record["inputSchema"], record["providedInputs"]);
  if (typedInputStatus === "INVALID_INPUT") {
    return decision(
      "FAST_PATH_ABORTED",
      ["INVALID_INPUT"],
      contextDigest,
      useTimeMs,
      null,
      applicabilityDigest,
      null,
      currentCapabilityDigest,
      currentAuthorityDigest,
    );
  }
  if (typedInputStatus === "MISSING_INPUT") {
    return decision(
      "FAST_PATH_ABORTED",
      ["MISSING_INPUT"],
      contextDigest,
      useTimeMs,
      null,
      applicabilityDigest,
      null,
      currentCapabilityDigest,
      currentAuthorityDigest,
    );
  }

  const matches = record["workflowMatches"] as WorkflowApplicabilityMatchV1[];
  const duplicateMatch = new Set(matches.map((entry) => governedAssetsDigestV1(entry.workflowRef))).size !== matches.length;
  if (duplicateMatch) {
    return decision(
      "FAST_PATH_ABORTED",
      ["AMBIGUOUS_MATCH"],
      contextDigest,
      useTimeMs,
      null,
      applicabilityDigest,
      null,
      currentCapabilityDigest,
      currentAuthorityDigest,
    );
  }
  const compatible = matches.filter(
    (entry) =>
      entry.contextDigest === contextDigest && entry.applicabilityContractDigest === applicabilityDigest,
  );
  if (compatible.length === 0) {
    return decision(
      "FAST_PATH_ABORTED",
      ["NOT_APPLICABLE"],
      contextDigest,
      useTimeMs,
      null,
      applicabilityDigest,
      null,
      currentCapabilityDigest,
      currentAuthorityDigest,
    );
  }
  if (compatible.length !== 1) {
    return decision(
      "FAST_PATH_ABORTED",
      ["AMBIGUOUS_MATCH"],
      contextDigest,
      useTimeMs,
      null,
      applicabilityDigest,
      null,
      currentCapabilityDigest,
      currentAuthorityDigest,
    );
  }
  const selectedMatch = compatible[0];
  if (selectedMatch === undefined) return invalidDecision(input);

  const knowledgeInput = record["knowledgeInput"];
  const knowledge = resolveKnowledgeDependenciesV1(knowledgeInput);
  if (knowledge.status !== "FAST_PATH_ALLOWED") {
    return knowledgeFailure(
      knowledge,
      contextDigest,
      useTimeMs,
      applicabilityDigest,
      currentCapabilityDigest,
      currentAuthorityDigest,
    );
  }
  if (knowledge.asOfMs !== useTimeMs) {
    return decision(
      "REVALIDATION_REQUIRED",
      ["VERSION_DRIFT"],
      contextDigest,
      useTimeMs,
      null,
      applicabilityDigest,
      knowledge.decisionDigest,
      currentCapabilityDigest,
      currentAuthorityDigest,
    );
  }
  if (record["evidenceStatus"] === "INCOMPLETE") {
    return decision(
      "REVALIDATION_REQUIRED",
      ["EVIDENCE_INCOMPLETE"],
      contextDigest,
      useTimeMs,
      null,
      applicabilityDigest,
      knowledge.decisionDigest,
      currentCapabilityDigest,
      currentAuthorityDigest,
    );
  }
  if (record["boundaryStatus"] === "UNAVAILABLE") {
    return decision(
      "REVALIDATION_REQUIRED",
      ["BOUNDARY_UNAVAILABLE"],
      contextDigest,
      useTimeMs,
      null,
      applicabilityDigest,
      knowledge.decisionDigest,
      currentCapabilityDigest,
      currentAuthorityDigest,
    );
  }

  const route = evaluateFastPathRouteV1({
    useTimeMs,
    contextDigest,
    matchedGovernedWorkflowRefs: [selectedMatch.workflowRef],
    inputCompletenessStatus: "COMPLETE",
    knowledgeStatus: "CURRENT",
    versionStatus: "EXACT",
    digestStatus: "MATCH",
    evidenceStatus: record["evidenceStatus"],
    boundaryStatus: record["boundaryStatus"],
    capabilityCeiling: capability.currentCeiling,
    policyEnabledCapabilities: capability.currentEnabledCapabilities,
    requestedCapabilities: capability.requestedCapabilities,
    authorityRequirements: authority.currentRequirements,
    envelopeGrants: authority.currentGrants,
    stopState: authority.stopState,
  });
  return decision(
    route.status,
    route.reasonCodes,
    contextDigest,
    useTimeMs,
    selectedMatch.workflowRef,
    applicabilityDigest,
    knowledge.decisionDigest,
    currentCapabilityDigest,
    currentAuthorityDigest,
  );
}

/** Descriptive aliases for callers that name the guarded route explicitly. */
export const evaluateShadowFastPathApplicabilityV1 = evaluateWorkflowApplicabilityV1;
export const guardShadowFastPathReplayV1 = evaluateWorkflowApplicabilityV1;
