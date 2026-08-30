import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

import {
  canonicalize,
  sha256,
  validateP21Replay,
} from "../../scripts/verify-cks-10-p21-replay.mjs";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const projectionPath = resolve(repoRoot, "tests/fixtures/cks-10/p21-planted-projection-v1.json");
const expectedPath = resolve(repoRoot, "tests/fixtures/cks-10/p21-expected-candidates-v1.json");
const casesPath = resolve(repoRoot, "tests/fixtures/cks-10/p21-replay-negative-cases-v1.json");

async function readFixture(path) {
  return JSON.parse(await readFile(path, "utf8"));
}

function setPath(value, path, replacement) {
  const parts = path.split(".");
  const leaf = parts.pop();
  let target = value;
  for (const part of parts) target = target[part];
  target[leaf] = replacement;
}

function reorder(value) {
  if (Array.isArray(value)) return value.map(reorder);
  if (value === null || typeof value !== "object") return value;
  return Object.fromEntries(Object.entries(value).reverse().map(([key, child]) => [key, reorder(child)]));
}

function inputFor(projection, expected, emitted, nowMs, replayState, trustedProjection = projection) {
  return {
    projection,
    trustedProjection: structuredClone(trustedProjection),
    authorityProjectionDigest: trustedProjection.exchange.projectionDigest,
    expected,
    emitted,
    nowMs,
    replayState,
  };
}

function assertDenied(result, reason, caseId) {
  assert.equal(result.outcome, "DENIED", `${caseId}: ${JSON.stringify(result)}`);
  assert.ok(result.reasonCodes.some((code) => code === reason || code.startsWith(`${reason}:`)), `${caseId}: ${result.reasonCodes.join(",")}`);
  assert.equal(result.authorityClass, "NONE", `${caseId}: denial must remain authority-free`);
  assert.equal(result.promotionClaim, "NONE", `${caseId}: denial must not claim promotion`);
}

test("P21 reproduces the planted seven-candidate set from exact projection digests", async () => {
  const projection = await readFixture(projectionPath);
  const expected = await readFixture(expectedPath);
  const result = validateP21Replay(inputFor(projection, expected, expected, 1787898600000, new Map()));

  assert.equal(result.outcome, "VERIFIED");
  assert.deepEqual(result.reasonCodes, ["P21_REPLAY_VERIFIED"]);
  assert.deepEqual(result.candidateIds, expected.candidates.map((candidate) => candidate.candidateId));
  assert.deepEqual(result.evidenceIds, expected.evidence.map((evidence) => evidence.evidenceId));
  assert.deepEqual(result.allowedEdgeIds, expected.allowedEvidenceEdges.map((edge) => edge.edgeId));
  assert.equal(result.candidateIds.length, 7);
  assert.equal(result.evidenceIds.length, 7);
  assert.equal(result.allowedEdgeIds.length, 5);
  assert.equal(result.inventedEdges, 0);
  assert.equal(result.candidateBlindSpotCount, 14);
  assert.equal(result.globalBlindSpots.length, 5);
  assert.deepEqual(result.boundary, {
    lifecycleClass: "UNTRUSTED_CANDIDATE",
    authorityClass: "NONE",
    effectClass: "NONE",
    requestedDisposition: "REVIEW_ONLY",
    promotionClaim: "NONE",
  });
});

test("P21 accepts canonical object-key reordering but rejects an exact replay", async () => {
  const projection = await readFixture(projectionPath);
  const expected = await readFixture(expectedPath);
  const replayState = new Map();
  const first = validateP21Replay(inputFor(projection, expected, expected, 1787898600000, replayState));
  const reordered = reorder(expected);
  const second = validateP21Replay(inputFor(projection, expected, reordered, 1787898600000, replayState));

  assert.equal(first.outcome, "VERIFIED");
  assert.equal(second.outcome, "DENIED");
  assert.deepEqual(second.reasonCodes, ["REPLAYED_CANDIDATE"]);
  assert.equal(canonicalize(reordered), canonicalize(expected));
  assert.equal(sha256(reordered), sha256(expected));
  assert.equal(replayState.size, 1);
});

