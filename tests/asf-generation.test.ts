import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  ASF_GENERATION_EXIT_CODES_V1,
  ASF_GENERATION_SOURCE_SCHEMA_V1,
  canonicalizeAsfGenerationV1,
  parseAsfGenerationV1,
  verifyAsfGenerationFromLockV1,
  verifyAsfGenerationV1,
  type AsfGenerationReceiptV1,
  type AsfGenerationReasonCodeV1,
  type AsfProposedSourceV1,
} from "../packages/contracts/src/asf-generation.js";
import { canonicalJson } from "../packages/contracts/src/canonical-json.js";

const fixtureRoot = "tests/fixtures/asf-generation";
const validRaw = readFileSync(`${fixtureRoot}/source-a.json`, "utf8");
const reorderedRaw = readFileSync(`${fixtureRoot}/source-a-reordered.json`, "utf8");
const invalidRaw = readFileSync(`${fixtureRoot}/invalid-source.json`, "utf8");
const validSource = JSON.parse(validRaw) as AsfProposedSourceV1;

const digestOf = (value: unknown): string => createHash("sha256").update(canonicalJson(value)).digest("hex");
const expectedEvidence = Object.freeze({
  canonicalBytesDigest: "454eeaf436562ab1197136840379afd4d3eb47a1d13a72e151ac7985e977e3b7",
  outputDigest: "80934f075544106fbb461df2b7838c929f3711898436813676a589cd09031756",
  receiptDigest: "d5d33f27c9e91286c15c813ec32ec2ef0b376a1d03617c9c61baf1e6056353e0",
  sourceDigest: "67e326f6b5f2c9feb84552d425a2f53827df508753be8aea07e4bd35c2593cd5",
});

function reorder(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(reorder).reverse();
  if (value !== null && typeof value === "object" && Object.getPrototypeOf(value) === Object.prototype) {
    return Object.fromEntries(Object.entries(value).reverse().map(([key, entry]) => [key, reorder(entry)]));
  }
  return value;
}

function denied(raw: string, reason: AsfGenerationReasonCodeV1): void {
  const result = parseAsfGenerationV1(raw);
  assert.deepEqual(result, {
    exitCode: ASF_GENERATION_EXIT_CODES_V1[reason],
    outcome: "DENIED",
    reasonCodes: [reason],
  });
}

function jsonMutation(change: (draft: Record<string, any>) => void): string {
  const draft = structuredClone(validSource) as Record<string, any>;
  change(draft);
  return JSON.stringify(draft);
}

test("accepts the canonical proposed source and exposes the exact deterministic projection", () => {
  const result = parseAsfGenerationV1(validRaw);
  assert.equal(result.outcome, "ACCEPTED");
  if (result.outcome !== "ACCEPTED") return;
  assert.deepEqual(result.reasonCodes, ["ASF_GENERATION_ACCEPTED"]);
  assert.equal(result.exitCode, 0);
  // The accepted canonical bytes are the fixture bytes: the projection is a pure
  // function of the canonical proposed source.
  assert.equal(result.canonicalJson, validRaw);
  assert.deepEqual(
    {
      canonicalBytesDigest: result.canonicalBytesDigest,
      outputDigest: result.outputDigest,
      receiptDigest: result.receiptDigest,
      sourceDigest: result.sourceDigest,
    },
    expectedEvidence,
  );
  assert.equal(
    createHash("sha256").update(result.generationJson).digest("hex"),
    result.canonicalBytesDigest,
  );
  const generation = JSON.parse(result.generationJson) as Record<string, unknown>;
  assert.equal(generation.entrypoint, validSource.generation.entrypoint);
  assert.equal(generation.contentDigest, validSource.generation.contentDigest);

  // The receipt binds the source digest, canonical bytes digest, output digest
  // and the parent lock deterministically in one document.
  const receipt = JSON.parse(result.receiptJson) as AsfGenerationReceiptV1;
  assert.equal(receipt.schemaVersion, "chimpmaera.asf/generation-receipt/v1");
  assert.equal(receipt.skillId, validSource.generation.skillId);
  assert.equal(receipt.version, validSource.generation.version);
  assert.equal(receipt.sourceDigest, result.sourceDigest);
  assert.equal(receipt.canonicalBytesDigest, result.canonicalBytesDigest);
  assert.equal(receipt.outputDigest, result.outputDigest);
  assert.deepEqual(receipt.parentLock, validSource.parentLock);

  // The receipt is content-addressed over its own core (digest omitted).
  const receiptCore: Record<string, unknown> = { ...receipt };
  delete receiptCore.receiptDigest;
  assert.equal(receipt.receiptDigest, digestOf(receiptCore));

  // The projection is evidence-safe: sorted keys, declared digests only.
  assert.deepEqual(Object.keys(result.projection).sort(), Object.keys(result.projection));
  assert.equal(result.projection.sourceDigest, result.sourceDigest);
  assert.equal(result.projection.canonicalBytesDigest, result.canonicalBytesDigest);
  assert.equal(result.projection.outputDigest, result.outputDigest);
  assert.equal(result.projection.parentLockIdentity, validSource.parentLock.lockIdentity);
  assert.equal(result.projection.lifecycle, "PROPOSED");

  // verify is deterministic and agrees with the parse path.
  const verified = verifyAsfGenerationV1(validSource);
  assert.equal(verified.outcome, "ACCEPTED");
  if (verified.outcome !== "ACCEPTED") return;
  assert.deepEqual(verified, result);
});

