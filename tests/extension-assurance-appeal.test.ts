import assert from "node:assert/strict";
import test from "node:test";
import {
  EXTENSION_ASSURANCE_APPEAL_CLAIM_BOUNDARY_V1,
  EXTENSION_ASSURANCE_APPEAL_EVENT_TYPES_V1,
  EXTENSION_ASSURANCE_APPEAL_GENESIS_DIGEST_V1,
  EXTENSION_ASSURANCE_APPEAL_SCHEMA_V1,
  EXTENSION_ASSURANCE_APPEAL_STATES_V1,
  evaluateExtensionAssuranceAppealRecordV1,
  extensionAssuranceAppealDigestV1,
  extensionAssuranceAppealEventDigestV1,
  extensionAssuranceAppealPriorResultDigestV1,
  renderPublicExtensionAssuranceAppealResultV1,
} from "../packages/contracts/src/extension-assurance-appeal.js";

const PROFILE_BOUNDARY = "LOCAL_SYNTHETIC_PROFILE_ONLY_NO_TRUST_BADGE_NO_ACCEPTANCE_NO_ACTIVATION_NO_EXECUTION";

function hex(seed: number): string {
  return Array.from({ length: 64 }, (_, index) => ((seed + index * 7 + index * index * 3) % 16).toString(16)).join("");
}

function ref(seed: number): string {
  return `artifact:sha256:${hex(seed)}`;
}

function reorderKeys(value: unknown, seed: number): unknown {
  if (Array.isArray(value)) return value.map((item) => reorderKeys(item, seed + 1));
  if (value === null || typeof value !== "object") return value;
  const entries = Object.entries(value as Record<string, unknown>);
  const offset = entries.length === 0 ? 0 : seed % entries.length;
  const rotated = [...entries.slice(offset), ...entries.slice(0, offset)].reverse();
  return Object.fromEntries(rotated.map(([key, item]) => [key, reorderKeys(item, seed + 1)]));
}

function recomputeEventChain(record: Record<string, any>, resultDigest: string): void {
  let prev = EXTENSION_ASSURANCE_APPEAL_GENESIS_DIGEST_V1;
  for (const event of record.events) {
    event.priorResultDigest = resultDigest;
    event.prevEventDigest = prev;
    event.eventDigest = extensionAssuranceAppealEventDigestV1(event);
    prev = event.eventDigest;
  }
  record.appealDigest = extensionAssuranceAppealDigestV1(record);
}

function buildAppeal(
  mutate?: (record: Record<string, any>, ctx: { resultDigest: string }) => void,
  terminal?: { type: string; state: string },
): Record<string, any> {
  const now = 1_700_000_000_000;
  const result = {
    schemaVersion: "chimpmaera.extension-trust/assurance-result/v1",
    outcome: "PROFILE_CONFORMANT",
    reasonCodes: ["PROFILE_CONFORMANT"],
    publicClaim: "LOCALLY_EVALUATED_SYNTHETIC",
    claimBoundary: PROFILE_BOUNDARY,
  };
  const resultDigest = extensionAssuranceAppealPriorResultDigestV1(result);
  let prev = EXTENSION_ASSURANCE_APPEAL_GENESIS_DIGEST_V1;
  const events: Record<string, any>[] = [];
  const add = (eventType: string, atMs: number, evidenceRefs: string[], sequence: number) => {
    const event: Record<string, any> = {
      sequence,
      eventType,
      occurredAtMs: atMs,
      priorResultDigest: resultDigest,
      evidenceRefs,
      prevEventDigest: prev,
      eventDigest: "",
    };
    event.eventDigest = extensionAssuranceAppealEventDigestV1(event);
    events.push(event);
    prev = event.eventDigest;
  };
  add("APPEAL_OPENED", now, [ref(1), ref(2)], 1);
  add("EVIDENCE_SUBMITTED", now + 1_000, [ref(3)], 2);
  if (terminal !== undefined) add(terminal.type, now + 2_000, [ref(4)], 3);
  const record: Record<string, any> = {
    schemaVersion: EXTENSION_ASSURANCE_APPEAL_SCHEMA_V1,
    appealId: "appeal:etl-38-0001",
    subject: {
      kind: "EXTENSION",
      subjectId: "extension:demo-synthetic-0001",
      subjectVersion: "1.0.0",
      subjectDigest: hex(9),
    },
    priorResult: {
      profileId: "assurance-profile:etl-01-0001",
      profileDigest: hex(10),
      result,
      resultDigest,
    },
    state: terminal?.state ?? "OPEN",
    revision: events.length,
    events,
    appealDigest: "",
  };
  record.appealDigest = extensionAssuranceAppealDigestV1(record);
  mutate?.(record, { resultDigest });
  return record;
}

