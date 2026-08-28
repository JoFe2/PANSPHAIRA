import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  CKS_ACCEPTED_REASON_CODE_V1,
  CKS_DENIAL_REASON_CODES_V1,
  CKS_LATE_WINDOW_MS_V1,
  CKS_MAX_EVENTS_PER_SCOPE_V1,
  CKS_MAX_EVENTS_PER_TASK_V1,
  CKS_MAX_KNOWLEDGE_REFS_V1,
  CKS_MAX_REASON_CODES_PER_DENIAL_V1,
  CKS_MAX_SEARCHES_PER_TASK_V1,
  CKS_RECONSTRUCTED_FIELDS_V1,
  CKS_RECONSTRUCTION_SCHEMA_V1,
  cksLineageSetInvariantsHeldV1,
  isDeniedKnowledgeUsageV1,
  isReconstructedKnowledgeUsageV1,
  reconstructCksLineageUsageV1,
  validateCksLineageEventV1,
  verifyCksLineageReconstructionV1,
} from "../packages/contracts/src/cks-lineage-reconstructor.js";

interface PositiveTask {
  name: string;
  taskKind: string;
  events: unknown[];
}
interface RejectionCase {
  name: string;
  mutation: string;
  expectedReasonCodes: string[];
  events: unknown[];
}
const positiveFixture = (): { tasks: PositiveTask[] } =>
  JSON.parse(readFileSync("tests/fixtures/cks-08/lineage-positive-v1.json", "utf8"));
const rejectionFixture = (): { cases: RejectionCase[] } =>
  JSON.parse(readFileSync("tests/fixtures/cks-08/lineage-rejections-v1.json", "utf8"));
const ids = (refs: ReadonlyArray<{ readonly knowledgeId: string }>): string[] => refs.map((ref) => ref.knowledgeId);

test("P14 reconstructs all six usage sets for each synthetic positive task", () => {
  const tasks = positiveFixture().tasks;
  assert.ok(tasks.length >= 2, "at least two synthetic task lineages");
  const expectedByTask: Record<string, { searched: string[]; inspected: string[]; used: string[]; rejected: Array<[string, string]>; decisionSupporting: string[]; outcomeContributing: string[] }> = {
    "act-alpha-usage": {
      searched: ["fixture:alpha", "fixture:beta", "fixture:gamma"],
      inspected: ["fixture:alpha", "fixture:beta"],
      used: ["fixture:alpha"],
      rejected: [["fixture:beta", "STALE"]],
      decisionSupporting: ["fixture:alpha"],
      outcomeContributing: ["fixture:alpha"],
    },
    "retrieve-delta-usage": {
      searched: ["fixture:delta", "fixture:epsilon"],
      inspected: ["fixture:delta", "fixture:epsilon"],
      used: ["fixture:delta", "fixture:epsilon"],
      rejected: [],
      decisionSupporting: ["fixture:delta", "fixture:epsilon"],
      outcomeContributing: ["fixture:delta"],
    },
  };
  for (const task of tasks) {
    const first = reconstructCksLineageUsageV1(task.events);
    const second = reconstructCksLineageUsageV1(JSON.parse(JSON.stringify(task.events)));
    if (!isReconstructedKnowledgeUsageV1(first)) throw new Error(`${task.name}: expected RECONSTRUCTED`);
    const expected = expectedByTask[task.name];
    assert.ok(expected, `${task.name}: pinned expectation present`);
    assert.deepEqual(ids(first.searched), expected.searched, `${task.name}: searched`);
    assert.deepEqual(ids(first.inspected), expected.inspected, `${task.name}: inspected`);
    assert.deepEqual(ids(first.used), expected.used, `${task.name}: used`);
    assert.deepEqual(
      first.rejected.map((item) => [item.knowledgeRef.knowledgeId, item.reasonCode] as [string, string]),
      expected.rejected,
      `${task.name}: rejected`,
    );
    assert.deepEqual(ids(first.decisionSupporting), expected.decisionSupporting, `${task.name}: decisionSupporting`);
    assert.deepEqual(ids(first.outcomeContributing), expected.outcomeContributing, `${task.name}: outcomeContributing`);
    assert.deepEqual(Object.keys(first).sort(), [...CKS_RECONSTRUCTED_FIELDS_V1].sort(), `${task.name}: exact receipt fields`);
    assert.equal(first.schemaVersion, CKS_RECONSTRUCTION_SCHEMA_V1, `${task.name}: schema version`);
    assert.ok(cksLineageSetInvariantsHeldV1(first), `${task.name}: set invariants`);
    assert.ok(!isDeniedKnowledgeUsageV1(first), `${task.name}: not a denied receipt`);
    assert.deepEqual(second, first, `${task.name}: deterministic across fresh input copies`);
    for (const event of task.events) {
      assert.deepEqual(
        validateCksLineageEventV1(event),
        { outcome: "ACCEPTED", reasonCodes: [CKS_ACCEPTED_REASON_CODE_V1] },
        `${task.name}: single event accepted`,
      );
    }
    assert.deepEqual(
      verifyCksLineageReconstructionV1(first),
      { outcome: "ACCEPTED", reasonCodes: [CKS_ACCEPTED_REASON_CODE_V1] },
      `${task.name}: reconstruction receipt verified`,
    );
  }
});

