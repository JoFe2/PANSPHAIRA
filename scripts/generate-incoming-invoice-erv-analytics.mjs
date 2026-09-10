import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { generateErvAnalyticsPackV1 } from "../dist/packages/contracts/src/index.js";

const root = process.cwd();
const artifactPath = resolve(root, "verification/incoming-invoice-erv-analytics-v1.json");
const ap03Path = "tests/fixtures/incoming-invoice/ap-03-holdout-v1.json";
const ap04Path = "tests/fixtures/incoming-invoice/ap-04-erv-cases-v1.json";
const bytes = (localPath) => Uint8Array.from(readFileSync(resolve(root, localPath)));

// The standalone pack is derived ONLY from the two exact released ERV receipts.
// The checked-in artifact is the BASELINE scenario (both receipts released, no adapted tolerance requests).
const input = {
  scenario: "BASELINE",
  receipts: [
    { receiptId: "AP03_EXTRACTION_RECEIPT_V1", path: ap03Path, state: "RELEASED", bytes: bytes(ap03Path) },
    { receiptId: "AP04_ERV_CORE_V1", path: ap04Path, state: "RELEASED", bytes: bytes(ap04Path) },
  ],
  adaptedToleranceRequests: [],
};
const generated = generateErvAnalyticsPackV1(input);

if (process.argv.includes("--check")) {
  const existing = readFileSync(artifactPath, "utf8");
  if (existing !== generated.serialized) {
    process.stderr.write("ERV analytics pack is not reproducible from the released receipts\n");
    process.exitCode = 1;
  } else {
    process.stdout.write(`${generated.pack.packDigest}\n`);
  }
} else {
  writeFileSync(artifactPath, generated.serialized, "utf8");
  process.stdout.write(`${artifactPath}\n${generated.pack.packDigest}\n`);
}