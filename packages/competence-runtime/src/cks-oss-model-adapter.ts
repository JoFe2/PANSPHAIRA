import { createHash } from "node:crypto";
import { canonicalJson } from "../../contracts/src/canonical-json.js";
import {
  MODEL_TOOL_CALL_SCHEMA_V1,
  validateCompetenceResponseV1,
  validateCksModelToolCallV1,
  type CksCompetenceRuntimeContractV1,
  type CksModelBindingV1,
  type CksPromptBindingV1,
  type CksQuantizationBindingV1,
  type CksRuntimeBindingV1,
  type CksToolProtocolsV1,
  type CksKnowledgeBindingsV1,
  type CksModelToolCallV1,
  type CompetenceResponseV1,
} from "../../contracts/src/cks-competence-runtime.js";

/** The adapter is a local boundary only; it never fine-tunes or grants authority. */
export const CKS_OSS_MODEL_ADAPTER_SCHEMA_V1 = "pansphaira.cks/oss-model-adapter/v1" as const;
export const CKS_OSS_MODEL_ADAPTER_VERSION_V1 = "1" as const;
export const CKS_NO_FINE_TUNE_MODE_V1 = "LOCAL_NO_FINE_TUNE" as const;
export const CKS_NETWORK_POLICY_V1 = "DENY_ALL" as const;

export interface CksOssModelProfileTemplateV1 {
  readonly profileSchemaVersion: "pansphaira.cks/oss-model-profile/v1";
  readonly profileId: string;
  readonly profileRevision: number;
  readonly intendedUse: string;
  readonly selectionStatus: "SELECTED_NOT_QUALIFIED";
  readonly model: CksModelBindingV1;
  readonly quantization: CksQuantizationBindingV1;
  readonly runtime: CksRuntimeBindingV1;
  readonly prompt: CksPromptBindingV1;
  readonly toolProtocols: CksToolProtocolsV1;
  readonly knowledgeBindings: CksKnowledgeBindingsV1;
  readonly adapterBoundary: {
    readonly schemaVersion: typeof CKS_OSS_MODEL_ADAPTER_SCHEMA_V1;
    readonly version: typeof CKS_OSS_MODEL_ADAPTER_VERSION_V1;
    readonly mode: typeof CKS_NO_FINE_TUNE_MODE_V1;
    readonly weightModification: "FORBIDDEN";
    readonly networkPolicy: typeof CKS_NETWORK_POLICY_V1;
    readonly authority: "NONE";
  };
}

export interface CksLocalModelRequestV1 {
  readonly input: string;
  readonly model: CksModelBindingV1;
  readonly quantization: CksQuantizationBindingV1;
  readonly runtime: CksRuntimeBindingV1;
  readonly prompt: CksPromptBindingV1;
  readonly toolProtocols: CksToolProtocolsV1;
  readonly mode: typeof CKS_NO_FINE_TUNE_MODE_V1;
  readonly networkPolicy: typeof CKS_NETWORK_POLICY_V1;
}

export type CksLocalModelInvokerV1 = (request: CksLocalModelRequestV1) => string | Promise<string>;

export class CksOssModelAdapterDenied extends Error {
  public readonly code: string;

