/**
 * KTS-04 — locally runnable user path CLI (F1/F3/F4/F5 corrected).
 *
 *   node dist/packages/knowledge-solution/src/cli.js library
 *   node dist/packages/knowledge-solution/src/cli.js run csv:invoices-eur-cent            # interactive (real user)
 *   node dist/packages/knowledge-solution/src/cli.js run csv:legacy-erp-de --goal margin  # interactive, pre-bound goal
 *   node dist/packages/knowledge-solution/src/cli.js run csv:legacy-erp-de --answers answers.json
 *   node dist/packages/knowledge-solution/src/cli.js run csv:invoices-usd                # interactive; user must answer
 *   node dist/packages/knowledge-solution/src/cli.js run postgres                        # interactive over REAL local PostgreSQL
 *   node dist/packages/knowledge-solution/src/cli.js run csv:invoices-eur-cent --demo    # explicit deterministic demo (kept)
 *
 * F1 — the PRODUCTION path no longer simulates user decisions:
 *   - the goal is captured from the user (closed selection; explicit free-text
 *     objectives are mapped to closed intentions and CONFIRMED by the user);
 *   - the library selection (outcome, closed reasons, candidates) is shown;
 *   - the mapping proposal (fields, units, meanings, adaptations) is shown;
 *   - every blocking Rückfrage is shown with its closed options and answered
 *     ONLY by the user's explicit input (answers carry their origin);
 *   - the mapping AND the execution are separately CONFIRMED by the user;
 *   - EOF / missing answer / decline NEVER produces an execution receipt.
 * `--demo` keeps the existing deterministic demo path (explicit choice, fixed
 * decision origin); batch mode `--answers <file>` accepts ONLY decisions that
 * are BOUND to the displayed proposal BEFORE it can authorize anything: the
 * file must carry the goalDigest of the goal it pre-binds, the proposalDigest
 * of the displayed proposal (and its questionIds + closed options when it
 * answers Rückfragen), and the inputDigest of the EXACT adapted inputs it
 * releases. A file that does not bind the actual displayed objects is
 * rejected — the same generic yes can never authorize a different proposal.
 * The principal is NEVER invented: batch mode requires an explicit,
 * ID-validated principal in the file; interactive mode asks the user for
 * their identifier first.
 *
 * F3 — suitability is intention-based, not output-shape-based: the closed
 * intention table decides; unknown/incompatible goals yield a Rückfrage,
 * NO_MATCH or UNKNOWN — never an invented match.
 *
 * F4 — the REAL runtime clock drives the path (freshness of the bound corpus
 * knowledge is re-checked at selection AND execution time); no frozen clock
 * in the production path.
 *
 * F5 — the PostgreSQL read uses the explicit ownership contract of the
 * adapter: a fresh read-only client is connected by the adapter (bounded) or
 * rejected immediately; the server-side read-only role stays the authority
 * for write refusal.
 *
 * Exit codes: 0 EXECUTED · 2 usage · 3 user rejection · 4 blocked (open
 * questions / EOF) · 5 DENIED (conflict/data/selection) · 1 hard failure.
 *
 * User documentation lives in the checkout:
 * packages/knowledge-solution/USER-PATH.md
 */
import { createInterface } from "node:readline";
import { createHash } from "node:crypto";
import path from "node:path";
import { readFileSync } from "node:fs";
import { canonicalJson } from "../../contracts/src/canonical-json.js";
import {
  validateMethodGoalV1,
  validateMethodSpecV1,
  type MethodGoalV1,
  type MethodSelectionV1,
  type UserDecisionV1,
} from "./method-core.js";
import {
  buildLibraryViewV1,
  explainMethodV1,
  loadMethodLibraryV1,
  METHOD_GOAL_OBJECTIVE_CHOICES_V1,
  searchMethodsV1,
  type MethodLibraryV1,
} from "./method-library.js";
import { loadContextPackV1 } from "./context-source.js";
import {
  GUIDED_PATH_ROOT_DIGEST,
  GuidedPathBuilder,
  GuidedPathDenied,
  adaptContextToMarginInputsV1,
  type GuidedPathV1,
} from "./guided-path.js";
import {
  PG_DATABASE,
  PG_PORT,
  PG_RO_PASSWORD,
  PG_RO_USER,
  PG_SCHEMA,
  pgDataDirFor,
  startRealPostgres,
  type PgHarness,
} from "./pg-harness.js";
import { readMarginContextFromPostgresV1, runReadOnlyQueryV1 } from "./postgres-source.js";
import { defaultAnswerPolicyV1, resolveRepoRoot, runUserPathV1 } from "./user-path.js";

const ROOT = resolveRepoRoot(path.dirname(new URL(import.meta.url).pathname));
const PKG = path.join(ROOT, "packages", "knowledge-solution");

/** F1 (Korrektur 0430): closed principal-identifier format (same ID format
 *  as the sealed ids) — the user's OWN identifier, never invented. */
const PRINCIPAL_ID_RE = /^[a-z][a-z-]{1,31}:[a-z0-9][a-z0-9._-]{2,95}$/;
const isValidPrincipalId = (value: string): boolean => PRINCIPAL_ID_RE.test(value);
/** The explicit, documented demo decision origin (--demo fixture mode only). */
const DEMO_PRINCIPAL = "principal:finance-reviewer";
const sha256Hex = (value: unknown): string =>
  createHash("sha256").update(typeof value === "string" ? value : canonicalJson(value)).digest("hex");

const usage = () => {
  console.log("Usage:");
  console.log("  library                    show the usable knowledge library (sealed methods + knowledge)");
  console.log("  run csv:<context>          interactive user path over a sealed CSV context");
  console.log("  run postgres               interactive user path over a REAL local PostgreSQL (fictitious data)");
  console.log("  run <target> --goal g      pre-bind the goal: g=margin|total|<exact closed objective>");
  console.log("  run <target> --answers f   batch mode: explicit decisions bound to the displayed proposal (JSON)");
  console.log("  run <target> --demo        explicit deterministic demo (no user input; kept for the demo path)");
  console.log("  help                       this text");
  console.log("");
  console.log("Exit: 0 EXECUTED, 2 usage, 3 user rejection, 4 blocked (open questions/EOF), 5 DENIED, 1 failure");
};

