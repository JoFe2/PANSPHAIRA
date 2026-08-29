import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  ASF_ASSIGNMENT_EXIT_CODES_V1,
  ASF_ASSIGNMENT_LKG_MODE_V1,
  applyAsfAssignmentV1,
  asfAssignmentReceiptDigestV1,
  parseAsfAssignmentV1,
  validateAsfAssignmentReceiptV1,
  type AsfAssignmentInputV1,
  type AsfAssignmentReasonCodeV1,
  type AsfAssignmentRecordV1,
} from "../packages/contracts/src/asf-assignment.js";
import {
  type AsfBundleLockDocumentV1,
} from "../packages/contracts/src/asf-bundle-lock.js";
import {
  type AsfCompatibilityMatrixDocumentV1,
  type AsfCompatibilityRowV1,
} from "../packages/contracts/src/asf-compatibility-fence.js";
import { canonicalJson } from "../packages/contracts/src/canonical-json.js";

const lock = JSON.parse(readFileSync("tests/fixtures/asf-bundle-lock/valid.json", "utf8")) as AsfBundleLockDocumentV1;
const matrix = JSON.parse(readFileSync("tests/fixtures/asf-compatibility/matrix.json", "utf8")) as AsfCompatibilityMatrixDocumentV1;

function recordFor(row: AsfCompatibilityRowV1, state: "DISABLED" | "ENABLED" = "ENABLED"): AsfAssignmentRecordV1 {
  const { verdict: _verdict, ...tuple } = row;
  return { ...tuple, state };
}

function inputFor(assignments: readonly AsfAssignmentRecordV1[] = matrix.rows.map((row) => recordFor(row))): AsfAssignmentInputV1 {
  return {
    assignments,
    generation: {
      capabilityIds: lock.capabilityPack.references.map((reference) => reference.capabilityId),
      generationDigest: lock.lock.generationDigest,
      lockDigest: lock.lock.lockIdentity,
      skillId: lock.generation.skillId,
      version: lock.generation.version,
    },
    lkg: {
      lkgLockIdentity: lock.lock.rollback.lkgLockIdentity,
      mode: ASF_ASSIGNMENT_LKG_MODE_V1,
    },
    lock,
    matrix,
    schemaVersion: "chimpmaera.asf/assignment/v1",
  };
}

function denied(result: { readonly outcome: string; readonly reasonCodes: readonly [AsfAssignmentReasonCodeV1]; readonly exitCode: number }, reason: AsfAssignmentReasonCodeV1): void {
  assert.deepEqual(result, {
    outcome: "DENIED",
    reasonCodes: [reason],
    exitCode: ASF_ASSIGNMENT_EXIT_CODES_V1[reason],
  });
}

test("accepts finite explicit assignments and disables only the incompatible scope", () => {
  const input = inputFor();
  const result = applyAsfAssignmentV1(input);
  assert.equal(result.outcome, "ACCEPTED");
  if (result.outcome !== "ACCEPTED") return;
  assert.deepEqual(result.reasonCodes, ["ASF_ASSIGNMENT_ACCEPTED"]);
  assert.equal(result.receipt.matrixDigest, matrix.matrixDigest);
  assert.equal(result.receipt.lockIdentity, lock.lock.lockIdentity);
  assert.equal(result.receipt.lkgLockIdentity, lock.lock.rollback.lkgLockIdentity);
  assert.equal(result.receipt.disabledTransitions, 1);
  assert.equal(result.receipt.enabledAssignments, 1);
  assert.equal(validateAsfAssignmentReceiptV1(result.receipt), true);
  assert.equal(result.receiptJson, canonicalJson(result.receipt));
  assert.equal(result.receiptDigest, asfAssignmentReceiptDigestV1(result.receipt));

  const safeBefore = input.assignments.find((assignment) => assignment.profileId === "profile:qwen.safe");
  const safeAfter = result.projection.assignments.find((assignment) => assignment.profileId === "profile:qwen.safe");
  const blockedAfter = result.projection.assignments.find((assignment) => assignment.profileId === "profile:qwen.blocked");
  assert.deepEqual(safeAfter, safeBefore);
  assert.equal(blockedAfter?.state, "DISABLED");
  assert.deepEqual(result.projection.disableTransitions.map((transition) => transition.profileId), ["profile:qwen.blocked"]);
  assert.equal(result.projection.assignments.length, input.assignments.length);
});

test("a canonical assignment receipt is stable and the LKG binding is mandatory", () => {
  const input = inputFor([recordFor(matrix.rows.find((row) => row.verdict === "COMPATIBLE")!)]);
  const raw = canonicalJson(input);
  const first = parseAsfAssignmentV1(raw);
  const second = parseAsfAssignmentV1(raw);
  assert.deepEqual(first, second);
  assert.equal(first.outcome, "ACCEPTED");

  const missing = structuredClone(input) as Record<string, any>;
  delete missing.lkg;
  denied(applyAsfAssignmentV1(missing), "LKG_MISSING_DENIED");

  const nullLkg = structuredClone(input) as Record<string, any>;
  nullLkg.lkg = null;
  denied(applyAsfAssignmentV1(nullLkg), "LKG_MISSING_DENIED");
});

test("fails closed for mutable, stale, duplicate, broad, and unbound assignment claims", () => {
  const range = structuredClone(inputFor()) as Record<string, any>;
  range.assignments[0].version = "latest";
  denied(applyAsfAssignmentV1(range), "MUTABLE_ALIAS_OR_RANGE_DENIED");

  const wildcard = structuredClone(inputFor()) as Record<string, any>;
  wildcard.assignments[0].profileId = "profile:*";
  denied(applyAsfAssignmentV1(wildcard), "UNKNOWN_TARGET_DENIED");

  const stale = structuredClone(inputFor()) as Record<string, any>;
  stale.assignments[0].catalogDigest = "0".repeat(64);
  denied(applyAsfAssignmentV1(stale), "STALE_CATALOGUE_DENIED");

  const duplicate = structuredClone(inputFor()) as Record<string, any>;
  duplicate.assignments.push({ ...duplicate.assignments[0], state: "DISABLED" });
  denied(applyAsfAssignmentV1(duplicate), "DUPLICATE_ASSIGNMENT_DENIED");

  const broad = structuredClone(inputFor()) as Record<string, any>;
  broad.assignments[0].capabilityScope = "ALL";
  denied(applyAsfAssignmentV1(broad), "BROAD_CAPABILITY_DENIED");

  const unboundGeneration = structuredClone(inputFor()) as Record<string, any>;
  unboundGeneration.generation.generationDigest = "0".repeat(64);
  denied(applyAsfAssignmentV1(unboundGeneration), "DIGEST_MISMATCH_DENIED");
});

test("rejects an unknown explicit tuple instead of silently accepting a disabled record", () => {
  const unknown = structuredClone(inputFor()) as Record<string, any>;
  unknown.assignments[0].profileId = "profile:unlisted";
  unknown.assignments[0].state = "DISABLED";
  denied(applyAsfAssignmentV1(unknown), "INCOMPATIBLE_TUPLE_DENIED");
});
