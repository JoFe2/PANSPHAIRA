/**
 * PS374-ERV-UI-01 — neutral, renderer-agnostic engine for the closed
 * versioned `ErvUiPackageV1` contract (schema.json).
 *
 * This module carries NO ERV business logic and NO hard-coded trusted-source
 * bindings. It provides:
 *   - the closed schema driver (Ajv2020, strict),
 *   - a canonical-serialization + SHA-256 primitive,
 *   - the trusted producer (data-driven; fixtures live in descriptors.mjs),
 *   - a SCHEMA-ONLY renderer / independent generic reference consumer,
 *   - a self-consistency integrity gate (the fail-closed forgery denials),
 *   - a separate PRESERVED trusted-source forgery gate.
 *
 * The qualified fix for the PACKAGE_INTEGRITY_DENIED false denial: a
 * schema-conforming, self-consistent package renders even when it is NOT the
 * trusted producer's output (no hard-coded AP05 binding is required to render),
 * while forged / tampered / non-self-consistent packages are still denied.
 * Trusted-source validation (verifyTrustedErvUiSourceV1) is a SEPARATE concern
 * from schema-only rendering (renderErvUiPackageV1).
 */

import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import Ajv2020 from "ajv/dist/2020.js";

import { LEAN_DESCRIPTOR, SEGREGATED_ENTERPRISE_DESCRIPTOR } from "./descriptors.mjs";

export const SCHEMA_VERSION = "chimpmaera.erv-ui/v1";
const PACKAGE_VERSION = "1.0.0";

// Mirrors the schema `displayKind` enum; used by the defensive self-consistency
// check (the schema itself also rejects unsupported kinds).
const DISPLAY_KINDS = ["TEXT", "NUMBER", "CURRENCY", "BOOLEAN", "ENUM", "DATETIME", "LIST", "PERCENT"];

// ---------------------------------------------------------------------------
// Canonical serialization + digest primitives.
// ---------------------------------------------------------------------------
function canonicalJson(value) {
  if (value === null) return "null";
  if (Array.isArray(value)) {
    return "[" + value.map(canonicalJson).join(",") + "]";
  }
  const type = typeof value;
  if (type === "string") return JSON.stringify(value);
  if (type === "number" || type === "boolean") return String(value);
  if (type === "object") {
    const keys = Object.keys(value).sort();
    return "{" + keys.map((k) => JSON.stringify(k) + ":" + canonicalJson(value[k])).join(",") + "}";
  }
  throw new Error("toCanonicalBytes: unsupported value of type " + type);
}

/** Deterministic canonical JSON bytes (sorted object keys, array order preserved). */
export function toCanonicalBytes(value) {
  return Buffer.from(canonicalJson(value), "utf8");
}

/** SHA-256 hex of a byte buffer. */
export function sha256Hex(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

function deepFreeze(value) {
  if (value !== null && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const key of Object.keys(value)) deepFreeze(value[key]);
  }
  return value;
}

// ---------------------------------------------------------------------------
// Closed schema driver (Ajv2020, strict).
// ---------------------------------------------------------------------------
let _compiled = null;
function compile() {
  if (_compiled === null) {
    const ajv = new Ajv2020({ strict: true, allErrors: true });
    _compiled = ajv.compile(loadSchema());
  }
  return _compiled;
}

function loadSchema() {
  return JSON.parse(readFileSync(new URL("./schema.json", import.meta.url), "utf8"));
}

/** Validate an instance against the closed schema. Returns [] when conforming. */
export function validateAgainstSchema(instance) {
  const validate = compile();
  validate(instance);
  return validate.errors ?? [];
}

// ---------------------------------------------------------------------------
// Tree inventory (deterministic, tree-order) — shared by producer and delta.
// ---------------------------------------------------------------------------
function collectInventory(screens) {
  const fields = [];
  const components = [];
  const actions = [];
  for (const screen of screens) {
    for (const section of screen.sections) {
      for (const component of section.components) {
        components.push(component.componentId);
        fields.push(component.field.fieldId);
        for (const action of component.actions) actions.push(action.actionId);
      }
    }
  }
  return { fields, components, actions };
}

// ---------------------------------------------------------------------------
// Trusted producer (data-driven; the concrete fixtures are in descriptors.mjs).
// ---------------------------------------------------------------------------
/**
 * Build a versioned ErvUiPackageV1 from a neutral descriptor. This is the
 * trusted producer path; the returned package is deeply immutable and carries
 * a self-integrity readback. `descriptor` provides contextId, scenario, the
 * bound requirement/configuration/scenario/core descriptors, the evidence
 * registry (with `content` for digesting), and the declared UI `screens`.
 */
