import { createHash } from "node:crypto";
import { types } from "node:util";

import { canonicalJson } from "../../packages/contracts/src/canonical-json.js";
import {
  buildKaleidosphereAnalyticsProjectionV1,
  SOURCE_CONTRACT_SHA256,
} from "../../packages/contracts/src/kaleidosphere-analytics-projection.js";

export const KALEIDOSPHERE_CANDIDATE_QUARANTINE_SCHEMA_V1 = "pansphaira.xra-ps-02/candidate-adjudication/v1" as const;
export const PANSPHAIRA_EXACT_RELEASED_HEAD_V1 = "90512ba63587d10b4a833a7f31e1f91595531467" as const;
export const CANDIDATE_ID_V1 = "pansphaira:xra-ps-02-candidate-001" as const;
export const ADJUDICATION_RECEIPT_ID_V1 = "pansphaira:xra-ps-02-paired-receipt-001" as const;

export const ADJUDICATION_CHAIN_STAGES = Object.freeze([
  "GENERATION",
  "PROJECTION",
  "INGESTION",
  "SEMANTICS",
  "ANALYSIS",
  "CANDIDATE",
  "ADJUDICATION",
] as const);

const CANONICAL_KNOWLEDGE_SHA256 = "d756437db8c991ee78ea7a9fcc7a9d4749daf8eebda51d5ba31fcc53e1b1242a" as const;
const HEX64 = /^[a-f0-9]{64}$/;
const HEAD40 = /^[a-f0-9]{40}$/;
const INVALID = Symbol("xra-ps-02-invalid");

type PlainRecord = Record<string, unknown>;

type ConsumerVerdictV1 = "ACCEPTED_BOUNDED" | "RESTRICTED" | "DENIED" | "UNKNOWN";

export type ReleasedHeadsV1 = Readonly<{
  pansphaira: string;
  kaleidoSphere: string;
}>;

export type CandidateEvidenceV1 = Readonly<{
  evidenceId: string;
  evidenceRole: string;
  evidenceSha256: string;
  evidenceVersion: string;
}>;

export type CounterevidenceV1 = Readonly<{
  evidenceId: string;
  evidenceSha256: string;
  reason: "CONTRADICTS_OWNER_EVIDENCE";
}>;

export type CandidateV1 = Readonly<{
  candidateDigest: string;
  candidateHead: string;
  candidateId: typeof CANDIDATE_ID_V1;
  canonicalKnowledgeSha256: string;
  counterevidence: readonly CounterevidenceV1[];
  evidence: readonly CandidateEvidenceV1[];
  kaleidoSphereHead: string;
  kaleidoSphereVerdict: ConsumerVerdictV1;
  pansphairaHead: string;
  projectionDigest: string;
  releasedHeads: ReleasedHeadsV1;
  schemaVersion: typeof KALEIDOSPHERE_CANDIDATE_QUARANTINE_SCHEMA_V1;
  unknown: boolean;
}>;

export type AdjudicationReasonCodeV1 =
  | "AUTHORITATIVE_EVIDENCE_ACCEPTED"
  | "AUTHORITATIVE_EVIDENCE_RESTRICTED_UNKNOWN"
  | "CANDIDATE_SCHEMA_DENIED"
  | "CONFLICTING_COUNTEREVIDENCE_DENIED"
  | "FORGED_CANDIDATE_DENIED"
  | "STALE_HEAD_DENIED";

export type AdjudicationV1 = Readonly<{
  authoritativeProjectionDigest: string;
  authoritativeSourceContractSha256: string;
  authority: "NONE";
  canonicalKnowledgeAfterSha256: string;
  canonicalKnowledgeBeforeSha256: string;
  canonicalKnowledgeMutation: "NONE";
  capabilityDelta: "NONE";
  candidateDigest: string;
  effect: "NONE";
  kaleidoSphereVerdictAuthoritative: false;
  outcome: "ACCEPTED_BOUNDED" | "RESTRICTED" | "DENIED";
  reasonCodes: readonly AdjudicationReasonCodeV1[];
  schemaVersion: typeof KALEIDOSPHERE_CANDIDATE_QUARANTINE_SCHEMA_V1;
}>;

type ChainStageV1 = Readonly<{
  digest: string;
  stage: (typeof ADJUDICATION_CHAIN_STAGES)[number];
}>;

