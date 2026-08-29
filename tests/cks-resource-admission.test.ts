import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import Ajv2020 from "ajv/dist/2020.js";
import {
  CKS_BUDGET_FIELDS_V1,
  CKS_CANDIDATE_FIELDS_V1,
  CKS_CAPACITY_BUCKET_FIELDS_V1,
  CKS_DEMAND_FIELDS_V1,
  CKS_DEPENDENCY_LEASE_FIELDS_V1,
  CKS_MEASUREMENT_FIELDS_V1,
  CKS_PATH_LEASE_FIELDS_V1,
  CKS_PREDECESSOR_FIELDS_V1,
  CKS_REQUEST_FIELDS_V1,
  CKS_RESOURCE_ADMISSION_CLAIM_BOUNDARY_V1,
  cksCapacityBucketDigestV1,
  cksDependencyGraphDigestV1,
  cksMeasurementDigestV1,
  cksPathLeaseSetDigestV1,
  cksPathResolutionDigestV1,
  cksRequestDigestV1,
  cksTaskDemandDigestV1,
  cksWorkOrderBudgetDigestV1,
  validateCksResourceAdmissionRequestV1,
  type CksMeasuredCapacityBucketV1,
  type CksPathLeaseV1,
  type CksResourceAdmissionCandidateV1,
  type CksResourceAdmissionDenialV1,
  type CksResourceAdmissionMeasurementV1,
  type CksResourceAdmissionRequestV1,
  type CksWorkOrderBudgetV1,
} from "../packages/contracts/src/cks-resource-admission.js";

const SCHEMA_PATH = "schemas/contracts/cks-resource-admission-v1.schema.json";
const FIXTURE_PATH = "tests/fixtures/cks-resource-admission/admission-cases-v1.json";

type Json = Record<string, unknown>;

const FIXTURE = JSON.parse(readFileSync(FIXTURE_PATH, "utf8")) as Json;
const SCHEMA = JSON.parse(readFileSync(SCHEMA_PATH, "utf8")) as Json;
const SCHEMA_VALIDATE = new Ajv2020({ strict: true, allErrors: true }).compile(SCHEMA);

function schemaValid(document: unknown): boolean {
  return SCHEMA_VALIDATE(document) === true;
}

function getCase(name: string): Json {
  const cases = FIXTURE.cases as Json[];
  const fixtureCase = cases.find((candidate) => candidate.name === name);
  if (fixtureCase === undefined) throw new Error(`fixture case not found: ${name}`);
  return structuredClone(fixtureCase.document as Json);
}

function setPath(document: Json, path: readonly string[], value: unknown): Json {
  const next = structuredClone(document);
  let node: unknown = next;
  for (let i = 0; i < path.length - 1; i += 1) {
    node = (node as Json)[path[i]!];
  }
  (node as Json)[path[path.length - 1]!] = value;
  return next;
}

function deletePath(document: Json, path: readonly string[]): Json {
  const next = structuredClone(document);
  let node: unknown = next;
  for (let i = 0; i < path.length - 1; i += 1) {
    node = (node as Json)[path[i]!];
  }
  delete (node as Json)[path[path.length - 1]!];
  return next;
}

function refreshEnvelopeDigests(document: Json): void {
  const measurement = document.measurement as Json;
  measurement.measurementDigest = cksMeasurementDigestV1(
    measurement as unknown as CksResourceAdmissionMeasurementV1,
  );
  document.requestDigest = cksRequestDigestV1(
    document as unknown as CksResourceAdmissionRequestV1,
  );
}

/** Recompute every internal binding after constructing a semantic test case. */
function withDigests(document: Json): Json {
  const next = structuredClone(document);
  const candidates = next.candidates as Json[];
  for (const candidate of candidates) {
    for (const rawLease of candidate.pathLeases as Json[]) {
      rawLease.resolutionDigest = cksPathResolutionDigestV1(
        rawLease as unknown as CksPathLeaseV1,
      );
    }
  }

  const measurement = next.measurement as Json;
  const rawBuckets = measurement.capacityBuckets as Json[];
  for (const rawBucket of rawBuckets) {
    rawBucket.bucketDigest = cksCapacityBucketDigestV1(
      rawBucket as unknown as CksMeasuredCapacityBucketV1,
    );
  }

  const typedCandidates = candidates as unknown as CksResourceAdmissionCandidateV1[];
  measurement.taskDemandDigest = cksTaskDemandDigestV1(typedCandidates);
  measurement.dependencyGraphDigest = cksDependencyGraphDigestV1(typedCandidates);
  measurement.pathLeaseSetDigest = cksPathLeaseSetDigestV1(typedCandidates);
  measurement.workOrderBudgetDigest = cksWorkOrderBudgetDigestV1(
    next.budget as unknown as CksWorkOrderBudgetV1,
  );

  const totalTokens = typedCandidates.reduce(
    (total, candidate) => total
      + candidate.demand.inputTokens
      + candidate.demand.toolSchemaTokens
      + candidate.demand.maximumOutputTokens
      + candidate.demand.safetyReserveTokens,
    0,
  );
  const totalSequences = typedCandidates.reduce(
    (total, candidate) => total + candidate.demand.concurrentSequences,
    0,
  );
  const buckets = rawBuckets as unknown as CksMeasuredCapacityBucketV1[];
  const selected = buckets.find(
    (bucket) => bucket.maximumTotalTokens >= totalTokens
      && bucket.maximumConcurrentSequences >= totalSequences,
  ) ?? buckets[buckets.length - 1]!;
  measurement.capacityBucketDigest = selected.bucketDigest;
  refreshEnvelopeDigests(next);
  return next;
}

