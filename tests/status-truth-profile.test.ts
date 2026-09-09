import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";

import { canonicalJson } from "../packages/contracts/src/canonical-json.js";
import {
  STATUS_TRUTH_MANIFEST_SCHEMA_V1,
  STATUS_TRUTH_READBACK_SCHEMA_V1,
  STATUS_TRUTH_SNAPSHOT_SCHEMA_V1,
  STATUS_TRUTH_LIFECYCLE_STAGES_V1,
  STATUS_TRUTH_MATURITIES_V1,
  STATUS_TRUTH_WORKFLOW_STATES_V1,
  createStatusTruthManifestV1,
  createStatusTruthProviderReadbackV1,
  generateStatusTruthSnapshotV1,
  verifyStatusTruthSnapshotV1,
  type StatusTruthManifestV1,
  type StatusTruthProviderReadbackV1,
  type StatusTruthSnapshotV1,
  type StatusTruthVerificationV1,
} from "../packages/contracts/src/status-truth.js";

/**
 * PS380-STATUS-TRUTH-01 — canonical status-truth generator profile.
 *
 * Focused, TDD proof of the acceptance criteria for generating a bounded
 * public status snapshot from an allowlisted manifest + anonymous provider
 * readback, and failing on material contradictions without rewriting
 * historical issue text:
 *   - AC01: the generator consumes an explicit allowlisted issue/epic/release
 *     manifest and provider readback; the snapshot binds retrieval time,
 *     source URLs and exact state digests (manifest/readback/state/snapshot),
 *     each recomputed — never trusted.
 *   - AC02: the snapshot distinguishes issue open/closed, checklist progress,
 *     labels, PR/merge, release/readback and planned/delivered/falsified
 *     maturity, plus the eight lifecycle stages.
 *   - AC03: the deterministic markdown projection is a pure function of the
 *     snapshot state (roadmap/epic views link or embed it instead of
 *     hand-maintained closed-issue lists).
 *   - AC04: material contradictions fail closed — a closed issue shown
 *     open/planned, an open acceptance shown complete, a missing required
 *     release/readback, a stale checklist, or a label/state disagreement.
 *   - AC05: historical issue bodies and receipts remain immutable; the
 *     generator never edits issues and checkbox text is never stronger than
 *     provider state.
 *   - AC06: offline fixtures prove deterministic rendering, pagination /
 *     completeness, and failure on partial provider data.
 *
 * Thread extensions:
 *   - the projection distinguishes code present, focused/canonical tests
 *     passed, runtime observed, merged, released, required public readback
 *     verified, issue publicly closed and queue DONE;
 *   - a red, missing, stale or wrong-head required workflow can never
 *     project `closure verified` or `DONE`;
 *   - forward-only release-body/Latest reconciliation with the historical
 *     release text immutable; current contradictions are surfaced, never
 *     silently repaired.
 *
 * All values are synthetic; no customer data, credentials or network.
 */

type AnyRecord = Record<string, unknown>;
type AnyArray = unknown[];

const sha256 = (value: unknown): string =>
  createHash("sha256").update(canonicalJson(value), "utf8").digest("hex");

// --- fixed synthetic bindings (no customer data, no credentials) ------------

const ORG = "JoFe2";
const SOURCE_URL = "https://github.com/JoFe2/PANSPHAIRA";
const REPO = SOURCE_URL.slice(SOURCE_URL.lastIndexOf("/") + 1);
const RETRIEVED_AT = "2026-09-09T06:00:00Z";
const RELEASE_TAG = "2026_09_09_v1";
const LATEST_TAG = "2026_09_09_v1";
const RELEASE_URL = "https://github.com/JoFe2/PANSPHAIRA/releases/tag/2026_09_09_v1";
const RELEASE_BODY = "9f8e7d6c5b4a39281706f5e4d3c2b1a09f8e7d6c5b4a39281706f5e4d3c2b1a0";
const READBACK_URL = "https://github.com/JoFe2/PANSPHAIRA/issues/380";
const READBACK_DIGEST = "beef5678beef5678beef5678beef5678beef5678beef5678beef5678beef5678";
const READBACK_TS = "2026-09-09T06:00:00Z";
const HEAD_SHA = "a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0";

