import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import test from "node:test";
import Ajv2020 from "ajv/dist/2020.js";
import {
  INCOMING_INVOICE_INTAKE_REQUEST_V1,
  InMemorySyntheticInvoiceIntakeStoreV1,
  canonicalJsonV1,
  intakeSyntheticSupplierInvoiceV1,
  readSyntheticSupplierInvoiceV1,
  sha256HexV1,
  supplierInvoiceIdentityDigestV1,
  type IncomingInvoiceIntakeRequestV1,
  type IncomingInvoiceRecordV1,
  type SyntheticInvoiceIntakeStoreV1,
} from "../packages/contracts/src/index.js";

const fixturePath = "tests/fixtures/incoming-invoice/supplier-invoice-v1.txt";
const manifestPath = "tests/fixtures/incoming-invoice/source-manifest-v1.json";
const frozenSha256 = "fad5979234e5ca8d31e2a10e7a9650c5f4f32693610c2fcf2678b0ab5a5f525b";
const bytes = Uint8Array.from(readFileSync(fixturePath));
const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));

function request(overrides: Record<string, unknown> = {}): IncomingInvoiceIntakeRequestV1 {
  return {
    schemaVersion: INCOMING_INVOICE_INTAKE_REQUEST_V1,
    blueprintSchemaVersion: "chimpmaera.incoming-invoice/blueprint/v1",
    requestedAuthority: "LOCAL_SYNTHETIC_PROOF",
    requestedEffects: ["READ_SYNTHETIC", "WRITE_LOCAL_PROOF"],
    fileName: manifest.fileName,
    mediaType: manifest.mediaType,
    bytes: Uint8Array.from(bytes),
    claimedSha256: frozenSha256,
    provenance: structuredClone(manifest.provenance),
    metadata: {
      documentId: "doc:synthetic:ap-02:supplier-invoice-v1",
      versionOrdinal: 1,
      documentKind: "SUPPLIER_INVOICE",
      issueDate: "2026-09-02",
      currency: "EUR",
    },
    identityCandidates: [structuredClone(manifest.declaredIdentity)],
    ...overrides,
  } as IncomingInvoiceIntakeRequestV1;
}

