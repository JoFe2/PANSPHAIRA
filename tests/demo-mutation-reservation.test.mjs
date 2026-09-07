import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import {
  DemoMutationGate,
  canonicalJson,
  createHttpProvider,
  sha256,
} from "../demo/runtime/enforcement-gate.mjs";

const apiToken = "a".repeat(48);
const controlToken = "b".repeat(48);
const expectedOrigin = "http://127.0.0.1:7780";
const policyDigest = "d".repeat(64);
let sequence = 0;

function request() {
  return {
    headers: {
      authorization: `Bearer ${apiToken}`,
      host: "127.0.0.1:7780",
      origin: expectedOrigin,
      "x-cm-csrf": "chimpmaera-local-v1",
    },
  };
}

function installerAction(replayKey, refClient = "CM-RESERVATION-001") {
  return {
    actionType: "PROVIDER_MUTATION",
    actor: "installer:seed-and-flow",
    payload: {
      body: { date: 1767225600, ref_client: refClient, socid: 7 },
      method: "POST",
      path: "/orders",
    },
    replayKey,
    scope: {
      actor: "installer:seed-and-flow",
      entity: "Order",
      operation: "CREATE_IF_ABSENT",
      provider: "dolibarr",
      tenant: "panskys-zoo-demo",
    },
  };
}

function agentAction(replayKey) {
  return {
    actionType: "PROVIDER_MUTATION",
    actor: "agent:admin-ai-poc",
    payload: {
      body: {
        description: "PanSphaira Admin AI deterministic PoC contact",
        emailAddress: "admin-ai-poc@example.invalid",
        firstName: "Avery",
        lastName: "Admin AI PoC",
      },
      method: "POST",
      path: "/Contact",
    },
    replayKey: replayKey.replace(/^agent:/, "admin-ai:poc:"),
    scope: {
      actor: "agent:admin-ai-poc",
      entity: "Contact",
      operation: "CREATE_IF_ABSENT",
      provider: "espocrm",
      tenant: "panskys-zoo-demo",
    },
  };
}

function gate({ provider, root, operationTimeoutMs = 100 } = {}) {
  return new DemoMutationGate({
    apiToken,
    controlToken,
    expectedOrigin,
    adminAiPolicyDigest: policyDigest,
    receiptPath: join(root ?? mkdtempSync(join(tmpdir(), "cm-reservation-")), "effects.json"),
    provider,
    operationTimeoutMs,
  });
}

function installerEnvelope(gateValue, action) {
  const actionDigest = sha256(canonicalJson(action));
  return {
    action,
    actionDigest,
    approval: {
      actionDigest,
      approver: "owner:local-demo",
      binding: gateValue.approvalBinding(actionDigest, action),
      decision: "APPROVE",
    },
  };
}

function agentEnvelope(gateValue, action) {
  const actionDigest = sha256(canonicalJson(action));
  return {
    action,
    actionDigest,
    authority: gateValue.agentAuthority({
      actor: action.actor,
      scope: action.scope,
      actionDigest,
      replayKey: action.replayKey,
      policyId: "admin-ai-poc-policy-v1",
      policyGeneration: 1,
      policyDigest,
      decisionDigest: "e".repeat(64),
    }),
  };
}

function validReadback(action, id = "effect-1") {
  if (action.actor === "installer:seed-and-flow") {
    return {
      id,
      date: action.payload.body.date,
      ref_client: action.payload.body.ref_client,
      socid: action.payload.body.socid,
    };
  }
  return {
    id,
    description: action.payload.body.description,
    emailAddress: action.payload.body.emailAddress,
    firstName: action.payload.body.firstName,
    lastName: action.payload.body.lastName,
  };
}

for (const [authorityClass, makeAction, makeEnvelope] of [
  ["installer", installerAction, installerEnvelope],
  ["agent", agentAction, agentEnvelope],
]) {
  test(`${authorityClass} equal-key barrier reserves before provider dispatch`, async () => {
    let release;
    const barrier = new Promise((resolve) => { release = resolve; });
    let mutations = 0;
    const current = gate({
      provider: {
        async mutate() {
          mutations += 1;
          await barrier;
          return { id: "effect-1" };
        },
        async readback(action) {
          return validReadback(action);
        },
      },
    });
    const action = makeAction(`${authorityClass}:barrier-001`);
    const envelope = makeEnvelope(current, action);
    const first = current.execute(request(), envelope);
    await new Promise((resolve) => setImmediate(resolve));
    await assert.rejects(
      current.execute(request(), envelope),
      authorityClass === "installer"
        ? /EFFECT_REPLAY_IN_PROGRESS_DENIED/
        : /EFFECT_REPLAY_IN_PROGRESS_DENIED/,
    );
    assert.equal(mutations, 1);
    release();
    await first;
  });
}

test("equal normalized operation key with different payload conflicts before a second mutation", async () => {
  let release;
  const barrier = new Promise((resolve) => { release = resolve; });
  let mutations = 0;
  const current = gate({
    provider: {
      async mutate() {
        mutations += 1;
        await barrier;
        return { id: "effect-1" };
      },
      async readback(action) {
        return validReadback(action);
      },
    },
  });
  const firstAction = installerAction("installer:conflict-001", "CM-FIRST-001");
  const secondAction = installerAction("installer:conflict-001", "CM-SECOND-001");
  const first = current.execute(request(), installerEnvelope(current, firstAction));
  await new Promise((resolve) => setImmediate(resolve));
  await assert.rejects(
    current.execute(request(), installerEnvelope(current, secondAction)),
    /REPLAY_KEY_CONFLICT_DENIED/,
  );
  assert.equal(mutations, 1);
  release();
  await first;
});

