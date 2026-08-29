import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import Ajv2020 from "ajv/dist/2020.js";
import * as contracts from "../packages/contracts/src/index.js";
import {
  UPDATE_CHECK_PLAN_EXIT_CODES_V1,
  UPDATE_CHECK_PLAN_SCHEMA_V1,
  UPDATE_SAFE_MODE_EXIT_CODE_V1,
  freezeUpdateCheckPlanCandidateV1,
  parseUpdateCheckPlanV1,
  parseUpdateHealthReportV1,
  renderRedactedUpdateHealthReportV1,
  renderUntrustedUpdateCheckPlanV1,
  renderVerifiedUpdateCheckPlanV1,
  runFixtureHealthReportV1,
  updateCheckPlanDigestV1,
  updateTupleDigestV1,
  verifyUpdateCheckPlanV1,
  verifyUpdateHealthReportV1,
  type UpdateCandidateV1,
  type UpdateCheckPlanV1,
  type UpdateCompatibilityDecisionV1,
  type UpdateHealthCheckV1,
  type UpdateHealthProfileV1,
  type UpdateHealthReportV1,
  type UpdateHealthVerificationContextV1,
  type UpdateLkgV1,
  type UpdatePlanVerificationContextV1,
  type UpdateSafeModeReasonV1,
  type UpdateTupleV1,
} from "../packages/contracts/src/index.js";

const OBSERVED_AT_MS = 1_785_819_600_000;
const ISSUED_AT_MS = OBSERVED_AT_MS + 500;
const EVALUATION_TIME_MS = OBSERVED_AT_MS + 1_000;
const MAX_LKG_AGE_MS = 60_000;
const TARGET_AUTHORITY_DIGEST = "7".repeat(64);
const LKG_AUTHORITY_DIGEST = TARGET_AUTHORITY_DIGEST;

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
  return {
    ...tuple(),
    core: axisComponent("core:alternate-plane", "1.0.0", "9"),
  };
}

// Exact tuples and identities pinned by docs/evidence/conveyor/sol-psai53-state-reconcile-01.json
// (`exactTuplePin` and `identityBoundary`).
const BOUNDARY_SOURCE_TUPLE_DIGEST = "21dcfb4af804336ad0dfcd4804e3d617e3ba04291a69a26aba73bad756526ba4";
const BOUNDARY_TARGET_TUPLE_DIGEST = "8f873e2a8c3dd819a2bcc68b4865c9e6f60f40fb1d20823054829e5758375088";
const BOUNDARY_CANDIDATE_ID = "candidate:synthetic-001";
const BOUNDARY_UPDATER_ID = "updater:fixture-only";
const BOUNDARY_ATTESTOR_ID = "attestor:attestation-gate";
const BOUNDARY_VERIFIER_ID = "verifier:independent-readback";
const BOUNDARY_PROMOTER_ID = "promoter:promotion-gate";

function boundarySourceTuple(): UpdateTupleV1 {
  return {
    core: axisComponent("core:safe-guided", "1.0.0", "1"),
    packs: axisComponent("pack:general", "1.0.0", "2"),
    adapters: axisComponent("adapter:dev", "1.0.0", "3"),
    policies: axisComponent("policy:default", "1.0.0", "4"),
    schemas: axisComponent("schema:catalog", "1.0.0", "5"),
    generations: axisComponent("generation:safe-guided", "1.0.0", "6"),
  };
}

function boundaryTargetTuple(): UpdateTupleV1 {
  return {
    core: axisComponent("core:safe-guided", "1.1.0", "1"),
    packs: axisComponent("pack:general", "1.0.0", "2"),
    adapters: axisComponent("adapter:dev", "1.0.0", "3"),
    policies: axisComponent("policy:default", "2.0.0", "4"),
    schemas: axisComponent("schema:catalog", "1.0.0", "5"),
    generations: axisComponent("generation:safe-guided", "1.0.0", "6"),
  };
}

function reorderedBoundaryTargetTuple(): UpdateTupleV1 {
  const target = boundaryTargetTuple();
  return {
    generations: target.generations,
    schemas: target.schemas,
    policies: target.policies,
    adapters: target.adapters,
    packs: target.packs,
    core: target.core.map((component) => ({ digest: component.digest, version: component.version, componentId: component.componentId })),
  };
}

function digestedCandidate(options: {
  readonly targetTuple?: UpdateTupleV1;
  readonly authorityProfileDigest?: string;
  readonly candidateId?: string;
  readonly attestedBy?: string;
  readonly promotedBy?: string;
  readonly synthetic?: boolean;
  readonly immutable?: boolean;
} = {}): UpdateCandidateV1 {
  const targetTuple = options.targetTuple ?? tuple();
  const base = {
    schemaVersion: "chimpmaera.update/candidate/v1" as const,
    candidateId: options.candidateId ?? "candidate:synthetic-001",
    releaseId: "0.2.0-poc.20260804.4",
    synthetic: options.synthetic ?? true,
    immutable: options.immutable ?? true,
    source: "SYNTHETIC_ISOLATED" as const,
    targetTuple,
    targetTupleDigest: updateTupleDigestV1(targetTuple),
    authorityProfileDigest: options.authorityProfileDigest ?? TARGET_AUTHORITY_DIGEST,
    attestedBy: options.attestedBy ?? "attestor:attestation-gate",
    promotedBy: options.promotedBy ?? "promoter:promotion-gate",
  };
  return {
    ...base,
    digest: updateCheckPlanDigestV1(base as unknown as Record<string, unknown>, "digest"),
  };
}

function digestedLkg(options: {
  readonly tupleValue?: UpdateTupleV1;
  readonly state?: "COMPLETE" | "INCOMPLETE";
  readonly revoked?: boolean;
  readonly stale?: boolean;
  readonly authorityProfileDigest?: string;
  readonly observedAtMs?: number;
} = {}): UpdateLkgV1 {
  const tupleValue = options.tupleValue ?? tuple();
  const base = {
    schemaVersion: "chimpmaera.update/lkg/v1" as const,
    lkgId: "maintenance:installation-lock-001",
    releaseId: "0.2.0-poc.20260804.4",
    state: options.state ?? (tupleValue.generations.length > 0 ? "COMPLETE" as const : "INCOMPLETE" as const),
    revoked: options.revoked ?? false,
    stale: options.stale ?? false,
    tuple: tupleValue,
    authorityProfileDigest: options.authorityProfileDigest ?? LKG_AUTHORITY_DIGEST,
    observedAtMs: options.observedAtMs ?? OBSERVED_AT_MS,
    tupleDigest: updateTupleDigestV1(tupleValue),
  };
  return {
    ...base,
    lkgDigest: updateCheckPlanDigestV1(base as unknown as Record<string, unknown>, "lkgDigest"),
  };
}

function digestedCompatibility(options: {
  readonly candidateDigest: string;
  readonly lkgDigest: string;
  readonly resolvedBy?: string;
  readonly verdict?: "COMPATIBLE" | "INCOMPATIBLE";
  readonly authorityAdded?: readonly string[];
  readonly authorityRemoved?: readonly string[];
}): UpdateCompatibilityDecisionV1 {
  const base = {
    schemaVersion: "chimpmaera.update/compatibility-decision/v1" as const,
    decisionId: "compatibility:decision-001",
    subjectCandidateDigest: options.candidateDigest,
    subjectLkgDigest: options.lkgDigest,
    verdict: options.verdict ?? "COMPATIBLE",
    authorityDelta: {
      added: options.authorityAdded ?? [],
      removed: options.authorityRemoved ?? [],
    },
    resolvedBy: options.resolvedBy ?? "resolver:compatibility-gate",
  };
  return {
    ...base,
    decisionDigest: updateCheckPlanDigestV1(base as unknown as Record<string, unknown>, "decisionDigest"),
  };
}

