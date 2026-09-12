#!/usr/bin/env node
// CSCL-11 iDempiere source-locator verification (AC2 provenance boundary).
//
// Re-fetches the 16 pinned iDempiere raw URLs at the immutable commit recorded
// in src/cscl-11/holdout-facts.mjs (pinned 731515dc..., refs/heads/release-13)
// and records, per file, the HTTP status, the sha256 of the response body and
// its byte length. The source governance gate (src/cscl-11/holdout-gate.mjs)
// fails closed unless every locator resolves (HTTP 200) at the pinned commit
// with a digest equal to the AC2 source-capture receipt's whole-file sha256.
//
// This is the correction for the CSCL-11 AC2 provenance-boundary blocker: the
// original capture receipt recorded overview.html at a dead locator (HTTP 404
// at the pin) while the gate only validated digests/byte lengths. The gate now
// requires this committed fetch evidence; any non-200 status or digest
// mismatch exits non-zero, so the producer cannot emit a conforming artifact
// over a dead locator.
//
// Usage:
//   node scripts/capture-cscl-11-source-locators.mjs --network   # bounded read-only fetch sweep
//   node scripts/capture-cscl-11-source-locators.mjs --verify    # offline: re-validate the committed artifact (no network)
//
// No push, no API mutation, no credentials: GET of public raw URLs at an
// immutable commit only. Redirects are denied (a redirect is not the pinned byte).

import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { canonicalJson, sha256Bytes } from "../src/cscl-01/protocol.mjs";
import { COMMIT, FILES, RAW_BASE } from "../src/cscl-11/holdout-gate.mjs";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const artifactPath = resolve(repoRoot, "verification", "cscl-11-idempiere-source-locator-verification-v1.json");
const USER_AGENT = "PANSPHAIRA-CSCL11-source-locator-verification/1.0 (+https://github.com/JoFe2/PANSPHAIRA/issues/328; bounded provenance re-sweep at pinned commit)";

function artifactBody(entries) {
  const resolved = entries.filter((e) => e.httpStatus === 200).length;
  return {
    schemaVersion: "pansphaira.cscl11/idempiere-source-locator-verification/v1",
    receiptId: "cscl-11-idempiere-source-locator-verification-v1",
    systemId: "idempiere",
    systemRole: "HOLDOUT",
    resolvedCommit: COMMIT,
    rawBase: RAW_BASE,
    method: "HTTP GET of each rawUrl at the pinned immutable commit (redirects denied); recorded HTTP status, sha256 and byte length of the response body",
    resolvedCount: resolved,
    unresolved: entries.filter((e) => e.httpStatus !== 200).map((e) => e.name),
    entries,
    note: "Provenance re-sweep for the AC2 source-capture receipt: every rawUrl must resolve (HTTP 200) at the pinned commit with a digest equal to the capture receipt's whole-file sha256. The source governance gate fails closed on any non-200 status, digest or length mismatch (no dead locators).",
    boundary: { authorityGrant: "NONE", promotionGrant: "NONE", executionGrant: "NONE" },
  };
}

async function fetchSweep() {
  const entries = [];
  for (const f of FILES) {
    const rawUrl = `${RAW_BASE}/${f.path}`;
    let httpStatus = 0;
    let bytes = Buffer.alloc(0);
    try {
      const response = await fetch(rawUrl, { headers: { "User-Agent": USER_AGENT }, redirect: "error" });
      bytes = Buffer.from(await response.arrayBuffer());
      httpStatus = response.status;
    } catch {
      httpStatus = 0; // transport failure is recorded as unresolved, never invented
    }
    entries.push({ name: f.name, path: f.path, rawUrl, httpStatus, contentSha256: sha256Bytes(bytes), byteLength: bytes.length });
  }
  const mismatches = entries.filter((e) => {
    const f = FILES.find((x) => x.name === e.name);
    return e.httpStatus !== 200 || e.contentSha256 !== f.sha256 || e.byteLength !== f.byteLength;
  });
  if (mismatches.length > 0) {
    process.stderr.write(`LOCATOR_SWEEP_FAILED:${mismatches.map((e) => `${e.name}:${e.httpStatus}`).join(",")}\n`);
    process.exit(1);
  }
  const body = artifactBody(entries);
  const artifact = { ...body, receiptDigest: sha256Bytes(Buffer.from(canonicalJson(body))) };
  await mkdir(dirname(artifactPath), { recursive: true });
  await writeFile(artifactPath, `${JSON.stringify(artifact, null, 2)}\n`);
  process.stdout.write(`${JSON.stringify({ ok: true, resolved: artifact.resolvedCount, total: FILES.length, artifact: "verification/cscl-11-idempiere-source-locator-verification-v1.json", receiptDigest: artifact.receiptDigest }, null, 2)}\n`);
}

async function verifyOffline() {
  const { readFileSync } = await import("node:fs");
  const { validateSourceLocator } = await import("../src/cscl-11/holdout-gate.mjs");
  const result = validateSourceLocator(JSON.parse(readFileSync(artifactPath, "utf8")));
  if (!result.ok) {
    process.stderr.write(`LOCATOR_VERIFICATION_FAILED:${result.errors.join(",")}\n`);
    process.exit(1);
  }
  process.stdout.write(`${JSON.stringify({ ok: true, mode: "verify-offline", artifact: "verification/cscl-11-idempiere-source-locator-verification-v1.json" }, null, 2)}\n`);
}

const args = new Set(process.argv.slice(2));
if (args.has("--network")) {
  if (args.size !== 1) process.exit(99);
  await fetchSweep();
} else if (args.has("--verify")) {
  if (args.size !== 1) process.exit(99);
  await verifyOffline();
} else {
  process.stderr.write("usage: node scripts/capture-cscl-11-source-locators.mjs --network | --verify\n");
  process.exit(2);
}