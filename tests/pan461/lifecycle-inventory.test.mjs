import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import test from "node:test";
import Ajv2020 from "ajv/dist/2020.js";

import {
  ARTIFACT_ROLES_V1,
  GENERATION_AXES_V1,
  GENERATION_VALIDITY_V1,
  KEY_REF_ROLES_V1,
  LIFECYCLE_STATES_V1,
  PAN461_CONSUMER_CONTRACT_V1,
  PAN461_DECLARED_RELEASE_SCHEMA_V1,
  PAN461_SCHEMA_V1,
  STORE_KINDS_V1,
  createPan461LifecycleInventory,
  rebindPan461Inventory,
} from "../../src/pan461/lifecycle-inventory.mjs";

// Drive the ACTUAL released read-only observer (no manufactured probe
// outcomes). The public entry point executes adaptComposeDoctorObservationV1
// itself against the labelled observed snapshot bytes.
const index = await import("../../dist/packages/contracts/src/index.js");

const root = new URL("../..", import.meta.url).pathname;
const fix = (name) => readFileSync(`${root}tests/fixtures/pan461/${name}`, "utf8");
const sha256Hex = (value) => createHash("sha256").update(value).digest("hex");
// The independent expected facts, taken directly from the released fixtures
// and hard-coded here (NOT derived from the adapter).
const EXPECTED = JSON.parse(fix("expected-facts-v1.json"));

// Build the declared release with its lockDigest computed INDEPENDENTLY by the
// released contract (canonical digest of the declared content) — the same
// authority the module uses, so a caller-rehashed digest is not an identity.
function declaredRelease() {
  const content = JSON.parse(fix("declared-release-content-v1.json"));
  const lockContent = Object.fromEntries(Object.entries(content).filter(([key]) => key !== "lockDigest"));
  return { ...content, lockDigest: index.updateDoctorContractDigest(lockContent, "lockDigest") };
}
const stores = () => JSON.parse(fix("stores-v1.json"));
const keyRefs = () => JSON.parse(fix("key-refs-v1.json"));
const artifacts = () => JSON.parse(fix("artifacts-v1.json"));
const NOW = "2026-09-23T10:00:00Z";

function inventory(observedFile, { withStores = true, withArtifacts = false, withKeys = false, declared } = {}) {
  return createPan461LifecycleInventory({
    declaredRelease: declared ?? declaredRelease(),
    observed: fix(observedFile),
    persistentStores: withStores ? stores() : [],
    keyRefs: withKeys ? keyRefs() : [],
    artifacts: withArtifacts ? artifacts() : [],
    now: NOW,
  });
}
function rebindOf(result, observedFile, { binding, bindingDigest, withStores = true, withKeys = false, withArtifacts = false } = {}) {
  const bytes = fix(observedFile);
  // The rebind carries the SAME identity the original inventory used: declared
  // release, observed bytes, and the same store/key/artifact references. Only
  // the binding + digest are "substituted" from the serialized consumer.
  return rebindPan461Inventory({
    declaredRelease: declaredRelease(),
    observed: bytes,
    observedSha256: sha256Hex(bytes),
    persistentStores: withStores ? stores() : [],
    keyRefs: withKeys ? keyRefs() : [],
    artifacts: withArtifacts ? artifacts() : [],
    now: NOW,
    binding: binding ?? JSON.parse(JSON.stringify(result.binding)),
    bindingDigest: bindingDigest ?? result.bindingDigest,
  });
}
function deny(result, code) {
  assert.equal(result.outcome, "DENIED", JSON.stringify(result));
  assert.equal(result.code, code, `expected ${code}, got ${result.code}`);
}
const genOf = (result, axis) => result.generations.find((g) => g.axis === axis);

