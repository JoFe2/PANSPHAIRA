import { createHash } from "node:crypto";
import { canonicalJson } from "./canonical-json.js";
import type { IncomingInvoiceScenarioV1 } from "./incoming-invoice-blueprint.js";
import { INCOMING_INVOICE_ERV_CASE_PACK_V1, INCOMING_INVOICE_ERV_CORE_V1 } from "./incoming-invoice-erv.js";

export const INCOMING_INVOICE_ADAPTIVE_UI_SCHEMA_V1 = "chimpmaera.incoming-invoice/adaptive-ui/v1" as const;
export const INCOMING_INVOICE_APPLICATION_GUIDE_SCHEMA_V1 = "chimpmaera.incoming-invoice/application-guide/v1" as const;
export const INCOMING_INVOICE_SETUP_DIALOGUE_SCHEMA_V1 = "chimpmaera.incoming-invoice/setup-dialogue/v1" as const;
export const INCOMING_INVOICE_CONFIGURATION_DELTA_SCHEMA_V1 = "chimpmaera.incoming-invoice/configuration-delta/v1" as const;

const ALLOWED_EFFECTS = ["READ_SYNTHETIC", "WRITE_LOCAL_PROOF"] as const;
const MATCHING_MODES = ["TWO_WAY_INVOICE_PO_V1", "THREE_WAY_INVOICE_PO_RECEIPT_V1"] as const;
const TOLERANCE_POLICIES = ["STRICT_ZERO_V1", "ABS_MINOR_V1", "RATE_BPS_V1"] as const;
const REFERENCE_KINDS = ["SUPPLIER", "PURCHASE_ORDER", "RECEIPT", "INVOICE"] as const;
const CAPABILITY_IDS = [INCOMING_INVOICE_ERV_CORE_V1, INCOMING_INVOICE_ERV_CASE_PACK_V1] as const;

type MatchingModeIdV1 = typeof MATCHING_MODES[number];
type TolerancePolicyIdV1 = typeof TOLERANCE_POLICIES[number];
type EffectV1 = typeof ALLOWED_EFFECTS[number];
type ReferenceKindV1 = typeof REFERENCE_KINDS[number];
type RequirementVariantV1 = Readonly<{ variantId: string; version: string }>;

export interface IncomingInvoiceErvRequirementV1 {
  readonly schemaVersion: "chimpmaera.incoming-invoice/erv-requirement/v1";
  readonly requirementId: string;
  readonly matchingMode: RequirementVariantV1;
  readonly tolerancePolicy: RequirementVariantV1;
  readonly requestedEffects: readonly string[];
  readonly evidenceRefs: readonly string[];
  readonly synthetic: true;
  readonly customerData: false;
}

export interface IncomingInvoiceUiEvidenceReferenceV1 {
  readonly kind: ReferenceKindV1;
  readonly referenceId: string;
  readonly verified: boolean;
  readonly evidenceRef: string;
}

export interface IncomingInvoiceUiInputV1 {
  readonly schemaVersion: typeof INCOMING_INVOICE_ADAPTIVE_UI_SCHEMA_V1;
  readonly scenario: IncomingInvoiceScenarioV1;
  readonly evidence: Readonly<{
    readonly outcome: "MATCHED" | "CONFLICT" | "EXCEPTION" | "DENIED";
    readonly matchingMode: RequirementVariantV1;
    readonly tolerancePolicy: RequirementVariantV1;
    readonly references: readonly IncomingInvoiceUiEvidenceReferenceV1[];
  }>;
  readonly authority: Readonly<{
    readonly mode: "LOCAL_SYNTHETIC_PROOF";
    readonly customerDataAuthorized: false;
    readonly productiveBookingAuthorized: false;
    readonly externalCallsAuthorized: false;
  }>;
}

