import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import test from "node:test";

import { canonicalJson } from "../packages/contracts/src/canonical-json.js";
import {
  SOURCE_CONTRACT_SHA256,
  KALEIDOSPHERE_ANALYTICS_PROJECTION_ID,
  buildKaleidosphereAnalyticsProjectionV1,
  kaleidosphereAnalyticsProjectionDigestV1,
  verifyKaleidosphereAnalyticsProjectionV1,
  type KaleidosphereAnalyticsProjectionReasonCodeV1,
  type KaleidosphereAnalyticsProjectionV1,
  type KaleidosphereAnalyticsProjectionVerificationV1,
} from "../packages/contracts/src/kaleidosphere-analytics-projection.js";

/**
 * XRA-PS-01 — version-one purpose-bound PANSPHAIRA analytics projection profile.
 *
 * Focused, TDD proof of the facade's acceptance criteria:
 *   - AC01: one versioned facade maps the selected existing CKS proof inputs to
 *     one purpose-bound nodes/edges projection WITHOUT rewriting any historical
 *     CKS-10/CKS-12 fixture (exact-byte legacy regression), and the new profile
 *     verifies its single purpose-bound shape (new profile schema test).
 *   - AC02: every node/edge carries source evidence, coverage, unknown and
 *     counterevidence; authority/promotion/effect remain NONE; an edge is
 *     established only by its frozen source receipts (endpoint presence alone
 *     cannot self-attest).
 *   - AC03: malformed, duplicate, stale, overbroad and unsupported inputs
 *     return a structured denial (no exception, no partial mutation, no
 *     ordinary success).
 *
 * This file adds no repository-global manifest, inventory or verification-DAG
 * change; the serial integrator owns final Canon/integrity regeneration.
 */

const FIXTURE_PATH = "tests/fixtures/cks-analytics/projection-v1.json";
const CKS12_HISTORICAL_PATH = "tests/fixtures/cks-12/edge-authority-v2.json";

// Exact historical CKS-12 exact-byte pins (tests/fixtures/cks-12/edge-authority-v2.json).
const PIN_CANONICAL_KNOWLEDGE_SHA256 = "d756437db8c991ee78ea7a9fcc7a9d4749daf8eebda51d5ba31fcc53e1b1242a";
const PIN_VALIDATION_RECEIPT_SHA256 = "6d61cbfd4d81cb9c0eabcc0ae17c13e4320c4491a49935122b81331e2b50ecf4";
const PIN_LINEAGE_RECEIPT_SHA256 = "ec0a30c55bafa447fe160ba4f18f2cb85680c4ebef7d0c7af3006989b324af74";

// Exact frozen projection bytes (tests/fixtures/cks-analytics/projection-v1.json).
const PIN_SOURCE_CONTRACT_SHA256 = "d2995f7e8ed46031902d09a5138202a489834d4a018646c50920a482bbf7da44";
const PIN_PROJECTION_DIGEST = "cc5f6cc9591ccf4b6b3c4b9f954aa9da09695b784d7abaa585c082aea195ef1b";

const SOURCE_CONTRACT = "pansphaira.fnd-ps-02/owner-edge-evidence-inputs/v2";
const V2_ENVELOPE_SCHEMA = "chimpmaera.cks/kaleidosphere-projection/v2";
const V2_UNSUPPORTED_SCHEMA = "chimpmaera.cks/kaleidosphere-analytics-projection/v2";

type AnyRecord = Record<string, unknown>;
type Denied = Extract<KaleidosphereAnalyticsProjectionVerificationV1, { outcome: "DENIED" }>;

const sha256 = (value: unknown): string => createHash("sha256").update(canonicalJson(value), "utf8").digest("hex");

function projectionFixture(): KaleidosphereAnalyticsProjectionV1 {
  return JSON.parse(readFileSync(FIXTURE_PATH, "utf8")) as KaleidosphereAnalyticsProjectionV1;
}