const loadSpec = () => {
  const spec = JSON.parse(readFileSync(path.join(PKG, "specs", "margin-threshold.spec.json"), "utf8")) as unknown;
  if (!validateMethodSpecV1(spec)) throw new Error("SPEC_DENIED");
  return spec;
};

const loadLibrary = () =>
  loadMethodLibraryV1({
    corpusRoot: path.join(PKG, "corpus"),
    packageRoot: PKG,
    profile: JSON.parse(readFileSync(path.join(PKG, "profiles", "corpus-profile.json"), "utf8")),
    // F4: REAL runtime clock (never a frozen demo clock in the production path).
    nowMs: Date.now(),
  });

const loadContextPack = (name: string) => loadContextPackV1(path.join(PKG, "contexts", name));

const printLibrary = (): void => {
  const library = loadLibrary();
  console.log("# Wissensbibliothek (sealed, digest-verified)");
  console.log(`libraryId:    ${library.libraryId}`);
  console.log(`corpusId:     ${library.corpusId}`);
  console.log(`edition:      ${library.editionId} (observed ${new Date(library.observedAtMs).toISOString()})`);
  console.log(`loadState:    ${library.loadState}`);
  if (library.driftedPaths.length > 0) console.log(`driftedPaths: ${library.driftedPaths.join(", ")}`);
  console.log("");
  for (const entry of library.methods) {
    const explanation = explainMethodV1(library, entry.spec.methodId);
    console.log(`## ${entry.spec.title}`);
    console.log(`methodId:   ${entry.spec.methodId}`);
    console.log(`version:    ${entry.spec.version}`);
    console.log(`specDigest: ${entry.spec.specDigest}`);
    console.log(`meaning:    ${entry.spec.meaning}`);
    console.log(`outcomes:   ${entry.spec.supportedOutcomes.join(", ")}`);
    if (explanation !== null) {
      console.log("requiredData:");
      for (const d of explanation.requiredData) {
        console.log(`  - ${d.inputId} (${d.unit ?? "—"}): ${d.meaning}`);
        console.log(`      fields: ${d.requiredFields.join(", ")}`);
      }
      console.log(`preconditions: ${explanation.preconditions.join(" | ")}`);
      console.log("knowledgeSources:");
      for (const source of explanation.sources) {
        console.log(`  - ${source.ref} [${source.kind}] state=${source.state} path=${source.path} citations=${source.citations.join(", ") || "—"}`);
      }
      if (explanation.contradictions.length > 0) {
        console.log(`contradictions: ${explanation.contradictions.map((c) => `${c.left} vs ${c.right} (${c.kind})`).join(" | ")}`);
      } else {
        console.log("contradictions: none");
      }
    }
    console.log("");
  }
  console.log("Search example (deterministic token search):");
  const hits = searchMethodsV1(library, "grenzwert rechnungen markieren");
  for (const hit of hits) console.log(`  - "${hits.length > 1 ? "" : ""}${hit.methodId}" score=${String(hit.score)}`);
};

/* ------------------------------- stdin ------------------------------- */

type LineSource = { next: () => Promise<{ done: boolean; value: string | undefined }> };

const lineSource = (input: NodeJS.ReadableStream): LineSource => {
  const rl = createInterface({ input, terminal: false });
  const queue: string[] = [];
  let waiter: ((done: boolean, value?: string) => void) | null = null;
  let finished = false;
  rl.on("line", (line: string) => {
    if (waiter !== null) {
      const w = waiter;
      waiter = null;
      w(false, line);
    } else {
      queue.push(line);
    }
  });
  rl.on("close", () => {
    finished = true;
    if (waiter !== null) {
      const w = waiter;
      waiter = null;
      w(true);
    }
  });
  return {
    next: async () => {
      if (queue.length > 0) return { done: false, value: queue.shift() };
      if (finished) return { done: true, value: undefined };
      return new Promise((resolve) => {
        waiter = (done, value) => resolve({ done, value });
      });
    },
  };
};

const isYes = (text: string): boolean => ["ja", "j", "yes", "y", "1", "bestaetige", "bestätige", "bestaetigen", "bestätigen"].includes(text);
const isNo = (text: string): boolean => ["nein", "n", "no", "0", "ablehnen", "ablehne", "abbrechen", "abort"].includes(text);

/* ------------------------- interactive path -------------------------- */

interface InteractiveOutcome {
  readonly code: number;
}

interface BatchAnswers {
  /** F1 (Korrektur 0430): binding to the captured goal (goalDigest). */
  readonly goalDigest?: string;
  /** F1 (Korrektur 0430): binding to the displayed proposal (proposalDigest). */
  readonly proposalDigest?: string;
  /** F1 (Korrektur 0430): binding to the EXACT adapted inputs (inputDigest). */
  readonly inputDigest?: string;
  /** F1 (Korrektur 0430): the user's OWN closed principal identifier. */
  readonly principal?: string;
  readonly answers?: Record<string, string>;
  readonly confirmMapping?: boolean;
  readonly confirmExecution?: boolean;
}

const readBatchAnswers = (file: string): BatchAnswers => {
  const raw = JSON.parse(readFileSync(file, "utf8")) as unknown;
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) throw new Error("BATCH_ANSWERS_DENIED");
  const v = raw as Record<string, unknown>;
  const answers: Record<string, string> = {};
  if (v.answers !== undefined) {
    if (typeof v.answers !== "object" || v.answers === null || Array.isArray(v.answers)) throw new Error("BATCH_ANSWERS_DENIED");
    for (const [key, value] of Object.entries(v.answers as Record<string, unknown>)) {
      if (typeof value !== "string") throw new Error("BATCH_ANSWERS_DENIED");
      answers[key] = value;
    }
  }
  return {
    ...(Object.keys(answers).length > 0 ? { answers } : {}),
    ...(typeof v.confirmMapping === "boolean" ? { confirmMapping: v.confirmMapping } : {}),
    ...(typeof v.confirmExecution === "boolean" ? { confirmExecution: v.confirmExecution } : {}),
    ...(typeof v.goalDigest === "string" && /^[a-f0-9]{64}$/.test(v.goalDigest) ? { goalDigest: v.goalDigest } : {}),
    ...(typeof v.proposalDigest === "string" && /^[a-f0-9]{64}$/.test(v.proposalDigest) ? { proposalDigest: v.proposalDigest } : {}),
    ...(typeof v.inputDigest === "string" && /^[a-f0-9]{64}$/.test(v.inputDigest) ? { inputDigest: v.inputDigest } : {}),
    ...(typeof v.principal === "string" && isValidPrincipalId(v.principal) ? { principal: v.principal } : {}),
  };
};

