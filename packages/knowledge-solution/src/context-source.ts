import { createHash } from "node:crypto";
import { readFileSync, statSync } from "node:fs";
import path from "node:path";
import { canonicalJson } from "../../contracts/src/canonical-json.js";

/**
 * KTS-02 — sealed local context packs (real, different data structures).
 *
 * A context pack is a closed, locally readable bundle: a descriptor with the
 * source fields' fachliche Bedeutung + declared units, the raw rows (CSV), and
 * the threshold value. It is data, not authority: the mapping (guided-path)
 * decides how it is adapted, and nothing here performs fachliche decisions.
 * Read-only; the pack is the only source of context data in the guided path.
 */

export const CONTEXT_DESCRIPTOR_SCHEMA_V1 = "pansphaira.kts/context-descriptor/v1" as const;
export const CONTEXT_DATA_SCHEMA_V1 = "pansphaira.kts/context-data/v1" as const;
export const CONTEXT_PACK_BOUNDARY_V1 =
  "READ_ONLY_LOCAL_SYNTHETIC_DATA_NO_NETWORK_NO_WRITE_NO_AUTHORITY" as const;

export type ContextFieldKindV1 = "string" | "number" | "date";

export interface ContextFieldDescriptorV1 {
  readonly field: string;
  readonly meaning: string;
  readonly kind: ContextFieldKindV1;
  /** Declared unit of the source field ("eur", "cent", "usd"); null for non-number. */
  readonly unit: string | null;
  readonly nullable: boolean;
  /** Closed fachliche meaning key (F2): the closed semantic identity of this
   *  source field. When the sealed spec assigns the SAME meaningKey to the
   *  target field, the meaning is identity-given (closed channel) — no free
   *  text inference. Absent => the closed token tables decide. */
  readonly meaningKey?: "INVOICE_ID" | "ORDER_ID" | "CUSTOMER_ID" | "INVOICE_TOTAL_GROSS" | "CURRENCY_CODE" | "DUE_DATE";
}

export interface ContextDescriptorV1 {
  readonly schemaVersion: typeof CONTEXT_DESCRIPTOR_SCHEMA_V1;
  readonly contextId: string;
  readonly sourceFormat: string;
  readonly description: string;
  readonly fields: readonly ContextFieldDescriptorV1[];
  /** The field carrying the threshold value (data, unit per its descriptor). */
  readonly floorField: string;
  readonly descriptorDigest: string;
}

export interface ContextDataV1 {
  readonly schemaVersion: typeof CONTEXT_DATA_SCHEMA_V1;
  readonly contextId: string;
  readonly descriptorDigest: string;
  readonly floorField: string;
  readonly floorRaw: number;
  readonly rows: readonly Record<string, string | null>[];
  readonly dataDigest: string;
}

const ID_RE = /^[a-z][a-z-]{1,31}:[a-z0-9][a-z0-9._-]{2,95}$/;
const DIGEST_RE = /^[a-f0-9]{64}$/;
const FIELD_RE = /^[a-z][a-zA-Z0-9_]{1,31}$/;

const sha = (value: unknown): string =>
  createHash("sha256").update(typeof value === "string" ? value : canonicalJson(value)).digest("hex");
const record = (v: unknown): v is Record<string, unknown> =>
  v !== null && typeof v === "object" && !Array.isArray(v) && Object.getPrototypeOf(v) === Object.prototype;
const exact = (v: unknown, keys: readonly string[]): v is Record<string, unknown> =>
  record(v) && canonicalJson(Object.keys(v).sort()) === canonicalJson([...keys].sort());
const boundedText = (v: unknown, max: number): v is string =>
  typeof v === "string" && v.length > 0 && v.length <= max && !/[\u0000-\u001f]/.test(v);

export function contextDescriptorDigestV1(
  value: Omit<ContextDescriptorV1, "descriptorDigest"> | Record<string, unknown>,
): string {
  return sha(Object.fromEntries(Object.entries(value).filter(([key]) => key !== "descriptorDigest")));
}

