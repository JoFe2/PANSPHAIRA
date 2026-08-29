import { createHash } from "node:crypto";
import { canonicalJson } from "./canonical-json.js";

/**
 * CKS-06 (issue #286) — pure advisory resource-admission contract v1.
 *
 * This module validates one atomic scheduling-capacity proposal. It admits a
 * parallel candidate set only when all declared predecessors are positively
 * terminal, dependency leases do not conflict, normalized and controller-
 * resolved repository paths do not have a conflicting prefix overlap, every
 * complete context demand fits the exact profile limits, and the aggregate
 * demand fits the smallest contemporaneously measured KV-capacity bucket.
 * Work-order budget and measured resident-memory bounds are checked in the
 * same decision so that a partial or best-effort admission is impossible.
 *
 * Time and path resolution are explicit inputs: this pure module never reads
 * a clock or filesystem. The caller supplies decisionAtMs and controller-
 * resolved paths; canonical digests bind those inputs. VALID therefore means
 * only a positive advisory scheduling-capacity receipt. It does not measure,
 * acquire a lease, reserve a resource, invoke a provider, execute a route, or
 * grant Capability or Authority.
 */

export const CKS_RESOURCE_ADMISSION_SCHEMA_V1 =
  "chimpmaera.dev/cks-resource-admission/v1" as const;

export const CKS_RESOURCE_ADMISSION_CLAIM_BOUNDARY_V1 =
  "SCHEDULING_CAPACITY_RECEIPT_ONLY_NOT_RESOURCE_PLANE_AUTHORITY_AND_NOT_EXECUTION" as const;

export const CKS_LEASE_MODES_V1 = ["READ", "WRITE"] as const;
export const CKS_DEPENDENCY_TERMINAL_OUTCOMES_V1 = ["POSITIVE", "DENIED", "UNKNOWN"] as const;

export type CksLeaseModeV1 = (typeof CKS_LEASE_MODES_V1)[number];
export type CksDependencyTerminalOutcomeV1 =
  (typeof CKS_DEPENDENCY_TERMINAL_OUTCOMES_V1)[number];

export const CKS_REQUEST_FIELDS_V1 = [
  "schemaVersion",
  "decisionAtMs",
  "measurement",
  "budget",
  "candidates",
  "requestDigest",
] as const;

export const CKS_MEASUREMENT_FIELDS_V1 = [
  "taskDemandDigest",
  "exactProfileDigest",
  "runtimeAndHardwareClassDigest",
  "capacityMeasurementMethodDigest",
  "capacityBucketDigest",
  "observedAtMs",
  "expiresAtMs",
  "dependencyGraphDigest",
  "pathLeaseSetDigest",
  "workOrderBudgetDigest",
  "catalogDigest",
  "priceBookDigest",
  "contextWindowTokens",
  "maximumInputTokens",
  "maximumOutputTokens",
  "capacityBuckets",
  "measurementDigest",
] as const;

export const CKS_BUDGET_FIELDS_V1 = [
  "remainingCalls",
  "remainingTokens",
  "remainingCostMicros",
  "remainingElapsedMs",
  "remainingResidentBytes",
  "reservedCalls",
  "reservedTokens",
  "reservedCostMicros",
  "reservedElapsedMs",
  "reservedResidentBytes",
] as const;

export const CKS_CAPACITY_BUCKET_FIELDS_V1 = [
  "bucketId",
  "ordinal",
  "maximumTotalTokens",
  "maximumConcurrentSequences",
  "measuredKvPeakBytes",
  "residentModelAndRuntimePeakBytes",
  "reservableMeasuredBytes",
  "bucketDigest",
] as const;

export const CKS_CANDIDATE_FIELDS_V1 = [
  "candidateId",
  "predecessors",
  "dependencyLeases",
  "pathLeases",
  "demand",
] as const;

export const CKS_DEMAND_FIELDS_V1 = [
  "inputTokens",
  "toolSchemaTokens",
  "maximumOutputTokens",
  "safetyReserveTokens",
  "concurrentSequences",
] as const;

export const CKS_PREDECESSOR_FIELDS_V1 = [
  "predecessorId",
  "terminalOutcome",
  "terminalReceiptDigest",
] as const;

export const CKS_DEPENDENCY_LEASE_FIELDS_V1 = ["dependencyId", "mode"] as const;
export const CKS_PATH_LEASE_FIELDS_V1 = [
  "path",
  "resolvedPath",
  "mode",
  "resolutionDigest",
] as const;

const MAX_CANDIDATES = 64;
const MAX_PREDECESSORS = 128;
const MAX_LEASES = 128;
const MAX_CAPACITY_BUCKETS = 32;
const MAX_IDENTIFIER_LENGTH = 128;
const MAX_PATH_LENGTH = 240;

