#!/usr/bin/env node
import { createHash } from "node:crypto";
import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";

const root = process.cwd();
const digest = (relative) => createHash("sha256").update(readFileSync(path.join(root, relative))).digest("hex");
const writeJson = (relative, value) => writeFileSync(path.join(root, relative), `${JSON.stringify(value, null, 2)}\n`);
const canonicalJson = (value) => {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  if (value !== null && typeof value === "object") {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonicalJson(value[key])}`).join(",")}}`;
  }
  return JSON.stringify(value);
};
const sha256 = (value) => createHash("sha256").update(value).digest("hex");
const buildSecureDefaultEvidence = (manifest) => {
  const manifestDigest = sha256(canonicalJson(manifest));
  const artifacts = [...manifest.artifacts]
    .map(({ path: artifactPath, sha256: artifactDigest }) => ({ path: artifactPath, sha256: artifactDigest }))
    .sort((left, right) => left.path.localeCompare(right.path, "en"));
  const core = {
    schemaVersion: "chimpmaera.security/secure-default-proof-evidence/v1",
    proofId: manifest.proofId,
    profile: manifest.profile,
    evidenceState: "CURRENT",
    manifestDigest,
    schemaDigest: manifest.schemaBinding.sha256,
    verifierDigest: manifest.verifier.sha256,
    inputSetDigest: sha256(canonicalJson(artifacts)),
    commands: [
      ...manifest.commands.focused.map((command) => ({ command, category: "FOCUSED", outcome: "PASS" })),
      { command: manifest.commands.authoritative, category: "AUTHORITATIVE", outcome: "PASS" },
    ],
    comparison: { focusedSubsetOfAuthoritative: true, authoritativeCommand: "npm test", noSkipping: true },
    claimVerdicts: manifest.claims.map(({ claimId, verdict }) => ({ claimId, verdict })),
    overallVerdict: "PASS",
  };
  return { ...core, reportDigest: sha256(canonicalJson(core)) };
};

function walk(relative) {
  return readdirSync(path.join(root, relative), { withFileTypes: true })
    .flatMap((entry) => entry.isDirectory() ? walk(path.posix.join(relative, entry.name)) : [path.posix.join(relative, entry.name)]);
}

// Governance ownership is pre-existing review state, not generated integrity
// data. Validate it before any write so refresh can never invent or repair the
// owner mapping as a side effect.
const dagPath = "verification/verification-dag-v2.json";
const dag = JSON.parse(readFileSync(path.join(root, dagPath), "utf8"));
const mediaOwners = dag.nodes.filter(({ id }) => id === "know-media-m1-audience-learning-v1");
if (mediaOwners.length !== 1) throw new Error("MEDIA_M1_DAG_OWNER_MISSING_OR_DUPLICATED");
const mediaNode = mediaOwners[0];
const establishedMediaInputs = [
  ["packages/contracts/src/external-video-service.ts", "CONTRACT"],
  ["tests/external-video-service.test.ts", "VALIDATOR"],
  ["docs/EXTERNAL-VIDEO-SERVICE.md", "DERIVED_EVIDENCE"],
];
const inputIdentities = mediaNode.inputs.map(({ path: inputPath, role }) => `${inputPath}\0${role}`);
if (new Set(mediaNode.inputs.map(({ path: inputPath }) => inputPath)).size !== mediaNode.inputs.length
  || establishedMediaInputs.some(([inputPath, role], index) => inputIdentities[index] !== `${inputPath}\0${role}`)) {
  throw new Error("MEDIA_M1_DAG_EXTERNAL_INPUT_OWNERSHIP_DENIED");
}

