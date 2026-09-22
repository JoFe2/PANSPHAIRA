/**
 * KTS-04 — integrated, actually-executed user path.
 *
 * Ties the KTS-01 method library, the KTS-02 guided adaptation path and the
 * KTS-03 real read-only PostgreSQL adapter into ONE documented, locally
 * runnable flow: a user states a goal, the library resolves a method, the
 * path asks Rückfragen, the user decides, and the SAME sealed method core
 * executes the adapted inputs. It works over any context source (CSV file OR
 * live PostgreSQL) without any core change — the reuse proof at user level.
 *
 * `runUserPathV1` is deterministic and fail-closed: unit conflicts and
 * tampered contexts never execute (REJECTED_BY_USER / DENIED), never invent
 * suitability, and the user's decision + the sealed inputs are digest-bound.
 */
import type { ContextPackV1 } from "./context-source.js";
import type { MethodSpecV1 } from "./method-core.js";
import type { MethodLibraryV1 } from "./method-library.js";
import { buildLibraryViewV1 } from "./method-library.js";
import {
  GuidedPathBuilder,
  GuidedPathDenied,
  adaptContextToMarginInputsV1,
  type GuidedAnswerValueV1,
  type GuidedPathV1,
} from "./guided-path.js";
import type { MethodExecutionReceiptV1, MethodGoalV1, MethodSelectionV1 } from "./method-core.js";
import { existsSync } from "node:fs";
import path from "node:path";

/**
 * Resolve the repository root (the source tree that owns packages/ +
 * corpus + profiles + contexts) from a compiled location. The compiled
 * output lands under dist/, so we walk upward until we find a package.json
 * whose name is the PanSphaira product — that is the repo root. Fails closed
 * if the source tree cannot be located.
 */