export function validateContextDescriptorV1(value: unknown): value is ContextDescriptorV1 {
  if (!exact(value, ["schemaVersion", "contextId", "sourceFormat", "description", "fields", "floorField", "descriptorDigest"])) return false;
  if (value.schemaVersion !== CONTEXT_DESCRIPTOR_SCHEMA_V1 || !ID_RE.test(String(value.contextId))
    || typeof value.sourceFormat !== "string" || !boundedText(value.sourceFormat, 40)
    || typeof value.description !== "string" || !boundedText(value.description, 300)) return false;
  if (!Array.isArray(value.fields) || value.fields.length < 1 || value.fields.length > 32) return false;
  const seen = new Set<string>();
  for (const field of value.fields) {
    if (!((exact(field, ["field", "meaning", "kind", "unit", "nullable"]))
      || exact(field, ["field", "meaning", "kind", "meaningKey", "unit", "nullable"]))
      || typeof field.field !== "string" || !FIELD_RE.test(field.field)
      || (field.meaningKey !== undefined && (typeof field.meaningKey !== "string" || !/^[A-Z][A-Z0-9_]{1,39}$/.test(field.meaningKey)))
      || typeof field.meaning !== "string" || !boundedText(field.meaning, 200)
      || !["string", "number", "date"].includes(String(field.kind))
      || (field.unit !== null && (typeof field.unit !== "string" || !boundedText(field.unit, 16)))
      || typeof field.nullable !== "boolean"
      || (field.kind === "number" ? field.unit === null : field.unit !== null)) return false;
    if (seen.has(field.field)) return false;
    seen.add(field.field);
  }
  if (typeof value.floorField !== "string" || !FIELD_RE.test(value.floorField) || !seen.has(value.floorField)) return false;
  const floorField = value.fields.find((f) => f.field === value.floorField);
  if (floorField === undefined || floorField.kind !== "number") return false;
  if (!DIGEST_RE.test(String(value.descriptorDigest))) return false;
  return contextDescriptorDigestV1(value) === value.descriptorDigest;
}

export function contextDataDigestV1(
  value: Omit<ContextDataV1, "dataDigest"> | Record<string, unknown>,
): string {
  return sha(Object.fromEntries(Object.entries(value).filter(([key]) => key !== "dataDigest")));
}

export function validateContextDataV1(value: unknown): value is ContextDataV1 {
  if (!exact(value, ["schemaVersion", "contextId", "descriptorDigest", "floorField", "floorRaw", "rows", "dataDigest"])) return false;
  if (value.schemaVersion !== CONTEXT_DATA_SCHEMA_V1 || !ID_RE.test(String(value.contextId))
    || !DIGEST_RE.test(String(value.descriptorDigest))
    || typeof value.floorField !== "string" || !FIELD_RE.test(value.floorField)
    || typeof value.floorRaw !== "number" || !Number.isFinite(value.floorRaw)) return false;
  if (!Array.isArray(value.rows) || value.rows.length < 1 || value.rows.length > 1024) return false;
  if (!value.rows.every((row) => record(row)
    && Object.values(row).every((v) => v === null || typeof v === "string"))) return false;
  if (!DIGEST_RE.test(String(value.dataDigest))) return false;
  return contextDataDigestV1(value) === value.dataDigest;
}

/** Closed CSV dialect: first line is the header (exact field names, order-free),
 * values are UTF-8, empty means null. No quoting layer, no escaping — anything
 * else is a denial (fail closed, no clever parsing). */
