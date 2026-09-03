import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  ARTIFACT_RETENTION_DAYS,
  COMPLETION_SCHEMA,
  E2E_TIMEOUT_SECONDS,
  EXPECTED_SERVICES,
  NEGATIVE_PROOF_CASES,
  RECEIPT_MAX_AGE_MS,
  RECEIPT_SCHEMA,
  REQUIRED_HARD_GATES,
  WORKFLOW_PATH,
  artifactSafetyIssues,
  buildSuccessReceipt,
  immutableRuntimeImageDigest,
  receiptFileSha256,
  runBoundedProcess,
  sanitizeArtifactText,
  validateReleaseCompletion,
  validateSuccessReceipt,
} from "../scripts/demo-current-head-e2e.mjs";

const HEAD = "1".repeat(40);
const TREE = "2".repeat(40);
const OTHER_HEAD = "3".repeat(40);
const DIGEST = "a".repeat(64);
const OTHER_DIGEST = "b".repeat(64);
const STARTED = "2026-09-03T10:01:00.000Z";
const COMPLETED = "2026-09-03T10:05:00.000Z";
const PUBLISHED = "2026-09-03T10:00:00.000Z";
const NOW = Date.parse("2026-09-03T10:06:00.000Z");

const fixtures = [
  ["SAFE_GUIDED-v1", "demo/manifests/authority/SAFE_GUIDED-v1.json"],
  ["admin-ai-poc-policy-v1", "demo/manifests/authority/admin-ai-poc-policy-v1.json"],
  ["crm-erp-playable-v1", "demo/manifests/catalog/crm-erp-playable-v1.json"],
  ["panskys-zoo-demo-v1", "demo/manifests/fixtures/panskys-zoo-demo-v1.json"],
  ["panskys-zoo-v1", "demo/manifests/identity/panskys-zoo-v1.json"],
  ["local-default-deny-v1", "demo/manifests/network/local-egress-policy-v1.json"],
].map(([id, path], index) => ({ id, path, sha256: String(index + 1).repeat(64) }));

const locks = {
  compose: { path: "demo/compose.yaml", sha256: "7".repeat(64) },
  composeCli: { platform: "linux-x86_64", sha256: "8".repeat(64), version: "v2.40.3" },
  ociReferences: [
    { artifactId: "node-runtime-build", reference: `node:24.14.1-bookworm-slim@sha256:${"9".repeat(64)}` },
    { artifactId: "mariadb-demo", reference: `mariadb@sha256:${"a".repeat(64)}` },
    { artifactId: "espocrm-demo", reference: `espocrm/espocrm@sha256:${"b".repeat(64)}` },
    { artifactId: "dolibarr-demo", reference: `dolibarr/dolibarr@sha256:${"c".repeat(64)}` },
  ],
  packageLock: { path: "package-lock.json", sha256: "d".repeat(64) },
  supplyChain: {
    lockId: "chimpmaera-v02-declared-inputs-v1",
    path: "demo/manifests/supply-chain/artifact-lock-v1.json",
    sha256: "e".repeat(64),
  },
};

