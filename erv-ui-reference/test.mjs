/**
 * PS374-ERV-UI-01 — focused contract tests for the versioned, renderer-neutral
 * `ErvUiPackageV1` and its independent generic frontend consumer.
 *
 * RED on fresh Main: the `erv-ui-reference/reference.mjs` module (closed schema
 * driver, schema-only renderer, generic consumer, self-consistency integrity
 * gate and the trusted-source forgery denial) does not exist, so this file
 * fails to load (ERR_MODULE_NOT_FOUND) — the capability is absent.
 *
 * The tests pin:
 *  AC01  closed schema: ordered screens/sections/components, field IDs, display
 *        kinds, explicit VALUE/UNKNOWN/CONFLICT/UNSUPPORTED states,
 *        labels/help/accessibility text, evidence refs and reason codes.
 *  AC02  safe actions: stable action ID, enabled/disabled + reasons, required
 *        evidence, effective Authority = NONE, confirmation/readback intent,
 *        and no callback/code/route token (schema-forbidden).
 *  AC03  baseline LEAN + dialogue-derived SEGREGATED_ENTERPRISE bind
 *        requirement/configuration/scenario/core digests + an exact
 *        component/action delta.
 *  AC04  a minimal generic reference consumer renders both using only the
 *        schema; its a11y readback matches an independent oracle; the consumer
 *        has no ERV field/action allowlist or scenario branching.
 *  AC05  fail closed: unknown fields, extra components, hidden actions, missing
 *        evidence, cross-context IDs, reordered content, forged digests,
 *        unsupported display kinds.
 *  AC06  deterministic, deeply immutable, framework-neutral, no ERP required.
 *
 * The fix under test "separates trusted producer/source validation from
 * schema-only rendering and preserves source-forgery denials": a schema-conforming
 * independent generic package renders, while forged/tampered packages and
 * non-trusted-source packages are still denied by the preserved forgery gates.
 */

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import Ajv2020 from "ajv/dist/2020.js";

import {
  SCHEMA_VERSION,
  toCanonicalBytes,
  sha256Hex,
  createErvUiPackageV1,
  createLeanBaseline,
  createSegregatedEnterprise,
  validateAgainstSchema,
  verifyErvUiPackageV1Integrity,
  renderErvUiPackageV1,
  genericReferenceConsumerRender,
  computeErvUiPackageDeltaV1,
  verifyTrustedErvUiSourceV1,
} from "./reference.mjs";

const SCHEMA = JSON.parse(readFileSync(new URL("./schema.json", import.meta.url), "utf8"));
const ajv = new Ajv2020({ strict: true, allErrors: true });
const validate = ajv.compile(SCHEMA);

function clone(value) {
  return structuredClone(value);
}

/** Deny helpers: a rendered/integrity result must be a PACKAGE_INTEGRITY_DENIED. */
function assertDenied(result, ...codes) {
  assert.equal(result.outcome, "DENIED", `expected DENIED, got ${result.outcome} ${JSON.stringify(result.detail ?? null)}`);
  assert.equal(result.reasonCode, "PACKAGE_INTEGRITY_DENIED");
  const present = (result.detail ?? []).map((e) => e.code);
  for (const code of codes) {
    assert.ok(present.includes(code), `expected integrity code ${code}; got ${JSON.stringify(present)}`);
  }
}

// ---------------------------------------------------------------------------
// AC01 — closed schema: conforming baseline validates; non-conforming rejected.
// ---------------------------------------------------------------------------
test("AC01 baseline LEAN package conforms to the closed schema (Ajv strict)", () => {
  const pkg = createLeanBaseline();
  assert.equal(validate(pkg), true, JSON.stringify(validate.errors));
  assert.equal(pkg.schemaVersion, SCHEMA_VERSION);
});

test("AC01 schema rejects an unknown top-level key (additionalProperties closed)", () => {
  const pkg = clone(createLeanBaseline());
  // deepFreeze: clone before mutating
  pkg.secretRoute = "/callback";
  assert.equal(validate(pkg), false);
  assert.ok((validate.errors ?? []).some((e) => e.keyword === "additionalProperties"));
});

