import { createHash } from "node:crypto";
import {
  asfAnalysisReceiptDigestV1,
  validateAsfAnalysisReceiptV1,
  type AsfAnalysisReceiptV1,
} from "./asf-analysis.js";
import {
  ASF_BUNDLE_LOCK_SCHEMA_V1,
  verifyAsfBundleLockV1,
  type AsfBundleLockDocumentV1,
} from "./asf-bundle-lock.js";
import {
  ASF_GENERATION_RECEIPT_SCHEMA_V1,
  type AsfGenerationReceiptV1,
} from "./asf-generation.js";
import { canonicalJson } from "./canonical-json.js";

export const ASF_INACTIVE_INSTALL_SCHEMA_V1 = "chimpmaera.asf/inactive-install/v1" as const;
export const ASF_INACTIVE_INSTALL_RECEIPT_SCHEMA_V1 = "chimpmaera.asf/inactive-install-receipt/v1" as const;
export const ASF_INACTIVE_INSTALL_STATE_V1 = "installed_inactive" as const;
export const ASF_INACTIVE_INSTALL_TARGET_STATE_V1 = "INSTALLED_INACTIVE" as const;

export const ASF_INACTIVE_INSTALL_AUTHORITY_V1 = Object.freeze({
  activation: "NO_AUTHORITY",
  execution: "NO_AUTHORITY",
  installation: "NO_AUTHORITY",
} as const);

export const ASF_INACTIVE_INSTALL_REASON_ORDER_V1 = [
  "ACTIVE_STATE_DENIED",
  "ANALYSIS_RECEIPT_DENIED",
  "DIGEST_MISMATCH_DENIED",
  "DUPLICATE_GENERATION_DENIED",
  "DUPLICATE_KEY_DENIED",
  "GENERATION_RECEIPT_DENIED",
  "INVALID_JSON_DENIED",
  "LOCK_BINDING_DENIED",
  "MUTABLE_ALIAS_DENIED",
  "MUTATION_CALLBACK_DENIED",
  "NONCANONICAL_ENCODING_DENIED",
  "SCHEMA_DENIED",
  "UNKNOWN_CAPABILITY_DENIED",
  "UNSUPPORTED_VERSION_DENIED",
] as const;

export type AsfInactiveInstallReasonCodeV1 =
  | "ASF_INACTIVE_INSTALL_ACCEPTED"
  | typeof ASF_INACTIVE_INSTALL_REASON_ORDER_V1[number];

export const ASF_INACTIVE_INSTALL_EXIT_CODES_V1: Readonly<Record<AsfInactiveInstallReasonCodeV1, number>> =
  Object.freeze({
    ASF_INACTIVE_INSTALL_ACCEPTED: 0,
    INVALID_JSON_DENIED: 60,
    DUPLICATE_KEY_DENIED: 61,
    NONCANONICAL_ENCODING_DENIED: 62,
    SCHEMA_DENIED: 63,
    UNSUPPORTED_VERSION_DENIED: 64,
    ACTIVE_STATE_DENIED: 65,
    MUTABLE_ALIAS_DENIED: 66,
    MUTATION_CALLBACK_DENIED: 67,
    UNKNOWN_CAPABILITY_DENIED: 68,
    DUPLICATE_GENERATION_DENIED: 69,
    ANALYSIS_RECEIPT_DENIED: 70,
    GENERATION_RECEIPT_DENIED: 71,
    LOCK_BINDING_DENIED: 72,
    DIGEST_MISMATCH_DENIED: 73,
  });

export interface AsfInstallGenerationReferenceV1 {
  readonly capabilityIds: readonly string[];
  readonly generationDigest: string;
  readonly lockDigest: string;
  readonly skillId: string;
  readonly version: string;
}

export interface AsfInstalledGenerationEntryV1 {
  readonly generationDigest: string;
  readonly lockDigest: string;
  readonly state: typeof ASF_INACTIVE_INSTALL_STATE_V1;
  readonly skillId: string;
  readonly version: string;
}

/**
 * The immutable semantic input to the local install decision. It references an
 * accepted generation (by digest and lock receipt), the accepted analysis
 * receipt, the complete accepted bundle lock document, and the current
 * installed-state projection. It grants no authority: the decision is
 * deterministic and local-only.
 */
export interface AsfInactiveInstallInputV1 {
  readonly analysisReceipt: AsfAnalysisReceiptV1;
  readonly generation: AsfInstallGenerationReferenceV1;
  readonly generationReceipt: AsfGenerationReceiptV1;
  readonly installed: readonly AsfInstalledGenerationEntryV1[];
  readonly lock: AsfBundleLockDocumentV1;
  readonly requestedState: typeof ASF_INACTIVE_INSTALL_TARGET_STATE_V1;
  readonly schemaVersion: typeof ASF_INACTIVE_INSTALL_SCHEMA_V1;
}

