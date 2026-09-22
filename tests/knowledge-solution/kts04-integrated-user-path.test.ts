/**
 * KTS-04 — tatsächlich ausgeführter integrierter Nutzerweg.
 *
 * Proves the END-TO-END, actually-executed user path that binds the KTS-01
 * library, the KTS-02 guided adaptation and the KTS-03 real read-only
 * PostgreSQL adapter together — over a live local PostgreSQL server:
 *   goal -> sealed method selection -> Rückfragen -> user decision -> the SAME
 *   sealed method core executes the adapted inputs -> digest-bound receipt.
 * Also proves determinism (identical inputs -> identical receipt), fail-closed
 * rejection (unit conflict / user "ablehnen" never execute), and that the CLI
 * actually runs the path and tears the PG data dir down residual-free.
 * Compiled test: dist/tests/knowledge-solution/kts04-integrated-user-path.test.js
 */
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import { validateMethodSpecV1, type MethodSpecV1 } from "../../packages/knowledge-solution/src/method-core.js";
import { loadMethodLibraryV1, type MethodLibraryV1 } from "../../packages/knowledge-solution/src/method-library.js";
import { loadContextPackV1, type ContextPackV1 } from "../../packages/knowledge-solution/src/context-source.js";
import { runUserPathV1, type UserPathArgsV1 } from "../../packages/knowledge-solution/src/user-path.js";
import type { MethodGoalV1 } from "../../packages/knowledge-solution/src/method-core.js";
import { readMarginContextFromPostgresV1 } from "../../packages/knowledge-solution/src/postgres-source.js";
import {
  PG_DATABASE,
  PG_PORT,
  PG_RO_PASSWORD,
  PG_RO_USER,
  PG_SCHEMA,
  pgDataDirFor,
  startRealPostgres,
  type PgHarness,
} from "../../packages/knowledge-solution/src/pg-harness.js";

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..", "..", "..");
const PKG = path.join(ROOT, "packages", "knowledge-solution");
const NOW_MS = 1758532800000;
const DATA_DIR = pgDataDirFor(ROOT);

const loadSpec = (): MethodSpecV1 => {
  const spec = JSON.parse(readFileSync(path.join(PKG, "specs", "margin-threshold.spec.json"), "utf8")) as unknown;
  if (!validateMethodSpecV1(spec)) throw new Error("SPEC_DENIED");
  return spec;
};

const loadLibrary = (): MethodLibraryV1 =>
  loadMethodLibraryV1({
    corpusRoot: path.join(PKG, "corpus"),
    packageRoot: PKG,
    profile: JSON.parse(readFileSync(path.join(PKG, "profiles", "corpus-profile.json"), "utf8")),
    nowMs: NOW_MS,
  });

// F1/F3: the EXPLICIT user goal (closed fachliche Absicht) drives the path.
// The default goal of the builder is only a sealed fallback and no longer
// suffices for a suitability claim on its own.
const marginGoal: MethodGoalV1 = {
  schemaVersion: "pansphaira.kts/method-goal/v1",
  goalId: "goal:kts04-margin-review",
  actor: "principal:finance-reviewer",
  objective: "Rechnungen unterhalb eines Mindestgrenzwerts pruefen und markieren",
  requestedOutcome: "FLAG_RECORDS",
  constraints: ["nur lokale, synthetische Daten", "keine Modellausfuehrung"],
};

interface PathOverrides {
  readonly pack: ContextPackV1;
  readonly prefix: string;
  readonly policy?: UserPathArgsV1["answerPolicy"];
  readonly provenance?: UserPathArgsV1["sourceProvenance"];
  readonly goal?: MethodGoalV1;
}

const runPath = (overrides: PathOverrides): ReturnType<typeof runUserPathV1> =>
  runUserPathV1({
    pack: overrides.pack,
    spec: loadSpec(),
    library: loadLibrary(),
    nowMs: NOW_MS,
    principal: "principal:finance-reviewer",
    decisionPrefix: overrides.prefix,
    ...(overrides.policy !== undefined ? { answerPolicy: overrides.policy } : {}),
    ...(overrides.provenance !== undefined ? { sourceProvenance: overrides.provenance } : {}),
    ...(overrides.goal !== undefined ? { goal: overrides.goal } : {}),
  });

test("KTS-04 integrated user path over a REAL PostgreSQL server EXECUTES + deterministic", async () => {
  const harness: PgHarness = await startRealPostgres(DATA_DIR);
  try {
    const { pack, readback } = await readMarginContextFromPostgresV1({
      conn: { host: "127.0.0.1", port: PG_PORT, database: PG_DATABASE, user: PG_RO_USER, password: PG_RO_PASSWORD },
      schema: PG_SCHEMA,
      client: harness.ro,
    });
    assert.equal(pack.descriptor.contextId, "context:postgres-invoices-eur");
    assert.equal(pack.descriptor.sourceFormat, "postgres");
    const result = runPath({
      pack,
      prefix: "kts04-pg",
      goal: marginGoal,
      provenance: {
        host: "127.0.0.1",
        port: readback.port,
        database: readback.database,
        user: readback.user,
        statement: readback.statement,
        rowCount: readback.rowCount,
        readbackDigest: readback.readbackDigest,
      },
    });
    assert.equal(result.outcome, "EXECUTED");
    assert.equal(result.contextSourceFormat, "postgres");
    assert.equal(result.path.terminal, "EXECUTED");
    const receipt = result.receipt;
    assert.ok(receipt !== null, "receipt present");
    assert.equal(receipt.outcome, "EXECUTED");
    assert.equal(receipt.authorityBoundary, "READ_ONLY_DETERMINISTIC_RULES_NO_MODEL_EXECUTION_NO_WRITE_NO_AUTHORITY");
    assert.deepEqual(receipt.denialReasons, []);
    assert.equal(receipt.result?.totalInputMinor, 8499);
    assert.equal(receipt.result?.flagged.length, 2);
    const reasons = receipt.result?.flagged.map((f) => f.reason).sort();
    assert.deepEqual(reasons, ["BELOW_THRESHOLD", "BELOW_THRESHOLD_CUSTOMER_UNKNOWN"]);
    // Determinism: the IDENTICAL path (same spec digest, same context digest,
    // same nowMs, same decision prefix) yields the IDENTICAL receipt digest.
    const again = runPath({ pack, prefix: "kts04-pg", goal: marginGoal });
    assert.equal(again.receipt?.receiptDigest, receipt.receiptDigest);
    assert.equal(again.receipt?.inputDigest, receipt.inputDigest);
    assert.equal(again.receipt?.decisionDigest, receipt.decisionDigest);
  } finally {
    await harness.stop();
  }
});

