import { createHash } from "node:crypto";
import { canonicalJson } from "./canonical-json.js";

export const ERP_READ_CONNECTOR_SCHEMA_V1 = "chimpmaera.connector/erp-read/v1" as const;
export const ERP_READ_SOURCE_SCHEMA_V1 = "chimpmaera.connector/erp-supported-export/v1" as const;
export const ERP_READ_SCOPE_V1 = "erp.synthetic.bi.read" as const;

export type ErpEntityV1 = "customers" | "orders" | "invoices";
export type ErpReadDenialCodeV1 =
  | "CONNECTOR_DISABLED" | "CREDENTIAL_MISSING" | "OPERATION_DENIED" | "MUTATION_DENIED"
  | "DATABASE_ACCESS_DENIED" | "TENANT_MISMATCH" | "SCOPE_DENIED" | "FIELD_DENIED"
  | "REQUEST_MALFORMED" | "SOURCE_MALFORMED" | "SOURCE_STALE" | "SOURCE_PARTIAL"
  | "CURSOR_REPLAYED" | "CURSOR_STALE";

export interface ErpCustomerV1 { readonly customerId: string; readonly customerStatus: "ACTIVE" | "ON_HOLD"; }
export interface ErpOrderV1 { readonly orderId: string; readonly customerId: string; readonly orderStatus: "OPEN" | "FULFILLED" | "CANCELLED"; readonly orderDate: string; readonly totalMinor: number; readonly currency: "EUR"; }
export interface ErpInvoiceV1 { readonly invoiceId: string; readonly orderId: string; readonly customerId: string; readonly invoiceStatus: "OPEN" | "PAID" | "VOID"; readonly issueDate: string; readonly dueDate: string; readonly totalMinor: number; readonly currency: "EUR"; }
export type ErpRecordV1 = ErpCustomerV1 | ErpOrderV1 | ErpInvoiceV1;
export interface ErpSourceRecordV1 { readonly recordMetadata: { readonly sourceRecordId: string; readonly sourceUpdatedAt: string; readonly lineageSequence: number; }; readonly facts: ErpRecordV1; }

export interface ErpReadConnectorContractV1 {
  readonly schemaVersion: typeof ERP_READ_CONNECTOR_SCHEMA_V1; readonly contractVersion: "1.0.0"; readonly connectorId: "connector:synthetic-erp-bi-v1";
  readonly defaultEnabled: false; readonly adapter: "SUPPORTED_EXPORT_API_SHAPED"; readonly evidenceClass: "LOCAL_SYNTHETIC"; readonly tenantId: "tenant:synthetic-zoo";
  readonly identity: { readonly principalId: "principal:bi-m1-reader"; readonly scopes: readonly [typeof ERP_READ_SCOPE_V1]; readonly credentialSource: "EXPLICIT_REFERENCE_ONLY"; };
  readonly operations: readonly ["LIST_CUSTOMERS", "LIST_ORDERS", "LIST_INVOICES", "READ_SOURCE_FACTS"];
  readonly fields: { readonly customers: readonly ["customerId", "customerStatus"]; readonly orders: readonly ["orderId", "customerId", "orderStatus", "orderDate", "totalMinor", "currency"]; readonly invoices: readonly ["invoiceId", "orderId", "customerId", "invoiceStatus", "issueDate", "dueDate", "totalMinor", "currency"]; };
  readonly policy: { readonly maxPageSize: 2; readonly maxAgeSeconds: 3600; readonly writesAllowed: false; readonly approvalsAllowed: false; readonly adminAllowed: false; readonly broadDatabaseAccessAllowed: false; readonly unknownFieldsAllowed: false; };
  readonly contractDigest: string;
}
export interface ErpSupportedExportV1 { readonly schemaVersion: typeof ERP_READ_SOURCE_SCHEMA_V1; readonly exportId: string; readonly tenantId: string; readonly generatedAt: string; readonly expiresAt: string; readonly lineage: { readonly sourceSystem: "SYNTHETIC_ERP"; readonly sourceDatasetId: string; readonly extractionMode: "SUPPORTED_EXPORT"; readonly sourceDigest: string; }; readonly batches: readonly { readonly batchId: string; readonly entity: ErpEntityV1; readonly sequence: number; readonly complete: boolean; readonly records: readonly ErpSourceRecordV1[]; }[]; }
export interface ErpReadRequestV1 { readonly operation: "LIST_CUSTOMERS" | "LIST_ORDERS" | "LIST_INVOICES" | "READ_SOURCE_FACTS"; readonly entity?: ErpEntityV1; readonly tenantId: string; readonly principalId: string; readonly scopes: readonly string[]; readonly credentialPresent: boolean; readonly fields: readonly string[]; readonly pageSize: number; readonly cursor?: string; }
export type ErpReadResultV1 = { readonly outcome: "DENIED"; readonly code: ErpReadDenialCodeV1 } | { readonly outcome: "READ"; readonly entity: ErpEntityV1; readonly records: readonly ErpRecordV1[]; readonly metadata: { readonly tenantId: string; readonly trust: "LOCAL_SYNTHETIC"; readonly principalId: string; readonly scope: typeof ERP_READ_SCOPE_V1; readonly exportId: string; readonly generatedAt: string; readonly expiresAt: string; readonly sourceDatasetId: string; readonly sourceDigest: string; readonly batchIds: readonly string[]; readonly recordMetadata: readonly ErpSourceRecordV1["recordMetadata"][]; readonly recordCount: number; readonly pageSize: number; readonly nextCursor: string | null; }; readonly readbackDigest: string; };
export type ErpOrderSourceReadDenialCodeV1 = ErpReadDenialCodeV1 | "SOURCE_LABEL_DENIED" | "SOURCE_BYTES_MALFORMED";
export type ErpOrderReadResultV1 =
  | { readonly outcome: "DENIED"; readonly code: ErpOrderSourceReadDenialCodeV1 }
  | { readonly outcome: "READ"; readonly entity: "orders"; readonly records: readonly ErpOrderV1[]; readonly metadata: {
    readonly tenantId: string; readonly trust: "LOCAL_SYNTHETIC"; readonly principalId: string; readonly scope: typeof ERP_READ_SCOPE_V1;
    readonly exportId: string; readonly generatedAt: string; readonly expiresAt: string; readonly sourceDatasetId: string; readonly sourceDigest: string;
    readonly sourceBytesSha256: string; readonly batchIds: readonly string[]; readonly recordMetadata: readonly ErpSourceRecordV1["recordMetadata"][];
    readonly recordCount: number; readonly pageSize: number; readonly nextCursor: null;
  }; readonly readbackDigest: string; };

