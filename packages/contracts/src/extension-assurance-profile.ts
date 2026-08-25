import { createHash } from "node:crypto";
import { canonicalJson } from "./canonical-json.js";

export const EXTENSION_ASSURANCE_PROFILE_SCHEMA_V1 = "chimpmaera.extension-trust/assurance-profile/v1" as const;
export const EXTENSION_ASSURANCE_RESULT_SCHEMA_V1 = "chimpmaera.extension-trust/assurance-result/v1" as const;
export const EXTENSION_ASSURANCE_CLAIM_BOUNDARY_V1 =
  "LOCAL_SYNTHETIC_PROFILE_ONLY_NO_TRUST_BADGE_NO_ACCEPTANCE_NO_ACTIVATION_NO_EXECUTION" as const;

export const EXTENSION_ASSURANCE_HARD_FAIL_RULES_V1 = [
  "MALWARE_SIGNAL",
  "CREDENTIAL_ACCESS",
  "AUTHORITY_EXPANSION",
  "UNBOUNDED_NETWORK_EGRESS",
  "UNVERIFIED_EXECUTABLE",
  "PROHIBITED_DATA_DISCLOSURE",
  "SIGNATURE_OR_DIGEST_MISMATCH",
  "EVIDENCE_TAMPER",
] as const;

export const EXTENSION_ASSURANCE_RETEST_TRIGGERS_V1 = [
  "SUBJECT_CHANGED",
  "PROFILE_CHANGED",
  "EVIDENCE_EXPIRED",
  "POLICY_CHANGED",
  "FALSE_NEGATIVE_CONFIRMED",
  "MANUAL",
] as const;

export type ExtensionAssuranceHardFailRuleV1 = typeof EXTENSION_ASSURANCE_HARD_FAIL_RULES_V1[number];
export type ExtensionAssuranceRuleV1 = ExtensionAssuranceHardFailRuleV1 | "OPTIONAL_MANUAL_REVIEW";
export type ExtensionAssuranceRetestTriggerV1 = typeof EXTENSION_ASSURANCE_RETEST_TRIGGERS_V1[number];

export type ExtensionAssuranceReasonCodeV1 =
  | "PROFILE_CONFORMANT"
  | "SCHEMA_DENIED"
  | "DIGEST_MISMATCH_DENIED"
  | "UNIVERSAL_GATE_MISSING_DENIED"
  | "REQUIRED_CHECK_NOT_RUN_DENIED"
  | "HARD_FAIL_DENIED"
  | "SECURITY_ROUTING_DENIED"
  | "RETEST_CONTRACT_DENIED"
  | "EVIDENCE_MISMATCH_RETEST_REQUIRED"
  | "EVIDENCE_STALE_RETEST_REQUIRED"
  | "FALSE_NEGATIVE_RETEST_REQUIRED";

export interface ExtensionAssuranceProfileV1 {
  readonly schemaVersion: typeof EXTENSION_ASSURANCE_PROFILE_SCHEMA_V1;
  readonly profileId: string;
  readonly profileVersion: string;
  readonly subject: {
    readonly kind: "EXTENSION" | "CONNECTOR";
    readonly subjectId: string;
    readonly subjectVersion: string;
    readonly subjectDigest: string;
  };
  readonly riskClass: "LOW" | "MODERATE" | "HIGH" | "CRITICAL";
  readonly evaluatedAtMs: number;
  readonly evidence: {
    readonly collectedAtMs: number;
    readonly expiresAtMs: number;
    readonly subjectDigest: string;
    readonly artifactRefs: readonly string[];
  };
  readonly checks: readonly {
    readonly checkId: string;
    readonly ruleId: ExtensionAssuranceRuleV1;
    readonly runDecision: "RUN" | "NOT_RUN";
    readonly outcome: "PASS" | "FAIL" | "NOT_RUN";
    readonly notRunReason: "NONE" | "NOT_APPLICABLE" | "PRIVATE_LAB_REQUIRED";
    readonly evidenceRefs: readonly string[];
  }[];
  readonly retestTriggers: readonly ExtensionAssuranceRetestTriggerV1[];
  readonly falseResultTracking: {
    readonly confirmedFalsePositiveCount: number;
    readonly confirmedFalseNegativeCount: number;
    readonly openReviewCount: number;
    readonly reviewedAtMs: number;
    readonly evidenceRefs: readonly string[];
  };
  readonly securityRouting: {
    readonly classification: "PUBLIC_SAFE" | "SECURITY_SENSITIVE";
    readonly route: "PUBLIC_EVIDENCE" | "SECURITY_POLICY_PRIVATE";
    readonly publicDetail: "FIXED_REASON_CODES_ONLY" | "NONE";
  };
  readonly publicClaim:
    | "LOCALLY_EVALUATED_SYNTHETIC"
    | "ASSURANCE_DENIED"
    | "EVIDENCE_EXPIRED_RETEST_REQUIRED"
    | "INCONCLUSIVE";
  readonly claimBoundary: typeof EXTENSION_ASSURANCE_CLAIM_BOUNDARY_V1;
  readonly profileDigest: string;
}

