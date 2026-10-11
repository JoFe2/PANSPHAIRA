import {browserWorkspaceStringValuesV1} from "./browser-shell-plugin-v1.js";
// Presentation only. No session, tenant, authority, business values or free text.
export type BrowserProfileSizeV1 = "compact" | "regular" | "large";
export interface BrowserProfileItemV1 { id: string; version: string; visible: boolean; size: BrowserProfileSizeV1 }
export interface BrowserProfileV1 { schemaVersion: "pansphaira.browser-profile/v1"; items: BrowserProfileItemV1[] }
export type BrowserProfileAvailabilityV1 = "AVAILABLE" | "MISSING" | "DISABLED" | "INCOMPATIBLE" | "DENIED";
export interface BrowserProfileCatalogItemV1 { id: string; version: string; state: BrowserProfileAvailabilityV1 }
export interface BrowserProfileReadV1 {
  schemaVersion: "pansphaira.browser-profile-read/v1";
  revision: number;
  profile: BrowserProfileV1;
  catalog: BrowserProfileCatalogItemV1[];
  migration: "NONE" | "V0_TO_V1" | "DEFAULT_UNSUPPORTED";
  effectiveItems: BrowserProfileItemV1[];
  orphaned: { id: string; reason: Exclude<BrowserProfileAvailabilityV1, "AVAILABLE"> }[];
}
export interface BrowserProfileWriteV1 { expectedRevision: number; profile: BrowserProfileV1 }
const sizes = ["compact", "regular", "large"] as const;
const states = ["AVAILABLE", "MISSING", "DISABLED", "INCOMPATIBLE", "DENIED"] as const;
const idPattern = /^[a-z][a-z0-9]*(?:\.[a-z][a-z0-9-]*){1,5}$/;
const versionPattern = /^[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}$/;
function exact(value: unknown, keys: string[]): asserts value is Record<string, unknown> {
  if (!value || typeof value !== "object" || Object.getPrototypeOf(value) !== Object.prototype) throw new Error(browserWorkspaceStringValuesV1[4]);
  const ds = Object.getOwnPropertyDescriptors(value);
  if (Reflect.ownKeys(ds).length !== keys.length || keys.some(k => !Object.hasOwn(ds, k))
    || Reflect.ownKeys(ds).some(k => typeof k !== "string" || !keys.includes(k))
    || Object.values(ds).some(d => !("value" in d) || !d.enumerable)) throw new Error(browserWorkspaceStringValuesV1[4]);
}
function list(value: unknown): asserts value is unknown[] {
  if (!Array.isArray(value) || Object.getPrototypeOf(value) !== Array.prototype || value.length > 32
    || Reflect.ownKeys(value).length !== value.length + 1
    || Object.values(Object.getOwnPropertyDescriptors(value)).some(d => !("value" in d))) throw new Error(browserWorkspaceStringValuesV1[4]);
}
function identifier(value: unknown): asserts value is string { if (typeof value !== "string" || value.length > 96 || !idPattern.test(value)) throw new Error(browserWorkspaceStringValuesV1[4]); }
function version(value: unknown): asserts value is string { if (typeof value !== "string" || !versionPattern.test(value)) throw new Error(browserWorkspaceStringValuesV1[4]); }
function revision(value: unknown): asserts value is number { if (!Number.isSafeInteger(value) || (value as number) < 0 || (value as number) >= Number.MAX_SAFE_INTEGER) throw new Error(browserWorkspaceStringValuesV1[4]); }
export function validateBrowserProfileV1(value: unknown): BrowserProfileV1 {
  exact(value, [browserWorkspaceStringValuesV1[0] as string, "items"]);
  if (value.schemaVersion !== browserWorkspaceStringValuesV1[53]) throw new Error(browserWorkspaceStringValuesV1[4]);
  list(value.items); const seen = new Set<string>();
  const items = value.items.map(item => {
    exact(item, ["id", browserWorkspaceStringValuesV1[41] as string, browserWorkspaceStringValuesV1[88] as string, "size"]); identifier(item.id); version(item.version);
    if (seen.has(item.id) || typeof item.visible !== "boolean" || !sizes.includes(item.size as BrowserProfileSizeV1)) throw new Error(browserWorkspaceStringValuesV1[4]);
    seen.add(item.id); return { id: item.id, version: item.version, visible: item.visible, size: item.size as BrowserProfileSizeV1 };
  });
  return { schemaVersion: browserWorkspaceStringValuesV1[53], items };
}
export function validateBrowserProfileWriteV1(value: unknown): BrowserProfileWriteV1 {
  exact(value, [browserWorkspaceStringValuesV1[100] as string, browserWorkspaceStringValuesV1[117] as string]); revision(value.expectedRevision);
  return { expectedRevision: value.expectedRevision, profile: validateBrowserProfileV1(value.profile) };
}
export function defaultBrowserProfileV1(): BrowserProfileV1 {
  return { schemaVersion: browserWorkspaceStringValuesV1[53], items: [
    { id: browserWorkspaceStringValuesV1[17] as string, version: "1.0.0", visible: true, size: browserWorkspaceStringValuesV1[14] },
    { id: browserWorkspaceStringValuesV1[119] as string, version: "1.0.0", visible: true, size: browserWorkspaceStringValuesV1[14] },
    { id: browserWorkspaceStringValuesV1[113] as string, version: "1.0.0", visible: true, size: browserWorkspaceStringValuesV1[14] },
    { id: browserWorkspaceStringValuesV1[13] as string, version: "1.0.0", visible: false, size: browserWorkspaceStringValuesV1[14] },
  ] };
}
export function migrateBrowserProfileV1(value: unknown): Pick<BrowserProfileReadV1, "profile" | "migration"> {
  try {
    exact(value, [browserWorkspaceStringValuesV1[0] as string, "items"]);
    if (value.schemaVersion === browserWorkspaceStringValuesV1[53]) return { profile: validateBrowserProfileV1(value), migration: "NONE" };
    if (value.schemaVersion !== "pansphaira.browser-profile/v0") throw new Error(browserWorkspaceStringValuesV1[4]);
    list(value.items);
    const items = value.items.map(item => { exact(item, ["id", browserWorkspaceStringValuesV1[41] as string, browserWorkspaceStringValuesV1[88] as string, "size"]); if (![1, 2, 3].includes(item.size as number)) throw new Error(browserWorkspaceStringValuesV1[4]); return { ...item, size: sizes[(item.size as number) - 1] }; });
    return { profile: validateBrowserProfileV1({ schemaVersion: browserWorkspaceStringValuesV1[53], items }), migration: browserWorkspaceStringValuesV1[231] };
  } catch { return { profile: defaultBrowserProfileV1(), migration: browserWorkspaceStringValuesV1[149] }; }
}
export function resolveBrowserProfileV1(value: unknown, catalog: readonly BrowserProfileCatalogItemV1[]): Pick<BrowserProfileReadV1, "effectiveItems" | "orphaned"> {
  const profile = validateBrowserProfileV1(value); const known = new Map<string, BrowserProfileCatalogItemV1>();
  for (const item of catalog) {
    exact(item, ["id", browserWorkspaceStringValuesV1[41] as string, "state"]); identifier(item.id); version(item.version);
    if (known.has(item.id) || !states.includes(item.state)) throw new Error("PROFILE_CATALOG_DENIED"); known.set(item.id, item);
  }
  const effectiveItems: BrowserProfileItemV1[] = []; const orphaned: BrowserProfileReadV1["orphaned"] = [];
  for (const item of profile.items) {
    const entry = known.get(item.id);
    const reason = !entry ? "MISSING" : entry.state !== browserWorkspaceStringValuesV1[43] ? entry.state : entry.version !== item.version ? "INCOMPATIBLE" : null;
    if (reason) orphaned.push({ id: item.id, reason }); else effectiveItems.push({ ...item });
  }
  return { effectiveItems, orphaned };
}
export function validateBrowserProfileReadV1(value: unknown): BrowserProfileReadV1 {
  exact(value, [browserWorkspaceStringValuesV1[0] as string, browserWorkspaceStringValuesV1[3] as string, browserWorkspaceStringValuesV1[117] as string, "catalog", "migration", "effectiveItems", "orphaned"]); revision(value.revision);
  if (value.schemaVersion !== browserWorkspaceStringValuesV1[114] || !["NONE", browserWorkspaceStringValuesV1[231] as string, browserWorkspaceStringValuesV1[149] as string].includes(value.migration as string)) throw new Error(browserWorkspaceStringValuesV1[4]);
  const profile = validateBrowserProfileV1(value.profile);
  list(value.catalog);
  const catalog = value.catalog.map(item => { exact(item, ["id", browserWorkspaceStringValuesV1[41] as string, "state"]); identifier(item.id); version(item.version); if (!states.includes(item.state as BrowserProfileAvailabilityV1)) throw new Error(browserWorkspaceStringValuesV1[4]); return { id: item.id, version: item.version, state: item.state as BrowserProfileAvailabilityV1 }; });
  const projection = resolveBrowserProfileV1(profile, catalog);
  const effective = validateBrowserProfileV1({ schemaVersion: profile.schemaVersion, items: value.effectiveItems });
  list(value.orphaned); const seen = new Set(effective.items.map(i => i.id));
  const orphaned = value.orphaned.map(item => {
    exact(item, ["id", browserWorkspaceStringValuesV1[83] as string]); identifier(item.id);
    if (seen.has(item.id) || !states.slice(1).includes(item.reason as never)) throw new Error(browserWorkspaceStringValuesV1[4]); seen.add(item.id);
    return { id: item.id, reason: item.reason as BrowserProfileReadV1["orphaned"][number]["reason"] };
  });
  if (seen.size !== profile.items.length || profile.items.some(i => !seen.has(i.id))
    || effective.items.some(i => JSON.stringify(i) !== JSON.stringify(profile.items.find(p => p.id === i.id)))) throw new Error(browserWorkspaceStringValuesV1[4]);
  if (JSON.stringify(projection.effectiveItems) !== JSON.stringify(effective.items) || JSON.stringify(projection.orphaned) !== JSON.stringify(orphaned)) throw new Error(browserWorkspaceStringValuesV1[4]);
  return { schemaVersion: browserWorkspaceStringValuesV1[114], revision: value.revision, profile, catalog, migration: value.migration as BrowserProfileReadV1["migration"], effectiveItems: effective.items, orphaned };
}
