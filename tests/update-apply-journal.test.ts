import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";
import {
  APPLY_JOURNAL_GENESIS_DIGEST_V1,
  APPLY_ROLLBACK_EVENT_SEQUENCE_V1,
  APPLY_SUCCESS_EVENT_SEQUENCE_V1,
  UPDATE_APPLY_JOURNAL_EXIT_CODES_V1,
  UPDATE_APPLY_JOURNAL_SCHEMA_V1,
  buildUpdateApplyJournalV1,
  parseUpdateApplyJournalV1,
  updateApplyJournalDigestV1,
  verifyUpdateApplyJournalV1,
  type UpdateApplyJournalEventSpecV1,
  type UpdateApplyJournalOptionsV1,
  type UpdateApplyJournalVerificationContextV1,
  type UpdateApplyJournalV1,
} from "../packages/contracts/src/update-apply-journal.js";

const STARTED_AT_MS = 1_785_819_600_000;

function hex(seed: string): string {
  return createHash("sha256").update(seed).digest("hex");
}

const OPERATION_DIGEST = hex("psai53-apply-journal/operation/0001");
const SOURCE_LOCK_DIGEST = hex("psai53-apply-journal/source-lock/0001");
const TARGET_LOCK_DIGEST = hex("psai53-apply-journal/target-lock/0001");
const FORGED_OPERATION_DIGEST = hex("psai53-apply-journal/operation/9999");
const OTHER_DIGEST = hex("psai53-apply-journal/other/0001");

function contextFor(
  overrides: Partial<UpdateApplyJournalVerificationContextV1> = {},
): UpdateApplyJournalVerificationContextV1 {
  return {
    expectedOperationDigest: OPERATION_DIGEST,
    expectedSourceLockDigest: SOURCE_LOCK_DIGEST,
    expectedTargetLockDigest: TARGET_LOCK_DIGEST,
    expectedRevision: 1,
    ...overrides,
  };
}

const SUCCESS_EVENTS: readonly UpdateApplyJournalEventSpecV1[] = [
  { outcome: "STAGE_COPIED", timestampMs: STARTED_AT_MS },
  { outcome: "STAGE_VERIFIED", timestampMs: STARTED_AT_MS + 1_000 },
  { outcome: "POINTER_SWITCHED", timestampMs: STARTED_AT_MS + 2_000 },
  { outcome: "POSTCONDITION_VERIFIED", timestampMs: STARTED_AT_MS + 3_000 },
];

function options(overrides: Partial<UpdateApplyJournalOptionsV1> = {}): UpdateApplyJournalOptionsV1 {
  return {
    operationDigest: OPERATION_DIGEST,
    sourceLockDigest: SOURCE_LOCK_DIGEST,
    targetLockDigest: TARGET_LOCK_DIGEST,
    revision: 1,
    events: SUCCESS_EVENTS,
    ...overrides,
  };
}

function successJournal(overrides: Partial<UpdateApplyJournalOptionsV1> = {}): UpdateApplyJournalV1 {
  return buildUpdateApplyJournalV1(options(overrides));
}

function rollbackJournal(overrides: Partial<UpdateApplyJournalOptionsV1> = {}): UpdateApplyJournalV1 {
  return buildUpdateApplyJournalV1(options({
    events: [
      SUCCESS_EVENTS[0]!, SUCCESS_EVENTS[1]!, SUCCESS_EVENTS[2]!,
      { outcome: "POSTCONDITION_FAILED", timestampMs: STARTED_AT_MS + 3_000 },
      { outcome: "LKG_RESTORED", timestampMs: STARTED_AT_MS + 4_000 },
      { outcome: "ZERO_RESIDUE", timestampMs: STARTED_AT_MS + 5_000 },
    ],
    ...overrides,
  }));
}

type PlainEntry = Record<string, unknown>;

function toPlain(journal: UpdateApplyJournalV1): Record<string, unknown> {
  return JSON.parse(JSON.stringify(journal)) as Record<string, unknown>;
}