export function createErvUiPackageV1(descriptor) {
  const bound = {};
  for (const name of ["requirement", "configuration", "scenario", "core"]) {
    const descriptorValue = name === "scenario" ? descriptor.scenarioDescriptor : descriptor[name];
    bound[name] = { descriptor: descriptorValue, digest: sha256Hex(toCanonicalBytes(descriptorValue)) };
  }
  const evidence = (descriptor.evidence ?? []).map((e) => ({
    ref: e.ref,
    kind: e.kind,
    contentDigest: sha256Hex(toCanonicalBytes(e.content)),
  }));
  const inventorySource = collectInventory(descriptor.screens);
  const inventory = {
    fields: inventorySource.fields.map((id) => ({ id })),
    components: inventorySource.components.map((id) => ({ id })),
    actions: inventorySource.actions.map((id) => ({ id })),
  };
  const body = {
    schemaVersion: SCHEMA_VERSION,
    packageVersion: PACKAGE_VERSION,
    contextId: descriptor.contextId,
    scenario: descriptor.scenario,
    authority: {
      mode: "NONE",
      bookingAuthorityGranted: false,
      externalCallsAuthorized: false,
      customerDataAuthorized: false,
      productivePostingAuthorized: false,
    },
    bound,
    evidence,
    screens: descriptor.screens,
    inventory,
  };
  const readback = { packageSha256: sha256Hex(toCanonicalBytes(body)), deterministicReplay: true };
  return deepFreeze({ ...body, readback });
}

/** Baseline LEAN package (local, synthetic, no ERP, no customer data). */
export function createLeanBaseline() {
  return createErvUiPackageV1(LEAN_DESCRIPTOR);
}

/** Dialogue-derived SEGREGATED_ENTERPRISE package (local, synthetic). */
export function createSegregatedEnterprise() {
  return createErvUiPackageV1(SEGREGATED_ENTERPRISE_DESCRIPTOR);
}

// ---------------------------------------------------------------------------
// Self-consistency integrity gate (fail-closed forgery denials).
// ---------------------------------------------------------------------------
function inventoryIds(pkg, key) {
  return (pkg.inventory?.[key] ?? []).map((e) => e.id);
}

function pushSetMismatch(errors, code, inventoryList, treeList) {
  const inv = new Set(inventoryList);
  const tree = new Set(treeList);
  const onlyInventory = inventoryList.filter((id) => !tree.has(id));
  const onlyTree = treeList.filter((id) => !inv.has(id));
  if (onlyInventory.length > 0) {
    errors.push({ code, detail: "in inventory but not tree: " + onlyInventory.join(",") });
  }
  if (onlyTree.length > 0) {
    errors.push({ code, detail: "in tree but not inventory: " + onlyTree.join(",") });
  }
}

function ordersMonotonic(screens) {
  if (!Array.isArray(screens)) return false;
  for (let i = 0; i < screens.length; i++) {
    const screen = screens[i];
    if (screen.order !== i) return false;
    const sections = screen.sections;
    if (!Array.isArray(sections)) return false;
    for (let j = 0; j < sections.length; j++) {
      const section = sections[j];
      if (section.order !== j) return false;
      const components = section.components;
      if (!Array.isArray(components)) return false;
      for (let k = 0; k < components.length; k++) {
        const component = components[k];
        if (component.order !== k) return false;
        const actions = component.actions;
        if (!Array.isArray(actions)) return false;
        for (let m = 0; m < actions.length; m++) {
          if (actions[m].order !== m) return false;
        }
      }
    }
  }
  return true;
}

/**
 * Self-consistency integrity check. Independent of any trusted-source binding:
 * it verifies the package is internally consistent (bound digests recompute,
 * the self-integrity readback matches, content order is monotonic, evidence
 * refs resolve, inventory matches the declared tree, and display kinds are
 * supported). Returns { valid, errors:[{code,detail}] }.
 */
