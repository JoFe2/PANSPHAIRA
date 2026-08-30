import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import test from "node:test";
import Ajv2020 from "ajv/dist/2020.js";
import {
  VERIFICATION_ATTESTATION_SCHEMA_V2,
  buildVerificationImpactPlanFailClosedV2,
  buildVerificationImpactPlanV2,
  runVerificationShadowComparatorV2,
  validateVerificationDagV2,
  verificationAttestationDigestV2,
  verificationDagDigestV2,
  verificationNodeDigestV2,
  verifyPrototypeAttestationV2,
  type VerificationAttestationV2,
  type VerificationDagInputV2,
  type VerificationDagNodeV2,
  type VerificationDagV2,
} from "../packages/contracts/src/index.js";

const BASE = "1".repeat(40);
const HEAD = "2".repeat(40);
const DIGEST = "a".repeat(64);

function graph(): VerificationDagV2 {
  return JSON.parse(readFileSync("verification/verification-dag-v2.json", "utf8")) as VerificationDagV2;
}

function observed(input = graph()): Record<string, string> {
  return Object.fromEntries(input.nodes.flatMap((node) => node.inputs.map(({ path, sha256 }) => [path, sha256])));
}

function plan(changedPaths: readonly string[], input = graph()) {
  return buildVerificationImpactPlanV2({
    graph: input,
    graphPath: "verification/verification-dag-v2.json",
    baseSha: BASE,
    headSha: HEAD,
    changedPaths,
    observedInputDigests: observed(input),
  });
}

test("VF-002 freezes a closed versioned Evidence DAG schema and canonical manifest", () => {
  const schema = JSON.parse(readFileSync("schemas/contracts/verification-evidence-dag-v2.schema.json", "utf8"));
  const validate = new Ajv2020({ allErrors: true, strict: true }).compile(schema);
  assert.equal(validate(graph()), true, JSON.stringify(validate.errors));
  assert.equal(validateVerificationDagV2(graph()), true);
  assert.match(verificationDagDigestV2(graph()), /^[a-f0-9]{64}$/);
});

test("canonical Evidence DAG input digests match the current repository bytes", () => {
  for (const node of graph().nodes) {
    for (const input of node.inputs) {
      const actual = createHash("sha256").update(readFileSync(input.path)).digest("hex");
      assert.equal(actual, input.sha256, `${node.id}:${input.path}`);
    }
  }
});

test("AWI-03 knowledge changes select the bounded critical owner and hard gates", () => {
  const result = plan(["packages/contracts/src/knowledge-envelope.ts"]);
  assert.equal(result.mode, "IMPACTED_SHADOW");
  assert.deepEqual(result.selectedNodes, ["awi-03-knowledge-envelope", "awi-plugin-01-knowledge-harvest-v1", "cks-02-local-knowledge-fabric-closure-v1", "cks-03-fresh-synthetic-qualification-v1", "cks-04-no-finetune-runtime-baseline-v1", "cks-05-comparative-falsification-v1", "cks-07-empty-kb-sufficiency-v1", "cks-08-usage-lineage-attribution-v1", "cks-09-task-pattern-proof-v1", "cks-10-readonly-analytics-bridge-v1", "cks-11-governed-workflow-function-v1", "cks-12-closed-learning-loop-v1", "cks-m1-parent-closure-v1", "lkc-files-01-local-file-corpus", "lkc-wiki-01-governed-local-edition-v1", "rks-01-real-source-protocol-falsification-v1"]);
  assert.deepEqual(result.selectedTests, ["npm run cks02:test", "npm run cks03:test", "npm run cks04:test", "npm run cks05:test", "npm run cks07:test", "npm run cks08:test", "npm run cks09:test", "npm run cks10:test", "npm run cks11:test", "npm run cks12:test", "npm run cksm1:test", "npm run knowledge-envelope:test", "npm run local-file-corpus:test", "npm run plugin-knowledge-harvest:test", "npm run rks01:test", "npm run wiki:test"]);
  assert.deepEqual(result.hardGates, [...graph().hardGates].sort((a, b) => a.localeCompare(b, "en")));
});

test("single-node changes select the owner, downstream integrity and mandatory hard gates", () => {
  const result = plan(["scripts/verification-plan.mjs"]);
  assert.equal(result.mode, "IMPACTED_SHADOW");
  assert.deepEqual(result.selectedNodes, ["learning-routing-foundation", "openclaw-m1-4", "openclaw-m1-5", "repository-integrity", "secure-default-proof", "vf-m2-adaptive-evidence-gates-v1", "vf-shadow-v2"]);
  assert.ok(result.selectedTests.includes("node --test dist/tests/verification-fabric-v2.test.js"));
  assert.deepEqual(result.hardGates, [...graph().hardGates].sort((a, b) => a.localeCompare(b, "en")));
});

