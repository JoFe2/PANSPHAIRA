import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import Ajv2020 from "ajv/dist/2020.js";
import {
  admitCapabilityExecutionAtGatewayV1,
  canonicalJson,
  executeCapabilityAtBrokerV1,
  listCapabilityCatalogueV1,
  syntheticCapabilityActivationV1,
  syntheticCapabilityCatalogueV1,
  syntheticCapabilityExecutionRequestV1,
  syntheticCapabilityPolicyBindingV1,
  verifyCapabilityActivationV1,
  verifyCapabilityCatalogueV1,
  verifyCapabilityGatewayDecisionV1,
  type CapabilityBrokerReceiptV1,
  type CapabilityDecisionIssueV1,
  type CapabilityGatewayDecisionV1,
  type CapabilityMonotonicClockV1,
  type CapabilityReplayStoreV1,
  type SyntheticCapabilityExecutorV1,
} from "../packages/contracts/src/index.js";

const OBSERVED_AT = "2026-08-09T12:00:00Z";
function mutate<T>(value: T, change: (draft: Record<string, any>) => void): unknown {
  const draft = structuredClone(value) as Record<string, any>;
  change(draft);
  return draft;
}

function sha256(value: unknown): string {
  return createHash("sha256").update(canonicalJson(value)).digest("hex");
}

function redigest<T>(value: T): unknown {
  const draft = structuredClone(value) as Record<string, any>;
  delete draft.digest;
  draft.digest = sha256(draft);
  return draft;
}

function setup() {
  const catalogue = syntheticCapabilityCatalogueV1();
  const activation = syntheticCapabilityActivationV1(catalogue);
  const policy = syntheticCapabilityPolicyBindingV1();
  const request = syntheticCapabilityExecutionRequestV1(catalogue, "crm.contact.create", policy);
  return { catalogue, activation, policy, request };
}

function clock(...values: number[]): CapabilityMonotonicClockV1 {
  let index = 0;
  return { nowMs: () => values[Math.min(index++, values.length - 1)] ?? Number.NaN };
}

test("AAS-012 public schema and synthetic fixture match the canonical catalogue", () => {
  const schema = JSON.parse(readFileSync(
    "schemas/contracts/capability-catalogue-v1.schema.json",
    "utf8",
  )) as object;
  const fixture = JSON.parse(readFileSync(
    "tests/fixtures/capability-catalogue/synthetic-catalogue-v1.json",
    "utf8",
  )) as unknown;
  const validate = new Ajv2020({ allErrors: true, strict: true }).compile(schema);
  assert.equal(validate(fixture), true, JSON.stringify(validate.errors));
  assert.deepEqual(fixture, syntheticCapabilityCatalogueV1());
  assert.throws(() => verifyCapabilityCatalogueV1(
    mutate(fixture, (draft) => { draft.actions[0].requestSchema.additionalProperties = true; }),
  ), /DENIED/);

  const duplicateAction = mutate(fixture, (draft) => {
    draft.actions[1] = structuredClone(draft.actions[0]);
  });
  assert.equal(validate(duplicateAction), false, "duplicate CRM entry must fail schema-only validation");

  const crossPaired = mutate(fixture, (draft) => {
    draft.actions[0].resource = "synthetic.erp.order";
    draft.actions[0].requestSchema = structuredClone(draft.actions[1].requestSchema);
    draft.actions[0].responseSchema = structuredClone(draft.actions[1].responseSchema);
  });
  assert.equal(validate(crossPaired), false, "cross-paired CRM identity and ERP surface must fail schema-only validation");
});

function gateway(
  changes?: (draft: Record<string, any>) => void,
  activationChange?: (draft: Record<string, any>) => void,
  policyChange?: (draft: Record<string, any>) => void,
): CapabilityGatewayDecisionV1 {
  const { catalogue, activation, policy, request } = setup();
  const changedRequest = changes === undefined ? request : mutate(request, changes);
  const changedActivation = activationChange === undefined
    ? activation
    : redigest(mutate(activation, activationChange));
  const changedPolicy = policyChange === undefined
    ? policy
    : redigest(mutate(policy, policyChange));
  return admitCapabilityExecutionAtGatewayV1(
    catalogue,
    changedActivation,
    changedPolicy,
    changedRequest,
    OBSERVED_AT,
  );
}