function expectDenied(input: unknown, reason: CksResourceAdmissionDenialV1): void {
  const result = validateCksResourceAdmissionRequestV1(input);
  assert.equal(
    result.outcome,
    "DENIED",
    `expected DENIED(${reason}); got ${JSON.stringify(result)}`,
  );
  if (result.outcome === "DENIED") assert.equal(result.reason, reason);
}

test("positive fixtures are schema-valid, digest-bound advisory admissions", () => {
  const cases = FIXTURE.cases as Json[];
  assert.equal(cases.length, 2);
  for (const fixtureCase of cases) {
    const document = fixtureCase.document as Json;
    assert.equal(
      schemaValid(document),
      true,
      `${String(fixtureCase.name)}: ${JSON.stringify(SCHEMA_VALIDATE.errors)}`,
    );
    const result = validateCksResourceAdmissionRequestV1(document);
    assert.equal(result.outcome, "VALID", String(fixtureCase.name));
    if (result.outcome === "VALID") {
      assert.equal(result.claimBoundary, CKS_RESOURCE_ADMISSION_CLAIM_BOUNDARY_V1);
      assert.equal(result.requestDigest, document.requestDigest);
      assert.equal(
        result.capacityBucketDigest,
        (document.measurement as Json).capacityBucketDigest,
      );
    }
  }
});

test("fixture digests independently recompute at every binding layer", () => {
  for (const fixtureCase of FIXTURE.cases as Json[]) {
    const document = fixtureCase.document as Json;
    const measurement = document.measurement as unknown as CksResourceAdmissionMeasurementV1;
    const candidates = document.candidates as CksResourceAdmissionCandidateV1[];
    const budget = document.budget as unknown as CksWorkOrderBudgetV1;
    for (const bucket of measurement.capacityBuckets) {
      assert.equal(bucket.bucketDigest, cksCapacityBucketDigestV1(bucket));
    }
    for (const candidate of candidates) {
      for (const lease of candidate.pathLeases) {
        assert.equal(lease.resolutionDigest, cksPathResolutionDigestV1(lease));
      }
    }
    assert.equal(measurement.taskDemandDigest, cksTaskDemandDigestV1(candidates));
    assert.equal(measurement.dependencyGraphDigest, cksDependencyGraphDigestV1(candidates));
    assert.equal(measurement.pathLeaseSetDigest, cksPathLeaseSetDigestV1(candidates));
    assert.equal(measurement.workOrderBudgetDigest, cksWorkOrderBudgetDigestV1(budget));
    assert.equal(measurement.measurementDigest, cksMeasurementDigestV1(measurement));
    assert.equal(
      document.requestDigest,
      cksRequestDigestV1(document as unknown as CksResourceAdmissionRequestV1),
    );
  }
});

test("validation is pure, deterministic, and does not declare an execution effect", () => {
  const document = getCase("parallel-admission-valid");
  const before = structuredClone(document);
  const first = validateCksResourceAdmissionRequestV1(document);
  const second = validateCksResourceAdmissionRequestV1(document);
  assert.deepEqual(first, second);
  assert.deepEqual(document, before);
  assert.equal(first.outcome, "VALID");
  assert.equal("leaseAcquired" in first, false);
  assert.equal("executed" in first, false);
  assert.equal("authority" in first, false);
});

