import { createHash } from "node:crypto";
import { canonicalJson } from "../../contracts/src/canonical-json.js";
import {
  KNOWLEDGE_QUERY_PROTOCOL_V1,
  QUERY_LIMITS_V1,
  admitKnowledgeQueryV1,
  bindKnowledgeQueryArgumentsV1,
  validateEvidencePackResultForRequestV1,
  type CompetenceResponseV1,
  type EvidencePackResultV1,
  type KnowledgeQueryRequestV1,
  type RetrievalTaskStateV1,
} from "../../contracts/src/cks-competence-runtime.js";
import {
  CKS_DETERMINISTIC_VERIFIER_ID_V1,
  CKS_DETERMINISTIC_VERIFIER_PROTOCOL_V1,
  CKS_DETERMINISTIC_VERIFIER_VERSION_V1,
} from "../../contracts/src/cks-epistemic-verifier.js";
import {
  CKS_NETWORK_POLICY_V1,
  CKS_NO_FINE_TUNE_MODE_V1,
  CksLocalOssModelAdapterV1,
  cksOssModelProfileDigestV1,
  cksTranscriptDigestV1,
  parseCksCompetenceResponseV1,
  parseCksModelToolCallV1,
  type CksOssModelProfileTemplateV1,
} from "./cks-oss-model-adapter.js";

export const CKS_RUN_MANIFEST_SCHEMA_V1 = "pansphaira.cks/run-manifest/v1" as const;
export const CKS_RUN_MANIFEST_VERSION_V1 = "1" as const;
export const CKS_RUN_MANIFEST_AUTHORITY_V1 = "NONE" as const;

export interface CksManifestBindingPartV1 {
  readonly id: string;
  readonly version: string;
  readonly digest: string;
}

export interface CksRunKnowledgeBindingV1 {
  readonly editionId: string;
  readonly version: string;
  readonly digest: string;
  readonly contractVersion: string;
  readonly contractVersions: Readonly<Record<string, string>>;
}

export interface CksRunManifestV1 {
  readonly schemaVersion: typeof CKS_RUN_MANIFEST_SCHEMA_V1;
  readonly manifestId: string;
  readonly manifestVersion: typeof CKS_RUN_MANIFEST_VERSION_V1;
  readonly profile: {
    readonly profileId: string;
    readonly profileRevision: number;
    readonly profileDigest: string;
    readonly selectionStatus: "SELECTED_NOT_QUALIFIED";
  };
  readonly task: {
    readonly taskId: string;
    readonly taskDigest: string;
    readonly scopeDigest: string;
  };
  readonly bindings: {
    readonly model: CksManifestBindingPartV1;
    readonly quantization: CksManifestBindingPartV1;
    readonly runtime: CksManifestBindingPartV1;
    readonly prompt: CksManifestBindingPartV1;
    readonly tool: CksManifestBindingPartV1;
    readonly knowledge: CksRunKnowledgeBindingV1;
    readonly verifier: CksManifestBindingPartV1;
  };
  readonly transcriptDigests: {
    readonly input: string;
    readonly output: string;
  };
  readonly execution: {
    readonly adapterSchemaVersion: "pansphaira.cks/oss-model-adapter/v1";
    readonly adapterVersion: typeof CKS_RUN_MANIFEST_VERSION_V1;
    readonly mode: typeof CKS_NO_FINE_TUNE_MODE_V1;
    readonly networkPolicy: typeof CKS_NETWORK_POLICY_V1;
    readonly weightModification: "FORBIDDEN";
    readonly actionAuthority: typeof CKS_RUN_MANIFEST_AUTHORITY_V1;
  };
  readonly manifestDigest: string;
}

