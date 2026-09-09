import { createHash } from "node:crypto";
import { canonicalJson } from "./canonical-json.js";

export const VERIFICATION_DAG_SCHEMA_V2 = "chimpmaera.verification/evidence-dag/v2" as const;
export const VERIFICATION_IMPACT_PLAN_SCHEMA_V2 = "chimpmaera.verification/impact-plan/v2" as const;
export const VERIFICATION_ATTESTATION_SCHEMA_V2 = "chimpmaera.verification/attestation/v2" as const;
export const VERIFICATION_SHADOW_REPORT_SCHEMA_V2 = "chimpmaera.verification/shadow-report/v2" as const;

export const DEFAULT_VERIFICATION_HARD_GATES_V2 = [
  "npm run lint",
  "npm run release-governance:verify",
  "npm run supply-chain:verify",
  "sha256sum -c SHA256SUMS",
  "./scripts/build-public-release.sh --output <isolated-absolute-path>",
] as const;

export type VerificationInputRoleV2 =
  | "SOURCE"
  | "CONTRACT"
  | "SCHEMA"
  | "FIXTURE"
  | "VALIDATOR"
  | "TOOLCHAIN"
  | "ENVIRONMENT"
  | "SECURITY"
  | "DERIVED_EVIDENCE";

export interface VerificationDagInputV2 {
  readonly releaseId?: string;
  readonly path: string;
  readonly role: VerificationInputRoleV2;
  readonly sha256: string;
}

export interface VerificationDagNodeV2 {
  readonly id: string;
  readonly dependsOn: readonly string[];
  readonly inputs: readonly VerificationDagInputV2[];
  readonly ownedTests: readonly string[];
  readonly invariants: readonly string[];
  readonly riskClass: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  readonly globalInvalidation: boolean;
  readonly evidenceTtlMs?: number;
  readonly ttlJustification?: string;
}

export interface VerificationDagV2 {
  readonly schemaVersion: typeof VERIFICATION_DAG_SCHEMA_V2;
  readonly graphId: string;
  readonly graphVersion: number;
  readonly environment: {
    readonly node: string;
    readonly os: string;
    readonly architecture: string;
    readonly packageManager: string;
  };
  readonly hardGates: readonly string[];
  readonly nodes: readonly VerificationDagNodeV2[];
}

export type VerificationFallbackReasonV2 =
  | "AMBIGUOUS_OWNERSHIP"
  | "CENTRAL_INPUT_CHANGED"
  | "CLASSIFIER_FAILURE"
  | "GRAPH_CHANGED"
  | "GRAPH_DRIFT"
  | "INVALID_GRAPH"
  | "UNMAPPED_PATH"
  | "UNSAFE_PATH";

export interface VerificationImpactPlanV2 {
  readonly schemaVersion: typeof VERIFICATION_IMPACT_PLAN_SCHEMA_V2;
  readonly mode: "IMPACTED_SHADOW" | "FULL_FALLBACK";
  readonly baseSha: string;
  readonly headSha: string;
  readonly graphDigest: string;
  readonly changedPaths: readonly string[];
  readonly selectedNodes: readonly string[];
  readonly selectedTests: readonly string[];
  readonly hardGates: readonly string[];
  readonly reasons: readonly VerificationFallbackReasonV2[];
  readonly authoritativeComparator: "npm test";
  readonly planDigest: string;
}

export interface VerificationAttestationV2 {
  readonly schemaVersion: typeof VERIFICATION_ATTESTATION_SCHEMA_V2;
  readonly nodeId: string;
  readonly nodeDigest: string;
  readonly graphDigest: string;
  readonly toolchainDigest: string;
  readonly environmentDigest: string;
  readonly createdAtMs: number;
  readonly expiresAtMs?: number;
  readonly testResults: readonly {
    readonly test: string;
    readonly outcome: "PASS";
  }[];
  readonly attestationDigest: string;
}

