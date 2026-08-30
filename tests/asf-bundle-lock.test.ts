import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  ASF_BUNDLE_LOCK_EXIT_CODES_V1,
  ASF_BUNDLE_LOCK_SCHEMA_V1,
  canonicalizeAsfBundleLockV1,
  parseAsfBundleLockV1,
  verifyAsfBundleLockV1,
  type AsfBundleLockCoreInputV1,
  type AsfBundleLockDocumentV1,
  type AsfBundleLockReasonCodeV1,
} from "../packages/contracts/src/asf-bundle-lock.js";
import { canonicalJson } from "../packages/contracts/src/canonical-json.js";
import {
  asfBundleLockIntegrationReceiptDigestV1,
  validateAsfBundleLockIntegrationReceiptV1,
} from "../packages/contracts/src/index.js";

const fixtureRoot = "tests/fixtures/asf-bundle-lock";
const validRaw = readFileSync(`${fixtureRoot}/valid.json`, "utf8");
const validDocument = JSON.parse(validRaw) as AsfBundleLockDocumentV1;

function coreFromDocument(document: AsfBundleLockDocumentV1): AsfBundleLockCoreInputV1 {
  return {
    authority: document.authority,
    bundleId: document.bundleId,
    capabilityCatalogue: {
      catalogId: document.capabilityCatalogue.catalogId,
      entries: document.capabilityCatalogue.entries,
    },
    capabilityPack: {
      packId: document.capabilityPack.packId,
      references: document.capabilityPack.references.map(({ capabilityId, digest, version }) => ({
        capabilityId,
        digest,
        version,
      })),
    },
    generation: {
      content: document.generation.content,
      entrypoint: document.generation.entrypoint,
      format: document.generation.format,
      skillId: document.generation.skillId,
      source: document.generation.source,
      version: document.generation.version,
    },
    limitations: document.limitations,
  };
}

function reorder(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(reorder).reverse();
  if (value !== null && typeof value === "object" && Object.getPrototypeOf(value) === Object.prototype) {
    return Object.fromEntries(Object.entries(value).reverse().map(([key, entry]) => [key, reorder(entry)]));
  }
  return value;
}

function denied(raw: string, reason: AsfBundleLockReasonCodeV1): void {
  const result = parseAsfBundleLockV1(raw);
  assert.deepEqual(result, {
    outcome: "DENIED",
    reasonCodes: [reason],
    exitCode: ASF_BUNDLE_LOCK_EXIT_CODES_V1[reason],
  });
}

function jsonMutation(change: (draft: Record<string, any>) => void): string {
  const draft = structuredClone(validDocument) as Record<string, any>;
  change(draft);
  return JSON.stringify(draft);
}

test("accepts the complete immutable fixture and exposes only its declared digest projection", () => {
  const parsed = parseAsfBundleLockV1(validRaw);
  assert.equal(parsed.outcome, "ACCEPTED");
  if (parsed.outcome !== "ACCEPTED") throw new Error("expected accepted fixture");
  assert.equal(parsed.canonicalJson, validRaw);
  assert.equal(parsed.bundleDigest, validDocument.lock.bundleDigest);
  assert.equal(parsed.lockIdentity, validDocument.lock.lockIdentity);
  assert.equal(parsed.projection.contentDigest, validDocument.generation.contentDigest);
  assert.equal(parsed.projection.catalogDigest, validDocument.capabilityCatalogue.catalogDigest);
  assert.equal(parsed.projection.packDigest, validDocument.capabilityPack.packDigest);
  assert.equal(validateAsfBundleLockIntegrationReceiptV1(parsed.receipt), true);
  assert.equal(parsed.receiptJson, canonicalJson(parsed.receipt));
  assert.equal(parsed.receiptDigest, parsed.receipt.receiptDigest);
  assert.equal(parsed.receipt.generationDigest, validDocument.lock.generationDigest);
  assert.equal(parsed.receipt.lockIdentity, validDocument.lock.lockIdentity);
  assert.equal(parsed.receipt.rollback.lkgLockIdentity, validDocument.lock.rollback.lkgLockIdentity);
  const receiptCore: Record<string, unknown> = { ...parsed.receipt };
  delete receiptCore.receiptDigest;
  assert.equal(parsed.receipt.receiptDigest, asfBundleLockIntegrationReceiptDigestV1(receiptCore));
  assert.equal(validateAsfBundleLockIntegrationReceiptV1({
    ...parsed.receipt,
    packDigest: "0".repeat(64),
  }), false);
  assert.deepEqual(parsed.projection.capabilityIds, [
    "capability:documents.read",
    "capability:messages.send",
  ]);
  assert.deepEqual(Object.keys(parsed.projection).sort(), [
    "bundleDigest", "bundleId", "capabilityIds", "catalogDigest", "catalogId",
    "catalogueEntries", "contentDigest", "generationVersion", "lockIdentity", "packDigest",
    "packId", "packReferences", "skillId",
  ].sort());
  assert.equal(verifyAsfBundleLockV1(JSON.parse(validRaw)).outcome, "ACCEPTED");
});

