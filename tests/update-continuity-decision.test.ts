import assert from "node:assert/strict";
import test from "node:test";
import {
  updateCheckPlanDigestV1,
  updateTupleDigestV1,
  type UpdateLkgV1,
  type UpdateTupleV1,
} from "../packages/contracts/src/update-check-plan.js";
import {
  CONTINUITY_NONE_DIGEST_V1,
  UPDATE_CONTINUITY_DECISION_EXIT_CODES_V1,
  UPDATE_CONTINUITY_DECISION_SCHEMA_V1,
  parseUpdateContinuityDecisionV1,
  projectUpdateContinuityDecisionV1,
  renderUntrustedUpdateContinuityDecisionV1,
  renderVerifiedUpdateContinuityDecisionV1,
  verifyUpdateContinuityDecisionV1,
  type UpdateAcceptedSnapshotV1,
  type UpdateContinuityDecisionInputV1,
  type UpdateContinuityDecisionResultV1,
  type UpdateContinuityObserverV1,
  type UpdateContinuityObservationAvailabilityV1,
  type UpdateContinuityObservationV1,
  type UpdateContinuityVerificationContextV1,
} from "../packages/contracts/src/update-continuity-decision.js";

const OBSERVED_AT_MS = 1_785_819_600_000;
const EVALUATION_TIME_MS = OBSERVED_AT_MS + 1_000;
const MAX_OBSERVATION_AGE_MS = 60_000;
const MAX_SNAPSHOT_AGE_MS = 300_000;
const AUTHORITY_DIGEST = "7".repeat(64);

function axisComponent(componentId: string, version: string, hex: string) {
  return [{ componentId, version, digest: hex.repeat(64) }];
}

function tuple(): UpdateTupleV1 {
  return {
    core: axisComponent("core:control-plane", "1.0.0", "1"),
    packs: axisComponent("pack:company-data", "1.0.0", "2"),
    adapters: axisComponent("adapter:synthetic-read", "1.0.0", "3"),
    policies: axisComponent("policy:safe-guided", "1.0.0", "4"),
    schemas: axisComponent("schema:canonical-company", "1.0.0", "5"),
    generations: axisComponent("generation:fixture-001", "1.0.0", "6"),
  };
}

function alternateTuple(): UpdateTupleV1 {
  return { ...tuple(), core: axisComponent("core:alternate-plane", "1.0.0", "9") };
}

interface AcceptedOverrides {
  readonly snapshotId?: string;
  readonly releaseId?: string;
  readonly tupleValue?: UpdateTupleV1;
  readonly authorityProfileDigest?: string;
  readonly revoked?: boolean;
  readonly observedAtMs?: number;
}

function digestedAccepted(options: AcceptedOverrides = {}): UpdateAcceptedSnapshotV1 {
  const tupleValue = options.tupleValue ?? tuple();
  const base = {
    schemaVersion: "chimpmaera.update/accepted-snapshot/v1" as const,
    snapshotId: options.snapshotId ?? "accepted:installation-001",
    releaseId: options.releaseId ?? "1.0.0",
    tuple: tupleValue,
    tupleDigest: updateTupleDigestV1(tupleValue),
    authorityProfileDigest: options.authorityProfileDigest ?? AUTHORITY_DIGEST,
    revoked: options.revoked ?? false,
    observedAtMs: options.observedAtMs ?? OBSERVED_AT_MS,
  };
  return {
    ...base,
    snapshotDigest: updateCheckPlanDigestV1(base as unknown as Record<string, unknown>, "snapshotDigest"),
  };
}

interface LkgOverrides {
  readonly lkgId?: string;
  readonly releaseId?: string;
  readonly tupleValue?: UpdateTupleV1;
  readonly state?: "COMPLETE" | "INCOMPLETE";
  readonly revoked?: boolean;
  readonly stale?: boolean;
  readonly authorityProfileDigest?: string;
  readonly observedAtMs?: number;
}

function digestedLkg(options: LkgOverrides = {}): UpdateLkgV1 {
  const tupleValue = options.tupleValue ?? tuple();
  const base = {
    schemaVersion: "chimpmaera.update/lkg/v1" as const,
    lkgId: options.lkgId ?? "maintenance:installation-lock-001",
    releaseId: options.releaseId ?? "1.0.0",
    state: options.state ?? "COMPLETE" as const,
    revoked: options.revoked ?? false,
    stale: options.stale ?? false,
    tuple: tupleValue,
    authorityProfileDigest: options.authorityProfileDigest ?? AUTHORITY_DIGEST,
    observedAtMs: options.observedAtMs ?? OBSERVED_AT_MS,
    tupleDigest: updateTupleDigestV1(tupleValue),
  };
  return {
    ...base,
    lkgDigest: updateCheckPlanDigestV1(base as unknown as Record<string, unknown>, "lkgDigest"),
  };
}

interface ObservationOverrides {
  readonly registryId?: string;
  readonly availability?: UpdateContinuityObservationAvailabilityV1;
  readonly status?: "REACHABLE" | "UNREACHABLE";
  readonly observedAtMs?: number;
}

