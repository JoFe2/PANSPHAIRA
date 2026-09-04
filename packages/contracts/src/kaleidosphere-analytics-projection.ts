import { createHash } from "node:crypto";
import { types } from "node:util";

import { canonicalJson } from "./canonical-json.js";

/** Sentinel for a non-plain-JSON / unsafe value collapsed by `deepPlain`. */
const INVALID = Symbol("kaleidosphere-analytics-invalid-plain-json");

const HEX64 = /^[a-f0-9]{64}$/;

/**
 * XRA-PS-01 — version-one purpose-bound PANSPHAIRA analytics projection facade.
 *
 * This maps the selected, existing CKS proof inputs (the frozen PanSphaira
 * owner edge-evidence inputs already pinned by CKS-12) to ONE purpose-bound
 * nodes/edges projection. It is a read-only, synthetic, non-authority projection:
 *
 *   - every node and edge carries source evidence, coverage, unknown,
 *     and counterevidence fields, and
 *   - authority, promotion, and effect remain NONE / not authorized, and
 *     an edge is established only by its frozen source receipts, never by
 *     endpoint presence alone.
 *
 * It does NOT rewrite any historical CKS-10/CKS-12 fixture, does NOT invent
 * external evidence, does NOT introduce a generic projection framework, and
 * does NOT mutate canonical Knowledge. Verification is fail-closed: malformed,
 * duplicate, stale, overbroad, and unsupported inputs return a structured
 * denial (never an exception, never a partial mutation, never an ordinary
 * success). The serial integrator owns final Canon/integrity regeneration.
 */

export const KALEIDOSPHERE_ANALYTICS_PROJECTION_SCHEMA_V1 = "chimpmaera.cks/kaleidosphere-analytics-projection/v1" as const;

export const KALEIDOSPHERE_ANALYTICS_PROJECTION_VERSION_V1 = "1.0.0" as const;

export const KALEIDOSPHERE_ANALYTICS_PROJECTION_ID = "pansphaira:cks-xra-ps-01-kaleidosphere-analytics-001" as const;

export const KALEIDOSPHERE_ANALYTICS_PROJECTION_PURPOSE = "PANSPHAIRA_EDGE_EVIDENCE_ANALYTICS" as const;

/**
 * The selected existing CKS proof inputs. These values are the frozen CKS-12
 * PanSphaira owner edge-evidence inputs (FND-PS-02), reproduced here verbatim
 * so the source binding can be proven identical to the historical CKS-12
 * oracle rather than invented. `SOURCE_CONTRACT_SHA256` is their digest.
 */
const SOURCE_CONTRACT = "pansphaira.fnd-ps-02/owner-edge-evidence-inputs/v2" as const;
const SOURCE_CONTRACT_VERSION = "v2" as const;
const OWNER = "PanSphaira" as const;
const OWNER_DATA_CLASS = "PUBLIC_SYNTHETIC_NON_CUSTOMER" as const;
const CAPABILITY_ID = "CKS-12_SYNTHETIC_KNOWLEDGE_DECISION_LINEAGE" as const;
const CANONICAL_KNOWLEDGE = Object.freeze({
  knowledgeId: "CKS-12-KNOWLEDGE-001",
  knowledgeVersion: "v1",
  knowledgeSha256: "d756437db8c991ee78ea7a9fcc7a9d4749daf8eebda51d5ba31fcc53e1b1242a",
}) as const;
const RELATION = Object.freeze({
  edgeId: "CKS-12-EDGE-KNOWLEDGE-001-DECISION-001",
  from: "knowledge-001",
  to: "decision-001",
  relation: "KNOWLEDGE_USED_BY_DECISION",
}) as const;
const EXPECTED_EVIDENCE = Object.freeze([
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
]) as const;
/** A faithful structural reproduction of the CKS-12 owner edge-evidence inputs. */
const OWNER_INPUTS = Object.freeze({
  schemaVersion: SOURCE_CONTRACT,
  owner: OWNER,
  dataClass: OWNER_DATA_CLASS,
  capabilityId: CAPABILITY_ID,
  canonicalKnowledge: CANONICAL_KNOWLEDGE,
  relation: RELATION,
  evidence: EXPECTED_EVIDENCE,
});
/** Digest of the selected existing CKS proof inputs (matches CKS-12 ownerEvidenceInputsSha256). */
export const SOURCE_CONTRACT_SHA256 = digest(OWNER_INPUTS);