test("P14 denies missing, late, replayed, cross-scope and tampered lineage with the frozen reason codes", () => {
  const cases = rejectionFixture().cases;
  assert.deepEqual(
    cases.map((item) => item.name).sort(),
    ["cross-scope", "late", "missing", "replayed", "tampered"],
    "fixture covers exactly the five owned denial classes",
  );
  for (const item of cases) {
    const result = reconstructCksLineageUsageV1(item.events);
    if (!isDeniedKnowledgeUsageV1(result)) throw new Error(`${item.name}: expected DENIED receipt`);
    assert.equal(result.status, "DENIED", item.name);
    assert.deepEqual(result.reasonCodes, item.expectedReasonCodes, `${item.name}: frozen reason codes`);
    assert.deepEqual(Object.keys(result).sort(), ["reasonCodes", "schemaVersion", "status"], `${item.name}: exact denial shape, no partial state`);
    assert.equal(result.schemaVersion, CKS_RECONSTRUCTION_SCHEMA_V1, `${item.name}: schema version`);
    assert.ok(result.reasonCodes.every((code) => (CKS_DENIAL_REASON_CODES_V1 as readonly string[]).includes(code)), `${item.name}: codes within the frozen denial vocabulary`);
    assert.ok(!isReconstructedKnowledgeUsageV1(result), `${item.name}: not a reconstructed receipt`);
    assert.deepEqual(
      verifyCksLineageReconstructionV1(result),
      { outcome: "ACCEPTED", reasonCodes: [CKS_ACCEPTED_REASON_CODE_V1] },
      `${item.name}: well-formed denial receipt verified`,
    );
  }
});

test("P14 denial output is fail-closed, capped and pinned to the frozen constants", () => {
  assert.equal(CKS_RECONSTRUCTION_SCHEMA_V1, "chimpmaera.knowledge/usage-lineage-reconstruction/v1");
  assert.equal(CKS_ACCEPTED_REASON_CODE_V1, "CONTRACT_VERIFIED");
  assert.equal(CKS_LATE_WINDOW_MS_V1, 300000, "inclusive late window is frozen");
  assert.equal(CKS_MAX_EVENTS_PER_SCOPE_V1, 4096);
  assert.equal(CKS_MAX_EVENTS_PER_TASK_V1, 256);
  assert.equal(CKS_MAX_SEARCHES_PER_TASK_V1, 16);
  assert.equal(CKS_MAX_KNOWLEDGE_REFS_V1, 32);
  assert.equal(CKS_MAX_REASON_CODES_PER_DENIAL_V1, 8);
  assert.equal(CKS_DENIAL_REASON_CODES_V1.length, 23, "denial vocabulary is the frozen receipt set minus the acceptance marker");
  assert.deepEqual([...CKS_DENIAL_REASON_CODES_V1].sort(), [...CKS_DENIAL_REASON_CODES_V1], "denial vocabulary is unique and sorted");
  assert.ok(!(CKS_DENIAL_REASON_CODES_V1 as readonly string[]).includes("CONTRACT_VERIFIED"));
  assert.equal(CKS_RECONSTRUCTED_FIELDS_V1.length, 13, "accepted output is the frozen 13-field receipt");
  assert.deepEqual(new Set(CKS_RECONSTRUCTED_FIELDS_V1).size, 13);

  const empty = reconstructCksLineageUsageV1([]);
  if (!isDeniedKnowledgeUsageV1(empty)) throw new Error("empty input must deny");
  assert.deepEqual(empty.reasonCodes, ["SCHEMA_DENIED"], "empty input denies fail-closed");
  assert.deepEqual(verifyCksLineageReconstructionV1(empty), { outcome: "ACCEPTED", reasonCodes: [CKS_ACCEPTED_REASON_CODE_V1] });
  const notAnArray = reconstructCksLineageUsageV1(null as unknown);
  if (!isDeniedKnowledgeUsageV1(notAnArray)) throw new Error("non-array input must deny");
  assert.deepEqual(notAnArray.reasonCodes, ["SCHEMA_DENIED"], "non-array input denies fail-closed");
});

