import { createHash } from "node:crypto";
import { canonicalJson } from "./canonical-json.js";

export const EXTENSION_ASSURANCE_SECURITY_ROUTING_INPUT_SCHEMA_V1 =
  "chimpmaera.extension-trust/assurance-security-routing-input/v1" as const;
export const EXTENSION_ASSURANCE_SECURITY_ROUTING_DECISION_SCHEMA_V1 =
  "chimpmaera.extension-trust/assurance-security-routing-decision/v1" as const;
export const EXTENSION_ASSURANCE_SECURITY_ROUTING_CLAIM_BOUNDARY_V1 =
  "LOCAL_SYNTHETIC_SECURITY_ROUTING_ONLY_NO_TRUST_BADGE_NO_ADMISSION_NO_PUBLICATION_NO_RELEASE" as const;

export const EXTENSION_ASSURANCE_SEVERITIES_V1 = [
  "LOW",
  "MODERATE",
  "HIGH",
  "CRITICAL",
] as const;

export const EXTENSION_ASSURANCE_FINDING_CLASSES_V1 = [
  "CREDENTIAL",
  "PERSONAL_DATA",
  "EXPLOIT",
  "SECURITY_SENSITIVE",
  "PUBLIC_SAFE_SYNTHETIC",
] as const;

export const EXTENSION_ASSURANCE_SENSITIVE_FINDING_CLASSES_V1 = [
  "CREDENTIAL",
  "PERSONAL_DATA",
  "EXPLOIT",
  "SECURITY_SENSITIVE",
] as const;

export const EXTENSION_ASSURANCE_SECURITY_ROUTING_REASON_CODES_V1 = [
  "PUBLIC_EVIDENCE_ROUTED",
  "SECURITY_SENSITIVE_PRIVATE",
  "HIGH_SEVERITY_PRIVATE",
  "SCHEMA_DENIED",
  "FINDING_DIGEST_MISMATCH_DENIED",
  "SEVERITY_CLASSIFICATION_MISMATCH_DENIED",
  "PUBLIC_ROUTE_ATTEMPT_DENIED",
] as const;

export type ExtensionAssuranceSeverityV1 = typeof EXTENSION_ASSURANCE_SEVERITIES_V1[number];
export type ExtensionAssuranceFindingClassV1 = typeof EXTENSION_ASSURANCE_FINDING_CLASSES_V1[number];
export type ExtensionAssuranceSecurityRoutingRouteV1 = "PUBLIC_EVIDENCE" | "SECURITY_POLICY_PRIVATE";
export type ExtensionAssuranceSecurityRoutingDetailV1 = "FIXED_REASON_CODES_ONLY" | "NONE";
export type ExtensionAssuranceSecurityRoutingOutcomeV1 = "ROUTED" | "DENY";
export type ExtensionAssuranceSecurityRoutingReasonCodeV1 =
  typeof EXTENSION_ASSURANCE_SECURITY_ROUTING_REASON_CODES_V1[number];

export interface ExtensionAssuranceSecurityRoutingFindingV1 {
  readonly findingId: string;
  readonly findingDigest: string;
  readonly severity: ExtensionAssuranceSeverityV1;
  readonly findingClass: ExtensionAssuranceFindingClassV1;
}

export interface ExtensionAssuranceSecurityRoutingInputV1 {
  readonly schemaVersion: typeof EXTENSION_ASSURANCE_SECURITY_ROUTING_INPUT_SCHEMA_V1;
  readonly finding: ExtensionAssuranceSecurityRoutingFindingV1;
  readonly evidence: {
    readonly evidenceId: string;
    readonly evidenceDigest: string;
  };
  readonly policy: {
    readonly policyId: string;
    readonly policyVersion: string;
    readonly policyDigest: string;
  };
  readonly requestedRoute: ExtensionAssuranceSecurityRoutingRouteV1;
}

