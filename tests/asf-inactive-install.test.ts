import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  ASF_INACTIVE_INSTALL_AUTHORITY_V1,
  ASF_INACTIVE_INSTALL_EXIT_CODES_V1,
  ASF_INACTIVE_INSTALL_STATE_V1,
  installAsfGenerationInactiveV1,
  parseAsfInactiveInstallV1,
  validateAsfInactiveInstallReceiptV1,
  type AsfInactiveInstallInputV1,
  type AsfInactiveInstallReasonCodeV1,
} from "../packages/contracts/src/asf-inactive-install.js";
import { asfAnalysisReceiptDigestV1 } from "../packages/contracts/src/asf-analysis.js";
import { canonicalJson } from "../packages/contracts/src/canonical-json.js";

const fixtureRoot = "tests/fixtures/asf-inactive-install";
const acceptedRaw = readFileSync(`${fixtureRoot}/accepted.json`, "utf8");
const accepted = JSON.parse(acceptedRaw) as AsfInactiveInstallInputV1;

function clone<T>(value: T): T {
  return structuredClone(value);
}

function denied(value: unknown, reason: AsfInactiveInstallReasonCodeV1): void {
  const result = installAsfGenerationInactiveV1(value);
  assert.equal(result.outcome, "DENIED");
  if (result.outcome !== "DENIED") return;
  assert.deepEqual(result.reasonCodes, [reason]);
  assert.equal(result.exitCode, ASF_INACTIVE_INSTALL_EXIT_CODES_V1[reason]);
}

function deniedWithoutMutation(value: AsfInactiveInstallInputV1, reason: AsfInactiveInstallReasonCodeV1): void {
  const before = clone(value);
  denied(value, reason);
  assert.deepEqual(value, before);
}

function mutate(change: (draft: any) => void): AsfInactiveInstallInputV1 {
  const draft = clone(accepted);
  change(draft);
  return draft;
}

test("records one accepted immutable generation as installed_inactive with exact receipts", () => {
  const first = parseAsfInactiveInstallV1(acceptedRaw);
  const second = installAsfGenerationInactiveV1(clone(accepted));
  assert.equal(first.outcome, "ACCEPTED");
  assert.deepEqual(second, first);
  if (first.outcome !== "ACCEPTED") return;

  assert.equal(first.exitCode, 0);
  assert.deepEqual(first.reasonCodes, ["ASF_INACTIVE_INSTALL_ACCEPTED"]);
  assert.equal(first.stateTransition.from, "uninstalled");
  assert.equal(first.stateTransition.to, ASF_INACTIVE_INSTALL_STATE_V1);
  assert.equal(first.projection.installed.length, 2);
  assert.equal(first.projection.installed.filter((entry) => entry.skillId === accepted.generation.skillId).length, 1);

  const installed = first.projection.installed.find((entry) => entry.skillId === accepted.generation.skillId);
  assert.deepEqual(installed, {
    generationDigest: accepted.generation.generationDigest,
    lockDigest: accepted.generation.lockDigest,
    state: ASF_INACTIVE_INSTALL_STATE_V1,
    skillId: accepted.generation.skillId,
    version: accepted.generation.version,
  });
  assert.equal(first.receipt.generationDigest, accepted.generation.generationDigest);
  assert.equal(first.receipt.generationReceiptDigest, accepted.generationReceipt.receiptDigest);
  assert.equal(first.receipt.analysisReceiptDigest, accepted.analysisReceipt.receiptDigest);
  assert.equal(first.receipt.lockIdentity, accepted.lock.lock.lockIdentity);
  assert.equal(first.receipt.state, ASF_INACTIVE_INSTALL_STATE_V1);
  assert.deepEqual(first.receipt.authority, ASF_INACTIVE_INSTALL_AUTHORITY_V1);
  assert.equal(validateAsfInactiveInstallReceiptV1(first.receipt), true);
  assert.equal(first.receiptJson, canonicalJson(first.receipt));
  assert.equal(first.canonicalJson, acceptedRaw);
});

test("preserves an unrelated accepted generation byte-for-byte", () => {
  const unrelated = accepted.installed.find((entry) => entry.skillId === "skill:unrelated");
  assert.ok(unrelated);
  const result = installAsfGenerationInactiveV1(accepted);
  assert.equal(result.outcome, "ACCEPTED");
  if (result.outcome !== "ACCEPTED") return;
  const projected = result.projection.installed.find((entry) => entry.skillId === unrelated.skillId);
  assert.ok(projected);
  assert.equal(canonicalJson(projected), canonicalJson(unrelated));
  assert.deepEqual(projected, unrelated);
});

