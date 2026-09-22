import { createHash } from "node:crypto";
import { canonicalJson } from "./canonical-json.js";
import {
  applyFachprofilToErpReadInvoiceV1,
  ERP_READ_INVOICE_TO_ERV_INVOICE_V1,
  type FachprofilApplyResultV1,
} from "./fachprofil-mapping-v1.js";
import { rechnungsabgleichMatchZusammensetzenV1, type ReconciliationMatchOutcomeV1 } from "./rechnungsabgleich-match-v1.js";
import type { ErvCasePackV1 } from "./incoming-invoice-erv.js";

/**
 * PAN433 is a bounded storage-to-domain handoff, not another business core.
 * The two profiles below terminate in the released M0 invoice fact shape and
 * then call the released M0 consumer. They do not alter the M0 profile.
 */
export const PAN433_MAPPING_SCHEMA_V1 = "pan433.domain-mapping/v1" as const;
export const PAN433_DEFAULT_SOURCE_SCHEMA_V1 = "pan433.storage/invoice-row/v1" as const;
export const PAN433_ALTERNATE_SOURCE_SCHEMA_V1 = "pan433.storage/invoice-document/v2" as const;
export const PAN433_TARGET_SCHEMA_V1 = "chimpmaera.connector/erp-read/v1" as const;

export type Pan433MappingIdV1 =
  | "pan433:default-invoice-row-to-erp-invoice/v1"
  | "pan433:alternate-invoice-document-to-erp-invoice/v1";
export type Pan433MappingLayoutV1 = "DEFAULT_INVOICE_ROW" | "ALTERNATE_INVOICE_DOCUMENT";
export type Pan433TransformV1 = "IDENTITY" | "EUR_MINOR_IDENTITY";

export interface Pan433FieldMapV1 {
  readonly sourcePath: string;
  readonly targetField: string;
  readonly identity: string;
  readonly transform: Pan433TransformV1;
}

export interface Pan433MappingProfileV1 {
  readonly schemaVersion: typeof PAN433_MAPPING_SCHEMA_V1;
  readonly profileId: Pan433MappingIdV1;
  readonly profileVersion: "1.0.0";
  readonly purpose: string;
  readonly source: { readonly schema: string; readonly version: string; readonly layout: Pan433MappingLayoutV1; readonly sourceSystem: string };
  readonly target: { readonly schema: typeof PAN433_TARGET_SCHEMA_V1; readonly version: "1.0.0"; readonly entity: "invoices" };
  readonly fieldMaps: readonly Pan433FieldMapV1[];
  readonly declaredLosses: readonly [];
  readonly compatibility: "DIRECT";
  readonly effects: { readonly reads: true; readonly writes: false; readonly authority: "NONE" };
  readonly profileDigest: string;
}

const sha = (value: unknown): string => createHash("sha256").update(canonicalJson(value), "utf8").digest("hex");
const digest = (value: unknown): value is string => typeof value === "string" && /^[a-f0-9]{64}$/.test(value);
const object = (value: unknown): value is Record<string, unknown> => value !== null && typeof value === "object" && !Array.isArray(value) && Object.getPrototypeOf(value) === Object.prototype;
const exactKeys = (value: unknown, keys: readonly string[]): value is Record<string, unknown> => object(value) && canonicalJson(Object.keys(value).sort()) === canonicalJson([...keys].sort());
const nonEmpty = (value: unknown): value is string => typeof value === "string" && value.length > 0;
function isDate(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const year = Number(value.slice(0, 4));
  const month = Number(value.slice(5, 7));
  const day = Number(value.slice(8, 10));
  const roundTrip = new Date(Date.UTC(year, month - 1, day));
  return roundTrip.getUTCFullYear() === year && roundTrip.getUTCMonth() === month - 1 && roundTrip.getUTCDate() === day;
}
function isTimestamp(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/.test(value)) return false;
  const year = Number(value.slice(0, 4));
  const month = Number(value.slice(5, 7));
  const day = Number(value.slice(8, 10));
  const hour = Number(value.slice(11, 13));
  const minute = Number(value.slice(14, 16));
  const second = Number(value.slice(17, 19));
  const roundTrip = new Date(Date.UTC(year, month - 1, day, hour, minute, second));
  return roundTrip.getUTCFullYear() === year && roundTrip.getUTCMonth() === month - 1 && roundTrip.getUTCDate() === day
    && roundTrip.getUTCHours() === hour && roundTrip.getUTCMinutes() === minute && roundTrip.getUTCSeconds() === second;
}

