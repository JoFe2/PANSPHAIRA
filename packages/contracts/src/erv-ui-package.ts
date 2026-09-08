import { createHash } from "node:crypto";
import { canonicalJson } from "./canonical-json.js";
import {
  AP04_ERV_CASE_PACK_SHA256_V1,
  INCOMING_INVOICE_ERV_CASE_PACK_V1,
  INCOMING_INVOICE_ERV_CORE_V1,
  type ErvCorePackageV1,
} from "./incoming-invoice-erv.js";
import {
  resolveIncomingInvoiceScenarioV1,
  type IncomingInvoiceScenarioInputV1,
  type IncomingInvoiceScenarioResolutionV1,
  type IncomingInvoiceScenarioV1,
} from "./incoming-invoice-blueprint.js";
import {
  INCOMING_INVOICE_ADAPTIVE_UI_SCHEMA_V1,
  type IncomingInvoiceConfigurationDeltaV1,
  type IncomingInvoiceSetupTranscriptV1,
  type IncomingInvoiceUiManifestV1,
  type IncomingInvoiceErvRequirementV1,
} from "./incoming-invoice-adaptive-ui.js";

export const ERV_UI_PACKAGE_SCHEMA_V1 = "chimpmaera.incoming-invoice/erv-ui-package/v1" as const;
export const ERV_UI_PACKAGE_VERSION_V1 = "1.0.0" as const;

const DISPLAY_KINDS = ["TEXT", "STATUS", "EVIDENCE_LIST", "ACTION"] as const;
const COMPONENT_STATES = ["VALUE", "UNKNOWN", "CONFLICT", "UNSUPPORTED"] as const;
const NONCLAIMS = [
  "NO_PRODUCTION_FRONTEND",
  "NO_CUSTOMER_DATA",
  "NO_LIVE_ERP_INTEGRATION",
  "NO_FINANCIAL_OPINION",
  "NO_EXTERNAL_EXECUTION_AUTHORITY",
] as const;
const CAPABILITY_IDS = [INCOMING_INVOICE_ERV_CORE_V1, INCOMING_INVOICE_ERV_CASE_PACK_V1] as const;

type SourceBindingV1 = Readonly<{
  requirementDigest: string;
  configurationDigest: string;
  scenarioDigest: string;
  coreDigest: string;
  adaptiveUiManifestDigest: string;
  configurationDeltaDigest: string | null;
  setupTranscriptDigest: string | null;
  fieldIds: readonly string[];
  actionIds: readonly string[];
}>;

// These are the content-addressed AP-05 release identities. The package
// contract is not a general-purpose adapter for caller-owned AP-05-shaped
// inputs: only these released source chains may be published or rendered.
const SOURCE_BINDINGS: Partial<Record<IncomingInvoiceScenarioV1, SourceBindingV1>> = {
  LEAN: {
    requirementDigest: "8e13d2d6c04c184ae8b3f6345c5ad9b57914023e7cbe0c4259d9c7095982440a",
    configurationDigest: "bc34026fd7c89a63a62123bf16e5c5ae608202bdc37bd5c9113303dcc093fff3",
    scenarioDigest: "eee66e73040fefc58f60645d4fa403bdafe3f8a31f3f7c7907a71fae63015a6d",
    coreDigest: "618aeba909d7210dd5fe412e068cea204c9b64da2aaa4e1c409a94694850132d",
    adaptiveUiManifestDigest: "32a99392fad099ee1534e9565fa84bf5f6c32c0846abccf24f7034fe6898a0a1",
    configurationDeltaDigest: null,
    setupTranscriptDigest: null,
    fieldIds: ["supplier", "purchaseOrder", "invoice", "matchStatus", "evidenceReferences"],
    actionIds: ["VIEW_EVIDENCE", "PROVIDE_MISSING_CONTEXT"],
  },
  SEGREGATED_ENTERPRISE: {
    requirementDigest: "82f245dfb1e71ee66cde0191c91708c084a7083d15fd99690332cc2e32096698",
    configurationDigest: "deada62bbe444bdc3c2eed88df0a5b93330f78d1da847a8e569a91c75c159737",
    scenarioDigest: "6f1c891db95bbfac8714dcbc1a866c349efc013638bfc5d8db7259f6b06dedf0",
    coreDigest: "618aeba909d7210dd5fe412e068cea204c9b64da2aaa4e1c409a94694850132d",
    adaptiveUiManifestDigest: "ebfde15249678a8fa7bc837adcfce7998f694d7ae6d9744c59b132220c99aba4",
    configurationDeltaDigest: "5414172a7b17d44accde919c2ec8208e206c40f9e14aec22a479b347983e7666",
    setupTranscriptDigest: "b885f5eff422fb7215619996de80c4896c6e3be58ebead2950a630c7098ebb6e",
    fieldIds: ["supplier", "purchaseOrder", "receipt", "invoice", "matchStatus", "tolerancePolicy", "approvalTrail", "separationOfDuties", "evidenceReferences"],
    actionIds: ["VIEW_EVIDENCE", "IDENTIFY_AUTHORITATIVE_REFERENCE", "ESCALATE_SEPARATION_REVIEW"],
  },
};

