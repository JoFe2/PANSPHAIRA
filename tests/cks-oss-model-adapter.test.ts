import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { readFileSync } from "node:fs";
import test from "node:test";
import Ajv2020 from "ajv/dist/2020.js";
import {
  CKS_NO_FINE_TUNE_MODE_V1,
  CKS_NETWORK_POLICY_V1,
  CksLocalOssModelAdapterV1,
  cksTranscriptDigestV1,
  parseCksModelToolCallV1,
  validateCksOssModelProfileTemplateV1,
  type CksOssModelProfileTemplateV1,
} from "../packages/competence-runtime/src/cks-oss-model-adapter.js";
import {
  createCksRunManifestV1,
  runCksNoFineTuneV1,
  validateCksRunManifestV1,
  type CksNoFineTuneTaskV1,
} from "../packages/competence-runtime/src/cks-no-finetune-runner.js";
import {
  competenceResponseDigestV1,
  evidencePackDigestV1,
  type EvidencePackResultV1,
} from "../packages/contracts/src/cks-competence-runtime.js";
import {
  generateCksSyntheticQualificationSuiteV1,
} from "../packages/contracts/src/cks-synthetic-qualification.js";

const profile = JSON.parse(readFileSync("tests/fixtures/cks-04/model-profile-template-v1.json", "utf8")) as CksOssModelProfileTemplateV1;
const transcriptFixture = JSON.parse(readFileSync("tests/fixtures/cks-04/adapter-transcript-v1.json", "utf8")) as Record<string, any>;
const queryArguments = structuredClone(transcriptFixture.modelToolCall.arguments) as any;
const qualificationSuite = generateCksSyntheticQualificationSuiteV1({
  lane: "FRESH_EPHEMERAL_CERTIFICATION", seed: randomBytes(32).toString("hex"), generatedAtMs: 1_000,
});
const qualificationTask = qualificationSuite.tasks.find((candidate) => candidate.family === "RANDOM_IDENTIFIERS")!;
queryArguments.taskId = qualificationTask.taskId;
const qualification = {
  lane: qualificationSuite.lane,
  suiteDigest: qualificationSuite.suiteDigest,
  taskDigest: qualificationTask.taskDigest,
};
const task: CksNoFineTuneTaskV1 = {
  taskId: qualificationTask.taskId,
  taskDigest: qualificationTask.taskDigest,
  scopeDigest: "8888888888888888888888888888888888888888888888888888888888888888",
  applicability: queryArguments.applicability,
  requiredPreconditions: queryArguments.requiredPreconditions,
  activeExclusions: [],
};
const knowledge = {
  editionId: queryArguments.knowledgeEditionId,
  version: queryArguments.knowledgeEditionVersion,
  digest: queryArguments.knowledgeEditionDigest,
  contractVersion: "pansphaira.cks/knowledge-object/v1",
};

function queryOutput(): string {
  return JSON.stringify({ ...transcriptFixture.modelToolCall, arguments: queryArguments });
}

function responseOutput(state: "ANSWER_SUPPORTED" | "NEED_MORE_KNOWLEDGE" | "KNOWLEDGE_CONFLICT" = "ANSWER_SUPPORTED"): string {
  const unsigned: any = {
    schemaVersion: "pansphaira.cks/competence-response/v1",
    state,
    taskId: task.taskId,
    answer: state === "ANSWER_SUPPORTED" ? "The exact supported fact." : null,
    materialClaims: state === "ANSWER_SUPPORTED" ? [{ claimId: "claim:fact", text: "The exact fact.", evidenceIds: ["evidence:fact"] }] : [],
    procedureSteps: [],
    preconditionChecks: [],
    exclusionChecks: [],
    conflicts: state === "KNOWLEDGE_CONFLICT" ? [{ conflictId: "conflict:fact", claimIds: ["claim:fact", "claim:other"] }] : [],
    missingKnowledge: state === "NEED_MORE_KNOWLEDGE" ? [{ needId: "need:fact", reasonCode: "MATERIAL_FACT_MISSING" }] : [],
    escalation: null,
    actionAuthority: "NONE",
  };
  return JSON.stringify({ ...unsigned, responseDigest: competenceResponseDigestV1(unsigned) });
}

