import { createHash } from "node:crypto";
import { canonicalJson } from "../../contracts/src/canonical-json.js";

/**
 * KTS-01/02 — Fachmethode core (deterministic, data-only, fail-closed).
 *
 * A Fachmethode is a closed, digest-bound rule program: inputs with explicit
 * fachliche Bedeutung (meaning) and units, preconditions, and a deterministic
 * evaluator. It is NEVER a model: no LLM, no GPU, no free-form interpretation.
 * Deterministic rules are executed, and the receipt proves execution from the
 * exact bound inputs (ruleProvenance = DETERMINISTIC_RULES).
 *
 * Authority separation (hard requirement): the agent PROPOSAL (selection,
 * mapping) and the USER DECISION are separate digest-bound objects. Access
 * rights derive ONLY from sealed contracts (method spec, corpus edition, read
 * connector contract), never from proposal or knowledge content. Tampering
 * with a source or a mapping changes a bound digest and fails closed; it can
 * never extend rights.
 */

export const METHOD_SPEC_SCHEMA_V1 = "pansphaira.kts/method-spec/v1" as const;
export const METHOD_GOAL_SCHEMA_V1 = "pansphaira.kts/method-goal/v1" as const;
export const METHOD_SELECTION_SCHEMA_V1 = "pansphaira.kts/method-selection/v1" as const;
export const CONTEXT_MAPPING_SCHEMA_V1 = "pansphaira.kts/context-mapping/v1" as const;
export const USER_DECISION_SCHEMA_V1 = "pansphaira.kts/user-decision/v1" as const;
export const METHOD_EXECUTION_RECEIPT_SCHEMA_V1 =
  "pansphaira.kts/method-execution-receipt/v1" as const;
export const METHOD_AUTHORITY_BOUNDARY_V1 =
  "READ_ONLY_DETERMINISTIC_RULES_NO_MODEL_EXECUTION_NO_WRITE_NO_AUTHORITY" as const;
export const RULE_PROVENANCE_VALUES_V1 = ["DETERMINISTIC_RULES"] as const;
export type RuleProvenanceV1 = (typeof RULE_PROVENANCE_VALUES_V1)[number];

const ID_RE = /^[a-z][a-z-]{1,31}:[a-z0-9][a-z0-9._-]{2,95}$/;
const DIGEST_RE = /^[a-f0-9]{64}$/;

export const METHOD_OUTCOME_SHAPES_V1 = ["FLAG_RECORDS", "COMPUTE_TOTAL"] as const;
export type MethodOutcomeShapeV1 = (typeof METHOD_OUTCOME_SHAPES_V1)[number];
export const METHOD_INPUT_KINDS_V1 = ["number", "record-set"] as const;
export type MethodInputKindV1 = (typeof METHOD_INPUT_KINDS_V1)[number];

export interface MethodFieldAliasV1 {
  readonly sourceField: string;
  readonly specField: string;
  readonly factor: number | null;
}

export interface MethodInputSpecV1 {
  readonly inputId: string;
  readonly meaning: string;
  readonly kind: MethodInputKindV1;
  /** Canonical unit for number inputs (e.g. "eur"); null for record-set. */
  readonly unit: string | null;
  readonly unitAliases: readonly { readonly alias: string; readonly factorToCanonical: number }[];
  /** Required fields for record-set inputs; [] for number inputs. */
  readonly requiredFields: readonly { readonly field: string; readonly nullable: boolean; /** Closed fachliche meaning key (F2): the closed semantic identity of this field — the closed meaning check of the guided path compares against this, not free text. */
  readonly meaningKey?: "INVOICE_ID" | "ORDER_ID" | "CUSTOMER_ID" | "INVOICE_TOTAL_GROSS" | "CURRENCY_CODE" | "DUE_DATE" }[]
  /** Closed deterministic rename/conversion table for record-set inputs. */
  readonly fieldAliases: readonly MethodFieldAliasV1[];
}

export interface MethodSpecV1 {
  readonly schemaVersion: typeof METHOD_SPEC_SCHEMA_V1;
  readonly methodId: string;
  readonly familyId: string;
  readonly title: string;
  readonly meaning: string;
  readonly supportedOutcomes: readonly MethodOutcomeShapeV1[];
  readonly inputs: readonly MethodInputSpecV1[];
  readonly outputs: readonly { readonly outputId: string; readonly meaning: string }[];
  readonly preconditions: readonly string[];
  readonly knowledgeRefs: readonly {
    readonly ref: string;
    readonly kind: "REQUIRED" | "SUPPORTING";
    /** Staleness window in ms of the bound corpus edition; REQUIRED must set a positive window. */
    readonly staleAfterMs: number;
  }[];
  readonly version: string;
  readonly specDigest: string;
}

export interface MethodGoalV1 {
  readonly schemaVersion: typeof METHOD_GOAL_SCHEMA_V1;
  readonly goalId: string;
  readonly actor: string;
  readonly objective: string;
  readonly requestedOutcome: MethodOutcomeShapeV1;
  readonly constraints: readonly string[];
}