function sourceBindingForScenario(scenario: IncomingInvoiceScenarioV1): SourceBindingV1 | undefined {
  return SOURCE_BINDINGS[scenario];
}

type DisplayKindV1 = typeof DISPLAY_KINDS[number];
type ComponentStateV1 = typeof COMPONENT_STATES[number];
type ComponentValueV1 = string | readonly string[] | null;

export type ErvUiComponentV1 = Readonly<{
  componentId: string;
  ordinal: number;
  fieldId: string;
  displayKind: DisplayKindV1;
  state: ComponentStateV1;
  value: ComponentValueV1;
  label: string;
  helpText: string;
  accessibilityText: string;
  evidenceRefs: readonly string[];
  reasonCodes: readonly string[];
}>;

export type ErvUiSectionV1 = Readonly<{
  sectionId: string;
  ordinal: number;
  label: string;
  components: readonly ErvUiComponentV1[];
}>;

export type ErvUiScreenV1 = Readonly<{
  screenId: string;
  ordinal: number;
  label: string;
  sections: readonly ErvUiSectionV1[];
}>;

export type ErvUiActionV1 = Readonly<{
  actionId: string;
  ordinal: number;
  visible: true;
  enabled: boolean;
  disabledReasons: readonly string[];
  requiredEvidence: readonly string[];
  effectiveAuthority: "NONE";
  confirmationIntent: "EXPLICIT_OPERATOR_CONFIRMATION";
  readbackIntent: "LOCAL_READBACK_ONLY";
  label: string;
  helpText: string;
  accessibilityText: string;
}>;

export type ErvUiBindingsV1 = Readonly<{
  requirementDigest: string;
  configurationDigest: string;
  scenarioDigest: string;
  coreDigest: string;
  casePackSha256: string;
  casePackSchemaVersion: typeof INCOMING_INVOICE_ERV_CASE_PACK_V1;
  coreSchemaVersion: typeof INCOMING_INVOICE_ERV_CORE_V1;
  adaptiveUiSchemaVersion: typeof INCOMING_INVOICE_ADAPTIVE_UI_SCHEMA_V1;
  adaptiveUiManifestDigest: string;
  configurationDeltaDigest: string | null;
  setupTranscriptDigest: string | null;
}>;

export type ErvUiPackageV1 = Readonly<{
  schemaVersion: typeof ERV_UI_PACKAGE_SCHEMA_V1;
  packageVersion: typeof ERV_UI_PACKAGE_VERSION_V1;
  scenario: IncomingInvoiceScenarioV1;
  screens: readonly ErvUiScreenV1[];
  actions: readonly ErvUiActionV1[];
  componentIds: readonly string[];
  bindings: ErvUiBindingsV1;
  nonclaims: readonly string[];
  packageDigest: string;
}>;

export type ErvUiPackageBuildInputV1 = Readonly<{
  scenarioInput: IncomingInvoiceScenarioInputV1;
  requirement: IncomingInvoiceErvRequirementV1;
  adaptiveUiManifest: IncomingInvoiceUiManifestV1;
  corePackage: ErvCorePackageV1;
  configurationDelta?: IncomingInvoiceConfigurationDeltaV1;
  setupTranscript?: IncomingInvoiceSetupTranscriptV1;
}>;

