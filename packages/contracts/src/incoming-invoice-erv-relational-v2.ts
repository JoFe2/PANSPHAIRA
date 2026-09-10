import { canonicalJsonV1, sha256HexV1 } from "./incoming-invoice-intake.js";

// AP-04 relational hardening slice (v2). This is a NEW, versioned slice of the
// AP-04 ERV capability core: it adds explicit supplier / quantity / unit /
// currency relations, deterministic duplicate-reference-kind denial (no
// last-write-wins), and four distinct evidence dimensions
// (integrityVerified / originVerified / semanticsVerified / runtimeObserved).
// The historical v1 pack, contract, tests and schema are untouched and remain
// replayable byte-identical; this slice never rewrites that history.
//
// Terminology is exact: repeating this local compiler is DETERMINISTIC REPLAY
// of frozen local-synthetic inputs. It is not an external or system-of-record
// readback. The standalone core is authority-free: it evaluates local
// synthetic proof only, without ERP or posting.
export const AP04_ERV_RELATIONAL_CASE_PACK_SHA256_V2 = "a6888ec06f92d4236061b393c2ed3e0d7fd54ca9875558b9a3b7295d25fe6ae5" as const;
const AP04_ERV_RELATIONAL_CASE_PACK_CANONICAL_SHA256_V2 = "3f80e39ffcfa7f437f1995be33c0af931ba696c7dd408e0a9b0352298b88e565";
export const INCOMING_INVOICE_ERV_RELATIONAL_CASE_PACK_V2 = "chimpmaera.incoming-invoice/erv-relational-case-pack/v2" as const;
export const INCOMING_INVOICE_ERV_RELATIONAL_CORE_V2 = "chimpmaera.incoming-invoice/erv-relational-core/v2" as const;

const REFERENCE_KIND_V2: readonly string[] = ["SUPPLIER", "PURCHASE_ORDER", "RECEIPT", "INVOICE"];
const AMOUNT_KIND_V2: readonly string[] = ["INVOICE", "PURCHASE_ORDER", "RECEIPT"];
const RELATION_DIMENSION_V2: readonly string[] = ["SUPPLIER", "QUANTITY", "UNIT", "CURRENCY"];
const EFFECT_VOCABULARY_V2: readonly string[] = ["READ_SYNTHETIC", "WRITE_LOCAL_PROOF", "POST_PRODUCTIVE", "ALLOCATE_PRODUCTIVE"];
const PRODUCTIVE_EFFECTS_V2 = new Set(["POST_PRODUCTIVE", "ALLOCATE_PRODUCTIVE"]);
// Frozen origin of the v2 evidence: the locator must point into this frozen
// fixture and the generator must be the frozen hand-authored generator.
const RELATIONAL_PACK_LOCATOR_PREFIX_V2 = "tests/fixtures/incoming-invoice/ap-04-erv-relational-cases-v2.json#";
const RELATIONAL_EVIDENCE_GENERATOR_V2 = "AP-04_RELATIONAL_FROZEN_HAND_AUTHORED_V2";

export type ErvRelationalReferenceKindV2 = "SUPPLIER" | "PURCHASE_ORDER" | "RECEIPT" | "INVOICE";
export type ErvRelationalAmountKindV2 = "INVOICE" | "PURCHASE_ORDER" | "RECEIPT";
export type ErvRelationalDimensionV2 = "SUPPLIER" | "QUANTITY" | "UNIT" | "CURRENCY";

export interface ErvRelationalReferenceBodyV2 {
  readonly referenceKind: ErvRelationalReferenceKindV2;
  readonly referenceId: string;
  readonly supplierId: string;
  readonly matchAmountMinor: number;
  readonly quantity: number;
  readonly unit: string;
  readonly currency: string;
}
export interface ErvRelationalEvidenceBindingV2 {
  readonly sourceKind: "LOCAL_SYNTHETIC_FIXTURE";
  readonly locator: string;
  readonly generator: string;
  readonly contentSha256: string;
}
export interface ErvRelationalEvidenceReferenceV2 {
  readonly body: ErvRelationalReferenceBodyV2;
  readonly evidence: ErvRelationalEvidenceBindingV2;
}
export interface ErvRelationalMatchingModeVariantV2 {
  readonly variantId: string;
  readonly version: string;
  readonly requiredKinds: readonly ErvRelationalReferenceKindV2[];
  readonly amountKinds: readonly ErvRelationalAmountKindV2[];
  readonly relationDimensions: readonly ErvRelationalDimensionV2[];
}
export interface ErvRelationalTolerancePolicyVariantV2 {
  readonly variantId: string;
  readonly version: string;
  readonly absoluteToleranceMinor: number;
  readonly rateBasisPoints: number;
}
export interface ErvRelationalVariantSelectionRefV2 {
  readonly variantId: string;
  readonly version: string;
}
export interface ErvRelationalCaseV2 {
  readonly caseId: string;
  readonly matchingMode: ErvRelationalVariantSelectionRefV2;
  readonly tolerancePolicy: ErvRelationalVariantSelectionRefV2;
  readonly requestedEffects: readonly string[];
  readonly references: readonly ErvRelationalEvidenceReferenceV2[];
}
export interface ErvRelationalCasePackV2 {
  readonly schemaVersion: typeof INCOMING_INVOICE_ERV_RELATIONAL_CASE_PACK_V2;
  readonly packId: string;
  readonly frozenAt: string;
  readonly authority: Readonly<{ mode: "LOCAL_SYNTHETIC_PROOF"; customerData: false; externalProvider: false; productivePosting: false }>;
  readonly variants: Readonly<{ matchingModes: readonly ErvRelationalMatchingModeVariantV2[]; tolerancePolicies: readonly ErvRelationalTolerancePolicyVariantV2[] }>;
  readonly cases: readonly ErvRelationalCaseV2[];
}

