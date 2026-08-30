import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

import {
  buildReadOnlyProjection,
  canonicalize,
  PROJECTION_BOUNDARY,
  PROJECTION_EXCLUDED_FIELDS,
  sha256,
} from "../../src/cks-10/read-only-projection-publisher.mjs";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const fixturePath = resolve(repoRoot, "tests/fixtures/cks-10/publisher-input-v1.json");

async function readFixture() {
  return JSON.parse(await readFile(fixturePath, "utf8"));
}

function projectionDigest(projection) {
  const withoutDigest = structuredClone(projection);
  delete withoutDigest.exchange.projectionDigest;
  return sha256(withoutDigest);
}

function assertDenied(input, expected) {
  assert.throws(() => buildReadOnlyProjection(input), new RegExp(`CKS10_PROJECTION_DENIED:[^:]+:${expected}`));
}

test("publisher builds a deterministic minimized projection and records source digests", async () => {
  const input = await readFixture();
  const before = canonicalize(input);
  const first = buildReadOnlyProjection(input);
  const second = buildReadOnlyProjection(input);

  assert.deepEqual(first, second);
  assert.equal(canonicalize(input), before);
  assert.equal(first.exchange.projectionDigest, projectionDigest(first));
  assert.deepEqual(first.boundary, PROJECTION_BOUNDARY);
  assert.deepEqual(first.excludedFields, PROJECTION_EXCLUDED_FIELDS);
  assert.deepEqual(new Set(first.records.map(({ recordClass }) => recordClass)), new Set(["TASK", "KNOWLEDGE", "DECISION", "OUTCOME"]));

  for (const [index, record] of first.records.entries()) {
    const source = record.sources[0];
    const snapshot = input.canonicalSnapshots[index];
    assert.equal(source.sourceRefId, snapshot.sourceRefId);
    assert.equal(source.assetDigest, snapshot.assetDigest);
    assert.equal(source.provenanceDigest, snapshot.provenanceDigest);
    assert.equal(record.fields.length, snapshot.fields.length);
    assert.deepEqual(Object.keys(record).sort(), [
      "assetClass", "assetDigest", "assetId", "assetVersion", "dataClassification",
      "evidenceClass", "fields", "recordClass", "recordId", "sources",
    ].sort());
  }

  const rendered = JSON.stringify(first);
  for (const forbidden of ["canonicalEvidence", "rawPrompt", "approvalToken", "rawRows", "sql", "effectPayload", "callback", "do-not-export"]) {
    assert.equal(rendered.includes(forbidden), false, `projection must not contain ${forbidden}`);
  }
});

test("removing or changing the returned projection cannot mutate canonical evidence", async () => {
  const input = await readFixture();
  const before = structuredClone(input);
  const projection = buildReadOnlyProjection(input);

  projection.records.pop();
  projection.records[0].fields.length = 0;
  projection.exchange.projectionDigest = "0".repeat(64);

  assert.deepEqual(input, before);
  assert.equal(input.canonicalSnapshots[0].canonicalEvidence.rawPrompt, "do not export this prompt");
  assert.equal(input.canonicalSnapshots[1].canonicalEvidence.rawRows[0].sensitiveMarker, "non-exportable-synthetic");
});

test("builder ignores rich canonical snapshot bodies but denies unknown projected fields", async () => {
  const input = await readFixture();
  const withBody = structuredClone(input);
  withBody.canonicalSnapshots[0].anotherCanonicalBody = { credentials: "must remain private" };
  assert.equal(buildReadOnlyProjection(withBody).records[0].fields[0].value, "OBSERVED");
  assert.deepEqual(input, await readFixture());

  const invalid = structuredClone(input);
  invalid.canonicalSnapshots[0].fields[0].fieldClass = "RAW_PROMPT";
  assertDenied(invalid, "UNSUPPORTED_FIELD_CLASS");
});

test("builder fails closed for forbidden fields, source drift, and out-of-scope edges", async () => {
  const forbidden = await readFixture();
  forbidden.canonicalSnapshots[0].fields[0].fieldId = "task.raw.prompt";
  assertDenied(forbidden, "EXCLUDED_FIELD");

  const authority = await readFixture();
  authority.canonicalSnapshots[0].fields[0].fieldId = "task.authority.class";
  assertDenied(authority, "EXCLUDED_FIELD");

  const sourceMismatch = await readFixture();
  sourceMismatch.canonicalSnapshots[0].fields[0].sourceRefId = "src-knowledge-290-0002";
  assertDenied(sourceMismatch, "SOURCE_REF_MISMATCH");

  const edgeMismatch = await readFixture();
  edgeMismatch.canonicalSnapshots[3].fields[1].value.target.assetDigest = "e".repeat(64);
  assertDenied(edgeMismatch, "RELATIONSHIP_TARGET_OUT_OF_SCOPE");
});

test("builder fails closed for missing bindings, malformed digests, and mutable policy input", async () => {
  const missing = await readFixture();
  delete missing.canonicalSnapshots[0].provenanceDigest;
  assertDenied(missing, "REQUIRED_FIELD");

  const malformed = await readFixture();
  malformed.canonicalSnapshots[0].assetDigest = "sha256:" + "a".repeat(64);
  assertDenied(malformed, "MALFORMED_STRING");

  const policy = await readFixture();
  policy.purpose.purposeClass = "MUTABLE_POLICY_STATE";
  assertDenied(policy, "UNSUPPORTED_PURPOSE");
});