interface BuildPlanOptions {
  readonly targetTuple?: UpdateTupleV1;
  readonly lkgTuple?: UpdateTupleV1;
  readonly lkgState?: "COMPLETE" | "INCOMPLETE";
  readonly lkgRevoked?: boolean;
  readonly lkgStale?: boolean;
  readonly candidateAuthorityDigest?: string;
  readonly lkgAuthorityDigest?: string;
  readonly candidateId?: string;
  readonly attestedBy?: string;
  readonly promotedBy?: string;
  readonly resolvedBy?: string;
  readonly candidateSynthetic?: boolean;
  readonly candidateImmutable?: boolean;
  readonly selfAttestation?: boolean;
  readonly selfPromotion?: boolean;
  readonly authorityWidened?: boolean;
  readonly executionAuthorized?: boolean;
  readonly authorityAdded?: readonly string[];
  readonly verdict?: "COMPATIBLE" | "INCOMPATIBLE";
  readonly safeModeReasonCodes?: readonly UpdateSafeModeReasonV1[];
  readonly forceSafeModeActive?: boolean;
  readonly issuedAtMs?: number;
}

function buildPlan(options: BuildPlanOptions = {}): UpdateCheckPlanV1 {
  const candidate = digestedCandidate({
    ...(options.targetTuple !== undefined ? { targetTuple: options.targetTuple } : {}),
    ...(options.candidateAuthorityDigest !== undefined ? { authorityProfileDigest: options.candidateAuthorityDigest } : {}),
    ...(options.candidateId !== undefined ? { candidateId: options.candidateId } : {}),
    ...(options.attestedBy !== undefined ? { attestedBy: options.attestedBy } : {}),
    ...(options.promotedBy !== undefined ? { promotedBy: options.promotedBy } : {}),
    ...(options.candidateSynthetic !== undefined ? { synthetic: options.candidateSynthetic } : {}),
    ...(options.candidateImmutable !== undefined ? { immutable: options.candidateImmutable } : {}),
  });
  const lkg = digestedLkg({
    ...(options.lkgTuple !== undefined ? { tupleValue: options.lkgTuple } : {}),
    ...(options.lkgState !== undefined ? { state: options.lkgState } : {}),
    ...(options.lkgRevoked !== undefined ? { revoked: options.lkgRevoked } : {}),
    ...(options.lkgStale !== undefined ? { stale: options.lkgStale } : {}),
    ...(options.lkgAuthorityDigest !== undefined ? { authorityProfileDigest: options.lkgAuthorityDigest } : {}),
  });
  const compatibility = digestedCompatibility({
    candidateDigest: candidate.digest,
    lkgDigest: lkg.lkgDigest,
    ...(options.resolvedBy !== undefined ? { resolvedBy: options.resolvedBy } : {}),
    ...(options.verdict !== undefined ? { verdict: options.verdict } : {}),
    ...(options.authorityAdded !== undefined ? { authorityAdded: options.authorityAdded } : {}),
  });
  const defaultReasons: readonly UpdateSafeModeReasonV1[] = lkg.state === "INCOMPLETE" ? ["LKG_INCOMPLETE"] : [];
  const reasons = options.safeModeReasonCodes ?? defaultReasons;
  const base = {
    schemaVersion: UPDATE_CHECK_PLAN_SCHEMA_V1,
    planId: "update:check-plan-001",
    mode: "CHECK_ONLY" as const,
    executionAuthorized: options.executionAuthorized ?? false,
    candidate,
    compatibility,
    lkg,
    safeMode: {
      schemaVersion: "chimpmaera.update/safe-mode/v1" as const,
      active: options.forceSafeModeActive ?? reasons.length > 0,
      readOnly: true as const,
      reasonCodes: reasons,
    },
    selfAttestation: options.selfAttestation ?? false,
    selfPromotion: options.selfPromotion ?? false,
    authorityWidened: options.authorityWidened ?? false,
    issuedAtMs: options.issuedAtMs ?? ISSUED_AT_MS,
  };
  return {
    ...base,
    planDigest: updateCheckPlanDigestV1(base as unknown as Record<string, unknown>, "planDigest"),
  };
}

interface ContextOverrides {
  readonly expectedUpdaterId?: string;
  readonly expectedCandidateDigest?: string;
  readonly expectedCandidateId?: string;
  readonly expectedCompatibilityDecisionId?: string;
  readonly expectedCompatibilityDecisionDigest?: string;
  readonly expectedTargetTuple?: UpdateTupleV1;
  readonly expectedTargetAuthorityDigest?: string;
  readonly expectedLkgDigest?: string;
  readonly expectedLkgTuple?: UpdateTupleV1;
  readonly expectedLkgAuthorityDigest?: string;
  readonly expectedObservedAtMs?: number;
  readonly trustedAttestedBy?: string;
  readonly trustedPromotedBy?: string;
  readonly trustedResolvedBy?: string;
  readonly evaluationTimeMs?: number;
  readonly maxLkgAgeMs?: number;
  readonly revocationLkgId?: string;
  readonly revocationLkgDigest?: string;
  readonly independentlyRevoked?: boolean;
  readonly revocationEvaluatedAtMs?: number;
}

function contextFor(plan: UpdateCheckPlanV1, overrides: ContextOverrides = {}): UpdatePlanVerificationContextV1 {
  const evaluationTimeMs = overrides.evaluationTimeMs ?? EVALUATION_TIME_MS;
  return {
    expectedUpdaterId: overrides.expectedUpdaterId ?? BOUNDARY_UPDATER_ID,
    expectedCandidate: {
      candidateId: overrides.expectedCandidateId ?? plan.candidate.candidateId,
      releaseId: plan.candidate.releaseId,
      candidateDigest: overrides.expectedCandidateDigest ?? plan.candidate.digest,
    },
    expectedCompatibility: {
      decisionId: overrides.expectedCompatibilityDecisionId ?? plan.compatibility.decisionId,
      decisionDigest: overrides.expectedCompatibilityDecisionDigest ?? plan.compatibility.decisionDigest,
    },
    expectedTarget: {
      tuple: overrides.expectedTargetTuple ?? plan.candidate.targetTuple,
      authorityProfileDigest: overrides.expectedTargetAuthorityDigest ?? plan.candidate.authorityProfileDigest,
    },
    expectedLkg: {
      lkgId: plan.lkg.lkgId,
      releaseId: plan.lkg.releaseId,
      lkgDigest: overrides.expectedLkgDigest ?? plan.lkg.lkgDigest,
      tuple: overrides.expectedLkgTuple ?? plan.lkg.tuple,
      authorityProfileDigest: overrides.expectedLkgAuthorityDigest ?? plan.lkg.authorityProfileDigest,
      observedAtMs: overrides.expectedObservedAtMs ?? plan.lkg.observedAtMs,
    },
    trustedAuthorities: {
      attestedBy: overrides.trustedAttestedBy ?? plan.candidate.attestedBy,
      promotedBy: overrides.trustedPromotedBy ?? plan.candidate.promotedBy,
      resolvedBy: overrides.trustedResolvedBy ?? plan.compatibility.resolvedBy,
    },
    evaluationTimeMs,
    maxLkgAgeMs: overrides.maxLkgAgeMs ?? MAX_LKG_AGE_MS,
    revocationState: {
      lkgId: overrides.revocationLkgId ?? plan.lkg.lkgId,
      lkgDigest: overrides.revocationLkgDigest ?? plan.lkg.lkgDigest,
      revoked: overrides.independentlyRevoked ?? plan.lkg.revoked,
      evaluatedAtMs: overrides.revocationEvaluatedAtMs ?? evaluationTimeMs,
    },
  };
}