export type MethodSelectionReasonV1 =
  | "OUTCOME_MATCHED" | "OUTCOME_MISMATCH" | "DUPLICATE_MATCH"
  | "INTENTION_MATCHED" | "INTENTION_MISMATCH" | "INTENTION_UNRESOLVED"
  | "CONSTRAINT_CONFLICT"
  | "REQUIRED_KNOWLEDGE_ABSENT" | "REQUIRED_KNOWLEDGE_CONFLICT"
  | "STALE_KNOWLEDGE" | "SPEC_DIGEST_MISMATCH" | "SCHEMA_DENIED";

export interface MethodSelectionV1 {
  readonly schemaVersion: typeof METHOD_SELECTION_SCHEMA_V1;
  readonly goal: MethodGoalV1;
  readonly goalDigest: string;
  readonly candidates: readonly { readonly methodId: string; readonly specDigest: string; readonly version: string }[];
  readonly outcome: "SELECTED" | "NO_MATCH" | "UNKNOWN";
  readonly selected: { readonly methodId: string; readonly specDigest: string; readonly version: string; readonly reasons: readonly string[] } | null;
  readonly rejected: readonly { readonly methodId: string; readonly specDigest: string; readonly version: string; readonly reasons: readonly MethodSelectionReasonV1[] }[];
  readonly authorityBoundary: typeof METHOD_AUTHORITY_BOUNDARY_V1;
  readonly selectionDigest: string;
}

export type MappingConversionV1 = "IDENTITY" | "UNIT_FACTOR" | "FIELD_RENAME" | "GAP_HANDLING";

export interface ContextMappingV1 {
  readonly schemaVersion: typeof CONTEXT_MAPPING_SCHEMA_V1;
  readonly mappingId: string;
  readonly methodId: string;
  readonly specDigest: string;
  readonly contextId: string;
  readonly sourceFormat: string;
  readonly fieldMappings: readonly {
    readonly sourceField: string;
    readonly specField: string;
    readonly conversion: MappingConversionV1;
    readonly factor: number | null;
    readonly meaning: string;
  }[];
  readonly adaptations: readonly { readonly kind: MappingConversionV1; readonly detail: string }[];
  /** Blocking Rückfragen: while non-empty the mapping cannot be confirmed. */
  readonly openQuestions: readonly {
    readonly questionId: string;
    readonly field: string;
    readonly question: string;
    readonly options: readonly string[];
  }[];
  readonly proposalDigest: string;
}

export interface UserDecisionV1 {
  readonly schemaVersion: typeof USER_DECISION_SCHEMA_V1;
  readonly decisionId: string;
  readonly actor: string;
  readonly subjectKind: "METHOD_SELECTION" | "CONTEXT_MAPPING" | "EXECUTION";
  readonly proposalDigest: string;
  readonly verdict: "CONFIRMED" | "REJECTED";
  readonly decidedAtMs: number;
  readonly decisionDigest: string;
}

export type FlaggedInvoiceResultV1 = {
  readonly recordId: string;
  readonly valueMinor: number;
  readonly reason: string;
};

export interface MethodExecutionReceiptV1 {
  readonly schemaVersion: typeof METHOD_EXECUTION_RECEIPT_SCHEMA_V1;
  readonly outcome: "EXECUTED" | "DENIED";
  readonly denialReasons: readonly string[];
  readonly ruleProvenance: RuleProvenanceV1;
  readonly methodId: string;
  readonly specDigest: string;
  readonly version: string;
  readonly contextId: string;
  readonly contextDigest: string;
  readonly inputDigest: string;
  readonly decisionDigest: string;
  readonly result: {
    readonly outputId: string;
    readonly flagged: readonly FlaggedInvoiceResultV1[];
    readonly count: number;
    readonly totalInputMinor: number;
  } | null;
  readonly authorityBoundary: typeof METHOD_AUTHORITY_BOUNDARY_V1;
  readonly receiptDigest: string;
}

/* ------------------------------------------------------------------ */
/* digests                                                             */
/* ------------------------------------------------------------------ */

const sha = (value: unknown): string =>
  createHash("sha256").update(typeof value === "string" ? value : canonicalJson(value)).digest("hex");
export const digestOf = (value: unknown): string => sha(value);
const withoutDigest = (v: Record<string, unknown>, field: string): Record<string, unknown> =>
  Object.fromEntries(Object.entries(v).filter(([key]) => key !== field));

