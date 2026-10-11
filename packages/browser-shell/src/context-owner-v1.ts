import {browserWorkspaceStringValuesV1} from "../../contracts/src/browser-shell-plugin-v1.js";
// Shell-local lifetime and context binding. Backend authentication/effective
// rights stay server-owned; sessionId here is an identity binding, not a token.
export interface BrowserContextV1 {
  readonly schemaVersion: "pansphaira.browser-context/v1";
  readonly tenantId: string;
  readonly sessionId: string;
  readonly objectId: string | null;
  readonly revision: number;
}
export interface BrowserBackendReadbackV1 {
  readonly status: number;
  readonly value: unknown;
}
export type BrowserContextReadV1 =
  | { readonly outcome: "READBACK_RECEIVED"; readonly context: BrowserContextV1; readonly value: unknown; readonly grantedRights: readonly [] }
  | { readonly outcome: "STALE_CONTEXT" | "DENIED" | "BACKEND_UNAVAILABLE"; readonly value: null };

function checkedContext(value: unknown): BrowserContextV1 {
  if (value === null || typeof value !== "object" || Object.getPrototypeOf(value) !== Object.prototype) throw new Error(browserWorkspaceStringValuesV1[97]);
  const descriptors = Object.getOwnPropertyDescriptors(value);
  const keys = [browserWorkspaceStringValuesV1[0] as string, browserWorkspaceStringValuesV1[8] as string, browserWorkspaceStringValuesV1[16] as string, browserWorkspaceStringValuesV1[5] as string, browserWorkspaceStringValuesV1[3] as string];
  if (Reflect.ownKeys(descriptors).length !== keys.length
    || Reflect.ownKeys(descriptors).some(key => typeof key !== "string" || !keys.includes(key))
    || Object.values(descriptors).some(d => !d.enumerable || !("value" in d))) throw new Error(browserWorkspaceStringValuesV1[97]);
  const v = value as Record<string, unknown>;
  const id = (x: unknown) => typeof x === "string" && /^[A-Za-z0-9][A-Za-z0-9._:-]{1,95}$/.test(x);
  if (v.schemaVersion !== browserWorkspaceStringValuesV1[188] || !id(v.tenantId) || !id(v.sessionId)
    || !(v.objectId === null || id(v.objectId)) || !Number.isSafeInteger(v.revision) || (v.revision as number) < 1) throw new Error(browserWorkspaceStringValuesV1[97]);
  return Object.freeze({ schemaVersion: browserWorkspaceStringValuesV1[188], tenantId: v.tenantId as string,
    sessionId: v.sessionId as string, objectId: v.objectId as string | null, revision: v.revision as number });
}

export function createBrowserContextOwnerV1(options: {
  readonly initialContext: BrowserContextV1;
  readonly readBackend: (context: BrowserContextV1, signal: AbortSignal) => Promise<BrowserBackendReadbackV1>;
}) {
  if (!options || typeof options.readBackend !== "function") throw new Error("CONTEXT_BACKEND_OWNER_REQUIRED");
  let current = checkedContext(options.initialContext);
  let epoch = 0; let closed = false;
  const pending = new Set<AbortController>(); const disposals = new Map<() => void, object>();
  function ensureOpen() { if (closed) throw new Error(browserWorkspaceStringValuesV1[65]); }
  function retire() {
    const controllers = [...pending]; pending.clear();
    const owned = [...disposals.keys()]; disposals.clear();
    // Snapshot and clear both collections before callbacks. New-context reads
    // and listener registrations created by retirement are not old work.
    for (const controller of controllers) controller.abort();
    let failures = 0;
    for (const dispose of owned) { try { dispose(); } catch { failures++; } }
    return Object.freeze({ disposedListeners: owned.length, disposalFailures: failures });
  }
  return Object.freeze({
    context() { return current; },
    onDispose(dispose: () => void) {
      ensureOpen();
      if (typeof dispose !== "function" || disposals.size >= 64) throw new Error(browserWorkspaceStringValuesV1[143]);
      // Preserve per-lifetime callback deduplication, but a retired unregister
      // closure must never delete the same callback registered for a new life.
      const registration = disposals.get(dispose) ?? Object.freeze({});
      disposals.set(dispose, registration);
      return () => { if (disposals.get(dispose) === registration) disposals.delete(dispose); };
    },
    switchContext(next: unknown) {
      ensureOpen();
      const checked = checkedContext(next);
      if (epoch >= Number.MAX_SAFE_INTEGER) throw new Error("CONTEXT_EPOCH_LIMIT");
      epoch++;
      current = checked;
      return retire();
    },
    async read(): Promise<BrowserContextReadV1> {
      ensureOpen();
      if (pending.size >= 8) throw new Error(browserWorkspaceStringValuesV1[144]);
      const requestEpoch = epoch; const binding = current; const controller = new AbortController();
      pending.add(controller);
      try {
        const response = await options.readBackend(binding, controller.signal);
        if (closed || controller.signal.aborted || requestEpoch !== epoch) return { outcome: browserWorkspaceStringValuesV1[38], value: null };
        // The adapter is trusted, but lazy status/value access can reenter the
        // owner. Sample each field once and check lifetime after each access.
        const status = response.status;
        if (closed || controller.signal.aborted || requestEpoch !== epoch) return { outcome: browserWorkspaceStringValuesV1[38], value: null };
        if (status === 401 || status === 403) return { outcome: browserWorkspaceStringValuesV1[2], value: null };
        if (status !== 200) return { outcome: browserWorkspaceStringValuesV1[137], value: null };
        const value = response.value;
        if (closed || controller.signal.aborted || requestEpoch !== epoch) return { outcome: browserWorkspaceStringValuesV1[38], value: null };
        // Receiving JSON is not Ready, mutation completion, permission or a proposal apply.
        return { outcome: browserWorkspaceStringValuesV1[20], context: binding, value, grantedRights: Object.freeze([]) };
      } catch {
        return { outcome: closed || controller.signal.aborted || requestEpoch !== epoch ? browserWorkspaceStringValuesV1[38] : browserWorkspaceStringValuesV1[137], value: null };
      } finally { pending.delete(controller); }
    },
    close() { if (closed) return; closed = true; epoch++; return retire(); },
  });
}
