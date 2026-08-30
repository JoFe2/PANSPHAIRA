import { createHash } from "node:crypto";
import { canonicalJson } from "./canonical-json.js";

export const CKS_SYNTHETIC_QUALIFICATION_SCHEMA_V1 = "pansphaira.cks/synthetic-qualification-suite/v1" as const;
export const CKS_SYNTHETIC_QUALIFICATION_LANES_V1 = [
  "DEVELOPMENT",
  "VISIBLE_VALIDATION",
  "HIDDEN_QUALIFICATION",
  "FRESH_EPHEMERAL_CERTIFICATION",
] as const;
export const CKS_SYNTHETIC_QUALIFICATION_FAMILIES_V1 = [
  "RANDOM_IDENTIFIERS",
  "COUNTERFACTUAL_RULE",
  "VERSION_DRIFT",
  "MISSING_KNOWLEDGE",
  "CONFLICTING_SOURCES",
  "SINGLE_RULE",
  "PROCEDURE",
  "MULTI_HOP",
] as const;

export type CksSyntheticQualificationLaneV1 = typeof CKS_SYNTHETIC_QUALIFICATION_LANES_V1[number];
export type CksSyntheticQualificationFamilyV1 = typeof CKS_SYNTHETIC_QUALIFICATION_FAMILIES_V1[number];
export type CksSyntheticQualificationTaskV1 = Readonly<{
  taskId: string;
  family: CksSyntheticQualificationFamilyV1;
  domainId: string;
  prompt: string;
  expected: Readonly<{
    state: "ANSWER_SUPPORTED" | "NEED_MORE_KNOWLEDGE" | "KNOWLEDGE_CONFLICT";
    answer: string | null;
    evidenceIds: readonly string[];
    reasonCode: string;
  }>;
  taskDigest: string;
}>;

export type CksSyntheticQualificationSuiteV1 = Readonly<{
  schemaVersion: typeof CKS_SYNTHETIC_QUALIFICATION_SCHEMA_V1;
  lane: CksSyntheticQualificationLaneV1;
  seedDigest: string;
  generatedAtMs: number;
  tasks: readonly CksSyntheticQualificationTaskV1[];
  authority: Readonly<{
    credentials: readonly [];
    policyApprovals: readonly [];
    capabilities: readonly [];
    toolAccess: readonly [];
    writeTargets: readonly [];
    executionRoutes: readonly [];
  }>;
  suiteDigest: string;
}>;

const sha256 = (value: unknown): string => createHash("sha256").update(canonicalJson(value)).digest("hex");
const isRecord = (value: unknown): value is Record<string, unknown> => value !== null
  && typeof value === "object" && !Array.isArray(value) && Object.getPrototypeOf(value) === Object.prototype;
const exactKeys = (value: unknown, keys: readonly string[]): value is Record<string, unknown> => isRecord(value)
  && Object.keys(value).length === keys.length && keys.every((key) => Object.hasOwn(value, key));
const without = (value: Record<string, unknown>, key: string): Record<string, unknown> => Object.fromEntries(
  Object.entries(value).filter(([name]) => name !== key),
);
export const cksSyntheticQualificationTaskDigestV1 = (value: Record<string, unknown>): string =>
  sha256(without(value, "taskDigest"));
export const cksSyntheticQualificationSuiteDigestV1 = (value: Record<string, unknown>): string =>
  sha256(without(value, "suiteDigest"));
const EMPTY_AUTHORITY = Object.freeze({
  credentials: [], policyApprovals: [], capabilities: [], toolAccess: [], writeTargets: [], executionRoutes: [],
}) as CksSyntheticQualificationSuiteV1["authority"];