test("AC01 a VALUE field must carry a value and no reasonCode; a non-VALUE field a reasonCode and no value", () => {
  const base = clone(createLeanBaseline());
  const amount = base.screens[0].sections[0].components[0].field;
  assert.equal(amount.state, "VALUE");
  assert.equal(typeof amount.value, "number");
  assert.equal("reasonCode" in amount, false);

  const notes = base.screens[0].sections[0].components[2].field;
  assert.equal(notes.state, "UNKNOWN");
  assert.equal(typeof notes.reasonCode, "string");
  assert.equal("value" in notes, false);
});

test("AC01 schema rejects a non-VALUE field missing its reasonCode", () => {
  const pkg = clone(createLeanBaseline());
  const notes = pkg.screens[0].sections[0].components[2].field;
  delete notes.reasonCode;
  assert.equal(validate(pkg), false);
});

// ---------------------------------------------------------------------------
// AC02 — safe actions.
// ---------------------------------------------------------------------------
test("AC02 every action has a stable id, Authority NONE, confirmation/readback intent and no callback/code/route", () => {
  const pkg = createLeanBaseline();
  const actions = [];
  for (const screen of pkg.screens) for (const section of screen.sections) for (const component of section.components) actions.push(...component.actions);
  assert.ok(actions.length >= 1);
  for (const action of actions) {
    assert.equal(typeof action.actionId, "string");
    assert.ok(action.actionId.length > 0);
    assert.equal(action.authority, "NONE");
    assert.equal(typeof action.confirmationIntent.label, "string");
    assert.equal(typeof action.readbackIntent.label, "string");
    assert.ok("requiredEvidenceRefs" in action);
    assert.equal("callback" in action, false);
    assert.equal("code" in action, false);
    assert.equal("route" in action, false);
  }
});

test("AC02 schema forbids a callback/code/route token on an action", () => {
  const pkg = clone(createLeanBaseline());
  const action = pkg.screens[0].sections[0].components[2].actions[0];
  action.callback = "https://external.example/hook";
  assert.equal(validate(pkg), false);
});

test("AC02 disabled action requires a reason; enabled action must not carry one", () => {
  const adapted = clone(createSegregatedEnterprise());
  const escalate = adapted.screens[0].sections[2].components[1].actions[0];
  assert.equal(escalate.enabled, false);
  assert.equal(typeof escalate.disabledReason, "string");

  const pkg = clone(adapted);
  const esc = pkg.screens[0].sections[2].components[1].actions[0];
  delete esc.disabledReason;
  assert.equal(validate(pkg), false);

  const lean = clone(createLeanBaseline());
  const open = lean.screens[0].sections[0].components[2].actions[0];
  assert.equal(open.enabled, true);
  assert.equal("disabledReason" in open, false);
  open.disabledReason = "should not be present when enabled";
  assert.equal(validate(lean), false);
});

test("AC02 effective Authority is NONE and no authority is granted anywhere in the package", () => {
  for (const pkg of [createLeanBaseline(), createSegregatedEnterprise()]) {
    assert.equal(pkg.authority.mode, "NONE");
    assert.equal(pkg.authority.bookingAuthorityGranted, false);
    assert.equal(pkg.authority.externalCallsAuthorized, false);
    assert.equal(pkg.authority.customerDataAuthorized, false);
    assert.equal(pkg.authority.productivePostingAuthorized, false);
  }
});

// ---------------------------------------------------------------------------
// AC03 — bound digests + exact component/action delta.
// ---------------------------------------------------------------------------
test("AC03 baseline and adapted packages bind requirement/configuration/scenario/core digests that recompute to their descriptors", () => {
  for (const pkg of [createLeanBaseline(), createSegregatedEnterprise()]) {
    for (const name of ["requirement", "configuration", "scenario", "core"]) {
      const entry = pkg.bound[name];
      assert.equal(sha256Hex(toCanonicalBytes(entry.descriptor)), entry.digest, `bound.${name} digest must recompute`);
    }
  }
});

test("AC03 baseline LEAN and dialogue-derived SEGREGATED_ENTERPRISE share a requirement/core and differ in configuration/scenario", () => {
  const lean = createLeanBaseline();
  const adapted = createSegregatedEnterprise();
  assert.equal(lean.scenario, "LEAN");
  assert.equal(adapted.scenario, "SEGREGATED_ENTERPRISE");
  assert.equal(lean.bound.requirement.digest, adapted.bound.requirement.digest);
  assert.equal(lean.bound.core.digest, adapted.bound.core.digest);
  assert.notEqual(lean.bound.configuration.digest, adapted.bound.configuration.digest);
  assert.notEqual(lean.bound.scenario.digest, adapted.bound.scenario.digest);
});

