import { createHash } from "node:crypto";
import { canonicalJson } from "./canonical-json.js";

export const UPDATE_DOCTOR_BUNDLE_SCHEMA_V1 = "chimpmaera.update/doctor-contract-bundle/v1" as const;
export const UPDATE_LOCK_PROFILE_SCHEMA_V1 = "chimpmaera.update/lock-profile/v1" as const;
export const UPDATE_OPERATION_PLAN_SCHEMA_V1 = "chimpmaera.update/operation-plan/v1" as const;
export const UPDATE_OPERATION_RECEIPT_SCHEMA_V1 = "chimpmaera.update/operation-receipt/v1" as const;
export const DOCTOR_REPORT_SCHEMA_V1 = "chimpmaera.doctor/report/v1" as const;

export type UpdateDoctorReasonCodeV1 =
  | "UPDATE_CONTRACT_ACCEPTED"
  | "SCHEMA_DENIED"
  | "UNSUPPORTED_CONTRACT_VERSION_DENIED"
  | "MUTABLE_TARGET_DENIED"
  | "DIGEST_MISMATCH_DENIED"
  | "AUTHORITY_DELTA_DENIED"
  | "MUTATION_CLAIM_DENIED";

export type UpdateDoctorExitCodeV1 = 0 | 10 | 11 | 12 | 13 | 14 | 15;

export const UPDATE_DOCTOR_EXIT_CODES_V1: Readonly<Record<UpdateDoctorReasonCodeV1, UpdateDoctorExitCodeV1>> = {
  UPDATE_CONTRACT_ACCEPTED: 0,
  SCHEMA_DENIED: 10,
  UNSUPPORTED_CONTRACT_VERSION_DENIED: 11,
  MUTABLE_TARGET_DENIED: 12,
  DIGEST_MISMATCH_DENIED: 13,
  AUTHORITY_DELTA_DENIED: 14,
  MUTATION_CLAIM_DENIED: 15,
};

export interface UpdateComponentLockV1 {
  readonly componentId: string;
  readonly version: string;
  readonly digest: string;
}

export interface UpdateLockProfileV1 {
  readonly schemaVersion: typeof UPDATE_LOCK_PROFILE_SCHEMA_V1;
  readonly releaseId: string;
  readonly components: readonly UpdateComponentLockV1[];
  readonly versionAxes: {
    readonly controlPlane: string;
    readonly dataModel: string;
    readonly evidence: string;
  };
  readonly authorityProfile: {
    readonly profileId: string;
    readonly digest: string;
  };
  readonly lockDigest: string;
}

export interface UpdateOperationPlanV1 {
  readonly schemaVersion: typeof UPDATE_OPERATION_PLAN_SCHEMA_V1;
  readonly operationId: string;
  readonly mode: "CHECK_ONLY";
  readonly fromLockDigest: string;
  readonly targetLockDigest: string;
  readonly requiredAuthorityProfileDigest: string;
  readonly authorityDelta: {
    readonly added: readonly string[];
    readonly removed: readonly string[];
  };
  readonly issuedAtMs: number;
  readonly planDigest: string;
}

export interface DoctorReportV1 {
  readonly schemaVersion: typeof DOCTOR_REPORT_SCHEMA_V1;
  readonly reportId: string;
  readonly profile: "QUICK" | "STANDARD";
  readonly readOnly: true;
  readonly observedLockDigest: string;
  readonly checks: readonly {
    readonly checkId: string;
    readonly status: "PASS" | "FAIL" | "NOT_OBSERVED";
    readonly reasonCode: "OBSERVATION_MATCHED" | "OBSERVATION_MISMATCH" | "OBSERVATION_UNAVAILABLE";
  }[];
  readonly generatedAtMs: number;
  readonly reportDigest: string;
}

const DOCTOR_PUBLIC_REPORT_KEYS_V1 = Object.freeze([
  "schemaVersion",
  "reportId",
  "profile",
  "readOnly",
  "observedLockDigest",
  "checks",
  "generatedAtMs",
  "reportDigest",
] as const);

