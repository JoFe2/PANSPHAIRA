#!/bin/sh
set -eu

SOURCE_ROOT="${WIKI_SOURCE_ROOT:-/mnt/source}"
CANONICAL_ROOT="${WIKI_CANONICAL_ROOT:-/var/lib/local-knowledge-wiki/canonical}"
INDEX_ROOT="${WIKI_INDEX_ROOT:-/var/lib/local-knowledge-wiki/index}"
PROFILE_NAME="${WIKI_PROFILE:-positive}"
BUILD_IMAGE_DIGEST="${WIKI_BUILD_IMAGE_DIGEST:-}"

fail() {
  printf '%s\n' "LOCAL_KNOWLEDGE_WIKI_DENIED:$1" >&2
  exit 64
}

case "${1:-}" in
  import|serve|query|help) ;;
  '') fail "EXPLICIT_COMMAND_REQUIRED" ;;
  *) fail "COMMAND_NOT_ALLOWED:$1" ;;
esac

if [ "${1:-}" = "help" ]; then
  cat <<'HELP'
local-knowledge-wiki commands:
  import  Import the read-only mounted mini-dump into the canonical lifecycle and index volumes.
  serve   Import (if needed) and run the local read-only HTTP query service.
  query   Query an already imported lifecycle; arguments: QUERY [RANKING] [MAX_RESULTS].

This image has no download command and never performs network I/O. Select the
local-knowledge-wiki Docker Compose profile explicitly.
HELP
  exit 0
fi

if [ -n "${WIKI_DOWNLOAD_URL:-}" ]; then
  fail "DOWNLOAD_ENV_REQUIRES_EXPLICIT_OPT_IN_COMMAND"
fi