test("equivalent reordered and repeated representations produce byte-identical generation and lock receipts", () => {
  const baseline = canonicalizeAsfGenerationV1(validSource);
  const reordered = canonicalizeAsfGenerationV1(JSON.parse(reorderedRaw));
  const repeated = canonicalizeAsfGenerationV1(validSource);
  for (const result of [baseline, reordered, repeated]) {
    assert.equal(result.outcome, "ACCEPTED");
  }
  if (baseline.outcome !== "ACCEPTED" || reordered.outcome !== "ACCEPTED" || repeated.outcome !== "ACCEPTED") return;
  // Canonical bytes and lock receipt are byte-identical across reorder and repeat.
  assert.equal(baseline.canonicalJson, reordered.canonicalJson);
  assert.equal(baseline.canonicalJson, repeated.canonicalJson);
  assert.equal(baseline.generationJson, reordered.generationJson);
  assert.equal(baseline.generationJson, repeated.generationJson);
  assert.equal(baseline.receiptJson, reordered.receiptJson);
  assert.equal(baseline.receiptJson, repeated.receiptJson);
  assert.equal(baseline.sourceDigest, reordered.sourceDigest);
  assert.equal(baseline.canonicalBytesDigest, reordered.canonicalBytesDigest);
  assert.equal(baseline.outputDigest, reordered.outputDigest);
  assert.equal(baseline.receiptDigest, reordered.receiptDigest);
  // The canonical form is exactly the committed fixture bytes.
  assert.equal(baseline.canonicalJson, validRaw);
  // Programmatic reordering of the same object also canonicalizes identically.
  const programmatic = canonicalizeAsfGenerationV1(reorder(validSource));
  assert.equal(programmatic.outcome, "ACCEPTED");
  if (programmatic.outcome !== "ACCEPTED") return;
  assert.equal(programmatic.canonicalJson, baseline.canonicalJson);
  assert.equal(programmatic.generationJson, baseline.generationJson);
  assert.equal(programmatic.receiptJson, baseline.receiptJson);
});

test("a generation revalidated from its lock has the exact same content address", () => {
  const accepted = parseAsfGenerationV1(validRaw);
  assert.equal(accepted.outcome, "ACCEPTED");
  if (accepted.outcome !== "ACCEPTED") return;
  const receipt = JSON.parse(accepted.receiptJson) as AsfGenerationReceiptV1;
  // Revalidation: the lock receipt re-derives its own content address.
  const receiptCore: Record<string, unknown> = { ...receipt };
  delete receiptCore.receiptDigest;
  assert.equal(receipt.receiptDigest, digestOf(receiptCore));
  // Revalidating the source against the lock checks the complete receipt tuple.
  const revalidated = verifyAsfGenerationFromLockV1(validSource, receipt);
  assert.equal(revalidated.outcome, "ACCEPTED");
  if (revalidated.outcome !== "ACCEPTED") return;
  assert.equal(revalidated.outputDigest, receipt.outputDigest);
  assert.equal(revalidated.sourceDigest, receipt.sourceDigest);
  assert.equal(revalidated.canonicalBytesDigest, receipt.canonicalBytesDigest);
  assert.deepEqual(revalidated.reasonCodes, ["ASF_GENERATION_ACCEPTED"]);
  assert.equal(revalidated.exitCode, 0);
  const tamperedReceipt = { ...receipt, outputDigest: "0".repeat(64) };
  const deniedLock = verifyAsfGenerationFromLockV1(validSource, tamperedReceipt);
  assert.deepEqual(deniedLock, {
    exitCode: ASF_GENERATION_EXIT_CODES_V1.DIGEST_MISMATCH_DENIED,
    outcome: "DENIED",
    reasonCodes: ["DIGEST_MISMATCH_DENIED"],
  });
});

