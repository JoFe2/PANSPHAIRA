import {browserWorkspaceStringValuesV1} from "../../contracts/src/browser-shell-plugin-v1.js";
import { validateBrowserErvReadV1 } from "../../contracts/src/browser-erv-read-v1.js";
import type { BrowserShellPluginV1 } from "../../contracts/src/browser-shell-plugin-v1.js";
import type { BrowserShellFactoryV1 } from "../../browser-shell/src/registry-v1.js";
import { text, facts, readState, deniedMessage, type WorkspaceViewApiV1 } from "./api-v1.js";
export const ervPluginV1: BrowserShellPluginV1 = {
  schemaVersion: browserWorkspaceStringValuesV1[52], id: browserWorkspaceStringValuesV1[15] as string, version: "1.0.0", shellVersion: "1.0.0", enabled: true,
  trustBoundary: browserWorkspaceStringValuesV1[39],
  needs: { data: [browserWorkspaceStringValuesV1[160] as string], context: [browserWorkspaceStringValuesV1[8], browserWorkspaceStringValuesV1[16], browserWorkspaceStringValuesV1[5], browserWorkspaceStringValuesV1[3]], rights: [browserWorkspaceStringValuesV1[160] as string], dependencies: [] },
  contributions: [
    { id: browserWorkspaceStringValuesV1[29] as string, kind: "ROUTE", slot: browserWorkspaceStringValuesV1[56], factoryId: null, routeId: browserWorkspaceStringValuesV1[29] as string, path: browserWorkspaceStringValuesV1[42] as string, label: browserWorkspaceStringValuesV1[155] as string },
    { id: browserWorkspaceStringValuesV1[185] as string, kind: browserWorkspaceStringValuesV1[12], slot: browserWorkspaceStringValuesV1[37], factoryId: browserWorkspaceStringValuesV1[185] as string, routeId: browserWorkspaceStringValuesV1[29] as string, path: null, label: browserWorkspaceStringValuesV1[155] as string },
    { id: browserWorkspaceStringValuesV1[30] as string, kind: "VIEW", slot: browserWorkspaceStringValuesV1[17], factoryId: browserWorkspaceStringValuesV1[30] as string, routeId: browserWorkspaceStringValuesV1[29] as string, path: null, label: browserWorkspaceStringValuesV1[67] as string },
    { id: browserWorkspaceStringValuesV1[13] as string, kind: "PANEL", slot: browserWorkspaceStringValuesV1[218], factoryId: browserWorkspaceStringValuesV1[13] as string, routeId: browserWorkspaceStringValuesV1[29], path: null, label: browserWorkspaceStringValuesV1[170] as string },
    { id: browserWorkspaceStringValuesV1[75] as string, kind: browserWorkspaceStringValuesV1[126], slot: browserWorkspaceStringValuesV1[215], factoryId: browserWorkspaceStringValuesV1[75] as string, routeId: browserWorkspaceStringValuesV1[29], path: null, label: "Informationspanel öffnen" },
  ],
};
const euros = (value: number,currency:string) => new Intl.NumberFormat("de-DE",{style:"currency",currency}).format(value/100);
export function createErvViewV1(api: WorkspaceViewApiV1): BrowserShellFactoryV1<HTMLElement> {
  return { kind: "VIEW", async render({ target, signal }) {
    target.append(text("h1", browserWorkspaceStringValuesV1[67] as string)); readState(target, "erv", browserWorkspaceStringValuesV1[26] as string, "Fachlicher Readback aus dem führenden nativen Speicher wird geladen …");
    const response = await api.read(); if (signal.aborted) return;
    target.replaceChildren(text("h1", browserWorkspaceStringValuesV1[67] as string));
    if (response.outcome !== browserWorkspaceStringValuesV1[20]) { readState(target, "erv", response.outcome, deniedMessage(response.outcome)); return; }
    const value = validateBrowserErvReadV1(response.value);
    if (value.tenantId !== api.context().tenantId || value.invoiceId !== api.context().objectId) throw new Error("ERV_CURRENT_CONTEXT_DENIED");
    api.rememberInvoice(value);
    target.classList.add('erv-workspace');const heading=target.querySelector('h1')!;heading.className='erv-workspace-title';
    const header=document.createElement('div');header.className='erv-workspace-heading';const symbol=text('span','');symbol.className='erv-workspace-symbol';symbol.setAttribute('aria-hidden','true');symbol.textContent='▤';header.append(symbol,heading);target.prepend(header);
    const intro=text('p','Referenz: '+value.invoiceId);intro.className='erv-workspace-subtitle';header.append(intro);
    const work=document.createElement('div');work.className='erv-review-layout';const record=document.createElement('section');record.className='erv-record-card';record.dataset.invoiceReference=value.invoiceId;record.dataset.nativeRevision=String(value.revision);record.setAttribute('aria-label','Belegkontext und nativer Abgleich');record.append(text('h2','Beleg & Abgleich'));const match=text('p',value.varianceMinor===0?'Die Beträge stimmen im nativen Abgleich überein.':'Betragsabweichung: Bitte den Vorgang klären.');match.className=value.varianceMinor===0?'erv-match':'erv-attention';record.append(match);
    if(value.status!=='RELEASED_LOCAL_SYNTHETIC'){const warnings:Readonly<Record<string,string>>={UNRESOLVED_AMOUNT_DEVIATION:'Betragsabweichung — Klärung erforderlich.',UNRESOLVED_PARTIAL_INVOICE:'Teilrechnung — Klärung erforderlich.',UNRESOLVED_CONFIRMATION_CHANGE_NOT_APPROVED:'Bestätigungsänderung noch nicht freigegeben.'};const warning=text('p',warnings[value.status]??'Prüfstand nicht freigegeben.');warning.className='erv-attention';record.append(warning);}
    const quantities=document.createElement('dl');quantities.className='erv-quantity-summary';for(const[label,quantity]of[['Bestellt',value.orderedQuantity],['Angenommen',value.acceptedQuantity],['Berechnet',value.invoicedQuantity]]as const){const item=document.createElement('div'),amount=text('dd',new Intl.NumberFormat('de-DE').format(quantity)+' '),unit=text('span','Einheit nicht bestätigt');unit.className='erv-quantity-unit';amount.append(unit);item.append(text('dt',label),amount);quantities.append(item);}const linked=text('p','');linked.className='erv-linked-reference';linked.hidden=true;record.append(quantities,linked);work.append(record);
    const summary=document.createElement('section');summary.className='erv-financial-summary';summary.setAttribute('aria-label','Native Beträge der aktuellen Rechnung');
    for(const[label,amount]of[[browserWorkspaceStringValuesV1[206]as string,value.invoiceAmountMinor],[browserWorkspaceStringValuesV1[161]as string,value.expectedAmountMinor],[browserWorkspaceStringValuesV1[124]as string,value.varianceMinor]]as const){const card=document.createElement('div');card.className='erv-value-card';const display=document.createElement('dl');display.className='erv-amount';display.append(text('dt',label),text('dd',euros(amount,value.currency)));card.append(display);summary.append(card);}target.append(summary);
    const decision=document.createElement('div');decision.className='erv-decision-slot';work.append(decision);target.append(work);
    const source=document.createElement('details');source.className='erv-source-details';source.append(text('summary','Vorgang & Quelldaten'));const sourceFacts=document.createElement('div');facts(sourceFacts,[['Rechnung / Vorgang',value.invoiceId],['Native Objektversion',String(value.revision)],['Bestellt / angenommen / berechnet',[value.orderedQuantity,value.acceptedQuantity,value.invoicedQuantity].join(' / ')],['Entscheidung des vorhandenen Prüfers',value.decisionOutcome],['Fachlicher Status',value.status]]);source.append(sourceFacts,text('p','Lokaler synthetischer Fall im vorhandenen führenden SQLite-Ziel. Keine externe Fiskal-/Archiv-/FiBuqualifikation; keine Buchungs- oder Zahlungsrechte.'));target.append(source);
    const readback=document.createElement('details');readback.className='erv-readback-details';readback.append(text('summary','Datenherkunft & Lesestatus'));readState(readback,'erv',browserWorkspaceStringValuesV1[20]as string,'Echter fachlicher Readback empfangen — nur lesen, keine Buchung und kein Zahlungsauftrag.');target.append(readback);
  } };
}
export function createErvPanelV1(api: WorkspaceViewApiV1): BrowserShellFactoryV1<HTMLElement> {
  return { kind: "PANEL", render({ target }) {
    const value = api.invoice(); if (!value || value.invoiceId !== api.context().objectId || value.tenantId !== api.context().tenantId) throw new Error("ERV_PANEL_CURRENT_CONTEXT_DENIED");
    target.replaceChildren(text("h2", browserWorkspaceStringValuesV1[170] as string));
    facts(target, [["Vorgang", value.invoiceId], ["Objektversion", String(value.revision)], ["Führender Speicher", value.leadingStore], ["Bestätigungsdigest", value.confirmationDigest], ["Quellbelegdigest", value.invoiceSourceSha256]]);
  } };
}
export function createErvActionV1(api: WorkspaceViewApiV1): BrowserShellFactoryV1<HTMLElement> {
  return { kind: browserWorkspaceStringValuesV1[126], render({ target, signal }) {
    const button = text(browserWorkspaceStringValuesV1[1] as string, "Informationspanel zum aktuellen Vorgang öffnen") as HTMLButtonElement;
    button.type = browserWorkspaceStringValuesV1[1]; button.addEventListener("click", () => api.openInvoicePanel(), { signal }); target.append(button);
  } };
}