function pack(status: EvidencePackResultV1["status"]): EvidencePackResultV1 {
  const unsigned: any = {
    schemaVersion: "pansphaira.cks/evidence-pack/v1",
    packId: "pack:cks-04-adapter",
    status,
    request: { requestId: "KQ-01", requestDigest: "pending" },
    task: { taskId: task.taskId, scopeDigest: task.scopeDigest },
    knowledgeEdition: { editionId: knowledge.editionId, version: knowledge.version, digest: knowledge.digest },
    retrievalConfiguration: { configurationId: "retrieval:cks-04-adapter", version: "1", digest: "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb" },
    claims: status === "MATCH" ? [{ claimId: "claim:fact", knowledgeObjectId: "object:fact", version: "1", digest: "9999999999999999999999999999999999999999999999999999999999999999", sourcePassageIds: ["passage:fact"] }] : [],
    applicability: { applicability: task.applicability, preconditions: [], exclusions: [], validity: { state: "VALID", validFromMs: 0, validUntilMs: null }, supersession: { state: "CURRENT", supersededBy: null } },
    evidence: { positive: status === "MATCH" ? [{ id: "evidence:fact", digest: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa" }] : [], negative: [] },
    conflicts: status === "CONFLICT" ? [{ conflictId: "conflict:fact", claimIds: ["claim:fact", "claim:other"] }] : [],
    missingKnowledge: status === "NEEDS_CONTEXT" ? [{ needId: "need:fact", reasonCode: "MATERIAL_FACT_MISSING" }] : [],
    instructionEligibility: "DATA_ONLY_NEVER_INSTRUCTIONS_CAPABILITY_OR_AUTHORITY",
    evidenceBytes: 512,
  };
  return { ...unsigned, packDigest: evidencePackDigestV1(unsigned) };
}

function adapter(outputs: readonly string[]): CksLocalOssModelAdapterV1 {
  let index = 0;
  return new CksLocalOssModelAdapterV1(profile, request => {
    assert.equal(request.mode, CKS_NO_FINE_TUNE_MODE_V1);
    assert.equal(request.networkPolicy, CKS_NETWORK_POLICY_V1);
    assert.equal(request.model.artifactFile, "qwen2.5-1.5b-instruct-q4_k_m.gguf");
    return outputs[index++] ?? outputs[outputs.length - 1]!;
  });
}

test("CKS-04 adapter accepts the selected local profile and emits one typed bounded Knowledge Query", () => {
  assert.equal(validateCksOssModelProfileTemplateV1(profile), true);
  const parsed = parseCksModelToolCallV1(queryOutput());
  assert.ok(parsed);
  assert.equal(parsed.toolName, "cks_knowledge_query");
  assert.equal(parsed.arguments.maxResults, 6);
  assert.equal(parsed.arguments.maxEvidenceBytes, 12288);
  assert.equal(parseCksModelToolCallV1(JSON.stringify({ schemaVersion: "pansphaira.cks/model-tool-call/v1", toolName: "filesystem", arguments: {} })), null);
});

test("CKS-04 runner produces a canonical manifest and PASS only for exact returned Knowledge", async () => {
  const result = await runCksNoFineTuneV1({
    adapter: adapter([queryOutput(), responseOutput()]), task, qualification, knowledge, input: transcriptFixture.input.content,
    retrieve: request => {
      assert.equal(request.requestId, "KQ-01");
      const value = pack("MATCH") as any;
      value.request.requestDigest = request.requestDigest;
      value.packDigest = evidencePackDigestV1(value);
      return value;
    }, manifestId: "run:cks-04-adapter-success",
  });
  assert.equal(result.outcome, "PASS");
  assert.equal(result.requests.length, 1);
  assert.equal(result.evidencePacks.length, 1);
  assert.equal(validateCksRunManifestV1(result.manifest), true);
  assert.equal(result.manifest.bindings.model.version, profile.model.artifactRevision);
  assert.equal(result.manifest.bindings.quantization.id, "quantization:q4_k_m");
  assert.equal(result.manifest.bindings.runtime.version, "b10661");
  assert.equal(result.manifest.bindings.prompt.version, "1");
  assert.equal(result.manifest.bindings.tool.version, "1");
  assert.equal(result.manifest.bindings.knowledge.version, "1");
  assert.equal(result.manifest.bindings.verifier.version, "1");
  assert.equal(result.manifest.bindings.qualificationSuite.lane, qualification.lane);
  assert.equal(result.manifest.bindings.qualificationSuite.suiteDigest, qualification.suiteDigest);
  assert.equal(result.manifest.bindings.qualificationSuite.taskDigest, task.taskDigest);
  assert.equal(result.manifest.transcriptDigests.input, cksTranscriptDigestV1(result.inputTranscript));
  assert.equal(result.manifest.transcriptDigests.output, cksTranscriptDigestV1(result.outputTranscript));

  const schema = JSON.parse(readFileSync("schemas/contracts/cks-run-manifest-v1.schema.json", "utf8"));
  const validate = new Ajv2020({ strict: true }).compile(schema);
  assert.equal(validate(result.manifest), true, JSON.stringify(validate.errors));
  assert.equal(validate({ ...result.manifest, unexpected: true }), false);
});

test("CKS-04 missing or conflicting Knowledge is fail-closed abstention", async () => {
  for (const [status, responseState, reason] of [["NEEDS_CONTEXT", "NEED_MORE_KNOWLEDGE", "MISSING_KNOWLEDGE"], ["CONFLICT", "KNOWLEDGE_CONFLICT", "KNOWLEDGE_CONFLICT"]] as const) {
    const result = await runCksNoFineTuneV1({
      adapter: adapter([queryOutput(), responseOutput(responseState)]), task, qualification, knowledge, input: transcriptFixture.input.content,
      retrieve: request => {
        const value = pack(status) as any;
        value.request.requestDigest = request.requestDigest;
        value.packDigest = evidencePackDigestV1(value);
        return value;
      }, manifestId: `run:cks-04-adapter-${status.toLowerCase()}`,
    });
    assert.equal(result.outcome, "ABSTAIN");
    assert.equal(result.reason, reason);
    assert.notEqual(result.outcome, "PASS");
    assert.equal(validateCksRunManifestV1(result.manifest), true);
  }
});

test("CKS-04 manifest factory rejects unbound Knowledge and tampering", () => {
  const manifest = createCksRunManifestV1({ manifestId: "run:factory", profile, task, qualification, knowledge, inputTranscript: ["input"], outputTranscript: ["output"] });
  assert.equal(validateCksRunManifestV1(manifest), true);
  assert.equal(validateCksRunManifestV1({ ...manifest, bindings: { ...manifest.bindings, knowledge: { ...manifest.bindings.knowledge, version: "2" } } }), false);
  assert.equal(validateCksRunManifestV1({ ...manifest, bindings: { ...manifest.bindings, qualificationSuite: { ...manifest.bindings.qualificationSuite, suiteDigest: "0".repeat(64) } } }), false);
  assert.throws(() => createCksRunManifestV1({ manifestId: "run:bad", profile, task, qualification, knowledge: { ...knowledge, digest: "not-a-digest" }, inputTranscript: ["input"], outputTranscript: ["output"] }), /RUN_MANIFEST_KNOWLEDGE_DENIED/);
});