function profileDigest(value: Omit<Pan433MappingProfileV1, "profileDigest"> | Pan433MappingProfileV1): string {
  return sha(Object.fromEntries(Object.entries(value as object).filter(([key]) => key !== "profileDigest")));
}

const DEFAULT_PROFILE_CONTENT = {
  schemaVersion: PAN433_MAPPING_SCHEMA_V1,
  profileId: "pan433:default-invoice-row-to-erp-invoice/v1",
  profileVersion: "1.0.0",
  purpose: "Map the released default invoice-row storage layout to the released ERP invoice fact shape without semantic inference.",
  source: { schema: PAN433_DEFAULT_SOURCE_SCHEMA_V1, version: "1.0.0", layout: "DEFAULT_INVOICE_ROW", sourceSystem: "PAN433_DEFAULT_SYNTHETIC" },
  target: { schema: PAN433_TARGET_SCHEMA_V1, version: "1.0.0", entity: "invoices" },
  fieldMaps: [
    { sourcePath: "batches[0].records[0].invoice.invoiceId", targetField: "invoiceId", identity: "INVOICE_IDENTITY", transform: "IDENTITY" },
    { sourcePath: "batches[0].records[0].invoice.orderId", targetField: "orderId", identity: "ORDER_IDENTITY", transform: "IDENTITY" },
    { sourcePath: "batches[0].records[0].invoice.customerId", targetField: "customerId", identity: "CUSTOMER_IDENTITY", transform: "IDENTITY" },
    { sourcePath: "batches[0].records[0].invoice.invoiceStatus", targetField: "invoiceStatus", identity: "INVOICE_STATUS", transform: "IDENTITY" },
    { sourcePath: "batches[0].records[0].invoice.issueDate", targetField: "issueDate", identity: "ISSUE_DATE", transform: "IDENTITY" },
    { sourcePath: "batches[0].records[0].invoice.dueDate", targetField: "dueDate", identity: "DUE_DATE", transform: "IDENTITY" },
    { sourcePath: "batches[0].records[0].invoice.totalMinor", targetField: "totalMinor", identity: "INVOICE_AMOUNT_GROSS_EUR_MINOR", transform: "EUR_MINOR_IDENTITY" },
    { sourcePath: "batches[0].records[0].invoice.currency", targetField: "currency", identity: "INVOICE_CURRENCY", transform: "IDENTITY" },
  ],
  declaredLosses: [], compatibility: "DIRECT", effects: { reads: true, writes: false, authority: "NONE" },
} as const;

const ALTERNATE_PROFILE_CONTENT = {
  schemaVersion: PAN433_MAPPING_SCHEMA_V1,
  profileId: "pan433:alternate-invoice-document-to-erp-invoice/v1",
  profileVersion: "1.0.0",
  purpose: "Map the released alternate invoice-document storage layout to the same released ERP invoice fact shape with explicit field semantics.",
  source: { schema: PAN433_ALTERNATE_SOURCE_SCHEMA_V1, version: "2.0.0", layout: "ALTERNATE_INVOICE_DOCUMENT", sourceSystem: "PAN433_ALTERNATE_SYNTHETIC" },
  target: { schema: PAN433_TARGET_SCHEMA_V1, version: "1.0.0", entity: "invoices" },
  fieldMaps: [
    { sourcePath: "documents[0].commercial.number", targetField: "invoiceId", identity: "INVOICE_IDENTITY", transform: "IDENTITY" },
    { sourcePath: "documents[0].commercial.orderRef", targetField: "orderId", identity: "ORDER_IDENTITY", transform: "IDENTITY" },
    { sourcePath: "documents[0].commercial.customerRef", targetField: "customerId", identity: "CUSTOMER_IDENTITY", transform: "IDENTITY" },
    { sourcePath: "documents[0].lifecycle.state", targetField: "invoiceStatus", identity: "INVOICE_STATUS", transform: "IDENTITY" },
    { sourcePath: "documents[0].lifecycle.issuedOn", targetField: "issueDate", identity: "ISSUE_DATE", transform: "IDENTITY" },
    { sourcePath: "documents[0].lifecycle.payBy", targetField: "dueDate", identity: "DUE_DATE", transform: "IDENTITY" },
    { sourcePath: "documents[0].money.grossMinor", targetField: "totalMinor", identity: "INVOICE_AMOUNT_GROSS_EUR_MINOR", transform: "EUR_MINOR_IDENTITY" },
    { sourcePath: "documents[0].money.currencyCode", targetField: "currency", identity: "INVOICE_CURRENCY", transform: "IDENTITY" },
  ],
  declaredLosses: [], compatibility: "DIRECT", effects: { reads: true, writes: false, authority: "NONE" },
} as const;

