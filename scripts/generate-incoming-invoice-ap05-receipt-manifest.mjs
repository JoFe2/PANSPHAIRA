import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { generateIncomingInvoiceAp05ReceiptManifestV1 } from "../dist/packages/contracts/src/index.js";

const root = process.cwd();
const manifestPath = resolve(root, "verification/incoming-invoice-ap05-receipt-manifest-v1.json");
const setupPath = resolve(root, "tests/fixtures/incoming-invoice/ap-05-frozen-setup-v1.json");
const sourceFiles = [
  ["pan365-adaptive-ui-source-v1", "packages/contracts/src/incoming-invoice-adaptive-ui.ts", "tests/fixtures/incoming-invoice/ap-05-adaptive-release-v1/incoming-invoice-adaptive-ui.ts.bytes"],
  ["pan365-adaptive-ui-source-v1", "docs/INCOMING-INVOICE-APPLICATION-GUIDE.md", "tests/fixtures/incoming-invoice/ap-05-adaptive-release-v1/INCOMING-INVOICE-APPLICATION-GUIDE.md"],
  ["pan365-frozen-tolerance-source-v1", "packages/contracts/src/incoming-invoice-adaptive-ui.ts", "packages/contracts/src/incoming-invoice-adaptive-ui.ts"],
  ["pan365-frozen-tolerance-source-v1", "docs/INCOMING-INVOICE-APPLICATION-GUIDE.md", "docs/INCOMING-INVOICE-APPLICATION-GUIDE.md"],
  ["ap04-erv-source-v1", "packages/contracts/src/incoming-invoice-erv.ts", "packages/contracts/src/incoming-invoice-erv.ts"],
  ["ap04-erv-source-v1", "tests/fixtures/incoming-invoice/ap-04-erv-cases-v1.json", "tests/fixtures/incoming-invoice/ap-04-erv-cases-v1.json"],
  ["ap04-erv-source-v1", "schemas/contracts/incoming-invoice-erv-v1.schema.json", "schemas/contracts/incoming-invoice-erv-v1.schema.json"],
];
const input = {
  setup: JSON.parse(readFileSync(setupPath, "utf8")),
  predecessorSources: sourceFiles.map(([releaseId, path, localPath]) => ({ releaseId, path, bytes: Uint8Array.from(readFileSync(resolve(root, localPath))) })),
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
