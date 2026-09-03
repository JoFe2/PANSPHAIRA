import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import Ajv2020 from "ajv/dist/2020.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const fixtureDir = path.join(root, "tests/fixtures/azure-power-platform");
const schemaPath = path.join(root, "docs/development/azure-power-platform/azpp-m1-tuple-ledger.schema.json");
const readJson = async (filePath) => JSON.parse(await readFile(filePath, "utf8"));
const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");
const digestPattern = /^[a-f0-9]{64}$/;
const immutableVersion = /^\d+\.\d+\.\d+$/;
const privateIdentifier = /(?:tenant|subscription|credential|identity|host|private|\/tmp\/|\/home\/|[A-Za-z]:[\\/])/i;
const privateEvidenceIdentifier = /(?:tenant|subscription|credential|identity|host|\/tmp\/|\/home\/|[A-Za-z]:[\\/])/i;
const absoluteOrHostedReference = /^(?:(?:[a-z][a-z0-9+.-]*:)?\/\/|\/|[A-Za-z]:[\\/]|\\\\)/i;
const expectedPolicyGeneration = 7;
const predecessorSchemaDigest = "6db105c03ad1d0fac78e6c53ac9259d5cbad69197b20dd92f5a5188572f13db2";
const expectedIntegratedSchemaDigest = "ecc734ebd41750cb9cabdfa64b3120114e69b9754797839b076522d71425c7ef";
const expectedPins = {
  component: {
    id: "power-platform-read-connector",
    version: "1.0.0",
    digest: "1111111111111111111111111111111111111111111111111111111111111111",
  },
  schema: {
    id: "power-platform-read-connector-schema",
    version: "1.0.0",
  },
  policy: {
    id: "power-platform-read-policy",
    version: "1.0.0",
    digest: "3333333333333333333333333333333333333333333333333333333333333333",
  },
  evidenceBundleDigest: "4444444444444444444444444444444444444444444444444444444444444444",
  tupleDigest: "c34dc875edbedded27aee37def1644b433a50654269552703223cf0b1d4d3e4d",
  lkgTupleDigest: "5555555555555555555555555555555555555555555555555555555555555555",
  publicLinks: {
    planningArtifact: {
      ref: "docs/development/ppread-001-authority-free-power-platform-read-connector-pdca.md",
      digest: "bbf9260e76397248e3e97a7cca6417726b1bfc2e024d97066653f4a546388e19",
    },
    implementationPrs: [
      { ref: "pull/32", digest: "2222222222222222222222222222222222222222222222222222222222222222" },
    ],
    release: {
      ref: "release/governance.json",
      digest: "c6a1db89d55c00edcbb72f6fd4b71719f691d319b95d26a0f50a37dd4b98add1",
    },
    publicReadback: {
      ref: "docs/development/ppread-001-authority-free-power-platform-read-connector-pdca.md",
      digest: "bbf9260e76397248e3e97a7cca6417726b1bfc2e024d97066653f4a546388e19",
    },
  },
};
const reasonCodes = {
  missingComponentDigest: "MISSING_COMPONENT_DIGEST_DENIED",
  mutableVersion: "MUTABLE_VERSION_DENIED",
  privateIdentifier: "PRIVATE_IDENTIFIER_DENIED",
  unknownField: "UNKNOWN_FIELD_DENIED",
  policyGeneration: "POLICY_GENERATION_MISMATCH_DENIED",
  revokedLkg: "LKG_REVOKED_DENIED",
  digestDrift: "DIGEST_DRIFT_DENIED",
  schema: "SCHEMA_DENIED",
  evidenceReference: "EVIDENCE_REFERENCE_DENIED",
  rollbackTarget: "ROLLBACK_TARGET_DENIED",
  publicClosureReference: "PUBLIC_CLOSURE_REFERENCE_DENIED",
};
const reasonCodesForLedger = [
  reasonCodes.missingComponentDigest,
  reasonCodes.mutableVersion,
  reasonCodes.privateIdentifier,
  reasonCodes.unknownField,
  reasonCodes.policyGeneration,
  reasonCodes.revokedLkg,
  reasonCodes.digestDrift,
];

