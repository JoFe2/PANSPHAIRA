import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import Ajv2020 from "ajv/dist/2020.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const contractDir = path.join(root, "contracts/azure-power-platform");
const fixtureDir = path.join(root, "tests/fixtures/azure-power-platform");
const readJson = async (filePath) => JSON.parse(await readFile(filePath, "utf8"));
const digest = (bytes) => createHash("sha256").update(bytes).digest("hex");

const schema = await readJson(path.join(contractDir, "readonly-connector.schema.json"));
const openApi = await readJson(path.join(contractDir, "readonly-connector.openapi.yaml"));
const valid = await readJson(path.join(fixtureDir, "readonly-openapi-valid.json"));
const escapes = await readJson(path.join(fixtureDir, "readonly-openapi-generic-escape.json"));
const ajv = new Ajv2020({ strict: false, allErrors: true });
const validateOpenApi = ajv.compile(schema);
const definitions = { $id: "https://chimpmaera.org/readonly-openapi-fixture", definitions: openApi.definitions };
ajv.addSchema(definitions);
const validateDefinition = (name) => ajv.compile({ $ref: `${definitions.$id}#/definitions/${name}` });

const operationPaths = {
  LIST_CAPABILITIES: ["GET", "/capabilities", "ListCapabilities", "ListCapabilitiesResponse", "{}"],
  SUBMIT_GOVERNED_QUERY: ["POST", "/queries", "SubmitGovernedQuery", "QueryAccepted", "body"],
  GET_OPERATION_STATUS: ["GET", "/operations/{operationId}", "GetOperationStatus", "OperationStatusResponse", "path"],
  GET_READBACK: ["GET", "/operations/{operationId}/readback", "GetReadback", "AuthoritativeReadbackResponse", "path"],
  GET_RECEIPT: ["GET", "/operations/{operationId}/receipt", "GetReceipt", "BoundReceiptResponse", "path"],
};
const declaredRouteMethods = {
  "/capabilities": ["get"],
  "/queries": ["post"],
  "/operations/{operationId}": ["get"],
  "/operations/{operationId}/readback": ["get"],
  "/operations/{operationId}/receipt": ["get"],
};
const httpMethods = ["get", "post", "put", "patch", "delete", "options", "head", "trace"];
const digestValue = /^[a-f0-9]{64}$/;
const tupleFields = ["bundleSchemaVersion", "subjectDigest", "planDigest", "evidenceBundleDigest", "verdictDigest", "readbackDigest"];
const mandatoryEscapeCases = [
  ["undeclared POST endpoint", "UNKNOWN_ACTION_DENIED"],
  ["undeclared PUT endpoint", "UNKNOWN_ACTION_DENIED"],
  ["undeclared PATCH endpoint", "UNKNOWN_ACTION_DENIED"],
  ["undeclared DELETE endpoint", "UNKNOWN_ACTION_DENIED"],
  ["generic proxy field", "SCHEMA_DENIED"],
  ["arbitrary path field", "SCHEMA_DENIED"],
  ["arbitrary URL field", "SCHEMA_DENIED"],
  ["arbitrary body field", "SCHEMA_DENIED"],
  ["undeclared operation", "UNKNOWN_ACTION_DENIED"],
  ["mismatched capability tuple", "SCHEMA_DENIED"],
  ["extra field", "SCHEMA_DENIED"],
  ["command verb", "SCHEMA_DENIED"],
  ["credential field", "AUTHORITY_BINDING_DENIED"],
  ["mutable authority field", "AUTHORITY_BINDING_DENIED"],
  ["write-shaped response", "HIDDEN_WRITE_DENIED"],
];

function canonicalize(value) {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonicalize(value[key])]));
  }
  return value;
}

function error(code) {
  return {
    schemaVersion: "pansphaira.power-platform/error/v1",
    code,
    correlationDigest: "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
    decisionDigest: "eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee",
  };
}

test("closed OpenAPI document validates against its closed schema and binds the schema digest", async () => {
  assert.equal(validateOpenApi(openApi), true, ajv.errorsText(validateOpenApi.errors));
  assert.deepEqual(Object.keys(openApi.paths).sort(), [
    "/capabilities",
    "/operations/{operationId}",
    "/operations/{operationId}/readback",
    "/operations/{operationId}/receipt",
    "/queries",
  ]);
  assert.equal(
    digest(await readFile(path.join(contractDir, "readonly-connector.schema.json"))),
    openApi["x-pansphaira-connector"].openApiSchemaBinding.sha256,
  );
  const withoutDocumentDigest = structuredClone(openApi);
  withoutDocumentDigest["x-pansphaira-connector"].documentDigest = "";
  assert.equal(
    digest(Buffer.from(JSON.stringify(canonicalize(withoutDocumentDigest)))),
    openApi["x-pansphaira-connector"].documentDigest,
  );
  assert.equal(valid.tupleLedger.openApiSchemaSha256, openApi["x-pansphaira-connector"].openApiSchemaBinding.sha256);
});

