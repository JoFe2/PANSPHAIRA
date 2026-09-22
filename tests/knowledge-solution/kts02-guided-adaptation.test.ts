/**
 * KTS-02 — geführter Anpassungsweg derselben Methode in zwei (drei) Datenkontexten.
 *
 * Proves: one sealed spec (margin-threshold) adapts to differently structured
 * local CSV contexts WITHOUT core changes (closed alias/unit tables only);
 * deterministic results; Rückfragen block confirmation until answered;
 * unit conflicts (USD) never execute; user decision digest binds the exact
 * inputs; tampered packs fail closed.
 * Compiled test: dist/tests/knowledge-solution/kts02-guided-adaptation.test.js
 */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { canonicalJson } from "../../packages/contracts/src/canonical-json.js";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { validateMethodSpecV1, type MethodSpecV1 } from "../../packages/knowledge-solution/src/method-core.js";
import {
  loadMethodLibraryV1,
  buildLibraryViewV1,
} from "../../packages/knowledge-solution/src/method-library.js";
import { loadContextPackV1, validateContextDescriptorV1, type ContextPackV1 } from "../../packages/knowledge-solution/src/context-source.js";
import {
  GuidedPathBuilder,
  GuidedPathDenied,
  GUIDED_PATH_ROOT_DIGEST,
  adaptContextToMarginInputsV1,
  makeUserDecision,
  validateGuidedContextV1,
  validateGuidedStepV1,
} from "../../packages/knowledge-solution/src/guided-path.js";

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..", "..", "..");
const PKG = path.join(ROOT, "packages", "knowledge-solution");
const NOW_MS = 1758532800000; // 2026-09-22T00:00:00Z

const loadSpec = (): MethodSpecV1 => {
  const spec = JSON.parse(readFileSync(path.join(PKG, "specs", "margin-threshold.spec.json"), "utf8")) as unknown;
  if (!validateMethodSpecV1(spec)) throw new Error("SPEC_DENIED");
  return spec;
};

const loadLibrary = () =>
  loadMethodLibraryV1({
    corpusRoot: path.join(PKG, "corpus"),
    packageRoot: PKG,
    profile: JSON.parse(readFileSync(path.join(PKG, "profiles", "corpus-profile.json"), "utf8")),
    nowMs: NOW_MS,
  });

const loadPack = (name: string): ContextPackV1 => loadContextPackV1(path.join(PKG, "contexts", name));

const viewFor = (builder: GuidedPathBuilder) => {
  // The builder's goal is sealed in step 1 (GOAL_RECORDED); reuse the same goal object.
  const goalStep = builder.build().steps.find((s) => s.kind === "GOAL_RECORDED");
  const goal = goalStep?.payload.goal;
  if (goal === undefined) throw new Error("GOAL_NOT_RECORDED");
  return buildLibraryViewV1({ library: loadLibrary(), goal: goal as never, nowMs: NOW_MS });
};

test("KTS-02 context A (clean cent CSV) adapts without Rückfragen and executes deterministically", () => {
  const pack = loadPack("invoices-eur-cent");
  const spec = loadSpec();
  const builder = GuidedPathBuilder.fromContext({ pack, spec });
  builder.recordGoal();
  const mapping = builder.attachSelection(viewFor(builder));
  builder.recordProposal();
  const blocking = mapping.openQuestions.filter((q) => q.options.length > 0);
  assert.equal(blocking.length, 0, "context A must not need blocking Rückfragen");
  const mappingDecision = builder.confirmMapping("decision:mapping-a", "principal:finance-reviewer", NOW_MS);
  assert.equal(mappingDecision.proposalDigest, mapping.proposalDigest);
  const inputs = adaptContextToMarginInputsV1({ context: builder.build().context, mapping, pack });
  assert.deepEqual(inputs.marginFloorEur, 30);
  assert.deepEqual(inputs.invoices.map((i) => i.totalMinor), [2999, 3000, 12000]);
  const executionDecision = builder.confirmExecution("decision:execution-a", "principal:finance-reviewer", inputs, NOW_MS);
  const receipt = builder.execute(executionDecision, inputs);
  assert.equal(receipt.outcome, "EXECUTED");
  assert.equal(receipt.ruleProvenance, "DETERMINISTIC_RULES");
  assert.equal(receipt.result?.count, 1);
  assert.deepEqual(receipt.result?.flagged, [{ recordId: "rechnung:001", valueMinor: 2999, reason: "BELOW_THRESHOLD" }]);
  assert.equal(receipt.result?.totalInputMinor, 17999); // 2999+3000+12000
  assert.equal(receipt.inputDigest, executionDecision.proposalDigest, "user decision must bind the exact inputs");
  const built = builder.build();
  assert.equal(built.terminal, "EXECUTED");
  assert.ok(built.steps.length >= 6);
  // Chain model: first step prevStepDigest = sha(root); each next step's
  // prevStepDigest = previous step's stepDigest (direct, not re-hashed).
  let expectedPrev = sha(GUIDED_PATH_ROOT_DIGEST);
  for (const step of built.steps) {
    assert.equal(step.prevStepDigest, expectedPrev, "digest chain must be sequential");
    assert.ok(validateGuidedStepV1(step));
    expectedPrev = step.stepDigest;
  }
  assert.equal(built.chainDigest, expectedPrev);
  assert.ok(validateGuidedContextV1(built.context));
});