/**
 * The immutable install receipt. It records one accepted generation as
 * installed_inactive, bound by exact lock and analysis receipt references,
 * with zero execution and zero authority.
 */
export interface AsfInactiveInstallReceiptV1 {
  readonly analysisReceiptDigest: string;
  readonly authority: typeof ASF_INACTIVE_INSTALL_AUTHORITY_V1;
  readonly generationDigest: string;
  readonly generationReceiptDigest: string;
  readonly lockIdentity: string;
  readonly receiptDigest: string;
  readonly schemaVersion: typeof ASF_INACTIVE_INSTALL_RECEIPT_SCHEMA_V1;
  readonly skillId: string;
  readonly state: typeof ASF_INACTIVE_INSTALL_STATE_V1;
  readonly version: string;
}

export interface AsfInactiveInstallProjectionV1 {
  readonly installed: readonly AsfInstalledGenerationEntryV1[];
}

export type AsfInactiveInstallResultV1 =
  | {
      readonly outcome: "ACCEPTED";
      readonly reasonCodes: readonly ["ASF_INACTIVE_INSTALL_ACCEPTED"];
      readonly exitCode: 0;
      readonly canonicalJson: string;
      readonly projection: AsfInactiveInstallProjectionV1;
      readonly receipt: AsfInactiveInstallReceiptV1;
      readonly receiptDigest: string;
      readonly receiptJson: string;
      readonly stateTransition: {
        readonly from: "installed_inactive" | "uninstalled";
        readonly to: typeof ASF_INACTIVE_INSTALL_STATE_V1;
      };
    }
  | {
      readonly outcome: "DENIED";
      readonly reasonCodes: readonly [AsfInactiveInstallReasonCodeV1];
      readonly exitCode: number;
    };