export const methodSpecDigestV1 = (
  value: Omit<MethodSpecV1, "specDigest"> | Record<string, unknown>,
): string => sha(withoutDigest(value as Record<string, unknown>, "specDigest"));
export const methodGoalDigestV1 = (value: MethodGoalV1): string => sha(value);
export const methodSelectionDigestV1 = (
  value: Omit<MethodSelectionV1, "selectionDigest"> | Record<string, unknown>,
): string => sha(withoutDigest(value as Record<string, unknown>, "selectionDigest"));
export const contextMappingDigestV1 = (
  value: Omit<ContextMappingV1, "proposalDigest"> | Record<string, unknown>,
): string => sha(withoutDigest(value as Record<string, unknown>, "proposalDigest"));
export const userDecisionDigestV1 = (
  value: Omit<UserDecisionV1, "decisionDigest"> | Record<string, unknown>,
): string => sha(withoutDigest(value as Record<string, unknown>, "decisionDigest"));
export const methodExecutionReceiptDigestV1 = (
  value: Omit<MethodExecutionReceiptV1, "receiptDigest"> | Record<string, unknown>,
): string => sha(withoutDigest(value as Record<string, unknown>, "receiptDigest"));

/* ------------------------------------------------------------------ */
/* validation helpers (fail closed, exact keys)                        */
/* ------------------------------------------------------------------ */

const record = (v: unknown): v is Record<string, unknown> =>
  v !== null && typeof v === "object" && !Array.isArray(v) && Object.getPrototypeOf(v) === Object.prototype;
const exact = (v: unknown, keys: readonly string[]): v is Record<string, unknown> =>
  record(v) && canonicalJson(Object.keys(v).sort()) === canonicalJson([...keys].sort());
const boundedText = (v: unknown, max = 400): v is string =>
  typeof v === "string" && v.length > 0 && v.length <= max && !/[\u0000-\u001f]/.test(v);
const safeInt = (v: unknown, min = 0): v is number => Number.isSafeInteger(v) && (v as number) >= min;
const isId = (v: unknown): v is string => typeof v === "string" && ID_RE.test(v);
const isDigest = (v: unknown): v is string => typeof v === "string" && DIGEST_RE.test(v);
const isoDate = (v: unknown): v is string =>
  typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(`${v}T00:00:00Z`));

const validateFieldAliases = (aliases: unknown): aliases is MethodSpecV1["inputs"][number]["fieldAliases"] => {
  if (!Array.isArray(aliases) || aliases.length > 32) return false;
  const seen = new Set<string>();
  return aliases.every((alias) => {
    if (!exact(alias, ["sourceField", "specField", "factor"])
      || !boundedText(alias.sourceField, 40) || !boundedText(alias.specField, 40)) return false;
    const factorOk = alias.factor === null
      || (typeof alias.factor === "number" && Number.isFinite(alias.factor) && (alias.factor as number) > 0);
    if (!factorOk) return false;
    // Identity aliases (source === spec name) express "this context already
    // uses the spec name"; they must be factor-less (pure identity).
    if (alias.sourceField === alias.specField && alias.factor !== null) return false;
    if (seen.has(`${alias.sourceField}\0${alias.specField}`)) return false;
    seen.add(`${alias.sourceField}\0${alias.specField}`);
    return true;
  });
};

