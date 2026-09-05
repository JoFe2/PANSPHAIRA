import { canonicalJsonV1, sha256HexV1 } from "./incoming-invoice-intake.js";

export const AP04_ERV_CASE_PACK_SHA256_V1 = "136bbdfcb61bf48ab0043d828dbf797e9b9156f58d284cc7f9b921da59040845" as const;
const AP04_ERV_CASE_PACK_CANONICAL_SHA256_V1 = "899d8dfc44be526011c35ad5aba4c2cb89bca433f1520e61fe05268d4816ad20";
export const INCOMING_INVOICE_ERV_CASE_PACK_V1 = "chimpmaera.incoming-invoice/erv-case-pack/v1" as const;
export const INCOMING_INVOICE_ERV_CORE_V1 = "chimpmaera.incoming-invoice/erv-core/v1" as const;

const REFERENCE_KIND_V1: readonly string[] = ["SUPPLIER", "PURCHASE_ORDER", "RECEIPT", "INVOICE"];
const AMOUNT_KIND_V1: readonly string[] = ["INVOICE", "PURCHASE_ORDER", "RECEIPT"];
const EFFECT_VOCABULARY_V1: readonly string[] = ["READ_SYNTHETIC", "WRITE_LOCAL_PROOF", "POST_PRODUCTIVE", "ALLOCATE_PRODUCTIVE"];
const PRODUCTIVE_EFFECTS_V1 = new Set(["POST_PRODUCTIVE", "ALLOCATE_PRODUCTIVE"]);

export type ErvReferenceKindV1 = "SUPPLIER" | "PURCHASE_ORDER" | "RECEIPT" | "INVOICE";
export type ErvAmountKindV1 = "INVOICE" | "PURCHASE_ORDER" | "RECEIPT";

export interface ErvReferenceBodyV1 {
  readonly referenceKind: ErvReferenceKindV1;
  readonly referenceId: string;
  readonly supplierId: string;
  readonly matchAmountMinor: number;
  readonly quantity: number;
}
export interface ErvEvidenceBindingV1 {
  readonly sourceKind: "LOCAL_SYNTHETIC_FIXTURE";
  readonly locator: string;
  readonly generator: string;
  readonly contentSha256: string;
}
export interface ErvEvidenceReferenceV1 {
  readonly body: ErvReferenceBodyV1;
  readonly evidence: ErvEvidenceBindingV1;
}
export interface ErvMatchingModeVariantV1 {
  readonly variantId: string;
  readonly version: string;
  readonly requiredKinds: readonly ErvReferenceKindV1[];
  readonly amountKinds: readonly ErvAmountKindV1[];
}
export interface ErvTolerancePolicyVariantV1 {
  readonly variantId: string;
  readonly version: string;
  readonly absoluteToleranceMinor: number;
  readonly rateBasisPoints: number;
}
export interface ErvVariantSelectionRefV1 {
  readonly variantId: string;
  readonly version: string;
}
export interface ErvCaseV1 {
  readonly caseId: string;
  readonly matchingMode: ErvVariantSelectionRefV1;
  readonly tolerancePolicy: ErvVariantSelectionRefV1;
  readonly requestedEffects: readonly string[];
  readonly references: readonly ErvEvidenceReferenceV1[];
}
export interface ErvCasePackV1 {
  readonly schemaVersion: typeof INCOMING_INVOICE_ERV_CASE_PACK_V1;
  readonly packId: string;
  readonly frozenAt: string;
  readonly authority: Readonly<{ mode: "LOCAL_SYNTHETIC_PROOF"; customerData: false; externalProvider: false; productivePosting: false }>;
  readonly variants: Readonly<{ matchingModes: readonly ErvMatchingModeVariantV1[]; tolerancePolicies: readonly ErvTolerancePolicyVariantV1[] }>;
  readonly cases: readonly ErvCaseV1[];
}

export type ErvExceptionCodeV1 = "MISSING_CONTEXT" | "UNVERIFIED_REFERENCE_EVIDENCE" | "UNKNOWN_VARIANT";
export type ErvDeniedReasonCodeV1 = "RISK_D_AUTHORIZATION_REQUIRED";