/** F1 (Korrektur 0430): the user's OWN closed principal identifier — asked
 *  from the user, never invented. EOF / invalid input => null (blocked). */
const askPrincipal = (ask: (prompt: string) => Promise<string | null>): Promise<string | null> =>
  new Promise((resolve) => {
    const loop = async (): Promise<void> => {
      for (let attempt = 0; attempt < 10; attempt += 1) {
        const line = await ask("Deine Nutzeridentifikation (Principal, z. B. user:finance): ");
        if (line === null) { resolve(null); return; }
        const trimmed = line.trim();
        if (isValidPrincipalId(trimmed)) { resolve(trimmed); return; }
        console.log("  UNGÜLTIGE IDENTIFIKATION: geschlossene ID im Format user:abc erforderlich.");
      }
      resolve(null);
    };
    void loop();
  });

interface GoalChoice {
  readonly objective: string;
  readonly requestedOutcome: "FLAG_RECORDS" | "COMPUTE_TOTAL";
  readonly source: "closed-list" | "exact-objective" | "prebound";
}

const resolveGoal = (goalArg: string | undefined, ask: (prompt: string) => Promise<string | null>): Promise<GoalChoice> =>
  new Promise((resolve, reject) => {
    if (goalArg !== undefined) {
      const known = METHOD_GOAL_OBJECTIVE_CHOICES_V1.find((c) => c.objective === goalArg);
      if (known !== undefined) { resolve({ objective: known.objective, requestedOutcome: known.requestedOutcome, source: "prebound" }); return; }
      if (goalArg === "margin") { resolve({ objective: METHOD_GOAL_OBJECTIVE_CHOICES_V1[0]?.objective ?? "", requestedOutcome: METHOD_GOAL_OBJECTIVE_CHOICES_V1[0]?.requestedOutcome ?? "FLAG_RECORDS", source: "prebound" }); return; }
      if (goalArg === "total") { resolve({ objective: METHOD_GOAL_OBJECTIVE_CHOICES_V1[1]?.objective ?? "", requestedOutcome: METHOD_GOAL_OBJECTIVE_CHOICES_V1[1]?.requestedOutcome ?? "COMPUTE_TOTAL", source: "prebound" }); return; }
      // Unknown pre-bound goal: honest denial (nothing is invented).
      reject(new Error("GOAL_NOT_MAPPABLE"));
      return;
    }
    const askLoop = async (): Promise<void> => {
      console.log("Ziel festlegen (geschlossene Auswahl):");
      const marginChoice = METHOD_GOAL_OBJECTIVE_CHOICES_V1[0];
      const totalChoice = METHOD_GOAL_OBJECTIVE_CHOICES_V1[1];
      if (marginChoice !== undefined && totalChoice !== undefined) {
        console.log(`  1) ${marginChoice.label}`);
        console.log(`  2) ${totalChoice.label}`);
        console.log("  oder exaktes Ziel als Freitext eingeben (wird auf geschlossene Absichten geprüft):");
      }
      for (let attempt = 0; attempt < 10; attempt += 1) {
        const line = await ask("> Ziel: ");
        if (line === null) { reject(new Error("EOF_AT_GOAL")); return; }
        const trimmed = line.trim().toLowerCase();
        if (trimmed === "1" && marginChoice !== undefined) { resolve({ objective: marginChoice.objective, requestedOutcome: marginChoice.requestedOutcome, source: "closed-list" }); return; }
        if (trimmed === "2" && totalChoice !== undefined) { resolve({ objective: totalChoice.objective, requestedOutcome: totalChoice.requestedOutcome, source: "closed-list" }); return; }
        const exact = METHOD_GOAL_OBJECTIVE_CHOICES_V1.find((c) => c.objective.toLowerCase() === trimmed);
        if (exact !== undefined) { resolve({ objective: exact.objective, requestedOutcome: exact.requestedOutcome, source: "exact-objective" }); return; }
        console.log("  Ziel nicht in der geschlossenen Auswahl — bitte 1, 2 oder exaktes Ziel wählen.");
      }
      reject(new Error("GOAL_NOT_MAPPABLE"));
    };
    void askLoop();
  });

const askYesNo = (ask: (prompt: string) => Promise<string | null>, prompt: string): Promise<boolean | null> =>
  new Promise((resolve) => {
    const loop = async (): Promise<void> => {
      for (let attempt = 0; attempt < 10; attempt += 1) {
        const line = await ask(`${prompt} [ja/nein]`);
        if (line === null) { resolve(null); return; }
        const trimmed = line.trim().toLowerCase();
        if (isYes(trimmed)) { resolve(true); return; }
        if (isNo(trimmed)) { resolve(false); return; }
        console.log("  Bitte ja oder nein eingeben.");
      }
      resolve(null);
    };
    void loop();
  });

const askOption = (ask: (prompt: string) => Promise<string | null>, _questionId: string, text: string, options: readonly string[]): Promise<string | null> =>
  new Promise((resolve) => {
    const loop = async (): Promise<void> => {
      for (let attempt = 0; attempt < 10; attempt += 1) {
        const line = await ask(text);
        if (line === null) { resolve(null); return; }
        const trimmed = line.trim().toLowerCase();
        const byNumber = /^\d+$/.test(trimmed) ? Number(trimmed) : null;
        if (byNumber !== null && byNumber >= 1 && byNumber <= options.length) {
          const option = options[byNumber - 1];
          if (option !== undefined) { resolve(option); return; }
        }
        const byValue = options.find((o) => o.toLowerCase() === trimmed);
        if (byValue !== undefined) { resolve(byValue); return; }
        console.log("  Bitte eine der geschlossenen Optionen eingeben (Nr. oder Wert).");
      }
      resolve(null);
    };
    void loop();
  });

