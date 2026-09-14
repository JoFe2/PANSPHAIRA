import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { generateProducerAnalyticsManifestV1 } from "../dist/src/analytics/producer-analytics-manifest.js";

const root = process.cwd();
const manifestPath = resolve(root, "contracts/analytics/producer-manifest-v1.json");
const sources = [
  ["rawArtifact", "tests/fixtures/cks-analytics/projection-v1.json"],
  ["nativeServiceCapture", "tests/fixtures/cks-analytics/xra-ps-02-native-service-capture-v1.json"],
  ["sliceReceipt", "verification/pansphaira-kaleidosphere-analytics-slice-v1.json"],
  ["adjudicatorSource", "src/cks-12/kaleidosphere-candidate-quarantine.ts"],
];
const input = Object.fromEntries(sources.map(([key, localPath]) => [key, { path: localPath, bytes: Uint8Array.from(readFileSync(resolve(root, localPath))) }]));
const generated = generateProducerAnalyticsManifestV1(input);
if (process.argv.includes("--check")) {
  const existing = readFileSync(manifestPath, "utf8");
  if (existing !== generated.serialized) {
    process.stderr.write("producer analytics manifest is not reproducible from the delivered slice\n");
    process.exitCode = 1;
  } else {
    process.stdout.write(`${generated.manifest.manifestDigest}\n`);
  }
} else {
  writeFileSync(manifestPath, generated.serialized, "utf8");
  process.stdout.write(`${manifestPath}\n${generated.manifest.manifestDigest}\n`);
}