test("AAS-012 catalogue is finite, strict, digest-bound and inactive by default", () => {
  const catalogue = verifyCapabilityCatalogueV1(syntheticCapabilityCatalogueV1());
  assert.equal(catalogue.actions.length, 3);
  assert.match(catalogue.digest, /^[a-f0-9]{64}$/);
  assert.deepEqual(catalogue.actions.map(({ actionId }) => actionId), [
    "crm.contact.create",
    "erp.order.create",
    "employee.directory.read_own",
  ]);
  for (const action of catalogue.actions) {
    assert.equal(action.version, "1.0.0");
    assert.match(action.digest, /^[a-f0-9]{64}$/);
    assert.equal(action.activationState, "INACTIVE");
    assert.equal(action.requestSchema.additionalProperties, false);
    assert.equal(action.responseSchema.additionalProperties, false);
    assert.deepEqual(action.resourceBounds, {
      maxRequestBytes: 512,
      maxResponseBytes: 512,
      maxExecutionMs: 1000,
      maxInvocations: 1,
    });
    assert.equal(action.evidenceContract.required, true);
    assert.deepEqual(action.evidenceContract.allowedSinkTypes, ["SYNTHETIC_MEMORY"]);
    assert.ok(action.limitations.includes("CATALOGUE_ADMISSION_DOES_NOT_ESTABLISH_SAFETY"));
  }

  for (const [label, changed] of [
    ["unknown catalogue field", mutate(catalogue, (draft) => { draft.discovered = true; })],
    ["active catalogue entry", mutate(catalogue, (draft) => { draft.actions[0].activationState = "ACTIVE"; })],
    ["entry digest mismatch", mutate(catalogue, (draft) => { draft.actions[0].digest = "0".repeat(64); })],
    ["catalogue digest mismatch", mutate(catalogue, (draft) => { draft.digest = "0".repeat(64); })],
  ] as const) assert.throws(() => verifyCapabilityCatalogueV1(changed), /DENIED/, label);
});

test("AAS-012 presence, install-shaped listing and admission never imply activation", () => {
  const { catalogue, policy, request } = setup();
  const listed = listCapabilityCatalogueV1(catalogue);
  assert.equal(listed.catalogueVersion, "1.0.0");
  assert.equal(listed.catalogueDigest, catalogue.digest);
  assert.equal(listed.activationAuthority, false);
  assert.equal(listed.executionAuthority, false);
  assert.ok(listed.entries.every(({ activationState }) => activationState === "INACTIVE"));

  const denied = admitCapabilityExecutionAtGatewayV1(
    catalogue,
    null,
    policy,
    request,
    OBSERVED_AT,
  );
  assert.equal(denied.outcome, "DENY");
  assert.equal(denied.ticket, null);
  assert.deepEqual(denied.issues, ["ACTIVATION_AUTHORIZATION_INVALID_DENIED"]);
});

test("AAS-012 exact separately authorized entry passes gateway and broker once", () => {
  const { catalogue, activation, policy, request } = setup();
  verifyCapabilityActivationV1(activation, catalogue, policy, OBSERVED_AT);
  const decision = admitCapabilityExecutionAtGatewayV1(
    catalogue, activation, policy, request, OBSERVED_AT,
  );
  assert.equal(decision.outcome, "ALLOW");
  assert.deepEqual(decision.issues, []);
  assert.equal(decision.catalogueVersion, catalogue.version);
  assert.equal(decision.catalogueDigest, catalogue.digest);
  assert.equal(decision.actionDigest, catalogue.actions[0]?.digest);
  assert.equal(decision.ticket?.policyDigest, policy.digest);
  assert.equal(decision.correlationDigest, sha256(request.correlationId));
  assert.equal(JSON.stringify(decision).includes(request.correlationId), false);
  assert.equal(verifyCapabilityGatewayDecisionV1(decision).decisionDigest, decision.decisionDigest);

  let effects = 0;
  const executor: SyntheticCapabilityExecutorV1 = {
    prepare: () => ({ response: { contactId: "synthetic-contact-001" }, commit: () => { effects += 1; } }),
  };
  const replayStore: CapabilityReplayStoreV1 = new Map();
  const receipt = executeCapabilityAtBrokerV1(
    catalogue, activation, policy, decision, OBSERVED_AT, replayStore, executor, clock(10, 1010),
  );
  assert.equal(receipt.outcome, "EXECUTED");
  assert.equal(receipt.effectCount, 1);
  assert.equal(receipt.effectState, "CONFIRMED_ONE");
  assert.equal(effects, 1);
  assert.equal(receipt.catalogueVersion, catalogue.version);
  assert.equal(receipt.catalogueDigest, catalogue.digest);
  assert.equal(receipt.correlationDigest, decision.correlationDigest);
  assert.match(receipt.receiptDigest, /^[a-f0-9]{64}$/);

  const replay = executeCapabilityAtBrokerV1(
    catalogue, activation, policy, decision, OBSERVED_AT, replayStore, executor,
  );
  assertDeniedReceipt(replay, "REPLAY_CONSUMED_DENIED");
  assert.equal(effects, 1);
});

