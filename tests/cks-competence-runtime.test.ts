import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import Ajv2020 from "ajv/dist/2020.js";
import {
  COMPETENCE_STATES_V1,
  EVIDENCE_PACK_INSTRUCTION_ELIGIBILITY,
  MODEL_TOOL_CALL_SCHEMA_V1,
  QUERY_LIMITS_V1,
  admitKnowledgeQueryV1,
  buildCksCompetenceRuntimeContractV1,
  competenceResponseDigestV1,
  knowledgeQueryRequestDigestV1,
  resolveCompetenceStateV1,
  validateCksCompetenceRuntimeContractV1,
  validateCksModelToolCallV1,
  validateCompetenceResponseV1,
  validateKnowledgeQueryRequestV1,
  type CompetenceResponseV1,
  type KnowledgeQueryRequestV1,
} from "../packages/contracts/src/cks-competence-runtime.js";
import { APPLICABILITY_DIMENSIONS_V1, type ApplicabilityScopeV1 } from "../packages/contracts/src/knowledge-quality.js";

const fixture = JSON.parse(readFileSync("tests/fixtures/cks-04/runtime-contract-v1.json", "utf8")) as Record<string, unknown>;
const scope = (): ApplicabilityScopeV1 => Object.fromEntries(
  APPLICABILITY_DIMENSIONS_V1.map((dimension) => [dimension, { state: "NOT_PROVIDED", values: [], provenance: null }]),
) as ApplicabilityScopeV1;

const request = (requestId: "KQ-01" | "KQ-02" | "KQ-03" = "KQ-01"): KnowledgeQueryRequestV1 => {
  const unsigned: Omit<KnowledgeQueryRequestV1, "requestDigest"> = {
    schemaVersion: "pansphaira.cks/knowledge-query/v1",
    requestId,
    taskId: "task:cks-04-runtime",
    knowledgeEditionId: "fixture:cks-04-knowledge",
    knowledgeEditionVersion: "1",
    knowledgeEditionDigest: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
    needKinds: ["FACT"],
    queryText: "Which exact Knowledge fact is required for this task?",
    applicability: scope(),
    requiredPreconditions: ["precondition-a"],
    maxResults: QUERY_LIMITS_V1.maximumResultsPerCall,
    maxEvidenceBytes: QUERY_LIMITS_V1.maximumEvidenceBytesPerCall,
    reasonCode: "MATERIAL_FACT_MISSING",
  };
  return { ...unsigned, requestDigest: knowledgeQueryRequestDigestV1(unsigned) };
};

const response = (state: CompetenceResponseV1["state"]): CompetenceResponseV1 => {
  const unsigned: Omit<CompetenceResponseV1, "responseDigest"> = {
    schemaVersion: "pansphaira.cks/competence-response/v1",
    state,
    taskId: "task:cks-04-runtime",
    answer: state === "ANSWER_SUPPORTED" ? "The supported answer." : state === "GOVERNED_ACTION_PROPOSAL" ? "A proposal only." : null,
    materialClaims: [],
    procedureSteps: [],
    preconditionChecks: [],
    exclusionChecks: [],
    conflicts: state === "KNOWLEDGE_CONFLICT" ? [{ conflictId: "conflict-a", claimIds: ["claim-a", "claim-b"] }] : [],
    missingKnowledge: state === "NEED_MORE_KNOWLEDGE" || state === "INSUFFICIENT_EVIDENCE" ? [{ needId: "need-a", reasonCode: "MATERIAL_FACT_MISSING" }] : [],
    escalation: state === "COMPETENCE_LIMIT" ? { required: true, target: "human-review" } : null,
    actionAuthority: "NONE",
  };
  return { ...unsigned, responseDigest: competenceResponseDigestV1(unsigned) };
};

test("CKS-04 runtime fixture is closed, digest-bound, and binds the selected profile", () => {
  assert.equal(validateCksCompetenceRuntimeContractV1(fixture), true);
  assert.deepEqual(fixture.states, [...COMPETENCE_STATES_V1]);
  assert.equal((fixture.model as Record<string, unknown>).artifactFile, "qwen2.5-1.5b-instruct-q4_k_m.gguf");
  assert.equal((fixture.quantization as Record<string, unknown>).scheme, "Q4_K_M");
  assert.equal((fixture.runtime as Record<string, unknown>).releaseTag, "b10661");
  assert.equal((fixture.prompt as Record<string, unknown>).promptVersion, "1");
  assert.equal((fixture.toolProtocols as Record<string, unknown>).unknownToolsOrFields, "DENY");
  assert.equal((fixture.knowledgeBindings as Record<string, unknown>).onlineFallback, "FORBIDDEN");
});

test("CKS-04 construction binds the authoritative decision receipt without qualification claims", () => {
  const receipt = JSON.parse(readFileSync("docs/evidence/conveyor/sol-psai284-model-profile-decision-01.json", "utf8")) as {
    receiptDigest: string;
    decision: { decisionId: string; profileCoreDigest: string; selectedProfile: Record<string, unknown> };
  };
  const contract = buildCksCompetenceRuntimeContractV1({
    receiptPath: "docs/evidence/conveyor/sol-psai284-model-profile-decision-01.json",
    receiptDigest: receipt.receiptDigest,
    profileCoreDigest: receipt.decision.profileCoreDigest,
    decisionId: receipt.decision.decisionId,
    selectedProfile: receipt.decision.selectedProfile,
  });
  assert.equal(validateCksCompetenceRuntimeContractV1(contract), true);
  assert.equal(contract.profile.selectionStatus, "SELECTED_NOT_QUALIFIED");
  assert.equal(contract.model.artifactRevision, "91cad51170dc346986eccefdc2dd33a9da36ead9");
  assert.equal(contract.quantization.scheme, "Q4_K_M");
  assert.equal(contract.runtime.releaseTag, "b10661");
  assert.equal(contract.prompt.sha256, "56d5e03a35b215c37afeb1056c8f55052357d5c1acd420ea01d0ccb67ee89493");
  assert.equal(contract.toolProtocols.queryTool.protocolId, "pansphaira.cks/knowledge-query/v1");
  assert.equal(contract.knowledgeBindings.contractVersions.knowledgeQuery, "pansphaira.cks/knowledge-query/v1");
});