const schema = await readJson(schemaPath);
const schemaDigest = sha256(await readFile(schemaPath));
const predecessorValid = await readJson(path.join(fixtureDir, "tuple-valid.json"));
const valid = structuredClone(predecessorValid);
valid.schema.digest = schemaDigest;
valid.tupleDigest = expectedPins.tupleDigest;
valid.accepted.tupleDigest = expectedPins.tupleDigest;
const digestDrift = await readJson(path.join(fixtureDir, "tuple-digest-drift.json"));
const ajv = new Ajv2020({ allErrors: true, strict: true });
const validateSchema = ajv.compile(schema);
const integrationReceiptSchema = schema.$defs.contractIntegrationReceipt;
const integrationReceipt = integrationReceiptSchema.const;
const validateIntegrationReceipt = ajv.compile(integrationReceiptSchema);

function canonicalize(value) {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value !== null && typeof value === "object") {
    return Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonicalize(value[key])]));
  }
  return value;
}

function tuplePayload(ledger) {
  return {
    component: ledger.component,
    schema: ledger.schema,
    policy: ledger.policy,
    evidence: ledger.evidence,
    environmentClass: ledger.environmentClass,
    limitations: ledger.limitations,
    negativeResults: ledger.negativeResults,
  };
}

function canonicalTupleBytes(ledger) {
  return JSON.stringify(canonicalize(tuplePayload(ledger)));
}

const allowedKeys = {
  root: ["schemaVersion", "status", "tupleDigest", "component", "schema", "policy", "evidence", "environmentClass", "limitations", "negativeResults", "accepted", "lkg", "rollback", "publicLinks"],
  component: ["id", "version", "digest"],
  schema: ["id", "version", "digest"],
  policy: ["id", "version", "generation", "digest"],
  evidence: ["bundleDigest", "refs"],
  evidenceRef: ["id", "ref", "digest"],
  negativeResult: ["id", "reasonCode", "evidenceRef"],
  accepted: ["status", "tupleDigest"],
  lkg: ["status", "tupleDigest", "revocationStatus", "evidenceRefs"],
  rollback: ["targetTupleDigest", "targetStatus", "targetRevocationStatus", "evidenceRefs"],
  publicLinks: ["planningArtifact", "implementationPrs", "release", "publicReadback"],
  publicLink: ["ref", "digest"],
};

function hasUnknownField(ledger) {
  const check = (value, kind) => {
    if (value === null || typeof value !== "object") return false;
    if (Array.isArray(value)) return value.some((item) => check(item, kind));
    if (Object.keys(value).some((key) => !allowedKeys[kind].includes(key))) return true;
    if (["component", "schema"].includes(kind)) return false;
    if (kind === "root") return check(value.component, "component") || check(value.schema, "schema") || check(value.policy, "policy") || check(value.evidence, "evidence") || check(value.accepted, "accepted") || check(value.lkg, "lkg") || check(value.rollback, "rollback") || check(value.publicLinks, "publicLinks") || (Array.isArray(value.negativeResults) ? value.negativeResults.some((item) => check(item, "negativeResult")) : check(value.negativeResults, "negativeResult"));
    if (kind === "policy") return false;
    if (kind === "evidence") return Array.isArray(value.refs) ? value.refs.some((item) => check(item, "evidenceRef")) : check(value.refs, "evidenceRef");
    if (kind === "publicLinks") return check(value.planningArtifact, "publicLink") || (Array.isArray(value.implementationPrs) ? value.implementationPrs.some((item) => check(item, "publicLink")) : check(value.implementationPrs, "publicLink")) || (value.release !== null && check(value.release, "publicLink")) || check(value.publicReadback, "publicLink");
    return false;
  };
  return check(ledger, "root");
}

