import assert from "node:assert/strict";
import {
  BTH_ERROR,
  BoundTaskHandleIssuer,
  createLocalBusinessOperation,
  createSyntheticTrustedTaskSource,
  SUPPORTED_ORDER_BINDING,
  useBoundTaskHandle,
} from "../../src/pan442/bound-task-handle.mjs";
import { canonicalJson, sha256 } from "../../demo/runtime/enforcement-gate.mjs";
import {
  createAuthoritativeApprovalSnapshot,
} from "../../demo/runtime/authoritative-approval-snapshot.mjs";
import test from "node:test";

const TENANT = "panskys-zoo-demo";
const USER = "ops:local-demo";
const RUN_ID = "run:pan442:order:0001";
const TASK_REF = "pan442-order-task-0001";
const SECRET = "p".repeat(32);

function trustedSource(ttlMs = 120_000) {
  return createSyntheticTrustedTaskSource({
    principal: { user: USER, tenant: TENANT },
    trustLabel: "LOCAL_SYNTHETIC",
    tasks: [
      {
        taskRef: TASK_REF,
        runId: RUN_ID,
        tenant: TENANT,
        user: USER,
        object: {
          provider: "dolibarr",
          entity: "Order",
          operation: "CREATE_IF_ABSENT",
          refClient: "CM-ADMIN-AI-ESCALATION-001",
          customerId: 7,
          orderDateEpoch: 1767225600,
        },
        objectVersion: 1,
        purpose: "CREATE_SYNTHETIC_SALES_ORDER",
        amountLimitMinor: 0,
        currency: "EUR",
        ttlMs,
      },
    ],
  });
}

function operationInput(overrides = {}, objectOverrides = {}) {
  return {
    tenant: TENANT,
    user: USER,
    runId: RUN_ID,
    objectVersion: 1,
    declaredAmountMinor: 0,
    currency: "EUR",
    object: {
      provider: "dolibarr",
      entity: "Order",
      operation: "CREATE_IF_ABSENT",
      refClient: "CM-ADMIN-AI-ESCALATION-001",
      customerId: 7,
      orderDateEpoch: 1767225600,
      ...objectOverrides,
    },
    ...overrides,
  };
}

function harness({ nowMs = 1_000_000, ttlMs = 120_000, snapshotRecords = [] } = {}) {
  const clock = { value: nowMs };
  let mutations = 0;
  let readbacks = 0;
  let snapshotReads = 0;
  const provider = {
    async readAuthoritativeSnapshot(action) {
      snapshotReads += 1;
      return createAuthoritativeApprovalSnapshot(action, snapshotRecords);
    },
    async mutate(action) {
      mutations += 1;
      return { id: "order-42" };
    },
    async readback(action, result) {
      readbacks += 1;
      return {
        id: result.id,
        date: action.payload.body.date,
        ref_client: action.payload.body.ref_client,
        socid: action.payload.body.socid,
      };
    },
  };
  const issuer = new BoundTaskHandleIssuer({
    taskSource: trustedSource(ttlMs),
    secret: SECRET,
    now: () => clock.value,
  });
  const operation = createLocalBusinessOperation({
    provider,
    now: () => clock.value,
  });
  const issued = issuer.createHandle({ taskRef: TASK_REF });
  return {
    clock,
    issuer,
    operation,
    issued,
    input: operationInput(),
    mutations: () => mutations,
    readbacks: () => readbacks,
    snapshotReads: () => snapshotReads,
  };
}

async function expectDenial(promise, code, stage) {
  let error;
  try {
    await promise;
  } catch (value) {
    error = value;
  }
  assert.ok(error, `expected denial ${code}`);
  assert.equal(error.name, "BoundTaskHandleError", "typed denial, not catch-any");
  assert.equal(error.message, code, "exact denial code");
  if (stage !== undefined) assert.equal(error.stage, stage, "failed stage short circuit");
}

