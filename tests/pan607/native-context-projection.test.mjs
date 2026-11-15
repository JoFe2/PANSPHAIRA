import test from 'node:test';
import assert from 'node:assert/strict';
import {join} from 'node:path';
import {nativeViewFixture546} from '../pan546/native-fixture.mjs';
import {createNativeWorkspaceUiTaskProjectionV2, nativeWorkspaceUiTaskOwnerConnectionV2, uiTaskDigestV2} from '../../src/pan548/native-ui-task-projection-v2.mjs';
import {createNativeSurfaceProjectionReaderV2} from '../../src/pan546/native-surface-projection-v2.mjs';
import {createNativeWorkspaceSurfacesV2} from '../../src/pan597/native-surfaces-v2.mjs';
import {createNativeWorkspaceInvocationsV1} from '../../src/pan548/native-model-free-invocations-v1.mjs';
import {protectedWorkspaceSetupStatusV1} from '../../src/pan527/origin-session-adapter.mjs';
import {createNativeWorkspaceContextProjectionV1} from '../../src/pan548/native-context-projection-v1.mjs';
import {canonicalJson} from '../../dist/packages/contracts/src/canonical-json.js';
import {nativeWorkspaceInvocationExecutorConnectionV1} from '../../src/pan548/native-model-free-invocations-v1.mjs';
const registration={schemaVersion:'pansphaira.workspace-surface/register/v2',previousSurfaceId:null,previousProof:null,localGeneration:1,pinned:false,dirty:false};
import {fixture} from './native-fixture.mjs';
test('607 initial owner projection reads actual existing548 native task rows without raw text, authority or a fabricated Main request',async()=>{const x=await fixture();try{const p=x.snapshot();assert.equal(p.tasks.length,0);assert.equal(p.phase,'PREPARED');assert.equal(p.model,'NOT_RUN');assert.equal(p.executionAuthorityGranted,false);assert.equal(p.independentTargetEffectVerified,false);assert.equal(p.checkpointRequestSent,false);assert.equal(uiTaskDigestV2(JSON.parse(p.snapshotBytes)),p.snapshotDigest);assert.ok(Object.isFrozen(p));}finally{await x.close();}});
test('607 initial actual608 native preview task remains separate from rendering/profile save; owner snapshot retains native no-send and exact row result digest',async()=>{const x=await fixture();try{const result=x.preview(),p=x.snapshot(),row=p.tasks.find(r=>r.taskId===result.invocationId);assert.equal(row.state,'COMPLETED');assert.equal(row.resultPhase,'PREVIEW_VALIDATED');assert.equal(row.resultDigest,uiTaskDigestV2(result.result));assert.deepEqual(row.constraints,{localOnly:true,noSend:true,personalSave:false,sharedPublish:false});assert.equal(x.f.store.read(x.f.sessions.authenticate(x.tab.headers)).revision,0);assert.equal(p.snapshotBytes.includes('Mach die Karte kleiner'),false);assert.equal(p.snapshotBytes.includes('admissionToken'),false);assert.equal(row.independentTargetEffectVerified,true);assert.equal(row.proof.issuerKind,'PAN546_PREVIEW_VALIDATED');assert.equal(row.proof.clientReportedDomCommit,false);assert.equal(row.proof.personalViewPersistenceProduced,false);}finally{await x.close();}});
test('697 ACT-02 every signed journal event carries the owner-issued versioned action descriptor bound to actual run/task/step/attempt, operation/schema/digests/idempotency/causality; intent acceptance alone never claims rendered or model activity',async()=>{const x=await fixture();try{
 const result=x.preview(),set=result.observation,p=x.snapshot();
 const intent=p.events.find(e=>e.kind==='INTENT_ACCEPTED'&&e.taskId===result.invocationId),done=p.events.find(e=>e.kind==='INTENT_COMPLETED'&&e.taskId===result.invocationId);
 assert.ok(intent&&done,'actual signed journal events exist for the preview attempt');
 const action=intent.action;
 assert.ok(action,'owner snapshot must carry the owner-issued action descriptor on the signed journal event');
 assert.equal(action.schemaVersion,'pansphaira.workspace-context/event-action/v1');
 assert.equal(action.taskId,result.invocationId);
 assert.equal(action.runId,'operation:ui-invocation-'+result.invocationId.slice(11));
 assert.equal(action.stepId,'step:'+result.invocationId,'step identity is the full unambiguous owner task id');
 assert.equal(action.attempt,1,'the actual reserved attempt is attempt 1');
 assert.equal(action.capability,'pan.workspace.view.preview/v1');
 assert.equal(action.operationSchemaVersion,'pansphaira.workspace-module-view/preview/v1');
 assert.equal(action.argumentDigest,intent.payload.argumentDigest);
 assert.equal(action.requestDigest,intent.payload.requestDigest);
 assert.deepEqual(action.idempotency,{operationId:action.runId,taskRequestDigest:intent.payload.requestDigest},'idempotency binds the real budget operation and row request digest');
 assert.deepEqual(action.causal,set.causal,'causal binding matches the actual admitted candidate set');
 assert.deepEqual(action.expectedRevisions,set.expectedRevisions,'expected revisions come from the actual admitted candidate');
 assert.equal(action.model,'NOT_RUN');assert.equal(action.executionAuthorityGranted,false);
 assert.ok(Object.isFrozen(action));
 assert.deepEqual(done.action,action,'the same attempt descriptor is stable across events of the task');
 assert.ok(p.events.filter(e=>e.taskId===result.invocationId).every(e=>e.action!==undefined));
 const small=x.snapshot('SPECIALIST_PREVIEW');
 assert.equal(small.events.find(e=>e.taskId===result.invocationId).action,undefined,'specialist audience stays minimized');
 // descriptor exposes no raw args/prompt and no independent effect claim beyond accepted intent
 assert.equal(JSON.stringify(p.events).includes('Mach die Karte kleiner'),false);
 assert.equal(intent.payload.state,'ACCEPTED');
 // checkpoint family has no budget run/causal set: the descriptor states those
 // facts as explicitly unavailable nulls instead of fabricating them.
 x.projection.correct(x.tab.headers,{schemaVersion:'pansphaira.workspace-context-projection/resource-correction/v1',context:x.f.verification(x.tab),kind:'OBJECT',objectId:'AP-PAN516-MATCHED-01',valueRef:'OBJ:CORRECTED-ONE'});
 const after=x.snapshot(),cp=after.events.find(e=>e.taskId.startsWith('checkpoint:'));
 assert.ok(cp&&cp.action,'checkpoint events carry the same versioned descriptor shape');
 assert.equal(cp.action.runId,null,'no native budget run exists for a checkpoint task');
 assert.equal(cp.action.causal,null);assert.equal(cp.action.expectedRevisions,null);assert.equal(cp.action.operationSchemaVersion,null,'checkpoint arguments carry no operation schema; never fabricated');
 assert.equal(cp.action.taskId,cp.taskId);assert.equal(cp.action.model,'NOT_RUN');
 // origin-epoch redaction applies to the descriptor itself: after revoke/switch no
 // retired run binding, digest or causal ref survives in the live projection bytes.
 const runId=intent.action.runId,argDigest=intent.payload.argumentDigest;
 x.projection.revoke(x.tab.headers,{schemaVersion:'pansphaira.workspace-context-projection/privacy-revoke/v1'});
 x.projection.providerSwitch(x.tab.headers,{schemaVersion:'pansphaira.workspace-context-projection/contract-session-switch/v1',context:x.f.verification(x.tab)});
 const retiredView=x.snapshot();
 assert.ok(retiredView.events.some(e=>e.taskId===result.invocationId&&e.kind==='PRIVACY_REDACTED'&&e.action===undefined),'retired-epoch events expose no action descriptor');
 assert.equal(retiredView.snapshotBytes.includes(runId),false,'retired run binding must not reappear');
 assert.equal(retiredView.snapshotBytes.includes(argDigest),false,'retired argument digest must not reappear');
}finally{await x.close();}});

