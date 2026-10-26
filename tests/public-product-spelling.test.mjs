import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import test from "node:test";
import { createHash } from "node:crypto";

const ROOT = new URL("../", import.meta.url);
const legacyDisplay = ["PANS", "PHAIRA"].join("");
const formerOwner = ["Jim", "Pansky"].join("");
const formerPagesOwner = ["jim", "pansky"].join("");

function read(path) {
  return readFileSync(new URL(path, ROOT), "utf8");
}

// These three published selectors were consumed at immutable hashes.
// Preserve their historical provenance, not arbitrary current display text.
function classifyImmutableOriginDevelopmentSelector(path, line, digest) {
  const selectors = {
    "contracts/hosted-origin-session/candidates/origin-session-development-v1.json": { sha256: "3a6d8eb1e9eb3e494bcc2ef15da0581d84b428f431b17b77bc27952c453ce200", line: `"sharedOwner": "${legacyDisplay} origin/session contract; counterpart keeps its existing product implementation owner",` },
    "contracts/hosted-origin-session/candidates/origin-session-development-v2.json": { sha256: "e2cb349cc3cd962860fd8c27863bf7665131fef58a9a49deb240a34e0a34d605", line: `"sharedOwner": "${legacyDisplay} common origin/session contracts; existing KS owner retains native product implementation",` },
    "contracts/hosted-origin-session/candidates/origin-session-development-v3.json": { sha256: "cd87f1a1a5942bea20ac19cc8b08d5e32861c1e2499b9895b9d759fb4ba7b20b", line: `"sharedOwner": "${legacyDisplay} common origin/session contracts; existing KS owner retains native product implementation",` },
  };
  if (!Object.hasOwn(selectors, path)) return null;
  const wanted = selectors[path];
  return digest === wanted.sha256 && line.trim() === wanted.line
    ? "exact-digest-immutable-origin-development-selector" : null;
}

function classifyImmutableRuntimeBudgetDevelopmentProfile(path, line, digest) {
  return path === "contracts/runtime-budget/candidates/runtime-budget-development-v1.json"
    && digest === "4f8ed30d2446639fa4f3b28589a8c9ef362ca8b1083f702fabcc40d22b887255"
    && line.trim() === `"profile": "${legacyDisplay}_OWNER_NATIVE_STORE_ONLY",`
    ? "exact-digest-immutable-runtime-budget-development-profile" : null;
}

// Closed internal stylesheet partition, not current product display text.
// Bind the exact existing path, complete file digest and technical line; no wildcard.
const closedWorkspaceAppearanceStyleBindings = Object.freeze({
  "tests/pan546/browser-human-combined.test.mjs": Object.freeze({ sha256: "3b58ad3c613f51320bb2f19069f2bc9513383c5983e0bd4c21cd63b44edf20dd", lines: Object.freeze(["const source=readFileSync('packages/browser-workspace/src/workspace.css','utf8'),parts=source.split(\"/*__" + legacyDisplay + "_CLOSED_WORKSPACE_APPEARANCE_V1_STYLES__*/\"+String.fromCharCode(10));assert.equal(parts.length,2);"]) }),
  "packages/browser-workspace/src/workspace.css": Object.freeze({ sha256: "ae4658e691ac2e9bc9affd46270cacb1d9129d62d18e2e9fd2631c2398b936e9", lines: Object.freeze(["/*__" + legacyDisplay + "_CLOSED_WORKSPACE_APPEARANCE_V1_STYLES__*/"]) }),
  "src/pan541/workspace-browser.mjs": Object.freeze({ sha256: "3e986032be9ba8592ac878470ae7da62e217fd5248f3d067a94ffea7a669e651", lines: Object.freeze(["const appearanceStyleBoundaryV1=\"/*__" + legacyDisplay + "_CLOSED_WORKSPACE_APPEARANCE_V1_STYLES__*/\\n\";"]) }),
  "tests/pan541/browser-context-safety.test.mjs": Object.freeze({ sha256: "f27e6bb0a0af24906ab442be639591e0978cad81a49710d6ffbbb818c458df97", lines: Object.freeze(["style: readFileSync(new URL(\"../../packages/browser-workspace/src/workspace.css\", import.meta.url), \"utf8\").split(\"/*__" + legacyDisplay + "_CLOSED_WORKSPACE_APPEARANCE_V1_STYLES__*/\\n\")[0],"]) }),
});

