import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import test from "node:test";
import { canonicalJson } from "../packages/contracts/src/canonical-json.js";

const RECORD_PATH = "verification/trust-compatibility-foundation-closure-v1.json";
const SCHEMA_VERSION = "pansphaira.e-fnd-1/trust-compatibility-foundation-closure/v1";
const D044_MANIFEST_SHA256 = "ed5a4228960969045687d136040c0231bff2c066ce894e7d018dcc7242971031";
const CAPTURED_MAIN = "28fe46aaf6385ee7ea25cadecb67d56f58ae0fc3";
const EXPECTED_CHILD_SET_SHA256 = "6d1bbddedf5ed23ca7fd6bb7b4f31f74c20a19b4bc4f73fc7898528e63f74ee9";
const EXPECTED_PUBLIC_THREAD_SET_SHA256 = "e8f34d4ee4ab96e932ea6e80856d4561d6aa8c449e3e11bdddf69d6f809a4b08";
const EXPECTED_RECORD_SHA256 = "4b44633509b6b61f4c53b745a475d8a918cdfe47da355e137b9f3fde1a7e067c";
const TEST_COMMAND = "npm run build --silent && node --test dist/tests/trust-compatibility-foundation-closure.test.js";
const LEGACY_DISPLAY = ["PANS", "PHAIRA"].join("");

const CHILD_KEYS = [
  "JoFe2/PANSPHAIRA#334",
  "JoFe2/KaleidoSphere#140",
  "JoFe2/KaleidoSphere#141",
  "JoFe2/PANSPHAIRA#335",
  "JoFe2/PANSPHAIRA#336",
  "JoFe2/PANSPHAIRA#337",
  "JoFe2/PANSPHAIRA#338",
] as const;

const PUBLIC_ISSUE_KEYS = ["JoFe2/PANSPHAIRA#333", ...CHILD_KEYS] as const;
const INTEGRATION_ACCEPTANCE_IDS = ["E-FND-1-AC01", "E-FND-1-AC02", "E-FND-1-AC03", "E-FND-1-AC04"] as const;
const EXPECTED_INTEGRATION_ACCEPTANCE = Object.freeze([
  Object.freeze({
    id: "E-FND-1-AC01",
    sourceAnchor: "issue-body:epic-acceptance-child-ownership",
    title: `Every acceptance ID belonging to ${LEGACY_DISPLAY} #334 through #338 and KaleidoSphere #140 and #141 is uniquely owned, dependency-correct and reconciled without weakening child criteria.`,
  }),
  Object.freeze({
    id: "E-FND-1-AC02",
    sourceAnchor: "issue-body:children-plus-public-closure-governance",
    title: "All seven children have exact public PR/CI/merge/release/readback/issue-terminal and Queue-DONE or explicit direct-Control-Lane terminal reconciliation evidence.",
  }),
  Object.freeze({
    id: "E-FND-1-AC03",
    sourceAnchor: "D-044:exact-parent-reconciliation",
    title: "One deterministic cumulative foundation record binds the frozen D-044 manifest, live parent thread, every child acceptance set, exact merge/release heads, public receipts and Queue proofs with no unresolved child or criterion.",
  }),
  Object.freeze({
    id: "E-FND-1-AC04",
    sourceAnchor: "issue-body:governance-and-nonclaims",
    title: "The record preserves process observations, serial-release governance, exact-evidence requirements and bounded nonclaims without granting productive external effects or deferred capability claims.",
  }),
]);
const EXPECTED_DEFERRED_ACCEPTANCE = Object.freeze({
  id: "E-FND-1-AC05",
  sourceAnchor: "issue-body:parent-close-criterion",
  title: "The parent closes only after all authorized epic criteria pass on one immutable current-Main candidate through exactly one review, final Sol ownership, exact CI/release/readback and Queue DONE.",
});
const EXPECTED_ACCEPTANCE_IDS: Readonly<Record<string, readonly string[]>> = Object.freeze({
  "JoFe2/PANSPHAIRA#334": ["FND-PS-01-AC01", "FND-PS-01-AC02", "FND-PS-01-AC03", "FND-PS-01-AC04", "FND-PS-01-AC05"],
  "JoFe2/KaleidoSphere#140": ["FND-KS-01-AC01", "FND-KS-01-AC02", "FND-KS-01-AC03", "FND-KS-01-AC04", "FND-KS-01-AC05"],
  "JoFe2/KaleidoSphere#141": ["FND-KS-02-AC01", "FND-KS-02-AC02", "FND-KS-02-AC03", "FND-KS-02-AC04"],
  "JoFe2/PANSPHAIRA#335": ["FND-PS-02-AC01", "FND-PS-02-AC02", "FND-PS-02-AC03", "FND-PS-02-AC04"],
  "JoFe2/PANSPHAIRA#336": ["FND-PS-03-AC01", "FND-PS-03-AC02", "FND-PS-03-AC03", "FND-PS-03-AC04"],
  "JoFe2/PANSPHAIRA#337": ["FND-XR-01-AC01", "FND-XR-01-AC02", "FND-XR-01-AC03", "FND-XR-01-AC04"],
  "JoFe2/PANSPHAIRA#338": ["FND-PS-04-AC01", "FND-PS-04-AC02", "FND-PS-04-AC03", "FND-PS-04-AC04"],
});