test("CKS-04 schemas are strict and expose exactly one model-callable retrieval tool", () => {
  const runtimeSchema = JSON.parse(readFileSync("schemas/contracts/cks-competence-runtime-v1.schema.json", "utf8")) as Record<string, any>;
  const toolSchema = JSON.parse(readFileSync("schemas/contracts/cks-model-tool-call-v1.schema.json", "utf8")) as Record<string, any>;
  const ajv = new Ajv2020({ strict: true });
  const validateRuntime = ajv.compile(runtimeSchema);
  const validateTool = ajv.compile(toolSchema);
  assert.equal(validateRuntime(fixture), true, JSON.stringify(validateRuntime.errors));
  assert.equal(toolSchema.additionalProperties, false);
  assert.equal(toolSchema.properties.toolName.const, "cks_knowledge_query");
  assert.equal(toolSchema.properties.arguments.$ref, "#/$defs/query");
  assert.equal(validateTool({ schemaVersion: MODEL_TOOL_CALL_SCHEMA_V1, toolName: "cks_knowledge_query", arguments: request() }), true, JSON.stringify(validateTool.errors));
  const wireRequest = { ...request() } as Record<string, unknown>;
  delete wireRequest.requestDigest;
  assert.equal(validateTool({ schemaVersion: MODEL_TOOL_CALL_SCHEMA_V1, toolName: "cks_knowledge_query", arguments: wireRequest }), false);
  assert.equal(validateTool({ schemaVersion: MODEL_TOOL_CALL_SCHEMA_V1, toolName: "filesystem", arguments: request() }), false);
  assert.equal(validateRuntime({ ...fixture, unexpected: true }), false);
});

test("CKS-04 detects an information need and admits only bounded monotonic queries", () => {
  const first = request();
  assert.equal(validateKnowledgeQueryRequestV1(first), true);
  assert.equal(validateCksModelToolCallV1({ schemaVersion: MODEL_TOOL_CALL_SCHEMA_V1, toolName: "cks_knowledge_query", arguments: first }), true);
  assert.deepEqual(admitKnowledgeQueryV1({ taskId: first.taskId, admittedCallCount: 0, aggregateEvidenceBytes: 0 }, first), {
    outcome: "ADMITTED", callNumber: 1, newAggregateEvidenceBytes: QUERY_LIMITS_V1.maximumEvidenceBytesPerCall,
  });
  assert.equal(admitKnowledgeQueryV1({ taskId: first.taskId, admittedCallCount: 0, aggregateEvidenceBytes: 0 }, request("KQ-02")).reason, "REQUEST_ID_NOT_MONOTONIC");
  const tooLarge = { ...first, maxEvidenceBytes: QUERY_LIMITS_V1.maximumEvidenceBytesPerCall + 1 };
  tooLarge.requestDigest = knowledgeQueryRequestDigestV1(tooLarge);
  assert.equal(validateKnowledgeQueryRequestV1(tooLarge), false);
  assert.equal(admitKnowledgeQueryV1({ taskId: first.taskId, admittedCallCount: 0, aggregateEvidenceBytes: 0 }, tooLarge).reason, "QUERY_MALFORMED");
  assert.equal(admitKnowledgeQueryV1({ taskId: first.taskId, admittedCallCount: 3, aggregateEvidenceBytes: 0 }, first).reason, "CALL_BUDGET_EXHAUSTED");
});

test("CKS-04 response validation represents all six states and fails closed on missing or conflicting Knowledge", () => {
  for (const state of COMPETENCE_STATES_V1) assert.equal(validateCompetenceResponseV1(response(state)), true, state);
  assert.equal(resolveCompetenceStateV1({ allMaterialClaimsCovered: false, allProcedureStepsCovered: false, preconditionsChecked: false, exclusionsChecked: false, conflictsPresent: false, materialKnowledgeMissing: true, differentiatingRetrievalAvailable: true, retrievalCallsExhausted: false, taskWithinProfile: true }), "NEED_MORE_KNOWLEDGE");
  assert.equal(resolveCompetenceStateV1({ allMaterialClaimsCovered: true, allProcedureStepsCovered: true, preconditionsChecked: true, exclusionsChecked: true, conflictsPresent: true, materialKnowledgeMissing: false, differentiatingRetrievalAvailable: false, retrievalCallsExhausted: false, taskWithinProfile: true }), "KNOWLEDGE_CONFLICT");
  assert.equal(resolveCompetenceStateV1({ allMaterialClaimsCovered: false, allProcedureStepsCovered: false, preconditionsChecked: false, exclusionsChecked: false, conflictsPresent: false, materialKnowledgeMissing: true, differentiatingRetrievalAvailable: true, retrievalCallsExhausted: true, taskWithinProfile: true }), "INSUFFICIENT_EVIDENCE");
  const answer = response("ANSWER_SUPPORTED");
  assert.equal(validateCompetenceResponseV1({ ...answer, actionAuthority: "EXECUTE" }), false);
  assert.equal(EVIDENCE_PACK_INSTRUCTION_ELIGIBILITY, "DATA_ONLY_NEVER_INSTRUCTIONS_CAPABILITY_OR_AUTHORITY");
});