function hasPrivateIdentifier(ledger) {
  const identifierValues = [ledger?.component?.id, ledger?.schema?.id, ledger?.policy?.id];
  const evidenceIdentifiers = Array.isArray(ledger?.evidence?.refs)
    ? ledger.evidence.refs.flatMap((item) => [item?.id, item?.ref])
    : [];
  const negativeIdentifiers = Array.isArray(ledger?.negativeResults)
    ? ledger.negativeResults.flatMap((item) => [item?.id, item?.evidenceRef])
    : [];
  const stateEvidenceIdentifiers = [
    ...(Array.isArray(ledger?.lkg?.evidenceRefs) ? ledger.lkg.evidenceRefs : []),
    ...(Array.isArray(ledger?.rollback?.evidenceRefs) ? ledger.rollback.evidenceRefs : []),
  ];
  const publicRefs = [
    ledger?.publicLinks?.planningArtifact?.ref,
    ...(Array.isArray(ledger?.publicLinks?.implementationPrs) ? ledger.publicLinks.implementationPrs.map((item) => item?.ref) : []),
    ledger?.publicLinks?.release?.ref,
    ledger?.publicLinks?.publicReadback?.ref,
  ];
  return [...identifierValues, ...publicRefs]
    .some((value) => typeof value === "string" && (privateIdentifier.test(value) || absoluteOrHostedReference.test(value)))
    || [...evidenceIdentifiers, ...negativeIdentifiers, ...stateEvidenceIdentifiers]
      .some((value) => typeof value === "string" && (privateEvidenceIdentifier.test(value) || absoluteOrHostedReference.test(value)));
}

function containsPrivateMaterial(value) {
  if (typeof value === "string") return privateEvidenceIdentifier.test(value) || absoluteOrHostedReference.test(value);
  if (Array.isArray(value)) return value.some(containsPrivateMaterial);
  if (value === null || typeof value !== "object") return false;
  return Object.entries(value).some(([key, child]) => {
    const normalizedKey = key.replace(/[^a-z0-9]/gi, "").toLowerCase();
    const privateKey = ["tenant", "subscription", "identity", "credential", "host"]
      .some((prefix) => normalizedKey.startsWith(prefix))
      || (normalizedKey.startsWith("environment") && normalizedKey !== "environmentclass");
    return privateKey || containsPrivateMaterial(child);
  });
}

function failure(code) {
  return { accepted: false, reasonCodes: [code], projection: null };
}

function validateLedger(ledger) {
  if (ledger?.component?.digest === undefined) return failure(reasonCodes.missingComponentDigest);
  if ([ledger.component?.version, ledger.schema?.version, ledger.policy?.version].some((version) => typeof version !== "string" || !immutableVersion.test(version))) return failure(reasonCodes.mutableVersion);
  if (hasUnknownField(ledger)) return failure(reasonCodes.unknownField);
  if (hasPrivateIdentifier(ledger)) return failure(reasonCodes.privateIdentifier);
  if (ledger?.policy?.generation !== expectedPolicyGeneration) return failure(reasonCodes.policyGeneration);
  if (ledger?.lkg?.revocationStatus !== "UNREVOKED" || ledger?.rollback?.targetRevocationStatus !== "UNREVOKED") return failure(reasonCodes.revokedLkg);
  if (!validateSchema(ledger)) return failure(reasonCodes.schema);
  if (
    ledger.component.id !== expectedPins.component.id
    || ledger.component.version !== expectedPins.component.version
    || ledger.component.digest !== expectedPins.component.digest
    || ledger.schema.id !== expectedPins.schema.id
    || ledger.schema.version !== expectedPins.schema.version
    || ledger.schema.digest !== schemaDigest
    || ledger.policy.id !== expectedPins.policy.id
    || ledger.policy.version !== expectedPins.policy.version
    || ledger.policy.digest !== expectedPins.policy.digest
    || ledger.evidence.bundleDigest !== expectedPins.evidenceBundleDigest
  ) return failure(reasonCodes.digestDrift);
  const tupleDigest = sha256(canonicalTupleBytes(ledger));
  if (tupleDigest !== expectedPins.tupleDigest || ledger.tupleDigest !== tupleDigest || ledger.accepted.tupleDigest !== tupleDigest) return failure(reasonCodes.digestDrift);
  const evidenceIds = new Set(ledger.evidence.refs.map((ref) => ref.id));
  const negativeIds = new Set(ledger.negativeResults.map((result) => result.reasonCode));
  const negativeResultIds = new Set(ledger.negativeResults.map((result) => result.id));
  if (evidenceIds.size !== ledger.evidence.refs.length || negativeResultIds.size !== ledger.negativeResults.length || ledger.negativeResults.length !== 7 || !reasonCodesForLedger.every((code) => negativeIds.has(code)) || ledger.negativeResults.some((result) => !evidenceIds.has(result.evidenceRef)) || ledger.lkg.evidenceRefs.some((ref) => !evidenceIds.has(ref)) || ledger.rollback.evidenceRefs.some((ref) => !evidenceIds.has(ref))) return failure(reasonCodes.evidenceReference);
  if (ledger.lkg.tupleDigest !== expectedPins.lkgTupleDigest || ledger.rollback.targetTupleDigest !== ledger.lkg.tupleDigest || ledger.accepted.status !== "ACCEPTED" || ledger.lkg.status !== "LKG" || ledger.rollback.targetStatus !== "LKG") return failure(reasonCodes.rollbackTarget);
  if (JSON.stringify(canonicalize(ledger.publicLinks)) !== JSON.stringify(canonicalize(expectedPins.publicLinks))) return failure(reasonCodes.publicClosureReference);
  return { accepted: true, reasonCodes: [], projection: { canonicalBytes: canonicalTupleBytes(ledger), tupleDigest } };
}