// ---------------------------------------------------------------------------
test("PAN461 current-main independent correction: process identity cannot be self-compared; published schema validates the actual boundary", () => {
  const r = inventory("observed-running-v1.json", { withStores: true, withArtifacts: true, withKeys: true });
  assert.equal(r.outcome, "INVENTORIED");
  const process = genOf(r, "process");
  assert.equal(process.declared.value, null);
  assert.match(process.observed.value, /^[a-f0-9]{64}$/);
  assert.equal(process.validity, "UNAVAILABLE");
  const schema = JSON.parse(readFileSync(`${root}schemas/contracts/pan461-lifecycle-inventory-v1.schema.json`, "utf8"));
  const validate = new Ajv2020({ allErrors: true, strict: true }).compile(schema);
  assert.equal(validate(r), true, JSON.stringify(validate.errors));
  assert.equal(validate({ ...r, unapprovedField: "x" }), false);
  assert.equal(validate({ ...r, persistentStores: [{ ...r.persistentStores[0], secretValue: "exposed" }] }), false);
});

test("PAN461 current-main independent correction: serialized self-rehash cannot substitute released observer", () => {
  const original = inventory("observed-running-v1.json", { withStores: true });
  const forged = structuredClone(original.binding);
  forged.installationIdentity.observedImageDigest = "0".repeat(64);
  const forgedDigest = sha256Hex(index.canonicalJson(forged));
  const result = rebindOf(original, "observed-running-v1.json", { binding: forged, bindingDigest: forgedDigest });
  deny(result, "SERIALIZED_BINDING_MISMATCH");
});

test("PAN461-AC01 positive: the actual released observer inventories a running installation and distinguishes declared from observed generations", () => {
  const r = inventory("observed-running-v1.json", { withStores: true });
  assert.equal(r.outcome, "INVENTORIED", JSON.stringify(r));
  assert.equal(r.lifecycleState, "RUNNING");
  assert.equal(r.binding.schemaVersion, PAN461_SCHEMA_V1);
  assert.equal(r.binding.consumerContract, PAN461_CONSUMER_CONTRACT_V1);
  assert.equal(r.binding.trust, "LOCAL_SYNTHETIC");
  assert.equal(r.observationValidity, "VALID");

  // The five generation axes are present, each labelled DECLARED vs OBSERVED,
  // and every decisive generation MATCHED the declared release.
  assert.deepEqual(r.generations.map((g) => g.axis), GENERATION_AXES_V1);
  for (const axis of GENERATION_AXES_V1) {
    const g = genOf(r, axis);
    assert.equal(g.declared.source, "DECLARED");
    assert.equal(g.observed.source, "OBSERVED");
    assert.equal(g.validity, EXPECTED.generationValidity[axis], `${axis} validity`);
  }
  // The declared image generation is the declared release image digest; the
  // observed image generation is the snapshot's observed lock digest.
  assert.equal(genOf(r, "image").declared.value, EXPECTED.IMG);
  assert.equal(genOf(r, "image").observed.value, EXPECTED.IMG);
});

test("PAN461-AC01 positive: stopped, sleeping, partially-installed and locally-modified installations are each recorded", () => {
  assert.equal(inventory("observed-stopped-v1.json").lifecycleState, EXPECTED.lifecycle.stopped);
  assert.equal(inventory("observed-sleeping-v1.json").lifecycleState, EXPECTED.lifecycle.sleeping);
  assert.equal(inventory("observed-partial-v1.json").lifecycleState, EXPECTED.lifecycle.partial);
  assert.equal(inventory("observed-modified-v1.json").lifecycleState, EXPECTED.lifecycle.modified);
  // The state vocabulary is closed and every recorded state is a member.
  for (const state of [
    "RUNNING", "STOPPED", "PARTIALLY_INSTALLED", "LOCALLY_MODIFIED", "SLEEPING", "UNKNOWN",
  ]) {
    assert.ok(LIFECYCLE_STATES_V1.includes(state), `closed vocabulary contains ${state}`);
  }
});

