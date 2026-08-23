import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { canonicalJson } from "../packages/contracts/src/canonical-json.js";
import {
  EXTENSION_ASSURANCE_RETEST_TRIGGERS_V1,
  evaluateExtensionAssuranceProfileV1,
  extensionAssuranceProfileDigestV1,
  type ExtensionAssuranceProfileV1,
} from "../packages/contracts/src/extension-assurance-profile.js";
import { EXTENSION_ASSURANCE_RETEST_DECISION_SCHEMA_V1 } from "../packages/contracts/src/extension-assurance-retest-policy.js";
import { EXTENSION_ASSURANCE_APPEAL_RESULT_SCHEMA_V1 } from "../packages/contracts/src/extension-assurance-appeal.js";
import {
  EXTENSION_ASSURANCE_RETEST_LEDGER_EVENT_TYPES_V1,
  EXTENSION_ASSURANCE_RETEST_LEDGER_GENESIS_DIGEST_V1,
  EXTENSION_ASSURANCE_RETEST_LEDGER_SCHEMA_V1,
  EXTENSION_ASSURANCE_RETEST_LEDGER_VERIFIER_VERSION_V1,
  evaluateExtensionAssuranceRetestLedgerV1,
  extensionAssuranceRetestLedgerCompletionDigestV1,
  extensionAssuranceRetestLedgerDigestV1,
  extensionAssuranceRetestLedgerEntryDigestV1,
  extensionAssuranceRetestLedgerResultDigestV1,
  projectExtensionAssuranceRetestLedgerV1,
  renderExtensionAssuranceRetestLedgerProjectionV1,
  renderExtensionAssuranceRetestLedgerResultV1,
} from "../packages/contracts/src/extension-assurance-retest-ledger.js";

const RESULT_SCHEMA = "chimpmaera.extension-trust/assurance-result/v1";
const PROFILE_BOUNDARY = "LOCAL_SYNTHETIC_PROFILE_ONLY_NO_TRUST_BADGE_NO_ACCEPTANCE_NO_ACTIVATION_NO_EXECUTION";
const APPEAL_BOUNDARY = "LOCAL_APPEAL_RECORD_ONLY_NO_TRUST_NO_ADMISSION_NO_ACTIVATION_NO_MARKETPLACE";
const LEDGER_BOUNDARY = "LOCAL_RETEST_LEDGER_ONLY_NO_TRUST_NO_ADMISSION_NO_ACTIVATION_NO_MARKETPLACE_NO_EXECUTION";

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

const priorProfile = JSON.parse(readFileSync(
  "tests/fixtures/extension-assurance/positive-profile-v1.json",
  "utf8",
)) as ExtensionAssuranceProfileV1;
const priorProfileDigest = extensionAssuranceProfileDigestV1(priorProfile as unknown as Record<string, unknown>);

function newConformantProfile(): Record<string, any> {
  const draft = structuredClone(priorProfile) as Record<string, any>;
  draft.evaluatedAtMs = 9000;
  draft.evidence = {
    collectedAtMs: 8000,
    expiresAtMs: 20_000,
    subjectDigest: draft.subject.subjectDigest,
    artifactRefs: [ref(71), ref(72)],
  };
  draft.profileDigest = extensionAssuranceProfileDigestV1(draft);
  assert.equal(evaluateExtensionAssuranceProfileV1(draft).outcome, "PROFILE_CONFORMANT");
  return draft;
}
const newProfile = newConformantProfile();
const newProfileDigest = extensionAssuranceProfileDigestV1(newProfile);

const conformantResult = {
  schemaVersion: RESULT_SCHEMA,
  outcome: "PROFILE_CONFORMANT",
  reasonCodes: ["PROFILE_CONFORMANT"],
  publicClaim: "LOCALLY_EVALUATED_SYNTHETIC",
  claimBoundary: PROFILE_BOUNDARY,
};

