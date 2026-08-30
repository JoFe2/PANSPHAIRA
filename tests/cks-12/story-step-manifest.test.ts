import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { test } from "node:test";

import {
  BASE_COMMIT,
  BOUNDARY_CONTRACT_VERSION,
  BOUNDARY_RECEIPT_ID,
  BOUNDARY_RECEIPT_SHA256,
  COMPONENT_VERSION_LOCK_SCHEMA_VERSION,
  COMPONENT_VERSION_LOCK,
  DIGEST_ENCODING,
  EXACT_COMPONENT_VERSION_LOCK_FIELDS,
  GENESIS_PREVIOUS_RECEIPT_SHA256,
  HASH_ALGORITHM,
  NON_CLAIMS,
  ORDERED_STORY_STEP_IDS,
  RECEIPT_DIGEST_RULE,
  REPOSITORY,
  STORY_STEP_CATALOG_KIND,
  STORY_STEP_COUNT,
  STORY_STEP_FIXTURE_ID,
  STORY_STEP_FIXTURE_SCHEMA_VERSION,
  STORY_STEP_FIXTURE_VERSION,
  STORY_STEP_MANIFEST,
  STORY_STEP_MANIFEST_SHA256,
  STORY_STEP_EVIDENCE_BINDINGS,
  STORY_STEP_BINDINGS_SHA256,
  STORY_STEP_VERSION_RECEIPT_ID,
  STORY_STEP_VERSION_RECEIPT_SCHEMA_VERSION,
  STORY_STEP_VERSION_RUN_ID,
  STORY_STEP_VOCABULARY_SHA256,
  MUTATION_RULE,
  canonicalJson,
  createStoryStepVersionReceipt,
  storyStepFixtureDigest,
} from "../../src/cks-12/story-step-manifest.js";

const fixturePath = "tests/fixtures/cks-12/part-ii-23-step-fixture-v1.json";
const receiptPath = "verification/cks-12/story-step-version-receipt-v1.json";
const fixtureBytes = readFileSync(fixturePath);
const fixture = JSON.parse(fixtureBytes.toString("utf8")) as Record<string, unknown>;
const receipt = JSON.parse(readFileSync(receiptPath, "utf8")) as Record<string, unknown>;
const sha256 = (value: string | Uint8Array): string => createHash("sha256").update(value).digest("hex");
const digestCanonical = (value: unknown): string => sha256(new TextEncoder().encode(canonicalJson(value)));

const at = <T>(values: readonly T[], index: number): T => {
  const value = values[index];
  if (value === undefined) throw new Error(`missing index ${index}`);
  return value;
};

test("AC-01: the catalog is exactly the frozen ordered 23-step vocabulary", () => {
  assert.equal(STORY_STEP_MANIFEST.length, STORY_STEP_COUNT);
  assert.equal(ORDERED_STORY_STEP_IDS.length, STORY_STEP_COUNT);
  assert.deepEqual(
    STORY_STEP_MANIFEST.map((step) => step.id),
    [...ORDERED_STORY_STEP_IDS],
  );
  for (let i = 0; i < STORY_STEP_MANIFEST.length; i += 1) {
    assert.equal(at(STORY_STEP_MANIFEST, i).ordinal, i + 1);
    assert.match(at(STORY_STEP_MANIFEST, i).id, /^CKS-12-P2-SS-(0[1-9]|1[0-9]|2[0-3])$/);
  }
  assert.equal(STORY_STEP_VOCABULARY_SHA256, digestCanonical([...ORDERED_STORY_STEP_IDS]));
  assert.equal(STORY_STEP_MANIFEST_SHA256, digestCanonical(STORY_STEP_MANIFEST));
});