const denied = (input, code) => assert.deepEqual(validateLedger(input), failure(code));

function shuffledObject(value) {
  if (Array.isArray(value)) return value.map(shuffledObject);
  if (value !== null && typeof value === "object") return Object.fromEntries(Object.entries(value).reverse().map(([key, child]) => [key, shuffledObject(child)]));
  return value;
}

function rebindSelfDeclaredTuple(ledger) {
  const tupleDigest = sha256(canonicalTupleBytes(ledger));
  ledger.tupleDigest = tupleDigest;
  ledger.accepted.tupleDigest = tupleDigest;
}

test("the bounded integration receipt is exact, digest-bound, evidence-backed and fail-closed", async () => {
  assert.equal(schemaDigest, expectedIntegratedSchemaDigest);
  assert.equal(predecessorValid.schema.digest, predecessorSchemaDigest);
  assert.equal(valid.schema.digest, expectedIntegratedSchemaDigest);
  assert.equal(validateIntegrationReceipt(integrationReceipt), true, ajv.errorsText(validateIntegrationReceipt.errors));

  const receiptCore = structuredClone(integrationReceipt);
  delete receiptCore.receiptDigest;
  assert.equal(sha256(Buffer.from(JSON.stringify(canonicalize(receiptCore)))), integrationReceipt.receiptDigest);
  assert.equal(integrationReceipt.taskId, "TERRA-PSAI32-CONTRACT-INTEGRATE-01");
  assert.equal(integrationReceipt.classification, "LOCAL_VERIFY");
  assert.equal(integrationReceipt.scope.environmentClass, "LOCAL_SYNTHETIC_REPOSITORY_ONLY");
  assert.equal(integrationReceipt.scope.authority, "NONE");
  assert.equal(integrationReceipt.scope.externalMutationPerformed, false);
  assert.deepEqual(integrationReceipt.scope.writablePathsUsed, [
    "contracts/azure-power-platform/authoritative-readback-receipt.schema.json",
    "docs/development/azure-power-platform/azpp-m1-tuple-ledger.schema.json",
    "tests/azure-power-platform/azpp-m1-tuple-ledger.test.mjs",
  ]);
  assert.equal(integrationReceipt.decision.contractIntegration, "ACCEPTED_REPOSITORY_ONLY");
  assert.equal(integrationReceipt.decision.closureStatus, "PENDING_AUTHORITATIVE_CONTROLLER_GATES");
  assert.equal(integrationReceipt.decision.businessOrProductionSuccessClaimed, false);

  const evidenceById = new Map(integrationReceipt.evidenceRefs.map((item) => [item.id, item]));
  assert.equal(evidenceById.size, integrationReceipt.evidenceRefs.length);
  for (const item of integrationReceipt.evidenceRefs) {
    assert.match(item.sha256, digestPattern);
    assert.equal(sha256(await readFile(path.join(root, item.ref))), item.sha256, item.id);
  }
  for (const pin of Object.values(integrationReceipt.exactPins)) {
    assert.match(pin.sha256, digestPattern);
    assert.equal(sha256(await readFile(path.join(root, pin.path))), pin.sha256, pin.path);
  }

  assert.deepEqual(integrationReceipt.closedSurface.allowedActions, ["READ_RECORD", "READ_METADATA"]);
  assert.deepEqual(integrationReceipt.closedSurface.governedMutationActions, []);
  assert.deepEqual(integrationReceipt.closedSurface.errorFields, ["schemaVersion", "code", "correlationDigest", "decisionDigest"]);
  assert.equal(integrationReceipt.closedSurface.publicReasonCodes.length, 16);
  assert.equal(integrationReceipt.closedSurface.admissionReasonCodes.length, 10);
  assert.equal(Object.values(integrationReceipt.closedSurface.genericEscapeHatches).every((value) => value === false), true);

  const expectedDenials = new Map([
    ["UNKNOWN_FIELDS", ["UNKNOWN_FIELD_DENIED", "SCHEMA_DENIED"]],
    ["UNKNOWN_ACTIONS", ["UNKNOWN_ACTION_DENIED", "UNKNOWN_ACTION_DENIED"]],
    ["HIDDEN_WRITES", ["HIDDEN_WRITE_DENIED", "HIDDEN_WRITE_DENIED"]],
    ["SELF_APPROVAL", ["APPROVAL_SAME_ACTOR_DENIED", "APPROVAL_SAME_ACTOR_DENIED"]],
    ["DIGEST_DRIFT", ["DIGEST_DRIFT_DENIED", "DIGEST_MISMATCH_DENIED"]],
    ["REPLAY", ["REPLAY_CONSUMED_DENIED", "REPLAY_CONSUMED_DENIED"]],
    ["EXPIRY", ["AUTHORITY_EXPIRED_DENIED", "AUTHORITY_EXPIRED_DENIED"]],
    ["REVOCATION", ["AUTHORITY_REVOKED_DENIED", "REVOCATION_BINDING_DENIED"]],
    ["STALE_POLICY", ["POLICY_STALE_DENIED", "POLICY_STALE_DENIED"]],
  ]);
  assert.equal(integrationReceipt.negativeResults.length, expectedDenials.size);
  for (const result of integrationReceipt.negativeResults) {
    assert.deepEqual([result.admissionReasonCode, result.publicReasonCode], expectedDenials.get(result.case));
    assert.equal(result.outcome, "DENY");
    assert.equal(result.effectCount, 0);
    assert.equal(evidenceById.has(result.evidenceRef), true);
  }

  assert.equal(integrationReceipt.policy.selectedSyntheticPolicy.version, "1.0.0");
  assert.equal(integrationReceipt.policy.selectedSyntheticPolicy.generation, expectedPolicyGeneration);
  assert.match(integrationReceipt.policy.selectedSyntheticPolicy.digest, digestPattern);
  assert.equal(integrationReceipt.policy.sharedGatewayPolicy.generation, null);
  assert.equal(integrationReceipt.policy.sharedGatewayPolicy.powerPlatformMayInvokeCurrentActions, false);
  assert.equal(integrationReceipt.acceptedOperationClosure.transportAcceptanceIsBusinessSuccess, false);
  assert.equal(integrationReceipt.acceptedOperationClosure.authoritativeReadbackRequiredAfterEveryAcceptedOperation, true);
  assert.equal(integrationReceipt.acceptedOperationClosure.boundReceiptRequiredAfterEveryAcceptedOperation, true);
  assert.equal(integrationReceipt.acceptedOperationClosure.tamperEvidence.receiptDigestBindsExactClosedReceiptCore, true);
  assert.match(integrationReceipt.acceptedOperationClosure.syntheticAcceptedEvidence.readbackDigest, digestPattern);
  assert.match(integrationReceipt.acceptedOperationClosure.syntheticAcceptedEvidence.receiptDigest, digestPattern);
  assert.equal(integrationReceipt.rollback.contractTarget, "EXACT_LKG_FULL_TUPLE_DIGEST_FROM_INDEPENDENT_TRUSTED_CONTEXT");
  assert.equal(integrationReceipt.rollback.targetTupleDigest, expectedPins.lkgTupleDigest);
  assert.equal(integrationReceipt.rollback.targetRevocationStatus, "UNREVOKED");
  assert.equal(integrationReceipt.rollback.partialRollbackAllowed, false);
  assert.equal(integrationReceipt.rollback.latestVersionFallbackAllowed, false);
  assert.equal(integrationReceipt.limitations.includes("NO_BUSINESS_SUCCESS_WITHOUT_AUTHORITATIVE_READBACK_AND_BOUND_RECEIPT"), true);

  assert.equal(integrationReceipt.verification.focusedResult, "INFRASTRUCTURE_BLOCKED");
  assert.equal(integrationReceipt.verification.exitCode, 133);
  assert.equal(integrationReceipt.verification.productVerdict, "NONE");
  assert.equal(integrationReceipt.verification.advisoryFocusedResult, "PASS");
  assert.equal(integrationReceipt.verification.advisoryFocusedExitCode, 0);
  assert.equal(integrationReceipt.verification.advisoryFocusedTestCount, 28);
  assert.equal(integrationReceipt.verification.advisoryRepositoryGates.lint.result, "PASS");
  assert.equal(integrationReceipt.verification.advisoryRepositoryGates.build.result, "PASS");
  assert.equal(integrationReceipt.verification.advisoryRepositoryGates.test.result, "INFRASTRUCTURE_BLOCKED");
  assert.equal(integrationReceipt.verification.advisoryRepositoryGates.test.productVerdict, "NONE");
  assert.equal(integrationReceipt.verification.controllerAuthoritativeGatesRequired, true);
  const unknown = structuredClone(integrationReceipt);
  unknown.unlisted = true;
  assert.equal(validateIntegrationReceipt(unknown), false);
});

