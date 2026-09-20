#!/usr/bin/env node
/**
 * PAR-XR-01 — Paired-Analytics parity runner (fail-closed, no external call).
 *
 * Re-derives the code-owned pinned expectation from the EXACT manifests on
 * disk, gates the consistent pair (must PASS) and the stale baseline pair
 * (must DENIED), and writes the head-bound evidence artifact. It performs no
 * production, customer, external, publication or closure effect.
 *
 * It imports the cross-repository canonical JSON implementation rather than
 * redefining one, so it contributes no new canonicalJson implementation site
 * to the FND-PS-04 census.
 */
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { canonicalJson } from "../dist/packages/contracts/src/index.js";
import {
  derivePairedAnalyticsPinnedV1,
  verifyPairedAnalyticsParityV1,
} from "../dist/src/analytics/paired-analytics-parity.js";

const root = process.cwd();
const sha256 = (value) => createHash("sha256").update(value, "utf8").digest("hex");

const readJson = (relative) => JSON.parse(readFileSync(resolve(root, relative), "utf8"));
const PRODUCER_PATH = "contracts/analytics/producer-manifest-v1.json";
const CONSUMER_HEAD_BOUND_PATH = "tests/fixtures/paired-analytics/consumer-support-manifest-v1-545a3b44.json";
const CONSUMER_STALE_PATH = "tests/fixtures/paired-analytics/consumer-support-manifest-v1-995cd4dd.json";
const EVIDENCE_PATH = "verification/paired-analytics-compatibility-v1.json";

const producer = readJson(PRODUCER_PATH);
const consumerHeadBound = readJson(CONSUMER_HEAD_BOUND_PATH);
const consumerStale = readJson(CONSUMER_STALE_PATH);

// The accepted reference is re-derived from the exact, consistent pair.
const pinned = derivePairedAnalyticsPinnedV1(producer, consumerHeadBound);

// AC01: the consistent pair must validate PASS.
const passResult = verifyPairedAnalyticsParityV1({
  producerManifest: producer,
  consumerManifest: consumerHeadBound,
  pinned,
});
if (passResult.outcome !== "PASS") {
  throw new Error(
    `PAIRED_ANALYTICS_PARITY_DENIED:consistent pair must PASS; got ${JSON.stringify(passResult.reasonCodes)}`,
  );
}

// AC03 adversarial invariant: the stale baseline pair MUST be DENIED. If it
// ever becomes identical to the head-bound pair, the gate is broken.
const staleResult = verifyPairedAnalyticsParityV1({
  producerManifest: producer,
  consumerManifest: consumerStale,
  pinned,
});
if (staleResult.outcome !== "DENIED") {
  throw new Error(
    `PAIRED_ANALYTICS_ADVERSARIAL_INARIANT_DENIED:stale pair must be DENIED; got ${staleResult.outcome}`,
  );
}
if (!staleResult.reasonCodes.includes("PAIRED_ANALYTICS_HEAD_MISMATCH_DENIED")) {
  throw new Error(
    `PAIRED_ANALYTICS_ADVERSARIAL_REASON_DENIED:stale pair must block on head mismatch; got ${JSON.stringify(staleResult.reasonCodes)}`,
  );
}

const core = {
  schemaVersion: "pansphaira.paired-analytics/compatibility-evidence/v1",
  evidenceId: "pansphaira:par-xr-01-paired-analytics-compatibility-001",
  taskId: "PORTFOLIO-PAR-XR-01-PAIRED-ANALYTICS",
  status: "CURRENT",
  sourceClass: "REPOSITORY_ONLY",
  sourceInputs: [
    { path: PRODUCER_PATH, role: "PRODUCER_MANIFEST" },
    { path: CONSUMER_HEAD_BOUND_PATH, role: "CONSUMER_MANIFEST" },
    { path: CONSUMER_STALE_PATH, role: "CONSUMER_MANIFEST_STALE" },
  ],
  pinned,
  testedHeads: pinned.exactTestedHeads,
  verdict: passResult.outcome,
  reasonCodes: passResult.reasonCodes,
  optionalGapReports: passResult.optionalGapReports,
  adversarialCaseExpectations: [
    {
      caseId: "PAR-XR-01-AC03-STALE-HEAD",
      input: { producer: PRODUCER_PATH, consumer: CONSUMER_STALE_PATH },
      expectedOutcome: "DENIED",
      observedOutcome: staleResult.outcome,
      requiredReasonCode: "PAIRED_ANALYTICS_HEAD_MISMATCH_DENIED",
      observedReasonCodes: staleResult.reasonCodes,
    },
  ],
  claimBoundary: passResult.claimBoundary,
  nonClaims: [
    "This gate is a static two-manifest integrity check; it performs no production, customer, external, publication or closure effect.",
    "The accepted pair claim names only the exact tested KaleidoSphere and PanSphaira heads; no other pair is asserted compatible.",
    "Final public closure remains separately governed and is not performed here.",
  ],
};
const evidence = { ...core, evidenceDigest: sha256(canonicalJson(core)) };

const check = process.argv.includes("--check");
const serialized = `${JSON.stringify(evidence, null, 2)}\n`;
if (check) {
  const existing = readFileSync(resolve(root, EVIDENCE_PATH), "utf8");
  if (existing !== serialized) {
    process.stderr.write(
      "paired-analytics compatibility evidence is not reproducible from the delivered manifests\n",
    );
    process.exitCode = 1;
  } else {
    process.stdout.write(`${evidence.evidenceDigest}\n`);
  }
} else {
  writeFileSync(resolve(root, EVIDENCE_PATH), serialized, "utf8");
  process.stdout.write(`${EVIDENCE_PATH}\n${evidence.evidenceDigest}\n`);
}