function classifyClosedWorkspaceAppearanceStyleBoundary(path, line, digest) {
  if (!Object.hasOwn(closedWorkspaceAppearanceStyleBindings, path)) return null;
  const binding = closedWorkspaceAppearanceStyleBindings[path];
  return digest === binding.sha256 && binding.lines.includes(line.trim())
    ? "exact-digest-closed-workspace-style-boundary" : null;
}

function classify(path, line) {
  const closedStyleClassification = classifyClosedWorkspaceAppearanceStyleBoundary(path, line,
    Object.hasOwn(closedWorkspaceAppearanceStyleBindings, path)
      ? createHash("sha256").update(read(path)).digest("hex") : null);
  if (closedStyleClassification !== null) return closedStyleClassification;
  const immutableBudgetClassification = classifyImmutableRuntimeBudgetDevelopmentProfile(path, line,
    path === "contracts/runtime-budget/candidates/runtime-budget-development-v1.json"
      ? createHash("sha256").update(read(path)).digest("hex") : null);
  if (immutableBudgetClassification !== null) return immutableBudgetClassification;
  const immutableOriginClassification = classifyImmutableOriginDevelopmentSelector(path, line,
    path === "contracts/hosted-origin-session/candidates/origin-session-development-v1.json"
      || path === "contracts/hosted-origin-session/candidates/origin-session-development-v2.json"
      || path === "contracts/hosted-origin-session/candidates/origin-session-development-v3.json"
      ? createHash("sha256").update(read(path)).digest("hex") : null);
  if (immutableOriginClassification !== null) return immutableOriginClassification;
  const providerReceiptPins = {
    "verification/paired-analytics-provider-evidence-v1/main/forward-paired-execution.json": "84f866d836a193cd97514407822fbdbc10711df62e2ab82f4abdfff8047924b3",
    "verification/paired-analytics-provider-evidence-v1/pr429-final/forward-paired-execution.json": "9907d6bf46ee087a5894417a622e1e57a0ad0c18d31a01ab6d15f1b6e5b1eca7",
  };
  if (Object.hasOwn(providerReceiptPins, path)
      && createHash("sha256").update(read(path)).digest("hex") === providerReceiptPins[path]
      && (line.trim().startsWith('"counterpart": ')
        || line.trim() === `"No generic ${legacyDisplay} domain in KaleidoSphere: the analysis is confined to the one closed native nodes/edges projection v1 shape.",`)) {
    return "exact-digest-provider-capture-and-test-output";
  }
  if (
    path === "tests/fixtures/pan346/ks-native-response-994ac80.json"
    || path === "tests/fixtures/pan346/ks-native-response-72d9a4af.json"
  ) {
    const currentNativeCaptureDigests = {
      "tests/fixtures/pan346/ks-native-response-994ac80.json": "c6d13beed946a3ebb1ab4a08fa7b9615b9cc24996cbf1a0feb12883d3b8d4ead",
      "tests/fixtures/pan346/ks-native-response-72d9a4af.json": "5eaf859903e1e8c256c69389d7ebfe97df4f883f939dd9f6d824a67c9e667a8a",
    };
    if (createHash("sha256").update(read(path)).digest("hex") === currentNativeCaptureDigests[path]
        && line.trim() === `"No generic ${legacyDisplay} domain in KaleidoSphere: the analysis is confined to the one closed native nodes/edges projection v1 shape.",`) return "exact-digest-current-native-service-capture";
  }
  if (
    (path === "tests/fixtures/cks-analytics/native-forward-current-candidate-v1.json"
      || path === "tests/fixtures/cks-analytics/native-forward-pr235-candidate-v1.json")
    && line.trim() === `"No generic ${legacyDisplay} domain in KaleidoSphere: the analysis is confined to the one closed native nodes/edges projection v1 shape.",`
  ) return "byte-preserved-native-service-capture";
  if (
    path === "tests/fixtures/cks-analytics/native-v2-historical-source.json"
    && line.trim().startsWith('"sourceUtf8": ')
  ) return "digest-bound-historical-adjudicator-source";
  if (
    (path === "contracts/analytics/paired-expectation-v1.json"
      || path === "verification/paired-analytics-compatibility-v1.json")
    && line.trim() === `"issue": "${legacyDisplay}#345",`
  ) return "stable-par-xr01-source-issue-identifier";
  // One byte-preserved public research handoff, not the current product display.
  if (path === "evidence/erv-workflow/reference-v1/README.de.md"
    && createHash("sha256").update(read(path)).digest("hex") === "826b69e42bd04329a4fcadf3f02f5d38b937d76adc8d52adf74b0c785e8e0d13"
    && line.trim() === `Dieses Paket verbindet öffentlich recherchierte Benutzerarbeit mit tatsächlich ausgeführten, synthetischen Prüfungen der vorhandenen ${legacyDisplay}-Eingangsrechnungsverarbeitung. Es ist kein neues Rechnungsfreigabeprogramm und keine Produktionsfreigabe.`)
    return "exact-digest-public-research-handoff-provenance";
  // Preserve only the immutable verbatim original issue criterion, not active branding.
  if (path === "verification/pan396-original-s3-sqs-evidence-v1.json"
    && createHash("sha256").update(read(path)).digest("hex") === "cb8fda6a864c0a77c8e79b819b317801c66901d4b5ec7ff4cb4c9e8cf3877a68"
    && line.trim() === String.raw`"originalText": "Route synthetic invoice bytes through controlled S3 Put \u2192 SQS event \u2192 typed ${legacyDisplay} adapter/broker \u2192 existing authority-free ERV core.",`)
    return "exact-digest-original396-source-criterion";
  if (path.startsWith("closure-audits/")) return "closure-audit-provenance";
  if (path.startsWith("docs/evidence/conveyor/")) return "internal-conveyor-evidence";
  if (line.includes("PANSPHAIRA_CANONICAL_JSON_SHA256_V1")) return "stable-algorithm-identifier";
  if (
    path.startsWith("archive/")
    || path.startsWith("docs/development/")
    || path.startsWith("examples/daily-poc/")
    || path.startsWith("tests/fixtures/daily-poc/")
  ) return "historical-evidence";

  if (path === "packages/dev-worker/src/controller.ts") return "technical-repository-identifier";
  if (
    path === "docs/architecture/cks-10-analytics-bridge-decision-v1.md"
    || path.startsWith("verification/cks-10-")
  ) return "stable-cks10-authority-identifier";
  if (path.startsWith("tests/cks-12/")) return "stable-cks12-technical-identifier";
  if (path.startsWith("docs/architecture/rks-01")) return "stable-rks01-technical-identifier";
  if (
    path === "packages/contracts/src/kaleidosphere-analytics-projection.ts"
    || path === "tests/cks-analytics-projection-profile.test.ts"
    || path === "tests/fixtures/cks-analytics/projection-v1.json"
  ) return "stable-xra-ps01-purpose-identifier";
  if (
    path === "src/cks-12/kaleidosphere-candidate-quarantine.ts"
    || path === "scripts/run-xra-ps-02-root-qs-replay.mjs"
    || path === "verification/pansphaira-kaleidosphere-analytics-slice-v1.json"
    || path === "verification/pansphaira-kaleidosphere-analytics-slice-v2.json"
    || path === "tests/fixtures/cks-analytics/xra-ps-02-native-service-capture-v1.json"
    || path === "tests/fixtures/cks-analytics/xra-ps-02-native-service-substitution-capture-v1.json"
    || path === "tests/fixtures/cks-analytics/xra-ps-02-native-root-qs-raw-v2.json"
  ) return "stable-xra-ps02-technical-identifier";
  if (
    path === "contracts/analytics/producer-manifest-v1.json"
    || path === "src/analytics/producer-analytics-manifest.ts"
    || path === "tests/producer-analytics-manifest.test.ts"
    || path === "scripts/build-producer-analytics-manifest.mjs"
  ) return "stable-par-ps01-technical-identifier";
  if (
    path === "WORK_RESULT.md"
    && (line.includes(`${legacyDisplay}_RECONCILED_RELEASED_HEAD_V1`)
      || line.includes(`${legacyDisplay}_INDEPENDENT_ADJUDICATION`))
  ) return "quoted-stable-technical-identifier";
  if (path === "demo/manifests/network/local-egress-policy-v1.json") return "technical-fixture-identifier";
  // The extractor has to recognize the byte-frozen fixture's display prefix.
  // Permit only this exact fixture-bound constant, never arbitrary new branding.
  if (path === "packages/contracts/src/incoming-invoice-extraction-dataflow-v2.ts"
    && line.trim() === `export const AP02_BOUNDED_EXTRACTION_LINE_PREFIX_V1 = "${legacyDisplay} SYNTHETIC SUPPLIER INVOICE" as const;`)
    return "frozen-synthetic-fixture-display";
  if (path === "tests/fixtures/incoming-invoice/supplier-invoice-v1.txt") return "frozen-synthetic-fixture-display";
  // Exact original360 structured-text fixtures reuse the retained extractor's
  // mandatory technical header. Pin bytes and this line; no branding wildcard.
  const original360FixturePins = {
    "tests/fixtures/pan360/invoice-high-v1.txt": "ee79735415e55e2fcc92c1e67e73f879f2daa5bbe2fbf9c5182adae3f180c830",
    "tests/fixtures/pan360/invoice-below-v1.txt": "749e673a1c4916083fe0d44f85ab666616a88e3e6b5b63ce0446dd461366b02f",
    "tests/fixtures/pan360/invoice-equal-v1.txt": "3cb39f293157f8bf008efd8014c0e24050a498989d7c75152d23a095bae81af5",
    "tests/fixtures/pan360/invoice-above-v1.txt": "30ab519f817f63353151acb11a5ff9d36de2278ea96fc93f5a4c8bda39265017",
  };
  if (Object.hasOwn(original360FixturePins, path)
    && createHash("sha256").update(read(path)).digest("hex") === original360FixturePins[path]
    && line === `${legacyDisplay} SYNTHETIC SUPPLIER INVOICE V1`) return "exact-digest-synthetic-extractor-header";
  if (path.startsWith("schemas/")) return "stable-schema";
  if (path === "release/governance.json") {
    if (line.includes(`JoFe2/${legacyDisplay}`)) return "repository-slug";
    return "historical-release-governance";
  }
  if (line.includes(`${legacyDisplay}-TERMINOLOGY.md`)) return "stable-filename";
  if (line.includes(`cd ${legacyDisplay}`)) return "repository-directory";
  if (path === "docs/PANSPHAIRA-TERMINOLOGY.md" && line.includes("PAN-08-")) return "quoted-historical-fact";
  if (path === "docs/RELEASE-GOVERNANCE.md" && line.includes("v0.2.0-poc.20260818.2")) return "quoted-historical-release";
  if (
    line.includes(`JoFe2/${legacyDisplay}`)
    || line.includes(`JoFe2\\/${legacyDisplay}`)
    || line.includes(`github.io/${legacyDisplay}`)
    || line.includes(`/${legacyDisplay}/`)
    || line.includes(`\\/${legacyDisplay}\\/`)
  ) return "repository-slug-or-working-url";
  return null;
}