export type PairedAdjudicationReceiptV1 = Readonly<{
  adjudication: AdjudicationV1;
  adjudicationDigest: string;
  authority: "NONE";
  candidate: CandidateV1;
  candidateDigest: string;
  chain: readonly ChainStageV1[];
  effect: "NONE";
  receiptDigest: string;
  receiptId: typeof ADJUDICATION_RECEIPT_ID_V1;
  releasedHeads: ReleasedHeadsV1;
  schemaVersion: typeof KALEIDOSPHERE_CANDIDATE_QUARANTINE_SCHEMA_V1;
}>;

export type PairedReceiptVerificationV1 =
  | Readonly<{
    authority: "NONE";
    chainStages: readonly (typeof ADJUDICATION_CHAIN_STAGES)[number][];
    effect: "NONE";
    outcome: "VERIFIED";
    receiptDigest: string;
    releasedHeads: ReleasedHeadsV1;
  }>
  | Readonly<{ outcome: "DENIED"; reasonCodes: readonly ["RECEIPT_DENIED"] }>;

const freeze = <T>(value: T): T => {
  if (Array.isArray(value)) {
    for (const entry of value) freeze(entry);
    return Object.freeze(value);
  }
  if (value !== null && typeof value === "object") {
    for (const entry of Object.values(value as PlainRecord)) freeze(entry);
    return Object.freeze(value);
  }
  return value;
};

const digest = (value: unknown): string => {
  const snapshot = plainSnapshot(value);
  if (snapshot === INVALID) throw new TypeError("XRA_PS_02_INVALID_JSON");
  return createHash("sha256").update(canonicalJson(snapshot), "utf8").digest("hex");
};

function plainSnapshot(value: unknown, seen = new Set<unknown>()): unknown {
  if (value === null || typeof value === "string" || typeof value === "boolean") return value;
  if (typeof value === "number") return Number.isFinite(value) ? value : INVALID;
  if (typeof value !== "object" || types.isProxy(value) || seen.has(value)) return INVALID;
  seen.add(value);
  try {
    if (Array.isArray(value)) {
      const keys = Reflect.ownKeys(value);
      if (keys.length !== value.length + 1 || keys.some((key) => key !== "length" && (typeof key !== "string" || !/^(0|[1-9][0-9]*)$/.test(key) || Number(key) >= value.length))) return INVALID;
      const length = Object.getOwnPropertyDescriptor(value, "length");
      if (!length || length.enumerable || !("value" in length) || length.value !== value.length) return INVALID;
      const output: unknown[] = [];
      for (let index = 0; index < value.length; index += 1) {
        const descriptor = Object.getOwnPropertyDescriptor(value, String(index));
        if (!descriptor || !descriptor.enumerable || !("value" in descriptor)) return INVALID;
        const child = plainSnapshot(descriptor.value, seen);
        if (child === INVALID) return INVALID;
        output.push(child);
      }
      return output;
    }
    if (Object.getPrototypeOf(value) !== Object.prototype) return INVALID;
    const output: PlainRecord = {};
    for (const key of Reflect.ownKeys(value)) {
      if (typeof key !== "string") return INVALID;
      const descriptor = Object.getOwnPropertyDescriptor(value, key);
      if (!descriptor || !descriptor.enumerable || !("value" in descriptor)) return INVALID;
      const child = plainSnapshot(descriptor.value, seen);
      if (child === INVALID) return INVALID;
      output[key] = child;
    }
    return output;
  } catch {
    return INVALID;
  }
}

const exactRecord = (value: unknown, keys: readonly string[]): PlainRecord | undefined => {
  if (value === null || typeof value !== "object" || types.isProxy(value) || Array.isArray(value)) return undefined;
  const record = value as PlainRecord;
  try {
    if (Object.getPrototypeOf(record) !== Object.prototype) return undefined;
    if (Reflect.ownKeys(record).length !== keys.length || Reflect.ownKeys(record).some((key) => typeof key !== "string" || !keys.includes(key))) return undefined;
    for (const key of keys) {
      const descriptor = Object.getOwnPropertyDescriptor(record, key);
      if (!descriptor || !descriptor.enumerable || !("value" in descriptor)) return undefined;
    }
  } catch {
    return undefined;
  }
  return record;
};

