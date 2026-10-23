import {browserWorkspaceStringValuesV1} from "../../contracts/src/browser-shell-plugin-v1.js";
import { defaultBrowserProfileV1, validateBrowserProfileV1, validateBrowserProfileReadV1, resolveBrowserProfileV1, type BrowserProfileReadV1, type BrowserProfileV1 } from "../../contracts/src/browser-profile-v1.js";
import { text } from "./api-v1.js";
const sizes = ["compact", "regular", "large"] as const;
const labels: Record<string, string> = { "shell.main": "Hauptfläche", "shell.widgets": "Betriebsstatus", "pan.workspace.boundary": "Darstellungsgrenze", "pan.erv.information": "Informationspanel" };
const copy = (profile: BrowserProfileV1): BrowserProfileV1 => ({ schemaVersion: profile.schemaVersion, items: profile.items.map(i => ({ ...i })) });
export interface WorkspaceProfileCompositionBridgeV1 {readonly root:HTMLElement;current():BrowserProfileReadV1|null;editable():boolean;replace(profile:BrowserProfileV1):boolean;protect(required:ReadonlySet<string>,managed:ReadonlySet<string>):void;subscribe(fn:()=>void):()=>void;open():void;}
export function workspaceProfileCompositionBridgeV1(root:HTMLElement):WorkspaceProfileCompositionBridgeV1|null{return Object.getOwnPropertyDescriptor(root,Symbol.for('pansphaira.personal-profile-editor/v1'))?.value??null;}
export async function createWorkspaceProfileEditorV1(options: { root: HTMLElement; base: string; sessionId: string; signal: AbortSignal; apply: (value: BrowserProfileReadV1) => void; denied: () => void }) {
  const { root, base, sessionId, signal } = options;
  let readback: BrowserProfileReadV1 | null = null; let draft = defaultBrowserProfileV1(); let busy = false; let blocked = false; let legacyOnly = false; let serial = 0; let proposal: BrowserProfileV1 | null = null; let dragging: string | null = null;
  const compositionListeners=new Set<()=>void>();let protectedItems:ReadonlySet<string>=new Set(),managedItems:ReadonlySet<string>=new Set();
  function notifyComposition(){for(const fn of compositionListeners)try{fn();}catch{root.dataset.compositionState='RENDER_FAILED';}}
  const toggle = text(browserWorkspaceStringValuesV1[1] as string, "Darstellung anpassen") as HTMLButtonElement; toggle.type = browserWorkspaceStringValuesV1[1]; toggle.setAttribute(browserWorkspaceStringValuesV1[132] as string, "false"); toggle.setAttribute("aria-controls", browserWorkspaceStringValuesV1[200] as string);
  const editor = text(browserWorkspaceStringValuesV1[10] as string, ""); editor.id = browserWorkspaceStringValuesV1[200] as string; editor.hidden = true; editor.setAttribute(browserWorkspaceStringValuesV1[32] as string, "Darstellungsprofil bearbeiten");
  const status = text("p", "Darstellungsprofil wird geladen …"); status.setAttribute("role", browserWorkspaceStringValuesV1[22] as string); status.dataset.profileState = browserWorkspaceStringValuesV1[26];
  const rows = text("div", ""); rows.className = "profile-rows";
  const diff = text(browserWorkspaceStringValuesV1[10] as string, ""); diff.dataset.profile = "diff"; diff.hidden = true;
  const tools = text("div", ""); tools.className = "profile-tools";
  let rowsLifetime = new AbortController(); let diffLifetime = new AbortController();
  const button = (label: string, handler: () => void, listenerSignal = signal) => { const b = text(browserWorkspaceStringValuesV1[1] as string, label) as HTMLButtonElement; b.type = browserWorkspaceStringValuesV1[1]; b.addEventListener("click", handler, { signal: listenerSignal }); return b; };
  const save = button("Profil speichern", review);
  const reload = button("Gespeichertes Profil neu laden — lokale Änderungen verwerfen", () => { void load(); });
  const reset = button("Standarddarstellung wiederherstellen", () => { if (!readback || busy || blocked) return; draft = defaultBrowserProfileV1(); draft.items = draft.items.filter(i => readback!.catalog.some(c => c.id === i.id && c.version === i.version && c.state === browserWorkspaceStringValuesV1[43])); changed(); renderRows(); });
  editor.append(text("h2", "Persönliche Dashboard- und Paneldarstellung"), text("p", "Nur Darstellung: Reihenfolge, Sichtbarkeit und Größe. Ziehen oder die Nach-oben-/Nach-unten-Tasten verwenden; Größenregler mit Pfeiltasten, Pos1 oder Ende. Änderungen sind zunächst lokale Vorschau. Kein fachlicher Wert und keine Berechtigung wird gespeichert."), rows, tools, diff);
  tools.append(save, reset, reload); root.append(toggle, status, editor);
  toggle.addEventListener("click", () => { editor.hidden = !editor.hidden; toggle.setAttribute(browserWorkspaceStringValuesV1[132] as string, String(!editor.hidden)); }, { signal });
  function state(code: string, message: string) { status.dataset.profileState = code; status.dataset.profileRevision = readback ? String(readback.revision) : browserWorkspaceStringValuesV1[58]; status.textContent = message; save.disabled = !readback || busy || blocked; reset.disabled = save.disabled; reload.disabled = busy;notifyComposition(); }
  function resolved(): BrowserProfileReadV1 {
    if (!readback) throw new Error("PROFILE_READBACK_MISSING");
    return { ...readback, profile: copy(draft), ...resolveBrowserProfileV1(draft, readback.catalog) };
  }
  function apply() { if (readback && !signal.aborted) options.apply(resolved()); }
  function changed() { proposal = null; diffLifetime.abort(); diff.hidden = true; apply(); state("DRAFT", "Lokale Darstellungsvorschau — noch nicht gespeichert. Mobil wird nur die Anordnung umgebrochen; das Desktopprofil bleibt unverändert."); }
  function move(id: string, offset: number) {
    if (blocked || busy) return;const peers=draft.items.filter(i=>!managedItems.has(i.id)),at=peers.findIndex(i=>i.id===id),target=peers[at+offset];if(!target)return;const index=draft.items.findIndex(i=>i.id===id),destination=draft.items.indexOf(target);
    if(index<0)return;const [item] = draft.items.splice(index, 1); draft.items.splice(destination, 0, item!); changed(); renderRows();
    rows.querySelector<HTMLButtonElement>('[data-move="' + id + '"]')?.focus();
  }
  function renderRows() {
    rowsLifetime.abort(); rowsLifetime = new AbortController(); const rowSignal = AbortSignal.any([signal, rowsLifetime.signal]);
    rows.replaceChildren();
    for (const item of draft.items) {
      if(managedItems.has(item.id))continue;
      const name = labels[item.id] ?? item.id; const orphan = readback ? resolved().orphaned.find(i => i.id === item.id) : undefined;
      const row = text(browserWorkspaceStringValuesV1[10] as string, ""); row.dataset.profileItem = item.id; row.className = "profile-row"; row.draggable = !orphan && !busy && !blocked;
      row.append(text("h3", name));
      if (orphan) row.append(text("p", "Nicht wiederhergestellt (orphaned): " + orphan.reason + ". Kein ähnlicher ID-Ersatz und keine Freigabe durch Darstellung."));
      const checkLabel = text("label", ""); const check = document.createElement("input"); check.type = browserWorkspaceStringValuesV1[44] as string; check.checked = item.visible; check.setAttribute(browserWorkspaceStringValuesV1[32] as string, name + " anzeigen"); check.disabled = !!orphan || busy || blocked || protectedItems.has(item.id);
      check.addEventListener(browserWorkspaceStringValuesV1[33], () => { item.visible = check.checked; changed(); }, { signal: rowSignal }); checkLabel.append(check, text("span", "Anzeigen"));
      const sizeLabel = text("label", "Größe: "); sizeLabel.className = "profile-size"; const range = document.createElement("input"); range.type = "range"; range.min = "0"; range.max = "2"; range.step = "1"; range.value = String(sizes.indexOf(item.size)); range.setAttribute(browserWorkspaceStringValuesV1[32] as string, name + " Größe"); range.setAttribute(browserWorkspaceStringValuesV1[135] as string, item.size); range.disabled = check.disabled;
      range.disabled=!!orphan||busy||blocked;const output = text("span", item.size); range.addEventListener("input", () => { item.size = sizes[Number(range.value)]!; range.setAttribute(browserWorkspaceStringValuesV1[135] as string, item.size); output.textContent = item.size; changed(); }, { signal: rowSignal }); sizeLabel.append(range, output);
      const peers=draft.items.filter(i=>!managedItems.has(i.id));const up = button(name + " nach oben", () => move(item.id, -1), rowSignal); up.dataset.move = item.id; up.disabled = busy || blocked || peers[0]?.id === item.id;
      const down = button(name + " nach unten", () => move(item.id, 1), rowSignal); down.disabled = busy || blocked || peers.at(-1)?.id === item.id;
      row.append(checkLabel, sizeLabel, up, down);
      row.addEventListener("dragstart", event => { if (blocked || busy || orphan) { event.preventDefault(); return; } dragging = item.id; event.dataTransfer?.setData("text/plain", item.id); }, { signal: rowSignal });
      row.addEventListener("dragover", event => { if (dragging) event.preventDefault(); }, { signal: rowSignal });
      row.addEventListener("drop", event => { event.preventDefault(); if (!dragging) return; const from = draft.items.findIndex(i => i.id === dragging); const to = draft.items.findIndex(i => i.id === item.id); if (from >= 0 && to >= 0) move(dragging, to - from); dragging = null; }, { signal: rowSignal });
      row.addEventListener("dragend", () => { dragging = null; }, { signal: rowSignal }); rows.append(row);
    }
    notifyComposition();
  }
  function review() {
    if (!readback || busy || blocked) return;
    diffLifetime.abort(); diffLifetime = new AbortController(); const diffSignal = AbortSignal.any([signal, diffLifetime.signal]);
    proposal = copy(draft); diff.replaceChildren(text("h3", "Darstellungsänderungen prüfen"));
    const changes = text("ul", ""); const prior = readback.profile.items;
    for (const [index, item] of proposal.items.entries()) {
      const old = prior.find(i => i.id === item.id); const name = labels[item.id] ?? item.id;
      changes.append(text("li", name + ": Position " + (old ? prior.indexOf(old) + 1 : "neu") + " → " + (index + 1) + "; " + (old?.visible ? browserWorkspaceStringValuesV1[129] : browserWorkspaceStringValuesV1[95]) + " → " + (item.visible ? browserWorkspaceStringValuesV1[129] : browserWorkspaceStringValuesV1[95]) + "; Größe " + (old?.size ?? "neu") + " → " + item.size));
    }
    for (const old of prior.filter(i => !proposal!.items.some(n => n.id === i.id))) changes.append(text("li", (labels[old.id] ?? old.id) + ": aus dem Darstellungsprofil entfernt."));
    diff.append(changes, text("p", "Folge: ersetzt ausschließlich Ihre gespeicherte Darstellung bei Revision " + readback.revision + ". Keine Fachwerte, Secrets oder Rechte; kein automatischer Konfliktmerge. Ein konkurrierendes Browserprofil wird nicht überschrieben."), button("Speichern bestätigen", () => { void commit(); }, diffSignal), button("Bestätigung abbrechen", () => { proposal = null; diffLifetime.abort(); diff.hidden = true; save.focus(); }, diffSignal));
    diff.hidden = false; diff.querySelector<HTMLButtonElement>(browserWorkspaceStringValuesV1[1] as string)?.focus();
  }
  async function request(method: "GET" | "POST", value?: unknown) {
    const requestSignal = AbortSignal.any([signal, AbortSignal.timeout(10000)]);
    const response = await fetch(base + "/workspace/profile", { method, credentials: browserWorkspaceStringValuesV1[6], cache: browserWorkspaceStringValuesV1[7], signal: requestSignal, headers: { "x-pan543-session": sessionId, ...(method === "POST" ? { "content-type": browserWorkspaceStringValuesV1[31] as string } : {}) }, ...(value === undefined ? {} : { body: JSON.stringify(value) }) });
    if (response.status !== 200) return { status: response.status, value: null };
    const target = validateBrowserProfileReadV1(await response.json());
    const context = await fetch(base + browserWorkspaceStringValuesV1[18], { credentials: browserWorkspaceStringValuesV1[6], cache: browserWorkspaceStringValuesV1[7], signal: requestSignal });
    if (context.status !== 200 || (await context.json() as { sessionId?: string }).sessionId !== sessionId) return { status: 401, value: null };
    return { status: 200, value: target };
  }
  function denied() { blocked = true; readback = null; rows.replaceChildren(); diff.hidden = true; options.denied(); }
  async function load() {
    if (busy || signal.aborted) return;
    busy = true; const invocation = ++serial; state(browserWorkspaceStringValuesV1[26] as string, "Gespeicherte Darstellung wird aus dem Backend geladen …");
    try {
      const response = await request("GET"); if (signal.aborted || invocation !== serial) return;
      if (response.status !== 200 || !response.value) {
        if (response.status === 404) {
          // Backward-compatible document mount without the optional profile
          // adapter: local code-owned defaults, NOT a backend readback/PASS.
          legacyOnly = true; blocked = true; draft = defaultBrowserProfileV1();
          const catalog = draft.items.map(i => ({ id: i.id, version: i.version, state: "AVAILABLE" as const }));
          readback = { schemaVersion: browserWorkspaceStringValuesV1[114], revision: 0, profile: copy(draft), catalog, migration: "NONE", ...resolveBrowserProfileV1(draft, catalog) };
          apply(); state(browserWorkspaceStringValuesV1[40] as string, "Profiladapter nicht montiert: lokale Standarddarstellung, Speichern nicht verfügbar. Kein persistierter Readback.");
        }
        else if ([401, 403].includes(response.status)) { denied(); state(browserWorkspaceStringValuesV1[2] as string, "Zugriff verweigert oder Session gewechselt. Keine Wiederherstellung und kein Schreibretry."); }
        else { blocked = true; state(browserWorkspaceStringValuesV1[40] as string, "Profilbackend nicht verfügbar. Keine Speicherung bestätigt. Neu laden liest autoritativ; kein automatischer Schreibretry."); }
        return;
      }
      readback = response.value; draft = copy(readback.profile); blocked = false; legacyOnly = false; proposal = null; diff.hidden = true;
      apply(); state("READY", (readback.revision === 0 ? "Noch kein persönliches Profil gespeichert. Sichere Standarddarstellung." : "Gespeichertes Profil gelesen, Revision " + readback.revision + ".") + (readback.migration !== "NONE" ? " Migration: " + readback.migration + "; erst ausdrückliche Bestätigung speichert v1." : "") + (readback.orphaned.length ? " Nicht wiederhergestellte Beiträge: " + readback.orphaned.map(i => i.id + " (" + i.reason + ")").join(", ") + "." : ""));
    } catch { if (!signal.aborted) { blocked = true; state(browserWorkspaceStringValuesV1[40] as string, "Profilreadback nicht verfügbar oder ungültig. Kein Erfolg bestätigt."); } }
    finally { if (!signal.aborted && invocation === serial) { busy = false; save.disabled = !readback || blocked; reset.disabled = save.disabled; reload.disabled = false; renderRows(); } }
  }
  async function commit() {
    if (!readback || !proposal || busy || blocked) return;
    const proposed = copy(proposal); const expected = readback.revision; busy = true; blocked = true; diff.hidden = true; renderRows(); state(browserWorkspaceStringValuesV1[211] as string, "Darstellung wird mit erwarteter Revision gespeichert …");
    try {
      const response = await request("POST", { expectedRevision: expected, profile: proposed }); if (signal.aborted) return;
      if (response.status === 409) { state(browserWorkspaceStringValuesV1[96] as string, "Konflikt: Ein anderer Browser hat eine neuere Revision gespeichert. Ihre lokale Vorschau bleibt erhalten. Gespeichertes Profil neu laden verwirft sie ausdrücklich; kein stilles Überschreiben."); return; }
      if ([401, 403].includes(response.status)) { denied(); state(browserWorkspaceStringValuesV1[2] as string, "Session abgelaufen, gewechselt oder Zugriff verweigert. Kein erfolgreicher Schreibabschluss."); return; }
      if (response.status === 400) { state("REJECTED", "Darstellung oder Beitragsversion serverseitig verweigert. Kein Erfolg bestätigt; zuerst aktuelle Darstellung neu laden."); return; }
      if (response.status !== 200 || !response.value) { state(browserWorkspaceStringValuesV1[51] as string, "Speicherergebnis nicht bestätigt. Zuerst gespeichertes Profil neu laden; niemals blind erneut schreiben."); return; }
      // Required readback is a second real backend read, not the POST reply.
      const target = await request("GET"); if (signal.aborted) return;
      if ([401, 403].includes(target.status)) { denied(); state(browserWorkspaceStringValuesV1[2] as string, "Session gewechselt oder abgelaufen; Speicherung nicht mehr lesbar. Kein bestätigter Abschluss in diesem Browser."); return; }
      if (target.status !== 200 || !target.value || target.value.revision !== expected + 1 || JSON.stringify(target.value.profile) !== JSON.stringify(proposed)) { state(browserWorkspaceStringValuesV1[51] as string, "Zielreadback abweichend oder nicht verfügbar. Keine Erfolgsmeldung; zuerst gespeichertes Profil neu laden."); return; }
      readback = target.value; draft = copy(target.value.profile); blocked = false; proposal = null; apply(); state("SAVED", "Darstellung gespeichert und aus dem Backend wieder gelesen, Revision " + readback.revision + ".");
    } catch { if (!signal.aborted) state(browserWorkspaceStringValuesV1[51] as string, "Speicherergebnis unbekannt. Keine Erfolgsmeldung und kein Retry. Zuerst gespeichertes Profil neu laden."); }
    finally { if (!signal.aborted) { busy = false; save.disabled = blocked; reset.disabled = blocked; reload.disabled = false; renderRows(); } }
  }
  const compositionBridge:WorkspaceProfileCompositionBridgeV1={root:editor,current:()=>signal.aborted?null:readback?resolved():null,editable:()=>!!readback&&!busy&&!blocked&&!signal.aborted,replace(profile){if(!readback||busy||blocked||signal.aborted)return false;draft=validateBrowserProfileV1(profile);changed();renderRows();return true;},protect(required,managed){protectedItems=required;managedItems=managed;renderRows();},subscribe(fn){compositionListeners.add(fn);return()=>compositionListeners.delete(fn);},open(){const details=root.closest('details');if(details)details.open=true;editor.hidden=false;toggle.setAttribute('aria-expanded','true');}};
  Object.defineProperty(root,Symbol.for('pansphaira.personal-profile-editor/v1'),{value:Object.freeze(compositionBridge)});
  signal.addEventListener("abort", () => { serial++; rowsLifetime.abort(); diffLifetime.abort(); blocked = true; readback = null; proposal = null;compositionListeners.clear(); root.replaceChildren(); }, { once: true });
  // On focus reread only for authority/revision projection; never discard a dirty
  // draft or automatically merge concurrent edits. Session replacement clears it.
  async function checkBinding() {
    if (signal.aborted || busy) return;
    try { const result = await request("GET"); if (signal.aborted) return;
      if ([401, 403].includes(result.status)) { denied(); state(browserWorkspaceStringValuesV1[2] as string, "Session gewechselt oder Zugriff verweigert. Darstellung darf keine Rechte wiederbeleben."); }
      else if (result.value && readback) { readback = { ...readback, catalog: result.value.catalog, effectiveItems: result.value.effectiveItems, orphaned: result.value.orphaned }; apply(); renderRows(); }
    } catch { /* a failed read never grants a new contribution */ }
  }
  window.addEventListener("focus", () => { void checkBinding(); }, { signal });
  await load();
  return { refreshAuthority: checkBinding, isDirty(){return !!readback&&(!!proposal||JSON.stringify(draft)!==JSON.stringify(readback.profile));},async discard(){if(busy||signal.aborted)return false;await load();return status.dataset.profileState==='READY';},visible(id: string) { return !!readback && resolved().effectiveItems.some(i => i.id === id && i.visible); }, setVisible(id: string) { if (!readback || (blocked && !legacyOnly) || busy || !readback.catalog.some(i => i.id === id && i.state === browserWorkspaceStringValuesV1[43])) return false; const item = draft.items.find(i => i.id === id); if (!item) return false; item.visible = true; if (legacyOnly) apply(); else changed(); renderRows(); return true; } };
}