export interface ErvVariantEchoV1 {
  readonly matchingModeId: string;
  readonly matchingModeVersion: string;
  readonly tolerancePolicyId: string;
  readonly tolerancePolicyVersion: string;
}
export interface ErvEvidenceCitationV1 {
  readonly referenceKind: ErvReferenceKindV1;
  readonly referenceId: string;
  readonly contentSha256: string;
  readonly verified: boolean;
}
export interface ErvAdvisorCitationV1 {
  readonly referenceKind: ErvReferenceKindV1;
  readonly referenceId: string;
  readonly evidenceSha256: string;
}
export interface ErvAdvisorQuestionV1 {
  readonly questionId: string;
  readonly questionText: string;
  readonly citations: readonly ErvAdvisorCitationV1[];
}
export interface ErvAdvisorV1 {
  readonly questions: readonly ErvAdvisorQuestionV1[];
  readonly advisorAuthority: "EVIDENCE_CITING_ONLY";
  readonly bookingAuthorityGranted: false;
}
export interface ErvCaseAuthorityV1 {
  readonly productivePostingAuthorized: false;
  readonly bookingAuthorityGranted: false;
  readonly riskDCapability: "SEPARATELY_AUTHORIZED";
}
export interface ErvConflictDetailV1 {
  readonly minReferenceId: string;
  readonly minAmountMinor: number;
  readonly maxReferenceId: string;
  readonly maxAmountMinor: number;
  readonly deltaMinor: number;
  readonly toleranceMinor: number;
  readonly tolerancePolicyId: string;
  readonly tolerancePolicyVersion: string;
}

export type ErvCaseDecisionV1 =
  | Readonly<{ caseId: string; outcome: "MATCHED"; variant: ErvVariantEchoV1; matchedAmountMinor: number; evidenceCitations: readonly ErvEvidenceCitationV1[]; advisor: ErvAdvisorV1; authority: ErvCaseAuthorityV1 }>
  | Readonly<{ caseId: string; outcome: "CONFLICT"; variant: ErvVariantEchoV1; conflict: ErvConflictDetailV1; evidenceCitations: readonly ErvEvidenceCitationV1[]; advisor: ErvAdvisorV1; authority: ErvCaseAuthorityV1 }>
  | Readonly<{ caseId: string; outcome: "EXCEPTION"; variant: ErvVariantEchoV1; exceptionCode: ErvExceptionCodeV1; detail: string; evidenceCitations: readonly ErvEvidenceCitationV1[]; advisor: ErvAdvisorV1; authority: ErvCaseAuthorityV1 }>
  | Readonly<{ caseId: string; outcome: "DENIED"; variant: ErvVariantEchoV1; reasonCode: ErvDeniedReasonCodeV1; detail: string; evidenceCitations: readonly ErvEvidenceCitationV1[]; advisor: ErvAdvisorV1; authority: ErvCaseAuthorityV1 }>;

export interface ErvCorePackageV1 {
  readonly schemaVersion: typeof INCOMING_INVOICE_ERV_CORE_V1;
  readonly packId: string;
  readonly caseCount: number;
  readonly decisions: readonly ErvCaseDecisionV1[];
  readonly authority: Readonly<{ mode: "LOCAL_SYNTHETIC_PROOF"; customerDataAuthorized: false; externalProviderCalls: false; productivePostingAuthorized: false; bookingAuthorityGranted: false; riskDCapability: "SEPARATELY_AUTHORIZED" }>;
  readonly nonclaims: readonly string[];
  readonly readback: Readonly<{ packSha256: string; decisionDigest: string; deterministicReplay: true }>;
}
export type ErvCoreResultV1 =
  | Readonly<{ outcome: "DENIED"; reasonCode: "PACK_SHAPE_DENIED" | "PACK_DIGEST_DENIED" }>
  | Readonly<{ outcome: "DECIDED"; package: ErvCorePackageV1 }>;

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
function canonicalDigestV1(value: unknown): string {
  return sha256HexV1(canonicalJsonV1(value));
}

