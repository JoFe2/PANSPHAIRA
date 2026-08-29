import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  canonicalCcpTestCacheReceiptJsonV1,
  evaluateCcpTestCacheV1,
  parseCcpTestCacheReceiptV1,
  verifyCcpTestCacheReceiptV1,
  CCP_TEST_CACHE_RECEIPT_SCHEMA_V1,
} from "../packages/contracts/src/ccp-test-cache.js";
import { ccpDigestDomainV1 } from "../packages/contracts/src/ccp-event-envelope.js";

interface CacheFixture {
  cache: { request: unknown; context: unknown };
}

const fixture = (): CacheFixture => JSON.parse(
  readFileSync("tests/fixtures/ccp-runner/isolated-success.json", "utf8"),
);

function rehashReceipt(record: Record<string, unknown>): void {
  const { receiptDigest: _old, ...unsigned } = record;
  record.receiptDigest = ccpDigestDomainV1(CCP_TEST_CACHE_RECEIPT_SCHEMA_V1, unsigned);
}

test("CCP-PSAI52-RUNNER-004 cache eligibility is deterministic and content addressed", () => {
  const input = fixture();
  const first = evaluateCcpTestCacheV1(input.cache.request, input.cache.context);
  const second = evaluateCcpTestCacheV1(
    JSON.parse(JSON.stringify(input.cache.request)),
    JSON.parse(JSON.stringify(input.cache.context)),
  );

  assert.equal(canonicalCcpTestCacheReceiptJsonV1(first), canonicalCcpTestCacheReceiptJsonV1(second));
  assert.equal(first.disposition, "CACHE_HIT");
  assert.equal(first.reasonCode, "CACHE_HIT_CONTENT_ADDRESSED");
  assert.equal(first.cacheKeyDigest.length, 64);
  assert.equal(first.entry?.testOutcome, "PASS");
  assert.equal(first.entry?.cleanupOutcome, "ZERO_RESIDUE");
  assert.deepEqual(first.eligibility, {
    cacheEligible: true,
    executionAuthorized: false,
    mergeAuthorized: false,
  });
  assert.equal(Object.isFrozen(first.context), true);
  assert.equal(Object.isFrozen(first.entry), true);
  assert.notEqual(verifyCcpTestCacheReceiptV1(first), null);
});

test("CCP-PSAI52-RUNNER-005 cache never crosses identity or runner-profile partitions", () => {
  const input = fixture();
  const foreign = evaluateCcpTestCacheV1(
    { ...(input.cache.request as Record<string, unknown>), tenantId: "tenant:other" },
    input.cache.context,
  );
  assert.equal(foreign.disposition, "CACHE_MISS");
  assert.equal(foreign.reasonCode, "CACHE_MISS_NAMESPACE_ISOLATED");
  assert.equal(foreign.entry, null);
  assert.equal(foreign.eligibility.cacheEligible, false);

  const profile = JSON.parse(JSON.stringify(input.cache.request)) as Record<string, unknown>;
  (profile.cacheKey as Record<string, unknown>).runnerProfileDigest = "9999999999999999999999999999999999999999999999999999999999999999";
  const profileMiss = evaluateCcpTestCacheV1(profile, input.cache.context);
  assert.equal(profileMiss.disposition, "CACHE_MISS");
  assert.equal(profileMiss.reasonCode, "CACHE_MISS_PROFILE_MISMATCH");
  assert.equal(profileMiss.entry, null);
});

test("CCP-PSAI52-RUNNER-006 failed tests, residue and forged hits are ineligible", () => {
  const input = fixture();
  const context = JSON.parse(JSON.stringify(input.cache.context)) as Record<string, unknown>;
  const entries = context.entries as Record<string, unknown>[];
  const localEntry = entries[0];
  assert.ok(localEntry);
  localEntry.cleanupOutcome = "RESIDUE_DETECTED";
  const residue = evaluateCcpTestCacheV1(input.cache.request, context);
  assert.equal(residue.disposition, "INELIGIBLE");
  assert.equal(residue.reasonCode, "CACHE_ENTRY_CLEANUP_RESIDUE");
  assert.equal(residue.eligibility.cacheEligible, false);

  const receipt = evaluateCcpTestCacheV1(input.cache.request, input.cache.context);
  const forged = JSON.parse(JSON.stringify(receipt)) as Record<string, unknown>;
  (forged.eligibility as Record<string, unknown>).cacheEligible = false;
  rehashReceipt(forged);
  assert.equal(verifyCcpTestCacheReceiptV1(forged), null);
  assert.throws(() => parseCcpTestCacheReceiptV1({ ...forged, unexpected: true }), /CCP_TEST_CACHE_RECEIPT_SCHEMA_DENIED/);
});
