import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import test from "node:test";

const ROOT = new URL("../", import.meta.url);
const legacyDisplay = ["PANS", "PHAIRA"].join("");
const formerOwner = ["Jim", "Pansky"].join("");
const formerPagesOwner = ["jim", "pansky"].join("");

function read(path) {
  return readFileSync(new URL(path, ROOT), "utf8");
}

function classify(path, line) {
  if (path.startsWith("closure-audits/")) return "closure-audit-provenance";
  if (path.startsWith("docs/evidence/conveyor/")) return "internal-conveyor-evidence";
  if (line.includes("PANSPHAIRA_CANONICAL_JSON_SHA256_V1")) return "stable-algorithm-identifier";
  if (
    path.startsWith("archive/")
    || path.startsWith("docs/development/")
    || path.startsWith("examples/daily-poc/")
    || path.startsWith("tests/fixtures/daily-poc/")
  ) return "historical-evidence";

  if (path === "packages/dev-worker/src/controller.ts") return "technical-repository-identifier";
  if (
    path === "docs/architecture/cks-10-analytics-bridge-decision-v1.md"
    || path.startsWith("verification/cks-10-")
  ) return "stable-cks10-authority-identifier";
  if (path.startsWith("tests/cks-12/")) return "stable-cks12-technical-identifier";
  if (path.startsWith("docs/architecture/rks-01")) return "stable-rks01-technical-identifier";
  if (path === "demo/manifests/network/local-egress-policy-v1.json") return "technical-fixture-identifier";
  if (path === "tests/fixtures/incoming-invoice/supplier-invoice-v1.txt") return "frozen-synthetic-fixture-display";
  if (path.startsWith("schemas/")) return "stable-schema";
  if (path === "release/governance.json") {
    if (line.includes(`JoFe2/${legacyDisplay}`)) return "repository-slug";
    return "historical-release-governance";
  }
  if (line.includes(`${legacyDisplay}-TERMINOLOGY.md`)) return "stable-filename";
  if (line.includes(`cd ${legacyDisplay}`)) return "repository-directory";
  if (path === "docs/PANSPHAIRA-TERMINOLOGY.md" && line.includes("PAN-08-")) return "quoted-historical-fact";
  if (path === "docs/RELEASE-GOVERNANCE.md" && line.includes("v0.2.0-poc.20260818.2")) return "quoted-historical-release";
  if (
    line.includes(`JoFe2/${legacyDisplay}`)
    || line.includes(`JoFe2\\/${legacyDisplay}`)
    || line.includes(`github.io/${legacyDisplay}`)
    || line.includes(`/${legacyDisplay}/`)
    || line.includes(`\\/${legacyDisplay}\\/`)
  ) return "repository-slug-or-working-url";
  return null;
}

function classifyFormerOwner(path, line) {
  if (path.startsWith("closure-audits/")) return "closure-audit-provenance";
  if (path === ".github/FUNDING.yml") return "keep-sponsorship-handle";
  if (path === "README.md" && line.includes("buymeacoffee.com")) return "keep-sponsorship-handle";
  if (
    path.startsWith("archive/")
    || path.startsWith("docs/development/")
    || path.startsWith("examples/daily-poc/")
  ) return "historical-evidence";
  if (
    path === "packages/dev-worker/src/controller.ts"
    && (line.includes("PrivateDenied") || line.includes("OtherRepo"))
  ) return "keep-negative-fixture-identity";
  if (
    path === "tests/external-video-service.test.ts"
    && line.includes("chimpmaera-video-reference-2026.08.02-v2.tar.gz")
  ) return "historical-release-asset-fixture";
  return null;
}

