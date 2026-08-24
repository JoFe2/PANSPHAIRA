import assert from "node:assert/strict";
import test from "node:test";
import {
  MIGRATION_EDGE_POSTCONDITION_CODE_V1,
  MIGRATION_EDGE_PRECONDITION_CODE_V1,
  UPDATE_MIGRATION_EDGE_EXIT_CODES_V1,
  UPDATE_MIGRATION_EDGE_KEYS_V1,
  UPDATE_MIGRATION_EDGE_PLANNER_SCHEMA_V1,
  UPDATE_MIGRATION_EDGE_SCHEMA_V1,
  buildUpdateMigrationEdgeV1,
  parseUpdateMigrationEdgeV1,
  renderVerifiedUpdateMigrationEdgeV1,
  updateMigrationEdgeDigestV1,
  verifyUpdateMigrationEdgeV1,
  type BuildUpdateMigrationEdgeOptionsV1,
  type UpdateMigrationEdgeReasonCodeV1,
  type UpdateMigrationEdgeVerificationContextV1,
} from "../packages/contracts/src/update-migration-edge.js";

const MIGRATION_ID = "migration:schema-edge-001";
const MIGRATION_VERSION = "1.4.0";
const ORDINAL = 1;
const SOURCE_DIGEST = "a".repeat(64);
const TARGET_DIGEST = "b".repeat(64);
const ALIEN_DIGEST = "e".repeat(64);
const AUTHORITY_DIGEST = "c".repeat(64);
const PLANNER_ID = "planner:independent-planner";
const PLANNER_VERSION = "2.1.0";
const ISSUED_AT_MS = 1_785_841_200_000;
const PLANNER_SCHEMA = UPDATE_MIGRATION_EDGE_PLANNER_SCHEMA_V1;

function context(overrides: Record<string, unknown> = {}): UpdateMigrationEdgeVerificationContextV1 {
  const base: UpdateMigrationEdgeVerificationContextV1 = {
    expectedMigrationId: MIGRATION_ID,
    expectedMigrationVersion: MIGRATION_VERSION,
    expectedSourceTupleDigest: SOURCE_DIGEST,
    expectedTargetTupleDigest: TARGET_DIGEST,
    expectedRollbackTargetDigest: SOURCE_DIGEST,
    expectedAuthorityProfileDigest: AUTHORITY_DIGEST,
    expectedPreconditionCode: MIGRATION_EDGE_PRECONDITION_CODE_V1,
    expectedPostconditionCode: MIGRATION_EDGE_POSTCONDITION_CODE_V1,
    expectedPlanner: { plannerId: PLANNER_ID, plannerVersion: PLANNER_VERSION },
    expectedOrdinal: ORDINAL,
  };
  return Object.assign({}, base, overrides) as UpdateMigrationEdgeVerificationContextV1;
}

function plannerOf(version: string): Record<string, unknown> {
  return { schemaVersion: PLANNER_SCHEMA, plannerId: PLANNER_ID, plannerVersion: version };
}

function rawEdge(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  const edge: Record<string, unknown> = {
    schemaVersion: UPDATE_MIGRATION_EDGE_SCHEMA_V1,
    migrationId: MIGRATION_ID,
    migrationVersion: MIGRATION_VERSION,
    ordinal: ORDINAL,
    sourceTupleDigest: SOURCE_DIGEST,
    targetTupleDigest: TARGET_DIGEST,
    rollbackTargetDigest: SOURCE_DIGEST,
    preconditionCode: MIGRATION_EDGE_PRECONDITION_CODE_V1,
    postconditionCode: MIGRATION_EDGE_POSTCONDITION_CODE_V1,
    reversible: true,
    authorityProfileDigest: AUTHORITY_DIGEST,
    planner: { schemaVersion: PLANNER_SCHEMA, plannerId: PLANNER_ID, plannerVersion: PLANNER_VERSION },
    issuedAtMs: ISSUED_AT_MS,
    ...overrides,
  };
  edge.edgeDigest = updateMigrationEdgeDigestV1(edge);
  return edge;
}

