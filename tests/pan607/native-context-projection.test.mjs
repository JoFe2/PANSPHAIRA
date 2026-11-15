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

test('697 ACT-02 the real executor dispatch boundary is journalled exactly once as TARGET_ATTEMPTED between admission and completion, pre-begin expiry never dispatches, and executor failure after a possible effect records OUTCOME_UNKNOWN atomically with the task-row transition instead of a fabricated completion',async t=>{const x=await fixture();try{
 const result=x.preview(),p=x.snapshot();
 const dispatch=p.events.filter(e=>e.kind==='TARGET_ATTEMPTED'&&e.taskId===result.invocationId);
 assert.equal(dispatch.length,1,'the actual executor dispatch boundary must be journalled exactly once, distinct from INTENT_ACCEPTED admission');
 const seqOf=kind=>p.events.find(e=>e.kind===kind&&e.taskId===result.invocationId).seq;
 assert.ok(seqOf('INTENT_ACCEPTED')<dispatch[0].seq&&dispatch[0].seq<seqOf('INTENT_COMPLETED'),'dispatch is journalled between admission and completion, never backfilled during projection');
 assert.equal(dispatch[0].action.attempt,1,'the single actual attempt stays attempt one; taskRevision is not attempt');
 assert.equal(dispatch[0].action.model,'NOT_RUN','no provider/model activity exists on this model-free seam');
 // expired admission before begin: zero dispatch and zero UNKNOWN facts.
 const r=x.invocations.resolve(x.tab.headers,{schemaVersion:'pansphaira.workspace-invocation/resolve/v1',input:{schemaVersion:'pansphaira.workspace-invocation/final-text/v1',inputKind:'TYPED_FINAL_TEXT',final:true,text:'Mach die Karte kleiner'},context:x.f.verification(x.tab),selectedCardId:'native-review',targetSurfaceId:null}),sel=r.set.candidates.find(c=>c.candidateId===r.set.selectedCandidateId);
 const a=x.invocations.admit(x.tab.headers,{schemaVersion:'pansphaira.workspace-invocation/admit/v1',setId:r.set.setId,requestDigest:r.set.requestDigest,setDigest:r.set.setDigest,candidateId:sel.candidateId,argumentDigest:sel.argumentDigest,policyRef:r.set.policyRef});
 t.mock.method(Date,'now',()=>r.set.expiresAtMs+1);
 assert.throws(()=>x.invocations.execute(x.tab.headers,{schemaVersion:'pansphaira.workspace-invocation/execute/v1',invocationId:a.invocationId,admissionToken:a.admissionToken,requestDigest:a.requestDigest,setDigest:a.setDigest,candidateId:a.candidateId,argumentDigest:a.argumentDigest,policyRef:a.policyRef}),/INVOCATION_|EXPIRED|SCOPE_/);
 t.mock.restoreAll();
 const expired=x.snapshot();
 assert.equal(expired.events.some(e=>e.taskId===a.invocationId&&['TARGET_ATTEMPTED','OUTCOME_UNKNOWN'].includes(e.kind)),false,'an admission that never began never dispatches and never fabricates outcome history');
 // real executor exception after the actual target acceptance: an owned SQLite abort at the
 // completion append loses the reply after the effect; the journal must then hold
 // INTENT_ACCEPTED, TARGET_ATTEMPTED and exactly one OUTCOME_UNKNOWN bound to the existing
 // task-row transition, with no INTENT_COMPLETED and no blind retry.
 const lost=x.preview(),{db}=nativeWorkspaceUiTaskOwnerConnectionV2(x.tasks,x.f.sessions.binding);
 const createLostTrigger=taskId=>{db.exec("DROP TRIGGER IF EXISTS pan607_lost_reply");db.exec(`CREATE TEMP TRIGGER pan607_lost_reply AFTER INSERT ON workspace_ui_context_outbox_v1 WHEN NEW.task_id='${taskId}' AND NEW.kind='INTENT_COMPLETED' BEGIN SELECT RAISE(ABORT,'PAN607_LOST_REPLY'); END`);}
 try{
  const b=x.invocations.resolve(x.tab.headers,{schemaVersion:'pansphaira.workspace-invocation/resolve/v1',input:{schemaVersion:'pansphaira.workspace-invocation/final-text/v1',inputKind:'TYPED_FINAL_TEXT',final:true,text:'Mach die Karte kleiner'},context:x.f.verification(x.tab),selectedCardId:'native-review',targetSurfaceId:null}),m=b.set.candidates.find(c=>c.candidateId===b.set.selectedCandidateId);
  const ad=x.invocations.admit(x.tab.headers,{schemaVersion:'pansphaira.workspace-invocation/admit/v1',setId:b.set.setId,requestDigest:b.set.requestDigest,setDigest:b.set.setDigest,candidateId:m.candidateId,argumentDigest:m.argumentDigest,policyRef:b.set.policyRef});
  createLostTrigger(ad.invocationId);
  assert.throws(()=>x.invocations.execute(x.tab.headers,{schemaVersion:'pansphaira.workspace-invocation/execute/v1',invocationId:ad.invocationId,admissionToken:ad.admissionToken,requestDigest:ad.requestDigest,setDigest:ad.setDigest,candidateId:ad.candidateId,argumentDigest:ad.argumentDigest,policyRef:ad.policyRef}),/PAN607_LOST_REPLY/);
  const after=x.snapshot(),row=after.tasks.find(o=>o.taskId===ad.invocationId);
  assert.equal(row.ownerState,'OUTCOME_UNCONFIRMED','a lost reply after a possible real effect stays outcome-unconfirmed, never a fabricated completion');
  const facts=after.events.filter(e=>e.taskId===ad.invocationId);
  assert.deepEqual(facts.map(e=>e.kind),['INTENT_ACCEPTED','TARGET_ATTEMPTED','OUTCOME_UNKNOWN'],'dispatch and UNKNOWN are journalled atomically with the real executor boundary');
  assert.equal(facts[2].taskRevision,row.revision,'the UNKNOWN fact is bound to the exact post-transition task revision');
  assert.equal(facts[2].action.attempt,1);assert.equal(facts[2].action.model,'NOT_RUN');
  assert.equal(after.events.filter(e=>e.taskId===ad.invocationId&&e.kind==='INTENT_COMPLETED').length,0,'no success is claimed without the completed reply');
  createLostTrigger(ad.invocationId);
  assert.throws(()=>x.invocations.execute(x.tab.headers,{schemaVersion:'pansphaira.workspace-invocation/execute/v1',invocationId:ad.invocationId,admissionToken:ad.admissionToken,requestDigest:ad.requestDigest,setDigest:ad.setDigest,candidateId:ad.candidateId,argumentDigest:ad.argumentDigest,policyRef:ad.policyRef}),/INVOCATION_ATTEMPT_ALREADY_REQUIRES_READBACK/);
  const retried=x.snapshot();
  assert.deepEqual(retried.events.filter(e=>e.taskId===ad.invocationId).map(e=>e.kind),['INTENT_ACCEPTED','TARGET_ATTEMPTED','OUTCOME_UNKNOWN'],'a redelivered attempt cannot duplicate events or blindly retry the UNKNOWN effect');
 }finally{db.exec('DROP TRIGGER pan607_lost_reply');}
 assert.equal(x.f.store.read(x.f.sessions.authenticate(x.tab.headers)).revision,0,'reading, snapshotting and retry rejection change zero stored target state on this preview seam');
}finally{await x.close();}});
test('697 ACT-02 dispatch journalling aborts atomically below the owner fence, forged or copied handles mutate nothing, and the owner-bound factual UNKNOWN survives later privacy revocation as a durable redacted fact',async t=>{const x=await fixture();try{
 const connection=nativeWorkspaceInvocationExecutorConnectionV1(x.invocations),{db,contextJournal}=nativeWorkspaceUiTaskOwnerConnectionV2(x.tasks,x.f.sessions.binding);
 const resolve=()=>x.invocations.resolve(x.tab.headers,{schemaVersion:'pansphaira.workspace-invocation/resolve/v1',input:{schemaVersion:'pansphaira.workspace-invocation/final-text/v1',inputKind:'TYPED_FINAL_TEXT',final:true,text:'Mach die Karte kleiner'},context:x.f.verification(x.tab),selectedCardId:'native-review',targetSurfaceId:null});
 const admit=r=>x.invocations.admit(x.tab.headers,{schemaVersion:'pansphaira.workspace-invocation/admit/v1',setId:r.set.setId,requestDigest:r.set.requestDigest,setDigest:r.set.setDigest,candidateId:r.set.candidates.find(c=>c.candidateId===r.set.selectedCandidateId).candidateId,argumentDigest:r.set.candidates.find(c=>c.candidateId===r.set.selectedCandidateId).argumentDigest,policyRef:r.set.policyRef});
 const exec=a=>({schemaVersion:'pansphaira.workspace-invocation/execute/v1',invocationId:a.invocationId,admissionToken:a.admissionToken,requestDigest:a.requestDigest,setDigest:a.setDigest,candidateId:a.candidateId,argumentDigest:a.argumentDigest,policyRef:a.policyRef});
 // The caller cannot select dispatch/UNKNOWN phases through the public record seam.
 const first=admit(resolve());
 assert.throws(()=>contextJournal.record(x.tab.headers,first.invocationId,'TARGET_ATTEMPTED'),/CONTEXT_EVENT_KIND_DENIED/);
 assert.throws(()=>contextJournal.record(x.tab.headers,first.invocationId,'OUTCOME_UNKNOWN'),/CONTEXT_EVENT_KIND_DENIED/);
 // A dispatch journalling abort (owned abort at the projection copy of exactly this
 // TARGET_ATTEMPTED append) leaves NO partial fact, a still-ACCEPTED row and no
 // private dispatch receipt: the caller never reaches the target and a forged or
 // copied handle cannot even transition the task row below the fence.
 const effect=connection.begin(x.tab.headers,exec(first));
 db.exec("CREATE TEMP TRIGGER pan607_dispatch_abort AFTER INSERT ON workspace_ui_context_projection_v1 BEGIN SELECT RAISE(ABORT,'PAN607_DISPATCH_ABORT'); END");
 assert.throws(()=>connection.dispatch(x.tab.headers,effect),/PAN607_DISPATCH_ABORT/);
 db.exec('DROP TRIGGER pan607_dispatch_abort');
 const midway=x.snapshot();
 assert.equal(midway.events.some(e=>e.taskId===first.invocationId&&e.kind==='TARGET_ATTEMPTED'),false,'an aborted dispatch append leaves no partial dispatch fact');
 assert.equal(midway.tasks.find(o=>o.taskId===first.invocationId).ownerState,'ACCEPTED','an aborted dispatch leaves the begun attempt accepted, not outcome-guessed');
 assert.throws(()=>connection.failed({invocationId:first.invocationId,ownerBinding:{principalDigest:'f'.repeat(64),privacyEpoch:1}}),/INVOCATION_HANDLE_UNBOUND/,'a copied or caller-forged handle carries no authority and is rejected before any task CAS');
 assert.equal(db.prepare('SELECT state FROM workspace_ui_tasks_v2 WHERE command_id=?').get(first.invocationId).state,'ACCEPTED','a rejected forged handle mutates zero task state');
 assert.throws(()=>connection.failed(Object.assign({},effect)),/INVOCATION_HANDLE_UNBOUND/,'a shallow copy of the owner-issued handle carries no authority');
 connection.failed(effect);
 assert.equal(db.prepare("SELECT count(*) n FROM workspace_ui_context_outbox_v1 WHERE task_id=?").get(first.invocationId).n,1,'a duplicate failed call on the undispatched genuine handle adds zero events and no UNKNOWN fact');
 assert.throws(()=>connection.dispatch(x.tab.headers,{invocationId:first.invocationId,s:effect.s,member:effect.member}),/INVOCATION_HANDLE_UNBOUND/,'a forged effect object cannot pass the dispatch fence');
 assert.equal(db.prepare('SELECT state FROM workspace_ui_tasks_v2 WHERE command_id=?').get(first.invocationId).state,'OUTCOME_UNCONFIRMED','the genuine pre-dispatch handle still transitions the begun attempt (legacy failure seam)');
 assert.equal(db.prepare("SELECT count(*) n FROM workspace_ui_context_outbox_v1 WHERE task_id=? AND kind='OUTCOME_UNKNOWN'").get(first.invocationId).n,0,'a pre-dispatch failure records no UNKNOWN fact for an undispatched attempt');
 // Genuine owner-issued begin/dispatch; then the reply is lost AFTER a privacy
 // revocation: the factual UNKNOWN must still persist under the intent's origin epoch.
 const second=admit(resolve()),effect2=connection.begin(x.tab.headers,exec(second));
 connection.dispatch(x.tab.headers,effect2);
 const liveDispatch=x.snapshot().events.find(e=>e.taskId===second.invocationId&&e.kind==='TARGET_ATTEMPTED');
 x.projection.revoke(x.tab.headers,{schemaVersion:'pansphaira.workspace-context-projection/privacy-revoke/v1'});
 connection.failed(effect2);
 connection.failed(effect2);
 // The revoked-epoch reader sees no plaintext facts for the retired attempt; the
 // durable owner outbox is the authoritative place to observe the atomic UNKNOWN.
 assert.throws(()=>x.snapshot(),/CONTEXT_PRIVACY_REVOKED/,'the revoked live snapshot is denied, never silently re-authorized');
 assert.equal(db.prepare("SELECT state FROM workspace_ui_tasks_v2 WHERE command_id=?").get(second.invocationId).state,'OUTCOME_UNCONFIRMED');
 const raw=db.prepare("SELECT kind,privacy_epoch,task_revision FROM workspace_ui_context_outbox_v1 WHERE task_id=? AND kind='OUTCOME_UNKNOWN'").all(second.invocationId);
 assert.equal(raw.length,1,'a duplicate failed call cannot duplicate the UNKNOWN fact');
 assert.equal(db.prepare("SELECT privacy_epoch FROM workspace_ui_context_outbox_v1 WHERE task_id=? AND kind='TARGET_ATTEMPTED'").get(second.invocationId).privacy_epoch,raw[0].privacy_epoch,'UNKNOWN is bound to the same intent origin epoch as the dispatch fact, not the current revoked epoch');
 assert.equal(raw[0].privacy_epoch,1,'both dispatch facts stay under the intent origin epoch');
 assert.equal(db.prepare('SELECT count(*) n FROM workspace_ui_context_outbox_v1 WHERE task_id=?').get(second.invocationId).n,3,'exactly accept, dispatch and UNKNOWN facts exist for the lost-reply attempt');
 assert.ok(liveDispatch.seq>0);
 // A durable completion is never overwritten by a late or duplicate failed call.
 x.projection.providerSwitch(x.tab.headers,{schemaVersion:'pansphaira.workspace-context-projection/contract-session-switch/v1',context:x.f.verification(x.tab)});
 const done=x.preview();
 assert.throws(()=>connection.failed({invocationId:done.invocationId}),/INVOCATION_HANDLE_UNBOUND/,'a forged handle cannot touch a completed attempt');
 connection.failed(effect2);
 const final=x.snapshot(),row=final.tasks.find(o=>o.taskId===done.invocationId);
 assert.equal(row.ownerState,'COMPLETED');assert.equal(row.state,'COMPLETED','a failed call after a durable completion cannot downgrade the confirmed result');
 assert.equal(final.events.some(e=>e.taskId===done.invocationId&&e.kind==='OUTCOME_UNKNOWN'),false);
 assert.equal(final.events.filter(e=>e.taskId===done.invocationId&&e.kind==='TARGET_ATTEMPTED').length,1,'the executor path records the dispatch boundary exactly once');
 assert.equal(final.events.some(e=>e.taskId===done.invocationId&&e.kind==='PROPOSAL_VALIDATED'),true,'the completed attempt keeps its independently validated target proof');
 assert.equal(final.events.some(e=>canonicalJson(e).includes(done.admissionToken)),false,'dispatch evidence still exposes no raw token, arguments or prompt');
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
test('607 specific B2: authentic pre-journal legacy accepted row stays UNKNOWN while unrelated signed projection repair proceeds without redispatch or fake authority',async()=>{const x=await fixture();try{
 const valid=x.preview(),legacy=genuineAcceptedWithoutTarget(x),{db}=nativeWorkspaceUiTaskOwnerConnectionV2(x.tasks,x.f.sessions.binding);db.prepare('DELETE FROM workspace_ui_context_projection_v1 WHERE seq IN(SELECT seq FROM workspace_ui_context_outbox_v1 WHERE task_id=?)').run(legacy.invocationId);db.prepare('DELETE FROM workspace_ui_context_outbox_v1 WHERE task_id=?').run(legacy.invocationId);const completion=db.prepare("SELECT seq FROM workspace_ui_context_outbox_v1 WHERE task_id=? AND kind='INTENT_COMPLETED'").get(valid.invocationId);db.prepare('DELETE FROM workspace_ui_context_projection_v1 WHERE seq=?').run(completion.seq);assert.equal(x.snapshot().tasks.find(t=>t.taskId===legacy.invocationId).legacyUnregisteredIntent,true);
 const result=x.projection.reconcile(x.tab.headers,{schemaVersion:'pansphaira.workspace-context-projection/reconcile/v1'});assert.equal(result.repaired,1);assert.equal(result.targetRedispatched,false);const row=x.snapshot().tasks.find(t=>t.taskId===legacy.invocationId);assert.equal(row.state,'OUTCOME_UNCONFIRMED');assert.equal(row.independentTargetEffectVerified,false);assert.equal(x.snapshot().events.filter(e=>e.taskId===legacy.invocationId).length,0);assert.equal(x.snapshot().constraints.noSend,true);assert.equal(x.f.store.read(x.f.sessions.authenticate(x.tab.headers)).revision,0);
 }finally{await x.close();}});
test('697 ACT-02 retargeting a genuinely minted handle onto a different minted ACCEPTED task records zero false facts and a post-dispatch retarget still persists the original task UNKNOWN atomically',async()=>{const x=await fixture();try{
 const connection=nativeWorkspaceInvocationExecutorConnectionV1(x.invocations),{db}=nativeWorkspaceUiTaskOwnerConnectionV2(x.tasks,x.f.sessions.binding);
 const resolve=()=>x.invocations.resolve(x.tab.headers,{schemaVersion:'pansphaira.workspace-invocation/resolve/v1',input:{schemaVersion:'pansphaira.workspace-invocation/final-text/v1',inputKind:'TYPED_FINAL_TEXT',final:true,text:'Mach die Karte kleiner'},context:x.f.verification(x.tab),selectedCardId:'native-review',targetSurfaceId:null});
 const admit=r=>x.invocations.admit(x.tab.headers,{schemaVersion:'pansphaira.workspace-invocation/admit/v1',setId:r.set.setId,requestDigest:r.set.requestDigest,setDigest:r.set.setDigest,candidateId:r.set.candidates.find(c=>c.candidateId===r.set.selectedCandidateId).candidateId,argumentDigest:r.set.candidates.find(c=>c.candidateId===r.set.selectedCandidateId).argumentDigest,policyRef:r.set.policyRef});
 const exec=a=>({schemaVersion:'pansphaira.workspace-invocation/execute/v1',invocationId:a.invocationId,admissionToken:a.admissionToken,requestDigest:a.requestDigest,setDigest:a.setDigest,candidateId:a.candidateId,argumentDigest:a.argumentDigest,policyRef:a.policyRef});
 const a=admit(resolve()),b=admit(resolve());
 const effectA=connection.begin(x.tab.headers,exec(a)),effectB=connection.begin(x.tab.headers,exec(b));
 const facts=()=>db.prepare('SELECT task_id,kind,seq FROM workspace_ui_context_outbox_v1 WHERE task_id IN(?,?) ORDER BY seq').all(a.invocationId,b.invocationId);
 const rows=()=>[a.invocationId,b.invocationId].map(id=>db.prepare('SELECT state,revision FROM workspace_ui_tasks_v2 WHERE command_id=?').get(id));
 // Pre-dispatch retarget borrows no rights: zero facts/rows move on either real task.
 const beforeFacts=facts(),beforeRows=rows();
 effectA.invocationId=b.invocationId;
 assert.throws(()=>connection.dispatch(x.tab.headers,effectA),/INVOCATION_HANDLE_UNBOUND/,'a retargeted genuine handle cannot borrow the second task dispatch boundary');
 assert.deepEqual(facts(),beforeFacts,'a rejected pre-dispatch retarget appends zero outbox facts on either task');
 assert.deepEqual(rows(),beforeRows,'a rejected pre-dispatch retarget transitions zero task rows');
 // The untouched handle still owns its own real boundary.
 connection.dispatch(x.tab.headers,effectB);
 connection.failed(effectB);
 assert.equal(db.prepare("SELECT count(*) n FROM workspace_ui_context_outbox_v1 WHERE task_id=? AND kind='TARGET_ATTEMPTED'").get(b.invocationId).n,1,'the genuine handle still records its own dispatch');
 // Post-dispatch retarget: the original dispatched task keeps exactly one UNKNOWN
 // despite the rejection; the never-dispatched second task stays untouched.
 const c=admit(resolve()),d=admit(resolve());
 const effectC=connection.begin(x.tab.headers,exec(c)),effectD=connection.begin(x.tab.headers,exec(d));
 connection.dispatch(x.tab.headers,effectC);
 effectC.invocationId=d.invocationId;
 assert.throws(()=>connection.failed(effectC),/INVOCATION_HANDLE_UNBOUND/,'a retargeted dispatched handle is still rejected');
 assert.equal(db.prepare('SELECT state FROM workspace_ui_tasks_v2 WHERE command_id=?').get(c.invocationId).state,'OUTCOME_UNCONFIRMED','the actually dispatched attempt keeps its outcome-unconfirmed transition');
 assert.equal(db.prepare("SELECT count(*) n FROM workspace_ui_context_outbox_v1 WHERE task_id=? AND kind='OUTCOME_UNKNOWN'").get(c.invocationId).n,1,'retargeting cannot discard the original task factual UNKNOWN');
 assert.equal(db.prepare("SELECT count(*) n FROM workspace_ui_context_outbox_v1 WHERE task_id=? AND kind='OUTCOME_UNKNOWN'").get(d.invocationId).n,0,'no UNKNOWN fact may be misattributed to the never-dispatched task');
 assert.equal(db.prepare('SELECT state FROM workspace_ui_tasks_v2 WHERE command_id=?').get(d.invocationId).state,'ACCEPTED','a retargeted failed call cannot transition the never-dispatched task');
 connection.failed(effectD);
}finally{await x.close();}});