export interface UpdateOperationReceiptV1 {
  readonly schemaVersion: typeof UPDATE_OPERATION_RECEIPT_SCHEMA_V1;
  readonly operationId: string;
  readonly action: "VALIDATE_CONTRACTS";
  readonly outcome: "ACCEPTED";
  readonly reasonCodes: readonly ["UPDATE_CONTRACT_ACCEPTED"];
  readonly exitCode: 0;
  readonly planDigest: string;
  readonly beforeLockDigest: string;
  readonly afterLockDigest: string;
  readonly mutationObserved: false;
  readonly completedAtMs: number;
  readonly receiptDigest: string;
}

export interface UpdateDoctorContractBundleV1 {
  readonly schemaVersion: typeof UPDATE_DOCTOR_BUNDLE_SCHEMA_V1;
  readonly lockProfile: UpdateLockProfileV1;
  readonly operationPlan: UpdateOperationPlanV1;
  readonly doctorReport: DoctorReportV1;
  readonly operationReceipt: UpdateOperationReceiptV1;
}

export const DOCTOR_FIXTURE_OBSERVATION_SCHEMA_V1 = "chimpmaera.doctor/fixture-observation/v1" as const;
export const DOCTOR_COMPOSE_OBSERVATION_SCHEMA_V1 = "chimpmaera.doctor/compose-observation/v1" as const;

export type DoctorProbeIdV1 =
  | "cm:doctor-installation"
  | "cm:doctor-runtime"
  | "cm:doctor-configuration"
  | "cm:doctor-version-lock"
  | "cm:doctor-health-readback"
  | "cm:doctor-storage"
  | "cm:doctor-permissions"
  | "cm:doctor-secrets-metadata"
  | "cm:doctor-clock"
  | "cm:doctor-database-schema"
  | "cm:doctor-packs"
  | "cm:doctor-receipts";

export interface DoctorFixtureProbeV1 {
  readonly checkId: DoctorProbeIdV1;
  readonly outcome: "MATCH" | "MISMATCH" | "UNAVAILABLE";
  readonly durationMs: number;
  readonly privateObservation: unknown;
}

export interface DoctorFixtureObservationV1 {
  readonly schemaVersion: typeof DOCTOR_FIXTURE_OBSERVATION_SCHEMA_V1;
  readonly observedLockDigest: string;
  readonly mutationCount: 0;
  readonly probes: readonly DoctorFixtureProbeV1[];
}

export interface DoctorComposeServiceObservationV1 {
  readonly serviceId: string;
  readonly state: "RUNNING" | "STOPPED" | "UNAVAILABLE";
  readonly health: "HEALTHY" | "UNHEALTHY" | "NOT_AVAILABLE";
}

export interface DoctorComposeObservationV1 {
  readonly schemaVersion: typeof DOCTOR_COMPOSE_OBSERVATION_SCHEMA_V1;
  readonly source: "LOCAL_COMPOSE_SNAPSHOT";
  readonly readOnly: true;
  readonly mutationCount: 0;
  readonly observedLockDigest: string;
  readonly composeVersion: string | null;
  readonly expectedConfigDigest: string;
  readonly observedConfigDigest: string | null;
  readonly services: readonly DoctorComposeServiceObservationV1[];
}

export interface AdaptComposeDoctorObservationOptionsV1 {
  readonly requiredServiceIds: readonly string[];
  readonly snapshot: DoctorComposeObservationV1;
}

export interface RunFixtureDoctorOptionsV1 {
  readonly reportId: string;
  readonly profile: "QUICK" | "STANDARD";
  readonly expectedLockDigest: string;
  readonly generatedAtMs: number;
  readonly timeoutMs: number;
  readonly fixture: DoctorFixtureObservationV1;
}

export type UpdateDoctorVerificationResultV1 =
  | { readonly outcome: "ACCEPTED"; readonly reasonCodes: readonly ["UPDATE_CONTRACT_ACCEPTED"]; readonly exitCode: 0 }
  | { readonly outcome: "DENIED"; readonly reasonCodes: readonly UpdateDoctorReasonCodeV1[]; readonly exitCode: UpdateDoctorExitCodeV1 };