const EXACT_VERSION = /^(?:0|[1-9][0-9]*)\.(?:0|[1-9][0-9]*)\.(?:0|[1-9][0-9]*)$/;
const DIGEST = /^[a-f0-9]{64}$/;
const SKILL_ID = /^skill:[a-z0-9][a-z0-9._-]{2,63}$/;
const UNRESOLVED = /(?:\$\{|{{|}}|<[^>]*>|latest|HEAD)/i;
const TOP_LEVEL_KEYS = [
  "analysisReceipt",
  "generation",
  "generationReceipt",
  "installed",
  "lock",
  "requestedState",
  "schemaVersion",
];
const GENERATION_KEYS = ["capabilityIds", "generationDigest", "lockDigest", "skillId", "version"];
const INSTALLED_KEYS = ["generationDigest", "lockDigest", "state", "skillId", "version"];
const GENERATION_RECEIPT_KEYS = [
  "canonicalBytesDigest",
  "outputDigest",
  "parentLock",
  "receiptDigest",
  "schemaVersion",
  "skillId",
  "sourceDigest",
  "version",
];
const RECEIPT_KEYS = [
  "analysisReceiptDigest",
  "authority",
  "generationDigest",
  "generationReceiptDigest",
  "lockIdentity",
  "receiptDigest",
  "schemaVersion",
  "skillId",
  "state",
  "version",
];
const MUTATION_CALLBACK_KEYS = new Set([
  "callback",
  "command",
  "exec",
  "handler",
  "mutation",
  "mutate",
  "oninstall",
  "onsuccess",
]);

type Denial = Exclude<AsfInactiveInstallReasonCodeV1, "ASF_INACTIVE_INSTALL_ACCEPTED">;

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

function isValidSkillId(value: unknown): value is string {
  if (typeof value !== "string") return false;
  if (value.normalize("NFC") !== value) return false;
  if (UNRESOLVED.test(value)) return false;
  return SKILL_ID.test(value);
}

function isUniqueNfc(ids: readonly string[]): boolean {
  return ids.length === new Set(ids.map((id) => id.normalize("NFC").toLowerCase())).size;
}

function asfInactiveInstallDigest(value: unknown): string {
  return createHash("sha256").update(canonicalJson(value)).digest("hex");
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

/** Deterministic deep scan for state-mutating callback fields. */
function hasMutationCallback(value: unknown): boolean {
  if (Array.isArray(value)) return value.some(hasMutationCallback);
  if (!isRecord(value)) return false;
  for (const [key, entry] of Object.entries(value)) {
    if (MUTATION_CALLBACK_KEYS.has(key.toLowerCase())) return true;
    if (hasMutationCallback(entry)) return true;
  }
  return false;
}

function installedConflict(existing: readonly AsfInstalledGenerationEntryV1[], target: AsfInstallGenerationReferenceV1): boolean {
  const bySkill = new Map<string, readonly AsfInstalledGenerationEntryV1[]>();
  for (const entry of existing) {
    const group = bySkill.get(entry.skillId) ?? [];
    bySkill.set(entry.skillId, [...group, entry]);
  }
  for (const group of bySkill.values()) {
    const digests = new Set<string>();
    const versions = new Set<string>();
    for (const entry of group) {
      digests.add(entry.generationDigest);
      versions.add(entry.version);
    }
    if (digests.size > 1 || versions.size > 1) return true;
  }
  const targetEntries = bySkill.get(target.skillId) ?? [];
  return targetEntries.some((entry) => entry.generationDigest !== target.generationDigest);
}

/** Semantic preflight denial over a top-level-exact document. */
function preflightDenial(value: Record<string, unknown>): Denial | null {
  if (hasMutationCallback(value)) return "MUTATION_CALLBACK_DENIED";
  if (Array.isArray(value.installed)) {
    for (const entry of value.installed) {
      if (isRecord(entry) && typeof entry.state === "string" && entry.state !== ASF_INACTIVE_INSTALL_STATE_V1) {
        return "ACTIVE_STATE_DENIED";
      }
    }
  }
  const versionClaims: unknown[] = [];
  const generation = isRecord(value.generation) ? value.generation : null;
  if (generation) versionClaims.push(generation.version, generation.skillId);
  if (Array.isArray(value.installed)) {
    for (const entry of value.installed) {
      if (isRecord(entry)) versionClaims.push(entry.version, entry.skillId);
    }
  }
  const entryIds = new Set<string>();
  const lockDocument = isRecord(value.lock) ? value.lock : null;
  if (lockDocument !== null) {
    const lockGeneration = isRecord(lockDocument.generation) ? lockDocument.generation : null;
    if (lockGeneration !== null) versionClaims.push(lockGeneration.version);
    const lockCatalogue = isRecord(lockDocument.capabilityCatalogue) ? lockDocument.capabilityCatalogue : null;
    if (lockCatalogue !== null && Array.isArray(lockCatalogue.entries)) {
      for (const entry of lockCatalogue.entries) {
        if (isRecord(entry)) {
          versionClaims.push(entry.version);
          if (typeof entry.capabilityId === "string") entryIds.add(entry.capabilityId);
        }
      }
    }
    const lockPack = isRecord(lockDocument.capabilityPack) ? lockDocument.capabilityPack : null;
    if (lockPack !== null && Array.isArray(lockPack.references)) {
      for (const reference of lockPack.references) {
        if (isRecord(reference)) versionClaims.push(reference.version);
      }
    }
  }
  if (versionClaims.some((claim) => typeof claim === "string" && UNRESOLVED.test(claim))) {
    return "MUTABLE_ALIAS_DENIED";
  }
  if (entryIds.size > 0 && generation !== null && Array.isArray(generation.capabilityIds)) {
    for (const capabilityId of generation.capabilityIds) {
      if (typeof capabilityId === "string" && !entryIds.has(capabilityId)) return "UNKNOWN_CAPABILITY_DENIED";
    }
  }
  if (Array.isArray(value.installed)) {
    const entries = value.installed.filter(isRecord) as unknown as AsfInstalledGenerationEntryV1[];
    if (generation !== null && installedConflict(entries, generation as unknown as AsfInstallGenerationReferenceV1)) {
      return "DUPLICATE_GENERATION_DENIED";
    }
  }
  return null;
}

function validGenerationReference(value: unknown): value is AsfInstallGenerationReferenceV1 {
  if (!exactKeys(value, GENERATION_KEYS)) return false;
  if (!isDigest(value.generationDigest) || !isDigest(value.lockDigest)) return false;
  if (!isValidSkillId(value.skillId) || !isExactVersion(value.version)) return false;
  return Array.isArray(value.capabilityIds)
    && value.capabilityIds.length >= 1
    && value.capabilityIds.length <= 64
    && value.capabilityIds.every((id) => typeof id === "string" && id.length > 0)
    && isUniqueNfc(value.capabilityIds as readonly string[]);
}

function validInstalledEntry(value: unknown): value is AsfInstalledGenerationEntryV1 {
  if (!exactKeys(value, INSTALLED_KEYS)) return false;
  return isDigest(value.generationDigest)
    && isDigest(value.lockDigest)
    && value.state === ASF_INACTIVE_INSTALL_STATE_V1
    && isValidSkillId(value.skillId)
    && isExactVersion(value.version);
}

function validGenerationReceipt(value: unknown): value is AsfGenerationReceiptV1 {
  if (!exactKeys(value, GENERATION_RECEIPT_KEYS)) return false;
  if (value.schemaVersion !== ASF_GENERATION_RECEIPT_SCHEMA_V1) return false;
  if (!isDigest(value.canonicalBytesDigest) || !isDigest(value.outputDigest)) return false;
  if (!isDigest(value.sourceDigest) || !isDigest(value.receiptDigest)) return false;
  if (!isValidSkillId(value.skillId) || !isExactVersion(value.version)) return false;
  return exactKeys(value.parentLock, ["lockIdentity", "schemaVersion"])
    && isDigest((value.parentLock as Record<string, unknown>).lockIdentity)
    && (value.parentLock as Record<string, unknown>).schemaVersion === ASF_BUNDLE_LOCK_SCHEMA_V1;
}

function denyResult(reason: Denial): Extract<AsfInactiveInstallResultV1, { outcome: "DENIED" }> {
  return { outcome: "DENIED", reasonCodes: [reason], exitCode: ASF_INACTIVE_INSTALL_EXIT_CODES_V1[reason] };
}

function verifyCore(value: unknown): {
  readonly result: AsfInactiveInstallResultV1;
  readonly normalized: AsfInactiveInstallInputV1 | null;
} {
  const deny = (reason: Denial) => ({ result: denyResult(reason), normalized: null });
  if (!isRecord(value)) return deny("SCHEMA_DENIED");
  if (!exactKeys(value, TOP_LEVEL_KEYS)) {
    const version = (value as Record<string, unknown>).schemaVersion;
    if (typeof version === "string" && version !== ASF_INACTIVE_INSTALL_SCHEMA_V1) {
      return deny("UNSUPPORTED_VERSION_DENIED");
    }
    return deny("SCHEMA_DENIED");
  }
  if (value.schemaVersion !== ASF_INACTIVE_INSTALL_SCHEMA_V1) return deny("UNSUPPORTED_VERSION_DENIED");
  if (typeof value.requestedState !== "string" || value.requestedState !== ASF_INACTIVE_INSTALL_TARGET_STATE_V1) {
    return deny("ACTIVE_STATE_DENIED");
  }
  const preflight = preflightDenial(value);
  if (preflight) return deny(preflight);
  if (!validGenerationReference(value.generation)) return deny("SCHEMA_DENIED");
  if (!Array.isArray(value.installed) || !value.installed.every(validInstalledEntry)) {
    return deny("SCHEMA_DENIED");
  }
  if (!exactKeys(value.generationReceipt, GENERATION_RECEIPT_KEYS)) return deny("SCHEMA_DENIED");
  if (!validGenerationReceipt(value.generationReceipt)) return deny("GENERATION_RECEIPT_DENIED");
  const installed = value.installed as readonly AsfInstalledGenerationEntryV1[];
  const generation = value.generation as AsfInstallGenerationReferenceV1;
  const generationReceipt = value.generationReceipt as AsfGenerationReceiptV1;
  const analysisReceipt = value.analysisReceipt;
  if (!validateAsfAnalysisReceiptV1(analysisReceipt)) return deny("ANALYSIS_RECEIPT_DENIED");
  if (asfInactiveInstallDigest(generationReceiptWithoutDigest(generationReceipt)) !== generationReceipt.receiptDigest) {
    return deny("GENERATION_RECEIPT_DENIED");
  }
  const lockCheck = verifyAsfBundleLockV1(value.lock);
  if (lockCheck.outcome !== "ACCEPTED") return deny("LOCK_BINDING_DENIED");
  const lockDocument = value.lock as AsfBundleLockDocumentV1;
  if (
    generationReceipt.skillId !== generation.skillId
    || generationReceipt.version !== generation.version
    || generationReceipt.parentLock.lockIdentity !== lockDocument.lock.lockIdentity
    || lockDocument.lock.generationDigest !== generation.generationDigest
    || lockDocument.generation.skillId !== generation.skillId
    || lockDocument.generation.version !== generation.version
    || generation.lockDigest !== lockDocument.lock.lockIdentity
    || analysisReceipt.generationDigest !== generation.generationDigest
    || analysisReceipt.lockDigest !== generation.lockDigest
    || analysisReceipt.receiptDigest !== asfAnalysisReceiptDigestV1(analysisReceipt)
    || generationReceipt.outputDigest !== generation.generationDigest
  ) {
    return deny("DIGEST_MISMATCH_DENIED");
  }
  const receiptCore: Omit<AsfInactiveInstallReceiptV1, "receiptDigest"> = {
    analysisReceiptDigest: analysisReceipt.receiptDigest,
    authority: { ...ASF_INACTIVE_INSTALL_AUTHORITY_V1 },
    generationDigest: generation.generationDigest,
    generationReceiptDigest: generationReceipt.receiptDigest,
    lockIdentity: lockDocument.lock.lockIdentity,
    schemaVersion: ASF_INACTIVE_INSTALL_RECEIPT_SCHEMA_V1,
    skillId: generation.skillId,
    state: ASF_INACTIVE_INSTALL_STATE_V1,
    version: generation.version,
  };
  const receipt: AsfInactiveInstallReceiptV1 = {
    ...receiptCore,
    receiptDigest: asfInactiveInstallDigest(receiptCore),
  };
  const existing = installed.find((entry) => entry.skillId === generation.skillId
    && entry.generationDigest === generation.generationDigest);
  const targetEntry: AsfInstalledGenerationEntryV1 = {
    generationDigest: generation.generationDigest,
    lockDigest: generation.lockDigest,
    state: ASF_INACTIVE_INSTALL_STATE_V1,
    skillId: generation.skillId,
    version: generation.version,
  };
  const projected = installed
    .filter((entry) => entry.skillId !== generation.skillId)
    .concat([targetEntry])
    .sort((left, right) => (left.skillId < right.skillId ? -1 : left.skillId > right.skillId ? 1 : 0));
  const normalized = value as unknown as AsfInactiveInstallInputV1;
  return {
    result: {
      outcome: "ACCEPTED",
      reasonCodes: ["ASF_INACTIVE_INSTALL_ACCEPTED"],
      exitCode: 0,
      canonicalJson: canonicalJson(normalized),
      projection: { installed: projected },
      receipt,
      receiptDigest: receipt.receiptDigest,
      receiptJson: canonicalJson(receipt),
      stateTransition: { from: existing === undefined ? "uninstalled" : "installed_inactive", to: ASF_INACTIVE_INSTALL_STATE_V1 },
    },
    normalized,
  };
}

function generationReceiptWithoutDigest(receipt: AsfGenerationReceiptV1): Record<string, unknown> {
  const core = { ...receipt } as Record<string, unknown>;
  delete core.receiptDigest;
  return core;
}

/**
 * Decides the deterministic local install transition to installed_inactive
 * for one accepted generation. Acceptance binds the accepted generation
 * receipt, the accepted analysis receipt, and the exact accepted bundle lock
 * document. Denial leaves the installed-state projection untouched.
 */
export function installAsfGenerationInactiveV1(value: unknown): AsfInactiveInstallResultV1 {
  return verifyCore(value).result;
}

/**
 * Fail-closed raw-text parse. Precedence: non-string to INVALID_JSON_DENIED,
 * duplicate object key to DUPLICATE_KEY_DENIED, JSON.parse failure to
 * INVALID_JSON_DENIED, verification to its result, and a raw encoding that is
 * not the canonical encoding to NONCANONICAL_ENCODING_DENIED.
 */
export function parseAsfInactiveInstallV1(raw: string): AsfInactiveInstallResultV1 {
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

/** Content digest of an install receipt core (the receipt minus receiptDigest). */
export function asfInactiveInstallReceiptDigestV1(
  value: Omit<AsfInactiveInstallReceiptV1, "receiptDigest"> | Record<string, unknown>,
): string {
  const core = { ...value } as Record<string, unknown>;
  delete core.receiptDigest;
  return asfInactiveInstallDigest(core);
}

/** Verifies an emitted install receipt, including its self digest. */
export function validateAsfInactiveInstallReceiptV1(value: unknown): value is AsfInactiveInstallReceiptV1 {
  return exactKeys(value, RECEIPT_KEYS)
    && value.schemaVersion === ASF_INACTIVE_INSTALL_RECEIPT_SCHEMA_V1
    && isDigest(value.analysisReceiptDigest)
    && isDigest(value.generationDigest)
    && isDigest(value.generationReceiptDigest)
    && isDigest(value.lockIdentity)
    && isDigest(value.receiptDigest)
    && value.state === ASF_INACTIVE_INSTALL_STATE_V1
    && isValidSkillId(value.skillId)
    && isExactVersion(value.version)
    && canonicalJson(value.authority) === canonicalJson(ASF_INACTIVE_INSTALL_AUTHORITY_V1)
    && asfInactiveInstallReceiptDigestV1(value) === value.receiptDigest;
}