test("AAS-012 admits the bounded M1.2 correlation format without widening malformed IDs", () => {
  const { catalogue, activation, policy, request } = setup();
  const compatible = mutate(request, (draft) => {
    draft.correlationId = "corr-aas035-openclaw-m14-oracle-0001";
  });
  const allowed = admitCapabilityExecutionAtGatewayV1(
    catalogue, activation, policy, compatible, OBSERVED_AT,
  );
  assert.equal(allowed.outcome, "ALLOW");
  assert.equal(JSON.stringify(allowed).includes("corr-aas035"), false);

  for (const correlationId of ["corr-aas035-short", "corr-other-openclaw-m14-oracle-0001", "corr-aas035-UPPERCASE-0001"]) {
    const denied = admitCapabilityExecutionAtGatewayV1(
      catalogue,
      activation,
      policy,
      mutate(request, (draft) => { draft.correlationId = correlationId; }),
      OBSERVED_AT,
    );
    assert.equal(denied.outcome, "DENY");
    assert.deepEqual(denied.issues, ["REQUEST_SCHEMA_INVALID_DENIED"]);
  }
});

function assertDeniedGateway(
  decision: CapabilityGatewayDecisionV1,
  issue: CapabilityDecisionIssueV1,
  label: string,
): void {
  assert.equal(decision.outcome, "DENY", label);
  assert.equal(decision.ticket, null, label);
  assert.equal(decision.issues.includes(issue), true, label);
  assert.equal(decision.catalogueVersion, typeof decision.catalogueVersion === "string" ? decision.catalogueVersion : null);
  assert.match(decision.decisionDigest, /^[a-f0-9]{64}$/, label);
}

function assertDeniedReceipt(receipt: CapabilityBrokerReceiptV1, issue: CapabilityDecisionIssueV1): void {
  assert.equal(receipt.outcome, "DENY");
  assert.equal(receipt.effectCount, 0);
  assert.equal(receipt.effectState, "NONE");
  assert.equal(receipt.response, null);
  assert.equal(receipt.issues.includes(issue), true);
  assert.match(receipt.receiptDigest, /^[a-f0-9]{64}$/);
}

