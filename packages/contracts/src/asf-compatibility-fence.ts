/**
 * Deterministic ASF compatibility fence contract (v1).
 *
 * A compatibility matrix is a finite, digest-bound declaration that maps
 * explicit generation-to-profile/adapter/pack/route tuples to a bounded
 * capability scope with a verdict (COMPATIBLE or INCOMPATIBLE). Verifying
 * the matrix and resolving one declared tuple are pure, local, and
 * fail-closed: the contract carries no authority, installs nothing, and
 * activates nothing.
 */
import { createHash } from "node:crypto";

import type { AsfCatalogueEntryV1, AsfCapabilityCatalogueV1 } from "./asf-bundle-lock.js";
import { canonicalJson } from "./canonical-json.js";

export const ASF_COMPATIBILITY_FENCE_SCHEMA_V1 = "chimpmaera.asf/compatibility-fence/v1" as const;
export const ASF_COMPATIBILITY_FENCE_RECEIPT_SCHEMA_V1 =
  "chimpmaera.asf/compatibility-fence-receipt/v1" as const;
export const ASF_COMPATIBILITY_FENCE_QUERY_SCHEMA_V1 =
  "chimpmaera.asf/compatibility-fence-query/v1" as const;
export const ASF_COMPATIBILITY_FENCE_MATRIX_VERSION_V1 = "1.0.0" as const;
export const ASF_COMPATIBILITY_FENCE_CAPABILITY_SCOPE_V1 = "EXPLICIT" as const;
export const ASF_COMPATIBILITY_FENCE_VERDICTS_V1 = ["COMPATIBLE", "INCOMPATIBLE"] as const;

export const ASF_COMPATIBILITY_FENCE_AUTHORITY_V1 = Object.freeze({
  activation: "NO_AUTHORITY",
  grantedCapabilities: [],
  installation: "NO_AUTHORITY",
} as const);

export const ASF_FENCE_LIMITATIONS_V1 = [
  "COMPATIBILITY_MATRIX_IS_NOT_AUTHORITY",
  "EXPLICIT_TUPLE_DECLARATION_ONLY",
  "FINITE_CAPABILITY_SCOPE_ONLY",
  "LOCAL_DETERMINISTIC_CONTRACT_ONLY",
  "NO_INSTALLATION_OR_ACTIVATION_AUTHORITY",
  "NO_LIVE_REGISTRY_OR_SIGNATURE_PROOF",
] as const;

export const ASF_COMPATIBILITY_FENCE_REASON_ORDER_V1 = [
  "BROAD_CAPABILITY_DENIED",
  "DIGEST_MISMATCH_DENIED",
  "DUPLICATE_KEY_DENIED",
  "INCOMPATIBLE_TUPLE_DENIED",
  "INVALID_JSON_DENIED",
  "MUTABLE_ALIAS_OR_RANGE_DENIED",
  "NONCANONICAL_ENCODING_DENIED",
  "SCHEMA_DENIED",
  "STALE_CATALOGUE_DENIED",
  "UNKNOWN_CAPABILITY_DENIED",
  "UNKNOWN_TARGET_DENIED",
  "UNSUPPORTED_VERSION_DENIED",
] as const;

export type AsfFenceReasonCodeV1 =
  | "ASF_COMPATIBILITY_FENCE_ACCEPTED"
  | (typeof ASF_COMPATIBILITY_FENCE_REASON_ORDER_V1)[number];

export const ASF_COMPATIBILITY_FENCE_EXIT_CODES_V1: Readonly<Record<AsfFenceReasonCodeV1, number>> =
  Object.freeze({
    ASF_COMPATIBILITY_FENCE_ACCEPTED: 0,
    INVALID_JSON_DENIED: 80,
    DUPLICATE_KEY_DENIED: 81,
    NONCANONICAL_ENCODING_DENIED: 82,
    SCHEMA_DENIED: 83,
    UNSUPPORTED_VERSION_DENIED: 84,
    MUTABLE_ALIAS_OR_RANGE_DENIED: 85,
    UNKNOWN_TARGET_DENIED: 86,
    STALE_CATALOGUE_DENIED: 87,
    BROAD_CAPABILITY_DENIED: 88,
    UNKNOWN_CAPABILITY_DENIED: 89,
    INCOMPATIBLE_TUPLE_DENIED: 90,
    DIGEST_MISMATCH_DENIED: 91,
  });