test("contract and cross-contract changes invalidate downstream dependants", () => {
  for (const changed of [
    "packages/contracts/src/verification-fabric.ts",
    "schemas/contracts/verification-fabric-bundle-v1.schema.json",
  ]) {
    const result = plan([changed]);
    assert.equal(result.mode, "IMPACTED_SHADOW");
    assert.deepEqual(result.selectedNodes, ["awi-plugin-01-knowledge-harvest-v1", "azpp-m1-repository-synthetic-v1", "cap-cell-erp-01", "cks-02-local-knowledge-fabric-closure-v1", "cks-03-fresh-synthetic-qualification-v1", "cks-04-no-finetune-runtime-baseline-v1", "cks-05-comparative-falsification-v1", "cks-07-empty-kb-sufficiency-v1", "cks-08-usage-lineage-attribution-v1", "cks-09-task-pattern-proof-v1", "cks-10-readonly-analytics-bridge-v1", "cks-11-governed-workflow-function-v1", "cks-12-closed-learning-loop-v1", "cks-m1-parent-closure-v1", "etl-01-extension-assurance-profile-v1", "etl-02-external-plugin-preflight-v1", "external-bi-service-v2", "intake-001-issue-candidate-v1", "integration-profile-v1", "know-media-m1-audience-learning-v1", "learning-routing-foundation", "lkc-wiki-01-governed-local-edition-v1", "openclaw-m1-4", "openclaw-m1-5", "repository-integrity", "rks-01-real-source-protocol-falsification-v1", "secure-default-proof", "vf-contract-v1", "vf-m2-adaptive-evidence-gates-v1", "vf-shadow-v2"]);
  }
});

test("extension assurance changes select their bounded owner and repository integrity closure", () => {
  const result = plan(["packages/contracts/src/extension-assurance-profile.ts"]);
  assert.equal(result.mode, "IMPACTED_SHADOW");
  assert.deepEqual(result.selectedNodes, ["etl-01-extension-assurance-profile-v1", "openclaw-m1-4", "openclaw-m1-5", "repository-integrity", "secure-default-proof"]);
  assert.ok(result.selectedTests.includes("node --test dist/tests/extension-assurance-profile-negative-zero.test.js dist/tests/extension-assurance-profile.test.js"));
  assert.deepEqual(result.hardGates, [...graph().hardGates].sort((a, b) => a.localeCompare(b, "en")));
});

test("either non-security video surface selects one owner and both video commands", () => {
  for (const changed of ["packages/contracts/src/external-video-service.ts", "tools/video-production-reference/README.md"]) {
    const result = plan([changed]);
    assert.equal(result.mode, "IMPACTED_SHADOW");
    assert.deepEqual(result.selectedNodes, ["know-media-m1-audience-learning-v1"]);
    assert.deepEqual(result.selectedTests, ["npm run external-video-service:test", "npm run video:test"]);
  }
});

test("local video security-role changes force full fallback", () => {
  const result = plan(["tools/video-production-reference/src/safe-io.mjs"]);
  assert.equal(result.mode, "FULL_FALLBACK");
  assert.deepEqual(result.reasons, ["CENTRAL_INPUT_CHANGED"]);
  assert.equal(result.selectedNodes.length, graph().nodes.length);
});

test("learning-routing changes select the complete foundation and downstream integrity gates", () => {
  const result = plan(["packages/contracts/src/learning-routing-baseline.ts"]);
  assert.equal(result.mode, "IMPACTED_SHADOW");
  assert.deepEqual(result.selectedNodes, ["learning-routing-foundation", "openclaw-m1-4", "openclaw-m1-5", "repository-integrity", "secure-default-proof"]);
  assert.ok(result.selectedTests.includes("npm run learning-routing:test"));
});

test("integration profile changes select the bounded owner and downstream integrity gates", () => {
  const result = plan(["packages/contracts/src/integration-profile.ts"]);
  assert.equal(result.mode, "IMPACTED_SHADOW");
  assert.deepEqual(result.selectedNodes, ["cap-cell-erp-01", "integration-profile-v1", "openclaw-m1-4", "openclaw-m1-5", "repository-integrity", "secure-default-proof"]);
  assert.ok(result.selectedTests.includes("npm run integration-profile:test"));
});

