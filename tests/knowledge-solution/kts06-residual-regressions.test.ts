/**
 * KTS-06 — Restbefund-Regressionen (KTS-C26-REVIEW.md, unabhängige
 * Reproduktion der Gegenbeispiele F1/F2/F4/F5).
 *
 * KTS-05 pinnt die Korrektur-Regressionen des 0430-Zyklus. Diese Datei
 * pinnt die NOCH OFFENEN Restbefunde der unabhängigen Abnahme:
 *
 * F1 — die EOF-/Block-Zustände müssen bis in die VERSIEGELTE Kette
 *      reichen (terminal=BLOCKED mit sealed BLOCKED-Step), nicht nur als
 *      gedrucktes Outcome-Label; `reject`/REJECTED_BY_USER ist exklusiv
 *      für tatsächliche Nutzerablehnung.
 * F2 — geschlossene semantische Identität: ein fehlender/widerrsprechender
 *      meaningKey blockiert, ein exakter keyMatch akzeptiert; freie Texte
 *      sind nie ein Eignungsnachweis (keine Negations-/Wortliste als
 *      Ersatz).
 * F4 — die frische Wissensprüfung ist INNERHALB der Builder-Ausführung
 *      unvermeidbar: ein direkter builder.execute() ohne executeView()
 *      darf nach Ablauf nicht ausführen.
 * F5 — der verwendete Client ist an die geprüfte Rolle gebunden; ein
 *      fehlgeschlagener Connect räumt den ECHTEN Socket auf; die eigentliche
 *      Leseabfrage hat serverseitig durchgesetzte Zeitgrenzen.
 *
 * Compiled test: dist/tests/knowledge-solution/kts06-residual-regressions.test.js
 */
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import { randomUUID } from "node:crypto";
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { createServer } from "node:net";
import path from "node:path";
import test, { after } from "node:test";
import { Client } from "pg";
import { validateMethodGoalV1, validateMethodSpecV1, type MethodGoalV1, type MethodSpecV1 } from "../../packages/knowledge-solution/src/method-core.js";
import {
  buildLibraryViewV1,
  loadMethodLibraryV1,
  METHOD_GOAL_OBJECTIVE_CHOICES_V1,
} from "../../packages/knowledge-solution/src/method-library.js";
import { canonicalJson } from "../../packages/contracts/src/canonical-json.js";
import {
  contextDataDigestV1,
  contextDescriptorDigestV1,
  loadContextPackV1,
  type ContextPackV1,
} from "../../packages/knowledge-solution/src/context-source.js";
import {
  GuidedPathBuilder,
  GuidedPathDenied,
  adaptContextToMarginInputsV1,
  validateGuidedStepV1,
} from "../../packages/knowledge-solution/src/guided-path.js";
import { runUserPathV1 } from "../../packages/knowledge-solution/src/user-path.js";
import {
  PG_ADMIN_PASSWORD,
  PG_ADMIN_USER,
  PG_DATABASE,
  PG_PORT,
  PG_RO_PASSWORD,
  PG_RO_USER,
  PG_SCHEMA,
  pgDataDirFor,
  startRealPostgres,
  type PgHarness,
} from "../../packages/knowledge-solution/src/pg-harness.js";
import {
  PG_READ_LOCK_TIMEOUT_MS_V1,
  ensurePostgresClientConnectedV1,
  PostgresReadDenied,
  readMarginContextFromPostgresV1,
} from "../../packages/knowledge-solution/src/postgres-source.js";

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..", "..", "..");
const PKG = path.join(ROOT, "packages", "knowledge-solution");
const NOW_MS = 1758532800000; // inside the re-observed edition window
const EXPIRED_MS = NOW_MS + 800 * 24 * 60 * 60 * 1000; // beyond the 365d window
const DATA_DIR = pgDataDirFor(ROOT);

const loadSpec = (): MethodSpecV1 => {
  const spec = JSON.parse(readFileSync(path.join(PKG, "specs", "margin-threshold.spec.json"), "utf8")) as unknown;
  if (!validateMethodSpecV1(spec)) throw new Error("SPEC_DENIED");
  return spec;
};
const loadLibrary = (nowMs: number = NOW_MS) =>
  loadMethodLibraryV1({
    corpusRoot: path.join(PKG, "corpus"),
    packageRoot: PKG,
    profile: JSON.parse(readFileSync(path.join(PKG, "profiles", "corpus-profile.json"), "utf8")),
    nowMs,
  });