export function validateMethodSpecV1(value: unknown): value is MethodSpecV1 {
  if (!exact(value, ["schemaVersion", "methodId", "familyId", "title", "meaning", "supportedOutcomes", "inputs", "outputs", "preconditions", "knowledgeRefs", "version", "specDigest"])) return false;
  if (value.schemaVersion !== METHOD_SPEC_SCHEMA_V1 || !isId(value.methodId) || !isId(value.familyId)
    || !boundedText(value.title) || !boundedText(value.meaning) || !boundedText(value.version, 40)) return false;
  if (!Array.isArray(value.supportedOutcomes) || value.supportedOutcomes.length < 1
    || !value.supportedOutcomes.every((o) => (METHOD_OUTCOME_SHAPES_V1 as readonly string[]).includes(String(o)))
    || new Set(value.supportedOutcomes).size !== value.supportedOutcomes.length) return false;
  if (!Array.isArray(value.inputs) || value.inputs.length < 1 || value.inputs.length > 8) return false;
  const inputIds = new Set<string>();
  for (const input of value.inputs) {
    if (!exact(input, ["inputId", "meaning", "kind", "unit", "unitAliases", "requiredFields", "fieldAliases"])
      || !isId(input.inputId) || !boundedText(input.meaning)
      || !METHOD_INPUT_KINDS_V1.includes(input.kind as MethodInputKindV1)) return false;
    const kind = input.kind as MethodInputKindV1;
    if (kind === "number") {
      if (typeof input.unit !== "string" || input.unit.length < 2 || input.unit.length > 16) return false;
      if (!Array.isArray(input.unitAliases) || input.unitAliases.length < 1 || input.unitAliases.length > 8) return false;
      if (!input.unitAliases.every((a) => exact(a, ["alias", "factorToCanonical"])
        && boundedText(a.alias, 16) && typeof a.factorToCanonical === "number"
        && Number.isFinite(a.factorToCanonical) && (a.factorToCanonical as number) > 0)) return false;
      if (input.unitAliases.some((a) => a.alias === input.unit && a.factorToCanonical !== 1)) return false;
      if (!Array.isArray(input.requiredFields) || input.requiredFields.length !== 0) return false;
      if (!validateFieldAliases(input.fieldAliases)) return false;
    } else {
      if (input.unit !== null) return false;
      if (!Array.isArray(input.unitAliases) || input.unitAliases.length !== 0) return false;
      if (!Array.isArray(input.requiredFields) || input.requiredFields.length < 1 || input.requiredFields.length > 16) return false;
      if (!input.requiredFields.every((f) => (exact(f, ["field", "nullable"]) || exact(f, ["field", "meaningKey", "nullable"]))
        && boundedText(f.field, 40) && /^[a-z][a-zA-Z0-9]{1,31}$/.test(String(f.field)) && typeof f.nullable === "boolean"
        && (f.meaningKey === undefined || (typeof f.meaningKey === "string" && /^[A-Z][A-Z0-9_]{1,39}$/.test(f.meaningKey))))) return false;
      if (new Set(input.requiredFields.map((f) => f.field)).size !== input.requiredFields.length) return false;
      if (!validateFieldAliases(input.fieldAliases)) return false;
    }
    if (inputIds.has(input.inputId)) return false;
    inputIds.add(input.inputId);
  }
  if (!Array.isArray(value.outputs) || value.outputs.length < 1 || value.outputs.length > 4) return false;
  if (!value.outputs.every((o) => exact(o, ["outputId", "meaning"]) && isId(o.outputId) && boundedText(o.meaning))) return false;
  if (!Array.isArray(value.preconditions) || value.preconditions.length > 16
    || !value.preconditions.every((p) => boundedText(p))) return false;
  if (!Array.isArray(value.knowledgeRefs) || value.knowledgeRefs.length < 1 || value.knowledgeRefs.length > 16) return false;
  const refIds = new Set<string>();
  for (const ref of value.knowledgeRefs) {
    if (!exact(ref, ["ref", "kind", "staleAfterMs"]) || !isId(ref.ref)
      || !["REQUIRED", "SUPPORTING"].includes(String(ref.kind)) || refIds.has(ref.ref)) return false;
    if (!Number.isSafeInteger(ref.staleAfterMs) || (ref.staleAfterMs as number) < 1) return false;
    if (ref.kind === "REQUIRED" && (ref.staleAfterMs as number) < 60_000) return false;
    refIds.add(ref.ref);
  }
  if (!value.knowledgeRefs.some((r) => r.kind === "REQUIRED")) return false;
  if (!isDigest(value.specDigest)) return false;
  return methodSpecDigestV1(value) === value.specDigest;
}

export function validateMethodSelectionV1(value: unknown): value is MethodSelectionV1 {
  if (!exact(value, ["schemaVersion", "goal", "goalDigest", "candidates", "outcome", "selected", "rejected", "authorityBoundary", "selectionDigest"])) return false;
  if (value.schemaVersion !== METHOD_SELECTION_SCHEMA_V1 || !validateMethodGoalV1(value.goal)
    || methodGoalDigestV1(value.goal as MethodGoalV1) !== value.goalDigest
    || !isDigest(value.goalDigest)) return false;
  if (value.authorityBoundary !== METHOD_AUTHORITY_BOUNDARY_V1) return false;
  if (!Array.isArray(value.candidates) || value.candidates.length < 1 || value.candidates.length > 16) return false;
  if (!value.candidates.every((c) => exact(c, ["methodId", "specDigest", "version"])
    && isId(c.methodId) && isDigest(c.specDigest) && boundedText(c.version, 40))) return false;
  if (!["SELECTED", "NO_MATCH", "UNKNOWN"].includes(String(value.outcome))) return false;
  const candidateSet = new Set(value.candidates.map((c) => c.methodId));
  if (value.selected !== null) {
    if (!exact(value.selected, ["methodId", "specDigest", "version", "reasons"])
      || !isId(value.selected.methodId) || !isDigest(value.selected.specDigest)
      || !boundedText(value.selected.version, 40) || !Array.isArray(value.selected.reasons)
      || !value.selected.reasons.every((r) => boundedText(r, 64))
      || !candidateSet.has(value.selected.methodId)) return false;
    if (!value.selected.reasons.includes("OUTCOME_MATCHED")) return false;
    if (!value.selected.reasons.includes("INTENTION_MATCHED")) return false;
  }
  if (!Array.isArray(value.rejected)) return false;
  if (!value.rejected.every((r) => exact(r, ["methodId", "specDigest", "version", "reasons"])
    && isId(r.methodId) && isDigest(r.specDigest) && boundedText(r.version, 40)
    && Array.isArray(r.reasons) && r.reasons.length >= 1
    && r.reasons.every((x) => ["OUTCOME_MISMATCH", "DUPLICATE_MATCH", "INTENTION_MATCHED", "INTENTION_MISMATCH", "INTENTION_UNRESOLVED", "CONSTRAINT_CONFLICT", "REQUIRED_KNOWLEDGE_ABSENT", "REQUIRED_KNOWLEDGE_CONFLICT", "STALE_KNOWLEDGE", "SPEC_DIGEST_MISMATCH", "SCHEMA_DENIED"].includes(String(x))))) return false;
  if (value.outcome === "SELECTED" && value.selected === null) return false;
  if (value.outcome !== "SELECTED" && value.selected !== null) return false;
  return methodSelectionDigestV1(value) === value.selectionDigest;
}