export type IncomingInvoiceUiFieldV1 = Readonly<{
  readonly fieldId: string;
  readonly label: string;
  readonly state: "VISIBLE";
  readonly evidenceRefs: readonly string[];
}>;
export type IncomingInvoiceUiActionV1 = Readonly<{
  readonly actionId: string;
  readonly enabled: boolean;
  readonly reason: string;
  readonly evidenceRefs: readonly string[];
}>;
export interface IncomingInvoiceUiManifestV1 {
  readonly schemaVersion: typeof INCOMING_INVOICE_ADAPTIVE_UI_SCHEMA_V1;
  readonly manifestVersion: "1.0.0";
  readonly scenario: IncomingInvoiceScenarioV1;
  readonly evidenceState: IncomingInvoiceUiInputV1["evidence"]["outcome"];
  readonly fields: readonly IncomingInvoiceUiFieldV1[];
  readonly actions: readonly IncomingInvoiceUiActionV1[];
  readonly reusedCapabilityIds: readonly string[];
  readonly applicationGuideVersion: "1.0.0";
  readonly authority: Readonly<{
    readonly mode: "LOCAL_SYNTHETIC_PROOF";
    readonly bookingAuthorityGranted: false;
    readonly externalCallsAuthorized: false;
  }>;
  readonly manifestDigest: string;
}
export type IncomingInvoiceUiManifestResultV1 = Readonly<{
  readonly outcome: "DERIVED";
  readonly manifest: IncomingInvoiceUiManifestV1;
}> | Readonly<{
  readonly outcome: "DENIED";
  readonly reasonCode: "HIDDEN_AUTHORITY_DENIED" | "UNSUPPORTED_ACTION_DENIED" | "CONTEXT_COLLAPSE_DENIED" | "INPUT_SHAPE_DENIED";
}>;

export interface IncomingInvoiceSetupAnswerV1 {
  readonly questionId: string;
  readonly answer: "CONFIRM" | "DECLINE";
}
export type IncomingInvoiceDialoguePayloadV1 = IncomingInvoiceErvRequirementV1
  | IncomingInvoiceSetupAnswerV1
  | Readonly<{ readonly questionId: string; readonly question: string }>
  | Readonly<{ readonly outcome: "RESOLVED"; readonly configurationDeltaDigest: string }>
  | Readonly<{ readonly outcome: "NEEDS_CLARIFICATION" | "DENIED_UNSUPPORTED"; readonly gaps: readonly string[] }>
  | Readonly<{ readonly invalid: true }>;
export interface IncomingInvoiceSetupInputV1 {
  readonly baseline: IncomingInvoiceErvRequirementV1;
  readonly changed: IncomingInvoiceErvRequirementV1;
  readonly answers: readonly IncomingInvoiceSetupAnswerV1[];
}
export interface IncomingInvoiceDialogueTurnV1 {
  readonly ordinal: number;
  readonly speaker: "SYSTEM" | "AGENT" | "OPERATOR";
  readonly kind: "BASELINE_REQUIREMENT" | "CHANGED_REQUIREMENT" | "CLARIFICATION" | "ANSWER" | "OUTCOME";
  readonly payload: IncomingInvoiceDialoguePayloadV1;
  readonly evidenceRefs: readonly string[];
}
export interface IncomingInvoiceSetupTranscriptV1 {
  readonly schemaVersion: typeof INCOMING_INVOICE_SETUP_DIALOGUE_SCHEMA_V1;
  readonly transcriptVersion: "1.0.0";
  readonly syntheticEvidence: true;
  readonly turns: readonly IncomingInvoiceDialogueTurnV1[];
  readonly transcriptDigest: string;
}
export interface IncomingInvoiceConfigurationDeltaV1 {
  readonly schemaVersion: typeof INCOMING_INVOICE_CONFIGURATION_DELTA_SCHEMA_V1;
  readonly deltaVersion: "1.0.0";
  readonly beforeRequirementDigest: string;
  readonly afterRequirementDigest: string;
  readonly beforeConfigurationDigest: string;
  readonly afterConfigurationDigest: string;
  readonly reusedCapabilityIds: readonly string[];
  readonly changedSettings: readonly Readonly<{ setting: "matchingMode" | "tolerancePolicy" | "requestedEffects"; before: string; after: string }>[];
  readonly evidenceReferences: readonly string[];
  readonly unresolvedGaps: readonly string[];
  readonly authorityGranted: false;
  readonly inventedExecutableFunctions: readonly [];
  readonly configurationDeltaDigest: string;
}
type SetupAgentResolvedV1 = Readonly<{
  readonly outcome: "RESOLVED";
  readonly transcript: IncomingInvoiceSetupTranscriptV1;
  readonly configurationDelta: IncomingInvoiceConfigurationDeltaV1;
}>;
type SetupAgentUnresolvedV1 = Readonly<{
  readonly outcome: "NEEDS_CLARIFICATION";
  readonly transcript: IncomingInvoiceSetupTranscriptV1;
  readonly unresolvedGaps: readonly string[];
}>;
type SetupAgentDeniedV1 = Readonly<{
  readonly outcome: "DENIED_UNSUPPORTED";
  readonly transcript: IncomingInvoiceSetupTranscriptV1;
  readonly unresolvedGaps: readonly string[];
}>;
export type IncomingInvoiceSetupAgentResultV1 = SetupAgentResolvedV1 | SetupAgentUnresolvedV1 | SetupAgentDeniedV1;

