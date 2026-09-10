import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  AP06_EXACT_HEAD_V1,
  generateIncomingInvoiceAp06ProofProbeV1,
  verifyIncomingInvoiceAp06ProofProbeV1,
  type IncomingInvoiceAp06ProofProbeInputV1,
} from "../packages/contracts/src/index.js";

const SETUP = "tests/fixtures/incoming-invoice/ap-05-frozen-setup-v1.json";
const ERV_SOURCE = "packages/contracts/src/incoming-invoice-erv.ts";
const ERV_SCHEMA = "schemas/contracts/incoming-invoice-erv-v1.schema.json";

// Byte-identical released predecessor sources (same releaseId + path the module binds).
const OBLIGATIONS: ReadonlyArray<Readonly<{ releaseId: string; path: string }>> = [
  { releaseId: "ap01-blueprint-source-v1", path: "packages/contracts/src/incoming-invoice-blueprint.ts" },
  { releaseId: "ap02-intake-source-v1", path: "packages/contracts/src/incoming-invoice-intake.ts" },
  { releaseId: "ap02-intake-source-v1", path: "tests/fixtures/incoming-invoice/supplier-invoice-v1.txt" },
  { releaseId: "extraction-benchmark-source-v1", path: "packages/contracts/src/incoming-invoice-extraction-benchmark.ts" },
  { releaseId: "ap03-holdout-source-v1", path: "tests/fixtures/incoming-invoice/ap-03-holdout-v1.json" },
  { releaseId: "ap04-erv-core-v1", path: ERV_SOURCE },
  { releaseId: "ap04-erv-core-v1", path: "tests/fixtures/incoming-invoice/ap-04-erv-cases-v1.json" },
  { releaseId: "ap04-erv-core-v1", path: ERV_SCHEMA },
  { releaseId: "pan365-adaptive-ui-source-v1", path: "packages/contracts/src/incoming-invoice-adaptive-ui.ts" },
  { releaseId: "pan365-ap05-receipt-manifest-source-v1", path: "packages/contracts/src/incoming-invoice-ap05-receipt-manifest.ts" },
];

function bytes(path: string): Uint8Array {
  return Uint8Array.from(readFileSync(path));
}
function input(): IncomingInvoiceAp06ProofProbeInputV1 {
  return {
    setup: JSON.parse(readFileSync(SETUP, "utf8")),
    predecessorSources: OBLIGATIONS.map(({ releaseId, path }) => ({ releaseId, path, bytes: bytes(path) })),
  };
}
function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

