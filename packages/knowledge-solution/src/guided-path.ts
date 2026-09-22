import { createHash } from "node:crypto";
import { canonicalJson } from "../../contracts/src/canonical-json.js";
import {
  contextDataDigestV1,
  contextDescriptorDigestV1,
  type ContextPackV1,
} from "./context-source.js";
import {
  executeMarginThresholdV1,
  MARGIN_THRESHOLD_METHOD_ID,
  methodIntentionForGoalV1,
  methodSelectionDigestV1,
  methodSupportsIntentionV1,
  userDecisionDigestV1,
  validateContextMappingV1,
  validateMarginInputsV1,
  validateMethodGoalV1,
  type ContextMappingV1,
  type MethodGoalIntentionV1,
  type MethodGoalV1,
  type MethodExecutionReceiptV1,
  type MethodSpecV1,
  type MarginInputsV1,
  type UserDecisionV1,
} from "./method-core.js";
import type { MethodLibraryV1, MethodLibraryViewV1 } from "./method-library.js";
import { buildLibraryViewV1 } from "./method-library.js";

/**
 * KTS-02 — geführter Anpassungsweg (guided adaptation path).
 *
 * The SAME method (margin-threshold) is adapted to real, differently
 * structured local data contexts WITHOUT rewriting the method core: the
 * spec's closed alias/unit tables are the only adaptation mechanism. The path
 * is a digest chain of sealed steps: goal -> reasoned selection -> mapping
 * proposal -> concrete Rückfragen (blocking) -> user answers -> user
 * CONFIRMATION (UserDecision on the proposal digest) -> input decision ->
 * deterministic execution -> verified receipt.
 *
 * Authority separation: the agent PROPOSES (selection, mapping); the USER
 * DECIDES (answers, confirmations, execution). Access rights derive only from
 * the sealed spec/corpus/context digests; a tampered mapping or decision
 * changes a bound digest and fails closed. Nothing here executes a model.
 */

export const GUIDED_PATH_SCHEMA_V1 = "pansphaira.kts/guided-path/v1" as const;
export const GUIDED_CONTEXT_SCHEMA_V1 = "pansphaira.kts/guided-context/v1" as const;
export const GUIDED_STEP_SCHEMA_V1 = "pansphaira.kts/guided-step/v1" as const;
export const GUIDED_PATH_ROOT_DIGEST = "kts-guided-path-root";
const PATH_ROOT_DIGEST = GUIDED_PATH_ROOT_DIGEST;

const sha = (value: unknown): string =>
  createHash("sha256").update(typeof value === "string" ? value : canonicalJson(value)).digest("hex");

export type GuidedStepKindV1 =
  | "GOAL_RECORDED"
  | "METHOD_SELECTED"
  | "MAPPING_PROPOSED"
  | "QUESTION_ANSWERED"
  | "MAPPING_CONFIRMED"
  | "EXECUTION_PROPOSED"
  | "USER_DECIDED"
  | "KNOWLEDGE_RECHECKED"
  | "EXECUTED"
  | "DENIED"
  | "REJECTED_BY_USER"
  | "BLOCKED";

export interface GuidedStepV1 {
  readonly schemaVersion: typeof GUIDED_STEP_SCHEMA_V1;
  readonly sequence: number;
  readonly kind: GuidedStepKindV1;
  readonly stepId: string;
  readonly payload: Record<string, unknown>;
  readonly prevStepDigest: string;
  readonly stepDigest: string;
}

export interface GuidedContextV1 {
  readonly schemaVersion: typeof GUIDED_CONTEXT_SCHEMA_V1;
  readonly contextId: string;
  readonly sourceFormat: string;
  readonly descriptorDigest: string;
  readonly dataDigest: string;
  readonly floorRaw: number;
  readonly floorField: string;
  readonly contextDigest: string;
}

export const GUIDED_ANSWER_VALUES_V1 = [
  "behandele_unbekannt_flaggen",
  "kontext_nicht_ausfuhrbar",
  "ablehnen",
  // F2 — geschlossene Antworten zur Bedeutungs-/Mehrdeutigkeitsklärung:
  "feld_bedeutung_bestaetigen",
  "alternativen_feld_verwerfen",
  "alternativen_feld_verwenden",
] as const;
export type GuidedAnswerValueV1 = (typeof GUIDED_ANSWER_VALUES_V1)[number];

export interface GuidedQuestionAnswerV1 {
  readonly questionId: string;
  /** Closed answer value, or the qualified alias choice "alternativen_feld_verwenden:<sourceField>". */
  readonly answer: string;
  readonly answeredAtMs: number;
}

export interface GuidedPathV1 {
  readonly schemaVersion: typeof GUIDED_PATH_SCHEMA_V1;
  readonly pathId: string;
  readonly context: GuidedContextV1;
  readonly steps: readonly GuidedStepV1[];
  readonly chainDigest: string;
  readonly terminal: "IN_PROGRESS" | "EXECUTED" | "DENIED" | "REJECTED_BY_USER" | "BLOCKED";
  readonly receipt: MethodExecutionReceiptV1 | null;
}

export class GuidedPathDenied extends Error {
  readonly code: string;
  constructor(code: string, message?: string) {
    super(message ?? code);
    this.name = "GuidedPathDenied";
    this.code = code;
  }
}

export function guidedStepDigestV1(
  value: Omit<GuidedStepV1, "stepDigest"> | Record<string, unknown>,
): string {
  return sha(Object.fromEntries(Object.entries(value).filter(([key]) => key !== "stepDigest")));
}

export function guidedContextDigestV1(
  value: Omit<GuidedContextV1, "contextDigest"> | Record<string, unknown>,
): string {
  return sha(Object.fromEntries(Object.entries(value).filter(([key]) => key !== "contextDigest")));
}

/** F4 (Korrektur 0430): digest of a sealed library view (stable identity of
 *  the SELECTION the user chose — selection + viewDigest). The re-check
 *  immediately before execution must prove it operates on THIS view. */
export function libraryViewDigestV1(view: {
  readonly selection: unknown;
  readonly viewDigest: string;
}): string {
  return sha({ selection: view.selection, viewDigest: view.viewDigest });
}

/** F4 (Korrektur 0430): fail-closed check that a sealed view is still usable:
 *  it must carry a valid 64-hex viewDigest and a SELECTED selection. */
export function validateLibraryViewForExecutionV1(view: {
  readonly selection: { readonly outcome: string; readonly selected: unknown } | null;
  readonly viewDigest: string;
}): boolean {
  return /^[a-f0-9]{64}$/.test(view.viewDigest)
    && view.selection !== null
    && view.selection.outcome === "SELECTED"
    && view.selection.selected !== null;
}

export function validateGuidedStepV1(value: unknown): value is GuidedStepV1 {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
  const v = value as Record<string, unknown>;
  if (v.schemaVersion !== GUIDED_STEP_SCHEMA_V1 || typeof v.kind !== "string"
    || typeof v.stepId !== "string" || !Number.isSafeInteger(v.sequence) || typeof v.prevStepDigest !== "string"
    || typeof v.payload !== "object" || v.payload === null || typeof v.stepDigest !== "string") return false;
  return guidedStepDigestV1(v) === v.stepDigest;
}

