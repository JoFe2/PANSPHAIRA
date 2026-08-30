import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  ASF_COMPATIBILITY_FENCE_EXIT_CODES_V1,
  ASF_COMPATIBILITY_FENCE_QUERY_SCHEMA_V1,
  parseAsfCompatibilityMatrixV1,
  resolveAsfCompatibilityFenceV1,
  validateAsfCompatibilityMatrixReceiptV1,
  verifyAsfCompatibilityMatrixV1,
  type AsfCompatibilityMatrixDocumentV1,
  type AsfCompatibilityRowV1,
  type AsfFenceReasonCodeV1,
} from "../packages/contracts/src/asf-compatibility-fence.js";
import { canonicalJson } from "../packages/contracts/src/canonical-json.js";

const fixtureRoot = "tests/fixtures/asf-compatibility";
const matrixRaw = readFileSync(`${fixtureRoot}/matrix.json`, "utf8");
const incompatibleRaw = readFileSync(`${fixtureRoot}/incompatible.json`, "utf8");
const matrix = JSON.parse(matrixRaw) as AsfCompatibilityMatrixDocumentV1;

function denied(result: { readonly outcome: string; readonly reasonCodes: readonly [AsfFenceReasonCodeV1]; readonly exitCode: number }, reason: AsfFenceReasonCodeV1): void {
  assert.deepEqual(result, {
    outcome: "DENIED",
    reasonCodes: [reason],
    exitCode: ASF_COMPATIBILITY_FENCE_EXIT_CODES_V1[reason],
  });
}

function compatibleRow(): AsfCompatibilityRowV1 {
  const row = matrix.rows.find((candidate) => candidate.verdict === "COMPATIBLE");
  if (row === undefined) throw new Error("fixture has no compatible row");
  return row;
}

function queryFor(row: AsfCompatibilityRowV1): Record<string, string> {
  return {
    adapterId: row.adapterId,
    adapterVersion: row.adapterVersion,
    catalogDigest: row.catalogDigest,
    generationDigest: row.generationDigest,
    lockDigest: row.lockDigest,
    packDigest: row.packDigest,
    packId: row.packId,
    profileId: row.profileId,
    profileVersion: row.profileVersion,
    routeId: row.routeId,
    routeVersion: row.routeVersion,
    skillId: row.skillId,
    version: row.version,
  };
}

test("accepts the canonical compatibility matrix and resolves one stable explicit tuple", () => {
  const parsed = parseAsfCompatibilityMatrixV1(matrixRaw);
  assert.equal(parsed.outcome, "ACCEPTED");
  if (parsed.outcome !== "ACCEPTED") return;
  assert.equal(parsed.canonicalJson, matrixRaw);
  assert.equal(parsed.matrixDigest, matrix.matrixDigest);
  assert.equal(parsed.receiptJson, canonicalJson(parsed.receipt));
  assert.equal(validateAsfCompatibilityMatrixReceiptV1(parsed.receipt), true);
  assert.equal(parsed.receipt.matrixDigest, matrix.matrixDigest);
  assert.equal(parsed.receipt.catalogDigest, matrix.catalogue.catalogDigest);
  assert.equal(parsed.receipt.rows, 2);
  assert.equal(parsed.receipt.compatibleRows, 1);
  assert.equal(parsed.receipt.incompatibleRows, 1);

  const first = resolveAsfCompatibilityFenceV1(matrix, {
    ...queryFor(compatibleRow()),
    schemaVersion: ASF_COMPATIBILITY_FENCE_QUERY_SCHEMA_V1,
  });
  const second = resolveAsfCompatibilityFenceV1(matrix, {
    ...queryFor(compatibleRow()),
    schemaVersion: ASF_COMPATIBILITY_FENCE_QUERY_SCHEMA_V1,
  });
  assert.deepEqual(first, second);
  assert.equal(first.outcome, "ACCEPTED");
  if (first.outcome !== "ACCEPTED") return;
  assert.equal(first.result, "COMPATIBLE");
  assert.equal(first.matrixDigest, parsed.matrixDigest);
  assert.equal(first.receiptDigest, parsed.receiptDigest);
  assert.equal(first.row.verdict, "COMPATIBLE");
  assert.equal(first.row.capabilityScope, "EXPLICIT");
});