export function referenceContentSha256V1(body: ErvReferenceBodyV1): string {
  return canonicalDigestV1(body);
}
function effectiveToleranceMinor(policy: ErvTolerancePolicyVariantV1, anchor: number): number {
  if (policy.rateBasisPoints > 0) return Math.round((anchor * policy.rateBasisPoints) / 10000);
  return policy.absoluteToleranceMinor;
}
function evidenceCitationsFor(references: readonly ErvEvidenceReferenceV1[]): ErvEvidenceCitationV1[] {
  return references.map((reference) => {
    const verified = referenceContentSha256V1(reference.body) === reference.evidence.contentSha256;
    return deepFreeze({ referenceKind: reference.body.referenceKind, referenceId: reference.body.referenceId, contentSha256: reference.evidence.contentSha256, verified });
  });
}
function advisorFor(caseId: string, kind: string, text: string, references: readonly ErvEvidenceReferenceV1[]): ErvAdvisorV1 {
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

function validVariantSelection(value: unknown): value is ErvVariantSelectionRefV1 {
  if (!exactKeys(value, ["variantId", "version"])) return false;
  const variantId = value.variantId;
  const version = value.version;
  return typeof variantId === "string" && variantId.length > 0 && typeof version === "string" && version.length > 0;
}
function validReferenceShape(value: unknown): value is ErvEvidenceReferenceV1 {
  if (!exactKeys(value, ["body", "evidence"])) return false;
  const body = value.body;
  const evidence = value.evidence;
  if (!exactKeys(body, ["referenceKind", "referenceId", "supplierId", "matchAmountMinor", "quantity"])) return false;
  const referenceKind = body.referenceKind;
  const referenceId = body.referenceId;
  const supplierId = body.supplierId;
  const matchAmountMinor = body.matchAmountMinor;
  const quantity = body.quantity;
  if (!REFERENCE_KIND_V1.includes(referenceKind as string)
    || typeof referenceId !== "string" || referenceId.length === 0
    || typeof supplierId !== "string" || supplierId.length === 0
    || !isNonNegativeSafeInt(matchAmountMinor) || !isNonNegativeSafeInt(quantity)) return false;
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
function validCaseShape(value: unknown): value is ErvCaseV1 {
  if (!exactKeys(value, ["caseId", "matchingMode", "tolerancePolicy", "requestedEffects", "references"])) return false;
  const caseId = value.caseId;
  const matchingMode = value.matchingMode;
  const tolerancePolicy = value.tolerancePolicy;
  const requestedEffects = value.requestedEffects;
  const references = value.references;
  if (typeof caseId !== "string" || caseId.length === 0) return false;
  if (!validVariantSelection(matchingMode) || !validVariantSelection(tolerancePolicy)) return false;
  if (!Array.isArray(requestedEffects) || requestedEffects.length === 0
    || !requestedEffects.every((effect) => typeof effect === "string" && EFFECT_VOCABULARY_V1.includes(effect))) return false;
  return Array.isArray(references) && references.length >= 1 && references.every(validReferenceShape);
}
function validMatchingModeShape(value: unknown): value is ErvMatchingModeVariantV1 {
  if (!exactKeys(value, ["variantId", "version", "requiredKinds", "amountKinds"])) return false;
  const variantId = value.variantId;
  const version = value.version;
  const requiredKinds = value.requiredKinds;
  const amountKinds = value.amountKinds;
  if (typeof variantId !== "string" || variantId.length === 0
    || typeof version !== "string" || version.length === 0) return false;
  return Array.isArray(requiredKinds) && requiredKinds.length >= 1
    && requiredKinds.every((kind) => REFERENCE_KIND_V1.includes(kind as string))
    && Array.isArray(amountKinds) && amountKinds.length >= 1
    && amountKinds.every((kind) => AMOUNT_KIND_V1.includes(kind as string));
}
function validTolerancePolicyShape(value: unknown): value is ErvTolerancePolicyVariantV1 {
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
function validCasePackShape(value: unknown): value is ErvCasePackV1 {
  if (!exactKeys(value, ["schemaVersion", "packId", "frozenAt", "authority", "variants", "cases"])) return false;
  const schemaVersion = value.schemaVersion;
  const packId = value.packId;
  const frozenAt = value.frozenAt;
  const authority = value.authority;
  const variants = value.variants;
  const cases = value.cases;
  if (schemaVersion !== INCOMING_INVOICE_ERV_CASE_PACK_V1
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

export function evaluateErvMatchingCaseV1(candidate: ErvCaseV1, pack: ErvCasePackV1): ErvCaseDecisionV1 {
  const variant: ErvVariantEchoV1 = {
    matchingModeId: candidate.matchingMode.variantId,
    matchingModeVersion: candidate.matchingMode.version,
    tolerancePolicyId: candidate.tolerancePolicy.variantId,
    tolerancePolicyVersion: candidate.tolerancePolicy.version,
  };
  const evidenceCitations = evidenceCitationsFor(candidate.references);
  const authority: ErvCaseAuthorityV1 = deepFreeze({ productivePostingAuthorized: false, bookingAuthorityGranted: false, riskDCapability: "SEPARATELY_AUTHORIZED" });

  // AC-05: productive effects are refused before any matching, with no booking authority granted.
  const productiveEffect = candidate.requestedEffects.find((effect) => PRODUCTIVE_EFFECTS_V1.has(effect));
  if (productiveEffect !== undefined) {
    const text = `Productive effect ${productiveEffect} was requested; this ERV core grants no booking authority and defers to separate Risk-D authorization.`;
    return deepFreeze({ caseId: candidate.caseId, outcome: "DENIED" as const, variant, reasonCode: "RISK_D_AUTHORIZATION_REQUIRED" as const, detail: text, evidenceCitations, advisor: advisorFor(candidate.caseId, "RISK_D", text, candidate.references), authority });
  }

  // AC-02: resolve the requested versioned matching-mode and tolerance variants against the frozen registry.
  const mode = pack.variants.matchingModes.find((entry) => entry.variantId === candidate.matchingMode.variantId && entry.version === candidate.matchingMode.version);
  const policy = pack.variants.tolerancePolicies.find((entry) => entry.variantId === candidate.tolerancePolicy.variantId && entry.version === candidate.tolerancePolicy.version);
  if (mode === undefined || policy === undefined) {
    const missing = mode === undefined
      ? `matching mode ${candidate.matchingMode.variantId} v${candidate.matchingMode.version}`
      : `tolerance policy ${candidate.tolerancePolicy.variantId} v${candidate.tolerancePolicy.version}`;
    const text = `Versioned variant is not present in the frozen registry: ${missing}.`;
    return deepFreeze({ caseId: candidate.caseId, outcome: "EXCEPTION" as const, variant, exceptionCode: "UNKNOWN_VARIANT" as const, detail: text, evidenceCitations, advisor: advisorFor(candidate.caseId, "UNKNOWN_VARIANT", text, candidate.references), authority });
  }

  // AC-01: every reference is independently evidenced; an unbound digest is explicit and does not mask the others.
  const unverified = evidenceCitations.find((citation) => citation.verified === false);
  if (unverified !== undefined) {
    const text = `Reference ${unverified.referenceKind} ${unverified.referenceId} is not independently evidenced: its bound contentSha256 does not match its recomputed body digest.`;
    return deepFreeze({ caseId: candidate.caseId, outcome: "EXCEPTION" as const, variant, exceptionCode: "UNVERIFIED_REFERENCE_EVIDENCE" as const, detail: text, evidenceCitations, advisor: advisorFor(candidate.caseId, "UNVERIFIED_REFERENCE_EVIDENCE", text, candidate.references), authority });
  }

  // AC-03: missing required context is explicit rather than inferred or filled in.
  const byKind = new Map<ErvReferenceKindV1, ErvEvidenceReferenceV1>();
  for (const reference of candidate.references) byKind.set(reference.body.referenceKind, reference);
  const missingKinds = mode.requiredKinds.filter((kind) => !byKind.has(kind));
  if (missingKinds.length > 0) {
    const text = `Required reference kind(s) ${missingKinds.join(", ")} are missing for ${mode.variantId}; the match cannot complete without their independent evidence.`;
    return deepFreeze({ caseId: candidate.caseId, outcome: "EXCEPTION" as const, variant, exceptionCode: "MISSING_CONTEXT" as const, detail: text, evidenceCitations, advisor: advisorFor(candidate.caseId, "MISSING_CONTEXT", text, candidate.references), authority });
  }

  // AC-02/AC-03: compare the versioned amount kinds under the versioned tolerance policy.
  const anchor = byKind.get("INVOICE")!.body.matchAmountMinor;
  const amounts = mode.amountKinds.map((kind) => {
    const reference = byKind.get(kind)!;
    return { kind, referenceId: reference.body.referenceId, amount: reference.body.matchAmountMinor };
  });
  const min = Math.min(...amounts.map((entry) => entry.amount));
  const max = Math.max(...amounts.map((entry) => entry.amount));
  const delta = max - min;
  const toleranceMinor = effectiveToleranceMinor(policy, anchor);
  if (delta <= toleranceMinor) {
    const text = `All ${mode.amountKinds.length} matched references agree within ${policy.variantId} v${policy.version}; confirm there are no unlisted adjustments before acknowledgement.`;
    return deepFreeze({ caseId: candidate.caseId, outcome: "MATCHED" as const, variant, matchedAmountMinor: anchor, evidenceCitations, advisor: advisorFor(candidate.caseId, "MATCHED", text, candidate.references), authority });
  }
  const minEntry = amounts.find((entry) => entry.amount === min)!;
  const maxEntry = amounts.find((entry) => entry.amount === max)!;
  const conflict: ErvConflictDetailV1 = { minReferenceId: minEntry.referenceId, minAmountMinor: min, maxReferenceId: maxEntry.referenceId, maxAmountMinor: max, deltaMinor: delta, toleranceMinor, tolerancePolicyId: policy.variantId, tolerancePolicyVersion: policy.version };
  const text = `Matched amounts disagree beyond ${policy.variantId} v${policy.version} (delta ${delta} minor, tolerance ${toleranceMinor} minor); identify the authoritative reference.`;
  return deepFreeze({ caseId: candidate.caseId, outcome: "CONFLICT" as const, variant, conflict, evidenceCitations, advisor: advisorFor(candidate.caseId, "CONFLICT", text, candidate.references), authority });
}

export function compileErvCapabilityCoreV1(candidate: unknown, claimedPackSha256: string): ErvCoreResultV1 {
  if (!validCasePackShape(candidate)) return deepFreeze({ outcome: "DENIED" as const, reasonCode: "PACK_SHAPE_DENIED" as const });
  const pack = candidate;
  if (claimedPackSha256 !== AP04_ERV_CASE_PACK_SHA256_V1 || canonicalDigestV1(candidate) !== AP04_ERV_CASE_PACK_CANONICAL_SHA256_V1) {
    return deepFreeze({ outcome: "DENIED" as const, reasonCode: "PACK_DIGEST_DENIED" as const });
  }
  const decisions = pack.cases.map((entry) => evaluateErvMatchingCaseV1(entry, pack));
  const decisionDigest = canonicalDigestV1(decisions);
  const pkg: ErvCorePackageV1 = {
    schemaVersion: INCOMING_INVOICE_ERV_CORE_V1,
    packId: pack.packId,
    caseCount: decisions.length,
    decisions,
    authority: { mode: "LOCAL_SYNTHETIC_PROOF", customerDataAuthorized: false, externalProviderCalls: false, productivePostingAuthorized: false, bookingAuthorityGranted: false, riskDCapability: "SEPARATELY_AUTHORIZED" },
    nonclaims: ["NO_CUSTOMER_DATA_EVALUATED", "NO_EXTERNAL_PROVIDER_EVALUATED", "NO_PRODUCTIVE_ALLOCATION_OR_POSTING_AUTHORIZED", "NO_BOOKING_AUTHORITY_GRANTED", "NO_LIVE_ERP_SYSTEM_CLAIM"],
    readback: { packSha256: AP04_ERV_CASE_PACK_CANONICAL_SHA256_V1, decisionDigest, deterministicReplay: true },
  };
  return deepFreeze({ outcome: "DECIDED" as const, package: pkg });
}