test('607 initial native owner close/reopen retains same canonical task snapshot, not a process-restart or completion-event acceptance claim',async()=>{const x=await fixture();try{x.preview();const before=x.snapshot();x.reopenOwner();const after=x.snapshot();assert.equal(after.snapshotDigest,before.snapshotDigest);assert.equal(after.snapshotBytes,before.snapshotBytes);assert.equal(after.tasks.length,1);assert.equal(after.tasks[0].state,'COMPLETED');assert.equal(after.journalContractImplemented,true);assert.equal(after.independentTargetEffectVerified,true);assert.equal(after.events.filter(e=>e.kind==='INTENT_COMPLETED').length,1);}finally{await x.close();}});
test('607 initial specialist audience is its own minimized native task projection, not the complete Main task bytes',async()=>{const x=await fixture();try{x.preview();const main=x.snapshot(),small=x.snapshot('SPECIALIST_PREVIEW');assert.equal(small.audience,'SPECIALIST_PREVIEW');assert.notEqual(small.snapshotDigest,main.snapshotDigest);assert.equal(small.tasks.length,1);assert.equal(Object.hasOwn(small.tasks[0],'resourceRefs'),false);assert.equal(small.tasks[0].constraints.noSend,true);assert.equal(small.snapshotBytes.includes('AP-PAN516-MATCHED-01'),false);assert.equal(small.executionAuthorityGranted,false);}finally{await x.close();}});
test('607 initial owner snapshot denies caller proof/authority/audience/data extras, copied owner and accessors before reading; foreign principal cannot read own task',async()=>{const x=await fixture();try{x.preview();const req={schemaVersion:'pansphaira.workspace-context-projection/snapshot-request/v1',audience:'MAIN_CONTRACT'};for(const bad of [{...req,noSend:false},{...req,proof:'EXECUTOR'},{...req,tasks:[]},{...req,audience:'FOREIGN_MODEL'}])assert.throws(()=>x.projection.snapshot(x.tab.headers,bad),/CONTEXT_PROJECTION_/);let reads=0;const bad={schemaVersion:req.schemaVersion};Object.defineProperty(bad,'audience',{enumerable:true,get(){reads++;return req.audience;}});assert.throws(()=>x.projection.snapshot(x.tab.headers,bad),/CONTEXT_PROJECTION_/);assert.equal(reads,0);assert.throws(()=>createNativeWorkspaceContextProjectionV1({sessions:x.f.sessions,tasks:{...x.tasks}}),/UI_TASK_OWNER_DENIED/);const foreign=x.f.tab(x.f.issue('synthetic:other-reader','reader'));assert.equal(x.projection.snapshot(foreign.headers,req).tasks.length,0);assert.equal(x.snapshot().tasks.length,1);}finally{await x.close();}});

