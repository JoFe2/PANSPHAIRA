import {browserWorkspaceStringValuesV1} from "../../contracts/src/browser-shell-plugin-v1.js";
import { createExtendedBrowserContextOwnerV1 } from "../../browser-shell/src/extended-context-owner-v1.js";
import type { BrowserContextV1 } from "../../browser-shell/src/context-owner-v1.js";
import { validateWorkspaceContextTabBootstrapV1, validateWorkspaceContextSnapshotV1, validateWorkspaceContextReadbackV1, verifyWorkspaceContextBindingV1,
  type WorkspaceContextSnapshotV1, type WorkspaceContextReadbackV1, type WorkspaceContextSelectionEntryV1 } from "../../contracts/src/workspace-context-selection-v1.js";
import { text } from "./api-v1.js";

export type WorkspaceModuleViewRequestV1 = "READ" | "CATALOG" | "DATA" | "PREVIEW" | "UNDO_PREVIEW" | "CONFIRM" | "CANCEL" | "HUMAN_READ" | "HUMAN_DECIDE" | "HUMAN_RECONCILE" | "AGENT_PLAN" | "AGENT_START" | "AGENT_READ" | "NAV_SEARCH" | "NAV_REQUEST" | "NAV_READ" | "NAV_ACK" | "CONFIGURATION_READ" | "CONFIGURATION_APP_READ" | "CONFIGURATION_APP_COMMAND" | "ADMIN_APPROVAL_READ" | "ADMIN_APPROVAL_COMMAND" | "ADMIN_READ" | "ADMIN_COMMAND" | "KNOWLEDGE_READ" | "KNOWLEDGE_PREFLIGHT";
export type WorkspaceModuleViewResponseV1 =
  { readonly outcome: "CURRENT_MODULE_VIEW_RESPONSE"; readonly value: unknown; readonly context: WorkspaceContextReadbackV1 }
  | { readonly outcome: "STALE_MODULE_VIEW_RESPONSE" | "MODULE_VIEW_DENIED" | "MODULE_VIEW_WRITE_OUTCOME_UNKNOWN"; readonly error: string };

