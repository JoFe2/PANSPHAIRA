/**
 * KTS-01 — nutzbare Methodenbibliothek auf vorhandenen Grundlagen.
 *
 * Proves: sealed-corpus load (digest-bound), method find/explain
 * (data, Bedeutung, source, version, preconditions, contradictions),
 * reasoned deterministic selection (goal -> method), and fail-closed
 * denials (content drift, stale knowledge, no match, tampered spec).
 * Compiled test: dist/tests/knowledge-solution/kts01-method-library.test.js
 */
import assert from "node:assert/strict";
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import {
  validateMethodGoalV1,
  validateMethodSelectionV1,
  validateMethodSpecV1,
  type MethodGoalV1,
  type MethodSelectionV1,
} from "../../packages/knowledge-solution/src/method-core.js";
import {
  KNOWLEDGE_REF_BINDINGS_V1,
  buildLibraryViewV1,
  explainMethodV1,
  loadCorpusEditionV1,
  loadMethodLibraryV1,
  searchKnowledgeV1,
  searchMethodsV1,
  type LocalFileCorpusEditionV1,
} from "../../packages/knowledge-solution/src/method-library.js";

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..", "..", ".."); // dist/tests/knowledge-solution -> repo root
const CORPUS_ROOT = path.join(ROOT, "packages", "knowledge-solution", "corpus");
const NOW_MS = 1758446400000; // 2026-09-21T00:00:00Z

// F3: the objective is a CLOSED fachliche Absicht (exact table entry). A
// COMPUTE_TOTAL goal must carry the matching sum intention, not the margin
// objective with a swapped output shape — output shape alone never grants
// suitability.
const goalFor = (outcome: "FLAG_RECORDS" | "COMPUTE_TOTAL"): MethodGoalV1 => ({
  schemaVersion: "pansphaira.kts/method-goal/v1",
  goalId: outcome === "COMPUTE_TOTAL" ? "goal:invoice-total-v1" : "goal:margin-review-v1",
  actor: "principal:finance-reviewer",
  objective: outcome === "COMPUTE_TOTAL"
    ? "Summe der Gesamtbetraege aller Rechnungen eines Datenkontexts berechnen"
    : "Rechnungen unterhalb eines Mindestgrenzwerts pruefen und markieren",
  requestedOutcome: outcome,
  constraints: ["nur lokale, synthetische Daten"],
});

const PACKAGE_ROOT = path.join(ROOT, "packages", "knowledge-solution");
const PROFILE_PATH = path.join(PACKAGE_ROOT, "profiles", "corpus-profile.json");
const readProfile = (): unknown => JSON.parse(readFileSync(PROFILE_PATH, "utf8"));

const loadLibrary = (root: string = CORPUS_ROOT, profile: unknown = readProfile(), nowMs: number = NOW_MS) =>
  loadMethodLibraryV1({ corpusRoot: root, packageRoot: PACKAGE_ROOT, profile, nowMs });

test("KTS-01 sealed corpus edition loads digest-bound with anchored rule knowledge", () => {
  const profile = readProfile() as { corpusId: string };
  const edition = loadCorpusEditionV1(CORPUS_ROOT, profile);
  assert.ok(edition !== null, "sealed edition must load");
  const ed = edition as LocalFileCorpusEditionV1;
  assert.equal(ed.corpusId, "corpus:margin-knowledge-v1");
  assert.equal(ed.files.length, 4);
  const ruleChunk = ed.files.find((f) => f.path === "methods/margin-rules.md")!.chunks.find((c) => c.text.includes("totalMinor < floorCent"));
  assert.ok(ruleChunk !== undefined, "anchored rule line must be chunked");
  assert.match(ruleChunk!.citationId, /^citation:[a-f0-9]{24}$/);
});