function deepFreeze<T>(value: T): T {
  if (value !== null && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const child of Object.values(value as Record<string, unknown>)) deepFreeze(child);
  }
  return value;
}

export const PAN433_DEFAULT_MAPPING_V1: Pan433MappingProfileV1 = deepFreeze({ ...DEFAULT_PROFILE_CONTENT, profileDigest: profileDigest(DEFAULT_PROFILE_CONTENT) });
export const PAN433_ALTERNATE_MAPPING_V1: Pan433MappingProfileV1 = deepFreeze({ ...ALTERNATE_PROFILE_CONTENT, profileDigest: profileDigest(ALTERNATE_PROFILE_CONTENT) });
export const PAN433_APPROVED_MAPPINGS_V1 = deepFreeze([PAN433_DEFAULT_MAPPING_V1, PAN433_ALTERNATE_MAPPING_V1] as const);

export function verifyPan433MappingProfileV1(value: unknown): value is Pan433MappingProfileV1 {
  if (!object(value) || !exactKeys(value, ["compatibility", "declaredLosses", "effects", "fieldMaps", "profileDigest", "profileId", "profileVersion", "purpose", "schemaVersion", "source", "target"])) return false;
  const v = value as Record<string, unknown>;
  if (v.schemaVersion !== PAN433_MAPPING_SCHEMA_V1 || !nonEmpty(v.profileId) || !nonEmpty(v.profileVersion) || !nonEmpty(v.purpose) || !digest(v.profileDigest)) return false;
  if (!object(v.source) || !exactKeys(v.source, ["layout", "schema", "sourceSystem", "version"]) || !nonEmpty(v.source.schema) || !nonEmpty(v.source.version) || !nonEmpty(v.source.sourceSystem) || !["DEFAULT_INVOICE_ROW", "ALTERNATE_INVOICE_DOCUMENT"].includes(String(v.source.layout))) return false;
  if (!object(v.target) || !exactKeys(v.target, ["entity", "schema", "version"]) || v.target.schema !== PAN433_TARGET_SCHEMA_V1 || v.target.version !== "1.0.0" || v.target.entity !== "invoices") return false;
  if (!Array.isArray(v.fieldMaps) || v.fieldMaps.length !== 8 || v.fieldMaps.some((item) => !object(item) || !exactKeys(item, ["identity", "sourcePath", "targetField", "transform"]) || !nonEmpty(item.sourcePath) || !nonEmpty(item.targetField) || !nonEmpty(item.identity) || !["IDENTITY", "EUR_MINOR_IDENTITY"].includes(String(item.transform)))) return false;
  if (!Array.isArray(v.declaredLosses) || v.declaredLosses.length !== 0 || !object(v.effects) || !exactKeys(v.effects, ["authority", "reads", "writes"]) || v.effects.reads !== true || v.effects.writes !== false || v.effects.authority !== "NONE" || v.compatibility !== "DIRECT") return false;
  return v.profileDigest === profileDigest(value as unknown as Pan433MappingProfileV1);
}

export function isApprovedPan433MappingProfileV1(value: unknown): value is Pan433MappingProfileV1 {
  if (!verifyPan433MappingProfileV1(value)) return false;
  return PAN433_APPROVED_MAPPINGS_V1.some((approved) => canonicalJson(approved) === canonicalJson(value));
}

type Pan433Source = Record<string, unknown>;
export type Pan433MappingDenialCodeV1 =
  | "MAPPING_PROFILE_DIGEST_MISMATCH" | "MAPPING_PROFILE_NOT_APPROVED" | "SOURCE_NOT_OBJECT"
  | "SOURCE_SCHEMA_UNSUPPORTED" | "SOURCE_SHAPE_INVALID" | "SOURCE_DIGEST_INVALID"
  | "SOURCE_SYSTEM_MISMATCH" | "AMBIGUOUS_RECORD" | "FIELD_SEMANTICS_INVALID"
  | "MAPPING_CORE_DENIED";

