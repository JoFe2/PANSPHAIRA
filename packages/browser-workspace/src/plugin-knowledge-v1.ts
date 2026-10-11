import type {BrowserShellPluginV1} from '../../contracts/src/browser-shell-plugin-v1.js';
// Metadata never grants backend knowledge, activation or execution authority.
export const knowledgePluginV1:BrowserShellPluginV1={schemaVersion:'pansphaira.browser-plugin/v1',id:'pan.knowledge',version:'1.0.0',shellVersion:'1.0.0',enabled:true,trustBoundary:'TRUSTED_IN_PROCESS_CODE_OWNED_FACTORIES',needs:{data:['demo.status.read'],context:['tenantId','sessionId'],rights:['demo.status.read'],dependencies:[]},contributions:[
 {id:'pan.knowledge.route',kind:'ROUTE',slot:'shell.routes',factoryId:null,routeId:'pan.knowledge.route',path:'/workspace/knowledge',label:'Wissen und Capability — nur lesen'},
 {id:'pan.knowledge.navigation',kind:'NAVIGATION',slot:'shell.navigation',factoryId:'pan.knowledge.navigation',routeId:'pan.knowledge.route',path:null,label:'Wissen und Capability — nur lesen'},
 {id:'pan.knowledge.view',kind:'VIEW',slot:'shell.main',factoryId:'pan.knowledge.view',routeId:'pan.knowledge.route',path:null,label:'Quellengebundener Wissensexplorer'},
 {id:'pan.knowledge.context',kind:'PANEL',slot:'shell.panels',factoryId:'pan.knowledge.context',routeId:'pan.knowledge.route',path:null,label:'Wissenskontext — nur lesen'},
]};