export function validateMethodGoalV1(value: unknown): value is MethodGoalV1 {
  if (!exact(value, ["schemaVersion", "goalId", "actor", "objective", "requestedOutcome", "constraints"])) return false;
  if (value.schemaVersion !== METHOD_GOAL_SCHEMA_V1 || !isId(value.goalId) || !isId(value.actor)
    || !boundedText(value.objective, 200)
    || !METHOD_OUTCOME_SHAPES_V1.includes(value.requestedOutcome as MethodOutcomeShapeV1)) return false;
  return Array.isArray(value.constraints) && value.constraints.length <= 16
    && value.constraints.every((c) => boundedText(c));
}

export function validateContextMappingV1(value: unknown): value is ContextMappingV1 {
  if (!exact(value, ["schemaVersion", "mappingId", "methodId", "specDigest", "contextId", "sourceFormat", "fieldMappings", "adaptations", "openQuestions", "proposalDigest"])) return false;
  if (value.schemaVersion !== CONTEXT_MAPPING_SCHEMA_V1 || !isId(value.mappingId) || !isId(value.methodId)
    || !isDigest(value.specDigest) || !isId(value.contextId) || !boundedText(value.sourceFormat, 40)) return false;
  if (!Array.isArray(value.fieldMappings) || value.fieldMappings.length > 32) return false;
  if (!value.fieldMappings.every((m) => exact(m, ["sourceField", "specField", "conversion", "factor", "meaning"])
    && boundedText(m.sourceField, 40) && boundedText(m.specField, 40)
    && ["IDENTITY", "UNIT_FACTOR", "FIELD_RENAME", "GAP_HANDLING"].includes(String(m.conversion))
    && (m.factor === null || (typeof m.factor === "number" && Number.isFinite(m.factor) && (m.factor as number) > 0))
    && (m.conversion === "UNIT_FACTOR" ? m.factor !== null : true)
    && (m.conversion !== "IDENTITY" || m.factor === null)
    && boundedText(m.meaning))) return false;
  if (!Array.isArray(value.adaptations) || value.adaptations.length > 32) return false;
  if (!value.adaptations.every((a) => exact(a, ["kind", "detail"])
    && ["IDENTITY", "UNIT_FACTOR", "FIELD_RENAME", "GAP_HANDLING"].includes(String(a.kind)) && boundedText(a.detail))) return false;
  if (!Array.isArray(value.openQuestions) || value.openQuestions.length > 16) return false;
  if (!value.openQuestions.every((q) => exact(q, ["questionId", "field", "question", "options"])
    && isId(q.questionId) && boundedText(q.field, 40) && boundedText(q.question, 200)
    && Array.isArray(q.options) && q.options.length >= 1 && q.options.length <= 8
    && q.options.every((o) => boundedText(o, 80)))) return false;
  if (!isDigest(value.proposalDigest)) return false;
  return contextMappingDigestV1(value) === value.proposalDigest;
}

export function validateUserDecisionV1(value: unknown): value is UserDecisionV1 {
  if (!exact(value, ["schemaVersion", "decisionId", "actor", "subjectKind", "proposalDigest", "verdict", "decidedAtMs", "decisionDigest"])) return false;
  if (value.schemaVersion !== USER_DECISION_SCHEMA_V1 || !isId(value.decisionId) || !isId(value.actor)
    || !["METHOD_SELECTION", "CONTEXT_MAPPING", "EXECUTION"].includes(String(value.subjectKind))
    || !isDigest(value.proposalDigest) || !["CONFIRMED", "REJECTED"].includes(String(value.verdict))
    || !safeInt(value.decidedAtMs) || !isDigest(value.decisionDigest)) return false;
  return userDecisionDigestV1(value) === value.decisionDigest;
}

/* ------------------------------------------------------------------ */
/* deterministic selection engine                                      */
/* ------------------------------------------------------------------ */

export type KnowledgeStateV1 = "OK" | "ABSENT" | "CONFLICT" | "STALE" | "TAMPERED";
export interface KnowledgeResolutionV1 {
  /** ref id -> resolved epistemic state; only refs cited by candidates are resolved. */
  readonly states: Readonly<Record<string, KnowledgeStateV1>>;
}