function independentCanonical(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(independentCanonical).join(",")}]`;
  const object = value as Record<string, unknown>;
  return `{${Object.keys(object).sort().map((key) => `${JSON.stringify(key)}:${independentCanonical(object[key])}`).join(",")}}`;
}

function independentDigest(value: unknown): string {
  return createHash("sha256").update(independentCanonical(value)).digest("hex");
}

async function accepted(store = new InMemorySyntheticInvoiceIntakeStoreV1()) {
  const result = await intakeSyntheticSupplierInvoiceV1(request(), store);
  assert.equal(result.outcome, "ACCEPTED");
  if (result.outcome !== "ACCEPTED") throw new Error("expected accepted intake");
  return { store, record: result.record };
}

test("AP-02 AC01 freezes exact synthetic source bytes and provenance", () => {
  assert.equal(bytes.byteLength, 153);
  assert.equal(createHash("sha256").update(bytes).digest("hex"), frozenSha256);
  assert.deepEqual(manifest, {
    schemaVersion: "chimpmaera.incoming-invoice/source-manifest/v1",
    fileName: "supplier-invoice-v1.txt",
    mediaType: "text/plain; charset=utf-8",
    byteLength: 153,
    sha256: frozenSha256,
    provenance: {
      sourceId: "source:synthetic:ap-02:supplier-invoice-v1",
      sourceKind: "LOCAL_SYNTHETIC_FIXTURE",
      locator: fixturePath,
      capturedAt: "2026-09-02T00:00:00.000Z",
      generator: "AP-02_FROZEN_HAND_AUTHORED_V1",
      synthetic: true,
      customerData: false,
      externalRetrieval: false,
    },
    declaredIdentity: { supplierId: "SYN-SUP-001", invoiceNumber: "SYN-INV-2026-0001" },
  });
});

test("AP-02 AC02 binds document version, content, metadata and supplier-invoice identity", async () => {
  const { store, record } = await accepted();
  assert.equal(store.size, 1);
  assert.equal(record.version.contentSha256, sha256HexV1(bytes));
  assert.equal(canonicalJsonV1({ b: 2, a: 1 }), '{"a":1,"b":2}');
  const identity = { supplierId: "SYN-SUP-001", invoiceNumber: "SYN-INV-2026-0001" };
  assert.equal(record.supplierInvoiceIdentity.identityDigest, independentDigest({
    schemaVersion: "chimpmaera.incoming-invoice/supplier-invoice-identity/v1", ...identity,
  }));
  assert.equal(record.supplierInvoiceIdentity.identityDigest, supplierInvoiceIdentityDigestV1(identity));
  assert.equal(record.version.metadataDigest, independentDigest(record.metadata));
  const expectedVersion = `version:sha256:${independentDigest({
    documentId: record.metadata.documentId,
    ordinal: record.metadata.versionOrdinal,
    contentSha256: record.version.contentSha256,
    metadataDigest: record.version.metadataDigest,
    identityDigest: record.supplierInvoiceIdentity.identityDigest,
  })}`;
  assert.equal(record.version.versionId, expectedVersion);
  const { recordDigest: _digest, ...unsigned } = record;
  assert.equal(record.recordDigest, independentDigest(unsigned));
  assert.equal(Object.isFrozen(record), true);
});

test("AP-02 AC03 fails closed before insertion for malformed, unsupported, tampered and ambiguous input", async () => {
  class SpyStore extends InMemorySyntheticInvoiceIntakeStoreV1 {
    calls = 0;
    override async insertIfAbsent(record: IncomingInvoiceRecordV1) {
      this.calls += 1;
      return super.insertIfAbsent(record);
    }
  }
  const unsupported = request({ mediaType: "application/pdf", claimedSha256: "0".repeat(64), identityCandidates: [] });
  const probes: Array<[string, unknown, string]> = [
    ["shape", { ...request(), unexpected: true }, "REQUEST_SHAPE_DENIED"],
    ["version", request({ schemaVersion: "chimpmaera.incoming-invoice/intake-request/v2" }), "VERSION_DENIED"],
    ["authority", request({ requestedAuthority: "PRODUCTIVE" }), "AP01_AUTHORITY_DENIED"],
    ["effects", request({ requestedEffects: ["WRITE_LOCAL_PROOF", "READ_SYNTHETIC"] }), "EFFECT_DENIED"],
    ["unsupported-precedence", unsupported, "UNSUPPORTED_DOCUMENT_DENIED"],
    ["provenance", request({ provenance: { ...manifest.provenance, customerData: true } }), "NON_SYNTHETIC_PROVENANCE_DENIED"],
    ["tamper", request({ bytes: Uint8Array.from([...bytes.slice(0, -1), 88]) }), "TAMPERED_CONTENT_DENIED"],
    ["zero-candidate", request({ identityCandidates: [] }), "AMBIGUOUS_IDENTITY_DENIED"],
    ["two-candidates", request({ identityCandidates: [manifest.declaredIdentity, manifest.declaredIdentity] }), "AMBIGUOUS_IDENTITY_DENIED"],
    ["metadata", request({ metadata: { ...request().metadata, issueDate: "2026-02-30" } }), "INVALID_METADATA_DENIED"],
  ];
  for (const [name, candidate, reason] of probes) {
    const store = new SpyStore();
    assert.deepEqual(await intakeSyntheticSupplierInvoiceV1(candidate, store), { outcome: "DENIED", reasonCodes: [reason] }, name);
    assert.equal(store.calls, 0, name);
    assert.equal(store.size, 0, name);
  }
});

test("AP-02 AC03 atomically denies duplicate content and self-consistently rehashed non-frozen bytes", async () => {
  const store = new InMemorySyntheticInvoiceIntakeStoreV1();
  assert.equal((await intakeSyntheticSupplierInvoiceV1(request(), store)).outcome, "ACCEPTED");
  assert.deepEqual(await intakeSyntheticSupplierInvoiceV1(request(), store), {
    outcome: "DENIED", reasonCodes: ["DUPLICATE_CONTENT_DENIED"],
  });
  const changedBytes = Uint8Array.from([...bytes, 32]);
  assert.deepEqual(await intakeSyntheticSupplierInvoiceV1(request({
    bytes: changedBytes,
    claimedSha256: sha256HexV1(changedBytes),
    metadata: { ...request().metadata, documentId: "doc:synthetic:ap-02:second" },
  }), store), { outcome: "DENIED", reasonCodes: ["TAMPERED_CONTENT_DENIED"] });
  assert.equal(store.size, 1);
});

test("AP-02 AC04 preserves UNKNOWN as distinct from zero, null, value and absence", async () => {
  const { record } = await accepted();
  const expected = { state: "UNKNOWN", reasonCode: "NOT_EXTRACTED" };
  assert.deepEqual(record.derived, {
    grossAmountMinor: expected,
    purchaseOrderNumber: expected,
    receiptReference: expected,
  });
  assert.notEqual(record.derived.grossAmountMinor, 0);
  assert.notEqual(record.derived.grossAmountMinor, null);
  assert.equal("value" in record.derived.grossAmountMinor, false);
  assert.equal(Object.keys(record.derived).length, 3);
});

test("AP-02 AC05 reads exact originals separately and denies corrupted readback", async () => {
  const { store, record } = await accepted();
  const readback = await readSyntheticSupplierInvoiceV1(record.version.versionId, store);
  assert.equal(readback.outcome, "FOUND");
  if (readback.outcome !== "FOUND") throw new Error("expected found");
  assert.deepEqual(Buffer.from(readback.original.bytesBase64, "base64"), Buffer.from(bytes));
  assert.equal(readback.original.byteLength, 153);
  assert.equal("grossAmountMinor" in readback.original, false);
  assert.equal("bytesBase64" in readback.derived, false);
  assert.notEqual(readback.original, record.original);
  assert.equal(Object.isFrozen(readback), true);

  const corruptStore: SyntheticInvoiceIntakeStoreV1 = {
    insertIfAbsent: async () => "STORE_ERROR",
    getByVersionId: async () => ({ ...structuredClone(record), metadata: { ...record.metadata, currency: "USD" } }),
  };
  assert.deepEqual(await readSyntheticSupplierInvoiceV1(record.version.versionId, corruptStore), {
    outcome: "DENIED", reasonCodes: ["INTEGRITY_READBACK_DENIED"],
  });
});

test("AP-02 AC05 denies a valid record returned for a different requested version", async () => {
  const { record } = await accepted();
  const wrongKeyStore: SyntheticInvoiceIntakeStoreV1 = {
    insertIfAbsent: async () => "STORE_ERROR",
    getByVersionId: async () => structuredClone(record),
  };
  const wrongVersionId = `version:sha256:${"0".repeat(64)}`;
  assert.notEqual(wrongVersionId, record.version.versionId);
  assert.deepEqual(await readSyntheticSupplierInvoiceV1(wrongVersionId, wrongKeyStore), {
    outcome: "DENIED", reasonCodes: ["INTEGRITY_READBACK_DENIED"],
  });
});

test("AP-02 schema closes UNKNOWN/KNOWN unions and validates persisted record/readback", async () => {
  const schema = JSON.parse(readFileSync("schemas/contracts/incoming-invoice-intake-v1.schema.json", "utf8"));
  const validate = new Ajv2020({ allErrors: true, strict: true }).compile(schema);
  const { store, record } = await accepted();
  const readback = await readSyntheticSupplierInvoiceV1(record.version.versionId, store);
  assert.equal(validate(record), true, JSON.stringify(validate.errors));
  assert.equal(validate(readback), true, JSON.stringify(validate.errors));
  const invalid = structuredClone(record);
  (invalid.derived.grossAmountMinor as unknown as Record<string, unknown>).value = 0;
  assert.equal(validate(invalid), false);
  delete (invalid.derived as unknown as Record<string, unknown>).receiptReference;
  assert.equal(validate(invalid), false);
});

test("AP-02 focused suite is registered exactly once in canonical pretest", () => {
  const packageJson = JSON.parse(readFileSync("package.json", "utf8")) as { scripts: Record<string, string> };
  assert.equal(packageJson.scripts["incoming-invoice-intake:test"],
    "npm run build --silent && node --test dist/tests/incoming-invoice-intake.test.js");
  assert.equal(((packageJson.scripts.pretest ?? "").match(/npm run incoming-invoice-intake:test/g) ?? []).length, 1);
});
