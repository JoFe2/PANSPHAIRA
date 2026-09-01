import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  canonicalJson,
  configureExternalBiServiceV2,
  EXTERNAL_BI_SERVICE_CAPABILITIES_V2,
  invokeExternalBiServiceV2,
  probeExternalBiServiceV2,
  type ExternalBiServiceConfigDecisionV2,
} from "../packages/contracts/src/index.js";

const goodEnv = { BI_AGENT_BASE_URL: "http://127.0.0.1:18790", BI_AGENT_TIMEOUT_MS: "5000" };
const sha256 = (value: unknown) => `sha256:${createHash("sha256").update(canonicalJson(value)).digest("hex")}`;
type CleanRoomFixture = {
  readonly expectedOutcome: "VERIFIED";
  readonly expectedDirectSupersetAccessByCm: false;
  readonly expectedSupersetReadback: "NOT_APPLIED";
  readonly requiredCapabilities: readonly string[];
  readonly syntheticHoldout: {
    readonly id: string;
    readonly bytes: string;
    readonly attestationSchemaVersion: string;
    readonly intentResultSchemaVersion: string;
    readonly statusResult: Readonly<Record<string, unknown>>;
  };
  readonly authorityProfile: {
    readonly profileVersion: "v2";
    readonly schemaVersion: string;
    readonly product: Readonly<Record<string, unknown>>;
    readonly contract: Readonly<Record<string, unknown>>;
    readonly capabilities: readonly Readonly<Record<string, unknown>>[];
    readonly graph: Readonly<Record<string, unknown>>;
    readonly boundaries: Readonly<Record<string, unknown>>;
  };
  readonly adversarialMatrix: readonly {
    readonly id: string;
    readonly class: string;
    readonly expectedReasonCode: string;
  }[];
};
const cleanRoom = JSON.parse(readFileSync(
  "tests/fixtures/external-bi-service-v2-clean-room.json", "utf8",
)) as CleanRoomFixture;
const descriptor = {
  "bi.status.read": { action: "status", authority: "read-only" },
  "bi.discovery.run": { action: "discovery", authority: "local-evidence-write" },
  "bi.analysis.run": { action: "analyze", authority: "source-read-only" },
  "bi.graph.adaptive-v1.plan": { action: "plan", authority: "proposal-only" },
  "bi.preview.create": { action: "preview", authority: "proposal-only" },
  "bi.readback.read": { action: "readback", authority: "read-only" },
} as const;

function verified(): ExternalBiServiceConfigDecisionV2 {
  const decision = configureExternalBiServiceV2(goodEnv);
  assert.equal(decision.outcome, "VERIFIED");
  return decision;
}

function signedAttestation(overrides: Record<string, unknown> = {}) {
  const authority = cleanRoom.authorityProfile;
  const body = {
    schemaVersion: cleanRoom.syntheticHoldout.attestationSchemaVersion,
    product: structuredClone(authority.product),
    contract: structuredClone(authority.contract),
    capabilities: structuredClone(authority.capabilities),
    graph: structuredClone(authority.graph),
    boundaries: structuredClone(authority.boundaries),
    ...overrides,
  };
  return { ...body, attestation: { algorithm: "sha256-canonical-json", digest: sha256(body) } };
}

function signedResult(attestationDigest: string, requestId: string, action: string, result: Record<string, unknown> = {}) {
  const authority = cleanRoom.authorityProfile;
  const body = {
    schemaVersion: cleanRoom.syntheticHoldout.intentResultSchemaVersion, requestId, action,
    runtime: { product: structuredClone(authority.product), contract: structuredClone(authority.contract) },
    capabilityAttestationDigest: attestationDigest,
    result: action === "status" ? { ...cleanRoom.syntheticHoldout.statusResult, ...result } : result,
  };
  return { ...body, integrity: { algorithm: "sha256-canonical-json", digest: sha256(body) } };
}

function response(value: unknown, status = 200) {
  return new Response(JSON.stringify(value), { status, headers: { "content-type": "application/json" } });
}

function objectResponse(value: unknown): Response {
  return { ok: true, status: 200, json: async () => value } as Response;
}