test("ETL-M1-APPEAL freezes the closed event/state vocabulary and records a valid open appeal", () => {
  assert.deepEqual([...EXTENSION_ASSURANCE_APPEAL_EVENT_TYPES_V1], [
    "APPEAL_OPENED", "EVIDENCE_SUBMITTED", "FALSE_POSITIVE_CONFIRMED", "FALSE_NEGATIVE_CONFIRMED", "APPEAL_REJECTED", "SUPERSEDED",
  ]);
  assert.deepEqual([...EXTENSION_ASSURANCE_APPEAL_STATES_V1], [
    "OPEN", "CONFIRMED_FALSE_POSITIVE", "CONFIRMED_FALSE_NEGATIVE", "REJECTED", "SUPERSEDED",
  ]);
  assert.equal(EXTENSION_ASSURANCE_APPEAL_CLAIM_BOUNDARY_V1, "LOCAL_APPEAL_RECORD_ONLY_NO_TRUST_NO_ADMISSION_NO_ACTIVATION_NO_MARKETPLACE");
  assert.deepEqual(evaluateExtensionAssuranceAppealRecordV1(buildAppeal()), {
    schemaVersion: "chimpmaera.extension-trust/assurance-appeal-result/v1",
    outcome: "APPEAL_RECORDED",
    reasonCodes: ["APPEAL_RECORDED"],
    publicClaim: "LOCAL_APPEAL_RECORDED",
    claimBoundary: "LOCAL_APPEAL_RECORD_ONLY_NO_TRUST_NO_ADMISSION_NO_ACTIVATION_NO_MARKETPLACE",
  });
});

test("ETL-M1-APPEAL appeal and event digests survive 100 key reorder repetitions", () => {
  const record = buildAppeal();
  for (let repetition = 0; repetition < 100; repetition += 1) {
    const reordered = reorderKeys(record, repetition) as Record<string, any>;
    assert.equal(extensionAssuranceAppealDigestV1(reordered), record.appealDigest, String(repetition));
    for (let index = 0; index < reordered.events.length; index += 1) {
      const event = reordered.events[index];
      assert.equal(extensionAssuranceAppealEventDigestV1(event), event.eventDigest, `${repetition}:${index}`);
    }
  }
});

test("ETL-M1-APPEAL denies unbound evidence and prior-result binding drift", () => {
  const noEvidence = buildAppeal((record, ctx) => {
    record.events[1].evidenceRefs = [];
    recomputeEventChain(record, ctx.resultDigest);
  });
  assert.ok(evaluateExtensionAssuranceAppealRecordV1(noEvidence).reasonCodes.includes("EVIDENCE_BINDING_DENIED"));

  const staleResult = buildAppeal((record, ctx) => {
    record.priorResult.result.outcome = "DENIED";
    recomputeEventChain(record, ctx.resultDigest);
  });
  assert.ok(
    evaluateExtensionAssuranceAppealRecordV1(staleResult).reasonCodes.includes("PRIOR_RESULT_BINDING_DENIED"),
  );

  const unboundEvent = buildAppeal((record) => {
    record.events[0].priorResultDigest = hex(50);
    record.events[0].eventDigest = extensionAssuranceAppealEventDigestV1(record.events[0]);
    record.events[1].prevEventDigest = record.events[0].eventDigest;
    record.events[1].eventDigest = extensionAssuranceAppealEventDigestV1(record.events[1]);
    record.appealDigest = extensionAssuranceAppealDigestV1(record);
  });
  assert.ok(
    evaluateExtensionAssuranceAppealRecordV1(unboundEvent).reasonCodes.includes("PRIOR_RESULT_BINDING_DENIED"),
  );
});

test("ETL-M1-APPEAL enforces monotonic revision equal to the event chain length", () => {
  const record = buildAppeal((r) => {
    r.revision = 5;
    r.appealDigest = extensionAssuranceAppealDigestV1(r);
  });
  const result = evaluateExtensionAssuranceAppealRecordV1(record);
  assert.equal(result.outcome, "DENIED");
  assert.ok(result.reasonCodes.includes("REVISION_MONOTONICITY_DENIED"));
});

test("ETL-M1-APPEAL denies replayed or gapped event sequences", () => {
  const gap = buildAppeal((record) => {
    record.events[1].sequence = 3;
    record.events[1].eventDigest = extensionAssuranceAppealEventDigestV1(record.events[1]);
    record.appealDigest = extensionAssuranceAppealDigestV1(record);
  });
  assert.ok(evaluateExtensionAssuranceAppealRecordV1(gap).reasonCodes.includes("REPLAY_OR_GAP_DENIED"));

  const replay = buildAppeal((record) => {
    record.events[1].prevEventDigest = EXTENSION_ASSURANCE_APPEAL_GENESIS_DIGEST_V1;
    record.events[1].eventDigest = extensionAssuranceAppealEventDigestV1(record.events[1]);
    record.appealDigest = extensionAssuranceAppealDigestV1(record);
  });
  assert.ok(evaluateExtensionAssuranceAppealRecordV1(replay).reasonCodes.includes("REPLAY_OR_GAP_DENIED"));
});