test("KTS-01 library loads specs, resolves required knowledge OK, and explains method", () => {
  const library = loadLibrary();
  assert.equal(library.loadState, "LOADED");
  assert.equal(library.methods.length, 2);
  const margin = library.methods.find((m) => m.spec.methodId === "method:margin-threshold-v1")!;
  assert.ok(margin !== undefined);
  assert.equal(margin.knowledgeStates["knowledge:margin-rules-v1"], "OK");
  assert.equal(margin.knowledgeStates["knowledge:margin-example-v1"], "OK");
  assert.ok(margin.knowledgeCitations["knowledge:margin-rules-v1"].length >= 1);

  const explanation = explainMethodV1(library, "method:margin-threshold-v1");
  assert.ok(explanation !== null);
  assert.equal(explanation!.version, "1.0.0");
  assert.deepEqual(explanation!.supportedOutcomes, ["FLAG_RECORDS"]);
  const records = explanation!.requiredData.find((d) => d.inputId === "input:invoice-records-v1")!;
  assert.ok(records.requiredFields.includes("totalMinor"));
  const floor = explanation!.requiredData.find((d) => d.inputId === "input:margin-floor-v1")!;
  assert.equal(floor.unit, "eur");
  assert.ok(explanation!.preconditions.length >= 2);
  assert.ok(explanation!.sources.every((s) => s.citations.length >= 1 || s.state !== "OK"));
  const source = explanation!.sources.find((s) => s.ref === "knowledge:margin-rules-v1")!;
  assert.equal(source.path, KNOWLEDGE_REF_BINDINGS_V1["knowledge:margin-rules-v1"].path);
  assert.equal(source.kind, "REQUIRED");
});

test("KTS-01 search finds methods deterministically", () => {
  const library = loadLibrary();
  const hits = searchMethodsV1(library, "grenzwert rechnungen markieren");
  assert.equal(hits[0]?.methodId, "method:margin-threshold-v1");
  const total = searchMethodsV1(library, "summe gesamtbetraege");
  assert.equal(total[0]?.methodId, "method:invoice-total-v1");
  assert.deepEqual(searchMethodsV1(library, "    "), []);
});

test("KTS-01 receipt-grade knowledge search is corpus-bound", () => {
  const library = loadLibrary();
  const edition = loadCorpusEditionV1(CORPUS_ROOT, readProfile());
  assert.ok(edition !== null);
  const result = searchKnowledgeV1({ library, edition: edition as LocalFileCorpusEditionV1, query: "totalMinor floorCent REGEL" });
  assert.ok(result.hits.length >= 1);
  assert.equal(result.editionId, (edition as LocalFileCorpusEditionV1).editionId);
  assert.equal(result.manifestDigest, (edition as LocalFileCorpusEditionV1).manifestDigest);
  assert.match(result.queryDigest, /^[a-f0-9]{64}$/);
});

test("KTS-01 reasoned selection: FLAG goal selects margin method with closed reasons", () => {
  const library = loadLibrary();
  const view = buildLibraryViewV1({ library, goal: goalFor("FLAG_RECORDS"), nowMs: NOW_MS });
  assert.equal(view.selection.outcome, "SELECTED");
  assert.equal(view.selection.selected?.methodId, "method:margin-threshold-v1");
  assert.ok(view.selection.selected!.reasons.includes("OUTCOME_MATCHED"));
  assert.ok(view.explanation !== null && view.explanation.methodId === "method:margin-threshold-v1");
  assert.match(view.viewDigest, /^[a-f0-9]{64}$/);
  assert.equal(view.selection.authorityBoundary, "READ_ONLY_DETERMINISTIC_RULES_NO_MODEL_EXECUTION_NO_WRITE_NO_AUTHORITY");
});

test("KTS-01 reasoned selection: COMPUTE_TOTAL goal selects the reference method", () => {
  const library = loadLibrary();
  const view = buildLibraryViewV1({ library, goal: goalFor("COMPUTE_TOTAL"), nowMs: NOW_MS });
  assert.equal(view.selection.outcome, "SELECTED");
  assert.equal(view.selection.selected?.methodId, "method:invoice-total-v1");
});

test("KTS-01 stale knowledge (window exceeded) yields UNKNOWN, never invented suitability", () => {
  const profile = JSON.parse(readFileSync(PROFILE_PATH, "utf8")) as { observedAtMs: number; [key: string]: unknown };
  profile.observedAtMs = NOW_MS - 400 * 24 * 60 * 60 * 1000; // older than the 365d window
  const library = loadLibrary(CORPUS_ROOT, profile, NOW_MS);
  const margin = library.methods.find((m) => m.spec.methodId === "method:margin-threshold-v1")!;
  assert.equal(margin.knowledgeStates["knowledge:margin-rules-v1"], "STALE");
  const view = buildLibraryViewV1({ library, goal: goalFor("FLAG_RECORDS"), nowMs: NOW_MS });
  assert.equal(view.selection.outcome, "UNKNOWN");
  assert.equal(view.selection.selected, null);
  assert.ok(view.selection.rejected.some((r) => r.methodId === "method:margin-threshold-v1" && r.reasons.includes("STALE_KNOWLEDGE")));
  assert.ok(view.explanation === null, "no explanation may be produced for an unselected method");
});