export interface CksRunManifestOptionsV1 {
  readonly manifestId: string;
  readonly profile: CksOssModelProfileTemplateV1;
  readonly task: { readonly taskId: string; readonly taskDigest: string; readonly scopeDigest: string };
  readonly knowledge: {
    readonly editionId: string;
    readonly version: string;
    readonly digest: string;
    readonly contractVersion?: string;
  };
  readonly inputTranscript: string | Record<string, unknown> | readonly unknown[];
  readonly outputTranscript: string | Record<string, unknown> | readonly unknown[];
  readonly verifier?: CksManifestBindingPartV1;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === "object" && !Array.isArray(value) && Object.getPrototypeOf(value) === Object.prototype;
const isDigest = (value: unknown): value is string => typeof value === "string" && /^[a-f0-9]{64}$/.test(value);
const isText = (value: unknown, max = 192): value is string =>
  typeof value === "string" && value.length > 0 && value.length <= max && !/[\u0000-\u001f]/.test(value);
const sha256 = (value: string): string => createHash("sha256").update(value, "utf8").digest("hex");
const digestObject = (value: unknown): string => sha256(canonicalJson(value));
const exactKeys = (value: unknown, keys: readonly string[]): value is Record<string, unknown> =>
  isRecord(value) && canonicalJson(Object.keys(value).sort()) === canonicalJson([...keys].sort());
const same = (left: unknown, right: unknown): boolean => {
  try { return canonicalJson(left) === canonicalJson(right); } catch { return false; }
};

function binding(id: string, version: string, digest: string): CksManifestBindingPartV1 {
  return { id, version, digest };
}

function manifestUnsigned(options: CksRunManifestOptionsV1): Omit<CksRunManifestV1, "manifestDigest"> {
  const { profile } = options;
  const contractVersion = options.knowledge.contractVersion ?? "pansphaira.cks/knowledge-object/v1";
  return {
    schemaVersion: CKS_RUN_MANIFEST_SCHEMA_V1,
    manifestId: options.manifestId,
    manifestVersion: CKS_RUN_MANIFEST_VERSION_V1,
    profile: {
      profileId: profile.profileId,
      profileRevision: profile.profileRevision,
      profileDigest: cksOssModelProfileDigestV1(profile),
      selectionStatus: profile.selectionStatus,
    },
    task: {
      taskId: options.task.taskId,
      taskDigest: options.task.taskDigest,
      scopeDigest: options.task.scopeDigest,
    },
    bindings: {
      model: binding(profile.model.baseModelId, profile.model.artifactRevision, profile.model.artifactSha256),
      quantization: binding(`quantization:${profile.quantization.scheme.toLowerCase()}`, "1", digestObject(profile.quantization)),
      runtime: binding(`runtime:${profile.runtime.implementation}`, profile.runtime.releaseTag, profile.runtime.distributionAssetSha256),
      prompt: binding(profile.prompt.promptId, profile.prompt.promptVersion, profile.prompt.sha256),
      tool: binding(profile.toolProtocols.queryTool.protocolId, profile.toolProtocols.queryTool.protocolVersion, digestObject(profile.toolProtocols.queryTool)),
      knowledge: {
        editionId: options.knowledge.editionId,
        version: options.knowledge.version,
        digest: options.knowledge.digest,
        contractVersion,
        contractVersions: profile.knowledgeBindings.contractVersions,
      },
      verifier: options.verifier ?? binding(
        CKS_DETERMINISTIC_VERIFIER_ID_V1,
        CKS_DETERMINISTIC_VERIFIER_VERSION_V1,
        digestObject({ verifierId: CKS_DETERMINISTIC_VERIFIER_ID_V1, protocolId: CKS_DETERMINISTIC_VERIFIER_PROTOCOL_V1, version: CKS_DETERMINISTIC_VERIFIER_VERSION_V1 }),
      ),
    },
    transcriptDigests: {
      input: cksTranscriptDigestV1(options.inputTranscript),
      output: cksTranscriptDigestV1(options.outputTranscript),
    },
    execution: {
      adapterSchemaVersion: "pansphaira.cks/oss-model-adapter/v1",
      adapterVersion: CKS_RUN_MANIFEST_VERSION_V1,
      mode: CKS_NO_FINE_TUNE_MODE_V1,
      networkPolicy: CKS_NETWORK_POLICY_V1,
      weightModification: "FORBIDDEN",
      actionAuthority: CKS_RUN_MANIFEST_AUTHORITY_V1,
    },
  };
}

export function runManifestDigestV1(value: Omit<CksRunManifestV1, "manifestDigest"> | Record<string, unknown>): string {
  return digestObject(Object.fromEntries(Object.entries(value).filter(([key]) => key !== "manifestDigest")));
}

export function createCksRunManifestV1(options: CksRunManifestOptionsV1): CksRunManifestV1 {
  if (!isText(options.manifestId) || !isText(options.task.taskId) || !isDigest(options.task.taskDigest) || !isDigest(options.task.scopeDigest)) {
    throw new Error("RUN_MANIFEST_INPUT_DENIED");
  }
  if (!isText(options.knowledge.editionId) || !isText(options.knowledge.version, 64) || !isDigest(options.knowledge.digest)) {
    throw new Error("RUN_MANIFEST_KNOWLEDGE_DENIED");
  }
  const unsigned = manifestUnsigned(options);
  return { ...unsigned, manifestDigest: runManifestDigestV1(unsigned) };
}

function validPart(value: unknown): value is CksManifestBindingPartV1 {
  return exactKeys(value, ["id", "version", "digest"]) && isText(value.id) && isText(value.version, 64) && isDigest(value.digest);
}

/** Strict runtime validator used before a manifest is accepted as evidence. */
export function validateCksRunManifestV1(value: unknown): value is CksRunManifestV1 {
  if (!exactKeys(value, ["schemaVersion", "manifestId", "manifestVersion", "profile", "task", "bindings", "transcriptDigests", "execution", "manifestDigest"])) return false;
  if (value.schemaVersion !== CKS_RUN_MANIFEST_SCHEMA_V1 || value.manifestVersion !== CKS_RUN_MANIFEST_VERSION_V1 || !isText(value.manifestId) || !isDigest(value.manifestDigest)) return false;
  if (!exactKeys(value.profile, ["profileId", "profileRevision", "profileDigest", "selectionStatus"]) || !isText(value.profile.profileId) || !Number.isSafeInteger(value.profile.profileRevision) || (value.profile.profileRevision as number) < 1 || !isDigest(value.profile.profileDigest) || value.profile.selectionStatus !== "SELECTED_NOT_QUALIFIED") return false;
  if (!exactKeys(value.task, ["taskId", "taskDigest", "scopeDigest"]) || !isText(value.task.taskId) || !isDigest(value.task.taskDigest) || !isDigest(value.task.scopeDigest)) return false;
  if (!exactKeys(value.bindings, ["model", "quantization", "runtime", "prompt", "tool", "knowledge", "verifier"]) || ![value.bindings.model, value.bindings.quantization, value.bindings.runtime, value.bindings.prompt, value.bindings.tool, value.bindings.verifier].every(validPart)) return false;
  if (!exactKeys(value.bindings.knowledge, ["editionId", "version", "digest", "contractVersion", "contractVersions"]) || !isText(value.bindings.knowledge.editionId) || !isText(value.bindings.knowledge.version, 64) || !isDigest(value.bindings.knowledge.digest) || !isText(value.bindings.knowledge.contractVersion) || !isRecord(value.bindings.knowledge.contractVersions) || Object.keys(value.bindings.knowledge.contractVersions).length === 0 || !Object.values(value.bindings.knowledge.contractVersions).every((item) => isText(item, 192))) return false;
  if (!exactKeys(value.transcriptDigests, ["input", "output"]) || !isDigest(value.transcriptDigests.input) || !isDigest(value.transcriptDigests.output)) return false;
  if (!exactKeys(value.execution, ["adapterSchemaVersion", "adapterVersion", "mode", "networkPolicy", "weightModification", "actionAuthority"]) || value.execution.adapterSchemaVersion !== "pansphaira.cks/oss-model-adapter/v1" || value.execution.adapterVersion !== CKS_RUN_MANIFEST_VERSION_V1 || value.execution.mode !== CKS_NO_FINE_TUNE_MODE_V1 || value.execution.networkPolicy !== CKS_NETWORK_POLICY_V1 || value.execution.weightModification !== "FORBIDDEN" || value.execution.actionAuthority !== CKS_RUN_MANIFEST_AUTHORITY_V1) return false;
  return runManifestDigestV1(value) === value.manifestDigest;
}

export interface CksNoFineTuneTaskV1 {
  readonly taskId: string;
  readonly taskDigest: string;
  readonly scopeDigest: string;
  readonly applicability: Record<string, unknown>;
  readonly requiredPreconditions: readonly string[];
  readonly activeExclusions: readonly string[];
}

export interface CksNoFineTuneRunnerOptionsV1 {
  readonly adapter: CksLocalOssModelAdapterV1;
  readonly task: CksNoFineTuneTaskV1;
  readonly knowledge: { readonly editionId: string; readonly version: string; readonly digest: string; readonly contractVersion?: string };
  readonly input: string;
  readonly retrieve: (request: KnowledgeQueryRequestV1) => EvidencePackResultV1 | Promise<EvidencePackResultV1>;
  readonly manifestId: string;
}

export interface CksNoFineTuneRunResultV1 {
  readonly outcome: "PASS" | "ABSTAIN" | "ESCALATE" | "DENIED";
  readonly reason: string | null;
  readonly response: CompetenceResponseV1 | null;
  readonly requests: readonly KnowledgeQueryRequestV1[];
  readonly evidencePacks: readonly EvidencePackResultV1[];
  readonly inputTranscript: readonly Record<string, string>[];
  readonly outputTranscript: readonly Record<string, string>[];
  readonly manifest: CksRunManifestV1;
}

function initialRetrievalState(task: CksNoFineTuneTaskV1, knowledge: CksNoFineTuneRunnerOptionsV1["knowledge"]): RetrievalTaskStateV1 {
  return {
    taskId: task.taskId,
    knowledgeEditionId: knowledge.editionId,
    knowledgeEditionVersion: knowledge.version,
    knowledgeEditionDigest: knowledge.digest,
    applicability: task.applicability as RetrievalTaskStateV1["applicability"],
    allowedNeedKinds: [],
    allowedPreconditions: task.requiredPreconditions,
    admittedCallCount: 0,
    aggregateEvidenceBytes: 0,
  };
}

function safeOutputTranscript(value: readonly Record<string, string>[]): readonly Record<string, string>[] {
  return value.map((entry) => ({ role: entry.role ?? "unknown", content: entry.content ?? "" }));
}

/**
 * Execute the local no-fine-tune boundary. Model output is always treated as an
 * untrusted proposal; only the typed Knowledge Query can cross the retrieval
 * boundary and missing/conflicting Knowledge can never become PASS.
 */
export async function runCksNoFineTuneV1(options: CksNoFineTuneRunnerOptionsV1): Promise<CksNoFineTuneRunResultV1> {
  const inputTranscript: Record<string, string>[] = [{ role: "user", content: options.input }];
  const outputTranscript: Record<string, string>[] = [];
  const requests: KnowledgeQueryRequestV1[] = [];
  const packs: EvidencePackResultV1[] = [];
  let state = initialRetrievalState(options.task, options.knowledge);
  let turnInput = options.input;
  let response: CompetenceResponseV1 | null = null;
  let outcome: CksNoFineTuneRunResultV1["outcome"] = "DENIED";
  let reason: string | null = null;
  let unsafeKnowledge = false;

  for (let turn = 0; turn <= QUERY_LIMITS_V1.maximumCallsPerTask; turn += 1) {
    let raw: string;
    try {
      raw = await options.adapter.generate(turnInput);
    } catch {
      reason = "MODEL_EXECUTION_DENIED";
      break;
    }
    outputTranscript.push({ role: "model", content: raw });
    const toolCall = parseCksModelToolCallV1(raw);
    if (toolCall !== null) {
      const request = bindKnowledgeQueryArgumentsV1(toolCall.arguments);
      if (request === null
        || request.taskId !== options.task.taskId
        || request.knowledgeEditionId !== options.knowledge.editionId
        || request.knowledgeEditionVersion !== options.knowledge.version
        || request.knowledgeEditionDigest !== options.knowledge.digest
        || !same(request.applicability, options.task.applicability)
        || !same(request.requiredPreconditions, options.task.requiredPreconditions)) {
        reason = "REQUEST_BINDING_DENIED";
        break;
      }
      if (state.allowedNeedKinds.length === 0) state = { ...state, allowedNeedKinds: request.needKinds };
      const admission = admitKnowledgeQueryV1(state, request);
      if (admission.outcome !== "ADMITTED") {
        reason = admission.reason;
        break;
      }
      requests.push(request);
      let pack: EvidencePackResultV1;
      try {
        pack = await options.retrieve(request);
      } catch {
        reason = "KNOWLEDGE_RETRIEVAL_DENIED";
        break;
      }
      if (!validateEvidencePackResultForRequestV1(pack, request)
        || !same(pack.request, { requestId: request.requestId, requestDigest: request.requestDigest })
        || !same(pack.knowledgeEdition, { editionId: options.knowledge.editionId, version: options.knowledge.version, digest: options.knowledge.digest })
        || pack.task.scopeDigest !== options.task.scopeDigest) {
        reason = "EVIDENCE_BINDING_DENIED";
        break;
      }
      packs.push(pack);
      state = { ...state, admittedCallCount: admission.callNumber, aggregateEvidenceBytes: admission.newAggregateEvidenceBytes };
      if (["CONFLICT", "NEEDS_CONTEXT", "NO_MATCH", "DENIED"].includes(pack.status) || pack.conflicts.length > 0 || pack.missingKnowledge.length > 0) unsafeKnowledge = true;
      outputTranscript.push({ role: "tool", content: JSON.stringify(pack) });
      turnInput = JSON.stringify({ previous: raw, evidencePack: pack });
      continue;
    }
    response = parseCksCompetenceResponseV1(raw);
    if (response === null || response.taskId !== options.task.taskId) {
      reason = "FINAL_RESPONSE_DENIED";
      break;
    }
    if (unsafeKnowledge) {
      outcome = packs.some((pack) => pack.status === "CONFLICT" || pack.conflicts.length > 0) ? "ABSTAIN" : "ABSTAIN";
      reason = packs.some((pack) => pack.status === "CONFLICT" || pack.conflicts.length > 0) ? "KNOWLEDGE_CONFLICT" : "MISSING_KNOWLEDGE";
    } else if (response.state === "COMPETENCE_LIMIT") {
      outcome = "ESCALATE";
      reason = "COMPETENCE_LIMIT";
    } else if (response.state === "ANSWER_SUPPORTED" || response.state === "GOVERNED_ACTION_PROPOSAL") {
      const supportedEvidenceIds = new Set(packs.flatMap((pack) => pack.status === "MATCH" ? pack.evidence.positive.map((evidence) => evidence.id) : []));
      const hasSupportingEvidence = response.materialClaims.some((claim) => claim.evidenceIds.some((id) => supportedEvidenceIds.has(id)));
      if (requests.length === 0) {
        outcome = "ABSTAIN";
        reason = "KNOWLEDGE_RETRIEVAL_REQUIRED";
      } else if (!hasSupportingEvidence) {
        outcome = "ABSTAIN";
        reason = "INSUFFICIENT_EVIDENCE";
      } else {
        outcome = "PASS";
      }
    } else {
      outcome = "ABSTAIN";
      reason = response.state;
    }
    break;
  }

  if (outcome === "DENIED" && reason === null) reason = "RETRIEVAL_BUDGET_EXHAUSTED";
  const inputForManifest = inputTranscript;
  const outputForManifest = safeOutputTranscript(outputTranscript);
  const manifest = createCksRunManifestV1({
    manifestId: options.manifestId,
    profile: options.adapter.profile,
    task: { taskId: options.task.taskId, taskDigest: options.task.taskDigest, scopeDigest: options.task.scopeDigest },
    knowledge: options.knowledge,
    inputTranscript: inputForManifest,
    outputTranscript: outputForManifest,
  });
  return { outcome, reason, response, requests, evidencePacks: packs, inputTranscript, outputTranscript, manifest };
}

export const runNoFineTuneCksV1 = runCksNoFineTuneV1;
export const createRunManifestV1 = createCksRunManifestV1;
export const validateRunManifestV1 = validateCksRunManifestV1;
export const CKS_KNOWLEDGE_QUERY_PROTOCOL_V1 = KNOWLEDGE_QUERY_PROTOCOL_V1;
export const CKS_PROFILE_ADAPTER_DIGEST_V1 = cksOssModelProfileDigestV1;