import {WORKSPACE_LAYOUT_CATALOG_V1,WORKSPACE_PRESENTATION_WIDTHS_V1,WORKSPACE_DESIGN_PROFILES_V1,defaultWorkspaceAppearanceV1,workspaceAppearancePresetV1,workspaceDesignProfileV1,validateWorkspaceAppearanceV1,validateWorkspaceAppearanceReadV1,type WorkspaceAppearanceV1,type WorkspaceAppearanceReadV1,type WorkspaceDesignIdV1} from '../../contracts/src/browser-profile-v1.js';
import {workspaceCardsV1,setWorkspaceNavigationCompositionV1} from '../../browser-shell/src/registry-v1.js';
import {WORKSPACE_PROFILE_MODULES_V1,WORKSPACE_PROFILE_CARDS_V1,WORKSPACE_REQUIRED_PROFILE_SLOTS_V1,workspaceCompositionEntryV1,workspaceCompositionRequiredV1,type BrowserProfileItemV1,type WorkspaceCompositionEntryV1} from '../../contracts/src/browser-profile-v1.js';
type Options={readonly base:string;readonly sessionId:string;readonly signal:AbortSignal;readonly main:HTMLElement;readonly nav:HTMLElement;readonly assistantHost:HTMLElement;readonly context:()=>{tenantId:string;objectId:string|null;revision:number};readonly routes:()=>readonly {pluginId:string;path:string|null;label:string;state:string}[];readonly openEditor:()=>boolean;readonly openInfo:()=>void;readonly denied:()=>void;readonly primaryArea:(area:'TASK'|'ASSISTANT')=>void;readonly changed:()=>void};
const same=(a:WorkspaceAppearanceV1,b:WorkspaceAppearanceV1)=>JSON.stringify(a)===JSON.stringify(b);
function el<K extends keyof HTMLElementTagNameMap>(tag:K,label=''){const node=document.createElement(tag);node.textContent=label;return node;}
export function createWorkspaceAppearanceEditorV1(o:Options){
 let focusPrimaryPending=false,wasFocus=false,areaBeforeFocus:'TASK'|'ASSISTANT'='TASK';
 let closed=false,busy=false,blocked=false,unknown=false,serial=0,readback:WorkspaceAppearanceReadV1|null=null,draft=defaultWorkspaceAppearanceV1(),pending:WorkspaceAppearanceV1|null=null,attempted:WorkspaceAppearanceV1|null=null,lastAttempt:{beforeRevision:number;appearance:WorkspaceAppearanceV1}|null=null;
 const session=document.querySelector('.product-session');if(!session)throw Error('APPEARANCE_HOST_MISSING');
 const root=el('div');root.id='workspace.appearance';root.className='workspace-appearance-controls';root.dataset.state='LOADING';
 const launch=el('button','Design · Notebook');launch.type='button';launch.className='appearance-launch';launch.setAttribute('aria-label','Design und Layout konfigurieren');launch.setAttribute('aria-haspopup','dialog');
 const badge=el('small','Essential · 2D');badge.className='appearance-chip';root.append(launch,badge);session.insertBefore(root,document.getElementById('shell.logout'));
 const dialog=el('dialog');dialog.id='workspace.appearance-dialog';dialog.className='appearance-dialog';dialog.setAttribute('aria-labelledby','workspace.appearance-title');
 const title=el('h2','Design und Layout');title.id='workspace.appearance-title';const intro=el('p','Fünf kuratierte Ansichten derselben registrierten Komponenten. Änderungen sind zuerst lokale Vorschau; Fachkontext und laufende Entwürfe bleiben bestehen.');
 const close=el('button','Zur Arbeitsfläche');close.type='button';close.className='appearance-close';close.addEventListener('click',()=>dialog.close(),{signal:o.signal});
 const status=el('p','Gespeicherte Erscheinung wird geladen …');status.setAttribute('role','status');status.className='appearance-status';
 const fields=el('fieldset');fields.className='appearance-fields';fields.append(el('legend','Persönliche Darstellung · Katalog 1.0.0'));
 function select(id:string,label:string,values:readonly (readonly [string,string])[]){const wrap=el('label'),caption=el('span',label),input=el('select');input.id=id;input.setAttribute('aria-label',label);for(const[value,name]of values){const option=el('option',name);option.value=value;input.append(option);}wrap.append(caption,input);fields.append(wrap);return input;}
 const template=select('workspace.appearance-template','Designprofil',WORKSPACE_DESIGN_PROFILES_V1.map(p=>[p.id,p.name]as const));
 const layout=select('workspace.appearance-layout','Arbeitslayout',WORKSPACE_LAYOUT_CATALOG_V1.map(layout=>[layout.id,layout.name]as const));
 const density=select('workspace.appearance-density','Informationsdichte',[['compact','Kompakt'],['comfortable','Normal'],['spacious','Großzügig']]);
 const agent=select('workspace.appearance-agent','Agentenpräsentation',[['hidden','Ausgeblendet'],['chip','Statuschip'],['docked','Angedocktes Panel'],['floating','Schwebendes Panel'],['focus','Fokuspanel']]);
 const motion=select('workspace.appearance-motion','Bewegung',[['system','Systempräferenz beachten'],['reduced','Reduziert'],['normal','Kurze Übergänge']]);
 const quality=el('p','Grafik: Essential / 2D in allen Vorlagen. Rich, 3D, Modell und Audio sind hier nicht freigegeben oder umgesetzt.');quality.className='appearance-quality';
 const actions=el('div');actions.className='appearance-actions';
 function button(label:string,action:()=>void){const b=el('button',label);b.type='button';b.addEventListener('click',action,{signal:o.signal});actions.append(b);return b;}
 const preview=button('Änderungen prüfen',()=>{if(busy||blocked||unknown||!readback)return;pending=Object.freeze(validateWorkspaceAppearanceV1(draft));diff.hidden=false;comparison.textContent=describe(readback.appearance)+' → '+describe(pending);say('PREVIEW_ONLY','Vorher/Nachher geprüft. Noch nichts gespeichert; nur diese Erscheinung wird bestätigt.');});
 const cancel=button('Erscheinungsentwurf verwerfen',()=>{void discard();});
 const reload=button('Gespeicherte Erscheinung neu laden',()=>{void load(true);});
 const restore=button('Vorherige Erscheinung als Vorschau',()=>{if(!readback?.previousAppearance||busy||unknown)return;change(readback.previousAppearance);});
 const defaults=button('Notebookstandard als Vorschau',()=>{if(!busy&&!unknown)change(defaultWorkspaceAppearanceV1());});
 const diff=el('section');diff.className='appearance-diff';diff.hidden=true;const comparison=el('p'),confirm=el('button','Genau diese Erscheinung bestätigen und speichern');confirm.type='button';confirm.addEventListener('click',()=>{void save();},{signal:o.signal});diff.append(el('h3','Explizite Bestätigung'),comparison,confirm);
 const reconcile=el('button','Unklaren Erscheinungsausgang unabhängig lesen');reconcile.type='button';reconcile.hidden=true;reconcile.addEventListener('click',()=>{void reconcileUnknown();},{signal:o.signal});
 dialog.append(close,title,intro,fields,quality,status,actions,diff,reconcile);document.body.append(dialog);
 const safety=el('p','Darstellung verleiht keine Rechte. Fachaktionen bleiben an native Prüfung, Berechtigung und ausdrückliche Bestätigung gebunden.');safety.id='workspace.required-boundary';safety.className='workspace-required-boundary';safety.setAttribute('role','note');document.querySelector('.workspace-context-details')?.before(safety);
 const heading=el('div');heading.className='workspace-profile-heading';heading.append(el('small','GEMEINSAMER ARBEITSPLATZ'),el('h2'),el('p'));document.querySelector('.workspace-workarea')?.prepend(heading);
 const palette=el('section');palette.className='workspace-profile-palette';palette.append(el('h2','Modulbausteine'));const moduleList=el('div'),canvasList=el('div');canvasList.className='profile-palette-canvas';palette.append(el('p','Vorhandene Bereiche öffnen oder Bausteine im Canvas finden. Kein Drag-and-drop.'),moduleList,el('h3','Im aktuellen Canvas'),canvasList);document.querySelector('.workspace-sidebar')?.prepend(palette);
 const inspector=el('section');inspector.className='workspace-design-inspector';inspector.setAttribute('aria-label','Registrierte Arbeitsbausteine');const cardList=el('div'),scope=el('p');inspector.append(el('h2','Deine Bausteine'),el('p','Registrierte Darstellung, keine Plugininstallation. Eigenschaften werden erst im vorhandenen Editor bearbeitet.'),scope,cardList);const edit=el('button','Vorhandene Arbeitsansicht bearbeiten');edit.type='button';edit.addEventListener('click',()=>{o.openEditor();},{signal:o.signal});const info=el('button','Native Beleginformationen öffnen');info.type='button';info.addEventListener('click',o.openInfo,{signal:o.signal});const inventory=el('details');inventory.className='profile-card-inventory';inventory.append(el('summary','Registrierte Canvasbausteine'),cardList);inspector.append(edit,info,inventory);o.assistantHost.prepend(inspector);
 const propertiesHost=el('div');propertiesHost.dataset.prismPropertiesHost='';propertiesHost.append(el('p','Wähle einen registrierten Baustein zum Konfigurieren. Änderungen bleiben bis zur ausdrücklichen Profilbestätigung lokale Vorschau.'));inspector.append(propertiesHost);
 const agentChip=el('button','Lokale Assistenz anzeigen');agentChip.type='button';agentChip.className='workspace-agent-chip';agentChip.addEventListener('click',()=>{document.body.dataset.agentOverride=document.body.dataset.agentOverride==='docked'?'':'docked';o.changed();},{signal:o.signal});document.querySelector('.workspace-toolbar')?.append(agentChip);
 // Stateless curated presentation surfaces. No native owner, input or card is cloned.
 const command=el('section');command.className='profile-command';command.setAttribute('aria-label','Orbit Kommandoübersicht');const commandScope=el('p');commandScope.className='profile-command-scope';const commandActions=el('div');commandActions.className='profile-command-actions';command.append(heading,commandScope,commandActions);
 const localTools=el('button','Lokale Werkzeuge');localTools.type='button';localTools.addEventListener('click',()=>o.primaryArea('ASSISTANT'),{signal:o.signal});const inspectContext=el('button','Kontext prüfen');inspectContext.type='button';inspectContext.addEventListener('click',()=>o.main.querySelector<HTMLButtonElement>('button[data-workspace-view="CONTEXT"]')?.click(),{signal:o.signal});commandActions.append(localTools,inspectContext);
 const domains=el('section');domains.className='profile-domain-strip';domains.setAttribute('aria-label','Vorhandene registrierte Arbeitsbereiche');const domainTitle=el('h2','Deine verbundenen Arbeitsbereiche'),domainHint=el('p','Nur vorhandene registrierte Wege. Keine Plugininstallation oder neue Rechte.'),domainCards=el('div');domainCards.className='profile-domain-cards';domains.append(domainTitle,domainHint,domainCards);domains.addEventListener('click',event=>{const b=(event.target as Element|null)?.closest<HTMLButtonElement>('button[data-registered-route]');if(!b||b.disabled)return;const native=[...o.nav.querySelectorAll<HTMLButtonElement>('button[data-workspace-module]')].find(n=>n.dataset.workspaceModule===b.dataset.registeredRoute);if(native&&!native.disabled)native.click();},{signal:o.signal});
 const workflowHeading=el('header');workflowHeading.className='profile-workflow-heading';workflowHeading.append(el('h2','Dein nächster Arbeitsablauf'),el('p','Vorhandene Lese- und Ansichtsschritte · Automatisierte Workflows: Noch nicht angebunden.'));
 const designer=el('section');designer.className='profile-layout-chooser';designer.setAttribute('aria-label','Prism verfügbare Arbeitslayouts');designer.append(el('span','Layouts'));const layoutButtons:HTMLButtonElement[]=[];for(const entry of WORKSPACE_LAYOUT_CATALOG_V1){const b=el('button');b.type='button';b.dataset.curatedLayout=entry.id;const thumbnail=el('span');thumbnail.className='profile-layout-thumbnail';thumbnail.setAttribute('aria-hidden','true');b.append(thumbnail,el('span',entry.name));b.addEventListener('click',()=>{if(!busy&&!unknown&&!blocked)change({...draft,layout:entry.id});},{signal:o.signal});layoutButtons.push(b);designer.append(b);}const configure=el('button','Vorschau & Bestätigung');configure.type='button';configure.className='profile-layout-confirm';configure.addEventListener('click',()=>{dialog.showModal();if(isDirty()&&!preview.disabled)preview.click();else template.focus();},{signal:o.signal});designer.append(configure);const propertiesOpen=el('button','Bausteine konfigurieren');propertiesOpen.type='button';propertiesOpen.className='profile-layout-properties';propertiesOpen.dataset.prismPropertiesOpen='';propertiesOpen.addEventListener('click',()=>composition.openProperties(),{signal:o.signal});designer.append(propertiesOpen);
 inspector.querySelector('h2')!.textContent='Eigenschaften & Konfiguration';inspector.querySelector('p')!.textContent='Bausteingröße, Reihenfolge und Sichtbarkeit verwenden denselben persönlichen Profilentwurf. Rechnungsfelder bleiben im vorhandenen nativen Vieweditor. Kein Drag-and-drop.';edit.textContent='Vorhandene Arbeitsansicht bearbeiten';
 const reduced=matchMedia('(prefers-reduced-motion: reduce)');
 function projectWidth(){if(closed)return;const body=document.body,width=body.clientWidth,p=WORKSPACE_PRESENTATION_WIDTHS_V1,value=width<=p.tinyMaximum?'tiny':width<=p.narrowMaximum?'narrow':width<p.railMinimum?'medium':'wide';if(body.dataset.presentationWidth!==value)body.dataset.presentationWidth=value;
  const dark=workspaceDesignProfileV1(draft.templateId).scheme==='dark',expected=value==='tiny'||value==='narrow'||dark&&value==='medium'?'grid':'flex';
  // Actual multi-profile resize reproduced stale native CSS even after CSSOM writes.
  // Reattach the SAME presentation node only when its computed mode is stale.
  // Do not call registry.render, remount a controller or replace native children.
  if(o.nav.isConnected&&getComputedStyle(o.nav).display!==expected){const parent=o.nav.parentNode,next=o.nav.nextSibling,focused=o.nav.contains(document.activeElement)?document.activeElement as HTMLElement:null;if(parent){parent.removeChild(o.nav);parent.insertBefore(o.nav,next);if(focused?.isConnected)focused.focus({preventScroll:true});}}
 }
 const widthObserver=new ResizeObserver(projectWidth);widthObserver.observe(document.body);window.addEventListener('resize',projectWidth,{signal:o.signal});projectWidth();
 function motionState(){document.body.dataset.effectiveMotion=draft.motion==='reduced'||draft.motion==='system'&&reduced.matches?'reduced':'normal';}
 reduced.addEventListener('change',motionState,{signal:o.signal});
 function describe(v:WorkspaceAppearanceV1){return [workspaceDesignProfileV1(v.templateId).name,v.layout,v.density,v.agentPresentation,v.motion].join(' · ');}
 function apply(value:WorkspaceAppearanceV1){
  draft=validateWorkspaceAppearanceV1(value);const p=workspaceDesignProfileV1(draft.templateId),body=document.body;body.dataset.designProfile=p.id;body.dataset.designScheme=p.scheme;body.dataset.workspaceLayout=draft.layout;body.dataset.informationDensity=draft.density;body.dataset.agentPresentation=draft.agentPresentation;body.dataset.graphicsQuality='essential';body.dataset.motionPreference=draft.motion;body.dataset.agentOverride='';
  for(const[name,value]of Object.entries(p.tokens))body.style.setProperty('--ui-'+name,value);
  motionState();composition.setPrism(p.id==='prism');command.remove();domains.remove();designer.remove();workflowHeading.remove();const workarea=document.querySelector('.workspace-workarea'),canvas=document.getElementById('profile.canvas'),focus=p.id==='jarvis'&&draft.agentPresentation==='focus';
  if(p.id==='notebook')heading.remove();else if(p.id==='orbit'){command.prepend(heading);canvas?.before(command,domains);}else if(focus){o.assistantHost.prepend(heading);o.assistantHost.after(domains);}else workarea?.prepend(heading);
  if(p.id==='prism'){document.querySelector('.workspace-sidebar')?.prepend(palette);o.assistantHost.prepend(inspector);canvas?.before(designer);}else{palette.remove();inspector.remove();}
  if(focus&&!wasFocus){areaBeforeFocus=body.dataset.mobileWorkArea==='ASSISTANT'?'ASSISTANT':'TASK';focusPrimaryPending=true;}else if(!focus&&wasFocus){focusPrimaryPending=false;o.primaryArea(areaBeforeFocus);}wasFocus=focus;
  heading.querySelector('h2')!.textContent=p.name;heading.querySelector('p')!.textContent=p.description;launch.textContent='Design · '+p.name.split(' ')[0];for(const b of layoutButtons)b.setAttribute('aria-pressed',String(b.dataset.curatedLayout===draft.layout));schedule();
  template.value=draft.templateId;layout.value=draft.layout;density.value=draft.density;agent.value=draft.agentPresentation;motion.value=draft.motion;
  root.dataset.dirty=String(isDirty());badge.textContent=(isDirty()?'Vorschau · ':'')+'Essential · 2D';projectWidth();o.changed();
 }
 function say(state:string,message:string){if(closed)return;root.dataset.state=state;status.textContent=message;update();}
 function update(){const dirty=isDirty();root.dataset.dirty=String(dirty);badge.textContent=(dirty?'Vorschau · ':'')+'Essential · 2D';fields.disabled=busy||unknown;preview.disabled=busy||blocked||unknown||!readback||!dirty;confirm.disabled=busy||blocked||unknown||!pending||pending===attempted;cancel.disabled=busy||unknown||!readback;reload.disabled=busy||unknown;restore.disabled=busy||unknown||!readback?.previousAppearance;defaults.disabled=busy||unknown;reconcile.hidden=!unknown;}
 function isDirty(){return !closed&&(unknown||!!readback&&(readback.status==='DEFAULT_UNSUPPORTED'||!same(draft,readback.appearance)));}
 function change(value:WorkspaceAppearanceV1){pending=null;diff.hidden=true;apply(value);say('LOCAL_PREVIEW','Lokale Erscheinungsvorschau. Keine Fachwirkung und keine Speicherung. Erst prüfen und ausdrücklich bestätigen.');}
 template.addEventListener('change',()=>{const p=workspaceDesignProfileV1(template.value);change({...draft,templateId:p.id,templateVersion:p.version});},{signal:o.signal});
 const curated=button('Kuratierte Vorlage als Vorschau',()=>{if(!busy&&!unknown)change({...workspaceAppearancePresetV1(template.value as WorkspaceDesignIdV1),motion:draft.motion});});curated.title='Layout, Informationsdichte und Agentenpräsentation ausdrücklich auf die kuratierten Vorlagenwerte setzen. Keine Speicherung.';
 for(const[input,key]of[[layout,'layout'],[density,'density'],[agent,'agentPresentation'],[motion,'motion']]as const)input.addEventListener('change',()=>change(validateWorkspaceAppearanceV1({...draft,[key]:input.value})),{signal:o.signal});
 launch.addEventListener('click',()=>{if(!closed){dialog.showModal();template.focus();}},{signal:o.signal});
 async function request(method:'GET'|'POST',value?:unknown){
  const signal=AbortSignal.any([o.signal,AbortSignal.timeout(10000)]);const response=await fetch(o.base+'/workspace/appearance',{method,credentials:'same-origin',cache:'no-store',signal,headers:{'x-pan543-session':o.sessionId,...(method==='POST'?{'content-type':'application/json'}:{})},...(value===undefined?{}:{body:JSON.stringify(value)})});
  if(response.status===401||response.status===403){o.denied();throw Error('APPEARANCE_SESSION_DENIED');}if(response.status!==200)return{status:response.status,value:null};
  const result=validateWorkspaceAppearanceReadV1(await response.json()),binding=await fetch(o.base+'/workspace/context',{credentials:'same-origin',cache:'no-store',signal});if(binding.status!==200||(await binding.json()as{sessionId?:string}).sessionId!==o.sessionId){o.denied();throw Error('APPEARANCE_SESSION_DENIED');}return{status:200,value:result};
 }
 async function load(explicit=false){if(closed||busy||unknown)return;const n=++serial;busy=true;update();try{const r=await request('GET');if(closed||n!==serial)return;if(!r.value)throw Error('APPEARANCE_UNAVAILABLE');readback=r.value;blocked=false;pending=null;diff.hidden=true;apply(readback.appearance);say(readback.status==='DEFAULT_UNSUPPORTED'?'DEFAULT_UNSUPPORTED':'READY',readback.status==='DEFAULT_UNSUPPORTED'?'Gespeicherte Erscheinung unbekannt/ungültig. Notebookfallback nur Vorschau; Ersatz braucht ausdrückliche Bestätigung.':'Erscheinung nativ gelesen · Revision '+readback.revision+(explicit?' · ausdrücklich neu geladen.':'.'));}catch{if(!closed)say('UNAVAILABLE','Erscheinungsreadback nicht bestätigt. Native Arbeit und Abmelden bleiben unabhängig; kein gespeicherter Erfolg.');}finally{busy=false;update();}}
 async function discard(){if(closed||busy||unknown||!readback)return false;pending=null;diff.hidden=true;apply(readback.appearance);say('LOCAL_DRAFT_DISCARDED','Nur der Erscheinungsentwurf verworfen. Fach-, Modulansicht- und Assistentenzustand unverändert.');return true;}
 async function save(){
  if(closed||busy||blocked||unknown||!pending||pending===attempted||!readback)return;const candidate=pending,beforeRevision=readback.revision;attempted=candidate;lastAttempt={beforeRevision,appearance:candidate};busy=true;update();
  try{const result=await request('POST',{schemaVersion:'pansphaira.workspace-appearance/write/v1',expectedRevision:beforeRevision,appearance:candidate});if(closed)return;if(result.status===409){blocked=true;pending=null;diff.hidden=true;say('CONFLICT','Andere Ansicht hat inzwischen gespeichert. Vorschau bleibt; kein Überschreiben oder Retry. Erst ausdrücklich neu laden.');return;}if(!result.value)throw Error('APPEARANCE_WRITE_UNKNOWN');
   const fresh=await request('GET');if(closed)return;if(!fresh.value||fresh.value.revision!==beforeRevision+1||!same(fresh.value.appearance,candidate))throw Error('APPEARANCE_WRITE_UNKNOWN');readback=fresh.value;pending=null;diff.hidden=true;apply(readback.appearance);say('SAVED_AND_READBACK_CONFIRMED','Erscheinung bestätigt, mit CAS gespeichert und frisch unabhängig gelesen · Revision '+readback.revision+'.');
  }catch{if(!closed){unknown=true;say('WRITE_OUTCOME_UNKNOWN','Schreibausgang unklar. Keine Erfolgsmeldung, kein blinder Wiederholungsauftrag. Nur unabhängig zurücklesen.');}}finally{busy=false;update();}
 }
 async function reconcileUnknown(){if(closed||busy||!unknown||!lastAttempt)return;busy=true;update();try{const result=await request('GET');if(closed||!result.value)return;const expected=lastAttempt;unknown=false;if(result.value.revision===expected.beforeRevision+1&&same(result.value.appearance,expected.appearance)){readback=result.value;pending=null;diff.hidden=true;apply(readback.appearance);say('SAVED_AND_READBACK_CONFIRMED','Unabhängiger Zielread bestätigt genau den einmal versuchten CAS. Kein Schreibretry.');}else{blocked=true;pending=null;diff.hidden=true;say('CONFLICT','Zielread passt nicht genau zum versuchten CAS. Kein Erfolg behauptet; vorhandene Vorschau erhalten. Ausdrücklich neu laden.');}}catch{if(!closed)say('WRITE_OUTCOME_UNKNOWN','Zielread noch nicht bestätigt. Weiterhin kein Retry.');}finally{busy=false;update();}}
moduleList.addEventListener('click',event=>{const b=(event.target as Element|null)?.closest<HTMLButtonElement>('button[data-registered-route]');if(!b||b.disabled)return;const native=[...o.nav.querySelectorAll<HTMLButtonElement>('button[data-workspace-module]')].find(n=>n.dataset.workspaceModule===b.dataset.registeredRoute);if(native&&!native.disabled)native.click();},{signal:o.signal});
 canvasList.addEventListener('click',event=>{const button=(event.target as Element|null)?.closest<HTMLElement>('[data-registered-card]');if(button)workspaceCardsV1(o.main).find(c=>c.metadata.id===button.dataset.registeredCard)?.node.scrollIntoView({block:'nearest'});},{signal:o.signal});
 cardList.addEventListener('click',event=>{const button=(event.target as Element|null)?.closest<HTMLElement>('[data-registered-card]');if(button)workspaceCardsV1(o.main).find(c=>c.metadata.id===button.dataset.registeredCard)?.node.scrollIntoView({block:'nearest'});},{signal:o.signal});
 const composition=createWorkspaceCompositionEditorV1(o,propertiesHost);canvasList.addEventListener('click',event=>{const b=(event.target as Element|null)?.closest<HTMLButtonElement>('button[data-prism-card-configure]');if(b&&!b.disabled)composition.openProperties(b.dataset.prismCardConfigure);},{signal:o.signal});
 let queued=false;
 function inspect(){if(closed)return;composition.inspect();const cards=[...workspaceCardsV1(o.main)].sort((a,b)=>Number(a.node.dataset.compositionOrder??0)-Number(b.node.dataset.compositionOrder??0));const nodes:HTMLElement[]=[];for(const c of cards){const row=el('button',c.metadata.label+(c.metadata.required?' · Pflichtkontext':'')+(c.node.hidden?' · persönlich ausgeblendet':''));row.type='button';row.dataset.registeredCard=c.metadata.id;row.disabled=!!c.node.hidden;row.setAttribute('aria-label',c.metadata.label+' im vorhandenen Canvas finden');nodes.push(row);}cardList.replaceChildren(...nodes);const paletteNodes=cards.map(c=>{const b=el('button',c.metadata.label);b.type='button';b.dataset.registeredCard=c.metadata.id;b.disabled=!!c.node.hidden;b.setAttribute('aria-label',c.metadata.label+' im vorhandenen Canvas finden');b.append(el('small',c.node.hidden?'Persönlich ausgeblendet · über + auswählen':c.metadata.required?'Pflichtkontext · im Canvas finden':'Im Canvas finden'));const row=el('div');row.className='profile-palette-card-row';const configure=el('button','⚙');configure.type='button';configure.dataset.prismCardConfigure=c.metadata.id;configure.setAttribute('aria-label',c.metadata.label+' konfigurieren');configure.title=c.metadata.label+' konfigurieren';configure.disabled=!composition.canConfigure(c.metadata.id);row.append(b,configure);return row;});canvasList.replaceChildren(...paletteNodes);propertiesOpen.disabled=!composition.canConfigure();edit.disabled=!cards.length;try{const c=o.context();scope.textContent='Mandant '+c.tenantId+' · '+(c.objectId??'kein Beleg ausgewählt')+' · Kontextrevision '+c.revision;}catch{scope.textContent='Kein bestätigter Sitzungskontext.';}const nativeNavigation=[...o.nav.querySelectorAll<HTMLButtonElement>('button[data-workspace-module]')];const routes=o.nav.dataset.compositionNavigation==='true'?nativeNavigation.filter(b=>!b.hidden).flatMap(b=>o.routes().filter(r=>r.path===b.dataset.workspaceModule)):o.routes();const routeRows:HTMLElement[]=[];for(const route of routes){const button=el('button',route.label);button.type='button';button.disabled=route.state!=='REGISTERED';button.dataset.registeredRoute=route.path??'';routeRows.push(button);}moduleList.replaceChildren(...routeRows);const domainRows:HTMLElement[]=[];for(const route of routes){const native=nativeNavigation.find(n=>n.dataset.workspaceModule===route.path);const b=el('button');b.type='button';b.dataset.registeredRoute=route.path??'';b.disabled=route.state!=='REGISTERED'||!native||native.disabled;const icon=native?.querySelector('svg')?.cloneNode(true)as SVGElement|undefined;if(icon){icon.setAttribute('aria-hidden','true');icon.querySelectorAll('[id]').forEach(n=>n.removeAttribute('id'));b.append(icon);}b.append(el('strong',native?.querySelector('.nav-label')?.textContent??route.label),el('small',b.disabled?'Noch nicht angebunden':'Registriert · vorhandenen Bereich öffnen'));domainRows.push(b);}for(const native of o.nav.querySelectorAll<HTMLButtonElement>('button[data-reference-module]:disabled')){const b=el('button');b.type='button';b.disabled=true;b.dataset.unboundDomainSlot=native.dataset.referenceModule??'';b.append(el('strong',native.querySelector('.nav-label')?.textContent??native.textContent??'Nicht angebunden'),el('small','Noch nicht angebunden'));domainRows.push(b);}domainCards.replaceChildren(...domainRows);domainHint.textContent=draft.templateId==='jarvis'?'Vorhandene lokale Werkzeuge · Essential / 2D · kein Mikrofon, kein KI-Modell.':'Nur vorhandene registrierte Wege. Nicht angebundene Bereiche sind deaktiviert.';if(draft.templateId==='orbit'){const work=o.main.querySelector('.erv-review-layout');if(work&&workflowHeading.parentElement!==work)work.append(workflowHeading);}try{const c=o.context();commandScope.textContent='AKTUELLER KONTEXT · '+c.tenantId+' · '+(c.objectId??'kein Beleg ausgewählt')+' · Revision '+c.revision;}catch{commandScope.textContent='Kein bestätigter Sitzungskontext';}const hasAgent=!!o.assistantHost.querySelector('[id="shell.agent-panel"]');agentChip.hidden=!hasAgent||!['hidden','chip'].includes(draft.agentPresentation);agentChip.textContent=hasAgent?'Lokale Assistenz · Panel anzeigen':'Assistenz nicht angebunden';localTools.disabled=!hasAgent;inspectContext.disabled=!o.main.querySelector<HTMLButtonElement>('button[data-workspace-view="CONTEXT"]:not(:disabled)');if(focusPrimaryPending&&hasAgent){focusPrimaryPending=false;o.primaryArea('ASSISTANT');}const source=o.main.querySelector<HTMLElement>('[data-card-role="references"]');if(source&&!source.querySelector('.profile-activity-unavailable')){const note=el('p','Aktivitätshistorie: Noch nicht angebunden.');note.className='profile-activity-unavailable';source.append(note);}nativeAmountChart();}
 function schedule(){if(queued||closed)return;queued=true;queueMicrotask(()=>{queued=false;inspect();});}
 const observer=new MutationObserver(schedule);observer.observe(o.main,{childList:true,subtree:true});observer.observe(o.nav,{childList:true});observer.observe(o.assistantHost,{childList:true});
 function nativeAmountChart(){const record=o.main.querySelector<HTMLElement>('[data-card-role="summary"]');if(!record||record.querySelector('.native-amount-comparison'))return;const amounts=[...record.querySelectorAll<HTMLElement>('[data-native-amount-minor]')].map(n=>({label:n.querySelector('dt')?.textContent??'',display:n.querySelector('dd')?.textContent??'',value:Number(n.dataset.nativeAmountMinor),currency:n.dataset.nativeCurrency,revision:n.dataset.nativeRevision}));if(amounts.length!==3||amounts.some(v=>!Number.isSafeInteger(v.value))||new Set(amounts.map(v=>v.currency)).size!==1||new Set(amounts.map(v=>v.revision)).size!==1)return;
 const figure=el('figure');figure.className='native-amount-comparison';figure.dataset.sourceRevision=amounts[0]!.revision;figure.dataset.currency=amounts[0]!.currency;figure.append(el('figcaption','Beträge im direkten Vergleich'),el('p','Aktuelle Rechnung · '+amounts[0]!.currency+' · nativer Stand '+amounts[0]!.revision));const ns='http://www.w3.org/2000/svg',svg=document.createElementNS(ns,'svg');svg.setAttribute('viewBox','0 0 600 320');svg.setAttribute('role','img');svg.setAttribute('aria-label','Rechnungsbetrag, Erwartungsbetrag und Abweichung aus demselben nativen Read; keine Zeitreihe.');const max=Math.max(1,...amounts.map(v=>Math.abs(v.value)));
 for(let j=0;j<5;j++){const line=document.createElementNS(ns,'line');line.setAttribute('x1','24');line.setAttribute('x2','576');line.setAttribute('y1',String(45+j*54));line.setAttribute('y2',String(45+j*54));line.setAttribute('class','native-comparison-guide');svg.append(line);}for(const [i,v]of amounts.entries()){const x=52+i*184,bar=document.createElementNS(ns,'rect'),value=document.createElementNS(ns,'text'),label=document.createElementNS(ns,'text');const h=108*Math.abs(v.value)/max;bar.setAttribute('x',String(x));bar.setAttribute('y',String(v.value<0?153:153-h));bar.setAttribute('width','120');bar.setAttribute('height',String(h));bar.setAttribute('rx','5');bar.setAttribute('data-native-value',String(v.value));bar.setAttribute('class','native-comparison-bar-'+i);value.setAttribute('x',String(x+60));value.setAttribute('y',String(v.value<0?170+h:Math.max(24,143-h)));value.setAttribute('text-anchor','middle');value.setAttribute('class','native-comparison-value');value.textContent=v.display;label.setAttribute('x',String(x+60));label.setAttribute('y','306');label.setAttribute('text-anchor','middle');label.textContent=v.label;svg.append(bar,value,label);}figure.append(svg,el('small','Ein Vorgang, gleiche Währung und Quellenrevision. Keine Zeitreihe, kein geografischer Bericht.'));record.append(figure);}
 function closeOwner(){if(closed)return;closed=true;serial++;composition.close();observer.disconnect();widthObserver.disconnect();if(dialog.open)dialog.close();dialog.remove();root.remove();palette.remove();inspector.remove();agentChip.remove();heading.remove();command.remove();domains.remove();designer.remove();workflowHeading.remove();safety.textContent='Sitzungsansicht beendet. Darstellung erteilt keine Rechte.';}
 o.signal.addEventListener('abort',closeOwner,{once:true});apply(draft);inspect();void load();
 return Object.freeze({isDirty,discard,close:closeOwner});
}

