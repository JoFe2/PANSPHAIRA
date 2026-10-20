// Additive MODEL_FREE_BROWSER_DISPLAY task projection owned by existing PAN548.
// Surface/Delivery logic is PAN597; one native SQLite ledger/transaction, no
// model execution, personal-profile save, second task controller or authority.
import {createHash} from 'node:crypto';
import {isProtectedSessionAdapterV1} from '../pan527/origin-session-adapter.mjs';
import {createResourceBudgetStoreV1,resourceBudgetOwnerConnectionV2,openResourceBudgetReadonlyConnectionV2} from '../../demo/runtime/atomic-resource-budget.mjs';
import {canonicalJson} from '../../dist/packages/contracts/src/canonical-json.js';
import {readModelFreeUiTaskBudgetV1} from './native-ui-task-budget-v1.mjs';
import {createNativeUiContextJournalV1} from './native-context-journal-v1.mjs';
const owned=new WeakMap();
export const uiTaskDigestV2=value=>createHash('sha256').update(canonicalJson(value)).digest('hex');
export function uiTaskClosedV2(value,keys,code='UI_TASK_INPUT_DENIED'){
 if(!value||typeof value!=='object'||Object.getPrototypeOf(value)!==Object.prototype)throw Error(code);
 const d=Object.getOwnPropertyDescriptors(value);
 if(Reflect.ownKeys(d).length!==keys.length||keys.some(k=>!Object.hasOwn(d,k))||Object.values(d).some(x=>!x.enumerable||!('value'in x)))throw Error(code);
 return Object.fromEntries(keys.map(k=>[k,d[k].value]));
}
export function createNativeWorkspaceUiTaskProjectionV2(options){
 const {sessions,root}=uiTaskClosedV2(options,['sessions','root'],'UI_TASK_OWNER_DENIED');
 if(!isProtectedSessionAdapterV1(sessions,sessions?.binding?.tenantId)||typeof root!=='string')throw Error('UI_TASK_OWNER_DENIED');
 const ledger=createResourceBudgetStoreV1({optIn:true,stateRoot:root,tenantId:'tenant:'+sessions.binding.tenantId,bindingDigest:uiTaskDigestV2({schemaVersion:'pansphaira.workspace-native-ui-task/binding/v2',binding:sessions.binding,kind:'MODEL_FREE_BROWSER_DISPLAY'}),limits:{modelUnits:1,runtimeUnits:128}});
 const connection=resourceBudgetOwnerConnectionV2(ledger),{db,transaction}=connection;
 db.exec(`CREATE TABLE IF NOT EXISTS workspace_ui_tasks_v2(
  command_id TEXT PRIMARY KEY, request_digest TEXT NOT NULL, original_command TEXT NOT NULL,
  principal_digest TEXT NOT NULL, state TEXT NOT NULL CHECK(state IN('ACCEPTED','OUTCOME_UNCONFIRMED','COMPLETED','REVOKED')),
  revision INTEGER NOT NULL CHECK(revision>0), result_json TEXT
 ) STRICT;
 CREATE TABLE IF NOT EXISTS workspace_ui_task_settings_v2(id INTEGER PRIMARY KEY CHECK(id=1),boot_epoch INTEGER NOT NULL CHECK(boot_epoch>0)) STRICT;`);
 const bootEpoch=transaction(()=>{db.prepare('INSERT OR IGNORE INTO workspace_ui_task_settings_v2 VALUES(1,1)').run();const n=db.prepare('SELECT boot_epoch FROM workspace_ui_task_settings_v2 WHERE id=1').get().boot_epoch;if(!Number.isSafeInteger(n)||n>=Number.MAX_SAFE_INTEGER)throw Error('UI_TASK_EPOCH_LIMIT');db.prepare('UPDATE workspace_ui_task_settings_v2 SET boot_epoch=? WHERE id=1').run(n+1);return n+1;});
 let closed=false;
 function principal(headers){if(closed)throw Error('UI_TASK_OWNER_CLOSED');if(db.prepare('SELECT boot_epoch FROM workspace_ui_task_settings_v2 WHERE id=1').get()?.boot_epoch!==bootEpoch)throw Error('UI_TASK_OWNER_REPLACED');const p=sessions.authenticate(headers);if(headers.origin!==undefined&&headers.origin!==sessions.origin)throw Error('HOSTED_CSRF_DENIED');return {p,digest:uiTaskDigestV2({tenantId:p.tenantId,subjectId:p.subjectId,instanceId:p.instanceId,generation:p.generation,role:p.role})};}
 function readRow(id){if(typeof id!=='string'||!/^(?:display|invocation|checkpoint):[a-f0-9]{32}$/.test(id))throw Error('UI_TASK_ID_DENIED');return db.prepare('SELECT * FROM workspace_ui_tasks_v2 WHERE command_id=?').get(id);}
 function project(row){if(!row)throw Error('UI_TASK_UNKNOWN_DENIED');return Object.freeze({schemaVersion:'pansphaira.workspace-ui-task/readback/v2',commandId:row.command_id,requestDigest:row.request_digest,state:row.state,revision:row.revision,result:row.result_json===null?null:JSON.parse(row.result_json),model:'NOT_RUN',businessEffectProduced:false,personalViewPersistenceProduced:false,executionAuthorityGranted:false});}
 const owner=Object.freeze({
  read(headers,id){const a=principal(headers),row=readRow(id);if(!row||row.principal_digest!==a.digest)throw Error('UI_TASK_SCOPE_DENIED');return project(row);},
  original(headers,id){const a=principal(headers),row=readRow(id);if(!row||row.principal_digest!==a.digest)throw Error('UI_TASK_SCOPE_DENIED');return Object.freeze({command:JSON.parse(row.original_command),requestDigest:row.request_digest,readback:project(row)});},
  close(){if(closed)return;closed=true;owned.delete(owner);ledger.close();},
 });
 const contextJournal=createNativeUiContextJournalV1({db,transaction,binding:sessions.binding,principal,readRow,bootEpoch});
 owned.set(owner,{binding:sessions.binding,sessions,root,ledger,budgetConnection:connection,db,transaction,bootEpoch,principal,readRow,project,contextJournal,closed:()=>closed});return owner;
}
export function nativeWorkspaceUiTaskOwnerConnectionV2(owner,binding){
 const entry=owned.get(owner);if(!entry||entry.closed()||canonicalJson(entry.binding)!==canonicalJson(binding))throw Error('UI_TASK_OWNER_DENIED');
 return entry;
}
export const isNativeWorkspaceUiTaskProjectionV2=(owner,binding)=>{try{nativeWorkspaceUiTaskOwnerConnectionV2(owner,binding);return true;}catch{return false;}};

