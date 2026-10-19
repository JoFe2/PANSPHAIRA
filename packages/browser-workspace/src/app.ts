import {composeWorkspaceNavigationV1,workspaceModuleLabelV1,workspaceNavigationPresentationV1} from '../../browser-shell/src/registry-v1.js';
import {browserWorkspaceStringValuesV1} from "../../contracts/src/browser-shell-plugin-v1.js";
import { createBrowserContextOwnerV1, type BrowserContextV1 } from "../../browser-shell/src/context-owner-v1.js";
import { createBrowserShellRegistryV1, type BrowserShellFactoryV1 } from "../../browser-shell/src/registry-v1.js";
import { parseBrowserDeepLinkV1, buildBrowserDeepLinkV1, type BrowserDeepLinkV1 } from "../../browser-shell/src/deep-link-v1.js";
import type { BrowserErvReadV1 } from "../../contracts/src/browser-erv-read-v1.js";
import { setupPluginV1, createSetupViewV1 } from "./plugin-setup-v1.js";
import { ervPluginV1, createErvViewV1, createErvPanelV1, createErvActionV1 } from "./plugin-erv-v1.js";
import { diagnosticPluginsV1, diagnosticFailingViewV1 } from "./plugin-diagnostics-v1.js";
import { configurationDraftPluginV1, createConfigurationDraftViewV1 } from "./plugin-configuration-draft-v1.js";
import { text, type WorkspaceViewApiV1 } from "./api-v1.js";
import { createWorkspaceProfileEditorV1 } from "./profile-editor-v1.js";
import type { BrowserProfileReadV1 } from "../../contracts/src/browser-profile-v1.js";
import { createWorkspaceNotificationsV1 } from "./notifications-v1.js";
import {knowledgePluginV1} from "./plugin-knowledge-v1.js";
import { analysisPluginV1, createAnalysisViewV1 } from "./plugin-analysis-v1.js";
import { createWorkspaceContextSelectionV1 } from "./context-selection-v1.js";
import type { createWorkspaceModuleViewEditorV1 } from "./module-view-editor-v1.js";
import type {WorkspaceDirtyDraftV1,WorkspaceNavigationDriverV1} from './workspace-dirty-draft-v1.js';
import type {WorkspaceNavigationNativeReadbackV1} from '../../contracts/src/workspace-invoice-navigation-v1.js';
import type {WorkspaceNativeNavigationFrameV1} from './workspace-invoice-navigation-v1.js';

