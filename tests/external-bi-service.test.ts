import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import test from "node:test";
import { types as nodeTypes } from "node:util";

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
  readonly pairedCompatibility: PairedCompatibilityInput;
};

type PairedCapability = {
  readonly id: string;
  readonly action: string;
  readonly authority: string;
  readonly externalIntent?: false;
};
type PairedProfile = {
  readonly schemaVersion: string;
  readonly product: { readonly id: string; readonly version: string; readonly component: string };
  readonly contract: { readonly id: string; readonly version: string };
  readonly capabilities: readonly PairedCapability[];
  readonly partialCapabilities?: readonly PairedCapability[];
  readonly unsupported?: readonly { readonly surface: string; readonly accepted: false }[];
  readonly boundaries?: Readonly<Record<string, unknown>>;
};
type PairedByteIdentity = {
  readonly roles: readonly string[];
  readonly path: string;
  readonly gitBlob: string;
  readonly sha256: string;
};
type PairedRepositoryInput = {
  readonly repository: string;
  readonly issueClosure: {
    readonly number: number;
    readonly state: "closed";
    readonly stateReason: "completed";
    readonly closedAt: string;
    readonly bodySha256: string;
    readonly ownerComment: {
      readonly id: number;
      readonly author: "JoFe2";
      readonly authorAssociation: "OWNER";
      readonly body: string;
      readonly bodySha256: string;
    };
  };
  readonly release: {
    readonly releaseId: number;
    readonly tag: string;
    readonly head: string;
    readonly tree: string;
    readonly publishedAt: string;
    readonly prerelease: false;
  };
  readonly profile: PairedProfile;
  readonly byteIdentities: readonly PairedByteIdentity[];
};
type PairedCompatibilityInput = {
  readonly schemaVersion: string;
  readonly evidenceId: string;
  readonly sourceClass: string;
  readonly repositories: {
    readonly pansphaira: PairedRepositoryInput;
    readonly kaleidoSphere: PairedRepositoryInput;
  };
  readonly claimBoundary: {
    readonly testedPairOnly: true;
    readonly unknownPairsDenied: true;
    readonly productionOrCustomerEffect: false;
    readonly externalCallRequired: false;
    readonly compatibilityClaimOnDeniedPair: false;
  };
};
const cleanRoom = JSON.parse(readFileSync(
  "tests/fixtures/external-bi-service-v2-clean-room.json", "utf8",
)) as CleanRoomFixture;
const pairedEvidenceFixture = JSON.parse(readFileSync(
  "verification/external-bi-service-paired-compatibility-v1.json", "utf8",
)) as unknown;
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

type PairedDenialReason =
  | "PAIRED_COMPATIBILITY_INPUT_MALFORMED_DENIED"
  | "PAIRED_COMPATIBILITY_RELEASE_HEAD_DENIED"
  | "PAIRED_COMPATIBILITY_ISSUE_CLOSURE_DENIED"
  | "PAIRED_COMPATIBILITY_EVIDENCE_MISSING_DENIED"
  | "PAIRED_COMPATIBILITY_CAPABILITY_MISSING_DENIED"
  | "PAIRED_COMPATIBILITY_OWNER_INPUT_DENIED"
  | "PAIRED_COMPATIBILITY_UNKNOWN_PAIR_DENIED"
  | "PAIRED_COMPATIBILITY_RECORD_DIGEST_DENIED"
  | "PAIRED_COMPATIBILITY_OWNER_RECORD_DENIED";

