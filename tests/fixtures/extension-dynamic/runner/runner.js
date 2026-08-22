import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";

const scenarioIndex = process.argv.indexOf("--scenario");
const scenario = scenarioIndex >= 0 ? process.argv[scenarioIndex + 1] : "";
const subjectBytes = readFileSync("/subject/core.json");
const subjectDigest = createHash("sha256").update(subjectBytes).digest("hex");

if (scenario === "success") {
  writeFileSync("/scratch/result.json", `${JSON.stringify({ scenario, subjectDigest })}\n`, { flag: "wx" });
  process.exit(0);
}
if (scenario === "injected-failure") {
  writeFileSync("/scratch/result.json", `${JSON.stringify({ scenario, subjectDigest })}\n`, { flag: "wx" });
  process.exit(1);
}
if (scenario === "timeout") {
  setInterval(() => {}, 60_000);
} else {
  process.exit(64);
}