export type ErvRelationalExceptionCodeV2 = "UNVERIFIED_REFERENCE_EVIDENCE" | "ORIGIN_NOT_VERIFIED" | "DUPLICATE_REFERENCE_KIND" | "MISSING_CONTEXT" | "UNKNOWN_VARIANT";
export type ErvRelationalDeniedReasonCodeV2 = "RISK_D_AUTHORIZATION_REQUIRED";
export type ErvRelationalUnknownCodeV2 = "SUPPLIER_RELATION_NOT_VERIFIED";
export type ErvRelationalConflictKindV2 = "AMOUNT" | "SUPPLIER_RELATION" | "QUANTITY_RELATION" | "UNIT_RELATION" | "CURRENCY_RELATION";

export interface ErvRelationalVariantEchoV2 {
  readonly matchingModeId: string;
  readonly matchingModeVersion: string;
  readonly tolerancePolicyId: string;
  readonly tolerancePolicyVersion: string;
}
export interface ErvRelationalEvidenceCitationV2 {
  readonly referenceKind: ErvRelationalReferenceKindV2;
  readonly referenceId: string;
  readonly contentSha256: string;
  readonly recomputedContentSha256: string;
  readonly integrityVerified: boolean;
  readonly originVerified: boolean;
}
export interface ErvRelationalEvidenceDimensionsV2 {
  readonly integrityVerified: boolean;
  readonly originVerified: boolean;
  readonly semanticsVerified: boolean;
  readonly runtimeObserved: boolean;
}
export interface ErvRelationalAdvisorCitationV2 {
  readonly referenceKind: ErvRelationalReferenceKindV2;
  readonly referenceId: string;
  readonly evidenceSha256: string;
}
export interface ErvRelationalAdvisorQuestionV2 {
  readonly questionId: string;
  readonly questionText: string;
  readonly citations: readonly ErvRelationalAdvisorCitationV2[];
}
export interface ErvRelationalAdvisorV2 {
  readonly questions: readonly ErvRelationalAdvisorQuestionV2[];
  readonly advisorAuthority: "EVIDENCE_CITING_ONLY";
  readonly bookingAuthorityGranted: false;
}
export interface ErvRelationalCaseAuthorityV2 {
  readonly productivePostingAuthorized: false;
  readonly bookingAuthorityGranted: false;
  readonly riskDCapability: "SEPARATELY_AUTHORIZED";
}
export type ErvRelationalConflictDetailV2 =
  | Readonly<{ conflictKind: "AMOUNT"; minReferenceId: string; minAmountMinor: number; maxReferenceId: string; maxAmountMinor: number; deltaMinor: number; toleranceMinor: number; tolerancePolicyId: string; tolerancePolicyVersion: string }>
  | Readonly<{ conflictKind: "SUPPLIER_RELATION" | "QUANTITY_RELATION" | "UNIT_RELATION" | "CURRENCY_RELATION"; observed: ReadonlyArray<Readonly<{ value: string | number; referenceIds: readonly string[] }>> }>;
export interface ErvRelationalVerifiedRelationsV2 {
  readonly supplierId: string;
  readonly quantity: number;
  readonly unit: string;
  readonly currency: string;
}

