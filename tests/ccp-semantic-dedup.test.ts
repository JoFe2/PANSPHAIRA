import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { ccpDigestDomainV1 } from "../packages/contracts/src/ccp-event-envelope.js";
import {
  appendCcpIntakeDeliveryV1,
  createCcpIntakeLedgerV1,
  type CcpIntakeLedgerIdentityV1,
  type CcpIntakeLedgerV1,
} from "../packages/contracts/src/ccp-intake-ledger.js";
import {
  canonicalCcpSemanticDedupProjectionJsonV1,
  ccpSemanticDedupProjectionDigestV1,
  parseCcpSemanticDedupProjectionV1,
  projectCcpSemanticDedupV1,
  verifyCcpSemanticDedupProjectionV1,
  CCP_SEMANTIC_DEDUP_PROJECTION_SCHEMA_V1,
} from "../packages/contracts/src/ccp-semantic-dedup.js";

const digest = (character: string): string => character.repeat(64);

const fixture = (name: string): { identity: CcpIntakeLedgerIdentityV1; events: unknown[] } =>
  JSON.parse(readFileSync(`tests/fixtures/ccp-supersession/${name}.json`, "utf8"));

// Byte-stability bindings: digests of the projections produced by replaying
// the fixtures. Any drift in the projection bytes changes these values.
const FORCE_PUSH_LEDGER_DIGEST = "45918a29095e34d92a56d606a521fb0fa0ebfa32e1873483602d510db841a3a6";
const FORCE_PUSH_DEDUP_DIGEST = "a1ed7f8f576d79b6e3233205c3df14e592f7ed2c5362c399a6d198f0f2e49ed3";
const REORDERED_LEDGER_DIGEST = "ebfb34f18b48880baf873e3891beae107509ae01117473665e634225b6e40afe";
const REORDERED_DEDUP_DIGEST = "33fe709acda7abe48bcf31e3a24f081a84ad8310b4df616482f183a9c0c5e12c";
const EFFECT_A = "8bf3be140fd17c8383ee2600521cae046193a588802c4db78d9141f93b6e27b2";
const EFFECT_B = "9efd29305e404a3256dd16d5bafb924a58075434b5e2eca8dea0f1a7c1e52032";
const EFFECT_E = "8b339b9b412b72d971b3be63c129071c56a43ddebe30a07a0b1c05b131faf95f";

interface Replay {
  ledger: CcpIntakeLedgerV1;
  results: { disposition: string; reasonCode: string; appended: boolean }[];
}

/** Rebuild the ledger from a fixture by replaying every event through the closed append. */
function replay(name: string): Replay {
  const fx = fixture(name);
  let ledger = createCcpIntakeLedgerV1(fx.identity);
  const results = fx.events.map((event) => {
    const result = appendCcpIntakeDeliveryV1(ledger, event);
    ledger = result.ledger;
    return {
      disposition: result.receipt.disposition,
      reasonCode: result.receipt.reasonCode,
      appended: result.appended,
    };
  });
  return { ledger, results };
}

/** Rehash a forged dedup projection with its own domain; used only to build rehashed forgeries. */
function rehashDedup(record: Record<string, unknown>): void {
  const { dedupDigest: _dedupDigest, ...unsigned } = record;
  record.dedupDigest = ccpDigestDomainV1(CCP_SEMANTIC_DEDUP_PROJECTION_SCHEMA_V1, unsigned);
}

test("CCP-PSAI52-DEDUP-001 projection is deterministic and pure", () => {
  const first = projectCcpSemanticDedupV1(replay("force-push").ledger);
  const second = projectCcpSemanticDedupV1(replay("force-push").ledger);

  assert.equal(
    canonicalCcpSemanticDedupProjectionJsonV1(first),
    canonicalCcpSemanticDedupProjectionJsonV1(second),
  );
  assert.equal(ccpSemanticDedupProjectionDigestV1(first), ccpSemanticDedupProjectionDigestV1(second));
  assert.equal(ccpSemanticDedupProjectionDigestV1(first), FORCE_PUSH_DEDUP_DIGEST);

  assert.equal(Object.isFrozen(first), true);
  for (const head of first.heads) {
    assert.equal(Object.isFrozen(head), true);
  }

  // An empty ledger projects to a valid closed zero projection.
  const empty = projectCcpSemanticDedupV1(createCcpIntakeLedgerV1(fixture("force-push").identity));
  assert.equal(empty.totalEntries, 0);
  assert.equal(empty.uniqueHeadCount, 0);
  assert.deepEqual([...empty.heads], []);
  assert.notEqual(verifyCcpSemanticDedupProjectionV1(empty), null);
});

