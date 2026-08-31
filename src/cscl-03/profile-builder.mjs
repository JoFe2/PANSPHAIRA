import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import Ajv2020 from "ajv/dist/2020.js";
import addFormats from "ajv-formats";

import { canonicalJson, freezeProtocol, sha256Bytes } from "../cscl-01/protocol.mjs";

export { canonicalJson };
export const CAPTURE_BYTE_CAP = 20 * 1024 * 1024;
const COMMIT = "b24c9eba551905e256e336ff170a91a92d197a2f";
const VERSION = "v16.33.0";
const RAW_PREFIX = `https://raw.githubusercontent.com/frappe/erpnext/${COMMIT}/`;
const SOURCE_PATHS = Object.freeze([
  "license.txt",
  "README.md",
  "erpnext/selling/doctype/customer/customer.json",
  "erpnext/selling/doctype/customer/customer.py",
  "erpnext/stock/doctype/item/item.json",
  "erpnext/stock/doctype/item/item.py",
  "erpnext/selling/doctype/sales_order/sales_order.json",
  "erpnext/selling/doctype/sales_order/sales_order.py",
  "erpnext/selling/doctype/sales_order_item/sales_order_item.json",
]);
const BOUNDARY = Object.freeze({ authorityGrant: "NONE", promotionGrant: "NONE", executionGrant: "NONE" });
const PARSER = Object.freeze({ id: "cscl03-source-native-extractor", version: "1.0.0" });
const CANONICALIZER = Object.freeze({ id: "cscl01-sorted-key-json", version: "1.0.0" });
const LICENSE_SHA = "3972dc9744f6499f0f9b2dbf76696f2ae7ad8af9b23dde66d6af86c9dfb36986";
const README_SHA = "709f84a1d8ef170c362070a80a717cb4a779b66b7202738820d9f836deb42c9a";
const FAMILY_IDS = Object.freeze([
  "PARTY_CUSTOMER_MANAGEMENT",
  "PRODUCT_ITEM_MANAGEMENT",
  "SALES_ORDER_MANAGEMENT",
]);
const QUESTION_IDS = Object.freeze([
  "objects-roles", "relations", "operations", "inputs-outputs", "states-transitions", "events",
  "preconditions", "invariants", "exceptions-errors", "readbacks", "api-service-exposure",
  "absence-ambiguity-conflict",
]);

function digestRecord(value, digestField) {
  const copy = structuredClone(value);
  delete copy[digestField];
  return sha256Bytes(Buffer.from(canonicalJson(copy)));
}

async function readJson(path) {
  return JSON.parse(await readFile(path, "utf8"));
}

function snapshotPath(path) {
  return `source-snapshots/${path}.b64`;
}

function legalRecord() {
  return {
    licenseId: "GPL-3.0-only",
    licenseSha256: LICENSE_SHA,
    obligations: [
      "PRESERVE_LICENSE_AND_COPYRIGHT_NOTICES",
      "LICENSE_COVERED_DERIVATIVES_UNDER_GPL",
      "PROVIDE_CORRESPONDING_SOURCE_WHEN_CONVEYING",
      "MARK_MODIFICATIONS",
    ],
    noticeStatus: "ABSENT_AT_PIN",
    attribution: [{
      kind: "PROJECT_METADATA",
      url: `${RAW_PREFIX}README.md`,
      byteLength: 6791,
      sha256: README_SHA,
    }],
  };
}

