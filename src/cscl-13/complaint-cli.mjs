#!/usr/bin/env node
import { readFile, writeFile, mkdir, rename } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import process from "node:process";

import { createPan437ComplaintCli, PAN437_ORDER_SOURCE_LABEL_V1 } from "./pan437-neighbor.mjs";
import { canonicalJson } from "./complaint.mjs";

const DEFAULT_REFERENCES = "tests/fixtures/cscl-13/delivery-references-v1.json";
const DEFAULT_ORDER_SOURCE = "tests/fixtures/erp-read/supported-export-v1.json";
const DEFAULT_ORDER_CONTRACT = "tests/fixtures/erp-read/contract-v1.json";
const ORDER_READ_NOW = "2026-08-10T08:30:00Z";

function usage() {
  return [
    "pansphaira cscl-13 complaint CLI",
    "commands:",
    "  select <positionId> <customerId>",
    "  raise  <positionId> <customerId> <reason> <quantity> <traceId>",
    "  decide <complaintId> <decision> <actorId>",
    "  read   <complaintId>",
    "  evidence",
    "options:",
    `  --references <path>   labelled synthetic delivery references (default ${DEFAULT_REFERENCES})`,
    `  --order-source <path> labelled synthetic ERP order source bytes (default ${DEFAULT_ORDER_SOURCE})`,
    `  --order-contract <path> existing ERP read contract (default ${DEFAULT_ORDER_CONTRACT})`,
    "  --store <path>        lokale Verlaufsdatei (default ./.complaints-local.json)",
  ].join("\n");
}

async function loadStore(path) {
  try {
    return JSON.parse(await readFile(path, "utf8"));
  } catch (error) {
    if (error && error.code === "ENOENT") return null;
    throw error;
  }
}

async function saveStore(path, ledger) {
  const snapshot = ledger.snapshot();
  const { snapshotDigest, ...persistable } = snapshot;
  await mkdir(dirname(resolve(path)), { recursive: true });
  const tmp = `${path}.tmp`;
  await writeFile(tmp, `${canonicalJson(persistable)}\n`, { flag: "w" });
  await rename(tmp, path);
}

const print = (value) => process.stdout.write(`${JSON.stringify(value, null, 2)}\n`);

async function main() {
  const argv = process.argv.slice(2);
  let referencePath = DEFAULT_REFERENCES;
  let orderSourcePath = DEFAULT_ORDER_SOURCE;
  let orderContractPath = DEFAULT_ORDER_CONTRACT;
  let storePath = ".complaints-local.json";
  const positional = [];
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (["--references", "--order-source", "--order-contract", "--store"].includes(token)) {
      if (!argv[index + 1]) throw new Error(`INVALID_ARGUMENT:${token}`);
      if (token === "--references") referencePath = argv[index + 1];
      else if (token === "--order-source") orderSourcePath = argv[index + 1];
      else if (token === "--order-contract") orderContractPath = argv[index + 1];
      else storePath = argv[index + 1];
      index += 1;
      continue;
    }
    positional.push(token);
  }
  const [command, ...args] = positional;
  if (!command || command === "--help" || command === "help") {
    process.stdout.write(`${usage()}\n`);
    return;
  }

  const references = JSON.parse(await readFile(referencePath, "utf8"));
  const contract = JSON.parse(await readFile(orderContractPath, "utf8"));
  const sourceBytes = await readFile(orderSourcePath);
  // Public composition owns the actual reader execution; it never accepts an
  // order-result-shaped object from the caller.
  const composition = createPan437ComplaintCli({
    references, contract, sourceBytes, sourceLabel: PAN437_ORDER_SOURCE_LABEL_V1, enabled: true, now: ORDER_READ_NOW,
  });
  if (composition.verdict.outcome !== "BOUND") {
    print(composition.verdict.outcome === "DENIED" ? composition.verdict : { outcome: "DENIED", code: composition.verdict.code });
    return;
  }
  const ledger = composition.ledger;
  const stored = await loadStore(storePath);
  if (stored) {
    try { ledger.hydrate(stored); } catch (error) {
      print({ outcome: "DENIED", code: error.message });
      return;
    }
  }

  if (command === "select") {
    const [positionId, customerId] = args;
    if (!positionId || !customerId) throw new Error("USAGE: select <positionId> <customerId>");
    print(ledger.select({ positionId, customerId }));
    return;
  }
  if (command === "raise") {
    const [positionId, customerId, reason, quantityRaw, ...traceParts] = args;
    if (!positionId || !customerId || !reason || quantityRaw === undefined || !/^[0-9]+$/.test(String(quantityRaw))) throw new Error("USAGE: raise <positionId> <customerId> <reason> <quantity> <traceId>");
    const traceId = traceParts.join(" ");
    if (traceId.length === 0) throw new Error("USAGE: raise <positionId> <customerId> <reason> <quantity> <traceId>");
    const result = ledger.raise({ positionId, customerId, reason, quantity: Number(quantityRaw), traceId });
    if (result.outcome === "RAISED") await saveStore(storePath, ledger);
    print(result);
    return;
  }
  if (command === "decide") {
    const [complaintId, decision, actorId] = args;
    if (!complaintId || !decision || !actorId) throw new Error("USAGE: decide <complaintId> <decision> <actorId>");
    const result = ledger.decide({ complaintId, decision, actorId });
    if (result.outcome === "DECIDED") await saveStore(storePath, ledger);
    print(result);
    return;
  }
  if (command === "read") {
    const [complaintId] = args;
    if (!complaintId) throw new Error("USAGE: read <complaintId>");
    print(ledger.readback({ complaintId }));
    return;
  }
  if (command === "evidence") {
    print(ledger.evidence());
    return;
  }
  throw new Error(`UNKNOWN_COMMAND:${command}`);
}

main().catch((error) => {
  process.stderr.write(`${error.message}\n`);
  process.exitCode = 1;
});
