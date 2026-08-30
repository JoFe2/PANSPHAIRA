import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../../", import.meta.url);
const readJson = async (path) => JSON.parse(await readFile(new URL(path, root), "utf8"));

const expected = new Map([
  [281, [297, "232895603e00b353e9584266e0da00e4329a3574", "2026_08_29_v4", "PROVED"]],
  [282, [301, "83dd285cf4ba29c9ece7ad272870af2222f1a883", "2026_08_30_v4", "PROVED"]],
  [283, [302, "6d6d823ac70c28772d5a4b1c2922f5a0ad6a44da", "2026_08_30_v5", "PROVED"]],
  [284, [303, "f08d20ff3078e384183909d9d46378f3e32acc59", "2026_08_30_v6", "PROVED"]],
  [285, [304, "a7845839e0aaffd6b2f9a6f5867f5af1d6a51c4f", "2026_08_30_v7", "FALSIFIED_EARLY_STOP"]],
  [286, [294, "787393667a8b0b194a517cfad88119868e1f73b0", "2026_08_29_v1", "PROVED"]],
  [287, [305, "27060c6a9c1fa51424b350046420cb041db3969c", "2026_08_30_v8", "PROVED"]],
  [288, [306, "f19facc96129c9d19ff0de63a08c00d35ce8b8af", "2026_08_30_v9", "PROVED"]],
  [289, [307, "c57d2cf2e06fd930a163241e28cd0f9d9952fec5", "2026_08_30_v10", "PROVED"]],
  [290, [308, "5afea09dd5186592278b952626b2cdf5c3c0df85", "2026_08_30_v11", "PROVED"]],
  [291, [309, "46a65171c2bfb8e252e6455080eacc818afa1061", "2026_08_30_v12", "PROVED"]],
  [292, [310, "e836f36cf90099fea9f74b0a17a2f2a9bedee635", "2026_08_30_v13", "PROVED"]],
]);

test("CKS-M1 parent binds every terminal child to exact public delivery receipts", async () => {
  const receipt = await readJson("docs/architecture/cks-m1/criterion-traceability-v1.json");
  assert.equal(receipt.schemaVersion, "pansphaira.cks/parent-criterion-traceability/v1");
  assert.equal(receipt.parentIssue, 280);
  assert.equal(receipt.children.length, expected.size);
  assert.equal(receipt.terminalDecision, "CORE_SYNTHETIC_PROOF_CLOSED_REAL_SOURCE_PROOF_SEPARATELY_GATED");
  for (const child of receipt.children) {
    const binding = expected.get(child.issue);
    assert.ok(binding, `unexpected child #${child.issue}`);
    assert.deepEqual([child.pr, child.mergeSha, child.release, child.outcome], binding);
    assert.equal(child.issueState, "CLOSED");
    assert.equal(child.prCi, "PASS");
    assert.equal(child.mainCi, "PASS");
    assert.equal(child.anonymousReadback, "PASS");
  }
});

test("CKS-M1 closure retains authority and real-source nonclaims", async () => {
  const receipt = await readJson("docs/architecture/cks-m1/criterion-traceability-v1.json");
  assert.deepEqual(receipt.nonClaims, [
    "NO_GENERAL_SMALL_MODEL_REPLACEMENT",
    "NO_PRODUCTION_MODEL_ACTIVATION",
    "NO_FINE_TUNING_CLAIM",
    "NO_AUTONOMOUS_KNOWLEDGE_PROMOTION",
    "NO_CAPABILITY_OR_AUTHORITY_FROM_KNOWLEDGE",
    "NO_REAL_SOURCE_UTILITY_CLAIM_FROM_SYNTHETIC_PROOF",
  ]);
  assert.equal(receipt.realSourceFollowOn.issue, 311);
  assert.equal(receipt.realSourceFollowOn.admissionState, "BLOCKED_UNTIL_PARENT_RELEASE_READBACK");
});
