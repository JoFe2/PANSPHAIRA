#!/usr/bin/env node
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");
const read = (root, path) => readFileSync(resolve(root, path), "utf8");
const issue = (issues, condition, code) => { if (!condition) issues.push(code); };
const ROOT_DOC_VERSION_BINDING = /\b(?:v(?:ersion)?\s*)?\d+\.\d+(?:\.\d+)?(?:[-+][0-9A-Za-z.-]+)?\b/i;

function section(markdown, heading) {
  const start = markdown.indexOf(`## ${heading}`);
  if (start < 0) return "";
  const rest = markdown.slice(start);
  const next = rest.slice(3).search(/^## /m);
  return next < 0 ? rest : rest.slice(0, next + 3);
}

function releaseTupleMatches(markdown, release, archive) {
  if (!archive?.name || release.assetManifest?.declares !== archive.name) return false;
  const visibleProse = markdown
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/```[\s\S]*?```/g, "");
  const blocks = [...markdown.matchAll(/```sh\s*\n([\s\S]*?)```/g)]
    .map((match) => match[1])
    .filter((block) => /^\s*release=/m.test(block));
  if (blocks.length !== 1) return false;
  const block = blocks[0];
  const assignments = (name) => [...block.matchAll(new RegExp(`^\\s*${name}=([^\\s]+)\\s*$`, "gm"))].map((match) => match[1]);
  const releaseValues = assignments("release");
  const archiveValues = assignments("archive");
  const directoryValues = [...block.matchAll(/^\s*cd (cm-product-increment-[^\s]+)\s*$/gm)].map((match) => match[1]);
  return visibleProse.toLowerCase().includes(release.increment.toLowerCase())
    && releaseValues.length === 1 && releaseValues[0] === release.tag
    && archiveValues.length === 1 && archiveValues[0] === archive.name
    && directoryValues.length === 1 && directoryValues[0] === archive.name.replace(/\.tar\.gz$/, "")
    && [...markdown.matchAll(/^\s*release=/gm)].length === 1
    && [...markdown.matchAll(/^\s*archive=/gm)].length === 1
    && [...markdown.matchAll(/^\s*cd cm-product-increment-/gm)].length === 1;
}

function scanUnsafe(text, path) {
  const patterns = [
    ["PRIVATE_KEY", /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/],
    ["GITHUB_TOKEN", /\bgh[pousr]_[A-Za-z0-9]{20,}\b/],
    ["OPENAI_KEY", /\bsk-[A-Za-z0-9_-]{20,}\b/],
    ["HUGGINGFACE_TOKEN", /\bhf_[A-Za-z0-9]{20,}\b/],
    ["TELEGRAM_TOKEN", /\b[0-9]{8,12}:[A-Za-z0-9_-]{30,}\b/],
    ["CREDENTIAL_URL", /https?:\/\/[^/\s:@]+:[^/\s@]+@/],
    ["PRIVATE_HOME_PATH", /\/home\/[A-Za-z0-9._-]+(?:\/|\b)/],
    ["PRIVATE_MOUNT_PATH", /\/mnt\/[A-Za-z0-9._-]+(?:\/|\b)/],
    ["SESSION_ID", /\bagent:[A-Za-z0-9._-]+:[A-Za-z0-9._:-]+\b/]
  ];
  return patterns.filter(([, regex]) => regex.test(text)).map(([name]) => `LEAK_${name}:${path}`);
}

function usableImageAlt(value) {
  const normalized = value
    .replace(/&(?:nbsp|#160);/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
  return normalized.length >= 5
    && /[\p{L}\p{N}]/u.test(normalized)
    && !/^(?:alt(?: text)?|diagram|graphic|icon|image|img|logo|none|null|n\/?a|photo|picture|placeholder|screenshot|tbd|todo)[.!]?$/i.test(normalized);
}

function publicDocumentationPresentationIssues(text, path) {
  if (!/\.(?:html?|markdown|md)$/i.test(path)) return [];
  const issues = [];
  const visible = text
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/<details(?:\s[^>]*)?>[\s\S]*?<\/details\s*>/gi, "");
  if (/^\s*(?:[-*>]\s*)?(?:\*\*|__)?(?:text\s+fallback|fallback\s+text|placeholder(?:\s+text)?)(?:\*\*|__)?\s*:/im.test(visible)) {
    issues.push(`PUBLIC_DOC_UNENCAPSULATED_FALLBACK_LABEL:${path}`);
  }

  for (const match of text.matchAll(/<img\b[^>]*>/gi)) {
    const alt = match[0].match(/\balt\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+))/i);
    if (!alt || !usableImageAlt(alt[1] ?? alt[2] ?? alt[3] ?? "")) {
      issues.push(`PUBLIC_DOC_IMAGE_ALT_UNUSABLE:${path}`);
    }
  }
  for (const match of text.matchAll(/!\[([^\]\n]*)\](?:\([^\n)]*\)|\[[^\]\n]*\])/g)) {
    if (!usableImageAlt(match[1])) issues.push(`PUBLIC_DOC_IMAGE_ALT_UNUSABLE:${path}`);
  }
  return [...new Set(issues)];
}