test("KTS-02 context B (legacy German CSV, EUR main-unit, null kunde) requires a Rückfrage before confirmation", () => {
  const pack = loadPack("legacy-erp-de");
  const spec = loadSpec();
  const builder = GuidedPathBuilder.fromContext({ pack, spec });
  builder.recordGoal();
  const proposal = builder.attachSelection(viewFor(builder));
  builder.recordProposal();
  const blockingB = proposal.openQuestions.filter((q) => q.options.length > 0);
  assert.equal(blockingB.length, 1, "exactly one blocking Rückfrage (kunden_nr nullable) expected");
  const question = blockingB[0];
  assert.ok(question !== undefined);
  assert.equal(question.field, "kunden_nr");
  assert.deepEqual(proposal.fieldMappings.find((m) => m.specField === "totalMinor"), {
    sourceField: "betrag_eur", specField: "totalMinor", conversion: "UNIT_FACTOR", factor: 100,
    meaning: "Rechnungsbetrag in Euro (Hauptwahrung) -> totalMinor",
  });
  assert.throws(() => builder.confirmMapping("decision:mapping-b", "principal:finance-reviewer", NOW_MS),
    (error: unknown) => error instanceof GuidedPathDenied && error.code === "OPEN_QUESTIONS_BLOCK_CONFIRMATION");
  builder.answer(question.questionId, "behandele_unbekannt_flaggen", NOW_MS + 1000);
  const updated = builder.proposal();
  assert.equal(updated.openQuestions.filter((q) => q.options.length > 0).length, 0);
  assert.notEqual(updated.proposalDigest, proposal.proposalDigest, "answers must change the sealed proposal");
  const mappingDecision = builder.confirmMapping("decision:mapping-b", "principal:finance-reviewer", NOW_MS + 2000);
  assert.equal(mappingDecision.proposalDigest, updated.proposalDigest);
  const inputs = adaptContextToMarginInputsV1({ context: builder.build().context, mapping: updated, pack });
  assert.deepEqual(inputs.invoices.map((i) => i.totalMinor), [2999, 3000, 2500], "29.99/30.00/25.00 EUR -> cent conversion");
  const executionDecision = builder.confirmExecution("decision:execution-b", "principal:finance-reviewer", inputs, NOW_MS + 3000);
  const receipt = builder.execute(executionDecision, inputs);
  assert.equal(receipt.outcome, "EXECUTED");
  assert.deepEqual(receipt.result?.flagged, [
    { recordId: "rechnung:101", valueMinor: 2999, reason: "BELOW_THRESHOLD" },
    { recordId: "rechnung:103", valueMinor: 2500, reason: "BELOW_THRESHOLD_CUSTOMER_UNKNOWN" },
  ]);
  assert.equal(receipt.result?.count, 2);
  assert.equal(receipt.result?.totalInputMinor, 8499);
  assert.equal(builder.build().terminal, "EXECUTED");
});

test("KTS-02 context C (USD amounts) never executes: unit conflict blocks, user rejects", () => {
  const pack = loadPack("invoices-usd");
  const spec = loadSpec();
  const builder = GuidedPathBuilder.fromContext({ pack, spec });
  builder.recordGoal();
  const proposal = builder.attachSelection(viewFor(builder));
  builder.recordProposal();
  const blocking = proposal.openQuestions.filter((q) => q.options.length > 0);
  assert.ok(blocking.length >= 2, "amount unit + floor unit conflicts expected");
  assert.ok(blocking.every((q) => q.options.includes("kontext_nicht_ausfuhrbar") && q.options.includes("ablehnen")));
  for (const question of blocking) {
    builder.answer(question.questionId, "kontext_nicht_ausfuhrbar", NOW_MS);
  }
  const after = builder.proposal();
  const stillBlocking = after.openQuestions.filter((q) => q.options.length > 0);
  assert.ok(stillBlocking.length >= 2, "unit conflicts are permanent: answers cannot clear them");
  assert.throws(() => builder.confirmMapping("decision:mapping-c", "principal:finance-reviewer", NOW_MS),
    (error: unknown) => error instanceof GuidedPathDenied && error.code === "OPEN_QUESTIONS_BLOCK_CONFIRMATION");
  builder.reject("kontext_nicht_ausfuhrbar: Waehrung USD, Methode arbeitet nur in EUR");
  const built = builder.build();
  assert.equal(built.terminal, "REJECTED_BY_USER");
  assert.equal(built.receipt, null, "no execution may happen on a unit-conflicting context");
});

