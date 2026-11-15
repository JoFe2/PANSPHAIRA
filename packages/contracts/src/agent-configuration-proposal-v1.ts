// Original #567 B1: closed typed onboarding proposal contract. The model
// receives only the minimized server-built context below and answers with one
// closed typed proposal object. Model text is never HTML/JS/Command/function
// and never authority: every proposal is independently revalidated here
// against the SAME policy field definitions the A2 draft owner enforces, and
// only the user's explicit confirmation turns accepted fields into a
// versioned answer delta on the existing #563 draft (no second draft store,
// no second broker, no publication/business/execution authority).
import { createHash } from "node:crypto";
import { canonicalJson } from "./canonical-json.js";
import { configurationClosedObjectV1, AGENT_CONFIGURATION_ANSWERS_SCHEMA_V1,
  type AgentConfigurationPolicyV1, type AgentConfigurationFieldV1, type AgentConfigurationFieldDefinitionV1, type AgentConfigurationValueV1,
  type AgentConfigurationAnswersV1 } from "./agent-configuration-draft-v1.js";

export const AGENT_CONFIGURATION_PROPOSAL_SCHEMA_V1 = "pansphaira.agent-configuration/proposal/v1" as const;
export const AGENT_CONFIGURATION_PROPOSAL_CONTEXT_SCHEMA_V1 = "pansphaira.agent-configuration/proposal-context/v1" as const;
export const AGENT_CONFIGURATION_PROPOSAL_REQUEST_SCHEMA_V1 = "pansphaira.agent-configuration/proposal-request/v1" as const;
export const AGENT_CONFIGURATION_PROPOSAL_CONFIRM_SCHEMA_V1 = "pansphaira.agent-configuration/proposal-confirm/v1" as const;
export const AGENT_CONFIGURATION_PROPOSAL_READBACK_SCHEMA_V1 = "pansphaira.agent-configuration/proposal-readback/v1" as const;
// Code-owned registered capability reference; a model-invented capability name
// never passes validation and can never grant a right.
export const AGENT_CONFIGURATION_PROPOSAL_CAPABILITY_V1 = "configuration.onboarding.propose/v1" as const;
export const AGENT_CONFIGURATION_PROPOSAL_CONTEXT_MAX_BYTES = 8192;
export interface AgentConfigurationProposalEntryV1 {
  readonly field: AgentConfigurationFieldV1;
  readonly value: AgentConfigurationValueV1;
  readonly rationale: string;
}
export interface AgentConfigurationClarificationV1 {
  readonly field: AgentConfigurationFieldV1;
  readonly question: string;
}
export interface AgentConfigurationProposalV1 {
  readonly schemaVersion: typeof AGENT_CONFIGURATION_PROPOSAL_SCHEMA_V1;
  readonly capabilityReference: typeof AGENT_CONFIGURATION_PROPOSAL_CAPABILITY_V1;
  readonly expectedRevision: number;
  readonly proposals: readonly AgentConfigurationProposalEntryV1[];
  readonly clarifications: readonly AgentConfigurationClarificationV1[];
  readonly proposalDigest: string;
}
export interface AgentConfigurationProposalReadbackV1 {
  readonly schemaVersion: typeof AGENT_CONFIGURATION_PROPOSAL_READBACK_SCHEMA_V1;
  readonly outcome: "PROPOSED" | "NOTHING_TO_PROPOSE" | "REVISION_CONFLICT" | "PROPOSAL_INVALID"
    | "MODEL_UNAVAILABLE" | "MODEL_CONNECTION_DENIED" | "CONTEXT_TOO_LARGE" | "APPLIED" | "PROPOSAL_STALE";
  readonly reason: string;
  readonly expectedRevision: number;
  readonly newRevision: number | null;
  readonly proposal: AgentConfigurationProposalV1 | null;
  readonly draftRetained: true;
  readonly activationAuthorized: false;
  readonly realModelAcceptance: false;
}
const hash = (v: unknown): string => createHash("sha256").update(canonicalJson(v)).digest("hex");
function freeze<T>(v: T): T { if (v !== null && typeof v === "object") { for (const c of Object.values(v)) freeze(c); Object.freeze(v); } return v; }
function dense(value: unknown, max: number): readonly unknown[] {
  if (!Array.isArray(value) || Object.getPrototypeOf(value) !== Array.prototype || value.length > max) throw Error("PROPOSAL_SCHEMA_DENIED");
  const ds = Object.getOwnPropertyDescriptors(value);
  if (Reflect.ownKeys(ds).length !== value.length + 1 || Array.from({ length: value.length }, (_, i) => ds[String(i)]).some(d => !d || !d.enumerable || !("value" in d))) throw Error("PROPOSAL_SCHEMA_DENIED");
  return value;
}
// Explanation text is inert bounded data: markup characters and control or
// non-printable codepoints are refused outright, so injected model output can
// never smuggle presentation or authority.
const inertText = (value: unknown, min: number, max: number): string => {
  if (typeof value !== "string" || value.length < min || value.length > max || !/^[^\u0000-\u001f\u007f-\u009f<>`&]*$/u.test(value) || value.trim() !== value || value.trim().length === 0) throw Error("PROPOSAL_TEXT_DENIED");
  return value;
};
export interface AgentConfigurationProposalContextV1 {
  readonly contextText: string;
  readonly contextDigest: string;
  readonly askableFields: readonly AgentConfigurationFieldV1[];
}
// Minimized server-built context: only the ACTUAL unresolved questions of the
// current authoritative readback, their registered allowed values, and the
// confirmed values of their declared dependencies. No secrets, no tenant or
// session identifiers, no confirmed-but-irrelevant values, no free text.
export function buildAgentConfigurationProposalContextV1(
  readback: { policyDigest: string; revision: number; questions: { field: AgentConfigurationFieldV1; label: string; reason: string }[]; definitions: AgentConfigurationPolicyV1["fields"]; draft: { fields: Readonly<Record<AgentConfigurationFieldV1, { value: AgentConfigurationValueV1 | null }>> } },
  userIntent: string,
): AgentConfigurationProposalContextV1 {
  const askable = readback.questions.map(q => q.field);
  const dependencies = [...new Set(askable.flatMap(f => readback.definitions[f].dependencies))].filter(f => !askable.includes(f));
  const context = {
    schemaVersion: AGENT_CONFIGURATION_PROPOSAL_CONTEXT_SCHEMA_V1,
    policyDigest: readback.policyDigest, expectedRevision: readback.revision,
    capabilityReferences: [AGENT_CONFIGURATION_PROPOSAL_CAPABILITY_V1] as const,
    // Registered minimized user intent: already closed to inert bounded text
    // by the request validator; never a secret, session id or foreign tenant.
    userIntent: inertText(userIntent, 4, 320),
    questions: readback.questions.map(q => ({
      field: q.field, label: q.label, reason: q.reason,
      allowedValues: readback.definitions[q.field].allowedValues.slice(0, 16),
    })),
    confirmedDependencies: dependencies.map(f => ({ field: f, value: readback.draft.fields[f].value })),
  };
  const contextText = canonicalJson(context);
  return freeze({ contextText, contextDigest: hash(contextText), askableFields: askable });
}
export function validateAgentConfigurationProposalRequestV1(value: unknown, expectedRevision: number): { intent: string } {
  const v = configurationClosedObjectV1(value, ["schemaVersion", "expectedRevision", "confirm", "intent"]);
  const revision = v.expectedRevision;
  if (v.schemaVersion !== AGENT_CONFIGURATION_PROPOSAL_REQUEST_SCHEMA_V1 || v.confirm !== true
    || !Number.isSafeInteger(revision) || (revision as number) < 0 || Object.is(revision, -0) || revision !== expectedRevision) throw Error("PROPOSAL_REQUEST_DENIED");
  // The user's own bounded free-text intent travels as untrusted inert data:
  // it is never HTML/JS/command/function, never authority, and reaches the
  // model only inside the minimized code-owned context below.
  return { intent: inertText(v.intent, 4, 320) };
}
export function validateAgentConfigurationProposalConfirmV1(value: unknown): { expectedRevision: number; proposalDigest: string; acceptedFields: readonly AgentConfigurationFieldV1[] } {
  const v = configurationClosedObjectV1(value, ["schemaVersion", "expectedRevision", "proposalDigest", "acceptedFields", "confirm"]);
  const revision = v.expectedRevision;
  if (v.schemaVersion !== AGENT_CONFIGURATION_PROPOSAL_CONFIRM_SCHEMA_V1 || v.confirm !== true
    || !Number.isSafeInteger(revision) || (revision as number) < 0 || Object.is(revision, -0)
    || typeof v.proposalDigest !== "string" || !/^[a-f0-9]{64}$/.test(v.proposalDigest)) throw Error("PROPOSAL_CONFIRM_DENIED");
  const acceptedFields = dense(v.acceptedFields, 8).map(f => inertText(f, 1, 64));
  if (!acceptedFields.length || new Set(acceptedFields).size !== acceptedFields.length) throw Error("PROPOSAL_CONFIRM_DENIED");
  return { expectedRevision: v.expectedRevision as number, proposalDigest: v.proposalDigest, acceptedFields: acceptedFields as AgentConfigurationFieldV1[] };
}
// Independent server-side revalidation of the model answer: closed shape,
// registered capability only, exact revision binding, proposal fields limited
// to the ACTUAL open questions (confirmed values can never be silently
// replaced), every value rechecked against the same policy definitions, and
// inert bounded explanation text. Returns INVALID with a closed code — the
// caller retains the draft and never auto-retries.
export type AgentConfigurationProposalValidation =
  | { readonly outcome: "VALID"; readonly proposal: AgentConfigurationProposalV1 }
  | { readonly outcome: "INVALID"; readonly code: "PROPOSAL_SCHEMA_DENIED" | "PROPOSAL_CAPABILITY_DENIED" | "PROPOSAL_REVISION_DENIED" | "PROPOSAL_FIELD_DENIED" | "PROPOSAL_VALUE_DENIED" | "PROPOSAL_TEXT_DENIED" };
export function validateAgentConfigurationProposalV1(value: unknown,
  context: { definitions: AgentConfigurationPolicyV1["fields"]; askableFields: readonly AgentConfigurationFieldV1[]; expectedRevision: number; contextDigest: string },
): AgentConfigurationProposalValidation {
  try {
    const v = configurationClosedObjectV1(value, ["schemaVersion", "capabilityReference", "expectedRevision", "proposals", "clarifications"]);
    if (v.schemaVersion !== AGENT_CONFIGURATION_PROPOSAL_SCHEMA_V1) return { outcome: "INVALID", code: "PROPOSAL_SCHEMA_DENIED" };
    if (v.capabilityReference !== AGENT_CONFIGURATION_PROPOSAL_CAPABILITY_V1) return { outcome: "INVALID", code: "PROPOSAL_CAPABILITY_DENIED" };
    if (!Number.isSafeInteger(v.expectedRevision) || v.expectedRevision !== context.expectedRevision || Object.is(v.expectedRevision, -0)) return { outcome: "INVALID", code: "PROPOSAL_REVISION_DENIED" };
    const proposalsRaw = dense(v.proposals, 8), clarificationsRaw = dense(v.clarifications, 4);
    if (proposalsRaw.length + clarificationsRaw.length < 1) return { outcome: "INVALID", code: "PROPOSAL_SCHEMA_DENIED" };
    const seen = new Set<AgentConfigurationFieldV1>(), proposals: AgentConfigurationProposalEntryV1[] = [];
    for (const item of proposalsRaw) {
      const p = configurationClosedObjectV1(item, ["field", "value", "rationale"]);
      if (typeof p.field !== "string" || !Object.hasOwn(context.definitions, p.field) || !context.askableFields.includes(p.field as AgentConfigurationFieldV1)) return { outcome: "INVALID", code: "PROPOSAL_FIELD_DENIED" };
      const field = p.field as AgentConfigurationFieldV1;
      if (seen.has(field)) return { outcome: "INVALID", code: "PROPOSAL_FIELD_DENIED" };
      seen.add(field);
      const rationale = inertText(p.rationale, 8, 240);
      const definition = context.definitions[field];
      const checked = proposalValueChecked(definition, p.value);
      if (!checked.ok) return { outcome: "INVALID", code: "PROPOSAL_VALUE_DENIED" };
      proposals.push({ field, value: checked.value, rationale });
    }
    const clarifications: AgentConfigurationClarificationV1[] = [];
    for (const item of clarificationsRaw) {
      const c = configurationClosedObjectV1(item, ["field", "question"]);
      if (typeof c.field !== "string" || !context.askableFields.includes(c.field as AgentConfigurationFieldV1)) return { outcome: "INVALID", code: "PROPOSAL_FIELD_DENIED" };
      clarifications.push({ field: c.field as AgentConfigurationFieldV1, question: inertText(c.question, 8, 240) });
    }
    const core = { schemaVersion: AGENT_CONFIGURATION_PROPOSAL_SCHEMA_V1, capabilityReference: AGENT_CONFIGURATION_PROPOSAL_CAPABILITY_V1, expectedRevision: context.expectedRevision, contextDigest: context.contextDigest, proposals, clarifications };
    return { outcome: "VALID", proposal: freeze({ ...core, proposalDigest: hash(core) }) as unknown as AgentConfigurationProposalV1 };
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    return { outcome: "INVALID", code: message === "PROPOSAL_TEXT_DENIED" ? "PROPOSAL_TEXT_DENIED" : "PROPOSAL_SCHEMA_DENIED" };
  }
}
// Mirrors the draft contract value rules from the SAME definitions the A2
// owner enforces, independently of the answer-application path.
function proposalValueChecked(definition: AgentConfigurationFieldDefinitionV1, value: unknown): { readonly ok: boolean; readonly value: AgentConfigurationValueV1 | null } {
  if (definition.type === "SET") {
    const items = dense(value, definition.allowedValues.length);
    if (items.length < 1 || items.some(x => typeof x !== "string" || !definition.allowedValues.includes(x)) || new Set(items).size !== items.length) return { ok: false, value: null };
    return { ok: true, value: [...items].sort() as unknown as AgentConfigurationValueV1 };
  }
  if (definition.type === "INTEGER") {
    if (!Number.isSafeInteger(value) || Object.is(value, -0) || (value as number) < (definition.allowedValues[0] as number) || (value as number) > (definition.allowedValues[1] as number)) return { ok: false, value: null };
    return { ok: true, value: value as AgentConfigurationValueV1 };
  }
  if (definition.type === "SECRET_REFERENCE") return definition.allowedValues.includes(null as AgentConfigurationValueV1) && value === null ? { ok: true, value: null } : { ok: false, value: null };
  return definition.allowedValues.includes(value as AgentConfigurationValueV1) ? { ok: true, value: value as AgentConfigurationValueV1 } : { ok: false, value: null };
}
// Explicit user confirmation maps the accepted subset to the EXISTING #563
// answers command: same schemas, same CAS revision, same server validation.
// The proposal itself never writes; only this command does.
export function agentConfigurationProposalAnswersV1(proposal: AgentConfigurationProposalV1, acceptedFields: readonly AgentConfigurationFieldV1[], expectedRevision: number): AgentConfigurationAnswersV1 {
  if (!acceptedFields.length || new Set(acceptedFields).size !== acceptedFields.length) throw Error("PROPOSAL_CONFIRM_DENIED");
  const byField = new Map(proposal.proposals.map(p => [p.field, p]));
  const answers = acceptedFields.map(field => {
    const entry = byField.get(field);
    if (!entry) throw Error("PROPOSAL_FIELD_DENIED");
    return { field, value: entry.value, confirmation: "CONFIRM" } as const;
  });
  return freeze({ schemaVersion: AGENT_CONFIGURATION_ANSWERS_SCHEMA_V1, expectedRevision, answers } as AgentConfigurationAnswersV1);
}