// --- manifest + readback builders (synthetic) --------------------------------

function retrieval(): AnyRecord {
  return { retrievedAt: RETRIEVED_AT, sourceUrl: SOURCE_URL, organization: ORG, repository: REPO };
}

function manifestItem(overrides: AnyRecord = {}): AnyRecord {
  return {
    itemId: "issue-380",
    kind: "ISSUE",
    issueNumber: 380,
    sourceUrl: "https://github.com/JoFe2/PANSPHAIRA/issues/380",
    parentEpicId: null,
    required: { releaseRequired: true, readbackRequired: true, workflowRequired: true },
    ...overrides,
  };
}

function fullLifecycle(overrides: AnyRecord = {}): AnyRecord {
  return {
    codePresent: true,
    testsPassed: true,
    runtimeObserved: true,
    merged: true,
    released: true,
    readbackVerified: true,
    issueClosed: true,
    queueDone: true,
    ...overrides,
  };
}

function readbackItem(overrides: AnyRecord = {}): AnyRecord {
  return {
    itemId: "issue-380",
    issueNumber: 380,
    open: false,
    labels: ["delivered"],
    checklist: { total: 6, checked: 6 },
    pr: { number: 406, merged: true },
    workflow: { required: true, state: "GREEN", headCommit: HEAD_SHA, runUrl: "https://github.com/JoFe2/PANSPHAIRA/actions/runs/4815162342" },
    maturity: "DELIVERED",
    lifecycle: fullLifecycle(),
    ...overrides,
  };
}

function manifestInput(overrides: AnyRecord = {}): AnyRecord {
  return {
    manifestId: "ps380-status-truth-manifest-0001",
    retrieval: retrieval(),
    items: [manifestItem()],
    release: { releaseTag: RELEASE_TAG, releaseUrl: RELEASE_URL, releaseBodyDigest: RELEASE_BODY },
    ...overrides,
  };
}

function readbackInput(overrides: AnyRecord = {}): AnyRecord {
  return {
    readbackId: "ps380-status-truth-readback-0001",
    retrieval: retrieval(),
    pagination: { complete: true, expectedItems: 1, observedItems: 1 },
    items: [readbackItem()],
    release: { latestTag: LATEST_TAG, releaseBodyDigest: RELEASE_BODY },
    readback: { readbackUrl: READBACK_URL, readbackDigest: READBACK_DIGEST, readbackTimestamp: READBACK_TS },
    ...overrides,
  };
}

function builtManifest(): StatusTruthManifestV1 {
  const result = createStatusTruthManifestV1(manifestInput());
  assert.equal(result.outcome, "BUILT", "baseline manifest must build");
  return result.manifest;
}

function builtReadback(): StatusTruthProviderReadbackV1 {
  const result = createStatusTruthProviderReadbackV1(readbackInput());
  assert.equal(result.outcome, "BUILT", "baseline readback must build");
  return result.readback;
}

function generated(): StatusTruthSnapshotV1 {
  const result = generateStatusTruthSnapshotV1(builtManifest(), builtReadback());
  assert.equal(result.outcome, "GENERATED", "baseline snapshot must generate");
  return result.snapshot;
}

function deniedCodes(input: { manifest?: AnyRecord; readback?: AnyRecord } = {}): readonly string[] {
  const manifest = input.manifest === undefined ? manifestInput() : input.manifest;
  const readback = input.readback === undefined ? readbackInput() : input.readback;
  const result = generateStatusTruthSnapshotV1(manifest, readback);
  assert.equal(result.outcome, "DENIED", "expected a denial");
  return result.reasonCodes;
}

