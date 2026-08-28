import { readFileSync, renameSync, rmSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";
import {
  DESTINATION_OUTSIDE_OWNED_MOUNT,
  WIKIMEDIA_DOWNLOAD_TRANSPORT_BOUNDS_V1,
  checksumEntryMatchesOfficialUrl,
  parseOfficialDownloadUrl,
  parseWikimediaDownloadPolicyEvidence,
  resolveOwnedMountDestination,
  sha256Hex,
  validateIdentifyingUserAgent,
} from "./wikimedia-download-policy.js";
import type { WikimediaDownloadPolicyEvidenceV1 } from "./wikimedia-download-policy.js";

// PSAI107-QWEN-05 (PSAI107-QWEN-05-OPTIN-DOWNLOAD-POLICY).
//
// Disabled-by-default opt-in Wikimedia dump harness with a fully offline
// fake transport. It performs NO real network I/O: the caller injects a
// FakeTransportV1 that models official response metadata, and the harness
// proves the opt-in policy end-to-end — explicit opt-in, ADR-approved
// official URL/checksum metadata only, required identifying User-Agent,
// bounded connection/rate behavior, byte-size plus declared-digest
// verification, and atomic exposure of a mounted candidate file inside the
// owned mount. Every gate is fail-closed and denies before bytes become
// usable when violated. The ADR (ADR-PSAI107-WIKIMEDIA-M0-01) remains in
// force: no real downloader, no live scraping, no implicit download, no
// hidden online fallback, no bundled corpus.
export const OPTIN_MISSING = "OPTIN_MISSING" as const;
export const NON_OFFICIAL_URL = "NON_OFFICIAL_URL" as const;
export const REDIRECT_ESCAPE = "REDIRECT_ESCAPE" as const;
export const CHECKSUM_NOT_DECLARED = "CHECKSUM_NOT_DECLARED" as const;
export const CHECKSUM_MISMATCH = "CHECKSUM_MISMATCH" as const;
export const UNEXPECTED_BYTE_COUNT = "UNEXPECTED_BYTE_COUNT" as const;
export const UNEXPECTED_TRANSPORT_STATUS = "UNEXPECTED_TRANSPORT_STATUS" as const;
export const USER_AGENT_NOT_IDENTIFYING = "USER_AGENT_NOT_IDENTIFYING" as const;
export const RATE_LIMIT_BREACH = "RATE_LIMIT_BREACH" as const;
export const RESUME_AMBIGUITY = "RESUME_AMBIGUITY" as const;

export type OptinDownloadDenialCode =
  | typeof OPTIN_MISSING
  | typeof NON_OFFICIAL_URL
  | typeof REDIRECT_ESCAPE
  | typeof CHECKSUM_NOT_DECLARED
  | typeof CHECKSUM_MISMATCH
  | typeof UNEXPECTED_BYTE_COUNT
  | typeof UNEXPECTED_TRANSPORT_STATUS
  | typeof USER_AGENT_NOT_IDENTIFYING
  | typeof RATE_LIMIT_BREACH
  | typeof RESUME_AMBIGUITY
  | typeof DESTINATION_OUTSIDE_OWNED_MOUNT
  | "POLICY_EVIDENCE_UNAVAILABLE"
  | "POLICY_EVIDENCE_MALFORMED"
  | "POLICY_EVIDENCE_HOST_MISMATCH"
  | "POLICY_EVIDENCE_BOUND_MISMATCH"
  | "POLICY_EVIDENCE_DUPLICATE_ENTRY"
  | "POLICY_EVIDENCE_NO_ENTRIES"
  | "POLICY_EVIDENCE_BYTE_SIZE_OUT_OF_BOUNDS"
  | "POLICY_EVIDENCE_SIZE_EXCEEDED";

export type OptinDownloadStage = "PRE_TRANSPORT" | "POST_TRANSPORT" | "EXPOSURE";

export interface OptinDownloadDenialV1 {
  readonly ok: false;
  readonly code: OptinDownloadDenialCode;
  readonly stage: OptinDownloadStage;
}

// The fake transport models the official response the request would have
// received: final URL after redirects, status, and the byte body. It is
// offline by construction — no socket, no fetch, no DNS.
export interface FakeTransportRequestV1 {
  readonly url: string;
  readonly userAgent: string;
  readonly resumeFromByte: number;
}

export interface FakeTransportResponseV1 {
  readonly finalUrl: string;
  readonly status: number;
  readonly body: Uint8Array;
}

export interface FakeTransportV1 {
  readonly name: string;
  fetch(request: FakeTransportRequestV1): FakeTransportResponseV1;
}

function isFakeTransportResponseV1(value: unknown): value is FakeTransportResponseV1 {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.finalUrl === "string" &&
    Number.isInteger(candidate.status) &&
    candidate.body instanceof Uint8Array
  );
}