export interface ExtensionAssuranceResultV1 {
  readonly schemaVersion: typeof EXTENSION_ASSURANCE_RESULT_SCHEMA_V1;
  readonly outcome: "PROFILE_CONFORMANT" | "DENIED" | "RETEST_REQUIRED";
  readonly reasonCodes: readonly ExtensionAssuranceReasonCodeV1[];
  readonly publicClaim: ExtensionAssuranceProfileV1["publicClaim"];
  readonly claimBoundary: typeof EXTENSION_ASSURANCE_CLAIM_BOUNDARY_V1;
}

const REASON_ORDER: readonly ExtensionAssuranceReasonCodeV1[] = [
  "SCHEMA_DENIED",
  "DIGEST_MISMATCH_DENIED",
  "UNIVERSAL_GATE_MISSING_DENIED",
  "REQUIRED_CHECK_NOT_RUN_DENIED",
  "HARD_FAIL_DENIED",
  "SECURITY_ROUTING_DENIED",
  "RETEST_CONTRACT_DENIED",
  "EVIDENCE_MISMATCH_RETEST_REQUIRED",
  "EVIDENCE_STALE_RETEST_REQUIRED",
  "FALSE_NEGATIVE_RETEST_REQUIRED",
];

const DENIAL_REASONS = new Set<ExtensionAssuranceReasonCodeV1>([
  "SCHEMA_DENIED",
  "DIGEST_MISMATCH_DENIED",
  "UNIVERSAL_GATE_MISSING_DENIED",
  "REQUIRED_CHECK_NOT_RUN_DENIED",
  "HARD_FAIL_DENIED",
  "SECURITY_ROUTING_DENIED",
  "RETEST_CONTRACT_DENIED",
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    && Object.getPrototypeOf(value) === Object.prototype;
}

function exactKeys(value: unknown, keys: readonly string[]): value is Record<string, unknown> {
  return isRecord(value) && canonicalJson(Object.keys(value).sort()) === canonicalJson([...keys].sort());
}

function isId(value: unknown): value is string {
  return typeof value === "string" && /^[a-z][a-z0-9-]{1,31}:[a-z0-9][a-z0-9._-]{2,95}$/.test(value);
}

function isDigest(value: unknown): value is string {
  return typeof value === "string" && /^[a-f0-9]{64}$/.test(value);
}

function isArtifactRef(value: unknown): value is string {
  return typeof value === "string" && /^artifact:sha256:[a-f0-9]{64}$/.test(value);
}

// Canonical numbers are raw values, not JSON text: -0 must fail closed even
// though canonicalJson re-serializes it as 0 and the digest cannot tell them apart.
function isCanonicalNonNegativeNumber(value: unknown): value is number {
  return Number.isSafeInteger(value) && (value as number) >= 0 && !Object.is(value, -0);
}

function isTimestamp(value: unknown): value is number {
  return isCanonicalNonNegativeNumber(value);
}

function isCount(value: unknown): value is number {
  return isCanonicalNonNegativeNumber(value);
}

function isUniqueArray<T extends string>(
  value: unknown,
  predicate: (item: unknown) => item is T,
  allowEmpty = false,
): value is T[] {
  return Array.isArray(value) && (allowEmpty || value.length > 0) && value.every(predicate)
    && new Set(value).size === value.length;
}

function validSubject(value: unknown): value is ExtensionAssuranceProfileV1["subject"] {
  return exactKeys(value, ["kind", "subjectId", "subjectVersion", "subjectDigest"])
    && ["EXTENSION", "CONNECTOR"].includes(value.kind as string)
    && isId(value.subjectId) && typeof value.subjectVersion === "string"
    && /^\d+\.\d+\.\d+$/.test(value.subjectVersion) && isDigest(value.subjectDigest);
}

function validEvidence(value: unknown): value is ExtensionAssuranceProfileV1["evidence"] {
  return exactKeys(value, ["collectedAtMs", "expiresAtMs", "subjectDigest", "artifactRefs"])
    && isTimestamp(value.collectedAtMs) && isTimestamp(value.expiresAtMs)
    && isDigest(value.subjectDigest) && isUniqueArray(value.artifactRefs, isArtifactRef);
}

function isRule(value: unknown): value is ExtensionAssuranceRuleV1 {
  return typeof value === "string"
    && [...EXTENSION_ASSURANCE_HARD_FAIL_RULES_V1, "OPTIONAL_MANUAL_REVIEW"].includes(value as ExtensionAssuranceRuleV1);
}

function validCheck(value: unknown): value is ExtensionAssuranceProfileV1["checks"][number] {
  if (!exactKeys(value, ["checkId", "ruleId", "runDecision", "outcome", "notRunReason", "evidenceRefs"])
    || !isId(value.checkId) || !isRule(value.ruleId)
    || !["RUN", "NOT_RUN"].includes(value.runDecision as string)
    || !["PASS", "FAIL", "NOT_RUN"].includes(value.outcome as string)
    || !["NONE", "NOT_APPLICABLE", "PRIVATE_LAB_REQUIRED"].includes(value.notRunReason as string)
    || !isUniqueArray(value.evidenceRefs, isArtifactRef, true)) return false;
  if (value.runDecision === "RUN") {
    return ["PASS", "FAIL"].includes(value.outcome as string)
      && value.notRunReason === "NONE" && value.evidenceRefs.length > 0;
  }
  return value.outcome === "NOT_RUN" && value.notRunReason !== "NONE" && value.evidenceRefs.length === 0;
}

function validFalseResultTracking(value: unknown): value is ExtensionAssuranceProfileV1["falseResultTracking"] {
  return exactKeys(value, [
    "confirmedFalsePositiveCount", "confirmedFalseNegativeCount", "openReviewCount", "reviewedAtMs", "evidenceRefs",
  ]) && isCount(value.confirmedFalsePositiveCount) && isCount(value.confirmedFalseNegativeCount)
    && isCount(value.openReviewCount) && isTimestamp(value.reviewedAtMs)
    && isUniqueArray(value.evidenceRefs, isArtifactRef, true);
}

function validSecurityRouting(value: unknown): value is ExtensionAssuranceProfileV1["securityRouting"] {
  return exactKeys(value, ["classification", "route", "publicDetail"])
    && ["PUBLIC_SAFE", "SECURITY_SENSITIVE"].includes(value.classification as string)
    && ["PUBLIC_EVIDENCE", "SECURITY_POLICY_PRIVATE"].includes(value.route as string)
    && ["FIXED_REASON_CODES_ONLY", "NONE"].includes(value.publicDetail as string);
}

function validProfile(value: unknown): value is ExtensionAssuranceProfileV1 {
  if (!exactKeys(value, [
    "schemaVersion", "profileId", "profileVersion", "subject", "riskClass", "evaluatedAtMs", "evidence",
    "checks", "retestTriggers", "falseResultTracking", "securityRouting", "publicClaim", "claimBoundary", "profileDigest",
  ])) return false;
  const retestTrigger = (item: unknown): item is ExtensionAssuranceRetestTriggerV1 => typeof item === "string"
    && EXTENSION_ASSURANCE_RETEST_TRIGGERS_V1.includes(item as ExtensionAssuranceRetestTriggerV1);
  const claims: readonly ExtensionAssuranceProfileV1["publicClaim"][] = [
    "LOCALLY_EVALUATED_SYNTHETIC", "ASSURANCE_DENIED", "EVIDENCE_EXPIRED_RETEST_REQUIRED", "INCONCLUSIVE",
  ];
  return value.schemaVersion === EXTENSION_ASSURANCE_PROFILE_SCHEMA_V1 && isId(value.profileId)
    && typeof value.profileVersion === "string" && /^\d+\.\d+\.\d+$/.test(value.profileVersion)
    && validSubject(value.subject) && ["LOW", "MODERATE", "HIGH", "CRITICAL"].includes(value.riskClass as string)
    && isTimestamp(value.evaluatedAtMs) && validEvidence(value.evidence)
    && Array.isArray(value.checks) && value.checks.length > 0 && value.checks.length <= 32
    && value.checks.every(validCheck) && new Set(value.checks.map(({ ruleId }) => ruleId)).size === value.checks.length
    && isUniqueArray(value.retestTriggers, retestTrigger) && validFalseResultTracking(value.falseResultTracking)
    && validSecurityRouting(value.securityRouting) && claims.includes(value.publicClaim as ExtensionAssuranceProfileV1["publicClaim"])
    && value.claimBoundary === EXTENSION_ASSURANCE_CLAIM_BOUNDARY_V1 && isDigest(value.profileDigest);
}

export function extensionAssuranceProfileDigestV1(value: Record<string, unknown>): string {
  const unsigned = Object.fromEntries(Object.entries(value).filter(([key]) => key !== "profileDigest"));
  return createHash("sha256").update(canonicalJson(unsigned)).digest("hex");
}

export function evaluateExtensionAssuranceProfileV1(value: unknown): ExtensionAssuranceResultV1 {
  if (!validProfile(value)) {
    return {
      schemaVersion: EXTENSION_ASSURANCE_RESULT_SCHEMA_V1,
      outcome: "DENIED",
      reasonCodes: ["SCHEMA_DENIED"],
      publicClaim: "INCONCLUSIVE",
      claimBoundary: EXTENSION_ASSURANCE_CLAIM_BOUNDARY_V1,
    };
  }

  const reasons = new Set<ExtensionAssuranceReasonCodeV1>();
  if (extensionAssuranceProfileDigestV1(value as unknown as Record<string, unknown>) !== value.profileDigest) {
    reasons.add("DIGEST_MISMATCH_DENIED");
  }
  const checks = new Map(value.checks.map((check) => [check.ruleId, check]));
  for (const ruleId of EXTENSION_ASSURANCE_HARD_FAIL_RULES_V1) {
    const check = checks.get(ruleId);
    if (check === undefined) reasons.add("UNIVERSAL_GATE_MISSING_DENIED");
    else if (check.runDecision !== "RUN") reasons.add("REQUIRED_CHECK_NOT_RUN_DENIED");
    else if (check.outcome === "FAIL") reasons.add("HARD_FAIL_DENIED");
  }
  const routing = value.securityRouting;
  const routingValid = routing.classification === "SECURITY_SENSITIVE"
    ? routing.route === "SECURITY_POLICY_PRIVATE" && routing.publicDetail === "NONE"
    : routing.route === "PUBLIC_EVIDENCE" && routing.publicDetail === "FIXED_REASON_CODES_ONLY";
  if (!routingValid) reasons.add("SECURITY_ROUTING_DENIED");
  if (!EXTENSION_ASSURANCE_RETEST_TRIGGERS_V1.every((trigger) => value.retestTriggers.includes(trigger))) {
    reasons.add("RETEST_CONTRACT_DENIED");
  }
  if (value.evidence.subjectDigest !== value.subject.subjectDigest) {
    reasons.add("EVIDENCE_MISMATCH_RETEST_REQUIRED");
  }
  if (value.evidence.expiresAtMs <= value.evidence.collectedAtMs
    || value.evaluatedAtMs > value.evidence.expiresAtMs) {
    reasons.add("EVIDENCE_STALE_RETEST_REQUIRED");
  }
  if (value.falseResultTracking.confirmedFalseNegativeCount > 0) {
    reasons.add("FALSE_NEGATIVE_RETEST_REQUIRED");
  }

  const ordered = REASON_ORDER.filter((reason) => reasons.has(reason));
  if (ordered.some((reason) => DENIAL_REASONS.has(reason))) {
    return {
      schemaVersion: EXTENSION_ASSURANCE_RESULT_SCHEMA_V1,
      outcome: "DENIED",
      reasonCodes: ordered,
      publicClaim: "ASSURANCE_DENIED",
      claimBoundary: EXTENSION_ASSURANCE_CLAIM_BOUNDARY_V1,
    };
  }
  if (ordered.length > 0) {
    return {
      schemaVersion: EXTENSION_ASSURANCE_RESULT_SCHEMA_V1,
      outcome: "RETEST_REQUIRED",
      reasonCodes: ordered,
      publicClaim: "EVIDENCE_EXPIRED_RETEST_REQUIRED",
      claimBoundary: EXTENSION_ASSURANCE_CLAIM_BOUNDARY_V1,
    };
  }
  return {
    schemaVersion: EXTENSION_ASSURANCE_RESULT_SCHEMA_V1,
    outcome: "PROFILE_CONFORMANT",
    reasonCodes: ["PROFILE_CONFORMANT"],
    publicClaim: "LOCALLY_EVALUATED_SYNTHETIC",
    claimBoundary: EXTENSION_ASSURANCE_CLAIM_BOUNDARY_V1,
  };
}

export function renderPublicExtensionAssuranceResultV1(value: unknown): string {
  return canonicalJson(evaluateExtensionAssuranceProfileV1(value));
}