const DEFAULT_TRIGGERS = ["EVIDENCE_EXPIRED", "MANUAL"];
const falseNegativePriorResult = {
  schemaVersion: RESULT_SCHEMA,
  outcome: "RETEST_REQUIRED",
  reasonCodes: ["FALSE_NEGATIVE_RETEST_REQUIRED"],
  publicClaim: "EVIDENCE_EXPIRED_RETEST_REQUIRED",
  claimBoundary: PROFILE_BOUNDARY,
};
const falseNegativeAppealResult = {
  schemaVersion: EXTENSION_ASSURANCE_APPEAL_RESULT_SCHEMA_V1,
  outcome: "RETEST_REQUIRED",
  reasonCodes: ["FALSE_NEGATIVE_RETEST_REQUIRED"],
  publicClaim: "FALSE_NEGATIVE_RETEST_REQUIRED",
  claimBoundary: APPEAL_BOUNDARY,
};

const EVENT_STATE: Record<string, string> = {
  RETEST_REQUESTED: "RETEST_REQUIRED",
  RETEST_STARTED: "RETEST_IN_PROGRESS",
  RETEST_COMPLETED: "RETEST_CONFORMANT",
  RETEST_DENIED: "RETEST_DENIED",
};

function defaultCompletion(): Record<string, any> {
  const completion = {
    subjectDigest: priorProfile.subject.subjectDigest,
    profileDigest: newProfileDigest,
    profile: structuredClone(newProfile),
    result: structuredClone(conformantResult),
    resultDigest: extensionAssuranceRetestLedgerResultDigestV1(conformantResult),
    evidenceRefs: [ref(71), ref(72)],
    completionDigest: "",
  };
  completion.completionDigest = extensionAssuranceRetestLedgerCompletionDigestV1(completion);
  return completion;
}

interface LedgerOptions {
  events: readonly string[];
  appeal?: Record<string, any> | null;
  completion?: Record<string, any> | null;
  triggers?: readonly string[];
  priorResult?: Record<string, any>;
}

function buildLedger(options: LedgerOptions): Record<string, any> {
  const appeal = options.appeal === undefined ? structuredClone(falseNegativeAppealResult) : options.appeal;
  const triggers = options.triggers ?? DEFAULT_TRIGGERS;
  const priorResult = options.priorResult ?? structuredClone(falseNegativePriorResult);
  const completion = options.completion === undefined ? defaultCompletion() : options.completion;
  const priorResultDigest = extensionAssuranceRetestLedgerResultDigestV1(priorResult);
  const baseTime = 1_700_000_000_000;
  const entries = options.events.map((eventType, index) => ({
    sequence: index + 1,
    revision: index + 1,
    eventType,
    occurredAtMs: baseTime + index * 1_000,
    verifierVersion: EXTENSION_ASSURANCE_RETEST_LEDGER_VERIFIER_VERSION_V1,
    priorProfileDigest,
    priorResultDigest,
    decisionTriggers: [...triggers],
    appealResult: appeal === null ? null : structuredClone(appeal),
    evidenceRefs: [ref(20 + index)],
    conformantCompletion: eventType === "RETEST_COMPLETED" && completion !== null ? structuredClone(completion) : null,
    prevEntryDigest: "",
    entryDigest: "",
  }));
  let prev: string = EXTENSION_ASSURANCE_RETEST_LEDGER_GENESIS_DIGEST_V1;
  for (const entry of entries) {
    entry.prevEntryDigest = prev;
    entry.entryDigest = extensionAssuranceRetestLedgerEntryDigestV1(entry);
    prev = entry.entryDigest;
  }
  const last = options.events[options.events.length - 1] ?? "RETEST_REQUESTED";
  const ledger: Record<string, any> = {
    schemaVersion: EXTENSION_ASSURANCE_RETEST_LEDGER_SCHEMA_V1,
    ledgerId: "retest-ledger:etl-38-0001",
    subject: structuredClone(priorProfile.subject),
    prior: {
      profileId: priorProfile.profileId,
      profileDigest: priorProfileDigest,
      evidenceRefs: [...priorProfile.evidence.artifactRefs],
      result: structuredClone(priorResult),
      resultDigest: priorResultDigest,
    },
    decision: {
      schemaVersion: EXTENSION_ASSURANCE_RETEST_DECISION_SCHEMA_V1,
      decision: "RETEST_REQUIRED",
      triggers: [...triggers],
    },
    appeal: appeal === null ? null : structuredClone(appeal),
    state: EVENT_STATE[last],
    revision: entries.length,
    entries,
    ledgerDigest: "",
  };
  ledger.ledgerDigest = extensionAssuranceRetestLedgerDigestV1(ledger);
  return ledger;
}

