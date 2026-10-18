import {browserWorkspaceStringValuesV1} from "../../contracts/src/browser-shell-plugin-v1.js";
import {
  validateBrowserShellPluginV1,
  type BrowserContributionKindV1,
  type BrowserContributionV1,
  type BrowserShellPluginV1,
} from "../../contracts/src/browser-shell-plugin-v1.js";

type RenderableKind = Exclude<BrowserContributionKindV1, "ROUTE">;
export interface BrowserShellRenderFrameV1<Target> {
  readonly target: Target;
  readonly contribution: BrowserContributionV1;
  readonly signal: AbortSignal;
}
export interface BrowserShellFactoryV1<Target> {
  readonly kind: RenderableKind;
  readonly render: (frame: BrowserShellRenderFrameV1<Target>) => void | (() => void) | Promise<void | (() => void)>;
}
export interface BrowserShellFaultV1 {
  readonly pluginId: string;
  readonly outcome: "DENIED" | "RENDER_FAILED" | "DISPOSAL_FAILED";
  readonly reason: string;
}

// The registry composes only owner-supplied functions. Descriptor metadata does
// not import code, change backend grants, or sandbox trusted in-process code.
export function createBrowserShellRegistryV1<Target>(options: {
  readonly factories: ReadonlyMap<string, BrowserShellFactoryV1<Target>>;
  readonly reportFault: (fault: BrowserShellFaultV1) => void;
}) {
  const factories = new Map(options.factories);
  const plugins = new Map<string, BrowserShellPluginV1>();
  type Lifetime = { pluginId: string; controller: AbortController; dispose?: () => void };
  const lifetimes = new Map<string, Lifetime>();
  let closed = false;
  function ensureOpen() { if (closed) throw new Error("SHELL_REGISTRY_CLOSED"); }
  function fault(pluginId: string, outcome: BrowserShellFaultV1["outcome"], reason: string) {
    try { options.reportFault(Object.freeze({ pluginId, outcome, reason })); } catch { /* The diagnostic renderer has no shell-control authority. */ }
  }
  function dispose(lifetime: Lifetime) {
    lifetime.controller.abort();
    try { lifetime.dispose?.(); } catch { fault(lifetime.pluginId, "DISPOSAL_FAILED", "OWNED_DISPOSAL_FAILED"); }
  }
  function retireAll() {
    const owned = [...lifetimes.values()]; lifetimes.clear();
    for (const lifetime of owned) dispose(lifetime);
  }
  function status(pluginId: string): { readonly outcome: "REGISTERED" | "DISABLED" | "MISSING_DEPENDENCY" | "DENIED"; readonly pluginId: string } {
    type State = "REGISTERED" | "DISABLED" | "MISSING_DEPENDENCY" | "DENIED";
    const memo = new Map<string, State>(); const visiting = new Set<string>();
    function visit(id: string): State {
      const known = memo.get(id); if (known) return known;
      const plugin = plugins.get(id);
      if (!plugin) return browserWorkspaceStringValuesV1[2];
      if (!plugin.enabled) return browserWorkspaceStringValuesV1[152];
      if (visiting.has(id)) return browserWorkspaceStringValuesV1[106];
      visiting.add(id);
      let state: State = browserWorkspaceStringValuesV1[21];
      for (const dependency of plugin.needs.dependencies) {
        if (plugins.get(dependency.id)?.version !== dependency.version || visit(dependency.id) !== browserWorkspaceStringValuesV1[21]) { state = browserWorkspaceStringValuesV1[106]; break; }
      }
      visiting.delete(id); memo.set(id, state); return state;
    }
    return Object.freeze({ outcome: visit(pluginId), pluginId });
  }
  return Object.freeze({
    status,
    register(value: unknown) {
      ensureOpen();
      const checked = validateBrowserShellPluginV1(value, new Set(factories.keys()));
      if (checked.outcome === browserWorkspaceStringValuesV1[2]) { fault(browserWorkspaceStringValuesV1[58] as string, browserWorkspaceStringValuesV1[2], checked.reason); return checked; }
      const descriptor = checked.descriptor;
      if (descriptor.contributions.some(c => c.kind !== "ROUTE" && factories.get(c.factoryId)?.kind !== c.kind)) {
        fault(descriptor.id, browserWorkspaceStringValuesV1[2], browserWorkspaceStringValuesV1[163] as string);
        return { outcome: "DENIED" as const, reason: browserWorkspaceStringValuesV1[163] as string };
      }
      const existing = [...plugins.values()].flatMap(p => p.contributions);
      if (plugins.has(descriptor.id) || plugins.size >= 64 || descriptor.contributions.some(c => existing.some(e => e.id === c.id || (c.path !== null && e.path === c.path)))) {
        fault(descriptor.id, browserWorkspaceStringValuesV1[2], browserWorkspaceStringValuesV1[166] as string);
        return { outcome: "DENIED" as const, reason: browserWorkspaceStringValuesV1[166] as string };
      }
      plugins.set(descriptor.id, descriptor);
      return Object.freeze({ ...status(descriptor.id), grantedRights: Object.freeze([]) });
    },
    contributions() { return Object.freeze([...plugins.values()].flatMap(plugin=>plugin.contributions.map(contribution=>Object.freeze({...contribution,pluginId:plugin.id,state:status(plugin.id).outcome})))); },
    routes() {
      return Object.freeze([...plugins.values()].flatMap(plugin => plugin.contributions.filter(c => c.kind === "ROUTE")
        .map(c => Object.freeze({ pluginId: plugin.id, routeId: c.id, path: c.path, label: c.label, state: status(plugin.id).outcome }))));
    },
    async render(contributionId: string, target: Target) {
      ensureOpen();
      const plugin = [...plugins.values()].find(p => p.contributions.some(c => c.id === contributionId));
      const contribution = plugin?.contributions.find(c => c.id === contributionId);
      if (!plugin || !contribution || contribution.kind === "ROUTE") return { outcome: "DENIED" as const, reason: "UNKNOWN_RENDERABLE_ID" };
      const admitted = status(plugin.id); if (admitted.outcome !== browserWorkspaceStringValuesV1[21]) return admitted;
      const factory = factories.get(contribution.factoryId);
      if (!factory) return { outcome: "DENIED" as const, reason: "FACTORY_NOT_OWNED" };
      const cell = contribution.kind === "VIEW" ? contribution.slot : contribution.id;
      const old = lifetimes.get(cell); if (old) { lifetimes.delete(cell); dispose(old); }
      const lifetime: Lifetime = { pluginId: plugin.id, controller: new AbortController() };
      lifetimes.set(cell, lifetime);
      try {
        const cleanup = await factory.render(Object.freeze({ target, contribution, signal: lifetime.controller.signal }));
        if (typeof cleanup === "function") lifetime.dispose = cleanup;
        if (closed || lifetime.controller.signal.aborted || lifetimes.get(cell) !== lifetime) {
          dispose(lifetime); return { outcome: "STALE_RENDER" as const };
        }
        return { outcome: "RENDERED" as const, contributionId, grantedRights: Object.freeze([]) };
      } catch {
        if (closed || lifetime.controller.signal.aborted || lifetimes.get(cell) !== lifetime) {
          dispose(lifetime); return { outcome: "STALE_RENDER" as const };
        }
        lifetimes.delete(cell);
        dispose(lifetime); fault(plugin.id, "RENDER_FAILED", "OWNED_RENDERER_FAILED");
        return { outcome: "RENDER_FAILED" as const, pluginId: plugin.id };
      }
    },
    retireAll,
    unregister(pluginId: string) {
      ensureOpen();
      for (const [cell, lifetime] of lifetimes) if (lifetime.pluginId === pluginId) { lifetimes.delete(cell); dispose(lifetime); }
      return plugins.delete(pluginId);
    },
    close() { if (closed) return; closed = true; retireAll(); plugins.clear(); },
  });
}