const EXPECTED_ACCEPTANCE_TITLES: Readonly<Record<string, readonly string[]>> = Object.freeze({
  "JoFe2/PANSPHAIRA#334": [
    "Missing/null/non-array nodes and edges return structured DENIED without exception.",
    "Duplicate node IDs and malformed node/edge shapes fail closed with stable reason codes.",
    "Valid frozen projection remains byte/digest compatible unless an explicitly versioned contract change is required.",
    "Sabotage run proves the new regression test fails on the current vulnerable implementation.",
    "Issue closes through exact-head content-addressed delivery and anonymous readback.",
  ],
  "JoFe2/KaleidoSphere#140": [
    "Model-synthesis output never receives claimsBounded from JSON parsing alone.",
    "Independent closed verifier derives bounded/unbounded outcome from schema, evidence tables and blind spots.",
    "Malformed, invented, unknown-field, evidence-table and paired-substitution negatives fail closed.",
    "Existing deterministic path and default-off behavior remain unchanged.",
    "Issue closes through canonical tests, Root-QS, PR/Main CI, release decision, anonymous readback and queue reconciliation.",
  ],
  "JoFe2/KaleidoSphere#141": [
    "KaleidoSphere attests only product, contract and capabilities actually present at runtime.",
    "Partial, unsupported and nonclaims are runtime-derived and digest-bound.",
    "Stale, substituted and forged attestations fail closed.",
    "KaleidoSphere issue closes independently through exact-head delivery and anonymous readback.",
  ],
  "JoFe2/PANSPHAIRA#335": [
    "Every returned edge binds internally derivable evidence; shared endpoints alone grant no relation truth.",
    "Paired substitutions and fully re-digested forged relations fail closed.",
    "Candidate remains authority-free and cannot mutate/promote canonical Knowledge.",
    "Historical fixture bytes and nonclaims are preserved or explicitly version-migrated.",
  ],
  "JoFe2/PANSPHAIRA#336": [
    "Allowed product/contract/capability combinations are explicit and versioned; checks are not disabled.",
    "Unknown, stale, substituted or incomplete combinations remain denied.",
    "Expected profile authority is server/owner-derived and attestation digest remains fail-closed.",
    `${LEGACY_DISPLAY} issue closes independently through exact-head content-addressed delivery.`,
  ],
  "JoFe2/PANSPHAIRA#337": [
    "Accepted and rejected product/contract/capability pairs run against exact released repository heads.",
    "Both repository releases, fixtures and receipts bind one paired compatibility evidence record.",
    "Unknown pairs remain denied and no compatibility claim exceeds the tested pair.",
    "Cross-repo parent closes only after both child issues are publicly released/read back.",
  ],
  "JoFe2/PANSPHAIRA#338": [
    "All discovered canonicalization profiles, owners, consumers and historical byte obligations are inventoried on current Main.",
    "No implementation is declared equivalent without shared valid/invalid/Unicode/number evidence.",
    "Historical digest-bound bytes are not regenerated.",
    "Output is a decision artifact and testable inventory, not a premature utility consolidation.",
  ],
});

const EXPECTED_ISSUE_BODY_SHA256: Readonly<Record<string, string>> = Object.freeze({
  "JoFe2/PANSPHAIRA#333": "7271c8058380b4a4df3ebd83000cb9b82c60004cfb8e5ca3b9e2dd938092bc9c",
  "JoFe2/PANSPHAIRA#334": "3693da31a1c076cb14f176ad6b5978aa07dec8ab6f13e20dd811be4d5867783c",
  "JoFe2/KaleidoSphere#140": "08b63d108aa8f7545a3a00d20847e1bef42bec39fcf55637d9a043e57f44853f",
  "JoFe2/KaleidoSphere#141": "ffe87390024015d72125df3a63190a7356f8ba0d06b3370da3f9c4f75200502f",
  "JoFe2/PANSPHAIRA#335": "7273f096c5f831f175642b8d25f54670408ff11314ab96afe1c9af909259e025",
  "JoFe2/PANSPHAIRA#336": "26fe34445a8f68ba41f6de28cba97657d1b21232b9662a1856af4514a72014d4",
  "JoFe2/PANSPHAIRA#337": "63792bb7851aeefc9b4e8c94c8c0a76d244658c4e71c705709f2f62cb4e434b5",
  "JoFe2/PANSPHAIRA#338": "29964f9c5a39cb1db5d2610f7a27f0f08a2f9071ccb85dce4bbf0248497f9bc5",
});

const EXPECTED_ISSUE_TITLES: Readonly<Record<string, string>> = Object.freeze({
  "JoFe2/PANSPHAIRA#333": "[E-FND-1] Trust and Compatibility Foundation",
  "JoFe2/PANSPHAIRA#334": "[FND-PS-01] CKS-12 structural fail-closed projection validation",
  "JoFe2/KaleidoSphere#140": "[FND-KS-01] Verifier-derived BI synthesis claim boundedness",
  "JoFe2/KaleidoSphere#141": "[FND-KS-02] Runtime-derived external BI consumer and attestation profile",
  "JoFe2/PANSPHAIRA#335": "[FND-PS-02] CKS-12 evidence-bound edge authority",
  "JoFe2/PANSPHAIRA#336": `[FND-PS-03] ${LEGACY_DISPLAY} qualified external BI compatibility admission profile`,
  "JoFe2/PANSPHAIRA#337": `[FND-XR-01] Paired ${LEGACY_DISPLAY}/KaleidoSphere compatibility clean-room`,
  "JoFe2/PANSPHAIRA#338": "[FND-PS-04] Canonical JSON and digest profile census decision artifact",
});

const EXPECTED_DEPENDENCIES: Readonly<Record<string, { declared: readonly string[]; authorityPredecessors: readonly string[] }>> = Object.freeze({
  "JoFe2/PANSPHAIRA#334": { declared: [], authorityPredecessors: [] },
  "JoFe2/KaleidoSphere#140": { declared: [], authorityPredecessors: ["JoFe2/PANSPHAIRA#334"] },
  "JoFe2/KaleidoSphere#141": { declared: [], authorityPredecessors: ["JoFe2/PANSPHAIRA#338"] },
  "JoFe2/PANSPHAIRA#335": { declared: ["JoFe2/PANSPHAIRA#334"], authorityPredecessors: [] },
  "JoFe2/PANSPHAIRA#336": { declared: [], authorityPredecessors: [] },
  "JoFe2/PANSPHAIRA#337": { declared: ["JoFe2/PANSPHAIRA#336", "JoFe2/KaleidoSphere#141"], authorityPredecessors: [] },
  "JoFe2/PANSPHAIRA#338": { declared: [], authorityPredecessors: [] },
});