export type Pan433MappedResultV1 =
  | Readonly<{ outcome: "MAPPED"; layout: Pan433MappingLayoutV1; profileId: Pan433MappingIdV1; sourceDatasetId: string; sourceDigest: string; invoice: { readonly invoiceId: string; readonly orderId: string; readonly customerId: string; readonly invoiceStatus: "OPEN" | "PAID" | "VOID"; readonly issueDate: string; readonly dueDate: string; readonly totalMinor: number; readonly currency: "EUR" } }>
  | Readonly<{ outcome: "DENIED"; code: Pan433MappingDenialCodeV1; detail: string }>;

type Pan433Invoice = { readonly invoiceId: string; readonly orderId: string; readonly customerId: string; readonly invoiceStatus: "OPEN" | "PAID" | "VOID"; readonly issueDate: string; readonly dueDate: string; readonly totalMinor: number; readonly currency: "EUR" };
function validInvoice(value: unknown): value is Pan433Invoice {
  if (!object(value) || !exactKeys(value, ["currency", "customerId", "dueDate", "invoiceId", "invoiceStatus", "issueDate", "orderId", "totalMinor"])) return false;
  const v = value as Record<string, unknown>; return nonEmpty(v.invoiceId) && nonEmpty(v.orderId) && nonEmpty(v.customerId) && ["OPEN", "PAID", "VOID"].includes(String(v.invoiceStatus)) && isDate(v.issueDate) && isDate(v.dueDate) && Date.parse(`${v.dueDate}T00:00:00Z`) >= Date.parse(`${v.issueDate}T00:00:00Z`) && Number.isSafeInteger(v.totalMinor) && (v.totalMinor as number) >= 0 && v.currency === "EUR";
}

function sourceDigest(value: Pan433Source): string {
  const { sourceDigest: _sourceDigest, ...content } = value;
  return sha(content);
}

function validateSource(source: Pan433Source, profile: Pan433MappingProfileV1): Pan433MappingDenialCodeV1 | null {
  if (source.schemaVersion !== profile.source.schema || source.sourceSystem !== profile.source.sourceSystem || !nonEmpty(source.sourceDatasetId) || !digest(source.sourceDigest)) return "SOURCE_SCHEMA_UNSUPPORTED";
  if (sourceDigest(source) !== source.sourceDigest) return "SOURCE_DIGEST_INVALID";
  if (profile.source.layout === "DEFAULT_INVOICE_ROW") {
    if (!exactKeys(source, ["batches", "schemaVersion", "sourceDatasetId", "sourceDigest", "sourceSystem"]) || !Array.isArray(source.batches) || source.batches.length !== 1) return "SOURCE_SHAPE_INVALID";
    const batch = source.batches[0];
    if (!object(batch) || !exactKeys(batch, ["records"]) || !Array.isArray(batch.records) || batch.records.length !== 1) return "AMBIGUOUS_RECORD";
    const row = batch.records[0];
    if (!object(row) || !exactKeys(row, ["invoice", "recordId", "updatedAt"]) || !nonEmpty(row.recordId) || !isTimestamp(row.updatedAt) || !object(row.invoice) || !exactKeys(row.invoice, ["currency", "customerId", "dueDate", "invoiceId", "invoiceStatus", "issueDate", "orderId", "totalMinor"])) return "SOURCE_SHAPE_INVALID";
    return validInvoice(row.invoice) ? null : "FIELD_SEMANTICS_INVALID";
  }
  if (!exactKeys(source, ["documents", "schemaVersion", "sourceDatasetId", "sourceDigest", "sourceSystem"]) || !Array.isArray(source.documents) || source.documents.length !== 1) return "AMBIGUOUS_RECORD";
  const document = source.documents[0];
  if (!object(document) || !exactKeys(document, ["changedAt", "commercial", "documentId", "lifecycle", "money"]) || !nonEmpty(document.documentId) || !isTimestamp(document.changedAt) || !object(document.commercial) || !exactKeys(document.commercial, ["customerRef", "number", "orderRef"]) || !object(document.lifecycle) || !exactKeys(document.lifecycle, ["issuedOn", "payBy", "state"]) || !object(document.money) || !exactKeys(document.money, ["currencyCode", "grossMinor"])) return "SOURCE_SHAPE_INVALID";
  const c = document.commercial as Record<string, unknown>; const l = document.lifecycle as Record<string, unknown>; const m = document.money as Record<string, unknown>;
  return validInvoice({ invoiceId: c.number, orderId: c.orderRef, customerId: c.customerRef, invoiceStatus: l.state, issueDate: l.issuedOn, dueDate: l.payBy, totalMinor: m.grossMinor, currency: m.currencyCode }) ? null : "FIELD_SEMANTICS_INVALID";
}

