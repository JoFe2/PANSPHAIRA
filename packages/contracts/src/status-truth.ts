/**
 * PS380-STATUS-TRUTH-01 — canonical status-truth generator.
 *
 * A fail-closed, content-addressed contract for turning an *explicit,
 * allowlisted* issue/epic/release manifest plus an *anonymous provider
 * readback* into a bounded, deterministic public status snapshot.
 *
 * The generator never edits issues and never rewrites historical text. It
 * binds retrieval time, source URLs and exact state digests (each recomputed,
 * never trusted), projects the eight lifecycle stages with maturity
 * (planned / delivered / falsified), and fails on material contradictions
 * rather than silently repairing them:
 *
 *   - a closed issue shown as open/planned, an open acceptance shown complete,
 *     a missing required release/readback, a stale checklist, or a
 *     label/state disagreement;
 *   - a red, missing, stale or wrong-head *required* workflow can never
 *     project `closure verified` or `queue DONE`;
 *   - forward-only release / Latest reconciliation with the historical
 *     release body immutable;
 *   - partial provider data (incomplete pagination, missing allowlisted
 *     items, a tampered digest, or a broken retrieval binding) fails closed.
 *
 * Checkbox text is never stronger than provider state: a fully-checked
 * checklist alone can never upgrade an item's maturity or project a release /
 * DONE. The projection is a pure function of the (recomputed) snapshot state,
 * so roadmap / epic views can link or embed it instead of hand-maintained
 * closed-issue lists.
 */

import { createHash } from "node:crypto";
import { types } from "node:util";

import { canonicalJson } from "./canonical-json.js";

// ---------------------------------------------------------------------------
// Schema versions
// ---------------------------------------------------------------------------

export const STATUS_TRUTH_MANIFEST_SCHEMA_V1 = "ps380-status-truth-manifest.v1" as const;
export const STATUS_TRUTH_READBACK_SCHEMA_V1 = "ps380-status-truth-readback.v1" as const;
export const STATUS_TRUTH_SNAPSHOT_SCHEMA_V1 = "ps380-status-truth-snapshot.v1" as const;

// ---------------------------------------------------------------------------
// Closed vocabularies
// ---------------------------------------------------------------------------

/**
 * The eight lifecycle stages, in their fixed projection order. A red,
 * missing, stale or wrong-head required workflow caps the last two projections
 * (`queueDone`, `closureVerified`) without rewriting the provider's truth.
 */
export const STATUS_TRUTH_LIFECYCLE_STAGES_V1 = [
  "codePresent",
  "testsPassed",
  "runtimeObserved",
  "merged",
  "released",
  "readbackVerified",
  "issueClosed",
  "queueDone",
] as const;
export type StatusTruthLifecycleStage = (typeof STATUS_TRUTH_LIFECYCLE_STAGES_V1)[number];

/** Maturity is provider truth, never checkbox text. */
export const STATUS_TRUTH_MATURITIES_V1 = ["PLANNED", "DELIVERED", "FALSIFIED"] as const;
export type StatusTruthMaturity = (typeof STATUS_TRUTH_MATURITIES_V1)[number];

/** A required workflow must be GREEN to let closure / DONE be projected. */
export const STATUS_TRUTH_WORKFLOW_STATES_V1 = [
  "GREEN",
  "RED",
  "MISSING",
  "STALE",
  "WRONG_HEAD",
  "NONE",
] as const;
export type StatusTruthWorkflowState = (typeof STATUS_TRUTH_WORKFLOW_STATES_V1)[number];

export const STATUS_TRUTH_ITEM_KINDS_V1 = ["ISSUE", "EPIC", "RELEASE"] as const;
export type StatusTruthItemKind = (typeof STATUS_TRUTH_ITEM_KINDS_V1)[number];

// ---------------------------------------------------------------------------
// Reason codes
// ---------------------------------------------------------------------------

type StatusTruthReasonCode =
  | "STATUS_TRUTH_MANIFEST_SCHEMA_DENIED"
  | "STATUS_TRUTH_READBACK_SCHEMA_DENIED"
  | "STATUS_TRUTH_MANIFEST_DIGEST_DENIED"
  | "STATUS_TRUTH_READBACK_DIGEST_DENIED"
  | "STATUS_TRUTH_RETRIEVAL_BINDING_DENIED"
  | "STATUS_TRUTH_RELEASE_FORWARD_ONLY_DENIED"
  | "STATUS_TRUTH_RELEASE_BODY_MUTATION_DENIED"
  | "STATUS_TRUTH_PAGINATION_INCOMPLETE_DENIED"
  | "STATUS_TRUTH_ITEM_MISMATCH_DENIED"
  | "STATUS_TRUTH_ISSUE_STATE_CONTRADICTION_DENIED"
  | "STATUS_TRUTH_ACCEPTANCE_SHOWN_COMPLETE_DENIED"
  | "STATUS_TRUTH_MISSING_RELEASE_DENIED"
  | "STATUS_TRUTH_MISSING_READBACK_DENIED"
  | "STATUS_TRUTH_CHECKLIST_STALE_DENIED"
  | "STATUS_TRUTH_LABEL_STATE_CONTRADICTION_DENIED"
  | "STATUS_TRUTH_CLOSURE_PROJECTION_DENIED"
  | "STATUS_TRUTH_PROJECTION_DIGEST_DENIED";