const FROZEN_SUBJECTS = Object.freeze([
  Object.freeze({ id: "knowledge-001", kind: "KNOWLEDGE", reference: "canonicalKnowledge" } as const),
  Object.freeze({ id: "decision-001", kind: "DECISION", reference: "relation" } as const),
]) as const;

const NONCLAIMS = Object.freeze([
  "NO_RELATION_TRUTH_FROM_ENDPOINTS",
  "NO_AUTHORITY",
  "NO_PROMOTION",
  "NO_EFFECT",
  "NO_CANONICAL_KNOWLEDGE_MUTATION",
  "NO_PRODUCTION_OR_CUSTOMER_DATA_CLAIM",
]) as readonly string[];

export interface KaleidosphereAnalyticsSourceEvidenceV1 {
  readonly contract: string;
  readonly contractSha256: string;
  readonly reference: string;
}

export interface KaleidosphereAnalyticsNodeV1 {
  readonly id: string;
  readonly kind: "KNOWLEDGE" | "DECISION";
  readonly sourceEvidence: KaleidosphereAnalyticsSourceEvidenceV1;
  readonly coverage: "FULL";
  readonly unknown: false;
  readonly counterevidence: readonly string[];
  readonly authority: "NONE";
}

export interface KaleidosphereAnalyticsEvidenceEntryV1 {
  readonly evidenceId: string;
  readonly evidenceVersion: string;
  readonly evidenceRole: string;
  readonly evidenceSha256: string;
}

export interface KaleidosphereAnalyticsEdgeV1 {
  readonly from: string;
  readonly to: string;
  readonly relation: string;
  readonly sourceEvidence: KaleidosphereAnalyticsSourceEvidenceV1;
  readonly evidence: readonly KaleidosphereAnalyticsEvidenceEntryV1[];
  readonly evidenceSha256: string;
  readonly coverage: "FULL";
  readonly unknown: false;
  readonly counterevidence: readonly string[];
  readonly authority: "NONE";
  readonly promotion: "NOT_AUTHORIZED";
  readonly effect: "NONE";
  readonly relationTruthClaimed: false;
  readonly relationTruth: "NOT_GRANTED";
}

export interface KaleidosphereAnalyticsProjectionSourceV1 {
  readonly contract: string;
  readonly contractVersion: string;
  readonly contractSha256: string;
}

export interface KaleidosphereAnalyticsProjectionV1 {
  readonly schemaVersion: typeof KALEIDOSPHERE_ANALYTICS_PROJECTION_SCHEMA_V1;
  readonly projectionId: string;
  readonly contractVersion: typeof KALEIDOSPHERE_ANALYTICS_PROJECTION_VERSION_V1;
  readonly purpose: typeof KALEIDOSPHERE_ANALYTICS_PROJECTION_PURPOSE;
  readonly source: KaleidosphereAnalyticsProjectionSourceV1;
  readonly nodes: readonly KaleidosphereAnalyticsNodeV1[];
  readonly edges: readonly KaleidosphereAnalyticsEdgeV1[];
  readonly authority: "NONE";
  readonly promotion: "NOT_AUTHORIZED";
  readonly effect: "NONE";
  readonly relationTruth: "NOT_GRANTED";
  readonly nonclaims: readonly string[];
  readonly projectionDigest: string;
}