function generatedTask(seed: string, lane: CksSyntheticQualificationLaneV1, family: CksSyntheticQualificationFamilyV1, index: number): CksSyntheticQualificationTaskV1 {
  const identity = sha256({ seed, lane, family, index });
  const domainId = `domain:${identity.slice(0, 16)}`;
  const evidence = (offset: number): string => `evidence:${sha256({ identity, offset }).slice(0, 16)}`;
  const missing = family === "MISSING_KNOWLEDGE";
  const conflict = family === "CONFLICTING_SOURCES";
  const evidenceIds = missing ? [] : conflict ? [evidence(0), evidence(1)] : [evidence(0)];
  const expected = {
    state: missing ? "NEED_MORE_KNOWLEDGE" : conflict ? "KNOWLEDGE_CONFLICT" : "ANSWER_SUPPORTED",
    answer: missing || conflict ? null : `answer-${identity.slice(16, 32)}`,
    evidenceIds,
    reasonCode: missing ? "KNOWLEDGE_MISSING_ABSTAIN" : conflict ? "KNOWLEDGE_CONFLICT_ABSTAIN" : "SUPPORTED_BY_EXACT_EVIDENCE",
  } as const;
  const prompts: Readonly<Record<CksSyntheticQualificationFamilyV1, string>> = {
    RANDOM_IDENTIFIERS: `Resolve the post-training identifier in ${domainId}.`,
    COUNTERFACTUAL_RULE: `Apply the domain-local rule in ${domainId}, even when it conflicts with common prior knowledge.`,
    VERSION_DRIFT: `Use only the version-2 rule for ${domainId}; version 1 is superseded.`,
    MISSING_KNOWLEDGE: `Answer the intentionally absent fact for ${domainId}.`,
    CONFLICTING_SOURCES: `Resolve the two materially conflicting sources for ${domainId}.`,
    SINGLE_RULE: `Apply the single evidence-bound rule for ${domainId}.`,
    PROCEDURE: `Execute the ordered synthetic procedure for ${domainId} without effectful authority.`,
    MULTI_HOP: `Derive the final synthetic state across the evidence chain for ${domainId}.`,
  };
  const unsigned = {
    taskId: `cks03:task:${identity.slice(0, 24)}`,
    family,
    domainId,
    prompt: prompts[family],
    expected,
  } as const;
  return { ...unsigned, taskDigest: cksSyntheticQualificationTaskDigestV1(unsigned) };
}

export function generateCksSyntheticQualificationSuiteV1(input: Readonly<{
  lane: CksSyntheticQualificationLaneV1;
  seed: string;
  generatedAtMs: number;
}>): CksSyntheticQualificationSuiteV1 {
  if (!CKS_SYNTHETIC_QUALIFICATION_LANES_V1.includes(input.lane)
    || typeof input.seed !== "string" || input.seed.length < 16 || input.seed.length > 256
    || !Number.isSafeInteger(input.generatedAtMs) || input.generatedAtMs < 0) throw new Error("CKS_SYNTHETIC_QUALIFICATION_INPUT_DENIED");
  const unsigned = {
    schemaVersion: CKS_SYNTHETIC_QUALIFICATION_SCHEMA_V1,
    lane: input.lane,
    seedDigest: sha256(input.seed),
    generatedAtMs: input.generatedAtMs,
    tasks: CKS_SYNTHETIC_QUALIFICATION_FAMILIES_V1.map((family, index) =>
      generatedTask(input.seed, input.lane, family, index)),
    authority: EMPTY_AUTHORITY,
  } as const;
  return { ...unsigned, suiteDigest: cksSyntheticQualificationSuiteDigestV1(unsigned) };
}