const CODE = {
  manifestSchema: "STATUS_TRUTH_MANIFEST_SCHEMA_DENIED",
  readbackSchema: "STATUS_TRUTH_READBACK_SCHEMA_DENIED",
  manifestDigest: "STATUS_TRUTH_MANIFEST_DIGEST_DENIED",
  readbackDigest: "STATUS_TRUTH_READBACK_DIGEST_DENIED",
  retrievalBinding: "STATUS_TRUTH_RETRIEVAL_BINDING_DENIED",
  releaseForwardOnly: "STATUS_TRUTH_RELEASE_FORWARD_ONLY_DENIED",
  releaseBodyMutation: "STATUS_TRUTH_RELEASE_BODY_MUTATION_DENIED",
  paginationIncomplete: "STATUS_TRUTH_PAGINATION_INCOMPLETE_DENIED",
  itemMismatch: "STATUS_TRUTH_ITEM_MISMATCH_DENIED",
  issueStateContradiction: "STATUS_TRUTH_ISSUE_STATE_CONTRADICTION_DENIED",
  acceptanceShownComplete: "STATUS_TRUTH_ACCEPTANCE_SHOWN_COMPLETE_DENIED",
  missingRelease: "STATUS_TRUTH_MISSING_RELEASE_DENIED",
  missingReadback: "STATUS_TRUTH_MISSING_READBACK_DENIED",
  checklistStale: "STATUS_TRUTH_CHECKLIST_STALE_DENIED",
  labelStateContradiction: "STATUS_TRUTH_LABEL_STATE_CONTRADICTION_DENIED",
  closureProjection: "STATUS_TRUTH_CLOSURE_PROJECTION_DENIED",
  projectionDigest: "STATUS_TRUTH_PROJECTION_DIGEST_DENIED",
} as const satisfies Record<string, StatusTruthReasonCode>;

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export interface StatusTruthRetrieval {
  readonly retrievedAt: string;
  readonly sourceUrl: string;
  readonly organization: string;
  readonly repository: string;
}

export interface StatusTruthRequired {
  readonly releaseRequired: boolean;
  readonly readbackRequired: boolean;
  readonly workflowRequired: boolean;
}

export interface StatusTruthManifestItem {
  readonly itemId: string;
  readonly kind: StatusTruthItemKind;
  readonly issueNumber: number;
  readonly sourceUrl: string;
  readonly parentEpicId: string | null;
  readonly required: StatusTruthRequired;
}

export interface StatusTruthManifestRelease {
  readonly releaseTag: string;
  readonly releaseUrl: string;
  readonly releaseBodyDigest: string;
}

export interface StatusTruthManifestV1 {
  readonly schemaVersion: typeof STATUS_TRUTH_MANIFEST_SCHEMA_V1;
  readonly manifestId: string;
  readonly retrieval: StatusTruthRetrieval;
  readonly items: readonly StatusTruthManifestItem[];
  readonly release: StatusTruthManifestRelease;
  readonly manifestDigest: string;
}

export interface StatusTruthChecklist {
  readonly total: number;
  readonly checked: number;
}

export interface StatusTruthPr {
  readonly number: number;
  readonly merged: boolean;
}

export interface StatusTruthWorkflow {
  readonly required: boolean;
  readonly state: StatusTruthWorkflowState;
  readonly headCommit: string | null;
  readonly runUrl: string | null;
}

export interface StatusTruthLifecycle {
  readonly codePresent: boolean;
  readonly testsPassed: boolean;
  readonly runtimeObserved: boolean;
  readonly merged: boolean;
  readonly released: boolean;
  readonly readbackVerified: boolean;
  readonly issueClosed: boolean;
  readonly queueDone: boolean;
}

export interface StatusTruthReadbackItem {
  readonly itemId: string;
  readonly issueNumber: number;
  readonly open: boolean;
  readonly labels: readonly string[];
  readonly checklist: StatusTruthChecklist;
  readonly pr: StatusTruthPr;
  readonly workflow: StatusTruthWorkflow;
  readonly maturity: StatusTruthMaturity;
  readonly lifecycle: StatusTruthLifecycle;
}

export interface StatusTruthPagination {
  readonly complete: boolean;
  readonly expectedItems: number;
  readonly observedItems: number;
}

export interface StatusTruthReadbackRelease {
  readonly latestTag: string;
  readonly releaseBodyDigest: string;
}

export interface StatusTruthReceipt {
  readonly readbackUrl: string;
  readonly readbackDigest: string;
  readonly readbackTimestamp: string;
}

export interface StatusTruthProviderReadbackV1 {
  readonly schemaVersion: typeof STATUS_TRUTH_READBACK_SCHEMA_V1;
  readonly readbackId: string;
  readonly retrieval: StatusTruthRetrieval;
  readonly pagination: StatusTruthPagination;
  readonly items: readonly StatusTruthReadbackItem[];
  readonly release: StatusTruthReadbackRelease;
  readonly readback: StatusTruthReceipt;
  readonly readbackDigest: string;
}