export type KaleidosphereAnalyticsProjectionReasonCodeV1 =
  | "KALEIDOSPHERE_ANALYTICS_PROJECTION_VERIFIED"
  | "KALEIDOSPHERE_ANALYTICS_PROJECTION_SCHEMA_DENIED"
  | "KALEIDOSPHERE_ANALYTICS_PROJECTION_DUPLICATE_DENIED"
  | "KALEIDOSPHERE_ANALYTICS_PROJECTION_STALE_DENIED"
  | "KALEIDOSPHERE_ANALYTICS_PROJECTION_OVERBROAD_DENIED"
  | "KALEIDOSPHERE_ANALYTICS_PROJECTION_UNSUPPORTED_DENIED"
  | "KALEIDOSPHERE_ANALYTICS_PROJECTION_AUTHORITY_DENIED"
  | "KALEIDOSPHERE_ANALYTICS_PROJECTION_DIGEST_DENIED";

export type KaleidosphereAnalyticsProjectionVerificationV1 =
  | {
    readonly outcome: "VERIFIED";
    readonly reasonCodes: readonly ["KALEIDOSPHERE_ANALYTICS_PROJECTION_VERIFIED"];
    readonly projectionDigest: string;
    readonly nodeCount: 2;
    readonly edgeCount: 1;
    readonly authority: "NONE";
  }
  | { readonly outcome: "DENIED"; readonly reasonCodes: readonly KaleidosphereAnalyticsProjectionReasonCodeV1[] };

/**
 * Produce a deep, plain-JSON snapshot of `value` or return `INVALID`. This is
 * the fail-closed guard: Proxies (including throwing ones), non-plain
 * prototypes, accessors, cycles, `undefined` values, and non-finite numbers all
 * collapse to `INVALID` without invoking any trap, so verification never throws
 * and never observes a caller-controlled side channel.
 */
function deepPlain(value: unknown, seen: Set<unknown>): unknown {
  if (value === null) return null;
  if (typeof value === "string" || typeof value === "boolean") return value;
  if (typeof value === "number") return Number.isFinite(value) ? value : INVALID;
  if (typeof value !== "object") return INVALID;
  try {
    if (types.isProxy(value)) return INVALID;
    if (seen.has(value)) return INVALID;
    seen.add(value);
    if (Array.isArray(value)) {
      const entries: unknown[] = [];
      for (const item of value) {
        const child = deepPlain(item, seen);
        if (child === INVALID) return INVALID;
        entries.push(child);
      }
      return entries;
    }
    if (Object.getPrototypeOf(value) !== Object.prototype) return INVALID;
    const record = value as Record<string, unknown>;
    const out: Record<string, unknown> = {};
    for (const key of Object.keys(record)) {
      const property = Object.getOwnPropertyDescriptor(record, key);
      if (property === undefined || property.get !== undefined || property.set !== undefined) return INVALID;
      const child = deepPlain(record[key], seen);
      if (child === INVALID) return INVALID;
      out[key] = child;
    }
    return out;
  } catch {
    return INVALID;
  }
}

function plainJson(value: unknown): unknown {
  return deepPlain(value, new Set());
}

function digest(value: unknown): string {
  const plain = plainJson(value);
  if (plain === INVALID) throw new TypeError("KALEIDOSPHERE_ANALYTICS_INVALID");
  return createHash("sha256").update(canonicalJson(plain), "utf8").digest("hex");
}

function freeze<T>(value: T): T {
  if (Array.isArray(value)) {
    for (const entry of value) freeze(entry);
    Object.freeze(value);
    return value;
  }
  if (value !== null && typeof value === "object") {
    for (const entry of Object.values(value as Record<string, unknown>)) freeze(entry);
    Object.freeze(value);
    return value;
  }
  return value;
}

function asExactRecord(value: unknown, keys: readonly string[]): Record<string, unknown> | null {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;
  if (canonicalJson(Object.keys(record).sort()) !== canonicalJson([...keys].sort())) return null;
  return record;
}

function asArray(value: unknown): unknown[] | null {
  return Array.isArray(value) ? value : null;
}