function cloneProjection(): AnyRecord {
  return structuredClone(buildKaleidosphereAnalyticsProjectionV1()) as unknown as AnyRecord;
}

function node(p: AnyRecord, index: number): AnyRecord {
  return (p.nodes as AnyRecord[])[index]!;
}

function edge(p: AnyRecord, index: number): AnyRecord {
  return (p.edges as AnyRecord[])[index]!;
}

function evidence(p: AnyRecord, edgeIndex: number, entryIndex: number): AnyRecord {
  return (edge(p, edgeIndex).evidence as AnyRecord[])[entryIndex]!;
}

/** Recompute the edge evidence digest and the top-level projection digest. */
function redigestAll(p: AnyRecord): void {
  for (const rawEdge of p.edges as { evidence: unknown; evidenceSha256: string }[]) {
    rawEdge.evidenceSha256 = sha256(rawEdge.evidence);
  }
  p.projectionDigest = kaleidosphereAnalyticsProjectionDigestV1(p);
}

function reorderObjects(value: unknown, seed: number): unknown {
  if (Array.isArray(value)) return value.map((item) => reorderObjects(item, seed + 1));
  if (value === null || typeof value !== "object") return value;
  const entries = Object.entries(value as AnyRecord);
  const offset = entries.length === 0 ? 0 : seed % entries.length;
  const rotated = [...entries.slice(offset), ...entries.slice(0, offset)];
  if (seed % 2 === 1) rotated.reverse();
  return Object.fromEntries(rotated.map(([key, item], index) => [key, reorderObjects(item, seed + index + 1)]));
}

// ---------------------------------------------------------------------------
// AC01 — exact-byte legacy regression: the facade's source binding and
// per-receipt digests are byte-identical to the frozen CKS-12 oracle, and the
// historical CKS-12 fixture bytes are unchanged (no historical rewrite).
// ---------------------------------------------------------------------------
test("XRA-PS-01 AC01 pins the exact historical CKS-12 receipt digests and leaves the CKS-12 fixture unchanged", () => {
  // The selected existing CKS proof inputs digest to the frozen CKS-12 owner-inputs sha256.
  assert.equal(SOURCE_CONTRACT_SHA256, PIN_SOURCE_CONTRACT_SHA256);

  const built = buildKaleidosphereAnalyticsProjectionV1();
  assert.equal(built.source.contract, SOURCE_CONTRACT);
  assert.equal(built.source.contractVersion, "v2");
  assert.equal(built.source.contractSha256, PIN_SOURCE_CONTRACT_SHA256);
  // The per-receipt evidence digests are byte-identical to the frozen CKS-12 pins.
  assert.equal(built.edges[0]!.evidence[0]!.evidenceSha256, PIN_VALIDATION_RECEIPT_SHA256);
  assert.equal(built.edges[0]!.evidence[1]!.evidenceSha256, PIN_LINEAGE_RECEIPT_SHA256);
  assert.equal(built.projectionDigest, PIN_PROJECTION_DIGEST);

  // The historical CKS-12 fixture is a read-only legacy input: its exact bytes
  // are intact (the facade does not rewrite it).
  const cks12 = readFileSync(CKS12_HISTORICAL_PATH, "utf8");
  assert.ok(cks12.includes(PIN_CANONICAL_KNOWLEDGE_SHA256), "CKS-12 canonical-knowledge sha pin intact");
  assert.ok(cks12.includes(PIN_VALIDATION_RECEIPT_SHA256), "CKS-12 validation receipt pin intact");
  assert.ok(cks12.includes(PIN_LINEAGE_RECEIPT_SHA256), "CKS-12 lineage receipt pin intact");
});