// --- AC01: closed v1 schema, retrieval binding, exact state digests -----------

test("AC01: the manifest binds retrieval time, source URL and a recomputed content digest", () => {
  const manifest = builtManifest();
  assert.equal(manifest.schemaVersion, STATUS_TRUTH_MANIFEST_SCHEMA_V1);
  assert.equal(manifest.retrieval.retrievedAt, RETRIEVED_AT);
  assert.equal(manifest.retrieval.sourceUrl, SOURCE_URL);
  // The content digest is recomputed independently — never trusted.
  const { manifestDigest: _stamped, ...body } = manifest as unknown as AnyRecord;
  assert.equal(sha256(body), manifest.manifestDigest);
});

test("AC01: the readback binds retrieval time, source URL and a recomputed content digest", () => {
  const readback = builtReadback();
  assert.equal(readback.schemaVersion, STATUS_TRUTH_READBACK_SCHEMA_V1);
  assert.equal(readback.retrieval.sourceUrl, SOURCE_URL);
  const { readbackDigest: _stamped, ...body } = readback as unknown as AnyRecord;
  assert.equal(sha256(body), readback.readbackDigest);
});

test("AC01: the snapshot binds retrieval time, both source digests and an exact state digest", () => {
  const snapshot = generated();
  assert.equal(snapshot.schemaVersion, STATUS_TRUTH_SNAPSHOT_SCHEMA_V1);
  assert.equal(snapshot.retrieval.retrievedAt, RETRIEVED_AT);
  assert.equal(snapshot.retrieval.sourceUrl, SOURCE_URL);
  assert.equal(snapshot.manifestDigest, builtManifest().manifestDigest);
  assert.equal(snapshot.readbackDigest, builtReadback().readbackDigest);
  assert.equal(snapshot.snapshotDigest, sha256(snapshotBodyWithoutDigest(snapshot)));
  assert.equal(snapshot.stateDigest, recomputedStateDigest(snapshot));
});

function snapshotBodyWithoutDigest(snapshot: StatusTruthSnapshotV1): AnyRecord {
  const { snapshotDigest: _stamped, ...body } = snapshot as unknown as AnyRecord;
  return body;
}

function recomputedStateDigest(snapshot: StatusTruthSnapshotV1): string {
  const view = snapshot.items.map((item) => ({
    itemId: item.itemId,
    issueOpen: item.issueOpen,
    checklist: item.checklist,
    labels: item.labels,
    pr: item.pr,
    maturity: item.maturity,
    projection: item.projection,
  }));
  return sha256(view);
}

// --- AC02: open/closed, checklist, labels, PR/merge, release, maturity --------

test("AC02: the snapshot distinguishes open/closed, checklist, labels, PR/merge and maturity", () => {
  const snapshot = generated();
  const item = snapshot.items[0]!;
  assert.equal(item.issueOpen, false, "provider reports the issue closed");
  assert.deepEqual(item.checklist, { total: 6, checked: 6 });
  assert.deepEqual(item.labels, ["delivered"]);
  assert.deepEqual(item.pr, { number: 406, merged: true });
  assert.equal(item.maturity, "DELIVERED");
});

test("AC02: all eight lifecycle stages are projected in a fixed order", () => {
  const snapshot = generated();
  const projection = snapshot.items[0]!.projection;
  const keys = Object.keys(projection);
  assert.deepEqual(
    keys.filter((key) => key !== "closureVerified"),
    STATUS_TRUTH_LIFECYCLE_STAGES_V1.map((stage) => stage),
  );
  assert.equal(projection.codePresent, true);
  assert.equal(projection.testsPassed, true);
  assert.equal(projection.runtimeObserved, true);
  assert.equal(projection.merged, true);
  assert.equal(projection.released, true);
  assert.equal(projection.readbackVerified, true);
  assert.equal(projection.issueClosed, true);
  assert.equal(projection.queueDone, true);
  assert.equal(projection.closureVerified, true);
});