const OWNER_PAIRED_INPUT_DIGEST = "sha256:12d84b4c22b26675020fe6234d5c0ee079632ef974c0fc01164fd0048675739a";
const OWNER_PAIR_QUERY = Object.freeze({
  pansphairaHead: "24db4e926385b006c9f2fbca3588adece72e7fb0",
  kaleidoSphereHead: "90c574e9a06cb752be06270395d44a31eabc44ae",
});
const PAIRED_ADVERSARIAL_EXPECTATIONS = Object.freeze([
  { caseId: "STALE_RELEASE_HEAD", expectedReasonCode: "PAIRED_COMPATIBILITY_RELEASE_HEAD_DENIED" },
  { caseId: "SUBSTITUTED_RELEASE_HEAD", expectedReasonCode: "PAIRED_COMPATIBILITY_RELEASE_HEAD_DENIED" },
  { caseId: "PAIRED_PROFILE_SUBSTITUTION", expectedReasonCode: "PAIRED_COMPATIBILITY_OWNER_INPUT_DENIED" },
  { caseId: "FULLY_REDIGESTED_FORGERY", expectedReasonCode: "PAIRED_COMPATIBILITY_OWNER_INPUT_DENIED" },
  { caseId: "PARTIALLY_REDIGESTED_FIXTURE", expectedReasonCode: "PAIRED_COMPATIBILITY_OWNER_INPUT_DENIED" },
  { caseId: "MISSING_RECEIPT", expectedReasonCode: "PAIRED_COMPATIBILITY_EVIDENCE_MISSING_DENIED" },
  { caseId: "MISSING_FIXTURE", expectedReasonCode: "PAIRED_COMPATIBILITY_EVIDENCE_MISSING_DENIED" },
  { caseId: "MISSING_CAPABILITY", expectedReasonCode: "PAIRED_COMPATIBILITY_CAPABILITY_MISSING_DENIED" },
  { caseId: "UNKNOWN_PAIR", expectedReasonCode: "PAIRED_COMPATIBILITY_UNKNOWN_PAIR_DENIED" },
  { caseId: "PROXY_INPUT", expectedReasonCode: "PAIRED_COMPATIBILITY_INPUT_MALFORMED_DENIED" },
  { caseId: "ACCESSOR_INPUT", expectedReasonCode: "PAIRED_COMPATIBILITY_INPUT_MALFORMED_DENIED" },
  { caseId: "HIDDEN_INPUT", expectedReasonCode: "PAIRED_COMPATIBILITY_INPUT_MALFORMED_DENIED" },
  { caseId: "SYMBOL_INPUT", expectedReasonCode: "PAIRED_COMPATIBILITY_INPUT_MALFORMED_DENIED" },
  { caseId: "POST_VALIDATION_MUTATION", expectedReasonCode: "PAIRED_COMPATIBILITY_OWNER_INPUT_DENIED" },
] as const);

function pairedSnapshot<T>(value: T, ancestors = new Set<object>()): T {
  if (value === null || typeof value === "string" || typeof value === "boolean") return value;
  if (typeof value === "number") {
    if (!Number.isFinite(value) || Object.is(value, -0)
      || (Number.isInteger(value) && !Number.isSafeInteger(value))) throw new TypeError("UNSAFE_NUMBER");
    return value;
  }
  if (typeof value !== "object" || nodeTypes.isProxy(value)) throw new TypeError("ALIEN_INPUT");
  if (ancestors.has(value)) throw new TypeError("CYCLIC_INPUT");
  const next = new Set(ancestors).add(value);
  if (Array.isArray(value)) {
    if (Object.getPrototypeOf(value) !== Array.prototype) throw new TypeError("ALIEN_ARRAY");
    const keys = Reflect.ownKeys(value);
    const expected = [...Array.from({ length: value.length }, (_, index) => String(index)), "length"];
    if (keys.length !== expected.length || expected.some((key) => !keys.includes(key))) {
      throw new TypeError("SPARSE_OR_HIDDEN_ARRAY");
    }
    return Array.from({ length: value.length }, (_, index) => {
      const descriptor = Object.getOwnPropertyDescriptor(value, String(index));
      if (descriptor === undefined || !("value" in descriptor) || descriptor.enumerable !== true) {
        throw new TypeError("ACCESSOR_ARRAY");
      }
      return pairedSnapshot(descriptor.value, next);
    }) as T;
  }
  if (Object.getPrototypeOf(value) !== Object.prototype) throw new TypeError("ALIEN_OBJECT");
  const output: Record<string, unknown> = {};
  for (const key of Reflect.ownKeys(value)) {
    if (typeof key !== "string") throw new TypeError("SYMBOL_KEY");
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (descriptor === undefined || !("value" in descriptor) || descriptor.enumerable !== true) {
      throw new TypeError("ACCESSOR_OR_HIDDEN_KEY");
    }
    Object.defineProperty(output, key, {
      value: pairedSnapshot(descriptor.value, next), enumerable: true, writable: true, configurable: true,
    });
  }
  return output as T;
}

function pairedDeepFreeze<T>(value: T): T {
  if (value !== null && typeof value === "object" && !Object.isFrozen(value)) {
    for (const key of Reflect.ownKeys(value)) {
      if (key !== "length") pairedDeepFreeze((value as Record<PropertyKey, unknown>)[key]);
    }
    Object.freeze(value);
  }
  return value;
}

function pairedDenied(reasonCode: PairedDenialReason) {
  return pairedDeepFreeze({
    outcome: "DENIED" as const,
    reasonCodes: [reasonCode] as const,
    compatibilityClaim: false as const,
  });
}

function validByteIdentities(value: unknown): value is PairedByteIdentity[] {
  return Array.isArray(value) && value.length > 0 && value.every((item) => {
    if (item === null || typeof item !== "object" || Array.isArray(item)) return false;
    const record = item as Record<string, unknown>;
    return Array.isArray(record.roles) && record.roles.length > 0
      && record.roles.every((role) => typeof role === "string")
      && typeof record.path === "string" && record.path.length > 0
      && typeof record.gitBlob === "string" && /^[a-f0-9]{40}$/.test(record.gitBlob)
      && typeof record.sha256 === "string" && /^[a-f0-9]{64}$/.test(record.sha256);
  });
}