/**
 * F1 — the REAL interactive user path: goal capture -> visible selection ->
 * visible proposal -> explicit user answers -> explicit user confirmations ->
 * execution. Every decision is the USER's (origin: user input), never
 * invented; EOF or decline never executes.
 */
const runInteractivePath = async (args: {
  readonly target: string;
  readonly pack: import("./context-source.js").ContextPackV1;
  readonly goalArg: string | undefined;
  readonly answersFile: string | undefined;
  readonly sourceProvenance?: {
    readonly host: string; readonly port: number; readonly database: string;
    readonly user: string; readonly statement: string; readonly rowCount: number;
    readonly readbackDigest: string;
  };
}): Promise<number> => {
  const spec = loadSpec();
  const library = loadLibrary();
  const nowMs = Date.now(); // F4: real clock
  const sources = lineSource(process.stdin);
  const ask = async (prompt: string): Promise<string | null> => {
    process.stdout.write(prompt);
    const line = await sources.next();
    return line.done ? null : line.value ?? null;
  };
  const batch = args.answersFile !== undefined ? readBatchAnswers(args.answersFile) : undefined;
  // F1 (Korrektur 0430): the principal is NEVER invented. Interactive mode
  // asks the user for their own closed identifier; batch mode must carry an
  // explicit, ID-validated principal in the file.
  const principal = batch !== undefined ? batch.principal : await askPrincipal(ask);
  if (batch !== undefined && principal === undefined) {
    console.log("# ABGELEHNT: Batch-Datei bindet keinen ausdrücklichen, gültigen Principal (Nutzeridentifikation fehlt)");
    return 4;
  }
  if (batch === undefined && principal === null) {
    console.log("# ABGEBROCHEN: EOF vor Principal-Erfassung — keine Auswahl, keine Ausführung, keine Receipt");
    return 4;
  }
  const batchAsk = (prompt: string): Promise<string | null> => {
    // Batch mode is ONLY an explicit-decision transport: no implicit answers.
    void prompt;
    return Promise.resolve(null);
  };

  let code: number;
  try {
    // 1) Goal capture (F1/F3).
    // Batch mode has NO implicit goal capture: without --goal the path is
    // blocked (EOF at goal), never a goal is invented.
    const goalAsk = batch !== undefined ? batchAsk : ask;
    const goalChoice = await resolveGoal(args.goalArg, goalAsk);
    const goal: MethodGoalV1 = {
      schemaVersion: "pansphaira.kts/method-goal/v1",
      goalId: `goal:${args.target.replace(/^csv:/, "").replace(/[^a-z0-9-]/g, "-")}-user`,
      actor: principal as string,
      objective: goalChoice.objective,
      requestedOutcome: goalChoice.requestedOutcome,
      constraints: [],
    };
    if (!validateMethodGoalV1(goal)) throw new GuidedPathDenied("GOAL_DENIED");
    // F1 (Korrektur 0430): the decision is BOUND to the user's input BEFORE
    // anything else — the goalDigest seals the exact goal object the user
    // chose (pre-bound --goal or the closed-list line). Batch mode must
    // carry this goalDigest (honest decision origin, no invented binding).
    const goalDigest = sha256Hex(goal);
    if (batch !== undefined && batch.goalDigest !== goalDigest) {
      console.log("# ABGELEHNT: Batch-Datei bindet nicht das erfasste Ziel (goalDigest fehlt oder weicht ab)");
      return 4;
    }
    console.log(`# Ziel (Nutzer, ${goalChoice.source})`);
    console.log(`objective: ${goal.objective}`);
    console.log(`outcome:   ${goal.requestedOutcome}   actor: ${goal.actor} (Nutzer)`);
    console.log(`goalDigest: ${goalDigest}`);
    console.log("");

    const builder = GuidedPathBuilder.fromContext({ pack: args.pack, spec, goal });
    builder.recordGoal();
    // F4 (Korrektur 0430): bind the sealed library so the pre-execution
    // knowledge re-check re-resolves exactly THIS library at the ACTUAL clock.
    builder.bindLibrary(library);
    console.log(`# Bibliotheksauswahl (deterministisch, digest-gebunden; Uhr: ${new Date(nowMs).toISOString()})`);
    const view = buildInteractiveView(library, goal, nowMs);
    const selection = view.selection;
    printSelection(selection);
    console.log("");

    if (selection.outcome !== "SELECTED") {
      // attachSelection has already sealed the terminal before throwing
      // (F1/F4 Restbefund: a selection the user did not choose is a
      // technical DENIAL, never a user rejection).
      if (builder.build().terminal === "IN_PROGRESS") {
        builder.deny(`selection_${selection.outcome.toLowerCase()}`);
      }
      code = 5;
      return finalizeInteractive(builder, { selection, receipt: null, answered: 0, confirmations: [], outcome: "DENIED", code, sourceProvenance: args.sourceProvenance });
    }
    builder.attachSelection(view);
    let mapping = builder.proposal();
    // F1 (Korrektur 0430): the batch file must bind THIS displayed proposal
    // (its proposalDigest) before it can answer or release anything — an
    // unbound or foreign digest never authorizes the shown proposal.
    if (batch !== undefined && batch.proposalDigest !== mapping.proposalDigest) {
      console.log("# ABGELEHNT: Batch-Datei bindet nicht den angezeigten Vorschlag (proposalDigest fehlt oder weicht ab)");
      return 4;
    }
    builder.recordProposal();
    console.log("# Mapping-Vorschlag (Agentenvorschlag — noch NICHT bestätigt)");
    printMapping(mapping);
    console.log("");

    // 2) Explicit user answers to every blocking Rückfrage (F1/F2).
    let answered = 0;
    const givenAnswers: { questionId: string; answer: string }[] = [];
    for (let round = 0; round < 32; round += 1) {
      const pending = builder.proposal().openQuestions.filter((q) => q.options.length > 0);
      if (pending.length === 0) break;
      let progress = 0;
      for (const question of pending) {
        const given = batch?.answers?.[question.questionId];
        if (given !== undefined) {
          if (!question.options.includes(given)) {
            console.log(`  Antwort zu [${question.questionId}] ist nicht in den geschlossenen Optionen gebunden — Vorschlag bleibt offen.`);
            continue;
          }
          builder.answer(question.questionId, given, Date.now());
          givenAnswers.push({ questionId: question.questionId, answer: given });
          answered += 1;
          progress += 1;
          console.log(`  Antwort (Batch, gebunden an Vorschlag): ${given}`);
          continue;
        }
        if (batch !== undefined) {
          console.log(`  [Frage ${question.questionId}] nicht im Batch-Entscheidungsfile enthalten — bleibt offen.`);
          continue;
        }
        console.log(`[Frage ${String(answered + 1)}] (${question.field})`);
        question.options.forEach((option, index) => console.log(`  ${String(index + 1)}) ${option}`));
        const option = await askOption(ask, question.questionId, "  Deine Antwort: ", question.options);
        if (option === null) {
          console.log("  (EOF — Frage unbeantwortet; Ausführung wird NICHT erfolgen)");
          continue;
        }
        builder.answer(question.questionId, option, Date.now());
        givenAnswers.push({ questionId: question.questionId, answer: option });
        answered += 1;
        progress += 1;
      }
      if (progress === 0) break;
      mapping = builder.proposal();
    }
    const rejectedByAnswer = givenAnswers.some((a) => a.answer === "ablehnen" || a.answer === "kontext_nicht_ausfuhrbar");
    const remainingBlocking = mapping.openQuestions.filter((q) => q.options.length > 0);
    if (rejectedByAnswer) {
      builder.reject("context_declined_by_user");
      code = 3;
      return finalizeInteractive(builder, { selection, receipt: null, answered, confirmations: [], outcome: "REJECTED_BY_USER", code, sourceProvenance: args.sourceProvenance });
    }
    if (remainingBlocking.length > 0) {
      console.log("");
      console.log(`# OFFEN GEBLIEBENE FRAGEN (${String(remainingBlocking.length)}): Ausführung blockiert, keine Receipt`);
      for (const q of remainingBlocking) console.log(`  [${q.questionId}] (${q.field}) ${q.question}`);
      // F1 (Restbefund): BLOCKED is sealed into the chain — the SEALED
      // terminal states that nobody declined; reject is for users only.
      builder.block("open_questions_unanswered");
      code = 4;
      // F1 (Korrektur 0430): unanswered questions are a BLOCK, not a
      // rejection by a user (nobody declined) — honest outcome.
      return finalizeInteractive(builder, { selection, receipt: null, answered, confirmations: [], outcome: "BLOCKED_OPEN_QUESTIONS", code, sourceProvenance: args.sourceProvenance });
    }
    if (batch === undefined) {
      // Show the FINAL (answer-bound) proposal before confirmation.
      console.log("");
      console.log("# Mapping-Vorschlag (final, mit deinen Antworten gebunden)");
      printMapping(mapping);
    }
    // F1: in batch mode the confirmations are EXPLICIT decisions from the
    // answers file (bound to this displayed proposal); interactive mode asks.
    const mapDecision = batch !== undefined
      ? (typeof batch.confirmMapping === "boolean" ? batch.confirmMapping : null)
      : await askYesNo(ask, "Bestätigst du diesen Mapping-Vorschlag (Auswahl, Einheiten, Bedeutung)?");
    if (mapDecision === null) {
      console.log("(EOF — keine Bestätigung; Ausführung wird NICHT erfolgen)");
      // F1 (Restbefund): the SEALED terminal is BLOCKED (the chain carries
      // the block reason), not REJECTED_BY_USER — nobody declined.
      builder.block("mapping_confirmation_not_given");
      code = 4;
      // F1 (Korrektur 0430 + Restbefund): EOF is NOT a rejection by a user —
      // nobody declined. Honest outcome AND sealed terminal: BLOCKED.
      // BLOCKED_BY_EOF (blocked, no receipt).
      return finalizeInteractive(builder, { selection, receipt: null, answered, confirmations: [], outcome: "BLOCKED_BY_EOF", code, sourceProvenance: args.sourceProvenance });
    }
    if (!mapDecision) {
      builder.reject("mapping_rejected_by_user");
      code = 3;
      return finalizeInteractive(builder, { selection, receipt: null, answered, confirmations: [], outcome: "REJECTED_BY_USER", code, sourceProvenance: args.sourceProvenance });
    }
    const mappingDecision = builder.confirmMapping(
      batch !== undefined
        ? `decision:batch-${args.target.replace(/[^a-z0-9-]/g, "-")}-mapping`
        : `decision:interactive-${args.target.replace(/[^a-z0-9-]/g, "-")}-mapping`,
      principal as string,
      Date.now(),
    );
    const confirmations: { readonly subjectKind: "CONTEXT_MAPPING" | "EXECUTION"; readonly decisionDigest: string; readonly proposalDigest: string }[] = [
      { subjectKind: "CONTEXT_MAPPING", decisionDigest: mappingDecision.decisionDigest, proposalDigest: mappingDecision.proposalDigest },
    ];
    const inputs = adaptContextToMarginInputsV1({ context: builder.build().context, mapping, pack: args.pack });
    console.log("");
    console.log("# Adaptierte Inputs (ausführbar)");
    console.log(`marginFloorEur: ${inputs.marginFloorEur}  (${inputs.invoices.length} Rechnungen)`);
    for (const invoice of inputs.invoices) {
      console.log(`  - ${invoice.invoiceId}: ${String(invoice.totalMinor)} Cent EUR, faellig ${invoice.dueDate}, kunde ${invoice.customerId ?? "(unbekannt)"}`);
    }
    console.log("");
    // F1 (Korrektur 0430): the execution release binds the EXACT adapted
    // inputs (inputDigest) — a generic yes for DIFFERENT inputs is denied.
    const inputDigest = sha256Hex(inputs);
    if (batch !== undefined && batch.inputDigest !== inputDigest) {
      console.log("# ABGELEHNT: Batch-Datei bindet nicht die exakten adaptierten Inputs (inputDigest fehlt oder weicht ab)");
      builder.block("execution_inputs_not_bound");
      code = 4;
      return finalizeInteractive(builder, { selection, receipt: null, answered, confirmations, outcome: "BLOCKED_INPUTS_UNBOUND", code, sourceProvenance: args.sourceProvenance });
    }
    const execDecision = batch !== undefined
      ? (typeof batch.confirmExecution === "boolean" ? batch.confirmExecution : null)
      : await askYesNo(ask, "Bestätigst du die Ausführung mit genau diesen adaptierten Inputs?");
    if (execDecision === null) {
      console.log("(EOF — keine Bestätigung; Ausführung wird NICHT erfolgen)");
      // F1 (Restbefund): SEALED terminal = BLOCKED (not REJECTED_BY_USER).
      builder.block("execution_confirmation_not_given");
      code = 4;
      return finalizeInteractive(builder, { selection, receipt: null, answered, confirmations, outcome: "BLOCKED_BY_EOF", code, sourceProvenance: args.sourceProvenance });
    }
    if (!execDecision) {
      builder.reject("execution_rejected_by_user");
      code = 3;
      return finalizeInteractive(builder, { selection, receipt: null, answered, confirmations, outcome: "REJECTED_BY_USER", code, sourceProvenance: args.sourceProvenance });
    }
    const executionDecision = builder.confirmExecution(
      batch !== undefined
        ? `decision:batch-${args.target.replace(/[^a-z0-9-]/g, "-")}-execution`
        : `decision:interactive-${args.target.replace(/[^a-z0-9-]/g, "-")}-execution`,
      principal as string,
      inputs,
      Date.now(),
    );
    confirmations.push({ subjectKind: "EXECUTION", decisionDigest: executionDecision.decisionDigest, proposalDigest: executionDecision.proposalDigest });
    // F4 (Korrektur 0430): the ACTUAL knowledge validity of the already-
    // selected, PENDING builder is re-checked IMMEDIATELY before execution
    // (actual clock). Knowledge that went stale since the selection denies
    // the execution — the missing re-check of the independent review's
    // counterexample ("frische Auswahl -> Bestätigung -> Ablauf -> EXECUTED").
    const executionNowMs = Date.now();
    const recheckView = buildInteractiveView(library, goal, executionNowMs);
    if (recheckView.selection.outcome !== "SELECTED" || recheckView.selection.selected === null
      || recheckView.selection.selected.methodId !== spec.methodId
      || recheckView.selection.selected.specDigest !== spec.specDigest) {
      builder.deny("knowledge_expired_before_execution");
      code = 5;
      return finalizeInteractive(builder, { selection, receipt: null, answered, confirmations, outcome: "DENIED_KNOWLEDGE_EXPIRED", code, sourceProvenance: args.sourceProvenance });
    }
    try {
      // executeView seals the DENIED terminal itself on failure — no second
      // reject (double terminal).
      builder.executeView(recheckView, executionNowMs);
    } catch {
      code = 5;
      return finalizeInteractive(builder, { selection, receipt: null, answered, confirmations, outcome: "DENIED_KNOWLEDGE_EXPIRED", code, sourceProvenance: args.sourceProvenance });
    }
    const receipt = builder.execute(executionDecision, inputs);
    code = receipt.outcome === "EXECUTED" ? 0 : 5;
    return finalizeInteractive(builder, { selection, receipt, answered, confirmations, outcome: receipt.outcome, code, sourceProvenance: args.sourceProvenance });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (message === "EOF_AT_GOAL") {
      console.log("# ABGEBROCHEN: EOF vor Zielbestätigung — keine Auswahl, keine Ausführung, keine Receipt");
      return 4;
    }
    if (message === "GOAL_NOT_MAPPABLE") {
      console.log("# ABGEBROCHEN: Ziel ist in keine geschlossene fachliche Absicht überführbar (keine erfundene Eignung)");
      return 5;
    }
    throw error;
  }
};