const REASON_FOR_STATE: Record<Exclude<KnowledgeStateV1, "OK">, MethodSelectionReasonV1> = {
  ABSENT: "REQUIRED_KNOWLEDGE_ABSENT",
  CONFLICT: "REQUIRED_KNOWLEDGE_CONFLICT",
  STALE: "STALE_KNOWLEDGE",
  TAMPERED: "SPEC_DIGEST_MISMATCH",
};

/**
 * Deterministic candidate evaluation. Never invents suitability:
 * - a candidate is SELECTED only on an exact closed-rule outcome match plus
 *   all REQUIRED knowledge refs OK (present, conflict-free, fresh, digest-bound);
 * - every other outcome is a named denial; zero applicable candidates is
 *   NO_MATCH; REQUIRED knowledge absent/conflicting/stale/tampered makes the
 *   candidate UNKNOWN (overall UNKNOWN when no candidate is selected).
 */
export function selectMethodsV1(args: {
  readonly goal: MethodGoalV1;
  readonly candidates: readonly MethodSpecV1[];
  readonly knowledge: KnowledgeResolutionV1;
}): MethodSelectionV1 {
  if (!validateMethodGoalV1(args.goal) || args.candidates.length < 1 || args.candidates.length > 16) {
    throw new Error("METHOD_GOAL_OR_CANDIDATES_DENIED");
  }
  for (const candidate of args.candidates) {
    if (!validateMethodSpecV1(candidate)) throw new Error("METHOD_SPEC_DENIED");
  }
  const goalDigest = methodGoalDigestV1(args.goal);
  const intention = methodIntentionForGoalV1(args.goal);
  const constraintConflict = (methodId: string): boolean =>
    METHOD_GOAL_CONSTRAINT_CONFLICTS_V1[methodId]?.some((conflict) =>
      args.goal.constraints.some((c) => c === conflict)) ?? false;
  const rejected: { readonly methodId: string; readonly specDigest: string; readonly version: string; readonly reasons: readonly MethodSelectionReasonV1[] }[] = [];
  let selected: MethodSelectionV1["selected"] = null;
  let anyKnowledgeProblem = false;
  for (const candidate of args.candidates) {
    const reasons = new Set<MethodSelectionReasonV1>();
    let hardDenial = false;
    if (candidate.supportedOutcomes.includes(args.goal.requestedOutcome)) reasons.add("OUTCOME_MATCHED");
    else { reasons.add("OUTCOME_MISMATCH"); hardDenial = true; }
    if (intention === "unknown") { reasons.add("INTENTION_UNRESOLVED"); hardDenial = true; }
    else if (!methodSupportsIntentionV1(candidate.methodId, intention)) { reasons.add("INTENTION_MISMATCH"); hardDenial = true; }
    else reasons.add("INTENTION_MATCHED");
    if (intention !== "unknown" && methodSupportsIntentionV1(candidate.methodId, intention)
      && candidate.supportedOutcomes.includes(args.goal.requestedOutcome)
      && constraintConflict(candidate.methodId)) { reasons.add("CONSTRAINT_CONFLICT"); hardDenial = true; }
    for (const ref of candidate.knowledgeRefs) {
      if (ref.kind !== "REQUIRED") continue;
      const state = args.knowledge.states[ref.ref];
      if (state === undefined || state === "ABSENT") { reasons.add(REASON_FOR_STATE.ABSENT); hardDenial = true; }
      else if (state !== "OK") { reasons.add(REASON_FOR_STATE[state]); hardDenial = true; }
    }
    if (hardDenial) {
      anyKnowledgeProblem = anyKnowledgeProblem || [...reasons].some((r) =>
        r === "REQUIRED_KNOWLEDGE_ABSENT" || r === "REQUIRED_KNOWLEDGE_CONFLICT"
        || r === "STALE_KNOWLEDGE" || r === "SPEC_DIGEST_MISMATCH");
      rejected.push({ methodId: candidate.methodId, specDigest: candidate.specDigest, version: candidate.version, reasons: [...reasons].sort() });
      continue;
    }
    if (selected === null) {
      selected = { methodId: candidate.methodId, specDigest: candidate.specDigest, version: candidate.version, reasons: [...reasons].sort() };
    } else {
      reasons.add("DUPLICATE_MATCH");
      rejected.push({ methodId: candidate.methodId, specDigest: candidate.specDigest, version: candidate.version, reasons: [...reasons].sort() });
    }
  }
  const unsigned = {
    schemaVersion: METHOD_SELECTION_SCHEMA_V1,
    goal: args.goal,
    goalDigest,
    candidates: args.candidates.map((c) => ({ methodId: c.methodId, specDigest: c.specDigest, version: c.version })),
    outcome: selected !== null ? "SELECTED" : intention === "unknown" ? "UNKNOWN" : anyKnowledgeProblem ? "UNKNOWN" : "NO_MATCH",
    selected,
    rejected,
    authorityBoundary: METHOD_AUTHORITY_BOUNDARY_V1,
  } satisfies Omit<MethodSelectionV1, "selectionDigest">;
  return { ...unsigned, selectionDigest: methodSelectionDigestV1(unsigned) };
}