function digestedObservation(options: ObservationOverrides = {}): UpdateContinuityObservationV1 {
  const availability = options.availability ?? "UNAVAILABLE";
  const status = options.status ?? (availability === "UNAVAILABLE" ? "UNREACHABLE" : "REACHABLE");
  const base = {
    schemaVersion: "chimpmaera.update/continuity-observation/v1" as const,
    registryId: options.registryId ?? "registry:psai-central",
    availability,
    status,
    observedAtMs: options.observedAtMs ?? OBSERVED_AT_MS,
  };
  return {
    ...base,
    observationDigest: updateCheckPlanDigestV1(base as unknown as Record<string, unknown>, "observationDigest"),
  };
}

interface ObserverOverrides {
  readonly observerId?: string;
  readonly observerVersion?: string;
}

function digestedObserver(options: ObserverOverrides = {}): UpdateContinuityObserverV1 {
  const base = {
    schemaVersion: "chimpmaera.update/continuity-observer/v1" as const,
    observerId: options.observerId ?? "observer:continuity-verifier",
    observerVersion: options.observerVersion ?? "1.0.0",
  };
  return {
    ...base,
    observerDigest: updateCheckPlanDigestV1(base as unknown as Record<string, unknown>, "observerDigest"),
  };
}

interface BuildInputOptions {
  readonly accepted?: UpdateAcceptedSnapshotV1;
  readonly lkg?: UpdateLkgV1 | null;
  readonly observation?: UpdateContinuityObservationV1;
  readonly observer?: UpdateContinuityObserverV1;
  readonly evaluationTimeMs?: number;
  readonly extra?: Record<string, unknown>;
}

function buildInput(options: BuildInputOptions = {}): UpdateContinuityDecisionInputV1 {
  const base: Record<string, unknown> = {
    schemaVersion: UPDATE_CONTINUITY_DECISION_SCHEMA_V1,
    accepted: options.accepted ?? digestedAccepted(),
    lkg: options.lkg === undefined ? digestedLkg() : options.lkg,
    observation: options.observation ?? digestedObservation(),
    observer: options.observer ?? digestedObserver(),
    evaluationTimeMs: options.evaluationTimeMs ?? EVALUATION_TIME_MS,
    ...(options.extra ?? {}),
  };
  return {
    ...base,
    inputDigest: updateCheckPlanDigestV1(base, "inputDigest"),
  } as unknown as UpdateContinuityDecisionInputV1;
}

interface ContextOverrides {
  readonly expectedAcceptedSnapshotId?: string;
  readonly expectedAcceptedSnapshotDigest?: string;
  readonly expectedAcceptedTuple?: UpdateTupleV1;
  readonly expectedAcceptedAuthorityDigest?: string;
  readonly expectedAcceptedObservedAtMs?: number;
  readonly expectedAcceptedRevoked?: boolean;
  readonly expectedAcceptedEvaluatedAtMs?: number;
  readonly expectedLkgDigest?: string;
  readonly expectedLkgTuple?: UpdateTupleV1;
  readonly expectedLkgAuthorityDigest?: string;
  readonly expectedLkgObservedAtMs?: number;
  readonly expectedLkgRevoked?: boolean;
  readonly expectedLkgEvaluatedAtMs?: number;
  readonly expectedObservationRegistryId?: string;
  readonly expectedObservationAvailability?: UpdateContinuityObservationAvailabilityV1;
  readonly expectedObservationObservedAtMs?: number;
  readonly trustedObserverId?: string;
  readonly trustedObserverVersion?: string;
  readonly evaluationTimeMs?: number;
  readonly maxObservationAgeMs?: number;
  readonly maxSnapshotAgeMs?: number;
}