const CONTRACT_CONTENT = { schemaVersion: ERP_READ_CONNECTOR_SCHEMA_V1, contractVersion: "1.0.0", connectorId: "connector:synthetic-erp-bi-v1", defaultEnabled: false, adapter: "SUPPORTED_EXPORT_API_SHAPED", evidenceClass: "LOCAL_SYNTHETIC", tenantId: "tenant:synthetic-zoo", identity: { principalId: "principal:bi-m1-reader", scopes: [ERP_READ_SCOPE_V1], credentialSource: "EXPLICIT_REFERENCE_ONLY" }, operations: ["LIST_CUSTOMERS", "LIST_ORDERS", "LIST_INVOICES", "READ_SOURCE_FACTS"], fields: { customers: ["customerId", "customerStatus"], orders: ["orderId", "customerId", "orderStatus", "orderDate", "totalMinor", "currency"], invoices: ["invoiceId", "orderId", "customerId", "invoiceStatus", "issueDate", "dueDate", "totalMinor", "currency"] }, policy: { maxPageSize: 2, maxAgeSeconds: 3600, writesAllowed: false, approvalsAllowed: false, adminAllowed: false, broadDatabaseAccessAllowed: false, unknownFieldsAllowed: false } } as const;
const sha = (value: unknown) => createHash("sha256").update(canonicalJson(value)).digest("hex");
const exact = (a: unknown, b: unknown) => canonicalJson(a) === canonicalJson(b);
const object = (v: unknown): v is Record<string, unknown> => v !== null && typeof v === "object" && !Array.isArray(v) && Object.getPrototypeOf(v) === Object.prototype;
const keys = (v: unknown, expected: readonly string[]): v is Record<string, unknown> => object(v) && exact(Object.keys(v).sort(), [...expected].sort());
const id = (v: unknown) => typeof v === "string" && /^[a-z][a-z0-9-]{1,31}:[a-z0-9][a-z0-9._-]{2,95}$/.test(v);
const digest = (v: unknown) => typeof v === "string" && /^[a-f0-9]{64}$/.test(v);
const timestamp = (v: unknown) => typeof v === "string" && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/.test(v) && !Number.isNaN(Date.parse(v));
const date = (v: unknown) => typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(`${v}T00:00:00Z`));