/* ------------------------------------------------------------------ */
/* deterministic margin-threshold evaluator (the one Fachmethode)      */
/* ------------------------------------------------------------------ */

export const MARGIN_THRESHOLD_METHOD_ID = "method:margin-threshold-v1" as const;
export const MARGIN_THRESHOLD_FAMILY_ID = "family:invoice-margin-v1" as const;

export interface MarginInvoiceRecordV1 {
  readonly invoiceId: string;
  readonly orderId: string;
  readonly customerId: string | null;
  /** Normalized to integer minor units (cent) of the canonical EUR. */
  readonly totalMinor: number;
  readonly currency: "EUR";
  readonly dueDate: string;
}

export interface MarginInputsV1 {
  readonly invoices: readonly MarginInvoiceRecordV1[];
  /** Canonical threshold in EUR (unit of the number input "margin-floor"). */
  readonly marginFloorEur: number;
}

export function validateMarginInputsV1(value: unknown): value is MarginInputsV1 {
  if (!record(value) || !exact(value, ["invoices", "marginFloorEur"])) return false;
  if (!Array.isArray(value.invoices) || value.invoices.length < 1 || value.invoices.length > 1024) return false;
  const ids = new Set<string>();
  for (const row of value.invoices) {
    if (!exact(row, ["invoiceId", "orderId", "customerId", "totalMinor", "currency", "dueDate"])
      || !isId(row.invoiceId) || !isId(row.orderId)
      || (row.customerId !== null && !isId(row.customerId))
      || !Number.isSafeInteger(row.totalMinor) || (row.totalMinor as number) < 0
      || row.currency !== "EUR" || !isoDate(row.dueDate) || ids.has(row.invoiceId)) return false;
    ids.add(row.invoiceId);
  }
  return typeof value.marginFloorEur === "number" && Number.isFinite(value.marginFloorEur) && (value.marginFloorEur as number) >= 0;
}

/**
 * Deterministic rule execution. Identical inputs always produce identical
 * results; the receipt is a digest over the exact bound inputs and decision.
 * No model, no sampling, no free text beyond closed reason codes.
 */
export function executeMarginThresholdV1(args: {
  readonly spec: MethodSpecV1;
  readonly inputs: MarginInputsV1;
  readonly contextId: string;
  readonly contextDigest: string;
  readonly decision: UserDecisionV1;
}): MethodExecutionReceiptV1 {
  const denial = (denialReasons: string[]): MethodExecutionReceiptV1 => {
    const unsigned = {
      schemaVersion: METHOD_EXECUTION_RECEIPT_SCHEMA_V1,
      outcome: "DENIED" as const,
      denialReasons,
      ruleProvenance: "DETERMINISTIC_RULES" as const,
      methodId: args.spec.methodId,
      specDigest: args.spec.specDigest,
      version: args.spec.version,
      contextId: args.contextId,
      contextDigest: args.contextDigest,
      inputDigest: sha(args.inputs),
      decisionDigest: sha(args.decision),
      result: null,
      authorityBoundary: METHOD_AUTHORITY_BOUNDARY_V1,
    } satisfies Omit<MethodExecutionReceiptV1, "receiptDigest">;
    return { ...unsigned, receiptDigest: methodExecutionReceiptDigestV1(unsigned) };
  };
  if (!validateMethodSpecV1(args.spec) || args.spec.methodId !== MARGIN_THRESHOLD_METHOD_ID) {
    return denial(["SPEC_DIGEST_MISMATCH"]);
  }
  if (!validateMarginInputsV1(args.inputs)) return denial(["INPUT_SCHEMA_DENIED"]);
  if (!validateUserDecisionV1(args.decision) || args.decision.verdict !== "CONFIRMED") {
    return denial(["DECISION_MISSING_OR_REJECTED"]);
  }
  if (args.decision.subjectKind !== "EXECUTION") return denial(["DECISION_SUBJECT_MISMATCH"]);
  const inputDigest = sha(args.inputs);
  if (args.decision.proposalDigest !== inputDigest) return denial(["DECISION_DOES_NOT_BIND_INPUTS"]);
  const thresholdMinor = Math.round(args.inputs.marginFloorEur * 100);
  const flagged: FlaggedInvoiceResultV1[] = [];
  let totalInputMinor = 0;
  for (const invoice of args.inputs.invoices) {
    totalInputMinor += invoice.totalMinor;
    if (invoice.totalMinor < thresholdMinor) {
      flagged.push({
        recordId: invoice.invoiceId,
        valueMinor: invoice.totalMinor,
        reason: invoice.customerId === null ? "BELOW_THRESHOLD_CUSTOMER_UNKNOWN" : "BELOW_THRESHOLD",
      });
    }
  }
  const unsigned = {
    schemaVersion: METHOD_EXECUTION_RECEIPT_SCHEMA_V1,
    outcome: "EXECUTED" as const,
    denialReasons: [] as readonly string[],
    ruleProvenance: "DETERMINISTIC_RULES" as const,
    methodId: args.spec.methodId,
    specDigest: args.spec.specDigest,
    version: args.spec.version,
    contextId: args.contextId,
    contextDigest: args.contextDigest,
    inputDigest,
    decisionDigest: sha(args.decision),
    result: {
      outputId: "output:flagged-invoices-v1",
      flagged,
      count: flagged.length,
      totalInputMinor,
    },
    authorityBoundary: METHOD_AUTHORITY_BOUNDARY_V1,
  } satisfies Omit<MethodExecutionReceiptV1, "receiptDigest">;
  return { ...unsigned, receiptDigest: methodExecutionReceiptDigestV1(unsigned) };
}