test("ERP capability-cell changes select the bounded owner and exact focused suite", () => {
  const result = plan(["packages/contracts/src/erp-order-capability-cell.ts"]);
  assert.equal(result.mode, "IMPACTED_SHADOW");
  assert.deepEqual(result.selectedNodes, ["cap-cell-erp-01"]);
  assert.deepEqual(result.selectedTests, ["npm run erp-order-cell:test"]);
});

test("external BI v2 client changes select only the thin client and downstream integrity gates", () => {
  const result = plan(["packages/contracts/src/external-bi-service.ts"]);
  assert.equal(result.mode, "IMPACTED_SHADOW");
  assert.deepEqual(result.selectedNodes, ["external-bi-service-v2", "openclaw-m1-4", "openclaw-m1-5", "repository-integrity", "secure-default-proof"]);
  assert.ok(result.selectedTests.includes("npm run external-bi-service:test"));
});

test("both canonical JSON implementations invalidate the M1.4 node and secure-default closure", () => {
  const m14 = graph().nodes.find(({ id }) => id === "openclaw-m1-4");
  assert.ok(m14);
  for (const changed of [
    "packages/contracts/src/canonical-json.ts",
    "packages/contracts/src/canonical-json.js",
  ]) {
    assert.ok(m14.inputs.some(({ path }) => path === changed), changed);
    const result = plan([changed]);
    assert.ok(result.selectedNodes.includes("openclaw-m1-4"), changed);
    assert.ok(result.selectedNodes.includes("secure-default-proof"), changed);
    assert.ok(result.selectedTests.includes("npm run openclaw-m1.4:test"), changed);
  }
});

test("central toolchain and security changes invalidate the global closure", () => {
  for (const changed of ["package.json", "scripts/verify-supply-chain.mjs"]) {
    const result = plan([changed]);
    assert.equal(result.mode, "FULL_FALLBACK");
    assert.deepEqual(result.reasons, ["CENTRAL_INPUT_CHANGED"]);
    assert.equal(result.selectedNodes.length, graph().nodes.length);
  }
});

test("unmapped, unsafe, graph and ambiguous changes fail closed", () => {
  assert.deepEqual(plan(["new/unmapped.mjs"]).reasons, ["UNMAPPED_PATH"]);
  assert.deepEqual(plan(["../escape.mjs"]).reasons, ["UNSAFE_PATH"]);
  assert.deepEqual(plan(["verification/verification-dag-v2.json"]).reasons, ["GRAPH_CHANGED"]);

  const ambiguous = structuredClone(graph()) as VerificationDagV2;
  const first = ambiguous.nodes[0]?.inputs[0];
  const second = ambiguous.nodes[1];
  assert.ok(first && second);
  (second.inputs as VerificationDagInputV2[]).push(first);
  const result = buildVerificationImpactPlanV2({
    graph: ambiguous,
    graphPath: "verification/verification-dag-v2.json",
    baseSha: BASE,
    headSha: HEAD,
    changedPaths: [first.path],
    observedInputDigests: observed(ambiguous),
  });
  assert.deepEqual(result.reasons, ["AMBIGUOUS_OWNERSHIP"]);
});

test("invalid, cyclic and unknown-node graphs are rejected", () => {
  const cyclic = structuredClone(graph()) as VerificationDagV2;
  const first = cyclic.nodes.find(({ id }) => id === "intake-001-issue-candidate-v1");
  const dependent = cyclic.nodes.find(({ id }) => id === "vf-contract-v1");
  assert.ok(first && dependent);
  (first.dependsOn as string[]).push(dependent.id);
  assert.equal(validateVerificationDagV2(cyclic), false);
  assert.deepEqual(plan(["packages/contracts/src/verification-fabric.ts"], cyclic).reasons, ["INVALID_GRAPH"]);

  const unknown = structuredClone(graph()) as VerificationDagV2;
  (unknown.nodes[0]?.dependsOn as string[]).push("missing-node");
  assert.equal(validateVerificationDagV2(unknown), false);
});

test("input digest drift produces FULL_FALLBACK", () => {
  const input = graph();
  const digests = observed(input);
  const path = input.nodes[0]?.inputs[0]?.path;
  assert.ok(path);
  digests[path] = "f".repeat(64);
  const result = buildVerificationImpactPlanV2({
    graph: input,
    graphPath: "verification/verification-dag-v2.json",
    baseSha: BASE,
    headSha: HEAD,
    changedPaths: [path],
    observedInputDigests: digests,
  });
  assert.deepEqual(result.reasons, ["GRAPH_DRIFT"]);
});