// ---------------------------------------------------------------------------
// AC01 — new profile schema test: the committed fixture IS the frozen
// purpose-bound projection (exact bytes), and the profile verifies it.
// ---------------------------------------------------------------------------
test("XRA-PS-01 AC01 verifies the committed exact-byte fixture as the single v1 purpose-bound projection", () => {
  const fixture = projectionFixture();
  const built = buildKaleidosphereAnalyticsProjectionV1();

  // Exact-byte pin: the committed fixture is byte-for-byte the frozen projection.
  assert.deepEqual(fixture, built);
  assert.equal(fixture.projectionDigest, PIN_PROJECTION_DIGEST);
  assert.equal(fixture.source.contractSha256, PIN_SOURCE_CONTRACT_SHA256);

  const before = structuredClone(fixture);
  const result = verifyKaleidosphereAnalyticsProjectionV1(fixture);
  assert.deepEqual(result, {
    outcome: "VERIFIED",
    reasonCodes: ["KALEIDOSPHERE_ANALYTICS_PROJECTION_VERIFIED"],
    projectionDigest: PIN_PROJECTION_DIGEST,
    nodeCount: 2,
    edgeCount: 1,
    authority: "NONE",
  });
  assert.deepEqual(fixture, before, "verification must not mutate the fixture");

  // Determinism and JSON round-trip.
  const roundTrip = JSON.parse(JSON.stringify(fixture));
  assert.deepEqual(verifyKaleidosphereAnalyticsProjectionV1(roundTrip), result, "JSON round-trip verifies");
});

// ---------------------------------------------------------------------------
// AC01 — canonical digest stability under 100 object-key reorderings.
// ---------------------------------------------------------------------------
test("XRA-PS-01 AC01 canonical projection digest is stable across 100 object-key reorderings", () => {
  const expected = kaleidosphereAnalyticsProjectionDigestV1(projectionFixture());
  for (let index = 0; index < 100; index += 1) {
    assert.equal(
      kaleidosphereAnalyticsProjectionDigestV1(reorderObjects(projectionFixture(), index)),
      expected,
      `reordering ${index}`,
    );
  }
});

// ---------------------------------------------------------------------------
// AC02 — every node/edge carries source evidence, coverage, unknown and
// counterevidence; authority/promotion/effect remain NONE; the edge is
// established by its frozen source receipts, not endpoint presence alone.
// ---------------------------------------------------------------------------
test("XRA-PS-01 AC02 carries per-node/edge source evidence with authority NONE and an evidence-bound edge", () => {
  const built = buildKaleidosphereAnalyticsProjectionV1();

  assert.equal(built.nodes.length, 2);
  for (const subjectNode of built.nodes) {
    assert.equal(subjectNode.coverage, "FULL");
    assert.equal(subjectNode.unknown, false);
    assert.ok(Array.isArray(subjectNode.counterevidence) && subjectNode.counterevidence.length === 0);
    assert.equal(subjectNode.authority, "NONE");
    assert.equal(subjectNode.sourceEvidence.contractSha256, PIN_SOURCE_CONTRACT_SHA256);
    assert.equal(subjectNode.sourceEvidence.contract, SOURCE_CONTRACT);
  }

  assert.equal(built.edges.length, 1);
  const edge = built.edges[0]!;
  assert.equal(edge.from, "knowledge-001");
  assert.equal(edge.to, "decision-001");
  assert.equal(edge.relation, "KNOWLEDGE_USED_BY_DECISION");
  assert.equal(edge.coverage, "FULL");
  assert.equal(edge.unknown, false);
  assert.ok(Array.isArray(edge.counterevidence) && edge.counterevidence.length === 0);
  assert.equal(edge.authority, "NONE");
  assert.equal(edge.promotion, "NOT_AUTHORIZED");
  assert.equal(edge.effect, "NONE");
  assert.equal(edge.relationTruthClaimed, false);
  assert.equal(edge.relationTruth, "NOT_GRANTED");
  // The edge is established by BOTH frozen source receipts, and its digest binds that evidence.
  assert.equal(edge.evidence.length, 2);
  assert.equal(edge.evidenceSha256, sha256(edge.evidence));
  assert.equal(edge.sourceEvidence.contractSha256, PIN_SOURCE_CONTRACT_SHA256);

  // Top-level invariants.
  assert.equal(built.authority, "NONE");
  assert.equal(built.promotion, "NOT_AUTHORIZED");
  assert.equal(built.effect, "NONE");
  assert.equal(built.relationTruth, "NOT_GRANTED");
  assert.equal(built.purpose, "PANSPHAIRA_EDGE_EVIDENCE_ANALYTICS");
});

