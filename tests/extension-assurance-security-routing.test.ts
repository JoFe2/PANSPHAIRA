import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";
import { canonicalJson } from "../packages/contracts/src/canonical-json.js";
import {
  EXTENSION_ASSURANCE_SECURITY_ROUTING_CLAIM_BOUNDARY_V1,
  EXTENSION_ASSURANCE_SECURITY_ROUTING_DECISION_SCHEMA_V1,
  EXTENSION_ASSURANCE_SECURITY_ROUTING_INPUT_SCHEMA_V1,
  decideExtensionAssuranceSecurityRoutingV1,
  extensionAssuranceFindingDigestV1,
  renderExtensionAssuranceSecurityRoutingDecisionV1,
  type ExtensionAssuranceFindingClassV1,
  type ExtensionAssuranceSecurityRoutingInputV1,
  type ExtensionAssuranceSeverityV1,
} from "../packages/contracts/src/extension-assurance-security-routing.js";

const POLICY = {
  policyId: "policy:etl-security-routing-v1",
  policyVersion: "1.0.0",
  policyDigest: "00112233445566778899aabbccddeeff00112233445566778899aabbccddeeff",
};
const EVIDENCE_DIGEST = "11223344556677889900aabbccddeeff11223344556677889900aabbccddeeff";

function digest(value: unknown): string {
  return createHash("sha256").update(canonicalJson(value)).digest("hex");
}

function findingInput(severity: ExtensionAssuranceSeverityV1, findingClass: ExtensionAssuranceFindingClassV1) {
  const base = {
    findingId: "finding:etl-synthetic-0001",
    severity,
    findingClass,
  };
  return { ...base, findingDigest: extensionAssuranceFindingDigestV1(base) };
}

function input(severity: ExtensionAssuranceSeverityV1 = "LOW",
  findingClass: ExtensionAssuranceFindingClassV1 = "PUBLIC_SAFE_SYNTHETIC",
  requestedRoute: "PUBLIC_EVIDENCE" | "SECURITY_POLICY_PRIVATE" = "PUBLIC_EVIDENCE"): ExtensionAssuranceSecurityRoutingInputV1 {
  return {
    schemaVersion: EXTENSION_ASSURANCE_SECURITY_ROUTING_INPUT_SCHEMA_V1,
    finding: findingInput(severity, findingClass),
    evidence: {
      evidenceId: "evidence:etl-synthetic-0001",
      evidenceDigest: EVIDENCE_DIGEST,
    },
    policy: structuredClone(POLICY),
    requestedRoute,
  };
}

function expectedRouted(decision: ReturnType<typeof decideExtensionAssuranceSecurityRoutingV1>) {
  const body = {
    schemaVersion: EXTENSION_ASSURANCE_SECURITY_ROUTING_DECISION_SCHEMA_V1,
    outcome: "ROUTED",
    route: decision.route,
    publicDetail: decision.publicDetail,
    reasonCodes: [...decision.reasonCodes],
    severity: decision.severity,
    findingDigest: decision.findingDigest,
    evidenceDigest: decision.evidenceDigest,
    policyId: POLICY.policyId,
    policyVersion: POLICY.policyVersion,
    policyDigest: POLICY.policyDigest,
    claimBoundary: EXTENSION_ASSURANCE_SECURITY_ROUTING_CLAIM_BOUNDARY_V1,
  };
  return { ...body, decisionDigest: digest(body) };
}

function reorderKeys(value: unknown, seed: number): unknown {
  if (Array.isArray(value)) return value.map((item) => reorderKeys(item, seed + 1));
  if (value === null || typeof value !== "object") return value;
  const entries = Object.entries(value as Record<string, unknown>);
  const offset = entries.length === 0 ? 0 : seed % entries.length;
  const rotated = [...entries.slice(offset), ...entries.slice(0, offset)].reverse();
  return Object.fromEntries(rotated.map(([key, item]) => [key, reorderKeys(item, seed + 1)]));
}

