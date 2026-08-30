import { performance } from "node:perf_hooks";
import { createHash } from "node:crypto";
import { existsSync, lstatSync } from "node:fs";
import path from "node:path";
import { canonicalJson } from "../../contracts/src/canonical-json.js";
import {
  importMediaWikiMiniDumpEditionV1,
  validateMediaWikiMiniDumpProfileV1,
  type MediaWikiMiniDumpEditionV1,
  type MediaWikiMiniDumpProfileV1,
} from "../../contracts/src/mediawiki-mini-dump.js";
import {
  queryMediaWikiReadonlyV1,
  mediaWikiReadonlyQueryCorpusV1,
  activeMediaWikiReadonlyEditionV1,
} from "./mediawiki-readonly-query.js";
import {
  validateMediaWikiReadonlyQueryReceiptV1,
  type MediaWikiReadonlyQueryReceiptV1,
  type MediaWikiReadonlyQueryRequestV1,
} from "../../contracts/src/mediawiki-query-receipt.js";

export const WIKIMEDIA_PILOT_EVIDENCE_SCHEMA_V1 =
  "chimpmaera.knowledge/wikimedia-pilot-evidence/v1" as const;
export const WIKIMEDIA_PILOT_MEASUREMENT_SCHEMA_V1 =
  "chimpmaera.knowledge/wikimedia-pilot-measurement/v1" as const;
export const WIKIMEDIA_PILOT_BOUNDARY_V1 =
  "OFFLINE_OPERATOR_MOUNTED_IMMUTABLE_SNAPSHOT_ONLY_NO_NETWORK_NO_UNMOUNTED_CLAIMS" as const;
export const WIKIMEDIA_PILOT_OFFICIAL_HOST_V1 = "dumps.wikimedia.org" as const;

export const PILOT_MANIFEST_INVALID = "PILOT_MANIFEST_INVALID" as const;
export const PILOT_OFFICIAL_URL_MISSING = "PILOT_OFFICIAL_URL_MISSING" as const;
export const PILOT_OFFICIAL_CHECKSUM_MISSING = "PILOT_OFFICIAL_CHECKSUM_MISSING" as const;
export const PILOT_OFFICIAL_SIZE_MISSING = "PILOT_OFFICIAL_SIZE_MISSING" as const;
export const PILOT_OFFICIAL_SNAPSHOT_DATE_MISSING = "PILOT_OFFICIAL_SNAPSHOT_DATE_MISSING" as const;
export const PILOT_OFFICIAL_LICENSE_MISSING = "PILOT_OFFICIAL_LICENSE_MISSING" as const;
export const PILOT_OFFICIAL_ATTRIBUTION_MISSING = "PILOT_OFFICIAL_ATTRIBUTION_MISSING" as const;
export const PILOT_NON_IMMUTABLE_URL = "PILOT_NON_IMMUTABLE_URL" as const;
export const PILOT_CHECKSUM_MISMATCH = "PILOT_CHECKSUM_MISMATCH" as const;
export const PILOT_SIZE_MISMATCH = "PILOT_SIZE_MISMATCH" as const;
export const PILOT_UNSUPPORTED_PROJECT = "PILOT_UNSUPPORTED_PROJECT" as const;
export const PILOT_RECEIPT_SAMPLE_INCOMPLETE = "PILOT_RECEIPT_SAMPLE_INCOMPLETE" as const;
export const PILOT_MOUNTED_DUMP_REQUIRED = "PILOT_MOUNTED_DUMP_REQUIRED" as const;
export const PILOT_MIXED_MEASUREMENT_ENVIRONMENTS = "PILOT_MIXED_MEASUREMENT_ENVIRONMENTS" as const;
export const PILOT_CLAIM_WITHOUT_RAW_EVIDENCE = "PILOT_CLAIM_WITHOUT_RAW_EVIDENCE" as const;
export const PILOT_PROFILE_MISMATCH = "PILOT_PROFILE_MISMATCH" as const;