const DIGEST_PATTERN = /^[a-f0-9]{64}$/;
const IDENTIFIER_PATTERN = /^[a-z0-9][a-z0-9._-]*$/;
const PATH_SEGMENT_PATTERN = /^[A-Za-z0-9._@+-]+$/;

const sha256Hex = (value: string): string =>
  createHash("sha256").update(value).digest("hex");

export interface CksDependencyPredecessorV1 {
  readonly predecessorId: string;
  readonly terminalOutcome: CksDependencyTerminalOutcomeV1;
  readonly terminalReceiptDigest: string;
}

export interface CksDependencyLeaseV1 {
  readonly dependencyId: string;
  readonly mode: CksLeaseModeV1;
}

/**
 * path is the declared repository-relative path. resolvedPath is the
 * repository-relative result supplied by the path-lease controller after
 * symlink resolution. Missing or unbound resolution is not expressible.
 */
export interface CksPathLeaseV1 {
  readonly path: string;
  readonly resolvedPath: string;
  readonly mode: CksLeaseModeV1;
  readonly resolutionDigest: string;
}

export interface CksCandidateDemandV1 {
  readonly inputTokens: number;
  readonly toolSchemaTokens: number;
  readonly maximumOutputTokens: number;
  readonly safetyReserveTokens: number;
  readonly concurrentSequences: number;
}

export interface CksResourceAdmissionCandidateV1 {
  readonly candidateId: string;
  readonly predecessors: readonly CksDependencyPredecessorV1[];
  readonly dependencyLeases: readonly CksDependencyLeaseV1[];
  readonly pathLeases: readonly CksPathLeaseV1[];
  readonly demand: CksCandidateDemandV1;
}

/** A measured capacity tier; ordinal zero is the smallest measured tier. */
export interface CksMeasuredCapacityBucketV1 {
  readonly bucketId: string;
  readonly ordinal: number;
  readonly maximumTotalTokens: number;
  readonly maximumConcurrentSequences: number;
  readonly measuredKvPeakBytes: number;
  readonly residentModelAndRuntimePeakBytes: number;
  readonly reservableMeasuredBytes: number;
  readonly bucketDigest: string;
}

export interface CksWorkOrderBudgetV1 {
  readonly remainingCalls: number;
  readonly remainingTokens: number;
  readonly remainingCostMicros: number;
  readonly remainingElapsedMs: number;
  readonly remainingResidentBytes: number;
  readonly reservedCalls: number;
  readonly reservedTokens: number;
  readonly reservedCostMicros: number;
  readonly reservedElapsedMs: number;
  readonly reservedResidentBytes: number;
}

/**
 * A contemporaneous measured snapshot and all frozen lineage bindings. The
 * capacity bucket inventory is ordered from smallest to largest measured
 * tier; the validator selects the first tier covering total tokens and
 * concurrent sequences and requires capacityBucketDigest to identify it.
 */
export interface CksResourceAdmissionMeasurementV1 {
  readonly taskDemandDigest: string;
  readonly exactProfileDigest: string;
  readonly runtimeAndHardwareClassDigest: string;
  readonly capacityMeasurementMethodDigest: string;
  readonly capacityBucketDigest: string;
  readonly observedAtMs: number;
  readonly expiresAtMs: number;
  readonly dependencyGraphDigest: string;
  readonly pathLeaseSetDigest: string;
  readonly workOrderBudgetDigest: string;
  readonly catalogDigest: string;
  readonly priceBookDigest: string;
  readonly contextWindowTokens: number;
  readonly maximumInputTokens: number;
  readonly maximumOutputTokens: number;
  readonly capacityBuckets: readonly CksMeasuredCapacityBucketV1[];
  readonly measurementDigest: string;
}

export interface CksResourceAdmissionRequestV1 {
  readonly schemaVersion: typeof CKS_RESOURCE_ADMISSION_SCHEMA_V1;
  readonly decisionAtMs: number;
  readonly measurement: CksResourceAdmissionMeasurementV1;
  readonly budget: CksWorkOrderBudgetV1;
  readonly candidates: readonly CksResourceAdmissionCandidateV1[];
  readonly requestDigest: string;
}

export type CksResourceAdmissionDenialV1 =
  | "UNKNOWN_FIELD"
  | "MISSING_FIELD"
  | "MALFORMED_VALUE"
  | "BINDING_DIGEST_MISMATCH"
  | "MEASUREMENT_DIGEST_MISMATCH"
  | "DIGEST_MISMATCH"
  | "STALE_MEASUREMENT"
  | "DEPENDENCY_NOT_READY"
  | "LEASE_CONFLICT"
  | "CONTEXT_CAPACITY_VIOLATION"
  | "KV_CAPACITY_VIOLATION"
  | "CAPACITY_BUCKET_MISMATCH"
  | "BUDGET_VIOLATION";