export async function captureErpnextSources({ fixtureRoot, allowNetwork = false, fetchImpl = globalThis.fetch }) {
  if (!allowNetwork) throw new Error("EXPLICIT_NETWORK_CAPTURE_REQUIRED");
  if (typeof fetchImpl !== "function") throw new Error("NETWORK_FETCH_UNAVAILABLE");
  const sources = [];
  let totalDecodedBytes = 0;
  for (const path of SOURCE_PATHS) {
    const url = `${RAW_PREFIX}${path}`;
    const response = await fetchImpl(url, { redirect: "error" });
    if (!response.ok || response.url !== url) throw new Error(`OFFICIAL_SOURCE_CAPTURE_FAILED:${path}:${response.status}`);
    const bytes = Buffer.from(await response.arrayBuffer());
    totalDecodedBytes += bytes.length;
    if (totalDecodedBytes > CAPTURE_BYTE_CAP) throw new Error("CAPTURE_DECODED_BYTE_CAP_EXCEEDED");
    const snapshot = snapshotPath(path);
    await mkdir(dirname(resolve(fixtureRoot, snapshot)), { recursive: true });
    await writeFile(resolve(fixtureRoot, snapshot), `${bytes.toString("base64")}\n`);
    sources.push({ path, url, snapshot, byteLength: bytes.length, sha256: sha256Bytes(bytes) });
  }
  const license = sources.find((source) => source.path === "license.txt");
  const readme = sources.find((source) => source.path === "README.md");
  if (license.byteLength !== 35149 || license.sha256 !== LICENSE_SHA || readme.byteLength !== 6791 || readme.sha256 !== README_SHA) {
    throw new Error("LEGAL_IDENTITY_DRIFT");
  }
  const manifest = {
    schemaVersion: "pansphaira.cscl03/source-capture-manifest/v1",
    identity: {
      systemId: "erpnext",
      version: VERSION,
      selector: "refs/tags/v16.33.0",
      commit: COMMIT,
      officialRepository: "https://github.com/frappe/erpnext.git",
    },
    legal: { licenseId: "GPL-3.0-only", licensePath: "license.txt", licenseBytes: 35149, licenseSha256: LICENSE_SHA, projectMetadataPath: "README.md", projectMetadataBytes: 6791, projectMetadataSha256: README_SHA },
    parser: PARSER,
    canonicalizer: CANONICALIZER,
    transport: "BASE64_OF_EXACT_RAW_BYTES",
    networkPolicy: "EXPLICIT_CAPTURE_ONLY_OFFLINE_BUILD_DEFAULT",
    decodedByteCap: CAPTURE_BYTE_CAP,
    totalDecodedBytes,
    sources,
  };
  await writeFile(resolve(fixtureRoot, "source-capture-manifest-v1.json"), `${JSON.stringify(manifest, null, 2)}\n`);
  return manifest;
}

function decodeCanonicalBase64(text) {
  const encoded = text.endsWith("\n") ? text.slice(0, -1) : text;
  if (!encoded || /\s/.test(encoded) || !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(encoded)) {
    throw new Error("NON_CANONICAL_BASE64");
  }
  const bytes = Buffer.from(encoded, "base64");
  if (bytes.toString("base64") !== encoded) throw new Error("NON_CANONICAL_BASE64");
  return bytes;
}