// Separate capability: construction and observation NEVER replace the writer.
// This facade cannot attach as a task owner or expose raw DB/signing methods.
export function createNativeWorkspaceUiTaskReadbackV2(options){
 const {sessions,root}=uiTaskClosedV2(options,['sessions','root'],'UI_TASK_READER_OWNER_DENIED');
 if(!isProtectedSessionAdapterV1(sessions,sessions?.binding?.tenantId)||typeof root!=='string')throw Error('UI_TASK_READER_OWNER_DENIED');
 const c=openResourceBudgetReadonlyConnectionV2({optIn:true,stateRoot:root,tenantId:'tenant:'+sessions.binding.tenantId,bindingDigest:uiTaskDigestV2({schemaVersion:'pansphaira.workspace-native-ui-task/binding/v2',binding:sessions.binding,kind:'MODEL_FREE_BROWSER_DISPLAY'}),limits:{modelUnits:1,runtimeUnits:128}});let closed=false;
 function principal(headers){if(closed)throw Error('UI_TASK_READER_CLOSED');const p=sessions.authenticate(headers);if(headers.origin!==undefined&&headers.origin!==sessions.origin)throw Error('HOSTED_CSRF_DENIED');return uiTaskDigestV2({tenantId:p.tenantId,subjectId:p.subjectId,instanceId:p.instanceId,generation:p.generation,role:p.role});}
 return Object.freeze({read(headers,value){
  const request=uiTaskClosedV2(value,['schemaVersion','commandId','expectedWriterEpoch'],'UI_TASK_READER_INPUT_DENIED');
  if(request.schemaVersion!=='pansphaira.workspace-ui-task/observe/v1'||typeof request.commandId!=='string'||!/^invocation:[a-f0-9]{32}$/.test(request.commandId)||!Number.isSafeInteger(request.expectedWriterEpoch)||request.expectedWriterEpoch<1)throw Error('UI_TASK_READER_INPUT_DENIED');
  const actor=principal(headers),result=c.snapshot(()=>{
   const epoch=c.db.prepare('SELECT boot_epoch FROM workspace_ui_task_settings_v2 WHERE id=1').get()?.boot_epoch;if(epoch!==request.expectedWriterEpoch)throw Error('UI_TASK_READER_EPOCH_STALE');
   const row=c.db.prepare('SELECT * FROM workspace_ui_tasks_v2 WHERE command_id=?').get(request.commandId);if(!row||row.principal_digest!==actor)throw Error('UI_TASK_SCOPE_DENIED');
   const task={schemaVersion:'pansphaira.workspace-ui-task/readback/v2',commandId:row.command_id,requestDigest:row.request_digest,state:row.state,revision:row.revision,result:row.result_json===null?null:JSON.parse(row.result_json),model:'NOT_RUN',businessEffectProduced:false,personalViewPersistenceProduced:false,executionAuthorityGranted:false};
   const budget=readModelFreeUiTaskBudgetV1(c.db,row,epoch);
   return {schemaVersion:'pansphaira.workspace-ui-task/observation/v1',writerEpoch:epoch,task,budget,quality:task.state==='COMPLETED'&&budget.available&&budget.state==='SETTLED'?'CONFIRMED_NATIVE_TASK_AND_USAGE':'UNKNOWN_EFFECT_OR_USAGE',independentRead:true,writerReplaced:false,sourceEventsProduced:false,operations:{cancel:{available:false,reason:'NO_NATIVE_MODEL_TASK_CANCEL_CONTRACT'},resume:{available:false,reason:'NO_NATIVE_MODEL_TASK_RESUME_CONTRACT'}},model:'NOT_RUN',executionAuthorityGranted:false};
  });
  if(principal(headers)!==actor||c.db.prepare('SELECT boot_epoch FROM workspace_ui_task_settings_v2 WHERE id=1').get()?.boot_epoch!==request.expectedWriterEpoch)throw Error('UI_TASK_READER_EPOCH_STALE');return result;
 },close(){if(!closed){closed=true;c.close();}}});
}
