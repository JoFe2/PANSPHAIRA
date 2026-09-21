#!/usr/bin/env node
/**
 * PAR-XR-01 — Paired-Analytics parity runner (fail-closed, no external call).
 *
 * Verifies manifests against separate reviewed authority, recomputes producer
 * semantics, and optionally executes a pinned public counterpart offline.
 * Static evidence explicitly has no tested-head claim. It performs no
 * production, customer, external, publication or closure effect.
 *
 * It imports the cross-repository canonical JSON implementation rather than
 * redefining one, so it contributes no new canonicalJson implementation site
 * to the FND-PS-04 census.
 */
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { resolve, relative, isAbsolute } from "node:path";
import { executePinnedPair } from "./paired-analytics-execution.mjs";
import { canonicalJson } from "../dist/packages/contracts/src/index.js";
import {
  pairedAnalyticsProducerCoreSha256,
  PAIRED_ANALYTICS_PROMISED_SCOPE_V1,
  verifyPairedAnalyticsParityV1,
} from "../dist/src/analytics/paired-analytics-parity.js";

import { generateProducerAnalyticsManifestV1, historicalProducerAdjudicatorSourceV1 } from "../dist/src/analytics/producer-analytics-manifest.js";
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

// Reviewed code-owned authority, never regenerated from submitted manifests.
const pinned = JSON.parse(readFileSync(new URL("../contracts/analytics/paired-expectation-v1.json", import.meta.url), "utf8"));

// Recompute fixture, calculations, field schema and verdict using the shipped
// producer adjudicator. Inputs cannot define their own expectation: both this
// derivation and the submitted manifest must match the reviewed, separate pin.
const sources = [
  ["rawArtifact", "tests/fixtures/cks-analytics/projection-v1.json"],
  ["nativeServiceCapture", "tests/fixtures/cks-analytics/xra-ps-02-native-service-capture-v1.json"],
  ["sliceReceipt", "verification/pansphaira-kaleidosphere-analytics-slice-v2.json"],
  ["adjudicatorSource", "src/cks-12/kaleidosphere-candidate-quarantine.ts"],
];
const generated = generateProducerAnalyticsManifestV1(Object.fromEntries(sources.map(([key, path]) =>
  [key, key === "adjudicatorSource"
    ? historicalProducerAdjudicatorSourceV1(readFileSync(resolve(root, "tests/fixtures/cks-analytics/native-v2-historical-source.json")))
    : { path, bytes: Uint8Array.from(readFileSync(resolve(root, path))) }]))).manifest;
if (pairedAnalyticsProducerCoreSha256(generated) !== pinned.producerRef.manifestSha256 ||
    canonicalJson(pinned.promisedScope) !== canonicalJson(PAIRED_ANALYTICS_PROMISED_SCOPE_V1)) {
  throw new Error("PAIRED_ANALYTICS_TRUSTED_EXPECTATION_DENIED");
}
// Preserve existing disclosures exactly; only new optional disclosures may vary.
if (!generated.gaps.every(gap => producer.gaps?.some(actual => canonicalJson(actual) === canonicalJson(gap)))) {
  throw new Error("PAIRED_ANALYTICS_REQUIRED_GAP_DENIED");
}

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

const args = process.argv.slice(2);
const options = {};
for (let i = 0; i < args.length; i++) {
  if (args[i] === "--check") { options.check = true; continue; }
  if (!["--counterpart", "--pan-head", "--output"].includes(args[i]) || !args[i + 1] || options[args[i]]) {
    throw new Error("PAIRED_ANALYTICS_ARGUMENT_DENIED");
  }
  options[args[i]] = args[++i];
}
let execution = null;
if (options["--counterpart"] || options["--pan-head"] || options["--output"]) {
  if (!options["--counterpart"] || !options["--pan-head"] || !options["--output"] || options.check) {
    throw new Error("PAIRED_EXECUTION_ARGUMENTS_REQUIRED");
  }
  const outputRelative = relative(root, resolve(options["--output"]));
  if (!outputRelative.startsWith("../") && !isAbsolute(outputRelative)) throw new Error("PAIRED_EXECUTION_OUTPUT_MUST_BE_OUTSIDE_CHECKOUT");
  execution = executePinnedPair({ root, counterpart: options["--counterpart"], expectedPanHead: options["--pan-head"], pinned, consumer: consumerHeadBound });
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
  inputDigests: { producer: producer.manifestDigest, consumer: consumerHeadBound.integrity.digest },
  testedHeads: null,
  executionStatus: "PENDING_PINNED_EXECUTION",
  ...(execution ?? {}),
  declaredSourceHeads: pinned.declaredSourceHeads,
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
  claimBoundary: { ...passResult.claimBoundary, exactTestedPairOnly: execution !== null },
  nonClaims: [
    "No production, customer, network service, publication or closure effect is performed.",
    execution ? "Only the named Git heads were executed using bounded offline runtime probes, not deployed services." : "This static result has no executed-head claim; pinned counterpart execution remains pending.",
    "Final public closure remains separately governed and is not performed here.",
  ],
};
const evidence = { ...core, evidenceDigest: sha256(canonicalJson(core)) };

const check = options.check === true;
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
  writeFileSync(resolve(root, options["--output"] ?? EVIDENCE_PATH), serialized, execution ? { encoding: "utf8", flag: "wx" } : "utf8");
  process.stdout.write(`${options["--output"] ?? EVIDENCE_PATH}\n${evidence.evidenceDigest}\n`);
}