async function loadCapture(fixtureRoot) {
  const manifest = await readJson(resolve(fixtureRoot, "source-capture-manifest-v1.json"));
  if (canonicalJson(manifest.identity) !== canonicalJson({ systemId: "erpnext", version: VERSION, selector: "refs/tags/v16.33.0", commit: COMMIT, officialRepository: "https://github.com/frappe/erpnext.git" })) throw new Error("IMMUTABLE_IDENTITY_DRIFT");
  if (canonicalJson(manifest.legal) !== canonicalJson({ licenseId: "GPL-3.0-only", licensePath: "license.txt", licenseBytes: 35149, licenseSha256: LICENSE_SHA, projectMetadataPath: "README.md", projectMetadataBytes: 6791, projectMetadataSha256: README_SHA })) throw new Error("LEGAL_IDENTITY_DRIFT");
  if (canonicalJson(manifest.parser) !== canonicalJson(PARSER)) throw new Error("PARSER_IDENTITY_DRIFT");
  if (canonicalJson(manifest.canonicalizer) !== canonicalJson(CANONICALIZER)) throw new Error("CANONICALIZER_IDENTITY_DRIFT");
  if (manifest.transport !== "BASE64_OF_EXACT_RAW_BYTES" || manifest.networkPolicy !== "EXPLICIT_CAPTURE_ONLY_OFFLINE_BUILD_DEFAULT" || manifest.decodedByteCap !== CAPTURE_BYTE_CAP) throw new Error("CAPTURE_POLICY_DRIFT");
  if (canonicalJson(manifest.sources.map((source) => source.path)) !== canonicalJson(SOURCE_PATHS)) throw new Error("SOURCE_PATH_SET_DRIFT");
  const bytesByPath = new Map();
  let total = 0;
  for (const source of manifest.sources) {
    if (source.url !== `${RAW_PREFIX}${source.path}` || source.snapshot !== snapshotPath(source.path)) throw new Error("IMMUTABLE_SOURCE_URL_REQUIRED");
    const bytes = decodeCanonicalBase64(await readFile(resolve(fixtureRoot, source.snapshot), "utf8"));
    if (bytes.length !== source.byteLength || sha256Bytes(bytes) !== source.sha256) throw new Error("SOURCE_BYTES_MISMATCH");
    if (source.path.endsWith(".json")) JSON.parse(bytes.toString("utf8"));
    bytesByPath.set(source.path, bytes);
    total += bytes.length;
  }
  if (total !== manifest.totalDecodedBytes || total > CAPTURE_BYTE_CAP) throw new Error("CAPTURE_DECODED_BYTE_CAP_EXCEEDED");
  if (manifest.sources.find((x) => x.path === "license.txt")?.sha256 !== LICENSE_SHA || manifest.sources.find((x) => x.path === "README.md")?.sha256 !== README_SHA) throw new Error("LEGAL_SOURCE_PAIR_DRIFT");
  return { manifest, bytesByPath };
}

function locateExcerpt(bytes, source, spec) {
  const startNeedle = Buffer.from(spec.start, "utf8");
  const endNeedle = Buffer.from(spec.end, "utf8");
  const start = bytes.indexOf(startNeedle);
  if (start < 0) throw new Error(`EVIDENCE_START_NOT_FOUND:${spec.family}:${spec.questionId}`);
  if (bytes.indexOf(startNeedle, start + 1) >= 0 && spec.uniqueStart !== false) throw new Error(`EVIDENCE_START_AMBIGUOUS:${spec.family}:${spec.questionId}`);
  const endStart = bytes.indexOf(endNeedle, start + startNeedle.length);
  if (endStart < 0) throw new Error(`EVIDENCE_END_NOT_FOUND:${spec.family}:${spec.questionId}`);
  const end = endStart + endNeedle.length;
  const excerpt = bytes.subarray(start, end);
  return { start, end, excerpt, locator: `${source.url}#bytes=${start}-${end - 1}` };
}

async function validators(repoRoot) {
  const ajv = new Ajv2020({ allErrors: true, strict: true, allowUnionTypes: true });
  addFormats(ajv);
  const entries = await Promise.all([
    ["fact", "contracts/cscl-01/source-fact-v1.schema.json"],
    ["cell", "contracts/cscl-01/evidence-cell-v1.schema.json"],
    ["profile", "contracts/cscl-01/system-profile-v1.schema.json"],
  ].map(async ([name, path]) => [name, ajv.compile(await readJson(resolve(repoRoot, path)))]));
  return Object.fromEntries(entries);
}

