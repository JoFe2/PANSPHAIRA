import {browserWorkspaceStringValuesV1} from '../../contracts/src/browser-shell-plugin-v1.js';
import type {BrowserShellPluginV1} from '../../contracts/src/browser-shell-plugin-v1.js';
import type {BrowserShellFactoryV1} from '../../browser-shell/src/registry-v1.js';
import type {BrowserContextV1} from '../../browser-shell/src/context-owner-v1.js';
import type {createWorkspaceContextSelectionV1} from './context-selection-v1.js';
import type {WorkspaceDirtyDraftV1} from './workspace-dirty-draft-v1.js';
export const configurationDraftPluginV1: BrowserShellPluginV1 = {
  schemaVersion:browserWorkspaceStringValuesV1[52],id:"pan.configuration",version:"1.0.0",shellVersion:"1.0.0",enabled:true,
  trustBoundary:browserWorkspaceStringValuesV1[39],
  needs:{data:["agent.configuration.draft"],context:[browserWorkspaceStringValuesV1[8],browserWorkspaceStringValuesV1[16]],rights:[browserWorkspaceStringValuesV1[150] as string],dependencies:[]},
  contributions:[
    {id:browserWorkspaceStringValuesV1[74] as string,kind:"ROUTE",slot:browserWorkspaceStringValuesV1[56],factoryId:null,routeId:browserWorkspaceStringValuesV1[74] as string,path:browserWorkspaceStringValuesV1[123] as string,label:browserWorkspaceStringValuesV1[91] as string},
    {id:browserWorkspaceStringValuesV1[183] as string,kind:browserWorkspaceStringValuesV1[12],slot:browserWorkspaceStringValuesV1[37],factoryId:browserWorkspaceStringValuesV1[183] as string,routeId:browserWorkspaceStringValuesV1[74] as string,path:null,label:browserWorkspaceStringValuesV1[91] as string},
    {id:browserWorkspaceStringValuesV1[110] as string,kind:"VIEW",slot:browserWorkspaceStringValuesV1[17],factoryId:browserWorkspaceStringValuesV1[110] as string,routeId:browserWorkspaceStringValuesV1[74] as string,path:null,label:browserWorkspaceStringValuesV1[91] as string},
  ],
};
// Same registry and owner factory, loaded from one fixed protected asset.
// No arbitrary plugin URL, template execution, new store or authority.
export function createConfigurationDraftViewV1(context:()=>BrowserContextV1,registerDraft?:(draft:WorkspaceDirtyDraftV1)=>()=>void,applicationContext?:ReturnType<typeof createWorkspaceContextSelectionV1>|null):BrowserShellFactoryV1<HTMLElement>{
 return {kind:'VIEW',async render(options){const path='/t/'+context().tenantId+'/workspace/configuration-editor/app.js';
  try{const module=await import(path) as typeof import('./configuration-draft-view-v1.js');if(options.signal.aborted)return;await module.createConfigurationDraftViewV1(context,registerDraft,applicationContext).render(options);}
  catch{if(options.signal.aborted)return;options.target.dataset.backend='configuration';options.target.dataset.outcome='ERROR';const status=document.createElement('p');status.setAttribute('role','status');status.textContent='Geschützter Konfigurationseditor nicht verfügbar. Keine Eingabe gespeichert oder Aktivierung angenommen. Arbeitsplatz ausdrücklich neu laden.';options.target.replaceChildren(status);}
 }};
}