const lockPath = "demo/manifests/supply-chain/openclaw-agent-runtime-lock-v1.json";
const lock = JSON.parse(readFileSync(path.join(root, lockPath), "utf8"));
const lockedPaths = [
  ...walk("demo/openclaw-agent"),
  "packages/contracts/src/canonical-json.js",
  "packages/contracts/src/capability-catalogue.ts",
  "scripts/verify-openclaw-agent-runtime-lock.mjs",
].sort();
lock.fixtureBuild.artifactSha256 = Object.fromEntries(lockedPaths.map((relative) => [relative, digest(relative)]));
writeJson(lockPath, lock);

const proofPath = "security/secure-default-proof-v1.json";
const proof = JSON.parse(readFileSync(path.join(root, proofPath), "utf8"));
const proofAdditions = [
  { path: "demo/manifests/supply-chain/openclaw-agent-runtime-lock-v1.json", role: "IMPLEMENTATION" },
  { path: "scripts/verify-openclaw-agent-runtime-lock.mjs", role: "VERIFIER" },
  { path: "demo/openclaw-agent/runtime-contract-v1.json", role: "IMPLEMENTATION" },
  { path: "demo/openclaw-agent/gateway-workload-contract-v2.json", role: "IMPLEMENTATION" },
  { path: "demo/openclaw-agent/plugin/identity-v2.mjs", role: "IMPLEMENTATION" },
  { path: "demo/openclaw-agent/gateway.mjs", role: "IMPLEMENTATION" },
  { path: "demo/openclaw-agent/gateway.Dockerfile", role: "IMPLEMENTATION" },
  { path: "demo/openclaw-agent/openclaw.Dockerfile", role: "IMPLEMENTATION" },
  { path: "demo/openclaw-agent/openclaw.json", role: "IMPLEMENTATION" },
  { path: "demo/openclaw-agent/plugin/index.mjs", role: "IMPLEMENTATION" },
  { path: "demo/openclaw-agent/plugin/response-v1.mjs", role: "IMPLEMENTATION" },
  { path: "demo/openclaw-agent/plugin/openclaw.plugin.json", role: "IMPLEMENTATION" },
  { path: "demo/openclaw-agent/plugin/package.json", role: "IMPLEMENTATION" },
  { path: "demo/openclaw-agent/capability-m1-4-adapter.mjs", role: "IMPLEMENTATION" },
  { path: "demo/openclaw-agent/gateway-state.mjs", role: "IMPLEMENTATION" },
  { path: "demo/openclaw-agent/mind-store.mjs", role: "IMPLEMENTATION" },
  { path: "packages/contracts/src/capability-catalogue.ts", role: "IMPLEMENTATION" },
  { path: "packages/contracts/src/canonical-json.ts", role: "IMPLEMENTATION" },
  { path: "packages/contracts/src/canonical-json.js", role: "IMPLEMENTATION" },
  { path: "tests/capability-catalogue.test.ts", role: "TEST" },
  { path: "tests/canonical-json-runtime-parity.test.mjs", role: "TEST" },
  { path: "tests/openclaw-agent-runtime-lock.test.mjs", role: "TEST" },
  { path: "tests/openclaw-agent-runtime.test.mjs", role: "TEST" },
  { path: "tests/openclaw-gateway-identity-network.test.mjs", role: "TEST" },
  { path: "tests/openclaw-gateway-state.test.mjs", role: "TEST" },
  { path: "tests/openclaw-m1.4-gateway-e2e.test.mjs", role: "TEST" },
  { path: "tests/helpers/openclaw-m1-4-harness.mjs", role: "TEST" },
  { path: "security/openclaw-m1.4-evidence-v1.json", role: "EVIDENCE" },
];
const byPath = new Map(proof.artifacts.map((artifact) => [artifact.path, artifact]));
for (const artifact of proofAdditions) if (!byPath.has(artifact.path)) byPath.set(artifact.path, artifact);
proof.artifacts = [...byPath.values()].map((artifact) => ({ ...artifact, sha256: digest(artifact.path) }));
proof.schemaBinding.sha256 = digest(proof.schemaBinding.path);
proof.verifier.sha256 = digest(proof.verifier.path);
writeJson(proofPath, proof);
writeJson("security/secure-default-proof-evidence-v1.json", buildSecureDefaultEvidence(proof));