export interface IncomingInvoiceApplicationGuideV1 {
  readonly schemaVersion: typeof INCOMING_INVOICE_APPLICATION_GUIDE_SCHEMA_V1;
  readonly guideVersion: "1.0.0";
  readonly applicability: readonly string[];
  readonly variants: readonly Readonly<{
    readonly scenario: IncomingInvoiceScenarioV1;
    readonly selectionRule: string;
    readonly capabilityIds: readonly string[];
    readonly processVariant: string;
  }>[];
  readonly limits: readonly string[];
  readonly nonclaims: readonly string[];
}

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
function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value) && Object.getPrototypeOf(value) === Object.prototype;
}
function exactKeys(value: Record<string, unknown>, keys: readonly string[]): boolean {
  const expected = [...keys].sort();
  const actual = Object.keys(value).sort();
  return actual.length === expected.length && actual.every((key, index) => key === expected[index]);
}
function validVariant(value: unknown, allowed: readonly string[]): value is RequirementVariantV1 {
  return validVariantShape(value) && allowed.includes(value.variantId);
}
function validVariantShape(value: unknown): value is RequirementVariantV1 {
  return isRecord(value) && exactKeys(value, ["variantId", "version"])
    && typeof value.variantId === "string" && value.variantId.length > 0
    && value.version === "1.0.0";
}
function modeRequiredKinds(mode: string): readonly ReferenceKindV1[] {
  return mode === "TWO_WAY_INVOICE_PO_V1"
    ? ["SUPPLIER", "PURCHASE_ORDER", "INVOICE"]
    : ["SUPPLIER", "PURCHASE_ORDER", "RECEIPT", "INVOICE"];
}
function requirementValid(value: unknown): value is IncomingInvoiceErvRequirementV1 {
  if (!isRecord(value) || !exactKeys(value, ["schemaVersion", "requirementId", "matchingMode", "tolerancePolicy", "requestedEffects", "evidenceRefs", "synthetic", "customerData"])) return false;
  return value.schemaVersion === "chimpmaera.incoming-invoice/erv-requirement/v1"
    && typeof value.requirementId === "string" && value.requirementId.length > 0
    && validVariantShape(value.matchingMode)
    && validVariantShape(value.tolerancePolicy)
    && Array.isArray(value.requestedEffects) && value.requestedEffects.length > 0
    && value.requestedEffects.every((effect) => typeof effect === "string")
    && new Set(value.requestedEffects).size === value.requestedEffects.length
    && Array.isArray(value.evidenceRefs) && value.evidenceRefs.every((ref) => typeof ref === "string" && ref.length > 0)
    && value.synthetic === true && value.customerData === false;
}
function referenceValid(value: unknown): value is IncomingInvoiceUiEvidenceReferenceV1 {
  return isRecord(value) && exactKeys(value, ["kind", "referenceId", "verified", "evidenceRef"])
    && typeof value.kind === "string" && REFERENCE_KINDS.includes(value.kind as ReferenceKindV1)
    && typeof value.referenceId === "string" && value.referenceId.length > 0
    && typeof value.verified === "boolean" && typeof value.evidenceRef === "string" && value.evidenceRef.length > 0;
}
function uiInputValid(value: unknown): value is IncomingInvoiceUiInputV1 {
  if (!isRecord(value) || !exactKeys(value, ["schemaVersion", "scenario", "evidence", "authority"])) return false;
  if (value.schemaVersion !== INCOMING_INVOICE_ADAPTIVE_UI_SCHEMA_V1
    || !["LEAN", "CONTROLLED", "SEGREGATED_ENTERPRISE"].includes(value.scenario as string)
    || !isRecord(value.evidence) || !exactKeys(value.evidence, ["outcome", "matchingMode", "tolerancePolicy", "references"])
    || !["MATCHED", "CONFLICT", "EXCEPTION", "DENIED"].includes(value.evidence.outcome as string)
    || !validVariant(value.evidence.matchingMode, MATCHING_MODES)
    || !validVariant(value.evidence.tolerancePolicy, TOLERANCE_POLICIES)
    || !Array.isArray(value.evidence.references) || !value.evidence.references.every(referenceValid)) return false;
  return isRecord(value.authority) && exactKeys(value.authority, ["mode", "customerDataAuthorized", "productiveBookingAuthorized", "externalCallsAuthorized"])
    && value.authority.mode === "LOCAL_SYNTHETIC_PROOF"
    && value.authority.customerDataAuthorized === false
    && value.authority.productiveBookingAuthorized === false
    && value.authority.externalCallsAuthorized === false;
}
type UiDenialReasonV1 = "HIDDEN_AUTHORITY_DENIED" | "UNSUPPORTED_ACTION_DENIED" | "CONTEXT_COLLAPSE_DENIED" | "INPUT_SHAPE_DENIED";
function deniedUi(reasonCode: UiDenialReasonV1): IncomingInvoiceUiManifestResultV1 {
  return deepFreeze({ outcome: "DENIED" as const, reasonCode });
}