export interface WikimediaOptinDownloadInputV1 {
  // Explicit opt-in flag (the "command/flag"). Absent or false — including the
  // default container invocation — denies before any transport call, so no
  // bytes can ever become usable.
  readonly optIn?: boolean;
  readonly url: string;
  readonly policyEvidenceRaw: string;
  readonly userAgent: string;
  readonly mountRoot: string;
  readonly destination: string;
  readonly resumeFromByte?: number;
}

export interface OptinDownloadRequestRecordV1 {
  readonly url: string;
  readonly userAgent: string;
  readonly connectionIndex: number;
  readonly requestOrdinal: number;
  readonly requestedByteRange: { readonly from: number; readonly toExclusive: number };
  readonly intervalMs: number;
  readonly appliedBounds: {
    readonly maximumConcurrentConnections: number;
    readonly maximumRequestsPerSession: number;
    readonly minimumRequestIntervalMs: number;
    readonly maximumSourceBytes: number;
  };
}

export interface OptinDownloadReceiptV1 {
  readonly ok: true;
  readonly adrId: "ADR-PSAI107-WIKIMEDIA-M0-01";
  readonly filename: string;
  readonly byteSize: number;
  readonly sha256: string;
  readonly mountRoot: string;
  readonly destination: string;
  readonly requestRecords: readonly OptinDownloadRequestRecordV1[];
}

export type OptinDownloadResultV1 = OptinDownloadReceiptV1 | OptinDownloadDenialV1;

function deepFreeze<T>(value: T): T {
  if (value !== null && typeof value === "object") {
    for (const key of Object.keys(value)) {
      const child = (value as Record<string, unknown>)[key];
      if (child !== null && typeof child === "object" && !Object.isFrozen(child)) {
        deepFreeze(child);
      }
    }
    Object.freeze(value);
  }
  return value;
}

// A single harness session owns the bounded connection/rate state: at most
// one concurrent connection and at most maximumRequestsPerSession requests,
// spaced by at least minimumRequestIntervalMs.
export class WikimediaOptinDownloadSession {
  private requestsMade = 0;
  private activeConnections = 0;
  private lastRequestAtMs: number | null = null;
  private readonly nowMs: () => number;

  constructor(nowMs: () => number = () => Date.now()) {
    this.nowMs = nowMs;
  }