export interface ExtensionAssuranceSecurityRoutingDecisionV1 {
  readonly schemaVersion: typeof EXTENSION_ASSURANCE_SECURITY_ROUTING_DECISION_SCHEMA_V1;
  readonly outcome: ExtensionAssuranceSecurityRoutingOutcomeV1;
  readonly route: ExtensionAssuranceSecurityRoutingRouteV1;
  readonly publicDetail: ExtensionAssuranceSecurityRoutingDetailV1;
  readonly reasonCodes: readonly ExtensionAssuranceSecurityRoutingReasonCodeV1[];
  readonly severity: ExtensionAssuranceSeverityV1 | null;
  readonly findingDigest: string | null;
  readonly evidenceDigest: string | null;
  readonly policyId: string | null;
  readonly policyVersion: string | null;
  readonly policyDigest: string | null;
  readonly claimBoundary: typeof EXTENSION_ASSURANCE_SECURITY_ROUTING_CLAIM_BOUNDARY_V1;
  readonly decisionDigest: string;
}

function digest(value: unknown): string {
  return createHash("sha256").update(canonicalJson(value)).digest("hex");
}

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

function isSemver(value: unknown): value is string {
  return typeof value === "string" && /^\d+\.\d+\.\d+$/.test(value);
}

function isDigest(value: unknown): value is string {
  return typeof value === "string" && /^[a-f0-9]{64}$/.test(value);
}

function validFinding(value: unknown): value is ExtensionAssuranceSecurityRoutingFindingV1 {
  return exactKeys(value, ["findingId", "findingDigest", "severity", "findingClass"])
    && isId(value.findingId) && isDigest(value.findingDigest)
    && EXTENSION_ASSURANCE_SEVERITIES_V1.includes(value.severity as ExtensionAssuranceSeverityV1)
    && EXTENSION_ASSURANCE_FINDING_CLASSES_V1.includes(value.findingClass as ExtensionAssuranceFindingClassV1);
}

function validEvidence(value: unknown): value is ExtensionAssuranceSecurityRoutingInputV1["evidence"] {
  return exactKeys(value, ["evidenceId", "evidenceDigest"])
    && isId(value.evidenceId) && isDigest(value.evidenceDigest);
}

function validPolicy(value: unknown): value is ExtensionAssuranceSecurityRoutingInputV1["policy"] {
  return exactKeys(value, ["policyId", "policyVersion", "policyDigest"])
    && isId(value.policyId) && isSemver(value.policyVersion) && isDigest(value.policyDigest);
}

function validInput(value: unknown): value is ExtensionAssuranceSecurityRoutingInputV1 {
  return exactKeys(value, ["schemaVersion", "finding", "evidence", "policy", "requestedRoute"])
    && value.schemaVersion === EXTENSION_ASSURANCE_SECURITY_ROUTING_INPUT_SCHEMA_V1
    && validFinding(value.finding) && validEvidence(value.evidence) && validPolicy(value.policy)
    && (value.requestedRoute === "PUBLIC_EVIDENCE" || value.requestedRoute === "SECURITY_POLICY_PRIVATE");
}

export function extensionAssuranceFindingDigestV1(
  finding: Omit<ExtensionAssuranceSecurityRoutingFindingV1, "findingDigest">,
): string {
  return digest({ ...finding });
}

function decision(
  outcome: ExtensionAssuranceSecurityRoutingOutcomeV1,
  route: ExtensionAssuranceSecurityRoutingRouteV1,
  publicDetail: ExtensionAssuranceSecurityRoutingDetailV1,
  reasonCodes: readonly ExtensionAssuranceSecurityRoutingReasonCodeV1[],
  echo: {
    severity: ExtensionAssuranceSecurityRoutingDecisionV1["severity"];
    findingDigest: ExtensionAssuranceSecurityRoutingDecisionV1["findingDigest"];
    evidenceDigest: ExtensionAssuranceSecurityRoutingDecisionV1["evidenceDigest"];
    policyId: ExtensionAssuranceSecurityRoutingDecisionV1["policyId"];
    policyVersion: ExtensionAssuranceSecurityRoutingDecisionV1["policyVersion"];
    policyDigest: ExtensionAssuranceSecurityRoutingDecisionV1["policyDigest"];
  },
): ExtensionAssuranceSecurityRoutingDecisionV1 {
  const body = {
    schemaVersion: EXTENSION_ASSURANCE_SECURITY_ROUTING_DECISION_SCHEMA_V1,
    outcome,
    route,
    publicDetail,
    reasonCodes: [...reasonCodes],
    ...echo,
    claimBoundary: EXTENSION_ASSURANCE_SECURITY_ROUTING_CLAIM_BOUNDARY_V1,
  };
  return { ...body, decisionDigest: digest(body) };
}