function classifyFormerOwner(path, line) {
  if (path.startsWith("closure-audits/")) return "closure-audit-provenance";
  if (path === ".github/FUNDING.yml") return "keep-sponsorship-handle";
  if (path === "README.md" && line.includes("buymeacoffee.com")) return "keep-sponsorship-handle";
  if (
    path.startsWith("archive/")
    || path.startsWith("docs/development/")
    || path.startsWith("examples/daily-poc/")
  ) return "historical-evidence";
  if (
    path === "packages/dev-worker/src/controller.ts"
    && (line.includes("PrivateDenied") || line.includes("OtherRepo"))
  ) return "keep-negative-fixture-identity";
  if (
    path === "tests/external-video-service.test.ts"
    && line.includes("chimpmaera-video-reference-2026.08.02-v2.tar.gz")
  ) return "historical-release-asset-fixture";
  return null;
}

test("current public product display is PanSphaira while stable contracts remain unchanged", () => {
  assert.match(read("README.md"), /^# PanSphaira$/m);
  assert.doesNotMatch(read("README.md"), new RegExp(`^# ${legacyDisplay}$`, "m"));
  assert.match(read("docs/PANSPHAIRA-TERMINOLOGY.md"), /\*\*PanSphaira\*\* is the official product name/);
  assert.match(read("docs/.vitepress/config.mts"), /title: "PanSphaira"/);
  assert.match(read("docs/.vitepress/config.mts"), /base: "\/PANSPHAIRA\/"/);
  assert.match(read("CITATION.cff"), /title: "PanSphaira"/);
  assert.match(read("scripts/daily-poc.mjs"), /heading !== "PanSphaira"/);
  assert.match(read("packages/dev-worker/src/controller.ts"), new RegExp(`JoFe2/${legacyDisplay}`));
});

test("public release surfaces preserve source/latest/runnable identity boundaries", () => {
  const governance = JSON.parse(read("release/governance.json"));
  const quickstart = read("docs/QUICKSTART.md");
  const releaseDocs = read("docs/RELEASE-GOVERNANCE.md");
  const readme = read("README.md");
  const hub = read("docs/README.md");
  const index = read("docs/index.md");

  assert.equal(governance.publicLatestRelease.tag, "2026_09_02_v7");
  assert.equal(governance.publicLatestRelease.releaseClass, "SOURCE_EVIDENCE_ONLY");
  assert.equal(governance.publicLatestRelease.assets.length, 0);
  assert.equal(governance.currentRelease.tag, "v0.2.0-poc.20260825.1");
  assert.equal(governance.currentRelease.releaseClass, "REGULAR_RUNNABLE_ARTIFACT");
  assert.equal(governance.currentRelease.mustBeLatest, false);

  for (const surface of [quickstart, releaseDocs]) {
    assert.match(surface, /2026_09_02_v7/);
    assert.match(surface, /v0\.2\.0-poc\.20260825\.1/);
  }
  assert.doesNotMatch(readme, /2026_09_02_v7|v0\.2\.0-poc\.20260825\.1/);
  assert.equal(createHash("sha256").update(readme).digest("hex"), "1fcfc47ccd089ddf3ef8e1d3083637fa92f2aa8ad756cf42e8f318c9bcfb8a00");
  assert.match(readme, /Source, runnable packaging and execution evidence are different identities/);
  assert.match(readme, /Latest label is not itself a promise of an installable archive/);
  assert.match(hub, /source, runnable artifacts and execution evidence must not be conflated/);
  assert.match(index, /bounded proofs[\s\S]*development direction/);
  assert.match(index, /\]\(capabilities\.md\)/);
  assert.match(index, /\]\(SECURITY-ASSURANCE\.md\)/);
});

