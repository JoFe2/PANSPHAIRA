import assert from "node:assert/strict";
import { execFile as execFileCallback } from "node:child_process";
import { cp, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { promisify } from "node:util";
import { tmpdir } from "node:os";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import Ajv2020 from "ajv/dist/2020.js";
import addFormats from "ajv-formats";

import {
  CAPTURE_BYTE_CAP,
  buildErpnextProfile,
  captureErpnextSources,
  canonicalJson,
  verifyErpnextProfileBundle,
} from "../../src/cscl-03/profile-builder.mjs";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const fixtureRoot = resolve(repoRoot, "tests/fixtures/cscl-03");
const execFile = promisify(execFileCallback);
const boundary = { authorityGrant: "NONE", promotionGrant: "NONE", executionGrant: "NONE" };

async function schemas() {
  const ajv = new Ajv2020({ allErrors: true, strict: true, allowUnionTypes: true });
  addFormats(ajv);
  return Object.fromEntries(await Promise.all([
    ["fact", "contracts/cscl-01/source-fact-v1.schema.json"],
    ["cell", "contracts/cscl-01/evidence-cell-v1.schema.json"],
    ["profile", "contracts/cscl-01/system-profile-v1.schema.json"],
  ].map(async ([name, path]) => [name, ajv.compile(JSON.parse(await readFile(resolve(repoRoot, path), "utf8")))])));
}

test("offline build emits exactly 36 source-native ERPNext cells and schema-valid records", async () => {
  const first = await buildErpnextProfile({ repoRoot, fixtureRoot });
  const second = await buildErpnextProfile({ repoRoot, fixtureRoot });
  assert.equal(first.bytes.equals(second.bytes), true);
  assert.equal(first.digest, second.digest);
  assert.equal(first.bundle.sourceFacts.length, 36);
  assert.equal(first.bundle.evidenceCells.length, 36);
  assert.equal(first.bundle.systemProfile.evidenceCells.length, 36);
  assert.deepEqual(first.bundle.systemProfile.capabilityFamilies, [
    "PARTY_CUSTOMER_MANAGEMENT", "PRODUCT_ITEM_MANAGEMENT", "SALES_ORDER_MANAGEMENT",
  ]);
  assert.equal(first.bundle.systemProfile.systemId, "erpnext");
  assert.equal(first.bundle.systemProfile.systemRole, "TRAINING");
  assert.equal(first.bundle.systemProfile.holdoutIsolation, "TRAINING_PROFILE");
  assert.deepEqual(first.bundle.systemProfile.boundary, boundary);
  assert.ok(first.bundle.evidenceCells.every((cell) => cell.systemId === "erpnext"));
  assert.ok(first.bundle.evidenceCells.some((cell) => cell.state === "AMBIGUOUS"));
  assert.doesNotMatch(canonicalJson(first.bundle), /commonCore|normalizedVocabulary|Authority|idempiere|odoo-community|dolibarr|tryton|apache-ofbiz/);

  const validate = await schemas();
  for (const fact of first.bundle.sourceFacts) assert.equal(validate.fact(fact), true, JSON.stringify(validate.fact.errors));
  for (const cell of first.bundle.evidenceCells) assert.equal(validate.cell(cell), true, JSON.stringify(validate.cell.errors));
  assert.equal(validate.profile(first.bundle.systemProfile), true, JSON.stringify(validate.profile.errors));
});

test("bundle verifier recomputes all digests, locators, paired references, denominators and frozen protocol bindings", async () => {
  const built = await buildErpnextProfile({ repoRoot, fixtureRoot });
  assert.deepEqual(await verifyErpnextProfileBundle(built.bundle, { repoRoot, fixtureRoot }), {
    outcome: "VERIFIED",
    reasonCodes: ["ERPNext_V16_33_0_SOURCE_NATIVE_PROFILE_VERIFIED"],
    bundleDigest: built.digest,
  });

  const mutations = [
    ["invented fact", (x) => { x.sourceFacts[0].claim += " invented"; }, "FACT_DIGEST_MISMATCH"],
    ["paired redigestion", (x) => { x.sourceFacts[0].claim += " redigested"; x.sourceFacts[0].factDigest = x.sourceFacts[1].factDigest; }, "FACT_DIGEST_MISMATCH"],
    ["omitted cell", (x) => { x.evidenceCells.pop(); }, "CELL_DENOMINATOR_MISMATCH"],
    ["extra authority", (x) => { x.systemProfile.Authority = "WRITE"; }, "SCHEMA_INVALID"],
    ["normalized vocabulary", (x) => { x.systemProfile.sourceNativeTerminology[0].term = "generic party"; }, "SOURCE_NATIVE_TERMINOLOGY_DRIFT"],
  ];
  for (const [label, mutate, reason] of mutations) {
    const changed = structuredClone(built.bundle);
    mutate(changed);
    const result = await verifyErpnextProfileBundle(changed, { repoRoot, fixtureRoot });
    assert.equal(result.outcome, "DENIED", label);
    assert.ok(result.reasonCodes.includes(reason), `${label}: ${result.reasonCodes}`);
  }
});

test("capture is network-denied by default and fail-closes on identity, path, legal, parser, bytes and Base64 drift", async () => {
  await assert.rejects(() => captureErpnextSources({ repoRoot, fixtureRoot }), /EXPLICIT_NETWORK_CAPTURE_REQUIRED/);
  const original = JSON.parse(await readFile(resolve(fixtureRoot, "source-capture-manifest-v1.json"), "utf8"));
  assert.equal(original.identity.commit, "b24c9eba551905e256e336ff170a91a92d197a2f");
  assert.equal(original.identity.version, "v16.33.0");
  assert.equal(original.legal.licenseId, "GPL-3.0-only");
  assert.ok(original.totalDecodedBytes <= CAPTURE_BYTE_CAP);
  assert.ok(original.sources.every((source) => source.url.startsWith(`https://raw.githubusercontent.com/frappe/erpnext/${original.identity.commit}/`)));

  const cases = [
    ["mutable identity", (x) => { x.sources[0].url = "https://raw.githubusercontent.com/frappe/erpnext/v16.33.0/license.txt"; }, "IMMUTABLE_SOURCE_URL_REQUIRED"],
    ["path substitution", (x) => { x.sources[0].path = "COPYING"; }, "SOURCE_PATH_SET_DRIFT"],
    ["mirror substitution", (x) => { x.sources[0].url = x.sources[0].url.replace("raw.githubusercontent.com", "example.invalid"); }, "IMMUTABLE_SOURCE_URL_REQUIRED"],
    ["legal drift", (x) => { x.legal.licenseId = "MIT"; }, "LEGAL_IDENTITY_DRIFT"],
    ["parser drift", (x) => { x.parser.version = "2.0.0"; }, "PARSER_IDENTITY_DRIFT"],
    ["raw length drift", (x) => { x.sources[0].byteLength += 1; }, "SOURCE_BYTES_MISMATCH"],
    ["raw digest drift", (x) => { x.sources[0].sha256 = "0".repeat(64); }, "SOURCE_BYTES_MISMATCH"],
  ];
  for (const [label, mutate, reason] of cases) {
    const temp = await mkdtemp(resolve(tmpdir(), "cscl03-"));
    try {
      await cp(fixtureRoot, temp, { recursive: true });
      const manifestPath = resolve(temp, "source-capture-manifest-v1.json");
      const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
      mutate(manifest);
      await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
      await assert.rejects(() => buildErpnextProfile({ repoRoot, fixtureRoot: temp }), new RegExp(reason), label);
    } finally {
      await rm(temp, { recursive: true, force: true });
    }
  }

  const temp = await mkdtemp(resolve(tmpdir(), "cscl03-b64-"));
  try {
    await cp(fixtureRoot, temp, { recursive: true });
    const source = original.sources[0];
    const snapshot = resolve(temp, source.snapshot);
    await writeFile(snapshot, `${(await readFile(snapshot, "utf8")).trim()}=\n`);
    await assert.rejects(() => buildErpnextProfile({ repoRoot, fixtureRoot: temp }), /NON_CANONICAL_BASE64|SOURCE_BYTES_MISMATCH/);
  } finally {
    await rm(temp, { recursive: true, force: true });
  }
});

test("offline CLI writes independently verifiable canonical artifacts and rejects implicit capture", async () => {
  const output = await mkdtemp(resolve(tmpdir(), "cscl03-output-"));
  try {
    const cli = resolve(repoRoot, "src/cscl-03/profile-cli.mjs");
    const built = await execFile(process.execPath, [cli, "build", "--repo-root", repoRoot, "--fixture-root", fixtureRoot, "--output-dir", output]);
    const receipt = JSON.parse(built.stdout);
    assert.equal(receipt.verification.outcome, "VERIFIED");
    assert.equal(receipt.counts.sourceFacts, 36);
    assert.equal(receipt.counts.evidenceCells, 36);
    for (const name of ["source-facts-v1.json", "evidence-cells-v1.json", "system-profile-v1.json", "build-receipt-v1.json"]) {
      assert.ok((await readFile(resolve(output, name))).length > 0, name);
    }
    await assert.rejects(
      () => execFile(process.execPath, [cli, "capture", "--repo-root", repoRoot, "--fixture-root", fixtureRoot]),
      /EXPLICIT_NETWORK_CAPTURE_REQUIRED/,
    );
  } finally {
    await rm(output, { recursive: true, force: true });
  }
});