test('607 actual existing597 document target completion/current548 display task is projected, never omitted or promoted from acceptance to render',async()=>{


 const x=await fixture();try{
  const target=x.f.tab(x.tab.headers);target.surface=x.surfaces.register(target.headers,registration);target.headers={...target.headers,'x-pan597-surface':target.surface.surfaceId,'x-pan597-proof':target.surface.surfaceProof};
  const source=x.surfaces.register(x.tab.headers,{...registration,previousSurfaceId:x.tab.headers['x-pan597-surface'],previousProof:x.tab.headers['x-pan597-proof']});x.tab.headers={...x.tab.headers,'x-pan597-surface':source.surfaceId,'x-pan597-proof':source.surfaceProof};
  const command={schemaVersion:'pansphaira.workspace-surface/display-command/v2',commandId:'display:'+'d'.repeat(32),sourceSurfaceId:source.surfaceId,sourceConnectionEpoch:source.connectionEpoch,sourceContextEpoch:source.contextEpoch,sourceRevisionDigest:source.revisionDigest,targetSurfaceId:target.surface.surfaceId,targetConnectionEpoch:target.surface.connectionEpoch,targetContextEpoch:target.surface.contextEpoch,targetRevisionDigest:target.surface.revisionDigest,targetLocalGeneration:target.surface.localGeneration,routeId:'pan.erv.document.v2',objectId:x.tab.context.primaryObject.objectId,expectedRevision:x.tab.context.primaryObject.revision,expiresAtMs:Math.min(x.tab.context.lease.expiresAtMs,target.context.lease.expiresAtMs)};
  x.surfaces.accept(x.tab.headers,command);const accepted=x.snapshot();assert.equal(accepted.tasks.length,1);assert.equal(accepted.tasks[0].state,'ACCEPTED');assert.equal(accepted.tasks[0].resultPhase,null);assert.equal(accepted.tasks[0].constraints.noSend,true);
  x.surfaces.events(target.headers,{schemaVersion:'pansphaira.workspace-surface/events/v2',cursor:0});const loaded=x.surfaces.load(target.headers,{schemaVersion:'pansphaira.workspace-surface/load/v2',commandId:command.commandId});const permit=x.surfaces.beforeCommit(target.headers,{schemaVersion:'pansphaira.workspace-surface/before-dom/v2',commandId:command.commandId,readToken:loaded.readToken,projectionDigest:loaded.projection.projectionDigest,localGeneration:1});const receipt=x.surfaces.acknowledge(target.headers,{schemaVersion:'pansphaira.workspace-surface/render-ack/v2',commandId:command.commandId,commitToken:permit.commitToken,projectionDigest:loaded.projection.projectionDigest,localGeneration:1,contextEpoch:permit.surface.contextEpoch,domCommitted:true});
  const completed=x.snapshot();assert.equal(completed.tasks.length,1);assert.equal(completed.tasks[0].state,'COMPLETED');assert.equal(completed.tasks[0].resultPhase,'DOCUMENT_RENDERED');assert.equal(completed.tasks[0].resultDigest,uiTaskDigestV2(receipt.render));assert.equal(completed.tasks[0].resourceRefs.objectRef.objectId,command.objectId);assert.equal(completed.tasks[0].constraints.noSend,true);assert.equal(x.f.store.read(x.f.sessions.authenticate(x.tab.headers)).revision,0);
 }finally{await x.close();}
});