// ---------------------------------------------------------------------------
// AC02 — paired substitution + re-digestion cannot self-attest: substituting a
// frozen receipt's identity and recomputing every digest is still denied,
// because an edge is established only by the frozen source receipts.
// ---------------------------------------------------------------------------
test("XRA-PS-01 AC02 paired-substitution redigestion of a frozen receipt cannot self-attest the edge", () => {
  const forged = cloneProjection();
  evidence(forged, 0, 0).evidenceRole = "FORGED_ROLE";
  redigestAll(forged);
  const result = verifyKaleidosphereAnalyticsProjectionV1(forged) as Denied;
  assert.equal(result.outcome, "DENIED", JSON.stringify(result));
  assert.ok(
    result.reasonCodes.includes("KALEIDOSPHERE_ANALYTICS_PROJECTION_STALE_DENIED"),
    JSON.stringify(result.reasonCodes),
  );
  assert.ok(
    !result.reasonCodes.includes("KALEIDOSPHERE_ANALYTICS_PROJECTION_VERIFIED"),
    "a paired substitution is never an ordinary success",
  );
});

// ---------------------------------------------------------------------------
// AC03 — Node-24 adversarial matrix: malformed, duplicate, stale, overbroad and
// unsupported inputs return a structured denial (no exception, no partial
// mutation, no ordinary success).
// ---------------------------------------------------------------------------
interface MatrixCase {
  readonly name: string;
  readonly expected: KaleidosphereAnalyticsProjectionReasonCodeV1;
  readonly apply: (p: AnyRecord) => void;
  readonly redigest?: boolean;
}