test("CCP-PSAI52-DEDUP-002 force-push fixture tallies per-head dispositions and binds effects", () => {
  const { ledger, results } = replay("force-push");
  assert.deepEqual(
    results,
    [
      { disposition: "ADMITTED", reasonCode: "NEW_SEMANTIC_HEAD", appended: true },
      { disposition: "ADMITTED", reasonCode: "NEW_SEMANTIC_HEAD", appended: true },
      { disposition: "STALE", reasonCode: "STALE_ANCESTOR", appended: true },
    ],
  );
  assert.equal(ledger.entries.length, 3);
  assert.equal(ledger.ledgerDigest, FORCE_PUSH_LEDGER_DIGEST);

  const projection = projectCcpSemanticDedupV1(ledger);
  assert.equal(projection.totalEntries, 3);
  assert.equal(projection.admittedCount, 2);
  assert.equal(projection.semanticDuplicateCount, 0);
  assert.equal(projection.staleCount, 1);
  assert.equal(projection.quarantinedCount, 0);
  assert.equal(projection.uniqueHeadCount, 3);
  assert.equal(projection.dedupDigest, FORCE_PUSH_DEDUP_DIGEST);
  assert.deepEqual([...projection.heads], [
    {
      headDigest: digest("a"),
      semanticEffectId: EFFECT_A,
      effectSequence: 1,
      firstSeenCausalSequence: 1,
      admittedDeliveryCount: 1,
      duplicateDeliveryCount: 0,
      staleDeliveryCount: 0,
      quarantinedDeliveryCount: 0,
    },
    {
      headDigest: digest("b"),
      semanticEffectId: EFFECT_B,
      effectSequence: 2,
      firstSeenCausalSequence: 2,
      admittedDeliveryCount: 1,
      duplicateDeliveryCount: 0,
      staleDeliveryCount: 0,
      quarantinedDeliveryCount: 0,
    },
    {
      headDigest: digest("c"),
      semanticEffectId: null,
      effectSequence: null,
      firstSeenCausalSequence: 3,
      admittedDeliveryCount: 0,
      duplicateDeliveryCount: 0,
      staleDeliveryCount: 1,
      quarantinedDeliveryCount: 0,
    },
  ]);
});

test("CCP-PSAI52-DEDUP-003 reordered fixture proves exact and semantic deduplication", () => {
  const { ledger, results } = replay("reordered-deliveries");
  assert.deepEqual(
    results,
    [
      { disposition: "ADMITTED", reasonCode: "NEW_SEMANTIC_HEAD", appended: true },
      { disposition: "ADMITTED", reasonCode: "NEW_SEMANTIC_HEAD", appended: true },
      { disposition: "TRANSPORT_DUPLICATE", reasonCode: "DELIVERY_REDELIVERY", appended: false },
      { disposition: "STALE", reasonCode: "HEAD_ALREADY_SEEN", appended: true },
      { disposition: "SEMANTIC_DUPLICATE", reasonCode: "HEAD_ALREADY_CURRENT", appended: true },
      { disposition: "STALE", reasonCode: "STALE_ANCESTOR", appended: true },
      { disposition: "ADMITTED", reasonCode: "NEW_SEMANTIC_HEAD", appended: true },
    ],
  );
  // The exact redelivery appends no entry: 7 events, 6 entries.
  assert.equal(ledger.entries.length, 6);
  assert.equal(ledger.ledgerDigest, REORDERED_LEDGER_DIGEST);

  const projection = projectCcpSemanticDedupV1(ledger);
  assert.equal(projection.totalEntries, 6);
  assert.equal(projection.admittedCount, 3);
  assert.equal(projection.semanticDuplicateCount, 1);
  assert.equal(projection.staleCount, 2);
  assert.equal(projection.quarantinedCount, 0);
  assert.equal(projection.uniqueHeadCount, 4);
  assert.equal(projection.dedupDigest, REORDERED_DEDUP_DIGEST);
  assert.deepEqual([...projection.heads], [
    {
      headDigest: digest("a"),
      semanticEffectId: EFFECT_A,
      effectSequence: 1,
      firstSeenCausalSequence: 1,
      admittedDeliveryCount: 1,
      duplicateDeliveryCount: 0,
      staleDeliveryCount: 1,
      quarantinedDeliveryCount: 0,
    },
    {
      headDigest: digest("b"),
      semanticEffectId: EFFECT_B,
      effectSequence: 2,
      firstSeenCausalSequence: 2,
      admittedDeliveryCount: 1,
      duplicateDeliveryCount: 1,
      staleDeliveryCount: 0,
      quarantinedDeliveryCount: 0,
    },
    {
      headDigest: digest("d"),
      semanticEffectId: null,
      effectSequence: null,
      firstSeenCausalSequence: 5,
      admittedDeliveryCount: 0,
      duplicateDeliveryCount: 0,
      staleDeliveryCount: 1,
      quarantinedDeliveryCount: 0,
    },
    {
      headDigest: digest("e"),
      semanticEffectId: EFFECT_E,
      effectSequence: 3,
      firstSeenCausalSequence: 6,
      admittedDeliveryCount: 1,
      duplicateDeliveryCount: 0,
      staleDeliveryCount: 0,
      quarantinedDeliveryCount: 0,
    },
  ]);
});

