import assert from "node:assert/strict";
import test from "node:test";
import {
  AGENT_WORK_PROCESS_INPUT_CLAIM_BOUNDARY_V1,
  AGENT_WORK_PROCESS_INPUT_PROHIBITED_FIELDS_V1,
  AGENT_WORK_PROCESS_INPUT_SCHEMA_V1,
  agentWorkProcessInputCanonicalEventsV1,
  agentWorkProcessInputDigestV1,
  agentWorkProcessInputGenerationDigestV1,
  evaluateAgentWorkProcessInputV1,
  renderPublicAgentWorkProcessInputDecisionV1,
  type AgentWorkProcessInputV1,
} from "../packages/contracts/src/agent-work-process-input.js";

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function seal(value: Record<string, any>): AgentWorkProcessInputV1 {
  const typed = value as AgentWorkProcessInputV1;
  const generationDigest = agentWorkProcessInputGenerationDigestV1(typed);
  value.generation.generationDigest = generationDigest;
  value.generation.lkgGenerationDigest = generationDigest;
  value.inputDigest = agentWorkProcessInputDigestV1(value);
  return value as AgentWorkProcessInputV1;
}

function fixture(): AgentWorkProcessInputV1 {
  return seal({
    schemaVersion: AGENT_WORK_PROCESS_INPUT_SCHEMA_V1,
    generation: { generationId: "awi-gen:pan37-m0a-002", generationDigest: "0".repeat(64), lkgGenerationDigest: "0".repeat(64) },
    events: [
      { eventId: "awi-evt:plan-0001", phase: "PLAN", outcome: "SUCCEEDED", occurredAtMs: 1000, causeEventIds: [], evidenceDigests: ["a".repeat(64)] },
      { eventId: "awi-evt:change-0002", phase: "CHANGE", outcome: "SUCCEEDED", occurredAtMs: 2000, causeEventIds: ["awi-evt:plan-0001"], evidenceDigests: ["b".repeat(64)] },
      { eventId: "awi-evt:test-0003", phase: "TEST", outcome: "FAILED", occurredAtMs: 3000, causeEventIds: ["awi-evt:plan-0001", "awi-evt:change-0002"], evidenceDigests: ["d".repeat(64), "c".repeat(64)] },
    ],
    claimBoundary: AGENT_WORK_PROCESS_INPUT_CLAIM_BOUNDARY_V1,
    inputDigest: "0".repeat(64),
  });
}

test("accepts the exact sealed synthetic input contract", () => {
  assert.deepEqual(evaluateAgentWorkProcessInputV1(fixture()), {
    schemaVersion: "chimpmaera.agent-work-intelligence/process-input-decision/v1",
    outcome: "ACCEPTED",
    reasonCodes: ["PROCESS_INPUT_CONFORMANT"],
    claimBoundary: AGENT_WORK_PROCESS_INPUT_CLAIM_BOUNDARY_V1,
  });
});

test("canonical events ignore input, key, cause and evidence order", () => {
  const original = fixture();
  const reordered = seal(clone(original) as unknown as Record<string, any>);
  (reordered.events as any[]).reverse();
  for (const event of reordered.events as any[]) {
    event.causeEventIds.reverse();
    event.evidenceDigests.reverse();
  }
  const resealed = seal(reordered as unknown as Record<string, any>);
  assert.equal(agentWorkProcessInputCanonicalEventsV1(resealed), agentWorkProcessInputCanonicalEventsV1(original));
  assert.equal(agentWorkProcessInputGenerationDigestV1(resealed), original.generation.generationDigest);
  assert.equal(evaluateAgentWorkProcessInputV1(resealed).outcome, "ACCEPTED");
});

test("denies every prohibited privacy, prose, raw payload and path field", () => {
  for (const key of AGENT_WORK_PROCESS_INPUT_PROHIBITED_FIELDS_V1) {
    const input = clone(fixture()) as unknown as Record<string, any>;
    input.events[0][key] = "private-value";
    assert.deepEqual(evaluateAgentWorkProcessInputV1(input).reasonCodes, ["PROHIBITED_FIELD_DENIED"], key);
  }
});

test("denies schema, digest, generation, duplicate and unresolved-cause defects", () => {
  const cases: Array<[string, (value: Record<string, any>) => void, string]> = [
    ["unknown", (value) => { value.unknown = true; }, "SCHEMA_DENIED"],
    ["phase", (value) => { value.events[0].phase = "DEPLOY"; }, "SCHEMA_DENIED"],
    ["digest", (value) => { value.inputDigest = "f".repeat(64); }, "DIGEST_MISMATCH_DENIED"],
    ["generation", (value) => { value.generation.generationDigest = "f".repeat(64); value.inputDigest = agentWorkProcessInputDigestV1(value); }, "GENERATION_DIGEST_MISMATCH_DENIED"],
    ["lkg", (value) => { value.generation.lkgGenerationDigest = "e".repeat(64); value.inputDigest = agentWorkProcessInputDigestV1(value); }, "LKG_GENERATION_DIGEST_MISMATCH_DENIED"],
    ["duplicate", (value) => { value.events[1].eventId = value.events[0].eventId; seal(value); }, "DUPLICATE_EVENT_ID_DENIED"],
    ["cause", (value) => { value.events[0].causeEventIds = ["awi-evt:missing-0001"]; seal(value); }, "UNRESOLVED_CAUSE_REFERENCE_DENIED"],
  ];
  for (const [name, mutate, expected] of cases) {
    const input = clone(fixture()) as unknown as Record<string, any>;
    mutate(input);
    assert.deepEqual(evaluateAgentWorkProcessInputV1(input).reasonCodes, [expected], name);
  }
});

test("public decision contains only fixed vocabulary and no injected value", () => {
  const input = clone(fixture()) as unknown as Record<string, any>;
  input.events[0].message = "sensitive-seed-value";
  const rendered = renderPublicAgentWorkProcessInputDecisionV1(input);
  assert.doesNotMatch(rendered, /sensitive-seed-value/);
  assert.match(rendered, /PROHIBITED_FIELD_DENIED/);
  assert.match(rendered, /NO_PROCESS_MINING_NO_METRICS_NO_TRACE_ANALYSIS/);
});