const marginGoal = (): MethodGoalV1 => {
  const choice = METHOD_GOAL_OBJECTIVE_CHOICES_V1[0];
  if (choice === undefined) throw new Error("GOAL_CHOICES_MISSING");
  const goal: MethodGoalV1 = {
    schemaVersion: "pansphaira.kts/method-goal/v1",
    goalId: `goal:${randomUUID()}`,
    actor: "principal:finance-reviewer",
    objective: choice.objective,
    requestedOutcome: choice.requestedOutcome,
    constraints: [],
  };
  if (!validateMethodGoalV1(goal)) throw new Error("GOAL_INVALID");
  return goal;
};

/** Temp pack with one mutated field (closed digest chain recomputed). */
const tempPack = (mutate: (descriptor: Record<string, unknown>, rows: Record<string, string | null>[]) => void): ContextPackV1 => {
  const base = loadContextPackV1(path.join(PKG, "contexts", "invoices-eur-cent"));
  const descriptor: Record<string, unknown> = { ...base.descriptor, fields: base.descriptor.fields.map((f) => ({ ...f })) };
  const rows = base.data.rows.map((row) => ({ ...row }));
  mutate(descriptor, rows);
  const descriptorDigest = contextDescriptorDigestV1(descriptor);
  const unsignedData = {
    schemaVersion: base.data.schemaVersion,
    contextId: base.data.contextId,
    descriptorDigest,
    floorField: base.data.floorField,
    floorRaw: base.data.floorRaw,
    rows,
  };
  return {
    descriptor: { ...(descriptor as { contextId: string }), descriptorDigest } as ContextPackV1["descriptor"],
    data: { ...unsignedData, dataDigest: contextDataDigestV1(unsignedData) } as ContextPackV1["data"],
  };
};

/** The sealed chain must be internally consistent (every step verifies). */
const assertChainValid = (builder: GuidedPathBuilder): void => {
  const built = builder.build();
  for (const step of built.steps) {
    assert.ok(validateGuidedStepV1(step), "every sealed step must pass the digest validator");
  }
};

/* ===================== F1 — sealed BLOCKED / honest terminals ===================== */

test("F1-residual: user-path EOF (no explicit answer) seals terminal=BLOCKED with a sealed BLOCKED step (not REJECTED_BY_USER)", () => {
  const pack = loadContextPackV1(path.join(PKG, "contexts", "legacy-erp-de")); // nullable kunden_nr => one open question
  const spec = loadSpec();
  const result = runUserPathV1({
    pack,
    spec,
    library: loadLibrary(),
    nowMs: NOW_MS,
    principal: "principal:finance-reviewer",
    decisionPrefix: "kts06-f1-eof",
    goal: marginGoal(),
    answerPolicy: () => undefined, // nobody answered: EOF
  });
  // Nobody declined => this is a BLOCK, not a user rejection.
  assert.equal(result.outcome, "BLOCKED");
  assert.equal(result.receipt, null);
  assert.equal(result.path.terminal, "BLOCKED", "the SEALED terminal must be BLOCKED, not REJECTED_BY_USER");
  assert.ok(result.pendingQuestions.length > 0, "the unanswered question stays visible");
  // The BLOCKED state is sealed into the digest chain (not just printed).
  const blockedStep = result.path.steps.find((s) => s.kind === "BLOCKED");
  assert.ok(blockedStep !== undefined, "a sealed BLOCKED step must exist in the chain");
  assert.equal((blockedStep?.payload as { reason?: string }).reason, "open_questions_unanswered");
});

test("F1-residual: a GENUINE user decline still seals REJECTED_BY_USER (the terminal stays user-attributed)", () => {
  // The LEGACY context carries a real blocking question (nullable
  // kunden_nr) that offers "ablehnen" — the decline is a genuine user
  // answer to a real question (the clean EUR context has none, so a
  // decline policy there would answer nothing and the path would run).
  const pack = loadContextPackV1(path.join(PKG, "contexts", "legacy-erp-de"));
  const spec = loadSpec();
  const result = runUserPathV1({
    pack,
    spec,
    library: loadLibrary(),
    nowMs: NOW_MS,
    principal: "principal:finance-reviewer",
    decisionPrefix: "kts06-f1-reject",
    goal: marginGoal(),
    answerPolicy: () => "ablehnen",
  });
  assert.equal(result.outcome, "REJECTED_BY_USER");
  assert.equal(result.path.terminal, "REJECTED_BY_USER");
  assert.equal(result.receipt, null);
  const rejectedStep = result.path.steps.find((s) => s.kind === "REJECTED_BY_USER");
  assert.ok(rejectedStep !== undefined, "the rejection must be sealed into the chain");
});