export interface AsfCompatibilityFenceAuthorityV1 {
  readonly activation: "NO_AUTHORITY";
  readonly grantedCapabilities: readonly string[];
  readonly installation: "NO_AUTHORITY";
}

export type AsfFenceVerdictV1 = (typeof ASF_COMPATIBILITY_FENCE_VERDICTS_V1)[number];

export type AsfFenceCapabilityEntryV1 = AsfCatalogueEntryV1;

export interface AsfCompatibilityRowV1 {
  readonly adapterId: string;
  readonly adapterVersion: string;
  readonly capabilityScope: typeof ASF_COMPATIBILITY_FENCE_CAPABILITY_SCOPE_V1;
  readonly capabilities: readonly AsfFenceCapabilityEntryV1[];
  readonly catalogDigest: string;
  readonly generationDigest: string;
  readonly lockDigest: string;
  readonly packDigest: string;
  readonly packId: string;
  readonly profileId: string;
  readonly profileVersion: string;
  readonly routeId: string;
  readonly routeVersion: string;
  readonly skillId: string;
  readonly verdict: AsfFenceVerdictV1;
  readonly version: string;
}

export interface AsfCompatibilityMatrixDocumentV1 {
  readonly authority: AsfCompatibilityFenceAuthorityV1;
  readonly catalogue: AsfCapabilityCatalogueV1;
  readonly limitations: readonly string[];
  readonly matrixDigest: string;
  readonly matrixId: string;
  readonly matrixVersion: string;
  readonly rows: readonly AsfCompatibilityRowV1[];
  readonly schemaVersion: typeof ASF_COMPATIBILITY_FENCE_SCHEMA_V1;
}

export interface AsfCompatibilityTupleV1 {
  readonly adapterId: string;
  readonly adapterVersion: string;
  readonly catalogDigest: string;
  readonly generationDigest: string;
  readonly lockDigest: string;
  readonly packDigest: string;
  readonly packId: string;
  readonly profileId: string;
  readonly profileVersion: string;
  readonly routeId: string;
  readonly routeVersion: string;
  readonly skillId: string;
  readonly version: string;
}

export interface AsfFenceQueryV1 extends AsfCompatibilityTupleV1 {
  readonly schemaVersion: typeof ASF_COMPATIBILITY_FENCE_QUERY_SCHEMA_V1;
}

export interface AsfCompatibilityMatrixReceiptV1 {
  readonly authority: AsfCompatibilityFenceAuthorityV1;
  readonly catalogDigest: string;
  readonly catalogId: string;
  readonly compatibleRows: number;
  readonly incompatibleRows: number;
  readonly matrixDigest: string;
  readonly matrixId: string;
  readonly matrixVersion: string;
  readonly receiptDigest: string;
  readonly rows: number;
  readonly schemaVersion: typeof ASF_COMPATIBILITY_FENCE_RECEIPT_SCHEMA_V1;
}

export interface AsfFenceProjectionV1 {
  readonly catalogDigest: string;
  readonly catalogId: string;
  readonly compatibleRows: number;
  readonly incompatibleRows: number;
  readonly matrixId: string;
  readonly matrixVersion: string;
  readonly rowCount: number;
  readonly skillIds: readonly string[];
}

export type AsfFenceDeniedResultV1 = {
  readonly exitCode: number;
  readonly outcome: "DENIED";
  readonly reasonCodes: readonly [(typeof ASF_COMPATIBILITY_FENCE_REASON_ORDER_V1)[number]];
};

export type AsfCompatibilityMatrixResultV1 =
  | {
      readonly canonicalJson: string;
      readonly exitCode: 0;
      readonly matrixDigest: string;
      readonly outcome: "ACCEPTED";
      readonly projection: AsfFenceProjectionV1;
      readonly reasonCodes: readonly ["ASF_COMPATIBILITY_FENCE_ACCEPTED"];
      readonly receipt: AsfCompatibilityMatrixReceiptV1;
      readonly receiptDigest: string;
      readonly receiptJson: string;
    }
  | AsfFenceDeniedResultV1;