test("measurement must be contemporaneous with the explicit decision instant", () => {
  const document = getCase("parallel-admission-valid");
  const measurement = document.measurement as Json;

  const atObservation = withDigests(setPath(
    document,
    ["decisionAtMs"],
    measurement.observedAtMs,
  ));
  assert.equal(validateCksResourceAdmissionRequestV1(atObservation).outcome, "VALID");

  const expired = withDigests(setPath(
    document,
    ["decisionAtMs"],
    measurement.expiresAtMs,
  ));
  expectDenied(expired, "STALE_MEASUREMENT");

  const futureObservation = withDigests(setPath(
    document,
    ["decisionAtMs"],
    (measurement.observedAtMs as number) - 1,
  ));
  expectDenied(futureObservation, "STALE_MEASUREMENT");

  const invertedWindow = setPath(
    document,
    ["measurement", "expiresAtMs"],
    measurement.observedAtMs,
  );
  expectDenied(withDigests(invertedWindow), "STALE_MEASUREMENT");
});

test("every predecessor requires a positive digest-bound terminal receipt", () => {
  const document = getCase("parallel-admission-valid");
  expectDenied(
    withDigests(setPath(
      document,
      ["candidates", "0", "predecessors", "0", "terminalOutcome"],
      "UNKNOWN",
    )),
    "DEPENDENCY_NOT_READY",
  );
  expectDenied(
    withDigests(setPath(
      document,
      ["candidates", "0", "predecessors", "0", "terminalOutcome"],
      "DENIED",
    )),
    "DEPENDENCY_NOT_READY",
  );
  expectDenied(
    withDigests(setPath(
      document,
      ["candidates", "0", "predecessors", "0", "predecessorId"],
      "candidate-b",
    )),
    "DEPENDENCY_NOT_READY",
  );

  const unboundMutation = setPath(
    document,
    ["candidates", "0", "predecessors", "0", "terminalReceiptDigest"],
    "c".repeat(64),
  );
  expectDenied(unboundMutation, "BINDING_DIGEST_MISMATCH");
});

test("dependency READ leases may overlap, but either WRITE conflicts", () => {
  const document = getCase("parallel-admission-valid");
  assert.equal(validateCksResourceAdmissionRequestV1(document).outcome, "VALID");

  const writeRead = setPath(
    document,
    ["candidates", "1", "dependencyLeases", "0", "mode"],
    "WRITE",
  );
  expectDenied(withDigests(writeRead), "LEASE_CONFLICT");

  const writeWrite = setPath(
    document,
    ["candidates", "1", "dependencyLeases", "1", "dependencyId"],
    "eval-a",
  );
  expectDenied(withDigests(writeWrite), "LEASE_CONFLICT");
});

test("path conflicts use normalized resolved prefix overlap, not exact strings only", () => {
  const document = getCase("parallel-admission-valid");
  // The fixture has READ on packages/contracts and its descendant; READ/READ is permitted.
  assert.equal(validateCksResourceAdmissionRequestV1(document).outcome, "VALID");

  const prefixWrite = setPath(
    document,
    ["candidates", "1", "pathLeases", "1", "mode"],
    "WRITE",
  );
  expectDenied(withDigests(prefixWrite), "LEASE_CONFLICT");

  // A distinct declared symlink alias still conflicts through its resolved path.
  const aliasedWrite = setPath(
    setPath(
      prefixWrite,
      ["candidates", "1", "pathLeases", "1", "path"],
      "aliases/contracts-source",
    ),
    ["candidates", "1", "pathLeases", "1", "resolvedPath"],
    "packages/contracts/src/cks-resource-admission.ts",
  );
  expectDenied(withDigests(aliasedWrite), "LEASE_CONFLICT");

  const exactReadOverlap = setPath(
    setPath(
      document,
      ["candidates", "1", "pathLeases", "1", "path"],
      "packages/contracts",
    ),
    ["candidates", "1", "pathLeases", "1", "resolvedPath"],
    "packages/contracts",
  );
  assert.equal(validateCksResourceAdmissionRequestV1(withDigests(exactReadOverlap)).outcome, "VALID");
});

test("absolute, escaping, non-normalized, duplicate, or unbound resolved paths fail closed", () => {
  const document = getCase("parallel-admission-valid");
  for (const invalidPath of ["/absolute", "../escape", "a/../b", "a//b", "a\\b"] as const) {
    expectDenied(
      setPath(document, ["candidates", "0", "pathLeases", "0", "path"], invalidPath),
      "MALFORMED_VALUE",
    );
  }
  expectDenied(
    deletePath(document, ["candidates", "0", "pathLeases", "0", "resolvedPath"]),
    "MISSING_FIELD",
  );
  expectDenied(
    setPath(
      document,
      ["candidates", "0", "pathLeases", "1", "resolvedPath"],
      "workspaces/candidate-a",
    ),
    "MALFORMED_VALUE",
  );
  expectDenied(
    setPath(
      document,
      ["candidates", "0", "pathLeases", "0", "resolutionDigest"],
      "0".repeat(64),
    ),
    "BINDING_DIGEST_MISMATCH",
  );
});

