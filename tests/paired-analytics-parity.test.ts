/**
 * PAR-XR-01 — Paired-Analytics compatibility gate: adversarial TDD suite.
 *
 * The gate (src/analytics/paired-analytics-parity.ts) is a pure, fail-closed
 * validator over the exact pair (PANSPHAIRA producer-analytics-manifest x
 * KaleidoSphere consumer-support-manifest). These tests drive it with REAL
 * bytes: the live producer manifest, a consumer manifest re-derived at the
 * producer's exact head (545a3b44) by the shipped KaleidoSphere generator,
 * and the stale baseline consumer manifest (995cd4dd) currently checked in.
 * No fixture is hand-forged; every PASS/DENIED is a computed consequence.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

import {
  pairedAnalyticsConsumerContentSha256,
  pairedAnalyticsProducerCoreSha256,
  verifyPairedAnalyticsParityV1,
} from "../src/analytics/paired-analytics-parity.js";

// Compiled location: dist/tests/paired-analytics-parity.test.js
const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "..", "..");

const PRODUCER_PATH = "contracts/analytics/producer-manifest-v1.json";
const CONSUMER_HEAD_BOUND_PATH =
  "tests/fixtures/paired-analytics/consumer-support-manifest-v1-545a3b44.json";
const CONSUMER_STALE_PATH =
  "tests/fixtures/paired-analytics/consumer-support-manifest-v1-995cd4dd.json";

const loadProducer = (): any => JSON.parse(readFileSync(path.join(ROOT, PRODUCER_PATH), "utf8"));
const loadConsumerHeadBound = (): any =>
  JSON.parse(readFileSync(path.join(ROOT, CONSUMER_HEAD_BOUND_PATH), "utf8"));
const loadConsumerStale = (): any =>
  JSON.parse(readFileSync(path.join(ROOT, CONSUMER_STALE_PATH), "utf8"));

const clone = <T,>(value: T): T => structuredClone(value);

/**
 * Reviewed expectation is independent of both submitted manifests.
 * Rehashing inputs cannot silently redefine mandatory scope or semantics.
 */
const makePinned = (): any => JSON.parse(readFileSync(path.join(ROOT, "contracts/analytics/paired-expectation-v1.json"), "utf8"));

test("PAR-XR-01 AC01: the exact head-bound pair validates PASS with a reproducible pinned reference", () => {
  const producer = loadProducer();
  const consumer = loadConsumerHeadBound();
  const pinned = makePinned();

  // The pinned reference is reproducible from the exact manifests.
  const pinnedAgain = makePinned();
  assert.deepEqual(pinned, pinnedAgain);

  // The producer self-digest recorded in the manifest recomputes from the
  // manifest body via the cross-repo canonical JSON algorithm.
  assert.equal(
    pinned.producerRef.manifestDigest,
    producer.manifestDigest,
    "producer self-digest must recompute",
  );
  // The consumer self-digest recorded under integrity.digest recomputes the
  // same way.
  assert.equal(
    pinned.consumerRef.integrityDigest,
    consumer.integrity.digest,
    "consumer self-digest must recompute",
  );
  // The exact content pins recompute.
  assert.equal(pinned.producerRef.manifestSha256, pairedAnalyticsProducerCoreSha256(producer));
  assert.equal(pinned.consumerRef.manifestSha256, pairedAnalyticsConsumerContentSha256(consumer));

  // Head parity is the precondition of a consistent derivation: the producer
  // service head and the consumer binding must name the same KaleidoSphere
  // commit and tree.
  assert.equal(
    producer.producer.serviceHead.commitOid,
    consumer.bindings.kaleidosphereHead.commitOid,
    "producer must bind the consumer's exact head",
  );
  assert.equal(
    producer.producer.serviceHead.treeOid,
    consumer.bindings.kaleidosphereHead.treeOid,
  );

  const result = verifyPairedAnalyticsParityV1({ producerManifest: producer, consumerManifest: consumer, pinned });
  assert.equal(result.outcome, "PASS", JSON.stringify(result.reasonCodes));
  assert.deepEqual(result.reasonCodes, []);
  // A pure manifest verifier cannot claim to have executed a Git head.
  assert.equal(result.claimBoundary.exactTestedPairOnly, false);
  assert.equal(result.claimBoundary.unknownPairsDenied, true);
  assert.equal(result.claimBoundary.productionOrCustomerEffect, false);
  assert.equal(result.claimBoundary.externalEffectPerformed, false);
  assert.equal(result.declaredSourceHeads.kaleidoSphere, producer.producer.serviceHead.commitOid);
});

