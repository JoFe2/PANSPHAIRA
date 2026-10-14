import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import test from "node:test";
import { evaluateCandidate } from "../benchmarks/adaptability-m0/ai-blind/evaluate.mjs";

const root = resolve(import.meta.dirname, "..");
const fixture = "demo/builder-agent/runtime-contract-second-system-v1.json";
const hash = (bytes) => createHash("sha256").update(bytes).digest("hex");
function probe(change = () => {}, options = {}) {
  const parent = process.env.TMPDIR || process.env.RUNNER_TEMP;
  assert.ok(parent, "Owned TMPDIR or RUNNER_TEMP is required");
  const directory = mkdtempSync(join(parent, "pan615-grade-"));
  try {
    const candidate = JSON.parse(readFileSync(join(root, fixture), "utf8"));
    change(candidate);
    const bytes = `${JSON.stringify(candidate, null, 2)}\n`;
    const path = join(directory, "candidate.json");
    writeFileSync(path, bytes, { mode: 0o600 });
    return { result: evaluateCandidate(path, options), bytes, candidate };
  } finally {
    rmSync(directory, { recursive: true });
  }
}
const read = (c) => c.admittedCapabilities.find((op) => op.effectClass === "READ_ONLY");
const write = (c) => c.admittedCapabilities.find((op) => op.effectClass === "REVERSIBLE_WRITE");

test("FP-GRADE legacy participant member embeds the exact independent reference bytes", () => {
  const input = JSON.parse(readFileSync(join(root, "benchmarks/adaptability-m0/ai-blind/participant-input.json"), "utf8"));
  const referenceBytes = readFileSync(join(root, "benchmarks/adaptability-m0/ai-blind/semantic-expectation-v1.json"), "utf8");
  assert.equal(input.semanticExpectationJson, referenceBytes);
  assert.equal(input.status, "PREPARED_NOT_RUN");
  assert.equal(JSON.parse(input.semanticExpectationJson).schemaVersion, "chimpmaera.adaptability-semantic-expectation/v1");
});

test("FP-GRADE wrong read field cannot pass despite valid digests and two readbacks", () => {
  const { result } = probe((c) => { read(c).adapter.stateField = "brightnessPct"; });
  assert.equal(result.status, "FAIL");
  assert.ok(result.issues.includes("SEMANTIC_READ_FIELD_MISMATCH"));
  assert.equal(result.execution.calls[0].result.readback.value, 55);
});

test("FP-GRADE positive observes lux410 and the actual persisted65 effect before rollback", () => {
  const { result } = probe();
  assert.equal(result.status, "PASS", JSON.stringify(result.issues));
  assert.equal(result.outcome, "SEMANTIC_SUCCESS");
  assert.equal(result.schemaVersion, "chimpmaera.adaptability-ai-blind-evaluation/v2");
  assert.equal(result.execution.calls[0].result.readback.value, 410);
  assert.ok(result.execution.targetSnapshots.some((s) => s.target.brightnessPct === 65));
  assert.deepEqual(result.execution.targetBeforeReset, { illuminanceLux: 410, brightnessPct: 55 });
  assert.equal(result.execution.residueTargetDrift, 0);
  assert.equal(result.execution.readbackCount, 2);
  assert.equal(result.execution.retrySameReceiptCount, 2);
});

test("FP-GRADE wrong write field is judged from the temporary persisted target", () => {
  const { result } = probe((c) => { write(c).adapter.stateField = "illuminanceLux"; });
  assert.equal(result.status, "FAIL");
  assert.ok(result.issues.includes("SEMANTIC_WRITE_FIELD_MISMATCH"));
  assert.ok(result.execution.targetSnapshots.some((s) => s.target.illuminanceLux === 65));
});

test("FP-GRADE wrong numerical payload is not made correct by a consistent approval hash", () => {
  const { result } = probe((c) => { write(c).request.payload.brightnessPct = 66; });
  assert.equal(result.status, "FAIL");
  assert.ok(result.issues.includes("SEMANTIC_WRITE_VALUE_MISMATCH"));
  assert.ok(result.execution.targetSnapshots.some((s) => s.target.brightnessPct === 66));
});