test("complete context demand obeys window and input/output sublimits", () => {
  const exact = getCase("exact-context-and-measured-bucket-fit-valid");
  assert.equal(validateCksResourceAdmissionRequestV1(exact).outcome, "VALID");

  const inputExceeded = setPath(
    getCase("parallel-admission-valid"),
    ["candidates", "0", "demand", "inputTokens"],
    97000,
  );
  expectDenied(withDigests(inputExceeded), "CONTEXT_CAPACITY_VIOLATION");

  const outputExceeded = setPath(
    getCase("parallel-admission-valid"),
    ["candidates", "0", "demand", "maximumOutputTokens"],
    32769,
  );
  expectDenied(withDigests(outputExceeded), "CONTEXT_CAPACITY_VIOLATION");

  let completeExceeded = getCase("parallel-admission-valid");
  completeExceeded = setPath(completeExceeded, ["candidates", "0", "demand", "inputTokens"], 98304);
  completeExceeded = setPath(completeExceeded, ["candidates", "0", "demand", "toolSchemaTokens"], 0);
  completeExceeded = setPath(completeExceeded, ["candidates", "0", "demand", "maximumOutputTokens"], 32768);
  completeExceeded = setPath(completeExceeded, ["candidates", "0", "demand", "safetyReserveTokens"], 1);
  expectDenied(withDigests(completeExceeded), "CONTEXT_CAPACITY_VIOLATION");
});

test("aggregate tokens and sequences require a measured bucket with fitting KV memory", () => {
  const document = getCase("parallel-admission-valid");
  const result = validateCksResourceAdmissionRequestV1(document);
  assert.equal(result.outcome, "VALID");
  if (result.outcome === "VALID") {
    assert.equal(
      result.capacityBucketDigest,
      ((document.measurement as Json).capacityBuckets as Json[])[1]!.bucketDigest,
      "the first measured fitting tier must be selected",
    );
  }

  let noMeasuredBucket = setPath(
    document,
    ["candidates", "0", "demand", "concurrentSequences"],
    3,
  );
  noMeasuredBucket = setPath(
    noMeasuredBucket,
    ["candidates", "1", "demand", "concurrentSequences"],
    3,
  );
  expectDenied(withDigests(noMeasuredBucket), "KV_CAPACITY_VIOLATION");

  const insufficientMeasuredMemory = setPath(
    document,
    ["measurement", "capacityBuckets", "1", "reservableMeasuredBytes"],
    6999,
  );
  expectDenied(withDigests(insufficientMeasuredMemory), "KV_CAPACITY_VIOLATION");

  const wrongTier = withDigests(document);
  const wrongMeasurement = wrongTier.measurement as Json;
  wrongMeasurement.capacityBucketDigest = (
    (wrongMeasurement.capacityBuckets as Json[])[2] as Json
  ).bucketDigest;
  refreshEnvelopeDigests(wrongTier);
  expectDenied(wrongTier, "CAPACITY_BUCKET_MISMATCH");
});

test("budget reservations are bound and checked atomically with measured capacity", () => {
  const document = getCase("parallel-admission-valid");
  expectDenied(
    withDigests(setPath(document, ["budget", "reservedTokens"], 114623)),
    "BUDGET_VIOLATION",
  );
  expectDenied(
    withDigests(setPath(document, ["budget", "remainingCalls"], 1)),
    "BUDGET_VIOLATION",
  );
  expectDenied(
    withDigests(setPath(document, ["budget", "reservedResidentBytes"], 6999)),
    "BUDGET_VIOLATION",
  );
  expectDenied(
    setPath(document, ["budget", "reservedElapsedMs"], 0),
    "MALFORMED_VALUE",
  );
});

test("canonical lineage drift is denied before semantic admission", () => {
  const document = getCase("parallel-admission-valid");
  expectDenied(
    setPath(document, ["candidates", "0", "demand", "inputTokens"], 40001),
    "BINDING_DIGEST_MISMATCH",
  );
  expectDenied(
    setPath(document, ["candidates", "0", "dependencyLeases", "0", "mode"], "WRITE"),
    "BINDING_DIGEST_MISMATCH",
  );
  expectDenied(
    setPath(document, ["budget", "reservedCostMicros"], 1001),
    "BINDING_DIGEST_MISMATCH",
  );
  expectDenied(
    setPath(document, ["measurement", "capacityBuckets", "1", "measuredKvPeakBytes"], 3001),
    "BINDING_DIGEST_MISMATCH",
  );
  expectDenied(
    setPath(document, ["measurement", "exactProfileDigest"], "6".repeat(64)),
    "MEASUREMENT_DIGEST_MISMATCH",
  );
  expectDenied(
    setPath(document, ["decisionAtMs"], 1800000000101),
    "DIGEST_MISMATCH",
  );
  expectDenied(
    setPath(document, ["requestDigest"], "f".repeat(64)),
    "DIGEST_MISMATCH",
  );
});

