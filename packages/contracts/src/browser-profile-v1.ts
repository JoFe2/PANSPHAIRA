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

// Additive code-owned catalog entries reuse the unchanged bounded v1 item DTO.
// IDs/versions are existing registry contributions, never user-supplied code/URLs.
export interface WorkspaceCompositionEntryV1 {readonly id:string;readonly version:'1.0.0';readonly label:string;readonly kind:'module'|'card';readonly required:boolean;readonly feature:'core'|'analysis'|'knowledge'|'configuration'|'administration'|'diagnostic'|'decisions'|'context';readonly role?:'summary'|'decision'|'references'|'provenance'|'view'|'context'|'actions';}
const compositionEntryV1=(entry:WorkspaceCompositionEntryV1):Readonly<WorkspaceCompositionEntryV1>=>Object.freeze(entry);
export const WORKSPACE_PROFILE_MODULES_V1:readonly Readonly<WorkspaceCompositionEntryV1>[]=/* @__PURE__ */ Object.freeze([
 /* @__PURE__ */ compositionEntryV1({id:'pan.erv.navigation',version:'1.0.0',label:'ERP · Rechnungen',kind:'module',required:true,feature:'core'}),
 /* @__PURE__ */ compositionEntryV1({id:'pan.analysis.navigation',version:'1.0.0',label:'BI · Bestandsanalyse',kind:'module',required:false,feature:'analysis'}),
 /* @__PURE__ */ compositionEntryV1({id:'pan.setup.navigation',version:'1.0.0',label:'Einstellungen · Einrichtung',kind:'module',required:true,feature:'core'}),
 /* @__PURE__ */ compositionEntryV1({id:'pan.knowledge.navigation',version:'1.0.0',label:'Wissen',kind:'module',required:false,feature:'knowledge'}),
 /* @__PURE__ */ compositionEntryV1({id:'pan.configuration.navigation',version:'1.0.0',label:'Agentenkonfiguration · Entwurf',kind:'module',required:false,feature:'configuration'}),
 /* @__PURE__ */ compositionEntryV1({id:'pan.setup.administration.navigation',version:'1.0.0',label:'Administration · geschützt',kind:'module',required:false,feature:'administration'}),
 /* @__PURE__ */ compositionEntryV1({id:'pan.diagnostic'+browserWorkspaceStringValuesV1[121],version:'1.0.0',label:'Technischer Rendererfehlernachweis',kind:'module',required:false,feature:'diagnostic'}),
]);
export const WORKSPACE_PROFILE_CARDS_V1:readonly Readonly<WorkspaceCompositionEntryV1>[]=/* @__PURE__ */ Object.freeze([
 /* @__PURE__ */ compositionEntryV1({id:'pan.erv.summary',version:'1.0.0',label:'Beleg und Beträge',kind:'card',role:'summary',required:true,feature:'core'}),
 /* @__PURE__ */ compositionEntryV1({id:'pan.erv.decision',version:'1.0.0',label:'Native Prüfung',kind:'card',role:'decision',required:true,feature:'decisions'}),
 /* @__PURE__ */ compositionEntryV1({id:'pan.erv.references',version:'1.0.0',label:'Belege und Mengen',kind:'card',role:'references',required:true,feature:'core'}),
 /* @__PURE__ */ compositionEntryV1({id:'pan.erv.provenance',version:'1.0.0',label:'Quelle und Nachvollziehbarkeit',kind:'card',role:'provenance',required:true,feature:'core'}),
 /* @__PURE__ */ compositionEntryV1({id:'pan.erv.personal-view',version:'1.0.0',label:'Deine Arbeitsansicht',kind:'card',role:'view',required:false,feature:'core'}),
 /* @__PURE__ */ compositionEntryV1({id:'pan.erv.context',version:'1.0.0',label:'Aktueller Kontext',kind:'card',role:'context',required:true,feature:'context'}),
 /* @__PURE__ */ compositionEntryV1({id:'pan.erv.actions',version:'1.0.0',label:'Vorgangsaktionen',kind:'card',role:'actions',required:true,feature:'core'}),
]);
export const workspaceCompositionEntryV1=(id:string)=>WORKSPACE_PROFILE_MODULES_V1.find(e=>e.id===id)??WORKSPACE_PROFILE_CARDS_V1.find(e=>e.id===id);
export function workspaceCompositionCatalogV1(features:Readonly<Record<string,boolean>>):BrowserProfileCatalogItemV1[]{
 return [...WORKSPACE_PROFILE_MODULES_V1,...WORKSPACE_PROFILE_CARDS_V1].filter(e=>e.feature==='core'||features[e.feature]===true).map(e=>({id:e.id,version:e.version,state:'AVAILABLE'}));
}
export const WORKSPACE_REQUIRED_PROFILE_SLOTS_V1=/* @__PURE__ */ Object.freeze(['shell.main','shell.widgets','pan.workspace.boundary']as const);
export function workspaceCompositionRequiredV1(catalog:readonly BrowserProfileCatalogItemV1[]):readonly string[]{
 return [...WORKSPACE_REQUIRED_PROFILE_SLOTS_V1,...[...WORKSPACE_PROFILE_MODULES_V1,...WORKSPACE_PROFILE_CARDS_V1].filter(e=>e.required&&catalog.some(c=>c.id===e.id&&c.version===e.version&&c.state==='AVAILABLE')).map(e=>e.id)];
}
export function validateWorkspaceCompositionPolicyV1(profile:unknown,catalog:readonly BrowserProfileCatalogItemV1[]):BrowserProfileV1{
 const checked=validateBrowserProfileV1(profile);
 // Legacy rows without composition IDs keep their exact bytes and semantics.
 // Required legacy shell slots are nevertheless protected by the native owner;
 // adding composition explicitly seeds required registered entries in the editor.
 const kinds=new Set(checked.items.map(i=>workspaceCompositionEntryV1(i.id)?.kind));
 const required=workspaceCompositionRequiredV1(catalog).filter(id=>{const entry=workspaceCompositionEntryV1(id);return !entry||kinds.has(entry.kind);});
 if(required.some(id=>!checked.items.some(i=>i.id===id&&i.visible)))throw Error('PROFILE_CONTRIBUTION_DENIED');
 return checked;
}

