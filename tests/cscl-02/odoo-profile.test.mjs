import test from "node:test";
import assert from "node:assert/strict";
import { readFile, mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import Ajv2020 from "ajv/dist/2020.js";
import addFormats from "ajv-formats";

import {
  buildOfflineProfile,
  captureOfficialSources,
  verifySourceBundle,
  PARSER,
  CANONICALIZER,
} from "../../src/cscl-02/odoo-profile.mjs";

const ROOT = resolve(import.meta.dirname, "../..");
const BUNDLE = join(ROOT, "tests/fixtures/cscl-02/odoo-community-source-bundle-v1.json");
const SPECS = join(ROOT, "tests/fixtures/cscl-02/odoo-community-cell-specs-v1.json");
const EXPECTED_COMMIT = "1eb4fcdf08ddbc1341bdc8cb8129906722f54bdc";
const FAMILIES = ["PARTY_CUSTOMER_MANAGEMENT", "PRODUCT_ITEM_MANAGEMENT", "SALES_ORDER_MANAGEMENT"];
const QUESTIONS = ["objects-roles", "relations", "operations", "inputs-outputs", "states-transitions", "events", "preconditions", "invariants", "exceptions-errors", "readbacks", "api-service-exposure", "absence-ambiguity-conflict"];

async function schemas() {
  const ajv = new Ajv2020({ allErrors: true, strict: true, allowUnionTypes: true });
  addFormats(ajv);
  return {
    fact: ajv.compile(JSON.parse(await readFile(join(ROOT, "contracts/cscl-01/source-fact-v1.schema.json")))),
    cell: ajv.compile(JSON.parse(await readFile(join(ROOT, "contracts/cscl-01/evidence-cell-v1.schema.json")))),
    profile: ajv.compile(JSON.parse(await readFile(join(ROOT, "contracts/cscl-01/system-profile-v1.schema.json")))),
  };
}

test("offline replay emits schema-valid exact 36-cell Odoo-native profile", async () => {
  const result = await buildOfflineProfile({ repoRoot: ROOT, bundlePath: BUNDLE, specsPath: SPECS });
  assert.equal(result.profile.systemId, "odoo-community");
  assert.equal(result.profile.systemRole, "TRAINING");
  assert.equal(result.profile.holdoutIsolation, "TRAINING_PROFILE");
  assert.deepEqual(result.profile.capabilityFamilies, FAMILIES);
  assert.equal(result.sourceFacts.length, 36);
  assert.equal(result.cells.length, 36);
  assert.equal(result.profile.evidenceCells.length, 36);
  assert.equal(new Set(result.sourceFacts.map(f => `${f.capabilityFamily}/${f.questionId}`)).size, 36);
  for (const family of FAMILIES) for (const question of QUESTIONS) {
    assert.ok(result.sourceFacts.some(f => f.capabilityFamily === family && f.questionId === question), `${family}/${question}`);
  }
  const v = await schemas();
  for (const fact of result.sourceFacts) assert.equal(v.fact(fact), true, JSON.stringify(v.fact.errors));
  for (const cell of result.cells) assert.equal(v.cell(cell), true, JSON.stringify(v.cell.errors));
  assert.equal(v.profile(result.profile), true, JSON.stringify(v.profile.errors));
  assert.ok(result.cells.some(c => c.state === "ABSENT"));
  assert.ok(result.cells.some(c => c.state === "AMBIGUOUS"));
  assert.ok(result.cells.filter(c => ["ABSENT", "CONFLICTING"].includes(c.state)).every(c => c.counterexamples.length > 0));
  assert.ok(result.sourceFacts.every(f => !/party\/customer|product\/item|common core|capability candidate|authority/i.test(f.claim)));
});

test("offline replay is byte-identical and performs no fetch", async () => {
  let fetched = false;
  globalThis.fetch = async () => { fetched = true; throw new Error("NETWORK_FORBIDDEN"); };
  const a = await buildOfflineProfile({ repoRoot: ROOT, bundlePath: BUNDLE, specsPath: SPECS });
  const b = await buildOfflineProfile({ repoRoot: ROOT, bundlePath: BUNDLE, specsPath: SPECS });
  assert.equal(fetched, false);
  assert.deepEqual(a.bytes, b.bytes);
  assert.equal(a.digest, b.digest);
});

test("source verifier denies identity, source, legal, parser, path, and paired substitution drift", async () => {
  const original = JSON.parse(await readFile(BUNDLE, "utf8"));
  const mutations = [
    b => { b.commit = "refs/heads/19.0"; },
    b => { b.commit = "0".repeat(40); },
    b => { b.repository = "https://example.invalid/odoo.git"; },
    b => { b.license.licenseId = "GPL-3.0-only"; },
    b => { b.parser = { id: PARSER.id, version: "9.9.9" }; },
    b => { b.canonicalizer = { id: CANONICALIZER.id, version: "9.9.9" }; },
    b => { b.hiddenAuthority = true; },
    b => { b.files[0].path = `mirror/${b.files[0].path}`; },
    b => { b.files[0].base64 = Buffer.from("invented").toString("base64"); b.files[0].rawLength = 8; b.files[0].sha256 = "0".repeat(64); },
  ];
  for (const mutate of mutations) {
    const b = structuredClone(original); mutate(b);
    assert.throws(() => verifySourceBundle(b), /DENIED|DRIFT|MISMATCH|INVALID|FORBIDDEN/);
  }
});

test("source verifier enforces exact official URLs, Base64 integrity, and 20 MiB decoded cap", async () => {
  const original = JSON.parse(await readFile(BUNDLE, "utf8"));
  assert.equal(verifySourceBundle(original).commit, EXPECTED_COMMIT);
  const over = structuredClone(original);
  over.files = [{ ...over.files[0], rawLength: 20 * 1024 * 1024 + 1 }];
  assert.throws(() => verifySourceBundle(over), /CAP/);
  const branch = structuredClone(original);
  branch.files[0].url = "https://raw.githubusercontent.com/odoo/odoo/19.0/addons/base/models/res_partner.py";
  assert.throws(() => verifySourceBundle(branch), /URL/);
});

test("network capture is explicit and denies path substitution", async () => {
  await assert.rejects(() => captureOfficialSources({ network: false, paths: ["LICENSE"] }), /EXPLICIT_NETWORK_MODE_REQUIRED/);
  await assert.rejects(() => captureOfficialSources({ network: true, paths: ["../idempiere"] }), /SOURCE_PATH_FORBIDDEN/);
});

test("profile builder denies omitted family/question, invented locators, hidden fields, and normalized terminology", async () => {
  const specs = JSON.parse(await readFile(SPECS, "utf8"));
  const cases = [
    s => { s.cells.pop(); },
    s => { s.cells[0].locator = "missing.py:invented"; },
    s => { s.cells[0].authorityGrant = "YES"; },
    s => { s.cells[0].claim = "Invented semantics with an unrelated retained locator."; },
    s => { s.cells[0].claim = "normalized party/customer concept"; },
    s => { s.cells.find(c => c.state === "ABSENT").counterexamples = []; },
  ];
  for (const mutate of cases) {
    const dir = await mkdtemp(join(tmpdir(), "cscl02-"));
    const altered = structuredClone(specs); mutate(altered);
    const path = join(dir, "specs.json"); await writeFile(path, JSON.stringify(altered));
    await assert.rejects(() => buildOfflineProfile({ repoRoot: ROOT, bundlePath: BUNDLE, specsPath: path }), /DENIED|MISSING|LOCATOR|FIELD|TERMINOLOGY|NEGATIVE/);
  }
});