test("AC-01: fixture bytes are canonical, versioned, and bound to the frozen boundary", () => {
  assert.equal(fixtureBytes.toString("utf8"), canonicalJson(fixture));
  assert.equal(storyStepFixtureDigest(fixtureBytes), "aa75328c23692f014ff49d0f20664eb7910ccd05d1e52cb227aef527f84a40f3");
  assert.equal(fixture.schemaVersion, STORY_STEP_FIXTURE_SCHEMA_VERSION);
  assert.equal(fixture.fixtureId, STORY_STEP_FIXTURE_ID);
  assert.equal(fixture.fixtureVersion, STORY_STEP_FIXTURE_VERSION);
  assert.equal(fixture.catalogKind, STORY_STEP_CATALOG_KIND);
  assert.equal(fixture.repository, REPOSITORY);
  assert.equal(fixture.baseCommit, BASE_COMMIT);
  assert.equal(fixture.boundaryReceiptId, BOUNDARY_RECEIPT_ID);
  assert.equal(fixture.boundaryReceiptSha256, BOUNDARY_RECEIPT_SHA256);
  assert.equal(fixture.hashAlgorithm, HASH_ALGORITHM);
  assert.equal(fixture.digestEncoding, DIGEST_ENCODING);
  assert.equal(fixture.mutationRule, MUTATION_RULE);
  assert.equal(fixture.receiptDigestRule, RECEIPT_DIGEST_RULE);
  assert.deepEqual(fixture.storySteps, STORY_STEP_MANIFEST);
  assert.deepEqual(fixture.exactComponentVersionLockFields, [...EXACT_COMPONENT_VERSION_LOCK_FIELDS]);
  assert.equal(fixture.componentVersionLockSchemaVersion, COMPONENT_VERSION_LOCK_SCHEMA_VERSION);
  assert.equal(fixture.storyStepVocabularySha256, STORY_STEP_VOCABULARY_SHA256);
});

test("AC-01: manifest and ordered IDs are deeply immutable", () => {
  assert.ok(Object.isFrozen(STORY_STEP_MANIFEST));
  assert.ok(Object.isFrozen(ORDERED_STORY_STEP_IDS));
  assert.ok(Object.isFrozen(at(STORY_STEP_MANIFEST, 0)));
  assert.throws(() => {
    (at(STORY_STEP_MANIFEST, 0) as { event: string }).event = "MUTATED";
  }, TypeError);
  assert.throws(() => {
    (ORDERED_STORY_STEP_IDS as unknown as string[])[0] = "MUTATED";
  }, TypeError);
});

test("AC-01: version receipt is deterministic, self-digested, and does not claim execution", () => {
  const expectedFixtureSha256 = sha256(fixtureBytes);
  const generated = createStoryStepVersionReceipt(expectedFixtureSha256);
  assert.deepEqual(generated, receipt);
  assert.equal(generated.schemaVersion, STORY_STEP_VERSION_RECEIPT_SCHEMA_VERSION);
  assert.equal(generated.receiptId, STORY_STEP_VERSION_RECEIPT_ID);
  assert.equal(generated.runId, STORY_STEP_VERSION_RUN_ID);
  assert.equal(generated.fixtureId, STORY_STEP_FIXTURE_ID);
  assert.equal(generated.fixtureVersion, STORY_STEP_FIXTURE_VERSION);
  assert.equal(generated.fixtureSha256, expectedFixtureSha256);
  assert.equal(generated.storyStepCount, STORY_STEP_COUNT);
  assert.deepEqual(generated.orderedStoryStepIds, [...ORDERED_STORY_STEP_IDS]);
  assert.equal(generated.storyStepManifestSha256, STORY_STEP_MANIFEST_SHA256);
  assert.equal(generated.previousReceiptSha256, GENESIS_PREVIOUS_RECEIPT_SHA256);
  assert.equal(generated.boundaryContractVersion, BOUNDARY_CONTRACT_VERSION);
  assert.equal(generated.status, "RECORDED");
  assert.equal(generated.authority, "NONE");
  assert.equal(generated.capabilityDelta, "NONE");
  assert.equal(generated.effect, "NONE");
  assert.equal(generated.integratedProofState, "EVIDENCE_INCOMPLETE");
  assert.equal(generated.successClaimed, false);
  assert.deepEqual(generated.nonClaims, [...NON_CLAIMS]);
  const { receiptSha256, ...body } = generated;
  assert.equal(receiptSha256, digestCanonical(body));
  assert.equal(canonicalJson(receipt), canonicalJson(generated));
  assert.ok(Object.isFrozen(generated));
});

test("AC-01: malformed fixture versions cannot be silently re-identified", () => {
  assert.throws(() => createStoryStepVersionReceipt("A".repeat(64)), /lowercase hexadecimal/);
  const changed = structuredClone(fixture);
  changed.fixtureVersion = "v3";
  assert.notEqual(digestCanonical(changed), digestCanonical(fixture));
  assert.notEqual(sha256(new TextEncoder().encode(canonicalJson(changed))), sha256(fixtureBytes));
});

