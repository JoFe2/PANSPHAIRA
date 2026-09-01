import { createHash } from "node:crypto";
import { types } from "node:util";

export const SCHEMA_VERSION = "chimpmaera.cks/readonly-kaleidosphere-bridge/v1";
export const COMPONENT_VERSIONS = Object.freeze({ projectionContract: "chimpmaera.cks/kaleidosphere-projection/v1", kaleidoSphere: "v0.8.0/2.0.0", bridge: "cks-12-readonly-bridge@v1" });
export const DENIAL_CODES = Object.freeze(["MISSING_INPUT", "VERSION_LOCK_MISMATCH", "DRY_RUN_REQUIRED", "RAW_PROJECTION_DENIED", "INVENTED_EDGE_DENIED", "KALEIDOSPHERE_MUTATION_DENIED", "AUTHORITY_EXPANSION_DENIED"] as const);
type DenialCode = typeof DENIAL_CODES[number]; type RecordValue = Record<string, unknown>;
const TOP_LEVEL_ENVELOPE_KEYS_V1: readonly string[] = Object.freeze(["authorityRequested", "canonicalEvidenceAfterSha256", "canonicalEvidenceBeforeSha256", "capabilityRequested", "componentVersions", "dryRun", "operation", "projection", "promotionRequested", "schemaVersion"]);
export type Candidate = { status: "CANDIDATE_RECORDED"; candidateId: string; candidateKind: "KALEIDOSPHERE_CANDIDATE"; projectionSha256: string; canonicalEvidenceSha256: string; inventedEdgeCount: 0; promotion: "NOT_AUTHORIZED"; authority: "NONE"; capabilityDelta: "NONE"; effect: "NONE"; executionClaimed: false; productionClaimed: false };
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
const record = (value: unknown): value is RecordValue => value !== null && typeof value === "object" && !Array.isArray(value) && Object.getPrototypeOf(value) === Object.prototype;
const snapshotTopLevelEnvelopeV1 = (value: unknown): Readonly<RecordValue> | undefined => {
  try {
    if (value === null || typeof value !== "object" || types.isProxy(value) || Array.isArray(value) || Object.getPrototypeOf(value) !== Object.prototype) return undefined;
    const keys = Reflect.ownKeys(value);
    if (keys.length !== TOP_LEVEL_ENVELOPE_KEYS_V1.length || keys.some((key) => typeof key !== "string" || !TOP_LEVEL_ENVELOPE_KEYS_V1.includes(key))) return undefined;
    const snapshot: RecordValue = {};
    for (const key of TOP_LEVEL_ENVELOPE_KEYS_V1) {
      const descriptor = Object.getOwnPropertyDescriptor(value, key);
      if (!descriptor || !descriptor.enumerable || !("value" in descriptor)) return undefined;
      snapshot[key] = descriptor.value;
    }
    return Object.freeze(snapshot);
  } catch {
    return undefined;
  }
};
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

function inspectReadOnlyMinimizedProjection(input: unknown): Candidate | Denied {
  const inputData = snapshotTopLevelEnvelopeV1(input);
  if (!inputData) return deny(["MISSING_INPUT"], ["bridge input must be an object"]);
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