export function erpReadConnectorContractDigestV1(value: Omit<ErpReadConnectorContractV1, "contractDigest"> | ErpReadConnectorContractV1): string { return sha(Object.fromEntries(Object.entries(value).filter(([key]) => key !== "contractDigest"))); }
export function verifyErpReadConnectorContractV1(value: unknown): value is ErpReadConnectorContractV1 { return keys(value, [...Object.keys(CONTRACT_CONTENT), "contractDigest"]) && digest(value.contractDigest) && exact(Object.fromEntries(Object.entries(value).filter(([key]) => key !== "contractDigest")), CONTRACT_CONTENT) && value.contractDigest === sha(CONTRACT_CONTENT); }
function validFacts(entity: ErpEntityV1, value: unknown): value is ErpRecordV1 {
  if (entity === "customers") return keys(value, CONTRACT_CONTENT.fields.customers) && id(value.customerId) && ["ACTIVE", "ON_HOLD"].includes(String(value.customerStatus));
  if (entity === "orders") return keys(value, CONTRACT_CONTENT.fields.orders) && id(value.orderId) && id(value.customerId) && ["OPEN", "FULFILLED", "CANCELLED"].includes(String(value.orderStatus)) && date(value.orderDate) && Number.isSafeInteger(value.totalMinor) && (value.totalMinor as number) >= 0 && value.currency === "EUR";
  return keys(value, CONTRACT_CONTENT.fields.invoices) && id(value.invoiceId) && id(value.orderId) && id(value.customerId) && ["OPEN", "PAID", "VOID"].includes(String(value.invoiceStatus)) && date(value.issueDate) && date(value.dueDate) && Date.parse(`${value.dueDate as string}T00:00:00Z`) >= Date.parse(`${value.issueDate as string}T00:00:00Z`) && Number.isSafeInteger(value.totalMinor) && (value.totalMinor as number) >= 0 && value.currency === "EUR";
}
function validateSource(value: unknown): ErpReadDenialCodeV1 | null {
  if (!keys(value, ["schemaVersion", "exportId", "tenantId", "generatedAt", "expiresAt", "lineage", "batches"]) || value.schemaVersion !== ERP_READ_SOURCE_SCHEMA_V1 || !id(value.exportId) || !id(value.tenantId) || !timestamp(value.generatedAt) || !timestamp(value.expiresAt) || Date.parse(value.expiresAt as string) <= Date.parse(value.generatedAt as string) || !keys(value.lineage, ["sourceSystem", "sourceDatasetId", "extractionMode", "sourceDigest"]) || value.lineage.sourceSystem !== "SYNTHETIC_ERP" || !id(value.lineage.sourceDatasetId) || value.lineage.extractionMode !== "SUPPORTED_EXPORT" || !digest(value.lineage.sourceDigest) || !Array.isArray(value.batches)) return "SOURCE_MALFORMED";
  const batchIds = new Set<string>(); const recordIds = new Set<string>(); let previousBatch = 0;
  for (const batch of value.batches) {
    if (!keys(batch, ["batchId", "entity", "sequence", "complete", "records"]) || !id(batch.batchId) || !["customers", "orders", "invoices"].includes(String(batch.entity)) || !Number.isInteger(batch.sequence) || (batch.sequence as number) <= previousBatch || batchIds.has(batch.batchId as string) || typeof batch.complete !== "boolean" || !Array.isArray(batch.records)) return "SOURCE_MALFORMED";
    previousBatch = batch.sequence as number; batchIds.add(batch.batchId as string); if (!batch.complete) return "SOURCE_PARTIAL"; let previousRecord = 0;
    for (const entry of batch.records) {
      if (!keys(entry, ["recordMetadata", "facts"]) || !keys(entry.recordMetadata, ["sourceRecordId", "sourceUpdatedAt", "lineageSequence"]) || !id(entry.recordMetadata.sourceRecordId) || recordIds.has(entry.recordMetadata.sourceRecordId as string) || !timestamp(entry.recordMetadata.sourceUpdatedAt) || !Number.isInteger(entry.recordMetadata.lineageSequence) || (entry.recordMetadata.lineageSequence as number) <= previousRecord || !validFacts(batch.entity as ErpEntityV1, entry.facts)) return "SOURCE_MALFORMED";
      previousRecord = entry.recordMetadata.lineageSequence as number; recordIds.add(entry.recordMetadata.sourceRecordId as string);
    }
  }
  const content = Object.fromEntries(Object.entries(value).filter(([key]) => key !== "lineage")); const lineage = Object.fromEntries(Object.entries(value.lineage).filter(([key]) => key !== "sourceDigest"));
  return value.lineage.sourceDigest === sha({ ...content, lineage }) ? null : "SOURCE_MALFORMED";
}
export function createErpReadAdapterV1({ contract, source, enabled, now }: { contract: unknown; source: unknown; enabled: boolean; now: string }) {
  const consumed = new Set<string>();
  return (request: unknown): ErpReadResultV1 => {
    if (!enabled) return { outcome: "DENIED", code: "CONNECTOR_DISABLED" };
    if (!verifyErpReadConnectorContractV1(contract) || !timestamp(now) || !object(request)) return { outcome: "DENIED", code: "REQUEST_MALFORMED" };
    const allowedKeys = ["operation", "entity", "tenantId", "principalId", "scopes", "credentialPresent", "fields", "pageSize", "cursor"];
    if (Object.keys(request).some((key) => !allowedKeys.includes(key))) return { outcome: "DENIED", code: /sql|database|table|query/i.test(Object.keys(request).join(" ")) ? "DATABASE_ACCESS_DENIED" : "MUTATION_DENIED" };
    if (!request.credentialPresent) return { outcome: "DENIED", code: "CREDENTIAL_MISSING" };
    if (![...contract.operations].includes(request.operation as never)) { const op = String(request.operation); return { outcome: "DENIED", code: /DATABASE|SQL|QUERY_TABLE|DUMP|EXPORT_ALL/i.test(op) ? "DATABASE_ACCESS_DENIED" : /CREATE|POST|APPROVE|WRITE|UPDATE|DELETE|ADMIN|MUTAT/i.test(op) ? "MUTATION_DENIED" : "OPERATION_DENIED" }; }
    if (request.tenantId !== contract.tenantId) return { outcome: "DENIED", code: "TENANT_MISMATCH" };
    if (request.principalId !== contract.identity.principalId || !exact(request.scopes, contract.identity.scopes)) return { outcome: "DENIED", code: "SCOPE_DENIED" };
    const entity = request.operation === "LIST_CUSTOMERS" ? "customers" : request.operation === "LIST_ORDERS" ? "orders" : request.operation === "LIST_INVOICES" ? "invoices" : request.entity;
    if (!["customers", "orders", "invoices"].includes(String(entity))) return { outcome: "DENIED", code: "REQUEST_MALFORMED" };
    const typedEntity = entity as ErpEntityV1; if (!Array.isArray(request.fields) || !exact(request.fields, contract.fields[typedEntity])) return { outcome: "DENIED", code: "FIELD_DENIED" };
    if (!Number.isInteger(request.pageSize) || (request.pageSize as number) < 1 || (request.pageSize as number) > contract.policy.maxPageSize) return { outcome: "DENIED", code: "REQUEST_MALFORMED" };
    const sourceError = validateSource(source); if (sourceError) return { outcome: "DENIED", code: sourceError }; const typedSource = source as ErpSupportedExportV1;
    if (typedSource.tenantId !== contract.tenantId) return { outcome: "DENIED", code: "TENANT_MISMATCH" };
    if (Date.parse(now) > Date.parse(typedSource.expiresAt) || Date.parse(now) - Date.parse(typedSource.generatedAt) > contract.policy.maxAgeSeconds * 1000) return { outcome: "DENIED", code: "SOURCE_STALE" };
    let offset = 0; if (request.cursor !== undefined) { if (typeof request.cursor !== "string") return { outcome: "DENIED", code: "REQUEST_MALFORMED" }; if (consumed.has(request.cursor)) return { outcome: "DENIED", code: "CURSOR_REPLAYED" }; const match = /^erp1:([a-f0-9]{16}):(customers|orders|invoices):(\d+)$/.exec(request.cursor); if (!match || match[1] !== typedSource.lineage.sourceDigest.slice(0, 16) || match[2] !== typedEntity) return { outcome: "DENIED", code: "CURSOR_STALE" }; offset = Number(match[3]); consumed.add(request.cursor); }
    const batches = typedSource.batches.filter((batch) => batch.entity === typedEntity); const all = batches.flatMap((batch) => batch.records); const page = all.slice(offset, offset + (request.pageSize as number)); const next = offset + page.length; const nextCursor = next < all.length ? `erp1:${typedSource.lineage.sourceDigest.slice(0, 16)}:${typedEntity}:${next}` : null;
    const records = page.map((entry) => entry.facts); const metadata = { tenantId: typedSource.tenantId, trust: "LOCAL_SYNTHETIC" as const, principalId: contract.identity.principalId, scope: ERP_READ_SCOPE_V1, exportId: typedSource.exportId, generatedAt: typedSource.generatedAt, expiresAt: typedSource.expiresAt, sourceDatasetId: typedSource.lineage.sourceDatasetId, sourceDigest: typedSource.lineage.sourceDigest, batchIds: batches.map((batch) => batch.batchId), recordMetadata: page.map((entry) => entry.recordMetadata), recordCount: page.length, pageSize: request.pageSize as number, nextCursor };
    return { outcome: "READ", entity: typedEntity, records: structuredClone(records), metadata: structuredClone(metadata), readbackDigest: sha({ entity: typedEntity, records, metadata }) };
  };
}