export type VerificationAttestationDenialV2 =
  | "ATTESTATION_MISSING_DENIED"
  | "ATTESTATION_SCHEMA_DENIED"
  | "ATTESTATION_TAMPERED_DENIED"
  | "ATTESTATION_STALE_DENIED"
  | "ATTESTATION_MISMATCH_DENIED";

export interface VerificationShadowReportV2 {
  readonly schemaVersion: typeof VERIFICATION_SHADOW_REPORT_SCHEMA_V2;
  readonly status: "SHADOW_PASS" | "SHADOW_FAIL";
  readonly activation: "BLOCKED_SAMPLE_GATE";
  readonly plan: VerificationImpactPlanV2;
  readonly comparator: {
    readonly command: "npm test";
    readonly authoritative: true;
    readonly executed: true;
    readonly exitCode: number;
  };
}

function digest(value: unknown): string {
  return createHash("sha256").update(canonicalJson(value)).digest("hex");
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    && Object.getPrototypeOf(value) === Object.prototype;
}

function exactKeys(value: unknown, required: readonly string[], optional: readonly string[] = []): value is Record<string, unknown> {
  if (!isRecord(value)) return false;
  const actual = Object.keys(value);
  return required.every((key) => actual.includes(key))
    && actual.every((key) => required.includes(key) || optional.includes(key));
}

function isDigest(value: unknown): value is string {
  return typeof value === "string" && /^[a-f0-9]{64}$/.test(value);
}

function isCommit(value: unknown): value is string {
  return typeof value === "string" && /^[a-f0-9]{40}$/.test(value);
}