export type WikimediaPilotEvidenceFailureCode =
  | typeof PILOT_MANIFEST_INVALID
  | typeof PILOT_OFFICIAL_URL_MISSING
  | typeof PILOT_OFFICIAL_CHECKSUM_MISSING
  | typeof PILOT_OFFICIAL_SIZE_MISSING
  | typeof PILOT_OFFICIAL_SNAPSHOT_DATE_MISSING
  | typeof PILOT_OFFICIAL_LICENSE_MISSING
  | typeof PILOT_OFFICIAL_ATTRIBUTION_MISSING
  | typeof PILOT_NON_IMMUTABLE_URL
  | typeof PILOT_CHECKSUM_MISMATCH
  | typeof PILOT_SIZE_MISMATCH
  | typeof PILOT_UNSUPPORTED_PROJECT
  | typeof PILOT_RECEIPT_SAMPLE_INCOMPLETE
  | typeof PILOT_MOUNTED_DUMP_REQUIRED
  | typeof PILOT_MIXED_MEASUREMENT_ENVIRONMENTS
  | typeof PILOT_CLAIM_WITHOUT_RAW_EVIDENCE
  | typeof PILOT_PROFILE_MISMATCH;

export interface WikimediaPilotLicenseV1 {
  readonly licence: "CC0-1.0" | "CC-BY-4.0" | "APACHE-2.0" | "MIT" | "OWNER_AUTHORIZED";
  readonly attributionTemplate: string;
}

export interface WikimediaPilotOfficialSnapshotV1 {
  readonly project: string;
  readonly language: string;
  readonly url: string;
  readonly checksum: string;
  readonly byteSize: number;
  readonly snapshotDate: string;
  readonly license: WikimediaPilotLicenseV1;
  readonly attribution: string;
  readonly sourcePath: string;
}

export interface WikimediaPilotSyntheticFixtureV1 {
  readonly root: string;
  readonly profile: MediaWikiMiniDumpProfileV1;
  readonly expectedContentDigest: string;
  readonly expectedEditionDigest: string;
  readonly receiptSampleSize: number;
}

export interface WikimediaPilotManifestV1 {
  readonly schemaVersion: typeof WIKIMEDIA_PILOT_EVIDENCE_SCHEMA_V1;
  readonly pilotId: "PSAI107-QWEN-06-PILOT-EVIDENCE-HARNESS";
  readonly network: "DISABLED";
  readonly boundary: typeof WIKIMEDIA_PILOT_BOUNDARY_V1;
  readonly synthetic: WikimediaPilotSyntheticFixtureV1;
  readonly official: WikimediaPilotOfficialSnapshotV1;
  readonly measurementSchema: {
    readonly schemaVersion: typeof WIKIMEDIA_PILOT_MEASUREMENT_SCHEMA_V1;
    readonly requiredRawFields: readonly ["elapsedMs", "bytes", "queryLatencyMs"];
    readonly requiredReceiptFields: readonly [
      "exactPassage",
      "project",
      "pageId",
      "revisionId",
      "canonicalUrl",
      "snapshotDate",
      "license",
      "contentDigest",
      "editionDigest"
    ];
  };
}

export interface WikimediaPilotPreflightV1 {
  readonly schemaVersion: typeof WIKIMEDIA_PILOT_EVIDENCE_SCHEMA_V1;
  readonly operation: "PILOT_PREFLIGHT";
  readonly network: "DISABLED";
  readonly mountedSnapshot: false;
  readonly measurementStatus: "NOT_MEASURED";
  readonly claims: readonly [];
  readonly manifestDigest: string;
  readonly requiredEvidence: readonly ["mounted_immutable_snapshot", "raw_measurements", "complete_receipt_sample"];
}

export interface WikimediaPilotRawEvidenceV1 {
  readonly schemaVersion: typeof WIKIMEDIA_PILOT_MEASUREMENT_SCHEMA_V1;
  readonly sampleId: string;
  readonly environmentId: string;
  readonly operation: "IMPORT" | "REIMPORT" | "QUERY";
  readonly elapsedMs: number;
  readonly bytes: number;
  readonly queryLatencyMs: number | null;
  readonly sourceChecksum: string;
  readonly editionDigest: string;
  readonly receiptDigest: string | null;
  readonly receiptResultCount: number;
}

export interface WikimediaPilotMeasuredClaimsV1 {
  readonly storageBytes: number;
  readonly importElapsedMs: number;
  readonly queryLatencyMs: number;
}

export interface WikimediaPilotEvidenceReportV1 {
  readonly schemaVersion: typeof WIKIMEDIA_PILOT_EVIDENCE_SCHEMA_V1;
  readonly operation: "PILOT_EVIDENCE_REPORT";
  readonly network: "DISABLED";
  readonly mountedSnapshot: boolean;
  readonly environmentId: string;
  readonly official: WikimediaPilotOfficialSnapshotV1;
  readonly immutableEditions: {
    readonly firstEditionDigest: string;
    readonly reimportEditionDigest: string;
    readonly equal: true;
  };
  readonly receiptSample: readonly MediaWikiReadonlyQueryReceiptV1[];
  readonly rawEvidence: readonly WikimediaPilotRawEvidenceV1[];
  readonly claims: WikimediaPilotMeasuredClaimsV1 | readonly [];
  readonly reportDigest: string;
}

