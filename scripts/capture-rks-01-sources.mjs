#!/usr/bin/env node
import { createHash } from "node:crypto";
import { access, mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { CANONICALIZER, CAPTURE_LIMIT_BYTES, PARSERS, canonicalJson, loadAndVerifyCapture } from "../src/rks-01/deterministic-ingestion.mjs";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const manifestPath = resolve(repoRoot, "tests/fixtures/rks-01/source-capture-manifest-v1.json");
const receiptPath = resolve(repoRoot, "verification/rks-01-source-capture-receipt-v1.json");
const snapshotRoot = "tests/fixtures/rks-01/source-snapshots";
const USER_AGENT = "PANSPHAIRA-RKS01-source-capture/1.0 (+https://github.com/JoFe2/PANSPHAIRA/issues/311; bounded research capture)";
const CPYTHON_COMMIT = "823f0323ee6ec1402088b73bce1a38473cac36dc";
const OPENAPI_COMMIT = "99710bcb26cbe4be646565eebeb04348f02374b5";
const QIDS = ["Q1","Q2","Q405","Q525","Q283","Q629","Q556","Q623","Q7430","Q7868","Q11412","Q2111","Q142","Q183","Q17","Q90","Q64","Q1490","Q12418","Q41567"];
const CPYTHON_PATHS = ["Doc/tutorial/introduction.rst","Doc/tutorial/controlflow.rst","Doc/tutorial/datastructures.rst","Doc/tutorial/modules.rst","Doc/tutorial/inputoutput.rst","Doc/tutorial/errors.rst","Doc/tutorial/classes.rst","Doc/tutorial/stdlib.rst","Doc/tutorial/stdlib2.rst","Doc/tutorial/venv.rst","Doc/reference/lexical_analysis.rst","Doc/reference/expressions.rst","Doc/reference/simple_stmts.rst","Doc/reference/compound_stmts.rst","Doc/reference/datamodel.rst","Doc/library/functions.rst","Doc/library/stdtypes.rst","Doc/library/pathlib.rst","Doc/library/json.rst","Doc/library/sqlite3.rst"];
const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");
const sleep = (ms) => new Promise((resolveDelay) => setTimeout(resolveDelay, ms));

async function fetchBounded(url, remainingBytes) {
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const response = await fetch(url, { headers: { "User-Agent": USER_AGENT, Accept: "*/*" }, redirect: "follow" });
    if (response.status === 429 || response.status >= 500) {
      if (attempt === 3) throw new Error(`SOURCE_FETCH_RETRY_EXHAUSTED:${response.status}:${url}`);
      const retryAfter = Number(response.headers.get("retry-after"));
      await sleep(Number.isFinite(retryAfter) ? retryAfter * 1000 : 500 * (2 ** attempt));
      continue;
    }
    if (!response.ok) throw new Error(`SOURCE_FETCH_FAILED:${response.status}:${url}`);
    const declared = Number(response.headers.get("content-length"));
    if (Number.isFinite(declared) && declared > remainingBytes) throw new Error("CAPTURE_SIZE_LIMIT_EXCEEDED");
    const bytes = Buffer.from(await response.arrayBuffer());
    if (bytes.byteLength > remainingBytes) throw new Error("CAPTURE_SIZE_LIMIT_EXCEEDED");
    return { bytes, mediaType: (response.headers.get("content-type") ?? "application/octet-stream").split(";")[0].toLowerCase() };
  }
  throw new Error("SOURCE_FETCH_RETRY_EXHAUSTED");
}

const licenses = {
  wikidata: { id: "CC0-1.0", notice: "STRUCTURED_MAIN_NAMESPACE_DATA_ONLY", attribution: ["Wikidata contributors"], obligations: ["RETAIN_SOURCE_PROVENANCE","RETAIN_REVISION_BINDING"] },
  cpython: { id: "PSF-2.0", notice: "PSF_LICENSE_AND_DOCUMENTATION_NOTICE_RETAINED", attribution: ["Python Software Foundation"], obligations: ["RETAIN_LICENSE","RETAIN_NOTICE","MARK_DERIVATIVE_CHANGES"] },
  openapi: { id: "Apache-2.0", notice: "LICENSE_AND_NOTICE_RETAINED", attribution: ["OpenAPI Initiative"], obligations: ["RETAIN_LICENSE","RETAIN_NOTICE","MARK_CHANGES"] },
  rfc: { id: "IETF-TRUST-DOCUMENT-SPECIFIC", notice: "DOCUMENT_LEGAL_NOTICES_RETAINED", attribution: ["RFC Editor","IETF Trust"], obligations: ["RETAIN_LEGAL_NOTICES","VERBATIM_ONLY","NO_SILENT_ERRATA_INCORPORATION"] },
};