function healthContext(expectedTuple = tuple(), expectedProfile: UpdateHealthProfileV1 = "HEALTH"): UpdateHealthVerificationContextV1 {
  return { expectedTuple, expectedProfile };
}

function checksFor(profile: UpdateHealthProfileV1): UpdateHealthCheckV1[] {
  const checks: UpdateHealthCheckV1[] = [
    { checkId: "check:tuple-lock", status: "PASS", reasonCode: "OBSERVATION_MATCHED" },
  ];
  if (profile === "READINESS") {
    checks.push({ checkId: "check:safe-mode", status: "PASS", reasonCode: "OBSERVATION_MATCHED" });
  }
  return checks;
}

function healthReport(options: {
  readonly profile?: UpdateHealthProfileV1;
  readonly lockedTuple?: UpdateTupleV1;
  readonly checks?: readonly UpdateHealthCheckV1[];
  readonly safeModeReasonCodes?: readonly UpdateSafeModeReasonV1[];
} = {}): UpdateHealthReportV1 {
  const profile = options.profile ?? "HEALTH";
  return runFixtureHealthReportV1({
    reportId: "update:health-report-001",
    profile,
    lockedTuple: options.lockedTuple ?? tuple(),
    checks: options.checks ?? checksFor(profile),
    safeModeReasonCodes: options.safeModeReasonCodes ?? [],
    generatedAtMs: EVALUATION_TIME_MS,
  });
}