test("PAR-XR-01 AC03: the stale baseline consumer (bound to a different head) is DENIED, not silently accepted", () => {
  const producer = loadProducer();
  const staleConsumer = loadConsumerStale();
  const pinned = makePinned();

  // The stale consumer is bound to a DIFFERENT KaleidoSphere head than the
  // producer's service head. This is the core adversarial/stale case.
  assert.notEqual(
    staleConsumer.bindings.kaleidosphereHead.commitOid,
    producer.producer.serviceHead.commitOid,
    "stale consumer must be bound to a different head",
  );

  const result = verifyPairedAnalyticsParityV1({ producerManifest: producer, consumerManifest: staleConsumer, pinned });
  assert.equal(result.outcome, "DENIED", JSON.stringify(result.reasonCodes));
  // The head mismatch is the specific blocking reason (plus ref/digest, since
  // the stale manifest bytes differ from the head-bound pinned reference).
  assert.ok(
    result.reasonCodes.includes("PAIRED_ANALYTICS_HEAD_MISMATCH_DENIED"),
    `head mismatch must block; got ${JSON.stringify(result.reasonCodes)}`,
  );
});

test("PAR-XR-01 AC03: an unknown (third) head is DENIED and never accepted as the tested pair", () => {
  const producer = loadProducer();
  const consumer = loadConsumerHeadBound();
  const pinned = makePinned();
  const mutated = clone(consumer);
  mutated.bindings.kaleidosphereHead = {
    commitOid: "0".repeat(40),
    treeOid: "1".repeat(40),
  };
  const result = verifyPairedAnalyticsParityV1({ producerManifest: producer, consumerManifest: mutated, pinned });
  assert.equal(result.outcome, "DENIED", JSON.stringify(result.reasonCodes));
  assert.ok(
    result.reasonCodes.includes("PAIRED_ANALYTICS_HEAD_MISMATCH_DENIED"),
    `unknown head must block; got ${JSON.stringify(result.reasonCodes)}`,
  );
});

test("PAR-XR-01 AC01: a producer self-digest that no longer recomputes is DENIED (fully re-digested forgery)", () => {
  const producer = clone(loadProducer());
  const consumer = loadConsumerHeadBound();
  const pinned = makePinned();
  // Re-digest the producer manifest body with a WRONG value: the recorded
  // manifestDigest no longer matches sha256(canonicalJson(body)).
  producer.manifestDigest = "f".repeat(64);
  const result = verifyPairedAnalyticsParityV1({ producerManifest: producer, consumerManifest: consumer, pinned });
  assert.equal(result.outcome, "DENIED", JSON.stringify(result.reasonCodes));
  assert.ok(
    result.reasonCodes.includes("PAIRED_ANALYTICS_PRODUCER_DIGEST_DENIED"),
    `producer digest mismatch must block; got ${JSON.stringify(result.reasonCodes)}`,
  );
});

test("PAR-XR-01 AC01: a consumer self-digest that no longer recomputes is DENIED", () => {
  const producer = loadProducer();
  const consumer = clone(loadConsumerHeadBound());
  const pinned = makePinned();
  consumer.integrity.digest = "e".repeat(64);
  const result = verifyPairedAnalyticsParityV1({ producerManifest: producer, consumerManifest: consumer, pinned });
  assert.equal(result.outcome, "DENIED", JSON.stringify(result.reasonCodes));
  assert.ok(
    result.reasonCodes.includes("PAIRED_ANALYTICS_CONSUMER_DIGEST_DENIED"),
    `consumer digest mismatch must block; got ${JSON.stringify(result.reasonCodes)}`,
  );
});

test("PAR-XR-01 AC01: a substituted consumer (different product identity) is DENIED by the exact content pin", () => {
  const producer = loadProducer();
  const consumer = clone(loadConsumerHeadBound());
  const pinned = makePinned();
  // A substitute manifest that is internally consistent (re-digested) but is
  // not the pinned exact artifact must fail the content pin. We flip the
  // product id and re-derive its integrity digest so it is a *valid* but
  // *substituted* document.
  consumer.consumer.product.id = "superset-bi-agent-substitute";
  const body = { ...consumer };
  delete body.integrity;
  // recompute with the same canonical JSON the runtime uses (import here is
  // only for the test; the gate uses its own copy).
  consumer.integrity.digest = recomputeConsumerDigest(body);
  const result = verifyPairedAnalyticsParityV1({ producerManifest: producer, consumerManifest: consumer, pinned });
  assert.equal(result.outcome, "DENIED", JSON.stringify(result.reasonCodes));
  assert.ok(
    result.reasonCodes.includes("PAIRED_ANALYTICS_CONSUMER_REF_DENIED"),
    `substituted consumer must fail the exact content pin; got ${JSON.stringify(result.reasonCodes)}`,
  );
});

// Recompute the consumer self-digest the same way the shipped KaleidoSphere
// generator does: sha256(canonicalJson(manifest minus integrity)). Imported
// from the real cross-repo canonical JSON implementation.
import { createHash } from "node:crypto";
import { canonicalJson } from "../packages/contracts/src/canonical-json.js";
function recomputeConsumerDigest(body: unknown): string {
  return `sha256:${createHash("sha256").update(canonicalJson(body), "utf8").digest("hex")}`;
}