const MATRIX: readonly MatrixCase[] = [
  { name: "wrong schemaVersion", expected: "KALEIDOSPHERE_ANALYTICS_PROJECTION_UNSUPPORTED_DENIED", apply: (p) => { p.schemaVersion = V2_UNSUPPORTED_SCHEMA; } },
  { name: "unsupported purpose", expected: "KALEIDOSPHERE_ANALYTICS_PROJECTION_UNSUPPORTED_DENIED", apply: (p) => { p.purpose = "GENERIC_ANALYTICS"; } },
  { name: "missing top-level key", expected: "KALEIDOSPHERE_ANALYTICS_PROJECTION_SCHEMA_DENIED", apply: (p) => { delete p.nonclaims; } },
  { name: "extra top-level key", expected: "KALEIDOSPHERE_ANALYTICS_PROJECTION_SCHEMA_DENIED", apply: (p) => { p.injected = true; } },
  { name: "wrong projectionId", expected: "KALEIDOSPHERE_ANALYTICS_PROJECTION_SCHEMA_DENIED", apply: (p) => { p.projectionId = "pansphaira:other-scope"; } },
  { name: "wrong contractVersion", expected: "KALEIDOSPHERE_ANALYTICS_PROJECTION_SCHEMA_DENIED", apply: (p) => { p.contractVersion = "2.0.0"; } },
  { name: "top-level authority widened", expected: "KALEIDOSPHERE_ANALYTICS_PROJECTION_AUTHORITY_DENIED", apply: (p) => { p.authority = "HIGH"; } },
  { name: "top-level effect widened", expected: "KALEIDOSPHERE_ANALYTICS_PROJECTION_AUTHORITY_DENIED", apply: (p) => { p.effect = "WRITE"; } },
  { name: "top-level relationTruth granted", expected: "KALEIDOSPHERE_ANALYTICS_PROJECTION_AUTHORITY_DENIED", apply: (p) => { p.relationTruth = "GRANTED"; } },
  { name: "node authority widened", expected: "KALEIDOSPHERE_ANALYTICS_PROJECTION_AUTHORITY_DENIED", apply: (p) => { node(p, 0).authority = "HIGH"; } },
  { name: "node unknown set true", expected: "KALEIDOSPHERE_ANALYTICS_PROJECTION_SCHEMA_DENIED", apply: (p) => { node(p, 0).unknown = true; } },
  { name: "node missing sourceEvidence", expected: "KALEIDOSPHERE_ANALYTICS_PROJECTION_SCHEMA_DENIED", apply: (p) => { delete node(p, 0).sourceEvidence; } },
  { name: "duplicate node identifier", expected: "KALEIDOSPHERE_ANALYTICS_PROJECTION_DUPLICATE_DENIED", apply: (p) => { node(p, 1).id = node(p, 0).id; node(p, 1).kind = "KNOWLEDGE"; } },
  { name: "missing frozen subject node", expected: "KALEIDOSPHERE_ANALYTICS_PROJECTION_SCHEMA_DENIED", apply: (p) => { p.nodes = (p.nodes as unknown[]).slice(0, 1); } },
  { name: "overbroad extra node", expected: "KALEIDOSPHERE_ANALYTICS_PROJECTION_OVERBROAD_DENIED", apply: (p) => { const extra = structuredClone(node(p, 0)); extra.id = "foreign-001"; extra.kind = "KNOWLEDGE"; p.nodes = [...(p.nodes as unknown[]), extra]; } },
  { name: "overbroad extra edge", expected: "KALEIDOSPHERE_ANALYTICS_PROJECTION_OVERBROAD_DENIED", apply: (p) => { p.edges = [...(p.edges as unknown[]), structuredClone(edge(p, 0))]; } },
  { name: "edge missing (empty edges)", expected: "KALEIDOSPHERE_ANALYTICS_PROJECTION_SCHEMA_DENIED", apply: (p) => { p.edges = []; } },
  { name: "edge evidence emptied (endpoint presence alone)", expected: "KALEIDOSPHERE_ANALYTICS_PROJECTION_STALE_DENIED", apply: (p) => { edge(p, 0).evidence = []; }, redigest: true },
  { name: "edge relation widened", expected: "KALEIDOSPHERE_ANALYTICS_PROJECTION_SCHEMA_DENIED", apply: (p) => { edge(p, 0).relation = "KNOWLEDGE_CREATED"; } },
  { name: "edge relationTruthClaimed true", expected: "KALEIDOSPHERE_ANALYTICS_PROJECTION_AUTHORITY_DENIED", apply: (p) => { edge(p, 0).relationTruthClaimed = true; } },
  { name: "edge promotion authorized", expected: "KALEIDOSPHERE_ANALYTICS_PROJECTION_AUTHORITY_DENIED", apply: (p) => { edge(p, 0).promotion = "AUTHORIZED"; } },
  { name: "forged receipt role (paired substitution + redigest)", expected: "KALEIDOSPHERE_ANALYTICS_PROJECTION_STALE_DENIED", apply: (p) => { evidence(p, 0, 0).evidenceRole = "FORGED_ROLE"; }, redigest: true },
  { name: "forged receipt identity (paired substitution + redigest)", expected: "KALEIDOSPHERE_ANALYTICS_PROJECTION_STALE_DENIED", apply: (p) => { evidence(p, 0, 1).evidenceId = "CKS-12-FORGED-RECEIPT-001"; }, redigest: true },
  { name: "stale source contractSha256", expected: "KALEIDOSPHERE_ANALYTICS_PROJECTION_STALE_DENIED", apply: (p) => { (p.source as AnyRecord).contractSha256 = "a".repeat(64); } },
  { name: "stale node source evidence", expected: "KALEIDOSPHERE_ANALYTICS_PROJECTION_STALE_DENIED", apply: (p) => { (node(p, 0).sourceEvidence as AnyRecord).contractSha256 = "b".repeat(64); } },
  { name: "swapped node kind (knowledge-001 as DECISION, redigested)", expected: "KALEIDOSPHERE_ANALYTICS_PROJECTION_SCHEMA_DENIED", apply: (p) => { node(p, 0).kind = "DECISION"; }, redigest: true },
  { name: "swapped node kind (decision-001 as KNOWLEDGE, redigested)", expected: "KALEIDOSPHERE_ANALYTICS_PROJECTION_SCHEMA_DENIED", apply: (p) => { node(p, 1).kind = "KNOWLEDGE"; }, redigest: true },
  { name: "both node kinds swapped (redigested)", expected: "KALEIDOSPHERE_ANALYTICS_PROJECTION_SCHEMA_DENIED", apply: (p) => { node(p, 0).kind = "DECISION"; node(p, 1).kind = "KNOWLEDGE"; }, redigest: true },
  { name: "invented node counterevidence (redigested)", expected: "KALEIDOSPHERE_ANALYTICS_PROJECTION_SCHEMA_DENIED", apply: (p) => { node(p, 0).counterevidence = ["invented-counterevidence"]; }, redigest: true },
  { name: "invented edge counterevidence (redigested)", expected: "KALEIDOSPHERE_ANALYTICS_PROJECTION_SCHEMA_DENIED", apply: (p) => { edge(p, 0).counterevidence = ["invented-counterevidence"]; }, redigest: true },
  { name: "rewritten node source reference (redigested)", expected: "KALEIDOSPHERE_ANALYTICS_PROJECTION_STALE_DENIED", apply: (p) => { (node(p, 0).sourceEvidence as AnyRecord).reference = "relation"; }, redigest: true },
  { name: "invented node source reference (redigested)", expected: "KALEIDOSPHERE_ANALYTICS_PROJECTION_STALE_DENIED", apply: (p) => { (node(p, 1).sourceEvidence as AnyRecord).reference = "invented-reference"; }, redigest: true },
  { name: "rewritten edge source reference (redigested)", expected: "KALEIDOSPHERE_ANALYTICS_PROJECTION_STALE_DENIED", apply: (p) => { (edge(p, 0).sourceEvidence as AnyRecord).reference = "canonicalKnowledge"; }, redigest: true },
  { name: "top projectionDigest flip (digest mismatch)", expected: "KALEIDOSPHERE_ANALYTICS_PROJECTION_DIGEST_DENIED", apply: (p) => { const d = p.projectionDigest as string; p.projectionDigest = (d[0] === "0" ? "1" : "0") + d.slice(1); } },
];