export function verifyErvUiPackageV1Integrity(pkg, options = {}) {
  if (typeof pkg !== "object" || pkg === null || Array.isArray(pkg)) {
    return { valid: false, errors: [{ code: "STRUCTURE_INVALID", detail: "package" }] };
  }
  const errors = [];
  // Forged bound digests: each bound digest must recompute to its descriptor.
  for (const name of ["requirement", "configuration", "scenario", "core"]) {
    const entry = pkg.bound?.[name];
    if (typeof entry !== "object" || entry === null || !("digest" in entry) || !("descriptor" in entry)) {
      errors.push({ code: "FORGED_DIGEST", detail: name + ":missing" });
      continue;
    }
    if (sha256Hex(toCanonicalBytes(entry.descriptor)) !== entry.digest) {
      errors.push({ code: "FORGED_DIGEST", detail: name });
    }
  }
  // Self-integrity readback: canonical body digest must match the readback.
  // (A reordered / byte-substituted package changes the canonical bytes.)
  const { readback: _readback, ...body } = pkg;
  void _readback;
  if (sha256Hex(toCanonicalBytes(body)) !== pkg.readback?.packageSha256) {
    errors.push({ code: "PACKAGE_DIGEST_MISMATCH", detail: "readback" });
  }
  // Reordered content: order fields must match their tree index.
  if (!ordersMonotonic(pkg.screens)) {
    errors.push({ code: "REORDERED_CONTENT", detail: "order must match tree index" });
  }
  // Evidence registry: unique refs.
  const refSet = new Set();
  for (const e of pkg.evidence ?? []) {
    if (refSet.has(e.ref)) errors.push({ code: "AMBIGUOUS_EVIDENCE_REF", detail: e.ref });
    refSet.add(e.ref);
  }
  // Tree walk: evidence cross-refs, display kinds, and tree membership.
  const treeFields = [];
  const treeComponents = [];
  const treeActions = [];
  for (const screen of pkg.screens ?? []) {
    for (const section of screen.sections ?? []) {
      for (const component of section.components ?? []) {
        treeComponents.push(component.componentId);
        const field = component.field;
        treeFields.push(field.fieldId);
        for (const ref of field.evidenceRefs ?? []) {
          if (!refSet.has(ref)) errors.push({ code: "MISSING_EVIDENCE", detail: ref });
        }
        if (!DISPLAY_KINDS.includes(field.displayKind)) {
          errors.push({ code: "UNSUPPORTED_DISPLAY_KIND", detail: field.fieldId });
        }
        for (const action of component.actions ?? []) {
          treeActions.push(action.actionId);
          for (const ref of [...(action.evidenceRefs ?? []), ...(action.requiredEvidenceRefs ?? [])]) {
            if (!refSet.has(ref)) errors.push({ code: "MISSING_EVIDENCE", detail: ref });
          }
        }
      }
    }
  }
  // Inventory <-> tree membership: unknown fields, extra components, hidden actions.
  pushSetMismatch(errors, "UNKNOWN_FIELD", inventoryIds(pkg, "fields"), treeFields);
  pushSetMismatch(errors, "EXTRA_COMPONENT", inventoryIds(pkg, "components"), treeComponents);
  pushSetMismatch(errors, "HIDDEN_ACTION", inventoryIds(pkg, "actions"), treeActions);
  // Cross-context: rendering in a different context than the package declares.
  if (typeof options.expectedContextId === "string" && pkg.contextId !== options.expectedContextId) {
    errors.push({ code: "CROSS_CONTEXT_ID", detail: pkg.contextId });
  }
  return { valid: errors.length === 0, errors };
}

// ---------------------------------------------------------------------------
// Schema-only renderer / independent generic reference consumer.
// ---------------------------------------------------------------------------
function projectField(f) {
  const out = {
    fieldId: f.fieldId,
    label: f.label,
    accessibilityLabel: f.accessibilityLabel,
    displayKind: f.displayKind,
    state: f.state,
    evidenceRefs: f.evidenceRefs,
  };
  if (f.help !== undefined) out.help = f.help;
  if (f.value !== undefined) out.value = f.value;
  if (f.reasonCode !== undefined) out.reasonCode = f.reasonCode;
  return out;
}

function projectAction(a) {
  const out = {
    actionId: a.actionId,
    order: a.order,
    enabled: a.enabled,
    authority: a.authority,
    confirmationIntent: a.confirmationIntent,
    readbackIntent: a.readbackIntent,
    requiredEvidenceRefs: a.requiredEvidenceRefs,
    evidenceRefs: a.evidenceRefs,
  };
  if (a.disabledReason !== undefined) out.disabledReason = a.disabledReason;
  return out;
}