function unsignedReceipt() {
  return {
    artifactPolicy: {
      credentialsRetained: false,
      customerDataRetained: false,
      rawProviderPayloadRetained: false,
      retainedFiles: ["cleanup.log", "e2e.log", "receipt.json"],
      retentionDays: ARTIFACT_RETENTION_DAYS,
      runnerPathsRetained: false,
      sanitizationScan: "PASS",
    },
    authoritativeReadback: {
      minimizedDigest: DIGEST,
      providerStatus: "PASS",
      seedVerified: true,
      sourceSha256: OTHER_DIGEST,
      status: "READY_VERIFIED",
    },
    claimBoundary: [
      "LOCAL_SYNTHETIC_ONLY",
      "NO_PRODUCTION_OR_CUSTOMER_DATA_CLAIM",
      "NO_REGISTRY_SIGNATURE_PROVENANCE_OR_REPRODUCIBLE_BUILD_CLAIM",
      "NO_PUBLICATION_ISSUE_QUEUE_OR_AUTHORITY_EFFECT",
    ],
    cleanup: {
      attempted: true,
      ownedResourcesAfter: { containers: 0, images: 0, networks: 0, volumes: 0 },
      ownedResourcesBefore: { containers: 5, images: 1, networks: 8, volumes: 5 },
      purgeOutcome: "PASS",
      stateRemoved: true,
      strategy: "COMPOSE_PROJECT_AND_RUN_OWNER_LABELS",
    },
    execution: {
      acceptance: { evidenceSha256: DIGEST, outcome: "PASS" },
      completedAt: COMPLETED,
      durationMs: 240_000,
      install: { evidenceSha256: OTHER_DIGEST, outcome: "PASS" },
      namespace: "pansphaira-e2e-123456-1",
      providerReadback: { evidenceSha256: "c".repeat(64), outcome: "PASS" },
      scenario: "SAFE_DEMO_COLD",
      startedAt: STARTED,
      timedOut: false,
      timeoutSeconds: E2E_TIMEOUT_SECONDS,
    },
    fixtures: structuredClone(fixtures),
    governedEffect: {
      effectReceiptDigest: "f".repeat(64),
      enforcementPoint: "CHIMPMAERA_RUNTIME_MUTATION_GATE_V1",
      evidenceEligibility: "CURRENT_BYTE_GATE_ENFORCED",
      knownInstallerGovernanceBypass: false,
      outcome: "PROVIDER_MUTATION_READBACK_VERIFIED",
      status: "PASS",
    },
    locks: { ...structuredClone(locks), runtimeImageId: `sha256:${"6".repeat(64)}` },
    networkBoundary: {
      declaredRegistryInputs: "PINNED_DIGEST_DECLARATIONS_ONLY",
      runtimeExternalEgress: "DENIED_BY_INTERNAL_OR_NON_MASQUERADED_NETWORKS",
      verified: true,
    },
    producedBy: {
      event: "release",
      kind: "GITHUB_ACTIONS_OBSERVATION",
      repository: "JoFe2/PANSPHAIRA",
      runAttempt: 1,
      runId: "123456",
      workflowPath: WORKFLOW_PATH,
    },
    schemaVersion: RECEIPT_SCHEMA,
    serviceHealth: EXPECTED_SERVICES.map((service) => ({ health: "healthy", service, state: "running" })),
    source: { commitSha: HEAD, treeSha: TREE },
  };
}

function receipt() {
  return buildSuccessReceipt(unsignedReceipt());
}

function expected(overrides = {}) {
  return {
    commitSha: HEAD,
    fixtures,
    locks,
    maxAgeMs: RECEIPT_MAX_AGE_MS,
    nowMs: NOW,
    treeSha: TREE,
    ...overrides,
  };
}

function resign(input) {
  const copy = structuredClone(input);
  delete copy.receiptDigest;
  return buildSuccessReceipt(copy);
}

function completion(currentReceipt = receipt()) {
  return {
    artifactReadback: {
      artifactDigest: DIGEST,
      artifactName: `demo-current-head-e2e-${HEAD}`,
      conclusion: "success",
      headSha: HEAD,
      receiptFileSha256: receiptFileSha256(currentReceipt),
      runAttempt: currentReceipt.producedBy.runAttempt,
      runId: currentReceipt.producedBy.runId,
      source: "GITHUB_ACTIONS_PROVIDER_READBACK",
      treeSha: TREE,
      workflowPath: WORKFLOW_PATH,
    },
    claimBoundary: [
      "EVIDENCE_VALIDATION_ONLY",
      "NO_PROVIDER_QUEUE_ISSUE_OR_RELEASE_MUTATION",
      "NO_PRODUCTIVE_EFFECT_OR_AUTHORITY_GRANT",
    ],
    hardGates: REQUIRED_HARD_GATES.map((name) => ({
      conclusion: "success",
      headSha: HEAD,
      name,
      source: "GITHUB_ACTIONS_PROVIDER_READBACK",
      treeSha: TREE,
    })),
    negativeProof: {
      caseIds: [...NEGATIVE_PROOF_CASES],
      command: "node --test tests/demo-current-head-e2e*.test.mjs",
      headSha: HEAD,
      outcome: "PASS",
      treeSha: TREE,
    },
    publicIssue: {
      deliveredCommit: HEAD,
      number: 377,
      observedAt: "2026-09-03T10:07:00.000Z",
      repository: "JoFe2/PANSPHAIRA",
      source: "ANONYMOUS_GITHUB_PROVIDER_READBACK",
      state: "CLOSED",
      stateReason: "COMPLETED",
    },
    queue: {
      activeOwnershipCount: 0,
      itemId: "AUDIT-CORRECTION-377",
      observedAt: "2026-09-03T10:08:00.000Z",
      owner: null,
      residualOwnership: [],
      source: "AUTHORITATIVE_QUEUE_READBACK",
      status: "DONE",
    },
    receipt: currentReceipt,
    releasedTree: { commitSha: HEAD, publishedAt: PUBLISHED, treeSha: TREE },
    schemaVersion: COMPLETION_SCHEMA,
  };
}