test("AAS-012 required gateway negative probes fail closed without effect", () => {
  const probes: readonly [string, (draft: Record<string, any>) => void, CapabilityDecisionIssueV1][] = [
    ["unknown action", (draft) => { draft.actionId = "shell.exec"; }, "ACTION_UNKNOWN_DENIED"],
    ["unknown field", (draft) => { draft.request.secret = "synthetic"; }, "REQUEST_SCHEMA_INVALID_DENIED"],
    ["unknown resource", (draft) => { draft.resource = "host.filesystem"; }, "REQUEST_RESOURCE_DENIED"],
    ["stale catalogue version", (draft) => { draft.catalogueVersion = "0.9.0"; }, "CATALOGUE_VERSION_STALE_DENIED"],
    ["catalogue digest mismatch", (draft) => { draft.catalogueDigest = "0".repeat(64); }, "CATALOGUE_DIGEST_MISMATCH_DENIED"],
    ["stale action version", (draft) => { draft.actionVersion = "0.9.0"; }, "ACTION_VERSION_STALE_DENIED"],
    ["action digest mismatch", (draft) => { draft.actionDigest = "0".repeat(64); }, "ACTION_DIGEST_MISMATCH_DENIED"],
    ["cross tenant", (draft) => { draft.tenant = "tenant:synthetic-other"; }, "CROSS_TENANT_DENIED"],
    ["schema invalid", (draft) => { draft.request.email = "not-a-fixture-address"; }, "REQUEST_SCHEMA_INVALID_DENIED"],
    ["missing policy", (draft) => { delete draft.policyDigest; }, "POLICY_MISSING_DENIED"],
    ["missing identity", (draft) => { delete draft.userIdentity; }, "IDENTITY_MISSING_DENIED"],
    ["missing correlation", (draft) => { delete draft.correlationId; }, "CORRELATION_MISSING_DENIED"],
    ["missing evidence sink", (draft) => { delete draft.evidenceSink; }, "EVIDENCE_SINK_MISSING_DENIED"],
  ];
  for (const [label, change, issue] of probes) assertDeniedGateway(gateway(change), issue, label);

  assertDeniedGateway(
    gateway(undefined, (draft) => { draft.expiresAt = "2026-08-09T11:59:59Z"; }),
    "ACTIVATION_STALE_DENIED",
    "stale activation",
  );
  assertDeniedGateway(
    gateway(undefined, (draft) => { draft.maintainerId = "maintainer:untrusted"; }),
    "ACTIVATION_AUTHORIZATION_INVALID_DENIED",
    "untrusted maintainer",
  );
  assertDeniedGateway(
    gateway(undefined, (draft) => { draft.activationState = "INACTIVE"; }),
    "ACTIVATION_AUTHORIZATION_INVALID_DENIED",
    "inactive authorization",
  );

  assertDeniedGateway(
    gateway((draft) => { draft.policyDigest = "0".repeat(64); }),
    "POLICY_BINDING_MISMATCH_DENIED",
    "different requested policy",
  );
  assertDeniedGateway(
    gateway(undefined, undefined, (draft) => { draft.expiresAt = "2026-08-09T11:59:59Z"; }),
    "POLICY_STALE_DENIED",
    "stale trusted policy",
  );

  const { catalogue, activation, request } = setup();
  assertDeniedGateway(
    admitCapabilityExecutionAtGatewayV1(catalogue, activation, null, request, OBSERVED_AT),
    "POLICY_MISSING_DENIED",
    "missing policy object",
  );
});

test("AAS-012 broker revalidates policy, bindings and response before any mutation", () => {
  const { catalogue, activation, policy, request } = setup();
  const decision = admitCapabilityExecutionAtGatewayV1(
    catalogue, activation, policy, request, OBSERVED_AT,
  );
  assert.equal(decision.outcome, "ALLOW");
  let effects = 0;
  const invalidResponseExecutor: SyntheticCapabilityExecutorV1 = {
    prepare: () => ({ response: { contactId: "provider-shaped-live-id" }, commit: () => { effects += 1; } }),
  };
  const invalidResponse = executeCapabilityAtBrokerV1(
    catalogue, activation, policy, decision, OBSERVED_AT, new Map(), invalidResponseExecutor,
  );
  assertDeniedReceipt(invalidResponse, "RESPONSE_SCHEMA_INVALID_DENIED");
  assert.equal(effects, 0);

  const tampered = mutate(decision, (draft) => { draft.ticket.actionDigest = "0".repeat(64); });
  const tamperedReceipt = executeCapabilityAtBrokerV1(
    catalogue, activation, policy, tampered, OBSERVED_AT, new Map(), invalidResponseExecutor,
  );
  assertDeniedReceipt(tamperedReceipt, "BROKER_DECISION_INVALID_DENIED");
  assert.equal(effects, 0);

  const staleActivation = redigest(mutate(activation, (draft) => {
    draft.expiresAt = "2026-08-09T11:59:59Z";
  }));
  const staleReceipt = executeCapabilityAtBrokerV1(
    catalogue, staleActivation, policy, decision, OBSERVED_AT, new Map(), invalidResponseExecutor,
  );
  assertDeniedReceipt(staleReceipt, "ACTIVATION_STALE_DENIED");
  assert.equal(effects, 0);

  const differentPolicy = redigest(mutate(policy, (draft) => { draft.policyId = "policy:synthetic-different"; }));
  assertDeniedReceipt(executeCapabilityAtBrokerV1(
    catalogue, activation, differentPolicy, decision, OBSERVED_AT, new Map(), invalidResponseExecutor,
  ), "POLICY_BINDING_MISMATCH_DENIED");
  assertDeniedReceipt(executeCapabilityAtBrokerV1(
    catalogue, activation, null, decision, OBSERVED_AT, new Map(), invalidResponseExecutor,
  ), "POLICY_MISSING_DENIED");
  const stalePolicy = redigest(mutate(policy, (draft) => { draft.expiresAt = "2026-08-09T11:59:59Z"; }));
  assertDeniedReceipt(executeCapabilityAtBrokerV1(
    catalogue, activation, stalePolicy, decision, OBSERVED_AT, new Map(), invalidResponseExecutor,
  ), "POLICY_STALE_DENIED");
  assert.equal(effects, 0);
});