test("XRA-PS-01 AC03 returns a structured denial (no exception, no partial mutation, no ordinary success) for every adversarial input", () => {
  assert.equal(MATRIX.length, 34, "adversarial matrix breadth");
  for (const c of MATRIX) {
    const candidate = cloneProjection();
    c.apply(candidate);
    if (c.redigest) redigestAll(candidate);
    const beforeVerify = structuredClone(candidate);
    let result: KaleidosphereAnalyticsProjectionVerificationV1 | undefined;
    assert.doesNotThrow(() => { result = verifyKaleidosphereAnalyticsProjectionV1(candidate); }, `${c.name}: must not throw`);
    assert.ok(result !== undefined, `${c.name}: verification returned a result`);
    assert.deepEqual(candidate, beforeVerify, `${c.name}: verification must not mutate the input`);
    const denied = result as Denied;
    assert.equal(denied.outcome, "DENIED", `${c.name}: expected DENIED, got ${JSON.stringify(denied)}`);
    assert.ok(denied.reasonCodes.includes(c.expected), `${c.name}: expected ${c.expected}, got ${JSON.stringify(denied.reasonCodes)}`);
    assert.ok(!denied.reasonCodes.includes("KALEIDOSPHERE_ANALYTICS_PROJECTION_VERIFIED"), `${c.name}: never an ordinary success`);
  }
});