export type AsfFenceResolutionResultV1 =
  | {
      readonly exitCode: 0;
      readonly matrixDigest: string;
      readonly outcome: "ACCEPTED";
      readonly reasonCodes: readonly ["ASF_COMPATIBILITY_FENCE_ACCEPTED"];
      readonly receipt: AsfCompatibilityMatrixReceiptV1;
      readonly receiptDigest: string;
      readonly receiptJson: string;
      readonly result: "COMPATIBLE";
      readonly row: AsfCompatibilityRowV1;
      readonly tupleDigest: string;
    }
  | AsfFenceDeniedResultV1;

const EXACT_VERSION = /^(?:0|[1-9][0-9]*)\.(?:0|[1-9][0-9]*)\.(?:0|[1-9][0-9]*)$/;
const DIGEST = /^[a-f0-9]{64}$/;
const MATRIX_ID = /^asffence:[a-z0-9][a-z0-9._-]{2,63}$/;
const SKILL_ID = /^skill:[a-z0-9][a-z0-9._-]{2,63}$/;
const PROFILE_ID = /^profile:[a-z0-9][a-z0-9._-]{2,63}$/;
const ADAPTER_ID = /^adapter:[a-z0-9][a-z0-9._-]{2,63}$/;
const PACK_ID = /^pack:[a-z0-9][a-z0-9._-]{2,63}$/;
const ROUTE_ID = /^route:[a-z0-9][a-z0-9._-]{2,63}$/;
const CAPABILITY_ID = /^capability:[a-z0-9][a-z0-9._-]{2,63}$/;
const CATALOG_ID = /^catalog:[a-z0-9][a-z0-9._-]{2,63}$/;
const UNRESOLVED = /(?:\$\{|{{|}}|<[^>]*>|latest|HEAD)/i;
const WILDCARD = /\*/;
const MATRIX_ROW_LIMIT = 64;
const CAPABILITY_LIMIT = 16;

const TOP_LEVEL_KEYS = [
  "authority",
  "catalogue",
  "limitations",
  "matrixDigest",
  "matrixId",
  "matrixVersion",
  "rows",
  "schemaVersion",
];

const TUPLE_KEYS = [
  "adapterId",
  "adapterVersion",
  "catalogDigest",
  "generationDigest",
  "lockDigest",
  "packDigest",
  "packId",
  "profileId",
  "profileVersion",
  "routeId",
  "routeVersion",
  "skillId",
  "version",
] as const;

const ROW_KEYS = [
  "adapterId",
  "adapterVersion",
  "capabilityScope",
  "capabilities",
  "catalogDigest",
  "generationDigest",
  "lockDigest",
  "packDigest",
  "packId",
  "profileId",
  "profileVersion",
  "routeId",
  "routeVersion",
  "skillId",
  "verdict",
  "version",
];

const QUERY_KEYS = [...TUPLE_KEYS, "schemaVersion"];
const CAPABILITY_ENTRY_KEYS = ["capabilityId", "digest", "version"];
const CATALOGUE_KEYS = ["catalogDigest", "catalogId", "entries"];
const RECEIPT_KEYS = [
  "authority",
  "catalogDigest",
  "catalogId",
  "compatibleRows",
  "incompatibleRows",
  "matrixDigest",
  "matrixId",
  "matrixVersion",
  "receiptDigest",
  "rows",
  "schemaVersion",
];

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    && Object.getPrototypeOf(value) === Object.prototype;
}

function exactKeys(value: unknown, keys: readonly string[]): value is Record<string, unknown> {
  return isRecord(value) && canonicalJson(Object.keys(value).sort()) === canonicalJson([...keys].sort());
}

function isDigest(value: unknown): value is string {
  return typeof value === "string" && DIGEST.test(value);
}

function isExactVersion(value: unknown): value is string {
  return typeof value === "string" && EXACT_VERSION.test(value);
}