test("PAN396 original criterion has only exact-digest exact-line provenance admission", () => {
  const path = "verification/pan396-original-s3-sqs-evidence-v1.json";
  const line = read(path).split("\n").find((value) => value.includes(`typed ${legacyDisplay} adapter/broker`));
  assert.ok(line, "the original criterion must remain present without spelling normalization");
  assert.equal(classify(path, line), "exact-digest-original396-source-criterion");
  assert.equal(classify(path, line.replace("typed ", "unadmitted ")), null);
  assert.equal(classify("verification/pan396-unadmitted-neighbor.json", line), null);
  assert.equal(classify("tests/pan396-unadmitted-neighbor.mjs", line), null);
  assert.equal(classify("docs/architecture/pan396-original-s3-sqs-lab-v1.md", `not ${legacyDisplay} runtime`), null);
});

test("immutable origin-development selectors have exact-path digest and exact-line provenance only", () => {
  assert.equal(typeof classifyImmutableOriginDevelopmentSelector, "function");
  const paths = [1, 2, 3].map((version) => `contracts/hosted-origin-session/candidates/origin-session-development-v${version}.json`);
  for (const path of paths) {
    const digest = createHash("sha256").update(read(path)).digest("hex");
    const line = read(path).split("\n").find((value) => value.trim().startsWith('"sharedOwner": '));
    assert.ok(line);
    assert.equal(classifyImmutableOriginDevelopmentSelector(path, line, digest), "exact-digest-immutable-origin-development-selector");
    assert.equal(classify(path, line), "exact-digest-immutable-origin-development-selector");
    assert.equal(classifyImmutableOriginDevelopmentSelector(path, line, "0".repeat(64)), null);
    const tamperedWholeFileDigest = createHash("sha256").update(read(path) + "\n").digest("hex");
    assert.equal(classifyImmutableOriginDevelopmentSelector(path, line, tamperedWholeFileDigest), null);
    assert.equal(classifyImmutableOriginDevelopmentSelector(path, line.replace("contract", "unadmitted contract"), digest), null);
    assert.equal(classifyImmutableOriginDevelopmentSelector(path.replace("development-v", "unadmitted-v"), line, digest), null);
    assert.equal(classifyImmutableOriginDevelopmentSelector(path, `"unexpected": "${legacyDisplay}",`, digest), null);
  }
  assert.equal(classifyImmutableOriginDevelopmentSelector("toString", `"sharedOwner": "${legacyDisplay}",`, "0".repeat(64)), null);
  assert.equal(classify("docs/architecture/pan527-hosted-origin-session-v1.md", `new ${legacyDisplay} display`), null);
});