test("every P21 emitted edge is explicit, witnessed, in scope, and allowlisted", async () => {
  const projection = await readFixture(projectionPath);
  const expected = await readFixture(expectedPath);
  const result = validateP21Replay(inputFor(projection, expected, expected, 1787898600000, new Map()));

  assert.equal(result.outcome, "VERIFIED");
  assert.equal(expected.inventedEdges, 0);
  assert.equal(expected.allowedEvidenceEdges.length, 5);
  for (const edge of expected.allowedEvidenceEdges) {
    assert.equal(edge.explicit, true);
    assert.equal(edge.declaredByEvidenceId, edge.sourceEvidenceId);
    assert.ok(expected.evidence.find((evidence) => evidence.evidenceId === edge.declaredByEvidenceId)?.declaredEdgeIds.includes(edge.edgeId));
    assert.ok(expected.evidence.find((evidence) => evidence.evidenceId === edge.sourceEvidenceId));
    assert.ok(expected.evidence.find((evidence) => evidence.evidenceId === edge.targetEvidenceId));
  }
});

test("declared negative cases fail closed for scope, time, provenance, replay, edges, blind spots, and authority", async () => {
  const projectionBaseline = await readFixture(projectionPath);
  const expectedBaseline = await readFixture(expectedPath);
  const cases = await readFixture(casesPath);
  assert.equal(cases.negativeCases.length, 14);

  for (const negative of cases.negativeCases) {
    const projection = structuredClone(projectionBaseline);
    const expected = structuredClone(expectedBaseline);
    const emitted = structuredClone(expectedBaseline);
    const nowMs = negative.nowMs ?? cases.trustedNowMs;
    let replayState = new Map();

    if (negative.target === "projection") setPath(projection, negative.path, negative.value);
    if (negative.target === "emitted" && negative.path) {
      if (negative.caseId === "invented-evidence-edge") {
        emitted.allowedEvidenceEdges.push({
          edgeId: "edge-p21-invented-290-0001",
          edgeVersion: "1.0.0",
          edgeDigest: "0".repeat(64),
          sourceEvidenceId: "ev-p21-gap-290-0001",
          targetEvidenceId: "ev-p21-co-usage-290-0001",
          relationClass: "INVENTED",
          declaredByEvidenceId: "ev-p21-gap-290-0001",
          explicit: true,
        });
      } else {
        setPath(emitted, negative.path, negative.value);
      }
    }
    if (negative.caseId === "missing-trusted-clock") {
      const result = validateP21Replay({ ...inputFor(projection, expected, emitted, nowMs, replayState, projectionBaseline), nowMs: undefined });
      assertDenied(result, negative.reason, negative.caseId);
      continue;
    }
    if (negative.caseId === "missing-replay-state") {
      const result = validateP21Replay({ ...inputFor(projection, expected, emitted, nowMs, replayState, projectionBaseline), replayState: undefined });
      assertDenied(result, negative.reason, negative.caseId);
      continue;
    }
    if (negative.caseId === "replayed-candidate") {
      const first = validateP21Replay(inputFor(projection, expected, emitted, nowMs, replayState, projectionBaseline));
      assert.equal(first.outcome, "VERIFIED");
      const result = validateP21Replay(inputFor(projection, expected, emitted, nowMs, replayState, projectionBaseline));
      assertDenied(result, negative.reason, negative.caseId);
      continue;
    }
    if (negative.caseId === "replay-mutation") {
      replayState.set(projection.exchange.replayId, "prior-replay-fingerprint");
      const result = validateP21Replay(inputFor(projection, expected, emitted, nowMs, replayState, projectionBaseline));
      assertDenied(result, negative.reason, negative.caseId);
      continue;
    }

    const result = validateP21Replay(inputFor(projection, expected, emitted, nowMs, replayState, projectionBaseline));
    assertDenied(result, negative.reason, negative.caseId);
  }
});

test("missing candidate blind spots cannot be repaired by an authority-bearing field", async () => {
  const projection = await readFixture(projectionPath);
  const expected = await readFixture(expectedPath);
  const emitted = structuredClone(expected);
  emitted.candidates[0].blindSpots = [];
  emitted.candidates[0].authorityClass = "FULL";
  const result = validateP21Replay(inputFor(projection, expected, emitted, 1787898600000, new Map()));

  assert.equal(result.outcome, "DENIED");
  assert.ok(result.reasonCodes.includes("BLIND_SPOTS_MISMATCH:p21-gap-290-0001"));
  assert.ok(result.reasonCodes.some((reason) => reason.startsWith("AUTHORITY_BEARING_FIELD:")));
});
