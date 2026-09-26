#!/usr/bin/env node
// PAN461 — read-only installation lifecycle inventory.
//
// Bounded, read-only, local-synthetic inventory for ONE declared local Linux
// installation. It distinguishes DECLARED release metadata from OBSERVED
// image / schema / configuration / content / process generations, records the
// installation lifecycle state, lists owned persistent stores, required
// configuration and key references WITHOUT exporting secret values, and binds
// installation identity + source/target artifacts + observation validity.
//
// Authority model (mirrors the KS238/PAN442 anti-substitution boundary):
//   - The public entry point executes the ACTUAL released read-only observer
//     (adaptComposeDoctorObservationV1) against the labelled observed snapshot
//     itself. It never accepts a caller-owned probe "outcome" as authority.
//   - A serialized consumer carries the binding + bindingDigest plus the
//     independently retained identity (declared release, observed snapshot,
//     their bytes/sha256, stores/config/keys/artifacts). Rebinding re-executes
//     the released observer against THOSE independently selected inputs and
//     requires the freshly derived binding to match exactly. A resealed
//     substituted snapshot whose content binding differs is never approval.
//
// Read-only / non-claims:
//   - This slice is a read-only inventory over SYNTHETIC fixtures. It performs
//     no productive host discovery, no network, no Docker, no installation,
//     update, migration, write, effect, or public-write authority.
//   - An unavailable probe remains UNKNOWN; it is never an inferred version.
//   - A source-only archive is never presented as an installable target.

import { createHash } from "node:crypto";
import {
  adaptComposeDoctorObservationV1,
  canonicalJson,
  updateDoctorContractDigest,
  DOCTOR_COMPOSE_OBSERVATION_SCHEMA_V1,
} from "../../dist/packages/contracts/src/index.js";

// ---------------------------------------------------------------------------
// Closed, versioned vocabulary (code-owned; never widened at the boundary).
// ---------------------------------------------------------------------------
export const PAN461_SCHEMA_V1 = "pansphaira.pan461/lifecycle-inventory/v1";
export const PAN461_CONSUMER_CONTRACT_V1 = "pan461.installation.lifecycle-inventory/v1";
export const PAN461_DECLARED_RELEASE_SCHEMA_V1 = "pansphaira.pan461/declared-release/v1";

// AC01: the lifecycle states the inventory must be able to record. UNKNOWN is
// the fail-closed state for any unavailable decisive probe (never inferred).
export const LIFECYCLE_STATES_V1 = Object.freeze([
  "RUNNING",
  "STOPPED",
  "PARTIALLY_INSTALLED",
  "LOCALLY_MODIFIED",
  "SLEEPING",
  "UNKNOWN",
]);

// AC01: the generation axes distinguished between declared metadata and
// observed reality.
export const GENERATION_AXES_V1 = Object.freeze([
  "image",
  "schema",
  "configuration",
  "content",
  "process",
]);

// AC01: per-axis generation validity.
export const GENERATION_VALIDITY_V1 = Object.freeze([
  "MATCHED",
  "DRIFTED",
  "UNAVAILABLE",
]);

// AC03: artifact roles. A SOURCE_ARCHIVE is an archive of the declared source;
// it is NEVER an installable target.
export const ARTIFACT_ROLES_V1 = Object.freeze([
  "SOURCE_ARCHIVE",
  "IMAGE",
  "CONFIG_BUNDLE",
]);

// AC02: store kinds.
export const STORE_KINDS_V1 = Object.freeze([
  "DATABASE",
  "FILE",
  "SCHEMA",
  "CACHE",
]);

// AC02: key-reference roles.
export const KEY_REF_ROLES_V1 = Object.freeze([
  "CONFIG",
  "CREDENTIAL",
  "CERTIFICATE",
]);

// The marker every secret-bearing field in the output carries. A real secret
// value is NEVER exported; only a reference path (secretRef) is retained.
const SECRET_VALUE_MARKER = "REDACTED";

const isRecord = (value) =>
  value !== null && typeof value === "object" && !Array.isArray(value)
  && Object.getPrototypeOf(value) === Object.prototype;
const isDenseArray = (value) =>
  Array.isArray(value) && Object.getPrototypeOf(value) === Array.prototype;
const exactKeys = (value, keys) =>
  isRecord(value) && canonicalJson(Object.keys(value).sort()) === canonicalJson([...keys].sort());
