/**
 * Pure canonical deterministic generation projection for one immutable
 * content-addressed skill generation with a finite capability pack reference.
 *
 * The projection maps a canonical proposed source to an immutable generation
 * and a lock receipt. Verification is deterministic and fail-closed:
 * canonicalize and verify all return an evidence-safe result union carrying a
 * closed reason-code set and a stable exit code.
 *
 * Authority posture (no-authority declarations):
 * - content-addressed only: the generation is addressed by its digests alone
 * - discovery or presence is not authority
 * - finite capability pack only
 * - local deterministic contract only
 * - no installation or activation authority
 * - no live registry or signature proof
 *
 * The receipt binds, deterministically and in one document, the source digest
 * (over the canonical proposed source), the canonical bytes digest (over the
 * generated generation document), the output digest (the generation content
 * address) and the parent lock identity (the parent bundle lock).
 */
import { createHash } from "node:crypto";
import { canonicalJson } from "./canonical-json.js";
import { ASF_BUNDLE_LOCK_SCHEMA_V1 } from "./asf-bundle-lock.js";

/**
 * The canonicalization and hashing used by this module is frozen as
 * PANSPHAIRA_CANONICAL_JSON_SHA256_V1 and is intentionally NOT claimed to be
 * RFC 8785 / JCS. Object property names are sorted by ECMAScript default
 * UTF-16 code-unit order, general array order is preserved, and semantic sets
 * are sorted by their defined key before canonicalization. Digests are 64
 * lowercase hex characters with no prefix unless a locator field requires one.
 */

export const ASF_GENERATION_SOURCE_SCHEMA_V1 = "chimpmaera.asf/generation-source/v1";
export const ASF_GENERATION_RECEIPT_SCHEMA_V1 = "chimpmaera.asf/generation-receipt/v1";
export const ASF_GENERATION_FORMAT_V1 = "OPENCLAW_SKILL";
export const ASF_GENERATION_ENTRYPOINT_V1 = "SKILL.md";
export const ASF_GENERATION_PROPOSED_STATE_V1 = "PROPOSED";

export const ASF_GENERATION_LIMITATIONS_V1: readonly string[] = Object.freeze([
  "CONTENT_ADDRESSED_GENERATION_ONLY",
  "DISCOVERY_OR_PRESENCE_IS_NOT_AUTHORITY",
  "FINITE_CAPABILITY_PACK_ONLY",
  "LOCAL_DETERMINISTIC_CONTRACT_ONLY",
  "NO_INSTALLATION_OR_ACTIVATION_AUTHORITY",
  "NO_LIVE_REGISTRY_OR_SIGNATURE_PROOF",
]);

export type AsfGenerationReasonCodeV1 =
  | "ASF_GENERATION_ACCEPTED"
  | "AUTHORITY_FIELD_MISSING_DENIED"
  | "CATALOGUE_BINDING_MISSING_DENIED"
  | "DIGEST_MISMATCH_DENIED"
  | "DUPLICATE_KEY_DENIED"
  | "INVALID_JSON_DENIED"
  | "MUTABLE_ALIAS_OR_RANGE_DENIED"
  | "NONCANONICAL_ENCODING_DENIED"
  | "NONDETERMINISTIC_METADATA_DENIED"
  | "PREEXISTING_ACTIVE_STATE_DENIED"
  | "SCHEMA_DENIED"
  | "UNKNOWN_CAPABILITY_DENIED"
  | "UNSUPPORTED_VERSION_DENIED";