// Trusted shell adapter only. No CSS/widget/source-map-derived authority, second
// panel or execution engine. Native registered view and row IDs come from the
// current authenticated server snapshot, not DOM selectors or model proposals.
export function createWorkspaceContextSelectionV1(options: {
  readonly root: HTMLElement; readonly base: string; readonly context: () => BrowserContextV1; readonly signal: AbortSignal;
}) {
  const { root, base } = options;
  if (!/^\/t\/[a-z0-9][a-z0-9-]{0,63}$/.test(base)) throw new Error("CONTEXT_BROWSER_SCOPE_DENIED");
  const initial = options.context();
  let closed = false, epoch = 0, proof: string | null = null, tabId: string | null = null;
  let bootstrap: { readonly token: object; readonly signal: AbortSignal; readonly promise: Promise<void>; ready: boolean } | null = null;
  let queue: Promise<unknown> = Promise.resolve();
  let current: WorkspaceContextSnapshotV1 | null = null;
  let surfaceModeV2=false;let contextProjectionCsrf:string|null=null;
  const subscribers = new Set<(context: WorkspaceContextReadbackV1 | null) => void>();
  function emit() { for (const listener of subscribers) { try { listener(current?.context ?? null); } catch { /* Presentation callbacks never own context authorization. */ } } }
  let bindingRequest: AbortController | null = null;
  let lifetime: object = Object.freeze({});
  let owner: ReturnType<typeof createExtendedBrowserContextOwnerV1> | null = null;
  let controls = new Map<string, HTMLButtonElement>(), fieldset: HTMLFieldSetElement | null = null;
  const heading = text("h2", "Aktueller nativer Seitenkontext"), scope = text("p", ""), status = text("p", "");
  heading.id = "shell.context-selection.heading"; status.setAttribute("role", browserWorkspaceStringValuesV1[22] as string);
  function open() { if (closed || options.signal.aborted) throw new Error(browserWorkspaceStringValuesV1[65]); }
  function localLive(c: WorkspaceContextReadbackV1, capturedEpoch: number) {
    const session = options.context();
    return !closed && !options.signal.aborted && epoch === capturedEpoch && current?.context.contextHandle === c.contextHandle
      && session.tenantId === initial.tenantId && session.sessionId === initial.sessionId && location.origin === c.binding.origin;
  }
  function pending(message: string, clear: boolean) {
    root.hidden = false; root.dataset.state = "UPDATING_CONTEXT";
    if (clear) { current = null; controls = new Map(); fieldset = null; root.replaceChildren(heading, scope, status); scope.textContent = ""; root.dataset.module = ""; root.dataset.selection = ""; emit(); }
    // Native disabled buttons lose keyboard focus in Chromium. Keep focus and
    // announce temporary unavailability; select() rejects repeated activation
    // while this context operation is pending, without dispatching again.
    status.textContent = message; for (const b of controls.values()) b.setAttribute(browserWorkspaceStringValuesV1[131] as string, "true");
  }
  function invalidate() {
    lifetime = Object.freeze({});
    const request = bindingRequest, previous = owner; bindingRequest = null; owner = null;
    request?.abort(); previous?.close();
  }
  function failure() {
    invalidate(); pending("Aktueller Kontext nicht bestätigt. Alte Auswahl verworfen; kein Retry. Fachnavigation/Abmelden bleiben verfügbar.", true);
    root.dataset.state = "CONTEXT_UNAVAILABLE";
  }
  async function request(suffix: string, body?: unknown, signal?: AbortSignal): Promise<unknown> {
    open();
    const headers: Record<string, string> = { "x-pan548-session": initial.sessionId };
    if (proof !== null && tabId !== null) { headers["x-pan548-tab"] = proof; headers["x-pan548-tab-id"] = tabId; }
    if (body !== undefined) headers[browserWorkspaceStringValuesV1[141]] = browserWorkspaceStringValuesV1[31] as string;
    const requestSignal = AbortSignal.any([options.signal, ...(signal ? [signal] : []), AbortSignal.timeout(5000)]);
    const response = await fetch(base + "/workspace/context-selection" + suffix, { credentials: browserWorkspaceStringValuesV1[6], cache: browserWorkspaceStringValuesV1[7], headers,
      ...(body === undefined ? {} : { method: "POST", body: JSON.stringify(body) }), signal: requestSignal });
    if (response.status !== 200) throw new Error("CONTEXT_SERVER_RESPONSE_DENIED");
    return response.json() as Promise<unknown>;
  }
  function check(c: WorkspaceContextReadbackV1) {
    if (c.binding.tenantId !== initial.tenantId || c.binding.sessionId !== initial.sessionId || c.binding.origin !== location.origin
      || (tabId !== null && c.binding.tabId !== tabId)) throw new Error("CONTEXT_BROWSER_BINDING_DENIED");
  }
  async function boot(signal: AbortSignal) {
    if (!bootstrap || (!bootstrap.ready && bootstrap.signal.aborted)) {
      const token = Object.freeze({});
      const promise: Promise<void> = (async () => {
        const b = validateWorkspaceContextTabBootstrapV1(await request("/tab", {}, signal)); open();
        if (signal.aborted || bootstrap?.token !== token) throw new Error("CONTEXT_BOOTSTRAP_SUPERSEDED");
        check(b.snapshot.context); proof = b.tabProof; tabId = b.snapshot.context.binding.tabId;
      })();
      const attempt = { token, signal, promise, ready: false }; bootstrap = attempt;
      void promise.then(() => { attempt.ready = true; }, () => { if (bootstrap === attempt) bootstrap = null; });
    }
    await bootstrap.promise;
  }
  function serialized<T>(operation: () => Promise<T>): Promise<T> {
    const result = queue.then(operation); queue = result.catch(() => {}); return result;
  }
  async function verify(c: WorkspaceContextReadbackV1, signal?: AbortSignal) {
    const value = validateWorkspaceContextReadbackV1(await request("/verify", { schemaVersion: browserWorkspaceStringValuesV1[78], tabId: c.binding.tabId, contextHandle: c.contextHandle }, signal));
    check(value); verifyWorkspaceContextBindingV1(value, c.binding);
    if (JSON.stringify(value) !== JSON.stringify(c)) throw new Error("CONTEXT_VERIFICATION_DRIFT");
  }
  function show(snapshot: WorkspaceContextSnapshotV1, capturedEpoch: number) {
    check(snapshot.context); if (epoch !== capturedEpoch || closed) return;
    current = snapshot;
    const previous = owner;
    owner = createExtendedBrowserContextOwnerV1({ initialContext: snapshot.context, isContextLive: c => localLive(c, capturedEpoch) }); previous?.close();
    const c = snapshot.context;
    root.hidden = false; root.dataset.state = browserWorkspaceStringValuesV1[98]; root.dataset.module = c.moduleId; root.dataset.selection = c.selection?.elementId ?? "";
    scope.textContent = "Serverbestätigt: " + c.binding.tenantId + " · " + c.binding.subjectId + " · " + (c.moduleId === "pan.knowledge" ? "Wissensexplorer" : c.moduleId === browserWorkspaceStringValuesV1[111] ? "Einrichtung" : browserWorkspaceStringValuesV1[67])
      + " · " + (c.primaryObject ? "Vorgang " + c.primaryObject.objectId + ", Fachversion " + c.primaryObject.revision : "kein primäres Fachobjekt") + ". Nur lesen; keine neue Ausführungsfreigabe.";
    status.textContent = c.selection ? "Serverbestätigte semantische Auswahl: " + snapshot.selections.find(s => s.elementId === c.selection!.elementId && s.rowId === c.selection!.rowId)!.label + "."
      : "Keine semantische Auswahl. Tastatur oder Schaltfläche wählt ausschließlich eine aktuell registrierte native Referenz.";
    const keys = snapshot.selections.map(s => JSON.stringify({ elementId: s.elementId, rowId: s.rowId }));
    if (!fieldset || JSON.stringify([...controls.keys()]) !== JSON.stringify(keys)) {
      controls = new Map(); fieldset?.remove(); fieldset = document.createElement(browserWorkspaceStringValuesV1[103]); fieldset.append(text(browserWorkspaceStringValuesV1[105] as string, "Semantische Auswahl — nur native Referenzen"));
      for (const entry of snapshot.selections) {
        const b = text(browserWorkspaceStringValuesV1[1] as string, "Kontextauswahl: " + entry.label) as HTMLButtonElement; b.type = browserWorkspaceStringValuesV1[1];
        b.addEventListener("click", () => { void select(entry, capturedEpoch); }, { signal: options.signal });
        controls.set(JSON.stringify({ elementId: entry.elementId, rowId: entry.rowId }), b); fieldset.append(b);
      }
      root.replaceChildren(heading, scope, status, fieldset);
    }
    for (const [key, b] of controls) { b.disabled = false; b.removeAttribute(browserWorkspaceStringValuesV1[131] as string); b.setAttribute(browserWorkspaceStringValuesV1[134] as string, String(c.selection !== null && key === JSON.stringify(c.selection))); }
    emit();
  }
  async function select(entry: WorkspaceContextSelectionEntryV1, capturedEpoch: number) {
    const issued = owner, snapshot = current; if (!issued || !snapshot || capturedEpoch !== epoch || closed || root.dataset.state !== browserWorkspaceStringValuesV1[98]) return;
    // Local lifecycle membership only; the native server still resolves authority.
    if (!snapshot.selections.some(s => s.elementId === entry.elementId && s.rowId === entry.rowId)) return;
    const capturedLifetime = lifetime;
    const live = () => !closed && epoch === capturedEpoch && lifetime === capturedLifetime && owner === issued && current === snapshot;
    pending("Semantische Auswahl wird vom aktuellen nativen Kontextowner geprüft …", false);
    try {
      await serialized(async () => {
        if (!live()) return;
        const result = await issued.run("read", async (c, signal) => {
          await verify(c, signal);
          if (!live()) throw new Error("CONTEXT_SELECTION_RETIRED");
          const updated = validateWorkspaceContextSnapshotV1(await request("", { schemaVersion: browserWorkspaceStringValuesV1[77], tabId: c.binding.tabId,
            moduleId: c.moduleId, viewId: c.viewId, primaryObjectId: c.primaryObject?.objectId ?? null, expected: { ...c.revisions, epoch: c.binding.epoch },
            selection: { elementId: entry.elementId, rowId: entry.rowId } }, signal));
          await verify(updated.context, signal); return updated;
        });
        if (!live()) return;
        if (result.outcome === browserWorkspaceStringValuesV1[147]) show(result.value, capturedEpoch); else failure();
      });
    } catch { if (live()) failure(); }
  }
  function retire(remote = true) {
    if (closed) return epoch;
    epoch++; const old = current?.context; invalidate();
    pending("Kontextwechsel: Alte Auswahl und ausstehende Antworten werden verworfen …", true);
    if (old && remote) void serialized(async () => { try { await request("/retire", { schemaVersion: browserWorkspaceStringValuesV1[78], tabId: old.binding.tabId, contextHandle: old.contextHandle }); } catch { /* No false retirement success or blind replay; subsequent binding revalidates. */ } });
    return epoch;
  }
  const api = Object.freeze({
    epoch() { return epoch; }, retire,
    async contextProjectionTransportV1(operation:string,payload:unknown):Promise<unknown>{
      if(!['snapshot','prepare','request','result','reconcile','proof','audit','correction','revoke','session','read'].includes(operation))throw Error('CONTEXT_PROJECTION_OPERATION_DENIED');open();await boot(options.signal);open();if(!proof||!tabId)throw Error('CURRENT_NATIVE_TAB_REQUIRED');const binding=options.context();if(binding.sessionId!==initial.sessionId||binding.tenantId!==initial.tenantId)throw Error('CONTEXT_PROJECTION_BROWSER_SCOPE_DENIED');
      const send=async(op:string,value:unknown)=>{const headers:Record<string,string>={'content-type':'application/json','x-pan548-session':initial.sessionId,'x-pan548-tab':proof!,'x-pan548-tab-id':tabId!,...(contextProjectionCsrf?{'x-pan527-csrf':contextProjectionCsrf}:{})};const body=op==='request'?(typeof value==='string'?value:(()=>{throw Error('CONTEXT_PROJECTION_RAW_REQUEST_BYTES_REQUIRED');})()):JSON.stringify(value);const response=await fetch(base+'/workspace/context-projection/'+op,{method:'POST',headers,credentials:'same-origin',cache:'no-store',body,signal:AbortSignal.any([options.signal,AbortSignal.timeout(5000)])});open();if(response.status!==200)throw Error('CONTEXT_PROJECTION_SERVER_DENIED_'+response.status);const result=await response.json() as Record<string,unknown>;if(op==='snapshot'&&typeof result.mutationCsrf==='string'&&/^[a-f0-9]{64}$/.test(result.mutationCsrf))contextProjectionCsrf=result.mutationCsrf;return result;};
      if(!['snapshot','proof','audit','read'].includes(operation)&&!contextProjectionCsrf){await send('snapshot',{schemaVersion:'pansphaira.workspace-context-projection/snapshot-request/v1',audience:'MAIN_CONTRACT'});if(!contextProjectionCsrf)throw Error('CONTEXT_PROJECTION_REVIEWER_CSRF_REQUIRED');}return send(operation,payload);
    },
    async surfaceTransportV2(operation:string,payload:unknown,capability?:Readonly<{surfaceId:string;surfaceProof:string}>):Promise<unknown>{
      if(!['register','list','catalog','state','accept','events','load','before-dom','ack','read','revoke'].includes(operation))throw Error('SURFACE_OPERATION_DENIED');open();await boot(options.signal);open();if(!proof||!tabId)throw Error('CURRENT_NATIVE_TAB_REQUIRED');const binding=options.context();if(binding.sessionId!==initial.sessionId||binding.tenantId!==initial.tenantId)throw Error('SURFACE_BROWSER_SCOPE_DENIED');
      const headers:Record<string,string>={'content-type':'application/json','x-pan548-session':initial.sessionId,'x-pan548-tab':proof,'x-pan548-tab-id':tabId,...(capability?{'x-pan597-surface':capability.surfaceId,'x-pan597-proof':capability.surfaceProof}:{})};const response=await fetch(base+'/workspace/surfaces/'+operation,{method:'POST',headers,credentials:'same-origin',cache:'no-store',body:JSON.stringify(payload),signal:AbortSignal.any([options.signal,AbortSignal.timeout(5000)])});open();if(response.status!==200)throw Error('SURFACE_SERVER_DENIED_'+response.status);return response.json();
    },
    async invocationTransportV1(operation:string,payload:unknown,capability:Readonly<{surfaceId:string;surfaceProof:string}>):Promise<unknown>{
      if(!['resolve','admit','execute','read'].includes(operation))throw Error('INVOCATION_OPERATION_DENIED');open();await boot(options.signal);open();if(!proof||!tabId)throw Error('CURRENT_NATIVE_TAB_REQUIRED');const binding=options.context();if(binding.sessionId!==initial.sessionId||binding.tenantId!==initial.tenantId)throw Error('INVOCATION_BROWSER_SCOPE_DENIED');
      const headers:Record<string,string>={'content-type':'application/json','x-pan548-session':initial.sessionId,'x-pan548-tab':proof,'x-pan548-tab-id':tabId,'x-pan597-surface':capability.surfaceId,'x-pan597-proof':capability.surfaceProof};const response=await fetch(base+'/workspace/invocations/'+operation,{method:'POST',headers,credentials:'same-origin',cache:'no-store',body:JSON.stringify(payload),signal:AbortSignal.any([options.signal,AbortSignal.timeout(5000)])});open();if(response.status!==200)throw Error('INVOCATION_SERVER_DENIED_'+response.status);return response.json();
    },
    adoptSurfaceContextV2(routeId:string,objectId:string){epoch++;invalidate();pending('Versionierter Surfacekontext: '+routeId+' · '+objectId+'. V1-Aufträge sind verworfen; keine Ausführungsfreigabe.',true);surfaceModeV2=true;root.dataset.state='CURRENT_SURFACE_CONTEXT_V2';root.dataset.module=routeId;root.dataset.selection=objectId;},
    // Controlled shell-only local disposal for one native target claim. This
    // skips no native fence: the ACK requires its exact epoch/selection delta.
    beginTarget() { return retire(false); },
    current() { return current?.context ?? null; },
    async selectModuleViewInstance(instanceId: string): Promise<boolean> {
      const entry = current?.selections.find(e => e.elementId === browserWorkspaceStringValuesV1[184] && e.rowId === instanceId);
      if (!entry || closed) return false;
      await select(entry, epoch);
      return current?.context.selection?.elementId === entry.elementId && current?.context.selection?.rowId === entry.rowId && root.dataset.state === browserWorkspaceStringValuesV1[98];
    },
    async selectKnowledge(selector:string):Promise<boolean>{const entry=current?.selections.find(e=>e.elementId==='pan.knowledge.entry'&&e.rowId===selector);if(!entry||closed)return false;await select(entry,epoch);return current?.context.selection?.rowId===selector&&root.dataset.state==='CURRENT_CONTEXT';},
    subscribe(listener: (context: WorkspaceContextReadbackV1 | null) => void) {
      open(); subscribers.add(listener); listener(current?.context ?? null);
      return () => { subscribers.delete(listener); };
    },
    // Trusted shell composition only: callers never receive the session/tab
    // proof, choose a free URL, replace context or create mutation authority.
    async moduleViewRequest(operation: WorkspaceModuleViewRequestV1, payload?: Readonly<Record<string, unknown>>, csrfProof?: string): Promise<WorkspaceModuleViewResponseV1> {
      const suffixes: Readonly<Record<WorkspaceModuleViewRequestV1, string>> = { READ: "", CATALOG: "/catalog", DATA: "/data", PREVIEW: "/preview", UNDO_PREVIEW: "/undo-preview", CONFIRM: "/confirm", CANCEL: "/cancel", HUMAN_READ: "/read", HUMAN_DECIDE: "/decide", HUMAN_RECONCILE: browserWorkspaceStringValuesV1[122] as string, AGENT_PLAN: "/plan", AGENT_START: "/start", AGENT_READ: "/read", NAV_SEARCH: "/search", NAV_REQUEST: "/request", NAV_READ: "/read", NAV_ACK: "/ack", CONFIGURATION_READ:"", CONFIGURATION_APP_READ:"", CONFIGURATION_APP_COMMAND:"", ADMIN_APPROVAL_READ:"/approval", ADMIN_APPROVAL_COMMAND:"/approval", ADMIN_READ:"/read", ADMIN_COMMAND:"/read", KNOWLEDGE_READ:"/read", KNOWLEDGE_PREFLIGHT:"/read" };
      if (!Object.hasOwn(suffixes, operation) || !current || !proof || !tabId || closed) return { outcome: browserWorkspaceStringValuesV1[47], error: "CURRENT_NATIVE_CONTEXT_REQUIRED" };
      if (payload && (Object.getPrototypeOf(payload) !== Object.prototype || Reflect.ownKeys(payload).some(k => typeof k !== "string" || k === browserWorkspaceStringValuesV1[64]) || Object.values(Object.getOwnPropertyDescriptors(payload)).some(d => !d.enumerable || !("value" in d)))) return { outcome: browserWorkspaceStringValuesV1[47], error: "MODULE_VIEW_PAYLOAD_DENIED" };
      const captured = current, capturedEpoch = epoch, capturedLifetime = lifetime;
      const live = () => !closed && epoch === capturedEpoch && lifetime === capturedLifetime && current === captured && localLive(captured.context, capturedEpoch);
      return serialized(async (): Promise<WorkspaceModuleViewResponseV1> => {
        let writeSent = false;
        try {
          if (!live()) return { outcome: browserWorkspaceStringValuesV1[57], error: browserWorkspaceStringValuesV1[27] as string };
          await verify(captured.context);
          if (!live()) return { outcome: browserWorkspaceStringValuesV1[57], error: browserWorkspaceStringValuesV1[27] as string };
          const verification = { schemaVersion: browserWorkspaceStringValuesV1[78], tabId: captured.context.binding.tabId, contextHandle: captured.context.contextHandle };
          const headers: Record<string, string> = { "x-pan548-session": initial.sessionId, "x-pan548-tab": proof!, "x-pan548-tab-id": tabId!, "x-pan546-context": captured.context.contextHandle };
          if ((operation === browserWorkspaceStringValuesV1[168] || operation === "ADMIN_COMMAND" || operation === "ADMIN_APPROVAL_COMMAND" || operation === "CONFIGURATION_APP_COMMAND") && csrfProof !== undefined) headers["x-pan527-csrf"] = csrfProof;
          if (operation === browserWorkspaceStringValuesV1[127]) { if (typeof payload?.runId !== "string" || !/^operation:ui-[a-f0-9]{48}$/.test(payload.runId)) throw Error("AGENT_RUN_ID_DENIED"); headers["x-pan548-run"] = payload.runId; }
          const body = operation === "READ" || operation === "CONFIGURATION_READ" || operation === browserWorkspaceStringValuesV1[127] ? undefined : operation === browserWorkspaceStringValuesV1[62] ? verification : { ...payload, context: verification };
          if (body !== undefined) headers[browserWorkspaceStringValuesV1[141]] = browserWorkspaceStringValuesV1[31] as string;
          writeSent = operation === browserWorkspaceStringValuesV1[63] || operation === browserWorkspaceStringValuesV1[168] || operation === "AGENT_START" || operation === "ADMIN_COMMAND" || operation === "ADMIN_APPROVAL_COMMAND" || operation === "CONFIGURATION_APP_COMMAND";
          const response = await fetch(base + (operation.startsWith("CONFIGURATION_APP_") ? "/workspace/configuration-application" : operation === "CONFIGURATION_READ" ? "/workspace/configuration" : operation.startsWith("ADMIN_") ? "/workspace/administration" : operation.startsWith("KNOWLEDGE_") ? "/workspace/knowledge" : operation.startsWith("NAV_") ? "/workspace/invoice-navigation" : operation.startsWith("AGENT_") ? "/workspace/agent-run" : operation.startsWith("HUMAN_") ? "/workspace/erv-human" : "/workspace/module-view") + suffixes[operation], { credentials: browserWorkspaceStringValuesV1[6], cache: browserWorkspaceStringValuesV1[7], headers, ...(body === undefined ? {} : { method: "POST", body: JSON.stringify(body) }), signal: AbortSignal.any([options.signal, AbortSignal.timeout(5000)]) });
          if (!live()) return { outcome: writeSent ? browserWorkspaceStringValuesV1[107] : browserWorkspaceStringValuesV1[57], error: browserWorkspaceStringValuesV1[27] as string };
          if (response.status !== 200) return { outcome: browserWorkspaceStringValuesV1[47], error: "MODULE_VIEW_SERVER_DENIED_" + response.status };
          const value: unknown = await response.json();
          if (!live()) return { outcome: writeSent ? browserWorkspaceStringValuesV1[107] : browserWorkspaceStringValuesV1[57], error: browserWorkspaceStringValuesV1[27] as string };
          // A successful CAS deliberately invalidates the prior view revision.
          // It is only a write receipt: the consumer must refresh and GET the
          // authoritative target separately, never replay CONFIRM automatically.
          if (!writeSent) { await verify(captured.context); if (!live()) return { outcome: browserWorkspaceStringValuesV1[57], error: browserWorkspaceStringValuesV1[27] as string }; }
          return { outcome: browserWorkspaceStringValuesV1[148], value, context: captured.context };
        } catch {
          return { outcome: writeSent ? browserWorkspaceStringValuesV1[107] : browserWorkspaceStringValuesV1[47], error: "MODULE_VIEW_RESPONSE_NOT_CONFIRMED" };
        }
      });
    },
    async refreshModuleViewContext(source?: WorkspaceContextReadbackV1): Promise<boolean> {
      const captured = current?.context ?? source;
      if (!captured || closed || !proof || !tabId) return false;
      check(captured);
      const capturedCurrent = current, capturedEpoch = epoch, capturedLifetime = lifetime;
      return serialized(async () => {
        const live = () => !closed && !options.signal.aborted && epoch === capturedEpoch && lifetime === capturedLifetime && current === capturedCurrent
          && options.context().sessionId === initial.sessionId && options.context().tenantId === initial.tenantId;
        try {
          if (!live()) return false;
          const fresh = validateWorkspaceContextSnapshotV1(await request("")); check(fresh.context);
          if (!live() || fresh.context.moduleId !== captured.moduleId || fresh.context.viewId !== captured.viewId || fresh.context.primaryObject?.objectId !== captured.primaryObject?.objectId || fresh.context.binding.epoch !== captured.binding.epoch) return false;
          await verify(fresh.context); if (!live()) return false;
          show(fresh, capturedEpoch); return true;
        } catch { if (live()) failure(); return false; }
      });
    },
    unavailable(localEpoch: number) { if (!closed && localEpoch === epoch) failure(); },
    async bind(value: { readonly moduleId: string; readonly viewId: string; readonly primaryObjectId: string | null; readonly domainRevision: number | null; readonly localEpoch: number }) {
      const capturedEpoch = value.localEpoch;
      if (closed || capturedEpoch !== epoch) return;
      if (![browserWorkspaceStringValuesV1[111] as string, browserWorkspaceStringValuesV1[15] as string, "pan.knowledge", "pan.configuration"].includes(value.moduleId)) { failure(); return; }
      // Replacement within the same navigation epoch owns a distinct lifetime.
      // Retained controls and queued outcomes cannot clear its successor.
      invalidate(); pending("Nativen Seitenkontext prüfen …", true);
      const capturedLifetime = lifetime, controller = new AbortController(); bindingRequest = controller;
      const live = () => !closed && capturedEpoch === epoch && lifetime === capturedLifetime && !controller.signal.aborted;
      try {
        await serialized(async () => {
          try {
            if (!live()) return;
            await boot(controller.signal); if (!live()) return;
            const fresh = validateWorkspaceContextSnapshotV1(await request(surfaceModeV2||document.body.dataset.ownerSurfacesV2==='true'?'/surface-return-v1':'',surfaceModeV2||document.body.dataset.ownerSurfacesV2==='true'?{}:undefined,controller.signal));surfaceModeV2=false;check(fresh.context);
            if (!live()) return;
            const updated = validateWorkspaceContextSnapshotV1(await request("", { schemaVersion: browserWorkspaceStringValuesV1[77], tabId: fresh.context.binding.tabId,
              moduleId: value.moduleId, viewId: value.viewId, primaryObjectId: value.primaryObjectId,
              expected: { ...fresh.context.revisions, domainRevision: value.domainRevision, epoch: fresh.context.binding.epoch }, selection: null }, controller.signal));
            check(updated.context);
            if (!live()) return;
            if (updated.context.moduleId !== value.moduleId || updated.context.viewId !== value.viewId || updated.context.primaryObject?.objectId !== (value.primaryObjectId ?? undefined)
              || updated.context.revisions.domainRevision !== value.domainRevision) throw new Error("CONTEXT_BROWSER_NATIVE_VIEW_DENIED");
            await verify(updated.context, controller.signal); if (live()) show(updated, capturedEpoch);
          } finally { if (bindingRequest === controller) bindingRequest = null; }
        });
      } catch { if (live()) failure(); }
    },
    close() { if (closed) return; closed = true; epoch++; invalidate(); current = null; emit(); subscribers.clear(); proof = null; tabId = null; controls.clear(); root.replaceChildren(); root.hidden = true; root.dataset.state = browserWorkspaceStringValuesV1[65]; root.dataset.module = ""; root.dataset.selection = ""; },
  });
  options.signal.addEventListener("abort", api.close, { once: true });
  return api;
}