  run(
    input: WikimediaOptinDownloadInputV1,
    transport: FakeTransportV1,
  ): OptinDownloadResultV1 {
    const bounds = WIKIMEDIA_DOWNLOAD_TRANSPORT_BOUNDS_V1;
    // The command boundary is also exercised from JavaScript callers, where
    // the TypeScript input type is not a runtime guarantee. Malformed input
    // must preserve the disabled-by-default behavior rather than throw before
    // the pre-transport opt-in gate can run.
    if (typeof input !== "object" || input === null) {
      return { ok: false, code: OPTIN_MISSING, stage: "PRE_TRANSPORT" };
    }
    // Gate 1: explicit opt-in. No flag (or the default container invocation)
    // denies before any transport call, so no bytes can ever become usable.
    if (input.optIn !== true) {
      return { ok: false, code: OPTIN_MISSING, stage: "PRE_TRANSPORT" };
    }
    // Gate 2: ADR-approved official checksum metadata must be available and
    // well-formed.
    const evidenceResult = parseWikimediaDownloadPolicyEvidence(input.policyEvidenceRaw);
    if (!evidenceResult.ok) {
      return { ok: false, code: evidenceResult.code, stage: "PRE_TRANSPORT" };
    }
    const evidence: WikimediaDownloadPolicyEvidenceV1 = evidenceResult.evidence;
    // Gate 3: official URL only (https, approved host, official path layout).
    const urlResult = parseOfficialDownloadUrl(input.url);
    if (!urlResult.ok) {
      return { ok: false, code: NON_OFFICIAL_URL, stage: "PRE_TRANSPORT" };
    }
    const url = urlResult.url;
    // Gate 4: the request must identify the client.
    if (!validateIdentifyingUserAgent(input.userAgent)) {
      return { ok: false, code: USER_AGENT_NOT_IDENTIFYING, stage: "PRE_TRANSPORT" };
    }
    // Gate 5: the requested file must be declared by the official metadata.
    const entry = evidence.entryByFilename.get(url.filename);
    if (entry === undefined || !checksumEntryMatchesOfficialUrl(entry, url)) {
      return { ok: false, code: CHECKSUM_NOT_DECLARED, stage: "PRE_TRANSPORT" };
    }
    // Gate 6: resume ambiguity. Offline verification is possible only for a
    // fresh fetch (0) or a fully-complete file (declared byteSize); any
    // partial offset cannot be verified against the declared full digest.
    const resumeFromByte = input.resumeFromByte ?? 0;
    if (!Number.isInteger(resumeFromByte) || resumeFromByte < 0 || resumeFromByte > entry.byteSize) {
      return { ok: false, code: RESUME_AMBIGUITY, stage: "PRE_TRANSPORT" };
    }
    // Only a fresh fetch (0) or a fully-complete file (declared byteSize) is
    // verifiable offline; a partial offset is ambiguous and denies.
    if (resumeFromByte !== 0 && resumeFromByte !== entry.byteSize) {
      return { ok: false, code: RESUME_AMBIGUITY, stage: "PRE_TRANSPORT" };
    }
    // Gate 7: bounded connection/rate behavior applies only when a transport
    // request is needed. Verifying a fully mounted candidate remains fully
    // offline even after the network request budget has been exhausted.
    let requestStartedAtMs: number | null = null;
    if (resumeFromByte === 0) {
      if (
        this.activeConnections + 1 > bounds.maximumConcurrentConnections ||
        this.requestsMade + 1 > bounds.maximumRequestsPerSession
      ) {
        return { ok: false, code: RATE_LIMIT_BREACH, stage: "PRE_TRANSPORT" };
      }
      try {
        requestStartedAtMs = this.nowMs();
      } catch {
        return { ok: false, code: RATE_LIMIT_BREACH, stage: "PRE_TRANSPORT" };
      }
      if (!Number.isSafeInteger(requestStartedAtMs) || requestStartedAtMs < 0) {
        return { ok: false, code: RATE_LIMIT_BREACH, stage: "PRE_TRANSPORT" };
      }
      if (
        this.lastRequestAtMs !== null &&
        (requestStartedAtMs < this.lastRequestAtMs ||
          requestStartedAtMs - this.lastRequestAtMs < bounds.minimumRequestIntervalMs)
      ) {
        return { ok: false, code: RATE_LIMIT_BREACH, stage: "PRE_TRANSPORT" };
      }
    }
    const destinationResult = resolveOwnedMountDestination(
      input.mountRoot,
      input.destination,
      url.filename,
    );
    if (!destinationResult.ok) {
      return { ok: false, code: destinationResult.code, stage: "EXPOSURE" };
    }
    const destination = destinationResult.destination;

    // Already complete: verify the existing file instead of fetching.
    if (resumeFromByte === entry.byteSize) {
      let existingSize: number;
      let existingDigest: string;
      try {
        const stat = statSync(destination);
        if (!stat.isFile()) {
          return { ok: false, code: CHECKSUM_MISMATCH, stage: "EXPOSURE" };
        }
        existingSize = stat.size;
        existingDigest = sha256Hex(readFileSync(destination));
      } catch {
        return { ok: false, code: CHECKSUM_MISMATCH, stage: "EXPOSURE" };
      }
      if (existingSize !== entry.byteSize || existingDigest !== entry.sha256) {
        return { ok: false, code: CHECKSUM_MISMATCH, stage: "EXPOSURE" };
      }
      return deepFreeze({
        ok: true,
        adrId: "ADR-PSAI107-WIKIMEDIA-M0-01",
        filename: url.filename,
        byteSize: entry.byteSize,
        sha256: entry.sha256,
        mountRoot: input.mountRoot,
        destination,
        requestRecords: [],
      });
    }

    // All pre-transport gates passed: issue the single bounded request. Count
    // the request before invoking the transport so failures cannot be retried
    // indefinitely within one session.
    if (requestStartedAtMs === null) {
      return { ok: false, code: RESUME_AMBIGUITY, stage: "PRE_TRANSPORT" };
    }
    const record: OptinDownloadRequestRecordV1 = {
      url: input.url,
      userAgent: input.userAgent,
      connectionIndex: 0,
      requestOrdinal: this.requestsMade + 1,
      requestedByteRange: { from: 0, toExclusive: entry.byteSize },
      intervalMs: bounds.minimumRequestIntervalMs,
      appliedBounds: {
        maximumConcurrentConnections: bounds.maximumConcurrentConnections,
        maximumRequestsPerSession: bounds.maximumRequestsPerSession,
        minimumRequestIntervalMs: bounds.minimumRequestIntervalMs,
        maximumSourceBytes: bounds.maximumSourceBytes,
      },
    };
    this.requestsMade += 1;
    this.lastRequestAtMs = requestStartedAtMs;
    this.activeConnections += 1;
    let response: FakeTransportResponseV1;
    try {
      const received: unknown = transport.fetch({
        url: input.url,
        userAgent: input.userAgent,
        resumeFromByte: 0,
      });
      if (!isFakeTransportResponseV1(received)) {
        return { ok: false, code: UNEXPECTED_TRANSPORT_STATUS, stage: "POST_TRANSPORT" };
      }
      response = received;
    } catch {
      return { ok: false, code: UNEXPECTED_TRANSPORT_STATUS, stage: "POST_TRANSPORT" };
    } finally {
      this.activeConnections -= 1;
    }
    // Gate 8: redirect escape. The fake response must remain on the exact
    // declared official URL; same-host redirects to a different official path
    // are not covered by the declared checksum metadata.
    if (response.finalUrl !== input.url) {
      return { ok: false, code: REDIRECT_ESCAPE, stage: "POST_TRANSPORT" };
    }
    if (response.status !== 200 || !(response.body instanceof Uint8Array)) {
      return { ok: false, code: UNEXPECTED_TRANSPORT_STATUS, stage: "POST_TRANSPORT" };
    }
    // Gate 9: verify declared byte count before the digest.
    if (response.body.length !== entry.byteSize) {
      return { ok: false, code: UNEXPECTED_BYTE_COUNT, stage: "POST_TRANSPORT" };
    }
    if (sha256Hex(response.body) !== entry.sha256) {
      return { ok: false, code: CHECKSUM_MISMATCH, stage: "POST_TRANSPORT" };
    }
    // The transport callback is an injected trust boundary. Re-resolve the
    // mount destination after it returns so a parent/destination symlink swap
    // cannot move verified bytes outside the owned mount.
    const exposureDestinationResult = resolveOwnedMountDestination(
      input.mountRoot,
      input.destination,
      url.filename,
    );
    if (
      !exposureDestinationResult.ok ||
      exposureDestinationResult.destination !== destination
    ) {
      return { ok: false, code: DESTINATION_OUTSIDE_OWNED_MOUNT, stage: "EXPOSURE" };
    }
    // Exposure: write outside the final path, then rename atomically.
    const partial = path.join(path.dirname(destination), `${path.basename(destination)}.partial`);
    try {
      rmSync(partial, { force: true });
      writeFileSync(partial, response.body, { flag: "wx", mode: 0o600 });
      renameSync(partial, destination);
    } catch {
      // A failed rename must not leave verified-but-usable staged bytes in the
      // mounted directory. Cleanup itself is best-effort and never authorizes
      // fallback exposure.
      try {
        rmSync(partial, { force: true });
      } catch {
        // Fail closed below; never expose via an alternate path.
      }
      return { ok: false, code: DESTINATION_OUTSIDE_OWNED_MOUNT, stage: "EXPOSURE" };
    }
    return deepFreeze({
      ok: true,
      adrId: "ADR-PSAI107-WIKIMEDIA-M0-01",
      filename: url.filename,
      byteSize: entry.byteSize,
      sha256: entry.sha256,
      mountRoot: input.mountRoot,
      destination,
      requestRecords: [record],
    });
  }
}