test("current public product display is PanSphaira while stable contracts remain unchanged", () => {
  assert.match(read("README.md"), /^# PanSphaira$/m);
  assert.doesNotMatch(read("README.md"), new RegExp(`^# ${legacyDisplay}$`, "m"));
  assert.match(read("docs/PANSPHAIRA-TERMINOLOGY.md"), /\*\*PanSphaira\*\* is the official product name/);
  assert.match(read("docs/.vitepress/config.mts"), /title: "PanSphaira"/);
  assert.match(read("docs/.vitepress/config.mts"), /base: "\/PANSPHAIRA\/"/);
  assert.match(read("CITATION.cff"), /title: "PanSphaira"/);
  assert.match(read("scripts/daily-poc.mjs"), /heading !== "PanSphaira"/);
  assert.match(read("packages/dev-worker/src/controller.ts"), new RegExp(`JoFe2/${legacyDisplay}`));
});

test("every retained all-caps token has an explicit KEEP classification", (t) => {
  const listed = spawnSync("git", ["ls-files", "-z", "--cached", "--others", "--exclude-standard"], { cwd: ROOT, encoding: "utf8" });
  assert.equal(listed.status, 0, listed.stderr);
  const counts = new Map();
  const unclassified = [];
  let occurrences = 0;

  for (const path of listed.stdout.split("\0").filter(Boolean)) {
    const bytes = readFileSync(new URL(path, ROOT));
    if (bytes.includes(0)) continue;
    for (const [index, line] of bytes.toString("utf8").split("\n").entries()) {
      const count = line.split(legacyDisplay).length - 1;
      if (!count) continue;
      const category = classify(path, line);
      if (!category) unclassified.push(`${path}:${index + 1}:${line.trim()}`);
      else counts.set(category, (counts.get(category) ?? 0) + count);
      occurrences += count;
    }
  }

  assert.deepEqual(unclassified, []);
  assert.ok(occurrences > 0, "retained stable and historical contracts must remain represented");
  for (const [category, count] of [...counts].sort()) t.diagnostic(`${category}=${count}`);
  t.diagnostic(`retained-total=${occurrences}`);
});

test("active owner, Pages, release, package, issue-template, and worker routes use the canonical owner", () => {
  const repository = "https://github.com/JoFe2/PANSPHAIRA";
  const pages = "https://jofe2.github.io/PANSPHAIRA/";
  assert.match(read("README.md"), new RegExp(`${repository}/releases/latest`));
  assert.match(read("README.md"), new RegExp(pages.replaceAll(".", "\\.")));
  assert.match(read("CITATION.cff"), new RegExp(`repository-code: "${repository}"`));
  assert.match(read("package.json"), new RegExp(`${repository.replaceAll("/", "\\/")}#readme`));
  assert.match(read(".github/ISSUE_TEMPLATE/config.yml"), new RegExp(`${repository}/security/policy`));
  assert.match(read("docs/.vitepress/config.mts"), /const siteUrl = "https:\/\/jofe2\.github\.io\/PANSPHAIRA\/"/);
  assert.match(read("docs/public/robots.txt"), /^Sitemap: https:\/\/jofe2\.github\.io\/PANSPHAIRA\/sitemap\.xml$/m);
  assert.match(read("packages/dev-worker/src/controller.ts"), /CHIMPMAERA_PUBLIC_REPOSITORY = "JoFe2\/PANSPHAIRA"/);
  assert.match(read("packages/dev-worker/src/controller.ts"), /sourceOrigin: "https:\/\/github\.com\/JoFe2\/PANSPHAIRA\.git"/);
  assert.doesNotMatch(read("packages/dev-worker/src/controller.ts"), new RegExp(`${formerOwner}/${legacyDisplay}`));
});

test("every retained former-owner token has an exact KEEP or HISTORICAL classification", (t) => {
  const listed = spawnSync("git", ["ls-files", "-z", "--cached", "--others", "--exclude-standard"], { cwd: ROOT, encoding: "utf8" });
  assert.equal(listed.status, 0, listed.stderr);
  const counts = new Map();
  const unclassified = [];
  let occurrences = 0;

  for (const path of listed.stdout.split("\0").filter(Boolean)) {
    const bytes = readFileSync(new URL(path, ROOT));
    if (bytes.includes(0)) continue;
    for (const [index, line] of bytes.toString("utf8").split("\n").entries()) {
      const count = (line.split(formerOwner).length - 1) + (line.split(formerPagesOwner).length - 1);
      if (!count) continue;
      const category = classifyFormerOwner(path, line);
      if (!category) unclassified.push(`${path}:${index + 1}:${line.trim()}`);
      else counts.set(category, (counts.get(category) ?? 0) + count);
      occurrences += count;
    }
  }

  assert.deepEqual(unclassified, []);
  assert.ok(occurrences > 0, "historical evidence and sponsorship identity must remain represented");
  assert.match(read("CITATION.cff"), /name: "Jim Pansky"/);
  assert.match(read(".github/FUNDING.yml"), new RegExp(`^github: ${formerOwner}\\b`, "m"));
  assert.match(read(".github/FUNDING.yml"), new RegExp(`^buy_me_a_coffee: ${formerPagesOwner}$`, "m"));
  for (const [category, count] of [...counts].sort()) t.diagnostic(`${category}=${count}`);
  t.diagnostic(`retained-former-owner-total=${occurrences}`);
});