test("AC02: planned and falsified maturity are distinguished from delivered", () => {
  const planned = deniedCodesFree(
    readbackInput({ items: [readbackItem({ maturity: "PLANNED", open: true, labels: ["planned"], lifecycle: fullLifecycle({ released: false, readbackVerified: false, issueClosed: false, queueDone: false }) })] }),
  );
  assert.equal(planned.outcome, "GENERATED", "an honest planned item is not a contradiction");
  assert.equal((planned as { snapshot: StatusTruthSnapshotV1 }).snapshot.items[0]!.maturity, "PLANNED");

  const falsified = deniedCodesFree(
    readbackInput({ items: [readbackItem({ maturity: "FALSIFIED", open: true, labels: ["falsified"], lifecycle: fullLifecycle({ released: false, readbackVerified: false, issueClosed: false, queueDone: false }) })] }),
  );
  assert.equal(falsified.outcome, "GENERATED", "an honest falsified item is not a contradiction");
  assert.equal((falsified as { snapshot: StatusTruthSnapshotV1 }).snapshot.items[0]!.maturity, "FALSIFIED");
});

// helper: generate from a raw readback with a consistent manifest
function deniedCodesFree(readbackRaw: AnyRecord): StatusTruthVerificationV1 | { outcome: "GENERATED"; snapshot: StatusTruthSnapshotV1 } {
  const manifestRaw = manifestInput();
  // Align the manifest retrieval with the readback retrieval.
  (readbackRaw as AnyRecord).retrieval = manifestRaw.retrieval;
  return generateStatusTruthSnapshotV1(manifestRaw, readbackRaw);
}

// --- Thread: the required-workflow gate caps closure verified / DONE ----------

test("thread: a red required workflow can never project closure verified or DONE", () => {
  const codes = deniedCodes({
    readback: readbackInput({ items: [readbackItem({ workflow: { required: true, state: "RED", headCommit: HEAD_SHA, runUrl: null } })] }),
  });
  assert.ok(codes.includes("STATUS_TRUTH_CLOSURE_PROJECTION_DENIED"), `got ${codes.join(",")}`);
});

for (const state of ["MISSING", "STALE", "WRONG_HEAD"] as const) {
  test(`thread: a ${state} required workflow denies a claimed DONE`, () => {
    const codes = deniedCodes({
      readback: readbackInput({ items: [readbackItem({ workflow: { required: true, state, headCommit: state === "WRONG_HEAD" ? "0".repeat(40) : HEAD_SHA, runUrl: null } })] }),
    });
    assert.ok(codes.includes("STATUS_TRUTH_CLOSURE_PROJECTION_DENIED"), `got ${codes.join(",")}`);
  });
}

test("thread: an honest partial item with a red required workflow is projected without DONE (visible, not repaired)", () => {
  const result = generateStatusTruthSnapshotV1(
    manifestInput(),
    readbackInput({
      items: [readbackItem({
        workflow: { required: true, state: "RED", headCommit: HEAD_SHA, runUrl: null },
        lifecycle: fullLifecycle({ queueDone: false }),
      })],
    }),
  );
  assert.equal(result.outcome, "GENERATED", "a red gate alone is not a contradiction — it caps the projection");
  const item = (result as { snapshot: StatusTruthSnapshotV1 }).snapshot.items[0]!;
  assert.equal(item.projection.released, true, "release state is shown honestly");
  assert.equal(item.projection.issueClosed, true, "closure state is shown honestly");
  assert.equal(item.projection.queueDone, false, "DONE is never projected over a red gate");
  assert.equal(item.projection.closureVerified, false, "closure verified is never projected over a red gate");
});

// --- AC04: material contradictions fail closed --------------------------------