test("a valid synthetic ordinal-1 edge is CHECKED with a bound edge digest", () => {
  const result = verifyUpdateMigrationEdgeV1(rawEdge(), context());
  assert.equal(result.outcome, "CHECKED");
  assert.deepEqual(result.reasonCodes, ["MIGRATION_EDGE_CHECKED"]);
  assert.equal(result.exitCode, 0);
  const edge = rawEdge();
  assert.equal(updateMigrationEdgeDigestV1(edge), edge.edgeDigest);
});

test("CHECKED metadata is deterministic and deeply frozen", () => {
  const first = verifyUpdateMigrationEdgeV1(rawEdge(), context());
  const second = verifyUpdateMigrationEdgeV1(rawEdge(), context());
  assert.deepEqual(first, second);
  assert.ok(Object.isFrozen(first));
  assert.ok(Object.isFrozen(first.reasonCodes));
  const bytesFirst = renderVerifiedUpdateMigrationEdgeV1(rawEdge(), context());
  const bytesSecond = renderVerifiedUpdateMigrationEdgeV1(rawEdge(), context());
  assert.equal(typeof bytesFirst, "string");
  assert.equal(bytesFirst, bytesSecond);
});

test("equivalent key ordering yields identical canonical edge bytes and digest", () => {
  const fields: ReadonlyArray<readonly [string, unknown]> = [
    ["schemaVersion", UPDATE_MIGRATION_EDGE_SCHEMA_V1],
    ["migrationId", MIGRATION_ID],
    ["migrationVersion", MIGRATION_VERSION],
    ["ordinal", ORDINAL],
    ["sourceTupleDigest", SOURCE_DIGEST],
    ["targetTupleDigest", TARGET_DIGEST],
    ["rollbackTargetDigest", SOURCE_DIGEST],
    ["preconditionCode", MIGRATION_EDGE_PRECONDITION_CODE_V1],
    ["postconditionCode", MIGRATION_EDGE_POSTCONDITION_CODE_V1],
    ["reversible", true],
    ["authorityProfileDigest", AUTHORITY_DIGEST],
    ["planner", { schemaVersion: PLANNER_SCHEMA, plannerId: PLANNER_ID, plannerVersion: PLANNER_VERSION }],
    ["issuedAtMs", ISSUED_AT_MS],
  ];
  const ascending: Record<string, unknown> = {};
  const descending: Record<string, unknown> = {};
  for (const [key, value] of fields) ascending[key] = value;
  for (let index = fields.length - 1; index >= 0; index -= 1) {
    const field = fields[index]!;
    descending[field[0]] = field[1];
  }
  ascending.edgeDigest = updateMigrationEdgeDigestV1(ascending);
  descending.edgeDigest = updateMigrationEdgeDigestV1(descending);
  assert.equal(ascending.edgeDigest, descending.edgeDigest);
  assert.equal(verifyUpdateMigrationEdgeV1(ascending, context()).outcome, "CHECKED");
  assert.equal(verifyUpdateMigrationEdgeV1(descending, context()).outcome, "CHECKED");
  const bytesAscending = renderVerifiedUpdateMigrationEdgeV1(ascending, context());
  const bytesDescending = renderVerifiedUpdateMigrationEdgeV1(descending, context());
  assert.equal(bytesAscending, bytesDescending);
});

test("the builder produces a frozen, self-consistent CHECKED edge", () => {
  const built = buildUpdateMigrationEdgeV1({
    migrationId: MIGRATION_ID,
    migrationVersion: MIGRATION_VERSION,
    ordinal: ORDINAL,
    sourceTupleDigest: SOURCE_DIGEST,
    targetTupleDigest: TARGET_DIGEST,
    authorityProfileDigest: AUTHORITY_DIGEST,
    planner: { plannerId: PLANNER_ID, plannerVersion: PLANNER_VERSION },
    issuedAtMs: ISSUED_AT_MS,
  });
  assert.ok(Object.isFrozen(built));
  assert.ok(Object.isFrozen(built.planner));
  assert.equal(built.reversible, true);
  assert.equal(built.rollbackTargetDigest, SOURCE_DIGEST);
  assert.equal(built.preconditionCode, MIGRATION_EDGE_PRECONDITION_CODE_V1);
  assert.equal(built.postconditionCode, MIGRATION_EDGE_POSTCONDITION_CODE_V1);
  assert.equal(updateMigrationEdgeDigestV1(built), built.edgeDigest);
  assert.equal(verifyUpdateMigrationEdgeV1(built, context()).outcome, "CHECKED");
  assert.equal(
    renderVerifiedUpdateMigrationEdgeV1(built, context()),
    renderVerifiedUpdateMigrationEdgeV1(rawEdge(), context()),
  );
});