/** Recomputes entry and journal digests over the current (possibly mutated) content. */
function redigestEntries(journal: Record<string, unknown>): Record<string, unknown> {
  for (const entry of journal.entries as PlainEntry[]) {
    entry.entryDigest = updateApplyJournalDigestV1(entry, "entryDigest");
  }
  journal.journalDigest = updateApplyJournalDigestV1(journal, "journalDigest");
  return journal;
}

/** Rebuilds the previousDigest hash chain, entry digests and journal digest. */
function rebuildChain(journal: Record<string, unknown>): Record<string, unknown> {
  let previousDigest = APPLY_JOURNAL_GENESIS_DIGEST_V1;
  for (const entry of journal.entries as PlainEntry[]) {
    entry.previousDigest = previousDigest;
    entry.entryDigest = updateApplyJournalDigestV1(entry, "entryDigest");
    previousDigest = entry.entryDigest as string;
  }
  journal.journalDigest = updateApplyJournalDigestV1(journal, "journalDigest");
  return journal;
}

function reorderKeys(value: unknown, seed: number): unknown {
  if (Array.isArray(value)) return value.map((item) => reorderKeys(item, seed + 1));
  if (value === null || typeof value !== "object") return value;
  const entries = Object.entries(value as Record<string, unknown>);
  const offset = entries.length === 0 ? 0 : seed % entries.length;
  const rotated = [...entries.slice(offset), ...entries.slice(0, offset)].reverse();
  return Object.fromEntries(rotated.map(([key, item]) => [key, reorderKeys(item, seed + 1)]));
}

function assertDeeplyFrozen(value: unknown): void {
  if (value === null || typeof value !== "object") return;
  assert.equal(Object.isFrozen(value), true);
  for (const item of Object.values(value)) assertDeeplyFrozen(item);
}

function appendEntry(journal: Record<string, unknown>, eventType: string, outcome: string, timestampMs: number): void {
  const entries = journal.entries as PlainEntry[];
  entries.push({
    eventType,
    operationDigest: journal.operationDigest,
    sourceLockDigest: journal.sourceLockDigest,
    targetLockDigest: journal.targetLockDigest,
    sequence: entries.length + 1,
    timestampMs,
    previousDigest: entries[entries.length - 1]!.entryDigest,
    outcome,
    entryDigest: "0".repeat(64),
  });
}

test("UD-APPLY-01 valid stage-verify-switch-postcondition success chain verifies to VERIFIED", () => {
  const journal = successJournal();
  assert.equal(journal.schemaVersion, UPDATE_APPLY_JOURNAL_SCHEMA_V1);
  assert.equal(journal.mode, "SYNTHETIC_LOCAL_ONLY");
  assert.equal(journal.terminalState, "VERIFIED");
  assert.equal(journal.entries.length, 4);
  assert.deepEqual(journal.entries.map((entry) => entry.eventType), [...APPLY_SUCCESS_EVENT_SEQUENCE_V1]);
  assert.deepEqual(journal.entries.map((entry) => entry.outcome), [
    "STAGE_COPIED", "STAGE_VERIFIED", "POINTER_SWITCHED", "POSTCONDITION_VERIFIED",
  ]);
  assert.deepEqual(verifyUpdateApplyJournalV1(journal, contextFor()), {
    outcome: "ACCEPTED", reasonCodes: ["APPLY_JOURNAL_ACCEPTED"], exitCode: 0,
  });
  assertDeeplyFrozen(journal);
});

test("UD-APPLY-01 injected postcondition failure followed by rollback and cleanup reaches ROLLED_BACK_ZERO_RESIDUE", () => {
  const journal = rollbackJournal();
  assert.equal(journal.mode, "SYNTHETIC_LOCAL_ONLY");
  assert.equal(journal.terminalState, "ROLLED_BACK_ZERO_RESIDUE");
  assert.deepEqual(journal.entries.map((entry) => entry.eventType), [...APPLY_ROLLBACK_EVENT_SEQUENCE_V1]);
  assert.equal(journal.entries[3]!.outcome, "POSTCONDITION_FAILED");
  assert.equal(journal.entries[4]!.eventType, "ROLLBACK_LKG");
  assert.equal(journal.entries[4]!.outcome, "LKG_RESTORED");
  assert.equal(journal.entries[5]!.eventType, "CLEANUP");
  assert.equal(journal.entries[5]!.outcome, "ZERO_RESIDUE");
  assertDeeplyFrozen(journal);
  assert.deepEqual(verifyUpdateApplyJournalV1(journal, contextFor()), {
    outcome: "ACCEPTED", reasonCodes: ["APPLY_JOURNAL_ACCEPTED"], exitCode: 0,
  });
});

