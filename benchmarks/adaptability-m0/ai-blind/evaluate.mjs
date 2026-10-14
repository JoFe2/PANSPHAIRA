#!/usr/bin/env node
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import {
  createBuilderCore,
  digest,
  exactObject,
  validateRuntimeContract,
} from "../../../demo/builder-agent/builder-core.mjs";
import { genericConsumer, sourceSha256 } from "../run.mjs";

const root = resolve(import.meta.dirname, "../../..");
const inputBytes = readFileSync(resolve(import.meta.dirname, "participant-input.json"));
const input = JSON.parse(inputBytes);
// Exact versioned reference bytes are embedded in this existing legacy member.
// The additive source mirror is not an eager runtime dependency of legacy1792.
const expectationBytes = Buffer.from(input.semanticExpectationJson, "utf8");
const expected = JSON.parse(expectationBytes);
const scenarios = ["DEFAULT", "EXTRA_PERSISTED_EFFECT", "ROLLBACK_PERSISTENCE_FAILURE", "FOREIGN_REQUEST_TENANT"];
const same = (left, right) => left === undefined || right === undefined
  ? left === right : digest(left) === digest(right);

function rejectUnsafeKeys(value) {
  if (Array.isArray(value)) return value.every(rejectUnsafeKeys);
  if (value === null || typeof value !== "object") return true;
  return Object.entries(value).every(([key, nested]) => (
    !/(?:credential|password|secret|token|activation|command)/i.test(key)
    && rejectUnsafeKeys(nested)
  ));
}

// These closed synthetic fault scenarios can only introduce a contradiction or
// denial. No caller-supplied executor, expected values, state or oracle is used.
function memoryStore(scenario) {
  let value;
  let activeOperation = null;
  let applied = false;
  const snapshots = [];
  return {
    snapshots,
    setActiveOperation: (operation) => { activeOperation = operation; },
    loadState: () => value === undefined ? undefined : structuredClone(value),
    persistState(next) {
      const persisted = structuredClone(next);
      if (activeOperation === expected.write.operationId) {
        if (scenario === "EXTRA_PERSISTED_EFFECT" && same(persisted.target, expected.write.expectedAppliedState)) {
          persisted.target[expected.read.field] = expected.read.value + 1;
        }
        if (scenario === "ROLLBACK_PERSISTENCE_FAILURE") {
          if (same(persisted.target, expected.write.expectedAppliedState)) applied = true;
          else if (applied && same(persisted.target, expected.write.expectedRestoredState)) {
            snapshots.push({ operationId: activeOperation, persisted: false, target: structuredClone(value.target) });
            return;
          }
        }
      }
      value = persisted;
      snapshots.push({ operationId: activeOperation, persisted: true, target: structuredClone(value.target) });
    },
  };
}

function observeExecution(candidate, scenario) {
  const store = memoryStore(scenario);
  const calls = [];
  const core = createBuilderCore({ contract: candidate, workloadIdentity: "benchmark:ai-blind-candidate", loadState: store.loadState, persistState: store.persistState });
  const observed = {
    contract: core.contract,
    requestTemplate: core.requestTemplate,
    execute(request) {
      const dispatched = structuredClone(request);
      if (scenario === "FOREIGN_REQUEST_TENANT") dispatched.tenant = "synthetic-foreign-request";
      const call = { request: dispatched, targetBefore: store.loadState().target, snapshotStart: store.snapshots.length };
      store.setActiveOperation(dispatched.operationId);
      try {
        const result = core.execute(dispatched);
        call.result = structuredClone(result);
        return result;
      } catch (error) {
        call.error = error.message;
        throw error;
      } finally {
        call.targetAfter = store.loadState().target;
        call.snapshotEnd = store.snapshots.length;
        calls.push(call);
        store.setActiveOperation(null);
      }
    },
  };
  let first; let retry; let failure = null;
  try {
    first = genericConsumer(observed);
    retry = genericConsumer(observed);
  } catch (error) {
    failure = error.message;
  }
  const beforeReset = core.evidence();
  const targetBeforeReset = store.loadState().target;
  const targetSnapshots = structuredClone(store.snapshots);
  // Do not erase an unresolved effect to manufacture zero residue/success.
  const resetAttempted = same(targetBeforeReset, expected.write.expectedRestoredState);
  let reset;
  if (resetAttempted) reset = core.reset({ tenant: candidate.target.tenant, systemId: candidate.target.systemId });
  const afterReset = store.loadState();
  return {
    calls,
    targetSnapshots,
    targetBeforeReset,
    resetAttempted,
    failure,
    readbackCount: first ? Number(first.read.readback !== undefined) + Number(first.write.readback !== undefined) : calls.filter((c) => c.result?.readback !== undefined).length,
    retrySameReceiptCount: first && retry ? Number(retry.read.receipt.receiptDigest === first.read.receipt.receiptDigest) + Number(retry.write.receipt.receiptDigest === first.write.receipt.receiptDigest) : 0,
    rollbackVerified: first ? first.write.receipt.beforeDigest === first.write.receipt.finalDigest && same(targetBeforeReset, expected.write.expectedRestoredState) : false,
    ownedTargetDrift: same(targetBeforeReset, expected.write.expectedRestoredState) ? 0 : 1,
    coreReportedOwnedTargetDrift: beforeReset.ownedTargetDrift,
    residueReceiptCount: Object.keys(afterReset.receipts).length,
    residueTargetDrift: same(afterReset.target, expected.target.initialState) ? 0 : 1,
    retainedReceiptDigestCount: reset?.retainedReceiptDigests.length ?? null,
    modelCalls: beforeReset.counters.modelCalls,
  };
}