export type ErvRelationalCaseDecisionV2 =
  | Readonly<{ caseId: string; outcome: "MATCHED"; variant: ErvRelationalVariantEchoV2; matchedAmountMinor: number; relations: ErvRelationalVerifiedRelationsV2; evidenceCitations: readonly ErvRelationalEvidenceCitationV2[]; evidenceDimensions: ErvRelationalEvidenceDimensionsV2; advisor: ErvRelationalAdvisorV2; authority: ErvRelationalCaseAuthorityV2 }>
  | Readonly<{ caseId: string; outcome: "CONFLICT"; variant: ErvRelationalVariantEchoV2; conflict: ErvRelationalConflictDetailV2; evidenceCitations: readonly ErvRelationalEvidenceCitationV2[]; evidenceDimensions: ErvRelationalEvidenceDimensionsV2; advisor: ErvRelationalAdvisorV2; authority: ErvRelationalCaseAuthorityV2 }>
  | Readonly<{ caseId: string; outcome: "UNKNOWN"; variant: ErvRelationalVariantEchoV2; unknown: Readonly<{ unknownKind: ErvRelationalUnknownCodeV2; matchedAmountMinor: number; toleranceMinor: number; detail: string }>; evidenceCitations: readonly ErvRelationalEvidenceCitationV2[]; evidenceDimensions: ErvRelationalEvidenceDimensionsV2; advisor: ErvRelationalAdvisorV2; authority: ErvRelationalCaseAuthorityV2 }>
  | Readonly<{ caseId: string; outcome: "EXCEPTION"; variant: ErvRelationalVariantEchoV2; exceptionCode: ErvRelationalExceptionCodeV2; detail: string; evidenceCitations: readonly ErvRelationalEvidenceCitationV2[]; evidenceDimensions: ErvRelationalEvidenceDimensionsV2; advisor: ErvRelationalAdvisorV2; authority: ErvRelationalCaseAuthorityV2 }>
  | Readonly<{ caseId: string; outcome: "DENIED"; variant: ErvRelationalVariantEchoV2; reasonCode: ErvRelationalDeniedReasonCodeV2; detail: string; evidenceCitations: readonly ErvRelationalEvidenceCitationV2[]; evidenceDimensions: ErvRelationalEvidenceDimensionsV2; advisor: ErvRelationalAdvisorV2; authority: ErvRelationalCaseAuthorityV2 }>;

export interface ErvRelationalCorePackageV2 {
  readonly schemaVersion: typeof INCOMING_INVOICE_ERV_RELATIONAL_CORE_V2;
  readonly packId: string;
  readonly caseCount: number;
  readonly decisions: readonly ErvRelationalCaseDecisionV2[];
  readonly authority: Readonly<{ mode: "LOCAL_SYNTHETIC_PROOF"; customerDataAuthorized: false; externalProviderCalls: false; productivePostingAuthorized: false; bookingAuthorityGranted: false; riskDCapability: "SEPARATELY_AUTHORIZED" }>;
  readonly nonclaims: readonly string[];
  readonly deterministicReplay: Readonly<{ packSha256: string; decisionDigest: string; policy: "LOCAL_COMPILER_DETERMINISTIC_REPLAY" }>;
}
export type ErvRelationalCoreResultV2 =
  | Readonly<{ outcome: "DENIED"; reasonCode: "PACK_SHAPE_DENIED" | "PACK_DIGEST_DENIED" }>
  | Readonly<{ outcome: "DECIDED"; package: ErvRelationalCorePackageV2 }>;

function deepFreeze<T>(value: T): T {
  if (value !== null && typeof value === "object" && !Object.isFrozen(value)) {
    for (const child of Object.values(value as Record<string, unknown>)) deepFreeze(child);
    Object.freeze(value);
  }
  return value;
}
function isObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value) && Object.getPrototypeOf(value) === Object.prototype;
}
function exactKeys(value: unknown, keys: readonly string[]): value is Record<string, unknown> {
  if (!isObject(value)) return false;
  const actual = Object.keys(value).sort();
  const expected = [...keys].sort();
  return actual.length === expected.length && actual.every((key, index) => key === expected[index]);
}
function isSha256(value: unknown): boolean {
  return typeof value === "string" && /^[a-f0-9]{64}$/.test(value);
}
function isNonNegativeSafeInt(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
}
function canonicalDigestV2(value: unknown): string {
  return sha256HexV1(canonicalJsonV1(value));
}