test("UD-APPLY-01 success and rollback chains are deterministic, gap-free and digest-stable", () => {
  const success = successJournal();
  const successAgain = successJournal();
  const rollback = rollbackJournal();
  const rollbackAgain = rollbackJournal();
  assert.equal(success.journalDigest, successAgain.journalDigest);
  assert.equal(rollback.journalDigest, rollbackAgain.journalDigest);

  for (const journal of [success, rollback]) {
    let previousDigest = APPLY_JOURNAL_GENESIS_DIGEST_V1;
    journal.entries.forEach((entry, index) => {
      assert.equal(entry.sequence, index + 1);
      assert.equal(entry.previousDigest, previousDigest);
      assert.equal(entry.operationDigest, journal.operationDigest);
      assert.equal(entry.sourceLockDigest, journal.sourceLockDigest);
      assert.equal(entry.targetLockDigest, journal.targetLockDigest);
      assert.equal(entry.entryDigest, updateApplyJournalDigestV1(entry as unknown as Record<string, unknown>, "entryDigest"));
      previousDigest = entry.entryDigest;
    });
    assert.equal(journal.journalDigest, updateApplyJournalDigestV1(journal as unknown as Record<string, unknown>, "journalDigest"));
  }

  for (const base of [success, rollback]) {
    for (let repetition = 0; repetition < 100; repetition += 1) {
      const reordered = reorderKeys(base, repetition) as UpdateApplyJournalV1;
      assert.equal(
        updateApplyJournalDigestV1(reordered as unknown as Record<string, unknown>, "journalDigest"),
        base.journalDigest,
      );
      assert.deepEqual(verifyUpdateApplyJournalV1(reordered, contextFor()), {
        outcome: "ACCEPTED", reasonCodes: ["APPLY_JOURNAL_ACCEPTED"], exitCode: 0,
      });
    }
  }
});

test("UD-APPLY-01 builder rejects non-canonical fixture sequences and unsafe inputs", () => {
  assert.throws(() => buildUpdateApplyJournalV1(options({
    events: [
      SUCCESS_EVENTS[0]!, SUCCESS_EVENTS[1]!, SUCCESS_EVENTS[2]!,
      { outcome: "POSTCONDITION_FAILED", timestampMs: STARTED_AT_MS + 3_000 },
    ],
  })), /INVALID_APPLY_JOURNAL_FIXTURE/);
  assert.throws(() => buildUpdateApplyJournalV1(options({
    events: [
      SUCCESS_EVENTS[0]!, SUCCESS_EVENTS[1]!, SUCCESS_EVENTS[2]!, SUCCESS_EVENTS[3]!,
      { outcome: "LKG_RESTORED", timestampMs: STARTED_AT_MS + 4_000 },
    ],
  })), /INVALID_APPLY_JOURNAL_FIXTURE/);
  assert.throws(() => buildUpdateApplyJournalV1(options({ revision: 0 })), /INVALID_APPLY_JOURNAL_FIXTURE/);
  assert.throws(() => buildUpdateApplyJournalV1(options({ operationDigest: "/etc/passwd" })), /INVALID_APPLY_JOURNAL_FIXTURE/);
  const reversedTimes: UpdateApplyJournalEventSpecV1[] = [
    SUCCESS_EVENTS[0]!,
    { outcome: "STAGE_VERIFIED", timestampMs: STARTED_AT_MS - 1_000 },
    SUCCESS_EVENTS[2]!, SUCCESS_EVENTS[3]!,
  ];
  assert.throws(() => buildUpdateApplyJournalV1(options({ events: reversedTimes })), /INVALID_APPLY_JOURNAL_FIXTURE/);
});