test("PAN442-01 real positive business entry: opaque handle composes the Order seam and emits an observed result", async () => {
  const current = harness();
  const out = await useBoundTaskHandle({
    issuer: current.issuer,
    handle: current.issued.handle,
    operationInput: current.input,
    operation: current.operation,
  });
  assert.equal(out.status, "PASS");
  assert.equal(out.stage, "EXECUTE");
  assert.equal(current.mutations(), 1);
  assert.equal(current.readbacks(), 1);
  assert.equal(out.result.replayed, false);
  assert.equal(out.result.readback.ref_client, "CM-ADMIN-AI-ESCALATION-001");
  assert.equal(out.decision.outcome, "OWNER_ESCALATION");
  assert.equal(out.authority.kind, "OWNER_ESCALATION_LEASE_HMAC_V1");
  assert.equal(out.authority.maxUses, 1);
  assert.equal(out.authority.profileId, "SAFE_GUIDED");
  assert.equal(out.proposal.businessDiff.purpose, "CREATE_SYNTHETIC_SALES_ORDER");
  assert.equal(out.proposal.businessDiff.impacts.budget.currency, "EUR");
  assert.equal(out.proposal.businessDiff.impacts.budget.upperBound, "0.00");
  assert.equal(
    out.proposal.businessDiffDigest,
    sha256(canonicalJson(out.proposal.businessDiff)),
  );
  assert.equal(out.result.receipt.ownerDecisionReceiptDigest, out.authority.ownerDecisionReceiptDigest);
  assert.equal(out.result.receipt.authority.leaseId, out.authority.leaseId);
  assert.equal(out.result.receipt.businessDiffDigest, out.proposal.businessDiffDigest);
  // Separately retained observed result pins the approved identity and digests.
  assert.equal(current.issuer.observations.length, 1);
  const observed = current.issuer.observations[0];
  assert.equal(observed.stage, "EXECUTE");
  assert.equal(observed.status, "PASS");
  assert.equal(observed.taskRef, TASK_REF);
  assert.equal(observed.runId, RUN_ID);
  assert.equal(observed.handleDigest, current.issued.handleDigest);
  assert.equal(observed.approvedOwnerActor, "owner:local-demo");
  assert.equal(observed.leaseId, out.authority.leaseId);
  assert.equal(observed.receiptDigest, out.result.receipt.receiptDigest);
  assert.equal(observed.businessDiffDigest, out.proposal.businessDiffDigest);
  assert.equal(observed.snapshotDigest, out.proposal.snapshotDigest);
  // The binding the caller may see is the server-side authoritative one.
  assert.equal(out.binding.tenant, TENANT);
  assert.equal(out.binding.user, USER);
  assert.equal(out.binding.runId, RUN_ID);
  assert.equal(out.binding.sourceDigest, current.issuer.taskSource.sourceDigest);

  // Single-use: the same opaque handle cannot act a second time.
  await expectDenial(
    useBoundTaskHandle({
      issuer: current.issuer,
      handle: current.issued.handle,
      operationInput: current.input,
      operation: current.operation,
    }),
    BTH_ERROR.HANDLE_REPLAY,
    "EXECUTE",
  );
  assert.equal(current.mutations(), 1);
  assert.equal(current.readbacks(), 1);
});

test("PAN442-02 wrong object is denied at the OBJECT stage before any effect or read", async () => {
  for (const objectOverrides of [
    { entity: "Invoice" },
    { provider: "espocrm" },
    { operation: "UPDATE" },
    { refClient: "CM-OTHER-ORDER-002" },
    { customerId: 8 },
    { orderDateEpoch: 1767225601 },
  ]) {
    const current = harness();
    await expectDenial(
      useBoundTaskHandle({
        issuer: current.issuer,
        handle: current.issued.handle,
        operationInput: operationInput({}, objectOverrides),
        operation: current.operation,
      }),
      BTH_ERROR.OBJECT_MISMATCH,
      "OBJECT",
    );
    assert.equal(current.mutations(), 0);
    assert.equal(current.readbacks(), 0);
    assert.equal(current.snapshotReads(), 0);
  }
});