function isValidId(value: unknown, pattern: RegExp): value is string {
  if (typeof value !== "string") return false;
  if (value.normalize("NFC") !== value) return false;
  if (UNRESOLVED.test(value)) return false;
  return pattern.test(value);
}

function isSafeCount(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0 && !Object.is(value, -0);
}

function isWildcard(value: unknown): boolean {
  return typeof value === "string" && WILDCARD.test(value);
}

function isUnresolved(value: unknown): boolean {
  return typeof value === "string" && UNRESOLVED.test(value);
}

function asfFenceDigest(value: unknown): string {
  return createHash("sha256").update(canonicalJson(value)).digest("hex");
}

function unescapeJsonString(text: string): string {
  let out = "";
  for (let index = 0; index < text.length; index += 1) {
    const char = text.charAt(index);
    if (char !== "\\") {
      out += char;
      continue;
    }
    const next = text.charAt(index + 1);
    if (next === "u") {
      const code = Number.parseInt(text.slice(index + 2, index + 6), 16);
      out += Number.isFinite(code) ? String.fromCodePoint(code) : "u";
      index += 5;
      continue;
    }
    const simple: Record<string, string> = { b: "\b", f: "\f", n: "\n", r: "\r", t: "\t" };
    out += next === '"' || next === "\\" || next === "/" ? next : simple[next] ?? next;
    index += 1;
  }
  return out;
}

/** Deterministic raw-text scan that reports a duplicated object key. */
function hasDuplicateKey(raw: string): boolean {
  const stack: (Set<string> | null)[] = [];
  let index = 0;
  while (index < raw.length) {
    const char = raw.charAt(index);
    if (char !== '"') {
      if (char === "{") stack.push(new Set<string>());
      else if (char === "[") stack.push(null);
      else if (char === "}" || char === "]") stack.pop();
      index += 1;
      continue;
    }
    let cursor = index + 1;
    let text = "";
    while (cursor < raw.length) {
      const current = raw.charAt(cursor);
      if (current === "\\") {
        text += current + raw.charAt(cursor + 1);
        cursor += 2;
        continue;
      }
      if (current === '"') break;
      text += current;
      cursor += 1;
    }
    if (cursor >= raw.length) return false;
    index = cursor + 1;
    let lookahead = index;
    while (lookahead < raw.length && " \t\n\r".includes(raw.charAt(lookahead))) lookahead += 1;
    if (lookahead < raw.length && raw.charAt(lookahead) === ":") {
      const top = stack[stack.length - 1];
      if (top) {
        const key = unescapeJsonString(text);
        if (top.has(key)) return true;
        top.add(key);
      }
    }
  }
  return false;
}