test("AAS-012 synchronous prepare bound denies before commit with an injectable monotonic clock", () => {
  const { catalogue, activation, policy, request } = setup();
  const decision = admitCapabilityExecutionAtGatewayV1(
    catalogue, activation, policy, request, OBSERVED_AT,
  );
  let effects = 0;
  const executor: SyntheticCapabilityExecutorV1 = {
    prepare: () => ({
      response: { contactId: "synthetic-contact-002" },
      commit: () => { effects += 1; },
    }),
  };
  const replayStore: CapabilityReplayStoreV1 = new Map();
  const slow = executeCapabilityAtBrokerV1(
    catalogue, activation, policy, decision, OBSERVED_AT, replayStore, executor, clock(0, 1001),
  );
  assertDeniedReceipt(slow, "RESOURCE_BOUNDS_DENIED");
  assert.equal(effects, 0);
  assert.equal(replayStore.has(request.requestId), false);
});

test("AAS-012 replay reservation blocks reentrancy and consumes ambiguous commit failures", () => {
  const { catalogue, activation, policy, request } = setup();
  const decision = admitCapabilityExecutionAtGatewayV1(
    catalogue, activation, policy, request, OBSERVED_AT,
  );
  const replayStore: CapabilityReplayStoreV1 = new Map();
  let effects = 0;
  let nested: CapabilityBrokerReceiptV1 | null = null;
  const reentrantExecutor: SyntheticCapabilityExecutorV1 = {
    prepare: () => ({
      response: { contactId: "synthetic-contact-003" },
      commit: () => {
        nested = executeCapabilityAtBrokerV1(
          catalogue, activation, policy, decision, OBSERVED_AT, replayStore, reentrantExecutor,
        );
        effects += 1;
      },
    }),
  };
  const outer = executeCapabilityAtBrokerV1(
    catalogue, activation, policy, decision, OBSERVED_AT, replayStore, reentrantExecutor, clock(0, 1),
  );
  assert.equal(outer.outcome, "EXECUTED");
  assert.equal(effects, 1);
  assert.ok(nested !== null);
  assertDeniedReceipt(nested, "REPLAY_IN_FLIGHT_DENIED");
  assert.equal(replayStore.get(request.requestId), "CONSUMED");

  const ambiguousStore: CapabilityReplayStoreV1 = new Map();
  let ambiguousEffects = 0;
  const throwingExecutor: SyntheticCapabilityExecutorV1 = {
    prepare: () => ({
      response: { contactId: "synthetic-contact-004" },
      commit: () => {
        ambiguousEffects += 1;
        throw new Error("synthetic commit acknowledgement lost");
      },
    }),
  };
  const ambiguous = executeCapabilityAtBrokerV1(
    catalogue, activation, policy, decision, OBSERVED_AT, ambiguousStore, throwingExecutor, clock(0, 1),
  );
  assert.equal(ambiguous.outcome, "AMBIGUOUS");
  assert.equal(ambiguous.effectCount, null);
  assert.equal(ambiguous.effectState, "AMBIGUOUS_CONSUMED");
  assert.deepEqual(ambiguous.issues, ["SYNTHETIC_COMMIT_AMBIGUOUS_CONSUMED"]);
  assert.equal(ambiguousEffects, 1);
  assert.equal(ambiguousStore.get(request.requestId), "CONSUMED");

  const retry = executeCapabilityAtBrokerV1(
    catalogue, activation, policy, decision, OBSERVED_AT, ambiguousStore, throwingExecutor,
  );
  assertDeniedReceipt(retry, "REPLAY_CONSUMED_DENIED");
  assert.equal(ambiguousEffects, 1);
});

