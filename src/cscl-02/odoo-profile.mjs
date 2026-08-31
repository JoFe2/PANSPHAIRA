import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";

export const PARSER = Object.freeze({ id: "cscl02-odoo-source-parser", version: "1.0.0" });
export const CANONICALIZER = Object.freeze({ id: "cscl02-canonical-json", version: "1.0.0" });

const COMMIT = "1eb4fcdf08ddbc1341bdc8cb8129906722f54bdc";
const REPOSITORY = "https://github.com/odoo/odoo.git";
const RAW_ROOT = `https://raw.githubusercontent.com/odoo/odoo/${COMMIT}/`;
const SELECTOR_DIGEST = "ea6029f3691b5e4ac635945541a2680b9c81eaefb712c3c936dc33fbbe724afc";
const QUESTION_DIGEST = "842527ddfdc7fb706b2fd0af798be286c03aa85b37152a011a8f0affff331c28";
const CELL_SPECS_SHA256 = "5d2d17b582d20c1426422d7639a4e4db2a75355021d1af711b1bc82edb97ebac";
const CAP_BYTES = 20 * 1024 * 1024;
const BOUNDARY = Object.freeze({ authorityGrant: "NONE", promotionGrant: "NONE", executionGrant: "NONE" });
const FAMILIES = Object.freeze(["PARTY_CUSTOMER_MANAGEMENT", "PRODUCT_ITEM_MANAGEMENT", "SALES_ORDER_MANAGEMENT"]);
const QUESTIONS = Object.freeze(["objects-roles", "relations", "operations", "inputs-outputs", "states-transitions", "events", "preconditions", "invariants", "exceptions-errors", "readbacks", "api-service-exposure", "absence-ambiguity-conflict"]);
const SPEC_KEYS = Object.freeze(["anchor", "claim", "counterexamples", "family", "path", "questionId", "state", "terminology"]);
const BUNDLE_KEYS = Object.freeze(["canonicalizer", "captureMode", "commit", "files", "license", "parser", "repository", "schemaVersion", "selector", "selectorSetDigest", "systemId", "version"]);
const BUNDLE_LICENSE_KEYS = Object.freeze(["licenseId", "licensePath", "licenseSha256", "noticePath", "noticeSha256", "obligations"]);
const ALLOWED_STATES = new Set(["SUPPORTED", "VARIANT", "ABSENT", "AMBIGUOUS", "CONFLICTING", "UNMAPPED"]);
const EXPECTED_FILES = Object.freeze({
  "LICENSE": [43529, "abc09dad5f84a76e1b0279237053cae16c03228ab27d8d467677054c2bd17eeb"],
  "COPYRIGHT": [433, "86e49232d2162708d05405ed5ff6dc5594b73ef4b0f25d2749cfae13493b620c"],
  "odoo/addons/base/models/res_partner.py": [62587, "222b47cea098f83ff4f84dd27f1e9ec7ce4caeb63e24a67e0b9bc59f099e7bb4"],
  "addons/product/models/product_template.py": [74183, "a6a814f94a7f7d19b32fc8b4b6e2f52769c3b1d40602346126e55398f75768d4"],
  "addons/product/models/product_product.py": [57669, "8c881754357e3a11a594b0d798a1bd9dd3e7b0321575a1624c743719ecd7fc69"],
  "addons/sale/models/sale_order.py": [100444, "14ccc1baa548ba20332ef7ed17c517fd92bf67e897fbe00556b417c2aa47bc0e"],
});
const LICENSE = Object.freeze({
  licenseId: "LGPL-3.0-only",
  licenseSha256: EXPECTED_FILES.LICENSE[1],
  obligations: ["PRESERVE_LICENSE_AND_COPYRIGHT_NOTICES", "PROVIDE_CORRESPONDING_SOURCE_WHEN_CONVEYING_COVERED_CODE", "MARK_MODIFICATIONS", "RETAIN_THIRD_PARTY_LICENSES"],
  noticeStatus: "PRESENT",
  noticeUrl: `${RAW_ROOT}COPYRIGHT`,
  noticeBytes: EXPECTED_FILES.COPYRIGHT[0],
  noticeSha256: EXPECTED_FILES.COPYRIGHT[1],
  attribution: [],
});

