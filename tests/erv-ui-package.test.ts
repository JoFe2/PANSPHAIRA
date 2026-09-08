import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import test from "node:test";
import Ajv2020 from "ajv/dist/2020.js";
import {
  AP04_ERV_CASE_PACK_SHA256_V1,
  INCOMING_INVOICE_ADAPTIVE_UI_SCHEMA_V1,
  INCOMING_INVOICE_ERV_CASE_PACK_V1,
  INCOMING_INVOICE_ERV_CORE_V1,
  compileErvCapabilityCoreV1,
  deriveIncomingInvoiceUiManifestV1,
  renderErvUiPackageV1,
  resolveIncomingInvoiceScenarioV1,
  runIncomingInvoiceSetupAgentV1,
  buildErvUiPackageV1,
  type IncomingInvoiceErvRequirementV1,
  type IncomingInvoiceScenarioInputV1,
  type IncomingInvoiceUiInputV1,
  type ErvUiPackageBuildInputV1,
} from "../packages/contracts/src/index.js";

const pack = JSON.parse(readFileSync("tests/fixtures/incoming-invoice/ap-04-erv-cases-v1.json", "utf8"));
const allowedEffects = ["READ_SYNTHETIC", "WRITE_LOCAL_PROOF"] as const;

function requirement(
  requirementId: string,
  scenario: IncomingInvoiceErvRequirementV1["scenario"],
): IncomingInvoiceErvRequirementV1 {
  const segregated = scenario === "SEGREGATED_ENTERPRISE";
  return {
    schemaVersion: "chimpmaera.incoming-invoice/erv-requirement/v1",
    requirementId,
    scenario,
    matchingMode: { variantId: segregated || scenario === "CONTROLLED" ? "THREE_WAY_INVOICE_PO_RECEIPT_V1" : "TWO_WAY_INVOICE_PO_V1", version: "1.0.0" },
    tolerancePolicy: { variantId: segregated ? "ABS_MINOR_V1" : "STRICT_ZERO_V1", version: "1.0.0" },
    separateApprovalThresholdEur: segregated ? 10000 : null,
    requestedEffects: allowedEffects,
    evidenceRefs: [segregated ? "evidence:ap05-dialogue-002" : "evidence:ap05-baseline-001"],
    synthetic: true,
    customerData: false,
  };
}

function scenarioInput(segregated: boolean): IncomingInvoiceScenarioInputV1 {
  return {
    schemaVersion: "chimpmaera.incoming-invoice/scenario-input/v1",
    vector: { documentVariance: segregated ? 1 : 0, approvalDepth: segregated ? 1 : 0, integrationCount: segregated ? 1 : 0, segregationRequired: segregated },
    requestedAuthority: "LOCAL_SYNTHETIC_PROOF",
    requestedEffects: allowedEffects,
  };
}

function uiInput(scenario: "LEAN" | "SEGREGATED_ENTERPRISE", outcome: "EXCEPTION" | "CONFLICT"): IncomingInvoiceUiInputV1 {
  const segregated = scenario === "SEGREGATED_ENTERPRISE";
  const allReferences = [
    { kind: "SUPPLIER" as const, referenceId: "SUP-SYN-001", verified: true, evidenceRef: "evidence:supplier-001" },
    { kind: "PURCHASE_ORDER" as const, referenceId: "PO-SYN-001", verified: true, evidenceRef: "evidence:po-001" },
    { kind: "RECEIPT" as const, referenceId: "RCV-SYN-001", verified: true, evidenceRef: "evidence:receipt-001" },
    { kind: "INVOICE" as const, referenceId: "INV-SYN-001", verified: true, evidenceRef: "evidence:invoice-001" },
  ];
  return {
    schemaVersion: INCOMING_INVOICE_ADAPTIVE_UI_SCHEMA_V1,
    scenario,
    evidence: {
      outcome,
      matchingMode: { variantId: segregated ? "THREE_WAY_INVOICE_PO_RECEIPT_V1" : "TWO_WAY_INVOICE_PO_V1", version: "1.0.0" },
      tolerancePolicy: { variantId: segregated ? "ABS_MINOR_V1" : "STRICT_ZERO_V1", version: "1.0.0" },
      references: segregated ? allReferences : allReferences.filter(({ kind }) => kind !== "RECEIPT"),
    },
    authority: { mode: "LOCAL_SYNTHETIC_PROOF", customerDataAuthorized: false, productiveBookingAuthorized: false, externalCallsAuthorized: false },
  };
}