export interface WikimediaPilotMountedSnapshotInputV1 {
  readonly root: string;
  readonly profile: MediaWikiMiniDumpProfileV1;
  readonly query: MediaWikiReadonlyQueryRequestV1;
  readonly environmentId: string;
}

const DIGEST = /^[a-f0-9]{64}$/;
const DATE = /^(\d{4})-(\d{2})-(\d{2})$/;
const LANGUAGE = /^[a-z]{2,3}$/;
const PROJECT = /^wikipedia:[a-z]{2,3}$/;
const SOURCE_PATH = /^[A-Za-z0-9._-]+\.xml$/;
const IMMUTABLE_FILENAME = /^[a-z0-9][a-z0-9.-]{2,180}\.(?:xml|xml\.gz|xml\.bz2|xml\.7z)$/;
const IMMUTABLE_URL = new RegExp(
  `^https://${WIKIMEDIA_PILOT_OFFICIAL_HOST_V1}/wikipedia/([a-z]{2,3})/(\\d{8})/(${IMMUTABLE_FILENAME.source.slice(1, -1)})$`,
);

function exactKeys(value: unknown, keys: readonly string[]): value is Record<string, unknown> {
  if (value === null || typeof value !== "object" || Array.isArray(value)
    || Object.getPrototypeOf(value) !== Object.prototype) return false;
  const actual = Object.keys(value).sort();
  const expected = [...keys].sort();
  return actual.length === expected.length && actual.every((item, index) => item === expected[index]);
}