export interface StatusTruthProjection {
  readonly codePresent: boolean;
  readonly testsPassed: boolean;
  readonly runtimeObserved: boolean;
  readonly merged: boolean;
  readonly released: boolean;
  readonly readbackVerified: boolean;
  readonly issueClosed: boolean;
  readonly queueDone: boolean;
  readonly closureVerified: boolean;
}

export interface StatusTruthSnapshotItem {
  readonly itemId: string;
  readonly issueNumber: number;
  readonly sourceUrl: string;
  readonly issueOpen: boolean;
  readonly labels: readonly string[];
  readonly checklist: StatusTruthChecklist;
  readonly pr: StatusTruthPr;
  readonly maturity: StatusTruthMaturity;
  readonly projection: StatusTruthProjection;
  readonly projectionDigest: string;
}

export interface StatusTruthSnapshotRelease {
  readonly releaseTag: string;
  readonly latestTag: string;
  readonly releaseBodyDigest: string;
  readonly forwardOnly: boolean;
}

export interface StatusTruthSnapshotV1 {
  readonly schemaVersion: typeof STATUS_TRUTH_SNAPSHOT_SCHEMA_V1;
  readonly manifestId: string;
  readonly readbackId: string;
  readonly retrieval: StatusTruthRetrieval;
  readonly manifestDigest: string;
  readonly readbackDigest: string;
  readonly stateDigest: string;
  readonly release: StatusTruthSnapshotRelease;
  readonly items: readonly StatusTruthSnapshotItem[];
  readonly markdown: string;
  readonly snapshotDigest: string;
}

// ---------------------------------------------------------------------------
// Result discriminated unions
// ---------------------------------------------------------------------------

interface Denied {
  readonly outcome: "DENIED";
  readonly reasonCodes: readonly string[];
}

export type StatusTruthManifestResult =
  | { readonly outcome: "BUILT"; readonly manifest: StatusTruthManifestV1 }
  | Denied;

export type StatusTruthReadbackResult =
  | { readonly outcome: "BUILT"; readonly readback: StatusTruthProviderReadbackV1 }
  | Denied;

export type StatusTruthGenerateResult =
  | { readonly outcome: "GENERATED"; readonly snapshot: StatusTruthSnapshotV1 }
  | Denied;

export type StatusTruthVerificationV1 =
  | { readonly outcome: "VERIFIED" }
  | Denied;

export interface StatusTruthExpectedDigests {
  readonly stateDigest: string;
  readonly snapshotDigest: string;
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

type AnyRecord = Record<string, unknown>;
type AnyArray = unknown[];

const HEX64 = /^[a-f0-9]{64}$/;
const SHA40 = /^[a-f0-9]{40}$/;
const RFC3339 = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,9})?(?:Z|[+-]\d{2}:\d{2})$/;
const ASCII_VISIBLE = /^[\x21-\x7E]+$/;
const HTTPS_URL = /^https:\/\/\S+$/;
const RELEASE_TAG = /^(\d{4})_(\d{2})_(\d{2})_v(\d+)$/;

function isPlainObject(value: unknown): value is AnyRecord {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return false;
  if (types.isProxy(value)) return false;
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
}

/**
 * Reject non-plain prototypes, proxies, accessors, cycles and non-finite
 * numbers. Only deep-plain, finite JSON structures are admitted.
 */
function deepPlain(value: unknown, seen: Set<object>): boolean {
  if (typeof value === "string" || typeof value === "boolean") return true;
  if (typeof value === "number") return Number.isFinite(value);
  if (value === null) return true;
  if (Array.isArray(value)) {
    if (seen.has(value)) return false;
    seen.add(value);
    return value.every((entry) => deepPlain(entry, seen));
  }
  if (isPlainObject(value)) {
    if (seen.has(value)) return false;
    seen.add(value);
    for (const key of Object.getOwnPropertyNames(value)) {
      const descriptor = Object.getOwnPropertyDescriptor(value, key);
      if (descriptor !== undefined && (descriptor.get !== undefined || descriptor.set !== undefined)) {
        return false;
      }
    }
    return Object.values(value).every((entry) => deepPlain(entry, seen));
  }
  return false;
}

const digestHex = (value: unknown): string =>
  createHash("sha256").update(canonicalJson(value), "utf8").digest("hex");

function freeze<T>(value: T): T {
  if (value !== null && typeof value === "object" && !Object.isFrozen(value)) {
    for (const entry of Object.values(value as AnyRecord)) freeze(entry);
    Object.freeze(value);
  }
  return value;
}

function asExactRecord(value: unknown, keys: readonly string[]): value is AnyRecord {
  if (!isPlainObject(value)) return false;
  const actual = Object.keys(value).sort();
  return canonicalJson(actual) === canonicalJson([...keys].sort());
}