const buildInteractiveView = (library: MethodLibraryV1, goal: MethodGoalV1, nowMs: number) =>
  buildLibraryViewV1({ library, goal, nowMs });

/* ---------------------------- selection / mapping printing ------------ */

const printSelection = (selection: MethodSelectionV1): void => {
  console.log(`selection.outcome: ${selection.outcome}`);
  for (const candidate of selection.candidates) {
    console.log(`  candidate: ${candidate.methodId} (v${candidate.version})`);
  }
  if (selection.selected !== null) {
    console.log(`SELECTED: ${selection.selected.methodId} reasons=[${selection.selected.reasons.join(", ")}]`);
  }
  for (const rejected of selection.rejected) {
    console.log(`REJECTED: ${rejected.methodId} reasons=[${rejected.reasons.join(", ")}]`);
  }
  console.log(`authorityBoundary: ${selection.authorityBoundary}`);
};

const printMapping = (mapping: {
  readonly fieldMappings: readonly { readonly sourceField: string; readonly specField: string; readonly conversion: string; readonly factor: number | null; readonly meaning: string }[];
  readonly adaptations: readonly { readonly kind: string; readonly detail: string }[];
  readonly openQuestions: readonly { readonly questionId: string; readonly field: string; readonly question: string; readonly options: readonly string[] }[];
  readonly proposalDigest: string;
}): void => {
  for (const fieldMapping of mapping.fieldMappings) {
    console.log(`  ${fieldMapping.sourceField} -> ${fieldMapping.specField} [${fieldMapping.conversion}${fieldMapping.factor !== null ? ` x${String(fieldMapping.factor)}` : ""}]`);
    console.log(`      Bedeutung: ${fieldMapping.meaning}`);
  }
  if (mapping.adaptations.length > 0) {
    console.log("  Anpassungen:");
    for (const adaptation of mapping.adaptations) console.log(`    - [${adaptation.kind}] ${adaptation.detail}`);
  }
  if (mapping.openQuestions.length > 0) {
    console.log(`  Offene Rückfragen: ${String(mapping.openQuestions.length)}`);
    for (const question of mapping.openQuestions) console.log(`    [${question.questionId}] (${question.field}) ${question.question}`);
  }
  console.log(`  proposalDigest: ${mapping.proposalDigest.slice(0, 16)}…`);
};