export const INCOMING_INVOICE_APPLICATION_GUIDE_V1 = deepFreeze({
  schemaVersion: INCOMING_INVOICE_APPLICATION_GUIDE_SCHEMA_V1,
  guideVersion: "1.0.0",
  applicability: ["local synthetic incoming-invoice ERV evidence", "AP-04 versioned matching and tolerance variants"],
  variants: [
    { scenario: "LEAN", selectionRule: "AP-01 low-complexity scenario", capabilityIds: [...CAPABILITY_IDS], processVariant: "TWO_WAY_INVOICE_PO_V1" },
    { scenario: "CONTROLLED", selectionRule: "AP-01 controlled scenario", capabilityIds: [...CAPABILITY_IDS], processVariant: "THREE_WAY_INVOICE_PO_RECEIPT_V1" },
    { scenario: "SEGREGATED_ENTERPRISE", selectionRule: "AP-01 segregation-required scenario", capabilityIds: [...CAPABILITY_IDS], processVariant: "THREE_WAY_INVOICE_PO_RECEIPT_V1" },
  ],
  limits: ["Synthetic evidence only; no customer data or external retrieval", "Manifest actions are advisory/read-only and do not post, allocate or approve"],
  nonclaims: ["NO_PRODUCTION_FRONTEND_OR_LIVE_ERP_CLAIM", "NO_AUTONOMOUS_REQUIREMENTS_AUTHORITY", "NO_PRODUCTIVE_BOOKING_CLAIM"],
} as const satisfies IncomingInvoiceApplicationGuideV1);