test("immutable H05 native-store profile admission is exact-path digest and line only", () => {
  const path = "contracts/runtime-budget/candidates/runtime-budget-development-v1.json";
  const bytes = read(path);
  const digest = createHash("sha256").update(bytes).digest("hex");
  const line = bytes.split("\n").find((line) => line.includes('"profile"') && line.includes("_OWNER_NATIVE_STORE_ONLY"));
  assert.ok(line);
  assert.equal(classify(path, line), "exact-digest-immutable-runtime-budget-development-profile");
  assert.equal(classifyImmutableRuntimeBudgetDevelopmentProfile(path, line, digest), "exact-digest-immutable-runtime-budget-development-profile");
  assert.equal(classifyImmutableRuntimeBudgetDevelopmentProfile(path, line, "0".repeat(64)), null);
  assert.equal(classifyImmutableRuntimeBudgetDevelopmentProfile(path, line, createHash("sha256").update(bytes + "\n").digest("hex")), null);
  assert.equal(classifyImmutableRuntimeBudgetDevelopmentProfile(path, line.replace("STORE_ONLY", "EXECUTION_ALLOWED"), digest), null);
  assert.equal(classifyImmutableRuntimeBudgetDevelopmentProfile(path.replace("development-v1", "development-v2"), line, digest), null);
  assert.equal(classifyImmutableRuntimeBudgetDevelopmentProfile(path, `"unexpected": "${legacyDisplay}",`, digest), null);
  assert.equal(classifyImmutableRuntimeBudgetDevelopmentProfile("toString", line, digest), null);
  assert.equal(classify("docs/architecture/pan529-runtime-budget-v1.md", `new ${legacyDisplay} display`), null);
});