function isDate(value: unknown): value is string {
  if (typeof value !== "string") return false;
  const match = DATE.exec(value);
  if (!match) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

function isLicense(value: unknown): value is WikimediaPilotLicenseV1 {
  return exactKeys(value, ["attributionTemplate", "licence"])
    && typeof value.licence === "string"
    && ["CC0-1.0", "CC-BY-4.0", "APACHE-2.0", "MIT", "OWNER_AUTHORIZED"].includes(value.licence)
    && typeof value.attributionTemplate === "string"
    && value.attributionTemplate.length > 0
    && value.attributionTemplate.length <= 512;
}

function officialMissingCode(value: Record<string, unknown>): WikimediaPilotEvidenceFailureCode | null {
  if (typeof value.url !== "string" || value.url.length === 0) return PILOT_OFFICIAL_URL_MISSING;
  if (typeof value.checksum !== "string" || value.checksum.length === 0) return PILOT_OFFICIAL_CHECKSUM_MISSING;
  if (typeof value.byteSize !== "number" || !Number.isSafeInteger(value.byteSize) || value.byteSize < 1) return PILOT_OFFICIAL_SIZE_MISSING;
  if (typeof value.snapshotDate !== "string" || value.snapshotDate.length === 0) return PILOT_OFFICIAL_SNAPSHOT_DATE_MISSING;
  if (!isLicense(value.license)) return PILOT_OFFICIAL_LICENSE_MISSING;
  if (typeof value.attribution !== "string" || value.attribution.length === 0) return PILOT_OFFICIAL_ATTRIBUTION_MISSING;
  return null;
}

export function parseImmutableWikimediaPilotUrlV1(value: string): {
  readonly language: string;
  readonly snapshotDate: string;
  readonly filename: string;
} | null {
  if (typeof value !== "string") return null;
  const match = IMMUTABLE_URL.exec(value);
  if (!match || match[1] === undefined || match[2] === undefined || match[3] === undefined) return null;
  const date = `${match[2].slice(0, 4)}-${match[2].slice(4, 6)}-${match[2].slice(6, 8)}`;
  if (!isDate(date) || !match[3].startsWith(`${match[1]}wiki-${match[2]}-`)) return null;
  return { language: match[1], snapshotDate: date, filename: match[3] };
}

function validateSynthetic(value: unknown): value is WikimediaPilotSyntheticFixtureV1 {
  if (!exactKeys(value, ["expectedContentDigest", "expectedEditionDigest", "profile", "receiptSampleSize", "root"])) return false;
  return typeof value.root === "string" && value.root.length > 0
    && validateMediaWikiMiniDumpProfileV1(value.profile)
    && value.profile.enabled === true
    && DIGEST.test(String(value.expectedContentDigest))
    && DIGEST.test(String(value.expectedEditionDigest))
    && typeof value.receiptSampleSize === "number"
    && Number.isSafeInteger(value.receiptSampleSize) && value.receiptSampleSize >= 1 && value.receiptSampleSize <= 32;
}

export function validateWikimediaPilotManifestV1(value: unknown): value is WikimediaPilotManifestV1 {
  if (!exactKeys(value, ["boundary", "measurementSchema", "network", "official", "pilotId", "schemaVersion", "synthetic"])) return false;
  if (value.schemaVersion !== WIKIMEDIA_PILOT_EVIDENCE_SCHEMA_V1
    || value.pilotId !== "PSAI107-QWEN-06-PILOT-EVIDENCE-HARNESS"
    || value.network !== "DISABLED"
    || value.boundary !== WIKIMEDIA_PILOT_BOUNDARY_V1
    || !validateSynthetic(value.synthetic)) return false;
  const official = value.official;
  if (!exactKeys(official, ["attribution", "byteSize", "checksum", "language", "license", "project", "snapshotDate", "sourcePath", "url"])) return false;
  if (officialMissingCode(official) !== null) return false;
  if (typeof official.project !== "string" || !PROJECT.test(official.project)
    || typeof official.language !== "string" || !LANGUAGE.test(official.language)
    || official.project !== `wikipedia:${official.language}`
    || !DIGEST.test(String(official.checksum))
    || !isDate(official.snapshotDate)
    || !SOURCE_PATH.test(String(official.sourcePath))) return false;
  const parsedUrl = parseImmutableWikimediaPilotUrlV1(official.url as string);
  if (parsedUrl === null || parsedUrl.language !== official.language || parsedUrl.snapshotDate !== official.snapshotDate
    || parsedUrl.filename !== official.sourcePath) return false;
  const measurementSchema = value.measurementSchema;
  if (!exactKeys(measurementSchema, ["requiredRawFields", "requiredReceiptFields", "schemaVersion"])) return false;
  if (measurementSchema.schemaVersion !== WIKIMEDIA_PILOT_MEASUREMENT_SCHEMA_V1
    || canonicalJson(measurementSchema.requiredRawFields) !== canonicalJson(["elapsedMs", "bytes", "queryLatencyMs"])
    || canonicalJson(measurementSchema.requiredReceiptFields) !== canonicalJson([
      "exactPassage", "project", "pageId", "revisionId", "canonicalUrl", "snapshotDate", "license", "contentDigest", "editionDigest",
    ])) return false;
  return true;
}

function validateOfficialSnapshot(value: unknown): value is WikimediaPilotOfficialSnapshotV1 {
  if (!exactKeys(value, ["attribution", "byteSize", "checksum", "language", "license", "project", "snapshotDate", "sourcePath", "url"])) return false;
  const official = value;
  if (officialMissingCode(official) !== null
    || typeof official.project !== "string" || !PROJECT.test(official.project)
    || typeof official.language !== "string" || !LANGUAGE.test(official.language)
    || official.project !== `wikipedia:${official.language}`
    || !DIGEST.test(String(official.checksum))
    || !isDate(official.snapshotDate)
    || typeof official.sourcePath !== "string" || !SOURCE_PATH.test(official.sourcePath)) return false;
  const parsedUrl = parseImmutableWikimediaPilotUrlV1(official.url as string);
  return parsedUrl !== null && parsedUrl.language === official.language
    && parsedUrl.snapshotDate === official.snapshotDate && parsedUrl.filename === official.sourcePath;
}

function assertManifest(value: unknown): WikimediaPilotManifestV1 {
  if (!validateWikimediaPilotManifestV1(value)) throw new Error(PILOT_MANIFEST_INVALID);
  return value;
}

function manifestDigest(manifest: WikimediaPilotManifestV1): string {
  return createSha256(canonicalJson(manifest));
}

function createSha256(value: Uint8Array | string): string {
  return createHash("sha256").update(value).digest("hex");
}

function validateOfficialAgainstProfile(
  official: WikimediaPilotOfficialSnapshotV1,
  profile: MediaWikiMiniDumpProfileV1,
): void {
  if (official.project !== profile.project || official.language !== profile.language
    || official.url !== profile.dump.sourceUrl || official.snapshotDate !== profile.dump.snapshotDate
    || official.sourcePath !== profile.source.path || official.checksum !== profile.source.expectedSourceDigest
    || official.byteSize !== profile.source.byteSize || official.license.licence !== profile.license.licence
    || official.license.attributionTemplate !== profile.license.attributionTemplate
    || official.attribution !== profile.license.attributionTemplate) throw new Error(PILOT_PROFILE_MISMATCH);
}

function validateReceiptSample(
  receipts: readonly MediaWikiReadonlyQueryReceiptV1[],
  expectedMinimum: number,
): void {
  if (receipts.length < 1 || receipts.some((receipt) => !validateMediaWikiReadonlyQueryReceiptV1(receipt)
    || receipt.results.length < expectedMinimum)) {
    throw new Error(PILOT_RECEIPT_SAMPLE_INCOMPLETE);
  }
  for (const receipt of receipts) {
    if (receipt.results.length === 0 || receipt.results.some((result) =>
      result.exactPassage.length === 0
      || result.project.length === 0
      || result.pageId < 1
      || result.revisionId < 1
      || !result.canonicalUrl.startsWith("https://")
      || !isDate(result.snapshotDate)
      || !isLicense(result.license)
      || !DIGEST.test(result.contentDigest)
      || !DIGEST.test(result.editionDigest))) throw new Error(PILOT_RECEIPT_SAMPLE_INCOMPLETE);
  }
}

function mountedRoot(root: string, sourcePath: string): string {
  if (typeof root !== "string" || root.length === 0) throw new Error(PILOT_MOUNTED_DUMP_REQUIRED);
  const resolved = path.resolve(root);
  try {
    const rootStat = lstatSync(resolved);
    const source = path.join(resolved, sourcePath);
    const sourceStat = lstatSync(source);
    if (!rootStat.isDirectory() || rootStat.isSymbolicLink() || !sourceStat.isFile() || sourceStat.isSymbolicLink()) {
      throw new Error(PILOT_MOUNTED_DUMP_REQUIRED);
    }
    if (!source.startsWith(`${resolved}${path.sep}`) || !existsSync(source)) throw new Error(PILOT_MOUNTED_DUMP_REQUIRED);
    return resolved;
  } catch (error) {
    if (error instanceof Error && error.message === PILOT_MOUNTED_DUMP_REQUIRED) throw error;
    throw new Error(PILOT_MOUNTED_DUMP_REQUIRED);
  }
}

function elapsedMs(start: number, end: number): number {
  const result = end - start;
  if (!Number.isFinite(result) || result < 0) throw new Error(PILOT_CLAIM_WITHOUT_RAW_EVIDENCE);
  return Number(result.toFixed(6));
}

function rawEvidence(
  sampleId: string,
  environmentId: string,
  operation: "IMPORT" | "REIMPORT" | "QUERY",
  elapsed: number,
  bytes: number,
  queryLatency: number | null,
  edition: MediaWikiMiniDumpEditionV1,
  receipt: MediaWikiReadonlyQueryReceiptV1 | null,
): WikimediaPilotRawEvidenceV1 {
  if (!Number.isSafeInteger(bytes) || bytes < 1 || !Number.isFinite(elapsed) || elapsed < 0
    || (queryLatency !== null && (!Number.isFinite(queryLatency) || queryLatency < 0))) {
    throw new Error(PILOT_CLAIM_WITHOUT_RAW_EVIDENCE);
  }
  return {
    schemaVersion: WIKIMEDIA_PILOT_MEASUREMENT_SCHEMA_V1,
    sampleId,
    environmentId,
    operation,
    elapsedMs: elapsed,
    bytes,
    queryLatencyMs: queryLatency,
    sourceChecksum: edition.rawTransport.sourceChecksum,
    editionDigest: edition.editionDigest,
    receiptDigest: receipt?.receiptDigest ?? null,
    receiptResultCount: receipt?.results.length ?? 0,
  };
}

function importPilotEdition(root: string, profile: MediaWikiMiniDumpProfileV1): MediaWikiMiniDumpEditionV1 {
  try {
    return importMediaWikiMiniDumpEditionV1(root, profile);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (message === "MEDIAWIKI_MINI_DUMP_DIGEST_DRIFT_DENIED") throw new Error(PILOT_CHECKSUM_MISMATCH);
    if (message === "MEDIAWIKI_MINI_DUMP_SIZE_DENIED") throw new Error(PILOT_SIZE_MISMATCH);
    throw error;
  }
}

export function preflightWikimediaPilotV1(value: unknown): WikimediaPilotPreflightV1 {
  const manifest = assertManifest(value);
  // A preflight is deliberately metadata-only. In particular, official
  // byteSize is a supplied source fact, not a storage measurement, and no
  // storage/import/query metric is emitted here.
  return Object.freeze({
    schemaVersion: WIKIMEDIA_PILOT_EVIDENCE_SCHEMA_V1,
    operation: "PILOT_PREFLIGHT",
    network: "DISABLED",
    mountedSnapshot: false,
    measurementStatus: "NOT_MEASURED",
    claims: [] as const,
    manifestDigest: manifestDigest(manifest),
    requiredEvidence: ["mounted_immutable_snapshot", "raw_measurements", "complete_receipt_sample"] as const,
  });
}

export function runSyntheticWikimediaPilotEvidenceV1(
  manifestInput: unknown,
  clock: () => number = () => performance.now(),
): WikimediaPilotEvidenceReportV1 {
  const manifest = assertManifest(manifestInput);
  const fixture = manifest.synthetic;
  const root = mountedRoot(fixture.root, fixture.profile.source.path);
  const firstStart = clock();
  const first = importPilotEdition(root, fixture.profile);
  const firstElapsed = elapsedMs(firstStart, clock());
  const secondStart = clock();
  const second = importPilotEdition(root, fixture.profile);
  const secondElapsed = elapsedMs(secondStart, clock());
  if (first.contentDigest !== fixture.expectedContentDigest || first.editionDigest !== fixture.expectedEditionDigest
    || first.editionDigest !== second.editionDigest) throw new Error(PILOT_CHECKSUM_MISMATCH);
  const queryRequest: MediaWikiReadonlyQueryRequestV1 = {
    query: "synthetic article",
    ranking: "LOCAL_HYBRID",
    maxResults: fixture.receiptSampleSize,
  };
  const queryStart = clock();
  const receipt = queryMediaWikiReadonlyV1(
    mediaWikiReadonlyQueryCorpusV1(activeMediaWikiReadonlyEditionV1(first)),
    queryRequest,
  );
  const queryElapsed = elapsedMs(queryStart, clock());
  validateReceiptSample([receipt], fixture.receiptSampleSize);
  const raw = [
    rawEvidence("synthetic-import-1", "synthetic-offline", "IMPORT", firstElapsed, first.rawTransport.byteSize, null, first, null),
    rawEvidence("synthetic-import-2", "synthetic-offline", "REIMPORT", secondElapsed, second.rawTransport.byteSize, null, second, null),
    rawEvidence("synthetic-query-1", "synthetic-offline", "QUERY", queryElapsed, first.rawTransport.byteSize, queryElapsed, first, receipt),
  ];
  return buildReport(manifest, first, second, [receipt], raw, "synthetic-offline", false);
}

export function runMountedWikimediaPilotEvidenceV1(
  manifestInput: unknown,
  input: WikimediaPilotMountedSnapshotInputV1,
  clock: () => number = () => performance.now(),
): WikimediaPilotEvidenceReportV1 {
  const manifest = assertManifest(manifestInput);
  validateOfficialAgainstProfile(manifest.official, input.profile);
  const root = mountedRoot(input.root, manifest.official.sourcePath);
  const importStart = clock();
  const first = importPilotEdition(root, input.profile);
  const importElapsed = elapsedMs(importStart, clock());
  if (first.rawTransport.sourceChecksum !== manifest.official.checksum) throw new Error(PILOT_CHECKSUM_MISMATCH);
  if (first.rawTransport.byteSize !== manifest.official.byteSize) throw new Error(PILOT_SIZE_MISMATCH);
  const reimportStart = clock();
  const second = importPilotEdition(root, input.profile);
  const reimportElapsed = elapsedMs(reimportStart, clock());
  if (first.editionDigest !== second.editionDigest) throw new Error(PILOT_CHECKSUM_MISMATCH);
  const queryStart = clock();
  const receipt = queryMediaWikiReadonlyV1(
    mediaWikiReadonlyQueryCorpusV1(activeMediaWikiReadonlyEditionV1(first)),
    input.query,
  );
  const queryElapsed = elapsedMs(queryStart, clock());
  validateReceiptSample([receipt], manifest.synthetic.receiptSampleSize);
  const raw = [
    rawEvidence("pilot-import-1", input.environmentId, "IMPORT", importElapsed, first.rawTransport.byteSize, null, first, null),
    rawEvidence("pilot-import-2", input.environmentId, "REIMPORT", reimportElapsed, second.rawTransport.byteSize, null, second, null),
    rawEvidence("pilot-query-1", input.environmentId, "QUERY", queryElapsed, first.rawTransport.byteSize, queryElapsed, first, receipt),
  ];
  return buildReport(manifest, first, second, [receipt], raw, input.environmentId, true);
}

function buildReport(
  manifest: WikimediaPilotManifestV1,
  first: MediaWikiMiniDumpEditionV1,
  second: MediaWikiMiniDumpEditionV1,
  receipts: readonly MediaWikiReadonlyQueryReceiptV1[],
  raw: readonly WikimediaPilotRawEvidenceV1[],
  environmentId: string,
  mountedSnapshot: boolean,
): WikimediaPilotEvidenceReportV1 {
  const environments = new Set(raw.map((entry) => entry.environmentId));
  if (environments.size !== 1) throw new Error(PILOT_MIXED_MEASUREMENT_ENVIRONMENTS);
  if (!raw.every((entry) => entry.environmentId === environmentId
    && entry.schemaVersion === WIKIMEDIA_PILOT_MEASUREMENT_SCHEMA_V1)) throw new Error(PILOT_CLAIM_WITHOUT_RAW_EVIDENCE);
  validateReceiptSample(receipts, 1);
  const query = raw.find((entry) => entry.operation === "QUERY");
  const firstImport = raw.find((entry) => entry.operation === "IMPORT");
  if (!query || !firstImport || query.queryLatencyMs === null) throw new Error(PILOT_CLAIM_WITHOUT_RAW_EVIDENCE);
  const reportUnsigned = {
    schemaVersion: WIKIMEDIA_PILOT_EVIDENCE_SCHEMA_V1,
    operation: "PILOT_EVIDENCE_REPORT" as const,
    network: "DISABLED" as const,
    mountedSnapshot,
    environmentId,
    official: manifest.official,
    immutableEditions: {
      firstEditionDigest: first.editionDigest,
      reimportEditionDigest: second.editionDigest,
      equal: true as const,
    },
    receiptSample: receipts,
    rawEvidence: raw,
    claims: mountedSnapshot ? {
      storageBytes: first.rawTransport.byteSize,
      importElapsedMs: firstImport.elapsedMs,
      queryLatencyMs: query.queryLatencyMs,
    } : [] as const,
  };
  const report = { ...reportUnsigned, reportDigest: createSha256(canonicalJson(reportUnsigned)) };
  return Object.freeze(report);
}

export function validateWikimediaPilotEvidenceReportV1(value: unknown): value is WikimediaPilotEvidenceReportV1 {
  if (!exactKeys(value, ["claims", "environmentId", "immutableEditions", "mountedSnapshot", "network", "official", "operation", "rawEvidence", "receiptSample", "reportDigest", "schemaVersion"])) return false;
  if (value.schemaVersion !== WIKIMEDIA_PILOT_EVIDENCE_SCHEMA_V1 || value.operation !== "PILOT_EVIDENCE_REPORT"
    || value.network !== "DISABLED" || typeof value.mountedSnapshot !== "boolean"
    || typeof value.environmentId !== "string" || value.environmentId.length === 0
    || !validateOfficialSnapshot(value.official) || !Array.isArray(value.receiptSample)
    || !Array.isArray(value.rawEvidence) || !DIGEST.test(String(value.reportDigest))) return false;
  if (value.receiptSample.length !== 1 || value.receiptSample.some((receipt) =>
    !validateMediaWikiReadonlyQueryReceiptV1(receipt) || receipt.results.length < 1)) return false;
  if (value.rawEvidence.length !== 3 || value.rawEvidence.some((entry) => {
    if (!exactKeys(entry, ["bytes", "editionDigest", "elapsedMs", "environmentId", "operation", "queryLatencyMs", "receiptDigest", "receiptResultCount", "sampleId", "schemaVersion", "sourceChecksum"])) return true;
    return typeof entry.sampleId !== "string" || entry.sampleId.length === 0
      || typeof entry.environmentId !== "string" || entry.environmentId.length === 0
      || !["IMPORT", "REIMPORT", "QUERY"].includes(String(entry.operation))
      || entry.schemaVersion !== WIKIMEDIA_PILOT_MEASUREMENT_SCHEMA_V1
      || typeof entry.elapsedMs !== "number" || !Number.isFinite(entry.elapsedMs) || entry.elapsedMs < 0
      || typeof entry.bytes !== "number" || !Number.isSafeInteger(entry.bytes) || entry.bytes < 1
      || (entry.queryLatencyMs !== null && (typeof entry.queryLatencyMs !== "number" || !Number.isFinite(entry.queryLatencyMs) || entry.queryLatencyMs < 0))
      || typeof entry.editionDigest !== "string" || !DIGEST.test(entry.editionDigest)
      || typeof entry.sourceChecksum !== "string" || !DIGEST.test(entry.sourceChecksum)
      || (entry.receiptDigest !== null && (typeof entry.receiptDigest !== "string" || !DIGEST.test(entry.receiptDigest)))
      || typeof entry.receiptResultCount !== "number" || !Number.isSafeInteger(entry.receiptResultCount) || entry.receiptResultCount < 0;
  })) return false;
  if (!value.immutableEditions || !exactKeys(value.immutableEditions, ["equal", "firstEditionDigest", "reimportEditionDigest"])
    || value.immutableEditions.equal !== true
    || !DIGEST.test(String(value.immutableEditions.firstEditionDigest))
    || value.immutableEditions.firstEditionDigest !== value.immutableEditions.reimportEditionDigest) return false;
  const raw = value.rawEvidence as unknown as WikimediaPilotRawEvidenceV1[];
  const receipts = value.receiptSample as unknown as MediaWikiReadonlyQueryReceiptV1[];
  const official = value.official as WikimediaPilotOfficialSnapshotV1;
  const firstEditionDigest = value.immutableEditions.firstEditionDigest as string;
  const reimportEditionDigest = value.immutableEditions.reimportEditionDigest as string;
  const measuredImports = raw.filter((entry) => entry.operation === "IMPORT");
  const measuredReimports = raw.filter((entry) => entry.operation === "REIMPORT");
  const measuredQueries = raw.filter((entry) => entry.operation === "QUERY");
  if (measuredImports.length !== 1 || measuredReimports.length !== 1 || measuredQueries.length !== 1
    || new Set(raw.map((entry) => entry.sampleId)).size !== raw.length
    || raw.some((entry) => entry.environmentId !== value.environmentId)
    || new Set(raw.map((entry) => entry.sourceChecksum)).size !== 1
    || new Set(raw.map((entry) => entry.bytes)).size !== 1) return false;
  const measuredImport = measuredImports[0] as WikimediaPilotRawEvidenceV1;
  const measuredReimport = measuredReimports[0] as WikimediaPilotRawEvidenceV1;
  const measuredQuery = measuredQueries[0] as WikimediaPilotRawEvidenceV1;
  const receipt = receipts[0] as MediaWikiReadonlyQueryReceiptV1;
  if (measuredImport.editionDigest !== firstEditionDigest
    || measuredReimport.editionDigest !== reimportEditionDigest
    || measuredQuery.editionDigest !== firstEditionDigest
    || measuredImport.queryLatencyMs !== null || measuredReimport.queryLatencyMs !== null
    || measuredImport.receiptDigest !== null || measuredReimport.receiptDigest !== null
    || measuredImport.receiptResultCount !== 0 || measuredReimport.receiptResultCount !== 0
    || measuredQuery.queryLatencyMs === null || measuredQuery.receiptDigest !== receipt.receiptDigest
    || measuredQuery.receiptResultCount !== receipt.results.length
    || receipt.activeEditionDigest !== firstEditionDigest || receipt.selectedEditionDigests.length !== 0
    || receipt.results.some((result) => result.editionDigest !== firstEditionDigest)) return false;
  if (value.mountedSnapshot) {
    if (!exactKeys(value.claims, ["importElapsedMs", "queryLatencyMs", "storageBytes"])
      || value.claims.storageBytes !== measuredImport.bytes
      || value.claims.importElapsedMs !== measuredImport.elapsedMs
      || value.claims.queryLatencyMs !== measuredQuery.queryLatencyMs
      || raw.some((entry) => entry.sourceChecksum !== official.checksum || entry.bytes !== official.byteSize)
      || receipt.results.some((result) => result.project !== official.project || result.language !== official.language
        || result.snapshotDate !== official.snapshotDate
        || canonicalJson(result.license) !== canonicalJson(official.license))) return false;
  } else if (!Array.isArray(value.claims) || value.claims.length !== 0) return false;
  const unsigned = { ...value };
  delete (unsigned as { reportDigest?: string }).reportDigest;
  return createSha256(canonicalJson(unsigned)) === value.reportDigest;
}

export const validatePilotManifestV1 = validateWikimediaPilotManifestV1;
export const preflightPilotV1 = preflightWikimediaPilotV1;
export const runSyntheticPilotEvidenceV1 = runSyntheticWikimediaPilotEvidenceV1;
export const runMountedPilotEvidenceV1 = runMountedWikimediaPilotEvidenceV1;
