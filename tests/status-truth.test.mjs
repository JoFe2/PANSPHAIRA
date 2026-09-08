import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  STATUS_TRUTH_MANIFEST_SCHEMA,
  STATUS_TRUTH_PROVIDER_SCHEMA,
  canonicalJson,
  generateStatusTruth,
  renderStatusTruth,
  sha256,
  validateStatusTruth,
} from "../scripts/generate-status-truth.mjs";

const HEAD = "a".repeat(40);
const TREE = "b".repeat(40);
const RETRIEVED_AT = "2026-09-08T10:00:00.000Z";
const SOURCE_URL = "https://api.github.com/repos/JoFe2/PANSPHAIRA/issues?per_page=1&page=1";

function baseManifest(overrides = {}) {
  return {
    schemaVersion: STATUS_TRUTH_MANIFEST_SCHEMA,
    repository: "JoFe2/PANSPHAIRA",
    issues: [{
      number: 380,
      title: "[STATUS-TRUTH-01] Generate a canonical live status and roadmap snapshot",
      expectedHeadSha: HEAD,
      requiredRelease: true,
      requiredPublicReadback: true,
      ...overrides.issue,
    }],
    releases: [{ tag: "pan380-source-v1" }],
    roadmap: [{ id: "roadmap-status-truth", url: "https://github.com/JoFe2/PANSPHAIRA/issues/380" }],
    epics: [{ id: "epic-390", url: "https://github.com/JoFe2/PANSPHAIRA/issues/390", children: [{ number: 380, expectedState: "CLOSED" }] }],
    ...overrides,
  };
}

function positiveRow(overrides = {}) {
  return {
    number: 380,
    title: "[STATUS-TRUTH-01] Generate a canonical live status and roadmap snapshot",
    state: "CLOSED",
    labels: ["status:closed", "maturity:delivered"],
    body: "## Problem\nHistorical acceptance text remains unchanged.\n",
    checklist: { completed: 6, total: 6 },
    maturity: "delivered",
    pullRequest: { state: "closed", merged: true, mergeSha: HEAD },
    delivery: {
      codePresent: true,
      focusedTestsPassed: true,
      runtimeObserved: true,
      merged: true,
      released: true,
      requiredPublicReadback: true,
      queueDone: true,
      queueStatus: "DONE",
      releaseTag: "pan380-source-v1",
      headSha: HEAD,
      requiredGates: [
        { name: "repository-tests", conclusion: "success", headSha: HEAD, treeSha: TREE, source: "GITHUB_ACTIONS_PROVIDER_READBACK" },
      ],
    },
    ...overrides,
  };
}

function positiveInput(overrides = {}) {
  const body = positiveRow().body;
  const release = {
    tag: "pan380-source-v1",
    body,
    bodySha256: sha256(body),
    historicalBodySha256: sha256(body),
    publishedAt: RETRIEVED_AT,
    published: true,
    readbackVerified: true,
    sourceUrl: "https://github.com/JoFe2/PANSPHAIRA/releases/tag/pan380-source-v1",
  };
  const row = positiveRow(overrides.row);
  const rows = overrides.rows ?? [row];
  return {
    manifest: baseManifest(overrides.manifest),
    providerReadback: {
      schemaVersion: STATUS_TRUTH_PROVIDER_SCHEMA,
      repository: "JoFe2/PANSPHAIRA",
      retrieval: { retrievedAt: RETRIEVED_AT, sourceUrls: [SOURCE_URL] },
      apiTotal: 1,
      pages: [
        { page: 1, url: SOURCE_URL, total: 1, items: rows, nextPage: null },
      ],
      releases: overrides.releases ?? [release],
      latest: { tag: "pan380-source-v1", bodySha256: sha256(body) },
    },
    ...overrides.input,
  };
}

function denied(input, code) {
  const result = generateStatusTruth(input);
  assert.equal(result.outcome, "DENIED");
  assert.ok(result.reasonCodes.includes(code), `${code}: ${JSON.stringify(result.reasonCodes)}`);
  return result;
}

test("STATUS-TRUTH-AC01 binds the explicit allowlist, retrieval time, URLs, and exact state digests", () => {
  const result = generateStatusTruth(positiveInput());
  assert.equal(result.outcome, "PASS");
  assert.equal(result.source, "pan380-canonical-status-truth-source-v1");
  assert.equal(result.retrieval.retrievedAt, RETRIEVED_AT);
  assert.deepEqual(result.retrieval.sourceUrls, [SOURCE_URL]);
  assert.match(result.retrieval.manifestDigest, /^[a-f0-9]{64}$/);
  assert.match(result.retrieval.providerReadbackDigest, /^[a-f0-9]{64}$/);
  assert.match(result.items[0].stateDigest, /^[a-f0-9]{64}$/);
});

test("STATUS-TRUTH-AC02 distinguishes issue, checklist, labels, merge, release, and maturity", () => {
  const result = generateStatusTruth(positiveInput());
  const item = result.items[0];
  assert.equal(item.state, "CLOSED");
  assert.deepEqual(item.checklist, { completed: 6, total: 6 });
  assert.deepEqual(item.labels, ["maturity:delivered", "status:closed"]);
  assert.equal(item.pullRequest.merged, true);
  assert.equal(item.release.tag, "pan380-source-v1");
  assert.equal(item.maturity, "delivered");
});

test("STATUS-TRUTH-AC03 emits roadmap and epic projections linked to generated current state", () => {
  const result = generateStatusTruth(positiveInput());
  assert.equal(result.views.roadmap[0].generatedState, "status-truth.json");
  assert.equal(result.views.epics[0].generatedState, "status-truth.json");
  assert.equal(result.views.epics[0].children[0].expectedState, "CLOSED");
});