function recomputeEntry(ledger: Record<string, any>, index: number): void {
  ledger.entries[index].entryDigest = extensionAssuranceRetestLedgerEntryDigestV1(ledger.entries[index]);
  for (let next = index + 1; next < ledger.entries.length; next += 1) {
    const entry = ledger.entries[next];
    entry.prevEntryDigest = ledger.entries[next - 1].entryDigest;
    entry.entryDigest = extensionAssuranceRetestLedgerEntryDigestV1(entry);
  }
  ledger.ledgerDigest = extensionAssuranceRetestLedgerDigestV1(ledger);
}

function recordedResult(outcome: string, retestRequired: boolean, publicClaim: string): Record<string, any> {
  return {
    schemaVersion: "chimpmaera.extension-trust/assurance-retest-ledger-result/v1",
    outcome,
    retestRequired,
    reasonCodes: ["RETEST_LEDGER_RECORDED"],
    publicClaim,
    claimBoundary: LEDGER_BOUNDARY,
  };
}

test("RET-01 freezes the closed event vocabulary, boundary and verifier version", () => {
  assert.deepEqual([...EXTENSION_ASSURANCE_RETEST_LEDGER_EVENT_TYPES_V1], [
    "RETEST_REQUESTED", "RETEST_STARTED", "RETEST_COMPLETED", "RETEST_DENIED",
  ]);
  assert.equal(EXTENSION_ASSURANCE_RETEST_LEDGER_SCHEMA_V1, "chimpmaera.extension-trust/assurance-retest-ledger/v1");
  assert.equal(EXTENSION_ASSURANCE_RETEST_LEDGER_VERIFIER_VERSION_V1, "1.0.0");
  assert.equal(EXTENSION_ASSURANCE_RETEST_LEDGER_GENESIS_DIGEST_V1, "0".repeat(64));
  assert.equal(
    LEDGER_BOUNDARY,
    "LOCAL_RETEST_LEDGER_ONLY_NO_TRUST_NO_ADMISSION_NO_ACTIVATION_NO_MARKETPLACE_NO_EXECUTION",
  );
  assert.deepEqual([...EXTENSION_ASSURANCE_RETEST_TRIGGERS_V1].sort(), [
    "EVIDENCE_EXPIRED", "FALSE_NEGATIVE_CONFIRMED", "MANUAL", "POLICY_CHANGED", "PROFILE_CHANGED", "SUBJECT_CHANGED",
  ]);
});