const DENIAL_ORDER: readonly UpdateDoctorReasonCodeV1[] = [
  "SCHEMA_DENIED",
  "UNSUPPORTED_CONTRACT_VERSION_DENIED",
  "MUTABLE_TARGET_DENIED",
  "DIGEST_MISMATCH_DENIED",
  "AUTHORITY_DELTA_DENIED",
  "MUTATION_CLAIM_DENIED",
];

const QUICK_DOCTOR_PROBES_V1: readonly DoctorProbeIdV1[] = Object.freeze([
  "cm:doctor-installation",
  "cm:doctor-runtime",
  "cm:doctor-configuration",
  "cm:doctor-version-lock",
  "cm:doctor-health-readback",
]);

const STANDARD_DOCTOR_PROBES_V1: readonly DoctorProbeIdV1[] = Object.freeze([
  ...QUICK_DOCTOR_PROBES_V1,
  "cm:doctor-storage",
  "cm:doctor-permissions",
  "cm:doctor-secrets-metadata",
  "cm:doctor-clock",
  "cm:doctor-database-schema",
  "cm:doctor-packs",
  "cm:doctor-receipts",
]);

const DOCTOR_PROBE_IDS_V1 = new Set<DoctorProbeIdV1>(STANDARD_DOCTOR_PROBES_V1);
const DOCTOR_REPORT_ID = /^cm:doctor-report-[a-z0-9][a-z0-9._-]{2,95}$/;
const DANGEROUS_KEYS = new Set(["__proto__", "prototype", "constructor"]);

function isPlainDataRecord(value: unknown): value is Record<string, unknown> {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) return false;
  for (const key of Reflect.ownKeys(value)) {
    if (typeof key !== "string" || DANGEROUS_KEYS.has(key)) return false;
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (descriptor === undefined || !("value" in descriptor) || descriptor.enumerable !== true) return false;
  }
  return true;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return isPlainDataRecord(value) && Object.getPrototypeOf(value) === Object.prototype;
}

function isDenseArray(value: unknown): value is unknown[] {
  if (!Array.isArray(value) || Object.getPrototypeOf(value) !== Array.prototype) return false;
  const keys = Reflect.ownKeys(value);
  const expected = [...Array.from({ length: value.length }, (_, index) => String(index)), "length"];
  return keys.length === expected.length
    && keys.every((key) => typeof key === "string")
    && expected.every((key) => keys.includes(key))
    && Array.from({ length: value.length }, (_, index) => String(index)).every((key) => {
      const descriptor = Object.getOwnPropertyDescriptor(value, key);
      return descriptor !== undefined && "value" in descriptor && descriptor.enumerable === true;
    });
}

function safeObject(entries: readonly (readonly [string, unknown])[]): Record<string, unknown> {
  const output = {} as Record<string, unknown>;
  for (const [key, value] of entries) {
    if (DANGEROUS_KEYS.has(key) || Object.prototype.hasOwnProperty.call(output, key)) {
      throw new TypeError("UNSAFE_JSON_OBJECT_KEY");
    }
    Object.defineProperty(output, key, { value, enumerable: true, writable: true, configurable: true });
  }
  return output;
}

function safeJsonClone<T>(value: T, ancestors = new Set<object>()): T {
  if (value === null || typeof value === "string" || typeof value === "boolean") return value;
  if (typeof value === "number") {
    if (!Number.isFinite(value) || (Number.isInteger(value) && !Number.isSafeInteger(value))) {
      throw new TypeError("UNSAFE_JSON_NUMBER");
    }
    return value;
  }
  if (Array.isArray(value)) {
    if (!isDenseArray(value) || ancestors.has(value)) throw new TypeError("UNSAFE_JSON_ARRAY");
    const next = new Set(ancestors).add(value);
    return value.map((item) => safeJsonClone(item, next)) as T;
  }
  if (!isPlainDataRecord(value) || ancestors.has(value as object)) throw new TypeError("UNSAFE_JSON_OBJECT");
  const next = new Set(ancestors).add(value as object);
  return safeObject(Object.keys(value).map((key) => [
    key,
    safeJsonClone(value[key], next),
  ] as const)) as T;
}

function deepFreeze<T>(value: T): T {
  if (value !== null && typeof value === "object" && !Object.isFrozen(value)) {
    for (const key of Reflect.ownKeys(value)) {
      if (key !== "length") deepFreeze((value as Record<PropertyKey, unknown>)[key]);
    }
    Object.freeze(value);
  }
  return value;
}