function gradeSemantics(candidate, execution, expect) {
  const read = candidate.admittedCapabilities.find((op) => op.capabilityId === expected.read.operationId);
  const write = candidate.admittedCapabilities.find((op) => op.capabilityId === expected.write.operationId);
  expect(read.adapter.stateField === expected.read.field, "SEMANTIC_READ_FIELD_MISMATCH");
  expect(write.adapter.stateField === expected.write.field, "SEMANTIC_WRITE_FIELD_MISMATCH");
  expect(read.adapter.unit === undefined || expected.read.unitAliases.includes(read.adapter.unit), "SEMANTIC_READ_UNIT_MISMATCH");
  expect(write.adapter.unit === undefined || expected.write.unitAliases.includes(write.adapter.unit), "SEMANTIC_WRITE_UNIT_MISMATCH");
  const readCall = execution.calls.find((c) => c.request.operationId === expected.read.operationId);
  const writeCall = execution.calls.find((c) => c.request.operationId === expected.write.operationId);
  if (readCall?.result) {
    const result = readCall.result.readback;
    expect(result?.valueField === expected.read.field, "SEMANTIC_READ_FIELD_MISMATCH");
    expect(result?.value === expected.read.value && readCall.targetBefore[expected.read.field] === expected.read.value, "SEMANTIC_READ_VALUE_MISMATCH");
    expect(result?.entity === expected.target.entity && readCall.request.payload[read.adapter.entityPayloadField] === expected.target.entity, "SEMANTIC_READ_ENTITY_MISMATCH");
    expect(same(readCall.targetBefore, readCall.targetAfter), "SEMANTIC_READ_CHANGED_TARGET");
  }
  if (writeCall?.result) {
    const result = writeCall.result.readback;
    expect(result?.valueField === expected.write.field, "SEMANTIC_WRITE_FIELD_MISMATCH");
    expect(writeCall.request.payload[write.adapter.payloadField] === expected.write.payloadValue && result?.appliedValue === expected.write.payloadValue && result?.priorValue === expected.write.priorValue, "SEMANTIC_WRITE_VALUE_MISMATCH");
    expect(result?.entity === expected.target.entity && writeCall.request.payload[write.adapter.entityPayloadField] === expected.target.entity, "SEMANTIC_WRITE_ENTITY_MISMATCH");
  }
  const persisted = execution.targetSnapshots.filter((s) => s.persisted);
  expect(persisted.some((s) => s.operationId === expected.write.operationId && same(s.target, expected.write.expectedAppliedState)), "SEMANTIC_APPLIED_TARGET_NOT_OBSERVED");
  expect(persisted.every((s) => same(s.target, expected.target.initialState) || (s.operationId === expected.write.operationId && same(s.target, expected.write.expectedAppliedState))), "SEMANTIC_UNPERMITTED_TARGET_EFFECT");
  expect(same(execution.targetBeforeReset, expected.write.expectedRestoredState), "SEMANTIC_RESTORED_TARGET_MISMATCH");
  expect(execution.modelCalls === 0, "MODEL_CALL_COUNTER_NONZERO");
}