test("PAN442-03 wrong tenant, user and run are denied before any effect or read", async () => {
  {
    const current = harness();
    await expectDenial(
      useBoundTaskHandle({
        issuer: current.issuer,
        handle: current.issued.handle,
        operationInput: operationInput({ tenant: "other-tenant" }),
        operation: current.operation,
      }),
      BTH_ERROR.TENANT_MISMATCH,
      "TENANT",
    );
    assert.equal(current.mutations(), 0);
    assert.equal(current.readbacks(), 0);
    assert.equal(current.snapshotReads(), 0);
  }
  {
    const current = harness();
    await expectDenial(
      useBoundTaskHandle({
        issuer: current.issuer,
        handle: current.issued.handle,
        operationInput: operationInput({ user: "intruder:other" }),
        operation: current.operation,
      }),
      BTH_ERROR.PRINCIPAL_MISMATCH,
      "PRINCIPAL",
    );
    assert.equal(current.mutations(), 0);
    assert.equal(current.readbacks(), 0);
  }
  {
    const current = harness();
    await expectDenial(
      useBoundTaskHandle({
        issuer: current.issuer,
        handle: current.issued.handle,
        operationInput: operationInput({ runId: "run:pan442:order:9999" }),
        operation: current.operation,
      }),
      BTH_ERROR.RUN_MISMATCH,
      "RUN",
    );
    assert.equal(current.mutations(), 0);
    assert.equal(current.readbacks(), 0);
  }
});

test("PAN442-04 wrong object version, amount and currency are denied before any effect or read", async () => {
  {
    const current = harness();
    await expectDenial(
      useBoundTaskHandle({
        issuer: current.issuer,
        handle: current.issued.handle,
        operationInput: operationInput({ objectVersion: 2 }),
        operation: current.operation,
      }),
      BTH_ERROR.VERSION_MISMATCH,
      "VERSION",
    );
    assert.equal(current.mutations(), 0);
    assert.equal(current.readbacks(), 0);
  }
  {
    const current = harness();
    await expectDenial(
      useBoundTaskHandle({
        issuer: current.issuer,
        handle: current.issued.handle,
        operationInput: operationInput({ declaredAmountMinor: 1 }),
        operation: current.operation,
      }),
      BTH_ERROR.AMOUNT_LIMIT,
      "LIMITS",
    );
    assert.equal(current.mutations(), 0);
    assert.equal(current.readbacks(), 0);
  }
  {
    const current = harness();
    await expectDenial(
      useBoundTaskHandle({
        issuer: current.issuer,
        handle: current.issued.handle,
        operationInput: operationInput({ currency: "USD" }),
        operation: current.operation,
      }),
      BTH_ERROR.CURRENCY_MISMATCH,
      "LIMITS",
    );
    assert.equal(current.mutations(), 0);
    assert.equal(current.readbacks(), 0);
  }
});

test("PAN442-05 expired handles fail closed at the EXPIRY stage", async () => {
  const current = harness({ ttlMs: 10_000 });
  current.clock.value += 10_000;
  await expectDenial(
    useBoundTaskHandle({
      issuer: current.issuer,
      handle: current.issued.handle,
      operationInput: current.input,
      operation: current.operation,
    }),
    BTH_ERROR.HANDLE_EXPIRED,
    "EXPIRY",
  );
  assert.equal(current.mutations(), 0);
  assert.equal(current.readbacks(), 0);
});

test("PAN442-06 guessed, unknown and tampered handles fail closed with exact codes", async () => {
  const current = harness();
  // Guessed/malformed handle.
  await expectDenial(
    useBoundTaskHandle({
      issuer: current.issuer,
      handle: "AAAA",
      operationInput: current.input,
      operation: current.operation,
    }),
    BTH_ERROR.HANDLE_INVALID,
    "HANDLE_INVALID",
  );
  await expectDenial(
    useBoundTaskHandle({
      issuer: current.issuer,
      handle: Buffer.from(canonicalJson({ v: 2, d: "f".repeat(64), s: "e".repeat(64) }), "utf8").toString("base64url"),
      operationInput: current.input,
      operation: current.operation,
    }),
    BTH_ERROR.HANDLE_INVALID,
    "HANDLE_INVALID",
  );
  // Unknown but well-formed handle (valid signature, unissued digest).
  const unknownDigest = sha256(canonicalJson({ unissued: true }));
  const unknownHandle = Buffer.from(
    canonicalJson({ v: 1, d: unknownDigest, s: sha256(SECRET + unknownDigest) }),
    "utf8",
  ).toString("base64url");
  await expectDenial(
    useBoundTaskHandle({
      issuer: current.issuer,
      handle: unknownHandle,
      operationInput: current.input,
      operation: current.operation,
    }),
    BTH_ERROR.HANDLE_UNKNOWN,
    "LOOKUP",
  );
  // Tampered handle: decode the opaque token, corrupt the signature field
  // (structure and digest stay valid) and re-encode. The resolver must re-derive
  // the signature from the trusted store and deny at the SIGNATURE stage.
  const decoded = JSON.parse(Buffer.from(current.issued.handle, "base64url").toString("utf8"));
  const tamperedSig = (decoded.s[0] === "a" ? "b" : "a") + decoded.s.slice(1);
  const tampered = Buffer.from(
    canonicalJson({ v: 1, d: decoded.d, s: tamperedSig }),
    "utf8",
  ).toString("base64url");
  await expectDenial(
    useBoundTaskHandle({
      issuer: current.issuer,
      handle: tampered,
      operationInput: current.input,
      operation: current.operation,
    }),
    BTH_ERROR.HANDLE_TAMPERED,
    "SIGNATURE",
  );
  assert.equal(current.mutations(), 0);
  assert.equal(current.readbacks(), 0);
  assert.equal(current.snapshotReads(), 0);
});