const EXPECTED_DELIVERY: Readonly<Record<string, {
  finalMergeSha: string;
  finalPrNumber: number;
  finalPrHead: string;
  mainCiRunId: number;
  prCiRunId: number;
  receiptCommentId: number;
  relation: string;
  releaseId: number;
  releasePublishedAt: string;
  tag: string;
}>> = Object.freeze({
  "JoFe2/PANSPHAIRA#334": {
    finalMergeSha: "dac921d459cbcfc16e4912dff558c8786e6438de",
    finalPrNumber: 340,
    finalPrHead: "67555ca2ddd630089ccf7c5be02dc40365feb18b",
    mainCiRunId: 33418611512,
    prCiRunId: 33416619926,
    receiptCommentId: 5482139438,
    relation: "ANCESTOR",
    releaseId: 379939318,
    releasePublishedAt: "2026-08-31T17:37:59Z",
    tag: "2026_08_31_v5",
  },
  "JoFe2/KaleidoSphere#140": {
    finalMergeSha: "da98b6475fa0e3f22104e341f7bb1d26f97fb6d0",
    finalPrNumber: 142,
    finalPrHead: "4dad68bf8e8df4a7374013251f56b5cdf991659a",
    mainCiRunId: 33421156667,
    prCiRunId: 33421071323,
    receiptCommentId: 5482217325,
    relation: "NOT_APPLICABLE_CROSS_REPOSITORY",
    releaseId: 379943289,
    releasePublishedAt: "2026-08-31T17:45:25Z",
    tag: "2026_08_31_v1",
  },
  "JoFe2/KaleidoSphere#141": {
    finalMergeSha: "90c574e9a06cb752be06270395d44a31eabc44ae",
    finalPrNumber: 153,
    finalPrHead: "f3a88790e065b741882fd6554bb023c06d893966",
    mainCiRunId: 33465671685,
    prCiRunId: 33465630883,
    receiptCommentId: 5488387009,
    relation: "NOT_APPLICABLE_CROSS_REPOSITORY",
    releaseId: 380190392,
    releasePublishedAt: "2026-09-01T03:17:58Z",
    tag: "2026_09_01_v1",
  },
  "JoFe2/PANSPHAIRA#335": {
    finalMergeSha: "55dcf6dce3a985e13de9768ee8637a3fbb38f939",
    finalPrNumber: 357,
    finalPrHead: "80d78725f098cc1b901cc71aa73947f3c1588568",
    mainCiRunId: 33573369782,
    prCiRunId: 33571899316,
    receiptCommentId: 5502419153,
    relation: "ANCESTOR",
    releaseId: 380902180,
    releasePublishedAt: "2026-09-02T00:19:36Z",
    tag: "2026_09_02_v2",
  },
  "JoFe2/PANSPHAIRA#336": {
    finalMergeSha: "24db4e926385b006c9f2fbca3588adece72e7fb0",
    finalPrNumber: 356,
    finalPrHead: "1afe8cb7b44597c8b116670e2974509a836b9945",
    mainCiRunId: 33568706507,
    prCiRunId: 33567148727,
    receiptCommentId: 5501738387,
    relation: "ANCESTOR",
    releaseId: 380881340,
    releasePublishedAt: "2026-09-01T23:12:34Z",
    tag: "2026_09_02_v1",
  },
  "JoFe2/PANSPHAIRA#337": {
    finalMergeSha: "7d794431d8f094dbcccf4e8f4aa249c6db816c82",
    finalPrNumber: 358,
    finalPrHead: "dd926927a983ff10ffe555f6eebe26cfa5402ff0",
    mainCiRunId: 33585233361,
    prCiRunId: 33583893885,
    receiptCommentId: 5503866738,
    relation: "ANCESTOR",
    releaseId: 380957395,
    releasePublishedAt: "2026-09-02T03:26:25Z",
    tag: "2026_09_02_v3",
  },
  "JoFe2/PANSPHAIRA#338": {
    finalMergeSha: "b41337348f3b379870c3006a9647ecdfdc29f6f7",
    finalPrNumber: 348,
    finalPrHead: "1efe5658733e53b240957c12a1b47df86d4ed4e3",
    mainCiRunId: 33450256746,
    prCiRunId: 33448727314,
    receiptCommentId: 5486322193,
    relation: "ANCESTOR",
    releaseId: 380121007,
    releasePublishedAt: "2026-08-31T23:40:09Z",
    tag: "2026_08_31_v6",
  },
});

const EXPECTED_TERMINAL: Readonly<Record<string, {
  claimGeneration?: number;
  eventId?: number;
  eventOccurredAt?: number;
  kind: string;
  owner: string;
  resultHead?: string;
  resultHeadSemantics?: string;
}>> = Object.freeze({
  "JoFe2/PANSPHAIRA#334": { kind: "DIRECT_CONTROL_LANE_TERMINAL", owner: "DIRECT-CONTROL-LANE:JoFe2/PANSPHAIRA#334" },
  "JoFe2/KaleidoSphere#140": { kind: "DIRECT_CONTROL_LANE_TERMINAL", owner: "DIRECT-CONTROL-LANE:JoFe2/KaleidoSphere#140" },
  "JoFe2/KaleidoSphere#141": { claimGeneration: 16, eventId: 8301, eventOccurredAt: 1788232682.8883023, kind: "QUEUE_DONE", owner: "CAMPAIGN-V1-FND-KS-02-ROOT-QS-01", resultHead: "f3a88790e065b741882fd6554bb023c06d893966", resultHeadSemantics: "REVIEWED_PR_HEAD" },
  "JoFe2/PANSPHAIRA#335": { claimGeneration: 678, eventId: 13546, eventOccurredAt: 1788308381.0318644, kind: "QUEUE_DONE", owner: "PORTFOLIO-PS335-ROOT-QS", resultHead: "80d78725f098cc1b901cc71aa73947f3c1588568", resultHeadSemantics: "REVIEWED_PR_HEAD" },
  "JoFe2/PANSPHAIRA#336": { claimGeneration: 430, eventId: 12171, eventOccurredAt: 1788304359.2385683, kind: "QUEUE_DONE", owner: "PORTFOLIO-PS336-ROOT-QS", resultHead: "1afe8cb7b44597c8b116670e2974509a836b9945", resultHeadSemantics: "REVIEWED_PR_HEAD" },
  "JoFe2/PANSPHAIRA#337": { claimGeneration: 578, eventId: 14742, eventOccurredAt: 1788319589.772967, kind: "QUEUE_DONE", owner: "PORTFOLIO-PS337-ROOT-QS", resultHead: "dd926927a983ff10ffe555f6eebe26cfa5402ff0", resultHeadSemantics: "REVIEWED_PR_HEAD" },
  "JoFe2/PANSPHAIRA#338": { claimGeneration: 289, eventId: 8222, eventOccurredAt: 1788219644, kind: "QUEUE_DONE", owner: "CAMPAIGN-V1-FND-PS-04-ROOT-QS-01", resultHead: "b41337348f3b379870c3006a9647ecdfdc29f6f7", resultHeadSemantics: "PROTECTED_SUCCESSOR_FINAL_MERGE_HEAD" },
});