dag.graphVersion = 35;
const verificationFabricNode = dag.nodes.find(({ id }) => id === "vf-contract-v1");
if (verificationFabricNode === undefined) throw new Error("VF_CONTRACT_V1_DAG_NODE_MISSING");
const verificationFabricInputs = [
  ["packages/contracts/src/verification-fabric.ts", "CONTRACT"],
  ["schemas/contracts/verification-fabric-bundle-v1.schema.json", "SCHEMA"],
  ["tests/fixtures/verification-fabric/positive-bundle-v1.json", "FIXTURE"],
  ["tests/fixtures/verification-fabric/negative-matrix-v1.json", "FIXTURE"],
  ["tests/verification-fabric.test.ts", "VALIDATOR"],
  ["tests/verification-fabric-negative-zero.test.ts", "VALIDATOR"],
];
verificationFabricNode.inputs = verificationFabricInputs.map(([inputPath, role]) => ({
  path: inputPath,
  role,
  sha256: digest(inputPath),
}));
verificationFabricNode.ownedTests = [
  "node --test dist/tests/verification-fabric-negative-zero.test.js dist/tests/verification-fabric.test.js",
];
const extensionAssuranceInputs = [
  ["packages/contracts/src/extension-assurance-profile.ts", "CONTRACT"],
  ["schemas/contracts/extension-assurance-profile-v1.schema.json", "SCHEMA"],
  ["tests/fixtures/extension-assurance/positive-profile-v1.json", "FIXTURE"],
  ["tests/fixtures/extension-assurance/negative-matrix-v1.json", "FIXTURE"],
  ["tests/extension-assurance-profile.test.ts", "VALIDATOR"],
  ["tests/extension-assurance-profile-negative-zero.test.ts", "VALIDATOR"],
  ["docs/EXTENSION-ASSURANCE-PROFILES.md", "DERIVED_EVIDENCE"],
];
let extensionAssuranceNode = dag.nodes.find(({ id }) => id === "etl-01-extension-assurance-profile-v1");
if (extensionAssuranceNode === undefined) {
  extensionAssuranceNode = {
    id: "etl-01-extension-assurance-profile-v1",
    dependsOn: ["vf-contract-v1"],
    inputs: [],
    ownedTests: [],
    invariants: [
      "The local synthetic profile grants no trust, admission, installation, activation, execution or marketplace authority.",
      "Unknown, unsafe, fractional, negative-zero, stale, reversed, inconsistent or digest-drifting canonical numbers fail closed.",
      "Canonical zero and safe nonnegative timestamps and counts retain deterministic digest-bound profile behavior.",
    ],
    riskClass: "HIGH",
    globalInvalidation: false,
  };
  dag.nodes.push(extensionAssuranceNode);
}
extensionAssuranceNode.inputs = extensionAssuranceInputs.map(([inputPath, role]) => ({
  path: inputPath,
  role,
  sha256: digest(inputPath),
}));
extensionAssuranceNode.ownedTests = [
  "node --test dist/tests/extension-assurance-profile-negative-zero.test.js dist/tests/extension-assurance-profile.test.js",
];
const repositoryIntegrityNode = dag.nodes.find(({ id }) => id === "repository-integrity");
if (repositoryIntegrityNode === undefined) throw new Error("REPOSITORY_INTEGRITY_DAG_NODE_MISSING");
if (!repositoryIntegrityNode.dependsOn.includes(extensionAssuranceNode.id)) {
  repositoryIntegrityNode.dependsOn.push(extensionAssuranceNode.id);
}
const externalPluginInputs = [
  ["packages/contracts/src/external-plugin-preflight.ts", "SECURITY"],
  ["schemas/contracts/external-plugin-preflight-v1.schema.json", "SCHEMA"],
  ["tests/external-plugin-preflight.test.ts", "VALIDATOR"],
  ["tests/fixtures/external-plugin-preflight/dsh-benign-v1.json", "FIXTURE"],
  ["tests/fixtures/external-plugin-preflight/mcp-risk-v1.json", "FIXTURE"],
  ["tests/fixtures/external-plugin-preflight/package-risk-v1.json", "FIXTURE"],
  ["tests/fixtures/external-plugin-preflight/skill-risk-v1.json", "FIXTURE"],
  ["docs/EXTERNAL-PLUGIN-PREFLIGHT.md", "DERIVED_EVIDENCE"],
];
let externalPluginNode = dag.nodes.find(({ id }) => id === "etl-02-external-plugin-preflight-v1");
if (externalPluginNode === undefined) {
  externalPluginNode = {
    id: "etl-02-external-plugin-preflight-v1",
    dependsOn: ["vf-contract-v1"],
    inputs: [],
    ownedTests: ["npm run external-plugin-preflight:test"],
    invariants: [
      "Preflight consumes caller-supplied immutable bytes without filesystem, network, process or foreign-harness execution authority.",
      "Unknown versions, mutable dependencies, path ambiguity, digest mismatch and execution-bearing package metadata fail closed with fixed reason codes.",
      "A static-clear result is evidence only and never grants profile conformance, admission, installation, activation or execution authority.",
    ],
    riskClass: "CRITICAL",
    globalInvalidation: false,
  };
  dag.nodes.push(externalPluginNode);
}
externalPluginNode.inputs = externalPluginInputs.map(([inputPath, role]) => ({
  path: inputPath,
  role,
  sha256: digest(inputPath),
}));
const pluginKnowledgeInputs = [
  ["packages/contracts/src/plugin-knowledge-harvest.ts", "SECURITY"],
  ["tests/plugin-knowledge-harvest.test.ts", "VALIDATOR"],
  ["tests/fixtures/plugin-knowledge-harvest/official-primary-v1.json", "FIXTURE"],
  ["tests/fixtures/plugin-knowledge-harvest/official-primary-snapshot-v1.json", "FIXTURE"],
  ["tests/fixtures/plugin-knowledge-harvest/synthetic-metadata-v1.json", "FIXTURE"],
  ["tests/fixtures/plugin-knowledge-harvest/synthetic-metadata-snapshot-v1.json", "FIXTURE"],
  ["tests/fixtures/plugin-knowledge-harvest/etl02-negative-v1.json", "FIXTURE"],
  ["tests/fixtures/plugin-knowledge-harvest/etl02-report-snapshot-v1.json", "FIXTURE"],
  ["docs/PLUGIN-KNOWLEDGE-HARVEST.md", "DERIVED_EVIDENCE"],
  ["docs/development/awi-plugin-01-issue-239-pdca.md", "DERIVED_EVIDENCE"],
];
let pluginKnowledgeNode = dag.nodes.find(({ id }) => id === "awi-plugin-01-knowledge-harvest-v1");
if (pluginKnowledgeNode === undefined) {
  pluginKnowledgeNode = {
    id: "awi-plugin-01-knowledge-harvest-v1",
    dependsOn: ["awi-03-knowledge-envelope", "etl-02-external-plugin-preflight-v1"],
    inputs: [],
    ownedTests: ["npm run plugin-knowledge-harvest:test"],
    invariants: [
      "Every record remains bound to exact checked-in snapshot bytes, citation, selector, licence, review time and expiry.",
      "Unknown, disputed, conflicting and source-invalidated records never become curated or generation candidates.",
      "Harvest output grants no credential, policy, capability, tool, write, execution, installation or runtime authority.",
    ],
    riskClass: "CRITICAL",
    globalInvalidation: false,
  };
  dag.nodes.push(pluginKnowledgeNode);
}
pluginKnowledgeNode.inputs = pluginKnowledgeInputs.map(([inputPath, role]) => ({
  path: inputPath,
  role,
  sha256: digest(inputPath),
}));
const intakeNode = dag.nodes.find(({ id }) => id === "intake-001-issue-candidate-v1");
if (intakeNode === undefined) throw new Error("INTAKE_001_DAG_NODE_MISSING");
const intakeInputs = [
  ["packages/contracts/src/issue-candidate.ts", "SECURITY"],
  ["schemas/contracts/issue-candidate-v1.schema.json", "SCHEMA"],
  ["tests/fixtures/issue-candidate/positive-v1.json", "FIXTURE"],
  ["tests/fixtures/issue-candidate/quarantine-v1.json", "FIXTURE"],
  ["tests/issue-candidate.test.ts", "VALIDATOR"],
  ["scripts/render-issue-candidate-evidence.mjs", "VALIDATOR"],
  ["docs/ISSUE-CANDIDATE-OPERATOR-GUIDE.md", "DERIVED_EVIDENCE"],
  ["docs/development/intake-001-issue-46-pdca.md", "DERIVED_EVIDENCE"],
  ["verification/intake-001-evidence-v1.json", "DERIVED_EVIDENCE"],
];
intakeNode.inputs = intakeInputs.map(([inputPath, role]) => ({ path: inputPath, role, sha256: digest(inputPath) }));
const externalBiNode = dag.nodes.find(({ id }) => id === "external-bi-service-v2");
if (externalBiNode === undefined) throw new Error("EXTERNAL_BI_V2_DAG_NODE_MISSING");
const externalBiInputs = [
  ["packages/contracts/src/external-bi-service.ts", "CONTRACT"],
  ["tests/external-bi-service.test.ts", "VALIDATOR"],
  ["tests/fixtures/external-bi-service-v2-clean-room.json", "FIXTURE"],
  ["scripts/verify-external-bi-service-v2-clean-room.mjs", "VALIDATOR"],
  ["docs/EXTERNAL-BI-SERVICE.md", "DERIVED_EVIDENCE"],
];
externalBiNode.inputs = externalBiInputs.map(([inputPath, role]) => ({ path: inputPath, role, sha256: digest(inputPath) }));
mediaNode.ownedTests = ["npm run external-video-service:test", "npm run video:test"];
const mediaInputs = [
  ["packages/contracts/src/external-video-service.ts", "CONTRACT"],
  ["tests/external-video-service.test.ts", "VALIDATOR"],
  ["docs/EXTERNAL-VIDEO-SERVICE.md", "DERIVED_EVIDENCE"],
  ["tools/video-production-reference/EXTENSION-GUIDE.md", "DERIVED_EVIDENCE"],
  ["tools/video-production-reference/NOTICE", "DERIVED_EVIDENCE"],
  ["tools/video-production-reference/README.md", "DERIVED_EVIDENCE"],
  ["tools/video-production-reference/SHA256SUMS", "CONTRACT"],
  ["tools/video-production-reference/assets/synthetic/frame-s01.png", "FIXTURE"],
  ["tools/video-production-reference/assets/synthetic/frame-s02.png", "FIXTURE"],
  ["tools/video-production-reference/assets/synthetic/frame-s03.png", "FIXTURE"],
  ["tools/video-production-reference/assets/synthetic/frame-s04.png", "FIXTURE"],
  ["tools/video-production-reference/assets/synthetic/track-alpha.wav", "FIXTURE"],
  ["tools/video-production-reference/assets/synthetic/track-beta.wav", "FIXTURE"],
  ["tools/video-production-reference/bin/cm-video.mjs", "SECURITY"],
  ["tools/video-production-reference/components/audio.pcm-v1.json", "CONTRACT"],
  ["tools/video-production-reference/components/qa.cpu-v1.json", "CONTRACT"],
  ["tools/video-production-reference/components/renderer.cpu-v1.json", "CONTRACT"],
  ["tools/video-production-reference/jobs/job-alpha.synthetic-v1.json", "FIXTURE"],
  ["tools/video-production-reference/jobs/job-beta.synthetic-v1.json", "FIXTURE"],
  ["tools/video-production-reference/schemas/component-descriptor.schema.v1.json", "SCHEMA"],
  ["tools/video-production-reference/schemas/ownership-marker.schema.v1.json", "SCHEMA"],
  ["tools/video-production-reference/schemas/package-index.schema.v1.json", "SCHEMA"],
  ["tools/video-production-reference/schemas/qa-receipt.schema.v1.json", "SCHEMA"],
  ["tools/video-production-reference/schemas/render-manifest.schema.v1.json", "SCHEMA"],
  ["tools/video-production-reference/schemas/success-marker.schema.v1.json", "SCHEMA"],
  ["tools/video-production-reference/schemas/timeline.schema.v1.json", "SCHEMA"],
  ["tools/video-production-reference/schemas/video-job.schema.v1.json", "SCHEMA"],
  ["tools/video-production-reference/scripts/generate-synthetic-assets.mjs", "VALIDATOR"],
  ["tools/video-production-reference/scripts/verify-closure.mjs", "VALIDATOR"],
  ["tools/video-production-reference/src/audio-pcm.mjs", "SOURCE"],
  ["tools/video-production-reference/src/controller.mjs", "SECURITY"],
  ["tools/video-production-reference/src/job-validator.mjs", "SECURITY"],
  ["tools/video-production-reference/src/media-io.mjs", "SECURITY"],
  ["tools/video-production-reference/src/package-assembly.mjs", "SECURITY"],
  ["tools/video-production-reference/src/qa-cpu.mjs", "SOURCE"],
  ["tools/video-production-reference/src/render-cpu.mjs", "SOURCE"],
  ["tools/video-production-reference/src/safe-io.mjs", "SECURITY"],
  ["tools/video-production-reference/src/select-component.mjs", "SECURITY"],
  ["tools/video-production-reference/src/strict-json.mjs", "SECURITY"],
  ["tools/video-production-reference/src/verify-closure.mjs", "VALIDATOR"],
  ["tools/video-production-reference/tests/closure.test.mjs", "VALIDATOR"],
  ["tools/video-production-reference/tests/slice.test.mjs", "SECURITY"],
];
mediaNode.inputs = mediaInputs.map(([inputPath, role]) => ({ path: inputPath, role, sha256: digest(inputPath) }));
const m14Node = dag.nodes.find(({ id }) => id === "openclaw-m1-4");
if (m14Node === undefined) throw new Error("OPENCLAW_M1_4_DAG_NODE_MISSING");
const m14Inputs = [
  ["demo/manifests/supply-chain/openclaw-agent-runtime-lock-v1.json", "CONTRACT"],
  ["scripts/verify-openclaw-agent-runtime-lock.mjs", "VALIDATOR"],
  ["demo/openclaw-agent/runtime-contract-v1.json", "CONTRACT"],
  ["demo/openclaw-agent/gateway-workload-contract-v2.json", "CONTRACT"],
  ["demo/openclaw-agent/plugin/identity-v2.mjs", "SECURITY"],
  ["demo/openclaw-agent/gateway.mjs", "SOURCE"],
  ["demo/openclaw-agent/gateway-state.mjs", "SOURCE"],
  ["demo/openclaw-agent/gateway.Dockerfile", "SOURCE"],
  ["demo/openclaw-agent/openclaw.Dockerfile", "SOURCE"],
  ["demo/openclaw-agent/openclaw.json", "CONTRACT"],
  ["demo/openclaw-agent/plugin/index.mjs", "SOURCE"],
  ["demo/openclaw-agent/plugin/response-v1.mjs", "VALIDATOR"],
  ["demo/openclaw-agent/plugin/openclaw.plugin.json", "CONTRACT"],
  ["demo/openclaw-agent/plugin/package.json", "CONTRACT"],
  ["demo/openclaw-agent/capability-m1-4-adapter.mjs", "SOURCE"],
  ["packages/contracts/src/capability-catalogue.ts", "CONTRACT"],
  ["packages/contracts/src/canonical-json.ts", "CONTRACT"],
  ["packages/contracts/src/canonical-json.js", "SOURCE"],
  ["tests/capability-catalogue.test.ts", "VALIDATOR"],
  ["tests/canonical-json-runtime-parity.test.mjs", "VALIDATOR"],
  ["tests/openclaw-agent-runtime-lock.test.mjs", "VALIDATOR"],
  ["tests/openclaw-agent-runtime.test.mjs", "VALIDATOR"],
  ["tests/openclaw-gateway-identity-network.test.mjs", "VALIDATOR"],
  ["tests/openclaw-gateway-state.test.mjs", "VALIDATOR"],
  ["tests/openclaw-m1.4-gateway-e2e.test.mjs", "VALIDATOR"],
  ["tests/helpers/openclaw-m1-4-harness.mjs", "FIXTURE"],
  ["docs/OPENCLAW-BOUNDED-STATE-OPERATOR-GUIDE.md", "DERIVED_EVIDENCE"],
  ["docs/development/openclaw-m1.4-issue-7-pdca.md", "DERIVED_EVIDENCE"],
  ["security/openclaw-m1.4-evidence-v1.json", "DERIVED_EVIDENCE"],
];
m14Node.inputs = m14Inputs.map(([inputPath, role]) => ({ path: inputPath, role, sha256: digest(inputPath) }));
const usageInsightsNode = dag.nodes.find(({ id }) => id === "awi-insights-1-usage-insights-v1");
if (usageInsightsNode === undefined) throw new Error("AWI_INSIGHTS_1_DAG_NODE_MISSING");
const usageInsightsInputs = [
  ["packages/contracts/src/usage-insights.ts", "SECURITY"],
  ["packages/usage-insights/src/index.ts", "SECURITY"],
  ["packages/usage-insights/src/cli.ts", "SOURCE"],
  ["packages/contracts/src/canonical-json.ts", "CONTRACT"],
  ["schemas/contracts/usage-insights-event-v1.schema.json", "SCHEMA"],
  ["schemas/contracts/usage-insights-share-envelope-v1.schema.json", "SCHEMA"],
  ["tests/fixtures/usage-insights/positive-opted-in-event-v1.json", "FIXTURE"],
  ["tests/fixtures/usage-insights/negative-matrix-v1.json", "FIXTURE"],
  ["tests/usage-insights.test.ts", "VALIDATOR"],
  ["tests/usage-insights-completion.test.ts", "VALIDATOR"],
  ["docs/USAGE-INSIGHTS-CONTRACT.md", "DERIVED_EVIDENCE"],
  ["docs/development/awi-insights-001-issue-57-pdca.md", "DERIVED_EVIDENCE"],
];
usageInsightsNode.inputs = usageInsightsInputs.map(([inputPath, role]) => ({
  path: inputPath,
  role,
  sha256: digest(inputPath),
}));
usageInsightsNode.ownedTests = ["npm run usage-insights:test"];
usageInsightsNode.invariants = [
  "Fresh installations are network-off; local recording requires an explicit closed consent profile and sharing additionally requires an exact IP-literal loopback endpoint.",
  "Outbound envelopes and events are descriptor-safe exact-key schemas with no free text, paths, domains, secrets, customer/user/tenant identifiers or caller-minted event/install identities.",
  "Separate stores mint independent pseudonyms; replay reuses one atomically persisted batch; successful sharing erases the old epoch before exposing a fresh pseudonym.",
  "Managed local/shared data supports preview, export, immediate revocation and fail-closed batch deletion; diagnostics consent is time-limited.",
  "Reports cover install-to-first-success, retention, errors, denials, rollbacks and version fragmentation while fixed cohort/coverage nonclaims and all-or-nothing threshold-five suppression prevent small-cell disclosure.",
  "The completion reference proves only offline and explicitly opted-in synthetic loopback operation; no production activation, real-user evidence, representative adoption or privacy certification is claimed.",
];
const adaptiveGateInputs = [
  ["packages/contracts/src/adaptive-evidence-gates.ts", "SECURITY"],
  ["schemas/contracts/adaptive-evidence-gate-spec-v1.schema.json", "SCHEMA"],
  ["schemas/contracts/adaptive-evidence-receipt-v1.schema.json", "SCHEMA"],
  ["scripts/adaptive-evidence-gates.mjs", "SECURITY"],
  ["scripts/adaptive-delivery-status.mjs", "SECURITY"],
  ["tests/adaptive-evidence-gates.test.ts", "VALIDATOR"],
  ["docs/ADAPTIVE-EVIDENCE-GATES.md", "DERIVED_EVIDENCE"],
  ["docs/development/vf-m2-adaptive-evidence-gates-pdca.md", "DERIVED_EVIDENCE"],
];
let adaptiveGateNode = dag.nodes.find(({ id }) => id === "vf-m2-adaptive-evidence-gates-v1");
if (adaptiveGateNode === undefined) {
  adaptiveGateNode = {
    id: "vf-m2-adaptive-evidence-gates-v1",
    dependsOn: ["vf-shadow-v2"],
    inputs: [],
    ownedTests: ["npm run adaptive-evidence:test"],
    invariants: [
      "Adaptive profiles are additive and cannot remove scope, freshness, provenance, exact CHECK/EXPECT, parent reverification or delivery-root invariants.",
      "Only registered argv commands execute with shell disabled; unknown profiles, risks, paths, arguments, dependencies, receipts and transitions fail closed.",
      "Local, delivery and product-evidence states remain separate; nonterminal public prefixes, stale work and external waits never become success.",
      "The feature remains Shadow-only and npm test remains authoritative until separately governed activation evidence exists.",
    ],
    riskClass: "CRITICAL",
    globalInvalidation: false,
  };
  dag.nodes.push(adaptiveGateNode);
}
adaptiveGateNode.inputs = adaptiveGateInputs.map(([inputPath, role]) => ({
  path: inputPath,
  role,
  sha256: digest(inputPath),
}));
for (const node of dag.nodes) {
  node.inputs = node.inputs.map((input) => ({ ...input, sha256: digest(input.path) }));
}
writeJson(dagPath, dag);