const expectedEvidence = (): readonly CandidateEvidenceV1[] => {
  const projection = buildKaleidosphereAnalyticsProjectionV1();
  return projection.edges[0]!.evidence.map((entry) => ({
    evidenceId: entry.evidenceId,
    evidenceRole: entry.evidenceRole,
    evidenceSha256: entry.evidenceSha256,
    evidenceVersion: entry.evidenceVersion,
  }));
};

export type AuthoritativeAdjudicationInputsV1 = Readonly<{
  canonicalKnowledgeSha256: typeof CANONICAL_KNOWLEDGE_SHA256;
  evidence: readonly CandidateEvidenceV1[];
  projectionDigest: string;
  releasedPansphairaHead: typeof PANSPHAIRA_EXACT_RELEASED_HEAD_V1;
  schemaVersion: typeof KALEIDOSPHERE_CANDIDATE_QUARANTINE_SCHEMA_V1;
  sourceContractSha256: typeof SOURCE_CONTRACT_SHA256;
}>;

export function buildAuthoritativeAdjudicationInputs(): AuthoritativeAdjudicationInputsV1 {
  const projection = buildKaleidosphereAnalyticsProjectionV1();
  return freeze({
    canonicalKnowledgeSha256: CANONICAL_KNOWLEDGE_SHA256,
    evidence: expectedEvidence(),
    projectionDigest: projection.projectionDigest,
    releasedPansphairaHead: PANSPHAIRA_EXACT_RELEASED_HEAD_V1,
    schemaVersion: KALEIDOSPHERE_CANDIDATE_QUARANTINE_SCHEMA_V1,
    sourceContractSha256: SOURCE_CONTRACT_SHA256,
  });
}

const candidateBody = (candidate: CandidateV1): Omit<CandidateV1, "candidateDigest"> => {
  const { candidateDigest: _candidateDigest, ...body } = candidate;
  return body;
};

export function candidateDigestV1(candidate: CandidateV1): string {
  return digest(candidateBody(candidate));
}

export function createCandidateV1(options: Readonly<{
  kaleidoSphereVerdict: ConsumerVerdictV1;
  releasedHeads: ReleasedHeadsV1;
  counterevidence?: readonly CounterevidenceV1[];
  unknown?: boolean;
}>): CandidateV1 {
  const authoritative = buildAuthoritativeAdjudicationInputs();
  const body = {
    candidateHead: options.releasedHeads.kaleidoSphere,
    candidateId: CANDIDATE_ID_V1,
    canonicalKnowledgeSha256: authoritative.canonicalKnowledgeSha256,
    counterevidence: [...(options.counterevidence ?? [])],
    evidence: authoritative.evidence.map((entry) => ({ ...entry })),
    kaleidoSphereHead: options.releasedHeads.kaleidoSphere,
    kaleidoSphereVerdict: options.kaleidoSphereVerdict,
    pansphairaHead: options.releasedHeads.pansphaira,
    projectionDigest: authoritative.projectionDigest,
    releasedHeads: { ...options.releasedHeads },
    schemaVersion: KALEIDOSPHERE_CANDIDATE_QUARANTINE_SCHEMA_V1,
    unknown: options.unknown ?? false,
  } as const;
  return freeze({ ...body, candidateDigest: digest(body) });
}

const result = (
  authoritative: AuthoritativeAdjudicationInputsV1,
  outcome: AdjudicationV1["outcome"],
  reasonCodes: readonly AdjudicationReasonCodeV1[],
  candidateDigest = "",
): AdjudicationV1 => freeze({
  authoritativeProjectionDigest: authoritative.projectionDigest,
  authoritativeSourceContractSha256: authoritative.sourceContractSha256,
  authority: "NONE",
  canonicalKnowledgeAfterSha256: authoritative.canonicalKnowledgeSha256,
  canonicalKnowledgeBeforeSha256: authoritative.canonicalKnowledgeSha256,
  canonicalKnowledgeMutation: "NONE",
  capabilityDelta: "NONE",
  candidateDigest,
  effect: "NONE",
  kaleidoSphereVerdictAuthoritative: false,
  outcome,
  reasonCodes: [...reasonCodes],
  schemaVersion: KALEIDOSPHERE_CANDIDATE_QUARANTINE_SCHEMA_V1,
});