function compareCanonical(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function tupleCore(value: unknown): AsfCompatibilityTupleV1 | null {
  if (!isRecord(value)) return null;
  const core: Record<string, string> = {};
  for (const key of TUPLE_KEYS) {
    const entry = value[key];
    if (typeof entry !== "string") return null;
    core[key] = entry;
  }
  return core as unknown as AsfCompatibilityTupleV1;
}

function tupleKey(value: unknown): string | null {
  const core = tupleCore(value);
  return core === null ? null : canonicalJson(core);
}

function rowVerdicts(rows: readonly AsfCompatibilityRowV1[]): {
  readonly compatible: number;
  readonly incompatible: number;
} {
  let compatible = 0;
  let incompatible = 0;
  for (const row of rows) {
    if (row.verdict === "COMPATIBLE") compatible += 1;
    else incompatible += 1;
  }
  return { compatible, incompatible };
}

/**
 * Semantic fail-closed preflight over an accepted-shape matrix document.
 * Order encodes precedence: broad capability claims before unknown targets,
 * before mutable aliases, before stale catalogues, before unknown
 * capabilities.
 */
function preflightDenial(value: Record<string, unknown>): FenceDenial | null {
  const rows = Array.isArray(value.rows) ? value.rows : [];
  for (const row of rows) {
    if (!isRecord(row)) continue;
    if (row.capabilityScope !== ASF_COMPATIBILITY_FENCE_CAPABILITY_SCOPE_V1) {
      return "BROAD_CAPABILITY_DENIED";
    }
    const capabilities = Array.isArray(row.capabilities) ? row.capabilities : [];
    for (const capability of capabilities) {
      if (isRecord(capability) && isWildcard(capability.capabilityId)) {
        return "BROAD_CAPABILITY_DENIED";
      }
    }
  }
  for (const row of rows) {
    if (!isRecord(row)) continue;
    if ([row.skillId, row.profileId, row.adapterId, row.packId, row.routeId].some(isWildcard)) {
      return "UNKNOWN_TARGET_DENIED";
    }
  }
  for (const row of rows) {
    if (!isRecord(row)) continue;
    const idClaims: unknown[] = [
      value.matrixId,
      row.skillId,
      row.profileId,
      row.adapterId,
      row.packId,
      row.routeId,
    ];
    const versionClaims: unknown[] = [
      value.matrixVersion,
      row.version,
      row.profileVersion,
      row.adapterVersion,
      row.routeVersion,
    ];
    const capabilities = Array.isArray(row.capabilities) ? row.capabilities : [];
    for (const capability of capabilities) {
      if (!isRecord(capability)) continue;
      idClaims.push(capability.capabilityId);
      versionClaims.push(capability.version);
    }
    if (idClaims.some(isUnresolved) || versionClaims.some((claim) => !isExactVersion(claim))) {
      return "MUTABLE_ALIAS_OR_RANGE_DENIED";
    }
  }
  const catalogue = isRecord(value.catalogue) ? value.catalogue : null;
  if (catalogue !== null && isDigest(catalogue.catalogDigest)) {
    for (const row of rows) {
      if (isRecord(row) && row.catalogDigest !== catalogue.catalogDigest) {
        return "STALE_CATALOGUE_DENIED";
      }
    }
  }
  const entryIds = new Set<string>();
  if (catalogue !== null && Array.isArray(catalogue.entries)) {
    for (const entry of catalogue.entries) {
      if (isRecord(entry) && typeof entry.capabilityId === "string") {
        entryIds.add(entry.capabilityId);
      }
    }
  }
  for (const row of rows) {
    if (!isRecord(row)) continue;
    const capabilities = Array.isArray(row.capabilities) ? row.capabilities : [];
    for (const capability of capabilities) {
      if (isRecord(capability) && !entryIds.has(String(capability.capabilityId))) {
        return "UNKNOWN_CAPABILITY_DENIED";
      }
    }
  }
  return null;
}

function validAuthority(value: unknown): value is AsfCompatibilityFenceAuthorityV1 {
  return exactKeys(value, ["activation", "grantedCapabilities", "installation"])
    && value.activation === "NO_AUTHORITY"
    && value.installation === "NO_AUTHORITY"
    && Array.isArray(value.grantedCapabilities)
    && value.grantedCapabilities.length === 0;
}

function validLimitations(value: unknown): value is readonly string[] {
  return Array.isArray(value)
    && value.every((entry) => typeof entry === "string")
    && value.length === new Set(value).size
    && canonicalJson([...value].sort()) === canonicalJson([...ASF_FENCE_LIMITATIONS_V1].sort());
}

function validCapabilityEntry(value: unknown): value is AsfCatalogueEntryV1 {
  return exactKeys(value, CAPABILITY_ENTRY_KEYS)
    && isValidId(value.capabilityId, CAPABILITY_ID)
    && isDigest(value.digest)
    && isExactVersion(value.version);
}

function validCatalogue(value: unknown): value is AsfCapabilityCatalogueV1 {
  if (!exactKeys(value, CATALOGUE_KEYS)) return false;
  if (!isDigest(value.catalogDigest)) return false;
  if (!isValidId(value.catalogId, CATALOG_ID)) return false;
  if (!Array.isArray(value.entries) || value.entries.length < 1 || value.entries.length > MATRIX_ROW_LIMIT) {
    return false;
  }
  if (value.entries.some((entry) => !validCapabilityEntry(entry))) return false;
  const ids = value.entries.map((entry) => entry.capabilityId);
  return ids.length === new Set(ids).size;
}

function validRow(value: unknown): value is AsfCompatibilityRowV1 {
  if (!exactKeys(value, ROW_KEYS)) return false;
  if (value.capabilityScope !== ASF_COMPATIBILITY_FENCE_CAPABILITY_SCOPE_V1) return false;
  if (!ASF_COMPATIBILITY_FENCE_VERDICTS_V1.includes(value.verdict as AsfFenceVerdictV1)) {
    return false;
  }
  if (![value.generationDigest, value.lockDigest, value.packDigest, value.catalogDigest].every(isDigest)) {
    return false;
  }
  if (![value.version, value.profileVersion, value.adapterVersion, value.routeVersion].every(isExactVersion)) {
    return false;
  }
  if (!isValidId(value.skillId, SKILL_ID)) return false;
  if (!isValidId(value.profileId, PROFILE_ID)) return false;
  if (!isValidId(value.adapterId, ADAPTER_ID)) return false;
  if (!isValidId(value.packId, PACK_ID)) return false;
  if (!isValidId(value.routeId, ROUTE_ID)) return false;
  if (!Array.isArray(value.capabilities)
    || value.capabilities.length < 1
    || value.capabilities.length > CAPABILITY_LIMIT) {
    return false;
  }
  if (value.capabilities.some((capability) => !validCapabilityEntry(capability))) return false;
  const ids = value.capabilities.map((capability) => capability.capabilityId);
  return ids.length === new Set(ids).size;
}

function validDocumentShape(value: unknown): value is AsfCompatibilityMatrixDocumentV1 {
  if (!exactKeys(value, TOP_LEVEL_KEYS)) return false;
  if (value.schemaVersion !== ASF_COMPATIBILITY_FENCE_SCHEMA_V1) return false;
  if (!isExactVersion(value.matrixVersion)) return false;
  if (!isDigest(value.matrixDigest)) return false;
  if (!isValidId(value.matrixId, MATRIX_ID)) return false;
  if (!validAuthority(value.authority)) return false;
  if (!validLimitations(value.limitations)) return false;
  if (!validCatalogue(value.catalogue)) return false;
  if (!Array.isArray(value.rows) || value.rows.length < 1 || value.rows.length > MATRIX_ROW_LIMIT) {
    return false;
  }
  return value.rows.every((row) => validRow(row));
}

function normalizeDocument(document: AsfCompatibilityMatrixDocumentV1): AsfCompatibilityMatrixDocumentV1 {
  const entries = [...document.catalogue.entries].sort((left, right) =>
    compareCanonical(left.capabilityId, right.capabilityId));
  const rows = [...document.rows].map((row) => ({
    ...row,
    capabilities: [...row.capabilities].sort((left, right) =>
      compareCanonical(left.capabilityId, right.capabilityId)),
  }));
  rows.sort((left, right) => {
    const leftKey = tupleKey(left);
    const rightKey = tupleKey(right);
    return compareCanonical(leftKey === null ? "" : leftKey, rightKey === null ? "" : rightKey);
  });
  return {
    ...document,
    catalogue: { ...document.catalogue, entries },
    rows,
    limitations: [...document.limitations].sort(),
  };
}

function matrixCore(document: AsfCompatibilityMatrixDocumentV1): Record<string, unknown> {
  const core = { ...document } as Record<string, unknown>;
  delete core.matrixDigest;
  return core;
}

type FenceDenial = Exclude<AsfFenceReasonCodeV1, "ASF_COMPATIBILITY_FENCE_ACCEPTED">;

function denyResult(reason: FenceDenial): AsfFenceDeniedResultV1 {
  return { outcome: "DENIED", reasonCodes: [reason], exitCode: ASF_COMPATIBILITY_FENCE_EXIT_CODES_V1[reason] };
}

function verifyCore(value: unknown): {
  readonly result: AsfCompatibilityMatrixResultV1;
  readonly normalized: AsfCompatibilityMatrixDocumentV1 | null;
} {
  const deny = (reason: FenceDenial) => ({ result: denyResult(reason), normalized: null });
  if (!isRecord(value)) return deny("SCHEMA_DENIED");
  if (!exactKeys(value, TOP_LEVEL_KEYS)) {
    const version = (value as Record<string, unknown>).schemaVersion;
    if (typeof version === "string" && version !== ASF_COMPATIBILITY_FENCE_SCHEMA_V1) {
      return deny("UNSUPPORTED_VERSION_DENIED");
    }
    return deny("SCHEMA_DENIED");
  }
  if (value.schemaVersion !== ASF_COMPATIBILITY_FENCE_SCHEMA_V1) {
    return deny("UNSUPPORTED_VERSION_DENIED");
  }
  const preflight = preflightDenial(value);
  if (preflight !== null) return deny(preflight);
  if (!validDocumentShape(value)) return deny("SCHEMA_DENIED");
  const tupleKeys = value.rows.map((row) => tupleKey(row));
  if (tupleKeys.some((key) => key === null) || tupleKeys.length !== new Set(tupleKeys).size) {
    return deny("SCHEMA_DENIED");
  }
  const normalized = normalizeDocument(value);
  const catalogDigest = asfFenceDigest(normalized.catalogue.entries);
  if (catalogDigest !== normalized.catalogue.catalogDigest) {
    return deny("DIGEST_MISMATCH_DENIED");
  }
  for (const row of normalized.rows) {
    for (const capability of row.capabilities) {
      const entry = normalized.catalogue.entries.find(
        (candidate) => candidate.capabilityId === capability.capabilityId);
      if (entry === undefined
        || entry.digest !== capability.digest
        || entry.version !== capability.version) {
        return deny("DIGEST_MISMATCH_DENIED");
      }
    }
  }
  const matrixDigest = asfFenceDigest(matrixCore(normalized));
  if (matrixDigest !== normalized.matrixDigest) return deny("DIGEST_MISMATCH_DENIED");
  const counts = rowVerdicts(normalized.rows);
  const receiptCore: Omit<AsfCompatibilityMatrixReceiptV1, "receiptDigest"> = {
    authority: normalized.authority,
    catalogDigest: normalized.catalogue.catalogDigest,
    catalogId: normalized.catalogue.catalogId,
    compatibleRows: counts.compatible,
    incompatibleRows: counts.incompatible,
    matrixDigest: normalized.matrixDigest,
    matrixId: normalized.matrixId,
    matrixVersion: normalized.matrixVersion,
    rows: normalized.rows.length,
    schemaVersion: ASF_COMPATIBILITY_FENCE_RECEIPT_SCHEMA_V1,
  };
  const receipt: AsfCompatibilityMatrixReceiptV1 = {
    ...receiptCore,
    receiptDigest: asfFenceDigest(receiptCore),
  };
  const projection: AsfFenceProjectionV1 = {
    catalogDigest: normalized.catalogue.catalogDigest,
    catalogId: normalized.catalogue.catalogId,
    compatibleRows: counts.compatible,
    incompatibleRows: counts.incompatible,
    matrixId: normalized.matrixId,
    matrixVersion: normalized.matrixVersion,
    rowCount: normalized.rows.length,
    skillIds: [...new Set(normalized.rows.map((row) => row.skillId))].sort(compareCanonical),
  };
  const result: AsfCompatibilityMatrixResultV1 = {
    outcome: "ACCEPTED",
    reasonCodes: ["ASF_COMPATIBILITY_FENCE_ACCEPTED"],
    exitCode: 0,
    canonicalJson: canonicalJson(normalized),
    matrixDigest: normalized.matrixDigest,
    projection,
    receipt,
    receiptDigest: receipt.receiptDigest,
    receiptJson: canonicalJson(receipt),
  };
  return { result, normalized };
}

export function verifyAsfCompatibilityMatrixV1(value: unknown): AsfCompatibilityMatrixResultV1 {
  return verifyCore(value).result;
}

export function parseAsfCompatibilityMatrixV1(raw: string): AsfCompatibilityMatrixResultV1 {
  if (hasDuplicateKey(raw)) return denyResult("DUPLICATE_KEY_DENIED");
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return denyResult("INVALID_JSON_DENIED");
  }
  const { result, normalized } = verifyCore(parsed);
  if (result.outcome !== "ACCEPTED") return result;
  if (normalized === null || raw !== canonicalJson(normalized)) {
    return denyResult("NONCANONICAL_ENCODING_DENIED");
  }
  return result;
}

