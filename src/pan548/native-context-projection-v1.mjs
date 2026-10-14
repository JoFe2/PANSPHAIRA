// Model-free PAN607 projection. PAN548 remains the sole task/session owner;
// PAN546/PAN597 supply separately issued target evidence. No model provider.
import {canonicalJson} from '../../dist/packages/contracts/src/canonical-json.js';
import {nativeWorkspaceUiTaskOwnerConnectionV2,uiTaskClosedV2,uiTaskDigestV2} from './native-ui-task-projection-v2.mjs';
import {nativeUiContextTaskCoreV1} from './native-context-journal-v1.mjs';
import {workspaceInvocationPolicyRefV1} from './native-model-free-invocations-v1.mjs';
import {isNativeWorkspaceContextSelectionV1} from './native-context-selection.mjs';
import {createNativeUiContextCheckpointsV1} from './native-context-checkpoints-v1.mjs';
const owned=new WeakMap(),constraints=Object.freeze({localOnly:true,noSend:true,personalSave:false,sharedPublish:false});
function immutable(value){if(value&&typeof value==='object'){for(const child of Object.values(value))immutable(child);Object.freeze(value);}return value;}
function optionsOf(value){const d=value&&Object.getOwnPropertyDescriptors(value),keys=d?Reflect.ownKeys(d):[];
 if(!d||![Object.prototype,null].includes(Object.getPrototypeOf(value))||keys.some(k=>!['sessions','tasks','contextSelection'].includes(k))||!keys.includes('sessions')||!keys.includes('tasks')||keys.some(k=>!d[k].enumerable||!('value'in d[k])))throw Error('CONTEXT_PROJECTION_OWNER_DENIED');return value;
}
export function createNativeWorkspaceContextProjectionV1(options){
 const {sessions,tasks,contextSelection=null}=optionsOf(options),t=nativeWorkspaceUiTaskOwnerConnectionV2(tasks,sessions?.binding),j=t.contextJournal;
 if(t.sessions!==sessions||contextSelection!==null&&!isNativeWorkspaceContextSelectionV1(contextSelection,sessions.binding))throw Error('CONTEXT_PROJECTION_OWNER_DENIED');let closed=false;
 function leading(headers){if(closed||t.closed())throw Error('CONTEXT_PROJECTION_OWNER_CLOSED');return j.actor(headers);}
 function taskProjection(headers,row,audience,a){
  const core=nativeUiContextTaskCoreV1(row),original=JSON.parse(row.original_command);
  if(row.command_id.startsWith('invocation:')&&original.candidate.policyRef!==workspaceInvocationPolicyRefV1)throw Error('CONTEXT_PROJECTION_OWNER_POLICY_DENIED');
  const origin=t.db.prepare("SELECT * FROM workspace_ui_context_outbox_v1 WHERE principal_digest=? AND task_id=? AND kind='INTENT_ACCEPTED' ORDER BY seq LIMIT 1").get(a.digest,row.command_id);
  const legacy=!origin,redacted=legacy?a.privacy.privacy_epoch!==1:origin.privacy_epoch!==a.privacy.privacy_epoch;
  if(!legacy)j.origin(a,row);
  const proof=legacy||redacted?null:j.bestProof(headers,row.command_id),result=redacted||row.result_json===null?null:JSON.parse(row.result_json);
  const phase=result?.phase??(result?.schemaVersion==='pansphaira.workspace-surface/render-receipt/v2'?'DOCUMENT_RENDERED':result?.schemaVersion==='pansphaira.workspace-context/checkpoint-result/v1'?'RESULT_CHECKED':null);
  const value={taskId:row.command_id,state:redacted?'PRIVACY_REDACTED':legacy?'OUTCOME_UNCONFIRMED':row.state,ownerState:row.state,revision:row.revision,requestDigest:redacted?null:row.request_digest,resultPhase:redacted?null:phase,resultDigest:result===null?null:uiTaskDigestV2(result),capability:core.capability,policyRef:original.candidate?.policyRef??(row.command_id.startsWith('display:')?'pan597.registered-surface-display/v2':'pan548.context-checkpoint/v1'),expiresAtMs:core.expiresAtMs,constraints:{...constraints},independentTargetEffectVerified:proof!==null,proof:proof?{proofRef:proof.proofId,issuerKind:proof.kind,argumentDigest:proof.argumentDigest,resultRevision:proof.evidence.resultRevision??null,targetPhase:proof.kind==='PAN597_DOCUMENT_RENDERED'?'DOCUMENT_RENDERED':proof.kind==='PAN546_PREVIEW_VALIDATED'?'PREVIEW_VALIDATED':'DOCUMENT_ACCEPTED',clientReportedDomCommit:proof.evidence.clientReportedDomCommit===true,personalViewPersistenceProduced:false,physicalPixelSightCertified:false}:null,legacyUnregisteredIntent:legacy,privacyRedacted:redacted};
  if(audience==='MAIN_CONTRACT'&&!redacted){value.resourceRefs=core.resourceRefs;const b=core.scope.binding??core.scope;const keys=['tenantId','subjectId','role','sessionId','tabId','generation','instanceId'];value.sourceBinding=keys.every(k=>b[k]!==undefined)?Object.fromEntries(keys.map(k=>[k,b[k]])):null;}
  return value;
 }
 function snapshotInsideOwnerTransaction(headers,value){
  const request=uiTaskClosedV2(value,['schemaVersion','audience'],'CONTEXT_PROJECTION_REQUEST_DENIED');if(request.schemaVersion!=='pansphaira.workspace-context-projection/snapshot-request/v1'||!['MAIN_CONTRACT','SPECIALIST_PREVIEW'].includes(request.audience))throw Error('CONTEXT_PROJECTION_AUDIENCE_DENIED');
  const core=(()=>{const a=leading(headers),stream=j.stream(a),rows=t.db.prepare('SELECT * FROM workspace_ui_tasks_v2 WHERE principal_digest=? ORDER BY command_id').all(a.digest),projected=rows.map(row=>taskProjection(headers,row,request.audience,a));
   // Original597 display refs carry surfaces, not session IDs. Derive source only
   // from the uniquely authenticated608 parent whose original command proof is
   // bridged to this exact display ref; historical direct597 rows remain null.
   if(request.audience==='MAIN_CONTRACT')for(const value of projected.filter(x=>x.taskId.startsWith('display:')&&x.proof&&!x.privacyRedacted)){const parents=projected.filter(x=>x.taskId.startsWith('invocation:')&&x.capability==='pan.workspace.document.display/v2'&&x.proof?.proofRef===value.proof.proofRef&&x.sourceBinding!==null&&x.resourceRefs?.objectRef?.objectId===value.resourceRefs?.objectRef?.objectId);if(parents.length===1)value.sourceBinding={...parents[0].sourceBinding};}
   const events=stream.events.map(e=>{const redacted=e.privacyEpoch!==a.privacy.privacy_epoch;return {seq:e.seq,eventKey:e.eventKey,taskId:e.taskId,taskRevision:e.taskRevision,kind:redacted?'PRIVACY_REDACTED':e.kind,privacyEpoch:e.privacyEpoch,eventDigest:uiTaskDigestV2(e),payload:redacted?{constraints:{...constraints},unknownPreserved:true}:{state:e.payload.state,requestDigest:e.payload.requestDigest,argumentDigest:e.payload.argumentDigest,resultDigest:e.payload.resultDigest,proofRef:e.payload.proofRef,constraints:e.payload.constraints,...(request.audience==='MAIN_CONTRACT'?{resourceRefs:e.payload.resourceRefs}:{})}};});
   leading(headers);return {schemaVersion:'pansphaira.workspace-context-projection/owner-snapshot-core/v1',projectorVersion:'PAN548_NATIVE_CONTEXT_V1',source:{taskOwner:'pan548.native-ui-task-projection/v2',eventOwner:'pan548.signed-native-context-outbox/v1',ledgerBindingDigest:uiTaskDigestV2(sessions.binding)},audience:request.audience,purpose:request.audience==='MAIN_CONTRACT'?'LOCAL_CONTEXT_CHECKPOINT':'LOCAL_PREVIEW_VALIDATION',principalDigest:a.digest,privacyEpoch:a.privacy.privacy_epoch,providerEpoch:a.privacy.provider_epoch,constraints:{...constraints},confirmedCursor:t.db.prepare('SELECT cursor FROM workspace_ui_context_cursors_v1 WHERE principal_digest=? AND audience=?').get(a.digest,request.audience)?.cursor??0,retention:{maxSnapshotBytes:65536,maxOwnerEvents:4096,storage:'LOCAL_OWNER_STORE',rawTextExport:false,audioExport:false},streamHead:stream.head,includedSequences:events.map(e=>e.seq),omittedSequences:[],events,tasks:projected};})();
  const snapshotBytes=canonicalJson(core);if(Buffer.byteLength(snapshotBytes)>65536)throw Error('CONTEXT_PROJECTION_SNAPSHOT_LIMIT_DENIED');
  return immutable({...core,schemaVersion:'pansphaira.workspace-context-projection/owner-snapshot/v1',snapshotBytes,snapshotDigest:uiTaskDigestV2(core),phase:'PREPARED',model:'NOT_RUN',executionAuthorityGranted:false,independentTargetEffectVerified:core.tasks.some(x=>x.independentTargetEffectVerified),checkpointRequestSent:false,journalContractImplemented:true});
 }
 function reconcile(headers,value){const c=uiTaskClosedV2(value,['schemaVersion'],'CONTEXT_RECONCILE_INPUT_DENIED');if(c.schemaVersion!=='pansphaira.workspace-context-projection/reconcile/v1')throw Error('CONTEXT_RECONCILE_INPUT_DENIED');return immutable(t.transaction(()=>{
  const a=leading(headers);let completed=0,unknown=0,retired=0,legacyUnknown=0;
  for(const row of t.db.prepare("SELECT * FROM workspace_ui_tasks_v2 WHERE principal_digest=? AND command_id LIKE 'invocation:%' AND state IN('ACCEPTED','OUTCOME_UNCONFIRMED') ORDER BY command_id").all(a.digest)){
   const intent=t.db.prepare("SELECT * FROM workspace_ui_context_outbox_v1 WHERE principal_digest=? AND task_id=? AND kind='INTENT_ACCEPTED' ORDER BY seq LIMIT 1").get(a.digest,row.command_id);
   if(!intent){legacyUnknown++;unknown++;continue;}
   j.origin(a,row);if(intent.privacy_epoch!==a.privacy.privacy_epoch){retired++;continue;}const proof=j.bestProof(headers,row.command_id);
   if(proof&&['PAN597_DOCUMENT_RENDERED','PAN546_PREVIEW_VALIDATED'].includes(proof.kind)){
    const result={phase:proof.kind==='PAN597_DOCUMENT_RENDERED'?'DOCUMENT_RENDERED':'PREVIEW_VALIDATED',reconciledFromIndependentTarget:true,proofRef:proof.proofId,clientRendered:proof.evidence.clientReportedDomCommit===true,personalProfileSaved:false,restored:false};
    t.db.prepare("UPDATE workspace_ui_tasks_v2 SET state='COMPLETED',revision=revision+1,result_json=? WHERE command_id=? AND state IN('ACCEPTED','OUTCOME_UNCONFIRMED')").run(canonicalJson(result),row.command_id);j.record(headers,row.command_id,'INTENT_COMPLETED',proof.proofId);completed++;
   }else{if(row.state==='ACCEPTED')t.db.prepare("UPDATE workspace_ui_tasks_v2 SET state='OUTCOME_UNCONFIRMED',revision=revision+1 WHERE command_id=? AND state='ACCEPTED'").run(row.command_id);j.record(headers,row.command_id,'OUTCOME_UNKNOWN');unknown++;}
  }
  const repaired=j.repairInsideOwnerTransaction(headers);return {schemaVersion:'pansphaira.workspace-context-projection/reconcile-readback/v1',completed,unknown,retired,legacyUnknown,...repaired,targetRedispatched:false,model:'NOT_RUN',executionAuthorityGranted:false};
 }));}
 const checkpoints=createNativeUiContextCheckpointsV1({sessions,tasks,t,j,contextSelection,snapshot:snapshotInsideOwnerTransaction,leading});
 const owner=Object.freeze({snapshot(headers,value){return t.transaction(()=>snapshotInsideOwnerTransaction(headers,value));},reconcile,
  resolveProof(headers,value){const a=leading(headers);const c=uiTaskClosedV2(value,['schemaVersion','taskId','proofRef'],'CONTEXT_PROOF_INPUT_DENIED');if(c.schemaVersion!=='pansphaira.workspace-context-projection/resolve-proof/v1')throw Error('CONTEXT_PROOF_INPUT_DENIED');const intent=t.db.prepare("SELECT * FROM workspace_ui_context_outbox_v1 WHERE principal_digest=? AND task_id=? AND kind='INTENT_ACCEPTED' ORDER BY seq LIMIT 1").get(a.digest,c.taskId);if(!intent||intent.privacy_epoch!==a.privacy.privacy_epoch)throw Error('CONTEXT_PROOF_RETIRED_OR_UNREGISTERED');j.origin(a,t.readRow(c.taskId));return immutable(j.resolveProof(headers,c.taskId,c.proofRef));},
  audit(headers,value){if(closed||t.closed())throw Error('CONTEXT_PROJECTION_OWNER_CLOSED');const c=uiTaskClosedV2(value,['schemaVersion','taskId'],'CONTEXT_AUDIT_INPUT_DENIED');if(c.schemaVersion!=='pansphaira.workspace-context-projection/audit/v1')throw Error('CONTEXT_AUDIT_INPUT_DENIED');return j.audit(headers,c.taskId);},
  prepare:checkpoints.prepare,checkResult:checkpoints.checkResult,correct:checkpoints.correct,revoke:checkpoints.revoke,providerSwitch:checkpoints.providerSwitch,checkpoint:checkpoints.read,
  close(){closed=true;owned.delete(owner);},
 });owned.set(owner,{binding:sessions.binding,contextSelection,tasks,connection:checkpoints});return owner;
}
export function nativeWorkspaceContextRequestConnectionV1(owner,binding){const x=owned.get(owner);if(!x||canonicalJson(x.binding)!==canonicalJson(binding))throw Error('CONTEXT_REQUEST_OWNER_DENIED');return Object.freeze({acceptRequestBytes:x.connection.acceptRequestBytes});}

export const isNativeWorkspaceContextProjectionV1=(owner,binding,contextSelection)=>owned.has(owner)&&canonicalJson(owned.get(owner).binding)===canonicalJson(binding)&&owned.get(owner).contextSelection===contextSelection;

// Host-only same-owner native snapshot validation, not an HTTP/caller callback.
export function nativeWorkspaceContextRuleTargetsConnectionV1(owner,binding,contextSelection,tasks){const x=owned.get(owner);if(!x||canonicalJson(x.binding)!==canonicalJson(binding)||x.contextSelection!==contextSelection||x.tasks!==tasks)throw Error('CONTEXT_REQUEST_OWNER_DENIED');return Object.freeze({prepare(headers,value,check){if(typeof check!=='function')throw Error('CONTEXT_CHECKPOINT_NATIVE_CHECK_DENIED');return x.connection.prepare(headers,value,check);}});}