const validHeads = (value: unknown): value is ReleasedHeadsV1 => {
  const heads = exactRecord(value, ["kaleidoSphere", "pansphaira"]);
  return heads !== undefined && typeof heads.pansphaira === "string" && HEAD40.test(heads.pansphaira) && typeof heads.kaleidoSphere === "string" && HEAD40.test(heads.kaleidoSphere);
};

const arraysEqual = (left: unknown, right: unknown): boolean => canonicalJson(left) === canonicalJson(right);

export function adjudicateCandidateV1(input: unknown): AdjudicationV1 {
  const authoritative = buildAuthoritativeAdjudicationInputs();
  const envelope = exactRecord(input, ["candidate", "releasedHeads"]);
  if (!envelope || !validHeads(envelope.releasedHeads)) return result(authoritative, "DENIED", ["CANDIDATE_SCHEMA_DENIED"]);
  const releasedHeads = envelope.releasedHeads;
  if (releasedHeads.pansphaira !== authoritative.releasedPansphairaHead) return result(authoritative, "DENIED", ["STALE_HEAD_DENIED"]);

  const candidate = exactRecord(envelope.candidate, [
    "candidateDigest", "candidateHead", "candidateId", "canonicalKnowledgeSha256", "counterevidence", "evidence",
    "kaleidoSphereHead", "kaleidoSphereVerdict", "pansphairaHead", "projectionDigest", "releasedHeads", "schemaVersion", "unknown",
  ]);
  if (!candidate || plainSnapshot(candidate) === INVALID) return result(authoritative, "DENIED", ["CANDIDATE_SCHEMA_DENIED"]);
  const candidateDigest = typeof candidate.candidateDigest === "string" ? candidate.candidateDigest : "";
  if (
    candidate.schemaVersion !== authoritative.schemaVersion
    || candidate.candidateId !== CANDIDATE_ID_V1
    || !validHeads(candidate.releasedHeads)
    || !arraysEqual(candidate.releasedHeads, releasedHeads)
    || candidate.pansphairaHead !== releasedHeads.pansphaira
    || candidate.kaleidoSphereHead !== releasedHeads.kaleidoSphere
    || candidate.candidateHead !== releasedHeads.kaleidoSphere
    || typeof candidate.candidateDigest !== "string" || !HEX64.test(candidate.candidateDigest)
    || candidateDigestV1(candidate as CandidateV1) !== candidate.candidateDigest
  ) return result(authoritative, "DENIED", ["FORGED_CANDIDATE_DENIED"], candidateDigest);
  if (![
    "ACCEPTED_BOUNDED", "RESTRICTED", "DENIED", "UNKNOWN",
  ].includes(candidate.kaleidoSphereVerdict as string) || typeof candidate.unknown !== "boolean" || !Array.isArray(candidate.counterevidence)) return result(authoritative, "DENIED", ["CANDIDATE_SCHEMA_DENIED"], candidateDigest);
  if (
    candidate.canonicalKnowledgeSha256 !== authoritative.canonicalKnowledgeSha256
    || candidate.projectionDigest !== authoritative.projectionDigest
    || !arraysEqual(candidate.evidence, authoritative.evidence)
  ) return result(authoritative, "DENIED", ["FORGED_CANDIDATE_DENIED"], candidateDigest);
  if (candidate.counterevidence.length > 0) return result(authoritative, "DENIED", ["CONFLICTING_COUNTEREVIDENCE_DENIED"], candidateDigest);
  if (candidate.unknown) return result(authoritative, "RESTRICTED", ["AUTHORITATIVE_EVIDENCE_RESTRICTED_UNKNOWN"], candidateDigest);
  return result(authoritative, "ACCEPTED_BOUNDED", ["AUTHORITATIVE_EVIDENCE_ACCEPTED"], candidateDigest);
}

const receiptBody = (receipt: PairedAdjudicationReceiptV1): Omit<PairedAdjudicationReceiptV1, "receiptDigest"> => {
  const { receiptDigest: _receiptDigest, ...body } = receipt;
  return body;
};