function projectScreens(screens) {
  return screens.map((screen) => ({
    screenId: screen.screenId,
    order: screen.order,
    sections: screen.sections.map((section) => ({
      sectionId: section.sectionId,
      order: section.order,
      components: section.components.map((component) => ({
        componentId: component.componentId,
        order: component.order,
        kind: component.kind,
        field: projectField(component.field),
        actions: component.actions.map(projectAction),
      })),
    })),
  }));
}

/** Independent a11y readback: re-derived by a plain tree walk (oracle). */
function computeA11y(screens) {
  const fieldLabels = [];
  const actionStates = [];
  for (const screen of screens) {
    for (const section of screen.sections) {
      for (const component of section.components) {
        fieldLabels.push(component.field.label);
        for (const action of component.actions) {
          actionStates.push({ actionId: action.actionId, enabled: action.enabled });
        }
      }
    }
  }
  return { fieldCount: fieldLabels.length, actionCount: actionStates.length, fieldLabels, actionStates };
}

function deny(errors) {
  return { outcome: "DENIED", reasonCode: "PACKAGE_INTEGRITY_DENIED", detail: errors };
}

/**
 * SCHEMA-ONLY renderer. Validates the closed schema and the self-consistency
 * integrity gate, then projects the declared tree to a framework-neutral,
 * deeply-immutable render snapshot. It requires NO hard-coded trusted-source
 * binding: a schema-conforming, self-consistent package renders even if it was
 * not produced by the trusted producer. Forged / tampered / non-self-consistent
 * packages are denied (PACKAGE_INTEGRITY_DENIED) with reason codes.
 */
export function renderErvUiPackageV1(pkg, options = {}) {
  const schemaErrors = validateAgainstSchema(pkg);
  if (schemaErrors.length > 0) {
    return deny([
      { code: "SCHEMA_NONCONFORMING", detail: JSON.stringify(schemaErrors.map((e) => e.instancePath + " " + (e.message ?? ""))) },
    ]);
  }
  const integrity = verifyErvUiPackageV1Integrity(pkg, options);
  if (!integrity.valid) {
    return deny(integrity.errors);
  }
  const screens = projectScreens(pkg.screens);
  const a11y = computeA11y(screens);
  const snapshot = {
    outcome: "RENDERED",
    contextId: pkg.contextId,
    scenario: pkg.scenario,
    authority: pkg.authority,
    screens,
    a11y,
  };
  return deepFreeze({ ...snapshot, snapshotDigest: sha256Hex(toCanonicalBytes(screens)) });
}

/** The independent generic reference consumer = the schema-only renderer. */
export const genericReferenceConsumerRender = renderErvUiPackageV1;

// ---------------------------------------------------------------------------
// Component/action delta between two packages (baseline -> adapted).
// ---------------------------------------------------------------------------
export function computeErvUiPackageDeltaV1(baseline, adapted) {
  const base = collectInventory(baseline.screens);
  const adapt = collectInventory(adapted.screens);
  const diff = (a, b) => ({
    added: b.filter((x) => !a.includes(x)),
    removed: a.filter((x) => !b.includes(x)),
  });
  const delta = {
    fields: diff(base.fields, adapt.fields),
    components: diff(base.components, adapt.components),
    actions: diff(base.actions, adapt.actions),
  };
  return deepFreeze({ ...delta, deltaDigest: sha256Hex(toCanonicalBytes(delta)) });
}

// ---------------------------------------------------------------------------
// PRESERVED trusted-source forgery gate (SEPARATE from schema-only rendering).
// ---------------------------------------------------------------------------
/**
 * Trusted-source validation: confirms a package is byte-identical to the
 * trusted source digest. This is the PRESERVED source-forgery denial — it is a
 * distinct concern from schema-only rendering and remains in force regardless
 * of the rendering fix. A re-digested / forged package is SOURCE_FORGERY_DENIED.
 */
export function verifyTrustedErvUiSourceV1(pkg, trustedDigest) {
  if (typeof pkg !== "object" || pkg === null || Array.isArray(pkg)) {
    return { valid: false, reasonCode: "STRUCTURE_INVALID", actual: null, expected: trustedDigest };
  }
  const { readback: _readback, ...body } = pkg;
  void _readback;
  const actual = sha256Hex(toCanonicalBytes(body));
  const valid = typeof trustedDigest === "string" && actual === trustedDigest;
  return {
    valid,
    reasonCode: valid ? "TRUSTED_SOURCE_VERIFIED" : "SOURCE_FORGERY_DENIED",
    actual,
    expected: trustedDigest,
  };
}