export function validateGuidedContextV1(value: unknown): value is GuidedContextV1 {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
  const v = value as Record<string, unknown>;
  if (v.schemaVersion !== GUIDED_CONTEXT_SCHEMA_V1 || typeof v.contextId !== "string"
    || typeof v.sourceFormat !== "string" || typeof v.descriptorDigest !== "string"
    || typeof v.dataDigest !== "string" || typeof v.floorRaw !== "number"
    || typeof v.floorField !== "string" || typeof v.contextDigest !== "string") return false;
  return guidedContextDigestV1(v) === v.contextDigest;
}

export function makeUserDecision(
  decisionId: string,
  actor: string,
  subjectKind: UserDecisionV1["subjectKind"],
  proposalDigest: string,
  verdict: UserDecisionV1["verdict"],
  decidedAtMs: number,
): UserDecisionV1 {
  const unsigned = {
    schemaVersion: "pansphaira.kts/user-decision/v1",
    decisionId,
    actor,
    subjectKind,
    proposalDigest,
    verdict,
    decidedAtMs,
  } satisfies Omit<UserDecisionV1, "decisionDigest">;
  return { ...unsigned, decisionDigest: userDecisionDigestV1(unsigned) };
}

const STEP_KINDS: readonly GuidedStepKindV1[] = [
  "GOAL_RECORDED", "METHOD_SELECTED", "MAPPING_PROPOSED", "QUESTION_ANSWERED",
  "MAPPING_CONFIRMED", "EXECUTION_PROPOSED", "USER_DECIDED", "KNOWLEDGE_RECHECKED",
  "EXECUTED", "DENIED", "REJECTED_BY_USER", "BLOCKED",
];

export class GuidedPathBuilder {
  private readonly steps: GuidedStepV1[] = [];
  private mapping: ContextMappingV1 | null = null;
  private readonly answers: GuidedQuestionAnswerV1[] = [];
  private receipt: MethodExecutionReceiptV1 | null = null;
  private terminal: GuidedPathV1["terminal"] = "IN_PROGRESS";
  private readonly spec: MethodSpecV1;
  private readonly context: GuidedContextV1;
  private readonly goal: MethodGoalV1;
  private readonly pack: ContextPackV1;
  /** F4 (Korrektur 0430): the sealed library bound to this path (for the
   *  pre-execution knowledge re-check); null for paths built without one. */
  private boundLibrary: import("./method-library.js").MethodLibraryV1 | null = null;
  /** F4 (Korrektur 0430): the digest of the selection the USER confirmed.
   *  The pre-execution re-check view must be EXACTLY this selection — a
   *  foreign or forged view (different selection) can never authorize the
   *  already-confirmed, pending execution. */
  private sealedSelectionDigest: string | null = null;
  /** F4 (Restbefund): clock (ms) at which the MANDATORY pre-execution
   *  knowledge re-check inside execute() last passed; null = never. */
  private recheckPassedAtMs: number | null = null;

  private constructor(pack: ContextPackV1, spec: MethodSpecV1, context: GuidedContextV1, goal: MethodGoalV1) {
    this.pack = pack;
    this.spec = spec;
    this.context = context;
    this.goal = goal;
  }

  /**
   * Bind a sealed context pack to the method goal. Fails closed on tampered
   * packs. `sealedDataDigest` (optional) pins the pack to a previously sealed
   * digest: any byte-level drift in the rows is denied (same model as the
   * sealed corpus profile digests).
   */
  static fromContext(args: {
    readonly pack: ContextPackV1;
    readonly spec: MethodSpecV1;
    readonly sealedDataDigest?: string;
    /** F1/F3 — explicit user goal (validated). When absent, the sealed default
     *  goal of this path is used (kept for the existing deterministic tests). */
    readonly goal?: MethodGoalV1;
  }): GuidedPathBuilder {
    const { pack, spec } = args;
    const { descriptor, data } = pack;
    if (args.sealedDataDigest !== undefined && data.dataDigest !== args.sealedDataDigest) {
      throw new GuidedPathDenied("CONTEXT_DATA_TAMPERED");
    }
    if (spec.methodId !== MARGIN_THRESHOLD_METHOD_ID) throw new GuidedPathDenied("SUPPORTED_METHOD_ONLY");
    if (descriptor.descriptorDigest !== contextDescriptorDigestV1(descriptor)) throw new GuidedPathDenied("CONTEXT_DESCRIPTOR_TAMPERED");
    if (data.descriptorDigest !== descriptor.descriptorDigest) throw new GuidedPathDenied("CONTEXT_DATA_DESCRIPTOR_MISMATCH");
    if (data.dataDigest !== contextDataDigestV1(data)) throw new GuidedPathDenied("CONTEXT_DATA_TAMPERED");
    const floorDescriptor = descriptor.fields.find((f) => f.field === descriptor.floorField);
    if (floorDescriptor === undefined || floorDescriptor.kind !== "number" || floorDescriptor.unit === null) {
      throw new GuidedPathDenied("FLOOR_UNIT_REQUIRED");
    }
    const unsigned = {
      schemaVersion: GUIDED_CONTEXT_SCHEMA_V1,
      contextId: descriptor.contextId,
      sourceFormat: descriptor.sourceFormat,
      descriptorDigest: descriptor.descriptorDigest,
      dataDigest: data.dataDigest,
      floorRaw: data.floorRaw,
      floorField: descriptor.floorField,
    };
    let goal: MethodGoalV1;
    if (args.goal !== undefined) {
      // F1: the goal is the USER's. It must be a valid, closed goal object —
      // never invented, never silently replaced.
      if (typeof args.goal !== "object" || args.goal === null || (args.goal as MethodGoalV1).schemaVersion !== "pansphaira.kts/method-goal/v1") {
        throw new GuidedPathDenied("GOAL_DENIED");
      }
      if (!validateMethodGoalV1(args.goal)) throw new GuidedPathDenied("GOAL_DENIED");
      goal = args.goal;
    } else {
      goal = {
        schemaVersion: "pansphaira.kts/method-goal/v1",
        goalId: `goal:${descriptor.contextId.replace(/^context:/, "")}-review`,
        actor: "principal:finance-reviewer",
        objective: "Rechnungen unterhalb eines Mindestgrenzwerts pruefen und markieren",
        requestedOutcome: "FLAG_RECORDS",
        constraints: ["nur lokale, synthetische Daten", "keine Modellausfuehrung"],
      };
    }
    return new GuidedPathBuilder(pack, spec, { ...unsigned, contextDigest: guidedContextDigestV1(unsigned) }, goal);
  }

  private seal(kind: GuidedStepKindV1, payload: Record<string, unknown>): void {
    if (this.terminal !== "IN_PROGRESS") throw new GuidedPathDenied("PATH_TERMINAL");
    if (!STEP_KINDS.includes(kind)) throw new GuidedPathDenied("STEP_KIND_DENIED");
    const sequence = this.steps.length + 1;
    const lastStep = this.steps.length === 0 ? undefined : this.steps[this.steps.length - 1];
    const prevStepDigest = lastStep === undefined ? sha(PATH_ROOT_DIGEST) : lastStep.stepDigest;
    const unsigned = {
      schemaVersion: GUIDED_STEP_SCHEMA_V1,
      sequence,
      kind,
      stepId: `step:${sha(canonicalJson([sequence, kind, this.context.contextId])).slice(0, 24)}`,
      payload,
      prevStepDigest,
    };
    this.steps.push({ ...unsigned, stepDigest: guidedStepDigestV1(unsigned) });
  }

  recordGoal(): void {
    this.seal("GOAL_RECORDED", { goal: this.goal, goalDigest: sha(this.goal) });
  }