test("F1-residual: expired knowledge seals terminal=DENIED (technical denial, never REJECTED_BY_USER)", () => {
  const pack = loadContextPackV1(path.join(PKG, "contexts", "invoices-eur-cent"));
  const spec = loadSpec();
  const result = runUserPathV1({
    pack,
    spec,
    library: loadLibrary(),
    nowMs: EXPIRED_MS, // knowledge is stale at the actual clock
    principal: "principal:finance-reviewer",
    decisionPrefix: "kts06-f1-expired",
    goal: marginGoal(),
  });
  assert.equal(result.outcome, "DENIED");
  assert.equal(result.path.terminal, "DENIED");
  assert.equal(result.receipt, null);
  assert.equal(result.path.steps.find((s) => s.kind === "REJECTED_BY_USER"), undefined, "no user-rejection step may be sealed");
  assert.equal(result.path.steps.find((s) => s.kind === "BLOCKED"), undefined, "a technical denial is never a block");
  const selectionStep = result.path.steps.find((s) => s.kind === "METHOD_SELECTED");
  assert.ok(selectionStep !== undefined, "the selection must be sealed into the chain");
  assert.notEqual((selectionStep?.payload as { outcome?: string }).outcome, "SELECTED", "the sealed selection must be non-SELECTED (stale knowledge)");
});