test("AAS-012 prepare-time reentrancy sees IN_FLIGHT and cannot create two commits", () => {
  const { catalogue, activation, policy, request } = setup();
  const decision = admitCapabilityExecutionAtGatewayV1(
    catalogue, activation, policy, request, OBSERVED_AT,
  );
  const replayStore: CapabilityReplayStoreV1 = new Map();
  let commits = 0;
  let nested: CapabilityBrokerReceiptV1 | null = null;
  const executor: SyntheticCapabilityExecutorV1 = {
    prepare: () => {
      nested = executeCapabilityAtBrokerV1(
        catalogue, activation, policy, decision, OBSERVED_AT, replayStore, executor,
      );
      return {
        response: { contactId: "synthetic-contact-005" },
        commit: () => { commits += 1; },
      };
    },
  };

  const outer = executeCapabilityAtBrokerV1(
    catalogue, activation, policy, decision, OBSERVED_AT, replayStore, executor, clock(0, 1),
  );
  assert.equal(outer.outcome, "EXECUTED");
  assert.equal(commits, 1);
  assert.ok(nested !== null);
  assertDeniedReceipt(nested, "REPLAY_IN_FLIGHT_DENIED");
  assert.equal(replayStore.get(request.requestId), "CONSUMED");
});

test("AAS-012 executor receives the exact immutable request snapshot bound to the receipt", () => {
  const { catalogue, activation, policy, request } = setup();
  const decision = admitCapabilityExecutionAtGatewayV1(
    catalogue, activation, policy, request, OBSERVED_AT,
  );
  assert.ok(decision.ticket !== null);
  const replayStore: CapabilityReplayStoreV1 = new Map();
  let executorRequest: Readonly<Record<string, unknown>> | null = null;
  let mutationDenials = 0;
  let committedName: unknown = null;
  let effects = 0;
  const executor: SyntheticCapabilityExecutorV1 = {
    prepare: (_action, immutableRequest) => {
      executorRequest = immutableRequest;
      try {
        (immutableRequest as Record<string, unknown>).name = "mutated-by-prepare";
      } catch (error) {
        assert.ok(error instanceof TypeError);
        mutationDenials += 1;
      }
      try {
        (immutableRequest as Record<string, unknown>).extra = "added-by-prepare";
      } catch (error) {
        assert.ok(error instanceof TypeError);
        mutationDenials += 1;
      }
      return {
        response: { contactId: "synthetic-contact-009" },
        commit: () => {
          committedName = immutableRequest.name;
          effects += 1;
        },
      };
    },
  };

  const receipt = executeCapabilityAtBrokerV1(
    catalogue, activation, policy, decision, OBSERVED_AT, replayStore, executor, clock(0, 1),
  );
  assert.equal(receipt.outcome, "EXECUTED");
  assert.equal(mutationDenials, 2);
  assert.equal(effects, 1);
  assert.equal(committedName, "Alex Example");
  assert.ok(executorRequest !== null);
  assert.notEqual(executorRequest, decision.ticket.request);
  assert.equal(Object.isFrozen(executorRequest), true);
  assert.deepEqual(executorRequest, {
    email: "alex@example.test",
    name: "Alex Example",
  });
  assert.equal(receipt.requestDigest, sha256(executorRequest));
  assert.equal(receipt.requestDigest, decision.ticket.requestDigest);

  const replay = executeCapabilityAtBrokerV1(
    catalogue, activation, policy, decision, OBSERVED_AT, replayStore, executor, clock(0, 1),
  );
  assertDeniedReceipt(replay, "REPLAY_CONSUMED_DENIED");
  assert.equal(effects, 1);
});