export async function buildErpnextProfile({ repoRoot, fixtureRoot }) {
  const protocol = await freezeProtocol({ repoRoot });
  const { manifest, bytesByPath } = await loadCapture(fixtureRoot);
  const spec = await readJson(resolve(fixtureRoot, "source-native-evidence-spec-v1.json"));
  if (spec.schemaVersion !== "pansphaira.cscl03/source-native-evidence-spec/v1" || canonicalJson(spec.families) !== canonicalJson(FAMILY_IDS) || spec.cells.length !== 36) throw new Error("EVIDENCE_SPEC_DENOMINATOR_DRIFT");
  const keys = spec.cells.map((cell) => `${cell.family}:${cell.questionId}`);
  const expectedKeys = FAMILY_IDS.flatMap((family) => QUESTION_IDS.map((questionId) => `${family}:${questionId}`));
  if (new Set(keys).size !== 36 || canonicalJson(keys) !== canonicalJson(expectedKeys)) throw new Error("EVIDENCE_SPEC_CELL_SET_DRIFT");
  const sourceFacts = [];
  const evidenceCells = [];
  const factByKey = new Map();
  for (const cellSpec of spec.cells) {
    const source = manifest.sources.find((entry) => entry.path === cellSpec.path);
    if (!source) throw new Error("EVIDENCE_SOURCE_PATH_NOT_CAPTURED");
    const found = locateExcerpt(bytesByPath.get(cellSpec.path), source, cellSpec);
    const slug = `${cellSpec.family.toLowerCase().replaceAll("_", "-")}.${cellSpec.questionId}`;
    const fact = {
      schemaVersion: "pansphaira.cscl01/source-fact/v1",
      factId: `erpnext.${slug}`,
      systemId: "erpnext",
      systemRole: "TRAINING",
      capabilityFamily: cellSpec.family,
      questionId: cellSpec.questionId,
      claim: cellSpec.claim,
      sourceIdentity: { selectorSetDigest: protocol.digests.selectors, immutableSelector: source.url, sourceBytesSha256: source.sha256 },
      exactEvidence: { exactLocator: found.locator, excerptSha256: sha256Bytes(found.excerpt), byteStart: found.start, byteEnd: found.end },
      legal: legalRecord(),
      parser: PARSER,
      canonicalizer: CANONICALIZER,
      boundary: BOUNDARY,
      factDigest: "",
    };
    fact.factDigest = digestRecord(fact, "factDigest");
    const nativeMeaningSha256 = sha256Bytes(Buffer.from(cellSpec.claim));
    const cell = {
      schemaVersion: "pansphaira.cscl01/evidence-cell/v1",
      systemId: "erpnext",
      questionId: cellSpec.questionId,
      state: cellSpec.state,
      equivalenceProof: {
        nativeMeaningSha256,
        candidateMeaningSha256: sha256Bytes(Buffer.from("NO_CANDIDATE_MEANING_EXISTS_IN_CSCL_03")),
      },
      evidence: [{ sourceFactId: fact.factId, exactLocator: found.locator, excerptSha256: fact.exactEvidence.excerptSha256 }],
      counterexamples: cellSpec.counterexamples,
      boundary: BOUNDARY,
    };
    sourceFacts.push(fact);
    evidenceCells.push(cell);
    factByKey.set(`${cellSpec.family}:${cellSpec.questionId}`, fact);
  }
  const profile = {
    schemaVersion: "pansphaira.cscl01/system-profile/v1",
    profileId: "erpnext.v16.33.0.source-native-profile",
    systemId: "erpnext",
    systemRole: "TRAINING",
    selectorSetDigest: protocol.digests.selectors,
    questionInventoryDigest: protocol.digests.questions,
    sourceFactDigests: sourceFacts.map((fact) => fact.factDigest),
    sourceNativeTerminology: spec.terminology.map((entry) => ({ term: entry.term, meaning: entry.meaning, sourceFactDigest: factByKey.get(entry.sourceFactKey)?.factDigest })),
    capabilityFamilies: FAMILY_IDS,
    evidenceCells: evidenceCells.map((cell, index) => ({ capabilityFamily: spec.cells[index].family, questionId: cell.questionId, cellDigest: sha256Bytes(Buffer.from(canonicalJson(cell))) })),
    holdoutIsolation: "TRAINING_PROFILE",
    boundary: BOUNDARY,
    profileDigest: "",
  };
  if (profile.sourceNativeTerminology.some((entry) => !entry.sourceFactDigest)) throw new Error("TERMINOLOGY_SOURCE_FACT_MISSING");
  profile.profileDigest = digestRecord(profile, "profileDigest");
  const bundle = {
    schemaVersion: "pansphaira.cscl03/erpnext-profile-bundle/v1",
    protocolBindings: { selectorSetDigest: protocol.digests.selectors, questionInventoryDigest: protocol.digests.questions, freezeDigest: protocol.digest },
    captureManifestDigest: sha256Bytes(Buffer.from(canonicalJson(manifest))),
    sourceFacts,
    evidenceCells,
    systemProfile: profile,
    nonClaims: [
      "NO_CROSS_SYSTEM_CONCEPT_DERIVATION",
      "NO_COMMON_CORE_OR_CANDIDATE_CLASSIFICATION",
      "NO_HOLDOUT_SEMANTICS_INSPECTED",
      "NO_AUTHORITY_PROMOTION_OR_EXECUTION_GRANT",
      "NO_COMPLETE_ERPNext_PRODUCT_COVERAGE_CLAIM",
    ],
    boundary: BOUNDARY,
  };
  const validate = await validators(repoRoot);
  if (sourceFacts.some((fact) => !validate.fact(fact)) || evidenceCells.some((cell) => !validate.cell(cell)) || !validate.profile(profile)) throw new Error("BUILDER_SCHEMA_INVALID");
  const bytes = Buffer.from(canonicalJson(bundle));
  return { bundle, bytes, digest: sha256Bytes(bytes) };
}