function hasByteRole(identities: readonly PairedByteIdentity[], role: string): boolean {
  return identities.some((identity) => identity.roles.includes(role));
}

function profileHasRequiredCapabilities(value: unknown): value is PairedProfile {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return false;
  const capabilities = (value as { capabilities?: unknown }).capabilities;
  if (!Array.isArray(capabilities)) return false;
  const ids = capabilities.map((capability) => capability !== null && typeof capability === "object"
    ? (capability as { id?: unknown }).id
    : null);
  return ids.length === cleanRoom.requiredCapabilities.length
    && cleanRoom.requiredCapabilities.every((id, index) => ids[index] === id);
}

function pairedProfileTuple(repository: PairedRepositoryInput) {
  return {
    product: repository.profile.product,
    contract: repository.profile.contract,
    capabilities: repository.profile.capabilities,
  };
}

function selectedBytes(repository: PairedRepositoryInput, role: string) {
  return repository.byteIdentities
    .filter((identity) => identity.roles.includes(role))
    .map(({ roles, path, gitBlob, sha256: byteSha256 }) => ({ roles, path, gitBlob, sha256: byteSha256 }));
}

function pairedRepositoryBinding(repository: PairedRepositoryInput) {
  return {
    repository: repository.repository,
    issueClosure: {
      number: repository.issueClosure.number,
      state: repository.issueClosure.state,
      stateReason: repository.issueClosure.stateReason,
      closedAt: repository.issueClosure.closedAt,
      bodySha256: repository.issueClosure.bodySha256,
      ownerCommentId: repository.issueClosure.ownerComment.id,
      ownerCommentBodySha256: repository.issueClosure.ownerComment.bodySha256,
      deliveredHead: repository.release.head,
    },
    release: {
      releaseId: repository.release.releaseId,
      tag: repository.release.tag,
      head: repository.release.head,
      tree: repository.release.tree,
      publishedAt: repository.release.publishedAt,
      prerelease: repository.release.prerelease,
    },
    profileDigest: sha256(pairedProfileTuple(repository)),
    byteSetDigest: sha256(repository.byteIdentities),
    releaseManifestBytes: selectedBytes(repository, "release-manifest"),
    fixtureBytes: selectedBytes(repository, "fixture"),
    receiptBytes: selectedBytes(repository, "receipt"),
    contractBytes: selectedBytes(repository, "contract"),
    capabilityBytes: selectedBytes(repository, "capability"),
  };
}