test("AC03 the exact component/action delta between baseline and adapted is reproducible", () => {
  const lean = createLeanBaseline();
  const adapted = createSegregatedEnterprise();
  const delta = computeErvUiPackageDeltaV1(lean, adapted);
  assert.deepEqual(delta.fields, { added: ["compliance", "approver"], removed: [] });
  assert.deepEqual(delta.components, { added: ["comp-compliance", "comp-approver"], removed: [] });
  assert.deepEqual(delta.actions, { added: ["act-escalate"], removed: [] });
  assert.match(delta.deltaDigest, /^[a-f0-9]{64}$/);
  assert.deepEqual(computeErvUiPackageDeltaV1(lean, adapted).deltaDigest, delta.deltaDigest, "delta is deterministic");
});

// ---------------------------------------------------------------------------
// AC04 — minimal generic reference consumer + independent oracle.
// ---------------------------------------------------------------------------
/** Independent oracle: re-derives the a11y readback by its own tree walk. */
function oracleA11y(pkg) {
  const fieldLabels = [];
  const actionStates = [];
  for (const screen of pkg.screens) {
    for (const section of screen.sections) {
      for (const component of section.components) {
        fieldLabels.push(component.field.label);
        for (const action of component.actions) actionStates.push({ actionId: action.actionId, enabled: action.enabled });
      }
    }
  }
  return { fieldCount: fieldLabels.length, actionCount: actionStates.length, fieldLabels, actionStates };
}

test("AC04 the generic consumer renders baseline and adapted using only the schema, matching an independent oracle", () => {
  for (const pkg of [createLeanBaseline(), createSegregatedEnterprise()]) {
    const rendered = genericReferenceConsumerRender(pkg);
    assert.equal(rendered.outcome, "RENDERED", JSON.stringify(rendered.detail ?? null));
    assert.equal(rendered.scenario, pkg.scenario);
    // a11y readback matches the independent oracle
    assert.deepEqual(rendered.a11y, oracleA11y(pkg), "a11y readback must match the independent oracle");
    // snapshot digest is self-consistent with the emitted screens
    assert.equal(sha256Hex(toCanonicalBytes(rendered.screens)), rendered.snapshotDigest);
    // no ERP / customer data leaked into the render
    assert.equal(rendered.authority.mode, "NONE");
  }
});