const isHex64 = (value: unknown): value is string => typeof value === "string" && HEX64.test(value);
const isSha40 = (value: unknown): value is string => typeof value === "string" && SHA40.test(value);
const isTimestamp = (value: unknown): value is string => typeof value === "string" && RFC3339.test(value);
const isHttpsUrl = (value: unknown): value is string => typeof value === "string" && HTTPS_URL.test(value);
const isBool = (value: unknown): value is boolean => typeof value === "boolean";
const isInt = (value: unknown, min: number): value is number =>
  typeof value === "number" && Number.isInteger(value) && value >= min;
const isIdentifier = (value: unknown, max: number): value is string =>
  typeof value === "string" && value.length >= 1 && value.length <= max && ASCII_VISIBLE.test(value);
const isEnum = (value: unknown, members: readonly string[]): value is string =>
  typeof value === "string" && members.includes(value);

function deny(defects: Set<StatusTruthReasonCode>): Denied {
  return freeze({ outcome: "DENIED", reasonCodes: [...defects].sort() }) as Denied;
}

// ---------------------------------------------------------------------------
// Key sets
// ---------------------------------------------------------------------------

const MANIFEST_CORE_KEYS = ["manifestId", "retrieval", "items", "release"] as const;
const RETRIEVAL_KEYS = ["retrievedAt", "sourceUrl", "organization", "repository"] as const;
const MANIFEST_ITEM_KEYS = ["itemId", "kind", "issueNumber", "sourceUrl", "parentEpicId", "required"] as const;
const REQUIRED_KEYS = ["releaseRequired", "readbackRequired", "workflowRequired"] as const;
const MANIFEST_RELEASE_KEYS = ["releaseTag", "releaseUrl", "releaseBodyDigest"] as const;

const READBACK_CORE_KEYS = ["readbackId", "retrieval", "pagination", "items", "release", "readback"] as const;
const PAGINATION_KEYS = ["complete", "expectedItems", "observedItems"] as const;
const READBACK_ITEM_KEYS = ["itemId", "issueNumber", "open", "labels", "checklist", "pr", "workflow", "maturity", "lifecycle"] as const;
const CHECKLIST_KEYS = ["total", "checked"] as const;
const PR_KEYS = ["number", "merged"] as const;
const WORKFLOW_KEYS = ["required", "state", "headCommit", "runUrl"] as const;
const LIFECYCLE_KEYS = STATUS_TRUTH_LIFECYCLE_STAGES_V1 as readonly string[];
const READBACK_RELEASE_KEYS = ["latestTag", "releaseBodyDigest"] as const;
const READBACK_RECEIPT_KEYS = ["readbackUrl", "readbackDigest", "readbackTimestamp"] as const;
const SNAPSHOT_KEYS = [
  "schemaVersion",
  "manifestId",
  "readbackId",
  "retrieval",
  "manifestDigest",
  "readbackDigest",
  "stateDigest",
  "release",
  "items",
  "markdown",
  "snapshotDigest",
] as const;

// ---------------------------------------------------------------------------
// Field validators
// ---------------------------------------------------------------------------

function validRetrieval(value: unknown): value is StatusTruthRetrieval {
  return (
    asExactRecord(value, RETRIEVAL_KEYS) &&
    isTimestamp(value.retrievedAt) &&
    isHttpsUrl(value.sourceUrl) &&
    isIdentifier(value.organization, 64) &&
    isIdentifier(value.repository, 64)
  );
}

function validManifestItem(value: unknown): value is StatusTruthManifestItem {
  if (!asExactRecord(value, MANIFEST_ITEM_KEYS)) return false;
  const item = value as AnyRecord;
  const required = item.required;
  return (
    isIdentifier(item.itemId, 80) &&
    isEnum(item.kind, STATUS_TRUTH_ITEM_KINDS_V1) &&
    isInt(item.issueNumber, 0) &&
    isHttpsUrl(item.sourceUrl) &&
    (item.parentEpicId === null || isIdentifier(item.parentEpicId, 80)) &&
    asExactRecord(required, REQUIRED_KEYS) &&
    isBool((required as AnyRecord).releaseRequired) &&
    isBool((required as AnyRecord).readbackRequired) &&
    isBool((required as AnyRecord).workflowRequired)
  );
}

function validManifestCore(value: unknown): value is AnyRecord {
  if (!asExactRecord(value, MANIFEST_CORE_KEYS)) return false;
  const manifest = value as AnyRecord;
  const release = manifest.release;
  return (
    isIdentifier(manifest.manifestId, 80) &&
    validRetrieval(manifest.retrieval) &&
    Array.isArray(manifest.items) &&
    manifest.items.length >= 1 &&
    manifest.items.every(validManifestItem) &&
    asExactRecord(release, MANIFEST_RELEASE_KEYS) &&
    isIdentifier((release as AnyRecord).releaseTag, 80) &&
    isHttpsUrl((release as AnyRecord).releaseUrl) &&
    isHex64((release as AnyRecord).releaseBodyDigest)
  );
}