test("AP-06 proof probe regenerates byte-for-byte and binds the released capability chain", async () => {
  const first = await generateIncomingInvoiceAp06ProofProbeV1(input());
  const replay = await generateIncomingInvoiceAp06ProofProbeV1(input());
  assert.equal(first.serialized, replay.serialized);
  assert.equal(first.probe.exactHead, AP06_EXACT_HEAD_V1);
  assert.equal(first.probe.schemaVersion, "chimpmaera.incoming-invoice/ap06-proof-probe/v1");
  assert.equal(first.probe.verdict.value, "NARROW_GO");
  assert.equal(first.probe.chain.length, 8);
  // Positive, duplicate, tamper, mismatch, three typed-UNKNOWN, cancellation, replay.
  assert.equal(first.probe.caseMatrix.length, 9);
  for (const row of first.probe.caseMatrix) assert.equal(row.matchesOracle, true);

  const matchingLayer = first.probe.chain.find((layer) => layer.layerId === "MATCHING");
  assert.ok(matchingLayer);
  assert.equal(matchingLayer.capabilityId, "chimpmaera.incoming-invoice/erv-core/v1");
  assert.equal(matchingLayer.moduleIdentity.sha256, "6ba5250783df35f60602a11437c843272ab014bf24e69135cfbf52dfb41750cf");
  assert.equal(matchingLayer.moduleIdentity.byteLength, 21114);

  const variantProof = first.probe.variantProof;
  assert.equal(variantProof.coreModuleDigestIdentical, true);
  assert.equal(variantProof.onlyRequirementConfigurationDiffer, true);
  assert.equal(variantProof.sharedCoreSourceDigest, "6ba5250783df35f60602a11437c843272ab014bf24e69135cfbf52dfb41750cf");
  assert.equal(variantProof.executions[0]!.label, "BASELINE");
  assert.equal(variantProof.executions[0]!.coreExecutable, true);
  assert.equal(variantProof.executions[0]!.coreOutcome, "MATCHED");
  assert.equal(variantProof.executions[0]!.coreSourceDigest, variantProof.sharedCoreSourceDigest);
  assert.equal(variantProof.executions[1]!.label, "CHANGED");
  assert.equal(variantProof.executions[1]!.coreExecutable, false);
  assert.equal(variantProof.executions[1]!.coreOutcome, "TYPED_UNKNOWN");
  assert.equal(variantProof.executions[1]!.coreSourceDigest, variantProof.sharedCoreSourceDigest);
  assert.equal(variantProof.requestedRateBasisPoints, 200);
  assert.equal(variantProof.releasedRateVariantRateBasisPoints, 100);
  assert.equal(variantProof.requestedRateHasReleasedVariant, false);
  assert.deepEqual(variantProof.requiredCapabilityIds, ["chimpmaera.incoming-invoice/erv-core/v1", "chimpmaera.incoming-invoice/erv-case-pack/v1"]);
  assert.notEqual(variantProof.executions[0]!.requirementDigest, variantProof.executions[1]!.requirementDigest);
  assert.notEqual(variantProof.executions[0]!.configurationDigest, variantProof.executions[1]!.configurationDigest);

  const advisor = first.probe.advisorDifference;
  assert.equal(advisor.differ, true);
  assert.equal(advisor.baselineAdvisorQuestionId, "ADV:two-way-matched-strict:MATCHED");
  assert.equal(advisor.changedAdvisorQuestionId, "ADV:two-way-unknown-variant-version:UNKNOWN_VARIANT");

  const [baselineUi, changedUi] = first.probe.uiProducerOutputs;
  assert.ok(baselineUi);
  assert.ok(changedUi);
  assert.deepEqual(baselineUi.fieldIds, ["supplier", "purchaseOrder", "invoice", "matchStatus", "evidenceReferences"]);
  assert.deepEqual(changedUi.fieldIds, ["supplier", "purchaseOrder", "receipt", "invoice", "matchStatus", "tolerancePolicy", "approvalTrail", "separationOfDuties", "evidenceReferences"]);
  assert.deepEqual(baselineUi.actionIds, ["VIEW_EVIDENCE", "ACKNOWLEDGE_MATCH"]);
  assert.deepEqual(changedUi.actionIds, ["VIEW_EVIDENCE", "PROVIDE_MISSING_CONTEXT"]);
  assert.notEqual(baselineUi.manifestDigest, changedUi.manifestDigest);
  assert.equal(baselineUi.scenario, "LEAN");
  assert.equal(changedUi.scenario, "SEGREGATED_ENTERPRISE");

  assert.equal(first.probe.releaseReadback.releaseStatus, "PENDING_EXACT_SOURCE_RELEASE");
  assert.equal(first.probe.releaseReadback.sourceCommit, null);
  assert.equal(first.probe.releaseReadback.namedScenarioPacks[0], "ap-04-local-synthetic-erv-cases-v1");
  assert.equal(first.probe.releaseReadback.deterministicReplay, true);

  assert.equal(first.probe.zeroResidue.pureFunction, true);
  assert.equal(first.probe.zeroResidue.noWrites, true);
  assert.equal(first.probe.zeroResidue.noClock, true);
  assert.equal(first.probe.zeroResidue.idempotentGeneration, true);
  assert.equal(first.probe.reuseReceipt.baselineUiManifestDigest, baselineUi.manifestDigest);
  assert.equal(first.probe.reuseReceipt.changedUiManifestDigest, changedUi.manifestDigest);
  assert.notEqual(first.probe.reuseReceipt.baselineUiManifestDigest, first.probe.reuseReceipt.changedUiManifestDigest);
});