test("the builder rejects malformed fixtures", () => {
  const options: BuildUpdateMigrationEdgeOptionsV1 = {
    migrationId: MIGRATION_ID,
    migrationVersion: MIGRATION_VERSION,
    ordinal: ORDINAL,
    sourceTupleDigest: SOURCE_DIGEST,
    targetTupleDigest: TARGET_DIGEST,
    authorityProfileDigest: AUTHORITY_DIGEST,
    planner: { plannerId: PLANNER_ID, plannerVersion: PLANNER_VERSION },
    issuedAtMs: ISSUED_AT_MS,
  };
  assert.throws(
    () => buildUpdateMigrationEdgeV1({ ...options, sourceTupleDigest: TARGET_DIGEST }),
    /INVALID_MIGRATION_EDGE_FIXTURE/,
  );
  const missingField: Record<string, unknown> = { ...options };
  delete missingField.issuedAtMs;
  assert.throws(
    () => buildUpdateMigrationEdgeV1(missingField as unknown as BuildUpdateMigrationEdgeOptionsV1),
    /INVALID_MIGRATION_EDGE_FIXTURE/,
  );
  assert.throws(
    () => buildUpdateMigrationEdgeV1({
      ...options,
      planner: { plannerId: PLANNER_ID, plannerVersion: PLANNER_VERSION, extra: "x" },
    } as BuildUpdateMigrationEdgeOptionsV1),
    /INVALID_MIGRATION_EDGE_FIXTURE/,
  );
});

interface DenialCase {
  readonly name: string;
  readonly edge?: Record<string, unknown>;
  readonly ctx?: UpdateMigrationEdgeVerificationContextV1;
  readonly reason: UpdateMigrationEdgeReasonCodeV1;
}