export type ErvUiPackageResultV1 = Readonly<{
  outcome: "PUBLISHED";
  package: ErvUiPackageV1;
}> | Readonly<{
  outcome: "DENIED";
  reasonCode:
    | "INPUT_SHAPE_DENIED"
    | "SOURCE_BINDING_DENIED"
    | "PACKAGE_INTEGRITY_DENIED"
    | "UNSUPPORTED_DISPLAY_KIND_DENIED"
    | "UNKNOWN_COMPONENT_DENIED"
    | "HIDDEN_ACTION_DENIED"
    | "MISSING_EVIDENCE_DENIED"
    | "CROSS_CONTEXT_DENIED"
    | "ORDER_DENIED";
}>;

export type ErvUiRenderedReadbackV1 = Readonly<{
  schemaVersion: typeof ERV_UI_PACKAGE_SCHEMA_V1;
  packageDigest: string;
  snapshot: string;
  accessibility: Readonly<{
    landmarks: readonly string[];
    labelledControls: readonly string[];
  }>;
  authority: "NONE";
  nonclaims: readonly string[];
}>;

export type ErvUiRenderResultV1 = Readonly<{
  outcome: "RENDERED";
  readback: ErvUiRenderedReadbackV1;
}> | Readonly<{
  outcome: "DENIED";
  reasonCode: "PACKAGE_INTEGRITY_DENIED" | "UNSUPPORTED_DISPLAY_KIND_DENIED" | "UNKNOWN_COMPONENT_DENIED" | "HIDDEN_ACTION_DENIED" | "MISSING_EVIDENCE_DENIED" | "CROSS_CONTEXT_DENIED" | "ORDER_DENIED";
}>;

function deepFreeze<T>(value: T): T {
  if (value !== null && typeof value === "object" && !Object.isFrozen(value)) {
    for (const child of Object.values(value as Record<string, unknown>)) deepFreeze(child);
    Object.freeze(value);
  }
  return value;
}

function digest(value: unknown): string {
  return createHash("sha256").update(canonicalJson(value)).digest("hex");
}

function withoutDigest<T extends Record<string, unknown>>(value: T, key: string): Record<string, unknown> {
  const copy = { ...value };
  delete copy[key];
  return copy;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value) && Object.getPrototypeOf(value) === Object.prototype;
}

function exactKeys(value: unknown, keys: readonly string[]): value is Record<string, unknown> {
  if (!isRecord(value)) return false;
  const actual = Object.keys(value).sort();
  const expected = [...keys].sort();
  return actual.length === expected.length && actual.every((key, index) => key === expected[index]);
}

function sha256(value: unknown): boolean {
  return typeof value === "string" && /^[a-f0-9]{64}$/.test(value);
}

function configurationDigest(requirement: IncomingInvoiceErvRequirementV1): string {
  return digest({
    scenario: requirement.scenario,
    matchingMode: requirement.matchingMode,
    tolerancePolicy: requirement.tolerancePolicy,
    separateApprovalThresholdEur: requirement.separateApprovalThresholdEur,
    requestedEffects: requirement.requestedEffects,
  });
}

function scenarioDigest(resolution: IncomingInvoiceScenarioResolutionV1): string {
  return digest(resolution);
}

function validManifest(manifest: IncomingInvoiceUiManifestV1): boolean {
  const expected = sourceBindingForScenario(manifest.scenario);
  return isRecord(manifest)
    && exactKeys(manifest, ["schemaVersion", "manifestVersion", "scenario", "evidenceState", "fields", "actions", "reusedCapabilityIds", "applicationGuideVersion", "authority", "manifestDigest"])
    && expected !== undefined
    && manifest.schemaVersion === INCOMING_INVOICE_ADAPTIVE_UI_SCHEMA_V1
    && manifest.manifestVersion === "1.0.0"
    && manifest.applicationGuideVersion === "1.0.0"
    && isRecord(manifest.authority)
    && exactKeys(manifest.authority, ["mode", "bookingAuthorityGranted", "externalCallsAuthorized"])
    && manifest.authority.mode === "LOCAL_SYNTHETIC_PROOF"
    && manifest.authority.bookingAuthorityGranted === false
    && manifest.authority.externalCallsAuthorized === false
    && Array.isArray(manifest.reusedCapabilityIds)
    && manifest.reusedCapabilityIds.length === CAPABILITY_IDS.length
    && manifest.reusedCapabilityIds.every((id, index) => id === CAPABILITY_IDS[index])
    && Array.isArray(manifest.fields)
    && manifest.fields.length === expected.fieldIds.length
    && manifest.fields.every((field, index) => isRecord(field)
      && exactKeys(field, ["fieldId", "label", "state", "evidenceRefs"])
      && field.fieldId === expected.fieldIds[index]
      && typeof field.label === "string" && field.label.length > 0
      && field.state === "VISIBLE"
      && Array.isArray(field.evidenceRefs)
      && field.evidenceRefs.length > 0
      && field.evidenceRefs.every((ref) => typeof ref === "string" && ref.length > 0))
    && Array.isArray(manifest.actions)
    && manifest.actions.length === expected.actionIds.length
    && manifest.actions.every((action, index) => isRecord(action)
      && exactKeys(action, ["actionId", "enabled", "reason", "evidenceRefs"])
      && action.actionId === expected.actionIds[index]
      && typeof action.enabled === "boolean"
      && typeof action.reason === "string" && action.reason.length > 0
      && Array.isArray(action.evidenceRefs)
      && action.evidenceRefs.length > 0
      && action.evidenceRefs.every((ref) => typeof ref === "string" && ref.length > 0))
    && digest(withoutDigest(manifest as unknown as Record<string, unknown>, "manifestDigest")) === manifest.manifestDigest;
}