test("FP-GRADE no-op cannot substitute for the required actual target effect", () => {
  const { result } = probe((c) => { write(c).request.payload.brightnessPct = 55; });
  assert.equal(result.status, "FAIL");
  assert.ok(result.issues.includes("SEMANTIC_APPLIED_TARGET_NOT_OBSERVED"));
  assert.ok(!result.execution.targetSnapshots.some((s) => s.target.brightnessPct === 65));
});

test("FP-GRADE explicit wrong read and write units remain contradictions", () => {
  const { result } = probe((c) => { read(c).adapter.unit = "watt"; write(c).adapter.unit = "lux"; });
  assert.equal(result.status, "FAIL");
  assert.ok(result.issues.includes("SEMANTIC_READ_UNIT_MISMATCH"));
  assert.ok(result.issues.includes("SEMANTIC_WRITE_UNIT_MISMATCH"));
});

test("FP-GRADE foreign tenant is a bound controlled admission denial, not a business success", () => {
  const { result, bytes } = probe((c) => { c.target.tenant = "synthetic-foreign"; });
  assert.equal(result.status, "FAIL");
  assert.equal(result.outcome, "CONTROLLED_REJECTION");
  assert.equal(result.execution, null);
  assert.equal(result.bindings.candidateRawSHA256, hash(bytes));
  assert.ok(result.issues.includes("TARGET_TENANT_MISMATCH"));
});

test("FP-GRADE actual extra persisted effect is visible even when rollback later restores it", () => {
  const { result } = probe(() => {}, { scenario: "EXTRA_PERSISTED_EFFECT" });
  assert.equal(result.status, "FAIL");
  assert.ok(result.issues.includes("SEMANTIC_UNPERMITTED_TARGET_EFFECT"));
  assert.ok(result.execution.targetSnapshots.some((s) => s.target.illuminanceLux === 411 && s.target.brightnessPct === 65));
  assert.equal(result.execution.targetBeforeReset.illuminanceLux, 410);
  assert.equal(result.bindings.scenario, "EXTRA_PERSISTED_EFFECT");
});

test("FP-GRADE real unresolved synthetic rollback leaves manual repair distinct and never resets it away", () => {
  const { result } = probe(() => {}, { scenario: "ROLLBACK_PERSISTENCE_FAILURE" });
  assert.equal(result.status, "FAIL");
  assert.equal(result.outcome, "MANUAL_REPAIR_REQUIRED");
  assert.equal(result.execution.targetBeforeReset.brightnessPct, 65);
  assert.equal(result.execution.ownedTargetDrift, 1);
  assert.equal(result.execution.coreReportedOwnedTargetDrift, 0);
  assert.equal(result.execution.resetAttempted, false);
  assert.ok(result.issues.includes("ROLLBACK_MISMATCH_DENIED"));
});

test("FP-GRADE actual native request tenant denial remains controlled rejection", () => {
  const { result } = probe(() => {}, { scenario: "FOREIGN_REQUEST_TENANT" });
  assert.equal(result.status, "FAIL");
  assert.equal(result.outcome, "CONTROLLED_REJECTION");
  assert.ok(result.issues.includes("BUILDER_REQUEST_BINDING_DENIED"));
  assert.deepEqual(result.execution.targetBeforeReset, { illuminanceLux: 410, brightnessPct: 55 });
});

test("FP-GRADE legitimate payload aliases, request IDs, order and exact unit aliases still pass", () => {
  const { result } = probe((c) => {
    const r = read(c); const w = write(c);
    r.adapter.entityPayloadField = "zoneRef"; r.adapter.unit = "lx";
    r.request.payload = { zoneRef: "zone-12" }; r.request.requestId = "legitimate-read-alternative";
    w.adapter.entityPayloadField = "zoneRef"; w.adapter.payloadField = "level"; w.adapter.unit = "pct";
    w.request.payload = { level: 65, zoneRef: "zone-12" }; w.request.requestId = "legitimate-write-alternative";
    c.admittedCapabilities.reverse();
  });
  assert.equal(result.status, "PASS", JSON.stringify(result.issues));
  assert.equal(result.outcome, "SEMANTIC_SUCCESS");
});

