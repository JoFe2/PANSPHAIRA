import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  AP05_EXACT_HEAD_V1,
  generateIncomingInvoiceAp05ReceiptManifestV1,
  verifyIncomingInvoiceAp05ReceiptManifestV1,
  type IncomingInvoiceAp05ReceiptManifestInputV1,
} from "../packages/contracts/src/index.js";

const CASE_PACK = "tests/fixtures/incoming-invoice/ap-04-erv-cases-v1.json";
const SETUP = "tests/fixtures/incoming-invoice/ap-05-frozen-setup-v1.json";

function bytes(path: string): Uint8Array {
  return Uint8Array.from(readFileSync(path));
}
function input(): IncomingInvoiceAp05ReceiptManifestInputV1 {
  return {
    setup: JSON.parse(readFileSync(SETUP, "utf8")),
    predecessorSources: [
      { path: "packages/contracts/src/incoming-invoice-adaptive-ui.ts", bytes: bytes("packages/contracts/src/incoming-invoice-adaptive-ui.ts") },
      { path: "docs/INCOMING-INVOICE-APPLICATION-GUIDE.md", bytes: bytes("docs/INCOMING-INVOICE-APPLICATION-GUIDE.md") },
      { path: "packages/contracts/src/incoming-invoice-erv.ts", bytes: bytes("packages/contracts/src/incoming-invoice-erv.ts") },
      { path: CASE_PACK, bytes: bytes(CASE_PACK) },
    ],
  };
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

 test("AP-05 receipt manifest regenerates byte-for-byte from released producers", () => {
  const first = generateIncomingInvoiceAp05ReceiptManifestV1(input());
  const replay = generateIncomingInvoiceAp05ReceiptManifestV1(input());
  assert.equal(first.serialized, replay.serialized);
  assert.equal(first.manifest.predecessorLineage.exactHead, AP05_EXACT_HEAD_V1);
  assert.equal(first.manifest.publicReceipt.authority.mode, "NONE");
  assert.equal(first.manifest.publicReceipt.authority.evidenceClass, "PUBLIC_SYNTHETIC_NON_CUSTOMER");
  assert.equal(first.manifest.publicReceipt.baseline.denominator.caseCount, 8);
  assert.equal(first.manifest.publicReceipt.adapted.outcome.state, "UNKNOWN");
  assert.equal(first.manifest.publicReceipt.adapted.denominator.decisionCount, 0);
  assert.equal(first.manifest.sourceEvidenceRelease.releaseTag, "pan365-ap05-receipt-manifest-source-v1");
  assert.equal(first.manifest.sourceEvidenceRelease.releaseStatus, "PENDING_EXACT_SOURCE_RELEASE");
  assert.equal(first.manifest.sourceEvidenceRelease.sourceCommit, null);
  const prerequisite = first.manifest.externalPrerequisites[0];
  assert.ok(prerequisite);
  assert.equal(prerequisite.status, "SOURCE_VERIFIED");
  assert.deepEqual(prerequisite.boundPredecessor, {
    releaseId: "ap04-erv-source-v1",
    releaseTag: "pan377-current-head-docker-e2e-source-v1",
    mergeSha: "ff68eda6cacc510ee67ed3b5b6cd51545f017a21",
    sourceCommit: "ff68eda6cacc510ee67ed3b5b6cd51545f017a21",
  });
  const releases = first.manifest.predecessorLineage.releases;
  assert.equal(releases.length, 3);
  assert.equal(releases[0]!.mergeSha, "988395110a9189d1b8cd4ee98184ed5c1d77a15d");
  assert.equal(releases[0]!.sourceCommit, "988395110a9189d1b8cd4ee98184ed5c1d77a15d");
  assert.equal(releases[1]!.mergeSha, "ef10d39fa7843e7c45e6e46cbc73647ad4a3ea2c");
  assert.equal(releases[1]!.sourceCommit, "ef10d39fa7843e7c45e6e46cbc73647ad4a3ea2c");
  assert.equal("pairedClosureReceipt" in prerequisite, false);
  assert.deepEqual(prerequisite.boundArtifacts, [
    { path: "packages/contracts/src/incoming-invoice-erv.ts", identity: { byteLength: 21114, sha256: "6ba5250783df35f60602a11437c843272ab014bf24e69135cfbf52dfb41750cf" } },
    { path: "schemas/contracts/incoming-invoice-erv-v1.schema.json", identity: { byteLength: 12657, sha256: "7eabf5156f5a74404499b67d435c879f123f9d842028c739033269edd7959caf" } },
  ]);
  const lineageSources = first.manifest.predecessorLineage.sources;
  const adaptiveSource = lineageSources[0];
  const frozenSource = lineageSources[2];
  assert.ok(adaptiveSource);
  assert.ok(frozenSource);
  assert.equal(adaptiveSource.identity.sha256, "69541b22c8545cf24ccb7e3004337cb6572209547ee926bc6d490954170a9aa4");
  assert.equal(adaptiveSource.identity.byteLength, 29722);
  assert.deepEqual(adaptiveSource.releaseIds, ["pan365-adaptive-ui-source-v1"]);
  assert.equal(frozenSource.identity.sha256, "e60fb079364bc48d12629825531299bc7abd9986c5299067e450e7577ef75b1f");
  assert.deepEqual(first.manifest.publicReceipt.baseline.outcomeCounts, {
    MATCHED: 3,
    CONFLICT: 1,
    EXCEPTION: 3,
    DENIED: 1,
  });
});

test("AP-05 manifest binds source, setup, core, receipt and manifest identities", () => {
  const generated = generateIncomingInvoiceAp05ReceiptManifestV1(input());
  const checkedInBytes = readFileSync("verification/incoming-invoice-ap05-receipt-manifest-v1.json", "utf8");
  assert.equal(checkedInBytes, generated.serialized);
  assert.equal(verifyIncomingInvoiceAp05ReceiptManifestV1(generated.manifest, input()).valid, true);
  assert.equal(generated.manifest.ap04.casePack.identity.byteLength, 19841);
  assert.match(generated.manifest.ap04.casePack.identity.sha256, /^[a-f0-9]{64}$/);
  assert.match(generated.manifest.ap04.coreOutput.identity.sha256, /^[a-f0-9]{64}$/);
  assert.match(generated.manifest.publicReceipt.baseline.receiptIdentity.sha256, /^[a-f0-9]{64}$/);
  assert.match(generated.manifest.manifestIdentity.sha256, /^[a-f0-9]{64}$/);
});

test("AP-05 verifier rejects missing, substituted or re-digested identities and lineage", () => {
  const generated = generateIncomingInvoiceAp05ReceiptManifestV1(input()).manifest;
  const mutations: Array<[string, (value: any) => void]> = [
    ["missing source", (value) => { delete value.predecessorLineage.sources[0]; }],
    ["substituted source", (value) => { value.predecessorLineage.sources[0].identity.sha256 = "0".repeat(64); }],
    ["re-digested source", (value) => { value.predecessorLineage.sources[0].identity.sha256 = "1".repeat(64); }],
    ["configuration identity", (value) => { value.ap05Setup.configurationIdentity.sha256 = "2".repeat(64); }],
    ["core identity", (value) => { value.ap04.coreOutput.identity.sha256 = "3".repeat(64); }],
    ["receipt identity", (value) => { value.publicReceipt.baseline.receiptIdentity.sha256 = "4".repeat(64); }],
    ["manifest identity", (value) => { value.manifestIdentity.sha256 = "5".repeat(64); }],
    ["omitted predecessor release lineage", (value) => { delete value.predecessorLineage.releases[0]; }],
    ["unverified external prerequisite", (value) => { value.externalPrerequisites[0].status = "UNVERIFIED"; }],
    ["substituted external predecessor", (value) => { value.externalPrerequisites[0].boundPredecessor.mergeSha = "6".repeat(40); }],
    ["missing bound external artifact", (value) => { delete value.externalPrerequisites[0].boundArtifacts[1]; }],
  ];
  for (const [name, mutate] of mutations) {
    const candidate = clone(generated);
    mutate(candidate);
    assert.equal(verifyIncomingInvoiceAp05ReceiptManifestV1(candidate, input()).valid, false, name);
  }
});

test("AP-05 verifier rejects AP04/AP05 aliasing and answer substitution", () => {
  const generated = generateIncomingInvoiceAp05ReceiptManifestV1(input()).manifest;
  const alias = clone(generated) as any;
  alias.predecessorLineage.sources[3].identity.sha256 = alias.ap04.coreOutput.identity.sha256;
  assert.equal(verifyIncomingInvoiceAp05ReceiptManifestV1(alias, input()).valid, false);

  const answerInput = input() as any;
  answerInput.setup.answers[0].answer = "DECLINE";
  assert.equal(verifyIncomingInvoiceAp05ReceiptManifestV1(generated, answerInput).valid, false);
});

test("AP-05 projection denies invented capability and public identity/free-text leakage", () => {
  const generated = generateIncomingInvoiceAp05ReceiptManifestV1(input()).manifest;
  assert.equal(generated.ap05Setup.configurationDelta.authorityGranted, false);
  assert.deepEqual(generated.ap05Setup.configurationDelta.inventedExecutableFunctions, []);
  const receipt = JSON.stringify(generated.publicReceipt);
  for (const forbidden of ["supplierId", "invoiceId", "referenceId", "customerId", "questionText", "credential", "password"]) {
    assert.equal(receipt.includes(forbidden), false, forbidden);
  }
  const invented = clone(generated) as any;
  invented.publicReceipt.baseline.outcomeCounts.INVENTED_CAPABILITY = 1;
  assert.equal(verifyIncomingInvoiceAp05ReceiptManifestV1(invented, input()).valid, false);
});

 test("AP-05 source-bound generator fails closed for substituted source bytes and unsupported capability", () => {
  const sourceSubstitution = input() as any;
  sourceSubstitution.predecessorSources[0].bytes = Uint8Array.from([...sourceSubstitution.predecessorSources[0].bytes, 0]);
  assert.throws(() => generateIncomingInvoiceAp05ReceiptManifestV1(sourceSubstitution), /SOURCE_IDENTITY_MISMATCH/);

  const unsupported = input() as any;
  unsupported.setup.changed.requestedEffects = ["READ_SYNTHETIC", "POST_PRODUCTIVE"];
  assert.throws(() => generateIncomingInvoiceAp05ReceiptManifestV1(unsupported), /SETUP_DENIED/);
});