export function parseClosedCsvV1(text: string): { readonly header: readonly string[]; readonly rows: readonly string[] } {
  const lines = text.split("\n");
  if (lines.at(-1) === "") lines.pop();
  if (lines.length < 2) throw new Error("CONTEXT_CSV_EMPTY");
  const headerLine = lines[0];
  if (headerLine === undefined) throw new Error("CONTEXT_CSV_EMPTY");
  const header = headerLine.split(",").map((cell) => cell.trim());
  if (header.length < 1 || !header.every((cell) => FIELD_RE.test(cell))) throw new Error("CONTEXT_CSV_HEADER_DENIED");
  if (new Set(header).size !== header.length) throw new Error("CONTEXT_CSV_HEADER_DUPLICATE");
  const rows = lines.slice(1);
  for (const line of rows) {
    if (line.includes('"') || line.includes("\\") || line.includes("\r") || line.includes("\0")) {
      throw new Error("CONTEXT_CSV_ESCAPING_DENIED");
    }
  }
  return { header, rows };
}

export interface ContextPackV1 {
  readonly descriptor: ContextDescriptorV1;
  readonly data: ContextDataV1;
}

/**
 * Load a sealed context pack from a local directory:
 *   descriptor.json  (ContextDescriptorV1, digest-verified)
 *   rows.csv         (closed CSV, header must exactly equal the descriptor fields)
 *   floor.json       ({ "value": <number> } — threshold in the floor field's unit)
 */
export function loadContextPackV1(packRoot: string): ContextPackV1 {
  const read = (name: string): string => {
    const absolute = path.join(packRoot, name);
    const stat = statSync(absolute);
    if (!stat.isFile()) throw new Error(`CONTEXT_PACK_${name}_MISSING`);
    return readFileSync(absolute, "utf8");
  };
  const descriptor = JSON.parse(read("descriptor.json")) as unknown;
  if (!validateContextDescriptorV1(descriptor)) throw new Error("CONTEXT_DESCRIPTOR_DENIED");
  const { header, rows } = parseClosedCsvV1(read("rows.csv"));
  if (canonicalJson(header.slice().sort()) !== canonicalJson(descriptor.fields.map((f) => f.field).slice().sort())) {
    throw new Error("CONTEXT_CSV_HEADER_MISMATCH");
  }
  const floor = JSON.parse(read("floor.json")) as unknown;
  if (!exact(floor, ["value"]) || typeof (floor as Record<string, unknown>).value !== "number"
    || !Number.isFinite((floor as Record<string, unknown>).value as number)) {
    throw new Error("CONTEXT_FLOOR_DENIED");
  }
  const rowRecords: Record<string, string | null>[] = rows.map((line) => {
    const cells = line.split(",");
    if (cells.length !== header.length) throw new Error("CONTEXT_CSV_CELL_COUNT_DENIED");
    const item: Record<string, string | null> = {};
    for (let index = 0; index < header.length; index += 1) {
      const cell = (cells[index] ?? "").trim();
      const fieldName = header[index];
      if (fieldName === undefined) throw new Error("CONTEXT_CSV_CELL_COUNT_DENIED");
      item[fieldName] = cell === "" ? null : cell;
    }
    return item;
  });
  for (const field of descriptor.fields) {
    for (const row of rowRecords) {
      const fieldName = field.field as string;
      const value = row[fieldName];
      if (value === null) {
        if (!field.nullable) throw new Error("CONTEXT_CSV_NULL_DENIED");
        continue;
      }
      if (typeof value !== "string") throw new Error("CONTEXT_CSV_CELL_TYPE_DENIED");
      if (field.kind === "number" && !/^-?\d+(?:\.\d+)?$/.test(value)) throw new Error("CONTEXT_CSV_NUMBER_DENIED");
      if (field.kind === "date" && !/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new Error("CONTEXT_CSV_DATE_DENIED");
    }
  }
  const floorValue = (floor as { value: number }).value;
  const unsigned: Omit<ContextDataV1, "dataDigest"> = {
    schemaVersion: CONTEXT_DATA_SCHEMA_V1,
    contextId: descriptor.contextId,
    descriptorDigest: descriptor.descriptorDigest,
    floorField: descriptor.floorField,
    floorRaw: floorValue,
    rows: rowRecords,
  };
  return { descriptor, data: { ...unsigned, dataDigest: contextDataDigestV1(unsigned) } };
}
