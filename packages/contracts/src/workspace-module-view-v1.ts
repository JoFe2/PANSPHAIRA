import {browserWorkspaceStringValuesV1} from "./browser-shell-plugin-v1.js";
// Additive data-free personal module view. A valid shape/catalog is NOT native
// authentication, a context handle, consent, a write receipt or a business grant.
export type WorkspaceViewUnitV1 = "CURRENCY_MINOR" | "ISO4217" | "LIABILITY_STATE" | "REVIEW_STATE" | "COUNT" | "QUANTITY" | "NATIVE_REFERENCE_ID" | "PER_FIELD";
export interface WorkspaceViewFieldV1 { readonly fieldId: string; readonly source: "ERV_NATIVE" | "HUMAN_NATIVE"; readonly type: "NUMBER" | "STRING"; readonly unit: Exclude<WorkspaceViewUnitV1, "PER_FIELD"> }
export interface WorkspaceViewBindingV1 { readonly fieldIds: readonly string[]; readonly unit: WorkspaceViewUnitV1 }
export interface WorkspaceViewInstanceV1 { readonly instanceId: string; readonly componentId: "VALUE" | "TABLE" | "HUMAN_REVIEW"; readonly size: "compact" | "regular" | "large"; readonly visible: boolean; readonly binding: WorkspaceViewBindingV1 }
export interface WorkspaceModuleViewV1 { readonly schemaVersion: "pansphaira.workspace-module-view/v1"; readonly moduleId: "pan.erv"; readonly viewId: "pan.erv.view"; readonly catalogVersion: "pansphaira.workspace-data-catalog/v1"; readonly instances: readonly WorkspaceViewInstanceV1[] }
export type WorkspaceViewOperationV1 = { readonly kind: "MOVE"; readonly instanceId: string; readonly position: number } | { readonly kind: "RESIZE"; readonly instanceId: string; readonly size: WorkspaceViewInstanceV1["size"] } | { readonly kind: "SHOW"; readonly instanceId: string; readonly visible: boolean } | { readonly kind: "BIND"; readonly instanceId: string; readonly binding: WorkspaceViewBindingV1 };
export interface WorkspaceViewDeltaV1 { readonly schemaVersion: "pansphaira.workspace-module-view/delta/v1"; readonly operations: readonly WorkspaceViewOperationV1[] }
const units: readonly string[] = [browserWorkspaceStringValuesV1[45] as string, browserWorkspaceStringValuesV1[173] as string, browserWorkspaceStringValuesV1[175] as string, browserWorkspaceStringValuesV1[85] as string, "COUNT", browserWorkspaceStringValuesV1[201] as string, "NATIVE_REFERENCE_ID", browserWorkspaceStringValuesV1[54] as string];
const sizes: readonly string[] = [browserWorkspaceStringValuesV1[139] as string, browserWorkspaceStringValuesV1[14] as string, "large"];
const components: readonly string[] = ["VALUE", "TABLE", browserWorkspaceStringValuesV1[34] as string];
function fail(reason: string): never { throw new Error(reason); }
function exact(value: unknown, keys: readonly string[]): Record<string, unknown> {
  if (value === null || typeof value !== "object" || Object.getPrototypeOf(value) !== Object.prototype) return fail(browserWorkspaceStringValuesV1[9] as string);
  const ds = Object.getOwnPropertyDescriptors(value);
  if (Reflect.ownKeys(ds).length !== keys.length || keys.some(key => !Object.hasOwn(ds, key)) || Reflect.ownKeys(ds).some(key => typeof key !== "string" || !keys.includes(key)) || Object.values(ds).some(d => !d.enumerable || !("value" in d))) return fail(browserWorkspaceStringValuesV1[9] as string);
  return Object.fromEntries(keys.map(key => [key, ds[key]!.value as unknown]));
}
function list(value: unknown, max: number, min = 1): readonly unknown[] {
  if (!Array.isArray(value) || Object.getPrototypeOf(value) !== Array.prototype || value.length < min || value.length > max) return fail(browserWorkspaceStringValuesV1[9] as string);
  const ds = Object.getOwnPropertyDescriptors(value);
  if (Reflect.ownKeys(ds).length !== value.length + 1 || Reflect.ownKeys(ds).some(key => typeof key !== "string" || !(key === browserWorkspaceStringValuesV1[11] || /^(?:0|[1-9][0-9]*)$/.test(key))) || Object.entries(ds).some(([key,d]) => !("value" in d) || (key !== browserWorkspaceStringValuesV1[11] && !d.enumerable))) return fail(browserWorkspaceStringValuesV1[9] as string);
  return value;
}
function identifier(value: unknown): string { if (typeof value !== "string" || !/^[a-z][A-Za-z0-9.-]{0,95}$/.test(value)) return fail(browserWorkspaceStringValuesV1[9] as string); return value; }
function size(value: unknown): WorkspaceViewInstanceV1["size"] { if (typeof value !== "string" || !sizes.includes(value)) return fail(browserWorkspaceStringValuesV1[9] as string); return value as WorkspaceViewInstanceV1["size"]; }
function boolean(value: unknown): boolean { if (typeof value !== "boolean") return fail(browserWorkspaceStringValuesV1[9] as string); return value; }
function catalogMap(value: readonly WorkspaceViewFieldV1[]): Map<string, WorkspaceViewFieldV1> {
  const map = new Map<string, WorkspaceViewFieldV1>();
  for (const item of list(value, 32)) {
    const v = exact(item, [browserWorkspaceStringValuesV1[102] as string, browserWorkspaceStringValuesV1[86] as string, "type", "unit"]); const fieldId = identifier(v.fieldId);
    if (map.has(fieldId) || ![browserWorkspaceStringValuesV1[25] as string, browserWorkspaceStringValuesV1[71] as string].includes(v.source as string) || ![browserWorkspaceStringValuesV1[50] as string, browserWorkspaceStringValuesV1[222] as string].includes(v.type as string) || !units.includes(v.unit as string) || v.unit === browserWorkspaceStringValuesV1[54]) return fail("VIEW_CATALOG_DENIED");
    if (v.unit === "NATIVE_REFERENCE_ID" && (v.type !== "STRING" || v.source !== "ERV_NATIVE")) return fail("VIEW_CATALOG_DENIED");
    map.set(fieldId, { fieldId, source: v.source as WorkspaceViewFieldV1["source"], type: v.type as WorkspaceViewFieldV1["type"], unit: v.unit as WorkspaceViewFieldV1["unit"] });
  }
  return map;
}
function binding(value: unknown, component: WorkspaceViewInstanceV1["componentId"], catalog: Map<string, WorkspaceViewFieldV1>): WorkspaceViewBindingV1 {
  const v = exact(value, ["fieldIds", "unit"]); const fieldIds = list(v.fieldIds, 8).map(identifier);
  if (new Set(fieldIds).size !== fieldIds.length || fieldIds.some(id => !catalog.has(id))) return fail(browserWorkspaceStringValuesV1[87] as string);
  if (typeof v.unit !== "string" || !units.includes(v.unit)) return fail(browserWorkspaceStringValuesV1[233] as string);
  if (component === "TABLE") { if (v.unit !== browserWorkspaceStringValuesV1[54] || fieldIds.some(id => catalog.get(id)!.source !== browserWorkspaceStringValuesV1[25])) return fail(browserWorkspaceStringValuesV1[87] as string); }
  else {
    if (fieldIds.length !== 1) return fail(browserWorkspaceStringValuesV1[87] as string); const f = catalog.get(fieldIds[0]!)!;
    if (component === browserWorkspaceStringValuesV1[34] && (f.source !== browserWorkspaceStringValuesV1[71] || f.unit !== browserWorkspaceStringValuesV1[85]) || component === "VALUE" && (f.source !== browserWorkspaceStringValuesV1[25] || f.type !== browserWorkspaceStringValuesV1[50])) return fail(browserWorkspaceStringValuesV1[87] as string);
    if (f.unit !== v.unit) return fail(browserWorkspaceStringValuesV1[233] as string);
  }
  return Object.freeze({ fieldIds: Object.freeze(fieldIds), unit: v.unit as WorkspaceViewUnitV1 });
}
export function validateWorkspaceModuleViewV1(value: unknown, fields: readonly WorkspaceViewFieldV1[]): WorkspaceModuleViewV1 {
  const v = exact(value, [browserWorkspaceStringValuesV1[0] as string, browserWorkspaceStringValuesV1[48] as string, browserWorkspaceStringValuesV1[59] as string, "catalogVersion", "instances"]);
  if (v.schemaVersion !== browserWorkspaceStringValuesV1[115] || v.moduleId !== browserWorkspaceStringValuesV1[15] || v.viewId !== browserWorkspaceStringValuesV1[30] || v.catalogVersion !== browserWorkspaceStringValuesV1[79]) return fail(browserWorkspaceStringValuesV1[9] as string);
  const catalog = catalogMap(fields); const seen = new Set<string>();
  const instances = list(v.instances, 16).map(item => {
    const i = exact(item, [browserWorkspaceStringValuesV1[104] as string, "componentId", "size", browserWorkspaceStringValuesV1[88] as string, browserWorkspaceStringValuesV1[24] as string]); const instanceId = identifier(i.instanceId);
    if (seen.has(instanceId) || !components.includes(i.componentId as string)) return fail(browserWorkspaceStringValuesV1[9] as string); seen.add(instanceId);
    const componentId = i.componentId as WorkspaceViewInstanceV1["componentId"]; const b = binding(i.binding, componentId, catalog); const visible = boolean(i.visible);
    if (instanceId === browserWorkspaceStringValuesV1[35] && (componentId !== "VALUE" || !visible || b.fieldIds[0] !== browserWorkspaceStringValuesV1[159]) || instanceId === browserWorkspaceStringValuesV1[49] && (componentId !== browserWorkspaceStringValuesV1[34] || !visible || b.fieldIds[0] !== browserWorkspaceStringValuesV1[158])) return fail(browserWorkspaceStringValuesV1[232] as string);
    return Object.freeze({ instanceId, componentId, size: size(i.size), visible, binding: b });
  });
  if (!seen.has(browserWorkspaceStringValuesV1[35] as string) || !seen.has(browserWorkspaceStringValuesV1[49] as string)) return fail(browserWorkspaceStringValuesV1[232] as string);
  return Object.freeze({ schemaVersion: browserWorkspaceStringValuesV1[115], moduleId: browserWorkspaceStringValuesV1[15], viewId: browserWorkspaceStringValuesV1[30], catalogVersion: browserWorkspaceStringValuesV1[79], instances: Object.freeze(instances) });
}
export function defaultWorkspaceModuleViewV1(): WorkspaceModuleViewV1 {
  const items: WorkspaceViewInstanceV1[] = [
    { instanceId: browserWorkspaceStringValuesV1[35] as string, componentId: "VALUE", size: browserWorkspaceStringValuesV1[14], visible: true, binding: { fieldIds: [browserWorkspaceStringValuesV1[159] as string], unit: browserWorkspaceStringValuesV1[45] } },
    { instanceId: "invoice-table", componentId: "TABLE", size: browserWorkspaceStringValuesV1[14], visible: true, binding: { fieldIds: [browserWorkspaceStringValuesV1[99] as string, "erv.invoice.liabilityStatus"], unit: browserWorkspaceStringValuesV1[54] } },
    { instanceId: browserWorkspaceStringValuesV1[49] as string, componentId: browserWorkspaceStringValuesV1[34], size: browserWorkspaceStringValuesV1[14], visible: true, binding: { fieldIds: [browserWorkspaceStringValuesV1[158] as string], unit: browserWorkspaceStringValuesV1[85] } },
  ];
  return { schemaVersion: browserWorkspaceStringValuesV1[115], moduleId: browserWorkspaceStringValuesV1[15], viewId: browserWorkspaceStringValuesV1[30], catalogVersion: browserWorkspaceStringValuesV1[79], instances: items };
}
export function reduceWorkspaceModuleViewV1(value: unknown, delta: unknown, fields: readonly WorkspaceViewFieldV1[]): WorkspaceModuleViewV1 {
  const initial = validateWorkspaceModuleViewV1(value, fields); const d = exact(delta, [browserWorkspaceStringValuesV1[0] as string, "operations"]);
  if (d.schemaVersion !== browserWorkspaceStringValuesV1[80]) return fail(browserWorkspaceStringValuesV1[9] as string);
  const instances = [...initial.instances];
  for (const raw of list(d.operations, 16)) {
    const kind = exactOperationKind(raw); const key = kind === "MOVE" ? "position" : kind === browserWorkspaceStringValuesV1[84] ? "size" : kind === "SHOW" ? browserWorkspaceStringValuesV1[88] : browserWorkspaceStringValuesV1[24];
    const op = exact(raw, ["kind", browserWorkspaceStringValuesV1[104] as string, key]); const id = identifier(op.instanceId); const at = instances.findIndex(i => i.instanceId === id);
    if (at < 0) return fail("VIEW_INSTANCE_DENIED"); const item = instances[at]!;
    if (kind === "MOVE") { if (!Number.isSafeInteger(op.position) || (op.position as number) < 0 || (op.position as number) >= instances.length) return fail("VIEW_POSITION_DENIED"); instances.splice(at, 1); instances.splice(op.position as number, 0, item); }
    else if (kind === browserWorkspaceStringValuesV1[84]) instances[at] = { ...item, size: size(op.size) };
    else if (kind === "SHOW") instances[at] = { ...item, visible: boolean(op.visible) };
    else instances[at] = { ...item, binding: binding(op.binding, item.componentId, catalogMap(fields)) };
    // Validate each intermediate stage: a later SHOW cannot launder a forbidden
    // HIDE, and a rejected operation never mutates the supplied original object.
    validateWorkspaceModuleViewV1({ ...initial, instances }, fields);
  }
  return validateWorkspaceModuleViewV1({ ...initial, instances }, fields);
}
function exactOperationKind(value: unknown): "MOVE" | "RESIZE" | "SHOW" | "BIND" {
  if (value === null || typeof value !== "object" || Object.getPrototypeOf(value) !== Object.prototype) return fail(browserWorkspaceStringValuesV1[9] as string);
  const d = Object.getOwnPropertyDescriptor(value, "kind");
  if (!d || !("value" in d) || !d.enumerable || !["MOVE", browserWorkspaceStringValuesV1[84] as string, "SHOW", "BIND"].includes(d.value as string)) return fail(browserWorkspaceStringValuesV1[9] as string);
  return d.value as "MOVE" | "RESIZE" | "SHOW" | "BIND";
}
