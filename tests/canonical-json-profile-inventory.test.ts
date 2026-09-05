/**
 * FND-PS-04 — repository-wide canonical JSON/digest census (inventory v1).
 *
 * Strict-TDD vertical slice: this test embeds the deterministic mechanical
 * scanner AND the fail-closed validator that define the census. The
 * inventory artifact (verification/canonical-json-profile-inventory-v1.json)
 * must match a fresh re-scan of admitted Main exactly.
 *
 * Scope rules (documented in docs/architecture/canonical-json-profile-inventory.md):
 * - declaration site = a line declaring `canonicalJson` via function/const/let/var.
 * - import site = a line importing `canonicalJson` from a module.
 * - re-export site = an `export { ... canonicalJson ... }` line.
 * - similar-shape site = a declaration of a helper named
 *   canonicalize/encodeCanonical/canonicalDigest. These are inventoried with
 *   equivalence "not-claimed" and NEVER produce an equivalence claim.
 * - the census test file itself is counted in filesScanned but excluded from
 *   every census dimension (self-exclusion), so its own documentation
 *   language can never skew the counts it defines.
 * - byte obligation = a SHA256SUMS-pinned file bound to canonicalization:
 *   every pinned canonicalJson profile implementation, the runtime-parity
 *   evidence test and fixture, and every ledger entry whose path contains
 *   "canonical" (case-insensitive).
 * - equivalence requires shared valid/invalid/unicode/number evidence. Only
 *   valid+invalid is proven today (runtime parity test), so the inventory
 *   makes zero equivalence claims and stance is NOT-PROVEN.
 *
 * The scanner is the single source of truth for the counts: it walks the
 * roots/extensions recorded in the inventory's scanScope, skips
 * node_modules/dist/.git at any depth, and reads files in sorted order.
 */

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import * as path from "node:path";
import * as crypto from "node:crypto";
import { fileURLToPath } from "node:url";

// Compiled location: dist/tests/canonical-json-profile-inventory.test.js
const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "..", "..");
const INVENTORY_PATH = path.join(ROOT, "verification", "canonical-json-profile-inventory-v1.json");
const BASE_OBLIGATIONS_PATH = path.join(ROOT, "tests", "fixtures", "canonical-json-profile-base-obligations-v1.json");
const LEDGER_PATH = path.join(ROOT, "SHA256SUMS");
const DAG_PATH = path.join(ROOT, "verification", "verification-dag-v2.json");

const SCAN_ROOTS = ["src", "packages", "scripts", "demo", "tools", "tests", "benchmarks", "docs"] as const;
const SKIP_DIRS = new Set(["node_modules", "dist", ".git"]);
const SCAN_EXTENSIONS = new Set([".ts", ".mts", ".cts", ".js", ".mjs", ".cjs"]);

const DECLARATION_RE = /\b(?:function|const|let|var)\s+canonicalJson\b/;
const IMPORT_RE = /\bimport\b.*\bcanonicalJson\b.*\bfrom\b/;
const REEXPORT_RE = /\bexport\s*\{[^}]*\bcanonicalJson\b[^}]*\}/;
const SIMILAR_SHAPE_RE = /\b(?:function|const|let|var)\s+(canonicalize|encodeCanonical|canonicalDigest)\b/;
const ALIAS_RE = /\bcanonicalJson\s*=\s*(?:encodeCanonical|canonicalize)\b/;
const WRAPPER_RE = /\bcanonicalJson\s*=\s*\([^)]*\)\s*=>/;
const HELPER_REF_RE = /\b(?:canonicalize|encodeCanonical|canonicalDigest)\b/;
const LEDGER_LINE_RE = /^([0-9a-f]{64})\s+(\S+)$/;
const CANONICAL_NAME_RE = /canonical/i;