function validReadbackItem(value: unknown): value is StatusTruthReadbackItem {
  if (!asExactRecord(value, READBACK_ITEM_KEYS)) return false;
  const item = value as AnyRecord;
  const checklist = item.checklist;
  const pr = item.pr;
  const workflow = item.workflow;
  const lifecycle = item.lifecycle;
  const labels = item.labels;
  return (
    isIdentifier(item.itemId, 80) &&
    isInt(item.issueNumber, 0) &&
    isBool(item.open) &&
    Array.isArray(labels) &&
    labels.every((label) => isIdentifier(label, 64)) &&
    asExactRecord(checklist, CHECKLIST_KEYS) &&
    isInt((checklist as AnyRecord).total, 0) &&
    isInt((checklist as AnyRecord).checked, 0) &&
    ((checklist as AnyRecord).checked as number) <= ((checklist as AnyRecord).total as number) &&
    asExactRecord(pr, PR_KEYS) &&
    isInt((pr as AnyRecord).number, 0) &&
    isBool((pr as AnyRecord).merged) &&
    asExactRecord(workflow, WORKFLOW_KEYS) &&
    isBool((workflow as AnyRecord).required) &&
    isEnum((workflow as AnyRecord).state, STATUS_TRUTH_WORKFLOW_STATES_V1) &&
    (isSha40((workflow as AnyRecord).headCommit) || (workflow as AnyRecord).headCommit === null) &&
    (isHttpsUrl((workflow as AnyRecord).runUrl) || (workflow as AnyRecord).runUrl === null) &&
    isEnum(item.maturity, STATUS_TRUTH_MATURITIES_V1) &&
    asExactRecord(lifecycle, LIFECYCLE_KEYS) &&
    LIFECYCLE_KEYS.every((key) => isBool((lifecycle as AnyRecord)[key]))
  );
}

function validReadbackCore(value: unknown): value is AnyRecord {
  if (!asExactRecord(value, READBACK_CORE_KEYS)) return false;
  const readback = value as AnyRecord;
  const pagination = readback.pagination;
  const release = readback.release;
  const receipt = readback.readback;
  return (
    isIdentifier(readback.readbackId, 80) &&
    validRetrieval(readback.retrieval) &&
    asExactRecord(pagination, PAGINATION_KEYS) &&
    isBool((pagination as AnyRecord).complete) &&
    isInt((pagination as AnyRecord).expectedItems, 0) &&
    isInt((pagination as AnyRecord).observedItems, 0) &&
    Array.isArray(readback.items) &&
    readback.items.every(validReadbackItem) &&
    asExactRecord(release, READBACK_RELEASE_KEYS) &&
    isIdentifier((release as AnyRecord).latestTag, 80) &&
    isHex64((release as AnyRecord).releaseBodyDigest) &&
    asExactRecord(receipt, READBACK_RECEIPT_KEYS) &&
    isHttpsUrl((receipt as AnyRecord).readbackUrl) &&
    // A real anonymous provider readback is digested; "NONE" is not a digest.
    isHex64((receipt as AnyRecord).readbackDigest) &&
    isTimestamp((receipt as AnyRecord).readbackTimestamp)
  );
}

// ---------------------------------------------------------------------------
// Forward-only release / Latest comparison
// ---------------------------------------------------------------------------

function tagKey(tag: string): [number, number] | null {
  const match = RELEASE_TAG.exec(tag);
  if (match === null) return null;
  const date = Number(`${match[1]}${match[2]}${match[3]}`);
  const version = Number(match[4]);
  return [date, version];
}

/**
 * Forward-only reconciliation: the provider's Latest release must be the same
 * as, or newer than, the scoped release. Unknown ordering is not forward.
 */
function compareTags(latest: string, scoped: string): number {
  const a = tagKey(latest);
  const b = tagKey(scoped);
  if (a === null || b === null) return -1;
  if (a[0] !== b[0]) return a[0] < b[0] ? -1 : 1;
  if (a[1] !== b[1]) return a[1] < b[1] ? -1 : 1;
  return 0;
}

// ---------------------------------------------------------------------------
// Normalization (accepts a built record or a raw record; recomputes digests)
// ---------------------------------------------------------------------------

type NormalizeResult =
  | { readonly ok: true; readonly body: AnyRecord; readonly digest: string }
  | { readonly ok: false; readonly code: StatusTruthReasonCode };

function normalizeManifest(arg: unknown): NormalizeResult {
  if (!deepPlain(arg, new Set())) return { ok: false, code: CODE.manifestSchema };
  const record = arg as AnyRecord;
  const hasDigest = Object.prototype.hasOwnProperty.call(record, "manifestDigest");
  const body: AnyRecord = hasDigest ? { ...record } : { ...record, schemaVersion: STATUS_TRUTH_MANIFEST_SCHEMA_V1 };
  if (hasDigest) delete body.manifestDigest;
  const core: AnyRecord = { ...body };
  delete core.schemaVersion;
  if (!validManifestCore(core)) return { ok: false, code: CODE.manifestSchema };
  const digest = digestHex(body);
  if (hasDigest && record.manifestDigest !== digest) return { ok: false, code: CODE.manifestDigest };
  return { ok: true, body, digest };
}