const TOP_KEYS = [
  "schemaVersion", "projectionId", "contractVersion", "purpose", "source", "nodes", "edges",
  "authority", "promotion", "effect", "relationTruth", "nonclaims", "projectionDigest",
] as const;
const SOURCE_KEYS = ["contract", "contractVersion", "contractSha256"] as const;
const SOURCE_EVIDENCE_KEYS = ["contract", "contractSha256", "reference"] as const;
const NODE_KEYS = ["id", "kind", "sourceEvidence", "coverage", "unknown", "counterevidence", "authority"] as const;
const EDGE_KEYS = [
  "from", "to", "relation", "sourceEvidence", "evidence", "evidenceSha256", "coverage", "unknown",
  "counterevidence", "authority", "promotion", "effect", "relationTruthClaimed", "relationTruth",
] as const;
const EVIDENCE_KEYS = ["evidenceId", "evidenceVersion", "evidenceRole", "evidenceSha256"] as const;

type DefectCode = Exclude<KaleidosphereAnalyticsProjectionReasonCodeV1, "KALEIDOSPHERE_ANALYTICS_PROJECTION_VERIFIED">;

const CODE = {
  SCHEMA: "KALEIDOSPHERE_ANALYTICS_PROJECTION_SCHEMA_DENIED",
  DUPLICATE: "KALEIDOSPHERE_ANALYTICS_PROJECTION_DUPLICATE_DENIED",
  STALE: "KALEIDOSPHERE_ANALYTICS_PROJECTION_STALE_DENIED",
  OVERBROAD: "KALEIDOSPHERE_ANALYTICS_PROJECTION_OVERBROAD_DENIED",
  UNSUPPORTED: "KALEIDOSPHERE_ANALYTICS_PROJECTION_UNSUPPORTED_DENIED",
  AUTHORITY: "KALEIDOSPHERE_ANALYTICS_PROJECTION_AUTHORITY_DENIED",
  DIGEST: "KALEIDOSPHERE_ANALYTICS_PROJECTION_DIGEST_DENIED",
} as const satisfies Record<string, DefectCode>;

function deny(defects: Map<DefectCode, Set<string>>): KaleidosphereAnalyticsProjectionVerificationV1 {
  return { outcome: "DENIED", reasonCodes: [...defects.keys()].sort() as KaleidosphereAnalyticsProjectionReasonCodeV1[] };
}

/**
 * Build the frozen, deeply-frozen, purpose-bound analytics projection from the
 * selected existing CKS proof inputs. Pure: it neither reads nor writes any
 * historical fixture and does not accept caller input.
 */
export function buildKaleidosphereAnalyticsProjectionV1(): KaleidosphereAnalyticsProjectionV1 {
  const source: KaleidosphereAnalyticsProjectionSourceV1 = {
    contract: SOURCE_CONTRACT,
    contractVersion: SOURCE_CONTRACT_VERSION,
    contractSha256: SOURCE_CONTRACT_SHA256,
  };
  const nodeSourceEvidence = (reference: string): KaleidosphereAnalyticsSourceEvidenceV1 => ({
    contract: SOURCE_CONTRACT,
    contractSha256: SOURCE_CONTRACT_SHA256,
    reference,
  });
  const nodes: KaleidosphereAnalyticsNodeV1[] = FROZEN_SUBJECTS.map((subject) => ({
    id: subject.id,
    kind: subject.kind,
    sourceEvidence: nodeSourceEvidence(subject.reference),
    coverage: "FULL",
    unknown: false,
    counterevidence: [],
    authority: "NONE",
  }));
  const evidence: KaleidosphereAnalyticsEvidenceEntryV1[] = EXPECTED_EVIDENCE.map((receipt) => ({
    evidenceId: receipt.evidenceId,
    evidenceVersion: receipt.evidenceVersion,
    evidenceRole: receipt.evidenceRole,
    evidenceSha256: digest(receipt),
  }));
  const edge: KaleidosphereAnalyticsEdgeV1 = {
    from: RELATION.from,
    to: RELATION.to,
    relation: RELATION.relation,
    sourceEvidence: nodeSourceEvidence("edge"),
    evidence,
    evidenceSha256: digest(evidence),
    coverage: "FULL",
    unknown: false,
    counterevidence: [],
    authority: "NONE",
    promotion: "NOT_AUTHORIZED",
    effect: "NONE",
    relationTruthClaimed: false,
    relationTruth: "NOT_GRANTED",
  };
  const body: Omit<KaleidosphereAnalyticsProjectionV1, "projectionDigest"> = {
    schemaVersion: KALEIDOSPHERE_ANALYTICS_PROJECTION_SCHEMA_V1,
    projectionId: KALEIDOSPHERE_ANALYTICS_PROJECTION_ID,
    contractVersion: KALEIDOSPHERE_ANALYTICS_PROJECTION_VERSION_V1,
    purpose: KALEIDOSPHERE_ANALYTICS_PROJECTION_PURPOSE,
    source,
    nodes,
    edges: [edge],
    authority: "NONE",
    promotion: "NOT_AUTHORIZED",
    effect: "NONE",
    relationTruth: "NOT_GRANTED",
    nonclaims: [...NONCLAIMS],
  };
  return freeze({ ...body, projectionDigest: digest(body) });
}

