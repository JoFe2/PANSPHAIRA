import { createHash, timingSafeEqual } from "node:crypto";
import { INCOMING_INVOICE_BLUEPRINT_V1 } from "./incoming-invoice-blueprint.js";

export const INCOMING_INVOICE_INTAKE_REQUEST_V1 = "chimpmaera.incoming-invoice/intake-request/v1" as const;
export const INCOMING_INVOICE_INTAKE_RECORD_V1 = "chimpmaera.incoming-invoice/intake-record/v1" as const;
export const INCOMING_INVOICE_READBACK_V1 = "chimpmaera.incoming-invoice/readback/v1" as const;
export const AP01_BLUEPRINT_SCHEMA_V1 = "chimpmaera.incoming-invoice/blueprint/v1" as const;

export type Sha256Hex = string;
export interface SyntheticSourceProvenanceV1 {
  readonly sourceId: "source:synthetic:ap-02:supplier-invoice-v1";
  readonly sourceKind: "LOCAL_SYNTHETIC_FIXTURE";
  readonly locator: "tests/fixtures/incoming-invoice/supplier-invoice-v1.txt";
  readonly capturedAt: "2026-09-02T00:00:00.000Z";
  readonly generator: "AP-02_FROZEN_HAND_AUTHORED_V1";
  readonly synthetic: true;
  readonly customerData: false;
  readonly externalRetrieval: false;
}
export interface SupplierInvoiceIdentityCandidateV1 { readonly supplierId: string; readonly invoiceNumber: string }
export interface SupplierInvoiceMetadataV1 {
  readonly documentId: string;
  readonly versionOrdinal: 1;
  readonly documentKind: "SUPPLIER_INVOICE";
  readonly issueDate: string;
  readonly currency: string;
}
export interface IncomingInvoiceIntakeRequestV1 {
  readonly schemaVersion: typeof INCOMING_INVOICE_INTAKE_REQUEST_V1;
  readonly blueprintSchemaVersion: typeof AP01_BLUEPRINT_SCHEMA_V1;
  readonly requestedAuthority: "LOCAL_SYNTHETIC_PROOF";
  readonly requestedEffects: readonly ["READ_SYNTHETIC", "WRITE_LOCAL_PROOF"];
  readonly fileName: "supplier-invoice-v1.txt";
  readonly mediaType: "text/plain; charset=utf-8";
  readonly bytes: Uint8Array;
  readonly claimedSha256: Sha256Hex;
  readonly provenance: SyntheticSourceProvenanceV1;
  readonly metadata: SupplierInvoiceMetadataV1;
  readonly identityCandidates: readonly SupplierInvoiceIdentityCandidateV1[];
}
export type UnknownDerivedFieldV1 = Readonly<{ state: "UNKNOWN"; reasonCode: "NOT_EXTRACTED" }>;
export type KnownDerivedFieldV1<T extends string | number> = Readonly<{
  state: "KNOWN"; value: T; evidence: Readonly<{ stage: "EXTRACTION"; extractorId: string; sourceVersionId: string }>;
}>;
export type DerivedFieldV1<T extends string | number> = UnknownDerivedFieldV1 | KnownDerivedFieldV1<T>;
export interface SupplierInvoiceDerivedFieldsV1 {
  readonly grossAmountMinor: DerivedFieldV1<number>;
  readonly purchaseOrderNumber: DerivedFieldV1<string>;
  readonly receiptReference: DerivedFieldV1<string>;
}
export interface IncomingInvoiceRecordV1 {
  readonly schemaVersion: typeof INCOMING_INVOICE_INTAKE_RECORD_V1;
  readonly document: Readonly<{ documentId: string; documentKind: "SUPPLIER_INVOICE" }>;
  readonly version: Readonly<{ versionId: string; ordinal: 1; contentSha256: Sha256Hex; byteLength: number; metadataDigest: Sha256Hex }>;
  readonly supplierInvoiceIdentity: Readonly<{ supplierId: string; invoiceNumber: string; identityDigest: Sha256Hex }>;
  readonly metadata: SupplierInvoiceMetadataV1;
  readonly original: Readonly<{ bytesBase64: string; fileName: "supplier-invoice-v1.txt"; mediaType: "text/plain; charset=utf-8"; provenance: SyntheticSourceProvenanceV1 }>;
  readonly derived: SupplierInvoiceDerivedFieldsV1;
  readonly authority: Readonly<{ mode: "LOCAL_SYNTHETIC_PROOF"; customerDataAuthorized: false; productiveBookingAuthorized: false; externalCallsAuthorized: false }>;
  readonly recordDigest: Sha256Hex;
}
export type IntakeDenialReasonV1 = "REQUEST_SHAPE_DENIED" | "VERSION_DENIED" | "AP01_AUTHORITY_DENIED" | "EFFECT_DENIED" | "UNSUPPORTED_DOCUMENT_DENIED" | "NON_SYNTHETIC_PROVENANCE_DENIED" | "TAMPERED_CONTENT_DENIED" | "AMBIGUOUS_IDENTITY_DENIED" | "INVALID_METADATA_DENIED" | "DUPLICATE_CONTENT_DENIED" | "DUPLICATE_IDENTITY_DENIED" | "STORE_DENIED";
export type IntakeResultV1 = Readonly<{ outcome: "ACCEPTED"; record: IncomingInvoiceRecordV1 }> | Readonly<{ outcome: "DENIED"; reasonCodes: readonly [IntakeDenialReasonV1] }>;
export type ReadbackResultV1 = Readonly<{ outcome: "FOUND"; schemaVersion: typeof INCOMING_INVOICE_READBACK_V1; bindings: Readonly<{ recordDigest: Sha256Hex; versionId: string; contentSha256: Sha256Hex; metadataDigest: Sha256Hex; supplierInvoiceIdentityDigest: Sha256Hex }>; original: IncomingInvoiceRecordV1["original"] & Readonly<{ byteLength: number }>; derived: SupplierInvoiceDerivedFieldsV1 }> | Readonly<{ outcome: "NOT_FOUND" }> | Readonly<{ outcome: "DENIED"; reasonCodes: readonly ["INTEGRITY_READBACK_DENIED"] }>;
export type InsertVerdictV1 = "INSERTED" | "DUPLICATE_CONTENT" | "DUPLICATE_IDENTITY" | "STORE_ERROR";
export interface SyntheticInvoiceIntakeStoreV1 {
  insertIfAbsent(record: IncomingInvoiceRecordV1): Promise<InsertVerdictV1>;
  getByVersionId(versionId: string): Promise<IncomingInvoiceRecordV1 | undefined>;
}