const EXPECTED_PROCESS_OBSERVATIONS = Object.freeze({
  boundary: "HISTORICAL_PUBLIC_PARENT_THREAD_ONLY_NO_UNRECORDED_METRIC_INFERENCE",
  initialWave: {
    firstPassReviews: { accepted: 0, total: 2 },
    materialHighFindingsClosedInIssueScope: 4,
    nonBlockingFollowUp: { activated: false, issueKey: "JoFe2/PANSPHAIRA#339" },
    postCorrectionReviews: { accepted: 2, total: 2 },
  },
  notSeparatelyQuantifiedInPublicParentThread: ["rewriteRatio", "contextAndCompaction", "cleanup"],
  revisedLoop: ["FOCUSED_GATES", "ONE_REVIEW", "ONE_CORRECTION", "BOUNDED_RE_REVIEW", "ONE_FINAL_LOCAL_FULL_SUITE", "PUBLIC_DELIVERY"],
  sourceCommentBodySha256: "4c780655fbf30f513b5dbec5ea9b826da52b10be6848d34d5faceb17e47ef1e2",
  sourceCommentId: 5482272812,
  sourceIssueKey: "JoFe2/PANSPHAIRA#333",
});

type JsonRecord = Record<string, any>;

function sha256(value: string | Buffer): string {
  return createHash("sha256").update(value).digest("hex");
}

function digestValue(value: unknown): string {
  return sha256(canonicalJson(value));
}

function loadRecord(): JsonRecord {
  return JSON.parse(readFileSync(RECORD_PATH, "utf8")) as JsonRecord;
}

function requireCondition(condition: unknown, code: string): asserts condition {
  if (!condition) throw new Error(code);
}

function exactArray(actual: unknown, expected: readonly unknown[], code: string): void {
  requireCondition(Array.isArray(actual), `${code}:NOT_ARRAY`);
  requireCondition(canonicalJson(actual) === canonicalJson(expected), code);
}

function unique(values: readonly unknown[]): boolean {
  return new Set(values).size === values.length;
}

function recordDigest(record: JsonRecord): string {
  const copy = structuredClone(record) as JsonRecord;
  delete copy.integrity.recordSha256;
  return digestValue(copy);
}

function deepFreeze<T>(value: T): T {
  if (value !== null && typeof value === "object" && !Object.isFrozen(value)) {
    for (const child of Object.values(value as JsonRecord)) deepFreeze(child);
    Object.freeze(value);
  }
  return value;
}