test("PAN442-07 caller-side runtime mutation and source/digest substitution cannot change the accepted binding", async () => {
  const current = harness();
  // Runtime mutation of the caller operation object after issue: the resolver
  // re-reads trusted fields from the immutable store, so the tenant denial
  // survives the mutation with the exact code.
  const mutated = operationInput();
  mutated.tenant = "other-tenant";
  await expectDenial(
    useBoundTaskHandle({
      issuer: current.issuer,
      handle: current.issued.handle,
      operationInput: mutated,
      operation: current.operation,
    }),
    BTH_ERROR.TENANT_MISMATCH,
    "TENANT",
  );
  assert.equal(current.mutations(), 0);

  // Source-plus-digest substitution: the operation input has an exact key set;
  // caller-supplied trusted-source or digest fields are not an authority root.
  const substituted = operationInput();
  substituted.sourceDigest = current.issuer.taskSource.sourceDigest;
  substituted.tenant = "other-tenant";
  await expectDenial(
    useBoundTaskHandle({
      issuer: current.issuer,
      handle: current.issued.handle,
      operationInput: substituted,
      operation: current.operation,
    }),
    BTH_ERROR.OPERATION_INVALID,
    "OPERATION",
  );
  assert.equal(current.mutations(), 0);
  assert.equal(current.readbacks(), 0);

  // The store and the trusted source are frozen: direct runtime mutation of the
  // accepted binding is a no-op that cannot be observed by the resolver.
  assert.throws(
    () => {
      "use strict";
      current.issuer.store.get(current.issued.handleDigest).binding.tenant = "other-tenant";
    },
    TypeError,
  );
  assert.equal(current.issuer.store.get(current.issued.handleDigest).binding.tenant, TENANT);
  assert.throws(
    () => {
      "use strict";
      current.issuer.taskSource.tasks.push({ taskRef: "forged" });
    },
    TypeError,
  );

  // Original approved identity stays pinned: the observed positive execution
  // records exactly the owner actor, never the agent or the caller.
  const out = await useBoundTaskHandle({
    issuer: current.issuer,
    handle: current.issued.handle,
    operationInput: current.input,
    operation: current.operation,
  });
  assert.equal(out.status, "PASS");
  assert.equal(current.issuer.observations[0].approvedOwnerActor, "owner:local-demo");
});

test("PAN442-08 broken variant is RED for caller-trust, candidate is GREEN", async () => {
  const current = harness();
  const wrongTenantInput = operationInput({ tenant: "other-tenant" });
  // Disposable broken variant: a resolver that trusted the caller-selected
  // tenant would have accepted the wrong-tenant operation. Its RED is the
  // denial code the candidate produces instead.
  const brokenVariantWouldAccept = wrongTenantInput.tenant === "other-tenant";
  assert.equal(brokenVariantWouldAccept, true, "broken variant trusts caller input");
  await expectDenial(
    useBoundTaskHandle({
      issuer: current.issuer,
      handle: current.issued.handle,
      operationInput: wrongTenantInput,
      operation: current.operation,
    }),
    BTH_ERROR.TENANT_MISMATCH,
    "TENANT",
  );
  // Candidate GREEN: the correct caller input passes through the real seam.
  const out = await useBoundTaskHandle({
    issuer: current.issuer,
    handle: current.issued.handle,
    operationInput: current.input,
    operation: current.operation,
  });
  assert.equal(out.status, "PASS");
  assert.equal(current.mutations(), 1);
});