function objectFetch(attestation: unknown, result?: unknown): typeof fetch {
  return (async (input: string | URL | Request) => String(input).endsWith("/v2/capabilities")
    ? objectResponse(attestation)
    : objectResponse(result ?? signedResult((attestation as { attestation: { digest: string } }).attestation.digest, "cm-external-bi-probe", "status"))) as typeof fetch;
}

function fakeFetch(attestation = signedAttestation(), capture: Array<{ url: string; init?: RequestInit }> = []): typeof fetch {
  return (async (input: string | URL | Request, init?: RequestInit) => {
    const url = String(input);
    capture.push(init === undefined ? { url } : { url, init });
    if (url.endsWith("/v2/capabilities")) return response(attestation);
    if (url.endsWith("/v2/intents")) {
      const request = JSON.parse(String(init?.body));
      return response(signedResult(attestation.attestation.digest, request.requestId, request.action, { receiptId: "fixture-receipt", proposalOnly: true }));
    }
    return response({ code: "UNEXPECTED_ROUTE" }, 404);
  }) as typeof fetch;
}

test("v2 config is default-off and rejects direct Superset ownership", () => {
  assert.equal(configureExternalBiServiceV2({}).outcome, "DISABLED");
  assert.deepEqual(configureExternalBiServiceV2({ ...goodEnv, SUPERSET_BASE_URL: "http://127.0.0.1:18088" }), {
    outcome: "DENIED", reasonCodes: ["EXTERNAL_BI_SERVICE_DIRECT_SUPERSET_CONFIG_DENIED"],
  });
});

test("v2 config pins exact product/contract, bounded timeout and a credential-free root URL", () => {
  const cases = [
    [{ ...goodEnv, BI_AGENT_EXPECTED_PRODUCT_VERSION: "v0.8.1" }, "EXTERNAL_BI_SERVICE_PRODUCT_VERSION_DENIED"],
    [{ ...goodEnv, BI_AGENT_EXPECTED_CONTRACT_VERSION: "2.0.1" }, "EXTERNAL_BI_SERVICE_CONTRACT_VERSION_DENIED"],
    [{ ...goodEnv, BI_AGENT_TIMEOUT_MS: "99" }, "EXTERNAL_BI_SERVICE_TIMEOUT_DENIED"],
    [{ ...goodEnv, BI_AGENT_BASE_URL: ["http://user", ":pass@127.0.0.1:18790"].join("") }, "EXTERNAL_BI_SERVICE_URL_DENIED"],
    [{ ...goodEnv, BI_AGENT_BASE_URL: "http://169.254.169.254" }, "EXTERNAL_BI_SERVICE_URL_DENIED"],
    [{ ...goodEnv, BI_AGENT_BASE_URL: "http://127.0.0.1:18790/api" }, "EXTERNAL_BI_SERVICE_URL_DENIED"],
  ] as const;
  for (const [env, code] of cases) {
    const result = configureExternalBiServiceV2(env);
    assert.equal(result.outcome, "DENIED");
    if (result.outcome === "DENIED") assert.deepEqual(result.reasonCodes, [code]);
  }
});

test("v2 client accepts a digest-bound v0.8.0 / 2.0.0 attestation and status", async () => {
  const result = await probeExternalBiServiceV2(verified(), fakeFetch());
  assert.equal(result.outcome, "VERIFIED");
  if (result.outcome === "VERIFIED") assert.equal(result.readback.directSupersetAccessByCm, false);
});

test("thin v2 client forwards only the six high-level intents to SBA and validates every envelope", async () => {
  const actions = ["status", "discovery", "analyze", "plan", "preview", "readback"] as const;
  const capture: Array<{ url: string; init?: RequestInit }> = [];
  for (const action of actions) {
    const result = await invokeExternalBiServiceV2(verified(), {
      requestId: `cm-${action}`,
      action,
      ...(action === "discovery" ? { input: { command: "start", sessionId: "cm-cleanroom" } }
        : action === "plan" || action === "preview" ? { input: { objective: "Review weekly order value", receiptId: "fixture-receipt" } }
          : {}),
    }, fakeFetch(signedAttestation(), capture));
    assert.equal(result.outcome, "VERIFIED", action);
  }
  assert(capture.every(({ url }) => url.startsWith("http://127.0.0.1:18790/v2/")));
  assert(capture.every(({ url }) => !/superset|18088/i.test(new URL(url).pathname)));
  const serialized = JSON.stringify(capture);
  assert.doesNotMatch(serialized, /authorization|bearer|password|credential|rawRows|SELECT\s/i);
});