test("KTS-02 execution decision must bind the EXACT inputs (tampered inputs denied)", () => {
  const pack = loadPack("invoices-eur-cent");
  const spec = loadSpec();
  const builder = GuidedPathBuilder.fromContext({ pack, spec });
  builder.recordGoal();
  const mapping = builder.attachSelection(viewFor(builder));
  builder.recordProposal();
  builder.confirmMapping("decision:mapping-a", "principal:finance-reviewer", NOW_MS);
  const inputs = adaptContextToMarginInputsV1({ context: builder.build().context, mapping, pack });
  const decision = builder.confirmExecution("decision:execution-a", "principal:finance-reviewer", inputs, NOW_MS);
  const tampered = { ...inputs, invoices: inputs.invoices.map((i) => (i.invoiceId === "rechnung:001" ? { ...i, totalMinor: 9999 } : i)) };
  const denied = builder.execute(decision, tampered);
  assert.equal(denied.outcome, "DENIED");
  assert.deepEqual(denied.denialReasons, ["DECISION_DOES_NOT_BIND_INPUTS"]);
  assert.equal(builder.build().terminal, "DENIED");
});

const isContextDenied = (error: unknown): boolean =>
  error instanceof GuidedPathDenied
    ? (error as GuidedPathDenied).code.startsWith("CONTEXT_")
    : error instanceof Error && error.message.startsWith("CONTEXT_");

test("KTS-02 tampered context packs fail closed at binding time", () => {
  const source = path.join(PKG, "contexts", "invoices-eur-cent");
  const original = loadContextPackV1(source);
  const spec = loadSpec();
  const dir = mkdtempSync(path.join(tmpdir(), "kts02-tamper-"));
  for (const file of ["descriptor.json", "rows.csv", "floor.json"]) {
    writeFileSync(path.join(dir, file), readFileSync(path.join(source, file)));
  }
  // tamper the descriptor: change a field meaning without updating the digest
  const descriptor = JSON.parse(readFileSync(path.join(dir, "descriptor.json"), "utf8")) as { fields: { field: string; meaning: string }[] };
  descriptor.fields.find((f) => f.field === "rechnungsbetrag_cent")!.meaning = "willkuerlich veraendert";
  writeFileSync(path.join(dir, "descriptor.json"), JSON.stringify(descriptor, null, 2) + "\n");
  assert.throws(() => GuidedPathBuilder.fromContext({ pack: loadContextPackV1(dir), spec }), isContextDenied);
  // tamper rows.csv: the sealed digest binding must reject the drifted bytes
  const dir2 = mkdtempSync(path.join(tmpdir(), "kts02-tamper2-"));
  for (const file of ["descriptor.json", "rows.csv", "floor.json"]) {
    writeFileSync(path.join(dir2, file), readFileSync(path.join(source, file)));
  }
  writeFileSync(path.join(dir2, "rows.csv"), readFileSync(path.join(dir2, "rows.csv"), "utf8").replace("2999", "1"));
  const tamperedPack = loadContextPackV1(dir2);
  assert.notEqual(tamperedPack.data.dataDigest, original.data.dataDigest, "drift must change the sealed digest");
  assert.throws(() => GuidedPathBuilder.fromContext({ pack: tamperedPack, spec, sealedDataDigest: original.data.dataDigest }),
    (error: unknown) => error instanceof GuidedPathDenied && (error as GuidedPathDenied).code === "CONTEXT_DATA_TAMPERED");
});

test("KTS-02 both contexts reuse the SAME sealed spec digest (no core rewrite)", () => {
  const packA = loadPack("invoices-eur-cent");
  const packB = loadPack("legacy-erp-de");
  const spec = loadSpec();
  const builderA = GuidedPathBuilder.fromContext({ pack: packA, spec });
  const builderB = GuidedPathBuilder.fromContext({ pack: packB, spec });
  builderA.recordGoal();
  builderB.recordGoal();
  const mappingA = builderA.attachSelection(viewFor(builderA));
  const mappingB = builderB.attachSelection(viewFor(builderB));
  assert.equal(mappingA.specDigest, spec.specDigest);
  assert.equal(mappingB.specDigest, spec.specDigest);
  assert.notEqual(packA.descriptor.contextId, packB.descriptor.contextId);
  assert.notEqual(packA.descriptor.sourceFormat, packB.descriptor.sourceFormat);
  assert.ok(validateContextDescriptorV1(packA.descriptor));
  assert.ok(validateContextDescriptorV1(packB.descriptor));
});

const sha = (value: string): string => createHash("sha256").update(value).digest("hex");