export function referenceContentSha256V2(body: ErvRelationalReferenceBodyV2): string {
  return canonicalDigestV2(body);
}
function effectiveToleranceMinor(policy: ErvRelationalTolerancePolicyVariantV2, anchor: number): number {
  if (policy.rateBasisPoints > 0) return Math.round((anchor * policy.rateBasisPoints) / 10000);
  return policy.absoluteToleranceMinor;
}
function originVerifiedFor(evidence: ErvRelationalEvidenceBindingV2): boolean {
  return evidence.locator.startsWith(RELATIONAL_PACK_LOCATOR_PREFIX_V2) && evidence.generator === RELATIONAL_EVIDENCE_GENERATOR_V2;
}
function evidenceCitationsFor(references: readonly ErvRelationalEvidenceReferenceV2[]): ErvRelationalEvidenceCitationV2[] {
  return references.map((reference) => {
    const recomputed = referenceContentSha256V2(reference.body);
    const integrityVerified = recomputed === reference.evidence.contentSha256;
    return deepFreeze({ referenceKind: reference.body.referenceKind, referenceId: reference.body.referenceId, contentSha256: reference.evidence.contentSha256, recomputedContentSha256: recomputed, integrityVerified, originVerified: originVerifiedFor(reference.evidence) });
  });
}
function advisorFor(caseId: string, kind: string, text: string, references: readonly ErvRelationalEvidenceReferenceV2[]): ErvRelationalAdvisorV2 {
  const citations = references.map((reference) => deepFreeze({
    referenceKind: reference.body.referenceKind,
    referenceId: reference.body.referenceId,
    evidenceSha256: reference.evidence.contentSha256,
  }));
  return deepFreeze({
    questions: [deepFreeze({ questionId: `ADV:${caseId}:${kind}`, questionText: text, citations })],
    advisorAuthority: "EVIDENCE_CITING_ONLY" as const,
    bookingAuthorityGranted: false as const,
  });
}
function evidenceDimensionsFor(citations: readonly ErvRelationalEvidenceCitationV2[], semanticsVerified: boolean): ErvRelationalEvidenceDimensionsV2 {
  return deepFreeze({
    integrityVerified: citations.every((citation) => citation.integrityVerified === true),
    originVerified: citations.every((citation) => citation.originVerified === true),
    semanticsVerified,
    runtimeObserved: true,
  });
}
function observedGroups<T extends string | number>(entries: ReadonlyArray<{ value: T; referenceId: string }>): ReadonlyArray<Readonly<{ value: T; referenceIds: readonly string[] }>> {
  const groups = new Map<T, string[]>();
  for (const entry of entries) {
    const existing = groups.get(entry.value);
    if (existing === undefined) groups.set(entry.value, [entry.referenceId]);
    else existing.push(entry.referenceId);
  }
  return [...groups.entries()]
    .map(([value, referenceIds]) => ({ value, referenceIds: [...referenceIds].sort() }))
    .sort((left, right) => (left.value < right.value ? -1 : left.value > right.value ? 1 : 0));
}

