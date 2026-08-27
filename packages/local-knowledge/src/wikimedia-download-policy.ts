import { createHash } from "node:crypto";
import { lstatSync, realpathSync, statSync } from "node:fs";
import path from "node:path";

// PSAI107-QWEN-05 (PSAI107-QWEN-05-OPTIN-DOWNLOAD-POLICY).
//
// Official-URL/checksum policy core for the disabled-by-default opt-in
// Wikimedia dump harness. This module is policy-only: it validates closed
// grammars for the ADR-approved official metadata, the required identifying
// User-Agent, bounded connection/rate behavior and the owned mount boundary.
// It performs no network I/O and reads no corpus; the ADR
// (ADR-PSAI107-WIKIMEDIA-M0-01) remains in force and this harness is its
// offline, fake-transport companion: no real downloader, no live scraping,
// no implicit download, no hidden online fallback.
export const WIKIMEDIA_DOWNLOAD_POLICY_VERSION_V1 =
  "chimpmaera.knowledge/wikimedia-optin-download-policy/v1" as const;
export const WIKIMEDIA_DOWNLOAD_ADR_ID_V1 = "ADR-PSAI107-WIKIMEDIA-M0-01" as const;
export const WIKIMEDIA_OFFICIAL_DOWNLOAD_HOST_V1 = "dumps.wikimedia.org" as const;
export const WIKIMEDIA_DOWNLOAD_BOUNDARY_V1 =
  "OFFLINE_FAKE_TRANSPORT_OPTIN_ONLY_NO_REAL_NETWORK_IO_NO_BUNDLED_CORPUS_NO_HIDDEN_ONLINE_FALLBACK" as const;

// Bounded connection and rate behavior. maximumSourceBytes is bound to the
// approved ADR m0Bounds (MWXML-M0-R012).
export const WIKIMEDIA_DOWNLOAD_TRANSPORT_BOUNDS_V1 = {
  maximumConcurrentConnections: 1,
  maximumRequestsPerSession: 2,
  minimumRequestIntervalMs: 1_000,
  maximumSourceBytes: 8_388_608,
} as const;

// Required identifying User-Agent (Wikimedia download policy): product with
// version plus a descriptive token, and it must identify PanSphaira/PSAI107.
export const IDENTIFYING_USER_AGENT_V1 =
  "PanSphaira-PSAI107-OptinPolicyHarness/1.0.0 (offline-fake-transport; no-network-io)" as const;

export const POLICY_EVIDENCE_UNAVAILABLE = "POLICY_EVIDENCE_UNAVAILABLE" as const;
export const POLICY_EVIDENCE_MALFORMED = "POLICY_EVIDENCE_MALFORMED" as const;
export const POLICY_EVIDENCE_HOST_MISMATCH = "POLICY_EVIDENCE_HOST_MISMATCH" as const;
export const POLICY_EVIDENCE_BOUND_MISMATCH = "POLICY_EVIDENCE_BOUND_MISMATCH" as const;
export const POLICY_EVIDENCE_DUPLICATE_ENTRY = "POLICY_EVIDENCE_DUPLICATE_ENTRY" as const;
export const POLICY_EVIDENCE_NO_ENTRIES = "POLICY_EVIDENCE_NO_ENTRIES" as const;
export const POLICY_EVIDENCE_BYTE_SIZE_OUT_OF_BOUNDS =
  "POLICY_EVIDENCE_BYTE_SIZE_OUT_OF_BOUNDS" as const;
export const POLICY_EVIDENCE_SIZE_EXCEEDED = "POLICY_EVIDENCE_SIZE_EXCEEDED" as const;

export type PolicyEvidenceCode =
  | typeof POLICY_EVIDENCE_UNAVAILABLE
  | typeof POLICY_EVIDENCE_MALFORMED
  | typeof POLICY_EVIDENCE_HOST_MISMATCH
  | typeof POLICY_EVIDENCE_BOUND_MISMATCH
  | typeof POLICY_EVIDENCE_DUPLICATE_ENTRY
  | typeof POLICY_EVIDENCE_NO_ENTRIES
  | typeof POLICY_EVIDENCE_BYTE_SIZE_OUT_OF_BOUNDS
  | typeof POLICY_EVIDENCE_SIZE_EXCEEDED;

export interface WikimediaOfficialChecksumEntryV1 {
  readonly filename: string;
  readonly sha256: string;
  readonly byteSize: number;
}

export interface WikimediaDownloadPolicyEvidenceV1 {
  readonly schemaVersion: typeof WIKIMEDIA_DOWNLOAD_POLICY_VERSION_V1;
  readonly host: typeof WIKIMEDIA_OFFICIAL_DOWNLOAD_HOST_V1;
  readonly maximumSourceBytes: (typeof WIKIMEDIA_DOWNLOAD_TRANSPORT_BOUNDS_V1)["maximumSourceBytes"];
  readonly entries: readonly WikimediaOfficialChecksumEntryV1[];
  readonly entryByFilename: ReadonlyMap<string, WikimediaOfficialChecksumEntryV1>;
}