export function validateRepository(root = process.cwd()) {
  const issues = [];
  let governance;
  try {
    governance = JSON.parse(read(root, "release/governance.json"));
  } catch (error) {
    return [`GOVERNANCE_CONFIG_UNREADABLE:${error.code ?? error.message}`];
  }

  issue(issues, governance.schemaVersion === "chimpmaera.release-governance/v1", "GOVERNANCE_SCHEMA_DENIED");
  const release = governance.currentRelease ?? {};
  issue(issues, /^v\d+\.\d+\.\d+-poc\.\d{8}\.\d+$/.test(release.tag ?? ""), "CURRENT_TAG_INVALID");
  issue(issues, Number.isSafeInteger(release.releaseId) && release.releaseId > 0
    && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/.test(release.publishedAt ?? "")
    && release.url === `https://github.com/${governance.repository}/releases/tag/${release.tag}`, "CURRENT_PUBLICATION_METADATA_INVALID");
  issue(issues, typeof release.title === "string"
    && release.title.toLowerCase().includes((release.increment ?? "__missing__").toLowerCase()), "FUNCTIONAL_INCREMENT_TITLE_MISSING");
  issue(issues, !/\b(?:daily|today(?:'s)?|calendar)\b/i.test(release.title ?? ""), "CALENDAR_RELEASE_IDENTITY_DENIED");
  issue(issues, release.draft === false && release.prerelease === false && release.mustBeLatest === true, "LATEST_POLICY_NOT_FAIL_CLOSED");
  issue(issues, governance.policy?.anonymousReadbackRequired === true, "ANONYMOUS_READBACK_NOT_REQUIRED");
  issue(issues, governance.policy?.assetManifestRequired === true && governance.policy?.assetHashesRequired === true, "ASSET_EVIDENCE_NOT_REQUIRED");
  issue(issues, /draft=false/.test(governance.policy?.latest ?? "") && /prerelease=false/.test(governance.policy?.latest ?? ""), "LATEST_POLICY_UNSPECIFIED");

  const files = new Map();
  for (const path of governance.activePublicFiles ?? []) {
    try { files.set(path, read(root, path)); } catch { issues.push(`ACTIVE_PUBLIC_FILE_MISSING:${path}`); }
  }
  const historicalArchivePrefixes = governance.historicalArchivePrefixes ?? [];
  for (const [path, text] of files) {
    if (!historicalArchivePrefixes.some((prefix) => path.startsWith(prefix))) {
      issues.push(...publicDocumentationPresentationIssues(text, path));
    }
  }
  const readme = files.get("README.md") ?? "";
  let quickstart = "";
  try { quickstart = read(root, "docs/QUICKSTART.md"); } catch { issues.push("PUBLIC_QUICKSTART_MISSING:docs/QUICKSTART.md"); }
  const releaseSection = section(readme, "Releases");
  const quickstartSection = section(readme, "Quickstart");
  const readmeOutsideQuickstart = readme.replace(quickstartSection, "");
  const releaseArchives = (release.assets ?? []).filter(({ name }) => name === release.assetManifest?.declares && name.endsWith(".tar.gz"));
  const releaseArchive = releaseArchives.length === 1 ? releaseArchives[0] : undefined;
  issue(issues, releaseTupleMatches(quickstart, release, releaseArchive), "PUBLIC_QUICKSTART_RELEASE_TUPLE_STALE:docs/QUICKSTART.md");
  issue(
    issues,
    !/^\s*(?:release|archive)=/m.test(readme) && !/^\s*cd cm-product-increment-/m.test(readme),
    "README_VOLATILE_RELEASE_TUPLE_DENIED",
  );
  issue(
    issues,
    [
      "](https://github.com/JoFe2/PANSPHAIRA/releases/latest)",
      "](https://github.com/JoFe2/PANSPHAIRA/releases)",
      "](https://github.com/JoFe2/PANSPHAIRA/releases.atom)",
    ].every((link) => releaseSection.includes(link)),
    "README_STABLE_RELEASE_NAVIGATION_MISSING",
  );
  issue(
    issues,
    /included capabilities/i.test(releaseSection)
      && /evidence boundaries/i.test(releaseSection)
      && /issues\/PRs/i.test(releaseSection)
      && /SHA-256/i.test(releaseSection),
    "README_RELEASE_NOTE_SCOPE_MISSING",
  );
  issue(issues, !/\/releases\/tag\//.test(releaseSection) && !/\bv\d+\.\d+\.\d+\b/.test(readmeOutsideQuickstart), "README_VERSION_BOUND_RELEASE_NAVIGATION_DENIED");
  issue(issues, !/Today's Daily|Previous Daily|POC Daily|Daily snapshot/i.test(releaseSection), "README_ACTIVE_DAILY_IDENTITY_DENIED");
  issue(
    issues,
    /An open, knowledge-driven operating system for governed,\s+adaptable AI ecosystems\./i.test(readme)
      && /public repository provides an open-source proof-of-concept control\s+plane/i.test(readme)
      && /runnable local synthetic demo/i.test(readme)
      && /broader direction is not a claim of current\s+product maturity or universal live compatibility/i.test(readme),
    "README_POC_POSITIONING_MISSING",
  );

  const rootSecurity = files.get("SECURITY.md") ?? "";
  issue(
    issues,
    /\]\(https:\/\/github\.com\/JoFe2\/PANSPHAIRA\/releases\/latest\)/.test(rootSecurity)
      && /\]\(https:\/\/github\.com\/JoFe2\/PANSPHAIRA\/releases\)/.test(rootSecurity),
    "ROOT_SECURITY_STABLE_RELEASE_NAVIGATION_MISSING",
  );
  issue(issues, !ROOT_DOC_VERSION_BINDING.test(rootSecurity), "ROOT_SECURITY_VERSION_BINDING_DENIED");
  issue(
    issues,
    /bounded local, synthetic proofs of concept/i.test(rootSecurity)
      && /Production\s+operation[^.]*unsupported/i.test(rootSecurity),
    "ROOT_SECURITY_POC_BOUNDARY_MISSING",
  );

  const rootSupport = files.get("SUPPORT.md") ?? "";
  issue(issues, !ROOT_DOC_VERSION_BINDING.test(rootSupport), "ROOT_SUPPORT_VERSION_BINDING_DENIED");
  issue(
    issues,
    /without warranty/i.test(rootSupport)
      && /service-level objective/i.test(rootSupport)
      && /production-support commitment/i.test(rootSupport),
    "ROOT_SUPPORT_BOUNDARY_MISSING",
  );

  for (const id of governance.videos?.withdrawnIds ?? []) {
    issue(issues, !readme.includes(id), `WITHDRAWN_ACTIVE_VIDEO_DENIED:${id}`);
  }
  const observedVideoIds = [...readme.matchAll(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/))([A-Za-z0-9_-]{11})/g)].map((match) => match[1]);
  const verified = new Set(governance.videos?.activeVerifiedIds ?? []);
  for (const id of observedVideoIds) issue(issues, verified.has(id), `UNVERIFIED_ACTIVE_VIDEO_DENIED:${id}`);

  const security = files.get("docs/SECURITY-ASSURANCE.md") ?? "";
  issue(issues, security.includes(release.tag), "SECURITY_CURRENT_RELEASE_EVIDENCE_MISSING");
  issue(issues, !/v0\.1\.0 remains the only tagged and published release|v0\.2[^\n]*(?:not (?:a )?tagged release|NOT RELEASED)/i.test(security), "SECURITY_STALE_RELEASE_CLAIM_DENIED");
  issue(issues, /local, synthetic|local and synthetic/i.test(security), "SECURITY_SYNTHETIC_BOUNDARY_MISSING");
  issue(issues, /no production security|No production security/i.test(security), "SECURITY_PRODUCTION_NONCLAIM_MISSING");

  const consistencyPaths = [
    "docs/CANON.md",
    "docs/OPERATING-FIELD-GUIDE.md",
    "docs/AGENT-RUNTIME-ISOLATION-CONTRACT.md",
    "docs/SECURITY-ASSURANCE.md",
    "docs/BUILDER-AGENT-OPERATOR-GUIDE.md",
    "docs/BUILDER-CONFIGURATION-DEFAULTS.md",
  ];
  const consistencyDocs = new Map(consistencyPaths.map((path) => [path, read(root, path)]));
  for (const [path, text] of consistencyDocs) {
    issue(
      issues,
      /FULL_CONTROL_LAB/.test(text)
        && /bypass(?:es|ed)?\s+PanSphaira action(?:\s+and\s+|\/)Approval gates/i.test(text)
        && /OS\/host\s+ceiling/i.test(text)
        && /SAFE_GUIDED/.test(text),
      `FULL_CONTROL_LAB_BOUNDARY_MISSING:${path}`,
    );
  }
  for (const path of ["docs/CANON.md", "docs/OPERATING-FIELD-GUIDE.md", "docs/AGENT-RUNTIME-ISOLATION-CONTRACT.md", "docs/SECURITY-ASSURANCE.md"]) {
    issue(issues, /broadest governed\s+(?:Owner\s+)?Profile/i.test(consistencyDocs.get(path)), `GOVERNED_FULL_PROFILE_DISTINCTION_MISSING:${path}`);
  }

  const canon = consistencyDocs.get("docs/CANON.md");
  const canonRuleIds = [...canon.matchAll(/^### (CM-CAN-\d{2}) —/gm)].map((match) => match[1]);
  const expectedCanonRuleIds = Array.from({ length: 28 }, (_, index) => `CM-CAN-${String(index + 1).padStart(2, "0")}`);
  issue(
    issues,
    canonRuleIds.length === expectedCanonRuleIds.length
      && new Set(canonRuleIds).size === expectedCanonRuleIds.length
      && canonRuleIds.every((id, index) => id === expectedCanonRuleIds[index]),
    "CANON_RULE_SET_INVALID:EXPECTED_CM-CAN-01_THROUGH_CM-CAN-28",
  );
  for (const invariant of [
    "Knowledge Record / Knowledge Contract",
    "Governed Template",
    "Applicability / Invalidation",
    "Knowledge and template promotion",
    "Supersession is append-only, traceable, and reversible",
  ]) issue(issues, canon.includes(invariant), `CANON_KNOWLEDGE_INVARIANT_MISSING:${invariant}`);

  const operatingGuide = consistencyDocs.get("docs/OPERATING-FIELD-GUIDE.md");
  issue(issues, /Capability Contract → Governed Template → typed Adapter → Provider Binding/.test(operatingGuide), "ADAPTATION_LIFECYCLE_MISSING");
  issue(issues, /Verification Fabric v2 remains \*\*Shadow\*\*/.test(operatingGuide), "VERIFICATION_SHADOW_BOUNDARY_MISSING");
  issue(issues, /all five closed operations[\s\S]{0,160}`cm\.operator\.read` is\s+reserved for a future separate administrative-read Profile/i.test(operatingGuide), "AZURE_POWER_SCOPE_BOUNDARY_MISSING");

  const systemAdvisor = read(root, "docs/SYSTEM-ADVISOR-GUIDE.md");
  const builderDefaults = consistencyDocs.get("docs/BUILDER-CONFIGURATION-DEFAULTS.md");
  for (const [name, text] of [["System Advisor", systemAdvisor], ["Builder defaults", builderDefaults]]) {
    issue(issues, /Status: \*\*RELEASED, LOCAL-SYNTHETIC CONTRACT SURFACE\*\*/.test(text) && !/LOCALLY VALIDATED, NOT RELEASED/.test(text), `RELEASED_LOCAL_SYNTHETIC_STATUS_MISSING:${name}`);
  }

  const capabilities = read(root, "docs/capabilities.md");
  const capabilityRows = capabilities.split("\n").filter((line) => line.startsWith("|"));
  const capabilityRow = (label) => capabilityRows.find((line) => line.includes(label)) ?? "";
  issue(issues, /BLD-001 local PDCA source/.test(capabilityRow("Builder contracts")) && !/CM-REL-00[678]/.test(capabilityRow("Builder contracts")), "BUILDER_EVIDENCE_MAPPING_INVALID");
  issue(issues, /CM-REL-006/.test(capabilityRow("HMI/Harness multitool")), "CAPABILITY_MAPPING_INVALID:CM-REL-006");
  issue(issues, /CM-REL-007/.test(capabilityRow("Microsoft Entra identity profile")), "CAPABILITY_MAPPING_INVALID:CM-REL-007");
  issue(issues, /CM-REL-008/.test(capabilityRow("Power Platform five-read connector")), "CAPABILITY_MAPPING_INVALID:CM-REL-008");
  issue(issues, /CM-REL-012/.test(capabilityRow("Resource-plane profiles M0")), "CAPABILITY_MAPPING_INVALID:CM-REL-012");
  issue(issues, /CM-REL-013/.test(capabilityRow("ADD → REPLACE adaptability benchmark M0")), "CAPABILITY_MAPPING_INVALID:CM-REL-013");
  issue(issues, /CM-REL-014/.test(capabilityRow("Extension assurance profiles")), "CAPABILITY_MAPPING_INVALID:CM-REL-014");
  issue(issues, /CM-REL-015/.test(capabilityRow("Minimized agent-work event contract")), "CAPABILITY_MAPPING_INVALID:CM-REL-015");
  issue(issues, /CM-REL-005/.test(capabilityRow("Update, migration, and Doctor contracts")), "CAPABILITY_MAPPING_INVALID:CM-REL-005");
  issue(issues, /CM-REL-016/.test(capabilityRow("External Video Service boundary")), "CAPABILITY_MAPPING_INVALID:CM-REL-016");
  issue(issues, /CM-REL-023/.test(capabilityRow("Synthetic CPU video package reference")), "CAPABILITY_MAPPING_INVALID:CM-REL-023");
  issue(issues, /CM-REL-017/.test(capabilityRow("ASF-INTAKE-2 signal release intake")), "CAPABILITY_MAPPING_INVALID:CM-REL-017");
  issue(issues, /CM-REL-018/.test(capabilityRow("INT-PROFILE-001 integration profiles")), "CAPABILITY_MAPPING_INVALID:CM-REL-018");
  issue(issues, /CM-REL-022/.test(capabilityRow("External KaleidoSphere service boundary v2")), "CAPABILITY_MAPPING_INVALID:CM-REL-022");

  const docsHub = read(root, "docs/README.md");
  issue(issues, /current product category is an open,\s+knowledge-driven operating system/i.test(docsHub)
    && /Agent Sphere → governed Connections and\s+Crossings → Gateway Sphere/.test(docsHub)
    && /Sphere is terminology and\s+visualization only, not a protocol, schema, API or runtime abstraction/.test(docsHub), "DOCS_HUB_PRODUCT_ARCHITECTURE_MISSING");
  issue(issues, /contribution preflight[\s\S]{0,260}no\s+submission, publication, external write/i.test(docsHub), "HMI_PREFLIGHT_HUB_BOUNDARY_MISSING");

  const connectionGuide = read(root, "docs/CONNECT-YOUR-FIRST-SYSTEM.md");
  issue(issues, /RELEASED LOCAL-SYNTHETIC AUTHORING\/VALIDATION CONTRACT/.test(connectionGuide) && /PLANNED LIVE REALIZATION/.test(connectionGuide), "CONNECTION_MATURITY_BOUNDARY_MISSING");
  issue(issues, /five-operation Power\s+Platform read connector bind exactly `cm\.discovery\.read`/.test(connectionGuide) && /`cm\.operator\.read` is reserved for a future separate administrative-read\s+Profile/.test(connectionGuide), "CONNECTION_AZURE_SCOPE_BOUNDARY_MISSING");

  const externalVideo = read(root, "docs/EXTERNAL-VIDEO-SERVICE.md");
  issue(issues, /SHA-256-pinned external artifact|SHA-256-pinned artifact/.test(externalVideo) && /does not claim video publication/.test(externalVideo), "EXTERNAL_VIDEO_BOUNDARY_MISSING");

  const limitations = files.get("docs/KNOWN-LIMITATIONS.md") ?? "";
  issue(issues, limitations.includes(release.tag), "LIMITATIONS_CURRENT_RELEASE_MISSING");
  issue(issues, !/The v0\.1 demo/i.test(limitations), "LIMITATIONS_STALE_V01_BINDING_DENIED");
  issue(issues, /not a production deployment or\s+security certification/i.test(limitations), "LIMITATIONS_CERTIFICATION_NONCLAIM_MISSING");

  const contributing = files.get("CONTRIBUTING.md") ?? "";
  issue(issues, /functional product increment/i.test(contributing) && /anonymous public\s+readback/i.test(contributing), "CONTRIBUTING_RELEASE_RULE_MISSING");
  issue(issues, /editorial Daily/i.test(contributing) && /does not gate/i.test(contributing), "EDITORIAL_RELEASE_SEPARATION_MISSING");
  const releaseDocs = files.get("docs/RELEASE-GOVERNANCE.md") ?? "";
  for (const heading of ["Product increments, not calendar identity", "Release-state policy", "Required publication evidence", "Public README and documentation presentation", "Claim/evidence boundary", "Active videos and historical evidence"]) {
    issue(issues, releaseDocs.includes(`## ${heading}`), `GOVERNANCE_SECTION_MISSING:${heading}`);
  }

  const publicManifest = read(root, "release/public-files.manifest");
  const publicPaths = new Set(publicManifest.trim().split("\n").map((line) => line.split("\t")[0]));
  issue(issues, Array.isArray(governance.claimEvidence) && governance.claimEvidence.length > 0, "CLAIM_EVIDENCE_MAPPING_MISSING");
  const expectedComponents = new Set(["Verification Fabric", "Update/Doctor", "HMI/Harness Multitool", "Azure/Entra Identity Contract", "Power Platform Read Connector", "Resource-Plane Profiles M0", "ADD to REPLACE Adaptability Benchmark M0", "Extension Assurance Profiles", "Minimized Agent-Work Event Contract", "AWI-03 Universal Knowledge Envelope", "External Video Service", "Synthetic CPU Video Package Reference", "External SBA-v2 BI Client", "ASF-INTAKE-2 Signal Release Intake", "INT-PROFILE-001 Integration Profiles", "VOICE-M0 Local PTT"]);
  const observedComponents = new Set();
  for (const mapping of governance.claimEvidence ?? []) {
    issue(issues, /^CM-REL-\d{3}$/.test(mapping.claimId ?? ""), `CLAIM_ID_INVALID:${mapping.claimId ?? "missing"}`);
    issue(issues, Array.isArray(mapping.nonClaims) && mapping.nonClaims.length > 0, `NON_CLAIMS_MISSING:${mapping.claimId}`);
    for (const path of mapping.evidencePaths ?? []) {
      try { readFileSync(resolve(root, path)); } catch { issues.push(`CLAIM_EVIDENCE_MISSING:${mapping.claimId}:${path}`); }
    }
    if (mapping.component) {
      observedComponents.add(mapping.component);
      issue(issues, expectedComponents.has(mapping.component), `RELEASE_COMPONENT_UNKNOWN:${mapping.component}`);
      issue(issues, typeof mapping.claim === "string" && typeof mapping.userValue === "string", `COMPONENT_CLAIM_VALUE_MISSING:${mapping.claimId}`);
      issue(issues, Array.isArray(mapping.includedBytes) && mapping.includedBytes.length > 0, `COMPONENT_BYTES_MISSING:${mapping.claimId}`);
      issue(issues, Array.isArray(mapping.functionalProof?.testPaths) && mapping.functionalProof.testPaths.length > 0 && typeof mapping.functionalProof.result === "string", `COMPONENT_FUNCTIONAL_PROOF_MISSING:${mapping.claimId}`);
      issue(issues, Array.isArray(mapping.safetyProof?.testPaths) && mapping.safetyProof.testPaths.length > 0 && typeof mapping.safetyProof.result === "string", `COMPONENT_SAFETY_PROOF_MISSING:${mapping.claimId}`);
      issue(issues, Array.isArray(mapping.traceability?.pdcaPaths) && mapping.traceability.pdcaPaths.length > 0 && mapping.traceability.publicManifest === "release/public-files.manifest" && mapping.traceability.releaseCommitBinding === "currentRelease.tagObjectSha" && mapping.traceability.assetChecksumBinding === "currentRelease.assets[].sha256", `COMPONENT_TRACEABILITY_MISSING:${mapping.claimId}`);
      const publicComponentPaths = [...(mapping.includedBytes ?? []), ...(mapping.functionalProof?.testPaths ?? []), ...(mapping.safetyProof?.testPaths ?? [])];
      for (const path of publicComponentPaths) {
        try { readFileSync(resolve(root, path)); } catch { issues.push(`COMPONENT_PATH_MISSING:${mapping.claimId}:${path}`); }
        issue(issues, publicPaths.has(path), `COMPONENT_PATH_UNMANIFESTED:${mapping.claimId}:${path}`);
      }
      for (const path of mapping.traceability?.pdcaPaths ?? []) {
        try { readFileSync(resolve(root, path)); } catch { issues.push(`COMPONENT_PDCA_PATH_MISSING:${mapping.claimId}:${path}`); }
      }
    }
  }
  for (const component of expectedComponents) issue(issues, observedComponents.has(component), `RELEASE_COMPONENT_EVIDENCE_MISSING:${component}`);
  issue(issues, observedComponents.size === expectedComponents.size, "RELEASE_COMPONENT_EVIDENCE_COUNT_INVALID");

  const assets = release.assets ?? [];
  issue(issues, assets.length > 0 && assets.every((asset) => typeof asset.name === "string" && Number.isInteger(asset.size) && /^[a-f0-9]{64}$/.test(asset.sha256)), "ASSET_INVENTORY_INVALID");
  issue(issues, assets.some((asset) => asset.name === release.assetManifest?.name), "ASSET_MANIFEST_MISSING");
  issue(issues, assets.some((asset) => asset.name === release.assetManifest?.declares), "ASSET_MANIFEST_TARGET_MISSING");

  for (const required of ["README.md", "SECURITY.md", "SUPPORT.md", "CONTRIBUTING.md", "docs/SECURITY-ASSURANCE.md", "docs/KNOWN-LIMITATIONS.md", "docs/RELEASE-GOVERNANCE.md", "release/governance.json"]) {
    issue(issues, publicManifest.split("\n").some((line) => line.startsWith(`${required}\t${required}\t`)), `PUBLIC_MANIFEST_MISSING:${required}`);
  }
  for (const [path, text] of files) issues.push(...scanUnsafe(text, path));

  const generator = read(root, "scripts/daily-poc.mjs");
  issue(issues, !/const releaseTitle\s*=\s*`[^`]*(?:POC Daily|Today's Daily)/i.test(generator), "GENERATOR_CALENDAR_RELEASE_TITLE_DENIED");
  issue(issues, generator.includes("Increment Candidate"), "GENERATOR_FUNCTIONAL_INCREMENT_RULE_MISSING");
  return [...new Set(issues)].sort();
}

async function getJson(url) {
  const response = await fetch(url, { headers: { Accept: "application/vnd.github+json", "User-Agent": "chimpmaera-release-governance" } });
  assert.equal(response.ok, true, `PUBLIC_READBACK_HTTP_${response.status}:${url}`);
  return response.json();
}

export async function verifyPublicReadback(root = process.cwd()) {
  const localIssues = validateRepository(root);
  assert.deepEqual(localIssues, [], localIssues.join("\n"));
  const governance = JSON.parse(read(root, "release/governance.json"));
  const expected = governance.currentRelease;
  const api = `https://api.github.com/repos/${governance.repository}`;
  const [release, latest, tagRef] = await Promise.all([
    getJson(`${api}/releases/tags/${expected.tag}`),
    getJson(`${api}/releases/latest`),
    getJson(`${api}/git/ref/tags/${expected.tag}`)
  ]);
  assert.equal(release.tag_name, expected.tag, "PUBLIC_TAG_MISMATCH");
  assert.equal(release.id, expected.releaseId, "PUBLIC_RELEASE_ID_MISMATCH");
  assert.equal(release.name, expected.title, "PUBLIC_TITLE_MISMATCH");
  assert.equal(release.target_commitish, expected.targetCommitish, "PUBLIC_TARGET_MISMATCH");
  assert.equal(release.draft, expected.draft, "PUBLIC_DRAFT_MISMATCH");
  assert.equal(release.prerelease, expected.prerelease, "PUBLIC_PRERELEASE_MISMATCH");
  assert.equal(release.published_at, expected.publishedAt, "PUBLIC_PUBLISHED_AT_MISMATCH");
  assert.equal(release.html_url, expected.url, "PUBLIC_RELEASE_URL_MISMATCH");
  assert.equal(latest.tag_name, expected.tag, "PUBLIC_LATEST_MISMATCH");
  assert.equal(tagRef.object.sha, expected.tagObjectSha, "PUBLIC_TAG_OBJECT_MUTATED");
  assert.equal(tagRef.object.type, "commit", "PUBLIC_TAG_TYPE_MUTATED");
  assert.ok((release.body ?? "").toLowerCase().includes(expected.increment.toLowerCase()), "PUBLIC_BODY_INCREMENT_MISSING");
  assert.doesNotMatch(release.body ?? "", /POC Daily|Today's Daily|Previous Daily/i, "PUBLIC_BODY_DAILY_IDENTITY_DENIED");

  const actualAssets = [...release.assets].sort((a, b) => a.name.localeCompare(b.name));
  const expectedAssets = [...expected.assets].sort((a, b) => a.name.localeCompare(b.name));
  assert.deepEqual(actualAssets.map(({ name, size }) => ({ name, size })), expectedAssets.map(({ name, size }) => ({ name, size })), "PUBLIC_ASSET_SET_OR_SIZE_MISMATCH");
  const downloaded = new Map();
  for (const asset of actualAssets) {
    const response = await fetch(asset.browser_download_url, { headers: { "User-Agent": "chimpmaera-release-governance" }, redirect: "follow" });
    assert.equal(response.ok, true, `PUBLIC_ASSET_HTTP_${response.status}:${asset.name}`);
    const bytes = Buffer.from(await response.arrayBuffer());
    const wanted = expectedAssets.find((item) => item.name === asset.name);
    assert.equal(bytes.length, wanted.size, `PUBLIC_ASSET_SIZE_MISMATCH:${asset.name}`);
    assert.equal(sha256(bytes), wanted.sha256, `PUBLIC_ASSET_SHA256_MISMATCH:${asset.name}`);
    downloaded.set(asset.name, bytes);
  }
  const declaration = downloaded.get(expected.assetManifest.name).toString("utf8").trim();
  const declaredAsset = expectedAssets.find((asset) => asset.name === expected.assetManifest.declares);
  assert.equal(declaration, `${declaredAsset.sha256}  ${declaredAsset.name}`, "PUBLIC_ASSET_MANIFEST_CONTENT_MISMATCH");

  for (const path of ["README.md", "SECURITY.md", "SUPPORT.md", "docs/SECURITY-ASSURANCE.md", "docs/KNOWN-LIMITATIONS.md"]) {
    const response = await fetch(`https://raw.githubusercontent.com/${governance.repository}/main/${path}`, { headers: { "User-Agent": "chimpmaera-release-governance" } });
    assert.equal(response.ok, true, `PUBLIC_SURFACE_HTTP_${response.status}:${path}`);
    assert.equal(await response.text(), read(root, path), `PUBLIC_SURFACE_MISMATCH:${path}`);
  }
  return {
    tag: expected.tag,
    title: expected.title,
    latest: true,
    draft: false,
    prerelease: false,
    tagObjectSha: expected.tagObjectSha,
    assets: expectedAssets.map(({ name, size, sha256: digest }) => ({ name, size, sha256: digest }))
  };
}

async function main() {
  const publicReadback = process.argv.includes("--public-readback");
  if (process.env.GH_TOKEN && publicReadback) throw new Error("PUBLIC_READBACK_REQUIRES_GH_TOKEN_UNSET");
  if (publicReadback) console.log(JSON.stringify(await verifyPublicReadback(process.cwd()), null, 2));
  else {
    const issues = validateRepository(process.cwd());
    if (issues.length) { console.error(issues.join("\n")); process.exitCode = 2; }
    else console.log("RELEASE_GOVERNANCE_PASS");
  }
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) main().catch((error) => { console.error(error.message); process.exitCode = 2; });