test("all five declared operations accept canonical synthetic requests and expose the verification tuple", () => {
  for (const [operationKey, [method, route, operationId, responseName, requestKind]] of Object.entries(operationPaths)) {
    const operation = openApi.paths[route][method.toLowerCase()];
    assert.equal(operation.operationId, operationId);
    assert.deepEqual(operation.tags, ["read-only"]);
    assert.deepEqual(operation.security, [{ powerPlatformReadOnlyOAuth2: ["cm.discovery.read"] }]);
    const successCode = requestKind === "body" ? "202" : "200";
    assert.equal(operation.responses[successCode].schema.$ref, `#/definitions/${responseName}`);
    const responseSchemaSubstitution = structuredClone(openApi);
    responseSchemaSubstitution.paths[route][method.toLowerCase()].responses[successCode].schema.$ref = "#/definitions/ConnectorError";
    assert.equal(validateOpenApi(responseSchemaSubstitution), false, `${operationKey}: response schema substitution`);
    const response = valid.responses[operationKey];
    const validateResponse = validateDefinition(responseName);
    assert.equal(validateResponse(response), true, `${operationKey}: ${ajv.errorsText(validateResponse.errors)}`);
    assert.deepEqual(Object.keys(response.verificationTuple).sort(), [...tupleFields].sort());
    if (requestKind === "body") {
      assert.equal(validateDefinition("SubmitGovernedQueryRequest")(valid.requests[operationKey]), true);
    } else if (requestKind === "path") {
      assert.deepEqual(Object.keys(valid.requests[operationKey]), ["operationId"]);
      assert.match(valid.requests[operationKey].operationId, digestValue);
    } else {
      assert.deepEqual(valid.requests[operationKey], {});
    }
  }
});

test("error schema exposes only fixed public reason codes and no free-text internals", () => {
  const reasonCodes = openApi.definitions.ReasonCode.enum;
  const validateError = validateDefinition("ConnectorError");
  for (const code of reasonCodes) assert.equal(validateError(error(code)), true, code);
  assert.equal(validateError({ ...error("SCHEMA_DENIED"), message: "internal" }), false);
  assert.equal(validateError({ ...error("NOT_A_PUBLIC_CODE") }), false);
  assert.equal(validateError({ ...error("SCHEMA_DENIED"), details: { stack: "internal" } }), false);
});

test("HTTP verbs and routes are closed to the five declared read-only operations", () => {
  assert.deepEqual(openApi.paths, Object.fromEntries(
    Object.entries(declaredRouteMethods).map(([route, methods]) => [
      route,
      Object.fromEntries(methods.map((method) => [method, openApi.paths[route][method]])),
    ]),
  ));
  for (const [route, declaredMethods] of Object.entries(declaredRouteMethods)) {
    for (const method of httpMethods) {
      if (declaredMethods.includes(method)) continue;
      const candidate = structuredClone(openApi);
      candidate.paths[route][method] = structuredClone(openApi.paths["/capabilities"].get);
      assert.equal(validateOpenApi(candidate), false, `${method.toUpperCase()} ${route}`);
    }
  }
  for (const route of ["/records", "/providers", "/proxy", "/arbitrary/path"]) {
    const candidate = structuredClone(openApi);
    candidate.paths[route] = { get: structuredClone(openApi.paths["/capabilities"].get) };
    assert.equal(validateOpenApi(candidate), false, `GET ${route}`);
  }
});