export function mapPan433SourceV1(source: unknown, profile: unknown): Pan433MappedResultV1 {
  if (!verifyPan433MappingProfileV1(profile)) return { outcome: "DENIED", code: "MAPPING_PROFILE_DIGEST_MISMATCH", detail: "mapping profile is not structurally valid and self-sealed." };
  if (!isApprovedPan433MappingProfileV1(profile)) return { outcome: "DENIED", code: "MAPPING_PROFILE_NOT_APPROVED", detail: "a self-consistent caller profile is not one of the code-owned PAN433 semantic identities." };
  if (!object(source)) return { outcome: "DENIED", code: "SOURCE_NOT_OBJECT", detail: "source must be a plain object." };
  const sourceError = validateSource(source, profile);
  if (sourceError !== null) return { outcome: "DENIED", code: sourceError, detail: "source layout, source authority, digest, record cardinality or closed field semantics failed." };
  let invoice: Pan433Invoice | undefined;
  if (profile.source.layout === "DEFAULT_INVOICE_ROW") { const batch = (source.batches as Record<string, unknown>[])[0]!; const records = batch.records as Record<string, unknown>[]; invoice = records[0]!.invoice as Pan433Invoice; }
  else {
    const d = (source.documents as Record<string, unknown>[])[0]!; const c = d.commercial as Record<string, unknown>; const l = d.lifecycle as Record<string, unknown>; const m = d.money as Record<string, unknown>;
    invoice = { invoiceId: c.number as string, orderId: c.orderRef as string, customerId: c.customerRef as string, invoiceStatus: l.state as Pan433Invoice["invoiceStatus"], issueDate: l.issuedOn as string, dueDate: l.payBy as string, totalMinor: m.grossMinor as number, currency: m.currencyCode as "EUR" };
  }
  if (!validInvoice(invoice)) return { outcome: "DENIED", code: "FIELD_SEMANTICS_INVALID", detail: "mapped invoice does not satisfy released invoice fact semantics; no unit or currency conversion is inferred." };
  return { outcome: "MAPPED", layout: profile.source.layout, profileId: profile.profileId, sourceDatasetId: source.sourceDatasetId as string, sourceDigest: source.sourceDigest as string, invoice };
}

export type Pan433BusinessDenialCodeV1 = Pan433MappingDenialCodeV1
  | "DOWNSTREAM_INPUT_NOT_CLOSED"
  | "MAPPING_DOWNSTREAM_FACT_CONFLICT"
  | "DOWNSTREAM_CONSUMER_DENIED"
  | "M0_PROFILE_DENIED";

export type Pan433BusinessConsumerResultV1 =
  | Readonly<{ outcome: "ACCEPTED"; mapping: Extract<Pan433MappedResultV1, { outcome: "MAPPED" }>; core: Extract<FachprofilApplyResultV1, { outcome: "MAPPED" }>; business: Extract<ReconciliationMatchOutcomeV1, { outcome: "RECHNUNGSABGLEICH_MATCH" }> }>
  | Readonly<{ outcome: "DENIED"; code: Pan433BusinessDenialCodeV1; detail: string; business?: ReconciliationMatchOutcomeV1 }> ;

const PAN433_DOWNSTREAM_FACT_FIELDS = ["invoiceId", "orderId", "customerId", "invoiceStatus", "totalMinor", "currency"] as const;

/**
 * Connect a PAN433 mapping to the released procurement-434 business consumer.
 * The consumer still owns the sealed reader, PO, receipt, invoice-line,
 * quantity, currency and approval gates. PAN433 only proves that its mapped
 * target facts are the same facts the owned reader will consume; it never
 * replaces the reader readback or reimplements the match.
 */