test("draft negative: wrong server-attested product version is denied", async () => {
  const result = await probeExternalBiServiceV2(verified(), fakeFetch(signedAttestation({ product: { id: "superset-bi-agent", version: "v0.8.1", component: "bi-agent-runtime" } })));
  assert.deepEqual(result, { outcome: "DENIED", reasonCodes: ["EXTERNAL_BI_SERVICE_PRODUCT_VERSION_DENIED"] });
});

test("negative: wrong server-attested contract version is denied", async () => {
  const result = await probeExternalBiServiceV2(verified(), fakeFetch(signedAttestation({ contract: { id: "superset-bi-agent.external", version: "2.0.1" } })));
  assert.deepEqual(result, { outcome: "DENIED", reasonCodes: ["EXTERNAL_BI_SERVICE_CONTRACT_VERSION_DENIED"] });
});

test("draft negative: missing required capability is denied", async () => {
  const capabilities = EXTERNAL_BI_SERVICE_CAPABILITIES_V2.slice(1).map((id) => ({ id, ...descriptor[id] }));
  const result = await probeExternalBiServiceV2(verified(), fakeFetch(signedAttestation({ capabilities })));
  assert.deepEqual(result, { outcome: "DENIED", reasonCodes: ["EXTERNAL_BI_SERVICE_CAPABILITY_MISSING"] });
});

test("draft negative: attestation digest tamper is denied", async () => {
  const attestation = signedAttestation();
  (attestation.graph as Record<string, unknown>).acceptedIncumbent = "tampered";
  const result = await probeExternalBiServiceV2(verified(), fakeFetch(attestation));
  assert.deepEqual(result, { outcome: "DENIED", reasonCodes: ["EXTERNAL_BI_SERVICE_DIGEST_DENIED"] });
});

test("draft negative: unreachable service is typed unavailable", async () => {
  const unreachable = (async () => { throw new TypeError("unreachable"); }) as typeof fetch;
  const result = await probeExternalBiServiceV2(verified(), unreachable);
  assert.deepEqual(result, { outcome: "UNAVAILABLE", reasonCodes: ["EXTERNAL_BI_SERVICE_UNAVAILABLE"] });
});

test("negative: malformed attestation and malformed intent payloads fail closed", async () => {
  const malformedAttestation = (async () => new Response("{", { status: 200 })) as typeof fetch;
  assert.deepEqual(await probeExternalBiServiceV2(verified(), malformedAttestation), {
    outcome: "DENIED", reasonCodes: ["EXTERNAL_BI_SERVICE_ATTESTATION_MALFORMED"],
  });

  const attestation = signedAttestation();
  const malformedIntent = (async (input: string | URL | Request) => String(input).endsWith("/v2/capabilities")
    ? response(attestation)
    : new Response("{", { status: 200 })) as typeof fetch;
  assert.deepEqual(await probeExternalBiServiceV2(verified(), malformedIntent), {
    outcome: "DENIED", reasonCodes: ["EXTERNAL_BI_SERVICE_RESPONSE_MALFORMED"],
  });
});

test("negative: status response tamper and attestation-binding drift are denied", async () => {
  const attestation = signedAttestation();
  const tampered = signedResult(attestation.attestation.digest, "cm-external-bi-probe", "status");
  tampered.result.status = "NOT_READY";
  const tamperedFetch = (async (input: string | URL | Request) => String(input).endsWith("/v2/capabilities")
    ? response(attestation) : response(tampered)) as typeof fetch;
  assert.deepEqual(await probeExternalBiServiceV2(verified(), tamperedFetch), {
    outcome: "DENIED", reasonCodes: ["EXTERNAL_BI_SERVICE_DIGEST_DENIED"],
  });

  const rebound = signedResult("sha256:" + "0".repeat(64), "cm-external-bi-probe", "status");
  const reboundFetch = (async (input: string | URL | Request) => String(input).endsWith("/v2/capabilities")
    ? response(attestation) : response(rebound)) as typeof fetch;
  assert.deepEqual(await probeExternalBiServiceV2(verified(), reboundFetch), {
    outcome: "DENIED", reasonCodes: ["EXTERNAL_BI_SERVICE_DIGEST_DENIED"],
  });
});

