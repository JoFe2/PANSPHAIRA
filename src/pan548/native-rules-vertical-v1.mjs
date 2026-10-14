// PAN612's explicitly permitted MODEL_FREE_RULES_CONTEXT_VERTICAL profile.
// Compose existing signed PAN548/546/597/607/608 owners; no DDL, target
// execution, policy/tool registry, model provider, new store or Main claim.
import {canonicalJson} from '../../dist/packages/contracts/src/canonical-json.js';
import {uiTaskClosedV2,nativeWorkspaceUiTaskOwnerConnectionV2} from './native-ui-task-projection-v2.mjs';
import {isNativeWorkspaceContextProjectionV1,nativeWorkspaceContextRuleTargetsConnectionV1} from './native-context-projection-v1.mjs';
const frozen=v=>{if(v&&typeof v==='object'){for(const x of Object.values(v))frozen(x);Object.freeze(v);}return v;};
const denied=code=>{throw Error(code);};
const fixed=Object.freeze({localOnly:true,noSend:true,personalSave:false,sharedPublish:false}),owned=new WeakMap();
export function createNativeWorkspaceRulesVerticalV1(options){
 let selected,t;
 try{selected=uiTaskClosedV2(options,['sessions','tasks','contextSelection','projection'],'RULES_VERTICAL_OWNER_DENIED');t=nativeWorkspaceUiTaskOwnerConnectionV2(selected.tasks,selected.sessions?.binding);if(t.sessions!==selected.sessions||!isNativeWorkspaceContextProjectionV1(selected.projection,selected.sessions.binding,selected.contextSelection))denied('RULES_VERTICAL_OWNER_DENIED');}catch{denied('RULES_VERTICAL_OWNER_DENIED');}
 const {projection}=selected,connection=nativeWorkspaceContextRuleTargetsConnectionV1(projection,selected.sessions.binding,selected.contextSelection,selected.tasks);let closed=false;
 const owner=Object.freeze({
  prepare(headers,value){
   if(closed||t.closed())denied('RULES_VERTICAL_OWNER_CLOSED');
   const c=uiTaskClosedV2(value,['schemaVersion','documentTaskId','previewTaskId','context','boundary','previousRequestId'],'RULES_VERTICAL_INPUT_DENIED');
   if(c.schemaVersion!=='pansphaira.workspace-rules-vertical/prepare/v1'||typeof c.documentTaskId!=='string'||typeof c.previewTaskId!=='string'||c.documentTaskId===c.previewTaskId||!/^display:[a-f0-9]{32}$/.test(c.documentTaskId)||!/^invocation:[a-f0-9]{32}$/.test(c.previewTaskId)||!['TURN','TOOL'].includes(c.boundary))denied('RULES_VERTICAL_INPUT_DENIED');
   const targetTasks=[],scopeKeys=['tenantId','subjectId','role','sessionId','tabId','generation','instanceId'];
   const context=connection.prepare(headers,{schemaVersion:'pansphaira.workspace-context-projection/prepare/v1',audience:'MAIN_CONTRACT',context:c.context,boundary:c.boundary,previousRequestId:c.previousRequestId,cursor:projection.snapshot(headers,{schemaVersion:'pansphaira.workspace-context-projection/snapshot-request/v1',audience:'MAIN_CONTRACT'}).confirmedCursor},(snap,current)=>{
    if(canonicalJson(snap.constraints)!==canonicalJson(fixed)||snap.model!=='NOT_RUN'||snap.executionAuthorityGranted!==false)denied('RULES_VERTICAL_CONTEXT_DENIED');
    const specs=[[c.documentTaskId,'DOCUMENT_RENDERED','PAN597_DOCUMENT_RENDERED'],[c.previewTaskId,'PREVIEW_VALIDATED','PAN546_PREVIEW_VALIDATED']];
    for(const [id,phase,kind] of specs){
     const rows=snap.tasks.filter(row=>row.taskId===id);if(rows.length!==1)denied('RULES_VERTICAL_TARGET_SCOPE_DENIED');const row=rows[0];
     if(row.state!=='COMPLETED'||row.privacyRedacted||row.legacyUnregisteredIntent||row.resultPhase!==phase||!row.independentTargetEffectVerified||row.proof?.issuerKind!==kind||row.proof?.targetPhase!==phase||canonicalJson(row.constraints)!==canonicalJson(fixed)||Date.now()>=row.expiresAtMs)denied('RULES_VERTICAL_TARGET_PHASE_OR_SCOPE_DENIED');
     const proof=projection.resolveProof(headers,{schemaVersion:'pansphaira.workspace-context-projection/resolve-proof/v1',taskId:id,proofRef:row.proof.proofRef});
     if(proof.kind!==kind||proof.independentOwnerRegisterVerified!==true||proof.executionAuthorityGranted!==false||proof.argumentDigest!==row.proof.argumentDigest)denied('RULES_VERTICAL_NATIVE_PROOF_DENIED');
     const source=kind==='PAN597_DOCUMENT_RENDERED'?row.sourceBinding:proof.scope?.binding;if(!source||scopeKeys.some(k=>source[k]===undefined))denied('RULES_VERTICAL_SOURCE_SESSION_TAB_OBJECT_SCOPE_DENIED');const binding=Object.fromEntries(scopeKeys.map(k=>[k,source?.[k]])),live=Object.fromEntries(scopeKeys.map(k=>[k,current.binding[k]])),objectId=current.context.primaryObject?.objectId??null;if(canonicalJson(binding)!==canonicalJson(live)||proof.resourceRefs?.objectRef?.objectId!==objectId||row.resourceRefs?.objectRef?.objectId!==objectId)denied('RULES_VERTICAL_SOURCE_SESSION_TAB_OBJECT_SCOPE_DENIED');
     targetTasks.push({sourceBinding:binding,objectId,taskId:id,taskRevision:row.revision,resultDigest:row.resultDigest,argumentDigest:proof.argumentDigest,proofRef:row.proof.proofRef,issuerKind:kind,targetPhase:phase,clientReportedDomCommit:row.proof.clientReportedDomCommit,personalViewPersistenceProduced:false,physicalPixelSightCertified:false});
    }
   });
    const prepared=JSON.parse(context.snapshotBytes);
    for(const target of targetTasks){const row=prepared.tasks.find(r=>r.taskId===target.taskId);if(!row||row.revision!==target.taskRevision||row.resultDigest!==target.resultDigest||row.proof?.proofRef!==target.proofRef||row.state!=='COMPLETED'||canonicalJson(row.constraints)!==canonicalJson(fixed))denied('RULES_VERTICAL_PREPARED_TASK_BYTES_CONFLICT');}
    if(prepared.constraints.noSend!==true||context.model!=='NOT_RUN'||context.realModelAcceptance!==false||context.checkpointRequestSent!==false)denied('RULES_VERTICAL_PREPARED_CONSTRAINT_DENIED');
    return frozen({schemaVersion:'pansphaira.workspace-rules-vertical/readback/v1',profile:'MODEL_FREE_RULES_CONTEXT_VERTICAL',phase:'CONTRACT_PREPARED',targetTasks,context,constraints:{...fixed},model:'NOT_RUN',realModelAcceptance:false,mainRequestSent:false,executionAuthorityGranted:false,targetEffectsRedispatched:false,original612GenuineMainAcceptance:false});
  },
  close(){closed=true;owned.delete(owner);},
 });owned.set(owner,selected);return owner;
}
export function isNativeWorkspaceRulesVerticalV1(owner,sessions,contextSelection,projection){const x=owned.get(owner);return !!x&&x.sessions===sessions&&x.contextSelection===contextSelection&&x.projection===projection&&isNativeWorkspaceContextProjectionV1(projection,sessions.binding,contextSelection);}
