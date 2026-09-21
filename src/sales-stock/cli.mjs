#!/usr/bin/env node
import process from "node:process";
import {
  DEFAULT_SALES_STOCK_JOURNEY_INPUT_V1,
  runSalesStockJourneyV1,
  runSalesStockNegativeProbeV1,
} from "../../dist/packages/contracts/src/sales-stock-journey-v1.js";

function usage() {
  return [
    "PAN435-436 local sales/stock journey (labelled synthetic, offline)",
    "commands:",
    "  run",
    "  negative <receipt-zero|shortage|reservation-conflict|stale-observation>",
    "options for run:",
    "  --receipt <positive integer>",
    "  --request <positive integer>",
    "  --reserve <positive integer>",
    "  --threshold <positive integer>",
    "  --replenish <positive integer>",
    "  --observed-at <ISO datetime>",
    "  --receipt-at <ISO datetime>",
    "  --decision-at <ISO datetime>",
    "  --promised-date <YYYY-MM-DD>",
  ].join("\n");
}

function parsePositive(name, value) {
  if (!/^[1-9][0-9]*$/.test(value ?? "")) throw new Error(`INVALID_ARGUMENT:${name}`);
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed)) throw new Error(`INVALID_ARGUMENT:${name}`);
  return parsed;
}

function parse(argv) {
  const [command, ...rest] = argv;
  const options = { ...DEFAULT_SALES_STOCK_JOURNEY_INPUT_V1 };
  const positional = [];
  const names = {
    "--receipt": "receiptQuantity",
    "--request": "requestedQuantity",
    "--reserve": "reservationQuantity",
    "--threshold": "replenishmentThreshold",
    "--replenish": "replenishmentQuantity",
    "--observed-at": "observedAt",
    "--receipt-at": "receiptAt",
    "--decision-at": "decisionAt",
    "--promised-date": "promisedDate",
  };
  for (let index = 0; index < rest.length; index += 1) {
    const token = rest[index];
    if (token === "--help") return { command: "help", options, positional };
    if (token in names) {
      const value = rest[index + 1];
      if (!value) throw new Error(`INVALID_ARGUMENT:${token}`);
      const key = names[token];
      options[key] = key.endsWith("Quantity") || key === "replenishmentThreshold" ? parsePositive(token, value) : value;
      index += 1;
      continue;
    }
    if (token.startsWith("--")) throw new Error(`INVALID_ARGUMENT:${token}`);
    positional.push(token);
  }
  return { command, options, positional };
}

const print = (value) => process.stdout.write(`${JSON.stringify(value, null, 2)}\n`);

function main() {
  const parsed = parse(process.argv.slice(2));
  if (!parsed.command || parsed.command === "help") {
    process.stdout.write(`${usage()}\n`);
    return;
  }
  if (parsed.command === "run") {
    print(runSalesStockJourneyV1(parsed.options));
    return;
  }
  if (parsed.command === "negative") {
    const caseName = parsed.positional[0];
    if (!caseName) throw new Error("USAGE: negative <case>");
    print(runSalesStockNegativeProbeV1(caseName));
    return;
  }
  throw new Error(`UNKNOWN_COMMAND:${parsed.command}`);
}

try {
  main();
} catch (error) {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
}