function contextFor(
  input: UpdateContinuityDecisionInputV1,
  overrides: ContextOverrides = {},
): UpdateContinuityVerificationContextV1 {
  const evaluationTimeMs = overrides.evaluationTimeMs ?? input.evaluationTimeMs;
  return {
    expectedAccepted: {
      snapshotId: overrides.expectedAcceptedSnapshotId ?? input.accepted.snapshotId,
      releaseId: input.accepted.releaseId,
      snapshotDigest: overrides.expectedAcceptedSnapshotDigest ?? input.accepted.snapshotDigest,
      tuple: overrides.expectedAcceptedTuple ?? input.accepted.tuple,
      authorityProfileDigest: overrides.expectedAcceptedAuthorityDigest ?? input.accepted.authorityProfileDigest,
      observedAtMs: overrides.expectedAcceptedObservedAtMs ?? input.accepted.observedAtMs,
      revoked: overrides.expectedAcceptedRevoked ?? input.accepted.revoked,
      evaluatedAtMs: overrides.expectedAcceptedEvaluatedAtMs ?? evaluationTimeMs,
    },
    expectedLkg: input.lkg === null
      ? null
      : {
          lkgId: input.lkg.lkgId,
          releaseId: input.lkg.releaseId,
          lkgDigest: overrides.expectedLkgDigest ?? input.lkg.lkgDigest,
          tuple: overrides.expectedLkgTuple ?? input.lkg.tuple,
          authorityProfileDigest: overrides.expectedLkgAuthorityDigest ?? input.lkg.authorityProfileDigest,
          observedAtMs: overrides.expectedLkgObservedAtMs ?? input.lkg.observedAtMs,
          revoked: overrides.expectedLkgRevoked ?? input.lkg.revoked,
          evaluatedAtMs: overrides.expectedLkgEvaluatedAtMs ?? evaluationTimeMs,
        },
    expectedObservation: {
      registryId: overrides.expectedObservationRegistryId ?? input.observation.registryId,
      availability: overrides.expectedObservationAvailability ?? input.observation.availability,
      observedAtMs: overrides.expectedObservationObservedAtMs ?? input.observation.observedAtMs,
    },
    trustedObserver: {
      observerId: overrides.trustedObserverId ?? input.observer.observerId,
      observerVersion: overrides.trustedObserverVersion ?? input.observer.observerVersion,
    },
    evaluationTimeMs,
    maxObservationAgeMs: overrides.maxObservationAgeMs ?? MAX_OBSERVATION_AGE_MS,
    maxSnapshotAgeMs: overrides.maxSnapshotAgeMs ?? MAX_SNAPSHOT_AGE_MS,
  };
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

function asDenied(result: UpdateContinuityDecisionResultV1, name: string): asserts result is Extract<UpdateContinuityDecisionResultV1, { outcome: "DENIED" }> {
  assert.equal(result.outcome, "DENIED", name);
}

function includesReason(result: UpdateContinuityDecisionResultV1, expected: string, name: string): void {
  asDenied(result, name);
  assert.ok(result.reasonCodes.includes(expected as never), `${name}:${result.reasonCodes.join(",")}`);
}

test("UD-M1 continuity: UNAVAILABLE registry with valid unrevoked Accepted preserves the exact tuple digest", () => {
  const input = buildInput();
  const context = contextFor(input);
  const result = verifyUpdateContinuityDecisionV1(input, context);
  assert.deepEqual(result, {
    outcome: "PRESERVE_ACCEPTED",
    reasonCodes: ["CONTINUITY_ACCEPTED"],
    exitCode: 0,
    preservedTupleDigest: updateTupleDigestV1(tuple()),
    preservedSnapshotDigest: input.accepted.snapshotDigest,
  });
  assertDeeplyFrozen(result);

  const projection = projectUpdateContinuityDecisionV1(input, context);
  assert.equal(projection.decision, "PRESERVE_ACCEPTED");
  assert.equal(projection.readOnly, true);
  assert.equal(projection.registryAvailability, "UNAVAILABLE");
  assert.equal(projection.evaluationTimeMs, EVALUATION_TIME_MS);
  assert.equal(projection.preservedTupleDigest, updateTupleDigestV1(tuple()));
  assert.equal(projection.preservedSnapshotDigest, input.accepted.snapshotDigest);
  assert.equal(projection.rollbackLkgDigest, CONTINUITY_NONE_DIGEST_V1);
  // No registry fallback or execution claim is emitted by the projection.
  assert.equal("registryFallback" in projection, false);
  assert.equal("executionAuthorized" in projection, false);
  assert.equal("rollbackExecuted" in projection, false);
  assertDeeplyFrozen(projection);

  const bytes = renderVerifiedUpdateContinuityDecisionV1(input, context);
  assert.equal(bytes, renderVerifiedUpdateContinuityDecisionV1(input, context));
  assert.equal(JSON.parse(bytes).decision, "PRESERVE_ACCEPTED");
  assert.equal(renderUntrustedUpdateContinuityDecisionV1(input), renderUntrustedUpdateContinuityDecisionV1(input));
});

test("UD-M1 continuity: revoked Accepted with a valid unrevoked LKG selects the exact LKG digest without claiming execution", () => {
  const accepted = digestedAccepted({ revoked: true });
  const lkg = digestedLkg({ revoked: false, stale: false });
  const input = buildInput({ accepted, lkg });
  const context = contextFor(input);
  const result = verifyUpdateContinuityDecisionV1(input, context);
  assert.deepEqual(result, {
    outcome: "ROLLBACK_REQUIRED",
    reasonCodes: ["CONTINUITY_ROLLBACK_REQUIRED"],
    exitCode: UPDATE_CONTINUITY_DECISION_EXIT_CODES_V1.CONTINUITY_ROLLBACK_REQUIRED,
    rollbackLkgDigest: lkg.lkgDigest,
  });
  assertDeeplyFrozen(result);

  const projection = projectUpdateContinuityDecisionV1(input, context);
  assert.equal(projection.decision, "ROLLBACK_REQUIRED");
  assert.equal(projection.readOnly, true);
  assert.equal(projection.rollbackLkgDigest, lkg.lkgDigest);
  assert.equal(projection.preservedTupleDigest, CONTINUITY_NONE_DIGEST_V1);
  assert.equal(projection.preservedSnapshotDigest, CONTINUITY_NONE_DIGEST_V1);
  // The projection grants and performs no rollback or mutation.
  assert.equal("rollbackExecuted" in projection, false);
  assert.equal("mutationAuthorized" in projection, false);
  const rendered = JSON.parse(renderVerifiedUpdateContinuityDecisionV1(input, context));
  assert.equal(rendered.readOnly, true);
});

test("UD-M1 continuity: invalid or revoked LKG with an unusable Accepted enters fixed read-only safe mode", () => {
  // revoked Accepted + revoked LKG
  const revokedLkg = buildInput({
    accepted: digestedAccepted({ revoked: true }),
    lkg: digestedLkg({ revoked: true }),
  });
  const revokedResult = verifyUpdateContinuityDecisionV1(revokedLkg, contextFor(revokedLkg));
  assert.deepEqual(revokedResult, {
    outcome: "ENTER_SAFE_READ_ONLY",
    reasonCodes: ["CONTINUITY_SAFE_READ_ONLY"],
    exitCode: UPDATE_CONTINUITY_DECISION_EXIT_CODES_V1.CONTINUITY_SAFE_READ_ONLY,
    readOnly: true,
  });
  const revokedProjection = projectUpdateContinuityDecisionV1(revokedLkg, contextFor(revokedLkg));
  assert.equal(revokedProjection.decision, "ENTER_SAFE_READ_ONLY");
  assert.equal(revokedProjection.readOnly, true);
  assert.equal(revokedProjection.preservedTupleDigest, CONTINUITY_NONE_DIGEST_V1);
  assert.equal(revokedProjection.rollbackLkgDigest, CONTINUITY_NONE_DIGEST_V1);

  // revoked Accepted + stale LKG
  const staleLkg = buildInput({
    accepted: digestedAccepted({ revoked: true }),
    lkg: digestedLkg({ stale: true }),
  });
  assert.equal(verifyUpdateContinuityDecisionV1(staleLkg, contextFor(staleLkg)).outcome, "ENTER_SAFE_READ_ONLY");

  // revoked Accepted + missing LKG
  const missingLkg = buildInput({
    accepted: digestedAccepted({ revoked: true }),
    lkg: null,
  });
  const missingResult = verifyUpdateContinuityDecisionV1(missingLkg, contextFor(missingLkg));
  assert.equal(missingResult.outcome, "ENTER_SAFE_READ_ONLY");
  assert.equal(projectUpdateContinuityDecisionV1(missingLkg, contextFor(missingLkg)).readOnly, true);
});

test("UD-M1 continuity: a missing LKG is only consistent when the independent context also binds none", () => {
  const input = buildInput({ accepted: digestedAccepted({ revoked: true }), lkg: null });
  const noneContext = contextFor(input);
  assert.equal(noneContext.expectedLkg, null);
  assert.equal(verifyUpdateContinuityDecisionV1(input, noneContext).outcome, "ENTER_SAFE_READ_ONLY");

  // The input has no LKG but the context independently expects one -> denied.
  const expectingLkg = { ...contextFor(buildInput({ accepted: digestedAccepted({ revoked: true }) })) };
  const result = verifyUpdateContinuityDecisionV1(input, expectingLkg);
  assert.equal(result.outcome, "DENIED");
  assert.ok((result.reasonCodes as readonly string[]).includes("INDEPENDENT_CONTEXT_DENIED"));
});

test("UD-M1 continuity: missing context and tuple/authority/snapshot/LKG digest drift deny fail closed", () => {
  const input = buildInput();
  const cases: readonly [string, UpdateContinuityVerificationContextV1 | undefined, string][] = [
    ["missing-context", undefined, "INDEPENDENT_CONTEXT_DENIED"],
    ["accepted-tuple", contextFor(input, { expectedAcceptedTuple: alternateTuple() }), "TUPLE_MISMATCH_DENIED"],
    ["accepted-authority", contextFor(input, { expectedAcceptedAuthorityDigest: "c".repeat(64) }), "AUTHORITY_BINDING_DENIED"],
    ["accepted-snapshot-digest", contextFor(input, { expectedAcceptedSnapshotDigest: "a".repeat(64) }), "DIGEST_MISMATCH_DENIED"],
    ["accepted-id", contextFor(input, { expectedAcceptedSnapshotId: "accepted:different-001" }), "INDEPENDENT_CONTEXT_DENIED"],
    ["lkg-tuple", contextFor(input, { expectedLkgTuple: alternateTuple() }), "TUPLE_MISMATCH_DENIED"],
    ["lkg-digest", contextFor(input, { expectedLkgDigest: "b".repeat(64) }), "DIGEST_MISMATCH_DENIED"],
    ["lkg-authority", contextFor(input, { expectedLkgAuthorityDigest: "d".repeat(64) }), "AUTHORITY_BINDING_DENIED"],
  ];
  for (const [name, context, expected] of cases) {
    includesReason(verifyUpdateContinuityDecisionV1(input, context), expected, name);
  }
});

test("UD-M1 continuity: replay, time reversal, and stale observations deny", () => {
  const input = buildInput();
  const context = contextFor(input);

  // observation observed in the future relative to evaluation time (time reversal)
  const reversed = buildInput({ observation: digestedObservation({ observedAtMs: EVALUATION_TIME_MS + 1 }) });
  includesReason(
    verifyUpdateContinuityDecisionV1(reversed, contextFor(reversed)),
    "OBSERVATION_REPLAY_DENIED",
    "observation-time-reversal",
  );

  // observation older than the maximum observation age (stale)
  const staleObservedAt = OBSERVED_AT_MS - MAX_OBSERVATION_AGE_MS - 1;
  const stale = buildInput({
    observation: digestedObservation({ observedAtMs: staleObservedAt }),
    accepted: digestedAccepted({ observedAtMs: staleObservedAt }),
    lkg: digestedLkg({ observedAtMs: staleObservedAt }),
  });
  includesReason(
    verifyUpdateContinuityDecisionV1(stale, contextFor(stale, { evaluationTimeMs: EVALUATION_TIME_MS })),
    "OBSERVATION_STALE_DENIED",
    "stale-observation",
  );

  // accepted observed in the future (replay of the local snapshot)
  const replayedAccepted = buildInput({ accepted: digestedAccepted({ observedAtMs: EVALUATION_TIME_MS + 5 }) });
  includesReason(
    verifyUpdateContinuityDecisionV1(replayedAccepted, contextFor(replayedAccepted)),
    "OBSERVATION_REPLAY_DENIED",
    "accepted-replay",
  );
});

test("UD-M1 continuity: availability/status contradiction and trusted availability drift deny", () => {
  const contradictory = buildInput({
    observation: digestedObservation({ availability: "UNAVAILABLE", status: "REACHABLE" }),
  });
  includesReason(
    verifyUpdateContinuityDecisionV1(contradictory, contextFor(contradictory, { expectedObservationAvailability: "UNAVAILABLE" })),
    "AVAILABILITY_CONTRADICTION_DENIED",
    "availability-status-contradiction",
  );

  const drifted = buildInput({ observation: digestedObservation({ availability: "AVAILABLE", status: "REACHABLE" }) });
  includesReason(
    verifyUpdateContinuityDecisionV1(drifted, contextFor(drifted, { expectedObservationAvailability: "UNAVAILABLE" })),
    "AVAILABILITY_CONTRADICTION_DENIED",
    "trusted-availability-drift",
  );
});

test("UD-M1 continuity: revocation binding drift denies fail closed", () => {
  const input = buildInput();
  const cases: readonly [string, UpdateContinuityVerificationContextV1, string][] = [
    [
      "accepted-revoked-mismatch",
      contextFor(input, { expectedAcceptedRevoked: true }),
      "REVOCATION_BINDING_DENIED",
    ],
    [
      "accepted-evaluated-at-mismatch",
      contextFor(input, { expectedAcceptedEvaluatedAtMs: EVALUATION_TIME_MS - 1 }),
      "REVOCATION_BINDING_DENIED",
    ],
    [
      "lkg-revoked-mismatch",
      contextFor(input, { expectedLkgRevoked: true }),
      "REVOCATION_BINDING_DENIED",
    ],
    [
      "lkg-evaluated-at-mismatch",
      contextFor(input, { expectedLkgEvaluatedAtMs: EVALUATION_TIME_MS - 1 }),
      "REVOCATION_BINDING_DENIED",
    ],
  ];
  for (const [name, context, expected] of cases) {
    includesReason(verifyUpdateContinuityDecisionV1(input, context), expected, name);
  }
});

test("UD-M1 continuity: observer substitution and non-independent observer identities deny", () => {
  const input = buildInput();
  const context = contextFor(input);

  // Substituted observer (correctly re-digested) that is not the trusted observer.
  const substituted = buildInput({ observer: digestedObserver({ observerId: "observer:other-verifier" }) });
  includesReason(
    verifyUpdateContinuityDecisionV1(substituted, contextFor(substituted, { trustedObserverId: "observer:continuity-verifier" })),
    "OBSERVER_SUBSTITUTION_DENIED",
    "observer-substitution",
  );

  // Observer identity aliases the Accepted snapshot identity (claim-bearing / non-independent).
  const aliasing = buildInput({
    accepted: digestedAccepted({ snapshotId: "accepted:continuity-verifier" }),
    observer: digestedObserver({ observerId: "observer:continuity_verifier" }),
  });
  includesReason(
    verifyUpdateContinuityDecisionV1(aliasing, contextFor(aliasing)),
    "OBSERVER_INDEPENDENCE_DENIED",
    "observer-alias-accepted",
  );
});

test("UD-M1 continuity: observer substitution with an unchanged digest denies via digest drift", () => {
  const input = buildInput();
  const originalObserver = input.observer;
  // Swap the observer identity but keep the original (now stale) observer digest.
  const staleDigestObserver: UpdateContinuityObserverV1 = {
    schemaVersion: originalObserver.schemaVersion,
    observerId: "observer:swapped-verifier",
    observerVersion: originalObserver.observerVersion,
    observerDigest: originalObserver.observerDigest,
  };
  const base = {
    schemaVersion: UPDATE_CONTINUITY_DECISION_SCHEMA_V1,
    accepted: input.accepted,
    lkg: input.lkg,
    observation: input.observation,
    observer: staleDigestObserver,
    evaluationTimeMs: input.evaluationTimeMs,
  };
  const forged = { ...base, inputDigest: updateCheckPlanDigestV1(base, "inputDigest") } as unknown as UpdateContinuityDecisionInputV1;
  includesReason(
    verifyUpdateContinuityDecisionV1(forged, contextFor(forged)),
    "DIGEST_MISMATCH_DENIED",
    "observer-substitution-unchanged-digest",
  );
});

test("UD-M1 continuity: fully re-digested forged envelopes are rejected via independent bindings", () => {
  const input = buildInput();
  const context = contextFor(input);

  // Forge the Accepted snapshot with a different tuple and re-digest it + the input.
  const forgedAccepted = digestedAccepted({ tupleValue: alternateTuple() });
  const forgedInput = buildInput({ accepted: forgedAccepted });
  const forgedResult = verifyUpdateContinuityDecisionV1(forgedInput, contextFor(forgedInput, {
    expectedAcceptedTuple: tuple(),
    expectedAcceptedSnapshotDigest: input.accepted.snapshotDigest,
  }));
  asDenied(forgedResult, "forged-accepted");
  assert.ok(forgedResult.reasonCodes.includes("TUPLE_MISMATCH_DENIED" as never), "forged-accepted tuple drift");
  assert.ok(forgedResult.reasonCodes.includes("DIGEST_MISMATCH_DENIED" as never), "forged-accepted digest drift");

  // Forge the observer envelope and re-digest; the trusted observer binding still rejects it.
  const forgedObserver = digestedObserver({ observerId: "observer:attested-gate", observerVersion: "9.9.9" });
  const forgedObserverInput = buildInput({ observer: forgedObserver });
  includesReason(
    verifyUpdateContinuityDecisionV1(forgedObserverInput, contextFor(forgedObserverInput, {
      trustedObserverId: input.observer.observerId,
      trustedObserverVersion: input.observer.observerVersion,
    })),
    "OBSERVER_SUBSTITUTION_DENIED",
    "forged-observer-envelope",
  );
});

test("UD-M1 continuity: unknown, claim, secret, path, URL, and callback fields deny and never project", () => {
  const input = buildInput();
  const cases: readonly [string, Record<string, unknown>][] = [
    ["unknown-field", { note: "extra" }],
    ["execution-claim", { executionAuthorized: true }],
    ["rollback-claim", { rollbackExecuted: true }],
    ["promotion-claim", { promoted: true }],
    ["url-field", { endpoint: "https://example.internal/callback?token=abc" }],
    ["path-field", { statePath: ["/home", "/alice/private/state.json"].join("") }],
    ["secret-field", { authorization: "Bearer eyJhbGciOiJIUzI1NiJ9" }],
    ["callback-field", { callback: "net/http:Post" }],
  ];
  for (const [name, extra] of cases) {
    const forged = buildInput({ extra });
    const result = verifyUpdateContinuityDecisionV1(forged, contextFor(forged));
    assert.equal(result.outcome, "DENIED", name);
  }
  // The projection never carries claim, secret, path, or URL content.
  const projectionJson = renderVerifiedUpdateContinuityDecisionV1(input, contextFor(input));
  assert.equal(projectionJson.includes("://"), false);
  assert.equal(projectionJson.includes("/home/"), false);
  assert.equal(projectionJson.includes("Bearer "), false);
});

test("UD-M1 continuity: canonical input digests are stable across key reorderings", () => {
  const input = buildInput();
  const context = contextFor(input);
  assert.deepEqual(verifyUpdateContinuityDecisionV1(input, context).outcome, "PRESERVE_ACCEPTED");
  const digest = updateCheckPlanDigestV1(input as unknown as Record<string, unknown>, "inputDigest");
  for (let repetition = 0; repetition < 50; repetition += 1) {
    const reordered = reorderKeys(input, repetition) as UpdateContinuityDecisionInputV1;
    assert.equal(updateCheckPlanDigestV1(reordered as unknown as Record<string, unknown>, "inputDigest"), digest);
    assert.equal(verifyUpdateContinuityDecisionV1(reordered, contextFor(reordered)).outcome, "PRESERVE_ACCEPTED");
  }
});

test("UD-M1 continuity: parsers and verified rendering fail closed", () => {
  const input = buildInput();
  const context = contextFor(input);
  assert.deepEqual(parseUpdateContinuityDecisionV1("not-json", context), {
    outcome: "DENIED",
    reasonCodes: ["INVALID_JSON_DENIED"],
    exitCode: UPDATE_CONTINUITY_DECISION_EXIT_CODES_V1.INVALID_JSON_DENIED,
  });
  assert.throws(() => renderVerifiedUpdateContinuityDecisionV1(input, undefined), /UNSAFE_OR_INVALID_CONTINUITY_DECISION/);

  const revoked = buildInput({ accepted: digestedAccepted({ revoked: true }), lkg: digestedLkg({ revoked: true }) });
  // An inconsistent independent revocation state denies, so the projection fails closed.
  assert.throws(() => projectUpdateContinuityDecisionV1(revoked, contextFor(revoked, { expectedLkgRevoked: false })), /UNSAFE_OR_INVALID_CONTINUITY_DECISION/);

  // Verified rendering is a pure projection: it reads the input once and is deterministic.
  const first = renderVerifiedUpdateContinuityDecisionV1(input, context);
  assert.equal(first, renderVerifiedUpdateContinuityDecisionV1(input, context));
});

test("UD-M1 continuity: unsafe and missing sub-objects deny before canonical digesting", () => {
  const input = buildInput();
  const context = contextFor(input);

  // A nested object carrying a dangerous key is rejected as unsafe JSON.
  const unsafeAccepted = JSON.parse(`{"${"__proto__"}":{"polluted":true}}`) as unknown;
  const withUnsafe: Record<string, unknown> = {
    schemaVersion: UPDATE_CONTINUITY_DECISION_SCHEMA_V1,
    accepted: unsafeAccepted,
    lkg: input.lkg,
    observation: input.observation,
    observer: input.observer,
    evaluationTimeMs: input.evaluationTimeMs,
    inputDigest: "f".repeat(64),
  };
  asDenied(verifyUpdateContinuityDecisionV1(withUnsafe as unknown, undefined), "unsafe-accepted");

  const missingKey = { ...input } as Record<string, unknown>;
  delete missingKey.observation;
  asDenied(verifyUpdateContinuityDecisionV1(missingKey as unknown, context), "missing-observation");
});

test("UD-M1 continuity: negative zero time fields deny at envelope and independent-context boundaries", () => {
  const input = buildInput();
  const forged = structuredClone(input) as unknown as Record<string, unknown>;
  (forged.accepted as Record<string, unknown>).observedAtMs = -0;
  asDenied(verifyUpdateContinuityDecisionV1(forged, contextFor(input)), "negative-zero-snapshot-time");

  const evaluationContext = { ...contextFor(input), evaluationTimeMs: -0 };
  asDenied(verifyUpdateContinuityDecisionV1(input, evaluationContext), "negative-zero-evaluation-time");

  const ageContext = { ...contextFor(input), maxObservationAgeMs: -0 };
  asDenied(verifyUpdateContinuityDecisionV1(input, ageContext), "negative-zero-max-age");
});

test("UD-M1 continuity #53: measured fully digested 01.0.0 Accepted/observer input must deny before any decision", () => {
  // Measured live prerequisite: a fully digested input with a matching independent
  // context whose Accepted releaseId and observerVersion are the non-canonical
  // "01.0.0" returned PRESERVE_ACCEPTED. Canonical SemVer 2.0.0 must reject the
  // local version grammar before any continuity decision or public projection.
  const input = buildInput({
    accepted: digestedAccepted({ releaseId: "01.0.0" }),
    observer: digestedObserver({ observerVersion: "01.0.0" }),
  });
  const context = contextFor(input);
  const result = verifyUpdateContinuityDecisionV1(input, context);
  assert.equal(result.outcome, "DENIED", "measured-01.0.0-accepted-observer");
  includesReason(result, "SCHEMA_DENIED", "measured-01.0.0-accepted-observer");
  assert.equal(result.exitCode, UPDATE_CONTINUITY_DECISION_EXIT_CODES_V1.SCHEMA_DENIED, "measured-01.0.0-exit-code");
  assert.throws(
    () => projectUpdateContinuityDecisionV1(input, context),
    /UNSAFE_OR_INVALID_CONTINUITY_DECISION/,
    "measured-01.0.0-projection",
  );
});

test("UD-M1 continuity #53: canonical SemVer 2.0.0 release/observer versions retain the frozen decisions", () => {
  const canonicalVersions: readonly string[] = ["0.0.0", "1.2.3", "0.2.0-poc.20260823.6"];
  for (const version of canonicalVersions) {
    const input = buildInput({
      accepted: digestedAccepted({ releaseId: version }),
      lkg: digestedLkg({ releaseId: version }),
      observer: digestedObserver({ observerVersion: version }),
    });
    const context = contextFor(input);
    assert.deepEqual(
      verifyUpdateContinuityDecisionV1(input, context),
      {
        outcome: "PRESERVE_ACCEPTED",
        reasonCodes: ["CONTINUITY_ACCEPTED"],
        exitCode: 0,
        preservedTupleDigest: updateTupleDigestV1(tuple()),
        preservedSnapshotDigest: input.accepted.snapshotDigest,
      },
      `canonical-${version}-preserve-accepted`,
    );
    const projection = projectUpdateContinuityDecisionV1(input, context);
    assert.equal(projection.decision, "PRESERVE_ACCEPTED", `canonical-${version}-projection`);
    assert.equal(projection.rollbackLkgDigest, CONTINUITY_NONE_DIGEST_V1, `canonical-${version}-none-digest`);
  }

  const rollbackLkg = digestedLkg({ releaseId: "0.2.0-poc.20260823.6" });
  const rollbackInput = buildInput({
    accepted: digestedAccepted({ revoked: true, releaseId: "1.2.3" }),
    lkg: rollbackLkg,
    observer: digestedObserver({ observerVersion: "0.0.0" }),
  });
  assert.deepEqual(
    verifyUpdateContinuityDecisionV1(rollbackInput, contextFor(rollbackInput)),
    {
      outcome: "ROLLBACK_REQUIRED",
      reasonCodes: ["CONTINUITY_ROLLBACK_REQUIRED"],
      exitCode: UPDATE_CONTINUITY_DECISION_EXIT_CODES_V1.CONTINUITY_ROLLBACK_REQUIRED,
      rollbackLkgDigest: rollbackLkg.lkgDigest,
    },
    "canonical-versions-rollback-required",
  );
  assert.equal(
    projectUpdateContinuityDecisionV1(rollbackInput, contextFor(rollbackInput)).decision,
    "ROLLBACK_REQUIRED",
    "canonical-versions-rollback-projection",
  );

  const safeReadOnlyInput = buildInput({
    accepted: digestedAccepted({ revoked: true, releaseId: "0.0.0" }),
    lkg: digestedLkg({ revoked: true, releaseId: "1.2.3" }),
    observer: digestedObserver({ observerVersion: "0.2.0-poc.20260823.6" }),
  });
  assert.deepEqual(
    verifyUpdateContinuityDecisionV1(safeReadOnlyInput, contextFor(safeReadOnlyInput)),
    {
      outcome: "ENTER_SAFE_READ_ONLY",
      reasonCodes: ["CONTINUITY_SAFE_READ_ONLY"],
      exitCode: UPDATE_CONTINUITY_DECISION_EXIT_CODES_V1.CONTINUITY_SAFE_READ_ONLY,
      readOnly: true,
    },
    "canonical-versions-safe-read-only",
  );
  assert.equal(
    projectUpdateContinuityDecisionV1(safeReadOnlyInput, contextFor(safeReadOnlyInput)).decision,
    "ENTER_SAFE_READ_ONLY",
    "canonical-versions-safe-read-only-projection",
  );
});

test("UD-M1 continuity #53: non-canonical Accepted/LKG/observer versions deny before any decision or projection", () => {
  const rejectedVersions: readonly string[] = [
    "01.0.0",     // leading-zero core number (measured)
    "1.02.3",     // leading-zero core number
    "1.2.03",     // leading-zero core number
    "00.0.0",     // leading-zero core number
    "1.2.3-01",   // numeric pre-release identifier with leading zero
    "1.2.3-.",    // empty pre-release identifier after separator
    "1.2.3-..",   // repeated pre-release separator
    "1.2.3-a..b", // repeated pre-release separator
    "1.2.3-a.",   // trailing pre-release separator
    "1.2.3-",     // empty pre-release after trailing separator
    "latest",     // mutable dist-tag alias
    "1.2.x",      // mutable range
    "*",          // mutable range
    "^1.2.3",     // mutable range
    "1.2",        // missing core component
    "v1.2.3",     // non-canonical prefix
    "1.2.3+",     // empty build metadata
    "1.2.3+b..c", // empty build identifier
  ];
  for (const version of rejectedVersions) {
    const acceptedInput = buildInput({ accepted: digestedAccepted({ releaseId: version }) });
    const acceptedContext = contextFor(acceptedInput);
    includesReason(
      verifyUpdateContinuityDecisionV1(acceptedInput, acceptedContext),
      "SCHEMA_DENIED",
      `accepted-release-${version}`,
    );
    assert.throws(
      () => projectUpdateContinuityDecisionV1(acceptedInput, acceptedContext),
      /UNSAFE_OR_INVALID_CONTINUITY_DECISION/,
      `accepted-release-projection-${version}`,
    );

    const lkgInput = buildInput({ lkg: digestedLkg({ releaseId: version }) });
    includesReason(
      verifyUpdateContinuityDecisionV1(lkgInput, contextFor(lkgInput)),
      "SCHEMA_DENIED",
      `lkg-release-${version}`,
    );

    const observerInput = buildInput({ observer: digestedObserver({ observerVersion: version }) });
    includesReason(
      verifyUpdateContinuityDecisionV1(observerInput, contextFor(observerInput)),
      "SCHEMA_DENIED",
      `observer-version-${version}`,
    );
  }
});

test("UD-M1 continuity #53: non-canonical independent context versions deny fail closed", () => {
  const input = buildInput();
  const base = contextFor(input);

  const badAcceptedContext = { ...base, expectedAccepted: { ...base.expectedAccepted, releaseId: "01.0.0" } };
  includesReason(
    verifyUpdateContinuityDecisionV1(input, badAcceptedContext),
    "INDEPENDENT_CONTEXT_DENIED",
    "context-accepted-release-leading-zero",
  );

  const badLkgContext = { ...base, expectedLkg: { ...base.expectedLkg!, releaseId: "1.2.3-01" } };
  includesReason(
    verifyUpdateContinuityDecisionV1(input, badLkgContext),
    "INDEPENDENT_CONTEXT_DENIED",
    "context-lkg-release-prerelease-leading-zero",
  );

  const badObserverContext = { ...base, trustedObserver: { ...base.trustedObserver, observerVersion: "01.0.0" } };
  includesReason(
    verifyUpdateContinuityDecisionV1(input, badObserverContext),
    "INDEPENDENT_CONTEXT_DENIED",
    "context-observer-version-leading-zero",
  );

  const badObserverSeparatorContext = {
    ...base,
    trustedObserver: { ...base.trustedObserver, observerVersion: "1.2.3-a..b" },
  };
  includesReason(
    verifyUpdateContinuityDecisionV1(input, badObserverSeparatorContext),
    "INDEPENDENT_CONTEXT_DENIED",
    "context-observer-version-repeated-separator",
  );

  assert.throws(
    () => projectUpdateContinuityDecisionV1(input, badAcceptedContext),
    /UNSAFE_OR_INVALID_CONTINUITY_DECISION/,
    "context-projection",
  );
});