const ADMITTED_BASE_COMMIT = "dac921d459cbcfc16e4912dff558c8786e6438de";
const PARITY_TEST_FILE = "tests/canonical-json-runtime-parity.test.mjs";
const PARITY_FIXTURE_FILE = "tests/fixtures/asf-bundle-lock/noncanonical.json";
const SELF_TEST_FILE = "tests/canonical-json-profile-inventory.test.ts";
const INTEGRATION_OWNER_NODE = "repository-integrity";
const INTEGRATION_ARTIFACT_INPUTS = [
  { path: "docs/architecture/canonical-json-profile-inventory.md", role: "DERIVED_EVIDENCE" },
  { path: "tests/fixtures/canonical-json-profile-base-obligations-v1.json", role: "FIXTURE" },
  { path: "verification/canonical-json-profile-inventory-v1.json", role: "CONTRACT" },
  { path: SELF_TEST_FILE, role: "VALIDATOR" },
] as const;
const PROFILE_VERSION_MIGRATIONS: readonly Readonly<ProfileVersionMigration>[] = Object.freeze([
  Object.freeze({
    migrationId: "PORTFOLIO-PS335-INTEGRATE/FND-PS-02-INTEGRITY-GENERATOR/V2",
    path: "scripts/refresh-integrity-data.mjs",
    profileVersion: 2,
    fromSha256: "6bffef78ac4be77ec5ab8c6a043e653d292b1b97d451dcf2db5bfad0979154a8",
    toSha256: "b19ee3ecb425a4404142b0a5e9edef48c8f22285a57504458c2c5ebd386fa12a",
    reason: "Advance verification DAG generation to graph v41 and canonically own the FND-PS-02 focused input family; the immutable v1 digest remains in the admitted-base fixture.",
  }),
  Object.freeze({
    migrationId: "PORTFOLIO-PS337-INTEGRATE/FND-XR-01-INTEGRITY-GENERATOR/V3",
    path: "scripts/refresh-integrity-data.mjs",
    profileVersion: 3,
    fromSha256: "b19ee3ecb425a4404142b0a5e9edef48c8f22285a57504458c2c5ebd386fa12a",
    toSha256: "cd13f5b07971b60c7440fc3ac102eb26f412b980798c56fb30e23ac947ad002f",
    reason: "Retain the reviewed graph v40 compatibility contract while canonically binding the FND-XR-01 paired-compatibility evidence and its repository-only pre-closure classification; the admitted v1 and reviewed v2 digests remain immutable.",
  }),
  Object.freeze({
    migrationId: "AP-01-INTEGRATE/INCOMING-INVOICE-INTEGRITY-GENERATOR/V4",
    path: "scripts/refresh-integrity-data.mjs",
    profileVersion: 4,
    fromSha256: "cd13f5b07971b60c7440fc3ac102eb26f412b980798c56fb30e23ac947ad002f",
    toSha256: "11805df03d04b7c862645f25304b0c81a252535c7f48bdf72df81e9f72b8a216",
    reason: "Advance the Verification DAG to graph v41 and canonically own the AP-01 local-synthetic incoming-invoice Blueprint family.",
  }),
  Object.freeze({
    migrationId: "AP-02-INTEGRATE/INCOMING-INVOICE-INTAKE-INTEGRITY-GENERATOR/V5",
    path: "scripts/refresh-integrity-data.mjs",
    profileVersion: 5,
    fromSha256: "11805df03d04b7c862645f25304b0c81a252535c7f48bdf72df81e9f72b8a216",
    toSha256: "1bb497ec42c16f2865502234404302af10da4a75f1fe293fc03bfa9dede195a2",
    reason: "Advance the Verification DAG to graph v42 and canonically own the AP-02 frozen local-synthetic incoming-invoice intake family.",
  }),
  Object.freeze({
    migrationId: "AP-03-INTEGRATE/INCOMING-INVOICE-EXTRACTION-INTEGRITY-GENERATOR/V6",
    path: "scripts/refresh-integrity-data.mjs",
    profileVersion: 6,
    fromSha256: "1bb497ec42c16f2865502234404302af10da4a75f1fe293fc03bfa9dede195a2",
    toSha256: "fab476df3904cb066dc9912afb28dc0d15965e0f2bf6fe71117f817981e70c69",
    reason: "Advance the Verification DAG to graph v43 and canonically own the AP-03 frozen local-synthetic extraction benchmark family.",
  }),
  Object.freeze({
    migrationId: "PORTFOLIO-PS333-INTEGRATE/E-FND-1-CUMULATIVE-CLOSURE/V7",
    path: "scripts/refresh-integrity-data.mjs",
    profileVersion: 7,
    fromSha256: "fab476df3904cb066dc9912afb28dc0d15965e0f2bf6fe71117f817981e70c69",
    toSha256: "fc0c76558346b3d6487b577a5283569f282fa5b3385b1f79de8efcae8d61ffa2",
    reason: "Retain the current-Main graph v43 compatibility contract while canonically binding the repository-only E-FND-1 cumulative closure inputs to the existing repository-integrity owner after all seven child terminal chains; admitted v1 and reviewed v2-v6 digests remain immutable.",
  }),
  Object.freeze({
    migrationId: "AUDIT-CORRECTION-376/REL-TRUTH-01-INTEGRITY-GENERATOR/V8",
    path: "scripts/refresh-integrity-data.mjs",
    profileVersion: 8,
    fromSha256: "fc0c76558346b3d6487b577a5283569f282fa5b3385b1f79de8efcae8d61ffa2",
    toSha256: "ed305fbf67bc649682876730e71c2b795d18fade41ddb3c5f1d67f1072ba189b",
    reason: "Advance the Verification DAG to graph v44 while reconciling REL-TRUTH-01 release-governance authority and its canonical integrity dependants; admitted v1 and reviewed v2-v7 digests remain immutable.",
  }),
  Object.freeze({
    migrationId: "AUDIT-CORRECTION-377/CURRENT-HEAD-DOCKER-E2E-INTEGRITY-GENERATOR/V9",
    path: "scripts/refresh-integrity-data.mjs",
    profileVersion: 9,
    fromSha256: "ed305fbf67bc649682876730e71c2b795d18fade41ddb3c5f1d67f1072ba189b",
    toSha256: "440b64c5769aef5bb2f90670802aebb08201b13c86de20889488b965cfeb4d54",
    reason: "Advance the Verification DAG to graph v45 and canonically own the bounded current-head Docker E2E contract, focused fail-closed proof and repository-only implementation record; admitted v1 and reviewed v2-v8 digests remain immutable.",
  }),
]);

const REQUIRED_DIMENSIONS = ["valid", "invalid", "unicode", "number"] as const;
const CLASSIFICATIONS = new Set(["implementation", "alias", "wrapper"]);

/**
 * Regression anchors on admitted Main (dac921d459cbcfc16e4912dff558c8786e6438de).
 * filesScanned includes this census test file itself (it lives under tests/,
 * a scan root). Historical lexical hints (81/80 declarations; 172/171 import
 * sites) are historical hints only — the fresh mechanical scan supersedes them.
 */
const EXPECTED_COUNTS = {
  filesScanned: 614,
  declarationSites: 36,
  declarationFiles: 36,
  importSites: 202,
  importFiles: 201,
  reexportSites: 4,
  similarShapeSites: 30,
  byteObligations: 21,
  pinnedProfileFiles: 13,
} as const;
const EXPECTED_LEDGER = { entries: 1772, uniquePaths: 1772, duplicatePaths: 0 } as const;

type Classification = "implementation" | "alias" | "wrapper";

interface Declaration {
  file: string;
  line: number;
  classification: Classification;
  owner: string;
}

interface Reexport {
  file: string;
  line: number;
  owner: string;
}

interface SimilarSite {
  name: string;
  file: string;
  line: number;
  owner: string;
}

interface ScanResult {
  filesScanned: number;
  files: string[];
  declarations: Declaration[];
  importSites: number;
  importFiles: number;
  importFileList: string[];
  importFilesByOwner: Map<string, { sites: number; files: number }>;
  reexports: Reexport[];
  similar: SimilarSite[];
}

interface LedgerResult {
  entries: Map<string, string>;
  lineCount: number;
  uniquePaths: number;
  duplicatePathCount: number;
  conflictingPaths: string[];
}

interface ByteObligation {
  path: string;
  sha256: string;
  basis: string;
}

interface BaseObligations {
  schemaVersion: string;
  baseCommit: string;
  baseLedgerSha256: string;
  pinnedProfiles: Array<{ path: string; sha256: string }>;
  byteObligations: ByteObligation[];
}

interface ProfileVersionMigration {
  migrationId: string;
  path: string;
  profileVersion: number;
  fromSha256: string;
  toSha256: string;
  reason: string;
}

function compareStrings(a: string, b: string): number {
  if (a < b) return -1;
  if (a > b) return 1;
  return 0;
}

function isDirectory(candidate: string): boolean {
  try {
    return statSync(candidate).isDirectory();
  } catch {
    return false;
  }
}

/** Owner family: second segment under src/, packages/, tools/; else top segment. */
function ownerOf(file: string): string {
  const parts = file.split("/");
  const top = parts[0] ?? "";
  if (parts.length > 2 && (top === "src" || top === "packages" || top === "tools")) {
    return parts[1] ?? top;
  }
  return top;
}

