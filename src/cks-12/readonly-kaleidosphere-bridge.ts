import { createHash } from "node:crypto";
import { types } from "node:util";

export const SCHEMA_VERSION = "chimpmaera.cks/readonly-kaleidosphere-bridge/v1";
export const COMPONENT_VERSIONS = Object.freeze({ projectionContract: "chimpmaera.cks/kaleidosphere-projection/v1", kaleidoSphere: "v0.8.0/2.0.0", bridge: "cks-12-readonly-bridge@v1" });
export const SCHEMA_VERSION_V2 = "chimpmaera.cks/readonly-kaleidosphere-bridge/v2";
export const PROJECTION_SCHEMA_VERSION_V2 = "chimpmaera.cks/kaleidosphere-projection/v2";
export const EDGE_EVIDENCE_AUTHORITY_VERSION_V2 = "pansphaira.fnd-ps-02/edge-evidence-authority/v2";
export const COMPONENT_VERSIONS_V2 = Object.freeze({ projectionContract: PROJECTION_SCHEMA_VERSION_V2, edgeEvidenceAuthority: EDGE_EVIDENCE_AUTHORITY_VERSION_V2, kaleidoSphere: "v0.8.0/2.0.0", bridge: "cks-12-readonly-bridge@v2" });
export const DENIAL_CODES = Object.freeze(["MISSING_INPUT", "VERSION_LOCK_MISMATCH", "DRY_RUN_REQUIRED", "RAW_PROJECTION_DENIED", "INVENTED_EDGE_DENIED", "EDGE_EVIDENCE_AUTHORITY_DENIED", "KALEIDOSPHERE_MUTATION_DENIED", "AUTHORITY_EXPANSION_DENIED"] as const);
type DenialCode = typeof DENIAL_CODES[number]; type RecordValue = Record<string, unknown>;
const TOP_LEVEL_ENVELOPE_KEYS_V1: readonly string[] = Object.freeze(["authorityRequested", "canonicalEvidenceAfterSha256", "canonicalEvidenceBeforeSha256", "capabilityRequested", "componentVersions", "dryRun", "operation", "projection", "promotionRequested", "schemaVersion"]);
const TOP_LEVEL_ENVELOPE_KEYS_V2: readonly string[] = Object.freeze(["authorityRequested", "canonicalEvidenceAfterSha256", "canonicalEvidenceBeforeSha256", "capabilityRequested", "componentVersions", "dryRun", "edgeEvidenceAuthorityVersion", "operation", "projection", "promotionRequested", "schemaVersion"]);
export type Candidate = { status: "CANDIDATE_RECORDED"; candidateId: string; candidateKind: "KALEIDOSPHERE_CANDIDATE"; projectionSha256: string; canonicalEvidenceSha256: string; inventedEdgeCount: 0; promotion: "NOT_AUTHORIZED"; authority: "NONE"; capabilityDelta: "NONE"; effect: "NONE"; executionClaimed: false; productionClaimed: false };
export type EdgeEvidenceReferenceV2 = Readonly<{ evidenceId: string; evidenceVersion: string; evidenceSha256: string }>;
export type CanonicalKnowledgeBindingV2 = Readonly<{ knowledgeId: string; knowledgeVersion: string; knowledgeSha256: string }>;
export type EdgeEvidenceBindingBodyV2 = Readonly<{ bindingVersion: typeof EDGE_EVIDENCE_AUTHORITY_VERSION_V2; capabilityId: string; canonicalKnowledge: CanonicalKnowledgeBindingV2; edgeId: string; evidence: readonly EdgeEvidenceReferenceV2[]; from: string; relation: string; relationTruthClaimed: false; to: string }>;
export type EvidenceBoundEdgeV2 = EdgeEvidenceBindingBodyV2 & Readonly<{ evidenceBindingSha256: string }>;
export type ReturnedEvidenceBoundEdgeV2 = EvidenceBoundEdgeV2 & Readonly<{ authority: "NONE"; effect: "NONE"; relationTruth: "NOT_GRANTED" }>;
export type CandidateV2 = Candidate & Readonly<{ canonicalKnowledgeMutation: "NONE"; edgeEvidenceAuthoritySha256: string; edgeEvidenceAuthorityVersion: typeof EDGE_EVIDENCE_AUTHORITY_VERSION_V2; edges: readonly ReturnedEvidenceBoundEdgeV2[]; nonclaims: readonly string[]; relationTruth: "NOT_GRANTED" }>;
export type EdgeEvidenceEnvelopeV2 = Readonly<{ authorityRequested: false; canonicalEvidenceAfterSha256: string; canonicalEvidenceBeforeSha256: string; capabilityRequested: false; componentVersions: typeof COMPONENT_VERSIONS_V2; dryRun: true; edgeEvidenceAuthorityVersion: typeof EDGE_EVIDENCE_AUTHORITY_VERSION_V2; operation: "READ_ONLY_MINIMIZED_PROJECTION"; projection: Readonly<{ schemaVersion: typeof PROJECTION_SCHEMA_VERSION_V2; nodes: readonly Readonly<{ id: string; kind: string }>[]; edges: readonly EvidenceBoundEdgeV2[]; projectionId: string }>; promotionRequested: false; schemaVersion: typeof SCHEMA_VERSION_V2 }>;
export type Denied = { status: "DENIED"; reasonCodes: readonly DenialCode[]; details: readonly string[] };
export const FND_PS_FU_01_DELIVERY_POLICY = Object.freeze({
  schemaVersion: "pansphaira.fnd-ps-fu-01/delivery-candidate-policy/v1",
  taskId: "CAMPAIGN-V1-FND-PS-FU-01-DELIVERY-01",
  baseHead: "b41337348f3b379870c3006a9647ecdfdc29f6f7",
  scope: Object.freeze([
    "SHA256SUMS",
    "docs/architecture/cks-12-top-level-envelope-policy-v1.md",
    "package.json",
    "release/public-files.manifest",
    "scripts/build-public-release.sh",
    "src/cks-12/readonly-kaleidosphere-bridge.ts",
    "tests/canonical-json-profile-inventory.test.ts",
    "tests/cks-12/readonly-kaleidosphere-bridge.test.ts",
    "tests/release-governance.test.mjs",
    "tests/verification-fabric-v2.test.ts",
    "verification/canonical-json-profile-inventory-v1.json",
    "verification/verification-dag-v2.json",
  ]),
  gateInputs: Object.freeze([
    Object.freeze({ gateId: "FOCUSED_POSITIVE_NEGATIVE", gateInput: "npm run fnd-ps-fu-01:test" }),
    Object.freeze({ gateId: "LINT", gateInput: "npm run lint" }),
    Object.freeze({ gateId: "RELEASE_GOVERNANCE_TEST", gateInput: "npm run release-governance:test" }),
    Object.freeze({ gateId: "RELEASE_GOVERNANCE_VERIFY", gateInput: "npm run release-governance:verify" }),
    Object.freeze({ gateId: "SUPPLY_CHAIN_VERIFY", gateInput: "npm run supply-chain:verify" }),
    Object.freeze({ gateId: "CHECKSUMS", gateInput: "sha256sum -c SHA256SUMS" }),
    Object.freeze({ gateId: "VERIFICATION_PLAN", gateInput: "npm run verification:plan" }),
    Object.freeze({ gateId: "PUBLIC_RELEASE_BUILD", gateInput: "./scripts/build-public-release.sh --output <isolated-absolute-path>" }),
    Object.freeze({ gateId: "DIFF_CHECK", gateInput: "git diff --check origin/main...HEAD" }),
  ]),
  integrityReceiptPaths: Object.freeze(["SHA256SUMS", "release/public-files.manifest", "verification/verification-dag-v2.json"]),
  issueAcceptance: Object.freeze([
    Object.freeze({ criterionId: "AC-TOP-LEVEL-PROXY-FAIL-CLOSED", evidenceId: "TEST-TOP-LEVEL-THROWING-PROXY-DENIAL" }),
    Object.freeze({ criterionId: "AC-TOP-LEVEL-ACCESSOR-NONINVOCATION", evidenceId: "TEST-TOP-LEVEL-ACCESSOR-ZERO-INVOCATIONS" }),
    Object.freeze({ criterionId: "AC-EXACT-ENVELOPE-ADJUDICATION", evidenceId: "TEST-HIDDEN-SYMBOL-AND-UNKNOWN-FIELDS-DENIED" }),
    Object.freeze({ criterionId: "AC-PLAIN-JSON-COMPATIBILITY", evidenceId: "TEST-CANONICAL-CANDIDATE-AND-RECEIPT-BYTES" }),
    Object.freeze({ criterionId: "AC-CANARY-3-SEPARATION", evidenceId: "POLICY-CANARY-3-AUTHORITY-SEPARATION" }),
  ]),
  authorityExpectation: Object.freeze({
    mutable: false,
    independentReviewCount: 1,
    independentReviewOwner: "ROOT_QS_SOL_FINAL_OWNER",
    workerExternalEffect: "NONE",
    deferredActions: Object.freeze(["INDEPENDENT_REVIEW", "FINAL_FULL_SUITE", "PR", "CI", "MERGE", "RELEASE", "ANONYMOUS_READBACK", "ISSUE_CLOSURE"]),
  }),
});
export type FndPsFu01DeliveryReadinessReasonCode = "GATE_INPUT_DRIFT" | "INTEGRITY_RECEIPT_INVALID" | "INVALID_CANDIDATE" | "MISSING_GATE" | "MUTABLE_AUTHORITY_EXPECTATION" | "SCOPE_DRIFT" | "STALE_HEAD" | "UNRESOLVED_CRITERION";
export type FndPsFu01DeliveryReadiness =
  | { status: "READY_FOR_ONE_INDEPENDENT_ISSUE_REVIEW"; taskId: typeof FND_PS_FU_01_DELIVERY_POLICY.taskId; candidateHead: string; candidateTree: string; independentReviewCount: 1; independentReviewOwner: "ROOT_QS_SOL_FINAL_OWNER"; authority: "NONE"; effect: "NONE"; fullPublicClosureClaimed: false }
  | { status: "NOT_READY"; reasonCodes: readonly FndPsFu01DeliveryReadinessReasonCode[] };