test("generic proxy/path/url/body, undeclared operation, extra field, command, credential, mutable authority and write response fail closed", () => {
  const validateRequest = validateDefinition("SubmitGovernedQueryRequest");
  const validateError = validateDefinition("ConnectorError");
  const reasonCodes = openApi.definitions.ReasonCode.enum;
  const baseRequest = valid.requests.SUBMIT_GOVERNED_QUERY;
  assert.deepEqual(
    escapes.cases.map(({ name, reasonCode }) => [name, reasonCode]),
    mandatoryEscapeCases,
    "the mandatory denial matrix must not silently lose or relabel a case",
  );
  for (const item of escapes.cases) {
    assert.ok(reasonCodes.includes(item.reasonCode), `${item.name}: fixed public reason code`);
    assert.equal(validateError(error(item.reasonCode)), true, `${item.name}: valid public error`);
    if (item.capabilityPatch) {
      const candidate = structuredClone(valid.responses.LIST_CAPABILITIES);
      candidate.capabilities[0] = { ...candidate.capabilities[0], ...item.capabilityPatch };
      assert.equal(validateDefinition("ListCapabilitiesResponse")(candidate), false, item.name);
      continue;
    }
    if (item.response) {
      const candidate = { ...valid.responses.GET_READBACK, ...item.response };
      assert.equal(validateDefinition("AuthoritativeReadbackResponse")(candidate), false, item.name);
      continue;
    }
    if (item.method) {
      assert.equal(openApi.paths[item.path]?.[item.method.toLowerCase()], undefined, item.name);
      const candidate = structuredClone(openApi);
      candidate.paths[item.path] ??= {};
      candidate.paths[item.path][item.method.toLowerCase()] = structuredClone(openApi.paths["/capabilities"].get);
      assert.equal(validateOpenApi(candidate), false, `${item.name}: closed OpenAPI schema`);
      continue;
    }
    assert.equal(validateRequest({ ...baseRequest, ...(item.body ?? {}) }), false, item.name);
  }
  assert.deepEqual(openApi.definitions.SubmitGovernedQueryRequest.required, [
    "schemaVersion", "action", "requestDigest", "correlationDigest", "idempotencyKeyDigest",
  ]);
  assert.equal(openApi.definitions.SubmitGovernedQueryRequest.additionalProperties, false);
});

test("the tuple ledger records environment, policy, limitations, rollback and evidence bindings", async () => {
  const connector = openApi["x-pansphaira-connector"];
  assert.equal(connector.contractVersion, "1.0.0");
  assert.equal(connector.environmentClass, "LOCAL_SYNTHETIC_REPOSITORY_ONLY");
  assert.equal(connector.openApiSchemaBinding.sha256, valid.tupleLedger.openApiSchemaSha256);
  assert.match(connector.documentDigest, digestValue);
  assert.equal(connector.connectorContractBinding.contractVersion, "1.0.0");
  assert.equal(
    digest(await readFile(path.join(root, connector.connectorContractBinding.sourcePath))),
    connector.connectorContractBinding.sourceSha256,
  );
  assert.match(connector.connectorContractBinding.contractDigest, digestValue);
  assert.equal(connector.identityBinding.contractVersion, "1.0.0");
  assert.equal(
    digest(await readFile(path.join(root, connector.identityBinding.sourcePath ?? "packages/contracts/src/azure-identity-profile.ts"))),
    connector.identityBinding.sourceSha256,
  );
  assert.match(connector.identityBinding.profileDigest, digestValue);
  assert.equal(connector.gatewayBinding.sourceSha256, digest(await readFile(path.join(root, connector.gatewayBinding.source))));
  assert.equal(connector.gatewayBinding.catalogueVersion, "1.0.0");
  assert.match(connector.gatewayBinding.catalogueDigest, digestValue);
  assert.equal(connector.gatewayBinding.policyVersion, "1.0.0");
  assert.equal(connector.gatewayBinding.policyGeneration, null);
  assert.equal(connector.gatewayBinding.policyGenerationReason, "The capability policy v1 export is version-and-digest bound and does not export a numeric policyGeneration.");
  assert.equal(connector.gatewayBinding.policyDigest, "c0670df5ef0d91635316b52f66cc65123792b857c328d24e21daf98a0adf2b89");
  assert.equal(connector.rollbackBinding.rollbackTarget, "EXACT_LKG_FULL_TUPLE_DIGEST_FROM_INDEPENDENT_TRUSTED_CONTEXT");
  assert.ok(connector.limitations.includes("NO_CREDENTIAL_USE"));
  assert.ok(connector.limitations.includes("NO_BUSINESS_SUCCESS_WITHOUT_AUTHORITATIVE_READBACK_AND_BOUND_RECEIPT"));
  assert.ok(connector.failClosedCaseBindings.every((item) => openApi.definitions.ReasonCode.enum.includes(item.code)));
  assert.ok(connector.failClosedCaseBindings.some((item) => item.case === "hidden writes" && item.result === "DENY" && item.effectCount === 0));
  assert.ok(connector.evidenceRefs.length >= 3);
  assert.equal(connector.credentials.embeddedAllowed, false);
  assert.equal(connector.credentials.dynamicSelectionAllowed, false);
  assert.equal(connector.genericEscapeHatches.genericProxy, false);
});