function validCore(value: unknown): value is ErvCorePackageV1 {
  if (!isRecord(value)
    || !exactKeys(value, ["schemaVersion", "packId", "caseCount", "decisions", "authority", "nonclaims", "readback"])
    || typeof value.packId !== "string" || value.packId.length === 0
    || typeof value.caseCount !== "number" || !Number.isSafeInteger(value.caseCount) || value.caseCount < 1
    || !Array.isArray(value.decisions)
    || !Array.isArray(value.nonclaims) || !value.nonclaims.every((claim) => typeof claim === "string" && claim.length > 0)) return false;
  const authority = value.authority;
  const readback = value.readback;
  if (!isRecord(authority) || !exactKeys(authority, ["mode", "customerDataAuthorized", "externalProviderCalls", "productivePostingAuthorized", "bookingAuthorityGranted", "riskDCapability"])
    || !isRecord(readback) || !exactKeys(readback, ["packSha256", "decisionDigest", "deterministicReplay"])) return false;
  try {
    return value.schemaVersion === INCOMING_INVOICE_ERV_CORE_V1
      && authority.mode === "LOCAL_SYNTHETIC_PROOF"
      && authority.customerDataAuthorized === false
      && authority.externalProviderCalls === false
      && authority.productivePostingAuthorized === false
      && authority.bookingAuthorityGranted === false
      && authority.riskDCapability === "SEPARATELY_AUTHORIZED"
      && typeof readback.packSha256 === "string"
      && readback.packSha256 === "899d8dfc44be526011c35ad5aba4c2cb89bca433f1520e61fe05268d4816ad20"
      && sha256(readback.decisionDigest)
      && readback.deterministicReplay === true
      && digest(value.decisions) === readback.decisionDigest;
  } catch {
    return false;
  }
}

function validDelta(delta: IncomingInvoiceConfigurationDeltaV1, requirementDigest: string, configuration: string): boolean {
  return isRecord(delta)
    && exactKeys(delta, ["schemaVersion", "deltaVersion", "beforeRequirementDigest", "afterRequirementDigest", "beforeConfigurationDigest", "afterConfigurationDigest", "reusedCapabilityIds", "changedSettings", "evidenceReferences", "unresolvedGaps", "authorityGranted", "inventedExecutableFunctions", "configurationDeltaDigest"])
    && delta.schemaVersion === "chimpmaera.incoming-invoice/configuration-delta/v1"
    && delta.deltaVersion === "1.0.0"
    && delta.afterRequirementDigest === requirementDigest
    && delta.afterConfigurationDigest === configuration
    && delta.authorityGranted === false
    && Array.isArray(delta.inventedExecutableFunctions)
    && delta.inventedExecutableFunctions.length === 0
    && digest(withoutDigest(delta as unknown as Record<string, unknown>, "configurationDeltaDigest")) === delta.configurationDeltaDigest;
}

function validTranscript(transcript: IncomingInvoiceSetupTranscriptV1): boolean {
  return isRecord(transcript)
    && exactKeys(transcript, ["schemaVersion", "transcriptVersion", "syntheticEvidence", "turns", "transcriptDigest"])
    && transcript.schemaVersion === "chimpmaera.incoming-invoice/setup-dialogue/v1"
    && transcript.transcriptVersion === "1.0.0"
    && transcript.syntheticEvidence === true
    && Array.isArray(transcript.turns)
    && digest(withoutDigest(transcript as unknown as Record<string, unknown>, "transcriptDigest")) === transcript.transcriptDigest;
}