function exactKeys(value: unknown, keys: readonly string[]): value is Record<string, unknown> {
  return isRecord(value) && canonicalJson(Object.keys(value).sort()) === canonicalJson([...keys].sort());
}

function isId(value: unknown): value is string {
  return typeof value === "string" && /^[a-z][a-z0-9-]{1,31}:[a-z0-9][a-z0-9._-]{2,95}$/.test(value);
}

function isDigest(value: unknown): value is string {
  return typeof value === "string" && /^[a-f0-9]{64}$/.test(value);
}

function isTimestamp(value: unknown): value is number {
  return Number.isSafeInteger(value) && (value as number) >= 0;
}

function isStringArray(value: unknown): value is string[] {
  return isDenseArray(value) && value.every((item) => typeof item === "string")
    && value.length === new Set(value).size;
}

function validFixtureProbe(value: unknown): value is DoctorFixtureProbeV1 {
  return exactKeys(value, ["checkId", "outcome", "durationMs", "privateObservation"])
    && DOCTOR_PROBE_IDS_V1.has(value.checkId as DoctorProbeIdV1)
    && ["MATCH", "MISMATCH", "UNAVAILABLE"].includes(value.outcome as string)
    && Number.isSafeInteger(value.durationMs) && (value.durationMs as number) >= 0;
}

function validComposeServiceId(value: unknown): value is string {
  return typeof value === "string" && /^[a-z][a-z0-9-]{1,31}$/.test(value);
}

function validComposeDoctorOptions(value: unknown): value is AdaptComposeDoctorObservationOptionsV1 {
  if (!exactKeys(value, ["requiredServiceIds", "snapshot"])
    || !Array.isArray(value.requiredServiceIds) || value.requiredServiceIds.length === 0
    || !value.requiredServiceIds.every(validComposeServiceId)
    || value.requiredServiceIds.length !== new Set(value.requiredServiceIds).size
    || !exactKeys(value.snapshot, ["schemaVersion", "source", "readOnly", "mutationCount",
      "observedLockDigest", "composeVersion", "expectedConfigDigest", "observedConfigDigest", "services"])) return false;
  const snapshot = value.snapshot;
  if (snapshot.schemaVersion !== DOCTOR_COMPOSE_OBSERVATION_SCHEMA_V1
    || snapshot.source !== "LOCAL_COMPOSE_SNAPSHOT" || snapshot.readOnly !== true
    || snapshot.mutationCount !== 0 || !isDigest(snapshot.observedLockDigest)
    || !(snapshot.composeVersion === null || /^v?\d+\.\d+\.\d+$/.test(snapshot.composeVersion as string))
    || !isDigest(snapshot.expectedConfigDigest)
    || !(snapshot.observedConfigDigest === null || isDigest(snapshot.observedConfigDigest))
    || !Array.isArray(snapshot.services)
    || !snapshot.services.every((service) => exactKeys(service, ["serviceId", "state", "health"])
      && validComposeServiceId(service.serviceId)
      && ["RUNNING", "STOPPED", "UNAVAILABLE"].includes(service.state as string)
      && ["HEALTHY", "UNHEALTHY", "NOT_AVAILABLE"].includes(service.health as string))) return false;
  const observedIds = snapshot.services.map(({ serviceId }) => serviceId);
  const requiredIds = new Set(value.requiredServiceIds);
  return observedIds.length === new Set(observedIds).size
    && observedIds.every((serviceId) => requiredIds.has(serviceId));
}