function normalizeReadback(arg: unknown): NormalizeResult {
  if (!deepPlain(arg, new Set())) return { ok: false, code: CODE.readbackSchema };
  const record = arg as AnyRecord;
  const hasDigest = Object.prototype.hasOwnProperty.call(record, "readbackDigest");
  const body: AnyRecord = hasDigest ? { ...record } : { ...record, schemaVersion: STATUS_TRUTH_READBACK_SCHEMA_V1 };
  if (hasDigest) delete body.readbackDigest;
  const core: AnyRecord = { ...body };
  delete core.schemaVersion;
  if (!validReadbackCore(core)) return { ok: false, code: CODE.readbackSchema };
  const digest = digestHex(body);
  if (hasDigest && record.readbackDigest !== digest) return { ok: false, code: CODE.readbackDigest };
  return { ok: true, body, digest };
}

// ---------------------------------------------------------------------------
// Per-item contradiction analysis
// ---------------------------------------------------------------------------

const LABEL_MATURITY = new Map<string, StatusTruthMaturity>([
  ["delivered", "DELIVERED"],
  ["planned", "PLANNED"],
  ["falsified", "FALSIFIED"],
]);

function analyzeItem(
  itemId: string,
  readbackItem: AnyRecord,
  manifestRequired: StatusTruthRequired | undefined,
  defects: Set<StatusTruthReasonCode>,
): void {
  if (manifestRequired === undefined) {
    defects.add(CODE.itemMismatch);
    return;
  }
  const lifecycle = readbackItem.lifecycle as AnyRecord;
  const workflow = readbackItem.workflow as AnyRecord;
  const checklist = readbackItem.checklist as AnyRecord;
  const labels = readbackItem.labels as AnyArray;
  const maturity = readbackItem.maturity as StatusTruthMaturity;

  const gateBlocked = workflow.required === true && workflow.state !== "GREEN";
  const gateGreen = !gateBlocked;
  const claimsComplete = maturity === "DELIVERED" || lifecycle.queueDone === true;

  // A red / missing / stale / wrong-head required workflow can never back a
  // provider claim of DONE.
  if (gateBlocked && lifecycle.queueDone === true) defects.add(CODE.closureProjection);

  // Open acceptance shown complete: DELIVERED but the queue is not DONE, over a
  // green gate (a red gate explains the not-done and is handled above).
  if (maturity === "DELIVERED" && lifecycle.queueDone === false && gateGreen) {
    defects.add(CODE.acceptanceShownComplete);
  }

  // Issue state contradiction: the provider's `open` / maturity disagrees with
  // the lifecycle truth.
  if (readbackItem.open === true && (lifecycle.issueClosed === true || maturity === "DELIVERED")) {
    defects.add(CODE.issueStateContradiction);
  }
  if (maturity === "PLANNED" && (lifecycle.issueClosed === true || lifecycle.queueDone === true)) {
    defects.add(CODE.issueStateContradiction);
  }

  // A complete item must carry its required release / readback.
  if (claimsComplete && manifestRequired.releaseRequired === true && lifecycle.released === false) {
    defects.add(CODE.missingRelease);
  }
  if (claimsComplete && manifestRequired.readbackRequired === true && lifecycle.readbackVerified === false) {
    defects.add(CODE.missingReadback);
  }

  // A delivered item with an incomplete checklist is stale.
  if (maturity === "DELIVERED" && (checklist.checked as number) < (checklist.total as number)) {
    defects.add(CODE.checklistStale);
  }

  // A label that disagrees with maturity is a state disagreement.
  for (const label of labels) {
    const expected = LABEL_MATURITY.get((label as string).toLowerCase());
    if (expected !== undefined && expected !== maturity) {
      defects.add(CODE.labelStateContradiction);
      break;
    }
  }
}

// ---------------------------------------------------------------------------
// Projection + deterministic markdown
// ---------------------------------------------------------------------------

function buildProjection(
  lifecycle: AnyRecord,
  workflow: AnyRecord,
): StatusTruthProjection {
  const gateBlocked = workflow.required === true && workflow.state !== "GREEN";
  const projection: AnyRecord = {};
  for (const stage of STATUS_TRUTH_LIFECYCLE_STAGES_V1) {
    projection[stage] =
      stage === "queueDone"
        ? lifecycle.queueDone === true && !gateBlocked
        : lifecycle[stage] === true;
  }
  projection.closureVerified = lifecycle.issueClosed === true && !gateBlocked;
  return projection as unknown as StatusTruthProjection;
}