function assertReceiptDenied(mutator, reason) {
  const candidate = receipt();
  mutator(candidate);
  const result = validateSuccessReceipt(resign(candidate), expected());
  assert.equal(result.outcome, "DENY");
  assert.ok(result.reasonCodes.includes(reason), result.reasonCodes.join("\n"));
}

function assertCompletionDenied(mutator, reason) {
  const candidate = completion();
  mutator(candidate);
  const result = validateReleaseCompletion(candidate, expected());
  assert.equal(result.outcome, "DENY");
  assert.ok(result.reasonCodes.includes(reason), result.reasonCodes.join("\n"));
}

test("current-head receipt derives PASS from complete exact-head runtime evidence", () => {
  assert.deepEqual(validateSuccessReceipt(receipt(), expected()), { outcome: "PASS", reasonCodes: [] });
  assert.deepEqual(validateReleaseCompletion(completion(), expected()), { outcome: "PASS", reasonCodes: [] });
});

test("FAILED_HEALTH: an unhealthy service cannot pass after receipt re-digest", () => {
  assertReceiptDenied((candidate) => { candidate.serviceHealth[0].health = "unhealthy"; }, "RECEIPT_SERVICE_HEALTH_FAILED");
});

test("WRONG_FIXTURE: a substituted fixture cannot pass after receipt re-digest", () => {
  assertReceiptDenied((candidate) => { candidate.fixtures[3].sha256 = OTHER_DIGEST; }, "RECEIPT_FIXTURE_MISMATCH");
});

test("MISSING_READBACK: absent authoritative readback cannot pass", () => {
  assertReceiptDenied((candidate) => { delete candidate.authoritativeReadback; }, "RECEIPT_AUTHORITATIVE_READBACK_MISSING");
});

test("OWNED_RESIDUE: any owned container, volume, network or image denies success", () => {
  for (const kind of ["containers", "volumes", "networks", "images"]) {
    assertReceiptDenied((candidate) => { candidate.cleanup.ownedResourcesAfter[kind] = 1; }, "RECEIPT_OWNED_RESIDUE");
  }
});

test("RUNTIME_TIMEOUT: timeout or an over-budget duration cannot pass", async () => {
  assertReceiptDenied((candidate) => { candidate.execution.timedOut = true; }, "RECEIPT_TIMEOUT_OR_BUDGET_FAILED");
  assertReceiptDenied((candidate) => { candidate.execution.durationMs = E2E_TIMEOUT_SECONDS * 1_000 + 1; }, "RECEIPT_TIMEOUT_OR_BUDGET_FAILED");
  assertReceiptDenied((candidate) => { candidate.execution.startedAt = "2026-09-03T09:00:00.000Z"; }, "RECEIPT_TIMEOUT_OR_BUDGET_FAILED");
  const child = await runBoundedProcess(process.execPath, ["-e", "setInterval(() => {}, 1000)"], {
    cwd: process.cwd(),
    env: process.env,
    timeoutMs: 40,
  });
  assert.equal(child.timedOut, true);
  assert.equal(child.code === 0, false);
  assert.ok(child.durationMs < 2_000);
});