export function adaptComposeDoctorObservationV1(
  options: AdaptComposeDoctorObservationOptionsV1,
): DoctorFixtureObservationV1 {
  if (!validComposeDoctorOptions(options)) throw new Error("INVALID_READ_ONLY_COMPOSE_OBSERVATION");
  const services = new Map(options.snapshot.services.map((service) => [service.serviceId, service]));
  const selected = options.requiredServiceIds.map((serviceId) => services.get(serviceId));
  const missingCount = selected.filter((service) => service === undefined).length;
  const unavailableCount = selected.filter((service) => service?.state === "UNAVAILABLE").length;
  const stoppedCount = selected.filter((service) => service?.state === "STOPPED").length;
  const healthUnavailableCount = selected.filter((service) => service === undefined
    || service.state === "UNAVAILABLE" || service.health === "NOT_AVAILABLE").length;
  const unhealthyCount = selected.filter((service) => service?.health === "UNHEALTHY").length;
  const runtimeOutcome = missingCount > 0 || unavailableCount > 0
    ? "UNAVAILABLE" as const
    : stoppedCount > 0 ? "MISMATCH" as const : "MATCH" as const;
  const healthOutcome = healthUnavailableCount > 0
    ? "UNAVAILABLE" as const
    : unhealthyCount > 0 ? "MISMATCH" as const : "MATCH" as const;
  const configurationOutcome = options.snapshot.observedConfigDigest === null
    ? "UNAVAILABLE" as const
    : options.snapshot.observedConfigDigest === options.snapshot.expectedConfigDigest
      ? "MATCH" as const : "MISMATCH" as const;
  const aggregate = {
    requiredServiceCount: options.requiredServiceIds.length,
    observedServiceCount: options.snapshot.services.length,
    missingCount,
    unavailableCount,
    stoppedCount,
    healthUnavailableCount,
    unhealthyCount,
  };
  return {
    schemaVersion: DOCTOR_FIXTURE_OBSERVATION_SCHEMA_V1,
    observedLockDigest: options.snapshot.observedLockDigest,
    mutationCount: 0,
    probes: [
      { checkId: "cm:doctor-installation", outcome: options.snapshot.composeVersion === null ? "UNAVAILABLE" : "MATCH", durationMs: 0, privateObservation: { source: options.snapshot.source, composeVersionObserved: options.snapshot.composeVersion !== null } },
      { checkId: "cm:doctor-runtime", outcome: runtimeOutcome, durationMs: 0, privateObservation: aggregate },
      { checkId: "cm:doctor-configuration", outcome: configurationOutcome, durationMs: 0, privateObservation: { configObserved: options.snapshot.observedConfigDigest !== null } },
      { checkId: "cm:doctor-version-lock", outcome: "MATCH", durationMs: 0, privateObservation: { lockObserved: true } },
      { checkId: "cm:doctor-health-readback", outcome: healthOutcome, durationMs: 0, privateObservation: aggregate },
    ],
  };
}

function validFixtureDoctorOptions(value: unknown): value is RunFixtureDoctorOptionsV1 {
  if (!exactKeys(value, ["reportId", "profile", "expectedLockDigest", "generatedAtMs", "timeoutMs", "fixture"])
    || typeof value.reportId !== "string" || !DOCTOR_REPORT_ID.test(value.reportId)
    || !["QUICK", "STANDARD"].includes(value.profile as string)
    || !isDigest(value.expectedLockDigest) || !isTimestamp(value.generatedAtMs)
    || !Number.isSafeInteger(value.timeoutMs) || (value.timeoutMs as number) <= 0
    || !exactKeys(value.fixture, ["schemaVersion", "observedLockDigest", "mutationCount", "probes"])) return false;
  const fixture = value.fixture;
  if (fixture.schemaVersion !== DOCTOR_FIXTURE_OBSERVATION_SCHEMA_V1
    || !isDigest(fixture.observedLockDigest) || fixture.mutationCount !== 0
    || !Array.isArray(fixture.probes) || !fixture.probes.every(validFixtureProbe)) return false;
  const ids = fixture.probes.map((probe) => probe.checkId);
  return ids.length === new Set(ids).size;
}