export const ASF_GENERATION_EXIT_CODES_V1: Readonly<Record<AsfGenerationReasonCodeV1, number>> =
  Object.freeze({
    ASF_GENERATION_ACCEPTED: 0,
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
    NONDETERMINISTIC_METADATA_DENIED: 30,
    PREEXISTING_ACTIVE_STATE_DENIED: 31,
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

export interface AsfGenerationContentV1 {
  readonly files: readonly AsfGenerationFileV1[];
}

export interface AsfGenerationV1 {
  readonly content: AsfGenerationContentV1;
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

export interface AsfAuthorityV1 {
  readonly activation: "NO_AUTHORITY";
  readonly grantedCapabilities: readonly string[];
  readonly installation: "NO_AUTHORITY";
}

export interface AsfGenerationMetadataV1 {
  readonly build: string;
  readonly sequence: number;
}

export interface AsfGenerationLifecycleV1 {
  readonly state: "PROPOSED";
}

export interface AsfParentLockV1 {
  readonly lockIdentity: string;
  readonly schemaVersion: typeof ASF_BUNDLE_LOCK_SCHEMA_V1;
}

/**
 * A canonical proposed source: the immutable semantic input to the generation
 * projection. It carries declared content/catalogue/pack digests that the
 * projection verifies, and references a parent bundle lock identity.
 */
export interface AsfProposedSourceV1 {
  readonly authority: AsfAuthorityV1;
  readonly capabilityCatalogue: AsfCapabilityCatalogueV1;
  readonly capabilityPack: AsfCapabilityPackV1;
  readonly generation: AsfGenerationV1;
  readonly lifecycle: AsfGenerationLifecycleV1;
  readonly limitations: readonly string[];
  readonly metadata: AsfGenerationMetadataV1;
  readonly parentLock: AsfParentLockV1;
  readonly schemaVersion: typeof ASF_GENERATION_SOURCE_SCHEMA_V1;
}

/**
 * The immutable lock receipt emitted by the projection. It binds the source
 * digest, the canonical bytes digest, the output digest and the parent lock
 * in one content-addressed document.
 */
export interface AsfGenerationReceiptV1 {
  readonly canonicalBytesDigest: string;
  readonly outputDigest: string;
  readonly parentLock: AsfParentLockV1;
  readonly receiptDigest: string;
  readonly schemaVersion: typeof ASF_GENERATION_RECEIPT_SCHEMA_V1;
  readonly skillId: string;
  readonly sourceDigest: string;
  readonly version: string;
}

export interface AsfGenerationProjectionV1 {
  readonly capabilityIds: readonly string[];
  readonly catalogueEntries: number;
  readonly catalogDigest: string;
  readonly catalogId: string;
  readonly canonicalBytesDigest: string;
  readonly contentDigest: string;
  readonly entrypoint: string;
  readonly format: string;
  readonly lifecycle: string;
  readonly metadataBuild: string;
  readonly metadataSequence: number;
  readonly outputDigest: string;
  readonly packDigest: string;
  readonly packId: string;
  readonly packReferences: number;
  readonly parentLockIdentity: string;
  readonly parentLockSchemaVersion: string;
  readonly receiptDigest: string;
  readonly sourceDigest: string;
  readonly skillId: string;
  readonly version: string;
}

export type AsfGenerationResultV1 =
  | {
      readonly outcome: "ACCEPTED";
      readonly reasonCodes: readonly [AsfGenerationReasonCodeV1];
      readonly exitCode: 0;
      /** Canonical bytes of the normalized proposed source (the input). */
      readonly canonicalJson: string;
      /** Canonical bytes of the immutable generated generation (the output). */
      readonly generationJson: string;
      /** Canonical bytes of the emitted receipt (the output). */
      readonly receiptJson: string;
      readonly sourceDigest: string;
      readonly canonicalBytesDigest: string;
      readonly outputDigest: string;
      readonly receiptDigest: string;
      readonly parentLockIdentity: string;
      readonly projection: AsfGenerationProjectionV1;
    }
  | {
      readonly outcome: "DENIED";
      readonly reasonCodes: readonly [AsfGenerationReasonCodeV1];
      readonly exitCode: number;
    };

type Denial = Exclude<AsfGenerationReasonCodeV1, "ASF_GENERATION_ACCEPTED">;

const EXACT_VERSION = /^(?:0|[1-9][0-9]*)\.(?:0|[1-9][0-9]*)\.(?:0|[1-9][0-9]*)$/;
const DIGEST = /^[a-f0-9]{64}$/;
const SKILL_ID = /^skill:[a-z0-9][a-z0-9._-]{2,63}$/;
const CATALOG_ID = /^catalog:[a-z0-9][a-z0-9._-]{2,63}$/;
const PACK_ID = /^pack:[a-z0-9][a-z0-9._-]{2,63}$/;
const CAPABILITY_ID = /^capability:[a-z0-9][a-z0-9._-]{2,63}$/;
const FILE_PATH = /^[A-Za-z0-9._/-]+$/;
const LOCAL_SOURCE_LOCATOR = /^local\+sha256:[a-f0-9]{64}$/;
const BUILD_ID = /^build:[a-z0-9][a-z0-9._-]{2,63}$/;
const TIMESTAMP_BUILD_ID = /^build:\d{8}t\d{6}z$/i;
const UNRESOLVED = /(?:\$\{|{{|}}|<[^>]*>|latest|HEAD)/i;

const SOURCE_TOP_LEVEL_KEYS = [
  "authority",
  "capabilityCatalogue",
  "capabilityPack",
  "generation",
  "lifecycle",
  "limitations",
  "metadata",
  "parentLock",
  "schemaVersion",
];
const GENERATION_KEYS = ["content", "contentDigest", "entrypoint", "format", "skillId", "source", "version"];
const CONTENT_KEYS = ["files"];
const FILE_KEYS = ["mediaType", "path", "role", "sha256", "size"];
const SOURCE_KEYS = ["kind", "locator", "mutable"];
const CATALOGUE_KEYS = ["catalogDigest", "catalogId", "entries"];
const ENTRY_KEYS = ["capabilityId", "digest", "version"];
const PACK_KEYS = ["packDigest", "packId", "references"];
const REFERENCE_KEYS = ["catalogueBinding", "capabilityId", "digest", "version"];
const BINDING_KEYS = ["catalogDigest", "catalogId"];
const AUTHORITY_KEYS = ["activation", "grantedCapabilities", "installation"];
const METADATA_KEYS = ["build", "sequence"];
const LIFECYCLE_KEYS = ["state"];
const PARENT_LOCK_KEYS = ["lockIdentity", "schemaVersion"];
const RECEIPT_KEYS = [
  "canonicalBytesDigest",
  "outputDigest",
  "parentLock",
  "receiptDigest",
  "schemaVersion",
  "skillId",
  "sourceDigest",
  "version",
];
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && Object.getPrototypeOf(value) === Object.prototype;
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
  const normalized = value.normalize("NFC");
  if (normalized !== value) return false;
  if (UNRESOLVED.test(value)) return false;
  return pattern.test(value);
}

function isValidPath(value: unknown): value is string {
  if (typeof value !== "string") return false;
  if (value.length < 1 || value.length > 160) return false;
  const normalized = value.normalize("NFC");
  if (normalized !== value) return false;
  if (!FILE_PATH.test(value)) return false;
  if (value.startsWith("/")) return false;
  if (value.includes("\\")) return false;
  if (UNRESOLVED.test(value)) return false;
  return value.split("/").every((part) => part.length > 0 && part !== "." && part !== "..");
}

function isUniqueNfc(values: readonly unknown[]): boolean {
  if (!values.every((value) => typeof value === "string")) return false;
  const normalized = values.map((value) => (value as string).normalize("NFC").toLowerCase());
  return new Set(normalized).size === normalized.length;
}

function validSource(value: unknown): value is AsfGenerationSourceV1 {
  return (
    exactKeys(value, SOURCE_KEYS) &&
    value.kind === "LOCAL_CONTENT" &&
    value.mutable === false &&
    typeof value.locator === "string" &&
    LOCAL_SOURCE_LOCATOR.test(value.locator) &&
    !UNRESOLVED.test(value.locator)
  );
}

function validFile(value: unknown): value is AsfGenerationFileV1 {
  return (
    exactKeys(value, FILE_KEYS) &&
    (value.mediaType === "text/markdown" || value.mediaType === "application/json" || value.mediaType === "text/plain") &&
    isValidPath(value.path) &&
    (value.role === "ENTRYPOINT" ||
      value.role === "DOC" ||
      value.role === "CONFIG" ||
      value.role === "ASSET" ||
      value.role === "TEST_FIXTURE") &&
    typeof value.size === "number" &&
    Number.isSafeInteger(value.size) &&
    value.size >= 0 &&
    !Object.is(value.size, -0) &&
    isDigest(value.sha256)
  );
}

function validFiles(value: unknown): value is readonly AsfGenerationFileV1[] {
  if (!Array.isArray(value) || value.length < 1 || value.length > 64) return false;
  if (!value.every(validFile)) return false;
  if (!isUniqueNfc(value.map((file) => file.path))) return false;
  return value.some((file) => file.role === "ENTRYPOINT" && file.path === ASF_GENERATION_ENTRYPOINT_V1);
}

function validEntries(value: unknown): value is readonly AsfCatalogueEntryV1[] {
  if (!Array.isArray(value) || value.length < 1 || value.length > 128) return false;
  if (!value.every((entry) => exactKeys(entry, ENTRY_KEYS))) return false;
  if (!value.every((entry) => isValidId(entry.capabilityId, CAPABILITY_ID) && isDigest(entry.digest) && isExactVersion(entry.version)))
    return false;
  return isUniqueNfc(value.map((entry) => entry.capabilityId));
}

function validBinding(value: unknown): value is AsfCapabilityBindingV1 {
  return exactKeys(value, BINDING_KEYS) && isDigest(value.catalogDigest) && isValidId(value.catalogId, CATALOG_ID);
}

function validReference(value: unknown): value is AsfCapabilityReferenceV1 {
  return (
    exactKeys(value, REFERENCE_KEYS) &&
    validBinding(value.catalogueBinding) &&
    isValidId(value.capabilityId, CAPABILITY_ID) &&
    isDigest(value.digest) &&
    isExactVersion(value.version)
  );
}

function validReferences(value: unknown): value is readonly AsfCapabilityReferenceV1[] {
  if (!Array.isArray(value) || value.length < 1 || value.length > 128) return false;
  if (!value.every(validReference)) return false;
  return isUniqueNfc(value.map((reference) => reference.capabilityId));
}

function validAuthority(value: unknown): value is AsfAuthorityV1 {
  return (
    exactKeys(value, AUTHORITY_KEYS) &&
    value.activation === "NO_AUTHORITY" &&
    value.installation === "NO_AUTHORITY" &&
    Array.isArray(value.grantedCapabilities) &&
    value.grantedCapabilities.length === 0
  );
}

function validLimitations(value: unknown): value is readonly string[] {
  if (!Array.isArray(value)) return false;
  return canonicalJson([...value].sort()) === canonicalJson([...ASF_GENERATION_LIMITATIONS_V1].sort());
}

function validMetadata(value: unknown): value is AsfGenerationMetadataV1 {
  if (!exactKeys(value, METADATA_KEYS)) return false;
  if (typeof value.build !== "string" || value.build.length === 0 || value.build.length > 64) return false;
  if (value.build.normalize("NFC") !== value.build) return false;
  if (!BUILD_ID.test(value.build) || TIMESTAMP_BUILD_ID.test(value.build) || UNRESOLVED.test(value.build)) return false;
  if (typeof value.sequence !== "number" || !Number.isSafeInteger(value.sequence)) return false;
  return value.sequence >= 0 && !Object.is(value.sequence, -0);
}

function validLifecycle(value: unknown): value is AsfGenerationLifecycleV1 {
  return exactKeys(value, LIFECYCLE_KEYS) && value.state === ASF_GENERATION_PROPOSED_STATE_V1;
}

function validParentLock(value: unknown): value is AsfParentLockV1 {
  return exactKeys(value, PARENT_LOCK_KEYS) && isDigest(value.lockIdentity) && value.schemaVersion === ASF_BUNDLE_LOCK_SCHEMA_V1;
}

function validGeneration(value: unknown): value is AsfGenerationV1 {
  if (!exactKeys(value, GENERATION_KEYS)) return false;
  if (!isDigest(value.contentDigest)) return false;
  if (value.entrypoint !== ASF_GENERATION_ENTRYPOINT_V1) return false;
  if (value.format !== ASF_GENERATION_FORMAT_V1) return false;
  if (!isValidId(value.skillId, SKILL_ID)) return false;
  if (!isExactVersion(value.version)) return false;
  if (!validSource(value.source)) return false;
  return exactKeys(value.content, CONTENT_KEYS) && validFiles(value.content.files);
}

function validCatalogue(value: unknown): value is AsfCapabilityCatalogueV1 {
  return (
    exactKeys(value, CATALOGUE_KEYS) &&
    isDigest(value.catalogDigest) &&
    isValidId(value.catalogId, CATALOG_ID) &&
    validEntries(value.entries)
  );
}

function validPack(value: unknown): value is AsfCapabilityPackV1 {
  return exactKeys(value, PACK_KEYS) && isDigest(value.packDigest) && isValidId(value.packId, PACK_ID) && validReferences(value.references);
}

function validSourceValue(value: unknown): value is AsfProposedSourceV1 {
  return (
    exactKeys(value, SOURCE_TOP_LEVEL_KEYS) &&
    validAuthority(value.authority) &&
    validCatalogue(value.capabilityCatalogue) &&
    validPack(value.capabilityPack) &&
    validGeneration(value.generation) &&
    validLimitations(value.limitations) &&
    validMetadata(value.metadata) &&
    validLifecycle(value.lifecycle) &&
    validParentLock(value.parentLock)
  );
}

function validReceipt(value: unknown): value is AsfGenerationReceiptV1 {
  return (
    exactKeys(value, RECEIPT_KEYS) &&
    isDigest(value.canonicalBytesDigest) &&
    isDigest(value.outputDigest) &&
    validParentLock(value.parentLock) &&
    isDigest(value.receiptDigest) &&
    value.schemaVersion === ASF_GENERATION_RECEIPT_SCHEMA_V1 &&
    isValidId(value.skillId, SKILL_ID) &&
    isDigest(value.sourceDigest) &&
    isExactVersion(value.version)
  );
}

function unescapeJsonString(value: string): string {
  try {
    return JSON.parse(`"${value}"`) as string;
  } catch {
    return value;
  }
}

/** Raw-text duplicate object-key detection, independent of JSON.parse. */
function hasDuplicateKey(raw: string): boolean {
  const objectKeys: Set<string>[] = [];
  let inString = false;
  let escaped = false;
  for (let index = 0; index < raw.length; index += 1) {
    const char = raw[index];
    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (char === "\\") {
        escaped = true;
      } else if (char === '"') {
        inString = false;
      }
      continue;
    }
    if (char === '"') {
      const end = nextStringEnd(raw, index);
      let cursor = end + 1;
      while (cursor < raw.length && /\s/.test(raw[cursor] ?? "")) cursor += 1;
      if (raw[cursor] === ":" && objectKeys.length > 0) {
        const key = unescapeJsonString(raw.slice(index + 1, end));
        const keys = objectKeys[objectKeys.length - 1];
        if (keys !== undefined) {
          if (keys.has(key)) return true;
          keys.add(key);
        }
        index = end;
        continue;
      }
      inString = true;
      continue;
    }
    if (char === "{") objectKeys.push(new Set<string>());
    else if (char === "}") objectKeys.pop();
  }
  return false;
}

function nextStringEnd(raw: string, openQuote: number): number {
  let index = openQuote + 1;
  while (index < raw.length) {
    if (raw[index] === "\\") {
      index += 2;
      continue;
    }
    if (raw[index] === '"') return index;
    index += 1;
  }
  return raw.length - 1;
}

/**
 * Semantic preflight denial: returns the most specific denial for a
 * well-formed-shape source before full digest verification.
 */
function preflightDenial(value: Record<string, unknown>): Denial | null {
  const generation = isRecord(value.generation) ? value.generation : null;
  const catalogue = isRecord(value.capabilityCatalogue) ? value.capabilityCatalogue : null;
  const pack = isRecord(value.capabilityPack) ? value.capabilityPack : null;
  const metadata = isRecord(value.metadata) ? value.metadata : null;
  const lifecycle = isRecord(value.lifecycle) ? value.lifecycle : null;
  const parentLock = isRecord(value.parentLock) ? value.parentLock : null;

  const source = generation !== null && isRecord(generation.source) ? generation.source : null;
  if (source !== null && source.mutable === true) return "MUTABLE_ALIAS_OR_RANGE_DENIED";
  if (source !== null && typeof source.locator === "string" && UNRESOLVED.test(source.locator)) return "MUTABLE_ALIAS_OR_RANGE_DENIED";

  const versionClaims: unknown[] = [];
  if (generation !== null) versionClaims.push(generation.version);
  if (catalogue !== null && Array.isArray(catalogue.entries)) {
    for (const entry of catalogue.entries) if (isRecord(entry)) versionClaims.push(entry.version);
  }
  if (pack !== null && Array.isArray(pack.references)) {
    for (const reference of pack.references) if (isRecord(reference)) versionClaims.push(reference.version);
  }
  if (versionClaims.some((claim) => typeof claim === "string" && !EXACT_VERSION.test(claim))) {
    return "MUTABLE_ALIAS_OR_RANGE_DENIED";
  }

  if (metadata !== null) {
    if (
      typeof metadata.sequence !== "number" ||
      !Number.isSafeInteger(metadata.sequence) ||
      Object.is(metadata.sequence, -0) ||
      metadata.sequence < 0
    ) {
      return "NONDETERMINISTIC_METADATA_DENIED";
    }
    if (
      typeof metadata.build !== "string" ||
      metadata.build.length < 1 ||
      metadata.build.length > 64 ||
      metadata.build.normalize("NFC") !== metadata.build ||
      !BUILD_ID.test(metadata.build) ||
      TIMESTAMP_BUILD_ID.test(metadata.build) ||
      UNRESOLVED.test(metadata.build)
    ) {
      return "NONDETERMINISTIC_METADATA_DENIED";
    }
  }

  if (lifecycle !== null && lifecycle.state !== ASF_GENERATION_PROPOSED_STATE_V1) return "PREEXISTING_ACTIVE_STATE_DENIED";

  if (parentLock !== null && typeof parentLock.schemaVersion === "string" && parentLock.schemaVersion !== ASF_BUNDLE_LOCK_SCHEMA_V1) {
    return "UNSUPPORTED_VERSION_DENIED";
  }

  if (pack !== null && Array.isArray(pack.references)) {
    for (const reference of pack.references) {
      if (isRecord(reference) && !("catalogueBinding" in reference)) return "CATALOGUE_BINDING_MISSING_DENIED";
    }
  }

  if (!("authority" in value)) return "AUTHORITY_FIELD_MISSING_DENIED";

  const entryIds = new Set<string>();
  if (catalogue !== null && Array.isArray(catalogue.entries)) {
    for (const entry of catalogue.entries) if (isRecord(entry) && typeof entry.capabilityId === "string") entryIds.add(entry.capabilityId);
  }
  if (entryIds.size > 0 && pack !== null && Array.isArray(pack.references)) {
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

function sortedFiles(files: readonly AsfGenerationFileV1[]): AsfGenerationFileV1[] {
  return [...files].sort((left, right) => compareCanonical(left.path, right.path));
}

function sortedEntries(entries: readonly AsfCatalogueEntryV1[]): AsfCatalogueEntryV1[] {
  return [...entries].sort((left, right) => compareCanonical(left.capabilityId, right.capabilityId));
}

function sortedReferences(references: readonly AsfCapabilityReferenceV1[]): AsfCapabilityReferenceV1[] {
  return [...references].sort((left, right) => compareCanonical(left.capabilityId, right.capabilityId));
}

/**
 * Normalize a well-shaped proposed source into its canonical form: sort the
 * semantic sets (files by path, entries and references by capabilityId,
 * limitations as a string set) so that equivalent representations canonicalize
 * to identical bytes.
 */
function normalizeSource(value: AsfProposedSourceV1): AsfProposedSourceV1 {
  return {
    authority: value.authority,
    capabilityCatalogue: {
      catalogDigest: value.capabilityCatalogue.catalogDigest,
      catalogId: value.capabilityCatalogue.catalogId,
      entries: sortedEntries(value.capabilityCatalogue.entries),
    },
    capabilityPack: {
      packDigest: value.capabilityPack.packDigest,
      packId: value.capabilityPack.packId,
      references: sortedReferences(value.capabilityPack.references),
    },
    generation: {
      content: { files: sortedFiles(value.generation.content.files) },
      contentDigest: value.generation.contentDigest,
      entrypoint: value.generation.entrypoint,
      format: value.generation.format,
      skillId: value.generation.skillId,
      source: value.generation.source,
      version: value.generation.version,
    },
    lifecycle: value.lifecycle,
    limitations: [...value.limitations].sort(compareCanonical),
    metadata: value.metadata,
    parentLock: value.parentLock,
    schemaVersion: value.schemaVersion,
  };
}

function asfGenerationDigestV1(value: unknown): string {
  return createHash("sha256").update(canonicalJson(value)).digest("hex");
}

function contentDigestOf(value: AsfProposedSourceV1): string {
  return asfGenerationDigestV1({ files: value.generation.content.files });
}

function catalogDigestOf(value: AsfProposedSourceV1): string {
  return asfGenerationDigestV1(value.capabilityCatalogue.entries);
}

function boundReferencesOf(value: AsfProposedSourceV1): AsfCapabilityReferenceV1[] {
  const { catalogDigest, catalogId } = value.capabilityCatalogue;
  return sortedReferences(value.capabilityPack.references).map((reference) => ({
    catalogueBinding: { catalogDigest, catalogId },
    capabilityId: reference.capabilityId,
    digest: reference.digest,
    version: reference.version,
  }));
}

function packDigestOf(value: AsfProposedSourceV1): string {
  return asfGenerationDigestV1(boundReferencesOf(value));
}

/** The immutable generation content-address core (everything except content). */
function generationCoreOf(value: AsfProposedSourceV1): Record<string, unknown> {
  return {
    catalogDigest: value.capabilityCatalogue.catalogDigest,
    contentDigest: value.generation.contentDigest,
    entrypoint: value.generation.entrypoint,
    format: value.generation.format,
    packDigest: value.capabilityPack.packDigest,
    skillId: value.generation.skillId,
    source: value.generation.source,
    version: value.generation.version,
  };
}

function outputDigestOf(value: AsfProposedSourceV1): string {
  return asfGenerationDigestV1(generationCoreOf(value));
}

/** The full generated generation document (core plus the content files). */
function generationDocumentOf(value: AsfProposedSourceV1): Record<string, unknown> {
  return {
    ...generationCoreOf(value),
    content: { files: value.generation.content.files },
  };
}

function canonicalBytesDigestOf(value: AsfProposedSourceV1): string {
  return asfGenerationDigestV1(generationDocumentOf(value));
}

function receiptCoreOf(value: AsfProposedSourceV1, digests: {
  canonicalBytesDigest: string;
  outputDigest: string;
  sourceDigest: string;
}): Record<string, unknown> {
  return {
    canonicalBytesDigest: digests.canonicalBytesDigest,
    outputDigest: digests.outputDigest,
    parentLock: value.parentLock,
    schemaVersion: ASF_GENERATION_RECEIPT_SCHEMA_V1,
    skillId: value.generation.skillId,
    sourceDigest: digests.sourceDigest,
    version: value.generation.version,
  };
}

function buildReceipt(value: AsfProposedSourceV1, digests: {
  canonicalBytesDigest: string;
  outputDigest: string;
  sourceDigest: string;
}): AsfGenerationReceiptV1 {
  const core = receiptCoreOf(value, digests);
  return {
    canonicalBytesDigest: digests.canonicalBytesDigest,
    outputDigest: digests.outputDigest,
    parentLock: value.parentLock,
    receiptDigest: asfGenerationDigestV1(core),
    schemaVersion: ASF_GENERATION_RECEIPT_SCHEMA_V1,
    skillId: value.generation.skillId,
    sourceDigest: digests.sourceDigest,
    version: value.generation.version,
  };
}

function projectionOf(value: AsfProposedSourceV1, receipt: AsfGenerationReceiptV1): AsfGenerationProjectionV1 {
  return {
    canonicalBytesDigest: receipt.canonicalBytesDigest,
    capabilityIds: sortedReferences(value.capabilityPack.references).map((reference) => reference.capabilityId),
    catalogDigest: value.capabilityCatalogue.catalogDigest,
    catalogId: value.capabilityCatalogue.catalogId,
    catalogueEntries: value.capabilityCatalogue.entries.length,
    contentDigest: value.generation.contentDigest,
    entrypoint: value.generation.entrypoint,
    format: value.generation.format,
    lifecycle: value.lifecycle.state,
    metadataBuild: value.metadata.build,
    metadataSequence: value.metadata.sequence,
    outputDigest: receipt.outputDigest,
    packDigest: value.capabilityPack.packDigest,
    packId: value.capabilityPack.packId,
    packReferences: value.capabilityPack.references.length,
    parentLockIdentity: value.parentLock.lockIdentity,
    parentLockSchemaVersion: value.parentLock.schemaVersion,
    receiptDigest: receipt.receiptDigest,
    skillId: value.generation.skillId,
    sourceDigest: receipt.sourceDigest,
    version: value.generation.version,
  };
}

/** Verify every reference binds to an exact catalogue entry. */
function referencesBindToCatalogue(value: AsfProposedSourceV1): boolean {
  const entryMap = new Map<string, AsfCatalogueEntryV1>();
  for (const entry of value.capabilityCatalogue.entries) entryMap.set(entry.capabilityId, entry);
  for (const reference of value.capabilityPack.references) {
    if (reference.catalogueBinding.catalogDigest !== value.capabilityCatalogue.catalogDigest) return false;
    if (reference.catalogueBinding.catalogId !== value.capabilityCatalogue.catalogId) return false;
    const entry = entryMap.get(reference.capabilityId);
    if (entry === undefined) return false;
    if (entry.digest !== reference.digest) return false;
    if (entry.version !== reference.version) return false;
  }
  return true;
}

function verifyCore(value: unknown): { result: AsfGenerationResultV1; normalized: AsfProposedSourceV1 | null } {
  if (!isRecord(value)) return { result: denyResult("SCHEMA_DENIED"), normalized: null };
  const version = value.schemaVersion;
  if (typeof version === "string" && version !== ASF_GENERATION_SOURCE_SCHEMA_V1) {
    return { result: denyResult("UNSUPPORTED_VERSION_DENIED"), normalized: null };
  }
  // The semantic preflight denials take precedence over the exact shape check,
  // so a missing authority field or an unknown capability reports its specific
  // code even when the source is otherwise malformed.
  const preflight = preflightDenial(value);
  if (preflight !== null) return { result: denyResult(preflight), normalized: null };
  if (!exactKeys(value, SOURCE_TOP_LEVEL_KEYS)) {
    return { result: denyResult("SCHEMA_DENIED"), normalized: null };
  }
  if (version !== ASF_GENERATION_SOURCE_SCHEMA_V1) {
    return { result: denyResult("UNSUPPORTED_VERSION_DENIED"), normalized: null };
  }

  if (!validSourceValue(value)) return { result: denyResult("SCHEMA_DENIED"), normalized: null };

  // Normalize the semantic sets first: digests are defined over the canonical
  // (sorted) form, so equivalent reorderings verify identically.
  const normalized = normalizeSource(value);
  if (normalized.generation.source.locator !== `local+sha256:${normalized.generation.contentDigest}`) {
    return { result: denyResult("DIGEST_MISMATCH_DENIED"), normalized: null };
  }
  if (contentDigestOf(normalized) !== normalized.generation.contentDigest) {
    return { result: denyResult("DIGEST_MISMATCH_DENIED"), normalized: null };
  }
  if (catalogDigestOf(normalized) !== normalized.capabilityCatalogue.catalogDigest) {
    return { result: denyResult("DIGEST_MISMATCH_DENIED"), normalized: null };
  }
  if (!referencesBindToCatalogue(normalized)) {
    return { result: denyResult("DIGEST_MISMATCH_DENIED"), normalized: null };
  }
  if (packDigestOf(normalized) !== normalized.capabilityPack.packDigest) {
    return { result: denyResult("DIGEST_MISMATCH_DENIED"), normalized: null };
  }
  const sourceDigest = asfGenerationDigestV1(normalized);
  const canonicalBytesDigest = canonicalBytesDigestOf(normalized);
  const outputDigest = outputDigestOf(normalized);
  const generationJson = canonicalJson(generationDocumentOf(normalized));
  const receipt = buildReceipt(normalized, { canonicalBytesDigest, outputDigest, sourceDigest });
  const projection = projectionOf(normalized, receipt);

  return {
    normalized,
    result: {
      canonicalBytesDigest,
      canonicalJson: canonicalJson(normalized),
      exitCode: 0,
      generationJson,
      outcome: "ACCEPTED",
      outputDigest,
      parentLockIdentity: normalized.parentLock.lockIdentity,
      projection,
      reasonCodes: ["ASF_GENERATION_ACCEPTED"],
      receiptDigest: receipt.receiptDigest,
      receiptJson: canonicalJson(receipt),
      sourceDigest,
    },
  };
}

function denyResult(reason: Denial): Extract<AsfGenerationResultV1, { outcome: "DENIED" }> {
  return { exitCode: ASF_GENERATION_EXIT_CODES_V1[reason], outcome: "DENIED", reasonCodes: [reason] };
}

export function verifyAsfGenerationV1(value: unknown): AsfGenerationResultV1 {
  return verifyCore(value).result;
}

/** Revalidate an immutable generation and its lock receipt as one tuple. */
export function verifyAsfGenerationFromLockV1(source: unknown, receipt: unknown): AsfGenerationResultV1 {
  const verified = verifyCore(source).result;
  if (verified.outcome !== "ACCEPTED") return verified;
  if (!validReceipt(receipt)) return denyResult("SCHEMA_DENIED");

  const receiptCore: Record<string, unknown> = { ...receipt };
  delete receiptCore.receiptDigest;
  if (asfGenerationDigestV1(receiptCore) !== receipt.receiptDigest) return denyResult("DIGEST_MISMATCH_DENIED");

  const expected = JSON.parse(verified.receiptJson) as AsfGenerationReceiptV1;
  if (
    receipt.canonicalBytesDigest !== expected.canonicalBytesDigest ||
    receipt.outputDigest !== expected.outputDigest ||
    receipt.sourceDigest !== expected.sourceDigest ||
    receipt.skillId !== expected.skillId ||
    receipt.version !== expected.version ||
    canonicalJson(receipt.parentLock) !== canonicalJson(expected.parentLock)
  ) {
    return denyResult("DIGEST_MISMATCH_DENIED");
  }
  return verified;
}

/**
 * Canonicalize a proposed source: key- and order-independent. Equivalent
 * representations (reordered object keys and arrays) canonicalize to identical
 * bytes and an identical generation and lock receipt.
 */
export function canonicalizeAsfGenerationV1(value: unknown): AsfGenerationResultV1 {
  return verifyCore(value).result;
}

/**
 * Fail-closed raw-text parse. Precedence: non-string to INVALID_JSON_DENIED,
 * duplicate top-level key to DUPLICATE_KEY_DENIED, JSON.parse failure to
 * INVALID_JSON_DENIED, verification to its result, and a raw encoding that is
 * not the canonical encoding to NONCANONICAL_ENCODING_DENIED.
 */
export function parseAsfGenerationV1(raw: string): AsfGenerationResultV1 {
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