function validVariantSelection(value: unknown): value is ErvRelationalVariantSelectionRefV2 {
  if (!exactKeys(value, ["variantId", "version"])) return false;
  const variantId = value.variantId;
  const version = value.version;
  return typeof variantId === "string" && variantId.length > 0 && typeof version === "string" && version.length > 0;
}
function validReferenceShape(value: unknown): value is ErvRelationalEvidenceReferenceV2 {
  if (!exactKeys(value, ["body", "evidence"])) return false;
  const body = value.body;
  const evidence = value.evidence;
  if (!exactKeys(body, ["referenceKind", "referenceId", "supplierId", "matchAmountMinor", "quantity", "unit", "currency"])) return false;
  const referenceKind = body.referenceKind;
  const referenceId = body.referenceId;
  const supplierId = body.supplierId;
  const matchAmountMinor = body.matchAmountMinor;
  const quantity = body.quantity;
  const unit = body.unit;
  const currency = body.currency;
  if (!REFERENCE_KIND_V2.includes(referenceKind as string)
    || typeof referenceId !== "string" || referenceId.length === 0
    || typeof supplierId !== "string" || supplierId.length === 0
    || !isNonNegativeSafeInt(matchAmountMinor) || !isNonNegativeSafeInt(quantity)
    || typeof unit !== "string" || unit.length === 0
    || typeof currency !== "string" || currency.length === 0) return false;
  if (!exactKeys(evidence, ["sourceKind", "locator", "generator", "contentSha256"])) return false;
  const sourceKind = evidence.sourceKind;
  const locator = evidence.locator;
  const generator = evidence.generator;
  const contentSha256 = evidence.contentSha256;
  return sourceKind === "LOCAL_SYNTHETIC_FIXTURE"
    && typeof locator === "string" && locator.length > 0
    && typeof generator === "string" && generator.length > 0
    && isSha256(contentSha256);
}
function validCaseShape(value: unknown): value is ErvRelationalCaseV2 {
  if (!exactKeys(value, ["caseId", "matchingMode", "tolerancePolicy", "requestedEffects", "references"])) return false;
  const caseId = value.caseId;
  const matchingMode = value.matchingMode;
  const tolerancePolicy = value.tolerancePolicy;
  const requestedEffects = value.requestedEffects;
  const references = value.references;
  if (typeof caseId !== "string" || caseId.length === 0) return false;
  if (!validVariantSelection(matchingMode) || !validVariantSelection(tolerancePolicy)) return false;
  if (!Array.isArray(requestedEffects) || requestedEffects.length === 0
    || !requestedEffects.every((effect) => typeof effect === "string" && EFFECT_VOCABULARY_V2.includes(effect))) return false;
  return Array.isArray(references) && references.length >= 1 && references.every(validReferenceShape);
}
function validMatchingModeShape(value: unknown): value is ErvRelationalMatchingModeVariantV2 {
  if (!exactKeys(value, ["variantId", "version", "requiredKinds", "amountKinds", "relationDimensions"])) return false;
  const variantId = value.variantId;
  const version = value.version;
  const requiredKinds = value.requiredKinds;
  const amountKinds = value.amountKinds;
  const relationDimensions = value.relationDimensions;
  if (typeof variantId !== "string" || variantId.length === 0
    || typeof version !== "string" || version.length === 0) return false;
  if (!Array.isArray(requiredKinds) || requiredKinds.length === 0
    || !requiredKinds.every((kind) => REFERENCE_KIND_V2.includes(kind as string))) return false;
  if (!Array.isArray(amountKinds) || amountKinds.length === 0
    || !amountKinds.every((kind) => AMOUNT_KIND_V2.includes(kind as string))) return false;
  if (!Array.isArray(relationDimensions)
    || !relationDimensions.every((dimension) => RELATION_DIMENSION_V2.includes(dimension as string))) return false;
  // a mode that enforces the supplier relation must require the supplier context
  return !relationDimensions.includes("SUPPLIER") || requiredKinds.includes("SUPPLIER");
}
function validTolerancePolicyShape(value: unknown): value is ErvRelationalTolerancePolicyVariantV2 {
  if (!exactKeys(value, ["variantId", "version", "absoluteToleranceMinor", "rateBasisPoints"])) return false;
  const variantId = value.variantId;
  const version = value.version;
  const absoluteToleranceMinor = value.absoluteToleranceMinor;
  const rateBasisPoints = value.rateBasisPoints;
  return typeof variantId === "string" && variantId.length > 0
    && typeof version === "string" && version.length > 0
    && isNonNegativeSafeInt(absoluteToleranceMinor)
    && isNonNegativeSafeInt(rateBasisPoints) && rateBasisPoints <= 10000;
}
function validCasePackShape(value: unknown): value is ErvRelationalCasePackV2 {
  if (!exactKeys(value, ["schemaVersion", "packId", "frozenAt", "authority", "variants", "cases"])) return false;
  const schemaVersion = value.schemaVersion;
  const packId = value.packId;
  const frozenAt = value.frozenAt;
  const authority = value.authority;
  const variants = value.variants;
  const cases = value.cases;
  if (schemaVersion !== INCOMING_INVOICE_ERV_RELATIONAL_CASE_PACK_V2
    || typeof packId !== "string" || packId.length === 0
    || typeof frozenAt !== "string" || frozenAt.length === 0) return false;
  if (!exactKeys(authority, ["mode", "customerData", "externalProvider", "productivePosting"])
    || authority.mode !== "LOCAL_SYNTHETIC_PROOF" || authority.customerData !== false
    || authority.externalProvider !== false || authority.productivePosting !== false) return false;
  if (!exactKeys(variants, ["matchingModes", "tolerancePolicies"])) return false;
  const matchingModes = variants.matchingModes;
  const tolerancePolicies = variants.tolerancePolicies;
  if (!Array.isArray(matchingModes) || matchingModes.length === 0 || !matchingModes.every(validMatchingModeShape)) return false;
  if (!Array.isArray(tolerancePolicies) || tolerancePolicies.length === 0 || !tolerancePolicies.every(validTolerancePolicyShape)) return false;
  return Array.isArray(cases) && cases.length >= 1 && cases.every(validCaseShape);
}

function firstViolationDetail(entries: ReadonlyArray<Readonly<{ value: string | number; referenceIds: readonly string[] }>>): string {
  return entries.map((group) => `${group.value} (${group.referenceIds.join(", ")})`).join("; ");
}