export function consumePan433MappedInvoiceThroughProcurement434V1(
  source: unknown,
  profile: unknown,
  downstreamInput: unknown,
  pack: ErvCasePackV1,
): Pan433BusinessConsumerResultV1 {
  const mapped = mapPan433SourceV1(source, profile);
  if (mapped.outcome !== "MAPPED") return mapped;
  const core = applyFachprofilToErpReadInvoiceV1(mapped.invoice, ERP_READ_INVOICE_TO_ERV_INVOICE_V1);
  if (core.outcome !== "MAPPED") return { outcome: "DENIED", code: "M0_PROFILE_DENIED", detail: `released M0 consumer denied the mapped invoice: ${core.code}` };
  if (!object(downstreamInput) || !object(downstreamInput.binding) || !object(downstreamInput.erpReadReadback)
    || downstreamInput.erpReadReadback.outcome !== "READ" || !Array.isArray(downstreamInput.erpReadReadback.records)) {
    return { outcome: "DENIED", code: "DOWNSTREAM_INPUT_NOT_CLOSED", detail: "procurement-434 requires the closed reader readback and invoice binding; PAN433 will not construct a business result from mapping output alone." };
  }
  const binding = downstreamInput.binding as Record<string, unknown>;
  if (binding.erpReadInvoiceId !== mapped.invoice.invoiceId) {
    return { outcome: "DENIED", code: "MAPPING_DOWNSTREAM_FACT_CONFLICT", detail: `mapped invoice ${mapped.invoice.invoiceId} does not close to the downstream bound invoice ${String(binding.erpReadInvoiceId)}.` };
  }
  const records = downstreamInput.erpReadReadback.records as unknown[];
  const readerFact = records.find((record) => object(record) && record.invoiceId === mapped.invoice.invoiceId);
  if (!object(readerFact)) return { outcome: "DENIED", code: "MAPPING_DOWNSTREAM_FACT_CONFLICT", detail: `the downstream reader readback has no invoice fact for ${mapped.invoice.invoiceId}.` };
  for (const field of PAN433_DOWNSTREAM_FACT_FIELDS) {
    if (canonicalJson(readerFact[field]) !== canonicalJson(mapped.invoice[field])) {
      return { outcome: "DENIED", code: "MAPPING_DOWNSTREAM_FACT_CONFLICT", detail: `mapped ${field} does not equal the source-bound downstream reader fact; PAN433 will not silently substitute or convert a business fact.` };
    }
  }
  const business = rechnungsabgleichMatchZusammensetzenV1(downstreamInput, pack);
  if (business.outcome !== "RECHNUNGSABGLEICH_MATCH" || business.decision.outcome !== "MATCHED") {
    return { outcome: "DENIED", code: "DOWNSTREAM_CONSUMER_DENIED", detail: `procurement-434 did not produce its supported MATCHED result (${business.outcome}${"code" in business ? `/${business.code}` : ""}); PAN433 preserves the denial and does not downgrade it to a mapping success.`, business };
  }
  return { outcome: "ACCEPTED", mapping: mapped, core, business };
}

export type Pan433ConsumerResultV1 =
  | Readonly<{ outcome: "ACCEPTED"; mapping: Extract<Pan433MappedResultV1, { outcome: "MAPPED" }>; core: Extract<FachprofilApplyResultV1, { outcome: "MAPPED" }> }>
  | Readonly<{ outcome: "DENIED"; code: Pan433MappingDenialCodeV1 | "M0_PROFILE_DENIED"; detail: string }>;

/** Real named downstream consumer: the released M0 core, not a reimplementation. */
export function consumePan433MappedInvoiceV1(source: unknown, profile: unknown): Pan433ConsumerResultV1 {
  const mapped = mapPan433SourceV1(source, profile);
  if (mapped.outcome !== "MAPPED") return mapped;
  const core = applyFachprofilToErpReadInvoiceV1(mapped.invoice, ERP_READ_INVOICE_TO_ERV_INVOICE_V1);
  if (core.outcome !== "MAPPED") return { outcome: "DENIED", code: "M0_PROFILE_DENIED", detail: `released M0 consumer denied the mapped invoice: ${core.code}` };
  return { outcome: "ACCEPTED", mapping: mapped, core };
}