function renderMarkdown(
  retrieval: AnyRecord,
  scopedRelease: AnyRecord,
  readbackRelease: AnyRecord,
  forwardOnly: boolean,
  items: AnyRecord[],
  stateDigest: string,
): string {
  const lines: string[] = [];
  lines.push("# Status Truth — PS380-STATUS-TRUTH-01");
  lines.push("");
  lines.push(`Retrieved: ${retrieval.retrievedAt}`);
  lines.push(`Source: ${retrieval.sourceUrl}`);
  lines.push(`Scoped release: ${scopedRelease.releaseTag}`);
  lines.push(`Latest: ${readbackRelease.latestTag} (forward-only: ${forwardOnly ? "yes" : "no"})`);
  lines.push(`State digest: ${stateDigest}`);
  lines.push("");
  for (const item of items) {
    const projection = item.projection as AnyRecord;
    const checklist = item.checklist as AnyRecord;
    const pr = item.pr as AnyRecord;
    const labels = item.labels as AnyArray;
    lines.push(`## ${item.itemId} — ${item.maturity}`);
    lines.push(`- open: ${item.issueOpen === true ? "yes" : "no"}`);
    lines.push(`- checklist: ${checklist.checked}/${checklist.total}`);
    lines.push(`- labels: ${labels.map(String).join(", ") || "none"}`);
    lines.push(`- pr: #${pr.number} merged=${pr.merged === true ? "yes" : "no"}`);
    const badges: string[] = [];
    for (const stage of STATUS_TRUTH_LIFECYCLE_STAGES_V1) {
      if (projection[stage] === true) badges.push(stage);
    }
    if (projection.closureVerified === true) badges.push("closure-verified");
    lines.push(`- stages: ${badges.join(", ") || "none"}`);
    lines.push(`- projection digest: ${item.projectionDigest}`);
    lines.push("");
  }
  return lines.join("\n");
}

// ---------------------------------------------------------------------------
// Build / generate / verify
// ---------------------------------------------------------------------------

export function createStatusTruthManifestV1(input: unknown): StatusTruthManifestResult {
  const defects = new Set<StatusTruthReasonCode>();
  if (!deepPlain(input, new Set()) || !validManifestCore(input)) {
    defects.add(CODE.manifestSchema);
    return deny(defects);
  }
  const body: AnyRecord = freeze({ schemaVersion: STATUS_TRUTH_MANIFEST_SCHEMA_V1, ...(input as AnyRecord) });
  const manifest = freeze({ ...body, manifestDigest: digestHex(body) }) as unknown as StatusTruthManifestV1;
  return freeze({ outcome: "BUILT", manifest }) as unknown as StatusTruthManifestResult;
}

export function createStatusTruthProviderReadbackV1(input: unknown): StatusTruthReadbackResult {
  const defects = new Set<StatusTruthReasonCode>();
  if (!deepPlain(input, new Set()) || !validReadbackCore(input)) {
    defects.add(CODE.readbackSchema);
    return deny(defects);
  }
  const body: AnyRecord = freeze({ schemaVersion: STATUS_TRUTH_READBACK_SCHEMA_V1, ...(input as AnyRecord) });
  const readback = freeze({ ...body, readbackDigest: digestHex(body) }) as unknown as StatusTruthProviderReadbackV1;
  return freeze({ outcome: "BUILT", readback }) as unknown as StatusTruthReadbackResult;
}