test("AC04: a closed issue shown as open is a material contradiction", () => {
  const codes = deniedCodes({
    readback: readbackInput({ items: [readbackItem({ open: true, lifecycle: fullLifecycle({ issueClosed: true }) })] }),
  });
  assert.ok(codes.includes("STATUS_TRUTH_ISSUE_STATE_CONTRADICTION_DENIED"), `got ${codes.join(",")}`);
});

test("AC04: a closed issue shown as planned is a material contradiction", () => {
  const codes = deniedCodes({
    readback: readbackInput({ items: [readbackItem({ maturity: "PLANNED", lifecycle: fullLifecycle({ issueClosed: true, queueDone: true }) })] }),
  });
  assert.ok(codes.includes("STATUS_TRUTH_ISSUE_STATE_CONTRADICTION_DENIED"), `got ${codes.join(",")}`);
});

test("AC04: a delivered acceptance with the queue not DONE is open-shown-complete", () => {
  const codes = deniedCodes({
    readback: readbackInput({ items: [readbackItem({ lifecycle: fullLifecycle({ queueDone: false }) })] }),
  });
  assert.ok(codes.includes("STATUS_TRUTH_ACCEPTANCE_SHOWN_COMPLETE_DENIED"), `got ${codes.join(",")}`);
});

test("AC04: a missing required release on a delivered item fails closed", () => {
  const codes = deniedCodes({
    readback: readbackInput({ items: [readbackItem({ lifecycle: fullLifecycle({ released: false }) })] }),
  });
  assert.ok(codes.includes("STATUS_TRUTH_MISSING_RELEASE_DENIED"), `got ${codes.join(",")}`);
});

test("AC04: a missing required readback on a delivered item fails closed", () => {
  const codes = deniedCodes({
    readback: readbackInput({ items: [readbackItem({ lifecycle: fullLifecycle({ readbackVerified: false }) })] }),
  });
  assert.ok(codes.includes("STATUS_TRUTH_MISSING_READBACK_DENIED"), `got ${codes.join(",")}`);
});

test("AC04: a delivered item with a stale checklist fails closed", () => {
  const codes = deniedCodes({
    readback: readbackInput({ items: [readbackItem({ checklist: { total: 6, checked: 4 } })] }),
  });
  assert.ok(codes.includes("STATUS_TRUTH_CHECKLIST_STALE_DENIED"), `got ${codes.join(",")}`);
});

test("AC04: a delivered label on a non-delivered item is a label/state disagreement", () => {
  const codes = deniedCodes({
    readback: readbackInput({ items: [readbackItem({ maturity: "PLANNED", open: true, labels: ["delivered"], lifecycle: fullLifecycle({ released: false, readbackVerified: false, issueClosed: false, queueDone: false }) })] }),
  });
  assert.ok(codes.includes("STATUS_TRUTH_LABEL_STATE_CONTRADICTION_DENIED"), `got ${codes.join(",")}`);
});

test("AC04: a planned label on a delivered item is a label/state disagreement", () => {
  const codes = deniedCodes({
    readback: readbackInput({ items: [readbackItem({ labels: ["planned"] })] }),
  });
  assert.ok(codes.includes("STATUS_TRUTH_LABEL_STATE_CONTRADICTION_DENIED"), `got ${codes.join(",")}`);
});

// --- AC06: pagination / completeness and partial provider data ----------------

test("AC06: incomplete provider pagination fails closed", () => {
  const codes = deniedCodes({
    readback: readbackInput({ pagination: { complete: false, expectedItems: 1, observedItems: 1 } }),
  });
  assert.ok(codes.includes("STATUS_TRUTH_PAGINATION_INCOMPLETE_DENIED"), `got ${codes.join(",")}`);
});

test("AC06: an observed/expected item count mismatch fails closed", () => {
  const codes = deniedCodes({
    readback: readbackInput({ pagination: { complete: true, expectedItems: 2, observedItems: 1 } }),
  });
  assert.ok(codes.includes("STATUS_TRUTH_PAGINATION_INCOMPLETE_DENIED"), `got ${codes.join(",")}`);
});

