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
  let profileEditor: Awaited<ReturnType<typeof createWorkspaceProfileEditorV1>> | null = null;
  let presentation: BrowserProfileReadV1 | null = null; let panelEpoch = 0;
  let notifications: ReturnType<typeof createWorkspaceNotificationsV1> | null = null;
  let navigation:WorkspaceNavigationDriverV1|null=null,targetTransition=false,acceptedHash=location.hash||browserWorkspaceStringValuesV1[90] as string;
  let surfacesV2:ReturnType<typeof import('./workspace-surfaces-v2.js').createWorkspaceSurfacesV2>|null=null;
  const draftOwners=new Set<WorkspaceDirtyDraftV1>();
  const canvas = element("profile.canvas"); const boundary = element(browserWorkspaceStringValuesV1[113] as string);
  const cards = new Map([[browserWorkspaceStringValuesV1[17] as string, main], [browserWorkspaceStringValuesV1[119] as string, widget], [browserWorkspaceStringValuesV1[113] as string, boundary], [browserWorkspaceStringValuesV1[13] as string, panel]]);
  async function renderPanel() {
    const epoch = ++panelEpoch;
    const visible = presentation?.effectiveItems.some(i => i.id === browserWorkspaceStringValuesV1[13] && i.visible);
    const knowledge=link?.path==="/workspace/knowledge"&&document.body.dataset.ownerKnowledgeExplorer==="true";
    if (!visible || (!invoice&&!knowledge)) { panel.hidden = true; panel.replaceChildren(); return; }
    panel.hidden = false;
    const result = await registry.render(knowledge?"pan.knowledge.context":browserWorkspaceStringValuesV1[13] as string, panel);
    if (epoch !== panelEpoch || (!invoice&&!knowledge)) return;
    if (result.outcome !== browserWorkspaceStringValuesV1[118]) { panel.hidden = true; panel.replaceChildren(); }
  }
  function applyPresentation(value: BrowserProfileReadV1) {
    const configurationFocus = document.body.dataset.ownerConfigurationDrafts === "true" && document.activeElement instanceof HTMLElement && document.activeElement.closest(".configuration-draft") ? document.activeElement : null;
    presentation = value;
    for (const [id, node] of cards) {
      const item = value.effectiveItems.find(i => i.id === id);
      node.classList.remove("profile-compact", "profile-regular", "profile-large");
      if (item) node.classList.add("profile-" + item.size);
      node.hidden = !item?.visible || (id === browserWorkspaceStringValuesV1[13] && !invoice && link?.path!=="/workspace/knowledge");
    }
    // MAIN is the stable native analysis attachment. Reorder the other cards
    // around it, and do not manufacture removal/reinsert records for an
    // unchanged profile. Permanent retirement of genuinely removed roots stays.
    let next: ChildNode | null = null;
    for (const item of [...value.profile.items].reverse()) {
      const card = cards.get(item.id); if (!card) continue;
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
  if(document.body.dataset.ownerAdministration==='true'&&document.body.dataset.ownerAgentRuns!=='true'&&contextSelection)void import(base+'/workspace/administration/app.js').then(module=>{if(!lifetime.signal.aborted)module.mountWorkspaceAdministrationManualPanelV1({container:canvas,context:contextSelection,signal:lifetime.signal});}).catch(()=>{if(!lifetime.signal.aborted)canvas.append(text('p','Gemeinsames Manuellpanel nicht verfügbar; Einrichtung, Fachnavigation und Abmelden bleiben unabhängig.'));});
  let moduleViewEditor: ReturnType<typeof createWorkspaceModuleViewEditorV1> | null = null;
  // Optional editor transport never gates the shared registry, navigation or logout.
  const moduleViewReady = document.body.dataset.ownerModuleViews === "true" && contextSelection
    ? import(base+"/workspace/module-view/app.js").then(module=>{
      if(lifetime.signal.aborted)return null;
      const editor=module.createWorkspaceModuleViewEditorV1({main,context:contextSelection,signal:lifetime.signal});moduleViewEditor=editor;
      if(document.body.dataset.ownerAgentRuns==="true")void import(base+"/workspace/agent-run/app.js")
        .then(module=>{if(!lifetime.signal.aborted)module.createWorkspaceAgentPanelV1({container:canvas,context:contextSelection,editor,signal:lifetime.signal});})
        .catch(()=>{if(!lifetime.signal.aborted)canvas.append(text('p','Auftragspanel nicht verfügbar. Kein Lauf bestätigt; Fachnavigation, Profile und Abmelden bleiben unabhängig.'));});
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
  function showStates(message: string) {
    widget.replaceChildren(text("p", message));
    if (diagnosticStates.length) { const list = document.createElement("ul"); for (const state of diagnosticStates) list.append(text("li", state)); widget.append(list); }
  }
  const factories = new Map<string, BrowserShellFactoryV1<HTMLElement>>([
    [browserWorkspaceStringValuesV1[112] as string, createSetupViewV1(api)], [browserWorkspaceStringValuesV1[30] as string, createErvViewV1(api)], [browserWorkspaceStringValuesV1[13] as string, createErvPanelV1(api)], [browserWorkspaceStringValuesV1[75] as string, createErvActionV1(api)],
  ]);
  if(document.body.dataset.ownerKnowledgeExplorer==="true"&&contextSelection){for(const kind of ["VIEW","PANEL"] as const){factories.set(kind==="VIEW"?"pan.knowledge.view":"pan.knowledge.context",{kind,async render({target,signal}){target.append(text("p","Wissensexplorer wird geladen …"));const module=await import(base+"/workspace/knowledge/app.js");if(!signal.aborted&&target.isConnected)module[kind==="VIEW"?"renderWorkspaceKnowledgeViewV1":"renderWorkspaceKnowledgePanelV1"]({target,signal,context:contextSelection,profile:()=>profileEditor,selected:()=>link?.path,renderPanel});}});}}
  if(document.body.dataset.ownerAdministration==='true'&&contextSelection)factories.set('pan.setup.administration.view',{kind:'VIEW',async render({target,signal}){target.append(text('p','Geschützte Administration wird geladen …'));const module=await import(base+'/workspace/administration/app.js');if(!signal.aborted&&target.isConnected)module.renderWorkspaceAdministrationV1({target,signal,context:contextSelection});}});
  if (diagnostic) for (const p of [diagnostic.broken, diagnostic.disabled, diagnostic.missing, diagnostic.incompatible]) factories.set(p.id + ".view", diagnosticFailingViewV1);
  if (configurationEnabled) factories.set(browserWorkspaceStringValuesV1[110] as string, createConfigurationDraftViewV1(owner.context,draft=>{draftOwners.add(draft);return()=>draftOwners.delete(draft);},contextSelection));
  if (analysisEnabled) factories.set(browserWorkspaceStringValuesV1[109] as string, createAnalysisViewV1({ base, context: owner.context, selected: () => link }));
  for (const plugin of plugins) for (const c of plugin.contributions) if (c.kind === browserWorkspaceStringValuesV1[12]) {
    const route = plugin.contributions.find(r => r.kind === "ROUTE" && r.id === c.routeId);
    factories.set(c.factoryId, { kind: browserWorkspaceStringValuesV1[12], render({ target, signal }) {
      const button = text(browserWorkspaceStringValuesV1[1] as string, c.label) as HTMLButtonElement; button.type = browserWorkspaceStringValuesV1[1];
      if (route?.path === link?.path) button.setAttribute("aria-current", "page");
      button.disabled = registry.status(plugin.id).outcome !== browserWorkspaceStringValuesV1[21];
      button.addEventListener("click", () => { if (route?.path) location.hash = "#" + route.path; }, { signal }); target.append(button);
    } });
  }
  registry = createBrowserShellRegistryV1({ factories, reportFault(fault) { showStates("Pluginfehler: " + fault.outcome + ". Andere Module und Abmelden bleiben bedienbar."); } });
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
  if (document.body.dataset.ownerNotifications === "true") notifications = createWorkspaceNotificationsV1({ root: element(browserWorkspaceStringValuesV1[217] as string), base, context: owner.context, signal: lifetime.signal,
    onSessionDenied() {
      const c = owner.context(); owner.switchContext({ ...c, objectId: null, revision: c.revision + 1 }); disposal();
      document.body.dataset.nativeRevision = browserWorkspaceStringValuesV1[58]; main.hidden = false;
      main.append(text("h1", browserWorkspaceStringValuesV1[235] as string), text("p", "Session, Berechtigung oder aktueller Objektstand nicht mehr bestätigt. Frühere fachliche Inhalte und Kontextlisteners wurden verworfen. Arbeitsbereich mit aktueller Session neu laden."));
      widget.dataset.state = browserWorkspaceStringValuesV1[2]; widget.textContent = "Aktueller Zugriff nicht bestätigt — keine alten Vorgangsinhalte.";
    },
    openTarget(value) {
      if (registry.status(value.target.pluginId).outcome !== browserWorkspaceStringValuesV1[21] || !registry.routes().some(r => r.pluginId === value.target.pluginId && r.routeId === value.target.routeId && r.state === browserWorkspaceStringValuesV1[21] && r.path === browserWorkspaceStringValuesV1[42])) throw new Error("WORKSPACE_NOTIFICATION_ROUTE_DENIED");
      const c = owner.context(); location.hash = buildBrowserDeepLinkV1({ path: browserWorkspaceStringValuesV1[42] as string, tenantId: c.tenantId, sessionId: c.sessionId, objectId: value.invoice.invoiceId, revision: value.invoice.revision });
    },
  });
  function disposal() { owner.onDispose(() => { if(!targetTransition)contextSelection?.retire(); panelEpoch++; registry.retireAll(); invoice = null; delete document.body.dataset.analysisResultRevision; main.replaceChildren(); actions.replaceChildren(); panel.replaceChildren(); panel.hidden = true; canvas.classList.remove(browserWorkspaceStringValuesV1[187] as string); nav.replaceChildren(); }); }
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
      showStates("Deep Link verweigert — terminaler Zustand. Persönliche Hinweise werden unabhängig mit der aktuellen Session geprüft.");
      for (const plugin of plugins) for (const c of plugin.contributions) if (c.kind === browserWorkspaceStringValuesV1[12]) {
        const rendered = await registry.render(c.id, nav); if (!activation.live() || rendered.outcome === browserWorkspaceStringValuesV1[120]) return;
      }
      return;
    }
    document.body.dataset.administrationActive=String(document.body.dataset.ownerAdministration==='true'&&selected.path==='/workspace/administration');
    if(document.body.dataset.ownerAdministration==='true'){const heading=document.querySelector('header strong'),description=document.querySelector('header p');if(heading)heading.textContent='PanSphaira';if(description)description.textContent=selected.path==='/workspace/administration'?'Geschützte Einrichtung, Freigaben und Wiederaufnahme':'Gemeinsamer Arbeitsplatz · native Fachansichten';}
    link = selected;
    targetTransition=!!native;try{owner.switchContext({ ...current, objectId: selected.path === browserWorkspaceStringValuesV1[42] ? selected.objectId ?? browserWorkspaceStringValuesV1[94] : selected.path === browserWorkspaceStringValuesV1[89] ? selected.objectId ?? "analysis:common-trade-01:stock" : null, revision: current.revision + 1 });}finally{targetTransition=false;}disposal();
    const activation = captureActivation(invocation); if (!activation.live()) return;
    document.body.dataset.contextRevision = String(owner.context().revision); document.body.dataset.nativeRevision = browserWorkspaceStringValuesV1[58];
    void notifications?.refresh();
    showStates("Lesender Arbeitsplatz. Pluginmetadaten gewähren keine Backendrechte.");
    for (const plugin of plugins) for (const c of plugin.contributions) if (c.kind === browserWorkspaceStringValuesV1[12]) {
      const rendered = await registry.render(c.id, nav); if (!activation.live() || rendered.outcome === browserWorkspaceStringValuesV1[120]) return;
    }
    const plugin = plugins.find(p => p.contributions.some(c => c.kind === "ROUTE" && c.path === selected.path));
    const route=plugin?.contributions.find(c=>c.kind==="ROUTE"&&c.path===selected.path);const view = plugin?.contributions.find(c => c.kind === "VIEW" && c.routeId===route?.id); if (!view) throw new Error("WORKSPACE_VIEW_MISSING");
    const nativeContextEpoch = activation.nativeContextEpoch;
    const target = document.createElement(browserWorkspaceStringValuesV1[10]); main.append(target); const result = await registry.render(view.id, target);
    if (!activation.live()) return;
    if (result.outcome !== browserWorkspaceStringValuesV1[118]) { if (result.outcome !== browserWorkspaceStringValuesV1[120]) { target.append(text("p", "Pluginansicht konnte nicht gerendert werden.")); if (nativeContextEpoch !== undefined) contextSelection?.unavailable(nativeContextEpoch); } return; }
    // Optional context transport must not hold the existing native actions,
    // deep link, navigation or logout hostage to a slow/failed context request.
    const readback = invoice;
    const nativeInvoice = readback && selected.path === browserWorkspaceStringValuesV1[42] && activation.binding.objectId === readback.invoiceId
      ? { objectId: readback.invoiceId, revision: readback.revision } : null;
    if (contextSelection && nativeContextEpoch !== undefined){const binding=contextSelection.bind({ localEpoch: nativeContextEpoch, moduleId: plugin!.id, viewId: view.id,
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
    contextSelection?.close(); owner.close(); registry.close(); lifetime.abort(); invoice = null; nav.replaceChildren(); actions.replaceChildren(); panel.replaceChildren(); panel.hidden = true;
    main.hidden = false;
    main.replaceChildren(text("h1", "Abgemeldet"), text("p", "Die aktuelle Session wurde serverseitig widerrufen."));
    (element(browserWorkspaceStringValuesV1[216] as string) as HTMLButtonElement).disabled = true; widget.textContent = "Session beendet.";
  }, { signal: lifetime.signal });
  const profileReady = createWorkspaceProfileEditorV1({ root: element(browserWorkspaceStringValuesV1[199] as string), base, sessionId: owner.context().sessionId, signal: lifetime.signal,
    apply: applyPresentation, denied() { presentation = null; owner.switchContext({ ...owner.context(), objectId: null, revision: owner.context().revision + 1 }); disposal(); main.hidden = false; main.replaceChildren(text("h1", browserWorkspaceStringValuesV1[235] as string), text("p", "Aktuelle Session abgelaufen oder gewechselt. Keine fachlichen Daten aus dem alten Kontext.")); },
  });
  await activate();
  profileEditor = await profileReady;
  await moduleViewReady; if(lifetime.signal.aborted)return;
  if(document.body.dataset.ownerSurfacesV2==='true'&&contextSelection){try{const module=await import(base+'/workspace/surfaces/app.js');if(lifetime.signal.aborted)return;surfacesV2=module.createWorkspaceSurfacesV2({container:canvas,main,context:contextSelection,signal:lifetime.signal,dirty:()=>!!(moduleViewEditor?.isDirty()||profileEditor?.isDirty()||[...draftOwners].some(d=>d.isDirty())),returnToWorkspace:()=>{void activate();},render(projection:import('../../contracts/src/workspace-surface-v2.js').WorkspaceSurfaceProjectionV2){
    latestActivation=Object.freeze({});panelEpoch++;registry.retireAll();invoice=null;actions.replaceChildren();panel.replaceChildren();panel.hidden=true;contextSelection.adoptSurfaceContextV2(projection.routeId,projection.objectId);
    const frame=document.createElement('section');frame.className='surface-document';frame.dataset.surfaceRenderV2='true';frame.append(text('h1',projection.title),text('p','Native '+projection.kind+' · '+projection.objectId+' · Datenrevision '+projection.dataRevision+' · Ergebnisrevision '+projection.resultRevision));
    const source=text('pre',JSON.stringify(projection.source,null,2));source.className='surface-source';const content=text('pre',JSON.stringify(projection.data,null,2));content.className='surface-content';frame.append(text('h2','Führende Quellenreferenz'),source,text('h2','Tatsächlicher nativer Browserread'),content,text('p','Nur lesen. Dokument ist eine native Rechnungsreferenz, kein Original-PDF oder DMS. Physische Pixelsicht und Fachwirkung sind nicht bestätigt.'));
    main.hidden=false;main.replaceChildren(frame);main.dataset.surfaceObjectId=projection.objectId;main.dataset.surfaceProjectionDigest=projection.projectionDigest;document.body.dataset.nativeRevision=String(projection.dataRevision);
  }});}catch{canvas.append(text('p','Surfaceanzeige nicht verbunden. Fachnavigation und Abmelden bleiben unabhängig.'));}}
  if(document.body.dataset.ownerInvocationsV1==='true'&&contextSelection&&moduleViewEditor&&surfacesV2){try{const module=await import(base+'/workspace/invocations/app.js');if(!lifetime.signal.aborted)module.createWorkspaceInvocationsV1({container:canvas,context:contextSelection,editor:moduleViewEditor,surfaces:surfacesV2,signal:lifetime.signal});}catch{canvas.append(text('p','Modellfreier Schnellauftrag nicht verbunden; native Fachnavigation bleibt unabhängig.'));}}
  if(document.body.dataset.ownerInvoiceNavigation==='true'&&contextSelection&&moduleViewEditor){try{const module=await import(base+'/workspace/invoice-navigation/app.js');if(lifetime.signal.aborted)return;navigation=module.createWorkspaceInvoiceNavigationV1({container:canvas,context:contextSelection,signal:lifetime.signal,drafts:draftOwners,editor:moduleViewEditor,profile:profileEditor,shellContext:owner.context,registry,activate});}catch{canvas.append(text('p','Suche nicht verfügbar.'));}}
}
void start().catch(() => { const main = element(browserWorkspaceStringValuesV1[17] as string); main.replaceChildren(text("h1", "Arbeitsplatz nicht verfügbar"), text("p", "Keine gültige aktuelle Session oder kein gültiges Frontendbinding. Es wurde kein fachlicher Erfolg bestätigt.")); });
