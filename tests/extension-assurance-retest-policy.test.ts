import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { canonicalJson } from "../packages/contracts/src/canonical-json.js";
import {
  EXTENSION_ASSURANCE_CLAIM_BOUNDARY_V1,
  EXTENSION_ASSURANCE_RETEST_TRIGGERS_V1,
  extensionAssuranceProfileDigestV1,
  type ExtensionAssuranceProfileV1,
  type ExtensionAssuranceRetestTriggerV1,
} from "../packages/contracts/src/extension-assurance-profile.js";
import {
  EXTENSION_ASSURANCE_RETEST_DECISION_SCHEMA_V1,
  EXTENSION_ASSURANCE_RETEST_POLICY_INPUT_SCHEMA_V1,
  decideExtensionAssuranceRetestV1,
  renderExtensionAssuranceRetestDecisionV1,
  type ExtensionAssurancePolicyRefV1,
  type ExtensionAssuranceRetestPolicyInputV1,
} from "../packages/contracts/src/extension-assurance-retest-policy.js";

const POLICY: ExtensionAssurancePolicyRefV1 = {
  policyId: "policy:etl-retest-v1",
  policyVersion: "1.0.0",
  policyDigest: "a".repeat(64),
};

function priorProfile(): ExtensionAssuranceProfileV1 {
  return JSON.parse(readFileSync(
    "tests/fixtures/extension-assurance/positive-profile-v1.json",
    "utf8",
  )) as ExtensionAssuranceProfileV1;
}

function input(): ExtensionAssuranceRetestPolicyInputV1 {
  const profile = priorProfile();
  return {
    schemaVersion: EXTENSION_ASSURANCE_RETEST_POLICY_INPUT_SCHEMA_V1,
    prior: {
      profile,
      profileDigest: extensionAssuranceProfileDigestV1(profile as unknown as Record<string, unknown>),
      policy: structuredClone(POLICY),
    },
    current: {
      subject: structuredClone(profile.subject),
      profile: {
        profileId: profile.profileId,
        profileVersion: profile.profileVersion,
        profileDigest: profile.profileDigest,
      },
      policy: structuredClone(POLICY),
      evidence: { collectedAtMs: 1000, expiresAtMs: 5000 },
      falseNegative: { confirmedCount: 0, reviewedAtMs: 2500 },
      manual: { requested: false, requestedAtMs: 0 },
      nowMs: 3000,
    },
  };
}

function mutated(apply: (draft: Record<string, any>) => void): Record<string, any> {
  const draft = input() as unknown as Record<string, any>;
  apply(draft);
  return draft;
}