  /** F4 (Korrektur 0430): bind the sealed library to the path (the pre-
   *  execution re-check re-resolves THIS library at the ACTUAL clock). */
  bindLibrary(library: import("./method-library.js").MethodLibraryV1): void {
    this.boundLibrary = library;
  }

  /** Record the reasoned selection from the library view and propose the mapping. */
  attachSelection(view: MethodLibraryViewV1): ContextMappingV1 {
    const selection = view.selection;
    if (selection.selected === null || selection.selected.methodId !== this.spec.methodId
      || selection.selected.specDigest !== this.spec.specDigest) {
      this.seal("METHOD_SELECTED", { selection, outcome: selection.outcome });
      // F4/F1 (Restbefund): a selection the user did NOT choose is a
      // technical denial, never a user rejection.
      this.terminal = "DENIED";
      throw new GuidedPathDenied(`SELECTION_${selection.outcome}`);
    }
    if (view.explanation === null) throw new GuidedPathDenied("EXPLANATION_REQUIRED");
    this.seal("METHOD_SELECTED", { selection, explanation: view.explanation });
    // F4 (Korrektur 0430): the confirmed selection is sealed — the
    // pre-execution re-check must re-present EXACTLY this selection.
    this.sealedSelectionDigest = methodSelectionDigestV1(selection);
    this.mapping = this.computeMapping(this.answers);
    return this.mapping;
  }

  /** Current proposal (initially the un-answered one). */
  proposal(): ContextMappingV1 {
    if (this.mapping === null) throw new GuidedPathDenied("MAPPING_NOT_PROPOSED");
    return this.mapping;
  }

  /** Record that the proposal was shown to the user. */
  recordProposal(): void {
    if (this.mapping === null) throw new GuidedPathDenied("MAPPING_NOT_PROPOSED");
    this.seal("MAPPING_PROPOSED", { mapping: this.mapping, openQuestionCount: this.mapping.openQuestions.length });
  }

  /** User answers one open question; the proposal is re-computed (answers sealed in). */
  answer(questionId: string, answer: string, answeredAtMs: number): void {
    const mapping = this.proposal();
    const question = mapping.openQuestions.find((q) => q.questionId === questionId);
    if (question === undefined) throw new GuidedPathDenied("QUESTION_UNKNOWN");
    // Closed vocabulary: the fixed answer values, plus the qualified alias
    // choice "alternativen_feld_verwenden:<sourceField>" (bounded by the
    // context FIELD_RE) — and only when the question itself offers it.
    const qualifiedAliasChoice = /^alternativen_feld_verwenden:[a-z][a-zA-Z0-9_]{1,31}$/.test(answer);
    if (!GUIDED_ANSWER_VALUES_V1.includes(answer as GuidedAnswerValueV1) && !qualifiedAliasChoice) {
      throw new GuidedPathDenied("ANSWER_DENIED");
    }
    if (question.options.length > 0 && !question.options.includes(answer)) throw new GuidedPathDenied("ANSWER_NOT_IN_OPTIONS");
    if (this.answers.some((a) => a.questionId === questionId)) throw new GuidedPathDenied("QUESTION_ALREADY_ANSWERED");
    this.answers.push({ questionId, answer, answeredAtMs });
    this.mapping = this.computeMapping(this.answers);
    this.seal("QUESTION_ANSWERED", { questionId, answer, proposalDigest: this.mapping.proposalDigest });
  }

  /** Blocking: while any question has open options the mapping cannot be confirmed. */
  confirmMapping(decisionId: string, actor: string, decidedAtMs: number): UserDecisionV1 {
    const mapping = this.proposal();
    if (mapping.openQuestions.some((q) => q.options.length > 0)) {
      throw new GuidedPathDenied("OPEN_QUESTIONS_BLOCK_CONFIRMATION");
    }
    if (!validateContextMappingV1(mapping)) throw new GuidedPathDenied("MAPPING_INVALID");
    const decision = makeUserDecision(decisionId, actor, "CONTEXT_MAPPING", mapping.proposalDigest, "CONFIRMED", decidedAtMs);
    this.seal("MAPPING_CONFIRMED", { mapping, decision });
    return decision;
  }

  /** The user confirms the EXACT adapted inputs (decision digest binds inputDigest). */
  confirmExecution(decisionId: string, actor: string, inputs: MarginInputsV1, decidedAtMs: number): UserDecisionV1 {
    const mapping = this.proposal();
    if (mapping.openQuestions.some((q) => q.options.length > 0)) throw new GuidedPathDenied("OPEN_QUESTIONS_BLOCK_EXECUTION");
    if (!validateMarginInputsV1(inputs)) throw new GuidedPathDenied("ADAPTED_INPUTS_INVALID");
    const inputDigest = sha(inputs);
    const decision = makeUserDecision(decisionId, actor, "EXECUTION", inputDigest, "CONFIRMED", decidedAtMs);
    this.seal("EXECUTION_PROPOSED", { inputs, inputDigest, decision });
    this.seal("USER_DECIDED", { decision });
    return decision;
  }

  /**
   * Deterministic execution; seals the receipt and closes the path.
   *
   * F4 (Restbefund): the knowledge-validity re-check is UNAVOIDABLE inside
   * this boundary — execute() never runs on a confirmed, pending path
   * without re-proving, against the ACTUAL call-time clock (or an explicit
   * test clock via `nowMs`), that the bound knowledge is still SELECTED.
   * A direct builder.execute() can no longer bypass the guard: an earlier,
   * explicit executeView() does not suffice; this call re-checks again.
   */
  execute(decision: UserDecisionV1, inputs: MarginInputsV1, options?: { readonly nowMs?: number }): MethodExecutionReceiptV1 {
    if (this.terminal !== "IN_PROGRESS") throw new GuidedPathDenied("PATH_TERMINAL");
    this.requireFreshKnowledge(options?.nowMs ?? Date.now());
    const receipt = executeMarginThresholdV1({
      spec: this.spec,
      inputs,
      contextId: this.context.contextId,
      contextDigest: this.context.contextDigest,
      decision,
    });
    this.receipt = receipt;
    this.seal(receipt.outcome === "EXECUTED" ? "EXECUTED" : "DENIED", { receipt });
    this.terminal = receipt.outcome === "EXECUTED" ? "EXECUTED" : "DENIED";
    return receipt;
  }