function canonical(value) {
  if (value === null || typeof value === "string" || typeof value === "boolean") return JSON.stringify(value);
  if (typeof value === "number" && Number.isFinite(value)) return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (typeof value === "object" && Object.getPrototypeOf(value) === Object.prototype) {
    return `{${Object.keys(value).sort().map(k => `${JSON.stringify(k)}:${canonical(value[k])}`).join(",")}}`;
  }
  throw new Error("DENIED_UNSAFE_CANONICAL_VALUE");
}

function sha(bytes) { return createHash("sha256").update(bytes).digest("hex"); }
function digestRecord(record, field) {
  const copy = structuredClone(record);
  delete copy[field];
  return sha(Buffer.from(canonical(copy)));
}
function deny(condition, code) { if (condition) throw new Error(`DENIED_${code}`); }
function same(a, b) { return canonical(a) === canonical(b); }

export function verifySourceBundle(bundle) {
  deny(!bundle || typeof bundle !== "object", "BUNDLE_INVALID");
  deny(!same(Object.keys(bundle).sort(), BUNDLE_KEYS), "BUNDLE_HIDDEN_FIELD_INVALID");
  deny(!bundle.license || !same(Object.keys(bundle.license).sort(), BUNDLE_LICENSE_KEYS), "LEGAL_FIELD_INVALID");
  deny(bundle.schemaVersion !== "pansphaira.cscl02/official-source-bundle/v1", "BUNDLE_SCHEMA_DRIFT");
  deny(bundle.systemId !== "odoo-community" || bundle.repository !== REPOSITORY, "OFFICIAL_REPOSITORY_DRIFT");
  deny(bundle.version !== "19.0" || bundle.selector !== "refs/heads/19.0", "VERSION_SELECTOR_DRIFT");
  deny(bundle.commit !== COMMIT || !/^[a-f0-9]{40}$/.test(bundle.commit), "IMMUTABLE_COMMIT_INVALID");
  deny(bundle.selectorSetDigest !== SELECTOR_DIGEST, "SELECTOR_DIGEST_DRIFT");
  deny(bundle.captureMode !== "EXPLICIT_NETWORK", "CAPTURE_MODE_DRIFT");
  deny(!same(bundle.parser, PARSER), "PARSER_DRIFT");
  deny(!same(bundle.canonicalizer, CANONICALIZER), "CANONICALIZER_DRIFT");
  deny(bundle.license?.licenseId !== "LGPL-3.0-only", "LICENSE_ID_DRIFT");
  deny(bundle.license?.licensePath !== "LICENSE" || bundle.license?.noticePath !== "COPYRIGHT", "LEGAL_PATH_DRIFT");
  deny(bundle.license?.licenseSha256 !== EXPECTED_FILES.LICENSE[1] || bundle.license?.noticeSha256 !== EXPECTED_FILES.COPYRIGHT[1], "LEGAL_DIGEST_DRIFT");
  deny(!same(bundle.license?.obligations, LICENSE.obligations), "LEGAL_OBLIGATION_DRIFT");
  deny(!Array.isArray(bundle.files), "SOURCE_FILE_SET_MISMATCH");
  deny(bundle.files.reduce((total, file) => total + (Number.isInteger(file?.rawLength) ? file.rawLength : 0), 0) > CAP_BYTES, "DECLARED_20MIB_CAP_EXCEEDED");
  deny(bundle.files.length !== Object.keys(EXPECTED_FILES).length, "SOURCE_FILE_SET_MISMATCH");
  const seen = new Set();
  let decodedTotal = 0;
  const decoded = new Map();
  for (const file of bundle.files) {
    deny(!file || Object.keys(file).sort().join() !== "base64,path,rawLength,sha256,url", "SOURCE_FILE_FIELD_INVALID");
    deny(seen.has(file.path) || !Object.hasOwn(EXPECTED_FILES, file.path), "SOURCE_PATH_FORBIDDEN");
    seen.add(file.path);
    const [length, expectedSha] = EXPECTED_FILES[file.path];
    deny(file.url !== `${RAW_ROOT}${file.path}`, "IMMUTABLE_OFFICIAL_URL_MISMATCH");
    deny(file.rawLength !== length || file.sha256 !== expectedSha, "SOURCE_IDENTITY_MISMATCH");
    const bytes = Buffer.from(file.base64, "base64");
    deny(bytes.toString("base64") !== file.base64, "BASE64_INVALID");
    deny(bytes.length !== file.rawLength || sha(bytes) !== file.sha256, "SOURCE_BYTES_MISMATCH");
    decodedTotal += bytes.length;
    decoded.set(file.path, bytes);
  }
  deny(decodedTotal > CAP_BYTES, "DECODED_20MIB_CAP_EXCEEDED");
  return { commit: COMMIT, decodedTotal, decoded };
}