test("write-then-disconnect persists AMBIGUOUS/RECONCILE and restart recovers without POST", async () => {
  const root = mkdtempSync(join(tmpdir(), "cm-reservation-restart-"));
  let firstMutations = 0;
  const firstGate = gate({
    root,
    provider: {
      async mutate() {
        firstMutations += 1;
        return { id: "effect-1" };
      },
      async readback() {
        throw new Error("PROVIDER_DISCONNECT");
      },
    },
  });
  const action = installerAction("installer:restart-001");
  const envelope = installerEnvelope(firstGate, action);
  await assert.rejects(firstGate.execute(request(), envelope), /PROVIDER_DISCONNECT/);
  assert.equal(firstGate.state.reservations[action.replayKey].status, "AMBIGUOUS");
  assert.equal(firstGate.state.reservations[action.replayKey].recovery, "RECONCILE");

  let retryMutations = 0;
  const restarted = gate({
    root,
    provider: {
      async mutate() {
        retryMutations += 1;
        return { id: "duplicate" };
      },
      async reconcile(retryAction) {
        return {
          providerResult: { id: "effect-1" },
          readback: validReadback(retryAction),
        };
      },
    },
  });
  const recovered = await restarted.execute(request(), envelope);
  assert.equal(firstMutations, 1);
  assert.equal(retryMutations, 0);
  assert.equal(recovered.replayState, "RECONCILE_NO_DUPLICATE");
  assert.equal(restarted.state.reservations[action.replayKey].status, "APPLIED");
});

test("initially stale readback makes a conflicting ambiguous retry fail before reconciliation", async () => {
  let mutations = 0;
  let reconciliations = 0;
  const current = gate({
    provider: {
      async mutate() {
        mutations += 1;
        return { id: "effect-1" };
      },
      async readback() {
        return {
          id: "effect-1",
          description: "PanSphaira Admin AI deterministic PoC contact",
          emailAddress: "admin-ai-poc@example.invalid",
          firstName: "STALE-READBACK",
          lastName: "Admin AI PoC",
        };
      },
      async reconcile() {
        reconciliations += 1;
        return {
          providerResult: { id: "effect-1" },
          readback: validReadback(installerAction("installer:stale-readback-001")),
        };
      },
    },
  });
  const firstAction = agentAction("agent:stale-readback-001");
  await assert.rejects(
    current.execute(request(), agentEnvelope(current, firstAction)),
    /PROVIDER_READBACK_MISMATCH_DENIED/,
  );
  assert.equal(mutations, 1);
  assert.equal(current.state.reservations[firstAction.replayKey].status, "AMBIGUOUS");
  assert.equal(current.state.reservations[firstAction.replayKey].recovery, "RECONCILE");

  const conflictingAction = installerAction(firstAction.replayKey, "CM-SECOND-STALE-001");
  await assert.rejects(
    current.execute(request(), installerEnvelope(current, conflictingAction)),
    /REPLAY_KEY_CONFLICT_DENIED/,
  );
  assert.equal(mutations, 1);
  assert.equal(reconciliations, 0);
  assert.equal(current.state.effects[firstAction.replayKey], undefined);
});

test("never-response deadline aborts the operation and leaves a durable ambiguous reservation", async () => {
  let seenSignal;
  const current = gate({
    operationTimeoutMs: 15,
    provider: {
      async mutate(action, signal) {
        seenSignal = signal;
        return new Promise((resolve, reject) => {
          signal.addEventListener("abort", () => reject(signal.reason), { once: true });
        });
      },
      async readback() {
        throw new Error("must-not-readback");
      },
    },
  });
  const action = installerAction("installer:deadline-001");
  await assert.rejects(
    current.execute(request(), installerEnvelope(current, action)),
    /OPERATION_DEADLINE_EXCEEDED/,
  );
  assert.equal(seenSignal.aborted, true);
  assert.equal(current.state.reservations[action.replayKey].status, "AMBIGUOUS");
});

test("late provider response after deadline cannot trigger readback or a second POST", async () => {
  let mutations = 0;
  let readbacks = 0;
  const current = gate({
    operationTimeoutMs: 15,
    provider: {
      async mutate() {
        mutations += 1;
        return new Promise((resolve) => setTimeout(() => resolve({ id: "late" }), 40));
      },
      async readback() {
        readbacks += 1;
        return validReadback(installerAction("installer:late-001"), "late");
      },
    },
  });
  const action = installerAction("installer:late-001");
  await assert.rejects(
    current.execute(request(), installerEnvelope(current, action)),
    /OPERATION_DEADLINE_EXCEEDED/,
  );
  await new Promise((resolve) => setTimeout(resolve, 50));
  assert.equal(mutations, 1);
  assert.equal(readbacks, 0);
  assert.equal(current.state.reservations[action.replayKey].recovery, "RECONCILE");
});

test("HTTP provider forwards the operation abort signal and has a finite fallback timeout", async () => {
  let receivedSignal;
  const provider = createHttpProvider({
    espoPassword: "not-a-credential",
    doliApiKey: "not-a-credential",
    operationTimeoutMs: 20,
    fetchImpl: async (_url, options) => {
      receivedSignal = options.signal;
      return {
        ok: true,
        status: 200,
        async text() { return JSON.stringify({ id: "effect-1" }); },
      };
    },
  });
  const controller = new AbortController();
  const action = installerAction("installer:http-001");
  const result = await provider.mutate(action, controller.signal);
  assert.equal(result.id, "effect-1");
  assert.equal(receivedSignal, controller.signal);
  assert.equal(typeof receivedSignal.addEventListener, "function");
});