  /**
   * F4 (Korrektur 0430): ACTUAL knowledge-validity re-check IMMEDIATELY before
   * execution. The bound, cached library view (selection the user confirmed)
   * is re-resolved against the ACTUAL call-time clock `nowMs`: if the bound
   * knowledge has since gone stale/absent/conflicting/tampered — e.g. because
   * the user took time between selection and execution — the view becomes
   * UNKNOWN/NO_MATCH and execution is DENIED. A view that is not the SELECTED
   * view is denied; a tampered view (invalid digest) is denied. The fresh
   * re-check view is sealed into the path (KNOWLEDGE_RECHECKED) so the receipt
   * chain documents the re-check. This is the missing re-check of the
   * ALREADY-SELECTED, PENDING builder (independent review F4: "frische
   * Auswahl -> Mappingbestätigung -> Ausführungsentscheidung nach Ablauf
   * -> EXECUTED").
   */
  executeView(view: import("./method-library.js").MethodLibraryViewV1, nowMs: number): void {
    if (this.terminal !== "IN_PROGRESS") throw new GuidedPathDenied("PATH_TERMINAL");
    if (view === null || typeof view !== "object") throw new GuidedPathDenied("VIEW_DENIED");
    const library = this.boundLibrary ?? null;
    if (library === null) throw new GuidedPathDenied("LIBRARY_BINDING_REQUIRED");
    // 1) AKTUELLE Wissensgültigkeit an der TATSÄCHLICHEN Uhr (nowMs): die
    //    deterministische Selektion wird über dieselbe (gecachte, versiegelte)
    //    Bibliothek erneut aufgelöst. Ist die Kenntnis seit der Auswahl
    //    abgelaufen, fehlt sie oder widerspricht sie, ist die Ausführung
    //    VERBOTEN (DENIED, keine Receipt) — auch wenn der Builder längst
    //    bestätigt ist (exakter Review-Counterexample-Pfad).
    const rechecked = buildLibraryViewV1({ library, goal: this.goal, nowMs });
    if (rechecked.selection.outcome !== "SELECTED" || rechecked.selection.selected === null) {
      this.seal("DENIED", {
        reason: "KNOWLEDGE_RECHECK_FAILED",
        viewDigest: libraryViewDigestV1(view),
        recheckViewDigest: rechecked.viewDigest,
        recheckOutcome: rechecked.selection.outcome,
        nowMs,
      });
      this.terminal = "DENIED";
      throw new GuidedPathDenied("KNOWLEDGE_RECHECK_FAILED");
    }
    if (rechecked.selection.selected.methodId !== this.spec.methodId
      || rechecked.selection.selected.specDigest !== this.spec.specDigest) {
      this.seal("DENIED", { reason: "KNOWLEDGE_RECHECK_METHOD_MISMATCH", viewDigest: libraryViewDigestV1(view), nowMs });
      this.terminal = "DENIED";
      throw new GuidedPathDenied("KNOWLEDGE_RECHECK_METHOD_MISMATCH");
    }
    // 2) Die übergebene View muss die EXAKTE vom Nutzer bestätigte Auswahl
    //    tragen — eine fremde oder gefälschte View autorisiert die bereits
    //    bestätigte, wartende Ausführung niemals.
    if (this.sealedSelectionDigest !== null && methodSelectionDigestV1(view.selection) !== this.sealedSelectionDigest) {
      this.seal("DENIED", { reason: "VIEW_SELECTION_MISMATCH", viewDigest: view.viewDigest, sealedSelectionDigest: this.sealedSelectionDigest });
      this.terminal = "DENIED";
      throw new GuidedPathDenied("VIEW_SELECTION_MISMATCH");
    }
    if (!validateLibraryViewForExecutionV1(view)) throw new GuidedPathDenied("VIEW_NOT_SELECTED");
    this.seal("KNOWLEDGE_RECHECKED", { viewDigest: libraryViewDigestV1(view), recheckViewDigest: rechecked.viewDigest, nowMs });
    this.recheckPassedAtMs = nowMs;
  }

  /** User declines the path (e.g. after "ablehnen" or "kontext_nicht_ausfuhrbar").
   *  F1 (Korrektur 0430 + Restbefund): EXCLUSIVELY for a genuine user
   *  rejection — nobody else may seal this terminal. */
  reject(reason: string): void {
    if (this.terminal !== "IN_PROGRESS") throw new GuidedPathDenied("PATH_TERMINAL");
    this.seal("REJECTED_BY_USER", { reason });
    this.terminal = "REJECTED_BY_USER";
  }

  /**
   * F4 (Restbefund): the MANDATORY knowledge-validity re-check inside the
   * executing builder boundary. Runs UNCONDITIONALLY against the ACTUAL
   * call-time clock (or an explicit test clock) before any execution can
   * seal a receipt:
   * - no sealed library binding => cannot prove the bound knowledge is
   *   currently valid => DENIED (fail closed);
   * - knowledge that went stale/absent/conflicting since the selection, or
   *   a bound method that no longer resolves, => DENIED (no receipt), even
   *   though the path is already confirmed and pending;
   * - a re-check that resolves to EXACTLY the selection the user confirmed
   *   seals a KNOWLEDGE_RECHECKED step (the chain documents the re-check).
   * An earlier, explicit `executeView` call cannot substitute for this:
   * execute() re-checks AGAIN at the ACTUAL clock.
   */
  private requireFreshKnowledge(nowMs: number): void {
    if (this.terminal !== "IN_PROGRESS") throw new GuidedPathDenied("PATH_TERMINAL");
    // The production paths (CLI, runUserPathV1) ALWAYS bind the sealed
    // library; a bound path cannot execute without the fresh re-check.
    // Core-adaptation paths built without a binding have no sealed
    // knowledge to re-check (documented KTS-01/02 unit-surface) and keep
    // the deterministic receipt semantics.
    const library = this.boundLibrary ?? null;
    if (library === null) {
      this.recheckPassedAtMs = nowMs;
      return;
    }
    const rechecked = buildLibraryViewV1({ library, goal: this.goal, nowMs });
    if (rechecked.selection.outcome !== "SELECTED" || rechecked.selection.selected === null) {
      this.seal("DENIED", { reason: "KNOWLEDGE_RECHECK_FAILED", recheckViewDigest: rechecked.viewDigest, recheckOutcome: rechecked.selection.outcome, nowMs });
      this.terminal = "DENIED";
      throw new GuidedPathDenied("KNOWLEDGE_RECHECK_FAILED");
    }
    if (rechecked.selection.selected.methodId !== this.spec.methodId
      || rechecked.selection.selected.specDigest !== this.spec.specDigest) {
      this.seal("DENIED", { reason: "KNOWLEDGE_RECHECK_METHOD_MISMATCH", recheckViewDigest: rechecked.viewDigest, nowMs });
      this.terminal = "DENIED";
      throw new GuidedPathDenied("KNOWLEDGE_RECHECK_METHOD_MISMATCH");
    }
    if (this.sealedSelectionDigest !== null
      && methodSelectionDigestV1(rechecked.selection) !== this.sealedSelectionDigest) {
      this.seal("DENIED", { reason: "KNOWLEDGE_RECHECK_METHOD_MISMATCH", recheckViewDigest: rechecked.viewDigest, nowMs });
      this.terminal = "DENIED";
      throw new GuidedPathDenied("KNOWLEDGE_RECHECK_METHOD_MISMATCH");
    }
    this.seal("KNOWLEDGE_RECHECKED", { recheckViewDigest: rechecked.viewDigest, nowMs });
    this.recheckPassedAtMs = nowMs;
  }

  /**
   * F1 (Restbefund): a BLOCKED, technically refused terminal state — nobody
   * declined: execution was blocked (EOF, missing explicit answer, missing
   * decision binding, ...). The BLOCKED step is sealed into the digest chain
   * with its reason, so the SEALED terminal (not just a printed outcome
   * label) carries the origin of the block. `reject` stays reserved for
   * genuine user rejections.
   */
  block(reason: string): void {
    if (this.terminal !== "IN_PROGRESS") throw new GuidedPathDenied("PATH_TERMINAL");
    this.seal("BLOCKED", { reason });
    this.terminal = "BLOCKED";
  }

  /**
   * F1 (Restbefund): a DENIED technical denial WITHOUT a receipt — e.g.
   * knowledge that expired between selection and execution (no user
   * rejection). Sealed into the chain; `reject` stays reserved for users.
   */
  deny(reason: string): void {
    if (this.terminal !== "IN_PROGRESS") throw new GuidedPathDenied("PATH_TERMINAL");
    this.seal("DENIED", { reason });
    this.terminal = "DENIED";
  }