const DENIAL_CASES: readonly DenialCase[] = [
  {
    name: "self-loop",
    edge: rawEdge({ targetTupleDigest: SOURCE_DIGEST }),
    ctx: context({ expectedTargetTupleDigest: SOURCE_DIGEST }),
    reason: "SELF_LOOP_DENIED",
  },
  { name: "zero ordinal", edge: rawEdge({ ordinal: 0 }), reason: "ORDINAL_RANGE_DENIED" },
  { name: "negative-zero ordinal", edge: (() => { const edge = rawEdge(); edge.ordinal = -0; return edge; })(), reason: "SCHEMA_DENIED" },
  { name: "negative-zero issuedAtMs", edge: (() => { const edge = rawEdge(); edge.issuedAtMs = -0; return edge; })(), reason: "SCHEMA_DENIED" },
  { name: "ordinal gap", edge: rawEdge({ ordinal: 2 }), reason: "ORDINAL_GAP_DENIED" },
  {
    name: "source digest mismatch",
    edge: rawEdge({ sourceTupleDigest: ALIEN_DIGEST, rollbackTargetDigest: ALIEN_DIGEST }),
    ctx: context({ expectedRollbackTargetDigest: ALIEN_DIGEST }),
    reason: "TUPLE_MISMATCH_DENIED",
  },
  { name: "target digest mismatch", edge: rawEdge({ targetTupleDigest: ALIEN_DIGEST }), reason: "TUPLE_MISMATCH_DENIED" },
  { name: "rollback mismatch", edge: rawEdge({ rollbackTargetDigest: ALIEN_DIGEST }), reason: "ROLLBACK_MISMATCH_DENIED" },
  { name: "authority drift", edge: rawEdge({ authorityProfileDigest: ALIEN_DIGEST }), reason: "AUTHORITY_DRIFT_DENIED" },
  {
    name: "postcondition mismatch",
    ctx: context({ expectedPostconditionCode: "FORGED_POSTCONDITION" }),
    reason: "CONDITION_MISMATCH_DENIED",
  },
  { name: "missing reversibility", edge: rawEdge({ reversible: false }), reason: "REVERSIBILITY_DENIED" },
  {
    name: "unknown secret field",
    edge: (() => { const edge = rawEdge(); edge.secret = "value"; return edge; })(),
    reason: "SCHEMA_DENIED",
  },
  {
    name: "unknown execution-plan field",
    edge: (() => { const edge = rawEdge(); edge.executionPlan = { steps: [] }; return edge; })(),
    reason: "SCHEMA_DENIED",
  },
  {
    name: "unknown promotion claim field",
    edge: (() => { const edge = rawEdge(); edge.promote = true; return edge; })(),
    reason: "SCHEMA_DENIED",
  },
  {
    name: "unknown checkpoint field",
    edge: (() => { const edge = rawEdge(); edge.checkpoint = "packages/schemas"; return edge; })(),
    reason: "SCHEMA_DENIED",
  },
  {
    name: "unknown callback-url field",
    edge: (() => { const edge = rawEdge(); edge.callbackUrl = "https://example.invalid/callback"; return edge; })(),
    reason: "SCHEMA_DENIED",
  },
  {
    name: "unknown path field",
    edge: (() => { const edge = rawEdge(); edge.targetPath = "/etc/passwd"; return edge; })(),
    reason: "SCHEMA_DENIED",
  },
  {
    name: "missing key",
    edge: (() => { const edge = rawEdge(); delete edge.reversible; return edge; })(),
    reason: "SCHEMA_DENIED",
  },
  {
    name: "unsafe ordinal",
    edge: (() => { const edge = rawEdge(); edge.ordinal = 2 ** 53 + 1; return edge; })(),
    reason: "SCHEMA_DENIED",
  },
  {
    name: "digest drift",
    edge: (() => { const edge = rawEdge(); edge.edgeDigest = "0".repeat(64); return edge; })(),
    reason: "DIGEST_MISMATCH_DENIED",
  },
  {
    name: "unsupported edge contract version",
    edge: rawEdge({ schemaVersion: "chimpmaera.update/migration-edge/v2" }),
    reason: "UNSUPPORTED_CONTRACT_VERSION_DENIED",
  },
  {
    name: "unsupported planner contract version",
    edge: rawEdge({ planner: { schemaVersion: "chimpmaera.update/migration-edge-planner/v2", plannerId: PLANNER_ID, plannerVersion: PLANNER_VERSION } }),
    reason: "UNSUPPORTED_CONTRACT_VERSION_DENIED",
  },
  {
    name: "claim-bearing migration identifier",
    edge: rawEdge({ migrationId: "migration:execute-promotion" }),
    ctx: context({ expectedMigrationId: "migration:execute-promotion" }),
    reason: "MUTATION_CLAIM_DENIED",
  },
  {
    name: "planner not independent of migration",
    edge: rawEdge({
      migrationId: "migration:planner-001",
      planner: { schemaVersion: PLANNER_SCHEMA, plannerId: "planner:planner-001", plannerVersion: PLANNER_VERSION },
    }),
    ctx: context({ expectedMigrationId: "migration:planner-001", expectedPlanner: { plannerId: "planner:planner-001", plannerVersion: PLANNER_VERSION } }),
    reason: "PLANNER_INDEPENDENCE_DENIED",
  },
  {
    name: "leading-zero migration version",
    edge: rawEdge({ migrationVersion: "01.4.0" }),
    ctx: context({ expectedMigrationVersion: "01.4.0" }),
    reason: "SCHEMA_DENIED",
  },
  {
    name: "leading-zero planner version",
    edge: rawEdge({ planner: plannerOf("01.0.0") }),
    ctx: context({ expectedPlanner: { plannerId: PLANNER_ID, plannerVersion: "01.0.0" } }),
    reason: "SCHEMA_DENIED",
  },
  {
    name: "empty prerelease identifier",
    edge: rawEdge({ migrationVersion: "1.4.0-" }),
    ctx: context({ expectedMigrationVersion: "1.4.0-" }),
    reason: "SCHEMA_DENIED",
  },
  {
    name: "trailing prerelease separator",
    edge: rawEdge({ migrationVersion: "1.4.0-rc." }),
    ctx: context({ expectedMigrationVersion: "1.4.0-rc." }),
    reason: "SCHEMA_DENIED",
  },
  {
    name: "repeated prerelease separator",
    edge: rawEdge({ migrationVersion: "1.4.0-rc..1" }),
    ctx: context({ expectedMigrationVersion: "1.4.0-rc..1" }),
    reason: "SCHEMA_DENIED",
  },
  {
    name: "numeric prerelease leading zero",
    edge: rawEdge({ migrationVersion: "1.4.0-01" }),
    ctx: context({ expectedMigrationVersion: "1.4.0-01" }),
    reason: "SCHEMA_DENIED",
  },
  {
    name: "non-canonical migration version in independent context",
    ctx: context({ expectedMigrationVersion: "01.4.0" }),
    reason: "INDEPENDENT_CONTEXT_DENIED",
  },
  {
    name: "non-canonical planner version in independent context",
    ctx: context({ expectedPlanner: { plannerId: PLANNER_ID, plannerVersion: "01.0.0" } }),
    reason: "INDEPENDENT_CONTEXT_DENIED",
  },
  {
    name: "mutable migration version in independent context",
    edge: rawEdge({ migrationVersion: "1.0.0-latest" }),
    ctx: context({ expectedMigrationVersion: "1.0.0-latest" }),
    reason: "MUTABLE_VERSION_DENIED",
  },
  {
    name: "mutable planner version in independent context",
    edge: rawEdge({ planner: plannerOf("1.0.0-mutable") }),
    ctx: context({ expectedPlanner: { plannerId: PLANNER_ID, plannerVersion: "1.0.0-mutable" } }),
    reason: "MUTABLE_VERSION_DENIED",
  },
];

