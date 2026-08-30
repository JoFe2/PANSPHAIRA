import { createHash } from "node:crypto";

export const COMPONENT_VERSIONS = Object.freeze({ knowledgeContract: "v1", revalidator: "cks-12-revalidator@v1", fastPath: "cks-12-shadow-fast-path@v1" });
export const DENIAL_CODES = Object.freeze(["MISSING_INPUT", "VERSION_LOCK_MISMATCH", "STALE_KNOWLEDGE", "REVALIDATION_REQUIRED", "ROLLBACK_MUTATION", "UNKNOWN_VARIANT", "AUTHORITY_DENIED"] as const);
type DenialCode = typeof DENIAL_CODES[number];
type RecordValue = Record<string, unknown>;
export type Denied = { status: "DENIED"; reasonCodes: readonly DenialCode[]; details: readonly string[] };
export type RevalidationRequired = { status: "REVALIDATION_REQUIRED"; supersededKnowledgeVersion: string; replacementKnowledgeVersion: string; invalidatedDependencyIds: readonly string[]; authority: "NONE"; capabilityDelta: "NONE"; effect: "NONE" };
export type FastPathDenied = { status: "FAST_PATH_DENIED"; abortStatus: "ABORTED_UNKNOWN_VARIANT" | "ABORTED_KNOWLEDGE_DRIFT"; reasonCodes: readonly ("UNKNOWN_VARIANT" | "STALE_KNOWLEDGE")[]; slowPathEligible: true; authority: "NONE"; capabilityDelta: "NONE"; effect: "NONE" };

export function canonicalJson(value: unknown): string { if (value === null || typeof value === "boolean" || typeof value === "string") return JSON.stringify(value); if (typeof value === "number") { if (!Number.isFinite(value)) throw new TypeError("non-finite number"); return JSON.stringify(value); } if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`; if (typeof value !== "object" || Object.getPrototypeOf(value) !== Object.prototype) throw new TypeError("plain JSON required"); const object = value as RecordValue; return `{${Object.keys(object).sort().map((key) => `${JSON.stringify(key)}:${canonicalJson(object[key])}`).join(",")}}`; }
export const digest = (value: unknown): string => createHash("sha256").update(canonicalJson(value)).digest("hex");
const record = (value: unknown): value is RecordValue => value !== null && typeof value === "object" && !Array.isArray(value) && Object.getPrototypeOf(value) === Object.prototype;
const deny = (reasonCodes: DenialCode[], details: string[]): Denied => ({ status: "DENIED", reasonCodes: [...new Set(reasonCodes)].sort(), details });

/** Invalidates every dependency pinned to a superseded promoted Knowledge version. */
export function requireKnowledgeDriftRevalidation(input: unknown): RevalidationRequired | Denied {
  if (!record(input)) return deny(["MISSING_INPUT"], ["drift input must be a plain JSON object"]);
  if (!record(input.componentVersions) || canonicalJson(input.componentVersions) !== canonicalJson(COMPONENT_VERSIONS)) return deny(["VERSION_LOCK_MISMATCH"], ["component versions must exactly match the frozen lock"]);
  const oldKnowledge = input.supersededKnowledge; const replacement = input.replacementKnowledge; const dependencies = input.dependencies;
  if (!record(oldKnowledge) || oldKnowledge.state !== "PROMOTED_SYNTHETIC_ONLY" || typeof oldKnowledge.knowledgeId !== "string" || typeof oldKnowledge.knowledgeVersion !== "string" || typeof oldKnowledge.knowledgeSha256 !== "string" || !/^[0-9a-f]{64}$/.test(oldKnowledge.knowledgeSha256) || !record(replacement) || replacement.knowledgeId !== oldKnowledge.knowledgeId || typeof replacement.knowledgeVersion !== "string" || replacement.knowledgeVersion === oldKnowledge.knowledgeVersion || typeof replacement.knowledgeSha256 !== "string" || !/^[0-9a-f]{64}$/.test(replacement.knowledgeSha256) || replacement.knowledgeSha256 === oldKnowledge.knowledgeSha256 || !Array.isArray(dependencies) || dependencies.length === 0) return deny(["MISSING_INPUT"], ["superseded promoted Knowledge, a distinct digest-bound replacement, and dependencies are required"]);
  const ids: string[] = [];
  for (const dependency of dependencies) {
    if (!record(dependency) || typeof dependency.dependencyId !== "string" || dependency.knowledgeId !== oldKnowledge.knowledgeId || dependency.knowledgeVersion !== oldKnowledge.knowledgeVersion || dependency.state !== "PROMOTED_SYNTHETIC_ONLY") return deny(["STALE_KNOWLEDGE"], ["every invalidated dependency must bind the exact superseded promoted version"]);
    if (dependency.rollbackKnowledgeSha256 !== oldKnowledge.knowledgeSha256) return deny(["ROLLBACK_MUTATION"], ["rollback must remain bound to the immutable last-known-good Knowledge bytes"]);
    ids.push(dependency.dependencyId);
  }
  if (new Set(ids).size !== ids.length) return deny(["MISSING_INPUT"], ["dependency identifiers must be unique"]);
  return Object.freeze({ status: "REVALIDATION_REQUIRED", supersededKnowledgeVersion: oldKnowledge.knowledgeVersion as string, replacementKnowledgeVersion: replacement.knowledgeVersion as string, invalidatedDependencyIds: ids, authority: "NONE", capabilityDelta: "NONE", effect: "NONE" });
}
/** Never completes an unknown or drifted input; it preserves only separately governed slow-path eligibility. */
export function denyUnknownVariantFastPath(input: unknown): FastPathDenied {
  const drifted = record(input) && input.knowledgeState === "REVALIDATION_REQUIRED";
  return drifted ? { status: "FAST_PATH_DENIED", abortStatus: "ABORTED_KNOWLEDGE_DRIFT", reasonCodes: ["STALE_KNOWLEDGE"], slowPathEligible: true, authority: "NONE", capabilityDelta: "NONE", effect: "NONE" } : { status: "FAST_PATH_DENIED", abortStatus: "ABORTED_UNKNOWN_VARIANT", reasonCodes: ["UNKNOWN_VARIANT"], slowPathEligible: true, authority: "NONE", capabilityDelta: "NONE", effect: "NONE" };
}
export function createReceipt(fixtureSha256: string, outcomes: RecordValue): RecordValue { if (!/^[0-9a-f]{64}$/.test(fixtureSha256)) throw new TypeError("fixture digest must be lowercase SHA-256"); const body = { schemaVersion: "chimpmaera.cks/drift-fastpath-abort-receipt/v1", receiptId: "CKS-12-DRIFT-FASTPATH-ABORT-RECEIPT-V1", fixtureSha256, componentVersions: COMPONENT_VERSIONS, outcomes, status: "RECORDED", authority: "NONE", capabilityDelta: "NONE", effect: "NONE" }; return { ...body, receiptSha256: digest(body) }; }
