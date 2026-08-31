import { readFile, writeFile, mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { renderProfileArtifacts } from "./profile-builder.mjs";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const fixtureRoot = resolve(repoRoot, "tests/fixtures/cscl-04");
const capture = JSON.parse(await readFile(resolve(fixtureRoot, "dolibarr-24.0.0-capture-v1.json"), "utf8"));
const artifacts = renderProfileArtifacts(capture);
await mkdir(fixtureRoot, { recursive: true });
for (const [name, bytes] of Object.entries(artifacts)) await writeFile(resolve(fixtureRoot, name), bytes);
process.stdout.write(`${Object.keys(artifacts).sort().join("\n")}\n`);