export type PolicyEvidenceParseResult =
  | { readonly ok: true; readonly evidence: WikimediaDownloadPolicyEvidenceV1 }
  | { readonly ok: false; readonly code: PolicyEvidenceCode };

const MAX_EVIDENCE_LINES = 32;
const MAX_EVIDENCE_ENTRIES = 16;
const MAX_EVIDENCE_CHARS = 16_384;

// Closed line grammars. Entry: "sha256 <64-lowercase-hex> <byteCount 1..9999999> <filename>".
const ENTRY_GRAMMAR = /^sha256 ([0-9a-f]{64}) ([1-9][0-9]{0,6}) ([a-z0-9][a-z0-9.-]{0,126}\.gz)$/;
// Official Wikimedia dumps layout: /wikipedia/<lang>[/<variant>]/<YYYYMMDD>/<artifact>.gz
const OFFICIAL_PATH_GRAMMAR =
  /^\/wikipedia\/[a-z]{2,3}(\/[a-z]{2,8})?\/[0-9]{8}\/([a-z0-9][a-z0-9.-]{0,126}\.gz)$/;
const USER_AGENT_GRAMMAR = /^[A-Za-z][A-Za-z0-9._-]*\/[0-9]+\.[0-9]+\.[0-9]+( \([^()]{1,200}\))?$/;
const HOST_DIRECTIVE = `# host ${WIKIMEDIA_OFFICIAL_DOWNLOAD_HOST_V1}`;
const BOUND_DIRECTIVE = `# maximumSourceBytes ${WIKIMEDIA_DOWNLOAD_TRANSPORT_BOUNDS_V1.maximumSourceBytes}`;

export function parseWikimediaDownloadPolicyEvidence(raw: string): PolicyEvidenceParseResult {
  if (typeof raw !== "string" || raw.length === 0) {
    return { ok: false, code: POLICY_EVIDENCE_UNAVAILABLE };
  }
  if (!raw.endsWith("\n") || raw.endsWith("\n\n")) {
    return { ok: false, code: POLICY_EVIDENCE_MALFORMED };
  }
  if (raw.length > MAX_EVIDENCE_CHARS) {
    return { ok: false, code: POLICY_EVIDENCE_SIZE_EXCEEDED };
  }
  // Exactly one trailing newline terminates the file; any other blank or
  // non-ASCII line is malformed.
  const text = raw.endsWith("\n") ? raw.slice(0, -1) : raw;
  const lines = text.split("\n");
  if (lines.length > MAX_EVIDENCE_LINES) {
    return { ok: false, code: POLICY_EVIDENCE_SIZE_EXCEEDED };
  }
  let hostSeen = false;
  let boundSeen = false;
  const entries: WikimediaOfficialChecksumEntryV1[] = [];
  const byFilename = new Map<string, WikimediaOfficialChecksumEntryV1>();
  for (const line of lines) {
    if (line.length === 0 || /[^\x20-\x7e]/.test(line)) {
      return { ok: false, code: POLICY_EVIDENCE_MALFORMED };
    }
    if (line.startsWith("#")) {
      if (line === HOST_DIRECTIVE) {
        if (hostSeen) {
          return { ok: false, code: POLICY_EVIDENCE_MALFORMED };
        }
        hostSeen = true;
      } else if (line === BOUND_DIRECTIVE) {
        if (boundSeen) {
          return { ok: false, code: POLICY_EVIDENCE_MALFORMED };
        }
        boundSeen = true;
      } else if (line.length < 2) {
        return { ok: false, code: POLICY_EVIDENCE_MALFORMED };
      } else {
        return { ok: false, code: POLICY_EVIDENCE_MALFORMED };
      }
      continue;
    }
    const matched = ENTRY_GRAMMAR.exec(line);
    if (matched === null) {
      return { ok: false, code: POLICY_EVIDENCE_MALFORMED };
    }
    const digest = matched[1];
    const byteSizeText = matched[2];
    const filename = matched[3];
    if (digest === undefined || byteSizeText === undefined || filename === undefined) {
      return { ok: false, code: POLICY_EVIDENCE_MALFORMED };
    }
    const byteSize = Number(byteSizeText);
    if (byteSize < 1 || byteSize > WIKIMEDIA_DOWNLOAD_TRANSPORT_BOUNDS_V1.maximumSourceBytes) {
      return { ok: false, code: POLICY_EVIDENCE_BYTE_SIZE_OUT_OF_BOUNDS };
    }
    if (byFilename.has(filename)) {
      return { ok: false, code: POLICY_EVIDENCE_DUPLICATE_ENTRY };
    }
    const entry: WikimediaOfficialChecksumEntryV1 = { filename, sha256: digest, byteSize };
    entries.push(entry);
    byFilename.set(filename, entry);
  }
  if (!hostSeen) {
    return { ok: false, code: POLICY_EVIDENCE_HOST_MISMATCH };
  }
  if (!boundSeen) {
    return { ok: false, code: POLICY_EVIDENCE_BOUND_MISMATCH };
  }
  if (entries.length === 0) {
    return { ok: false, code: POLICY_EVIDENCE_NO_ENTRIES };
  }
  if (entries.length > MAX_EVIDENCE_ENTRIES) {
    return { ok: false, code: POLICY_EVIDENCE_SIZE_EXCEEDED };
  }
  return {
    ok: true,
    evidence: {
      schemaVersion: WIKIMEDIA_DOWNLOAD_POLICY_VERSION_V1,
      host: WIKIMEDIA_OFFICIAL_DOWNLOAD_HOST_V1,
      maximumSourceBytes: WIKIMEDIA_DOWNLOAD_TRANSPORT_BOUNDS_V1.maximumSourceBytes,
      entries,
      entryByFilename: byFilename,
    },
  };
}

