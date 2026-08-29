/**
 * Pure canonical bundle and lock contract for one immutable content-addressed
 * skill generation with a finite capability pack reference.
 *
 * A bundle lock document binds one skill generation (content-addressed file
 * set) to a finite capability pack whose every reference is bound to an exact
 * catalogue entry. Verification is deterministic and fail-closed: parse,
 * canonicalize and verify all return an evidence-safe result union carrying a
 * closed reason-code set and a stable exit code.
 */
import { createHash } from "node:crypto";
import { canonicalJson } from "./canonical-json.js";

export const ASF_BUNDLE_LOCK_SCHEMA_V1 = "chimpmaera.asf/bundle-lock/v1" as const;
export const ASF_BUNDLE_LOCK_INTEGRATION_RECEIPT_SCHEMA_V1 =
  "chimpmaera.asf/bundle-lock-integration-receipt/v1" as const;
export const ASF_LOCK_VERSION_V1 = "1.0.0" as const;
export const ASF_GENERATION_FORMAT_V1 = "OPENCLAW_SKILL" as const;
export const ASF_GENERATION_ENTRYPOINT_V1 = "SKILL.md" as const;

export const ASF_LIMITATIONS_V1 = [
  "CONTENT_ADDRESSED_GENERATION_ONLY",
  "DISCOVERY_OR_PRESENCE_IS_NOT_AUTHORITY",
  "FINITE_CAPABILITY_PACK_ONLY",
  "LOCAL_DETERMINISTIC_CONTRACT_ONLY",
  "NO_INSTALLATION_OR_ACTIVATION_AUTHORITY",
  "NO_LIVE_REGISTRY_OR_SIGNATURE_PROOF",
] as const;

export type AsfBundleLockReasonCodeV1 =
  | "ASF_BUNDLE_LOCK_ACCEPTED"
  | "AUTHORITY_FIELD_MISSING_DENIED"
  | "CATALOGUE_BINDING_MISSING_DENIED"
  | "DIGEST_MISMATCH_DENIED"
  | "DUPLICATE_KEY_DENIED"
  | "INVALID_JSON_DENIED"
  | "MUTABLE_ALIAS_OR_RANGE_DENIED"
  | "NONCANONICAL_ENCODING_DENIED"
  | "SCHEMA_DENIED"
  | "UNKNOWN_CAPABILITY_DENIED"
  | "UNSUPPORTED_VERSION_DENIED";

export const ASF_BUNDLE_LOCK_EXIT_CODES_V1: Readonly<Record<AsfBundleLockReasonCodeV1, number>> = Object.freeze({
  ASF_BUNDLE_LOCK_ACCEPTED: 0,
  INVALID_JSON_DENIED: 20,
  DUPLICATE_KEY_DENIED: 21,
  NONCANONICAL_ENCODING_DENIED: 22,
  SCHEMA_DENIED: 23,
  UNSUPPORTED_VERSION_DENIED: 24,
  MUTABLE_ALIAS_OR_RANGE_DENIED: 25,
  CATALOGUE_BINDING_MISSING_DENIED: 26,
  AUTHORITY_FIELD_MISSING_DENIED: 27,
  UNKNOWN_CAPABILITY_DENIED: 28,
  DIGEST_MISMATCH_DENIED: 29,
});

export interface AsfGenerationFileV1 {
  readonly mediaType: "text/markdown" | "application/json" | "text/plain";
  readonly path: string;
  readonly role: "ENTRYPOINT" | "DOC" | "CONFIG" | "ASSET" | "TEST_FIXTURE";
  readonly size: number;
  readonly sha256: string;
}

export interface AsfGenerationSourceV1 {
  readonly kind: "LOCAL_CONTENT";
  readonly locator: string;
  readonly mutable: false;
}

export interface AsfGenerationV1 {
  readonly content: { readonly files: readonly AsfGenerationFileV1[] };
  readonly contentDigest: string;
  readonly entrypoint: typeof ASF_GENERATION_ENTRYPOINT_V1;
  readonly format: typeof ASF_GENERATION_FORMAT_V1;
  readonly skillId: string;
  readonly source: AsfGenerationSourceV1;
  readonly version: string;
}

export interface AsfCatalogueEntryV1 {
  readonly capabilityId: string;
  readonly digest: string;
  readonly version: string;
}

export interface AsfCapabilityCatalogueV1 {
  readonly catalogDigest: string;
  readonly catalogId: string;
  readonly entries: readonly AsfCatalogueEntryV1[];
}

export interface AsfCapabilityBindingV1 {
  readonly catalogDigest: string;
  readonly catalogId: string;
}

export interface AsfCapabilityReferenceV1 {
  readonly catalogueBinding: AsfCapabilityBindingV1;
  readonly capabilityId: string;
  readonly digest: string;
  readonly version: string;
}