export function resolveRepoRoot(startDir: string): string {
  let dir = path.resolve(startDir);
  for (let depth = 0; depth < 12; depth += 1) {
    // The repo root owns the sealed JSON fixtures (not emitted by tsc).
    if (existsSync(path.join(dir, "packages", "knowledge-solution", "profiles", "corpus-profile.json"))) {
      return dir;
    }
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  throw new Error("REPO_ROOT_NOT_FOUND");
}

export const USER_PATH_SCHEMA_V1 = "pansphaira.kts/user-path/v1" as const;

export type UserPathOutcomeV1 = "EXECUTED" | "REJECTED_BY_USER" | "DENIED" | "BLOCKED" | "FAILED";

/**
 * Deterministic answer policy for blocking Rückfragen (kept for the existing
 * deterministic demo/test paths). A question whose options offer
 * "kontext_nicht_ausfuhrbar" is a permanent unit/meaning conflict -> decline
 * the context. A nullable-field question -> treat unknown as unknown and flag
 * affected records. Free text is never accepted; only the closed options.
 *
 * F1 note: the CLI's interactive path does NOT use this policy implicitly —
 * it asks the user and only executes on the user's EXPLICIT answers and
 * confirmations. This policy is an explicit caller choice (batch/demo mode),
 * and its answers are sealed into the path with their origin (the policy),
 * never presented as invented user confirmations of the mapping/execution.
 */
export function defaultAnswerPolicyV1(question: {
  readonly field: string;
  readonly options: readonly string[];
}): string {
  if (question.options.includes("kontext_nicht_ausfuhrbar")) return "kontext_nicht_ausfuhrbar";
  if (question.options.includes("behandele_unbekannt_flaggen")) return "behandele_unbekannt_flaggen";
  if (question.options.includes("feld_bedeutung_bestaetigen")) return "ablehnen";
  // F2: multiple alias candidates — the deterministic batch policy keeps the
  // FIRST (alias-table) candidate; the interactive path asks the user.
  if (question.options.includes("alternativen_feld_verwerfen")) return "alternativen_feld_verwerfen";
  // Unknown option set: fail closed — decline.
  if (question.options.includes("ablehnen")) return "ablehnen";
  return "ablehnen";
}

export interface UserPathArgsV1 {
  readonly pack: ContextPackV1;
  readonly spec: MethodSpecV1;
  readonly library: MethodLibraryV1;
  readonly nowMs: number;
  /** F1 — the user's goal. When absent the path's sealed default goal is used. */
  readonly goal?: MethodGoalV1;
  readonly principal: string;
  /** Colon-free token; decisionIds become `decision:<prefix>-mapping|-execution` (ID_RE allows one colon). */
  readonly decisionPrefix: string;
  readonly answerPolicy?: (question: { readonly field: string; readonly options: readonly string[] }) => string | undefined;
  /** Read-only provenance for a live-source context (e.g. PostgreSQL). */
  readonly sourceProvenance?: {
    readonly host: string;
    readonly port: number;
    readonly database: string;
    readonly user: string;
    readonly statement: string;
    readonly rowCount: number;
    readonly readbackDigest: string;
  };
}

export interface UserPathResultV1 {
  readonly schemaVersion: typeof USER_PATH_SCHEMA_V1;
  readonly outcome: UserPathOutcomeV1;
  readonly contextId: string;
  readonly contextSourceFormat: string;
  readonly specDigest: string;
  readonly methodId: string;
  readonly path: GuidedPathV1;
  readonly receipt: MethodExecutionReceiptV1 | null;
  readonly openQuestionsAnswered: number;
  readonly sourceProvenance: UserPathArgsV1["sourceProvenance"];
  /** F1/F3 — the sealed method selection (visible: outcome, reasons, candidates). */
  readonly selection: MethodSelectionV1;
  /** F1 — blocking questions the policy could not (or was not asked to) answer. */
  readonly pendingQuestions: readonly { readonly questionId: string; readonly field: string; readonly question: string; readonly options: readonly string[] }[];
  /** F1 — which mapping/execution confirmations were actually given by the user. */
  readonly userConfirmations: readonly { readonly subjectKind: "CONTEXT_MAPPING" | "EXECUTION"; readonly decisionDigest: string; readonly proposalDigest: string }[];
}

/**
 * Run the full integrated user path over one context. Deterministic:
 * identical inputs -> identical outcome. Fail-closed on unit conflicts and
 * tampering. Returns a receipt bound to the sealed spec digest and the
 * exact adapted inputs.
 */
export function runUserPathV1(args: UserPathArgsV1): UserPathResultV1 {
  const policy = args.answerPolicy ?? defaultAnswerPolicyV1;
  const principal = args.principal;
  const prefix = args.decisionPrefix;
  const { pack, spec, library, nowMs } = args;

  const resultSkeleton = (
    outcome: UserPathOutcomeV1,
    path: GuidedPathV1,
    receipt: MethodExecutionReceiptV1 | null,
    answered: number,
    selection: MethodSelectionV1,
    pendingQuestions: readonly { readonly questionId: string; readonly field: string; readonly question: string; readonly options: readonly string[] }[],
    userConfirmations: readonly { readonly subjectKind: "CONTEXT_MAPPING" | "EXECUTION"; readonly decisionDigest: string; readonly proposalDigest: string }[],
  ): UserPathResultV1 => ({
    schemaVersion: USER_PATH_SCHEMA_V1,
    outcome,
    contextId: path.context.contextId,
    contextSourceFormat: path.context.sourceFormat,
    specDigest: spec.specDigest,
    methodId: spec.methodId,
    path,
    receipt,
    openQuestionsAnswered: answered,
    sourceProvenance: args.sourceProvenance,
    selection,
    pendingQuestions,
    userConfirmations,
  });

  const confirmations: { readonly subjectKind: "CONTEXT_MAPPING" | "EXECUTION"; readonly decisionDigest: string; readonly proposalDigest: string }[] = [];

  let builder: GuidedPathBuilder;
  try {
    builder = GuidedPathBuilder.fromContext({ pack, spec, ...(args.goal !== undefined ? { goal: args.goal } : {}) });
  } catch (error) {
    // Tampered / invalid context or goal: fail closed. Represent as a rejected
    // path with a synthetic denial so callers have a uniform shape.
    throw new GuidedPathDenied("USER_PATH_CONTEXT_DENIED", String((error as Error).message));
  }
  builder.recordGoal();
  // F4 (Korrektur 0430): bind the sealed library so the pre-execution
  // knowledge re-check re-resolves exactly THIS library at the ACTUAL clock.
  builder.bindLibrary(library);
  const goalStep = builder.build().steps.find((s) => s.kind === "GOAL_RECORDED");
  const goal = goalStep?.payload.goal;
  if (goal === undefined) throw new GuidedPathDenied("USER_PATH_GOAL_NOT_RECORDED");
  // F4: buildLibraryViewV1 re-checks knowledge freshness against `nowMs`
  // (the ACTUAL call-time clock) — a stale corpus yields UNKNOWN here, even
  // though the library object was loaded earlier.
  const view = buildLibraryViewV1({ library, goal: goal as never, nowMs });
  let proposal;
  try {
    proposal = builder.attachSelection(view);
  } catch (error) {
    // F1/F3: NO_MATCH / UNKNOWN / stale knowledge — the sealed selection says
    // so with closed reasons. Nothing is invented; the user sees the outcome.
    // attachSelection has ALREADY sealed the terminal (DENIED / REJECTED_BY_USER)
    // before throwing — calling reject() again would be a double terminal.
    const selection = view.selection;
    if (builder.build().terminal === "IN_PROGRESS") {
      builder.reject(`selection_${selection.outcome.toLowerCase()}`);
    }
    return resultSkeleton("DENIED", builder.build(), null, 0, selection, [], []);
  }
  builder.recordProposal();

  let answered = 0;
  const givenAnswers: { questionId: string; answer: string }[] = [];
  const answeredIds = new Set<string>();
  // Answer every blocking question exactly once (an answer is never given twice
  // — re-answering the same questionId is denied by the builder). Permanent
  // unit/meaning conflicts are re-derived by the mapping engine and never
  // "resolve"; they remain in openQuestions and are caught below. Resolvable
  // questions (e.g. nullable fields) leave openQuestions once answered.
  // F1: a policy that returns undefined does NOT answer the question — it
  // stays pending (visible) and blocks execution. Nothing is invented.
  for (let round = 0; round < 32; round += 1) {
    const pending = builder
      .proposal()
      .openQuestions.filter((q) => q.options.length > 0 && !answeredIds.has(q.questionId));
    if (pending.length === 0) break;
    let answeredThisRound = 0;
    for (const question of pending) {
      if (answered >= 32) {
        // F1 (Restbefund): a technical budget block, not a user rejection.
        builder.block("question_budget_exhausted");
        return resultSkeleton("BLOCKED", builder.build(), null, answered, view.selection, [question], confirmations);
      }
      let option: string | undefined;
      try {
        option = policy(question);
      } catch {
        option = undefined;
      }
      if (option === undefined) continue; // pending: the question stays open and visible
      try {
        builder.answer(question.questionId, option, nowMs + 1000 + answered * 100);
      } catch {
        continue; // option not closed by the question: stays pending, execution blocked
      }
      answeredIds.add(question.questionId);
      givenAnswers.push({ questionId: question.questionId, answer: option });
      answered += 1;
      answeredThisRound += 1;
    }
    if (answeredThisRound === 0) break; // no progress: remaining questions stay pending (visible), execution blocked
  }
  const after = builder.proposal();
  const remainingBlocking = after.openQuestions.filter((q) => q.options.length > 0);

  // A rejection answer (ablehnen / kontext_nicht_ausfuhrbar, or a meaning
  // answer "ablehnen") means the USER declined: the path is REJECTED_BY_USER
  // and never executes. F1: a genuine user decision, never an invention.
  const rejectedByAnswer = givenAnswers.some((a) => a.answer === "ablehnen" || a.answer === "kontext_nicht_ausfuhrbar");
  // F1 (Korrektur 0430 + Restbefund): honest terminals. A genuine user
  // decline (ablehnen / kontext_nicht_ausfuhrbar) seals REJECTED_BY_USER —
  // the USER declined. Unanswered blocking questions (no explicit
  // answer / EOF) are a BLOCK: nobody declined, the questions stay
  // visible, no receipt is produced.
  if (rejectedByAnswer) {
    builder.reject("context_declined_by_user");
    return resultSkeleton("REJECTED_BY_USER", builder.build(), null, answered, view.selection, remainingBlocking, confirmations);
  }
  if (remainingBlocking.length > 0) {
    builder.block("open_questions_unanswered");
    return resultSkeleton("BLOCKED", builder.build(), null, answered, view.selection, remainingBlocking, confirmations);
  }

  // F4 (Korrektur 0430): aktuelle Wissensgültigkeit UNMITTELBAR VOR
  // Ausführung — die bereits ausgewählte, wartende Auswahl wird gegen die
  // tatsächliche Uhr (nowMs) erneut aufgelöst. Knowledge, das seit der
  // Auswahl abgelaufen ist, verweigert die Ausführung (DENIED, keine
  // Receipt): die fehlende Nachprüfung des bereits gewählten Builders.
  const recheckView = buildLibraryViewV1({ library, goal: goal as never, nowMs });
  if (recheckView.selection.outcome !== "SELECTED" || recheckView.selection.selected === null
    || recheckView.selection.selected.methodId !== spec.methodId
    || recheckView.selection.selected.specDigest !== spec.specDigest) {
    builder.deny("knowledge_expired_before_execution");
    return resultSkeleton("DENIED", builder.build(), null, answered, view.selection, [], confirmations);
  }
  try {
    // executeView seals the DENIED terminal itself on failure (KNOWLEDGE_
    // RECHECK_FAILED / METHOD_MISMATCH) — no second reject (double terminal).
    builder.executeView(recheckView, nowMs);
  } catch {
    return resultSkeleton("DENIED", builder.build(), null, answered, view.selection, [], confirmations);
  }
  let inputs: ReturnType<typeof adaptContextToMarginInputsV1>;
  try {
    const mappingDecision = builder.confirmMapping(`decision:${prefix}-mapping`, principal, nowMs + 2000);
    confirmations.push({ subjectKind: "CONTEXT_MAPPING", decisionDigest: mappingDecision.decisionDigest, proposalDigest: mappingDecision.proposalDigest });
    inputs = adaptContextToMarginInputsV1({ context: builder.build().context, mapping: after, pack });
  } catch (error) {
    // F1 (Restbefund): a technical denial of the mapping/adaptation, not a
    // user rejection.
    builder.block("mapping_or_adaptation_denied");
    return resultSkeleton("BLOCKED", builder.build(), null, answered, view.selection, [], confirmations);
  }
  const executionDecision = builder.confirmExecution(`decision:${prefix}-execution`, principal, inputs, nowMs + 3000);
  confirmations.push({ subjectKind: "EXECUTION", decisionDigest: executionDecision.decisionDigest, proposalDigest: executionDecision.proposalDigest });
  let receipt: MethodExecutionReceiptV1;
  try {
    receipt = builder.execute(executionDecision, inputs);
  } catch (error) {
    builder.deny("execution_denied");
    return resultSkeleton("DENIED", builder.build(), null, answered, view.selection, [], confirmations);
  }
  const path = builder.build();
  return resultSkeleton(
    path.terminal === "EXECUTED" ? "EXECUTED" : path.terminal === "DENIED" ? "DENIED" : "FAILED",
    path,
    receipt,
    answered,
    view.selection,
    [],
    confirmations,
  );
}