export type CksResourceAdmissionValidationV1 =
  | {
      readonly outcome: "VALID";
      readonly requestDigest: string;
      readonly capacityBucketDigest: string;
      readonly claimBoundary: typeof CKS_RESOURCE_ADMISSION_CLAIM_BOUNDARY_V1;
    }
  | {
      readonly outcome: "DENIED";
      readonly reason: CksResourceAdmissionDenialV1;
      readonly detail: string;
    };

type CksResourceAdmissionDeniedV1 = Extract<
  CksResourceAdmissionValidationV1,
  { readonly outcome: "DENIED" }
>;

const denied = (
  reason: CksResourceAdmissionDenialV1,
  detail: string,
): CksResourceAdmissionDeniedV1 => ({ outcome: "DENIED", reason, detail });

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object"
  && value !== null
  && Object.getPrototypeOf(value) === Object.prototype;

const hasOwn = (value: Record<string, unknown>, key: string): boolean =>
  Object.prototype.hasOwnProperty.call(value, key);

const isNonNegativeInteger = (value: unknown): value is number =>
  typeof value === "number"
  && Number.isSafeInteger(value)
  && value >= 0
  && !Object.is(value, -0);

const isPositiveInteger = (value: unknown): value is number =>
  isNonNegativeInteger(value) && value >= 1;

const isDigest = (value: unknown): value is string =>
  typeof value === "string" && DIGEST_PATTERN.test(value);

const isIdentifier = (value: unknown): value is string =>
  typeof value === "string"
  && value.length <= MAX_IDENTIFIER_LENGTH
  && IDENTIFIER_PATTERN.test(value);

const isRepositoryPath = (value: unknown): value is string => {
  if (typeof value !== "string" || value.length < 1 || value.length > MAX_PATH_LENGTH) return false;
  if (value.startsWith("/") || value.includes("\\") || value.includes("\0")) return false;
  const segments = value.split("/");
  return segments.every(
    (segment) => segment.length > 0
      && segment !== "."
      && segment !== ".."
      && PATH_SEGMENT_PATTERN.test(segment),
  );
};

const checkFields = (
  value: Record<string, unknown>,
  fields: readonly string[],
  path: string,
): CksResourceAdmissionDeniedV1 | undefined => {
  for (const key of Object.keys(value)) {
    if (!fields.includes(key)) return denied("UNKNOWN_FIELD", `${path}.${key}`);
  }
  for (const key of fields) {
    if (!hasOwn(value, key)) return denied("MISSING_FIELD", `${path}.${key}`);
  }
  return undefined;
};

const safeSum = (values: readonly number[]): number | undefined => {
  let total = 0;
  for (const value of values) {
    if (value > Number.MAX_SAFE_INTEGER - total) return undefined;
    total += value;
  }
  return total;
};

const pathsOverlap = (a: string, b: string): boolean =>
  a === b || a.startsWith(`${b}/`) || b.startsWith(`${a}/`);

export function cksPathResolutionDigestV1(
  resolution: Pick<CksPathLeaseV1, "path" | "resolvedPath">,
): string {
  return sha256Hex(canonicalJson({ path: resolution.path, resolvedPath: resolution.resolvedPath }));
}

export function cksCapacityBucketDigestV1(
  bucket: Omit<CksMeasuredCapacityBucketV1, "bucketDigest">,
): string {
  return sha256Hex(
    canonicalJson({
      bucketId: bucket.bucketId,
      maximumConcurrentSequences: bucket.maximumConcurrentSequences,
      maximumTotalTokens: bucket.maximumTotalTokens,
      measuredKvPeakBytes: bucket.measuredKvPeakBytes,
      ordinal: bucket.ordinal,
      reservableMeasuredBytes: bucket.reservableMeasuredBytes,
      residentModelAndRuntimePeakBytes: bucket.residentModelAndRuntimePeakBytes,
    }),
  );
}

export function cksTaskDemandDigestV1(
  candidates: readonly Pick<CksResourceAdmissionCandidateV1, "candidateId" | "demand">[],
): string {
  return sha256Hex(
    canonicalJson(candidates.map((candidate) => ({
      candidateId: candidate.candidateId,
      demand: candidate.demand,
    }))),
  );
}