function isIdentifier(value: unknown): value is string {
  return typeof value === "string" && /^[a-z][a-z0-9-]{1,63}$/.test(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.length > 0 && value.length <= 512;
}

function uniqueStrings(value: unknown, predicate: (item: unknown) => boolean = isNonEmptyString): value is string[] {
  return Array.isArray(value) && value.every(predicate) && new Set(value).size === value.length;
}

export function isSafeRepositoryPathV2(value: unknown): value is string {
  if (typeof value !== "string" || value.length === 0 || value.length > 512
    || value.startsWith("/") || value.includes("\\") || value.includes("\0")
    || value !== value.normalize("NFC")) return false;
  return value.split("/").every((part) => part.length > 0 && part !== "." && part !== "..");
}

function validInput(value: unknown): value is VerificationDagInputV2 {
  const roles: readonly VerificationInputRoleV2[] = [
    "SOURCE", "CONTRACT", "SCHEMA", "FIXTURE", "VALIDATOR", "TOOLCHAIN",
    "ENVIRONMENT", "SECURITY", "DERIVED_EVIDENCE",
  ];
  return exactKeys(value, ["path", "role", "sha256"], ["releaseId"])
    && (!Object.hasOwn(value, "releaseId") || isIdentifier(value.releaseId))
    && isSafeRepositoryPathV2(value.path)
    && roles.includes(value.role as VerificationInputRoleV2)
    && isDigest(value.sha256);
}

function validNodeShape(value: unknown): value is VerificationDagNodeV2 {
  if (!exactKeys(value, [
    "id", "dependsOn", "inputs", "ownedTests", "invariants", "riskClass", "globalInvalidation",
  ], ["evidenceTtlMs", "ttlJustification"])) return false;
  if (!isIdentifier(value.id) || !uniqueStrings(value.dependsOn, isIdentifier)
    || !Array.isArray(value.inputs) || value.inputs.length === 0 || !value.inputs.every(validInput)
    || new Set(value.inputs.map((input) => input.path)).size !== value.inputs.length
    || !uniqueStrings(value.ownedTests) || value.ownedTests.length === 0
    || !uniqueStrings(value.invariants) || value.invariants.length === 0
    || !["LOW", "MEDIUM", "HIGH", "CRITICAL"].includes(value.riskClass as string)
    || typeof value.globalInvalidation !== "boolean") return false;
  const hasTtl = Object.hasOwn(value, "evidenceTtlMs") || Object.hasOwn(value, "ttlJustification");
  return !hasTtl || (Number.isSafeInteger(value.evidenceTtlMs) && (value.evidenceTtlMs as number) > 0
    && isNonEmptyString(value.ttlJustification));
}

function cycleOrUnknown(nodes: readonly VerificationDagNodeV2[]): boolean {
  const byId = new Map(nodes.map((node) => [node.id, node]));
  if (byId.size !== nodes.length) return true;
  const visiting = new Set<string>();
  const visited = new Set<string>();
  const visit = (id: string): boolean => {
    if (visiting.has(id)) return true;
    if (visited.has(id)) return false;
    const node = byId.get(id);
    if (!node) return true;
    visiting.add(id);
    if (node.dependsOn.some((dependency) => !byId.has(dependency) || visit(dependency))) return true;
    visiting.delete(id);
    visited.add(id);
    return false;
  };
  return nodes.some((node) => visit(node.id));
}

export function validateVerificationDagV2(value: unknown): value is VerificationDagV2 {
  if (!exactKeys(value, ["schemaVersion", "graphId", "graphVersion", "environment", "hardGates", "nodes"])
    || value.schemaVersion !== VERIFICATION_DAG_SCHEMA_V2 || !isIdentifier(value.graphId)
    || !Number.isSafeInteger(value.graphVersion) || (value.graphVersion as number) < 1
    || !exactKeys(value.environment, ["node", "os", "architecture", "packageManager"])
    || !Object.values(value.environment).every(isNonEmptyString)
    || !uniqueStrings(value.hardGates) || value.hardGates.length === 0
    || !Array.isArray(value.nodes) || value.nodes.length === 0 || !value.nodes.every(validNodeShape)) return false;
  return !cycleOrUnknown(value.nodes);
}

export function verificationDagDigestV2(graph: VerificationDagV2): string {
  return digest(graph);
}

export function verificationNodeDigestV2(node: VerificationDagNodeV2): string {
  return digest(node);
}

function finalizePlan(value: Omit<VerificationImpactPlanV2, "planDigest">): VerificationImpactPlanV2 {
  return { ...value, planDigest: digest(value) };
}

function sortedUnique(values: readonly string[]): string[] {
  return [...new Set(values)].sort((left, right) => left.localeCompare(right, "en"));
}

function fallbackPlan(args: {
  readonly graph: unknown;
  readonly baseSha: string;
  readonly headSha: string;
  readonly changedPaths: readonly string[];
  readonly reasons: readonly VerificationFallbackReasonV2[];
}): VerificationImpactPlanV2 {
  const nodes = isRecord(args.graph) && Array.isArray(args.graph.nodes)
    ? args.graph.nodes.filter(validNodeShape) : [];
  const hardGates = isRecord(args.graph) && uniqueStrings(args.graph.hardGates)
    ? args.graph.hardGates : [...DEFAULT_VERIFICATION_HARD_GATES_V2];
  return finalizePlan({
    schemaVersion: VERIFICATION_IMPACT_PLAN_SCHEMA_V2,
    mode: "FULL_FALLBACK",
    baseSha: isCommit(args.baseSha) ? args.baseSha : "0".repeat(40),
    headSha: isCommit(args.headSha) ? args.headSha : "0".repeat(40),
    graphDigest: digest(args.graph),
    changedPaths: sortedUnique(args.changedPaths.filter((path): path is string => typeof path === "string")),
    selectedNodes: sortedUnique(nodes.map((node) => node.id)),
    selectedTests: sortedUnique(nodes.flatMap((node) => [...node.ownedTests])),
    hardGates: sortedUnique(hardGates),
    reasons: sortedUnique(args.reasons) as VerificationFallbackReasonV2[],
    authoritativeComparator: "npm test",
  });
}

export function buildVerificationImpactPlanV2(args: {
  readonly graph: unknown;
  readonly graphPath: string;
  readonly baseSha: string;
  readonly headSha: string;
  readonly changedPaths: readonly string[];
  readonly observedInputDigests: Readonly<Record<string, string>>;
}): VerificationImpactPlanV2 {
  const unsafe = args.changedPaths.some((path) => !isSafeRepositoryPathV2(path));
  if (unsafe) return fallbackPlan({ ...args, reasons: ["UNSAFE_PATH"] });
  if (!validateVerificationDagV2(args.graph) || !isCommit(args.baseSha) || !isCommit(args.headSha)
    || !isSafeRepositoryPathV2(args.graphPath)) {
    return fallbackPlan({ ...args, reasons: ["INVALID_GRAPH"] });
  }
  const graph = args.graph;
  const changedPaths = sortedUnique(args.changedPaths);
  if (changedPaths.includes(args.graphPath)) return fallbackPlan({ ...args, reasons: ["GRAPH_CHANGED"] });

  const inputs = graph.nodes.flatMap((node) => node.inputs.map((input) => ({ node, input })));
  if (inputs.some(({ input }) => args.observedInputDigests[input.path] !== input.sha256)) {
    return fallbackPlan({ ...args, reasons: ["GRAPH_DRIFT"] });
  }

  const selected = new Set<string>();
  for (const path of changedPaths) {
    const owners = inputs.filter(({ input }) => input.path === path);
    if (owners.length === 0) return fallbackPlan({ ...args, reasons: ["UNMAPPED_PATH"] });
    if (owners.length > 1) return fallbackPlan({ ...args, reasons: ["AMBIGUOUS_OWNERSHIP"] });
    const owner = owners[0];
    if (!owner) return fallbackPlan({ ...args, reasons: ["CLASSIFIER_FAILURE"] });
    if (owner.node.globalInvalidation || ["TOOLCHAIN", "ENVIRONMENT", "SECURITY"].includes(owner.input.role)) {
      return fallbackPlan({ ...args, reasons: ["CENTRAL_INPUT_CHANGED"] });
    }
    selected.add(owner.node.id);
  }

  let expanded = true;
  while (expanded) {
    expanded = false;
    for (const node of graph.nodes) {
      if (!selected.has(node.id) && node.dependsOn.some((dependency) => selected.has(dependency))) {
        selected.add(node.id);
        expanded = true;
      }
    }
  }
  const selectedNodes = graph.nodes.filter((node) => selected.has(node.id));
  return finalizePlan({
    schemaVersion: VERIFICATION_IMPACT_PLAN_SCHEMA_V2,
    mode: "IMPACTED_SHADOW",
    baseSha: args.baseSha,
    headSha: args.headSha,
    graphDigest: verificationDagDigestV2(graph),
    changedPaths,
    selectedNodes: sortedUnique(selectedNodes.map((node) => node.id)),
    selectedTests: sortedUnique(selectedNodes.flatMap((node) => [...node.ownedTests])),
    hardGates: sortedUnique(graph.hardGates),
    reasons: [],
    authoritativeComparator: "npm test",
  });
}

export function buildVerificationImpactPlanFailClosedV2(
  args: Parameters<typeof buildVerificationImpactPlanV2>[0],
  classifier: (input: Parameters<typeof buildVerificationImpactPlanV2>[0]) => VerificationImpactPlanV2 = buildVerificationImpactPlanV2,
): VerificationImpactPlanV2 {
  try {
    return classifier(args);
  } catch {
    return fallbackPlan({ ...args, reasons: ["CLASSIFIER_FAILURE"] });
  }
}

function validAttestation(value: unknown): value is VerificationAttestationV2 {
  if (!exactKeys(value, [
    "schemaVersion", "nodeId", "nodeDigest", "graphDigest", "toolchainDigest", "environmentDigest",
    "createdAtMs", "testResults", "attestationDigest",
  ], ["expiresAtMs"]) || value.schemaVersion !== VERIFICATION_ATTESTATION_SCHEMA_V2
    || !isIdentifier(value.nodeId) || !isDigest(value.nodeDigest) || !isDigest(value.graphDigest)
    || !isDigest(value.toolchainDigest) || !isDigest(value.environmentDigest)
    || !Number.isSafeInteger(value.createdAtMs) || (value.createdAtMs as number) < 0
    || (Object.hasOwn(value, "expiresAtMs") && (!Number.isSafeInteger(value.expiresAtMs) || (value.expiresAtMs as number) < 0))
    || !Array.isArray(value.testResults) || value.testResults.length === 0 || !isDigest(value.attestationDigest)) return false;
  return value.testResults.every((result) => exactKeys(result, ["test", "outcome"])
    && isNonEmptyString(result.test) && result.outcome === "PASS")
    && new Set(value.testResults.map((result) => result.test)).size === value.testResults.length;
}

export function verificationAttestationDigestV2(value: Omit<VerificationAttestationV2, "attestationDigest">): string {
  return digest(value);
}

export function verifyPrototypeAttestationV2(args: {
  readonly attestation: unknown;
  readonly node: VerificationDagNodeV2;
  readonly graphDigest: string;
  readonly toolchainDigest: string;
  readonly environmentDigest: string;
  readonly nowMs: number;
}): { readonly outcome: "REUSABLE_PROTOTYPE"; readonly authoritative: false }
  | { readonly outcome: "DENIED"; readonly authoritative: false; readonly reasons: readonly VerificationAttestationDenialV2[] } {
  if (args.attestation === null || args.attestation === undefined) {
    return { outcome: "DENIED", authoritative: false, reasons: ["ATTESTATION_MISSING_DENIED"] };
  }
  if (!validAttestation(args.attestation)) {
    return { outcome: "DENIED", authoritative: false, reasons: ["ATTESTATION_SCHEMA_DENIED"] };
  }
  const attestation = args.attestation;
  const { attestationDigest: ignored, ...unsigned } = attestation;
  if (ignored !== digest(unsigned)) {
    return { outcome: "DENIED", authoritative: false, reasons: ["ATTESTATION_TAMPERED_DENIED"] };
  }
  if (attestation.expiresAtMs !== undefined && args.nowMs > attestation.expiresAtMs) {
    return { outcome: "DENIED", authoritative: false, reasons: ["ATTESTATION_STALE_DENIED"] };
  }
  const expectedExpiry = args.node.evidenceTtlMs === undefined
    ? undefined : attestation.createdAtMs + args.node.evidenceTtlMs;
  const exactTests = sortedUnique(attestation.testResults.map(({ test }) => test));
  if (attestation.nodeId !== args.node.id || attestation.nodeDigest !== verificationNodeDigestV2(args.node)
    || attestation.graphDigest !== args.graphDigest || attestation.toolchainDigest !== args.toolchainDigest
    || attestation.environmentDigest !== args.environmentDigest || attestation.expiresAtMs !== expectedExpiry
    || canonicalJson(exactTests) !== canonicalJson(sortedUnique(args.node.ownedTests))) {
    return { outcome: "DENIED", authoritative: false, reasons: ["ATTESTATION_MISMATCH_DENIED"] };
  }
  return { outcome: "REUSABLE_PROTOTYPE", authoritative: false };
}

export async function runVerificationShadowComparatorV2(
  plan: VerificationImpactPlanV2,
  executeFullSuite: () => Promise<number>,
): Promise<VerificationShadowReportV2> {
  let exitCode = 1;
  try {
    exitCode = await executeFullSuite();
  } catch {
    exitCode = 1;
  }
  return {
    schemaVersion: VERIFICATION_SHADOW_REPORT_SCHEMA_V2,
    status: exitCode === 0 ? "SHADOW_PASS" : "SHADOW_FAIL",
    activation: "BLOCKED_SAMPLE_GATE",
    plan,
    comparator: { command: "npm test", authoritative: true, executed: true, exitCode },
  };
}