export function createPairedAdjudicationReceiptV1(input: Readonly<{
  adjudication: AdjudicationV1;
  candidate: CandidateV1;
  releasedHeads: ReleasedHeadsV1;
  stageDigests: Readonly<Record<(typeof ADJUDICATION_CHAIN_STAGES)[number], string>>;
}>): PairedAdjudicationReceiptV1 {
  const chain = ADJUDICATION_CHAIN_STAGES.map((stage) => ({ stage, digest: input.stageDigests[stage] }));
  const body = {
    adjudication: input.adjudication,
    adjudicationDigest: digest(input.adjudication),
    authority: "NONE",
    candidate: input.candidate,
    candidateDigest: input.candidate.candidateDigest,
    chain,
    effect: "NONE",
    receiptId: ADJUDICATION_RECEIPT_ID_V1,
    releasedHeads: { ...input.releasedHeads },
    schemaVersion: KALEIDOSPHERE_CANDIDATE_QUARANTINE_SCHEMA_V1,
  } as const;
  return freeze({ ...body, receiptDigest: digest(body) });
}

export function verifyPairedAdjudicationReceiptV1(value: unknown): PairedReceiptVerificationV1 {
  const snapshot = plainSnapshot(value);
  if (snapshot === INVALID || snapshot === null || typeof snapshot !== "object" || Array.isArray(snapshot)) return { outcome: "DENIED", reasonCodes: ["RECEIPT_DENIED"] };
  const receipt = snapshot as PlainRecord;
  const keys = ["adjudication", "adjudicationDigest", "authority", "candidate", "candidateDigest", "chain", "effect", "receiptDigest", "receiptId", "releasedHeads", "schemaVersion"] as const;
  if (Reflect.ownKeys(receipt).length !== keys.length || Reflect.ownKeys(receipt).some((key) => typeof key !== "string" || !keys.includes(key as (typeof keys)[number]))) return { outcome: "DENIED", reasonCodes: ["RECEIPT_DENIED"] };
  if (receipt.schemaVersion !== KALEIDOSPHERE_CANDIDATE_QUARANTINE_SCHEMA_V1 || receipt.receiptId !== ADJUDICATION_RECEIPT_ID_V1 || receipt.authority !== "NONE" || receipt.effect !== "NONE" || !validHeads(receipt.releasedHeads)) return { outcome: "DENIED", reasonCodes: ["RECEIPT_DENIED"] };
  const candidate = receipt.candidate as CandidateV1;
  const adjudication = receipt.adjudication as AdjudicationV1;
  if (candidate === null || typeof candidate !== "object" || Array.isArray(candidate) || adjudication === null || typeof adjudication !== "object" || Array.isArray(adjudication)) return { outcome: "DENIED", reasonCodes: ["RECEIPT_DENIED"] };
  const expectedAdjudication = adjudicateCandidateV1({ candidate, releasedHeads: receipt.releasedHeads });
  if (
    receipt.candidateDigest !== candidate.candidateDigest
    || candidate.candidateDigest !== candidateDigestV1(candidate)
    || receipt.adjudicationDigest !== digest(adjudication)
    || canonicalJson(adjudication) !== canonicalJson(expectedAdjudication)
  ) return { outcome: "DENIED", reasonCodes: ["RECEIPT_DENIED"] };
  const chain = receipt.chain;
  if (!Array.isArray(chain) || chain.length !== ADJUDICATION_CHAIN_STAGES.length || chain.some((entry, index) => {
    const stage = exactRecord(entry, ["digest", "stage"]);
    return !stage || stage.stage !== ADJUDICATION_CHAIN_STAGES[index] || typeof stage.digest !== "string" || !HEX64.test(stage.digest);
  })) return { outcome: "DENIED", reasonCodes: ["RECEIPT_DENIED"] };
  const expectedDigest = digest(receiptBody({ ...receipt, receiptDigest: receipt.receiptDigest } as PairedAdjudicationReceiptV1));
  if (receipt.receiptDigest !== expectedDigest) return { outcome: "DENIED", reasonCodes: ["RECEIPT_DENIED"] };
  return {
    authority: "NONE",
    chainStages: [...ADJUDICATION_CHAIN_STAGES],
    effect: "NONE",
    outcome: "VERIFIED",
    receiptDigest: receipt.receiptDigest as string,
    releasedHeads: receipt.releasedHeads as ReleasedHeadsV1,
  };
}
