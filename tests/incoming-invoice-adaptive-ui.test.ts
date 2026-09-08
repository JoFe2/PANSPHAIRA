import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import Ajv2020 from "ajv/dist/2020.js";
import {
  INCOMING_INVOICE_ADAPTIVE_UI_SCHEMA_V1,
  INCOMING_INVOICE_APPLICATION_GUIDE_V1,
  deriveIncomingInvoiceUiManifestV1,
  runIncomingInvoiceSetupAgentV1,
  type IncomingInvoiceErvRequirementV1,
  type IncomingInvoiceUiInputV1,
} from "../packages/contracts/src/index.js";

const allowedEffects = ["READ_SYNTHETIC", "WRITE_LOCAL_PROOF"] as const;

function requirement(
  requirementId: string,
  matchingMode: string,
  tolerancePolicy: string,
  evidenceRefs = ["evidence:ap04-synthetic-001"],
): IncomingInvoiceErvRequirementV1 {
  return {
    schemaVersion: "chimpmaera.incoming-invoice/erv-requirement/v1",
    requirementId,
    matchingMode: { variantId: matchingMode, version: "1.0.0" },
    tolerancePolicy: { variantId: tolerancePolicy, version: "1.0.0" },
    requestedEffects: allowedEffects,
    evidenceRefs,
    synthetic: true,
    customerData: false,
  };
}

function uiInput(
  outcome: IncomingInvoiceUiInputV1["evidence"]["outcome"],
): IncomingInvoiceUiInputV1 {
  return {
    schemaVersion: "chimpmaera.incoming-invoice/adaptive-ui/v1",
    scenario: "CONTROLLED",
    evidence: {
      outcome,
      matchingMode: { variantId: "THREE_WAY_INVOICE_PO_RECEIPT_V1", version: "1.0.0" },
      tolerancePolicy: { variantId: "ABS_MINOR_V1", version: "1.0.0" },
      references: [
        { kind: "SUPPLIER", referenceId: "SUP-SYN-001", verified: true, evidenceRef: "evidence:supplier-001" },
        { kind: "PURCHASE_ORDER", referenceId: "PO-SYN-001", verified: true, evidenceRef: "evidence:po-001" },
        { kind: "RECEIPT", referenceId: "RCV-SYN-001", verified: true, evidenceRef: "evidence:receipt-001" },
        { kind: "INVOICE", referenceId: "INV-SYN-001", verified: true, evidenceRef: "evidence:invoice-001" },
      ],
    },
    authority: {
      mode: "LOCAL_SYNTHETIC_PROOF",
      customerDataAuthorized: false,
      productiveBookingAuthorized: false,
      externalCallsAuthorized: false,
    },
  };
}

test("AP-05 derives explainable fields/actions from scenario and evidence state", () => {
  const result = deriveIncomingInvoiceUiManifestV1(uiInput("MATCHED"));
  assert.equal(result.outcome, "DERIVED");
  if (result.outcome !== "DERIVED") throw new Error("expected manifest");
  assert.deepEqual(result.manifest.fields.map(({ fieldId }) => fieldId), [
    "supplier",
    "purchaseOrder",
    "receipt",
    "invoice",
    "matchStatus",
    "tolerancePolicy",
    "evidenceReferences",
  ]);
  assert.deepEqual(result.manifest.actions.map(({ actionId }) => actionId), [
    "VIEW_EVIDENCE",
    "ACKNOWLEDGE_MATCH",
  ]);
  assert.equal(result.manifest.scenario, "CONTROLLED");
  assert.equal(result.manifest.authority.bookingAuthorityGranted, false);
  assert.equal(result.manifest.applicationGuideVersion, "1.0.0");
});