export function deriveIncomingInvoiceUiManifestV1(input: unknown): IncomingInvoiceUiManifestResultV1 {
  if (isRecord(input) && isRecord(input.authority)
    && (input.authority.productiveBookingAuthorized === true
      || input.authority.customerDataAuthorized === true
      || input.authority.externalCallsAuthorized === true)) return deniedUi("HIDDEN_AUTHORITY_DENIED");
  if (isRecord(input) && isRecord(input.evidence)) {
    const matchingMode = isRecord(input.evidence.matchingMode) ? input.evidence.matchingMode.variantId : undefined;
    const tolerancePolicy = isRecord(input.evidence.tolerancePolicy) ? input.evidence.tolerancePolicy.variantId : undefined;
    if ((typeof matchingMode === "string" && !MATCHING_MODES.includes(matchingMode as MatchingModeIdV1))
      || (typeof tolerancePolicy === "string" && !TOLERANCE_POLICIES.includes(tolerancePolicy as TolerancePolicyIdV1))) return deniedUi("UNSUPPORTED_ACTION_DENIED");
  }
  if (!uiInputValid(input)) return deniedUi("INPUT_SHAPE_DENIED");
  const required = modeRequiredKinds(input.evidence.matchingMode.variantId);
  const referencesByKind = new Map(input.evidence.references.map((reference) => [reference.kind, reference]));
  const referenceKinds = input.evidence.references.map(({ kind }) => kind);
  const hasDuplicateKind = new Set(referenceKinds).size !== referenceKinds.length;
  const hasExtraneousKind = referenceKinds.some((kind) => !required.includes(kind));
  if (input.evidence.references.length === 0 || hasDuplicateKind || hasExtraneousKind || required.some((kind) => !referencesByKind.has(kind))) return deniedUi("CONTEXT_COLLAPSE_DENIED");
  const evidenceRefs = input.evidence.references.map(({ evidenceRef }) => evidenceRef);
  const fields: IncomingInvoiceUiFieldV1[] = [
    { fieldId: "supplier", label: "Supplier", state: "VISIBLE", evidenceRefs: evidenceRefs.filter((_, index) => input.evidence.references[index]?.kind === "SUPPLIER") },
    { fieldId: "purchaseOrder", label: "Purchase order", state: "VISIBLE", evidenceRefs: evidenceRefs.filter((_, index) => input.evidence.references[index]?.kind === "PURCHASE_ORDER") },
  ];
  if (required.includes("RECEIPT")) fields.push({ fieldId: "receipt", label: "Receipt", state: "VISIBLE", evidenceRefs: evidenceRefs.filter((_, index) => input.evidence.references[index]?.kind === "RECEIPT") });
  fields.push({ fieldId: "invoice", label: "Invoice", state: "VISIBLE", evidenceRefs: evidenceRefs.filter((_, index) => input.evidence.references[index]?.kind === "INVOICE") });
  fields.push({ fieldId: "matchStatus", label: "Match status", state: "VISIBLE", evidenceRefs });
  if (input.scenario !== "LEAN") fields.push({ fieldId: "tolerancePolicy", label: "Tolerance policy", state: "VISIBLE", evidenceRefs });
  if (input.scenario === "SEGREGATED_ENTERPRISE") {
    fields.push({ fieldId: "approvalTrail", label: "Approval trail", state: "VISIBLE", evidenceRefs });
    fields.push({ fieldId: "separationOfDuties", label: "Separation of duties", state: "VISIBLE", evidenceRefs });
  }
  fields.push({ fieldId: "evidenceReferences", label: "Evidence references", state: "VISIBLE", evidenceRefs });
  const allVerified = input.evidence.references.every(({ verified }) => verified);
  const actions: IncomingInvoiceUiActionV1[] = [{ actionId: "VIEW_EVIDENCE", enabled: true, reason: "Evidence is available for read-only inspection.", evidenceRefs }];
  if (input.evidence.outcome === "MATCHED" && allVerified) actions.push({ actionId: "ACKNOWLEDGE_MATCH", enabled: true, reason: "All required evidence references are verified and matched.", evidenceRefs });
  if (input.evidence.outcome === "MATCHED" && !allVerified) actions.push({ actionId: "REQUEST_CLARIFICATION", enabled: true, reason: "A required reference is not verified; acknowledgement is withheld.", evidenceRefs });
  if (input.evidence.outcome === "CONFLICT") actions.push({ actionId: "IDENTIFY_AUTHORITATIVE_REFERENCE", enabled: true, reason: "Evidence conflicts; an authority decision is unresolved.", evidenceRefs });
  if (input.evidence.outcome === "EXCEPTION") actions.push({ actionId: "PROVIDE_MISSING_CONTEXT", enabled: true, reason: "The ERV exception requires additional evidence-backed context.", evidenceRefs });
  if (input.evidence.outcome === "DENIED") actions.push({ actionId: "VIEW_DENIAL", enabled: true, reason: "The ERV decision is denied and remains read-only.", evidenceRefs });
  if (input.scenario === "SEGREGATED_ENTERPRISE" && input.evidence.outcome === "CONFLICT") actions.push({ actionId: "ESCALATE_SEPARATION_REVIEW", enabled: true, reason: "Segregation-required conflicts need separation review.", evidenceRefs });
  const unsigned = {
    schemaVersion: INCOMING_INVOICE_ADAPTIVE_UI_SCHEMA_V1,
    manifestVersion: "1.0.0" as const,
    scenario: input.scenario,
    evidenceState: input.evidence.outcome,
    fields,
    actions,
    reusedCapabilityIds: [...CAPABILITY_IDS],
    applicationGuideVersion: "1.0.0" as const,
    authority: { mode: "LOCAL_SYNTHETIC_PROOF" as const, bookingAuthorityGranted: false as const, externalCallsAuthorized: false as const },
  };
  return deepFreeze({ outcome: "DERIVED" as const, manifest: { ...unsigned, manifestDigest: digest(unsigned) } });
}