test("closed workspace stylesheet marker admission binds path, whole bytes and exact technical line", () => {
  for (const [path, binding] of Object.entries(closedWorkspaceAppearanceStyleBindings)) {
    const bytes = read(path);
    const digest = createHash("sha256").update(bytes).digest("hex");
    assert.equal(digest, binding.sha256);
    for (const line of binding.lines) {
      assert.equal(classifyClosedWorkspaceAppearanceStyleBoundary(path, line, digest), "exact-digest-closed-workspace-style-boundary");
      assert.equal(classify(path, line), "exact-digest-closed-workspace-style-boundary");
      assert.equal(classifyClosedWorkspaceAppearanceStyleBoundary(path, line, "0".repeat(64)), null);
      // The retained published digest is not authority for these successor bytes.
      if (path === "packages/browser-workspace/src/workspace.css") for (const predecessor of ["ed1b9afdf16219f7bde421b9a39f0490cccb9b67e8156a72e11c417cc0bfc4bc", "44b42f512b424250c994f69458358e2a4db12fd191233b33d32a5116db32f469", "a012da99389779ff39f946236a68290c9563a5d6805a46277172c27aada063fa", "a01be7bde42549449a25510342caa0fdcf527c53dadee1376bfeffe551ce4380", "ffaceb21d3bdf4fee0081e17a38a829599cc29004609c64435d0ffee633e77d6", "b9ae4d125ae390bf6d2be796d90a2b9e7d17368cbb15cb00d529a9caad8deed0", "b08f699b53c68a381061f7d4f18d8392db8b4f0e4012f1cc73094905b88daefa", "00b5f0fb93a1771484ed6f8d2de3dbc84b43dd079a162b6f22151597abd3a3f7", "b08ab6112ab36e43d7f4f3563b8404e3ef471df0c14c383f15cb53d4bf1a5982", "58059126e3ff3b32325c622ac8ec3b2a55d5f273c44f946c1a06531a38dc1c36", "e5f907b9dc57ed0f278b4f2283d8dc2f4776893abd5a22ffb3b2f66b8275fa09", "71d9c109407ffdbefb2c259941b2182229facd4c0d1e9c0ed76a757535292de2", "9e7a82ec57d27bbeb1ee7f57f301fefdd2ce3bb8fbed19e48d693ebd94e9236e", "46e2943b13c882d137fc63727915fbee7679c57bf6b821e0b7214ab89e176259", "bc258b6542e4e76a06f768bae993593062fbdb9a11b68cb7a12eb4c3d45db0bc", "ec8289058cb101dd21fe34dfe4613ced73dbfcdb66f1578fc2e0e1d48eb68872", "e67a848c98f101f41f5d97460668871f6009dba08cc911ae6ef7f1ee4460e18e", "e321c50a717fea066abc128c59810888f4d818938c2188fa28cdecc010eae6cd"]) assert.equal(classifyClosedWorkspaceAppearanceStyleBoundary(path, line, predecessor), null);
      assert.equal(classifyClosedWorkspaceAppearanceStyleBoundary(path, line, createHash("sha256").update(bytes + "\n").digest("hex")), null);
      assert.equal(classifyClosedWorkspaceAppearanceStyleBoundary(path, line + " unexpected", digest), null);
      assert.equal(classifyClosedWorkspaceAppearanceStyleBoundary(path, line.replace("CLOSED_", "OPEN_"), digest), null);
      assert.equal(classifyClosedWorkspaceAppearanceStyleBoundary(path + ".neighbor", line, digest), null);
      assert.equal(classifyClosedWorkspaceAppearanceStyleBoundary("toString", line, digest), null);
      assert.equal(classifyClosedWorkspaceAppearanceStyleBoundary(path, `new ${legacyDisplay} display`, digest), null);
    }
  }
  assert.equal(classify("README.md", `new ${legacyDisplay} display`), null);
});