test("AP-05 LEAN, CONTROLLED and SEGREGATED variants remain explicit and testable", () => {
  const lean = deriveIncomingInvoiceUiManifestV1({
    ...uiInput("EXCEPTION"),
    scenario: "LEAN",
    evidence: { ...uiInput("EXCEPTION").evidence, matchingMode: { variantId: "TWO_WAY_INVOICE_PO_V1", version: "1.0.0" }, tolerancePolicy: { variantId: "STRICT_ZERO_V1", version: "1.0.0" }, references: uiInput("EXCEPTION").evidence.references.filter(({ kind }) => kind !== "RECEIPT") },
  });
  const segregated = deriveIncomingInvoiceUiManifestV1({ ...uiInput("CONFLICT"), scenario: "SEGREGATED_ENTERPRISE" });
  assert.equal(lean.outcome, "DERIVED");
  assert.equal(segregated.outcome, "DERIVED");
  if (lean.outcome === "DERIVED" && segregated.outcome === "DERIVED") {
    assert.deepEqual(lean.manifest.fields.map(({ fieldId }) => fieldId), ["supplier", "purchaseOrder", "invoice", "matchStatus", "evidenceReferences"]);
    assert.deepEqual(segregated.manifest.fields.map(({ fieldId }) => fieldId), ["supplier", "purchaseOrder", "receipt", "invoice", "matchStatus", "tolerancePolicy", "approvalTrail", "separationOfDuties", "evidenceReferences"]);
    assert.deepEqual(lean.manifest.actions.map(({ actionId }) => actionId), ["VIEW_EVIDENCE", "PROVIDE_MISSING_CONTEXT"]);
    assert.deepEqual(segregated.manifest.actions.map(({ actionId }) => actionId), ["VIEW_EVIDENCE", "IDENTIFY_AUTHORITATIVE_REFERENCE", "ESCALATE_SEPARATION_REVIEW"]);
  }
});

test("AP-05 hidden authority, unsupported action and context collapse fail closed", () => {
  const hiddenAuthority = deriveIncomingInvoiceUiManifestV1({ ...uiInput("MATCHED"), authority: { ...uiInput("MATCHED").authority, productiveBookingAuthorized: true } });
  assert.deepEqual(hiddenAuthority, { outcome: "DENIED", reasonCode: "HIDDEN_AUTHORITY_DENIED" });

  const unknownVariant = deriveIncomingInvoiceUiManifestV1({ ...uiInput("MATCHED"), evidence: { ...uiInput("MATCHED").evidence, matchingMode: { variantId: "INVENTED_MODE", version: "1.0.0" } } });
  assert.deepEqual(unknownVariant, { outcome: "DENIED", reasonCode: "UNSUPPORTED_ACTION_DENIED" });

  const collapsed = deriveIncomingInvoiceUiManifestV1({ ...uiInput("MATCHED"), evidence: { ...uiInput("MATCHED").evidence, references: [] } });
  assert.deepEqual(collapsed, { outcome: "DENIED", reasonCode: "CONTEXT_COLLAPSE_DENIED" });
});

test("AP-05 Application Guide records applicability, variants, limits and nonclaims", () => {
  assert.equal(INCOMING_INVOICE_APPLICATION_GUIDE_V1.schemaVersion, "chimpmaera.incoming-invoice/application-guide/v1");
  assert.deepEqual(INCOMING_INVOICE_APPLICATION_GUIDE_V1.variants.map(({ scenario }) => scenario), ["LEAN", "CONTROLLED", "SEGREGATED_ENTERPRISE"]);
  assert.ok(INCOMING_INVOICE_APPLICATION_GUIDE_V1.applicability.length > 0);
  assert.ok(INCOMING_INVOICE_APPLICATION_GUIDE_V1.limits.length > 0);
  assert.ok(INCOMING_INVOICE_APPLICATION_GUIDE_V1.nonclaims.includes("NO_PRODUCTION_FRONTEND_OR_LIVE_ERP_CLAIM"));
});

test("AP-05 setup dialogue preserves typed synthetic transcript and resolves a versioned reused-variant delta", () => {
  const baseline = requirement("requirement:baseline", "TWO_WAY_INVOICE_PO_V1", "STRICT_ZERO_V1");
  const changed = requirement("requirement:changed", "THREE_WAY_INVOICE_PO_RECEIPT_V1", "ABS_MINOR_V1", ["evidence:ap04-synthetic-002"]);
  const first = runIncomingInvoiceSetupAgentV1({ baseline, changed, answers: [
    { questionId: "confirm:matching-mode", answer: "CONFIRM" },
    { questionId: "confirm:tolerance-policy", answer: "CONFIRM" },
  ] });
  const second = runIncomingInvoiceSetupAgentV1({ baseline, changed, answers: [
    { questionId: "confirm:tolerance-policy", answer: "CONFIRM" },
    { questionId: "confirm:matching-mode", answer: "CONFIRM" },
  ] });
  assert.equal(first.outcome, "RESOLVED");
  assert.deepEqual(second, first);
  if (first.outcome !== "RESOLVED") throw new Error("expected resolved delta");
  assert.equal(first.transcript.syntheticEvidence, true);
  assert.deepEqual(first.transcript.turns.map(({ speaker }) => speaker), ["SYSTEM", "SYSTEM", "AGENT", "AGENT", "OPERATOR", "OPERATOR", "SYSTEM"]);
  assert.deepEqual(first.configurationDelta.reusedCapabilityIds, ["chimpmaera.incoming-invoice/erv-core/v1", "chimpmaera.incoming-invoice/erv-case-pack/v1"]);
  assert.deepEqual(first.configurationDelta.changedSettings, [
    { setting: "matchingMode", before: "TWO_WAY_INVOICE_PO_V1@1.0.0", after: "THREE_WAY_INVOICE_PO_RECEIPT_V1@1.0.0" },
    { setting: "tolerancePolicy", before: "STRICT_ZERO_V1@1.0.0", after: "ABS_MINOR_V1@1.0.0" },
  ]);
  assert.equal(first.configurationDelta.unresolvedGaps.length, 0);
  assert.equal(first.configurationDelta.authorityGranted, false);
  assert.equal(first.configurationDelta.inventedExecutableFunctions.length, 0);
  assert.match(first.configurationDelta.beforeRequirementDigest, /^[a-f0-9]{64}$/);
  assert.match(first.configurationDelta.afterConfigurationDigest, /^[a-f0-9]{64}$/);
});