test("strict schema accepts the fully pinned synthetic tuple and rejects unknown fields", () => {
  assert.equal(validateSchema(valid), true, ajv.errorsText(validateSchema.errors));
  assert.equal(validateSchema({ ...valid, unlisted: true }), false);
  assert.equal(hasUnknownField({ ...valid, unlisted: true }), true);
});

test("strict schema classifies public closure links before accepting the tuple", () => {
  const implementationNotPr = structuredClone(valid);
  implementationNotPr.publicLinks.implementationPrs[0].ref = "docs/development/implementation.md";
  assert.equal(validateSchema(implementationNotPr), false);
  denied(implementationNotPr, reasonCodes.schema);

  const releaseNotRelease = structuredClone(valid);
  releaseNotRelease.publicLinks.release.ref = "docs/development/release-readback.md";
  assert.equal(validateSchema(releaseNotRelease), false);
  denied(releaseNotRelease, reasonCodes.schema);

  const privateEvidenceId = structuredClone(valid);
  privateEvidenceId.evidence.refs[0].id = "TENANT-EVIDENCE";
  assert.equal(validateSchema(privateEvidenceId), false);
  denied(privateEvidenceId, reasonCodes.privateIdentifier);

  const privateReference = structuredClone(valid);
  privateReference.evidence.refs[0].ref = "docs/Tenant/readback.md";
  assert.equal(validateSchema(privateReference), false);
  denied(privateReference, reasonCodes.privateIdentifier);
});