function evaluatePairedCompatibility(
  value: unknown,
  pairQuery: unknown = OWNER_PAIR_QUERY,
) {
  let input: PairedCompatibilityInput;
  try {
    input = pairedSnapshot(value) as PairedCompatibilityInput;
  } catch {
    return pairedDenied("PAIRED_COMPATIBILITY_INPUT_MALFORMED_DENIED");
  }

  let pansphaira: PairedRepositoryInput;
  let kaleidoSphere: PairedRepositoryInput;
  try {
    pansphaira = input.repositories.pansphaira;
    kaleidoSphere = input.repositories.kaleidoSphere;
    if (!validByteIdentities(pansphaira.byteIdentities)
      || !validByteIdentities(kaleidoSphere.byteIdentities)) {
      return pairedDenied("PAIRED_COMPATIBILITY_INPUT_MALFORMED_DENIED");
    }
    if (pansphaira.release.head !== OWNER_PAIR_QUERY.pansphairaHead
      || kaleidoSphere.release.head !== OWNER_PAIR_QUERY.kaleidoSphereHead) {
      return pairedDenied("PAIRED_COMPATIBILITY_RELEASE_HEAD_DENIED");
    }
    for (const repository of [pansphaira, kaleidoSphere]) {
      if (!hasByteRole(repository.byteIdentities, "release-manifest")
        || !hasByteRole(repository.byteIdentities, "fixture")
        || !hasByteRole(repository.byteIdentities, "receipt")
        || !hasByteRole(repository.byteIdentities, "contract")) {
        return pairedDenied("PAIRED_COMPATIBILITY_EVIDENCE_MISSING_DENIED");
      }
      if (!hasByteRole(repository.byteIdentities, "capability")
        || !profileHasRequiredCapabilities(repository.profile)) {
        return pairedDenied("PAIRED_COMPATIBILITY_CAPABILITY_MISSING_DENIED");
      }
      if (repository.issueClosure.state !== "closed"
        || repository.issueClosure.stateReason !== "completed"
        || repository.issueClosure.ownerComment.authorAssociation !== "OWNER"
        || repository.issueClosure.ownerComment.body !== `Delivered and publicly verified at ${repository.release.head}`) {
        return pairedDenied("PAIRED_COMPATIBILITY_ISSUE_CLOSURE_DENIED");
      }
    }
  } catch {
    return pairedDenied("PAIRED_COMPATIBILITY_INPUT_MALFORMED_DENIED");
  }

  if (sha256(input) !== OWNER_PAIRED_INPUT_DIGEST) {
    return pairedDenied("PAIRED_COMPATIBILITY_OWNER_INPUT_DENIED");
  }

  let query: typeof OWNER_PAIR_QUERY;
  try {
    query = pairedSnapshot(pairQuery) as typeof OWNER_PAIR_QUERY;
    if (query === null || typeof query !== "object"
      || Object.keys(query).sort().join(",") !== "kaleidoSphereHead,pansphairaHead"
      || query.pansphairaHead !== OWNER_PAIR_QUERY.pansphairaHead
      || query.kaleidoSphereHead !== OWNER_PAIR_QUERY.kaleidoSphereHead) {
      return pairedDenied("PAIRED_COMPATIBILITY_UNKNOWN_PAIR_DENIED");
    }
  } catch {
    return pairedDenied("PAIRED_COMPATIBILITY_INPUT_MALFORMED_DENIED");
  }

  const pansphairaTuple = pairedProfileTuple(pansphaira);
  const kaleidoSphereTuple = pairedProfileTuple(kaleidoSphere);
  const pansphairaProfileDigest = sha256(pansphairaTuple);
  const kaleidoSphereProfileDigest = sha256(kaleidoSphereTuple);
  const productMatched = canonicalJson(pansphairaTuple.product) === canonicalJson(kaleidoSphereTuple.product);
  const contractMatched = canonicalJson(pansphairaTuple.contract) === canonicalJson(kaleidoSphereTuple.contract);
  const capabilitiesMatched = canonicalJson(pansphairaTuple.capabilities) === canonicalJson(kaleidoSphereTuple.capabilities);
  const reasonCodes = [
    ...(!productMatched ? ["PAIRED_COMPATIBILITY_PRODUCT_VERSION_MISMATCH_DENIED"] : []),
    ...(!contractMatched ? ["PAIRED_COMPATIBILITY_CONTRACT_MISMATCH_DENIED"] : []),
    ...(!capabilitiesMatched ? ["PAIRED_COMPATIBILITY_CAPABILITY_MISMATCH_DENIED"] : []),
  ];
  const pairBody = {
    pansphairaHead: query.pansphairaHead,
    kaleidoSphereHead: query.kaleidoSphereHead,
    pansphairaProfileDigest,
    kaleidoSphereProfileDigest,
  };
  const pairId = `pair:${sha256(pairBody).slice("sha256:".length)}`;
  const compatibilityOutcome = reasonCodes.length === 0 ? "ACCEPTED" as const : "DENIED" as const;
  const body = {
    schemaVersion: "pansphaira.external-bi-service/paired-compatibility-evidence/v1",
    evidenceId: input.evidenceId,
    taskId: "PORTFOLIO-PS337-PAIRED-CLEAN-ROOM",
    status: "PASS" as const,
    sourceClass: input.sourceClass,
    sourceInputDigest: OWNER_PAIRED_INPUT_DIGEST,
    repositoryBindings: [
      pairedRepositoryBinding(pansphaira),
      pairedRepositoryBinding(kaleidoSphere),
    ],
    profileAdmissionCases: [
      {
        caseId: "PS336_RELEASED_OWNER_PROFILE",
        repository: pansphaira.repository,
        releaseHead: pansphaira.release.head,
        profileDigest: pansphairaProfileDigest,
        outcome: "ACCEPTED" as const,
        scope: "OWNER_PROFILE_ONLY_NOT_CROSS_REPOSITORY_COMPATIBILITY",
        compatibilityClaim: false as const,
      },
      {
        caseId: "KS141_RELEASED_RUNTIME_PROFILE",
        repository: kaleidoSphere.repository,
        releaseHead: kaleidoSphere.release.head,
        profileDigest: kaleidoSphereProfileDigest,
        outcome: "ACCEPTED" as const,
        scope: "OWNER_PROFILE_ONLY_NOT_CROSS_REPOSITORY_COMPATIBILITY",
        compatibilityClaim: false as const,
      },
    ],
    compatibilityCases: [{
      caseId: "PS336_KS141_EXACT_RELEASED_HEADS",
      pairId,
      consumer: {
        repository: pansphaira.repository,
        releaseHead: pansphaira.release.head,
        profileDigest: pansphairaProfileDigest,
      },
      provider: {
        repository: kaleidoSphere.repository,
        releaseHead: kaleidoSphere.release.head,
        profileDigest: kaleidoSphereProfileDigest,
      },
      product: {
        consumerId: pansphaira.profile.product.id,
        consumerVersion: pansphaira.profile.product.version,
        providerId: kaleidoSphere.profile.product.id,
        providerVersion: kaleidoSphere.profile.product.version,
        matched: productMatched,
        outcome: productMatched ? "ACCEPTED" as const : "DENIED" as const,
      },
      contract: {
        consumerId: pansphaira.profile.contract.id,
        consumerVersion: pansphaira.profile.contract.version,
        providerId: kaleidoSphere.profile.contract.id,
        providerVersion: kaleidoSphere.profile.contract.version,
        matched: contractMatched,
        outcome: contractMatched ? "ACCEPTED" as const : "DENIED" as const,
      },
      capabilities: {
        consumer: pansphaira.profile.capabilities.map(({ id }) => id),
        provider: kaleidoSphere.profile.capabilities.map(({ id }) => id),
        matched: capabilitiesMatched,
        outcome: capabilitiesMatched ? "ACCEPTED" as const : "DENIED" as const,
      },
      outcome: compatibilityOutcome,
      reasonCodes,
      compatibilityClaim: compatibilityOutcome === "ACCEPTED",
    }],
    unknownPairPolicy: {
      outcome: "DENIED" as const,
      reasonCodes: ["PAIRED_COMPATIBILITY_UNKNOWN_PAIR_DENIED"] as const,
      wildcardOrRangeAccepted: false as const,
      compatibilityClaim: false as const,
    },
    claimBoundary: {
      testedCrossRepositoryPairCount: 1,
      acceptedOwnerProfileCount: 2,
      compatibleCrossRepositoryPairCount: compatibilityOutcome === "ACCEPTED" ? 1 : 0,
      deniedCrossRepositoryPairCount: compatibilityOutcome === "DENIED" ? 1 : 0,
      exactTestedPairOnly: input.claimBoundary.testedPairOnly,
      unknownPairsDenied: input.claimBoundary.unknownPairsDenied,
      productionOrCustomerEffect: input.claimBoundary.productionOrCustomerEffect,
      externalCallRequired: input.claimBoundary.externalCallRequired,
      externalEffectPerformed: false as const,
      compatibilityClaimOnDeniedPair: input.claimBoundary.compatibilityClaimOnDeniedPair,
    },
    adversarialCaseExpectations: PAIRED_ADVERSARIAL_EXPECTATIONS.map((item) => ({ ...item })),
    reviewPolicy: {
      requiredIndependentIntegratedIssueReviewCount: 1,
      completedByThisLocalWorker: 0,
      status: "READY_FOR_ONE_INDEPENDENT_INTEGRATED_ISSUE_REVIEW",
      finalFixForwardOwner: "SOL",
      publicClosureAndQueueDone: "FINAL_SOL_OWNER_ONLY_NOT_PERFORMED_BY_LOCAL_WORKER",
    },
    preservedDecisions: ["D-001", "D-002", "D-003", "D-004", "D-005", "D-006", "D-007"],
    nonClaims: [
      "NO_PS336_KS141_CROSS_REPOSITORY_COMPATIBILITY_CLAIM_BECAUSE_PRODUCT_VERSIONS_DIFFER",
      "NO_SUBSTITUTION_OF_AN_OLDER_KALEIDOSPHERE_V0_8_0_RELEASE_FOR_THE_EXACT_ISSUE_141_HEAD",
      "OWNER_PROFILE_ADMISSION_IS_NOT_A_CROSS_REPOSITORY_COMPATIBILITY_CLAIM",
      "NO_UNKNOWN_WILDCARD_RANGE_STALE_SUBSTITUTED_OR_UNTESTED_PAIR_CLAIM",
      "NO_PRODUCTION_CUSTOMER_EXTERNAL_MUTATION_PUBLICATION_OR_AUTHORITY_EFFECT",
      "NO_ISSUE_337_PUBLIC_CLOSURE_OR_QUEUE_DONE_CLAIM",
    ],
  };
  return pairedDeepFreeze({ ...body, evidenceDigest: sha256(body) });
}

