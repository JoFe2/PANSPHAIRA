import {browserWorkspaceStringValuesV1} from "../../contracts/src/browser-shell-plugin-v1.js";
import type { BrowserContextV1, BrowserContextReadV1 } from "../../browser-shell/src/context-owner-v1.js";
import type { BrowserErvReadV1 } from "../../contracts/src/browser-erv-read-v1.js";
export interface WorkspaceViewApiV1 {
  readonly context: () => BrowserContextV1;
  readonly read: () => Promise<BrowserContextReadV1>;
  readonly rememberInvoice: (value: BrowserErvReadV1) => void;
  readonly invoice: () => BrowserErvReadV1 | null;
  readonly openInvoicePanel: () => void;
}
export function text(tag: string, value: string): HTMLElement {
  const node = document.createElement(tag); node.textContent = value; return node;
}
export function facts(target: HTMLElement, pairs: readonly (readonly [string, string])[]) {
  const list = document.createElement("dl"); list.className = "facts";
  for (const [label, value] of pairs) { list.append(text("dt", label), text("dd", value)); }
  target.append(list);
}
export function readState(target: HTMLElement, backend: string, outcome: string, message: string) {
  target.dataset.backend = backend; target.dataset.outcome = outcome;
  const status = text("p", message); status.className = browserWorkspaceStringValuesV1[203] as string; status.setAttribute("role", browserWorkspaceStringValuesV1[22] as string); target.append(status);
}

// Shared PAN549/PAN604 text-only alternative table. Keep the scroll/focus
// attachment stable when source rows change; unknown values are explicit text.
export function createWorkspaceReadonlyTableV1(target:HTMLElement,caption:string,titles:readonly string[]){
 const scroll=text('div','');scroll.className='analysis-table-scroll';scroll.tabIndex=0;scroll.setAttribute('role','region');scroll.setAttribute('aria-label',caption+' — Tabelle lokal horizontal scrollbar');const table=document.createElement('table');table.append(text('caption',caption));const head=document.createElement('thead'),row=document.createElement('tr');for(const title of titles){const th=text('th',title);th.setAttribute('scope','col');row.append(th);}head.append(row);table.append(head);const body=document.createElement('tbody');table.append(body);scroll.append(table);target.append(scroll);
 return Object.freeze({scroll,setRows(rows:readonly {readonly key:string;readonly cells:readonly string[]}[]){const fragment=document.createDocumentFragment();for(const row of rows){if(row.cells.length!==titles.length)throw Error('READONLY_TABLE_SHAPE_DENIED');const tr=document.createElement('tr');tr.dataset.analysisKey=row.key;for(let i=0;i<row.cells.length;i++){const cell=text(i===0?'th':'td',row.cells[i]!);if(i===0)cell.setAttribute('scope','row');if(i===2)cell.setAttribute('data-analysis-value','');tr.append(cell);}fragment.append(tr);}body.replaceChildren(fragment);}});
}

export function deniedMessage(outcome: string): string {
  return outcome === browserWorkspaceStringValuesV1[2] ? "Zugriff verweigert: aktuelle Session, Tenant oder Objektbindung prüfen."
    : outcome === browserWorkspaceStringValuesV1[38] ? "Kontext gewechselt: alte Antwort verworfen."
    : "Backend nicht verfügbar oder Vorgang veraltet. Kein erfolgreicher fachlicher Readback.";
}