// This is a view of the existing personal editor's single draft/CAS owner.
// It owns no second profile, table, transport, native view or backend grant.
function createWorkspaceCompositionEditorV1(o:Options,propertiesHost:HTMLElement){
 const root=el('section');root.id='workspace.composition';root.className='workspace-composition-editor';root.hidden=true;
 const title=el('h3','Registrierte Module und Karten');title.tabIndex=-1;title.dataset.compositionTitle='true';
 const note=el('p','Nur vorhandene, vom aktuellen Owner verfügbare Beiträge. Reihenfolge, Größe und optionale Sichtbarkeit bleiben unabhängig vom Designprofil. Pflichtflächen bleiben erreichbar. Speichern erfolgt ausschließlich über die vorhandene Vorschau und ausdrückliche Profilbestätigung.');
 const status=el('p');status.setAttribute('role','status');status.dataset.compositionStatus='';
 const chooseLabel=el('label','Registrierten Beitrag auswählen '),choose=el('select');choose.setAttribute('aria-label','Registrierten Beitrag auswählen');choose.dataset.compositionChoice='';chooseLabel.append(choose);
 const add=el('button','Beitrag in Vorschau aufnehmen');add.type='button';add.dataset.compositionAdd='';
 const groups=el('div');groups.className='composition-groups';root.append(title,note,status,chooseLabel,add,groups);
 let bridge:WorkspaceProfileCompositionBridgeV1|null=null,unsubscribe:(()=>void)|null=null,closed=false,rendering=false,rowLifetime=new AbortController(),protectionKey='';
 const metadata=[...WORKSPACE_PROFILE_MODULES_V1,...WORKSPACE_PROFILE_CARDS_V1];
 // A contextual view projects the SAME existing controls and confirmation nodes.
 // Selection is local presentation only; the existing bridge owns every edit/CAS.
 let prism=false,selectedId:string|null=null,returnFocus:HTMLElement|null=null;
 const propertyPanel=el('section');propertyPanel.dataset.prismPropertiesPanel='';propertyPanel.className='prism-properties-panel';
 const propertyHeading=el('h3','Bausteinkonfiguration');propertyHeading.id='workspace.prism-properties-title';
 const propertyClose=el('button','Schließen');propertyClose.type='button';propertyClose.setAttribute('aria-label','Bausteinkonfiguration schließen');
 const propertyHeader=el('header');propertyHeader.append(propertyHeading,propertyClose);propertyPanel.append(propertyHeader);
 const propertiesDialog=el('dialog');propertiesDialog.dataset.prismPropertiesDialog='';propertiesDialog.className='prism-properties-dialog';propertiesDialog.setAttribute('aria-labelledby',propertyHeading.id);document.body.append(propertiesDialog);
 const projections:Array<{node:HTMLElement;anchor:Comment}>=[];
 function canConfigure(id?:string){const value=current();return !closed&&!!bridge?.editable()&&!!value&&available(value).some(e=>id===undefined||e.id===id);}
 function closeProperties(focus=true){
  if(selectedId===null)return;selectedId=null;delete root.dataset.compositionSelection;root.classList.remove('composition-contextual');add.hidden=false;
  for(const {node,anchor}of projections.splice(0)){if(anchor.parentNode)anchor.replaceWith(node);else node.remove();}
  propertyPanel.remove();if(propertiesDialog.open)propertiesDialog.close();
  for(const row of root.querySelectorAll<HTMLElement>('[data-profile-item]'))row.hidden=false;for(const group of [...groups.children])if(group instanceof HTMLElement)group.hidden=false;
  if(focus){const fallback=document.querySelector<HTMLElement>('[data-prism-properties-open]'),target=returnFocus?.isConnected&&returnFocus.checkVisibility()?returnFocus:fallback;if(target?.isConnected)target.focus({preventScroll:true});}returnFocus=null;
 }
 function projectSelection(){
  if(selectedId===null)return;
  const value=current();if(!prism||!value||!available(value).some(e=>e.id===selectedId)){closeProperties(false);return;}
  root.dataset.compositionSelection=selectedId;root.classList.add('composition-contextual');choose.value=selectedId;add.hidden=true;
  for(const row of root.querySelectorAll<HTMLElement>('[data-profile-item]'))row.hidden=row.dataset.profileItem!==selectedId;
  for(const group of [...groups.children])if(group instanceof HTMLElement)group.hidden=![...group.querySelectorAll<HTMLElement>('[data-profile-item]')].some(row=>!row.hidden);
  const narrow=document.body.clientWidth<=WORKSPACE_PRESENTATION_WIDTHS_V1.narrowMaximum;
  if(narrow){if(propertyPanel.parentNode!==propertiesDialog)propertiesDialog.append(propertyPanel);if(!propertiesDialog.open)propertiesDialog.showModal();}
  else{if(propertiesDialog.open)propertiesDialog.close();if(propertyPanel.parentNode!==propertiesHost)propertiesHost.append(propertyPanel);}
 }
 function openProperties(id?:string){
  inspect();if(!prism||!canConfigure(id))return false;const value=current()!;
  const entry=id?available(value).find(e=>e.id===id):available(value).find(e=>e.kind==='card')??available(value)[0];if(!entry)return false;
  if(selectedId===null){returnFocus=document.activeElement instanceof HTMLElement?document.activeElement:null;
   const tools=bridge!.root.querySelector<HTMLElement>('.profile-tools'),diff=bridge!.root.querySelector<HTMLElement>('[data-profile="diff"]');if(!tools||!diff)return false;
   for(const node of [root,tools,diff]){const anchor=document.createComment('existing profile control position');node.replaceWith(anchor);projections.push({node,anchor});propertyPanel.append(node);}
  }
  selectedId=entry.id;o.primaryArea('TASK');projectSelection();
  const size=[...root.querySelectorAll<HTMLElement>('[data-profile-item]')].find(e=>e.dataset.profileItem===selectedId)?.querySelector<HTMLElement>('[data-composition-size]');size?.focus({preventScroll:true});return true;
 }
 propertyClose.addEventListener('click',()=>closeProperties(),{signal:o.signal});propertiesDialog.addEventListener('cancel',event=>{event.preventDefault();closeProperties();},{signal:o.signal});window.addEventListener('resize',projectSelection,{signal:o.signal});

 const current=()=>bridge?.current()??null;
 const available=(value:BrowserProfileReadV1)=>metadata.filter(e=>value.catalog.some(c=>c.id===e.id&&c.version===e.version&&c.state==='AVAILABLE')&&!value.profile.items.some(i=>i.id===e.id&&i.version!==e.version));
 const configured=(value:BrowserProfileReadV1,kind:'module'|'card')=>value.profile.items.some(i=>workspaceCompositionEntryV1(i.id)?.kind===kind);
 function candidate(value:BrowserProfileReadV1,kind:'module'|'card'){
  const next=copy(value.profile);
  if(!configured(value,kind))for(const e of available(value).filter(e=>e.kind===kind))next.items.push({id:e.id,version:e.version,visible:true,size:'regular'});
  const kinds=new Set(next.items.map(i=>workspaceCompositionEntryV1(i.id)?.kind));
  for(const id of workspaceCompositionRequiredV1(value.catalog)){const e=workspaceCompositionEntryV1(id);if(e&&!kinds.has(e.kind))continue;const item=next.items.find(i=>i.id===id);if(item)item.visible=true;else{const c=value.catalog.find(c=>c.id===id&&c.state==='AVAILABLE');if(c)next.items.push({id:c.id,version:c.version,visible:true,size:'regular'});}}
  return next;
 }
 function edit(id:string,change:(item:BrowserProfileItemV1,profile:BrowserProfileV1)=>void){const value=current(),meta=workspaceCompositionEntryV1(id);if(!value||!meta||!bridge?.editable()||!available(value).some(e=>e.id===id))return;try{const next=candidate(value,meta.kind);let item=next.items.find(i=>i.id===id);if(!item){item={id,version:meta.version,visible:true,size:'regular'};next.items.push(item);}change(item,next);if(next.items.length>32){status.textContent='Der unveränderte v1-Vertrag erlaubt höchstens 32 Einträge. Keine Vorschau geändert und nichts geschrieben. Vorhandenes Profil prüfen oder Standarddarstellung ausdrücklich als Vorschau wählen.';return;}if(workspaceCompositionRequiredV1(value.catalog).some(id=>{const item=next.items.find(i=>i.id===id),entry=workspaceCompositionEntryV1(id);return item&&entry&&item.version!==entry.version;})){status.textContent='Eine gespeicherte Pflichtbeitragsversion ist nicht kompatibel. Keine automatische Ersetzung oder neue Rechte. Vorhandenes Profil prüfen oder Standarddarstellung ausdrücklich als Vorschau wählen.';return;}bridge.replace(next);}catch{status.textContent='Kompositionsvorschau nicht anwendbar. Der bestehende Profilvertrag bleibt unverändert; nichts geschrieben. Vorhandenes Profil prüfen oder ausdrücklich Standarddarstellung wählen.';}}
 function move(id:string,offset:number){edit(id,(item,next)=>{const kind=workspaceCompositionEntryV1(id)!.kind,peers=next.items.filter(i=>workspaceCompositionEntryV1(i.id)?.kind===kind),at=peers.indexOf(item),target=peers[at+offset];if(!target)return;const from=next.items.indexOf(item),to=next.items.indexOf(target);next.items.splice(from,1);next.items.splice(to,0,item);});const row=root.querySelector<HTMLElement>('[data-profile-item="'+id+'"]');if(row){row.tabIndex=-1;(row.querySelector<HTMLElement>('[data-composition-move="'+(offset<0?'up':'down')+'"]:not(:disabled)')??row).focus();}}
 function apply(value:BrowserProfileReadV1){
  const modules=value.effectiveItems.filter(i=>workspaceCompositionEntryV1(i.id)?.kind==='module'),ready=!!bridge?.editable()&&available(value).some(e=>e.kind==='module');
  const token=JSON.stringify([modules,configured(value,'module'),ready,value.catalog]);
  if(o.nav.dataset.profileCompositionStamp!==token){setWorkspaceNavigationCompositionV1(o.nav,{items:modules,configured:configured(value,'module'),ready,token});o.changed();}
  const customCards=configured(value,'card');document.body.dataset.personalCompositionCards=String(customCards);
  const order=new Map(value.profile.items.filter(i=>workspaceCompositionEntryV1(i.id)?.kind==='card').map((i,index)=>[i.id,index]));
  for(const c of workspaceCardsV1(o.main)){
   const allowed=value.catalog.some(e=>e.id===c.metadata.id&&e.state==='AVAILABLE');if(!allowed)continue;
   const node=c.node,item=value.effectiveItems.find(i=>i.id===c.metadata.id);
   if(customCards){node.hidden=!c.metadata.required&&!item?.visible;const size=item?.size??'regular',index=order.get(c.metadata.id)??32;if(node.dataset.compositionSize!==size)node.dataset.compositionSize=size;if(node.dataset.compositionOrder!==String(index)){node.dataset.compositionOrder=String(index);node.style.setProperty('--workspace-card-order',String(index));}node.dataset.compositionManaged='true';}
   else if(node.dataset.compositionManaged==='true'){node.hidden=false;delete node.dataset.compositionSize;delete node.dataset.compositionOrder;delete node.dataset.compositionManaged;node.style.removeProperty('--workspace-card-order');}
  }
  // DOM and keyboard/AX order follow the same bounded personal order, not just
  // CSS placement. Move the same native nodes; never clone/remount their owners.
  const layout=o.main.querySelector('.erv-review-layout');if(layout){const entries=workspaceCardsV1(o.main).filter(c=>c.node.parentNode===layout),desired=[...entries].sort((a,b)=>(customCards?order.get(a.metadata.id)??32:WORKSPACE_PROFILE_CARDS_V1.findIndex(e=>e.id===a.metadata.id))-(customCards?order.get(b.metadata.id)??32:WORKSPACE_PROFILE_CARDS_V1.findIndex(e=>e.id===b.metadata.id)));const focused=document.activeElement as HTMLElement|null;for(let index=0;index<desired.length;index++){const peer=[...layout.children].filter(e=>(e as HTMLElement).dataset.workspaceCardId)[index],node=desired[index]!.node;if(peer&&peer!==node)layout.insertBefore(node,peer);}if(focused?.isConnected&&document.activeElement!==focused)focused.focus({preventScroll:true});}
 }
 function paint(){
  if(closed||rendering||!bridge)return;rendering=true;
  try{const value=current();if(!value){root.hidden=true;return;}const entries=available(value),supported=entries.some(e=>e.kind==='module');root.hidden=!supported;if(!supported)return;
   const nextProtection=JSON.stringify(value.catalog);if(protectionKey!==nextProtection){protectionKey=nextProtection;bridge.protect(new Set(workspaceCompositionRequiredV1(value.catalog)),new Set(metadata.map(e=>e.id)));}
   rowLifetime.abort();rowLifetime=new AbortController();const signal=AbortSignal.any([o.signal,rowLifetime.signal]);groups.replaceChildren();
   const editable=bridge.editable(),unsafe=WORKSPACE_REQUIRED_PROFILE_SLOTS_V1.some(id=>!value.profile.items.some(i=>i.id===id&&i.visible));
   status.textContent=unsafe?'Gespeicherte v1-Ausblendung einer Pflichtfläche wird nicht angewendet. Die gespeicherten Bytes bleiben unverändert. Standarddarstellung oder eine neue Kompositionsvorschau ausdrücklich prüfen und bestätigen.':configured(value,'module')||configured(value,'card')?'Persönliche Komposition · derselbe Profilowner, Revision '+value.revision+'. Lokale Änderungen sind noch kein gespeicherter Readback.':'Noch keine individuelle Modul-/Kartenkomposition gespeichert: Originalvorlage als Default. Öffnen allein verändert weder Profil noch Revision.';
   root.dataset.compositionState=editable?'READY':'BLOCKED';root.dataset.profileRevision=String(value.revision);
   const empty=el('option','Vorhandenen Beitrag auswählen');empty.value='';choose.replaceChildren(empty);for(const e of entries){const option=el('option',(e.kind==='module'?'Modul · ':'Karte · ')+e.label+(e.required?' · Pflicht':''));option.value=e.id;choose.append(option);}choose.disabled=!editable;add.disabled=true;
   for(const kind of ['module','card']as const){const fieldset=el('fieldset');fieldset.append(el('legend',kind==='module'?'Module · Band und Seitenleiste':'Karten · aktueller nativer Canvas'));
    const items=configured(value,kind)?value.profile.items.filter(i=>workspaceCompositionEntryV1(i.id)?.kind===kind):entries.filter(e=>e.kind===kind).map(e=>({id:e.id,version:e.version,visible:true,size:'regular' as const}));
    for(const item of items){const meta=workspaceCompositionEntryV1(item.id)!;const enabled=editable&&entries.some(e=>e.id===item.id&&e.version===item.version);const row=el('div');row.className='composition-row';row.dataset.profileItem=item.id;row.dataset.compositionKind=kind;row.append(el('h4',meta.label));
     const label=el('label'),check=el('input');check.type='checkbox';check.checked=item.visible;check.disabled=!enabled||meta.required;check.setAttribute('aria-label',meta.label+' anzeigen');check.dataset.compositionVisible='';label.append(check,el('span',meta.required?'Pflicht · sichtbar lassen':'Anzeigen'));check.addEventListener('change',()=>{if(!meta.required)edit(item.id,i=>{i.visible=check.checked;});},{signal});
     const sizeLabel=el('label','Größe '),size=el('select');size.setAttribute('aria-label',meta.label+' Größe');size.dataset.compositionSize='';for(const[v,name]of[['compact','Kompakt'],['regular','Normal'],['large','Groß']]as const){const opt=el('option',name);opt.value=v;size.append(opt);}size.value=item.size;size.disabled=!enabled;size.addEventListener('change',()=>{if(sizes.includes(size.value as typeof sizes[number]))edit(item.id,i=>{i.size=size.value as typeof sizes[number];});},{signal});sizeLabel.append(size);
     const up=el('button',meta.label+' nach oben'),down=el('button',meta.label+' nach unten');up.type=down.type='button';up.dataset.compositionMove='up';down.dataset.compositionMove='down';up.disabled=!enabled||items[0]?.id===item.id;down.disabled=!enabled||items.at(-1)?.id===item.id;up.addEventListener('click',()=>move(item.id,-1),{signal});down.addEventListener('click',()=>move(item.id,1),{signal});row.append(label,sizeLabel,up,down);if(!enabled&&!editable)row.append(el('small','Profil ist blockiert oder wird verarbeitet; Original-Readback verwenden.'));else if(!enabled)row.append(el('small','Nicht verfügbar oder Version abweichend; nicht wiederhergestellt, kein ähnlicher Ersatz.'));fieldset.append(row);
    }groups.append(fieldset);
   }apply(value);projectSelection();
  }finally{rendering=false;}
 }
 choose.addEventListener('change',()=>{if(selectedId){openProperties(choose.value);return;}const value=current();add.disabled=!bridge?.editable()||!value||!available(value).some(e=>e.id===choose.value);},{signal:o.signal});
 add.addEventListener('click',()=>{if(!add.disabled)edit(choose.value,item=>{item.visible=true;});},{signal:o.signal});
 document.addEventListener('click',event=>{const button=(event.target as Element|null)?.closest<HTMLButtonElement>('[data-workspace-composition-open]');if(button&&!button.disabled){closeProperties(false);inspect();bridge?.open();title.focus();}},{signal:o.signal});
 function inspect(){if(closed)return;if(!bridge){const host=document.getElementById('profile.controls');if(!host)return;bridge=workspaceProfileCompositionBridgeV1(host);if(!bridge)return;const tools=bridge.root.querySelector('.profile-tools');bridge.root.insertBefore(root,tools);unsubscribe=bridge.subscribe(paint);paint();}const value=current();if(value)apply(value);}
 return{inspect,canConfigure,openProperties,setPrism(value:boolean){prism=value;if(!value)closeProperties(false);},close(){closeProperties(false);closed=true;unsubscribe?.();rowLifetime.abort();root.remove();propertiesDialog.remove();}};
}