function validateRecord(input: unknown): JsonRecord {
  requireCondition(input !== null && typeof input === "object" && !Array.isArray(input), "STRUCTURE");
  const record = structuredClone(input) as JsonRecord;
  requireCondition(record.schemaVersion === SCHEMA_VERSION, "SCHEMA_VERSION");
  requireCondition(record.taskId === "PORTFOLIO-PS333-INTEGRATE", "TASK_ID");
  requireCondition(record.status === "INTEGRATION_READY_FOR_DELIVERY_NOT_PARENT_CLOSED", "STATUS");
  requireCondition(record.capture?.currentPanSphairaMain?.commit === CAPTURED_MAIN, "CURRENT_MAIN");
  requireCondition(record.capture?.queueReadOnly === true && record.capture?.queueMutationCount === 0, "QUEUE_CAPTURE_MUTATED");
  requireCondition(record.capture?.productiveSystemsCalled === false, "PRODUCTIVE_EFFECT");
  requireCondition(record.authority?.frozenPortfolio?.manifestSha256 === D044_MANIFEST_SHA256, "D044_MANIFEST");
  requireCondition(record.authority?.frozenPortfolio?.authorityDecision === "D-044", "D044_AUTHORITY");
  exactArray(record.authority?.preservedDecisions, ["D-001", "D-002", "D-003", "D-004", "D-005", "D-006", "D-007"], "PROCESS_DECISIONS");

  const integrationAcceptance = record.parent?.integrationAcceptance;
  requireCondition(Array.isArray(integrationAcceptance), "PARENT_ACCEPTANCE");
  exactArray(integrationAcceptance.map((criterion: JsonRecord) => criterion.id), INTEGRATION_ACCEPTANCE_IDS, "PARENT_ACCEPTANCE_IDS");
  exactArray(integrationAcceptance.map(({ id, sourceAnchor, title }: JsonRecord) => ({ id, sourceAnchor, title })), EXPECTED_INTEGRATION_ACCEPTANCE, "PARENT_ACCEPTANCE_EXACT");
  requireCondition(integrationAcceptance.every((criterion: JsonRecord) => criterion.owner === "PORTFOLIO-PS333-INTEGRATE"), "PARENT_ACCEPTANCE_OWNER");
  requireCondition(unique(integrationAcceptance.map((criterion: JsonRecord) => criterion.id)), "PARENT_ACCEPTANCE_DUPLICATE");
  requireCondition(record.parent?.deferredAcceptance?.length === 1, "PARENT_DEFERRED_COUNT");
  requireCondition(record.parent.deferredAcceptance[0].id === "E-FND-1-AC05", "PARENT_DEFERRED_ID");
  requireCondition(record.parent.deferredAcceptance[0].sourceAnchor === EXPECTED_DEFERRED_ACCEPTANCE.sourceAnchor, "PARENT_DEFERRED_SOURCE");
  requireCondition(record.parent.deferredAcceptance[0].title === EXPECTED_DEFERRED_ACCEPTANCE.title, "PARENT_DEFERRED_TITLE");
  requireCondition(record.parent.deferredAcceptance[0].owner === "PORTFOLIO-PS333-ROOT-QS", "PARENT_DEFERRED_OWNER");
  requireCondition(record.parent.publicIssueState === "open", "PARENT_PREMATURE_CLOSURE");
  requireCondition(record.parent.remainingCriterion === EXPECTED_DEFERRED_ACCEPTANCE.title, "PARENT_REMAINING_CRITERION");

  const publicIssues = record.publicIssues;
  requireCondition(Array.isArray(publicIssues), "PUBLIC_ISSUES");
  exactArray(publicIssues.map((issue: JsonRecord) => issue.issueKey), PUBLIC_ISSUE_KEYS, "PUBLIC_ISSUE_SET");
  requireCondition(unique(publicIssues.map((issue: JsonRecord) => issue.issueKey)), "PUBLIC_ISSUE_DUPLICATE");
  const issueByKey = new Map<string, JsonRecord>();
  const allCommentIds: number[] = [];
  for (const issue of publicIssues) {
    requireCondition(issue.bodySha256 === EXPECTED_ISSUE_BODY_SHA256[issue.issueKey], `ISSUE_BODY:${issue.issueKey}`);
    requireCondition(issue.title === EXPECTED_ISSUE_TITLES[issue.issueKey], `ISSUE_TITLE:${issue.issueKey}`);
    requireCondition(issue.url === `https://github.com/${issue.issueKey.replace("#", "/issues/")}`, `ISSUE_URL:${issue.issueKey}`);
    requireCondition(issue.apiUrl === `https://api.github.com/repos/${issue.issueKey.replace("#", "/issues/")}`, `ISSUE_API_URL:${issue.issueKey}`);
    requireCondition(issue.repository === issue.issueKey.split("#")[0] && issue.number === Number(issue.issueKey.split("#")[1]), `ISSUE_IDENTITY:${issue.issueKey}`);
    requireCondition(Array.isArray(issue.comments) && issue.comments.length > 0, `ISSUE_THREAD:${issue.issueKey}`);
    requireCondition(issue.comments.every((comment: JsonRecord) => comment.author === "JoFe2" && comment.authorAssociation === "OWNER"), `ISSUE_THREAD_OWNER:${issue.issueKey}`);
    allCommentIds.push(...issue.comments.map((comment: JsonRecord) => comment.id));
    if (issue.issueKey === "JoFe2/PANSPHAIRA#333") {
      requireCondition(issue.state === "open" && issue.stateReason === null && issue.closedAt === null, "PARENT_PUBLIC_STATE");
    } else {
      requireCondition(issue.state === "closed" && issue.stateReason === "completed" && typeof issue.closedAt === "string", `CHILD_PUBLIC_STATE:${issue.issueKey}`);
    }
    issueByKey.set(issue.issueKey, issue);
  }
  requireCondition(unique(allCommentIds), "PUBLIC_COMMENT_DUPLICATE");

  const children = record.children;
  requireCondition(Array.isArray(children), "CHILDREN");
  exactArray(children.map((child: JsonRecord) => child.issueKey), CHILD_KEYS, "CHILD_SET");
  requireCondition(unique(children.map((child: JsonRecord) => child.issueKey)), "CHILD_DUPLICATE");
  const childByKey = new Map<string, JsonRecord>();
  const allChildAcceptanceIds: string[] = [];
  for (const [index, child] of children.entries()) {
    const key = child.issueKey as string;
    requireCondition(child.ordinal === index + 1, `CHILD_ORDINAL:${key}`);
    requireCondition(child.acceptanceOwner === EXPECTED_TERMINAL[key]?.owner, `ACCEPTANCE_OWNER:${key}`);
    requireCondition(Array.isArray(child.acceptance), `ACCEPTANCE:${key}`);
    const ids = child.acceptance.map((criterion: JsonRecord) => criterion.id);
    exactArray(ids, EXPECTED_ACCEPTANCE_IDS[key] ?? [], `ACCEPTANCE_SET:${key}`);
    exactArray(child.acceptance.map((criterion: JsonRecord) => criterion.title), EXPECTED_ACCEPTANCE_TITLES[key] ?? [], `ACCEPTANCE_TITLES:${key}`);
    requireCondition(unique(ids), `ACCEPTANCE_DUPLICATE:${key}`);
    requireCondition(child.acceptance.every((criterion: JsonRecord) => typeof criterion.title === "string" && criterion.title.length > 0), `ACCEPTANCE_TITLE:${key}`);
    allChildAcceptanceIds.push(...ids);
    exactArray(child.dependencies?.declared, EXPECTED_DEPENDENCIES[key]?.declared ?? [], `DECLARED_DEPENDENCIES:${key}`);
    exactArray(child.dependencies?.authorityPredecessors, EXPECTED_DEPENDENCIES[key]?.authorityPredecessors ?? [], `AUTHORITY_DEPENDENCIES:${key}`);
    childByKey.set(key, child);
  }
  requireCondition(unique(allChildAcceptanceIds), "GLOBAL_ACCEPTANCE_DUPLICATE");
  requireCondition(allChildAcceptanceIds.length === Object.values(EXPECTED_ACCEPTANCE_IDS).flat().length, "GLOBAL_ACCEPTANCE_COUNT");

  for (const child of children) {
    const key = child.issueKey as string;
    const expected = EXPECTED_DELIVERY[key];
    requireCondition(expected !== undefined, `DELIVERY_EXPECTATION:${key}`);
    const delivery = child.publicDelivery;
    requireCondition(Array.isArray(delivery?.chains) && delivery.chains.length > 0, `DELIVERY_CHAIN:${key}`);
    const finalChain = delivery.chains.at(-1) as JsonRecord;
    requireCondition(finalChain.disposition === "FINAL", `DELIVERY_FINAL_DISPOSITION:${key}`);
    requireCondition(finalChain.mergeSha === expected.finalMergeSha && delivery.finalMergeSha === expected.finalMergeSha, `DELIVERY_HEAD:${key}`);
    requireCondition(finalChain.pr?.number === expected.finalPrNumber && finalChain.pr?.headSha === expected.finalPrHead && finalChain.pr?.state === "closed", `PR_HEAD:${key}`);
    requireCondition(finalChain.prCi?.runId === expected.prCiRunId && finalChain.prCi?.headSha === expected.finalPrHead && finalChain.prCi?.status === "completed" && finalChain.prCi?.conclusion === "success", `PR_CI:${key}`);
    requireCondition(finalChain.mainCi?.runId === expected.mainCiRunId && finalChain.mainCi?.headSha === expected.finalMergeSha && finalChain.mainCi?.status === "completed" && finalChain.mainCi?.conclusion === "success", `MAIN_CI:${key}`);
    requireCondition(delivery.release?.id === expected.releaseId && delivery.release?.tag === expected.tag && delivery.release?.publishedAt === expected.releasePublishedAt, `RELEASE_IDENTITY:${key}`);
    requireCondition(delivery.release?.target === expected.finalMergeSha && delivery.release?.draft === false && delivery.release?.prerelease === false, `RELEASE_TARGET:${key}`);
    requireCondition(Array.isArray(delivery.release?.assets), `RELEASE_ASSETS:${key}`);
    requireCondition(delivery.relationToCapturedPanMain === expected.relation, `MAIN_RELATION:${key}`);
    requireCondition(delivery.receiptCommentId === expected.receiptCommentId, `PUBLIC_RECEIPT:${key}`);
    requireCondition(issueByKey.get(key)?.comments.some((comment: JsonRecord) => comment.id === delivery.receiptCommentId), `PUBLIC_RECEIPT_THREAD:${key}`);
    const readback = delivery.anonymousReadback;
    requireCondition(readback !== null && typeof readback === "object", `ANONYMOUS_READBACK_MISSING:${key}`);
    requireCondition(readback.status === "PASS" && readback.transport === "ANONYMOUS_GITHUB_REST_AND_GIT_LS_REMOTE", `ANONYMOUS_READBACK_STATUS:${key}`);
    requireCondition(readback.issueState === "closed" && readback.issueStateReason === "completed", `ANONYMOUS_READBACK_ISSUE:${key}`);
    requireCondition(readback.mainSha === expected.finalMergeSha && readback.releaseTarget === expected.finalMergeSha && readback.tagResolvedSha === expected.finalMergeSha, `ANONYMOUS_READBACK_HEAD:${key}`);
    requireCondition(readback.releaseDraft === false && readback.releasePrerelease === false && Array.isArray(readback.assets), `ANONYMOUS_READBACK_RELEASE:${key}`);

    const terminal = child.terminalProof;
    requireCondition(terminal?.kind === EXPECTED_TERMINAL[key]?.kind, `TERMINAL_KIND:${key}`);
    if (terminal.kind === "QUEUE_DONE") {
      requireCondition(terminal.taskId === EXPECTED_TERMINAL[key]?.owner, `QUEUE_TASK:${key}`);
      requireCondition(terminal.state === "DONE" && terminal.packageDoneSubstitution === false, `QUEUE_DONE:${key}`);
      requireCondition(terminal.claimGeneration === EXPECTED_TERMINAL[key]?.claimGeneration, `QUEUE_GENERATION:${key}`);
      requireCondition(terminal.resultHead === EXPECTED_TERMINAL[key]?.resultHead && terminal.resultHeadSemantics === EXPECTED_TERMINAL[key]?.resultHeadSemantics, `QUEUE_RESULT_HEAD:${key}`);
      requireCondition(terminal.unowned === true && canonicalJson(terminal.lease) === canonicalJson({ claimedAt: null, controllerId: null, heartbeatAt: null, workerPid: null, workerStartTicks: null }), `QUEUE_UNOWNED:${key}`);
      requireCondition(terminal.doneEvent?.eventId === EXPECTED_TERMINAL[key]?.eventId, `QUEUE_EVENT:${key}`);
      requireCondition(terminal.doneEvent?.fromState === "RELEASED" && terminal.doneEvent?.toState === "DONE", `QUEUE_TRANSITION:${key}`);
      requireCondition(terminal.doneEvent?.attempt === 0 && terminal.doneEvent?.occurredAtEpochSeconds === EXPECTED_TERMINAL[key]?.eventOccurredAt, `QUEUE_EVENT_EXACT:${key}`);
      requireCondition(terminal.deliveryFinalHead === expected.finalMergeSha, `QUEUE_DELIVERY_HEAD:${key}`);
    } else {
      requireCondition(!("taskId" in terminal) && !("state" in terminal), `DIRECT_INVENTED_QUEUE_ROW:${key}`);
      exactArray(terminal.queueLookup?.matchedTaskIds, [], `DIRECT_QUEUE_ABSENCE:${key}`);
      requireCondition(terminal.queueLookup?.predicate === `work_order_json.source_issue.repository+number == ${key}`, `DIRECT_QUEUE_PREDICATE:${key}`);
      requireCondition(canonicalJson(terminal.assertions) === canonicalJson({ anonymousReadbackPass: true, directControlLaneTerminal: true, issueClosedCompleted: true, noQueueRowMaterialized: true, releasePublished: true }), `DIRECT_TERMINAL_ASSERTIONS:${key}`);
      const comment = issueByKey.get(key)?.comments.find((candidate: JsonRecord) => candidate.id === terminal.ownerCommentId);
      requireCondition(comment?.bodySha256 === terminal.ownerCommentBodySha256, `DIRECT_OWNER_COMMENT:${key}`);
    }
  }

  const ps338 = childByKey.get("JoFe2/PANSPHAIRA#338")!;
  requireCondition(ps338.publicDelivery.chains.length === 2, "PS338_HISTORY_COUNT");
  requireCondition(ps338.publicDelivery.chains[0].disposition === "SUPERSEDED_MAIN_CI_FAILURE", "PS338_HISTORY_DISPOSITION");
  requireCondition(ps338.publicDelivery.chains[0].mainCi.conclusion === "failure", "PS338_HISTORY_FAILURE");
  const ps337MainCi = childByKey.get("JoFe2/PANSPHAIRA#337")!.publicDelivery.chains[0].mainCi;
  requireCondition(ps337MainCi.runAttempt === 2 && ps337MainCi.supersededAttempts?.[0]?.conclusion === "cancelled", "PS337_RUNNER_HISTORY");

  for (const child of children) {
    const dependencies = [...child.dependencies.declared, ...child.dependencies.authorityPredecessors] as string[];
    for (const dependencyKey of dependencies) {
      const dependency = childByKey.get(dependencyKey);
      requireCondition(dependency !== undefined, `DEPENDENCY_MISSING:${child.issueKey}:${dependencyKey}`);
      requireCondition(dependency.publicDelivery.release.publishedAt < child.publicDelivery.release.publishedAt, `DEPENDENCY_ORDER:${child.issueKey}:${dependencyKey}`);
    }
  }

  requireCondition(record.governance?.packageDoneSubstitutesForDone === false, "PACKAGE_DONE_GOVERNANCE");
  requireCondition(record.governance?.unknownMayPromoteToSuccess === false, "UNKNOWN_GOVERNANCE");
  requireCondition(record.governance?.releaseGovernance?.serialWithinRepository === true, "SERIAL_RELEASE_GOVERNANCE");
  requireCondition(sha256(readFileSync(record.governance.releaseGovernance.sourcePath)) === record.governance.releaseGovernance.sourceSha256, "RELEASE_GOVERNANCE_DIGEST");
  for (const repository of ["JoFe2/KaleidoSphere", "JoFe2/PANSPHAIRA"]) {
    const derived = children
      .filter((child: JsonRecord) => child.issueKey.startsWith(`${repository}#`))
      .map((child: JsonRecord) => ({ issueKey: child.issueKey, publishedAt: child.publicDelivery.release.publishedAt, tag: child.publicDelivery.release.tag }))
      .sort((left: JsonRecord, right: JsonRecord) => left.publishedAt.localeCompare(right.publishedAt));
    requireCondition(canonicalJson(derived) === canonicalJson(record.governance.serialReleaseOrder[repository]), `SERIAL_RELEASE_ORDER:${repository}`);
    const groups = new Map<string, number[]>();
    for (const entry of derived) {
      const match = entry.tag.match(/^(\d{4}_\d{2}_\d{2})_v(\d+)$/);
      requireCondition(match !== null, `SERIAL_RELEASE_TAG:${entry.tag}`);
      const sequence = Number(match[2]);
      groups.set(match[1], [...(groups.get(match[1]) ?? []), sequence]);
    }
    for (const sequence of groups.values()) {
      requireCondition(sequence.every((value, index) => index === 0 || value === sequence[index - 1]! + 1), `SERIAL_RELEASE_GAP:${repository}`);
    }
  }

  requireCondition(Array.isArray(record.nonclaims) && record.nonclaims.length === 7, "NONCLAIMS");
  requireCondition(record.nonclaims.some((claim: string) => claim.includes("does not close") && claim.includes("#333")), "NONCLAIM_PARENT");
  requireCondition(record.nonclaims.some((claim: string) => claim.includes("never invents DONE rows")), "NONCLAIM_DIRECT_QUEUE");
  requireCondition(record.nonclaims.some((claim: string) => claim.includes("UNKNOWN is never promoted")), "NONCLAIM_UNKNOWN");

  requireCondition(canonicalJson(record.processObservations) === canonicalJson(EXPECTED_PROCESS_OBSERVATIONS), "PROCESS_OBSERVATIONS");
  const observationSource = issueByKey.get(EXPECTED_PROCESS_OBSERVATIONS.sourceIssueKey)?.comments
    .find((comment: JsonRecord) => comment.id === EXPECTED_PROCESS_OBSERVATIONS.sourceCommentId);
  requireCondition(observationSource?.bodySha256 === EXPECTED_PROCESS_OBSERVATIONS.sourceCommentBodySha256, "PROCESS_OBSERVATION_SOURCE");

  requireCondition(record.integrity?.childSetSha256 === EXPECTED_CHILD_SET_SHA256, "CHILD_SET_DIGEST_FROZEN");
  requireCondition(digestValue(children) === record.integrity.childSetSha256, "CHILD_SET_DIGEST");
  requireCondition(record.integrity?.publicThreadSetSha256 === EXPECTED_PUBLIC_THREAD_SET_SHA256, "PUBLIC_THREAD_SET_DIGEST_FROZEN");
  requireCondition(digestValue(publicIssues) === record.integrity.publicThreadSetSha256, "PUBLIC_THREAD_SET_DIGEST");
  requireCondition(record.integrity?.recordSha256 === EXPECTED_RECORD_SHA256, "RECORD_DIGEST_FROZEN");
  requireCondition(recordDigest(record) === record.integrity.recordSha256, "RECORD_DIGEST");
  return deepFreeze(record);
}

