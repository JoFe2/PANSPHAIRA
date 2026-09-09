import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { generateIncomingInvoiceAp05ReceiptManifestV1 } from "../dist/packages/contracts/src/index.js";

const root = process.cwd();
const manifestPath = resolve(root, "verification/incoming-invoice-ap05-receipt-manifest-v1.json");
const setupPath = resolve(root, "tests/fixtures/incoming-invoice/ap-05-frozen-setup-v1.json");
const sourcePaths = [
  "packages/contracts/src/incoming-invoice-adaptive-ui.ts",
  "docs/INCOMING-INVOICE-APPLICATION-GUIDE.md",
  "packages/contracts/src/incoming-invoice-erv.ts",
  "tests/fixtures/incoming-invoice/ap-04-erv-cases-v1.json",
];
const input = {
  setup: JSON.parse(readFileSync(setupPath, "utf8")),
  predecessorSources: sourcePaths.map((path) => ({ path, bytes: Uint8Array.from(readFileSync(resolve(root, path))) })),
};
const generated = generateIncomingInvoiceAp05ReceiptManifestV1(input);
if (process.argv.includes("--check")) {
  const existing = readFileSync(manifestPath, "utf8");
  if (existing !== generated.serialized) {
    process.stderr.write("AP05 receipt manifest is not reproducible from released sources\n");
    process.exitCode = 1;
  } else {
    process.stdout.write(`${generated.manifest.manifestDigest}\n`);
  }
} else {
  writeFileSync(manifestPath, generated.serialized, "utf8");
  process.stdout.write(`${manifestPath}\n${generated.manifest.manifestDigest}\n`);
}