export function evaluateErvRelationalCaseV2(candidate: ErvRelationalCaseV2, pack: ErvRelationalCasePackV2): ErvRelationalCaseDecisionV2 {
  const variant: ErvRelationalVariantEchoV2 = {
    matchingModeId: candidate.matchingMode.variantId,
    matchingModeVersion: candidate.matchingMode.version,
    tolerancePolicyId: candidate.tolerancePolicy.variantId,
    tolerancePolicyVersion: candidate.tolerancePolicy.version,
  };
  const evidenceCitations = evidenceCitationsFor(candidate.references);
  const authority: ErvRelationalCaseAuthorityV2 = deepFreeze({ productivePostingAuthorized: false, bookingAuthorityGranted: false, riskDCapability: "SEPARATELY_AUTHORIZED" });

  // AC-05: productive effects are refused before any matching, with no booking authority granted.
  const productiveEffect = candidate.requestedEffects.find((effect) => PRODUCTIVE_EFFECTS_V2.has(effect));
  if (productiveEffect !== undefined) {
    const text = `Productive effect ${productiveEffect} was requested; this ERV core grants no booking authority and defers to separate Risk-D authorization.`;
    return deepFreeze({ caseId: candidate.caseId, outcome: "DENIED" as const, variant, reasonCode: "RISK_D_AUTHORIZATION_REQUIRED" as const, detail: text, evidenceCitations, evidenceDimensions: evidenceDimensionsFor(evidenceCitations, false), advisor: advisorFor(candidate.caseId, "RISK_D", text, candidate.references), authority });
  }

  // AC-02: resolve the requested versioned matching-mode and tolerance variants against the frozen registry.
  const mode = pack.variants.matchingModes.find((entry) => entry.variantId === candidate.matchingMode.variantId && entry.version === candidate.matchingMode.version);
  const policy = pack.variants.tolerancePolicies.find((entry) => entry.variantId === candidate.tolerancePolicy.variantId && entry.version === candidate.tolerancePolicy.version);
  if (mode === undefined || policy === undefined) {
    const missing = mode === undefined
      ? `matching mode ${candidate.matchingMode.variantId} v${candidate.matchingMode.version}`
      : `tolerance policy ${candidate.tolerancePolicy.variantId} v${candidate.tolerancePolicy.version}`;
    const text = `Versioned variant is not present in the frozen registry: ${missing}.`;
    return deepFreeze({ caseId: candidate.caseId, outcome: "EXCEPTION" as const, variant, exceptionCode: "UNKNOWN_VARIANT" as const, detail: text, evidenceCitations, evidenceDimensions: evidenceDimensionsFor(evidenceCitations, false), advisor: advisorFor(candidate.caseId, "UNKNOWN_VARIANT", text, candidate.references), authority });
  }

  // Evidence dimension: integrity. Every reference's bound contentSha256 must
  // recompute from its body; an unbound digest is explicit and never masked.
  const unverified = evidenceCitations.find((citation) => citation.integrityVerified === false);
  if (unverified !== undefined) {
    const text = `Reference ${unverified.referenceKind} ${unverified.referenceId} fails integrityVerified: its bound contentSha256 does not match its recomputed body digest.`;
    return deepFreeze({ caseId: candidate.caseId, outcome: "EXCEPTION" as const, variant, exceptionCode: "UNVERIFIED_REFERENCE_EVIDENCE" as const, detail: text, evidenceCitations, evidenceDimensions: evidenceDimensionsFor(evidenceCitations, false), advisor: advisorFor(candidate.caseId, "UNVERIFIED_REFERENCE_EVIDENCE", text, candidate.references), authority });
  }

  // Evidence dimension: origin. Evidence must bind to the frozen local-synthetic
  // fixture origin (this pack's locator prefix and frozen generator), even when
  // its digest recomputes cleanly.
  const foreignOrigin = evidenceCitations.find((citation) => citation.originVerified === false);
  if (foreignOrigin !== undefined) {
    const text = `Reference ${foreignOrigin.referenceKind} ${foreignOrigin.referenceId} fails originVerified: its evidence binding does not point to the frozen local-synthetic fixture origin.`;
    return deepFreeze({ caseId: candidate.caseId, outcome: "EXCEPTION" as const, variant, exceptionCode: "ORIGIN_NOT_VERIFIED" as const, detail: text, evidenceCitations, evidenceDimensions: evidenceDimensionsFor(evidenceCitations, false), advisor: advisorFor(candidate.caseId, "ORIGIN_NOT_VERIFIED", text, candidate.references), authority });
  }

  // AC-03 multiplicity contract: duplicate reference kinds are DENIED
  // deterministically. The denial depends only on the multiset of kinds, never
  // on input order, and there is no last-write-wins.
  const kindCounts = new Map<ErvRelationalReferenceKindV2, number>();
  for (const reference of candidate.references) kindCounts.set(reference.body.referenceKind, (kindCounts.get(reference.body.referenceKind) ?? 0) + 1);
  const duplicateKinds = [...kindCounts.entries()].filter(([, count]) => count > 1).sort(([left], [right]) => (left < right ? -1 : 1));
  if (duplicateKinds.length > 0) {
    const text = `Duplicate reference kind(s) ${duplicateKinds.map(([kind, count]) => `${kind} (${count} occurrence(s))`).join(", ")}; multiplicity is explicitly denied deterministically — no last-write-wins.`;
    return deepFreeze({ caseId: candidate.caseId, outcome: "EXCEPTION" as const, variant, exceptionCode: "DUPLICATE_REFERENCE_KIND" as const, detail: text, evidenceCitations, evidenceDimensions: evidenceDimensionsFor(evidenceCitations, false), advisor: advisorFor(candidate.caseId, "DUPLICATE_REFERENCE_KIND", text, candidate.references), authority });
  }

  // AC-03: missing required context is explicit rather than inferred or filled in.
  const presentKinds = new Set(candidate.references.map((reference) => reference.body.referenceKind));
  const missingKinds = mode.requiredKinds.filter((kind) => !presentKinds.has(kind)).sort();
  if (missingKinds.length > 0) {
    const text = `Required reference kind(s) ${missingKinds.join(", ")} are missing for ${mode.variantId}; the match cannot complete without their independent evidence.`;
    return deepFreeze({ caseId: candidate.caseId, outcome: "EXCEPTION" as const, variant, exceptionCode: "MISSING_CONTEXT" as const, detail: text, evidenceCitations, evidenceDimensions: evidenceDimensionsFor(evidenceCitations, false), advisor: advisorFor(candidate.caseId, "MISSING_CONTEXT", text, candidate.references), authority });
  }

  // AC-05: relational dimensions the versioned mode enforces, checked in a
  // fixed order. A failing dimension is a CONFLICT — never a silent match.
  const relationChecks: ReadonlyArray<{ dimension: ErvRelationalDimensionV2; conflictKind: Exclude<ErvRelationalConflictKindV2, "AMOUNT">; entries: ReadonlyArray<{ value: string | number; referenceId: string }> }> = [
    { dimension: "SUPPLIER", conflictKind: "SUPPLIER_RELATION", entries: candidate.references.map((reference) => ({ value: reference.body.supplierId, referenceId: reference.body.referenceId })) },
    { dimension: "QUANTITY", conflictKind: "QUANTITY_RELATION", entries: mode.amountKinds.flatMap((kind) => candidate.references.filter((reference) => reference.body.referenceKind === kind).map((reference) => ({ value: reference.body.quantity as string | number, referenceId: reference.body.referenceId }))) },
    { dimension: "UNIT", conflictKind: "UNIT_RELATION", entries: candidate.references.map((reference) => ({ value: reference.body.unit, referenceId: reference.body.referenceId })) },
    { dimension: "CURRENCY", conflictKind: "CURRENCY_RELATION", entries: candidate.references.map((reference) => ({ value: reference.body.currency, referenceId: reference.body.referenceId })) },
  ];
  for (const check of relationChecks) {
    if (!mode.relationDimensions.includes(check.dimension)) continue;
    const observed = observedGroups(check.entries);
    if (observed.length > 1) {
      const conflict: ErvRelationalConflictDetailV2 = { conflictKind: check.conflictKind, observed };
      const text = `${check.dimension} relation fails for ${mode.variantId}: ${firstViolationDetail(observed)}; identify the authoritative reference.`;
      return deepFreeze({ caseId: candidate.caseId, outcome: "CONFLICT" as const, variant, conflict, evidenceCitations, evidenceDimensions: evidenceDimensionsFor(evidenceCitations, false), advisor: advisorFor(candidate.caseId, "CONFLICT", text, candidate.references), authority });
    }
  }

  // AC-02/AC-03: amount-level comparison of the versioned amount kinds under
  // the versioned tolerance policy (identical arithmetic to the v1 core).
  const byKind = new Map<ErvRelationalReferenceKindV2, ErvRelationalEvidenceReferenceV2>();
  for (const reference of candidate.references) byKind.set(reference.body.referenceKind, reference);
  const anchor = byKind.get("INVOICE")!.body.matchAmountMinor;
  const amounts = mode.amountKinds.map((kind) => {
    const reference = byKind.get(kind)!;
    return { kind, referenceId: reference.body.referenceId, amount: reference.body.matchAmountMinor };
  });
  const min = Math.min(...amounts.map((entry) => entry.amount));
  const max = Math.max(...amounts.map((entry) => entry.amount));
  const delta = max - min;
  const toleranceMinor = effectiveToleranceMinor(policy, anchor);
  if (delta > toleranceMinor) {
    const minEntry = amounts.find((entry) => entry.amount === min)!;
    const maxEntry = amounts.find((entry) => entry.amount === max)!;
    const conflict = { conflictKind: "AMOUNT" as const, minReferenceId: minEntry.referenceId, minAmountMinor: min, maxReferenceId: maxEntry.referenceId, maxAmountMinor: max, deltaMinor: delta, toleranceMinor, tolerancePolicyId: policy.variantId, tolerancePolicyVersion: policy.version };
    const text = `Matched amounts disagree beyond ${policy.variantId} v${policy.version} (delta ${delta} minor, tolerance ${toleranceMinor} minor); identify the authoritative reference.`;
    return deepFreeze({ caseId: candidate.caseId, outcome: "CONFLICT" as const, variant, conflict, evidenceCitations, evidenceDimensions: evidenceDimensionsFor(evidenceCitations, false), advisor: advisorFor(candidate.caseId, "CONFLICT", text, candidate.references), authority });
  }

  // All enforced relations and the amount-level tolerance hold. A validated
  // full match requires every relational dimension to be enforced by the mode.
  const unenforced = RELATION_DIMENSION_V2.filter((dimension) => !mode.relationDimensions.includes(dimension as ErvRelationalDimensionV2));
  if (unenforced.length === 0) {
    const anchorReference = byKind.get("INVOICE")!;
    const text = `All enforced relations (supplier, quantity, unit, currency) hold and amounts agree within ${policy.variantId} v${policy.version}; this is a validated full relational match of frozen local-synthetic evidence.`;
    return deepFreeze({
      caseId: candidate.caseId,
      outcome: "MATCHED" as const,
      variant,
      matchedAmountMinor: anchor,
      relations: deepFreeze({ supplierId: anchorReference.body.supplierId, quantity: anchorReference.body.quantity, unit: anchorReference.body.unit, currency: anchorReference.body.currency }),
      evidenceCitations,
      evidenceDimensions: evidenceDimensionsFor(evidenceCitations, true),
      advisor: advisorFor(candidate.caseId, "MATCHED", text, candidate.references),
      authority,
    });
  }
  const gap = unenforced[0];
  const text = `Amount-level amounts agree within ${policy.variantId} v${policy.version} and the enforced relations hold, but the ${gap} relation is not enforced by this versioned mode; the outcome is an amount-level candidate (UNKNOWN), never a validated full match.`;
  return deepFreeze({ caseId: candidate.caseId, outcome: "UNKNOWN" as const, variant, unknown: deepFreeze({ unknownKind: "SUPPLIER_RELATION_NOT_VERIFIED" as const, matchedAmountMinor: anchor, toleranceMinor, detail: text }), evidenceCitations, evidenceDimensions: evidenceDimensionsFor(evidenceCitations, true), advisor: advisorFor(candidate.caseId, "UNKNOWN", text, candidate.references), authority });
}

