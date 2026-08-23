import assert from "node:assert/strict";
import test from "node:test";
import {
  AGENT_WORK_PROCESS_INPUT_CLAIM_BOUNDARY_V1,
  AGENT_WORK_PROCESS_INPUT_SCHEMA_V1,
  agentWorkProcessInputDigestV1,
  agentWorkProcessInputGenerationDigestV1,
  type AgentWorkProcessInputV1,
} from "../packages/contracts/src/agent-work-process-input.js";
import {
  AGENT_WORK_PROCESS_TRACE_CLAIM_BOUNDARY_V1,
  evaluateAgentWorkProcessTraceV1,
  renderPublicAgentWorkProcessTraceV1,
} from "../packages/contracts/src/agent-work-process-trace.js";

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
    generation: { generationId: "awi-gen:pan37-m0b-003", generationDigest: "0".repeat(64), lkgGenerationDigest: "0".repeat(64) },
    events: [
      { eventId: "awi-evt:test-0003", phase: "TEST", outcome: "FAILED", occurredAtMs: 3000, causeEventIds: ["awi-evt:plan-0001", "awi-evt:change-0002"], evidenceDigests: ["d".repeat(64), "c".repeat(64)] },
      { eventId: "awi-evt:review-0004", phase: "REVIEW", outcome: "SUCCEEDED", occurredAtMs: 2500, causeEventIds: ["awi-evt:plan-0001"], evidenceDigests: ["e".repeat(64)] },
      { eventId: "awi-evt:change-0002", phase: "CHANGE", outcome: "SUCCEEDED", occurredAtMs: 2000, causeEventIds: ["awi-evt:plan-0001"], evidenceDigests: ["b".repeat(64)] },
      { eventId: "awi-evt:plan-0001", phase: "PLAN", outcome: "SUCCEEDED", occurredAtMs: 1000, causeEventIds: [], evidenceDigests: ["a".repeat(64)] },
    ],
    claimBoundary: AGENT_WORK_PROCESS_INPUT_CLAIM_BOUNDARY_V1,
    inputDigest: "0".repeat(64),
  });
}

test("reconstructs a deterministic causes-first trace without metric claims", () => {
  const result = evaluateAgentWorkProcessTraceV1(fixture());
  assert.equal(result.outcome, "ACCEPTED");
  assert.equal(result.claimBoundary, AGENT_WORK_PROCESS_TRACE_CLAIM_BOUNDARY_V1);
  assert.deepEqual(result.outcome === "ACCEPTED" && result.trace.map((event) => event.eventId), [
    "awi-evt:plan-0001",
    "awi-evt:change-0002",
    "awi-evt:review-0004",
    "awi-evt:test-0003",
  ]);
  assert.equal(result.outcome, "ACCEPTED");
  assert.doesNotMatch(JSON.stringify(result.trace), /duration|bottleneck|quality|metric/i);
});

test("input, cause and evidence ordering cannot change the canonical output", () => {
  const original = fixture();
  const reordered = clone(original) as unknown as Record<string, any>;
  reordered.events.reverse();
  for (const event of reordered.events) {
    event.causeEventIds.reverse();
    event.evidenceDigests.reverse();
  }
  const resealed = seal(reordered);
  assert.equal(renderPublicAgentWorkProcessTraceV1(resealed), renderPublicAgentWorkProcessTraceV1(original));
});

test("later causes and causal cycles fail closed to fixed unknown output", () => {
  const laterCause = clone(fixture()) as unknown as Record<string, any>;
  laterCause.events.find((event: any) => event.eventId === "awi-evt:plan-0001").occurredAtMs = 4000;
  assert.deepEqual(evaluateAgentWorkProcessTraceV1(seal(laterCause)), {
    schemaVersion: "chimpmaera.agent-work-intelligence/process-trace/v1",
    outcome: "UNKNOWN",
    reasonCode: "CAUSALITY_UNKNOWN",
    claimBoundary: AGENT_WORK_PROCESS_TRACE_CLAIM_BOUNDARY_V1,
  });

  const cycle = clone(fixture()) as unknown as Record<string, any>;
  cycle.events.find((event: any) => event.eventId === "awi-evt:plan-0001").causeEventIds = ["awi-evt:test-0003"];
  cycle.events.find((event: any) => event.eventId === "awi-evt:plan-0001").occurredAtMs = 3000;
  assert.equal(evaluateAgentWorkProcessTraceV1(seal(cycle)).outcome, "UNKNOWN");
});

test("non-conformant input exposes only a fixed denial", () => {
  const input = clone(fixture()) as unknown as Record<string, any>;
  input.events[0].message = "sensitive-seed-value";
  const rendered = renderPublicAgentWorkProcessTraceV1(input);
  assert.equal(evaluateAgentWorkProcessTraceV1(input).outcome, "DENIED");
  assert.match(rendered, /INPUT_DENIED/);
  assert.doesNotMatch(rendered, /sensitive-seed-value/);
});