test('607 signed native548 completion/outbox repair is idempotent, retains original sequence and never repeats native target effects',async()=>{const x=await fixture();try{
 const effect=x.preview(),before=x.snapshot(),entry=before.events.find(e=>e.kind==='INTENT_COMPLETED');assert.ok(entry);assert.deepEqual(before.includedSequences,before.events.map(e=>e.seq));assert.deepEqual(before.omittedSequences,[]);assert.equal(before.constraints.noSend,true);
 const {db}=nativeWorkspaceUiTaskOwnerConnectionV2(x.tasks,x.f.sessions.binding);db.prepare('DELETE FROM workspace_ui_context_projection_v1 WHERE seq=?').run(entry.seq);
 const one=x.projection.reconcile(x.tab.headers,{schemaVersion:'pansphaira.workspace-context-projection/reconcile/v1'}),two=x.projection.reconcile(x.tab.headers,{schemaVersion:'pansphaira.workspace-context-projection/reconcile/v1'});assert.equal(one.repaired,1);assert.equal(two.repaired,0);assert.equal(one.targetRedispatched,false);assert.equal(x.snapshot().snapshotBytes,before.snapshotBytes);assert.equal(x.snapshot().events.filter(e=>e.kind==='INTENT_COMPLETED').length,1);assert.equal(x.f.store.read(x.f.sessions.authenticate(x.tab.headers)).revision,0);assert.equal(effect.result.phase,'PREVIEW_VALIDATED');
 }finally{await x.close();}});
test('607 target proofs resolve only independently signed original task/args/scope; forged executor label and foreign existing proof denied',async()=>{const x=await fixture();try{
 const a=x.preview(),b=x.preview(),snapshot=x.snapshot(),pa=snapshot.tasks.find(t=>t.taskId===a.invocationId).proof,pb=snapshot.tasks.find(t=>t.taskId===b.invocationId).proof;
 const request={schemaVersion:'pansphaira.workspace-context-projection/resolve-proof/v1',taskId:a.invocationId,proofRef:pa.proofRef},proof=x.projection.resolveProof(x.tab.headers,request);assert.equal(proof.independentOwnerRegisterVerified,true);assert.equal(proof.executionAuthorityGranted,false);assert.equal(proof.argumentDigest,pa.argumentDigest);assert.equal(proof.evidence.personalViewPersistenceProduced,false);
 assert.throws(()=>x.projection.resolveProof(x.tab.headers,{...request,proofRef:pb.proofRef}),/CONTEXT_PROOF_TASK_BYTES_CONFLICT/);assert.throws(()=>x.projection.resolveProof(x.tab.headers,{...request,executor:'EXECUTOR'}),/CONTEXT_PROOF_INPUT_DENIED/);assert.throws(()=>x.projection.resolveProof(x.tab.headers,{...request,proofRef:'context-proof:'+'f'.repeat(64)}),/CONTEXT_PROOF_SCOPE_DENIED/);
 }finally{await x.close();}});
test('607 jointly altered stored caller original bytes/hash and removal of actual native no-send cannot forge signed owner intent/proof',async()=>{const x=await fixture();try{
 const done=x.preview(),{db}=nativeWorkspaceUiTaskOwnerConnectionV2(x.tasks,x.f.sessions.binding),row=db.prepare('SELECT * FROM workspace_ui_tasks_v2 WHERE command_id=?').get(done.invocationId),original=JSON.parse(row.original_command);original.candidate.objectRef.instanceId='invoice-value';db.prepare('UPDATE workspace_ui_tasks_v2 SET original_command=?,request_digest=? WHERE command_id=?').run(canonicalJson(original),uiTaskDigestV2(original),done.invocationId);assert.throws(()=>x.snapshot(),/CONTEXT_OWNER_INTENT_BYTES_CONFLICT/);
 original.candidate.constraints.noSend=false;db.prepare('UPDATE workspace_ui_tasks_v2 SET original_command=?,request_digest=? WHERE command_id=?').run(canonicalJson(original),uiTaskDigestV2(original),done.invocationId);assert.throws(()=>x.snapshot(),/CONTEXT_JOURNAL_NO_SEND_DENIED/);
 db.prepare('UPDATE workspace_ui_tasks_v2 SET original_command=?,request_digest=? WHERE command_id=?').run(row.original_command,row.request_digest,done.invocationId);const out=db.prepare('SELECT * FROM workspace_ui_context_outbox_v1 WHERE seq=1').get();db.prepare('UPDATE workspace_ui_context_outbox_v1 SET bytes=? WHERE seq=1').run(out.bytes.replace('"noSend":true','"noSend":false'));assert.throws(()=>x.snapshot(),/CONTEXT_OWNER_SIGNATURE_DENIED/);db.prepare('UPDATE workspace_ui_context_outbox_v1 SET bytes=? WHERE seq=1').run(out.bytes);assert.equal(x.snapshot().constraints.noSend,true);
 }finally{await x.close();}});

