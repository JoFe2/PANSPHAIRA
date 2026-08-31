import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import test from "node:test";

import { buildMatrix, canonicalJson, renderArtifacts, verifyMatrix, verifyReleasedInputs } from "../../src/cscl-07/matrix.mjs";

const root = resolve(import.meta.dirname, "../..");
const fixture = (name) => resolve(root, `tests/fixtures/cscl-07/${name}`);
const load = async (path) => JSON.parse(await readFile(path, "utf8"));

test("builds the frozen 36-row 180-cell matrix before relations", async () => {
  const result = await buildMatrix({ repoRoot: root });
  assert.equal(result.matrix.rows.length, 36);
  assert.equal(result.matrix.rows.flatMap((row) => row.cells).length, 180);
  assert.equal(new Set(result.matrix.rows.map((row) => `${row.capabilityFamily}/${row.questionId}`)).size, 36);
  assert.ok(result.matrix.rows.every((row) => row.cells.length === 5));
  assert.deepEqual(result.matrix.systemOrder, ["odoo-community", "erpnext", "dolibarr", "tryton", "apache-ofbiz"]);
  assert.equal(verifyMatrix(result.matrix, result.inputs).outcome, "VERIFIED");
  assert.equal(canonicalJson((await buildMatrix({ repoRoot: root })).matrix), canonicalJson(result.matrix));
});

test("independently reproduces exact released state denominators", async () => {
  const { inputs } = await buildMatrix({ repoRoot: root });
  assert.deepEqual(inputs.stateDistribution, { SUPPORTED: 152, ABSENT: 8, AMBIGUOUS: 16, VARIANT: 1, CONFLICTING: 3, UNMAPPED: 0 });
  const expected = {
    "odoo-community": { SUPPORTED: 27, ABSENT: 3, AMBIGUOUS: 6, VARIANT: 0, CONFLICTING: 0, UNMAPPED: 0 },
    erpnext: { SUPPORTED: 31, ABSENT: 0, AMBIGUOUS: 5, VARIANT: 0, CONFLICTING: 0, UNMAPPED: 0 },
    dolibarr: { SUPPORTED: 33, ABSENT: 0, AMBIGUOUS: 1, VARIANT: 0, CONFLICTING: 2, UNMAPPED: 0 },
    tryton: { SUPPORTED: 28, ABSENT: 4, AMBIGUOUS: 3, VARIANT: 1, CONFLICTING: 0, UNMAPPED: 0 },
    "apache-ofbiz": { SUPPORTED: 33, ABSENT: 1, AMBIGUOUS: 1, VARIANT: 0, CONFLICTING: 1, UNMAPPED: 0 },
  };
  for (const source of inputs.profiles) {
    const actual = Object.fromEntries(Object.keys(expected[source.binding.systemId]).map((state) => [state, source.cells.filter((cell) => cell.state === state).length]));
    assert.deepEqual(actual, expected[source.binding.systemId], source.binding.systemId);
  }
});

test("preserves every exact cell, fact, profile term, negative and counterexample", async () => {
  const { inputs, matrix } = await buildMatrix({ repoRoot: root });
  for (const source of inputs.profiles) {
    const emitted = matrix.rows.flatMap((row) => row.cells).filter((cell) => cell.systemId === source.binding.systemId);
    assert.equal(emitted.length, 36);
    assert.deepEqual(emitted.map((cell) => cell.sourceCell), source.cells);
    assert.deepEqual(matrix.sourceProfiles.find((x) => x.systemId === source.binding.systemId).profile, source.profile);
    assert.deepEqual(matrix.sourceProfiles.find((x) => x.systemId === source.binding.systemId).sourceFacts, source.facts);
  }
  for (const state of ["ABSENT", "AMBIGUOUS", "CONFLICTING", "VARIANT"])
    assert.ok(matrix.rows.flatMap((row) => row.cells).some((cell) => cell.sourceCell.state === state), state);
  assert.ok(matrix.rows.flatMap((row) => row.cells).filter((cell) => ["ABSENT", "CONFLICTING"].includes(cell.sourceCell.state)).every((cell) => cell.sourceCell.counterexamples.length > 0));
});