test("RET-01 a request-start-complete chain with new conformant bound evidence closes retest deterministically", () => {
  const ledger = buildLedger({ events: ["RETEST_REQUESTED", "RETEST_STARTED", "RETEST_COMPLETED"] });
  assert.deepEqual(evaluateExtensionAssuranceRetestLedgerV1(ledger),
    recordedResult("RETEST_CONFORMANT", false, "LOCAL_RETEST_CONFORMANT"));
  assert.equal(ledger.ledgerDigest, extensionAssuranceRetestLedgerDigestV1(ledger));
  assert.deepEqual(projectExtensionAssuranceRetestLedgerV1(ledger), {
    schemaVersion: "chimpmaera.extension-trust/assurance-retest-ledger-projection/v1",
    outcome: "RETEST_CONFORMANT",
    retestRequired: false,
    steps: [
      { sequence: 1, eventType: "RETEST_REQUESTED", stateAfter: "RETEST_REQUIRED", triggers: DEFAULT_TRIGGERS },
      { sequence: 2, eventType: "RETEST_STARTED", stateAfter: "RETEST_IN_PROGRESS", triggers: DEFAULT_TRIGGERS },
      { sequence: 3, eventType: "RETEST_COMPLETED", stateAfter: "RETEST_CONFORMANT", triggers: DEFAULT_TRIGGERS },
    ],
  });
  assert.equal(
    canonicalJson(projectExtensionAssuranceRetestLedgerV1(ledger)),
    renderExtensionAssuranceRetestLedgerProjectionV1(ledger),
  );
  const resultBytes = renderExtensionAssuranceRetestLedgerResultV1(ledger);
  const projectionBytes = renderExtensionAssuranceRetestLedgerProjectionV1(ledger);
  for (let repetition = 0; repetition < 25; repetition += 1) {
    const reordered = reorderKeys(ledger, repetition) as Record<string, any>;
    assert.equal(extensionAssuranceRetestLedgerDigestV1(reordered), ledger.ledgerDigest, String(repetition));
    assert.equal(renderExtensionAssuranceRetestLedgerResultV1(reordered), resultBytes, String(repetition));
    assert.equal(renderExtensionAssuranceRetestLedgerProjectionV1(reordered), projectionBytes, String(repetition));
  }
});

test("RET-01 a conformant completion clears a confirmed-false-negative prior only via new bound evidence", () => {
  const ledger = buildLedger({ events: ["RETEST_REQUESTED", "RETEST_STARTED", "RETEST_COMPLETED"] });
  assert.deepEqual(ledger.prior.result.reasonCodes, ["FALSE_NEGATIVE_RETEST_REQUIRED"]);
  assert.deepEqual(ledger.entries[2].conformantCompletion, defaultCompletion());
  assert.deepEqual(evaluateExtensionAssuranceRetestLedgerV1(ledger),
    recordedResult("RETEST_CONFORMANT", false, "LOCAL_RETEST_CONFORMANT"));
});

test("RET-02 a valid requested or denied chain remains RETEST_REQUIRED with exact triggers and appeal binding", () => {
  const requested = buildLedger({ events: ["RETEST_REQUESTED"] });
  assert.deepEqual(evaluateExtensionAssuranceRetestLedgerV1(requested),
    recordedResult("RETEST_REQUESTED", true, "LOCAL_RETEST_REQUESTED"));
  const denied = buildLedger({ events: ["RETEST_REQUESTED", "RETEST_DENIED"] });
  assert.deepEqual(evaluateExtensionAssuranceRetestLedgerV1(denied),
    recordedResult("RETEST_DENIED", true, "LOCAL_RETEST_DENIED"));
  for (const candidate of [requested, denied]) {
    assert.deepEqual(candidate.appeal, falseNegativeAppealResult);
    assert.deepEqual(candidate.entries[0].appealResult, falseNegativeAppealResult);
    const projection = projectExtensionAssuranceRetestLedgerV1(candidate);
    assert.equal(projection.retestRequired, true);
    for (const step of projection.steps) {
      assert.deepEqual(step.triggers, DEFAULT_TRIGGERS);
    }
    assert.equal(projection.steps.length, candidate.entries.length);
  }
});

function assertDenied(ledger: Record<string, any>, ...expectedReasons: readonly string[]): void {
  const result = evaluateExtensionAssuranceRetestLedgerV1(ledger);
  assert.equal(result.outcome, "DENIED");
  assert.equal(result.retestRequired, true);
  assert.equal(result.publicClaim, "RETEST_LEDGER_DENIED");
  assert.equal(result.claimBoundary, LEDGER_BOUNDARY);
  for (const reason of expectedReasons) {
    assert.ok((result.reasonCodes as readonly string[]).includes(reason),
      `${reason} in ${result.reasonCodes.join(",")}`);
  }
}