test("UD-APPLY-01 replay, sequence and revision gap, time reversal, and digest drift deny", () => {
  const replay = rebuildChain(toPlain(successJournal()));
  const replayEntries = replay.entries as PlainEntry[];
  replayEntries.push(JSON.parse(JSON.stringify(replayEntries[3]!)) as PlainEntry);
  const replayResult = verifyUpdateApplyJournalV1(replay, contextFor());
  assert.equal(replayResult.outcome, "DENIED");
  assert.ok(replayResult.reasonCodes.includes("SEQUENCE_GAP_DENIED" as never), replayResult.reasonCodes.join(","));
  assert.ok(replayResult.reasonCodes.includes("TERMINAL_APPEND_DENIED" as never), replayResult.reasonCodes.join(","));

  const sequenceGap = toPlain(successJournal());
  (sequenceGap.entries as PlainEntry[])[2]!.sequence = 5;
  assert.deepEqual(verifyUpdateApplyJournalV1(rebuildChain(sequenceGap), contextFor()), {
    outcome: "DENIED", reasonCodes: ["SEQUENCE_GAP_DENIED"], exitCode: UPDATE_APPLY_JOURNAL_EXIT_CODES_V1.SEQUENCE_GAP_DENIED,
  });

  const revisionGap = toPlain(successJournal());
  revisionGap.revision = 2;
  assert.deepEqual(verifyUpdateApplyJournalV1(redigestEntries(revisionGap), contextFor()), {
    outcome: "DENIED", reasonCodes: ["SEQUENCE_GAP_DENIED"], exitCode: UPDATE_APPLY_JOURNAL_EXIT_CODES_V1.SEQUENCE_GAP_DENIED,
  });

  const timeReversal = toPlain(successJournal());
  (timeReversal.entries as PlainEntry[])[3]!.timestampMs = STARTED_AT_MS + 500;
  assert.deepEqual(verifyUpdateApplyJournalV1(redigestEntries(timeReversal), contextFor()), {
    outcome: "DENIED", reasonCodes: ["TIME_REVERSAL_DENIED"], exitCode: UPDATE_APPLY_JOURNAL_EXIT_CODES_V1.TIME_REVERSAL_DENIED,
  });

  const previousDrift = redigestEntries(toPlain(successJournal()));
  (previousDrift.entries as PlainEntry[])[1]!.previousDigest = OTHER_DIGEST;
  assert.deepEqual(verifyUpdateApplyJournalV1(previousDrift, contextFor()), {
    outcome: "DENIED", reasonCodes: ["DIGEST_MISMATCH_DENIED"], exitCode: UPDATE_APPLY_JOURNAL_EXIT_CODES_V1.DIGEST_MISMATCH_DENIED,
  });

  const entryDigestDrift = toPlain(successJournal());
  (entryDigestDrift.entries as PlainEntry[])[2]!.entryDigest = "0".repeat(64);
  assert.deepEqual(verifyUpdateApplyJournalV1(entryDigestDrift, contextFor()), {
    outcome: "DENIED", reasonCodes: ["DIGEST_MISMATCH_DENIED"], exitCode: UPDATE_APPLY_JOURNAL_EXIT_CODES_V1.DIGEST_MISMATCH_DENIED,
  });

  const journalDigestDrift = toPlain(successJournal());
  journalDigestDrift.journalDigest = "e".repeat(64);
  assert.deepEqual(verifyUpdateApplyJournalV1(journalDigestDrift, contextFor()), {
    outcome: "DENIED", reasonCodes: ["DIGEST_MISMATCH_DENIED"], exitCode: UPDATE_APPLY_JOURNAL_EXIT_CODES_V1.DIGEST_MISMATCH_DENIED,
  });
});

