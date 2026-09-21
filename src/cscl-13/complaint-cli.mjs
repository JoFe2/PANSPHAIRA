#!/usr/bin/env node
import { readFile, writeFile, mkdir, rename } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import process from "node:process";

import { createComplaintLedger, canonicalJson } from "./complaint.mjs";

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
    "  --references <path>   delivery-references-v1.json (default tests/fixtures/cscl-13/delivery-references-v1.json)",
    "  --store <path>        lokale Verlaufsdatei (default ./.complaints-local.json)",
  ].join("\n");
}

async function loadStore(path) {
  try {
    const raw = await readFile(path, "utf8");
    return JSON.parse(raw);
  } catch (error) {
    if (error && error.code === "ENOENT") return null;
    throw error;
  }
}

async function saveStore(path, refs) {
  const snapshot = refs.snapshot();
  const payload = { schemaVersion: snapshot.schemaVersion, referenceSetId: snapshot.referenceSetId, entries: snapshot.entries };
  const bytes = `${canonicalJson(payload)}\n`;
  await mkdir(dirname(resolve(path)), { recursive: true });
  const tmp = `${path}.tmp`;
  await writeFile(tmp, bytes, { flag: "w" });
  await rename(tmp, path);
}

async function main() {
  const argv = process.argv.slice(2);
  let referencePath = "tests/fixtures/cscl-13/delivery-references-v1.json";
  let storePath = ".complaints-local.json";
  const positional = [];
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (token === "--references" || token === "--store") {
      if (!argv[index + 1]) throw new Error(`INVALID_ARGUMENT:${token}`);
      if (token === "--references") referencePath = argv[index + 1];
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
  const ledger = createComplaintLedger(references);
  const stored = await loadStore(storePath);
  if (stored) ledger.hydrate(stored);

  if (command === "select") {
    const [positionId, customerId] = args;
    if (!positionId || !customerId) throw new Error("USAGE: select <positionId> <customerId>");
    process.stdout.write(`${JSON.stringify(ledger.select({ positionId, customerId }), null, 2)}\n`);
    return;
  }
  if (command === "raise") {
    const [positionId, customerId, reason, quantityRaw, ...traceParts] = args;
    if (!positionId || !customerId || !reason || quantityRaw === undefined) throw new Error("USAGE: raise <positionId> <customerId> <reason> <quantity> <traceId>");
    const quantity = Number(quantityRaw);
    const traceId = traceParts.join(" ") || `trace-${Date.now()}`;
    const result = ledger.raise({ positionId, customerId, reason, quantity, traceId });
    if (result.outcome === "RAISED") await saveStore(storePath, ledger);
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
    return;
  }
  if (command === "decide") {
    const [complaintId, decision, actorId] = args;
    if (!complaintId || !decision || !actorId) throw new Error("USAGE: decide <complaintId> <decision> <actorId>");
    const result = ledger.decide({ complaintId, decision, actorId });
    if (result.outcome === "DECIDED") await saveStore(storePath, ledger);
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
    return;
  }
  if (command === "read") {
    const [complaintId] = args;
    if (!complaintId) throw new Error("USAGE: read <complaintId>");
    process.stdout.write(`${JSON.stringify(ledger.readback({ complaintId }), null, 2)}\n`);
    return;
  }
  if (command === "evidence") {
    process.stdout.write(`${JSON.stringify(ledger.evidence(), null, 2)}\n`);
    return;
  }
  throw new Error(`UNKNOWN_COMMAND:${command}`);
}

main().catch((error) => {
  process.stderr.write(`${error.message}\n`);
  process.exitCode = 1;
});
