import { createHash } from "node:crypto";

export const SCHEMA_VERSION = "chimpmaera.cks/readonly-kaleidosphere-bridge/v1";
export const COMPONENT_VERSIONS = Object.freeze({ projectionContract: "chimpmaera.cks/kaleidosphere-projection/v1", kaleidoSphere: "v0.8.0/2.0.0", bridge: "cks-12-readonly-bridge@v1" });
export const DENIAL_CODES = Object.freeze(["MISSING_INPUT", "VERSION_LOCK_MISMATCH", "DRY_RUN_REQUIRED", "RAW_PROJECTION_DENIED", "INVENTED_EDGE_DENIED", "KALEIDOSPHERE_MUTATION_DENIED", "AUTHORITY_EXPANSION_DENIED"] as const);
type DenialCode = typeof DENIAL_CODES[number]; type RecordValue = Record<string, unknown>;
export type Candidate = { status: "CANDIDATE_RECORDED"; candidateId: string; candidateKind: "KALEIDOSPHERE_CANDIDATE"; projectionSha256: string; canonicalEvidenceSha256: string; inventedEdgeCount: 0; promotion: "NOT_AUTHORIZED"; authority: "NONE"; capabilityDelta: "NONE"; effect: "NONE"; executionClaimed: false; productionClaimed: false };
export type Denied = { status: "DENIED"; reasonCodes: readonly DenialCode[]; details: readonly string[] };
export function canonicalJson(value: unknown): string { if (value === null || typeof value === "boolean" || typeof value === "string") return JSON.stringify(value); if (typeof value === "number") { if (!Number.isFinite(value)) throw new TypeError("non-finite"); return JSON.stringify(value); } if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`; if (typeof value !== "object" || Object.getPrototypeOf(value) !== Object.prototype) throw new TypeError("plain JSON required"); const object = value as RecordValue; return `{${Object.keys(object).sort().map((key) => `${JSON.stringify(key)}:${canonicalJson(object[key])}`).join(",")}}`; }
export const digest = (value: unknown): string => createHash("sha256").update(canonicalJson(value)).digest("hex");
const record = (value: unknown): value is RecordValue => value !== null && typeof value === "object" && !Array.isArray(value) && Object.getPrototypeOf(value) === Object.prototype;
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
  if (!record(input)) return deny(["MISSING_INPUT"], ["bridge input must be an object"]);
  const reasons: DenialCode[] = []; const details: string[] = []; const add = (code: DenialCode, detail: string) => { reasons.push(code); details.push(detail); };
  if (!record(input.componentVersions) || canonicalJson(input.componentVersions) !== canonicalJson(COMPONENT_VERSIONS)) add("VERSION_LOCK_MISMATCH", "component lock mismatch");
  if (input.dryRun !== true) add("DRY_RUN_REQUIRED", "only dry-run invocation is permitted");
  if (input.operation !== "READ_ONLY_MINIMIZED_PROJECTION") add("KALEIDOSPHERE_MUTATION_DENIED", "only the read-only minimized operation is permitted");
  const projection = input.projection;
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
  if (typeof input.canonicalEvidenceBeforeSha256 !== "string" || !/^[0-9a-f]{64}$/.test(input.canonicalEvidenceBeforeSha256) || input.canonicalEvidenceAfterSha256 !== input.canonicalEvidenceBeforeSha256) add("KALEIDOSPHERE_MUTATION_DENIED", "canonical PanSphaira evidence must be digest-identical before and after analysis");
  if (input.authorityRequested === true || input.capabilityRequested === true || input.promotionRequested === true) add("AUTHORITY_EXPANSION_DENIED", "candidate delivery cannot expand authority, capability, or promotion");
  if (reasons.length) return deny(reasons, details);
  const acceptedProjection = projection as RecordValue;
  return { status: "CANDIDATE_RECORDED", candidateId: `KS-CANDIDATE-${projectionData!.projectionId as string}`, candidateKind: "KALEIDOSPHERE_CANDIDATE", projectionSha256: digest(acceptedProjection), canonicalEvidenceSha256: input.canonicalEvidenceBeforeSha256 as string, inventedEdgeCount: 0, promotion: "NOT_AUTHORIZED", authority: "NONE", capabilityDelta: "NONE", effect: "NONE", executionClaimed: false, productionClaimed: false };
}
export function runReadOnlyMinimizedProjection(input: unknown): Candidate | Denied {
  try {
    return inspectReadOnlyMinimizedProjection(input);
  } catch {
    return deny(["MISSING_INPUT"], ["bridge input must be an object"]);
  }
}
export function createReceipt(fixtureSha256: string, candidate: Candidate): RecordValue { const body = { schemaVersion: "chimpmaera.cks/readonly-candidate-receipt/v1", receiptId: "CKS-12-READONLY-CANDIDATE-RECEIPT-V1", fixtureSha256, componentVersions: COMPONENT_VERSIONS, candidate, status: "RECORDED" }; return { ...body, receiptSha256: digest(body) }; }