test("STALE_RECEIPT: an old or pre-release receipt cannot pass", () => {
  let result = validateSuccessReceipt(receipt(), expected({ nowMs: NOW + RECEIPT_MAX_AGE_MS + 1 }));
  assert.ok(result.reasonCodes.includes("RECEIPT_STALE"));
  result = validateReleaseCompletion(completion(), expected({ nowMs: NOW }));
  assert.equal(result.outcome, "PASS");
  const predated = completion(resign({
    ...receipt(),
    execution: { ...receipt().execution, completedAt: "2026-09-03T09:59:59.999Z" },
  }));
  result = validateReleaseCompletion(predated, expected());
  assert.ok(result.reasonCodes.includes("RECEIPT_PREDATES_RELEASED_TREE"));
});

test("STALE_HEAD: commit or tree substitution denies final completion", () => {
  let result = validateReleaseCompletion(completion(), expected({ commitSha: OTHER_HEAD }));
  assert.ok(result.reasonCodes.includes("COMPLETION_STALE_HEAD"));
  result = validateSuccessReceipt(receipt(), expected({ treeSha: OTHER_HEAD }));
  assert.ok(result.reasonCodes.includes("RECEIPT_STALE_TREE"));
});

test("CALLER_AUTHORED_PASS: caller status and caller artifact provenance are not evidence", () => {
  assertCompletionDenied((candidate) => { candidate.reportedStatus = "PASS"; }, "COMPLETION_SCHEMA_OVERCLAIM");
  assertCompletionDenied((candidate) => { candidate.artifactReadback.source = "CALLER_ASSERTION"; }, "COMPLETION_CALLER_AUTHORED_PASS_DENIED");
});

test("MISSING_NEGATIVE_PROOF: every fixed adversarial case is required", () => {
  assertCompletionDenied((candidate) => { candidate.negativeProof.caseIds.pop(); }, "COMPLETION_NEGATIVE_PROOF_MISSING");
});

test("FAILED_HARD_GATE: one missing, failed or stale hard gate denies completion", () => {
  assertCompletionDenied((candidate) => { candidate.hardGates[0].conclusion = "failure"; }, "COMPLETION_HARD_GATE_FAILED:demo-current-head-e2e");
  assertCompletionDenied((candidate) => { candidate.hardGates.pop(); }, "COMPLETION_HARD_GATE_SET_INVALID");
  assertCompletionDenied((candidate) => { candidate.hardGates[1].headSha = OTHER_HEAD; }, "COMPLETION_HARD_GATE_FAILED:release-governance-public-readback");
});

test("OVERCLAIM: unknown completion or receipt claims fail closed", () => {
  assertCompletionDenied((candidate) => { candidate.productionReady = true; }, "COMPLETION_SCHEMA_OVERCLAIM");
  assertReceiptDenied((candidate) => { candidate.claimBoundary.push("PRODUCTION_READY"); }, "RECEIPT_OVERCLAIM_DENIED");
});

test("ISSUE_NOT_PUBLIC_CLOSED: non-public, open or non-completed issue state denies completion", () => {
  assertCompletionDenied((candidate) => { candidate.publicIssue.state = "OPEN"; }, "COMPLETION_ISSUE_NOT_PUBLIC_CLOSED");
  assertCompletionDenied((candidate) => { candidate.publicIssue.source = "AUTHENTICATED_CALLER"; }, "COMPLETION_ISSUE_NOT_PUBLIC_CLOSED");
});

test("QUEUE_NOT_DONE: a non-terminal Queue readback denies completion", () => {
  assertCompletionDenied((candidate) => { candidate.queue.status = "PACKAGE_DONE"; }, "COMPLETION_QUEUE_NOT_DONE_OR_RESIDUAL_OWNERSHIP");
});

