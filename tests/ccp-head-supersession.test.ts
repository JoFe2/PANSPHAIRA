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
  canonicalCcpHeadSupersessionProjectionJsonV1,
  ccpHeadSupersessionProjectionDigestV1,
  parseCcpHeadSupersessionProjectionV1,
  projectCcpHeadSupersessionV1,
  verifyCcpHeadSupersessionProjectionV1,
  CCP_HEAD_STATES_V1,
  CCP_HEAD_SUPERSESSION_PROJECTION_SCHEMA_V1,
} from "../packages/contracts/src/ccp-head-supersession.js";

const digest = (character: string): string => character.repeat(64);

const fixture = (name: string): { identity: CcpIntakeLedgerIdentityV1; events: unknown[] } =>
  JSON.parse(readFileSync(`tests/fixtures/ccp-supersession/${name}.json`, "utf8"));

// Byte-stability bindings: digests of the projections produced by replaying
// the fixtures. Any drift in the projection bytes changes these values.
const FORCE_PUSH_LEDGER_DIGEST = "45918a29095e34d92a56d606a521fb0fa0ebfa32e1873483602d510db841a3a6";
const FORCE_PUSH_SUPERSESSION_DIGEST = "0a6db4f6c7948965b2ca68714bd2bad0c89f053ec51c05dfb6f83d5bb5e42f64";
const REORDERED_LEDGER_DIGEST = "ebfb34f18b48880baf873e3891beae107509ae01117473665e634225b6e40afe";
const REORDERED_SUPERSESSION_DIGEST = "5341880d8f352a2f6602fb385c2cb9119bdc7350d05e186eb16258dd1d5e24a5";
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

/** Rehash a forged supersession projection with its own domain; used only to build rehashed forgeries. */
function rehashSupersession(record: Record<string, unknown>): void {
  const { supersessionDigest: _supersessionDigest, ...unsigned } = record;
  record.supersessionDigest = ccpDigestDomainV1(
    CCP_HEAD_SUPERSESSION_PROJECTION_SCHEMA_V1,
    unsigned,
  );
}

test("CCP-PSAI52-SUP-001 projection is deterministic and pure", () => {
  const first = projectCcpHeadSupersessionV1(replay("force-push").ledger);
  const second = projectCcpHeadSupersessionV1(replay("force-push").ledger);

  assert.equal(
    canonicalCcpHeadSupersessionProjectionJsonV1(first),
    canonicalCcpHeadSupersessionProjectionJsonV1(second),
  );
  assert.equal(
    ccpHeadSupersessionProjectionDigestV1(first),
    ccpHeadSupersessionProjectionDigestV1(second),
  );
  assert.equal(ccpHeadSupersessionProjectionDigestV1(first), FORCE_PUSH_SUPERSESSION_DIGEST);

  assert.equal(Object.isFrozen(first), true);
  for (const label of first.heads) {
    assert.equal(Object.isFrozen(label), true);
  }

  assert.deepEqual([...CCP_HEAD_STATES_V1], ["CURRENT", "SUPERSEDED", "INVALIDATED"]);

  // An empty ledger projects to a valid closed zero projection.
  const empty = projectCcpHeadSupersessionV1(createCcpIntakeLedgerV1(fixture("force-push").identity));
  assert.equal(empty.currentHeadDigest, null);
  assert.equal(empty.currentSemanticEffectId, null);
  assert.equal(empty.currentCount, 0);
  assert.equal(empty.supersededCount, 0);
  assert.equal(empty.invalidatedCount, 0);
  assert.deepEqual([...empty.heads], []);
  assert.notEqual(verifyCcpHeadSupersessionProjectionV1(empty), null);
});

test("CCP-PSAI52-SUP-002 force-pushed heads are terminally ineligible before any deep-CI claim", () => {
  const { ledger } = replay("force-push");
  assert.equal(ledger.ledgerDigest, FORCE_PUSH_LEDGER_DIGEST);

  const projection = projectCcpHeadSupersessionV1(ledger);
  assert.equal(projection.currentHeadDigest, digest("b"));
  assert.equal(projection.currentSemanticEffectId, EFFECT_B);
  assert.equal(projection.currentCount, 1);
  assert.equal(projection.supersededCount, 1);
  assert.equal(projection.invalidatedCount, 1);
  assert.equal(projection.supersessionDigest, FORCE_PUSH_SUPERSESSION_DIGEST);
  assert.deepEqual([...projection.heads], [
    {
      headDigest: digest("a"),
      semanticEffectId: EFFECT_A,
      effectSequence: 1,
      state: "SUPERSEDED",
      deepCiClaimEligible: false,
    },
    {
      headDigest: digest("b"),
      semanticEffectId: EFFECT_B,
      effectSequence: 2,
      state: "CURRENT",
      deepCiClaimEligible: true,
    },
    {
      headDigest: digest("c"),
      semanticEffectId: null,
      effectSequence: null,
      state: "INVALIDATED",
      deepCiClaimEligible: false,
    },
  ]);

  // The stale force-pushed head c is terminally ineligible: only the CURRENT
  // head b is eligible, and the eligibility flag is true for it alone.
  for (const label of projection.heads) {
    assert.equal(label.deepCiClaimEligible, label.state === "CURRENT");
  }
  assert.equal(
    projection.heads.filter((label) => label.deepCiClaimEligible).length,
    1,
  );
});