test("receipt validator denies malformed reconstruction receipts", () => {
  const receipt = {
    schemaVersion: CKS_RECONSTRUCTION_SCHEMA_V1,
    status: "DENIED",
    reasonCodes: ["SCHEMA_DENIED"],
  } as const;
  assert.deepEqual(verifyCksLineageReconstructionV1(receipt), { outcome: "ACCEPTED", reasonCodes: [CKS_ACCEPTED_REASON_CODE_V1] });
  const denied = (value: unknown): void =>
    assert.deepEqual(
      verifyCksLineageReconstructionV1(value),
      { outcome: "DENIED", reasonCodes: ["DIGEST_MISMATCH_DENIED"] },
      "malformed receipt denies",
    );
  denied({ ...receipt, reasonCodes: ["TAMPERED_LINEAGE_DENIED", "SCHEMA_DENIED"] });
  denied({ ...receipt, reasonCodes: ["SCHEMA_DENIED", "SCHEMA_DENIED"] });
  denied({
    ...receipt,
    reasonCodes: [
      "CAPACITY_DENIED",
      "CAUSAL_ORDER_DENIED",
      "DIGEST_MISMATCH_DENIED",
      "DIGEST_MISSING_DENIED",
      "FAILURE_ATTRIBUTION_DENIED",
      "IDENTIFIER_FORMAT_DENIED",
      "IDENTIFIER_MISSING_DENIED",
      "INCOMPLETE_LINEAGE_DENIED",
      "LATE_EVENT_DENIED",
    ],
  });
  denied({ ...receipt, reasonCodes: ["NOT_A_REASON_CODE"] });
  denied({ ...receipt, reasonCodes: [] });
  denied({ ...receipt, partialUsed: [] });
  denied({ schemaVersion: "chimpmaera.knowledge/usage-lineage-reconstruction/v0", status: "DENIED", reasonCodes: ["SCHEMA_DENIED"] });
  denied(null);
  denied("not-a-record");
  denied(["not-a-record"]);

  const reconstructed = reconstructCksLineageUsageV1(positiveFixture().tasks[0]!.events);
  if (!isReconstructedKnowledgeUsageV1(reconstructed)) throw new Error("expected a RECONSTRUCTED receipt");
  assert.deepEqual(verifyCksLineageReconstructionV1(reconstructed), { outcome: "ACCEPTED", reasonCodes: [CKS_ACCEPTED_REASON_CODE_V1] });
  denied({ ...reconstructed, reconstructionDigest: "0".repeat(64) });
  denied({ ...reconstructed, extra: 1 });
  denied({ ...reconstructed, status: "DENIED" });
});

test("set invariant probe fails on fabricated violations", () => {
  const receipt = reconstructCksLineageUsageV1(positiveFixture().tasks[0]!.events);
  if (!isReconstructedKnowledgeUsageV1(receipt)) throw new Error("expected a RECONSTRUCTED receipt");
  const alpha = { knowledgeId: "fixture:alpha", knowledgeDigest: "d".repeat(64) };
  const gamma = { knowledgeId: "fixture:gamma", knowledgeDigest: "c".repeat(64) };
  assert.ok(cksLineageSetInvariantsHeldV1(receipt), "control: invariants hold on the real receipt");
  assert.equal(cksLineageSetInvariantsHeldV1({ ...receipt, used: [...receipt.used, gamma] }), false, "USED outside INSPECTED breaks the invariants");
  assert.equal(cksLineageSetInvariantsHeldV1({ ...receipt, rejected: [...receipt.rejected, { knowledgeRef: alpha, reasonCode: "DUP" }] }), false, "USED ∩ REJECTED non-empty breaks the invariants");
  assert.equal(
    cksLineageSetInvariantsHeldV1({ ...receipt, outcomeContributing: [...receipt.outcomeContributing, { knowledgeId: "fixture:beta", knowledgeDigest: "b".repeat(64) }] }),
    false,
    "OUTCOME_CONTRIBUTING outside DECISION_SUPPORTING breaks the invariants",
  );
});