export function canonicalJsonV1(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalJsonV1).join(",")}]`;
  const object = value as Record<string, unknown>;
  return `{${Object.keys(object).sort().map((key) => `${JSON.stringify(key)}:${canonicalJsonV1(object[key])}`).join(",")}}`;
}
export function sha256HexV1(value: Uint8Array | string): Sha256Hex {
  return createHash("sha256").update(value).digest("hex");
}
function canonicalDigestV1(value: unknown): Sha256Hex { return sha256HexV1(canonicalJsonV1(value)); }
export function supplierInvoiceIdentityDigestV1(identity: SupplierInvoiceIdentityCandidateV1): Sha256Hex {
  return canonicalDigestV1({ schemaVersion: "chimpmaera.incoming-invoice/supplier-invoice-identity/v1", supplierId: identity.supplierId, invoiceNumber: identity.invoiceNumber });
}
function deepFreeze<T>(value: T): T {
  if (value !== null && typeof value === "object" && !Object.isFrozen(value)) {
    for (const child of Object.values(value as Record<string, unknown>)) deepFreeze(child);
    Object.freeze(value);
  }
  return value;
}
function exactObject(value: unknown, keys: readonly string[]): value is Record<string, unknown> {
  if (value === null || typeof value !== "object" || Array.isArray(value) || Object.getPrototypeOf(value) !== Object.prototype) return false;
  const actual = Object.keys(value).sort();
  const expected = [...keys].sort();
  return actual.length === expected.length && actual.every((key, index) => key === expected[index]);
}
function validateRequestShapeV1(value: unknown): value is IncomingInvoiceIntakeRequestV1 {
  const requestKeys = ["schemaVersion", "blueprintSchemaVersion", "requestedAuthority", "requestedEffects", "fileName", "mediaType", "bytes", "claimedSha256", "provenance", "metadata", "identityCandidates"];
  const provenanceKeys = ["sourceId", "sourceKind", "locator", "capturedAt", "generator", "synthetic", "customerData", "externalRetrieval"];
  const metadataKeys = ["documentId", "versionOrdinal", "documentKind", "issueDate", "currency"];
  const identityKeys = ["supplierId", "invoiceNumber"];
  if (!exactObject(value, requestKeys)) return false;
  if (typeof value.schemaVersion !== "string" || typeof value.blueprintSchemaVersion !== "string" || typeof value.requestedAuthority !== "string" || !Array.isArray(value.requestedEffects) || !value.requestedEffects.every((item) => typeof item === "string") || typeof value.fileName !== "string" || typeof value.mediaType !== "string" || !(value.bytes instanceof Uint8Array) || value.bytes.byteLength === 0 || typeof value.claimedSha256 !== "string") return false;
  if (!exactObject(value.provenance, provenanceKeys) || typeof value.provenance.sourceId !== "string" || typeof value.provenance.sourceKind !== "string" || typeof value.provenance.locator !== "string" || typeof value.provenance.capturedAt !== "string" || typeof value.provenance.generator !== "string" || typeof value.provenance.synthetic !== "boolean" || typeof value.provenance.customerData !== "boolean" || typeof value.provenance.externalRetrieval !== "boolean") return false;
  if (!exactObject(value.metadata, metadataKeys) || typeof value.metadata.documentId !== "string" || typeof value.metadata.versionOrdinal !== "number" || typeof value.metadata.documentKind !== "string" || typeof value.metadata.issueDate !== "string" || typeof value.metadata.currency !== "string") return false;
  if (!Array.isArray(value.identityCandidates) || !value.identityCandidates.every((item) => exactObject(item, identityKeys) && typeof item.supplierId === "string" && typeof item.invoiceNumber === "string")) return false;
  return true;
}
function validateAp01AuthorityV1(): boolean {
  const authority = INCOMING_INVOICE_BLUEPRINT_V1.authority;
  return INCOMING_INVOICE_BLUEPRINT_V1.schemaVersion === AP01_BLUEPRINT_SCHEMA_V1 && authority.mode === "LOCAL_SYNTHETIC_PROOF" && authority.allowedEffects.length === 2 && authority.allowedEffects[0] === "READ_SYNTHETIC" && authority.allowedEffects[1] === "WRITE_LOCAL_PROOF" && authority.customerDataAuthorized === false && authority.productiveBookingAuthorized === false && authority.externalCallsAuthorized === false;
}
function provenanceIsExactV1(value: SyntheticSourceProvenanceV1): boolean {
  return value.sourceId === "source:synthetic:ap-02:supplier-invoice-v1" && value.sourceKind === "LOCAL_SYNTHETIC_FIXTURE" && value.locator === "tests/fixtures/incoming-invoice/supplier-invoice-v1.txt" && value.capturedAt === "2026-09-02T00:00:00.000Z" && value.generator === "AP-02_FROZEN_HAND_AUTHORED_V1" && value.synthetic === true && value.customerData === false && value.externalRetrieval === false;
}
function validIdentityV1(value: SupplierInvoiceIdentityCandidateV1): boolean {
  return /^[A-Z0-9][A-Z0-9-]{2,63}$/.test(value.supplierId) && /^[A-Z0-9][A-Z0-9-]{2,63}$/.test(value.invoiceNumber);
}
function validDateV1(value: string): boolean {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (match === null) return false;
  const year = Number(match[1]); const month = Number(match[2]); const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}
function validMetadataV1(value: SupplierInvoiceMetadataV1): boolean {
  return /^doc:synthetic:ap-02:[a-z0-9-]+$/.test(value.documentId) && value.versionOrdinal === 1 && value.documentKind === "SUPPLIER_INVOICE" && validDateV1(value.issueDate) && /^[A-Z]{3}$/.test(value.currency);
}
function initialDerivedV1(): SupplierInvoiceDerivedFieldsV1 {
  return deepFreeze({ grossAmountMinor: { state: "UNKNOWN", reasonCode: "NOT_EXTRACTED" }, purchaseOrderNumber: { state: "UNKNOWN", reasonCode: "NOT_EXTRACTED" }, receiptReference: { state: "UNKNOWN", reasonCode: "NOT_EXTRACTED" } });
}
function deny(reason: IntakeDenialReasonV1): IntakeResultV1 { return deepFreeze({ outcome: "DENIED" as const, reasonCodes: [reason] as const }); }
function digestMatchesV1(claimed: string, actual: string): boolean {
  return /^[a-f0-9]{64}$/.test(claimed) && timingSafeEqual(Buffer.from(claimed, "hex"), Buffer.from(actual, "hex"));
}

export async function intakeSyntheticSupplierInvoiceV1(candidate: unknown, store: SyntheticInvoiceIntakeStoreV1): Promise<IntakeResultV1> {
  if (!validateRequestShapeV1(candidate)) return deny("REQUEST_SHAPE_DENIED");
  const request = candidate;
  if (request.schemaVersion !== INCOMING_INVOICE_INTAKE_REQUEST_V1 || request.blueprintSchemaVersion !== AP01_BLUEPRINT_SCHEMA_V1) return deny("VERSION_DENIED");
  if (request.requestedAuthority !== "LOCAL_SYNTHETIC_PROOF" || !validateAp01AuthorityV1()) return deny("AP01_AUTHORITY_DENIED");
  if (request.requestedEffects.length !== 2 || request.requestedEffects[0] !== "READ_SYNTHETIC" || request.requestedEffects[1] !== "WRITE_LOCAL_PROOF") return deny("EFFECT_DENIED");
  if (request.fileName !== "supplier-invoice-v1.txt" || request.mediaType !== "text/plain; charset=utf-8") return deny("UNSUPPORTED_DOCUMENT_DENIED");
  if (!provenanceIsExactV1(request.provenance)) return deny("NON_SYNTHETIC_PROVENANCE_DENIED");
  const ownedBytes = Uint8Array.from(request.bytes);
  const contentSha256 = sha256HexV1(ownedBytes);
  if (!digestMatchesV1(request.claimedSha256, contentSha256)) return deny("TAMPERED_CONTENT_DENIED");
  if (request.identityCandidates.length !== 1) return deny("AMBIGUOUS_IDENTITY_DENIED");
  const identityCandidate = request.identityCandidates[0]!;
  if (!validIdentityV1(identityCandidate) || !validMetadataV1(request.metadata)) return deny("INVALID_METADATA_DENIED");
  const identityDigest = supplierInvoiceIdentityDigestV1(identityCandidate);
  const metadataDigest = canonicalDigestV1(request.metadata);
  const versionId = `version:sha256:${canonicalDigestV1({ documentId: request.metadata.documentId, ordinal: request.metadata.versionOrdinal, contentSha256, metadataDigest, identityDigest })}`;
  const unsignedRecord = {
    schemaVersion: INCOMING_INVOICE_INTAKE_RECORD_V1,
    document: { documentId: request.metadata.documentId, documentKind: request.metadata.documentKind },
    version: { versionId, ordinal: request.metadata.versionOrdinal, contentSha256, byteLength: ownedBytes.byteLength, metadataDigest },
    supplierInvoiceIdentity: { ...structuredClone(identityCandidate), identityDigest },
    metadata: structuredClone(request.metadata),
    original: { bytesBase64: Buffer.from(ownedBytes).toString("base64"), fileName: request.fileName, mediaType: request.mediaType, provenance: structuredClone(request.provenance) },
    derived: initialDerivedV1(),
    authority: { mode: "LOCAL_SYNTHETIC_PROOF" as const, customerDataAuthorized: false as const, productiveBookingAuthorized: false as const, externalCallsAuthorized: false as const },
  };
  const record = deepFreeze({ ...unsignedRecord, recordDigest: canonicalDigestV1(unsignedRecord) }) as IncomingInvoiceRecordV1;
  const verdict = await store.insertIfAbsent(record);
  if (verdict === "DUPLICATE_CONTENT") return deny("DUPLICATE_CONTENT_DENIED");
  if (verdict === "DUPLICATE_IDENTITY") return deny("DUPLICATE_IDENTITY_DENIED");
  if (verdict !== "INSERTED") return deny("STORE_DENIED");
  return deepFreeze({ outcome: "ACCEPTED" as const, record });
}

export async function readSyntheticSupplierInvoiceV1(versionId: string, store: SyntheticInvoiceIntakeStoreV1): Promise<ReadbackResultV1> {
  const stored = await store.getByVersionId(versionId);
  if (stored === undefined) return deepFreeze({ outcome: "NOT_FOUND" as const });
  const decoded = Buffer.from(stored.original.bytesBase64, "base64");
  const identityDigest = supplierInvoiceIdentityDigestV1(stored.supplierInvoiceIdentity);
  const metadataDigest = canonicalDigestV1(stored.metadata);
  const expectedVersionId = `version:sha256:${canonicalDigestV1({ documentId: stored.document.documentId, ordinal: stored.version.ordinal, contentSha256: stored.version.contentSha256, metadataDigest, identityDigest })}`;
  const { recordDigest: _recordDigest, ...unsignedRecord } = stored;
  const valid = sha256HexV1(decoded) === stored.version.contentSha256 && decoded.byteLength === stored.version.byteLength && metadataDigest === stored.version.metadataDigest && identityDigest === stored.supplierInvoiceIdentity.identityDigest && expectedVersionId === stored.version.versionId && canonicalDigestV1(unsignedRecord) === stored.recordDigest;
  if (!valid) return deepFreeze({ outcome: "DENIED" as const, reasonCodes: ["INTEGRITY_READBACK_DENIED"] as const });
  return deepFreeze({ outcome: "FOUND" as const, schemaVersion: INCOMING_INVOICE_READBACK_V1, bindings: { recordDigest: stored.recordDigest, versionId: stored.version.versionId, contentSha256: stored.version.contentSha256, metadataDigest: stored.version.metadataDigest, supplierInvoiceIdentityDigest: stored.supplierInvoiceIdentity.identityDigest }, original: { ...structuredClone(stored.original), byteLength: stored.version.byteLength }, derived: structuredClone(stored.derived) });
}

export class InMemorySyntheticInvoiceIntakeStoreV1 implements SyntheticInvoiceIntakeStoreV1 {
  private readonly byVersion = new Map<string, IncomingInvoiceRecordV1>();
  private readonly byContent = new Map<Sha256Hex, string>();
  private readonly byIdentity = new Map<Sha256Hex, string>();
  async insertIfAbsent(record: IncomingInvoiceRecordV1): Promise<InsertVerdictV1> {
    if (this.byContent.has(record.version.contentSha256)) return "DUPLICATE_CONTENT";
    if (this.byIdentity.has(record.supplierInvoiceIdentity.identityDigest)) return "DUPLICATE_IDENTITY";
    this.byVersion.set(record.version.versionId, structuredClone(record));
    this.byContent.set(record.version.contentSha256, record.version.versionId);
    this.byIdentity.set(record.supplierInvoiceIdentity.identityDigest, record.version.versionId);
    return "INSERTED";
  }
  async getByVersionId(versionId: string): Promise<IncomingInvoiceRecordV1 | undefined> {
    const found = this.byVersion.get(versionId);
    return found === undefined ? undefined : structuredClone(found);
  }
  get size(): number { return this.byVersion.size; }
}