test("AC-01: every story step has a deterministic v2 fixture and receipt binding", () => {
  assert.equal(STORY_STEP_EVIDENCE_BINDINGS.length, STORY_STEP_COUNT);
  assert.equal(STORY_STEP_BINDINGS_SHA256, digestCanonical(STORY_STEP_EVIDENCE_BINDINGS));
  assert.equal(fixture.stepBindingsSha256, STORY_STEP_BINDINGS_SHA256);
  assert.deepEqual(fixture.stepBindings, STORY_STEP_EVIDENCE_BINDINGS);
  for (let i = 0; i < STORY_STEP_COUNT; i += 1) {
    const binding = at(STORY_STEP_EVIDENCE_BINDINGS, i);
    assert.equal(binding.stepId, at(STORY_STEP_MANIFEST, i).id);
    assert.equal(binding.stepOrdinal, i + 1);
    assert.equal(binding.fixtureVersion, "v2");
    assert.equal(binding.receiptVersion, "v2");
    assert.match(binding.fixtureSha256, /^[0-9a-f]{64}$/);
    assert.match(binding.receiptSha256, /^[0-9a-f]{64}$/);
    assert.equal(binding.componentVersionLockSha256, fixture.componentVersionLockSha256);
  }
  for (const field of EXACT_COMPONENT_VERSION_LOCK_FIELDS) {
    assert.equal(typeof COMPONENT_VERSION_LOCK[field], "string");
    assert.notEqual(COMPONENT_VERSION_LOCK[field], "");
  }
  assert.equal(fixture.componentVersionLockSha256, digestCanonical(COMPONENT_VERSION_LOCK));
});

test("AC-01: independent checker emits a bound dry-run receipt with no execution claims", () => {
  const result = spawnSync(process.execPath, ["--jitless", "scripts/run-cks-12-story-step-check.mjs", "--dry-run"], { encoding: "utf8" });
  assert.equal(result.status, 0, result.stderr);
  const checked = JSON.parse(result.stdout) as Record<string, unknown>;
  assert.equal(checked.status, "RECORDED");
  assert.equal(checked.executionClaimed, false);
  assert.equal(checked.productionClaimed, false);
  assert.equal((checked.receipt as Record<string, unknown>).fixtureSha256, sha256(fixtureBytes));
});

test("AC-01: independent checker denies missing, unsupported, stale, and prohibited evidence", async () => {
  const { checkStoryStepVersionContract } = await import(`${process.cwd()}/scripts/run-cks-12-story-step-check.mjs`);
  const check = (changedFixture: Record<string, unknown>, changedReceipt = receipt) => checkStoryStepVersionContract(
    changedFixture,
    structuredClone(changedReceipt),
    { fixtureBytes },
  ) as { status: string; reasonCodes: string[] };
  const missingVersion = structuredClone(fixture);
  delete (missingVersion.componentVersionLock as Record<string, unknown>).npmVersion;
  assert.equal(check(missingVersion).status, "DENIED");
  assert.ok(check(missingVersion).reasonCodes.includes("MISSING_INPUT"));

  const unsupported = structuredClone(fixture);
  (unsupported.componentVersionLock as Record<string, unknown>).inferenceRuntimeVersion = "v999";
  assert.ok(check(unsupported).reasonCodes.includes("VERSION_LOCK_MISMATCH"));

  const staleBinding = structuredClone(fixture);
  (staleBinding.stepBindings as Array<Record<string, unknown>>)[0]!.fixtureSha256 = "0".repeat(64);
  assert.ok(check(staleBinding).reasonCodes.includes("RECEIPT_INTEGRITY_FAILED"));

  for (const mutation of [
    (value: Record<string, unknown>) => { (value.storySteps as unknown[]).reverse(); },
    (value: Record<string, unknown>) => { (value.storySteps as unknown[])[1] = (value.storySteps as unknown[])[0]; },
    (value: Record<string, unknown>) => { (value.storySteps as unknown[]).pop(); },
  ]) {
    const changed = structuredClone(fixture);
    mutation(changed);
    assert.ok(check(changed).reasonCodes.includes("PROOF_OBLIGATION_MISMATCH"));
  }

  const executionClaim = structuredClone(receipt);
  executionClaim.executionClaimed = true;
  assert.ok(check(fixture, executionClaim).reasonCodes.includes("PRODUCTION_ACTION_DENIED"));
  const productionClaim = structuredClone(receipt);
  productionClaim.productionClaimed = true;
  assert.ok(check(fixture, productionClaim).reasonCodes.includes("PRODUCTION_ACTION_DENIED"));
});