test('607 independently signed completion/result bytes reject caller result revision/phase/hash changes without promoting proof to save/render',async()=>{const x=await fixture();try{
 const done=x.preview(),{db}=nativeWorkspaceUiTaskOwnerConnectionV2(x.tasks,x.f.sessions.binding),row=db.prepare('SELECT * FROM workspace_ui_tasks_v2 WHERE command_id=?').get(done.invocationId),result=JSON.parse(row.result_json);result.phase='PERSONAL_PROFILE_SAVED';result.personalProfileSaved=true;db.prepare('UPDATE workspace_ui_tasks_v2 SET result_json=? WHERE command_id=?').run(canonicalJson(result),done.invocationId);assert.throws(()=>x.snapshot(),/CONTEXT_OWNER_RESULT_BYTES_CONFLICT/);assert.throws(()=>x.projection.resolveProof(x.tab.headers,{schemaVersion:'pansphaira.workspace-context-projection/resolve-proof/v1',taskId:done.invocationId,proofRef:db.prepare('SELECT proof_id FROM workspace_ui_context_proofs_v1 WHERE task_id=?').get(done.invocationId).proof_id}),/CONTEXT_OWNER_RESULT_BYTES_CONFLICT/);db.prepare('UPDATE workspace_ui_tasks_v2 SET result_json=? WHERE command_id=?').run(row.result_json,done.invocationId);assert.equal(x.snapshot().tasks[0].proof.targetPhase,'PREVIEW_VALIDATED');assert.equal(x.f.store.read(x.f.sessions.authenticate(x.tab.headers)).revision,0);
 }finally{await x.close();}});

function genuineAcceptedWithoutTarget(x){const r=x.invocations.resolve(x.tab.headers,{schemaVersion:'pansphaira.workspace-invocation/resolve/v1',input:{schemaVersion:'pansphaira.workspace-invocation/final-text/v1',inputKind:'TYPED_FINAL_TEXT',final:true,text:'Mach die Karte kleiner'},context:x.f.verification(x.tab),selectedCardId:'native-review',targetSurfaceId:null}),s=r.set,m=s.candidates.find(c=>c.candidateId===s.selectedCandidateId),a=x.invocations.admit(x.tab.headers,{schemaVersion:'pansphaira.workspace-invocation/admit/v1',setId:s.setId,requestDigest:s.requestDigest,setDigest:s.setDigest,candidateId:m.candidateId,argumentDigest:m.argumentDigest,policyRef:s.policyRef}),connection=nativeWorkspaceInvocationExecutorConnectionV1(x.invocations);return connection.begin(x.tab.headers,{schemaVersion:'pansphaira.workspace-invocation/execute/v1',invocationId:a.invocationId,admissionToken:a.admissionToken,requestDigest:a.requestDigest,setDigest:a.setDigest,candidateId:a.candidateId,argumentDigest:a.argumentDigest,policyRef:a.policyRef});}
test('607 specific B1: genuine retired accepted invocation cannot recreate old resources in live stream/snapshot/payload/prompt after revoke/switch/reconcile',async()=>{const x=await fixture();try{
 const prior=x.preview(),oldProof=x.snapshot().tasks.find(t=>t.taskId===prior.invocationId).proof;const accepted=genuineAcceptedWithoutTarget(x),objectId=x.tab.context.primaryObject.objectId;x.projection.revoke(x.tab.headers,{schemaVersion:'pansphaira.workspace-context-projection/privacy-revoke/v1'});x.projection.providerSwitch(x.tab.headers,{schemaVersion:'pansphaira.workspace-context-projection/contract-session-switch/v1',context:x.f.verification(x.tab)});assert.equal(x.snapshot().snapshotBytes.includes(objectId),false);assert.throws(()=>x.projection.resolveProof(x.tab.headers,{schemaVersion:'pansphaira.workspace-context-projection/resolve-proof/v1',taskId:prior.invocationId,proofRef:oldProof.proofRef}),/CONTEXT_PROOF_RETIRED_OR_UNREGISTERED/);assert.equal(x.projection.audit(x.tab.headers,{schemaVersion:'pansphaira.workspace-context-projection/audit/v1',taskId:prior.invocationId}).historicalAudit,true);const reconciled=x.projection.reconcile(x.tab.headers,{schemaVersion:'pansphaira.workspace-context-projection/reconcile/v1'}),snapshot=x.snapshot();assert.equal(snapshot.snapshotBytes.includes(objectId),false,'Retired original resources must not reappear under current event epoch');assert.equal(reconciled.targetRedispatched,false);assert.equal(snapshot.tasks.find(t=>t.taskId===accepted.invocationId).privacyRedacted,true);
 const {db}=nativeWorkspaceUiTaskOwnerConnectionV2(x.tasks,x.f.sessions.binding),origin=db.prepare("SELECT * FROM workspace_ui_context_outbox_v1 WHERE task_id=? AND kind='INTENT_ACCEPTED'").get(accepted.invocationId);db.prepare('UPDATE workspace_ui_context_outbox_v1 SET privacy_epoch=? WHERE task_id=?').run(snapshot.privacyEpoch,accepted.invocationId);assert.throws(()=>x.snapshot(),/CONTEXT_STREAM_GAP_OR_BYTES_DENIED/);db.prepare('UPDATE workspace_ui_context_outbox_v1 SET privacy_epoch=? WHERE task_id=?').run(origin.privacy_epoch,accepted.invocationId);
 const p=x.projection.prepare(x.tab.headers,{schemaVersion:'pansphaira.workspace-context-projection/prepare/v1',audience:'MAIN_CONTRACT',context:x.f.verification(x.tab),boundary:'TURN',previousRequestId:null,cursor:0});assert.equal(p.snapshotBytes.includes(objectId),false);assert.equal(p.payloadBytes.includes(objectId),false);assert.equal(p.promptBytes.includes(objectId),false);assert.equal(p.model,'NOT_RUN');
 }finally{await x.close();}});