test("CCP-PSAI52-DEDUP-004 malformed ledgers and projections deny before any projection exists", () => {
  assert.throws(() => projectCcpSemanticDedupV1("no-ledger"), /CCP_INTAKE_LEDGER_DENIED/);

  assert.throws(
    () => parseCcpSemanticDedupProjectionV1({}),
    /CCP_SEMANTIC_DEDUP_PROJECTION_SCHEMA_DENIED/,
  );
  assert.throws(
    () => parseCcpSemanticDedupProjectionV1("sealed"),
    /CCP_SEMANTIC_DEDUP_PROJECTION_SCHEMA_DENIED/,
  );
  const legitimate = projectCcpSemanticDedupV1(replay("force-push").ledger);
  assert.throws(
    () => parseCcpSemanticDedupProjectionV1({ ...legitimate, extraField: true }),
    /CCP_SEMANTIC_DEDUP_PROJECTION_SCHEMA_DENIED/,
  );
  assert.throws(() => ccpSemanticDedupProjectionDigestV1(42), /_SCHEMA_DENIED/);
  assert.throws(() => canonicalCcpSemanticDedupProjectionJsonV1(42), /_SCHEMA_DENIED/);
});

test("CCP-PSAI52-DEDUP-005 rehashed forged projections deny on read-back", () => {
  const legitimate = projectCcpSemanticDedupV1(replay("force-push").ledger);

  const denyForged = (mutate: (record: Record<string, unknown>) => void): void => {
    const record = structuredClone(legitimate) as unknown as Record<string, unknown>;
    mutate(record);
    rehashDedup(record);
    assert.throws(
      () => parseCcpSemanticDedupProjectionV1(record),
      /CCP_SEMANTIC_DEDUP_PROJECTION_SCHEMA_DENIED/,
    );
    assert.equal(verifyCcpSemanticDedupProjectionV1(record), null);
  };

  // Widen the admission count: the per-head tallies no longer sum to it.
  denyForged((record) => {
    record.admittedCount = 3;
  });

  // Claim the same effect sequence for two different heads.
  denyForged((record) => {
    const heads = record.heads as Array<Record<string, unknown>>;
    const b = heads[1];
    assert.ok(b !== undefined);
    b.effectSequence = 1;
  });

  // Move the single admission from head a to the stale force-pushed head c.
  denyForged((record) => {
    const heads = record.heads as Array<Record<string, unknown>>;
    const a = heads[0];
    const c = heads[2];
    assert.ok(a !== undefined && c !== undefined);
    a.admittedDeliveryCount = 0;
    c.admittedDeliveryCount = 1;
  });
});

test("CCP-PSAI52-DEDUP-006 legitimate projections verify and canonical bytes are key-order independent", () => {
  const projection = projectCcpSemanticDedupV1(replay("reordered-deliveries").ledger);
  assert.equal(
    verifyCcpSemanticDedupProjectionV1(projection)?.dedupDigest,
    REORDERED_DEDUP_DIGEST,
  );

  const reshuffled = Object.fromEntries(Object.entries(projection).reverse());
  assert.equal(
    canonicalCcpSemanticDedupProjectionJsonV1(reshuffled),
    canonicalCcpSemanticDedupProjectionJsonV1(projection),
  );
  assert.equal(
    ccpSemanticDedupProjectionDigestV1(reshuffled),
    ccpSemanticDedupProjectionDigestV1(projection),
  );
});