function variantName(variant: RequirementVariantV1): string { return `${variant.variantId}@${variant.version}`; }
function effectNames(effects: readonly string[]): string { return effects.join(","); }
function requirementDigest(requirement: IncomingInvoiceErvRequirementV1): string { return digest(requirement); }
function configurationDigest(requirement: IncomingInvoiceErvRequirementV1): string {
  return digest({ matchingMode: requirement.matchingMode, tolerancePolicy: requirement.tolerancePolicy, requestedEffects: requirement.requestedEffects });
}
function transcript(turns: IncomingInvoiceDialogueTurnV1[]): IncomingInvoiceSetupTranscriptV1 {
  const unsigned = { schemaVersion: INCOMING_INVOICE_SETUP_DIALOGUE_SCHEMA_V1, transcriptVersion: "1.0.0" as const, syntheticEvidence: true as const, turns };
  return deepFreeze({ ...unsigned, transcriptDigest: digest(unsigned) });
}
function answerValid(value: unknown): value is IncomingInvoiceSetupAnswerV1 {
  return isRecord(value) && exactKeys(value, ["questionId", "answer"])
    && typeof value.questionId === "string" && value.questionId.length > 0
    && (value.answer === "CONFIRM" || value.answer === "DECLINE");
}
function baseTurns(input: IncomingInvoiceSetupInputV1): IncomingInvoiceDialogueTurnV1[] {
  return [
    { ordinal: 1, speaker: "SYSTEM", kind: "BASELINE_REQUIREMENT", payload: input.baseline, evidenceRefs: [...input.baseline.evidenceRefs].sort() },
    { ordinal: 2, speaker: "SYSTEM", kind: "CHANGED_REQUIREMENT", payload: input.changed, evidenceRefs: [...input.changed.evidenceRefs].sort() },
  ];
}
function setupDenied(input: unknown, gaps: readonly string[]): IncomingInvoiceSetupAgentResultV1 {
  const turns: IncomingInvoiceDialogueTurnV1[] = isRecord(input) && requirementValid(input.baseline) && requirementValid(input.changed)
    && Array.isArray(input.answers)
    ? baseTurns(input as unknown as IncomingInvoiceSetupInputV1)
    : [
      { ordinal: 1, speaker: "SYSTEM", kind: "BASELINE_REQUIREMENT", payload: { invalid: true as const }, evidenceRefs: [] },
      { ordinal: 2, speaker: "SYSTEM", kind: "CHANGED_REQUIREMENT", payload: { invalid: true as const }, evidenceRefs: [] },
    ];
  const evidenceRefs = isRecord(input) && requirementValid(input.changed) ? [...input.changed.evidenceRefs].sort() : [];
  turns.push({ ordinal: turns.length + 1, speaker: "SYSTEM", kind: "OUTCOME", payload: { outcome: "DENIED_UNSUPPORTED", gaps: [...gaps].sort() }, evidenceRefs });
  return deepFreeze({ outcome: "DENIED_UNSUPPORTED" as const, transcript: transcript(turns), unresolvedGaps: [...gaps].sort() });
}

