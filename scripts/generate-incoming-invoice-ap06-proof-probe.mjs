import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { generateIncomingInvoiceAp06ProofProbeV1 } from "../dist/packages/contracts/src/index.js";

const root = process.cwd();
const probePath = resolve(root, "verification/incoming-invoice-ap06-proof-probe-v1.json");
const setupPath = resolve(root, "tests/fixtures/incoming-invoice/ap-05-frozen-setup-v1.json");
// Byte-identical released predecessor sources; every entry reads from the repo path it names.
const sourceFiles = [
  ["ap01-blueprint-source-v1", "packages/contracts/src/incoming-invoice-blueprint.ts"],
  ["ap02-intake-source-v1", "packages/contracts/src/incoming-invoice-intake.ts"],
  ["ap02-intake-source-v1", "tests/fixtures/incoming-invoice/supplier-invoice-v1.txt"],
  ["extraction-benchmark-source-v1", "packages/contracts/src/incoming-invoice-extraction-benchmark.ts"],
  ["ap03-holdout-source-v1", "tests/fixtures/incoming-invoice/ap-03-holdout-v1.json"],
  ["ap04-erv-core-v1", "packages/contracts/src/incoming-invoice-erv.ts"],
  ["ap04-erv-core-v1", "tests/fixtures/incoming-invoice/ap-04-erv-cases-v1.json"],
  ["ap04-erv-core-v1", "schemas/contracts/incoming-invoice-erv-v1.schema.json"],
  ["pan365-adaptive-ui-source-v1", "packages/contracts/src/incoming-invoice-adaptive-ui.ts"],
  ["pan365-ap05-receipt-manifest-source-v1", "packages/contracts/src/incoming-invoice-ap05-receipt-manifest.ts"],
];
const input = {
  setup: JSON.parse(readFileSync(setupPath, "utf8")),
  predecessorSources: sourceFiles.map(([releaseId, path]) => ({ releaseId, path, bytes: Uint8Array.from(readFileSync(resolve(root, path))) })),
};

async function main() {
  const generated = await generateIncomingInvoiceAp06ProofProbeV1(input);
  if (process.argv.includes("--check")) {
    const existing = readFileSync(probePath, "utf8");
    if (existing !== generated.serialized) {
      process.stderr.write("AP06 proof probe is not reproducible from released sources\n");
      process.exitCode = 1;
    } else {
      process.stdout.write(`${generated.probe.proofProbeDigest}\n`);
    }
  } else {
    writeFileSync(probePath, generated.serialized, "utf8");
    process.stdout.write(`${probePath}\n${generated.probe.proofProbeDigest}\n`);
  }
}

await main();