test("negative: timeout is typed unavailable", async () => {
  const decision = configureExternalBiServiceV2({ BI_AGENT_BASE_URL: "http://127.0.0.1:18790", BI_AGENT_TIMEOUT_MS: "100" });
  const timeoutFetch = (async (_input: string | URL | Request, init?: RequestInit) => new Promise<Response>((_resolve, reject) => {
    init?.signal?.addEventListener("abort", () => reject(init.signal?.reason), { once: true });
  })) as typeof fetch;
  assert.deepEqual(await probeExternalBiServiceV2(decision, timeoutFetch), {
    outcome: "UNAVAILABLE", reasonCodes: ["EXTERNAL_BI_SERVICE_UNAVAILABLE"],
  });
});

test("negative: denied action, direct route metadata, credentials, raw rows and SQL never reach fetch", async () => {
  const probes = [
    { requestId: "deny-action", action: "publish" },
    { requestId: "deny-url", action: "plan", input: { objective: "Review weekly orders", url: "http://127.0.0.1:18088" } },
    { requestId: "deny-password", action: "discovery", input: { password: "not-forwarded" } },
    { requestId: "deny-rows", action: "analyze", input: { rawRows: [{ id: 1 }] } },
    { requestId: "deny-sql", action: "plan", input: { objective: "SELECT all orders" } },
  ] as const;
  for (const probe of probes) {
    let calls = 0;
    const neverFetch = (async () => { calls += 1; throw new Error("must not fetch"); }) as typeof fetch;
    const result = await invokeExternalBiServiceV2(verified(), probe as never, neverFetch);
    assert.equal(result.outcome, "DENIED");
    assert.equal(calls, 0);
  }
});

function matrixAttestation(id: string): Record<string, unknown> {
  const authority = cleanRoom.authorityProfile;
  switch (id) {
    case "unknown-product":
      return signedAttestation({ product: { ...authority.product, id: "superset-bi-agent-unknown" } });
    case "stale-product":
      return signedAttestation({ product: { ...authority.product, version: "v0.7.9" } });
    case "substituted-contract":
      return signedAttestation({ contract: { ...authority.contract, id: "substituted-bi-agent.external" } });
    case "substituted-capability":
      return signedAttestation({
        capabilities: authority.capabilities.map((capability, index) => index === 0
          ? { ...capability, authority: "source-read-only" }
          : capability),
      });
    case "incomplete-capability-set":
      return signedAttestation({ capabilities: authority.capabilities.slice(1) });
    case "paired-substitution":
      return signedAttestation({
        product: { ...authority.product, id: "substituted-bi-agent", version: "v9.9.9" },
        contract: { ...authority.contract, id: "substituted-bi-agent.external", version: "9.9.9" },
      });
    case "fully-redigested-forgery":
      return signedAttestation({
        product: { ...authority.product, id: "forged-bi-agent", version: "v9.9.9" },
        contract: { ...authority.contract, id: "forged-bi-agent.external", version: "9.9.9" },
        capabilities: authority.capabilities.map((capability, index) => index === 0
          ? { ...capability, id: "bi.forged.execute", authority: "model-mutation" }
          : capability),
        graph: { ...authority.graph, candidatePromotion: "forged-candidate" },
        boundaries: { ...authority.boundaries, freeSqlAccepted: true, modelMutationAuthority: true },
      });
    case "attestation-digest": {
      const value = signedAttestation();
      (value.graph as Record<string, unknown>).acceptedIncumbent = "tampered";
      return value;
    }
    case "accessor-profile": {
      const value = signedAttestation();
      Object.defineProperty(value.product, "version", {
        configurable: true,
        enumerable: true,
        get: () => authority.product.version,
      });
      return value;
    }
    case "hidden-profile-key": {
      const value = signedAttestation();
      Object.defineProperty(value.product, "hidden", { configurable: true, value: "not-visible", enumerable: false });
      return value;
    }
    case "symbol-profile-key": {
      const value = signedAttestation();
      Object.defineProperty(value.product, Symbol("hidden"), { configurable: true, value: "not-visible", enumerable: true });
      return value;
    }
    case "proxy-profile":
      return new Proxy(signedAttestation(), {});
    default:
      throw new Error(`matrix case is not an attestation case: ${id}`);
  }
}