test("AC06: an allowlisted item absent from the readback is a completeness failure", () => {
  const codes = deniedCodes({
    manifest: manifestInput({ items: [manifestItem(), manifestItem({ itemId: "issue-381", issueNumber: 381, sourceUrl: "https://github.com/JoFe2/PANSPHAIRA/issues/381" })] }),
    readback: readbackInput({ pagination: { complete: true, expectedItems: 2, observedItems: 1 } }),
  });
  assert.ok(codes.includes("STATUS_TRUTH_ITEM_MISMATCH_DENIED"), `got ${codes.join(",")}`);
});

// --- Thread: forward-only release / Latest and immutable release body ---------

test("thread: a Latest release older than the scoped release is not forward-only", () => {
  const codes = deniedCodes({
    readback: readbackInput({ release: { latestTag: "2026_09_08_v1", releaseBodyDigest: RELEASE_BODY } }),
  });
  assert.ok(codes.includes("STATUS_TRUTH_RELEASE_FORWARD_ONLY_DENIED"), `got ${codes.join(",")}`);
});

test("thread: a forward Latest release (same or newer) is reconciled without denial", () => {
  const result = generateStatusTruthSnapshotV1(
    manifestInput(),
    readbackInput({ release: { latestTag: "2026_09_09_v2", releaseBodyDigest: RELEASE_BODY } }),
  );
  assert.equal(result.outcome, "GENERATED", "a newer Latest is forward-only and accepted");
  const release = (result as { snapshot: StatusTruthSnapshotV1 }).snapshot.release;
  assert.equal(release.forwardOnly, true);
  assert.equal(release.latestTag, "2026_09_09_v2");
});

test("thread: a mutated historical release body fails closed (immutability)", () => {
  const mutated = "0".repeat(64);
  const codes = deniedCodes({
    readback: readbackInput({ release: { latestTag: LATEST_TAG, releaseBodyDigest: mutated } }),
  });
  assert.ok(codes.includes("STATUS_TRUTH_RELEASE_BODY_MUTATION_DENIED"), `got ${codes.join(",")}`);
});

// --- AC05: checkbox text is never stronger than provider state -----------------

test("AC05: a fully-checked checklist does not upgrade provider state to delivered", () => {
  const result = generateStatusTruthSnapshotV1(
    manifestInput({ items: [manifestItem({ required: { releaseRequired: false, readbackRequired: false, workflowRequired: false } })] }),
    readbackInput({
      items: [readbackItem({
        maturity: "PLANNED",
        open: true,
        labels: [],
        checklist: { total: 6, checked: 6 },
        workflow: { required: false, state: "NONE", headCommit: null, runUrl: null },
        lifecycle: fullLifecycle({ released: false, readbackVerified: false, issueClosed: false, queueDone: false }),
      })],
    }),
  );
  assert.equal(result.outcome, "GENERATED", "a full checklist alone is not a contradiction");
  const item = (result as { snapshot: StatusTruthSnapshotV1 }).snapshot.items[0]!;
  assert.equal(item.maturity, "PLANNED", "maturity stays at provider truth, not the checkbox");
  assert.equal(item.projection.released, false, "checkbox text never implies a release");
  assert.equal(item.projection.queueDone, false, "checkbox text never implies DONE");
});

// --- AC03: deterministic markdown rendering ------------------------------------

