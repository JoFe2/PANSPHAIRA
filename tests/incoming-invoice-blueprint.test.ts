import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import Ajv2020 from "ajv/dist/2020.js";
import {
  INCOMING_INVOICE_BLUEPRINT_V1,
  resolveIncomingInvoiceScenarioV1,
} from "../packages/contracts/src/index.js";

const leanInput = {
  schemaVersion: "chimpmaera.incoming-invoice/scenario-input/v1",
  vector: {
    documentVariance: 0,
    approvalDepth: 1,
    integrationCount: 0,
    segregationRequired: false,
  },
  requestedAuthority: "LOCAL_SYNTHETIC_PROOF",
  requestedEffects: ["READ_SYNTHETIC", "WRITE_LOCAL_PROOF"],
} as const;

test("AP-01 versions eight source-to-proof layers and transparently resolves LEAN", () => {
  const schema = JSON.parse(readFileSync(
    "schemas/contracts/incoming-invoice-blueprint-v1.schema.json",
    "utf8",
  ));
  const validate = new Ajv2020({ allErrors: true, strict: true }).compile(schema);

  assert.equal(validate(INCOMING_INVOICE_BLUEPRINT_V1), true, JSON.stringify(validate.errors));
  assert.deepEqual(
    INCOMING_INVOICE_BLUEPRINT_V1.layers.map(({ layerId }) => layerId),
    [
      "SOURCE",
      "DOCUMENT",
      "EXTRACTION",
      "VALIDATION",
      "MATCHING",
      "EXCEPTION_ADVISOR",
      "ADAPTIVE_UI",
      "RECEIPT_EVIDENCE_VERDICT",
    ],
  );
  assert.ok(INCOMING_INVOICE_BLUEPRINT_V1.layers.every(({ version }) => version === "1.0.0"));

  assert.deepEqual(resolveIncomingInvoiceScenarioV1(leanInput), {
    outcome: "ACCEPTED",
    scenario: "LEAN",
    derivation: {
      ruleId: "LEAN_LOW_COMPLEXITY_V1",
      score: 1,
      vector: leanInput.vector,
    },
    authority: {
      mode: "LOCAL_SYNTHETIC_PROOF",
      allowedEffects: ["READ_SYNTHETIC", "WRITE_LOCAL_PROOF"],
      customerDataAuthorized: false,
      productiveBookingAuthorized: false,
    },
  });
});

test("AP-01 focused suite is registered in the canonical full test entrypoint", () => {
  const packageJson = JSON.parse(readFileSync("package.json", "utf8")) as {
    scripts: Record<string, string>;
  };

  assert.equal(
    packageJson.scripts["incoming-invoice:test"],
    "npm run build --silent && node --test dist/tests/incoming-invoice-blueprint.test.js",
  );
  assert.match(packageJson.scripts.pretest ?? "", /npm run incoming-invoice:test/);
});

test("AP-01 derives CONTROLLED and SEGREGATED_ENTERPRISE only from the declared vector", () => {
  const controlled = resolveIncomingInvoiceScenarioV1({
    ...leanInput,
    vector: { documentVariance: 1, approvalDepth: 1, integrationCount: 1, segregationRequired: false },
  });
  const segregated = resolveIncomingInvoiceScenarioV1({
    ...leanInput,
    vector: { documentVariance: 0, approvalDepth: 0, integrationCount: 0, segregationRequired: true },
  });

  assert.equal(controlled.outcome, "ACCEPTED");
  assert.equal(controlled.outcome === "ACCEPTED" && controlled.scenario, "CONTROLLED");
  assert.equal(controlled.outcome === "ACCEPTED" && controlled.derivation.ruleId, "CONTROLLED_SCORE_V1");
  assert.equal(segregated.outcome, "ACCEPTED");
  assert.equal(segregated.outcome === "ACCEPTED" && segregated.scenario, "SEGREGATED_ENTERPRISE");
  assert.equal(segregated.outcome === "ACCEPTED" && segregated.derivation.ruleId, "SEGREGATION_REQUIRED_V1");
  assert.equal(INCOMING_INVOICE_BLUEPRINT_V1.complexityModel.fields.includes("companySize" as never), false);
});

test("AP-01 denies unknown fields, company size, invalid versions, hidden authority/effects and ambiguous vectors", () => {
  const probes: ReadonlyArray<readonly [string, unknown, string]> = [
    ["company-size-input", { ...leanInput, companySize: "SMALL" }, "UNKNOWN_INPUT_FIELD_DENIED"],
    ["unknown-input", { ...leanInput, hiddenRule: "CONTROLLED" }, "UNKNOWN_INPUT_FIELD_DENIED"],
    ["unknown-vector", { ...leanInput, vector: { ...leanInput.vector, hiddenWeight: 2 } }, "UNKNOWN_VECTOR_FIELD_DENIED"],
    ["invalid-version", { ...leanInput, schemaVersion: "chimpmaera.incoming-invoice/scenario-input/v2" }, "VERSION_DENIED"],
    ["hidden-authority", { ...leanInput, requestedAuthority: "CUSTOMER_DATA" }, "AUTHORITY_DENIED"],
    ["productive-mutation", { ...leanInput, requestedEffects: ["READ_SYNTHETIC", "PRODUCTIVE_BOOKING"] }, "EFFECT_DENIED"],
    ["ambiguous-effect-order", { ...leanInput, requestedEffects: ["WRITE_LOCAL_PROOF", "READ_SYNTHETIC"] }, "EFFECT_DENIED"],
    ["out-of-range-vector", { ...leanInput, vector: { ...leanInput.vector, documentVariance: 3 } }, "VECTOR_VALUE_DENIED"],
    ["ambiguous-vector", { ...leanInput, vector: { ...leanInput.vector, segregationRequired: "false" } }, "VECTOR_VALUE_DENIED"],
    ["missing-vector-field", {
      ...leanInput,
      vector: { documentVariance: 0, integrationCount: 0, segregationRequired: false },
    }, "VECTOR_FIELD_DENIED"],
  ];

  for (const [caseId, input, reason] of probes) {
    assert.deepEqual(resolveIncomingInvoiceScenarioV1(input), {
      outcome: "DENIED",
      reasonCodes: [reason],
    }, caseId);
  }
});

test("AP-01 freezes scope, non-scope, actors, outcomes, risks, falsifiers and returns immutable local-only decisions", () => {
  const before = structuredClone(leanInput);
  const result = resolveIncomingInvoiceScenarioV1(leanInput);

  assert.deepEqual(leanInput, before);
  assert.equal(Object.isFrozen(INCOMING_INVOICE_BLUEPRINT_V1), true);
  assert.equal(Object.isFrozen(INCOMING_INVOICE_BLUEPRINT_V1.scopeFreeze), true);
  for (const field of ["scope", "nonScope", "actors", "outcomes", "risks", "falsifiers"] as const) {
    assert.ok(INCOMING_INVOICE_BLUEPRINT_V1.scopeFreeze[field].length > 0);
    assert.equal(Object.isFrozen(INCOMING_INVOICE_BLUEPRINT_V1.scopeFreeze[field]), true);
  }
  assert.equal(Object.isFrozen(result), true);
  assert.equal(result.outcome === "ACCEPTED" && result.authority.customerDataAuthorized, false);
  assert.equal(result.outcome === "ACCEPTED" && result.authority.productiveBookingAuthorized, false);
});