test("fail-closed denials bind a single exact reason and exit code", () => {
  for (const entry of DENIAL_CASES) {
    const result = verifyUpdateMigrationEdgeV1(entry.edge ?? rawEdge(), entry.ctx ?? context());
    assert.equal(result.outcome, "DENIED", entry.name);
    assert.deepEqual(result.reasonCodes, [entry.reason], entry.name);
    assert.equal(result.exitCode, UPDATE_MIGRATION_EDGE_EXIT_CODES_V1[entry.reason], entry.name);
  }
});

test("mutable/latest versions deny fail-closed", () => {
  const migration = verifyUpdateMigrationEdgeV1(
    rawEdge({ migrationVersion: "1.0.0-latest" }),
    context({ expectedMigrationVersion: "1.0.0-latest" }),
  );
  assert.deepEqual(migration.reasonCodes, ["MUTABLE_VERSION_DENIED"]);
  const planner = verifyUpdateMigrationEdgeV1(
    rawEdge({ planner: plannerOf("1.0.0-mutable") }),
    context({ expectedPlanner: { plannerId: PLANNER_ID, plannerVersion: "1.0.0-mutable" } }),
  );
  assert.deepEqual(planner.reasonCodes, ["MUTABLE_VERSION_DENIED"]);
  const bareLatest = verifyUpdateMigrationEdgeV1(rawEdge({ migrationVersion: "latest" }), context());
  assert.deepEqual(bareLatest.reasonCodes, ["SCHEMA_DENIED"]);
});