export function cksDependencyGraphDigestV1(
  candidates: readonly Pick<
    CksResourceAdmissionCandidateV1,
    "candidateId" | "predecessors" | "dependencyLeases"
  >[],
): string {
  return sha256Hex(
    canonicalJson(candidates.map((candidate) => ({
      candidateId: candidate.candidateId,
      dependencyLeases: candidate.dependencyLeases,
      predecessors: candidate.predecessors,
    }))),
  );
}

export function cksPathLeaseSetDigestV1(
  candidates: readonly Pick<CksResourceAdmissionCandidateV1, "candidateId" | "pathLeases">[],
): string {
  return sha256Hex(
    canonicalJson(candidates.map((candidate) => ({
      candidateId: candidate.candidateId,
      pathLeases: candidate.pathLeases,
    }))),
  );
}

export function cksWorkOrderBudgetDigestV1(budget: CksWorkOrderBudgetV1): string {
  return sha256Hex(canonicalJson(budget));
}

export function cksMeasurementDigestV1(
  measurement: Omit<CksResourceAdmissionMeasurementV1, "measurementDigest">,
): string {
  return sha256Hex(
    canonicalJson({
      capacityBucketDigest: measurement.capacityBucketDigest,
      capacityBuckets: measurement.capacityBuckets,
      capacityMeasurementMethodDigest: measurement.capacityMeasurementMethodDigest,
      catalogDigest: measurement.catalogDigest,
      contextWindowTokens: measurement.contextWindowTokens,
      dependencyGraphDigest: measurement.dependencyGraphDigest,
      exactProfileDigest: measurement.exactProfileDigest,
      expiresAtMs: measurement.expiresAtMs,
      maximumInputTokens: measurement.maximumInputTokens,
      maximumOutputTokens: measurement.maximumOutputTokens,
      observedAtMs: measurement.observedAtMs,
      pathLeaseSetDigest: measurement.pathLeaseSetDigest,
      priceBookDigest: measurement.priceBookDigest,
      runtimeAndHardwareClassDigest: measurement.runtimeAndHardwareClassDigest,
      taskDemandDigest: measurement.taskDemandDigest,
      workOrderBudgetDigest: measurement.workOrderBudgetDigest,
    }),
  );
}

export function cksRequestDigestV1(
  request: Omit<CksResourceAdmissionRequestV1, "requestDigest">,
): string {
  return sha256Hex(
    canonicalJson({
      budget: request.budget,
      candidates: request.candidates,
      decisionAtMs: request.decisionAtMs,
      measurement: request.measurement,
      schemaVersion: request.schemaVersion,
    }),
  );
}

interface LeaseOccurrence {
  readonly candidateIndex: number;
  readonly candidateId: string;
  readonly id: string;
  readonly mode: CksLeaseModeV1;
}

function findDependencyLeaseConflict(
  leases: readonly LeaseOccurrence[],
): CksResourceAdmissionDeniedV1 | undefined {
  for (let i = 0; i < leases.length; i += 1) {
    for (let j = i + 1; j < leases.length; j += 1) {
      const a = leases[i]!;
      const b = leases[j]!;
      if (
        a.candidateIndex !== b.candidateIndex
        && a.id === b.id
        && (a.mode === "WRITE" || b.mode === "WRITE")
      ) {
        return denied("LEASE_CONFLICT", `dependency:${a.id} (${a.candidateId} vs ${b.candidateId})`);
      }
    }
  }
  return undefined;
}

function findPathLeaseConflict(
  leases: readonly LeaseOccurrence[],
): CksResourceAdmissionDeniedV1 | undefined {
  for (let i = 0; i < leases.length; i += 1) {
    for (let j = i + 1; j < leases.length; j += 1) {
      const a = leases[i]!;
      const b = leases[j]!;
      if (
        a.candidateIndex !== b.candidateIndex
        && pathsOverlap(a.id, b.id)
        && (a.mode === "WRITE" || b.mode === "WRITE")
      ) {
        return denied("LEASE_CONFLICT", `path:${a.id}|${b.id} (${a.candidateId} vs ${b.candidateId})`);
      }
    }
  }
  return undefined;
}

/**
 * Closed, deterministic and fail-closed validation. Every structural and
 * digest binding is checked before freshness, dependency, lease, capacity,
 * and budget semantics. No partial candidate subset is ever returned.
 */
