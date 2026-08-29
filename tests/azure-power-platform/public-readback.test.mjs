import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  PUBLIC_FIELD_ALLOWLIST,
  PUBLIC_READBACK_SCHEMA,
  renderPublicReadback,
  validatePublicReadbackInput,
} from "../../tools/azure-power-platform/render-public-readback.mjs";

const safePath = "tests/fixtures/azure-power-platform/public-readback-safe.json";
const unsafePath = "tests/fixtures/azure-power-platform/public-readback-unsafe.json";
const toolPath = "tools/azure-power-platform/render-public-readback.mjs";
const readJson = async (file) => JSON.parse(await readFile(file, "utf8"));

const safe = await readJson(safePath);
const unsafe = await readJson(unsafePath);

test("renders only the allow-listed public-safe pins and explicit limitations", () => {
  assert.deepEqual(validatePublicReadbackInput(safe), {
    accepted: true,
    negativeResults: safe.negativeResults.map(({ case: caseName, reasonCode, outcome, effectCount }) => ({ case: caseName, reasonCode, outcome, effectCount })),
  });
  const rendered = renderPublicReadback(safe);
  assert.equal(rendered.status, "DRY_RUN_PUBLIC_SAFE");
  assert.equal(rendered.schemaVersion, PUBLIC_READBACK_SCHEMA);
  assert.equal(rendered.environmentClass, "LOCAL_SYNTHETIC_REPOSITORY_ONLY");
  assert.deepEqual(rendered.exactPins, {
    component: safe.component,
    schema: safe.schema,
    policy: safe.policy,
  });
  assert.deepEqual(rendered.limitations, safe.limitations);
  assert.equal(rendered.negativeResultSummary.count, 7);
  assert.equal(rendered.negativeResultSummary.allEffectFree, true);
  assert.deepEqual(rendered.rollbackTarget, {
    target: safe.rollback.target,
    targetTupleDigest: safe.rollback.targetTupleDigest,
    targetStatus: "LKG",
    targetRevocationStatus: "UNREVOKED",
    authorization: "OWNER_ONLY_REQUIRED",
  });
  assert.deepEqual(rendered.historicalMilestone.pullRequest, safe.historicalMilestone.pullRequest);
  assert.equal(rendered.historicalMilestone.implementationCommit.sha, "5c4558bf94695e0766891347fbfa5ff2696f9842");
  assert.equal(rendered.historicalMilestone.release.status, "RECONCILED_REPOSITORY_ONLY");
  assert.deepEqual(rendered.ownerReadbackPlaceholders.map((item) => item.name), ["planningPr", "ci", "merge", "releaseDecision", "release", "publicReadback"]);
  assert.ok(rendered.ownerReadbackPlaceholders.every((item) => item.status === "PENDING_OWNER_READBACK" && item.reference === null && item.digest === null && item.requiredOwnerReadback === true));
  assert.deepEqual(rendered.nonValidatedClaims, ["TENANT_VALIDATION", "RUNTIME_VALIDATION", "PRODUCTION_VALIDATION"]);
  assert.equal(rendered.redacted, true);
  assert.equal(Object.prototype.hasOwnProperty.call(rendered, "tenantId"), false);
});

test("unknown fields are denied rather than copied into the public projection", () => {
  const candidate = structuredClone(safe);
  candidate.unlistedField = "must not be projected";
  const result = renderPublicReadback(candidate);
  assert.deepEqual(result, { status: "REJECTED", reasonCode: "ALLOWLIST_FIELD_DENIED", redacted: true });
  assert.equal(PUBLIC_FIELD_ALLOWLIST.includes("unlistedField"), false);
});

test("unsafe fixture rejects identifiers, identities, credentials, paths, hosts, claims and payloads fail closed", () => {
  const result = renderPublicReadback(unsafe);
  assert.deepEqual(result, { status: "REJECTED", reasonCode: "ALLOWLIST_FIELD_DENIED", redacted: true });
  assert.equal(JSON.stringify(result).includes("tenant-synthetic"), false);
  assert.equal(JSON.stringify(result).includes("secret://"), false);
});

test("sensitive material is rejected even in an otherwise allow-listed field", () => {
  for (const [field, value] of [
    ["planningReference", "https://example.invalid/private-readback"],
    ["planningReference", "/tmp/private-readback.json"],
    ["planningReference", "docs/tenant/readback.md"],
  ]) {
    const candidate = structuredClone(safe);
    candidate.historicalMilestone[field] = value;
    const result = renderPublicReadback(candidate);
    assert.equal(result.status, "REJECTED");
    assert.equal(result.redacted, true);
  }
});

test("CLI dry runs are deterministic and support expected rejection", () => {
  const run = (fixture, ...args) => JSON.parse(execFileSync(process.execPath, [toolPath, "--dry-run", "--fixture", fixture, ...args], { encoding: "utf8" }));
  const first = run(safePath);
  const second = run(safePath);
  assert.deepEqual(first, second);
  assert.equal(first.status, "DRY_RUN_PUBLIC_SAFE");
  assert.deepEqual(run(unsafePath, "--expect-rejected"), { status: "REJECTED", reasonCode: "ALLOWLIST_FIELD_DENIED", redacted: true });
});
