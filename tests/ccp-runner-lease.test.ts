import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  canonicalCcpRunnerLeaseReceiptJsonV1,
  evaluateCcpRunnerLeaseV1,
  parseCcpRunnerLeaseReceiptV1,
  verifyCcpRunnerLeaseReceiptV1,
  CCP_RUNNER_LEASE_RECEIPT_SCHEMA_V1,
} from "../packages/contracts/src/ccp-runner-lease.js";
import { ccpDigestDomainV1 } from "../packages/contracts/src/ccp-event-envelope.js";

interface RunnerFixture {
  lease: { request: unknown; context: unknown };
}

const fixture = (): RunnerFixture => JSON.parse(
  readFileSync("tests/fixtures/ccp-runner/isolated-success.json", "utf8"),
);

function rehashReceipt(record: Record<string, unknown>): void {
  const { receiptDigest: _old, ...unsigned } = record;
  record.receiptDigest = ccpDigestDomainV1(CCP_RUNNER_LEASE_RECEIPT_SCHEMA_V1, unsigned);
}

test("CCP-PSAI52-RUNNER-001 lease issuance is deterministic, pure and ephemeral", () => {
  const input = fixture();
  const snapshot = JSON.stringify(input);
  const first = evaluateCcpRunnerLeaseV1(input.lease.request, input.lease.context);
  const second = evaluateCcpRunnerLeaseV1(
    JSON.parse(JSON.stringify(input.lease.request)),
    JSON.parse(JSON.stringify(input.lease.context)),
  );

  assert.equal(JSON.stringify(input), snapshot);
  assert.equal(canonicalCcpRunnerLeaseReceiptJsonV1(first), canonicalCcpRunnerLeaseReceiptJsonV1(second));
  assert.equal(first.disposition, "LEASED");
  assert.equal(first.transition, "LEASE_ISSUED");
  assert.equal(first.reasonCode, "LEASE_ISSUED_EPHEMERAL_ISOLATED");
  assert.equal(first.lease?.ephemeral, true);
  assert.equal(first.lease?.isolated, true);
  assert.equal(first.eligibility.runnerEligible, true);
  assert.equal(first.eligibility.executionAuthorized, false);
  assert.equal(first.eligibility.mergeAuthorized, false);
  assert.equal(first.eligibility.networkExposed, false);
  assert.equal(first.eligibility.secretsExposed, false);
  assert.equal(Object.isFrozen(first), true);
  assert.equal(Object.isFrozen(first.lease), true);
  assert.notEqual(first.receiptDigest, "");
  assert.notEqual(verifyCcpRunnerLeaseReceiptV1(first), null);
});

test("CCP-PSAI52-RUNNER-002 lease denies shared, networked, secret-bearing or merge-authorizing requests", () => {
  const input = fixture();
  const cases = [
    ["isolationMode", "SHARED", "NON_ISOLATED_RUNNER"],
    ["networkPolicy", "REQUESTED", "NETWORK_ACCESS_REQUESTED"],
    ["secretPolicy", "REQUESTED", "SECRET_ACCESS_REQUESTED"],
    ["mergeAuthority", "REQUESTED", "MERGE_AUTHORITY_REQUESTED"],
  ] as const;

  for (const [field, value, reason] of cases) {
    const request = { ...(input.lease.request as Record<string, unknown>), [field]: value };
    const receipt = evaluateCcpRunnerLeaseV1(request, input.lease.context);
    assert.equal(receipt.disposition, "DENIED");
    assert.equal(receipt.transition, "LEASE_DENIED");
    assert.equal(receipt.reasonCode, reason);
    assert.equal(receipt.lease, null);
    assert.deepEqual(receipt.eligibility, {
      runnerEligible: false,
      executionAuthorized: false,
      mergeAuthorized: false,
      networkExposed: false,
      secretsExposed: false,
    });
  }

  const active = evaluateCcpRunnerLeaseV1(input.lease.request, {
    ...(input.lease.context as Record<string, unknown>),
    activeLeaseId: "lease:dddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd",
  });
  assert.equal(active.reasonCode, "ACTIVE_LEASE_PRESENT");

  const foreign = evaluateCcpRunnerLeaseV1(input.lease.request, {
    ...(input.lease.context as Record<string, unknown>),
    tenantId: "tenant:foreign",
  });
  assert.equal(foreign.reasonCode, "IDENTITY_MISMATCH");
});

test("CCP-PSAI52-RUNNER-003 receipt parser rejects rehashed authority forgeries and malformed input", () => {
  const input = fixture();
  const receipt = evaluateCcpRunnerLeaseV1(input.lease.request, input.lease.context);
  const forged = JSON.parse(JSON.stringify(receipt)) as Record<string, unknown>;
  (forged.eligibility as Record<string, unknown>).mergeAuthorized = true;
  rehashReceipt(forged);
  assert.equal(verifyCcpRunnerLeaseReceiptV1(forged), null);
  assert.throws(
    () => evaluateCcpRunnerLeaseV1({ ...(input.lease.request as object), ambientSecret: "must-not-be-read" }, input.lease.context),
    /CCP_RUNNER_LEASE_REQUEST_SCHEMA_DENIED/,
  );
  assert.throws(() => parseCcpRunnerLeaseReceiptV1("not-a-receipt"), /CCP_RUNNER_LEASE_RECEIPT_SCHEMA_DENIED/);
});