function denied(mutate: (record: JsonRecord) => void, code: string): void {
  const candidate = loadRecord();
  mutate(candidate);
  assert.throws(() => validateRecord(candidate), (error: unknown) => error instanceof Error && error.message.startsWith(code), code);
}

function rebindIntegrity(record: JsonRecord): void {
  record.integrity.childSetSha256 = digestValue(record.children);
  record.integrity.publicThreadSetSha256 = digestValue(record.publicIssues);
  record.integrity.recordSha256 = recordDigest(record);
}

test("E-FND-1 cumulative record recomputes all seven child chains and AC01 through AC04 exactly once", () => {
  const first = validateRecord(loadRecord());
  const second = validateRecord(JSON.parse(readFileSync(RECORD_PATH, "utf8")));
  assert.equal(first.integrity.childSetSha256, EXPECTED_CHILD_SET_SHA256);
  assert.equal(first.integrity.publicThreadSetSha256, EXPECTED_PUBLIC_THREAD_SET_SHA256);
  assert.equal(first.integrity.recordSha256, EXPECTED_RECORD_SHA256);
  assert.equal(canonicalJson(first), canonicalJson(second));
  assert.deepEqual(first.parent.integrationAcceptance.map((criterion: JsonRecord) => criterion.id), [...INTEGRATION_ACCEPTANCE_IDS]);
});