test("RESIDUAL_OWNERSHIP: owner, active count or residual record denies completion", () => {
  assertCompletionDenied((candidate) => { candidate.queue.owner = "worker"; }, "COMPLETION_QUEUE_NOT_DONE_OR_RESIDUAL_OWNERSHIP");
  assertCompletionDenied((candidate) => { candidate.queue.activeOwnershipCount = 1; }, "COMPLETION_QUEUE_NOT_DONE_OR_RESIDUAL_OWNERSHIP");
  assertCompletionDenied((candidate) => { candidate.queue.residualOwnership = ["worker"]; }, "COMPLETION_QUEUE_NOT_DONE_OR_RESIDUAL_OWNERSHIP");
});

test("digest mutation and non-data objects cannot manufacture a receipt", () => {
  const mutated = receipt();
  mutated.execution.scenario = "RAMPAGE_LAB_COLD";
  let result = validateSuccessReceipt(mutated, expected());
  assert.ok(result.reasonCodes.includes("RECEIPT_DIGEST_MISMATCH"));
  result = validateSuccessReceipt(Object.defineProperty({}, "schemaVersion", { get() { return RECEIPT_SCHEMA; } }), expected());
  assert.deepEqual(result, { outcome: "DENY", reasonCodes: ["RECEIPT_NON_DATA_JSON_DENIED"] });
  result = validateSuccessReceipt(receipt(), { ...expected(), nowMs: Number.NaN });
  assert.deepEqual(result, { outcome: "DENY", reasonCodes: ["RECEIPT_EXPECTATION_INVALID"] });
});

test("runtime image binding normalizes only the installer's immutable local reference", () => {
  const digest = `sha256:${"f".repeat(64)}`;
  assert.equal(immutableRuntimeImageDigest(digest), digest);
  assert.equal(immutableRuntimeImageDigest(`chimpmaera/v01-runtime@${digest}`), digest);
  assert.throws(() => immutableRuntimeImageDigest(`other/runtime@${digest}`), /RUNTIME_IMAGE_REFERENCE_INVALID/);
});

test("sanitizer removes generated credentials and private runner paths", () => {
  const tokenPrefix = ["gh", "p_"].join("");
  const secret = `${tokenPrefix}abcdefghijklmnopqrstuvwxyz1234567890`;
  const generatedPassword = ["hunt", "er2"].join("");
  const passwordLabel = ["pass", "word"].join("");
  const root = ["", "home", "runner", "work", "project", "source"].join("/");
  const temporaryPath = ["", "tmp", "work", "evidence.json"].join("/");
  const raw = `path=${root}/demo ${passwordLabel}=${generatedPassword} token=${secret}\n${temporaryPath}\n`;
  const sanitized = sanitizeArtifactText(raw, { forbiddenValues: [secret, generatedPassword], privateRoots: [root] });
  assert.equal(sanitized.includes(generatedPassword), false);
  assert.equal(sanitized.includes(tokenPrefix), false);
  assert.equal(sanitized.includes(root), false);
  assert.equal(sanitized.includes(temporaryPath), false);
  assert.deepEqual(artifactSafetyIssues(sanitized, { forbiddenValues: [secret, generatedPassword], privateRoots: [root] }), []);
});

test("scheduled/reusable workflow is exact-SHA, pinned, bounded, read-only and always purges", () => {
  const workflow = readFileSync(".github/workflows/demo-current-head-e2e.yml", "utf8");
  assert.match(workflow, /^  schedule:/m);
  assert.match(workflow, /^  workflow_call:/m);
  assert.doesNotMatch(workflow, /^  pull_request:/m);
  assert.match(workflow, /permissions:\n  contents: read/);
  assert.match(workflow, /timeout-minutes: 45/);
  assert.match(workflow, /--timeout-seconds 2100/);
  assert.match(workflow, /persist-credentials: false/);
  assert.match(workflow, /ref: \$\{\{ inputs\.target_sha != '' && inputs\.target_sha \|\| github\.sha \}\}/);
  assert.match(workflow, /test "\$\(git rev-parse HEAD\)" = "\$TARGET_SHA"/);
  assert.match(workflow, /CM_E2E_NAMESPACE: pansphaira-e2e-\$\{\{ github\.run_id \}\}-\$\{\{ github\.run_attempt \}\}/);
  assert.match(workflow, /if: always\(\)[\s\S]*demo-current-head-e2e\.mjs purge/);
  assert.match(workflow, /retention-days: 14/);
  assert.doesNotMatch(workflow, /contents: write|issues: write|pull-requests: write|secrets: inherit|docker (?:system|volume|network|container|image) prune/i);
  for (const line of workflow.split("\n").filter((candidate) => /^\s*-?\s*uses:/.test(candidate))) {
    assert.match(line, /@[a-f0-9]{40}(?:\s|$)/, line);
  }
});

