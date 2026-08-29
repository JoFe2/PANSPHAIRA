import { canonicalJson } from "./canonical-json.js";

import {
  ccpDigestDomainV1,
  ccpStrictDenyV1,
  readCcpClosedObjectV1,
} from "./ccp-event-envelope.js";

/**
 * CCP PSAI52 bounded intake boundary (M1 admission, routing side): a pure,
 * finite, closed component/risk routing table. A static in-memory lookup of
 * (component kind, risk class) to a bounded routing outcome. It has no
 * network, persistence, clock, randomness, queue, runner, merge or code
 * execution capability: resolving a route never allocates a queue slot,
 * schedules a runner or authorizes a merge.
 *
 * The component and risk-class vocabularies are finite and closed. Any
 * unknown component, unknown risk class, unknown field or malformed route
 * denies fail-closed before any routing outcome exists.
 */

export const CCP_RISK_ROUTE_SCHEMA_V1 = "cm.ccp-risk-routing/v1" as const;

export const CCP_COMPONENT_IDS_V1 = Object.freeze([
  "component:contracts",
  "component:schemas",
  "component:tests",
  "component:docs",
  "component:release",
  "component:fixtures",
]);

export const CCP_RISK_CLASSES_V1 = Object.freeze([
  "risk:standard",
  "risk:elevated",
  "risk:malicious",
]);

export type CcpRouteKindV1 =
  | "STANDARD_VERIFICATION"
  | "ELEVATED_VERIFICATION"
  | "QUARANTINE_ONLY";

export const CCP_ROUTE_KINDS_V1 = Object.freeze([
  "STANDARD_VERIFICATION",
  "ELEVATED_VERIFICATION",
  "QUARANTINE_ONLY",
]);

export interface CcpRiskRouteV1 {
  readonly schemaVersion: typeof CCP_RISK_ROUTE_SCHEMA_V1;
  readonly routeId: string;
  readonly routeKind: CcpRouteKindV1;
  readonly componentId: string;
  readonly riskClass: string;
  /** Bounded eligibility flags; routing never allocates a queue or runner. */
  readonly queueEligible: boolean;
  readonly runnerEligible: boolean;
  /** Merge eligibility is never granted by routing; it is always false. */
  readonly mergeEligible: boolean;
}

const RISK_ROUTE_KEYS = Object.freeze([
  "schemaVersion", "routeId", "routeKind", "componentId", "riskClass",
  "queueEligible", "runnerEligible", "mergeEligible",
]);

const NAMESPACED_ID_SUFFIX = "[a-z0-9][a-z0-9._-]{2,95}";
const COMPONENT_ID_PATTERN = new RegExp(`^component:${NAMESPACED_ID_SUFFIX}$`);
const RISK_CLASS_PATTERN = new RegExp(`^risk:${NAMESPACED_ID_SUFFIX}$`);
const ROUTE_ID_PATTERN = new RegExp(`^route:${NAMESPACED_ID_SUFFIX}$`);

function routeIdFor(componentId: string, riskClass: string): string {
  const component = componentId.slice("component:".length);
  const risk = riskClass.slice("risk:".length);
  return `route:${component}-${risk}`;
}

function routeKindFor(riskClass: string): CcpRouteKindV1 {
  if (riskClass === "risk:standard") return "STANDARD_VERIFICATION";
  if (riskClass === "risk:elevated") return "ELEVATED_VERIFICATION";
  return "QUARANTINE_ONLY";
}

function eligibilityFor(riskClass: string): {
  queueEligible: boolean;
  runnerEligible: boolean;
  mergeEligible: boolean;
} {
  if (riskClass === "risk:standard") {
    return { queueEligible: true, runnerEligible: true, mergeEligible: false };
  }
  if (riskClass === "risk:elevated") {
    return { queueEligible: true, runnerEligible: false, mergeEligible: false };
  }
  return { queueEligible: false, runnerEligible: false, mergeEligible: false };
}

function makeRoute(componentId: string, riskClass: string): CcpRiskRouteV1 {
  const routeKind = routeKindFor(riskClass);
  const eligibility = eligibilityFor(riskClass);
  return Object.freeze({
    schemaVersion: CCP_RISK_ROUTE_SCHEMA_V1,
    routeId: routeIdFor(componentId, riskClass),
    routeKind,
    componentId,
    riskClass,
    ...eligibility,
  });
}

/**
 * Finite closed routing table: every (component, risk class) pair resolves
 * to exactly one frozen route. Built once at module load from the finite
 * vocabularies; resolving performs a closed lookup only, never an
 * allocation, and reads no clock or randomness.
 */
export const CCP_RISK_ROUTES_V1: Readonly<Record<string, CcpRiskRouteV1>> =
  Object.freeze(
    Object.fromEntries(
      CCP_COMPONENT_IDS_V1.flatMap((componentId) =>
        CCP_RISK_CLASSES_V1.map((riskClass) => [
          `${componentId} ${riskClass}`,
          makeRoute(componentId, riskClass),
        ]),
      ),
    ),
  );