test("exact public PR, CI, merge, release, tag, issue and owner-thread receipts bind every child", () => {
  const record = validateRecord(loadRecord());
  for (const child of record.children) {
    const finalChain = child.publicDelivery.chains.at(-1);
    assert.equal(finalChain.disposition, "FINAL");
    assert.equal(finalChain.mergeSha, child.publicDelivery.release.target);
    assert.equal(finalChain.mergeSha, child.publicDelivery.anonymousReadback.tagResolvedSha);
    assert.equal(finalChain.mainCi.conclusion, "success");
    assert.equal(child.publicDelivery.anonymousReadback.status, "PASS");
  }
});

test("Queue DONE and explicit direct-Control-Lane terminal reconciliation remain disjoint and exact", () => {
  const record = validateRecord(loadRecord());
  assert.equal(record.children.filter((child: JsonRecord) => child.terminalProof.kind === "QUEUE_DONE").length, 5);
  assert.equal(record.children.filter((child: JsonRecord) => child.terminalProof.kind === "DIRECT_CONTROL_LANE_TERMINAL").length, 2);
  assert.ok(record.children.filter((child: JsonRecord) => child.terminalProof.kind === "QUEUE_DONE").every((child: JsonRecord) => child.terminalProof.state === "DONE"));
  assert.ok(record.children.filter((child: JsonRecord) => child.terminalProof.kind === "DIRECT_CONTROL_LANE_TERMINAL").every((child: JsonRecord) => child.terminalProof.queueLookup.matchedTaskIds.length === 0));
});