test("AC03: the markdown projection is deterministic and reflects state", () => {
  const first = generated();
  const second = generated();
  assert.equal(first.markdown, second.markdown, "identical inputs render identically");
  assert.match(first.markdown, /2026-09-09T06:00:00Z/);
  assert.match(first.markdown, /issue-380/);
  assert.match(first.markdown, /DELIVERED/);

  // A state change flips the rendering: a red gate drops the closure marker.
  const capped = generateStatusTruthSnapshotV1(
    manifestInput(),
    readbackInput({ items: [readbackItem({ workflow: { required: true, state: "RED", headCommit: HEAD_SHA, runUrl: null }, lifecycle: fullLifecycle({ queueDone: false }) })] }),
  );
  assert.equal(capped.outcome, "GENERATED");
  const cappedMarkdown = (capped as { snapshot: StatusTruthSnapshotV1 }).snapshot.markdown;
  assert.notEqual(cappedMarkdown, first.markdown, "a different state renders differently");
  assert.doesNotMatch(cappedMarkdown, /closure-verified/);
  assert.match(first.markdown, /closure-verified/);
});

// --- Verification: digests are recomputed, never trusted ----------------------

test("verification: a tampered projection digest is denied", () => {
  const snapshot = generated();
  const tampered = structuredClone(snapshot) as unknown as AnyRecord;
  const item = (tampered.items as AnyArray)[0] as AnyRecord;
  item.projectionDigest = "0".repeat(64);
  const result = verifyStatusTruthSnapshotV1(tampered, {
    stateDigest: snapshot.stateDigest,
    snapshotDigest: snapshot.snapshotDigest,
  });
  assert.equal(result.outcome, "DENIED", "a substituted projection digest must be denied");
});

test("verification: a consistent snapshot verifies with recomputed digests", () => {
  const snapshot = generated();
  const result = verifyStatusTruthSnapshotV1(snapshot, {
    stateDigest: recomputedStateDigest(snapshot),
    snapshotDigest: sha256(snapshotBodyWithoutDigest(snapshot)),
  });
  assert.equal(result.outcome, "VERIFIED", "an untampered snapshot must verify");
});

test("verification: a caller-authored state digest that does not recompute is denied", () => {
  const snapshot = generated();
  const result = verifyStatusTruthSnapshotV1(snapshot, {
    stateDigest: "0".repeat(64),
    snapshotDigest: sha256(snapshotBodyWithoutDigest(snapshot)),
  });
  assert.equal(result.outcome, "DENIED", "the state digest is recomputed, never trusted");
});

// --- Schema denials ------------------------------------------------------------

test("schema: a manifest missing its release block is denied", () => {
  const input = manifestInput();
  delete (input as AnyRecord).release;
  const result = createStatusTruthManifestV1(input);
  assert.equal(result.outcome, "DENIED");
  assert.ok((result.reasonCodes).includes("STATUS_TRUTH_MANIFEST_SCHEMA_DENIED"));
});

test("schema: a readback with an incomplete anonymous provider readback is denied", () => {
  const input = readbackInput();
  (input.readback as AnyRecord).readbackDigest = "NONE";
  const result = createStatusTruthProviderReadbackV1(input);
  assert.equal(result.outcome, "DENIED");
  assert.ok((result.reasonCodes).includes("STATUS_TRUTH_READBACK_SCHEMA_DENIED"));
});

test("schema: a manifest whose content digest does not recompute is denied", () => {
  const built = builtManifest();
  const tampered = structuredClone(built) as unknown as AnyRecord;
  tampered.manifestDigest = "0".repeat(64);
  const result = generateStatusTruthSnapshotV1(tampered, builtReadback());
  assert.equal(result.outcome, "DENIED");
  assert.ok((result.reasonCodes).includes("STATUS_TRUTH_MANIFEST_DIGEST_DENIED"));
});

test("schema: a mismatched retrieval binding between manifest and readback is denied", () => {
  const result = generateStatusTruthSnapshotV1(
    manifestInput(),
    readbackInput({ retrieval: { retrievedAt: "2026-09-08T00:00:00Z", sourceUrl: SOURCE_URL, organization: ORG, repository: REPO } }),
  );
  assert.equal(result.outcome, "DENIED");
  assert.ok((result.reasonCodes).includes("STATUS_TRUTH_RETRIEVAL_BINDING_DENIED"));
});