export async function verifyErpnextProfileBundle(bundle, { repoRoot, fixtureRoot }) {
  const reasons = [];
  try {
    const trusted = await buildErpnextProfile({ repoRoot, fixtureRoot });
    const validate = await validators(repoRoot);
    if (!bundle || Object.keys(bundle).some((key) => !Object.hasOwn(trusted.bundle, key)) || (bundle.sourceFacts ?? []).some((fact) => !validate.fact(fact)) || (bundle.evidenceCells ?? []).some((cell) => !validate.cell(cell)) || !validate.profile(bundle.systemProfile)) reasons.push("SCHEMA_INVALID");
    if (bundle?.sourceFacts?.length !== 36 || bundle?.systemProfile?.sourceFactDigests?.length !== 36) reasons.push("FACT_DENOMINATOR_MISMATCH");
    if (bundle?.evidenceCells?.length !== 36 || bundle?.systemProfile?.evidenceCells?.length !== 36) reasons.push("CELL_DENOMINATOR_MISMATCH");
    if (canonicalJson(bundle?.systemProfile?.sourceNativeTerminology) !== canonicalJson(trusted.bundle.systemProfile.sourceNativeTerminology)) reasons.push("SOURCE_NATIVE_TERMINOLOGY_DRIFT");
    for (const fact of bundle?.sourceFacts ?? []) if (digestRecord(fact, "factDigest") !== fact.factDigest) reasons.push("FACT_DIGEST_MISMATCH");
    if (bundle?.systemProfile && digestRecord(bundle.systemProfile, "profileDigest") !== bundle.systemProfile.profileDigest) reasons.push("PROFILE_DIGEST_MISMATCH");
    const suppliedCells = bundle?.evidenceCells ?? [];
    for (let index = 0; index < suppliedCells.length; index += 1) {
      const cell = suppliedCells[index];
      const reference = bundle?.systemProfile?.evidenceCells?.[index];
      const fact = bundle?.sourceFacts?.find((candidate) => candidate.factId === cell.evidence?.[0]?.sourceFactId);
      if (!reference || reference.cellDigest !== sha256Bytes(Buffer.from(canonicalJson(cell))) || !fact || fact.factDigest !== bundle.systemProfile.sourceFactDigests[index] || cell.evidence[0].exactLocator !== fact.exactEvidence.exactLocator || cell.evidence[0].excerptSha256 !== fact.exactEvidence.excerptSha256) reasons.push("PAIRED_REFERENCE_MISMATCH");
    }
    if (canonicalJson(bundle) !== canonicalJson(trusted.bundle)) reasons.push("TRUSTED_PROFILE_BYTES_MISMATCH");
    const unique = [...new Set(reasons)];
    if (unique.length) return { outcome: "DENIED", reasonCodes: unique };
    return { outcome: "VERIFIED", reasonCodes: ["ERPNext_V16_33_0_SOURCE_NATIVE_PROFILE_VERIFIED"], bundleDigest: trusted.digest };
  } catch (error) {
    return { outcome: "DENIED", reasonCodes: [error.message] };
  }
}