/* ------------------------------ finalization ------------------------- */

interface InteractiveFinal {
  readonly selection: MethodSelectionV1;
  readonly receipt: import("./method-core.js").MethodExecutionReceiptV1 | null;
  readonly answered: number;
  readonly confirmations: readonly { readonly subjectKind: "CONTEXT_MAPPING" | "EXECUTION"; readonly decisionDigest: string; readonly proposalDigest: string }[];
  readonly outcome: string;
  readonly code: number;
  readonly sourceProvenance: {
    readonly host: string; readonly port: number; readonly database: string;
    readonly user: string; readonly statement: string; readonly rowCount: number;
    readonly readbackDigest: string;
  } | undefined;
}

const finalizeInteractive = (builder: GuidedPathBuilder, final: InteractiveFinal): number => {
  const path = builder.build();
  printUserPathLike({
    label: "interaktiver Nutzerweg (Nutzerautorität)",
    contextId: path.context.contextId,
    contextSourceFormat: path.context.sourceFormat,
    methodId: final.selection.selected?.methodId ?? "(keine)",
    specDigest: "see selection (digest-bound)",
    provenance: final.sourceProvenance,
    answered: final.answered,
    terminal: path.terminal,
    outcome: final.outcome,
    receipt: final.receipt,
    confirmations: final.confirmations,
    pathDigest: path.chainDigest,
  });
  return final.code;
};