const element = (id: string): HTMLElement => { const node = document.getElementById(id); if (!node) throw new Error("SHELL_SLOT_MISSING"); return node; };
async function start() {
  const scope = /^\/t\/([a-z0-9][a-z0-9-]{0,63})\/workspace$/.exec(location.pathname); if (!scope) throw new Error("WORKSPACE_ROUTE_DENIED");
  const base = "/t/" + scope[1]; const main = element(browserWorkspaceStringValuesV1[17] as string); const panel = element(browserWorkspaceStringValuesV1[218] as string); const actions = element(browserWorkspaceStringValuesV1[215] as string); const nav = element(browserWorkspaceStringValuesV1[37] as string); const widget = element(browserWorkspaceStringValuesV1[119] as string);
  const lifetime = new AbortController(); let invoice: BrowserErvReadV1 | null = null; let link: BrowserDeepLinkV1 | null = null;
  const taskMode=element('workspace.mode-task')as HTMLButtonElement,assistantMode=element('workspace.mode-assistant')as HTMLButtonElement;document.body.dataset.mobileWorkArea='TASK';assistantMode.disabled=true;
  function mobileArea(area:'TASK'|'ASSISTANT',focus=true){if(area==='ASSISTANT'&&!document.getElementById('shell.agent-panel'))area='TASK';document.body.dataset.mobileWorkArea=area;taskMode.setAttribute('aria-pressed',String(area==='TASK'));assistantMode.setAttribute('aria-pressed',String(area==='ASSISTANT'));if(!focus)return;if(area==='TASK'&&!main.hidden)main.focus({preventScroll:true});else document.getElementById('shell.agent-panel')?.querySelector<HTMLElement>('.agent-title')?.focus({preventScroll:true});}
  taskMode.addEventListener('click',()=>mobileArea('TASK'),{signal:lifetime.signal});assistantMode.addEventListener('click',()=>mobileArea('ASSISTANT'),{signal:lifetime.signal});
  let profileEditor: Awaited<ReturnType<typeof createWorkspaceProfileEditorV1>> | null = null;
  let presentation: BrowserProfileReadV1 | null = null; let panelEpoch = 0;
  let notifications: ReturnType<typeof createWorkspaceNotificationsV1> | null = null;
  let navigation:WorkspaceNavigationDriverV1|null=null,targetTransition=false,acceptedHash=location.hash||browserWorkspaceStringValuesV1[90] as string;
  let surfacesV2:ReturnType<typeof import('./workspace-surfaces-v2.js').createWorkspaceSurfacesV2>|null=null;
  const draftOwners=new Set<WorkspaceDirtyDraftV1>();
  const canvas = element("profile.canvas");
  const assistantHost=element('workspace.assistant-host');
  function fitAssistantDock(){if(lifetime.signal.aborted)return;const root=assistantHost.querySelector<HTMLElement>('[id="shell.agent-panel"]'),visible=!!root?.getClientRects().length;
    // Project the existing owned information slot; never clone it or create a second owner.
    if(visible&&!panel.hidden&&panel.parentElement!==assistantHost)assistantHost.append(panel);
    else if(!visible&&panel.parentElement===assistantHost){const order=presentation?.profile.items??[],index=order.findIndex(item=>cards.get(item.id)===panel),next=order.slice(index+1).map(item=>cards.get(item.id)).find(node=>node?.parentElement===canvas);canvas.insertBefore(panel,next??null);}
    // The assistant aligns with the workspace, not the invoice below its heading/tabs.
    if(!visible||!root)return;if(assistantHost.style.getPropertyValue('--workspace-assistant-offset')!=='0px')assistantHost.style.setProperty('--workspace-assistant-offset','0px');
    const available=Math.max(180,window.innerHeight-Math.max(0,root.getBoundingClientRect().top)-12),height=Math.floor(available)+'px';if(assistantHost.style.getPropertyValue('--workspace-assistant-height')!==height)assistantHost.style.setProperty('--workspace-assistant-height',height);
  }
  const dockObserver=new ResizeObserver(()=>requestAnimationFrame(fitAssistantDock));for(const e of [document.querySelector('.product-header'),document.querySelector('.workspace-module-strip'),document.querySelector('.workspace-workarea')])if(e)dockObserver.observe(e);window.addEventListener('resize',()=>requestAnimationFrame(fitAssistantDock),{signal:lifetime.signal});window.addEventListener('scroll',()=>requestAnimationFrame(fitAssistantDock),{passive:true,signal:lifetime.signal});lifetime.signal.addEventListener('abort',()=>dockObserver.disconnect(),{once:true}); const boundary = element(browserWorkspaceStringValuesV1[113] as string);
  const cards=new Map([...canvas.children].filter((node):node is HTMLElement=>node instanceof HTMLElement&&!!node.id).map(node=>[node.dataset.profileContribution??node.id,node]));
  async function renderPanel() {
    const epoch = ++panelEpoch;
    const visible = presentation?.effectiveItems.some(i => i.id === browserWorkspaceStringValuesV1[13] && i.visible);
    const knowledge=link?.path==="/workspace/knowledge"&&document.body.dataset.ownerKnowledgeExplorer==="true";
    if (!visible || (!invoice&&!knowledge)) { panel.hidden = true; panel.replaceChildren(); return; }
    panel.hidden = false;
    const result = await registry.render(knowledge?"pan.knowledge.context":browserWorkspaceStringValuesV1[13] as string, panel);
    if (epoch !== panelEpoch || (!invoice&&!knowledge)) return;
    if (result.outcome !== browserWorkspaceStringValuesV1[118]) { panel.hidden = true; panel.replaceChildren(); }
    fitAssistantDock();
  }
  function applyPresentation(value: BrowserProfileReadV1) {
    const configurationFocus = document.body.dataset.ownerConfigurationDrafts === "true" && document.activeElement instanceof HTMLElement && document.activeElement.closest(".configuration-draft") ? document.activeElement : null;
    presentation = value;
    const protectedCompositionOwner=value.catalog.some(c=>c.id==='pan.setup.navigation'&&c.state==='AVAILABLE');
    for (const [id, node] of cards) {
      const item = value.effectiveItems.find(i => i.id === id);
      node.classList.remove("profile-compact", "profile-regular", "profile-large");
      if (item) node.classList.add("profile-" + item.size);
      node.hidden = !item?.visible || (id === browserWorkspaceStringValuesV1[13] && !invoice && link?.path!=="/workspace/knowledge");
      if(protectedCompositionOwner&&['shell.main','shell.widgets','pan.workspace.boundary'].includes(id))node.hidden=false;
    }
    // MAIN is the stable native analysis attachment. Reorder the other cards
    // around it, and do not manufacture removal/reinsert records for an
    // unchanged profile. Permanent retirement of genuinely removed roots stays.
    let next: ChildNode | null = null;
    for (const item of [...value.profile.items].reverse()) {
      const card = cards.get(item.id); if (!card) continue;
      if(card===panel&&panel.parentElement===assistantHost)continue;
      if (card !== main && (card.parentNode !== canvas || card.nextSibling !== next)) canvas.insertBefore(card, next);
      next = card;
    }
    const size = value.effectiveItems.find(i => i.id === browserWorkspaceStringValuesV1[13])?.size ?? browserWorkspaceStringValuesV1[14];
    canvas.classList.remove("panel-compact", "panel-regular", "panel-large"); canvas.classList.add("panel-" + size);
    canvas.classList.toggle(browserWorkspaceStringValuesV1[187] as string, !panel.hidden);
    void renderPanel();
    if (configurationFocus?.isConnected && !main.hidden) configurationFocus.focus({ preventScroll: true });
  }
  const skip = document.querySelector<HTMLAnchorElement>(".skip-link"); if (!skip) throw new Error("SHELL_SKIP_LINK_MISSING");
  skip.addEventListener("click", event => { event.preventDefault(); if (main.hidden) element(browserWorkspaceStringValuesV1[199] as string).querySelector<HTMLButtonElement>(browserWorkspaceStringValuesV1[1] as string)?.focus(); else main.focus(); }, { signal: lifetime.signal });
  async function get(path: string, signal?: AbortSignal) {
    const response = await fetch(base + path, { credentials: browserWorkspaceStringValuesV1[6], cache: browserWorkspaceStringValuesV1[7], ...(signal ? { signal } : {}) });
    return { status: response.status, value: response.status === 200 ? await response.json() as unknown : null };
  }
  const bootstrap = await get(browserWorkspaceStringValuesV1[18] as string); if (bootstrap.status !== 200) throw new Error("WORKSPACE_SESSION_DENIED");
  const owner = createBrowserContextOwnerV1({ initialContext: bootstrap.value as BrowserContextV1, async readBackend(context, signal) {
    const expected = link; const fresh = await get(browserWorkspaceStringValuesV1[18] as string, signal);
    const current = fresh.value as BrowserContextV1 | null;
    if (fresh.status !== 200 || current?.tenantId !== context.tenantId || current.sessionId !== context.sessionId) return { status: 401, value: null };
    const query = new URLSearchParams(); if (context.objectId !== null) { query.set(browserWorkspaceStringValuesV1[5] as string, context.objectId); if (expected?.revision !== null && expected?.revision !== undefined) query.set(browserWorkspaceStringValuesV1[3] as string, String(expected.revision)); }
    const response = await get(context.objectId === null ? "/api/status" : "/workspace/erv?" + query.toString(), signal);
    const after = await get(browserWorkspaceStringValuesV1[18] as string, signal); const binding = after.value as BrowserContextV1 | null;
    if (after.status !== 200 || binding?.tenantId !== context.tenantId || binding.sessionId !== context.sessionId) return { status: 401, value: null };
    return response;
  } });
  const contextSelection = document.body.dataset.ownerContextSelection === "true"
    ? createWorkspaceContextSelectionV1({ root: element("shell.context-selection"), base, context: owner.context, signal: lifetime.signal }) : null;
  if(document.body.dataset.ownerAdministration==='true'&&document.body.dataset.ownerAgentRuns!=='true'&&contextSelection)void import(base+'/workspace/administration/app.js').then(async module=>{if(!lifetime.signal.aborted){await module.mountWorkspaceAdministrationManualPanelV1({container:element("workspace.assistant-host"),context:contextSelection,signal:lifetime.signal});if(!lifetime.signal.aborted)assistantMode.disabled=!document.getElementById('shell.agent-panel');syncWorkspaceNavigation();}}).catch(()=>{if(!lifetime.signal.aborted)canvas.append(text('p','Gemeinsames Manuellpanel nicht verfügbar; Einrichtung, Fachnavigation und Abmelden bleiben unabhängig.'));});
  let moduleViewEditor: ReturnType<typeof createWorkspaceModuleViewEditorV1> | null = null;
  let workspaceArea='TASK';
  function composeReferenceModules(){composeWorkspaceNavigationV1(nav);}
  function syncWorkspaceNavigation(){requestAnimationFrame(fitAssistantDock);for(const a of document.querySelectorAll<HTMLAnchorElement>('a[data-workspace-module-link]')){const path=a.dataset.workspaceModuleLink,b=[...nav.querySelectorAll<HTMLButtonElement>('button[data-workspace-module]')].find(e=>e.dataset.workspaceModule===path);a.hidden=!b||b.disabled||b.hidden||lifetime.signal.aborted;if(path===link?.path)a.setAttribute('aria-current','page');else a.removeAttribute('aria-current');}
    for(const b of document.querySelectorAll<HTMLButtonElement>('button[data-workspace-module-action]')){const target=[...nav.querySelectorAll<HTMLButtonElement>('button[data-workspace-module]')].find(e=>e.dataset.workspaceModule===b.dataset.workspaceModuleAction),available=!lifetime.signal.aborted&&!!target&&!target.disabled;b.hidden=!!target?.hidden;b.disabled=!available;const hint=b.querySelector('small');if(hint)hint.textContent=available?'Nur lesen':'Noch nicht angebunden';b.setAttribute('aria-label',available?'Vorhandene gebundene Bestandsanalyse über die Seitenleiste öffnen':'BI — Noch nicht angebunden');if(available&&b.dataset.workspaceModuleAction===link?.path)b.setAttribute('aria-current','page');else b.removeAttribute('aria-current');}
    const live=!lifetime.signal.aborted,hasSource=!!main.querySelector('.erv-source-details'),hasAssistant=!!document.getElementById('shell.agent-panel'),hasPersonalView=!!moduleViewEditor?.frame()||!!profileEditor;const sessionLabel=document.getElementById('workspace.session-label'),sessionState=document.getElementById('workspace.session-state');if(sessionLabel&&sessionState){if(!live){sessionLabel.textContent='Sitzung beendet';sessionState.textContent='Abgemeldet';}else{try{sessionLabel.textContent='Mandant '+owner.context().tenantId;sessionState.textContent='Geschützte Sitzung';}catch{sessionLabel.textContent='Lokale Sitzung';sessionState.textContent='Nicht bestätigt';}}}
    for(const b of document.querySelectorAll<HTMLButtonElement>('button[data-workspace-view]')){const key=b.dataset.workspaceView;b.disabled=!live||(key==='ASSISTANT'?!hasAssistant||assistantMode.disabled:key==='PROFILE'?!hasPersonalView:key==='SOURCES'?!hasSource:key==='CONTEXT'?!contextSelection:main.hidden);b.setAttribute('aria-pressed',String(key===workspaceArea));if(b.closest('.workspace-module-tools'))b.hidden=key==='ASSISTANT'?!hasAssistant:key==='PROFILE'?!hasPersonalView:!hasSource;if(key==='CONTEXT'){const card=b.closest<HTMLElement>('.erv-context-card');if(card)card.hidden=!contextSelection;}if(b.dataset.referenceModule==='agent'){const s=b.querySelector('.nav-binding-state');if(s)s.textContent=hasAssistant?'Lokal':'Noch nicht angebunden';}}
    const label=document.getElementById('workspace.sidebar-context'),object=document.getElementById('workspace.sidebar-object');if(label)label.textContent=element('workspace.section-name').textContent;if(object)object.textContent=invoice?.invoiceId??'Bereich ohne ausgewählten Beleg';
  }
  document.addEventListener('click',event=>{const moduleAction=(event.target as Element|null)?.closest<HTMLButtonElement>('button[data-workspace-module-action]');if(moduleAction){if(moduleAction.disabled||lifetime.signal.aborted)return;const target=[...nav.querySelectorAll<HTMLButtonElement>('button[data-workspace-module]')].find(e=>e.dataset.workspaceModule===moduleAction.dataset.workspaceModuleAction);if(target&&!target.disabled)target.click();return;}const b=(event.target as Element|null)?.closest<HTMLButtonElement>('button[data-workspace-view]');if(!b||b.disabled||lifetime.signal.aborted)return;const key=b.dataset.workspaceView;workspaceArea=key??'TASK';if(key==='ASSISTANT')mobileArea('ASSISTANT');else{mobileArea('TASK');if(key==='PROFILE'){if(!moduleViewEditor?.openManual()){const d=element('workspace.profile-details')as HTMLDetailsElement;d.open=true;d.querySelector<HTMLElement>('summary')?.focus();}}else if(key==='SOURCES'){const d=main.querySelector<HTMLDetailsElement>('.erv-source-details');if(d){d.open=true;d.scrollIntoView({block:'nearest'});d.querySelector<HTMLElement>('summary')?.focus();}}else if(key==='CONTEXT'){const d=element('workspace.context-details')as HTMLDetailsElement;d.open=true;d.querySelector<HTMLElement>('summary')?.focus();}else main.focus({preventScroll:true});}syncWorkspaceNavigation();},{signal:lifetime.signal});
  function mountWorkspaceTabs(target:HTMLElement){const template=document.getElementById('workspace.context-tabs-template')as HTMLTemplateElement|null;if(!template)return;const tabs=template.content.cloneNode(true);element('workspace.context-nav').replaceChildren(tabs);syncWorkspaceNavigation();}
  // Optional editor transport never gates the shared registry, navigation or logout.
  const moduleViewReady = document.body.dataset.ownerModuleViews === "true" && contextSelection
    ? import(base+"/workspace/module-view/app.js").then(module=>{
      if(lifetime.signal.aborted)return null;
      const editor=module.createWorkspaceModuleViewEditorV1({main,context:contextSelection,signal:lifetime.signal});moduleViewEditor=editor;editor.subscribeFrame(syncWorkspaceNavigation);
      if(document.body.dataset.ownerAgentRuns==="true")void import(base+"/workspace/agent-run/app.js")
        .then(module=>{if(!lifetime.signal.aborted){module.createWorkspaceAgentPanelV1({container:element("workspace.assistant-host"),context:contextSelection,editor,signal:lifetime.signal,showTask:()=>mobileArea('TASK'),openInfo:()=>{mobileArea('TASK');api.openInvoicePanel();}});assistantMode.disabled=false;syncWorkspaceNavigation();}})
        .catch(()=>{if(!lifetime.signal.aborted){assistantMode.disabled=true;mobileArea('TASK');canvas.append(text('p','Auftragspanel nicht verfügbar. Kein Lauf bestätigt; Fachnavigation, Profile und Abmelden bleiben unabhängig.'));}});
      return editor;
    }).catch(()=>{if(!lifetime.signal.aborted)canvas.append(text("p","Persönliche Modulansicht nicht verfügbar. Kein gespeicherter Effekt oder Auftrag bestätigt; andere Module und Abmelden bleiben unabhängig."));return null;}) : Promise.resolve(null);
  if (document.body.dataset.ownerHumanDecisions === "true" && contextSelection) void import(base+"/workspace/erv-human/app.js")
    .then(module=>{if(!lifetime.signal.aborted)module.createWorkspaceErvHumanV1({main,context:contextSelection,signal:lifetime.signal,refreshNativeSources:()=>moduleViewEditor?.refreshNativeSources()??Promise.resolve(false)});})
    .catch(()=>{if(!lifetime.signal.aborted)main.append(text('p','Native Human-Browserkontrollen nicht verfügbar. Keine Fachentscheidung bestätigt; andere Module und Abmelden bleiben unabhängig.'));});
  let registry: ReturnType<typeof createBrowserShellRegistryV1<HTMLElement>>;
  const api: WorkspaceViewApiV1 = Object.freeze({ context: owner.context, read: owner.read, invoice: () => invoice,
    rememberInvoice(value: BrowserErvReadV1) { invoice = value; document.body.dataset.nativeRevision = String(value.revision); },
    openInvoicePanel() { void (async () => {
      await profileEditor?.refreshAuthority();
      const fresh = await owner.read();
      if (fresh.outcome !== browserWorkspaceStringValuesV1[20] || !invoice) { panel.hidden = true; panel.replaceChildren(); return; }
      if (profileEditor?.setVisible(browserWorkspaceStringValuesV1[13] as string)) { await renderPanel(); if (!panel.hidden) panel.focus(); }
    })(); },
  });
  const diagnostic = document.body.dataset.ownerDiagnosticPlugins === "true" ? diagnosticPluginsV1() : null;
  const configurationEnabled = document.body.dataset.ownerConfigurationDrafts === "true";
  const analysisEnabled = document.body.dataset.ownerAnalysisReader === "true";
  const plugins = [document.body.dataset.ownerAdministration==="true"?setupPluginV1:{...setupPluginV1,contributions:setupPluginV1.contributions.filter(c=>!c.id.startsWith("pan.setup.administration."))}, ervPluginV1]; if (analysisEnabled) plugins.push(analysisPluginV1); if(document.body.dataset.ownerKnowledgeExplorer==="true"&&contextSelection)plugins.push(knowledgePluginV1); if (configurationEnabled) plugins.push(configurationDraftPluginV1); if (diagnostic) plugins.push(diagnostic.broken, diagnostic.disabled, diagnostic.missing);
  const diagnosticStates: string[] = [];
  function showStates(message: string,critical=false) {
    widget.dataset.critical=String(critical);const details=document.createElement('details');details.className='workspace-connection-details';details.open=critical;details.append(text('summary',critical?'Verbindung prüfen':'Verbindung & Status'),text('p',message));widget.replaceChildren(details);
    if(diagnosticStates.length){const list=document.createElement('ul');for(const state of diagnosticStates)list.append(text('li',state));details.append(list);}
  }
  const factories = new Map<string, BrowserShellFactoryV1<HTMLElement>>([
    [browserWorkspaceStringValuesV1[112] as string, createSetupViewV1(api)], [browserWorkspaceStringValuesV1[30] as string, createErvViewV1(api)], [browserWorkspaceStringValuesV1[13] as string, createErvPanelV1(api)], [browserWorkspaceStringValuesV1[75] as string, createErvActionV1(api)],
  ]);
  if(document.body.dataset.ownerKnowledgeExplorer==="true"&&contextSelection){for(const kind of ["VIEW","PANEL"] as const){factories.set(kind==="VIEW"?"pan.knowledge.view":"pan.knowledge.context",{kind,async render({target,signal}){target.append(text("p","Wissensexplorer wird geladen …"));const module=await import(base+"/workspace/knowledge/app.js");if(!signal.aborted&&target.isConnected)module[kind==="VIEW"?"renderWorkspaceKnowledgeViewV1":"renderWorkspaceKnowledgePanelV1"]({target,signal,context:contextSelection,profile:()=>profileEditor,selected:()=>link?.path,renderPanel});}});}}
  if(document.body.dataset.ownerAdministration==='true'&&contextSelection)factories.set('pan.setup.administration.view',{kind:'VIEW',async render({target,signal}){target.append(text('p','Geschützte Administration wird geladen …'));const module=await import(base+'/workspace/administration/app.js');if(!signal.aborted&&target.isConnected)module.renderWorkspaceAdministrationV1({target,signal,context:contextSelection});}});
  if (diagnostic) for (const p of [diagnostic.broken, diagnostic.disabled, diagnostic.missing, diagnostic.incompatible]) factories.set(p.id + ".view", diagnosticFailingViewV1);
  if (configurationEnabled) factories.set(browserWorkspaceStringValuesV1[110] as string, createConfigurationDraftViewV1(owner.context,draft=>{draftOwners.add(draft);return()=>draftOwners.delete(draft);},contextSelection));
  if(configurationEnabled&&contextSelection&&document.body.dataset.ownerConfigurationApplication==='true'){const original=factories.get(browserWorkspaceStringValuesV1[30] as string)!;factories.set(browserWorkspaceStringValuesV1[30] as string,{kind:'VIEW',async render(o){await original.render(o);if(o.signal.aborted)return;const m=await import(base+'/workspace/configuration-editor/app.js');if(!o.signal.aborted&&o.target.isConnected)m.renderConfiguredErvReferenceV1({...o,context:contextSelection});}});}
  if (analysisEnabled) factories.set(browserWorkspaceStringValuesV1[109] as string, createAnalysisViewV1({ base, context: owner.context, selected: () => link }));
  for (const plugin of plugins) for (const c of plugin.contributions) if (c.kind === browserWorkspaceStringValuesV1[12]) {
    const route = plugin.contributions.find(r => r.kind === "ROUTE" && r.id === c.routeId);
    factories.set(c.factoryId, { kind: browserWorkspaceStringValuesV1[12], render({ target, signal }) {
      const appearance=workspaceNavigationPresentationV1(plugin.id,c.id,c.label);
      const button=text('button','')as HTMLButtonElement;button.type='button';button.setAttribute('aria-label',c.label);button.title=c.label;button.className='workspace-nav-item';button.dataset.workspaceModule=route?.path??'diagnostic';const icon=document.createElementNS('http://www.w3.org/2000/svg','svg');icon.setAttribute('viewBox','0 0 24 24');icon.setAttribute('aria-hidden','true');const line=document.createElementNS('http://www.w3.org/2000/svg','path');line.setAttribute('d',appearance.icon);icon.append(line);const label=text('span',appearance.label);label.className='nav-label';button.append(icon,label);
      if (route?.path === link?.path) button.setAttribute("aria-current", "page");
      button.dataset.workspacePlugin=plugin.id;button.dataset.workspaceContribution=c.id;
      button.disabled = registry.status(plugin.id).outcome !== browserWorkspaceStringValuesV1[21];
      button.addEventListener("click", () => { if (route?.path) location.hash = "#" + route.path; }, { signal }); target.append(button);
    } });
  }
  registry = createBrowserShellRegistryV1({ factories, reportFault(fault) { showStates("Pluginfehler: " + fault.outcome + ". Andere Module und Abmelden bleiben bedienbar.",true); } });
  for (const plugin of plugins) {
    const result = registry.register(plugin);
    if ([setupPluginV1.id, ervPluginV1.id, ...(analysisEnabled ? [analysisPluginV1.id] : [])].includes(plugin.id) && result.outcome !== browserWorkspaceStringValuesV1[21]) throw new Error("WORKSPACE_PLUGIN_REGISTRATION_DENIED");
    if (result.outcome === browserWorkspaceStringValuesV1[152]) diagnosticStates.push("Deaktiviert: " + plugin.id);
    if (result.outcome === browserWorkspaceStringValuesV1[106]) diagnosticStates.push("Fehlende Pflichtabhängigkeit: " + plugin.id);
  }
  if (diagnostic) {
    const result = registry.register(diagnostic.incompatible);
    if (result.outcome !== browserWorkspaceStringValuesV1[2] || !(browserWorkspaceStringValuesV1[83] in result) || result.reason !== browserWorkspaceStringValuesV1[196]) throw new Error("DIAGNOSTIC_VERSION_DENIAL_MISSING");
    diagnosticStates.push("Inkompatible Shellversion: " + diagnostic.incompatible.id);
  }
  if(document.body.dataset.ownerAppearanceV1==='true')void import(base+'/workspace/appearance/app.js').then(module=>{if(lifetime.signal.aborted)return;const appearance=module.createWorkspaceAppearanceEditorV1({base,sessionId:owner.context().sessionId,signal:lifetime.signal,main,nav,assistantHost,context:owner.context,routes:()=>registry.routes(),openEditor(){if(moduleViewEditor?.openManual())return true;const d=element('workspace.profile-details')as HTMLDetailsElement;d.open=true;d.querySelector<HTMLElement>('summary')?.focus();return !!profileEditor;},openInfo:api.openInvoicePanel,primaryArea:(area:'TASK'|'ASSISTANT')=>mobileArea(area,false),changed:syncWorkspaceNavigation,denied(){if(lifetime.signal.aborted)return;contextSelection?.close();owner.close();registry.close();lifetime.abort();main.hidden=false;main.replaceChildren(text('h1','Zugriff nicht bestätigt'),text('p','Sitzungsbindung nicht mehr aktuell. Alte Inhalte und Bedienung wurden verworfen; kein gespeicherter Erfolg behauptet.'));}});draftOwners.add(appearance);lifetime.signal.addEventListener('abort',()=>draftOwners.delete(appearance),{once:true});}).catch(()=>{if(!lifetime.signal.aborted)widget.append(text('p','Designprofile nicht verfügbar. Notebook, native Arbeit und Abmelden bleiben unabhängig.'));});
  if (document.body.dataset.ownerNotifications === "true") notifications = createWorkspaceNotificationsV1({ root: element(browserWorkspaceStringValuesV1[217] as string), base, context: owner.context, signal: lifetime.signal,
    onSessionDenied() {
      const c = owner.context(); owner.switchContext({ ...c, objectId: null, revision: c.revision + 1 }); disposal();
      document.body.dataset.nativeRevision = browserWorkspaceStringValuesV1[58]; main.hidden = false;
      main.append(text("h1", browserWorkspaceStringValuesV1[235] as string), text("p", "Session, Berechtigung oder aktueller Objektstand nicht mehr bestätigt. Frühere fachliche Inhalte und Kontextlisteners wurden verworfen. Arbeitsbereich mit aktueller Session neu laden."));
      widget.dataset.critical="true";widget.dataset.state = browserWorkspaceStringValuesV1[2]; widget.textContent = "Aktueller Zugriff nicht bestätigt — keine alten Vorgangsinhalte.";
    },
    openTarget(value) {
      if (registry.status(value.target.pluginId).outcome !== browserWorkspaceStringValuesV1[21] || !registry.routes().some(r => r.pluginId === value.target.pluginId && r.routeId === value.target.routeId && r.state === browserWorkspaceStringValuesV1[21] && r.path === browserWorkspaceStringValuesV1[42])) throw new Error("WORKSPACE_NOTIFICATION_ROUTE_DENIED");
      const c = owner.context(); location.hash = buildBrowserDeepLinkV1({ path: browserWorkspaceStringValuesV1[42] as string, tenantId: c.tenantId, sessionId: c.sessionId, objectId: value.invoice.invoiceId, revision: value.invoice.revision });
    },
  });
  function disposal() { owner.onDispose(() => { if(!targetTransition)contextSelection?.retire(); panelEpoch++; registry.retireAll(); invoice = null; delete document.body.dataset.analysisResultRevision; main.replaceChildren(); actions.replaceChildren(); panel.replaceChildren(); panel.hidden = true; canvas.classList.remove(browserWorkspaceStringValuesV1[187] as string); nav.replaceChildren(); element('workspace.context-nav').replaceChildren(); syncWorkspaceNavigation(); }); }
  let latestActivation: object | null = null;
  function captureActivation(invocation: object) {
    const binding = owner.context(), nativeContextEpoch = contextSelection?.epoch();
    return { binding, nativeContextEpoch, live: () => latestActivation === invocation && !lifetime.signal.aborted
      && owner.context() === binding && contextSelection?.epoch() === nativeContextEpoch };
  }
  async function activate(native?:WorkspaceNavigationNativeReadbackV1):Promise<WorkspaceNativeNavigationFrameV1|undefined> {
    surfacesV2?.invalidate();delete main.dataset.surfaceProjectionDigest;delete main.dataset.surfaceObjectId;
    const invocation = Object.freeze({}); latestActivation = invocation;
    if(native)contextSelection?.beginTarget();else contextSelection?.retire();
    acceptedHash=location.hash||browserWorkspaceStringValuesV1[90] as string;
    const current = owner.context(); let selected: BrowserDeepLinkV1;
    try { selected = parseBrowserDeepLinkV1(location.hash || browserWorkspaceStringValuesV1[90] as string, current, registry.routes().filter(r => r.state === browserWorkspaceStringValuesV1[21]).map(r => r.path!)); }
    catch {
      owner.switchContext({ ...current, objectId: null, revision: current.revision + 1 }); disposal();
      const activation = captureActivation(invocation); if (!activation.live()) return;
      void notifications?.refresh();
      main.hidden = false;
      main.append(text("h1", "Deep Link verweigert"), text("p", "Route, Tenant, Session, Objektparameter oder Version sind nicht gültig. Keine Anfrage an einen fremden Tenant."));
      showStates("Deep Link verweigert — terminaler Zustand. Persönliche Hinweise werden unabhängig mit der aktuellen Session geprüft.",true);
      for (const c of registry.contributions()) if (c.kind === browserWorkspaceStringValuesV1[12]) {
        const rendered = await registry.render(c.id, nav); if (!activation.live() || rendered.outcome === browserWorkspaceStringValuesV1[120]) return;
      }
      composeReferenceModules();syncWorkspaceNavigation();
      return;
    }
    document.body.dataset.administrationActive=String(document.body.dataset.ownerAdministration==='true'&&selected.path==='/workspace/administration');
    if(document.body.dataset.ownerAdministration==='true'){const heading=document.querySelector('header strong'),description=document.querySelector('header p');if(heading)heading.textContent='PanSphaira';if(description)description.textContent=selected.path==='/workspace/administration'?'Geschützte Einrichtung, Freigaben und Wiederaufnahme':'Gemeinsamer Arbeitsplatz · native Fachansichten';}
    link=selected;const selectedRoute=registry.routes().find(r=>r.path===selected.path),routeLabel=selectedRoute?workspaceModuleLabelV1(selectedRoute.pluginId,selectedRoute.label):'Arbeitsplatz';element('workspace.section-name').textContent=routeLabel;document.body.dataset.workspaceRoute=selected.path;taskMode.textContent=selected.path==='/workspace/erv'?'Rechnung':routeLabel;
    targetTransition=!!native;try{owner.switchContext({ ...current, objectId: selected.path === browserWorkspaceStringValuesV1[42] ? selected.objectId ?? browserWorkspaceStringValuesV1[94] : selected.path === browserWorkspaceStringValuesV1[89] ? selected.objectId ?? "analysis:common-trade-01:stock" : null, revision: current.revision + 1 });}finally{targetTransition=false;}disposal();
    const activation = captureActivation(invocation); if (!activation.live()) return;
    document.body.dataset.contextRevision = String(owner.context().revision); document.body.dataset.nativeRevision = browserWorkspaceStringValuesV1[58];
    void notifications?.refresh();
    showStates("Lesender Arbeitsplatz. Pluginmetadaten gewähren keine Backendrechte.");
    for (const c of registry.contributions()) if (c.kind === browserWorkspaceStringValuesV1[12]) {
      const rendered = await registry.render(c.id, nav); if (!activation.live() || rendered.outcome === browserWorkspaceStringValuesV1[120]) return;
    }
    composeReferenceModules();syncWorkspaceNavigation();
    const route=registry.routes().find(r=>r.path===selected.path&&r.state==="REGISTERED"),view=registry.contributions().find(c=>c.kind==="VIEW"&&c.routeId===route?.routeId&&c.pluginId===route?.pluginId);if(!route||!view)throw Error("WORKSPACE_VIEW_MISSING");
    const nativeContextEpoch = activation.nativeContextEpoch;
    const target = document.createElement(browserWorkspaceStringValuesV1[10]); main.append(target); const result = await registry.render(view.id, target);
    if (!activation.live()) return;
    if (result.outcome !== browserWorkspaceStringValuesV1[118]) { if (result.outcome !== browserWorkspaceStringValuesV1[120]) { target.append(text("p", "Pluginansicht konnte nicht gerendert werden.")); if (nativeContextEpoch !== undefined) contextSelection?.unavailable(nativeContextEpoch); } return; }
    mountWorkspaceTabs(target);
    // Optional context transport must not hold the existing native actions,
    // deep link, navigation or logout hostage to a slow/failed context request.
    const readback = invoice;
    const nativeInvoice = readback && selected.path === browserWorkspaceStringValuesV1[42] && activation.binding.objectId === readback.invoiceId
      ? { objectId: readback.invoiceId, revision: readback.revision } : null;
    if (contextSelection && nativeContextEpoch !== undefined){const binding=contextSelection.bind({ localEpoch: nativeContextEpoch, moduleId: route.pluginId, viewId: view.id,
      primaryObjectId: nativeInvoice?.objectId ?? null, domainRevision: nativeInvoice?.revision ?? null });if(native)await binding;else void binding;}
    if(!activation.live())return;
    if (nativeInvoice) {
      const action = await registry.render(browserWorkspaceStringValuesV1[75] as string, actions); if (!activation.live()) return;
      if (action.outcome === browserWorkspaceStringValuesV1[118]) {
        const anchor = text("a", "Deep Link zum aktuellen Rechnungsvorgang") as HTMLAnchorElement;
        anchor.href = buildBrowserDeepLinkV1({ path: selected.path, tenantId: activation.binding.tenantId, sessionId: activation.binding.sessionId, objectId: nativeInvoice.objectId, revision: nativeInvoice.revision }); actions.append(anchor);
      }
    }
    if (presentation) applyPresentation(presentation);
    if (activation.live() && target.isConnected && !main.hidden && !element(browserWorkspaceStringValuesV1[217] as string).contains(document.activeElement)) main.focus();
    if(native&&readback&&activation.live())return {context:contextSelection!.current(),invoice:readback,root:target,main,isLive:activation.live};
  }
  disposal(); window.addEventListener("hashchange", () => {if(navigation)navigation.hashChange(acceptedHash,()=>{latestActivation=Object.freeze({});},()=>{void activate();});else if(document.body.dataset.ownerInvoiceNavigation==='true'&&(moduleViewEditor?.isDirty()||profileEditor?.isDirty()||[...draftOwners].some(d=>d.isDirty()))){history.replaceState(null,'',acceptedHash);widget.textContent='Navigation angehalten: Entwurf behalten. Erst verwerfen oder nativ zurücklesen; kein Retry.';}else void activate();}, { signal: lifetime.signal });
  element(browserWorkspaceStringValuesV1[216] as string).addEventListener("click", async () => {
    const response = await fetch(base + "/workspace/logout", { method: "POST", credentials: browserWorkspaceStringValuesV1[6] });
    if (response.status !== 200) { widget.textContent = "Abmelden nicht bestätigt. Keine Erfolgsmeldung."; return; }
    mobileArea('TASK');taskMode.disabled=true;assistantMode.disabled=true;
    contextSelection?.close(); owner.close(); registry.close(); lifetime.abort(); invoice = null; syncWorkspaceNavigation(); nav.replaceChildren(); actions.replaceChildren(); panel.replaceChildren(); panel.hidden = true;
    main.hidden = false;
    main.replaceChildren(text("h1", "Abgemeldet"), text("p", "Die aktuelle Session wurde serverseitig widerrufen."));
    (element(browserWorkspaceStringValuesV1[216] as string) as HTMLButtonElement).disabled = true; widget.textContent = "Session beendet.";
  }, { signal: lifetime.signal });
  const profileReady = createWorkspaceProfileEditorV1({ root: element(browserWorkspaceStringValuesV1[199] as string), base, sessionId: owner.context().sessionId, signal: lifetime.signal,
    apply: applyPresentation, denied() { presentation = null; owner.switchContext({ ...owner.context(), objectId: null, revision: owner.context().revision + 1 }); disposal(); main.hidden = false; main.replaceChildren(text("h1", browserWorkspaceStringValuesV1[235] as string), text("p", "Aktuelle Session abgelaufen oder gewechselt. Keine fachlichen Daten aus dem alten Kontext.")); },
  });
  await activate();
  profileEditor = await profileReady;
  syncWorkspaceNavigation();
  await moduleViewReady; if(lifetime.signal.aborted)return;
  if(document.body.dataset.ownerSurfacesV2==='true'&&contextSelection){try{const module=await import(base+'/workspace/surfaces/app.js');if(lifetime.signal.aborted)return;surfacesV2=module.createWorkspaceSurfacesV2({container:canvas,main,context:contextSelection,signal:lifetime.signal,dirty:()=>!!(moduleViewEditor?.isDirty()||profileEditor?.isDirty()||[...draftOwners].some(d=>d.isDirty())),returnToWorkspace:()=>{void activate();},render(projection:import('../../contracts/src/workspace-surface-v2.js').WorkspaceSurfaceProjectionV2){
    latestActivation=Object.freeze({});panelEpoch++;registry.retireAll();invoice=null;actions.replaceChildren();panel.replaceChildren();panel.hidden=true;contextSelection.adoptSurfaceContextV2(projection.routeId,projection.objectId);
    const frame=document.createElement('section');frame.className='surface-document';frame.dataset.surfaceRenderV2='true';frame.append(text('h1',projection.title),text('p','Native '+projection.kind+' · '+projection.objectId+' · Datenrevision '+projection.dataRevision+' · Ergebnisrevision '+projection.resultRevision));
    const source=text('pre',JSON.stringify(projection.source,null,2));source.className='surface-source';const content=text('pre',JSON.stringify(projection.data,null,2));content.className='surface-content';frame.append(text('h2','Führende Quellenreferenz'),source,text('h2','Tatsächlicher nativer Browserread'),content,text('p','Nur lesen. Dokument ist eine native Rechnungsreferenz, kein Original-PDF oder DMS. Physische Pixelsicht und Fachwirkung sind nicht bestätigt.'));
    main.hidden=false;main.replaceChildren(frame);main.dataset.surfaceObjectId=projection.objectId;main.dataset.surfaceProjectionDigest=projection.projectionDigest;document.body.dataset.nativeRevision=String(projection.dataRevision);
  }});}catch{canvas.append(text('p','Surfaceanzeige nicht verbunden. Fachnavigation und Abmelden bleiben unabhängig.'));}}
  if(document.body.dataset.ownerInvocationsV1==='true'&&contextSelection&&moduleViewEditor&&surfacesV2){try{const module=await import(base+'/workspace/invocations/app.js');if(!lifetime.signal.aborted)module.createWorkspaceInvocationsV1({container:canvas,context:contextSelection,editor:moduleViewEditor,surfaces:surfacesV2,signal:lifetime.signal});}catch{canvas.append(text('p','Modellfreier Schnellauftrag nicht verbunden; native Fachnavigation bleibt unabhängig.'));}}
  if(document.body.dataset.ownerMailLocalV1==='true'&&contextSelection){try{const module=await import(base+'/workspace/mail-local/app.js');if(!lifetime.signal.aborted)module.createWorkspaceMailLocalV1({container:canvas,context:contextSelection,signal:lifetime.signal});}catch{canvas.append(text('p','Lokale synthetische Nachrichtenquelle nicht verbunden; keine Mail-, Modell- oder Versandrechte.'));}}
  if(document.body.dataset.ownerReadonlyEventsV1==='true'&&contextSelection){try{const module=await import(base+'/workspace/readonly-events/app.js');if(!lifetime.signal.aborted)module.createWorkspaceReadonlyEventsV1({container:canvas,context:contextSelection,signal:lifetime.signal});}catch{canvas.append(text('p','Native Ereignisquelle nicht verbunden; keine Frische oder Werte erfunden.'));}}
  if(document.body.dataset.ownerContextProjectionV1==='true'&&contextSelection){try{const module=await import(base+'/workspace/context-projection/app.js');if(!lifetime.signal.aborted)module.createWorkspaceContextProjectionV1({container:canvas,context:contextSelection,signal:lifetime.signal,rulesVertical:document.body.dataset.ownerRulesVerticalV1==='true'});}catch{canvas.append(text('p','Lokaler Kontextvertrag nicht verbunden; Fachnavigation bleibt unabhängig.'));}}
  if(document.body.dataset.ownerInvoiceNavigation==='true'&&contextSelection&&moduleViewEditor){try{const module=await import(base+'/workspace/invoice-navigation/app.js');if(lifetime.signal.aborted)return;navigation=module.createWorkspaceInvoiceNavigationV1({container:element('workspace.invoice-search'),context:contextSelection,signal:lifetime.signal,drafts:draftOwners,editor:moduleViewEditor,profile:profileEditor,shellContext:owner.context,registry,activate});}catch{canvas.append(text('p','Suche nicht verfügbar.'));}}
}
void start().catch(() => { const main = element(browserWorkspaceStringValuesV1[17] as string); main.replaceChildren(text("h1", "Arbeitsplatz nicht verfügbar"), text("p", "Keine gültige aktuelle Session oder kein gültiges Frontendbinding. Es wurde kein fachlicher Erfolg bestätigt.")); });