// Closed presentation metadata only. No rights, business data, URLs, CSS or code.
export const WORKSPACE_APPEARANCE_CATALOG_VERSION_V1 = '1.0.0' as const;
export type WorkspaceDesignIdV1 = 'notebook' | 'orbit' | 'prism' | 'insight' | 'jarvis';
export type WorkspaceLayoutV1 = 'workspace' | 'dashboard' | 'focus';
export const WORKSPACE_LAYOUT_CATALOG_V1=/* @__PURE__ */ Object.freeze([/* @__PURE__ */ Object.freeze({id:'workspace',name:'Geteilter Arbeitsplatz'}),/* @__PURE__ */ Object.freeze({id:'dashboard',name:'Kartenraster'}),/* @__PURE__ */ Object.freeze({id:'focus',name:'Fokusansicht'})]as const);
export const WORKSPACE_PRESENTATION_WIDTHS_V1=/* @__PURE__ */ Object.freeze({railMinimum:1121,narrowMaximum:799,tinyMaximum:320});
export type WorkspaceDensityV1 = 'compact' | 'comfortable' | 'spacious';
export type WorkspaceAgentPresentationV1 = 'hidden' | 'chip' | 'docked' | 'floating' | 'focus';
export type WorkspaceMotionV1 = 'system' | 'reduced' | 'normal';
export interface WorkspaceAppearanceV1 {
 readonly schemaVersion:'pansphaira.workspace-appearance/v1';
 readonly templateId:WorkspaceDesignIdV1;readonly templateVersion:'1.0.0';
 readonly layout:WorkspaceLayoutV1;readonly density:WorkspaceDensityV1;
 readonly agentPresentation:WorkspaceAgentPresentationV1;readonly motion:WorkspaceMotionV1;
}
export interface WorkspaceSemanticTokensV1 {
 readonly background:string;readonly surface:string;readonly raised:string;
 readonly text:string;readonly muted:string;readonly line:string;readonly accent:string;
 readonly focus:string;readonly success:string;readonly warning:string;readonly danger:string;
 readonly radius:string;readonly space:string;readonly shadow:string;
}
export interface WorkspaceDesignProfileV1 {
 readonly id:WorkspaceDesignIdV1;readonly version:'1.0.0';readonly name:string;
 readonly description:string;readonly scheme:'light'|'dark';
 readonly layout:WorkspaceLayoutV1;readonly density:WorkspaceDensityV1;
 readonly agentPresentation:WorkspaceAgentPresentationV1;
 readonly tokens:Readonly<WorkspaceSemanticTokensV1>;
 readonly graphics:'ESSENTIAL_2D';
}
const profile=(value:WorkspaceDesignProfileV1):Readonly<WorkspaceDesignProfileV1>=>Object.freeze({...value,tokens:Object.freeze({...value.tokens})});
export const WORKSPACE_DESIGN_PROFILES_V1:readonly Readonly<WorkspaceDesignProfileV1>[]=/* @__PURE__ */ Object.freeze([
 /* @__PURE__ */ profile({id:'notebook',version:'1.0.0',name:'Notebook Workspace',description:'Reiter, geordnete native Arbeitskarten und lokales Assistenzpanel.',scheme:'light',layout:'workspace',density:'comfortable',agentPresentation:'docked',graphics:'ESSENTIAL_2D',tokens:{background:'#f4f7fc',surface:'#ffffff',raised:'#f5f8fd',text:'#20314d',muted:'#61758e',line:'#e1e9f3',accent:'#267ae8',focus:'#297be3',success:'#48745f',warning:'#8d5e19',danger:'#a12f3d',radius:'12px',space:'12px',shadow:'0 3px 12px #29446c08'}}),
 /* @__PURE__ */ profile({id:'orbit',version:'1.0.0',name:'Orbit Command',description:'Dunkle Domänenleiste, ruhiger Planetenhorizont und gemeinsame Facharbeit.',scheme:'dark',layout:'workspace',density:'comfortable',agentPresentation:'docked',graphics:'ESSENTIAL_2D',tokens:{background:'#080f18',surface:'#101c2a',raised:'#172638',text:'#e6eef8',muted:'#a1b1c7',line:'#2b3d52',accent:'#84b5ff',focus:'#f6c46c',success:'#74d5b0',warning:'#ffd18b',danger:'#ffa2aa',radius:'10px',space:'12px',shadow:'0 14px 38px #00000030'}}),
 /* @__PURE__ */ profile({id:'prism',version:'1.0.0',name:'Prism Modules',description:'Registrierte Bausteine, helles Dashboardraster und explizite Bearbeitung.',scheme:'light',layout:'dashboard',density:'comfortable',agentPresentation:'chip',graphics:'ESSENTIAL_2D',tokens:{background:'#f1f6ff',surface:'#ffffff',raised:'#f7faff',text:'#20324f',muted:'#5d7191',line:'#dce7f7',accent:'#246fe5',focus:'#9349c9',success:'#287951',warning:'#93601a',danger:'#ae304c',radius:'9px',space:'14px',shadow:'0 8px 24px #4677bb0d'}}),
 /* @__PURE__ */ profile({id:'insight',version:'1.0.0',name:'Insight Motion',description:'Native Beträge, Quellen und begrenzte Datenvergleiche zuerst.',scheme:'dark',layout:'dashboard',density:'compact',agentPresentation:'docked',graphics:'ESSENTIAL_2D',tokens:{background:'#06101b',surface:'#0d1c2d',raised:'#13283d',text:'#e7f0fc',muted:'#a2b7d0',line:'#263f58',accent:'#8ea5ff',focus:'#78dce8',success:'#6edbad',warning:'#f3cb81',danger:'#ff9fae',radius:'8px',space:'10px',shadow:'0 8px 28px #00000026'}}),
 /* @__PURE__ */ profile({id:'jarvis',version:'1.0.0',name:'Jarvis Pulse',description:'Ruhiger 2D-Fokus, aktueller Beleg und derselbe lokale Assistent; kein Audio.',scheme:'dark',layout:'focus',density:'comfortable',agentPresentation:'focus',graphics:'ESSENTIAL_2D',tokens:{background:'#050f18',surface:'#0b1d2b',raised:'#112a3b',text:'#e1f6ff',muted:'#9fb8c8',line:'#254555',accent:'#62d4ff',focus:'#ffbf79',success:'#73dfbd',warning:'#ffd093',danger:'#ffadb7',radius:'11px',space:'12px',shadow:'0 12px 32px #00000030'}}),
]);
export function workspaceAppearanceClosedV1(value:unknown,keys:readonly string[]):Record<string,unknown>{
 if(!value||typeof value!=='object'||Object.getPrototypeOf(value)!==Object.prototype)throw Error('APPEARANCE_SCHEMA_DENIED');
 const fields=Object.getOwnPropertyDescriptors(value);
 if(Reflect.ownKeys(fields).length!==keys.length||keys.some(k=>!Object.hasOwn(fields,k))||Reflect.ownKeys(fields).some(k=>typeof k!=='string'||!keys.includes(k))||Object.values(fields).some(d=>!d.enumerable||!('value'in d)))throw Error('APPEARANCE_SCHEMA_DENIED');
 return value as Record<string,unknown>;
}
export function workspaceDesignProfileV1(id:unknown):Readonly<WorkspaceDesignProfileV1>{
 const value=WORKSPACE_DESIGN_PROFILES_V1.find(p=>p.id===id);if(!value)throw Error('APPEARANCE_SCHEMA_DENIED');return value;
}
export function workspaceAppearancePresetV1(id:WorkspaceDesignIdV1):WorkspaceAppearanceV1{
 const p=workspaceDesignProfileV1(id);return {schemaVersion:'pansphaira.workspace-appearance/v1',templateId:p.id,templateVersion:p.version,layout:p.layout,density:p.density,agentPresentation:p.agentPresentation,motion:'system'};
}
export const defaultWorkspaceAppearanceV1=():WorkspaceAppearanceV1=>workspaceAppearancePresetV1('notebook');
export function validateWorkspaceAppearanceV1(input:unknown):WorkspaceAppearanceV1{
 const v=workspaceAppearanceClosedV1(input,['schemaVersion','templateId','templateVersion','layout','density','agentPresentation','motion']);
 const p=workspaceDesignProfileV1(v.templateId);
 if(v.schemaVersion!=='pansphaira.workspace-appearance/v1'||v.templateVersion!==p.version||!WORKSPACE_LAYOUT_CATALOG_V1.some(layout=>layout.id===v.layout)||!['compact','comfortable','spacious'].includes(v.density as string)||!['hidden','chip','docked','floating','focus'].includes(v.agentPresentation as string)||!['system','reduced','normal'].includes(v.motion as string))throw Error('APPEARANCE_SCHEMA_DENIED');
 return {schemaVersion:'pansphaira.workspace-appearance/v1',templateId:p.id,templateVersion:p.version,layout:v.layout as WorkspaceLayoutV1,density:v.density as WorkspaceDensityV1,agentPresentation:v.agentPresentation as WorkspaceAgentPresentationV1,motion:v.motion as WorkspaceMotionV1};
}
export interface WorkspaceAppearanceWriteV1{readonly schemaVersion:'pansphaira.workspace-appearance/write/v1';readonly expectedRevision:number;readonly appearance:WorkspaceAppearanceV1;}
export function validateWorkspaceAppearanceWriteV1(input:unknown):WorkspaceAppearanceWriteV1{
 const v=workspaceAppearanceClosedV1(input,['schemaVersion','expectedRevision','appearance']);
 if(v.schemaVersion!=='pansphaira.workspace-appearance/write/v1'||!Number.isSafeInteger(v.expectedRevision)||Number(v.expectedRevision)<0||Number(v.expectedRevision)>=Number.MAX_SAFE_INTEGER)throw Error('APPEARANCE_SCHEMA_DENIED');
 return {schemaVersion:'pansphaira.workspace-appearance/write/v1',expectedRevision:Number(v.expectedRevision),appearance:validateWorkspaceAppearanceV1(v.appearance)};
}
export interface WorkspaceAppearanceReadV1{readonly schemaVersion:'pansphaira.workspace-appearance/readback/v1';readonly catalogVersion:'1.0.0';readonly revision:number;readonly appearance:WorkspaceAppearanceV1;readonly previousAppearance:WorkspaceAppearanceV1|null;readonly persisted:boolean;readonly status:'DEFAULT'|'SAVED'|'DEFAULT_UNSUPPORTED';}
export function validateWorkspaceAppearanceReadV1(input:unknown):WorkspaceAppearanceReadV1{
 const v=workspaceAppearanceClosedV1(input,['schemaVersion','catalogVersion','revision','appearance','previousAppearance','persisted','status']);
 if(v.schemaVersion!=='pansphaira.workspace-appearance/readback/v1'||v.catalogVersion!==WORKSPACE_APPEARANCE_CATALOG_VERSION_V1||!Number.isSafeInteger(v.revision)||Number(v.revision)<0||v.persisted!==(Number(v.revision)>0)||!['DEFAULT','SAVED','DEFAULT_UNSUPPORTED'].includes(v.status as string)||(v.status==='DEFAULT')!==(v.revision===0))throw Error('APPEARANCE_READBACK_DENIED');
 return {schemaVersion:'pansphaira.workspace-appearance/readback/v1',catalogVersion:WORKSPACE_APPEARANCE_CATALOG_VERSION_V1,revision:Number(v.revision),appearance:validateWorkspaceAppearanceV1(v.appearance),previousAppearance:v.previousAppearance===null?null:validateWorkspaceAppearanceV1(v.previousAppearance),persisted:v.persisted as boolean,status:v.status as WorkspaceAppearanceReadV1['status']};
}