function publishedInput(segregated: boolean): ErvUiPackageBuildInputV1 {
  const scenario = segregated ? "SEGREGATED_ENTERPRISE" : "LEAN";
  const base = requirement(segregated ? "requirement:dialogue-adapted" : "requirement:baseline", scenario);
  const resolution = resolveIncomingInvoiceScenarioV1(scenarioInput(segregated));
  assert.equal(resolution.outcome, "ACCEPTED");
  const core = compileErvCapabilityCoreV1(pack, AP04_ERV_CASE_PACK_SHA256_V1);
  assert.equal(core.outcome, "DECIDED");
  const manifestResult = deriveIncomingInvoiceUiManifestV1(uiInput(scenario, segregated ? "CONFLICT" : "EXCEPTION"));
  assert.equal(manifestResult.outcome, "DERIVED");
  if (resolution.outcome !== "ACCEPTED" || core.outcome !== "DECIDED" || manifestResult.outcome !== "DERIVED") throw new Error("fixture setup failed");
  if (!segregated) return { scenarioInput: scenarioInput(false), requirement: base, adaptiveUiManifest: manifestResult.manifest, corePackage: core.package };

  const baseline = requirement("requirement:baseline", "LEAN");
  const dialogue = runIncomingInvoiceSetupAgentV1({ baseline, changed: base, answers: [
    { questionId: "confirm:matching-mode", answer: "CONFIRM" },
    { questionId: "confirm:tolerance-policy", answer: "CONFIRM" },
    { questionId: "confirm:scenario", answer: "CONFIRM" },
    { questionId: "confirm:separate-approval-threshold", answer: "CONFIRM" },
  ] });
  assert.equal(dialogue.outcome, "RESOLVED");
  if (dialogue.outcome !== "RESOLVED") throw new Error("dialogue fixture setup failed");
  return { scenarioInput: scenarioInput(true), requirement: base, adaptiveUiManifest: manifestResult.manifest, corePackage: core.package, configurationDelta: dialogue.configurationDelta, setupTranscript: dialogue.transcript };
}

function published(segregated: boolean) {
  const result = buildErvUiPackageV1(publishedInput(segregated));
  assert.equal(result.outcome, "PUBLISHED");
  if (result.outcome !== "PUBLISHED") throw new Error("expected published package");
  return result.package;
}

function independentCanonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(independentCanonical).join(",")}]`;
  if (value !== null && typeof value === "object") {
    return `{${Object.keys(value as Record<string, unknown>).sort().map((key) => `${JSON.stringify(key)}:${independentCanonical((value as Record<string, unknown>)[key])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

function independentDigest(value: unknown): string {
  return createHash("sha256").update(independentCanonical(value)).digest("hex");
}

test("ERV-UI AC01-03 publishes closed ordered baseline and adapted packages with exact source bindings", () => {
  const lean = published(false);
  const segregated = published(true);
  assert.equal(lean.schemaVersion, "chimpmaera.incoming-invoice/erv-ui-package/v1");
  assert.deepEqual(lean.screens[0]?.sections[0]?.components.map(({ fieldId }) => fieldId), ["supplier", "purchaseOrder", "invoice", "matchStatus", "evidenceReferences"]);
  assert.deepEqual(segregated.screens[0]?.sections[0]?.components.map(({ fieldId }) => fieldId), ["supplier", "purchaseOrder", "receipt", "invoice", "matchStatus", "tolerancePolicy", "approvalTrail", "separationOfDuties", "evidenceReferences"]);
  assert.deepEqual(lean.actions.map(({ actionId }) => actionId), ["VIEW_EVIDENCE", "PROVIDE_MISSING_CONTEXT"]);
  assert.deepEqual(segregated.actions.map(({ actionId }) => actionId), ["VIEW_EVIDENCE", "IDENTIFY_AUTHORITATIVE_REFERENCE", "ESCALATE_SEPARATION_REVIEW"]);
  assert.equal(lean.screens[0]?.sections[0]?.components[0]?.state, "UNKNOWN");
  assert.equal(segregated.screens[0]?.sections[0]?.components.find(({ fieldId }) => fieldId === "matchStatus")?.state, "CONFLICT");
  assert.notDeepEqual(lean.componentIds, segregated.componentIds);
  assert.equal(lean.bindings.casePackSchemaVersion, INCOMING_INVOICE_ERV_CASE_PACK_V1);
  assert.equal(lean.bindings.coreSchemaVersion, INCOMING_INVOICE_ERV_CORE_V1);
  assert.equal(lean.bindings.casePackSha256, AP04_ERV_CASE_PACK_SHA256_V1);
  assert.match(lean.bindings.requirementDigest, /^[a-f0-9]{64}$/);
  assert.match(lean.bindings.configurationDigest, /^[a-f0-9]{64}$/);
  assert.match(lean.bindings.scenarioDigest, /^[a-f0-9]{64}$/);
  assert.match(lean.bindings.coreDigest, /^[a-f0-9]{64}$/);
  assert.equal(segregated.bindings.configurationDeltaDigest !== null, true);
  for (const action of segregated.actions) {
    assert.equal(action.effectiveAuthority, "NONE");
    assert.equal(action.confirmationIntent, "EXPLICIT_OPERATOR_CONFIRMATION");
    assert.equal(action.readbackIntent, "LOCAL_READBACK_ONLY");
    assert.deepEqual(action.disabledReasons, []);
  }
  for (const component of segregated.screens[0]!.sections.flatMap(({ components }) => components)) {
    assert.ok(component.label && component.helpText && component.accessibilityText);
    assert.ok(component.evidenceRefs.length > 0);
    assert.ok(component.reasonCodes.length > 0);
  }
});

test("ERV-UI AC04/06 generic consumer renders without ERV allowlists and readback is deterministic", () => {
  const lean = published(false);
  const adapted = published(true);
  const first = renderErvUiPackageV1(lean);
  const second = renderErvUiPackageV1(lean);
  const adaptedReadback = renderErvUiPackageV1(adapted);
  assert.equal(first.outcome, "RENDERED");
  assert.deepEqual(second, first);
  assert.equal(adaptedReadback.outcome, "RENDERED");
  if (first.outcome === "RENDERED") {
    assert.deepEqual(first.readback.accessibility, { landmarks: ["main", "screen:erv-overview"], labelledControls: lean.actions.map(({ actionId }) => actionId) });
    assert.equal(first.readback.authority, "NONE");
    assert.equal(first.readback.snapshot, "main>screen:erv-overview>section:summary>component:supplier>component:purchaseOrder>component:invoice>component:matchStatus>component:evidenceReferences>section:actions>component:action:VIEW_EVIDENCE>component:action:PROVIDE_MISSING_CONTEXT");
    assert.equal(first.readback.packageDigest, lean.packageDigest);
  }
  const consumerSource = readFileSync("packages/contracts/src/erv-ui-package.ts", "utf8");
  const renderSource = consumerSource.slice(consumerSource.indexOf("export function renderErvUiPackageV1"));
  assert.doesNotMatch(renderSource, /supplier|purchaseOrder|SEGREGATED_ENTERPRISE|LEAN/);
});

test("ERV-UI AC05 rejects tampering, unknown vocabulary, missing evidence, reorder and forged digests before render", () => {
  const packageValue = published(false);
  const cases = [
    (value: any) => { value.screens[0].sections[0].components[0].displayKind = "INVENTED"; },
    (value: any) => { value.screens[0].sections[0].components.push({ ...value.screens[0].sections[0].components[0], componentId: "unknown", fieldId: "unknown" }); },
    (value: any) => { value.actions[0].visible = false; },
    (value: any) => { value.screens[0].sections[0].components[0].evidenceRefs = []; },
    (value: any) => { value.actions[0].evidenceRefs = ["evidence:foreign-context"]; },
    (value: any) => { value.screens[0].sections[0].components.reverse(); },
    (value: any) => { value.packageDigest = "0".repeat(64); },
  ];
  const expectedReasons = ["UNSUPPORTED_DISPLAY_KIND_DENIED", "PACKAGE_INTEGRITY_DENIED", "HIDDEN_ACTION_DENIED", "PACKAGE_INTEGRITY_DENIED", "PACKAGE_INTEGRITY_DENIED", "PACKAGE_INTEGRITY_DENIED", "PACKAGE_INTEGRITY_DENIED"] as const;
  for (const [index, mutate] of cases.entries()) {
    const candidate = structuredClone(packageValue);
    mutate(candidate);
    const result = renderErvUiPackageV1(candidate);
    assert.deepEqual(result, { outcome: "DENIED", reasonCode: expectedReasons[index] });
  }
});

test("ERV-UI AC06 package and readback are deeply immutable and schema-conformant", () => {
  const packageValue = published(true);
  const rendered = renderErvUiPackageV1(packageValue);
  assert.equal(Object.isFrozen(packageValue), true);
  assert.equal(Object.isFrozen(packageValue.screens[0]), true);
  assert.equal(Object.isFrozen(packageValue.screens[0]!.sections[0]!.components[0]), true);
  assert.equal(rendered.outcome, "RENDERED");
  if (rendered.outcome !== "RENDERED") return;
  assert.equal(Object.isFrozen(rendered.readback), true);
  const schema = JSON.parse(readFileSync("schemas/contracts/erv-ui-package-v1.schema.json", "utf8"));
  const validate = new Ajv2020({ allErrors: true, strict: true }).compile(schema);
  assert.equal(validate(packageValue), true, JSON.stringify(validate.errors));
  const { packageDigest, ...unsigned } = packageValue;
  assert.equal(packageDigest, independentDigest(unsigned));
});

test("ERV-UI focused compiled invocation is registered exactly once", () => {
  const packageJson = JSON.parse(readFileSync("package.json", "utf8")) as { scripts: Record<string, string> };
  assert.equal(packageJson.scripts["erv-ui-package:test"], "npm run build --silent && node --test dist/tests/erv-ui-package.test.js");
  assert.equal(packageJson.scripts["erv-ui-package:test:compiled"], "node --test dist/tests/erv-ui-package.test.js");
  assert.equal(((packageJson.scripts.pretest ?? "").match(/npm run erv-ui-package:test:compiled/g) ?? []).length, 1);
});