test("derives every analytic relation from the complete source-bound review ledger", async () => {
  const { inputs, matrix } = await buildMatrix({ repoRoot: root });
  assert.equal(inputs.evidenceReview.reviews.length, 36);
  assert.equal(matrix.relationCandidates.length, 36);
  const outcomes = Object.fromEntries(["POTENTIAL_EQUIVALENCE", "VARIANT_RELATION", "DISTINCT", "UNRESOLVED", "DENIED"].map((state) => [state, inputs.evidenceReview.reviews.filter((review) => review.outcome === state).length]));
  assert.deepEqual(outcomes, { POTENTIAL_EQUIVALENCE: 0, VARIANT_RELATION: 2, DISTINCT: 0, UNRESOLVED: 28, DENIED: 6 });
  for (const review of inputs.evidenceReview.reviews) {
    const candidate = matrix.relationCandidates.find((x) => x.relationId === review.relationId);
    assert.equal(candidate.state, review.outcome);
    assert.equal(review.reviewedCellReferences.length, 5);
    assert.ok(review.semanticDimensionsAssessed.length > 0);
    if (review.outcome === "UNRESOLVED") assert.ok(review.missingOrInsufficientDimensions.length > 0);
    if (review.outcome === "DENIED") assert.ok(review.negativeEvidence.length > 0);
  }
});

test("denies complete adversarial matrix mutations including caller labels and shared attacker digest", async () => {
  const built = await buildMatrix({ repoRoot: root });
  const attacks = [
    ["missing profile", (x) => x.sourceProfiles.pop()],
    ["duplicate profile", (x) => x.sourceProfiles.push(structuredClone(x.sourceProfiles[0]))],
    ["missing cell", (x) => x.rows[0].cells.pop()],
    ["duplicate cell", (x) => x.rows[0].cells.push(structuredClone(x.rows[0].cells[0]))],
    ["missing row", (x) => x.rows.pop()],
    ["duplicate row", (x) => x.rows.push(structuredClone(x.rows[0]))],
    ["profile digest", (x) => { x.rows[0].cells[0].sourceProfileDigest = "0".repeat(64); }],
    ["cell substitution", (x) => { x.rows[0].cells[0].sourceCell.state = "VARIANT"; }],
    ["fact substitution", (x) => { x.rows[0].cells[0].sourceFacts[0].claim += " invented"; }],
    ["paired redigestion", (x) => { x.rows[0].cells[0].sourceCell.state = "VARIANT"; x.rows[0].cells[0].sourceCellDigest = "1".repeat(64); }],
    ["negative omission", (x) => { const c = x.rows.flatMap((r) => r.cells).find((c) => c.sourceCell.state === "ABSENT"); c.sourceCell.state = "SUPPORTED"; }],
    ["ambiguous omission", (x) => { const c = x.rows.flatMap((r) => r.cells).find((c) => c.sourceCell.state === "AMBIGUOUS"); c.sourceCell.state = "SUPPORTED"; }],
    ["conflicting omission", (x) => { const c = x.rows.flatMap((r) => r.cells).find((c) => c.sourceCell.state === "CONFLICTING"); c.sourceCell.state = "SUPPORTED"; }],
    ["variant omission", (x) => { const c = x.rows.flatMap((r) => r.cells).find((c) => c.sourceCell.state === "VARIANT"); c.sourceCell.state = "SUPPORTED"; }],
    ["counterexample omission", (x) => { x.rows.flatMap((r) => r.cells).find((c) => c.sourceCell.counterexamples.length).sourceCell.counterexamples = []; }],
    ["lexical synonym", (x) => { x.relationCandidates[0].reason = "same synonym"; }],
    ["lexical homonym", (x) => { x.relationCandidates[0].state = "POTENTIAL_EQUIVALENCE"; }],
    ["identical shape", (x) => { x.relationCandidates[0].supportedDimensions = ["fieldShape"]; }],
    ["four fifths", (x) => { x.relationCandidates[0].reason = "4/5 majority"; }],
    ["caller relation", (x) => { x.relationCandidates[0].state = "DISTINCT"; }],
    ["caller verdict", (x) => { x.verdict = "GO"; }],
    ["caller digest", (x) => { x.matrixDigest = "2".repeat(64); }],
    ["caller count", (x) => { x.cellCount = 179; }],
    ["invented edge", (x) => { x.relationCandidates[0].supportedDimensions = ["purpose"]; }],
    ["order", (x) => x.rows.reverse()],
    ["extra", (x) => { x.rows[0].extra = true; }],
    ["holdout", (x) => { x.holdoutPath = "idempiere/release-13"; }],
    ["holdout id", (x) => { x.holdoutSystemId = "idempiere"; }],
    ["Capability", (x) => { x.Capability = {}; }],
    ["ProcessPattern", (x) => { x.ProcessPattern = {}; }],
    ["commonCore", (x) => { x.commonCore = {}; }],
    ["promotion", (x) => { x.promotion = true; }],
    ["execution", (x) => { x.execution = true; }],
    ["Authority", (x) => { x.Authority = "WRITE"; }],
    ["shared attacker digest", (x) => { for (const row of x.rows) for (const cell of row.cells) cell.sourceCell.equivalenceProof.candidateMeaningSha256 = "a".repeat(64); x.relationCandidates[0].state = "POTENTIAL_EQUIVALENCE"; }],
  ];
  for (const [label, mutate] of attacks) {
    const changed = structuredClone(built.matrix); mutate(changed);
    assert.throws(() => verifyMatrix(changed, built.inputs), /MATRIX|INPUT|SOURCE|RELATION|EVIDENCE|DENOMINATOR|MISMATCH|FIELD/, label);
  }
});

