import { lstat, readFile, realpath } from "node:fs/promises";
import { createHash } from "node:crypto";
import { isAbsolute, relative, resolve, sep } from "node:path";

export const CAPTURE_LIMIT_BYTES = 20 * 1024 * 1024;
export const PARSERS = Object.freeze({
  wikidata: Object.freeze({ id: "wikidata-entity-json-complete", version: "1.0.0" }),
  rst: Object.freeze({ id: "rst-section-preserving", version: "1.0.0" }),
  markdown: Object.freeze({ id: "commonmark-bounded", version: "1.0.0" }),
  identity: Object.freeze({ id: "identity-bytes", version: "1.0.0" }),
});
export const CANONICALIZER = Object.freeze({ id: "rks01-canonical-json", version: "1.0.0" });

const QIDS = ["Q1","Q2","Q405","Q525","Q283","Q629","Q556","Q623","Q7430","Q7868","Q11412","Q2111","Q142","Q183","Q17","Q90","Q64","Q1490","Q12418","Q41567"];
const CPYTHON_PATHS = ["Doc/tutorial/introduction.rst","Doc/tutorial/controlflow.rst","Doc/tutorial/datastructures.rst","Doc/tutorial/modules.rst","Doc/tutorial/inputoutput.rst","Doc/tutorial/errors.rst","Doc/tutorial/classes.rst","Doc/tutorial/stdlib.rst","Doc/tutorial/stdlib2.rst","Doc/tutorial/venv.rst","Doc/reference/lexical_analysis.rst","Doc/reference/expressions.rst","Doc/reference/simple_stmts.rst","Doc/reference/compound_stmts.rst","Doc/reference/datamodel.rst","Doc/library/functions.rst","Doc/library/stdtypes.rst","Doc/library/pathlib.rst","Doc/library/json.rst","Doc/library/sqlite3.rst"];
const CPYTHON_COMMIT = "823f0323ee6ec1402088b73bce1a38473cac36dc";
const OPENAPI_COMMIT = "99710bcb26cbe4be646565eebeb04348f02374b5";
const safeDigest = (bytes) => createHash("sha256").update(bytes).digest("hex");
const canonicalize = (value) => Array.isArray(value) ? value.map(canonicalize) : value && typeof value === "object" ? Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonicalize(value[key])])) : value;
export const canonicalJson = (value) => JSON.stringify(canonicalize(value));
const digestObject = (value) => safeDigest(Buffer.from(canonicalJson(value)));
const fail = (code) => { throw new Error(code); };
const same = (a, b) => canonicalJson(a) === canonicalJson(b);

function expectedKey(source) { return `${source.role}:${source.selector}`; }
function expectedSources() {
  const expected = new Map();
  for (const qid of QIDS) expected.set(`WIKIDATA_ENTITY:${qid}`, { sourceProfile: "wikidata-20-item-revision-set-v1", sourceClass: "WIKIDATA_STRUCTURED", canonicalUrl: `https://www.wikidata.org/entity/${qid}`, parser: PARSERS.wikidata, transformationClass: "TRANSFORM_ALLOWED" });
  for (const path of CPYTHON_PATHS) expected.set(`CPYTHON_DOCUMENT:${path}`, { sourceProfile: "cpython-doc-v3.14.7-v1", sourceClass: "CPYTHON_VERSIONED_DOCS", canonicalUrl: `https://github.com/python/cpython/blob/v3.14.7/${path}`, revision: CPYTHON_COMMIT, parser: PARSERS.rst, transformationClass: "TRANSFORM_ALLOWED" });
  for (const path of ["LICENSE", "Doc/license.rst"]) expected.set(`CPYTHON_OBLIGATION:${path}`, { sourceProfile: "cpython-doc-v3.14.7-v1", sourceClass: "LICENSE_OBLIGATION", canonicalUrl: `https://github.com/python/cpython/blob/v3.14.7/${path}`, revision: CPYTHON_COMMIT, parser: PARSERS.identity, transformationClass: "UNMODIFIED_ONLY" });
  expected.set("OPENAPI_SPEC:versions/3.2.0.md", { sourceProfile: "openapi-spec-v3.2.0-v1", sourceClass: "OPENAPI_NORMATIVE_SPEC", canonicalUrl: "https://spec.openapis.org/oas/v3.2.0.html", revision: OPENAPI_COMMIT, parser: PARSERS.markdown, transformationClass: "TRANSFORM_ALLOWED" });
  for (const path of ["LICENSE"]) expected.set(`OPENAPI_OBLIGATION:${path}`, { sourceProfile: "openapi-spec-v3.2.0-v1", sourceClass: "LICENSE_OBLIGATION", canonicalUrl: `https://github.com/OAI/OpenAPI-Specification/blob/3.2.0/${path}`, revision: OPENAPI_COMMIT, parser: PARSERS.identity, transformationClass: "UNMODIFIED_ONLY" });
  for (const [selector, url, mediaType] of [["rfc9987.xml","https://www.rfc-editor.org/rfc/rfc9987.xml","application/rfc+xml"],["metadata","https://www.rfc-editor.org/info/rfc9987","text/html"],["errata","https://errata.rfc-editor.org/rfc9987","text/html"]]) expected.set(`RFC9987_CONTROL:${selector}`, { sourceProfile: "ietf-rfc9987-archival-control-v1", sourceClass: "RFC9987_UNMODIFIED_CONTROL", canonicalUrl: url, revision: "RFC9987", parser: PARSERS.identity, transformationClass: "UNMODIFIED_ONLY", mediaType });
  return expected;
}

