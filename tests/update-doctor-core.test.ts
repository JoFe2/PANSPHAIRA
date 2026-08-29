import assert from "node:assert/strict";
import test from "node:test";
import {
  DOCTOR_FIXTURE_OBSERVATION_SCHEMA_V1,
  renderPublicDoctorReportV1,
  runFixtureDoctorV1,
  updateDoctorContractDigest,
  type DoctorFixtureObservationV1,
  type DoctorProbeIdV1,
} from "../packages/contracts/src/index.js";

const DIGEST_A = "a".repeat(64);

const PROBES: readonly DoctorProbeIdV1[] = [
  "cm:doctor-installation",
  "cm:doctor-runtime",
  "cm:doctor-configuration",
  "cm:doctor-version-lock",
  "cm:doctor-health-readback",
  "cm:doctor-storage",
  "cm:doctor-permissions",
  "cm:doctor-secrets-metadata",
  "cm:doctor-clock",
  "cm:doctor-database-schema",
  "cm:doctor-packs",
  "cm:doctor-receipts",
];

function fixture(): DoctorFixtureObservationV1 {
  return {
    schemaVersion: DOCTOR_FIXTURE_OBSERVATION_SCHEMA_V1,
    observedLockDigest: DIGEST_A,
    mutationCount: 0,
    probes: PROBES.map((checkId) => ({
      checkId,
      outcome: "MATCH",
      durationMs: 1,
      privateObservation: {
        path: ["", "private", "operator", "config.json"].join("/"),
        address: "192.0.2.10",
        error: "arbitrary adapter exception",
        credential: "canary-secret-value",
      },
    })),
  };
}

function run(input: DoctorFixtureObservationV1, profile: "QUICK" | "STANDARD" = "QUICK") {
  return runFixtureDoctorV1({
    reportId: "cm:doctor-report-001",
    profile,
    expectedLockDigest: DIGEST_A,
    generatedAtMs: 1_786_054_320_000,
    timeoutMs: 10,
    fixture: input,
  });
}

test("UD-002 quick profile is deterministic, read-only, digest-bound, and public-safe", () => {
  const input = fixture();
  const before = structuredClone(input);
  const first = run(input);
  const second = run(structuredClone(input));

  assert.deepEqual(input, before);
  assert.deepEqual(first, second);
  assert.equal(first.readOnly, true);
  assert.equal(first.checks.length, 5);
  assert.ok(first.checks.every((check) => check.status === "PASS"));
  assert.equal(
    updateDoctorContractDigest(first as unknown as Record<string, unknown>, "reportDigest"),
    first.reportDigest,
  );
  const publicJson = renderPublicDoctorReportV1(first);
  assert.doesNotMatch(publicJson, /canary-secret-value|192\.0\.2\.10|private\/operator|arbitrary adapter/i);
});

test("UD-002 standard profile has stable order across fixture reorderings", () => {
  const input = fixture();
  const reversed = { ...input, probes: [...input.probes].reverse() };
  const first = run(input, "STANDARD");
  const second = run(reversed, "STANDARD");
  assert.equal(first.checks.length, 12);
  assert.deepEqual(first, second);
  assert.deepEqual(first.checks.map(({ checkId }) => checkId), PROBES);
});

test("UD-002 standard public projection stays allow-listed and redacted", () => {
  const report = run(fixture(), "STANDARD");
  const publicValue = JSON.parse(renderPublicDoctorReportV1(report)) as Record<string, unknown>;
  assert.deepEqual(Object.keys(publicValue).sort(), [
    "checks",
    "generatedAtMs",
    "observedLockDigest",
    "profile",
    "readOnly",
    "reportDigest",
    "reportId",
    "schemaVersion",
  ]);
  assert.equal(publicValue.profile, "STANDARD");
  assert.equal(publicValue.readOnly, true);
  assert.equal("action" in publicValue, false);
  assert.equal("privateObservation" in publicValue, false);
  assert.doesNotMatch(JSON.stringify(publicValue), /canary-secret-value|192\.0\.2\.10|private\/operator|arbitrary adapter/i);
});