export function canonicalJson(value: unknown): string { if (value === null || typeof value === "boolean" || typeof value === "string") return JSON.stringify(value); if (typeof value === "number") { if (!Number.isFinite(value)) throw new TypeError("non-finite"); return JSON.stringify(value); } if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`; if (typeof value !== "object" || Object.getPrototypeOf(value) !== Object.prototype) throw new TypeError("plain JSON required"); const object = value as RecordValue; return `{${Object.keys(object).sort().map((key) => `${JSON.stringify(key)}:${canonicalJson(object[key])}`).join(",")}}`; }
export const digest = (value: unknown): string => createHash("sha256").update(canonicalJson(value)).digest("hex");

const V2_CAPABILITY_ID = "CKS-12_SYNTHETIC_KNOWLEDGE_DECISION_LINEAGE";
const V2_PROJECTION_ID = "CKS-12-MIN-EDGE-EVIDENCE-001";
const V2_NONCLAIMS = Object.freeze([
  "NO_RELATION_TRUTH_FROM_ENDPOINTS",
  "NO_CANONICAL_KNOWLEDGE_MUTATION",
  "NO_PROMOTION",
  "NO_AUTHORITY",
  "NO_EFFECT",
  "NO_PRODUCTION_OR_CUSTOMER_DATA_CLAIM",
] as const);

/**
 * The v2 oracle is owned by PANSPHAIRA source, not supplied by the caller.
 * Its two synthetic receipt locks jointly establish qualification and lineage;
 * neither node identifiers nor a caller-generated digest can replace them.
 */
export const PANSPHAIRA_EDGE_EVIDENCE_INPUTS_V2 = Object.freeze({
  schemaVersion: "pansphaira.fnd-ps-02/owner-edge-evidence-inputs/v2",
  owner: "PANSPHAIRA",
  dataClass: "PUBLIC_SYNTHETIC_NON_CUSTOMER",
  capabilityId: V2_CAPABILITY_ID,
  canonicalKnowledge: Object.freeze({
    knowledgeId: "CKS-12-KNOWLEDGE-001",
    knowledgeVersion: "v1",
    knowledgeSha256: "d756437db8c991ee78ea7a9fcc7a9d4749daf8eebda51d5ba31fcc53e1b1242a",
  }),
  relation: Object.freeze({
    edgeId: "CKS-12-EDGE-KNOWLEDGE-001-DECISION-001",
    from: "knowledge-001",
    to: "decision-001",
    relation: "KNOWLEDGE_USED_BY_DECISION",
  }),
  evidence: Object.freeze([
    Object.freeze({
      evidenceId: "CKS-12-VALIDATION-RECEIPT-001",
      evidenceVersion: "v1",
      evidenceRole: "KNOWLEDGE_QUALIFICATION",
      sourceReceiptSha256: "38cba2f03660d759751518940c8eb0cf658ad411a7e12bba92337b5be5491aae",
      immutable: true,
    }),
    Object.freeze({
      evidenceId: "CKS-12-LINEAGE-RECEIPT-001",
      evidenceVersion: "v1",
      evidenceRole: "RELATION_ASSERTION",
      sourceReceiptSha256: "ef7dff41f22d574799242457705b10ef9c965f4f0374ef3d84fe134d38639d57",
      immutable: true,
    }),
  ]),
});

export const FND_PS_02_EDGE_EVIDENCE_CONTRACT_V2 = Object.freeze({
  schemaVersion: SCHEMA_VERSION_V2,
  projectionSchemaVersion: PROJECTION_SCHEMA_VERSION_V2,
  edgeEvidenceAuthorityVersion: EDGE_EVIDENCE_AUTHORITY_VERSION_V2,
  capabilityId: V2_CAPABILITY_ID,
  projectionId: V2_PROJECTION_ID,
  ownerEvidenceInputsSha256: digest(PANSPHAIRA_EDGE_EVIDENCE_INPUTS_V2),
  envelopeKeys: TOP_LEVEL_ENVELOPE_KEYS_V2,
  projectionKeys: Object.freeze(["schemaVersion", "nodes", "edges", "projectionId"] as const),
  nodeKeys: Object.freeze(["id", "kind"] as const),
  edgeKeys: Object.freeze(["bindingVersion", "capabilityId", "canonicalKnowledge", "edgeId", "evidence", "evidenceBindingSha256", "from", "relation", "relationTruthClaimed", "to"] as const),
  evidenceKeys: Object.freeze(["evidenceId", "evidenceVersion", "evidenceSha256"] as const),
  canonicalKnowledgeKeys: Object.freeze(["knowledgeId", "knowledgeVersion", "knowledgeSha256"] as const),
  nonclaims: V2_NONCLAIMS,
});

const freezeInternal = <T>(value: T): T => {
  if (Array.isArray(value)) {
    for (const entry of value) freezeInternal(entry);
    return Object.freeze(value);
  }
  if (value !== null && typeof value === "object") {
    for (const entry of Object.values(value as RecordValue)) freezeInternal(entry);
    return Object.freeze(value);
  }
  return value;
};

const expectedEdgeBindingBodyV2 = (): EdgeEvidenceBindingBodyV2 => freezeInternal({
  bindingVersion: EDGE_EVIDENCE_AUTHORITY_VERSION_V2,
  capabilityId: PANSPHAIRA_EDGE_EVIDENCE_INPUTS_V2.capabilityId,
  canonicalKnowledge: { ...PANSPHAIRA_EDGE_EVIDENCE_INPUTS_V2.canonicalKnowledge },
  edgeId: PANSPHAIRA_EDGE_EVIDENCE_INPUTS_V2.relation.edgeId,
  evidence: PANSPHAIRA_EDGE_EVIDENCE_INPUTS_V2.evidence.map((ownerInput) => ({
    evidenceId: ownerInput.evidenceId,
    evidenceVersion: ownerInput.evidenceVersion,
    evidenceSha256: digest(ownerInput),
  })),
  from: PANSPHAIRA_EDGE_EVIDENCE_INPUTS_V2.relation.from,
  relation: PANSPHAIRA_EDGE_EVIDENCE_INPUTS_V2.relation.relation,
  relationTruthClaimed: false,
  to: PANSPHAIRA_EDGE_EVIDENCE_INPUTS_V2.relation.to,
});

const expectedEvidenceBoundEdgeV2 = (): EvidenceBoundEdgeV2 => {
  const body = expectedEdgeBindingBodyV2();
  return freezeInternal({ ...body, evidenceBindingSha256: digest(body) });
};

/** Returns a fresh, deeply frozen, synthetic-only exact-v2 input. */
export function createFndPs02EdgeEvidenceEnvelopeV2(): EdgeEvidenceEnvelopeV2 {
  const owner = PANSPHAIRA_EDGE_EVIDENCE_INPUTS_V2;
  return freezeInternal({
    authorityRequested: false,
    canonicalEvidenceAfterSha256: owner.canonicalKnowledge.knowledgeSha256,
    canonicalEvidenceBeforeSha256: owner.canonicalKnowledge.knowledgeSha256,
    capabilityRequested: false,
    componentVersions: { ...COMPONENT_VERSIONS_V2 },
    dryRun: true,
    edgeEvidenceAuthorityVersion: EDGE_EVIDENCE_AUTHORITY_VERSION_V2,
    operation: "READ_ONLY_MINIMIZED_PROJECTION",
    projection: {
      schemaVersion: PROJECTION_SCHEMA_VERSION_V2,
      nodes: [
        { id: owner.relation.from, kind: "KNOWLEDGE" },
        { id: owner.relation.to, kind: "DECISION" },
      ],
      edges: [expectedEvidenceBoundEdgeV2()],
      projectionId: V2_PROJECTION_ID,
    },
    promotionRequested: false,
    schemaVersion: SCHEMA_VERSION_V2,
  });
}

const record = (value: unknown): value is RecordValue => value !== null && typeof value === "object" && !Array.isArray(value) && Object.getPrototypeOf(value) === Object.prototype;
const snapshotTopLevelEnvelope = (value: unknown, allowedKeys: readonly string[]): Readonly<RecordValue> | undefined => {
  try {
    if (value === null || typeof value !== "object" || types.isProxy(value) || Array.isArray(value) || Object.getPrototypeOf(value) !== Object.prototype) return undefined;
    const keys = Reflect.ownKeys(value);
    if (keys.length !== allowedKeys.length || keys.some((key) => typeof key !== "string" || !allowedKeys.includes(key))) return undefined;
    const snapshot: RecordValue = {};
    for (const key of allowedKeys) {
      const descriptor = Object.getOwnPropertyDescriptor(value, key);
      if (!descriptor || !descriptor.enumerable || !("value" in descriptor)) return undefined;
      snapshot[key] = descriptor.value;
    }
    return Object.freeze(snapshot);
  } catch {
    return undefined;
  }
};
const snapshotTopLevelEnvelopeV1 = (value: unknown): Readonly<RecordValue> | undefined => snapshotTopLevelEnvelope(value, TOP_LEVEL_ENVELOPE_KEYS_V1);
const snapshotTopLevelEnvelopeV2 = (value: unknown): Readonly<RecordValue> | undefined => snapshotTopLevelEnvelope(value, TOP_LEVEL_ENVELOPE_KEYS_V2);
const ownDataRecord = (value: unknown, allowedKeys: readonly string[]): RecordValue | undefined => {
  try {
    if (!record(value)) return undefined;
    const keys = Reflect.ownKeys(value);
    if (keys.length !== allowedKeys.length || keys.some((key) => typeof key !== "string" || !allowedKeys.includes(key))) return undefined;
    const inspected: RecordValue = {};
    for (const key of allowedKeys) {
      const descriptor = Object.getOwnPropertyDescriptor(value, key);
      if (!descriptor || !descriptor.enumerable || !("value" in descriptor)) return undefined;
      inspected[key] = Reflect.get(value, key);
    }
    return inspected;
  } catch {
    return undefined;
  }
};
const deny = (reasonCodes: DenialCode[], details: string[]): Denied => {
  const detailsByCode = new Map<DenialCode, Set<string>>();
  reasonCodes.forEach((code, index) => {
    const grouped = detailsByCode.get(code) ?? new Set<string>();
    grouped.add(details[index]!);
    detailsByCode.set(code, grouped);
  });
  const sortedCodes = [...detailsByCode.keys()].sort();
  return { status: "DENIED", reasonCodes: sortedCodes, details: sortedCodes.map((code) => [...detailsByCode.get(code)!].sort().join("; ")) };
};

const exactV2DataObject = (value: unknown, allowedKeys: readonly string[]): RecordValue | undefined => {
  try {
    if (value === null || typeof value !== "object" || types.isProxy(value) || Array.isArray(value) || Object.getPrototypeOf(value) !== Object.prototype) return undefined;
    const keys = Reflect.ownKeys(value);
    if (keys.length !== allowedKeys.length || keys.some((key) => typeof key !== "string" || !allowedKeys.includes(key))) return undefined;
    const snapshot: RecordValue = {};
    for (const key of allowedKeys) {
      const descriptor = Object.getOwnPropertyDescriptor(value, key);
      if (!descriptor || !descriptor.enumerable || !("value" in descriptor)) return undefined;
      snapshot[key] = descriptor.value;
    }
    return snapshot;
  } catch {
    return undefined;
  }
};

const exactV2ArrayValues = (value: unknown): readonly unknown[] | undefined => {
  try {
    if (types.isProxy(value) || !Array.isArray(value) || Object.getPrototypeOf(value) !== Array.prototype) return undefined;
    const lengthDescriptor = Object.getOwnPropertyDescriptor(value, "length");
    if (!lengthDescriptor || lengthDescriptor.enumerable || !("value" in lengthDescriptor) || !Number.isSafeInteger(lengthDescriptor.value) || lengthDescriptor.value < 0) return undefined;
    const length = lengthDescriptor.value as number;
    const keys = Reflect.ownKeys(value);
    if (keys.length !== length + 1 || keys.some((key) => key !== "length" && (typeof key !== "string" || !/^(0|[1-9][0-9]*)$/.test(key) || Number(key) >= length))) return undefined;
    const snapshot: unknown[] = [];
    for (let index = 0; index < length; index += 1) {
      const descriptor = Object.getOwnPropertyDescriptor(value, String(index));
      if (!descriptor || !descriptor.enumerable || !("value" in descriptor)) return undefined;
      snapshot.push(descriptor.value);
    }
    return snapshot;
  } catch {
    return undefined;
  }
};

const inspectEvidenceReferenceV2 = (value: unknown): EdgeEvidenceReferenceV2 | undefined => {
  const data = exactV2DataObject(value, FND_PS_02_EDGE_EVIDENCE_CONTRACT_V2.evidenceKeys);
  if (!data || typeof data.evidenceId !== "string" || data.evidenceId.length === 0 || typeof data.evidenceVersion !== "string" || data.evidenceVersion.length === 0 || typeof data.evidenceSha256 !== "string" || !/^[0-9a-f]{64}$/.test(data.evidenceSha256)) return undefined;
  return { evidenceId: data.evidenceId, evidenceVersion: data.evidenceVersion, evidenceSha256: data.evidenceSha256 };
};

const inspectCanonicalKnowledgeBindingV2 = (value: unknown): CanonicalKnowledgeBindingV2 | undefined => {
  const data = exactV2DataObject(value, FND_PS_02_EDGE_EVIDENCE_CONTRACT_V2.canonicalKnowledgeKeys);
  if (!data || typeof data.knowledgeId !== "string" || data.knowledgeId.length === 0 || typeof data.knowledgeVersion !== "string" || data.knowledgeVersion.length === 0 || typeof data.knowledgeSha256 !== "string" || !/^[0-9a-f]{64}$/.test(data.knowledgeSha256)) return undefined;
  return { knowledgeId: data.knowledgeId, knowledgeVersion: data.knowledgeVersion, knowledgeSha256: data.knowledgeSha256 };
};

const inspectEvidenceBoundEdgeV2 = (value: unknown): EvidenceBoundEdgeV2 | undefined => {
  const data = exactV2DataObject(value, FND_PS_02_EDGE_EVIDENCE_CONTRACT_V2.edgeKeys);
  if (!data || data.bindingVersion !== EDGE_EVIDENCE_AUTHORITY_VERSION_V2 || typeof data.capabilityId !== "string" || data.capabilityId.length === 0 || typeof data.edgeId !== "string" || data.edgeId.length === 0 || typeof data.from !== "string" || data.from.length === 0 || typeof data.relation !== "string" || data.relation.length === 0 || data.relationTruthClaimed !== false || typeof data.to !== "string" || data.to.length === 0 || typeof data.evidenceBindingSha256 !== "string" || !/^[0-9a-f]{64}$/.test(data.evidenceBindingSha256)) return undefined;
  const canonicalKnowledge = inspectCanonicalKnowledgeBindingV2(data.canonicalKnowledge);
  const evidenceValues = exactV2ArrayValues(data.evidence);
  if (!canonicalKnowledge || !evidenceValues) return undefined;
  const evidence: EdgeEvidenceReferenceV2[] = [];
  for (const entry of evidenceValues) {
    const inspected = inspectEvidenceReferenceV2(entry);
    if (!inspected) return undefined;
    evidence.push(inspected);
  }
  return {
    bindingVersion: EDGE_EVIDENCE_AUTHORITY_VERSION_V2,
    capabilityId: data.capabilityId,
    canonicalKnowledge,
    edgeId: data.edgeId,
    evidence,
    evidenceBindingSha256: data.evidenceBindingSha256,
    from: data.from,
    relation: data.relation,
    relationTruthClaimed: false,
    to: data.to,
  };
};

type ProjectionSnapshotV2 = Readonly<{ schemaVersion: string; nodes: readonly Readonly<{ id: string; kind: string }>[]; edges: readonly EvidenceBoundEdgeV2[]; projectionId: string }>;

function inspectReadOnlyMinimizedProjectionV1(inputData: Readonly<RecordValue>): Candidate | Denied {
  const reasons: DenialCode[] = []; const details: string[] = []; const add = (code: DenialCode, detail: string) => { reasons.push(code); details.push(detail); };
  if (inputData.schemaVersion !== SCHEMA_VERSION) add("VERSION_LOCK_MISMATCH", "bridge envelope schema mismatch");
  if (!record(inputData.componentVersions) || canonicalJson(inputData.componentVersions) !== canonicalJson(COMPONENT_VERSIONS)) add("VERSION_LOCK_MISMATCH", "component lock mismatch");
  if (inputData.dryRun !== true) add("DRY_RUN_REQUIRED", "only dry-run invocation is permitted");
  if (inputData.operation !== "READ_ONLY_MINIMIZED_PROJECTION") add("KALEIDOSPHERE_MUTATION_DENIED", "only the read-only minimized operation is permitted");
  const projection = inputData.projection;
  const projectionData = ownDataRecord(projection, ["schemaVersion", "nodes", "edges", "projectionId"]);
  const projectionShapeValid = projectionData !== undefined && projectionData.schemaVersion === "chimpmaera.cks/kaleidosphere-projection/v1" && typeof projectionData.projectionId === "string" && Array.isArray(projectionData.nodes) && Array.isArray(projectionData.edges);
  if (!projectionShapeValid) add("RAW_PROJECTION_DENIED", "projection must contain only minimized schema fields");
  if (projectionShapeValid) {
    const nodes = projectionData.nodes as unknown[];
    const inspectedNodes = nodes.map((node) => ownDataRecord(node, ["id", "kind"]));
    const nodesShapeValid = inspectedNodes.every((node) => node !== undefined && typeof node.id === "string" && typeof node.kind === "string");
    if (!nodesShapeValid) add("RAW_PROJECTION_DENIED", "projection nodes may contain only identifiers and kinds");
    if (nodesShapeValid) {
      const nodeIds = new Set(inspectedNodes.map((node) => node!.id));
      const nodeIdsUnique = nodeIds.size === nodes.length;
      if (!nodeIdsUnique) add("RAW_PROJECTION_DENIED", "projection node identifiers must be unique");
      if (nodeIdsUnique && (projectionData.edges as unknown[]).some((edge) => {
        const inspectedEdge = ownDataRecord(edge, ["from", "to"]);
        return inspectedEdge === undefined || typeof inspectedEdge.from !== "string" || typeof inspectedEdge.to !== "string" || !nodeIds.has(inspectedEdge.from) || !nodeIds.has(inspectedEdge.to);
      })) add("INVENTED_EDGE_DENIED", "every minimized edge endpoint must be reconstructible from projected nodes");
    }
  }
  if (typeof inputData.canonicalEvidenceBeforeSha256 !== "string" || !/^[0-9a-f]{64}$/.test(inputData.canonicalEvidenceBeforeSha256) || inputData.canonicalEvidenceAfterSha256 !== inputData.canonicalEvidenceBeforeSha256) add("KALEIDOSPHERE_MUTATION_DENIED", "canonical PanSphaira evidence must be digest-identical before and after analysis");
  if (inputData.authorityRequested !== false || inputData.capabilityRequested !== false || inputData.promotionRequested !== false) add("AUTHORITY_EXPANSION_DENIED", "candidate delivery cannot expand authority, capability, or promotion");
  if (reasons.length) return deny(reasons, details);
  const acceptedProjection = projection as RecordValue;
  return { status: "CANDIDATE_RECORDED", candidateId: `KS-CANDIDATE-${projectionData!.projectionId as string}`, candidateKind: "KALEIDOSPHERE_CANDIDATE", projectionSha256: digest(acceptedProjection), canonicalEvidenceSha256: inputData.canonicalEvidenceBeforeSha256 as string, inventedEdgeCount: 0, promotion: "NOT_AUTHORIZED", authority: "NONE", capabilityDelta: "NONE", effect: "NONE", executionClaimed: false, productionClaimed: false };
}

function inspectReadOnlyMinimizedProjectionV2(inputData: Readonly<RecordValue>): Candidate | Denied {
  const reasons: DenialCode[] = [];
  const details: string[] = [];
  const add = (code: DenialCode, detail: string): void => { reasons.push(code); details.push(detail); };

  if (inputData.schemaVersion !== SCHEMA_VERSION_V2 || inputData.edgeEvidenceAuthorityVersion !== EDGE_EVIDENCE_AUTHORITY_VERSION_V2) add("VERSION_LOCK_MISMATCH", "v2 bridge and edge-evidence authority versions must match");
  const componentData = exactV2DataObject(inputData.componentVersions, ["projectionContract", "edgeEvidenceAuthority", "kaleidoSphere", "bridge"]);
  if (!componentData || canonicalJson(componentData) !== canonicalJson(COMPONENT_VERSIONS_V2)) add("VERSION_LOCK_MISMATCH", "v2 component lock mismatch");
  if (inputData.dryRun !== true) add("DRY_RUN_REQUIRED", "only dry-run invocation is permitted");
  if (inputData.operation !== "READ_ONLY_MINIMIZED_PROJECTION") add("KALEIDOSPHERE_MUTATION_DENIED", "only the read-only minimized operation is permitted");

  const projectionData = exactV2DataObject(inputData.projection, FND_PS_02_EDGE_EVIDENCE_CONTRACT_V2.projectionKeys);
  let projectionSnapshot: ProjectionSnapshotV2 | undefined;
  if (!projectionData || typeof projectionData.schemaVersion !== "string" || typeof projectionData.projectionId !== "string") {
    add("RAW_PROJECTION_DENIED", "v2 projection must be an exact own-data minimized projection");
  } else {
    if (projectionData.schemaVersion !== PROJECTION_SCHEMA_VERSION_V2) add("VERSION_LOCK_MISMATCH", "v2 projection schema mismatch");
    if (projectionData.projectionId !== V2_PROJECTION_ID) add("RAW_PROJECTION_DENIED", "v2 projection must match the frozen capability-specific scope");

    const nodeValues = exactV2ArrayValues(projectionData.nodes);
    const nodes: Array<Readonly<{ id: string; kind: string }>> = [];
    let nodesValid = nodeValues !== undefined;
    for (const value of nodeValues ?? []) {
      const node = exactV2DataObject(value, FND_PS_02_EDGE_EVIDENCE_CONTRACT_V2.nodeKeys);
      if (!node || typeof node.id !== "string" || node.id.length === 0 || typeof node.kind !== "string" || node.kind.length === 0) { nodesValid = false; continue; }
      nodes.push({ id: node.id, kind: node.kind });
    }
    if (!nodesValid) add("RAW_PROJECTION_DENIED", "v2 projection nodes must be exact own-data identifiers and kinds");

    const edgeValues = exactV2ArrayValues(projectionData.edges);
    const edges: EvidenceBoundEdgeV2[] = [];
    let edgesValid = edgeValues !== undefined;
    for (const value of edgeValues ?? []) {
      const edge = inspectEvidenceBoundEdgeV2(value);
      if (!edge) { edgesValid = false; continue; }
      edges.push(edge);
    }
    if (!edgesValid) add("EDGE_EVIDENCE_AUTHORITY_DENIED", "v2 edges and evidence must be exact own-data values");

    if (nodesValid && edgesValid) {
      projectionSnapshot = { schemaVersion: projectionData.schemaVersion, nodes, edges, projectionId: projectionData.projectionId };
      const owner = PANSPHAIRA_EDGE_EVIDENCE_INPUTS_V2;
      const expectedNodes = [{ id: owner.relation.from, kind: "KNOWLEDGE" }, { id: owner.relation.to, kind: "DECISION" }];
      if (canonicalJson(nodes) !== canonicalJson(expectedNodes)) add("RAW_PROJECTION_DENIED", "v2 projection nodes must match the frozen capability-specific subjects");
      const nodeIds = new Set(nodes.map(({ id }) => id));
      if (edges.some(({ from, to }) => !nodeIds.has(from) || !nodeIds.has(to))) add("INVENTED_EDGE_DENIED", "every v2 edge endpoint must be reconstructible from projected nodes");

      const expectedBody = expectedEdgeBindingBodyV2();
      if (edges.length !== 1) {
        add("EDGE_EVIDENCE_AUTHORITY_DENIED", "v2 projection must contain the complete frozen edge denominator");
      } else {
        const edge = edges[0]!;
        const { evidenceBindingSha256, ...suppliedBody } = edge;
        if (digest(suppliedBody) !== evidenceBindingSha256) add("EDGE_EVIDENCE_AUTHORITY_DENIED", "v2 edge self-binding digest mismatch");
        if (canonicalJson(suppliedBody) !== canonicalJson(expectedBody)) add("EDGE_EVIDENCE_AUTHORITY_DENIED", "v2 edge is not derivable from immutable PANSPHAIRA-owned evidence");
      }
    }
  }

  const ownerKnowledgeSha256 = PANSPHAIRA_EDGE_EVIDENCE_INPUTS_V2.canonicalKnowledge.knowledgeSha256;
  if (inputData.canonicalEvidenceBeforeSha256 !== ownerKnowledgeSha256 || inputData.canonicalEvidenceAfterSha256 !== ownerKnowledgeSha256) add("KALEIDOSPHERE_MUTATION_DENIED", "canonical PANSPHAIRA Knowledge must remain owner-bound and digest-identical");
  if (inputData.authorityRequested !== false || inputData.capabilityRequested !== false || inputData.promotionRequested !== false) add("AUTHORITY_EXPANSION_DENIED", "candidate delivery cannot expand authority, capability, or promotion");
  if (reasons.length) return deny(reasons, details);

  const acceptedProjection = projectionSnapshot!;
  const returnedEdges: ReturnedEvidenceBoundEdgeV2[] = acceptedProjection.edges.map((edge) => ({
    ...edge,
    canonicalKnowledge: { ...edge.canonicalKnowledge },
    evidence: edge.evidence.map((entry) => ({ ...entry })),
    authority: "NONE",
    effect: "NONE",
    relationTruth: "NOT_GRANTED",
  }));
  const candidate: CandidateV2 = {
    status: "CANDIDATE_RECORDED",
    candidateId: `KS-CANDIDATE-${acceptedProjection.projectionId}`,
    candidateKind: "KALEIDOSPHERE_CANDIDATE",
    projectionSha256: digest(acceptedProjection),
    canonicalEvidenceSha256: ownerKnowledgeSha256,
    edgeEvidenceAuthoritySha256: FND_PS_02_EDGE_EVIDENCE_CONTRACT_V2.ownerEvidenceInputsSha256,
    edgeEvidenceAuthorityVersion: EDGE_EVIDENCE_AUTHORITY_VERSION_V2,
    edges: returnedEdges,
    inventedEdgeCount: 0,
    canonicalKnowledgeMutation: "NONE",
    relationTruth: "NOT_GRANTED",
    promotion: "NOT_AUTHORIZED",
    authority: "NONE",
    capabilityDelta: "NONE",
    effect: "NONE",
    executionClaimed: false,
    productionClaimed: false,
    nonclaims: [...V2_NONCLAIMS],
  };
  return freezeInternal(candidate);
}

function inspectReadOnlyMinimizedProjection(input: unknown): Candidate | Denied {
  const v1 = snapshotTopLevelEnvelopeV1(input);
  if (v1) return inspectReadOnlyMinimizedProjectionV1(v1);
  const v2 = snapshotTopLevelEnvelopeV2(input);
  if (v2) return inspectReadOnlyMinimizedProjectionV2(v2);
  return deny(["MISSING_INPUT"], ["bridge input must be an object"]);
}

export function runReadOnlyMinimizedProjection(input: EdgeEvidenceEnvelopeV2): CandidateV2 | Denied;
export function runReadOnlyMinimizedProjection(input: unknown): Candidate | Denied;
export function runReadOnlyMinimizedProjection(input: unknown): Candidate | Denied {
  try {
    return inspectReadOnlyMinimizedProjection(input);
  } catch {
    return deny(["MISSING_INPUT"], ["bridge input must be an object"]);
  }
}
const exactDataObject = (value: unknown, allowedKeys: readonly string[]): RecordValue | undefined => {
  try {
    if (value === null || typeof value !== "object" || types.isProxy(value) || Array.isArray(value) || Object.getPrototypeOf(value) !== Object.prototype) return undefined;
    const keys = Reflect.ownKeys(value);
    if (keys.length !== allowedKeys.length || keys.some((key) => typeof key !== "string" || !allowedKeys.includes(key))) return undefined;
    const inspected: RecordValue = {};
    for (const key of allowedKeys) {
      const descriptor = Object.getOwnPropertyDescriptor(value, key);
      if (!descriptor || !descriptor.enumerable || !("value" in descriptor)) return undefined;
      inspected[key] = descriptor.value;
    }
    return inspected;
  } catch {
    return undefined;
  }
};
const exactArrayValues = (value: unknown): readonly unknown[] | undefined => {
  try {
    if (!Array.isArray(value) || types.isProxy(value)) return undefined;
    const keys = Reflect.ownKeys(value);
    if (keys.length !== value.length + 1 || keys.some((key) => key !== "length" && (typeof key !== "string" || !/^(0|[1-9][0-9]*)$/.test(key) || Number(key) >= value.length))) return undefined;
    const values: unknown[] = [];
    for (let index = 0; index < value.length; index += 1) {
      const descriptor = Object.getOwnPropertyDescriptor(value, String(index));
      if (!descriptor || !descriptor.enumerable || !("value" in descriptor)) return undefined;
      values.push(descriptor.value);
    }
    const length = Object.getOwnPropertyDescriptor(value, "length");
    if (!length || length.enumerable || !("value" in length) || length.value !== value.length) return undefined;
    return values;
  } catch {
    return undefined;
  }
};
const exactStringSequence = (value: unknown, expected: readonly string[]): boolean => {
  const values = exactArrayValues(value);
  return values !== undefined && values.length === expected.length && values.every((entry, index) => entry === expected[index]);
};
export function evaluateFndPsFu01DeliveryReadiness(input: unknown): FndPsFu01DeliveryReadiness {
  const reasons = new Set<FndPsFu01DeliveryReadinessReasonCode>();
  const add = (reason: FndPsFu01DeliveryReadinessReasonCode): void => { reasons.add(reason); };
  const data = exactDataObject(input, ["authorityExpectation", "baseHead", "candidateHead", "candidateTree", "changedPaths", "gateReceipts", "integrityReceipts", "issueAcceptance", "observedHead", "observedTree", "schemaVersion", "taskId"]);
  if (!data) return { status: "NOT_READY", reasonCodes: ["INVALID_CANDIDATE"] };
  if (data.schemaVersion !== FND_PS_FU_01_DELIVERY_POLICY.schemaVersion || data.taskId !== FND_PS_FU_01_DELIVERY_POLICY.taskId) add("INVALID_CANDIDATE");
  if (data.baseHead !== FND_PS_FU_01_DELIVERY_POLICY.baseHead || !exactStringSequence(data.changedPaths, FND_PS_FU_01_DELIVERY_POLICY.scope)) add("SCOPE_DRIFT");
  const candidateHead = typeof data.candidateHead === "string" ? data.candidateHead : "";
  const candidateTree = typeof data.candidateTree === "string" ? data.candidateTree : "";
  if (!/^[0-9a-f]{40}$/.test(candidateHead) || !/^[0-9a-f]{40}$/.test(candidateTree) || candidateHead === data.baseHead) add("INVALID_CANDIDATE");
  if (data.observedHead !== candidateHead || data.observedTree !== candidateTree) add("STALE_HEAD");

  const gateValues = exactArrayValues(data.gateReceipts);
  const seenGates = new Set<string>();
  if (!gateValues) add("GATE_INPUT_DRIFT");
  for (const value of gateValues ?? []) {
    const gate = exactDataObject(value, ["candidateHead", "candidateTree", "gateId", "gateInput", "outputSha256", "status"]);
    if (!gate || typeof gate.gateId !== "string" || seenGates.has(gate.gateId)) { add("GATE_INPUT_DRIFT"); continue; }
    seenGates.add(gate.gateId);
    const expected = FND_PS_FU_01_DELIVERY_POLICY.gateInputs.find(({ gateId }) => gateId === gate.gateId);
    if (!expected || gate.gateInput !== expected.gateInput || gate.status !== "PASS" || typeof gate.outputSha256 !== "string" || !/^[0-9a-f]{64}$/.test(gate.outputSha256)) add("GATE_INPUT_DRIFT");
    if (gate.candidateHead !== candidateHead || gate.candidateTree !== candidateTree) add("STALE_HEAD");
  }
  for (const { gateId } of FND_PS_FU_01_DELIVERY_POLICY.gateInputs) if (!seenGates.has(gateId)) add("MISSING_GATE");

  const integrityValues = exactArrayValues(data.integrityReceipts);
  const seenIntegrity = new Set<string>();
  if (!integrityValues) add("INTEGRITY_RECEIPT_INVALID");
  for (const value of integrityValues ?? []) {
    const receipt = exactDataObject(value, ["candidateHead", "candidateTree", "path", "sha256", "status"]);
    if (!receipt || typeof receipt.path !== "string" || seenIntegrity.has(receipt.path)) { add("INTEGRITY_RECEIPT_INVALID"); continue; }
    seenIntegrity.add(receipt.path);
    if (!FND_PS_FU_01_DELIVERY_POLICY.integrityReceiptPaths.some((path) => path === receipt.path) || receipt.status !== "VERIFIED" || typeof receipt.sha256 !== "string" || !/^[0-9a-f]{64}$/.test(receipt.sha256)) add("INTEGRITY_RECEIPT_INVALID");
    if (receipt.candidateHead !== candidateHead || receipt.candidateTree !== candidateTree) add("STALE_HEAD");
  }
  for (const path of FND_PS_FU_01_DELIVERY_POLICY.integrityReceiptPaths) if (!seenIntegrity.has(path)) add("INTEGRITY_RECEIPT_INVALID");

  const acceptanceValues = exactArrayValues(data.issueAcceptance);
  const seenCriteria = new Set<string>();
  if (!acceptanceValues) add("UNRESOLVED_CRITERION");
  for (const value of acceptanceValues ?? []) {
    const criterion = exactDataObject(value, ["criterionId", "evidenceId", "status"]);
    if (!criterion || typeof criterion.criterionId !== "string" || seenCriteria.has(criterion.criterionId)) { add("UNRESOLVED_CRITERION"); continue; }
    seenCriteria.add(criterion.criterionId);
    const expected = FND_PS_FU_01_DELIVERY_POLICY.issueAcceptance.find(({ criterionId }) => criterionId === criterion.criterionId);
    if (!expected || criterion.evidenceId !== expected.evidenceId || criterion.status !== "PASS") add("UNRESOLVED_CRITERION");
  }
  for (const { criterionId } of FND_PS_FU_01_DELIVERY_POLICY.issueAcceptance) if (!seenCriteria.has(criterionId)) add("UNRESOLVED_CRITERION");

  const authoritySource = data.authorityExpectation;
  const authority = exactDataObject(authoritySource, ["deferredActions", "independentReviewCount", "independentReviewOwner", "mutable", "workerExternalEffect"]);
  const deferredActions = authority?.deferredActions;
  if (!authority || authoritySource === null || typeof authoritySource !== "object" || !Object.isFrozen(authoritySource) || !Array.isArray(deferredActions) || types.isProxy(deferredActions) || !Object.isFrozen(deferredActions) || authority.mutable !== false || authority.independentReviewCount !== 1 || authority.independentReviewOwner !== "ROOT_QS_SOL_FINAL_OWNER" || authority.workerExternalEffect !== "NONE" || !exactStringSequence(deferredActions, FND_PS_FU_01_DELIVERY_POLICY.authorityExpectation.deferredActions)) add("MUTABLE_AUTHORITY_EXPECTATION");

  if (reasons.size) return { status: "NOT_READY", reasonCodes: [...reasons].sort() };
  return { status: "READY_FOR_ONE_INDEPENDENT_ISSUE_REVIEW", taskId: FND_PS_FU_01_DELIVERY_POLICY.taskId, candidateHead, candidateTree, independentReviewCount: 1, independentReviewOwner: "ROOT_QS_SOL_FINAL_OWNER", authority: "NONE", effect: "NONE", fullPublicClosureClaimed: false };
}
export function createReceipt(fixtureSha256: string, candidate: Candidate): RecordValue { const body = { schemaVersion: "chimpmaera.cks/readonly-candidate-receipt/v1", receiptId: "CKS-12-READONLY-CANDIDATE-RECEIPT-V1", fixtureSha256, componentVersions: COMPONENT_VERSIONS, candidate, status: "RECORDED" }; return { ...body, receiptSha256: digest(body) }; }