function expected(decision: "RETAIN" | "RETEST_REQUIRED" | "DENY",
  triggers: readonly string[],
  reasonCodes: readonly string[]): Record<string, any> {
  return {
    schemaVersion: EXTENSION_ASSURANCE_RETEST_DECISION_SCHEMA_V1,
    decision,
    triggers: [...triggers],
    reasonCodes: [...reasonCodes],
    claimBoundary: EXTENSION_ASSURANCE_CLAIM_BOUNDARY_V1,
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

test("ETR-01 retains a conformant prior with identical current facts", () => {
  const decision = decideExtensionAssuranceRetestV1(input());
  assert.deepEqual(decision, expected("RETAIN", [], ["RETEST_POLICY_RETAIN"]));
});

test("ETR-01 renders byte-identical decisions for reordered input keys", () => {
  const base = input();
  const rendered = renderExtensionAssuranceRetestDecisionV1(base);
  for (let repetition = 0; repetition < 25; repetition += 1) {
    assert.equal(
      renderExtensionAssuranceRetestDecisionV1(reorderKeys(base, repetition)),
      rendered,
      String(repetition),
    );
  }
  assert.equal(canonicalJson(decideExtensionAssuranceRetestV1(base)), rendered);
});

test("ETR-02 maps every retest condition to its exact trigger vocabulary entry", () => {
  const cases: ReadonlyArray<{
    trigger: ExtensionAssuranceRetestTriggerV1;
    apply: (draft: Record<string, any>) => void;
  }> = [
    { trigger: "SUBJECT_CHANGED", apply: (draft) => { draft.current.subject.subjectDigest = "2".repeat(64); } },
    { trigger: "SUBJECT_CHANGED", apply: (draft) => { draft.current.subject.subjectVersion = "1.2.4"; } },
    { trigger: "PROFILE_CHANGED", apply: (draft) => { draft.current.profile.profileVersion = "1.1.0"; } },
    { trigger: "PROFILE_CHANGED", apply: (draft) => { draft.current.profile.profileDigest = "3".repeat(64); } },
    { trigger: "EVIDENCE_EXPIRED", apply: (draft) => { draft.current.nowMs = 5000; } },
    { trigger: "EVIDENCE_EXPIRED", apply: (draft) => { draft.current.nowMs = 5001; } },
    { trigger: "POLICY_CHANGED", apply: (draft) => { draft.current.policy.policyDigest = "4".repeat(64); } },
    { trigger: "POLICY_CHANGED", apply: (draft) => { draft.current.policy.policyVersion = "2.0.0"; } },
    { trigger: "FALSE_NEGATIVE_CONFIRMED", apply: (draft) => { draft.current.falseNegative.confirmedCount = 1; } },
    { trigger: "MANUAL", apply: (draft) => { draft.current.manual.requested = true; } },
  ];
  for (const [index, { trigger, apply }] of cases.entries()) {
    const decision = decideExtensionAssuranceRetestV1(mutated(apply));
    assert.deepEqual(decision, expected("RETEST_REQUIRED", [trigger], ["RETEST_TRIGGERED"]), `${trigger}:${index}`);
  }
  assert.deepEqual(
    [...new Set(cases.map(({ trigger }) => trigger))].sort(),
    [...EXTENSION_ASSURANCE_RETEST_TRIGGERS_V1].sort(),
  );
});

test("ETR-02 does not fire evidence expiry one millisecond before the deadline", () => {
  const decision = decideExtensionAssuranceRetestV1(mutated((draft) => { draft.current.nowMs = 4999; }));
  assert.deepEqual(decision, expected("RETAIN", [], ["RETEST_POLICY_RETAIN"]));
});

test("ETR-03 emits every fired trigger in the frozen vocabulary order", () => {
  const decision = decideExtensionAssuranceRetestV1(mutated((draft) => {
    draft.current.subject.subjectDigest = "2".repeat(64);
    draft.current.profile.profileDigest = "3".repeat(64);
    draft.current.policy.policyDigest = "4".repeat(64);
    draft.current.nowMs = 5000;
    draft.current.falseNegative.confirmedCount = 2;
    draft.current.falseNegative.reviewedAtMs = 4900;
    draft.current.manual.requested = true;
    draft.current.manual.requestedAtMs = 4950;
  }));
  assert.deepEqual(decision, expected("RETEST_REQUIRED", EXTENSION_ASSURANCE_RETEST_TRIGGERS_V1, ["RETEST_TRIGGERED"]));
});

test("ETR-04 denies authority-granting and free-text fields fail closed", () => {
  const cases: ReadonlyArray<{ label: string; apply: (draft: Record<string, any>) => void }> = [
    { label: "admission", apply: (draft) => { draft.admission = "GRANT"; } },
    { label: "execution", apply: (draft) => { draft.execution = { grant: true }; } },
    { label: "promotion", apply: (draft) => { draft.promotion = "ALLOWED"; } },
    { label: "marketplace", apply: (draft) => { draft.marketplace = { publish: true }; } },
    { label: "free-text", apply: (draft) => { draft.current.note = "please approve"; } },
    { label: "prior-authority", apply: (draft) => { draft.prior.admission = "GRANT"; } },
  ];
  for (const { label, apply } of cases) {
    assert.deepEqual(
      decideExtensionAssuranceRetestV1(mutated(apply)),
      expected("DENY", [], ["SCHEMA_DENIED"]),
      label,
    );
  }
});

test("ETR-05 denies digest-shaped field errors fail closed", () => {
  const cases: ReadonlyArray<{ label: string; apply: (draft: Record<string, any>) => void }> = [
    { label: "subject-digest-short", apply: (draft) => { draft.current.subject.subjectDigest = "abc"; } },
    { label: "subject-digest-uppercase", apply: (draft) => { draft.current.subject.subjectDigest = "abcdef12".repeat(8).toUpperCase(); } },
    { label: "profile-digest-non-hex", apply: (draft) => { draft.current.profile.profileDigest = "z".repeat(64); } },
    { label: "policy-digest-length", apply: (draft) => { draft.current.policy.policyDigest = "a".repeat(63); } },
    { label: "binding-digest-not-string", apply: (draft) => { draft.prior.profileDigest = 42; } },
  ];
  for (const { label, apply } of cases) {
    assert.deepEqual(
      decideExtensionAssuranceRetestV1(mutated(apply)),
      expected("DENY", [], ["SCHEMA_DENIED"]),
      label,
    );
  }
});

test("ETR-06 denies time-reversed fact sets fail closed", () => {
  const cases: ReadonlyArray<{ label: string; apply: (draft: Record<string, any>) => void }> = [
    { label: "now-before-prior-evaluation", apply: (draft) => { draft.current.nowMs = 1999; } },
    { label: "now-before-collection", apply: (draft) => { draft.current.evidence.collectedAtMs = 4000; } },
    { label: "expiry-before-collection", apply: (draft) => { draft.current.evidence = { collectedAtMs: 5000, expiresAtMs: 4000 }; draft.current.nowMs = 6000; } },
    { label: "review-in-future", apply: (draft) => { draft.current.falseNegative.reviewedAtMs = 3001; } },
    { label: "request-in-future", apply: (draft) => { draft.current.manual.requestedAtMs = 3001; } },
  ];
  for (const { label, apply } of cases) {
    assert.deepEqual(
      decideExtensionAssuranceRetestV1(mutated(apply)),
      expected("DENY", [], ["TIME_REVERSAL_DENIED"]),
      label,
    );
  }
});

test("ETR-07 denies a missing or mismatched prior binding", () => {
  const missing = mutated((draft) => { delete draft.prior.profileDigest; });
  assert.deepEqual(decideExtensionAssuranceRetestV1(missing), expected("DENY", [], ["SCHEMA_DENIED"]));
  const mismatch = mutated((draft) => { draft.prior.profileDigest = "5".repeat(64); });
  assert.deepEqual(
    decideExtensionAssuranceRetestV1(mismatch),
    expected("DENY", [], ["PRIOR_BINDING_MISMATCH_DENIED"]),
  );
});

test("ETR-08 denies a non-conformant prior profile even with a matching binding", () => {
  const draft = mutated((d) => {
    d.prior.profile.checks[0].outcome = "FAIL";
    d.prior.profileDigest = extensionAssuranceProfileDigestV1(d.prior.profile);
  });
  assert.deepEqual(
    decideExtensionAssuranceRetestV1(draft),
    expected("DENY", [], ["PRIOR_PROFILE_INVALID_DENIED"]),
  );
});