function verifyPairedEvidenceRecord(value: unknown) {
  let candidate: Record<string, unknown>;
  try {
    candidate = pairedSnapshot(value) as Record<string, unknown>;
  } catch {
    return pairedDenied("PAIRED_COMPATIBILITY_INPUT_MALFORMED_DENIED");
  }
  if (candidate === null || typeof candidate !== "object" || Array.isArray(candidate)
    || typeof candidate.evidenceDigest !== "string") {
    return pairedDenied("PAIRED_COMPATIBILITY_RECORD_DIGEST_DENIED");
  }
  const body = Object.fromEntries(Object.entries(candidate).filter(([key]) => key !== "evidenceDigest"));
  if (candidate.evidenceDigest !== sha256(body)) {
    return pairedDenied("PAIRED_COMPATIBILITY_RECORD_DIGEST_DENIED");
  }
  const expected = evaluatePairedCompatibility(cleanRoom.pairedCompatibility);
  if (!("status" in expected) || canonicalJson(candidate) !== canonicalJson(expected)) {
    return pairedDenied("PAIRED_COMPATIBILITY_OWNER_RECORD_DENIED");
  }
  return pairedDeepFreeze({
    outcome: "VERIFIED" as const,
    evidenceDigest: candidate.evidenceDigest,
    testedPairOutcome: expected.compatibilityCases[0]!.outcome,
    compatibilityClaim: false as const,
  });
}