test("unknown, missing, malformed, duplicate, and unbounded values deny", () => {
  const document = getCase("parallel-admission-valid");
  expectDenied({ ...document, priority: 1 }, "UNKNOWN_FIELD");
  expectDenied(setPath(document, ["measurement", "source"], "nominal"), "UNKNOWN_FIELD");
  expectDenied(setPath(document, ["candidates", "0", "demand", "estimate"], true), "UNKNOWN_FIELD");
  expectDenied(deletePath(document, ["requestDigest"]), "MISSING_FIELD");
  expectDenied(deletePath(document, ["measurement", "observedAtMs"]), "MISSING_FIELD");
  expectDenied(deletePath(document, ["candidates", "0", "demand", "safetyReserveTokens"]), "MISSING_FIELD");
  expectDenied(setPath(document, ["decisionAtMs"], -1), "MALFORMED_VALUE");
  expectDenied(setPath(document, ["requestDigest"], "A".repeat(64)), "MALFORMED_VALUE");
  expectDenied(setPath(document, ["candidates"], []), "MALFORMED_VALUE");
  expectDenied(setPath(document, ["candidates", "1", "candidateId"], "candidate-a"), "MALFORMED_VALUE");
  expectDenied(setPath(document, ["candidates", "0", "demand", "concurrentSequences"], 0), "MALFORMED_VALUE");
  expectDenied(setPath(document, ["measurement", "capacityBuckets", "1", "ordinal"], 7), "MALFORMED_VALUE");
  expectDenied(
    setPath(document, ["candidates", "0", "dependencyLeases", "1", "dependencyId"], "model-runtime"),
    "MALFORMED_VALUE",
  );
  expectDenied(
    setPath(document, ["candidates", "0", "predecessors", "0", "terminalOutcome"], "PENDING"),
    "MALFORMED_VALUE",
  );
});

test("closed schema rejects non-contract values at every nested level", () => {
  const document = getCase("parallel-admission-valid");
  const rejected = [
    { ...document, extra: true },
    setPath(document, ["measurement", "nominalCapacity"], 999999),
    setPath(document, ["budget", "overcommit"], true),
    setPath(document, ["candidates", "0", "priority"], 1),
    setPath(document, ["candidates", "0", "predecessors", "0", "ttl"], 30),
    setPath(document, ["candidates", "0", "dependencyLeases", "0", "mode"], "SHARED"),
    setPath(document, ["candidates", "0", "pathLeases", "0", "path"], "../escape"),
    setPath(document, ["candidates", "0", "demand", "inputTokens"], 1.5),
    setPath(document, ["measurement", "capacityBuckets", "0", "maximumTotalTokens"], 0),
  ];
  for (const invalid of rejected) assert.equal(schemaValid(invalid), false);
});

test("runtime and JSON Schema freeze the same required field inventory", () => {
  const defs = SCHEMA.$defs as Json;
  const required = (name: string): string[] => [
    ...(((defs[name] as Json).required as string[])),
  ].sort();
  assert.deepEqual([...(SCHEMA.required as string[])].sort(), [...CKS_REQUEST_FIELDS_V1].sort());
  assert.deepEqual(required("measurement"), [...CKS_MEASUREMENT_FIELDS_V1].sort());
  assert.deepEqual(required("budget"), [...CKS_BUDGET_FIELDS_V1].sort());
  assert.deepEqual(required("capacityBucket"), [...CKS_CAPACITY_BUCKET_FIELDS_V1].sort());
  assert.deepEqual(required("candidate"), [...CKS_CANDIDATE_FIELDS_V1].sort());
  assert.deepEqual(required("demand"), [...CKS_DEMAND_FIELDS_V1].sort());
  assert.deepEqual(required("predecessor"), [...CKS_PREDECESSOR_FIELDS_V1].sort());
  assert.deepEqual(required("dependencyLease"), [...CKS_DEPENDENCY_LEASE_FIELDS_V1].sort());
  assert.deepEqual(required("pathLease"), [...CKS_PATH_LEASE_FIELDS_V1].sort());
});