/**
 * Classify a canonicalJson declaration line (line-local, form-based,
 * reproducible):
 * - alias:      direct rebind of a canonicalize-family helper
 *               (`export const canonicalJson = canonicalize;`)
 * - wrapper:    arrow-form declaration delegating on the same line to a
 *               canonicalize-family helper
 * - implementation: every other declaration (named function or arrow with
 *               its own serialization body)
 */
function classifyDeclaration(line: string): Classification {
  if (ALIAS_RE.test(line)) return "alias";
  if (WRAPPER_RE.test(line) && HELPER_REF_RE.test(line)) return "wrapper";
  return "implementation";
}

function listSourceFiles(rootDir: string): string[] {
  const out: string[] = [];
  const walk = (dir: string, rel: string): void => {
    const names = readdirSync(dir, { withFileTypes: true }).map((e) => e.name).sort(compareStrings);
    for (const name of names) {
      const abs = path.join(dir, name);
      const relPath = rel === "" ? name : `${rel}/${name}`;
      if (isDirectory(abs)) {
        if (!SKIP_DIRS.has(name)) walk(abs, relPath);
      } else if (SCAN_EXTENSIONS.has(path.extname(name))) {
        out.push(relPath);
      }
    }
  };
  for (const sourceRoot of SCAN_ROOTS) {
    if (isDirectory(path.join(rootDir, sourceRoot))) walk(path.join(rootDir, sourceRoot), sourceRoot);
  }
  return out.sort(compareStrings);
}

function scanRepository(): ScanResult {
  const files = listSourceFiles(ROOT);
  const declarations: Declaration[] = [];
  const reexports: Reexport[] = [];
  const similar: SimilarSite[] = [];
  const importFilesByOwner = new Map<string, { sites: number; files: number }>();
  const importFileList: string[] = [];
  let importSites = 0;
  let importFiles = 0;

  for (const file of files) {
    // Self-exclusion: the census tool's own documentation lines must never
    // count as census entries for the repository it scans.
    const census = file !== SELF_TEST_FILE;
    const lines = readFileSync(path.join(ROOT, file), "utf8").split("\n");
    let fileImportSites = 0;
    for (let i = 0; i < lines.length; i += 1) {
      const line = lines[i] ?? "";
      const lineNo = i + 1;
      if (!census) continue;
      if (DECLARATION_RE.test(line)) {
        declarations.push({ file, line: lineNo, classification: classifyDeclaration(line), owner: ownerOf(file) });
      }
      if (REEXPORT_RE.test(line)) {
        reexports.push({ file, line: lineNo, owner: ownerOf(file) });
      }
      if (IMPORT_RE.test(line)) {
        fileImportSites += 1;
      }
      const sim = line.match(SIMILAR_SHAPE_RE);
      if (sim) {
        similar.push({ name: sim[1] ?? "unknown", file, line: lineNo, owner: ownerOf(file) });
      }
    }
    if (fileImportSites > 0) {
      importSites += fileImportSites;
      importFiles += 1;
      importFileList.push(file);
      const owner = ownerOf(file);
      const agg = importFilesByOwner.get(owner) ?? { sites: 0, files: 0 };
      agg.sites += fileImportSites;
      agg.files += 1;
      importFilesByOwner.set(owner, agg);
    }
  }

  importFileList.sort(compareStrings);
  return { filesScanned: files.length, files, declarations, importSites, importFiles, importFileList, importFilesByOwner, reexports, similar };
}

/**
 * Parse SHA256SUMS. The ledger mixes `hash ./path` and `hash path` forms;
 * both parse to the same bare-path key. Duplicate lines for one path are
 * legal only when the digests agree (otherwise the byte obligation is
 * ambiguous and validation fails closed).
 */
function parseLedger(): LedgerResult {
  const entries = new Map<string, string>();
  const pathLineCounts = new Map<string, number>();
  const conflictingPaths: string[] = [];
  let lineCount = 0;
  const text = readFileSync(LEDGER_PATH, "utf8");
  for (const rawLine of text.split("\n")) {
    const m = rawLine.match(LEDGER_LINE_RE);
    if (!m) continue;
    lineCount += 1;
    let filePath = m[2] ?? "";
    if (filePath === "./") continue;
    if (filePath.startsWith("./")) filePath = filePath.slice(2);
    if (filePath === "") continue;
    const digest = m[1] ?? "";
    const existing = entries.get(filePath);
    if (existing !== undefined && existing !== digest) conflictingPaths.push(filePath);
    entries.set(filePath, digest);
    pathLineCounts.set(filePath, (pathLineCounts.get(filePath) ?? 0) + 1);
  }
  let duplicatePathCount = 0;
  for (const n of pathLineCounts.values()) {
    if (n > 1) duplicatePathCount += 1;
  }
  return { entries, lineCount, uniquePaths: entries.size, duplicatePathCount, conflictingPaths };
}

function sha256OfFile(repoPath: string): string | null {
  try {
    return crypto.createHash("sha256").update(readFileSync(path.join(ROOT, repoPath))).digest("hex");
  } catch {
    return null;
  }
}

function currentPinnedProfileDigests(): Map<string, string> {
  const current = new Map(loadBaseObligations().pinnedProfiles.map((item) => [item.path, item.sha256]));
  for (const migration of PROFILE_VERSION_MIGRATIONS) current.set(migration.path, migration.toSha256);
  return current;
}

/**
 * Version migrations are code-owned, exact and one-way. The immutable admitted
 * base fixture remains the source of every v1 digest; candidate metadata may
 * only reproduce the separately reviewed migration recorded here.
 */