test("FND-XR-01 exact #336/#141 released inputs recompute one deterministic bounded evidence record", () => {
  const paired = cleanRoom.pairedCompatibility;
  assert.equal(sha256(paired), OWNER_PAIRED_INPUT_DIGEST);
  assert.deepEqual(paired.repositories.pansphaira.profile.product, cleanRoom.authorityProfile.product);
  assert.deepEqual(paired.repositories.pansphaira.profile.contract, cleanRoom.authorityProfile.contract);
  assert.deepEqual(paired.repositories.pansphaira.profile.capabilities, cleanRoom.authorityProfile.capabilities);
  assert.deepEqual(paired.repositories.pansphaira.profile.capabilities.map(({ id }) => id), cleanRoom.requiredCapabilities);
  assert.deepEqual(paired.repositories.kaleidoSphere.profile.capabilities.map(({ id }) => id), cleanRoom.requiredCapabilities);

  const first = evaluatePairedCompatibility(paired);
  const second = evaluatePairedCompatibility(structuredClone(paired));
  assert.deepEqual(first, second);
  assert.deepEqual(first, pairedEvidenceFixture);
  if (!("status" in first)) throw new Error(`exact paired inputs denied: ${first.reasonCodes.join(",")}`);
  assert.equal(first.status, "PASS");
  assert.deepEqual(first.profileAdmissionCases.map(({ outcome }) => outcome), ["ACCEPTED", "ACCEPTED"]);
  assert.equal(first.compatibilityCases[0]!.outcome, "DENIED");
  assert.deepEqual(first.compatibilityCases[0]!.reasonCodes, ["PAIRED_COMPATIBILITY_PRODUCT_VERSION_MISMATCH_DENIED"]);
  assert.equal(first.compatibilityCases[0]!.product.matched, false);
  assert.equal(first.compatibilityCases[0]!.product.outcome, "DENIED");
  assert.equal(first.compatibilityCases[0]!.contract.matched, true);
  assert.equal(first.compatibilityCases[0]!.contract.outcome, "ACCEPTED");
  assert.equal(first.compatibilityCases[0]!.capabilities.matched, true);
  assert.equal(first.compatibilityCases[0]!.capabilities.outcome, "ACCEPTED");
  assert.equal(first.compatibilityCases[0]!.compatibilityClaim, false);
  assert.deepEqual(verifyPairedEvidenceRecord(pairedEvidenceFixture), {
    outcome: "VERIFIED",
    evidenceDigest: first.evidenceDigest,
    testedPairOutcome: "DENIED",
    compatibilityClaim: false,
  });
});

test("FND-XR-01 both public releases, issue closures, fixtures, contracts, capabilities and receipts are byte-bound", () => {
  const repositories = cleanRoom.pairedCompatibility.repositories;
  for (const repository of [repositories.pansphaira, repositories.kaleidoSphere]) {
    assert.equal(repository.issueClosure.state, "closed");
    assert.equal(repository.issueClosure.stateReason, "completed");
    assert.equal(repository.issueClosure.ownerComment.body, `Delivered and publicly verified at ${repository.release.head}`);
    assert.equal(createHash("sha256").update(repository.issueClosure.ownerComment.body).digest("hex"),
      repository.issueClosure.ownerComment.bodySha256);
    for (const role of ["release-manifest", "fixture", "receipt", "contract", "capability"]) {
      assert.equal(hasByteRole(repository.byteIdentities, role), true, `${repository.repository}:${role}`);
    }
    assert(repository.byteIdentities.every(({ gitBlob, sha256: byteSha256 }) =>
      /^[a-f0-9]{40}$/.test(gitBlob) && /^[a-f0-9]{64}$/.test(byteSha256)));
  }
  assert.equal(repositories.pansphaira.release.tag, "2026_09_02_v1");
  assert.equal(repositories.pansphaira.release.head, OWNER_PAIR_QUERY.pansphairaHead);
  assert.equal(repositories.kaleidoSphere.release.tag, "2026_09_01_v1");
  assert.equal(repositories.kaleidoSphere.release.head, OWNER_PAIR_QUERY.kaleidoSphereHead);
  assert.equal(repositories.pansphaira.profile.product.version, "v0.8.0");
  assert.equal(repositories.kaleidoSphere.profile.product.version, "v0.18.1");
  assert(repositories.kaleidoSphere.profile.partialCapabilities?.every(({ externalIntent }) => externalIntent === false));
  assert(repositories.kaleidoSphere.profile.unsupported?.every(({ accepted }) => accepted === false));

  const closureReceipt = repositories.pansphaira.byteIdentities.find(({ roles }) => roles.includes("issue-delivery-receipt"));
  assert.ok(closureReceipt);
  assert.equal(createHash("sha256").update(readFileSync(closureReceipt.path)).digest("hex"), closureReceipt.sha256);
  const releaseManifest = readFileSync("SHA256SUMS", "utf8");
  const releasedFixture = repositories.pansphaira.byteIdentities.find(({ roles }) => roles.includes("fixture"));
  assert.ok(releasedFixture);
  const currentFixtureSha256 = createHash("sha256").update(readFileSync(releasedFixture.path)).digest("hex");
  assert.notEqual(currentFixtureSha256, releasedFixture.sha256, "released fixture identity remains historical");
  assert.match(releaseManifest, new RegExp(`^${currentFixtureSha256}  \\./${releasedFixture.path}$`, "m"));
  assert.doesNotMatch(releaseManifest, new RegExp(`^${releasedFixture.sha256}  \\./${releasedFixture.path}$`, "m"),
    "current root ledger must not publish the stale released-fixture digest");
});