test("keeps the incompatible decision finite and scope-local", () => {
  const incompatible = parseAsfCompatibilityMatrixV1(incompatibleRaw);
  assert.equal(incompatible.outcome, "ACCEPTED");
  if (incompatible.outcome !== "ACCEPTED") return;
  const row = incompatible.projection;
  assert.equal(row.compatibleRows, 0);
  assert.equal(row.incompatibleRows, 1);
  const deniedResolution = resolveAsfCompatibilityFenceV1(JSON.parse(incompatibleRaw), {
    ...queryFor((JSON.parse(incompatibleRaw) as AsfCompatibilityMatrixDocumentV1).rows[0]!),
    schemaVersion: ASF_COMPATIBILITY_FENCE_QUERY_SCHEMA_V1,
  });
  denied(deniedResolution, "INCOMPATIBLE_TUPLE_DENIED");
});

test("rejects unknown, wildcard, mutable, stale, and broad claims before projection", () => {
  const unknown = { ...queryFor(compatibleRow()), profileId: "profile:missing-target" };
  denied(resolveAsfCompatibilityFenceV1(matrix, {
    ...unknown,
    schemaVersion: ASF_COMPATIBILITY_FENCE_QUERY_SCHEMA_V1,
  }), "UNKNOWN_TARGET_DENIED");

  const wildcard = { ...queryFor(compatibleRow()), routeId: "route:*" };
  denied(resolveAsfCompatibilityFenceV1(matrix, {
    ...wildcard,
    schemaVersion: ASF_COMPATIBILITY_FENCE_QUERY_SCHEMA_V1,
  }), "UNKNOWN_TARGET_DENIED");

  const range = { ...queryFor(compatibleRow()), version: "latest" };
  denied(resolveAsfCompatibilityFenceV1(matrix, {
    ...range,
    schemaVersion: ASF_COMPATIBILITY_FENCE_QUERY_SCHEMA_V1,
  }), "MUTABLE_ALIAS_OR_RANGE_DENIED");

  const stale = structuredClone(matrix) as Record<string, any>;
  stale.rows[0].catalogDigest = "0".repeat(64);
  denied(verifyAsfCompatibilityMatrixV1(stale), "STALE_CATALOGUE_DENIED");

  const broad = structuredClone(matrix) as Record<string, any>;
  broad.rows[0].capabilityScope = "ALL";
  denied(verifyAsfCompatibilityMatrixV1(broad), "BROAD_CAPABILITY_DENIED");

  const incompatibleTuple = { ...queryFor(matrix.rows[0]!), profileId: "profile:does-not-exist" };
  denied(resolveAsfCompatibilityFenceV1(matrix, {
    ...incompatibleTuple,
    schemaVersion: ASF_COMPATIBILITY_FENCE_QUERY_SCHEMA_V1,
  }), "UNKNOWN_TARGET_DENIED");
});

test("duplicate keys, unsupported schema, and invalid JSON are evidence-safe denials", () => {
  denied(parseAsfCompatibilityMatrixV1("{not json"), "INVALID_JSON_DENIED");
  denied(parseAsfCompatibilityMatrixV1(matrixRaw.replace(
    '"matrixId":"asffence:qwen.synthetic",',
    '"matrixId":"asffence:qwen.synthetic","matrixId":"asffence:qwen.synthetic",',
  )), "DUPLICATE_KEY_DENIED");
  denied(verifyAsfCompatibilityMatrixV1({ ...matrix, schemaVersion: "chimpmaera.asf/compatibility-fence/v0" }), "UNSUPPORTED_VERSION_DENIED");
  assert.equal(JSON.stringify(matrix), JSON.stringify(JSON.parse(matrixRaw)));
});