function validateProfileVersionMigrations(doc: Record<string, unknown>, errors: string[]): void {
  const migrationsRaw = doc.profileVersionMigrations;
  if (!Array.isArray(migrationsRaw)) {
    errors.push("profile-version-migration:missing");
    return;
  }
  const expectedById = new Map(PROFILE_VERSION_MIGRATIONS.map((migration) => [migration.migrationId, migration]));
  const basePinned = new Map(loadBaseObligations().pinnedProfiles.map((item) => [item.path, item.sha256]));
  const seen = new Set<string>();
  migrationsRaw.forEach((migrationRaw, index) => {
    if (typeof migrationRaw !== "object" || migrationRaw === null || Array.isArray(migrationRaw)) {
      errors.push("profile-version-migration:structure");
      return;
    }
    const migration = migrationRaw as Record<string, unknown>;
    const migrationId = typeof migration.migrationId === "string" ? migration.migrationId : "";
    const migrationPath = typeof migration.path === "string" ? migration.path : "";
    const expected = expectedById.get(migrationId);
    if (expected === undefined || seen.has(migrationId)) {
      errors.push(`profile-version-migration:id:${migrationId || "missing"}`);
      return;
    }
    seen.add(migrationId);
    const expectedRecord = expected as ProfileVersionMigration;
    if (
      Object.keys(migration).sort(compareStrings).join("\0") !== Object.keys(expectedRecord).sort(compareStrings).join("\0")
      || Object.entries(expectedRecord).some(([key, value]) => migration[key] !== value)
    ) {
      errors.push(`profile-version-migration:metadata:${migrationId}`);
    }
    if (PROFILE_VERSION_MIGRATIONS[index]?.migrationId !== migrationId) {
      errors.push(`profile-version-migration:order:${migrationId}`);
    }
    if (migrationPath !== expected.path) {
      errors.push(`profile-version-migration:path:${migrationId}`);
    }
  });

  const currentByPath = new Map(basePinned);
  const versionByPath = new Map<string, number>();
  const migratedPaths = new Set<string>();
  for (const expected of PROFILE_VERSION_MIGRATIONS) {
    const previousDigest = currentByPath.get(expected.path);
    const previousVersion = versionByPath.get(expected.path) ?? 1;
    if (previousDigest !== expected.fromSha256) {
      errors.push(`profile-version-migration:chain:${expected.migrationId}`);
    }
    if (expected.profileVersion !== previousVersion + 1) {
      errors.push(`profile-version-migration:version:${expected.migrationId}`);
    }
    if (expected.fromSha256 === expected.toSha256) {
      errors.push(`profile-version-migration:no-op:${expected.migrationId}`);
    }
    currentByPath.set(expected.path, expected.toSha256);
    versionByPath.set(expected.path, expected.profileVersion);
    migratedPaths.add(expected.path);
  }
  for (const expected of PROFILE_VERSION_MIGRATIONS) {
    if (!seen.has(expected.migrationId)) errors.push(`profile-version-migration:omitted:${expected.migrationId}`);
  }
  for (const migrationPath of migratedPaths) {
    if (sha256OfFile(migrationPath) !== currentByPath.get(migrationPath)) {
      errors.push(`profile-version-migration:current:${migrationPath}`);
    }
  }
  if (migrationsRaw.length !== PROFILE_VERSION_MIGRATIONS.length) {
    errors.push("profile-version-migration:count");
  }
}

/**
 * The accepted census has one deterministic integration owner. The inventory
 * records the expected owner and the DAG binds the current bytes, so neither a
 * stale Main base nor derived-integrity drift can silently enter the candidate.
 */
function validateIntegrationOwnership(doc: Record<string, unknown>, errors: string[]): void {
  const baseRef = typeof doc.baseRef === "string" ? doc.baseRef : "";
  const baseCommit = typeof doc.baseCommit === "string" ? doc.baseCommit : "";
  if (baseRef !== "origin/main" || baseCommit !== ADMITTED_BASE_COMMIT) {
    errors.push(`stale-base:${baseRef || "missing"}`);
  }

  const ownershipRaw = doc.integrationOwnership;
  if (typeof ownershipRaw !== "object" || ownershipRaw === null || Array.isArray(ownershipRaw)) {
    errors.push("unowned-derived-integrity:ownership-missing");
    return;
  }
  const ownership = ownershipRaw as Record<string, unknown>;
  if (ownership.ownerNode !== INTEGRATION_OWNER_NODE) {
    errors.push("unowned-derived-integrity:owner");
    return;
  }
  if (!Array.isArray(ownership.artifactInputs)) {
    errors.push("unowned-derived-integrity:artifact-inputs");
    return;
  }

  const declared = new Map<string, string>();
  for (const entryRaw of ownership.artifactInputs) {
    if (typeof entryRaw !== "object" || entryRaw === null || Array.isArray(entryRaw)) {
      errors.push("unowned-derived-integrity:artifact-inputs");
      continue;
    }
    const entry = entryRaw as Record<string, unknown>;
    const inputPath = typeof entry.path === "string" ? entry.path : "";
    const role = typeof entry.role === "string" ? entry.role : "";
    if (inputPath === "" || declared.has(inputPath)) {
      errors.push("unowned-derived-integrity:artifact-inputs");
      continue;
    }
    declared.set(inputPath, role);
  }
  for (const expected of INTEGRATION_ARTIFACT_INPUTS) {
    if (declared.get(expected.path) !== expected.role) {
      errors.push(`unowned-derived-integrity:${expected.path}`);
    }
  }
  if (declared.size !== INTEGRATION_ARTIFACT_INPUTS.length) {
    errors.push("unowned-derived-integrity:artifact-inputs");
  }

  let dag: Record<string, unknown>;
  try {
    dag = JSON.parse(readFileSync(DAG_PATH, "utf8")) as Record<string, unknown>;
  } catch {
    errors.push("unowned-derived-integrity:dag-invalid");
    return;
  }
  const nodes = Array.isArray(dag.nodes) ? dag.nodes as Array<Record<string, unknown>> : [];
  const owner = nodes.find((node) => node.id === INTEGRATION_OWNER_NODE);
  if (owner === undefined || !Array.isArray(owner.inputs)) {
    errors.push("unowned-derived-integrity:dag-owner");
    return;
  }
  const inputs = new Map<string, Record<string, unknown>>();
  for (const inputRaw of owner.inputs) {
    if (typeof inputRaw !== "object" || inputRaw === null || Array.isArray(inputRaw)) continue;
    const input = inputRaw as Record<string, unknown>;
    if (typeof input.path === "string") inputs.set(input.path, input);
  }
  for (const expected of INTEGRATION_ARTIFACT_INPUTS) {
    const input = inputs.get(expected.path);
    if (input === undefined || input.role !== expected.role || input.sha256 !== sha256OfFile(expected.path)) {
      errors.push(`unowned-derived-integrity:${expected.path}`);
    }
  }
}

/**
 * Expected byte obligations, derived mechanically:
 * 1. every pinned canonicalJson profile implementation (basis: profile-implementation)
 * 2. the runtime-parity evidence test (basis: parity-evidence) and fixture
 *    (basis: parity-fixture)
 * 3. every remaining ledger entry whose path matches /canonical/i
 *    (basis: ledger-name-match)
 */
function expectedByteObligations(scan: ScanResult, ledger: LedgerResult): ByteObligation[] {
  void scan;
  void ledger;
  const migrations = new Map(PROFILE_VERSION_MIGRATIONS.map((migration) => [migration.path, migration]));
  return loadBaseObligations().byteObligations
    .map((obligation) => {
      const migration = migrations.get(obligation.path);
      return migration === undefined
        ? { ...obligation }
        : { ...obligation, sha256: migration.toSha256, basis: "profile-version-migration" };
    })
    .sort((a, b) => compareStrings(a.path, b.path));
}

