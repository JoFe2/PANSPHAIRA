// Invocation/admission belongs to PAN548. No model, routing-training authority,
// second task ledger, policy engine, source registry, mail or profile-save grant.
import {createHash,randomBytes,timingSafeEqual} from 'node:crypto';
import {canonicalJson} from '../../dist/packages/contracts/src/canonical-json.js';
import {isNativeWorkspaceContextSelectionV1} from './native-context-selection.mjs';
import {nativeWorkspaceUiTaskOwnerConnectionV2,createNativeWorkspaceUiTaskReadbackV2,uiTaskClosedV2,uiTaskDigestV2} from './native-ui-task-projection-v2.mjs';
import {isNativeWorkspaceViewOwnerV1,nativeWorkspaceViewContextProofConnectionV1} from '../pan546/native-view-owner.mjs';
import {nativeWorkspaceSurfaceInvocationConnectionV1} from '../pan597/native-surfaces-v2.mjs';
import {modelFreeUiBudgetBindingV1,modelFreeUiTaskReservationV1,readModelFreeUiTaskBudgetV1} from './native-ui-task-budget-v1.mjs';
import {parseModelFreeFinalTextV1} from './model-free-final-text-v1.mjs';
import {executeNativeWorkspaceInvocationV1} from './native-invocation-executor-v1.mjs';
const owned=new WeakMap();
const constraints=Object.freeze({localOnly:true,noSend:true,personalSave:false,sharedPublish:false});
const capabilities=Object.freeze(['pan.workspace.view.preview/v1','pan.workspace.document.display/v2']);
const purpose='REVERSIBLE_UI_PRESENTATION';
// Bootstrap this immutable descriptor without calling a not-yet-initialized
// owner-module const through the existing origin/context/task import cycle.
export const workspaceInvocationPolicyRefV1='pansphaira.workspace-invocation/policy/v1:'+createHash('sha256').update(canonicalJson({capabilities,constraints,purpose})).digest('hex');
const noEffects=Object.freeze({model:'NOT_RUN',businessEffectProduced:false,personalViewPersistenceProduced:false,executionAuthorityGranted:false});
const freeze=value=>{if(value&&typeof value==='object'){for(const v of Object.values(value))freeze(v);Object.freeze(value);}return value;};
const copy=value=>JSON.parse(canonicalJson(value));
const token=()=>randomBytes(32).toString('hex');
const same=(a,b)=>typeof a==='string'&&typeof b==='string'&&a.length===b.length&&timingSafeEqual(Buffer.from(a),Buffer.from(b));
const resolutionKeys=['schemaVersion','input','context','selectedCardId','targetSurfaceId'];
const selectKeys=['schemaVersion','setId','requestDigest','setDigest','candidateId','argumentDigest','policyRef'];
const executeKeys=['schemaVersion','invocationId','admissionToken','requestDigest','setDigest','candidateId','argumentDigest','policyRef'];
export function createNativeWorkspaceInvocationsV1(options){
 const {sessions,contextSelection,tasks,viewOwner,surfaces}=uiTaskClosedV2(options,['sessions','contextSelection','tasks','viewOwner','surfaces'],'INVOCATION_OWNER_DENIED');
 if(!isNativeWorkspaceContextSelectionV1(contextSelection,sessions?.binding)||!isNativeWorkspaceViewOwnerV1(viewOwner,sessions?.binding,contextSelection))throw Error('INVOCATION_OWNER_DENIED');
 const t=nativeWorkspaceUiTaskOwnerConnectionV2(tasks,sessions.binding),surface=nativeWorkspaceSurfaceInvocationConnectionV1(surfaces,sessions.binding,contextSelection),sets=new Map(),admissions=new Map();let closed=false;
 // Restart may read old markers, but never reconstitutes an executable lease.
 t.transaction(()=>{if(t.db.prepare('SELECT boot_epoch FROM workspace_ui_task_settings_v2 WHERE id=1').get()?.boot_epoch!==t.bootEpoch)throw Error('UI_TASK_OWNER_REPLACED');t.db.prepare("UPDATE workspace_ui_tasks_v2 SET state='OUTCOME_UNCONFIRMED',revision=revision+1 WHERE command_id LIKE 'invocation:%' AND state='ACCEPTED'").run();});
 const independentReader=createNativeWorkspaceUiTaskReadbackV2({sessions,root:t.root});
 function leading(headers){if(closed)throw Error('INVOCATION_OWNER_CLOSED');return t.principal(headers);}
 function issuedSet(headers,id){const a=leading(headers),s=sets.get(id);if(!s||s.principalDigest!==a.digest)throw Error('INVOCATION_SET_SCOPE_DENIED');if(Date.now()>=s.core.expiresAtMs)throw Error('INVOCATION_SET_EXPIRED');return s;}
 function validateSelection(s,c){
  if(c.requestDigest!==s.core.requestDigest||c.setDigest!==s.setDigest||c.policyRef!==workspaceInvocationPolicyRefV1)throw Error('INVOCATION_SET_POLICY_OR_DIGEST_DENIED');
  const member=s.core.candidates.find(x=>x.candidateId===c.candidateId);
  if(!member||c.argumentDigest!==member.argumentDigest||s.core.outcome!=='RESOLVED'||s.core.selectedCandidateId!==member.candidateId)throw Error('INVOCATION_SELECTION_DENIED');
  if(!capabilities.includes(member.capability)||member.purpose!==purpose||canonicalJson(member.constraints)!==canonicalJson(constraints)||member.policyRef!==workspaceInvocationPolicyRefV1)throw Error('INVOCATION_CAPABILITY_DENIED');
  return member;
 }
 function revalidate(headers,s,member){
  const a=leading(headers);if(a.digest!==s.principalDigest||Date.now()>=s.core.expiresAtMs||Date.now()>=member.expiresAtMs)throw Error('INVOCATION_DEADLINE_OR_SCOPE_DENIED');
  const context=contextSelection.verify(headers,s.request.context),snapshot=surface.snapshot(headers);
  if(canonicalJson(context)!==canonicalJson(s.context)||canonicalJson(snapshot.binding)!==canonicalJson(s.binding)||canonicalJson(snapshot.source)!==canonicalJson(s.source))throw Error('INVOCATION_CONTEXT_SCOPE_STALE');
  if(member.capability===capabilities[0]){
   const before=viewOwner.read(headers,s.request.context);if(before.revision!==member.revisions.viewRevision||before.viewDigest!==member.revisions.viewDigest||before.view.instances.find(x=>x.instanceId===member.objectRef.instanceId)?.size!==member.objectRef.beforeSize)throw Error('INVOCATION_VIEW_REVISION_STALE');
  }else{
   const peer=snapshot.targets.find(x=>x.surface.surfaceId===member.targetRef.surfaceId);
   if(!peer||canonicalJson(peer)!==canonicalJson(member.targetRef.peer))throw Error('INVOCATION_TARGET_SCOPE_STALE');
   surface.validateDisplay(headers,JSON.parse(member.argumentBytes));
  }
  leading(headers);contextSelection.verify(headers,s.request.context);if(Date.now()>=member.expiresAtMs)throw Error('INVOCATION_DEADLINE_OR_SCOPE_DENIED');return true;
 }
 function candidate(base,args){const argumentBytes=canonicalJson(args),argumentDigest=uiTaskDigestV2(args);const unsigned={schemaVersion:'pansphaira.workspace-invocation/candidate/v1',...base,argumentBytes,argumentDigest,policyRef:workspaceInvocationPolicyRefV1,purpose,constraints};return freeze({...unsigned,candidateId:'candidate:'+uiTaskDigestV2(unsigned)});}
 const owner=Object.freeze({
  resolve(headers,value){
   const raw=uiTaskClosedV2(value,resolutionKeys,'INVOCATION_REQUEST_DENIED');
   if(raw.schemaVersion!=='pansphaira.workspace-invocation/resolve/v1'||raw.selectedCardId!==null&&typeof raw.selectedCardId!=='string'||raw.targetSurfaceId!==null&&typeof raw.targetSurfaceId!=='string')throw Error('INVOCATION_REQUEST_DENIED');
   // Close nested data BEFORE canonical serialization: a direct caller may
   // supply accessors/toJSON or fabricated argument objects, unlike JSON HTTP.
   const parsed=parseModelFreeFinalTextV1(raw.input),input=uiTaskClosedV2(raw.input,['schemaVersion','inputKind','final','text'],'INVOCATION_FINAL_TEXT_DENIED');
   const verification=raw.context===null?null:uiTaskClosedV2(raw.context,['schemaVersion','tabId','contextHandle'],'INVOCATION_CONTEXT_INPUT_DENIED');
   if(verification&&Object.values(verification).some(v=>typeof v!=='string'))throw Error('INVOCATION_CONTEXT_INPUT_DENIED');
   const request=copy({...raw,input,context:verification}),a=leading(headers);
   if(parsed.outcome!=='RESOLVE')return freeze({schemaVersion:'pansphaira.workspace-invocation/resolution/v1',outcome:parsed.outcome,reason:parsed.reason,set:null,...noEffects});
   if(request.context===null)return freeze({schemaVersion:'pansphaira.workspace-invocation/resolution/v1',outcome:'CLARIFY',reason:'NATIVE_CONTEXT_REQUIRED',set:null,...noEffects});
   const context=contextSelection.verify(headers,request.context),snapshot=surface.snapshot(headers),expiresAtMs=Math.min(context.lease.expiresAtMs,snapshot.binding.expiresAtMs,Date.now()+60000),invocationId='invocation:'+randomBytes(16).toString('hex'),setId='set:'+randomBytes(16).toString('hex');
   const candidates=[],scope=freeze({binding:copy(snapshot.binding),source:copy(snapshot.source),contextHandle:context.contextHandle});
   if(parsed.intent==='PREVIEW_CARD_SMALLER'&&context.moduleId==='pan.erv'&&context.primaryObject){
    const before=viewOwner.read(headers,request.context),sizes=['compact','regular','large'];
    for(const card of before.view.instances){const n=sizes.indexOf(card.size);if(!card.visible||n<1)continue;
     const args={schemaVersion:'pansphaira.workspace-module-view/preview/v1',context:request.context,delta:{schemaVersion:'pansphaira.workspace-module-view/delta/v1',operations:[{kind:'RESIZE',instanceId:card.instanceId,size:sizes[n-1]}]}};
     candidates.push(candidate({invocationId,capability:capabilities[0],objectRef:{moduleId:context.moduleId,viewId:context.viewId,objectId:context.primaryObject.objectId,instanceId:card.instanceId,beforeSize:card.size},documentRef:null,targetRef:{kind:'CURRENT_PERSONAL_VIEW',surfaceId:snapshot.source.surfaceId},revisions:{native:context.revisions,viewRevision:before.revision,viewDigest:before.viewDigest},scope,expiresAtMs},args));
    }
   }else if(parsed.intent==='DISPLAY_SELECTED_DOCUMENT'&&context.moduleId==='pan.erv'&&context.primaryObject){
    for(const doc of snapshot.catalog.filter(x=>x.kind==='DOCUMENT'&&x.objectId===context.primaryObject.objectId))for(const peer of snapshot.targets){
     const target=peer.surface,deadline=Math.min(expiresAtMs,peer.binding.expiresAtMs),source=snapshot.source;
     const args={schemaVersion:'pansphaira.workspace-surface/display-command/v2',commandId:'display:'+invocationId.slice('invocation:'.length),sourceSurfaceId:source.surfaceId,sourceConnectionEpoch:source.connectionEpoch,sourceContextEpoch:source.contextEpoch,sourceRevisionDigest:source.revisionDigest,targetSurfaceId:target.surfaceId,targetConnectionEpoch:target.connectionEpoch,targetContextEpoch:target.contextEpoch,targetRevisionDigest:target.revisionDigest,targetLocalGeneration:target.localGeneration,routeId:doc.routeId,objectId:doc.objectId,expectedRevision:doc.dataRevision,expiresAtMs:deadline};
     surface.validateDisplay(headers,args);
     candidates.push(candidate({invocationId,capability:capabilities[1],objectRef:{objectId:context.primaryObject.objectId},documentRef:doc,targetRef:{kind:'REGISTERED_BROWSER_SURFACE',surfaceId:target.surfaceId,peer:copy(peer)},revisions:{native:context.revisions,documentRevision:doc.dataRevision,target:peer.binding.revisions},scope,expiresAtMs:deadline},args));
    }
   }
   const selected=candidates.filter(c=>parsed.intent==='PREVIEW_CARD_SMALLER'?request.selectedCardId!==null&&context.selection?.elementId==='pan.erv.module-card'&&context.selection.rowId===request.selectedCardId&&c.objectRef.instanceId===request.selectedCardId:request.targetSurfaceId!==null&&c.targetRef.surfaceId===request.targetSurfaceId);
   const missing=parsed.intent==='PREVIEW_CARD_SMALLER'?request.selectedCardId===null:request.targetSurfaceId===null;
   const outcome=selected.length===1?'RESOLVED':candidates.length===0&&!missing?'NONE':'CLARIFY';
   const core=freeze({schemaVersion:'pansphaira.workspace-invocation/candidate-set/v1',setId,invocationId,requestDigest:uiTaskDigestV2(request),policyRef:workspaceInvocationPolicyRefV1,expiresAtMs,outcome,selectedCandidateId:selected.length===1?selected[0].candidateId:null,candidates});
   for(const [id,s]of sets)if(Date.now()>=s.core.expiresAtMs){sets.delete(id);admissions.delete(s.core.invocationId);}
   if(sets.size>=128)throw Error('INVOCATION_SET_CAPACITY_DENIED');
   const setDigest=uiTaskDigestV2(core);sets.set(setId,{core,setDigest,request,principalDigest:a.digest,context:copy(context),binding:copy(snapshot.binding),source:copy(snapshot.source)});
   return freeze({schemaVersion:'pansphaira.workspace-invocation/resolution/v1',outcome,reason:selected.length===1?'ONE_COMPLETE_SELECTED_CANDIDATE':missing?'SELECTION_REQUIRED':outcome==='NONE'?'NO_ELIGIBLE_EFFECT':'SELECTION_NOT_UNAMBIGUOUS',set:{...core,setDigest},...noEffects});
  },
  admit(headers,value){
   const c=uiTaskClosedV2(value,selectKeys,'INVOCATION_ADMISSION_INPUT_DENIED');if(c.schemaVersion!=='pansphaira.workspace-invocation/admit/v1')throw Error('INVOCATION_ADMISSION_INPUT_DENIED');
   const s=issuedSet(headers,c.setId),member=validateSelection(s,c);revalidate(headers,s,member);
   if(admissions.has(s.core.invocationId)||t.readRow(s.core.invocationId))throw Error('INVOCATION_ALREADY_ADMITTED_OR_ATTEMPTED');
   const admissionToken=token();admissions.set(s.core.invocationId,{s,member,tokenDigest:uiTaskDigestV2(admissionToken)});
   return freeze({schemaVersion:'pansphaira.workspace-invocation/admission/v1',invocationId:s.core.invocationId,admissionToken,requestDigest:c.requestDigest,setDigest:c.setDigest,candidateId:c.candidateId,argumentDigest:c.argumentDigest,policyRef:c.policyRef,capability:member.capability,expiresAtMs:member.expiresAtMs,constraints,...noEffects});
  },
  execute(headers,value){return executeNativeWorkspaceInvocationV1(owner,headers,value);},
  read(headers,value){const c=uiTaskClosedV2(value,['schemaVersion','invocationId'],'INVOCATION_READ_INPUT_DENIED');if(c.schemaVersion!=='pansphaira.workspace-invocation/read/v1')throw Error('INVOCATION_READ_INPUT_DENIED');leading(headers);const custody=independentReader.read(headers,{schemaVersion:'pansphaira.workspace-ui-task/observe/v1',commandId:c.invocationId,expectedWriterEpoch:t.bootEpoch});return freeze({schemaVersion:'pansphaira.workspace-invocation/readback/v1',invocationId:c.invocationId,task:custody.task,custody,independentRead:true,...noEffects});},
  close(){closed=true;independentReader.close();sets.clear();admissions.clear();owned.delete(owner);},
 });
 const connection=Object.freeze({sessions,contextSelection,viewOwner,surfaces,tasks,
  begin(headers,value){
   const c=uiTaskClosedV2(value,executeKeys,'INVOCATION_EXECUTOR_INPUT_DENIED');if(c.schemaVersion!=='pansphaira.workspace-invocation/execute/v1')throw Error('INVOCATION_EXECUTOR_INPUT_DENIED');
   const a=leading(headers);if(typeof c.invocationId!=='string'||!/^invocation:[a-f0-9]{32}$/.test(c.invocationId)||typeof c.admissionToken!=='string'||!/^[a-f0-9]{64}$/.test(c.admissionToken))throw Error('INVOCATION_ADMISSION_REQUIRED');const admission=admissions.get(c.invocationId);if(!admission||!same(uiTaskDigestV2(c.admissionToken),admission.tokenDigest))throw Error('INVOCATION_ADMISSION_REQUIRED');
   const {s,member}=admission;validateSelection(s,c);revalidate(headers,s,member);
   if(t.readRow(c.invocationId))throw Error('INVOCATION_ATTEMPT_ALREADY_REQUIRES_READBACK');
   const original={schemaVersion:'pansphaira.workspace-invocation/effect-command/v2',invocationId:c.invocationId,request:s.request,set:{...s.core,setDigest:s.setDigest},candidate:member,budgetBinding:modelFreeUiBudgetBindingV1(c.invocationId,t.bootEpoch)};
   t.transaction(()=>{revalidate(headers,s,member);if(t.readRow(c.invocationId))throw Error('INVOCATION_ATTEMPT_ALREADY_REQUIRES_READBACK');if(t.db.prepare('SELECT count(*) n FROM workspace_ui_tasks_v2').get().n>=128)throw Error('INVOCATION_TASK_CAPACITY_DENIED');const requestDigest=uiTaskDigestV2(original),binding=modelFreeUiTaskReservationV1({command_id:c.invocationId,original_command:canonicalJson(original),request_digest:requestDigest,principal_digest:a.digest}),{writerEpoch,...reservation}=binding;const reserved=t.budgetConnection.reserveInsideOwnerTransactionV2(reservation);if(reserved.replayed||!t.budgetConnection.markUnknownInsideOwnerTransactionV2(binding.operationId).dispatchGranted)throw Error('INVOCATION_BUDGET_ALREADY_REQUIRES_READBACK');t.db.prepare("INSERT INTO workspace_ui_tasks_v2 VALUES(?,?,?,?,'ACCEPTED',1,NULL)").run(c.invocationId,requestDigest,canonicalJson(original),a.digest);t.contextJournal.accepted(headers,c.invocationId);});
   return {s,member,invocationId:c.invocationId};
  },
  revalidate(headers,effect){return revalidate(headers,effect.s,effect.member);},
  finish(headers,effect,result){
   leading(headers);const row=t.readRow(effect.invocationId),binding=modelFreeUiTaskReservationV1(row);
   const commit=()=>{leading(headers);const fresh=t.readRow(effect.invocationId);if(fresh.state!=='ACCEPTED'||fresh.principal_digest!==t.principal(headers).digest)throw Error('INVOCATION_FINISH_CUSTODY_DENIED');let proof=null;
    if(effect.member.capability===capabilities[0]){const evidence=nativeWorkspaceViewContextProofConnectionV1(viewOwner,sessions.binding,contextSelection).verifyPreview(headers,effect.member.argumentBytes,result.preview);proof=t.contextJournal.issueTargetProof(headers,effect.invocationId,'PAN546_PREVIEW_VALIDATED',evidence);t.contextJournal.record(headers,effect.invocationId,'PROPOSAL_VALIDATED',proof.proofId);}
    else proof=t.contextJournal.bestProof(headers,JSON.parse(effect.member.argumentBytes).commandId);
    if(!proof)throw Error('INVOCATION_CONTEXT_NATIVE_TARGET_PROOF_REQUIRED');
    t.db.prepare("UPDATE workspace_ui_tasks_v2 SET state='COMPLETED',revision=revision+1,result_json=? WHERE command_id=? AND state='ACCEPTED'").run(canonicalJson(result),effect.invocationId);t.contextJournal.record(headers,effect.invocationId,'INTENT_COMPLETED',proof.proofId);return true;
   };
   if(binding){const receipt=t.ledger.ownerCompletionEvidence({operationId:binding.operationId,requestDigest:binding.requestDigest,modelUnits:0,runtimeUnits:1,evidenceDigest:uiTaskDigestV2(result)});t.ledger.settle(receipt,result,commit);}else t.transaction(commit);
   return freeze({schemaVersion:'pansphaira.workspace-invocation/effect-readback/v1',invocationId:effect.invocationId,capability:effect.member.capability,expiresAtMs:effect.member.expiresAtMs,result,task:tasks.read(headers,effect.invocationId),...noEffects});
  },
  failed(effect){t.transaction(()=>{if(t.db.prepare('SELECT boot_epoch FROM workspace_ui_task_settings_v2 WHERE id=1').get()?.boot_epoch!==t.bootEpoch)throw Error('UI_TASK_OWNER_REPLACED');t.db.prepare("UPDATE workspace_ui_tasks_v2 SET state='OUTCOME_UNCONFIRMED',revision=revision+1 WHERE command_id=? AND state='ACCEPTED'").run(effect.invocationId);});},
  // Native owner-only recovery; not an HTTP operation, retry, cancel or resume.
  // A persisted, same-principal PAN597 target proof is mandatory; preview-only
  // in-memory outcomes without such a proof remain UNKNOWN with their hold.
  reconcileUnknown(headers,value){
   const c=uiTaskClosedV2(value,['schemaVersion','invocationId','expectedRevision','expectedWriterEpoch'],'INVOCATION_RECONCILE_INPUT_DENIED');
   if(c.schemaVersion!=='pansphaira.workspace-invocation/reconcile-native/v1'||c.expectedWriterEpoch!==t.bootEpoch||!Number.isSafeInteger(c.expectedRevision)||c.expectedRevision<1)throw Error('INVOCATION_RECONCILE_SCOPE_DENIED');
   const a=leading(headers),row=t.readRow(c.invocationId);if(!row||row.principal_digest!==a.digest||row.state!=='OUTCOME_UNCONFIRMED'||row.revision!==c.expectedRevision)throw Error('INVOCATION_RECONCILE_SCOPE_DENIED');
   const original=JSON.parse(row.original_command),binding=modelFreeUiTaskReservationV1(row);readModelFreeUiTaskBudgetV1(t.db,row,t.bootEpoch);
   if(!binding||original.candidate.capability!=='pan.workspace.document.display/v2')throw Error('INVOCATION_NATIVE_RECONCILIATION_UNAVAILABLE');
   const proof=t.contextJournal.bestProof(headers,c.invocationId);if(!proof||!['PAN597_DOCUMENT_ACCEPTED','PAN597_DOCUMENT_RENDERED'].includes(proof.kind))throw Error('INVOCATION_NATIVE_RECONCILIATION_UNAVAILABLE');
   const command=JSON.parse(original.candidate.argumentBytes),result={phase:'DOCUMENT_ACCEPTED',clientRendered:false,personalProfileSaved:false,restored:false,reconciliation:{historicalNativeTargetAccepted:true,proofRef:proof.proofId,commandId:command.commandId,targetRedispatched:false,currentTargetRenderedClaim:false}};
   const receipt=t.ledger.ownerCompletionEvidence({operationId:binding.operationId,requestDigest:binding.requestDigest,modelUnits:0,runtimeUnits:1,evidenceDigest:uiTaskDigestV2(result)});
   t.ledger.settle(receipt,result,()=>{const actor=leading(headers),fresh=t.readRow(c.invocationId);if(actor.digest!==a.digest||fresh.principal_digest!==a.digest||fresh.state!=='OUTCOME_UNCONFIRMED'||fresh.revision!==c.expectedRevision||t.contextJournal.bestProof(headers,c.invocationId)?.proofId!==proof.proofId)throw Error('INVOCATION_RECONCILE_SCOPE_DENIED');t.db.prepare("UPDATE workspace_ui_tasks_v2 SET state='COMPLETED',revision=revision+1,result_json=? WHERE command_id=? AND state='OUTCOME_UNCONFIRMED' AND revision=?").run(canonicalJson(result),c.invocationId,c.expectedRevision);t.contextJournal.record(headers,c.invocationId,'INTENT_COMPLETED',proof.proofId);return true;});
   return owner.read(headers,{schemaVersion:'pansphaira.workspace-invocation/read/v1',invocationId:c.invocationId});
  },
 });
 owned.set(owner,{binding:sessions.binding,contextSelection,connection});return owner;
}
export const isNativeWorkspaceInvocationsV1=(owner,binding,contextSelection)=>owned.has(owner)&&canonicalJson(owned.get(owner).binding)===canonicalJson(binding)&&owned.get(owner).contextSelection===contextSelection;
export function nativeWorkspaceInvocationExecutorConnectionV1(owner){const entry=owned.get(owner);if(!entry)throw Error('INVOCATION_EXECUTOR_OWNER_DENIED');return entry.connection;}