/* ------------------------------------------------------------------ */
/* closed goal intention (F1/F3: output shape alone is NOT suitability)*/
/* ------------------------------------------------------------------ */

/**
 * F1/F3 — Eignung darf NIE allein aus der Ausgabeform folgen. Das Ziel wird
 * zuerst in eine geschlossene, fachliche Absicht geklärt; nur eine exakte
 * Absicht-Eintrag in der geschlossenen Tabelle der Methode begründet Eignung.
 * Ausgabeform (requestedOutcome) bleibt Teil der Prüfung, ist aber nicht
 * hinreichend: ein "FLAG_RECORDS"-Ziel ohne Absicht "unter Mindestgrenzwert"
 * ist für margin-threshold INKOMPATIBEL (z. B. "überfällig anhand
 * Fälligkeitsdatum markieren") und erzeugt eine Rückfrage / NO_MATCH statt
 * einer erfundenen Eignung.
 */
export const METHOD_GOAL_INTENTIONS_V1 = [
  "flag_records_below_minimum_threshold",
  "flag_records_by_due_date",
  "sum_total_amounts",
  "unknown",
] as const;
export type MethodGoalIntentionV1 = (typeof METHOD_GOAL_INTENTIONS_V1)[number];

/**
 * Deterministic closed-table resolution of the goal's fachliche Absicht from
 * its EXACT objective (boundedText, no free-form NLP). Unknown/ambiguous
 * objectives resolve to "unknown" — the selection then yields a Rückfrage
 * (goal clarification) or NO_MATCH/UNKNOWN, never an invented match.
 */
export const METHOD_GOAL_OBJECTIVE_INTENTIONS_V1: ReadonlyArray<readonly [string, MethodGoalIntentionV1]> = [
  ["Rechnungen unterhalb eines Mindestgrenzwerts pruefen und markieren", "flag_records_below_minimum_threshold"],
  ["Summe der Gesamtbetraege aller Rechnungen eines Datenkontexts berechnen", "sum_total_amounts"],
  // Existing KTS-01 library-test objective (COMPUTE_TOTAL goal); bound here
  // so the reference method stays selectable without inventing suitability.
  ["Gesamtbetraege aller Rechnungen eines Datenkontexts summieren", "sum_total_amounts"],
];

/**
 * Closed table of goal constraints that CONTRADICT a method's sealed
 * preconditions (deterministic exact-match, no free-text similarity): a goal
 * that resolves to the method's intention but carries a contradicting closed
 * constraint is INKOMPATIBEL (CONSTRAINT_CONFLICT) — never silently selected.
 */
export const METHOD_GOAL_CONSTRAINT_CONFLICTS_V1: Readonly<Record<string, readonly string[]>> = {
  "method:margin-threshold-v1": ["Keine Betragsgrenzwertpruefung", "Ohne Nutzerbestaetigung des Grenzwerts ausfuhren"],
  "method:invoice-total-v1": ["Ohne Rechnungsbelege ausfuhren"],
};

export function methodIntentionForGoalV1(goal: MethodGoalV1): MethodGoalIntentionV1 {
  const match = METHOD_GOAL_OBJECTIVE_INTENTIONS_V1.find((entry) => entry[0] === goal.objective);
  return match?.[1] ?? "unknown";
}

/**
 * Whether a candidate method supports the goal's resolved intention. The
 * closed support table is per-methodId (sealed specs only):
 * - margin-threshold: flags records BELOW a user-confirmed minimum threshold
 *   (amount-based; NOT due-date/overdue logic);
 * - invoice-total: computes the total of all amounts.
 */
export const METHOD_INTENTION_SUPPORT_V1: Readonly<Record<string, readonly MethodGoalIntentionV1[]>> = {
  "method:margin-threshold-v1": ["flag_records_below_minimum_threshold"],
  "method:invoice-total-v1": ["sum_total_amounts"],
};

export function methodSupportsIntentionV1(methodId: string, intention: MethodGoalIntentionV1): boolean {
  if (intention === "unknown") return false;
  return METHOD_INTENTION_SUPPORT_V1[methodId]?.includes(intention) ?? false;
}