/**
 * Fail-closed validator. Returns a list of coded error strings; an empty
 * list means the inventory matches the fresh scan of admitted Main exactly.
 * Every error code is asserted by a focused negative test below.
 */
function validateInventory(inv: unknown, scan: ScanResult, ledger: LedgerResult): string[] {
  const errors: string[] = [];
  if (typeof inv !== "object" || inv === null || Array.isArray(inv)) {
    return ["structure-invalid"];
  }
  const doc = inv as Record<string, unknown>;

  // --- current-Main integration ownership ---------------------------------------------
  validateIntegrationOwnership(doc, errors);
  validateProfileVersionMigrations(doc, errors);

  // --- profiles -------------------------------------------------------------
  const profilesRaw = doc.profiles;
  if (!Array.isArray(profilesRaw)) {
    errors.push("structure-invalid:profiles");
  } else {
    const scanDeclarations = new Map<string, Declaration>();
    for (const decl of scan.declarations) scanDeclarations.set(decl.file, decl);
    const pinnedProfileDigests = currentPinnedProfileDigests();
    const seenFiles = new Set<string>();
    const knownFiles = new Set<string>();

    (profilesRaw as Array<Record<string, unknown>>).forEach((entry, index) => {
      if (typeof entry !== "object" || entry === null || Array.isArray(entry)) {
        errors.push(`structure-invalid:profiles[${index}]`);
        return;
      }
      const file = typeof entry.file === "string" ? entry.file : "";
      const line = typeof entry.line === "number" && Number.isInteger(entry.line) ? entry.line : NaN;
      const owner = typeof entry.owner === "string" ? entry.owner : "";
      const classification = typeof entry.classification === "string" ? entry.classification : "";
      const pinned = typeof entry.pinned === "boolean" ? entry.pinned : null;
      const sha256 = typeof entry.sha256 === "string" || entry.sha256 === null ? entry.sha256 : "invalid";

      if (file === "") {
        errors.push(`structure-invalid:profiles[${index}].file`);
        return;
      }
      if (Number.isNaN(line) || line < 1) errors.push(`structure-invalid:profiles[${index}].line`);
      if (!CLASSIFICATIONS.has(classification)) errors.push(`unclassified:${file}`);
      if (seenFiles.has(file)) errors.push(`duplicate-profile-entry:${file}`);
      seenFiles.add(file);
      knownFiles.add(file);

      const decl = scanDeclarations.get(file);
      if (decl === undefined) {
        errors.push(`unknown-profile-file:${file}`);
      } else {
        if (line !== decl.line) errors.push(`stale-line:${file}`);
        if (owner !== ownerOf(file)) errors.push(`owner-mismatch:${file}`);
        if (CLASSIFICATIONS.has(classification) && classification !== decl.classification) {
          errors.push(`classification-mismatch:${file}`);
        }
      }

      const expectedDigest = pinnedProfileDigests.get(file);
      const pinnedInBase = expectedDigest !== undefined;
      if (pinned === null) {
        errors.push(`structure-invalid:profiles[${index}].pinned`);
      } else {
        if (pinned !== pinnedInBase) errors.push(`pin-state-mismatch:${file}`);
        if (pinnedInBase) {
          if (sha256 !== expectedDigest) errors.push(`byte-obligation-mismatch:${file}#recorded`);
          const onDisk = sha256OfFile(file);
          if (onDisk === null || onDisk !== expectedDigest) errors.push(`byte-obligation-mismatch:${file}#on-disk`);
        } else if (sha256 !== null) {
          errors.push(`byte-obligation-mismatch:${file}#recorded`);
        }
      }
    });

    for (const decl of scan.declarations) {
      if (!knownFiles.has(decl.file)) errors.push(`omitted-profile-entry:${decl.file}`);
    }
  }

  // --- fresh counts -----------------------------------------------------------
  const countsRaw = doc.freshCounts;
  if (typeof countsRaw !== "object" || countsRaw === null || Array.isArray(countsRaw)) {
    errors.push("count-mismatch:freshCounts-missing");
  } else {
    const counts = countsRaw as Record<string, unknown>;
    const declarationFiles = new Set<string>();
    for (const decl of scan.declarations) declarationFiles.add(decl.file);
    const expected: Record<string, number> = {
      filesScanned: scan.filesScanned,
      declarationSites: scan.declarations.length,
      declarationFiles: declarationFiles.size,
      importSites: scan.importSites,
      importFiles: scan.importFiles,
      reexportSites: scan.reexports.length,
      similarShapeSites: scan.similar.length,
      ledgerEntries: ledger.lineCount,
      ledgerUniquePaths: ledger.uniquePaths,
    };
    for (const [field, value] of Object.entries(expected)) {
      const actual = counts[field];
      if (typeof actual !== "number" || actual !== value) errors.push(`count-mismatch:${field}`);
    }
  }

  // --- re-exports ---------------------------------------------------------------
  const reexportsRaw = doc.reexports;
  if (!Array.isArray(reexportsRaw)) {
    errors.push("reexport-mismatch:missing");
  } else {
    const declared = new Map<string, Reexport>();
    for (const re of scan.reexports) declared.set(`${re.file}:${re.line}`, re);
    const listed = new Set<string>();
    for (const entry of reexportsRaw as Array<Record<string, unknown>>) {
      const file = typeof entry.file === "string" ? entry.file : "";
      const line = typeof entry.line === "number" ? entry.line : NaN;
      const key = `${file}:${line}`;
      if (listed.has(key)) errors.push(`reexport-mismatch:duplicate:${key}`);
      listed.add(key);
      const decl = declared.get(key);
      if (decl === undefined) {
        errors.push(`reexport-mismatch:unknown:${key}`);
      } else if (typeof entry.owner === "string" && entry.owner !== ownerOf(file)) {
        errors.push(`owner-mismatch:${file}#reexport`);
      }
    }
    for (const key of declared.keys()) {
      if (!listed.has(key)) errors.push(`reexport-mismatch:omitted:${key}`);
    }
  }

  // --- consumer families ----------------------------------------------------------
  const familiesRaw = doc.consumerFamilies;
  if (!Array.isArray(familiesRaw)) {
    errors.push("consumer-mismatch:missing");
  } else {
    const expected = new Map<string, { sites: number; files: number }>(scan.importFilesByOwner);
    const seenOwners = new Set<string>();
    for (const entry of familiesRaw as Array<Record<string, unknown>>) {
      const owner = typeof entry.owner === "string" ? entry.owner : "";
      if (owner === "") {
        errors.push("consumer-mismatch:owner-invalid");
        continue;
      }
      if (seenOwners.has(owner)) errors.push(`consumer-mismatch:duplicate:${owner}`);
      seenOwners.add(owner);
      const agg = expected.get(owner);
      if (agg === undefined) {
        errors.push(`consumer-mismatch:unknown:${owner}`);
        continue;
      }
      const sites = typeof entry.importSites === "number" ? entry.importSites : NaN;
      const files = typeof entry.importFiles === "number" ? entry.importFiles : NaN;
      if (sites !== agg.sites || files !== agg.files) errors.push(`consumer-mismatch:${owner}`);
    }
    for (const owner of expected.keys()) {
      if (!seenOwners.has(owner)) errors.push(`consumer-mismatch:omitted:${owner}`);
    }
  }

  // --- similar-shape sites ---------------------------------------------------------
  const similarRaw = doc.similarShape;
  if (!Array.isArray(similarRaw)) {
    errors.push("similar-shape-mismatch:missing");
  } else {
    const expectedKeys = new Set<string>();
    for (const site of scan.similar) expectedKeys.add(`${site.name}@${site.file}:${site.line}`);
    const listed = new Set<string>();
    for (const entry of similarRaw as Array<Record<string, unknown>>) {
      const name = typeof entry.name === "string" ? entry.name : "";
      const file = typeof entry.file === "string" ? entry.file : "";
      const line = typeof entry.line === "number" ? entry.line : NaN;
      const key = `${name}@${file}:${line}`;
      if (listed.has(key)) errors.push(`similar-shape-mismatch:duplicate:${key}`);
      listed.add(key);
      if (!expectedKeys.has(key)) errors.push(`similar-shape-mismatch:unknown:${key}`);
      if (typeof entry.equivalence === "string" && entry.equivalence !== "not-claimed") {
        errors.push(`similarity-equivalence-claim:${file}:${line}`);
      }
      if (typeof entry.owner === "string" && entry.owner !== ownerOf(file)) {
        errors.push(`owner-mismatch:${file}#similar`);
      }
    }
    for (const key of expectedKeys) {
      if (!listed.has(key)) errors.push(`similar-shape-mismatch:omitted:${key}`);
    }
  }

  // --- byte obligations --------------------------------------------------------------
  const obligationsRaw = doc.byteObligations;
  if (!Array.isArray(obligationsRaw)) {
    errors.push("byte-obligation-structure");
  } else {
    const expected = expectedByteObligations(scan, ledger);
    const expectedByPath = new Map<string, ByteObligation>();
    for (const ob of expected) expectedByPath.set(ob.path, ob);
    const listed = new Map<string, Record<string, unknown>>();
    for (const entry of obligationsRaw as Array<Record<string, unknown>>) {
      const filePath = typeof entry.path === "string" ? entry.path : "";
      if (filePath === "") {
        errors.push("byte-obligation-structure");
        continue;
      }
      if (listed.has(filePath)) errors.push(`byte-obligation-duplicate:${filePath}`);
      listed.set(filePath, entry);
      const exp = expectedByPath.get(filePath);
      if (exp === undefined) {
        errors.push(`byte-obligation-unknown:${filePath}`);
        continue;
      }
      if (typeof entry.sha256 === "string" && entry.sha256 !== exp.sha256) {
        errors.push(`byte-obligation-mismatch:${filePath}#recorded`);
      }
      if (typeof entry.basis === "string" && entry.basis !== exp.basis) {
        errors.push(`byte-obligation-basis:${filePath}`);
      }
      const onDisk = sha256OfFile(filePath);
      if (onDisk === null || onDisk !== exp.sha256) {
        errors.push(`byte-obligation-mismatch:${filePath}#on-disk`);
      }
    }
    for (const exp of expected) {
      if (!listed.has(exp.path)) errors.push(`byte-obligation-omitted:${exp.path}`);
    }
  }

  // --- equivalence stance --------------------------------------------------------------
  const eqRaw = doc.equivalence;
  if (typeof eqRaw !== "object" || eqRaw === null || Array.isArray(eqRaw)) {
    errors.push("structure-invalid:equivalence");
  } else {
    const eq = eqRaw as Record<string, unknown>;
    const required = Array.isArray(eq.requiredDimensions)
      ? (eq.requiredDimensions as unknown[]).filter((d): d is string => typeof d === "string")
      : [];
    if (
      required.length !== REQUIRED_DIMENSIONS.length ||
      REQUIRED_DIMENSIONS.some((d) => !required.includes(d))
    ) {
      errors.push("equivalence-policy-weakened");
    }
    const claims = Array.isArray(eq.claims) ? (eq.claims as unknown[]) : null;
    if (claims === null) {
      errors.push("structure-invalid:equivalence.claims");
    } else {
      let hasUnproven = false;
      for (const claim of claims) {
        const c = typeof claim === "object" && claim !== null ? (claim as Record<string, unknown>) : {};
        const proven = Array.isArray(c.provenDimensions)
          ? (c.provenDimensions as unknown[]).filter((d): d is string => typeof d === "string")
          : [];
        const missing = REQUIRED_DIMENSIONS.filter((d) => !proven.includes(d));
        if (missing.length > 0) {
          hasUnproven = true;
          errors.push(
            `equivalence-claim-unproven:${String(c.fileA ?? "?")}~${String(c.fileB ?? "?")}:missing=${missing.join(",")}`
          );
        }
      }
      const stance = typeof eq.stance === "string" ? eq.stance : "";
      if (hasUnproven || claims.length === 0) {
        if (stance !== "NOT-PROVEN") errors.push("equivalence-stance-inconsistent");
      } else if (stance !== "PROVEN") {
        errors.push("equivalence-stance-inconsistent");
      }
    }
  }

  // --- ledger integrity ------------------------------------------------------------------
  if (ledger.conflictingPaths.length > 0) {
    errors.push(`ledger-conflict:${ledger.conflictingPaths.join(",")}`);
  }

  return errors;
}