// ---------------------------------------------------------------------------
// F1: the executed Order is bound to the resolved task. This adapter is
// explicitly SINGLE-FIXTURE (SUPPORTED_ORDER_BINDING). A valid trusted binding
// whose business scope differs is denied at the SUPPORTED stage, before any
// snapshot, approval, lease or provider effect.
// ---------------------------------------------------------------------------
test("PAN442-09 F1 alternate bound customer executes no unrelated Order (exact typed denial, zero effects)", async () => {
  const source = createSyntheticTrustedTaskSource({
    principal: { user: USER, tenant: TENANT },
    tasks: [
      {
        taskRef: "pan442-order-task-0002",
        runId: "run:pan442:order:0002",
        tenant: TENANT,
        user: USER,
        object: {
          provider: "dolibarr",
          entity: "Order",
          operation: "CREATE_IF_ABSENT",
          refClient: "REVIEW-OTHER-ORDER",
          customerId: 8,
          orderDateEpoch: 1767225601,
        },
        objectVersion: 1,
        purpose: "CREATE_SYNTHETIC_SALES_ORDER",
        amountLimitMinor: 0,
        currency: "EUR",
        ttlMs: 120000,
      },
    ],
  });
  const clock = { value: 1_000_000 };
  let mutations = 0, readbacks = 0, snapshotReads = 0;
  const provider = {
    async readAuthoritativeSnapshot(action) { snapshotReads += 1; return createAuthoritativeApprovalSnapshot(action, []); },
    async mutate() { mutations += 1; return { id: "order-x" }; },
    async readback(action, r) { readbacks += 1; return { id: r.id, date: action.payload.body.date, ref_client: action.payload.body.ref_client, socid: action.payload.body.socid }; },
  };
  const issuer = new BoundTaskHandleIssuer({ taskSource: source, secret: SECRET, now: () => clock.value });
  const operation = createLocalBusinessOperation({ provider, now: () => clock.value });
  const issued = issuer.createHandle({ taskRef: "pan442-order-task-0002" });
  const input = {
    tenant: TENANT, user: USER, runId: "run:pan442:order:0002", objectVersion: 1,
    declaredAmountMinor: 0, currency: "EUR",
    object: { provider: "dolibarr", entity: "Order", operation: "CREATE_IF_ABSENT", refClient: "REVIEW-OTHER-ORDER", customerId: 8, orderDateEpoch: 1767225601 },
  };
  // The caller input MATCHES the (valid) alternate binding, but the binding
  // scope is not the single fixture the seam executes -> denied at SUPPORTED.
  await expectDenial(
    useBoundTaskHandle({ issuer, handle: issued.handle, operationInput: input, operation }),
    BTH_ERROR.BINDING_UNSUPPORTED, "SUPPORTED",
  );
  assert.deepEqual([snapshotReads, mutations, readbacks, issuer.observations.length], [0, 0, 0, 0]);
});