export function validateCksResourceAdmissionRequestV1(
  input: unknown,
): CksResourceAdmissionValidationV1 {
  if (!isPlainObject(input)) return denied("MALFORMED_VALUE", "request");
  const requestFieldDenial = checkFields(input, CKS_REQUEST_FIELDS_V1, "request");
  if (requestFieldDenial !== undefined) return requestFieldDenial;
  if (input.schemaVersion !== CKS_RESOURCE_ADMISSION_SCHEMA_V1) {
    return denied("MALFORMED_VALUE", "request.schemaVersion");
  }
  if (!isNonNegativeInteger(input.decisionAtMs)) {
    return denied("MALFORMED_VALUE", "request.decisionAtMs");
  }
  if (!isDigest(input.requestDigest)) return denied("MALFORMED_VALUE", "request.requestDigest");

  if (!isPlainObject(input.measurement)) return denied("MALFORMED_VALUE", "request.measurement");
  const measurementRecord = input.measurement;
  const measurementFieldDenial = checkFields(
    measurementRecord,
    CKS_MEASUREMENT_FIELDS_V1,
    "request.measurement",
  );
  if (measurementFieldDenial !== undefined) return measurementFieldDenial;

  const measurementDigestFields = [
    "taskDemandDigest",
    "exactProfileDigest",
    "runtimeAndHardwareClassDigest",
    "capacityMeasurementMethodDigest",
    "capacityBucketDigest",
    "dependencyGraphDigest",
    "pathLeaseSetDigest",
    "workOrderBudgetDigest",
    "catalogDigest",
    "priceBookDigest",
    "measurementDigest",
  ] as const;
  for (const field of measurementDigestFields) {
    if (!isDigest(measurementRecord[field])) {
      return denied("MALFORMED_VALUE", `request.measurement.${field}`);
    }
  }
  if (!isNonNegativeInteger(measurementRecord.observedAtMs)) {
    return denied("MALFORMED_VALUE", "request.measurement.observedAtMs");
  }
  if (!isNonNegativeInteger(measurementRecord.expiresAtMs)) {
    return denied("MALFORMED_VALUE", "request.measurement.expiresAtMs");
  }
  for (const field of ["contextWindowTokens", "maximumInputTokens", "maximumOutputTokens"] as const) {
    if (!isPositiveInteger(measurementRecord[field])) {
      return denied("MALFORMED_VALUE", `request.measurement.${field}`);
    }
  }
  if (
    (measurementRecord.maximumInputTokens as number) > (measurementRecord.contextWindowTokens as number)
    || (measurementRecord.maximumOutputTokens as number) > (measurementRecord.contextWindowTokens as number)
  ) {
    return denied("MALFORMED_VALUE", "request.measurement.contextLimits");
  }

  const rawBuckets = measurementRecord.capacityBuckets;
  if (
    !Array.isArray(rawBuckets)
    || rawBuckets.length < 1
    || rawBuckets.length > MAX_CAPACITY_BUCKETS
  ) {
    return denied("MALFORMED_VALUE", "request.measurement.capacityBuckets");
  }
  const bucketIds = new Set<string>();
  const bucketDigests = new Set<string>();
  for (let i = 0; i < rawBuckets.length; i += 1) {
    const rawBucket = rawBuckets[i];
    const bucketPath = `request.measurement.capacityBuckets[${i}]`;
    if (!isPlainObject(rawBucket)) return denied("MALFORMED_VALUE", bucketPath);
    const bucketFieldDenial = checkFields(rawBucket, CKS_CAPACITY_BUCKET_FIELDS_V1, bucketPath);
    if (bucketFieldDenial !== undefined) return bucketFieldDenial;
    if (!isIdentifier(rawBucket.bucketId) || bucketIds.has(rawBucket.bucketId)) {
      return denied("MALFORMED_VALUE", `${bucketPath}.bucketId`);
    }
    bucketIds.add(rawBucket.bucketId);
    if (!isNonNegativeInteger(rawBucket.ordinal) || rawBucket.ordinal !== i) {
      return denied("MALFORMED_VALUE", `${bucketPath}.ordinal`);
    }
    for (const field of [
      "maximumTotalTokens",
      "maximumConcurrentSequences",
      "measuredKvPeakBytes",
      "residentModelAndRuntimePeakBytes",
      "reservableMeasuredBytes",
    ] as const) {
      if (!isPositiveInteger(rawBucket[field])) {
        return denied("MALFORMED_VALUE", `${bucketPath}.${field}`);
      }
    }
    if (!isDigest(rawBucket.bucketDigest) || bucketDigests.has(rawBucket.bucketDigest)) {
      return denied("MALFORMED_VALUE", `${bucketPath}.bucketDigest`);
    }
    bucketDigests.add(rawBucket.bucketDigest);
    const typedBucket = rawBucket as unknown as CksMeasuredCapacityBucketV1;
    if (cksCapacityBucketDigestV1(typedBucket) !== typedBucket.bucketDigest) {
      return denied("BINDING_DIGEST_MISMATCH", `${bucketPath}.bucketDigest`);
    }
  }

  if (!isPlainObject(input.budget)) return denied("MALFORMED_VALUE", "request.budget");
  const budgetRecord = input.budget;
  const budgetFieldDenial = checkFields(budgetRecord, CKS_BUDGET_FIELDS_V1, "request.budget");
  if (budgetFieldDenial !== undefined) return budgetFieldDenial;
  for (const field of CKS_BUDGET_FIELDS_V1) {
    if (!isNonNegativeInteger(budgetRecord[field])) {
      return denied("MALFORMED_VALUE", `request.budget.${field}`);
    }
  }
  for (const field of [
    "remainingCalls",
    "remainingTokens",
    "remainingElapsedMs",
    "remainingResidentBytes",
    "reservedCalls",
    "reservedElapsedMs",
    "reservedResidentBytes",
  ] as const) {
    if ((budgetRecord[field] as number) < 1) {
      return denied("MALFORMED_VALUE", `request.budget.${field}`);
    }
  }

  const rawCandidates = input.candidates;
  if (
    !Array.isArray(rawCandidates)
    || rawCandidates.length < 1
    || rawCandidates.length > MAX_CANDIDATES
  ) {
    return denied("MALFORMED_VALUE", "request.candidates");
  }
  const candidateIds = new Set<string>();
  for (let i = 0; i < rawCandidates.length; i += 1) {
    const rawCandidate = rawCandidates[i];
    const candidatePath = `request.candidates[${i}]`;
    if (!isPlainObject(rawCandidate)) return denied("MALFORMED_VALUE", candidatePath);
    const candidateFieldDenial = checkFields(rawCandidate, CKS_CANDIDATE_FIELDS_V1, candidatePath);
    if (candidateFieldDenial !== undefined) return candidateFieldDenial;
    if (!isIdentifier(rawCandidate.candidateId) || candidateIds.has(rawCandidate.candidateId)) {
      return denied("MALFORMED_VALUE", `${candidatePath}.candidateId`);
    }
    candidateIds.add(rawCandidate.candidateId);

    if (!isPlainObject(rawCandidate.demand)) {
      return denied("MALFORMED_VALUE", `${candidatePath}.demand`);
    }
    const demandFieldDenial = checkFields(
      rawCandidate.demand,
      CKS_DEMAND_FIELDS_V1,
      `${candidatePath}.demand`,
    );
    if (demandFieldDenial !== undefined) return demandFieldDenial;
    for (const field of CKS_DEMAND_FIELDS_V1) {
      if (!isNonNegativeInteger(rawCandidate.demand[field])) {
        return denied("MALFORMED_VALUE", `${candidatePath}.demand.${field}`);
      }
    }
    if ((rawCandidate.demand.concurrentSequences as number) < 1) {
      return denied("MALFORMED_VALUE", `${candidatePath}.demand.concurrentSequences`);
    }

    if (
      !Array.isArray(rawCandidate.predecessors)
      || rawCandidate.predecessors.length > MAX_PREDECESSORS
    ) {
      return denied("MALFORMED_VALUE", `${candidatePath}.predecessors`);
    }
    const predecessorIds = new Set<string>();
    for (let j = 0; j < rawCandidate.predecessors.length; j += 1) {
      const predecessor = rawCandidate.predecessors[j];
      const predecessorPath = `${candidatePath}.predecessors[${j}]`;
      if (!isPlainObject(predecessor)) return denied("MALFORMED_VALUE", predecessorPath);
      const predecessorFieldDenial = checkFields(
        predecessor,
        CKS_PREDECESSOR_FIELDS_V1,
        predecessorPath,
      );
      if (predecessorFieldDenial !== undefined) return predecessorFieldDenial;
      if (!isIdentifier(predecessor.predecessorId) || predecessorIds.has(predecessor.predecessorId)) {
        return denied("MALFORMED_VALUE", `${predecessorPath}.predecessorId`);
      }
      predecessorIds.add(predecessor.predecessorId);
      if (
        typeof predecessor.terminalOutcome !== "string"
        || !(CKS_DEPENDENCY_TERMINAL_OUTCOMES_V1 as readonly string[])
          .includes(predecessor.terminalOutcome)
      ) {
        return denied("MALFORMED_VALUE", `${predecessorPath}.terminalOutcome`);
      }
      if (!isDigest(predecessor.terminalReceiptDigest)) {
        return denied("MALFORMED_VALUE", `${predecessorPath}.terminalReceiptDigest`);
      }
    }

    if (
      !Array.isArray(rawCandidate.dependencyLeases)
      || rawCandidate.dependencyLeases.length > MAX_LEASES
    ) {
      return denied("MALFORMED_VALUE", `${candidatePath}.dependencyLeases`);
    }
    const dependencyIds = new Set<string>();
    for (let j = 0; j < rawCandidate.dependencyLeases.length; j += 1) {
      const lease = rawCandidate.dependencyLeases[j];
      const leasePath = `${candidatePath}.dependencyLeases[${j}]`;
      if (!isPlainObject(lease)) return denied("MALFORMED_VALUE", leasePath);
      const leaseFieldDenial = checkFields(lease, CKS_DEPENDENCY_LEASE_FIELDS_V1, leasePath);
      if (leaseFieldDenial !== undefined) return leaseFieldDenial;
      if (!isIdentifier(lease.dependencyId) || dependencyIds.has(lease.dependencyId)) {
        return denied("MALFORMED_VALUE", `${leasePath}.dependencyId`);
      }
      dependencyIds.add(lease.dependencyId);
      if (
        typeof lease.mode !== "string"
        || !(CKS_LEASE_MODES_V1 as readonly string[]).includes(lease.mode)
      ) {
        return denied("MALFORMED_VALUE", `${leasePath}.mode`);
      }
    }

    if (!Array.isArray(rawCandidate.pathLeases) || rawCandidate.pathLeases.length > MAX_LEASES) {
      return denied("MALFORMED_VALUE", `${candidatePath}.pathLeases`);
    }
    const declaredPaths = new Set<string>();
    const resolvedPaths = new Set<string>();
    for (let j = 0; j < rawCandidate.pathLeases.length; j += 1) {
      const lease = rawCandidate.pathLeases[j];
      const leasePath = `${candidatePath}.pathLeases[${j}]`;
      if (!isPlainObject(lease)) return denied("MALFORMED_VALUE", leasePath);
      const leaseFieldDenial = checkFields(lease, CKS_PATH_LEASE_FIELDS_V1, leasePath);
      if (leaseFieldDenial !== undefined) return leaseFieldDenial;
      if (!isRepositoryPath(lease.path) || declaredPaths.has(lease.path)) {
        return denied("MALFORMED_VALUE", `${leasePath}.path`);
      }
      declaredPaths.add(lease.path);
      if (!isRepositoryPath(lease.resolvedPath) || resolvedPaths.has(lease.resolvedPath)) {
        return denied("MALFORMED_VALUE", `${leasePath}.resolvedPath`);
      }
      resolvedPaths.add(lease.resolvedPath);
      if (
        typeof lease.mode !== "string"
        || !(CKS_LEASE_MODES_V1 as readonly string[]).includes(lease.mode)
      ) {
        return denied("MALFORMED_VALUE", `${leasePath}.mode`);
      }
      if (!isDigest(lease.resolutionDigest)) {
        return denied("MALFORMED_VALUE", `${leasePath}.resolutionDigest`);
      }
      const typedLease = lease as unknown as CksPathLeaseV1;
      if (cksPathResolutionDigestV1(typedLease) !== typedLease.resolutionDigest) {
        return denied("BINDING_DIGEST_MISMATCH", `${leasePath}.resolutionDigest`);
      }
    }
  }

  const measurement = measurementRecord as unknown as CksResourceAdmissionMeasurementV1;
  const budget = budgetRecord as unknown as CksWorkOrderBudgetV1;
  const candidates = rawCandidates as unknown as CksResourceAdmissionCandidateV1[];
  const buckets = rawBuckets as unknown as CksMeasuredCapacityBucketV1[];
  const request = input as unknown as CksResourceAdmissionRequestV1;

  const expectedBindings: readonly [string, string, string][] = [
    ["taskDemandDigest", measurement.taskDemandDigest, cksTaskDemandDigestV1(candidates)],
    ["dependencyGraphDigest", measurement.dependencyGraphDigest, cksDependencyGraphDigestV1(candidates)],
    ["pathLeaseSetDigest", measurement.pathLeaseSetDigest, cksPathLeaseSetDigestV1(candidates)],
    ["workOrderBudgetDigest", measurement.workOrderBudgetDigest, cksWorkOrderBudgetDigestV1(budget)],
  ];
  for (const [field, actual, expected] of expectedBindings) {
    if (actual !== expected) {
      return denied("BINDING_DIGEST_MISMATCH", `request.measurement.${field}`);
    }
  }
  if (!bucketDigests.has(measurement.capacityBucketDigest)) {
    return denied("BINDING_DIGEST_MISMATCH", "request.measurement.capacityBucketDigest");
  }
  if (cksMeasurementDigestV1(measurement) !== measurement.measurementDigest) {
    return denied("MEASUREMENT_DIGEST_MISMATCH", "request.measurement.measurementDigest");
  }
  if (cksRequestDigestV1(request) !== request.requestDigest) {
    return denied("DIGEST_MISMATCH", "request.requestDigest");
  }

  if (
    measurement.observedAtMs > request.decisionAtMs
    || request.decisionAtMs >= measurement.expiresAtMs
    || measurement.observedAtMs >= measurement.expiresAtMs
  ) {
    return denied("STALE_MEASUREMENT", "request.decisionAtMs");
  }

  const dependencyLeases: LeaseOccurrence[] = [];
  const pathLeases: LeaseOccurrence[] = [];
  for (let i = 0; i < candidates.length; i += 1) {
    const candidate = candidates[i]!;
    for (const predecessor of candidate.predecessors) {
      if (
        predecessor.terminalOutcome !== "POSITIVE"
        || candidateIds.has(predecessor.predecessorId)
        || predecessor.predecessorId === candidate.candidateId
      ) {
        return denied(
          "DEPENDENCY_NOT_READY",
          `${candidate.candidateId}:${predecessor.predecessorId}`,
        );
      }
    }
    for (const lease of candidate.dependencyLeases) {
      dependencyLeases.push({
        candidateIndex: i,
        candidateId: candidate.candidateId,
        id: lease.dependencyId,
        mode: lease.mode,
      });
    }
    for (const lease of candidate.pathLeases) {
      pathLeases.push({
        candidateIndex: i,
        candidateId: candidate.candidateId,
        id: lease.resolvedPath,
        mode: lease.mode,
      });
    }
  }
  const leaseConflict = findDependencyLeaseConflict(dependencyLeases)
    ?? findPathLeaseConflict(pathLeases);
  if (leaseConflict !== undefined) return leaseConflict;

  let totalTokens = 0;
  let totalSequences = 0;
  for (const candidate of candidates) {
    const inputDemand = safeSum([
      candidate.demand.inputTokens,
      candidate.demand.toolSchemaTokens,
    ]);
    const completeDemand = safeSum([
      candidate.demand.inputTokens,
      candidate.demand.toolSchemaTokens,
      candidate.demand.maximumOutputTokens,
      candidate.demand.safetyReserveTokens,
    ]);
    if (
      inputDemand === undefined
      || completeDemand === undefined
      || inputDemand > measurement.maximumInputTokens
      || candidate.demand.maximumOutputTokens > measurement.maximumOutputTokens
      || completeDemand > measurement.contextWindowTokens
    ) {
      return denied("CONTEXT_CAPACITY_VIOLATION", candidate.candidateId);
    }
    const nextTotalTokens = safeSum([totalTokens, completeDemand]);
    const nextTotalSequences = safeSum([totalSequences, candidate.demand.concurrentSequences]);
    if (nextTotalTokens === undefined || nextTotalSequences === undefined) {
      return denied("KV_CAPACITY_VIOLATION", "aggregateDemandOverflow");
    }
    totalTokens = nextTotalTokens;
    totalSequences = nextTotalSequences;
  }

  const smallestFittingBucket = buckets.find(
    (bucket) => bucket.maximumTotalTokens >= totalTokens
      && bucket.maximumConcurrentSequences >= totalSequences,
  );
  if (smallestFittingBucket === undefined) {
    return denied("KV_CAPACITY_VIOLATION", "noMeasuredCapacityBucket");
  }
  if (smallestFittingBucket.bucketDigest !== measurement.capacityBucketDigest) {
    return denied("CAPACITY_BUCKET_MISMATCH", "request.measurement.capacityBucketDigest");
  }
  const measuredResidentBytes = safeSum([
    smallestFittingBucket.measuredKvPeakBytes,
    smallestFittingBucket.residentModelAndRuntimePeakBytes,
  ]);
  if (
    measuredResidentBytes === undefined
    || measuredResidentBytes > smallestFittingBucket.reservableMeasuredBytes
  ) {
    return denied("KV_CAPACITY_VIOLATION", smallestFittingBucket.bucketId);
  }

  if (
    budget.reservedCalls < totalSequences
    || budget.reservedTokens < totalTokens
    || budget.reservedResidentBytes < measuredResidentBytes
    || budget.reservedCalls > budget.remainingCalls
    || budget.reservedTokens > budget.remainingTokens
    || budget.reservedCostMicros > budget.remainingCostMicros
    || budget.reservedElapsedMs > budget.remainingElapsedMs
    || budget.reservedResidentBytes > budget.remainingResidentBytes
  ) {
    return denied("BUDGET_VIOLATION", "request.budget");
  }

  return {
    outcome: "VALID",
    requestDigest: request.requestDigest,
    capacityBucketDigest: measurement.capacityBucketDigest,
    claimBoundary: CKS_RESOURCE_ADMISSION_CLAIM_BOUNDARY_V1,
  };
}