// ---------------------------------------------------------------------------
// Shared, lazily computed state
// ---------------------------------------------------------------------------
let SCAN: ScanResult | null = null;
let LEDGER: LedgerResult | null = null;

function getScan(): ScanResult {
  if (SCAN === null) SCAN = scanRepository();
  return SCAN;
}

function getLedger(): LedgerResult {
  if (LEDGER === null) LEDGER = parseLedger();
  return LEDGER;
}

function loadInventory(): unknown {
  return JSON.parse(readFileSync(INVENTORY_PATH, "utf8"));
}

function loadBaseObligations(): BaseObligations {
  const value = JSON.parse(readFileSync(BASE_OBLIGATIONS_PATH, "utf8")) as BaseObligations;
  assert.equal(value.schemaVersion, "pansphaira.canonical-json/base-byte-obligations/v1");
  assert.equal(value.baseCommit, ADMITTED_BASE_COMMIT);
  assert.equal(value.baseLedgerSha256, "549df940019f7014fb6bdd1ebedef9359938e3a64651d766d069794b00293b3b");
  return value;
}

function validateCurrent(): string[] {
  return validateInventory(loadInventory(), getScan(), getLedger());
}

// ---------------------------------------------------------------------------
// Positive cases: the fresh scan reproduces the census and the inventory
// validates clean against it.
// ---------------------------------------------------------------------------
test("fresh mechanical scan reproduces the census counts on admitted Main", () => {
  const scan = getScan();
  const ledger = getLedger();
  assert.equal(scan.filesScanned, EXPECTED_COUNTS.filesScanned);
  assert.equal(scan.declarations.length, EXPECTED_COUNTS.declarationSites);
  const declarationFiles = new Set(scan.declarations.map((d) => d.file));
  assert.equal(declarationFiles.size, EXPECTED_COUNTS.declarationFiles);
  assert.equal(scan.importSites, EXPECTED_COUNTS.importSites);
  assert.equal(scan.importFiles, EXPECTED_COUNTS.importFiles);
  assert.equal(scan.reexports.length, EXPECTED_COUNTS.reexportSites);
  assert.equal(scan.similar.length, EXPECTED_COUNTS.similarShapeSites);
  assert.equal(ledger.lineCount, EXPECTED_LEDGER.entries);
  assert.equal(ledger.uniquePaths, EXPECTED_LEDGER.uniquePaths);
  assert.equal(ledger.duplicatePathCount, EXPECTED_LEDGER.duplicatePaths);
  assert.deepEqual(ledger.conflictingPaths, []);
});