/** SHA256 over the canonical projection body (everything except `projectionDigest`). */
export function kaleidosphereAnalyticsProjectionDigestV1(projection: unknown): string {
  const plain = plainJson(projection);
  if (plain === INVALID || plain === null || typeof plain !== "object" || Array.isArray(plain)) {
    throw new TypeError("KALEIDOSPHERE_ANALYTICS_INVALID");
  }
  const body: Record<string, unknown> = {};
  for (const [key, child] of Object.entries(plain as Record<string, unknown>)) {
    if (key !== "projectionDigest") body[key] = child;
  }
  return createHash("sha256").update(canonicalJson(body), "utf8").digest("hex");
}

/**
 * Fail-closed verification of a supplied purpose-bound analytics projection.
 * Returns a structured denial (all detected defect classes, sorted) for any
 * malformed, duplicate, stale, overbroad, unsupported, non-authority, or
 * digest-invalid input. It never throws, never mutates the input, and never
 * returns an ordinary success on a bad input.
 */
export function verifyKaleidosphereAnalyticsProjectionV1(value: unknown): KaleidosphereAnalyticsProjectionVerificationV1 {
  const defects = new Map<DefectCode, Set<string>>();
  const mark = (code: DefectCode, detail: string): void => {
    const set = defects.get(code);
    if (set === undefined) defects.set(code, new Set([detail]));
    else set.add(detail);
  };

  const snapshot = plainJson(value);
  if (snapshot === INVALID || snapshot === null || typeof snapshot !== "object" || Array.isArray(snapshot)) {
    mark(CODE.SCHEMA, "projection must be a plain JSON object");
    return deny(defects);
  }
  const envelope = snapshot as Record<string, unknown>;

  if (canonicalJson(Object.keys(envelope).sort()) !== canonicalJson([...TOP_KEYS].sort())) {
    mark(CODE.SCHEMA, "envelope must carry exactly the v1 purpose-bound keys");
  }
  if (envelope.schemaVersion !== KALEIDOSPHERE_ANALYTICS_PROJECTION_SCHEMA_V1) {
    mark(CODE.UNSUPPORTED, "only the v1 purpose-bound projection is supported");
  }
  if (envelope.purpose !== KALEIDOSPHERE_ANALYTICS_PROJECTION_PURPOSE) {
    mark(CODE.UNSUPPORTED, "purpose is unsupported by this v1 facade");
  }
  if (envelope.projectionId !== KALEIDOSPHERE_ANALYTICS_PROJECTION_ID) {
    mark(CODE.SCHEMA, "projectionId must be the frozen purpose-bound scope");
  }
  if (envelope.contractVersion !== KALEIDOSPHERE_ANALYTICS_PROJECTION_VERSION_V1) {
    mark(CODE.SCHEMA, "contractVersion must be the frozen v1 contract");
  }
  if (
    envelope.authority !== "NONE"
    || envelope.promotion !== "NOT_AUTHORIZED"
    || envelope.effect !== "NONE"
    || envelope.relationTruth !== "NOT_GRANTED"
  ) {
    mark(CODE.AUTHORITY, "authority, promotion, and effect must remain NONE / not authorized");
  }
  const nonclaimsPlain = plainJson(envelope.nonclaims);
  if (nonclaimsPlain === INVALID || canonicalJson(nonclaimsPlain) !== canonicalJson([...NONCLAIMS])) {
    mark(CODE.SCHEMA, "nonclaims must be the frozen purpose-bound nonclaims");
  }

  const source = asExactRecord(envelope.source, SOURCE_KEYS);
  if (source === null) {
    mark(CODE.SCHEMA, "source must be the frozen CKS proof-input binding");
  } else if (
    source.contract !== SOURCE_CONTRACT
    || source.contractVersion !== SOURCE_CONTRACT_VERSION
    || source.contractSha256 !== SOURCE_CONTRACT_SHA256
  ) {
    mark(CODE.STALE, "source contract binding is stale or not the frozen CKS proof input");
  }

  const nodes = asArray(envelope.nodes);
  if (nodes === null) {
    mark(CODE.SCHEMA, "nodes must be an array of the v1 purpose-bound nodes");
  } else {
    const seenIds = new Set<string>();
    for (const rawNode of nodes) {
      const node = asExactRecord(rawNode, NODE_KEYS);
      if (node === null) {
        mark(CODE.SCHEMA, "node must carry the v1 node keys");
        continue;
      }
      if (typeof node.id !== "string" || (node.kind !== "KNOWLEDGE" && node.kind !== "DECISION")) {
        mark(CODE.SCHEMA, "node id and kind must be the frozen synthetic subjects");
      }
      const nodeSource = asExactRecord(node.sourceEvidence, SOURCE_EVIDENCE_KEYS);
      if (nodeSource === null || nodeSource.contract !== SOURCE_CONTRACT || nodeSource.contractSha256 !== SOURCE_CONTRACT_SHA256) {
        mark(CODE.STALE, "node source evidence is stale or not the frozen CKS proof input");
      }
      if (node.authority !== "NONE") {
        mark(CODE.AUTHORITY, "node authority must remain NONE");
      }
      if (node.coverage !== "FULL" || node.unknown !== false || !Array.isArray(node.counterevidence)) {
        mark(CODE.SCHEMA, "node coverage, unknown, and counterevidence must be the frozen v1 values");
      }
      if (typeof node.id === "string") {
        if (seenIds.has(node.id)) mark(CODE.DUPLICATE, "duplicate node identifiers");
        seenIds.add(node.id);
      }
    }
    const frozenIds = FROZEN_SUBJECTS.map((subject) => subject.id);
    for (const id of seenIds) if (!frozenIds.includes(id)) mark(CODE.OVERBROAD, `node ${id} is outside the frozen purpose-bound subjects`);
    for (const id of frozenIds) if (!seenIds.has(id)) mark(CODE.SCHEMA, `frozen subject ${id} is missing from the projection`);
    if (nodes.length > frozenIds.length) mark(CODE.OVERBROAD, "the projection carries more nodes than the frozen purpose-bound subjects");
  }

  const edges = asArray(envelope.edges);
  if (edges === null) {
    mark(CODE.SCHEMA, "edges must be an array of the v1 purpose-bound edge");
  } else {
    if (edges.length > 1) mark(CODE.OVERBROAD, "the projection carries more edges than the single frozen purpose-bound relation");
    if (edges.length < 1) mark(CODE.SCHEMA, "the single frozen purpose-bound relation is missing");
    for (const rawEdge of edges) {
      const edge = asExactRecord(rawEdge, EDGE_KEYS);
      if (edge === null) {
        mark(CODE.SCHEMA, "edge must carry the v1 edge keys");
        continue;
      }
      if (edge.from !== RELATION.from || edge.to !== RELATION.to || edge.relation !== RELATION.relation) {
        mark(CODE.SCHEMA, "edge must be the frozen purpose-bound relation");
      }
      const edgeSource = asExactRecord(edge.sourceEvidence, SOURCE_EVIDENCE_KEYS);
      if (edgeSource === null || edgeSource.contract !== SOURCE_CONTRACT || edgeSource.contractSha256 !== SOURCE_CONTRACT_SHA256) {
        mark(CODE.STALE, "edge source evidence is stale or not the frozen CKS proof input");
      }
      const evidence = asArray(edge.evidence);
      if (evidence === null || evidence.length !== EXPECTED_EVIDENCE.length) {
        mark(CODE.STALE, "the edge is not established by the frozen source receipts; endpoint presence alone does not establish it");
      } else {
        for (let index = 0; index < EXPECTED_EVIDENCE.length; index += 1) {
          const entry = asExactRecord(evidence[index], EVIDENCE_KEYS);
          if (entry === null) {
            mark(CODE.SCHEMA, "evidence entry must carry the v1 evidence keys");
            continue;
          }
          const expected = EXPECTED_EVIDENCE[index];
          if (expected === undefined) {
            mark(CODE.SCHEMA, "frozen evidence index is out of range");
            continue;
          }
          if (entry.evidenceId !== expected.evidenceId || entry.evidenceVersion !== expected.evidenceVersion || entry.evidenceRole !== expected.evidenceRole) {
            mark(CODE.STALE, "evidence entry does not match the frozen receipt identity");
          }
          if (typeof entry.evidenceSha256 !== "string" || !HEX64.test(entry.evidenceSha256)) {
            mark(CODE.SCHEMA, "evidenceSha256 must be a 64-hex digest");
          } else if (entry.evidenceSha256 !== digest(expected)) {
            mark(CODE.STALE, "evidenceSha256 is stale or forged and does not bind the frozen owner receipt");
          }
        }
      }
      const evidencePlain = plainJson(edge.evidence);
      const evidenceDigest = evidencePlain === INVALID ? "" : createHash("sha256").update(canonicalJson(evidencePlain), "utf8").digest("hex");
      if (typeof edge.evidenceSha256 !== "string" || edge.evidenceSha256 !== evidenceDigest) {
        mark(CODE.DIGEST, "edge evidenceSha256 must bind the edge evidence");
      }
      if (
        edge.authority !== "NONE"
        || edge.promotion !== "NOT_AUTHORIZED"
        || edge.effect !== "NONE"
        || edge.relationTruthClaimed !== false
        || edge.relationTruth !== "NOT_GRANTED"
      ) {
        mark(CODE.AUTHORITY, "edge authority, promotion, and effect must remain NONE / not granted");
      }
      if (edge.coverage !== "FULL" || edge.unknown !== false || !Array.isArray(edge.counterevidence)) {
        mark(CODE.SCHEMA, "edge coverage, unknown, and counterevidence must be the frozen v1 values");
      }
    }
  }

  const body: Record<string, unknown> = {};
  for (const [key, child] of Object.entries(envelope)) {
    if (key !== "projectionDigest") body[key] = child;
  }
  const expectedDigest = createHash("sha256").update(canonicalJson(plainJson(body)), "utf8").digest("hex");
  if (typeof envelope.projectionDigest !== "string" || envelope.projectionDigest !== expectedDigest) {
    mark(CODE.DIGEST, "projectionDigest must bind the full projection body");
  }

  if (defects.size > 0) return deny(defects);

  const nodeCount = (envelope.nodes as unknown[]).length;
  const edgeCount = (envelope.edges as unknown[]).length;
  return {
    outcome: "VERIFIED",
    reasonCodes: ["KALEIDOSPHERE_ANALYTICS_PROJECTION_VERIFIED"],
    projectionDigest: envelope.projectionDigest as string,
    nodeCount: nodeCount as 2,
    edgeCount: edgeCount as 1,
    authority: "NONE",
  };
}