test("STATUS-TRUTH-AC04 fails material contradictions instead of projecting closure", () => {
  denied(positiveInput({ row: { state: "OPEN", labels: ["status:open"] } }), "OPEN_ACCEPTANCE_COMPLETE:380");
  denied(positiveInput({ row: { labels: ["status:open"] } }), "LABEL_STATE_DISAGREEMENT:380");
  denied(positiveInput({ manifest: { issue: { requiredRelease: true } }, releases: [] }), "REQUIRED_RELEASE_MISSING:pan380-source-v1");
  denied(positiveInput({ row: { delivery: { ...positiveRow().delivery, requiredGates: [{ name: "repository-tests", conclusion: "failure", headSha: HEAD, treeSha: TREE, source: "GITHUB_ACTIONS_PROVIDER_READBACK" }] } } }), "REQUIRED_GATE_RED:380:repository-tests");
  denied(positiveInput({ row: { delivery: { ...positiveRow().delivery, requiredGates: [{ name: "repository-tests", conclusion: "success", headSha: "c".repeat(40), treeSha: TREE, source: "GITHUB_ACTIONS_PROVIDER_READBACK" }] } } }), "REQUIRED_GATE_WRONG_HEAD:380:repository-tests");
  denied(positiveInput({ manifest: { epics: [{ number: 390, children: [{ number: 380, expectedState: "OPEN" }] }] } }), "STALE_CHILD_CHECKLIST:390:380");
});

test("STATUS-TRUTH-AC05 preserves historical bodies and treats provider state as authoritative", () => {
  const result = generateStatusTruth(positiveInput());
  assert.equal(result.items[0].historicalEvidence.body, positiveRow().body);
  assert.equal(result.items[0].historicalEvidence.immutable, true);
  const mutated = positiveInput({ releases: [{ ...positiveInput().providerReadback.releases[0], bodySha256: sha256("mutated release body") }] });
  denied(mutated, "RELEASE_BODY_DIGEST_MISMATCH:pan380-source-v1");
  const historicalMutation = positiveInput({ releases: [{ ...positiveInput().providerReadback.releases[0], historicalBodySha256: sha256("old historical body") }] });
  denied(historicalMutation, "HISTORICAL_RELEASE_BODY_MUTATED:pan380-source-v1");
});

test("STATUS-TRUTH-AC06 is deterministic offline and fails incomplete, duplicate, or denominator-drifting readback", () => {
  const input = positiveInput();
  const first = generateStatusTruth(input);
  const second = generateStatusTruth(structuredClone(input));
  assert.equal(renderStatusTruth(first), renderStatusTruth(second));

  const paginated = positiveInput();
  paginated.providerReadback.pages = [
    { page: 1, url: SOURCE_URL, total: 1, items: [positiveRow()], nextPage: 2 },
    { page: 2, url: `${SOURCE_URL}&page=2`, total: 1, items: [positiveRow()], nextPage: null },
  ];
  assert.equal(generateStatusTruth(paginated).outcome, "PASS");
  denied({ ...paginated, providerReadback: { ...paginated.providerReadback, apiTotal: 2 } }, "PROVIDER_DENOMINATOR_DISAGREEMENT");
  denied({ ...paginated, providerReadback: { ...paginated.providerReadback, pages: [{ ...paginated.providerReadback.pages[0], items: [{ ...positiveRow(), state: "OPEN" }] }, paginated.providerReadback.pages[1]] } }, "PROVIDER_DUPLICATE_CONTRADICTION:380");
  denied({ ...input, providerReadback: { ...input.providerReadback, pages: [{ ...input.providerReadback.pages[0], items: [] }] } }, "PROVIDER_ROW_MISSING:380");
});

test("owner comment states remain distinct and red, missing, stale, or wrong-head gates cannot become closure-verified/DONE", () => {
  const result = generateStatusTruth(positiveInput());
  assert.deepEqual(result.ownerStates, {
    codePresent: true,
    focusedTestsPassed: true,
    runtimeObserved: true,
    merged: true,
    released: true,
    requiredPublicReadback: true,
    issuePubliclyClosed: true,
    queueDone: true,
  });
  assert.equal(result.closureVerified, true);
  assert.equal(result.queueState, "DONE");
  const red = positiveInput({ row: { delivery: { ...positiveRow().delivery, queueDone: false, queueStatus: "BLOCKED" } } });
  const deniedResult = generateStatusTruth(red);
  assert.equal(deniedResult.closureVerified, false);
  assert.equal(deniedResult.queueState, "BLOCKED");
  assert.equal(deniedResult.items[0].states.queueDone, false);
});

test("canonical registration names this focused suite exactly once and keeps the generator public", () => {
  const packageJson = JSON.parse(readFileSync("package.json", "utf8"));
  const command = packageJson.scripts["status-truth:test"];
  assert.equal(command, "npm run build --silent && node --test tests/status-truth.test.mjs");
  assert.equal(packageJson.scripts.test.split("tests/status-truth.test.mjs").length - 1, 1);
  assert.equal(readFileSync("scripts/generate-status-truth.mjs", "utf8").includes("pan380-canonical-status-truth-source-v1"), true);
  assert.equal(readFileSync("release/public-files.manifest", "utf8").split("\n").filter((line) => line.startsWith("scripts/generate-status-truth.mjs\t")).length, 1);
  assert.equal(canonicalJson({ b: 2, a: 1 }), '{"a":1,"b":2}');
  assert.equal(createHash("sha256").update(canonicalJson({ a: 1, b: 2 })).digest("hex"), sha256({ a: 1, b: 2 }));
  assert.deepEqual(validateStatusTruth(positiveInput()).outcome, "PASS");
});