function sourceChainMatches(
  input: ErvUiPackageBuildInputV1,
  resolution: IncomingInvoiceScenarioResolutionV1,
): boolean {
  if (resolution.outcome !== "ACCEPTED") return false;
  const expected = sourceBindingForScenario(resolution.scenario);
  if (expected === undefined) return false;
  const delta = isRecord(input.configurationDelta) ? input.configurationDelta.configurationDeltaDigest : null;
  const transcript = isRecord(input.setupTranscript) ? input.setupTranscript.transcriptDigest : null;
  return digest(input.requirement) === expected.requirementDigest
    && configurationDigest(input.requirement) === expected.configurationDigest
    && scenarioDigest(resolution) === expected.scenarioDigest
    && digest(input.corePackage) === expected.coreDigest
    && input.adaptiveUiManifest.manifestDigest === expected.adaptiveUiManifestDigest
    && delta === expected.configurationDeltaDigest
    && transcript === expected.setupTranscriptDigest;
}

type ErvUiPackageDenialReasonV1 = Extract<ErvUiPackageResultV1, { outcome: "DENIED" }>["reasonCode"];
type ErvUiRenderDenialReasonV1 = Extract<ErvUiRenderResultV1, { outcome: "DENIED" }>["reasonCode"];

function deny(reasonCode: ErvUiPackageDenialReasonV1): ErvUiPackageResultV1 {
  return deepFreeze({ outcome: "DENIED" as const, reasonCode });
}

function componentFromField(field: IncomingInvoiceUiManifestV1["fields"][number], evidenceState: IncomingInvoiceUiManifestV1["evidenceState"], ordinal: number): ErvUiComponentV1 {
  const state: ComponentStateV1 = evidenceState === "CONFLICT" ? "CONFLICT" : evidenceState === "DENIED" ? "UNSUPPORTED" : evidenceState === "EXCEPTION" ? "UNKNOWN" : "VALUE";
  return {
    componentId: `component:${field.fieldId}`,
    ordinal,
    fieldId: field.fieldId,
    displayKind: "TEXT",
    state,
    value: state === "VALUE" ? field.label : null,
    label: field.label,
    helpText: `Read-only ${field.label} from bound evidence.`,
    accessibilityText: `${field.label}; evidence-backed ${state.toLowerCase()} value`,
    evidenceRefs: [...field.evidenceRefs],
    reasonCodes: [state === "VALUE" ? "FIELD_DERIVED_FROM_AP05_MANIFEST" : `EVIDENCE_STATE_${state}`],
  };
}