test("every discovered declaration and consumer family has an owner", () => {
  const scan = getScan();
  for (const decl of scan.declarations) {
    assert.equal(decl.owner, ownerOf(decl.file), `owner for ${decl.file}`);
    assert.ok(CLASSIFICATIONS.has(decl.classification), `classification for ${decl.file}`);
  }
  for (const [owner] of scan.importFilesByOwner) {
    assert.ok(owner.length > 0, "non-empty owner family");
  }
});

test("inventory validates clean against the fresh scan (positive)", () => {
  assert.deepEqual(validateCurrent(), []);
});

test("accepted census binds exact admitted Main and all derived artifacts to repository integrity", () => {
  const inv = loadInventory() as Record<string, unknown>;
  assert.equal(inv.baseRef, "origin/main");
  assert.equal(inv.baseCommit, ADMITTED_BASE_COMMIT);
  assert.deepEqual(validateCurrent(), []);
});

test("every current digest-bound byte is unchanged on disk", () => {
  const scan = getScan();
  const ledger = getLedger();
  const obligations = expectedByteObligations(scan, ledger);
  assert.equal(obligations.length, EXPECTED_COUNTS.byteObligations);
  for (const ob of obligations) {
    const onDisk = sha256OfFile(ob.path);
    assert.equal(onDisk, ob.sha256, `digest drift for ${ob.path} (basis ${ob.basis})`);
  }
});

test("all admitted pinned profiles keep their immutable digest or exact version migration", () => {
  const scan = getScan();
  const currentPinned = currentPinnedProfileDigests();
  const pinned = scan.declarations.filter((d) => currentPinned.has(d.file));
  assert.equal(pinned.length, EXPECTED_COUNTS.pinnedProfileFiles);
  for (const decl of pinned) {
    const expected = currentPinned.get(decl.file);
    assert.equal(sha256OfFile(decl.file), expected, `pinned digest drift for ${decl.file}`);
  }
});

test("integrity generator migration chain preserves immutable admitted and reviewed obligations", () => {
  const base = loadBaseObligations();
  const migrations = PROFILE_VERSION_MIGRATIONS.filter(({ path: file }) => file === "scripts/refresh-integrity-data.mjs");
  assert.deepEqual(migrations.map(({ profileVersion }) => profileVersion), [2, 3, 4, 5, 6, 7, 8, 9]);
  const baseDigest = base.pinnedProfiles.find(({ path: file }) => file === migrations[0]?.path)?.sha256;
  assert.equal(baseDigest, base.byteObligations.find(({ path: file }) => file === migrations[0]?.path)?.sha256);
  let previousDigest = baseDigest;
  for (const migration of migrations) {
    assert.equal(migration.fromSha256, previousDigest);
    assert.notEqual(migration.fromSha256, migration.toSha256);
    previousDigest = migration.toSha256;
  }
  assert.equal(sha256OfFile(migrations.at(-1)!.path), previousDigest);
});

test("no equivalence claim is made: stance NOT-PROVEN, unicode+number evidence missing", () => {
  const inv = loadInventory() as Record<string, any>;
  const eq = inv.equivalence;
  assert.equal(eq.stance, "NOT-PROVEN");
  assert.deepEqual(eq.claims, []);
  assert.deepEqual(eq.requiredDimensions, [...REQUIRED_DIMENSIONS]);
  assert.deepEqual(eq.missingDimensions, ["unicode", "number"]);
  assert.equal(typeof eq.provenScope, "string");
  assert.ok(eq.provenScope.length > 0);
  for (const site of inv.similarShape) {
    assert.equal(site.equivalence, "not-claimed", `similar-shape site ${site.file}:${site.line}`);
  }
});

test("the census test file itself contributes no census entries (self-consistency)", () => {
  const scan = getScan();
  assert.ok(scan.files.includes(SELF_TEST_FILE), "census test file is inside the scan scope");
  assert.equal(scan.importFileList.length, scan.importFiles, "import file list is consistent with importFiles count");
  assert.ok(!scan.declarations.some((d) => d.file === SELF_TEST_FILE));
  assert.ok(!scan.reexports.some((r) => r.file === SELF_TEST_FILE));
  assert.ok(!scan.similar.some((s) => s.file === SELF_TEST_FILE));
  assert.ok(!scan.importFileList.includes(SELF_TEST_FILE), "self-exclusion: no import sites from the census test file");
});

