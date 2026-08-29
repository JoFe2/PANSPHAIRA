import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import {
  NO_RELEASE_STATEMENT,
  renderPublicReadback,
  validatePublicReadbackInput,
} from "../scripts/render-asf-public-readback.mjs";

const fixturePath = (name) => join(process.cwd(), "tests", "fixtures", "asf-public-readback", name);
const readFixture = (name) => JSON.parse(readFileSync(fixturePath(name), "utf8"));

function rejectsWith(code, value) {
  assert.throws(() => validatePublicReadbackInput(value), new RegExp(code));
}

test("verified canonical synthetic receipts render a stable redacted readback", () => {
  const fixture = readFixture("verified.json");
  const first = renderPublicReadback(fixture);
  const second = renderPublicReadback(readFixture("verified.json"));

  assert.deepEqual(first, second);
  assert.equal(first.schemaVersion, "pansphaira.asf/public-readback/v1");
  assert.equal(first.authority, "LOCAL_DETERMINISTIC_HARNESS_ONLY");
  assert.equal(first.scope, "SYNTHETIC_LOCAL_ONLY");
  assert.equal(first.redactedDemo.outcome, "ACCEPTED");
  assert.equal(first.redactedDemo.stageReceiptDigests.public, "1bb4d2203fc8393593140b830557f14fbb8fa09c2e19a2b90f87b0dfd6bbac45");
  assert.equal(first.recoveryGuide.mode, "RESTORE_EXACT_LKG_OR_DENY");
  assert.equal(first.plannedVersusImplemented[2].status, "NOT_IMPLEMENTED_AND_NOT_CLAIMED");
  assert.equal(first.noReleaseStatement, NO_RELEASE_STATEMENT);
  assert.equal(JSON.stringify(first).includes("https://"), false);
  assert.equal(JSON.stringify(first).includes("/private/"), false);
});

test("the explicit no-release fixture statement is rendered without a delivery claim", () => {
  const output = renderPublicReadback(readFixture("verified.json"));
  assert.equal(output.noReleaseStatement, "No protected delivery, release, or public readback occurred.");
  assert.equal(output.plannedVersusImplemented.some((item) => item.status === "NOT_IMPLEMENTED_AND_NOT_CLAIMED"), true);
  assert.equal(output.plannedVersusImplemented.some((item) => item.status === "DELIVERED" || item.status === "RELEASED"), false);
});

test("missing and tampered receipts fail closed", () => {
  const missing = readFixture("verified.json");
  delete missing.receipt;
  rejectsWith("MISSING_INPUT_FIELD", missing);

  const tampered = readFixture("verified.json");
  tampered.receipt.stageReceipts.public = "0".repeat(64);
  rejectsWith("TAMPERED_RECEIPT", tampered);
});

test("raw identity, token, path, host, session, job, URL, finding, exploit, and external action material is rejected", () => {
  const keys = [
    "rawIdentity",
    "rawToken",
    "privatePath",
    "host",
    "session",
    "job",
    "unverifiedUrl",
    "securityFinding",
    "exploitPayload",
    "externalAction",
  ];
  for (const key of keys) {
    const candidate = readFixture("verified.json");
    candidate[key] = "must reject";
    rejectsWith("RAW_SENSITIVE_FIELD", candidate);
  }
});

test("unsupported claims and the checked-in leak fixture are rejected", () => {
  const unsupported = readFixture("verified.json");
  unsupported.claims = ["PRODUCTION_READY"];
  rejectsWith("UNSUPPORTED_CLAIM", unsupported);

  rejectsWith("RAW_SENSITIVE_FIELD", readFixture("leak.json"));
});

test("rendering performs no file or external action", () => {
  const fixture = readFixture("verified.json");
  const before = JSON.stringify(fixture);
  renderPublicReadback(fixture);
  assert.equal(JSON.stringify(fixture), before);
});