export function buildErvUiPackageV1(input: ErvUiPackageBuildInputV1): ErvUiPackageResultV1 {
  try {
    if (!isRecord(input) || !isRecord(input.requirement) || !isRecord(input.adaptiveUiManifest) || !isRecord(input.corePackage)) return deny("INPUT_SHAPE_DENIED");
  const resolution = resolveIncomingInvoiceScenarioV1(input.scenarioInput);
  if (resolution.outcome !== "ACCEPTED" || input.requirement.scenario !== resolution.scenario || input.adaptiveUiManifest.scenario !== resolution.scenario) return deny("SOURCE_BINDING_DENIED");
  const requirementDigest = digest(input.requirement);
  const configuration = configurationDigest(input.requirement);
  if (!validManifest(input.adaptiveUiManifest)
    || !validCore(input.corePackage)
    || !sourceChainMatches(input, resolution)) return deny("SOURCE_BINDING_DENIED");
  if (input.adaptiveUiManifest.reusedCapabilityIds.join("|") !== CAPABILITY_IDS.join("|")) return deny("SOURCE_BINDING_DENIED");
  if (input.configurationDelta !== undefined && !validDelta(input.configurationDelta, requirementDigest, configuration)) return deny("SOURCE_BINDING_DENIED");
  if (input.setupTranscript !== undefined && !validTranscript(input.setupTranscript)) return deny("SOURCE_BINDING_DENIED");
  if ((input.configurationDelta === undefined) !== (input.setupTranscript === undefined)) return deny("SOURCE_BINDING_DENIED");

  const evidenceRefs = input.adaptiveUiManifest.fields.flatMap(({ evidenceRefs }) => evidenceRefs);
  const uniqueEvidenceRefs = [...new Set(evidenceRefs)];
  const components = input.adaptiveUiManifest.fields.map((field, index) => componentFromField(field, input.adaptiveUiManifest.evidenceState, index + 1));
  const actions: ErvUiActionV1[] = input.adaptiveUiManifest.actions.map((action, index) => ({
    actionId: action.actionId,
    ordinal: index + 1,
    visible: true,
    enabled: action.enabled,
    disabledReasons: action.enabled ? [] : [action.reason],
    requiredEvidence: [...action.evidenceRefs],
    effectiveAuthority: "NONE",
    confirmationIntent: "EXPLICIT_OPERATOR_CONFIRMATION",
    readbackIntent: "LOCAL_READBACK_ONLY",
    label: action.actionId,
    helpText: action.reason,
    accessibilityText: `${action.actionId}; ${action.enabled ? "enabled" : "disabled"}; no execution authority`,
  }));
  if (uniqueEvidenceRefs.length === 0 || components.some(({ evidenceRefs: refs }) => refs.length === 0) || actions.some(({ requiredEvidence }) => requiredEvidence.some((ref) => !uniqueEvidenceRefs.includes(ref)))) return deny("MISSING_EVIDENCE_DENIED");
  const summary: ErvUiSectionV1 = { sectionId: "section:summary", ordinal: 1, label: "Summary", components };
  const actionComponents: ErvUiComponentV1[] = actions.map((action, index) => ({
    componentId: `component:action:${action.actionId}`,
    ordinal: index + 1,
    fieldId: `action:${action.actionId}`,
    displayKind: "ACTION",
    state: action.enabled ? "VALUE" : "UNKNOWN",
    value: action.label,
    label: action.label,
    helpText: action.helpText,
    accessibilityText: action.accessibilityText,
    evidenceRefs: [...action.requiredEvidence],
    reasonCodes: action.enabled ? ["ACTION_EXPOSED_READ_ONLY"] : ["ACTION_DISABLED_REASON_EXPLICIT"],
  }));
  const actionSection: ErvUiSectionV1 = { sectionId: "section:actions", ordinal: 2, label: "Actions", components: actionComponents };
  const unsigned = {
    schemaVersion: ERV_UI_PACKAGE_SCHEMA_V1,
    packageVersion: ERV_UI_PACKAGE_VERSION_V1,
    scenario: resolution.scenario,
    screens: [{ screenId: "screen:erv-overview", ordinal: 1, label: "Evidence review", sections: [summary, actionSection] }],
    actions,
    componentIds: [...components, ...actionComponents].map(({ componentId }) => componentId),
    bindings: {
      requirementDigest,
      configurationDigest: configuration,
      scenarioDigest: scenarioDigest(resolution),
      coreDigest: digest(input.corePackage),
      casePackSha256: AP04_ERV_CASE_PACK_SHA256_V1,
      casePackSchemaVersion: INCOMING_INVOICE_ERV_CASE_PACK_V1,
      coreSchemaVersion: INCOMING_INVOICE_ERV_CORE_V1,
      adaptiveUiSchemaVersion: INCOMING_INVOICE_ADAPTIVE_UI_SCHEMA_V1,
      adaptiveUiManifestDigest: input.adaptiveUiManifest.manifestDigest,
      configurationDeltaDigest: input.configurationDelta?.configurationDeltaDigest ?? null,
      setupTranscriptDigest: input.setupTranscript?.transcriptDigest ?? null,
    },
    nonclaims: [...NONCLAIMS],
  };
  return deepFreeze({ outcome: "PUBLISHED" as const, package: { ...unsigned, packageDigest: digest(unsigned) } });
  } catch {
    return deny("INPUT_SHAPE_DENIED");
  }
}