// Presentation metadata is code-owned; never an installation or permission grant.
// A single versioned catalog styles known domains; every other registered route
// is still projected using its real contribution label and path.
export const WORKSPACE_PRESENTATION_CATALOG_VERSION_V1='1.0.0' as const;
export const WORKSPACE_MODULE_PRESENTATIONS_V1=Object.freeze([
 Object.freeze({key:'projects',pluginId:'pan.projects',label:'Projekte',icon:'M3 5h7l2 2h9v13H3z'}),
 Object.freeze({key:'erp',pluginId:'pan.erv',label:'ERP',icon:'M6 3h9l4 4v14H6zM14 3v5h5M9 12h7m-7 4h7'}),
 Object.freeze({key:'documents',pluginId:'pan.documents',label:'Dokumente',icon:'M5 3h10l4 4v14H5zM14 3v5h5'}),
 Object.freeze({key:'bi',pluginId:'pan.analysis',label:'BI',icon:'M4 20V11m7 9V4m7 16v-7M2 21h20'}),
 Object.freeze({key:'agent',pluginId:null,label:'Agent',icon:'M12 3v3M4 9h16v11H4zM8 13h1m6 0h1M9 17h6'}),
 Object.freeze({key:'settings',pluginId:'pan.setup',label:'Einstellungen',icon:'M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8M12 2v3m0 14v3M2 12h3m14 0h3'}),
]);
const domainNames:Readonly<Record<string,string>>=Object.freeze({'pan.erv':'Rechnungen','pan.setup':'Einrichtung','pan.analysis':'Analysen','pan.knowledge':'Wissen','pan.configuration':'Konfiguration','pan.administration':'Administration'});
export const workspaceModuleLabelV1=(pluginId:string,label:string)=>domainNames[pluginId]??label;
const extraDomains:Readonly<Record<string,{label:string;icon:string}>>=Object.freeze({'pan.knowledge':{label:'Wissen',icon:'M3 5h7l2 2 2-2h7v15h-7l-2 2-2-2H3zM12 7v15'},'pan.configuration':{label:'Konfiguration',icon:'M4 6h16M4 12h16M4 18h16M8 3v6m8 0v6M9 15v6'},'pan.setup.administration':{label:'Administration',icon:'M12 3l8 3v6c0 5-8 9-8 9s-8-4-8-9V6z'}});
export function workspaceNavigationPresentationV1(pluginId:string,contributionId:string,label:string){const known=WORKSPACE_MODULE_PRESENTATIONS_V1.find(m=>m.pluginId===pluginId);const extra=contributionId.includes('.administration.')?extraDomains['pan.setup.administration']:extraDomains[pluginId];return{label:extra?.label??domainNames[pluginId]??label,icon:extra?.icon??known?.icon??'M4 4h16v16H4z'};}
function icon(path:string){const s=document.createElementNS('http://www.w3.org/2000/svg','svg'),p=document.createElementNS('http://www.w3.org/2000/svg','path');s.setAttribute('viewBox','0 0 24 24');s.setAttribute('aria-hidden','true');p.setAttribute('d',path);s.append(p);return s;}
function element<K extends keyof HTMLElementTagNameMap>(kind:K,label=''){const e=document.createElement(kind);e.textContent=label;return e;}
export interface WorkspaceNavigationCompositionV1{readonly items:readonly {readonly id:string;readonly visible:boolean;readonly size:string}[];readonly configured:boolean;readonly ready:boolean;readonly token:string;readonly label?:string;readonly project?:(native:readonly HTMLButtonElement[],defaults:readonly HTMLButtonElement[],plus:HTMLButtonElement)=>readonly HTMLButtonElement[];}
// The projector is trusted code from the existing lazy appearance asset, never
// persisted profile data/code. Keeping it there retains the original app bound.
export function setWorkspaceNavigationCompositionV1(nav:HTMLElement,value:WorkspaceNavigationCompositionV1){const projection={...value,label:value.ready?'Registrierte Module und Karten auswählen':'Auswahl nicht verfügbar',project(native:readonly HTMLButtonElement[],defaults:readonly HTMLButtonElement[],plus:HTMLButtonElement){if(!value.configured){for(const b of native){b.hidden=false;delete b.dataset.compositionSize;}return defaults;}const order=new Map(value.items.map((item,index)=>[item.id,{...item,index}]));for(const b of native){const id=b.dataset.workspaceContribution??'',item=order.get(id);b.hidden=!(item?.visible||id==='pan.setup.navigation'||id==='pan.erv.navigation');b.dataset.compositionSize=item?.size??'regular';}return[...[...native].sort((a,b)=>(order.get(a.dataset.workspaceContribution??'')?.index??32)-(order.get(b.dataset.workspaceContribution??'')?.index??32)),...defaults.filter(b=>b.dataset.referenceModule==='agent'),plus];}};Object.defineProperty(nav,Symbol.for('pansphaira.workspace-navigation-composition/v1'),{value:Object.freeze(projection),writable:true,configurable:true});composeWorkspaceNavigationV1(nav);}
export function composeWorkspaceNavigationV1(nav:HTMLElement){
 const personal=Object.getOwnPropertyDescriptor(nav,Symbol.for('pansphaira.workspace-navigation-composition/v1'))?.value as WorkspaceNavigationCompositionV1|undefined;
 const native=[...nav.querySelectorAll<HTMLButtonElement>('button[data-workspace-module]')],byPlugin=new Map<string|undefined,HTMLButtonElement>(),used=new Set<HTMLButtonElement>(),result:HTMLButtonElement[]=[];for(const b of native){delete b.dataset.referenceModule;if(!byPlugin.has(b.dataset.workspacePlugin))byPlugin.set(b.dataset.workspacePlugin,b);}
 for(const item of WORKSPACE_MODULE_PRESENTATIONS_V1){let b=item.pluginId?native.find(n=>n.dataset.workspaceContribution===item.pluginId+'.navigation')??byPlugin.get(item.pluginId):undefined;
  if(b){used.add(b);}
  else{b=element('button');b.type='button';b.disabled=true;b.setAttribute('aria-label',item.label+' — Noch nicht angebunden');const l=element('span',item.label);l.className='nav-label';const hint=element('small','Noch nicht angebunden');hint.className='nav-binding-state';b.append(icon(item.icon),l,hint);if(item.key==='agent'){b.dataset.workspaceView='ASSISTANT';b.setAttribute('aria-label','Vorhandene lokale Assistenz über Agent-Register öffnen');}else b.dataset.unboundCapability='true';}
  b.className='workspace-nav-item';b.dataset.referenceModule=item.key;result.push(b);
 }
 const plus=element('button','+');plus.type='button';plus.disabled=!personal?.ready;plus.className='workspace-add-module';plus.dataset.workspaceCompositionOpen='true';plus.setAttribute('aria-label',personal?.label??'Auswahl nicht verfügbar');result.push(plus);
 for(const b of native)if(!used.has(b))result.push(b);
 if(personal?.project)result.splice(0,result.length,...personal.project(native,result,plus));
 nav.dataset.compositionNavigation=String(!!personal?.configured);nav.dataset.profileCompositionStamp=personal?.token??'';nav.replaceChildren(...result);
 const sidebar=document.querySelector('.workspace-module-links');if(!sidebar)return;
 const items:HTMLElement[]=[];
 for(const b of result){if(b===plus||b.dataset.referenceModule==='projects')continue;const path=b.dataset.workspaceModule;const key=b.dataset.referenceModule,label=b.querySelector('.nav-label')?.textContent??b.textContent??'Modul';let e:HTMLButtonElement|HTMLAnchorElement;
  if(path&&key!=='bi'){e=element('a');e.href='#'+path;e.dataset.workspaceModuleLink=path;e.setAttribute('aria-label',key==='erp'?'Vorhandene ERP-Rechnungsprüfung über die Seitenleiste öffnen':key==='settings'?'Vorhandene Einstellungen über die Seitenleiste öffnen':label+' über die Seitenleiste öffnen');}
  else{e=element('button');e.type='button';e.disabled=b.disabled;if(path)e.dataset.workspaceModuleAction=path;else if(key==='agent'){e.dataset.workspaceView='ASSISTANT';e.setAttribute('aria-label','Lokale Assistenz über die Seitenleiste öffnen');}else e.setAttribute('aria-label',label+' — Noch nicht angebunden');}
  e.hidden=b.hidden;if(path)e.dataset.workspaceCompositionId=b.dataset.workspaceContribution??'';if(b.dataset.compositionSize)e.dataset.compositionSize=b.dataset.compositionSize;const svg=b.querySelector('svg');if(svg)e.append(svg.cloneNode(true));const l=element('span',label);if(b.disabled&&key!=='agent'){const hint=element('small','Noch nicht angebunden');l.append(hint);}e.append(l);if(key==='bi'){if(b.disabled)e.setAttribute('aria-label','BI — Noch nicht angebunden');if(!l.querySelector('small'))l.append(element('small','Nur lesen'));}items.push(e);
 }
 sidebar.replaceChildren(...items);
}
export type WorkspaceCardRoleV1='summary'|'decision'|'references'|'provenance'|'view'|'context'|'actions';
export interface WorkspaceCardContributionV1{readonly id:string;readonly label:string;readonly role:WorkspaceCardRoleV1;readonly required:boolean;}
// Symbol identity is shared across the existing separately bundled ESM assets.
// Same trusted-process boundary as the native registry; it grants no rights.
const cardSymbol=Symbol.for('pansphaira.workspace-card-presentation/v1');
type CardCell={readonly metadata:Readonly<WorkspaceCardContributionV1>;readonly signal:AbortSignal};
export function registerWorkspaceCardV1(node:HTMLElement,metadata:WorkspaceCardContributionV1,signal:AbortSignal){
 if(!/^pan\.[a-z][a-z0-9.-]{1,95}$/.test(metadata.id)||!metadata.label||metadata.label.length>96||!['summary','decision','references','provenance','view','context','actions'].includes(metadata.role)||typeof metadata.required!=='boolean'||signal.aborted)throw Error('WORKSPACE_CARD_PRESENTATION_DENIED');
 const cell:CardCell=Object.freeze({metadata:Object.freeze({...metadata}),signal});Object.defineProperty(node,cardSymbol,{value:cell});node.dataset.workspaceCardId=metadata.id;node.dataset.cardRole=metadata.role;node.dataset.requiredPresentation=String(metadata.required);
}
export function workspaceCardsV1(root:HTMLElement){
 const result:Array<{readonly node:HTMLElement;readonly metadata:Readonly<WorkspaceCardContributionV1>}>=[];
 for(const node of root.querySelectorAll<HTMLElement>('[data-workspace-card-id]')){const cell=Object.getOwnPropertyDescriptor(node,cardSymbol)?.value as CardCell|undefined;if(cell&&!cell.signal.aborted&&node.isConnected&&(node.childElementCount>0))result.push(Object.freeze({node,metadata:cell.metadata}));}
 return Object.freeze(result);
}