test("UD-APPLY-01 skipped steps, post-terminal append and rollback without cleanup deny", () => {
  const skipped = toPlain(successJournal());
  const skippedEntries = skipped.entries as PlainEntry[];
  skippedEntries.splice(1, 1);
  skippedEntries.forEach((entry, index) => { entry.sequence = index + 1; });
  const skippedResult = verifyUpdateApplyJournalV1(rebuildChain(skipped), contextFor());
  assert.equal(skippedResult.outcome, "DENIED");
  assert.ok(skippedResult.reasonCodes.includes("EVENT_SEQUENCE_DENIED" as never), skippedResult.reasonCodes.join(","));

  const appended = toPlain(successJournal());
  appendEntry(appended, "CLEANUP", "ZERO_RESIDUE", STARTED_AT_MS + 4_000);
  const appendedResult = verifyUpdateApplyJournalV1(rebuildChain(appended), contextFor());
  assert.equal(appendedResult.outcome, "DENIED");
  assert.ok(appendedResult.reasonCodes.includes("TERMINAL_APPEND_DENIED" as never), appendedResult.reasonCodes.join(","));

  const appendedRollback = toPlain(rollbackJournal());
  appendEntry(appendedRollback, "CLEANUP", "ZERO_RESIDUE", STARTED_AT_MS + 6_000);
  const appendedRollbackResult = verifyUpdateApplyJournalV1(rebuildChain(appendedRollback), contextFor());
  assert.equal(appendedRollbackResult.outcome, "DENIED");
  assert.ok(appendedRollbackResult.reasonCodes.includes("TERMINAL_APPEND_DENIED" as never), appendedRollbackResult.reasonCodes.join(","));

  const noCleanup = toPlain(rollbackJournal());
  (noCleanup.entries as PlainEntry[]).splice(5, 1);
  const noCleanupResult = verifyUpdateApplyJournalV1(rebuildChain(noCleanup), contextFor());
  assert.equal(noCleanupResult.outcome, "DENIED");
  assert.ok(noCleanupResult.reasonCodes.includes("ROLLBACK_INCOMPLETE_DENIED" as never), noCleanupResult.reasonCodes.join(","));
});

test("UD-APPLY-01 unknown, free-text, path, credential, executable and self-promotion fields deny", () => {
  (globalThis as Record<string, unknown>).applyPwned = false;
  const cases: readonly [string, (journal: Record<string, unknown>) => void][] = [
    ["unknown-field", (journal) => { journal.notes = "staged pointer move looks fine"; }],
    ["self-promotion", (journal) => { journal.selfPromotion = true; }],
    ["free-text-outcome", (journal) => { (journal.entries as PlainEntry[])[0]!.outcome = "copied files; also see /tmp/stage, token=abc123"; }],
    ["path-digest", (journal) => { (journal.entries as PlainEntry[])[0]!.operationDigest = "/etc/passwd"; }],
    ["credential-digest", (journal) => { (journal.entries as PlainEntry[])[1]!.sourceLockDigest = "AKIAIOSFODNN7EXAMPLE"; }],
    ["executable-digest", (journal) => { (journal.entries as PlainEntry[])[2]!.targetLockDigest = "globalThis.applyPwned = true"; }],
    ["unknown-event", (journal) => { (journal.entries as PlainEntry[])[1]!.eventType = "RUN_SHELL"; }],
    ["mutable-mode", (journal) => { journal.mode = "LIVE"; }],
  ];
  for (const [name, mutate] of cases) {
    const journal = redigestEntries(toPlain(successJournal()));
    mutate(journal);
    const result = verifyUpdateApplyJournalV1(journal, contextFor());
    assert.equal(result.outcome, "DENIED", name);
    assert.ok(result.reasonCodes.includes("SCHEMA_DENIED" as never), `${name}:${result.reasonCodes.join(",")}`);
  }
  assert.equal((globalThis as Record<string, unknown>).applyPwned, false);
});