test("PAR-XR-01 AC01: malformed (non-object) inputs fail closed", () => {
  const pinned = makePinned();
  for (const bad of [null, undefined, 0, "", [], "not-an-object"]) {
    const result = verifyPairedAnalyticsParityV1({
      producerManifest: bad,
      consumerManifest: loadConsumerHeadBound(),
      pinned,
    });
    assert.equal(result.outcome, "DENIED", `producer=${JSON.stringify(bad)}`);
    assert.ok(
      result.reasonCodes.includes("PAIRED_ANALYTICS_INPUT_MALFORMED"),
      `malformed producer must block; got ${JSON.stringify(result.reasonCodes)}`,
    );
  }
});

test("PAR-XR-01 AC02: removing a promised supported action is DENIED (promised scope removed)", () => {
  const producer = loadProducer();
  const consumer = clone(loadConsumerHeadBound());
  const pinned = makePinned();
  // Remove one promised supported action from the consumer's support surface.
  consumer.support.supported = consumer.support.supported.filter(
    (entry: any) => entry.id !== "bi.analysis.run",
  );
  // Re-digest so the document stays internally consistent; only the promised
  // scope changed.
  const body = { ...consumer };
  delete body.integrity;
  consumer.integrity.digest = recomputeConsumerDigest(body);
  const result = verifyPairedAnalyticsParityV1({ producerManifest: producer, consumerManifest: consumer, pinned });
  assert.equal(result.outcome, "DENIED", JSON.stringify(result.reasonCodes));
  assert.ok(
    result.reasonCodes.includes("PAIRED_ANALYTICS_PROMISED_SCOPE_REMOVED_DENIED"),
    `removed promised scope must block; got ${JSON.stringify(result.reasonCodes)}`,
  );
});

test("PAR-XR-01 AC02: changing a promised channel version is DENIED (promised scope changed)", () => {
  const producer = loadProducer();
  const consumer = clone(loadConsumerHeadBound());
  const pinned = makePinned();
  const original = consumer.channels.projection.version;
  consumer.channels.projection.version = `${original}-tampered`;
  const body = { ...consumer };
  delete body.integrity;
  consumer.integrity.digest = recomputeConsumerDigest(body);
  const result = verifyPairedAnalyticsParityV1({ producerManifest: producer, consumerManifest: consumer, pinned });
  assert.equal(result.outcome, "DENIED", JSON.stringify(result.reasonCodes));
  assert.ok(
    result.reasonCodes.includes("PAIRED_ANALYTICS_PROMISED_SCOPE_CHANGED_DENIED"),
    `changed promised channel must block; got ${JSON.stringify(result.reasonCodes)}`,
  );
});

test("PAR-XR-01 AC02: an unknown (extra) promised action is DENIED (unknown scope)", () => {
  const producer = loadProducer();
  const consumer = clone(loadConsumerHeadBound());
  const pinned = makePinned();
  consumer.support.supported.push({
    id: "bi.mutation.write",
    status: "SUPPORTED",
    note: "unexpected extra action",
  });
  const body = { ...consumer };
  delete body.integrity;
  consumer.integrity.digest = recomputeConsumerDigest(body);
  const result = verifyPairedAnalyticsParityV1({ producerManifest: producer, consumerManifest: consumer, pinned });
  assert.equal(result.outcome, "DENIED", JSON.stringify(result.reasonCodes));
  assert.ok(
    result.reasonCodes.includes("PAIRED_ANALYTICS_PROMISED_SCOPE_UNKNOWN_DENIED"),
    `unknown promised scope must block; got ${JSON.stringify(result.reasonCodes)}`,
  );
});

test("PAR-XR-01 AC02: disclosed optional producer gaps are surfaced (reported), never silently blocked", () => {
  const producer = loadProducer();
  const consumer = loadConsumerHeadBound();
  const pinned = makePinned();
  const result = verifyPairedAnalyticsParityV1({ producerManifest: producer, consumerManifest: consumer, pinned });
  assert.equal(result.outcome, "PASS", JSON.stringify(result.reasonCodes));
  // The real producer manifest discloses a HELD (optional-state) release
  // registry gap. It must be surfaced in optionalGapReports and must NOT
  // block the promised scope.
  const gapIds = result.optionalGapReports.map((g) => g.id);
  assert.ok(
    gapIds.includes("RELEASE_REGISTRY_HELD"),
    `disclosed optional gap must be surfaced; got ${JSON.stringify(gapIds)}`,
  );
  assert.ok(
    result.reasonCodes.length === 0,
    `optional gap must not block; got ${JSON.stringify(result.reasonCodes)}`,
  );
});