test("the measured fully-digested 01.4.0/01.0.0 non-canonical edge is denied before CHECKED", () => {
  const edge = rawEdge({ migrationVersion: "01.4.0", planner: plannerOf("01.0.0") });
  assert.equal(updateMigrationEdgeDigestV1(edge), edge.edgeDigest);
  const ctx = context({
    expectedMigrationVersion: "01.4.0",
    expectedPlanner: { plannerId: PLANNER_ID, plannerVersion: "01.0.0" },
  });
  const result = verifyUpdateMigrationEdgeV1(edge, ctx);
  assert.equal(result.outcome, "DENIED");
  assert.deepEqual(result.reasonCodes, ["SCHEMA_DENIED"]);
  assert.equal(result.exitCode, UPDATE_MIGRATION_EDGE_EXIT_CODES_V1.SCHEMA_DENIED);
  assert.throws(() => renderVerifiedUpdateMigrationEdgeV1(edge, ctx), /UNSAFE_OR_INVALID_MIGRATION_EDGE/);
});

test("canonical 0.0.0, 1.4.0 and 1.4.0-rc.1 versions retain stable edge digest and bytes", () => {
  const base: BuildUpdateMigrationEdgeOptionsV1 = {
    migrationId: MIGRATION_ID,
    migrationVersion: MIGRATION_VERSION,
    ordinal: ORDINAL,
    sourceTupleDigest: SOURCE_DIGEST,
    targetTupleDigest: TARGET_DIGEST,
    authorityProfileDigest: AUTHORITY_DIGEST,
    planner: { plannerId: PLANNER_ID, plannerVersion: PLANNER_VERSION },
    issuedAtMs: ISSUED_AT_MS,
  };
  for (const version of ["0.0.0", "1.4.0", "1.4.0-rc.1"]) {
    const options = { ...base, migrationVersion: version };
    const built = buildUpdateMigrationEdgeV1(options);
    const ctx = context({ expectedMigrationVersion: version });
    const result = verifyUpdateMigrationEdgeV1(built, ctx);
    assert.equal(result.outcome, "CHECKED", version);
    assert.deepEqual(result.reasonCodes, ["MIGRATION_EDGE_CHECKED"], version);
    assert.equal(result.exitCode, 0, version);
    assert.equal(updateMigrationEdgeDigestV1(built), built.edgeDigest, version);
    const first = renderVerifiedUpdateMigrationEdgeV1(built, ctx);
    const second = renderVerifiedUpdateMigrationEdgeV1(buildUpdateMigrationEdgeV1(options), ctx);
    assert.equal(first, second, version);
  }
});

test("the builder rejects non-canonical and mutable versions fail-closed", () => {
  const base: BuildUpdateMigrationEdgeOptionsV1 = {
    migrationId: MIGRATION_ID,
    migrationVersion: MIGRATION_VERSION,
    ordinal: ORDINAL,
    sourceTupleDigest: SOURCE_DIGEST,
    targetTupleDigest: TARGET_DIGEST,
    authorityProfileDigest: AUTHORITY_DIGEST,
    planner: { plannerId: PLANNER_ID, plannerVersion: PLANNER_VERSION },
    issuedAtMs: ISSUED_AT_MS,
  };
  for (const version of ["01.4.0", "1.04.0", "1.4.00", "1.4.0-", "1.4.0-rc.", "1.4.0-rc..1", "1.4.0-01"]) {
    assert.throws(
      () => buildUpdateMigrationEdgeV1({ ...base, migrationVersion: version }),
      /INVALID_MIGRATION_EDGE_FIXTURE/,
      `migration ${version}`,
    );
    assert.throws(
      () => buildUpdateMigrationEdgeV1({ ...base, planner: { plannerId: PLANNER_ID, plannerVersion: version } }),
      /INVALID_MIGRATION_EDGE_FIXTURE/,
      `planner ${version}`,
    );
  }
  for (const version of ["1.0.0-latest", "1.0.0-mutable"]) {
    assert.throws(
      () => buildUpdateMigrationEdgeV1({ ...base, migrationVersion: version }),
      /INVALID_MIGRATION_EDGE_FIXTURE/,
      `migration ${version}`,
    );
    assert.throws(
      () => buildUpdateMigrationEdgeV1({ ...base, planner: { plannerId: PLANNER_ID, plannerVersion: version } }),
      /INVALID_MIGRATION_EDGE_FIXTURE/,
      `planner ${version}`,
    );
  }
});