export interface AsfCapabilityPackV1 {
  readonly packDigest: string;
  readonly packId: string;
  readonly references: readonly AsfCapabilityReferenceV1[];
}

export interface AsfRollbackV1 {
  readonly lkgLockIdentity: string;
  readonly mode: "RESTORE_EXACT_LOCK_OR_DENY";
}

export interface AsfLockV1 {
  readonly bundleBytesSha256: string;
  readonly bundleDigest: string;
  readonly bundleId: string;
  readonly catalogDigest: string;
  readonly generationDigest: string;
  readonly lockIdentity: string;
  readonly lockVersion: typeof ASF_LOCK_VERSION_V1;
  readonly packDigest: string;
  readonly rollback: AsfRollbackV1;
  readonly schemaVersion: typeof ASF_BUNDLE_LOCK_SCHEMA_V1;
  readonly source: AsfGenerationSourceV1;
}

/**
 * Bounded, self-digested evidence emitted only after a complete bundle lock
 * has been accepted. This is a decision receipt, not installation or
 * activation authority. It carries the exact immutable generation, catalogue,
 * pack, lock, source, and LKG rollback bindings used by the decision.
 */
export interface AsfBundleLockIntegrationReceiptV1 {
  readonly bundleBytesSha256: string;
  readonly bundleDigest: string;
  readonly bundleId: string;
  readonly catalogDigest: string;
  readonly generationDigest: string;
  readonly lockIdentity: string;
  readonly packDigest: string;
  readonly receiptDigest: string;
  readonly rollback: AsfRollbackV1;
  readonly schemaVersion: typeof ASF_BUNDLE_LOCK_INTEGRATION_RECEIPT_SCHEMA_V1;
  readonly source: AsfGenerationSourceV1;
}

export interface AsfAuthorityV1 {
  readonly activation: "NO_AUTHORITY";
  readonly grantedCapabilities: readonly [];
  readonly installation: "NO_AUTHORITY";
}

export interface AsfBundleLockDocumentV1 {
  readonly authority: AsfAuthorityV1;
  readonly bundleId: string;
  readonly capabilityCatalogue: AsfCapabilityCatalogueV1;
  readonly capabilityPack: AsfCapabilityPackV1;
  readonly generation: AsfGenerationV1;
  readonly limitations: readonly string[];
  readonly lock: AsfLockV1;
  readonly schemaVersion: typeof ASF_BUNDLE_LOCK_SCHEMA_V1;
}

export type AsfBundleLockResultV1 =
  | {
      readonly outcome: "ACCEPTED";
      readonly reasonCodes: readonly ["ASF_BUNDLE_LOCK_ACCEPTED"];
      readonly exitCode: 0;
      readonly canonicalJson: string;
      readonly bundleDigest: string;
      readonly lockIdentity: string;
      readonly projection: AsfBundleLockProjectionV1;
      readonly receipt: AsfBundleLockIntegrationReceiptV1;
      readonly receiptDigest: string;
      readonly receiptJson: string;
    }
  | { readonly outcome: "DENIED"; readonly reasonCodes: readonly [AsfBundleLockReasonCodeV1]; readonly exitCode: number };

export interface AsfBundleLockProjectionV1 {
  readonly bundleId: string;
  readonly bundleDigest: string;
  readonly capabilityIds: readonly string[];
  readonly catalogId: string;
  readonly catalogDigest: string;
  readonly catalogueEntries: number;
  readonly contentDigest: string;
  readonly generationVersion: string;
  readonly lockIdentity: string;
  readonly packId: string;
  readonly packDigest: string;
  readonly packReferences: number;
  readonly skillId: string;
}

export interface AsfGenerationFileInputV1 {
  readonly mediaType: AsfGenerationFileV1["mediaType"];
  readonly path: string;
  readonly role: AsfGenerationFileV1["role"];
  readonly size: number;
  readonly sha256: string;
}

export interface AsfCapabilityReferenceInputV1 {
  readonly capabilityId: string;
  readonly digest: string;
  readonly version: string;
}

export interface AsfBundleLockCoreInputV1 {
  readonly authority: AsfAuthorityV1;
  readonly bundleId: string;
  readonly capabilityCatalogue: Readonly<{
    readonly catalogId: string;
    readonly entries: readonly AsfCatalogueEntryV1[];
  }>;
  readonly capabilityPack: Readonly<{
    readonly packId: string;
    readonly references: readonly AsfCapabilityReferenceInputV1[];
  }>;
  readonly generation: Readonly<{
    readonly content: Readonly<{ readonly files: readonly AsfGenerationFileInputV1[] }>;
    readonly entrypoint: typeof ASF_GENERATION_ENTRYPOINT_V1;
    readonly format: typeof ASF_GENERATION_FORMAT_V1;
    readonly skillId: string;
    readonly source: AsfGenerationSourceV1;
    readonly version: string;
  }>;
  readonly limitations: readonly string[];
}