function validComponent(value: unknown, evidenceRefs: readonly string[], ordinal: number): value is ErvUiComponentV1 {
  return isRecord(value)
    && exactKeys(value, ["componentId", "ordinal", "fieldId", "displayKind", "state", "value", "label", "helpText", "accessibilityText", "evidenceRefs", "reasonCodes"])
    && typeof value.componentId === "string" && value.componentId.length > 0
    && value.ordinal === ordinal
    && typeof value.fieldId === "string" && value.fieldId.length > 0
    && DISPLAY_KINDS.includes(value.displayKind as DisplayKindV1)
    && COMPONENT_STATES.includes(value.state as ComponentStateV1)
    && (value.value === null || typeof value.value === "string" || (Array.isArray(value.value) && value.value.every((entry) => typeof entry === "string")))
    && typeof value.label === "string" && value.label.length > 0
    && typeof value.helpText === "string" && value.helpText.length > 0
    && typeof value.accessibilityText === "string" && value.accessibilityText.length > 0
    && Array.isArray(value.evidenceRefs) && value.evidenceRefs.length > 0 && value.evidenceRefs.every((ref) => typeof ref === "string" && evidenceRefs.includes(ref))
    && Array.isArray(value.reasonCodes) && value.reasonCodes.length > 0 && value.reasonCodes.every((reason) => typeof reason === "string");
}

function validAction(value: unknown, evidenceRefs: readonly string[], ordinal: number): value is ErvUiActionV1 {
  return isRecord(value)
    && exactKeys(value, ["actionId", "ordinal", "visible", "enabled", "disabledReasons", "requiredEvidence", "effectiveAuthority", "confirmationIntent", "readbackIntent", "label", "helpText", "accessibilityText"])
    && typeof value.actionId === "string" && value.actionId.length > 0
    && value.ordinal === ordinal && value.visible === true && typeof value.enabled === "boolean"
    && Array.isArray(value.disabledReasons) && value.disabledReasons.every((reason) => typeof reason === "string")
    && (value.enabled ? value.disabledReasons.length === 0 : value.disabledReasons.length > 0)
    && Array.isArray(value.requiredEvidence) && value.requiredEvidence.length > 0 && value.requiredEvidence.every((ref) => typeof ref === "string" && evidenceRefs.includes(ref))
    && value.effectiveAuthority === "NONE"
    && value.confirmationIntent === "EXPLICIT_OPERATOR_CONFIRMATION"
    && value.readbackIntent === "LOCAL_READBACK_ONLY"
    && typeof value.label === "string" && value.label.length > 0
    && typeof value.helpText === "string" && value.helpText.length > 0
    && typeof value.accessibilityText === "string" && value.accessibilityText.length > 0;
}

function validBindings(value: unknown): value is ErvUiBindingsV1 {
  if (!isRecord(value)
    || !exactKeys(value, ["requirementDigest", "configurationDigest", "scenarioDigest", "coreDigest", "casePackSha256", "casePackSchemaVersion", "coreSchemaVersion", "adaptiveUiSchemaVersion", "adaptiveUiManifestDigest", "configurationDeltaDigest", "setupTranscriptDigest"])) return false;
  return ["requirementDigest", "configurationDigest", "scenarioDigest", "coreDigest", "casePackSha256", "adaptiveUiManifestDigest"].every((key) => sha256(value[key]))
    && ["casePackSchemaVersion", "coreSchemaVersion", "adaptiveUiSchemaVersion"].every((key) => typeof value[key] === "string" && (value[key] as string).length > 0)
    && (value.configurationDeltaDigest === null || sha256(value.configurationDeltaDigest))
    && (value.setupTranscriptDigest === null || sha256(value.setupTranscriptDigest));
}