export function evaluateCandidate(candidatePath, options = {}) {
  const issues = [];
  const expect = (condition, code) => { if (!condition) issues.push(code); };
  const caseId = options.caseId ?? expected.caseId;
  const scenario = options.scenario ?? "DEFAULT";
  const coreBytes = readFileSync(resolve(root, input.baseline.corePath));
  const bindings = {
    caseId,
    scenario,
    candidateRawSHA256: null,
    checkerSHA256: sourceSha256(readFileSync(import.meta.filename)),
    expectedContractSHA256: sourceSha256(expectationBytes),
    participantInputSHA256: sourceSha256(inputBytes),
    coreSHA256: sourceSha256(coreBytes),
    consumerSHA256: sourceSha256(genericConsumer.toString()),
    runtime: process.version,
    target: structuredClone(expected.target),
  };
  let candidate; let execution = null;
  function finish(outcome) {
    const body = {
      schemaVersion: "chimpmaera.adaptability-ai-blind-evaluation/v2",
      taskId: input.taskId,
      status: outcome === "SEMANTIC_SUCCESS" ? "PASS" : "FAIL",
      outcome,
      issues: [...new Set(issues)].sort(),
      bindings,
      execution,
      semanticUnitEvidence: "PUBLIC_REFERENCE_NAMED_FIELD_UNIT_NOT_A_PHYSICAL_SENSOR_OR_CALLER_UNIT_MEASUREMENT",
      claimBoundary: "LOCAL_SYNTHETIC_ISOLATED_EVALUATION_ONLY_NO_SPEED_OR_PRODUCTION_CLAIM",
    };
    return { ...body, evidenceDigest: sourceSha256(JSON.stringify(body)) };
  }
  try {
    const bytes = readFileSync(resolve(candidatePath));
    bindings.candidateRawSHA256 = sourceSha256(bytes);
    candidate = JSON.parse(bytes);
  } catch (error) {
    issues.push(error instanceof SyntaxError ? "CANDIDATE_JSON_INVALID" : "CANDIDATE_UNAVAILABLE");
    return finish("NOT_RUN");
  }
  expect(bindings.coreSHA256 === input.baseline.coreSha256, "FROZEN_CORE_DIGEST_MISMATCH");
  expect(bindings.consumerSHA256 === input.baseline.consumerSha256, "FROZEN_CONSUMER_DIGEST_MISMATCH");
  expect(typeof caseId === "string" && /^[A-Za-z0-9][A-Za-z0-9._:-]{0,159}$/.test(caseId), "CASE_ID_INVALID");
  expect(scenarios.includes(scenario), "QUALIFICATION_SCENARIO_INVALID");
  expect(exactObject(options, Object.keys(options)) && Object.keys(options).every((k) => ["caseId", "scenario"].includes(k)), "EVALUATOR_OPTIONS_NOT_CLOSED");
  if (issues.length) return finish("NOT_RUN");
  expect(exactObject(candidate, ["schemaVersion", "claimId", "fixtureId", "ownershipLabel", "runtime", "builderProfile", "target", "admittedCapabilities", "syntheticOwnerApprovals", "nonClaims"]), "CANDIDATE_TOP_LEVEL_NOT_CLOSED");
  expect(rejectUnsafeKeys(candidate), "AUTHORITY_OR_SECRET_SHAPED_KEY_DENIED");
  try { validateRuntimeContract(candidate); } catch (error) { issues.push(error.message); }
  const discovery = input.providerBDiscovery;
  expect(candidate?.target?.tenant === discovery.tenant, "TARGET_TENANT_MISMATCH");
  expect(candidate?.target?.systemId === discovery.systemId, "TARGET_SYSTEM_ID_MISMATCH");
  expect(candidate?.target?.systemType === discovery.systemType, "TARGET_SYSTEM_TYPE_MISMATCH");
  expect(candidate?.target?.dataClassification === discovery.dataClassification, "TARGET_CLASSIFICATION_MISMATCH");
  expect(same(candidate?.target?.initialState, discovery.initialState), "TARGET_INITIAL_STATE_MISMATCH");
  expect(candidate?.runtime?.network === "synthetic-in-memory-only", "EXTERNAL_NETWORK_DENIED");
  expect(candidate?.runtime?.role === "UNTRUSTED_BUILDER_AGENT_NOT_POLICY_AUTHORITY_OR_EFFECT_PLANE", "BUILDER_ROLE_MISMATCH");
  const operations = (Array.isArray(candidate?.admittedCapabilities) ? candidate.admittedCapabilities : []).map((entry) => ({
    capabilityId: entry?.capabilityId,
    effectClass: entry?.effectClass,
    adapterKind: entry?.adapter?.kind,
    ...(entry?.admissionRecord?.recovery ? { recovery: entry.admissionRecord.recovery } : {}),
  })).sort((left, right) => String(left.capabilityId).localeCompare(String(right.capabilityId)));
  const expectedOperations = structuredClone(discovery.operations).sort((left, right) => left.capabilityId.localeCompare(right.capabilityId));
  expect(same(operations, expectedOperations), "OPERATION_SET_MISMATCH");
  if (issues.length) return finish("CONTROLLED_REJECTION");
  try {
    execution = observeExecution(candidate, scenario);
    gradeSemantics(candidate, execution, expect);
  } catch (error) {
    issues.push(error.message);
    return finish("NOT_RUN");
  }
  if (execution.failure) {
    issues.push(execution.failure);
    if (!same(execution.targetBeforeReset, expected.write.expectedRestoredState)) return finish("MANUAL_REPAIR_REQUIRED");
    return finish(/DENIED|INVALID/.test(execution.failure) ? "CONTROLLED_REJECTION" : "NOT_RUN");
  }
  expect(execution.readbackCount === 2, "READBACK_COUNT_MISMATCH");
  expect(execution.retrySameReceiptCount === 2, "RETRY_RECEIPT_MISMATCH");
  expect(execution.rollbackVerified, "ROLLBACK_NOT_VERIFIED");
  expect(execution.ownedTargetDrift === 0, "TARGET_DRIFT_NONZERO");
  expect(execution.residueReceiptCount === 0 && execution.residueTargetDrift === 0, "RESIDUE_NONZERO");
  return finish(issues.length ? "SEMANTIC_CONTRADICTION" : "SEMANTIC_SUCCESS");
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  if (process.argv.length !== 3) throw new Error("USAGE: node evaluate.mjs CANDIDATE_JSON");
  const result = evaluateCandidate(process.argv[2]);
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  if (result.status !== "PASS") process.exitCode = 1;
}