export function resolveAsfCompatibilityFenceV1(
  document: unknown,
  query: unknown,
): AsfFenceResolutionResultV1 {
  const { result, normalized } = verifyCore(document);
  if (result.outcome !== "ACCEPTED") return result;
  if (normalized === null) return denyResult("SCHEMA_DENIED");
  if (!exactKeys(query, QUERY_KEYS)) {
    const version = isRecord(query) ? query.schemaVersion : undefined;
    if (typeof version === "string" && version !== ASF_COMPATIBILITY_FENCE_QUERY_SCHEMA_V1) {
      return denyResult("UNSUPPORTED_VERSION_DENIED");
    }
    return denyResult("SCHEMA_DENIED");
  }
  if (query.schemaVersion !== ASF_COMPATIBILITY_FENCE_QUERY_SCHEMA_V1) {
    return denyResult("UNSUPPORTED_VERSION_DENIED");
  }
  const idClaims: unknown[] = [
    query.skillId,
    query.profileId,
    query.adapterId,
    query.packId,
    query.routeId,
  ];
  if (idClaims.some(isWildcard)) return denyResult("UNKNOWN_TARGET_DENIED");
  const versionClaims: unknown[] = [
    query.version,
    query.profileVersion,
    query.adapterVersion,
    query.routeVersion,
  ];
  if (idClaims.some(isUnresolved) || versionClaims.some((claim) => !isExactVersion(claim))) {
    return denyResult("MUTABLE_ALIAS_OR_RANGE_DENIED");
  }
  const queryCore = tupleCore(query);
  if (queryCore === null) return denyResult("SCHEMA_DENIED");
  const match = normalized.rows.find((row) => {
    for (const key of TUPLE_KEYS) {
      if (row[key] !== queryCore[key]) return false;
    }
    return true;
  });
  if (match === undefined) return denyResult("UNKNOWN_TARGET_DENIED");
  if (match.verdict === "INCOMPATIBLE") return denyResult("INCOMPATIBLE_TUPLE_DENIED");
  const resolution: AsfFenceResolutionResultV1 = {
    outcome: "ACCEPTED",
    reasonCodes: ["ASF_COMPATIBILITY_FENCE_ACCEPTED"],
    exitCode: 0,
    matrixDigest: result.matrixDigest,
    receipt: result.receipt,
    receiptDigest: result.receiptDigest,
    receiptJson: result.receiptJson,
    result: "COMPATIBLE",
    row: match,
    tupleDigest: asfFenceDigest(queryCore),
  };
  return resolution;
}