test("FND-PS-03 exact owner-derived profile admits only the versioned synthetic tuple", async () => {
  assert.equal(cleanRoom.syntheticHoldout.id, "FND-PS-03-external-bi-v2-clean-room");
  assert.equal(cleanRoom.syntheticHoldout.bytes, "synthetic-non-customer-bytes-only");
  assert.equal(cleanRoom.authorityProfile.profileVersion, "v2");
  assert.equal(cleanRoom.authorityProfile.schemaVersion, "pansphaira.external-bi-service/compatibility-profile/v2");
  assert.deepEqual(cleanRoom.authorityProfile.product, {
    id: "superset-bi-agent",
    version: "v0.8.0",
    component: "bi-agent-runtime",
  });
  assert.deepEqual(cleanRoom.authorityProfile.contract, {
    id: "superset-bi-agent.external",
    version: "2.0.0",
  });
  assert.deepEqual(cleanRoom.authorityProfile.capabilities, EXTERNAL_BI_SERVICE_CAPABILITIES_V2.map((id) => ({
    id,
    ...descriptor[id],
  })));
  assert.deepEqual(cleanRoom.requiredCapabilities, EXTERNAL_BI_SERVICE_CAPABILITIES_V2);
  assert.deepEqual(cleanRoom.authorityProfile.capabilities.map(({ id }) => id), cleanRoom.requiredCapabilities);

  const decision = verified();
  if (decision.outcome !== "VERIFIED") throw new Error("fixture must configure");
  assert.equal(decision.config.expectedProductVersion, cleanRoom.authorityProfile.product.version);
  assert.equal(decision.config.expectedContractVersion, cleanRoom.authorityProfile.contract.version);
  assert.deepEqual(decision.config.requiredCapabilities, cleanRoom.requiredCapabilities);

  const first = await probeExternalBiServiceV2(decision, fakeFetch());
  const second = await probeExternalBiServiceV2(decision, fakeFetch());
  assert.deepEqual(first, second, "the synthetic positive proof must be deterministic");
  assert.equal(first.outcome, cleanRoom.expectedOutcome);
  if (first.outcome === "VERIFIED") {
    assert.equal(first.readback.productVersion, cleanRoom.authorityProfile.product.version);
    assert.equal(first.readback.contractVersion, cleanRoom.authorityProfile.contract.version);
    assert.deepEqual(first.readback.capabilities, cleanRoom.requiredCapabilities);
    assert.equal(first.readback.directSupersetAccessByCm, cleanRoom.expectedDirectSupersetAccessByCm);
  }
});

test("FND-PS-03 every attestation and result evidence digest is exact and bound", async () => {
  const attestation = signedAttestation();
  const { attestation: ignoredAttestation, ...attestationBody } = attestation;
  assert.equal(attestation.attestation.digest, sha256(attestationBody));

  const result = signedResult(attestation.attestation.digest, "cm-digest-holdout", "status");
  const { integrity: ignoredIntegrity, ...resultBody } = result;
  assert.equal(result.integrity.digest, sha256(resultBody));

  const accepted = await invokeExternalBiServiceV2(
    verified(),
    { requestId: "cm-digest-holdout", action: "status" },
    objectFetch(attestation, result),
  );
  if (accepted.outcome !== "VERIFIED") throw new Error("exact digest fixture must verify");
  assert.equal(accepted.readback.attestationDigest, attestation.attestation.digest);
  assert.equal(accepted.readback.responseDigest, result.integrity.digest);
  assert.equal(accepted.readback.result.status, cleanRoom.syntheticHoldout.statusResult.status);
});