test("AP-06 proof probe binds source, setup, variant and probe identities and matches the checked-in bytes", async () => {
  const generated = await generateIncomingInvoiceAp06ProofProbeV1(input());
  const checkedInBytes = readFileSync("verification/incoming-invoice-ap06-proof-probe-v1.json", "utf8");
  assert.equal(checkedInBytes, generated.serialized);
  assert.equal((await verifyIncomingInvoiceAp06ProofProbeV1(generated.probe, input())).valid, true);
  assert.match(generated.probe.proofProbeDigest, /^[a-f0-9]{64}$/);
  assert.match(generated.probe.reuseReceipt.receiptDigest, /^[a-f0-9]{64}$/);
  assert.match(generated.probe.releaseReadback.readbackDigest, /^[a-f0-9]{64}$/);
});

test("AP-06 verifier rejects omitted delta, invented capability, mutated identities and leakage", async () => {
  const generated: any = (await generateIncomingInvoiceAp06ProofProbeV1(input())).probe;
  const identityMutations: Array<[string, (value: any) => void]> = [
    ["omitted dialogue delta", (value) => { delete value.reuseReceipt.configurationDeltaDigest; }],
    ["invented capability", (value) => { value.reuseReceipt.reusedCapabilityIds.push("invented-capability-v1"); }],
    ["substituted core digest", (value) => { value.variantProof.sharedCoreSourceDigest = "1".repeat(64); }],
    ["re-digested probe", (value) => { value.proofProbeDigest = "2".repeat(64); }],
    ["tampered verdict", (value) => { value.verdict.value = "GO"; }],
    ["collapsed UI divergence", (value) => { value.uiProducerOutputs[1].fieldIds = value.uiProducerOutputs[0].fieldIds; }],
  ];
  for (const [name, mutate] of identityMutations) {
    const candidate = clone(generated);
    mutate(candidate);
    const result = await verifyIncomingInvoiceAp06ProofProbeV1(candidate, input());
    assert.equal(result.valid, false, name);
    assert.deepEqual(result.reasonCodes, ["PROBE_IDENTITY_MISMATCH"], name);
  }

  const leak: any = clone(generated);
  leak.releaseReadback.namedScenarioPacks[0] = "SYN-SUP-001";
  const leakResult = await verifyIncomingInvoiceAp06ProofProbeV1(leak, input());
  assert.equal(leakResult.valid, false);
  assert.deepEqual(leakResult.reasonCodes, ["PUBLIC_PROJECTION_LEAK"]);

  const nonObject = await verifyIncomingInvoiceAp06ProofProbeV1(null, input());
  assert.deepEqual(nonObject, { valid: false, reasonCodes: ["PROBE_SHAPE_DENIED"] });
});

test("AP-06 generator fails closed for substituted or missing source, unsupported capability and substituted answers", async () => {
  const coreMutation = input() as any;
  const coreIndex = coreMutation.predecessorSources.findIndex((source: { path: string }) => source.path === ERV_SOURCE);
  assert.ok(coreIndex >= 0);
  coreMutation.predecessorSources[coreIndex].bytes = Uint8Array.from([...coreMutation.predecessorSources[coreIndex].bytes, 0]);
  await assert.rejects(generateIncomingInvoiceAp06ProofProbeV1(coreMutation), /SOURCE_IDENTITY_MISMATCH/);

  const missingSchema = input() as any;
  missingSchema.predecessorSources = missingSchema.predecessorSources.filter((source: { path: string }) => source.path !== ERV_SCHEMA);
  await assert.rejects(generateIncomingInvoiceAp06ProofProbeV1(missingSchema), /SOURCE_MISSING/);

  const unsupported = input() as any;
  unsupported.setup.changed.requestedEffects = ["READ_SYNTHETIC", "POST_PRODUCTIVE"];
  await assert.rejects(generateIncomingInvoiceAp06ProofProbeV1(unsupported), /SETUP_DENIED/);

  const declined = input() as any;
  declined.setup.answers[1] = { questionId: "confirm:tolerance-policy", answer: "DECLINE" };
  await assert.rejects(generateIncomingInvoiceAp06ProofProbeV1(declined), /SETUP_ANSWERS_MISMATCH/);
});