test("AAS-012 uncloneable accepted request representation denies before prepare and releases reservation", () => {
  const { catalogue, activation, policy, request } = setup();
  const decision = admitCapabilityExecutionAtGatewayV1(
    catalogue, activation, policy, request, OBSERVED_AT,
  );
  const uncloneableDecision = structuredClone(decision) as Record<string, any>;
  uncloneableDecision.ticket.request = new Proxy(uncloneableDecision.ticket.request, {});
  delete uncloneableDecision.decisionDigest;
  uncloneableDecision.decisionDigest = sha256(uncloneableDecision);

  let prepareCalls = 0;
  let effects = 0;
  const replayStore: CapabilityReplayStoreV1 = new Map();
  const executor: SyntheticCapabilityExecutorV1 = {
    prepare: () => {
      prepareCalls += 1;
      return {
        response: { contactId: "synthetic-contact-010" },
        commit: () => { effects += 1; },
      };
    },
  };
  const receipt = executeCapabilityAtBrokerV1(
    catalogue, activation, policy, uncloneableDecision, OBSERVED_AT, replayStore, executor,
  );
  assertDeniedReceipt(receipt, "REQUEST_SNAPSHOT_INVALID_DENIED");
  assert.equal(prepareCalls, 0);
  assert.equal(effects, 0);
  assert.equal(replayStore.has(request.requestId), false);
});

test("AAS-012 malformed prepared effects deny deterministically and release pre-commit reservation", () => {
  const { catalogue, activation, policy, request } = setup();
  const decision = admitCapabilityExecutionAtGatewayV1(
    catalogue, activation, policy, request, OBSERVED_AT,
  );
  const malformedValues: readonly unknown[] = [
    null,
    7,
    { commit: () => undefined },
    { response: { contactId: "synthetic-contact-006" }, commit: "not-callable" },
  ];

  let lastStore: CapabilityReplayStoreV1 = new Map();
  for (const malformed of malformedValues) {
    const replayStore: CapabilityReplayStoreV1 = new Map();
    const executor = { prepare: () => malformed } as unknown as SyntheticCapabilityExecutorV1;
    const receipt = executeCapabilityAtBrokerV1(
      catalogue, activation, policy, decision, OBSERVED_AT, replayStore, executor, clock(0, 1),
    );
    assertDeniedReceipt(receipt, "PREPARED_EFFECT_INVALID_DENIED");
    assert.equal(replayStore.has(request.requestId), false);
    lastStore = replayStore;
  }

  let effects = 0;
  const validExecutor: SyntheticCapabilityExecutorV1 = {
    prepare: () => ({
      response: { contactId: "synthetic-contact-007" },
      commit: () => { effects += 1; },
    }),
  };
  const retry = executeCapabilityAtBrokerV1(
    catalogue, activation, policy, decision, OBSERVED_AT, lastStore, validExecutor, clock(0, 1),
  );
  assert.equal(retry.outcome, "EXECUTED");
  assert.equal(effects, 1);
});

test("AAS-012 commit cannot mutate the validated immutable response snapshot", () => {
  const { catalogue, activation, policy, request } = setup();
  const decision = admitCapabilityExecutionAtGatewayV1(
    catalogue, activation, policy, request, OBSERVED_AT,
  );
  const retainedResponse: Record<string, unknown> = { contactId: "synthetic-contact-008" };
  const executor: SyntheticCapabilityExecutorV1 = {
    prepare: () => ({
      response: retainedResponse,
      commit: () => {
        retainedResponse.contactId = "mutated-after-validation";
        retainedResponse.extra = "would-have-widened-response";
      },
    }),
  };
  const receipt = executeCapabilityAtBrokerV1(
    catalogue, activation, policy, decision, OBSERVED_AT, new Map(), executor, clock(0, 1),
  );
  assert.equal(receipt.outcome, "EXECUTED");
  assert.deepEqual(receipt.response, { contactId: "synthetic-contact-008" });
  assert.equal(receipt.responseDigest, sha256({ contactId: "synthetic-contact-008" }));
  assert.equal(Object.isFrozen(receipt.response), true);
  assert.throws(() => {
    (receipt.response as Record<string, unknown>).contactId = "caller-mutation";
  }, TypeError);
  assert.deepEqual(retainedResponse, {
    contactId: "mutated-after-validation",
    extra: "would-have-widened-response",
  });
});