test("PAN461-AC01 negative: an unavailable decisive probe is UNKNOWN or PARTIALLY_INSTALLED, never an inferred version", () => {
  // Installation facet unavailable (compose version null) -> UNKNOWN.
  const unknown = inventory("observed-unknown-v1.json");
  assert.equal(unknown.lifecycleState, "UNKNOWN");
  assert.match(unknown.lifecycleReason, /unavailable/);
  // The UNKNOWN state is a fail-closed installation decision, not an inferred
  // version: the lifecycle is UNKNOWN, and no supported/declared version is
  // manufactured from the unavailable installation facet. The image generation
  // axis itself is still observed (present + equal), so it is honestly MATCHED
  // rather than defaulted — the absence is the INSTALLATION identity, which the
  // state reports as UNKNOWN.
  assert.equal(unknown.lifecycleState, "UNKNOWN");
  assert.equal(genOf(unknown, "image").validity, GENERATION_VALIDITY_V1[0]); // observed + equal -> MATCHED
  // The observation is DEGRADED (not VALID) because the installation identity
  // could not be observed.
  assert.equal(unknown.observationValidity, "DEGRADED");
  // Runtime facet unavailable -> PARTIALLY_INSTALLED (not inferred as running).
  const partial = inventory("observed-partial-v1.json");
  assert.equal(partial.lifecycleState, "PARTIALLY_INSTALLED");
  assert.match(partial.lifecycleReason, /not inferred/);
});

test("PAN461-AC01 positive: a drifted image generation is LOCALLY_MODIFIED with the image axis DRIFTED", () => {
  const r = inventory("observed-modified-v1.json", { withStores: true });
  assert.equal(r.lifecycleState, "LOCALLY_MODIFIED");
  assert.equal(genOf(r, "image").validity, GENERATION_VALIDITY_V1[1]); // DRIFTED
  assert.notEqual(genOf(r, "image").declared.value, genOf(r, "image").observed.value);
  // A drifted configuration while running is PARTIALLY_INSTALLED with config DRIFTED.
  const cfg = inventory("observed-config-drift-v1.json", { withStores: true });
  assert.equal(cfg.lifecycleState, "PARTIALLY_INSTALLED");
  assert.equal(genOf(cfg, "configuration").validity, GENERATION_VALIDITY_V1[1]);
});

test("PAN461-AC02 positive: every owned store, required config and key reference is listed without exporting a secret value", () => {
  const r = inventory("observed-running-v1.json", { withStores: true, withKeys: true });
  // Persistent stores: the secret is a reference path, never a value.
  assert.equal(r.persistentStores.length, stores().length);
  const db = r.persistentStores.find((s) => s.storeId === "store:db-store");
  assert.ok(db.hasSecretRef);
  assert.equal(db.secretRef, "/run/secrets/db");
  assert.equal(db.secretValue, "REDACTED");
  assert.equal(db.secretExported, false);
  // Key references: config, credential and certificate roles are all listed.
  assert.deepEqual(
    r.keyRefs.map((k) => k.role).sort(),
    [...KEY_REF_ROLES_V1].sort(),
  );
  for (const ref of r.keyRefs) {
    assert.equal(ref.secretValue, "REDACTED");
    assert.equal(ref.secretExported, false);
  }
  // No secret value string ever appears in the output.
  assert.ok(!JSON.stringify(r.binding).includes("supersecret"));
});

test("PAN461-AC02 positive: uncovered state is listed explicitly (unobserved required store/config and missing generations)", () => {
  // A store with an unobserved digest is listed as uncovered.
  const unobserved = inventory("observed-running-v1.json", {
    withStores: false,
  });
  // With no stores supplied, the schema/content generations are UNAVAILABLE
  // and explicitly uncovered.
  assert.ok(unobserved.uncoveredState.includes("schema:no-observed-schema-generation"));
  assert.ok(unobserved.uncoveredState.includes("content:no-single-observed-content-generation"));
  assert.equal(genOf(unobserved, "schema").validity, GENERATION_VALIDITY_V1[2]);
  assert.equal(genOf(unobserved, "content").validity, GENERATION_VALIDITY_V1[2]);
  // A required-but-unobserved config key ref is listed as uncovered.
  const withKeys = inventory("observed-running-v1.json", { withStores: true, withKeys: true });
  assert.ok(withKeys.uncoveredState.includes("config:key:cfg-main:required-not-observed"));
});