test("equivalent reordered semantic inputs have identical canonical bytes and lock digest", () => {
  const core = coreFromDocument(validDocument);
  const baseline = canonicalizeAsfBundleLockV1(core);
  const reordered = canonicalizeAsfBundleLockV1(reorder(core) as AsfBundleLockCoreInputV1);
  assert.equal(baseline.outcome, "ACCEPTED");
  assert.equal(reordered.outcome, "ACCEPTED");
  if (baseline.outcome !== "ACCEPTED" || reordered.outcome !== "ACCEPTED") {
    throw new Error("expected both canonicalizations to be accepted");
  }
  assert.equal(baseline.canonicalJson, reordered.canonicalJson);
  assert.equal(baseline.bundleDigest, reordered.bundleDigest);
  assert.equal(baseline.lockIdentity, reordered.lockIdentity);
  assert.equal(baseline.canonicalJson, validRaw);
  assert.deepEqual(core, coreFromDocument(validDocument));
});

test("rejects noncanonical encoding and a tampered nested field before evidence projection", () => {
  denied(readFileSync(`${fixtureRoot}/noncanonical.json`, "utf8"), "NONCANONICAL_ENCODING_DENIED");
  denied(readFileSync(`${fixtureRoot}/tampered.json`, "utf8"), "DIGEST_MISMATCH_DENIED");
});

test("negative probes fail closed with stable evidence-safe reason codes and no mutation", () => {
  const before = JSON.stringify(validDocument);
  denied(validRaw.replace(
    '"bundleId":"asfbundle:qwen.synthetic",',
    '"bundleId":"asfbundle:qwen.synthetic","bundleId":"asfbundle:qwen.synthetic",',
  ), "DUPLICATE_KEY_DENIED");
  denied(jsonMutation((draft) => { draft.generation.source.mutable = true; }), "MUTABLE_ALIAS_OR_RANGE_DENIED");
  denied(jsonMutation((draft) => { draft.generation.version = "^1.0.0"; }), "MUTABLE_ALIAS_OR_RANGE_DENIED");
  denied(jsonMutation((draft) => {
    draft.capabilityPack.references[0].capabilityId = "capability:unknown";
  }), "UNKNOWN_CAPABILITY_DENIED");
  denied(jsonMutation((draft) => {
    delete draft.capabilityPack.references[0].catalogueBinding;
  }), "CATALOGUE_BINDING_MISSING_DENIED");
  denied(jsonMutation((draft) => { delete draft.authority; }), "AUTHORITY_FIELD_MISSING_DENIED");
  denied(jsonMutation((draft) => { draft.authority.activation = "AUTHORIZED"; }), "SCHEMA_DENIED");
  denied(jsonMutation((draft) => { draft.lock.rollback.lkgLockIdentity = "0".repeat(64); }), "DIGEST_MISMATCH_DENIED");
  denied(JSON.stringify({ ...validDocument, schemaVersion: `${ASF_BUNDLE_LOCK_SCHEMA_V1}/v2` }), "UNSUPPORTED_VERSION_DENIED");
  assert.equal(JSON.stringify(validDocument), before);
});

test("invalid semantic cores deny without throwing or mutating the caller", () => {
  const core = coreFromDocument(validDocument);
  const before = JSON.stringify(core);
  const result = canonicalizeAsfBundleLockV1({
    ...core,
    capabilityPack: {
      ...core.capabilityPack,
      references: [{ ...core.capabilityPack.references[0]!, digest: "0".repeat(64) }],
    },
  });
  assert.deepEqual(result, {
    outcome: "DENIED",
    reasonCodes: ["SCHEMA_DENIED"],
    exitCode: ASF_BUNDLE_LOCK_EXIT_CODES_V1.SCHEMA_DENIED,
  });
  assert.equal(JSON.stringify(core), before);
});
