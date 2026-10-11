import {browserWorkspaceStringValuesV1} from "../../contracts/src/browser-shell-plugin-v1.js";
import type { BrowserShellPluginV1 } from "../../contracts/src/browser-shell-plugin-v1.js";
import type { PocEarlyAdminStatusV1 } from "../../contracts/src/poc-early-admin-ai-setup.js";
import type { BrowserShellFactoryV1 } from "../../browser-shell/src/registry-v1.js";
import { text, facts, readState, deniedMessage, type WorkspaceViewApiV1 } from "./api-v1.js";
export const setupPluginV1: BrowserShellPluginV1 = {
  schemaVersion: browserWorkspaceStringValuesV1[52], id: browserWorkspaceStringValuesV1[111] as string, version: "1.0.0", shellVersion: "1.0.0", enabled: true,
  trustBoundary: browserWorkspaceStringValuesV1[39],
  needs: { data: ["setup.status"], context: [browserWorkspaceStringValuesV1[8], browserWorkspaceStringValuesV1[16]], rights: [browserWorkspaceStringValuesV1[150] as string], dependencies: [] },
  contributions: [
    { id: browserWorkspaceStringValuesV1[76] as string, kind: "ROUTE", slot: browserWorkspaceStringValuesV1[56], factoryId: null, routeId: browserWorkspaceStringValuesV1[76] as string, path: "/workspace/setup", label: browserWorkspaceStringValuesV1[46] as string },
    { id: browserWorkspaceStringValuesV1[186] as string, kind: browserWorkspaceStringValuesV1[12], slot: browserWorkspaceStringValuesV1[37], factoryId: browserWorkspaceStringValuesV1[186] as string, routeId: browserWorkspaceStringValuesV1[76] as string, path: null, label: browserWorkspaceStringValuesV1[46] as string },
    { id: browserWorkspaceStringValuesV1[112] as string, kind: "VIEW", slot: browserWorkspaceStringValuesV1[17], factoryId: browserWorkspaceStringValuesV1[112] as string, routeId: browserWorkspaceStringValuesV1[76] as string, path: null, label: browserWorkspaceStringValuesV1[46] as string },
  ],
};
export function createSetupViewV1(api: WorkspaceViewApiV1): BrowserShellFactoryV1<HTMLElement> {
  return { kind: "VIEW", async render({ target, signal }) {
    target.append(text("h1", browserWorkspaceStringValuesV1[46] as string));
    readState(target, "setup", browserWorkspaceStringValuesV1[26] as string, "Aktueller Zustand wird vom zuständigen Setup-Backend gelesen …");
    const response = await api.read(); if (signal.aborted) return;
    target.replaceChildren(text("h1", browserWorkspaceStringValuesV1[46] as string));
    if (response.outcome !== browserWorkspaceStringValuesV1[20]) { readState(target, "setup", response.outcome, deniedMessage(response.outcome)); return; }
    const value = response.value as PocEarlyAdminStatusV1;
    // This projection consumes the existing coordinator's verified status. No
    // authority fields are interpreted as browser grants or mutation controls.
    if (!value || value.apiVersion !== "chimpmaera.dev/poc-early-admin-status/v1" || value.kind !== "PocEarlyAdminStatus"
      || !Array.isArray(value.stages) || value.stages.length < 1 || value.stages.length > 16
      || value.stages.some(s => typeof s.label !== "string" || s.label.length > 240 || ![browserWorkspaceStringValuesV1[194] as string, "RUNNING", "PASS", "FAILED"].includes(s.status))
      || !value.progress || !Number.isSafeInteger(value.progress.completedStages) || !Number.isSafeInteger(value.progress.totalStages)
      || value.progress.completedStages < 0 || value.progress.totalStages < 1 || value.progress.completedStages > value.progress.totalStages
      || !value.health || ![browserWorkspaceStringValuesV1[194] as string, "DEGRADED", "PASS"].includes(value.health.status)) throw new Error("SETUP_NATIVE_PROJECTION_DENIED");
    readState(target, "setup", browserWorkspaceStringValuesV1[20] as string, "Aktueller Backendzustand empfangen — lesende Anzeige, keine neue Einrichtungsfreigabe.");
    facts(target, [["Abgeschlossene Stufen", String(value.progress.completedStages) + " von " + String(value.progress.totalStages)], ["Health-Zustand", value.health.status]]);
    const list = document.createElement("ul"); list.className = "stages";
    for (const stage of value.stages) list.append(text("li", stage.label + " — " + stage.status)); target.append(list);
    target.append(text("p", "Diese Ansicht verwendet den vorhandenen Setupkoordinator. Ein empfangener Status ist kein neuer Ready-, Installations- oder Produktivnachweis."));
  } };
}