test("UD-APPLY-01 fully re-digested forged operation binding and entry binding drift deny", () => {
  const forged = rebuildChain(toPlain(successJournal()));
  forged.operationDigest = FORGED_OPERATION_DIGEST;
  for (const entry of forged.entries as PlainEntry[]) entry.operationDigest = FORGED_OPERATION_DIGEST;
  const forgedResult = verifyUpdateApplyJournalV1(forged, contextFor());
  assert.equal(forgedResult.outcome, "DENIED");
  assert.ok(forgedResult.reasonCodes.includes("OPERATION_BINDING_DENIED" as never), forgedResult.reasonCodes.join(","));

  const drifted = redigestEntries(toPlain(successJournal()));
  (drifted.entries as PlainEntry[])[1]!.sourceLockDigest = OTHER_DIGEST;
  const driftResult = verifyUpdateApplyJournalV1(drifted, contextFor());
  assert.equal(driftResult.outcome, "DENIED");
  assert.ok(driftResult.reasonCodes.includes("DIGEST_MISMATCH_DENIED" as never), driftResult.reasonCodes.join(","));
});

test("UD-APPLY-01 missing or invalid independent context denies", () => {
  const journal = successJournal();
  assert.deepEqual(verifyUpdateApplyJournalV1(journal, undefined), {
    outcome: "DENIED",
    reasonCodes: ["INDEPENDENT_CONTEXT_DENIED"],
    exitCode: UPDATE_APPLY_JOURNAL_EXIT_CODES_V1.INDEPENDENT_CONTEXT_DENIED,
  });
  assert.equal(
    verifyUpdateApplyJournalV1(journal, contextFor({ expectedOperationDigest: FORGED_OPERATION_DIGEST })).outcome,
    "DENIED",
  );
  assert.equal(
    verifyUpdateApplyJournalV1(journal, {
      expectedOperationDigest: "nope",
      expectedSourceLockDigest: SOURCE_LOCK_DIGEST,
      expectedTargetLockDigest: TARGET_LOCK_DIGEST,
      expectedRevision: 1,
    } as unknown as UpdateApplyJournalVerificationContextV1).outcome,
    "DENIED",
  );
});

test("UD-APPLY-01 unsupported contract version and wrong terminal state deny", () => {
  const v2 = redigestEntries(toPlain(successJournal()));
  v2.schemaVersion = "chimpmaera.update/apply-journal/v2";
  assert.deepEqual(verifyUpdateApplyJournalV1(v2, contextFor()), {
    outcome: "DENIED",
    reasonCodes: ["UNSUPPORTED_CONTRACT_VERSION_DENIED"],
    exitCode: UPDATE_APPLY_JOURNAL_EXIT_CODES_V1.UNSUPPORTED_CONTRACT_VERSION_DENIED,
  });

  const wrongTerminal = redigestEntries(toPlain(successJournal()));
  wrongTerminal.terminalState = "ROLLED_BACK_ZERO_RESIDUE";
  assert.deepEqual(verifyUpdateApplyJournalV1(wrongTerminal, contextFor()), {
    outcome: "DENIED",
    reasonCodes: ["DIGEST_MISMATCH_DENIED", "TERMINAL_STATE_DENIED"],
    exitCode: UPDATE_APPLY_JOURNAL_EXIT_CODES_V1.DIGEST_MISMATCH_DENIED,
  });
});

test("UD-APPLY-01 parser fails closed without evaluating hostile fixture content", () => {
  assert.deepEqual(parseUpdateApplyJournalV1("not-json", contextFor()), {
    outcome: "DENIED",
    reasonCodes: ["INVALID_JSON_DENIED"],
    exitCode: UPDATE_APPLY_JOURNAL_EXIT_CODES_V1.INVALID_JSON_DENIED,
  });
  (globalThis as Record<string, unknown>).applyPwned = false;
  const hostile = JSON.stringify({ ...toPlain(successJournal()), execute: "globalThis.applyPwned = true" });
  assert.equal(parseUpdateApplyJournalV1(hostile, contextFor()).outcome, "DENIED");
  assert.equal((globalThis as Record<string, unknown>).applyPwned, false);

  const valid = parseUpdateApplyJournalV1(JSON.stringify(successJournal()), contextFor());
  assert.deepEqual(valid, { outcome: "ACCEPTED", reasonCodes: ["APPLY_JOURNAL_ACCEPTED"], exitCode: 0 });
});