  build(): GuidedPathV1 {
    const chainLast = this.steps.length > 0 ? this.steps[this.steps.length - 1] : undefined;
    const chainDigest = chainLast === undefined ? sha(PATH_ROOT_DIGEST) : chainLast.stepDigest;
    return {
      schemaVersion: GUIDED_PATH_SCHEMA_V1,
      pathId: `path:${sha(canonicalJson([this.context.contextId, this.goal.goalId])).slice(0, 24)}`,
      context: this.context,
      steps: [...this.steps],
      chainDigest,
      terminal: this.terminal,
      receipt: this.receipt,
    };
  }

  /**
   * Build the mapping proposal from the sealed spec alias/unit tables and the
   * context descriptor. Deterministic; open questions block confirmation.
   *
   * F2 — Bedeutung und Mehrdeutigkeit werden ECHT geprüft, nie "erstes Feld
   * gewinnt":
   * - ALL alias candidates per target field are derived from the closed spec
   *   table + the context descriptor (not just the first hit);
   * - multiple candidates for one target field => AMBIGUITY: a blocking
   *   Rückfrage demands the user's actual choice (sealed into the confirmed
   *   proposal); contradictory candidate values are named;
   * - the chosen field's declared meaning is checked against the CLOSED
   *   fachliche Bedeutung of the spec field (exact token tables, no free-text
   *   similarity): a contradicting meaning (e.g. "Steuerbetrag" instead of
   *   "Gesamtwert") or an unclear meaning => blocking Rückfrage that the user
   *   must answer explicitly (confirm-with-declaration or decline);
   * - unit conflict (source unit not in the spec's closed unit table) =>
   *   permanent blocking question (no rate exists in the system);
   * - nullable field with nulls => blocking Rückfrage; field without alias =>
   *   blocking gap question.
   */
  private computeMapping(answers: readonly GuidedQuestionAnswerV1[]): ContextMappingV1 {
    const descriptor = this.pack.descriptor;
    const data = this.pack.data;
    const answered = new Map(answers.map((a) => [a.questionId, a]));
    const fieldMappings: { sourceField: string; specField: string; conversion: "IDENTITY" | "UNIT_FACTOR" | "FIELD_RENAME" | "GAP_HANDLING"; factor: number | null; meaning: string }[] = [];
    const adaptations: { kind: "IDENTITY" | "UNIT_FACTOR" | "FIELD_RENAME" | "GAP_HANDLING"; detail: string }[] = [];
    const openQuestions: { questionId: string; field: string; question: string; options: string[] }[] = [];

    const pushQuestion = (seed: string, field: string, question: string, options: string[]): string => {
      const questionId = `qst:${sha(canonicalJson([this.context.contextId, seed])).slice(0, 24)}`;
      openQuestions.push({ questionId, field, question, options });
      return questionId;
    };

    // F2 (Korrektur 0430 + Restbefund): geschlossene fachliche
    // Bedeutungsidendität des WERTEFELDS — NIE Worttreffer/Teilstring/
    // Präfix als Eignungsbeweis. Das werttragende Feld (Zahl mit
    // Umrechnungsfaktor, z. B. totalMinor) ist lasttragend: dort ist die
    // Bedeutung NUR über die geschlossene fachliche Kennung (meaningKey)
    // nachweisbar. Nicht-wertliche IDENTITY-Felder laufen über die
    // versiegelte geschlossene Alias-Tabelle der Spec — dort ist der
    // Alias-Name der geschlossene Eignungsnachweis, keine
    // Bedeutungskennung. Drei geschlossene Kanäle (nur werttragende
    // Felder):
    // (1) GESCHLOSSENE KENNUM (meaningKey): EXAKTE Identität
    //     (Spec-Feldkennung === Kontextfeldkennung) => identitätsidentisch
    //     gegeben — der Schlüssel, nicht Text-Ähnlichkeit, ist der
    //     Eignungsnachweis. Ein FEMDER vorhandener meaningKey
    //     (z. B. CUSTOMER_ID auf dem Betragsfeld) ist eine widersprechende
    //     Identität: das Feld blockiert bis zur ausdrücklichen
    //     Nutzerentscheidung.
    // (2) GESCHLOSSENE WIDERSPRUCHSSEMANTIK: ein exakter ganzes-Wort-
    //     Konflikt-Token ODER eine geschlossene Negation eines
    //     Akzeptanz-Tokens im deklarierten Text ist ein ausdrücklicher
    //     WIDERSPRUCH (z. B. "Steuerbetrag", "kein Rechnungsbetrag") —
    //     selbst bei passender Kennung: Nutzerentscheidung erforderlich.
    // (3) ALLES ANDERE ohne geschlossene Kennung bleibt UNRESOLVED
    //     (offene Rückfrage, blockiert) — unbekannt/ungeklärt ist keine
    //     Zustimmung; das Vorkommen akzeptierter Wörter ist keine
    //     Zustimmung; die Tabellen sind geschlossen (keine wachsende
    //     Wortliste).
    const MEANING_ASPECTS: Record<string, { label: string; accept: string[]; conflict: string[] }> = {
      totalMinor: {
        label: "Gesamtwert der Rechnung",
        accept: ["gesamtwert", "rechnungsbetrag", "gesamtbetrag", "totalbetrag", "bruttobetrag", "rechnungssumme", "rechnungstotal"],
        conflict: ["steuerbetrag", "umsatzsteuer", "steuerraet", "steueranteil", "rabatt", "rabattbetrag", "zuschlag", "nebenkosten", "kaution", "vorauszahlung", "guthaben"],
      },
    };
    const meaningNormalize = (text: string): string =>
      text.toLowerCase().replace(/[^a-z0-9]+/g, " ").replace(/ {2,}/g, " ").trim();
    /** F2 (Restbefund): closed contradiction — EXACT whole-word conflict
     *  token, or a closed negation word directly before an accept token
     *  ("kein Rechnungsbetrag", "nicht Gesamtwert"): the declared meaning
     *  says exactly the opposite of the required meaning. No substring, no
     *  prefix, no growing list — the tables are the closed semantics. */
    const meaningContradicts = (meaning: string, aspect: { readonly accept: readonly string[]; readonly conflict: readonly string[] }): boolean => {
      const words = meaningNormalize(meaning).split(" ");
      for (let i = 0; i < words.length; i += 1) {
        const word = words[i] ?? "";
        if (aspect.conflict.includes(word)) return true;
        if (word === "nicht" || word === "kein" || word === "keine" || word === "niemals" || word === "ausgeschlossen") {
          const next = words[i + 1] ?? "";
          if (aspect.accept.includes(next)) return true;
        }
      }
      return false;
    };

    const numericUnitAliases = this.spec.inputs.find((item) => item.kind === "number")?.unitAliases ?? [];

    // The closed alias table resolves each required field against ALL of its
    // alias candidates present in the context descriptor. Currency is special:
    // the method executes only in EUR, so a non-EUR currency column is a
    // permanent unit conflict (no exchange rate exists in the system).
    for (const input of this.spec.inputs) {
      if (input.kind !== "record-set") continue;
      for (const required of input.requiredFields) {
        // F2: derive EVERY candidate (closed alias table ∩ context fields).
        const candidates = input.fieldAliases
          .filter((item) => item.specField === required.field)
          .map((item) => ({
            sourceField: item.sourceField,
            factor: item.factor,
            descriptorField: descriptor.fields.find((f) => f.field === item.sourceField),
          }))
          .filter((item) => item.descriptorField !== undefined)
          .map((item) => ({ sourceField: item.sourceField, factor: item.factor, descriptorField: item.descriptorField as (typeof descriptor.fields)[number] }));

        if (candidates.length === 0) {
          pushQuestion(`gap:${required.field}`, required.field, `Quelle fuer "${required.field}" nicht aus der geschlossenen Alias-Tabelle ableitbar.`, ["ablehnen", "kontext_nicht_ausfuhrbar"]);
          adaptations.push({ kind: "GAP_HANDLING", detail: `FELD_GAP ${required.field}: kein Alias in der Spec` });
          continue;
        }

        let chosen: (typeof candidates)[number];
        const aliasQuestionId = this.questionId(`alias:${required.field}`);
        const aliasAnswer = answered.get(aliasQuestionId);
        if (candidates.length > 1) {
          // F2: multiple candidates = Mehrdeutigkeit. A blocking Rückfrage
          // demands the user's ACTUAL choice; nothing is picked silently.
          const first = candidates[0];
          if (first === undefined) throw new GuidedPathDenied("CANDIDATE_MISSING");
          if (aliasAnswer === undefined) {
            const valueConflict = this.candidateValuesConflict(candidates, data);
            pushQuestion(
              `alias:${required.field}`,
              first.sourceField,
              valueConflict
                ? `Mehrdeutige Zuordnung fuer "${required.field}": mehrere Quellen liefern Werte, die sich widersprechen (${candidates.map((c) => c.sourceField).join(", ")}). Welche Quelle verwenden?`
                : `Mehrdeutige Zuordnung fuer "${required.field}": mehrere Quellen vorhanden (${candidates.map((c) => c.sourceField).join(", ")}). Welche Quelle verwenden?`,
              ["alternativen_feld_verwerfen", ...candidates.slice(1).map((c) => `alternativen_feld_verwenden:${c.sourceField}`)],
            );
            adaptations.push({ kind: "GAP_HANDLING", detail: `MEHRDEUTIGKEIT ${required.field}: ${String(candidates.length)} Kandidaten — Auswahl durch Nutzer erforderlich` });
            continue;
          }
          if (aliasAnswer.answer === "alternativen_feld_verwerfen") {
            chosen = first;
          } else if (/^alternativen_feld_verwenden:/.test(aliasAnswer.answer)) {
            const field = String(aliasAnswer.answer).slice("alternativen_feld_verwenden:".length);
            const hit = candidates.find((c) => c.sourceField === field);
            if (hit === undefined) throw new GuidedPathDenied("ANSWER_NOT_IN_CANDIDATES");
            chosen = hit;
          } else {
            throw new GuidedPathDenied("ANSWER_DENIED");
          }
          adaptations.push({
            kind: "GAP_HANDLING",
            detail: `MEHRDEUTIGKEIT_GEKLAERT ${required.field}: Nutzerwahl "${aliasAnswer.answer}" bindet ${chosen.sourceField} in den Vorschlag`,
          });
        } else {
          const sole = candidates[0];
          if (sole === undefined) throw new GuidedPathDenied("CANDIDATE_MISSING");
          chosen = sole;
        }

        const descriptorField = chosen.descriptorField;
        if (required.field === "currency") {
          const nonEur = data.rows.filter((row) => row[descriptorField.field] !== "EUR").length;
          if (nonEur > 0) {
            pushQuestion(`currency:${descriptorField.field}`, descriptorField.field, `Waehrungsfeld "${descriptorField.field}" enthaelt ${String(nonEur)} Zeilen ohne EUR; die Methode arbeitet nur in EUR und fuhrt keine Umrechnung durch. Welche Behandlung?`, ["kontext_nicht_ausfuhrbar", "ablehnen"]);
            adaptations.push({ kind: "UNIT_FACTOR", detail: `EINHEITENKONFLIKT ${descriptorField.field}: Nicht-EUR-Waehrung ohne Umrechnung nicht ausfuehrbar` });
            continue;
          }
        }
        if (chosen.factor !== null) {
          // Numeric spec fields: the descriptor unit must be in the spec's
          // CLOSED unitAliases table (canonical = EUR), and the alias factor
          // must equal 100 * factorToCanonical(unit) — the source→minor
          // conversion derived purely from the closed tables. Anything else
          // (e.g. USD) is a permanent unit conflict: no rate exists.
          const unitFactor = numericUnitAliases.find((item) => item.alias === descriptorField.unit)?.factorToCanonical ?? null;
          if (unitFactor === null) {
            pushQuestion(`unit:${descriptorField.field}`, descriptorField.field, `Feld "${descriptorField.field}" hat Einheit ${descriptorField.unit ?? "(keine)"}; die geschlossene Methode-Tabelle kennt nur ${numericUnitAliases.map((item) => item.alias).join("/")} und es existiert kein Kurs. Welche Behandlung?`, ["kontext_nicht_ausfuhrbar", "ablehnen"]);
            adaptations.push({ kind: "UNIT_FACTOR", detail: `EINHEITENKONFLIKT ${descriptorField.field}: Einheit nicht in der geschlossenen Tabelle — Kontext ohne Umrechnung nicht ausfuehrbar` });
            continue;
          }
          const expectedFactor = 100 * unitFactor;
          if (Math.abs(chosen.factor - expectedFactor) > 1e-9) {
            pushQuestion(`unit-factor:${descriptorField.field}`, descriptorField.field, `Aliasfaktor ${String(chosen.factor)} fuer "${descriptorField.field}" widerspricht der deklarierten Einheit ${descriptorField.unit ?? "(keine)"} (erwartet ${String(expectedFactor)}). Welche Behandlung?`, ["ablehnen", "kontext_nicht_ausfuhrbar"]);
            adaptations.push({ kind: "GAP_HANDLING", detail: `FAKTOR_WIDERSPRUCH ${descriptorField.field}: Aliasfaktor unvereinbar mit Einheit` });
            continue;
          }
        }
        // F2 (Korrektur 0430 + Restbefund): geschlossene
        // Bedeutungsidendität des WÄHLEN WERTEFELDS (Zahl mit
        // Umrechnung; nicht-wertliche IDENTITY-Felder laufen über die
        // versiegelte geschlossene Alias-Tabelle):
        // - EXAKTE geschlossene Kennung (spec field key === context field
        //   key) ohne Widerspruch => identitätsidentisch gegeben;
        // - widersprechende Identität (fremde Kennung) oder geschlossener
        //   Widerspruch im Text (Konflikt-Token / Negation des
        //   Akzeptanz-Tokens) => WIDERSPRUCH: Nutzerentscheidung;
        // - fehlende geschlossene Kennung ohne Widerspruch => UNRESOLVED:
        //   der freie Text ist KEIN Eignungsnachweis — offene Rückfrage,
        //   bis der Nutzer die Bedeutung ausdrücklich bestätigt oder
        //   ablehnt (keine implizite Zustimmung, keine Worttreffer).
        const aspect = MEANING_ASPECTS[required.field];
        if (aspect !== undefined && chosen.factor !== null) {
          const meaning = descriptorField.meaning;
          const declaredKey = (descriptorField as { meaningKey?: string }).meaningKey;
          const requiredKey = (required as { meaningKey?: string }).meaningKey;
          const keyIdentity = requiredKey !== undefined && declaredKey !== undefined && declaredKey === requiredKey;
          const keyConflict = requiredKey !== undefined && declaredKey !== undefined && declaredKey !== requiredKey;
          const contradicts = keyConflict || meaningContradicts(meaning, aspect);
          const accepted = keyIdentity && !contradicts;
          const meaningQuestionId = this.questionId(`meaning:${required.field}`);
          const meaningAnswer = answered.get(meaningQuestionId);
          if (!accepted) {
            if (meaningAnswer === undefined) {
              pushQuestion(
                `meaning:${required.field}`,
                descriptorField.field,
                contradicts
                  ? `Bedeutungswiderspruch: "${descriptorField.field}" ist deklariert als "${meaning}"${keyConflict ? ` mit Kennung ${String(declaredKey)}` : ""}, die Methode erwartet aber "${aspect.label}" (${required.field}, Kennung ${String(requiredKey)}). Ausdruecklich bestaetigen oder ablehnen?`
                  : `Bedeutung ungeklärt: "${descriptorField.field}" (Kennung ${String(requiredKey)}) trägt keine geschlossene Bedeutungsidendität und der deklarierte Text ist kein Eignungsnachweis. Ausdruecklich bestaetigen oder ablehnen?`,
                ["feld_bedeutung_bestaetigen", "ablehnen"],
              );
              adaptations.push({ kind: "GAP_HANDLING", detail: `BEDEUTUNG_${contradicts ? "WIDERSPRUCH" : "UNRESOLVED"} ${descriptorField.field}: geschlossene Bedeutungsidendität fehlt — ausdrückliche Nutzerentscheidung erforderlich` });
              continue;
            }
            if (meaningAnswer.answer === "ablehnen") {
              // F1/F2: the user explicitly DECLINED the meaning and thereby
              // the context. The question is RESOLVED by the user's answer;
              // the ORCHESTRATOR (user-path.ts / CLI) seals the decline as
              // REJECTED_BY_USER. A decline is never an engine denial.
              adaptations.push({ kind: "GAP_HANDLING", detail: `BEDEUTUNG_ABGELEHNT ${descriptorField.field}: Nutzer lehnt die Bedeutung ab — Kontext wird abgelehnt` });
            } else {
              if (meaningAnswer.answer !== "feld_bedeutung_bestaetigen") throw new GuidedPathDenied("ANSWER_DENIED");
              adaptations.push({ kind: "GAP_HANDLING", detail: `BEDEUTUNG_AUSDRUECKLICH_BESTAETIGT ${descriptorField.field}: Nutzer deklariert es als "${aspect.label}" trotz "${meaning}"` });
            }
          }
        }
        const nullCount = data.rows.filter((row) => row[descriptorField.field] === null).length;
        if (nullCount > 0) {
          if (!required.nullable) {
            const seed = `null:${descriptorField.field}`;
            openQuestions.push({
              questionId: this.questionId(seed),
              field: descriptorField.field,
              question: `Pflichtfeld "${descriptorField.field}" ist in ${String(nullCount)} Zeilen leer — Datenqualität verletzt die Methode-Voraussetzung. Welche Behandlung?`,
              options: ["ablehnen", "kontext_nicht_ausfuhrbar"],
            });
            adaptations.push({ kind: "GAP_HANDLING", detail: `NULL_GAP ${descriptorField.field}: ${String(nullCount)} leere Pflichtfelder` });
            continue;
          }
          const seed = `nullable:${descriptorField.field}`;
          const questionId = this.questionId(seed);
          const existing = answered.get(questionId);
          if (existing === undefined) {
            // Unanswered: the question blocks confirmation until the user
            // decides (closed options; no free text).
            openQuestions.push({
              questionId,
              field: descriptorField.field,
              question: `Optionales Feld "${descriptorField.field}" ist in ${String(nullCount)} Zeilen leer. Behandeln als unbekannt und betroffene Rechnungen mit Grundcode flaggen?`,
              options: ["behandele_unbekannt_flaggen", "ablehnen"],
            });
            adaptations.push({
              kind: "GAP_HANDLING",
              detail: `leere "${descriptorField.field}" blockieren die Bestaetigung bis zur Nutzerentscheidung`,
            });
          } else {
            // Answered: the question is RESOLVED and leaves openQuestions;
            // the sealed answer is recorded here (and in the mapping digest
            // via the answer list). Rejection answers (ablehnen /
            // kontext_nicht_ausfuhrbar) are resolved here too — the ORCHESTRATOR
            // (user-path.ts / CLI) is the component that turns a rejection
            // answer into a path rejection. The engine keeps one simple rule.
            adaptations.push({
              kind: "GAP_HANDLING",
              detail: existing.answer === "behandele_unbekannt_flaggen"
                ? `leere "${descriptorField.field}" als unbekannt behandelt; betroffene Rechnungen bekommen Zusatzgrund UNKNOWN_FLAGGEN`
                : `Antwort "${existing.answer}" zu "${descriptorField.field}" — Kontext nicht bestaetigt`,
            });
          }
        }
        fieldMappings.push({
          sourceField: descriptorField.field,
          specField: required.field,
          conversion: chosen.factor !== null ? "UNIT_FACTOR" : "IDENTITY",
          factor: chosen.factor,
          meaning: `${descriptorField.meaning} -> ${required.field}`,
        });
        if (chosen.factor !== null) {
          adaptations.push({ kind: "UNIT_FACTOR", detail: `${descriptorField.field} (${descriptorField.unit ?? "z"}) -> ${required.field} in Nebeneinheiten EUR (Faktor ${String(chosen.factor)})` });
        } else if (descriptorField.field !== required.field) {
          adaptations.push({ kind: "FIELD_RENAME", detail: `${descriptorField.field} -> ${required.field}` });
        }
      }
    }
    // threshold (number input): the spec's CLOSED unitAliases table decides
    // the conversion of the context's floor value into EUR. A unit outside
    // that table (e.g. USD) is a permanent unit conflict — no rate exists.
    const floorInput = this.spec.inputs.find((item) => item.kind === "number");
    const floorDescriptor = descriptor.fields.find((f) => f.field === descriptor.floorField);
    const floorUnitFactor = floorInput?.unitAliases.find((item) => item.alias === floorDescriptor?.unit)?.factorToCanonical ?? null;
    if (floorDescriptor === undefined || floorUnitFactor === null) {
      pushQuestion(`floor-unit:${descriptor.floorField}`, descriptor.floorField, `Grenzwertquelle "${descriptor.floorField}" hat Einheit ${floorDescriptor?.unit ?? "(fehlend)"}; die geschlossene Methode-Tabelle kennt nur ${floorInput?.unitAliases.map((item) => item.alias).join("/") ?? "?"}. Welche Behandlung?`, ["kontext_nicht_ausfuhrbar", "ablehnen"]);
      adaptations.push({ kind: "UNIT_FACTOR", detail: `EINHEITENKONFLIKT ${descriptor.floorField}: Einheit nicht in der geschlossenen Tabelle — keine Bestaetigung moeglich` });
    } else {
      fieldMappings.push({
        sourceField: descriptor.floorField,
        specField: "marginFloor",
        conversion: "UNIT_FACTOR",
        factor: floorUnitFactor,
        meaning: `${floorDescriptor.meaning} (Einheit ${floorDescriptor.unit} -> EUR, Faktor ${String(floorUnitFactor)})`,
      });
      adaptations.push({ kind: "UNIT_FACTOR", detail: `Grenzwert ${descriptor.floorField} (${floorDescriptor.unit}) -> EUR (Faktor ${String(floorUnitFactor)}, geschlossene Tabelle)` });
    }

    const unsigned: Omit<ContextMappingV1, "proposalDigest"> = {
      schemaVersion: "pansphaira.kts/context-mapping/v1",
      mappingId: `mapping:${sha(canonicalJson([this.spec.methodId, this.context.contextId, answers.map((a) => [a.questionId, a.answer])])).slice(0, 24)}`,
      methodId: this.spec.methodId,
      specDigest: this.spec.specDigest,
      contextId: this.context.contextId,
      sourceFormat: descriptor.sourceFormat,
      fieldMappings,
      adaptations,
      openQuestions,
    };
    return { ...unsigned, proposalDigest: sha(unsigned) };
  }