test("EASR-01 routes a valid low public-safe synthetic finding to public evidence with fixed reason codes", () => {
  const base = input();
  const decision = decideExtensionAssuranceSecurityRoutingV1(base);
  assert.equal(decision.outcome, "ROUTED");
  assert.equal(decision.route, "PUBLIC_EVIDENCE");
  assert.equal(decision.publicDetail, "FIXED_REASON_CODES_ONLY");
  assert.deepEqual(decision.reasonCodes, ["PUBLIC_EVIDENCE_ROUTED"]);
  assert.equal(decision.severity, "LOW");
  assert.deepEqual(decision, expectedRouted(decision));
});

test("EASR-02 routes a valid moderate public-safe synthetic finding to public evidence", () => {
  const decision = decideExtensionAssuranceSecurityRoutingV1(input("MODERATE", "PUBLIC_SAFE_SYNTHETIC"));
  assert.equal(decision.outcome, "ROUTED");
  assert.equal(decision.route, "PUBLIC_EVIDENCE");
  assert.equal(decision.publicDetail, "FIXED_REASON_CODES_ONLY");
  assert.equal(decision.severity, "MODERATE");
  assert.deepEqual(decision, expectedRouted(decision));
});

test("EASR-03 routes a valid high credential finding privately with public detail NONE", () => {
  const decision = decideExtensionAssuranceSecurityRoutingV1(
    input("HIGH", "CREDENTIAL", "SECURITY_POLICY_PRIVATE"),
  );
  assert.equal(decision.outcome, "ROUTED");
  assert.equal(decision.route, "SECURITY_POLICY_PRIVATE");
  assert.equal(decision.publicDetail, "NONE");
  assert.deepEqual(decision.reasonCodes, ["SECURITY_SENSITIVE_PRIVATE", "HIGH_SEVERITY_PRIVATE"]);
  assert.deepEqual(decision, expectedRouted(decision));
});

test("EASR-04 routes every sensitive class and high/critical severity privately with public detail NONE", () => {
  const cases: ReadonlyArray<{ severity: ExtensionAssuranceSeverityV1; findingClass: ExtensionAssuranceFindingClassV1 }> = [
    { severity: "CRITICAL", findingClass: "EXPLOIT" },
    { severity: "HIGH", findingClass: "PERSONAL_DATA" },
    { severity: "CRITICAL", findingClass: "SECURITY_SENSITIVE" },
    { severity: "LOW", findingClass: "CREDENTIAL" },
    { severity: "MODERATE", findingClass: "PERSONAL_DATA" },
    { severity: "LOW", findingClass: "EXPLOIT" },
    { severity: "LOW", findingClass: "SECURITY_SENSITIVE" },
  ];
  for (const { severity, findingClass } of cases) {
    const base = input(severity, findingClass, "SECURITY_POLICY_PRIVATE");
    const decision = decideExtensionAssuranceSecurityRoutingV1(base);
    const sensitive = findingClass !== "PUBLIC_SAFE_SYNTHETIC";
    const elevated = severity === "HIGH" || severity === "CRITICAL";
    assert.equal(decision.outcome, "ROUTED", `${severity}:${findingClass}`);
    assert.equal(decision.route, "SECURITY_POLICY_PRIVATE", `${severity}:${findingClass}`);
    assert.equal(decision.publicDetail, "NONE", `${severity}:${findingClass}`);
    assert.deepEqual(
      decision.reasonCodes,
      [
        ...(sensitive ? ["SECURITY_SENSITIVE_PRIVATE"] : []),
        ...(elevated ? ["HIGH_SEVERITY_PRIVATE"] : []),
      ],
      `${severity}:${findingClass}`,
    );
    assert.equal(decision.severity, severity, `${severity}:${findingClass}`);
    assert.deepEqual(decision, expectedRouted(decision), `${severity}:${findingClass}`);
  }
});