test("AP-05 dialogue asks only evidence-backed unresolved questions and fails closed", () => {
  const baseline = requirement("requirement:baseline", "TWO_WAY_INVOICE_PO_V1", "STRICT_ZERO_V1");
  const changed = requirement("requirement:changed", "THREE_WAY_INVOICE_PO_RECEIPT_V1", "ABS_MINOR_V1", []);
  const unresolved = runIncomingInvoiceSetupAgentV1({ baseline, changed, answers: [] });
  assert.equal(unresolved.outcome, "NEEDS_CLARIFICATION");
  if (unresolved.outcome === "NEEDS_CLARIFICATION") {
    assert.deepEqual(unresolved.unresolvedGaps, ["MISSING_EVIDENCE_FOR_MATCHING_MODE", "MISSING_EVIDENCE_FOR_TOLERANCE_POLICY"]);
    assert.equal(unresolved.transcript.turns.filter(({ speaker }) => speaker === "AGENT").length, 0);
  }

  const contradiction = runIncomingInvoiceSetupAgentV1({ baseline, changed: requirement("requirement:changed", "THREE_WAY_INVOICE_PO_RECEIPT_V1", "ABS_MINOR_V1"), answers: [
    { questionId: "confirm:matching-mode", answer: "CONFIRM" },
    { questionId: "confirm:matching-mode", answer: "DECLINE" },
  ] });
  assert.equal(contradiction.outcome, "NEEDS_CLARIFICATION");
  if (contradiction.outcome === "NEEDS_CLARIFICATION") assert.ok(contradiction.unresolvedGaps.includes("CONTRADICTORY_ANSWER"));

  const unsupported = runIncomingInvoiceSetupAgentV1({ baseline, changed: { ...changed, requestedEffects: ["READ_SYNTHETIC", "POST_PRODUCTIVE"] }, answers: [] });
  assert.equal(unsupported.outcome, "DENIED_UNSUPPORTED");

  const unsupportedVariant = runIncomingInvoiceSetupAgentV1({ baseline, changed: { ...changed, matchingMode: { variantId: "INVENTED_MODE", version: "1.0.0" } }, answers: [] });
  assert.equal(unsupportedVariant.outcome, "DENIED_UNSUPPORTED");

  const malformedAnswer = runIncomingInvoiceSetupAgentV1({ baseline, changed, answers: [{ questionId: "confirm:matching-mode", answer: "MAYBE" }] });
  assert.equal(malformedAnswer.outcome, "DENIED_UNSUPPORTED");
});

test("AP-05 focused suite is registered once and its output conforms to the contract schema", () => {
  const packageJson = JSON.parse(readFileSync("package.json", "utf8")) as { scripts: Record<string, string> };
  assert.equal(packageJson.scripts["incoming-invoice-adaptive-ui:test"], "npm run build --silent && node --test dist/tests/incoming-invoice-adaptive-ui.test.js");
  assert.equal(((packageJson.scripts.pretest ?? "").match(/npm run incoming-invoice-adaptive-ui:test/g) ?? []).length, 1);
  const schema = JSON.parse(readFileSync("schemas/contracts/incoming-invoice-adaptive-ui-v1.schema.json", "utf8"));
  const validate = new Ajv2020({ strict: true }).compile(schema);
  const result = deriveIncomingInvoiceUiManifestV1(uiInput("MATCHED"));
  assert.equal(result.outcome, "DERIVED");
  assert.equal(INCOMING_INVOICE_ADAPTIVE_UI_SCHEMA_V1, "chimpmaera.incoming-invoice/adaptive-ui/v1");
  if (result.outcome === "DERIVED") assert.equal(validate(result.manifest), true, JSON.stringify(validate.errors));
});