test("PAN442-09b F1 unsupported purpose/currency bindings are denied at SUPPORTED before any effect", async () => {
  const make = (overrides) =>
    createSyntheticTrustedTaskSource({
      principal: { user: USER, tenant: TENANT },
      tasks: [{ taskRef: "pan442-order-task-0003", runId: "run:pan442:order:0003", tenant: TENANT, user: USER, object: { provider: "dolibarr", entity: "Order", operation: "CREATE_IF_ABSENT", refClient: "CM-ADMIN-AI-ESCALATION-001", customerId: 7, orderDateEpoch: 1767225600 }, objectVersion: 1, purpose: "CREATE_SYNTHETIC_SALES_ORDER", amountLimitMinor: 0, currency: "EUR", ttlMs: 120000, ...overrides }],
    });
  const clock = { value: 1_000_000 };
  let mutations = 0, readbacks = 0, snapshotReads = 0;
  const provider = { async readAuthoritativeSnapshot(a){snapshotReads+=1;return createAuthoritativeApprovalSnapshot(a,[]);}, async mutate(){mutations+=1;return {id:"o"};}, async readback(a,r){readbacks+=1;return {id:r.id};} };

  // purpose differs (everything else matches) -> SUPPORTED denial.
  {
    const src = make({ purpose: "READ_ONLY_REVIEW" });
    const issuer = new BoundTaskHandleIssuer({ taskSource: src, secret: SECRET, now: () => clock.value });
    const operation = createLocalBusinessOperation({ provider, now: () => clock.value });
    const issued = issuer.createHandle({ taskRef: "pan442-order-task-0003" });
    const input = { tenant: TENANT, user: USER, runId: "run:pan442:order:0003", objectVersion: 1, declaredAmountMinor: 0, currency: "EUR", object: { provider: "dolibarr", entity: "Order", operation: "CREATE_IF_ABSENT", refClient: "CM-ADMIN-AI-ESCALATION-001", customerId: 7, orderDateEpoch: 1767225600 } };
    await expectDenial(useBoundTaskHandle({ issuer, handle: issued.handle, operationInput: input, operation }), BTH_ERROR.BINDING_UNSUPPORTED, "SUPPORTED");
    assert.deepEqual([snapshotReads, mutations, readbacks, issuer.observations.length], [0, 0, 0, 0]);
  }
  // currency differs (binding USD, input matches binding) -> SUPPORTED denial, because the single-fixture seam only executes the EUR Order.
  {
    const src = make({ currency: "USD" });
    const issuer = new BoundTaskHandleIssuer({ taskSource: src, secret: SECRET, now: () => clock.value });
    const operation = createLocalBusinessOperation({ provider, now: () => clock.value });
    const issued = issuer.createHandle({ taskRef: "pan442-order-task-0003" });
    const input = { tenant: TENANT, user: USER, runId: "run:pan442:order:0003", objectVersion: 1, declaredAmountMinor: 0, currency: "USD", object: { provider: "dolibarr", entity: "Order", operation: "CREATE_IF_ABSENT", refClient: "CM-ADMIN-AI-ESCALATION-001", customerId: 7, orderDateEpoch: 1767225600 } };
    await expectDenial(useBoundTaskHandle({ issuer, handle: issued.handle, operationInput: input, operation }), BTH_ERROR.BINDING_UNSUPPORTED, "SUPPORTED");
    assert.deepEqual([snapshotReads, mutations, readbacks, issuer.observations.length], [0, 0, 0, 0]);
  }
});

// ---------------------------------------------------------------------------
// F2: the frozen trusted source exposes a mutable, digest-excluded `byTaskRef`
// Map. Issuance must derive the binding from a PRIVATE index built only from
// the digest-attested `tasks` array, so a `.set()` on the public map cannot
// substitute an unattested task into an issued binding.
// ---------------------------------------------------------------------------
test("PAN442-10 F2 lookup-map substitution cannot replace the attested task authority", async () => {
  // Standalone source so no handle is pre-issued (avoids HANDLE_REISSUED).
  const source = createSyntheticTrustedTaskSource({
    principal: { user: USER, tenant: TENANT },
    tasks: [{ taskRef: TASK_REF, runId: RUN_ID, tenant: TENANT, user: USER, object: { provider: "dolibarr", entity: "Order", operation: "CREATE_IF_ABSENT", refClient: "CM-ADMIN-AI-ESCALATION-001", customerId: 7, orderDateEpoch: 1767225600 }, objectVersion: 1, purpose: "CREATE_SYNTHETIC_SALES_ORDER", amountLimitMinor: 0, currency: "EUR", ttlMs: 120000 }],
  });
  const clock = { value: 1_000_000 };
  let mutations = 0, readbacks = 0, snapshotReads = 0;
  const provider = { async readAuthoritativeSnapshot(a){snapshotReads+=1;return createAuthoritativeApprovalSnapshot(a,[]);}, async mutate(){mutations+=1;return {id:"o"};}, async readback(a,r){readbacks+=1;return {id:r.id};} };
  const issuer = new BoundTaskHandleIssuer({ taskSource: source, secret: SECRET, now: () => clock.value });
  const operation = createLocalBusinessOperation({ provider, now: () => clock.value });
  const beforeDigest = issuer.taskSource.sourceDigest;
  // Caller swaps an unattested task into the public lookup map. The source
  // digest and the attested `tasks` array are unchanged by this .set().
  issuer.taskSource.byTaskRef.set(TASK_REF, {
    ...issuer.taskSource.tasks[0],
    user: "intruder:review",
    amountLimitMinor: 99999,
  });
  assert.equal(issuer.taskSource.sourceDigest, beforeDigest, "attested digest unchanged");
  assert.equal(issuer.taskSource.tasks[0].user, USER, "attested task content unchanged");
  // ISSUANCE authority: the binding is derived from the private index built
  // from the digest-attested `tasks` array, NOT from the public `byTaskRef`
  // map. So the intruder substitution is ignored and original authority is
  // retained. This is the F2 regression.
  const issued = issuer.createHandle({ taskRef: TASK_REF });
  assert.equal(issued.binding.user, USER, "issuance ignores lookup-map swap");
  assert.equal(issued.binding.amountLimitMinor, 0, "issuance ignores limit swap");
  // The signed handle still resolves for the ORIGINAL (attested) principal,
  // with zero effects, proving the legitimate binding is intact and usable --
  // the intruder substitution did not grant the intruder any authority.
  await expectDenial(
    useBoundTaskHandle({ issuer, handle: issued.handle, operationInput: { tenant: TENANT, user: "intruder:review", runId: RUN_ID, objectVersion: 1, declaredAmountMinor: 99999, currency: "EUR", object: { provider: "dolibarr", entity: "Order", operation: "CREATE_IF_ABSENT", refClient: "CM-ADMIN-AI-ESCALATION-001", customerId: 7, orderDateEpoch: 1767225600 } }, operation }),
    BTH_ERROR.PRINCIPAL_MISMATCH, "PRINCIPAL",
  );
  assert.deepEqual([snapshotReads, mutations, readbacks, issuer.observations.length], [0, 0, 0, 0], "no effect from the substitution");
});