test("EASR-05 is deterministic: renders byte-identical decisions for reordered input keys", () => {
  const base = input("HIGH", "CREDENTIAL", "SECURITY_POLICY_PRIVATE");
  const rendered = renderExtensionAssuranceSecurityRoutingDecisionV1(base);
  for (let repetition = 0; repetition < 25; repetition += 1) {
    assert.equal(
      renderExtensionAssuranceSecurityRoutingDecisionV1(reorderKeys(base, repetition)),
      rendered,
      String(repetition),
    );
  }
  assert.equal(canonicalJson(decideExtensionAssuranceSecurityRoutingV1(base)), rendered);
});

test("EASR-06 emits a digest-only public projection: no finding or evidence identifiers in rendered bytes", () => {
  const rendered = renderExtensionAssuranceSecurityRoutingDecisionV1(input());
  const decision = JSON.parse(rendered) as Record<string, unknown>;
  assert.ok(!("findingId" in decision));
  assert.ok(!("evidenceId" in decision));
  assert.ok(!rendered.includes("finding:etl-synthetic-0001"));
  assert.ok(!rendered.includes("evidence:etl-synthetic-0001"));
  assert.ok(rendered.includes(input().finding.findingDigest));
  assert.ok(rendered.includes(EVIDENCE_DIGEST));
  assert.equal(decision.policyVersion, POLICY.policyVersion);
});

function mutated(
  severity: ExtensionAssuranceSeverityV1,
  findingClass: ExtensionAssuranceFindingClassV1,
  requestedRoute: "PUBLIC_EVIDENCE" | "SECURITY_POLICY_PRIVATE",
  apply: (draft: Record<string, any>) => void,
): Record<string, any> {
  const draft = input(severity, findingClass, requestedRoute) as unknown as Record<string, any>;
  apply(draft);
  return draft;
}

function expectedDenied(reasonCodes: readonly string[]) {
  const body = {
    schemaVersion: EXTENSION_ASSURANCE_SECURITY_ROUTING_DECISION_SCHEMA_V1,
    outcome: "DENY",
    route: "SECURITY_POLICY_PRIVATE",
    publicDetail: "NONE",
    reasonCodes: [...reasonCodes],
    severity: null,
    findingDigest: null,
    evidenceDigest: null,
    policyId: null,
    policyVersion: null,
    policyDigest: null,
    claimBoundary: EXTENSION_ASSURANCE_SECURITY_ROUTING_CLAIM_BOUNDARY_V1,
  };
  return { ...body, decisionDigest: digest(body) };
}

test("EASR-07 denies unknown fields and keeps seeded secrets out of the rendered public bytes", () => {
  const cases: ReadonlyArray<{
    label: string;
    seed: string;
    apply: (draft: Record<string, any>) => void;
  }> = [
    { label: "seeded-credential", seed: "sk-seed-credential-0001", apply: (draft) => { draft.credential = "sk-seed-credential-0001"; } },
    { label: "private-path", seed: "/private/internal/etl/lab/findings", apply: (draft) => { draft.path = "/private/internal/etl/lab/findings"; } },
    { label: "reporter-identity", seed: "seed-reporter-identity-0001", apply: (draft) => { draft.reporter = "seed-reporter-identity-0001"; } },
    { label: "exploit-payload", seed: "SEED-EXPLOIT-PAYLOAD-0001", apply: (draft) => { draft.payload = "SEED-EXPLOIT-PAYLOAD-0001"; } },
    { label: "free-text", seed: "seed free text with spaces and details", apply: (draft) => { draft.note = "seed free text with spaces and details"; } },
    { label: "external-contact", seed: "attacker@example.invalid", apply: (draft) => { draft.contact = "attacker@example.invalid"; } },
    { label: "nested-credential", seed: "sk-seed-nested-credential-0002", apply: (draft) => { draft.finding.credential = "sk-seed-nested-credential-0002"; } },
    { label: "nested-contact", seed: "nested-contact@example.invalid", apply: (draft) => { draft.evidence.contact = "nested-contact@example.invalid"; } },
    { label: "nested-free-text", seed: "seed policy note text", apply: (draft) => { draft.policy.note = "seed policy note text"; } },
    { label: "admission-authority", seed: "seed-admission-grant", apply: (draft) => { draft.admission = "seed-admission-grant"; } },
    { label: "release-authority", seed: "seed-release-publish", apply: (draft) => { draft.release = "seed-release-publish"; } },
  ];
  for (const { label, seed, apply } of cases) {
    const value = mutated("LOW", "PUBLIC_SAFE_SYNTHETIC", "PUBLIC_EVIDENCE", apply);
    const decision = decideExtensionAssuranceSecurityRoutingV1(value);
    assert.deepEqual(decision, expectedDenied(["SCHEMA_DENIED"]), label);
    const rendered = renderExtensionAssuranceSecurityRoutingDecisionV1(value);
    assert.ok(!rendered.includes(seed), `${label} seed must be absent from rendered public bytes`);
  }
});