const CLI_PATH = path.join(ROOT, "dist", "packages", "knowledge-solution", "src", "cli.js");
const TMP_DIR = mkdtempSync(path.join(os.tmpdir(), "kts06-"));
const runCli = (args: string[], stdin: string): { status: number; stdout: string; stderr: string } => {
  const r = spawnSync(process.execPath, [CLI_PATH, ...args], { input: stdin, encoding: "utf8", timeout: 90_000, cwd: ROOT });
  return { status: r.status === null ? -1 : r.status, stdout: r.stdout ?? "", stderr: r.stderr ?? "" };
};
const sealedOutcome = (stdout: string): { terminal: string; outcome: string } => {
  const block = stdout.match(/--- path \(machine readable\) ---\n([\s\S]*?)\n\{/) ?? stdout.match(/--- path \(machine readable\) ---\n(\{[\s\S]*?\n\})/);
  const json = JSON.parse((block?.[1] ?? "null").replace(/---.*$/m, ""));
  return { terminal: json.terminal, outcome: json.outcome };
};

test("F1-residual CLI: interactive EOF after principal => exit 4, SEALED terminal=BLOCKED, outcome=BLOCKED_BY_EOF, no receipt", () => {
  const r = runCli(["run", "csv:invoices-eur-cent", "--goal", "margin"], "user:reviewer\n");
  assert.equal(r.status, 4, `expected exit 4, got ${r.status}\n${r.stdout}`);
  assert.ok(!/receiptDigest:/.test(r.stdout), "no receipt may be produced");
  const sealed = sealedOutcome(r.stdout);
  assert.equal(sealed.outcome, "BLOCKED_BY_EOF");
  assert.equal(sealed.terminal, "BLOCKED", "the SEALED terminal must be BLOCKED, not REJECTED_BY_USER");
});

test("F1-residual CLI: interactive EOF at the EXECUTION confirmation => exit 4, SEALED terminal=BLOCKED, outcome=BLOCKED_BY_EOF", () => {
  const r = runCli(["run", "csv:invoices-eur-cent", "--goal", "margin"], "user:reviewer\nja\n");
  assert.equal(r.status, 4, `expected exit 4, got ${r.status}\n${r.stdout}`);
  assert.ok(!/receiptDigest:/.test(r.stdout), "no receipt may be produced");
  const sealed = sealedOutcome(r.stdout);
  assert.equal(sealed.outcome, "BLOCKED_BY_EOF");
  assert.equal(sealed.terminal, "BLOCKED", "the SEALED terminal must be BLOCKED, not REJECTED_BY_USER");
});

test("F1-residual CLI: explicit 'nein' at the mapping confirmation => exit 3, SEALED terminal=REJECTED_BY_USER (genuine rejection)", () => {
  const r = runCli(["run", "csv:invoices-eur-cent", "--goal", "margin"], "user:reviewer\nnein\n");
  assert.equal(r.status, 3, `expected exit 3, got ${r.status}\n${r.stdout}`);
  assert.ok(!/receiptDigest:/.test(r.stdout), "no receipt may be produced");
  const sealed = sealedOutcome(r.stdout);
  assert.equal(sealed.outcome, "REJECTED_BY_USER");
  assert.equal(sealed.terminal, "REJECTED_BY_USER");
});

test("F1-residual CLI: positive interactive path (principal + goal + ja + ja) => exit 0, SEALED terminal=EXECUTED, receipt", () => {
  const r = runCli(["run", "csv:invoices-eur-cent", "--goal", "margin"], "user:reviewer\nja\nja\n");
  assert.equal(r.status, 0, `expected exit 0, got ${r.status}\n${r.stdout}\n${r.stderr}`);
  assert.ok(/receiptDigest:/.test(r.stdout), "receipt present");
  const sealed = sealedOutcome(r.stdout);
  assert.equal(sealed.outcome, "EXECUTED");
  assert.equal(sealed.terminal, "EXECUTED");
});

test("F1-residual CLI: legacy context with an UNANSWERED open question => exit 4, SEALED terminal=BLOCKED, outcome=BLOCKED_OPEN_QUESTIONS", () => {
  const r = runCli(["run", "csv:legacy-erp-de", "--goal", "margin"], "user:reviewer\n");
  assert.equal(r.status, 4, `expected exit 4, got ${r.status}\n${r.stdout}`);
  assert.ok(!/receiptDigest:/.test(r.stdout), "no receipt may be produced");
  const sealed = sealedOutcome(r.stdout);
  assert.equal(sealed.outcome, "BLOCKED_OPEN_QUESTIONS");
  assert.equal(sealed.terminal, "BLOCKED", "the SEALED terminal must be BLOCKED, not REJECTED_BY_USER");
});

test("F1-residual CLI: batch file with a WRONG inputDigest => exit 4, SEALED terminal=BLOCKED, outcome=BLOCKED_INPUTS_UNBOUND", () => {
  const sha256Canon = (value: unknown): string => createHash("sha256").update(canonicalJson(value)).digest("hex");
  // The EXACT goal the CLI builds for `run csv:invoices-eur-cent --goal margin`
  // (goalId from the target, actor from the file principal, constraints []).
  const principal = "principal:finance-reviewer";
  const marginChoice = METHOD_GOAL_OBJECTIVE_CHOICES_V1[0];
  if (marginChoice === undefined) throw new Error("MARGIN_CHOICE_MISSING");
  const goal: MethodGoalV1 = {
    schemaVersion: "pansphaira.kts/method-goal/v1",
    goalId: "goal:invoices-eur-cent-user",
    actor: principal,
    objective: marginChoice.objective,
    requestedOutcome: marginChoice.requestedOutcome,
    constraints: [],
  };
  if (!validateMethodGoalV1(goal)) throw new Error("CLI_GOAL_INVALID");
  const pack = loadContextPackV1(path.join(PKG, "contexts", "invoices-eur-cent"));
  const spec = loadSpec();
  const library = loadLibrary();
  const view = buildLibraryViewV1({ library, goal, nowMs: NOW_MS });
  const builder = GuidedPathBuilder.fromContext({ pack, spec, goal });
  builder.recordGoal();
  builder.bindLibrary(library);
  builder.attachSelection(view);
  const mapping = builder.proposal();
  builder.recordProposal();
  const inputs = adaptContextToMarginInputsV1({ context: builder.build().context, mapping, pack });
  const file = path.join(TMP_DIR, `wrong-input-${randomUUID()}.json`);
  writeFileSync(file, JSON.stringify({
    principal,
    goalDigest: sha256Canon(goal),
    proposalDigest: mapping.proposalDigest,
    inputDigest: "0".repeat(64), // deliberately wrong (the defect under test)
    confirmMapping: true,
    confirmExecution: true,
  }, null, 2));
  const r = runCli(["run", "csv:invoices-eur-cent", "--goal", "margin", "--answers", file], "");
  assert.equal(r.status, 4, `expected exit 4, got ${r.status}\n${r.stdout}`);
  assert.ok(!/receiptDigest:/.test(r.stdout), "no receipt may be produced");
  const sealed = sealedOutcome(r.stdout);
  assert.equal(sealed.outcome, "BLOCKED_INPUTS_UNBOUND");
  assert.equal(sealed.terminal, "BLOCKED", "the SEALED terminal must be BLOCKED, not REJECTED_BY_USER");
});

/* ===================== F2 — closed semantic identity ===================== */

const runMeaningProbe = (meaning: string, meaningKey: string | undefined, prefix: string): { outcome: string; receipt: unknown; pendingFields: string[] } => {
  const pack = tempPack((descriptor) => {
    const fields = descriptor.fields as { field: string; meaning: string; meaningKey?: string }[];
    const field = fields.find((f) => f.field === "rechnungsbetrag_cent");
    if (field === undefined) throw new Error("FIELD_MISSING");
    field.meaning = meaning;
    if (meaningKey === undefined) delete field.meaningKey;
    else field.meaningKey = meaningKey;
  });
  const spec = loadSpec();
  const result = runUserPathV1({
    pack,
    spec,
    library: loadLibrary(),
    nowMs: NOW_MS,
    principal: "principal:finance-reviewer",
    decisionPrefix: prefix,
    goal: marginGoal(),
    answerPolicy: () => undefined, // nobody clarifies: the open question must block
  });
  return {
    outcome: result.outcome,
    receipt: result.receipt,
    pendingFields: result.pendingQuestions.map((q) => q.field),
  };
};

test("F2-residual: 'Dies ist nicht der Rechnungsbetrag' (no closed key) does NOT execute — blocked, visible question", () => {
  // Review counterexample that EXECUTED in c26 (accept-token occurrence was
  // treated as a yes despite the negation and the missing closed key).
  const r = runMeaningProbe("Dies ist nicht der Rechnungsbetrag", undefined, "kts06-f2-nicht");
  assert.notEqual(r.outcome, "EXECUTED", `expected a block, got EXECUTED (outcome=${r.outcome})`);
  assert.equal(r.receipt, null);
  assert.ok(r.pendingFields.includes("rechnungsbetrag_cent"), "the amount field must stay a visible open question");
});

test("F2-residual: 'Rechnungsbetrag ist hier nicht enthalten' (no closed key) does NOT execute", () => {
  const r = runMeaningProbe("Rechnungsbetrag ist hier nicht enthalten", undefined, "kts06-f2-nicht-enthalten");
  assert.notEqual(r.outcome, "EXECUTED", `expected a block, got EXECUTED (outcome=${r.outcome})`);
  assert.equal(r.receipt, null);
});

test("F2-residual: 'Rechnungsbetrag oder Restschuld, Bedeutung ungeklärt' (no closed key) does NOT execute", () => {
  const r = runMeaningProbe("Rechnungsbetrag oder Restschuld, Bedeutung ungeklärt", undefined, "kts06-f2-ungeklaert");
  assert.notEqual(r.outcome, "EXECUTED", `expected a block, got EXECUTED (outcome=${r.outcome})`);
  assert.equal(r.receipt, null);
});

test("F2-residual: 'Kein Rechnungsbetrag, sondern bereits gezahlte Umsatzsteuer' (no closed key) blocks with a visible meaning question", () => {
  const r = runMeaningProbe("Kein Rechnungsbetrag, sondern bereits gezahlte Umsatzsteuer", undefined, "kts06-f2-steuer");
  assert.notEqual(r.outcome, "EXECUTED", `expected a block, got EXECUTED (outcome=${r.outcome})`);
  assert.equal(r.receipt, null);
  assert.ok(r.pendingFields.includes("rechnungsbetrag_cent"), "the negated meaning must stay a visible open question");
});

test("F2-residual: CONTRADICTING closed key (CUSTOMER_ID on the amount field) does NOT execute — identity conflict blocks", () => {
  // Review counterexample: meaning text 'Rechnungsbetrag' with a foreign
  // meaningKey EXECUTED in c26 although the spec expects INVOICE_TOTAL_GROSS.
  const r = runMeaningProbe("Rechnungsbetrag", "CUSTOMER_ID", "kts06-f2-foreign-key");
  assert.notEqual(r.outcome, "EXECUTED", `expected a block, got EXECUTED (outcome=${r.outcome})`);
  assert.equal(r.receipt, null);
  assert.ok(r.pendingFields.includes("rechnungsbetrag_cent"), "the contradictory identity must be a visible open question");
});

test("F2-residual: EXACT closed key identity (INVOICE_TOTAL_GROSS) EXECUTES without any free-text evidence", () => {
  // The key match is the acceptance — even for non-tabular declared text.
  const r = runMeaningProbe("Betrag laut Rechnungssystem (freie Beschreibung)", "INVOICE_TOTAL_GROSS", "kts06-f2-key-match");
  assert.equal(r.outcome, "EXECUTED");
  assert.ok(r.receipt !== null);
});

test("F2-residual: a conflicting closed conflict-token (Steuerbetrag) WITH a matching key still blocks", () => {
  const r = runMeaningProbe("Steuerbetrag", "INVOICE_TOTAL_GROSS", "kts06-f2-conflict-token");
  assert.notEqual(r.outcome, "EXECUTED", `expected a block, got EXECUTED (outcome=${r.outcome})`);
  assert.equal(r.receipt, null);
});

/* ===================== F4 — mandatory re-check inside execute() ===================== */

test("F4-residual: direct builder.execute() WITHOUT executeView() after expiry => DENIED, no receipt, no EXECUTED step", () => {
  // Review counterexample: fresh selection -> confirm mapping -> confirm
  // execution -> clock expires -> DIRECT execute() still EXECUTED.
  const pack = loadContextPackV1(path.join(PKG, "contexts", "invoices-eur-cent"));
  const spec = loadSpec();
  const library = loadLibrary();
  const freshView = buildLibraryViewV1({ library, goal: marginGoal(), nowMs: NOW_MS });
  assert.equal(freshView.selection.outcome, "SELECTED", "precondition: fresh selection is SELECTED");

  // The whole path is built with ONE explicit goal (deterministic): the
  // view the selection was sealed from and the re-check must use the SAME
  // goal object.
  const g = marginGoal();
  const view2 = buildLibraryViewV1({ library, goal: g, nowMs: NOW_MS });
  const b = GuidedPathBuilder.fromContext({ pack, spec, goal: g });
  b.recordGoal();
  b.bindLibrary(library);
  b.attachSelection(view2);
  b.recordProposal();
  b.confirmMapping("decision:kts06-f4-direct-mapping", "principal:finance-reviewer", NOW_MS + 1000);
  const inputs = adaptContextToMarginInputsV1({ context: b.build().context, mapping: b.proposal(), pack });
  const executionDecision = b.confirmExecution("decision:kts06-f4-direct-exec", "principal:finance-reviewer", inputs, NOW_MS + 2000);
  // No executeView() call. The knowledge EXPIRED in the meantime.
  assert.throws(
    () => b.execute(executionDecision, inputs, { nowMs: EXPIRED_MS }),
    (error: unknown) => error instanceof GuidedPathDenied && (error as GuidedPathDenied).code === "KNOWLEDGE_RECHECK_FAILED",
  );
  assert.equal(b.build().terminal, "DENIED");
  assert.equal(b.build().receipt, null);
  assert.equal(b.build().steps.find((s) => s.kind === "EXECUTED"), undefined, "no EXECUTED step may be sealed");
  assertChainValid(b);
});

test("F4-residual: a still-valid direct execute() EXECUTES and seals the re-check (KNOWLEDGE_RECHECKED) itself", () => {
  const pack = loadContextPackV1(path.join(PKG, "contexts", "invoices-eur-cent"));
  const spec = loadSpec();
  const library = loadLibrary();
  const g = marginGoal();
  const view = buildLibraryViewV1({ library, goal: g, nowMs: NOW_MS });
  const b = GuidedPathBuilder.fromContext({ pack, spec, goal: g });
  b.recordGoal();
  b.bindLibrary(library);
  b.attachSelection(view);
  b.recordProposal();
  b.confirmMapping("decision:kts06-f4-valid-mapping", "principal:finance-reviewer", NOW_MS + 1000);
  const inputs = adaptContextToMarginInputsV1({ context: b.build().context, mapping: b.proposal(), pack });
  const executionDecision = b.confirmExecution("decision:kts06-f4-valid-exec", "principal:finance-reviewer", inputs, NOW_MS + 2000);
  const receipt = b.execute(executionDecision, inputs, { nowMs: NOW_MS + 5000 }); // still inside the window
  assert.equal(receipt.outcome, "EXECUTED");
  assert.equal(b.build().terminal, "EXECUTED");
  assert.ok(b.build().steps.some((s) => s.kind === "KNOWLEDGE_RECHECKED"), "execute() itself must seal the fresh re-check");
  assertChainValid(b);
});

test("F4-residual: a direct execute() on the ACTUAL live clock (inside the edition window) EXECUTES — the live re-check passes", () => {
  // The production CLI path is exercised with the real clock: the mandatory
  // re-check must not spuriously deny while the knowledge is still valid.
  const pack = loadContextPackV1(path.join(PKG, "contexts", "invoices-eur-cent"));
  const spec = loadSpec();
  const library = loadLibrary(Date.now());
  const g = marginGoal();
  const view = buildLibraryViewV1({ library, goal: g, nowMs: Date.now() });
  const b = GuidedPathBuilder.fromContext({ pack, spec, goal: g });
  b.recordGoal();
  b.bindLibrary(library);
  b.attachSelection(view);
  b.recordProposal();
  b.confirmMapping("decision:kts06-f4-live-mapping", "principal:finance-reviewer", Date.now());
  const inputs = adaptContextToMarginInputsV1({ context: b.build().context, mapping: b.proposal(), pack });
  const executionDecision = b.confirmExecution("decision:kts06-f4-live-exec", "principal:finance-reviewer", inputs, Date.now());
  const receipt = b.execute(executionDecision, inputs); // actual Date.now() inside execute()
  assert.equal(receipt.outcome, "EXECUTED");
  assert.equal(b.build().terminal, "EXECUTED");
});

/* ===================== F5 — role binding, socket cleanup, read bound ===================== */

test("F5-residual: a caller client executing as a DIFFERENT role (admin) is rejected — the used client is bound to the probed role", async () => {
  // Review counterexample: readMarginContextFromPostgresV1({conn: roConn,
  // client: harness.admin}) accepted the admin client; the readback
  // reported user=kts (not kts_ro). The adapter must reject it.
  const harness: PgHarness = await startRealPostgres(DATA_DIR);
  try {
    const adminClient = new Client({ host: "127.0.0.1", port: PG_PORT, database: PG_DATABASE, user: PG_ADMIN_USER, password: PG_ADMIN_PASSWORD });
    await adminClient.connect(); // caller-owned, OPEN — but the WRONG role
    await assert.rejects(
      readMarginContextFromPostgresV1({
        conn: { host: "127.0.0.1", port: PG_PORT, database: PG_DATABASE, user: PG_RO_USER, password: PG_RO_PASSWORD },
        schema: PG_SCHEMA,
        client: adminClient,
      }),
      (error: unknown) => error instanceof PostgresReadDenied && (error as PostgresReadDenied).code === "PG_CONNECTION_FAILED",
    );
    // Ownership respected: the caller's client is still usable afterwards.
    const v = await adminClient.query("SELECT 1 AS ok");
    assert.equal(v.rows[0]?.ok, 1);
    await adminClient.end();
  } finally {
    await harness.stop();
  }
});

test("F5-residual: a timed-out connect of the handed client destroys the ACTUAL socket (clientStreamDestroyed=true)", async () => {
  // Review counterexample: conn -> live server, fresh client -> blackhole
  // (accepts TCP, silent), timeout 150 ms: PG_CONNECTION_FAILED was thrown
  // but the client's real stream stayed open (clientStreamDestroyed=false,
  // serverSockets=1).
  const harness: PgHarness = await startRealPostgres(DATA_DIR);
  const blackhole = createServer((socket) => socket.pause()); // accepts, never speaks
  await new Promise<void>((resolve) => blackhole.listen(0, "127.0.0.1", resolve));
  const address = blackhole.address();
  assert.ok(address !== null && typeof address === "object");
  const port = (address as { port: number }).port;
  try {
    const fresh = new Client({ host: "127.0.0.1", port, database: PG_DATABASE, user: PG_RO_USER, password: PG_RO_PASSWORD });
    // Capture the ACTUAL client stream as pg creates it. pg 8.16 clears
    // client.connection after a failed connect, so the stream must be
    // observed DURING the pending connect, not afterwards.
    const captured: { stream?: unknown } = {};
    const poll = setInterval(() => {
      const c = (fresh as unknown as { connection?: unknown }).connection;
      const stream = (c as { stream?: unknown } | null)?.stream;
      if (stream !== null && stream !== undefined && captured.stream === undefined) captured.stream = stream;
    }, 5);
    try {
      await assert.rejects(
        ensurePostgresClientConnectedV1(fresh, { host: "127.0.0.1", port: PG_PORT, database: PG_DATABASE, user: PG_RO_USER, password: PG_RO_PASSWORD }, 150),
        (error: unknown) => error instanceof PostgresReadDenied && (error as PostgresReadDenied).code === "PG_CONNECTION_FAILED",
      );
      // The ACTUAL connect socket of the handed client must be destroyed:
      // the timeout branch releases the real stream (review:
      // clientStreamDestroyed=false, serverSockets=1).
      assert.ok(captured.stream !== undefined, "the client must have opened a real TCP connection");
      const cs = captured.stream as { destroyed?: boolean };
      assert.equal(cs.destroyed, true, "the actual connect socket must be destroyed on timeout");
    } finally {
      clearInterval(poll);
    }
  } finally {
    // Bounded teardown: a half-open blackhole socket (client destroyed
    // mid-handshake) cannot be observed closing, so force-close and wait
    // with a hard bound — the test must never hang.
    (blackhole as unknown as { closeAllConnections?: () => void }).closeAllConnections?.();
    await Promise.race([
      new Promise<void>((resolve) => blackhole.close(() => resolve())),
      new Promise<void>((resolve) => { const t = setTimeout(resolve, 5000); t.unref?.(); }),
    ]);
    await harness.stop();
  }
});

test("F5-residual: a SELECT held on a locked table is canceled by the SERVER after the bound (PG_QUERY_TIMED_OUT, bounded, no hang)", async () => {
  // Review counterexample: an ACCESS EXCLUSIVE LOCK held on the synthetic
  // table left the real adapter read UNDECIDED past 10 s. The actual read
  // now carries a server-enforced statement/lock limit.
  const harness: PgHarness = await startRealPostgres(DATA_DIR);
  try {
    const locker = new Client({ host: "127.0.0.1", port: PG_PORT, database: PG_DATABASE, user: PG_ADMIN_USER, password: PG_ADMIN_PASSWORD });
    await locker.connect();
    await locker.query("BEGIN");
    await locker.query("LOCK TABLE kts_invoices IN ACCESS EXCLUSIVE MODE");
    const fresh = new Client({ host: "127.0.0.1", port: PG_PORT, database: PG_DATABASE, user: PG_RO_USER, password: PG_RO_PASSWORD });
    const started = Date.now();
    await assert.rejects(
      readMarginContextFromPostgresV1({
        conn: { host: "127.0.0.1", port: PG_PORT, database: PG_DATABASE, user: PG_RO_USER, password: PG_RO_PASSWORD },
        schema: PG_SCHEMA,
        client: fresh,
        queryTimeoutMs: 2_000, // client-side bound tighter than the server's
      }),
      (error: unknown) => error instanceof PostgresReadDenied && (error as PostgresReadDenied).code === "PG_QUERY_TIMED_OUT",
    );
    const elapsed = Date.now() - started;
    assert.ok(elapsed < 10_000, `the read must be bounded by the enforced limit (elapsed=${elapsed}ms)`);
    await locker.query("ROLLBACK");
    await locker.end();
    void PG_READ_LOCK_TIMEOUT_MS_V1; // exported bound constant (used by the adapter)
  } finally {
    await harness.stop();
  }
});

test("F5-residual: a caller client with the CORRECT role is accepted and left caller-owned (role binding does not over-reach)", async () => {
  const harness: PgHarness = await startRealPostgres(DATA_DIR);
  try {
    const roClient = new Client({ host: "127.0.0.1", port: PG_PORT, database: PG_DATABASE, user: PG_RO_USER, password: PG_RO_PASSWORD });
    await roClient.connect(); // caller-owned, correct role
    const { readback } = await readMarginContextFromPostgresV1({
      conn: { host: "127.0.0.1", port: PG_PORT, database: PG_DATABASE, user: PG_RO_USER, password: PG_RO_PASSWORD },
      schema: PG_SCHEMA,
      client: roClient,
    });
    assert.equal(readback.user, PG_RO_USER, "the readback must report the probed role");
    assert.equal(readback.rowCount, 3);
    // caller-owned: still usable afterwards (not closed by the adapter).
    const v = await roClient.query("SELECT 1 AS ok");
    assert.equal(v.rows[0]?.ok, 1);
    await roClient.end();
  } finally {
    await harness.stop();
  }
});

after(() => {
  rmSync(TMP_DIR, { recursive: true, force: true });
});