export interface OfficialDownloadUrlV1 {
  readonly host: string;
  readonly pathname: string;
  readonly filename: string;
}

export type OfficialDownloadUrlResult =
  | { readonly ok: true; readonly url: OfficialDownloadUrlV1 }
  | { readonly ok: false };

// Fail-closed official URL gate: https-only, exactly the approved official
// host, no port/userinfo/query/fragment, and the official dumps path layout.
export function parseOfficialDownloadUrl(rawUrl: string): OfficialDownloadUrlResult {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    return { ok: false };
  }
  if (parsed.protocol !== "https:") {
    return { ok: false };
  }
  if (parsed.hostname !== WIKIMEDIA_OFFICIAL_DOWNLOAD_HOST_V1) {
    return { ok: false };
  }
  if (
    parsed.port !== "" ||
    parsed.username !== "" ||
    parsed.password !== "" ||
    parsed.search !== "" ||
    parsed.hash !== ""
  ) {
    return { ok: false };
  }
  const matched = OFFICIAL_PATH_GRAMMAR.exec(parsed.pathname);
  if (matched === null) {
    return { ok: false };
  }
  const filename = matched[2];
  if (filename === undefined) {
    return { ok: false };
  }
  return { ok: true, url: { host: parsed.hostname, pathname: parsed.pathname, filename } };
}

// The request must identify the client per Wikimedia download policy.
export function validateIdentifyingUserAgent(userAgent: string): boolean {
  if (typeof userAgent !== "string" || userAgent.length < 8 || userAgent.length > 256) {
    return false;
  }
  if (!USER_AGENT_GRAMMAR.test(userAgent)) {
    return false;
  }
  if (!userAgent.includes("PanSphaira") || !userAgent.includes("PSAI107")) {
    return false;
  }
  return true;
}

export const DESTINATION_OUTSIDE_OWNED_MOUNT = "DESTINATION_OUTSIDE_OWNED_MOUNT" as const;

export type OwnedMountDestinationResult =
  | { readonly ok: true; readonly destination: string }
  | { readonly ok: false; readonly code: typeof DESTINATION_OUTSIDE_OWNED_MOUNT };

// The mounted candidate must resolve inside the owned mount root (symlinks
// resolved), must not traverse, and its basename must be the official entry
// filename.
export function resolveOwnedMountDestination(
  mountRoot: string,
  destination: string,
  filename: string,
): OwnedMountDestinationResult {
  const outside = (): OwnedMountDestinationResult => ({ ok: false, code: DESTINATION_OUTSIDE_OWNED_MOUNT });
  if (destination.split(/[\\/]/).includes("..")) {
    return outside();
  }
  const rawDestination = path.resolve(destination);
  const base = path.basename(rawDestination);
  if (base !== filename) {
    return outside();
  }
  try {
    const rootReal = realpathSync(path.resolve(mountRoot));
    if (!statSync(rootReal).isDirectory()) {
      return outside();
    }
    const parentReal = realpathSync(path.dirname(rawDestination));
    const relative = path.relative(rootReal, parentReal);
    if (relative === ".." || relative.startsWith(`..${path.sep}`)) {
      return outside();
    }
    try {
      if (lstatSync(rawDestination).isSymbolicLink()) {
        return outside();
      }
    } catch (error) {
      if (
        typeof error !== "object" ||
        error === null ||
        !("code" in error) ||
        error.code !== "ENOENT"
      ) {
        return outside();
      }
    }
    return { ok: true, destination: path.join(parentReal, base) };
  } catch {
    return outside();
  }
}

export function sha256Hex(bytes: Uint8Array): string {
  return createHash("sha256").update(bytes).digest("hex");
}