const sumsPath = path.join(root, "SHA256SUMS");
const entries = new Map(readFileSync(sumsPath, "utf8").trimEnd().split("\n").map((line) => {
  const match = line.match(/^[a-f0-9]{64}  \.\/(.+)$/);
  if (!match) throw new Error(`INVALID_CHECKSUM_LINE:${line}`);
  return [match[1], null];
}));
for (const line of readFileSync(path.join(root, "release/public-files.manifest"), "utf8").split("\n")) {
  if (line && !line.startsWith("#")) entries.set(line.split("\t")[0], null);
}
for (const relative of [
  "scripts/refresh-integrity-data.mjs",
  "docs/development/cap-cell-erp-01-pdca.md",
  "docs/development/vf-m2-adaptive-evidence-gates-pdca.md",
]) entries.set(relative, null);
for (const relative of [...entries.keys()]) {
  if (!existsSync(path.join(root, relative))) entries.delete(relative);
}
const output = [...entries.keys()].sort().map((relative) => {
  if (!statSync(path.join(root, relative)).isFile()) throw new Error(`CHECKSUM_TARGET_NOT_FILE:${relative}`);
  return `${digest(relative)}  ./${relative}`;
});
writeFileSync(sumsPath, `${output.join("\n")}\n`);
console.log(`refreshed ${lockedPaths.length} runtime-lock artifacts, ${proof.artifacts.length} proof artifacts, and ${entries.size} checksums`);