/** Closed table key for a (component, risk class) pair. */
export function ccpRiskRouteKeyV1(componentId: string, riskClass: string): string {
  return `${componentId} ${riskClass}`;
}

/**
 * Resolve a closed (component, risk class) pair to its finite routing
 * outcome. Unknown or malformed inputs deny fail-closed; resolving never
 * allocates a queue slot, schedules a runner or authorizes a merge.
 */
export function resolveCcpRiskRouteV1(
  componentId: unknown,
  riskClass: unknown,
): CcpRiskRouteV1 {
  if (typeof componentId !== "string" || !COMPONENT_ID_PATTERN.test(componentId)
    || !(CCP_COMPONENT_IDS_V1 as readonly string[]).includes(componentId)) {
    ccpStrictDenyV1("CCP_RISK_ROUTE_UNKNOWN_COMPONENT");
  }
  if (typeof riskClass !== "string" || !RISK_CLASS_PATTERN.test(riskClass)
    || !(CCP_RISK_CLASSES_V1 as readonly string[]).includes(riskClass)) {
    ccpStrictDenyV1("CCP_RISK_ROUTE_UNKNOWN_RISK_CLASS");
  }
  const route = CCP_RISK_ROUTES_V1[ccpRiskRouteKeyV1(componentId, riskClass)];
  if (route === undefined) ccpStrictDenyV1("CCP_RISK_ROUTE_UNKNOWN_ROUTE");
  return route;
}

function normalizeRoute(value: unknown): CcpRiskRouteV1 {
  const record = readCcpClosedObjectV1(
    value,
    RISK_ROUTE_KEYS,
    new WeakSet(),
    "CCP_RISK_ROUTE_SCHEMA_DENIED",
  );
  if (record.schemaVersion !== CCP_RISK_ROUTE_SCHEMA_V1) ccpStrictDenyV1("CCP_RISK_ROUTE_SCHEMA_DENIED");
  const componentId = record.componentId;
  const riskClass = record.riskClass;
  if (typeof componentId !== "string" || !COMPONENT_ID_PATTERN.test(componentId)
    || !(CCP_COMPONENT_IDS_V1 as readonly string[]).includes(componentId)) {
    ccpStrictDenyV1("CCP_RISK_ROUTE_UNKNOWN_COMPONENT");
  }
  if (typeof riskClass !== "string" || !RISK_CLASS_PATTERN.test(riskClass)
    || !(CCP_RISK_CLASSES_V1 as readonly string[]).includes(riskClass)) {
    ccpStrictDenyV1("CCP_RISK_ROUTE_UNKNOWN_RISK_CLASS");
  }
  if (typeof record.routeKind !== "string"
    || !(CCP_ROUTE_KINDS_V1 as readonly string[]).includes(record.routeKind)) {
    ccpStrictDenyV1("CCP_RISK_ROUTE_SCHEMA_DENIED");
  }
  if (typeof record.routeId !== "string" || !ROUTE_ID_PATTERN.test(record.routeId)) {
    ccpStrictDenyV1("CCP_RISK_ROUTE_SCHEMA_DENIED");
  }
  if (typeof record.queueEligible !== "boolean"
    || typeof record.runnerEligible !== "boolean"
    || typeof record.mergeEligible !== "boolean") {
    ccpStrictDenyV1("CCP_RISK_ROUTE_SCHEMA_DENIED");
  }
  const expected = resolveCcpRiskRouteV1(componentId, riskClass);
  if (record.routeId !== expected.routeId
    || record.routeKind !== expected.routeKind
    || record.queueEligible !== expected.queueEligible
    || record.runnerEligible !== expected.runnerEligible
    || record.mergeEligible !== expected.mergeEligible) {
    ccpStrictDenyV1("CCP_RISK_ROUTE_SCHEMA_DENIED");
  }
  return expected;
}

/**
 * Parse and close a routing outcome. The returned route is the frozen table
 * entry; malformed input or a route whose fields drift from the finite
 * table denies with a TypeError carrying a closed denial code.
 */
export function parseCcpRiskRouteV1(value: unknown): CcpRiskRouteV1 {
  return normalizeRoute(value);
}

/** Canonical JSON of the closed route; byte order independent of input key order. */
export function canonicalCcpRiskRouteJsonV1(value: unknown): string {
  return canonicalJson(parseCcpRiskRouteV1(value));
}

/**
 * Content digest of the closed route. Routing outcomes carry no self-digest
 * field; this digest is a read-back integrity binding over the closed route
 * data only.
 */
export function ccpRiskRouteDigestV1(value: unknown): string {
  return ccpDigestDomainV1(CCP_RISK_ROUTE_SCHEMA_V1, parseCcpRiskRouteV1(value));
}