async function captureNetwork() {
  try { await access(manifestPath); throw new Error("IMMUTABLE_CAPTURE_EXISTS_REFUSING_OVERWRITE"); } catch (error) { if (error.code !== "ENOENT") throw error; }
  let total = 0;
  const sources = [];
  async function add(spec) {
    const fetched = await fetchBounded(spec.pinnedRequestUrl, CAPTURE_LIMIT_BYTES - total);
    total += fetched.bytes.byteLength;
    const full = resolve(repoRoot, spec.relativePath);
    await mkdir(dirname(full), { recursive: true });
    await writeFile(full, fetched.bytes, { flag: "wx" });
    sources.push({ ...spec, retrievedAt: new Date().toISOString(), mediaType: spec.mediaType ?? fetched.mediaType, byteLength: fetched.bytes.byteLength, sha256: sha256(fetched.bytes), canonicalizer: CANONICALIZER });
    process.stderr.write(`captured ${spec.role}:${spec.selector} ${fetched.bytes.byteLength}\n`);
  }

  for (const qid of QIDS) {
    const api = `https://www.wikidata.org/w/api.php?action=wbgetentities&ids=${qid}&props=info&format=json&formatversion=2`;
    const resolved = await fetchBounded(api, CAPTURE_LIMIT_BYTES - total);
    const info = JSON.parse(resolved.bytes.toString("utf8")).entities?.[qid];
    if (!Number.isInteger(info?.lastrevid)) throw new Error(`WIKIDATA_REVISION_RESOLUTION_FAILED:${qid}`);
    const revision = String(info.lastrevid);
    await add({ role: "WIKIDATA_ENTITY", selector: qid, sourceProfile: "wikidata-20-item-revision-set-v1", sourceClass: "WIKIDATA_STRUCTURED", canonicalUrl: `https://www.wikidata.org/entity/${qid}`, pinnedRequestUrl: `https://www.wikidata.org/wiki/Special:EntityData/${qid}.json?revision=${revision}`, immutableIdentity: { kind: "ENTITY_REVISION", version: qid, revision }, relativePath: `${snapshotRoot}/wikidata/${qid}-revision-${revision}.json`, parser: PARSERS.wikidata, license: licenses.wikidata, transformationClass: "TRANSFORM_ALLOWED" });
  }
  for (const path of CPYTHON_PATHS) await add({ role: "CPYTHON_DOCUMENT", selector: path, sourceProfile: "cpython-doc-v3.14.7-v1", sourceClass: "CPYTHON_VERSIONED_DOCS", canonicalUrl: `https://github.com/python/cpython/blob/v3.14.7/${path}`, pinnedRequestUrl: `https://raw.githubusercontent.com/python/cpython/${CPYTHON_COMMIT}/${path}`, immutableIdentity: { kind: "TAG_AND_COMMIT", version: "v3.14.7", revision: CPYTHON_COMMIT }, relativePath: `${snapshotRoot}/cpython/${path}`, parser: PARSERS.rst, license: licenses.cpython, transformationClass: "TRANSFORM_ALLOWED", mediaType: "text/x-rst" });
  for (const path of ["LICENSE","Doc/license.rst"]) await add({ role: "CPYTHON_OBLIGATION", selector: path, sourceProfile: "cpython-doc-v3.14.7-v1", sourceClass: "LICENSE_OBLIGATION", canonicalUrl: `https://github.com/python/cpython/blob/v3.14.7/${path}`, pinnedRequestUrl: `https://raw.githubusercontent.com/python/cpython/${CPYTHON_COMMIT}/${path}`, immutableIdentity: { kind: "TAG_AND_COMMIT", version: "v3.14.7", revision: CPYTHON_COMMIT }, relativePath: `${snapshotRoot}/cpython/${path}`, parser: PARSERS.identity, license: licenses.cpython, transformationClass: "UNMODIFIED_ONLY", mediaType: path === "LICENSE" ? "text/plain" : "text/x-rst" });
  await add({ role: "OPENAPI_SPEC", selector: "versions/3.2.0.md", sourceProfile: "openapi-spec-v3.2.0-v1", sourceClass: "OPENAPI_NORMATIVE_SPEC", canonicalUrl: "https://spec.openapis.org/oas/v3.2.0.html", pinnedRequestUrl: `https://raw.githubusercontent.com/OAI/OpenAPI-Specification/${OPENAPI_COMMIT}/versions/3.2.0.md`, immutableIdentity: { kind: "VERSION_AND_COMMIT", version: "3.2.0", revision: OPENAPI_COMMIT }, relativePath: `${snapshotRoot}/openapi/versions/3.2.0.md`, parser: PARSERS.markdown, license: licenses.openapi, transformationClass: "TRANSFORM_ALLOWED", mediaType: "text/markdown" });
  // The pinned repository has no NOTICE file. Apache-2.0 section 4(d)'s
  // NOTICE obligation is recorded as RETAIN_NOTICE_IF_PRESENT; inventing bytes is forbidden.
  for (const path of ["LICENSE"]) await add({ role: "OPENAPI_OBLIGATION", selector: path, sourceProfile: "openapi-spec-v3.2.0-v1", sourceClass: "LICENSE_OBLIGATION", canonicalUrl: `https://github.com/OAI/OpenAPI-Specification/blob/3.2.0/${path}`, pinnedRequestUrl: `https://raw.githubusercontent.com/OAI/OpenAPI-Specification/${OPENAPI_COMMIT}/${path}`, immutableIdentity: { kind: "VERSION_AND_COMMIT", version: "3.2.0", revision: OPENAPI_COMMIT }, relativePath: `${snapshotRoot}/openapi/${path}`, parser: PARSERS.identity, license: { ...licenses.openapi, obligations: ["RETAIN_LICENSE","RETAIN_NOTICE_IF_PRESENT","MARK_CHANGES"] }, transformationClass: "UNMODIFIED_ONLY", mediaType: "text/plain" });
  for (const [selector, url, path, mediaType] of [["rfc9987.xml","https://www.rfc-editor.org/rfc/rfc9987.xml","rfc9987.xml","application/rfc+xml"],["metadata","https://www.rfc-editor.org/info/rfc9987","metadata.html","text/html"],["errata","https://errata.rfc-editor.org/rfc9987","errata.html","text/html"]]) await add({ role: "RFC9987_CONTROL", selector, sourceProfile: "ietf-rfc9987-archival-control-v1", sourceClass: "RFC9987_UNMODIFIED_CONTROL", canonicalUrl: url, pinnedRequestUrl: url, immutableIdentity: { kind: "RFC_NUMBER_AND_CAPTURE_DIGEST", version: "RFC9987", revision: "RFC9987" }, relativePath: `${snapshotRoot}/rfc9987/${path}`, parser: PARSERS.identity, license: licenses.rfc, transformationClass: "UNMODIFIED_ONLY", mediaType });

  const manifest = { schemaVersion: "pansphaira.rks01/source-capture-manifest/v1", captureId: `rks01-${new Date().toISOString()}`, capturePolicy: { explicitNetworkMode: true, sequentialRequests: true, retries: 4, maxTotalBytes: CAPTURE_LIMIT_BYTES, userAgent: USER_AGENT }, sources };
  manifest.captureDigest = sha256(Buffer.from(canonicalJson(manifest)));
  await mkdir(dirname(manifestPath), { recursive: true });
  await writeFile(manifestPath, JSON.stringify(manifest, null, 2) + "\n", { flag: "wx" });
}

async function verifyOffline() {
  const result = await loadAndVerifyCapture({ repoRoot, manifestPath }); // OFFLINE_VERIFICATION: never fetch here.
  await mkdir(dirname(receiptPath), { recursive: true });
  await writeFile(receiptPath, result.receiptBytes);
  process.stdout.write(result.receiptBytes);
}

const args = new Set(process.argv.slice(2));
if (args.has("--network")) {
  if (args.size !== 1) throw new Error("UNKNOWN_CAPTURE_ARGUMENT");
  await captureNetwork();
  await verifyOffline();
} else {
  if (args.size > 0 && !args.has("--verify-offline")) throw new Error("NETWORK_MODE_MUST_BE_EXPLICIT");
  await verifyOffline();
}