test("the accepted synthetic tuple canonicalizes to stable bytes without an environment identifier", () => {
  const result = validateLedger(valid);
  assert.equal(result.accepted, true);
  assert.equal(result.reasonCodes.length, 0);
  assert.equal(result.projection.tupleDigest, valid.tupleDigest);
  assert.equal(result.projection.canonicalBytes, canonicalTupleBytes(shuffledObject(valid)));
  assert.equal(valid.environmentClass, "LOCAL_SYNTHETIC_REPOSITORY_ONLY");
  assert.equal(JSON.stringify(result).includes("environmentId"), false);
  assert.equal(JSON.stringify(result).includes("tenant"), false);
  assert.equal(JSON.stringify(result).includes("subscription"), false);
  assert.equal(JSON.stringify(result).includes("credential"), false);
  assert.equal(JSON.stringify(result).includes("host"), false);
  assert.equal(JSON.stringify(result).includes("/tmp/"), false);
});

test("fixtures and accepted output contain no private identifiers, hosts or private paths", () => {
  const result = validateLedger(valid);
  assert.equal(result.accepted, true);
  assert.equal(containsPrivateMaterial(valid), false);
  assert.equal(containsPrivateMaterial(digestDrift), false);
  assert.equal(containsPrivateMaterial(result), false);
  assert.equal(containsPrivateMaterial(JSON.parse(result.projection.canonicalBytes)), false);
});