test("RET-03 denies replayed, gapped or time-reversed chains and keeps retest sticky", () => {
  const replay = buildLedger({ events: ["RETEST_REQUESTED", "RETEST_STARTED"] });
  replay.entries[1].prevEntryDigest = EXTENSION_ASSURANCE_RETEST_LEDGER_GENESIS_DIGEST_V1;
  recomputeEntry(replay, 1);
  assertDenied(replay, "REVISION_SEQUENCE_DENIED");

  const gap = buildLedger({ events: ["RETEST_REQUESTED", "RETEST_STARTED"] });
  gap.entries[1].sequence = 3;
  gap.entries[1].revision = 3;
  recomputeEntry(gap, 1);
  assertDenied(gap, "REVISION_SEQUENCE_DENIED");

  const revisionGap = buildLedger({ events: ["RETEST_REQUESTED", "RETEST_STARTED"] });
  revisionGap.revision = revisionGap.entries.length + 1;
  revisionGap.ledgerDigest = extensionAssuranceRetestLedgerDigestV1(revisionGap);
  assertDenied(revisionGap, "REVISION_SEQUENCE_DENIED");

  const timeReversal = buildLedger({ events: ["RETEST_REQUESTED", "RETEST_STARTED"] });
  timeReversal.entries[1].occurredAtMs = timeReversal.entries[0].occurredAtMs - 5;
  recomputeEntry(timeReversal, 1);
  assertDenied(timeReversal, "REVISION_SEQUENCE_DENIED");
});

test("RET-04 denies digest drift at every level of the chain", () => {
  const entryDrift = buildLedger({ events: ["RETEST_REQUESTED"] });
  entryDrift.entries[0].entryDigest = hex(61);
  entryDrift.ledgerDigest = extensionAssuranceRetestLedgerDigestV1(entryDrift);
  assertDenied(entryDrift, "DIGEST_MISMATCH_DENIED");

  const ledgerDrift = buildLedger({ events: ["RETEST_REQUESTED"] });
  ledgerDrift.ledgerDigest = hex(60);
  assertDenied(ledgerDrift, "DIGEST_MISMATCH_DENIED");

  const completionDrift = buildLedger({ events: ["RETEST_REQUESTED", "RETEST_STARTED", "RETEST_COMPLETED"] });
  completionDrift.entries[2].conformantCompletion.resultDigest = hex(62);
  recomputeEntry(completionDrift, 2);
  assertDenied(completionDrift, "DIGEST_MISMATCH_DENIED");

  const completionEnvelopeDrift = buildLedger({
    events: ["RETEST_REQUESTED", "RETEST_STARTED", "RETEST_COMPLETED"],
  });
  completionEnvelopeDrift.entries[2].conformantCompletion.completionDigest = hex(67);
  recomputeEntry(completionEnvelopeDrift, 2);
  assertDenied(completionEnvelopeDrift, "DIGEST_MISMATCH_DENIED");

  const priorDrift = buildLedger({ events: ["RETEST_REQUESTED"] });
  priorDrift.prior.resultDigest = hex(63);
  priorDrift.ledgerDigest = extensionAssuranceRetestLedgerDigestV1(priorDrift);
  assertDenied(priorDrift, "PRIOR_BINDING_DENIED");
});

test("RET-05 denies stale prior profile or result bindings on entries", () => {
  const staleProfile = buildLedger({ events: ["RETEST_REQUESTED"] });
  staleProfile.entries[0].priorProfileDigest = hex(64);
  recomputeEntry(staleProfile, 0);
  assertDenied(staleProfile, "PRIOR_BINDING_DENIED");

  const staleResult = buildLedger({ events: ["RETEST_REQUESTED"] });
  staleResult.entries[0].priorResultDigest = hex(65);
  recomputeEntry(staleResult, 0);
  assertDenied(staleResult, "PRIOR_BINDING_DENIED");
});