function validateIdentity(source, expected) {
  if (source.canonicalUrl !== expected.canonicalUrl || source.sourceProfile !== expected.sourceProfile || source.sourceClass !== expected.sourceClass) fail("SOURCE_IDENTITY_MISMATCH");
  if (!source.pinnedRequestUrl?.startsWith("https://") || /(?:\/|=)(?:main|master|latest)(?:\/|$|&)/i.test(source.pinnedRequestUrl) || source.immutableIdentity?.kind === "MOVING_ALIAS") fail("MOVING_ONLY_IDENTITY");
  if (expected.revision && source.immutableIdentity?.revision !== expected.revision) fail("SOURCE_IDENTITY_MISMATCH");
  if (source.role === "WIKIDATA_ENTITY") {
    if (!/^\d+$/.test(String(source.immutableIdentity?.revision)) || source.pinnedRequestUrl !== `https://www.wikidata.org/wiki/Special:EntityData/${source.selector}.json?revision=${source.immutableIdentity.revision}`) fail("MOVING_ONLY_IDENTITY");
  }
  if (!same(source.parser, expected.parser)) fail("PARSER_DRIFT");
  if (!same(source.canonicalizer, CANONICALIZER)) fail("CANONICALIZER_DRIFT");
  if (source.transformationClass !== expected.transformationClass) fail("TRANSFORMATION_CLASS_MISMATCH");
  if (!source.license?.id || !source.license.notice || !Array.isArray(source.license.obligations) || source.license.obligations.length === 0) fail("MISSING_LICENSE_OBLIGATIONS");
}

async function safeRead(repoRoot, path) {
  if (typeof path !== "string" || !path || isAbsolute(path) || path.split(/[\\/]/).includes("..")) fail("UNSAFE_SOURCE_PATH");
  const root = await realpath(repoRoot);
  const full = resolve(root, path);
  const rel = relative(root, full);
  if (rel.startsWith(".." + sep) || rel === "..") fail("UNSAFE_SOURCE_PATH");
  const stat = await lstat(full);
  if (stat.isSymbolicLink()) fail("SOURCE_SYMLINK_FORBIDDEN");
  const actual = await realpath(full);
  if (actual !== full) fail("SOURCE_SYMLINK_FORBIDDEN");
  if (!stat.isFile()) fail("SOURCE_NOT_REGULAR_FILE");
  return readFile(full);
}