const ERP_ORDER_SOURCE_LABEL_V1 = "LOCAL_SYNTHETIC_ERP_ORDER_SOURCE_V1" as const;
const bytesSha256 = (bytes: Uint8Array): string => createHash("sha256").update(bytes).digest("hex");

function decodeJsonBytesV1(value: string | Uint8Array): { readonly bytes: Uint8Array; readonly json: unknown } | null {
  try {
    const bytes = typeof value === "string" ? new TextEncoder().encode(value) : new Uint8Array(value);
    const text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
    return { bytes, json: JSON.parse(text) as unknown };
  } catch {
    return null;
  }
}

/**
 * Narrow PAN437 consumer entry point. It runs the existing ERP read adapter
 * against labelled source bytes, including source-digest, tenant, freshness
 * and pagination checks. It never derives delivery facts from an order result.
 */
export function readErpOrdersFromLabelledSourceBytesV1({
  contract,
  sourceBytes,
  sourceLabel,
  enabled,
  now,
}: {
  readonly contract: unknown;
  readonly sourceBytes: string | Uint8Array;
  readonly sourceLabel: string;
  readonly enabled: boolean;
  readonly now: string;
}): ErpOrderReadResultV1 {
  if (sourceLabel !== ERP_ORDER_SOURCE_LABEL_V1) return { outcome: "DENIED", code: "SOURCE_LABEL_DENIED" };
  const decoded = decodeJsonBytesV1(sourceBytes);
  if (decoded === null) return { outcome: "DENIED", code: "SOURCE_BYTES_MALFORMED" };
  const read = createErpReadAdapterV1({ contract, source: decoded.json, enabled, now });
  const firstRequest: ErpReadRequestV1 = {
    operation: "LIST_ORDERS", entity: "orders", tenantId: "tenant:synthetic-zoo",
    principalId: "principal:bi-m1-reader", scopes: [ERP_READ_SCOPE_V1], credentialPresent: true,
    fields: ["orderId", "customerId", "orderStatus", "orderDate", "totalMinor", "currency"], pageSize: 2,
  };
  const pages: Extract<ErpReadResultV1, { readonly outcome: "READ" }>[] = [];
  let request = firstRequest;
  for (let pageNumber = 0; pageNumber < 100; pageNumber += 1) {
    const result = read(request);
    if (result.outcome === "DENIED") return result;
    if (result.entity !== "orders") return { outcome: "DENIED", code: "SOURCE_MALFORMED" };
    pages.push(result);
    if (result.metadata.nextCursor === null) break;
    request = { ...firstRequest, cursor: result.metadata.nextCursor };
    if (pageNumber === 99) return { outcome: "DENIED", code: "SOURCE_MALFORMED" };
  }
  const first = pages[0];
  if (first === undefined || pages.some((page) => page.metadata.sourceDigest !== first.metadata.sourceDigest
    || page.metadata.tenantId !== first.metadata.tenantId || page.metadata.exportId !== first.metadata.exportId)) {
    return { outcome: "DENIED", code: "SOURCE_MALFORMED" };
  }
  const records = pages.flatMap((page) => page.records) as readonly ErpOrderV1[];
  const metadata = {
    ...first.metadata,
    sourceBytesSha256: bytesSha256(decoded.bytes),
    batchIds: [...new Set(pages.flatMap((page) => page.metadata.batchIds))],
    recordMetadata: pages.flatMap((page) => page.metadata.recordMetadata),
    recordCount: records.length,
    pageSize: first.metadata.pageSize,
    nextCursor: null,
  } as const;
  return { outcome: "READ", entity: "orders", records: structuredClone(records), metadata, readbackDigest: sha({ entity: "orders", records, metadata }) };
}
