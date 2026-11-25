// Model-free PAN607 projection. PAN548 remains the sole task/session owner;
// PAN546/PAN597 supply separately issued target evidence. No model provider.
import {canonicalJson} from '../../dist/packages/contracts/src/canonical-json.js';
import {createNativeWorkspaceUiTaskReadbackV2,nativeWorkspaceUiTaskOwnerConnectionV2,uiTaskClosedV2,uiTaskDigestV2} from './native-ui-task-projection-v2.mjs';
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
 function completeRecordedStream(a){
  const stream=j.stream(a);
  // A signed prefix is not a complete stream when an append sidecar extends past its head.
  // Sidecars can deny an inconsistent read, but never supply a missing event.
  if(t.db.prepare(`SELECT 1 AS gap WHERE
   EXISTS(SELECT 1 FROM workspace_ui_context_projection_v1 WHERE principal_digest=? AND seq>?) OR
   EXISTS(SELECT 1 FROM workspace_ui_context_event_clock_v1 WHERE principal_digest=? AND seq>?)`)
   .get(a.digest,stream.head.seq,a.digest,stream.head.seq))throw Error('CONTEXT_STREAM_GAP_OR_BYTES_DENIED');
  return stream;
 }
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
   const events=stream.events.map(e=>{const redacted=e.privacyEpoch!==a.privacy.privacy_epoch;return {seq:e.seq,eventKey:e.eventKey,taskId:e.taskId,taskRevision:e.taskRevision,kind:redacted?'PRIVACY_REDACTED':e.kind,privacyEpoch:e.privacyEpoch,eventDigest:uiTaskDigestV2(e),...(request.audience==='MAIN_CONTRACT'&&!redacted&&e.action!==undefined?{action:e.action}:{}),payload:redacted?{constraints:{...constraints},unknownPreserved:true}:{state:e.payload.state,requestDigest:e.payload.requestDigest,argumentDigest:e.payload.argumentDigest,resultDigest:e.payload.resultDigest,proofRef:e.payload.proofRef,constraints:e.payload.constraints,...(request.audience==='MAIN_CONTRACT'?{resourceRefs:e.payload.resourceRefs}:{})}};});
   leading(headers);return {schemaVersion:'pansphaira.workspace-context-projection/owner-snapshot-core/v1',projectorVersion:'PAN548_NATIVE_CONTEXT_V1',source:{taskOwner:'pan548.native-ui-task-projection/v2',eventOwner:'pan548.signed-native-context-outbox/v1',ledgerBindingDigest:uiTaskDigestV2(sessions.binding)},audience:request.audience,purpose:request.audience==='MAIN_CONTRACT'?'LOCAL_CONTEXT_CHECKPOINT':'LOCAL_PREVIEW_VALIDATION',principalDigest:a.digest,privacyEpoch:a.privacy.privacy_epoch,providerEpoch:a.privacy.provider_epoch,constraints:{...constraints},confirmedCursor:t.db.prepare('SELECT cursor FROM workspace_ui_context_cursors_v1 WHERE principal_digest=? AND audience=?').get(a.digest,request.audience)?.cursor??0,retention:{maxSnapshotBytes:65536,maxOwnerEvents:4096,storage:'LOCAL_OWNER_STORE',rawTextExport:false,audioExport:false},streamHead:stream.head,includedSequences:events.map(e=>e.seq),omittedSequences:[],events,tasks:projected};})();
  const snapshotBytes=canonicalJson(core);if(Buffer.byteLength(snapshotBytes)>65536)throw Error('CONTEXT_PROJECTION_SNAPSHOT_LIMIT_DENIED');
  return immutable({...core,schemaVersion:'pansphaira.workspace-context-projection/owner-snapshot/v1',snapshotBytes,snapshotDigest:uiTaskDigestV2(core),phase:'PREPARED',model:'NOT_RUN',executionAuthorityGranted:false,independentTargetEffectVerified:core.tasks.some(x=>x.independentTargetEffectVerified),checkpointRequestSent:false,journalContractImplemented:true});
 }
 // PAN700 REC-01 bounded HISTORY read on the SAME owner/auth/redaction path: state
 // derives ONLY from signed recorded envelopes <= the requested owner seq, never from
 // the current task row, wallclock or caller proof. Replay/seek grants no rights.
 function historyInsideOwnerTransaction(headers,value){
  const request=uiTaskClosedV2(value,['schemaVersion','audience','ownerSeq'],'CONTEXT_PROJECTION_REQUEST_DENIED');
  if(request.schemaVersion!=='pansphaira.workspace-context-projection/history-request/v1'||!['MAIN_CONTRACT','SPECIALIST_PREVIEW'].includes(request.audience))throw Error('CONTEXT_PROJECTION_REQUEST_DENIED');
  if(!Number.isSafeInteger(request.ownerSeq)||request.ownerSeq<1)throw Error('CONTEXT_PROJECTION_REQUEST_DENIED');
  const a=leading(headers);let stream;
  try{stream=completeRecordedStream(a);}
  catch(error){if(error.message==='CONTEXT_STREAM_GAP_OR_BYTES_DENIED')return immutable(historyResponse(request,a,null,{reason:'EVENT_GAP',requestedSeq:request.ownerSeq}));throw error;}
  if(request.ownerSeq>stream.head.seq)return immutable(historyResponse(request,a,stream.head,{reason:'SEQ_UNRECORDED',requestedSeq:request.ownerSeq}));
  const window=stream.events.filter(e=>e.seq<=request.ownerSeq);
  const redacted=e=>e.privacyEpoch!==a.privacy.privacy_epoch;
  if(window.every(redacted))return immutable(historyResponse(request,a,stream.head,{reason:'SOURCE_RETIRED',requestedSeq:request.ownerSeq},window));
  return immutable(historyResponse(request,a,stream.head,null,window));
 }
 function historyResponse(request,a,head,gap,window=[]){
  // Truthful time availability: ONLY the existing signed producer-clock sidecar (verified
  // by the journal accessor; tamper keeps failing closed) counts as evidence. Absent
  // legacy rows stay false/null; never inferred from epoch equality or polling wallclock.
  const steps=window.map(e=>{
   if(e.privacyEpoch!==a.privacy.privacy_epoch)return{seq:e.seq,taskId:e.taskId,kind:'PRIVACY_REDACTED',taskRevision:e.taskRevision,state:'UNAVAILABLE',privacyEpoch:e.privacyEpoch,eventDigest:uiTaskDigestV2(e),action:null,resultDigest:null,sourceTimeAvailable:false,sourceTimeMs:null};
   const clock=j.sourceClock(a,e);
   return{seq:e.seq,taskId:e.taskId,kind:e.kind,taskRevision:e.taskRevision,state:e.payload.state,privacyEpoch:e.privacyEpoch,eventDigest:uiTaskDigestV2(e),resultDigest:e.payload.resultDigest,sourceTimeAvailable:clock!==null,sourceTimeMs:clock?clock.sourceTimeMs:null,...(request.audience==='MAIN_CONTRACT'&&e.action!==undefined?{action:e.action}:{}),...(request.audience==='MAIN_CONTRACT'?{resourceRefs:e.payload.resourceRefs}:{})};
  });
  const latest=new Map();for(const e of window)if(e.privacyEpoch===a.privacy.privacy_epoch)latest.set(e.taskId,{taskId:e.taskId,state:e.payload.state,revision:e.taskRevision,derivedFromSeq:e.seq,derivedFromKind:e.kind});
  const core={schemaVersion:'pansphaira.workspace-context-projection/history-read/v1',projectorVersion:'PAN548_NATIVE_CONTEXT_V1',mode:'HISTORY',
   source:{taskOwner:'pan548.native-ui-task-projection/v2',eventOwner:'pan548.signed-native-context-outbox/v1',ledgerBindingDigest:uiTaskDigestV2(sessions.binding)},
   audience:request.audience,ownerSeq:request.ownerSeq,availability:gap?'UNAVAILABLE':'AVAILABLE',gap,
   principalDigest:a.digest,privacyEpoch:a.privacy.privacy_epoch,providerEpoch:a.privacy.provider_epoch,
   streamHead:head,includedSequences:steps.map(s=>s.seq),steps,taskStates:[...latest.values()],
   scope:{neutralStepListOnly:true,businessViewReconstruction:'UNAVAILABLE_NOT_RECORDED',legacyOrAbsentFacts:'UNAVAILABLE',retiredRefsRedacted:true},
   liveMayContinueSeparately:true,nativePauseDelivered:false,replayGrantsNoRights:true,readerEffects:'NONE',targetRedispatched:false,
   constraints:{...constraints},retention:{maxSnapshotBytes:65536,maxOwnerEvents:4096,storage:'LOCAL_OWNER_STORE',rawTextExport:false,audioExport:false},
   executionAuthorityGranted:false,model:'NOT_RUN'};
  const snapshotBytes=canonicalJson(core);if(Buffer.byteLength(snapshotBytes)>65536)throw Error('CONTEXT_PROJECTION_SNAPSHOT_LIMIT_DENIED');
  return {...core,snapshotBytes,snapshotDigest:uiTaskDigestV2(core),phase:'HISTORY_READ',journalContractImplemented:true};
 }
 // PAN701 REC-02 bounded per-action detail/provenance read on the SAME owner/auth/
 // redaction path: every fact derives ONLY from the ONE selected signed envelope and
 // its own attached records (action descriptor, payload digests, version-exact recorded
 // refs, step-attached proof, signed clock sidecar). Never the current task row, a
 // later bestProof, wallclock or caller claims. Facts this qualified path never
 // recorded (rationale, business before/after, approval, raw arguments) stay explicit
 // UNAVAILABLE_NOT_RECORDED placeholders; no new model call or summary generator.
 function stepDetailInsideOwnerTransaction(headers,value){
  const request=uiTaskClosedV2(value,['schemaVersion','audience','ownerSeq'],'CONTEXT_PROJECTION_REQUEST_DENIED');
  if(request.schemaVersion!=='pansphaira.workspace-context-projection/step-detail-request/v1'||!['MAIN_CONTRACT','SPECIALIST_PREVIEW'].includes(request.audience))throw Error('CONTEXT_PROJECTION_REQUEST_DENIED');
  if(!Number.isSafeInteger(request.ownerSeq)||request.ownerSeq<1)throw Error('CONTEXT_PROJECTION_REQUEST_DENIED');
  const a=leading(headers);let stream;
  try{stream=completeRecordedStream(a);}
  catch(error){if(error.message==='CONTEXT_STREAM_GAP_OR_BYTES_DENIED')return immutable(stepDetailResponse(request,a,null,{reason:'EVENT_GAP',requestedSeq:request.ownerSeq}));throw error;}
  if(request.ownerSeq>stream.head.seq)return immutable(stepDetailResponse(request,a,stream.head,{reason:'SEQ_UNRECORDED',requestedSeq:request.ownerSeq}));
  const e=stream.events.find(x=>x.seq===request.ownerSeq);
  if(e.privacyEpoch!==a.privacy.privacy_epoch)return immutable(stepDetailResponse(request,a,stream.head,{reason:'SOURCE_RETIRED',requestedSeq:request.ownerSeq}));
  const main=request.audience==='MAIN_CONTRACT',clock=j.sourceClock(a,e);
  const proofRef=e.payload.proofRef??null;
  const step={ownerSequence:e.seq,seq:e.seq,taskId:e.taskId,kind:e.kind,taskRevision:e.taskRevision,privacyEpoch:e.privacyEpoch,eventDigest:uiTaskDigestV2(e),state:e.payload.state,
   recorded:{state:e.payload.state,requestDigest:e.payload.requestDigest,argumentDigest:e.payload.argumentDigest,resultDigest:e.payload.resultDigest,capability:e.payload.capability,constraints:e.payload.constraints,...(main?{resourceRefs:e.payload.resourceRefs,expectedRevisions:e.action?.expectedRevisions??null}:{})},
   // Only the proof ATTACHED to this selected step is resolved (never a later bestProof).
   // Specialist audience keeps the minimized proven summary; raw evidence/request details
   // are MAIN_CONTRACT-only, mirroring snapshot minimization. Legacy missing proofRef/action
   // stay explicit null so canonicalJson never carries phantom undefined fields.
   proof:proofRef===null?{present:false,reason:'NO_PROOF_ATTACHED_TO_SELECTED_STEP'}:(()=>{const p=j.resolveProof(headers,e.taskId,proofRef),summary={present:true,proofRef:p.proofId,issuerKind:p.kind,argumentDigest:p.argumentDigest};
    return main?{...summary,originalRequestDigest:p.originalRequestDigest,issuedPrivacyEpoch:p.issuedPrivacyEpoch,evidence:p.evidence,independentOwnerRegisterVerified:true,executionAuthorityGranted:false}:summary;})(),
   sourceTimeAvailable:clock!==null,sourceTimeMs:clock?clock.sourceTimeMs:null,
   ...(main?{action:e.action??null}:{})};
  return immutable(stepDetailResponse(request,a,stream.head,null,step));
 }
 function stepDetailResponse(request,a,head,gap,step=null){
  const core={schemaVersion:'pansphaira.workspace-context-projection/step-detail/v1',projectorVersion:'PAN548_NATIVE_CONTEXT_V1',mode:'STEP_DETAIL',
   source:{taskOwner:'pan548.native-ui-task-projection/v2',eventOwner:'pan548.signed-native-context-outbox/v1',ledgerBindingDigest:uiTaskDigestV2(sessions.binding)},
   audience:request.audience,ownerSeq:request.ownerSeq,availability:gap?'UNAVAILABLE':'AVAILABLE',gap,
   principalDigest:a.digest,privacyEpoch:a.privacy.privacy_epoch,providerEpoch:a.privacy.provider_epoch,
   streamHead:head,step,
   requestSelection:{requestArguments:'NOT_EXPORTED',requestArgumentDigest:step===null?null:step.recorded.argumentDigest,catalogOrOfferApi:'NOT_AVAILABLE_ON_THIS_PATH',selectedEventResult:step===null?'UNAVAILABLE':'RECORDED'},
   decisionRationale:{availability:'UNAVAILABLE_NOT_RECORDED',reason:'NO_RATIONALE_WAS_RECORDED_FOR_THIS_STEP'},
   businessBeforeAfter:{availability:'UNAVAILABLE_NOT_RECORDED',reason:'NO_BUSINESS_PAYLOAD_WAS_RECORDED_FOR_THIS_STEP'},
   approval:{availability:'UNAVAILABLE_NOT_RECORDED',reason:'THIS_QUALIFIED_PATH_RECORDS_NO_APPROVAL_FACT'},
   derivedSummaries:{available:false,reason:'NO_DERIVED_SUMMARY_SOURCE'},
   sourceProof:{independentTargetEffectVerified:step!==null&&step.proof.present===true,digestIsNotPermission:true,digestIsNotIndependentSourceProof:true},
   scope:{selectedStepOnly:true,businessViewReconstruction:'UNAVAILABLE_NOT_RECORDED',legacyOrAbsentFacts:'UNAVAILABLE',retiredRefsRedacted:true},
   liveMayContinueSeparately:true,replayGrantsNoRights:true,readerEffects:'NONE',targetRedispatched:false,
   // This read neither observes nor claims pause: no fabricated availability flag,
   // pause remains a separate owner control readable via the existing authorized read.
   pauseOrResumeAuthorized:false,
   constraints:{...constraints},retention:{maxSnapshotBytes:65536,maxOwnerEvents:4096,storage:'LOCAL_OWNER_STORE',rawTextExport:false,audioExport:false},
   executionAuthorityGranted:false,model:'NOT_RUN'};
  const snapshotBytes=canonicalJson(core);if(Buffer.byteLength(snapshotBytes)>65536)throw Error('CONTEXT_PROJECTION_SNAPSHOT_LIMIT_DENIED');
  return {...core,snapshotBytes,snapshotDigest:uiTaskDigestV2(core),phase:'STEP_DETAIL',journalContractImplemented:true};
 }
 // Local producer read, not a wire event. The signed action's full task-based
 // stepId is canonical here; the legacy observation's shorter ID is unchanged.
 function previewProducerSource(headers){
  if(closed||t.closed())throw Error('CONTEXT_PROJECTION_OWNER_CLOSED');
  const a=t.principal(headers);
  // Unlike the writer's scope(), a miss must not initialize a reader's epoch.
  const privacy=t.db.prepare('SELECT privacy_epoch,revoked FROM workspace_ui_context_scope_v1 WHERE principal_digest=?').get(a.digest);
  if(privacy?.revoked)throw Error('CONTEXT_PRIVACY_REVOKED');
  const stream=completeRecordedStream(a);
  return {a,privacy,stream};
 }
 function previewProducerFact(headers,{a,privacy,stream},ownerSeq){
  const response=(reason,fact=null)=>immutable({schemaVersion:'pansphaira.workspace-context-projection/preview-producer/v1',availability:fact===null?'UNAVAILABLE':'AVAILABLE',reason,fact,executionAuthorityGranted:false});
  const e=stream.events[ownerSeq-1];
  if(!e)return response('SEQ_UNRECORDED');
  if(e.privacyEpoch!==privacy?.privacy_epoch)return response('SOURCE_RETIRED');
  const {action,payload}=e,capability='pan.workspace.view.preview/v1';
  if(e.kind!=='INTENT_COMPLETED'||payload.state!=='COMPLETED'||payload.capability!==capability||!e.taskId.startsWith('invocation:')||!payload.proofRef||!action?.runId)
   return response('PREVIEW_COMPLETION_NOT_OBSERVED');
  if(action.schemaVersion!=='pansphaira.workspace-context/event-action/v1'||action.taskId!==e.taskId||action.stepId!=='step:'+e.taskId||action.attempt!==1||action.capability!==capability||action.requestDigest!==payload.requestDigest||action.argumentDigest!==payload.argumentDigest)
   throw Error('CONTEXT_PREVIEW_PRODUCER_BINDING_DENIED');
  const proof=j.resolveProof(headers,e.taskId,payload.proofRef);
  if(proof.kind!=='PAN546_PREVIEW_VALIDATED'||proof.taskId!==e.taskId||proof.issuedPrivacyEpoch!==e.privacyEpoch||proof.originalRequestDigest!==payload.requestDigest||proof.argumentDigest!==payload.argumentDigest)
   throw Error('CONTEXT_PREVIEW_PRODUCER_BINDING_DENIED');
  const clock=j.sourceClock(a,e);
  if(clock===null)return response('SOURCE_CLOCK_UNAVAILABLE');
  const reader=createNativeWorkspaceUiTaskReadbackV2({sessions,root:t.root});
  try{
   const {task,independentRead,writerEpoch}=reader.read(headers,{schemaVersion:'pansphaira.workspace-ui-task/observe/v1',commandId:e.taskId,expectedWriterEpoch:t.bootEpoch});
   if(!independentRead||task.commandId!==e.taskId||task.state!==payload.state||task.revision!==e.taskRevision||task.requestDigest!==payload.requestDigest||task.result?.phase!=='PREVIEW_VALIDATED'||uiTaskDigestV2(task.result)!==payload.resultDigest)
    throw Error('CONTEXT_PREVIEW_PRODUCER_BINDING_DENIED');
   return response(null,{ownerSequence:e.seq,eventDigest:clock.eventDigest,privacyEpoch:e.privacyEpoch,taskId:e.taskId,runId:action.runId,stepId:action.stepId,attempt:action.attempt,taskRevision:e.taskRevision,
    capability,phase:'RESULT_CONFIRMED',resultPhase:task.result.phase,requestDigest:payload.requestDigest,argumentDigest:payload.argumentDigest,resultDigest:payload.resultDigest,
    proof:{proofRef:proof.proofId,issuerKind:proof.kind},readback:{independentRead,writerEpoch},appendClock:{sourceTimeMs:clock.sourceTimeMs,sourceBootEpoch:clock.sourceBootEpoch}});
  }finally{reader.close();}
 }
 function previewProducerInsideOwnerTransaction(headers,value){
  const request=uiTaskClosedV2(value,['schemaVersion','ownerSeq'],'CONTEXT_PROJECTION_REQUEST_DENIED');
  if(request.schemaVersion!=='pansphaira.workspace-context-projection/preview-producer-request/v1'||!Number.isSafeInteger(request.ownerSeq)||request.ownerSeq<1)throw Error('CONTEXT_PROJECTION_REQUEST_DENIED');
  return previewProducerFact(headers,previewProducerSource(headers),request.ownerSeq);
 }
 // One local owner transaction, not a cursor commit or cross-service export.
 function previewProducerBatchInsideOwnerTransaction(headers,value){
  const {schemaVersion,firstOwnerSeq,lastOwnerSeq,expectedPrivacyEpoch}=uiTaskClosedV2(value,['schemaVersion','firstOwnerSeq','lastOwnerSeq','expectedPrivacyEpoch'],'CONTEXT_PROJECTION_REQUEST_DENIED');
  if(schemaVersion!=='pansphaira.workspace-context-projection/preview-producer-batch-request/v1'||
   ![firstOwnerSeq,lastOwnerSeq,expectedPrivacyEpoch].every(n=>Number.isSafeInteger(n)&&n>0)||lastOwnerSeq<firstOwnerSeq||lastOwnerSeq-firstOwnerSeq>=16)
   throw Error('CONTEXT_PROJECTION_REQUEST_DENIED');
  const source=previewProducerSource(headers);
  const response=(reason,firstUnresolvedOwnerSeq,facts=[])=>immutable({schemaVersion:'pansphaira.workspace-context-projection/preview-producer-batch/v1',availability:reason===null?'AVAILABLE':'UNAVAILABLE',reason,firstUnresolvedOwnerSeq,facts,executionAuthorityGranted:false});
  if(!source.privacy)return response('SEQ_UNRECORDED',firstOwnerSeq);
  if(source.privacy.privacy_epoch!==expectedPrivacyEpoch)return response('SOURCE_RETIRED',firstOwnerSeq);
  if(lastOwnerSeq>source.stream.head.seq)return response('SEQ_UNRECORDED',Math.max(firstOwnerSeq,source.stream.head.seq+1));
  const facts=[];
  for(let seq=firstOwnerSeq;seq<=lastOwnerSeq;seq++){
   const result=previewProducerFact(headers,source,seq);
   if(result.availability==='AVAILABLE')facts.push(result.fact);
   else if(result.reason!=='PREVIEW_COMPLETION_NOT_OBSERVED')return response(result.reason,seq);
  }
  return response(null,null,facts);
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
   }else{if(row.state==='ACCEPTED')t.db.prepare("UPDATE workspace_ui_tasks_v2 SET state='OUTCOME_UNCONFIRMED',revision=revision+1 WHERE command_id=? AND state='ACCEPTED'").run(row.command_id);j.ownerOutcomeUnknown({principalDigest:a.digest,privacyEpoch:a.privacy.privacy_epoch,row:t.readRow(row.command_id)});unknown++;}
  }
  const repaired=j.repairInsideOwnerTransaction(headers);return {schemaVersion:'pansphaira.workspace-context-projection/reconcile-readback/v1',completed,unknown,retired,legacyUnknown,...repaired,targetRedispatched:false,model:'NOT_RUN',executionAuthorityGranted:false};
 }));}
 const checkpoints=createNativeUiContextCheckpointsV1({sessions,tasks,t,j,contextSelection,snapshot:snapshotInsideOwnerTransaction,leading});
 const owner=Object.freeze({snapshot(headers,value){return t.transaction(()=>snapshotInsideOwnerTransaction(headers,value));},
  history(headers,value){return t.transaction(()=>historyInsideOwnerTransaction(headers,value));},
  stepDetail(headers,value){return t.transaction(()=>stepDetailInsideOwnerTransaction(headers,value));},
  previewProducer(headers,value){return t.transaction(()=>previewProducerInsideOwnerTransaction(headers,value));},
  previewProducerBatch(headers,value){return t.transaction(()=>previewProducerBatchInsideOwnerTransaction(headers,value));},reconcile,
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

