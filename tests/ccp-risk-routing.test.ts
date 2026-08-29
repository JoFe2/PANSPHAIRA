import assert from "node:assert/strict";
import test from "node:test";

import {
  canonicalCcpRiskRouteJsonV1,
  ccpRiskRouteDigestV1,
  parseCcpRiskRouteV1,
  resolveCcpRiskRouteV1,
  CCP_COMPONENT_IDS_V1,
  CCP_RISK_CLASSES_V1,
  CCP_RISK_ROUTES_V1,
  CCP_RISK_ROUTE_SCHEMA_V1,
} from "../packages/contracts/src/ccp-risk-routing.js";

const STD_ROUTE_DIGEST = "1b489e7ca18f47b1b669e3b9978a9cc923e970b29ecdb540fbe766f4f19b5e23";
const MAL_ROUTE_DIGEST = "c73cdf24814cbac8557cd7489a9024e1a7a68c59133e34f42690e267ef4cb885";

test("CCP-PSAI52-RR-001 routing table is finite, closed and frozen", () => {
  assert.equal(Object.isFrozen(CCP_RISK_ROUTES_V1), true);
  assert.equal(CCP_COMPONENT_IDS_V1.length, 6);
  assert.equal(CCP_RISK_CLASSES_V1.length, 3);
  const entries = Object.entries(CCP_RISK_ROUTES_V1);
  assert.equal(entries.length, 18);
  for (const [key, route] of entries) {
    const [componentId, riskClass] = key.split(" ");
    assert.equal(route.componentId, componentId);
    assert.equal(route.riskClass, riskClass);
    assert.equal(route.schemaVersion, CCP_RISK_ROUTE_SCHEMA_V1);
    assert.equal(Object.isFrozen(route), true);
    assert.equal(route.mergeEligible, false);
    assert.equal(resolveCcpRiskRouteV1(route.componentId, route.riskClass), route);
  }
});

test("CCP-PSAI52-RR-002 resolving is deterministic and eligibility is bounded", () => {
  const standard = resolveCcpRiskRouteV1("component:contracts", "risk:standard");
  assert.deepEqual(standard, {
    schemaVersion: CCP_RISK_ROUTE_SCHEMA_V1,
    routeId: "route:contracts-standard",
    routeKind: "STANDARD_VERIFICATION",
    componentId: "component:contracts",
    riskClass: "risk:standard",
    queueEligible: true,
    runnerEligible: true,
    mergeEligible: false,
  });
  const elevated = resolveCcpRiskRouteV1("component:tests", "risk:elevated");
  assert.equal(elevated.routeId, "route:tests-elevated");
  assert.equal(elevated.routeKind, "ELEVATED_VERIFICATION");
  assert.equal(elevated.queueEligible, true);
  assert.equal(elevated.runnerEligible, false);
  assert.equal(elevated.mergeEligible, false);
  const malicious = resolveCcpRiskRouteV1("component:contracts", "risk:malicious");
  assert.equal(malicious.routeKind, "QUARANTINE_ONLY");
  assert.equal(malicious.queueEligible, false);
  assert.equal(malicious.runnerEligible, false);
  assert.equal(malicious.mergeEligible, false);

  assert.equal(Object.isFrozen(standard), true);
  assert.equal(resolveCcpRiskRouteV1("component:contracts", "risk:standard"), standard);
  assert.equal(
    canonicalCcpRiskRouteJsonV1(standard),
    canonicalCcpRiskRouteJsonV1(
      resolveCcpRiskRouteV1("component:contracts", "risk:standard"),
    ),
  );
});

test("CCP-PSAI52-RR-003 unknown components and risk classes deny fail-closed", () => {
  assert.throws(
    () => resolveCcpRiskRouteV1("component:unknown-part", "risk:standard"),
    /CCP_RISK_ROUTE_UNKNOWN_COMPONENT/,
  );
  assert.throws(
    () => resolveCcpRiskRouteV1("component:contracts", "risk:unknown-class"),
    /CCP_RISK_ROUTE_UNKNOWN_RISK_CLASS/,
  );
  assert.throws(
    () => resolveCcpRiskRouteV1(42, "risk:standard"),
    /CCP_RISK_ROUTE_UNKNOWN_COMPONENT/,
  );
  assert.throws(
    () => resolveCcpRiskRouteV1("Component:contracts", "risk:standard"),
    /CCP_RISK_ROUTE_UNKNOWN_COMPONENT/,
  );
  assert.throws(
    () => resolveCcpRiskRouteV1("component:contracts", null),
    /CCP_RISK_ROUTE_UNKNOWN_RISK_CLASS/,
  );
});

test("CCP-PSAI52-RR-004 route parsing is closed and drift denies", () => {
  const route = resolveCcpRiskRouteV1("component:contracts", "risk:standard");
  assert.equal(parseCcpRiskRouteV1(route), route);
  assert.equal(
    parseCcpRiskRouteV1(Object.fromEntries(Object.entries(route).reverse())),
    route,
  );

  const drifted = structuredClone(route) as unknown as Record<string, unknown>;
  drifted.routeId = "route:contracts-elevated";
  assert.throws(() => parseCcpRiskRouteV1(drifted), /CCP_RISK_ROUTE_SCHEMA_DENIED/);

  const widened = structuredClone(route) as unknown as Record<string, unknown>;
  widened.mergeEligible = true;
  assert.throws(() => parseCcpRiskRouteV1(widened), /CCP_RISK_ROUTE_SCHEMA_DENIED/);

  const foreign = structuredClone(route) as unknown as Record<string, unknown>;
  foreign.queueAllocated = true;
  assert.throws(() => parseCcpRiskRouteV1(foreign), /CCP_RISK_ROUTE_SCHEMA_DENIED/);

  assert.throws(() => parseCcpRiskRouteV1("route:contracts-standard"), /CCP_RISK_ROUTE_SCHEMA_DENIED/);
  assert.throws(() => parseCcpRiskRouteV1([route]), /CCP_RISK_ROUTE_SCHEMA_DENIED/);
});

test("CCP-PSAI52-RR-005 canonical route bytes and digest are deterministic", () => {
  const standard = resolveCcpRiskRouteV1("component:contracts", "risk:standard");
  const malicious = resolveCcpRiskRouteV1("component:contracts", "risk:malicious");
  assert.equal(ccpRiskRouteDigestV1(standard), STD_ROUTE_DIGEST);
  assert.equal(ccpRiskRouteDigestV1(malicious), MAL_ROUTE_DIGEST);

  const reshuffled = Object.fromEntries(Object.entries(standard).reverse());
  assert.equal(
    canonicalCcpRiskRouteJsonV1(standard),
    canonicalCcpRiskRouteJsonV1(reshuffled),
  );
  assert.equal(ccpRiskRouteDigestV1(reshuffled), STD_ROUTE_DIGEST);
});