const historyRequest=(ownerSeq,audience='MAIN_CONTRACT')=>({schemaVersion:'pansphaira.workspace-context-projection/history-request/v1',audience,ownerSeq});
function effectCounters(x){const {db}=nativeWorkspaceUiTaskOwnerConnectionV2(x.tasks,x.f.sessions.binding);
 return {orders:JSON.stringify(db.prepare('SELECT command_id,state,revision,result_json FROM workspace_ui_tasks_v2 ORDER BY command_id').all()),
  outbox:JSON.stringify(db.prepare('SELECT seq,event_key,kind,bytes,signature FROM workspace_ui_context_outbox_v1 ORDER BY seq').all()),
  proofs:db.prepare('SELECT COUNT(*) c FROM workspace_ui_context_proofs_v1').get().c,
  storeRevision:x.f.store.read(x.f.sessions.authenticate(x.tab.headers)).revision,
  snapshotDigest:x.snapshot().snapshotDigest};}
test('700 REC-01 seek to recorded INTENT_ACCEPTED owner seq returns the recorded earlier ACCEPTED state, not today COMPLETED row, with neutral step-list scope and retained source-bound action',async()=>{const x=await fixture();try{
 const result=x.preview(),p=x.snapshot();
 const accepted=p.events.find(e=>e.kind==='INTENT_ACCEPTED'&&e.taskId===result.invocationId);
 assert.ok(accepted,'actual recorded INTENT_ACCEPTED owner seq exists before completion');
 assert.equal(typeof x.projection.history,'function','REC-01 owner-authorized versioned history read not yet delivered');
 const before=effectCounters(x);
 const h=x.projection.history(x.tab.headers,historyRequest(accepted.seq));
 assert.equal(h.mode,'HISTORY');assert.equal(h.ownerSeq,accepted.seq);assert.equal(h.availability,'AVAILABLE');assert.equal(h.gap,null);
 const step=h.steps.find(s=>s.seq===accepted.seq);
 assert.equal(step.taskId,result.invocationId);assert.equal(step.kind,'INTENT_ACCEPTED');assert.equal(step.state,'ACCEPTED','recorded earlier ACCEPTED state, never today COMPLETED row');
 assert.equal(step.resultDigest,null,'no completion result existed at the recorded accepted seq');
 const taskState=h.taskStates.find(s=>s.taskId===result.invocationId);
 assert.equal(taskState.state,'ACCEPTED');assert.equal(taskState.derivedFromSeq,accepted.seq);
 assert.equal(step.action.runId,'operation:ui-invocation-'+result.invocationId.slice(11),'source-bound run/step/attempt/causality retained from the recorded event, never inferred from current task state');
 assert.equal(step.action.stepId,'step:'+result.invocationId);assert.equal(step.action.attempt,1);
 assert.deepEqual(step.action.causal,result.observation.causal);
 assert.equal(h.scope.businessViewReconstruction,'UNAVAILABLE_NOT_RECORDED','no old view/object bytes were ever recorded; no fake full historical reconstruction');
 assert.equal(h.liveMayContinueSeparately,true);assert.equal(h.nativePauseDelivered,false);
 assert.equal(h.executionAuthorityGranted,false);assert.equal(h.model,'NOT_RUN');assert.equal(h.readerEffects,'NONE');assert.equal(h.targetRedispatched,false);
 assert.deepEqual(h.constraints,{localOnly:true,noSend:true,personalSave:false,sharedPublish:false});
 assert.ok(Object.isFrozen(h));
 assert.deepEqual(effectCounters(x),before,'history read causes zero task/outbox/proof/store/snapshot effects');
 assert.equal(canonicalJson(h.steps).includes('Mach die Karte kleiner'),false,'no raw prompt text in historical step bytes');
}finally{await x.close();}});
test('700 REC-01 HISTORY stays persistently distinct from LIVE: live reads perform a fresh current authorized snapshot and never reuse the historical object; reader input contract denies caller extras and unsupported versions',async()=>{const x=await fixture();try{
 const result=x.preview(),p=x.snapshot(),acceptedSeq=p.events.find(e=>e.kind==='INTENT_ACCEPTED'&&e.taskId===result.invocationId).seq;
 const h=x.projection.history(x.tab.headers,historyRequest(acceptedSeq));
 const live=x.snapshot();
 assert.equal(live.schemaVersion,'pansphaira.workspace-context-projection/owner-snapshot/v1','live re-reads the existing fresh authorized owner snapshot');
 assert.equal(live.mode,undefined,'live snapshot is not the historical response object');
 assert.equal(h.mode,'HISTORY');assert.equal(live.tasks.find(t=>t.taskId===result.invocationId).state,'COMPLETED','live shows today state, history keeps recorded ACCEPTED');
 assert.equal(h.steps.find(s=>s.seq===acceptedSeq).state,'ACCEPTED','the historical object was not mutated by the fresh live read');
 assert.equal(live.streamHead.seq,3);assert.equal(h.streamHead.seq,3,'history honestly reports the current signed stream head');
 for(const bad of [{...historyRequest(1),proof:'EXECUTOR'},{...historyRequest(1),audience:'FOREIGN_MODEL'},{...historyRequest(1),ownerSeq:1.5},{...historyRequest(1),grant:true},historyRequest(0)])
  assert.throws(()=>x.projection.history(x.tab.headers,bad),/CONTEXT_PROJECTION_REQUEST_DENIED/,'closed request contract: no caller proof/actor/grant extras, no non-positive or fractional owner seq');
 assert.throws(()=>x.projection.history(x.tab.headers,{schemaVersion:'pansphaira.workspace-context-projection/history-request/v2',audience:'MAIN_CONTRACT',ownerSeq:1}),/CONTEXT_PROJECTION_REQUEST_DENIED/,'unsupported version denied honestly');
 const small=x.projection.history(x.tab.headers,historyRequest(acceptedSeq,'SPECIALIST_PREVIEW'));
 assert.equal(small.steps.find(s=>s.seq===acceptedSeq).action,undefined,'specialist history audience stays minimized like the live snapshot');
 assert.equal(Object.hasOwn(small.steps.find(s=>s.seq===acceptedSeq),'resourceRefs'),false);
}finally{await x.close();}});
test('700 REC-01 future/foreign/unrecorded seq and missing facts stay honest UNAVAILABLE gaps without renumbering or fake backfill; 100 rapid forward/back seeks cause zero effects',async()=>{const x=await fixture();try{
 const result=x.preview(),p=x.snapshot(),head=p.streamHead,acceptedSeq=p.events.find(e=>e.kind==='INTENT_ACCEPTED'&&e.taskId===result.invocationId).seq;
 const before=effectCounters(x);
 const future=x.projection.history(x.tab.headers,historyRequest(head.seq+5));
 assert.equal(future.availability,'UNAVAILABLE');assert.equal(future.gap.reason,'SEQ_UNRECORDED');assert.deepEqual(future.steps,[]);assert.equal(future.streamHead.seq,head.seq,'no renumbering: current signed head reported honestly');
 const foreign=x.f.tab(x.f.issue('synthetic:other-history','reader'));
 const foreignRead=x.projection.history(foreign.headers,historyRequest(acceptedSeq));
 assert.equal(foreignRead.availability,'UNAVAILABLE');assert.equal(foreignRead.gap.reason,'SEQ_UNRECORDED','foreign principal has no recorded events at that seq; nothing leaks');
 for(let i=0;i<100;i++){
  const seq=1+(i%head.seq);
  const h=x.projection.history(x.tab.headers,historyRequest(seq));
  assert.equal(h.mode,'HISTORY');
  assert.ok(h.steps.every(s=>s.seq<=seq),'never exposes events beyond the requested owner seq');
 }
 assert.deepEqual(effectCounters(x),before,'100 rapid forward/back seeks produce zero FACH/TOOL/PROVIDER/APPROVE/RESUME/DISPATCH effects and no new producer facts');
}finally{await x.close();}});
test('700 REC-01 revocation/switch cannot restore retired historical content or grants; event gap and actual proof mismatch are honest failures with no cached-bytes fallback',async()=>{const x=await fixture();try{
 const result=x.preview(),p=x.snapshot(),acceptedSeq=p.events.find(e=>e.kind==='INTENT_ACCEPTED'&&e.taskId===result.invocationId).seq,objectId=x.tab.context.primaryObject.objectId;
 x.projection.revoke(x.tab.headers,{schemaVersion:'pansphaira.workspace-context-projection/privacy-revoke/v1'});
 assert.throws(()=>x.projection.history(x.tab.headers,historyRequest(acceptedSeq)),/CONTEXT_PRIVACY_REVOKED/,'revoked reads get no historical content restore');
 x.projection.providerSwitch(x.tab.headers,{schemaVersion:'pansphaira.workspace-context-projection/contract-session-switch/v1',context:x.f.verification(x.tab)});
 const retired=x.projection.history(x.tab.headers,historyRequest(acceptedSeq));
 assert.equal(retired.availability,'UNAVAILABLE');assert.equal(retired.gap.reason,'SOURCE_RETIRED','providerSwitch cannot revive retired sources');
 assert.equal(retired.steps.every(s=>s.state==='UNAVAILABLE'&&s.action===null),true);
 assert.equal(canonicalJson(retired).includes(objectId),false,'retired resource refs never reappear');
 assert.equal(canonicalJson(retired).includes('operation:ui-invocation-'+result.invocationId.slice(11)),false,'retired run binding never restored from history');
 assert.equal(canonicalJson(retired).includes(p.events.find(e=>e.seq===acceptedSeq).payload.argumentDigest),false,'retired argument digest never restored');
 const before=effectCounters(x);
 // genuine event gap: remove one recorded outbox envelope inside the requested window
 const {db}=nativeWorkspaceUiTaskOwnerConnectionV2(x.tasks,x.f.sessions.binding),gapRow=db.prepare('SELECT * FROM workspace_ui_context_outbox_v1 WHERE seq=2').get();
 db.prepare('DELETE FROM workspace_ui_context_outbox_v1 WHERE seq=2').run();
 const gapped=x.projection.history(x.tab.headers,historyRequest(3));
 assert.equal(gapped.availability,'UNAVAILABLE');assert.equal(gapped.gap.reason,'EVENT_GAP','gap is reported, never silently skipped or backfilled');
 db.prepare('INSERT INTO workspace_ui_context_outbox_v1 VALUES(?,?,?,?,?,?,?,?,?)').run(gapRow.principal_digest,gapRow.seq,gapRow.event_key,gapRow.task_id,gapRow.task_revision,gapRow.kind,gapRow.privacy_epoch,gapRow.bytes,gapRow.signature);
 // actual proof mismatch: altered signed envelope bytes must fail, not fall back to cached bytes
 const tampered=db.prepare('SELECT * FROM workspace_ui_context_outbox_v1 WHERE seq=1').get();
 db.prepare('UPDATE workspace_ui_context_outbox_v1 SET bytes=? WHERE seq=1').run(tampered.bytes.replace('"noSend":true','"noSend":false'));
 assert.throws(()=>x.projection.history(x.tab.headers,historyRequest(1)),/CONTEXT_OWNER_SIGNATURE_DENIED/,'proof mismatch denies the read; no cached-bytes fallback');
 db.prepare('UPDATE workspace_ui_context_outbox_v1 SET bytes=? WHERE seq=1').run(tampered.bytes);
 assert.equal(effectCounters(x).outbox,before.outbox,'gap/tamper probes left the restored signed outbox byte-identical: no reader-side repair mutation');
 const live=x.projection.history(x.tab.headers,historyRequest(3));
 assert.equal(live.availability,'UNAVAILABLE');assert.equal(live.gap.reason,'SOURCE_RETIRED','after honest failures the restored genuine record re-reads identically retired: deterministic, no cached-bytes fallback');
}finally{await x.close();}});
test('607 specific B2: authentic pre-journal legacy accepted row stays UNKNOWN while unrelated signed projection repair proceeds without redispatch or fake authority',async()=>{const x=await fixture();try{
 const valid=x.preview(),legacy=genuineAcceptedWithoutTarget(x),{db}=nativeWorkspaceUiTaskOwnerConnectionV2(x.tasks,x.f.sessions.binding);db.prepare('DELETE FROM workspace_ui_context_projection_v1 WHERE seq IN(SELECT seq FROM workspace_ui_context_outbox_v1 WHERE task_id=?)').run(legacy.invocationId);db.prepare('DELETE FROM workspace_ui_context_outbox_v1 WHERE task_id=?').run(legacy.invocationId);const completion=db.prepare("SELECT seq FROM workspace_ui_context_outbox_v1 WHERE task_id=? AND kind='INTENT_COMPLETED'").get(valid.invocationId);db.prepare('DELETE FROM workspace_ui_context_projection_v1 WHERE seq=?').run(completion.seq);assert.equal(x.snapshot().tasks.find(t=>t.taskId===legacy.invocationId).legacyUnregisteredIntent,true);
 const result=x.projection.reconcile(x.tab.headers,{schemaVersion:'pansphaira.workspace-context-projection/reconcile/v1'});assert.equal(result.repaired,1);assert.equal(result.targetRedispatched,false);const row=x.snapshot().tasks.find(t=>t.taskId===legacy.invocationId);assert.equal(row.state,'OUTCOME_UNCONFIRMED');assert.equal(row.independentTargetEffectVerified,false);assert.equal(x.snapshot().events.filter(e=>e.taskId===legacy.invocationId).length,0);assert.equal(x.snapshot().constraints.noSend,true);assert.equal(x.f.store.read(x.f.sessions.authenticate(x.tab.headers)).revision,0);
 }finally{await x.close();}});