test("PAN461-AC02 negative: a caller cannot smuggle a secret value through a reference field or a malformed store", () => {
  // The closed-shape boundary is the secret gate: a store that is not one of
  // the exact five reference fields (e.g. carries an extra secret value) is
  // refused before any secret could reach the output.
  const smuggledStore = [
    { storeId: "store:db-store", kind: "DATABASE", path: "/data/db", observedDigest: EXPECTED.CONTENT, secretRef: "/run/secrets/db", value: "supersecret" },
  ];
  const r = createPan461LifecycleInventory({
    declaredRelease: declaredRelease(), observed: fix("observed-running-v1.json"),
    persistentStores: smuggledStore, now: NOW,
  });
  deny(r, "PERSISTENT_STORE_MALFORMED");
  // A credential key ref carrying a value is likewise refused.
  const smuggledKey = [
    { refId: "key:db-cred", role: "CREDENTIAL", path: "/run/secrets/db", required: true, token: "leaked-token" },
  ];
  const r2 = createPan461LifecycleInventory({
    declaredRelease: declaredRelease(), observed: fix("observed-running-v1.json"),
    keyRefs: smuggledKey, now: NOW,
  });
  deny(r2, "KEY_REF_MALFORMED");
});

test("PAN461-AC03 positive: installation identity, source/target artifacts and observation validity are bound; a source-only archive is not an installable target", () => {
  const r = inventory("observed-running-v1.json", { withStores: true, withArtifacts: true });
  // Installation identity binds declared + observed image generations.
  assert.equal(r.binding.installationIdentity.declaredImageDigest, EXPECTED.IMG);
  assert.equal(r.binding.installationIdentity.observedImageDigest, EXPECTED.IMG);
  assert.equal(r.binding.installationIdentity.releaseId, "1.2.3");
  // The only installable target is the IMAGE artifact whose observed image
  // generation equals the declared one; the source-only archive is never a
  // target.
  assert.deepEqual(r.installableTargets, EXPECTED.installableTargets);
  assert.deepEqual(r.sourceOnlyArtifacts, EXPECTED.sourceOnlyArtifacts);
  const src = r.artifacts.find((a) => a.artifactId === "art:src-arch");
  assert.equal(src.role, "SOURCE_ARCHIVE");
  assert.equal(src.sourceOnly, true);
  assert.equal(src.installable, false);
  const img = r.artifacts.find((a) => a.artifactId === "art:img-target");
  assert.equal(img.installable, true);
  assert.equal(img.sourceOnly, false);
  // The artifact role vocabulary is closed.
  assert.ok(["SOURCE_ARCHIVE", "IMAGE", "CONFIG_BUNDLE"].every((role) => ARTIFACT_ROLES_V1.includes(role)));
});

test("PAN461-AC03 negative: an IMAGE artifact whose observed generation drifts is not installable; observation validity degrades when the decisive generation is missing", () => {
  const driftedImage = [
    { artifactId: "art:img-drift", role: "IMAGE", sourceDigest: EXPECTED.IMG, observedImageDigest: "e".repeat(64) },
  ];
  const r = createPan461LifecycleInventory({
    declaredRelease: declaredRelease(), observed: fix("observed-running-v1.json"),
    artifacts: driftedImage, now: NOW,
  });
  assert.equal(r.outcome, "INVENTORIED", JSON.stringify(r));
  assert.equal(r.artifacts[0].installable, false);
  assert.deepEqual(r.installableTargets, []);
  // The unknown installation observation is DEGRADED, not VALID.
  const unknown = inventory("observed-unknown-v1.json");
  assert.equal(unknown.observationValidity, "DEGRADED");
});

test("PAN461-AC03 serialization: a genuine rebind re-executes the released observer and retains the exact binding", () => {
  const r = inventory("observed-running-v1.json", { withStores: true });
  const rebound = rebindOf(r, "observed-running-v1.json");
  assert.equal(rebound.outcome, "REBOUND", JSON.stringify(rebound));
  assert.equal(rebound.bindingDigest, r.bindingDigest);
  // The binding digest is the canonical sha256 of the binding itself.
  assert.equal(sha256Hex(index.canonicalJson(r.binding)), r.bindingDigest);
});

test("PAN461-AC03 negative: a substituted observed snapshot carried against an old binding is refused (SERIALIZED_BINDING_MISMATCH)", () => {
  const r = inventory("observed-running-v1.json", { withStores: true });
  // A resealed substituted snapshot (different observed image) has a DIFFERENT
  // binding. Carrying the OLD binding + digest against the substituted snapshot
  // must be refused as approval.
  const substituted = rebindPan461Inventory({
    declaredRelease: declaredRelease(),
    observed: fix("observed-modified-v1.json"),
    observedSha256: sha256Hex(fix("observed-modified-v1.json")),
    now: NOW,
    binding: JSON.parse(JSON.stringify(r.binding)),
    bindingDigest: r.bindingDigest,
  });
  deny(substituted, "SERIALIZED_BINDING_MISMATCH");
});