test("plan generation is deterministic", () => {
  const first = plan(["scripts/verification-shadow.mjs", "scripts/verification-plan.mjs"]);
  const second = plan(["scripts/verification-plan.mjs", "scripts/verification-shadow.mjs"]);
  assert.deepEqual(first, second);
  assert.match(first.planDigest, /^[a-f0-9]{64}$/);
});

function ttlNode(): VerificationDagNodeV2 {
  const node = structuredClone(graph().nodes.find(({ id }) => id === "vf-shadow-v2"));
  assert.ok(node);
  return { ...node, evidenceTtlMs: 1_000, ttlJustification: "Bounded replay probe only." };
}

function attestation(node = ttlNode()): VerificationAttestationV2 {
  const unsigned = {
    schemaVersion: VERIFICATION_ATTESTATION_SCHEMA_V2,
    nodeId: node.id,
    nodeDigest: verificationNodeDigestV2(node),
    graphDigest: DIGEST,
    toolchainDigest: "b".repeat(64),
    environmentDigest: "c".repeat(64),
    createdAtMs: 1_000,
    expiresAtMs: 2_000,
    testResults: node.ownedTests.map((ownedTest) => ({ test: ownedTest, outcome: "PASS" as const })),
  };
  return { ...unsigned, attestationDigest: verificationAttestationDigestV2(unsigned) };
}

function verify(attestationInput: unknown, nowMs = 1_500) {
  return verifyPrototypeAttestationV2({
    attestation: attestationInput,
    node: ttlNode(),
    graphDigest: DIGEST,
    toolchainDigest: "b".repeat(64),
    environmentDigest: "c".repeat(64),
    nowMs,
  });
}

test("prototype attestation schema is closed and exact matches remain non-authoritative", () => {
  const schema = JSON.parse(readFileSync("schemas/contracts/verification-attestation-v2.schema.json", "utf8"));
  const validate = new Ajv2020({ allErrors: true, strict: true }).compile(schema);
  assert.equal(validate(attestation()), true, JSON.stringify(validate.errors));
  assert.deepEqual(verify(attestation()), { outcome: "REUSABLE_PROTOTYPE", authoritative: false });
});

test("missing, tampered and stale attestations deny", () => {
  assert.deepEqual(verify(null), {
    outcome: "DENIED", authoritative: false, reasons: ["ATTESTATION_MISSING_DENIED"],
  });
  const tampered = { ...attestation(), environmentDigest: "d".repeat(64) };
  assert.deepEqual(verify(tampered), {
    outcome: "DENIED", authoritative: false, reasons: ["ATTESTATION_TAMPERED_DENIED"],
  });
  assert.deepEqual(verify(attestation(), 2_001), {
    outcome: "DENIED", authoritative: false, reasons: ["ATTESTATION_STALE_DENIED"],
  });
});

test("exact version, node, toolchain and environment binding is required", () => {
  const mismatched = attestation();
  const unsigned = { ...mismatched, environmentDigest: "d".repeat(64) };
  const { attestationDigest: ignored, ...content } = unsigned;
  const resigned = { ...content, attestationDigest: verificationAttestationDigestV2(content) };
  assert.deepEqual(verify(resigned), {
    outcome: "DENIED", authoritative: false, reasons: ["ATTESTATION_MISMATCH_DENIED"],
  });
});

test("selector exceptions produce FULL_FALLBACK with all hard gates", () => {
  const input = graph();
  const result = buildVerificationImpactPlanFailClosedV2({
    graph: input,
    graphPath: "verification/verification-dag-v2.json",
    baseSha: BASE,
    headSha: HEAD,
    changedPaths: ["scripts/verification-plan.mjs"],
    observedInputDigests: observed(input),
  }, () => { throw new Error("synthetic selector failure"); });
  assert.equal(result.mode, "FULL_FALLBACK");
  assert.deepEqual(result.reasons, ["CLASSIFIER_FAILURE"]);
  assert.deepEqual(result.hardGates, [...input.hardGates].sort((a, b) => a.localeCompare(b, "en")));
});

test("the authoritative full-suite comparator executes for impacted and fallback plans", async () => {
  for (const selectedPlan of [plan(["scripts/verification-plan.mjs"]), plan(["unmapped/new.mjs"])]) {
    let calls = 0;
    const report = await runVerificationShadowComparatorV2(selectedPlan, async () => {
      calls += 1;
      return 0;
    });
    assert.equal(calls, 1);
    assert.deepEqual(report.comparator, {
      command: "npm test", authoritative: true, executed: true, exitCode: 0,
    });
    assert.equal(report.activation, "BLOCKED_SAMPLE_GATE");
  }
});
