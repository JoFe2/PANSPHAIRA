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
const SCENARIOS = ["LEAN", "CONTROLLED", "SEGREGATED_ENTERPRISE"] as const;
const NONCLAIMS = [
  "NO_PRODUCTION_FRONTEND",
  "NO_CUSTOMER_DATA",
  "NO_LIVE_ERP_INTEGRATION",
  "NO_FINANCIAL_OPINION",
  "NO_EXTERNAL_EXECUTION_AUTHORITY",
] as const;
const CAPABILITY_IDS = [INCOMING_INVOICE_ERV_CORE_V1, INCOMING_INVOICE_ERV_CASE_PACK_V1] as const;

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
  return manifest.schemaVersion === INCOMING_INVOICE_ADAPTIVE_UI_SCHEMA_V1
    && manifest.manifestVersion === "1.0.0"
    && manifest.applicationGuideVersion === "1.0.0"
    && manifest.authority.mode === "LOCAL_SYNTHETIC_PROOF"
    && manifest.authority.bookingAuthorityGranted === false
    && manifest.authority.externalCallsAuthorized === false
    && manifest.reusedCapabilityIds.length === CAPABILITY_IDS.length
    && manifest.reusedCapabilityIds.every((id, index) => id === CAPABILITY_IDS[index])
    && digest(withoutDigest(manifest as unknown as Record<string, unknown>, "manifestDigest")) === manifest.manifestDigest
    && manifest.fields.length > 0
    && manifest.actions.length > 0;
}

function validCore(core: ErvCorePackageV1): boolean {
  return core.schemaVersion === INCOMING_INVOICE_ERV_CORE_V1
    && core.authority.mode === "LOCAL_SYNTHETIC_PROOF"
    && core.authority.customerDataAuthorized === false
    && core.authority.externalProviderCalls === false
    && core.authority.productivePostingAuthorized === false
    && core.authority.bookingAuthorityGranted === false
    && core.readback.packSha256 === "899d8dfc44be526011c35ad5aba4c2cb89bca433f1520e61fe05268d4816ad20"
    && core.readback.deterministicReplay === true
    && digest(core.decisions) === core.readback.decisionDigest;
}

function validDelta(delta: IncomingInvoiceConfigurationDeltaV1, requirementDigest: string, configuration: string): boolean {
  return delta.schemaVersion === "chimpmaera.incoming-invoice/configuration-delta/v1"
    && delta.deltaVersion === "1.0.0"
    && delta.afterRequirementDigest === requirementDigest
    && delta.afterConfigurationDigest === configuration
    && delta.authorityGranted === false
    && delta.inventedExecutableFunctions.length === 0
    && digest(withoutDigest(delta as unknown as Record<string, unknown>, "configurationDeltaDigest")) === delta.configurationDeltaDigest;
}

function validTranscript(transcript: IncomingInvoiceSetupTranscriptV1): boolean {
  return transcript.schemaVersion === "chimpmaera.incoming-invoice/setup-dialogue/v1"
    && transcript.transcriptVersion === "1.0.0"
    && transcript.syntheticEvidence === true
    && digest(withoutDigest(transcript as unknown as Record<string, unknown>, "transcriptDigest")) === transcript.transcriptDigest;
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
  if (!isRecord(input) || !isRecord(input.requirement) || !isRecord(input.adaptiveUiManifest) || !isRecord(input.corePackage)) return deny("INPUT_SHAPE_DENIED");
  const resolution = resolveIncomingInvoiceScenarioV1(input.scenarioInput);
  if (resolution.outcome !== "ACCEPTED" || input.requirement.scenario !== resolution.scenario || input.adaptiveUiManifest.scenario !== resolution.scenario) return deny("SOURCE_BINDING_DENIED");
  const requirementDigest = digest(input.requirement);
  const configuration = configurationDigest(input.requirement);
  if (!validManifest(input.adaptiveUiManifest) || !validCore(input.corePackage)) return deny("SOURCE_BINDING_DENIED");
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
}

