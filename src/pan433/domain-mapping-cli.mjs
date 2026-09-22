#!/usr/bin/env node
// PAN433 real local entry point: select one approved versioned layout,
// read one source artifact, run the bounded adapter, then the released M0
// downstream consumer. No network, provider, runtime or productive write.
import { readFileSync } from "node:fs";
import process from "node:process";
import { PAN433_ALTERNATE_MAPPING_V1, PAN433_DEFAULT_MAPPING_V1, consumePan433MappedInvoiceThroughProcurement434V1 } from "../../dist/packages/contracts/src/pan433-domain-mapping-v1.js";
import {
  buildProc434DecisiveMatchInputV1,
  buildProc434PoV1,
  loadProc434Fixtures,
  recordProc434GoodsReceiptV1,
  runProc434ReaderV1,
} from "../procurement-434/rechnungsabgleich-path.mjs";

function usage(code) {
  const out = code === 0 ? process.stdout : process.stderr;
  out.write("usage: node src/pan433/domain-mapping-cli.mjs --mapping default|alternate --source <json> [--json]\n");
  process.exit(code);
}
const args = process.argv.slice(2);
if (args.includes("--help")) usage(0);
const mappingIndex = args.indexOf("--mapping");
const sourceIndex = args.indexOf("--source");
if (mappingIndex < 0 || sourceIndex < 0 || !args[mappingIndex + 1] || !args[sourceIndex + 1]) usage(2);
const mappingName = args[mappingIndex + 1];
const sourcePath = args[sourceIndex + 1];
if (!["default", "alternate"].includes(mappingName)) usage(2);
try {
  const source = JSON.parse(readFileSync(sourcePath, "utf8"));
  const profile = mappingName === "default" ? PAN433_DEFAULT_MAPPING_V1 : PAN433_ALTERNATE_MAPPING_V1;
  // Build the existing procurement-434 business context through its real
  // PO, receipt and retained ERP-reader entry points. Mapping output alone is
  // deliberately insufficient for PAN433 acceptance.
  const fixtures = loadProc434Fixtures(process.cwd(), "");
  const po = buildProc434PoV1();
  const receipt = po.ok ? recordProc434GoodsReceiptV1(po.entwurf, 2, "wareneingang:wg-eink-001") : null;
  const read = po.ok && receipt?.ok
    ? runProc434ReaderV1(fixtures.readerContract, fixtures.readerExport, "2026-09-10T08:30:00Z")
    : null;
  const downstreamInput = po.ok && receipt?.ok && read?.ok
    ? buildProc434DecisiveMatchInputV1({ fixtures, entwurf: po.entwurf, ledger: receipt.ledger, readback: read.readback, reader: read.reader })
    : null;
  const result = downstreamInput === null || downstreamInput === undefined
    ? { outcome: "DENIED", code: "DOWNSTREAM_INPUT_NOT_CLOSED", detail: "the existing procurement-434 PO/receipt/reader path did not produce a closed business input" }
    : consumePan433MappedInvoiceThroughProcurement434V1(source, profile, downstreamInput, fixtures.pack);
  process.stdout.write(JSON.stringify({ mapping: mappingName, sourcePath, ...result }, null, 2) + "\n");
  process.exitCode = result.outcome === "ACCEPTED" ? 0 : 1;
} catch (error) {
  process.stderr.write(`pan433-domain-mapping error: ${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 2;
}