test("KTS-04 integrated user path over TWO sealed CSV data contexts EXECUTES", () => {
  const a = runPath({ pack: loadContextPackV1(path.join(PKG, "contexts", "invoices-eur-cent")), prefix: "kts04-a", goal: marginGoal });
  assert.equal(a.outcome, "EXECUTED");
  assert.equal(a.receipt?.result?.flagged.length, 1);
  assert.equal(a.receipt?.result?.flagged[0]?.reason, "BELOW_THRESHOLD");
  const b = runPath({ pack: loadContextPackV1(path.join(PKG, "contexts", "legacy-erp-de")), prefix: "kts04-b", goal: marginGoal });
  assert.equal(b.outcome, "EXECUTED");
  assert.equal(b.openQuestionsAnswered, 1);
  assert.equal(b.receipt?.result?.flagged.length, 2);
});

test("KTS-04 unit conflict is fail-closed: never executes (REJECTED_BY_USER, no receipt)", () => {
  const r = runPath({ pack: loadContextPackV1(path.join(PKG, "contexts", "invoices-usd")), prefix: "kts04-usd" });
  assert.equal(r.outcome, "REJECTED_BY_USER");
  assert.equal(r.receipt, null, "no receipt on rejection (nothing executed)");
});

test("KTS-04 user answer 'ablehnen' is a genuine rejection: never executes", () => {
  const rejectAll: UserPathArgsV1["answerPolicy"] = () => "ablehnen";
  const r = runPath({ pack: loadContextPackV1(path.join(PKG, "contexts", "legacy-erp-de")), prefix: "kts04-reject", policy: rejectAll });
  assert.equal(r.outcome, "REJECTED_BY_USER");
  assert.equal(r.receipt, null);
});

test("KTS-04 CLI smoke: integrated path actually runnable, PG residual-free", async () => {
  const { execFileSync } = await import("node:child_process");
  const cli = path.join(ROOT, "dist", "packages", "knowledge-solution", "src", "cli.js");
  const out = (args: string[], input?: string): string =>
    execFileSync(process.execPath, [cli, ...args], { encoding: "utf8", stdio: ["pipe", "pipe", "pipe"], input });
  const lib = out(["library"]);
  assert.match(lib, /Wissensbibliothek/);
  assert.match(lib, /method:margin-threshold-v1/);
  // F1: the production CLI path executes only with the USER's explicit
  // principal identifier + goal selection + explicit confirmations (here:
  // closed goal "1", then confirm mapping "ja", confirm execution "ja").
  const csv = out(["run", "csv:invoices-eur-cent"], "user:kts04\n1\nja\nja\n");
  assert.match(csv, /Ziel festlegen \(geschlossene Auswahl\)/);
  assert.match(csv, /selection.outcome: SELECTED/);
  assert.match(csv, /outcome:\s+EXECUTED/);
  assert.match(csv, /freigabe:\s+CONTEXT_MAPPING/);
  assert.match(csv, /freigabe:\s+EXECUTION/);
  // F1: EOF without an explicit answer must NOT execute (exit 4, no receipt).
  let eofExit = 0;
  let eofOut = "";
  try {
    eofOut = out(["run", "csv:invoices-eur-cent"], "user:kts04\n1\n");
  } catch (error) {
    eofExit = (error as { status?: number }).status ?? 1;
    eofOut = String((error as { stdout?: unknown }).stdout ?? "");
  }
  assert.equal(eofExit, 4, "EOF before a decision must block execution");
  // F1 (Korrektur 0430): EOF is NOT a rejection by a user (nobody declined) —
  // the honest outcome is a BLOCK (no receipt).
  assert.match(eofOut, /outcome:\s+BLOCKED_BY_EOF/);
  assert.doesNotMatch(eofOut, /receiptDigest/);
  // The PostgreSQL context carries the nullable kunden_nr => one extra
  // explicit user answer (option "1" = behandele_unbekannt_flaggen).
  const pg = out(["run", "postgres"], "user:kts04\n1\n1\nja\nja\n");
  assert.match(pg, /outcome:\s+EXECUTED/);
  assert.match(pg, /PostgreSQL 127\.0\.0\.1:\d+\/kts_pg as kts_ro \(read-only\)/);
  assert.equal(existsSync(DATA_DIR), false, "PG data dir removed residual-free");
});