  public constructor(code: string) {
    super(code);
    this.name = "CksOssModelAdapterDenied";
    this.code = code;
  }
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === "object" && !Array.isArray(value) && Object.getPrototypeOf(value) === Object.prototype;
const isDigest = (value: unknown): value is string => typeof value === "string" && /^[a-f0-9]{64}$/.test(value);
const isText = (value: unknown, max = 512): value is string =>
  typeof value === "string" && value.length > 0 && value.length <= max && !/[\u0000-\u001f]/.test(value);
const sha256 = (value: string): string => createHash("sha256").update(value, "utf8").digest("hex");

function parseJson(value: string): unknown | null {
  try {
    return JSON.parse(value) as unknown;
  } catch {
    return null;
  }
}

function profileShape(value: unknown): value is CksOssModelProfileTemplateV1 {
  if (!isRecord(value)
    || value.profileSchemaVersion !== "pansphaira.cks/oss-model-profile/v1"
    || !isText(value.profileId, 192)
    || !Number.isSafeInteger(value.profileRevision) || (value.profileRevision as number) < 1
    || !isText(value.intendedUse, 192)
    || value.selectionStatus !== "SELECTED_NOT_QUALIFIED") return false;
  if (!isRecord(value.model) || !isDigest(value.model.artifactSha256)) return false;
  if (!isRecord(value.quantization) || value.quantization.conversionOrRequantizationAllowed !== false) return false;
  if (!isRecord(value.runtime) || value.runtime.backend !== "CPU" || value.runtime.gpuLayers !== 0) return false;
  if (!isRecord(value.prompt) || !isDigest(value.prompt.sha256)) return false;
  if (!isRecord(value.toolProtocols) || value.toolProtocols.catalogueMode !== "CLOSED_EXACTLY_ONE_MODEL_CALLABLE_TOOL" || value.toolProtocols.unknownToolsOrFields !== "DENY") return false;
  if (!isRecord(value.knowledgeBindings) || value.knowledgeBindings.onlineFallback !== "FORBIDDEN" || value.knowledgeBindings.knowledgeGrantsCapabilityOrAuthority !== false) return false;
  const boundary = value.adapterBoundary;
  return isRecord(boundary)
    && boundary.schemaVersion === CKS_OSS_MODEL_ADAPTER_SCHEMA_V1
    && boundary.version === CKS_OSS_MODEL_ADAPTER_VERSION_V1
    && boundary.mode === CKS_NO_FINE_TUNE_MODE_V1
    && boundary.weightModification === "FORBIDDEN"
    && boundary.networkPolicy === CKS_NETWORK_POLICY_V1
    && boundary.authority === "NONE";
}

/** Validate the selected profile before it crosses into the local adapter. */
export function validateCksOssModelProfileTemplateV1(value: unknown): value is CksOssModelProfileTemplateV1 {
  return profileShape(value);
}

export function cksOssModelProfileDigestV1(value: CksOssModelProfileTemplateV1): string {
  return sha256(canonicalJson(value));
}

/** A runtime contract can be adapted without copying or changing its selected bindings. */
export function profileTemplateFromRuntimeContractV1(
  contract: CksCompetenceRuntimeContractV1,
): CksOssModelProfileTemplateV1 {
  return {
    profileSchemaVersion: contract.profile.profileSchemaVersion as "pansphaira.cks/oss-model-profile/v1",
    profileId: contract.profile.profileId,
    profileRevision: contract.profile.profileRevision,
    intendedUse: contract.profile.intendedUse,
    selectionStatus: contract.profile.selectionStatus,
    model: contract.model,
    quantization: contract.quantization,
    runtime: contract.runtime,
    prompt: contract.prompt,
    toolProtocols: contract.toolProtocols,
    knowledgeBindings: contract.knowledgeBindings,
    adapterBoundary: {
      schemaVersion: CKS_OSS_MODEL_ADAPTER_SCHEMA_V1,
      version: CKS_OSS_MODEL_ADAPTER_VERSION_V1,
      mode: CKS_NO_FINE_TUNE_MODE_V1,
      weightModification: "FORBIDDEN",
      networkPolicy: CKS_NETWORK_POLICY_V1,
      authority: "NONE",
    },
  };
}

/** Parse only the closed JSON tool envelope emitted by the model. */
export function parseCksModelToolCallV1(value: unknown): CksModelToolCallV1 | null {
  const parsed = typeof value === "string" ? parseJson(value) : value;
  return validateCksModelToolCallV1(parsed) ? parsed : null;
}

/** Parse only the closed, digest-bound final competence response. */
export function parseCksCompetenceResponseV1(value: unknown): CompetenceResponseV1 | null {
  const parsed = typeof value === "string" ? parseJson(value) : value;
  return validateCompetenceResponseV1(parsed) ? parsed : null;
}

export class CksLocalOssModelAdapterV1 {
  public readonly profile: CksOssModelProfileTemplateV1;
  private readonly invoke: CksLocalModelInvokerV1;

  public constructor(profile: CksOssModelProfileTemplateV1, invoke: CksLocalModelInvokerV1) {
    if (!profileShape(profile)) throw new CksOssModelAdapterDenied("PROFILE_BINDING_DENIED");
    this.profile = profile;
    this.invoke = invoke;
  }

  /** Invoke the pre-staged local model; no URL, tool effect, or weight mutation is exposed. */
  public async generate(input: string): Promise<string> {
    if (!isText(input, 1_048_576)) throw new CksOssModelAdapterDenied("MODEL_INPUT_DENIED");
    const output = await this.invoke({
      input,
      model: this.profile.model,
      quantization: this.profile.quantization,
      runtime: this.profile.runtime,
      prompt: this.profile.prompt,
      toolProtocols: this.profile.toolProtocols,
      mode: CKS_NO_FINE_TUNE_MODE_V1,
      networkPolicy: CKS_NETWORK_POLICY_V1,
    });
    if (!isText(output, 1_048_576)) throw new CksOssModelAdapterDenied("MODEL_OUTPUT_DENIED");
    return output;
  }

  public parseToolCall(output: string): CksModelToolCallV1 | null {
    return parseCksModelToolCallV1(output);
  }

  public parseResponse(output: string): CompetenceResponseV1 | null {
    return parseCksCompetenceResponseV1(output);
  }
}

export function createCksLocalOssModelAdapterV1(
  profile: CksOssModelProfileTemplateV1,
  invoke: CksLocalModelInvokerV1,
): CksLocalOssModelAdapterV1 {
  return new CksLocalOssModelAdapterV1(profile, invoke);
}

/** Raw transcript digest helper: strings are hashed byte-for-byte, objects canonically. */
export function cksTranscriptDigestV1(value: string | Record<string, unknown> | readonly unknown[]): string {
  return sha256(typeof value === "string" ? value : canonicalJson(value));
}

export const CKS_MODEL_TOOL_CALL_SCHEMA_V1 = MODEL_TOOL_CALL_SCHEMA_V1;