test("an Accepted tuple has an exact unrevoked LKG and rollback target plus public closure links", async () => {
  const result = validateLedger(valid);
  assert.equal(result.accepted, true);
  assert.deepEqual(valid.component, expectedPins.component);
  assert.deepEqual(valid.schema, { ...expectedPins.schema, digest: schemaDigest });
  assert.deepEqual(valid.policy, { ...expectedPins.policy, generation: expectedPolicyGeneration });
  assert.equal(valid.evidence.bundleDigest, expectedPins.evidenceBundleDigest);
  assert.equal(valid.accepted.status, "ACCEPTED");
  assert.equal(valid.accepted.tupleDigest, expectedPins.tupleDigest);
  assert.equal(valid.lkg.status, "LKG");
  assert.equal(valid.lkg.tupleDigest, expectedPins.lkgTupleDigest);
  assert.equal(valid.lkg.revocationStatus, "UNREVOKED");
  assert.equal(valid.rollback.targetTupleDigest, valid.lkg.tupleDigest);
  assert.equal(valid.rollback.targetStatus, "LKG");
  assert.equal(valid.rollback.targetRevocationStatus, "UNREVOKED");
  assert.deepEqual(valid.publicLinks, expectedPins.publicLinks);
  for (const link of [valid.publicLinks.planningArtifact, valid.publicLinks.publicReadback]) {
    assert.match(link.digest, digestPattern);
    assert.equal(sha256(await readFile(path.join(root, link.ref))), link.digest);
  }
  assert.deepEqual(valid.publicLinks.release, expectedPins.publicLinks.release);
  assert.match(valid.publicLinks.release.digest, digestPattern);
  assert.match(valid.publicLinks.implementationPrs[0].digest, digestPattern);
});

test("the declared negative results are public reason codes bound to evidence references", () => {
  const result = validateLedger(valid);
  assert.equal(result.accepted, true);
  assert.deepEqual(new Set(valid.negativeResults.map((item) => item.reasonCode)), new Set(reasonCodesForLedger));
  const evidenceIds = new Set(valid.evidence.refs.map((item) => item.id));
  for (const item of valid.negativeResults) assert.equal(evidenceIds.has(item.evidenceRef), true);
});

test("missing component digest, mutable version, private identifier, unknown field and policy mismatch deny without projection", () => {
  const missingDigest = structuredClone(valid);
  delete missingDigest.component.digest;
  denied(missingDigest, reasonCodes.missingComponentDigest);

  const mutable = structuredClone(valid);
  mutable.component.version = "latest";
  denied(mutable, reasonCodes.mutableVersion);

  const immutableVersionDrift = structuredClone(valid);
  immutableVersionDrift.component.version = "1.0.1";
  rebindSelfDeclaredTuple(immutableVersionDrift);
  denied(immutableVersionDrift, reasonCodes.digestDrift);

  const privateValue = structuredClone(valid);
  privateValue.component.id = "tenant-production";
  denied(privateValue, reasonCodes.privateIdentifier);

  for (const ref of ["https://example.invalid/readback", "/var/private/readback.json", "C:\\private\\readback.json"]) {
    const privateReference = structuredClone(valid);
    privateReference.evidence.refs[0].ref = ref;
    denied(privateReference, reasonCodes.privateIdentifier);
  }

  const unknown = structuredClone(valid);
  unknown.unlisted = true;
  denied(unknown, reasonCodes.unknownField);

  const policyMismatch = structuredClone(valid);
  policyMismatch.policy.generation = expectedPolicyGeneration + 1;
  denied(policyMismatch, reasonCodes.policyGeneration);
});

test("revoked LKG and digest drift deny without projection", () => {
  const revoked = structuredClone(valid);
  revoked.lkg.revocationStatus = "REVOKED";
  denied(revoked, reasonCodes.revokedLkg);

  const substitutedLkg = structuredClone(valid);
  substitutedLkg.lkg.tupleDigest = "6666666666666666666666666666666666666666666666666666666666666666";
  substitutedLkg.rollback.targetTupleDigest = substitutedLkg.lkg.tupleDigest;
  denied(substitutedLkg, reasonCodes.rollbackTarget);

  const substitutedClosure = structuredClone(valid);
  substitutedClosure.publicLinks.implementationPrs[0].digest = "7777777777777777777777777777777777777777777777777777777777777777";
  denied(substitutedClosure, reasonCodes.publicClosureReference);

  denied(digestDrift, reasonCodes.digestDrift);
});