function validDoctorReport(value: unknown): value is DoctorReportV1 {
  const profile = isRecord(value) && value.profile;
  const expectedChecks = profile === "QUICK" ? QUICK_DOCTOR_PROBES_V1 : STANDARD_DOCTOR_PROBES_V1;
  const checks = isRecord(value) && Array.isArray(value.checks) ? value.checks : [];
  return exactKeys(value, ["schemaVersion", "reportId", "profile", "readOnly", "observedLockDigest",
    "checks", "generatedAtMs", "reportDigest"])
    && value.schemaVersion === DOCTOR_REPORT_SCHEMA_V1
    && typeof value.reportId === "string" && DOCTOR_REPORT_ID.test(value.reportId)
    && ["QUICK", "STANDARD"].includes(value.profile as string) && value.readOnly === true
    && isDigest(value.observedLockDigest) && isDenseArray(value.checks)
    && value.checks.length === expectedChecks.length
    && value.checks.every((check, index) => {
      const expectedCheckId = expectedChecks[index];
      return exactKeys(check, ["checkId", "status", "reasonCode"])
        && check.checkId === expectedCheckId
        && ((check.status === "PASS" && check.reasonCode === "OBSERVATION_MATCHED")
          || (check.status === "FAIL" && check.reasonCode === "OBSERVATION_MISMATCH")
          || (check.status === "NOT_OBSERVED" && check.reasonCode === "OBSERVATION_UNAVAILABLE"));
    })
    && isTimestamp(value.generatedAtMs) && isDigest(value.reportDigest);
}

export function runFixtureDoctorV1(options: RunFixtureDoctorOptionsV1): DoctorReportV1 {
  let snapshot: RunFixtureDoctorOptionsV1;
  try {
    snapshot = safeJsonClone(options);
  } catch {
    throw new Error("INVALID_READ_ONLY_DOCTOR_FIXTURE");
  }
  if (!validFixtureDoctorOptions(snapshot)) throw new Error("INVALID_READ_ONLY_DOCTOR_FIXTURE");
  const selected = snapshot.profile === "QUICK" ? QUICK_DOCTOR_PROBES_V1 : STANDARD_DOCTOR_PROBES_V1;
  const observations = new Map(snapshot.fixture.probes.map((probe) => [probe.checkId, probe]));
  const checks: DoctorReportV1["checks"] = selected.map((checkId) => {
    const observation = observations.get(checkId);
    const timedOut = observation !== undefined && observation.durationMs > snapshot.timeoutMs;
    let outcome = observation?.outcome ?? "UNAVAILABLE";
    if (timedOut) outcome = "UNAVAILABLE";
    if (checkId === "cm:doctor-version-lock" && outcome !== "UNAVAILABLE") {
      outcome = snapshot.fixture.observedLockDigest === snapshot.expectedLockDigest ? "MATCH" : "MISMATCH";
    }
    if (outcome === "MATCH") return { checkId, status: "PASS", reasonCode: "OBSERVATION_MATCHED" };
    if (outcome === "MISMATCH") return { checkId, status: "FAIL", reasonCode: "OBSERVATION_MISMATCH" };
    return { checkId, status: "NOT_OBSERVED", reasonCode: "OBSERVATION_UNAVAILABLE" };
  });
  const unsigned = {
    schemaVersion: DOCTOR_REPORT_SCHEMA_V1,
    reportId: snapshot.reportId,
    profile: snapshot.profile,
    readOnly: true as const,
    observedLockDigest: snapshot.fixture.observedLockDigest,
    checks,
    generatedAtMs: snapshot.generatedAtMs,
  };
  return deepFreeze({
    ...unsigned,
    reportDigest: updateDoctorContractDigest(unsigned as unknown as Record<string, unknown>, "reportDigest"),
  });
}

function projectPublicDoctorReport(value: DoctorReportV1): Record<string, unknown> {
  const projected = safeObject([
    ["schemaVersion", value.schemaVersion],
    ["reportId", value.reportId],
    ["profile", value.profile],
    ["readOnly", value.readOnly],
    ["observedLockDigest", value.observedLockDigest],
    ["checks", value.checks.map((check) => safeObject([
      ["checkId", check.checkId],
      ["status", check.status],
      ["reasonCode", check.reasonCode],
    ]))],
    ["generatedAtMs", value.generatedAtMs],
    ["reportDigest", value.reportDigest],
  ]);
  if (!exactKeys(projected, DOCTOR_PUBLIC_REPORT_KEYS_V1)) throw new Error("UNSAFE_DOCTOR_PUBLIC_PROJECTION");
  return projected;
}