function redigestReport(report: UpdateHealthReportV1, patch: Record<string, unknown>): UpdateHealthReportV1 {
  const base = { ...JSON.parse(JSON.stringify(report)) as Record<string, unknown>, ...patch };
  delete base.reportDigest;
  return {
    ...base,
    reportDigest: updateCheckPlanDigestV1(base, "reportDigest"),
  } as unknown as UpdateHealthReportV1;
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

const ajv = new Ajv2020({ allErrors: true, strict: true });
const planSchema = ajv.compile(JSON.parse(readFileSync("schemas/contracts/update-check-plan-v1.schema.json", "utf8")));
const healthSchema = ajv.compile(JSON.parse(readFileSync("schemas/contracts/update-health-report-v1.schema.json", "utf8")));

test("UD-M1 accepted plan requires independent context and renders verified canonical bytes", () => {
  const plan = buildPlan();
  const context = contextFor(plan);
  const result = verifyUpdateCheckPlanV1(plan, context);
  assert.deepEqual(result, { outcome: "ACCEPTED", reasonCodes: ["UPDATE_CHECK_ACCEPTED"], exitCode: 0 });
  assertDeeplyFrozen(result);
  assert.equal(planSchema(plan), true, JSON.stringify(planSchema.errors));
  assert.equal(renderVerifiedUpdateCheckPlanV1(plan, context), renderVerifiedUpdateCheckPlanV1(plan, context));
  assert.equal(renderUntrustedUpdateCheckPlanV1(plan), renderVerifiedUpdateCheckPlanV1(plan, context));
  assert.throws(() => renderVerifiedUpdateCheckPlanV1(plan, undefined), /UNSAFE_OR_INVALID_UPDATE_PLAN/);
});

test("UD-M1 verified plan rendering snapshots a phase-changing input exactly once", () => {
  const plan = buildPlan();
  const context = contextFor(plan);
  let executionAuthorizedReads = 0;
  const phaseChangingPlan = new Proxy(plan, {
    get(target, property, receiver) {
      if (property === "executionAuthorized") {
        executionAuthorizedReads += 1;
        return executionAuthorizedReads === 1 ? false : true;
      }
      return Reflect.get(target, property, receiver) as unknown;
    },
  });

  const bytes = renderVerifiedUpdateCheckPlanV1(phaseChangingPlan, context);
  assert.equal(executionAuthorizedReads, 1);
  const emitted = JSON.parse(bytes) as UpdateCheckPlanV1;
  assert.equal(emitted.executionAuthorized, false);
  assert.deepEqual(verifyUpdateCheckPlanV1(emitted, context), {
    outcome: "ACCEPTED", reasonCodes: ["UPDATE_CHECK_ACCEPTED"], exitCode: 0,
  });
});

test("UD-M1 canonical plan and tuple digests are stable across key reorderings", () => {
  const plan = buildPlan();
  const digest = updateCheckPlanDigestV1(plan as unknown as Record<string, unknown>, "planDigest");
  for (let repetition = 0; repetition < 100; repetition += 1) {
    const reordered = reorderKeys(plan, repetition) as UpdateCheckPlanV1;
    assert.equal(updateCheckPlanDigestV1(reordered as unknown as Record<string, unknown>, "planDigest"), digest);
    assert.equal(verifyUpdateCheckPlanV1(reordered, contextFor(plan)).outcome, "ACCEPTED");
  }
});

test("UD-M1 plan verification denies missing independent context and candidate/compatibility/LKG/tuple/authority mismatch", () => {
  const plan = buildPlan();
  const cases: readonly [string, UpdatePlanVerificationContextV1 | undefined, string][] = [
    ["missing-context", undefined, "INDEPENDENT_CONTEXT_DENIED"],
    ["candidate-digest", contextFor(plan, { expectedCandidateDigest: "a".repeat(64) }), "DIGEST_MISMATCH_DENIED"],
    ["compatibility-digest", contextFor(plan, { expectedCompatibilityDecisionDigest: "f".repeat(64) }), "DIGEST_MISMATCH_DENIED"],
    ["compatibility-id", contextFor(plan, { expectedCompatibilityDecisionId: "compatibility:different-001" }), "INDEPENDENT_CONTEXT_DENIED"],
    ["lkg-digest", contextFor(plan, { expectedLkgDigest: "b".repeat(64) }), "DIGEST_MISMATCH_DENIED"],
    ["target-tuple", contextFor(plan, { expectedTargetTuple: alternateTuple() }), "TUPLE_MISMATCH_DENIED"],
    ["lkg-tuple", contextFor(plan, { expectedLkgTuple: alternateTuple() }), "TUPLE_MISMATCH_DENIED"],
    ["target-authority", contextFor(plan, { expectedTargetAuthorityDigest: "c".repeat(64) }), "AUTHORITY_BINDING_DENIED"],
    ["lkg-authority", contextFor(plan, { expectedLkgAuthorityDigest: "d".repeat(64) }), "AUTHORITY_BINDING_DENIED"],
    ["candidate-id", contextFor(plan, { expectedCandidateId: "candidate:different-001" }), "INDEPENDENT_CONTEXT_DENIED"],
    ["candidate-updater-alias", contextFor(plan, { expectedUpdaterId: "updater:synthetic_001" }), "AUTHORITY_BINDING_DENIED"],
  ];
  for (const [name, context, expected] of cases) {
    const result = verifyUpdateCheckPlanV1(plan, context);
    assert.equal(result.outcome, "DENIED", name);
    assert.ok(result.reasonCodes.includes(expected as never), `${name}:${result.reasonCodes.join(",")}`);
  }
});

test("UD-M1 no-transition authority profiles must match even when independently self-consistent", () => {
  const mismatched = buildPlan({ lkgAuthorityDigest: "8".repeat(64) });
  assert.equal(mismatched.compatibility.authorityDelta.added.length, 0);
  assert.equal(mismatched.compatibility.authorityDelta.removed.length, 0);
  assert.equal(mismatched.authorityWidened, false);
  assert.equal(planSchema(mismatched), true, JSON.stringify(planSchema.errors));
  assert.deepEqual(verifyUpdateCheckPlanV1(mismatched, contextFor(mismatched)).reasonCodes, ["AUTHORITY_BINDING_DENIED"]);

  const accepted = buildPlan();
  assert.equal(accepted.candidate.authorityProfileDigest, accepted.lkg.authorityProfileDigest);
  assert.equal(verifyUpdateCheckPlanV1(accepted, contextFor(accepted)).outcome, "ACCEPTED");
});

test("UD-M1 trusted gate identities are distinct and cannot alias or self-resolve the candidate", () => {
  const aliasPlan = buildPlan({
    attestedBy: "attestor:shared-gate",
    promotedBy: "promoter:shared_gate",
  });
  assert.deepEqual(verifyUpdateCheckPlanV1(aliasPlan, contextFor(aliasPlan)).reasonCodes, ["AUTHORITY_BINDING_DENIED"]);

  const selfResolved = buildPlan({ resolvedBy: "resolver:synthetic-001" });
  const selfResult = verifyUpdateCheckPlanV1(selfResolved, contextFor(selfResolved));
  assert.equal(selfResult.outcome, "DENIED");
  assert.ok(selfResult.reasonCodes.includes("AUTHORITY_BINDING_DENIED"));
  assert.ok(selfResult.reasonCodes.includes("COMPATIBILITY_DENIED"));

  const contextAlias = contextFor(buildPlan(), {
    trustedAttestedBy: "attestor:one-gate",
    trustedPromotedBy: "promoter:one_gate",
  });
  assert.equal(verifyUpdateCheckPlanV1(buildPlan(), contextAlias).outcome, "DENIED");
});

test("UD-M1 caller evaluation time derives LKG freshness and independent revocation denies mismatch or revocation", () => {
  const predating = buildPlan({ issuedAtMs: OBSERVED_AT_MS - 1 });
  assert.equal(planSchema(predating), true, JSON.stringify(planSchema.errors));
  assert.deepEqual(verifyUpdateCheckPlanV1(predating, contextFor(predating)).reasonCodes, ["LKG_FRESHNESS_DENIED"]);

  const stale = buildPlan({ lkgStale: true });
  const staleEvaluation = OBSERVED_AT_MS + MAX_LKG_AGE_MS + 1;
  const staleResult = verifyUpdateCheckPlanV1(stale, contextFor(stale, { evaluationTimeMs: staleEvaluation }));
  assert.equal(staleResult.outcome, "DENIED");
  assert.ok((staleResult.reasonCodes as readonly string[]).includes("LKG_FRESHNESS_DENIED"));

  const freshButDeclaredStale = buildPlan({ lkgStale: true });
  assert.ok((verifyUpdateCheckPlanV1(freshButDeclaredStale, contextFor(freshButDeclaredStale)).reasonCodes as readonly string[])
    .includes("LKG_FRESHNESS_DENIED"));

  const revoked = buildPlan({ lkgRevoked: true });
  assert.ok((verifyUpdateCheckPlanV1(revoked, contextFor(revoked)).reasonCodes as readonly string[])
    .includes("LKG_REVOCATION_DENIED"));

  const plan = buildPlan();
  const mismatches = [
    contextFor(plan, { independentlyRevoked: true }),
    contextFor(plan, { revocationLkgDigest: "e".repeat(64) }),
    contextFor(plan, { revocationEvaluatedAtMs: EVALUATION_TIME_MS - 1 }),
  ];
  for (const context of mismatches) {
    assert.ok((verifyUpdateCheckPlanV1(plan, context).reasonCodes as readonly string[])
      .includes("LKG_REVOCATION_DENIED"));
  }
});

test("UD-M1 incomplete LKG enters typed safe mode while mutation and authority claims deny", () => {
  const incompleteTuple = { ...tuple(), generations: [] };
  const incomplete = buildPlan({ lkgTuple: incompleteTuple });
  assert.deepEqual(verifyUpdateCheckPlanV1(incomplete, contextFor(incomplete)), {
    outcome: "SAFE_MODE", reasonCodes: ["LKG_INCOMPLETE"], exitCode: UPDATE_SAFE_MODE_EXIT_CODE_V1,
  });

  const denials: readonly [string, UpdateCheckPlanV1, string][] = [
    ["execution", buildPlan({ executionAuthorized: true }), "MUTATION_CLAIM_DENIED"],
    ["mutable-candidate", buildPlan({ candidateImmutable: false }), "MUTATION_CLAIM_DENIED"],
    ["self-attestation", buildPlan({ selfAttestation: true }), "SELF_ATTESTATION_DENIED"],
    ["self-promotion", buildPlan({ selfPromotion: true }), "SELF_PROMOTION_DENIED"],
    ["authority-added", buildPlan({ authorityAdded: ["capability:runtime-write"] }), "AUTHORITY_WIDENING_DENIED"],
    ["incompatible", buildPlan({ verdict: "INCOMPATIBLE" }), "COMPATIBILITY_DENIED"],
  ];
  for (const [name, denied, expected] of denials) {
    const result = verifyUpdateCheckPlanV1(denied, contextFor(denied));
    assert.equal(result.outcome, "DENIED", name);
    assert.ok(result.reasonCodes.includes(expected as never), name);
  }
});

test("UD-M1 sparse and nonstandard arrays are rejected before canonical digesting", () => {
  const sparse = [] as unknown as UpdateTupleV1["core"];
  (sparse as unknown[]).length = 1;
  const sparseTuple = { ...tuple(), core: sparse };
  const emptyTuple = { ...tuple(), core: [] };
  const emptyDigest = updateTupleDigestV1(emptyTuple);
  assert.equal(typeof emptyDigest, "string");
  assert.throws(() => updateTupleDigestV1(sparseTuple), /INVALID_UPDATE_TUPLE|UNSAFE_JSON_ARRAY/);
  assert.throws(() => updateCheckPlanDigestV1({ array: sparse as unknown[] }, "digest"), /UNSAFE_JSON_ARRAY/);

  const custom = [{ componentId: "core:control-plane", version: "1.0.0", digest: "1".repeat(64) }];
  Object.defineProperty(custom, "hidden", { value: "alias", enumerable: false });
  assert.throws(() => updateTupleDigestV1({ ...tuple(), core: custom }), /INVALID_UPDATE_TUPLE|UNSAFE_JSON_ARRAY/);
});

test("UD-M1 tuple validation enforces unique axis-appropriate component IDs", () => {
  const duplicate = axisComponent("pack:company-data", "1.0.0", "2");
  const duplicateTuple = { ...tuple(), packs: [...duplicate, { ...duplicate[0]!, version: "1.0.1" }] };
  assert.throws(() => updateTupleDigestV1(duplicateTuple), /INVALID_UPDATE_TUPLE/);
  const wrongAxis = { ...tuple(), packs: axisComponent("core:not-a-pack", "1.0.0", "2") };
  assert.throws(() => updateTupleDigestV1(wrongAxis), /INVALID_UPDATE_TUPLE/);
});

test("UD-M1 fixture construction deep-clones mutable aliases and returns deeply immutable reports", () => {
  const checks = checksFor("READINESS");
  const reasons: UpdateSafeModeReasonV1[] = [];
  const lockedTuple = tuple();
  const report = runFixtureHealthReportV1({
    reportId: "update:health-report-001",
    profile: "READINESS",
    lockedTuple,
    checks,
    safeModeReasonCodes: reasons,
    generatedAtMs: EVALUATION_TIME_MS,
  });
  const bytes = renderRedactedUpdateHealthReportV1(report, healthContext(tuple(), "READINESS"));
  (checks[0]! as { status: string }).status = "FAIL";
  (lockedTuple.core[0]! as { version: string }).version = "9.9.9";
  reasons.push("HEALTH_CHECK_FAILED");
  assert.equal(renderRedactedUpdateHealthReportV1(report, healthContext(tuple(), "READINESS")), bytes);
  assertDeeplyFrozen(report);
  assert.throws(() => { (report.checks as UpdateHealthCheckV1[]).push(checks[0]!); }, TypeError);
});

test("UD-M1 HEALTH and READINESS reports require exact unique profile-specific coverage", () => {
  for (const profile of ["HEALTH", "READINESS"] as const) {
    const report = healthReport({ profile });
    assert.deepEqual(verifyUpdateHealthReportV1(report, healthContext(tuple(), profile)), {
      outcome: "ACCEPTED", reasonCodes: ["UPDATE_HEALTH_ACCEPTED"], exitCode: 0,
    });
    assert.equal(healthSchema(report), true, JSON.stringify(healthSchema.errors));
    const first = renderRedactedUpdateHealthReportV1(report, healthContext(tuple(), profile));
    assert.equal(first, renderRedactedUpdateHealthReportV1(report, healthContext(tuple(), profile)));
    assert.deepEqual(JSON.parse(first), report);
  }
});

test("UD-M1 failed and unobserved health checks produce typed read-only safe mode", () => {
  const cases: readonly [UpdateHealthCheckV1, UpdateSafeModeReasonV1][] = [
    [{ checkId: "check:tuple-lock", status: "FAIL", reasonCode: "OBSERVATION_MISMATCH" }, "HEALTH_CHECK_FAILED"],
    [{ checkId: "check:tuple-lock", status: "NOT_OBSERVED", reasonCode: "OBSERVATION_UNAVAILABLE" }, "HEALTH_CHECK_UNOBSERVED"],
  ];
  for (const [check, reason] of cases) {
    const report = healthReport({ checks: [check], safeModeReasonCodes: [reason] });
    assert.deepEqual(verifyUpdateHealthReportV1(report, healthContext()), {
      outcome: "SAFE_MODE", reasonCodes: [reason], exitCode: UPDATE_SAFE_MODE_EXIT_CODE_V1,
    });
  }
  const failedWithoutSafeMode = healthReport({
    checks: [{ checkId: "check:tuple-lock", status: "FAIL", reasonCode: "OBSERVATION_MISMATCH" }],
  });
  assert.deepEqual(verifyUpdateHealthReportV1(failedWithoutSafeMode, healthContext()).reasonCodes, ["SAFE_MODE_INCONSISTENT_DENIED"]);
});

test("UD-M1 missing, unknown, and duplicate critical health checks deny", () => {
  const base = healthReport({ profile: "READINESS" });
  const cases = [
    redigestReport(base, { checks: [base.checks[0]] }),
    redigestReport(base, { checks: [...base.checks, { checkId: "check:unknown", status: "PASS", reasonCode: "OBSERVATION_MATCHED" }] }),
    redigestReport(base, { checks: [base.checks[0], base.checks[0]] }),
  ];
  for (const report of cases) {
    assert.deepEqual(verifyUpdateHealthReportV1(report, healthContext(tuple(), "READINESS")).reasonCodes, ["HEALTH_CHECK_COVERAGE_DENIED"]);
  }
});

test("UD-M1 health checks and safe-mode reasons require canonical order with stable accepted digests", () => {
  const incompleteTuple = { ...tuple(), schemas: [] };
  const checks: readonly UpdateHealthCheckV1[] = [
    { checkId: "check:tuple-lock", status: "FAIL", reasonCode: "OBSERVATION_MISMATCH" },
    { checkId: "check:safe-mode", status: "NOT_OBSERVED", reasonCode: "OBSERVATION_UNAVAILABLE" },
  ];
  const reasons: readonly UpdateSafeModeReasonV1[] = [
    "LKG_INCOMPLETE", "HEALTH_CHECK_FAILED", "HEALTH_CHECK_UNOBSERVED",
  ];
  const canonical = healthReport({
    profile: "READINESS", lockedTuple: incompleteTuple, checks, safeModeReasonCodes: reasons,
  });
  const rebuilt = healthReport({
    profile: "READINESS", lockedTuple: incompleteTuple, checks, safeModeReasonCodes: reasons,
  });
  const context = healthContext(incompleteTuple, "READINESS");
  assert.equal(canonical.reportDigest, rebuilt.reportDigest);
  assert.equal(healthSchema(canonical), true, JSON.stringify(healthSchema.errors));
  assert.deepEqual(verifyUpdateHealthReportV1(canonical, context), {
    outcome: "SAFE_MODE", reasonCodes: reasons, exitCode: UPDATE_SAFE_MODE_EXIT_CODE_V1,
  });
  assert.throws(() => runFixtureHealthReportV1({
    reportId: "update:health-report-001",
    profile: "READINESS",
    lockedTuple: incompleteTuple,
    checks: [checks[1]!, checks[0]!],
    safeModeReasonCodes: reasons,
    generatedAtMs: EVALUATION_TIME_MS,
  }), /INVALID_READ_ONLY_HEALTH_REPORT_FIXTURE/);
  assert.throws(() => runFixtureHealthReportV1({
    reportId: "update:health-report-001",
    profile: "READINESS",
    lockedTuple: incompleteTuple,
    checks,
    safeModeReasonCodes: ["HEALTH_CHECK_FAILED", "LKG_INCOMPLETE", "HEALTH_CHECK_UNOBSERVED"],
    generatedAtMs: EVALUATION_TIME_MS,
  }), /INVALID_READ_ONLY_HEALTH_REPORT_FIXTURE/);

  const reorderedChecks = redigestReport(canonical, { checks: [canonical.checks[1], canonical.checks[0]] });
  assert.notEqual(reorderedChecks.reportDigest, canonical.reportDigest);
  assert.equal(healthSchema(reorderedChecks), false);
  assert.deepEqual(verifyUpdateHealthReportV1(reorderedChecks, context).reasonCodes, ["HEALTH_CHECK_COVERAGE_DENIED"]);
  assert.throws(() => renderRedactedUpdateHealthReportV1(reorderedChecks, context), /UNSAFE_OR_INVALID_UPDATE_EXPORT/);

  const reorderedReasons = redigestReport(canonical, {
    safeMode: {
      ...canonical.safeMode,
      reasonCodes: ["HEALTH_CHECK_FAILED", "LKG_INCOMPLETE", "HEALTH_CHECK_UNOBSERVED"],
    },
  });
  assert.notEqual(reorderedReasons.reportDigest, canonical.reportDigest);
  assert.equal(healthSchema(reorderedReasons), false);
  assert.deepEqual(verifyUpdateHealthReportV1(reorderedReasons, context).reasonCodes, ["SAFE_MODE_INCONSISTENT_DENIED"]);
  assert.throws(() => renderRedactedUpdateHealthReportV1(reorderedReasons, context), /UNSAFE_OR_INVALID_UPDATE_EXPORT/);
});

test("UD-M1 contradictory health status/reason pairs deny at runtime and schema", () => {
  const report = healthReport();
  const contradictory = redigestReport(report, {
    checks: [{ checkId: "check:tuple-lock", status: "FAIL", reasonCode: "OBSERVATION_MATCHED" }],
  });
  assert.deepEqual(verifyUpdateHealthReportV1(contradictory, healthContext()).reasonCodes, ["HEALTH_CHECK_CONTRADICTION_DENIED"]);
  assert.equal(healthSchema(contradictory), false);
});

test("UD-M1 tuple completeness is derived and a false COMPLETE declaration denies", () => {
  const incompleteTuple = { ...tuple(), schemas: [] };
  const incomplete = healthReport({ lockedTuple: incompleteTuple, safeModeReasonCodes: ["LKG_INCOMPLETE"] });
  assert.equal(incomplete.tupleStatus, "INCOMPLETE");
  assert.deepEqual(verifyUpdateHealthReportV1(incomplete, healthContext(incompleteTuple)), {
    outcome: "SAFE_MODE", reasonCodes: ["LKG_INCOMPLETE"], exitCode: UPDATE_SAFE_MODE_EXIT_CODE_V1,
  });
  const falseComplete = redigestReport(incomplete, { tupleStatus: "COMPLETE" });
  assert.deepEqual(verifyUpdateHealthReportV1(falseComplete, healthContext(incompleteTuple)).reasonCodes, ["TUPLE_MISMATCH_DENIED"]);
});

test("UD-M1 closed public health projection rejects identities, paths, credentials, and field collisions", () => {
  const report = healthReport();
  const privateStatePath = ["/", "home", "/alice/private/state.json"].join("");
  const unsafeReportId = redigestReport(report, { reportId: "user:alice" });
  assert.throws(() => renderRedactedUpdateHealthReportV1(unsafeReportId, healthContext()), /UNSAFE_OR_INVALID_UPDATE_EXPORT/);
  const collision = redigestReport(report, {
    checks: [{ ...report.checks[0], reportId: "user:alice", path: `error at ${privateStatePath}` }],
  });
  assert.throws(() => renderRedactedUpdateHealthReportV1(collision, healthContext()), /UNSAFE_OR_INVALID_UPDATE_EXPORT/);
  const credentialCollision = redigestReport(report, {
    authorization: "Authorization: Bearer eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJ1c2VyOmFsaWNlIn0.signature",
    awsAccessKeyId: ["AKIA", "IOSFODNN7EXAMPLE"].join(""),
    session: "session-secret-001",
  });
  assert.throws(() => renderRedactedUpdateHealthReportV1(credentialCollision, healthContext()), /UNSAFE_OR_INVALID_UPDATE_EXPORT/);
  assert.equal("renderRedactedUpdateExportV1" in contracts, false);
  assert.equal("redactUpdateExportValueV1" in contracts, false);
});

test("UD-M1 closed public projection fails closed on dangerous keys, cycles, and unsupported values", () => {
  for (const key of ["__proto__", "constructor", "prototype"]) {
    const dangerous = JSON.parse(`{"safe":"value","${key}":{"polluted":true}}`) as unknown;
    assert.throws(
      () => renderRedactedUpdateHealthReportV1(dangerous as UpdateHealthReportV1, healthContext()),
      /UNSAFE_OR_INVALID_UPDATE_EXPORT/,
      key,
    );
    assert.throws(
      () => updateCheckPlanDigestV1(dangerous as Record<string, unknown>, "digest"),
      /UNSAFE_JSON_OBJECT/,
      key,
    );
  }
  assert.equal(({} as { polluted?: boolean }).polluted, undefined);

  const cyclicArray: unknown[] = [];
  cyclicArray.push(cyclicArray);
  assert.throws(
    () => renderRedactedUpdateHealthReportV1({ ...healthReport(), checks: cyclicArray } as UpdateHealthReportV1, healthContext()),
    /UNSAFE_OR_INVALID_UPDATE_EXPORT/,
  );

  const cyclicObject = { ...healthReport() } as Record<string, unknown>;
  cyclicObject.safeMode = cyclicObject;
  assert.throws(
    () => renderRedactedUpdateHealthReportV1(cyclicObject as unknown as UpdateHealthReportV1, healthContext()),
    /UNSAFE_OR_INVALID_UPDATE_EXPORT/,
  );
  assert.throws(
    () => renderRedactedUpdateHealthReportV1({ ...healthReport(), unsupported: 1n } as unknown as UpdateHealthReportV1, healthContext()),
    /UNSAFE_OR_INVALID_UPDATE_EXPORT/,
  );
});

test("UD-M1 schema/runtime parity corpus rejects duplicate reasons, unsafe integers, unsafe IDs, and invalid pairs", () => {
  const plan = buildPlan();
  const duplicatePlanReason = {
    ...plan,
    safeMode: { ...plan.safeMode, active: true, reasonCodes: ["LKG_INCOMPLETE", "LKG_INCOMPLETE"] },
  };
  const duplicatePlan = {
    ...duplicatePlanReason,
    planDigest: updateCheckPlanDigestV1(duplicatePlanReason as unknown as Record<string, unknown>, "planDigest"),
  } as unknown as UpdateCheckPlanV1;
  const unsafeIntegerPlan = { ...plan, issuedAtMs: Number.MAX_SAFE_INTEGER + 1 } as UpdateCheckPlanV1;
  const unsafePlanId = { ...plan, planId: "user:alice" } as UpdateCheckPlanV1;
  const planCorpus = [duplicatePlan, unsafeIntegerPlan, unsafePlanId];
  for (const invalid of planCorpus) {
    assert.equal(planSchema(invalid), false, "schema accepted invalid plan corpus member");
    assert.equal(verifyUpdateCheckPlanV1(invalid, contextFor(plan)).outcome, "DENIED");
  }

  const report = healthReport();
  const duplicateReportReason = redigestReport(report, {
    safeMode: { ...report.safeMode, active: true, reasonCodes: ["HEALTH_CHECK_FAILED", "HEALTH_CHECK_FAILED"] },
  });
  const invalidPair = redigestReport(report, {
    checks: [{ checkId: "check:tuple-lock", status: "PASS", reasonCode: "OBSERVATION_UNAVAILABLE" }],
  });
  const unsafeReportId = redigestReport(report, { reportId: "user:alice" });
  const unsafeCheckId = redigestReport(report, {
    checks: [{ checkId: "user:alice", status: "PASS", reasonCode: "OBSERVATION_MATCHED" }],
  });
  const unsafeIntegerReport = { ...report, generatedAtMs: Number.MAX_SAFE_INTEGER + 1 } as UpdateHealthReportV1;
  const reportCorpus = [duplicateReportReason, invalidPair, unsafeReportId, unsafeCheckId, unsafeIntegerReport];
  for (const invalid of reportCorpus) {
    assert.equal(healthSchema(invalid), false, "schema accepted invalid report corpus member");
    assert.equal(verifyUpdateHealthReportV1(invalid, healthContext()).outcome, "DENIED");
  }
});

test("UD-M1 parsers fail closed without evaluating fixture content", () => {
  const plan = buildPlan();
  assert.deepEqual(parseUpdateCheckPlanV1("not-json", contextFor(plan)), {
    outcome: "DENIED", reasonCodes: ["INVALID_JSON_DENIED"], exitCode: UPDATE_CHECK_PLAN_EXIT_CODES_V1.INVALID_JSON_DENIED,
  });
  assert.deepEqual(parseUpdateHealthReportV1("not-json", healthContext()), {
    outcome: "DENIED", reasonCodes: ["INVALID_JSON_DENIED"], exitCode: UPDATE_CHECK_PLAN_EXIT_CODES_V1.INVALID_JSON_DENIED,
  });
  (globalThis as Record<string, unknown>).planExecuted = false;
  const hostile = JSON.stringify({ ...plan, execute: "globalThis.planExecuted = true" });
  assert.equal(parseUpdateCheckPlanV1(hostile, contextFor(plan)).outcome, "DENIED");
  assert.equal((globalThis as Record<string, unknown>).planExecuted, false);
});

test("UD-M1 boundary-pinned source and target tuples digest to the exact frozen tuple digests", () => {
  assert.match(BOUNDARY_SOURCE_TUPLE_DIGEST, /^[a-f0-9]{64}$/);
  assert.match(BOUNDARY_TARGET_TUPLE_DIGEST, /^[a-f0-9]{64}$/);
  assert.notEqual(BOUNDARY_SOURCE_TUPLE_DIGEST, BOUNDARY_TARGET_TUPLE_DIGEST);
  assert.equal(updateTupleDigestV1(boundarySourceTuple()), BOUNDARY_SOURCE_TUPLE_DIGEST);
  assert.equal(updateTupleDigestV1(boundaryTargetTuple()), BOUNDARY_TARGET_TUPLE_DIGEST);
  // The pin anchors content, not key order.
  assert.equal(updateTupleDigestV1(reorderedBoundaryTargetTuple()), BOUNDARY_TARGET_TUPLE_DIGEST);
});

test("UD-M1 the boundary-pinned candidate verifies ACCEPTED and renders inspectable canonical bytes", () => {
  const plan = buildPlan({ targetTuple: boundaryTargetTuple(), lkgTuple: boundarySourceTuple() });
  assert.equal(plan.candidate.candidateId, BOUNDARY_CANDIDATE_ID);
  assert.equal(plan.candidate.attestedBy, BOUNDARY_ATTESTOR_ID);
  assert.equal(plan.candidate.promotedBy, BOUNDARY_PROMOTER_ID);
  assert.equal(plan.candidate.source, "SYNTHETIC_ISOLATED");
  assert.equal(plan.candidate.synthetic, true);
  assert.equal(plan.candidate.immutable, true);
  assert.equal(plan.candidate.releaseId, "0.2.0-poc.20260804.4");
  assert.equal(plan.lkg.releaseId, "0.2.0-poc.20260804.4");
  assert.equal(plan.candidate.targetTuple.core[0]!.version, "1.1.0");
  assert.equal(plan.candidate.targetTuple.packs[0]!.version, "1.0.0");
  assert.equal(plan.candidate.targetTuple.adapters[0]!.version, "1.0.0");
  assert.equal(plan.candidate.targetTuple.policies[0]!.version, "2.0.0");
  assert.equal(plan.candidate.targetTuple.schemas[0]!.version, "1.0.0");
  assert.equal(plan.candidate.targetTuple.generations[0]!.version, "1.0.0");
  assert.equal(plan.candidate.targetTupleDigest, BOUNDARY_TARGET_TUPLE_DIGEST);
  assert.equal(plan.candidate.authorityProfileDigest, TARGET_AUTHORITY_DIGEST);
  assert.equal(plan.lkg.tupleDigest, BOUNDARY_SOURCE_TUPLE_DIGEST);
  assert.equal(plan.lkg.authorityProfileDigest, LKG_AUTHORITY_DIGEST);
  assert.equal(plan.compatibility.subjectCandidateDigest, plan.candidate.digest);
  assert.equal(plan.compatibility.subjectLkgDigest, plan.lkg.lkgDigest);
  assert.equal(plan.compatibility.verdict, "COMPATIBLE");
  assert.match(plan.candidate.digest, /^[a-f0-9]{64}$/);
  assert.match(plan.compatibility.decisionDigest, /^[a-f0-9]{64}$/);
  assert.match(plan.planDigest, /^[a-f0-9]{64}$/);
  assert.equal(plan.mode, "CHECK_ONLY");
  assert.equal(plan.executionAuthorized, false);
  assert.equal(plan.selfAttestation, false);
  assert.equal(plan.selfPromotion, false);
  assert.equal(planSchema(plan), true, JSON.stringify(planSchema.errors));
  const context = contextFor(plan, { expectedTargetTuple: reorderedBoundaryTargetTuple() });
  assert.deepEqual(verifyUpdateCheckPlanV1(plan, context), {
    outcome: "ACCEPTED", reasonCodes: ["UPDATE_CHECK_ACCEPTED"], exitCode: 0,
  });
  const bytes = renderVerifiedUpdateCheckPlanV1(plan, context);
  for (const pinned of [
    BOUNDARY_SOURCE_TUPLE_DIGEST,
    BOUNDARY_TARGET_TUPLE_DIGEST,
    "core:safe-guided",
    "pack:general",
    "adapter:dev",
    "policy:default",
    "schema:catalog",
    "generation:safe-guided",
  ]) {
    assert.ok(bytes.includes(pinned), `verified render must expose ${pinned}`);
  }
  assert.deepEqual(JSON.parse(bytes), plan);
});

test("UD-M1 drift from the boundary-pinned tuple fails closed and non-exact versions are rejected before digesting", () => {
  const driftedVersion = { ...boundaryTargetTuple(), core: axisComponent("core:safe-guided", "1.2.0", "1") };
  const driftedDigest = { ...boundaryTargetTuple(), schemas: axisComponent("schema:catalog", "1.0.0", "9") };
  const driftCases: readonly [string, UpdateTupleV1][] = [
    ["version-drift", driftedVersion],
    ["digest-drift", driftedDigest],
  ];
  for (const [name, targetTuple] of driftCases) {
    const plan = buildPlan({ targetTuple, lkgTuple: boundarySourceTuple() });
    const result = verifyUpdateCheckPlanV1(plan, contextFor(plan, { expectedTargetTuple: boundaryTargetTuple() }));
    assert.equal(result.outcome, "DENIED", name);
    assert.ok(result.reasonCodes.includes("TUPLE_MISMATCH_DENIED"), `${name}:${result.reasonCodes.join(",")}`);
  }
  // selectionRules exactValuesOnly / latestRejected: dist-tags and ranges are not exact versions.
  assert.throws(
    () => updateTupleDigestV1({ ...boundaryTargetTuple(), core: axisComponent("core:safe-guided", "latest", "1") }),
    /INVALID_UPDATE_TUPLE/,
  );
  assert.throws(
    () => updateTupleDigestV1({ ...boundaryTargetTuple(), core: axisComponent("core:safe-guided", "^1.0.0", "1") }),
    /INVALID_UPDATE_TUPLE/,
  );
  assert.throws(
    () => updateTupleDigestV1({ ...boundaryTargetTuple(), core: axisComponent("core:safe-guided", "01.0.0", "1") }),
    /INVALID_UPDATE_TUPLE/,
  );
});

test("UD-M1 candidate freeze snapshots the exact immutable check-plan and rejects binding drift", () => {
  const plan = buildPlan({ targetTuple: boundaryTargetTuple(), lkgTuple: boundarySourceTuple() });
  const context = contextFor(plan, { expectedTargetTuple: reorderedBoundaryTargetTuple() });
  const frozen = freezeUpdateCheckPlanCandidateV1(plan, context);
  assert.notEqual(frozen, plan);
  assert.deepEqual(frozen, plan);
  assertDeeplyFrozen(frozen);
  assert.equal(frozen.candidate.targetTupleDigest, BOUNDARY_TARGET_TUPLE_DIGEST);
  assert.equal(frozen.candidate.digest, context.expectedCandidate.candidateDigest);
  assert.equal(frozen.compatibility.decisionDigest, context.expectedCompatibility.decisionDigest);
  assert.equal(frozen.candidate.authorityProfileDigest, context.expectedTarget.authorityProfileDigest);

  const driftedBindings: readonly [string, UpdatePlanVerificationContextV1][] = [
    ["content", contextFor(plan, { expectedCandidateDigest: "a".repeat(64) })],
    ["compatibility", contextFor(plan, { expectedCompatibilityDecisionDigest: "b".repeat(64) })],
    ["tuple", contextFor(plan, { expectedTargetTuple: alternateTuple() })],
    ["authority", contextFor(plan, { expectedTargetAuthorityDigest: "c".repeat(64) })],
  ];
  for (const [name, drifted] of driftedBindings) {
    assert.throws(
      () => freezeUpdateCheckPlanCandidateV1(plan, drifted),
      /UNSAFE_OR_INVALID_UPDATE_CANDIDATE/,
      name,
    );
  }

  (plan.candidate.targetTuple.core[0]! as { version: string }).version = "9.9.9";
  assert.equal(frozen.candidate.targetTuple.core[0]!.version, "1.1.0");
});

test("UD-M1 candidate freeze rejects candidate/updater self-attestation or self-promotion", () => {
  const roleClaims: readonly [string, BuildPlanOptions][] = [
    ["candidate-attestor", { attestedBy: "attestor:synthetic-001" }],
    ["candidate-promoter", { promotedBy: "promoter:synthetic-001" }],
    ["updater-attestor", { attestedBy: "attestor:fixture-only" }],
    ["updater-promoter", { promotedBy: "promoter:fixture-only" }],
    ["updater-attestor-alias", { attestedBy: "attestor:fixture_only" }],
    ["updater-promoter-alias", { promotedBy: "promoter:fixture.only" }],
  ];
  for (const [name, options] of roleClaims) {
    const plan = buildPlan({ ...options, targetTuple: boundaryTargetTuple(), lkgTuple: boundarySourceTuple() });
    const result = verifyUpdateCheckPlanV1(plan, contextFor(plan));
    assert.equal(result.outcome, "DENIED", name);
    assert.ok(result.reasonCodes.includes(
      name.includes("attestor") ? "SELF_ATTESTATION_DENIED" : "SELF_PROMOTION_DENIED",
    ), `${name}:${result.reasonCodes.join(",")}`);
    assert.throws(
      () => freezeUpdateCheckPlanCandidateV1(plan, contextFor(plan)),
      /UNSAFE_OR_INVALID_UPDATE_CANDIDATE/,
      name,
    );
  }

  const sharedGate = buildPlan({
    attestedBy: "attestor:shared-gate",
    promotedBy: "promoter:shared_gate",
    targetTuple: boundaryTargetTuple(),
    lkgTuple: boundarySourceTuple(),
  });
  assert.throws(
    () => freezeUpdateCheckPlanCandidateV1(sharedGate, contextFor(sharedGate)),
    /UNSAFE_OR_INVALID_UPDATE_CANDIDATE/,
    "shared gate roles",
  );
});

test("UD-M1 boundary identity roles are distinct and candidate self-attestation or self-promotion aliases fail closed", () => {
  const boundaryIds = [BOUNDARY_CANDIDATE_ID, BOUNDARY_UPDATER_ID, BOUNDARY_ATTESTOR_ID, BOUNDARY_VERIFIER_ID, BOUNDARY_PROMOTER_ID];
  assert.equal(new Set(boundaryIds).size, 5);

  // The candidate/updater can inspect but not attest or promote: the plan fixture binds the boundary
  // candidate with the boundary attestor and promoter, and verifies ACCEPTED with no role collision.
  const plan = buildPlan({ targetTuple: boundaryTargetTuple(), lkgTuple: boundarySourceTuple() });
  assert.equal(verifyUpdateCheckPlanV1(plan, contextFor(plan)).outcome, "ACCEPTED");

  const selfClaims: readonly [string, BuildPlanOptions, string, string][] = [
    ["attestor-alias-dash", { attestedBy: "attestor:synthetic-001", targetTuple: boundaryTargetTuple(), lkgTuple: boundarySourceTuple() }, "SELF_ATTESTATION_DENIED", "AUTHORITY_BINDING_DENIED"],
    ["attestor-alias-underscore", { attestedBy: "attestor:synthetic_001", targetTuple: boundaryTargetTuple(), lkgTuple: boundarySourceTuple() }, "SELF_ATTESTATION_DENIED", "AUTHORITY_BINDING_DENIED"],
    ["attestor-alias-dot", { attestedBy: "attestor:synthetic.001", targetTuple: boundaryTargetTuple(), lkgTuple: boundarySourceTuple() }, "SELF_ATTESTATION_DENIED", "AUTHORITY_BINDING_DENIED"],
    ["promoter-alias-dash", { promotedBy: "promoter:synthetic-001", targetTuple: boundaryTargetTuple(), lkgTuple: boundarySourceTuple() }, "SELF_PROMOTION_DENIED", "AUTHORITY_BINDING_DENIED"],
    ["promoter-alias-underscore", { promotedBy: "promoter:synthetic_001", targetTuple: boundaryTargetTuple(), lkgTuple: boundarySourceTuple() }, "SELF_PROMOTION_DENIED", "AUTHORITY_BINDING_DENIED"],
    ["promoter-alias-dot", { promotedBy: "promoter:synthetic.001", targetTuple: boundaryTargetTuple(), lkgTuple: boundarySourceTuple() }, "SELF_PROMOTION_DENIED", "AUTHORITY_BINDING_DENIED"],
  ];
  for (const [name, options, selfReason, bindingReason] of selfClaims) {
    const denied = buildPlan(options);
    const result = verifyUpdateCheckPlanV1(denied, contextFor(denied));
    assert.equal(result.outcome, "DENIED", name);
    assert.ok(result.reasonCodes.includes(selfReason as never), `${name}:${result.reasonCodes.join(",")}`);
    assert.ok(result.reasonCodes.includes(bindingReason as never), `${name}:${result.reasonCodes.join(",")}`);
    assert.equal(result.exitCode, UPDATE_CHECK_PLAN_EXIT_CODES_V1.AUTHORITY_BINDING_DENIED, name);
  }
});