test("planner substitution with an unchanged digest denies fail-closed", () => {
  const edge = rawEdge();
  edge.planner = { schemaVersion: PLANNER_SCHEMA, plannerId: "planner:substituted-planner", plannerVersion: PLANNER_VERSION };
  const result = verifyUpdateMigrationEdgeV1(edge, context());
  assert.deepEqual(result.reasonCodes, ["DIGEST_MISMATCH_DENIED", "PLANNER_MISMATCH_DENIED"]);
});

test("fully re-digested forged envelopes deny fail-closed", () => {
  const forgedEdge = rawEdge({ targetTupleDigest: "d".repeat(64) });
  assert.equal(updateMigrationEdgeDigestV1(forgedEdge), forgedEdge.edgeDigest);
  const resultEdge = verifyUpdateMigrationEdgeV1(forgedEdge, context());
  assert.deepEqual(resultEdge.reasonCodes, ["TUPLE_MISMATCH_DENIED"]);
  const forgedPlanner = rawEdge({ planner: { schemaVersion: PLANNER_SCHEMA, plannerId: "planner:substituted-planner", plannerVersion: PLANNER_VERSION } });
  assert.equal(updateMigrationEdgeDigestV1(forgedPlanner), forgedPlanner.edgeDigest);
  const resultPlanner = verifyUpdateMigrationEdgeV1(forgedPlanner, context());
  assert.deepEqual(resultPlanner.reasonCodes, ["PLANNER_MISMATCH_DENIED"]);
});

test("the CHECKED projection contains no secret, path, free-text, URL, callback, execution, promotion or checkpoint material", () => {
  const bytes = renderVerifiedUpdateMigrationEdgeV1(rawEdge(), context());
  for (const forbidden of ["secret", "http", "/etc", "checkpoint", "promote", "execution", "callback", "free text"]) {
    assert.ok(!bytes.includes(forbidden), `projection must not contain ${forbidden}`);
  }
  const parsed = JSON.parse(bytes) as Record<string, unknown>;
  assert.deepEqual(Object.keys(parsed).sort(), [...UPDATE_MIGRATION_EDGE_KEYS_V1].sort());
  const planner = parsed.planner as Record<string, unknown>;
  assert.deepEqual(Object.keys(planner).sort(), ["plannerId", "plannerVersion", "schemaVersion"]);
});

test("unsupported contract versions and invalid JSON deny fail-closed through the parser", () => {
  const invalid = parseUpdateMigrationEdgeV1("{not-json", context());
  assert.deepEqual(invalid.reasonCodes, ["INVALID_JSON_DENIED"]);
  assert.equal(invalid.exitCode, UPDATE_MIGRATION_EDGE_EXIT_CODES_V1.INVALID_JSON_DENIED);
  const roundTrip = parseUpdateMigrationEdgeV1(JSON.stringify(rawEdge()), context());
  assert.equal(roundTrip.outcome, "CHECKED");
});

test("missing or malformed independent context denies fail-closed", () => {
  const missing = verifyUpdateMigrationEdgeV1(rawEdge(), undefined);
  assert.deepEqual(missing.reasonCodes, ["INDEPENDENT_CONTEXT_DENIED"]);
  const malformed = verifyUpdateMigrationEdgeV1(rawEdge(), { bogus: true } as unknown as UpdateMigrationEdgeVerificationContextV1);
  assert.deepEqual(malformed.reasonCodes, ["INDEPENDENT_CONTEXT_DENIED"]);
});

test("DENIED results are frozen and leak no input", () => {
  const denied = verifyUpdateMigrationEdgeV1((() => { const edge = rawEdge(); edge.secret = "value"; return edge; })(), context());
  assert.deepEqual(Object.keys(denied).sort(), ["exitCode", "outcome", "reasonCodes"]);
  assert.ok(Object.isFrozen(denied));
  assert.ok(Object.isFrozen(denied.reasonCodes));
  assert.ok(!JSON.stringify(denied).includes("secret"));
  assert.throws(() => renderVerifiedUpdateMigrationEdgeV1(rawEdge({ rollbackTargetDigest: ALIEN_DIGEST }), context()));
});