test("UD-002 converts timeout, unavailable, and lock drift into typed fail-closed findings", () => {
  const input = fixture();
  const probes = input.probes.map((probe) => {
    if (probe.checkId === "cm:doctor-runtime") return { ...probe, durationMs: 11 };
    if (probe.checkId === "cm:doctor-configuration") return { ...probe, outcome: "UNAVAILABLE" as const };
    return probe;
  });
  const report = run({ ...input, observedLockDigest: "b".repeat(64), probes });
  assert.deepEqual(report.checks.slice(1, 4), [
    { checkId: "cm:doctor-runtime", status: "NOT_OBSERVED", reasonCode: "OBSERVATION_UNAVAILABLE" },
    { checkId: "cm:doctor-configuration", status: "NOT_OBSERVED", reasonCode: "OBSERVATION_UNAVAILABLE" },
    { checkId: "cm:doctor-version-lock", status: "FAIL", reasonCode: "OBSERVATION_MISMATCH" },
  ]);
});

test("UD-002 rejects mutation claims, duplicate probes, unknown fields, and digest-tampered exports", () => {
  const input = fixture();
  assert.throws(() => runFixtureDoctorV1({
    reportId: "cm:doctor-report-001",
    profile: "QUICK",
    expectedLockDigest: DIGEST_A,
    generatedAtMs: 1,
    timeoutMs: 10,
    fixture: { ...input, mutationCount: 1 } as unknown as DoctorFixtureObservationV1,
  }), /INVALID_READ_ONLY_DOCTOR_FIXTURE/);
  assert.throws(() => run({ ...input, probes: [...input.probes, input.probes[0]!] }), /INVALID_READ_ONLY_DOCTOR_FIXTURE/);
  assert.throws(() => run({ ...input, unexpected: true } as unknown as DoctorFixtureObservationV1), /INVALID_READ_ONLY_DOCTOR_FIXTURE/);
  assert.throws(() => renderPublicDoctorReportV1({ ...run(input), reportDigest: "0".repeat(64) }),
    /UNSAFE_OR_INVALID_DOCTOR_REPORT/);
});

function redigest(report: ReturnType<typeof run>, patch: Record<string, unknown>): ReturnType<typeof run> {
  const unsigned = { ...report, ...patch } as Record<string, unknown>;
  return {
    ...unsigned,
    reportDigest: updateDoctorContractDigest(unsigned, "reportDigest"),
  } as ReturnType<typeof run>;
}

test("UD-002 public projection is closed, profile-complete, contradiction-free, and identity-redacted", () => {
  const report = run(fixture());
  const publicValue = JSON.parse(renderPublicDoctorReportV1(report)) as Record<string, unknown>;
  assert.deepEqual(Object.keys(publicValue).sort(), [
    "checks",
    "generatedAtMs",
    "observedLockDigest",
    "profile",
    "readOnly",
    "reportDigest",
    "reportId",
    "schemaVersion",
  ]);
  assert.equal("action" in publicValue, false);
  assert.equal("privateObservation" in publicValue, false);
  assert.equal(Object.isFrozen(report), true);
  assert.equal(Object.isFrozen(report.checks), true);

  assert.throws(
    () => renderPublicDoctorReportV1(redigest(report, { reportId: "user:alice" })),
    /UNSAFE_OR_INVALID_DOCTOR_REPORT/,
  );
  assert.throws(
    () => renderPublicDoctorReportV1(redigest(report, {
      checks: [{ ...report.checks[0]!, status: "PASS", reasonCode: "OBSERVATION_MISMATCH" }, ...report.checks.slice(1)],
    })),
    /UNSAFE_OR_INVALID_DOCTOR_REPORT/,
  );
  assert.throws(
    () => renderPublicDoctorReportV1({ ...report, action: "RUN" }),
    /UNSAFE_OR_INVALID_DOCTOR_REPORT/,
  );
  assert.throws(
    () =>
      renderPublicDoctorReportV1({
        ...report,
        privatePath: ["", "home", "alice", ".config", "cm", "state.json"].join("/"),
      }),
    /UNSAFE_OR_INVALID_DOCTOR_REPORT/,
  );
});
