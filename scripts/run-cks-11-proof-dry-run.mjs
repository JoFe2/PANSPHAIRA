import { readFileSync } from "node:fs";
import { strict as assert } from "node:assert";

const root = new URL("../", import.meta.url);
const load = (path) => JSON.parse(readFileSync(new URL(path, root), "utf8"));
export function verifyOfflineProofDryRunV1({ promote = false } = {}) {
  const manifest = load("tests/fixtures/cks-11/offline-proof-manifest-v1.json");
  const receipt = load("verification/cks-11-offline-proof-receipt-v1.json");
  assert.equal(manifest.schemaVersion, "pansphaira.cks-11/offline-proof-manifest/v1");
  assert.equal(manifest.evidenceScope, "LOCAL_SYNTHETIC_DRY_RUN_ONLY"); assert.equal(manifest.promotionState, "DENIED");
  assert.deepEqual(manifest.prohibitedOutcomes, ["PROMOTION", "ACTIVATION", "MERGE", "RELEASE", "PUBLIC_MAIN_ASSERTION"]);
  assert.equal(receipt.schemaVersion, "pansphaira.cks-11/offline-proof-receipt/v1"); assert.equal(receipt.evidenceScope, manifest.evidenceScope); assert.equal(receipt.outcome, "PASS_WITH_PROMOTION_DENIED"); assert.equal(receipt.promotionState, "DENIED");
  if (promote) throw new Error("LOCAL_SYNTHETIC_DRY_RUN_CANNOT_PROMOTE");
  return { outcome: receipt.outcome, promotionState: receipt.promotionState, evidenceScope: receipt.evidenceScope };
}
try { console.log(JSON.stringify(verifyOfflineProofDryRunV1({ promote: process.argv.includes("--promote") }))); } catch (error) { console.error(error instanceof Error ? error.message : "OFFLINE_PROOF_DENIED"); process.exitCode = 171; }