export function renderPublicDoctorReportV1(value: unknown): string {
  let snapshot: unknown;
  try {
    snapshot = safeJsonClone(value);
  } catch {
    throw new Error("UNSAFE_OR_INVALID_DOCTOR_REPORT");
  }
  if (!validDoctorReport(snapshot)
    || updateDoctorContractDigest(snapshot as unknown as Record<string, unknown>, "reportDigest") !== snapshot.reportDigest) {
    throw new Error("UNSAFE_OR_INVALID_DOCTOR_REPORT");
  }
  return canonicalJson(projectPublicDoctorReport(snapshot));
}

function hasSupportedSchemaVersions(value: Record<string, unknown>): boolean {
  return value.schemaVersion === UPDATE_DOCTOR_BUNDLE_SCHEMA_V1
    && isRecord(value.lockProfile) && value.lockProfile.schemaVersion === UPDATE_LOCK_PROFILE_SCHEMA_V1
    && isRecord(value.operationPlan) && value.operationPlan.schemaVersion === UPDATE_OPERATION_PLAN_SCHEMA_V1
    && isRecord(value.doctorReport) && value.doctorReport.schemaVersion === DOCTOR_REPORT_SCHEMA_V1
    && isRecord(value.operationReceipt) && value.operationReceipt.schemaVersion === UPDATE_OPERATION_RECEIPT_SCHEMA_V1;
}

function structurallyValid(value: Record<string, unknown>): boolean {
  if (!exactKeys(value, ["schemaVersion", "lockProfile", "operationPlan", "doctorReport", "operationReceipt"])
    || !isRecord(value.lockProfile) || !isRecord(value.operationPlan)
    || !isRecord(value.doctorReport) || !isRecord(value.operationReceipt)) return false;
  const lock = value.lockProfile;
  const plan = value.operationPlan;
  const report = value.doctorReport;
  const receipt = value.operationReceipt;
  if (!exactKeys(lock, ["schemaVersion", "releaseId", "components", "versionAxes", "authorityProfile", "lockDigest"])
    || typeof lock.releaseId !== "string" || !Array.isArray(lock.components) || lock.components.length === 0
    || !lock.components.every((component) => exactKeys(component, ["componentId", "version", "digest"])
      && isId(component.componentId) && typeof component.version === "string" && isDigest(component.digest))
    || !exactKeys(lock.versionAxes, ["controlPlane", "dataModel", "evidence"])
    || !Object.values(lock.versionAxes).every((axis) => typeof axis === "string")
    || !exactKeys(lock.authorityProfile, ["profileId", "digest"])
    || !isId(lock.authorityProfile.profileId) || !isDigest(lock.authorityProfile.digest) || !isDigest(lock.lockDigest)) return false;
  if (!exactKeys(plan, ["schemaVersion", "operationId", "mode", "fromLockDigest", "targetLockDigest",
    "requiredAuthorityProfileDigest", "authorityDelta", "issuedAtMs", "planDigest"])
    || !isId(plan.operationId) || plan.mode !== "CHECK_ONLY" || !isDigest(plan.fromLockDigest)
    || !isDigest(plan.targetLockDigest) || !isDigest(plan.requiredAuthorityProfileDigest)
    || !exactKeys(plan.authorityDelta, ["added", "removed"])
    || !isStringArray(plan.authorityDelta.added) || !isStringArray(plan.authorityDelta.removed)
    || !isTimestamp(plan.issuedAtMs) || !isDigest(plan.planDigest)) return false;
  if (!exactKeys(report, ["schemaVersion", "reportId", "profile", "readOnly", "observedLockDigest",
    "checks", "generatedAtMs", "reportDigest"])
    || !isId(report.reportId) || !["QUICK", "STANDARD"].includes(report.profile as string)
    || report.readOnly !== true || !isDigest(report.observedLockDigest) || !Array.isArray(report.checks)
    || report.checks.length === 0 || !report.checks.every((check) => exactKeys(check, ["checkId", "status", "reasonCode"])
      && isId(check.checkId) && ["PASS", "FAIL", "NOT_OBSERVED"].includes(check.status as string)
      && ["OBSERVATION_MATCHED", "OBSERVATION_MISMATCH", "OBSERVATION_UNAVAILABLE"].includes(check.reasonCode as string))
    || !isTimestamp(report.generatedAtMs) || !isDigest(report.reportDigest)) return false;
  return exactKeys(receipt, ["schemaVersion", "operationId", "action", "outcome", "reasonCodes", "exitCode",
    "planDigest", "beforeLockDigest", "afterLockDigest", "mutationObserved", "completedAtMs", "receiptDigest"])
    && isId(receipt.operationId) && receipt.action === "VALIDATE_CONTRACTS" && receipt.outcome === "ACCEPTED"
    && canonicalJson(receipt.reasonCodes) === canonicalJson(["UPDATE_CONTRACT_ACCEPTED"])
    && receipt.exitCode === 0 && isDigest(receipt.planDigest) && isDigest(receipt.beforeLockDigest)
    && isDigest(receipt.afterLockDigest) && receipt.mutationObserved === false
    && isTimestamp(receipt.completedAtMs) && isDigest(receipt.receiptDigest);
}