test("every retained all-caps token has an explicit KEEP classification", (t) => {
  const listed = spawnSync("git", ["ls-files", "-z", "--cached", "--others", "--exclude-standard"], { cwd: ROOT, encoding: "utf8" });
  assert.equal(listed.status, 0, listed.stderr);
  const counts = new Map();
  const unclassified = [];
  let occurrences = 0;

  for (const path of listed.stdout.split("\0").filter(Boolean)) {
    const bytes = readFileSync(new URL(path, ROOT));
    if (bytes.includes(0)) continue;
    for (const [index, line] of bytes.toString("utf8").split("\n").entries()) {
      const count = line.split(legacyDisplay).length - 1;
      if (!count) continue;
      const category = classify(path, line);
      if (!category) unclassified.push(`${path}:${index + 1}:${line.trim()}`);
      else counts.set(category, (counts.get(category) ?? 0) + count);
      occurrences += count;
    }
  }

  assert.deepEqual(unclassified, []);
  assert.ok(occurrences > 0, "retained stable and historical contracts must remain represented");
  for (const [category, count] of [...counts].sort()) t.diagnostic(`${category}=${count}`);
  t.diagnostic(`retained-total=${occurrences}`);
});

test("active owner, Pages, release, package, issue-template, and worker routes use the canonical owner", () => {
  const repository = "https://github.com/JoFe2/PANSPHAIRA";
  const pages = "https://jofe2.github.io/PANSPHAIRA/";
  assert.match(read("README.md"), new RegExp(`${repository}/releases`));
  assert.match(read("docs/QUICKSTART.md"), new RegExp(`${repository}/releases/latest`));
  assert.match(read("docs/.vitepress/config.mts"), new RegExp(pages.replaceAll(".", "\\.")));
  assert.match(read("CITATION.cff"), new RegExp(`repository-code: "${repository}"`));
  assert.match(read("package.json"), new RegExp(`${repository.replaceAll("/", "\\/")}#readme`));
  assert.match(read(".github/ISSUE_TEMPLATE/config.yml"), new RegExp(`${repository}/security/policy`));
  assert.match(read("docs/.vitepress/config.mts"), /const siteUrl = "https:\/\/jofe2\.github\.io\/PANSPHAIRA\/"/);
  assert.match(read("docs/public/robots.txt"), /^Sitemap: https:\/\/jofe2\.github\.io\/PANSPHAIRA\/sitemap\.xml$/m);
  assert.match(read("packages/dev-worker/src/controller.ts"), /CHIMPMAERA_PUBLIC_REPOSITORY = "JoFe2\/PANSPHAIRA"/);
  assert.match(read("packages/dev-worker/src/controller.ts"), /sourceOrigin: "https:\/\/github\.com\/JoFe2\/PANSPHAIRA\.git"/);
  assert.doesNotMatch(read("packages/dev-worker/src/controller.ts"), new RegExp(`${formerOwner}/${legacyDisplay}`));
});