// ---------------------------------------------------------------------------
// AC03 — digest forgery and schema-version drift are individually denied.
// ---------------------------------------------------------------------------
test("XRA-PS-01 AC03 denies digest forgery and schema-version drift", () => {
  const forged = cloneProjection();
  forged.projectionDigest = "f".repeat(64);
  assert.deepEqual(verifyKaleidosphereAnalyticsProjectionV1(forged), {
    outcome: "DENIED",
    reasonCodes: ["KALEIDOSPHERE_ANALYTICS_PROJECTION_DIGEST_DENIED"],
  });

  const drifted = cloneProjection();
  drifted.schemaVersion = V2_UNSUPPORTED_SCHEMA;
  redigestAll(drifted);
  assert.deepEqual(verifyKaleidosphereAnalyticsProjectionV1(drifted), {
    outcome: "DENIED",
    reasonCodes: ["KALEIDOSPHERE_ANALYTICS_PROJECTION_UNSUPPORTED_DENIED"],
  });
});

// ---------------------------------------------------------------------------
// AC01/AC03 — single-shape profile: the historical CKS-12 v2 envelope shape is
// NOT silently accepted, and malformed / non-plain / non-object inputs are
// fail-closed (structured denial, never an exception, never an ordinary success).
// ---------------------------------------------------------------------------
test("XRA-PS-01 single-shape profile denies the historical v2 shape and is fail-closed on malformed inputs", () => {
  // The historical CKS-12 projection envelope (v2 shape) is a different contract:
  // the v1 purpose-bound profile must NOT silently accept both shapes.
  const v2Envelope = {
    schemaVersion: V2_ENVELOPE_SCHEMA,
    projectionId: KALEIDOSPHERE_ANALYTICS_PROJECTION_ID,
    nodes: [{ id: "knowledge-001", kind: "KNOWLEDGE" }, { id: "decision-001", kind: "DECISION" }],
    edges: [{ bindingVersion: "pansphaira.fnd-ps-02/edge-evidence-authority/v2" }],
  };
  const v2Result = verifyKaleidosphereAnalyticsProjectionV1(v2Envelope) as Denied;
  assert.equal(v2Result.outcome, "DENIED", "the v2 shape must be denied");
  assert.ok(v2Result.reasonCodes.includes("KALEIDOSPHERE_ANALYTICS_PROJECTION_SCHEMA_DENIED"), JSON.stringify(v2Result.reasonCodes));
  assert.ok(v2Result.reasonCodes.includes("KALEIDOSPHERE_ANALYTICS_PROJECTION_UNSUPPORTED_DENIED"), JSON.stringify(v2Result.reasonCodes));

  // Fail-closed against Proxy / circular / non-plain / non-object inputs.
  const throwingProxy = new Proxy({}, {
    get: () => { throw new Error("get trap"); },
    has: () => { throw new Error("has trap"); },
    ownKeys: () => { throw new Error("ownKeys trap"); },
    getOwnPropertyDescriptor: () => { throw new Error("gOPD trap"); },
    getPrototypeOf: () => { throw new Error("getProto trap"); },
  });
  const circular: AnyRecord = { self: null };
  circular.self = circular;
  const classInstance = new (class { id = "x"; } as unknown as new () => unknown)();

  for (const [label, input] of [
    ["throwing proxy", throwingProxy],
    ["circular reference", circular],
    ["non-plain class instance", classInstance],
    ["array", [1, 2]],
    ["null", null],
    ["undefined", undefined],
    ["number", 7],
  ] as [string, unknown][]) {
    let result: KaleidosphereAnalyticsProjectionVerificationV1 | undefined;
    assert.doesNotThrow(() => { result = verifyKaleidosphereAnalyticsProjectionV1(input); }, `${label}: must not throw`);
    assert.ok(result !== undefined, `${label}: produced a result`);
    const denied = result as Denied;
    assert.equal(denied.outcome, "DENIED", `${label}: must deny`);
    assert.ok(denied.reasonCodes.length > 0, `${label}: denial carries reason codes`);
    assert.ok(!denied.reasonCodes.includes("KALEIDOSPHERE_ANALYTICS_PROJECTION_VERIFIED"), `${label}: never an ordinary success`);
  }
});