test("EASR-08 denies malformed digests, versions, severities, classes and shapes fail closed", () => {
  const cases: ReadonlyArray<{ label: string; apply: (draft: Record<string, any>) => void }> = [
    { label: "finding-digest-uppercase", apply: (draft) => { draft.finding.findingDigest = draft.finding.findingDigest.toUpperCase(); } },
    { label: "finding-digest-short", apply: (draft) => { draft.finding.findingDigest = "abc"; } },
    { label: "finding-digest-non-hex", apply: (draft) => { draft.finding.findingDigest = "z".repeat(64); } },
    { label: "evidence-digest-short", apply: (draft) => { draft.evidence.evidenceDigest = "f".repeat(63); } },
    { label: "evidence-digest-uppercase", apply: (draft) => { draft.evidence.evidenceDigest = "F".repeat(64); } },
    { label: "policy-digest-non-hex", apply: (draft) => { draft.policy.policyDigest = "z".repeat(64); } },
    { label: "policy-version-missing-patch", apply: (draft) => { draft.policy.policyVersion = "1.0"; } },
    { label: "policy-version-prefixed", apply: (draft) => { draft.policy.policyVersion = "v1.0.0"; } },
    { label: "policy-version-number", apply: (draft) => { draft.policy.policyVersion = 1.0; } },
    { label: "severity-outside-vocabulary", apply: (draft) => { draft.finding.severity = "SEVERE"; } },
    { label: "severity-lowercase", apply: (draft) => { draft.finding.severity = "low"; } },
    { label: "class-outside-vocabulary", apply: (draft) => { draft.finding.findingClass = "CRED"; } },
    { label: "class-near-miss", apply: (draft) => { draft.finding.findingClass = "PUBLIC_SAFE"; } },
    { label: "schema-version-drift", apply: (draft) => { draft.schemaVersion = "chimpmaera.extension-trust/assurance-security-routing-input/v2"; } },
  ];
  for (const { label, apply } of cases) {
    const value = mutated("LOW", "PUBLIC_SAFE_SYNTHETIC", "PUBLIC_EVIDENCE", apply);
    assert.deepEqual(decideExtensionAssuranceSecurityRoutingV1(value), expectedDenied(["SCHEMA_DENIED"]), label);
  }
  for (const value of [null, "finding", 42, true, []]) {
    assert.deepEqual(
      decideExtensionAssuranceSecurityRoutingV1(value),
      expectedDenied(["SCHEMA_DENIED"]),
      `non-object input ${String(value)}`,
    );
  }
});

test("EASR-09 denies a finding digest that does not bind the finding metadata", () => {
  const value = mutated("HIGH", "CREDENTIAL", "SECURITY_POLICY_PRIVATE", (draft) => {
    draft.finding.findingDigest = "9".repeat(64);
  });
  const decision = decideExtensionAssuranceSecurityRoutingV1(value);
  assert.deepEqual(decision, expectedDenied(["FINDING_DIGEST_MISMATCH_DENIED"]));
  assert.equal(decision.severity, null);
  assert.equal(decision.findingDigest, null);
  assert.equal(decision.evidenceDigest, null);
  assert.equal(decision.policyId, null);
  assert.equal(decision.policyVersion, null);
  assert.equal(decision.policyDigest, null);
});