exec node --input-type=module - "$@" <<'NODE'
import { createServer } from "node:http";
import { constants, existsSync, accessSync, lstatSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import path from "node:path";
import { canonicalJson } from "/app/dist/packages/contracts/src/canonical-json.js";
import {
  importMediaWikiMiniDumpEditionV1,
} from "/app/dist/packages/contracts/src/mediawiki-mini-dump.js";
import {
  activateMediaWikiEditionV1,
  initializeMediaWikiEditionLifecycleV1,
  readMediaWikiEditionLifecycleV1,
  validateMediaWikiEditionActiveIndexV1,
} from "/app/dist/packages/contracts/src/mediawiki-edition-lifecycle.js";
import { queryMediaWikiReadonlyV1 } from "/app/dist/packages/local-knowledge/src/mediawiki-readonly-query.js";

const sourceRoot = path.resolve(process.env.WIKI_SOURCE_ROOT ?? "/mnt/source");
const canonicalRoot = path.resolve(process.env.WIKI_CANONICAL_ROOT ?? "/var/lib/local-knowledge-wiki/canonical");
const indexRoot = path.resolve(process.env.WIKI_INDEX_ROOT ?? "/var/lib/local-knowledge-wiki/index");
const profileName = process.env.WIKI_PROFILE ?? "positive";
const buildImageDigest = process.env.WIKI_BUILD_IMAGE_DIGEST ?? "";
const lifecycleRoot = path.join(canonicalRoot, "lifecycle");
const runtimeManifestPath = path.join(canonicalRoot, "edition-manifest.json");
const externalIndexPath = path.join(indexRoot, "active-index.json");
const command = process.argv[2];
const args = process.argv.slice(3);

function deny(reason) {
  throw new Error(`LOCAL_KNOWLEDGE_WIKI_DENIED:${reason}`);
}

function regularFile(location, reason) {
  let stat;
  try { stat = lstatSync(location); } catch { deny(reason); }
  if (!stat.isFile() || stat.isSymbolicLink()) deny(reason);
}

function ensureReadOnlySourceMount() {
  let stat;
  try { stat = lstatSync(sourceRoot); } catch { deny("SOURCE_MOUNT_MISSING"); }
  if (!stat.isDirectory() || stat.isSymbolicLink()) deny("SOURCE_MOUNT_DENIED");
  const mountLine = readFileSync("/proc/self/mountinfo", "utf8").split("\n").find((line) => {
    const fields = line.split(" ");
    return fields[4]?.replaceAll("\\040", " ") === sourceRoot;
  });
  const mountOptions = mountLine?.split(" - ")[0]?.split(" ")[5] ?? "";
  if (!mountOptions.split(",").includes("ro")) deny("SOURCE_MOUNT_MUST_BE_READ_ONLY");
  try { accessSync(sourceRoot, constants.R_OK); } catch { deny("SOURCE_MOUNT_NOT_READABLE"); }
}

function readProfile() {
  const manifestPath = path.join(sourceRoot, "manifest.json");
  regularFile(manifestPath, "SOURCE_MANIFEST_MISSING");
  let manifest;
  try { manifest = JSON.parse(readFileSync(manifestPath, "utf8")); } catch { deny("SOURCE_MANIFEST_INVALID"); }
  const profile = manifest?.profiles?.[profileName];
  if (profile === undefined) deny("PROFILE_MISSING");
  return profile;
}

function writeCanonical(location, value) {
  const parent = path.dirname(location);
  mkdirSync(parent, { recursive: true });
  if (existsSync(location)) regularFile(location, "OUTPUT_SYMLINK_DENIED");
  const temporary = `${location}.tmp`;
  if (existsSync(temporary)) deny("OUTPUT_TEMP_RESIDUE");
  writeFileSync(temporary, canonicalJson(value), { encoding: "utf8", flag: "wx" });
  renameSync(temporary, location);
}

function emitRuntimeEditionManifest(state) {
  if (!buildImageDigest) deny("BUILD_IMAGE_DIGEST_MISSING");
  const edition = state.manifest.edition;
  const runtimeManifest = {
    schemaVersion: "chimpmaera.knowledge/local-knowledge-wiki-runtime-edition-manifest/v1",
    editionDigest: edition.editionDigest,
    project: edition.project,
    snapshotDate: edition.dump.snapshotDate,
    sourceDigest: edition.rawTransport.sourceChecksum,
    contentDigest: edition.contentDigest,
    parserVersion: edition.provenance.parserVersion,
    canonicalizerVersion: edition.provenance.canonicalizerVersion,
    buildImageDigest,
  };
  writeCanonical(runtimeManifestPath, runtimeManifest);
  process.stdout.write(`EDITION_MANIFEST ${canonicalJson(runtimeManifest)}\n`);
}

function publishExternalIndex(state) {
  mkdirSync(indexRoot, { recursive: true });
  writeCanonical(externalIndexPath, state.index);
}

function importMountedDump() {
  ensureReadOnlySourceMount();
  const profile = readProfile();
  const edition = importMediaWikiMiniDumpEditionV1(sourceRoot, profile);
  mkdirSync(lifecycleRoot, { recursive: true });
  let state;
  if (!existsSync(path.join(lifecycleRoot, "active-index.json"))) {
    state = initializeMediaWikiEditionLifecycleV1(lifecycleRoot, edition);
  } else {
    state = readMediaWikiEditionLifecycleV1(lifecycleRoot);
    if (state.index.activeEditionDigest !== edition.editionDigest) {
      const result = activateMediaWikiEditionV1(lifecycleRoot, {
        edition,
        parentEditionDigest: state.index.activeEditionDigest,
      });
      if (result.outcome !== "ACTIVATED") deny(`EDITION_ACTIVATION:${result.reason}`);
      state = readMediaWikiEditionLifecycleV1(lifecycleRoot);
    }
  }
  publishExternalIndex(state);
  emitRuntimeEditionManifest(state);
  return state;
}

function readPublishedState() {
  const state = readMediaWikiEditionLifecycleV1(lifecycleRoot);
  regularFile(externalIndexPath, "EXTERNAL_INDEX_MISSING");
  let externalIndex;
  try { externalIndex = JSON.parse(readFileSync(externalIndexPath, "utf8")); } catch { deny("EXTERNAL_INDEX_INVALID"); }
  if (!validateMediaWikiEditionActiveIndexV1(externalIndex)
    || externalIndex.indexDigest !== state.index.indexDigest
    || canonicalJson(externalIndex) !== readFileSync(externalIndexPath, "utf8")) {
    deny("EXTERNAL_INDEX_DRIFT");
  }
  return state;
}

function requestFromArgs() {
  const query = args[0] ?? "synthetic article";
  const ranking = args[1] ?? "LOCAL_HYBRID";
  const maxResults = args[2] === undefined ? 20 : Number(args[2]);
  return { query, ranking, maxResults };
}

function runQuery(request) {
  const state = readPublishedState();
  return queryMediaWikiReadonlyV1({
    active: {
      edition: state.manifest.edition,
      state: "ACTIVE",
      epistemicStatus: "SUPPORTED",
      freshnessState: "CURRENT",
    },
    selected: [],
  }, request);
}

async function readBody(request) {
  let body = "";
  for await (const chunk of request) {
    body += chunk;
    if (Buffer.byteLength(body, "utf8") > 65536) deny("QUERY_BODY_TOO_LARGE");
  }
  try { return JSON.parse(body); } catch { deny("QUERY_JSON_INVALID"); }
}

function respond(response, status, value) {
  const body = JSON.stringify(value);
  response.writeHead(status, { "content-type": "application/json", "content-length": Buffer.byteLength(body) });
  response.end(body);
}

async function serve() {
  importMountedDump();
  const server = createServer(async (request, response) => {
    try {
      const url = new URL(request.url ?? "/", "http://localhost");
      if (request.method === "GET" && url.pathname === "/health") {
        respond(response, 200, { ok: true, network: "DISABLED", readOnly: true });
        return;
      }
      if (request.method === "POST" && url.pathname === "/query") {
        const receipt = runQuery(await readBody(request));
        respond(response, 200, receipt);
        return;
      }
      if (url.pathname === "/query" || url.pathname.startsWith("/write") || url.pathname.startsWith("/admin")) {
        respond(response, 405, { error: "READ_ONLY_QUERY_ONLY" });
        return;
      }
      respond(response, 404, { error: "NOT_FOUND" });
    } catch (error) {
      respond(response, 400, { error: error instanceof Error ? error.message : "QUERY_DENIED" });
    }
  });
  server.listen(8787, "127.0.0.1", () => {
    process.stdout.write("LOCAL_KNOWLEDGE_WIKI_READY 127.0.0.1:8787 network=DISABLED readOnly=true\n");
  });
}

try {
  if (command === "import") {
    importMountedDump();
  } else if (command === "query") {
    process.stdout.write(`${JSON.stringify(runQuery(requestFromArgs()))}\n`);
  } else if (command === "serve") {
    await serve();
  } else {
    deny("EXPLICIT_COMMAND_REQUIRED");
  }
} catch (error) {
  process.stderr.write(`${error instanceof Error ? error.message : "LOCAL_KNOWLEDGE_WIKI_DENIED"}\n`);
  process.exitCode = 64;
}
NODE