test("RET-06 denies a trigger mismatch between the decision binding and the entries", () => {
  const drifted = buildLedger({ events: ["RETEST_REQUESTED", "RETEST_STARTED"] });
  drifted.entries[0].decisionTriggers = ["SUBJECT_CHANGED"];
  recomputeEntry(drifted, 0);
  assertDenied(drifted, "DECISION_TRIGGER_MISMATCH_DENIED");

  const dropped = buildLedger({ events: ["RETEST_REQUESTED"] });
  dropped.decision.triggers = ["EVIDENCE_EXPIRED"];
  dropped.ledgerDigest = extensionAssuranceRetestLedgerDigestV1(dropped);
  assertDenied(dropped, "DECISION_TRIGGER_MISMATCH_DENIED");
});

test("RET-07 denies appeal result binding drift", () => {
  const drifted = buildLedger({ events: ["RETEST_REQUESTED"] });
  drifted.entries[0].appealResult.outcome = "APPEAL_RECORDED";
  recomputeEntry(drifted, 0);
  assertDenied(drifted, "APPEAL_BINDING_DENIED");

  const absent = buildLedger({ events: ["RETEST_REQUESTED"], appeal: null });
  absent.entries[0].appealResult = structuredClone(falseNegativeAppealResult);
  recomputeEntry(absent, 0);
  assertDenied(absent, "APPEAL_BINDING_DENIED");
});

test("RET-08 denies empty evidence bindings", () => {
  const noEntryEvidence = buildLedger({ events: ["RETEST_REQUESTED"] });
  noEntryEvidence.entries[0].evidenceRefs = [];
  recomputeEntry(noEntryEvidence, 0);
  assertDenied(noEntryEvidence, "EVIDENCE_BINDING_DENIED");

  const noPriorEvidence = buildLedger({ events: ["RETEST_REQUESTED"] });
  noPriorEvidence.prior.evidenceRefs = [];
  noPriorEvidence.ledgerDigest = extensionAssuranceRetestLedgerDigestV1(noPriorEvidence);
  assertDenied(noPriorEvidence, "EVIDENCE_BINDING_DENIED");
});

test("RET-09 denies every event appended after a terminal event", () => {
  for (const terminal of ["RETEST_COMPLETED", "RETEST_DENIED"] as const) {
    const ledger = buildLedger({ events: ["RETEST_REQUESTED", "RETEST_STARTED", terminal] });
    const base = ledger.entries[2];
    ledger.entries.push({
      sequence: 4,
      revision: 4,
      eventType: "RETEST_STARTED",
      occurredAtMs: base.occurredAtMs + 1_000,
      verifierVersion: EXTENSION_ASSURANCE_RETEST_LEDGER_VERIFIER_VERSION_V1,
      priorProfileDigest: base.priorProfileDigest,
      priorResultDigest: base.priorResultDigest,
      decisionTriggers: [...base.decisionTriggers],
      appealResult: structuredClone(base.appealResult),
      evidenceRefs: [ref(23)],
      conformantCompletion: null,
      prevEntryDigest: base.entryDigest,
      entryDigest: "",
    });
    ledger.revision = ledger.entries.length;
    ledger.state = "RETEST_IN_PROGRESS";
    recomputeEntry(ledger, 3);
    assertDenied(ledger, "STATE_TRANSITION_DENIED");
  }
});

test("RET-10 denies a non-request genesis, a state mismatch and a stray completion binding", () => {
  const badGenesis = buildLedger({ events: ["RETEST_REQUESTED"] });
  badGenesis.entries[0].eventType = "RETEST_DENIED";
  badGenesis.state = "RETEST_DENIED";
  recomputeEntry(badGenesis, 0);
  assertDenied(badGenesis, "STATE_TRANSITION_DENIED");

  const stateMismatch = buildLedger({ events: ["RETEST_REQUESTED", "RETEST_STARTED", "RETEST_COMPLETED"] });
  stateMismatch.state = "RETEST_REQUIRED";
  stateMismatch.ledgerDigest = extensionAssuranceRetestLedgerDigestV1(stateMismatch);
  assertDenied(stateMismatch, "STATE_TRANSITION_DENIED");

  const strayCompletion = buildLedger({ events: ["RETEST_REQUESTED", "RETEST_STARTED"] });
  strayCompletion.entries[1].conformantCompletion = defaultCompletion();
  recomputeEntry(strayCompletion, 1);
  assertDenied(strayCompletion, "STATE_TRANSITION_DENIED");
});