test("KTS-01 content drift fails closed: no method selectable, drifted ref TAMPERED", () => {
  const driftedRoot = mkdtempSync(path.join(tmpdir(), "kts01-drift-"));
  const corpusFiles = ["methods/margin-rules-legacy.md", "methods/margin-rules.md", "methods/margin-worked-example.md", "methods/invoice-total-rules.md"];
  for (const file of corpusFiles) {
    mkdirSync(path.join(driftedRoot, path.dirname(file)), { recursive: true });
    copyFileSync(path.join(CORPUS_ROOT, file), path.join(driftedRoot, file));
  }
  writeFileSync(path.join(driftedRoot, "methods/margin-rules.md"), "GEBROCHEN: Regel wurde nachtraeglich veraendert.\n");
  const library = loadLibrary(driftedRoot, readProfile(), NOW_MS);
  assert.equal(library.loadState, "CONTENT_DRIFT_DENIED");
  assert.deepEqual(library.driftedPaths, ["methods/margin-rules.md"]);
  const margin = library.methods.find((m) => m.spec.methodId === "method:margin-threshold-v1")!;
  assert.equal(margin.knowledgeStates["knowledge:margin-rules-v1"], "TAMPERED");
  assert.equal(margin.knowledgeStates["knowledge:margin-example-v1"], "ABSENT");
  const view = buildLibraryViewV1({ library, goal: goalFor("FLAG_RECORDS"), nowMs: NOW_MS });
  assert.equal(view.selection.outcome, "UNKNOWN");
  assert.ok(view.selection.rejected.some((r) => r.reasons.includes("SPEC_DIGEST_MISMATCH")));
});

test("KTS-01 spec digests are immutable and selection is deterministic", () => {
  const library = loadLibrary();
  const margin = library.methods.find((m) => m.spec.methodId === "method:margin-threshold-v1")!;
  assert.ok(validateMethodSpecV1(margin.spec));
  const a = buildLibraryViewV1({ library, goal: goalFor("FLAG_RECORDS"), nowMs: NOW_MS });
  const b = buildLibraryViewV1({ library, goal: goalFor("FLAG_RECORDS"), nowMs: NOW_MS });
  assert.equal(a.viewDigest, b.viewDigest);
  assert.equal(a.selection.selectionDigest, b.selection.selectionDigest);
  assert.ok(validateMethodGoalV1(a.selection.goal));
  assert.ok(validateMethodSelectionV1(a.selection));
  const goal = goalFor("FLAG_RECORDS");
  const flipped: MethodGoalV1 = { ...goal, objective: "Rechnungen ueber einem Maximalgrenzwert pruefen" };
  const c = buildLibraryViewV1({ library, goal: flipped, nowMs: NOW_MS });
  assert.notEqual(c.selection.goalDigest, a.selection.goalDigest);
});

test("KTS-01 goal/selection validators fail closed on tampered or foreign shapes", () => {
  const library = loadLibrary();
  const view = buildLibraryViewV1({ library, goal: goalFor("FLAG_RECORDS"), nowMs: NOW_MS });
  const selection = view.selection;
  const tampered: unknown = { ...selection, selectionDigest: selection.selectionDigest.replace(/^./, selection.selectionDigest[0] === "a" ? "b" : "a") };
  assert.equal(validateMethodSelectionV1(tampered), false);
  const foreign = { schemaVersion: "pansphaira.kts/method-selection/v1", goal: selection.goal, goalDigest: selection.goalDigest, candidates: selection.candidates, outcome: "SELECTED", selected: selection.selected, rejected: selection.rejected, authorityBoundary: selection.authorityBoundary, extra: 1, selectionDigest: selection.selectionDigest };
  assert.equal(validateMethodSelectionV1(foreign), false);
});