export async function captureOfficialSources({ network = false, paths = Object.keys(EXPECTED_FILES), fetchImpl = globalThis.fetch } = {}) {
  deny(network !== true, "EXPLICIT_NETWORK_MODE_REQUIRED");
  deny(!Array.isArray(paths) || paths.some(path => !Object.hasOwn(EXPECTED_FILES, path)), "SOURCE_PATH_FORBIDDEN");
  const files = [];
  for (const path of paths) {
    const url = `${RAW_ROOT}${path}`;
    const response = await fetchImpl(url);
    deny(!response.ok, "OFFICIAL_FETCH_FAILED");
    const bytes = Buffer.from(await response.arrayBuffer());
    files.push({ path, url, rawLength: bytes.length, sha256: sha(bytes), base64: bytes.toString("base64") });
  }
  const bundle = {
    schemaVersion: "pansphaira.cscl02/official-source-bundle/v1", systemId: "odoo-community",
    repository: REPOSITORY, version: "19.0", selector: "refs/heads/19.0", commit: COMMIT,
    selectorSetDigest: SELECTOR_DIGEST, captureMode: "EXPLICIT_NETWORK",
    license: { licenseId: LICENSE.licenseId, licensePath: "LICENSE", licenseSha256: LICENSE.licenseSha256, noticePath: "COPYRIGHT", noticeSha256: LICENSE.noticeSha256, obligations: LICENSE.obligations },
    parser: PARSER, canonicalizer: CANONICALIZER, files,
  };
  if (paths.length === Object.keys(EXPECTED_FILES).length) verifySourceBundle(bundle);
  return bundle;
}

function validateSpecs(specs, decoded) {
  deny(specs?.schemaVersion !== "pansphaira.cscl02/cell-specs/v1" || !Array.isArray(specs.cells), "SPEC_SCHEMA_DRIFT");
  deny(specs.cells.length !== 36, "MISSING_FAMILY_QUESTION_CELL");
  const pairs = new Set();
  for (const spec of specs.cells) {
    deny(!same(Object.keys(spec).sort(), SPEC_KEYS), "SPEC_HIDDEN_FIELD");
    deny(!FAMILIES.includes(spec.family) || !QUESTIONS.includes(spec.questionId), "MISSING_FAMILY_QUESTION_CELL");
    const pair = `${spec.family}/${spec.questionId}`;
    deny(pairs.has(pair), "DUPLICATE_FAMILY_QUESTION_CELL");
    pairs.add(pair);
    deny(!ALLOWED_STATES.has(spec.state), "EVIDENCE_STATE_INVALID");
    deny(typeof spec.claim !== "string" || spec.claim.length === 0 || /common[- ]core|capability candidate|authority grant|party\/customer|product\/item/i.test(spec.claim), "CALLER_NORMALIZED_TERMINOLOGY");
    deny(!Array.isArray(spec.counterexamples) || !Array.isArray(spec.terminology) || spec.terminology.length === 0, "SPEC_FIELD_INVALID");
    deny(["ABSENT", "CONFLICTING"].includes(spec.state) && spec.counterexamples.length === 0, "NEGATIVE_EVIDENCE_INCOMPLETE");
    const source = decoded.get(spec.path);
    deny(!source, "SOURCE_PATH_FORBIDDEN");
    const anchor = Buffer.from(spec.anchor);
    const start = source.indexOf(anchor);
    deny(start < 0 || source.indexOf(anchor, start + 1) >= 0, "EXACT_LOCATOR_MISSING_OR_AMBIGUOUS");
  }
  for (const family of FAMILIES) for (const question of QUESTIONS) deny(!pairs.has(`${family}/${question}`), "MISSING_FAMILY_QUESTION_CELL");
}