export function updateDoctorContractDigest(value: Record<string, unknown>, digestKey: string): string {
  const content = Object.fromEntries(Object.entries(value).filter(([key]) => key !== digestKey));
  return createHash("sha256").update(canonicalJson(content)).digest("hex");
}

function exactVersion(value: string): boolean {
  return /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/.test(value);
}

function exactAxis(value: string): boolean {
  return /^v[1-9]\d*$/.test(value);
}

export function verifyUpdateDoctorContractBundleV1(value: unknown): UpdateDoctorVerificationResultV1 {
  if (!isRecord(value)) return { outcome: "DENIED", reasonCodes: ["SCHEMA_DENIED"], exitCode: 10 };
  if (!hasSupportedSchemaVersions(value)) {
    return { outcome: "DENIED", reasonCodes: ["UNSUPPORTED_CONTRACT_VERSION_DENIED"], exitCode: 11 };
  }
  if (!structurallyValid(value)) return { outcome: "DENIED", reasonCodes: ["SCHEMA_DENIED"], exitCode: 10 };

  const bundle = value as unknown as UpdateDoctorContractBundleV1;
  const reasons = new Set<UpdateDoctorReasonCodeV1>();
  const { lockProfile: lock, operationPlan: plan, doctorReport: report, operationReceipt: receipt } = bundle;
  const componentIds = lock.components.map(({ componentId }) => componentId);
  if (!exactVersion(lock.releaseId) || !lock.components.every(({ version }) => exactVersion(version))
    || !Object.values(lock.versionAxes).every(exactAxis) || componentIds.length !== new Set(componentIds).size) {
    reasons.add("MUTABLE_TARGET_DENIED");
  }
  if (updateDoctorContractDigest(lock as unknown as Record<string, unknown>, "lockDigest") !== lock.lockDigest
    || updateDoctorContractDigest(plan as unknown as Record<string, unknown>, "planDigest") !== plan.planDigest
    || updateDoctorContractDigest(report as unknown as Record<string, unknown>, "reportDigest") !== report.reportDigest
    || updateDoctorContractDigest(receipt as unknown as Record<string, unknown>, "receiptDigest") !== receipt.receiptDigest) {
    reasons.add("DIGEST_MISMATCH_DENIED");
  }
  if (plan.requiredAuthorityProfileDigest !== lock.authorityProfile.digest
    || plan.authorityDelta.added.length > 0 || plan.authorityDelta.removed.length > 0) {
    reasons.add("AUTHORITY_DELTA_DENIED");
  }
  if (plan.fromLockDigest !== lock.lockDigest || plan.targetLockDigest !== lock.lockDigest
    || report.observedLockDigest !== lock.lockDigest || receipt.operationId !== plan.operationId
    || receipt.planDigest !== plan.planDigest || receipt.beforeLockDigest !== lock.lockDigest
    || receipt.afterLockDigest !== lock.lockDigest || receipt.mutationObserved !== false) {
    reasons.add("MUTATION_CLAIM_DENIED");
  }

  if (reasons.size === 0) {
    return { outcome: "ACCEPTED", reasonCodes: ["UPDATE_CONTRACT_ACCEPTED"], exitCode: 0 };
  }
  const reasonCodes = DENIAL_ORDER.filter((reason) => reasons.has(reason));
  return { outcome: "DENIED", reasonCodes, exitCode: UPDATE_DOCTOR_EXIT_CODES_V1[reasonCodes[0]!] };
}