export function generateStatusTruthSnapshotV1(
  manifestArg: unknown,
  readbackArg: unknown,
): StatusTruthGenerateResult {
  const defects = new Set<StatusTruthReasonCode>();

  const manifest = normalizeManifest(manifestArg);
  const readback = normalizeReadback(readbackArg);
  if (!manifest.ok) defects.add(manifest.code);
  if (!readback.ok) defects.add(readback.code);
  if (defects.size > 0) return deny(defects);

  const m = manifest as Extract<NormalizeResult, { ok: true }>;
  const r = readback as Extract<NormalizeResult, { ok: true }>;

  // AC01: a single retrieval binding ties manifest and readback together.
  if (canonicalJson(m.body.retrieval) !== canonicalJson(r.body.retrieval)) {
    defects.add(CODE.retrievalBinding);
  }

  const scopedRelease = m.body.release as AnyRecord;
  const readbackRelease = r.body.release as AnyRecord;

  // Immutable historical release body; a mutated digest fails closed.
  if (scopedRelease.releaseBodyDigest !== readbackRelease.releaseBodyDigest) {
    defects.add(CODE.releaseBodyMutation);
  }

  // Forward-only release / Latest reconciliation.
  const forwardOnly = compareTags(readbackRelease.latestTag as string, scopedRelease.releaseTag as string) >= 0;
  if (!forwardOnly) defects.add(CODE.releaseForwardOnly);

  // AC06: pagination / completeness.
  const pagination = r.body.pagination as AnyRecord;
  if (pagination.complete !== true || pagination.expectedItems !== pagination.observedItems) {
    defects.add(CODE.paginationIncomplete);
  }

  // Allowlisted item set must match the observed set exactly.
  const manifestIds = (m.body.items as AnyRecord[]).map((item) => item.itemId);
  const readbackIds = (r.body.items as AnyRecord[]).map((item) => item.itemId);
  const manifestSet = new Set(manifestIds);
  const readbackSet = new Set(readbackIds);
  if (manifestSet.size !== readbackSet.size || ![...manifestSet].every((id) => readbackSet.has(id))) {
    defects.add(CODE.itemMismatch);
  }

  // Per-item material-contradiction analysis.
  const manifestById = new Map<string, AnyRecord>();
  for (const item of m.body.items as AnyRecord[]) manifestById.set(item.itemId as string, item);
  const readbackById = new Map<string, AnyRecord>();
  for (const item of r.body.items as AnyRecord[]) readbackById.set(item.itemId as string, item);

  for (const [itemId, readbackItem] of readbackById) {
    const manifestItem = manifestById.get(itemId);
    analyzeItem(
      itemId,
      readbackItem,
      manifestItem?.required as StatusTruthRequired | undefined,
      defects,
    );
  }

  if (defects.size > 0) return deny(defects);

  // Build the snapshot items and their per-item projection digests.
  const snapshotItems: AnyRecord[] = [];
  for (const readbackItem of r.body.items as AnyRecord[]) {
    const manifestItem = manifestById.get(readbackItem.itemId as string) as AnyRecord;
    const projection = buildProjection(
      readbackItem.lifecycle as AnyRecord,
      readbackItem.workflow as AnyRecord,
    );
    snapshotItems.push({
      itemId: readbackItem.itemId,
      issueNumber: readbackItem.issueNumber,
      sourceUrl: manifestItem?.sourceUrl ?? "",
      issueOpen: readbackItem.open,
      labels: [...(readbackItem.labels as AnyArray)],
      checklist: {
        total: (readbackItem.checklist as AnyRecord).total,
        checked: (readbackItem.checklist as AnyRecord).checked,
      },
      pr: {
        number: (readbackItem.pr as AnyRecord).number,
        merged: (readbackItem.pr as AnyRecord).merged,
      },
      maturity: readbackItem.maturity,
      projection,
      projectionDigest: digestHex(projection),
    });
  }

  // Exact state digest: the projected view, not the whole record.
  const stateView = snapshotItems.map((item) => ({
    itemId: item.itemId,
    issueOpen: item.issueOpen,
    checklist: item.checklist,
    labels: item.labels,
    pr: item.pr,
    maturity: item.maturity,
    projection: item.projection,
  }));
  const stateDigest = digestHex(stateView);

  const markdown = renderMarkdown(
    m.body.retrieval as AnyRecord,
    scopedRelease,
    readbackRelease,
    forwardOnly,
    snapshotItems,
    stateDigest,
  );

  const snapshotBody: AnyRecord = {
    schemaVersion: STATUS_TRUTH_SNAPSHOT_SCHEMA_V1,
    manifestId: m.body.manifestId,
    readbackId: r.body.readbackId,
    retrieval: m.body.retrieval,
    manifestDigest: m.digest,
    readbackDigest: r.digest,
    stateDigest,
    release: {
      releaseTag: scopedRelease.releaseTag,
      latestTag: readbackRelease.latestTag,
      releaseBodyDigest: scopedRelease.releaseBodyDigest,
      forwardOnly,
    },
    items: snapshotItems,
    markdown,
  };
  const snapshot = freeze({ ...snapshotBody, snapshotDigest: digestHex(snapshotBody) }) as unknown as StatusTruthSnapshotV1;
  return freeze({ outcome: "GENERATED", snapshot }) as unknown as StatusTruthGenerateResult;
}

export function verifyStatusTruthSnapshotV1(
  snapshot: unknown,
  expected: unknown,
): StatusTruthVerificationV1 {
  const defects = new Set<StatusTruthReasonCode>();
  if (!deepPlain(snapshot, new Set()) || !asExactRecord(snapshot, SNAPSHOT_KEYS)) {
    defects.add(CODE.projectionDigest);
    return deny(defects);
  }
  const record = snapshot as AnyRecord;
  if (record.schemaVersion !== STATUS_TRUTH_SNAPSHOT_SCHEMA_V1) {
    defects.add(CODE.projectionDigest);
    return deny(defects);
  }
  if (
    !asExactRecord(expected, ["stateDigest", "snapshotDigest"]) ||
    !isHex64((expected as AnyRecord).stateDigest) ||
    !isHex64((expected as AnyRecord).snapshotDigest)
  ) {
    defects.add(CODE.projectionDigest);
    return deny(defects);
  }
  const exp = expected as AnyRecord;

  // Recompute the state digest from the projected item view — never trusted.
  const stateView = (record.items as AnyRecord[]).map((item) => ({
    itemId: item.itemId,
    issueOpen: item.issueOpen,
    checklist: item.checklist,
    labels: item.labels,
    pr: item.pr,
    maturity: item.maturity,
    projection: item.projection,
  }));
  const recomputedStateDigest = digestHex(stateView);
  if (recomputedStateDigest !== exp.stateDigest || recomputedStateDigest !== record.stateDigest) {
    defects.add(CODE.projectionDigest);
    return deny(defects);
  }

  // Recompute the snapshot digest over the whole body — never trusted.
  const body: AnyRecord = { ...record };
  delete body.snapshotDigest;
  if (digestHex(body) !== exp.snapshotDigest || digestHex(body) !== record.snapshotDigest) {
    defects.add(CODE.projectionDigest);
    return deny(defects);
  }

  // Recompute each item's projection digest.
  for (const item of record.items as AnyRecord[]) {
    if (digestHex(item.projection) !== item.projectionDigest) {
      defects.add(CODE.projectionDigest);
      return deny(defects);
    }
  }

  return freeze({ outcome: "VERIFIED" }) as StatusTruthVerificationV1;
}