test("FND-XR-01 stale, substituted, paired and fully or partially re-digested inputs fail closed", () => {
  type MutablePair = Record<string, any>;
  const exact = (): MutablePair => structuredClone(cleanRoom.pairedCompatibility) as MutablePair;
  const cases: readonly [string, (value: MutablePair) => void, PairedDenialReason][] = [
    ["stale head", (value) => { value.repositories.pansphaira.release.head = "39e5187b38e08946ea60196f32aaaea072af6544"; }, "PAIRED_COMPATIBILITY_RELEASE_HEAD_DENIED"],
    ["substituted head", (value) => { value.repositories.kaleidoSphere.release.head = "06631e2cebce56f50f37e15610de3cd73b84a6a6"; }, "PAIRED_COMPATIBILITY_RELEASE_HEAD_DENIED"],
    ["paired profile substitution", (value) => {
      const left = value.repositories.pansphaira.profile;
      value.repositories.pansphaira.profile = value.repositories.kaleidoSphere.profile;
      value.repositories.kaleidoSphere.profile = left;
    }, "PAIRED_COMPATIBILITY_OWNER_INPUT_DENIED"],
    ["fully re-digested forgery", (value) => {
      value.repositories.pansphaira.profile.product.version = "v9.9.9";
      value.repositories.kaleidoSphere.profile.product.version = "v9.9.9";
      for (const repository of Object.values(value.repositories) as MutablePair[]) {
        for (const identity of repository.byteIdentities) {
          identity.sha256 = sha256({ forgedPath: identity.path }).slice("sha256:".length);
        }
      }
    }, "PAIRED_COMPATIBILITY_OWNER_INPUT_DENIED"],
    ["partially re-digested fixture", (value) => {
      const fixture = value.repositories.kaleidoSphere.byteIdentities.find((identity: MutablePair) => identity.roles.includes("fixture"));
      fixture.sha256 = sha256({ substituted: fixture.path }).slice("sha256:".length);
    }, "PAIRED_COMPATIBILITY_OWNER_INPUT_DENIED"],
  ];
  for (const [name, mutate, expected] of cases) {
    const value = exact();
    mutate(value);
    assert.deepEqual(evaluatePairedCompatibility(value), pairedDenied(expected), name);
  }
});

test("FND-XR-01 missing receipt, fixture or capability and every unknown pair remain denied", () => {
  type MutablePair = Record<string, any>;
  const missingReceipt = structuredClone(cleanRoom.pairedCompatibility) as unknown as MutablePair;
  missingReceipt.repositories.pansphaira.byteIdentities = missingReceipt.repositories.pansphaira.byteIdentities
    .filter((identity: MutablePair) => !identity.roles.includes("receipt"));
  assert.deepEqual(evaluatePairedCompatibility(missingReceipt), pairedDenied("PAIRED_COMPATIBILITY_EVIDENCE_MISSING_DENIED"));

  const missingFixture = structuredClone(cleanRoom.pairedCompatibility) as unknown as MutablePair;
  missingFixture.repositories.kaleidoSphere.byteIdentities = missingFixture.repositories.kaleidoSphere.byteIdentities
    .filter((identity: MutablePair) => !identity.roles.includes("fixture"));
  assert.deepEqual(evaluatePairedCompatibility(missingFixture), pairedDenied("PAIRED_COMPATIBILITY_EVIDENCE_MISSING_DENIED"));

  const missingCapability = structuredClone(cleanRoom.pairedCompatibility) as unknown as MutablePair;
  missingCapability.repositories.kaleidoSphere.profile.capabilities.pop();
  assert.deepEqual(evaluatePairedCompatibility(missingCapability), pairedDenied("PAIRED_COMPATIBILITY_CAPABILITY_MISSING_DENIED"));

  for (const query of [
    { ...OWNER_PAIR_QUERY, kaleidoSphereHead: "06631e2cebce56f50f37e15610de3cd73b84a6a6" },
    { ...OWNER_PAIR_QUERY, pansphairaHead: "latest" },
    { pansphairaHead: OWNER_PAIR_QUERY.pansphairaHead, kaleidoSphereHead: OWNER_PAIR_QUERY.kaleidoSphereHead, wildcard: "*" },
  ]) {
    assert.deepEqual(evaluatePairedCompatibility(cleanRoom.pairedCompatibility, query),
      pairedDenied("PAIRED_COMPATIBILITY_UNKNOWN_PAIR_DENIED"));
  }
});