test("RET-11 denies a completion without new conformant subject and profile evidence", () => {
  const base = (): Record<string, any> =>
    buildLedger({ events: ["RETEST_REQUESTED", "RETEST_STARTED", "RETEST_COMPLETED"] });

  const withoutCompletion = buildLedger({
    events: ["RETEST_REQUESTED", "RETEST_STARTED", "RETEST_COMPLETED"],
    completion: null,
  });
  assertDenied(withoutCompletion, "CONFORMANT_EVIDENCE_DENIED");

  const staleEvidence = base();
  staleEvidence.entries[2].conformantCompletion.evidenceRefs = [...staleEvidence.prior.evidenceRefs];
  recomputeEntry(staleEvidence, 2);
  assertDenied(staleEvidence, "CONFORMANT_EVIDENCE_DENIED");

  const nonConformant = base();
  nonConformant.entries[2].conformantCompletion.result = {
    schemaVersion: RESULT_SCHEMA,
    outcome: "DENIED",
    reasonCodes: ["HARD_FAIL_DENIED"],
    publicClaim: "ASSURANCE_DENIED",
    claimBoundary: PROFILE_BOUNDARY,
  };
  nonConformant.entries[2].conformantCompletion.resultDigest =
    extensionAssuranceRetestLedgerResultDigestV1(nonConformant.entries[2].conformantCompletion.result);
  recomputeEntry(nonConformant, 2);
  assertDenied(nonConformant, "CONFORMANT_EVIDENCE_DENIED");

  const deniedProfile = base();
  deniedProfile.entries[2].conformantCompletion.profile.checks[0].outcome = "FAIL";
  deniedProfile.entries[2].conformantCompletion.profile.profileDigest =
    extensionAssuranceProfileDigestV1(deniedProfile.entries[2].conformantCompletion.profile);
  deniedProfile.entries[2].conformantCompletion.profileDigest =
    deniedProfile.entries[2].conformantCompletion.profile.profileDigest;
  deniedProfile.entries[2].conformantCompletion.completionDigest =
    extensionAssuranceRetestLedgerCompletionDigestV1(deniedProfile.entries[2].conformantCompletion);
  recomputeEntry(deniedProfile, 2);
  assertDenied(deniedProfile, "CONFORMANT_EVIDENCE_DENIED");

  const sameProfile = base();
  sameProfile.entries[2].conformantCompletion.profileDigest = priorProfileDigest;
  recomputeEntry(sameProfile, 2);
  assertDenied(sameProfile, "CONFORMANT_EVIDENCE_DENIED");

  const otherSubject = base();
  otherSubject.entries[2].conformantCompletion.subjectDigest = hex(66);
  recomputeEntry(otherSubject, 2);
  assertDenied(otherSubject, "CONFORMANT_EVIDENCE_DENIED");

  const noCompletionEvidence = base();
  noCompletionEvidence.entries[2].conformantCompletion.evidenceRefs = [];
  recomputeEntry(noCompletionEvidence, 2);
  assertDenied(noCompletionEvidence, "CONFORMANT_EVIDENCE_DENIED");
});

test("RET-11 denies a forged completion with arbitrary profile digest and self-consistent bindings", () => {
  const forged = buildLedger({ events: ["RETEST_REQUESTED", "RETEST_STARTED", "RETEST_COMPLETED"] });
  const completion = forged.entries[2].conformantCompletion;
  completion.profileDigest = hex(91);
  completion.profile.evidence.artifactRefs = [ref(92), ref(93)];
  completion.profile.profileDigest = extensionAssuranceProfileDigestV1(completion.profile);
  completion.evidenceRefs = [...completion.profile.evidence.artifactRefs];
  completion.result = structuredClone(conformantResult);
  completion.resultDigest = extensionAssuranceRetestLedgerResultDigestV1(completion.result);
  completion.completionDigest = extensionAssuranceRetestLedgerCompletionDigestV1(completion);
  assert.equal(evaluateExtensionAssuranceProfileV1(completion.profile).outcome, "PROFILE_CONFORMANT");
  assert.notEqual(completion.profileDigest, completion.profile.profileDigest);
  recomputeEntry(forged, 2);

  assertDenied(forged, "CONFORMANT_EVIDENCE_DENIED");
});