test("every retained former-owner token has an exact KEEP or HISTORICAL classification", (t) => {
  const listed = spawnSync("git", ["ls-files", "-z", "--cached", "--others", "--exclude-standard"], { cwd: ROOT, encoding: "utf8" });
  assert.equal(listed.status, 0, listed.stderr);
  const counts = new Map();
  const unclassified = [];
  let occurrences = 0;

  for (const path of listed.stdout.split("\0").filter(Boolean)) {
    const bytes = readFileSync(new URL(path, ROOT));
    if (bytes.includes(0)) continue;
    for (const [index, line] of bytes.toString("utf8").split("\n").entries()) {
      const count = (line.split(formerOwner).length - 1) + (line.split(formerPagesOwner).length - 1);
      if (!count) continue;
      const category = classifyFormerOwner(path, line);
      if (!category) unclassified.push(`${path}:${index + 1}:${line.trim()}`);
      else counts.set(category, (counts.get(category) ?? 0) + count);
      occurrences += count;
    }
  }

  assert.deepEqual(unclassified, []);
  assert.ok(occurrences > 0, "historical evidence and sponsorship identity must remain represented");
  assert.match(read("CITATION.cff"), /name: "Jim Pansky"/);
  assert.match(read(".github/FUNDING.yml"), new RegExp(`^github: ${formerOwner}\\b`, "m"));
  assert.match(read(".github/FUNDING.yml"), new RegExp(`^buy_me_a_coffee: ${formerPagesOwner}$`, "m"));
  for (const [category, count] of [...counts].sort()) t.diagnostic(`${category}=${count}`);
  t.diagnostic(`retained-former-owner-total=${occurrences}`);
});
