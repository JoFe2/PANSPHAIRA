import {browserWorkspaceStringValuesV1} from "../../contracts/src/browser-shell-plugin-v1.js";
import type { BrowserShellPluginV1 } from "../../contracts/src/browser-shell-plugin-v1.js";
import type { BrowserShellFactoryV1 } from "../../browser-shell/src/registry-v1.js";
// Explicit owner-only diagnostic profile. Never enabled by a route/query/role,
// never imports runtime code and never contacts a business backend.
function descriptor(id: string, suffix: string, label: string): BrowserShellPluginV1 {
  return { schemaVersion: browserWorkspaceStringValuesV1[52], id, version: "1.0.0", shellVersion: "1.0.0", enabled: true,
    trustBoundary: browserWorkspaceStringValuesV1[39], needs: { data: [], context: [], rights: [], dependencies: [] },
    contributions: [
      { id: id + browserWorkspaceStringValuesV1[60], kind: "ROUTE", slot: browserWorkspaceStringValuesV1[56], factoryId: null, routeId: id + browserWorkspaceStringValuesV1[60], path: "/workspace/" + suffix, label },
      { id: id + browserWorkspaceStringValuesV1[121], kind: browserWorkspaceStringValuesV1[12], slot: browserWorkspaceStringValuesV1[37], factoryId: id + browserWorkspaceStringValuesV1[121], routeId: id + browserWorkspaceStringValuesV1[60], path: null, label },
      { id: id + ".view", kind: "VIEW", slot: browserWorkspaceStringValuesV1[17], factoryId: id + ".view", routeId: id + browserWorkspaceStringValuesV1[60], path: null, label },
    ],
  };
}
export function diagnosticPluginsV1() {
  const broken = descriptor("pan.diagnostic", "diagnostic", "Technischer Rendererfehlernachweis");
  const disabled = { ...descriptor("pan.disabled", "disabled", "Deaktiviertes Diagnosemodul"), enabled: false };
  const missingBase = descriptor("pan.missing", "missing", "Fehlende Pflichtabhängigkeit");
  const missing = { ...missingBase, needs: { ...missingBase.needs, dependencies: [{ id: "pan.not-installed", version: "1.0.0" }] } };
  const incompatible = { ...descriptor("pan.incompatible", "incompatible", "Inkompatible Shellversion"), shellVersion: "2.0.0" };
  return { broken, disabled, missing, incompatible };
}
export const diagnosticFailingViewV1: BrowserShellFactoryV1<HTMLElement> = { kind: "VIEW", render() { throw new Error("OWNED_DIAGNOSTIC_RENDERER_FAILED"); } };
