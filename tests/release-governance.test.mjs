import assert from "node:assert/strict";
import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";
import { validateRepository } from "../scripts/verify-release-governance.mjs";

const ROOT = resolve(import.meta.dirname, "..");

function fixture() {
  const root = mkdtempSync(join(tmpdir(), "cm-release-governance-"));
  cpSync(ROOT, root, {
    recursive: true,
    filter: (source) => !source.includes("node_modules") && !source.includes("/.git") && !source.includes("/dist")
  });
  return root;
}

function replace(root, path, before, after) {
  const file = join(root, path);
  writeFileSync(file, readFileSync(file, "utf8").replace(before, after));
}

function replaceAll(root, path, before, after) {
  const file = join(root, path);
  writeFileSync(file, readFileSync(file, "utf8").replaceAll(before, after));
}

function append(root, path, value) {
  const file = join(root, path);
  writeFileSync(file, `${readFileSync(file, "utf8")}\n${value}\n`);
}

test("repository release governance passes", () => {
  assert.deepEqual(validateRepository(ROOT), []);
});

test("release-bound public quickstarts match the current governance tuple", () => {
  const governance = JSON.parse(readFileSync(join(ROOT, "release", "governance.json"), "utf8"));
  const archive = governance.currentRelease.assets.find(({ name }) => name.endsWith(".tar.gz"));
  assert.ok(archive, "CURRENT_RELEASE_ARCHIVE_MISSING");
  const extractedDirectory = archive.name.replace(/\.tar\.gz$/, "");

  for (const path of ["README.md", "docs/QUICKSTART.md"]) {
    const document = readFileSync(join(ROOT, path), "utf8");
    assert.match(document, new RegExp(`^release=${governance.currentRelease.tag.replaceAll(".", "\\.")}$`, "m"), `${path}: stale release tag`);
    assert.match(document, new RegExp(`^archive=${archive.name.replaceAll(".", "\\.")}$`, "m"), `${path}: stale archive name`);
    assert.match(document, new RegExp(`^cd ${extractedDirectory.replaceAll(".", "\\.")}$`, "m"), `${path}: stale extracted directory`);
  }
});

test("public release builder binds its exact file count to the manifest", () => {
  const manifest = readFileSync(join(ROOT, "release", "public-files.manifest"), "utf8");
  const count = manifest.split("\n").filter((line) => line && !line.startsWith("#")).length;
  const builder = readFileSync(join(ROOT, "scripts", "build-public-release.sh"), "utf8");
  const binding = builder.match(/^if count != (\d+):$/m);
  assert.ok(binding, "PUBLIC_MANIFEST_EXACT_COUNT_BINDING_MISSING");
  assert.equal(Number(binding[1]), count);
  assert.equal(count, 670);
  assert.doesNotMatch(builder, /if count\s*(?:>|>=|<|<=)\s*\d+/);
});

test("Verification Fabric release truth delegates volatile Shadow progress to its issue", () => {
  const governance = JSON.parse(readFileSync(join(ROOT, "release", "governance.json"), "utf8"));
  const verification = governance.claimEvidence.find(({ claimId }) => claimId === "CM-REL-004");
  assert.ok(verification);
  const nonClaims = verification.nonClaims.join(" ");
  assert.match(nonClaims, /issue #34/);
  assert.doesNotMatch(nonClaims, /\b\d+\/24\b/);
});

test("root security and support documents remain version-agnostic", () => {
  const security = readFileSync(join(ROOT, "SECURITY.md"), "utf8");
  const support = readFileSync(join(ROOT, "SUPPORT.md"), "utf8");
  assert.match(security, /\]\(https:\/\/github\.com\/JoFe2\/PANSPHAIRA\/releases\/latest\)/);
  assert.match(security, /\]\(https:\/\/github\.com\/JoFe2\/PANSPHAIRA\/releases\)/);
  assert.doesNotMatch(`${security}\n${support}`, /\b(?:v(?:ersion)?\s*)?\d+\.\d+(?:\.\d+)?(?:[-+][0-9A-Za-z.-]+)?\b/i);
  assert.match(support, /without warranty, service-level objective or\s+production-support commitment/i);
});