export function validateCksSyntheticQualificationSplitV1(
  suites: readonly unknown[],
): Readonly<{ outcome: "VALID" } | { outcome: "DENIED"; reason: string }> {
  if (!Array.isArray(suites) || suites.length !== CKS_SYNTHETIC_QUALIFICATION_LANES_V1.length
    || !suites.every(isRecord)) return { outcome: "DENIED", reason: "LANE_SET_DENIED" };
  const records = suites as readonly Record<string, unknown>[];
  if (new Set(records.map((suite) => suite.lane)).size !== records.length
    || !CKS_SYNTHETIC_QUALIFICATION_LANES_V1.every((lane) => records.some((suite) => suite.lane === lane))) {
    return { outcome: "DENIED", reason: "LANE_SET_DENIED" };
  }
  if (new Set(records.map((suite) => suite.seedDigest)).size !== records.length) {
    return { outcome: "DENIED", reason: "SEED_REUSE_DENIED" };
  }
  for (const suite of records) {
    if (!exactKeys(suite, ["schemaVersion", "lane", "seedDigest", "generatedAtMs", "tasks", "authority", "suiteDigest"])) {
      return { outcome: "DENIED", reason: "SCHEMA_DENIED" };
    }
    if (suite.suiteDigest !== cksSyntheticQualificationSuiteDigestV1(suite)) {
      return { outcome: "DENIED", reason: "DIGEST_TAMPERED_DENIED" };
    }
    if (!Array.isArray(suite.tasks) || suite.tasks.length !== CKS_SYNTHETIC_QUALIFICATION_FAMILIES_V1.length) {
      return { outcome: "DENIED", reason: "TASK_SET_DENIED" };
    }
    for (const task of suite.tasks) {
      if (!exactKeys(task, ["taskId", "family", "domainId", "prompt", "expected", "taskDigest"])
        || !exactKeys(task.expected, ["state", "answer", "evidenceIds", "reasonCode"])) {
        return { outcome: "DENIED", reason: "SCHEMA_DENIED" };
      }
      if (task.taskDigest !== cksSyntheticQualificationTaskDigestV1(task)) {
        return { outcome: "DENIED", reason: "TASK_DIGEST_TAMPERED_DENIED" };
      }
    }
    if (!exactKeys(suite.authority, ["credentials", "policyApprovals", "capabilities", "toolAccess", "writeTargets", "executionRoutes"])
      || !Object.values(suite.authority).every((items) => Array.isArray(items) && items.length === 0)) {
      return { outcome: "DENIED", reason: "AUTHORITY_DENIED" };
    }
  }
  return { outcome: "VALID" };
}

export type CksSyntheticQualificationScoreV1 = Readonly<{
  outcome: "SCORED";
  suiteDigest: string;
  evaluatedTasks: number;
  supportedCorrect: number;
  epistemicCorrect: number;
  closedBookCorrectCount: number;
  potentialLeakagePpm: number;
  scoreDigest: string;
}>;

export function scoreCksSyntheticQualificationSuiteV1(
  suite: CksSyntheticQualificationSuiteV1,
  results: readonly unknown[],
): CksSyntheticQualificationScoreV1 | Readonly<{ outcome: "DENIED"; reason: string }> {
  if (suite.suiteDigest !== cksSyntheticQualificationSuiteDigestV1(suite as unknown as Record<string, unknown>)
    || suite.tasks.some((task) => task.taskDigest !== cksSyntheticQualificationTaskDigestV1(task as unknown as Record<string, unknown>))) {
    return { outcome: "DENIED", reason: "SUITE_TAMPERED_DENIED" };
  }
  if (!Array.isArray(results) || results.length !== suite.tasks.length || !results.every(isRecord)) {
    return { outcome: "DENIED", reason: "RESULT_SET_DENIED" };
  }
  const records = results as readonly Record<string, unknown>[];
  if (new Set(records.map((result) => result.taskId)).size !== records.length
    || !suite.tasks.every((task) => records.some((result) => result.taskId === task.taskId))) {
    return { outcome: "DENIED", reason: "RESULT_SET_DENIED" };
  }
  let supportedCorrect = 0;
  let epistemicCorrect = 0;
  let closedBookCorrectCount = 0;
  for (const task of suite.tasks) {
    const result = records.find((candidate) => candidate.taskId === task.taskId)!;
    const exact = result.state === task.expected.state
      && result.answer === task.expected.answer
      && canonicalJson(result.evidenceIds) === canonicalJson(task.expected.evidenceIds)
      && result.reasonCode === task.expected.reasonCode;
    if (exact) epistemicCorrect += 1;
    if (exact && task.expected.state === "ANSWER_SUPPORTED") supportedCorrect += 1;
    if (result.closedBookCorrect === true) closedBookCorrectCount += 1;
  }
  const unsigned = {
    outcome: "SCORED" as const,
    suiteDigest: suite.suiteDigest,
    evaluatedTasks: suite.tasks.length,
    supportedCorrect,
    epistemicCorrect,
    closedBookCorrectCount,
    potentialLeakagePpm: Math.floor(closedBookCorrectCount * 1_000_000 / suite.tasks.length),
  };
  return { ...unsigned, scoreDigest: sha256(unsigned) };
}