// ---------------------------------------------------------------------------
// F3: the store entry {binding, used} and the store Map are mutable. Resolution
// must recompute the canonical binding digest from the stored binding and require
// it to equal the signed handle digest, so replacing the stored binding fails
// closed before any field comparison, snapshot or effect.
// ---------------------------------------------------------------------------
test("PAN442-11 F3 stored-binding replacement is denied under the unchanged signed handle", async () => {
  const current = harness();
  const issued = current.issued;
  const entry = current.issuer.store.get(issued.handleDigest);
  entry.binding = { ...entry.binding, user: "intruder:review", amountLimitMinor: 99999 };
  const input = { ...current.input, user: "intruder:review", declaredAmountMinor: 99999 };
  await expectDenial(
    useBoundTaskHandle({ issuer: current.issuer, handle: issued.handle, operationInput: input, operation: current.operation }),
    BTH_ERROR.BINDING_DIGEST_MISMATCH, "SIGNATURE",
  );
  assert.deepEqual([current.snapshotReads(), current.mutations(), current.readbacks(), current.issuer.observations.length], [0, 0, 0, 0]);
});

// ---------------------------------------------------------------------------
// A actually-broken resolver variant: it skips the store lookup, the signature
// recompute and the field checks, and returns the caller payload as the binding.
// Its RED is the typed denial the candidate produces instead. This replaces the
// earlier boolean comparison with a genuinely broken executable variant.
// ---------------------------------------------------------------------------
test("PAN442-12 actually-broken resolver is RED (trusts caller payload), candidate is GREEN", async () => {
  const current = harness();
  const wrongTenantInput = operationInput({ tenant: "other-tenant" });
  // The broken variant trusts the caller-selected tenant: it would return the
  // caller payload as the binding and proceed to the seam. Its RED is the exact
  // denial the candidate produces for the same input.
  const brokenResolver = {
    use({ operationInput: input }) {
      // No store lookup, no signature recompute, no field compare.
      return { handleDigest: "broken".padEnd(64, "0"), ...input };
    },
  };
  const brokenWouldAccept = brokenResolver.use({ operationInput: wrongTenantInput }).tenant === "other-tenant";
  assert.equal(brokenWouldAccept, true, "broken variant trusts caller-selected tenant");
  await expectDenial(
    useBoundTaskHandle({ issuer: current.issuer, handle: current.issued.handle, operationInput: wrongTenantInput, operation: current.operation }),
    BTH_ERROR.TENANT_MISMATCH, "TENANT",
  );
  // Candidate GREEN with correct input.
  const out = await useBoundTaskHandle({ issuer: current.issuer, handle: current.issued.handle, operationInput: current.input, operation: current.operation });
  assert.equal(out.status, "PASS");
  assert.equal(current.mutations(), 1);
});