test("README presents governed adaptability and evidence-driven improvement without overstating scope", () => {
  const readme = readFileSync(join(ROOT, "README.md"), "utf8");
  const diagram = readFileSync(join(ROOT, "assets", "diagrams", "caged-agent-gateway-constellation.svg"), "utf8");
  const manifest = readFileSync(join(ROOT, "release", "public-files.manifest"), "utf8");
  const positiveIcon = readFileSync(join(ROOT, "assets", "brand", "pansphaira-icon-positive.svg"), "utf8");
  const negativeIcon = readFileSync(join(ROOT, "assets", "brand", "pansphaira-icon-negative.svg"), "utf8");
  const capabilityDiagram = readFileSync(join(ROOT, "assets", "diagrams", "capability-provider-bindings.svg"), "utf8");
  const koFi = readFileSync(join(ROOT, "assets", "support", "ko-fi.svg"), "utf8");
  const buyMeACoffee = readFileSync(join(ROOT, "assets", "support", "buy-me-a-coffee.svg"), "utf8");
  const words = readme.replace(/<[^>]+>/g, " ").trim().split(/\s+/);
  const h2s = readme.match(/^## /gm) ?? [];

  assert.match(readme, /An open, knowledge-driven operating system for governed,\s+adaptable AI ecosystems\./);
  assert.match(readme, /Governed by default\. Adaptable by design\. Improved through evidence\./);
  assert.match(readme, /^# PanSphaira$/m);
  assert.match(readme, /srcset="assets\/brand\/pansphaira-icon-negative\.svg"/);
  assert.match(readme, /srcset="assets\/brand\/pansphaira-icon-positive\.svg"/);
  assert.match(readme, /alt="PanSphaira geometric icon of seven connected circles"/);
  assert.match(readme, /src="assets\/diagrams\/layers\/02-control-architecture-v3\.png"/);
  assert.match(readme, /alt="PanSphaira control architecture from Agent Sphere through governed crossing, Gateway, capability contract, adapter provider, readback receipt, and knowledge revision\."/);
  assert.doesNotMatch(readme, /assets\/diagrams\/layers\/01-product-canon-v3\.(?:png|svg)/);
  assert.doesNotMatch(readme, /assets\/diagrams\/layers\/03-crm-agent-gateway-owner-erp-readback-v3\.(?:png|svg)/);
  assert.match(readme, /<details>\s*<summary>Accessible architecture description<\/summary>/);
  assert.doesNotMatch(readme, /^\s*Text fallback:/im);
  assert.doesNotMatch(readme, /assets\/brand\/chimpmaera-(?:master|negative)\.(?:png|svg)/);
  assert.doesNotMatch(readme, /(?:youtu\.be\/|youtube\.com\/)/);
  assert.match(readme, /\*\*Status:\*\* \[current regular release\]\(https:\/\/github\.com\/JoFe2\/PANSPHAIRA\/releases\/latest\)/);
  assert.match(readme, /proof of concept · Linux x86_64 · \[Apache-2\.0\]\(LICENSE\)/);
  assert.ok(readme.indexOf("## How it works") < readme.indexOf("## Adaptive Knowledge Engineering"));
  assert.ok(readme.indexOf("## Adaptive Knowledge Engineering") < readme.indexOf("## Proof today"));
  assert.ok(readme.indexOf("## Proof today") < readme.indexOf("## Quickstart"));
  assert.ok(readme.indexOf("## Evidence and scope") < readme.indexOf("## Releases"));
  assert.match(readme, /\*\*Adaptive Knowledge Engineering\*\*/);
  assert.match(readme, /Adapt once\. Validate it\. Reuse it everywhere it fits\./);
  assert.match(readme, /Solve → Validate → Package as Knowledge → Share → Reuse → Improve/);
  assert.match(readme, /Share what you know\. Expand what everyone can build\./);
  assert.match(readme, /Every integration can teach the system how to\s+adapt the\s+next one—without\s+silently expanding authority/);
  assert.match(readme, /open-ended,\s+user-need-driven option space/);
  assert.match(readme, /unverified knowledge record may exist without becoming an authoritative\s+default/);
  assert.doesNotMatch(readme, /\b(?:infinite|one-click|minutes?|hours?|production-ready)\b/i);
  assert.ok(words.length >= 600 && words.length <= 1000, `README_WORD_COUNT:${words.length}`);
  assert.ok(h2s.length <= 8, `README_H2_COUNT:${h2s.length}`);

  assert.match(diagram, /role="img" aria-labelledby="caged-title caged-desc"/);
  assert.match(diagram, /<title id="caged-title">/);
  assert.match(diagram, /<desc id="caged-desc">/);
  assert.match(diagram, /PanSphaira Agent Sphere to Gateway Sphere architecture/);
  assert.match(diagram, /Sphere is visualization vocabulary, not a protocol, schema, API, or runtime abstraction/);
  assert.match(diagram, /AGENT SPHERE/);
  assert.match(diagram, /GATEWAY SPHERE/);
  assert.match(diagram, /GOVERNED[\s\S]{0,80}CROSSING/);
  assert.ok(diagram.indexOf("<!-- Connectors are behind nodes.") < diagram.indexOf("<!-- Left containment -->"));
  assert.equal((diagram.match(/marker-end=/g) ?? []).length, 8);
  assert.match(diagram, /ADAPTIVE KNOWLEDGE ENGINEERING/);
  assert.match(diagram, /Solid routes = locally evidenced reference paths/);
  assert.match(diagram, /Dashed routes = prepared add\/replace direction/);
  assert.match(diagram, /Security boundary = containment \+ mediated execution/);
  assert.doesNotMatch(diagram, /<(?:image|script|linearGradient|radialGradient)\b|(?:href|src)="https?:\/\//i);
  assert.match(positiveIcon, /role="img" aria-labelledby="pansphaira-icon-positive-title pansphaira-icon-positive-desc"/);
  assert.match(positiveIcon, /Black geometric icon composed of seven connected circles/);
  assert.match(negativeIcon, /role="img" aria-labelledby="pansphaira-icon-negative-title pansphaira-icon-negative-desc"/);
  assert.match(negativeIcon, /White geometric icon composed of seven connected circles/);
  assert.match(capabilityDiagram, /<title id="title">PanSphaira capability contracts and provider bindings<\/title>/);
  assert.match(koFi, /<title id="title">Support PanSphaira on Ko-fi<\/title>/);
  assert.match(buyMeACoffee, /<title id="title">Support PanSphaira on Buy Me a Coffee<\/title>/);
  assert.match(manifest, /^assets\/diagrams\/caged-agent-gateway-constellation\.svg\tassets\/diagrams\/caged-agent-gateway-constellation\.svg\t0644$/m);
  assert.match(manifest, /^assets\/diagrams\/layers\/02-control-architecture-v3\.png\tassets\/diagrams\/layers\/02-control-architecture-v3\.png\t0644$/m);
  for (const path of [
    "assets/brand/README.md",
    "assets/brand/pansphaira-icon-negative.png",
    "assets/brand/pansphaira-icon-negative.svg",
    "assets/brand/pansphaira-icon-positive.png",
    "assets/brand/pansphaira-icon-positive.svg",
    "docs/OPERATING-FIELD-GUIDE.md",
    "docs/PANSPHAIRA-TERMINOLOGY.md",
  ]) {
    assert.match(manifest, new RegExp(`^${path.replaceAll(".", "\\.")}\\t${path.replaceAll(".", "\\.")}\\t0644$`, "m"));
  }
  assert.doesNotMatch(manifest, /^assets\/brand\/chimpmaera-(?:master|negative)\.(?:png|svg)\t/m);
  assert.doesNotMatch(manifest, /^docs\/ZOO-FIELD-GUIDE\.md\t/m);
});

test("public documentation presentation gate accepts encapsulated or linked accessibility text", (t) => {
  const root = fixture();
  t.after(() => rmSync(root, { recursive: true, force: true }));
  append(root, "README.md", [
    "<details>",
    "<summary>Accessible fixture description</summary>",
    "",
    "Text fallback: A governed proposal crosses a mediated boundary.",
    "",
    "</details>",
    "",
    "Extended accessibility context is available in [the architecture documentation](docs/ARCHITECTURE.md).",
  ].join("\n"));
  assert.deepEqual(
    validateRepository(root).filter((value) => value.startsWith("PUBLIC_DOC_")),
    [],
  );
});

test("release governance negative probes fail closed", async (t) => {
  const probes = [
    ["visible README text fallback", "PUBLIC_DOC_UNENCAPSULATED_FALLBACK_LABEL:README.md", (root) => append(root, "README.md", "Text fallback: technical architecture copy")],
    ["visible public-doc placeholder", "PUBLIC_DOC_UNENCAPSULATED_FALLBACK_LABEL:docs/index.md", (root) => append(root, "docs/index.md", "Placeholder: replace this architecture explanation")],
    ["empty HTML image alt", "PUBLIC_DOC_IMAGE_ALT_UNUSABLE:README.md", (root) => replace(root, "README.md", "alt=\"PanSphaira control architecture from Agent Sphere through governed crossing, Gateway, capability contract, adapter provider, readback receipt, and knowledge revision.\"", "alt=\"\"")],
    ["empty Markdown image alt", "PUBLIC_DOC_IMAGE_ALT_UNUSABLE:README.md", (root) => append(root, "README.md", "![](assets/diagrams/caged-agent-gateway-constellation.svg)")],
    ["README version-bound release link", "README_STABLE_RELEASE_NAVIGATION_MISSING", (root) => replace(root, "README.md", "[Latest regular release](https://github.com/JoFe2/PANSPHAIRA/releases/latest)", "[Version-bound release](https://github.com/JoFe2/PANSPHAIRA/releases/tag/v0.1.0)")],
    ["README stale duplicate release tuple", "PUBLIC_QUICKSTART_RELEASE_TUPLE_STALE:README.md", (root) => append(root, "README.md", "release=v0.2.0-poc.20260821.1\narchive=cm-product-increment-rc-20260821-adaptive-evidence-controller.tar.gz\ncd cm-product-increment-rc-20260821-adaptive-evidence-controller")],
    ["Quickstart stale duplicate release tuple", "PUBLIC_QUICKSTART_RELEASE_TUPLE_STALE:docs/QUICKSTART.md", (root) => append(root, "docs/QUICKSTART.md", "release=v0.2.0-poc.20260821.1\narchive=cm-product-increment-rc-20260821-adaptive-evidence-controller.tar.gz\ncd cm-product-increment-rc-20260821-adaptive-evidence-controller")],
    ["release archive declaration drift", "PUBLIC_QUICKSTART_RELEASE_TUPLE_STALE:README.md", (root) => { const p = join(root, "release/governance.json"); const j = JSON.parse(readFileSync(p)); j.currentRelease.assetManifest.declares = "other.tar.gz"; writeFileSync(p, JSON.stringify(j)); }],
    ["duplicate declared release archive", "PUBLIC_QUICKSTART_RELEASE_TUPLE_STALE:README.md", (root) => { const p = join(root, "release/governance.json"); const j = JSON.parse(readFileSync(p)); const archive = j.currentRelease.assets.find(({ name }) => name === j.currentRelease.assetManifest.declares); j.currentRelease.assets.push({ ...archive }); writeFileSync(p, JSON.stringify(j)); }],
    ["README stale increment prose", "PUBLIC_QUICKSTART_RELEASE_TUPLE_STALE:README.md", (root) => replace(root, "README.md", "canonical-number hardening", "adaptive-evidence controller")],
    ["Quickstart stale increment prose", "PUBLIC_QUICKSTART_RELEASE_TUPLE_STALE:docs/QUICKSTART.md", (root) => replace(root, "docs/QUICKSTART.md", "canonical-number hardening", "adaptive-evidence controller")],
    ["README increment hidden in HTML comment", "PUBLIC_QUICKSTART_RELEASE_TUPLE_STALE:README.md", (root) => replace(root, "README.md", "This release is the **canonical-number hardening** increment.", "<!-- canonical-number hardening -->\nThis release is the current increment.")],
    ["README indented stale tuple", "PUBLIC_QUICKSTART_RELEASE_TUPLE_STALE:README.md", (root) => append(root, "README.md", "```sh\n  release=v0.2.0-poc.20260821.1\n  archive=cm-product-increment-rc-20260821-adaptive-evidence-controller.tar.gz\n  cd cm-product-increment-rc-20260821-adaptive-evidence-controller\n```")],
    ["missing Quickstart document", "PUBLIC_QUICKSTART_MISSING:docs/QUICKSTART.md", (root) => rmSync(join(root, "docs/QUICKSTART.md"))],
    ["README Daily identity", "README_ACTIVE_DAILY_IDENTITY_DENIED", (root) => replace(root, "README.md", "Release pages own included capabilities", "Today's Daily snapshot owns included capabilities")],
    ["Knowledge OS promoted as current maturity", "README_POC_POSITIONING_MISSING", (root) => replace(root, "README.md", "broader direction is not a claim of current", "broader direction is current")],
    ["root Security static Latest claim", "ROOT_SECURITY_VERSION_BINDING_DENIED", (root) => append(root, "SECURITY.md", "The latest tagged release is v9.9.9.")],
    ["root Security version-bound release link", "ROOT_SECURITY_STABLE_RELEASE_NAVIGATION_MISSING", (root) => replace(root, "SECURITY.md", "https://github.com/JoFe2/PANSPHAIRA/releases/latest", "https://github.com/JoFe2/PANSPHAIRA/releases/tag/v9.9.9")],
    ["root Support product-version binding", "ROOT_SUPPORT_VERSION_BINDING_DENIED", (root) => replace(root, "SUPPORT.md", "PanSphaira is provided", "PanSphaira v9.9 is provided")],
    ["stale Security claim", "SECURITY_STALE_RELEASE_CLAIM_DENIED", (root) => replace(root, "docs/SECURITY-ASSURANCE.md", "## Claim maturity", "v0.1.0 remains the only tagged and published release.\n\n## Claim maturity")],
    ["System Advisor stale pre-release status", "RELEASED_LOCAL_SYNTHETIC_STATUS_MISSING:System Advisor", (root) => replace(root, "docs/SYSTEM-ADVISOR-GUIDE.md", "Status: **RELEASED, LOCAL-SYNTHETIC CONTRACT SURFACE**", "Status: **LOCALLY VALIDATED, NOT RELEASED**")],
    ["Builder defaults stale pre-release status", "RELEASED_LOCAL_SYNTHETIC_STATUS_MISSING:Builder defaults", (root) => replace(root, "docs/BUILDER-CONFIGURATION-DEFAULTS.md", "Status: **RELEASED, LOCAL-SYNTHETIC CONTRACT SURFACE**", "Status: **LOCALLY VALIDATED, NOT RELEASED**")],
    ["Canon lab profile mislabeled as fully mediated", "FULL_CONTROL_LAB_BOUNDARY_MISSING:docs/CANON.md", (root) => replaceAll(root, "docs/CANON.md", "may bypass", "remains completely mediated by")],
    ["Canon core rule count changed", "CANON_RULE_SET_INVALID:EXPECTED_CM-CAN-01_THROUGH_CM-CAN-28", (root) => replace(root, "docs/CANON.md", "### CM-CAN-28 —", "### CM-CAN-29 —")],
    ["HMI release evidence mapped to Azure", "CAPABILITY_MAPPING_INVALID:CM-REL-006", (root) => replace(root, "docs/capabilities.md", "[`CM-REL-006` HMI/Harness release evidence]", "[`CM-REL-007` HMI/Harness release evidence]")],
    ["extension assurance release evidence misbound", "CAPABILITY_MAPPING_INVALID:CM-REL-014", (root) => replace(root, "docs/capabilities.md", "[`CM-REL-014` release binding]", "[`CM-REL-013` release binding]")],
    ["agent-work event release evidence misbound", "CAPABILITY_MAPPING_INVALID:CM-REL-015", (root) => replace(root, "docs/capabilities.md", "[`CM-REL-015` release binding]", "[`CM-REL-014` release binding]")],
    ["maintenance contract release evidence misbound", "CAPABILITY_MAPPING_INVALID:CM-REL-005", (root) => replace(root, "docs/capabilities.md", "[`CM-REL-005` release binding]", "[`CM-REL-004` release binding]")],
    ["External video release evidence misbound", "CAPABILITY_MAPPING_INVALID:CM-REL-016", (root) => replace(root, "docs/capabilities.md", "[`CM-REL-016` release binding]", "[`CM-REL-015` release binding]")],
    ["ASF intake release evidence misbound", "CAPABILITY_MAPPING_INVALID:CM-REL-017", (root) => replace(root, "docs/capabilities.md", "[`CM-REL-017` release binding]", "[`CM-REL-016` release binding]")],
    ["integration profile release evidence misbound", "CAPABILITY_MAPPING_INVALID:CM-REL-018", (root) => replace(root, "docs/capabilities.md", "[`CM-REL-018` release binding]", "[`CM-REL-017` release binding]")],
    ["stale limitation version", "LIMITATIONS_STALE_V01_BINDING_DENIED", (root) => replace(root, "docs/KNOWN-LIMITATIONS.md", "The current local demo", "The v0.1 demo")],
    ["withdrawn video", "WITHDRAWN_ACTIVE_VIDEO_DENIED:8mB7O81Y2xA", (root) => append(root, "README.md", "https://youtu.be/8mB7O81Y2xA")],
    ["missing non-claim", "NON_CLAIMS_MISSING:CM-REL-001", (root) => { const p = join(root, "release/governance.json"); const j = JSON.parse(readFileSync(p)); j.claimEvidence[0].nonClaims = []; writeFileSync(p, JSON.stringify(j)); }],
    ["missing evidence path", "CLAIM_EVIDENCE_MISSING:CM-REL-001:docs/missing.md", (root) => { const p = join(root, "release/governance.json"); const j = JSON.parse(readFileSync(p)); j.claimEvidence[0].evidencePaths.push("docs/missing.md"); writeFileSync(p, JSON.stringify(j)); }],
    ["missing grouped component evidence", "RELEASE_COMPONENT_EVIDENCE_MISSING:Verification Fabric", (root) => { const p = join(root, "release/governance.json"); const j = JSON.parse(readFileSync(p)); j.claimEvidence = j.claimEvidence.filter((claim) => claim.component !== "Verification Fabric"); writeFileSync(p, JSON.stringify(j)); }],
    ["component byte not in public manifest", "COMPONENT_PATH_UNMANIFESTED:CM-REL-004:packages/contracts/src/verification-fabric.ts", (root) => replace(root, "release/public-files.manifest", "packages/contracts/src/verification-fabric.ts\tpackages/contracts/src/verification-fabric.ts\t0644\n", "")],
    ["asset hash removed", "ASSET_INVENTORY_INVALID", (root) => { const p = join(root, "release/governance.json"); const j = JSON.parse(readFileSync(p)); j.currentRelease.assets[0].sha256 = "unknown"; writeFileSync(p, JSON.stringify(j)); }],
    ["publication metadata removed", "CURRENT_PUBLICATION_METADATA_INVALID", (root) => { const p = join(root, "release/governance.json"); const j = JSON.parse(readFileSync(p)); delete j.currentRelease.releaseId; writeFileSync(p, JSON.stringify(j)); }],
    ["functional increment title drift", "FUNCTIONAL_INCREMENT_TITLE_MISSING", (root) => { const p = join(root, "release/governance.json"); const j = JSON.parse(readFileSync(p)); j.currentRelease.increment = "MSSQL Scope Compatibility"; writeFileSync(p, JSON.stringify(j)); }],
    ["private path leak", "LEAK_PRIVATE_HOME_PATH:README.md", (root) => append(root, "README.md", ["Current files: ", "home", "alice", "private", ""].join("/"))],
    ["calendar generator title", "GENERATOR_CALENDAR_RELEASE_TITLE_DENIED", (root) => replace(root, "scripts/daily-poc.mjs", "const releaseTitle = incrementCandidateTitle(manifest);", "const releaseTitle = `PanSphaira POC Daily — ${manifest.date}`;")]
  ];
  for (const [name, expected, mutate] of probes) {
    await t.test(name, (t) => {
      const root = fixture();
      t.after(() => rmSync(root, { recursive: true, force: true }));
      mutate(root);
      assert.ok(validateRepository(root).some((value) => value.includes(expected)), validateRepository(root).join("\n"));
    });
  }
});