test("FND-PS-03 reusable adversarial matrix denies unknown, stale, substituted, incomplete and forged profiles", async () => {
  for (const matrixCase of cleanRoom.adversarialMatrix) {
    let result: Awaited<ReturnType<typeof probeExternalBiServiceV2>>;
    if (matrixCase.id === "result-integrity-digest") {
      const attestation = signedAttestation();
      const forgedResult = signedResult(attestation.attestation.digest, "cm-external-bi-probe", "status");
      (forgedResult.result as Record<string, unknown>).status = "NOT_READY";
      result = await probeExternalBiServiceV2(verified(), objectFetch(attestation, forgedResult));
    } else if (matrixCase.id === "paired-attestation-result-binding") {
      const attestation = signedAttestation();
      const reboundResult = signedResult(`sha256:${"0".repeat(64)}`, "cm-external-bi-probe", "status");
      result = await probeExternalBiServiceV2(verified(), objectFetch(attestation, reboundResult));
    } else if (matrixCase.id === "post-validation-mutated-decision") {
      const mutated = structuredClone(verified()) as ExternalBiServiceConfigDecisionV2;
      if (mutated.outcome !== "VERIFIED") throw new Error("fixture must configure");
      (mutated.config as { biAgentBaseUrl: string }).biAgentBaseUrl = "http://127.0.0.1:28791";
      result = await probeExternalBiServiceV2(mutated, fakeFetch());
    } else {
      result = await probeExternalBiServiceV2(verified(), objectFetch(matrixAttestation(matrixCase.id)));
    }
    assert.equal(result.outcome, "DENIED", matrixCase.id);
    assert.deepEqual(result.reasonCodes, [matrixCase.expectedReasonCode], matrixCase.id);
  }
});

test("FND-PS-03 profile input boundary rejects accessor, Proxy, hidden and symbol keys", async () => {
  for (const id of ["accessor-profile", "proxy-profile", "hidden-profile-key", "symbol-profile-key"] as const) {
    const result = await probeExternalBiServiceV2(verified(), objectFetch(matrixAttestation(id)));
    assert.deepEqual(result, {
      outcome: "DENIED",
      reasonCodes: ["EXTERNAL_BI_SERVICE_ATTESTATION_MALFORMED"],
    }, id);
  }
});

test("FND-PS-03 post-validation mutation cannot alter accepted evidence or returned objects", async () => {
  const decision = verified();
  const attestation = signedAttestation();
  const result = signedResult(attestation.attestation.digest, "cm-isolation", "status");
  const accepted = await invokeExternalBiServiceV2(
    decision,
    { requestId: "cm-isolation", action: "status" },
    objectFetch(attestation, result),
  );
  if (accepted.outcome !== "VERIFIED") throw new Error("exact profile must verify");

  (attestation.product as Record<string, unknown>).version = "v9.9.9";
  (result.result as Record<string, unknown>).status = "NOT_READY";
  assert.equal(accepted.readback.attestationDigest, sha256({
    schemaVersion: cleanRoom.syntheticHoldout.attestationSchemaVersion,
    product: cleanRoom.authorityProfile.product,
    contract: cleanRoom.authorityProfile.contract,
    capabilities: cleanRoom.authorityProfile.capabilities,
    graph: cleanRoom.authorityProfile.graph,
    boundaries: cleanRoom.authorityProfile.boundaries,
  }));
  assert.equal(accepted.readback.result.status, cleanRoom.syntheticHoldout.statusResult.status);
  assert(Object.isFrozen(accepted));
  assert(Object.isFrozen(accepted.readback));
  assert(Object.isFrozen(accepted.readback.result));
  assert.throws(() => {
    (accepted.readback.result as Record<string, unknown>).status = "NOT_READY";
  }, TypeError);
  assert.throws(() => {
    (decision as { config?: { biAgentBaseUrl: string } }).config!.biAgentBaseUrl = "http://127.0.0.1:28791";
  }, TypeError);
});