function ordered(reasons: ReadonlySet<ExtensionAssuranceSecurityRoutingReasonCodeV1>):
  readonly ExtensionAssuranceSecurityRoutingReasonCodeV1[] {
  return EXTENSION_ASSURANCE_SECURITY_ROUTING_REASON_CODES_V1.filter((code) => reasons.has(code));
}

function deny(reasonCodes: readonly ExtensionAssuranceSecurityRoutingReasonCodeV1[]):
  ExtensionAssuranceSecurityRoutingDecisionV1 {
  return decision(
    "DENY",
    "SECURITY_POLICY_PRIVATE",
    "NONE",
    reasonCodes,
    {
      severity: null,
      findingDigest: null,
      evidenceDigest: null,
      policyId: null,
      policyVersion: null,
      policyDigest: null,
    },
  );
}

export function decideExtensionAssuranceSecurityRoutingV1(value: unknown):
  ExtensionAssuranceSecurityRoutingDecisionV1 {
  if (!validInput(value)) return deny(["SCHEMA_DENIED"]);
  const input = value;
  const { finding, policy, requestedRoute } = input;
  const reasons = new Set<ExtensionAssuranceSecurityRoutingReasonCodeV1>();
  const elevated = finding.severity === "HIGH" || finding.severity === "CRITICAL";
  const sensitiveClass = EXTENSION_ASSURANCE_SENSITIVE_FINDING_CLASSES_V1
    .includes(finding.findingClass as (typeof EXTENSION_ASSURANCE_SENSITIVE_FINDING_CLASSES_V1)[number]);
  if (
    extensionAssuranceFindingDigestV1({
      findingId: finding.findingId,
      severity: finding.severity,
      findingClass: finding.findingClass,
    }) !== finding.findingDigest
  ) {
    reasons.add("FINDING_DIGEST_MISMATCH_DENIED");
  }
  if (elevated && finding.findingClass === "PUBLIC_SAFE_SYNTHETIC") {
    reasons.add("SEVERITY_CLASSIFICATION_MISMATCH_DENIED");
  }
  if ((elevated || sensitiveClass) && requestedRoute === "PUBLIC_EVIDENCE") {
    reasons.add("PUBLIC_ROUTE_ATTEMPT_DENIED");
  }
  if (reasons.size > 0) return deny(ordered(reasons));

  if (elevated || sensitiveClass) {
    const privateCodes: ExtensionAssuranceSecurityRoutingReasonCodeV1[] = [];
    if (sensitiveClass) privateCodes.push("SECURITY_SENSITIVE_PRIVATE");
    if (elevated) privateCodes.push("HIGH_SEVERITY_PRIVATE");
    return decision(
      "ROUTED",
      "SECURITY_POLICY_PRIVATE",
      "NONE",
      privateCodes,
      {
        severity: finding.severity,
        findingDigest: finding.findingDigest,
        evidenceDigest: input.evidence.evidenceDigest,
        policyId: policy.policyId,
        policyVersion: policy.policyVersion,
        policyDigest: policy.policyDigest,
      },
    );
  }
  return decision(
    "ROUTED",
    "PUBLIC_EVIDENCE",
    "FIXED_REASON_CODES_ONLY",
    ["PUBLIC_EVIDENCE_ROUTED"],
    {
      severity: finding.severity,
      findingDigest: finding.findingDigest,
      evidenceDigest: input.evidence.evidenceDigest,
      policyId: policy.policyId,
      policyVersion: policy.policyVersion,
      policyDigest: policy.policyDigest,
    },
  );
}

export function renderExtensionAssuranceSecurityRoutingDecisionV1(value: unknown): string {
  return canonicalJson(decideExtensionAssuranceSecurityRoutingV1(value));
}