test("ETL-M1-APPEAL denies state that does not match the terminal event", () => {
  const mismatch = buildAppeal((record) => {
    record.state = "REJECTED";
    record.appealDigest = extensionAssuranceAppealDigestV1(record);
  });
  assert.ok(evaluateExtensionAssuranceAppealRecordV1(mismatch).reasonCodes.includes("STATE_TRANSITION_DENIED"));

  const badGenesis = buildAppeal((record) => {
    record.events[0].eventType = "EVIDENCE_SUBMITTED";
    record.events[0].eventDigest = extensionAssuranceAppealEventDigestV1(record.events[0]);
    record.events[1].prevEventDigest = record.events[0].eventDigest;
    record.events[1].eventDigest = extensionAssuranceAppealEventDigestV1(record.events[1]);
    record.appealDigest = extensionAssuranceAppealDigestV1(record);
  });
  assert.ok(evaluateExtensionAssuranceAppealRecordV1(badGenesis).reasonCodes.includes("STATE_TRANSITION_DENIED"));
});

test("ETL-M1-APPEAL routes terminal states and requires retest after a confirmed false negative", () => {
  for (const terminal of [
    { type: "FALSE_POSITIVE_CONFIRMED", state: "CONFIRMED_FALSE_POSITIVE" },
    { type: "APPEAL_REJECTED", state: "REJECTED" },
    { type: "SUPERSEDED", state: "SUPERSEDED" },
  ] as const) {
    const result = evaluateExtensionAssuranceAppealRecordV1(buildAppeal(undefined, terminal));
    assert.equal(result.outcome, "APPEAL_RECORDED", terminal.type);
    assert.deepEqual(result.reasonCodes, ["APPEAL_RECORDED"], terminal.type);
    assert.equal(result.publicClaim, "LOCAL_APPEAL_RECORDED", terminal.type);
  }
  const falseNegative = evaluateExtensionAssuranceAppealRecordV1(buildAppeal(undefined, {
    type: "FALSE_NEGATIVE_CONFIRMED",
    state: "CONFIRMED_FALSE_NEGATIVE",
  }));
  assert.equal(falseNegative.outcome, "RETEST_REQUIRED");
  assert.deepEqual(falseNegative.reasonCodes, ["FALSE_NEGATIVE_RETEST_REQUIRED"]);
  assert.equal(falseNegative.publicClaim, "FALSE_NEGATIVE_RETEST_REQUIRED");
});

test("ETL-M1-APPEAL denies digest drift and unknown fields fail closed", () => {
  const drift = buildAppeal();
  drift.appealDigest = hex(60);
  assert.ok(evaluateExtensionAssuranceAppealRecordV1(drift).reasonCodes.includes("DIGEST_MISMATCH_DENIED"));

  const eventDrift = buildAppeal((record) => {
    record.events[0].eventDigest = hex(61);
    record.appealDigest = extensionAssuranceAppealDigestV1(record);
  });
  assert.ok(evaluateExtensionAssuranceAppealRecordV1(eventDrift).reasonCodes.includes("DIGEST_MISMATCH_DENIED"));

  const unknown = buildAppeal((record) => {
    record.marketplaceAdmission = true;
  });
  const result = evaluateExtensionAssuranceAppealRecordV1(unknown);
  assert.deepEqual(result.reasonCodes, ["SCHEMA_DENIED"]);
});

test("ETL-M1-APPEAL public projection emits only the fixed public-safe result vocabulary", () => {
  const seeded = [
    "-----BEGIN " + "PRIVATE KEY-----",
    ["", "ho" + "me", "operator", "private", "appeal-evidence.txt"].join("/"),
    "gh" + "p_seededNotARealCredential000000000",
    "marketplace-endorsement@example.invalid",
  ];
  for (const sensitiveValue of seeded) {
    const shaped = buildAppeal((record) => {
      record.securityFinding = sensitiveValue;
    });
    const publicBytes = renderPublicExtensionAssuranceAppealResultV1(shaped);
    assert.equal(publicBytes.includes(sensitiveValue), false);
    const parsed = JSON.parse(publicBytes) as Record<string, unknown>;
    assert.deepEqual(Object.keys(parsed).sort(), [
      "claimBoundary", "outcome", "publicClaim", "reasonCodes", "schemaVersion",
    ]);
    assert.equal(parsed.outcome, "DENIED");
  }
});