export function asfCompatibilityMatrixReceiptDigestV1(
  value: Omit<AsfCompatibilityMatrixReceiptV1, "receiptDigest"> | Record<string, unknown>,
): string {
  const core = { ...value } as Record<string, unknown>;
  delete core.receiptDigest;
  return asfFenceDigest(core);
}

export function validateAsfCompatibilityMatrixReceiptV1(
  value: unknown,
): value is AsfCompatibilityMatrixReceiptV1 {
  if (!exactKeys(value, RECEIPT_KEYS)) return false;
  if (value.schemaVersion !== ASF_COMPATIBILITY_FENCE_RECEIPT_SCHEMA_V1) return false;
  if (!isExactVersion(value.matrixVersion)) return false;
  if (!isDigest(value.catalogDigest) || !isDigest(value.matrixDigest) || !isDigest(value.receiptDigest)) {
    return false;
  }
  if (!isValidId(value.catalogId, CATALOG_ID) || !isValidId(value.matrixId, MATRIX_ID)) return false;
  if (!isSafeCount(value.rows) || !isSafeCount(value.compatibleRows) || !isSafeCount(value.incompatibleRows)) {
    return false;
  }
  if (canonicalJson(value.authority) !== canonicalJson(ASF_COMPATIBILITY_FENCE_AUTHORITY_V1)) {
    return false;
  }
  return asfCompatibilityMatrixReceiptDigestV1(value) === value.receiptDigest;
}