function sectionRecords(text, syntax) {
  const lines = text.replace(/\r\n/g, "\n").split("\n");
  const sections = [];
  if (syntax === "markdown") {
    for (let index = 0; index < lines.length; index += 1) if (/^#{1,6}\s+/.test(lines[index])) sections.push({ line: index + 1, heading: lines[index].replace(/^#+\s+/, "") });
  } else {
    for (let index = 0; index + 1 < lines.length; index += 1) if (lines[index].trim() && /^[=\-~^"`:+*#<>]{3,}$/.test(lines[index + 1].trim())) sections.push({ line: index + 1, heading: lines[index].trim() });
  }
  return { text, sections };
}

function parseCanonical(source, bytes) {
  const base = { sourceKey: expectedKey(source), sourceClass: source.sourceClass, sourceSha256: source.sha256, selector: source.selector, revision: source.immutableIdentity.revision };
  if (source.role === "WIKIDATA_ENTITY") {
    const parsed = JSON.parse(bytes.toString("utf8"));
    const sourceEntity = parsed.entities?.[source.selector];
    if (!sourceEntity || sourceEntity.id !== source.selector || Number(sourceEntity.lastrevid) !== Number(source.immutableIdentity.revision)) fail("WIKIDATA_REVISION_MISMATCH");
    const entity = structuredClone(sourceEntity);
    for (const statements of Object.values(entity.claims ?? {})) for (const statement of statements) {
      for (const field of ["rank","mainsnak"]) if (!Object.hasOwn(statement, field)) fail("WIKIDATA_STATEMENT_FIELD_LOSS");
      statement.qualifiers ??= {};
      statement.references ??= [];
    }
    return { ...base, entity };
  }
  if (source.transformationClass === "UNMODIFIED_ONLY") return { ...base, identityBytesSha256: source.sha256, byteLength: source.byteLength };
  return { ...base, ...sectionRecords(bytes.toString("utf8"), source.role === "OPENAPI_SPEC" ? "markdown" : "rst") };
}

export async function loadAndVerifyCapture({ repoRoot, manifestPath, manifest, allowManifestDigestMismatch = false } = {}) {
  if (!repoRoot) fail("REPO_ROOT_REQUIRED");
  const value = manifest ?? JSON.parse(await readFile(manifestPath, "utf8"));
  if (value.schemaVersion !== "pansphaira.rks01/source-capture-manifest/v1" || !Array.isArray(value.sources)) fail("CAPTURE_MANIFEST_INVALID");
  const expected = expectedSources();
  if (value.sources.length !== expected.size) fail("EXTRA_OR_DUPLICATE_SOURCE");
  const seen = new Set();
  let totalBytes = 0;
  const sources = [];
  const canonicalRecords = [];
  for (const source of value.sources) {
    const key = expectedKey(source);
    if (seen.has(key) || !expected.has(key)) fail("EXTRA_OR_DUPLICATE_SOURCE");
    seen.add(key); validateIdentity(source, expected.get(key));
    totalBytes += source.byteLength;
    if (totalBytes > CAPTURE_LIMIT_BYTES) fail("CAPTURE_SIZE_LIMIT_EXCEEDED");
    const bytes = await safeRead(repoRoot, source.relativePath);
    const actualSha256 = safeDigest(bytes);
    if (bytes.byteLength !== source.byteLength || actualSha256 !== source.sha256) fail("SOURCE_BYTES_MISMATCH");
    sources.push({ ...structuredClone(source), actualSha256, actualByteLength: bytes.byteLength });
    canonicalRecords.push(parseCanonical(source, bytes));
  }
  if (seen.size !== expected.size) fail("SELECTOR_SET_MISMATCH");
  const unsigned = structuredClone(value); delete unsigned.captureDigest;
  const captureDigest = digestObject(unsigned);
  if (!allowManifestDigestMismatch && value.captureDigest !== captureDigest) fail("CAPTURE_MANIFEST_DIGEST_INVALID");
  const sourceSetDigest = digestObject(value.sources.map(({ role, selector, sha256 }) => ({ role, selector, sha256 })));
  const canonicalRecordsDigest = digestObject(canonicalRecords);
  const counts = { wikidata: sources.filter((s) => s.role === "WIKIDATA_ENTITY").length, cpythonDocuments: sources.filter((s) => s.role === "CPYTHON_DOCUMENT").length, openapiDocuments: sources.filter((s) => s.role === "OPENAPI_SPEC").length, rfcControls: sources.filter((s) => s.role === "RFC9987_CONTROL").length, obligations: sources.filter((s) => s.role.endsWith("OBLIGATION")).length, total: sources.length };
  const receipt = { schemaVersion: "pansphaira.rks01/source-capture-receipt/v1", mode: "OFFLINE_VERIFICATION", outcome: "VERIFIED", captureDigest, sourceSetDigest, canonicalRecordsDigest, counts, totalBytes, networkRequests: 0, nonClaims: ["NO_MODEL_EXECUTION","NO_FINAL_RAW_OR_TYPED_CORPUS","NO_TRUTH_CAPABILITY_OR_AUTHORITY_GRANT"] };
  const receiptBytes = Buffer.from(canonicalJson(receipt) + "\n");
  const historyDigest = digestObject(sources.map(({ actualSha256, actualByteLength, ...source }) => source));
  return { ...receipt, sources, canonicalRecords, digests: { captureDigest, sourceSetDigest, canonicalRecordsDigest, historyDigest, receiptDigest: safeDigest(receiptBytes) }, receiptBytes };
}

export const replayCapture = loadAndVerifyCapture;

export function evaluateDrift(capture, change) {
  const historyDigest = digestObject(capture.sources.map(({ actualSha256, actualByteLength, ...source }) => source));
  if (historyDigest !== capture.digests.historyDigest) throw new Error("SOURCE_HISTORY_MUTATION");
  const source = capture.sources.find((item) => item.role === change.sourceRole);
  if (!source) fail("DRIFT_SOURCE_NOT_FOUND");
  const reasonByKind = { BYTES: "SOURCE_BYTES_CHANGED", REVISION: "SOURCE_REVISION_CHANGED", PARSER: "PARSER_VERSION_CHANGED", LICENSE: "LICENSE_DECISION_CHANGED" };
  if (reasonByKind[change.kind] !== change.reasonCode) fail("DRIFT_CASE_INVALID");
  const observation = { kind: change.kind, sourceKey: expectedKey(source), observedSha256: change.observedSha256, observedRevision: change.observedRevision, observedParser: change.observedParser, observedLicense: change.observedLicense };
  return { outcome: "REVALIDATION_REQUIRED", reasonCodes: [change.reasonCode], priorCaptureDigest: capture.digests.captureDigest, newCaptureDigest: digestObject({ priorCaptureDigest: capture.digests.captureDigest, observation }), historyByteIdentical: true, immutableAction: "CREATE_NEW_CAPTURE_DO_NOT_MUTATE_PRIOR" };
}