test("AC04 the generic consumer is neutral: it carries no ERV field/action allowlist and no scenario branching", () => {
  const source = readFileSync(new URL("./reference.mjs", import.meta.url), "utf8");
  // The concrete ERV identifiers used by the fixtures must not appear as
  // hard-coded allowlist entries in the consumer/renderer implementation.
  for (const id of ["compliance", "approver", "act-escalate", "comp-compliance"]) {
    assert.ok(!new RegExp(`\\b${id}\\b`).test(source), `consumer must not allowlist ERV identifier "${id}"`);
  }
  // No scenario-branching in the render path (scenario is rendered as data only).
  assert.ok(!/scenario\s*===/.test(source), "consumer must not branch on scenario");
  assert.ok(!/if\s*\(.*scenario/.test(source), "consumer must not branch on scenario");
});

test("AC04 an independent, schema-conforming generic package (not the trusted producer) renders without trusted-source binding", () => {
  // Built by consumer-side code with a distinct structure — a generic third
  // party producer, NOT createErvUiPackageV1. Only the shared canonical
  // primitive is reused so digests verify.
  const requirement = { id: "req-generic", version: "1" };
  const configuration = { id: "cfg-generic", version: "1" };
  const scenario = { id: "scn-lean", contextId: "ctx-generic" };
  const core = { id: "core-generic", caseCount: 1 };
  const evRef = "ev-generic";
  const evContent = { kind: "INVOICE", n: 1 };
  const screens = [
    {
      screenId: "screen-g", order: 0,
      sections: [
        {
          sectionId: "section-g", order: 0,
          components: [
            {
              componentId: "comp-g", order: 0, kind: "FIELD",
              field: { fieldId: "genericField", label: "Generic field", accessibilityLabel: "Generic field", displayKind: "TEXT", state: "VALUE", value: "ok", evidenceRefs: [evRef] },
              actions: [
                { actionId: "genericAct", order: 0, enabled: true, requiredEvidenceRefs: [evRef], authority: "NONE", confirmationIntent: { required: false, label: "Confirm" }, readbackIntent: { label: "Read back" }, evidenceRefs: [evRef] },
              ],
            },
          ],
        },
      ],
    },
  ];
  const body = {
    schemaVersion: SCHEMA_VERSION,
    packageVersion: "1.0.0",
    contextId: "ctx-generic",
    scenario: "LEAN",
    authority: { mode: "NONE", bookingAuthorityGranted: false, externalCallsAuthorized: false, customerDataAuthorized: false, productivePostingAuthorized: false },
    bound: {
      requirement: { descriptor: requirement, digest: sha256Hex(toCanonicalBytes(requirement)) },
      configuration: { descriptor: configuration, digest: sha256Hex(toCanonicalBytes(configuration)) },
      scenario: { descriptor: scenario, digest: sha256Hex(toCanonicalBytes(scenario)) },
      core: { descriptor: core, digest: sha256Hex(toCanonicalBytes(core)) },
    },
    evidence: [{ ref: evRef, kind: "INVOICE", contentDigest: sha256Hex(toCanonicalBytes(evContent)) }],
    screens,
    inventory: { fields: [{ id: "genericField" }], components: [{ id: "comp-g" }], actions: [{ id: "genericAct" }] },
  };
  const pkg = { ...body, readback: { packageSha256: sha256Hex(toCanonicalBytes(body)), deterministicReplay: true } };

  // It is schema-conforming and self-consistent...
  assert.equal(validate(pkg), true, JSON.stringify(validate.errors));
  // ...so the schema-only renderer accepts it (no hard-coded trusted binding required).
  const rendered = renderErvUiPackageV1(pkg, { expectedContextId: "ctx-generic" });
  assert.equal(rendered.outcome, "RENDERED", JSON.stringify(rendered.detail ?? null));
  // ...yet the PRESERVED trusted-source forgery denial reports it is NOT the trusted source.
  assert.equal(verifyTrustedErvUiSourceV1(pkg, createLeanBaseline().readback.packageSha256).valid, false);
});

// ---------------------------------------------------------------------------
// AC05 — fail-closed integrity matrix (each mutation must be DENIED).
// ---------------------------------------------------------------------------
test("AC05 unknown field (inventory/tree field mismatch) is denied", () => {
  const pkg = clone(createLeanBaseline());
  pkg.inventory.fields = pkg.inventory.fields.map((e) => e);
  pkg.inventory.fields.push({ id: "ghostField" });
  const result = renderErvUiPackageV1(pkg);
  assertDenied(result, "UNKNOWN_FIELD");
});

test("AC05 extra component (inventory/tree component mismatch) is denied", () => {
  const pkg = clone(createLeanBaseline());
  pkg.inventory.components.push({ id: "comp-ghost" });
  const result = renderErvUiPackageV1(pkg);
  assertDenied(result, "EXTRA_COMPONENT");
});

test("AC05 hidden action (action claimed in inventory but absent from the tree) is denied", () => {
  const pkg = clone(createLeanBaseline());
  pkg.inventory.actions.push({ id: "act-hidden" });
  const result = renderErvUiPackageV1(pkg);
  assertDenied(result, "HIDDEN_ACTION");
});

test("AC05 missing evidence (an evidence ref not present in the registry) is denied", () => {
  const pkg = clone(createLeanBaseline());
  const notes = pkg.screens[0].sections[0].components[2].field;
  notes.evidenceRefs.push("ev-not-in-registry");
  // recompute digest is NOT the point here; integrity cross-ref must still deny before digest
  const { valid, errors } = verifyErvUiPackageV1Integrity(pkg);
  assert.equal(valid, false);
  assert.ok(errors.some((e) => e.code === "MISSING_EVIDENCE"), JSON.stringify(errors));
});

test("AC05 cross-context IDs (rendered in a different context) is denied", () => {
  const pkg = createLeanBaseline();
  const result = renderErvUiPackageV1(pkg, { expectedContextId: "ctx-some-other-context" });
  assertDenied(result, "CROSS_CONTEXT_ID");
});

test("AC05 reordered content is denied", () => {
  const pkg = clone(createLeanBaseline());
  // swap the two sections in place (order fields no longer match their index)
  const sections = pkg.screens[0].sections;
  [sections[0], sections[1]] = [sections[1], sections[0]];
  const result = renderErvUiPackageV1(pkg);
  assertDenied(result, "REORDERED_CONTENT", "PACKAGE_DIGEST_MISMATCH");
});

test("AC05 forged bound digest is denied", () => {
  const pkg = clone(createLeanBaseline());
  pkg.bound.core.digest = "0".repeat(64);
  const result = renderErvUiPackageV1(pkg);
  assertDenied(result, "FORGED_DIGEST");
});

test("AC05 a tampered self-integrity readback (re-digested / byte-substituted) is denied", () => {
  const pkg = clone(createLeanBaseline());
  pkg.readback.packageSha256 = "f".repeat(64);
  const result = renderErvUiPackageV1(pkg);
  assertDenied(result, "PACKAGE_DIGEST_MISMATCH");
});

test("AC05 an unsupported display kind is denied", () => {
  const pkg = clone(createLeanBaseline());
  const amount = pkg.screens[0].sections[0].components[0].field;
  amount.displayKind = "HOLOGRAM";
  const result = renderErvUiPackageV1(pkg);
  assert.equal(result.outcome, "DENIED", "an unsupported display kind must be denied");
});

// ---------------------------------------------------------------------------
// Separation: trusted producer/source validation is preserved AND distinct from
// schema-only rendering (the fix for the PACKAGE_INTEGRITY_DENIED false denial).
// ---------------------------------------------------------------------------
test("fix: trusted-source forgery denial is preserved for the trusted packages", () => {
  const lean = createLeanBaseline();
  const adapted = createSegregatedEnterprise();
  // The trusted source digest of a package equals its canonical body digest.
  assert.equal(verifyTrustedErvUiSourceV1(lean, lean.readback.packageSha256).valid, true);
  assert.equal(verifyTrustedErvUiSourceV1(adapted, adapted.readback.packageSha256).valid, true);
  // A forged (re-digested) package is denied by the preserved gate.
  const forged = clone(lean);
  forged.bound.requirement.digest = "1".repeat(64);
  assert.equal(verifyTrustedErvUiSourceV1(forged, lean.readback.packageSha256).valid, false);
  assert.equal(verifyTrustedErvUiSourceV1(forged, lean.readback.packageSha256).reasonCode, "SOURCE_FORGERY_DENIED");
});

test("fix: rendering does NOT require the trusted source (schema-only), but forgery denials still apply", () => {
  const lean = createLeanBaseline();
  // Rendering the trusted package with NO trusted-source requirement succeeds.
  assert.equal(renderErvUiPackageV1(lean, { expectedContextId: lean.contextId }).outcome, "RENDERED");
  // A forged trusted package is still denied by rendering (integrity), proving
  // the separation did not drop the forgery denial.
  const forged = clone(lean);
  forged.bound.core.digest = "2".repeat(64);
  assertDenied(renderErvUiPackageV1(forged), "FORGED_DIGEST");
});

// ---------------------------------------------------------------------------
// AC06 — deterministic, deeply immutable, framework-neutral.
// ---------------------------------------------------------------------------
test("AC06 production is deterministic (byte-identical replay and digest)", () => {
  const a = createLeanBaseline();
  const b = createLeanBaseline();
  assert.equal(toCanonicalBytes(a).toString("utf8"), toCanonicalBytes(b).toString("utf8"));
  assert.equal(a.readback.packageSha256, b.readback.packageSha256);
});

test("AC06 the produced package is deeply immutable", () => {
  const pkg = createLeanBaseline();
  assert.equal(Object.isFrozen(pkg), true);
  assert.equal(Object.isFrozen(pkg.screens[0]), true);
  assert.equal(Object.isFrozen(pkg.screens[0].sections[0].components[0].field), true);
  assert.throws(() => { pkg.screens[0].sections[0].components[0].field.value = 1; }, TypeError);
});

test("AC06 the module is framework-neutral and makes no ERP claim (Authority NONE, no customer data)", () => {
  const pkg = createSegregatedEnterprise();
  assert.equal(pkg.authority.mode, "NONE");
  const rendered = genericReferenceConsumerRender(pkg);
  assert.equal(rendered.authority.mode, "NONE");
  // render is a pure function of the package: re-rendering yields the same digest
  const renderedAgain = genericReferenceConsumerRender(pkg);
  assert.equal(renderedAgain.snapshotDigest, rendered.snapshotDigest, "render is a pure function of the package");
  for (const screen of rendered.screens) for (const section of screen.sections) for (const component of section.components) {
    assert.equal(component.field.authority, undefined, "a field carries no authority grant");
  }
});