test("EASR-10 denies invalid severity/classification combinations and public routing attempts on sensitive findings", () => {
  const cases: ReadonlyArray<{
    label: string;
    severity: ExtensionAssuranceSeverityV1;
    findingClass: ExtensionAssuranceFindingClassV1;
    requestedRoute: "PUBLIC_EVIDENCE" | "SECURITY_POLICY_PRIVATE";
    reasonCodes: readonly string[];
  }> = [
    { label: "high-claims-public-safe", severity: "HIGH", findingClass: "PUBLIC_SAFE_SYNTHETIC", requestedRoute: "SECURITY_POLICY_PRIVATE", reasonCodes: ["SEVERITY_CLASSIFICATION_MISMATCH_DENIED"] },
    { label: "critical-claims-public-safe", severity: "CRITICAL", findingClass: "PUBLIC_SAFE_SYNTHETIC", requestedRoute: "SECURITY_POLICY_PRIVATE", reasonCodes: ["SEVERITY_CLASSIFICATION_MISMATCH_DENIED"] },
    { label: "high-public-safe-public-attempt", severity: "HIGH", findingClass: "PUBLIC_SAFE_SYNTHETIC", requestedRoute: "PUBLIC_EVIDENCE", reasonCodes: ["SEVERITY_CLASSIFICATION_MISMATCH_DENIED", "PUBLIC_ROUTE_ATTEMPT_DENIED"] },
    { label: "low-credential-public-attempt", severity: "LOW", findingClass: "CREDENTIAL", requestedRoute: "PUBLIC_EVIDENCE", reasonCodes: ["PUBLIC_ROUTE_ATTEMPT_DENIED"] },
    { label: "moderate-personal-data-public-attempt", severity: "MODERATE", findingClass: "PERSONAL_DATA", requestedRoute: "PUBLIC_EVIDENCE", reasonCodes: ["PUBLIC_ROUTE_ATTEMPT_DENIED"] },
    { label: "low-exploit-public-attempt", severity: "LOW", findingClass: "EXPLOIT", requestedRoute: "PUBLIC_EVIDENCE", reasonCodes: ["PUBLIC_ROUTE_ATTEMPT_DENIED"] },
    { label: "critical-security-sensitive-public-attempt", severity: "CRITICAL", findingClass: "SECURITY_SENSITIVE", requestedRoute: "PUBLIC_EVIDENCE", reasonCodes: ["PUBLIC_ROUTE_ATTEMPT_DENIED"] },
  ];
  for (const { label, severity, findingClass, requestedRoute, reasonCodes } of cases) {
    const value = mutated(severity, findingClass, requestedRoute, () => {});
    assert.deepEqual(
      decideExtensionAssuranceSecurityRoutingV1(value),
      expectedDenied(reasonCodes),
      label,
    );
  }
});

test("EASR-11 denies missing required fields at every closed level", () => {
  const cases: ReadonlyArray<{ label: string; apply: (draft: Record<string, any>) => void }> = [
    { label: "missing-schema-version", apply: (draft) => { delete draft.schemaVersion; } },
    { label: "missing-finding", apply: (draft) => { delete draft.finding; } },
    { label: "missing-severity", apply: (draft) => { delete draft.finding.severity; } },
    { label: "missing-finding-digest", apply: (draft) => { delete draft.finding.findingDigest; } },
    { label: "missing-evidence", apply: (draft) => { delete draft.evidence; } },
    { label: "missing-evidence-digest", apply: (draft) => { delete draft.evidence.evidenceDigest; } },
    { label: "missing-policy", apply: (draft) => { delete draft.policy; } },
    { label: "missing-policy-version", apply: (draft) => { delete draft.policy.policyVersion; } },
    { label: "missing-requested-route", apply: (draft) => { delete draft.requestedRoute; } },
  ];
  for (const { label, apply } of cases) {
    const value = mutated("LOW", "PUBLIC_SAFE_SYNTHETIC", "PUBLIC_EVIDENCE", apply);
    assert.deepEqual(decideExtensionAssuranceSecurityRoutingV1(value), expectedDenied(["SCHEMA_DENIED"]), label);
  }
});