test("denies mutated loaded inputs and paired relation-spec redigestion", async () => {
  const { inputs } = await buildMatrix({ repoRoot: root });
  const changed = structuredClone(inputs);
  changed.profiles[0].cells[0].state = "VARIANT";
  changed.profiles[0].binding.cellsDigest = "0".repeat(64);
  assert.throws(() => verifyReleasedInputs(changed), /DIGEST|INPUT|PROFILE/);
  const edge = structuredClone(inputs);
  edge.relationSpec.evidenceEdges.push({ callerLabel: "all equivalent" });
  edge.relationSpec.specDigest = "f".repeat(64);
  assert.throws(() => verifyReleasedInputs(edge), /RELATION|EVIDENCE|DIGEST/);
  const missingReview = structuredClone(inputs);
  missingReview.evidenceReview.reviews.pop();
  assert.throws(() => verifyReleasedInputs(missingReview), /REVIEW|DENOMINATOR|DIGEST/);
  const unnamedGap = structuredClone(inputs);
  delete unnamedGap.evidenceReview.reviews.find((review) => review.outcome === "UNRESOLVED").missingOrInsufficientDimensions;
  assert.throws(() => verifyReleasedInputs(unnamedGap), /REVIEW|DIMENSION|DIGEST/);
});

test("adversarial fixture freezes every required denial case", async () => {
  const fixtureData = await load(fixture("adversarial-cases-v1.json"));
  const ids = new Set(fixtureData.cases.map((item) => item.id));
  for (const required of ["missing-profile", "duplicate-profile", "missing-cell", "duplicate-cell", "missing-row", "duplicate-row", "changed-profile-digest", "source-cell-substitution", "source-fact-substitution", "paired-substitution-redigestion", "omitted-ABSENT", "omitted-AMBIGUOUS", "omitted-CONFLICTING", "omitted-VARIANT", "omitted-counterexample", "lexical-synonym", "lexical-homonym", "identical-field-shape", "four-of-five-frequency", "caller-relation-label", "caller-verdict", "caller-digest", "caller-count", "invented-evidence-edge", "order-dependence", "extra-field", "holdout-path", "idempiere-path", "idempiere-id", "Capability-field", "ProcessPattern-field", "commonCore-field", "promotion-field", "execution-field", "Authority-field", "shared-attacker-candidateMeaningSha256"])
    assert.ok(ids.has(required), required);
  assert.ok(fixtureData.cases.every((item) => item.expected === "DENIED"));
});

test("rendered expected matrix, full artifact and receipt are frozen byte-identically", async () => {
  const artifacts = await renderArtifacts({ repoRoot: root });
  assert.equal(artifacts.matrix, await readFile(fixture("expected-matrix-v1.json"), "utf8"));
  assert.equal(artifacts.matrix, await readFile(resolve(root, "verification/cscl-07-semantic-evidence-matrix-v1.json"), "utf8"));
  assert.equal(artifacts.receipt, await readFile(resolve(root, "verification/cscl-07-semantic-evidence-matrix-receipt-v1.json"), "utf8"));
  assert.deepEqual(artifacts, await renderArtifacts({ repoRoot: root }));
});