test("CCP-PSAI52-SUP-003 reordered fixture: supersession follows admission order, dedup does not change labels", () => {
  const { ledger, results } = replay("reordered-deliveries");
  assert.equal(results.length, 7);
  assert.equal(ledger.entries.length, 6);
  assert.equal(ledger.ledgerDigest, REORDERED_LEDGER_DIGEST);

  const projection = projectCcpHeadSupersessionV1(ledger);
  assert.equal(projection.currentHeadDigest, digest("e"));
  assert.equal(projection.currentSemanticEffectId, EFFECT_E);
  assert.equal(projection.currentCount, 1);
  assert.equal(projection.supersededCount, 2);
  assert.equal(projection.invalidatedCount, 1);
  assert.equal(projection.supersessionDigest, REORDERED_SUPERSESSION_DIGEST);
  // First-seen head order: a, b, d, e. The re-delivery of current b and the
  // stale re-reference of a add entries without changing any label.
  assert.deepEqual([...projection.heads], [
    {
      headDigest: digest("a"),
      semanticEffectId: EFFECT_A,
      effectSequence: 1,
      state: "SUPERSEDED",
      deepCiClaimEligible: false,
    },
    {
      headDigest: digest("b"),
      semanticEffectId: EFFECT_B,
      effectSequence: 2,
      state: "SUPERSEDED",
      deepCiClaimEligible: false,
    },
    {
      headDigest: digest("d"),
      semanticEffectId: null,
      effectSequence: null,
      state: "INVALIDATED",
      deepCiClaimEligible: false,
    },
    {
      headDigest: digest("e"),
      semanticEffectId: EFFECT_E,
      effectSequence: 3,
      state: "CURRENT",
      deepCiClaimEligible: true,
    },
  ]);
});

test("CCP-PSAI52-SUP-004 malformed ledgers and projections deny before any projection exists", () => {
  assert.throws(() => projectCcpHeadSupersessionV1("no-ledger"), /CCP_INTAKE_LEDGER_DENIED/);

  assert.throws(
    () => parseCcpHeadSupersessionProjectionV1({}),
    /CCP_HEAD_SUPERSESSION_PROJECTION_SCHEMA_DENIED/,
  );
  assert.throws(
    () => parseCcpHeadSupersessionProjectionV1("sealed"),
    /CCP_HEAD_SUPERSESSION_PROJECTION_SCHEMA_DENIED/,
  );
  const legitimate = projectCcpHeadSupersessionV1(replay("force-push").ledger);
  assert.throws(
    () => parseCcpHeadSupersessionProjectionV1({ ...legitimate, extraField: true }),
    /CCP_HEAD_SUPERSESSION_PROJECTION_SCHEMA_DENIED/,
  );
  assert.throws(() => ccpHeadSupersessionProjectionDigestV1(42), /_SCHEMA_DENIED/);
  assert.throws(() => canonicalCcpHeadSupersessionProjectionJsonV1(42), /_SCHEMA_DENIED/);
});

test("CCP-PSAI52-SUP-005 rehashed forged projections deny on read-back", () => {
  const forcePush = projectCcpHeadSupersessionV1(replay("force-push").ledger);
  const reordered = projectCcpHeadSupersessionV1(replay("reordered-deliveries").ledger);

  const denyForged = (base: unknown, mutate: (record: Record<string, unknown>) => void): void => {
    const record = structuredClone(base) as unknown as Record<string, unknown>;
    mutate(record);
    rehashSupersession(record);
    assert.throws(
      () => parseCcpHeadSupersessionProjectionV1(record),
      /CCP_HEAD_SUPERSESSION_PROJECTION_SCHEMA_DENIED/,
    );
    assert.equal(verifyCcpHeadSupersessionProjectionV1(record), null);
  };

  // Promote the invalidated force-pushed head c to CURRENT.
  denyForged(forcePush, (record) => {
    const heads = record.heads as Array<Record<string, unknown>>;
    const c = heads[2];
    assert.ok(c !== undefined);
    c.state = "CURRENT";
    c.deepCiClaimEligible = true;
  });

  // Claim deep-CI eligibility for an invalidated head while it stays INVALIDATED.
  denyForged(reordered, (record) => {
    const heads = record.heads as Array<Record<string, unknown>>;
    const d = heads[2];
    assert.ok(d !== undefined);
    d.deepCiClaimEligible = true;
  });

  // Point the current head at the invalidated head c while the counts stay.
  denyForged(forcePush, (record) => {
    record.currentHeadDigest = digest("c");
    record.currentSemanticEffectId = null;
  });

  // Widen the superseded count past the actual labels.
  denyForged(reordered, (record) => {
    record.supersededCount = 3;
  });
});

test("CCP-PSAI52-SUP-006 legitimate projections verify and canonical bytes are key-order independent", () => {
  const projection = projectCcpHeadSupersessionV1(replay("reordered-deliveries").ledger);
  assert.equal(
    verifyCcpHeadSupersessionProjectionV1(projection)?.supersessionDigest,
    REORDERED_SUPERSESSION_DIGEST,
  );

  const reshuffled = Object.fromEntries(Object.entries(projection).reverse());
  assert.equal(
    canonicalCcpHeadSupersessionProjectionJsonV1(reshuffled),
    canonicalCcpHeadSupersessionProjectionJsonV1(projection),
  );
  assert.equal(
    ccpHeadSupersessionProjectionDigestV1(reshuffled),
    ccpHeadSupersessionProjectionDigestV1(projection),
  );
});