test("release public readback cannot run until the exact-tree E2E reusable gate succeeds", () => {
  const workflow = readFileSync(".github/workflows/release-public-readback.yml", "utf8");
  assert.match(workflow, /current-head-docker-e2e:[\s\S]*uses: \.\/\.github\/workflows\/demo-current-head-e2e\.yml[\s\S]*target_sha: \$\{\{ github\.event\.release\.target_commitish \}\}/);
  assert.match(workflow, /needs: current-head-docker-e2e/);
  assert.ok(workflow.indexOf("current-head-docker-e2e:") < workflow.indexOf("needs: current-head-docker-e2e"));
});

test("installer and purge bind the optional E2E run owner without changing ordinary defaults", () => {
  const install = readFileSync("demo/install.sh", "utf8");
  const uninstall = readFileSync("demo/uninstall.sh", "utf8");
  assert.match(install, /run_owner="\$\{CM_DEMO_RUN_OWNER:-\}"/);
  assert.match(install, /CM_DEMO_RUN_OWNER must equal the Compose project/);
  assert.match(install, /\[ ! -f "\$config" \] \|\| \[ "\$existing_run_owner" = "\$run_owner" \]/);
  assert.match(install, /io\.chimpmaera\.demo\.run-owner=\$run_owner/);
  assert.match(install, /CM_DEMO_RUN_OWNER=\$run_owner/);
  assert.match(uninstall, /observed_run_owner/);
  assert.match(uninstall, /Refusing to remove runtime image without exact run ownership/);
});

test("all six #377 criteria map to executable evidence with no remainder", () => {
  const contract = JSON.parse(readFileSync("verification/demo-current-head-e2e/contract-v1.json", "utf8"));
  assert.deepEqual(contract.acceptance.map(({ id }) => id), Array.from({ length: 6 }, (_, index) =>
    `AUDIT-CORRECTION-377-AC${String(index + 1).padStart(2, "0")}`));
  assert.equal(contract.acceptance.every(({ executableProof }) => executableProof.length > 0), true);
  assert.deepEqual(contract.negativeProofCaseIds, NEGATIVE_PROOF_CASES);
  assert.equal(contract.implementationState, "EXECUTABLE_CONTRACT_COMPLETE_PENDING_EXACT_HEAD_HOST_DOCKER_RECEIPT");
  assert.equal(contract.completionBoundary.externalMutationAuthority, false);
});

test("release governance carries one fail-closed current-head E2E closure policy", () => {
  const governance = JSON.parse(readFileSync("release/governance.json", "utf8"));
  assert.deepEqual(governance.currentHeadDockerE2E, {
    schemaVersion: "pansphaira.release/current-head-docker-e2e/v1",
    workflowPath: WORKFLOW_PATH,
    contractPath: "verification/demo-current-head-e2e/contract-v1.json",
    validatorCommand: "node scripts/demo-current-head-e2e.mjs verify-completion --envelope <provider-readback-envelope> --target-sha <release-sha> --target-tree <release-tree> --now-ms <epoch-ms>",
    receiptSchemaVersion: RECEIPT_SCHEMA,
    completionSchemaVersion: COMPLETION_SCHEMA,
    maximumReceiptAgeHours: 168,
    releaseReadbackRequiresE2E: true,
    ordinaryPullRequestDockerRunRequired: false,
    requiredHardGates: REQUIRED_HARD_GATES,
    requiredNegativeProofCaseIds: NEGATIVE_PROOF_CASES,
    terminalIssueState: "CLOSED_COMPLETED_PUBLIC_PROVIDER_READBACK",
    terminalQueueState: "DONE_UNOWNED_ZERO_RESIDUAL_OWNERSHIP",
  });
});
