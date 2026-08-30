import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

import {
  createReplayGuard,
  guardProjectionEnvelope,
  assertProjectionEnvelope,
  sha256,
  verifyProjectionEnvelope,
} from "../../src/cks-10/projection-envelope-guards.mjs";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const casesPath = resolve(repoRoot, "tests/fixtures/cks-10/envelope-guard-cases-v1.json");

async function readCases() {
  return JSON.parse(await readFile(casesPath, "utf8"));
}

async function readEnvelope(cases) {
  return JSON.parse(await readFile(resolve(repoRoot, cases.envelopePath), "utf8"));
}

function setPath(value, path, replacement) {
  const parts = path.split(".");
  const leaf = parts.pop();
  let target = value;
  for (const part of parts) target = target[part];
  target[leaf] = replacement;
}

function redigest(envelope) {
  const withoutDigest = structuredClone(envelope);
  delete withoutDigest.exchange.projectionDigest;
  envelope.exchange.projectionDigest = sha256(withoutDigest);
  return envelope;
}

function optionsFor(envelope, cases, overrides = {}) {
  return {
    expectedEnvelope: envelope,
    authorityProjectionDigest: envelope.exchange.projectionDigest,
    nowMs: cases.trustedNowMs,
    replayState: new Map(),
    ...overrides,
  };
}

function assertReason(result, reason, caseId) {
  assert.equal(result.outcome, "DENIED", `${caseId}: ${JSON.stringify(result)}`);
  assert.ok(result.reasonCodes.includes(reason), `${caseId}: ${result.reasonCodes.join(",")}`);
  assert.equal(typeof result.correlationDigest, "string", `${caseId}: denial must carry only a correlation digest`);
}

test("projection envelope guards verify a minimized envelope deterministically", async () => {
  const cases = await readCases();
  const envelope = await readEnvelope(cases);
  const first = verifyProjectionEnvelope(envelope, optionsFor(envelope, cases));
  const second = verifyProjectionEnvelope(envelope, optionsFor(envelope, cases));

  assert.deepEqual(first, second);
  assert.equal(first.outcome, "VERIFIED");
  assert.deepEqual(first.reasonCodes, ["PROJECTION_ENVELOPE_VERIFIED"]);
  assert.equal(first.projectionDigest, envelope.exchange.projectionDigest);
  assert.equal(first.replayDigest, sha256(envelope));
});

test("replay guard returns duplicate noop without a second state change", async () => {
  const cases = await readCases();
  const envelope = await readEnvelope(cases);
  const replay = createReplayGuard();
  const options = {
    expectedEnvelope: envelope,
    authorityProjectionDigest: envelope.exchange.projectionDigest,
    nowMs: cases.trustedNowMs,
  };

  const first = replay.verify(envelope, options);
  const duplicate = replay.verify(structuredClone(envelope), options);
  assert.equal(first.outcome, "VERIFIED");
  assert.equal(duplicate.outcome, "DUPLICATE_NOOP");
  assert.deepEqual(duplicate.reasonCodes, ["REPLAY_EXACT_DUPLICATE"]);
  assert.equal(replay.size, 1);
});

test("canonical digest and replay identity are independent of object-key order", async () => {
  const cases = await readCases();
  const envelope = await readEnvelope(cases);
  const reorder = (value) => {
    if (Array.isArray(value)) return value.map(reorder);
    if (value === null || typeof value !== "object") return value;
    return Object.fromEntries(Object.entries(value).reverse().map(([key, child]) => [key, reorder(child)]));
  };
  const reordered = reorder(envelope);
  const replayState = new Map();
  const first = verifyProjectionEnvelope(envelope, optionsFor(envelope, cases, { replayState }));
  const second = verifyProjectionEnvelope(reordered, optionsFor(envelope, cases, { replayState }));

  assert.equal(first.outcome, "VERIFIED");
  assert.equal(second.outcome, "DUPLICATE_NOOP");
  assert.equal(sha256(reordered), sha256(envelope));
});

test("all declared fail-closed tenant, retention, freshness, provenance, digest, and replay cases deny", async () => {
  const cases = await readCases();
  const baseline = await readEnvelope(cases);
  assert.equal(cases.negativeCases.length, 12);

  for (const negative of cases.negativeCases) {
    let candidate = structuredClone(baseline);
    let options = optionsFor(baseline, cases);
    if (negative.options?.omitNowMs) delete options.nowMs;
    if (negative.options?.omitExpectedEnvelope) delete options.expectedEnvelope;
    if (negative.options?.omitReplayState) delete options.replayState;
    if (negative.options?.nowMs !== undefined) options.nowMs = negative.options.nowMs;

    if (negative.path) {
      setPath(candidate, negative.path, negative.value);
      if (negative.redigest) {
        redigest(candidate);
        options.expectedEnvelope = candidate;
        const replayState = new Map();
        verifyProjectionEnvelope(baseline, { ...options, expectedEnvelope: baseline, replayState });
        options.replayState = replayState;
      }
    }
    const result = verifyProjectionEnvelope(candidate, options);
    assertReason(result, negative.reason, negative.caseId);
  }
});

test("paired trusted-envelope substitution plus re-digestion cannot self-attest", async () => {
  const cases = await readCases();
  const baseline = await readEnvelope(cases);
  const substituted = structuredClone(baseline);
  substituted.tenantScope.opaqueTenantScopeId = "tscope-290-paired-substitution";
  redigest(substituted);

  const result = verifyProjectionEnvelope(substituted, {
    expectedEnvelope: structuredClone(substituted),
    authorityProjectionDigest: baseline.exchange.projectionDigest,
    nowMs: cases.trustedNowMs,
    replayState: new Map(),
  });

  assertReason(result, "AUTHORITY_PROJECTION_DIGEST_MISMATCH", "paired-substitution-redigestion");
});

test("denied validation does not consume replay state and assertion adapter is fail closed", async () => {
  const cases = await readCases();
  const envelope = await readEnvelope(cases);
  const replayState = new Map();
  const denied = guardProjectionEnvelope(envelope, {
    expectedEnvelope: envelope,
    authorityProjectionDigest: envelope.exchange.projectionDigest,
    nowMs: cases.trustedNowMs,
    replayState,
  });
  assert.equal(denied.outcome, "VERIFIED");
  const malformed = structuredClone(envelope);
  malformed.exchange.projectionDigest = "f".repeat(64);
  const rejected = verifyProjectionEnvelope(malformed, {
    expectedEnvelope: envelope,
    authorityProjectionDigest: envelope.exchange.projectionDigest,
    nowMs: cases.trustedNowMs,
    replayState,
  });
  assert.equal(rejected.outcome, "DENIED");
  assert.equal(replayState.size, 1);
  assert.throws(() => assertProjectionEnvelope(malformed, {
    expectedEnvelope: envelope,
    authorityProjectionDigest: envelope.exchange.projectionDigest,
    nowMs: cases.trustedNowMs,
    replayState,
  }));
});