const printUserPathLike = (args: {
  readonly label: string;
  readonly contextId: string;
  readonly contextSourceFormat: string;
  readonly methodId: string;
  readonly specDigest: string;
  readonly provenance: { readonly host: string; readonly port: number; readonly database: string; readonly user: string; readonly statement: string; readonly rowCount: number; readonly readbackDigest: string } | undefined;
  readonly answered: number;
  readonly terminal: string;
  readonly outcome: string;
  readonly receipt: {
    readonly outcome: string; readonly denialReasons: readonly string[]; readonly ruleProvenance: string;
    readonly inputDigest: string; readonly decisionDigest: string; readonly receiptDigest: string;
    readonly result: { readonly count: number; readonly totalInputMinor: number; readonly flagged: readonly { readonly recordId: string; readonly valueMinor: number; readonly reason: string }[] } | null;
  } | null;
  readonly confirmations: readonly { readonly subjectKind: string; readonly decisionDigest: string; readonly proposalDigest: string }[];
  readonly pathDigest: string;
}): void => {
  console.log(`# ${args.label}`);
  console.log(`contextId:     ${args.contextId}`);
  console.log(`contextSource: ${args.contextSourceFormat}`);
  console.log(`methodId:      ${args.methodId}`);
  if (args.provenance !== undefined) {
    const sp = args.provenance;
    console.log(`source:        PostgreSQL ${sp.host}:${sp.port}/${sp.database} as ${sp.user} (read-only)`);
    console.log(`statement:     ${sp.statement}`);
    console.log(`readback:      rows=${String(sp.rowCount)} digest=${sp.readbackDigest.slice(0, 16)}…`);
  }
  console.log(`rückfragen:    ${String(args.answered)} beantwortet (ausdrückliche Nutzerantworten)`);
  for (const confirmation of args.confirmations) {
    console.log(`freigabe:      ${confirmation.subjectKind} decisionDigest=${confirmation.decisionDigest.slice(0, 16)}… (Nutzer)`);
  }
  console.log(`terminal:      ${args.terminal}`);
  console.log(`outcome:       ${args.outcome}`);
  if (args.receipt !== null) {
    const receipt = args.receipt;
    console.log(`ruleProvenance: ${receipt.ruleProvenance}`);
    console.log(`inputDigest:    ${receipt.inputDigest}`);
    console.log(`receiptDigest:  ${receipt.receiptDigest}`);
    if (receipt.result !== null) {
      console.log(`flagged:        ${String(receipt.result.count)} of ${String(receipt.result.totalInputMinor)} minor EUR input`);
      for (const flagged of receipt.result.flagged) console.log(`  - ${flagged.recordId} (${String(flagged.valueMinor)} minor) — ${flagged.reason}`);
    } else {
      console.log(`denialReasons:  ${receipt.denialReasons.join(", ")}`);
    }
  }
  console.log("");
  console.log("--- path (machine readable) ---");
  console.log(JSON.stringify({ terminal: args.terminal, outcome: args.outcome, pathDigest: args.pathDigest, receipt: args.receipt }, null, 2));
};

/* ------------------------------ demo path ---------------------------- */

const runDemoPath = (args: {
  readonly label: string;
  readonly pack: import("./context-source.js").ContextPackV1;
  readonly prefix: string;
  readonly sourceProvenance: {
    readonly host: string; readonly port: number; readonly database: string;
    readonly user: string; readonly statement: string; readonly rowCount: number;
    readonly readbackDigest: string;
  } | undefined;
}): number => {
  const spec = loadSpec();
  // F4: the demo keeps a DETERMINISTIC clock, but it is an EXPLICIT fixture
  // mode (--demo): the real, re-observed corpus edition is used with a fixed
  // nowMs inside its staleness window. No frozen production clock.
  const demoNowMs = DEMO_NOW_MS;
  const library = loadMethodLibraryV1({
    corpusRoot: path.join(PKG, "corpus"),
    packageRoot: PKG,
    profile: JSON.parse(readFileSync(path.join(PKG, "profiles", "corpus-profile.json"), "utf8")),
    nowMs: demoNowMs,
  });
  const result = runUserPathV1({
    pack: args.pack,
    spec,
    library,
    nowMs: demoNowMs,
    principal: DEMO_PRINCIPAL,
    decisionPrefix: args.prefix,
    answerPolicy: defaultAnswerPolicyV1,
    ...(args.sourceProvenance !== undefined ? { sourceProvenance: args.sourceProvenance } : {}),
  });
  printDemoPath(result);
  return result.outcome === "EXECUTED" ? 0 : 3;
};