test("noncanonical encodings and tampered sources deny with the exact reason codes", () => {
  // Equivalent but noncanonical encoding: parse denies, canonicalize accepts.
  assert.notEqual(reorderedRaw, validRaw);
  denied(reorderedRaw, "NONCANONICAL_ENCODING_DENIED");
  const reorderedCanonical = canonicalizeAsfGenerationV1(JSON.parse(reorderedRaw));
  assert.equal(reorderedCanonical.outcome, "ACCEPTED");

  // Altered source: one file sha256 drifts from the declared content digest.
  denied(jsonMutation((draft) => {
    draft.generation.content.files[0].sha256 = "0".repeat(64);
  }), "DIGEST_MISMATCH_DENIED");

  // Altered source: a file size drifts from the declared content digest.
  denied(jsonMutation((draft) => {
    draft.generation.content.files[1].size += 1;
  }), "DIGEST_MISMATCH_DENIED");

  // Altered source: the local content locator must bind to contentDigest.
  denied(jsonMutation((draft) => {
    draft.generation.source.locator = `local+sha256:${"0".repeat(64)}`;
  }), "DIGEST_MISMATCH_DENIED");

  // Unknown catalogue: pack references remain bound to the committed catalogue.
  denied(jsonMutation((draft) => {
    draft.capabilityCatalogue.catalogId = "catalog:unknown-probe";
  }), "DIGEST_MISMATCH_DENIED");

  // Invalid canonical bundle: the committed invalid fixture denies.
  denied(invalidRaw, "SCHEMA_DENIED");

  // Invalid JSON and duplicate top-level key deny before verification.
  denied("{not json", "INVALID_JSON_DENIED");
  denied(`${validRaw.slice(0, -1)},"schemaVersion":"${ASF_GENERATION_SOURCE_SCHEMA_V1}"}`, "DUPLICATE_KEY_DENIED");
  denied(validRaw.replace('"files":[', '"files":[').replace(
    '"size":49}', '"size":49,"size":49}',
  ), "DUPLICATE_KEY_DENIED");
});

test("negative probes fail closed with stable reason codes and do not mutate the caller", () => {
  // Unpinned input: version range instead of an exact version.
  denied(jsonMutation((draft) => {
    draft.generation.version = "^1.0.0";
  }), "MUTABLE_ALIAS_OR_RANGE_DENIED");

  // Unpinned input: mutable source declaration.
  denied(jsonMutation((draft) => {
    draft.generation.source.mutable = true;
  }), "MUTABLE_ALIAS_OR_RANGE_DENIED");

  // Unknown capability: the pack references a capability the catalogue lacks.
  denied(jsonMutation((draft) => {
    draft.capabilityPack.references[0].capabilityId = "capability:unknown.probe";
  }), "UNKNOWN_CAPABILITY_DENIED");

  // Nondeterministic metadata: a timestamped build id.
  denied(jsonMutation((draft) => {
    draft.metadata.build = "build:20260828T120000Z";
  }), "NONDETERMINISTIC_METADATA_DENIED");

  denied(jsonMutation((draft) => {
    draft.metadata.build = "build:20260828t120000z";
  }), "NONDETERMINISTIC_METADATA_DENIED");

  // Nondeterministic metadata: a negative sequence.
  denied(jsonMutation((draft) => {
    draft.metadata.sequence = -1;
  }), "NONDETERMINISTIC_METADATA_DENIED");

  // Preexisting active state denies without a generation claim.
  denied(jsonMutation((draft) => {
    draft.lifecycle.state = "ACTIVE";
  }), "PREEXISTING_ACTIVE_STATE_DENIED");

  // Missing capability binding.
  denied(jsonMutation((draft) => {
    delete draft.capabilityPack.references[0].catalogueBinding;
  }), "CATALOGUE_BINDING_MISSING_DENIED");

  // Missing authority field.
  denied(jsonMutation((draft) => {
    delete draft.authority;
  }), "AUTHORITY_FIELD_MISSING_DENIED");

  // Unsupported parent lock schema.
  denied(jsonMutation((draft) => {
    draft.parentLock.schemaVersion = "chimpmaera.asf/bundle-lock/v0";
  }), "UNSUPPORTED_VERSION_DENIED");

  // Unsupported source schema.
  denied(jsonMutation((draft) => {
    draft.schemaVersion = "chimpmaera.asf/generation-source/v0";
  }), "UNSUPPORTED_VERSION_DENIED");

  // Verification is a pure function: the caller is never mutated.
  const before = structuredClone(validSource);
  assert.equal(verifyAsfGenerationV1(validSource).outcome, "ACCEPTED");
  assert.deepEqual(validSource, before);
});

test("invalid semantic sources deny without a generation claim or a throw", () => {
  const broken = structuredClone(validSource) as Record<string, any>;
  delete broken.generation.contentDigest;
  const result = verifyAsfGenerationV1(broken);
  assert.deepEqual(result, {
    exitCode: ASF_GENERATION_EXIT_CODES_V1.SCHEMA_DENIED,
    outcome: "DENIED",
    reasonCodes: ["SCHEMA_DENIED"],
  });
  // A denied projection carries no generation evidence: no digest fields.
  assert.equal("sourceDigest" in result, false);
  assert.equal("outputDigest" in result, false);
  assert.equal("receiptDigest" in result, false);
});