  /** F2: do the candidates carry conflicting converted values for at least one row? */
  private candidateValuesConflict(
    candidates: readonly { sourceField: string; factor: number | null; descriptorField: { field: string; unit: string | null } }[],
    data: { rows: readonly Record<string, string | null>[] },
  ): boolean {
    for (const row of data.rows) {
      const values: (number | null)[] = candidates.map((c) => {
        const raw = row[c.sourceField];
        if (raw === null) return null;
        const num = Number(raw);
        if (!Number.isFinite(num)) return null;
        return c.factor !== null ? num * c.factor : num;
      });
      const distinct = new Set(values.filter((v): v is number => v !== null));
      if (distinct.size > 1) return true;
    }
    return false;
  }

  private questionId(seed: string): string {
    return `qst:${sha(canonicalJson([this.context.contextId, seed])).slice(0, 24)}`;
  }
}

/**
 * Adapt one sealed context to the canonical MarginInputs of the bound method
 * using ONLY the confirmed mapping. Fail-closed on any mismatch.
 */
export function adaptContextToMarginInputsV1(args: {
  readonly context: GuidedContextV1;
  readonly mapping: ContextMappingV1;
  readonly pack: ContextPackV1;
}): MarginInputsV1 {
  const { context, mapping, pack } = args;
  if (!validateGuidedContextV1(context)) throw new GuidedPathDenied("CONTEXT_DENIED");
  if (!validateContextMappingV1(mapping)) throw new GuidedPathDenied("MAPPING_DENIED");
  if (mapping.contextId !== context.contextId) throw new GuidedPathDenied("MAPPING_CONTEXT_MISMATCH");
  if (mapping.openQuestions.some((q) => q.options.length > 0)) throw new GuidedPathDenied("OPEN_QUESTIONS_BLOCK_EXECUTION");
  const sourceFields = new Set(pack.descriptor.fields.map((f) => f.field));
  if (pack.data.floorRaw !== context.floorRaw) throw new GuidedPathDenied("FLOOR_MAPPING_MISMATCH");
  const floorMappingEntry = mapping.fieldMappings.find((m) => m.specField === "marginFloor");
  if (floorMappingEntry === undefined || floorMappingEntry.sourceField !== pack.descriptor.floorField) {
    throw new GuidedPathDenied("FLOOR_MAPPING_MISMATCH");
  }
  if (floorMappingEntry === undefined || floorMappingEntry.conversion !== "UNIT_FACTOR" || floorMappingEntry.factor === null) {
    throw new GuidedPathDenied("FLOOR_UNIT_RULE_MISMATCH");
  }
  // The floor factor comes from the SPEC's closed unitAliases table (see
  // computeMapping): the descriptor unit names the actual unit of the stored
  // value, and the sealed factor converts it to the canonical unit. Never an
  // open conversion, never a rate.
  const marginFloorEur = pack.data.floorRaw * (floorMappingEntry.factor as number);
  if (!Number.isFinite(marginFloorEur) || marginFloorEur < 0) throw new GuidedPathDenied("FLOOR_MINOR_DENIED");
  const currencyMapping = mapping.fieldMappings.find((m) => m.specField === "currency");
  if (currencyMapping === undefined || currencyMapping.conversion !== "IDENTITY") {
    throw new GuidedPathDenied("CURRENCY_MAPPING_REQUIRED");
  }
  if (pack.data.rows.some((row) => row[currencyMapping.sourceField] !== "EUR")) {
    throw new GuidedPathDenied("CURRENCY_NOT_EUR");
  }
  const invoices: { invoiceId: string; orderId: string; customerId: string | null; totalMinor: number; currency: "EUR"; dueDate: string }[] = [];
  const seen = new Set<string>();
  for (const row of pack.data.rows) {
    const adapted: Record<string, unknown> = {};
    for (const mappingEntry of mapping.fieldMappings) {
      if (mappingEntry.specField === "marginFloor") continue;
      if (!sourceFields.has(mappingEntry.sourceField)) throw new GuidedPathDenied("SOURCE_FIELD_ABSENT");
      const raw = row[mappingEntry.sourceField];
      if (raw === null) {
        adapted[mappingEntry.specField] = null;
        continue;
      }
      if (mappingEntry.conversion === "UNIT_FACTOR") {
        const value = Number(raw);
        if (!Number.isFinite(value)) throw new GuidedPathDenied("NUMBER_PARSE_DENIED");
        const converted = Math.round(value * (mappingEntry.factor as number));
        if (!Number.isSafeInteger(converted)) throw new GuidedPathDenied("MINOR_UNITS_DENIED");
        adapted[mappingEntry.specField] = converted;
      } else {
        adapted[mappingEntry.specField] = raw;
      }
    }
    const invoiceId = String(adapted.invoiceId ?? "");
    if (!/^[a-z][a-z-]{1,31}:[a-z0-9][a-z0-9._-]{2,95}$/.test(invoiceId)) throw new GuidedPathDenied("ADAPTED_ID_FORMAT_DENIED");
    if (seen.has(invoiceId)) throw new GuidedPathDenied("ADAPTED_ID_DUPLICATE");
    seen.add(invoiceId);
    const orderId = String(adapted.orderId ?? "");
    if (!/^[a-z][a-z-]{1,31}:[a-z0-9][a-z0-9._-]{2,95}$/.test(orderId)) throw new GuidedPathDenied("ADAPTED_ID_FORMAT_DENIED");
    const customerId = adapted.customerId === null || adapted.customerId === undefined ? null : String(adapted.customerId);
    if (customerId !== null && !/^[a-z][a-z-]{1,31}:[a-z0-9][a-z0-9._-]{2,95}$/.test(customerId)) throw new GuidedPathDenied("ADAPTED_ID_FORMAT_DENIED");
    const totalMinor = Number(adapted.totalMinor);
    if (!Number.isSafeInteger(totalMinor) || totalMinor < 0) throw new GuidedPathDenied("ADAPTED_TOTAL_DENIED");
    const dueDate = String(adapted.dueDate ?? "");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dueDate) || Number.isNaN(Date.parse(`${dueDate}T00:00:00Z`))) throw new GuidedPathDenied("ADAPTED_DATE_DENIED");
    invoices.push({ invoiceId, orderId, customerId, totalMinor, currency: "EUR", dueDate });
  }
  const inputs: MarginInputsV1 = { invoices, marginFloorEur: marginFloorEur };
  if (!validateMarginInputsV1(inputs)) throw new GuidedPathDenied("ADAPTED_INPUTS_INVALID");
  return inputs;
}

/* re-export for receipt-grade consumers */
export { methodSelectionDigestV1 };