test("FP-GRADE wrong requested entity cannot hide behind matching value and field", () => {
  const { result } = probe((c) => { read(c).request.payload.zoneId = "zone-foreign"; });
  assert.equal(result.status, "FAIL");
  assert.ok(result.issues.includes("SEMANTIC_READ_ENTITY_MISMATCH"));
});

test("FP-GRADE unavailable candidate is NOT_RUN with no invented raw candidate digest", () => {
  const { result } = probe();
  assert.equal(result.outcome, "SEMANTIC_SUCCESS");
  const missing = evaluateCandidate(join(root, "benchmarks/adaptability-m0/ai-blind/does-not-exist.json"));
  assert.equal(missing.status, "FAIL");
  assert.equal(missing.outcome, "NOT_RUN");
  assert.equal(missing.execution, null);
  assert.equal(missing.bindings.candidateRawSHA256, null);
  assert.match(missing.bindings.checkerSHA256, /^[a-f0-9]{64}$/);
});

test("FP-GRADE every observed outcome has exact case/candidate/checker/oracle/evidence identity", () => {
  const cases = [
    probe(() => {}, { caseId: "POSITIVE-OWNED-REFERENCE" }),
    probe((c) => { read(c).adapter.stateField = "brightnessPct"; }, { caseId: "WRONG-READ" }),
    probe(() => {}, { caseId: "NATIVE-DENIAL", scenario: "FOREIGN_REQUEST_TENANT" }),
    probe(() => {}, { caseId: "REPAIR-REQUIRED", scenario: "ROLLBACK_PERSISTENCE_FAILURE" }),
  ];
  const checker = hash(readFileSync(join(root, "benchmarks/adaptability-m0/ai-blind/evaluate.mjs")));
  const oracle = hash(readFileSync(join(root, "benchmarks/adaptability-m0/ai-blind/semantic-expectation-v1.json")));
  for (const { result, bytes } of cases) {
    assert.equal(result.bindings.candidateRawSHA256, hash(bytes));
    assert.equal(result.bindings.checkerSHA256, checker);
    assert.equal(result.bindings.expectedContractSHA256, oracle);
    assert.equal(result.bindings.caseId.length > 0, true);
    assert.match(result.evidenceDigest, /^[a-f0-9]{64}$/);
    const { evidenceDigest, ...body } = result;
    assert.equal(evidenceDigest, hash(JSON.stringify(body)));
  }
  assert.equal(new Set(cases.map(({ result }) => result.evidenceDigest)).size, cases.length);
});

test("FP-GRADE malformed JSON and primitive candidates retain bound non-success outcomes", () => {
  const parent = process.env.TMPDIR || process.env.RUNNER_TEMP;
  assert.ok(parent);
  const directory = mkdtempSync(join(parent, "pan615-invalid-"));
  try {
    for (const bytes of ["null\n", "{}\n", "[]\n", "{invalid-json\n"]) {
      const path = join(directory, "candidate.json");
      writeFileSync(path, bytes, { mode: 0o600 });
      const result = evaluateCandidate(path);
      assert.equal(result.status, "FAIL");
      assert.equal(result.outcome, bytes.startsWith("{invalid") ? "NOT_RUN" : "CONTROLLED_REJECTION");
      assert.equal(result.execution, null);
      assert.equal(result.bindings.candidateRawSHA256, hash(bytes));
      assert.match(result.evidenceDigest, /^[a-f0-9]{64}$/);
    }
  } finally { rmSync(directory, { recursive: true }); }
});

test("FP-GRADE unknown scenario or malformed literal case ID is NOT_RUN and never repaired", () => {
  const invalidCase = probe(() => {}, { caseId: "bad case id" }).result;
  assert.equal(invalidCase.outcome, "NOT_RUN");
  assert.equal(invalidCase.bindings.caseId, "bad case id");
  assert.ok(invalidCase.issues.includes("CASE_ID_INVALID"));
  const unknown = probe(() => {}, { scenario: "NOT_AN_ADMITTED_SCENARIO" }).result;
  assert.equal(unknown.outcome, "NOT_RUN");
  assert.equal(unknown.bindings.scenario, "NOT_AN_ADMITTED_SCENARIO");
  assert.equal(unknown.execution, null);
});