const DEMO_NOW_MS = 1789900000000; // 2026-09-20T10:26:40Z — explicit demo fixture clock (inside the 365d window of the re-observed edition)

const printDemoPath = (result: ReturnType<typeof runUserPathV1>): void => {
  console.log(`# Integrierter Nutzerweg (Demo, expliziter --demo-Modus, deterministische Uhr ${new Date(result.path.steps[0] === undefined ? 0 : DEMO_NOW_MS).toISOString()})`);
  console.log(`contextId:     ${result.contextId}`);
  console.log(`contextSource: ${result.contextSourceFormat}`);
  console.log(`methodId:      ${result.methodId}`);
  console.log(`specDigest:    ${result.specDigest}`);
  if (result.sourceProvenance !== undefined) {
    const sp = result.sourceProvenance;
    console.log(`source:        PostgreSQL ${sp.host}:${sp.port}/${sp.database} as ${sp.user} (read-only)`);
    console.log(`statement:     ${sp.statement}`);
    console.log(`readback:      rows=${String(sp.rowCount)} digest=${sp.readbackDigest.slice(0, 16)}…`);
  }
  console.log(`selection:     ${result.selection.outcome} (${result.selection.selected?.methodId ?? "—"})`);
  console.log(`rückfragen:    ${String(result.openQuestionsAnswered)} beantwortet (deterministische Antwortpolitik — EXPLIZITER Demo-Modus)`);
  console.log(`terminal:      ${result.path.terminal}`);
  console.log(`outcome:       ${result.outcome}`);
  if (result.receipt !== null) {
    const receipt = result.receipt;
    console.log(`ruleProvenance: ${receipt.ruleProvenance}`);
    console.log(`inputDigest:    ${receipt.inputDigest}`);
    console.log(`receiptDigest:  ${receipt.receiptDigest}`);
    if (receipt.result !== null) {
      console.log(`flagged:        ${String(receipt.result.count)} of ${String(receipt.result.totalInputMinor)} minor EUR input`);
      for (const flagged of receipt.result.flagged) console.log(`  - ${flagged.recordId} (${String(flagged.valueMinor)} minor) — ${flagged.reason}`);
    } else {
      console.log(`denialReasons:  ${receipt.denialReasons.join(", ")}`);
    }
  }
  console.log("");
  console.log("--- receipt (machine readable) ---");
  console.log(JSON.stringify(result.receipt, null, 2));
};

/* -------------------------------- main ------------------------------- */

const main = async (argv: readonly string[]): Promise<number> => {
  const [command, targetRaw, ...rest] = argv;
  if (command === "help" || command === undefined) {
    usage();
    return 0;
  }
  if (command === "library") {
    printLibrary();
    return 0;
  }
  if (command === "run") {
    const options: { demo: boolean; goal: string | undefined; answers: string | undefined } = { demo: false, goal: undefined, answers: undefined };
    for (let i = 0; i < rest.length; i += 1) {
      const token = rest[i];
      if (token === "--demo") options.demo = true;
      else if (token === "--goal") options.goal = rest[++i];
      else if (token === "--answers") options.answers = rest[++i];
    }
    const target = targetRaw;
    if (typeof target !== "string") { usage(); return 2; }
    if (target === "postgres") {
      const dataDir = pgDataDirFor(ROOT);
      const harness: PgHarness = await startRealPostgres(dataDir);
      try {
        const { pack, readback } = await readMarginContextFromPostgresV1({
          conn: { host: "127.0.0.1", port: PG_PORT, database: PG_DATABASE, user: PG_RO_USER, password: PG_RO_PASSWORD },
          schema: PG_SCHEMA,
          // F5: FRESH read-only client — the adapter owns the connection now
          // (bounded probe + connect); a dead endpoint is rejected, no hang.
          client: new (await import("pg")).Client({
            host: "127.0.0.1", port: PG_PORT, database: PG_DATABASE, user: PG_RO_USER, password: PG_RO_PASSWORD,
          }),
        });
        const provenance = {
          host: "127.0.0.1",
          port: (await runReadOnlyQueryV1<{ inet_server_port: number }>(harness.ro, "SELECT inet_server_port()"))[0]?.inet_server_port ?? 0,
          database: readback.database,
          user: readback.user,
          statement: readback.statement,
          rowCount: readback.rowCount,
          readbackDigest: readback.readbackDigest,
        };
        if (options.demo) {
          const code = runDemoPath({ label: "postgres", pack, prefix: "cli-pg", sourceProvenance: provenance });
          return code;
        }
        const code = await runInteractivePath({
          target: "postgres",
          pack,
          goalArg: options.goal,
          answersFile: options.answers,
          sourceProvenance: provenance,
        });
        return code;
      } finally {
        await harness.stop();
      }
    }
    if (typeof target === "string" && target.startsWith("csv:")) {
      const name = target.slice("csv:".length);
      let pack;
      try {
        pack = loadContextPack(name);
      } catch (error) {
        console.error(`CONTEXT_MISSING: ${name} (${error instanceof Error ? error.message : String(error)})`);
        return 1;
      }
      if (options.demo) {
        return runDemoPath({ label: name, pack, prefix: `cli-${name}`, sourceProvenance: undefined });
      }
      return runInteractivePath({ target, pack, goalArg: options.goal, answersFile: options.answers });
    }
    usage();
    return 2;
  }
  usage();
  return 2;
};

main(process.argv.slice(2))
  .then((code) => {
    // All async cleanup (e.g. harness.stop()) has already been awaited in
    // `main`, so an immediate process.exit() is safe here.
    process.exit(code);
  })
  .catch((error: unknown) => {
    console.error(`USER_PATH_FAILED: ${error instanceof Error ? error.message : String(error)}`);
    process.exit(1);
  });