// ---------------------------------------------------------------------------
// Negative / fail-closed cases: each mutation of the inventory must produce
// the corresponding coded validation error. Mutations are in-memory only —
// no temporary files are written into the repository.
// ---------------------------------------------------------------------------
function assertFails(mutate: (inv: any) => void, code: string): void {
  const inv = structuredClone(loadInventory());
  mutate(inv);
  const errors = validateInventory(inv, getScan(), getLedger());
  assert.ok(
    errors.some((e) => e.startsWith(code)),
    `expected validation error starting with "${code}"; got: ${JSON.stringify(errors)}`
  );
}

test("negative: omitted profile entry fails validation", () => {
  assertFails((inv) => {
    inv.profiles.splice(0, 1);
  }, "omitted-profile-entry:");
});

test("negative: stale public-Main base fails closed", () => {
  assertFails((inv) => {
    inv.baseCommit = "0".repeat(40);
  }, "stale-base:");
});

test("negative: omitted profile-version migration fails closed", () => {
  assertFails((inv) => {
    inv.profileVersionMigrations.pop();
  }, "profile-version-migration:");
});

test("negative: candidate-rewritten profile-version migration fails closed", () => {
  assertFails((inv) => {
    inv.profileVersionMigrations[0].toSha256 = "0".repeat(64);
  }, "profile-version-migration:");
});

test("negative: unowned derived-integrity artifact fails closed", () => {
  assertFails((inv) => {
    inv.integrationOwnership.ownerNode = "unowned-node";
  }, "unowned-derived-integrity:");
});

test("negative: duplicate profile entry fails validation", () => {
  assertFails((inv) => {
    inv.profiles.push(structuredClone(inv.profiles[0]));
  }, "duplicate-profile-entry:");
});

test("negative: unknown owner fails validation", () => {
  assertFails((inv) => {
    inv.profiles[0].owner = "mystery-owner";
  }, "owner-mismatch:");
});

test("negative: unclassified profile entry fails validation", () => {
  assertFails((inv) => {
    inv.profiles[0].classification = "";
  }, "unclassified:");
});

test("negative: wrong classification fails validation", () => {
  const scan = getScan();
  const impl = scan.declarations.find((d) => d.classification === "implementation");
  if (impl === undefined) assert.fail("no implementation declaration found in scan");
  assertFails((inv) => {
    const entry = inv.profiles.find((p: any) => p.file === impl.file);
    entry.classification = "wrapper";
  }, "classification-mismatch:");
});

test("negative: stale declaration line fails validation", () => {
  assertFails((inv) => {
    inv.profiles[0].line += 1;
  }, "stale-line:");
});

test("negative: unknown profile file fails validation", () => {
  assertFails((inv) => {
    inv.profiles.push({
      file: "src/mystery/canonical-profile.mjs",
      line: 1,
      owner: "mystery",
      classification: "implementation",
      pinned: false,
      sha256: null,
    });
  }, "unknown-profile-file:");
});

test("negative: tampered profile digest fails validation", () => {
  assertFails((inv) => {
    const pinned = inv.profiles.find((p: any) => p.pinned === true);
    pinned.sha256 = "0".repeat(64);
  }, "byte-obligation-mismatch:");
});

test("negative: wrong pin state fails validation", () => {
  assertFails((inv) => {
    const pinned = inv.profiles.find((p: any) => p.pinned === true);
    pinned.pinned = false;
    pinned.sha256 = null;
  }, "pin-state-mismatch:");
});

test("negative: omitted byte obligation fails validation", () => {
  assertFails((inv) => {
    inv.byteObligations.splice(-1, 1);
  }, "byte-obligation-omitted:");
});

test("negative: duplicate byte obligation fails validation", () => {
  assertFails((inv) => {
    inv.byteObligations.push(structuredClone(inv.byteObligations[0]));
  }, "byte-obligation-duplicate:");
});

test("negative: unknown byte obligation fails validation", () => {
  assertFails((inv) => {
    inv.byteObligations.push({
      path: "docs/evidence/conveyor/canonical-synthetic-unknown.json",
      sha256: "1".repeat(64),
      basis: "ledger-name-match",
    });
  }, "byte-obligation-unknown:");
});

test("negative: tampered byte obligation digest fails validation", () => {
  assertFails((inv) => {
    inv.byteObligations[0].sha256 = "f".repeat(64);
  }, "byte-obligation-mismatch:");
});

test("candidate ledger regeneration cannot redefine immutable base obligations", () => {
  const ledger = getLedger();
  const mutated: LedgerResult = {
    ...ledger,
    entries: new Map(ledger.entries),
  };
  const pinned = loadBaseObligations().pinnedProfiles[0];
  const firstObligation = loadBaseObligations().byteObligations[0];
  assert.ok(pinned);
  assert.ok(firstObligation);
  mutated.entries.set(pinned.path, "f".repeat(64));
  assert.deepEqual(validateInventory(loadInventory(), getScan(), mutated), []);
  assert.equal(expectedByteObligations(getScan(), mutated)[0]?.sha256,
    firstObligation.sha256);
});

test("negative: similar-shape site never yields an equivalence claim", () => {
  assertFails((inv) => {
    inv.similarShape[0].equivalence = "equivalent";
  }, "similarity-equivalence-claim:");
});

test("negative: omitted similar-shape site fails validation", () => {
  assertFails((inv) => {
    inv.similarShape.splice(0, 1);
  }, "similar-shape-mismatch:omitted:");
});

test("negative: equivalence claim lacking full evidence fails validation", () => {
  assertFails((inv) => {
    inv.equivalence.claims.push({
      fileA: "src/rks-01/comparator.mjs",
      fileB: "packages/contracts/src/canonical-json.js",
      provenDimensions: ["valid", "invalid"],
      evidence: ["tests/canonical-json-runtime-parity.test.mjs"],
    });
  }, "equivalence-claim-unproven:");
});

test("negative: weakening the required evidence dimensions fails validation", () => {
  assertFails((inv) => {
    inv.equivalence.requiredDimensions = ["valid"];
  }, "equivalence-policy-weakened");
});

test("negative: PROVEN stance without complete claims fails validation", () => {
  assertFails((inv) => {
    inv.equivalence.stance = "PROVEN";
  }, "equivalence-stance-inconsistent");
});

test("negative: drifted fresh counts fail validation", () => {
  assertFails((inv) => {
    inv.freshCounts.declarationSites += 1;
  }, "count-mismatch:");
});

test("negative: drifted consumer family counts fail validation", () => {
  assertFails((inv) => {
    inv.consumerFamilies[0].importSites += 1;
  }, "consumer-mismatch:");
});

test("negative: omitted re-export site fails validation", () => {
  assertFails((inv) => {
    inv.reexports.splice(0, 1);
  }, "reexport-mismatch:omitted:");
});