test("RET-12 denies a drifted verifier version", () => {
  const drifted = buildLedger({ events: ["RETEST_REQUESTED"] });
  drifted.entries[0].verifierVersion = "2.0.0";
  recomputeEntry(drifted, 0);
  assertDenied(drifted, "VERIFIER_VERSION_DENIED");
});

test("RET-13 denies unknown, free-text and authority-granting fields and keeps them out of every projection", () => {
  const sensitive = [
    "-----BEGIN " + "PRIVATE KEY-----",
    ["", "ho" + "me", "operator", "private", "retest-evidence.txt"].join("/"),
    "gh" + "p_seededNotARealCredential000000000",
    "marketplace-endorsement@example.invalid",
  ];
  const injections: ReadonlyArray<{ label: string; apply: (ledger: Record<string, any>) => void }> = [
    { label: "marketplace", apply: (ledger) => { ledger.marketplace = { publish: true }; } },
    { label: "admission", apply: (ledger) => { ledger.admission = "GRANT"; } },
    { label: "activation", apply: (ledger) => { ledger.entries[0].activation = "ENABLED"; } },
    { label: "execution", apply: (ledger) => { ledger.entries[0].execution = { grant: true }; } },
    { label: "free-text", apply: (ledger) => { ledger.entries[0].note = "please approve the retest"; } },
    ...sensitive.map((value, index) => ({
      label: `sensitive-${index}`,
      apply: (ledger: Record<string, any>) => { ledger.entries[0].operatorCredential = value; },
    })),
  ];
  for (const { label, apply } of injections) {
    const ledger = buildLedger({ events: ["RETEST_REQUESTED"] });
    apply(ledger);
    const result = evaluateExtensionAssuranceRetestLedgerV1(ledger);
    assert.deepEqual(result.reasonCodes, ["SCHEMA_DENIED"], label);
    assert.equal(result.outcome, "DENIED", label);
    assert.equal(result.retestRequired, true, label);
    const resultBytes = renderExtensionAssuranceRetestLedgerResultV1(ledger);
    const projectionBytes = renderExtensionAssuranceRetestLedgerProjectionV1(ledger);
    for (const value of sensitive) {
      assert.equal(resultBytes.includes(value), false, label);
      assert.equal(projectionBytes.includes(value), false, label);
    }
    assert.deepEqual(Object.keys(JSON.parse(resultBytes)).sort(), [
      "claimBoundary", "outcome", "publicClaim", "reasonCodes", "retestRequired", "schemaVersion",
    ], label);
    const projection = JSON.parse(projectionBytes) as Record<string, any>;
    assert.deepEqual(Object.keys(projection).sort(), ["outcome", "retestRequired", "schemaVersion", "steps"], label);
    assert.deepEqual(projection.steps, [], label);
  }
});

test("RET-14 the sticky retest-required state survives every denied completion attempt", () => {
  const conformant = buildLedger({ events: ["RETEST_REQUESTED", "RETEST_STARTED", "RETEST_COMPLETED"] });
  conformant.entries[2].conformantCompletion = null;
  const result = evaluateExtensionAssuranceRetestLedgerV1(conformant);
  assert.equal(result.outcome, "DENIED");
  assert.equal(result.retestRequired, true);
  const projection = projectExtensionAssuranceRetestLedgerV1(conformant);
  assert.equal(projection.retestRequired, true);
  assert.deepEqual(projection.steps, []);
});