export async function buildOfflineProfile({ bundlePath, specsPath }) {
  const bundle = JSON.parse(await readFile(bundlePath, "utf8"));
  const { decoded } = verifySourceBundle(bundle);
  const specsBytes = await readFile(specsPath);
  deny(sha(specsBytes) !== CELL_SPECS_SHA256, "CELL_SPECS_DIGEST_MISMATCH");
  const specs = JSON.parse(specsBytes.toString("utf8"));
  validateSpecs(specs, decoded);
  const byPath = new Map(bundle.files.map(file => [file.path, file]));
  const sourceFacts = [];
  const cells = [];
  const evidenceCells = [];
  const terminology = new Map();
  for (const spec of specs.cells) {
    const source = decoded.get(spec.path);
    const excerpt = Buffer.from(spec.anchor);
    const start = source.indexOf(excerpt);
    const excerptSha256 = sha(excerpt);
    const slug = `${spec.family.toLowerCase().replaceAll("_", "-")}.${spec.questionId}`;
    const fact = {
      schemaVersion: "pansphaira.cscl01/source-fact/v1", factId: `odoo.${slug}`,
      systemId: "odoo-community", systemRole: "TRAINING", capabilityFamily: spec.family,
      questionId: spec.questionId, claim: spec.claim,
      sourceIdentity: { selectorSetDigest: SELECTOR_DIGEST, immutableSelector: COMMIT, sourceBytesSha256: byPath.get(spec.path).sha256 },
      exactEvidence: { exactLocator: `${byPath.get(spec.path).url}#bytes=${start}-${start + excerpt.length}`, excerptSha256, byteStart: start, byteEnd: start + excerpt.length },
      legal: LICENSE, parser: PARSER, canonicalizer: CANONICALIZER, boundary: BOUNDARY,
    };
    fact.factDigest = digestRecord(fact, "factDigest");
    sourceFacts.push(fact);
    const meaning = sha(Buffer.from(spec.claim));
    const cell = {
      schemaVersion: "pansphaira.cscl01/evidence-cell/v1", systemId: "odoo-community", questionId: spec.questionId,
      state: spec.state,
      equivalenceProof: { nativeMeaningSha256: meaning, candidateMeaningSha256: sha(Buffer.from("NO_CANDIDATE_DERIVED_IN_CSCL_02")) },
      evidence: [{ sourceFactId: fact.factId, exactLocator: fact.exactEvidence.exactLocator, excerptSha256 }],
      counterexamples: spec.counterexamples, boundary: BOUNDARY,
    };
    const cellDigest = sha(Buffer.from(canonical(cell)));
    cells.push(cell);
    evidenceCells.push({ capabilityFamily: spec.family, questionId: spec.questionId, cellDigest });
    for (const term of spec.terminology) if (!terminology.has(term)) terminology.set(term, { term, meaning: `Odoo-native term evidenced in: ${spec.claim}`, sourceFactDigest: fact.factDigest });
  }
  const profile = {
    schemaVersion: "pansphaira.cscl01/system-profile/v1", profileId: "odoo-community.19.0.three-family-profile",
    systemId: "odoo-community", systemRole: "TRAINING", selectorSetDigest: SELECTOR_DIGEST,
    questionInventoryDigest: QUESTION_DIGEST, sourceFactDigests: sourceFacts.map(f => f.factDigest),
    sourceNativeTerminology: [...terminology.values()], capabilityFamilies: [...FAMILIES], evidenceCells,
    holdoutIsolation: "TRAINING_PROFILE", boundary: BOUNDARY,
  };
  profile.profileDigest = digestRecord(profile, "profileDigest");
  const artifact = { sourceFacts, cells, profile };
  const bytes = Buffer.from(canonical(artifact));
  return { ...artifact, bytes, digest: sha(bytes) };
}
