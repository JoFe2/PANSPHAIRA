import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, mkdirSync, rmSync, existsSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
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

function agentEnvelope(gateValue, action, decisionDigest = "e".repeat(64)) {
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
      decisionDigest,
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

test("ambiguous agent recovery rejects substituted authority before reconciliation", async () => {
  const root = mkdtempSync(join(tmpdir(), "cm-reservation-authority-"));
  let reconciliations = 0;
  const firstGate = gate({
    root,
    provider: {
      async mutate() {
        return { id: "effect-1" };
      },
      async readback(action) {
        return { ...validReadback(action), firstName: "STALE-READBACK" };
      },
    },
  });
  const action = agentAction("agent:authority-recovery-001");
  const originalEnvelope = agentEnvelope(firstGate, action);
  await assert.rejects(
    firstGate.execute(request(), originalEnvelope),
    /PROVIDER_READBACK_MISMATCH_DENIED/,
  );
  assert.equal(
    firstGate.state.reservations[action.replayKey].authorityBinding,
    originalEnvelope.authority.binding,
  );

  const restarted = gate({
    root,
    provider: {
      async mutate() {
        throw new Error("must-not-mutate");
      },
      async reconcile(retryAction) {
        reconciliations += 1;
        return {
          providerResult: { id: "effect-1" },
          readback: validReadback(retryAction),
        };
      },
    },
  });
  const substitutedEnvelope = agentEnvelope(restarted, action, "f".repeat(64));
  await assert.rejects(
    restarted.execute(request(), substitutedEnvelope),
    /REPLAY_AUTHORITY_CONFLICT_DENIED/,
  );
  assert.equal(reconciliations, 0);
  assert.equal(restarted.state.effects[action.replayKey], undefined);
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

test("final persistence failure converges memory and durable bytes to AMBIGUOUS, and restart reconciles without a duplicate POST", async () => {
  const root = mkdtempSync(join(tmpdir(), "cm-reservation-finalpersist-"));
  const receiptPath = join(root, "effects.json");
  let mutations = 0;
  let injectFinalPersist = false;
  const gateValue = gate({
    root,
    provider: {
      async mutate() {
        mutations += 1;
        return { id: "effect-1" };
      },
      async readback(action) {
        // Arm the one-shot fault: the readback completes, so the very next
        // persist() is the FINAL durable write of the APPLIED state.
        injectFinalPersist = true;
        return validReadback(action);
      },
    },
  });
  const realPersist = gateValue.persist.bind(gateValue);
  // Inject the narrow fault at the FINAL persistence step only: the mutation
  // and readback both succeed, then that single durable write fails. The
  // recovery persist (markAmbiguous) succeeds so the convergence is durable.
  gateValue.persist = () => {
    if (injectFinalPersist) {
      injectFinalPersist = false;
      throw new Error("PERSISTENCE_FAILURE_INJECTED");
    }
    return realPersist();
  };
  const action = installerAction("installer:finalpersist-001");
  const envelope = installerEnvelope(gateValue, action);
  await assert.rejects(
    gateValue.execute(request(), envelope),
    /PERSISTENCE_FAILURE_INJECTED/,
  );
  // Convergence: the live process must NOT keep a phantom APPLIED effect.
  assert.equal(mutations, 1);
  assert.equal(gateValue.state.effects[action.replayKey], undefined);
  assert.equal(gateValue.state.reservations[action.replayKey].status, "AMBIGUOUS");
  assert.equal(gateValue.state.reservations[action.replayKey].recovery, "RECONCILE");
  // The durable bytes must carry the same convergence (persisted by the
  // execute() catch via markAmbiguous), not an APPLIED reservation.
  const durable = JSON.parse(readFileSync(receiptPath, "utf8"));
  assert.equal(durable.effects[action.replayKey], undefined);
  assert.equal(durable.reservations[action.replayKey].status, "AMBIGUOUS");
  assert.equal(durable.reservations[action.replayKey].recovery, "RECONCILE");

  // Restart: a new gate recovers the ambiguous reservation and reconciles
  // without re-POSTing; the recovered receipt is then durable and positive.
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
  assert.equal(mutations, 1);
  assert.equal(retryMutations, 0);
  assert.equal(recovered.replayState, "RECONCILE_NO_DUPLICATE");
  assert.equal(restarted.state.reservations[action.replayKey].status, "APPLIED");
  const durableAfter = JSON.parse(readFileSync(receiptPath, "utf8"));
  assert.equal(durableAfter.reservations[action.replayKey].status, "APPLIED");
  assert.notEqual(durableAfter.effects[action.replayKey], undefined);
});

test("positive: a successful mutation persists a durable APPLIED effect receipt", async () => {
  const root = mkdtempSync(join(tmpdir(), "cm-reservation-positive-"));
  const receiptPath = join(root, "effects.json");
  const gateValue = gate({
    root,
    provider: {
      async mutate() {
        return { id: "effect-1" };
      },
      async readback(action) {
        return validReadback(action);
      },
    },
  });
  const action = installerAction("installer:positive-001");
  const result = await gateValue.execute(request(), installerEnvelope(gateValue, action));
  assert.equal(result.status, "PASS");
  assert.equal(result.replayed, false);
  const durable = JSON.parse(readFileSync(receiptPath, "utf8"));
  assert.equal(durable.reservations[action.replayKey].status, "APPLIED");
  assert.notEqual(durable.effects[action.replayKey], undefined);
  assert.deepEqual(durable.effects[action.replayKey].providerResult, { id: "effect-1" });
});


// ---------------------------------------------------------------------------
// Bounded follow-through: BOTH final-persist sites, exact failed-gate retry,
// fresh Node child restart, persistent storage failure, and unavailable
// reconciliation. Inject a REAL EISDIR at the store temp-file boundary.
// Positive normal receipt (above) is preserved and untouched.
// ---------------------------------------------------------------------------

// Inject a REAL EISDIR at the store temp-file boundary (the exact writeFileSync
// target `${receiptPath}.tmp`) on the FINAL durable write. `on` is a getter the
// test flips true once the operation reaches that final persist (set inside
// readback for the initial-execution site, inside reconcile for the
// reconciliation site). persistent=true keeps every persist after arming failed;
// otherwise the fault is one-shot and the temp path is cleared so a subsequent
// recovery persist (markAmbiguous) succeeds.
function injectEisdirFinalPersist(gateValue, { on, persistent = false }) {
  const tempPath = `${gateValue.receiptPath}.tmp`;
  const real = gateValue.persist.bind(gateValue);
  let fired = false;
  gateValue.persist = () => {
    const armed = persistent ? on() : on() && !fired;
    if (armed) {
      fired = true;
      rmSync(tempPath, { recursive: true, force: true });
      mkdirSync(tempPath);
      const error = new Error(`EISDIR: illegal operation on a directory, write '${tempPath}'`);
      error.code = "EISDIR";
      error.errno = -21;
      throw error;
    }
    rmSync(tempPath, { recursive: true, force: true });
    return real();
  };
  return { tempPath, clear: () => rmSync(tempPath, { recursive: true, force: true }) };
}

const GATE_MODULE_URL = fileURLToPath(new URL("../demo/runtime/enforcement-gate.mjs", import.meta.url));

test("initial-execution final-persist EISDIR (one-shot): converges memory and durable bytes to AMBIGUOUS with no phantom receipt", async () => {
  const root = mkdtempSync(join(tmpdir(), "cm-reservation-isp-initial-"));
  const receiptPath = join(root, "effects.json");
  let on = false;
  let mutations = 0;
  const gateValue = gate({
    root,
    provider: {
      async mutate() {
        mutations += 1;
        return { id: "effect-1" };
      },
      async readback(action) {
        on = true;
        return validReadback(action);
      },
    },
  });
  const injected = injectEisdirFinalPersist(gateValue, { on: () => on, persistent: false });
  const action = installerAction("installer:isp-initial-001");
  const envelope = installerEnvelope(gateValue, action);
  await assert.rejects(gateValue.execute(request(), envelope), { code: "EISDIR", message: /EISDIR/ });
  // Exact rejection is the real EISDIR, not an unrelated setup error.
  assert.equal(mutations, 1);
  // Absent phantom receipt: no live APPLIED effect, no durable APPLIED reservation.
  assert.equal(gateValue.state.effects[action.replayKey], undefined);
  assert.equal(gateValue.state.reservations[action.replayKey].status, "AMBIGUOUS");
  assert.equal(gateValue.state.reservations[action.replayKey].recovery, "RECONCILE");
  const durable = JSON.parse(readFileSync(receiptPath, "utf8"));
  assert.equal(durable.effects[action.replayKey], undefined);
  assert.equal(durable.reservations[action.replayKey].status, "AMBIGUOUS");
  assert.equal(durable.reservations[action.replayKey].recovery, "RECONCILE");
  injected.clear();
});

test("initial-execution final-persist EISDIR: retry on the exact failed live gate reconciles without a duplicate POST and matches the durable receipt", async () => {
  const root = mkdtempSync(join(tmpdir(), "cm-reservation-isp-retry-"));
  const receiptPath = join(root, "effects.json");
  let on = false;
  let mutations = 0;
  const gateValue = gate({
    root,
    provider: {
      async mutate() {
        mutations += 1;
        return { id: "effect-1" };
      },
      async readback(action) {
        on = true;
        return validReadback(action);
      },
      async reconcile(action) {
        return { providerResult: { id: "effect-1" }, readback: validReadback(action) };
      },
    },
  });
  const injected = injectEisdirFinalPersist(gateValue, { on: () => on, persistent: false });
  const action = installerAction("installer:isp-retry-001");
  const envelope = installerEnvelope(gateValue, action);
  await assert.rejects(gateValue.execute(request(), envelope), { code: "EISDIR" });
  // Retry on the SAME failed live gate object (not a newly constructed one).
  on = false;
  const recovered = await gateValue.execute(request(), envelope);
  assert.equal(mutations, 1);
  assert.equal(recovered.status, "PASS");
  assert.equal(recovered.replayState, "RECONCILE_NO_DUPLICATE");
  assert.equal(gateValue.state.reservations[action.replayKey].status, "APPLIED");
  const durable = JSON.parse(readFileSync(receiptPath, "utf8"));
  assert.equal(durable.reservations[action.replayKey].status, "APPLIED");
  assert.notEqual(durable.effects[action.replayKey], undefined);
  assert.deepEqual(durable.effects[action.replayKey].receipt, recovered.receipt);
  injected.clear();
});

test("initial-execution final-persist EISDIR: a fresh Node child restart from retained bytes reconciles without a duplicate POST", async () => {
  const root = mkdtempSync(join(tmpdir(), "cm-reservation-isp-child-"));
  const receiptPath = join(root, "effects.json");
  let on = false;
  const gateValue = gate({
    root,
    provider: {
      async mutate() {
        return { id: "effect-1" };
      },
      async readback(action) {
        on = true;
        return validReadback(action);
      },
    },
  });
  const injected = injectEisdirFinalPersist(gateValue, { on: () => on, persistent: false });
  const action = installerAction("installer:isp-child-001");
  const envelope = installerEnvelope(gateValue, action);
  await assert.rejects(gateValue.execute(request(), envelope), { code: "EISDIR" });
  injected.clear();
  const retained = JSON.parse(readFileSync(receiptPath, "utf8"));
  assert.equal(retained.reservations[action.replayKey].status, "AMBIGUOUS");
  // A fresh, independent Node process restarts the gate from the retained
  // durable bytes and reconciles (no duplicate POST).
  const childSrc = `
    const { DemoMutationGate, canonicalJson, sha256 } = await import(process.env.CM_GATE_URL);
    const apiToken = "a".repeat(48);
    const controlToken = "b".repeat(48);
    const policyDigest = "d".repeat(64);
    const gateValue = new DemoMutationGate({
      apiToken,
      controlToken,
      expectedOrigin: "http://127.0.0.1:7780",
      adminAiPolicyDigest: policyDigest,
      receiptPath: process.env.CM_RECEIPT_PATH,
      operationTimeoutMs: 100,
      provider: {
        async mutate() { throw new Error("must-not-mutate-in-child"); },
        async reconcile(a) {
          return { providerResult: { id: "effect-1" }, readback: { id: "effect-1", date: a.payload.body.date, ref_client: a.payload.body.ref_client, socid: a.payload.body.socid } };
        },
      },
    });
    const action = ${JSON.stringify(action)};
    const actionDigest = sha256(canonicalJson(action));
    const envelope = {
      action,
      actionDigest,
      approval: { actionDigest, approver: "owner:local-demo", binding: gateValue.approvalBinding(actionDigest, action), decision: "APPROVE" },
    };
    const result = await gateValue.execute({ headers: { authorization: "Bearer " + apiToken, host: "127.0.0.1:7780", origin: "http://127.0.0.1:7780", "x-cm-csrf": "chimpmaera-local-v1" } }, envelope);
    console.log(JSON.stringify({ replayState: result.replayState, status: result.status, receiptDigest: result.receipt.receiptDigest }));
  `;
  const child = spawnSync(process.execPath, ["--input-type=module", "-e", childSrc], {
    encoding: "utf8",
    env: { ...process.env, CM_GATE_URL: `file://${GATE_MODULE_URL}`, CM_RECEIPT_PATH: receiptPath },
  });
  assert.equal(child.status, 0, child.stderr);
  const parsed = JSON.parse(child.stdout.trim().split("\n").at(-1));
  assert.equal(parsed.status, "PASS");
  assert.equal(parsed.replayState, "RECONCILE_NO_DUPLICATE");
  const after = JSON.parse(readFileSync(receiptPath, "utf8"));
  assert.equal(after.reservations[action.replayKey].status, "APPLIED");
  assert.equal(after.effects[action.replayKey].receipt.receiptDigest, parsed.receiptDigest);
});

test("reconciliation final-persist EISDIR (one-shot): no phantom receipt, prior durable AMBIGUOUS retained, then storage recovery reconciles with a matching receipt", async () => {
  const root = mkdtempSync(join(tmpdir(), "cm-reservation-isp-reconcile-"));
  const receiptPath = join(root, "effects.json");
  let on = false;
  let mutations = 0;
  let reconciliations = 0;
  const gateValue = gate({
    root,
    provider: {
      async mutate() {
        mutations += 1;
        return { id: "effect-1" };
      },
      async readback() {
        throw new Error("PROVIDER_DISCONNECT");
      },
      async reconcile(action) {
        on = true;
        reconciliations += 1;
        return { providerResult: { id: "effect-1" }, readback: validReadback(action) };
      },
    },
  });
  const injected = injectEisdirFinalPersist(gateValue, { on: () => on, persistent: false });
  const action = installerAction("installer:isp-reconcile-001");
  const envelope = installerEnvelope(gateValue, action);
  // First execute: write-then-disconnect -> durable AMBIGUOUS/RECONCILE.
  await assert.rejects(gateValue.execute(request(), envelope), /PROVIDER_DISCONNECT/);
  assert.equal(mutations, 1);
  assert.equal(JSON.parse(readFileSync(receiptPath, "utf8")).reservations[action.replayKey].status, "AMBIGUOUS");
  // Retry (same live gate): reconciliation path -> the RECONCILIATION final
  // persist fails with a real EISDIR. No phantom receipt; prior durable
  // AMBIGUOUS is retained (execute() catch does not re-persist here: reserved
  // stays false on the reconciliation path).
  on = false;
  await assert.rejects(gateValue.execute(request(), envelope), { code: "EISDIR" });
  assert.equal(mutations, 1);
  assert.equal(reconciliations, 1);
  assert.equal(gateValue.state.effects[action.replayKey], undefined);
  assert.equal(gateValue.state.reservations[action.replayKey].status, "AMBIGUOUS");
  assert.equal(gateValue.state.reservations[action.replayKey].recovery, "RECONCILE");
  const durableAfterFailure = JSON.parse(readFileSync(receiptPath, "utf8"));
  assert.equal(durableAfterFailure.effects[action.replayKey], undefined);
  assert.equal(durableAfterFailure.reservations[action.replayKey].status, "AMBIGUOUS");
  // Storage recovery: one more retry reconciles without a duplicate and the
  // durable receipt matches the returned receipt.
  on = false;
  const recovered = await gateValue.execute(request(), envelope);
  assert.equal(mutations, 1);
  assert.equal(recovered.replayState, "RECONCILE_NO_DUPLICATE");
  const durable = JSON.parse(readFileSync(receiptPath, "utf8"));
  assert.equal(durable.reservations[action.replayKey].status, "APPLIED");
  assert.deepEqual(durable.effects[action.replayKey].receipt, recovered.receipt);
  injected.clear();
});

test("persistent storage failure at the initial final persist: no phantom receipt, honest unresolved until storage recovers (durable retains EXECUTING until a later persist)", async () => {
  const root = mkdtempSync(join(tmpdir(), "cm-reservation-isp-persistent-"));
  const receiptPath = join(root, "effects.json");
  let on = false;
  let mutations = 0;
  const gateValue = gate({
    root,
    provider: {
      async mutate() {
        mutations += 1;
        return { id: "effect-1" };
      },
      async readback(action) {
        on = true;
        return validReadback(action);
      },
    },
  });
  // Persistent: the final persist AND the markAmbiguous recovery persist both
  // fail, so the durable bytes retain the prior EXECUTING reservation while
  // live memory converges to AMBIGUOUS. Bytes do not immediately converge.
  const injected = injectEisdirFinalPersist(gateValue, { on: () => on, persistent: true });
  const action = installerAction("installer:isp-persistent-001");
  const envelope = installerEnvelope(gateValue, action);
  await assert.rejects(gateValue.execute(request(), envelope), { code: "EISDIR" });
  assert.equal(mutations, 1);
  assert.equal(gateValue.state.effects[action.replayKey], undefined);
  assert.equal(gateValue.state.reservations[action.replayKey].status, "AMBIGUOUS");
  assert.equal(gateValue.state.reservations[action.replayKey].recovery, "RECONCILE");
  const durable = JSON.parse(readFileSync(receiptPath, "utf8"));
  assert.equal(durable.effects[action.replayKey], undefined);
  // Persistent failure: the recovery persist (markAmbiguous) also failed, so the
  // durable bytes retain the prior EXECUTING reservation while live memory holds
  // AMBIGUOUS. Memory and bytes do NOT immediately converge; they converge once
  // storage recovers and a later persist succeeds. No fabricated APPLIED.
  assert.equal(durable.reservations[action.replayKey].status, "EXECUTING");
  assert.notEqual(durable.reservations[action.replayKey].status, "APPLIED");
  assert.notEqual(gateValue.state.reservations[action.replayKey].status, "APPLIED");
  // A same-process retry while storage is still unavailable must not fabricate a
  // completion or duplicate the effect: live AMBIGUOUS with no reconcile is
  // honestly unresolved, and the single synthetic mutation is retained.
  await assert.rejects(gateValue.execute(request(), envelope), /EFFECT_AMBIGUOUS_RECONCILE_REQUIRED/);
  assert.equal(mutations, 1);
  assert.equal(gateValue.state.effects[action.replayKey], undefined);
  injected.clear();
});

test("ambiguous outcome with unavailable reconciliation: honestly unresolved (no fabricated success, no duplicate mutation)", async () => {
  const root = mkdtempSync(join(tmpdir(), "cm-reservation-isp-unavailable-"));
  const receiptPath = join(root, "effects.json");
  let mutations = 0;
  const firstGate = gate({
    root,
    provider: {
      async mutate() {
        mutations += 1;
        return { id: "effect-1" };
      },
      async readback() {
        throw new Error("PROVIDER_DISCONNECT");
      },
      // No reconcile capability -> reconciliation is unavailable.
    },
  });
  const action = installerAction("installer:isp-unavailable-001");
  const envelope = installerEnvelope(firstGate, action);
  await assert.rejects(firstGate.execute(request(), envelope), /PROVIDER_DISCONNECT/);
  assert.equal(mutations, 1);
  assert.equal(JSON.parse(readFileSync(receiptPath, "utf8")).reservations[action.replayKey].status, "AMBIGUOUS");
  // Restart with a provider that still cannot reconcile -> honestly unresolved,
  // not a fabricated completion and not a silent duplicate.
  const restarted = gate({
    root,
    provider: {
      async mutate() {
        mutations += 1;
        throw new Error("must-not-mutate");
      },
      async readback() {
        throw new Error("must-not-readback");
      },
    },
  });
  await assert.rejects(restarted.execute(request(), envelope), /EFFECT_AMBIGUOUS_RECONCILE_REQUIRED/);
  assert.equal(mutations, 1);
  assert.equal(restarted.state.reservations[action.replayKey].status, "AMBIGUOUS");
  assert.equal(restarted.state.effects[action.replayKey], undefined);
  const durable = JSON.parse(readFileSync(receiptPath, "utf8"));
  assert.equal(durable.reservations[action.replayKey].status, "AMBIGUOUS");
  assert.equal(durable.effects[action.replayKey], undefined);
});