test("PAN461-AC03 negative: a wrong retained sha or missing identity is refused with exact codes", () => {
  const r = inventory("observed-running-v1.json", { withStores: true });
  const wrongSha = rebindPan461Inventory({
    declaredRelease: declaredRelease(), observed: fix("observed-running-v1.json"),
    observedSha256: "f".repeat(64), now: NOW,
    binding: r.binding, bindingDigest: r.bindingDigest,
  });
  deny(wrongSha, "OBSERVED_BYTES_MISMATCH");
  const missing = rebindPan461Inventory({
    declaredRelease: declaredRelease(), observed: undefined,
    observedSha256: sha256Hex(fix("observed-running-v1.json")), now: NOW,
    binding: r.binding, bindingDigest: r.bindingDigest,
  });
  deny(missing, "REBIND_INPUT_REQUIRED");
});

test("PAN461-AC03 negative: a malformed declared release or observed snapshot is refused at the boundary", () => {
  // A caller-rehashed lock digest that does not match the declared content is
  // not an accepted installation identity.
  const badDeclared = { ...declaredRelease(), lockDigest: "f".repeat(64) };
  deny(createPan461LifecycleInventory({
    declaredRelease: badDeclared, observed: fix("observed-running-v1.json"), now: NOW,
  }), "DECLARED_RELEASE_MALFORMED");
  // An observed snapshot whose expected config does not bind to the declared
  // config digest is refused (one declared source of truth for config).
  const driftCfg = JSON.parse(fix("observed-running-v1.json"));
  driftCfg.expectedConfigDigest = "f".repeat(64);
  deny(createPan461LifecycleInventory({
    declaredRelease: declaredRelease(), observed: JSON.stringify(driftCfg), now: NOW,
  }), "DECLARED_OBSERVED_CONFIG_BINDING_MISMATCH");
  // A mutated observed snapshot (wrong mutation count) is refused.
  const mutated = JSON.parse(fix("observed-running-v1.json"));
  mutated.mutationCount = 1;
  deny(createPan461LifecycleInventory({
    declaredRelease: declaredRelease(), observed: JSON.stringify(mutated), now: NOW,
  }), "OBSERVED_SNAPSHOT_MALFORMED");
  // A malformed observed snapshot (not a closed LOCAL_COMPOSE_SNAPSHOT) is refused.
  deny(createPan461LifecycleInventory({
    declaredRelease: declaredRelease(), observed: JSON.stringify({ foo: "bar" }), now: NOW,
  }), "OBSERVED_SNAPSHOT_MALFORMED");
});

test("PAN461 negative: missing required inputs are refused with exact codes", () => {
  deny(createPan461LifecycleInventory({
    declaredRelease: declaredRelease(), observed: fix("observed-running-v1.json"),
  }), "INPUT_REQUIRED");
  deny(createPan461LifecycleInventory({
    observed: fix("observed-running-v1.json"), now: NOW,
  }), "INPUT_REQUIRED");
});

test("PAN461: the closed vocabulary exports are code-owned and never widened", () => {
  assert.deepEqual(LIFECYCLE_STATES_V1, ["RUNNING", "STOPPED", "PARTIALLY_INSTALLED", "LOCALLY_MODIFIED", "SLEEPING", "UNKNOWN"]);
  assert.deepEqual(GENERATION_AXES_V1, ["image", "schema", "configuration", "content", "process"]);
  assert.deepEqual(GENERATION_VALIDITY_V1, ["MATCHED", "DRIFTED", "UNAVAILABLE"]);
  assert.deepEqual(STORE_KINDS_V1, ["DATABASE", "FILE", "SCHEMA", "CACHE"]);
  assert.deepEqual(KEY_REF_ROLES_V1, ["CONFIG", "CREDENTIAL", "CERTIFICATE"]);
  assert.deepEqual(ARTIFACT_ROLES_V1, ["SOURCE_ARCHIVE", "IMAGE", "CONFIG_BUNDLE"]);
});