test("missing or duplicate child and acceptance criterion fail closed", () => {
  denied((record) => { record.children.pop(); }, "CHILD_SET");
  denied((record) => { record.children.push(structuredClone(record.children[0])); }, "CHILD_SET");
  denied((record) => { record.children[0].acceptance.pop(); }, "ACCEPTANCE_SET:");
  denied((record) => { record.children[0].acceptance.push(structuredClone(record.children[0].acceptance[0])); }, "ACCEPTANCE_SET:");
  denied((record) => { record.parent.integrationAcceptance.push(structuredClone(record.parent.integrationAcceptance[0])); }, "PARENT_ACCEPTANCE_IDS");
});

test("stale or substituted issue, PR head, merge head and release fail closed", () => {
  denied((record) => { record.publicIssues[1].bodySha256 = "0".repeat(64); }, "ISSUE_BODY:");
  denied((record) => { record.publicIssues[5].title = "substituted"; }, "ISSUE_TITLE:");
  denied((record) => { record.children[4].acceptance[3].title = "substituted"; }, "ACCEPTANCE_TITLES:");
  denied((record) => { record.children[0].publicDelivery.chains[0].pr.headSha = "0".repeat(40); }, "PR_HEAD:");
  denied((record) => { record.children[0].publicDelivery.finalMergeSha = "0".repeat(40); }, "DELIVERY_HEAD:");
  denied((record) => { record.children[0].publicDelivery.release.target = "0".repeat(40); }, "RELEASE_TARGET:");
  denied((record) => { record.capture.currentPanSphairaMain.commit = "0".repeat(40); }, "CURRENT_MAIN");
});

test("absent anonymous readback, PACKAGE_DONE, invented Queue row and UNKNOWN success fail closed", () => {
  denied((record) => { delete record.children[0].publicDelivery.anonymousReadback; }, "ANONYMOUS_READBACK_MISSING:");
  denied((record) => { record.children[2].terminalProof.state = "PACKAGE_DONE"; }, "QUEUE_DONE:");
  denied((record) => { record.children[0].terminalProof.taskId = "INVENTED"; }, "DIRECT_INVENTED_QUEUE_ROW:");
  denied((record) => {
    record.children[0].publicDelivery.anonymousReadback.issueState = "UNKNOWN";
    record.children[0].publicDelivery.anonymousReadback.status = "PASS";
  }, "ANONYMOUS_READBACK_ISSUE:");
});

test("changed public thread and fully re-digested post-capture substitution fail closed", () => {
  denied((record) => { record.publicIssues[0].comments[1].bodySha256 = "0".repeat(64); }, "PUBLIC_THREAD_SET_DIGEST");
  const redigested = loadRecord();
  redigested.capture.captureCompletedAt = "2099-01-01T00:00:00Z";
  rebindIntegrity(redigested);
  assert.throws(() => validateRecord(redigested), (error: unknown) => error instanceof Error && error.message === "RECORD_DIGEST_FROZEN");
});

test("validated snapshot is detached and deeply immutable against post-validation mutation", () => {
  const mutable = loadRecord();
  const verified = validateRecord(mutable);
  mutable.children[0].publicDelivery.finalMergeSha = "0".repeat(40);
  assert.equal(verified.children[0].publicDelivery.finalMergeSha, EXPECTED_DELIVERY[CHILD_KEYS[0]]!.finalMergeSha);
  assert.throws(() => validateRecord(mutable), /DELIVERY_HEAD/);
  assert.throws(() => { verified.children.push(structuredClone(verified.children[0])); }, TypeError);
  assert.throws(() => { verified.children[0].publicDelivery.finalMergeSha = "0".repeat(40); }, TypeError);
});

test("serial canonical registration binds package, repository-only classification, DAG and root SHA256 integrity", () => {
  const packageJson = JSON.parse(readFileSync("package.json", "utf8")) as JsonRecord;
  assert.equal(packageJson.scripts["trust-compatibility-foundation-closure:test"], TEST_COMMAND);
  assert.match(packageJson.scripts.pretest, /npm run trust-compatibility-foundation-closure:test/);

  const manifestLines = readFileSync("release/public-files.manifest", "utf8").split("\n");
  for (const path of [RECORD_PATH, "tests/trust-compatibility-foundation-closure.test.ts"]) {
    assert.equal(manifestLines.filter((line) => line === `${path}\t${path}\t0644`).length, 0, `${path}: exact public-input snapshot remains repository-only`);
  }

  const dag = JSON.parse(readFileSync("verification/verification-dag-v2.json", "utf8")) as JsonRecord;
  const integrityOwners = dag.nodes.filter((node: JsonRecord) => node.id === "repository-integrity");
  assert.equal(integrityOwners.length, 1);
  const integrityOwner = integrityOwners[0];
  assert.ok(integrityOwner.dependsOn.includes("cks-12-closed-learning-loop-v1"));
  assert.ok(integrityOwner.dependsOn.includes("external-bi-service-v2"));
  assert.ok(integrityOwner.ownedTests.includes(TEST_COMMAND));
  for (const [path, role] of [["tests/trust-compatibility-foundation-closure.test.ts", "VALIDATOR"], [RECORD_PATH, "DERIVED_EVIDENCE"]] as const) {
    const inputs = integrityOwner.inputs.filter((input: JsonRecord) => input.path === path);
    assert.equal(inputs.length, 1, path);
    assert.equal(inputs[0].role, role, path);
    assert.equal(inputs[0].sha256, sha256(readFileSync(path)), path);
  }

  const sums = readFileSync("SHA256SUMS", "utf8").split("\n");
  for (const path of [RECORD_PATH, "tests/trust-compatibility-foundation-closure.test.ts"]) {
    assert.equal(sums.filter((line) => line === `${sha256(readFileSync(path))}  ./${path}`).length, 1, path);
  }
});