function validComponent(value: unknown, evidenceRefs: readonly string[], ordinal: number): value is ErvUiComponentV1 {
  return isRecord(value)
    && exactKeys(value, ["componentId", "ordinal", "fieldId", "displayKind", "state", "value", "label", "helpText", "accessibilityText", "evidenceRefs", "reasonCodes"])
    && value.componentId === `component:${String(value.fieldId)}`
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

function validateForRender(value: unknown): ErvUiRenderDenialReasonV1 | null {
  if (!isRecord(value) || !exactKeys(value, ["schemaVersion", "packageVersion", "scenario", "screens", "actions", "componentIds", "bindings", "nonclaims", "packageDigest"])) return "PACKAGE_INTEGRITY_DENIED";
  if (value.schemaVersion !== ERV_UI_PACKAGE_SCHEMA_V1 || value.packageVersion !== ERV_UI_PACKAGE_VERSION_V1 || !SCENARIOS.includes(value.scenario as IncomingInvoiceScenarioV1) || !Array.isArray(value.screens) || value.screens.length !== 1 || !Array.isArray(value.actions) || value.actions.length === 0 || !Array.isArray(value.componentIds) || !Array.isArray(value.nonclaims) || !sha256(value.packageDigest)) return "PACKAGE_INTEGRITY_DENIED";
  const bindings = value.bindings;
  if (!isRecord(bindings) || !exactKeys(bindings, ["requirementDigest", "configurationDigest", "scenarioDigest", "coreDigest", "casePackSha256", "casePackSchemaVersion", "coreSchemaVersion", "adaptiveUiSchemaVersion", "adaptiveUiManifestDigest", "configurationDeltaDigest", "setupTranscriptDigest"]) || ["requirementDigest", "configurationDigest", "scenarioDigest", "coreDigest", "casePackSha256", "adaptiveUiManifestDigest"].some((key) => !sha256(bindings[key]))) return "PACKAGE_INTEGRITY_DENIED";
  if (bindings.casePackSha256 !== AP04_ERV_CASE_PACK_SHA256_V1 || bindings.casePackSchemaVersion !== INCOMING_INVOICE_ERV_CASE_PACK_V1 || bindings.coreSchemaVersion !== INCOMING_INVOICE_ERV_CORE_V1 || bindings.adaptiveUiSchemaVersion !== INCOMING_INVOICE_ADAPTIVE_UI_SCHEMA_V1) return "CROSS_CONTEXT_DENIED";
  if (value.nonclaims.length !== NONCLAIMS.length || value.nonclaims.some((claim, index) => claim !== NONCLAIMS[index])) return "PACKAGE_INTEGRITY_DENIED";
  const evidenceRefs: string[] = [];
  const screen = value.screens[0];
  if (!isRecord(screen) || !exactKeys(screen, ["screenId", "ordinal", "label", "sections"]) || screen.ordinal !== 1 || typeof screen.screenId !== "string" || !Array.isArray(screen.sections) || screen.sections.length !== 2) return "ORDER_DENIED";
  for (let sectionIndex = 0; sectionIndex < screen.sections.length; sectionIndex += 1) {
    const section = screen.sections[sectionIndex];
    if (!isRecord(section) || !exactKeys(section, ["sectionId", "ordinal", "label", "components"]) || section.ordinal !== sectionIndex + 1 || typeof section.sectionId !== "string" || !Array.isArray(section.components) || section.components.length === 0) return "ORDER_DENIED";
    for (const component of section.components) {
      if (!isRecord(component) || !Array.isArray(component.evidenceRefs)) return "MISSING_EVIDENCE_DENIED";
      evidenceRefs.push(...component.evidenceRefs.filter((ref): ref is string => typeof ref === "string"));
    }
  }
  if (new Set(evidenceRefs).size === 0) return "MISSING_EVIDENCE_DENIED";
  for (const [sectionIndex, section] of screen.sections.entries()) {
    if (!isRecord(section) || !Array.isArray(section.components)) return "ORDER_DENIED";
    for (const [componentIndex, component] of section.components.entries()) {
      if (!validComponent(component, evidenceRefs, componentIndex + 1)) return DISPLAY_KINDS.includes((component as Record<string, unknown>).displayKind as DisplayKindV1) ? "PACKAGE_INTEGRITY_DENIED" : "UNSUPPORTED_DISPLAY_KIND_DENIED";
      if (sectionIndex === 1 && !String(component.fieldId).startsWith("action:")) return "UNKNOWN_COMPONENT_DENIED";
    }
  }
  const actionEvidence = value.actions.flatMap((action) => isRecord(action) && Array.isArray(action.requiredEvidence) ? action.requiredEvidence : []);
  if (actionEvidence.some((ref) => typeof ref !== "string" || !evidenceRefs.includes(ref))) return "CROSS_CONTEXT_DENIED";
  for (const [index, action] of value.actions.entries()) {
    if (!validAction(action, evidenceRefs, index + 1)) return isRecord(action) && action.visible === false ? "HIDDEN_ACTION_DENIED" : "PACKAGE_INTEGRITY_DENIED";
  }
  const ids = screen.sections.flatMap((section) => isRecord(section) && Array.isArray(section.components) ? section.components.map((component) => isRecord(component) ? component.componentId : undefined) : []);
  if (ids.some((id) => typeof id !== "string") || new Set(ids).size !== ids.length || JSON.stringify(value.componentIds) !== JSON.stringify(ids)) return "UNKNOWN_COMPONENT_DENIED";
  if (digest(withoutDigest(value, "packageDigest")) !== value.packageDigest) return "PACKAGE_INTEGRITY_DENIED";
  return null;
}

export function renderErvUiPackageV1(value: unknown): ErvUiRenderResultV1 {
  const reason = validateForRender(value);
  if (reason !== null) return deepFreeze({ outcome: "DENIED" as const, reasonCode: reason });
  const pkg = value as ErvUiPackageV1;
  const screen = pkg.screens[0]!;
  const snapshot = ["main", screen.screenId, ...screen.sections.flatMap((section) => [section.sectionId, ...section.components.map(({ componentId }) => componentId)])].join(">");
  const readback = {
    schemaVersion: ERV_UI_PACKAGE_SCHEMA_V1,
    packageDigest: pkg.packageDigest,
    snapshot,
    accessibility: { landmarks: ["main", screen.screenId], labelledControls: pkg.actions.map(({ actionId }) => actionId) },
    authority: "NONE" as const,
    nonclaims: [...NONCLAIMS],
  };
  return deepFreeze({ outcome: "RENDERED" as const, readback });
}