export function compileErvRelationalCoreV2(candidate: unknown, claimedPackSha256: string): ErvRelationalCoreResultV2 {
  if (!validCasePackShape(candidate)) return deepFreeze({ outcome: "DENIED" as const, reasonCode: "PACK_SHAPE_DENIED" as const });
  const pack = candidate;
  if (claimedPackSha256 !== AP04_ERV_RELATIONAL_CASE_PACK_SHA256_V2 || canonicalDigestV2(candidate) !== AP04_ERV_RELATIONAL_CASE_PACK_CANONICAL_SHA256_V2) {
    return deepFreeze({ outcome: "DENIED" as const, reasonCode: "PACK_DIGEST_DENIED" as const });
  }
  const decisions = pack.cases.map((entry) => evaluateErvRelationalCaseV2(entry, pack));
  const decisionDigest = canonicalDigestV2(decisions);
  const pkg: ErvRelationalCorePackageV2 = {
    schemaVersion: INCOMING_INVOICE_ERV_RELATIONAL_CORE_V2,
    packId: pack.packId,
    caseCount: decisions.length,
    decisions,
    authority: { mode: "LOCAL_SYNTHETIC_PROOF", customerDataAuthorized: false, externalProviderCalls: false, productivePostingAuthorized: false, bookingAuthorityGranted: false, riskDCapability: "SEPARATELY_AUTHORIZED" },
    nonclaims: ["NO_CUSTOMER_DATA_EVALUATED", "NO_EXTERNAL_PROVIDER_EVALUATED", "NO_PRODUCTIVE_ALLOCATION_OR_POSTING_AUTHORIZED", "NO_BOOKING_AUTHORITY_GRANTED", "NO_LIVE_ERP_SYSTEM_CLAIM", "NO_SYSTEM_OF_RECORD_READBACK_PERFORMED"],
    deterministicReplay: { packSha256: AP04_ERV_RELATIONAL_CASE_PACK_CANONICAL_SHA256_V2, decisionDigest, policy: "LOCAL_COMPILER_DETERMINISTIC_REPLAY" },
  };
  return deepFreeze({ outcome: "DECIDED" as const, package: pkg });
}