export function runIncomingInvoiceSetupAgentV1(input: unknown): IncomingInvoiceSetupAgentResultV1 {
  if (!isRecord(input) || !exactKeys(input, ["baseline", "changed", "answers"]) || !requirementValid(input.baseline) || !requirementValid(input.changed) || !Array.isArray(input.answers) || !input.answers.every(answerValid)) {
    return setupDenied(input, ["INPUT_SHAPE_DENIED"]);
  }
  const setupInput = input as unknown as IncomingInvoiceSetupInputV1;
  const unsupported = [
    ...(!MATCHING_MODES.includes(setupInput.baseline.matchingMode.variantId as MatchingModeIdV1) ? ["UNSUPPORTED_MATCHING_MODE"] : []),
    ...(!MATCHING_MODES.includes(setupInput.changed.matchingMode.variantId as MatchingModeIdV1) ? ["UNSUPPORTED_MATCHING_MODE"] : []),
    ...(!TOLERANCE_POLICIES.includes(setupInput.baseline.tolerancePolicy.variantId as TolerancePolicyIdV1) ? ["UNSUPPORTED_TOLERANCE_POLICY"] : []),
    ...(!TOLERANCE_POLICIES.includes(setupInput.changed.tolerancePolicy.variantId as TolerancePolicyIdV1) ? ["UNSUPPORTED_TOLERANCE_POLICY"] : []),
    ...setupInput.baseline.requestedEffects.filter((effect) => !ALLOWED_EFFECTS.includes(effect as EffectV1)).map(() => "UNSUPPORTED_EFFECT"),
    ...setupInput.changed.requestedEffects.filter((effect) => !ALLOWED_EFFECTS.includes(effect as EffectV1)).map(() => "UNSUPPORTED_EFFECT"),
  ];
  if (unsupported.length > 0) return setupDenied(setupInput, unsupported);
  const questions: Array<Readonly<{ questionId: string; setting: "matchingMode" | "tolerancePolicy" | "requestedEffects"; evidenceRefs: readonly string[] }>> = [];
  if (variantName(setupInput.baseline.matchingMode) !== variantName(setupInput.changed.matchingMode)) {
    if (setupInput.changed.evidenceRefs.length === 0) questions.push({ questionId: "gap:matching-mode", setting: "matchingMode", evidenceRefs: [] });
    else questions.push({ questionId: "confirm:matching-mode", setting: "matchingMode", evidenceRefs: [...setupInput.changed.evidenceRefs].sort() });
  }
  if (variantName(setupInput.baseline.tolerancePolicy) !== variantName(setupInput.changed.tolerancePolicy)) {
    if (setupInput.changed.evidenceRefs.length === 0) questions.push({ questionId: "gap:tolerance-policy", setting: "tolerancePolicy", evidenceRefs: [] });
    else questions.push({ questionId: "confirm:tolerance-policy", setting: "tolerancePolicy", evidenceRefs: [...setupInput.changed.evidenceRefs].sort() });
  }
  if (canonicalJson(setupInput.baseline.requestedEffects) !== canonicalJson(setupInput.changed.requestedEffects)) {
    if (setupInput.changed.evidenceRefs.length === 0) questions.push({ questionId: "gap:requested-effects", setting: "requestedEffects", evidenceRefs: [] });
    else questions.push({ questionId: "confirm:requested-effects", setting: "requestedEffects", evidenceRefs: [...setupInput.changed.evidenceRefs].sort() });
  }
  const evidenceGaps = questions.filter(({ questionId }) => questionId.startsWith("gap:")).map(({ setting }) => `MISSING_EVIDENCE_FOR_${setting === "matchingMode" ? "MATCHING_MODE" : setting === "tolerancePolicy" ? "TOLERANCE_POLICY" : "REQUESTED_EFFECTS"}`);
  const confirmQuestions = questions.filter(({ questionId }) => questionId.startsWith("confirm:")).sort((a, b) => a.questionId.localeCompare(b.questionId));
  const turns = baseTurns(setupInput);
  for (const question of confirmQuestions) turns.push({ ordinal: turns.length + 1, speaker: "AGENT", kind: "CLARIFICATION", payload: { questionId: question.questionId, question: `Confirm changed ${question.setting} from the evidence-backed AP-04 variant.` }, evidenceRefs: question.evidenceRefs });
  const answers = setupInput.answers.map((answer) => ({ questionId: answer.questionId, answer: answer.answer })).sort((a, b) => a.questionId.localeCompare(b.questionId) || a.answer.localeCompare(b.answer));
  const contradictions = answers.filter((answer, index) => index > 0 && answers[index - 1]?.questionId === answer.questionId && answers[index - 1]?.answer !== answer.answer);
  for (const answer of answers) turns.push({ ordinal: turns.length + 1, speaker: "OPERATOR", kind: "ANSWER", payload: answer, evidenceRefs: [...setupInput.changed.evidenceRefs].sort() });
  const gaps = [...evidenceGaps];
  if (contradictions.length > 0 || answers.some(({ questionId }) => !confirmQuestions.some((question) => question.questionId === questionId))) gaps.push("CONTRADICTORY_ANSWER");
  for (const question of confirmQuestions) {
    const matchingAnswers = answers.filter(({ questionId }) => questionId === question.questionId);
    if (matchingAnswers.length === 0) gaps.push(`UNANSWERED_${question.setting.toUpperCase()}`);
    else if (matchingAnswers.some(({ answer }) => answer !== "CONFIRM")) gaps.push(`DECLINED_${question.setting.toUpperCase()}`);
  }
  if (gaps.length > 0) {
    const orderedGaps = [...new Set(gaps)].sort();
    turns.push({ ordinal: turns.length + 1, speaker: "SYSTEM", kind: "OUTCOME", payload: { outcome: "NEEDS_CLARIFICATION", gaps: orderedGaps }, evidenceRefs: [...setupInput.changed.evidenceRefs].sort() });
    return deepFreeze({ outcome: "NEEDS_CLARIFICATION" as const, transcript: transcript(turns), unresolvedGaps: orderedGaps });
  }
  const changedSettings: Array<Readonly<{ setting: "matchingMode" | "tolerancePolicy" | "requestedEffects"; before: string; after: string }>> = [];
  if (variantName(setupInput.baseline.matchingMode) !== variantName(setupInput.changed.matchingMode)) changedSettings.push({ setting: "matchingMode", before: variantName(setupInput.baseline.matchingMode), after: variantName(setupInput.changed.matchingMode) });
  if (variantName(setupInput.baseline.tolerancePolicy) !== variantName(setupInput.changed.tolerancePolicy)) changedSettings.push({ setting: "tolerancePolicy", before: variantName(setupInput.baseline.tolerancePolicy), after: variantName(setupInput.changed.tolerancePolicy) });
  if (canonicalJson(setupInput.baseline.requestedEffects) !== canonicalJson(setupInput.changed.requestedEffects)) changedSettings.push({ setting: "requestedEffects", before: effectNames(setupInput.baseline.requestedEffects), after: effectNames(setupInput.changed.requestedEffects) });
  const unsignedDelta = {
    schemaVersion: INCOMING_INVOICE_CONFIGURATION_DELTA_SCHEMA_V1,
    deltaVersion: "1.0.0" as const,
    beforeRequirementDigest: requirementDigest(setupInput.baseline),
    afterRequirementDigest: requirementDigest(setupInput.changed),
    beforeConfigurationDigest: configurationDigest(setupInput.baseline),
    afterConfigurationDigest: configurationDigest(setupInput.changed),
    reusedCapabilityIds: [...CAPABILITY_IDS],
    changedSettings,
    evidenceReferences: [...new Set([...setupInput.baseline.evidenceRefs, ...setupInput.changed.evidenceRefs])].sort(),
    unresolvedGaps: [] as const,
    authorityGranted: false as const,
    inventedExecutableFunctions: [] as const,
  };
  const configurationDelta = deepFreeze({ ...unsignedDelta, configurationDeltaDigest: digest(unsignedDelta) });
  turns.push({ ordinal: turns.length + 1, speaker: "SYSTEM", kind: "OUTCOME", payload: { outcome: "RESOLVED", configurationDeltaDigest: configurationDelta.configurationDeltaDigest }, evidenceRefs: configurationDelta.evidenceReferences });
  return deepFreeze({ outcome: "RESOLVED" as const, transcript: transcript(turns), configurationDelta });
}