const sha256Hex = (value) => typeof value === "string" && /^[a-f0-9]{64}$/.test(value);
const closedId = (value) =>
  typeof value === "string" && /^[a-z][a-z0-9-]{1,31}:[a-z0-9][a-z0-9._-]{2,95}$/.test(value);
const semver = (value) =>
  typeof value === "string" && /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/.test(value);
const exactAxis = (value) => typeof value === "string" && /^v[1-9]\d*$/.test(value);
const sha = (value) => createHash("sha256").update(canonicalJson(value), "utf8").digest("hex");
const bytesSha = (value) => {
  const bytes = typeof value === "string" ? new TextEncoder().encode(value) : new Uint8Array(value);
  return createHash("sha256").update(bytes).digest("hex");
};

// Deep string/record inspection used to REFUSE any secret VALUE that a caller
// tries to smuggle through a nested payload that otherwise matches shape. Only
// a secretRef id (a path) may be present; a secret VALUE field is a denial.

// Parse the labelled observed snapshot bytes (raw JSON) into the closed
// snapshot object. A malformed snapshot is refused at the boundary, not thrown
// deep in the observer. The rebind hash covers these raw bytes exactly.
function parseObservedBytes(raw) {
  try {
    const text = typeof raw === "string" ? raw : Buffer.from(new Uint8Array(raw)).toString("utf8");
    const parsed = JSON.parse(text);
    return isRecord(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Input validation (closed shapes; every field is re-derived, never trusted).
// ---------------------------------------------------------------------------
function validDeclaredRelease(value) {
  if (!exactKeys(value, ["schemaVersion", "releaseId", "components", "versionAxes",
    "authorityProfile", "imageDigest", "schemaDigest", "configDigest",
    "contentDigest", "lockDigest"])) return false;
  if (value.schemaVersion !== PAN461_DECLARED_RELEASE_SCHEMA_V1
    || !semver(value.releaseId)
    || !isDenseArray(value.components) || value.components.length === 0
    || !value.components.every((component) => exactKeys(component, ["componentId", "version", "digest"])
      && closedId(component.componentId) && semver(component.version) && sha256Hex(component.digest))) return false;
  const ids = value.components.map(({ componentId }) => componentId);
  if (ids.length !== new Set(ids).size) return false;
  if (!exactKeys(value.versionAxes, ["controlPlane", "dataModel", "evidence"])
    || !Object.values(value.versionAxes).every(exactAxis)) return false;
  if (!exactKeys(value.authorityProfile, ["profileId", "digest"])
    || !closedId(value.authorityProfile.profileId) || !sha256Hex(value.authorityProfile.digest)) return false;
  if (![value.imageDigest, value.schemaDigest, value.configDigest,
    value.contentDigest, value.lockDigest].every(sha256Hex)) return false;
  // The declared lock digest is the canonical digest of the declared release
  // metadata (the installation image identity). A caller-rehashed digest that
  // does not match the content is never accepted as the declared identity.
  const lockContent = {
    schemaVersion: value.schemaVersion,
    releaseId: value.releaseId,
    components: value.components,
    versionAxes: value.versionAxes,
    authorityProfile: value.authorityProfile,
    imageDigest: value.imageDigest,
    schemaDigest: value.schemaDigest,
    configDigest: value.configDigest,
    contentDigest: value.contentDigest,
  };
  return updateDoctorContractDigest(lockContent, "lockDigest") === value.lockDigest;
}

function validStore(value) {
  if (!exactKeys(value, ["storeId", "kind", "path", "observedDigest", "secretRef"])) return false;
  if (!closedId(value.storeId) || !STORE_KINDS_V1.includes(value.kind)
    || typeof value.path !== "string" || value.path.length === 0
    || (value.observedDigest !== null && !sha256Hex(value.observedDigest))) return false;
  // secretRef is a path/id reference, never a value; null when no secret.
  if (value.secretRef !== null && (typeof value.secretRef !== "string" || value.secretRef.length === 0)) return false;
  return true;
}

function validKeyRef(value) {
  if (!exactKeys(value, ["refId", "role", "path", "required"])) return false;
  if (!closedId(value.refId) || !KEY_REF_ROLES_V1.includes(value.role)
    || typeof value.path !== "string" || value.path.length === 0
    || typeof value.required !== "boolean") return false;
  return true;
}

function validArtifact(value) {
  if (!exactKeys(value, ["artifactId", "role", "sourceDigest", "observedImageDigest"])) return false;
  if (!closedId(value.artifactId) || !ARTIFACT_ROLES_V1.includes(value.role)
    || !sha256Hex(value.sourceDigest)
    || (value.observedImageDigest !== null && !sha256Hex(value.observedImageDigest))) return false;
  return true;
}

function validObservedSnapshot(value) {
  // Must be a valid LOCAL_COMPOSE_SNAPSHOT (the released read-only observer
  // input). We re-validate the closed shape here so a malformed snapshot is
  // refused at the boundary rather than thrown deep in the observer.
  if (!exactKeys(value, ["schemaVersion", "source", "readOnly", "mutationCount",
    "observedLockDigest", "composeVersion", "expectedConfigDigest",
    "observedConfigDigest", "services"])) return false;
  if (value.schemaVersion !== DOCTOR_COMPOSE_OBSERVATION_SCHEMA_V1
    || value.source !== "LOCAL_COMPOSE_SNAPSHOT" || value.readOnly !== true
    || value.mutationCount !== 0 || !sha256Hex(value.observedLockDigest)) return false;
  if (!(value.composeVersion === null || /^v?\d+\.\d+\.\d+$/.test(value.composeVersion))) return false;
  if (!sha256Hex(value.expectedConfigDigest)) return false;
  if (!(value.observedConfigDigest === null || sha256Hex(value.observedConfigDigest))) return false;
  if (!isDenseArray(value.services) || value.services.length === 0
    || !value.services.every((service) => exactKeys(service, ["serviceId", "state", "health"])
      && typeof service.serviceId === "string" && /^[a-z][a-z0-9-]{1,31}$/.test(service.serviceId)
      && ["RUNNING", "STOPPED", "UNAVAILABLE"].includes(service.state)
      && ["HEALTHY", "UNHEALTHY", "NOT_AVAILABLE"].includes(service.health))) return false;
  const observedIds = value.services.map((service) => service.serviceId);
  if (observedIds.length !== new Set(observedIds).size) return false;
  return true;
}

// Execute the ACTUAL released read-only observer and return its five probe
// outcomes + the observed census. This is the single authority source for the
// observed facet; a caller-owned "outcome" is never accepted.
function executeObserver({ observed, requiredServiceIds }) {
  const fixture = adaptComposeDoctorObservationV1({ requiredServiceIds, snapshot: observed });
  const outcomes = Object.fromEntries(fixture.probes.map((probe) => [probe.checkId, probe.outcome]));
  return {
    installation: outcomes["cm:doctor-installation"] ?? "UNAVAILABLE",
    runtime: outcomes["cm:doctor-runtime"] ?? "UNAVAILABLE",
    configuration: outcomes["cm:doctor-configuration"] ?? "UNAVAILABLE",
    health: outcomes["cm:doctor-health-readback"] ?? "UNAVAILABLE",
  };
}

// Per-axis generation: declared release metadata vs observed reality. All axes
// compare same-type values (sha256 digests or an integer service count), so
// MATCHED / DRIFTED / UNAVAILABLE are well-defined:
//   MATCHED     both present and equal
//   DRIFTED     both present and unequal
//   UNAVAILABLE either side absent
function generation(axis, declared, observed) {
  let validity;
  if (declared === null || observed === null) {
    validity = "UNAVAILABLE";
  } else if (canonicalJson(declared) === canonicalJson(observed)) {
    validity = "MATCHED";
  } else {
    validity = "DRIFTED";
  }
  return {
    axis,
    declared: { source: "DECLARED", value: declared },
    observed: { source: "OBSERVED", value: observed },
    validity,
  };
}

// AC01: a closed, documented decision table. Decisive facets must be observed
// (MATCH/MISMATCH) to yield a concrete state; an unavailable decisive facet
// yields UNKNOWN or PARTIALLY_INSTALLED, never an inferred version.
function classifyLifecycle(probe, imageDrifted) {
  const { installation, runtime, configuration, health } = probe;
  if (installation === "UNAVAILABLE") {
    return { state: "UNKNOWN", reason: "installation probe unavailable; no installation identity inferred" };
  }
  if (imageDrifted) {
    // The observed image generation drifted from the declared release: the
    // local copy carries a different image than the declared one.
    return { state: "LOCALLY_MODIFIED", reason: "observed image generation drifted from the declared release" };
  }
  if (runtime === "UNAVAILABLE") {
    return { state: "PARTIALLY_INSTALLED", reason: "runtime facet unavailable; partial install, not inferred as running/stopped" };
  }
  if (configuration === "UNAVAILABLE") {
    return { state: "PARTIALLY_INSTALLED", reason: "configuration facet unavailable; partial install, not inferred" };
  }
  if (runtime === "MATCH" && configuration === "MATCH") {
    return { state: "RUNNING", reason: "image, runtime and configuration generations matched the declared release" };
  }
  if (runtime === "MISMATCH") {
    if (health === "UNAVAILABLE") {
      return { state: "SLEEPING", reason: "runtime stopped with no active health readback; image intact" };
    }
    return { state: "STOPPED", reason: "runtime stopped; image intact and health observable" };
  }
  // runtime MATCH but configuration MISMATCH: drifted config while running.
  return { state: "PARTIALLY_INSTALLED", reason: "configuration generation drifted from the declared release" };
}

// Build the inventory body from the independently validated inputs + the
// released observer outcomes. Pure: same inputs -> same binding.
function buildInventory({ declaredRelease, observed, persistentStores, configRefs, keyRefs, artifacts, now }) {
  const serviceIds = observed.services.map((service) => service.serviceId);
  const probe = executeObserver({ observed, requiredServiceIds: serviceIds });

  // The observed image generation is the snapshot's observedLockDigest. The
  // declared image generation is the release's imageDigest. Their comparison
  // is the honest declared-vs-observed image distinction (the observer's
  // fixture-level version-lock probe is unconditional, so it is not used for
  // drift; the direct digest comparison is).
  const imageDrifted = observed.observedLockDigest !== null
    && observed.observedLockDigest !== declaredRelease.imageDigest;

  const lifecycle = classifyLifecycle(probe, imageDrifted);

  // AC02 generation sources: exactly one SCHEMA store supplies the observed
  // schema generation; exactly one primary content store (DATABASE/FILE)
  // supplies the observed content generation. More than one of either leaves
  // that generation UNAVAILABLE rather than inventing an aggregate.
  const schemaStores = persistentStores.filter((store) => store.kind === "SCHEMA");
  const contentStores = persistentStores.filter((store) => store.kind === "DATABASE" || store.kind === "FILE");
  const observedSchema = schemaStores.length === 1 ? schemaStores[0].observedDigest : null;
  const observedContent = contentStores.length === 1 ? contentStores[0].observedDigest : null;

  const generations = [
    generation("image", declaredRelease.imageDigest, observed.observedLockDigest),
    generation("schema", declaredRelease.schemaDigest, observedSchema),
    generation("configuration", declaredRelease.configDigest, observed.observedConfigDigest),
    generation("content", declaredRelease.contentDigest, observedContent),
    // No declared process generation exists in the release metadata. An observed
    // service-state fingerprint is useful, but can never establish MATCHED.
    generation("process", null, sha(observed.services)),
  ];

  // AC03 observation validity: the binding is only VALID when the decisive
  // observed generations are present; otherwise DEGRADED, never fabricated.
  const imageObserved = observed.observedLockDigest !== null;
  const configObserved = observed.observedConfigDigest !== null;
  const observationValidity =
    imageObserved && configObserved
      ? (lifecycle.state === "UNKNOWN" ? "DEGRADED" : "VALID")
      : "DEGRADED";

  // AC02: owned persistent stores, required config and key references. The
  // closed-shape validators above are the secret gate: a reference (path) may
  // be carried but a secret VALUE field is refused at the boundary by the exact
  // key check, so no secret value ever reaches the output. secretValue is
  // always the marker and secretExported is always false.
  const persistentStoreInventory = persistentStores.map((store) => ({
    storeId: store.storeId,
    kind: store.kind,
    path: store.path,
    observedDigest: store.observedDigest,
    hasSecretRef: store.secretRef !== null,
    secretRef: store.secretRef,
    secretValue: SECRET_VALUE_MARKER, // ALWAYS the marker; never a value
    secretExported: false,
  }));
  const configInventory = configRefs.map((ref) => ({
    refId: ref.refId,
    role: "CONFIG",
    path: ref.path,
    required: ref.required,
    secretValue: SECRET_VALUE_MARKER,
    secretExported: false,
  }));
  const keyInventory = keyRefs.map((ref) => ({
    refId: ref.refId,
    role: ref.role,
    path: ref.path,
    required: ref.required,
    hasSecretRef: ref.role === "CREDENTIAL",
    secretValue: SECRET_VALUE_MARKER,
    secretExported: false,
  }));

  // AC03: source/target artifact classification. A SOURCE_ARCHIVE is never an
  // installable target; only an IMAGE artifact whose observed image digest
  // equals the declared image generation is installable.
  const artifactInventory = [];
  const installableTargets = [];
  const sourceOnlyArtifacts = [];
  for (const artifact of artifacts) {
    const installable =
      artifact.role === "IMAGE"
      && artifact.observedImageDigest !== null
      && artifact.observedImageDigest === declaredRelease.imageDigest;
    const sourceOnly = artifact.role === "SOURCE_ARCHIVE";
    artifactInventory.push({
      artifactId: artifact.artifactId,
      role: artifact.role,
      sourceDigest: artifact.sourceDigest,
      observedImageDigest: artifact.observedImageDigest,
      installable,
      sourceOnly,
    });
    if (installable) installableTargets.push(artifact.artifactId);
    if (sourceOnly) sourceOnlyArtifacts.push(artifact.artifactId);
  }

  // AC02: uncovered state is listed explicitly — anything declared/required
  // that is not evidenced by an observation.
  const uncoveredState = [];
  for (const store of persistentStores) {
    if (store.observedDigest === null) uncoveredState.push(`store:${store.storeId}:digest-unobserved`);
  }
  for (const ref of keyRefs) {
    if (ref.required && ref.role === "CONFIG") uncoveredState.push(`config:${ref.refId}:required-not-observed`);
  }
  if (schemaStores.length === 0) uncoveredState.push("schema:no-observed-schema-generation");
  if (contentStores.length !== 1) uncoveredState.push("content:no-single-observed-content-generation");
  if (!imageObserved) uncoveredState.push("image:observed-generation-missing");
  if (!configObserved) uncoveredState.push("configuration:observed-generation-missing");

  const installationIdentity = {
    releaseId: declaredRelease.releaseId,
    declaredImageDigest: declaredRelease.imageDigest,
    declaredLockDigest: declaredRelease.lockDigest,
    observedImageDigest: observed.observedLockDigest,
    composeVersion: observed.composeVersion,
  };

  const binding = {
    schemaVersion: PAN461_SCHEMA_V1,
    consumerContract: PAN461_CONSUMER_CONTRACT_V1,
    trust: "LOCAL_SYNTHETIC",
    now,
    installationIdentity,
    lifecycleState: lifecycle.state,
    lifecycleReason: lifecycle.reason,
    observationValidity,
    generations,
    persistentStores: persistentStoreInventory,
    configRefs: configInventory,
    keyRefs: keyInventory,
    artifacts: artifactInventory,
    installableTargets,
    sourceOnlyArtifacts,
    uncoveredState,
    declaredRelease: {
      releaseId: declaredRelease.releaseId,
      lockDigest: declaredRelease.lockDigest,
      versionAxes: declaredRelease.versionAxes,
    },
  };
  return {
    outcome: "INVENTORIED",
    code: "OK",
    lifecycleState: lifecycle.state,
    lifecycleReason: lifecycle.reason,
    observationValidity,
    generations,
    persistentStores: persistentStoreInventory,
    configRefs: configInventory,
    keyRefs: keyInventory,
    artifacts: artifactInventory,
    installableTargets,
    sourceOnlyArtifacts,
    uncoveredState,
    binding,
    bindingDigest: sha(binding),
  };
}

/**
 * Public read-only entry point. Owns the actual released observer execution:
 * callers provide the labelled observed snapshot, the declared release, and
 * the store/config/key/artifact references. A caller-owned probe outcome is
 * never accepted as authority. Fails closed with exact codes.
 */
export function createPan461LifecycleInventory({
  declaredRelease,
  observed,
  persistentStores = [],
  configRefs = [],
  keyRefs = [],
  artifacts = [],
  now,
} = {}) {
  if (declaredRelease === undefined || observed === undefined || typeof now !== "string") {
    return { outcome: "DENIED", code: "INPUT_REQUIRED" };
  }
  if (!validDeclaredRelease(declaredRelease)) return { outcome: "DENIED", code: "DECLARED_RELEASE_MALFORMED" };
  const observedSnapshot = parseObservedBytes(observed);
  if (observedSnapshot === null) return { outcome: "DENIED", code: "OBSERVED_BYTES_MALFORMED" };
  if (!validObservedSnapshot(observedSnapshot)) return { outcome: "DENIED", code: "OBSERVED_SNAPSHOT_MALFORMED" };
  // The observed snapshot's expected config must equal the declared release's
  // config digest: one declared source of truth for the configuration axis.
  if (observedSnapshot.expectedConfigDigest !== declaredRelease.configDigest) {
    return { outcome: "DENIED", code: "DECLARED_OBSERVED_CONFIG_BINDING_MISMATCH" };
  }
  if (!isDenseArray(persistentStores) || !persistentStores.every(validStore)) {
    return { outcome: "DENIED", code: "PERSISTENT_STORE_MALFORMED" };
  }
  if (!isDenseArray(configRefs) || !configRefs.every((ref) => validKeyRef(ref) && ref.role === "CONFIG")) {
    return { outcome: "DENIED", code: "CONFIG_REF_MALFORMED" };
  }
  if (!isDenseArray(keyRefs) || !keyRefs.every(validKeyRef)) {
    return { outcome: "DENIED", code: "KEY_REF_MALFORMED" };
  }
  if (!isDenseArray(artifacts) || !artifacts.every(validArtifact)) {
    return { outcome: "DENIED", code: "ARTIFACT_MALFORMED" };
  }
  try {
    return buildInventory({ declaredRelease, observed: observedSnapshot, persistentStores, configRefs, keyRefs, artifacts, now });
  } catch {
    return { outcome: "DENIED", code: "OBSERVER_FAILED" };
  }
}

/**
 * Mandatory content-bound re-binding after serialization. The consumer carries
 * the binding + bindingDigest plus the independently retained identity —
 * declared release, observed snapshot, and its sha256 — OUTSIDE the
 * substituted payload. The released observer is re-executed against those
 * inputs and the freshly derived binding must match exactly. A resealed
 * substituted snapshot whose content binding differs is never approval.
 */
export function rebindPan461Inventory({
  declaredRelease,
  observed,
  observedSha256,
  persistentStores = [],
  configRefs = [],
  keyRefs = [],
  artifacts = [],
  now,
  binding,
  bindingDigest,
} = {}) {
  if (declaredRelease === undefined || observed === undefined || typeof now !== "string"
    || typeof observedSha256 !== "string") {
    return { outcome: "DENIED", code: "REBIND_INPUT_REQUIRED" };
  }
  if (!sha256Hex(observedSha256) || bytesSha(observed) !== observedSha256) {
    return { outcome: "DENIED", code: "OBSERVED_BYTES_MISMATCH" };
  }
  const fresh = createPan461LifecycleInventory({
    declaredRelease, observed, persistentStores, configRefs, keyRefs, artifacts, now,
  });
  if (fresh.outcome !== "INVENTORIED") return { outcome: "DENIED", code: fresh.code };
  if (!isRecord(binding) || !sha256Hex(bindingDigest)) {
    return { outcome: "DENIED", code: "SERIALIZED_BINDING_MALFORMED" };
  }
  if (fresh.bindingDigest !== bindingDigest) {
    return { outcome: "DENIED", code: "SERIALIZED_BINDING_MISMATCH" };
  }
  if (fresh.bindingDigest !== sha(binding)) {
    return { outcome: "DENIED", code: "SERIALIZED_BINDING_MISMATCH" };
  }
  return {
    outcome: "REBOUND",
    code: "OK",
    binding,
    bindingDigest: fresh.bindingDigest,
    lifecycleState: fresh.lifecycleState,
  };
}

// Test/export helper: build a declared release whose lockDigest is the
// canonical digest of its own content (so fixtures are valid by construction).
export function makeDeclaredRelease(input) {
  const { schemaVersion, releaseId, components, versionAxes, authorityProfile,
    imageDigest, schemaDigest, configDigest, contentDigest } = input;
  const lockContent = { schemaVersion, releaseId, components, versionAxes, authorityProfile,
    imageDigest, schemaDigest, configDigest, contentDigest };
  return { ...lockContent, lockDigest: updateDoctorContractDigest(lockContent, "lockDigest") };
}