function validateForRender(value: unknown): ErvUiRenderDenialReasonV1 | null {
  if (!isRecord(value) || !exactKeys(value, ["schemaVersion", "packageVersion", "scenario", "screens", "actions", "componentIds", "bindings", "nonclaims", "packageDigest"])) return "PACKAGE_INTEGRITY_DENIED";
  if (value.schemaVersion !== ERV_UI_PACKAGE_SCHEMA_V1
    || value.packageVersion !== ERV_UI_PACKAGE_VERSION_V1
    || typeof value.scenario !== "string" || value.scenario.length === 0
    || !Array.isArray(value.screens) || value.screens.length === 0
    || !Array.isArray(value.actions) || value.actions.length === 0
    || !Array.isArray(value.componentIds) || value.componentIds.length === 0
    || !Array.isArray(value.nonclaims) || value.nonclaims.length === 0
    || !sha256(value.packageDigest)
    || !validBindings(value.bindings)
    || !value.nonclaims.every((claim) => typeof claim === "string" && claim.length > 0)) return "PACKAGE_INTEGRITY_DENIED";

  const evidenceRefs: string[] = [];
  const componentIds: string[] = [];
  for (const [screenIndex, screen] of value.screens.entries()) {
    if (!isRecord(screen) || !exactKeys(screen, ["screenId", "ordinal", "label", "sections"])
      || screen.ordinal !== screenIndex + 1 || typeof screen.screenId !== "string" || screen.screenId.length === 0
      || typeof screen.label !== "string" || screen.label.length === 0 || !Array.isArray(screen.sections) || screen.sections.length === 0) return "ORDER_DENIED";
    for (const [sectionIndex, section] of screen.sections.entries()) {
      if (!isRecord(section) || !exactKeys(section, ["sectionId", "ordinal", "label", "components"])
        || section.ordinal !== sectionIndex + 1 || typeof section.sectionId !== "string" || section.sectionId.length === 0
        || typeof section.label !== "string" || section.label.length === 0 || !Array.isArray(section.components) || section.components.length === 0) return "ORDER_DENIED";
      for (const component of section.components) {
        if (!isRecord(component)) return "PACKAGE_INTEGRITY_DENIED";
        if (!Array.isArray(component.evidenceRefs)) return "MISSING_EVIDENCE_DENIED";
        evidenceRefs.push(...component.evidenceRefs.filter((ref): ref is string => typeof ref === "string"));
      }
    }
  }
  if (new Set(evidenceRefs).size === 0) return "MISSING_EVIDENCE_DENIED";
  for (const screen of value.screens) {
    if (!isRecord(screen) || !Array.isArray(screen.sections)) return "ORDER_DENIED";
    for (const section of screen.sections) {
      if (!isRecord(section) || !Array.isArray(section.components)) return "ORDER_DENIED";
      for (const [componentIndex, component] of section.components.entries()) {
        if (!validComponent(component, evidenceRefs, componentIndex + 1)) {
          return DISPLAY_KINDS.includes(component.displayKind as DisplayKindV1) ? "PACKAGE_INTEGRITY_DENIED" : "UNSUPPORTED_DISPLAY_KIND_DENIED";
        }
        componentIds.push(component.componentId);
      }
    }
  }
  const actionEvidence = value.actions.flatMap((action) => isRecord(action) && Array.isArray(action.requiredEvidence) ? action.requiredEvidence : []);
  if (actionEvidence.some((ref) => typeof ref !== "string" || !evidenceRefs.includes(ref))) return "CROSS_CONTEXT_DENIED";
  for (const [index, action] of value.actions.entries()) {
    if (!validAction(action, evidenceRefs, index + 1)) return isRecord(action) && action.visible === false ? "HIDDEN_ACTION_DENIED" : "PACKAGE_INTEGRITY_DENIED";
  }
  if (value.componentIds.some((id) => typeof id !== "string" || id.length === 0)
    || new Set(componentIds).size !== componentIds.length
    || JSON.stringify(value.componentIds) !== JSON.stringify(componentIds)) return "UNKNOWN_COMPONENT_DENIED";
  try {
    if (digest(withoutDigest(value, "packageDigest")) !== value.packageDigest) return "PACKAGE_INTEGRITY_DENIED";
  } catch {
    return "PACKAGE_INTEGRITY_DENIED";
  }
  return null;
}

export function renderErvUiPackageV1(value: unknown): ErvUiRenderResultV1 {
  try {
    const reason = validateForRender(value);
  if (reason !== null) return deepFreeze({ outcome: "DENIED" as const, reasonCode: reason });
  const pkg = value as ErvUiPackageV1;
  const snapshot = ["main", ...pkg.screens.flatMap((screen) => [screen.screenId, ...screen.sections.flatMap((section) => [section.sectionId, ...section.components.map(({ componentId }) => componentId)])])].join(">");
  const readback = {
    schemaVersion: ERV_UI_PACKAGE_SCHEMA_V1,
    packageDigest: pkg.packageDigest,
    snapshot,
    accessibility: { landmarks: ["main", ...pkg.screens.map(({ screenId }) => screenId)], labelledControls: pkg.actions.map(({ actionId }) => actionId) },
    authority: "NONE" as const,
    nonclaims: [...pkg.nonclaims],
  };
  return deepFreeze({ outcome: "RENDERED" as const, readback });
  } catch {
    return deepFreeze({ outcome: "DENIED" as const, reasonCode: "PACKAGE_INTEGRITY_DENIED" });
  }
}