test("is idempotent for the same generation without creating a second record", () => {
  const first = installAsfGenerationInactiveV1(accepted);
  assert.equal(first.outcome, "ACCEPTED");
  if (first.outcome !== "ACCEPTED") return;
  const again = installAsfGenerationInactiveV1({
    ...accepted,
    installed: first.projection.installed,
  });
  assert.equal(again.outcome, "ACCEPTED");
  if (again.outcome !== "ACCEPTED") return;
  assert.equal(again.stateTransition.from, ASF_INACTIVE_INSTALL_STATE_V1);
  assert.equal(again.projection.installed.filter((entry) => entry.skillId === accepted.generation.skillId).length, 1);
  assert.deepEqual(again.receipt, first.receipt);
});

test("denied analysis and duplicate object keys fail closed", () => {
  denied(JSON.parse(readFileSync(`${fixtureRoot}/denied-analysis.json`, "utf8")), "ANALYSIS_RECEIPT_DENIED");
  const duplicateRaw = readFileSync(`${fixtureRoot}/duplicate.json`, "utf8");
  const duplicate = parseAsfInactiveInstallV1(duplicateRaw);
  assert.deepEqual(duplicate, {
    outcome: "DENIED",
    reasonCodes: ["DUPLICATE_KEY_DENIED"],
    exitCode: ASF_INACTIVE_INSTALL_EXIT_CODES_V1.DUPLICATE_KEY_DENIED,
  });
});

test("active state, alias, callback, unknown catalogue, conflict, and incompatible lock deny without state change", () => {
  deniedWithoutMutation(mutate((draft) => {
    draft.requestedState = "ACTIVE";
  }), "ACTIVE_STATE_DENIED");
  deniedWithoutMutation(mutate((draft) => {
    draft.generation.version = "latest";
  }), "MUTABLE_ALIAS_DENIED");
  deniedWithoutMutation(mutate((draft) => {
    draft.analysisReceipt.authority.mutation = "would-write-state";
  }), "MUTATION_CALLBACK_DENIED");
  deniedWithoutMutation(mutate((draft) => {
    draft.generation.capabilityIds[0] = "capability:unknown.catalogue";
  }), "UNKNOWN_CAPABILITY_DENIED");
  deniedWithoutMutation(mutate((draft) => {
    draft.installed = [...draft.installed, {
      generationDigest: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
      lockDigest: draft.generation.lockDigest,
      state: ASF_INACTIVE_INSTALL_STATE_V1,
      skillId: draft.generation.skillId,
      version: draft.generation.version,
    }];
  }), "DUPLICATE_GENERATION_DENIED");
  deniedWithoutMutation(mutate((draft) => {
    draft.lock.lock.lockIdentity = "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
  }), "LOCK_BINDING_DENIED");
});

test("tampered analysis and generation receipts deny before any projection is emitted", () => {
  const analysis = mutate((draft) => {
    draft.analysisReceipt = {
      ...draft.analysisReceipt,
      generationDigest: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
      receiptDigest: "0000000000000000000000000000000000000000000000000000000000000000",
    };
  });
  deniedWithoutMutation(analysis, "ANALYSIS_RECEIPT_DENIED");

  const generationReceipt = mutate((draft) => {
    draft.generationReceipt = {
      ...draft.generationReceipt,
      outputDigest: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
    };
  });
  deniedWithoutMutation(generationReceipt, "GENERATION_RECEIPT_DENIED");

  const mismatchedAnalysis = mutate((draft) => {
    const receipt = { ...draft.analysisReceipt, generationDigest: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa" };
    draft.analysisReceipt = { ...receipt, receiptDigest: asfAnalysisReceiptDigestV1(receipt) };
  });
  deniedWithoutMutation(mismatchedAnalysis, "DIGEST_MISMATCH_DENIED");
});

test("parse is canonical and invalid input carries no state or authority evidence", () => {
  const reordered = JSON.stringify(Object.fromEntries(Object.entries(accepted).reverse()));
  const result = parseAsfInactiveInstallV1(reordered);
  assert.equal(result.outcome, "DENIED");
  if (result.outcome !== "DENIED") return;
  assert.deepEqual(result.reasonCodes, ["NONCANONICAL_ENCODING_DENIED"]);
  assert.equal("projection" in result, false);
  assert.equal("receipt" in result, false);
  assert.equal(JSON.stringify(result).includes("NO_AUTHORITY"), false);
});