test("FND-XR-01 Proxy, accessor, hidden and symbol inputs deny without invoking attacker code", () => {
  for (const trap of ["getPrototypeOf", "ownKeys", "getOwnPropertyDescriptor", "get"] as const) {
    let calls = 0;
    const input = new Proxy(structuredClone(cleanRoom.pairedCompatibility), {
      [trap]: () => { calls += 1; throw new Error("attacker trap"); },
    });
    assert.deepEqual(evaluatePairedCompatibility(input), pairedDenied("PAIRED_COMPATIBILITY_INPUT_MALFORMED_DENIED"), trap);
    assert.equal(calls, 0, trap);
  }

  const accessor = structuredClone(cleanRoom.pairedCompatibility) as unknown as Record<string, any>;
  let getterCalls = 0;
  const head = accessor.repositories.kaleidoSphere.release.head;
  Object.defineProperty(accessor.repositories.kaleidoSphere.release, "head", {
    enumerable: true, configurable: true, get: () => { getterCalls += 1; return head; },
  });
  assert.deepEqual(evaluatePairedCompatibility(accessor), pairedDenied("PAIRED_COMPATIBILITY_INPUT_MALFORMED_DENIED"));
  assert.equal(getterCalls, 0);

  for (const surface of ["hidden", "symbol"] as const) {
    const input = structuredClone(cleanRoom.pairedCompatibility) as unknown as Record<PropertyKey, unknown>;
    const key: PropertyKey = surface === "hidden" ? "compatibilityClaim" : Symbol("compatibilityClaim");
    Object.defineProperty(input, key, { value: true, enumerable: surface === "symbol", configurable: true });
    assert.deepEqual(evaluatePairedCompatibility(input), pairedDenied("PAIRED_COMPATIBILITY_INPUT_MALFORMED_DENIED"), surface);
  }
});

test("FND-XR-01 post-validation mutation cannot change or widen the detached evidence record", () => {
  const input = structuredClone(cleanRoom.pairedCompatibility) as unknown as Record<string, any>;
  const result = evaluatePairedCompatibility(input);
  if (!("status" in result)) throw new Error("exact owner inputs must produce the clean-room record");
  const acceptedBytes = canonicalJson(result);
  input.repositories.pansphaira.release.head = "0".repeat(40);
  input.repositories.kaleidoSphere.profile.product.version = "v0.8.0";
  input.repositories.kaleidoSphere.profile.capabilities.pop();
  assert.equal(canonicalJson(result), acceptedBytes);
  assert.equal(result.compatibilityCases[0]!.outcome, "DENIED");
  assert.equal(result.compatibilityCases[0]!.compatibilityClaim, false);
  assert.throws(() => {
    (result.compatibilityCases[0] as { outcome: string }).outcome = "ACCEPTED";
  }, TypeError);
  assert.throws(() => {
    (result.repositoryBindings[0]!.receiptBytes as unknown as unknown[]).pop();
  }, TypeError);
  assert.deepEqual(evaluatePairedCompatibility(input), pairedDenied("PAIRED_COMPATIBILITY_RELEASE_HEAD_DENIED"));
});

test("FND-XR-01 a fully re-digested evidence forgery cannot manufacture a compatibility claim", () => {
  const forged = structuredClone(pairedEvidenceFixture) as Record<string, any>;
  forged.compatibilityCases[0].outcome = "ACCEPTED";
  forged.compatibilityCases[0].reasonCodes = [];
  forged.compatibilityCases[0].compatibilityClaim = true;
  forged.claimBoundary.compatibleCrossRepositoryPairCount = 1;
  forged.claimBoundary.deniedCrossRepositoryPairCount = 0;
  const { evidenceDigest: _ignored, ...forgedBody } = forged;
  forged.evidenceDigest = sha256(forgedBody);
  assert.deepEqual(verifyPairedEvidenceRecord(forged), pairedDenied("PAIRED_COMPATIBILITY_OWNER_RECORD_DENIED"));
  assert.equal(verifyPairedEvidenceRecord(forged).compatibilityClaim, false);
});