const EXACT_VERSION = /^(?:0|[1-9][0-9]*)\.(?:0|[1-9][0-9]*)\.(?:0|[1-9][0-9]*)$/;
const DIGEST = /^[a-f0-9]{64}$/;
const BUNDLE_ID = /^asfbundle:[a-z0-9][a-z0-9._-]{2,63}$/;
const SKILL_ID = /^skill:[a-z0-9][a-z0-9._-]{2,63}$/;
const CATALOG_ID = /^catalog:[a-z0-9][a-z0-9._-]{2,63}$/;
const PACK_ID = /^pack:[a-z0-9][a-z0-9._-]{2,63}$/;
const CAPABILITY_ID = /^capability:[a-z0-9][a-z0-9._-]{2,63}$/;
const FILE_PATH = /^[A-Za-z0-9._/-]+$/;
const UNRESOLVED = /(?:\$\{|{{|}}|<[^>]*>|latest|HEAD)/i;
const LOCAL_SOURCE_LOCATOR = /^local\+sha256:[a-f0-9]{64}$/;
const ASF_SOURCE_LOCATOR = /^asf-bundle\+sha256:[a-f0-9]{64}$/;
const FILE_MEDIA_TYPES = ["text/markdown", "application/json", "text/plain"] as const;
const FILE_ROLES = ["ENTRYPOINT", "DOC", "CONFIG", "ASSET", "TEST_FIXTURE"] as const;
const TOP_LEVEL_KEYS = ["authority", "bundleId", "capabilityCatalogue", "capabilityPack", "generation", "limitations", "lock", "schemaVersion"];
const INTEGRATION_RECEIPT_KEYS = [
  "bundleBytesSha256",
  "bundleDigest",
  "bundleId",
  "catalogDigest",
  "generationDigest",
  "lockIdentity",
  "packDigest",
  "receiptDigest",
  "rollback",
  "schemaVersion",
  "source",
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

function isValidPath(value: unknown): value is string {
  if (typeof value !== "string" || value.length === 0 || value.length > 160) return false;
  if (value.normalize("NFC") !== value) return false;
  if (!FILE_PATH.test(value) || value.startsWith("/") || value.includes("\\")) return false;
  if (UNRESOLVED.test(value)) return false;
  return !value.split("/").some((part) => part === "" || part === "." || part === "..");
}

function isUniqueNfc(ids: readonly string[]): boolean {
  return ids.length === new Set(ids.map((id) => id.normalize("NFC").toLowerCase())).size;
}

function validSource(value: unknown, locator: RegExp): value is AsfGenerationSourceV1 {
  return exactKeys(value, ["kind", "locator", "mutable"])
    && value.kind === "LOCAL_CONTENT"
    && value.mutable === false
    && typeof value.locator === "string"
    && locator.test(value.locator);
}

function validFile(value: unknown): value is AsfGenerationFileV1 {
  if (!exactKeys(value, ["mediaType", "path", "role", "sha256", "size"])) return false;
  if (!(FILE_MEDIA_TYPES as readonly string[]).includes(value.mediaType as string)) return false;
  if (!(FILE_ROLES as readonly string[]).includes(value.role as string)) return false;
  return isValidPath(value.path)
    && isDigest(value.sha256)
    && typeof value.size === "number"
    && Number.isSafeInteger(value.size)
    && !Object.is(value.size, -0)
    && value.size >= 0
    && value.size <= 131072;
}

function validFiles(value: unknown): value is readonly AsfGenerationFileV1[] {
  if (!Array.isArray(value) || value.length < 1 || value.length > 64) return false;
  if (!value.every(validFile)) return false;
  const files = value as readonly AsfGenerationFileV1[];
  if (!isUniqueNfc(files.map((file) => file.path))) return false;
  return files.some((file) => file.path === ASF_GENERATION_ENTRYPOINT_V1 && file.role === "ENTRYPOINT");
}

function validEntries(value: unknown): value is readonly AsfCatalogueEntryV1[] {
  if (!Array.isArray(value) || value.length < 1 || value.length > 64) return false;
  if (!value.every((entry) => exactKeys(entry, ["capabilityId", "digest", "version"])
    && isValidId((entry as Record<string, unknown>).capabilityId, CAPABILITY_ID)
    && isExactVersion((entry as Record<string, unknown>).version)
    && isDigest((entry as Record<string, unknown>).digest))) return false;
  const entries = value as readonly AsfCatalogueEntryV1[];
  return isUniqueNfc(entries.map((entry) => entry.capabilityId));
}

function validReference(value: unknown): value is AsfCapabilityReferenceV1 {
  if (!exactKeys(value, ["catalogueBinding", "capabilityId", "digest", "version"])) return false;
  if (!exactKeys(value.catalogueBinding, ["catalogDigest", "catalogId"])) return false;
  return isValidId(value.catalogueBinding.catalogId, CATALOG_ID)
    && isDigest(value.catalogueBinding.catalogDigest)
    && isValidId(value.capabilityId, CAPABILITY_ID)
    && isExactVersion(value.version)
    && isDigest(value.digest);
}

function validReferences(value: unknown): value is readonly AsfCapabilityReferenceV1[] {
  if (!Array.isArray(value) || value.length < 1 || value.length > 64) return false;
  if (!value.every(validReference)) return false;
  const references = value as readonly AsfCapabilityReferenceV1[];
  return isUniqueNfc(references.map((reference) => reference.capabilityId));
}

function validReferenceInputs(value: unknown): value is readonly AsfCapabilityReferenceInputV1[] {
  if (!Array.isArray(value) || value.length < 1 || value.length > 64) return false;
  if (!value.every((reference) => exactKeys(reference, ["capabilityId", "digest", "version"])
    && isValidId((reference as Record<string, unknown>).capabilityId, CAPABILITY_ID)
    && isExactVersion((reference as Record<string, unknown>).version)
    && isDigest((reference as Record<string, unknown>).digest))) return false;
  const references = value as readonly AsfCapabilityReferenceInputV1[];
  return isUniqueNfc(references.map((reference) => reference.capabilityId));
}

function validAuthority(value: unknown): value is AsfAuthorityV1 {
  return exactKeys(value, ["activation", "grantedCapabilities", "installation"])
    && value.activation === "NO_AUTHORITY"
    && value.installation === "NO_AUTHORITY"
    && Array.isArray(value.grantedCapabilities)
    && value.grantedCapabilities.length === 0;
}

function validLimitations(value: unknown): boolean {
  if (!Array.isArray(value) || value.length !== ASF_LIMITATIONS_V1.length) return false;
  if (!value.every((item) => typeof item === "string")) return false;
  return canonicalJson([...value].sort()) === canonicalJson([...ASF_LIMITATIONS_V1].sort());
}

function validGenerationShape(value: unknown): boolean {
  if (!exactKeys(value, ["content", "entrypoint", "format", "skillId", "source", "version"])) return false;
  if (value.entrypoint !== ASF_GENERATION_ENTRYPOINT_V1 || value.format !== ASF_GENERATION_FORMAT_V1) return false;
  if (!isExactVersion(value.version) || !isValidId(value.skillId, SKILL_ID)) return false;
  if (!validSource(value.source, LOCAL_SOURCE_LOCATOR)) return false;
  return exactKeys(value.content, ["files"]) && validFiles(value.content.files);
}

function validGeneration(value: unknown): value is AsfGenerationV1 {
  if (!exactKeys(value, ["content", "contentDigest", "entrypoint", "format", "skillId", "source", "version"])) return false;
  if (value.entrypoint !== ASF_GENERATION_ENTRYPOINT_V1 || value.format !== ASF_GENERATION_FORMAT_V1) return false;
  if (!isExactVersion(value.version) || !isValidId(value.skillId, SKILL_ID) || !isDigest(value.contentDigest)) return false;
  if (!validSource(value.source, LOCAL_SOURCE_LOCATOR)) return false;
  return exactKeys(value.content, ["files"]) && validFiles(value.content.files);
}

function validCatalogue(value: unknown): value is AsfCapabilityCatalogueV1 {
  if (!exactKeys(value, ["catalogDigest", "catalogId", "entries"])) return false;
  if (!isDigest(value.catalogDigest) || !isValidId(value.catalogId, CATALOG_ID)) return false;
  return validEntries(value.entries);
}

function validPack(value: unknown): value is AsfCapabilityPackV1 {
  if (!exactKeys(value, ["packDigest", "packId", "references"])) return false;
  if (!isDigest(value.packDigest) || !isValidId(value.packId, PACK_ID)) return false;
  return validReferences(value.references);
}

function validLockShape(value: unknown): value is AsfLockV1 {
  if (!exactKeys(value, ["bundleBytesSha256", "bundleDigest", "bundleId", "catalogDigest", "generationDigest",
    "lockIdentity", "lockVersion", "packDigest", "rollback", "schemaVersion", "source"])) return false;
  if (value.lockVersion !== ASF_LOCK_VERSION_V1 || value.schemaVersion !== ASF_BUNDLE_LOCK_SCHEMA_V1) return false;
  if (!isDigest(value.bundleBytesSha256) || !isDigest(value.bundleDigest) || !isDigest(value.catalogDigest)
    || !isDigest(value.generationDigest) || !isDigest(value.lockIdentity) || !isDigest(value.packDigest)) return false;
  if (!isValidId(value.bundleId, BUNDLE_ID)) return false;
  if (!exactKeys(value.rollback, ["lkgLockIdentity", "mode"])
    || value.rollback.mode !== "RESTORE_EXACT_LOCK_OR_DENY"
    || !isDigest(value.rollback.lkgLockIdentity)) return false;
  return validSource(value.source, ASF_SOURCE_LOCATOR);
}

function validRollback(value: unknown): value is AsfRollbackV1 {
  return exactKeys(value, ["lkgLockIdentity", "mode"])
    && value.mode === "RESTORE_EXACT_LOCK_OR_DENY"
    && isDigest(value.lkgLockIdentity);
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

/** Semantic preflight denial over a top-level-exact document. */
function preflightDenial(value: Record<string, unknown>): Denial | null {
  const generation = isRecord(value.generation) ? value.generation : null;
  const lock = isRecord(value.lock) ? value.lock : null;
  const catalogue = isRecord(value.capabilityCatalogue) ? value.capabilityCatalogue : null;
  const pack = isRecord(value.capabilityPack) ? value.capabilityPack : null;
  const sources = [generation?.source, lock?.source].filter(isRecord);
  if (sources.some((source) => source.mutable === true)) return "MUTABLE_ALIAS_OR_RANGE_DENIED";
  const locators = sources.map((source) => source.locator);
  if (locators.some((locator) => typeof locator === "string" && UNRESOLVED.test(locator))) {
    return "MUTABLE_ALIAS_OR_RANGE_DENIED";
  }
  const versionClaims: unknown[] = [generation?.version];
  if (Array.isArray(catalogue?.entries)) {
    for (const entry of catalogue.entries) {
      if (isRecord(entry)) versionClaims.push(entry.version);
    }
  }
  if (Array.isArray(pack?.references)) {
    for (const reference of pack.references) {
      if (isRecord(reference)) versionClaims.push(reference.version);
    }
  }
  if (versionClaims.some((claim) => typeof claim === "string" && !EXACT_VERSION.test(claim))) {
    return "MUTABLE_ALIAS_OR_RANGE_DENIED";
  }
  if (Array.isArray(pack?.references)) {
    for (const reference of pack.references) {
      if (isRecord(reference) && !("catalogueBinding" in reference)) return "CATALOGUE_BINDING_MISSING_DENIED";
    }
  }
  if (!("authority" in value)) return "AUTHORITY_FIELD_MISSING_DENIED";
  const entryIds = new Set<string>();
  if (Array.isArray(catalogue?.entries)) {
    for (const entry of catalogue.entries) {
      if (isRecord(entry) && typeof entry.capabilityId === "string") entryIds.add(entry.capabilityId);
    }
  }
  if (entryIds.size > 0 && Array.isArray(pack?.references)) {
    for (const reference of pack.references) {
      if (isRecord(reference) && typeof reference.capabilityId === "string" && !entryIds.has(reference.capabilityId)) {
        return "UNKNOWN_CAPABILITY_DENIED";
      }
    }
  }
  return null;
}

function compareCanonical(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function normalizeDocument(document: AsfBundleLockDocumentV1): AsfBundleLockDocumentV1 {
  const files = [...document.generation.content.files].sort((left, right) => compareCanonical(left.path, right.path));
  const entries = [...document.capabilityCatalogue.entries].sort((left, right) =>
    compareCanonical(left.capabilityId, right.capabilityId));
  const references = [...document.capabilityPack.references].sort((left, right) =>
    compareCanonical(left.capabilityId, right.capabilityId));
  return {
    ...document,
    generation: { ...document.generation, content: { files } },
    capabilityCatalogue: { ...document.capabilityCatalogue, entries },
    capabilityPack: { ...document.capabilityPack, references },
    limitations: [...document.limitations].sort(),
  };
}

function lockIdentityCore(lock: AsfLockV1): Record<string, unknown> {
  return {
    bundleBytesSha256: lock.bundleBytesSha256,
    bundleDigest: lock.bundleDigest,
    bundleId: lock.bundleId,
    catalogDigest: lock.catalogDigest,
    generationDigest: lock.generationDigest,
    lockVersion: lock.lockVersion,
    packDigest: lock.packDigest,
    schemaVersion: ASF_BUNDLE_LOCK_SCHEMA_V1,
  };
}

function boundReferences(
  references: readonly AsfCapabilityReferenceInputV1[],
  catalog: { readonly catalogDigest: string; readonly catalogId: string },
): readonly AsfCapabilityReferenceV1[] {
  return references.map((reference) => ({
    catalogueBinding: { catalogDigest: catalog.catalogDigest, catalogId: catalog.catalogId },
    capabilityId: reference.capabilityId,
    digest: reference.digest,
    version: reference.version,
  }));
}

export function asfBundleLockDigestV1(value: unknown): string {
  return createHash("sha256").update(canonicalJson(value)).digest("hex");
}

export function asfBundleLockIntegrationReceiptDigestV1(
  value: Omit<AsfBundleLockIntegrationReceiptV1, "receiptDigest"> | Record<string, unknown>,
): string {
  const core = { ...value } as Record<string, unknown>;
  delete core.receiptDigest;
  return asfBundleLockDigestV1(core);
}

/** Validates a standalone bounded bundle-lock decision receipt. */
export function validateAsfBundleLockIntegrationReceiptV1(value: unknown): value is AsfBundleLockIntegrationReceiptV1 {
  if (!exactKeys(value, INTEGRATION_RECEIPT_KEYS)) return false;
  if (value.schemaVersion !== ASF_BUNDLE_LOCK_INTEGRATION_RECEIPT_SCHEMA_V1
    || !isDigest(value.bundleBytesSha256)
    || !isDigest(value.bundleDigest)
    || !isValidId(value.bundleId, BUNDLE_ID)
    || !isDigest(value.catalogDigest)
    || !isDigest(value.generationDigest)
    || !isDigest(value.lockIdentity)
    || !isDigest(value.packDigest)
    || !isDigest(value.receiptDigest)
    || !validRollback(value.rollback)
    || !validSource(value.source, ASF_SOURCE_LOCATOR)) return false;
  return asfBundleLockIntegrationReceiptDigestV1(value) === value.receiptDigest;
}

function invalid(): never {
  throw new Error("ASF_BUNDLE_LOCK_CONTRACT_INVALID_DENIED");
}

function validCore(core: AsfBundleLockCoreInputV1): boolean {
  const record = core as unknown as Record<string, unknown>;
  if (!exactKeys(record, ["authority", "bundleId", "capabilityCatalogue", "capabilityPack", "generation", "limitations"])) {
    return false;
  }
  if (!isValidId(record.bundleId, BUNDLE_ID)) return false;
  if (!validGenerationShape(record.generation)) return false;
  const catalogue = record.capabilityCatalogue;
  if (!exactKeys(catalogue, ["catalogId", "entries"]) || !isValidId(catalogue.catalogId, CATALOG_ID)) return false;
  if (!validEntries(catalogue.entries)) return false;
  const pack = record.capabilityPack;
  if (!exactKeys(pack, ["packId", "references"]) || !isValidId(pack.packId, PACK_ID)) return false;
  if (!validReferenceInputs(pack.references)) return false;
  return validAuthority(record.authority) && validLimitations(record.limitations);
}

/**
 * Builds one complete, self-digested bundle lock document from a semantic
 * core. Every reference must bind to an exact catalogue entry (id, version
 * and digest); anything else throws ASF_BUNDLE_LOCK_CONTRACT_INVALID_DENIED.
 */
export function buildAsfBundleLockDocumentV1(core: AsfBundleLockCoreInputV1): AsfBundleLockDocumentV1 {
  if (!validCore(core)) invalid();
  const { bundleId, generation, capabilityCatalogue, capabilityPack } = core;
  const files = [...generation.content.files].sort((left, right) => compareCanonical(left.path, right.path));
  const entries = [...capabilityCatalogue.entries].sort((left, right) =>
    compareCanonical(left.capabilityId, right.capabilityId));
  const references = [...capabilityPack.references].sort((left, right) =>
    compareCanonical(left.capabilityId, right.capabilityId));
  const limitations = [...core.limitations].sort();
  const entryMap = new Map(entries.map((entry) => [entry.capabilityId, entry] as const));
  for (const reference of references) {
    const bound = entryMap.get(reference.capabilityId);
    if (bound === undefined || bound.version !== reference.version || bound.digest !== reference.digest) {
      invalid();
    }
  }
  const content = { files };
  const contentDigest = asfBundleLockDigestV1(content);
  const catalogDigest = asfBundleLockDigestV1(entries);
  const bound = boundReferences(references, { catalogDigest, catalogId: capabilityCatalogue.catalogId });
  const packDigest = asfBundleLockDigestV1(bound);
  const unsigned: Omit<AsfBundleLockDocumentV1, "lock"> = {
    authority: core.authority,
    bundleId,
    capabilityCatalogue: { catalogDigest, catalogId: capabilityCatalogue.catalogId, entries },
    capabilityPack: { packDigest, packId: capabilityPack.packId, references: bound },
    generation: {
      content,
      contentDigest,
      entrypoint: generation.entrypoint,
      format: generation.format,
      skillId: generation.skillId,
      source: generation.source,
      version: generation.version,
    },
    limitations,
    schemaVersion: ASF_BUNDLE_LOCK_SCHEMA_V1,
  };
  const bundleDigest = asfBundleLockDigestV1(unsigned);
  const lock: AsfLockV1 = {
    bundleBytesSha256: bundleDigest,
    bundleDigest,
    bundleId,
    catalogDigest,
    generationDigest: contentDigest,
    lockIdentity: asfBundleLockDigestV1({
      bundleBytesSha256: bundleDigest,
      bundleDigest,
      bundleId,
      catalogDigest,
      generationDigest: contentDigest,
      lockVersion: ASF_LOCK_VERSION_V1,
      packDigest,
      schemaVersion: ASF_BUNDLE_LOCK_SCHEMA_V1,
    }),
    lockVersion: ASF_LOCK_VERSION_V1,
    packDigest,
    rollback: { lkgLockIdentity: asfBundleLockDigestV1({
      bundleBytesSha256: bundleDigest,
      bundleDigest,
      bundleId,
      catalogDigest,
      generationDigest: contentDigest,
      lockVersion: ASF_LOCK_VERSION_V1,
      packDigest,
      schemaVersion: ASF_BUNDLE_LOCK_SCHEMA_V1,
    }), mode: "RESTORE_EXACT_LOCK_OR_DENY" },
    schemaVersion: ASF_BUNDLE_LOCK_SCHEMA_V1,
    source: {
      kind: "LOCAL_CONTENT",
      locator: `asf-bundle+sha256:${asfBundleLockDigestV1({
        bundleBytesSha256: bundleDigest,
        bundleDigest,
        bundleId,
        catalogDigest,
        generationDigest: contentDigest,
        lockVersion: ASF_LOCK_VERSION_V1,
        packDigest,
        schemaVersion: ASF_BUNDLE_LOCK_SCHEMA_V1,
      })}`,
      mutable: false,
    },
  };
  const document: AsfBundleLockDocumentV1 = { ...unsigned, lock };
  return document;
}

type Denial = Exclude<AsfBundleLockReasonCodeV1, "ASF_BUNDLE_LOCK_ACCEPTED">;

function denyResult(reason: Denial): AsfBundleLockResultV1 {
  return { outcome: "DENIED", reasonCodes: [reason], exitCode: ASF_BUNDLE_LOCK_EXIT_CODES_V1[reason] };
}

function verifyCore(value: unknown): { readonly result: AsfBundleLockResultV1; readonly normalized: AsfBundleLockDocumentV1 | null } {
  const deny = (reason: Denial) => ({ result: denyResult(reason), normalized: null });
  if (!isRecord(value)) return deny("SCHEMA_DENIED");
  if (!("authority" in value)) return deny("AUTHORITY_FIELD_MISSING_DENIED");
  if (!exactKeys(value, TOP_LEVEL_KEYS)) {
    const version = (value as Record<string, unknown>).schemaVersion;
    if (typeof version === "string" && version !== ASF_BUNDLE_LOCK_SCHEMA_V1) {
      return deny("UNSUPPORTED_VERSION_DENIED");
    }
    return deny("SCHEMA_DENIED");
  }
  if (value.schemaVersion !== ASF_BUNDLE_LOCK_SCHEMA_V1) return deny("UNSUPPORTED_VERSION_DENIED");
  const preflight = preflightDenial(value);
  if (preflight) return deny(preflight);
  if (!validGeneration(value.generation) || !validCatalogue(value.capabilityCatalogue)
    || !validPack(value.capabilityPack) || !validAuthority(value.authority)
    || !validLimitations(value.limitations) || !validLockShape(value.lock)) {
    return deny("SCHEMA_DENIED");
  }
  const normalized = normalizeDocument(value as unknown as AsfBundleLockDocumentV1);
  const contentDigest = asfBundleLockDigestV1(normalized.generation.content);
  const catalogDigest = asfBundleLockDigestV1(normalized.capabilityCatalogue.entries);
  const packDigest = asfBundleLockDigestV1(normalized.capabilityPack.references);
  const unsigned = Object.fromEntries(Object.entries(normalized).filter(([key]) => key !== "lock"));
  const bundleDigest = asfBundleLockDigestV1(unsigned);
  const lockIdentity = asfBundleLockDigestV1(lockIdentityCore(normalized.lock));
  const lock = normalized.lock;
  if (normalized.generation.contentDigest !== contentDigest
    || normalized.capabilityCatalogue.catalogDigest !== catalogDigest
    || normalized.capabilityPack.packDigest !== packDigest
    || lock.generationDigest !== contentDigest
    || lock.catalogDigest !== catalogDigest
    || lock.packDigest !== packDigest
    || lock.bundleId !== normalized.bundleId
    || lock.bundleDigest !== bundleDigest
    || lock.bundleBytesSha256 !== bundleDigest
    || lock.lockIdentity !== lockIdentity
    || lock.rollback.lkgLockIdentity !== lockIdentity
    || lock.source.locator !== `asf-bundle+sha256:${lockIdentity}`) {
    return deny("DIGEST_MISMATCH_DENIED");
  }
  const entryMap = new Map(normalized.capabilityCatalogue.entries.map((entry) => [entry.capabilityId, entry] as const));
  for (const reference of normalized.capabilityPack.references) {
    const entry = entryMap.get(reference.capabilityId);
    if (entry === undefined
      || entry.version !== reference.version
      || entry.digest !== reference.digest
      || reference.catalogueBinding.catalogId !== normalized.capabilityCatalogue.catalogId
      || reference.catalogueBinding.catalogDigest !== catalogDigest) {
      return deny("DIGEST_MISMATCH_DENIED");
    }
  }
  const rendered = canonicalJson(normalized);
  const projection: AsfBundleLockProjectionV1 = {
    bundleId: normalized.bundleId,
    bundleDigest,
    capabilityIds: normalized.capabilityPack.references.map((reference) => reference.capabilityId),
    catalogId: normalized.capabilityCatalogue.catalogId,
    catalogDigest,
    catalogueEntries: normalized.capabilityCatalogue.entries.length,
    contentDigest,
    generationVersion: normalized.generation.version,
    lockIdentity,
    packId: normalized.capabilityPack.packId,
    packDigest,
    packReferences: normalized.capabilityPack.references.length,
    skillId: normalized.generation.skillId,
  };
  const receiptCore: Omit<AsfBundleLockIntegrationReceiptV1, "receiptDigest"> = {
    bundleBytesSha256: lock.bundleBytesSha256,
    bundleDigest,
    bundleId: normalized.bundleId,
    catalogDigest,
    generationDigest: contentDigest,
    lockIdentity,
    packDigest,
    rollback: lock.rollback,
    schemaVersion: ASF_BUNDLE_LOCK_INTEGRATION_RECEIPT_SCHEMA_V1,
    source: lock.source,
  };
  const receipt: AsfBundleLockIntegrationReceiptV1 = Object.freeze({
    ...receiptCore,
    receiptDigest: asfBundleLockIntegrationReceiptDigestV1(receiptCore),
  });
  return {
    result: {
      outcome: "ACCEPTED",
      reasonCodes: ["ASF_BUNDLE_LOCK_ACCEPTED"],
      exitCode: 0,
      canonicalJson: rendered,
      bundleDigest,
      lockIdentity,
      projection,
      receipt,
      receiptDigest: receipt.receiptDigest,
      receiptJson: canonicalJson(receipt),
    },
    normalized,
  };
}

/**
 * Verifies a complete bundle lock document value (key order independent).
 * Acceptance requires every declared digest to match the recomputed
 * canonical digests.
 */
export function verifyAsfBundleLockV1(value: unknown): AsfBundleLockResultV1 {
  return verifyCore(value).result;
}

/**
 * Canonicalizes one semantic core (key order and list order independent) into
 * the deterministic accepted result: canonical bytes, bundle digest and lock
 * identity. Invalid cores deny with SCHEMA_DENIED.
 */
export function canonicalizeAsfBundleLockV1(core: AsfBundleLockCoreInputV1): AsfBundleLockResultV1 {
  let document: AsfBundleLockDocumentV1;
  try {
    document = buildAsfBundleLockDocumentV1(core);
  } catch {
    return denyResult("SCHEMA_DENIED");
  }
  return verifyCore(document).result;
}

/**
 * Parses raw bundle lock bytes. Fail-closed precedence: duplicated object
 * key, JSON validity, semantic verification, then byte-exact canonical
 * encoding. Accepted input must be byte-identical to the canonical form.
 */
export function parseAsfBundleLockV1(raw: string): AsfBundleLockResultV1 {
  if (typeof raw !== "string") return denyResult("INVALID_JSON_DENIED");
  if (hasDuplicateKey(raw)) return denyResult("DUPLICATE_KEY_DENIED");
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return denyResult("INVALID_JSON_DENIED");
  }
  const { result, normalized } = verifyCore(parsed);
  if (result.outcome !== "ACCEPTED" || normalized === null) return result;
  if (raw !== canonicalJson(normalized)) return denyResult("NONCANONICAL_ENCODING_DENIED");
  return result;
}